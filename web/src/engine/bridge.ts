import type { Keybind } from "../types";

// The optional local companion server. When glowbind is opened from the
// published site there is none, and everything still works on screen; when it
// is running locally it mirrors the highlighted chord onto a real RGB keyboard
// through OpenRGB, and can answer natural-language queries with Gemini.

export interface BridgeStatus {
  openrgb: boolean;
  keyboards: string[];
  gemini: boolean;
}

let present = false;

export const bridgePresent = () => present;

/** Probe once at startup. Failure is the normal case for the public site. */
export async function detectBridge(): Promise<BridgeStatus | null> {
  try {
    const res = await fetch("api/status", { signal: AbortSignal.timeout(1500) });
    if (!res.ok) throw new Error(String(res.status));
    present = true;
    return (await res.json()) as BridgeStatus;
  } catch {
    present = false;
    return null;
  }
}

const post = (path: string, body?: unknown) =>
  fetch(`api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => undefined);

export function sendChord(tokens: string[]) {
  if (present) void post("chord", { tokens });
}

export function clearChord() {
  if (present) void post("clear");
}

export interface QueryResult {
  keybind: Keybind | null;
  source: "gemini" | "fuzzy";
  confidence: number;
  explanation: string;
}

/** Natural-language lookup. Only available with the bridge, which holds the key. */
export async function query(profileId: string, text: string): Promise<QueryResult> {
  const res = await fetch("api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId, text }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as QueryResult;
}
