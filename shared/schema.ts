import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Pipeline stages — single source of truth
export const PIPELINE_STAGES = [
  "new_inquiry", "qualified", "artwork_presented",
  "collector_engaged", "negotiation", "closed_won", "closed_lost",
] as const;
export type PipelineStage = typeof PIPELINE_STAGES[number];
export const pipelineStageEnum = z.enum(PIPELINE_STAGES);

// Users: authentication & roles
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("advisor"), // "director" | "advisor"
  createdAt: text("created_at").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Contacts: collectors, artists, institutions, galleries
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  type: text("type").notNull(),
  company: text("company"),
  notes: text("notes"),
  tags: text("tags").array(),
  city: text("city"),
  country: text("country"),
  lastContactDate: text("last_contact_date"),
  totalPurchases: integer("total_purchases").default(0),
  totalSpent: integer("total_spent").default(0),
  // Phase 2: collector intelligence
  preferredChannel: text("preferred_channel"),
  budgetLow: integer("budget_low"),
  budgetHigh: integer("budget_high"),
  preferredMedium: text("preferred_medium"),
  preferredScale: text("preferred_scale"),
  artistsOfInterest: text("artists_of_interest").array(),
  relationshipLevel: text("relationship_level").default("new"),
  leadSource: text("lead_source"),
  firstContactDate: text("first_contact_date"),
  lifetimeValue: integer("lifetime_value").default(0),
});

export const insertContactSchema = createInsertSchema(contacts).omit({ id: true }).extend({
  name: z.string().min(1).max(500),
  email: z.string().max(500).nullable().optional(),
  phone: z.string().max(100).nullable().optional(),
  company: z.string().max(500).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  city: z.string().max(200).nullable().optional(),
  country: z.string().max(200).nullable().optional(),
});
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// Artworks: inventory — Artlogic-style comprehensive fields
export const artworks = pgTable("artworks", {
  id: serial("id").primaryKey(),
  stockNumber: text("stock_number"),          // Artlogic: auto-generated, e.g. CM001
  title: text("title").notNull(),
  artistName: text("artist_name").notNull(),
  medium: text("medium"),
  dimensions: text("dimensions"),
  year: text("year"),
  inscription: text("inscription"),           // Artlogic: signed/dated info
  description: text("description"),
  // Financial
  retailPrice: integer("retail_price"),
  retailCurrency: text("retail_currency").default("USD"),
  costPrice: integer("cost_price"),           // purchase/production cost
  // Status & Availability
  status: text("status").notNull(),           // available, reserved, sold, on_loan, on_consignment
  availability: text("availability").default("in_stock"), // in_stock, consigned_in, consigned_out
  // Location
  location: text("location"),
  locationDetail: text("location_detail"),     // room/wall/rack
  // Edition / Print
  isEdition: boolean("is_edition").default(false),
  editionInfo: text("edition_info"),           // e.g. "Edition of 5, AP 2"
  // Provenance & Documentation
  provenance: text("provenance"),
  exhibitionHistory: text("exhibition_history"),
  literature: text("literature"),
  condition: text("condition"),
  conditionNotes: text("condition_notes"),
  // Media
  imageUrl: text("image_url"),
  thumbUrl: text("thumb_url"),
  mediumUrl: text("medium_url"),
  secondaryImages: text("secondary_images").array(),
  // Internal
  importance: integer("importance").default(0),  // Artlogic: star rating 0-5
  internalNotes: text("internal_notes"),
  tags: text("tags").array(),
  // Relationships
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  consignorId: integer("consignor_id").references(() => contacts.id, { onDelete: "set null" }),
  // Series / Category
  series: text("series"),
  genre: text("genre"),
  category: text("category"),                  // painting, sculpture, photography, etc.
  // Status & Availability extras
  isEquipment: boolean("is_equipment").default(false),
  market: text("market"),                       // "n_a", "primary", "secondary"
  associatedCosts: integer("associated_costs"), // for profit calculation
  // Consignment details
  consignorIsArtist: boolean("consignor_is_artist").default(false),
  consignmentFromDate: text("consignment_from_date"),
  consignmentReturnDue: text("consignment_return_due"),
  consignmentReturned: boolean("consignment_returned").default(false),
  consignmentReminderDate: text("consignment_reminder_date"),
  consignmentTerms: text("consignment_terms"),           // "percentage" | "net_value"
  consignmentPercentage: integer("consignment_percentage"),
  consignmentNetValue: integer("consignment_net_value"),
  consignmentNotes: text("consignment_notes"),
  consignmentHistory: text("consignment_history"),
  contractSigned: boolean("contract_signed").default(false),
  nonStandardContract: boolean("non_standard_contract").default(false),
  consignmentInvoiceStatus: text("consignment_invoice_status"), // "not_invoiced", "invoiced", "paid"
  // Documentation
  additionalCertificates: text("additional_certificates"),
  additionalDocuments: text("additional_documents"),
});

export const insertArtworkSchema = createInsertSchema(artworks).omit({ id: true }).extend({
  title: z.string().min(1).max(500),
  artistName: z.string().min(1).max(500),
  medium: z.string().max(500).nullable().optional(),
  dimensions: z.string().max(500).nullable().optional(),
  description: z.string().max(10000).nullable().optional(),
  provenance: z.string().max(10000).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
});
export type InsertArtwork = z.infer<typeof insertArtworkSchema>;
export type Artwork = typeof artworks.$inferSelect;

// Artist Settings: per-artist metadata (group, notes, etc.)
export const artistSettings = pgTable("artist_settings", {
  id: serial("id").primaryKey(),
  artistName: text("artist_name").notNull().unique(),
  group: text("group").notNull().default("active"), // "active" | "for_review"
});

export const insertArtistSettingsSchema = createInsertSchema(artistSettings).omit({ id: true });
export type InsertArtistSettings = z.infer<typeof insertArtistSettingsSchema>;
export type ArtistSettings = typeof artistSettings.$inferSelect;

// Deals: sales pipeline (7-stage consultative art sales)
export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  artworkId: integer("artwork_id").references(() => artworks.id, { onDelete: "set null" }),
  value: integer("value"),
  stage: text("stage").notNull(),
  priority: text("priority").default("medium"),
  notes: text("notes"),
  expectedCloseDate: text("expected_close_date"),
  createdDate: text("created_date"),
  contactName: text("contact_name"),
  artworkTitle: text("artwork_title"),
  // Phase 1: new fields
  currency: text("currency").default("USD"),
  sourceChannel: text("source_channel"),
  lostReason: text("lost_reason"),
  lastActivityAt: text("last_activity_at"),
  closeDate: text("close_date"),
  firstResponseTime: integer("first_response_time"),
  intentScore: integer("intent_score").default(0),
  advisorName: text("advisor_name"),
});

export const insertDealSchema = createInsertSchema(deals).omit({ id: true }).extend({
  title: z.string().min(1).max(500),
  stage: pipelineStageEnum,
  notes: z.string().max(5000).nullable().optional(),
  lostReason: z.string().max(1000).nullable().optional(),
});
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

// Exhibitions
export const exhibitions = pgTable("exhibitions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  location: text("location"),
  description: text("description"),
  status: text("status").notNull(),
  budget: integer("budget"),
  artworkIds: integer("artwork_ids").array(),
});

export const insertExhibitionSchema = createInsertSchema(exhibitions).omit({ id: true });
export type InsertExhibition = z.infer<typeof insertExhibitionSchema>;
export type Exhibition = typeof exhibitions.$inferSelect;

// Activities
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  contactName: text("contact_name"),
});

export const insertActivitySchema = createInsertSchema(activities).omit({ id: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

// Follow-ups (Phase 4)
export const followups = pgTable("followups", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  description: text("description").notNull(),
  dueDate: text("due_date").notNull(),
  dueTime: text("due_time"),
  status: text("status").notNull().default("pending"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  contactName: text("contact_name"),
  dealTitle: text("deal_title"),
  notes: text("notes"),
  advisorName: text("advisor_name"),
});

export const insertFollowupSchema = createInsertSchema(followups).omit({ id: true });
export type InsertFollowup = z.infer<typeof insertFollowupSchema>;
export type Followup = typeof followups.$inferSelect;

// Invoices — auto-created when a deal is closed_won
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  // Snapshot fields (survive deal/contact edits)
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  artworkTitle: text("artwork_title"),
  artworkDetails: text("artwork_details"), // "medium, dimensions, year"
  artistName: text("artist_name"),
  // Financial
  amount: integer("amount").notNull(),
  currency: text("currency").default("USD"),
  tax: integer("tax").default(0),
  totalAmount: integer("total_amount").notNull(),
  // Status
  status: text("status").notNull().default("draft"), // draft, sent, paid
  // Dates
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date"),
  paidDate: text("paid_date"),
  // Notes
  notes: text("notes"),
  advisorName: text("advisor_name"),
  createdAt: text("created_at").notNull(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// Messages: multi-channel conversation log
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  externalId: text("external_id"),                    // ID in the source channel
  channel: text("channel").notNull(),                  // email, whatsapp, instagram, web_form, artsy
  direction: text("direction").notNull(),              // inbound, outbound
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }),
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  senderPhone: text("sender_phone"),
  subject: text("subject"),
  body: text("body").notNull(),
  metadata: text("metadata"),                          // JSON: channel-specific data
  aiClassification: text("ai_classification"),         // JSON: Claude's analysis
  status: text("status").default("pending"),            // pending, processed, draft, sent, failed
  createdAt: text("created_at").notNull(),
  processedAt: text("processed_at"),
});

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
