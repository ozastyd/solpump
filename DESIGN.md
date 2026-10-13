---
name: SolPump Operations
description: Solar pump fleet operations console — a field-instrumentation dashboard for demo viewers
colors:
  deep: "#0A3A27"
  deep2: "#0E4A32"
  brand: "#0C7F48"
  sun: "#F7DC00"
  paper: "#F2F5F3"
  card: "#FFFFFF"
  ink: "#16251E"
  ink2: "#4A5B53"
  ink3: "#63746C"
  line: "#D7E0DB"
  line2: "#E8EEEA"
  ok: "#157A40"
  okbg: "#E3F4EA"
  warn: "#8A5D00"
  warnbg: "#FFF4D6"
  crit: "#B02E24"
  critbg: "#FCE6E3"
  off: "#5E6A65"
  offbg: "#ECEFED"
  water: "#1B6CA8"
  solar: "#D49A00"
  power: "#7A4FB5"
  well: "#2F8C83"
  press: "#B5523B"
  focus: "#1B6CA8"
typography:
  body:
    fontFamily: "Barlow, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
  num:
    fontFamily: '"Barlow Semi Condensed", "Arial Narrow", system-ui, sans-serif'
rounded:
  r1: "4px"
  r2: "8px"
  r3: "12px"
---

# Design System: SolPump Operations

## Overview

**Creative North Star: "The Field Console"**

SolPump Operations looks like instrumentation built for people who watch water move: a dark pine sidebar housing the controls, a bright instrument face where the data lives, and status communicated in tinted chips that can be read in one sweep. Every panel earns its place by carrying a number, a state, or a control — decoration that does not help someone scan loses. The aesthetic philosophy is operational credibility: this should feel like software a utility would actually run, not a marketing mock of one.

Light theme is the default (misty paper background, white instrument cards); dark theme is a first-class twin driven by `prefers-color-scheme` and `[data-theme]`, never an afterthought. Confirmed visual rejections: shadows as hierarchy, gradients, glow, and any hue outside the token set.

**Key Characteristics:**
- Hairline borders and tinted surfaces carry hierarchy; surfaces are flat at rest
- All figures set in Barlow Semi Condensed with tabular numerals for column alignment
- Status always arrives as a tinted pill pair (tint background + saturated text), never bare color
- Signal yellow (`#F7DC00`) marks the live/demo state and nothing else
- Dense but breathing: 4–14px padding steps, generous whitespace only around narrative copy

## Colors

The palette is an instrument palette: one dominant pine-green family for chrome and brand, a paper/ink neutral ladder for the working surface, and a small set of semantic hues that each own exactly one meaning.

### Primary
- **Console Pine** (#0A3A27): sidebar background, active segment fills (`.seg button.on`), deep anchors
- **Pine Lift** (#0E4A32): secondary deep surface (hover depth, dark-theme counterpart)
- **Pump Green** (#0C7F48): primary action fill (`.btn.pri`), brand identity moments

### Accent
- **Signal Yellow** (#F7DC00): the live signal — active-nav bar, DEMO badge, clock accents. It never carries body text and never appears as decoration.

### Neutral
- **Mist Paper** (#F2F5F3): page background (`--paper`)
- **Instrument White** (#FFFFFF): card/panel surface (`--card`)
- **Field Ink** (#16251E): primary text (`--ink`)
- **Slate Fern** (#4A5B53): secondary text (`--ink2`)
- **Fern Grey** (#63746C): muted/meta text (`--ink3`, AA-verified on white and paper)
- **Hairline Green** (#D7E0DB) / **Hairline Faint** (#E8EEEA): borders and inner dividers

### Status (always deployed as tint + text pairs)
- **Verified Green** (#157A40) on **Verified Tint** (#E3F4EA) — ok/running
- **Caution Amber** (#8A5D00) on **Caution Tint** (#FFF4D6) — warn/degraded
- **Alarm Red** (#B02E24) on **Alarm Tint** (#FCE6E3) — crit/fault
- **Standby Grey** (#5E6A65) on **Standby Tint** (#ECEFED) — off/maintenance

### Domain hues (charts and series only)
**Hydro Blue** (#1B6CA8, water/level), **PV Gold** (#D49A00, solar), **Grid Violet** (#7A4FB5, power), **Aqua Teal** (#2F8C83, well), **Pressure Rust** (#B5523B, pressure). Focus ring reuses Hydro Blue (#1B6CA8).

### Named Rules
**The Signal Yellow Rule.** #F7DC00 marks liveness (active nav indicator, DEMO badge, demo clock pill). Its rarity is the point — never use it for body text, large fills, or generic highlights.

**The Status Pair Rule.** Status color never appears as bare text or bare fill: it is always the semantic tint background with the saturated semantic text on top, inside a pill.

## Typography

**Display/Body Font:** Barlow (system-ui fallback stack)
**Numeric Font:** Barlow Semi Condensed ("Arial Narrow", system-ui fallback) — every figure, metric, timestamp, and count

**Character:** Barlow's slightly squared, utilitarian grotesque reads engineered without turning cold; the semi-condensed numeric companion packs dense readouts while its tabular figures keep columns honest.

### Hierarchy
- **Page title** (20px, 600, -0.005em): route title in the top bar (`.top h1`; 18px ≤700px)
- **Section** (17px, 600): panel headings (`h2`)
- **Subsection** (15px, 600): card/panel sub-headings (`h3`)
- **Body** (15px/1.45, 400): default copy (`body` font shorthand); tables 14px
- **Small/meta** (13px, 400): crumbs, helper text (`.small`, `.top .crumb`)
- **Label** (12–13px, 500–600): pill text (13px/500), nav group heads (12px), badges; numeric labels use `--num`
- **Figures**: `.num` sets `font-family: var(--num)` + `font-variant-numeric: tabular-nums`; KPI/table numbers 14–15px

### Named Rules
**The Tabular Figure Rule.** Anything that is a number in a column uses the numeric family with tabular figures — alignment is part of credibility.

## Layout

App shell: a fixed 260px dark sidebar (`.side`, Console Pine, full height, its own scroll) beside a main column of top bar (`.top`, card background, hairline bottom border, wraps) over a scrolling content region (`.view`, 20px/22px padding, 40px bottom). Sidebar groups (`.nav .grp`, 12px muted-green) segment the nav; the active link gets a translucent white row plus a 4px Signal Yellow bar bleeding off the left edge.

Content grids: KPI strips are single bordered cards of 10 columns (7 on Pumps) split by hairlines (`.kpis`/`.kpi`), wrapping to 5 then fewer columns as width drops; pump cards use auto-fill `minmax(330px,1fr)` (`.pgrid`); narrative text caps at 78ch.

Breakpoints: **1280** (KPI → 5 cols), **1100** (main splits to single column; quick-stats wrap), **900** (sidebar becomes an off-canvas 260px drawer with `.2s` slide; optional table columns `.opt` hide), **700** (top bar tightens, title 18px), **600** (view padding shrinks; clock wraps). Mobile-first fidelity matters: demo viewers arrive from links on phones.

## Elevation & Depth

Flat by default. Hierarchy is built from hairline borders (`--line`, `--line2`), the paper↔card surface step, and the dark sidebar — not from elevation.

### Shadow Vocabulary (overlays only)
- **Map popup** (`box-shadow: 0 8px 24px rgba(0,0,0,.18)`): floating card over the map
- **Modal** (`0 20px 60px rgba(0,0,0,.3)`): dialog over scrim
- **Toast** (`0 6px 20px rgba(0,0,0,.25)`): transient notification
- **Drawer** (`-10px 0 30px rgba(0,0,0,.12)`): right-side panel separation
- **Active ring** (`0 0 0 1px var(--line)`): pressed/selected pill buttons (`.clock button.on`) — a 1px ring, not a shadow

### Named Rules
**The Overlay-Only Shadow Rule.** Shadows exist only on things that physically float above the page (popup, modal, toast, drawer). Content cards stay flat; if you need separation, reach for a border or the surface step first.

## Shapes

Radius ladder: **4px** (`.r1` — inputs, small fields), **8px** (`.r2` — buttons, segmented controls, popups, toasts), **12px** (`.r3` — KPI strips, pump cards, modals). Full-round **999px** for status pills, the clock capsule, count badges, and the active-nav bar (with a 3px soft end). Borders are 1px hairlines throughout; inner dividers (`.kpi` right borders, table row lines) use the fainter `--line2`. Clipping is deliberate: KPI strips and segmented controls use `overflow:hidden` so child hairlines meet the rounded edge cleanly.

## Components

### Buttons
- **Shape:** 8px radius (`.r2`), 1px hairline border, 6px 12px padding, 14px/500 (`.btn.sm`: 3px 9px, 13px)
- **Primary:** Pump Green fill + white text (`.btn.pri`); hover deepens to #0A6B3C
- **Danger:** Alarm Red fill + white text (`.btn.danger`)
- **Default/secondary:** white card fill, hairline border; hover darkens border to Fern Grey
- Inline-flex with 6px icon gap; all buttons inherit `font:inherit; color:inherit` reset

### Status Pills
- **Shape:** 999px, 13px/500, 2px 10px 2px 8px padding, optional leading dot (removed on `.plain`)
- **States:** ok / warn / crit / off — each its tinted pair (see Colors). Text never wraps (`white-space:nowrap`)

### Navigation (sidebar)
- **Style:** 7px 10px items, 6px radius, #DCEBE2 text, 17px icons at 0.9 opacity, 10px icon gap, 500 weight
- **Hover:** 6% white row · **Active:** 10% white row + 4px Signal Yellow left bar · **Sub-items:** indented 32px, 13.5px, #B9D2C4
- **Count badges:** numeric family, crit/warn background, 999px, right-aligned

### Segmented Controls
- **Shape:** shared 8px-radius container, hairline border, overflow hidden; 1px `--line2` separators between 5px 11px buttons (13px)
- **Active:** Console Pine fill, white text

### KPI Cells
- **Style:** 10px 12px padding inside the shared bordered strip; cells divided by right/bottom hairlines; label muted 12–13px above a 14–15px numeric figure in the numeric family

### Cards
- **Shape:** 12px radius (`.r3`), hairline border, white/card fill, 14px padding (`.pcard`), 9px internal gap rhythm
- **Grid:** auto-fill minmax(330px,1fr), 14px gap

### Inputs
- **Style:** 4px radius (`.r1`), hairline border, card fill, 5px 8px padding; selects and textareas share the reset (`font:inherit; color:inherit`)
- **Focus:** browser/system focus ring in Hydro Blue (`--focus` token)

### Simulated Clock Capsule (signature)
- Paper-fill 999px capsule in the top bar, numeric family, hairline border: live sim time + Sun "DEMO" badge + speed buttons; active button gets the 1px ring treatment

## Do's and Don'ts

### Do:
- **Do** set every metric in the numeric family with tabular figures (`var(--num)` + `tabular-nums`)
- **Do** express status as tinted pill pairs (tint bg + saturated text) — four canonical pairs only
- **Do** separate surfaces with hairlines (`--line`/`--line2`) and the paper↔card step before considering a shadow
- **Do** keep AA text contrast in both themes (muted text ≥ 4.5:1 on its surface)
- **Do** mark absent data as "no sensor", never as 0
- **Do** reserve Signal Yellow for live/demo indicators

### Don't:
- **Don't** add shadows to content cards — overlays only
- **Don't** introduce hues outside the token set, gradients, or glow effects
- **Don't** use Signal Yellow as text or a large fill
- **Don't** let numbers default to the body font in tables or KPI strips
- **Don't** animate under `prefers-reduced-motion` (all transitions are already disabled there)
