import { useEffect, useState } from "react";
import { Keyboard } from "./Keyboard";
import { formatKeys } from "./chords";
import { lighting, useLitKeys } from "./engine/lighting";
import { bridgePresent, query as bridgeQuery } from "./engine/bridge";
import { askGemini, loadKey, saveKey } from "./engine/gemini";
import { searchLocal, type Hit } from "./engine/search";
import type { Keybind, Profile } from "./types";

type Source = "bridge" | "gemini" | "locale";

interface Outcome {
  best: Keybind | null;
  alternatives: Keybind[];
  explanation: string;
  confidence: number;
  source: Source;
}

interface Props {
  profile: Profile;
}

const asOutcome = (hits: Hit[]): Outcome => ({
  best: hits[0]?.keybind ?? null,
  alternatives: hits.slice(1).map((h) => h.keybind),
  explanation: hits[0]?.keybind.action ?? "Nessuna scorciatoia corrisponde alla richiesta.",
  confidence: hits[0]?.confidence ?? 0,
  source: "locale",
});

export function Search({ profile }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(() => loadKey());
  const [keyDraft, setKeyDraft] = useState("");
  const [showKeyBox, setShowKeyBox] = useState(false);
  const litKeys = useLitKeys();

  useEffect(() => {
    setOutcome(null);
    setNote(null);
  }, [profile]);

  const show = (keybind: Keybind | null) => {
    if (keybind) lighting.show(keybind.keys);
    else lighting.clear();
  };

  const run = async () => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setNote(null);

    // Offline first: it always works, and it seeds the alternatives list.
    const local = searchLocal(profile, q);
    let result = asOutcome(local);

    try {
      if (bridgePresent()) {
        const found = await bridgeQuery(profile.id, q);
        result = {
          best: found.keybind,
          alternatives: local.map((h) => h.keybind).filter((k) => k.id !== found.keybind?.id),
          explanation: found.explanation,
          confidence: found.confidence,
          source: "bridge",
        };
      } else if (apiKey) {
        const found = await askGemini(apiKey, profile, q);
        result = {
          best: found.keybind,
          alternatives: local.map((h) => h.keybind).filter((k) => k.id !== found.keybind?.id),
          explanation: found.explanation,
          confidence: found.confidence,
          source: "gemini",
        };
      }
    } catch {
      setNote("L'AI non ha risposto, ecco il risultato della ricerca locale.");
    }

    setOutcome(result);
    show(result.best);
    setBusy(false);
  };

  const pick = (keybind: Keybind) => {
    setOutcome((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            best: keybind,
            explanation: keybind.action,
            alternatives: [
              ...prev.alternatives.filter((k) => k.id !== keybind.id),
              ...(prev.best && prev.best.id !== keybind.id ? [prev.best] : []),
            ],
          },
    );
    show(keybind);
  };

  return (
    <>
      <div className="panel">
        <div className="search-bar">
          <input
            type="text"
            value={text}
            placeholder="Cosa vuoi fare? Es. dividi l'editor in due"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void run()}
          />
          <button className="primary" onClick={() => void run()} disabled={busy}>
            {busy ? "..." : "Illumina"}
          </button>
          <button
            onClick={() => {
              lighting.clear();
              setOutcome(null);
            }}
          >
            Spegni
          </button>
        </div>

        {note && <p className="fb-revealed">{note}</p>}

        {outcome &&
          (outcome.best ? (
            <div className="result">
              <div className="result-keys">
                {outcome.best.keys.map((chord, i) => (
                  <span key={i} className="chord">
                    {i > 0 && <span className="then">poi</span>}
                    {chord.map((t) => (
                      <kbd key={t}>{t}</kbd>
                    ))}
                  </span>
                ))}
              </div>
              <p>{outcome.explanation}</p>
              <p className="muted">
                {outcome.source === "locale"
                  ? "ricerca locale"
                  : outcome.source === "gemini"
                    ? "Gemini (chiave tua)"
                    : "Gemini (server locale)"}{" "}
                - affinita' {Math.round(outcome.confidence * 100)}%
              </p>

              {outcome.alternatives.length > 0 && (
                <>
                  <p className="muted">Non era questa? Forse cercavi:</p>
                  <div className="alternatives">
                    {outcome.alternatives.map((k) => (
                      <button key={k.id} onClick={() => pick(k)}>
                        <span>{k.action}</span>
                        <span className="review-keys">{formatKeys(k.keys)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="muted">
              Nessuna scorciatoia di {profile.name} corrisponde. Prova con altre parole.
            </p>
          ))}

        {!bridgePresent() && (
          <div className="key-box">
            <button className="link" onClick={() => setShowKeyBox((v) => !v)}>
              {apiKey
                ? "Chiave Gemini attiva - gestisci"
                : "Vuoi risposte piu' precise? Usa la tua chiave Gemini (gratuita)"}
            </button>
            {showKeyBox && (
              <div className="key-form">
                <p className="muted">
                  La chiave resta solo in questo browser e viene inviata solo a Google. Puoi
                  crearne una gratis su aistudio.google.com. Senza chiave la ricerca funziona
                  comunque, in locale.
                </p>
                <div className="search-bar">
                  <input
                    type="password"
                    value={keyDraft}
                    placeholder="Incolla qui la chiave"
                    onChange={(e) => setKeyDraft(e.target.value)}
                  />
                  <button
                    className="primary"
                    onClick={() => {
                      const k = keyDraft.trim();
                      if (!k) return;
                      saveKey(k);
                      setApiKey(k);
                      setKeyDraft("");
                      setShowKeyBox(false);
                    }}
                  >
                    Salva
                  </button>
                  {apiKey && (
                    <button
                      onClick={() => {
                        saveKey(null);
                        setApiKey(null);
                      }}
                    >
                      Rimuovi
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Keyboard lit={litKeys} />
    </>
  );
}
