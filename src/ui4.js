/* ---------- REPORTS ---------- */
import { $, CHANNELS, D, H, MIN, ROLES, S, SIM, START, TZ, arr, audit, byId, can, dev, dk, fmtDT, fmtDate, fmtDur, fmtN, fmtTime, has, hash, learnBaseline, lh, myPumps, pump, scoped, seedEntities, site, stepWorld, toast, uid, user, well, window_ } from './core.js';
import { daily, perfRatio, sumDays } from './intel.js';
import { DRAWER, ROUTES, UI, VIEW, esc, healthM, pill, renderAll, renderShell, renderTop, setView, sev, updateClock } from './ui1.js';
import { modalOpen } from './ui2.js';
import { autoMaint, makeIncident } from './ui3.js';
export const REPORTS = {
  daily: "Daily operations report", weekly: "Weekly pump performance", monthly: "Monthly water production", solar: "Solar energy report", maint: "Maintenance report", fault: "Fault report", avail: "Asset availability report",
};
export function buildReport(type, per) {
  const ps = myPumps(), d0 = dk(S.now), n = { "1d": 1, "7d": 7, "30d": 30 }[per], a = d0 - n + 1;
  const fromT = a * D - TZ;
  if (type === "daily" || type === "weekly" || type === "monthly") {
    const rows = ps.map(p => { const x = sumDays(p, a, d0), h = healthM(p), pr = perfRatio(p, n); return [p.short, site(p.site).name.split(" — ")[0], fmtN(x.water, 1), fmtN(x.run / 60, 1), fmtN(x.pump, 1), x.water > .5 ? (x.pump / x.water).toFixed(2) : "—", pr ? Math.round(pr * 100) + "%" : "—", x.dry, h.score]; });
    const tot = ps.reduce((s, p) => s + sumDays(p, a, d0).water, 0);
    return { sum: `${fmtN(tot, 1)} m³ pumped by ${ps.length} pumps (${fmtN(tot / n, 1)} m³/day). Lowest performance: ${rows.slice().sort((x, y) => parseFloat(x[6]) - parseFloat(y[6]))[0]?.[0] || "—"}.`, cols: ["Pump", "Site", "Water m³", "Run h", "Pump kWh", "kWh/m³", "Perf vs baseline", "Dry trips", "Health"], rows };
  }
  if (type === "solar") { const rows = ps.map(p => { const ds = daily(p).filter(g => g.day >= a); const pv = ds.reduce((s, g) => s + g.pv, 0), irr = ds.reduce((s, g) => s + g.irr, 0); return [p.short, arr(p).kw + " kWp", fmtN(pv, 1), fmtN(pv / arr(p).kw / n, 2), has(p, "irradiance_wm2") ? fmtN(irr, 1) : "not measured", has(p, "irradiance_wm2") && irr ? Math.round(pv / (arr(p).kw * irr) * 100) + "%" : "—"]; }); return { sum: "Performance ratio = PV energy ÷ (capacity × sunlight). Healthy systems sit around 75–85% at pump load.", cols: ["Pump", "Array", "PV kWh", "kWh/kWp/day", "Sun kWh/m²", "Performance ratio"], rows }; }
  if (type === "maint") { const rs = scoped(S.records).filter(r => r.date >= fromT), ts = scoped(S.tasks).filter(t => t.status !== "Done"); return { sum: `${rs.length} jobs completed, Rp ${fmtN(rs.reduce((s, r) => s + r.cost, 0))} spent. ${ts.length} tasks open, ${ts.filter(t => S.now > t.due).length} overdue.`, cols: ["Date", "Pump", "Work", "Technician", "Parts", "Labour h", "Cost Rp"], rows: rs.map(r => [fmtDate(r.date), pump(r.pump).short, r.work, user(r.tech)?.name, r.parts.map(x => x.name + " x" + x.qty).join("; "), r.laborH, fmtN(r.cost)]) }; }
  if (type === "fault") { const al = scoped(S.alarms).filter(x => x.raisedAt >= fromT && x.sev !== "info"); const g = {}; for (const x of al) { const k = x.pump + "|" + x.title; g[k] = g[k] || [pump(x.pump).short, x.title, x.sev, 0, 0]; g[k][3] += x.occurrences; g[k][4] += ((x.clearedAt || S.now) - x.raisedAt) / MIN; } const rows = Object.values(g).sort((x, y) => y[3] - x[3]).map(r => [r[0], r[1], r[2], r[3], fmtDur(r[4])]); return { sum: `${al.length} alerts (${al.filter(x => x.sev === "critical").length} critical). Most frequent: ${rows[0] ? rows[0][0] + " — " + rows[0][1] : "none"}.`, cols: ["Pump", "Alert", "Severity", "Occurrences", "Total duration"], rows }; }
  const rows = ps.map(p => { let tot = 0, bad = 0, off = 0; for (const x of window_(p.id, fromT)) { const h = lh(x.t); if (h < 6.5 || h > 17) continue; tot += x.dt; if (x.s === "faulted") bad += x.dt; } const om = (S.now - dev(p).lastHeartbeat) / MIN; if (om > 15) { off = om * 11 / 24; tot += off; } return [p.short, fmtN(tot / 60, 1), fmtN(bad / 60, 1), fmtN(off / 60, 1), tot ? fmtN((1 - (bad + off) / tot) * 100, 1) + "%" : "—"]; });
  return { sum: "Availability counts daylight hours (06:30–17:00) when the pump was able to run — not faulted and visible.", cols: ["Pump", "Daylight h", "Faulted h", "Not visible h", "Availability"], rows };
}
ROUTES.reports = () => {
  const r = buildReport(UI.rep, UI.repPer);
  const csv = [r.cols, ...r.rows].map(x => x.map(v => /[",;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(",")).join("\n");
  setView(`<div class="row" style="margin-bottom:14px"><select id="rt" aria-label="Report">${Object.entries(REPORTS).map(([k, l]) => `<option value="${k}" ${UI.rep === k ? "selected" : ""}>${l}</option>`).join("")}</select><div class="seg">${[["1d", "Today"], ["7d", "7 days"], ["30d", "30 days"]].map(([k, l]) => `<button data-rp="${k}" class="${UI.repPer === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
  <section class="panel" style="margin-bottom:16px"><div class="hd"><h2>${REPORTS[UI.rep]}</h2><span class="sp"></span><span class="na">${esc(byId(S.orgs, S.orgId).name)} · generated ${fmtDT(S.now)} WIB</span></div><div class="bd"><p>${esc(r.sum)}</p></div>
  <div class="tw"><table><thead><tr>${r.cols.map((c, i) => `<th class="${i > 1 ? "r" : ""}">${c}</th>`).join("")}</tr></thead><tbody>${r.rows.map(x => `<tr>${x.map((v, i) => `<td class="${i > 1 ? "r num" : ""}">${esc(v)}</td>`).join("")}</tr>`).join("") || `<tr><td class="muted" colspan="${r.cols.length}">No records in this period.</td></tr>`}</tbody></table></div></section>
  <section class="panel"><div class="hd"><h2>CSV</h2><span class="na">Copy into a spreadsheet. File download and PDF export are Phase 2 (reporting service).</span></div><div class="bd"><textarea readonly style="min-height:120px;font:12.5px ui-monospace,Menlo,monospace" aria-label="CSV">${esc(csv)}</textarea></div></section>`);
  return { title: "Reports", live: false, after() { $("#rt").onchange = e => { UI.rep = e.target.value; renderAll(); }; document.querySelectorAll("[data-rp]").forEach(b => b.onclick = () => { UI.repPer = b.dataset.rp; renderAll(); }); } };
};

/* ---------- AUDIT ---------- */
ROUTES.audit = () => {
  if (!can("audit")) { setView(`<div class="panel"><div class="bd">Your role can't view the audit log.</div></div>`); return { title: "Audit log" }; }
  const list = S.audit.filter(a => a.org === S.orgId).slice(0, 300);
  setView(`<section class="panel"><div class="hd"><h2>Audit log</h2><span class="sp"></span><span class="na">Append-only. Logins, commands, configuration and threshold changes, acknowledgements, maintenance and asset edits.</span></div><div class="tw"><table><thead><tr><th>Time (WIB)</th><th>Who</th><th>Action</th><th>Asset</th><th>Old value</th><th>New value</th></tr></thead><tbody>
  ${list.map(a => `<tr><td class="num" style="white-space:nowrap">${fmtDT(a.at)}</td><td>${esc(user(a.by)?.name || (a.by === "automation" ? "Automation engine" : "System"))}</td><td>${esc(a.action)}</td><td>${a.asset ? esc(pump(a.asset)?.short) : "—"}</td><td class="small">${esc(a.old ?? "—")}</td><td class="small">${esc(a.new ?? "")}</td></tr>`).join("")}</tbody></table></div></section>`);
  return { title: "Audit log" };
};

/* ---------- SETTINGS ---------- */
export const TH_L = { lowFlowPct: ["Low-flow alert below", "% of expected"], lowFlowClearPct: ["…clears above", "% of expected"], lowFlowMin: ["…after persisting for", "min"], noFlowLpm: ["No-flow threshold", "L/min"], overheatC: ["Overheat alert above", "°C"], overheatClearC: ["…clears below", "°C"], lowSolarPct: ["Low-solar alert below", "% of expected"], lowSolarMin: ["…after persisting for", "min"], wellMarginM: ["Well warning within", "m of minimum safe"], tankHighPct: ["Tank-full notice above", "%"], tankLowPct: ["Tank-low alert below", "%"], commsLossMin: ["Device offline after", "min without data"], cooldownMin: ["Cooldown before re-raising", "min"], escalateMin: ["Escalate unacknowledged critical after", "min"] };
ROUTES.settings = () => {
  const ed = can("configure"), us = S.users.filter(u => u.org === S.orgId), owner = can("users");
  setView(`<div class="grid g2"><section class="panel"><div class="hd"><h2>Alert thresholds</h2><span class="sp"></span>${ed ? `<button class="btn sm pri" id="thsave">Save</button>` : ""}</div><div class="bd"><div class="kv" style="align-items:center">${Object.entries(TH_L).map(([k, [l, u]]) => `<label for="th-${k}" class="small" style="color:var(--ink2)">${l}</label><span><input type="number" id="th-${k}" value="${S.thresholds[k]}" style="width:80px" ${ed ? "" : "disabled"}> <span class="na">${u}</span></span>`).join("")}</div><p class="small muted" style="margin-top:10px">Changes apply immediately and are written to the audit log with old and new values.</p></div></section>
  <div class="stack"><section class="panel"><div class="hd"><h2>Notification channels</h2></div><div class="tw"><table><tbody>${Object.entries(S.channels).map(([k, c]) => `<tr><td><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-chn="${k}" ${c.on ? "checked" : ""} ${ed && k !== "in_app" ? "" : "disabled"}> ${CHANNELS[k].label}</label></td><td>${c.configured ? pill("ok", "Connected") : pill("off", "Provider not configured")}</td></tr>`).join("")}</tbody></table></div><div class="bd small muted">Each channel is a provider adapter behind one interface (send(recipient, message)). Unconfigured channels queue messages in the outbox — you can see exactly what would have been sent.</div></section>
  <section class="panel"><div class="hd"><h2>Users & roles</h2></div><div class="tw"><table><tbody>${us.map(u => `<tr><td><b>${esc(u.name)}</b><div class="na">${esc(u.email)}${u.scope ? " · limited to Site A" : ""}</div></td><td>${owner && u.id !== S.session.userId ? `<select data-role="${u.id}" aria-label="Role for ${esc(u.name)}">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${u.role === k ? "selected" : ""}>${r.label}</option>`).join("")}</select>` : ROLES[u.role].label}</td></tr>`).join("")}</tbody></table></div></section>
  <section class="panel"><div class="hd"><h2>Appearance</h2></div><div class="bd"><div class="seg">${[["", "System"], ["light", "Light"], ["dark", "Dark"]].map(([k, l]) => `<button data-th="${k}" class="${(document.documentElement.dataset.theme || "") === k ? "on" : ""}">${l}</button>`).join("")}</div></div></section></div></div>`);
  return {
    title: "Settings", live: false, after() {
      if ($("#thsave")) $("#thsave").onclick = () => { let n = 0; for (const k in TH_L) { const v = +$("#th-" + k).value; if (!isNaN(v) && v !== S.thresholds[k]) { audit(S.session.userId, "Threshold changed: " + TH_L[k][0], null, S.thresholds[k] + " " + TH_L[k][1], v + " " + TH_L[k][1]); S.thresholds[k] = v; n++; } } toast(n ? `${n} threshold${n > 1 ? "s" : ""} saved.` : "No changes."); };
      document.querySelectorAll("[data-chn]").forEach(c => c.onchange = () => { S.channels[c.dataset.chn].on = c.checked; audit(S.session.userId, "Notification channel " + (c.checked ? "enabled" : "disabled"), null, null, c.dataset.chn); });
      document.querySelectorAll("[data-role]").forEach(s => s.onchange = () => { const u = user(s.dataset.role), o = u.role; u.role = s.value; audit(S.session.userId, "User role changed", null, u.name + ": " + ROLES[o].label, ROLES[u.role].label); toast("Role updated."); });
      document.querySelectorAll("[data-th]").forEach(b => b.onclick = () => { if (b.dataset.th) document.documentElement.dataset.theme = b.dataset.th; else delete document.documentElement.dataset.theme; renderAll(true); });
    },
  };
};

/* ---------- BLUEPRINT ---------- */
ROUTES.blueprint = () => {
  const box = (x, y, w, t, s, c = "var(--brand)") => `<g><rect x="${x}" y="${y}" width="${w}" height="46" rx="6" fill="var(--card)" stroke="${c}" stroke-width="1.5"/><text x="${x + w / 2}" y="${y + 20}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ink)">${t}</text><text x="${x + w / 2}" y="${y + 36}" text-anchor="middle" font-size="11" fill="var(--ink3)">${s}</text></g>`;
  const ar = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--ink3)" stroke-width="1.3" marker-end="url(#ah)"/>`;
  const arch = `<svg viewBox="0 0 980 360" role="img" aria-label="System architecture"><defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 8 4 0 8Z" fill="var(--ink3)"/></marker></defs>
   ${box(10, 20, 150, "ESP32 / PLC / LoRa", "RS485 · Modbus RTU", "var(--off)")}${box(10, 90, 150, "Device buffer", "store & forward, seq no.", "var(--off)")}${box(10, 160, 150, "Gateways", "4G/LTE · Wi-Fi · LoRaWAN", "var(--off)")}
   ${box(200, 90, 150, "Ingestion gateway", "MQTT · HTTP · LNS webhook")}${box(380, 90, 150, "Protocol adapters", "decode → normalized event")}${box(560, 20, 170, "Telemetry processing", "validate · dedupe · flags")}
   ${box(560, 90, 170, "Rules & alert engine", "duration · hysteresis · cooldown")}${box(560, 160, 170, "Diagnostics & health", "baseline · evidence")}${box(780, 20, 190, "Time-series store", "TimescaleDB hypertables", "var(--water)")}${box(780, 90, 190, "Transactional DB", "PostgreSQL + row-level security", "var(--water)")}
   ${box(780, 160, 190, "Notification service", "in-app · email · WA · TG · SMS")}${box(380, 230, 150, "Command service", "authz · queue · ack")}${box(200, 230, 150, "Auth", "users · roles · device creds")}${box(560, 230, 170, "Backend API", "tenant-scoped REST")}${box(780, 230, 190, "Reporting · File storage", "CSV/PDF · S3 photos & docs")}
   ${box(560, 300, 170, "Web app (this UI)", "desktop · tablet · mobile", "var(--sun)")}
   ${ar(160, 43, 200, 105)}${ar(160, 113, 200, 113)}${ar(160, 183, 200, 121)}${ar(350, 113, 380, 113)}${ar(530, 105, 560, 50)}${ar(730, 43, 780, 43)}${ar(645, 66, 645, 90)}${ar(645, 136, 645, 160)}${ar(730, 113, 780, 113)}${ar(730, 183, 780, 183)}${ar(560, 253, 530, 253)}${ar(380, 253, 350, 253)}${ar(455, 230, 280, 136)}${ar(645, 276, 645, 300)}${ar(730, 253, 780, 253)}</svg>`;
  const schema = `-- Transactional (PostgreSQL). Every table carries organization_id; RLS policy:
--   USING (organization_id = current_setting('app.org_id')::uuid)
organizations(id, name, plan, created_at)
users(id, organization_id, name, email, role, site_scope uuid[], password_hash | sso_subject)
sites(id, organization_id, name, lat, lng, elevation_m)
wells(id, organization_id, site_id, name, depth_m, pump_depth_m, static_level_m, expected_dynamic_level_m, min_safe_level_m)
pumps(id, organization_id, site_id, well_id, name, serial, manufacturer, model, installed_on, pump_type,
      rated_power_w, rated_flow_lpm, rated_head_m, rated_voltage_v, rated_current_a, nominal_rpm, expected_pressure_bar)
solar_arrays(id, organization_id, site_id, pump_id, capacity_kwp, panel_count, panel_spec, tilt_deg, azimuth_deg)
pump_controllers(id, organization_id, pump_id, model, firmware, mppt_range)
tanks(id, organization_id, site_id, name, capacity_m3)
pipelines(id, organization_id, site_id, from_well_id, to_tank_id, diameter_mm, length_m)
gateways(id, organization_id, site_id, kind, last_seen_at)
iot_devices(id, organization_id, site_id, pump_id, hardware, adapter, network, firmware, secret_hash, prev_secret_hash,
            prev_valid_until, last_heartbeat_at, last_upload_at, rssi_dbm, battery_v)
sensors(id, organization_id, device_id, metric_key, unit, scale, offset, register_addr, calibrated_on)
alarm_rules(id, organization_id, key, severity, threshold jsonb, duration_s, clear_threshold jsonb, cooldown_s, channels text[], escalate_after_s)
alarms(id, organization_id, pump_id, rule_key, severity, state, raised_at, cleared_at, ack_by, ack_at, occurrences, evidence jsonb, escalated)
incidents(id, organization_id, pump_id, alarm_id, title, severity, status, assignee_id, diagnosis, resolution, cost_idr, detected_at)
incident_events(id, incident_id, at, user_id, text)
maintenance_tasks(id, organization_id, pump_id, trigger, title, due_at, assignee_id, status, checklist jsonb)
maintenance_records(id, organization_id, pump_id, task_id, performed_at, technician_id, parts jsonb, labor_h, labor_cost_idr, notes)
asset_documents(id, organization_id, asset_type, asset_id, kind, storage_key, uploaded_by)   -- photos, manuals, warranties
commands(id, organization_id, pump_id, command, reason, issued_by, issued_at, status, acked_at, executed_at, expires_at)
schedules(id, organization_id, pump_id, windows jsonb, timezone)
automations(id, organization_id, name, conditions jsonb, action, release jsonb, scope uuid[], enabled)
notifications(id, organization_id, user_id, severity, text, pump_id, read_at, created_at)
notification_outbox(id, organization_id, channel, recipient, payload, status, attempts, sent_at)
audit_log(id, organization_id, actor, action, entity, entity_id, old_value jsonb, new_value jsonb, at)  -- append-only

-- Time-series (TimescaleDB)
telemetry(time timestamptz, organization_id, pump_id, device_id, seq bigint, metric text, value double precision, quality smallint)
  PRIMARY KEY (pump_id, metric, time);  UNIQUE (device_id, seq, metric)   -- idempotent re-uploads
  hypertable chunk 1 day · compression after 7 days · retention: raw 13 months
telemetry_1m, telemetry_15m, telemetry_1d   -- continuous aggregates (avg/min/max/sum) for charts and fleet KPIs
pump_state_changes(time, pump_id, state, reason, fault_code)`;
  const contract = JSON.stringify({ organization_id: "ORG-ASL", site_id: "S-A", asset_id: "PUMP-07", device_id: "DEV-07", timestamp: "2026-10-05T04:20:00Z", seq: 48213, metrics: { pv_voltage: 312, pv_current: 7.4, pv_power: 2308, pump_power: 1842, flow_lpm: 42.8, well_level_m: 27.4 }, pump_state: "running", fault_code: null, quality: ["late_arrival"], received_at: "2026-10-05T07:31:12Z" }, null, 2);
  const mv = [["Phase 1", [["Authentication", "demo"], ["Multi-tenant organization", "built"], ["Site management", "built"], ["Pump / well assets", "built"], ["Device registration & credentials", "built"], ["Telemetry ingestion + adapters", "built"], ["Fleet dashboard", "built"], ["Pump detail page", "built"], ["Charts", "built"], ["Alarm engine", "built"], ["Notifications", "partial"]]], ["Phase 2", [["Map", "partial"], ["Maintenance", "built"], ["Incident management", "built"], ["Remote commands", "built"], ["Scheduling", "built"], ["Water production analytics", "built"], ["Solar efficiency analytics", "built"]]], ["Phase 3", [["Well recovery analytics", "built"], ["Performance baseline", "built"], ["Rule-based diagnostics", "built"], ["Predictive maintenance", "not yet"], ["Advanced reporting (PDF, scheduled)", "not yet"], ["Automated recommendations", "partial"]]]];
  const stc = { built: "ok", partial: "warn", demo: "warn", "not yet": "off" }, stl = { built: "Working in prototype", partial: "Partly", demo: "Demo sign-in only", "not yet": "Not yet" };
  setView(`<p class="lead-sum" style="margin-bottom:6px">What's real here, and what production needs.</p><p class="muted" style="margin-bottom:16px">This page is a single-file prototype. The engines — ingestion with per-device credentials and de-duplication, baseline, diagnostics, health score, alert rules, automation, command queue, audit — are real code running in your browser against a simulated field. The backend services, databases and provider integrations below are designed but not deployed.</p>
  <section class="panel" style="margin-bottom:16px"><div class="hd"><h2>System architecture</h2><span class="na">services are separate; hardware and notification providers sit behind adapters</span></div><div class="bd tw">${arch}</div></section>
  <div class="grid g2" style="margin-bottom:16px"><section class="panel"><div class="hd"><h2>MVP status</h2></div><div class="bd">${mv.map(([ph, it]) => `<h3 style="margin:8px 0 4px">${ph}</h3><table><tbody>${it.map(([n, s]) => `<tr><td>${n}</td><td class="r">${pill(stc[s], stl[s])}</td></tr>`).join("")}</tbody></table>`).join("")}</div></section>
  <section class="panel"><div class="hd"><h2>IoT telemetry contract</h2></div><div class="bd"><p class="small">Devices send in their native format; adapters normalize to this. Devices keep a ring buffer while offline and on reconnect: authenticate → upload oldest-first with original timestamps and sequence numbers → server de-duplicates on (device_id, seq) → server returns the highest contiguous seq acknowledged → device frees that part of its buffer.</p><pre class="code">${esc(contract)}</pre>
  <p class="small" style="margin-top:8px">Quality flags: <b>late_arrival</b>, <b>out_of_range:&lt;metric&gt;</b> (value dropped, not stored), <b>estimated</b>. Missing keys mean "no sensor" — never zero.</p></div></section></div>
  <section class="panel"><div class="hd"><h2>Database schema</h2><span class="na">PostgreSQL + TimescaleDB</span></div><div class="bd"><pre class="code">${esc(schema)}</pre></div></section>`);
  return { title: "System blueprint", live: false };
};

/* ---------- demo lab + notifications drawers ---------- */
export const SCEN = { normal: "Normal operation", lowflow: "Low flow (restriction)", dryrun: "Dry run (weak well)", lowsolar: "Low solar (dirty panels)", hot: "Overheating controller", offline: "IoT device offline", declining: "Declining well level" };
export function openLab() {
  const ps = myPumps();
  $("#drawer").innerHTML = `<div class="drawer" role="dialog" aria-label="Demo scenarios"><div class="hd"><h2>Demo scenarios</h2><span style="flex:1"></span><button class="btn sm" id="dcl">Close</button></div><div class="bd">
   <p class="small">Everything on screen comes from a simulated field: sun, wells, pumps, tanks and IoT devices, encoded per device protocol and sent through the same ingestion, alert and diagnostic code a real deployment uses. Inject a condition and watch the product respond (use 10× to speed things up).</p>
   <table><tbody>${ps.map(p => `<tr><td><b>${esc(p.short)}</b><div class="na">now: ${esc(SIM[p.id].labScen ? SCEN[SIM[p.id].labScen] : { normal: "normal", lowflow: "low flow (built-in)", dryrun: "dry run (built-in)", lowsolar_hot: "low solar + hot (built-in)", offline_declining: "offline + declining (built-in)" }[SIM[p.id].scen])}</div></td><td><select data-scn="${p.id}" aria-label="Scenario for ${esc(p.short)}"><option value="">Inject…</option>${Object.entries(SCEN).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table>
   ${ps.some(p => dev(p).online === false) ? `<button class="btn pri" id="restore" style="margin-top:12px">Restore connectivity for offline devices</button><p class="small muted">The device uploads its buffered readings with their original timestamps; the server drops the re-sent duplicates.</p>` : ""}
   <h3 style="margin:16px 0 6px">Jump ahead</h3><div class="row"><button class="btn sm" data-jump="60">+1 hour</button><button class="btn sm" data-jump="240">+4 hours</button></div></div></div>`;
  $("#dcl").onclick = () => $("#drawer").innerHTML = "";
  document.querySelectorAll("[data-scn]").forEach(s => s.onchange = () => { const k = s.value; if (!k) return; injectScenario(pump(s.dataset.scn), k); openLab(); renderAll(true); });
  if ($("#restore")) $("#restore").onclick = () => { for (const p of ps) { SIM[p.id].restored = true; SIM[p.id].forceOffline = false; } toast("Connectivity restored — devices will upload their buffers on the next reading."); openLab(); };
  document.querySelectorAll("[data-jump]").forEach(b => b.onclick = () => { const n = +b.dataset.jump; for (let i = 0; i < n; i++) tick1(); renderAll(true); toast(`Advanced ${n / 60} h.`); });
}
export function injectScenario(p, k) {
  const s = SIM[p.id], base = { hyd: 1, soil: 1, hot: 0, staticAdd: 0, tauMul: 1 }; s.labScen = k; s.scen = "normal"; s.forceOffline = false; s.restored = true; s.dd = s.dd0 ?? s.dd; s.dd0 = s.dd;
  if (k === "lowflow") base.hyd = 0.62; if (k === "lowsolar") base.soil = 0.6; if (k === "hot") base.hot = 1; if (k === "declining") { base.staticAdd = 3.5; base.tauMul = 1.4; }
  if (k === "dryrun") s.dd = (well(p).pumpDepth - well(p).static - 0.3) / (p.Q * 0.75);
  if (k === "offline") s.forceOffline = true;
  s.injected = base; audit(S.session.userId, "Demo scenario injected", p.id, null, SCEN[k]);
}
export function openBell() {
  const ns = scoped(S.notifications).filter(n => n.toRole === "all" || n.toRole === S.session.role || S.session.role === "owner" || (n.toRole === "ops" && S.session.role === "ops")).slice(0, 40), ob = S.outbox.filter(o => o.org === S.orgId).slice(0, 8);
  $("#drawer").innerHTML = `<div class="drawer" role="dialog" aria-label="Notifications"><div class="hd"><h2>Notifications</h2><span style="flex:1"></span><button class="btn sm" id="nread">Mark all read</button> <button class="btn sm" id="dcl">Close</button></div><div class="bd">
  ${ns.map(n => `<div style="padding:8px 0;border-bottom:1px solid var(--line2);${n.read ? "opacity:.6" : ""}"><div class="row">${sev(n.sev)}<span class="na">${fmtDT(n.at)}</span></div><div style="margin-top:3px">${n.pump ? `<a href="#/pump/${n.pump}">${esc(n.text)}</a>` : esc(n.text)}</div></div>`).join("") || `<p class="muted">Nothing yet.</p>`}
  <h3 style="margin:16px 0 6px">Outbox — other channels</h3>${ob.map(o => `<div class="small" style="padding:4px 0"><b>${CHANNELS[o.channel].label}</b> · ${fmtTime(o.at)} · ${esc(o.status)}<div class="na">${esc(o.text)}</div></div>`).join("") || `<p class="small muted">Empty.</p>`}</div></div>`;
  $("#dcl").onclick = () => $("#drawer").innerHTML = "";
  $("#nread").onclick = () => { ns.forEach(n => n.read = true); openBell(); renderTop($(".top h1").textContent); };
  $("#drawer").querySelectorAll("a").forEach(a => a.addEventListener("click", () => $("#drawer").innerHTML = ""));
}

DRAWER.lab = openLab; DRAWER.bell = openBell; // wired by ui1's top bar (ui1 must not import ui4)

/* ---------- main loop ---------- */
export let lastMaint = 0;
export function tick1() { S.now += MIN; stepWorld(1, "live"); if (S.now - lastMaint >= H) { autoMaint(); lastMaint = S.now; } }
setInterval(() => {
  if (!S.ready || S.paused) return;
  for (let i = 0; i < S.speed; i++) tick1();
  if (!S.session) return;
  updateClock();
  const ae = document.activeElement, typing = ae && /INPUT|SELECT|TEXTAREA/.test(ae.tagName) && $("#view")?.contains(ae);
  if (VIEW.live && !modalOpen() && !typing) renderAll(true);
  else { renderShell(); }
}, 2000);

/* ---------- boot: backfill 30 days of simulated history ---------- */
export function boot() {
  seedEntities();
  const t0 = START - 30 * D; let i = 0;
  for (S.now = t0; S.now < START; S.now += 10 * MIN, i++) {
    stepWorld(10, "seed");
    if (i === 6 * 144) S.pumps.forEach(learnBaseline);
    if (i > 6 * 144 && i % 36 === 0) autoMaintSeed();
  }
  S.now = START; lastMaint = S.now;
  seedHistory(); autoMaint();
  S.notifications.forEach(n => { if (n.at < S.now - 6 * H) n.read = true; });
  S.ready = true;
}
export function autoMaintSeed() { /* during backfill only create calendar tasks; condition tasks are created at the end so their dates look natural */ }
export function seedHistory() {
  const P = id => pump(id), d = n => S.now - n * D;
  S.records.push(
    { id: uid("MR"), org: "ORG-ASL", pump: "PUMP-01", date: P("PUMP-01").maint.last, tech: "U3", work: "Scheduled 90-day service", parts: [{ name: "Cable gland", qty: 2, cost: 35000 }], laborH: 3, laborCost: 225000, notes: "Cleaned panels, retightened terminals. Flow 94 L/min at 11:00.", photos: [], cost: 295000 },
    { id: uid("MR"), org: "ORG-ASL", pump: "PUMP-04", date: P("PUMP-04").maint.last, tech: "U4", work: "Scheduled 90-day service", parts: [], laborH: 2.5, laborCost: 187500, notes: "All normal.", photos: [], cost: 187500 },
    { id: uid("MR"), org: "ORG-ASL", pump: "PUMP-02", date: P("PUMP-02").maint.last, tech: "U3", work: "Scheduled 90-day service", parts: [{ name: "Pressure gauge", qty: 1, cost: 140000 }], laborH: 2, laborCost: 150000, notes: "", photos: [], cost: 290000 },
    { id: uid("MR"), org: "ORG-ASL", pump: "PUMP-03", date: d(140), tech: "U4", work: "Replaced surge protector after lightning storm", parts: [{ name: "DC surge protection device", qty: 1, cost: 420000 }], laborH: 2, laborCost: 150000, notes: "", photos: [], cost: 570000 },
    { id: uid("MR"), org: "ORG-ASL", pump: "PUMP-05", date: P("PUMP-05").maint.last, tech: "U3", work: "Scheduled 90-day service", parts: [], laborH: 2, laborCost: 150000, notes: "", photos: [], cost: 150000 },
  );
  S.docs.push({ pump: "PUMP-01", type: "Manual", name: "Lorentz PS2-4000 manual.pdf" }, { pump: "PUMP-01", type: "Warranty", name: "Warranty certificate LZ-2204-88123.pdf" }, { pump: "PUMP-03", type: "Drilling log", name: "Well 03 drilling & pump test 2023.pdf" });
  const dryA = S.alarms.filter(a => a.pump === "PUMP-03" && a.rule === "dry_run" && a.raisedAt < S.now - 1.5 * D)[0];
  if (dryA) { const i = makeIncident(dryA, true); i.status = "In Progress"; i.assignee = "U3"; i.actions.push({ at: dryA.raisedAt + 20 * MIN, by: "U2", text: "Status Open → Acknowledged" }, { at: dryA.raisedAt + 45 * MIN, by: "U2", text: "Assigned to Budi Santoso" }, { at: dryA.raisedAt + 26 * H, by: "U3", text: "Dip-meter reading 39.4 m at 12:10 — confirms level sensor. Well is being over-pumped at midday." }); i.diagnosis = "Pumping rate higher than the well's sustainable yield around midday."; }
  for (const id of ["PUMP-02", "PUMP-04", "PUMP-03"]) { }
  const c = { id: uid("CMD"), org: "ORG-ASL", pump: "PUMP-02", cmd: "stop", reason: "Tank A1 inlet valve replacement", by: "U2", at: d(4) + 2 * H, status: "executed", log: [[d(4) + 2 * H, "Queued"], [d(4) + 2 * H + MIN, "Delivered and acknowledged by DEV-02"], [d(4) + 2 * H + MIN, "Executed by controller"]] };
  const c2 = { id: uid("CMD"), org: "ORG-ASL", pump: "PUMP-02", cmd: "auto", reason: "Valve work done", by: "U2", at: d(4) + 4 * H, status: "executed", log: [[d(4) + 4 * H, "Queued"], [d(4) + 4 * H + MIN, "Delivered and acknowledged by DEV-02"], [d(4) + 4 * H + MIN, "Executed by controller"]] };
  S.commands.push(c2, c);
  S.audit.push({ id: uid("AUD"), org: "ORG-ASL", by: "U2", action: "Pump command: stop", asset: "PUMP-02", old: null, new: "Reason: Tank A1 inlet valve replacement", at: c.at }, { id: uid("AUD"), org: "ORG-ASL", by: "U1", action: "Threshold changed: Low-flow alert below", asset: null, old: "70 % of expected", new: "75 % of expected", at: d(12) });
  S.audit.sort((a, b) => b.at - a.at);
  // tasks: create diagnostic tasks dated a few days back, assign some
  autoMaint();
  for (const t of S.tasks) { t.created = S.now - (1 + (hash(t.id) % 3)) * D; if (t.key === "lowflow") { t.assignee = "U3"; t.status = "Assigned"; } if (t.key === "dry") { t.assignee = "U3"; t.status = "In progress"; t.checklist[0][1] = true; } if (t.key === "solar") { t.assignee = "U4"; t.status = "Assigned"; } }
}
