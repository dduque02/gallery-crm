import type { Express } from "express";
import type { Server } from "http";
import { ZodError } from "zod";
import multer from "multer";
import { storage } from "./storage";
import { supabase, ensureBucket } from "./supabase";
import { crmEvents } from "./events";
import { requireRole } from "./auth";
import { validateImage, processImage } from "./image";
import { processIncomingMessage } from "./services/message-processor";
import {
  insertContactSchema,
  insertArtworkSchema,
  insertArtistSettingsSchema,
  insertDealSchema,
  insertExhibitionSchema,
  insertActivitySchema,
  insertFollowupSchema,
  insertInvoiceSchema,
} from "../shared/schema";
import { generateInvoicePdf } from "./pdf";

function handleValidationError(err: unknown, res: any) {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: "Validation error", errors: err.errors });
  }
  throw err;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB (consistent with Artlogic)
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

export async function registerRoutes(server: Server, app: Express) {
  // Initialize Supabase Storage bucket
  ensureBucket().catch(err => console.warn("Could not ensure storage bucket:", err));

  // Image upload — processes into 3 WebP sizes (thumb, medium, full)
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!supabase) {
      return res.status(503).json({ message: "Image upload not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No file provided or invalid format. Accepted: jpg, png, webp." });
    }

    // Validate dimensions
    const validationError = await validateImage(req.file.buffer);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const baseName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cacheControl = "public, max-age=31536000, immutable";

    try {
      // Process into 3 WebP sizes
      const images = await processImage(req.file.buffer, baseName);

      const urls: Record<string, string> = {};
      for (const [key, img] of Object.entries(images)) {
        const { error } = await supabase.storage
          .from("artwork-images")
          .upload(img.filename, img.buffer, {
            contentType: img.contentType,
            upsert: false,
            cacheControl,
          });

        if (error) {
          console.error(`Supabase upload error (${key}):`, error);
          return res.status(500).json({ message: "Upload failed", detail: error.message });
        }

        const { data: { publicUrl } } = supabase.storage
          .from("artwork-images")
          .getPublicUrl(img.filename);

        urls[key] = publicUrl;
      }

      res.json({ url: urls.full, thumbUrl: urls.thumb, mediumUrl: urls.medium });
    } catch (err) {
      // Fallback: upload original file as-is if Sharp processing fails
      console.warn("[upload] Sharp processing failed, uploading original:", err);
      const ext = req.file.originalname.split(".").pop() || "jpg";
      const fallbackPath = `artworks/${baseName}.${ext}`;

      const { error } = await supabase.storage
        .from("artwork-images")
        .upload(fallbackPath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
          cacheControl,
        });

      if (error) {
        return res.status(500).json({ message: "Upload failed", detail: error.message });
      }

      const { data: { publicUrl } } = supabase.storage
        .from("artwork-images")
        .getPublicUrl(fallbackPath);

      res.json({ url: publicUrl, thumbUrl: null, mediumUrl: null });
    }
  });
  // Contacts — paginated
  app.get("/api/contacts", async (req, res) => {
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const pageSize = Math.min(200, Math.max(1, Math.floor(Number(req.query.pageSize) || 50)));
    const search = (req.query.search as string) || "";
    const type = (req.query.type as string) || "all";
    const result = await storage.getContacts({ page, pageSize, search, type });
    res.json(result);
  });
  app.get("/api/contacts/:id", async (req, res) => {
    const contact = await storage.getContact(Number(req.params.id));
    if (!contact) return res.status(404).json({ message: "Not found" });
    res.json(contact);
  });
  app.get("/api/contacts/:id/deals", async (req, res) => {
    const items = await storage.getDealsByContactId(Number(req.params.id));
    res.json(items);
  });
  app.post("/api/contacts", async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(data);
      res.status(201).json(contact);
      crmEvents.emitCrm("contact.created", { contact });
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  app.patch("/api/contacts/:id", async (req, res) => {
    try {
      const data = insertContactSchema.partial().parse(req.body);
      const contact = await storage.updateContact(Number(req.params.id), data);
      if (!contact) return res.status(404).json({ message: "Not found" });
      res.json(contact);
      crmEvents.emitCrm("contact.updated", { contact, changes: data });
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  app.delete("/api/contacts/:id", requireRole("director"), async (req, res) => {
    await storage.deleteContact(Number(req.params.id));
    res.status(204).send();
  });

  // Artworks — paginated
  app.get("/api/artworks/locations", async (_req, res) => {
    const locations = await storage.getArtworkLocations();
    res.json(locations);
  });
  app.get("/api/artworks", async (req, res) => {
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const pageSize = Math.min(200, Math.max(1, Math.floor(Number(req.query.pageSize) || 50)));
    const search = (req.query.search as string) || "";
    const status = (req.query.status as string) || "all";
    const category = (req.query.category as string) || "all";
    const location = (req.query.location as string) || "all";
    const sort = (req.query.sort as string) || "artist";
    const result = await storage.getArtworks({ page, pageSize, search, status, category, location, sort });
    res.json(result);
  });
  app.get("/api/artworks/:id", async (req, res) => {
    const artwork = await storage.getArtwork(Number(req.params.id));
    if (!artwork) return res.status(404).json({ message: "Not found" });
    res.json(artwork);
  });
  app.post("/api/artworks", async (req, res) => {
    try {
      const data = insertArtworkSchema.parse(req.body);
      const artwork = await storage.createArtwork(data);
      res.status(201).json(artwork);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  app.patch("/api/artworks/:id", async (req, res) => {
    try {
      const data = insertArtworkSchema.partial().parse(req.body);
      const artwork = await storage.updateArtwork(Number(req.params.id), data);
      if (!artwork) return res.status(404).json({ message: "Not found" });
      res.json(artwork);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  app.delete("/api/artworks/:id", requireRole("director"), async (req, res) => {
    await storage.deleteArtwork(Number(req.params.id));
    res.status(204).send();
  });

  // Artists — aggregated from artworks
  app.get("/api/artists", async (req, res) => {
    const search = (req.query.search as string) || "";
    const category = (req.query.category as string) || "all";
    const group = (req.query.group as string) || "active";
    const rows = await storage.getArtists(search, category, group);
    res.json(rows);
  });

  // Artist Settings — set group
  app.put("/api/artists/group", async (req, res) => {
    try {
      const data = insertArtistSettingsSchema.parse(req.body);
      const result = await storage.setArtistGroup(data.artistName, data.group ?? "active");
      res.json(result);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });

  // Deals
  app.get("/api/deals", async (_req, res) => {
    const deals = await storage.getDeals();
    res.json(deals);
  });
  app.get("/api/deals/:id", async (req, res) => {
    const deal = await storage.getDeal(Number(req.params.id));
    if (!deal) return res.status(404).json({ message: "Not found" });
    res.json(deal);
  });
  app.get("/api/deals/:id/activities", async (req, res) => {
    const items = await storage.getActivitiesByDealId(Number(req.params.id));
    res.json(items);
  });
  app.get("/api/deals/:id/followups", async (req, res) => {
    const items = await storage.getFollowupsByDealId(Number(req.params.id));
    res.json(items);
  });
  app.post("/api/deals", async (req, res) => {
    try {
      const data = insertDealSchema.parse(req.body);
      const deal = await storage.createDeal(data);
      res.status(201).json(deal);
      crmEvents.emitCrm("deal.created", { deal });
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  app.patch("/api/deals/:id", async (req, res) => {
    try {
      const body = insertDealSchema.partial().parse(req.body);
      // Auto-set lastActivityAt on every update
      body.lastActivityAt = new Date().toISOString();
      // Validate closed_lost requires lostReason
      if (body.stage === "closed_lost" && !body.lostReason) {
        return res.status(400).json({ message: "lostReason is required when moving to closed_lost" });
      }
      // Auto-set closeDate on closed_won/closed_lost
      if (body.stage === "closed_won" || body.stage === "closed_lost") {
        body.closeDate = new Date().toISOString().split("T")[0];
      }
      // Check if this is a stage transition (need old deal state)
      const oldDeal = await storage.getDeal(Number(req.params.id));
      const deal = await storage.updateDeal(Number(req.params.id), body);
      if (!deal) return res.status(404).json({ message: "Not found" });

      res.json(deal);

      // Emit events for automations
      crmEvents.emitCrm("deal.updated", { deal, changes: body });
      if (body.stage && oldDeal && body.stage !== oldDeal.stage) {
        crmEvents.emitCrm("deal.stageChanged", { deal, fromStage: oldDeal.stage, toStage: body.stage });
        if (body.stage === "closed_won") {
          crmEvents.emitCrm("deal.closedWon", { deal });
        }
      }
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  app.delete("/api/deals/:id", requireRole("director"), async (req, res) => {
    await storage.deleteDeal(Number(req.params.id));
    res.status(204).send();
  });

  // Exhibitions
  app.get("/api/exhibitions", async (_req, res) => {
    const exhibitions = await storage.getExhibitions();
    res.json(exhibitions);
  });
  app.post("/api/exhibitions", async (req, res) => {
    try {
      const data = insertExhibitionSchema.parse(req.body);
      const exhibition = await storage.createExhibition(data);
      res.status(201).json(exhibition);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  app.patch("/api/exhibitions/:id", async (req, res) => {
    try {
      const data = insertExhibitionSchema.partial().parse(req.body);
      const exhibition = await storage.updateExhibition(Number(req.params.id), data);
      if (!exhibition) return res.status(404).json({ message: "Not found" });
      res.json(exhibition);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  app.delete("/api/exhibitions/:id", requireRole("director"), async (req, res) => {
    await storage.deleteExhibition(Number(req.params.id));
    res.status(204).send();
  });

  // Activities
  app.get("/api/activities", async (_req, res) => {
    const activities = await storage.getActivities();
    res.json(activities);
  });
  app.post("/api/activities", async (req, res) => {
    try {
      const data = insertActivitySchema.parse(req.body);
      const activity = await storage.createActivity(data);
      res.status(201).json(activity);
      crmEvents.emitCrm("activity.created", { activity });
    } catch (err) {
      return handleValidationError(err, res);
    }
  });

  // Followups
  app.get("/api/followups", async (_req, res) => {
    const followups = await storage.getFollowups();
    res.json(followups);
  });
  app.post("/api/followups", async (req, res) => {
    try {
      const data = insertFollowupSchema.parse(req.body);
      const followup = await storage.createFollowup(data);
      res.status(201).json(followup);
      crmEvents.emitCrm("followup.created", { followup });
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  app.patch("/api/followups/:id", async (req, res) => {
    try {
      const data = insertFollowupSchema.partial().parse(req.body);
      const followup = await storage.updateFollowup(Number(req.params.id), data);
      if (!followup) return res.status(404).json({ message: "Not found" });
      res.json(followup);
      if (data.status === "completed") {
        crmEvents.emitCrm("followup.completed", { followup });
      }
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  app.delete("/api/followups/:id", requireRole("director"), async (req, res) => {
    await storage.deleteFollowup(Number(req.params.id));
    res.status(204).send();
  });

  // Sales History (reads from invoices — source of truth for completed sales)
  app.get("/api/sales-history", async (req, res) => {
    const dateFrom = (req.query.dateFrom as string) || undefined;
    const dateTo = (req.query.dateTo as string) || undefined;
    const contactId = req.query.contactId ? Number(req.query.contactId) : undefined;
    const advisorName = (req.query.advisorName as string) || undefined;
    const search = (req.query.search as string) || undefined;
    const invoiceList = await storage.getSalesHistory({ dateFrom, dateTo, contactId, advisorName, search });
    res.json(invoiceList);
  });
  app.get("/api/sales-stats", async (_req, res) => {
    const stats = await storage.getSalesStats();
    res.json(stats);
  });

  // Invoices
  app.get("/api/invoices", async (req, res) => {
    const contactId = req.query.contactId ? Number(req.query.contactId) : undefined;
    const dateFrom = (req.query.dateFrom as string) || undefined;
    const dateTo = (req.query.dateTo as string) || undefined;
    const items = await storage.getInvoices({ contactId, dateFrom, dateTo });
    // Cap response to 500 records for safety
    res.json(items.slice(0, 500));
  });
  app.get("/api/invoices/:id", async (req, res) => {
    const invoice = await storage.getInvoice(Number(req.params.id));
    if (!invoice) return res.status(404).json({ message: "Not found" });
    res.json(invoice);
  });
  app.post("/api/invoices", async (req, res) => {
    try {
      const data = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(data);
      res.status(201).json(invoice);
      crmEvents.emitCrm("invoice.created", { invoice });
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  app.patch("/api/invoices/:id", async (req, res) => {
    try {
      const data = insertInvoiceSchema.partial().parse(req.body);
      const invoice = await storage.updateInvoice(Number(req.params.id), data);
      if (!invoice) return res.status(404).json({ message: "Not found" });
      res.json(invoice);
    } catch (err) {
      return handleValidationError(err, res);
    }
  });
  app.delete("/api/invoices/:id", requireRole("director"), async (req, res) => {
    await storage.deleteInvoice(Number(req.params.id));
    res.status(204).send();
  });
  app.get("/api/invoices/:id/pdf", async (req, res) => {
    const invoice = await storage.getInvoice(Number(req.params.id));
    if (!invoice) return res.status(404).json({ message: "Not found" });
    try {
      const pdfBuffer = generateInvoicePdf(invoice);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
      res.send(Buffer.from(pdfBuffer));
    } catch (err) {
      console.error("PDF generation error:", err);
      res.status(500).json({ message: "PDF generation failed" });
    }
  });

  // Messages
  app.get("/api/messages", async (req, res) => {
    const channel = (req.query.channel as string) || undefined;
    const status = (req.query.status as string) || undefined;
    const contactId = req.query.contactId ? Number(req.query.contactId) : undefined;
    const msgs = await storage.getMessages({ channel, status, contactId });
    res.json(msgs);
  });
  app.get("/api/messages/:id", async (req, res) => {
    const msg = await storage.getMessage(Number(req.params.id));
    if (!msg) return res.status(404).json({ message: "Not found" });
    res.json(msg);
  });

  // Webhooks — incoming messages from external channels (no auth required)
  const webhookLimiter = (await import("express-rate-limit")).default({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req: any) => req.ip || req.socket.remoteAddress || "unknown",
    message: { message: "Too many requests" },
  });
  app.post("/api/webhooks/web-form", webhookLimiter, async (req, res) => {
    const { name, email, phone, message, subject, artworkInterest } = req.body;
    if (!message && !artworkInterest) {
      return res.status(400).json({ message: "message or artworkInterest is required" });
    }

    try {
      const result = await processIncomingMessage({
        channel: "web_form",
        senderName: name || undefined,
        senderEmail: email || undefined,
        senderPhone: phone || undefined,
        subject: subject || artworkInterest || undefined,
        body: artworkInterest ? `${artworkInterest}\n\n${message || ""}`.trim() : message,
      });

      res.status(201).json({
        ok: true,
        messageId: result.message.id,
        contactId: result.contact?.id || null,
        dealId: result.deal?.id || null,
      });
    } catch (err) {
      console.error("[webhook/web-form] Error:", err);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // Dashboard stats — computed via SQL
  app.get("/api/stats", async (_req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });
}
