// Starts the built server pointed at the mock keyboard instead of real OpenRGB.
// Portable across shells, unlike inline env-var syntax in npm scripts.
import { spawn } from "node:child_process";

const port = process.env.MOCK_PORT ?? "6799";
spawn(process.execPath, ["server/dist/index.js"], {
  stdio: "inherit",
  env: { ...process.env, OPENRGB_PORT: port },
}).on("exit", (code) => process.exit(code ?? 0));
