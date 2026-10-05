"use strict";
/* ============================================================
   SolPump — core: domain store, device simulator, ingestion,
   baseline, diagnostics, health, alert, automation, commands.
   Everything here runs in the browser in DEMO MODE. In production
   each section maps to a separate service (see Blueprint page).
   ============================================================ */
export const MIN = 6e4, H = 36e5, D = 864e5, TZ = 7 * H; // WIB (UTC+7)
export const lh = t => ((((t + TZ) % D) + D) % D) / H;
export const dk = t => Math.floor((t + TZ) / D);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const r1 = v => Math.round(v * 10) / 10;
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const hash = (...xs) => xs.reduce((h, x) => Math.imul(h ^ (typeof x === "number" ? x : [...String(x)].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)), 2654435761) >>> 0, 2166136261);
export const fnv = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, "0"); };
export let _id = 1000; export const uid = p => p + "-" + (++_id);

/* ---------- clock: demo starts today at 11:20 WIB ---------- */
export const realNow = Date.now();
export const START = Math.floor((realNow + TZ) / D) * D - TZ + 11 * H + 20 * MIN;
export const S = {
  now: START - 30 * D, speed: 1, paused: false,
  session: null, orgId: null,
  orgs: [], users: [], sites: [], wells: [], pumps: [], arrays: [], controllers: [], devices: [], gateways: [],
  tanks: [], pipelines: [], alarms: [], incidents: [], tasks: [], records: [], commands: [], schedules: [],
  automations: [], notifications: [], outbox: [], audit: [], docs: [], ingestLog: [],
  thresholds: { lowFlowPct: 75, lowFlowClearPct: 85, lowFlowMin: 30, noFlowLpm: 2, overheatC: 70, overheatClearC: 64, lowSolarPct: 75, lowSolarMin: 60, commsLossMin: 15, tankHighPct: 95, tankLowPct: 20, wellMarginM: 2, cooldownMin: 60, escalateMin: 15 },
  channels: { in_app: { on: true, configured: true }, email: { on: true, configured: false }, whatsapp: { on: true, configured: false }, telegram: { on: false, configured: false }, sms: { on: false, configured: false } },
};
export const TS = {};          // time-series store: assetId -> [{t,dt,m,s,f,q,src}]
export const SEEN = new Set(); // dedupe keys device:seq
export const SIM = {};         // physical simulator state per pump (stands in for the real world)

/* ---------- tenants, users, roles ---------- */
export const ROLES = {
  owner: { label: "Owner / Administrator", can: ["view", "command", "ack", "configure", "maintain", "users", "reports", "audit"] },
  ops: { label: "Operations Manager", can: ["view", "command", "ack", "configure", "maintain", "reports", "audit"] },
  tech: { label: "Field Technician", can: ["view", "ack", "maintain"] },
  viewer: { label: "Viewer", can: ["view"] },
};
export const can = a => !!S.session && ROLES[S.session.role].can.includes(a);

export function seedEntities() {
  S.orgs.push({ id: "ORG-ASL", name: "Yayasan Assalaam", short: "Assalaam" }, { id: "ORG-TM", name: "Koperasi Tirta Makmur", short: "Tirta Makmur" });
  S.users.push(
    { id: "U1", org: "ORG-ASL", name: "Ahmad Fauzi", role: "owner", email: "ahmad@assalaam.example" },
    { id: "U2", org: "ORG-ASL", name: "Siti Rahmawati", role: "ops", email: "siti@assalaam.example" },
    { id: "U3", org: "ORG-ASL", name: "Budi Santoso", role: "tech", email: "budi@assalaam.example" },
    { id: "U4", org: "ORG-ASL", name: "Rizal Hakim", role: "tech", email: "rizal@assalaam.example" },
    { id: "U5", org: "ORG-ASL", name: "Dewi Lestari", role: "viewer", email: "dewi@assalaam.example", scope: ["S-A"] },
    { id: "U6", org: "ORG-TM", name: "Hendra Wijaya", role: "owner", email: "hendra@tirtamakmur.example" },
  );
  S.sites.push(
    { id: "S-A", org: "ORG-ASL", name: "Site A — Main campus", lat: -7.5551, lng: 110.7642, elev: 112, irr: true },
    { id: "S-B", org: "ORG-ASL", name: "Site B — Agricultural estate", lat: -7.5712, lng: 110.7818, elev: 104, irr: true },
    { id: "S-T", org: "ORG-TM", name: "Tirtomulyo village", lat: -7.6420, lng: 110.8210, elev: 131, irr: false },
  );
  S.tanks.push(
    { id: "TK-A1", org: "ORG-ASL", site: "S-A", name: "Tower tank A1", cap: 60, demand: 0.7 },
    { id: "TK-A2", org: "ORG-ASL", site: "S-A", name: "Dormitory tank A2", cap: 25, demand: 0.22 },
    { id: "TK-B1", org: "ORG-ASL", site: "S-B", name: "Irrigation reservoir B1", cap: 80, demand: 0.72 },
    { id: "TK-T1", org: "ORG-TM", site: "S-T", name: "Village reservoir", cap: 50, demand: 0.75 },
  );
  const P = (o) => {
    const id = o.id, n = o.n;
    S.wells.push({ id: "W-" + n, org: o.org, site: o.site, name: "Well #" + n, depth: o.wd, pumpDepth: o.pd, static: o.st, expDyn: r1(o.st + o.dd * o.Q * 0.85), minSafe: o.ms, drilled: o.drilled || "2021-08-14" });
    S.arrays.push({ id: "PV-" + n, org: o.org, site: o.site, kw: o.kw, panels: Math.round(o.kw * 1000 / 550), panelSpec: "550 Wp mono PERC, Voc 49.6 V", tilt: 10, azimuth: 0 });
    S.controllers.push({ id: "CTL-" + n, org: o.org, model: o.ctl, mppt: "Integrated MPPT, 150–430 VDC", fw: o.cfw || "3.4.1" });
    S.devices.push({ id: "DEV-" + n, org: o.org, site: o.site, asset: id, hw: o.hw, adapter: o.ad, net: o.net, sim: o.net.includes("LTE") ? "Telkomsel IoT, ICCID •••• " + (4410 + +n) : "—", fw: o.fw || "1.8.2", secretHash: "", fp: "", rotatedAt: null, rssi: o.rssi ?? -84, battery: 12.9, uptimeH: 0, lastHeartbeat: 0, lastUpload: 0, sent: 0, lost: 0, buffered: 0, online: true });
    S.pipelines.push({ id: "PL-" + n, org: o.org, site: o.site, from: "W-" + n, to: o.tank, dia: o.pipe || 50, len: o.len || 240 });
    S.pumps.push({
      id, org: o.org, site: o.site, well: "W-" + n, array: "PV-" + n, ctl: "CTL-" + n, dev: "DEV-" + n, tank: o.tank, pipeline: "PL-" + n,
      name: "Well #" + n + " pump", short: "Well #" + n, serial: o.sn, mfr: o.mfr, model: o.model, installed: o.inst,
      lat: o.lat, lng: o.lng, elev: o.elev, type: o.type, P: o.P, Q: o.Q, Hd: o.Hd, V: o.V, I: r1(o.P / o.V * 1.05), rpm: o.rpm,
      expPressure: o.pr || 2.2, sensors: o.sensors, warranty: o.war, maint: { last: o.ml, intervalDays: o.mi || 90 },
    });
    SIM[id] = { lvl: o.st, run: false, reason: "", state: "stopped", fault: null, faultUntil: 0, mt: 27, ct: 28, mode: "auto", override: null, scen: o.scen, dd: o.dd, tau: o.tau, soil0: 1, seq: Math.floor(Math.random() * 5000), buffer: [], lowSince: null, dryTrips: 0, rng: mulberry(hash(id)), inhibit: {}, latched: {}, lastPV: 0, lastP: 0, lastQ: 0, lastIrr: 0, lastPr: 0, pending: [] };
  };
  const all = ["pv_voltage", "pv_current", "pv_power", "pump_voltage", "pump_current", "pump_power", "flow_lpm", "pressure_bar", "well_level_m", "tank_level_pct", "motor_temp_c", "ctrl_temp_c", "irradiance_wm2", "rpm"];
  const without = (...k) => all.filter(x => !k.includes(x));
  P({ id: "PUMP-01", n: "01", org: "ORG-ASL", site: "S-A", tank: "TK-A1", lat: -7.5543, lng: 110.7628, elev: 113, wd: 90, pd: 62, st: 18.2, ms: 50, dd: 0.17, tau: 38, kw: 3.3, P: 2200, Q: 95, Hd: 75, V: 310, rpm: 3000, type: "Submersible centrifugal (multistage)", ctl: "Lorentz PSk3-5", mfr: "Lorentz", model: "PS2-4000 C-SJ8-15", sn: "LZ-2204-88123", inst: "2022-03-10", war: "2027-03-10", ml: -41, hw: "ESP32-S3 + RS485", ad: "mqtt-json", net: "4G/LTE (MQTT)", rssi: -104, sensors: without("motor_temp_c"), scen: "normal" });
  P({ id: "PUMP-02", n: "02", org: "ORG-ASL", site: "S-A", tank: "TK-A1", lat: -7.5566, lng: 110.7661, elev: 111, wd: 70, pd: 48, st: 15.6, ms: 40, dd: 0.16, tau: 35, kw: 2.4, P: 1500, Q: 70, Hd: 65, V: 300, rpm: 2900, type: "Submersible centrifugal (multistage)", ctl: "Grundfos CU 200", mfr: "Grundfos", model: "SQFlex 5A-7", sn: "GF-SQF-55410", inst: "2022-03-12", war: "2026-03-12", ml: -60, hw: "Siemens S7-1200 PLC via Modbus gateway", ad: "modbus-rtu", net: "4G/LTE (HTTP)", sensors: all, scen: "lowflow" });
  P({ id: "PUMP-03", n: "03", org: "ORG-ASL", site: "S-A", tank: "TK-A2", lat: -7.5528, lng: 110.7671, elev: 115, wd: 48, pd: 40, st: 22.0, ms: 39.5, dd: 0.37, tau: 55, kw: 1.8, P: 1100, Q: 55, Hd: 55, V: 220, rpm: 2850, type: "Helical rotor (positive displacement)", ctl: "Lorentz PSk3-3", mfr: "Lorentz", model: "PS2-1800 HR-14", sn: "LZ-1803-77302", inst: "2023-07-01", war: "2028-07-01", ml: -102, mi: 90, hw: "ESP32 + RS485", ad: "mqtt-json", net: "Wi-Fi (MQTT)", rssi: -71, sensors: all, scen: "dryrun" });
  P({ id: "PUMP-04", n: "04", org: "ORG-ASL", site: "S-B", tank: "TK-B1", lat: -7.5701, lng: 110.7796, elev: 103, wd: 100, pd: 70, st: 20.4, ms: 60, dd: 0.13, tau: 40, kw: 4.5, P: 3000, Q: 120, Hd: 80, V: 380, rpm: 2900, type: "Submersible centrifugal (multistage)", ctl: "Franklin SubDrive Solar", mfr: "Franklin Electric", model: "SolarPAK 4400", sn: "FE-SP4-20391", inst: "2024-01-20", war: "2029-01-20", ml: -35, hw: "LoRaWAN node (RS485)", ad: "lorawan", net: "LoRaWAN → gateway (4G)", rssi: -112, sensors: without("well_level_m", "rpm"), scen: "lowsolar_hot" });
  P({ id: "PUMP-05", n: "05", org: "ORG-ASL", site: "S-B", tank: "TK-B1", lat: -7.5730, lng: 110.7840, elev: 105, wd: 95, pd: 66, st: 23.0, ms: 56, dd: 0.15, tau: 50, kw: 3.3, P: 2200, Q: 90, Hd: 75, V: 310, rpm: 3000, type: "Submersible centrifugal (multistage)", ctl: "Lorentz PSk3-5", mfr: "Lorentz", model: "PS2-4000 C-SJ8-15", sn: "LZ-2204-90551", inst: "2024-01-22", war: "2029-01-22", ml: -70, mi: 90, hw: "ESP32-S3 + RS485", ad: "mqtt-json", net: "4G/LTE (MQTT)", rssi: -95, sensors: without("pressure_bar"), scen: "offline_declining" });
  P({ id: "PUMP-T1", n: "T1", org: "ORG-TM", site: "S-T", tank: "TK-T1", lat: -7.6412, lng: 110.8195, elev: 132, wd: 80, pd: 55, st: 19.5, ms: 46, dd: 0.17, tau: 40, kw: 2.4, P: 1500, Q: 70, Hd: 60, V: 300, rpm: 2900, type: "Submersible centrifugal (multistage)", ctl: "Grundfos CU 200", mfr: "Grundfos", model: "SQFlex 5A-7", sn: "GF-SQF-61002", inst: "2025-05-02", war: "2030-05-02", ml: -20, hw: "ESP32 + RS485", ad: "mqtt-json", net: "4G/LTE (MQTT)", sensors: without("irradiance_wm2", "motor_temp_c", "pressure_bar"), scen: "normal" });
  P({ id: "PUMP-T2", n: "T2", org: "ORG-TM", site: "S-T", tank: "TK-T1", lat: -7.6431, lng: 110.8226, elev: 130, wd: 75, pd: 52, st: 21.0, ms: 44, dd: 0.18, tau: 42, kw: 2.4, P: 1500, Q: 70, Hd: 60, V: 300, rpm: 2900, type: "Submersible centrifugal (multistage)", ctl: "Grundfos CU 200", mfr: "Grundfos", model: "SQFlex 5A-7", sn: "GF-SQF-61003", inst: "2025-05-02", war: "2030-05-02", ml: -20, hw: "ESP32 + RS485", ad: "mqtt-json", net: "4G/LTE (MQTT)", sensors: without("irradiance_wm2", "motor_temp_c", "pressure_bar", "well_level_m"), scen: "normal" });

  for (const p of S.pumps) {
    p.maint.last = START + p.maint.last * D;
    p.maint.next = p.maint.last + p.maint.intervalDays * D;
    const d = dev(p); const sec = "sk_" + fnv(p.id + "secret" + realNow) + fnv(p.serial);
    d.secretHash = fnv(sec); d.fp = d.secretHash.slice(0, 4) + "…" + d.secretHash.slice(-4); SIM[p.id].secret = sec;
    TS[p.id] = [];
  }
  const sch = (pump, w) => S.schedules.push({ id: uid("SCH"), org: org(pump).id, pump, windows: w, respect: ["Well protection", "Tank level", "Solar availability", "Fault state", "Manual override"] });
  sch("PUMP-01", [["06:00", "17:30"]]); sch("PUMP-02", [["06:00", "17:30"]]); sch("PUMP-03", [["06:30", "17:00"]]);
  sch("PUMP-04", [["06:00", "17:30"]]); sch("PUMP-05", [["06:00", "17:30"]]); sch("PUMP-T1", [["06:30", "16:30"]]); sch("PUMP-T2", [["06:30", "16:30"]]);
  const A = (o) => S.automations.push(Object.assign({ id: uid("AUT"), enabled: true, fired: 0, createdBy: "System template" }, o));
  for (const og of ["ORG-ASL", "ORG-TM"]) {
    A({ org: og, name: "Stop when the tank is nearly full", when: [{ m: "tank_level_pct", op: ">", v: 90 }], then: "stop", release: { m: "tank_level_pct", op: "<", v: 80 }, scope: "all" });
    A({ org: og, name: "Start when the tank is low and the sun is strong", when: [{ m: "tank_level_pct", op: "<", v: 30 }, { m: "pv_power", op: ">", v: 1500 }], then: "start", scope: "all" });
    A({ org: og, name: "Protect the well: stop below minimum safe level", when: [{ m: "well_margin_m", op: "<", v: 0 }], then: "stop", release: { m: "well_margin_m", op: ">", v: 3 }, scope: "all" });
    A({ org: og, name: "Stop on sustained low flow and raise a critical alert", when: [{ m: "flow_lpm", op: "<", v: 10, for: 5 }, { m: "pump_power_pct", op: ">", v: 50 }], then: "stop_alert", releaseAfter: 30, scope: "all" });
    A({ org: og, name: "Notify the operations manager on any pump fault", when: [{ m: "fault", op: "=", v: "any" }], then: "notify_ops", scope: "all" });
  }
}
export const byId = (arr, id) => arr.find(x => x.id === id);
export const pump = id => byId(S.pumps, id);
export const site = id => byId(S.sites, id);
export const well = p => byId(S.wells, p.well);
export const dev = p => byId(S.devices, p.dev);
export const arr = p => byId(S.arrays, p.array);
export const ctl = p => byId(S.controllers, p.ctl);
export const tank = p => byId(S.tanks, p.tank);
export const org = p => byId(S.orgs, (typeof p === "string" ? pump(p) : p).org);
export const user = id => byId(S.users, id);
export const has = (p, k) => p.sensors.includes(k);

/* tenant isolation: every read used by the UI goes through scoped() */
export function scoped(list) {
  const s = S.session; if (!s) return [];
  return list.filter(x => {
    if (x.org !== S.orgId) return false;
    const u = user(s.userId); if (u.scope) { const st = x.site || (x.pump && pump(x.pump)?.site) || (x.asset && pump(x.asset)?.site); if (st && !u.scope.includes(st)) return false; }
    return true;
  });
}
export const myPumps = () => scoped(S.pumps);

/* ---------- environment ---------- */
export function irradiance(t, siteId) {
  const h = lh(t); if (h < 5.9 || h > 18.1) return 0;
  let c = Math.pow(Math.max(0, Math.sin(Math.PI * (h - 5.9) / 12.2)), 1.2) * 990;
  const r = mulberry(hash(dk(t), siteId)); const cloud = 0.1 + 0.4 * r(); const storm = r() < 0.25;
  const aft = h > 12.5 ? cloud * Math.min(1, (h - 12.5) / 3) * (storm ? 1.5 : 1) : cloud * 0.25;
  const flick = 0.93 + 0.07 * Math.sin(t / 4.1e5 + hash(siteId) % 7) * Math.sin(t / 1.3e6);
  return Math.max(0, c * (1 - Math.min(0.85, aft)) * flick);
}
export function demand(t) { // pesantren water use: ablutions before prayers, meals, evening bathing
  const h = lh(t), win = (a, b) => h >= a && h < b;
  let q = 0.018;
  if (win(3.9, 5.2)) q += 0.09; if (win(5.2, 6.8)) q += 0.13; if (win(11.4, 12.4)) q += 0.08; if (win(14.6, 15.4)) q += 0.06; if (win(16.6, 18.4)) q += 0.11; if (win(19.6, 20.3)) q += 0.04;
  return q; // m³/min at demand factor 1
}

/* ---------- physical pump + well model (the "field") ---------- */
export const tankLvl = {}; // m³
export function scenarioFactors(p, t) {
  const s = SIM[p.id], age = (t - (START - 30 * D)) / D; // 0..30+
  const f = { hyd: 1, soil: 1, hot: 0, staticAdd: 0, tauMul: 1 };
  const sc = s.scen;
  if (sc === "lowflow") f.hyd = age < 14 ? 1 : 1 - Math.min(0.33, (age - 14) * 0.021);
  if (sc === "lowsolar_hot" || sc === "lowsolar") f.soil = age < 9 ? 0.98 : 0.98 - Math.min(0.37, (age - 9) * 0.018);
  if (sc === "lowsolar_hot" || sc === "hot") f.hot = 1;
  if (sc === "offline_declining" || sc === "declining") { f.staticAdd = age * 0.095; f.tauMul = 1 + age * 0.012; }
  if (s.injected) Object.assign(f, s.injected);
  return f;
}
export function inSchedule(p, t) {
  const sc = S.schedules.find(x => x.pump === p.id); if (!sc) return { ok: true, txt: "" };
  const h = lh(t), toH = x => +x.slice(0, 2) + x.slice(3) / 60;
  const ok = sc.windows.some(([a, b]) => h >= toH(a) && h < toH(b));
  return { ok, txt: sc.windows.map(w => w.join("–")).join(", ") };
}
export function stepPump(p, t, dt) {
  const s = SIM[p.id], w = well(p), f = scenarioFactors(p, t), tk = tank(p);
  const G = irradiance(t, p.site), pvAvail = arr(p).kw * 1000 * G / 1000 * 0.82 * f.soil;
  const staticNow = w.static + f.staticAdd; s.staticNow = staticNow;
  // ---- controller decision (field logic + cloud automations/commands delivered earlier) ----
  let run = false, reason = "", state = "stopped";
  const sched = inSchedule(p, t);
  if (s.fault && t < s.faultUntil) { state = "faulted"; reason = FAULTS[s.fault].stopTxt + " Automatic restart at " + fmtTime(s.faultUntil) + "."; }
  else {
    if (s.fault && t >= s.faultUntil) { s.fault = null; }
    const inh = Object.values(s.inhibit)[0];
    if (s.override === "stop") reason = "Stopped by remote command (" + (s.overrideBy || "operator") + ").";
    else if (inh && !(s.override === "start" && inh.kind !== "well")) reason = "Held off by automation: " + inh.name + ".";
    else if (s.mode === "manual" && s.override !== "start") reason = "Manual mode — waiting for a start command.";
    else if (!sched.ok && s.override !== "start" && !s.startReq) reason = "Outside schedule (" + sched.txt + ").";
    else if (pvAvail < p.P * 0.3) reason = G < 5 ? "Night — no solar power." : "Waiting for enough sunlight (" + Math.round(pvAvail) + " W available, needs ≈" + Math.round(p.P * 0.3) + " W).";
    else { run = true; state = "running"; reason = s.override === "start" ? "Running on remote start command." : s.startReq ? "Running: started by automation (" + s.startReq + ")." : "Running on schedule with solar power."; }
  }
  // ---- hydraulics ----
  let P = 0, Q = 0, dry = false;
  if (run) {
    P = Math.min(pvAvail * 0.95, p.P * 1.04);
    const subm = p.pumpDepth === undefined ? 0 : 0;
    Q = p.Q * clamp((P - 0.22 * p.P) / (0.78 * p.P), 0, 1.12) * f.hyd;
    const intake = w.pumpDepth - s.lvl;
    if (intake < 1.2) { dry = true; const k = clamp(intake / 1.2, 0, 1); Q *= 0.08 + 0.4 * k; P *= 0.42 + 0.3 * k; }
    if (f.hyd < 1) P *= 1 + (1 - f.hyd) * 0.18; // restriction: more power per litre
  }
  const target = run ? staticNow + s.dd * Q / Math.max(0.5, f.hyd === 1 ? 1 : 1) : staticNow;
  const tau = run ? 22 : s.tau * f.tauMul;
  s.lvl = target + (s.lvl - target) * Math.exp(-dt / tau);
  // ---- protections in the controller ----
  if (dry) { s.dryFor = (s.dryFor || 0) + dt; if (s.dryFor >= 4) { s.fault = "E-DRY"; s.faultUntil = t + 35 * MIN; s.dryFor = 0; s.faultAt = t; } } else s.dryFor = 0;
  // ---- temperatures ----
  const amb = 25 + 8 * G / 1000;
  const ctTarget = amb + 14 * P / p.P + (f.hot ? 34 * G / 1000 + 7 : 4 * G / 1000);
  s.ct += (ctTarget - s.ct) * (1 - Math.exp(-dt / 20));
  const mtTarget = 27 + 9 * P / p.P + (dry ? 35 : 0);
  s.mt += (mtTarget - s.mt) * (1 - Math.exp(-dt / (dry ? 6 : 25)));
  if (s.ct > 80 && !s.fault) { s.fault = "E-OT"; s.faultUntil = t + 25 * MIN; s.faultAt = t; }
  // ---- tank ----
  const tq = Q * dt / 1000;
  tankLvl[tk.id] = (tankLvl[tk.id] ?? tk.cap * 0.55) + tq;
  // ---- outputs ----
  const pvV = G > 5 ? (p.V + 40) * (0.86 + 0.14 * Math.min(1, G / 900)) : 0;
  const pvP = run ? P / 0.95 : 0;
  s.run = run; s.state = state; s.reason = reason; s.dry = dry;
  s.lastIrr = G; s.lastPV = pvP; s.lastP = P; s.lastQ = Q;
  const rn = s.rng; const nz = a => 1 + (rn() - 0.5) * a;
  const m = {
    pv_voltage: r1(pvV * nz(0.01)), pv_current: pvV ? Math.round(pvP / pvV * 100 * nz(0.02)) / 100 : 0, pv_power: Math.round(pvP * nz(0.02)),
    pump_voltage: run ? r1(p.V * (0.9 + 0.1 * P / p.P) * nz(0.01)) : 0, pump_current: run ? Math.round(P / p.V * 100 * nz(0.02)) / 100 : 0,
    pump_power: Math.round(P * nz(0.015)), flow_lpm: r1(Q * nz(0.03)),
    pressure_bar: run ? Math.round((0.5 + 1.6 * Math.pow(Q / p.Q, 2) * (1 + (1 - f.hyd) * 2.4)) * 100 * nz(0.02)) / 100 : 0.4,
    well_level_m: r1(s.lvl * nz(0.004)), tank_level_pct: 0, motor_temp_c: r1(s.mt), ctrl_temp_c: r1(s.ct * nz(0.01)),
    irradiance_wm2: Math.round(G), rpm: run ? Math.round(p.rpm * clamp(0.55 + 0.45 * P / p.P, 0, 1.03)) : 0,
  };
  return { m, state, fault: s.fault, tankId: tk.id };
}
export const FAULTS = {
  "E-DRY": { name: "Dry-run protection", stopTxt: "Controller stopped the pump: dry-run protection (no water at the intake).", plain: "Pump stopped itself because it was running without enough water." },
  "E-OT": { name: "Controller over-temperature", stopTxt: "Controller stopped the pump: over-temperature.", plain: "Pump controller overheated and shut down to protect itself." },
};

/* ---------- device firmware simulator: encodes per its adapter, buffers when offline ---------- */
export const REG = ["pv_voltage", "pv_current", "pv_power", "pump_voltage", "pump_current", "pump_power", "flow_lpm", "pressure_bar", "well_level_m", "tank_level_pct", "motor_temp_c", "ctrl_temp_c", "irradiance_wm2", "rpm"];
export const SHORT = { pv_voltage: "pvv", pv_current: "pvi", pv_power: "pvp", pump_voltage: "pmv", pump_current: "pmi", pump_power: "pmp", flow_lpm: "q", pressure_bar: "pr", well_level_m: "wl", tank_level_pct: "tk", motor_temp_c: "mt", ctrl_temp_c: "ct", irradiance_wm2: "irr", rpm: "rpm" };
export function encode(p, t, m, state, fault, seq) {
  const d = dev(p), only = {}; for (const k of p.sensors) only[k] = m[k];
  if (d.adapter === "mqtt-json") { const v = {}; for (const k in only) v[SHORT[k]] = only[k]; return { topic: `solpump/${d.id}/telemetry`, body: { d: d.id, seq, ts: Math.floor(t / 1000), st: state, fc: fault, v } }; }
  if (d.adapter === "modbus-rtu") { const regs = REG.map(k => k in only ? Math.round(only[k] * (k.includes("current") || k.includes("pressure") ? 100 : 10)) : 0xFFFF); return { device: d.id, seq, time: new Date(t).toISOString(), status_word: state === "running" ? 1 : state === "faulted" ? 4 : 0, alarm_code: fault ? (fault === "E-DRY" ? 21 : 33) : 0, holding_40001: regs }; }
  // lorawan: compact uplink (fPort 2) — values packed as scaled uint16
  const bytes = []; for (const k of REG) { const v = k in only ? Math.round(only[k] * (k.includes("current") || k.includes("pressure") ? 100 : 10)) : 0xFFFF; bytes.push(v >> 8 & 255, v & 255); }
  return { dev_eui: d.id, fCnt: seq, received: t, fPort: 2, flags: (state === "running" ? 1 : 0) | (state === "faulted" ? 2 : 0) | (fault === "E-DRY" ? 4 : fault === "E-OT" ? 8 : 0), payload: bytes };
}
/* ---------- INGESTION LAYER: adapters normalise vendor payloads to one schema ---------- */
export const ADAPTERS = {
  "mqtt-json": { label: "MQTT · JSON (ESP32)", decode(raw) { const b = raw.body, metrics = {}; const inv = Object.fromEntries(Object.entries(SHORT).map(([a, c]) => [c, a])); for (const k in b.v) metrics[inv[k]] = b.v[k]; return { device_id: b.d, seq: b.seq, timestamp: b.ts * 1000, metrics, pump_state: b.st, fault_code: b.fc }; } },
  "modbus-rtu": { label: "Modbus RTU register map via HTTP gateway (PLC)", decode(raw) { const metrics = {}; raw.holding_40001.forEach((v, i) => { if (v !== 0xFFFF) { const k = REG[i]; metrics[k] = v / (k.includes("current") || k.includes("pressure") ? 100 : 10); } }); return { device_id: raw.device, seq: raw.seq, timestamp: Date.parse(raw.time), metrics, pump_state: ["stopped", "running", "", "", "faulted"][raw.status_word], fault_code: raw.alarm_code === 21 ? "E-DRY" : raw.alarm_code === 33 ? "E-OT" : null }; } },
  "lorawan": { label: "LoRaWAN uplink (fPort 2, packed uint16)", decode(raw) { const metrics = {}; REG.forEach((k, i) => { const v = raw.payload[2 * i] << 8 | raw.payload[2 * i + 1]; if (v !== 0xFFFF) metrics[k] = v / (k.includes("current") || k.includes("pressure") ? 100 : 10); }); return { device_id: raw.dev_eui, seq: raw.fCnt, timestamp: raw.received, metrics, pump_state: raw.flags & 2 ? "faulted" : raw.flags & 1 ? "running" : "stopped", fault_code: raw.flags & 4 ? "E-DRY" : raw.flags & 8 ? "E-OT" : null }; } },
};
export const RANGES = { pv_voltage: [0, 900], pv_current: [0, 40], pv_power: [0, 20000], pump_power: [0, 20000], flow_lpm: [0, 2000], pressure_bar: [0, 40], well_level_m: [0, 400], tank_level_pct: [0, 100], motor_temp_c: [-10, 150], ctrl_temp_c: [-10, 150], irradiance_wm2: [0, 1500] };
export function ingest(adapterKey, raw, credential, src = "live") {
  const ev = ADAPTERS[adapterKey].decode(raw);
  const d = byId(S.devices, ev.device_id);
  if (!d) return log({ ok: false, err: "unknown device" });
  // per-device credential check (hash compare; secrets never stored or sent to the UI in clear)
  const okCred = fnv(credential) === d.secretHash || (d.prevHash && fnv(credential) === d.prevHash && S.now < d.prevUntil);
  if (!okCred) return log({ ok: false, device: d.id, err: "credential rejected (401)" });
  const key = d.id + ":" + ev.seq;
  if (SEEN.has(key)) { if (src !== "seed") log({ ok: true, dup: true, device: d.id, seq: ev.seq, src }); return { accepted: false, duplicate: true }; }
  SEEN.add(key);
  const p = pump(d.asset), q = [];
  for (const k in ev.metrics) { const r = RANGES[k]; if (r && (ev.metrics[k] < r[0] || ev.metrics[k] > r[1])) { q.push("out_of_range:" + k); delete ev.metrics[k]; } }
  if (src === "buffered") q.push("late_arrival");
  const norm = { organization_id: p.org, site_id: p.site, asset_id: p.id, device_id: d.id, timestamp: ev.timestamp, seq: ev.seq, metrics: ev.metrics, pump_state: ev.pump_state, fault_code: ev.fault_code, quality: q, received_at: S.now };
  const pt = { t: ev.timestamp, dt: raw._dt || 1, m: ev.metrics, s: ev.pump_state, f: ev.fault_code, q, src };
  const a = TS[p.id];
  if (!a.length || a[a.length - 1].t < pt.t) a.push(pt); else { let i = a.length; while (i > 0 && a[i - 1].t > pt.t) i--; a.splice(i, 0, pt); }
  d.lastUpload = S.now; d.lastHeartbeat = S.now;
  if (src !== "seed") log({ ok: true, device: d.id, seq: ev.seq, src, adapter: adapterKey, norm });
  return { accepted: true, ack: ev.seq };
}
export function log(e) { e.at = S.now; S.ingestLog.unshift(e); if (S.ingestLog.length > 150) S.ingestLog.length = 150; return e; }

/* ---------- one simulation step for the whole world ---------- */
export function stepWorld(dt, src) {
  const t = S.now;
  const outs = {};
  for (const p of S.pumps) outs[p.id] = stepPump(p, t, dt);
  for (const tk of S.tanks) { tankLvl[tk.id] = clamp((tankLvl[tk.id] ?? tk.cap * 0.55) - demand(t) * tk.demand * dt, 0, tk.cap); }
  for (const p of S.pumps) {
    const o = outs[p.id], s = SIM[p.id], d = dev(p), tk = tank(p);
    o.m.tank_level_pct = Math.round(tankLvl[tk.id] / tk.cap * 1000) / 10;
    s.tankPct = o.m.tank_level_pct;
    s.seq++;
    const raw = encode(p, t, o.m, o.state, o.fault, s.seq); raw._dt = dt;
    const offline = s.forceOffline || (s.scen === "offline_declining" && t >= START - 3 * H && !s.restored);
    d.online = !offline;
    d.uptimeH += dt / 60; d.sent++;
    const lossP = d.rssi < -100 ? 0.08 : d.rssi < -108 ? 0.12 : 0.006;
    if (offline) { s.buffer.push({ raw, t }); d.buffered = s.buffer.length; }
    else if (src === "live" && s.rng() < lossP) { d.lost++; s.buffer.push({ raw, t }); d.buffered = s.buffer.length; } // lost packet → retried next upload
    else {
      if (s.buffer.length) flushBuffer(p, src === "seed" ? "seed" : "buffered");
      ingest(d.adapter, raw, s.secret, src);
      // pending commands are delivered on the device's next contact
      deliverCommands(p);
    }
    d.battery = r1(12.4 + 1.3 * Math.min(1, s.lastIrr / 600) + (s.rng() - 0.5) * 0.1);
    if (d.online) d.rssiNow = d.rssi + Math.round((s.rng() - 0.5) * 6);
  }
  for (const p of S.pumps) { runAutomation(p); runAlerts(p); }
  expireCommands(); escalate();
}
export function flushBuffer(p, src) {
  const s = SIM[p.id], d = dev(p); let acc = 0, dup = 0;
  const batch = s.buffer.splice(0);
  if (src === "buffered" && batch.length > 3) batch.push(...batch.slice(-3)); // device re-sends tail after reconnect → must be de-duplicated
  for (const b of batch) { const r = ingest(d.adapter, b.raw, s.secret, src); r.accepted ? acc++ : dup++; }
  d.buffered = 0;
  if (src === "buffered" && batch.length > 3) {
    log({ ok: true, device: d.id, flush: true, accepted: acc, dup, src: "buffered" });
    audit("system", "Buffered telemetry uploaded", p.id, null, `${acc} records accepted, ${dup} duplicates rejected, original timestamps preserved`);
    notify(p.org, "info", `${p.short}: IoT device reconnected and uploaded ${acc} buffered readings.`, p.id);
  }
}

/* ---------- derived values & series helpers ---------- */
export const last = id => { const a = TS[id]; return a && a.length ? a[a.length - 1] : null; };
export function window_(id, from, to = S.now) { const a = TS[id]; let lo = 0, hi = a.length; while (lo < hi) { const m = lo + hi >> 1; a[m].t < from ? lo = m + 1 : hi = m; } const out = []; for (let i = lo; i < a.length && a[i].t <= to; i++) out.push(a[i]); return out; }
export function derived(p, pt) {
  if (!pt) return {};
  const w = well(p), m = pt.m;
  return Object.assign({}, m, { pump_power_pct: m.pump_power != null ? m.pump_power / p.P * 100 : undefined, well_margin_m: m.well_level_m != null ? w.minSafe - m.well_level_m : undefined, fault: pt.f });
}

/* ---------- BASELINE: expected flow from pump power, expected PV from irradiance ---------- */
export const BASE = {};
export function learnBaseline(p) {
  const a = TS[p.id], t0 = a.length ? a[0].t : 0, ratios = [], pv = [];
  for (const x of a) {
    if (x.t > t0 + 6 * D) break;
    if (x.s === "running" && x.m.pump_power > 0.45 * p.P && !x.f) ratios.push(x.m.flow_lpm / modelFlow(p, x.m.pump_power));
    if (x.s === "running" && x.m.irradiance_wm2 > 450) pv.push(x.m.pv_power / (arr(p).kw * 1000 * x.m.irradiance_wm2 / 1000));
  }
  const med = v => v.length ? v.sort((a, b) => a - b)[v.length >> 1] : null;
  BASE[p.id] = { k: med(ratios) || 1, pv: med(pv), from: t0, to: t0 + 6 * D, n: ratios.length };
}
export const modelFlow = (p, P) => p.Q * clamp((P - 0.22 * p.P) / (0.78 * p.P), 0, 1.12);
export const expFlow = (p, P) => P > 0.25 * p.P ? modelFlow(p, P) * (BASE[p.id]?.k || 1) : null;
export const expPV = (p, G) => (BASE[p.id]?.pv && G > 250) ? arr(p).kw * 1000 * G / 1000 * BASE[p.id].pv : null;

/* ---------- AUTOMATION ENGINE ---------- */
export const OPS = { ">": (a, b) => a > b, "<": (a, b) => a < b, ">=": (a, b) => a >= b, "<=": (a, b) => a <= b, "=": (a, b) => b === "any" ? !!a : a === b };
export function condTrue(p, c, d) {
  const v = d[c.m]; if (v === undefined || v === null) return c.m === "fault" ? false : null;
  const ok = OPS[c.op](v, c.v); const s = SIM[p.id]; s.cs = s.cs || {};
  const k = JSON.stringify(c);
  if (!ok) { delete s.cs[k]; return false; }
  if (!c.for) return true;
  s.cs[k] = s.cs[k] ?? S.now; return S.now - s.cs[k] >= c.for * MIN;
}
export function runAutomation(p) {
  const s = SIM[p.id], pt = last(p.id); if (!pt || pt.t < S.now - 20 * MIN) return; // automation needs fresh data
  const d = derived(p, pt); s.startReq = null;
  for (const r of S.automations.filter(a => a.org === p.org && a.enabled && (a.scope === "all" || a.scope.includes(p.id)))) {
    const res = r.when.map(c => condTrue(p, c, d)); if (res.includes(null)) continue; // missing sensor → rule not applicable
    const hit = res.every(Boolean), key = r.id;
    if (r.then === "stop" || r.then === "stop_alert") {
      const active = s.inhibit[key];
      if (hit && !active) {
        s.inhibit[key] = { name: r.name, kind: r.when.some(c => c.m === "well_margin_m") ? "well" : "other", since: S.now }; r.fired++;
        audit("automation", "Automation stopped pump", p.id, null, r.name);
        if (r.then === "stop_alert") raise(p, { id: "auto_lowflow", sev: "critical", title: "Pump stopped: sustained low flow", msg: `${p.short} was stopped by automation after flow stayed below ${r.when[0].v} L/min for ${r.when[0].for} minutes at high power.` }, d);
      } else if (active) {
        const rel = r.release ? condTrue(p, r.release, d) : r.releaseAfter ? S.now - active.since >= r.releaseAfter * MIN : !hit;
        if (rel) { delete s.inhibit[key]; audit("automation", "Automation released hold", p.id, null, r.name); }
      }
    } else if (r.then === "start") { if (hit && s.mode === "auto") { s.startReq = r.name; } }
    else if (r.then === "notify_ops") {
      const was = s.latched[key]; s.latched[key] = hit;
      if (hit && !was) { r.fired++; notify(p.org, "warning", `${p.short}: ${FAULTS[d.fault]?.plain || "pump fault"} — routed to Operations Manager.`, p.id, "ops"); }
    }
  }
}

/* ---------- ALERT ENGINE: threshold + duration + hysteresis + cooldown + escalation ---------- */
export const RULES = [
  { id: "dry_run", sev: "critical", title: "Possible dry-run", cond: c => c.d.fault === "E-DRY" || (c.running && c.p.sensors.includes("well_level_m") && c.d.well_level_m > well(c.p).pumpDepth - 1.2 && c.d.flow_lpm < c.p.Q * 0.3), clear: c => c.d.fault !== "E-DRY" && !c.running || (c.d.flow_lpm > c.p.Q * 0.4), dur: 0 },
  { id: "pump_fault", sev: "critical", title: "Pump controller fault", cond: c => c.d.fault === "E-OT", clear: c => !c.d.fault, dur: 0 },
  { id: "no_flow", sev: "critical", title: "No flow while running", cond: c => c.running && c.d.flow_lpm < S.thresholds.noFlowLpm && c.d.pump_power_pct > 40, clear: c => !c.running || c.d.flow_lpm > S.thresholds.noFlowLpm * 3, dur: 5 },
  { id: "low_flow", sev: "warning", title: "Water production below expected", cond: c => c.exp && c.d.flow_lpm < c.exp * S.thresholds.lowFlowPct / 100, clear: c => !c.running || (c.exp && c.d.flow_lpm > c.exp * S.thresholds.lowFlowClearPct / 100), dur: () => S.thresholds.lowFlowMin },
  { id: "low_well", sev: "warning", title: "Well level close to minimum safe level", cond: c => c.d.well_margin_m !== undefined && c.d.well_margin_m < S.thresholds.wellMarginM, clear: c => c.d.well_margin_m > S.thresholds.wellMarginM + 1.5, dur: 3 },
  { id: "overheat", sev: "warning", title: "Controller running hot", cond: c => c.d.ctrl_temp_c > S.thresholds.overheatC, clear: c => c.d.ctrl_temp_c < S.thresholds.overheatClearC, dur: 10 },
  { id: "low_solar", sev: "warning", title: "Solar production lower than expected", cond: c => c.running && c.expPv && c.d.irradiance_wm2 > 450 && c.d.pv_power < c.expPv * S.thresholds.lowSolarPct / 100, clear: c => c.expPv && c.d.pv_power > c.expPv * (S.thresholds.lowSolarPct + 10) / 100, dur: () => S.thresholds.lowSolarMin },
  { id: "tank_high", sev: "info", title: "Tank nearly full", cond: c => c.d.tank_level_pct > S.thresholds.tankHighPct, clear: c => c.d.tank_level_pct < S.thresholds.tankHighPct - 8, dur: 5 },
  { id: "tank_low", sev: "warning", title: "Tank level low", cond: c => c.d.tank_level_pct < S.thresholds.tankLowPct, clear: c => c.d.tank_level_pct > S.thresholds.tankLowPct + 8, dur: 10 },
  { id: "overcurrent", sev: "critical", title: "Motor current above rating", cond: c => c.d.pump_current > c.p.I * 1.12, clear: c => c.d.pump_current < c.p.I, dur: 2 },
];
export const RULE_TXT = { comms_loss: "IoT device not reporting" };
export function runAlerts(p) {
  const s = SIM[p.id]; s.al = s.al || {};
  const pt = last(p.id), d = dev(p);
  // communication loss is judged on the cloud side from heartbeat age
  const age = (S.now - d.lastHeartbeat) / MIN;
  ruleTick(p, { id: "comms_loss", sev: "warning", title: "IoT device not reporting" }, age > S.thresholds.commsLossMin, age < 2, 0, { "Last data": fmtAgo(d.lastHeartbeat) });
  if (!pt || pt.t < S.now - 20 * MIN) return; // no fresh data: don't judge pump conditions on stale values
  const dd = derived(p, pt), c = { p, d: dd, running: pt.s === "running", exp: pt.s === "running" ? expFlow(p, dd.pump_power) : null, expPv: expPV(p, dd.irradiance_wm2) };
  for (const r of RULES) {
    let on; try { on = !!r.cond(c); } catch (e) { on = false; }
    let off; try { off = !!r.clear(c); } catch (e) { off = true; }
    const ev = { Flow: dd.flow_lpm != null ? dd.flow_lpm + " L/min" : undefined, Expected: c.exp ? r1(c.exp) + " L/min" : undefined, "Pump power": dd.pump_power + " W", "Well level": dd.well_level_m != null ? dd.well_level_m + " m below ground" : undefined, "Controller temp": dd.ctrl_temp_c != null ? dd.ctrl_temp_c + " °C" : undefined, Fault: dd.fault || undefined };
    ruleTick(p, r, on, off, typeof r.dur === "function" ? r.dur() : r.dur, ev);
  }
}
export function ruleTick(p, r, on, off, dur, evidence) {
  const s = SIM[p.id]; s.al = s.al || {}; const st = s.al[r.id] = s.al[r.id] || { since: null, alarm: null, clearedAt: -1e15 };
  if (st.alarm) {
    const a = byId(S.alarms, st.alarm);
    if (off) { a.state = "cleared"; a.clearedAt = S.now; st.alarm = null; st.clearedAt = S.now; st.since = null; }
    else a.lastSeen = S.now;
    return;
  }
  if (on) {
    st.since = st.since ?? S.now;
    if (S.now - st.since >= dur * MIN) {
      if (S.now - st.clearedAt < S.thresholds.cooldownMin * MIN) { // cooldown: re-open the recent alarm instead of spamming a new one
        const prev = S.alarms.find(a => a.pump === p.id && a.rule === r.id);
        if (prev) { prev.state = prev.ackAt ? "acknowledged" : "active"; prev.occurrences++; prev.clearedAt = null; st.alarm = prev.id; return; }
      }
      st.alarm = raise(p, r, null, evidence).id;
    }
  } else st.since = null;
}
export function raise(p, r, d, evidence) {
  const a = { id: uid("ALM"), org: p.org, pump: p.id, site: p.site, rule: r.id, sev: r.sev, title: r.title, msg: r.msg || "", raisedAt: S.now, lastSeen: S.now, state: "active", occurrences: 1, evidence: evidence || {}, ackBy: null, ackAt: null, escalated: false, incident: null };
  S.alarms.unshift(a); if (S.alarms.length > 900) S.alarms.length = 900;
  if (r.sev !== "info") notify(p.org, r.sev, `${p.short}: ${r.title}.`, p.id, null, a.id);
  return a;
}
export function escalate() {
  for (const a of S.alarms) {
    if (a.state === "active" && a.sev === "critical" && !a.escalated && S.now - a.raisedAt > S.thresholds.escalateMin * MIN) {
      a.escalated = true; notify(a.org, "critical", `Escalated: ${pump(a.pump).short} — ${a.title} has not been acknowledged for ${S.thresholds.escalateMin} min.`, a.pump, "owner", a.id);
    }
  }
}
/* ---------- NOTIFICATION SERVICE: provider-agnostic channel adapters ---------- */
export const CHANNELS = {
  in_app: { label: "In-app", send: n => true },
  email: { label: "Email", send: n => false }, whatsapp: { label: "WhatsApp", send: n => false }, telegram: { label: "Telegram", send: n => false }, sms: { label: "SMS", send: n => false },
};
export function notify(orgId, sev, text, pumpId, toRole, alarmId) {
  const n = { id: uid("N"), org: orgId, sev, text, pump: pumpId, at: S.now, read: false, toRole: toRole || (sev === "critical" ? "ops" : "all"), alarm: alarmId };
  S.notifications.unshift(n); if (S.notifications.length > 400) S.notifications.length = 400;
  if (sev !== "info") for (const [k, ch] of Object.entries(S.channels)) if (k !== "in_app" && ch.on) {
    S.outbox.unshift({ id: uid("OB"), org: orgId, channel: k, text, at: S.now, status: ch.configured ? "sent" : "queued — provider not configured" });
  }
  if (S.outbox.length > 300) S.outbox.length = 300;
  if (S.ready && orgId === S.orgId && sev !== "info") toast(text);
}

/* ---------- COMMAND SERVICE: authorised, logged, acknowledged by device ---------- */
export function issueCommand(p, cmd, reason) {
  if (!can("command")) { toast("Your role can't send pump commands."); return null; }
  const c = { id: uid("CMD"), org: p.org, pump: p.id, cmd, reason: reason || "", by: S.session.userId, at: S.now, status: "queued", log: [[S.now, "Queued — waiting for device to connect"]] };
  S.commands.unshift(c); SIM[p.id].pending.push(c.id);
  audit(S.session.userId, "Pump command: " + cmd, p.id, null, reason ? "Reason: " + reason : "");
  return c;
}
export function deliverCommands(p) {
  const s = SIM[p.id];
  while (s.pending.length) {
    const c = byId(S.commands, s.pending.shift()); if (!c || c.status !== "queued") continue;
    c.status = "acknowledged"; c.log.push([S.now, "Delivered and acknowledged by " + dev(p).id]);
    const who = user(c.by)?.name || c.by;
    if (c.cmd === "stop") { s.override = "stop"; s.overrideBy = who; }
    if (c.cmd === "start") { s.override = "start"; s.overrideBy = who; }
    if (c.cmd === "restart") { s.fault = null; s.faultUntil = 0; s.override = null; }
    if (c.cmd === "manual") { s.mode = "manual"; s.override = null; }
    if (c.cmd === "auto") { s.mode = "auto"; s.override = null; }
    c.status = "executed"; c.log.push([S.now, "Executed by controller"]);
  }
}
export function expireCommands() { for (const c of S.commands) if (c.status === "queued" && S.now - c.at > 30 * MIN) { c.status = "expired"; c.log.push([S.now, "Expired — device did not connect within 30 min. Nothing was executed."]); audit("system", "Command expired", c.pump, null, c.cmd); SIM[c.pump].pending = SIM[c.pump].pending.filter(x => x !== c.id); } }

/* ---------- AUDIT ---------- */
export function audit(by, action, asset, oldV, newV) { S.audit.unshift({ id: uid("AUD"), org: asset ? pump(asset)?.org || S.orgId : (S.orgId || "ORG-ASL"), by, action, asset, old: oldV, new: newV, at: S.now }); if (S.audit.length > 1500) S.audit.length = 1500; }

/* ---------- formatting ---------- */
export const pad = n => String(n).padStart(2, "0");
export function wib(t) { return new Date(t + TZ); }
export function fmtTime(t) { const d = wib(t); return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()); }
export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function fmtDate(t) { const d = wib(t); return d.getUTCDate() + " " + MON[d.getUTCMonth()]; }
export function fmtDT(t) { return (dk(t) === dk(S.now) ? "Today" : dk(t) === dk(S.now) - 1 ? "Yesterday" : fmtDate(t)) + " " + fmtTime(t); }
export function fmtAgo(t) { if (!t) return "never"; const m = Math.round((S.now - t) / MIN); if (m < 1) return "just now"; if (m < 60) return m + " min ago"; const h = Math.floor(m / 60); if (h < 24) return h + " h " + (m % 60 ? (m % 60) + " min " : "") + "ago"; return Math.floor(h / 24) + " d ago"; }
export function fmtDur(min) { min = Math.round(min); if (min < 60) return min + " min"; return Math.floor(min / 60) + " h " + pad(min % 60) + " m"; }
export const fmtN = (v, d = 0) => v == null || isNaN(v) ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/* ---------- DOM utils (shared with the UI layer) ---------- */
export const $ = (s, r = document) => r.querySelector(s);
export function toast(t) { const box = $("#toasts"); if (!box) return; const e = document.createElement("div"); e.className = "toast"; e.textContent = t; box.appendChild(e); setTimeout(() => e.remove(), 5200); while (box.children.length > 3) box.firstChild.remove(); }
