import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import {
  createUser,
  createOAuthUser,
  findUserByEmail,
  findUserByGoogleId,
  findUserById,
  linkGoogleToUser,
  updateUserDisplayName,
  updateUserPassword,
  deleteUser,
  getSong,
} from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { authLimiter } from "../middleware/rateLimiters.js";
import { LIMITS, normalizeEmail, isValidEmail, optionalText, getPasswordError } from "../utils/validation.js";
import db from "../db.js";

const router = Router();

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function isGoogleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

function base64Url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createCodeVerifier() {
  return base64Url(crypto.randomBytes(32));
}

function createCodeChallenge(verifier) {
  return base64Url(crypto.createHash("sha256").update(verifier).digest());
}

function normalizeNextUrl(nextUrl) {
  if (typeof nextUrl !== "string") return "/";
  if (!nextUrl.startsWith("/") || nextUrl.startsWith("//")) return "/";
  return nextUrl;
}

router.get("/api/auth/providers", (req, res) => {
  res.json({ google: isGoogleConfigured() });
});

router.get("/api/auth/google", authLimiter, (req, res) => {
  if (!isGoogleConfigured()) {
    return res.status(503).json({ error: "Google Login ist nicht konfiguriert" });
  }

  const state = base64Url(crypto.randomBytes(16));
  const verifier = createCodeVerifier();
  const challenge = createCodeChallenge(verifier);

  req.session.googleOAuthState = state;
  req.session.googleOAuthVerifier = verifier;
  req.session.oauthNext = normalizeNextUrl(req.query?.next);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  req.session.save(() => {
    res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  });
});

router.get("/api/auth/google/callback", async (req, res) => {
  if (!isGoogleConfigured()) {
    return res.redirect("/login.html?error=google_config");
  }

  if (req.query?.error) {
    return res.redirect("/login.html?error=google_denied");
  }

  const code = typeof req.query?.code === "string" ? req.query.code : "";
  const state = typeof req.query?.state === "string" ? req.query.state : "";
  if (!code || !state || state !== req.session.googleOAuthState) {
    return res.redirect("/login.html?error=google_state");
  }

  const verifier = req.session.googleOAuthVerifier;
  req.session.googleOAuthState = null;
  req.session.googleOAuthVerifier = null;

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return res.redirect("/login.html?error=google_token");
    }

    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoRes.json();
    if (!userInfoRes.ok || !userInfo?.email) {
      return res.redirect("/login.html?error=google_profile");
    }

    const email = normalizeEmail(userInfo.email);
    if (!email || !isValidEmail(email)) {
      return res.redirect("/login.html?error=google_email");
    }
    if (userInfo.email_verified === false) {
      return res.redirect("/login.html?error=google_unverified");
    }

    const googleId = userInfo.sub;
    let user = googleId ? findUserByGoogleId(googleId) : null;

    if (!user) {
      const existing = findUserByEmail(email);
      if (existing) {
        if (googleId) linkGoogleToUser(existing.id, googleId);
        user = existing;
      }
    }

    if (!user) {
      const displayName = (userInfo.name || email.split("@")[0]).trim();
      const hash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
      user = createOAuthUser(email, hash, displayName, "google", googleId || null);
    }

    const nextUrl = req.session.oauthNext || "/";
    req.session.oauthNext = null;

    req.session.regenerate((err) => {
      if (err) {
        return res.redirect("/login.html?error=google_session");
      }
      req.session.userId = user.id;
      req.session.save(() => {
        res.redirect(nextUrl);
      });
    });
  } catch (err) {
    console.error("Google auth error:", err);
    res.redirect("/login.html?error=google_unknown");
  }
});

router.post("/api/register", authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const passwordConfirm = typeof req.body?.passwordConfirm === "string" ? req.body.passwordConfirm : "";
  const displayNameInput = req.body?.displayName;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Ungültige E-Mail-Adresse" });
  }
  const passwordError = getPasswordError(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }
  if (Object.prototype.hasOwnProperty.call(req.body || {}, "passwordConfirm") && passwordConfirm !== password) {
    return res.status(400).json({ error: "Passw?rter stimmen nicht ?berein" });
  }

  const displayNameResult = optionalText(displayNameInput, LIMITS.displayName);
  if (!displayNameResult.ok) {
    return res.status(400).json({ error: displayNameResult.error });
  }
  const displayName = displayNameResult.value || email.split("@")[0];

  const existing = findUserByEmail(email);
  if (existing) return res.status(400).json({ error: "Diese E-Mail ist bereits registriert" });

  try {
    const hash = await bcrypt.hash(password, 12);
    const user = createUser(email, hash, displayName);
    
    // If user has a trial song, transfer it to their account
    const trialSongId = req.session?.trialSongId;
    if (trialSongId) {
      const trialSong = getSong(trialSongId);
      if (trialSong && trialSong.user_id === 0) {
        db.prepare("UPDATE songs SET user_id = ? WHERE id = ?").run(user.id, trialSong.id);
      }
    }

    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: "Sitzung konnte nicht erstellt werden" });
      }
      req.session.userId = user.id;
      req.session.save((saveErr) => {
        if (saveErr) {
          return res.status(500).json({ error: "Sitzung konnte nicht gespeichert werden" });
        }
        res.json({ id: user.id, email: user.email, displayName: user.displayName, songCredits: user.songCredits });
      });
    });
  } catch (err) {
    res.status(500).json({ error: "Registrierung fehlgeschlagen" });
  }
});

router.post("/api/login", authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Ungültige E-Mail-Adresse" });
  }
  if (!password) {
    return res.status(400).json({ error: "E-Mail und Passwort erforderlich" });
  }
  if (password.length > LIMITS.passwordMax) {
    return res.status(400).json({ error: "E-Mail oder Passwort falsch" });
  }

  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ error: "E-Mail oder Passwort falsch" });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: "E-Mail oder Passwort falsch" });

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: "Sitzung konnte nicht erstellt werden" });
    }
    req.session.userId = user.id;
    req.session.save((saveErr) => {
      if (saveErr) {
        return res.status(500).json({ error: "Sitzung konnte nicht gespeichert werden" });
      }
      res.json({ id: user.id, email: user.email, displayName: user.display_name, songCredits: user.song_credits });
    });
  });
});

router.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("sg.sid");
    res.json({ ok: true });
  });
});

router.get("/api/me", requireAuth, (req, res) => {
  const user = findUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: "Nutzer nicht gefunden" });
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    songCredits: user.song_credits,
    isAdmin: !!user.is_admin,
    created_at: user.created_at,
  });
});

router.patch("/api/me/name", requireAuth, async (req, res) => {
  const displayNameInput = req.body?.displayName;
  if (!displayNameInput || displayNameInput.trim().length < 2) {
    return res.status(400).json({ error: "Name muss mindestens 2 Zeichen lang sein" });
  }
  if (displayNameInput.trim().length > LIMITS.displayName) {
    return res.status(400).json({ error: "Name ist zu lang" });
  }
  
  try {
    const user = updateUserDisplayName(req.session.userId, displayNameInput.trim());
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      songCredits: user.song_credits,
    });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Aktualisieren des Namens" });
  }
});

router.patch("/api/me/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Aktuelles und neues Passwort erforderlich" });
  }
  const passwordError = getPasswordError(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError.replace("Passwort", "Neues Passwort") });
  }
  
  try {
    const user = findUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: "Nutzer nicht gefunden" });
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Aktuelles Passwort ist falsch" });
    }
    
    const hash = await bcrypt.hash(newPassword, 12);
    updateUserPassword(req.session.userId, hash);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Aktualisieren des Passworts" });
  }
});

router.delete("/api/me", requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "Passwort erforderlich" });
  }
  
  try {
    const user = findUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: "Nutzer nicht gefunden" });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Passwort ist falsch" });
    }
    
    const userId = req.session.userId;
    deleteUser(userId);
    req.session.destroy(() => {
      res.clearCookie("sg.sid");
      res.json({ ok: true });
    });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Löschen des Accounts" });
  }
});

export default router;
