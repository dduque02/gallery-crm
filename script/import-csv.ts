/**
 * Importación de CSVs de Artlogic → CRM Supabase
 *
 * Uso:
 *   npx tsx script/import-csv.ts contacts ../contacts.csv
 *   npx tsx script/import-csv.ts artworks ../inventory.csv
 *   npx tsx script/import-csv.ts artworks ../inventory.csv --dry-run
 *
 * Diseñado para el formato exacto de export de Artlogic de Galería Duque Arango.
 */

import "dotenv/config";
import fs from "fs";
import { parse } from "csv-parse/sync";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { contacts, artworks } from "../shared/schema";
import type { InsertContact, InsertArtwork } from "../shared/schema";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const dryRun = process.argv.includes("--dry-run");

// ─── Helpers ───

function clean(val: string | undefined | null): string | null {
  if (!val || val.trim() === "" || val.trim() === "-") return null;
  // Remove embedded newlines, normalize whitespace
  return val.trim().replace(/\n/g, "; ").replace(/\s+/g, " ");
}

function cleanMultiline(val: string | undefined | null): string | null {
  if (!val || val.trim() === "" || val.trim() === "-") return null;
  return val.trim();
}

function cleanNum(val: string | undefined | null): number | null {
  if (!val) return null;
  const n = Number(val.replace(/[^0-9.-]/g, ""));
  return isNaN(n) || n === 0 ? null : Math.round(n);
}

function hasRealName(fullName: string): boolean {
  const cleaned = fullName.trim();
  if (!cleaned || cleaned.length <= 2) return false;
  if (cleaned.replace(/[\s\-+().]/g, "").match(/^\d+$/)) return false;
  return true;
}

function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

// ─── Contact mapping (Artlogic format) ───

function mapContact(row: Record<string, string>): InsertContact | null {
  const fullName = row["Full name"]?.trim() || "";
  if (!hasRealName(fullName)) return null;

  // Skip "Do not contact"
  if (row["Do not contact"]?.trim().toLowerCase() === "true") return null;

  // Artlogic exports all as "Gallery" — infer type from Categories/Organisation
  const categories = (row["Categories"] || "").toLowerCase();
  const org = (row["Organisation"] || "").toLowerCase();
  let type = "collector";

  if (categories.includes("artist") || categories.includes("artista")) {
    type = "artist";
  } else if (categories.includes("gallery") || categories.includes("galería") || categories.includes("galeria")) {
    type = "gallery";
  } else if (categories.includes("museum") || categories.includes("museo") || categories.includes("instit") || categories.includes("fundación") || categories.includes("foundation")) {
    type = "institution";
  } else if (org.includes("gallery") || org.includes("galería") || org.includes("galeria")) {
    type = "gallery";
  } else if (org.includes("museum") || org.includes("museo") || org.includes("fundación") || org.includes("foundation")) {
    type = "institution";
  }

  // Build notes from multiple Artlogic fields
  const notesParts: string[] = [];
  const genInfo = cleanMultiline(row["General information"]);
  if (genInfo) notesParts.push(genInfo);
  const interests = clean(row["Interests"]);
  if (interests) notesParts.push(`Interests: ${interests}`);
  const collection = clean(row["Collection"]);
  if (collection) notesParts.push(`Collection: ${collection}`);
  const maxBudget = clean(row["Max budget"]);
  if (maxBudget && maxBudget !== "0.00" && maxBudget !== "0") {
    notesParts.push(`Max budget: $${maxBudget}`);
  }

  // Tags from Categories
  const tagsRaw = clean(row["Categories"]);
  const tags = tagsRaw
    ? tagsRaw.split(/[,;|]/).map(t => t.trim().toLowerCase()).filter(Boolean)
    : null;

  // Email — validate
  const emailRaw = row["Email"]?.trim() || "";
  const email = isValidEmail(emailRaw) ? emailRaw : null;

  // Phone — clean up
  let phone = clean(row["Telephone"]);
  if (phone && phone.match(/[a-zA-Z]/)) phone = null; // discard if contains letters

  // Importance: Artlogic uses 0-5, only store if > 0
  const importance = parseInt(row["Importance rating"] || "0", 10);

  return {
    name: fullName,
    email,
    phone,
    type,
    company: clean(row["Organisation"]),
    notes: notesParts.length > 0 ? notesParts.join("\n") : null,
    city: clean(row["Town/City"]),
    country: clean(row["Country"]),
    tags: tags && tags.length > 0 ? tags : (importance > 0 ? [`importance-${importance}`] : null),
    lastContactDate: null,
    totalPurchases: cleanNum(row["Manual purchases"]) || 0,
    totalSpent: 0,
  };
}

// ─── Artwork mapping (Artlogic format) ───

function mapArtworkStatus(artlogicStatus: string, availability: string): string {
  const s = artlogicStatus.toLowerCase();
  const a = availability.toLowerCase();

  if (a.includes("sold")) return "sold";
  if (a.includes("reserved") || a.includes("under offer")) return "reserved";
  if (a.includes("on loan")) return "on_loan";
  if (s.includes("consignment")) return "on_consignment";
  if (a.includes("available") || a.includes("potentially available")) return "available";
  if (s.includes("stock")) return "available";
  return "available";
}

function mapArtworkAvailability(availability: string): string {
  const a = availability.toLowerCase();
  if (a.includes("consigned out")) return "consigned_out";
  if (a.includes("consign")) return "consigned_in";
  return "in_stock";
}

/**
 * Currency mapping — the tricky part.
 * Artlogic uses "$" for both USD and COP. We detect COP by price threshold:
 * - If currency is "$" and price >= 500,000 → likely COP (Colombian pesos)
 * - If currency is "$" and price < 500,000 → likely USD
 * Exception: Botero works can legitimately be $1M+ USD.
 * We use a conservative threshold and flag high-value items.
 */
function mapCurrencyAndPrice(
  currencyRaw: string,
  priceRaw: string,
  artistName: string,
): { currency: string; price: number | null } {
  const c = currencyRaw.trim();
  const price = cleanNum(priceRaw);

  if (!price) return { currency: "USD", price: null };

  if (c === "COP" || c === "COP$") return { currency: "COP", price };
  if (c === "£") return { currency: "GBP", price };
  if (c === "€" || c === "EUR") return { currency: "EUR", price };

  // "$" — could be USD or COP
  if (c === "$") {
    // Known high-value USD artists (secondary market / blue chip)
    // Artists whose $ prices are genuinely USD (secondary market / blue chip)
    const highValueArtists = [
      "fernando botero", "olga de amaral", "edgar negret",
      "alejandro obregón", "rufino tamayo", "david manzur",
      "julio larraz", "omar rayo",
      // Secondary market international
      "leonora carrington", "claudio bravo", "ana mercedes hoyos",
      "manolo vald", "oswaldo guayasamín", "tomás sánchez",
      "sophia vari", "darío morales", "carlos cruz-diez",
      "joaquín torres", "mathias goeritz", "enrique grau",
      "wifredo lam", "oscar murillo", "ugo rondinone",
      "oswaldo vigas", "tomás ochoa", "darío ortiz",
      "gustavo vélez", "gustavo velez",
    ];
    const artistLower = artistName.toLowerCase();
    const isHighValue = highValueArtists.some(a => artistLower.includes(a));

    if (isHighValue) {
      // These artists genuinely sell for $1M+ USD
      return { currency: "USD", price };
    }

    // For other artists: if >= 500,000 with "$", it's almost certainly COP
    if (price >= 500000) {
      return { currency: "COP", price };
    }

    return { currency: "USD", price };
  }

  return { currency: c || "USD", price };
}

/**
 * Clean Medium — if bilingual (contains |), keep only Spanish (first part)
 */
function cleanMedium(medium: string | null): string | null {
  if (!medium) return null;
  const cleaned = medium.trim().replace(/\n/g, " ");
  if (cleaned.includes("|")) {
    return cleaned.split("|")[0].trim();
  }
  return cleaned;
}

/**
 * Clean Dimensions — replace newlines with semicolons, keep both metric/imperial
 */
function cleanDimensions(dims: string | null): string | null {
  if (!dims) return null;
  return dims.trim().replace(/\n/g, " ").replace(/\s*;\s*/g, "; ").replace(/\s+/g, " ");
}

function mapArtwork(row: Record<string, string>): InsertArtwork {
  const status = mapArtworkStatus(row["Status"] || "", row["Availability"] || "");
  const artistName = clean(row["Artist"]) || "Desconocido";

  const { currency, price } = mapCurrencyAndPrice(
    row["Retail currency"] || "",
    row["Retail price"] || "",
    artistName,
  );

  // Cost price — same currency logic
  const { price: costPrice } = mapCurrencyAndPrice(
    row["Purchase\ncurrency"] || row["Retail currency"] || "",
    row["Purchase price"] || "",
    artistName,
  );

  // Edition info
  const isEditionRaw = row["This artwork is a print or edition"]?.trim().toLowerCase();
  const isEdition = isEditionRaw === "yes" || isEditionRaw === "true";
  const editionParts: string[] = [];
  const editionDetails = clean(row["Edition details"]);
  if (editionDetails) editionParts.push(editionDetails);
  const edTotal = clean(row["Edition total"]);
  const apTotal = clean(row["Artist's proof total"]);
  if (edTotal) editionParts.push(`Ed. ${edTotal}`);
  if (apTotal) editionParts.push(`AP ${apTotal}`);

  // Notes — combine additional info + commentary
  const notesParts: string[] = [];
  const addInfo = cleanMultiline(row["Additional information"]);
  if (addInfo) notesParts.push(addInfo);

  // Importance: Artlogic uses 0-5
  const importance = Math.min(parseInt(row["Importance rating"] || "0", 10), 5);

  // Image URL — prefer large, fallback to medium
  const imageUrl = clean(row["Main image URL (large)"])
    || clean(row["Main image URL (medium)"])
    || clean(row["Main image URL (small)"]);

  return {
    stockNumber: clean(row["Stock number"]),
    title: clean(row["Title"]) || "Sin título",
    artistName,
    medium: cleanMedium(row["Medium"]),
    dimensions: cleanDimensions(row["Dimensions"]),
    year: clean(row["Year"]),
    inscription: clean(row["Signed and dated"]),
    description: cleanMultiline(row["Commentary or description"]),
    retailPrice: price,
    retailCurrency: currency,
    costPrice,
    status,
    availability: mapArtworkAvailability(row["Availability"] || ""),
    location: clean(row["Location"]),
    locationDetail: clean(row["Location (detail)"]),
    isEdition,
    editionInfo: editionParts.length > 0 ? editionParts.join(" | ") : null,
    provenance: cleanMultiline(row["Provenance"]),
    exhibitionHistory: cleanMultiline(row["Exhibitions"]),
    literature: cleanMultiline(row["Literature"]),
    condition: clean(row["Condition"]),
    conditionNotes: null,
    imageUrl,
    importance,
    internalNotes: notesParts.length > 0 ? notesParts.join("\n") : null,
    tags: null,
    contactId: null,
    consignorId: null,
    series: clean(row["Series"]),
    genre: clean(row["Genre"]),
    category: clean(row["Type"]) || null,
  };
}

// ─── Deduplication for artworks ───
// Artlogic exports multiple rows per stock number (history).
// Priority: Stock > On consignment > 3rd Party > Ex-inventory
// Secondary: prefer non-Sold availability
function deduplicateArtworks(rows: Record<string, string>[]): Record<string, string>[] {
  const byStock = new Map<string, Record<string, string>>();
  const noStock: Record<string, string>[] = [];
  const statusPriority: Record<string, number> = {
    "Stock": 0,
    "On consignment": 1,
    "3rd Party": 2,
    "Ex-inventory": 3,
  };

  for (const row of rows) {
    const sn = (row["Stock number"] || "").trim();
    if (!sn) {
      noStock.push(row);
      continue;
    }

    const existing = byStock.get(sn);
    if (!existing) {
      byStock.set(sn, row);
      continue;
    }

    const existingPriority = statusPriority[existing["Status"]?.trim()] ?? 99;
    const newPriority = statusPriority[row["Status"]?.trim()] ?? 99;

    if (newPriority < existingPriority) {
      byStock.set(sn, row);
    } else if (newPriority === existingPriority) {
      // Same status priority — prefer non-sold availability
      const existingAvail = existing["Availability"]?.trim().toLowerCase() || "";
      const newAvail = row["Availability"]?.trim().toLowerCase() || "";
      if (existingAvail.includes("sold") && !newAvail.includes("sold")) {
        byStock.set(sn, row);
      }
    }
  }

  return [...Array.from(byStock.values()), ...noStock];
}

// ─── Main ───

async function main() {
  const args = process.argv.filter(a => !a.startsWith("--"));
  const [, , entityType, filePath] = args;

  if (!entityType || !filePath) {
    console.log("Uso:");
    console.log("  npx tsx script/import-csv.ts contacts ../contacts.csv");
    console.log("  npx tsx script/import-csv.ts artworks ../inventory.csv");
    console.log("  Agrega --dry-run para ver el mapeo sin insertar");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`Archivo no encontrado: ${filePath}`);
    process.exit(1);
  }

  console.log(dryRun ? "\n=== DRY RUN — no se insertará nada ===\n" : "");

  const raw = fs.readFileSync(filePath, "utf-8");
  const records: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });

  console.log(`Registros en CSV: ${records.length}\n`);

  if (entityType === "contacts") {
    const mapped = records
      .map(r => mapContact(r))
      .filter((c): c is InsertContact => c !== null);

    console.log(`Contactos válidos: ${mapped.length}`);
    console.log(`Filtrados: ${records.length - mapped.length} (sin nombre real / Do Not Contact)\n`);

    // Stats
    const typeDist: Record<string, number> = {};
    const withEmail = mapped.filter(c => c.email).length;
    const withPhone = mapped.filter(c => c.phone).length;
    const withCity = mapped.filter(c => c.city).length;
    const withNotes = mapped.filter(c => c.notes).length;
    const withTags = mapped.filter(c => c.tags && c.tags.length > 0).length;
    mapped.forEach(c => { typeDist[c.type] = (typeDist[c.type] || 0) + 1; });

    console.log("Distribución por tipo:");
    Object.entries(typeDist).sort((a, b) => b[1] - a[1]).forEach(([t, c]) => console.log(`  ${t}: ${c}`));
    console.log(`\nCampos poblados:`);
    console.log(`  Con email válido: ${withEmail}`);
    console.log(`  Con teléfono: ${withPhone}`);
    console.log(`  Con ciudad: ${withCity}`);
    console.log(`  Con notas: ${withNotes}`);
    console.log(`  Con tags: ${withTags}`);

    console.log("\nEjemplos (primeros 5 con datos completos):");
    const examples = mapped.filter(c => c.email && c.phone).slice(0, 5);
    examples.forEach(c => console.log(`  ${c.name} | ${c.type} | ${c.email} | ${c.phone} | ${c.city || "—"}`));

    if (!dryRun) {
      console.log(`\nInsertando ${mapped.length} contactos...`);
      let inserted = 0;
      for (const contact of mapped) {
        try {
          await db.insert(contacts).values(contact);
          inserted++;
          if (inserted % 500 === 0) console.log(`  ${inserted}/${mapped.length}...`);
        } catch (err: any) {
          console.error(`Error insertando "${contact.name}": ${err.message}`);
        }
      }
      console.log(`\n${inserted}/${mapped.length} contactos insertados.`);
    }
  } else if (entityType === "artworks") {
    console.log("Deduplicando por Stock number...");
    const deduped = deduplicateArtworks(records);
    console.log(`Registros únicos: ${deduped.length} (de ${records.length} totales)\n`);

    const mapped = deduped.map(r => mapArtwork(r));

    // Stats
    const statusDist: Record<string, number> = {};
    const currDist: Record<string, number> = {};
    const withImage = mapped.filter(a => a.imageUrl).length;
    const withPrice = mapped.filter(a => a.retailPrice).length;
    const withProvenance = mapped.filter(a => a.provenance).length;
    mapped.forEach(a => {
      statusDist[a.status] = (statusDist[a.status] || 0) + 1;
      if (a.retailCurrency) currDist[a.retailCurrency] = (currDist[a.retailCurrency] || 0) + 1;
    });

    console.log("Distribución por status:");
    Object.entries(statusDist).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => console.log(`  ${s}: ${c}`));

    console.log("\nDistribución por moneda:");
    Object.entries(currDist).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}: ${n}`));

    console.log(`\nCampos poblados:`);
    console.log(`  Con imagen: ${withImage}`);
    console.log(`  Con precio: ${withPrice}`);
    console.log(`  Con provenance: ${withProvenance}`);

    // Show currency reclassification examples
    console.log("\nEjemplos moneda reclasificada ($ → COP):");
    mapped.filter(a => a.retailCurrency === "COP" && a.retailPrice && a.retailPrice > 0)
      .slice(0, 5)
      .forEach(a => console.log(`  ${a.stockNumber || "—"} | ${a.artistName} | "${a.title}" | COP ${a.retailPrice?.toLocaleString()}`));

    console.log("\nEjemplos USD alto (blue chip):");
    mapped.filter(a => a.retailCurrency === "USD" && a.retailPrice && a.retailPrice > 500000)
      .slice(0, 5)
      .forEach(a => console.log(`  ${a.stockNumber || "—"} | ${a.artistName} | "${a.title}" | USD ${a.retailPrice?.toLocaleString()}`));

    console.log("\nEjemplos generales (primeros 5):");
    mapped.slice(0, 5).forEach(a => console.log(`  ${a.stockNumber} | ${a.artistName} | "${a.title}" (${a.year}) | ${a.status} | ${a.retailCurrency} ${a.retailPrice?.toLocaleString() || "—"}`));

    if (!dryRun) {
      console.log(`\nInsertando ${mapped.length} obras...`);
      let inserted = 0;
      for (const artwork of mapped) {
        try {
          await db.insert(artworks).values(artwork);
          inserted++;
          if (inserted % 500 === 0) console.log(`  ${inserted}/${mapped.length}...`);
        } catch (err: any) {
          console.error(`Error insertando "${artwork.title}": ${err.message}`);
        }
      }
      console.log(`\n${inserted}/${mapped.length} obras insertadas.`);
    }
  } else {
    console.error(`Tipo no reconocido: "${entityType}". Usa "contacts" o "artworks".`);
    process.exit(1);
  }

  await pool.end();
  console.log("\nListo.");
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
