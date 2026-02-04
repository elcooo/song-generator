import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const audioDir = join(__dirname, "..", "public", "audio");
mkdirSync(audioDir, { recursive: true });

export async function generateMusic(style, lyrics, songId) {
  console.log("Generating music...", { style, lyrics: lyrics.substring(0, 50) });

  const response = await fetch("https://api.minimax.io/v1/music_generation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: "music-2.5",
      prompt: style,
      lyrics,
      audio_setting: { sample_rate: 44100, bitrate: 256000, format: "mp3" },
      output_format: "url",
    }),
  });

  const data = await response.json();
  const audioUrl = data.data?.audio;

  if (audioUrl?.startsWith("http")) {
    const audioResponse = await fetch(audioUrl);
    const buffer = await audioResponse.arrayBuffer();
    const fileName = `song_${songId}_${Date.now()}.mp3`;
    const filePath = join(audioDir, fileName);
    writeFileSync(filePath, Buffer.from(buffer));
    return { filePath: `audio/${fileName}` };
  }

  return { error: data.base_resp?.status_msg || "Musik konnte nicht erzeugt werden" };
}
