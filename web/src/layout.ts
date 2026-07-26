// Virtual keyboard layout (ANSI TKL) as data. Widths are in key units.
export interface LayoutKey {
  token?: string;
  label?: string;
  w?: number;
  gap?: boolean;
}

const k = (token: string, label?: string, w = 1): LayoutKey => ({ token, label: label ?? token, w });
const gap = (w: number): LayoutKey => ({ gap: true, w });

export const LAYOUT: LayoutKey[][] = [
  [
    k("Esc"), gap(1),
    k("F1"), k("F2"), k("F3"), k("F4"), gap(0.5),
    k("F5"), k("F6"), k("F7"), k("F8"), gap(0.5),
    k("F9"), k("F10"), k("F11"), k("F12"), gap(0.5),
    k("PrintScreen", "Stamp"), k("ScrollLock", "Bloc Scorr"), k("Pause", "Pausa"),
  ],
  [
    k("`"), k("1"), k("2"), k("3"), k("4"), k("5"), k("6"), k("7"), k("8"), k("9"), k("0"),
    k("-"), k("="), k("Backspace", "Backspace", 2), gap(0.5),
    k("Insert", "Ins"), k("Home"), k("PageUp", "Pag su"),
  ],
  [
    k("Tab", "Tab", 1.5), k("Q"), k("W"), k("E"), k("R"), k("T"), k("Y"), k("U"), k("I"),
    k("O"), k("P"), k("["), k("]"), k("\\", "\\", 1.5), gap(0.5),
    k("Delete", "Canc"), k("End", "Fine"), k("PageDown", "Pag giu"),
  ],
  [
    k("CapsLock", "Bloc Maiusc", 1.75), k("A"), k("S"), k("D"), k("F"), k("G"), k("H"),
    k("J"), k("K"), k("L"), k(";"), k("'"), k("Enter", "Invio", 2.25), gap(0.5), gap(3),
  ],
  [
    k("Shift", "Shift", 2.25), k("Z"), k("X"), k("C"), k("V"), k("B"), k("N"), k("M"),
    k(","), k("."), k("/"), k("Shift", "Shift", 2.75), gap(0.5),
    gap(1), k("Up", "Su"), gap(1),
  ],
  [
    k("Ctrl", "Ctrl", 1.25), k("Win", "Win", 1.25), k("Alt", "Alt", 1.25),
    k("Space", "Spazio", 6.25),
    k("Alt", "Alt", 1.25), k("Win", "Win", 1.25), k("Menu", "Menu", 1.25), k("Ctrl", "Ctrl", 1.25),
    gap(0.5),
    k("Left", "Sin"), k("Down", "Giu"), k("Right", "Des"),
  ],
];
