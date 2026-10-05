/* ---------- modal ---------- */
import { $, ADAPTERS, BASE, D, H, REG, ROLES, S, SIM, TZ, arr, audit, byId, can, ctl, dev, dk, expFlow, expPV, fmtAgo, fmtDT, fmtDate, fmtDur, fmtN, fmtTime, has, issueCommand, last, myPumps, pump, r1, site, tank, toast, user, well, wib, window_ } from './core.js';
import { daily, hColor, perfRatio, today } from './intel.js';
import { ROUTES, UI, barChart, diagM, esc, fiveQM, go, hbar, healthM, lineChart, pill, renderAll, setView, sev, statusM, wellM } from './ui1.js';
import { bindMaint, maintTab } from './ui3.js';
export function modal({ title, body, ok = "Confirm", danger = false, onOk, cancel = "Cancel", wide }) {
  const m = $("#modal"); m.innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt" ${wide ? 'style="max-width:720px"' : ""}><div class="hd"><h2 id="mt">${esc(title)}</h2></div><div class="bd">${body}</div><div class="ft"><button class="btn" id="m-c">${cancel}</button>${onOk ? `<button class="btn ${danger ? "danger" : "pri"}" id="m-o">${esc(ok)}</button>` : ""}</div></div></div>`;
  const close = () => { m.innerHTML = ""; };
  $("#m-c").onclick = close; m.querySelector(".modal-bg").onclick = e => { if (e.target.classList.contains("modal-bg")) close(); };
  if (onOk) $("#m-o").onclick = () => { if (onOk(m) !== false) { close(); renderAll(true); } };
  setTimeout(() => (m.querySelector("textarea,input,select") || $("#m-o") || $("#m-c")).focus(), 30);
}
export const modalOpen = () => !!$("#modal")?.innerHTML;

/* ---------- PUMP DETAIL ---------- */
export function schematic(p) {
  const pt = last(p.id), m = pt?.m || {}, w = well(p), s = SIM[p.id], off = statusM(p).c === "off", tk = tank(p);
  const W = 640, Hh = 300, gY = 120, depthPx = 160 / w.depth;
  const lvl = m.well_level_m, Ly = lvl != null ? gY + lvl * depthPx : null, Py = gY + w.pumpDepth * depthPx, My = gY + w.minSafe * depthPx;
  const run = pt?.s === "running" && !off, flow = m.flow_lpm;
  const v = (k, d, u) => !has(p, k) ? "not measured" : off ? "—" : fmtN(m[k], d) + " " + u;
  const sun = m.irradiance_wm2 || 0, tkPct = m.tank_level_pct ?? 0;
  return `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Live schematic of ${esc(p.short)}">
  <rect x="0" y="${gY}" width="${W}" height="${Hh - gY}" fill="var(--paper)"/><line x1="0" x2="${W}" y1="${gY}" y2="${gY}" stroke="var(--ink3)" stroke-width="1.5"/>
  <g transform="translate(40 26)"><circle r="14" fill="var(--solar)" opacity="${sun > 5 ? 1 : .25}"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="${19 * Math.cos(a * Math.PI / 180)}" y1="${19 * Math.sin(a * Math.PI / 180)}" x2="${25 * Math.cos(a * Math.PI / 180)}" y2="${25 * Math.sin(a * Math.PI / 180)}" stroke="var(--solar)" stroke-width="2" opacity="${sun > 5 ? 1 : .25}"/>`).join("")}<text x="34" y="5" font-size="12.5" fill="var(--ink2)">${has(p, "irradiance_wm2") ? (off ? "—" : fmtN(sun) + " W/m²") : "sun not measured"}</text></g>
  <g transform="translate(30 66)"><path d="M0 44 L22 0 H112 L90 44Z" fill="var(--water)" opacity=".85"/><path d="M30 0 L8 44M52 0 L30 44M75 0 L53 44M97 0 L75 44M11 22 H101" stroke="var(--card)" stroke-width="1.2" opacity=".6"/><text x="0" y="62" font-size="12.5" fill="var(--ink3)">${arr(p).kw} kWp array</text><text x="122" y="20" font-size="15" font-weight="600" fill="var(--ink)" font-family="var(--num)">${v("pv_power", 0, "W")}</text></g>
  <path d="M120 110 C 170 110, 190 80, 236 80" stroke="var(--solar)" stroke-width="2.5" fill="none" ${run ? 'stroke-dasharray="6 5"' : ""}/>
  <g transform="translate(236 56)"><rect width="92" height="50" rx="5" fill="var(--card)" stroke="var(--ink2)" stroke-width="1.5"/><text x="46" y="20" text-anchor="middle" font-size="12" fill="var(--ink2)">Controller</text><text x="46" y="38" text-anchor="middle" font-size="13" font-weight="600" fill="${m.ctrl_temp_c > S.thresholds.overheatC ? "var(--crit)" : "var(--ink)"}" font-family="var(--num)">${v("ctrl_temp_c", 0, "°C")}</text><text x="46" y="-6" text-anchor="middle" font-size="12" fill="var(--ink3)">${s.mode === "manual" ? "Manual mode" : "Auto mode"}</text></g>
  <line x1="282" y1="106" x2="282" y2="${gY}" stroke="var(--ink2)" stroke-width="2"/>
  <rect x="262" y="${gY}" width="40" height="160" fill="var(--card)" stroke="var(--ink3)"/>
  ${Ly != null ? `<rect x="263" y="${Ly}" width="38" height="${Math.max(0, gY + 160 - Ly)}" fill="var(--water)" opacity=".28"/><line x1="256" x2="308" y1="${Ly}" y2="${Ly}" stroke="var(--water)" stroke-width="2"/><text x="250" y="${Ly + 4}" text-anchor="end" font-size="12.5" fill="var(--water)" font-family="var(--num)">${off ? "—" : fmtN(lvl, 1) + " m"}</text>` : `<text x="250" y="${gY + 60}" text-anchor="end" font-size="12" fill="var(--ink3)">level not measured</text>`}
  <line x1="256" x2="308" y1="${My}" y2="${My}" stroke="var(--crit)" stroke-dasharray="4 3"/><text x="314" y="${My + 4}" font-size="11.5" fill="var(--crit)">min safe ${w.minSafe} m</text>
  <line x1="282" y1="${gY}" x2="282" y2="${Py - 8}" stroke="var(--ink2)" stroke-width="1.5"/><rect x="274" y="${Py - 8}" width="16" height="22" rx="3" fill="${run ? "var(--ok)" : pt?.s === "faulted" && !off ? "var(--crit)" : "var(--off)"}"/><text x="314" y="${Py + 7}" font-size="11.5" fill="var(--ink3)">pump at ${w.pumpDepth} m</text>
  <text x="314" y="${gY + 16}" font-size="11.5" fill="var(--ink3)">${w.name}, ${w.depth} m deep</text>
  <path d="M282 ${gY} V 96 M282 96 H 330" stroke="none"/>
  <path d="M296 ${gY - 4} H 520 V 92" stroke="var(--water)" stroke-width="5" fill="none" stroke-opacity="${run ? .9 : .25}" ${run ? 'stroke-dasharray="10 6"' : ""}><animate attributeName="stroke-dashoffset" from="32" to="0" dur="1s" repeatCount="${run ? "indefinite" : "0"}"/></path>
  <text x="400" y="${gY - 14}" text-anchor="middle" font-size="16" font-weight="600" fill="var(--ink)" font-family="var(--num)">${v("flow_lpm", 1, "L/min")}</text>
  <text x="400" y="${gY + 18}" text-anchor="middle" font-size="12" fill="var(--ink3)">${has(p, "pressure_bar") ? (off ? "" : fmtN(m.pressure_bar, 2) + " bar · ") : ""}${byId(S.pipelines, p.pipeline).dia} mm pipe, ${byId(S.pipelines, p.pipeline).len} m</text>
  <g transform="translate(486 30)"><rect width="76" height="86" rx="4" fill="var(--card)" stroke="var(--water)" stroke-width="1.5"/><rect x="2" y="${84 - 82 * tkPct / 100}" width="72" height="${82 * tkPct / 100}" fill="var(--water)" opacity=".4"/><text x="38" y="50" text-anchor="middle" font-size="16" font-weight="600" fill="var(--ink)" font-family="var(--num)">${off ? "—" : fmtN(tkPct) + "%"}</text><text x="38" y="102" text-anchor="middle" font-size="12" fill="var(--ink3)">${esc(tk.name)}</text></g>
  </svg>`;
}
export function rangeBounds() {
  const map = { "1h": H, "6h": 6 * H, "24h": D, "7d": 7 * D, "30d": 30 * D };
  if (UI.range === "custom" && UI.from) return [UI.from, Math.min(UI.to || S.now, S.now)];
  return [S.now - map[UI.range], S.now];
}
export function pumpCharts(p) {
  const [from, to] = rangeBounds(), pts = window_(p.id, from, to), w = well(p);
  const box = (t, sub, html) => `<div class="chbox"><h4>${t}<span>${sub}</span></h4>${html}</div>`;
  const ns = (k, t) => `<div class="chbox"><h4>${t}</h4><div class="nosensor">No ${t.toLowerCase()} sensor on this pump — this chart appears when one is added to the device's sensor map.</div></div>`;
  const out = [];
  out.push(box("Flow", "actual vs expected for the power available", lineChart({ from, to, pts, unit: "L/min", yMin: 0, series: [{ label: "Actual", color: "var(--water)", get: x => x.m.flow_lpm, area: true }, { label: "Expected", color: "var(--ink3)", dash: 1, get: x => x.s === "running" ? expFlow(p, x.m.pump_power) : null }] }) + `<div class="legend"><span><i style="background:var(--water)"></i>Actual</span><span><i style="background:var(--ink3)"></i>Expected (baseline)</span></div>`));
  out.push(has(p, "pv_power") ? box("Solar power", "PV output vs what the measured sunlight should give", lineChart({ from, to, pts, unit: "W", yMin: 0, series: [{ label: "PV power", color: "var(--solar)", get: x => x.m.pv_power, area: true }, ...(has(p, "irradiance_wm2") ? [{ label: "Expected", color: "var(--ink3)", dash: 1, get: x => expPV(p, x.m.irradiance_wm2) }] : [])] })) : ns("pv_power", "Solar power"));
  out.push(box("Pump power", `rated ${fmtN(p.P)} W`, lineChart({ from, to, pts, unit: "W", yMin: 0, series: [{ label: "Pump power", color: "var(--power)", get: x => x.m.pump_power }] })));
  out.push(has(p, "well_level_m") ? box("Well water level", "metres below ground — lower on chart is deeper", lineChart({ from, to, pts, unit: "m", invert: true, yMin: Math.min(...pts.map(x => x.m.well_level_m ?? 99), w.static) - 1, yMax: Math.max(w.minSafe + 1, ...pts.map(x => x.m.well_level_m ?? 0)), series: [{ label: "Water level", color: "var(--well)", get: x => x.m.well_level_m }, { label: "Minimum safe", color: "var(--crit)", dash: 1, w: 1.2, get: x => w.minSafe }] })) : ns("well_level_m", "Well level"));
  out.push(has(p, "pressure_bar") ? box("Discharge pressure", `normal ≈ ${p.expPressure} bar at rated flow`, lineChart({ from, to, pts, unit: "bar", yMin: 0, series: [{ label: "Pressure", color: "var(--press)", get: x => x.m.pressure_bar }] })) : ns("pressure_bar", "Pressure"));
  out.push(box("Temperatures", "controller" + (has(p, "motor_temp_c") ? " and motor" : ""), lineChart({ from, to, pts, unit: "°C", series: [{ label: "Controller", color: "var(--crit)", get: x => x.m.ctrl_temp_c }, ...(has(p, "motor_temp_c") ? [{ label: "Motor", color: "var(--power)", get: x => x.m.motor_temp_c }] : [])] })));
  const ds = daily(p).slice(-(UI.range === "30d" ? 30 : 14));
  out.push(box("Daily water production", "m³ per day", barChart({ items: ds.map(g => ({ l: fmtDate(g.day * D - TZ + 12 * H).split(" ")[0], v: g.water, dim: g.day === dk(S.now) })), unit: "m³", label: "Daily water" })));
  out.push(box("Daily runtime", "hours pumping per day", barChart({ items: ds.map(g => ({ l: fmtDate(g.day * D - TZ + 12 * H).split(" ")[0], v: g.run / 60, dim: g.day === dk(S.now), c: "var(--brand)" })), unit: "h", label: "Daily runtime" })));
  return `<div class="row" style="margin-bottom:12px"><div class="seg" role="group" aria-label="Time range">${["1h", "6h", "24h", "7d", "30d", "custom"].map(r => `<button data-rg="${r}" class="${UI.range === r ? "on" : ""}">${r === "custom" ? "Custom" : r.replace("h", " h").replace("d", " days")}</button>`).join("")}</div>
   ${UI.range === "custom" ? `<label class="small">From <input type="datetime-local" id="cf" value="${toLocalInput(UI.from || S.now - 3 * D)}"></label><label class="small">To <input type="datetime-local" id="ct" value="${toLocalInput(UI.to || S.now)}"></label><button class="btn sm" id="capply">Apply</button>` : ""}
   <span class="na">${pts.length} readings · hover a chart for values</span></div><div class="chgrid">${out.join("")}</div>`;
}
export const toLocalInput = t => { const d = wib(t); return d.toISOString().slice(0, 16); };
export const fromLocalInput = v => Date.parse(v + ":00Z") - TZ;

export function diagCard(d) {
  const c = d.sev === "critical" ? "var(--crit)" : d.sev === "warning" ? "var(--warn)" : "var(--off)";
  return `<article class="diag" style="--c:${c}"><div class="row">${sev(d.sev)}<span class="dt">${esc(d.title)}</span></div><p class="ds">${esc(d.summary)}</p>
   <dl>${d.likely !== "—" ? `<dt>Likely cause</dt><dd>${esc(d.likely)}</dd>` : ""}${d.possible.length ? `<dt>Possible causes</dt><dd>${esc(d.possible.join(" · "))}</dd>` : ""}<dt>Evidence</dt><dd><ul>${d.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul></dd><dt>What to do</dt><dd><b>${esc(d.action)}</b></dd></dl>
   ${Object.keys(d.tech).length ? `<details><summary>Technical details</summary><pre>${esc(JSON.stringify(d.tech, null, 2))}</pre></details>` : ""}</article>`;
}
ROUTES.pump = (id, tab) => {
  const p = pump(id); if (!p || !myPumps().includes(p)) { setView(`<div class="panel"><div class="bd">This pump doesn't exist or isn't in your organization.</div></div>`); return { title: "Not found" }; }
  tab = tab || UI.tab[id] || "overview"; UI.tab[id] = tab;
  const st = statusM(p), h = healthM(p), pt = last(p.id), m = pt?.m || {}, s = SIM[p.id], q = fiveQM(p), dg = diagM(p), off = st.c === "off";
  const tabs = [["overview", "Live"], ["charts", "Charts"], ["diagnostics", `Diagnostics${dg.filter(x => x.sev !== "info").length ? " (" + dg.filter(x => x.sev !== "info").length + ")" : ""}`], ["well", "Well"], ["control", "Control"], ["maintenance", "Maintenance"], ["twin", "Digital twin"]];
  let body = "";
  if (tab === "overview") {
    const exp = pt?.s === "running" ? expFlow(p, m.pump_power) : null;
    const met = (l, k, d, u, e) => `<div class="metric"><div class="l">${l}</div>${!has(p, k) && k ? `<div class="v na" style="font-size:14px;font-weight:400;padding:5px 0">No sensor installed</div>` : `<div class="v">${off ? "—" : fmtN(k ? m[k] : e.v, d)}<small>${u}</small></div>`}<div class="e">${e?.t || ""}</div></div>`;
    const t = today(p);
    body = `<div class="grid g-main"><div class="stack"><section class="panel"><div class="hd"><h2>Live</h2><span class="sp"></span><span class="na">${off ? "Showing last known values" : "Updated " + fmtAgo(pt?.t)}</span></div><div class="bd flush">${schematic(p)}</div>
     <div class="metrics" style="border-top:1px solid var(--line2)">
      ${met("Flow", "flow_lpm", 1, "L/min", { t: exp ? `expected ${r1(exp)} (${Math.round((m.flow_lpm / exp - 1) * 100) > 0 ? "+" : ""}${Math.round((m.flow_lpm / exp - 1) * 100)}%)` : "pump not running" })}
      ${met("PV power", "pv_power", 0, "W", { t: `${arr(p).kw} kWp array` })}
      ${met("Pump power", "pump_power", 0, "W", { t: `${has(p, "pump_current") && !off ? fmtN(m.pump_current, 2) + " A at " + fmtN(m.pump_voltage) + " V" : ""}` })}
      ${met("Well level", "well_level_m", 1, "m", { t: `below ground · min safe ${well(p).minSafe} m` })}
      ${met("Pressure", "pressure_bar", 2, "bar", { t: `normal ≈ ${p.expPressure} bar` })}
      <div class="metric"><div class="l">Runtime today</div><div class="v">${fmtDur(t.run)}</div><div class="e">${fmtN(t.water, 1)} m³ · ${t.starts} ${t.starts === 1 ? "start" : "starts"}</div></div>
     </div></section></div>
     <div class="stack"><section class="panel"><div class="hd"><h2>Why it's in this state</h2></div><div class="bd"><div class="why">${esc(off ? `IoT device offline for ${fmtAgo(dev(p).lastHeartbeat).replace(" ago", "")}. ${st.detail}. The pump may be running normally — we just can't see it.` : s.reason)}</div>
      ${Object.values(s.inhibit).length ? `<p class="small" style="margin-top:8px">Active automation holds: ${Object.values(s.inhibit).map(i => esc(i.name)).join("; ")}</p>` : ""}</div></section>
     <section class="panel"><div class="hd"><h2>Health ${h.score}/100</h2><span class="sp"></span>${hbar(h.score)}</div><div class="bd">${h.reasons.length ? `<ul class="reasons">${h.reasons.map(r => `<li><b>−${r.pts}</b><span>${esc(r.txt)}</span></li>`).join("")}</ul>` : `<p class="muted">No deductions — performance, faults, well, connectivity and maintenance are all within normal range.</p>`}
      <details><summary>How the score works</summary><p class="small" style="margin-top:6px">Starts at 100. Points are taken off for: flow below baseline, rising energy per m³, dry-run trips, faults, overheating, falling performance trend, well level near minimum or dropping, unreliable or lost connectivity, and overdue maintenance. Every deduction is listed — nothing hidden.</p></details></div></section>
     <section class="panel"><div class="hd"><h2>Open alerts</h2><span class="sp"></span><a class="small" href="#/alerts">All</a></div><div class="bd flush">${st.alarms.length ? `<table><tbody>${st.alarms.map(a => `<tr><td>${sev(a.sev)}</td><td>${esc(a.title)}<div class="na">since ${fmtDT(a.raisedAt)}${a.occurrences > 1 ? " · " + a.occurrences + "×" : ""}</div></td><td class="r">${a.state === "active" && can("ack") ? `<button class="btn sm" data-ack="${a.id}">Acknowledge</button>` : a.state === "acknowledged" ? '<span class="na">acknowledged</span>' : ""}</td></tr>`).join("")}</tbody></table>` : `<div class="bd muted">No open alerts.</div>`}</div></section></div></div>`;
  } else if (tab === "charts") body = `<section class="panel"><div class="bd">${pumpCharts(p)}</div></section>`;
  else if (tab === "diagnostics") body = `<div class="grid g-main"><section class="panel"><div class="hd"><h2>Diagnosis</h2><span class="sp"></span><span class="na">Rule-based. Causes are ranked by evidence, never stated as certain.</span></div><div class="bd">${dg.length ? dg.map(diagCard).join("") : `<p class="muted">No issues found. We compare flow with what the solar power should deliver, solar output with the measured sunlight, well behaviour with its history, and temperatures and faults with their limits.</p>`}</div></section>
     <section class="panel"><div class="hd"><h2>Baseline</h2></div><div class="bd"><p class="small">Expected flow is the pump's performance curve scaled to how this pump actually performed in its first week of monitoring (${fmtDate(BASE[p.id].from)}–${fmtDate(BASE[p.id].to)}, ${BASE[p.id].n} running samples).</p>
      <dl class="kv"><dt>Calibration factor</dt><dd class="num">${BASE[p.id].k.toFixed(3)}</dd><dt>Solar yield factor</dt><dd class="num">${BASE[p.id].pv ? BASE[p.id].pv.toFixed(3) : "no sunlight sensor"}</dd><dt>Performance (2 days)</dt><dd class="num">${perfRatio(p, 2) ? Math.round(perfRatio(p, 2) * 100) + "% of expected" : "—"}</dd><dt>Performance (30 days)</dt><dd class="num">${perfRatio(p, 30) ? Math.round(perfRatio(p, 30) * 100) + "% of expected" : "—"}</dd></dl>
      <h3 style="margin:14px 0 4px">Performance trend</h3>${barChart({ items: daily(p).filter(g => g.n > 3).slice(-30).map(g => ({ l: fmtDate(g.day * D - TZ + 12 * H).split(" ")[0], v: g.flowSum / g.expSum * 100, c: g.flowSum / g.expSum < 0.85 ? "var(--warn)" : "var(--ok)" })), unit: "% of expected", fmt: 0, label: "Daily performance vs baseline" })}</div></section></div>`;
  else if (tab === "well") body = wellTab(p);
  else if (tab === "control") body = controlTab(p);
  else if (tab === "maintenance") body = maintTab(p);
  else body = twinTab(p);
  setView(`<div class="phead"><div style="flex:1;min-width:260px"><div class="nm">${esc(p.name)}</div><div class="sub">${esc(site(p.site).name)} · ${esc(p.mfr)} ${esc(p.model)} · <a href="#/overview">Back to fleet</a></div></div>
   <div><div class="na">Pump</div>${pill(st.c, st.c === "off" ? "Unknown (offline)" : st.label)}</div><div><div class="na">IoT device</div>${pill(st.iot.c, st.iot.t)}</div>
   <div><div class="na">Health</div><div class="hscore"><b style="color:var(--${hColor(h.score)})">${h.score}</b><span class="muted">/100</span></div></div><div><div class="na">Last update</div><div>${fmtAgo(pt?.t)}</div></div></div>
   <div class="qs">${q.map(([qq, a]) => `<div class="q" style="--qc:var(--${a.c})"><div class="qq">${qq}</div><div class="qa"><span class="dot" style="background:var(--${a.c})"></span>${esc(a.a)}</div><div class="qd">${esc(a.d)}</div></div>`).join("")}</div>
   <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? "on" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>${body}`);
  return {
    title: p.short, crumb: `<a href="#/overview">Fleet</a> / ${esc(site(p.site).name.split(" — ")[0])}`, live: !["control", "maintenance", "twin"].includes(tab) && !(tab === "charts" && UI.range === "custom"),
    after() {
      document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => go(`#/pump/${id}/${b.dataset.tab}`));
      document.querySelectorAll("[data-rg]").forEach(b => b.onclick = () => { UI.range = b.dataset.rg; renderAll(true); });
      if ($("#capply")) $("#capply").onclick = () => { UI.from = fromLocalInput($("#cf").value); UI.to = fromLocalInput($("#ct").value); renderAll(true); };
      bindAck(); bindControl(p); bindMaint();
    },
  };
};
export function bindAck() { document.querySelectorAll("[data-ack]").forEach(b => b.onclick = e => { e.stopPropagation(); ackAlarm(b.dataset.ack); }); }
export function ackAlarm(id) { const a = byId(S.alarms, id); if (!can("ack")) return toast("Your role can't acknowledge alerts."); a.state = "acknowledged"; a.ackBy = S.session.userId; a.ackAt = S.now; audit(S.session.userId, "Alarm acknowledged", a.pump, "active", a.title); renderAll(true); }

export function wellTab(p) {
  const ws = wellM(p), w = well(p);
  if (!ws) return `<section class="panel"><div class="bd"><div class="nosensor">This pump has no well-level sensor, so well behaviour (drawdown, recovery, sustainable rate) can't be measured. Static level from the drilling log: ${w.static} m. Adding a submersible level transducer is the single most useful upgrade for well protection.</div></div></section>`;
  const ds = ws.days.slice(-30);
  return `<div class="grid g2"><section class="panel"><div class="hd"><h2>${esc(w.name)}</h2></div><div class="bd"><dl class="kv">
   <dt>Resting (static) level</dt><dd class="num">${r1(ws.static)} m <span class="na">${ws.staticTrend > 0.3 ? `${r1(ws.staticTrend)} m deeper than 30 days ago` : "stable over 30 days"}</span></dd>
   <dt>Current level</dt><dd class="num">${r1(ws.level)} m</dd><dt>Drawdown now</dt><dd class="num">${r1(Math.max(0, ws.drawdown))} m</dd>
   <dt>Deepest this week</dt><dd class="num">${r1(ws.deepest7)} m <span class="na">(${ws.margin < 0 ? "below" : r1(ws.margin) + " m above"} minimum safe ${w.minSafe} m)</span></dd>
   <dt>Overnight recovery</dt><dd class="num">${ws.rec7 ? fmtDur(ws.rec7) + " (7-day avg)" : "—"} <span class="na">${ws.recSlower != null ? (ws.recSlower > 0 ? Math.round(ws.recSlower) + "% slower" : Math.round(-ws.recSlower) + "% faster") + " than 30-day average" : ""}</span></dd>
   <dt>Sustainable rate</dt><dd class="num">${ws.sustain ? "≈ " + Math.round(ws.sustain) + " L/min" : "—"} <span class="na">keeps the level 3 m above minimum (pump rated ${p.Q} L/min)</span></dd>
   <dt>Dry-run trips (7 days)</dt><dd class="num">${ws.dry7}</dd><dt>Well depth / pump depth</dt><dd class="num">${w.depth} m / ${w.pumpDepth} m</dd></dl>
   ${ws.sustain && ws.sustain < p.Q * 0.9 ? `<p class="why" style="margin-top:12px">At full sun this pump can draw ${p.Q} L/min, but the well only sustains about ${Math.round(ws.sustain)} L/min. ${ws.dry7 ? "That's why it has been running dry." : "Watch for over-pumping."}</p>` : ""}</div></section>
   <section class="panel"><div class="hd"><h2>Resting level, 30 days</h2><span class="na">measured 05:00–06:00, before pumping</span></div><div class="bd">${lineChart({ from: S.now - 30 * D, to: S.now, pts: ds.map(g => ({ t: g.day * D - TZ + 5.5 * H, m: { v: g.static } })), unit: "m", invert: true, series: [{ label: "Static level", color: "var(--well)", w: 2.2, get: x => x.m.v }] })}
   <h3 style="margin:12px 0 4px">Overnight recovery time</h3>${barChart({ items: ds.filter(g => g.recov).map(g => ({ l: fmtDate(g.day * D - TZ + 12 * H).split(" ")[0], v: g.recov, c: "var(--well)" })), unit: "min", fmt: 0, label: "Recovery minutes" })}</div></section></div>`;
}
export function controlTab(p) {
  const s = SIM[p.id], cmds = S.commands.filter(c => c.pump === p.id), sch = S.schedules.find(x => x.pump === p.id), off = statusM(p).c === "off", allowed = can("command");
  return `<div class="grid g2"><section class="panel"><div class="hd"><h2>Remote control</h2><span class="sp"></span>${pill("plain off", s.mode === "manual" ? "Manual mode" : "Automatic mode")}</div><div class="bd">
   ${!allowed ? `<p class="banner">Your role (${ROLES[S.session.role].label}) can view controls but can't send commands.</p>` : ""}
   ${off ? `<p class="banner">The IoT device is offline. Commands will wait in a queue and expire after 30 minutes if the device doesn't reconnect. Nothing runs silently.</p>` : ""}
   <div class="row" style="margin-bottom:10px">${[["start", "Start"], ["stop", "Stop"], ["restart", "Restart / clear fault"], ["manual", "Manual mode"], ["auto", "Automatic mode"]].map(([c, l]) => `<button class="btn ${c === "stop" ? "danger" : c === "start" ? "pri" : ""}" data-cmd="${c}" ${allowed ? "" : "disabled"}>${l}</button>`).join("")}</div>
   <p class="small muted">Start overrides the schedule and tank rules but never the well-protection rule or a controller fault. Every command is authenticated, checked against your role, written to the audit log, and only marked done when the device acknowledges it.</p></div></section>
   <section class="panel"><div class="hd"><h2>Schedule</h2><span class="sp"></span><a class="small" href="#/control">Edit schedules</a></div><div class="bd"><p class="num" style="font-size:18px;font-weight:600">${sch ? sch.windows.map(w => w.join("–")).join(" and ") : "No schedule — runs whenever there's sun"}</p><p class="small">Inside these windows the pump still only runs if: the well is above its safe level, the tank isn't full, there's enough solar power, there's no active fault, and no one has stopped it manually.</p></div></section>
   <section class="panel" style="grid-column:1/-1"><div class="hd"><h2>Command history</h2></div><div class="bd flush"><div class="tw"><table><thead><tr><th>Sent</th><th>Command</th><th>By</th><th>Status</th><th>Trail</th></tr></thead><tbody>${cmds.length ? cmds.map(c => `<tr><td>${fmtDT(c.at)}</td><td><b>${c.cmd}</b>${c.reason ? `<div class="na">${esc(c.reason)}</div>` : ""}</td><td>${esc(user(c.by)?.name || c.by)}</td><td>${pill(c.status === "executed" ? "ok" : c.status === "expired" ? "crit" : "warn", c.status)}</td><td class="small">${c.log.map(l => fmtTime(l[0]) + " " + esc(l[1])).join("<br>")}</td></tr>`).join("") : `<tr><td colspan="5" class="muted">No commands sent to this pump yet.</td></tr>`}</tbody></table></div></div></section></div>`;
}
export function bindControl(p) {
  document.querySelectorAll("[data-cmd]").forEach(b => b.onclick = () => {
    const c = b.dataset.cmd, risky = ["stop", "restart", "start"].includes(c), s = SIM[p.id];
    const warn = c === "restart" && s.fault === "E-DRY" ? `<p class="banner">This pump tripped on dry-run protection. Restarting before the well recovers can damage the pump.</p>` : c === "stop" ? `<p class="small">Water supply to ${esc(tank(p).name)} (now ${fmtN(s.tankPct)}%) will stop until someone starts the pump again.</p>` : c === "start" ? `<p class="small">The pump will run whenever there's enough sun, ignoring its schedule and the tank-full rule, until you send Stop or switch to Automatic mode.</p>` : "";
    modal({ title: `${b.textContent} — ${p.short}?`, danger: c === "stop", ok: "Send " + b.textContent.toLowerCase(), body: `${warn}<label class="f">Reason (saved in the audit log)${risky ? " — required" : ""}<textarea id="rsn" placeholder="e.g. tank cleaning at Site A"></textarea></label>`, onOk: (m) => { const r = $("#rsn", m).value.trim(); if (risky && !r) { $("#rsn", m).style.borderColor = "var(--crit)"; $("#rsn", m).placeholder = "Add a reason to continue"; return false; } const cm = issueCommand(p, c, r); if (cm) toast(`Command queued: ${c} → ${p.short}. Waiting for the device to acknowledge.`); } });
  });
}
export function twinTab(p) {
  const w = well(p), d = dev(p), a = arr(p), c = ctl(p), pl = byId(S.pipelines, p.pipeline), si = site(p.site);
  const sec = (t, rows) => `<section class="panel"><div class="hd"><h3>${t}</h3></div><div class="bd"><dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v ?? "—"}</dd>`).join("")}</dl></div></section>`;
  return `<div class="grid g3">${sec("Identity", [["Asset ID", p.id], ["Name", esc(p.name)], ["Serial number", p.serial], ["Manufacturer", p.mfr], ["Model", p.model], ["Installed", p.installed]])}
  ${sec("Location", [["Site", esc(si.name)], ["Latitude", p.lat], ["Longitude", p.lng], ["Elevation", p.elev + " m"]])}
  ${sec("Pump", [["Type", p.type], ["Rated power", fmtN(p.P) + " W"], ["Rated flow", p.Q + " L/min"], ["Rated head", p.Hd + " m"], ["Rated voltage", p.V + " V"], ["Rated current", p.I + " A"], ["Nominal speed", p.rpm + " rpm"]])}
  ${sec("Well", [["Well", w.name], ["Depth", w.depth + " m"], ["Pump depth", w.pumpDepth + " m"], ["Static level (log)", w.static + " m"], ["Expected dynamic level", w.expDyn + " m"], ["Minimum safe level", w.minSafe + " m"], ["Recovery behaviour", wellM(p)?.rec30 ? "≈ " + fmtDur(wellM(p).rec30) + " overnight (30-day avg)" : "not measured"]])}
  ${sec("Solar", [["PV capacity", a.kw + " kWp"], ["Panels", a.panels + " × " + a.panelSpec], ["Tilt / azimuth", a.tilt + "° / north-facing"], ["Controller", c.model + " (fw " + c.fw + ")"], ["MPPT", c.mppt]])}
  ${sec("Hydraulics", [["Pipe", pl.dia + " mm HDPE"], ["Pipeline length", pl.len + " m"], ["Expected flow", p.Q + " L/min at full sun"], ["Expected pressure", p.expPressure + " bar"], ["Destination", esc(tank(p).name) + ", " + tank(p).cap + " m³"]])}
  ${sec("Communication", [["IoT device", d.id + " — " + esc(d.hw)], ["Network", d.net], ["SIM", d.sim], ["Protocol adapter", ADAPTERS[d.adapter].label], ["Last heartbeat", fmtAgo(d.lastHeartbeat)], ["Firmware", d.fw], ["Sensors", p.sensors.length + " of " + REG.length + " parameters"]])}
  ${sec("Maintenance", [["Last service", fmtDate(p.maint.last)], ["Next service", fmtDate(p.maint.next) + (S.now > p.maint.next ? ' <span class="pill crit">overdue</span>' : "")], ["Interval", p.maint.intervalDays + " days"], ["Warranty until", p.warranty + (Date.parse(p.warranty) < S.now ? ' <span class="pill warn">expired</span>' : "")], ["Service records", S.records.filter(r => r.pump === p.id).length]])}
  ${sec("Documents", (S.docs.filter(x => x.pump === p.id).map(x => [x.type, esc(x.name)])).concat([["", '<span class="na">Upload goes to file storage (S3-compatible) in production.</span>']]))}</div>`;
}
