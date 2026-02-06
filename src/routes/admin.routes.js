import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  getAllUsers,
  getAllSongs,
  getSongsByUser,
  getSong,
  deleteSongById,
  deleteUser,
  addSongCredits,
  setSongCredits,
  setUserAdmin,
} from "../db.js";
import db from "../db.js";
import { getMinimaxLogs } from "../logs/minimaxLogs.js";
import { probeMinimax } from "../music.js";
import { unlink } from "fs/promises";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "..", "public");
const audioDir = join(publicDir, "audio");

const router = Router();

function resolveAudioPath(filePath) {
  if (!filePath) return null;
  const resolved = resolve(publicDir, filePath);
  if (!resolved.startsWith(audioDir)) return null;
  return resolved;
}

router.get("/api/admin/overview", requireAdmin, (req, res) => {
  const users = db.prepare("SELECT COUNT(*) AS count FROM users WHERE id != 0").get().count;
  const admins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1 AND id != 0").get().count;
  const songs = db.prepare("SELECT COUNT(*) AS count FROM songs").get().count;
  const completed = db.prepare("SELECT COUNT(*) AS count FROM songs WHERE status = 'completed'").get().count;
  const failed = db.prepare("SELECT COUNT(*) AS count FROM songs WHERE status = 'failed'").get().count;
  const generating = db.prepare("SELECT COUNT(*) AS count FROM songs WHERE status = 'generating'").get().count;
  const pending = db.prepare("SELECT COUNT(*) AS count FROM songs WHERE status = 'pending'").get().count;
  const credits = db.prepare("SELECT COALESCE(SUM(song_credits), 0) AS total FROM users WHERE id != 0").get().total;

  res.json({
    users,
    admins,
    songs,
    completed,
    failed,
    generating,
    pending,
    credits,
  });
});

router.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = getAllUsers().filter((u) => u.id !== 0);
  res.json(users);
});

router.patch("/api/admin/users/:id/credits", requireAdmin, (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(userId) || userId <= 0) {
    return res.status(400).json({ error: "Ungültige Nutzer-ID" });
  }
  const exists = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!exists) return res.status(404).json({ error: "Nutzer nicht gefunden" });

  const credits = req.body?.credits;
  const delta = req.body?.delta;

  if (typeof credits === "number" && Number.isFinite(credits)) {
    if (credits < 0) return res.status(400).json({ error: "Credits dürfen nicht negativ sein" });
    const total = setSongCredits(userId, Math.floor(credits));
    return res.json({ songCredits: total });
  }

  if (typeof delta === "number" && Number.isFinite(delta)) {
    const total = addSongCredits(userId, Math.floor(delta));
    return res.json({ songCredits: total });
  }

  return res.status(400).json({ error: "Ungültige Credits-Änderung" });
});

router.patch("/api/admin/users/:id/admin", requireAdmin, (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(userId) || userId <= 0) {
    return res.status(400).json({ error: "Ungültige Nutzer-ID" });
  }
  const exists = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!exists) return res.status(404).json({ error: "Nutzer nicht gefunden" });
  if (userId === req.session.userId && req.body?.isAdmin === false) {
    return res.status(400).json({ error: "Du kannst dich nicht selbst entfernen" });
  }

  const isAdmin = !!req.body?.isAdmin;
  const user = setUserAdmin(userId, isAdmin);
  res.json({ id: user.id, isAdmin: !!user.is_admin });
});

router.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(userId) || userId <= 0) {
    return res.status(400).json({ error: "Ungültige Nutzer-ID" });
  }
  const exists = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!exists) return res.status(404).json({ error: "Nutzer nicht gefunden" });
  if (userId === req.session.userId) {
    return res.status(400).json({ error: "Du kannst dich nicht selbst löschen" });
  }

  const songs = getSongsByUser(userId);
  for (const song of songs) {
    if (song.file_path) {
      const filePath = resolveAudioPath(song.file_path);
      if (filePath) {
        try {
          await unlink(filePath);
        } catch {
          // Ignore file delete errors
        }
      }
    }
  }

  deleteUser(userId);
  res.json({ ok: true });
});

router.get("/api/admin/songs", requireAdmin, (req, res) => {
  const songs = getAllSongs();
  res.json(songs);
});

router.delete("/api/admin/songs/:id", requireAdmin, async (req, res) => {
  const songId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(songId)) {
    return res.status(400).json({ error: "Ungültige Song-ID" });
  }

  const song = getSong(songId);
  if (!song) return res.status(404).json({ error: "Song nicht gefunden" });

  if (song.file_path) {
    const filePath = resolveAudioPath(song.file_path);
    if (filePath) {
      try {
        await unlink(filePath);
      } catch {
        // Ignore file delete errors
      }
    }
  }

  deleteSongById(songId);
  res.json({ ok: true });
});

router.get("/api/admin/minimax/logs", requireAdmin, (req, res) => {
  const since = Number.parseInt(req.query.since, 10);
  res.json(getMinimaxLogs(Number.isFinite(since) ? since : 0));
});

router.post("/api/admin/minimax/check", requireAdmin, async (req, res) => {
  const result = await probeMinimax();
  res.json(result);
});

export default router;
