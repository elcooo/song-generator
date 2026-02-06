import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { addClient, removeClient } from "../sse.js";

const router = Router();

router.get("/api/events", requireAuth, (req, res) => {
  const userId = req.session.userId;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  addClient(userId, res);
  req.on("close", () => removeClient(userId, res));
  res.on("error", () => removeClient(userId, res));
});

export default router;
