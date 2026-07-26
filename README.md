# glowbind

Learn keyboard shortcuts with your keyboard itself. Type what you want to do in
natural language ("split the editor in two") and the app lights up the right
keys on your physical RGB keyboard via [OpenRGB](https://openrgb.org) — and on
an on-screen virtual keyboard if you don't have one. A training mode quizzes
you until the shortcuts stick.

> The UI is currently in Italian. Shortcut profiles for VS Code and Windows 11
> are included; adding your own app is a single JSON file.

## Features

- **Natural-language search** powered by Gemini Flash (free tier), with a
  local fuzzy-search fallback when no API key is configured — the app never
  requires the cloud.
- **Physical key lighting**: the whole board dims and the shortcut keys glow;
  multi-step chords (`Ctrl+K` then `S`) animate step by step. Previous colors
  are saved and restored afterwards.
- **Virtual keyboard** that mirrors the physical one in real time over
  WebSocket, so it works with any (or no) keyboard.
- **Training mode**: the app asks "what's the shortcut for X?", you press the
  real keys, it scores you and reveals the answer on the keyboard when you
  miss.
- **Resilient by design**: OpenRGB can be closed and reopened at any time; the
  app reconnects in the background and degrades to virtual-only.
- **API key stored safely** in the Windows Credential Manager, never on disk.

## Requirements

- Node.js 20+
- [OpenRGB](https://openrgb.org) with the SDK server enabled
  (SDK Server tab, Start Server, default port 6742). Optional: without it the
  app still works with the virtual keyboard only.
- A Gemini API key (free tier from [Google AI Studio](https://aistudio.google.com)).
  Optional: without it the app falls back to local fuzzy search.

## Setup

```
npm install
npm run set-key     # stores the Gemini API key in Windows Credential Manager
npm run build
npm start           # http://127.0.0.1:3000
```

Development mode (hot reload, UI on the Vite port):

```
npm run dev
```

## Configuration

Environment variables (all optional):

- `PORT` - server port (default 3000)
- `OPENRGB_HOST` / `OPENRGB_PORT` - OpenRGB SDK server address (default 127.0.0.1:6742)
- `GEMINI_MODEL` - Gemini model id (default `gemini-flash-latest`)
- `GEMINI_API_KEY` - fallback if no key is stored in the Credential Manager

## Profiles

Keybind sets live in `profiles/*.json`:

```json
{
  "id": "myapp",
  "name": "My App",
  "keybinds": [
    {
      "id": "do-thing",
      "action": "Does the thing",
      "keys": [["Ctrl", "Shift", "P"]],
      "category": "general",
      "keywords": ["synonyms", "for fuzzy search"]
    }
  ]
}
```

`keys` is a sequence of chords: `[["Ctrl","K"],["Ctrl","S"]]` means
Ctrl+K followed by Ctrl+S. Valid key tokens are listed in
`server/src/keymap.ts`. Profiles are validated at startup.

## Trying it without an RGB keyboard

If OpenRGB reports no keyboard (or you have no RGB keyboard at all), a mock one
is included. It speaks the real OpenRGB SDK protocol and draws itself in the
terminal, repainting every time the app updates the LEDs.

Terminal 1 - the fake keyboard (listens on port 6799):

```
npm run mock-keyboard
```

Terminal 2 - the app, pointed at it instead of real OpenRGB:

```
npm run start:mock
```

Then open http://127.0.0.1:3000, search for a shortcut, and watch the keys light
up in terminal 1. Multi-step chords animate; clearing restores the idle colors.

## Architecture

- `server/` - Fastify + TypeScript. Loads and validates profiles (zod),
  resolves queries (Gemini with fuzzy fallback via Fuse.js), drives OpenRGB,
  and pushes lighting state to the UI over WebSocket.
- `web/` - React + Vite. Virtual TKL keyboard, search UI, quiz mode.
- `profiles/` - shortcut catalogs, one JSON file per application.

## Notes

- Quiz mode captures keys in the browser, so shortcuts the OS intercepts
  (anything with the Win key, Ctrl+W, Ctrl+T in some browsers) are excluded
  or may close the tab.
- Physical lighting saves the previous colors and restores them when cleared
  (automatic after 20 s).
- The server binds to 127.0.0.1 only.

## Tests

```
npm test
```

## License

[MIT](LICENSE)
