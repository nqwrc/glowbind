import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { KNOWN_TOKENS } from "./keymap.js";

const keybindSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  keys: z.array(z.array(z.string().min(1)).min(1)).min(1),
  category: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

const profileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  keybinds: z.array(keybindSchema).min(1),
});

export type Keybind = z.infer<typeof keybindSchema>;
export type Profile = z.infer<typeof profileSchema>;

const PROFILES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../profiles",
);

export async function loadProfiles(): Promise<Map<string, Profile>> {
  const profiles = new Map<string, Profile>();
  const files = await readdir(PROFILES_DIR);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = JSON.parse(await readFile(path.join(PROFILES_DIR, file), "utf8"));
    const profile = profileSchema.parse(raw);
    for (const kb of profile.keybinds) {
      for (const chord of kb.keys) {
        for (const token of chord) {
          if (!KNOWN_TOKENS.has(token)) {
            throw new Error(
              `Profile ${file}, keybind ${kb.id}: unknown key token "${token}"`,
            );
          }
        }
      }
    }
    profiles.set(profile.id, profile);
  }
  return profiles;
}
