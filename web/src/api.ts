import type { Profile, ProfileSummary, QueryResult, Status } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  status: () => fetch("/api/status").then((r) => json<Status>(r)),
  profiles: () => fetch("/api/profiles").then((r) => json<ProfileSummary[]>(r)),
  profile: (id: string) => fetch(`/api/profiles/${id}`).then((r) => json<Profile>(r)),
  query: (profileId: string, text: string) =>
    fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, text }),
    }).then((r) => json<QueryResult>(r)),
  highlight: (profileId: string, keybindId: string) =>
    fetch("/api/highlight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, keybindId }),
    }).then((r) => json<{ ok: boolean }>(r)),
  clear: () => fetch("/api/clear", { method: "POST" }).then((r) => json<{ ok: boolean }>(r)),
};
