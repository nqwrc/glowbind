// Turns KeyboardEvents into canonical key tokens and checks quiz answers.

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

const MODIFIER_TOKENS = new Set(["Ctrl", "Shift", "Alt", "Win"]);

export interface PressedStep {
  mods: Set<string>;
  key: string | null;
}

/** null when the event is a bare modifier press (not a complete step yet). */
export function eventToStep(e: KeyboardEvent): PressedStep | null {
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return null;
  const mods = new Set<string>();
  if (e.ctrlKey) mods.add("Ctrl");
  if (e.shiftKey) mods.add("Shift");
  if (e.altKey) mods.add("Alt");
  if (e.metaKey) mods.add("Win");
  const key = CODE_TO_TOKEN[e.code] ?? null;
  if (key === null) return null;
  return { mods, key };
}

/** Does a pressed step match the expected chord (e.g. ["Ctrl","Shift","P"])? */
export function stepMatches(expected: string[], pressed: PressedStep): boolean {
  const expectedMods = new Set(expected.filter((t) => MODIFIER_TOKENS.has(t)));
  const expectedKeys = expected.filter((t) => !MODIFIER_TOKENS.has(t));
  if (expectedKeys.length !== 1) return false;
  if (expectedKeys[0] !== pressed.key) return false;
  if (expectedMods.size !== pressed.mods.size) return false;
  for (const m of expectedMods) if (!pressed.mods.has(m)) return false;
  return true;
}

/** Keybinds the quiz can verify in the browser (the OS swallows Win combos). */
export function quizzable(keys: string[][]): boolean {
  return keys.every(
    (chord) => !chord.includes("Win") && chord.filter((t) => !MODIFIER_TOKENS.has(t)).length === 1,
  );
}
