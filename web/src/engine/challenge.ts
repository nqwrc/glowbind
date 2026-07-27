import type { Keybind, Profile } from "../types";

export const DEFAULT_LENGTH = 10;

/** Points awarded per question, by how the answer came out. */
const POINTS = { first: 100, retry: 50, failed: 0 } as const;

export type Outcome = keyof typeof POINTS;

export interface Answer {
  keybind: Keybind;
  outcome: Outcome;
}

export interface Score {
  points: number;
  maxPoints: number;
  correct: number;
  total: number;
  percent: number;
}

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function buildChallenge(profile: Profile, length = DEFAULT_LENGTH): Keybind[] {
  return shuffled(profile.keybinds).slice(0, Math.min(length, profile.keybinds.length));
}

export function scoreOf(answers: readonly Answer[]): Score {
  const points = answers.reduce((sum, a) => sum + POINTS[a.outcome], 0);
  const maxPoints = answers.length * POINTS.first;
  const correct = answers.filter((a) => a.outcome !== "failed").length;
  return {
    points,
    maxPoints,
    correct,
    total: answers.length,
    percent: maxPoints === 0 ? 0 : Math.round((points / maxPoints) * 100),
  };
}

export function verdict(score: Score): string {
  if (score.percent >= 90) return "Padronanza totale.";
  if (score.percent >= 70) return "Ottimo, ci sei quasi.";
  if (score.percent >= 40) return "Buon inizio, ripassa quelle sbagliate.";
  return "C'e' da lavorarci: riprova con lo stesso profilo.";
}
