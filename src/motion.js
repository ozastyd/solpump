/* Value continuity across re-renders (see MOTION.md): elements marked data-k / data-t / data-v animate from their previous value to the new one. */
import { clamp, fmtN } from './core.js';
const PREV = new Map(), RUN = new Map();
const RM = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
const spring = p => 1 - Math.exp(-9 * p) * (1 + 9 * p);
const put = (el, t, v) => {
  if (t === "n") el.textContent = fmtN(v, +(el.dataset.d || 0));
  else if (t === "tank") { const h = 132 * clamp(v, 0, 100) / 100, y = 134 - h, c = el.children; c[0].setAttribute("y", y); c[0].setAttribute("height", h); c[1].setAttribute("y", y); }
  else if (t === "ring") el.setAttribute("stroke-dasharray", `${(clamp(v, 0, 100) * 1.131).toFixed(1)} 113.1`);
  else if (t === "gauge") el.setAttribute("stroke-dasharray", `${(clamp(v / (+el.dataset.max || 1), 0, 1) * 138.2).toFixed(1)} 138.2`);
  else if (t === "bar") el.style.transform = `scaleX(${clamp(v, 0, 100) / 100})`;
};
export function settle(root = document) {
  const live = !RM.matches && !document.hidden;
  for (const el of root.querySelectorAll("[data-k]")) {
    const k = el.dataset.k, t = el.dataset.t, v = +el.dataset.v, o = PREV.get(k);
    PREV.set(k, v); cancelAnimationFrame(RUN.get(k)); RUN.delete(k);
    const from = o !== undefined ? o : t === "n" ? v : 0;
    if (!live || from === v || !isFinite(v) || !isFinite(from)) continue;
    const dur = t === "n" ? 350 : 600, t0 = performance.now(); put(el, t, from);
    const step = now => { const p = Math.min(1, (now - t0) / dur); put(el, t, p < 1 ? from + (v - from) * spring(p) : v); if (p < 1) RUN.set(k, requestAnimationFrame(step)); else RUN.delete(k); };
    RUN.set(k, requestAnimationFrame(step));
  }
}
