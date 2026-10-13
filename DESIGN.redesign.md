<!-- SEED: established before implementation from four Dribbble references and the user's stated preferences; values are PROPOSED and pending the questionnaire. Re-run /impeccable document once code exists to capture the real tokens. The live system stays in DESIGN.md until this is approved. -->
---
name: SolPump Operations (redesign seed)
description: A calm, light-first water and solar console with physical instruments (tank vessels, gauges, rings) on soft layered cards, dark mode as an equal peer.
colors:
  paper: "#F3F6F7"
  card: "#FFFFFF"
  line: "#E2E8EA"
  ink: "#10201E"
  ink-2: "#3F5350"
  ink-3: "#5E716E"
  aqua: "#0A7F77"
  aqua-deep: "#075E58"
  aqua-tint: "#E3F4F2"
  water: "#1456C8"
  water-tint: "#E4EDFB"
  sun: "#F2B33D"
  sun-ink: "#7A4F00"
  ok: "#157A40"
  ok-tint: "#E3F4EA"
  warn: "#8A5D00"
  warn-tint: "#FFF1D0"
  crit: "#B02E24"
  crit-tint: "#FDE7E4"
  off: "#5E6A65"
  off-tint: "#E9EDEB"
  night: "#1F2630"
  night-surface: "#2A323F"
  night-line: "#434D5E"
typography:
  ui:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
  numeral-xl:
    fontFamily: "Barlow Semi Condensed, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  numeral:
    fontFamily: "Barlow Semi Condensed, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.1
    fontFeature: "tnum"
  label:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.3
rounded:
  control: "10px"
  tile: "12px"
  card: "16px"
  card-mobile: "20px"
  sheet: "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  kpi-tile:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px 18px"
  status-chip-ok:
    backgroundColor: "{colors.ok-tint}"
    textColor: "{colors.ok}"
    rounded: "999px"
    padding: "3px 10px"
  button-primary:
    backgroundColor: "{colors.aqua}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 18px"
---

# Design System: SolPump Operations (redesign seed)

## Overview

**Creative North Star: "The Control Room Window"**

SolPump is a window onto water you cannot see: wells, tanks, and sun-driven pumps spread across sites. The interface should read like looking through clean glass at real instruments, not like a spreadsheet. Calm surfaces, one physical visual per question (a tank that visibly fills, a ring that visibly closes), and numbers large enough to be read from across a room.

Direction read: Operate mode for demo viewers who judge legibility and polish at a glance, plus a mobile-first field context. Dials: ENERGY 2 (confident, not loud), RHYTHM 3 (sections change composition: a physical hero, then a dense list, then tiles), MOTION 1 to 2 (fills and rings animate once on load and on value change; nothing loops).

Adopted from the references: soft rounded layered cards on a pale ground, tinted icon squares, large numerals with small units, status chips, a physical tank vessel with a percentage scale, a muted desaturated dark theme, pastel solid accent cards and a floating pill nav on mobile.

**Key Characteristics:**
- Light-first, with a dark theme designed together, not inverted.
- One physical instrument per screen is the focal point; everything else defers to it.
- Tonal layering and 1px lines carry depth; shadow is reserved for things that float.
- Numbers are tabular, large, and carry their unit in a quieter weight.
- Status is always icon plus word plus tint, never colour alone.

## Colors

Cool paper and white cards, one aqua primary for action and "alive", water blue and sun amber reserved for their own data.

### Primary
- **Aqua** (#0A7F77): primary actions, active navigation, running state, focus ring. 4.8:1 on white, so it carries text.
- **Aqua Deep** (#075E58): pressed state and text on aqua tint.
- **Aqua Tint** (#E3F4F2): selected rows, icon squares, soft panels.

### Secondary
- **Water Blue** (#1456C8): tank fill, well level, anything that is volume. Never used for generic UI.
- **Sun Amber** (#F2B33D): solar glyphs and PV bars as fill only; use **Sun Ink** (#7A4F00) when amber must carry text.

### Neutral
- **Paper** (#F3F6F7) app ground, **Card** (#FFFFFF) surfaces, **Line** (#E2E8EA) 1px dividers and card borders.
- **Ink** (#10201E) body, **Ink 2** (#3F5350) secondary, **Ink 3** (#5E716E) captions (5:1 on white).
- Status: **OK** #157A40 / #E3F4EA, **Warn** #8A5D00 / #FFF1D0, **Crit** #B02E24 / #FDE7E4, **Offline** #5E6A65 / #E9EDEB.

### Dark theme
- **Night** (#1F2630) ground, **Night Surface** (#2A323F) cards, **Night Line** (#434D5E) borders. Primary lightens to a desaturated aqua; status hues desaturate toward the SCADA reference. Contrast is measured separately for dark, never assumed from light.

### Named Rules
**The Three Voices Rule.** Aqua is action, blue is volume, amber is sun. A fourth hue on a screen needs a written reason.
**The Never Colour Alone Rule.** A status is an icon, a word, and a tint together.

## Typography

**UI Font:** Figtree (system-ui fallback). **Numeral Font:** Barlow Semi Condensed, kept from the current app so figures stay familiar.

**Character:** friendly geometric text beside condensed instrument figures, like labels on a gauge.

### Hierarchy
- **Numeral XL** (600, clamp 40 to 56px, 1.0): the one headline number per screen.
- **Numeral** (600, 28px, 1.1): KPI tiles. Units sit beside it at 14px, 500, Ink 3.
- **Title** (600, 18px, 1.3): card and section headings.
- **Body** (400, 15px mobile 16px, 1.5): capped at 65ch.
- **Label** (500, 13px, sentence case): no uppercase tracking and no section eyebrows.

### Named Rules
**The Unit Is Quiet Rule.** The number is loud, the unit is not.

## Layout

12-column grid on desktop with 20px gaps, content capped at 1440px. Sidebar 248px from 1024px up; below that a floating bottom nav of at most five labelled items. Breakpoints 390 / 768 / 1024 / 1440, chosen where content breaks. Spacing steps 4 / 8 / 16 / 24 / 40, generous between groups and tight inside them. Tap targets 44px minimum with 8px between. Tables become stacked cards under 600px. Safe-area insets respected for fixed bars.

Composition varies by section (RHYTHM 3): a physical hero (tanks), a list-led block (needs attention), a tile strip (KPIs), then a card grid (pumps). No two adjacent sections share a composition.

## Elevation & Depth

Tonal layering first: paper, card, tinted inner tile. Cards carry a 1px line and no shadow. Only floating things (bottom nav, menus, dialogs, toasts) carry a shadow, one soft vertical offset.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 10px 28px rgb(16 32 30 / 0.12)`): bottom nav, popovers, dialogs.

### Named Rules
**The Flat Until It Floats Rule.** If it does not overlay something, it has no shadow.

## Shapes

Rounded but not pill-shaped: cards 16px (20px on mobile), inner tiles 12px, controls 10px, sheets 24px. Only status chips and the language switch are fully round. The tank vessel is a rounded cylinder with a visible scale; rings and gauges are the only circles.

## Components

### Tank vessel (signature)
- Rounded cylinder, water-blue fill with a subtle surface line, empty part in water tint, 0/25/50/75/100 ticks, the percentage sits inside, the low threshold is a dashed line. Fill animates once. Reads at 96px wide on mobile.

### KPI tile
- Tinted 36px icon square, label, numeral plus quiet unit. No delta arrows without a real comparison period.

### Status chip
- Tinted background, 14px icon, word. Pill radius. Four states only: Healthy, Attention, Critical, Offline.

### Buttons
- **Primary:** aqua, white text, 44px high, radius 10px. **Secondary:** white with 1px line. **Hover:** deepen by one step. **Focus:** 2px aqua ring with 2px offset, never removed.

### Pump card
- State chip, three instrument values (flow, water today, health bar), last update. The whole card is the target.

### Navigation
- Desktop: light sidebar, grouped, active row filled with aqua tint (no coloured edge stripe). Mobile: floating pill with four to five icon-plus-label items, active item filled.

## Do's and Don'ts

### Do:
- **Do** give every screen one physical focal instrument and let the rest defer to it.
- **Do** use tabular numerals and place units in a quieter weight.
- **Do** design light and dark together and measure contrast in each.
- **Do** show real demo values or an honest "no sensor" state, never an invented trend.
- **Do** keep 44px targets, visible focus, and icon plus word for every status.

### Don't:
- **Don't** put a gradient wash behind the page or glow behind cards.
- **Don't** use a coloured left stripe on cards or list rows to signal severity.
- **Don't** repeat one card composition across every section.
- **Don't** parent a pill badge above a heading, or use uppercase wide-tracked labels as section eyebrows.
- **Don't** use a fake terminal, bento mosaic, or stock illustration as decoration.
