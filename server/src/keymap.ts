// Maps canonical key tokens used in profiles (e.g. "Ctrl", "A", "PageUp")
// to the LED names OpenRGB reports for keyboards (e.g. "Key: Left Control").

// Candidate LED names per token. Matching is case-insensitive and the first
// existing candidate wins; for modifiers all present candidates are lit so
// both left and right variants glow.
const CANDIDATES: Record<string, string[]> = {
  Ctrl: ["Key: Left Control", "Key: Right Control"],
  Shift: ["Key: Left Shift", "Key: Right Shift"],
  Alt: ["Key: Left Alt", "Key: Right Alt"],
  Win: ["Key: Left Windows", "Key: Right Windows", "Key: Left Super", "Key: Left GUI"],
  Menu: ["Key: Menu"],
  Esc: ["Key: Escape"],
  Enter: ["Key: Enter", "Key: Return"],
  Space: ["Key: Space", "Key: Spacebar"],
  Tab: ["Key: Tab"],
  Backspace: ["Key: Backspace"],
  CapsLock: ["Key: Caps Lock"],
  Delete: ["Key: Delete"],
  Insert: ["Key: Insert"],
  Home: ["Key: Home"],
  End: ["Key: End"],
  PageUp: ["Key: Page Up"],
  PageDown: ["Key: Page Down"],
  Up: ["Key: Up Arrow"],
  Down: ["Key: Down Arrow"],
  Left: ["Key: Left Arrow"],
  Right: ["Key: Right Arrow"],
  PrintScreen: ["Key: Print Screen"],
  ScrollLock: ["Key: Scroll Lock"],
  Pause: ["Key: Pause/Break", "Key: Pause"],
  "`": ["Key: `", "Key: Backtick", "Key: Grave"],
  "-": ["Key: -", "Key: Minus"],
  "=": ["Key: =", "Key: Equals"],
  "[": ["Key: [", "Key: Left Bracket"],
  "]": ["Key: ]", "Key: Right Bracket"],
  "\\": ["Key: \\ (ANSI)", "Key: \\", "Key: ANSI \\", "Key: Backslash"],
  ";": ["Key: ;", "Key: Semicolon"],
  "'": ["Key: '", "Key: Apostrophe", "Key: Quote"],
  ",": ["Key: ,", "Key: Comma"],
  ".": ["Key: .", "Key: Period"],
  "/": ["Key: /", "Key: Slash"],
};

for (let i = 1; i <= 12; i++) CANDIDATES[`F${i}`] = [`Key: F${i}`];
for (let i = 0; i <= 9; i++) CANDIDATES[`${i}`] = [`Key: ${i}`];
for (let c = 65; c <= 90; c++) {
  const letter = String.fromCharCode(c);
  CANDIDATES[letter] = [`Key: ${letter}`];
}

export const KNOWN_TOKENS = new Set(Object.keys(CANDIDATES));

/**
 * Given the LED name list of an OpenRGB keyboard, build a map from canonical
 * token to the LED indices to light for that token.
 */
export function buildKeymap(ledNames: string[]): Map<string, number[]> {
  const byName = new Map<string, number>();
  ledNames.forEach((name, i) => {
    const key = name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, i);
  });

  const map = new Map<string, number[]>();
  for (const [token, candidates] of Object.entries(CANDIDATES)) {
    const indices: number[] = [];
    for (const candidate of candidates) {
      const idx = byName.get(candidate.toLowerCase());
      if (idx !== undefined) indices.push(idx);
    }
    if (indices.length === 0) {
      // Last resort: substring match ("K_A", "A key", vendor-specific names).
      const tokenLower = token.toLowerCase();
      ledNames.forEach((name, i) => {
        const n = name.trim().toLowerCase();
        if (n === tokenLower || n === `key: ${tokenLower}`) indices.push(i);
      });
    }
    if (indices.length > 0) map.set(token, indices);
  }
  return map;
}
