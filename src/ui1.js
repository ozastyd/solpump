/* ============================================================
   UI layer
   ============================================================ */
import { $, D, DOW, H, MIN, ROLES, S, SIM, TS, audit, byId, can, clamp, dev, dk, fmtAgo, fmtDT, fmtDate, fmtDur, fmtN, fmtTime, has, last, lh, myPumps, pump, scoped, site, user, wib, window_ } from './core.js';
import { I18N, LANGS, setLang, tl, tlk, tlx } from './i18n.js';
import { settle } from './motion.js';
import { ST_TXT, daily, diagnose, fiveQ, hColor, health, status, today, wellStats } from './intel.js';
export const memo = (fn) => { const c = new Map(); return (p) => { const k = I18N.lang + p.id + "@" + S.now + "#" + TS[p.id].length + "/" + S.alarms.length; if (c.size > 300) c.clear(); if (!c.has(k)) c.set(k, fn(p)); return c.get(k); }; };
export const healthM = memo(health), statusM = memo(status), diagM = memo(diagnose), fiveQM = memo(fiveQ), wellM = memo(wellStats);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const UI = { range: "24h", from: null, to: null, tab: {}, site: "all", alertTab: "open", aTab: "water", aPer: "7d", puF: "all", puSite: "all", puSort: "urg", puView: "cards", rep: "daily", repPer: "7d", menu: false };
export const DRAWER = {}; // top-bar drawers registered by ui4 (avoids ui1→ui4 cycle)
export const langSel = () => `<div class="seg lang" role="group" aria-label="${esc(tl("Language"))}">${LANGS.map(([k, s, n]) => `<button data-lang="${k}" class="${I18N.lang === k ? "on" : ""}" title="${esc(n)}" aria-pressed="${I18N.lang === k}">${s}</button>`).join("")}</div>`;
export const bindLang = () => document.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { if (b.dataset.lang === I18N.lang) return; setLang(b.dataset.lang); S.session ? renderAll(true) : renderLogin(); });
export const pill = (c, t) => `<span class="pill ${c}">${esc(t)}</span>`;
export const COND = { ok: tlk("Healthy"), warn: tlk("Attention"), crit: tlk("Critical"), off: tlk("Offline") };
export const condPill = c => pill(c, tlx(COND[c] || c));
export const stCell = st => st.c === "off" ? condPill("off") : `<span class="stx">${esc(tlx(st.label))}</span>${condPill(st.c)}`;
export const sev = s => `<span class="sev ${s}">${s === "critical" ? tl("Critical") : s === "warning" ? tl("Warning") : tl("Info")}</span>`;
export const hbar = s => `<span class="health"><b class="num" style="font-size:16px;color:var(--${hColor(s)})">${s}</b><span class="hb"><i style="width:${s}%;background:var(--${hColor(s)})"></i></span></span>`;
export const nos = (txt) => `<span class="na">${txt ?? tl("no sensor")}</span>`;
export function go(h) { location.hash = h; }
let VT = false;
const canVT = () => !!document.startViewTransition && !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
/* pump card -> pump page: the card and the page header share a view-transition name so the card grows into the header (MOTION.md) */
export function navTo(hash, src) {
  const card = src && src.closest ? src.closest(".pc, .pcard") : null;
  if (!card || !canVT() || !hash.startsWith("#/pump/") || location.hash === hash) return go(hash);
  card.style.viewTransitionName = "pump-hero"; VT = true;
  document.startViewTransition(() => new Promise(res => { card.style.viewTransitionName = ""; window.addEventListener("hashchange", () => setTimeout(res), { once: true }); go(hash); })).finished.finally(() => { VT = false; });
}

/* ---------- icons ---------- */
export const IC = {
  overview: '<path d="M3 13h7V3H3zM14 21h7V11h-7zM3 21h7v-6H3zM14 3v6h7V3z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  alerts: '<path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zM10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  incidents: '<path d="M12 3 2 20h20L12 3zM12 10v4M12 17v.5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  maint: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  analytics: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  control: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="16" cy="6" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="18" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  devices: '<path d="M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h0M2 8.5a15 15 0 0 1 20 0" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  reports: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  audit: '<path d="M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  settings: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" stroke-width="1.8"/>',
  blueprint: '<path d="M4 4h16v16H4zM4 10h16M10 10v10" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  pumps: '<circle cx="9" cy="11" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="11" r="1.4" fill="currentColor"/><path d="M9 6V3h7M14 11h6M5 18h8" fill="none" stroke="currentColor" stroke-width="1.8"/>',
};
IC.menu = '<path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
IC.sun = '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>';
IC.check = '<path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
IC.warn = '<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
IC.off = '<path d="M2 2l20 20M8.5 8.5A7 7 0 0 0 5 12a7 7 0 0 0 11 5.7M12 5a7 7 0 0 1 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
export const svgI = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;

/* ---------- charts (dependency-free SVG, downsampled by bucket) ---------- */
export const CH = {};
export let chN = 0;
export function lineChart({ from, to, pts, series, h = 150, unit = "", invert = false, yMin, yMax, title }) {
  const id = "ch" + (++chN), W = 640, padL = 44, padR = 10, padT = 8, padB = 22, n = 180;
  const bw = (to - from) / n, B = series.map(() => new Array(n).fill(null)), C = new Array(n).fill(0);
  for (const x of pts) { const i = Math.floor((x.t - from) / bw); if (i < 0 || i >= n) continue; C[i]++; series.forEach((s, k) => { const v = s.get(x); if (v != null && !isNaN(v)) B[k][i] = (B[k][i] ?? 0) + v; }); }
  series.forEach((s, k) => { for (let i = 0; i < n; i++) if (B[k][i] != null) B[k][i] /= C[i]; });
  const all = B.flat().filter(v => v != null);
  if (!all.length) return `<div class="nosensor">${tl("No data in this period")}</div>`;
  let lo = yMin ?? Math.min(...all), hi = yMax ?? Math.max(...all);
  if (yMin == null) lo = Math.min(lo, 0 + (lo > 0 && !invert ? 0 : lo)); if (hi - lo < 1e-6) hi = lo + 1;
  const span = hi - lo; hi += span * 0.08; if (yMin == null && lo !== 0) lo -= span * 0.08;
  const X = i => padL + (i + 0.5) / n * (W - padL - padR), Y = v => invert ? padT + (v - lo) / (hi - lo) * (h - padT - padB) : h - padB - (v - lo) / (hi - lo) * (h - padT - padB);
  let g = "";
  for (let j = 0; j <= 3; j++) { const v = lo + (hi - lo) * j / 3, y = Y(v); g += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="var(--line2)"/><text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--ink3)" font-family="var(--num)">${fmtN(v, Math.abs(hi - lo) < 5 ? 1 : 0)}</text>`; }
  const ticks = 6; for (let j = 0; j <= ticks; j++) { const t = from + (to - from) * j / ticks, x = padL + j / ticks * (W - padL - padR); g += `<text x="${x}" y="${h - 5}" text-anchor="${j === 0 ? "start" : j === ticks ? "end" : "middle"}" font-size="11" fill="var(--ink3)" font-family="var(--num)">${(to - from) > 2 * D ? fmtDate(t) : fmtTime(t)}</text>`; }
  series.forEach((s, k) => {
    let d = "", pen = false;
    for (let i = 0; i < n; i++) { const v = B[k][i]; if (v == null) { pen = false; continue; } d += (pen ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); pen = true; }
    if (s.area) { let a = ""; let seg = []; const flush = () => { if (seg.length > 1) a += `M${X(seg[0])} ${Y(Math.max(lo, 0))}` + seg.map(i => `L${X(i).toFixed(1)} ${Y(B[k][i]).toFixed(1)}`).join("") + `L${X(seg[seg.length - 1])} ${Y(Math.max(lo, 0))}Z`; seg = []; }; for (let i = 0; i < n; i++) { if (B[k][i] == null) flush(); else seg.push(i); } flush(); g += `<path d="${a}" fill="${s.color}" opacity=".12"/>`; }
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.w || 1.8}" ${s.dash ? 'stroke-dasharray="5 4"' : ""} stroke-linejoin="round"/>`;
  });
  if (series.ref) g += series.ref;
  CH[id] = { from, to, n, B, series: series.map(s => ({ label: tlx(s.label), color: s.color })), unit, X, padL, padR, W };
  return `<div class="chart" data-ch="${id}"><svg viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(title || series.map(s => tlx(s.label)).join(", "))}">${g}<line class="xh" x1="0" x2="0" y1="${padT}" y2="${h - padB}" stroke="var(--ink3)" stroke-dasharray="2 3" opacity="0"/></svg><div class="tip"></div></div>`;
}
export function barChart({ items, h = 150, unit = "", color = "var(--water)", fmt = 1, label }) {
  const W = 640, padL = 44, padB = 22, padT = 8, n = items.length; if (!n) return `<div class="nosensor">${tl("No data")}</div>`;
  const hi = Math.max(...items.map(i => i.v), 0.001) * 1.1; const bw = (W - padL - 10) / n;
  let g = ""; for (let j = 0; j <= 3; j++) { const v = hi * j / 3, y = h - padB - v / hi * (h - padT - padB); g += `<line x1="${padL}" x2="${W - 10}" y1="${y}" y2="${y}" stroke="var(--line2)"/><text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--ink3)" font-family="var(--num)">${fmtN(v, hi < 10 ? 1 : 0)}</text>`; }
  items.forEach((it, i) => { const bh = it.v / hi * (h - padT - padB), x = padL + i * bw + bw * 0.15; g += `<rect x="${x}" y="${h - padB - bh}" width="${bw * 0.7}" height="${Math.max(0, bh)}" rx="2" fill="${it.c || color}" opacity="${it.dim ? .45 : 1}"><title>${esc(tlx(it.l))}: ${fmtN(it.v, fmt)} ${unit}</title></rect>`; if (n <= 14 || i % Math.ceil(n / 10) === 0) g += `<text x="${x + bw * 0.35}" y="${h - 6}" text-anchor="middle" font-size="11" fill="var(--ink3)" font-family="var(--num)">${esc(tlx(it.l))}</text>`; });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label || tl("bar chart"))}">${g}</svg></div>`;
}
document.addEventListener("mousemove", e => {
  const el = e.target.closest?.(".chart[data-ch]"); document.querySelectorAll(".chart .tip").forEach(t => { if (!el || !el.contains(t)) t.style.display = "none"; });
  if (!el) return; const c = CH[el.dataset.ch]; if (!c) return;
  const svg = el.querySelector("svg"), r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * c.W;
  const i = Math.round((sx - c.padL) / (c.W - c.padL - c.padR) * c.n - 0.5); if (i < 0 || i >= c.n) return;
  const t = c.from + (i + 0.5) * (c.to - c.from) / c.n, tip = el.querySelector(".tip"), xh = svg.querySelector(".xh");
  const rows = c.series.map((s, k) => c.B[k][i] == null ? "" : `<div><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color};margin-right:5px"></i>${esc(s.label)}: <b>${fmtN(c.B[k][i], c.B[k][i] < 10 ? 2 : c.B[k][i] < 100 ? 1 : 0)}</b> ${c.unit}</div>`).join("");
  if (!rows) { tip.style.display = "none"; return; }
  tip.innerHTML = `<div style="opacity:.75">${fmtDT(t)}</div>${rows}`; tip.style.display = "block";
  tip.style.left = ((c.X(i)) / c.W * r.width) + "px"; tip.style.top = "10px";
  xh.setAttribute("x1", c.X(i)); xh.setAttribute("x2", c.X(i)); xh.setAttribute("opacity", ".8");
});

/* ---------- shell ---------- */
export function navCounts() {
  const al = scoped(S.alarms).filter(a => a.state === "active");
  return { alerts: al.length, crit: al.some(a => a.sev === "critical"), inc: scoped(S.incidents).filter(i => !["Resolved", "Closed"].includes(i.status)).length, maint: scoped(S.tasks).filter(t => t.status !== "Done" && (S.session.role !== "tech" || t.assignee === S.session.userId)).length };
}
export function renderShell() {
  const c = navCounts();
  const links = [
    [tl("Operate"), [["overview", tl("Fleet overview"), "overview"], ["map", tl("Map"), "map"], ["alerts", tl("Alerts"), "alerts", c.alerts ? `<span class="cnt ${c.crit ? "" : "w"}">${c.alerts}</span>` : ""], ["incidents", tl("Incidents"), "incidents", c.inc ? `<span class="cnt w">${c.inc}</span>` : ""], ["maintenance", S.session.role === "tech" ? tl("My tasks") : tl("Maintenance"), "maint", c.maint ? `<span class="cnt w">${c.maint}</span>` : ""]]],
    [tl("Understand"), [["analytics", tl("Water & wells"), "analytics"], ["pumps", tl("Pumps"), "pumps", "", "sub"], ["reports", tl("Reports"), "reports"]]],
    [tl("Configure"), [["control", tl("Automation & schedules"), "control"], ["devices", tl("IoT devices"), "devices"], ...(can("audit") ? [["audit", tl("Audit log"), "audit"]] : []), ["settings", tl("Settings"), "settings"], ["blueprint", tl("System blueprint"), "blueprint"]]],
  ];
  const cur = (location.hash.slice(2).split("/")[0]) || "overview";
  $("#side").innerHTML = `<div class="logo"><img src="${LOGO}" alt="${esc(tl("LZIS Assalaam — Zakat, Infaq & Shodaqoh Institution"))}"></div>
    <div class="prod"><b>SolPump Operations</b>${tl("Solar water pumping, managed remotely")}</div>
    <nav class="nav">${links.map(([g, ls]) => `<div class="grp">${g}</div>` + ls.map(([h, l, i, x, sub]) => `<a href="#/${h}" class="${sub ? "sub " : ""}${cur === h || (cur === "pump" && h === "pumps") || (cur === "incident" && h === "incidents") ? "on" : ""}">${svgI(i)}<span>${l}</span>${x || ""}</a>`).join("")).join("")}</nav>
    <div class="foot">${tl("Demo data — simulated telemetry. No hardware is connected.")}</div>`;
}
export function renderTop(title, crumb) {
  const u = user(S.session.userId), unread = scoped(S.notifications).filter(n => !n.read).length;
  $("#top").innerHTML = `<button class="menu-btn" id="mb" aria-label="${esc(tl("Open menu"))}">☰</button><div><div class="crumb">${crumb || esc(byId(S.orgs, S.orgId).name)}</div><h1>${esc(title)}</h1></div><span class="sp"></span>
   <div class="clock" title="${esc(tl("Simulated clock (WIB)"))}"><span class="num" id="clk">${DOW[wib(S.now).getUTCDay()]} ${fmtDate(S.now)}, ${fmtTime(S.now)} WIB</span><span class="demo">${tl("Demo data")}</span>
   <button id="b-pause" class="${S.paused ? "on" : ""}" aria-label="${esc(tl("Pause simulation"))}">❚❚</button><button id="b-play" class="${!S.paused && S.speed === 1 ? "on" : ""}" aria-label="${esc(tl("Real time"))}">1×</button><button id="b-ff" class="${!S.paused && S.speed > 1 ? "on" : ""}" aria-label="${esc(tl("Fast forward"))}">10×</button><button id="b-lab">${tl("Scenarios")}</button></div>
   ${langSel()}
   <button class="btn sm" id="b-bell" aria-label="${esc(tl("Notifications"))}">🔔 ${unread ? `<b class="num">${unread}</b>` : ""}</button>
   <div class="who"><span class="lbl muted">${tl("Signed in as")}</span><b>${esc(u.name)}</b><span class="pill plain off">${esc(tlx(ROLES[u.role].label))}</span><button class="btn sm" id="b-out">${tl("Switch user")}</button></div>`;
  $("#mb").onclick = () => $("#side").classList.toggle("open");
  const cur = location.hash.slice(2).split("/")[0] || "overview";
  $("#bnav").innerHTML = [["overview", tl("Overview"), "overview"], ["map", tl("Map"), "map"], ["alerts", tl("Alerts"), "alerts"], ["pumps", tl("Pumps"), "pumps"]].map(([h, l, i]) => `<a href="#/${h}" class="${cur === h || (cur === "pump" && h === "pumps") ? "on" : ""}">${svgI(i)}<span>${esc(l)}</span></a>`).join("") + `<button id="b-more" aria-label="${esc(tl("More"))}">${svgI("menu")}<span>${tl("More")}</span></button>`;
  $("#b-more").onclick = () => $("#side").classList.toggle("open");
  $("#b-pause").onclick = () => { S.paused = true; renderTop(title, crumb); };
  $("#b-play").onclick = () => { S.paused = false; S.speed = 1; renderTop(title, crumb); };
  $("#b-ff").onclick = () => { S.paused = false; S.speed = 10; renderTop(title, crumb); };
  $("#b-lab").onclick = DRAWER.lab;
  $("#b-bell").onclick = DRAWER.bell; bindLang();
  $("#b-out").onclick = () => { audit(S.session.userId, "Logout", null, null, ""); S.session = null; renderLogin(); };
}
export function updateClock() { const c = $("#clk"); if (c) c.textContent = `${DOW[wib(S.now).getUTCDay()]} ${fmtDate(S.now)}, ${fmtTime(S.now)} WIB`; }

/* ---------- auth (demo sign-in) ---------- */
export function renderLogin() {
  document.body.innerHTML = `<div class="login"><div class="l"><img src="${LOGO}" alt="LZIS Assalaam"><h1>${tl("Know which pumps need you today.")}</h1><p>${tl("SolPump watches every solar pump, well and tank, and tells you in plain words what's wrong and what to do about it.")}</p></div>
  <div class="r"><div class="login-lang">${langSel()}</div><h2>${tl("Sign in")}</h2><p class="muted small">${tl("Demo accounts — each role sees a different slice of the system. In production this is email + password or SSO with per-organization accounts.")}</p>
  ${S.users.map(u => `<button class="acct" data-u="${u.id}"><span class="av">${u.name.split(" ").map(x => x[0]).join("")}</span><span><b>${esc(u.name)}</b><br><span class="small muted">${esc(tlx(ROLES[u.role].label))} · ${esc(byId(S.orgs, u.org).name)}${u.scope ? " · " + tl("Site A only") : ""}</span></span></button>`).join("")}
  <div id="toasts" class="toasts"></div></div></div>`;
  document.querySelectorAll(".acct").forEach(b => b.onclick = () => login(b.dataset.u)); bindLang();
}
export function login(uid_) {
  const u = user(uid_); S.session = { userId: u.id, role: u.role }; S.orgId = u.org;
  audit(u.id, "Login", null, null, ROLES[u.role].label);
  document.body.innerHTML = `<div class="app"><aside class="side" id="side"></aside><div class="main"><header class="top" id="top"></header><main class="view" id="view" tabindex="-1"></main></div></div><nav class="bnav" id="bnav" aria-label="Main"></nav><div id="modal"></div><div class="toasts" id="toasts"></div><div id="drawer"></div>`;
  if (location.hash.length < 3 || location.hash === "#/") location.hash = u.role === "tech" ? "#/maintenance" : "#/overview";
  renderAll();
}

/* ---------- router ---------- */
export let VIEW = { live: true };
export const ROUTES = {};
let PREVR = null;
// horizontal scrollers inside the view: keep their position across live re-renders, and hold live ticks while one is being scrolled
const HSC = ".tw,.tabs,pre.code";
let HSAT = 0;
document.addEventListener("scroll", e => { if (e.target instanceof Element && e.target.matches(HSC)) HSAT = Date.now(); }, true);
export const hScrolling = () => Date.now() - HSAT < 1500;
export function renderAll(keepScroll) {
  if (!S.session) return;
  const v = $("#view"); const sc = v ? v.scrollTop : 0;
  const hx = keepScroll && v ? [...v.querySelectorAll(HSC)].map(e => e.scrollLeft) : [];
  const [r, a, b] = location.hash.slice(2).split("/");
  const fn = ROUTES[r] || ROUTES.overview;
  renderShell();
  const out = fn(a, b) || {};
  VIEW = { live: out.live !== false, r };
  renderTop(out.title || "", out.crumb);
  if (out.after) out.after();
  if (keepScroll && v) { v.scrollTop = sc; $("#view").querySelectorAll(HSC).forEach((e, i) => { if (hx[i]) e.scrollLeft = hx[i]; }); }
  if (VT) { const ph = $("#view .phead"); if (ph) ph.style.viewTransitionName = "pump-hero"; }
  const nv = $("#view"); if (nv && VIEW.r !== PREVR && !VT) { nv.classList.remove("route-in"); void nv.offsetWidth; nv.classList.add("route-in"); } PREVR = VIEW.r;
  settle(nv || document);
}
const closeSide = () => $("#side")?.classList.remove("open");
document.addEventListener("click", e => { const a = e.target.closest('.pcard a[href^="#/pump/"]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button || !canVT()) return; e.preventDefault(); navTo(a.getAttribute("href"), a); });
window.addEventListener("hashchange", () => { closeSide(); renderAll(); $("#view")?.scrollTo(0, 0); });
document.addEventListener("click", e => { const s = $("#side"); if (!s?.classList.contains("open")) return; if (e.target.closest("#side a")) return closeSide(); if (s.contains(e.target) || e.target.closest("#mb")) return; e.preventDefault(); e.stopPropagation(); closeSide(); }, true);
export function setView(html) { $("#view").innerHTML = html; }

/* ---------- OVERVIEW ---------- */
export function attentionItems() {
  const items = [];
  for (const p of myPumps()) {
    const st = statusM(p);
    for (const d of diagM(p)) { if (d.sev === "info") continue; items.push({ p, sev: d.sev, c: d.sev === "critical" ? "crit" : st.c === "off" ? "off" : "warn", t: tlx(d.summary).split(/(?<=\.)\s/)[0], act: tlx(d.action).split(/(?<=\.)\s/)[0], key: d.key }); }
  }
  const rank = { crit: 0, off: 1, warn: 2 };
  return items.sort((a, b) => rank[a.c] - rank[b.c]);
}
export function fleetKpis(ps) {
  const sts = ps.map(statusM);
  const water = ps.reduce((s, p) => s + today(p).water, 0), pv = ps.reduce((s, p) => s + today(p).pv, 0), pe = ps.reduce((s, p) => s + today(p).pump, 0);
  let tot = 0, bad = 0; const d0 = dk(S.now);
  for (const p of ps) { for (const x of TS[p.id]) { if (dk(x.t) !== d0 || lh(x.t) < 6) continue; tot += x.dt; if (x.s === "faulted") bad += x.dt; } const off = (S.now - dev(p).lastHeartbeat) / MIN; if (off > 15) { const m = Math.min(off, (lh(S.now) - 6) * 60); tot += m; bad += m; } }
  return { sites: new Set(ps.map(p => p.site)).size, pumps: ps.length, running: sts.filter(s => s.c !== "off" && s.pump === "running").length, stopped: sts.filter(s => s.c !== "off" && s.pump === "stopped").length, faulted: sts.filter(s => s.c !== "off" && s.pump === "faulted").length, offline: sts.filter(s => s.c === "off").length, water, pv, pe, avail: tot ? (1 - bad / tot) * 100 : 100, crit: scoped(S.alarms).filter(a => a.state === "active" && a.sev === "critical").length };
}
export function fleetRow(p) {
  const st = statusM(p), pt = last(p.id), m = pt?.m || {}, h = healthM(p), t = today(p), off = st.c === "off";
  const val = (k, d, u) => !has(p, k) ? nos() : off ? `<span class="na">${fmtN(m[k], d)} ${u} ${tl("(stale)")}</span>` : `<span class="num">${fmtN(m[k], d)}</span> <span class="na">${u}</span>`;
  return `<tr class="click" data-p="${p.id}"><td><b>${esc(p.short)}</b><div class="na">${esc(site(p.site).name.split(" — ")[0])}</div></td>
   <td>${stCell(st)}<div class="na" style="max-width:30ch;white-space:normal">${esc(tlx(off ? st.detail : st.c !== "ok" && st.alarms[0] ? st.alarms[0].title : (st.detail || "").replace(/\.$/, "")))}</div></td>
   <td class="r" data-l="${esc(tl("Flow"))}">${val("flow_lpm", 1, "L/min")}</td><td class="r opt">${val("pump_power", 0, "W")}</td><td class="r opt">${val("pv_power", 0, "W")}</td><td class="r opt">${val("well_level_m", 1, "m")}</td>
   <td class="r" data-l="${esc(tl("Water today"))}"><span class="num">${fmtN(t.water, 1)}</span> <span class="na">m³</span></td><td class="r opt num">${fmtDur(t.run)}</td><td data-l="${esc(tl("Health"))}">${hbar(h.score)}</td>
   <td class="opt"><span class="${(S.now - (pt?.t || 0)) > 15 * MIN ? "" : "muted"}">${fmtAgo(pt?.t)}</span><div class="na">${tl("IoT: {s}", { s: tlx(st.iot.t).toLowerCase() })}</div></td></tr>`;
}
let VID = 0;
const chipI = (c, t) => `<span class="chip ${c}"><svg viewBox="0 0 24 24" aria-hidden="true">${IC[c === "ok" ? "check" : c === "off" ? "off" : "warn"]}</svg>${esc(t)}</span>`;
export const tankSvg = (pct, low, key) => { const id = "tv" + (++VID), p = clamp(pct, 0, 100), h = 132 * p / 100, y = 134 - h, ly = 134 - 132 * low / 100; return `<svg class="vs" viewBox="0 0 76 136" role="img" aria-label="${esc(tl("Tank {pct}% full", { pct: Math.round(p) }))}"><defs><clipPath id="${id}"><rect x="2" y="2" width="72" height="132" rx="18"/></clipPath></defs><rect x="2" y="2" width="72" height="132" rx="18" fill="var(--waterbg)"/><g clip-path="url(#${id})" data-k="tank-${key}" data-t="tank" data-v="${p}"><rect x="2" y="${y}" width="72" height="${h}" fill="var(--water)"/><rect x="2" y="${y}" width="72" height="3" fill="#fff" opacity=".4"/></g><line x1="2" x2="74" y1="${ly}" y2="${ly}" stroke="var(--warn)" stroke-width="1.6" stroke-dasharray="4 3"/></svg>`; };
export const ringSvg = (pct, c, key) => `<svg class="rg" viewBox="0 0 44 44" role="img" aria-label="${esc(fmtN(pct, 1))}%"><circle cx="22" cy="22" r="18" fill="none" stroke="var(--line)" stroke-width="6"/><circle data-k="ring-${key}" data-t="ring" data-v="${pct}" cx="22" cy="22" r="18" fill="none" stroke="var(--${c})" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(clamp(pct, 0, 100) * 1.131).toFixed(1)} 113.1" transform="rotate(-90 22 22)"/></svg>`;
export const gaugeSvg = (v, max, c, key) => { const f = max > 0 && v != null ? clamp(v / max, 0, 1) : 0; return `<svg class="gg" viewBox="0 0 100 58" aria-hidden="true"><path d="M6 52A44 44 0 0 1 94 52" fill="none" stroke="var(--line)" stroke-width="9" stroke-linecap="round"/><path data-k="gauge-${key}" data-t="gauge" data-max="${max}" data-v="${v == null ? 0 : v}" d="M6 52A44 44 0 0 1 94 52" fill="none" stroke="var(--${c})" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(f * 138.2).toFixed(1)} 138.2"/></svg>`; };
const tankState = pct => pct < S.thresholds.tankLowPct ? ["crit", tl("Almost empty")] : pct < S.thresholds.tankLowPct + 15 ? ["warn", tl("Getting low")] : pct > S.thresholds.tankHighPct ? ["warn", tl("Almost full")] : ["ok", tl("Good")];
const pumpCard = p => {
  const st = statusM(p), pt = last(p.id), m = pt?.m || {}, h = healthM(p), t = today(p), off = st.c === "off", fl = has(p, "flow_lpm") ? m.flow_lpm : null, hc = off ? "off" : h.score >= 80 ? "ok" : h.score >= 60 ? "warn" : "crit";
  const why = tlx(off ? st.detail : st.c !== "ok" && st.alarms[0] ? st.alarms[0].title : (st.detail || "").replace(/\.$/, ""));
  return `<div class="pc ${st.c}" data-p="${p.id}" tabindex="0" role="link" aria-label="${esc(p.short)}"><div class="pch"><div class="pcn"><b>${esc(p.short)}</b><span>${esc(site(p.site).name.split(" — ")[0])} · ${esc(tlx(st.label))}</span></div>${condPill(st.c)}</div>
   <div class="pcb"><div class="gw">${gaugeSvg(fl, p.Q, off ? "off" : "brand", p.id)}<div class="gv ${off ? "stale" : ""}">${fl == null ? nos() : `<b class="num" data-k="fl-${p.id}" data-t="n" data-d="1" data-v="${fl}">${fmtN(fl, 1)}</b><span>L/min</span>`}</div><div class="gl">${off ? tl("Old reading") : tl("Water flow")}</div></div>
    <div class="pcs"><div><span class="k">${tl("Water today")}</span><b class="num"><span data-k="wt-${p.id}" data-t="n" data-d="1" data-v="${t.water}">${fmtN(t.water, 1)}</span><small>m³</small></b></div><div><span class="k">${tl("Health")}</span><div class="hbr"><i data-k="hb-${p.id}" data-t="bar" data-v="${h.score}" style="width:100%;transform:scaleX(${h.score / 100});background:var(--${hc})"></i></div><b class="num" data-k="hs-${p.id}" data-t="n" data-d="0" data-v="${h.score}">${h.score}</b></div></div></div>
   <div class="pcw">${esc(why)}</div></div>`;
};
ROUTES.overview = () => {
  const ps = myPumps(), k = fleetKpis(ps), items = attentionItems();
  const nCrit = items.filter(i => i.c === "crit").length, nP = new Set(items.map(i => i.p.id)).size;
  const sum = !items.length ? tl("All pumps are working normally.") : tl("{n} of {total} pumps need attention", { n: nP, total: ps.length }) + (nCrit ? `, <b class="hi">${nCrit === 1 ? tl("{n} issue is critical", { n: nCrit }) : tl("{n} issues are critical", { n: nCrit })}</b>` : "") + ".";
  const sites = [...new Set(ps.map(p => p.site))];
  const filt = UI.site === "all" ? ps : ps.filter(p => p.site === UI.site);
  const y = dk(S.now) - 1, tY = ps.reduce((s, p) => s + (daily(p).find(g => g.day === y)?.water || 0), 0);
  const hNow = lh(S.now), ySame = ps.reduce((s, p) => s + window_(p.id, S.now - D - hNow * H, S.now - D).reduce((a, x) => a + (x.m.flow_lpm || 0) * x.dt / 1000, 0), 0);
  const tanks = scoped(S.tanks);
  const shown = items.slice(0, 4);
  const delta = ySame > 0.5 ? (k.water >= ySame ? tl("Up {pct}% on yesterday at the same time ({prev} m³). Yesterday's total: {tot} m³.", { pct: Math.abs(Math.round((k.water / ySame - 1) * 100)), prev: fmtN(ySame, 1), tot: fmtN(tY, 1) }) : tl("Down {pct}% on yesterday at the same time ({prev} m³). Yesterday's total: {tot} m³.", { pct: Math.abs(Math.round((k.water / ySame - 1) * 100)), prev: fmtN(ySame, 1), tot: fmtN(tY, 1) })) : "";
  const kt = (ic, tone, label, val) => `<div class="kt" role="listitem"><span class="ki ${tone}">${ic.startsWith("<") ? ic : `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[ic]}</svg>`}</span><div><span class="kl">${label}</span><b class="kv2 num ${tone}">${val}</b></div></div>`;
  setView(`
  <div class="ovh">
   <section class="panel ovm" aria-labelledby="map-h"><div class="hd"><div><h2 id="map-h">${tl("Your pumps and tanks")}</h2><p class="na" style="margin:2px 0 0">${tl("Tap a pump to see how it is doing.")}</p></div><span class="sp"></span><span class="legend"><span><span class="dot" style="background:var(--ok)"></span> ${tl("healthy")}</span><span><span class="dot" style="background:var(--warn)"></span> ${tl("attention")}</span><span><span class="dot" style="background:var(--crit)"></span> ${tl("critical")}</span><span><span class="dot" style="background:var(--off)"></span> ${tl("offline")}</span></span></div>
    ${mapHtml("ov")}</section>
   <section class="panel ovw"><div class="bd"><span class="kl">${tl("Water pumped today")}</span>
     <div class="wnum"><b class="num" data-k="ov-water" data-t="n" data-d="1" data-v="${k.water}">${fmtN(k.water, 1)}</b><span>m³</span></div>
     <p class="small" style="margin:6px 0 0">${delta}</p>
     ${tanks.length ? `<h3 style="margin:20px 0 10px">${tl("Tanks")}</h3><div class="tks">${tanks.map(tk => { const p = S.pumps.find(x => x.tank === tk.id), pct = SIM[p.id]?.tankPct ?? 0, [tc, tt] = tankState(pct); return `<div class="tk">${tankSvg(pct, S.thresholds.tankLowPct, tk.id)}<div><b class="tn">${esc(tlx(tk.name))}</b><b class="num tp ${tc}"><span data-k="tkn-${tk.id}" data-t="n" data-d="0" data-v="${pct}">${fmtN(pct)}</span><small>%</small></b><span class="na">${tl("{cap} m³ capacity", { cap: tk.cap })}</span>${chipI(tc, tt)}</div></div>`; }).join("")}</div>` : ""}
   </div></section>
  </div>
  <div class="ovl">
   <section class="panel" aria-labelledby="att-h"><div class="hd"><h2 id="att-h">${tl("What needs attention")}</h2><span class="sp"></span><a href="#/alerts" class="small lk">${tl("All alerts")}</a></div>
    <div class="bd" style="padding-bottom:6px"><p class="lead-sum">${sum}</p></div>
    <div class="al2">${items.length ? shown.map(i => `<div class="ai ${i.c}" data-p="${i.p.id}" data-tab="${i.key === "maint" ? "maintenance" : "diagnostics"}" tabindex="0" role="link"><span class="ki ${i.c}"><svg viewBox="0 0 24 24" aria-hidden="true">${IC[i.c === "off" ? "off" : "warn"]}</svg></span><div class="ib"><div class="t">${esc(i.t)}</div><div class="m">${esc(i.p.short)} · ${esc(site(i.p.site).name.split(" — ")[0])}</div><div class="act">${esc(i.act)}</div></div>${pill(i.c, i.sev === "critical" ? tl("Critical") : tl("Plan this"))}</div>`).join("") + (items.length > shown.length ? `<div class="attn-f">${tl("Showing the {n} most urgent of {total} issues", { n: shown.length, total: items.length })} · <a href="#/alerts">${tl("see all alerts")}</a></div>` : "") : `<div class="bd muted">${tl("Nothing to do. We'll flag problems here the moment they appear.")}</div>`}</div>
   </section>
   <div class="kts" role="list">
    ${kt("pumps", "brand", tl("Pumps working"), `${k.running}<small>${tl("of {total}", { total: k.pumps })}</small>`)}
    ${kt("sun", "solar", tl("Solar today"), `<span data-k="ov-pv" data-t="n" data-d="1" data-v="${k.pv}">${fmtN(k.pv, 1)}</span><small>kWh</small>`)}
    ${kt(ringSvg(k.avail, k.avail < 90 ? "warn" : "ok", "avail"), "ring", tl("Pumps ready today"), `<span class="${k.avail < 90 ? "warn" : "ok"}"><span data-k="ov-av" data-t="n" data-d="1" data-v="${k.avail}">${fmtN(k.avail, 1)}</span><small>%</small></span>`)}
    ${kt("check", k.crit ? "crit" : "ok", tl("Critical alerts"), String(k.crit))}
   </div>
  </div>
  <section class="pcs-wrap"><div class="row" style="margin:0 0 12px;gap:14px"><h2 style="font-size:20px">${tl("Pumps")}</h2><span class="sp" style="flex:1"></span>
   <div class="seg" role="group" aria-label="${esc(tl("Filter by site"))}"><button data-site="all" class="${UI.site === "all" ? "on" : ""}">${tl("All sites")}</button>${sites.map(s => `<button data-site="${s}" class="${UI.site === s ? "on" : ""}">${esc(site(s).name.split(" — ")[0])}</button>`).join("")}</div></div>
   <div class="pgrid2">${filt.length ? filt.map(pumpCard).join("") : `<div class="muted">${tl("No pumps visible to you yet.")}</div>`}</div></section>`);
  return { title: tl("Fleet overview"), after() { bindRows(); mountMap("ov", ps, filt.length ? filt : ps); document.querySelectorAll("[data-site]").forEach(b => b.onclick = () => { UI.site = b.dataset.site; refitMap("ov"); renderAll(true); }); } };
};
export function bindRows() { document.querySelectorAll("[data-p]").forEach(r => { const f = () => navTo(`#/pump/${r.dataset.p}${r.dataset.tab ? "/" + r.dataset.tab : ""}`, r); r.onclick = f; r.onkeydown = e => { if (e.key === "Enter") f(); }; }); }

/* ---------- MAP: Leaflet over OpenStreetMap tiles; markers are divIcons in our own style ----------
   L is a global (main.js / build.sh), like LOGO. One map per page kind ("ov" overview, "pg" map page) lives on across
   renders: the saved container is swapped back in for the placeholder, so zoom, pan and open popups survive live ticks. */
export const MAPV = { site: "all" };
const LM = {}, WORST = ["crit", "off", "warn", "ok"], TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const llb = ps => L.latLngBounds(ps.map(p => [p.lat, p.lng]));
const fitTo = (map, ps, anim) => { const b = llb(ps); if (map.getSize().x) return map.fitBounds(b, { padding: [56, 56], maxZoom: 17, animate: anim });
  const a = map.project(b.getNorthWest(), 0), c = map.project(b.getSouthEast(), 0); map.setView(b.getCenter(), clamp(Math.floor(Math.log2(Math.min(700 / Math.max(c.x - a.x, 1e-9), 400 / Math.max(c.y - a.y, 1e-9)))), 3, 17)); }; // unlaid-out container (jsdom, hidden): assume ~800x500
const popHtml = p => { const st = statusM(p), m = last(p.id)?.m || {}, h = healthM(p); return `<div class="row" style="justify-content:space-between;gap:10px"><b>${esc(p.short)}</b>${stCell(st)}</div><p class="small muted" style="margin:4px 0 8px">${esc(tlx(st.detail))}</p><dl class="kv small"><dt>${tl("Flow")}</dt><dd>${has(p, "flow_lpm") ? fmtN(m.flow_lpm, 1) + " L/min" : "—"}</dd><dt>${tl("Water today")}</dt><dd>${fmtN(today(p).water, 1)} m³</dd><dt>${tl("Health")}</dt><dd>${h.score}/100${h.reasons[0] ? " — " + esc(tlx(h.reasons[0].txt)) : ""}</dd></dl><div class="row" style="margin-top:10px"><button class="btn sm pri" data-go="#/pump/${p.id}">${tl("Open pump")}</button></div>`; };
export const refitMap = kind => { if (LM[kind]) LM[kind].fk = ""; }; // next mount re-fits even if the site is unchanged
export const mapHtml = kind => `<div class="map lmap ${kind}" id="map" role="region" aria-label="${esc(tl("Map of pumps"))}"></div>`;
export function mountMap(kind, ps, fit) {
  const ph = $("#map"); if (!ph || !ps.length) return;
  let m = LM[kind]; if (m && m.lang !== I18N.lang) { m.map.remove(); m = LM[kind] = null; }
  if (m) { ph.replaceWith(m.el); m.map.invalidateSize(false); }
  else {
    const map = L.map(ph, { scrollWheelZoom: kind === "pg", dragging: kind === "pg" || !L.Browser.mobile, zoomSnap: .5, maxZoom: 19 });
    L.tileLayer(TILES, { maxZoom: 19, attribution: `© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> ${tl("contributors")}` }).addTo(map);
    if (kind === "pg") L.control.scale({ imperial: false }).addTo(map);
    else { map.on("click focus", () => map.scrollWheelZoom.enable()); ph.addEventListener("mouseleave", () => map.scrollWheelZoom.disable()); } // overview: wheel zooms only once the map is clicked, so page scroll isn't hijacked
    const Fit = L.Control.extend({ options: { position: "topleft" }, onAdd() { const b = L.DomUtil.create("button", "lfit"); b.type = "button"; b.title = tl("Show all pumps"); b.setAttribute("aria-label", b.title); b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`; L.DomEvent.disableClickPropagation(b); b.onclick = () => fitTo(map, LM[kind].ps, true); return b; } });
    new Fit().addTo(map);
    ph.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); }, true); // capture: Leaflet stops clicks inside popups from bubbling
    m = LM[kind] = { map, el: ph, on: {}, ln: L.layerGroup().addTo(map), fk: null, lang: I18N.lang };
    map.on("zoomend", () => drawMap(kind));
  }
  m.ps = ps; const fk = fit.map(p => p.id).join();
  if (m.fk !== fk) { fitTo(m.map, fit.length ? fit : ps, m.fk !== null); m.fk = fk; }
  drawMap(kind);
}
function drawMap(kind) {
  const m = LM[kind], { map, ps } = m, z = map.getZoom(), pg = kind === "pg", want = {}, lines = [];
  const add = (k, ll, html, o = {}) => { want[k] = { ll, html, ...o }; };
  // greedy screen-space grouping: pumps (and groups) closer than CLD px merge into one count marker, whatever their site
  const CLD = 64, gs = []; for (const p of ps) { const q = map.project([p.lat, p.lng], z), g = gs.find(g => Math.hypot(g.x - q.x, g.y - q.y) < CLD); if (g) { g.m.push({ p, q }); g.x = g.m.reduce((a, b) => a + b.q.x, 0) / g.m.length; g.y = g.m.reduce((a, b) => a + b.q.y, 0) / g.m.length; } else gs.push({ m: [{ p, q }], x: q.x, y: q.y }); }
  for (let i = 0; i < gs.length; i++) for (let j = gs.length - 1; j > i; j--) if (Math.hypot(gs[i].x - gs[j].x, gs[i].y - gs[j].y) < CLD) { gs[i].m.push(...gs.splice(j, 1)[0].m); gs[i].x = gs[i].m.reduce((a, b) => a + b.q.x, 0) / gs[i].m.length; gs[i].y = gs[i].m.reduce((a, b) => a + b.q.y, 0) / gs[i].m.length; }
  const solo = [];
  for (const g of gs) {
    if (g.m.length === 1) { solo.push(g.m[0]); continue; }
    const sp = g.m.map(e => e.p), sids = [...new Set(sp.map(p => p.site))], nm = sids.map(x => site(x).name.split(" — ")[0]).join(" · "), sts = sp.map(p => statusM(p).c), w = WORST.find(c => sts.includes(c));
    add("cl:" + sp.map(p => p.id).sort().join(), map.unproject(L.point(g.x, g.y), z), `<div class="pcl ${w}" data-cl="${sids.join()}"><i>${sp.length}</i><b>${esc(nm)}</b></div>`, { title: tl("{site}: {n} pumps. Zoom in", { site: sids.length > 1 ? nm : site(sids[0]).name, n: sp.length }), sp });
  }
  for (const { p } of solo) { const st = statusM(p); add("mk:" + p.id, [p.lat, p.lng], `<div class="pm ${st.c}" data-mk="${p.id}"><i></i><b>${esc(p.short)}</b></div>`, { title: `${p.short}: ${tlx(ST_TXT[st.c])}`, p }); }
  if (pg) { const tks = {}; for (const { p, q } of solo) (tks[p.tank] = tks[p.tank] || []).push(q); for (const [tid, l] of Object.entries(tks)) {
    const tx = l.reduce((a, b) => a + b.x, 0) / l.length + 34, ty = l.reduce((a, b) => a + b.y, 0) / l.length - 38, tll = map.unproject(L.point(tx, ty), z), tk = byId(S.tanks, tid), pct = Math.round(SIM[S.pumps.find(p => p.tank === tid).id].tankPct || 0);
    add("tk:" + tid, tll, `<div class="ptk"><i><s style="height:${pct}%"></s></i><b>${pct}%</b></div>`, { title: `${tlx(tk.name)} · ${pct}%`, still: 1 });
    for (const a of l) lines.push([map.unproject(a, z), tll]); } }
  for (const [k, o] of Object.entries(m.on)) if (!want[k]) { map.removeLayer(o.l); delete m.on[k]; }
  for (const [k, w] of Object.entries(want)) {
    let o = m.on[k];
    if (!o) {
      const l = L.marker(w.ll, { icon: L.divIcon({ html: w.html, className: "lmk", iconSize: null }), title: w.title, keyboard: !w.still, interactive: !w.still, riseOnHover: true, zIndexOffset: w.still ? -100 : 0 }).addTo(map);
      if (w.p) l.bindPopup(() => popHtml(w.p), { minWidth: 240, maxWidth: 300, autoPanPadding: [24, 24] });
      if (w.sp) l.on("click", () => fitTo(map, w.sp, true));
      o = m.on[k] = { l, h: w.html };
    } else { if (o.h !== w.html) { o.l.setIcon(L.divIcon({ html: w.html, className: "lmk", iconSize: null })); o.h = w.html; } o.l.setLatLng(w.ll); o.l.options.title = w.title; }
    if (w.p && o.l.isPopupOpen()) o.l.setPopupContent(popHtml(w.p));
  }
  m.ln.clearLayers(); for (const ll of lines) L.polyline(ll, { className: "tkln", weight: 2.5, interactive: false }).addTo(m.ln);
}
ROUTES.map = () => {
  const ps = myPumps(); if (!ps.length) { setView(`<div class="panel"><div class="bd">${tl("No assets you can see yet.")}</div></div>`); return { title: tl("Map") }; }
  const sites = [...new Set(ps.map(p => p.site))]; if (!sites.includes(MAPV.site)) MAPV.site = "all";
  const fit = MAPV.site === "all" ? ps : ps.filter(p => p.site === MAPV.site);
  setView(`<section class="panel"><div class="hd"><h2>${tl("Fleet map")}</h2><span class="na">${tl("Pump positions on OpenStreetMap. Scroll or pinch to zoom, drag to move around.")}</span><span class="sp"></span><span class="legend"><span><span class="dot" style="background:var(--ok)"></span> ${tl("healthy")}</span><span><span class="dot" style="background:var(--warn)"></span> ${tl("warning")}</span><span><span class="dot" style="background:var(--crit)"></span> ${tl("critical")}</span><span><span class="dot" style="background:var(--off)"></span> ${tl("offline")}</span></span></div>
  <div class="mapbar"><div class="seg" role="group" aria-label="${esc(tl("Filter by site"))}"><button data-ms="all" class="${MAPV.site === "all" ? "on" : ""}">${tl("All sites")}</button>${sites.map(s => `<button data-ms="${s}" class="${MAPV.site === s ? "on" : ""}">${esc(site(s).name.split(" — ")[0])}</button>`).join("")}</div></div>
  ${mapHtml("pg")}</section>`);
  return {
    title: tl("Map"), live: false, after() {
      mountMap("pg", ps, fit);
      document.querySelectorAll("[data-ms]").forEach(b => b.onclick = () => { MAPV.site = b.dataset.ms; refitMap("pg"); renderAll(true); });
    },
  };
};
