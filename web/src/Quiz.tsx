import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { eventToStep, quizzable, stepMatches } from "./chords";
import type { Keybind, Profile } from "./types";

interface Props {
  profile: Profile;
}

type Feedback = "idle" | "wrong" | "right" | "revealed";

export function Quiz({ profile }: Props) {
  const pool = useMemo(() => profile.keybinds.filter((k) => quizzable(k.keys)), [profile]);
  const [current, setCurrent] = useState<Keybind | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const nextTimer = useRef<number>(undefined);

  const nextQuestion = useCallback(() => {
    window.clearTimeout(nextTimer.current);
    void api.clear();
    const candidates = pool.filter((k) => k.id !== current?.id);
    const pick = candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0] ?? null;
    setCurrent(pick);
    setStepIndex(0);
    setErrors(0);
    setFeedback("idle");
  }, [pool, current]);

  useEffect(() => {
    if (current === null && pool.length > 0) nextQuestion();
  }, [current, pool, nextQuestion]);

  useEffect(() => () => window.clearTimeout(nextTimer.current), []);

  const reveal = useCallback(
    (solved: boolean) => {
      if (!current) return;
      setFeedback(solved ? "right" : "revealed");
      setScore((s) => ({ right: s.right + (solved ? 1 : 0), total: s.total + 1 }));
      void api.highlight(profile.id, current.id);
      nextTimer.current = window.setTimeout(nextQuestion, solved ? 2000 : 5000);
    },
    [current, profile.id, nextQuestion],
  );

  useEffect(() => {
    if (!current || feedback === "right" || feedback === "revealed") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const pressed = eventToStep(e);
      if (!pressed) return;
      e.preventDefault();
      if (stepMatches(current.keys[stepIndex], pressed)) {
        if (stepIndex + 1 >= current.keys.length) {
          reveal(true);
        } else {
          setStepIndex((i) => i + 1);
          setFeedback("idle");
        }
      } else {
        setFeedback("wrong");
        setErrors((n) => {
          if (n + 1 >= 2) reveal(false);
          return n + 1;
        });
        setStepIndex(0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, stepIndex, feedback, reveal]);

  if (pool.length === 0) {
    return <p className="muted">Questo profilo non ha keybind verificabili nel browser.</p>;
  }
  if (!current) return null;

  return (
    <div className="quiz">
      <div className="quiz-score">
        Punteggio: {score.right}/{score.total}
      </div>
      <p className="quiz-question">{current.action}</p>
      {current.keys.length > 1 && (
        <p className="muted">
          Sequenza di {current.keys.length} passaggi, passo {stepIndex + 1}
        </p>
      )}
      {feedback === "wrong" && <p className="quiz-wrong">Sbagliato, riprova ({errors}/2)</p>}
      {feedback === "right" && <p className="quiz-right">Esatto!</p>}
      {feedback === "revealed" && (
        <p className="quiz-revealed">
          La risposta era: {current.keys.map((c) => c.join("+")).join("  poi  ")} (guarda la tastiera)
        </p>
      )}
      <div className="quiz-actions">
        <button onClick={() => reveal(false)}>Mostra la soluzione</button>
        <button onClick={nextQuestion}>Salta</button>
      </div>
      <p className="muted">
        Premi la combinazione direttamente sulla tastiera. Le scorciatoie con il tasto Win sono
        escluse perche' il sistema le intercetta.
      </p>
    </div>
  );
}
