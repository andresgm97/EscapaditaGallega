# Entre mar, vino y atardeceres — CLAUDE.md

Surprise trip itinerary web app for a weekend in Rías Baixas, Galicia.
Built as a progressive mobile web app. No framework, no build tools, no npm.

## Architecture

Pure vanilla HTML/CSS/JS. Three source files, one JSON data file:

| File | Purpose |
|---|---|
| `index.html` | Shell markup: cover, card deck, top bar, nav, admin modal, PIN modal, toast |
| `styles.css` | All styling. Mobile-first, CSS custom properties, no utility classes |
| `app.js` | All logic. Single IIFE, `"use strict"`. ~1 000 lines |
| `itinerary.json` | Trip data: plans list, tasting config, survey config |

Static assets:
- `assets/icons/` — SVG icons only (no PNGs; manifest uses SVG icons)
- `assets/images/poster.svg` — video poster fallback
- `assets/video/` — optional `coast.mp4` for animated background (not committed)
- `service-worker.js` — offline-first cache (cache name `emva-v1`)
- `manifest.webmanifest` — PWA manifest

## App structure

Plans are loaded from `itinerary.json` and rendered as a card deck. Plans are **sequentially locked** — each requires explicitly pressing "Descubrir" on the previous one before it becomes visible. The first plan is always unlocked.

### Plan card types

A plan's `type` field controls its card renderer:
- _(none)_ — standard card with scene illustration + unlock button
- `"tasting"` — wine tasting board (star ratings per voter, ranking, average)
- `"survey"` — Estela's satisfaction survey (rate flagged plans, pick favourite)

Plans flagged with `"survey": true` in the JSON appear as ratable items inside the survey card.

### Scene illustrations

`makeScene(plan)` generates an inline SVG illustration per plan based on `plan.scene`. Supported scene types:

`road`, `beach`, `sunset`, `wine`, `music`, `icecream`, `table`, `hotel`, `town`, `drink`, `morning`, `night`, `survey`

Each scene has a thematic gradient background + vector art elements. To add a new scene type, add a branch in `sceneArt()` in `app.js`.

### State

Persisted to `localStorage` under key `emva.state.v1`. Shape:

```js
{
  unlocked: { planId: true },      // which plans have been unlocked
  completed: { planId: true },     // which plans have been "completed"
  current: 0,                      // current card index
  tasting: {                       // wine tasting votes
    wineIndex: { voterName: stars }
  },
  survey: { planId: stars },       // Estela's plan ratings (1–5)
  surveyFav: null,                 // planId chosen as favourite
}
```

### Admin panel

Accessible via the star button in the footer. Requires a 4-digit PIN verified client-side via `crypto.subtle.digest("SHA-256", ...)`. The PIN hash is stored in `app.js` as `PIN_HASH`. Never commit the raw PIN anywhere.

Admin actions: `unlockAll`, `lockAll`, `resetTasting`, `resetSurvey`, `resetAll`.

### Background animation

Canvas coastal animation (waves, sun glow, mist) with two fallbacks:
1. If `assets/video/coast.mp4` exists and can play, it takes over from canvas
2. If `prefers-reduced-motion` is set, canvas is hidden and a CSS static background is shown

## Standalone build

Because this is deployed to GitHub Pages and managed via manual file upload, a build script inlines everything into a single `index.html` to avoid file-mixing issues.

Build script location (not committed — recreate if needed):

```js
// /tmp/.../scratchpad/build-standalone.js
const fs = require('fs');
const ROOT = '/home/user/EscapaditaGallega';
const OUT = '/tmp/.../index.html';
let html = fs.readFileSync(ROOT+'/index.html','utf8');
const css = fs.readFileSync(ROOT+'/styles.css','utf8');
let js  = fs.readFileSync(ROOT+'/app.js','utf8');
const itinerary = fs.readFileSync(ROOT+'/itinerary.json','utf8');

// Inline CSS
html = html.replace(/\s*<link rel="stylesheet" href="styles\.css" \/>/, () => '\n  <style>\n'+css+'\n  </style>');
// Remove manifest/icon links (not needed in standalone)
html = html.replace(/\s*<link rel="manifest"[^>]*>/g, '');
html = html.replace(/\s*<link rel="icon"[^>]*>/g, '');
html = html.replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, '');
// Remove video poster ref
html = html.replace(/ poster="assets\/images\/poster\.svg"/, '');
// Patch app.js: replace fetch() with inlined data
js = js.replace(
  /try \{\s*const res = await fetch\("itinerary\.json"[\s\S]*?return;\s*\}/,
  () => 'data = window.__ITINERARY__;'
);
// Replace registerSW with SW+cache cleanup (avoids stale cached versions)
js = js.replace(
  /function registerSW\(\) \{[\s\S]*?\n  \}/,
  () => `function registerSW() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister();});}).catch(function(){});
    }
    if (window.caches && caches.keys) { caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k);});}).catch(function(){}); }
  }`
);
// Inline data + patched JS
const inlineScript = '<script>\nwindow.__ITINERARY__ = '+itinerary.trim()+';\n</script>\n  <script>\n'+js+'\n  </script>';
html = html.replace(/<script src="app\.js"><\/script>/, () => inlineScript);
fs.writeFileSync(OUT, html);
```

**Critical**: All `.replace()` calls that insert file content MUST use a function callback `() => string`, never a string literal. `$` characters in CSS/JS content are interpreted as backreferences when passed as a string to `.replace()`.

Run with: `node build-standalone.js`

Output is ~85 KB standalone `index.html`.

## Deployment

GitHub Pages at `https://andresgm97.github.io/EscapaditaGallega/`

Repository: `andresgm97/EscapaditaGallega`

Git push is blocked by the remote execution environment's network proxy (403 on push). To deploy:
1. Build the standalone `index.html`
2. Upload it manually via GitHub web UI to the `main` branch
3. GitHub Pages serves it automatically

Do NOT upload the source files individually — GitHub's web upload can mix up file contents between files uploaded in the same batch.

## Known constraints in remote execution

- **No outbound HTTP for images**: Network proxy returns 000/403 for Unsplash, Wikipedia, Picsum, etc. Real photos cannot be fetched. Use inline SVG illustrations instead.
- **Git push blocked**: `git push` returns 403. All GitHub writes must go through MCP tools (`mcp__github__push_files`, `mcp__github__create_or_update_file`) or manual upload.
- **SSH signing key empty**: `/home/claude/.ssh/commit_signing_key.pub` is 0 bytes. Commit signing warnings are non-actionable.
- **Binary files via MCP**: `mcp__github__push_files` requires base64 encoding for binary files. PNG icons cannot be pushed reliably — use SVG only in the manifest.

## Adding / modifying plans

Edit `itinerary.json`. Each plan:

```json
{
  "id": "unique-id",
  "day": "Viernes",
  "title": "Plan title",
  "description": "Narrative description in Spanish.",
  "image": "assets/images/unique-id.webp",
  "scene": "beach",
  "location": "Optional place name",
  "survey": true,
  "type": "tasting"
}
```

- `scene` — controls SVG illustration. Pick from the 13 supported types above.
- `survey: true` — includes this plan in Estela's satisfaction survey.
- `type: "tasting"` or `type: "survey"` — renders special card UI instead of default.

## Tasting board

Configured via `itinerary.json` → `tasting`:

```json
{
  "wines": ["Vino 1", "Vino 2", "Vino 3", "Vino 4"],
  "voters": ["Andrés", "Estela"]
}
```

Wine names and voter names are displayed in the tasting board UI. Ratings are 1–5 stars. Ties are broken by first voter (Andrés).

## Survey

Configured via `itinerary.json` → `survey`:

```json
{ "voter": "Estela" }
```

The survey card renders all plans with `"survey": true` as ratable items. Estela rates each 1–5 and picks her favourite. Favourite is shown with a heart and stored in `state.surveyFav`.
