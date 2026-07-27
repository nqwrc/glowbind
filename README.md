# glowbind

A browser challenge for learning keyboard shortcuts. Pick an app from the left
menu, glowbind asks what a shortcut does, you answer with the real keys, and it
scores you at the end and lists what to revise. There is also a search mode:
describe what you want to do and it lights up the keys.

It is a plain static site: no install, no account, no API key, nothing to run.
Optionally, a small local companion lights the answers on a real RGB keyboard
through [OpenRGB](https://openrgb.org).

Bundled profiles: VS Code, IntelliJ IDEA, Google Chrome, Figma, Photoshop,
Microsoft Excel and Windows 11 — around 250 shortcuts. Adding your own app is a
single JSON file.

> The UI is in Italian.

## Playing

Answer either way, whichever you prefer:

- **Press the shortcut** on your keyboard.
- **Click the keys** on the on-screen keyboard: modifiers stay held until you
  click a real key, which submits the chord.

Clicking is not just a convenience. The browser and Windows grab many
combinations before the page can see them — anything with the Win key, Ctrl+W,
F5 and friends — and pressing those would reload or close the tab mid-game.
glowbind detects them, says so, and expects those answers by mouse.

Two wrong attempts reveal the answer and light it up. Scoring is 100 points
first try, 50 after a mistake, 0 when revealed.

## Running it

```
npm install
npm run build
npm run preview      # http://127.0.0.1:4173
```

## Search mode

Type what you want to do ("rinominare una variabile ovunque") and glowbind
lights the shortcut, with a couple of alternatives in case it guessed wrong.

Matching runs entirely in your browser: the query is stripped of accents and
Italian filler words, then scored on word overlap with a light stemmer, with
fuzzy matching as a tiebreaker for typos. No key, no network, no cost.

For sharper answers you can paste **your own** Google Gemini key (free tier at
[AI Studio](https://aistudio.google.com)). It is stored in your browser only
and sent straight to Google. glowbind never ships a key of its own — a key
embedded in a public site would be readable by anyone.

## Publishing

`npm run build` writes a self-contained site to `web/dist`. Asset paths are
relative, so it works from any subdirectory — GitHub Pages project sites,
Netlify, Cloudflare Pages, an S3 bucket. Copy the folder and you are done.

It must be served over http, not opened as a `file://` path: the bundle is an
ES module and browsers block those on the file protocol.

### GitHub Pages

`.github/workflows/pages.yml` builds and deploys on every push to `main`. It
runs the test suite first, so a broken profile never ships.

One-time setup: in the repository, **Settings > Pages > Build and deployment**,
set the source to **GitHub Actions**. The site then lands at
`https://<user>.github.io/<repo>/`.

## Optional: light a real RGB keyboard

A small local server can mirror each revealed shortcut onto a physical
keyboard, and adds a natural-language search mode powered by Gemini. The API
key stays on your machine (Windows Credential Manager), never in the browser,
which is exactly why this part cannot be part of the public site.

Requirements: [OpenRGB](https://openrgb.org) with its SDK server started
(SDK Server tab, Start Server), and a free
[Google AI Studio](https://aistudio.google.com) key for the search mode.

```
npm run set-key      # stores the Gemini key in Windows Credential Manager
npm run build
npm start            # http://127.0.0.1:3000 - serves the site and the bridge
```

The page finds the bridge on its own and shows an extra panel in the sidebar.
Without it, the same page is just the challenge.

Environment variables: `PORT` (default 3000), `OPENRGB_HOST` / `OPENRGB_PORT`
(default 127.0.0.1:6742), `GEMINI_MODEL` (default `gemini-flash-latest`),
`GEMINI_API_KEY` (fallback if nothing is in the Credential Manager).

### No RGB keyboard? Use the fake one

A mock keyboard speaks the real OpenRGB protocol and draws itself in the
terminal, repainting as glowbind lights it.

```
npm run mock-keyboard    # terminal 1, an 87-key keyboard on port 6799
npm run start:mock       # terminal 2, the bridge pointed at it
```

## Profiles

One JSON file per app in `profiles/`, bundled into the site at build time:

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
      "keywords": ["synonyms", "for the search mode"]
    }
  ]
}
```

`keys` is a sequence of chords: `[["Ctrl","K"],["Ctrl","S"]]` means Ctrl+K then
Ctrl+S. Valid key tokens are listed in `server/src/keymap.ts`, and `npm test`
fails if a profile uses one that no keyboard could light.

## Tests

```
npm test
```

Covers the token-to-LED mapping, profile validation, and the OpenRGB lighting
path against an in-process fake keyboard — including that closing OpenRGB
mid-session does not take the server down.
