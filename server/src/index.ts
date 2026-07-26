import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import { loadProfiles } from "./profiles.js";
import { OpenRGBService } from "./openrgb.js";
import { LightingController } from "./lighting.js";
import { resolveQuery, geminiAvailable } from "./resolver.js";

const PORT = Number(process.env.PORT ?? 3000);
const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, "../../web/dist");

const profiles = await loadProfiles();
const openrgb = new OpenRGBService();
openrgb.start();
const lighting = new LightingController(openrgb);

const app = Fastify({ logger: false });
await app.register(fastifyWebsocket);
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });
}

app.get("/api/status", async () => ({
  openrgb: openrgb.connected,
  keyboards: openrgb.keyboardNames,
  gemini: geminiAvailable(),
}));

app.get("/api/profiles", async () =>
  [...profiles.values()].map((p) => ({ id: p.id, name: p.name, count: p.keybinds.length })),
);

app.get("/api/profiles/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const profile = profiles.get(id);
  if (!profile) return reply.code(404).send({ error: "profilo non trovato" });
  return profile;
});

app.post("/api/query", async (req, reply) => {
  const { profileId, text } = (req.body ?? {}) as { profileId?: string; text?: string };
  const profile = profileId ? profiles.get(profileId) : undefined;
  if (!profile || !text?.trim()) {
    return reply.code(400).send({ error: "profileId e text sono obbligatori" });
  }
  const resolution = await resolveQuery(profile, text.trim());
  if (resolution.keybind) lighting.highlight(resolution.keybind);
  return {
    keybind: resolution.keybind,
    source: resolution.source,
    confidence: resolution.confidence,
    explanation: resolution.explanation,
  };
});

app.post("/api/highlight", async (req, reply) => {
  const { profileId, keybindId } = (req.body ?? {}) as {
    profileId?: string;
    keybindId?: string;
  };
  const keybind = profileId
    ? profiles.get(profileId)?.keybinds.find((k) => k.id === keybindId)
    : undefined;
  if (!keybind) return reply.code(404).send({ error: "keybind non trovato" });
  lighting.highlight(keybind);
  return { ok: true };
});

app.post("/api/clear", async () => {
  await lighting.clear();
  return { ok: true };
});

app.get("/ws", { websocket: true }, (socket) => {
  socket.send(JSON.stringify({ type: "lighting", state: lighting.getState() }));
  const unsubscribe = lighting.onChange((state) => {
    socket.send(JSON.stringify({ type: "lighting", state }));
  });
  socket.on("close", unsubscribe);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await lighting.clear();
    await openrgb.stop();
    await app.close();
    process.exit(0);
  });
}

await app.listen({ port: PORT, host: "127.0.0.1" });
console.log(`glowbind server on http://127.0.0.1:${PORT}`);
