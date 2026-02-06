import { writeFile } from "fs/promises";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { addMinimaxLog } from "./logs/minimaxLogs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const audioDir = join(__dirname, "..", "public", "audio");
mkdirSync(audioDir, { recursive: true });

const GENERATION_TIMEOUT_MS = Number(process.env.MINIMAX_TIMEOUT_MS) || 240000;
const AUDIO_TIMEOUT_MS = Number(process.env.MINIMAX_AUDIO_TIMEOUT_MS) || 180000;
const BASE_URLS = (process.env.MINIMAX_BASE_URLS || process.env.MINIMAX_BASE_URL || "https://api.minimax.io,https://api.minimaxi.com")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const OUTPUT_FORMAT = (process.env.MINIMAX_OUTPUT_FORMAT || "auto").toLowerCase();
const MODEL = process.env.MINIMAX_MODEL || "music-2.5";
const PROBE_TIMEOUT_MS = Number(process.env.MINIMAX_PROBE_TIMEOUT_MS) || 12000;

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
  console.log(`[minimax] ${label}`, data);
  addMinimaxLog(entry);
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function decodeAudio(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^data:audio\/[a-zA-Z0-9.+-]+;base64,/.test(trimmed)) {
    const base64 = trimmed.split(",").pop();
    return Buffer.from(base64, "base64");
  }

  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, "hex");
  }

  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length % 4 === 0) {
    return Buffer.from(trimmed, "base64");
  }

  return null;
}

async function requestMusic(baseUrl, style, lyrics, songId, options = {}) {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/music_generation`;
  const outputFormat = (options.outputFormat ?? OUTPUT_FORMAT ?? "").toLowerCase();
  const timeoutMs = options.timeoutMs ?? GENERATION_TIMEOUT_MS;
  const payload = {
    model: MODEL,
    prompt: style,
    lyrics,
    audio_setting: { sample_rate: 44100, bitrate: 256000, format: "mp3" },
  };
  if (outputFormat && outputFormat !== "auto") {
    payload.output_format = outputFormat;
  }

  logEvent("request", {
    songId,
    url,
    model: MODEL,
    outputFormat,
    style: preview(style, 60),
    lyrics: preview(lyrics, 80),
  });

  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
        },
        body: JSON.stringify(payload),
      },
      timeoutMs
    );
  } catch (err) {
    const detail = err?.name === "AbortError" ? "Timeout" : (err?.message || "Unbekannter Fehler");
    logEvent("error", { songId, url, error: `Musikdienst nicht erreichbar (${detail})` });
    return { ok: false, retryable: true, error: `Musikdienst nicht erreichbar (${detail})` };
  }

  const text = await response.text();
  logEvent("response", {
    songId,
    url,
    status: response.status,
    body: text.slice(0, 500),
  });

  if (!response.ok) {
    logEvent("error", { songId, url, error: `Musikdienst-Fehler (${response.status})` });
    return { ok: false, retryable: response.status >= 500, error: `Musikdienst-Fehler (${response.status})` };
  }

  const data = safeJsonParse(text);
  if (!data) {
    logEvent("error", { songId, url, error: "Ungueltige Antwort vom Musikdienst" });
    return { ok: false, retryable: false, error: "Ungueltige Antwort vom Musikdienst" };
  }

  const statusCode = data?.base_resp?.status_code;
  const statusMsg = data?.base_resp?.status_msg;
  if (statusCode && statusCode !== 0) {
    logEvent("error", { songId, url, error: statusMsg || "Musikdienst-Fehler" });
    return { ok: false, retryable: true, error: statusMsg || "Musikdienst-Fehler" };
  }

  const audioValue = data?.data?.audio || data?.data?.audio_url || data?.data?.audioUrl;
  const traceId = data?.trace_id || data?.base_resp?.trace_id;

  return { ok: true, audioValue, traceId, outputFormatUsed: outputFormat };
}

export async function generateMusic(style, lyrics, songId) {
  logEvent("config", {
    songId,
    baseUrls: BASE_URLS,
    model: MODEL,
    outputFormat: OUTPUT_FORMAT,
    timeouts: { generationMs: GENERATION_TIMEOUT_MS, audioMs: AUDIO_TIMEOUT_MS },
  });

  const errors = [];
  for (const baseUrl of BASE_URLS) {
    const result = await requestMusic(baseUrl, style, lyrics, songId);

    if (!result.ok) {
      logEvent("error", { songId, baseUrl, error: result.error });
      errors.push(`${baseUrl} -> ${result.error}`);
      if (!result.retryable) {
        return { error: result.error };
      }
      continue;
    }

    if (result.traceId) {
      logEvent("trace", { songId, traceId: result.traceId, baseUrl });
    }

    const audioValue = result.audioValue;

    if (audioValue?.startsWith && audioValue.startsWith("http")) {
      let audioResponse;
      try {
        audioResponse = await fetchWithTimeout(audioValue, {}, AUDIO_TIMEOUT_MS);
      } catch (err) {
        const detail = err?.name === "AbortError" ? "Timeout" : (err?.message || "Unbekannter Fehler");
        return { error: `Audio konnte nicht geladen werden (${detail})` };
      }

      if (!audioResponse.ok) {
        return { error: "Audio konnte nicht geladen werden" };
      }

      const buffer = await audioResponse.arrayBuffer();
      const fileName = `song_${songId}_${Date.now()}.mp3`;
      const filePath = join(audioDir, fileName);
      await writeFile(filePath, Buffer.from(buffer));
      return { filePath: `audio/${fileName}` };
    }

    const audioBuffer = decodeAudio(audioValue);
    if (audioBuffer) {
      const fileName = `song_${songId}_${Date.now()}.mp3`;
      const filePath = join(audioDir, fileName);
      await writeFile(filePath, audioBuffer);
      return { filePath: `audio/${fileName}` };
    }

    return { error: "Audio-Format nicht erkannt" };
  }

  if (errors.length > 0) {
    return { error: errors.join(" | ") };
  }
  return { error: "Musikdienst nicht erreichbar" };
}

export async function probeMinimax() {
  logEvent("probe", {
    baseUrls: BASE_URLS,
    model: MODEL,
    outputFormat: OUTPUT_FORMAT,
    timeouts: { probeMs: PROBE_TIMEOUT_MS },
  });

  const results = [];
  for (const baseUrl of BASE_URLS) {
    const result = await requestMusic(baseUrl, "test", "test", "probe", {
      timeoutMs: PROBE_TIMEOUT_MS,
      outputFormat: OUTPUT_FORMAT,
    });

    results.push({
      baseUrl,
      ok: result.ok,
      error: result.error,
      traceId: result.traceId,
      outputFormat: result.outputFormatUsed,
    });
  }

  return { results };
}
