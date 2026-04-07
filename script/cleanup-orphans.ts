import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function cleanupOrphans() {
  console.log("Cleaning up orphan records before adding foreign key constraints...\n");

  // SET NULL: artworks with non-existent contactId or consignorId
  const artworksContact = await db.execute(sql`
    UPDATE artworks SET contact_id = NULL
    WHERE contact_id IS NOT NULL AND contact_id NOT IN (SELECT id FROM contacts)
  `);
  console.log(`artworks.contact_id nulled: ${artworksContact.rowCount} rows`);

  const artworksConsignor = await db.execute(sql`
    UPDATE artworks SET consignor_id = NULL
    WHERE consignor_id IS NOT NULL AND consignor_id NOT IN (SELECT id FROM contacts)
  `);
  console.log(`artworks.consignor_id nulled: ${artworksConsignor.rowCount} rows`);

  // SET NULL: deals with non-existent artworkId
  const dealsArtwork = await db.execute(sql`
    UPDATE deals SET artwork_id = NULL
    WHERE artwork_id IS NOT NULL AND artwork_id NOT IN (SELECT id FROM artworks)
  `);
  console.log(`deals.artwork_id nulled: ${dealsArtwork.rowCount} rows`);

  // CASCADE targets: delete rows with non-existent foreign keys

  // Activities with orphan dealId (delete before deals cleanup)
  const activitiesDeal = await db.execute(sql`
    DELETE FROM activities
    WHERE deal_id IS NOT NULL AND deal_id NOT IN (SELECT id FROM deals)
  `);
  console.log(`activities with orphan deal_id deleted: ${activitiesDeal.rowCount} rows`);

  // Activities with orphan contactId
  const activitiesContact = await db.execute(sql`
    DELETE FROM activities
    WHERE contact_id IS NOT NULL AND contact_id NOT IN (SELECT id FROM contacts)
  `);
  console.log(`activities with orphan contact_id deleted: ${activitiesContact.rowCount} rows`);

  // Followups with orphan dealId
  const followupsDeal = await db.execute(sql`
    DELETE FROM followups
    WHERE deal_id IS NOT NULL AND deal_id NOT IN (SELECT id FROM contacts)
  `);
  console.log(`followups with orphan deal_id deleted: ${followupsDeal.rowCount} rows`);

  // Followups with orphan contactId
  const followupsContact = await db.execute(sql`
    DELETE FROM followups
    WHERE contact_id IS NOT NULL AND contact_id NOT IN (SELECT id FROM contacts)
  `);
  console.log(`followups with orphan contact_id deleted: ${followupsContact.rowCount} rows`);

  // Deals with orphan contactId
  const dealsContact = await db.execute(sql`
    DELETE FROM deals
    WHERE contact_id IS NOT NULL AND contact_id NOT IN (SELECT id FROM contacts)
  `);
  console.log(`deals with orphan contact_id deleted: ${dealsContact.rowCount} rows`);

  console.log("\nDone! You can now run: npm run db:push");
  process.exit(0);
}

cleanupOrphans().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
