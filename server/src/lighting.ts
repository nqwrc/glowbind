import type { OpenRGBService } from "./openrgb.js";
import type { Keybind } from "./profiles.js";

export interface LightingState {
  active: boolean;
  keybindId: string | null;
  chords: string[][];
  step: number;
}

const STEP_MS = 1500;
const AUTO_CLEAR_MS = 20_000;

/**
 * Single source of truth for what is currently highlighted. Drives the
 * physical keyboard through OpenRGB and notifies WebSocket listeners so the
 * on-screen keyboard stays in sync.
 */
export class LightingController {
  private state: LightingState = { active: false, keybindId: null, chords: [], step: 0 };
  private stepTimer: NodeJS.Timeout | null = null;
  private clearTimer: NodeJS.Timeout | null = null;
  private listeners = new Set<(state: LightingState) => void>();

  constructor(private openrgb: OpenRGBService) {}

  onChange(listener: (state: LightingState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): LightingState {
    return this.state;
  }

  highlight(keybind: Keybind) {
    this.stopTimers();
    this.state = { active: true, keybindId: keybind.id, chords: keybind.keys, step: 0 };
    void this.openrgb.showChord(this.state.chords[0]);
    this.emit();
    if (this.state.chords.length > 1) {
      this.stepTimer = setInterval(() => {
        this.state = { ...this.state, step: (this.state.step + 1) % this.state.chords.length };
        void this.openrgb.showChord(this.state.chords[this.state.step]);
        this.emit();
      }, STEP_MS);
    }
    this.clearTimer = setTimeout(() => void this.clear(), AUTO_CLEAR_MS);
  }

  async clear() {
    this.stopTimers();
    if (!this.state.active) return;
    this.state = { active: false, keybindId: null, chords: [], step: 0 };
    await this.openrgb.restore();
    this.emit();
  }

  private stopTimers() {
    if (this.stepTimer) clearInterval(this.stepTimer);
    if (this.clearTimer) clearTimeout(this.clearTimer);
    this.stepTimer = null;
    this.clearTimer = null;
  }

  private emit() {
    for (const listener of this.listeners) listener(this.state);
  }
}
