import { useSyncExternalStore } from "react";
import { clearChord, sendChord } from "./bridge";

export interface LightingState {
  chords: string[][];
  step: number;
}

const IDLE: LightingState = { chords: [], step: 0 };
const STEP_MS = 1500;

/**
 * What the keyboards — the on-screen one and, through the bridge, a physical
 * one — are currently showing. Multi-step shortcuts cycle through their steps.
 */
class Lighting {
  private state: LightingState = IDLE;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  show(chords: string[][]) {
    this.stopTimer();
    if (chords.length === 0) return this.clear();
    this.set({ chords, step: 0 });
    if (chords.length > 1) {
      this.timer = setInterval(() => {
        this.set({ ...this.state, step: (this.state.step + 1) % this.state.chords.length });
      }, STEP_MS);
    }
  }

  clear() {
    this.stopTimer();
    if (this.state === IDLE) return;
    this.state = IDLE;
    clearChord();
    this.emit();
  }

  private set(state: LightingState) {
    this.state = state;
    sendChord(state.chords[state.step] ?? []);
    this.emit();
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}

export const lighting = new Lighting();

/** Tokens currently lit, for the on-screen keyboard. */
export function useLitKeys(): string[] {
  const state = useSyncExternalStore(lighting.subscribe, lighting.getSnapshot);
  return state.chords[state.step] ?? [];
}
