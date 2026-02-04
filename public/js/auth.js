// Check if already logged in
fetch("/api/me").then(r => { if (r.ok) window.location.href = "/app.html"; });

// Tab switching
document.querySelectorAll(".tab-bar button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-bar button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("login-form").style.display = tab === "login" ? "block" : "none";
    document.getElementById("register-form").style.display = tab === "register" ? "block" : "none";
  });
});

// Login
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error; return; }
    window.location.href = "/app.html";
  } catch { errEl.textContent = "Verbindungsfehler"; }
});

// Register
document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("reg-error");
  errEl.textContent = "";

  const displayName = document.getElementById("reg-name").value;
  const email = document.getElementById("reg-email").value;
  const password = document.getElementById("reg-password").value;

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error; return; }
    window.location.href = "/app.html";
  } catch { errEl.textContent = "Verbindungsfehler"; }
});
