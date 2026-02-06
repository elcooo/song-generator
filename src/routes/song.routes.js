import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { generateLimiter, trialLimiter } from "../middleware/rateLimiters.js";
import {
  getSongCredits,
  useSongCredit,
  addSongCredits,
  createSong,
  updateSongStatus,
  getSong,
  getSongsByUser,
  deleteSong,
} from "../db.js";
import { generateMusic } from "../music.js";
import { broadcastToUser } from "../sse.js";
import { LIMITS, requireText } from "../utils/validation.js";
import { unlink } from "fs/promises";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "..", "public");
const audioDir = join(publicDir, "audio");

const router = Router();
const generatingCount = new Map();
const MAX_CONCURRENT = 2;

function getLimit(key) {
  return typeof key === "string" && key.startsWith("trial_") ? 1 : MAX_CONCURRENT;
}

function canGenerate(key) {
  return (generatingCount.get(key) || 0) < getLimit(key);
}

function markStart(key) {
  generatingCount.set(key, (generatingCount.get(key) || 0) + 1);
}

function markEnd(key) {
  const next = (generatingCount.get(key) || 1) - 1;
  if (next <= 0) generatingCount.delete(key);
  else generatingCount.set(key, next);
}

function refundCredit(userId) {
  const credits = addSongCredits(userId, 1);
  broadcastToUser(userId, "credits_update", { songCredits: credits });
}

function resolveAudioPath(filePath) {
  if (!filePath) return null;
  const resolved = resolve(publicDir, filePath);
  if (!resolved.startsWith(audioDir)) return null;
  return resolved;
}

router.post("/api/generate", requireAuth, generateLimiter, async (req, res) => {
  const userId = req.session.userId;
  const { lyrics, style } = req.body;

  const lyricsResult = requireText(lyrics, LIMITS.lyrics, "Lyrics und Stil erforderlich");
  const styleResult = requireText(style, LIMITS.style, "Lyrics und Stil erforderlich");
  if (!lyricsResult.ok) {
    return res.status(400).json({ error: lyricsResult.error });
  }
  if (!styleResult.ok) {
    return res.status(400).json({ error: styleResult.error });
  }

  const credits = getSongCredits(userId);
  if (credits <= 0) {
    return res.status(403).json({ error: "Kein Song-Guthaben mehr vorhanden" });
  }

  if (!canGenerate(userId)) {
    return res.status(429).json({ error: "Zu viele parallele Generierungen. Bitte warte kurz." });
  }

  markStart(userId);

  // Deduct credit and create song record
  const newCredits = useSongCredit(userId);
  const song = createSong(userId, lyricsResult.value, styleResult.value);

  // Respond immediately
  broadcastToUser(userId, "credits_update", { songCredits: newCredits });
  broadcastToUser(userId, "song_status", { songId: song.id, status: "generating" });
  res.json({ songId: song.id, status: "generating", songCredits: newCredits });

  let refunded = false;
  const refundOnce = () => {
    if (refunded) return;
    refunded = true;
    refundCredit(userId);
  };

  // Generate in background
  try {
    updateSongStatus(song.id, "generating");
    const onProgress = (p) => broadcastToUser(userId, "song_progress", { songId: song.id, ...p });
    const result = await generateMusic(styleResult.value, lyricsResult.value, song.id, onProgress);

    if (result.error) {
      updateSongStatus(song.id, "failed", null, result.error);
      broadcastToUser(userId, "song_status", { songId: song.id, status: "failed", error: result.error });
      refundOnce();
    } else {
      updateSongStatus(song.id, "completed", result.filePath);
      broadcastToUser(userId, "song_status", { songId: song.id, status: "completed", filePath: result.filePath });
    }
  } catch (err) {
    console.error("Generation error:", err);
    updateSongStatus(song.id, "failed", null, err.message);
    broadcastToUser(userId, "song_status", { songId: song.id, status: "failed", error: err.message });
    refundOnce();
  } finally {
    markEnd(userId);
  }
});

router.get("/api/songs", requireAuth, (req, res) => {
  res.json(getSongsByUser(req.session.userId));
});

router.get("/api/songs/:id", requireAuth, (req, res) => {
  const songId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(songId)) return res.status(400).json({ error: "Ungültige Song-ID" });
  const song = getSong(songId);
  if (!song || song.user_id !== req.session.userId) return res.status(404).json({ error: "Song nicht gefunden" });
  res.json(song);
});

router.delete("/api/songs/:id", requireAuth, async (req, res) => {
  const songId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(songId)) return res.status(400).json({ error: "Ungültige Song-ID" });
  const song = getSong(songId);
  
  if (!song || song.user_id !== req.session.userId) {
    return res.status(404).json({ error: "Song nicht gefunden" });
  }
  
  try {
    // Delete audio file if exists
    if (song.file_path) {
      try {
        const filePath = resolveAudioPath(song.file_path);
        if (filePath) {
          await unlink(filePath);
        }
      } catch (err) {
        // File might not exist, continue anyway
        console.warn("Could not delete song file:", err.message);
      }
    }
    
    // Delete from database
    deleteSong(songId, req.session.userId);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting song:", err);
    res.status(500).json({ error: "Fehler beim Löschen des Songs" });
  }
});

// Retry failed song generation
router.post("/api/songs/:id/retry", requireAuth, generateLimiter, async (req, res) => {
  const userId = req.session.userId;
  const songId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(songId)) return res.status(400).json({ error: "Ungültige Song-ID" });

  const song = getSong(songId);
  if (!song || song.user_id !== userId) {
    return res.status(404).json({ error: "Song nicht gefunden" });
  }
  if (song.status === "generating" || song.status === "pending") {
    return res.status(409).json({ error: "Song wird bereits generiert" });
  }
  if (song.status !== "failed") {
    return res.status(400).json({ error: "Song kann nicht erneut generiert werden" });
  }

  const credits = getSongCredits(userId);
  if (credits <= 0) {
    return res.status(403).json({ error: "Kein Song-Guthaben mehr vorhanden" });
  }

  if (!canGenerate(userId)) {
    return res.status(429).json({ error: "Zu viele parallele Generierungen. Bitte warte kurz." });
  }

  markStart(userId);

  const newCredits = useSongCredit(userId);
  broadcastToUser(userId, "credits_update", { songCredits: newCredits });
  broadcastToUser(userId, "song_status", { songId, status: "generating" });
  res.json({ songId, status: "generating", songCredits: newCredits });

  let refunded = false;
  const refundOnce = () => {
    if (refunded) return;
    refunded = true;
    refundCredit(userId);
  };

  try {
    updateSongStatus(songId, "generating");
    const onProgress = (p) => broadcastToUser(userId, "song_progress", { songId, ...p });
    const result = await generateMusic(song.style, song.lyrics, songId, onProgress);

    if (result.error) {
      updateSongStatus(songId, "failed", null, result.error);
      broadcastToUser(userId, "song_status", { songId, status: "failed", error: result.error });
      refundOnce();
    } else {
      updateSongStatus(songId, "completed", result.filePath);
      broadcastToUser(userId, "song_status", { songId, status: "completed", filePath: result.filePath });
    }
  } catch (err) {
    console.error("Retry generation error:", err);
    updateSongStatus(songId, "failed", null, err.message);
    broadcastToUser(userId, "song_status", { songId, status: "failed", error: err.message });
    refundOnce();
  } finally {
    markEnd(userId);
  }
});

// Trial mode - generate song without authentication
router.post("/api/generate/trial", trialLimiter, async (req, res) => {
  const { lyrics, style } = req.body;

  const lyricsResult = requireText(lyrics, LIMITS.lyrics, "Lyrics und Stil erforderlich");
  const styleResult = requireText(style, LIMITS.style, "Lyrics und Stil erforderlich");
  if (!lyricsResult.ok) {
    return res.status(400).json({ error: lyricsResult.error });
  }
  if (!styleResult.ok) {
    return res.status(400).json({ error: styleResult.error });
  }

  // Check if trial already used
  if (req.session.trialUsed) {
    return res.status(403).json({ error: "Trial bereits verwendet. Bitte registriere dich für weitere Songs." });
  }

  // Mark trial as used (will be cleared on failure)
  req.session.trialUsed = true;
  req.session.save(() => {});

  const trialUserId = "trial_" + req.sessionID;
  
  if (!canGenerate(trialUserId)) {
    return res.status(429).json({ error: "Song wird bereits generiert" });
  }

  markStart(trialUserId);

  // Create song record with special trial user
  const song = createSong(0, lyricsResult.value, styleResult.value); // userId 0 for trial
  req.session.trialSongId = song.id;
  req.session.save(() => {});

  // Respond immediately
  res.json({ songId: song.id, status: "generating" });

  // Generate in background
  try {
    updateSongStatus(song.id, "generating");
    const result = await generateMusic(styleResult.value, lyricsResult.value, song.id);

    if (result.error) {
      updateSongStatus(song.id, "failed", null, result.error);
      req.session.trialUsed = false;
      req.session.save(() => {});
    } else {
      updateSongStatus(song.id, "completed", result.filePath);
    }
  } catch (err) {
    console.error("Trial generation error:", err);
    updateSongStatus(song.id, "failed", null, err.message);
    req.session.trialUsed = false;
    req.session.save(() => {});
  } finally {
    markEnd(trialUserId);
  }
});

// Trial mode - get song status
router.get("/api/songs/trial/:id", (req, res) => {
  const songId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(songId)) return res.status(400).json({ error: "Ungültige Song-ID" });
  
  // Verify this is the session's trial song
  if (req.session.trialSongId !== songId) {
    return res.status(404).json({ error: "Song nicht gefunden" });
  }

  const song = getSong(songId);
  if (!song) return res.status(404).json({ error: "Song nicht gefunden" });
  
  res.json(song);
});

export default router;
