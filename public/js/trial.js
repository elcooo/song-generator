// ===== Trial Mode - 1 Free Song Without Registration =====

// State
let pendingLyrics = null;
let pendingStyle = null;
let hasGeneratedSong = false;
let exampleInterval = null;
let currentExampleIndex = 0;

// Wizard state
const WIZARD_STEPS = [
  { key: "occasion", label: "Anlass" },
  { key: "recipient", label: "Für wen" },
  { key: "name", label: "Name" },
  { key: "details", label: "Details" },
  { key: "style", label: "Stil" },
];

let wizardData = { occasion: "", recipient: "", name: "", details: "", style: "" };
let currentStep = 0;

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

// DOM
const initialLoader = document.getElementById("initial-loader");
const lyricsContent = document.getElementById("trial-lyrics-content");
const generateBtn = document.getElementById("trial-generate-btn");
const progressBar = document.getElementById("trial-progress");
const audioPlayer = document.getElementById("trial-audio-player");
const trialCta = document.getElementById("trial-cta");
const songSuccessBox = document.getElementById("song-success-box");
const playPauseBtn = document.getElementById("play-pause-btn");
const audioProgressBar = document.getElementById("audio-progress-bar");
const audioProgressFill = document.getElementById("audio-progress-fill");
const audioCurrentTime = document.getElementById("audio-current-time");
const audioDuration = document.getElementById("audio-duration");
const lyricsActions = document.getElementById("lyrics-actions");
const editLyricsBtn = document.getElementById("edit-lyrics-btn");
const saveLyricsBtn = document.getElementById("save-lyrics-btn");
const cancelLyricsBtn = document.getElementById("cancel-lyrics-btn");
const lyricsEditor = document.getElementById("lyrics-editor");
const lyricsAiBox = document.getElementById("lyrics-ai-box");
const lyricsAiInput = document.getElementById("lyrics-ai-input");
const lyricsAiBtn = document.getElementById("lyrics-ai-btn");
const lyricsAiStatus = document.getElementById("lyrics-ai-status");
let audioPlayerInitialized = false;

// Wizard DOM
const wizardStepsEl = document.querySelectorAll(".wizard-step");
const progressSteps = document.querySelectorAll(".progress-step");
const backBtn = document.getElementById("wizard-back-btn");
const nextBtn = document.getElementById("wizard-next-btn");
const stepIndicator = document.getElementById("wizard-step-indicator");
const lyricsGenerating = document.getElementById("lyrics-generating");

// Utility
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function showError(msg) {
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

// ===== Rotating Examples for Details =====
function startExamplesRotation() {
  const exampleText = document.getElementById("example-text");
  const detailsExamples = document.getElementById("details-examples");
  
  if (!exampleText || !detailsExamples) return;
  
  detailsExamples.style.display = "flex";
  currentExampleIndex = Math.floor(Math.random() * DETAILS_EXAMPLES.length);
  exampleText.textContent = DETAILS_EXAMPLES[currentExampleIndex];
  
  if (exampleInterval) clearInterval(exampleInterval);
  
  exampleInterval = setInterval(() => {
    currentExampleIndex = (currentExampleIndex + 1) % DETAILS_EXAMPLES.length;
    exampleText.style.opacity = "0";
    exampleText.style.transform = "translateX(10px)";
    
    setTimeout(() => {
      exampleText.textContent = DETAILS_EXAMPLES[currentExampleIndex];
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
  recipientCards.forEach(card => card.classList.remove("suggested"));
  
  recipientCards.forEach(card => {
    if (card.dataset.value === suggestedValue) {
      card.classList.add("suggested");
    }
  });
}

// ===== Update Step Selections =====
function updateStepSelections() {
  const selectionMap = {
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
      el.textContent = value.length > 12 ? value.substring(0, 11) + "…" : value;
      parentStep.classList.add("has-selection");
    } else {
      el.textContent = "";
      parentStep.classList.remove("has-selection");
    }
  });
}

// ===== Wizard =====
function goToStep(step) {
  currentStep = step;

  wizardStepsEl.forEach(el => {
    el.classList.toggle("active", parseInt(el.dataset.step) === step);
  });

  progressSteps.forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.toggle("active", s === step);
    el.classList.toggle("completed", s < step);
  });

  updateStepSelections();

  backBtn.style.visibility = step === 0 ? "hidden" : "visible";

  if (step === WIZARD_STEPS.length - 1) {
    nextBtn.innerHTML = `Lyrics erstellen <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  } else {
    nextBtn.innerHTML = `Weiter <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  }

  stepIndicator.textContent = `Schritt ${step + 1} von ${WIZARD_STEPS.length}`;
  updateNextButton();

  // Handle rotating examples for details step
  if (step === 3) {
    if (!wizardData.details) {
      startExamplesRotation();
    }
  } else {
    stopExamplesRotation();
  }

  if (pendingLyrics) {
    pendingLyrics = null;
    pendingStyle = null;
    generateBtn.disabled = true;
    lyricsContent.classList.remove("has-lyrics");
    lyricsContent.innerHTML = `<div class="lyrics-placeholder">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
      <p>Deine Lyrics erscheinen hier, sobald die KI sie erstellt hat.</p>
    </div>`;
    if (lyricsActions) lyricsActions.style.display = "none";
    if (lyricsAiBox) lyricsAiBox.style.display = "none";
    if (lyricsAiStatus) {
      lyricsAiStatus.textContent = "";
      lyricsAiStatus.className = "lyrics-ai-status";
    }
    if (lyricsAiInput) lyricsAiInput.value = "";
    exitEditMode();
    audioPlayer.style.display = "none";
    progressBar.style.display = "none";
  }
}

function updateNextButton() {
  const key = WIZARD_STEPS[currentStep].key;
  if (key === "details") {
    nextBtn.disabled = false;
  } else {
    nextBtn.disabled = !wizardData[key];
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
    const res = await fetch("/api/wizard/trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wizardData),
    });

    const data = await res.json();
    lyricsGenerating.style.display = "none";

    if (!res.ok) {
      showError(data.error || "Lyrics-Generierung fehlgeschlagen");
      nextBtn.disabled = false;
      return;
    }

    pendingLyrics = data.lyrics;
    pendingStyle = data.style;
    displayLyrics(data.lyrics);
  } catch {
    lyricsGenerating.style.display = "none";
    nextBtn.disabled = false;
    showError("Verbindungsfehler. Bitte versuche es erneut.");
  }
}

function displayLyrics(text) {
  const tagRe = /\[(verse|chorus|bridge|outro|intro)\]/i;

  let raw = text.trim();

  // Try to extract only the lyrics portion (after first tag)
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

  pendingLyrics = raw;

  const escaped = escapeHtml(raw);
  const formatted = escaped.replace(
    /\[(verse|chorus|bridge|outro|intro)\]/gi,
    (_, tag) => `<span class="tag">[${tag}]</span>`
  );
  
  lyricsContent.classList.remove("has-lyrics");
  
  lyricsContent.innerHTML = formatted;
  if (lyricsActions) lyricsActions.style.display = "flex";
  if (lyricsAiBox) lyricsAiBox.style.display = "flex";
  exitEditMode();

  requestAnimationFrame(() => {
    lyricsContent.classList.add("has-lyrics");
  });

  generateBtn.disabled = false;
}

// ===== Lyrics Editing =====
function enterEditMode() {
  if (!pendingLyrics || !lyricsEditor || !lyricsContent) return;
  lyricsEditor.value = pendingLyrics;
  lyricsContent.style.display = "none";
  lyricsEditor.style.display = "block";
  if (editLyricsBtn) editLyricsBtn.style.display = "none";
  if (saveLyricsBtn) saveLyricsBtn.style.display = "inline-flex";
  if (cancelLyricsBtn) cancelLyricsBtn.style.display = "inline-flex";
  lyricsEditor.focus();
}

function exitEditMode() {
  if (!lyricsEditor || !lyricsContent) return;
  lyricsEditor.style.display = "none";
  lyricsContent.style.display = "block";
  if (editLyricsBtn) editLyricsBtn.style.display = "inline-flex";
  if (saveLyricsBtn) saveLyricsBtn.style.display = "none";
  if (cancelLyricsBtn) cancelLyricsBtn.style.display = "none";
}

function saveManualEdits() {
  if (!lyricsEditor) return;
  const edited = lyricsEditor.value.trim();
  if (edited) {
    displayLyrics(edited);
  } else {
    exitEditMode();
  }
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
  if (!lyricsAiInput || !lyricsAiBtn || !lyricsAiStatus) return;
  const prompt = lyricsAiInput.value.trim();
  if (!prompt || !pendingLyrics) return;

  lyricsAiBtn.disabled = true;
  lyricsAiInput.disabled = true;
  lyricsAiStatus.textContent = "AI bearbeitet Lyrics...";
  lyricsAiStatus.className = "lyrics-ai-status loading";

  try {
    const res = await fetch("/api/lyrics/edit/trial", {
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

// Option card clicks — auto-advance
document.querySelectorAll(".option-cards").forEach(container => {
  container.addEventListener("click", (e) => {
    const card = e.target.closest(".option-card");
    if (!card) return;

    const step = card.closest(".wizard-step");
    const stepIndex = parseInt(step.dataset.step);
    const stepKey = WIZARD_STEPS[stepIndex].key;

    container.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));
    card.classList.add("selected");

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

    setTimeout(() => handleNextStep(), 250);
  });
});

// Custom input handling
document.querySelectorAll(".custom-input").forEach(input => {
  input.addEventListener("input", () => {
    const step = input.closest(".wizard-step");
    const stepIndex = parseInt(step.dataset.step);
    const stepKey = WIZARD_STEPS[stepIndex].key;

    step.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));

    wizardData[stepKey] = input.value.trim();
    updateNextButton();
    updateStepSelections();
  });

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
  });
  
  detailsInput.addEventListener("focus", () => {
    if (!wizardData.details) {
      startExamplesRotation();
    }
  });
}

// Navigation
nextBtn.addEventListener("click", handleNextStep);
backBtn.addEventListener("click", handleBackStep);

// ===== Song Generation =====
generateBtn.addEventListener("click", async () => {
  if (!pendingLyrics || hasGeneratedSong) return;

  const lyrics = pendingLyrics;
  const style = pendingStyle || "Pop, eingängige Melodie";

  generateBtn.disabled = true;
  progressBar.style.display = "flex";
  audioPlayer.style.display = "none";

  try {
    const res = await fetch("/api/generate/trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lyrics, style }),
    });

    const data = await res.json();

    if (!res.ok) {
      progressBar.style.display = "none";
      generateBtn.disabled = false;
      showError(data.error || "Song-Generierung fehlgeschlagen.");
      return;
    }

    hasGeneratedSong = true;
    pollSongStatus(data.songId);
  } catch {
    progressBar.style.display = "none";
    generateBtn.disabled = false;
    showError("Verbindungsfehler bei der Generierung.");
  }
});

// Poll song status
async function pollSongStatus(songId) {
  let attempts = 0;
  const maxAttempts = 60;

  const interval = setInterval(async () => {
    attempts++;

    if (attempts > maxAttempts) {
      clearInterval(interval);
      progressBar.style.display = "none";
      showError("Die Song-Generierung dauert länger als erwartet. Bitte lade die Seite neu.");
      return;
    }

    try {
      const res = await fetch(`/api/songs/trial/${songId}`);
      const song = await res.json();

      if (song.status === "completed" && song.file_path) {
        clearInterval(interval);
        progressBar.style.display = "none";
        
        // Show success box with custom player
        audioPlayer.src = "/" + song.file_path;
        songSuccessBox.style.display = "block";
        trialCta.style.display = "block";
        
        // Setup custom audio player
        setupCustomAudioPlayer();
      } else if (song.status === "failed") {
        clearInterval(interval);
        progressBar.style.display = "none";
        generateBtn.disabled = false;
        hasGeneratedSong = false;
        showError("Song-Generierung fehlgeschlagen: " + (song.error_message || "Unbekannter Fehler"));
      }
    } catch (err) {
      console.error("Poll error:", err);
    }
  }, 3000);
}

// ===== Custom Audio Player =====
function formatTime(seconds) {
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
      playIcon.style.display = "none";
      pauseIcon.style.display = "block";
    } else {
      audioPlayer.pause();
      playIcon.style.display = "block";
      pauseIcon.style.display = "none";
    }
  });

  // When audio ends
  audioPlayer.addEventListener("ended", () => {
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
    audioProgressFill.style.width = "0%";
    audioCurrentTime.textContent = "0:00";
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

// ===== Initialize =====
async function init() {
  await new Promise(resolve => setTimeout(resolve, 500));

  if (initialLoader) {
    initialLoader.classList.add("fade-out");
    setTimeout(() => {
      initialLoader.style.display = "none";
    }, 300);
  }
}

init();
