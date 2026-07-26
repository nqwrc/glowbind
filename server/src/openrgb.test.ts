import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { OpenRGBService } from "./openrgb.js";

// A minimal OpenRGB SDK server presenting one fake keyboard, so the lighting
// path can be tested without RGB hardware. Protocol version 5.

const CMD = {
  controllerCount: 0,
  controllerData: 1,
  protocolVersion: 40,
  setClientName: 50,
  updateLeds: 1050,
  updateMode: 1101,
};

export const LED_NAMES = [
  "Key: Escape", "Key: F1", "Key: K", "Key: S", "Key: A",
  "Key: \\ (ANSI)", "Key: /", "Key: P",
  "Key: Left Control", "Key: Right Control",
  "Key: Left Shift", "Key: Right Shift",
  "Key: Left Windows", "Key: Left Alt", "Key: Space",
];

const INITIAL = LED_NAMES.map((_, i) => ({ red: 200, green: i, blue: 50 }));

interface Rgb {
  red: number;
  green: number;
  blue: number;
}

function str(s: string): Buffer {
  const bytes = Buffer.from(s, "ascii");
  const b = Buffer.alloc(2 + bytes.length + 1);
  b.writeUInt16LE(bytes.length + 1, 0);
  bytes.copy(b, 2);
  return b;
}
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const i32 = (n: number) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const mode = (name: string) => Buffer.concat([str(name), i32(0), Buffer.alloc(46)]);

function deviceBuffer(): Buffer {
  const body = Buffer.concat([
    i32(5), // keyboard
    str("Mock RGB Keyboard"), str("MockCorp"), str("test device"),
    str("1.0"), str("SN1"), str("HID: /mock"),
    u16(1), i32(0), mode("Direct"),
    u16(1),
    Buffer.concat([
      str("Keyboard"), i32(1),
      u32(LED_NAMES.length), u32(LED_NAMES.length), u32(LED_NAMES.length),
      u16(0), u16(0), u32(0),
    ]),
    u16(LED_NAMES.length),
    ...LED_NAMES.map((n) => Buffer.concat([str(n), u32(0)])),
    u16(INITIAL.length),
    ...INITIAL.map((c) => Buffer.from([c.red, c.green, c.blue, 0])),
    u16(0), u32(1),
  ]);
  return Buffer.concat([u32(body.length + 4), body]);
}

function header(deviceId: number, commandId: number, length: number): Buffer {
  const b = Buffer.alloc(16);
  b.write("ORGB", "ascii");
  b.writeUInt32LE(deviceId, 4);
  b.writeUInt32LE(commandId, 8);
  b.writeUInt32LE(length, 12);
  return b;
}

class MockOpenRGB {
  readonly updates: Rgb[][] = [];
  modeSet = false;
  private server = net.createServer();
  private sockets = new Set<net.Socket>();

  async listen(): Promise<number> {
    this.server.on("connection", (sock) => {
      this.sockets.add(sock);
      sock.on("error", () => {});
      sock.on("close", () => this.sockets.delete(sock));
      let buf = Buffer.alloc(0);
      sock.on("data", (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 16) {
          const len = buf.readUInt32LE(12);
          if (buf.length < 16 + len) break;
          const deviceId = buf.readUInt32LE(4);
          const cmd = buf.readUInt32LE(8);
          const body = buf.subarray(16, 16 + len);
          buf = buf.subarray(16 + len);
          const reply = (payload: Buffer) =>
            sock.write(Buffer.concat([header(deviceId, cmd, payload.length), payload]));

          if (cmd === CMD.protocolVersion) reply(u32(5));
          else if (cmd === CMD.controllerCount) reply(u32(1));
          else if (cmd === CMD.controllerData) reply(deviceBuffer());
          else if (cmd === CMD.updateMode) this.modeSet = true;
          else if (cmd === CMD.updateLeds) {
            const count = body.readUInt16LE(4);
            const colors: Rgb[] = [];
            for (let i = 0; i < count; i++) {
              const o = 6 + i * 4;
              colors.push({ red: body[o]!, green: body[o + 1]!, blue: body[o + 2]! });
            }
            this.updates.push(colors);
          }
        }
      });
    });
    await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));
    return (this.server.address() as net.AddressInfo).port;
  }

  /** Drop every connection abruptly, as if OpenRGB was killed. */
  kill() {
    for (const s of this.sockets) s.destroy();
    this.server.close();
  }

  async close() {
    this.kill();
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 4000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("timeout waiting for condition");
    await new Promise((r) => setTimeout(r, 25));
  }
}

const litTokens = (colors: Rgb[]) =>
  colors
    .map((c, i) => ({ c, name: LED_NAMES[i]! }))
    .filter(({ c }) => !(c.red === 12 && c.green === 12 && c.blue === 14))
    .map(({ c, name }) => `${name}:${c.red === 255 ? "KEY" : "MOD"}`);

describe("OpenRGBService against a mock OpenRGB server", () => {
  let mock: MockOpenRGB | null = null;
  let service: OpenRGBService | null = null;

  afterEach(async () => {
    await service?.stop();
    await mock?.close();
    mock = null;
    service = null;
  });

  async function connected() {
    mock = new MockOpenRGB();
    const port = await mock.listen();
    service = new OpenRGBService("127.0.0.1", port);
    service.start();
    await waitFor(() => service!.connected && service!.keyboardNames.length > 0);
    return { mock, service };
  }

  it("detects the keyboard and switches it to Direct mode", async () => {
    const { mock: m, service: s } = await connected();
    expect(s.keyboardNames).toEqual(["Mock RGB Keyboard"]);
    expect(m.modeSet).toBe(true);
  });

  it("lights modifiers and the final key, dimming everything else", async () => {
    const { mock: m, service: s } = await connected();
    await s.showChord(["Ctrl", "\\"]);
    await waitFor(() => m.updates.length > 0);

    const last = m.updates.at(-1)!;
    expect(last).toHaveLength(LED_NAMES.length);
    expect(litTokens(last).sort()).toEqual(
      ["Key: \\ (ANSI):KEY", "Key: Left Control:MOD", "Key: Right Control:MOD"].sort(),
    );
  });

  it("restores the original colors", async () => {
    const { mock: m, service: s } = await connected();
    await s.showChord(["Ctrl", "S"]);
    await waitFor(() => m.updates.length > 0);
    await s.restore();
    await waitFor(() => m.updates.length > 1);

    expect(m.updates.at(-1)).toEqual(INITIAL);
  });

  // Regression: the SDK re-emits socket errors on the client. With no "error"
  // listener Node treats them as unhandled and kills the process, so closing
  // OpenRGB while the app ran used to crash the whole server.
  it("survives OpenRGB dying mid-session and keeps working", async () => {
    const { mock: m, service: s } = await connected();
    await s.showChord(["Ctrl", "S"]);
    await waitFor(() => m.updates.length > 0);

    m.kill();
    await waitFor(() => !s.connected);

    expect(s.keyboardNames).toEqual([]);
    // Lighting calls must degrade to no-ops rather than throw.
    await expect(s.showChord(["Ctrl", "A"])).resolves.toBeUndefined();
    await expect(s.restore()).resolves.toBeUndefined();
  });
});
