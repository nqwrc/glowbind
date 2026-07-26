// Stores the Gemini API key in the Windows Credential Manager.
// Usage: npm run set-key   (prompts on the terminal)
import { createInterface } from "node:readline/promises";
import { Entry } from "@napi-rs/keyring";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const key = (await rl.question("Gemini API key: ")).trim();
rl.close();

if (!key) {
  console.error("No key entered, nothing saved.");
  process.exit(1);
}

new Entry("glowbind", "gemini-api-key").setPassword(key);
console.log("Key saved to Windows Credential Manager (glowbind / gemini-api-key).");
