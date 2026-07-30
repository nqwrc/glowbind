export interface Keybind {
  id: string;
  action: string;
  keys: string[][];
  category?: string;
  keywords?: string[];
}

export interface Profile {
  id: string;
  name: string;
  keybinds: Keybind[];
}

export interface ProfileSummary {
  id: string;
  name: string;
  count: number;
}

export interface LightingState {
  active: boolean;
  keybindId: string | null;
  chords: string[][];
  step: number;
}

export interface QueryResult {
  keybind: Keybind | null;
  source: "gemini" | "fuzzy";
  confidence: number;
  explanation: string;
}

