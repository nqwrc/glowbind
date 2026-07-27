import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the built site works from any subdirectory:
  // GitHub Pages project sites, a static host, or opened straight from disk.
  base: "./",
  server: {
    fs: { allow: [".."] }, // profiles/ lives outside the web workspace
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
});
