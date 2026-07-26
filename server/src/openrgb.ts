import openrgbSdk from "openrgb-sdk";
import type { Client } from "openrgb-sdk";

// openrgb-sdk is CommonJS: named ESM imports are not available at runtime.
const { Client: OpenRGBClient, utils } = openrgbSdk;
import { buildKeymap } from "./keymap.js";

type RGBColor = { red: number; green: number; blue: number };

const DIM: RGBColor = { red: 12, green: 12, blue: 14 };
const MODIFIER: RGBColor = { red: 0, green: 140, blue: 255 };
const KEY: RGBColor = { red: 255, green: 120, blue: 0 };

interface KeyboardDevice {
  deviceId: number;
  name: string;
  ledCount: number;
  keymap: Map<string, number[]>;
  savedColors: RGBColor[] | null;
}

/**
 * Resilient wrapper around the OpenRGB SDK server connection.
 * Reconnects in the background; all lighting calls are no-ops while offline.
 */
export class OpenRGBService {
  private client: Client | null = null;
  private keyboards: KeyboardDevice[] = [];
  private retryTimer: NodeJS.Timeout | null = null;
  private connecting = false;

  constructor(
    private host = process.env.OPENRGB_HOST ?? "127.0.0.1",
    private port = Number(process.env.OPENRGB_PORT ?? 6742),
  ) {}

  get connected(): boolean {
    return this.client !== null;
  }

  get keyboardNames(): string[] {
    return this.keyboards.map((k) => k.name);
  }

  start() {
    void this.tryConnect();
    this.retryTimer = setInterval(() => {
      if (!this.connected) void this.tryConnect();
    }, 5000);
  }

  async stop() {
    if (this.retryTimer) clearInterval(this.retryTimer);
    await this.restore();
    try {
      this.client?.disconnect();
    } catch {
      // ignore
    }
    this.client = null;
  }

  private async tryConnect() {
    if (this.connecting) return;
    this.connecting = true;
    const client = new OpenRGBClient("glowbind", this.port, this.host);
    // The SDK re-emits socket errors on the client. Without a listener Node
    // treats them as unhandled and kills the process, so attach one before
    // connecting: closing OpenRGB must not take the app down.
    client.on("error", () => this.drop(client));
    client.on("disconnect", () => this.drop(client));
    try {
      await client.connect();
      const count = await client.getControllerCount();
      const keyboards: KeyboardDevice[] = [];
      for (let i = 0; i < count; i++) {
        const device = await client.getControllerData(i);
        if (device.type !== utils.deviceType.keyboard) continue;
        const ledNames = device.leds.map((l: { name: string }) => l.name);
        keyboards.push({
          deviceId: i,
          name: device.name,
          ledCount: device.colors.length,
          keymap: buildKeymap(ledNames),
          savedColors: null,
        });
        // Direct mode is required for per-LED control; ignore failures on
        // keyboards that expose no such mode.
        try {
          await client.updateMode(i, "Direct");
        } catch {
          // ignore
        }
      }
      this.client = client;
      this.keyboards = keyboards;
      console.log(
        `[openrgb] connected, keyboards: ${keyboards.map((k) => k.name).join(", ") || "none"}`,
      );
    } catch {
      try {
        client.disconnect();
      } catch {
        // ignore
      }
    } finally {
      this.connecting = false;
    }
  }

  /** Light one chord step: whole board dimmed, chord keys highlighted. */
  async showChord(tokens: string[]) {
    if (!this.client) return;
    for (const kb of this.keyboards) {
      if (kb.savedColors === null) {
        try {
          const device = await this.client.getControllerData(kb.deviceId);
          kb.savedColors = device.colors;
        } catch {
          continue;
        }
      }
      const colors: RGBColor[] = Array.from({ length: kb.ledCount }, () => ({ ...DIM }));
      tokens.forEach((token, i) => {
        const isFinal = i === tokens.length - 1 && tokens.length > 1;
        for (const led of kb.keymap.get(token) ?? []) {
          colors[led] = { ...(isFinal ? KEY : tokens.length === 1 ? KEY : MODIFIER) };
        }
      });
      this.safeUpdate(kb.deviceId, colors);
    }
  }

  /** Restore the colors each keyboard had before the first showChord. */
  async restore() {
    if (!this.client) return;
    for (const kb of this.keyboards) {
      if (kb.savedColors) {
        this.safeUpdate(kb.deviceId, kb.savedColors);
        kb.savedColors = null;
      }
    }
  }

  private safeUpdate(deviceId: number, colors: RGBColor[]) {
    try {
      this.client?.updateLeds(deviceId, colors);
    } catch {
      if (this.client) this.drop(this.client);
    }
  }

  /** Forget a dead connection so the retry loop can pick up a fresh one. */
  private drop(client: Client) {
    if (this.client !== client) return;
    this.client = null;
    this.keyboards = [];
    console.log("[openrgb] connection lost, will retry");
  }
}
