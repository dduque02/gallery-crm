CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"contact_id" integer,
	"deal_id" integer,
	"date" text NOT NULL,
	"contact_name" text
);
--> statement-breakpoint
CREATE TABLE "artist_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_name" text NOT NULL,
	"group" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "artist_settings_artist_name_unique" UNIQUE("artist_name")
);
--> statement-breakpoint
CREATE TABLE "artworks" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_number" text,
	"title" text NOT NULL,
	"artist_name" text NOT NULL,
	"medium" text,
	"dimensions" text,
	"year" text,
	"inscription" text,
	"description" text,
	"retail_price" integer,
	"retail_currency" text DEFAULT 'USD',
	"cost_price" integer,
	"status" text NOT NULL,
	"availability" text DEFAULT 'in_stock',
	"location" text,
	"location_detail" text,
	"is_edition" boolean DEFAULT false,
	"edition_info" text,
	"provenance" text,
	"exhibition_history" text,
	"literature" text,
	"condition" text,
	"condition_notes" text,
	"image_url" text,
	"thumb_url" text,
	"medium_url" text,
	"secondary_images" text[],
	"importance" integer DEFAULT 0,
	"internal_notes" text,
	"tags" text[],
	"contact_id" integer,
	"consignor_id" integer,
	"series" text,
	"genre" text,
	"category" text,
	"is_equipment" boolean DEFAULT false,
	"market" text,
	"associated_costs" integer,
	"consignor_is_artist" boolean DEFAULT false,
	"consignment_from_date" text,
	"consignment_return_due" text,
	"consignment_returned" boolean DEFAULT false,
	"consignment_reminder_date" text,
	"consignment_terms" text,
	"consignment_percentage" integer,
	"consignment_net_value" integer,
	"consignment_notes" text,
	"consignment_history" text,
	"contract_signed" boolean DEFAULT false,
	"non_standard_contract" boolean DEFAULT false,
	"consignment_invoice_status" text,
	"additional_certificates" text,
	"additional_documents" text
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"type" text NOT NULL,
	"company" text,
	"notes" text,
	"tags" text[],
	"city" text,
	"country" text,
	"last_contact_date" text,
	"total_purchases" integer DEFAULT 0,
	"total_spent" integer DEFAULT 0,
	"preferred_channel" text,
	"budget_low" integer,
	"budget_high" integer,
	"preferred_medium" text,
	"preferred_scale" text,
	"artists_of_interest" text[],
	"relationship_level" text DEFAULT 'new',
	"lead_source" text,
	"first_contact_date" text,
	"lifetime_value" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"contact_id" integer,
	"artwork_id" integer,
	"value" integer,
	"stage" text NOT NULL,
	"priority" text DEFAULT 'medium',
	"notes" text,
	"expected_close_date" text,
	"created_date" text,
	"contact_name" text,
	"artwork_title" text,
	"currency" text DEFAULT 'USD',
	"source_channel" text,
	"lost_reason" text,
	"last_activity_at" text,
	"close_date" text,
	"first_response_time" integer,
	"intent_score" integer DEFAULT 0,
	"advisor_name" text
);
--> statement-breakpoint
CREATE TABLE "exhibitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" text,
	"end_date" text,
	"location" text,
	"description" text,
	"status" text NOT NULL,
	"budget" integer,
	"artwork_ids" integer[]
);
--> statement-breakpoint
CREATE TABLE "followups" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer,
	"contact_id" integer,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"due_date" text NOT NULL,
	"due_time" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" text,
	"created_at" text NOT NULL,
	"contact_name" text,
	"deal_title" text,
	"notes" text,
	"advisor_name" text
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"deal_id" integer,
	"contact_id" integer,
	"contact_name" text,
	"contact_email" text,
	"artwork_title" text,
	"artwork_details" text,
	"artist_name" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'USD',
	"tax" integer DEFAULT 0,
	"total_amount" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"issue_date" text NOT NULL,
	"due_date" text,
	"paid_date" text,
	"notes" text,
	"advisor_name" text,
	"created_at" text NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'advisor' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_consignor_id_contacts_id_fk" FOREIGN KEY ("consignor_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followups" ADD CONSTRAINT "followups_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followups" ADD CONSTRAINT "followups_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;