// ===== State =====
let currentUser = null;
let pendingLyrics = null;
let pendingStyle = null;
let songDetailReturnView = "home";

// ===== Wizard State =====
const WIZARD_STEPS = [
  { key: "language", label: "Sprache" },
  { key: "occasion", label: "Anlass" },
  { key: "recipient", label: "Für wen" },
  { key: "name", label: "Name" },
  { key: "details", label: "Details" },
  { key: "style", label: "Stil" },
];

let wizardData = { language: "", occasion: "", recipient: "", name: "", details: "", style: "" };
let currentStep = 0;
let exampleInterval = null;
let currentExampleIndex = 0;
const GENERATION_ESTIMATE_SEC = 250;
let generationTimer = null;
let generationStartedAt = null;
let lastProgressMessage = "Song wird generiert...";
let lastProgressPercent = 0;
const songListProgressStartTimes = new Map();
const songListProgressPercents = new Map();
let songListProgressTimer = null;
let activeGenerationSongId = null;
let generationStatusPollTimer = null;

// ===== Details Examples (rotating) =====
const DETAILS_EXAMPLES = [
  "Sie liebt Wandern und die Natur, wir kennen uns seit 10 Jahren...",
  "Er ist der beste Papa der Welt, immer für uns da...",
  "Sie hat das schönste Lächeln und liebt Musik über alles...",
  "Wir haben uns in der Schule kennengelernt, seitdem unzertrennlich...",
  "Er kocht leidenschaftlich gern und macht die besten Pasta...",
  "Sie tanzt gern und hört am liebsten 80er Musik...",
  "Er ist ein Fußball-Fan und geht jedes Wochenende zum Spiel...",
  "Sie liebt Katzen und hat drei davon zu Hause...",
  "Wir haben so viel zusammen erlebt, Reisen, Abenteuer...",
  "Er arbeitet hart für die Familie und verdient Anerkennung...",
  "Sie ist meine beste Freundin seit der Kindergartenzeit...",
  "Er hat einen tollen Humor und bringt alle zum Lachen...",
];

// ===== DOM Elements =====
const homePage = document.getElementById("home-page");
const allSongsPage = document.getElementById("all-songs-page");
const createPage = document.getElementById("create-page");
const profilePage = document.getElementById("profile-page");
const homeSongsGrid = document.getElementById("home-songs-grid");
const homeSongsEmpty = document.getElementById("home-songs-empty");
const allSongsGrid = document.getElementById("all-songs-grid");
const allSongsEmpty = document.getElementById("all-songs-empty");
const songDetailPage = document.getElementById("song-detail-page");
const songDetailTitle = document.getElementById("song-detail-title");
const songDetailMeta = document.getElementById("song-detail-meta");
const songDetailLyrics = document.getElementById("song-detail-lyrics");
const songDetailAudio = document.getElementById("song-detail-audio");
const songDetailStatus = document.getElementById("song-detail-status");
const backToSongsBtn = document.getElementById("back-to-songs-btn");
const creditsCount = document.getElementById("credits-count");
const lyricsContent = document.getElementById("lyrics-content");
const generateBtn = document.getElementById("generate-btn");
const progressBar = document.getElementById("progress");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const progressPercent = document.getElementById("progress-percent");
const audioPlayer = document.getElementById("audio-player");
const songSuccessBox = document.getElementById("song-success-box");
const playPauseBtn = document.getElementById("play-pause-btn");
const audioProgressBar = document.getElementById("audio-progress-bar");
const audioProgressFill = document.getElementById("audio-progress-fill");
const audioCurrentTime = document.getElementById("audio-current-time");
const audioDuration = document.getElementById("audio-duration");
let audioPlayerInitialized = false;
const lyricsActions = document.getElementById("lyrics-actions");
const editLyricsBtn = document.getElementById("edit-lyrics-btn");
const saveLyricsBtn = document.getElementById("save-lyrics-btn");
const cancelLyricsBtn = document.getElementById("cancel-lyrics-btn");
const lyricsEditor = document.getElementById("lyrics-editor");
const lyricsAiBox = document.getElementById("lyrics-ai-box");
const lyricsAiInput = document.getElementById("lyrics-ai-input");
const lyricsAiBtn = document.getElementById("lyrics-ai-btn");
const lyricsAiStatus = document.getElementById("lyrics-ai-status");
const adminLink = document.getElementById("admin-link");
const logoBtn = document.getElementById("logo-btn");
const userNameEl = document.getElementById("user-name");
const logoutBtn = document.getElementById("logout-btn");
const tabBtns = document.querySelectorAll(".tab-btn");
const createFirstBtn = document.getElementById("create-first-btn");
const viewAllBtn = document.getElementById("view-all-btn");
const backToHomeBtn = document.getElementById("back-to-home-btn");
const editNameBtn = document.getElementById("edit-name-btn");
const deleteAccountBtn = document.getElementById("delete-account-btn");
const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");

// Wizard DOM
const wizardStepsEl = document.querySelectorAll(".wizard-step");
const progressSteps = document.querySelectorAll(".progress-step");
const backBtn = document.getElementById("wizard-back-btn");
const nextBtn = document.getElementById("wizard-next-btn");
const stepIndicator = document.getElementById("wizard-step-indicator");
const resetWizardBtn = document.getElementById("reset-wizard-btn");
const lyricsGenerating = document.getElementById("lyrics-generating");

// ===== Utility Functions =====
function showLoading(text = "Lädt...") {
  loadingText.textContent = text;
  loadingOverlay.style.display = "flex";
}

function hideLoading() {
  loadingOverlay.style.display = "none";
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function formatLyrics(text) {
  const tagRe = /\[(verse|chorus|bridge|outro|intro)\]/i;
  let raw = (text || "").trim();

  if (tagRe.test(raw)) {
    const lines = raw.split("\n");
    const lyricLines = [];
    let inLyrics = false;

    for (let i = 0; i < lines.length; i++) {
      if (tagRe.test(lines[i])) {
        inLyrics = true;
      }
      if (inLyrics) {
        lyricLines.push(lines[i]);
      }
    }

    if (lyricLines.length > 0) {
      raw = lyricLines.join("\n").trim();
    }
  }

  const escaped = escapeHtml(raw);
  const html = escaped.replace(
    /\[(verse|chorus|bridge|outro|intro)\]/gi,
    (_, tag) => `<span class="tag">[${tag}]</span>`
  );

  return { raw, html };
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function updateGenerationProgress() {
  if (!generationStartedAt) return;
  const elapsedSec = Math.max(0, Math.floor((Date.now() - generationStartedAt) / 1000));
  const percentFallback = Math.min(99, Math.round((elapsedSec / GENERATION_ESTIMATE_SEC) * 100));
  const percent = lastProgressPercent || percentFallback;
  if (progressFill) progressFill.style.width = `${percent}%`;
  if (progressPercent) progressPercent.textContent = `${percent}%`;
  if (progressText) {
    const message = lastProgressMessage || "Song wird generiert...";
    progressText.textContent = `${message} | ${formatDuration(elapsedSec)} / ~${formatDuration(GENERATION_ESTIMATE_SEC)}`;
  }
}

function startGenerationTimer(startTime) {
  generationStartedAt = Number.isFinite(startTime) ? startTime : Date.now();
  updateGenerationProgress();
  if (generationTimer) clearInterval(generationTimer);
  generationTimer = setInterval(updateGenerationProgress, 1000);
}

function stopGenerationTimer() {
  if (generationTimer) {
    clearInterval(generationTimer);
  }
  generationTimer = null;
  generationStartedAt = null;
  lastProgressMessage = "Song wird generiert...";
  lastProgressPercent = 0;
}

function ensureSongListProgressState(song) {
  const songId = Number(song?.id);
  if (!Number.isFinite(songId)) return;
  if (!songListProgressStartTimes.has(songId)) {
    const createdAt = Number(song?.created_at);
    const startTime = Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now();
    songListProgressStartTimes.set(songId, startTime);
  }
}

function getSongListProgressMeta(songId) {
  const key = Number(songId);
  if (!Number.isFinite(key)) return "";
  const startTime = songListProgressStartTimes.get(key) || Date.now();
  const elapsedSec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
  const percentFromEvent = songListProgressPercents.get(key);
  const percent = Number.isFinite(percentFromEvent) && percentFromEvent > 0
    ? Math.min(99, Math.round(percentFromEvent))
    : Math.min(99, Math.round((elapsedSec / GENERATION_ESTIMATE_SEC) * 100));
  return `${formatDuration(elapsedSec)} / ~${formatDuration(GENERATION_ESTIMATE_SEC)} | ${percent}%`;
}

function updateSongListProgressCards() {
  const cards = document.querySelectorAll(".song-generating[data-song-id]");
  if (!cards.length) {
    if (songListProgressTimer) {
      clearInterval(songListProgressTimer);
      songListProgressTimer = null;
    }
    return;
  }

  cards.forEach(card => {
    const songId = Number(card.dataset.songId);
    if (!Number.isFinite(songId)) return;
    const metaEl = card.querySelector(".song-progress-meta");
    if (metaEl) {
      metaEl.textContent = getSongListProgressMeta(songId);
    }
  });
}

function startSongListProgressTimer() {
  if (songListProgressTimer) return;
  songListProgressTimer = setInterval(updateSongListProgressCards, 1000);
  updateSongListProgressCards();
}

function syncSongListProgressState(songs) {
  const activeIds = new Set(
    (songs || [])
      .filter(song => song.status === "generating" || song.status === "pending")
      .map(song => Number(song.id))
      .filter((id) => Number.isFinite(id))
  );

  for (const key of songListProgressStartTimes.keys()) {
    if (!activeIds.has(key)) {
      songListProgressStartTimes.delete(key);
      songListProgressPercents.delete(key);
    }
  }

  if (activeIds.size > 0) {
    startSongListProgressTimer();
  } else if (songListProgressTimer) {
    clearInterval(songListProgressTimer);
    songListProgressTimer = null;
  }
}

function syncCreateGenerationState(songs) {
  const active = (songs || []).find(song => song.status === "generating" || song.status === "pending");
  if (!active) {
    activeGenerationSongId = null;
    if (progressBar) progressBar.style.display = "none";
    stopGenerationTimer();
    stopGenerationStatusPoll();
    return;
  }

  activeGenerationSongId = Number(active.id);
  if (progressBar) progressBar.style.display = "flex";
  lastProgressMessage = "Song wird generiert...";
  lastProgressPercent = songListProgressPercents.get(activeGenerationSongId) || 0;
  startGenerationTimer(Number(active.created_at));
  startGenerationStatusPoll();
}

async function refreshCreateGenerationState() {
  try {
    const res = await fetch("/api/songs");
    if (!res.ok) return;
    const songs = await res.json();
    syncSongListProgressState(songs);
    syncCreateGenerationState(songs);
  } catch {
    // Ignore refresh errors
  }
}

async function checkGenerationStatus() {
  if (!activeGenerationSongId) {
    stopGenerationStatusPoll();
    return;
  }

  try {
    const res = await fetch(`/api/songs/${activeGenerationSongId}`);
    if (!res.ok) return;
    const song = await res.json();

    if (song.status === "completed" && song.file_path) {
      applySongCompletion(song);
    } else if (song.status === "failed") {
      applySongFailure(song);
    }
  } catch {
    // Ignore polling errors
  }
}

function startGenerationStatusPoll() {
  if (generationStatusPollTimer) return;
  generationStatusPollTimer = setInterval(checkGenerationStatus, 10000);
}

function stopGenerationStatusPoll() {
  if (generationStatusPollTimer) {
    clearInterval(generationStatusPollTimer);
  }
  generationStatusPollTimer = null;
}

function applySongCompletion(song) {
  const songId = Number(song.id);
  if (Number.isFinite(songId) && (activeGenerationSongId === null || activeGenerationSongId === songId)) {
    if (progressFill) progressFill.style.width = "100%";
    if (progressPercent) progressPercent.textContent = "100%";
    if (progressText) progressText.textContent = "Song fertig!";
    progressBar.style.display = "none";
    stopGenerationTimer();
    stopGenerationStatusPoll();
  }

  if (song.file_path) {
    audioPlayer.src = "/" + song.file_path;
  }

  if (songSuccessBox) {
    songSuccessBox.style.display = "block";
    setupCustomAudioPlayer();
  }

  pendingLyrics = null;
  pendingStyle = null;

  if (Number.isFinite(songId)) {
    songListProgressStartTimes.delete(songId);
    songListProgressPercents.delete(songId);
    updateSongListProgressCards();
    if (activeGenerationSongId === songId) {
      activeGenerationSongId = null;
    }
  }

  if (homePage.style.display !== "none") loadSongs();
}

function applySongFailure(song) {
  const songId = Number(song.id);
  if (Number.isFinite(songId) && (activeGenerationSongId === null || activeGenerationSongId === songId)) {
    progressBar.style.display = "none";
    generateBtn.disabled = false;
    stopGenerationTimer();
    stopGenerationStatusPoll();
  }

  showWizardError("Song-Generierung fehlgeschlagen: " + (song.error_message || "Unbekannter Fehler"));

  if (Number.isFinite(songId)) {
    songListProgressStartTimes.delete(songId);
    songListProgressPercents.delete(songId);
    updateSongListProgressCards();
    if (activeGenerationSongId === songId) {
      activeGenerationSongId = null;
    }
  }
}

// ===== Rotating Examples for Details =====
function startExamplesRotation() {
  const exampleText = document.getElementById("example-text");
  const detailsExamples = document.getElementById("details-examples");
  
  if (!exampleText || !detailsExamples) return;
  
  // Show the examples container
  detailsExamples.style.display = "flex";
  
  // Set initial example
  currentExampleIndex = Math.floor(Math.random() * DETAILS_EXAMPLES.length);
  exampleText.textContent = DETAILS_EXAMPLES[currentExampleIndex];
  
  // Clear any existing interval
  if (exampleInterval) clearInterval(exampleInterval);
  
  // Rotate every 2.5 seconds with fade animation
  exampleInterval = setInterval(() => {
    currentExampleIndex = (currentExampleIndex + 1) % DETAILS_EXAMPLES.length;
    
    // Fade out
    exampleText.style.opacity = "0";
    exampleText.style.transform = "translateX(10px)";
    
    setTimeout(() => {
      exampleText.textContent = DETAILS_EXAMPLES[currentExampleIndex];
      // Fade in
      exampleText.style.opacity = "1";
      exampleText.style.transform = "translateX(0)";
    }, 200);
  }, 2500);
}

function stopExamplesRotation() {
  if (exampleInterval) {
    clearInterval(exampleInterval);
    exampleInterval = null;
  }
  
  const detailsExamples = document.getElementById("details-examples");
  if (detailsExamples) {
    detailsExamples.style.display = "none";
  }
}

// ===== Smart Recipient Suggestions =====
function suggestRecipient(occasion, suggestedValue) {
  if (!suggestedValue) return;
  
  const recipientCards = document.querySelectorAll("#recipient-cards .option-card");
  
  // Remove previous suggestions
  recipientCards.forEach(card => card.classList.remove("suggested"));
  
  // Find and highlight the suggested card
  recipientCards.forEach(card => {
    if (card.dataset.value === suggestedValue) {
      card.classList.add("suggested");
    }
  });
}

function showWizardError(msg) {
  let el = document.getElementById("wizard-error");
  if (!el) {
    el = document.createElement("div");
    el.id = "wizard-error";
    el.style.cssText = "background:#fde8e8;color:#d32f2f;padding:12px 16px;border-radius:8px;margin-top:12px;font-size:0.9rem;text-align:center;border:1px solid #f5c6c6;";
    const wizardNav = document.querySelector(".wizard-nav");
    wizardNav.parentNode.insertBefore(el, wizardNav.nextSibling);
  }
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 6000);
}

function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function formatSongDate(ts) {
  return new Date(ts).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

// ===== Tab Navigation =====
function switchTab(tab) {
  tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));

  // Hide all pages
  homePage.style.display = "none";
  allSongsPage.style.display = "none";
  if (songDetailPage) songDetailPage.style.display = "none";
  createPage.style.display = "none";
  profilePage.style.display = "none";

  if (tab === "home") {
    homePage.style.display = "";
    loadSongs();
  } else if (tab === "create") {
    createPage.style.display = "flex";
    refreshCreateGenerationState();
  } else if (tab === "profile") {
    profilePage.style.display = "";
    loadProfile();
  }
}

tabBtns.forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

if (logoBtn) {
  logoBtn.addEventListener("click", () => switchTab("home"));
}

if (createFirstBtn) {
  createFirstBtn.addEventListener("click", () => switchTab("create"));
}

// ===== Auth Check =====
async function init() {
  try {
    showLoading("Lade Benutzerdaten...");
    const res = await fetch("/api/me");
    if (!res.ok) {
      // Not authenticated, redirect to trial page
      window.location.href = "/trial.html";
      return;
    }
    currentUser = await res.json();

    userNameEl.textContent = currentUser.displayName;
    creditsCount.textContent = currentUser.songCredits;
    if (adminLink && currentUser.isAdmin) {
      adminLink.style.display = "inline-flex";
    }

    const welcomeName = document.getElementById("welcome-name");
    if (welcomeName) welcomeName.textContent = currentUser.displayName;

    const songsCreditsStatEl = document.getElementById("songs-credits-stat");
    if (songsCreditsStatEl) songsCreditsStatEl.textContent = currentUser.songCredits;

    setupSSE();
    await loadSongs();
    hideLoading();
  } catch (err) {
    console.error("Init error:", err);
    hideLoading();
    // Show error message instead of redirecting
    alert("Fehler beim Laden der App. Bitte Seite neu laden.");
  }
}

// ===== Home Page =====
async function loadSongs() {
  try {
    const res = await fetch("/api/songs");
    const songs = await res.json();

    if (songs.length === 0) {
      homeSongsGrid.style.display = "none";
      homeSongsEmpty.style.display = "flex";
    } else {
      homeSongsGrid.style.display = "";
      homeSongsEmpty.style.display = "none";
      homeSongsGrid.innerHTML = "";

      // Show only recent 6 songs on home page
      const recentSongs = songs.slice(0, 6);
      for (const song of recentSongs) {
        homeSongsGrid.appendChild(renderSongCard(song, false));
      }
    }

    // Update stats (count only completed songs)
    const totalSongsEl = document.getElementById("total-songs");
    if (totalSongsEl) {
      const completedCount = songs.filter(s => s.status === "completed").length;
      totalSongsEl.textContent = completedCount;
    }

    syncSongListProgressState(songs);
    syncCreateGenerationState(songs);
  } catch {
    homeSongsGrid.innerHTML = '<p class="songs-error">Fehler beim Laden der Songs</p>';
  }
}

function renderSongCard(song, showActions = false) {
  const card = document.createElement("div");
  card.className = "song-card";
  card.dataset.songId = song.id;

  const statusLabel = {
    completed: "Fertig",
    generating: "Wird generiert...",
    pending: "Wartend...",
    failed: "Fehlgeschlagen",
  };

  const date = new Date(song.created_at).toLocaleDateString("de-DE", {
    day: "2-digit", month: "short", year: "numeric"
  });

  const styleLine = song.style ? `<span class="song-style">${escapeHtml(song.style)}</span>` : "";

  let playerHtml = "";
  if (song.status === "completed" && song.file_path) {
    playerHtml = `<audio controls preload="none" src="/${song.file_path}"></audio>`;
  } else if (song.status === "generating" || song.status === "pending") {
    ensureSongListProgressState(song);
    const progressMeta = getSongListProgressMeta(song.id);
    playerHtml = `
      <div class="song-generating" data-song-id="${song.id}">
        <div class="spinner"></div>
        <div class="song-progress-text">
          <span class="song-progress-label">${statusLabel[song.status]}</span>
          <span class="song-progress-meta">${progressMeta}</span>
        </div>
      </div>`;
  } else if (song.status === "failed") {
    let errorText = song.error_message || "";
    if (errorText.length > 90) errorText = errorText.slice(0, 87) + "...";
    const errorDetail = errorText ? `<div class="song-error">${escapeHtml(errorText)}</div>` : "";
    playerHtml = `<span class="song-failed">${statusLabel.failed}</span>${errorDetail}`;
  }

  const lyricsPreview = song.lyrics
    ? song.lyrics.replace(/\[(verse|chorus|bridge|outro|intro)\]/gi, "").trim().split("\n").slice(0, 2).join(" / ")
    : "";

  let actionsHtml = "";
  const shouldShowActions = showActions || song.status === "failed";
  if (shouldShowActions && song.status === "completed") {
    actionsHtml = `
      <div class="song-card-actions">
        <button type="button" class="song-action-btn download-song" data-song-id="${song.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          Download
        </button>
        <button type="button" class="song-action-btn delete delete-song" data-song-id="${song.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Löschen
        </button>
      </div>`;
  } else if (shouldShowActions && song.status === "failed") {
    actionsHtml = `
      <div class="song-card-actions">
        <button type="button" class="song-action-btn retry-song" data-song-id="${song.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
          Erneut
        </button>
        <button type="button" class="song-action-btn delete delete-song" data-song-id="${song.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Löschen
        </button>
      </div>`;
  }

  card.innerHTML = `
    <div class="song-card-header">
      <svg class="song-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
      <div class="song-meta">
        <span class="song-date">${date}</span>
        ${styleLine}
      </div>
    </div>
    <p class="song-lyrics-preview">${escapeHtml(lyricsPreview)}</p>
    <div class="song-player">${playerHtml}</div>
    ${actionsHtml}
  `;

  // Add event listeners for actions
  if (shouldShowActions) {
    const downloadBtn = card.querySelector(".download-song");
    const deleteBtn = card.querySelector(".delete-song");
    const retryBtn = card.querySelector(".retry-song");

    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => downloadSong(song));
    }
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => deleteSong(song.id));
    }
    if (retryBtn) {
      retryBtn.addEventListener("click", () => retrySong(song.id));
    }
  }

  if (song.status === "completed") {
    card.classList.add("clickable");
    card.addEventListener("click", (e) => {
      if (e.target.closest("button, a, audio, .song-card-actions, .song-player")) {
        return;
      }
      openSongDetail(song);
    });
  }

  return card;
}

function openSongDetail(song) {
  if (!songDetailPage) return;

  songDetailReturnView = allSongsPage.style.display !== "none" ? "all" : "home";

  homePage.style.display = "none";
  allSongsPage.style.display = "none";
  createPage.style.display = "none";
  profilePage.style.display = "none";
  songDetailPage.style.display = "";

  if (songDetailTitle) songDetailTitle.textContent = "Song Details";

  const dateText = song.created_at ? formatSongDate(song.created_at) : "";
  const styleText = song.style || "Unbekannter Stil";
  if (songDetailMeta) {
    songDetailMeta.textContent = dateText ? `${dateText} · ${styleText}` : styleText;
  }

  if (songDetailLyrics) {
    const { html } = formatLyrics(song.lyrics || "");
    songDetailLyrics.classList.remove("has-lyrics");
    songDetailLyrics.innerHTML = html || "<p class=\"placeholder\">Keine Lyrics verfügbar.</p>";
    requestAnimationFrame(() => {
      songDetailLyrics.classList.add("has-lyrics");
    });
    songDetailLyrics.scrollTop = 0;
  }

  if (songDetailAudio) {
    if (song.status === "completed" && song.file_path) {
      songDetailAudio.src = "/" + song.file_path;
      songDetailAudio.style.display = "block";
      songDetailAudio.load();
      if (songDetailStatus) songDetailStatus.textContent = "";
    } else {
      songDetailAudio.removeAttribute("src");
      songDetailAudio.style.display = "none";
      if (songDetailStatus) {
        songDetailStatus.textContent = "Audio ist noch nicht verfügbar.";
      }
    }
  }
}

// ===== All Songs Page =====
if (viewAllBtn) {
  viewAllBtn.addEventListener("click", () => {
    showAllSongs();
  });
}

if (backToHomeBtn) {
  backToHomeBtn.addEventListener("click", () => {
    allSongsPage.style.display = "none";
    homePage.style.display = "";
  });
}

if (backToSongsBtn) {
  backToSongsBtn.addEventListener("click", () => {
    if (songDetailPage) songDetailPage.style.display = "none";
    if (songDetailReturnView === "all") {
      showAllSongs();
    } else {
      homePage.style.display = "";
      loadSongs();
    }
  });
}

async function showAllSongs() {
  try {
    homePage.style.display = "none";
    allSongsPage.style.display = "";

    showLoading("Lade Songs...");
    const res = await fetch("/api/songs");
    const songs = await res.json();
    hideLoading();

    if (songs.length === 0) {
      allSongsGrid.style.display = "none";
      allSongsEmpty.style.display = "flex";
    } else {
      allSongsGrid.style.display = "";
      allSongsEmpty.style.display = "none";
      allSongsGrid.innerHTML = "";

      for (const song of songs) {
        allSongsGrid.appendChild(renderSongCard(song, true));
      }
    }

    syncSongListProgressState(songs);
    syncCreateGenerationState(songs);
  } catch {
    allSongsGrid.innerHTML = '<p class="songs-error">Fehler beim Laden der Songs</p>';
    hideLoading();
  }
}

// ===== Song Actions =====
function downloadSong(song) {
  if (song.file_path) {
    const a = document.createElement("a");
    a.href = "/" + song.file_path;
    a.download = `song-${song.id}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

async function deleteSong(songId) {
  if (!confirm("Möchtest du diesen Song wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) {
    return;
  }

  try {
    showLoading("Lösche Song...");
    const res = await fetch(`/api/songs/${songId}`, { method: "DELETE" });
    hideLoading();

    if (res.ok) {
      // Remove from DOM
      const card = document.querySelector(`[data-song-id="${songId}"]`);
      if (card) card.remove();

      // Reload songs to update counts
      await loadSongs();
    } else {
      alert("Fehler beim Löschen des Songs.");
    }
  } catch {
    hideLoading();
    alert("Verbindungsfehler beim Löschen des Songs.");
  }
}

async function retrySong(songId) {
  if (!confirm("Moechtest du den Song erneut generieren?")) {
    return;
  }

  try {
    showLoading("Starte erneut...");
    const res = await fetch(`/api/songs/${songId}/retry`, { method: "POST" });
    const data = await res.json();
    hideLoading();

    if (!res.ok) {
      alert(data.error || "Erneute Generierung fehlgeschlagen.");
      return;
    }

    if (data.songCredits !== undefined) {
      creditsCount.textContent = data.songCredits;
    }

    await loadSongs();
    if (allSongsPage.style.display !== "none") {
      await showAllSongs();
    }
  } catch {
    hideLoading();
    alert("Verbindungsfehler bei der erneuten Generierung.");
  }
}


// ===== Wizard =====
function updateStepSelections() {
  // Update the step-selection elements to show user's choices
    const selectionMap = {
    language: wizardData.language,
    occasion: wizardData.occasion,
    recipient: wizardData.recipient,
    name: wizardData.name,
    details: wizardData.details ? "✓" : "",
    style: wizardData.style,
  };

  document.querySelectorAll(".step-selection").forEach(el => {
    const key = el.dataset.selection;
    const value = selectionMap[key];
    const parentStep = el.closest(".progress-step");
    
    if (value) {
      // Truncate long values
      el.textContent = value.length > 12 ? value.substring(0, 11) + "…" : value;
      parentStep.classList.add("has-selection");
    } else {
      el.textContent = "";
      parentStep.classList.remove("has-selection");
    }
  });
}

function goToStep(step) {
  currentStep = step;

  // Show/hide step panels
  wizardStepsEl.forEach(el => {
    el.classList.toggle("active", parseInt(el.dataset.step) === step);
  });

  // Update progress indicators
  progressSteps.forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.toggle("active", s === step);
    el.classList.toggle("completed", s < step);
  });

  // Update step selections display
  updateStepSelections();

  // Back button visibility
  backBtn.style.visibility = step === 0 ? "hidden" : "visible";

  // Next button text
  if (step === WIZARD_STEPS.length - 1) {
    nextBtn.innerHTML = `Lyrics erstellen <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  } else {
    nextBtn.innerHTML = `Weiter <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  }

  // Step indicator text
  stepIndicator.textContent = `Schritt ${step + 1} von ${WIZARD_STEPS.length}`;

  // Enable/disable next based on current step value
  updateNextButton();

    // Handle rotating examples for details step
  const stepKey = WIZARD_STEPS[step]?.key;
  if (stepKey === "details") {
    // Details step - start rotating examples if no details entered
    if (!wizardData.details) {
      startExamplesRotation();
    }
  } else {
    stopExamplesRotation();
  }

  // If going back after lyrics were generated, clear them
  if (pendingLyrics) {
    pendingLyrics = null;
    pendingStyle = null;
    generateBtn.disabled = true;
    lyricsContent.innerHTML = '<p class="placeholder">Deine Lyrics erscheinen hier, sobald die KI sie erstellt hat.</p>';
    if (songSuccessBox) songSuccessBox.style.display = "none";
    progressBar.style.display = "none";
  }
}

function updateNextButton() {
  const key = WIZARD_STEPS[currentStep].key;
  const value = wizardData[key];

  // Details step is optional
  if (key === "details") {
    nextBtn.disabled = false;
  } else {
    nextBtn.disabled = !value;
  }
}

function handleNextStep() {
  if (currentStep < WIZARD_STEPS.length - 1) {
    goToStep(currentStep + 1);
  } else {
    generateLyrics();
  }
}

function handleBackStep() {
  if (currentStep > 0) {
    goToStep(currentStep - 1);
  }
}

async function generateLyrics() {
  nextBtn.disabled = true;
  lyricsGenerating.style.display = "flex";

  try {
    const res = await fetch("/api/wizard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wizardData),
    });

    const data = await res.json();
    lyricsGenerating.style.display = "none";

    if (!res.ok) {
      showWizardError(data.error || "Lyrics-Generierung fehlgeschlagen");
      nextBtn.disabled = false;
      return;
    }

    // Set pending data for song generation
    pendingLyrics = data.lyrics;
    pendingStyle = data.style;
    generateBtn.disabled = false;

    // Display lyrics in the panel
    displayLyrics(data.lyrics);

    if (data.songCredits !== undefined) {
      creditsCount.textContent = data.songCredits;
    }
  } catch {
    lyricsGenerating.style.display = "none";
    nextBtn.disabled = false;
    showWizardError("Verbindungsfehler. Bitte versuche es erneut.");
  }
}

function resetWizard() {
  wizardData = { occasion: "", recipient: "", name: "", details: "", style: "" };
  currentStep = 0;

  // Clear all option selections and suggestions
  document.querySelectorAll(".option-card.selected").forEach(c => c.classList.remove("selected"));
  document.querySelectorAll(".option-card.suggested").forEach(c => c.classList.remove("suggested"));

  // Clear all inputs
  document.querySelectorAll(".custom-input").forEach(input => { input.value = ""; });
  const nameInput = document.getElementById("name-input");
  const detailsInput = document.getElementById("details-input");
  if (nameInput) nameInput.value = "";
  if (detailsInput) detailsInput.value = "";

  // Clear step selections
  document.querySelectorAll(".progress-step").forEach(step => {
    step.classList.remove("has-selection");
    const selection = step.querySelector(".step-selection");
    if (selection) selection.textContent = "";
  });

  // Stop examples rotation
  stopExamplesRotation();

  // Reset lyrics panel
  pendingLyrics = null;
  pendingStyle = null;
  generateBtn.disabled = true;
  lyricsContent.innerHTML = '<p class="placeholder">Deine Lyrics erscheinen hier, sobald die KI sie erstellt hat.</p>';
  if (lyricsActions) lyricsActions.style.display = "none";
  if (lyricsAiBox) lyricsAiBox.style.display = "none";
  if (lyricsEditor) lyricsEditor.style.display = "none";
  if (lyricsContent) lyricsContent.style.display = "block";

  // Hide custom player
  if (songSuccessBox) songSuccessBox.style.display = "none";
  progressBar.style.display = "none";

  goToStep(0);
}

// Option card clicks (event delegation) — auto-advance on click
document.querySelectorAll(".option-cards").forEach(container => {
  container.addEventListener("click", (e) => {
    const card = e.target.closest(".option-card");
    if (!card) return;

    const step = card.closest(".wizard-step");
    const stepIndex = parseInt(step.dataset.step);
    const stepKey = WIZARD_STEPS[stepIndex].key;

    // Deselect all in this group
    container.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));
    card.classList.add("selected");

    // Clear custom input for this step
    const customInput = step.querySelector(".custom-input");
    if (customInput) customInput.value = "";

    wizardData[stepKey] = card.dataset.value;
    updateStepSelections();

    // If occasion selected, suggest a recipient
    if (stepKey === "occasion" && card.dataset.suggestRecipient) {
      suggestRecipient(card.dataset.value, card.dataset.suggestRecipient);
    }

    // If recipient selected, remove suggestions styling
    if (stepKey === "recipient") {
      document.querySelectorAll("#recipient-cards .option-card").forEach(c => c.classList.remove("suggested"));
    }

    // Auto-advance to next step after a brief visual delay
    setTimeout(() => handleNextStep(), 250);
  });
});

// Custom input handling
document.querySelectorAll(".custom-input").forEach(input => {
  input.addEventListener("input", () => {
    const step = input.closest(".wizard-step");
    const stepIndex = parseInt(step.dataset.step);
    const stepKey = WIZARD_STEPS[stepIndex].key;

    // Deselect option cards
    step.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));

    wizardData[stepKey] = input.value.trim();
    updateNextButton();
    updateStepSelections();
  });

  // Allow pressing Enter to advance
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !nextBtn.disabled) {
      e.preventDefault();
      handleNextStep();
    }
  });
});

// Name input
const nameInput = document.getElementById("name-input");
if (nameInput) {
  nameInput.addEventListener("input", () => {
    wizardData.name = nameInput.value.trim();
    updateNextButton();
    updateStepSelections();
  });
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !nextBtn.disabled) {
      e.preventDefault();
      handleNextStep();
    }
  });
}

// Details textarea (optional)
const detailsInput = document.getElementById("details-input");
if (detailsInput) {
  detailsInput.addEventListener("input", () => {
    wizardData.details = detailsInput.value.trim();
    updateStepSelections();
    
    // Stop rotating examples when user starts typing
    if (wizardData.details.length > 0) {
      stopExamplesRotation();
    } else {
      startExamplesRotation();
    }
    // Details are optional, next is always enabled
  });
  
  // Focus handler - show examples if empty
  detailsInput.addEventListener("focus", () => {
    if (!wizardData.details) {
      startExamplesRotation();
    }
  });
}

// Navigation buttons
nextBtn.addEventListener("click", handleNextStep);
backBtn.addEventListener("click", handleBackStep);

resetWizardBtn.addEventListener("click", () => {
  if (wizardData.language || wizardData.occasion || wizardData.recipient || wizardData.name || wizardData.details || wizardData.style) {
    if (!confirm("Möchtest du wirklich neu starten? Alle Eingaben werden gelöscht.")) {
      return;
    }
  }
  resetWizard();
});

// ===== Lyrics Display =====
function displayLyrics(text) {
  const { raw, html } = formatLyrics(text);
  pendingLyrics = raw;
  
  // Add animation class
  lyricsContent.classList.remove("has-lyrics");

  lyricsContent.innerHTML = html;

  // Show action buttons
  if (lyricsActions) lyricsActions.style.display = "flex";
  if (lyricsAiBox) lyricsAiBox.style.display = "flex";
  exitEditMode();

  // Trigger animation
  requestAnimationFrame(() => {
    lyricsContent.classList.add("has-lyrics");
  });
}

// ===== Lyrics Editing =====
function enterEditMode() {
  if (!pendingLyrics) return;
  lyricsEditor.value = pendingLyrics;
  lyricsContent.style.display = "none";
  lyricsEditor.style.display = "block";
  editLyricsBtn.style.display = "none";
  saveLyricsBtn.style.display = "inline-flex";
  cancelLyricsBtn.style.display = "inline-flex";
  lyricsEditor.focus();
}

function exitEditMode() {
  lyricsEditor.style.display = "none";
  lyricsContent.style.display = "block";
  editLyricsBtn.style.display = "inline-flex";
  saveLyricsBtn.style.display = "none";
  cancelLyricsBtn.style.display = "none";
}

function saveManualEdits() {
  const edited = lyricsEditor.value.trim();
  if (edited) {
    displayLyrics(edited);
  }
  exitEditMode();
}

if (editLyricsBtn) editLyricsBtn.addEventListener("click", enterEditMode);
if (cancelLyricsBtn) cancelLyricsBtn.addEventListener("click", () => { exitEditMode(); });
if (saveLyricsBtn) saveLyricsBtn.addEventListener("click", saveManualEdits);

// AI lyrics editing
if (lyricsAiBtn) {
  lyricsAiBtn.addEventListener("click", requestAiEdit);
}
if (lyricsAiInput) {
  lyricsAiInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") requestAiEdit();
  });
}

async function requestAiEdit() {
  const prompt = lyricsAiInput.value.trim();
  if (!prompt || !pendingLyrics) return;

  lyricsAiBtn.disabled = true;
  lyricsAiInput.disabled = true;
  lyricsAiStatus.textContent = "AI bearbeitet Lyrics...";
  lyricsAiStatus.className = "lyrics-ai-status loading";

  try {
    const res = await fetch("/api/lyrics/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lyrics: pendingLyrics, prompt, style: pendingStyle }),
    });
    const data = await res.json();

    if (!res.ok) {
      lyricsAiStatus.textContent = data.error || "Bearbeitung fehlgeschlagen";
      lyricsAiStatus.className = "lyrics-ai-status error";
      return;
    }

    displayLyrics(data.lyrics);
    lyricsAiInput.value = "";
    lyricsAiStatus.textContent = "Lyrics aktualisiert!";
    lyricsAiStatus.className = "lyrics-ai-status success";
    setTimeout(() => { lyricsAiStatus.textContent = ""; }, 3000);
  } catch {
    lyricsAiStatus.textContent = "Verbindungsfehler";
    lyricsAiStatus.className = "lyrics-ai-status error";
  } finally {
    lyricsAiBtn.disabled = false;
    lyricsAiInput.disabled = false;
  }
}

// ===== Song Generation =====
generateBtn.addEventListener("click", async () => {
  if (!pendingLyrics) return;

  const lyrics = pendingLyrics;
  const style = pendingStyle || "Pop, eingängige Melodie";

  generateBtn.disabled = true;
  progressBar.style.display = "flex";
  lastProgressMessage = "Song wird generiert...";
  lastProgressPercent = 0;
  if (progressFill) progressFill.style.width = "0%";
  if (progressPercent) progressPercent.textContent = "0%";
  startGenerationTimer();
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
      stopGenerationTimer();
      showWizardError(data.error || "Generierung fehlgeschlagen");
      return;
    }

    if (data.songCredits !== undefined) {
      creditsCount.textContent = data.songCredits;
    }

    if (data.songId) {
      activeGenerationSongId = Number(data.songId);
      if (!songListProgressStartTimes.has(activeGenerationSongId)) {
        songListProgressStartTimes.set(activeGenerationSongId, Date.now());
      }
    }
    startGenerationStatusPoll();
  } catch {
    progressBar.style.display = "none";
    generateBtn.disabled = false;
    stopGenerationTimer();
    showWizardError("Verbindungsfehler bei der Generierung.");
  }
});

// ===== SSE =====
function setupSSE() {
  const es = new EventSource("/api/events");

  es.addEventListener("song_status", (e) => {
    const data = JSON.parse(e.data);
    const songId = Number(data.songId);

    if (data.status === "completed" && data.filePath) {
      applySongCompletion({ id: songId, file_path: data.filePath, lyrics: pendingLyrics });
    } else if (data.status === "failed") {
      applySongFailure({ id: songId, error_message: data.error });
    }
  });

  es.addEventListener("song_progress", (e) => {
    const data = JSON.parse(e.data);
    if (!generationStartedAt) startGenerationTimer();
    lastProgressPercent = data.percent || 0;
    lastProgressMessage = data.message || "Song wird generiert...";
    updateGenerationProgress();

    const songId = Number(data.songId);
    if (Number.isFinite(songId)) {
      if (!songListProgressStartTimes.has(songId)) {
        songListProgressStartTimes.set(songId, Date.now());
      }
      if (typeof data.percent === "number") {
        songListProgressPercents.set(songId, data.percent);
      }
      updateSongListProgressCards();
      startSongListProgressTimer();

      if (activeGenerationSongId === songId) {
        lastProgressPercent = data.percent || lastProgressPercent;
        lastProgressMessage = data.message || lastProgressMessage;
      }
    }
  });

  es.addEventListener("credits_update", (e) => {
    const data = JSON.parse(e.data);
    creditsCount.textContent = data.songCredits;

    const songsCreditsStatEl = document.getElementById("songs-credits-stat");
    if (songsCreditsStatEl) songsCreditsStatEl.textContent = data.songCredits;

    const profileCreditsEl = document.getElementById("profile-credits");
    if (profileCreditsEl) profileCreditsEl.textContent = data.songCredits;
  });

  es.onerror = () => {
    console.log("SSE reconnecting...");
  };
}

// ===== Profile Page =====
async function loadProfile() {
  if (!currentUser) return;

  // Profile header
  const profileNameEl = document.getElementById("profile-name");
  const profileEmailEl = document.getElementById("profile-email");
  if (profileNameEl) profileNameEl.textContent = currentUser.displayName || "–";
  if (profileEmailEl) profileEmailEl.textContent = currentUser.email || "–";

  // Settings card
  const currentNameEl = document.getElementById("current-name");
  const currentEmailEl = document.getElementById("current-email");
  const profileCreditsEl = document.getElementById("profile-credits");
  if (currentNameEl) currentNameEl.textContent = currentUser.displayName || "–";
  if (currentEmailEl) currentEmailEl.textContent = currentUser.email || "–";
  if (profileCreditsEl) profileCreditsEl.textContent = currentUser.songCredits || "0";

  // Stats
  try {
    const res = await fetch("/api/songs");
    if (res.ok) {
      const songs = await res.json();
      const totalSongsEl = document.getElementById("profile-total-songs");
      if (totalSongsEl) {
        const completedCount = songs.filter(s => s.status === "completed").length;
        totalSongsEl.textContent = completedCount;
      }
    }
  } catch {
    const totalSongsEl = document.getElementById("profile-total-songs");
    if (totalSongsEl) totalSongsEl.textContent = "–";
  }

  // Member since
  if (currentUser.created_at) {
    const joinedDate = new Date(currentUser.created_at).toLocaleDateString("de-DE", {
      month: "long",
      year: "numeric"
    });
    const memberSinceEl = document.getElementById("profile-member-since");
    if (memberSinceEl) memberSinceEl.textContent = joinedDate;
  } else {
    const memberSinceEl = document.getElementById("profile-member-since");
    if (memberSinceEl) memberSinceEl.textContent = "–";
  }
}

// ===== Edit Name =====
const editNameModal = document.getElementById("edit-name-modal");
const editNameForm = document.getElementById("edit-name-form");
const newNameInput = document.getElementById("new-name");
const editNameMessage = document.getElementById("edit-name-message");
const cancelEditName = document.getElementById("cancel-edit-name");

if (editNameBtn) {
  editNameBtn.addEventListener("click", () => {
    newNameInput.value = currentUser.displayName;
    editNameMessage.style.display = "none";
    editNameModal.style.display = "flex";
  });
}

if (cancelEditName) {
  cancelEditName.addEventListener("click", () => {
    editNameModal.style.display = "none";
  });
}

if (editNameForm) {
  editNameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newName = newNameInput.value.trim();

    if (newName.length < 2) {
      editNameMessage.textContent = "Name muss mindestens 2 Zeichen lang sein";
      editNameMessage.className = "form-message error";
      return;
    }

    try {
      showLoading("Aktualisiere Name...");
      const res = await fetch("/api/me/name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: newName }),
      });
      hideLoading();

      if (res.ok) {
        const data = await res.json();
        currentUser.displayName = data.displayName;
        userNameEl.textContent = data.displayName;

        const welcomeName = document.getElementById("welcome-name");
        if (welcomeName) welcomeName.textContent = data.displayName;

        editNameMessage.textContent = "Name erfolgreich aktualisiert!";
        editNameMessage.className = "form-message success";

        setTimeout(() => {
          editNameModal.style.display = "none";
          loadProfile();
        }, 1500);
      } else {
        const data = await res.json();
        editNameMessage.textContent = data.error || "Fehler beim Aktualisieren";
        editNameMessage.className = "form-message error";
      }
    } catch {
      hideLoading();
      editNameMessage.textContent = "Verbindungsfehler";
      editNameMessage.className = "form-message error";
    }
  });
}

// ===== Password Change =====
const passwordForm = document.getElementById("password-form");
const passwordMessage = document.getElementById("password-message");

if (passwordForm) {
  passwordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;

    if (newPassword.length < 8) {
      passwordMessage.textContent = "Neues Passwort muss mindestens 8 Zeichen lang sein";
      passwordMessage.className = "form-message error";
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      passwordMessage.textContent = "Neues Passwort muss mindestens einen Buchstaben und eine Zahl enthalten";
      passwordMessage.className = "form-message error";
      return;
    }

    try {
      showLoading("Aktualisiere Passwort...");
      const res = await fetch("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      hideLoading();

      if (res.ok) {
        passwordMessage.textContent = "Passwort erfolgreich aktualisiert!";
        passwordMessage.className = "form-message success";
        passwordForm.reset();

        setTimeout(() => {
          passwordMessage.style.display = "none";
        }, 3000);
      } else {
        const data = await res.json();
        passwordMessage.textContent = data.error || "Fehler beim Aktualisieren";
        passwordMessage.className = "form-message error";
      }
    } catch {
      hideLoading();
      passwordMessage.textContent = "Verbindungsfehler";
      passwordMessage.className = "form-message error";
    }
  });
}

// ===== Delete Account =====
const deleteAccountModal = document.getElementById("delete-account-modal");
const deleteAccountForm = document.getElementById("delete-account-form");
const deletePasswordInput = document.getElementById("delete-password");
const deleteAccountMessage = document.getElementById("delete-account-message");
const cancelDeleteAccount = document.getElementById("cancel-delete-account");

if (deleteAccountBtn) {
  deleteAccountBtn.addEventListener("click", () => {
    deletePasswordInput.value = "";
    deleteAccountMessage.style.display = "none";
    deleteAccountModal.style.display = "flex";
  });
}

if (cancelDeleteAccount) {
  cancelDeleteAccount.addEventListener("click", () => {
    deleteAccountModal.style.display = "none";
  });
}

if (deleteAccountForm) {
  deleteAccountForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = deletePasswordInput.value;

    if (!confirm("Letzte Warnung: Bist du absolut sicher? Alle Daten werden unwiderruflich gelöscht!")) {
      return;
    }

    try {
      showLoading("Lösche Account...");
      const res = await fetch("/api/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      hideLoading();

      if (res.ok) {
        alert("Dein Account wurde gelöscht. Du wirst zur Startseite weitergeleitet.");
        window.location.href = "/";
      } else {
        const data = await res.json();
        deleteAccountMessage.textContent = data.error || "Fehler beim Löschen";
        deleteAccountMessage.className = "form-message error";
      }
    } catch {
      hideLoading();
      deleteAccountMessage.textContent = "Verbindungsfehler";
      deleteAccountMessage.className = "form-message error";
    }
  });
}

// ===== Logout =====
logoutBtn.addEventListener("click", async () => {
  showLoading("Abmelden...");
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/landing.html";
});

// ===== Custom Audio Player =====
function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function setupCustomAudioPlayer() {
  if (!audioPlayer || !playPauseBtn) return;

  const playIcon = playPauseBtn.querySelector(".play-icon");
  const pauseIcon = playPauseBtn.querySelector(".pause-icon");

  const resetPlayerUi = () => {
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
    }
    if (audioProgressFill) audioProgressFill.style.width = "0%";
    if (audioCurrentTime) audioCurrentTime.textContent = "0:00";
    if (audioDuration) audioDuration.textContent = "0:00";
    if (playIcon) playIcon.style.display = "block";
    if (pauseIcon) pauseIcon.style.display = "none";
  };

  resetPlayerUi();

  if (audioPlayerInitialized) return;
  audioPlayerInitialized = true;

  // Update duration when metadata is loaded
  audioPlayer.addEventListener("loadedmetadata", () => {
    if (audioDuration && isFinite(audioPlayer.duration)) {
      audioDuration.textContent = formatTime(audioPlayer.duration);
    }
  });

  // Update progress as audio plays
  audioPlayer.addEventListener("timeupdate", () => {
    if (!audioProgressFill || !audioCurrentTime) return;
    if (!isFinite(audioPlayer.duration) || audioPlayer.duration <= 0) return;
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    audioProgressFill.style.width = `${progress}%`;
    audioCurrentTime.textContent = formatTime(audioPlayer.currentTime);
  });

  // Play/Pause toggle
  playPauseBtn.addEventListener("click", () => {
    if (audioPlayer.paused) {
      audioPlayer.play();
      if (playIcon) playIcon.style.display = "none";
      if (pauseIcon) pauseIcon.style.display = "block";
    } else {
      audioPlayer.pause();
      if (playIcon) playIcon.style.display = "block";
      if (pauseIcon) pauseIcon.style.display = "none";
    }
  });

  // When audio ends
  audioPlayer.addEventListener("ended", () => {
    if (playIcon) playIcon.style.display = "block";
    if (pauseIcon) pauseIcon.style.display = "none";
    if (audioProgressFill) audioProgressFill.style.width = "0%";
    if (audioCurrentTime) audioCurrentTime.textContent = "0:00";
  });

  // Click on progress bar to seek
  if (audioProgressBar) {
    audioProgressBar.addEventListener("click", (e) => {
      if (!isFinite(audioPlayer.duration) || audioPlayer.duration <= 0) return;
      const rect = audioProgressBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const percentage = clickX / width;
      audioPlayer.currentTime = percentage * audioPlayer.duration;
    });
  }
}

// ===== Start =====
init();
