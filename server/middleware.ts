import type { Express, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";

export function setupSecurity(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              ...helmet.contentSecurityPolicy.getDefaultDirectives(),
              "img-src": [
                "'self'",
                "data:",
                "https://datastore.artlogic.net",
                "https://*.supabase.co",
              ],
            },
          }
        : false, // Relax CSP in dev for Vite HMR
    }),
  );

  // Gzip compression
  app.use(compression());

  // CORS — locked to CORS_ORIGIN in production, open in dev
  // Support multiple origins separated by commas (e.g., "https://crm.example.com,https://app.onrender.com")
  const corsOriginEnv = process.env.CORS_ORIGIN;
  const origin = corsOriginEnv
    ? corsOriginEnv.includes(",")
      ? corsOriginEnv.split(",").map((o) => o.trim())
      : corsOriginEnv
    : true;
  app.use(cors({ origin, credentials: true }));

  // Rate limiting — general API routes
  app.use(
    "/api/",
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Too many requests, please try again later." },
    }),
  );

  // Rate limiting — stricter for login attempts
  app.use(
    "/api/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Too many login attempts, please try again later." },
    }),
  );

  // Health check endpoint (no auth required, used by Render)
  app.get("/api/health", async (_req: Request, res: Response) => {
    // Basic health — always respond quickly
    const health: Record<string, unknown> = {
      status: "ok",
      timestamp: new Date().toISOString(),
    };

    // If ?db=1 is passed, also test database connectivity (for diagnostics)
    if (_req.query.db === "1") {
      try {
        const { pool } = await import("./db");
        const result = await pool.query("SELECT 1 AS ping");
        health.db = "ok";
        health.dbPing = result.rows[0]?.ping;
      } catch (err: any) {
        health.db = "error";
        health.dbError = err.message;
      }
    }

    res.json(health);
  });
}
