import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { pool, db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId: number;
    userRole: string;
    userName: string;
    userEmail: string;
  }
}

const isProduction = process.env.NODE_ENV === "production";
const hasSessionSecret = !!process.env.SESSION_SECRET;

// Dev bypass: if no SESSION_SECRET in dev, auth is disabled
const authEnabled = isProduction || hasSessionSecret;

export function setupAuth(app: Express) {
  if (isProduction && !hasSessionSecret) {
    console.error("FATAL: SESSION_SECRET is required in production. Exiting.");
    process.exit(1);
  }

  if (!authEnabled) {
    console.warn("[auth] Auth BYPASSED in development (no SESSION_SECRET set). Set SESSION_SECRET in .env to enable.");
  }

  // Session middleware — always set up so req.session exists
  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "dev-secret-not-for-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    }),
  );

  // --- Auth Routes ---

  // Login
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
      }

      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      // Explicitly save session to catch store errors
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userName = user.name;
      req.session.userEmail = user.email;

      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    } catch (err: any) {
      console.error("[auth] Login error:", err);
      res.status(500).json({
        message: "Login failed due to a server error.",
        ...(process.env.NODE_ENV !== "production" && { detail: err.message }),
      });
    }
  });

  // Logout
  app.post("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed." });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out." });
    });
  });

  // Current user
  app.get("/api/me", (req: Request, res: Response) => {
    if (!authEnabled) {
      // Dev bypass: return a mock director user
      return res.json({ id: 0, email: "dev@localhost", name: "Developer", role: "director" });
    }
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated." });
    }
    res.json({
      id: req.session.userId,
      email: req.session.userEmail || "",
      name: req.session.userName,
      role: req.session.userRole,
    });
  });
}

// --- Middleware ---

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Skip auth for health check, login, logout, and non-API routes
  const path = req.path;
  if (
    path === "/api/health" ||
    path === "/api/login" ||
    path === "/api/logout" ||
    path === "/api/me" ||
    path.startsWith("/api/webhooks/") ||
    !path.startsWith("/api/")
  ) {
    return next();
  }

  // Bearer token auth (for n8n and external integrations)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const apiKey = process.env.CRM_API_KEY;
    if (apiKey && token === apiKey) {
      (req as any).isApiKey = true;
      return next();
    }
    return res.status(401).json({ message: "Invalid API key." });
  }

  // Dev bypass
  if (!authEnabled) {
    return next();
  }

  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required." });
  }

  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // API key auth bypasses role check (n8n is trusted)
    if ((req as any).isApiKey) {
      return next();
    }

    // Dev bypass
    if (!authEnabled) {
      return next();
    }

    if (!req.session.userRole || !roles.includes(req.session.userRole)) {
      return res.status(403).json({ message: "Insufficient permissions." });
    }

    next();
  };
}
