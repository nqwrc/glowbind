import { describe, expect, it } from "vitest";
import { buildKeymap, KNOWN_TOKENS } from "./keymap.js";
import { loadProfiles } from "./profiles.js";

// LED name sample as reported by OpenRGB for a typical ANSI keyboard.
const LEDS = [
  "Key: Escape", "Key: F1", "Key: F5", "Key: F12",
  "Key: `", "Key: 1", "Key: 0", "Key: -", "Key: =", "Key: Backspace",
  "Key: Tab", "Key: Q", "Key: P", "Key: [", "Key: ]", "Key: \\ (ANSI)",
  "Key: Caps Lock", "Key: A", "Key: ;", "Key: '", "Key: Enter",
  "Key: Left Shift", "Key: Z", "Key: /", "Key: Right Shift",
  "Key: Left Control", "Key: Left Windows", "Key: Left Alt", "Key: Space",
  "Key: Right Alt", "Key: Right Control", "Key: Menu",
  "Key: Up Arrow", "Key: Left Arrow", "Key: Page Up", "Key: Print Screen",
];

describe("buildKeymap", () => {
  const map = buildKeymap(LEDS);

  it("maps letters, digits and function keys", () => {
    expect(map.get("A")).toEqual([LEDS.indexOf("Key: A")]);
    expect(map.get("0")).toEqual([LEDS.indexOf("Key: 0")]);
    expect(map.get("F12")).toEqual([LEDS.indexOf("Key: F12")]);
  });

  it("maps modifiers to every present variant", () => {
    expect(map.get("Ctrl")).toEqual([
      LEDS.indexOf("Key: Left Control"),
      LEDS.indexOf("Key: Right Control"),
    ]);
    expect(map.get("Win")).toEqual([LEDS.indexOf("Key: Left Windows")]);
  });

  it("maps punctuation including the ANSI backslash variant", () => {
    expect(map.get("\\")).toEqual([LEDS.indexOf("Key: \\ (ANSI)")]);
    expect(map.get("`")).toEqual([LEDS.indexOf("Key: `")]);
  });

  it("omits tokens with no matching LED", () => {
    expect(map.has("F2")).toBe(false);
  });

  it("matches case-insensitively", () => {
    const lower = buildKeymap(["key: a", "KEY: LEFT CONTROL"]);
    expect(lower.get("A")).toEqual([0]);
    expect(lower.get("Ctrl")).toEqual([1]);
  });
});

const BUNDLED_PROFILE_NAMES = [
  "Adobe Photoshop",
  "Figma",
  "Google Chrome",
  "IntelliJ IDEA",
  "Microsoft Excel",
  "VS Code",
  "Windows 11",
];

describe("profiles", () => {
  it("load, validate and only use known key tokens", async () => {
    const profiles = await loadProfiles();
    const names = Array.from(profiles.values(), (profile) => profile.name).sort();
    expect(names).toEqual(BUNDLED_PROFILE_NAMES);
    for (const profile of profiles.values()) {
      for (const kb of profile.keybinds) {
        for (const chord of kb.keys) {
          for (const token of chord) expect(KNOWN_TOKENS.has(token)).toBe(true);
        }
      }
    }
  });
});
