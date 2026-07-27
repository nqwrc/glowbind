import type { Keybind, Profile } from "../types";

// Optional upgrade over the offline search: the visitor's own Gemini key,
// kept in their browser only and sent straight to Google. glowbind never ships
// a key of its own, which is why the public site cannot have AI by default.

const STORAGE_KEY = "glowbind.geminiKey";
const MODEL = "gemini-flash-latest";

export const loadKey = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // private mode or storage disabled
  }
};

export function saveKey(key: string | null) {
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing we can do; the app falls back to the offline search
  }
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    matchId: { type: "STRING", nullable: true },
    confidence: { type: "NUMBER" },
    explanation: { type: "STRING" },
  },
  required: ["matchId", "confidence", "explanation"],
};

export interface GeminiHit {
  keybind: Keybind | null;
  confidence: number;
  explanation: string;
}

export async function askGemini(
  apiKey: string,
  profile: Profile,
  query: string,
): Promise<GeminiHit> {
  const catalog = profile.keybinds.map((k) => `${k.id}: ${k.action}`).join("\n");
  const prompt = [
    `You match a user's natural-language request to a keyboard shortcut of "${profile.name}".`,
    `Available shortcuts (id: description):`,
    catalog,
    ``,
    `User request (Italian or English): "${query}"`,
    ``,
    `Pick the single best matching shortcut id, or null if none fits.`,
    `confidence is 0..1. explanation is one short sentence in Italian.`,
  ].join("\n");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
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
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");

  const parsed = JSON.parse(text) as {
    matchId: string | null;
    confidence: number;
    explanation: string;
  };
  return {
    keybind: profile.keybinds.find((k) => k.id === parsed.matchId) ?? null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    explanation: parsed.explanation ?? "",
  };
}
