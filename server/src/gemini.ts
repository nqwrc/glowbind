import type { Keybind } from "./profiles.js";

export interface GeminiMatch {
  matchId: string | null;
  confidence: number;
  explanation: string;
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    matchId: { type: "STRING", nullable: true },
    confidence: { type: "NUMBER" },
    explanation: { type: "STRING" },
  },
  required: ["matchId", "confidence", "explanation"],
};

/**
 * Asks Gemini Flash to pick the keybind matching a natural-language request.
 * Throws on network/quota/parse errors; the caller falls back to fuzzy search.
 */
export async function resolveWithGemini(
  apiKey: string,
  query: string,
  appName: string,
  keybinds: Keybind[],
  model = DEFAULT_MODEL,
): Promise<GeminiMatch> {
  const catalog = keybinds.map((k) => `${k.id}: ${k.action}`).join("\n");
  const prompt = [
    `You match a user's natural-language request to a keyboard shortcut of the application "${appName}".`,
    `Available shortcuts (id: description):`,
    catalog,
    ``,
    `User request (Italian or English): "${query}"`,
    ``,
    `Pick the single best matching shortcut id, or null if none fits.`,
    `confidence is 0..1. explanation is one short sentence in Italian describing what the shortcut does.`,
  ].join("\n");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");
  const parsed = JSON.parse(text) as GeminiMatch;
  return {
    matchId: parsed.matchId ?? null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    explanation: parsed.explanation ?? "",
  };
}
