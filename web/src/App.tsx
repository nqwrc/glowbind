import { useEffect, useState } from "react";
import { Challenge } from "./Challenge";
import { Search } from "./Search";
import { PROFILES } from "./engine/profiles";
import { detectBridge, type BridgeStatus } from "./engine/bridge";
import { lighting } from "./engine/lighting";
import { isTypable } from "./chords";
import type { Profile } from "./types";

type Mode = "challenge" | "search";

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(PROFILES[0] ?? null);
  const [mode, setMode] = useState<Mode>("challenge");
  const [bridge, setBridge] = useState<BridgeStatus | null>(null);

  useEffect(() => {
    void detectBridge().then(setBridge);
  }, []);

  const select = (next: Profile) => {
    if (next.id === profile?.id) return;
    lighting.clear();
    setMode("challenge");
    setProfile(next);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>glowbind</h1>
          <p>Impara le scorciatoie giocando</p>
        </div>

        <nav>
          <h2>Applicazioni</h2>
          {PROFILES.map((p) => {
            const clickOnly = p.keybinds.filter((k) => !isTypable(k.keys)).length;
            return (
              <button
                key={p.id}
                className={`nav-item${p.id === profile?.id ? " sel" : ""}`}
                onClick={() => select(p)}
              >
                <span className="nav-name">{p.name}</span>
                <span className="nav-count">
                  {p.keybinds.length} scorciatoie
                  {clickOnly > 0 ? ` - ${clickOnly} da cliccare` : ""}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="bridge-box">
          <h2>Modalita'</h2>
          <div className="mode-switch">
            <button
              className={mode === "challenge" ? "sel" : ""}
              onClick={() => setMode("challenge")}
            >
              Sfida
            </button>
            <button className={mode === "search" ? "sel" : ""} onClick={() => setMode("search")}>
              Cerca
            </button>
          </div>
          {bridge && (
            <span
              className={`badge ${bridge.openrgb && bridge.keyboards.length > 0 ? "on" : "warn"}`}
            >
              {bridge.keyboards.length > 0
                ? `Tastiera RGB: ${bridge.keyboards.join(", ")}`
                : "Server locale attivo, nessuna tastiera RGB"}
            </span>
          )}
        </div>
      </aside>

      <main className="content">
        {profile === null ? (
          <p className="muted">Nessun profilo disponibile.</p>
        ) : mode === "search" ? (
          <Search profile={profile} />
        ) : (
          <Challenge key={profile.id} profile={profile} />
        )}
      </main>
    </div>
  );
}
