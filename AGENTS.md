# AGENTS.md

## What this is

SolPump Operations — a single-file demo webapp (solar pump fleet dashboard, simulated field data).
No framework, no tests, no CI. Runtime code is plain ES modules under `src/`, bundled by
Vite into one self-contained `dist/index.html`. Dependency-free means no *runtime* deps; devDependencies
(vite, jsdom, eslint…) are allowed. Two build paths exist — Vite is primary, `build.sh` is the classic
fallback (same artifact shape, same behavior).

## Commands

```sh
npm install        # once (devDeps: vite, vite-plugin-singlefile, jsdom, eslint, acorn, globals)
npm run dev        # Vite dev server (unbundled ESM, HMR)
npm run build      # primary artifact → dist/index.html (all JS/CSS/logo inlined, minified)
npm run verify     # static checks — must pass after any src/ edit
npm run smoke      # boots dist/index.html and walks the UI (see below)
npm run check      # verify + build + smoke, the full gate
sh build.sh        # classic single-file build (concatenated globals) — optional fallback
```

- Preview by opening `dist/index.html` directly (`file://` works — no server, no fetch).
  The only external request is Google Fonts (Barlow); offline falls back to system fonts.
- `dist/index.html` is **generated**. Never hand-edit it — the next build overwrites it entirely.
- Freshness: rebuild whenever `src/` changes; quickest sanity is `npm run check`.
- Deploy: `npm run check` → `git add -A && git commit -m "…"` → `git push`. Vercel builds
  `main` remotely (command = `npm run verify && npm run build`, from `vercel.json`; smoke
  excluded — needs Chrome) and publishes automatically. Repo `ozastyd/solpump`, live at
  https://solpump-gamma.vercel.app. Never commit `dist/`, `node_modules/`, `.vercel/` (gitignored).

## Checks (both required after src edits)

- `npm run verify` — three static checks over the module graph:
  1. no-undef as ES modules; 2. evaluation-order/TDZ safety; 3. **cross-module leak check** —
  a name exported by one `src/` file but used in another *without importing it* (classic build
  silently bound it to a global; ESM resolves it to `window.*` or throws — the `status` bug).
- `npm run smoke` — renders `dist/index.html` headlessly, signs in, walks all routes, pump tabs,
  incident detail, map popup, both drawers. Runner auto-picks: classic bundle → jsdom,
  `type="module"` bundle → headless Chrome (CDP; jsdom cannot execute module scripts).
  Force with `--jsdom` / `--browser`. Steps live in `tools/smoke-steps.js` (runs in-page for both).

## Layout — import graph is the dependency order

Files: `core.js` → `intel.js` → `ui1.js` → `ui2/3/4.js`; `main.js` is the Vite entry (imports logo
PNG + all six, sets `globalThis.LOGO`, then `boot()`). Order inside `build.sh` matches it.

- `src/core.js` — state `S`, simulator `SIM`, time-series `TS`, seeding, device ingestion, alert rules,
  commands, audit, formatters, `$`, `toast`. Timezone hardcoded UTC+7 (WIB).
- `src/intel.js` — daily rollups/downsampling, health score, rule diagnostics, well analytics.
- `src/ui1.js` — router (`ROUTES` / `renderAll` / `setView`), login, shell+nav, overview, map, icons,
  hand-rolled SVG charts (`lineChart`, `barChart`), `DRAWER` registry.
- `src/ui2.js` — modal, pump detail page + tabs, alarm acknowledge.
- `src/ui3.js` — alerts, incidents, maintenance, analytics, automation/schedules, devices routes.
- `src/ui4.js` — reports, audit, settings, blueprint, demo-lab + notification drawers, `boot()`, main loop.

## ESM rules (the file must stay importable)

- Every top-level name shared across files gets `export ` and is imported explicitly. **Never rely on
  a global** — `npm run verify` enforces this; a leak that `verify` misses will be caught by `smoke`.
- Layering: `ui1` must not import `ui2/3/4`; `core`/`intel` never import `ui*`. When `ui1` needs a
  callback from `ui4`, use the `DRAWER` registry pattern (`ui1` reads `DRAWER.lab()` at click time,
  `ui4` registers `DRAWER.lab = openLab`). `$`/`toast` live in `core` for the same reason.
- `ui2 ↔ ui3` is the one allowed cycle (call-time only) — `npm run verify` proves eval-order safety.
- No inline HTML event attributes (`onclick="go(…)"`): module scope makes them fail. Use
  `data-*` + `.onclick` bindings in `after()` (map popup in `ui1.js` is the template).
- `LOGO` is a runtime global: set by `main.js` (Vite) / injected by `build.sh` (classic).
- Adding a `src/*.js` file: import it from `main.js`, add it to `build.sh`'s list, add it to
  `FILES` in `tools/verify.mjs`.

## build.sh (classic fallback)

Strips the generated `import { … } from './x.js';` lines and `export ` prefixes, concatenates the six
files in dependency order, injects `LOGO` + `style.css`. It supports exactly the ESM syntax this repo
uses (sibling named imports at line start, `export ` prefix). New ESM syntax (`export default`,
re-exports, `export { a as b }`) requires extending the strip logic in `build.sh` — and running
`sh build.sh` + `node tools/smoke.mjs dist/index.html --jsdom` to prove it.

## Runtime model

- `boot()` backfills 30 days of history (~4300 `stepWorld` calls) on load — the "Loading 30 days…"
  splash is expected; first paint is the slow part of any change.
- A route is `ROUTES.<name> = (a, b) => { setView(html); return { title, live, after, crumb }; }`.
  Unknown hashes fall back to `ROUTES.overview`. `live: false` opts that screen out of the auto re-render.
- Main loop (`ui4.js`, 2 s `setInterval`): advances the simulated clock (`S.speed` 1×/10×, pause) and
  re-renders the current route unless a modal is open, the user is typing, or `live: false`.
- State is in-memory only: reload = fresh seed. No localStorage/fetch/persistence exists anywhere.
- Multi-tenant demo: `S.orgId`, permissions via `can()`, list scoping via `scoped()`. Gate new screens
  inside the route itself (`if (!can("x")) …`).
- A metric the pump lacks renders "no sensor" (`nos()`) — never 0.

## Conventions (match the file you're editing)

- Dense single-line style with short names (`r1`, `dk`, `lh`, `S`, `TS`, `UI`) is intentional.
- HTML is built as template strings; escape every interpolated value with `esc()`
  (`fmtN` / `fmtDT` / `fmtDur` for numbers and times).
- Charts are hand-rolled SVG — no chart library exists; keep it that way.
- Design tokens live in `src/style.css` `:root` (light + dark via `prefers-color-scheme` and
  `[data-theme]`). Colors are referenced as `var(--…)` in both CSS and generated HTML.

## Windows gotchas (verified on this machine)

- `python3` on PATH is a 0-byte Microsoft Store alias (exit 9009). `build.sh` probes it and falls back
  to `python` (3.13) — don't "fix" it back to a bare `python3`.
- Locale encoding is cp1252 but sources are UTF-8 (`❚ ° ³ —`). All opens in `build.sh` must keep
  `encoding="utf-8"` or the build crashes (`UnicodeDecodeError` in `src/ui1.js`) or mojibakes silently.
- `dist/index.html` must stay LF-only — keep `newline='\n'` in the write call.
- Headless smoke prefers Chrome (`C:\Program Files\Google\Chrome\…`); Edge 154 on this machine exits
  immediately on launch even with a custom profile, so don't debug the smoke against Edge first.
