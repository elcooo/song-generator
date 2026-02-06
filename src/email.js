import crypto from "crypto";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || "no-reply@example.com";

export function isEmailConfigured() {
  return !!RESEND_API_KEY && !!MAIL_FROM;
}

export function createVerificationToken() {
  return crypto.randomBytes(24).toString("hex");
}

export async function sendVerificationEmail({ to, token, baseUrl }) {
  if (!RESEND_API_KEY) throw new Error("Resend API key missing");
  const verifyUrl = `${baseUrl.replace(/\/$/, "")}/api/verify-email?token=${token}`;

  const payload = {
    from: MAIL_FROM,
    to,
    subject: "Confirm your email",
    text: `Please confirm your email by opening this link: ${verifyUrl}`,
    html: `<p>Please confirm your email by clicking the button below:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 18px;background:#a855f7;color:#fff;text-decoration:none;border-radius:999px;">Confirm email</a></p>
      <p>If the button doesn't work, open this link:</p>
      <p>${verifyUrl}</p>`
  };

  console.log("[email] sending verification", { to, from: MAIL_FROM, baseUrl });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log("[email] resend response", { status: res.status, body: text.slice(0, 800) });

  if (!res.ok) {
    throw new Error(`Resend error: ${res.status} ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { ok: true };
  }
}
