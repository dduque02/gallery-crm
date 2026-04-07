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
      contentSecurityPolicy: isProduction ? undefined : false, // Relax CSP in dev for Vite HMR
    }),
  );

  // Gzip compression
  app.use(compression());

  // CORS — locked to CORS_ORIGIN in production, open in dev
  const origin = process.env.CORS_ORIGIN || true;
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
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
}
