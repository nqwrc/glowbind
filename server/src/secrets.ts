import { Entry } from "@napi-rs/keyring";

export const KEYRING_SERVICE = "keybard-emoter";
export const KEYRING_USER = "gemini-api-key";

/** Gemini API key: Windows Credential Manager first, env var as fallback. */
export function getGeminiApiKey(): string | null {
  try {
    const entry = new Entry(KEYRING_SERVICE, KEYRING_USER);
    const password = entry.getPassword();
    if (password) return password;
  } catch {
    // no stored credential
  }
  return process.env.GEMINI_API_KEY ?? null;
}
