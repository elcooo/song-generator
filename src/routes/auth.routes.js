import { Router } from "express";
import bcrypt from "bcrypt";
import { createUser, findUserByEmail, findUserById } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/api/register", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) return res.status(400).json({ error: "E-Mail und Passwort erforderlich" });
  if (password.length < 6) return res.status(400).json({ error: "Passwort muss mindestens 6 Zeichen lang sein" });

  const existing = findUserByEmail(email);
  if (existing) return res.status(400).json({ error: "Diese E-Mail ist bereits registriert" });

  try {
    const hash = await bcrypt.hash(password, 12);
    const user = createUser(email, hash, displayName || email.split("@")[0]);
    req.session.userId = user.id;
    res.json({ id: user.id, email, displayName: user.displayName, songCredits: user.songCredits });
  } catch (err) {
    res.status(500).json({ error: "Registrierung fehlgeschlagen" });
  }
});

router.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "E-Mail und Passwort erforderlich" });

  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ error: "E-Mail oder Passwort falsch" });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: "E-Mail oder Passwort falsch" });

  req.session.userId = user.id;
  res.json({ id: user.id, email: user.email, displayName: user.display_name, songCredits: user.song_credits });
});

router.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/api/me", requireAuth, (req, res) => {
  const user = findUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: "Nutzer nicht gefunden" });
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    songCredits: user.song_credits,
  });
});

export default router;
