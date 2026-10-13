/* ============================================================
   Operational intelligence: daily rollups (downsampling),
   well analytics, health score, rule-based diagnostics, status.
   ============================================================ */
import { BASE, D, H, MIN, S, SIM, TS, TZ, arr, clamp, derived, dev, dk, expFlow, expPV, fmtDT, fmtDate, fmtDur, fmtN, fmtTime, has, last, lh, pad, r1, site, well, window_ } from './core.js';
import { tl, tlk, tlx } from './i18n.js';
export const AGG = {};
export function daily(p) {
  const a = TS[p.id], c = AGG[p.id];
  if (c && c.n === a.length && c.at === S.now) return c.days;
  const days = new Map(); let prevS = null;
  for (const x of a) {
    const k = dk(x.t); let g = days.get(k);
    if (!g) { g = { day: k, water: 0, pv: 0, pump: 0, run: 0, starts: 0, dry: 0, ot: 0, maxCt: null, static: null, minLvl: null, maxLvl: null, irr: 0, flowSum: 0, expSum: 0, n: 0, lastStop: null, recov: null }; days.set(k, g); }
    const m = x.m, dt = x.dt;
    g.water += (m.flow_lpm || 0) * dt / 1000; g.pv += (m.pv_power || 0) * dt / 60000; g.pump += (m.pump_power || 0) * dt / 60000; g.irr += (m.irradiance_wm2 || 0) * dt / 60000;
    if (x.s === "running") { g.run += dt; if (m.pump_power > 0.45 * p.P && !x.f) { const e = expFlow(p, m.pump_power); if (e) { g.flowSum += m.flow_lpm; g.expSum += e; g.n++; } } }
    if (x.s === "running" && prevS !== "running") g.starts++;
    if (x.f === "E-DRY" && prevS !== "faulted") g.dry++;
    if (x.f === "E-OT" && prevS !== "faulted") g.ot++;
    if (m.ctrl_temp_c != null) g.maxCt = Math.max(g.maxCt ?? -99, m.ctrl_temp_c);
    if (m.well_level_m != null) {
      const h = lh(x.t); if (h >= 5 && h < 6 && g.static == null) g.static = m.well_level_m;
      g.minLvl = Math.min(g.minLvl ?? 999, m.well_level_m); g.maxLvl = Math.max(g.maxLvl ?? -1, m.well_level_m);
    }
    prevS = x.s;
  }
  // recovery: after the last evening stop, minutes until level is within 0.5 m of the next morning's static level
  const arrD = [...days.values()];
  for (let i = 0; i < arrD.length - 1; i++) {
    const g = arrD[i], nx = arrD[i + 1]; if (nx.static == null || g.maxLvl == null) continue;
    const pts = a.filter(x => dk(x.t) === g.day && lh(x.t) > 15);
    let stopT = null; for (let j = pts.length - 1; j > 0; j--) if (pts[j - 1].s === "running" && pts[j].s !== "running") { stopT = pts[j].t; break; }
    if (!stopT) continue;
    const after = window_(p.id, stopT, stopT + 12 * H); const startLvl = after[0]?.m.well_level_m;
    const hit = after.find(x => x.m.well_level_m != null && x.m.well_level_m <= nx.static + 0.5);
    if (hit && startLvl != null) { g.recov = (hit.t - stopT) / MIN; g.drawdown = startLvl - nx.static; g.recovRate = g.drawdown / Math.max(10, g.recov) * 60; }
  }
  AGG[p.id] = { n: a.length, at: S.now, days: arrD };
  return arrD;
}
export const today = p => daily(p).find(g => g.day === dk(S.now)) || { water: 0, pv: 0, pump: 0, run: 0, starts: 0, dry: 0 };
export function sumDays(p, from, to) { return daily(p).filter(g => g.day >= from && g.day <= to).reduce((s, g) => (s.water += g.water, s.pv += g.pv, s.pump += g.pump, s.run += g.run, s.dry += g.dry, s.ot += g.ot, s), { water: 0, pv: 0, pump: 0, run: 0, dry: 0, ot: 0 }); }
export function perfRatio(p, days) { const ds = daily(p).filter(g => g.day > dk(S.now) - days && g.n > 3); const f = ds.reduce((s, g) => s + g.flowSum, 0), e = ds.reduce((s, g) => s + g.expSum, 0); return e ? f / e : null; }

export function wellStats(p) {
  if (!has(p, "well_level_m")) return null;
  const ds = daily(p).filter(g => g.static != null), w = well(p);
  if (ds.length < 3) return null;
  const now = ds[ds.length - 1], first = ds.slice(0, 5), rec = ds.filter(g => g.recov != null);
  const avg = (v) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  const rec7 = avg(rec.slice(-7).map(g => g.recov)), rec30 = avg(rec.map(g => g.recov));
  const st0 = avg(first.map(g => g.static)), stNow = avg(ds.slice(-3).map(g => g.static));
  const lvl = last(p.id)?.m.well_level_m;
  const drawdown = lvl != null && stNow != null ? lvl - stNow : null;
  const deepest7 = Math.max(...ds.slice(-7).map(g => g.maxLvl ?? 0));
  // sustainable rate: flow that keeps the dynamic level ≥ 3 m above the minimum safe level (from observed drawdown per L/min)
  const pts = window_(p.id, S.now - 7 * D).filter(x => x.s === "running" && x.m.flow_lpm > p.Q * 0.3 && x.m.well_level_m != null);
  const spec = pts.length ? avg(pts.map(x => (x.m.well_level_m - (stNow ?? w.static)) / x.m.flow_lpm)) : null;
  const sustain = spec ? Math.max(0, (w.minSafe - 3 - (stNow ?? w.static)) / spec) : null;
  return { static: stNow, static0: st0, staticTrend: st0 != null ? stNow - st0 : null, level: lvl, drawdown, rec7, rec30, recSlower: rec7 && rec30 ? (rec7 / rec30 - 1) * 100 : null, deepest7, margin: w.minSafe - deepest7, sustain, spec, dry7: daily(p).filter(g => g.day > dk(S.now) - 7).reduce((s, g) => s + g.dry, 0), days: ds };
}

/* ---------- HEALTH SCORE (transparent, rule-based) ---------- */
export function health(p) {
  const r = [], add = (pts, txt, key) => { if (pts > 0.5) r.push({ pts: Math.round(pts), txt, key }); };
  const d = dev(p), offMin = (S.now - d.lastHeartbeat) / MIN;
  const pr = perfRatio(p, 2), pr30 = perfRatio(p, 30), pr7old = (() => { const ds = daily(p).filter(g => g.day <= dk(S.now) - 21 && g.n > 3); const f = ds.reduce((s, g) => s + g.flowSum, 0), e = ds.reduce((s, g) => s + g.expSum, 0); return e ? f / e : null; })();
  if (pr != null && pr < 0.88) add(Math.min(30, (1 - pr) * 85), tl("Flow {n}% below baseline for the same pump power", { n: Math.round((1 - pr) * 100) }), "flow");
  const days7 = daily(p).filter(g => g.day > dk(S.now) - 7);
  const dry = days7.reduce((s, g) => s + g.dry, 0), ot = days7.reduce((s, g) => s + g.ot, 0);
  if (dry) add(Math.min(24, dry * 4), dry === 1 ? tl("{n} dry-run trip in the last 7 days", { n: dry }) : tl("{n} dry-run trips in the last 7 days", { n: dry }), "dry");
  if (ot) add(Math.min(15, ot * 5), ot === 1 ? tl("{n} over-temperature shutdown in the last 7 days", { n: ot }) : tl("{n} over-temperature shutdowns in the last 7 days", { n: ot }), "faults");
  const maxCt = Math.max(...days7.map(g => g.maxCt ?? 0));
  if (maxCt > S.thresholds.overheatC && !ot) add(10, tl("Controller reached {t} °C this week (limit {lim} °C)", { t: Math.round(maxCt), lim: S.thresholds.overheatC }), "heat");
  else if (maxCt > S.thresholds.overheatC) add(6, tl("Controller peaked at {t} °C", { t: Math.round(maxCt) }), "heat");
  const ds = daily(p).filter(g => g.pump > 0.5);
  const kwhm3 = v => v.reduce((s, g) => s + g.pump, 0) / Math.max(0.1, v.reduce((s, g) => s + g.water, 0));
  if (ds.length > 10) { const e0 = kwhm3(ds.slice(0, 6)), e1 = kwhm3(ds.slice(-3)); if (e1 > e0 * 1.18) add(10, tl("Energy per m³ up {n}% vs first week ({a} → {b} kWh/m³)", { n: Math.round((e1 / e0 - 1) * 100), a: e0.toFixed(2), b: e1.toFixed(2) }), "power"); }
  if (pr7old && pr30 != null) { const pr7 = perfRatio(p, 7); if (pr7 && pr7 < pr7old * 0.9 && !(pr != null && pr < 0.88)) add(8, tl("Performance trending down over 30 days"), "trend"); }
  const dsI = daily(p).filter(g => g.irr > 2);
  if (BASE[p.id]?.pv && dsI.length > 10) { const y0 = pvYield(dsI.slice(0, 6)), y1 = pvYield(dsI.slice(-3)); if (y1 < y0 * 0.85) add(Math.min(15, (1 - y1 / y0) * 40), tl("Solar output {n}% below its first-week level for the same sunlight", { n: Math.round((1 - y1 / y0) * 100) }), "solar"); }
  const ws = wellStats(p);
  if (ws) { if (ws.margin < S.thresholds.wellMarginM) add(10, tl("Well came within {m} m of its minimum safe level this week", { m: r1(Math.max(0, ws.margin)) }), "well"); if (ws.staticTrend > 1) add(8, tl("Resting water level {m} m deeper than 30 days ago", { m: r1(ws.staticTrend) }), "well2"); }
  if (offMin > S.thresholds.commsLossMin) add(Math.min(15, 5 + offMin / 30), tl("No data for {t} — condition can't be verified", { t: fmtDur(offMin) }), "comms");
  else if (d.sent > 50 && d.lost / d.sent > 0.04) add(4, tl("Unreliable connection: {n}% of uploads needed a retry", { n: Math.round(d.lost / d.sent * 100) }), "comms");
  const over = (S.now - p.maint.next) / D;
  if (over > 0) add(Math.min(15, over * 0.6 + 3), tl("Maintenance overdue by {n} days", { n: Math.floor(over) }), "maint");
  const score = clamp(100 - r.reduce((s, x) => s + x.pts, 0), 0, 100);
  r.sort((a, b) => b.pts - a.pts);
  return { score: Math.round(score), reasons: r };
}
export const hColor = s => s >= 80 ? "ok" : s >= 60 ? "warn" : "crit";

/* ---------- STATUS: pump state and IoT state are separate ---------- */
export function status(p) {
  const pt = last(p.id), d = dev(p), s = SIM[p.id], offMin = (S.now - d.lastHeartbeat) / MIN;
  const iot = offMin > S.thresholds.commsLossMin ? { c: "off", t: tl("Offline"), d: tl("No data for {t}", { t: fmtDur(offMin) }) } : (d.rssiNow ?? d.rssi) < -100 || (d.sent > 50 && d.lost / d.sent > 0.04) ? { c: "warn", t: tl("Weak connectivity"), d: tl("Signal {r} dBm, {n}% retries", { r: d.rssiNow ?? d.rssi, n: Math.round(d.lost / Math.max(1, d.sent) * 100) }) } : { c: "ok", t: tl("Connected"), d: tl("Signal {r} dBm", { r: d.rssiNow ?? d.rssi }) };
  const al = S.alarms.filter(a => a.pump === p.id && a.state !== "cleared");
  if (iot.c === "off") return { c: "off", label: tl("Offline"), pump: "Unknown", detail: pt ? tl("Last known: {s} at {t}", { s: tlx(pt.s), t: fmtTime(pt.t) }) : tl("No data yet"), iot, alarms: al };
  const st = pt?.s;
  let c = "ok", label = st === "running" ? tl("Running") : tl("Stopped");
  if (st === "faulted") { c = "crit"; label = tl("Faulted"); }
  else if (al.some(a => a.sev === "critical" && a.rule !== "comms_loss")) c = "crit";
  else if (al.some(a => a.sev === "warning" && a.rule !== "comms_loss")) c = "warn";
  const h = health(p).score; if (c === "ok" && h < 70) c = "warn";
  return { c, label, pump: st, detail: tlx(s.reason), iot, alarms: al };
}
export const ST_TXT = { ok: tlk("Healthy"), warn: tlk("Needs attention"), crit: tlk("Critical"), off: tlk("Offline / no recent data") };

/* ---------- DIAGNOSTICS ENGINE (rule-based, evidence-first) ---------- */
export function diagnose(p) {
  const out = [], pt = last(p.id), d = dev(p), w = well(p), ws = wellStats(p);
  const offMin = (S.now - d.lastHeartbeat) / MIN;
  const recent = window_(p.id, S.now - 90 * MIN).filter(x => x.s === "running" && x.m.pump_power > 0.45 * p.P && !x.f);
  const avg = (v) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  const bFlow = avg(recent.map(x => x.m.flow_lpm)), bExp = avg(recent.map(x => expFlow(p, x.m.pump_power)).filter(Boolean));
  const days7 = daily(p).filter(g => g.day > dk(S.now) - 7);

  if (offMin > S.thresholds.commsLossMin) out.push({
    key: "comms", sev: "warning", title: tl("We can't see this pump right now"),
    summary: tl("{p}'s IoT device hasn't reported for {t}. The pump itself may still be working — the device keeps readings in its memory and will upload them when the connection returns.", { p: p.short, t: fmtDur(offMin) }),
    likely: d.net.includes("LTE") ? tl("Mobile network outage or SIM data problem") : tl("Gateway or radio link down"),
    possible: [tl("Cellular coverage drop or SIM out of data"), tl("Device lost power (check its fuse and battery)"), tl("Gateway or antenna damaged"), tl("Firmware hang — a power cycle usually recovers it")],
    evidence: [tl("Last data received {t}", { t: fmtDT(d.lastHeartbeat) }), tl("Signal before dropout: {r} dBm", { r: d.rssi }), tl("Last known pump state: {s}", { s: tlx(pt?.s || "—") })],
    action: tl("Call someone on site to check the pump is running, then check the device's power LED. No need to rush out if water is reaching the tank."),
    tech: { device: d.id, adapter: d.adapter, network: d.net, buffered_on_device: SIM[p.id].buffer.length, last_seq: SIM[p.id].seq - SIM[p.id].buffer.length },
  });
  const dry = days7.reduce((s, g) => s + g.dry, 0);
  if (pt?.f === "E-DRY" || dry >= 2) {
    const lv = window_(p.id, S.now - 24 * H).filter(x => x.m.well_level_m != null);
    const deepest = lv.length ? Math.max(...lv.map(x => x.m.well_level_m)) : null;
    out.push({
      key: "dry", sev: pt?.f === "E-DRY" ? "critical" : "warning", title: tl("Pump is running out of water in the well"),
      summary: dry === 1 ? tl("{p} has tripped on dry-run protection {n} time in 7 days. At full sun the pump draws water faster than the well can refill.", { p: p.short, n: dry }) : tl("{p} has tripped on dry-run protection {n} times in 7 days. At full sun the pump draws water faster than the well can refill.", { p: p.short, n: dry }),
      likely: tl("Pumping rate is higher than the well's sustainable yield around midday"),
      possible: [tl("Well yield lower in this season"), tl("Pump installed too shallow for the drawdown"), tl("Intake partly blocked, making the level read low near the pump"), tl("Level sensor drift (check against a dip-meter reading)")],
      evidence: [deepest != null ? tl("Water fell to {m} m below ground; pump intake is at {d} m", { m: r1(deepest), d: w.pumpDepth }) : tl("Controller reported E-DRY"), ws?.sustain ? tl("Estimated sustainable rate ≈ {n} L/min vs rated {q} L/min", { n: Math.round(ws.sustain), q: p.Q }) : null, tl("Trips usually start {t}", { t: dryHour(p) })].filter(Boolean),
      action: ws?.sustain ? tl("Limit the pump to about {n} L/min (reduce max frequency on the controller), or split the schedule so the well recovers around midday. Each dry run wears the pump.", { n: Math.round(ws.sustain) }) : tl("Reduce pumping and allow the well to recover between runs."),
      tech: { fault_code: "E-DRY", pump_depth_m: w.pumpDepth, min_safe_level_m: w.minSafe, specific_drawdown_m_per_lpm: ws?.spec ? +ws.spec.toFixed(3) : null, motor_temp_peak_c: Math.max(...window_(p.id, S.now - 24 * H).map(x => x.m.motor_temp_c || 0)) },
    });
  }
  if (bFlow != null && bExp && bFlow < bExp * 0.85 && recent.length >= 8 && pt?.f !== "E-DRY") {
    const dev_ = (bFlow / bExp - 1) * 100, pr = recent.map(x => x.m.pressure_bar).filter(v => v != null), prAvg = avg(pr);
    const hasPr = has(p, "pressure_bar"), highPr = hasPr && prAvg > p.expPressure * 1.1;
    const lvOk = !ws || ws.margin > 6;
    out.push({
      key: "lowflow", sev: dev_ < -25 ? "warning" : "info", title: tl("Water production is below expected"),
      summary: tl("{p} is producing {n}% less water than expected for the solar power it's receiving ({a} vs {b} L/min).", { p: p.short, n: Math.abs(Math.round(dev_)), a: r1(bFlow), b: r1(bExp) }),
      likely: highPr ? tl("A restriction on the delivery side — clogged intake screen, partly closed valve, or scaled pipe") : !lvOk ? tl("Declining well level increasing the lift") : tl("Pump wear or a restriction"),
      possible: [tl("Clogged intake screen"), tl("Partly closed valve or scaled pipe"), tl("Worn impellers / rotor"), lvOk ? null : tl("Deeper water level raising the lift")].filter(Boolean),
      evidence: [tl("Last 90 min at high power: {a} L/min actual vs {b} L/min expected", { a: r1(bFlow), b: r1(bExp) }), hasPr ? tl("Discharge pressure {a} bar (normal ≈ {b} bar at this flow)", { a: prAvg?.toFixed(2), b: p.expPressure }) : tl("No pressure sensor on this pump"), ws ? tl("Well level is normal ({a} m, {b} m clear of minimum)", { a: r1(ws.level), b: r1(ws.margin) }) : tl("No well-level sensor"), tl("Decline started around {d}", { d: declineStart(p) })],
      action: tl("Schedule an inspection: check the valve positions and intake screen first (quick), then the pump if flow doesn't recover."),
      tech: { baseline_k: +BASE[p.id].k.toFixed(3), baseline_window: fmtDate(BASE[p.id].from) + "–" + fmtDate(BASE[p.id].to), samples: recent.length, energy_kwh_per_m3_today: +(today(p).pump / Math.max(0.1, today(p).water)).toFixed(3) },
    });
  }
  const pvPts = window_(p.id, S.now - 3 * H).filter(x => x.s === "running" && x.m.irradiance_wm2 > 450);
  const pvAct = avg(pvPts.map(x => x.m.pv_power)), pvExp = avg(pvPts.map(x => expPV(p, x.m.irradiance_wm2)).filter(Boolean));
  if (pvAct && pvExp && pvAct < pvExp * 0.82) {
    const ds = daily(p).filter(g => g.irr > 2);
    out.push({
      key: "solar", sev: "warning", title: tl("Solar production is lower than expected"),
      summary: tl("The panels at {p} are delivering about {n}% less power than the measured sunlight should give. Less solar power means less water.", { p: p.short, n: Math.round((1 - pvAct / pvExp) * 100) }), pct: Math.round((1 - pvAct / pvExp) * 100),
      likely: tl("Dirty panels (gradual decline over weeks, not a sudden drop)"),
      possible: [tl("Dust or bird droppings on panels"), tl("New shading (tree growth, structure)"), tl("Panel degradation or a failed string"), tl("Loose connector or controller MPPT issue")],
      evidence: [tl("Last 3 h in good sun: {a} W vs {b} W expected", { a: fmtN(pvAct), b: fmtN(pvExp) }), tl("Solar yield per unit of sunlight down {n}% since the first week", { n: Math.round((1 - pvYield(ds.slice(-3)) / pvYield(ds.slice(0, 5))) * 100) }), tl("Decline was gradual — points to soiling rather than a fault")],
      action: tl("Clean the panels early morning with water and a soft brush; check for new shading. If output doesn't recover, test each string."),
      tech: { pv_capacity_kw: arr(p).kw, baseline_pr: BASE[p.id].pv ? +BASE[p.id].pv.toFixed(3) : null, irradiance_source: site(p.site).name + " pyranometer" },
    });
  } else if (!has(p, "irradiance_wm2") && pt?.s === "running") out.push({ key: "nosolar", sev: "info", title: tl("Solar performance can't be checked"), summary: tl("This site has no sunlight sensor, so we can't tell whether the panels are underperforming. Flow and power are still monitored."), likely: "—", possible: [], evidence: [tl("No irradiance sensor configured at {s}", { s: site(p.site).name })], action: tl("Add a low-cost irradiance sensor to unlock solar diagnostics."), tech: {} });
  const maxCt = Math.max(...days7.map(g => g.maxCt ?? 0)), ot = days7.reduce((s, g) => s + g.ot, 0);
  if (maxCt > S.thresholds.overheatC) out.push({
    key: "heat", sev: ot ? "warning" : "info", title: tl("Pump controller is overheating"),
    summary: !ot ? tl("The controller reached {t} °C this week. Peaks line up with strong afternoon sun, not with heavy load.", { t: Math.round(maxCt) }) : ot === 1 ? tl("The controller reached {t} °C this week and shut down {n} time. Peaks line up with strong afternoon sun, not with heavy load.", { t: Math.round(maxCt), n: ot }) : tl("The controller reached {t} °C this week and shut down {n} times. Peaks line up with strong afternoon sun, not with heavy load.", { t: Math.round(maxCt), n: ot }),
    likely: tl("Enclosure in direct sun / poor ventilation"),
    possible: [tl("Controller box in direct sun"), tl("Blocked vents or failed fan"), tl("Dust on heatsink"), tl("Long run at full power in hot weather")],
    evidence: [tl("Peak {t} °C (alert at {a} °C, trips at 80 °C)", { t: Math.round(maxCt), a: S.thresholds.overheatC }), tl("Pump power at peak is normal for the sun"), has(p, "irradiance_wm2") ? tl("Temperature tracks sunlight on the enclosure") : null].filter(Boolean),
    action: tl("Fit a sun shade over the controller box and clean the vents. Cheap fix that protects the most expensive electronic part."),
    tech: { trip_threshold_c: 80, alert_threshold_c: S.thresholds.overheatC, trips_7d: ot },
  });
  if (ws && ws.staticTrend > 1) out.push({
    key: "well", sev: "warning", title: tl("Well water level is dropping over time"),
    summary: ws.recSlower > 8 ? tl("{w}'s resting water level is {m} m deeper than a month ago, and it is recovering {n}% slower than its 30-day average.", { w: w.name, m: r1(ws.staticTrend), n: Math.round(ws.recSlower) }) : tl("{w}'s resting water level is {m} m deeper than a month ago.", { w: w.name, m: r1(ws.staticTrend) }),
    likely: tl("Seasonal decline of the aquifer, possibly made worse by over-pumping"),
    possible: [tl("Dry-season groundwater decline"), tl("Neighbouring wells drawing on the same aquifer"), tl("Pumping more than the well can sustainably supply")],
    evidence: [tl("Resting level {a} m → {b} m below ground", { a: r1(ws.static0), b: r1(ws.static) }), ws.rec7 ? tl("Overnight recovery {a} (30-day avg {b})", { a: fmtDur(ws.rec7), b: fmtDur(ws.rec30) }) : null, tl("Minimum safe level: {m} m", { m: w.minSafe })].filter(Boolean),
    action: tl("Keep an eye on it weekly. If it keeps falling, reduce daily pumping volume and consider lowering the pump before the next dry season."),
    tech: { static_trend_m: +ws.staticTrend.toFixed(2), recovery_rate_m_per_h: ws.days.slice(-1)[0]?.recovRate ? +ws.days.slice(-1)[0].recovRate.toFixed(2) : null },
  });
  const over = (S.now - p.maint.next) / D;
  if (over > 0) out.push({ key: "maint", sev: over > 10 ? "warning" : "info", title: tl("Scheduled maintenance is overdue"), summary: tl("Service was due {d} ({n} days ago).", { d: fmtDate(p.maint.next), n: Math.floor(over) }), likely: "—", possible: [], evidence: [tl("Last service {d}", { d: fmtDate(p.maint.last) }), tl("Interval {n} days", { n: p.maint.intervalDays })], action: tl("Assign the overdue task to a technician."), tech: {} });
  const rank = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
}
export function pvYield(ds) { const pv = ds.reduce((s, g) => s + g.pv, 0), irr = ds.reduce((s, g) => s + g.irr, 0); return irr ? pv / irr : 1; }
export function dryHour(p) { const hs = TS[p.id].filter(x => x.f === "E-DRY" && x.t > S.now - 7 * D).map(x => lh(x.t)); if (!hs.length) return tl("around midday"); hs.sort((a, b) => a - b); const h = hs[hs.length >> 1]; return tl("around {t}", { t: pad(Math.floor(h)) + ":" + pad(Math.round((h % 1) * 60 / 10) * 10 % 60) }); }
export function declineStart(p) { const ds = daily(p).filter(g => g.n > 3); const k = ds.find(g => g.flowSum / g.expSum < 0.95); return k ? fmtDate(k.day * D - TZ + 12 * H) : "—"; }

/* plain-language answers to the five operator questions */
export function fiveQ(p) {
  const st = status(p), pt = last(p.id), d = derived(p, pt), dg = diagnose(p), s = SIM[p.id];
  const off = st.c === "off";
  const q1 = off ? { c: "off", a: tl("Unknown"), d: st.detail } : pt.s === "running" ? { c: "ok", a: tl("Yes"), d: tlx(s.reason) } : pt.s === "faulted" ? { c: "crit", a: tl("No — fault"), d: tlx(s.reason) } : { c: "off", a: tl("No"), d: tlx(s.reason) };
  const exp = pt?.s === "running" ? expFlow(p, d.pump_power) : null;
  const q2 = off ? { c: "off", a: tl("Unknown"), d: tl("No recent data") } : pt.s !== "running" ? { c: "off", a: tl("Not pumping"), d: tl("{v} m³ so far today", { v: fmtN(today(p).water, 1) }) } : exp && d.flow_lpm < exp * 0.75 ? { c: "warn", a: tl("Less than expected"), d: tl("{a} of {b} L/min expected", { a: d.flow_lpm, b: r1(exp) }) } : d.flow_lpm < 3 ? { c: "crit", a: tl("No"), d: tl("Running without flow") } : { c: "ok", a: tl("Yes"), d: tl("{a} L/min, {v} m³ today", { a: d.flow_lpm, v: fmtN(today(p).water, 1) }) };
  const ws = wellStats(p), wk = dg.find(x => x.key === "dry" || x.key === "well");
  const q3 = !has(p, "well_level_m") ? { c: "off", a: tl("Not measured"), d: tl("No well-level sensor installed") } : wk ? { c: wk.sev === "critical" ? "crit" : "warn", a: wk.key === "dry" ? tl("Under strain") : tl("Declining"), d: wk.title } : { c: "ok", a: tl("Yes"), d: ws ? tl("{m} m clear of minimum safe level", { m: r1(ws.margin) }) : tl("Level normal") };
  const sk = dg.find(x => x.key === "solar"), hk = dg.find(x => x.key === "heat");
  const q4 = !has(p, "irradiance_wm2") ? { c: "off", a: tl("Can't compare"), d: tl("No sunlight sensor at this site") } : sk ? { c: "warn", a: tl("Below normal"), d: tl("Panels delivering about {n}% less power than the measured sunlight should give", { n: sk.pct }) } : hk ? { c: "warn", a: tl("Panels OK, controller hot"), d: hk.title } : { c: "ok", a: tl("Yes"), d: d.irradiance_wm2 ? tl("{a} W at {b} W/m² sun", { a: fmtN(d.pv_power), b: d.irradiance_wm2 }) : tl("Night — no generation") };
  const top = dg[0];
  const q5 = top && top.sev !== "info" ? { c: top.sev === "critical" ? "crit" : "warn", a: top.sev === "critical" ? tl("Yes — now") : tl("Yes — plan it"), d: top.action.split(".")[0] + "." } : top ? { c: "ok", a: tl("Nothing urgent"), d: top.title } : { c: "ok", a: tl("No"), d: tl("Everything within normal range.") };
  return [[tl("Is the pump running?"), q1], [tl("Is it producing water?"), q2], [tl("Is the well healthy?"), q3], [tl("Is solar performing normally?"), q4], [tl("Does someone need to act?"), q5]];
}
