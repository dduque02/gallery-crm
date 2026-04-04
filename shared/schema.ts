import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const insertContactSchema = createInsertSchema(contacts).omit({ id: true });
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
  // Internal
  importance: integer("importance").default(0),  // Artlogic: star rating 0-5
  internalNotes: text("internal_notes"),
  tags: text("tags").array(),
  // Relationships
  contactId: integer("contact_id"),            // artist contact
  consignorId: integer("consignor_id"),
  // Series / Category
  series: text("series"),
  genre: text("genre"),
  category: text("category"),                  // painting, sculpture, photography, etc.
});

export const insertArtworkSchema = createInsertSchema(artworks).omit({ id: true });
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
  contactId: integer("contact_id"),
  artworkId: integer("artwork_id"),
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

export const insertDealSchema = createInsertSchema(deals).omit({ id: true });
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
  contactId: integer("contact_id"),
  dealId: integer("deal_id"),
  date: text("date").notNull(),
  contactName: text("contact_name"),
});

export const insertActivitySchema = createInsertSchema(activities).omit({ id: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

// Follow-ups (Phase 4)
export const followups = pgTable("followups", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id"),
  contactId: integer("contact_id"),
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
