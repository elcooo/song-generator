const state = {
  users: [],
  songs: [],
  me: null,
};

const usersBody = document.getElementById("users-body");
const songsBody = document.getElementById("songs-body");
const userSearch = document.getElementById("user-search");
const songSearch = document.getElementById("song-search");
const songStatus = document.getElementById("song-status");
const toast = document.getElementById("toast");
const minimaxLog = document.getElementById("minimax-log");
const minimaxCheckBtn = document.getElementById("minimax-check-btn");
const minimaxClearBtn = document.getElementById("minimax-clear-btn");
let lastLogTs = 0;

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = String(str ?? "");
  return d.innerHTML;
}

function formatDate(ts) {
  if (!ts) return "–";
  const d = new Date(ts);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function shorten(text, max = 300) {
  const value = String(text ?? "");
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function appendLog(entry) {
  if (!minimaxLog || !entry) return;
  const line = document.createElement("div");
  line.className = "log-line";
  const payload = shorten(JSON.stringify(entry.data));
  line.textContent = `[${formatTime(entry.ts)}] ${entry.label} ${payload}`;
  minimaxLog.appendChild(line);
  minimaxLog.scrollTop = minimaxLog.scrollHeight;
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

async function loadOverview() {
  const data = await fetchJson("/api/admin/overview");
  document.getElementById("stat-users").textContent = data.users;
  document.getElementById("stat-admins").textContent = data.admins;
  document.getElementById("stat-songs").textContent = data.songs;
  document.getElementById("stat-completed").textContent = data.completed;
  document.getElementById("stat-failed").textContent = data.failed;
  document.getElementById("stat-credits").textContent = data.credits;
}

async function loadUsers() {
  state.users = await fetchJson("/api/admin/users");
  renderUsers();
}

async function loadSongs() {
  state.songs = await fetchJson("/api/admin/songs");
  renderSongs();
}

async function loadMinimaxLogs() {
  if (!minimaxLog) return;
  try {
    const logs = await fetchJson(`/api/admin/minimax/logs?since=${lastLogTs}`);
    if (logs.length === 0) return;
    logs.forEach(appendLog);
    lastLogTs = logs[logs.length - 1].ts || lastLogTs;
  } catch {
    // Ignore log polling errors
  }
}

async function runMinimaxCheck() {
  if (!minimaxCheckBtn) return;
  minimaxCheckBtn.disabled = true;
  try {
    const result = await fetchJson('/api/admin/minimax/check', { method: 'POST' });
    appendLog({ ts: Date.now(), label: 'check', data: result });
    showToast('Minimax Check abgeschlossen');
  } catch (err) {
    showToast(err.message || 'Check fehlgeschlagen');
  } finally {
    minimaxCheckBtn.disabled = false;
  }
}

function renderUsers() {
  const query = (userSearch?.value || "").toLowerCase();
  const rows = state.users.filter((u) => {
    if (!query) return true;
    return (
      String(u.email).toLowerCase().includes(query) ||
      String(u.display_name).toLowerCase().includes(query)
    );
  });

  usersBody.innerHTML = rows
    .map((u) => {
      const isSelf = state.me && u.id === state.me.id;
      const disabled = isSelf ? "disabled" : "";
      const checkboxDisabled = isSelf ? "disabled title=\"Nicht möglich\"" : "";
      return `
        <tr data-user-id="${u.id}">
          <td>${u.id}</td>
          <td>${escapeHtml(u.email)}</td>
          <td>${escapeHtml(u.display_name || "–")}</td>
          <td>
            <input class="credits-input" type="number" min="0" value="${u.song_credits}">
          </td>
          <td>
            <label class="toggle">
              <input class="admin-toggle" type="checkbox" ${u.is_admin ? "checked" : ""} ${checkboxDisabled}>
              <span>${u.is_admin ? "Ja" : "Nein"}</span>
            </label>
          </td>
          <td>${formatDate(u.created_at)}</td>
          <td>
            <div class="actions">
              <button class="btn small set-credits">Set</button>
              <button class="btn small ghost add-credits" data-delta="1">+1</button>
              <button class="btn small ghost add-credits" data-delta="-1">-1</button>
              <button class="btn small danger delete-user" ${disabled}>Löschen</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderSongs() {
  const query = (songSearch?.value || "").toLowerCase();
  const statusFilter = songStatus?.value || "";
  const rows = state.songs.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (!query) return true;
    return (
      String(s.style).toLowerCase().includes(query) ||
      String(s.user_id).includes(query)
    );
  });

  songsBody.innerHTML = rows
    .map((s) => {
      const statusText = s.status || "pending";
      const statusClass = statusText;
      const fileLink = s.file_path
        ? `<a href="/${encodeURI(s.file_path)}" target="_blank" rel="noopener">Audio</a>`
        : "–";
      return `
        <tr data-song-id="${s.id}">
          <td>${s.id}</td>
          <td>${s.user_id}</td>
          <td>${escapeHtml(s.style || "–")}</td>
          <td><span class="badge ${statusClass}">${escapeHtml(statusText)}</span></td>
          <td>${formatDate(s.created_at)}</td>
          <td>${fileLink}</td>
          <td>
            <div class="actions">
              <button class="btn small danger delete-song">Löschen</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

usersBody.addEventListener("click", async (e) => {
  const row = e.target.closest("tr");
  if (!row) return;
  const userId = row.dataset.userId;

  if (e.target.classList.contains("set-credits")) {
    const input = row.querySelector(".credits-input");
    const credits = Number(input.value);
    try {
      await fetchJson(`/api/admin/users/${userId}/credits`, {
        method: "PATCH",
        body: JSON.stringify({ credits }),
      });
      showToast("Credits aktualisiert");
      await loadOverview();
      await loadUsers();
    } catch (err) {
      showToast(err.message);
    }
  }

  if (e.target.classList.contains("add-credits")) {
    const delta = Number(e.target.dataset.delta);
    try {
      await fetchJson(`/api/admin/users/${userId}/credits`, {
        method: "PATCH",
        body: JSON.stringify({ delta }),
      });
      showToast("Credits angepasst");
      await loadOverview();
      await loadUsers();
    } catch (err) {
      showToast(err.message);
    }
  }

  if (e.target.classList.contains("delete-user")) {
    if (!confirm("Nutzer wirklich löschen? Alle Songs und Daten werden entfernt.")) return;
    try {
      await fetchJson(`/api/admin/users/${userId}`, { method: "DELETE" });
      showToast("Nutzer gelöscht");
      await loadOverview();
      await loadUsers();
      await loadSongs();
    } catch (err) {
      showToast(err.message);
    }
  }
});

usersBody.addEventListener("change", async (e) => {
  if (!e.target.classList.contains("admin-toggle")) return;
  const row = e.target.closest("tr");
  const userId = row.dataset.userId;
  const isAdmin = e.target.checked;
  try {
    await fetchJson(`/api/admin/users/${userId}/admin`, {
      method: "PATCH",
      body: JSON.stringify({ isAdmin }),
    });
    showToast("Adminstatus aktualisiert");
    await loadOverview();
    await loadUsers();
  } catch (err) {
    showToast(err.message);
    e.target.checked = !isAdmin;
  }
});

songsBody.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("delete-song")) return;
  const row = e.target.closest("tr");
  const songId = row.dataset.songId;
  if (!confirm("Song wirklich löschen?")) return;
  try {
    await fetchJson(`/api/admin/songs/${songId}`, { method: "DELETE" });
    showToast("Song gelöscht");
    await loadOverview();
    await loadSongs();
  } catch (err) {
    showToast(err.message);
  }
});

userSearch?.addEventListener("input", renderUsers);
songSearch?.addEventListener("input", renderSongs);
songStatus?.addEventListener("change", renderSongs);
minimaxCheckBtn?.addEventListener("click", runMinimaxCheck);
minimaxClearBtn?.addEventListener("click", () => {
  if (minimaxLog) minimaxLog.innerHTML = "";
  lastLogTs = 0;
});

async function init() {
  try {
    state.me = await fetchJson("/api/me");
    if (!state.me.isAdmin) {
      window.location.href = "/";
      return;
    }
    await Promise.all([loadOverview(), loadUsers(), loadSongs()]);
    await loadMinimaxLogs();
    setInterval(loadMinimaxLogs, 4000);
  } catch {
    window.location.href = "/";
  }
}

init();
