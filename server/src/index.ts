import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { loadProfiles } from "./profiles.js";
import { OpenRGBService } from "./openrgb.js";
import { resolveQuery, geminiAvailable } from "./resolver.js";

// The companion server. The browser owns the app; this only mirrors the
// highlighted chord onto a real RGB keyboard and answers natural-language
// queries with the key kept out of the browser.

const PORT = Number(process.env.PORT ?? 3000);
// Nothing repaints the keyboard if the page goes away mid-highlight, so give
// up and restore the original colors after a while.
const IDLE_RESTORE_MS = 60_000;

const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, "../../web/dist");

const profiles = await loadProfiles();
const openrgb = new OpenRGBService();
openrgb.start();

let idleTimer: NodeJS.Timeout | null = null;
function armIdleRestore() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => void openrgb.restore(), IDLE_RESTORE_MS);
}

const app = Fastify({ logger: false });
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });
}

app.get("/api/status", async () => ({
  openrgb: openrgb.connected,
  keyboards: openrgb.keyboardNames,
  gemini: geminiAvailable(),
}));

app.post("/api/chord", async (req, reply) => {
  const { tokens } = (req.body ?? {}) as { tokens?: unknown };
  if (!Array.isArray(tokens) || tokens.some((t) => typeof t !== "string")) {
    return reply.code(400).send({ error: "tokens deve essere un array di stringhe" });
  }
  await openrgb.showChord(tokens as string[]);
  armIdleRestore();
  return { ok: true };
});

app.post("/api/clear", async () => {
  if (idleTimer) clearTimeout(idleTimer);
  await openrgb.restore();
  return { ok: true };
});

app.post("/api/query", async (req, reply) => {
  const { profileId, text } = (req.body ?? {}) as { profileId?: string; text?: string };
  const profile = profileId ? profiles.get(profileId) : undefined;
  if (!profile || !text?.trim()) {
    return reply.code(400).send({ error: "profileId e text sono obbligatori" });
  }
  const resolution = await resolveQuery(profile, text.trim());
  return {
    keybind: resolution.keybind,
    source: resolution.source,
    confidence: resolution.confidence,
    explanation: resolution.explanation,
  };
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await openrgb.stop();
    await app.close();
    process.exit(0);
  });
}

await app.listen({ port: PORT, host: "127.0.0.1" });
console.log(`glowbind bridge on http://127.0.0.1:${PORT}`);
