import { useEffect, useState } from "react";
import { api } from "./api";
import { Keyboard } from "./Keyboard";
import { Quiz } from "./Quiz";
import { useLightingState } from "./ws";
import type { Profile, ProfileSummary, QueryResult, Status } from "./types";

type Mode = "search" | "quiz";

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lighting = useLightingState();

  useEffect(() => {
    void api.status().then(setStatus).catch(() => setStatus(null));
    void api.profiles().then(async (list) => {
      setProfiles(list);
      if (list.length > 0) setProfile(await api.profile(list[0].id));
    });
    const poll = window.setInterval(
      () => void api.status().then(setStatus).catch(() => setStatus(null)),
      10_000,
    );
    return () => window.clearInterval(poll);
  }, []);

  const selectProfile = async (id: string) => {
    setResult(null);
    setProfile(await api.profile(id));
  };

  const submit = async () => {
    if (!profile || !query.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.query(profile.id, query));
    } catch {
      setError("Errore durante la richiesta. Il server e' attivo?");
    } finally {
      setBusy(false);
    }
  };

  const highlightedTokens = lighting.active ? (lighting.chords[lighting.step] ?? []) : [];

  // Connected with no keyboard is a distinct state: OpenRGB is running but has
  // detected no RGB keyboard, so nothing will light up physically.
  const openrgbBadge = !status?.openrgb
    ? { tone: "off", text: "OpenRGB non connesso (solo tastiera virtuale)" }
    : status.keyboards.length === 0
      ? { tone: "warn", text: "OpenRGB connesso, nessuna tastiera RGB rilevata" }
      : { tone: "on", text: `OpenRGB: ${status.keyboards.join(", ")}` };

  return (
    <div className="app">
      <header>
        <h1>glowbind</h1>
        <div className="badges">
          <span className={`badge ${openrgbBadge.tone}`}>{openrgbBadge.text}</span>
          <span className={`badge ${status?.gemini ? "on" : "off"}`}>
            {status?.gemini ? "AI: Gemini" : "AI non configurata (ricerca fuzzy)"}
          </span>
        </div>
      </header>

      <div className="toolbar">
        <select
          value={profile?.id ?? ""}
          onChange={(e) => void selectProfile(e.target.value)}
          aria-label="profilo"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.count})
            </option>
          ))}
        </select>
        <div className="mode-switch">
          <button className={mode === "search" ? "sel" : ""} onClick={() => setMode("search")}>
            Cerca
          </button>
          <button className={mode === "quiz" ? "sel" : ""} onClick={() => setMode("quiz")}>
            Allenamento
          </button>
        </div>
      </div>

      {mode === "search" && profile && (
        <section className="search">
          <div className="search-bar">
            <input
              type="text"
              value={query}
              placeholder='Cosa vuoi fare? Es. "dividi l&apos;editor in due"'
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
            <button onClick={() => void submit()} disabled={busy}>
              {busy ? "..." : "Illumina"}
            </button>
            <button onClick={() => void api.clear()}>Spegni</button>
          </div>
          {error && <p className="quiz-wrong">{error}</p>}
          {result && (
            <div className="result">
              {result.keybind ? (
                <>
                  <div className="result-keys">
                    {result.keybind.keys.map((chord, i) => (
                      <span key={i} className="chord">
                        {i > 0 && <span className="then">poi</span>}
                        {chord.map((t) => (
                          <kbd key={t}>{t}</kbd>
                        ))}
                      </span>
                    ))}
                  </div>
                  <p>{result.explanation}</p>
                  <p className="muted">
                    Fonte: {result.source === "gemini" ? "Gemini" : "ricerca locale"}
                    {" - "}confidenza {(result.confidence * 100).toFixed(0)}%
                  </p>
                </>
              ) : (
                <p>{result.explanation}</p>
              )}
            </div>
          )}
        </section>
      )}

      {mode === "quiz" && profile && <Quiz profile={profile} />}

      <Keyboard highlighted={highlightedTokens} />
    </div>
  );
}
