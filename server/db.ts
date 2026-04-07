import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env with your Supabase connection string.",
  );
}

const isProduction = process.env.NODE_ENV === "production";

// Strip sslmode from connection string — we handle SSL via the pool config directly.
// pg v8+ treats sslmode=require as verify-full, which breaks with Supabase's certificates.
const connectionString = process.env.DATABASE_URL.replace(
  /[?&]sslmode=[^&]*/g,
  "",
);

export const pool = new pg.Pool({
  connectionString,
  // Supabase requires SSL in production; allow self-signed certs from their pooler
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, {
  schema,
  // Supabase transaction pooler (port 6543) doesn't support prepared statements
  logger: false,
  ...(process.env.NODE_ENV === "production" && { prepare: false }),
});
