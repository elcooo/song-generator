export const LIMITS = {
  email: 254,
  passwordMin: 8,
  passwordMax: 128,
  displayName: 50,
  occasion: 80,
  recipient: 80,
  name: 80,
  details: 600,
  style: 120,
  lyrics: 8000,
};

export function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length ? email : null;
}

export function isValidEmail(email) {
  if (!email || email.length > LIMITS.email) return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export function requireText(value, max, errorMessage) {
  if (typeof value !== "string") {
    return { ok: false, error: errorMessage };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: errorMessage };
  if (trimmed.length > max) {
    return { ok: false, error: "Eingabe ist zu lang" };
  }
  return { ok: true, value: trimmed };
}

export function optionalText(value, max) {
  if (value == null) return { ok: true, value: "" };
  if (typeof value !== "string") {
    return { ok: false, error: "Ungültige Eingabe" };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: "" };
  if (trimmed.length > max) {
    return { ok: false, error: "Eingabe ist zu lang" };
  }
  return { ok: true, value: trimmed };
}

export function getPasswordError(password) {
  if (typeof password !== "string" || !password) {
    return "Passwort erforderlich";
  }
  if (password.length < LIMITS.passwordMin) {
    return `Passwort muss mindestens ${LIMITS.passwordMin} Zeichen lang sein`;
  }
  if (password.length > LIMITS.passwordMax) {
    return "Passwort ist zu lang";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Passwort muss mindestens einen Buchstaben und eine Zahl enthalten";
  }
  return null;
}
