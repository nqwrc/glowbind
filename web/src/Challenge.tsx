import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Keyboard } from "./Keyboard";
import { chordMatches, eventToChord, formatKeys, isModifier, isReserved } from "./chords";
import { lighting, useLitKeys } from "./engine/lighting";
import {
  buildChallenge,
  scoreOf,
  verdict,
  type Answer,
  type Outcome,
} from "./engine/challenge";
import type { Keybind, Profile } from "./types";

type Feedback = "idle" | "wrong" | "right" | "revealed";

interface State {
  questions: Keybind[];
  index: number;
  stepIndex: number;
  selection: string[];
  attempts: number;
  answers: Answer[];
  feedback: Feedback;
}

type Action =
  | { type: "restart"; questions: Keybind[] }
  | { type: "toggleModifier"; token: string }
  | { type: "submit"; chord: string[] }
  | { type: "pressKey"; token: string }
  | { type: "giveUp" }
  | { type: "advance" };

const settled = (f: Feedback) => f === "right" || f === "revealed";

const answered = (state: State, outcome: Outcome): State => ({
  ...state,
  selection: [],
  stepIndex: 0,
  feedback: outcome === "failed" ? "revealed" : "right",
  answers: [...state.answers, { keybind: state.questions[state.index]!, outcome }],
});

/** Score one attempt against the step the player is currently on. */
function judge(state: State, chord: string[]): State {
  const question = state.questions[state.index]!;
  if (chordMatches(question.keys[state.stepIndex]!, chord)) {
    if (state.stepIndex + 1 < question.keys.length) {
      return { ...state, stepIndex: state.stepIndex + 1, selection: [], feedback: "idle" };
    }
    return answered(state, state.attempts === 0 ? "first" : "retry");
  }
  const attempts = state.attempts + 1;
  if (attempts >= 2) return answered({ ...state, attempts }, "failed");
  return { ...state, attempts, selection: [], stepIndex: 0, feedback: "wrong" };
}

// All game state moves through here, so a burst of clicks in the same tick
// still sees the latest selection and step instead of a stale render's copy.
function reducer(state: State, action: Action): State {
  const question = state.questions[state.index];

  switch (action.type) {
    case "restart":
      return {
        questions: action.questions,
        index: 0,
        stepIndex: 0,
        selection: [],
        attempts: 0,
        answers: [],
        feedback: "idle",
      };

    case "toggleModifier":
      if (!question || settled(state.feedback)) return state;
      return {
        ...state,
        selection: state.selection.includes(action.token)
          ? state.selection.filter((t) => t !== action.token)
          : [...state.selection, action.token],
      };

    // Clicking a real key completes whatever modifiers are currently selected.
    case "pressKey":
      if (!question || settled(state.feedback)) return state;
      return judge(state, [...state.selection, action.token]);

    case "submit":
      if (!question || settled(state.feedback)) return state;
      return judge(state, action.chord);

    case "giveUp":
      if (!question || settled(state.feedback)) return state;
      return answered(state, "failed");

    case "advance":
      return {
        ...state,
        index: state.index + 1,
        stepIndex: 0,
        selection: [],
        attempts: 0,
        feedback: "idle",
      };
  }
}

interface Props {
  profile: Profile;
}

export function Challenge({ profile }: Props) {
  const [state, dispatch] = useReducer(
    reducer,
    profile,
    (p): State => ({
      questions: buildChallenge(p),
      index: 0,
      stepIndex: 0,
      selection: [],
      attempts: 0,
      answers: [],
      feedback: "idle",
    }),
  );
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<number>(undefined);
  const litKeys = useLitKeys();

  const question = state.questions[state.index] ?? null;
  const done = question === null;
  const reserved = question !== null && question.keys.some(isReserved);

  const restart = useCallback(() => {
    window.clearTimeout(timer.current);
    lighting.clear();
    dispatch({ type: "restart", questions: buildChallenge(profile) });
    setStartedAt(Date.now());
    setSeconds(0);
  }, [profile]);

  // Reveal the answer, then move on. Wrong answers linger longer to read.
  useEffect(() => {
    if (!settled(state.feedback) || question === null) return;
    lighting.show(question.keys);
    timer.current = window.setTimeout(
      () => {
        lighting.clear();
        dispatch({ type: "advance" });
      },
      state.feedback === "revealed" ? 3200 : 1300,
    );
    return () => window.clearTimeout(timer.current);
  }, [state.feedback, question]);

  useEffect(() => {
    if (done) setSeconds(Math.round((Date.now() - startedAt) / 1000));
  }, [done, startedAt]);

  useEffect(() => () => {
    window.clearTimeout(timer.current);
    lighting.clear();
  }, []);

  // Physical keyboard input.
  useEffect(() => {
    if (done) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const chord = eventToChord(e);
      if (!chord) return;
      e.preventDefault();
      dispatch({ type: "submit", chord });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [done]);

  // Mouse input: modifiers accumulate, a real key completes the chord.
  const press = useCallback((token: string) => {
    dispatch(isModifier(token) ? { type: "toggleModifier", token } : { type: "pressKey", token });
  }, []);

  const score = useMemo(() => scoreOf(state.answers), [state.answers]);

  if (done) {
    const missed = state.answers.filter((a) => a.outcome !== "first");
    return (
      <div className="panel results">
        <h2>{profile.name}: sfida completata</h2>
        <div className="score-hero">
          <div className="score-points">
            {score.points}
            <span> / {score.maxPoints}</span>
          </div>
          <div className="score-meta">
            <div>
              {score.correct} risposte giuste su {score.total}
            </div>
            <div className="muted">
              {score.percent}% - {seconds}s
            </div>
          </div>
        </div>
        <p>{verdict(score)}</p>

        {missed.length > 0 && (
          <>
            <h3>Da ripassare</h3>
            <ul className="review">
              {missed.map((a, i) => (
                <li key={i}>
                  <span className={a.outcome === "failed" ? "tag-failed" : "tag-retry"}>
                    {a.outcome === "failed" ? "sbagliata" : "al secondo tentativo"}
                  </span>
                  <span className="review-action">{a.keybind.action}</span>
                  <span className="review-keys">{formatKeys(a.keybind.keys)}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="actions">
          <button className="primary" onClick={restart}>
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="progress-row">
          <span className="muted">
            Domanda {state.index + 1} di {state.questions.length}
          </span>
          <span className="muted">{score.points} punti</span>
        </div>
        <div className="progress-bar">
          <div style={{ width: `${(state.index / state.questions.length) * 100}%` }} />
        </div>

        <p className="question">{question.action}</p>

        {question.keys.length > 1 && (
          <p className="muted">
            Sequenza di {question.keys.length} passaggi - passo {state.stepIndex + 1}
          </p>
        )}

        <p className="hint">
          {reserved
            ? "Questa scorciatoia e' intercettata dal sistema: componila cliccando i tasti qui sotto."
            : "Premila sulla tastiera, oppure clicca i tasti qui sotto."}
        </p>

        {state.feedback === "wrong" && (
          <p className="fb-wrong">Non e' quella. Ti resta un tentativo.</p>
        )}
        {state.feedback === "right" && <p className="fb-right">Esatto.</p>}
        {state.feedback === "revealed" && (
          <p className="fb-revealed">Era {formatKeys(question.keys)}</p>
        )}

        <div className="actions">
          <button onClick={() => dispatch({ type: "giveUp" })}>Mostra la soluzione</button>
        </div>
      </div>

      <Keyboard lit={litKeys} selected={state.selection} onPress={press} />
    </>
  );
}
