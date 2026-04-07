/**
 * Cleanup historical deals imported from Artlogic.
 *
 * These deals were created by import-invoices.ts alongside their invoices.
 * Now that Sales History reads from invoices directly, these deals are
 * redundant and pollute the pipeline.
 *
 * This script:
 * 1. Finds all invoices with invoiceNumber starting with "AL-" (Artlogic imports)
 * 2. Sets dealId to NULL on those invoices (breaks the FK before deleting)
 * 3. Deletes the corresponding deals
 *
 * Usage: npx tsx script/cleanup-historical-deals.ts
 */

import "dotenv/config";
import { db } from "../server/db";
import { deals, invoices } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log("Finding Artlogic-imported invoices (AL-*)...");

  // Find all invoices from Artlogic import that have a dealId
  const artlogicInvoices = await db.execute(sql`
    SELECT id, invoice_number, deal_id
    FROM invoices
    WHERE invoice_number LIKE 'AL-%' AND deal_id IS NOT NULL
  `);

  const rows = artlogicInvoices.rows as { id: number; invoice_number: string; deal_id: number }[];
  console.log(`Found ${rows.length} Artlogic invoices linked to deals.`);

  if (rows.length === 0) {
    console.log("Nothing to clean up.");
    process.exit(0);
  }

  const dealIds = [...new Set(rows.map(r => r.deal_id))];
  console.log(`Will remove ${dealIds.length} historical deals from the deals table.`);

  // Step 1: Unlink invoices from deals (set dealId = NULL)
  console.log("Unlinking invoices from deals...");
  await db.execute(sql`
    UPDATE invoices SET deal_id = NULL
    WHERE invoice_number LIKE 'AL-%' AND deal_id IS NOT NULL
  `);

  // Step 2: Delete the historical deals
  console.log("Deleting historical deals...");
  let deleted = 0;
  for (const dealId of dealIds) {
    try {
      await db.delete(deals).where(eq(deals.id, dealId));
      deleted++;
    } catch (err) {
      console.error(`Error deleting deal ${dealId}:`, err);
    }
  }

  console.log(`\nDone!`);
  console.log(`Invoices unlinked: ${rows.length}`);
  console.log(`Deals deleted: ${deleted}`);

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
