import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { processChat } from "../chat.js";
import { getMessages, getSongCredits } from "../db.js";
import { broadcastToUser } from "../sse.js";

const router = Router();

// Prevent duplicate simultaneous AI calls per user
const processingFor = new Set();

router.post("/api/chat", requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Nachricht fehlt" });

  if (processingFor.has(userId)) {
    return res.status(429).json({ error: "Bitte warte auf die vorherige Antwort" });
  }

  processingFor.add(userId);
  try {
    const result = await processChat(userId, message);
    const credits = getSongCredits(userId);

    if (result.type === "generate") {
      broadcastToUser(userId, "credits_update", { songCredits: credits });
      res.json({ ...result, songCredits: credits });
    } else {
      res.json({ ...result, songCredits: credits });
    }
  } catch (err) {
    console.error("Chat error:", err?.message || err);
    res.status(500).json({ error: "Chat-Fehler aufgetreten" });
  } finally {
    processingFor.delete(userId);
  }
});

router.get("/api/messages", requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const messages = getMessages(req.session.userId, limit);
  res.json(messages);
});

export default router;
