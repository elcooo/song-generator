import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

// Check required env vars
const required = [
  ["OPENAI_API_KEY", process.env.OPENAI_API_KEY],
  ["MINIMAX_API_KEY", process.env.MINIMAX_API_KEY],
  ["SESSION_SECRET", process.env.SESSION_SECRET],
];
const missing = required.filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error("Fehlende Umgebungsvariablen:", missing.join(", "));
  process.exit(1);
}

const app = express();
app.use(express.json());

// Session store
const dataDir = join(__dirname, "data");
mkdirSync(dataDir, { recursive: true });
const SQLiteStore = connectSqlite3(session);

app.use(
  session({
    store: new SQLiteStore({ db: "sessions.db", dir: dataDir }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

// Static files
app.use(express.static(join(__dirname, "public")));

// Routes
import authRoutes from "./src/routes/auth.routes.js";
import chatRoutes from "./src/routes/chat.routes.js";
import songRoutes from "./src/routes/song.routes.js";
import eventsRoutes from "./src/routes/events.routes.js";

app.use(authRoutes);
app.use(chatRoutes);
app.use(songRoutes);
app.use(eventsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
