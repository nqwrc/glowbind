import type { Profile } from "../types";

// Profiles are bundled at build time, so the site needs no server to run.
const modules = import.meta.glob<{ default: Profile }>("../../../profiles/*.json", {
  eager: true,
});

export const PROFILES: Profile[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.name.localeCompare(b.name));

export const getProfile = (id: string): Profile | undefined =>
  PROFILES.find((p) => p.id === id);
