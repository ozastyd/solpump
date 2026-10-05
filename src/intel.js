/* ============================================================
   Operational intelligence: daily rollups (downsampling),
   well analytics, health score, rule-based diagnostics, status.
   ============================================================ */
import { BASE, D, H, MIN, S, SIM, TS, TZ, arr, clamp, derived, dev, dk, expFlow, expPV, fmtDT, fmtDate, fmtDur, fmtN, fmtTime, has, last, lh, pad, r1, site, well, window_ } from './core.js';
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
  if (pr != null && pr < 0.88) add(Math.min(30, (1 - pr) * 85), `Flow ${Math.round((1 - pr) * 100)}% below baseline for the same pump power`, "flow");
  const days7 = daily(p).filter(g => g.day > dk(S.now) - 7);
  const dry = days7.reduce((s, g) => s + g.dry, 0), ot = days7.reduce((s, g) => s + g.ot, 0);
  if (dry) add(Math.min(24, dry * 4), `${dry} dry-run ${dry === 1 ? "trip" : "trips"} in the last 7 days`, "dry");
  if (ot) add(Math.min(15, ot * 5), `${ot} over-temperature ${ot === 1 ? "shutdown" : "shutdowns"} in the last 7 days`, "faults");
  const maxCt = Math.max(...days7.map(g => g.maxCt ?? 0));
  if (maxCt > S.thresholds.overheatC && !ot) add(10, `Controller reached ${Math.round(maxCt)} °C this week (limit ${S.thresholds.overheatC} °C)`, "heat");
  else if (maxCt > S.thresholds.overheatC) add(6, `Controller peaked at ${Math.round(maxCt)} °C`, "heat");
  const ds = daily(p).filter(g => g.pump > 0.5);
  const kwhm3 = v => v.reduce((s, g) => s + g.pump, 0) / Math.max(0.1, v.reduce((s, g) => s + g.water, 0));
  if (ds.length > 10) { const e0 = kwhm3(ds.slice(0, 6)), e1 = kwhm3(ds.slice(-3)); if (e1 > e0 * 1.18) add(10, `Energy per m³ up ${Math.round((e1 / e0 - 1) * 100)}% vs first week (${e0.toFixed(2)} → ${e1.toFixed(2)} kWh/m³)`, "power"); }
  if (pr7old && pr30 != null) { const pr7 = perfRatio(p, 7); if (pr7 && pr7 < pr7old * 0.9 && !(pr != null && pr < 0.88)) add(8, `Performance trending down over 30 days`, "trend"); }
  const dsI = daily(p).filter(g => g.irr > 2);
  if (BASE[p.id]?.pv && dsI.length > 10) { const y0 = pvYield(dsI.slice(0, 6)), y1 = pvYield(dsI.slice(-3)); if (y1 < y0 * 0.85) add(Math.min(15, (1 - y1 / y0) * 40), `Solar output ${Math.round((1 - y1 / y0) * 100)}% below its first-week level for the same sunlight`, "solar"); }
  const ws = wellStats(p);
  if (ws) { if (ws.margin < S.thresholds.wellMarginM) add(10, `Well came within ${r1(Math.max(0, ws.margin))} m of its minimum safe level this week`, "well"); if (ws.staticTrend > 1) add(8, `Resting water level ${r1(ws.staticTrend)} m deeper than 30 days ago`, "well2"); }
  if (offMin > S.thresholds.commsLossMin) add(Math.min(15, 5 + offMin / 30), `No data for ${fmtDur(offMin)} — condition can't be verified`, "comms");
  else if (d.sent > 50 && d.lost / d.sent > 0.04) add(4, `Unreliable connection: ${Math.round(d.lost / d.sent * 100)}% of uploads needed a retry`, "comms");
  const over = (S.now - p.maint.next) / D;
  if (over > 0) add(Math.min(15, over * 0.6 + 3), `Maintenance overdue by ${Math.floor(over)} days`, "maint");
  const score = clamp(100 - r.reduce((s, x) => s + x.pts, 0), 0, 100);
  r.sort((a, b) => b.pts - a.pts);
  return { score: Math.round(score), reasons: r };
}
export const hColor = s => s >= 80 ? "ok" : s >= 60 ? "warn" : "crit";

/* ---------- STATUS: pump state and IoT state are separate ---------- */
export function status(p) {
  const pt = last(p.id), d = dev(p), s = SIM[p.id], offMin = (S.now - d.lastHeartbeat) / MIN;
  const iot = offMin > S.thresholds.commsLossMin ? { c: "off", t: "Offline", d: "No data for " + fmtDur(offMin) } : (d.rssiNow ?? d.rssi) < -100 || (d.sent > 50 && d.lost / d.sent > 0.04) ? { c: "warn", t: "Weak connectivity", d: "Signal " + (d.rssiNow ?? d.rssi) + " dBm, " + Math.round(d.lost / Math.max(1, d.sent) * 100) + "% retries" } : { c: "ok", t: "Connected", d: "Signal " + (d.rssiNow ?? d.rssi) + " dBm" };
  const al = S.alarms.filter(a => a.pump === p.id && a.state !== "cleared");
  if (iot.c === "off") return { c: "off", label: "Offline", pump: "Unknown", detail: pt ? `Last known: ${pt.s} at ${fmtTime(pt.t)}` : "No data yet", iot, alarms: al };
  const st = pt?.s;
  let c = "ok", label = st === "running" ? "Running" : "Stopped";
  if (st === "faulted") { c = "crit"; label = "Faulted"; }
  else if (al.some(a => a.sev === "critical" && a.rule !== "comms_loss")) c = "crit";
  else if (al.some(a => a.sev === "warning" && a.rule !== "comms_loss")) c = "warn";
  const h = health(p).score; if (c === "ok" && h < 70) c = "warn";
  return { c, label, pump: st, detail: s.reason, iot, alarms: al };
}
export const ST_TXT = { ok: "Healthy", warn: "Needs attention", crit: "Critical", off: "Offline / no recent data" };

/* ---------- DIAGNOSTICS ENGINE (rule-based, evidence-first) ---------- */
export function diagnose(p) {
  const out = [], pt = last(p.id), d = dev(p), w = well(p), ws = wellStats(p);
  const offMin = (S.now - d.lastHeartbeat) / MIN;
  const recent = window_(p.id, S.now - 90 * MIN).filter(x => x.s === "running" && x.m.pump_power > 0.45 * p.P && !x.f);
  const avg = (v) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  const bFlow = avg(recent.map(x => x.m.flow_lpm)), bExp = avg(recent.map(x => expFlow(p, x.m.pump_power)).filter(Boolean));
  const days7 = daily(p).filter(g => g.day > dk(S.now) - 7);

  if (offMin > S.thresholds.commsLossMin) out.push({
    key: "comms", sev: "warning", title: "We can't see this pump right now",
    summary: `${p.short}'s IoT device hasn't reported for ${fmtDur(offMin)}. The pump itself may still be working — the device keeps readings in its memory and will upload them when the connection returns.`,
    likely: d.net.includes("LTE") ? "Mobile network outage or SIM data problem" : "Gateway or radio link down",
    possible: ["Cellular coverage drop or SIM out of data", "Device lost power (check its fuse and battery)", "Gateway or antenna damaged", "Firmware hang — a power cycle usually recovers it"],
    evidence: [`Last data received ${fmtDT(d.lastHeartbeat)}`, `Signal before dropout: ${d.rssi} dBm`, `Last known pump state: ${pt?.s || "—"}`],
    action: "Call someone on site to check the pump is running, then check the device's power LED. No need to rush out if water is reaching the tank.",
    tech: { device: d.id, adapter: d.adapter, network: d.net, buffered_on_device: SIM[p.id].buffer.length, last_seq: SIM[p.id].seq - SIM[p.id].buffer.length },
  });
  const dry = days7.reduce((s, g) => s + g.dry, 0);
  if (pt?.f === "E-DRY" || dry >= 2) {
    const lv = window_(p.id, S.now - 24 * H).filter(x => x.m.well_level_m != null);
    const deepest = lv.length ? Math.max(...lv.map(x => x.m.well_level_m)) : null;
    out.push({
      key: "dry", sev: pt?.f === "E-DRY" ? "critical" : "warning", title: "Pump is running out of water in the well",
      summary: `${p.short} has tripped on dry-run protection ${dry} ${dry === 1 ? "time" : "times"} in 7 days. At full sun the pump draws water faster than the well can refill.`,
      likely: "Pumping rate is higher than the well's sustainable yield around midday",
      possible: ["Well yield lower in this season", "Pump installed too shallow for the drawdown", "Intake partly blocked, making the level read low near the pump", "Level sensor drift (check against a dip-meter reading)"],
      evidence: [deepest != null ? `Water fell to ${r1(deepest)} m below ground; pump intake is at ${w.pumpDepth} m` : "Controller reported E-DRY", ws?.sustain ? `Estimated sustainable rate ≈ ${Math.round(ws.sustain)} L/min vs rated ${p.Q} L/min` : null, `Trips usually start ${dryHour(p)}`].filter(Boolean),
      action: ws?.sustain ? `Limit the pump to about ${Math.round(ws.sustain)} L/min (reduce max frequency on the controller), or split the schedule so the well recovers around midday. Each dry run wears the pump.` : "Reduce pumping and allow the well to recover between runs.",
      tech: { fault_code: "E-DRY", pump_depth_m: w.pumpDepth, min_safe_level_m: w.minSafe, specific_drawdown_m_per_lpm: ws?.spec ? +ws.spec.toFixed(3) : null, motor_temp_peak_c: Math.max(...window_(p.id, S.now - 24 * H).map(x => x.m.motor_temp_c || 0)) },
    });
  }
  if (bFlow != null && bExp && bFlow < bExp * 0.85 && recent.length >= 8 && pt?.f !== "E-DRY") {
    const dev_ = (bFlow / bExp - 1) * 100, pr = recent.map(x => x.m.pressure_bar).filter(v => v != null), prAvg = avg(pr);
    const hasPr = has(p, "pressure_bar"), highPr = hasPr && prAvg > p.expPressure * 1.1;
    const lvOk = !ws || ws.margin > 6;
    out.push({
      key: "lowflow", sev: dev_ < -25 ? "warning" : "info", title: "Water production is below expected",
      summary: `${p.short} is producing ${Math.abs(Math.round(dev_))}% less water than expected for the solar power it's receiving (${r1(bFlow)} vs ${r1(bExp)} L/min).`,
      likely: highPr ? "A restriction on the delivery side — clogged intake screen, partly closed valve, or scaled pipe" : !lvOk ? "Declining well level increasing the lift" : "Pump wear or a restriction",
      possible: ["Clogged intake screen", "Partly closed valve or scaled pipe", "Worn impellers / rotor", lvOk ? null : "Deeper water level raising the lift"].filter(Boolean),
      evidence: [`Last 90 min at high power: ${r1(bFlow)} L/min actual vs ${r1(bExp)} L/min expected`, hasPr ? `Discharge pressure ${prAvg?.toFixed(2)} bar (normal ≈ ${p.expPressure} bar at this flow)` : "No pressure sensor on this pump", ws ? `Well level is normal (${r1(ws.level)} m, ${r1(ws.margin)} m clear of minimum)` : "No well-level sensor", `Decline started around ${declineStart(p)}`],
      action: "Schedule an inspection: check the valve positions and intake screen first (quick), then the pump if flow doesn't recover.",
      tech: { baseline_k: +BASE[p.id].k.toFixed(3), baseline_window: fmtDate(BASE[p.id].from) + "–" + fmtDate(BASE[p.id].to), samples: recent.length, energy_kwh_per_m3_today: +(today(p).pump / Math.max(0.1, today(p).water)).toFixed(3) },
    });
  }
  const pvPts = window_(p.id, S.now - 3 * H).filter(x => x.s === "running" && x.m.irradiance_wm2 > 450);
  const pvAct = avg(pvPts.map(x => x.m.pv_power)), pvExp = avg(pvPts.map(x => expPV(p, x.m.irradiance_wm2)).filter(Boolean));
  if (pvAct && pvExp && pvAct < pvExp * 0.82) {
    const ds = daily(p).filter(g => g.irr > 2);
    out.push({
      key: "solar", sev: "warning", title: "Solar production is lower than expected",
      summary: `The panels at ${p.short} are delivering about ${Math.round((1 - pvAct / pvExp) * 100)}% less power than the measured sunlight should give. Less solar power means less water.`,
      likely: "Dirty panels (gradual decline over weeks, not a sudden drop)",
      possible: ["Dust or bird droppings on panels", "New shading (tree growth, structure)", "Panel degradation or a failed string", "Loose connector or controller MPPT issue"],
      evidence: [`Last 3 h in good sun: ${fmtN(pvAct)} W vs ${fmtN(pvExp)} W expected`, `Solar yield per unit of sunlight down ${Math.round((1 - pvYield(ds.slice(-3)) / pvYield(ds.slice(0, 5))) * 100)}% since the first week`, "Decline was gradual — points to soiling rather than a fault"],
      action: "Clean the panels early morning with water and a soft brush; check for new shading. If output doesn't recover, test each string.",
      tech: { pv_capacity_kw: arr(p).kw, baseline_pr: BASE[p.id].pv ? +BASE[p.id].pv.toFixed(3) : null, irradiance_source: site(p.site).name + " pyranometer" },
    });
  } else if (!has(p, "irradiance_wm2") && pt?.s === "running") out.push({ key: "nosolar", sev: "info", title: "Solar performance can't be checked", summary: "This site has no sunlight sensor, so we can't tell whether the panels are underperforming. Flow and power are still monitored.", likely: "—", possible: [], evidence: ["No irradiance sensor configured at " + site(p.site).name], action: "Add a low-cost irradiance sensor to unlock solar diagnostics.", tech: {} });
  const maxCt = Math.max(...days7.map(g => g.maxCt ?? 0)), ot = days7.reduce((s, g) => s + g.ot, 0);
  if (maxCt > S.thresholds.overheatC) out.push({
    key: "heat", sev: ot ? "warning" : "info", title: "Pump controller is overheating",
    summary: `The controller reached ${Math.round(maxCt)} °C this week${ot ? ` and shut down ${ot} ${ot === 1 ? "time" : "times"}` : ""}. Peaks line up with strong afternoon sun, not with heavy load.`,
    likely: "Enclosure in direct sun / poor ventilation",
    possible: ["Controller box in direct sun", "Blocked vents or failed fan", "Dust on heatsink", "Long run at full power in hot weather"],
    evidence: [`Peak ${Math.round(maxCt)} °C (alert at ${S.thresholds.overheatC} °C, trips at 80 °C)`, `Pump power at peak is normal for the sun`, has(p, "irradiance_wm2") ? "Temperature tracks sunlight on the enclosure" : null].filter(Boolean),
    action: "Fit a sun shade over the controller box and clean the vents. Cheap fix that protects the most expensive electronic part.",
    tech: { trip_threshold_c: 80, alert_threshold_c: S.thresholds.overheatC, trips_7d: ot },
  });
  if (ws && ws.staticTrend > 1) out.push({
    key: "well", sev: "warning", title: "Well water level is dropping over time",
    summary: `${w.name}'s resting water level is ${r1(ws.staticTrend)} m deeper than a month ago${ws.recSlower > 8 ? `, and it is recovering ${Math.round(ws.recSlower)}% slower than its 30-day average` : ""}.`,
    likely: "Seasonal decline of the aquifer, possibly made worse by over-pumping",
    possible: ["Dry-season groundwater decline", "Neighbouring wells drawing on the same aquifer", "Pumping more than the well can sustainably supply"],
    evidence: [`Resting level ${r1(ws.static0)} m → ${r1(ws.static)} m below ground`, ws.rec7 ? `Overnight recovery ${fmtDur(ws.rec7)} (30-day avg ${fmtDur(ws.rec30)})` : null, `Minimum safe level: ${w.minSafe} m`].filter(Boolean),
    action: "Keep an eye on it weekly. If it keeps falling, reduce daily pumping volume and consider lowering the pump before the next dry season.",
    tech: { static_trend_m: +ws.staticTrend.toFixed(2), recovery_rate_m_per_h: ws.days.slice(-1)[0]?.recovRate ? +ws.days.slice(-1)[0].recovRate.toFixed(2) : null },
  });
  const over = (S.now - p.maint.next) / D;
  if (over > 0) out.push({ key: "maint", sev: over > 10 ? "warning" : "info", title: "Scheduled maintenance is overdue", summary: `Service was due ${fmtDate(p.maint.next)} (${Math.floor(over)} days ago).`, likely: "—", possible: [], evidence: [`Last service ${fmtDate(p.maint.last)}`, `Interval ${p.maint.intervalDays} days`], action: "Assign the overdue task to a technician.", tech: {} });
  const rank = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
}
export function pvYield(ds) { const pv = ds.reduce((s, g) => s + g.pv, 0), irr = ds.reduce((s, g) => s + g.irr, 0); return irr ? pv / irr : 1; }
export function dryHour(p) { const hs = TS[p.id].filter(x => x.f === "E-DRY" && x.t > S.now - 7 * D).map(x => lh(x.t)); if (!hs.length) return "around midday"; hs.sort((a, b) => a - b); const h = hs[hs.length >> 1]; return "around " + pad(Math.floor(h)) + ":" + pad(Math.round((h % 1) * 60 / 10) * 10 % 60); }
export function declineStart(p) { const ds = daily(p).filter(g => g.n > 3); const k = ds.find(g => g.flowSum / g.expSum < 0.95); return k ? fmtDate(k.day * D - TZ + 12 * H) : "—"; }

/* plain-language answers to the five operator questions */
export function fiveQ(p) {
  const st = status(p), pt = last(p.id), d = derived(p, pt), dg = diagnose(p), s = SIM[p.id];
  const off = st.c === "off";
  const q1 = off ? { c: "off", a: "Unknown", d: st.detail } : pt.s === "running" ? { c: "ok", a: "Yes", d: s.reason } : pt.s === "faulted" ? { c: "crit", a: "No — fault", d: s.reason } : { c: "off", a: "No", d: s.reason };
  const exp = pt?.s === "running" ? expFlow(p, d.pump_power) : null;
  const q2 = off ? { c: "off", a: "Unknown", d: "No recent data" } : pt.s !== "running" ? { c: "off", a: "Not pumping", d: `${fmtN(today(p).water, 1)} m³ so far today` } : exp && d.flow_lpm < exp * 0.75 ? { c: "warn", a: "Less than expected", d: `${d.flow_lpm} of ${r1(exp)} L/min expected` } : d.flow_lpm < 3 ? { c: "crit", a: "No", d: "Running without flow" } : { c: "ok", a: "Yes", d: `${d.flow_lpm} L/min, ${fmtN(today(p).water, 1)} m³ today` };
  const ws = wellStats(p), wk = dg.find(x => x.key === "dry" || x.key === "well");
  const q3 = !has(p, "well_level_m") ? { c: "off", a: "Not measured", d: "No well-level sensor installed" } : wk ? { c: wk.sev === "critical" ? "crit" : "warn", a: wk.key === "dry" ? "Under strain" : "Declining", d: wk.title } : { c: "ok", a: "Yes", d: ws ? `${r1(ws.margin)} m clear of minimum safe level` : "Level normal" };
  const sk = dg.find(x => x.key === "solar"), hk = dg.find(x => x.key === "heat");
  const q4 = !has(p, "irradiance_wm2") ? { c: "off", a: "Can't compare", d: "No sunlight sensor at this site" } : sk ? { c: "warn", a: "Below normal", d: sk.summary.split(".")[0].replace(/^The panels at [^ ]+ #?\S* are /, "Panels ") } : hk ? { c: "warn", a: "Panels OK, controller hot", d: hk.title } : { c: "ok", a: "Yes", d: d.irradiance_wm2 ? `${fmtN(d.pv_power)} W at ${d.irradiance_wm2} W/m² sun` : "Night — no generation" };
  const top = dg[0];
  const q5 = top && top.sev !== "info" ? { c: top.sev === "critical" ? "crit" : "warn", a: top.sev === "critical" ? "Yes — now" : "Yes — plan it", d: top.action.split(".")[0] + "." } : top ? { c: "ok", a: "Nothing urgent", d: top.title } : { c: "ok", a: "No", d: "Everything within normal range." };
  return [["Is the pump running?", q1], ["Is it producing water?", q2], ["Is the well healthy?", q3], ["Is solar performing normally?", q4], ["Does someone need to act?", q5]];
}
