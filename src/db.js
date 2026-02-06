import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, "app.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    song_credits INTEGER NOT NULL DEFAULT 1,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    lyrics TEXT NOT NULL,
    style TEXT NOT NULL,
    file_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_songs_user ON songs(user_id);
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some((col) => col.name === "is_admin")) {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
}
if (!userColumns.some((col) => col.name === "google_id")) {
  db.exec("ALTER TABLE users ADD COLUMN google_id TEXT");
}
if (!userColumns.some((col) => col.name === "provider")) {
  db.exec("ALTER TABLE users ADD COLUMN provider TEXT NOT NULL DEFAULT 'local'");
}
if (!userColumns.some((col) => col.name === "stripe_customer_id")) {
  db.exec("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT");
}

db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL");
db.exec(`
  CREATE TABLE IF NOT EXISTS stripe_events (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );
`);

// Create trial user (id=0) for anonymous song generation
// This user is a placeholder for trial songs before registration
const trialUser = db.prepare("SELECT id FROM users WHERE id = 0").get();
if (!trialUser) {
  try {
    db.exec("INSERT INTO users (id, email, password_hash, display_name, song_credits, is_admin, created_at, updated_at) VALUES (0, 'trial@system', 'not-a-valid-hash', 'Trial User', 0, 0, 0, 0)");
  } catch (e) {
    // User 0 might already exist, ignore error
  }
}

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD?.trim();
if (adminEmail && adminPassword) {
  const adminUser = db.prepare("SELECT id, is_admin FROM users WHERE LOWER(email) = ?").get(adminEmail);
  if (!adminUser) {
    const now = Date.now();
    const hash = bcrypt.hashSync(adminPassword, 12);
    db.prepare(
      "INSERT INTO users (email, password_hash, display_name, song_credits, is_admin, created_at, updated_at) VALUES (?, ?, ?, 0, 1, ?, ?)"
    ).run(adminEmail, hash, adminEmail.split("@")[0], now, now);
  } else if (!adminUser.is_admin) {
    db.prepare("UPDATE users SET is_admin = 1, updated_at = ? WHERE id = ?").run(Date.now(), adminUser.id);
  }
}

// --- User helpers ---

export function createUser(email, passwordHash, displayName) {
  const now = Date.now();
  const normalizedEmail = email.toLowerCase();
  const info = db.prepare(
    "INSERT INTO users (email, password_hash, display_name, song_credits, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)"
  ).run(normalizedEmail, passwordHash, displayName, now, now);
  return { id: info.lastInsertRowid, email: normalizedEmail, displayName, songCredits: 1 };
}

export function createOAuthUser(email, passwordHash, displayName, provider, googleId) {
  const now = Date.now();
  const normalizedEmail = email.toLowerCase();
  const info = db.prepare(
    "INSERT INTO users (email, password_hash, display_name, song_credits, provider, google_id, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?)"
  ).run(normalizedEmail, passwordHash, displayName, provider, googleId || null, now, now);
  return { id: info.lastInsertRowid, email: normalizedEmail, displayName, songCredits: 1 };
}

export function findUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(email.toLowerCase());
}

export function findUserByGoogleId(googleId) {
  return db.prepare("SELECT * FROM users WHERE google_id = ?").get(googleId);
}

export function findUserById(id) {
  return db.prepare("SELECT id, email, display_name, song_credits, is_admin, created_at FROM users WHERE id = ?").get(id);
}

export function linkGoogleToUser(userId, googleId) {
  db.prepare("UPDATE users SET google_id = ?, updated_at = ? WHERE id = ?").run(googleId, Date.now(), userId);
}

export function getStripeCustomerId(userId) {
  const row = db.prepare("SELECT stripe_customer_id FROM users WHERE id = ?").get(userId);
  return row?.stripe_customer_id || null;
}

export function setStripeCustomerId(userId, customerId) {
  db.prepare("UPDATE users SET stripe_customer_id = ?, updated_at = ? WHERE id = ?").run(customerId, Date.now(), userId);
}

// --- Message helpers ---

export function saveMessage(userId, role, content) {
  const ts = Date.now();
  db.prepare("INSERT INTO messages (user_id, role, content, timestamp) VALUES (?, ?, ?, ?)").run(userId, role, content, ts);
  return { userId, role, content, timestamp: ts };
}

export function getMessages(userId, limit = 50) {
  return db.prepare("SELECT id, role, content, timestamp FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?").all(userId, limit).reverse();
}

export function getRecentMessages(userId, limit = 15) {
  return db.prepare("SELECT role, content FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?").all(userId, limit).reverse();
}

export function deleteMessages(userId) {
  db.prepare("DELETE FROM messages WHERE user_id = ?").run(userId);
}

// --- Credit helpers ---

export function getSongCredits(userId) {
  const row = db.prepare("SELECT song_credits FROM users WHERE id = ?").get(userId);
  return row ? row.song_credits : 0;
}

export function useSongCredit(userId) {
  const credits = getSongCredits(userId);
  if (credits <= 0) return 0;
  const newCredits = credits - 1;
  db.prepare("UPDATE users SET song_credits = ?, updated_at = ? WHERE id = ?").run(newCredits, Date.now(), userId);
  return newCredits;
}

export function addSongCredits(userId, count) {
  const credits = getSongCredits(userId);
  const newCredits = Math.max(0, credits + count);
  db.prepare("UPDATE users SET song_credits = ?, updated_at = ? WHERE id = ?").run(newCredits, Date.now(), userId);
  return newCredits;
}

// --- Song helpers ---

export function createSong(userId, lyrics, style) {
  const now = Date.now();
  const info = db.prepare(
    "INSERT INTO songs (user_id, lyrics, style, status, created_at) VALUES (?, ?, ?, 'pending', ?)"
  ).run(userId, lyrics, style, now);
  return { id: info.lastInsertRowid, userId, lyrics, style, status: "pending", createdAt: now };
}

export function updateSongStatus(songId, status, filePath, errorMessage) {
  const completedAt = status === "completed" ? Date.now() : null;
  db.prepare(
    "UPDATE songs SET status = ?, file_path = ?, error_message = ?, completed_at = ? WHERE id = ?"
  ).run(status, filePath || null, errorMessage || null, completedAt, songId);
}

export function getSong(songId) {
  return db.prepare("SELECT * FROM songs WHERE id = ?").get(songId);
}

export function getSongsByUser(userId) {
  return db.prepare("SELECT * FROM songs WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

export function deleteSong(songId, userId) {
  const song = getSong(songId);
  if (!song || song.user_id !== userId) return false;
  db.prepare("DELETE FROM songs WHERE id = ? AND user_id = ?").run(songId, userId);
  return true;
}

export function getAllUsers() {
  return db.prepare("SELECT id, email, display_name, song_credits, is_admin, created_at, updated_at FROM users ORDER BY updated_at DESC").all();
}

export function isUserAdmin(userId) {
  const row = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(userId);
  return !!row?.is_admin;
}

export function setUserAdmin(userId, isAdmin) {
  db.prepare("UPDATE users SET is_admin = ?, updated_at = ? WHERE id = ?").run(isAdmin ? 1 : 0, Date.now(), userId);
  return findUserById(userId);
}

export function setSongCredits(userId, credits) {
  const safeCredits = Math.max(0, credits);
  db.prepare("UPDATE users SET song_credits = ?, updated_at = ? WHERE id = ?").run(safeCredits, Date.now(), userId);
  return getSongCredits(userId);
}

export function getAllSongs() {
  return db.prepare("SELECT * FROM songs ORDER BY created_at DESC").all();
}

export function deleteSongById(songId) {
  db.prepare("DELETE FROM songs WHERE id = ?").run(songId);
  return true;
}

// --- User profile management ---

export function updateUserDisplayName(userId, displayName) {
  db.prepare("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?").run(displayName, Date.now(), userId);
  return findUserById(userId);
}

export function updateUserPassword(userId, passwordHash) {
  db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(passwordHash, Date.now(), userId);
}

export function deleteUser(userId) {
  // Delete all user data
  db.prepare("DELETE FROM messages WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM songs WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}

export function isStripeEventProcessed(eventId) {
  const row = db.prepare("SELECT id FROM stripe_events WHERE id = ?").get(eventId);
  return !!row;
}

export function markStripeEventProcessed(eventId) {
  db.prepare("INSERT OR IGNORE INTO stripe_events (id, created_at) VALUES (?, ?)").run(eventId, Date.now());
}

export default db;
