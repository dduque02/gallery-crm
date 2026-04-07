import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env with your Supabase connection string.",
  );
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, {
  schema,
  // Supabase transaction pooler (port 6543) doesn't support prepared statements
  logger: false,
  ...(process.env.NODE_ENV === "production" && { prepare: false }),
});
