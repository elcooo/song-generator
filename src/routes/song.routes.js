import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getSongCredits, useSongCredit, createSong, updateSongStatus, getSong, getSongsByUser } from "../db.js";
import { generateMusic } from "../music.js";
import { broadcastToUser } from "../sse.js";

const router = Router();
const generatingFor = new Set();

router.post("/api/generate", requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { lyrics, style } = req.body;

  if (!lyrics || !style) return res.status(400).json({ error: "Lyrics und Stil erforderlich" });

  const credits = getSongCredits(userId);
  if (credits <= 0) {
    return res.status(403).json({ error: "Kein Song-Guthaben mehr vorhanden" });
  }

  if (generatingFor.has(userId)) {
    return res.status(429).json({ error: "Song wird bereits generiert" });
  }

  generatingFor.add(userId);

  // Deduct credit and create song record
  const newCredits = useSongCredit(userId);
  const song = createSong(userId, lyrics, style);

  // Respond immediately
  broadcastToUser(userId, "credits_update", { songCredits: newCredits });
  broadcastToUser(userId, "song_status", { songId: song.id, status: "generating" });
  res.json({ songId: song.id, status: "generating", songCredits: newCredits });

  // Generate in background
  try {
    updateSongStatus(song.id, "generating");
    const result = await generateMusic(style, lyrics, song.id);

    if (result.error) {
      updateSongStatus(song.id, "failed", null, result.error);
      broadcastToUser(userId, "song_status", { songId: song.id, status: "failed", error: result.error });
    } else {
      updateSongStatus(song.id, "completed", result.filePath);
      broadcastToUser(userId, "song_status", { songId: song.id, status: "completed", filePath: result.filePath });
    }
  } catch (err) {
    console.error("Generation error:", err);
    updateSongStatus(song.id, "failed", null, err.message);
    broadcastToUser(userId, "song_status", { songId: song.id, status: "failed", error: err.message });
  } finally {
    generatingFor.delete(userId);
  }
});

router.get("/api/songs", requireAuth, (req, res) => {
  res.json(getSongsByUser(req.session.userId));
});

router.get("/api/songs/:id", requireAuth, (req, res) => {
  const song = getSong(parseInt(req.params.id));
  if (!song || song.user_id !== req.session.userId) return res.status(404).json({ error: "Song nicht gefunden" });
  res.json(song);
});

export default router;
