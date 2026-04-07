import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Initial users for Galeria Duque Arango
const INITIAL_USERS = [
  { name: "David Duque", email: "david@galeriaduquearango.com", role: "director", tempPassword: "GaleriaCRM2026!" },
  { name: "Santiago Duque", email: "santiago@galeriaduquearango.com", role: "advisor", tempPassword: "GaleriaCRM2026!" },
  { name: "Federico Duque", email: "federico@galeriaduquearango.com", role: "advisor", tempPassword: "GaleriaCRM2026!" },
  { name: "Miguel Duque", email: "miguel@galeriaduquearango.com", role: "advisor", tempPassword: "GaleriaCRM2026!" },
  { name: "Advisor 5", email: "advisor5@galeriaduquearango.com", role: "advisor", tempPassword: "GaleriaCRM2026!" },
];

async function seed() {
  console.log("Seeding users...\n");

  for (const u of INITIAL_USERS) {
    const [existing] = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
    if (existing) {
      console.log(`  [skip] ${u.email} already exists`);
      continue;
    }

    const passwordHash = await bcrypt.hash(u.tempPassword, 12);
    await db.insert(users).values({
      email: u.email,
      passwordHash,
      name: u.name,
      role: u.role,
      createdAt: new Date().toISOString(),
    });
    console.log(`  [created] ${u.name} (${u.email}) — role: ${u.role}`);
  }

  console.log("\n--- Temporary passwords ---");
  for (const u of INITIAL_USERS) {
    console.log(`  ${u.email}: ${u.tempPassword}`);
  }
  console.log("\nRemind users to change their password after first login.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
