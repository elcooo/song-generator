import { isUserAdmin } from "../db.js";

export function requireAdmin(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Nicht angemeldet" });
  }
  if (!isUserAdmin(userId)) {
    return res.status(403).json({ error: "Nicht berechtigt" });
  }
  next();
}
