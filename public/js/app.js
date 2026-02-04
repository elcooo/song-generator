// ===== State =====
let currentUser = null;
let pendingLyrics = null;
let pendingStyle = null;

// ===== DOM =====
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const typingEl = document.getElementById("typing");
const creditsCount = document.getElementById("credits-count");
const lyricsContent = document.getElementById("lyrics-content");
const generateBtn = document.getElementById("generate-btn");
const progressBar = document.getElementById("progress");
const audioPlayer = document.getElementById("audio-player");
const userNameEl = document.getElementById("user-name");
const logoutBtn = document.getElementById("logout-btn");

// ===== Auth check =====
async function init() {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) { window.location.href = "/"; return; }
    currentUser = await res.json();
    userNameEl.textContent = currentUser.displayName;
    creditsCount.textContent = currentUser.songCredits;
    await loadMessages();
    setupSSE();
  } catch {
    window.location.href = "/";
  }
}

// ===== Logout =====
logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/";
});

// ===== Messages =====
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function renderMessage(msg) {
  const div = document.createElement("div");
  div.className = `message ${msg.role}`;
  div.innerHTML = `<div class="text">${escapeHtml(msg.content)}</div>
    <div class="time">${formatTime(msg.timestamp)}</div>`;
  return div;
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addMessage(role, content, timestamp) {
  const msg = { role, content, timestamp: timestamp || Date.now() };
  chatMessages.appendChild(renderMessage(msg));
  scrollToBottom();
  // Check for lyrics in assistant messages
  if (role === "assistant") extractLyrics(content);
}

async function loadMessages() {
  const res = await fetch("/api/messages");
  const messages = await res.json();
  chatMessages.innerHTML = "";
  for (const msg of messages) {
    chatMessages.appendChild(renderMessage(msg));
    if (msg.role === "assistant") extractLyrics(msg.content);
  }
  scrollToBottom();
}

// ===== Lyrics extraction =====
function extractLyrics(text) {
  const hasLyricTags = /\[(verse|chorus|bridge|outro|intro)\]/i.test(text);
  if (!hasLyricTags) return;

  const lines = text.split("\n");
  const lyricLines = [];
  let inLyrics = false;

  for (const line of lines) {
    if (/\[(verse|chorus|bridge|outro|intro)\]/i.test(line)) {
      inLyrics = true;
    }
    if (inLyrics) {
      lyricLines.push(line);
    }
  }

  if (lyricLines.length === 0) return;

  const raw = lyricLines.join("\n").trim();
  pendingLyrics = raw;

  // Render formatted lyrics
  const formatted = raw.replace(
    /\[(verse|chorus|bridge|outro|intro)\]/gi,
    (_, tag) => `<span class="tag">[${tag}]</span>`
  );
  lyricsContent.innerHTML = formatted
    .split("\n")
    .map(l => l.startsWith("<span") ? l : escapeHtml(l))
    .join("\n");
}

// ===== Chat send =====
let sending = false;

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || sending) return;

  sending = true;
  sendBtn.disabled = true;
  chatInput.value = "";
  addMessage("user", text);

  // Show typing
  typingEl.style.display = "block";
  scrollToBottom();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    typingEl.style.display = "none";
    const data = await res.json();

    if (!res.ok) {
      addMessage("assistant", data.error || "Fehler aufgetreten");
      return;
    }

    addMessage("assistant", data.content);

    // Update credits
    if (data.songCredits !== undefined) {
      creditsCount.textContent = data.songCredits;
    }

    // If AI wants to generate
    if (data.type === "generate") {
      pendingLyrics = data.lyrics;
      pendingStyle = data.style;
      generateBtn.disabled = false;

      // Render the lyrics in the panel
      extractLyrics(data.lyrics);
    }
  } catch (err) {
    typingEl.style.display = "none";
    addMessage("assistant", "Verbindungsfehler. Bitte versuche es erneut.");
  } finally {
    sending = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ===== Song generation =====
generateBtn.addEventListener("click", async () => {
  if (!pendingLyrics) return;

  const lyrics = pendingLyrics;
  const style = pendingStyle || "Pop, eingängige Melodie";

  generateBtn.disabled = true;
  progressBar.style.display = "flex";
  audioPlayer.style.display = "none";

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lyrics, style }),
    });

    const data = await res.json();

    if (!res.ok) {
      progressBar.style.display = "none";
      generateBtn.disabled = false;
      addMessage("assistant", data.error || "Generierung fehlgeschlagen");
      return;
    }

    // Update credits
    if (data.songCredits !== undefined) {
      creditsCount.textContent = data.songCredits;
    }

    // Song status will come via SSE
  } catch {
    progressBar.style.display = "none";
    generateBtn.disabled = false;
    addMessage("assistant", "Verbindungsfehler bei der Generierung.");
  }
});

// ===== SSE =====
function setupSSE() {
  const es = new EventSource("/api/events");

  es.addEventListener("song_status", (e) => {
    const data = JSON.parse(e.data);

    if (data.status === "completed" && data.filePath) {
      progressBar.style.display = "none";
      audioPlayer.src = "/" + data.filePath;
      audioPlayer.style.display = "block";
      addMessage("assistant", "🎉 Dein Song ist fertig! Drück Play, um ihn anzuhören.");
      pendingLyrics = null;
      pendingStyle = null;
    }

    if (data.status === "failed") {
      progressBar.style.display = "none";
      generateBtn.disabled = false;
      addMessage("assistant", "❌ Song-Generierung fehlgeschlagen: " + (data.error || "Unbekannter Fehler"));
    }
  });

  es.addEventListener("credits_update", (e) => {
    const data = JSON.parse(e.data);
    creditsCount.textContent = data.songCredits;
  });

  es.onerror = () => {
    console.log("SSE reconnecting...");
  };
}

// ===== Start =====
init();
