import Fuse from "fuse.js";
import { resolveWithGemini } from "./gemini.js";
import { getGeminiApiKey } from "./secrets.js";
import type { Keybind, Profile } from "./profiles.js";

export interface Resolution {
  keybind: Keybind | null;
  source: "gemini" | "fuzzy";
  confidence: number;
  explanation: string;
}

const fuseCache = new Map<string, Fuse<Keybind>>();

function fuzzyResolve(profile: Profile, query: string): Resolution {
  let fuse = fuseCache.get(profile.id);
  if (!fuse) {
    fuse = new Fuse(profile.keybinds, {
      keys: [
        { name: "action", weight: 2 },
        { name: "keywords", weight: 1 },
        { name: "category", weight: 0.5 },
      ],
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.6,
    });
    fuseCache.set(profile.id, fuse);
  }
  const [best] = fuse.search(query);
  if (!best) {
    return {
      keybind: null,
      source: "fuzzy",
      confidence: 0,
      explanation: "Nessuna scorciatoia corrisponde alla richiesta.",
    };
  }
  return {
    keybind: best.item,
    source: "fuzzy",
    confidence: 1 - (best.score ?? 1),
    explanation: best.item.action,
  };
}

export async function resolveQuery(profile: Profile, query: string): Promise<Resolution> {
  const apiKey = getGeminiApiKey();
  if (apiKey) {
    try {
      const match = await resolveWithGemini(apiKey, query, profile.name, profile.keybinds);
      if (match.matchId) {
        const keybind = profile.keybinds.find((k) => k.id === match.matchId) ?? null;
        if (keybind) {
          return {
            keybind,
            source: "gemini",
            confidence: match.confidence,
            explanation: match.explanation,
          };
        }
      } else {
        return {
          keybind: null,
          source: "gemini",
          confidence: match.confidence,
          explanation: match.explanation || "Nessuna scorciatoia corrisponde alla richiesta.",
        };
      }
    } catch (err) {
      console.warn(`[resolver] Gemini failed, falling back to fuzzy: ${String(err)}`);
    }
  }
  return fuzzyResolve(profile, query);
}

export function geminiAvailable(): boolean {
  return getGeminiApiKey() !== null;
}
