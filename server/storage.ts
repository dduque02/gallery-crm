import { eq, desc, ilike, or, sql, count, sum, and, ne, inArray, asc } from "drizzle-orm";
import { db } from "./db";
import {
  contacts, artworks, deals, exhibitions, activities, artistSettings, followups, invoices, messages,
} from "@shared/schema";
import type {
  Contact, InsertContact,
  Artwork, InsertArtwork,
  Deal, InsertDeal,
  Exhibition, InsertExhibition,
  Activity, InsertActivity,
  ArtistSettings, InsertArtistSettings,
  Followup, InsertFollowup,
  Invoice, InsertInvoice,
  Message, InsertMessage,
} from "@shared/schema";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IStorage {
  // Contacts
  getContacts(opts?: { page?: number; pageSize?: number; search?: string; type?: string }): Promise<PaginatedResult<Contact>>;
  getContact(id: number): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<boolean>;

  // Artworks
  getArtworks(opts?: { page?: number; pageSize?: number; search?: string; status?: string; category?: string; location?: string; sort?: string }): Promise<PaginatedResult<Artwork>>;
  getArtwork(id: number): Promise<Artwork | undefined>;
  createArtwork(artwork: InsertArtwork): Promise<Artwork>;
  updateArtwork(id: number, artwork: Partial<InsertArtwork>): Promise<Artwork | undefined>;
  deleteArtwork(id: number): Promise<boolean>;
  getArtworkLocations(): Promise<string[]>;

  // Deals
  getDeals(): Promise<Deal[]>;
  getDeal(id: number): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: number, deal: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: number): Promise<boolean>;

  // Exhibitions
  getExhibitions(): Promise<Exhibition[]>;
  getExhibition(id: number): Promise<Exhibition | undefined>;
  createExhibition(exhibition: InsertExhibition): Promise<Exhibition>;
  updateExhibition(id: number, exhibition: Partial<InsertExhibition>): Promise<Exhibition | undefined>;
  deleteExhibition(id: number): Promise<boolean>;

  // Deals by contact
  getDealsByContactId(contactId: number): Promise<Deal[]>;

  // Activities
  getActivities(): Promise<Activity[]>;
  getActivitiesByDealId(dealId: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // Artists (aggregated)
  getArtists(search?: string, category?: string, group?: string): Promise<{ artistName: string; count: number; imageUrl: string | null; group: string }[]>;

  // Artist Settings
  setArtistGroup(artistName: string, group: string): Promise<ArtistSettings>;

  // Followups
  getFollowups(): Promise<Followup[]>;
  getFollowupsByDealId(dealId: number): Promise<Followup[]>;
  getFollowup(id: number): Promise<Followup | undefined>;
  createFollowup(followup: InsertFollowup): Promise<Followup>;
  updateFollowup(id: number, followup: Partial<InsertFollowup>): Promise<Followup | undefined>;
  deleteFollowup(id: number): Promise<boolean>;

  // Invoices
  getInvoices(opts?: { contactId?: number; dateFrom?: string; dateTo?: string }): Promise<Invoice[]>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  createInvoice(data: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: number): Promise<boolean>;
  generateInvoiceNumber(): Promise<string>;

  // Sales history (reads from invoices)
  getSalesHistory(opts?: { dateFrom?: string; dateTo?: string; contactId?: number; advisorName?: string; search?: string }): Promise<Invoice[]>;
  getSalesStats(): Promise<Record<string, any>>;

  // LTV recalc
  recalcContactLTV(contactId: number): Promise<void>;

  // Messages
  getMessages(opts?: { channel?: string; status?: string; contactId?: number }): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(data: InsertMessage): Promise<Message>;
  updateMessage(id: number, data: Partial<InsertMessage>): Promise<Message | undefined>;
  findContactByEmailOrPhone(email?: string, phone?: string): Promise<Contact | undefined>;

  // Stats (computed via SQL)
  getStats(): Promise<Record<string, any>>;
}

export class DatabaseStorage implements IStorage {
  // Contacts — paginated + searchable
  async getContacts(opts?: { page?: number; pageSize?: number; search?: string; type?: string }): Promise<PaginatedResult<Contact>> {
    const page = opts?.page || 1;
    const pageSize = opts?.pageSize || 50;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (opts?.search) {
      const term = `%${opts.search}%`;
      conditions.push(or(ilike(contacts.name, term), ilike(contacts.email, term)));
    }
    if (opts?.type && opts.type !== "all") {
      conditions.push(eq(contacts.type, opts.type));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ total }]] = await Promise.all([
      db.select().from(contacts).where(where).orderBy(contacts.name).limit(pageSize).offset(offset),
      db.select({ total: count() }).from(contacts).where(where),
    ]);

    return { data, total, page, pageSize };
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }
  async createContact(data: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(data).returning();
    return contact;
  }
  async updateContact(id: number, data: Partial<InsertContact>): Promise<Contact | undefined> {
    const [contact] = await db.update(contacts).set(data).where(eq(contacts.id, id)).returning();
    return contact;
  }
  async deleteContact(id: number): Promise<boolean> {
    const result = await db.delete(contacts).where(eq(contacts.id, id)).returning();
    return result.length > 0;
  }

  // Artworks — paginated + searchable + filterable
  async getArtworks(opts?: { page?: number; pageSize?: number; search?: string; status?: string; category?: string; location?: string; sort?: string }): Promise<PaginatedResult<Artwork>> {
    const page = opts?.page || 1;
    const pageSize = opts?.pageSize || 50;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (opts?.search) {
      const term = `%${opts.search}%`;
      conditions.push(or(
        ilike(artworks.title, term),
        ilike(artworks.artistName, term),
        ilike(artworks.stockNumber, term),
      ));
    }
    if (opts?.status && opts.status !== "all") {
      const statuses = opts.status.split(",").filter(Boolean);
      if (statuses.length === 1) {
        conditions.push(eq(artworks.status, statuses[0]));
      } else if (statuses.length > 1) {
        conditions.push(inArray(artworks.status, statuses));
      }
    }
    if (opts?.category && opts.category !== "all") {
      const categories = opts.category.split(",").filter(Boolean);
      if (categories.length === 1) {
        conditions.push(eq(artworks.category, categories[0]));
      } else if (categories.length > 1) {
        conditions.push(inArray(artworks.category, categories));
      }
    }
    if (opts?.location && opts.location !== "all") {
      const locations = opts.location.split(",").filter(Boolean);
      if (locations.length === 1) {
        conditions.push(eq(artworks.location, locations[0]));
      } else if (locations.length > 1) {
        conditions.push(inArray(artworks.location, locations));
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    let orderBy;
    switch (opts?.sort) {
      case "price": orderBy = desc(artworks.retailPrice); break;
      case "recent": orderBy = desc(artworks.id); break;
      case "stock_number": orderBy = desc(artworks.stockNumber); break;
      case "year": orderBy = desc(artworks.year); break;
      default: orderBy = artworks.artistName;
    }

    const [data, [{ total }]] = await Promise.all([
      db.select().from(artworks).where(where).orderBy(orderBy).limit(pageSize).offset(offset),
      db.select({ total: count() }).from(artworks).where(where),
    ]);

    return { data, total, page, pageSize };
  }

  async getArtwork(id: number): Promise<Artwork | undefined> {
    const [artwork] = await db.select().from(artworks).where(eq(artworks.id, id));
    return artwork;
  }
  async createArtwork(data: InsertArtwork): Promise<Artwork> {
    const [artwork] = await db.insert(artworks).values(data).returning();
    return artwork;
  }
  async updateArtwork(id: number, data: Partial<InsertArtwork>): Promise<Artwork | undefined> {
    const [artwork] = await db.update(artworks).set(data).where(eq(artworks.id, id)).returning();
    return artwork;
  }
  async deleteArtwork(id: number): Promise<boolean> {
    const result = await db.delete(artworks).where(eq(artworks.id, id)).returning();
    return result.length > 0;
  }

  // Deals — small table, no pagination needed
  async getDeals(): Promise<Deal[]> {
    return db.select().from(deals);
  }
  async getDealsByContactId(contactId: number): Promise<Deal[]> {
    return db.select().from(deals).where(eq(deals.contactId, contactId));
  }
  async getDeal(id: number): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal;
  }
  async createDeal(data: InsertDeal): Promise<Deal> {
    const [deal] = await db.insert(deals).values(data).returning();
    return deal;
  }
  async updateDeal(id: number, data: Partial<InsertDeal>): Promise<Deal | undefined> {
    const [deal] = await db.update(deals).set(data).where(eq(deals.id, id)).returning();
    return deal;
  }
  async deleteDeal(id: number): Promise<boolean> {
    const result = await db.delete(deals).where(eq(deals.id, id)).returning();
    return result.length > 0;
  }

  // Exhibitions — small table
  async getExhibitions(): Promise<Exhibition[]> {
    return db.select().from(exhibitions);
  }
  async getExhibition(id: number): Promise<Exhibition | undefined> {
    const [exhibition] = await db.select().from(exhibitions).where(eq(exhibitions.id, id));
    return exhibition;
  }
  async createExhibition(data: InsertExhibition): Promise<Exhibition> {
    const [exhibition] = await db.insert(exhibitions).values(data).returning();
    return exhibition;
  }
  async updateExhibition(id: number, data: Partial<InsertExhibition>): Promise<Exhibition | undefined> {
    const [exhibition] = await db.update(exhibitions).set(data).where(eq(exhibitions.id, id)).returning();
    return exhibition;
  }
  async deleteExhibition(id: number): Promise<boolean> {
    const result = await db.delete(exhibitions).where(eq(exhibitions.id, id)).returning();
    return result.length > 0;
  }

  // Activities
  async getActivities(): Promise<Activity[]> {
    return db.select().from(activities).orderBy(desc(activities.date)).limit(50);
  }
  async getActivitiesByDealId(dealId: number): Promise<Activity[]> {
    return db.select().from(activities).where(eq(activities.dealId, dealId)).orderBy(desc(activities.date));
  }
  async createActivity(data: InsertActivity): Promise<Activity> {
    const [activity] = await db.insert(activities).values(data).returning();
    return activity;
  }

  // Artwork locations — unique non-null locations
  async getArtworkLocations(): Promise<string[]> {
    const rows = await db.execute(sql`
      SELECT DISTINCT location FROM artworks
      WHERE location IS NOT NULL AND location != ''
      ORDER BY location
    `);
    return rows.rows.map((r: any) => r.location as string);
  }

  // Artists — grouped by name with count and most recent image
  async getArtists(search?: string, category?: string, group?: string): Promise<{ artistName: string; count: number; imageUrl: string | null; group: string }[]> {
    const searchCondition = search ? sql`AND a1.artist_name ILIKE ${'%' + search + '%'}` : sql``;
    let categoryFilter = sql``;
    if (category && category !== "all") {
      const categories = category.split(",").filter(Boolean);
      if (categories.length === 1) {
        categoryFilter = sql`AND a1.category = ${categories[0]}`;
      } else if (categories.length > 1) {
        categoryFilter = sql`AND a1.category IN (${sql.join(categories.map(c => sql`${c}`), sql`, `)})`;
      }
    }
    // Filter by group: "active" (default) excludes for_review, "for_review" shows only those, "all" shows everything
    let groupFilter = sql``;
    if (group === "for_review") {
      groupFilter = sql`AND EXISTS (SELECT 1 FROM artist_settings s WHERE s.artist_name = a1.artist_name AND s.group = 'for_review')`;
    } else if (!group || group === "active") {
      groupFilter = sql`AND NOT EXISTS (SELECT 1 FROM artist_settings s WHERE s.artist_name = a1.artist_name AND s.group = 'for_review')`;
    }
    // group === "all" → no filter

    const rows = await db.execute(sql`
      SELECT
        a1.artist_name AS "artistName",
        COUNT(*)::int AS "count",
        (SELECT a2.image_url FROM artworks a2 WHERE a2.artist_name = a1.artist_name AND a2.image_url IS NOT NULL ORDER BY a2.id DESC LIMIT 1) AS "imageUrl",
        COALESCE((SELECT s.group FROM artist_settings s WHERE s.artist_name = a1.artist_name), 'active') AS "group"
      FROM artworks a1
      WHERE 1=1 ${searchCondition} ${categoryFilter} ${groupFilter}
      GROUP BY a1.artist_name
      ORDER BY a1.artist_name
    `);
    return rows.rows as { artistName: string; count: number; imageUrl: string | null; group: string }[];
  }

  // Artist Settings — set group (upsert)
  async setArtistGroup(artistName: string, group: string): Promise<ArtistSettings> {
    const [result] = await db
      .insert(artistSettings)
      .values({ artistName, group })
      .onConflictDoUpdate({ target: artistSettings.artistName, set: { group } })
      .returning();
    return result;
  }

  // Followups
  async getFollowups(): Promise<Followup[]> {
    return db.select().from(followups).orderBy(asc(followups.dueDate));
  }
  async getFollowupsByDealId(dealId: number): Promise<Followup[]> {
    return db.select().from(followups).where(eq(followups.dealId, dealId)).orderBy(asc(followups.dueDate));
  }
  async getFollowup(id: number): Promise<Followup | undefined> {
    const [f] = await db.select().from(followups).where(eq(followups.id, id));
    return f;
  }
  async createFollowup(data: InsertFollowup): Promise<Followup> {
    const [f] = await db.insert(followups).values(data).returning();
    return f;
  }
  async updateFollowup(id: number, data: Partial<InsertFollowup>): Promise<Followup | undefined> {
    const [f] = await db.update(followups).set(data).where(eq(followups.id, id)).returning();
    return f;
  }
  async deleteFollowup(id: number): Promise<boolean> {
    const result = await db.delete(followups).where(eq(followups.id, id)).returning();
    return result.length > 0;
  }

  // Invoices
  async getInvoices(opts?: { contactId?: number; dateFrom?: string; dateTo?: string }): Promise<Invoice[]> {
    const conditions = [];
    if (opts?.contactId) conditions.push(eq(invoices.contactId, opts.contactId));
    if (opts?.dateFrom) conditions.push(sql`${invoices.issueDate} >= ${opts.dateFrom}`);
    if (opts?.dateTo) conditions.push(sql`${invoices.issueDate} <= ${opts.dateTo}`);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db.select().from(invoices).where(where).orderBy(desc(invoices.issueDate));
  }
  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id));
    return inv;
  }
  async createInvoice(data: InsertInvoice): Promise<Invoice> {
    const [inv] = await db.insert(invoices).values(data).returning();
    return inv;
  }
  async updateInvoice(id: number, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [inv] = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return inv;
  }
  async deleteInvoice(id: number): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id)).returning();
    return result.length > 0;
  }
  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const result = await db.execute(sql`
      SELECT invoice_number FROM invoices
      WHERE invoice_number LIKE ${prefix + '%'}
      ORDER BY invoice_number DESC LIMIT 1
    `);
    let next = 1;
    if (result.rows.length > 0) {
      const last = (result.rows[0] as any).invoice_number as string;
      const num = parseInt(last.split("-").pop() || "0", 10);
      next = num + 1;
    }
    return `${prefix}${String(next).padStart(4, "0")}`;
  }

  // Sales history — reads from invoices (the source of truth for completed sales)
  async getSalesHistory(opts?: { dateFrom?: string; dateTo?: string; contactId?: number; advisorName?: string; search?: string }): Promise<Invoice[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (opts?.dateFrom) conditions.push(sql`${invoices.issueDate} >= ${opts.dateFrom}`);
    if (opts?.dateTo) conditions.push(sql`${invoices.issueDate} <= ${opts.dateTo}`);
    if (opts?.contactId) conditions.push(eq(invoices.contactId, opts.contactId));
    if (opts?.advisorName) conditions.push(eq(invoices.advisorName, opts.advisorName));
    if (opts?.search) {
      const term = `%${opts.search}%`;
      conditions.push(or(
        ilike(invoices.invoiceNumber, term),
        ilike(invoices.contactName, term),
        ilike(invoices.artworkTitle, term),
        ilike(invoices.artistName, term),
      )!);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db.select().from(invoices).where(where).orderBy(desc(invoices.issueDate));
  }

  async getSalesStats(): Promise<Record<string, any>> {
    const [totalResult, countResult, topBuyerResult, byMonthResult] = await Promise.all([
      db.execute(sql`
        SELECT COALESCE(currency, 'USD') AS currency, COALESCE(SUM(total_amount::bigint), 0) AS total, COUNT(*)::int AS count
        FROM invoices GROUP BY COALESCE(currency, 'USD')
      `),
      db.execute(sql`SELECT COUNT(*)::int AS count FROM invoices`),
      db.execute(sql`
        SELECT contact_name AS "contactName", SUM(total_amount::bigint) AS total, COUNT(*)::int AS deals
        FROM invoices WHERE contact_name IS NOT NULL
        GROUP BY contact_name ORDER BY total DESC NULLS LAST LIMIT 1
      `),
      db.execute(sql`
        SELECT to_char(issue_date::date, 'YYYY-MM') AS month, COALESCE(SUM(total_amount::bigint), 0) AS total, COUNT(*)::int AS count
        FROM invoices WHERE issue_date IS NOT NULL
        GROUP BY to_char(issue_date::date, 'YYYY-MM')
        ORDER BY month DESC LIMIT 12
      `),
    ]);

    const totalByCurrency = (totalResult.rows as any[]).map(r => ({ currency: r.currency, total: Number(r.total), count: r.count }));
    const totalCount = (countResult.rows[0] as any)?.count || 0;
    const allTotals = totalByCurrency.reduce((s, r) => s + r.total, 0);

    return {
      totalRevenueByCurrency: totalByCurrency,
      totalSales: totalCount,
      avgDealSize: totalCount > 0 ? Math.round(allTotals / totalCount) : 0,
      topBuyer: topBuyerResult.rows[0] ? { ...(topBuyerResult.rows[0] as any), total: Number((topBuyerResult.rows[0] as any).total) } : null,
      revenueByMonth: (byMonthResult.rows as any[]).map(r => ({ ...r, total: Number(r.total) })),
    };
  }

  // Recalc contact LTV from invoices (source of truth for completed sales)
  async recalcContactLTV(contactId: number): Promise<void> {
    await db.execute(sql`
      UPDATE contacts SET
        total_purchases = (SELECT COUNT(*)::int FROM invoices WHERE contact_id = ${contactId}),
        total_spent = (SELECT COALESCE(SUM(total_amount), 0)::int FROM invoices WHERE contact_id = ${contactId}),
        lifetime_value = (SELECT COALESCE(SUM(total_amount), 0)::int FROM invoices WHERE contact_id = ${contactId})
      WHERE id = ${contactId}
    `);
  }

  // Stats — all computed via SQL, no data transfer
  async getStats(): Promise<Record<string, any>> {
    const [
      [{ totalContacts }],
      [{ totalArtworks }],
      [{ totalDeals }],
      activeExhibitionsResult,
      inventoryValueResult,
      statusCountsResult,
      typeCountsResult,
      stageCountsResult,
      activeDealsResult,
      closedWonResult,
      pipelineByCurrencyResult,
      newLeadsResult,
      avgResponseResult,
      repliedUnder1hResult,
      revenueThisMonthResult,
      overdueFollowupsResult,
      leadsBySourceResult,
      pipelineByStageResult,
      dealsAtRiskResult,
    ] = await Promise.all([
      db.select({ totalContacts: count() }).from(contacts),
      db.select({ totalArtworks: count() }).from(artworks),
      db.select({ totalDeals: count() }).from(deals),
      db.select({ count: count() }).from(exhibitions).where(eq(exhibitions.status, "active")),
      db.select({ total: sum(artworks.retailPrice) }).from(artworks).where(ne(artworks.status, "sold")),
      db.select({ status: artworks.status, count: count() }).from(artworks).groupBy(artworks.status),
      db.select({ type: contacts.type, count: count() }).from(contacts).groupBy(contacts.type),
      db.select({ stage: deals.stage, count: count() }).from(deals).groupBy(deals.stage),
      // Fix: real activeDealsValue
      db.select({ total: sum(deals.value) }).from(deals).where(
        and(ne(deals.stage, "closed_won"), ne(deals.stage, "closed_lost"))
      ),
      // Total revenue from invoices (source of truth)
      db.execute(sql`SELECT COALESCE(SUM(total_amount::bigint), 0) AS total FROM invoices`),
      // Pipeline value by currency
      db.execute(sql`
        SELECT COALESCE(currency, 'USD') AS currency, COALESCE(SUM(value::bigint), 0) AS total, COUNT(*)::int AS count
        FROM deals WHERE stage NOT IN ('closed_won', 'closed_lost')
        GROUP BY COALESCE(currency, 'USD')
      `),
      // Phase 3: new leads this week
      db.execute(sql`SELECT COUNT(*)::int AS count FROM deals WHERE created_date >= (CURRENT_DATE - INTERVAL '7 days')::text`),
      // Phase 3: avg response time
      db.execute(sql`SELECT COALESCE(AVG(first_response_time), 0)::int AS avg FROM deals WHERE first_response_time IS NOT NULL`),
      // Phase 3: % replied under 1h
      db.execute(sql`
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE first_response_time <= 60) / COUNT(*))::int END AS pct
        FROM deals WHERE first_response_time IS NOT NULL
      `),
      // Phase 3: revenue closed this month (from invoices)
      db.execute(sql`SELECT COALESCE(SUM(total_amount::bigint), 0) AS total FROM invoices WHERE issue_date >= to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM-DD')`),
      // Phase 3/4: overdue followups
      db.execute(sql`SELECT COUNT(*)::int AS count FROM followups WHERE status = 'pending' AND due_date < CURRENT_DATE::text`),
      // Phase 3: leads by source
      db.execute(sql`SELECT source_channel AS source, COUNT(*)::int AS count FROM deals WHERE source_channel IS NOT NULL GROUP BY source_channel`),
      // Phase 3: pipeline by stage with value
      db.execute(sql`SELECT stage, COUNT(*)::int AS count, COALESCE(SUM(value::bigint), 0) AS value FROM deals GROUP BY stage`),
      // Phase 3: deals at risk (active, >5 days without activity)
      db.execute(sql`
        SELECT id, title, contact_name AS "contactName", value, stage, last_activity_at AS "lastActivityAt"
        FROM deals
        WHERE stage NOT IN ('closed_won', 'closed_lost')
          AND (last_activity_at IS NULL OR last_activity_at::timestamp < NOW() - INTERVAL '5 days')
        ORDER BY value DESC NULLS LAST
        LIMIT 5
      `),
    ]);

    const statusCounts: Record<string, number> = {};
    statusCountsResult.forEach(r => { statusCounts[r.status] = r.count; });

    const typeCounts: Record<string, number> = {};
    typeCountsResult.forEach(r => { typeCounts[r.type] = r.count; });

    const stageCounts: Record<string, number> = {};
    stageCountsResult.forEach(r => { stageCounts[r.stage] = r.count; });

    const leadsBySource: Record<string, number> = {};
    (leadsBySourceResult.rows as any[]).forEach(r => { leadsBySource[r.source] = r.count; });

    const pipelineByStage: { stage: string; count: number; value: number }[] =
      (pipelineByStageResult.rows as any[]).map(r => ({ stage: r.stage, count: r.count, value: Number(r.value) }));

    return {
      totalContacts,
      totalArtworks,
      totalDeals,
      activeExhibitions: activeExhibitionsResult[0]?.count || 0,
      totalInventoryValue: Number(inventoryValueResult[0]?.total || 0),
      activeDealsValue: Number(activeDealsResult[0]?.total || 0),
      closedWonValue: Number((closedWonResult.rows[0] as any)?.total || 0),
      statusCounts,
      stageCounts,
      typeCounts,
      // Phase 3 stats
      newLeadsThisWeek: (newLeadsResult.rows[0] as any)?.count || 0,
      avgResponseTime: (avgResponseResult.rows[0] as any)?.avg || 0,
      repliedUnder1h: (repliedUnder1hResult.rows[0] as any)?.pct || 0,
      revenueClosedThisMonth: Number((revenueThisMonthResult.rows[0] as any)?.total || 0),
      overdueFollowups: (overdueFollowupsResult.rows[0] as any)?.count || 0,
      leadsBySource,
      pipelineByStage,
      pipelineByCurrency: (pipelineByCurrencyResult.rows as any[]).map(r => ({ currency: r.currency, total: Number(r.total), count: r.count })),
      dealsAtRisk: dealsAtRiskResult.rows as any[],
    };
  }

  // Messages
  async getMessages(opts?: { channel?: string; status?: string; contactId?: number }): Promise<Message[]> {
    const conditions = [];
    if (opts?.channel && opts.channel !== "all") conditions.push(eq(messages.channel, opts.channel));
    if (opts?.status && opts.status !== "all") conditions.push(eq(messages.status, opts.status));
    if (opts?.contactId) conditions.push(eq(messages.contactId, opts.contactId));

    const rows = await db
      .select()
      .from(messages)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(messages.createdAt))
      .limit(200);
    return rows;
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [row] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return row;
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [row] = await db.insert(messages).values(data).returning();
    return row;
  }

  async updateMessage(id: number, data: Partial<InsertMessage>): Promise<Message | undefined> {
    const [row] = await db.update(messages).set(data).where(eq(messages.id, id)).returning();
    return row;
  }

  async findContactByEmailOrPhone(email?: string, phone?: string): Promise<Contact | undefined> {
    if (email) {
      const [row] = await db.select().from(contacts).where(eq(contacts.email, email)).limit(1);
      if (row) return row;
    }
    if (phone) {
      const [row] = await db.select().from(contacts).where(eq(contacts.phone, phone)).limit(1);
      if (row) return row;
    }
    return undefined;
  }
}

export const storage = new DatabaseStorage();
