import { storage } from "../storage";
import { crmEvents } from "../events";
import { aiService, type LeadClassification } from "./ai";
import type { InsertMessage, Contact } from "@shared/schema";

// ---------------------------------------------------------------------------
// Normalized message format — all channels convert to this before processing
// ---------------------------------------------------------------------------
export interface NormalizedMessage {
  channel: "email" | "whatsapp" | "instagram" | "web_form" | "artsy";
  externalId?: string;
  senderName?: string;
  senderEmail?: string;
  senderPhone?: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Main processor — takes a normalized message and runs the full pipeline:
//   1. Save to messages table
//   2. Classify with Claude
//   3. Find or create contact
//   4. Create deal if purchase intent detected
//   5. Log activity
//   6. Draft reply
// ---------------------------------------------------------------------------
export async function processIncomingMessage(msg: NormalizedMessage) {
  const now = new Date().toISOString();

  // 1. Save inbound message
  const saved = await storage.createMessage({
    channel: msg.channel,
    direction: "inbound",
    externalId: msg.externalId || null,
    senderName: msg.senderName || null,
    senderEmail: msg.senderEmail || null,
    senderPhone: msg.senderPhone || null,
    subject: msg.subject || null,
    body: msg.body,
    metadata: msg.metadata ? JSON.stringify(msg.metadata) : null,
    status: "pending",
    createdAt: now,
    contactId: null,
    dealId: null,
    aiClassification: null,
    processedAt: null,
  });

  crmEvents.emitCrm("message.received", { message: saved });

  // 2. Classify with Claude (returns null if API key not set)
  const classification = await aiService.classifyLead(msg.body, {
    name: msg.senderName,
    email: msg.senderEmail,
    phone: msg.senderPhone,
  });

  if (!classification) {
    console.warn("[message-processor] AI classification unavailable — message saved but not processed");
    await storage.updateMessage(saved.id, { status: "failed", processedAt: now });
    return { message: saved, classification: null, contact: null, deal: null };
  }

  // Store classification
  await storage.updateMessage(saved.id, {
    aiClassification: JSON.stringify(classification),
  });

  // 3. Find or create contact
  const email = msg.senderEmail || classification.contactEmail;
  const phone = msg.senderPhone || classification.contactPhone;
  let contact: Contact | undefined = await storage.findContactByEmailOrPhone(
    email || undefined,
    phone || undefined,
  );

  const contactName =
    classification.contactName || msg.senderName || email || "Unknown";

  if (contact) {
    // Update existing contact with new intelligence
    const updates: Record<string, unknown> = {};
    if (classification.artistsMentioned.length > 0) {
      const existing = contact.artistsOfInterest || [];
      const merged = Array.from(new Set([...existing, ...classification.artistsMentioned]));
      updates.artistsOfInterest = merged;
    }
    if (classification.preferredMedium && !contact.preferredMedium) {
      updates.preferredMedium = classification.preferredMedium;
    }
    if (!contact.preferredChannel) {
      updates.preferredChannel = msg.channel;
    }
    if (!contact.leadSource) {
      updates.leadSource = msg.channel;
    }
    updates.lastContactDate = now;

    if (Object.keys(updates).length > 0) {
      contact = (await storage.updateContact(contact.id, updates)) || contact;
    }
  } else {
    // Create new contact
    contact = await storage.createContact({
      name: contactName,
      email: email || null,
      phone: phone || null,
      type: classification.contactType === "unknown" ? "collector" : classification.contactType,
      city: classification.contactCity || null,
      country: classification.contactCountry || null,
      preferredChannel: msg.channel,
      leadSource: msg.channel,
      artistsOfInterest: classification.artistsMentioned.length > 0 ? classification.artistsMentioned : null,
      preferredMedium: classification.preferredMedium || null,
      relationshipLevel: "new",
      firstContactDate: now,
      lastContactDate: now,
    });
    crmEvents.emitCrm("contact.created", { contact });
  }

  // Link message to contact
  await storage.updateMessage(saved.id, { contactId: contact.id });

  // 4. Create deal if purchase intent detected (score >= 40)
  let deal = null;
  if (classification.intentScore >= 40 && ["purchase_inquiry", "price_request"].includes(classification.intentType)) {
    deal = await storage.createDeal({
      title: `${classification.intentType === "price_request" ? "Price inquiry" : "Purchase inquiry"} — ${contactName}`,
      contactId: contact.id,
      contactName: contact.name,
      stage: classification.suggestedStage,
      sourceChannel: msg.channel,
      intentScore: classification.intentScore,
      value: 0,
      currency: "USD",
      priority: classification.intentScore >= 70 ? "high" : "medium",
      notes: classification.summary,
      createdDate: now,
      lastActivityAt: now,
    });
    crmEvents.emitCrm("deal.created", { deal });

    // Link message to deal
    await storage.updateMessage(saved.id, { dealId: deal.id });
  }

  // 5. Log activity
  await storage.createActivity({
    type: "message",
    description: `[${msg.channel}] ${classification.summary}`,
    contactId: contact.id,
    contactName: contact.name,
    dealId: deal?.id || null,
    date: now,
  });

  // 6. Draft reply
  const draftText = await aiService.draftReply(msg.body, classification);
  if (draftText) {
    await storage.createMessage({
      channel: msg.channel,
      direction: "outbound",
      contactId: contact.id,
      dealId: deal?.id || null,
      senderName: "Galería Duque Arango",
      body: draftText,
      status: "draft",
      createdAt: now,
      subject: null,
      senderEmail: null,
      senderPhone: null,
      externalId: null,
      metadata: null,
      aiClassification: null,
      processedAt: null,
    });
  }

  // 7. Mark as processed
  await storage.updateMessage(saved.id, { status: "processed", processedAt: new Date().toISOString() });

  console.log(
    `[message-processor] ${msg.channel} message from ${contactName} → ` +
    `${classification.intentType} (score: ${classification.intentScore}) → ` +
    `contact #${contact.id}${deal ? ` → deal #${deal.id}` : ""}`,
  );

  return { message: saved, classification, contact, deal };
}
