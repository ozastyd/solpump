/* ============================================================
   UI layer
   ============================================================ */
import { $, D, DOW, H, MIN, ROLES, S, SIM, TS, audit, byId, can, clamp, dev, dk, fmtAgo, fmtDT, fmtDate, fmtDur, fmtN, fmtTime, has, last, lh, myPumps, pump, scoped, site, user, wib, window_ } from './core.js';
import { ST_TXT, daily, diagnose, fiveQ, hColor, health, status, today, wellStats } from './intel.js';
export const memo = (fn) => { const c = new Map(); return (p) => { const k = p.id + "@" + S.now + "#" + TS[p.id].length + "/" + S.alarms.length; if (c.size > 300) c.clear(); if (!c.has(k)) c.set(k, fn(p)); return c.get(k); }; };
export const healthM = memo(health), statusM = memo(status), diagM = memo(diagnose), fiveQM = memo(fiveQ), wellM = memo(wellStats);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const UI = { range: "24h", from: null, to: null, tab: {}, site: "all", alertTab: "open", aTab: "water", aPer: "7d", puF: "all", puSite: "all", puSort: "urg", puView: "cards", rep: "daily", repPer: "7d", menu: false };
export const DRAWER = {}; // top-bar drawers registered by ui4 (avoids ui1→ui4 cycle)
export const pill = (c, t) => `<span class="pill ${c}">${esc(t)}</span>`;
export const sev = s => `<span class="sev ${s}">${s === "critical" ? "Critical" : s === "warning" ? "Warning" : "Info"}</span>`;
export const hbar = s => `<span class="health"><b class="num" style="font-size:16px;color:var(--${hColor(s)})">${s}</b><span class="hb"><i style="width:${s}%;background:var(--${hColor(s)})"></i></span></span>`;
export const nos = (txt = "no sensor") => `<span class="na">${txt}</span>`;
export function go(h) { location.hash = h; }

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
  if (!all.length) return `<div class="nosensor">No data in this period</div>`;
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
  CH[id] = { from, to, n, B, series: series.map(s => ({ label: s.label, color: s.color })), unit, X, padL, padR, W };
  return `<div class="chart" data-ch="${id}"><svg viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(title || series.map(s => s.label).join(", "))}">${g}<line class="xh" x1="0" x2="0" y1="${padT}" y2="${h - padB}" stroke="var(--ink3)" stroke-dasharray="2 3" opacity="0"/></svg><div class="tip"></div></div>`;
}
export function barChart({ items, h = 150, unit = "", color = "var(--water)", fmt = 1, label }) {
  const W = 640, padL = 44, padB = 22, padT = 8, n = items.length; if (!n) return `<div class="nosensor">No data</div>`;
  const hi = Math.max(...items.map(i => i.v), 0.001) * 1.1; const bw = (W - padL - 10) / n;
  let g = ""; for (let j = 0; j <= 3; j++) { const v = hi * j / 3, y = h - padB - v / hi * (h - padT - padB); g += `<line x1="${padL}" x2="${W - 10}" y1="${y}" y2="${y}" stroke="var(--line2)"/><text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--ink3)" font-family="var(--num)">${fmtN(v, hi < 10 ? 1 : 0)}</text>`; }
  items.forEach((it, i) => { const bh = it.v / hi * (h - padT - padB), x = padL + i * bw + bw * 0.15; g += `<rect x="${x}" y="${h - padB - bh}" width="${bw * 0.7}" height="${Math.max(0, bh)}" rx="2" fill="${it.c || color}" opacity="${it.dim ? .45 : 1}"><title>${esc(it.l)}: ${fmtN(it.v, fmt)} ${unit}</title></rect>`; if (n <= 14 || i % Math.ceil(n / 10) === 0) g += `<text x="${x + bw * 0.35}" y="${h - 6}" text-anchor="middle" font-size="11" fill="var(--ink3)" font-family="var(--num)">${esc(it.l)}</text>`; });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label || "bar chart")}">${g}</svg></div>`;
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
  const u = user(S.session.userId), orgs = S.orgs.filter(o => S.users.some(x => x.org === o.id && x.name === u.name) || o.id === u.org);
  const c = navCounts();
  const links = [
    ["Operate", [["overview", "Fleet overview", "overview"], ["map", "Map", "map"], ["alerts", "Alerts", "alerts", c.alerts ? `<span class="cnt ${c.crit ? "" : "w"}">${c.alerts}</span>` : ""], ["incidents", "Incidents", "incidents", c.inc ? `<span class="cnt w">${c.inc}</span>` : ""], ["maintenance", S.session.role === "tech" ? "My tasks" : "Maintenance", "maint", c.maint ? `<span class="cnt w">${c.maint}</span>` : ""]]],
    ["Understand", [["analytics", "Water & wells", "analytics"], ["pumps", "Pumps", "pumps", "", "sub"], ["reports", "Reports", "reports"]]],
    ["Configure", [["control", "Automation & schedules", "control"], ["devices", "IoT devices", "devices"], ...(can("audit") ? [["audit", "Audit log", "audit"]] : []), ["settings", "Settings", "settings"], ["blueprint", "System blueprint", "blueprint"]]],
  ];
  const cur = (location.hash.slice(2).split("/")[0]) || "overview";
  $("#side").innerHTML = `<div class="logo"><img src="${LOGO}" alt="Assalaam — The Modern Boarding School for Islam"></div>
    <div class="prod"><b>SolPump Operations</b>Solar water pumping, managed remotely</div>
    <label class="sr" style="position:absolute;left:-9999px" for="orgsel">Organization</label>
    <select id="orgsel" class="orgsel" ${orgs.length < 2 ? "disabled" : ""}>${orgs.map(o => `<option value="${o.id}" ${o.id === S.orgId ? "selected" : ""}>${esc(o.name)}</option>`).join("")}</select>
    <nav class="nav">${links.map(([g, ls]) => `<div class="grp">${g}</div>` + ls.map(([h, l, i, x, sub]) => `<a href="#/${h}" class="${sub ? "sub " : ""}${cur === h || (cur === "pump" && h === "pumps") || (cur === "incident" && h === "incidents") ? "on" : ""}">${svgI(i)}<span>${l}</span>${x || ""}</a>`).join("")).join("")}</nav>
    <div class="foot">Demo data — simulated telemetry. No hardware is connected.<br>Tenant: ${esc(byId(S.orgs, S.orgId).name)}</div>`;
  $("#orgsel").onchange = e => { S.orgId = e.target.value; audit(S.session.userId, "Switched organization", null, null, S.orgId); go("#/overview"); renderAll(); };
}
export function renderTop(title, crumb) {
  const u = user(S.session.userId), unread = scoped(S.notifications).filter(n => !n.read).length;
  $("#top").innerHTML = `<button class="menu-btn" id="mb" aria-label="Open menu">☰</button><div><div class="crumb">${crumb || esc(byId(S.orgs, S.orgId).name)}</div><h1>${esc(title)}</h1></div><span class="sp"></span>
   <div class="clock" title="Simulated clock (WIB)"><span class="num" id="clk">${DOW[wib(S.now).getUTCDay()]} ${fmtDate(S.now)}, ${fmtTime(S.now)} WIB</span><span class="demo">Demo data</span>
   <button id="b-pause" class="${S.paused ? "on" : ""}" aria-label="Pause simulation">❚❚</button><button id="b-play" class="${!S.paused && S.speed === 1 ? "on" : ""}" aria-label="Real time">1×</button><button id="b-ff" class="${!S.paused && S.speed > 1 ? "on" : ""}" aria-label="Fast forward">10×</button><button id="b-lab">Scenarios</button></div>
   <button class="btn sm" id="b-bell" aria-label="Notifications">🔔 ${unread ? `<b class="num">${unread}</b>` : ""}</button>
   <div class="who"><span class="lbl muted">Signed in as</span><b>${esc(u.name)}</b><span class="pill plain off">${ROLES[u.role].label}</span><button class="btn sm" id="b-out">Switch user</button></div>`;
  $("#mb").onclick = () => $("#side").classList.toggle("open");
  $("#b-pause").onclick = () => { S.paused = true; renderTop(title, crumb); };
  $("#b-play").onclick = () => { S.paused = false; S.speed = 1; renderTop(title, crumb); };
  $("#b-ff").onclick = () => { S.paused = false; S.speed = 10; renderTop(title, crumb); };
  $("#b-lab").onclick = DRAWER.lab;
  $("#b-bell").onclick = DRAWER.bell;
  $("#b-out").onclick = () => { audit(S.session.userId, "Logout", null, null, ""); S.session = null; renderLogin(); };
}
export function updateClock() { const c = $("#clk"); if (c) c.textContent = `${DOW[wib(S.now).getUTCDay()]} ${fmtDate(S.now)}, ${fmtTime(S.now)} WIB`; }

/* ---------- auth (demo sign-in) ---------- */
export function renderLogin() {
  document.body.innerHTML = `<div class="login"><div class="l"><img src="${LOGO}" alt="Assalaam"><h1>Know which pumps need you today.</h1><p>SolPump watches every solar pump, well and tank, and tells you in plain words what's wrong and what to do about it.</p></div>
  <div class="r"><h2>Sign in</h2><p class="muted small">Demo accounts — each role sees a different slice of the system. In production this is email + password or SSO with per-organization accounts.</p>
  ${S.users.map(u => `<button class="acct" data-u="${u.id}"><span class="av">${u.name.split(" ").map(x => x[0]).join("")}</span><span><b>${esc(u.name)}</b><br><span class="small muted">${ROLES[u.role].label} · ${esc(byId(S.orgs, u.org).name)}${u.scope ? " · Site A only" : ""}</span></span></button>`).join("")}
  <div id="toasts" class="toasts"></div></div></div>`;
  document.querySelectorAll(".acct").forEach(b => b.onclick = () => login(b.dataset.u));
}
export function login(uid_) {
  const u = user(uid_); S.session = { userId: u.id, role: u.role }; S.orgId = u.org;
  audit(u.id, "Login", null, null, ROLES[u.role].label);
  document.body.innerHTML = `<div class="app"><aside class="side" id="side"></aside><div class="main"><header class="top" id="top"></header><main class="view" id="view" tabindex="-1"></main></div></div><div id="modal"></div><div class="toasts" id="toasts"></div><div id="drawer"></div>`;
  if (location.hash.length < 3 || location.hash === "#/") location.hash = u.role === "tech" ? "#/maintenance" : "#/overview";
  renderAll();
}

/* ---------- router ---------- */
export let VIEW = { live: true };
export const ROUTES = {};
export function renderAll(keepScroll) {
  if (!S.session) return;
  const v = $("#view"); const sc = v ? v.scrollTop : 0;
  const [r, a, b] = location.hash.slice(2).split("/");
  const fn = ROUTES[r] || ROUTES.overview;
  renderShell();
  const out = fn(a, b) || {};
  VIEW = { live: out.live !== false, r };
  renderTop(out.title || "", out.crumb);
  if (out.after) out.after();
  if (keepScroll && v) v.scrollTop = sc;
  $("#side").classList.remove("open");
}
window.addEventListener("hashchange", () => { renderAll(); $("#view")?.scrollTo(0, 0); });
export function setView(html) { $("#view").innerHTML = html; }

/* ---------- OVERVIEW ---------- */
export function attentionItems() {
  const items = [];
  for (const p of myPumps()) {
    const st = statusM(p);
    for (const d of diagM(p)) { if (d.sev === "info") continue; items.push({ p, sev: d.sev, c: d.sev === "critical" ? "crit" : st.c === "off" ? "off" : "warn", t: d.summary.split(/(?<=\.)\s/)[0], act: d.action.split(/(?<=\.)\s/)[0], key: d.key }); }
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
  const val = (k, d, u) => !has(p, k) ? nos() : off ? `<span class="na">${fmtN(m[k], d)} ${u} (stale)</span>` : `<span class="num">${fmtN(m[k], d)}</span> <span class="na">${u}</span>`;
  return `<tr class="click" data-p="${p.id}"><td><b>${esc(p.short)}</b><div class="na">${esc(site(p.site).name.split(" — ")[0])}</div></td>
   <td>${pill(st.c, st.c === "off" ? "Offline" : st.label)}<div class="na" style="max-width:30ch;white-space:normal">${esc(off ? st.detail : st.c !== "ok" && st.alarms[0] ? st.alarms[0].title : (st.detail || "").replace(/\.$/, ""))}</div></td>
   <td class="r">${val("flow_lpm", 1, "L/min")}</td><td class="r opt">${val("pump_power", 0, "W")}</td><td class="r opt">${val("pv_power", 0, "W")}</td><td class="r opt">${val("well_level_m", 1, "m")}</td>
   <td class="r"><span class="num">${fmtN(t.water, 1)}</span> <span class="na">m³</span></td><td class="r opt num">${fmtDur(t.run)}</td><td>${hbar(h.score)}</td>
   <td class="opt"><span class="${(S.now - (pt?.t || 0)) > 15 * MIN ? "" : "muted"}">${fmtAgo(pt?.t)}</span><div class="na">IoT: ${st.iot.t.toLowerCase()}</div></td></tr>`;
}
ROUTES.overview = () => {
  const ps = myPumps(), k = fleetKpis(ps), items = attentionItems();
  const nCrit = items.filter(i => i.c === "crit").length, nP = new Set(items.map(i => i.p.id)).size;
  const sum = !items.length ? "All pumps are working normally." : `${nP} of ${ps.length} pumps need attention${nCrit ? `, <b class="hi">${nCrit} ${nCrit === 1 ? "issue is" : "issues are"} critical</b>` : ""}.`;
  const sites = [...new Set(ps.map(p => p.site))];
  const filt = UI.site === "all" ? ps : ps.filter(p => p.site === UI.site);
  const y = dk(S.now) - 1, tY = ps.reduce((s, p) => s + (daily(p).find(g => g.day === y)?.water || 0), 0);
  const hNow = lh(S.now), ySame = ps.reduce((s, p) => s + window_(p.id, S.now - D - hNow * H, S.now - D).reduce((a, x) => a + (x.m.flow_lpm || 0) * x.dt / 1000, 0), 0);
  const tanks = scoped(S.tanks);
  const shown = items.slice(0, 7);
  const bw = ps.map(p => ({ n: p.short, v: today(p).water })).sort((a, b) => b.v - a.v), bwMax = Math.max(...bw.map(x => x.v), 1);
  const brow = (label, val, pct, c) => `<div class="brow"><div class="bt"><span>${label}</span><b class="num">${val}</b></div><div class="track"><i style="width:${clamp(pct, 0, 100)}%;background:${c}"></i></div></div>`;
  setView(`
  <div class="grid g-main" style="margin-bottom:16px">
   <section class="panel" aria-labelledby="att-h"><div class="hd"><h2 id="att-h">What needs attention</h2><span class="sp"></span><a href="#/alerts" class="small">All alerts</a></div>
    <div class="bd" style="padding-bottom:4px"><p class="lead-sum">${sum}</p></div>
    <div class="attn">${items.length ? shown.map(i => `<div class="it" data-p="${i.p.id}" data-tab="${i.key === "maint" ? "maintenance" : "diagnostics"}" tabindex="0" role="link"><span class="bar" style="background:var(--${i.c})"></span><div class="ib"><div class="t">${esc(i.t)}</div><div class="m">${esc(i.p.short)} · ${esc(site(i.p.site).name.split(" — ")[0])}${pill(i.c, i.sev === "critical" ? "Critical" : "Plan this")}</div></div><div class="act">${esc(i.act)}</div></div>`).join("") + (items.length > shown.length ? `<div class="attn-f">Showing the ${shown.length} most urgent of ${items.length} issues · <a href="#/alerts">see all alerts</a></div>` : "") : `<div class="bd muted">Nothing to do. We'll flag problems here the moment they appear.</div>`}</div>
   </section>
   <section class="panel"><div class="hd"><h2>Water today</h2><span class="sp"></span><span class="na">until ${fmtTime(S.now)}</span></div><div class="bd">
     <div class="row" style="align-items:baseline;gap:6px"><span class="num" style="font-size:40px;font-weight:600;line-height:1">${fmtN(k.water, 1)}</span><span class="muted">m³ pumped</span></div>
     <p class="small" style="margin-top:6px">${ySame > 0.5 ? `${k.water >= ySame ? "Up" : "Down"} ${Math.abs(Math.round((k.water / ySame - 1) * 100))}% on yesterday at the same time (${fmtN(ySame, 1)} m³). Yesterday's total: ${fmtN(tY, 1)} m³.` : ""}</p>
     <dl class="kv" style="margin:10px 0 0"><dt>Solar energy</dt><dd class="num">${fmtN(k.pv, 1)} kWh</dd><dt>Energy per m³</dt><dd class="num">${k.water > 0.5 ? (k.pe / k.water).toFixed(2) + " kWh/m³" : "—"}</dd><dt>Water per kWh</dt><dd class="num">${k.pe > 0.1 ? fmtN(k.water * 1000 / k.pe, 0) + " L/kWh" : "—"}</dd></dl>
     ${bw.length ? `<h3 style="margin:18px 0 0">Water by well</h3><div class="blist">${bw.map(x => brow(esc(x.n), `${fmtN(x.v, 1)} m³`, x.v / bwMax * 100, "var(--well)")).join("")}</div>` : ""}
     ${tanks.length ? `<h3 style="margin:18px 0 0">Tanks</h3><div class="blist">${tanks.map(tk => { const p = S.pumps.find(x => x.tank === tk.id); const pct = SIM[p.id]?.tankPct ?? 0; return brow(`${esc(tk.name)} <span class="na">${tk.cap} m³</span>`, `${fmtN(pct)}%`, pct, pct < S.thresholds.tankLowPct ? "var(--crit)" : "var(--water)"); }).join("")}</div>` : ""}
   </div></section>
  </div>
  <div class="kpis" role="list" style="margin-bottom:16px">
   ${[["Sites", k.sites, ""], ["Pumps", k.pumps, ""], ["Running", k.running, "ok"], ["Stopped", k.stopped, ""], ["Faulted", k.faulted, k.faulted ? "crit" : ""], ["Offline", k.offline, k.offline ? "off" : ""], ["Water today", fmtN(k.water, 1) + "<small>m³</small>", ""], ["Solar today", fmtN(k.pv, 1) + "<small>kWh</small>", ""], ["Availability today", fmtN(k.avail, 1) + "<small>%</small>", k.avail < 90 ? "warn" : ""], ["Critical alerts", k.crit, k.crit ? "crit" : "ok"]].map(([l, v, c]) => `<div class="kpi ${c}" role="listitem"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("")}
  </div>
  <section class="panel"><div class="hd"><h2>Fleet</h2><span class="sp"></span>
   <div class="seg" role="group" aria-label="Filter by site"><button data-site="all" class="${UI.site === "all" ? "on" : ""}">All sites</button>${sites.map(s => `<button data-site="${s}" class="${UI.site === s ? "on" : ""}">${esc(site(s).name.split(" — ")[0])}</button>`).join("")}</div>
   <span class="legend"><span><span class="dot" style="background:var(--ok)"></span> healthy</span><span><span class="dot" style="background:var(--warn)"></span> attention</span><span><span class="dot" style="background:var(--crit)"></span> critical</span><span><span class="dot" style="background:var(--off)"></span> offline</span></span></div>
    <div class="tw"><table class="fleet"><thead><tr><th scope="col">Asset</th><th scope="col">Status</th><th scope="col" class="r">Flow</th><th scope="col" class="r opt">Pump power</th><th scope="col" class="r opt">PV power</th><th scope="col" class="r opt">Well level</th><th scope="col" class="r">Water today</th><th scope="col" class="r opt">Runtime</th><th scope="col">Health</th><th scope="col" class="opt">Last update</th></tr></thead><tbody>${filt.length ? filt.map(fleetRow).join("") : `<tr><td colspan="10" class="muted">No pumps visible to you yet.</td></tr>`}</tbody></table></div></section>`);
  return { title: "Fleet overview", after() { bindRows(); document.querySelectorAll("[data-site]").forEach(b => b.onclick = () => { UI.site = b.dataset.site; renderAll(true); }); } };
};
export function bindRows() { document.querySelectorAll("[data-p]").forEach(r => { const f = () => go(`#/pump/${r.dataset.p}${r.dataset.tab ? "/" + r.dataset.tab : ""}`); r.onclick = f; r.onkeydown = e => { if (e.key === "Enter") f(); }; }); }

/* ---------- MAP ---------- */
ROUTES.map = () => {
  const ps = myPumps(); if (!ps.length) { setView(`<div class="panel"><div class="bd">No assets you can see yet.</div></div>`); return { title: "Map" }; }
  const lats = ps.map(p => p.lat), lngs = ps.map(p => p.lng);
  const cLat = (Math.max(...lats) + Math.min(...lats)) / 2, kx = Math.cos(cLat * Math.PI / 180);
  let x0 = Math.min(...lngs) * kx, x1 = Math.max(...lngs) * kx, y0 = Math.min(...lats), y1 = Math.max(...lats);
  const pad = Math.max(x1 - x0, y1 - y0) * 0.22 + 0.002; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  const W = 1000, Hh = Math.round(W * (y1 - y0) / (x1 - x0)); const Hm = clamp(Hh, 380, 640);
  const sx = W / (x1 - x0), sy = Hm / (y1 - y0), s_ = Math.min(sx, sy);
  const P = (lat, lng) => [(lng * kx - x0) * s_ + (W - (x1 - x0) * s_) / 2, (y1 - lat) * s_ + (Hm - (y1 - y0) * s_) / 2];
  const km = 111.32 * s_ * 1; // px per degree → px per km = s_/111.32
  const pxKm = s_ / 111.32;
  let g = `<defs><pattern id="gd" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="var(--line2)"/></pattern></defs><rect width="${W}" height="${Hm}" fill="url(#gd)"/>`;
  // a river and road (schematic context)
  g += `<path d="M-20 ${Hm * 0.78} C ${W * 0.25} ${Hm * 0.62}, ${W * 0.45} ${Hm * 0.95}, ${W + 20} ${Hm * 0.7}" stroke="var(--water)" stroke-opacity=".18" stroke-width="14" fill="none"/>`;
  g += `<path d="M ${W * 0.08} -10 L ${W * 0.52} ${Hm + 10}" stroke="var(--line)" stroke-width="6" fill="none"/>`;
  for (const sid of new Set(ps.map(p => p.site))) { const sp = ps.filter(p => p.site === sid).map(p => P(p.lat, p.lng)); const cx = sp.reduce((a, b) => a + b[0], 0) / sp.length, cy = sp.reduce((a, b) => a + b[1], 0) / sp.length; const r = Math.max(70, ...sp.map(q => Math.hypot(q[0] - cx, q[1] - cy) + 55)); g += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--brand)" fill-opacity=".05" stroke="var(--brand)" stroke-opacity=".35" stroke-dasharray="4 5"/><text x="${cx}" y="${cy - r - 8}" text-anchor="middle" font-size="14" font-weight="600" fill="var(--ink2)">${esc(site(sid).name)}</text>`; }
  const tks = {}; for (const p of ps) { const tp = P(p.lat, p.lng); (tks[p.tank] = tks[p.tank] || []).push(tp); }
  for (const [tid, l] of Object.entries(tks)) { const cx = l.reduce((a, b) => a + b[0], 0) / l.length + 30, cy = l.reduce((a, b) => a + b[1], 0) / l.length - 34; for (const q of l) g += `<line x1="${q[0]}" y1="${q[1]}" x2="${cx}" y2="${cy}" stroke="var(--water)" stroke-width="2" stroke-opacity=".5"/>`; const tk = byId(S.tanks, tid), pct = SIM[S.pumps.find(p => p.tank === tid).id].tankPct || 0; g += `<g><rect x="${cx - 13}" y="${cy - 16}" width="26" height="32" rx="3" fill="var(--card)" stroke="var(--water)" stroke-width="1.5"/><rect x="${cx - 11}" y="${cy + 14 - 28 * pct / 100}" width="22" height="${28 * pct / 100}" fill="var(--water)" opacity=".55"/><text x="${cx + 18}" y="${cy + 4}" font-size="12" fill="var(--ink2)">${esc(tk.name)} · ${Math.round(pct)}%</text></g>`; }
  for (const p of ps) { const [x, y] = P(p.lat, p.lng), st = statusM(p); g += `<g class="mk" data-mk="${p.id}" tabindex="0" role="button" aria-label="${esc(p.short)}: ${ST_TXT[st.c]}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="17" fill="var(--${st.c})" opacity=".18"/><circle cx="${x}" cy="${y}" r="10" fill="var(--${st.c})" stroke="var(--card)" stroke-width="3"/><text x="${x}" y="${y + 30}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ink)">${esc(p.short)}</text></g>`; }
  const barKm = pxKm * 1 > 200 ? 0.25 : pxKm * 0.5 > 60 ? 0.5 : 1; g += `<g transform="translate(20 ${Hm - 22})"><rect width="${pxKm * barKm}" height="5" fill="var(--ink2)"/><text y="-6" font-size="12" fill="var(--ink2)">${barKm * 1000} m</text></g><g transform="translate(${W - 34} 34)"><path d="M0 -16 L7 6 L0 1 L-7 6Z" fill="var(--ink2)"/><text y="22" text-anchor="middle" font-size="12" fill="var(--ink2)">N</text></g>`;
  setView(`<section class="panel"><div class="hd"><h2>Fleet map</h2><span class="na">Schematic site plan from asset coordinates. Satellite basemap tiles plug in here when the map provider is configured.</span><span class="sp"></span><span class="legend"><span><span class="dot" style="background:var(--ok)"></span> healthy</span><span><span class="dot" style="background:var(--warn)"></span> warning</span><span><span class="dot" style="background:var(--crit)"></span> critical</span><span><span class="dot" style="background:var(--off)"></span> offline</span></span></div>
  <div class="map" id="map"><svg viewBox="0 0 ${W} ${Hm}" role="img" aria-label="Map of pumps">${g}</svg><div id="mpop"></div></div></section>`);
  return {
    title: "Map", after() {
      const open = (id, el) => { const p = pump(id), st = statusM(p), m = last(p.id)?.m || {}, h = healthM(p), box = $("#map").getBoundingClientRect(), r = el.getBoundingClientRect(); const pop = $("#mpop"); pop.className = "mpop"; pop.style.left = clamp(r.left - box.left - 130, 6, box.width - 290) + "px"; pop.style.top = (r.bottom - box.top + 8) + "px";
        pop.innerHTML = `<div class="row" style="justify-content:space-between"><b>${esc(p.short)}</b>${pill(st.c, st.c === "off" ? "Offline" : st.label)}</div><p class="small muted" style="margin:4px 0 8px">${esc(st.c === "off" ? st.detail : st.detail)}</p><dl class="kv small"><dt>Flow</dt><dd>${has(p, "flow_lpm") ? fmtN(m.flow_lpm, 1) + " L/min" : "—"}</dd><dt>Water today</dt><dd>${fmtN(today(p).water, 1)} m³</dd><dt>Health</dt><dd>${h.score}/100${h.reasons[0] ? " — " + esc(h.reasons[0].txt) : ""}</dd></dl><div class="row" style="margin-top:10px"><button class="btn sm pri" data-go="#/pump/${p.id}">Open pump</button><button class="btn sm" data-mclose>Close</button></div>`;
        pop.querySelector("[data-go]").onclick = e => go(e.currentTarget.dataset.go);
        pop.querySelector("[data-mclose]").onclick = () => { pop.className = ""; pop.innerHTML = ""; }; };
      document.querySelectorAll("[data-mk]").forEach(m => { m.onclick = () => open(m.dataset.mk, m); m.onkeydown = e => { if (e.key === "Enter") open(m.dataset.mk, m); }; });
    }, live: false,
  };
};
