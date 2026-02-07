import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import compression from "compression";
import helmet from "helmet";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { mkdirSync, existsSync, statSync, openSync, closeSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

// Check required env vars
const required = [
  ["OPENAI_API_KEY", process.env.OPENAI_API_KEY],
  ["SUNO_API_KEY", process.env.SUNO_API_KEY],
  ["SESSION_SECRET", process.env.SESSION_SECRET],
];
const missing = required.filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error("Fehlende Umgebungsvariablen:", missing.join(", "));
  process.exit(1);
}

const app = express();
const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(
  express.json({
    limit: "200kb",
    verify: (req, res, buf) => {
      if (req.originalUrl === "/api/stripe/webhook") {
        req.rawBody = buf;
      }
    },
  })
);

// Session store
const dataDir = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : join(__dirname, "data");
mkdirSync(dataDir, { recursive: true });
const SQLiteStore = connectSqlite3(session);
const sessionDb = process.env.SESSION_DB || "sessions.db";
const audioDir = process.env.AUDIO_DIR ? resolve(process.env.AUDIO_DIR) : join(__dirname, "public", "audio");
mkdirSync(audioDir, { recursive: true });

const dbPath = process.env.DB_PATH ? resolve(process.env.DB_PATH) : join(dataDir, "app.db");
const sessionPath = resolve(dataDir, sessionDb);
if (!existsSync(sessionPath)) {
  try {
    closeSync(openSync(sessionPath, "a"));
  } catch (err) {
    console.error("[storage] sessionDb create failed:", err?.message || err);
  }
}
const statOrNull = (p) => {
  try {
    return statSync(p);
  } catch {
    return null;
  }
};
const dbStat = statOrNull(dbPath);
const sessionStat = statOrNull(sessionPath);
console.log("[storage] dataDir=", dataDir);
console.log("[storage] dbPath=", dbPath, "exists=", existsSync(dbPath), "size=", dbStat?.size ?? 0);
console.log("[storage] sessionDb=", sessionPath, "exists=", existsSync(sessionPath), "size=", sessionStat?.size ?? 0);
console.log("[storage] audioDir=", audioDir, "exists=", existsSync(audioDir));

app.use(
  session({
    store: new SQLiteStore({ db: sessionDb, dir: dataDir }),
    name: "sg.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
    },
  })
);

// Routes (before static files to handle API routes)
import authRoutes from "./src/routes/auth.routes.js";
import chatRoutes from "./src/routes/chat.routes.js";
import songRoutes from "./src/routes/song.routes.js";
import eventsRoutes from "./src/routes/events.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import billingRoutes from "./src/routes/billing.routes.js";
import { requireAdmin } from "./src/middleware/requireAdmin.js";

app.use(authRoutes);
app.use(chatRoutes);
app.use(songRoutes);
app.use(eventsRoutes);
app.use(adminRoutes);
app.use(billingRoutes);

// Suno API callback (receives generation results, logged for debugging)
app.post("/api/suno/callback", (req, res) => {
  console.log("[suno] callback received:", JSON.stringify(req.body).slice(0, 2000));
  res.json({ ok: true });
});

// Route: Direct to tool (trial or app)
app.get("/", (req, res) => {
  if (req.session && req.session.userId) {
    // Logged in users see full app
    res.sendFile(join(__dirname, "public", "app.html"));
  } else {
    // Anonymous users see trial version
    res.sendFile(join(__dirname, "public", "trial.html"));
  }
});

// Admin page (protected)
app.get(["/admin", "/admin.html"], requireAdmin, (req, res) => {
  res.sendFile(join(__dirname, "public", "admin.html"));
});

// Static files (after specific routes)
app.use(express.static(join(__dirname, "public")));
app.use("/audio", express.static(audioDir));

// Fallback error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Serverfehler" });
});

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
