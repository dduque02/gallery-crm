-- Performance indexes for Gallery CRM
-- All queries currently do full table scans; these indexes cover WHERE, ORDER BY, and JOIN columns

CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts (name);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts (type);

CREATE INDEX IF NOT EXISTS idx_artworks_artist_name ON artworks (artist_name);
CREATE INDEX IF NOT EXISTS idx_artworks_status ON artworks (status);
CREATE INDEX IF NOT EXISTS idx_artworks_category ON artworks (category);
CREATE INDEX IF NOT EXISTS idx_artworks_location ON artworks (location);

CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON deals (contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals (stage);

CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities (deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities (date DESC);

CREATE INDEX IF NOT EXISTS idx_followups_deal_id ON followups (deal_id);
CREATE INDEX IF NOT EXISTS idx_followups_status_due ON followups (status, due_date);

CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON invoices (contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices (issue_date);

CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages (contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);
