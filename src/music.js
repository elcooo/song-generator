import { writeFile } from "fs/promises";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { addMinimaxLog } from "./logs/minimaxLogs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const audioDir = join(__dirname, "..", "public", "audio");
mkdirSync(audioDir, { recursive: true });

// Suno API config
const BASE_URL = (process.env.SUNO_BASE_URL || "https://api.sunoapi.org").replace(/\/$/, "");
const API_KEY = (process.env.SUNO_API_KEY || "").trim();
const MODEL = process.env.SUNO_MODEL || "V4_5";
const POLL_INTERVAL_MS = Number(process.env.SUNO_POLL_INTERVAL_MS) || 10000;
const MAX_POLL_TIME_MS = Number(process.env.SUNO_MAX_POLL_TIME_MS) || 300000;
const AUDIO_DOWNLOAD_TIMEOUT_MS = Number(process.env.SUNO_AUDIO_TIMEOUT_MS) || 120000;
const CALLBACK_URL = (process.env.PUBLIC_BASE_URL || "https://songme.site").replace(/\/$/, "") + "/api/suno/callback";

// Debug: show masked key on startup
const masked = API_KEY.length > 12
  ? `${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)} (${API_KEY.length} chars)`
  : "(too short or empty)";
console.log(`[suno] API key loaded: ${masked}`);
console.log(`[suno] model=${MODEL}, base=${BASE_URL}`);

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function preview(text, max = 120) {
  if (!text) return "";
  const trimmed = String(text).replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 3)}...` : trimmed;
}

function logEvent(label, data) {
  const entry = { ts: Date.now(), label, data };
  console.log(`[suno] ${label}`, data);
  addMinimaxLog(entry);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Submit a music generation task to Suno API.
 * Returns { ok, taskId, error }
 */
async function submitGeneration(style, lyrics, songId, title) {
  const url = `${BASE_URL}/api/v1/generate`;
  const payload = {
    customMode: true,
    instrumental: false,
    model: MODEL,
    style,
    title: title || `Song ${songId}`,
    prompt: lyrics,
    callBackUrl: CALLBACK_URL,
  };

  logEvent("request", {
    songId,
    url,
    model: MODEL,
    style: preview(style, 60),
    lyrics: preview(lyrics, 80),
  });
  console.log(`[suno] FULL PAYLOAD (songId=${songId}):\n${JSON.stringify(payload, null, 2)}`);

  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(payload),
      },
      60000
    );
  } catch (err) {
    const detail = err?.name === "AbortError" ? "Timeout" : (err?.message || "Unbekannter Fehler");
    logEvent("error", { songId, error: `Musikdienst nicht erreichbar (${detail})` });
    return { ok: false, error: `Musikdienst nicht erreichbar (${detail})` };
  }

  const text = await response.text();
  logEvent("submit-response", {
    songId,
    status: response.status,
    bodyLength: text.length,
    body: text.slice(0, 2000),
  });
  console.log(`[suno] SUBMIT RESPONSE (songId=${songId}):\n${text.slice(0, 5000)}`);

  if (!response.ok) {
    logEvent("error", { songId, error: `Suno API Fehler (${response.status})` });
    return { ok: false, error: `Suno API Fehler (${response.status}): ${text.slice(0, 200)}` };
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "Ungueltige Antwort vom Musikdienst" };
  }

  if (data.code !== 200 || !data.data?.taskId) {
    logEvent("error", { songId, error: data.msg || "Unbekannter Fehler" });
    return { ok: false, error: data.msg || "Suno API Fehler" };
  }

  logEvent("task-created", { songId, taskId: data.data.taskId });
  return { ok: true, taskId: data.data.taskId };
}

/**
 * Poll Suno API until the task is complete or fails.
 * Returns { ok, audioUrl, error }
 */
async function pollForResult(taskId, songId, onProgress) {
  const url = `${BASE_URL}/api/v1/generate/record-info?taskId=${taskId}`;
  const startTime = Date.now();
  let lastStatus = "";

  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    await sleep(POLL_INTERVAL_MS);

    let response;
    try {
      response = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${API_KEY}` },
        },
        30000
      );
    } catch (err) {
      const detail = err?.name === "AbortError" ? "Timeout" : (err?.message || "Fehler");
      logEvent("poll-error", { songId, taskId, error: detail });
      continue;
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      logEvent("poll-parse-error", { songId, taskId, body: text.slice(0, 500) });
      continue;
    }

    const status = data?.data?.status;
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    logEvent("poll", { songId, taskId, status, elapsed: `${elapsedSec}s` });

    // Send progress updates to the user
    if (onProgress && status !== lastStatus) {
      lastStatus = status;
      if (status === "PENDING") {
        onProgress({ stage: "pending", message: "Auftrag wird vorbereitet...", percent: 10 });
      } else if (status === "TEXT_SUCCESS") {
        onProgress({ stage: "composing", message: "Musik wird komponiert...", percent: 30 });
      } else if (status === "FIRST_SUCCESS") {
        onProgress({ stage: "finalizing", message: "Song wird finalisiert...", percent: 80 });
      }
    }
    // Also update percent based on elapsed time during TEXT_SUCCESS
    if (onProgress && status === "TEXT_SUCCESS") {
      const percent = Math.min(75, 30 + Math.round((elapsedSec / 180) * 45));
      onProgress({ stage: "composing", message: "Musik wird komponiert...", percent });
    }

    if (status === "SUCCESS" || status === "FIRST_SUCCESS") {
      if (onProgress) onProgress({ stage: "downloading", message: "Audio wird heruntergeladen...", percent: 90 });
      const sunoData = data?.data?.response?.sunoData;
      if (sunoData && sunoData.length > 0) {
        const audioUrl = sunoData[0].audioUrl || sunoData[0].streamAudioUrl;
        const duration = sunoData[0].duration;
        logEvent("success", { songId, taskId, audioUrl: audioUrl?.slice(0, 100), duration });
        return { ok: true, audioUrl };
      }
      return { ok: false, error: "Keine Audio-Daten in der Antwort" };
    }

    if (
      status === "CREATE_TASK_FAILED" ||
      status === "GENERATE_AUDIO_FAILED" ||
      status === "SENSITIVE_WORD_ERROR"
    ) {
      const errMsg = data?.data?.errorMessage || status;
      logEvent("error", { songId, taskId, status, error: errMsg });
      return { ok: false, error: `Musikgenerierung fehlgeschlagen: ${errMsg}` };
    }

    // PENDING, TEXT_SUCCESS — keep polling
  }

  logEvent("timeout", { songId, taskId, maxPollTimeMs: MAX_POLL_TIME_MS });
  return { ok: false, error: "Zeitüberschreitung bei der Musikgenerierung" };
}

/**
 * Download audio from URL and save locally.
 * Returns { filePath } or { error }
 */
async function downloadAudio(audioUrl, songId) {
  let response;
  try {
    response = await fetchWithTimeout(audioUrl, {}, AUDIO_DOWNLOAD_TIMEOUT_MS);
  } catch (err) {
    const detail = err?.name === "AbortError" ? "Timeout" : (err?.message || "Fehler");
    return { error: `Audio konnte nicht geladen werden (${detail})` };
  }

  if (!response.ok) {
    return { error: `Audio-Download fehlgeschlagen (${response.status})` };
  }

  const buffer = await response.arrayBuffer();
  const fileName = `song_${songId}_${Date.now()}.mp3`;
  const filePath = join(audioDir, fileName);
  await writeFile(filePath, Buffer.from(buffer));
  logEvent("downloaded", { songId, fileName, bytes: buffer.byteLength });
  return { filePath: `audio/${fileName}` };
}

/**
 * Generate music via Suno API.
 * Returns { filePath } on success, { error } on failure.
 * @param {string} style
 * @param {string} lyrics
 * @param {number} songId
 * @param {function} [onProgress] - optional callback({ stage, message, percent })
 */
export async function generateMusic(style, lyrics, songId, onProgress) {
  logEvent("config", {
    songId,
    baseUrl: BASE_URL,
    model: MODEL,
    timeouts: { pollIntervalMs: POLL_INTERVAL_MS, maxPollTimeMs: MAX_POLL_TIME_MS },
  });

  // 1. Submit generation task
  if (onProgress) onProgress({ stage: "submitting", message: "Auftrag wird gesendet...", percent: 5 });
  const submit = await submitGeneration(style, lyrics, songId);
  if (!submit.ok) {
    return { error: submit.error };
  }

  // 2. Poll for result
  const poll = await pollForResult(submit.taskId, songId, onProgress);
  if (!poll.ok) {
    return { error: poll.error };
  }

  // 3. Download audio file
  if (onProgress) onProgress({ stage: "downloading", message: "Audio wird heruntergeladen...", percent: 95 });
  return await downloadAudio(poll.audioUrl, songId);
}

/**
 * Probe Suno API connectivity (used by admin panel).
 */
export async function probeMinimax() {
  logEvent("probe", { baseUrl: BASE_URL, model: MODEL });

  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/v1/generate/record-info?taskId=probe-test`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
      12000
    );

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }

    return {
      results: [{
        baseUrl: BASE_URL,
        ok: response.status === 200 || response.status === 400,
        status: response.status,
        error: response.status === 401 ? "Invalid API key" : null,
        response: data,
      }],
    };
  } catch (err) {
    return {
      results: [{
        baseUrl: BASE_URL,
        ok: false,
        error: err?.message || "Nicht erreichbar",
      }],
    };
  }
}
