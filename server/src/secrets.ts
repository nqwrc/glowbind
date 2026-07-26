import { Entry } from "@napi-rs/keyring";

export const KEYRING_SERVICE = "glowbind";
// Keys stored before the rename to glowbind live under the old service name.
const LEGACY_KEYRING_SERVICE = "keybard-emoter";
export const KEYRING_USER = "gemini-api-key";

/** Gemini API key: Windows Credential Manager first, env var as fallback. */
export function getGeminiApiKey(): string | null {
  for (const service of [KEYRING_SERVICE, LEGACY_KEYRING_SERVICE]) {
    try {
      const password = new Entry(service, KEYRING_USER).getPassword();
      if (password) return password;
    } catch {
      // no stored credential under this service name
    }
  }
  return process.env.GEMINI_API_KEY ?? null;
}
