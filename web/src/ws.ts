import { useEffect, useState } from "react";
import type { LightingState } from "./types";

const IDLE: LightingState = { active: false, keybindId: null, chords: [], step: 0 };

/** Live lighting state pushed by the server; reconnects automatically. */
export function useLightingState(): LightingState {
  const [state, setState] = useState<LightingState>(IDLE);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: number | undefined;
    let closed = false;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${location.host}/ws`);
      socket.onmessage = (ev) => {
        const msg = JSON.parse(ev.data as string) as { type: string; state: LightingState };
        if (msg.type === "lighting") setState(msg.state);
      };
      socket.onclose = () => {
        if (!closed) retry = window.setTimeout(connect, 2000);
      };
    };
    connect();

    return () => {
      closed = true;
      window.clearTimeout(retry);
      socket?.close();
    };
  }, []);

  return state;
}
