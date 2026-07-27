// Turning keyboard events into canonical key tokens, comparing chords, and
// knowing which chords the browser or the OS will swallow before we see them.

const CODE_TO_TOKEN: Record<string, string> = {
  Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]",
  Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/",
  Enter: "Enter", Space: "Space", Tab: "Tab", Backspace: "Backspace", Escape: "Esc",
  Delete: "Delete", Insert: "Insert", Home: "Home", End: "End",
  PageUp: "PageUp", PageDown: "PageDown",
  ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
  CapsLock: "CapsLock", PrintScreen: "PrintScreen", ScrollLock: "ScrollLock", Pause: "Pause",
  ContextMenu: "Menu",
};
for (let i = 1; i <= 12; i++) CODE_TO_TOKEN[`F${i}`] = `F${i}`;
for (let i = 0; i <= 9; i++) CODE_TO_TOKEN[`Digit${i}`] = `${i}`;
for (let c = 65; c <= 90; c++) {
  const letter = String.fromCharCode(c);
  CODE_TO_TOKEN[`Key${letter}`] = letter;
}

export const MODIFIERS = ["Ctrl", "Shift", "Alt", "Win"] as const;
const MODIFIER_SET = new Set<string>(MODIFIERS);

export const isModifier = (token: string) => MODIFIER_SET.has(token);

/**
 * The chord a key press represents, or null while only modifiers are held.
 * A chord is always "the modifiers being held plus the one real key".
 */
export function eventToChord(e: KeyboardEvent): string[] | null {
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return null;
  const key = CODE_TO_TOKEN[e.code];
  if (!key) return null;
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.shiftKey) mods.push("Shift");
  if (e.altKey) mods.push("Alt");
  if (e.metaKey) mods.push("Win");
  return [...mods, key];
}

/** Chords match as sets: modifier order and left/right variants don't matter. */
export function chordMatches(expected: string[], actual: string[]): boolean {
  if (expected.length !== actual.length) return false;
  const wanted = new Set(expected);
  return actual.every((t) => wanted.has(t));
}

/** The single non-modifier key of a chord, if it is well formed. */
export function mainKey(chord: string[]): string | null {
  const keys = chord.filter((t) => !isModifier(t));
  return keys.length === 1 ? keys[0]! : null;
}

/**
 * Chords the page will never receive: the browser or Windows acts on them
 * first, and preventDefault cannot stop it. Pressing some of these would
 * close the tab or reload the page mid-challenge, so these questions have to
 * be answered by clicking the on-screen keyboard instead.
 */
export function isReserved(chord: string[]): boolean {
  const key = mainKey(chord);
  if (key === null) return true;
  const has = (m: string) => chord.includes(m);

  if (has("Win")) return true; // the OS owns every Win combination
  if (has("Alt") && (key === "Tab" || key === "F4")) return true;
  if (has("Ctrl") && has("Shift") && key === "Esc") return true; // task manager
  if (key === "F5" || key === "F11" || key === "F12") return true;

  if (has("Ctrl")) {
    // Tab and window management, plus reload.
    if (["W", "N", "T", "R", "Tab", "PageUp", "PageDown"].includes(key)) return true;
    if (/^[0-9]$/.test(key)) return true;
  }
  return false;
}

/** Whether a shortcut can be typed on a physical keyboard inside a browser. */
export const isTypable = (keys: string[][]) => keys.every((chord) => !isReserved(chord));

export const formatChord = (chord: string[]) => chord.join("+");
export const formatKeys = (keys: string[][]) => keys.map(formatChord).join("  poi  ");
