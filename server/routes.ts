import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(server: Server, app: Express) {
  // Contacts — paginated
  app.get("/api/contacts", async (req, res) => {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 50;
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
  app.post("/api/contacts", async (req, res) => {
    const contact = await storage.createContact(req.body);
    res.status(201).json(contact);
  });
  app.patch("/api/contacts/:id", async (req, res) => {
    const contact = await storage.updateContact(Number(req.params.id), req.body);
    if (!contact) return res.status(404).json({ message: "Not found" });
    res.json(contact);
  });
  app.delete("/api/contacts/:id", async (req, res) => {
    await storage.deleteContact(Number(req.params.id));
    res.status(204).send();
  });

  // Artworks — paginated
  app.get("/api/artworks/locations", async (_req, res) => {
    const locations = await storage.getArtworkLocations();
    res.json(locations);
  });
  app.get("/api/artworks", async (req, res) => {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 50;
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
    const artwork = await storage.createArtwork(req.body);
    res.status(201).json(artwork);
  });
  app.patch("/api/artworks/:id", async (req, res) => {
    const artwork = await storage.updateArtwork(Number(req.params.id), req.body);
    if (!artwork) return res.status(404).json({ message: "Not found" });
    res.json(artwork);
  });
  app.delete("/api/artworks/:id", async (req, res) => {
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
    const { artistName, group } = req.body;
    const result = await storage.setArtistGroup(artistName, group);
    res.json(result);
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
  app.post("/api/deals", async (req, res) => {
    const deal = await storage.createDeal(req.body);
    res.status(201).json(deal);
  });
  app.patch("/api/deals/:id", async (req, res) => {
    const body = { ...req.body };
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
    const deal = await storage.updateDeal(Number(req.params.id), body);
    if (!deal) return res.status(404).json({ message: "Not found" });
    res.json(deal);
  });
  app.delete("/api/deals/:id", async (req, res) => {
    await storage.deleteDeal(Number(req.params.id));
    res.status(204).send();
  });

  // Exhibitions
  app.get("/api/exhibitions", async (_req, res) => {
    const exhibitions = await storage.getExhibitions();
    res.json(exhibitions);
  });
  app.post("/api/exhibitions", async (req, res) => {
    const exhibition = await storage.createExhibition(req.body);
    res.status(201).json(exhibition);
  });
  app.patch("/api/exhibitions/:id", async (req, res) => {
    const exhibition = await storage.updateExhibition(Number(req.params.id), req.body);
    if (!exhibition) return res.status(404).json({ message: "Not found" });
    res.json(exhibition);
  });
  app.delete("/api/exhibitions/:id", async (req, res) => {
    await storage.deleteExhibition(Number(req.params.id));
    res.status(204).send();
  });

  // Activities
  app.get("/api/activities", async (_req, res) => {
    const activities = await storage.getActivities();
    res.json(activities);
  });
  app.post("/api/activities", async (req, res) => {
    const activity = await storage.createActivity(req.body);
    res.status(201).json(activity);
  });

  // Followups
  app.get("/api/followups", async (_req, res) => {
    const followups = await storage.getFollowups();
    res.json(followups);
  });
  app.post("/api/followups", async (req, res) => {
    const followup = await storage.createFollowup(req.body);
    res.status(201).json(followup);
  });
  app.patch("/api/followups/:id", async (req, res) => {
    const followup = await storage.updateFollowup(Number(req.params.id), req.body);
    if (!followup) return res.status(404).json({ message: "Not found" });
    res.json(followup);
  });
  app.delete("/api/followups/:id", async (req, res) => {
    await storage.deleteFollowup(Number(req.params.id));
    res.status(204).send();
  });

  // Dashboard stats — computed via SQL
  app.get("/api/stats", async (_req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });
}
