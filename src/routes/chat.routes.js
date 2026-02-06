import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { wizardLimiter, trialLimiter } from "../middleware/rateLimiters.js";
import { generateFromWizard } from "../chat.js";
import { getSongCredits } from "../db.js";
import { LIMITS, requireText, optionalText } from "../utils/validation.js";

const router = Router();

// Prevent duplicate simultaneous AI calls per user
const processingFor = new Set();

router.post("/api/wizard", requireAuth, wizardLimiter, async (req, res) => {
  const userId = req.session.userId;
  const { occasion, recipient, name, details, style } = req.body;

  const occasionResult = requireText(occasion, LIMITS.occasion, "Bitte fülle alle Pflichtfelder aus");
  const recipientResult = requireText(recipient, LIMITS.recipient, "Bitte fülle alle Pflichtfelder aus");
  const nameResult = requireText(name, LIMITS.name, "Bitte fülle alle Pflichtfelder aus");
  const styleResult = requireText(style, LIMITS.style, "Bitte fülle alle Pflichtfelder aus");
  const detailsResult = optionalText(details, LIMITS.details);

  if (!occasionResult.ok || !recipientResult.ok || !nameResult.ok || !styleResult.ok) {
    return res.status(400).json({ error: "Bitte fülle alle Pflichtfelder aus" });
  }
  if (!detailsResult.ok) {
    return res.status(400).json({ error: detailsResult.error });
  }

  if (processingFor.has(userId)) {
    return res.status(429).json({ error: "Bitte warte auf die vorherige Antwort" });
  }

  processingFor.add(userId);
  try {
    const result = await generateFromWizard(userId, {
      occasion: occasionResult.value,
      recipient: recipientResult.value,
      name: nameResult.value,
      details: detailsResult.value,
      style: styleResult.value,
    });
    const credits = getSongCredits(userId);
    res.json({ ...result, songCredits: credits });
  } catch (err) {
    console.error("Wizard error:", err?.message || err);
    res.status(500).json({ error: "Lyrics-Generierung fehlgeschlagen" });
  } finally {
    processingFor.delete(userId);
  }
});

// Trial mode - wizard without authentication
router.post("/api/wizard/trial", trialLimiter, async (req, res) => {
  const { occasion, recipient, name, details, style } = req.body;

  const occasionResult = requireText(occasion, LIMITS.occasion, "Bitte fülle alle Pflichtfelder aus");
  const recipientResult = requireText(recipient, LIMITS.recipient, "Bitte fülle alle Pflichtfelder aus");
  const nameResult = requireText(name, LIMITS.name, "Bitte fülle alle Pflichtfelder aus");
  const styleResult = requireText(style, LIMITS.style, "Bitte fülle alle Pflichtfelder aus");
  const detailsResult = optionalText(details, LIMITS.details);

  if (!occasionResult.ok || !recipientResult.ok || !nameResult.ok || !styleResult.ok) {
    return res.status(400).json({ error: "Bitte fülle alle Pflichtfelder aus" });
  }
  if (!detailsResult.ok) {
    return res.status(400).json({ error: detailsResult.error });
  }

  const trialKey = "trial_" + req.sessionID;

  if (processingFor.has(trialKey)) {
    return res.status(429).json({ error: "Bitte warte auf die vorherige Antwort" });
  }

  processingFor.add(trialKey);
  try {
    const result = await generateFromWizard(0, {
      occasion: occasionResult.value,
      recipient: recipientResult.value,
      name: nameResult.value,
      details: detailsResult.value,
      style: styleResult.value,
    });
    res.json(result);
  } catch (err) {
    console.error("Trial wizard error:", err?.message || err);
    res.status(500).json({ error: "Lyrics-Generierung fehlgeschlagen" });
  } finally {
    processingFor.delete(trialKey);
  }
});

export default router;
