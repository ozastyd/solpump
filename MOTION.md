# SolPump Motion Guideline

Motion here exists to explain change, not to decorate. Every animation answers one of three questions: *where did that come from*, *what just changed*, or *did my touch register*. If it answers none, it is not added.

Sources: Apple's Human Interface Guidelines (Motion) and the WWDC18 talk "Designing Fluid Interfaces". The tokens and rules below are SolPump's own, written in that spirit. They are not Apple's numbers.

## What Apple would do with this app

Short answer: they would stop redrawing it and start *changing* it.

1. **Keep things alive between ticks.** The app rebuilds the whole view every 2 seconds (the main loop in `ui4.js` replaces the DOM). Anything on screen is destroyed and recreated, so nothing can ever animate from its old value to its new one: numbers jump, tank levels snap, chips flicker. Apple's fluid-interface principle is continuity: an object keeps its identity and moves. Here that means patching existing nodes (or keying them) and animating the value from old to new, instead of replacing markup.
2. **Show cause and effect with one shared element.** Tapping a pump card opens the pump page. Today the page cuts. Apple would grow the card into the page header (a shared-element transition), so the user sees *which* pump they opened and how to get back.
3. **Make every gesture interruptible and immediate.** The sidebar drawer, modals and the bottom nav respond on touch-down, follow the finger, and can be reversed mid-motion. Nothing waits for an animation to finish before the next tap works.
4. **Prefer springs to fixed curves.** Springs carry velocity, so a flicked drawer feels like it was thrown, not played back. Fixed easing is reserved for fades.
5. **Be quieter where people are working.** A monitoring tool is looked at for hours. Apple would keep motion rare and short, and make the one big moment (route change, drawer) feel physical.
6. **Treat Reduce Motion as a design, not a switch.** The current rule disables all transitions, which also removes useful feedback. Apple's approach is to swap movement for a short crossfade and keep state changes visible.

## Principles

1. **Purposeful.** One cause, one visible effect. No ambient loops, no pulsing dots, no shimmer on live data.
2. **Responsive.** Feedback starts within one frame of the input (under 100 ms). The animation may still be settling, but the response has begun.
3. **Interruptible.** Any motion can be cancelled or reversed by the next input without a jump.
4. **Continuous.** Things change in place. Where something moves, it moves from where it was.
5. **Proportional.** Bigger or farther change means a slightly longer motion. Small state changes are almost instant.
6. **Cheap.** Animate `transform` and `opacity` only. Never animate `width`, `height`, `top`, `left` or anything that reflows.

## Tokens

```css
:root{
  /* durations */
  --m-instant: 90ms;   /* press, toggle, focus ring */
  --m-quick:   160ms;  /* chips, hover, small state change */
  --m-base:    280ms;  /* cards, list changes, tab content */
  --m-large:   420ms;  /* drawer, sheet, route change */
  /* curves (non-spring) */
  --e-out:     cubic-bezier(.2,.8,.2,1);   /* things arriving */
  --e-in:      cubic-bezier(.4,0,1,1);     /* things leaving (use ~65% of the entering duration) */
  --e-inout:   cubic-bezier(.4,0,.2,1);    /* moves that stay on screen */
  /* springs as CSS linear(): sampled from a damped spring, settle about 0.6 s */
  --spring-smooth: linear(0, .097, .282, .466, .619, .736, .821, .881, .921, .949, .967, .979, .986, .991, .995, .997, 1);  /* no overshoot */
  --spring-snappy: linear(0, .145, .404, .637, .803, .907, .964, .992, 1.003, 1.006, 1.006, 1.004, 1.003, 1.001, 1);        /* tiny overshoot */
}
```

`--spring-smooth` is critically damped (response 0.45 s). `--spring-snappy` is slightly under-damped (response 0.35 s, damping ratio 0.85). Use the smooth one by default; use snappy only for things the user flicks or drags.

## Catalogue

| Interaction | Motion | Token |
|---|---|---|
| Press on a button, card, nav item | Scale to 0.97 and back, on touch-down | `--m-instant`, `--e-out` |
| Hover (pointer) | Border or tint change only, no movement | `--m-quick` |
| Keyboard focus | Ring appears instantly; never animated away | none |
| Status chip changes | Crossfade colour and text | `--m-quick` |
| Number changes (flow, level, %) | Tween old to new, tabular figures so nothing shifts | 300 ms, `--e-out` |
| Tank fill changes | Fill height eases to the new level; the low-level line never moves | `--spring-smooth`, 500 ms |
| Ring and gauge change | Stroke animates to the new value | `--spring-smooth` |
| First load of a screen | Tank, ring and gauge draw once from empty. Everything else is already there | `--spring-smooth`, once per session |
| Route change | Content fades and rises 8 px. Shared element where one exists (card to pump header) | `--m-base` fade, `--spring-smooth` move |
| Sidebar drawer (mobile) | Slides with a spring; backdrop fades; drag to close follows the finger | `--spring-snappy`, `--m-base` |
| Bottom nav active item | The filled pill slides to the new item | `--spring-snappy` |
| Modal and dialog | Fade plus 12 px rise from the trigger; leaves faster than it arrives | `--m-base` in, 65% out |
| Toast | Rises 12 px and fades; leaves by fading only | `--m-base` |
| Alert appears or is cleared | The row fades and collapses its height by transform on a wrapper, others shift once | `--m-base` |
| Tab content | Crossfade, no slide | `--m-quick` |
| Chart | Draws once on first view. Live updates append a point and slide the window; no redraw | 400 ms |

## Live data: the rule that matters most

The simulation ticks every 2 seconds. Live values must therefore be the *calmest* thing on screen.

1. **No flash, no pulse, no highlight on update.** A changed number animates from old to new and settles. If nothing changed, nothing happens.
2. **Never animate during typing or an open dialog.** The loop already pauses then; keep it that way.
3. **Skip motion while the tab is hidden.** Apply the final state on return.
4. **Respect the user's place.** A re-render must not reset scroll, focus, an open popover or a playing animation.
5. **Throttle by meaning.** A value that moved by less than the display precision does not animate.

## Reduced motion

Do not remove all transitions. Replace them:

- Movement, scale and springs become a 120 ms crossfade or an instant change.
- Numbers, tank fills, rings and gauges jump to the new value.
- Press feedback keeps its colour change; it drops the scale.
- No autoplay of any draw-in.
- Focus rings, hover tints and chip colour changes are unaffected: they are state, not motion.

```css
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{ animation-duration:.01ms!important; animation-iteration-count:1!important; scroll-behavior:auto!important }
  .moves{ transition-property:opacity,color,background-color,border-color!important; transition-duration:120ms!important }
}
```

## Implementation notes for this codebase

- **Stop replacing the DOM for live values.** For the overview, render once, then update by id: set text, set `style.height`/`stroke-dasharray` or `transform: scaleY()` on the existing tank and ring nodes. A small `patch(el, value)` helper that tweens numbers with `requestAnimationFrame` (and cancels on the next tick) covers numbers, tanks, rings and gauges.
- **Prefer `transform` over `height` for fills.** Draw the tank fill at full height and scale it from the bottom (`transform-origin: bottom`).
- **Route changes:** use the View Transitions API where it exists (`document.startViewTransition`), with a plain fade fallback. Give the pump card and the pump header the same `view-transition-name` to get the shared-element move.
- **Drawer and nav pill:** use the Web Animations API or CSS `transition` with the spring tokens; read the finger position for the drag and release with its velocity.
- **No layout animation.** If a list must reorder, animate with FLIP (measure, apply inverse transform, release).
- **Frame budget:** under 16 ms of script per frame. Never run a tween on more than about 20 elements at once.
- **Tests:** the smoke run should assert that a tick does not change scroll position or focus, and that the main thread stays idle between ticks.

## Don't

- Don't loop or pulse anything (live dots, "breathing" cards, shimmering numbers).
- Don't animate on every tick just to show that data is live.
- Don't stagger more than five items, at 30 ms apart.
- Don't use bounce on anything the user did not throw.
- Don't make a motion longer than 500 ms, except the one-time draw-in.
- Don't hide information behind a motion: the final state must be readable the moment it appears.

## Acceptance checklist

- [ ] The same tap can be repeated rapidly with no queued or stuck animation.
- [ ] Opening and closing the drawer mid-motion reverses smoothly.
- [ ] A 2-second tick leaves scroll, focus, popovers and open details untouched.
- [ ] With Reduce Motion on, every state change is still visible and nothing slides or scales.
- [ ] No animation touches layout properties (check the performance panel for layout work during motion).
- [ ] Nothing moves in the first 100 ms after the user lifts their finger except the response to it.
- [ ] Dark and light themes use the same timings.

## Implemented so far

- `src/motion.js`: `settle()` runs after every render. Elements marked `data-k` (unique key), `data-t` (`n` number, `tank`, `ring`, `gauge`, `bar`) and `data-v` (the new value) animate from the value they had on the previous render. Numbers take 350 ms, instruments 600 ms with a critically damped spring. Nothing animates when Reduce Motion is on or the tab is hidden. Tanks, rings and gauges draw in once from empty on first view.
- Live on the Overview: water today, tank levels and fills, solar today, availability ring, and every pump card (flow number and gauge, water today, health score and bar).
- Press feedback (scale .97 on touch-down), the mobile drawer on the motion tokens (spring where `linear()` is supported), a short fade-and-rise on route change only, and chip and pill colour crossfades.
- Reduced motion keeps colour feedback (120 ms) and drops movement, instead of turning every transition off.
- Verified in a browser at 10x simulation speed: values passed through intermediate steps (32 distinct displayed values in 9 s, against 6 with Reduce Motion on), the tank fill moved smoothly, and the scroll position was kept across ticks.
- Not done yet: shared-element card-to-page transition, bottom-nav pill slide, drag-to-close drawer, and DOM patching on pages other than Overview (they still redraw each tick, so only Overview animates values).
