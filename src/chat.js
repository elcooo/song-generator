import OpenAI from "openai";
import { getRecentMessages, saveMessage } from "./db.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Du bist ein freundlicher KI-Musik-Assistent, der persönliche Songs erstellt.

NUR DIESE AUFGABE:
- Du sprichst NUR über die Erstellung von persönlichen Songs. Keine anderen Themen.
- Wenn der Nutzer vom Thema abweicht (andere Fragen, Smalltalk, Wetter, andere Bitten): freundlich ablehnen und zurück zum Song lenken.
- Sage z.B.: "Ich bin nur hier, um dir bei deinem persönlichen Song zu helfen. Worum soll dein Song gehen?" oder "Dafür bin ich nicht zuständig – ich helfe dir gern bei deinem Song. Womit sollen wir anfangen?"
- Beantworte keine Fragen zu anderen Themen. Bleibe immer beim Song.

WICHTIGE REGELN:
1. Halte Antworten KURZ (max. 2–3 Sätze) es sei denn es geht um Lyrics
2. Rufe generate_song nur EINMAL pro Song-Anfrage auf – nie mehrfach
3. Wenn der Nutzer bestätigt, dass er generieren will, rufe generate_song sofort auf – frage nicht nochmal

GESPRÄCHSABLAUF:
1. Begrüße den Nutzer, frage worum es in dem Song gehen soll
2. Sobald du ein Thema hast, schreibe KURZE Lyrics (nur 1 Vers + 1 Refrain, nutze [verse] und [chorus] Tags)
3. Zeige die Lyrics und frage ob sie gefallen
4. Wenn ja, frage nach dem Musikstil (Pop, Rock, Rap, etc.)
5. Sobald der Stil bestätigt ist, rufe generate_song EINMAL auf
6. Nach dem Song: kurz um Unterstützung bitten.

NIEMALS:
- Über andere Themen als den Song sprechen
- Mehrere Songs generieren
- Zu viele Fragen stellen
- Lange Antworten schreiben
- generate_song mehr als einmal pro Anfrage aufrufen

Nach dem Song den Nutzer freundlich um eine Spende bitten (nicht drängen).`;

const tools = [
  {
    type: "function",
    function: {
      name: "generate_song",
      description:
        "Erzeuge eine echte Song-/Musik-Audiodatei und sende sie an den Nutzer. Nutze das, wenn der Nutzer bestätigt hat, dass er einen Song erstellen will und du sowohl Lyrics als auch Stil hast.",
      parameters: {
        type: "object",
        properties: {
          lyrics: {
            type: "string",
            description: "Die Song-Lyrics mit [verse] und [chorus] Tags",
          },
          style: {
            type: "string",
            description:
              "Musikstil-Beschreibung z.B. 'beschwingter Pop, eingängige Melodie' oder 'emotionaler Ballad, Klavier'",
          },
        },
        required: ["lyrics", "style"],
      },
    },
  },
];

/**
 * Process a chat message from a user.
 * Returns { type: 'text', content } or { type: 'generate', lyrics, style, content }
 */
export async function processChat(userId, userMessage) {
  // Save user message
  saveMessage(userId, "user", userMessage);

  // Build conversation history
  const history = getRecentMessages(userId, 15);

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [{ role: "developer", content: SYSTEM_PROMPT }, ...history],
    tools,
  });

  const message = response.choices[0]?.message;

  if (message?.tool_calls?.length > 0) {
    const toolCall = message.tool_calls[0];

    if (toolCall.function.name === "generate_song") {
      const args = JSON.parse(toolCall.function.arguments);
      const textContent = message.content || "🎵 Dein Song wird jetzt erstellt...";
      saveMessage(userId, "assistant", textContent);
      return { type: "generate", lyrics: args.lyrics, style: args.style, content: textContent };
    }
  }

  if (message?.content) {
    saveMessage(userId, "assistant", message.content);
    return { type: "text", content: message.content };
  }

  return { type: "text", content: "Entschuldigung, da ist etwas schiefgelaufen." };
}
