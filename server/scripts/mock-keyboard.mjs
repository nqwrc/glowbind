// A fake OpenRGB SDK server exposing one 87-key RGB keyboard, drawn in the
// terminal and repainted every time glowbind updates the LEDs.
// Lets you see the physical-lighting path without owning an RGB keyboard.
//
//   npm run mock-keyboard        (terminal 1)
//   npm run start:mock           (terminal 2)
import net from "node:net";

const PORT = Number(process.argv[2] ?? process.env.MOCK_PORT ?? 6799);
const PROTOCOL = 5;

const CMD = {
  controllerCount: 0,
  controllerData: 1,
  protocolVersion: 40,
  setClientName: 50,
  updateLeds: 1050,
  updateMode: 1101,
};

// Keyboard layout: [OpenRGB LED name, label shown in the terminal].
// null is a visual spacer and has no LED. Names match what real OpenRGB
// reports, so this exercises the same key mapping as real hardware.
const letters = (s) => s.split("").map((c) => [`Key: ${c}`, c]);
const ROWS = [
  [
    ["Key: Escape", "Esc"], null,
    ...Array.from({ length: 12 }, (_, i) => [`Key: F${i + 1}`, `F${i + 1}`]), null,
    ["Key: Print Screen", "Stmp"], ["Key: Scroll Lock", "Bloc"], ["Key: Pause/Break", "Paus"],
  ],
  [
    ["Key: `", "`"],
    ...Array.from({ length: 10 }, (_, i) => [`Key: ${(i + 1) % 10}`, `${(i + 1) % 10}`]),
    ["Key: -", "-"], ["Key: =", "="], ["Key: Backspace", "<--"], null,
    ["Key: Insert", "Ins"], ["Key: Home", "Home"], ["Key: Page Up", "PgSu"],
  ],
  [
    ["Key: Tab", "Tab"], ...letters("QWERTYUIOP"),
    ["Key: [", "["], ["Key: ]", "]"], ["Key: \\ (ANSI)", "\\"], null,
    ["Key: Delete", "Canc"], ["Key: End", "Fine"], ["Key: Page Down", "PgGi"],
  ],
  [
    ["Key: Caps Lock", "Caps"], ...letters("ASDFGHJKL"),
    ["Key: ;", ";"], ["Key: '", "'"], ["Key: Enter", "Inv"],
  ],
  [
    ["Key: Left Shift", "Shift"], ...letters("ZXCVBNM"),
    ["Key: ,", ","], ["Key: .", "."], ["Key: /", "/"], ["Key: Right Shift", "Shift"], null,
    ["Key: Up Arrow", "Su"],
  ],
  [
    ["Key: Left Control", "Ctrl"], ["Key: Left Windows", "Win"], ["Key: Left Alt", "Alt"],
    ["Key: Space", "Spazio"],
    ["Key: Right Alt", "Alt"], ["Key: Right Windows", "Win"], ["Key: Menu", "Menu"],
    ["Key: Right Control", "Ctrl"], null,
    ["Key: Left Arrow", "Sin"], ["Key: Down Arrow", "Giu"], ["Key: Right Arrow", "Des"],
  ],
];

const KEYS = ROWS.flat().filter(Boolean);
const LED_NAMES = KEYS.map(([name]) => name);
const LABELS = new Map(KEYS);

// Rainbow idle colors, so restoring them is obvious on screen.
const INITIAL = LED_NAMES.map((_, i) => {
  const h = (i / LED_NAMES.length) * 360;
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (0.5 - 0.35 * Math.max(-1, Math.min(k - 3, 5 - k, 1))));
  };
  return { red: f(5), green: f(3), blue: f(1) };
});

let current = INITIAL.map((c) => ({ ...c }));

// ---------------------------------------------------------------- rendering

const CELL = 6;

function paint(note) {
  const color = process.stdout.isTTY;
  const lines = [];
  let index = 0;
  for (const row of ROWS) {
    let line = "";
    for (const key of row) {
      if (!key) {
        line += " ".repeat(CELL);
        continue;
      }
      const label = LABELS.get(key[0]).slice(0, CELL - 2);
      const cell = ` ${label.padEnd(CELL - 2)} `;
      const { red, green, blue } = current[index++];
      if (color) {
        const dark = red * 0.299 + green * 0.587 + blue * 0.114 > 140;
        line += `\x1b[48;2;${red};${green};${blue}m\x1b[38;2;${
          dark ? "0;0;0" : "230;230;230"
        }m${cell}\x1b[0m`;
      } else {
        const off = red === 12 && green === 12 && blue === 14;
        line += off ? ` ${".".repeat(CELL - 2)} ` : `[${label.padEnd(CELL - 2)}]`;
      }
    }
    lines.push(line);
  }
  const out = [
    `  Mock RGB Keyboard - ${LED_NAMES.length} LED - porta ${PORT}`,
    "",
    ...lines,
    "",
    `  ${note}`,
    "",
  ].join("\n");
  if (color) process.stdout.write(`\x1b[2J\x1b[H${out}`);
  else console.log(out);
}

// ----------------------------------------------------------------- protocol

function str(s) {
  const bytes = Buffer.from(s, "ascii");
  const b = Buffer.alloc(2 + bytes.length + 1);
  b.writeUInt16LE(bytes.length + 1, 0);
  bytes.copy(b, 2);
  return b;
}
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const mode = (name) => Buffer.concat([str(name), i32(0), Buffer.alloc(46)]);

function deviceBuffer() {
  const body = Buffer.concat([
    i32(5), // device type: keyboard
    str("Mock RGB Keyboard"), str("MockCorp"), str("tastiera finta per demo"),
    str("1.0"), str("SN1"), str("HID: /mock"),
    u16(2), i32(0), mode("Direct"), mode("Static"),
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

function header(deviceId, commandId, length) {
  const b = Buffer.alloc(16);
  b.write("ORGB", "ascii");
  b.writeUInt32LE(deviceId, 4);
  b.writeUInt32LE(commandId, 8);
  b.writeUInt32LE(length, 12);
  return b;
}

const server = net.createServer((sock) => {
  paint("app collegata, in attesa di una scorciatoia...");
  sock.on("error", () => {});
  sock.on("close", () => paint("app disconnessa."));
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
      const reply = (payload) =>
        sock.write(Buffer.concat([header(deviceId, cmd, payload.length), payload]));

      if (cmd === CMD.protocolVersion) reply(u32(PROTOCOL));
      else if (cmd === CMD.controllerCount) reply(u32(1));
      else if (cmd === CMD.controllerData) reply(deviceBuffer());
      else if (cmd === CMD.updateMode) paint("modalita' Direct attivata dall'app.");
      else if (cmd === CMD.updateLeds) {
        const count = body.readUInt16LE(4);
        const colors = [];
        for (let i = 0; i < count; i++) {
          const o = 6 + i * 4;
          colors.push({ red: body[o], green: body[o + 1], blue: body[o + 2] });
        }
        current = colors;
        const lit = colors
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => !(c.red === 12 && c.green === 12 && c.blue === 14))
          .map(({ i }) => LABELS.get(LED_NAMES[i]));
        const restored = colors.every(
          (c, i) => c.red === INITIAL[i].red && c.green === INITIAL[i].green && c.blue === INITIAL[i].blue,
        );
        paint(restored ? "colori originali ripristinati." : `tasti accesi: ${lit.join(" + ")}`);
      }
    }
  });
});

server.listen(PORT, "127.0.0.1", () =>
  paint(`in ascolto. Avvia l'app con: npm run start:mock`),
);
