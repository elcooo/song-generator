import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WIZARD_SYSTEM_PROMPT = `Du bist ein professioneller Songwriter, der persönliche Songs schreibt.

AUFGABE:
Du erhältst strukturierte Informationen über einen Song (Anlass, Empfänger, Name, persönliche Details, Musikstil) und schreibst daraus vollständige, produktionsreife Lyrics.

SPRACHE:
- Schreibe die Lyrics vollständig in der vom Nutzer gewählten Sprache, falls angegeben.
- Wenn keine Sprache angegeben ist, nutze die Sprache der vorhandenen Lyrics oder die Sprache, die zum Musikstil passt.
- Persönliche Details und Namen immer einbauen, egal welche Sprache.

FORMAT UND STRUKTUR:
- Nutze diese Section-Tags in eckigen Klammern: [Intro], [Verse 1], [Verse 2], [Verse 3], [Pre-Chorus], [Chorus], [Bridge], [Solo], [Outro]
- Jeder Song MUSS mindestens haben: [Intro], [Verse 1], [Chorus], [Verse 2], [Chorus], [Outro]
- Der Chorus wird mehrfach wiederholt (mindestens 2-3 mal)
- Optional: [Pre-Chorus], [Bridge], [Solo], [Verse 3]

STYLE-ELEMENTE (WICHTIG - IMMER VERWENDEN):
- Backing Vocals / Antwortgesang in Klammern: (Oh yeah), (Hear it on the roof), (Fallin' on me)
- Emotionale Regieanweisungen in Klammern: (Guitar solo - slow, mournful), (Feel that rain), (Fade out...)
- Ad-libs und Ausrufe: Oh Lord..., Yeah..., Mmm-hmm, Ooh...
- Wiederholungen und Echos in Klammern nach einer Zeile
- Der [Intro] soll kurze stimmungsvolle Zeilen mit Ad-libs haben
- Der [Outro] soll mit Wiederholungen und Fade-out enden
- [Solo] Abschnitte mit instrumentalen Regieanweisungen in Klammern

SONGWRITING-REGELN:
1. Der Chorus soll eingängig, emotional und wiederholbar sein
2. Baue den Namen der Person und die persönlichen Details natürlich in die Lyrics ein
3. Der Ton soll zum Anlass passen (feierlich für Hochzeit, fröhlich für Geburtstag, traurig für Abschied, etc.)
4. Passe den Sprachstil an den Musikstil an (z.B. lockerer bei Rap, poetischer bei Ballade, rau bei Blues)
5. Gib NUR die Lyrics aus, ohne Kommentare oder Erklärungen davor oder danach
6. Beginne direkt mit [Intro]
7. Schreibe vollständige, lange Songs (mindestens 40 Zeilen)

BEISPIEL-FORMAT:
[Intro]
(Ooh, yeah)
(Listen to that rain)
Oh, Lord...

[Verse 1]
The sky is cryin', Lord, I can hear it on the roof
(Hear it on the roof)
Each drop a memory, ain't that the mournful truth?

[Chorus]
Midnight rain, fallin' down on me
(Fallin' on me)
Like tears I can't cry, for all the world to see

[Solo]
(Guitar solo - slow, mournful, bluesy)
(Yeah... play it, boy)

[Outro]
Oh, the rain...
(Fallin' down)
Just keep fallin'...
(Fade out...)`;

/**
 * Generate lyrics from wizard data (single API call, no conversation).
 * Returns { type: 'generate', lyrics, style, content }
 */
export async function generateFromWizard(userId, { language, occasion, recipient, name, details, style }) {
  const userPrompt = `Sprache: ${language}
Anlass: ${occasion}
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

/**
 * Edit existing lyrics based on a user prompt.
 * Returns { lyrics }
 */
export async function editLyrics(currentLyrics, prompt, style) {
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "developer", content: WIZARD_SYSTEM_PROMPT },
      { role: "user", content: `Hier sind die aktuellen Lyrics:\n\n${currentLyrics}` },
      { role: "assistant", content: currentLyrics },
      { role: "user", content: `Bitte bearbeite die Lyrics nach dieser Anweisung: ${prompt}\n\nMusikstil: ${style || "wie bisher"}\n\nGib die kompletten, bearbeiteten Lyrics aus. Behalte das gleiche Format mit Section-Tags, Backing Vocals und Ad-libs bei.` },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Keine Antwort vom AI erhalten");
  }

  return { lyrics: content.trim() };
}
