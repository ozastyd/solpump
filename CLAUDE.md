# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` is the authoritative, detailed guide (architecture, ESM rules, Windows gotchas); read it before editing `src/`. `PRODUCT.md` and `DESIGN.md` hold product/design context. The essentials:

## What this is

SolPump Operations: a single-file demo webapp (solar pump fleet dashboard, simulated in-memory data, hash routing). Plain ES modules in `src/`, bundled by Vite into one self-contained `dist/index.html`. No runtime dependencies, no fetch/localStorage, no unit-test framework.

## Commands

```sh
npm run dev      # Vite dev server at http://localhost:5173 (use this, not a hand-served dist, for live/impeccable work)
npm run verify   # static module-graph checks; required after any src/ edit
npm run build    # -> dist/index.html (generated, never hand-edit)
npm run smoke    # boots dist/index.html and walks all routes (needs Chrome; Edge fails on this machine)
npm run check    # verify + build + smoke, the full gate
node tools/smoke.mjs dist/index.html --jsdom   # force the jsdom runner (classic build only)
sh build.sh      # classic concatenated-globals fallback build
```

There is no single-test command; smoke steps live in `tools/smoke-steps.js`.

## Architecture (needs several files to see)

- Import graph is dependency order: `core.js` (state `S`, simulator, alerts, formatters) → `intel.js` (rollups, health, diagnostics) → `ui1.js` (router, shell, overview, map, SVG charts, `DRAWER` registry) → `ui2/ui3/ui4.js` (routes/pages; `ui4` has `boot()` and the 2 s main loop). `main.js` is the Vite entry.
- A route is `ROUTES.<name> = (a, b) => { setView(html); return { title, live, after, crumb }; }`. Bind events in `after()` via `data-*` + `.onclick`; no inline HTML event attributes.
- Layering: `ui1` must never import `ui2/3/4` (use `DRAWER.x()` registry); `core`/`intel` never import `ui*`. `ui2 <-> ui3` is the one allowed cycle. Every cross-file name must be `export`ed and explicitly imported, which `verify` enforces.
- Adding a `src/*.js` file: import it in `main.js`, add to `build.sh`'s list and to `FILES` in `tools/verify.mjs`. `build.sh` supports only the ESM syntax already used (named imports at line start, `export ` prefix).
- Missing metrics render "no sensor" (`nos()`), never 0. Escape all interpolated HTML with `esc()`. Charts are hand-rolled SVG. Style tokens live in `src/style.css` `:root` (light + dark).
- Dense single-line style with short names is intentional; match the file you edit.

## Deploy

`npm run check` -> commit -> `git push`; Vercel builds `main` (`vercel.json`: `npm run verify && npm run build`) to https://solpump-gamma.vercel.app. Never commit `dist/`, `node_modules/`, `.vercel/`.

## Tooling notes

- `index.html` contains an `<!-- impeccable-live-start -->` injection block; do not edit or remove it.
- Windows: keep `encoding="utf-8"` and LF newlines in `build.sh`; `python3` is a broken Store alias (script falls back to `python`).
