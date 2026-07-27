import { mainKey } from "./chords";
import { LAYOUT } from "./layout";

interface Props {
  /** Tokens of the chord being shown as the answer. */
  lit?: string[];
  /** Modifiers the player has clicked so far. */
  selected?: string[];
  /** When set, keys are clickable and this fires with the token. */
  onPress?: (token: string) => void;
}

export function Keyboard({ lit = [], selected = [], onPress }: Props) {
  const litSet = new Set(lit);
  const selectedSet = new Set(selected);
  const finalToken = mainKey(lit);
  const clickable = onPress !== undefined;

  return (
    <div className={`keyboard${clickable ? " clickable" : ""}`} aria-label="tastiera virtuale">
      {LAYOUT.map((row, ri) => (
        <div className="kb-row" key={ri}>
          {row.map((cell, ci) => {
            const w = cell.w ?? 1;
            if (cell.gap || cell.token === undefined) {
              return <div key={ci} className="kb-gap" style={{ flexGrow: w, flexBasis: 0 }} />;
            }
            const token = cell.token;
            const isLit = litSet.has(token);
            const cls = [
              "kb-key",
              isLit ? (token === finalToken ? "kb-final" : "kb-active") : "",
              selectedSet.has(token) ? "kb-selected" : "",
            ]
              .filter(Boolean)
              .join(" ");

            if (!clickable) {
              return (
                <div key={ci} className={cls} style={{ flexGrow: w, flexBasis: 0 }}>
                  {cell.label}
                </div>
              );
            }
            return (
              <button
                key={ci}
                type="button"
                className={cls}
                style={{ flexGrow: w, flexBasis: 0 }}
                onClick={() => onPress(token)}
              >
                {cell.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
