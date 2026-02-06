const noticeEl = document.getElementById("auth-notice");
const resendLink = document.getElementById("resend-link");

// Check if already logged in - redirect to app
const urlParams = new URLSearchParams(window.location.search);
const tabParam = urlParams.get("tab");
const nextParam = urlParams.get("next");
const nextUrl = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
const errorParam = urlParams.get("error");
const verifyParam = urlParams.get("verify");

function showNotice(message, type = "success") {
  if (!noticeEl) return;
  noticeEl.textContent = message;
  noticeEl.className = `notice ${type}`;
  noticeEl.style.display = "block";
}

(async function checkAuth() {
  try {
    const res = await fetch("/api/me");
    if (res.ok) {
      // User is logged in, redirect to app
      window.location.href = nextUrl;
    }
  } catch {
    // Ignore errors, just show the login form
  }
})();

// Tab switching
function switchAuthTab(tab) {
  document.querySelectorAll(".tab-bar button").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  document.getElementById("login-form").style.display = tab === "login" ? "block" : "none";
  document.getElementById("register-form").style.display = tab === "register" ? "block" : "none";
}

document.querySelectorAll(".tab-bar button").forEach(btn => {
  btn.addEventListener("click", () => switchAuthTab(btn.dataset.tab));
});

if (tabParam === "register") {
  switchAuthTab("register");
}

function showAuthError(message, target = "login") {
  const el = document.getElementById(target === "register" ? "reg-error" : "login-error");
  if (!el) return;
  el.textContent = message;
}

async function loadAuthProviders() {
  const socialLogin = document.getElementById("social-login");
  const divider = document.querySelector(".divider");
  try {
    const res = await fetch("/api/auth/providers");
    const data = await res.json();
    if (!data.google) {
      if (socialLogin) socialLogin.style.display = "none";
      if (divider) divider.style.display = "none";
      return;
    }
  } catch {
    if (socialLogin) socialLogin.style.display = "none";
    if (divider) divider.style.display = "none";
  }
}

const googleBtn = document.getElementById("google-login-btn");
if (googleBtn) {
  googleBtn.addEventListener("click", () => {
    window.location.href = `/api/auth/google?next=${encodeURIComponent(nextUrl)}`;
  });
}

if (verifyParam) {
  const verifyMap = {
    success: "Email bestaetigt. Du kannst dich jetzt anmelden.",
    expired: "Bestaetigungslink abgelaufen. Bitte fordere einen neuen an.",
    invalid: "Bestaetigungslink ist ungueltig.",
  };
  showNotice(verifyMap[verifyParam] || "Email Bestaetigung fehlgeschlagen.", verifyParam === "success" ? "success" : "error");
  switchAuthTab("login");
}

if (errorParam) {
  const errorMap = {
    google_config: "Google Login ist nicht konfiguriert.",
    google_denied: "Google Login wurde abgebrochen.",
    google_state: "Sitzung abgelaufen. Bitte erneut versuchen.",
    google_token: "Google Login fehlgeschlagen.",
    google_profile: "Google Profil konnte nicht geladen werden.",
    google_email: "Google E-Mail ist ungueltig.",
    google_unverified: "Bitte bestaetige deine Google E-Mail.",
    google_session: "Sitzung konnte nicht erstellt werden.",
    google_unknown: "Unbekannter Fehler beim Google Login.",
  };
  showAuthError(errorMap[errorParam] || "Anmeldung fehlgeschlagen.");
}

loadAuthProviders();

// Login
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("login-error");
  const btn = e.target.querySelector(".btn");
  errEl.textContent = "";
  if (resendLink) resendLink.style.display = "none";

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  btn.disabled = true;
  btn.textContent = "Wird angemeldet...";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    
    if (!res.ok) {
      errEl.textContent = data.error || "Anmeldung fehlgeschlagen";
      btn.disabled = false;
      btn.textContent = "Anmelden";
      if (data.code === "unverified" && resendLink) {
        resendLink.style.display = "block";
      }
      return;
    }
    
    window.location.href = nextUrl;
  } catch {
    errEl.textContent = "Verbindungsfehler. Bitte versuche es erneut.";
    btn.disabled = false;
    btn.textContent = "Anmelden";
  }
});

if (resendLink) {
  resendLink.addEventListener("click", async () => {
    const email = document.getElementById("login-email").value;
    if (!email) {
      showAuthError("Bitte gib deine E-Mail ein, um den Link erneut zu senden.");
      return;
    }
    resendLink.disabled = true;
    resendLink.textContent = "Sende...";
    try {
      const res = await fetch("/api/verify/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        showNotice("Bestaetigungslink gesendet. Bitte pruefe dein Postfach.", "success");
      } else {
        showNotice("E-Mail konnte nicht gesendet werden.", "error");
      }
    } catch {
      showNotice("E-Mail konnte nicht gesendet werden.", "error");
    } finally {
      resendLink.disabled = false;
      resendLink.textContent = "Bestaetigungslink erneut senden";
    }
  });
}

function getPasswordErrorClient(password) {
  if (!password) return "Passwort erforderlich";
  if (password.length < 8) return "Passwort muss mindestens 8 Zeichen lang sein";
  if (password.length > 128) return "Passwort ist zu lang";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Passwort muss mindestens einen Buchstaben und eine Zahl enthalten";
  }
  return null;
}

function getPasswordScore(password) {
  let score = 0;
  if (password.length >= 8) score += 40;
  if (password.length >= 12) score += 10;
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score += 40;
  if (/[^A-Za-z0-9]/.test(password)) score += 10;
  return Math.min(score, 100);
}

function updatePasswordStrength(password) {
  const strengthBar = document.querySelector(".strength-bar span");
  const strengthText = document.getElementById("strength-text");
  if (!strengthBar || !strengthText) return;
  const score = getPasswordScore(password);
  strengthBar.style.width = score + "%";
  if (!password) {
    strengthText.textContent = "Passwortstaerke: ?";
    return;
  }
  if (score >= 80) {
    strengthText.textContent = "Passwortstaerke: stark";
  } else if (score >= 50) {
    strengthText.textContent = "Passwortstaerke: mittel";
  } else {
    strengthText.textContent = "Passwortstaerke: schwach";
  }
}

const passwordInput = document.getElementById("reg-password");
if (passwordInput) {
  passwordInput.addEventListener("input", () => updatePasswordStrength(passwordInput.value));
  updatePasswordStrength(passwordInput.value);
}

// Register
document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("reg-error");
  const btn = e.target.querySelector(".btn");
  errEl.textContent = "";

  const displayName = document.getElementById("reg-name").value;
  const email = document.getElementById("reg-email").value;
  const password = document.getElementById("reg-password").value;
  const passwordConfirm = document.getElementById("reg-password-confirm")?.value || "";
  const termsAccepted = document.getElementById("reg-terms")?.checked;

  const passwordError = getPasswordErrorClient(password);
  if (passwordError) {
    errEl.textContent = passwordError;
    return;
  }
  if (password !== passwordConfirm) {
    errEl.textContent = "Passwoerter stimmen nicht ueberein";
    return;
  }
  if (termsAccepted === false) {
    errEl.textContent = "Bitte akzeptiere die AGB und Datenschutzerklaerung.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Wird registriert...";

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, passwordConfirm, displayName }),
    });
    const data = await res.json();
    
    if (!res.ok) {
      errEl.textContent = data.error || "Registrierung fehlgeschlagen";
      btn.disabled = false;
      btn.textContent = "Jetzt kostenlos registrieren";
      return;
    }

    showNotice("Registrierung erfolgreich. Bitte bestaetige deine E-Mail.", "success");
    switchAuthTab("login");
    const loginEmail = document.getElementById("login-email");
    if (loginEmail) loginEmail.value = email;
  } catch {
    errEl.textContent = "Verbindungsfehler. Bitte versuche es erneut.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Jetzt kostenlos registrieren";
  }
});
