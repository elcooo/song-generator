import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WIZARD_SYSTEM_PROMPT = `Du bist ein professioneller Songwriter, der persönliche Songs auf Deutsch schreibt.

AUFGABE:
Du erhältst strukturierte Informationen über einen Song (Anlass, Empfänger, Name, persönliche Details, Musikstil) und schreibst daraus vollständige Lyrics.

REGELN:
1. Schreibe die Lyrics komplett auf Deutsch
2. Nutze die Tags [verse], [chorus], [bridge], [outro] um die Songstruktur zu markieren
3. Mindestens 2 Verse, 1 Chorus (der wiederholt wird), optional Bridge und Outro
4. Der Chorus soll eingängig und wiederholbar sein
5. Baue den Namen der Person und die persönlichen Details in die Lyrics ein
6. Der Ton soll zum Anlass passen (feierlich für Hochzeit, fröhlich für Geburtstag, etc.)
7. Passe den Sprachstil an den Musikstil an (z.B. lockerer bei Rap, poetischer bei Ballade)
8. Gib NUR die Lyrics aus, ohne Kommentare oder Erklärungen davor oder danach
9. Beginne direkt mit dem ersten Tag [verse] oder [intro]`;

/**
 * Generate lyrics from wizard data (single API call, no conversation).
 * Returns { type: 'generate', lyrics, style, content }
 */
export async function generateFromWizard(userId, { occasion, recipient, name, details, style }) {
  const userPrompt = `Anlass: ${occasion}
Für wen: ${recipient}
Name: ${name}
Persönliche Details: ${details || "Keine weiteren Details angegeben."}
Musikstil: ${style}

Schreibe jetzt die Lyrics:`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "developer", content: WIZARD_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Keine Lyrics vom AI erhalten");
  }

  return {
    type: "generate",
    lyrics: content.trim(),
    style,
    content: content.trim(),
  };
}
