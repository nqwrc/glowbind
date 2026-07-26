import { LAYOUT } from "./layout";

interface Props {
  highlighted: string[];
}

export function Keyboard({ highlighted }: Props) {
  const active = new Set(highlighted);
  const lastToken = highlighted.length > 0 ? highlighted[highlighted.length - 1] : null;

  return (
    <div className="keyboard" aria-label="tastiera virtuale">
      {LAYOUT.map((row, ri) => (
        <div className="kb-row" key={ri}>
          {row.map((cell, ci) => {
            const w = cell.w ?? 1;
            if (cell.gap) {
              return <div key={ci} className="kb-gap" style={{ flexGrow: w, flexBasis: 0 }} />;
            }
            const isActive = cell.token !== undefined && active.has(cell.token);
            const isFinal = isActive && cell.token === lastToken;
            const cls = ["kb-key", isActive ? (isFinal ? "kb-final" : "kb-active") : ""].join(" ");
            return (
              <div key={ci} className={cls} style={{ flexGrow: w, flexBasis: 0 }}>
                {cell.label}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
