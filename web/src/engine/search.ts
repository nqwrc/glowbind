import Fuse from "fuse.js";
import type { Keybind, Profile } from "../types";

// Offline natural-language lookup. No key, no network, no cost: good enough to
// find a shortcut from a rough description, and the UI offers alternatives
// because a fuzzy match is a guess, not an answer.

// Italian filler words carry no signal and drag the match around.
const STOPWORDS = new Set(
  ("come si fa fare per il lo la i gli le un uno una di del dello della dei degli delle" +
    " con su in da e o a al allo alla ai agli alle che cosa qual quale quali voglio vorrei" +
    " posso puoi devo mi ti ci vi dove quando cui piu meno molto tanto essere avere fatto" +
    " sul sulla nel nella tra fra questo questa quello quella").split(" "),
);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents, so "attivita" matches the accented form
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .join(" ");
}

// Crude stemmer: Italian inflections mostly live in the tail, so comparing
// prefixes makes "rinominare" match "rinomina" without a real morphology table.
const stem = (word: string) => (word.length > 6 ? word.slice(0, 6) : word);

interface Doc {
  keybind: Keybind;
  text: string;
  words: string[];
  stems: Set<string>;
}

/** Same concept in the query and the shortcut, allowing for inflections. */
function sameConcept(word: string, doc: Doc): boolean {
  if (doc.stems.has(stem(word))) return true;
  if (word.length < 4) return false;
  // "cercare" and "cerca" share a stem only through the shorter one.
  return doc.words.some(
    (other) => other.length >= 4 && (other.startsWith(word) || word.startsWith(other)),
  );
}

export interface Hit {
  keybind: Keybind;
  confidence: number;
}

const indexes = new Map<string, { fuse: Fuse<Doc>; docs: Doc[] }>();

function indexOf(profile: Profile) {
  let entry = indexes.get(profile.id);
  if (!entry) {
    const docs: Doc[] = profile.keybinds.map((keybind) => {
      const text = normalize(
        [keybind.action, ...(keybind.keywords ?? []), keybind.category ?? ""].join(" "),
      );
      const words = text.split(" ").filter(Boolean);
      return { keybind, text, words, stems: new Set(words.map(stem)) };
    });
    entry = {
      docs,
      fuse: new Fuse(docs, {
        keys: ["text"],
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.55,
        minMatchCharLength: 2,
      }),
    };
    indexes.set(profile.id, entry);
  }
  return entry;
}

/**
 * Share of the query the candidate actually accounts for, weighted by word
 * length so a long content word ("rinominare") counts for more than "file".
 */
function overlap(queryWords: string[], doc: Doc): number {
  let matched = 0;
  let total = 0;
  for (const word of queryWords) {
    total += word.length;
    if (sameConcept(word, doc)) matched += word.length;
  }
  return total === 0 ? 0 : matched / total;
}

/** Best matches for a free-text description, strongest first. */
export function searchLocal(profile: Profile, query: string, limit = 3): Hit[] {
  const normalized = normalize(query);
  if (!normalized) return [];
  const words = normalized.split(" ").filter(Boolean);
  const { fuse, docs } = indexOf(profile);

  const scores = new Map<Keybind, number>();
  for (const doc of docs) {
    const ratio = overlap(words, doc);
    if (ratio > 0) scores.set(doc.keybind, ratio);
  }
  // Fuzzy matching only catches typos and word order; it is weighted well below
  // a real word match, which it would otherwise outrank on coincidences.
  for (const result of fuse.search(normalized)) {
    const fuzzy = (1 - (result.score ?? 1)) * 0.6;
    const current = scores.get(result.item.keybind) ?? 0;
    scores.set(result.item.keybind, Math.max(current, fuzzy));
  }

  return [...scores.entries()]
    .map(([keybind, confidence]) => ({ keybind, confidence }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}
