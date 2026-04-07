/**
 * Import Artlogic invoice history from accounts_fields.xls
 *
 * Usage: npx tsx server/import-invoices.ts
 *
 * Groups rows by invoice number, creates one deal + one invoice per group.
 * Skips invoices that already exist in the DB (by invoiceNumber).
 */

import "dotenv/config";
import XLSX from "xlsx";
import { db } from "./db";
import { invoices } from "@shared/schema";

const XLS_PATH = "/Users/duque_02/Downloads/accounts_fields.xls";

// Advisor name normalization map
const advisorMap: Record<string, string> = {
  "miguel duque": "Miguel Duque",
  "miguel a duque": "Miguel Duque",
  "miguel angel duque": "Miguel Duque",
  "sebastian duque": "Sebastián Duque",
  "german duque": "Germán Duque",
  "santiago  duque": "Santiago Duque",
  "santiago duque": "Santiago Duque",
  "david duque ": "David Duque",
  "david duque": "David Duque",
  "federico duque": "Federico Duque",
  "sergio arango": "Sergio Arango",
  "nora acosta": "Nora Acosta",
};

function normalizeAdvisor(name: string | undefined | null): string | null {
  if (!name || !name.trim()) return null;
  const key = name.trim().toLowerCase();
  return advisorMap[key] || name.trim();
}

function normalizeCurrency(cur: string | undefined | null): string {
  if (!cur) return "USD";
  if (cur === "$") return "USD";
  if (cur === "COP") return "COP";
  return "USD";
}

function toInt(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = parseFloat(String(val));
  return isNaN(n) ? 0 : Math.round(n);
}

function formatDate(val: any): string | null {
  if (!val) return null;
  const s = String(val).trim();
  if (!s) return null;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  // Try parsing
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

interface XlsRow {
  "Inv. #": number | string;
  Date: string;
  Type: string;
  Artist: string;
  Description: string;
  "Sold to": string;
  "Email address": string;
  Currency: string;
  "Sale $": number;
  "Sale COP": number;
  Market: string;
  Consignor: string;
  "Gallery\n%": number;
  "Consignor\n%": number;
  "Date\ninvoice\nfully\npaid": string;
  "Unpaid amount": number;
  "Sold by": string;
  "Total invoice value": number;
}

async function main() {
  console.log("Reading XLS...");
  const workbook = XLSX.readFile(XLS_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: XlsRow[] = XLSX.utils.sheet_to_json(sheet);
  console.log(`Total rows: ${rows.length}`);

  // Group by invoice number
  const groups = new Map<string, XlsRow[]>();
  for (const row of rows) {
    const invNum = row["Inv. #"];
    if (!invNum) continue;
    const key = String(Math.round(Number(invNum)));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  console.log(`Unique invoices: ${groups.size}`);

  // Check existing invoices to avoid duplicates
  const existingInvoices = await db.select({ invoiceNumber: invoices.invoiceNumber }).from(invoices);
  const existingSet = new Set(existingInvoices.map(i => i.invoiceNumber));
  console.log(`Existing invoices in DB: ${existingSet.size}`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const [invNumRaw, groupRows] of groups) {
    const paddedNum = invNumRaw.padStart(5, "0");
    const invoiceNumber = `AL-${paddedNum}`;

    if (existingSet.has(invoiceNumber)) {
      skipped++;
      continue;
    }

    try {
      const first = groupRows[0];
      const date = formatDate(first.Date);
      const currency = normalizeCurrency(first.Currency);
      const advisor = normalizeAdvisor(first["Sold by"]);
      const contactName = first["Sold to"]?.trim() || null;
      const contactEmail = first["Email address"]?.trim() || null;
      const totalValue = toInt(first["Total invoice value"]);
      const unpaid = toInt(first["Unpaid amount"]);
      const paidDateRaw = first["Date\ninvoice\nfully\npaid"];
      const paidDate = formatDate(paidDateRaw);

      // Determine payment status
      let status: string;
      if (paidDate) {
        status = "paid";
      } else if (unpaid > 0 && unpaid < totalValue) {
        status = "sent"; // partially paid
      } else {
        status = "draft";
      }

      // Collect artwork info from all rows
      const artworkRows = groupRows.filter(r => r.Type === "Artwork");
      const artists = [...new Set(artworkRows.map(r => r.Artist?.trim()).filter(Boolean))];
      const descriptions = artworkRows.map(r => r.Description?.trim()).filter(Boolean);

      // Build title
      let title: string;
      if (descriptions.length === 1) {
        title = artists[0] ? `${artists[0]} — ${descriptions[0]}` : descriptions[0];
      } else if (descriptions.length > 1) {
        const artistStr = artists.slice(0, 3).join(", ");
        title = `${artistStr || "Multiple"} — ${descriptions.length} obras`;
      } else {
        title = `Invoice ${invoiceNumber}`;
      }
      // Truncate if too long
      if (title.length > 200) title = title.substring(0, 197) + "...";

      const artworkTitle = descriptions.join("; ") || null;
      const artistName = artists.join(", ") || null;

      // Build artwork details (market, consignor, commission)
      const markets = [...new Set(artworkRows.map(r => r.Market).filter(Boolean))];
      const consignors = [...new Set(groupRows.map(r => r.Consignor).filter(v => v && v !== "None (stock)"))];
      const galleryPct = first["Gallery\n%"];
      const consignorPct = first["Consignor\n%"];
      const detailParts: string[] = [];
      if (markets.length > 0) detailParts.push(`Market: ${markets.join(", ")}`);
      if (consignors.length > 0) detailParts.push(`Consignor: ${consignors.join(", ")}`);
      if (galleryPct) detailParts.push(`Gallery: ${galleryPct}%`);
      if (consignorPct && consignorPct > 0) detailParts.push(`Consignor: ${consignorPct}%`);
      const artworkDetails = detailParts.join(" | ") || null;

      // Create invoice only (no deal — historical sales don't belong in the pipeline)
      await db.insert(invoices).values({
        invoiceNumber,
        dealId: null,
        contactId: null,
        contactName,
        contactEmail,
        artworkTitle: artworkTitle ? (artworkTitle.length > 500 ? artworkTitle.substring(0, 497) + "..." : artworkTitle) : null,
        artworkDetails,
        artistName,
        amount: totalValue,
        currency,
        tax: 0,
        totalAmount: totalValue,
        status,
        issueDate: date || new Date().toISOString().split("T")[0],
        paidDate,
        advisorName: advisor,
        notes: null,
        createdAt: new Date().toISOString(),
      });

      created++;
    } catch (err) {
      errors++;
      console.error(`Error importing invoice ${invoiceNumber}:`, err);
    }
  }

  console.log(`\nDone!`);
  console.log(`Created: ${created}`);
  console.log(`Skipped (already exist): ${skipped}`);
  console.log(`Errors: ${errors}`);

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
