import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, "app.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    song_credits INTEGER NOT NULL DEFAULT 1,
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

// --- User helpers ---

export function createUser(email, passwordHash, displayName) {
  const now = Date.now();
  const info = db.prepare(
    "INSERT INTO users (email, password_hash, display_name, song_credits, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)"
  ).run(email, passwordHash, displayName, now, now);
  return { id: info.lastInsertRowid, email, displayName, songCredits: 1 };
}

export function findUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

export function findUserById(id) {
  return db.prepare("SELECT id, email, display_name, song_credits, created_at FROM users WHERE id = ?").get(id);
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
  const newCredits = credits + count;
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

export function getAllUsers() {
  return db.prepare("SELECT id, email, display_name, song_credits FROM users ORDER BY updated_at DESC").all();
}

export default db;
