# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Demo viewers: prospects and evaluators browsing the public live demo. They judge legibility, credibility, and polish of a fleet-operations product at a glance — they are not operating it on shift. Secondary audience: engineers using the repo as a reference implementation.

## Product Purpose

SolPump Operations is a single-file demo webapp — a solar pump fleet dashboard driven entirely by simulated field data. It exists to showcase a complete operations product (overview, map, alerts, incidents, maintenance, analytics, per-pump detail, control, devices, reports, audit, settings) with no backend. Success: a visitor signs in within seconds, understands fleet health at a glance, and never hits a dead end.

## Positioning

A fully self-contained operations console: 30 days of plausible simulated history backfilled on load, real interactions (acknowledge, command, schedule), and zero runtime dependencies. The demo stands out by combining single-file portability (open dist/index.html from disk) with operational depth — a combination generic dashboard demos cannot truthfully copy.

## Operating Context

- Public deployment at https://solpump-gamma.vercel.app (Vercel, hash routing); local dev via `npm run dev` (Vite HMR).
- Multi-tenant demo: organization scoping (`S.orgId`), role permissions (`can()`), clock fixed to UTC+7 (WIB).
- Sign-in is a demo gate; any seeded account works.

## Capabilities and Constraints

- Runtime: plain ES modules under `src/`, bundled by Vite into one self-contained `dist/index.html`. No runtime dependencies.
- State: in-memory only — reload = fresh seed. No localStorage/fetch/persistence.
- Data: simulated; a metric a pump lacks renders "no sensor" (`nos()`), never 0.
- User-confirmed constraints: keep the Vite singlefile build, dependency-free runtime, simulated-only data, and hash routing.

## Brand Commitments

- Name: SolPump Operations. Logo asset: `assets/logo.png` (inlined at build).
- Voice: terse, operational, factual — status language like "running", "crit", "acknowledged".

## Evidence on Hand

- Full incumbent implementation: `src/core.js`, `src/intel.js`, `src/ui1–ui4.js`, `src/style.css` (design tokens in `:root`).
- `AGENTS.md` documents architecture, gates, and conventions.
- No testimonials, customers, benchmarks, or pricing — future work must not fabricate any.

## Product Principles

1. Data that doesn't exist must read as absent ("no sensor"), never as zero.
2. The artifact stays self-contained: one HTML file runs from `file://`.
3. Every gate (verify → build → smoke) passes before anything ships.
4. Density is a feature: demo viewers scan; decoration that costs scanability loses.
5. Demo plausibility over realism theater — simulate what supports the story, keep interactions honest.

## Accessibility & Inclusion

Text contrast meets WCAG AA in both light and dark themes (enforced during polish, e.g. `--ink3` fix). Dark mode follows `prefers-color-scheme` with explicit `[data-theme]` override; `prefers-reduced-motion` disables all transitions.
