/* ---------- ALERTS ---------- */
import { $, ADAPTERS, D, H, MIN, ROLES, S, SIM, TZ, audit, byId, can, ctl, dk, fmtAgo, fmtDT, fmtDate, fmtDur, fmtN, fmtTime, fnv, has, last, myPumps, notify, pump, r1, scoped, site, toast, uid, user, well } from './core.js';
import { daily, diagnose, perfRatio, sumDays, today } from './intel.js';
import { ROUTES, UI, barChart, bindRows, diagM, esc, go, hbar, healthM, lineChart, nos, pill, renderAll, setView, sev, statusM, wellM } from './ui1.js';
import { bindAck, fromLocalInput, modal, toLocalInput } from './ui2.js';
ROUTES.alerts = () => {
  const all = scoped(S.alarms), f = { open: a => a.state === "active", ack: a => a.state === "acknowledged", cleared: a => a.state === "cleared", all: () => true }[UI.alertTab];
  const list = all.filter(f).slice(0, 200);
  const cnt = k => all.filter({ open: a => a.state === "active", ack: a => a.state === "acknowledged", cleared: a => a.state === "cleared", all: () => true }[k]).length;
  setView(`<div class="tabs">${[["open", "Active"], ["ack", "Acknowledged"], ["cleared", "Cleared"], ["all", "All"]].map(([k, l]) => `<button class="${UI.alertTab === k ? "on" : ""}" data-at="${k}">${l} <span class="na">${cnt(k)}</span></button>`).join("")}</div>
  <section class="panel"><div class="hd"><h2>${list.length} alerts</h2><span class="sp"></span><span class="na">Duplicates are merged (count shows repeats); alerts wait for the condition to persist, clear with hysteresis, and observe a ${S.thresholds.cooldownMin}-minute cooldown.</span></div>
  <div class="tw"><table><thead><tr><th>Severity</th><th>Asset</th><th>Alert</th><th>Raised</th><th>Duration</th><th>State</th><th></th></tr></thead><tbody>
  ${list.map(a => { const p = pump(a.pump); return `<tr><td>${sev(a.sev)}</td><td><a href="#/pump/${p.id}">${esc(p.short)}</a><div class="na">${esc(site(p.site).name.split(" — ")[0])}</div></td><td>${esc(a.title)}${a.occurrences > 1 ? ` <span class="na">×${a.occurrences}</span>` : ""}${a.msg ? `<div class="na">${esc(a.msg)}</div>` : ""}${Object.keys(a.evidence).length ? `<details><summary>Evidence at trigger</summary><div class="small">${Object.entries(a.evidence).filter(([, v]) => v).map(([k, v]) => `${k}: <b>${esc(v)}</b>`).join(" · ")}</div></details>` : ""}${a.escalated ? '<div class="na" style="color:var(--crit)">Escalated to owner</div>' : ""}</td>
   <td>${fmtDT(a.raisedAt)}</td><td class="num">${fmtDur(((a.clearedAt || S.now) - a.raisedAt) / MIN)}</td><td>${a.state === "active" ? pill(a.sev === "critical" ? "crit" : a.sev === "warning" ? "warn" : "off", "Active") : a.state === "acknowledged" ? pill("warn", "Acknowledged") + `<div class="na">${esc(user(a.ackBy)?.name)} ${fmtTime(a.ackAt)}</div>` : pill("off", "Cleared")}</td>
   <td class="r" style="white-space:nowrap">${a.state === "active" && can("ack") ? `<button class="btn sm" data-ack="${a.id}">Acknowledge</button> ` : ""}${a.incident ? `<a class="btn sm" href="#/incident/${a.incident}">Incident</a>` : a.state !== "cleared" && a.sev !== "info" && can("ack") ? `<button class="btn sm" data-inc="${a.id}">Create incident</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="7" class="muted">No alerts here.</td></tr>`}
  </tbody></table></div></section>`);
  return { title: "Alerts", after() { document.querySelectorAll("[data-at]").forEach(b => b.onclick = () => { UI.alertTab = b.dataset.at; renderAll(); }); bindAck(); document.querySelectorAll("[data-inc]").forEach(b => b.onclick = () => go("#/incident/" + makeIncident(byId(S.alarms, b.dataset.inc)).id)); } };
};
export function makeIncident(a, quiet) {
  const p = pump(a.pump), dg = diagnose(p)[0];
  const i = { id: uid("INC"), org: a.org, pump: a.pump, alarm: a.id, title: `${p.short}: ${a.title}`, sev: a.sev, detectedAt: a.raisedAt, assignee: null, status: "Open", diagnosis: dg ? dg.likely + " — " + dg.summary : "", actions: [], parts: [], resolution: "", cost: 0, photos: [], notes: "" };
  S.incidents.unshift(i); a.incident = i.id; if (!quiet) audit(S.session.userId, "Incident created from alarm", a.pump, null, i.title); return i;
}

/* ---------- INCIDENTS ---------- */
export const INC_ST = ["Open", "Acknowledged", "Assigned", "In Progress", "Resolved", "Closed"];
ROUTES.incidents = () => {
  const list = scoped(S.incidents);
  setView(`<section class="panel"><div class="hd"><h2>Incidents</h2><span class="sp"></span><span class="na">Create one from any critical or warning alert to track the fix end-to-end.</span></div><div class="tw"><table><thead><tr><th>Incident</th><th>Severity</th><th>Detected</th><th>Assigned</th><th>Status</th><th class="r">Cost</th></tr></thead><tbody>
  ${list.map(i => `<tr class="click" data-i="${i.id}"><td><b>${esc(i.title)}</b><div class="na">${i.id}</div></td><td>${sev(i.sev)}</td><td>${fmtDT(i.detectedAt)}</td><td>${esc(user(i.assignee)?.name || "—")}</td><td>${pill(["Resolved", "Closed"].includes(i.status) ? "ok" : i.status === "Open" ? "crit" : "warn", i.status)}</td><td class="r num">${i.cost ? "Rp " + fmtN(i.cost) : "—"}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">No incidents. Convert a critical alert into an incident from the Alerts page.</td></tr>`}
  </tbody></table></div></section>`);
  return { title: "Incidents", after() { document.querySelectorAll("[data-i]").forEach(r => r.onclick = () => go("#/incident/" + r.dataset.i)); } };
};
ROUTES.incident = (id) => {
  const i = byId(S.incidents, id); if (!i || i.org !== S.orgId) { setView("<div class='panel'><div class='bd'>Incident not found.</div></div>"); return { title: "Incident" }; }
  const p = pump(i.pump), techs = S.users.filter(u => u.org === i.org && ["tech", "ops"].includes(u.role)), ed = can("maintain") || can("ack");
  const k = INC_ST.indexOf(i.status);
  setView(`<div class="grid g-main"><div class="stack"><section class="panel"><div class="hd"><h2>${esc(i.title)}</h2><span class="sp"></span>${sev(i.sev)}</div><div class="bd">
   <div class="row" style="margin-bottom:14px">${INC_ST.map((s, j) => `<button class="btn sm ${j === k ? "pri" : ""}" data-ist="${s}" ${ed ? "" : "disabled"} ${j < k ? 'style="opacity:.6"' : ""}>${j < k ? "✓ " : ""}${s}</button>`).join("")}</div>
   <dl class="kv"><dt>Asset</dt><dd><a href="#/pump/${p.id}">${esc(p.name)}</a>, ${esc(site(p.site).name)}</dd><dt>Detected</dt><dd>${fmtDT(i.detectedAt)}</dd><dt>Source alarm</dt><dd>${esc(byId(S.alarms, i.alarm)?.title || "—")}</dd>
   <dt>Assigned to</dt><dd><select id="iasg" ${ed ? "" : "disabled"}><option value="">Unassigned</option>${techs.map(t => `<option value="${t.id}" ${i.assignee === t.id ? "selected" : ""}>${esc(t.name)} — ${ROLES[t.role].label}</option>`).join("")}</select></dd>
   <dt>Diagnosis</dt><dd>${esc(i.diagnosis || "—")}</dd></dl>
   <h3 style="margin:16px 0 6px">Actions taken</h3>${i.actions.length ? `<ul class="reasons">${i.actions.map(a => `<li><span class="na" style="min-width:90px">${fmtDT(a.at)}</span><span><b>${esc(user(a.by)?.name || a.by)}:</b> ${esc(a.text)}</span></li>`).join("")}</ul>` : `<p class="muted small">Nothing logged yet.</p>`}
   ${ed ? `<div class="row" style="margin-top:8px"><input type="text" id="iact" placeholder="Log an action, e.g. 'Reduced controller max frequency to 42 Hz'" style="flex:1;min-width:220px"><button class="btn" id="iadd">Add</button></div>` : ""}</div></section></div>
   <div class="stack"><section class="panel"><div class="hd"><h2>Resolution</h2></div><div class="bd stack" style="gap:10px">
    <label class="f">Parts used (one per line: name, qty, cost in Rp)<textarea id="iparts" ${ed ? "" : "disabled"}>${esc(i.parts.map(x => `${x.name}, ${x.qty}, ${x.cost}`).join("\n"))}</textarea></label>
    <label class="f">Resolution<textarea id="ires" ${ed ? "" : "disabled"}>${esc(i.resolution)}</textarea></label>
    <label class="f">Labour cost (Rp)<input type="number" id="ilab" value="${i.labor || 0}" ${ed ? "" : "disabled"}></label>
    <label class="f">Notes<textarea id="inotes" ${ed ? "" : "disabled"}>${esc(i.notes)}</textarea></label>
    <label class="f">Photos<input type="file" id="iph" accept="image/*" multiple ${ed ? "" : "disabled"}></label><div class="row">${i.photos.map(ph => `<img src="${ph}" alt="Incident photo" style="width:72px;height:72px;object-fit:cover;border-radius:6px;border:1px solid var(--line)">`).join("")}</div>
    <p class="small">Total cost: <b class="num">Rp ${fmtN(i.cost)}</b></p>
    ${ed ? `<button class="btn pri" id="isave">Save incident</button>` : ""}</div></section></div></div>`);
  return {
    title: "Incident " + i.id, crumb: `<a href="#/incidents">Incidents</a>`, live: false, after() {
      document.querySelectorAll("[data-ist]").forEach(b => b.onclick = () => { const o = i.status; i.status = b.dataset.ist; if (i.status === "Acknowledged") { const a = byId(S.alarms, i.alarm); if (a && a.state === "active") { a.state = "acknowledged"; a.ackBy = S.session.userId; a.ackAt = S.now; } } i.actions.push({ at: S.now, by: S.session.userId, text: `Status ${o} → ${i.status}` }); audit(S.session.userId, "Incident status", i.pump, o, i.status); renderAll(true); });
      if ($("#iasg")) $("#iasg").onchange = e => { const o = i.assignee; i.assignee = e.target.value || null; if (i.assignee && k < 2) i.status = "Assigned"; i.actions.push({ at: S.now, by: S.session.userId, text: "Assigned to " + (user(i.assignee)?.name || "nobody") }); audit(S.session.userId, "Incident assigned", i.pump, user(o)?.name || "—", user(i.assignee)?.name || "—"); notify(i.org, "info", `${user(i.assignee)?.name} was assigned: ${i.title}`, i.pump); renderAll(true); };
      if ($("#iadd")) $("#iadd").onclick = () => { const v = $("#iact").value.trim(); if (!v) return; i.actions.push({ at: S.now, by: S.session.userId, text: v }); renderAll(true); };
      if ($("#iph")) $("#iph").onchange = e => { [...e.target.files].slice(0, 6).forEach(f => { const r = new FileReader(); r.onload = () => { i.photos.push(r.result); renderAll(true); }; r.readAsDataURL(f); }); };
      if ($("#isave")) $("#isave").onclick = () => { i.parts = $("#iparts").value.split("\n").map(l => l.split(",").map(x => x.trim())).filter(x => x[0]).map(([name, qty, cost]) => ({ name, qty: +qty || 1, cost: +cost || 0 })); i.resolution = $("#ires").value; i.notes = $("#inotes").value; i.labor = +$("#ilab").value || 0; const o = i.cost; i.cost = i.parts.reduce((s, x) => s + x.cost * x.qty, 0) + i.labor; audit(S.session.userId, "Incident updated", i.pump, "Rp " + fmtN(o), "Rp " + fmtN(i.cost)); toast("Incident saved."); renderAll(true); };
    },
  };
};

/* ---------- MAINTENANCE ---------- */
export const CHECK = {
  lowflow: ["Check discharge and gate-valve positions", "Inspect and clean the intake screen", "Check the non-return valve", "Measure flow (meter or bucket test) and compare with expected", "Pull the pump if flow doesn't recover"],
  solar: ["Inspect panels for dust, droppings and new shading", "Clean panels early morning with water and a soft brush", "Check MC4 connectors and string voltages", "Record PV power after cleaning"],
  heat: ["Check enclosure vents and fan", "Clean the controller heatsink", "Fit a sun shade over the controller box", "Log enclosure temperature at 13:00"],
  dry: ["Dip-meter the well to verify the level sensor", "Reduce controller max frequency to limit flow", "Add a midday recovery break to the schedule", "Check the pump and cable for heat damage"],
  calendar: ["Inspect wellhead, cable and splice", "Check earthing and surge protection", "Clean panels", "Verify sensors against a reference reading", "Tighten terminals", "Update the logbook"],
  comms: ["Check device power LED and fuse", "Check antenna and SIM data balance", "Power-cycle the device", "Confirm buffered data was uploaded"],
};
export function newTask(p, key, title, trigger, due, assignee, quiet) {
  const t = { id: uid("MT"), org: p.org, pump: p.id, key, title, trigger, due, assignee: assignee || null, status: assignee ? "Assigned" : "Open", checklist: (CHECK[key] || CHECK.calendar).map(x => [x, false]), created: S.now };
  S.tasks.unshift(t); if (!quiet) { audit("system", "Maintenance task created", p.id, null, `${title} (${trigger})`); notify(p.org, "info", `New maintenance task: ${p.short} — ${title}`, p.id); } return t;
}
export function autoMaint() {
  for (const p of S.pumps) {
    const open = k => S.tasks.some(t => t.pump === p.id && t.key === k && t.status !== "Done");
    const dg = diagnose(p);
    for (const d of dg) {
      if (d.key === "lowflow" && d.sev !== "info" && !open("lowflow")) newTask(p, "lowflow", "Inspect intake, valves and pump — low flow", "Performance degradation", S.now + 3 * D);
      if (d.key === "solar" && !open("solar")) newTask(p, "solar", "Clean PV panels and check strings", "Performance degradation", S.now + 4 * D);
      if (d.key === "heat" && d.sev !== "info" && !open("heat")) newTask(p, "heat", "Shade and ventilate the controller enclosure", "Fault frequency", S.now + 5 * D);
      if (d.key === "dry" && !open("dry")) newTask(p, "dry", "Reduce pumping rate to protect the well", "Fault frequency (dry-run trips)", S.now + 2 * D);
    }
    if (S.now > p.maint.next - 7 * D && !open("calendar")) newTask(p, "calendar", `Scheduled ${p.maint.intervalDays}-day service`, "Calendar interval", p.maint.next);
  }
}
export function maintRows(list) {
  return list.map(t => { const p = pump(t.pump), over = t.status !== "Done" && S.now > t.due; return `<tr class="click" data-mt="${t.id}"><td><b>${esc(t.title)}</b><div class="na">${esc(p.short)} · ${t.checklist.filter(c => c[1]).length}/${t.checklist.length} checks</div></td><td class="small">${esc(t.trigger)}</td><td>${fmtDate(t.due)}${over ? `<div class="na" style="color:var(--crit)">${Math.floor((S.now - t.due) / D)} days overdue</div>` : ""}</td><td>${esc(user(t.assignee)?.name || "—")}</td><td>${pill(t.status === "Done" ? "ok" : over ? "crit" : t.status === "Open" ? "off" : "warn", t.status)}</td></tr>`; }).join("");
}
ROUTES.maintenance = () => {
  const all = scoped(S.tasks), mine = S.session.role === "tech", list = mine ? all.filter(t => t.assignee === S.session.userId && t.status !== "Done") : all.filter(t => t.status !== "Done");
  const recs = scoped(S.records);
  setView(`${mine ? `<p class="lead-sum" style="margin-bottom:14px">${list.length ? `You have ${list.length} ${list.length === 1 ? "task" : "tasks"}. Open one for the checklist, diagnosis and asset details.` : "No tasks assigned to you."}</p>` : ""}
   <section class="panel" style="margin-bottom:16px"><div class="hd"><h2>${mine ? "My tasks" : "Open tasks"}</h2><span class="sp"></span><span class="na">Tasks are created automatically from calendar intervals, fault frequency and performance degradation — or by hand.</span></div>
   <div class="tw"><table><thead><tr><th>Task</th><th>Trigger</th><th>Due</th><th>Technician</th><th>Status</th></tr></thead><tbody>${maintRows(list) || `<tr><td colspan="5" class="muted">Nothing open.</td></tr>`}</tbody></table></div></section>
   ${mine && all.some(t => t.assignee !== S.session.userId && t.status !== "Done") ? `<section class="panel" style="margin-bottom:16px"><div class="hd"><h2>Other open tasks</h2></div><div class="tw"><table><tbody>${maintRows(all.filter(t => t.assignee !== S.session.userId && t.status !== "Done"))}</tbody></table></div></section>` : ""}
   <section class="panel"><div class="hd"><h2>Service history</h2><span class="sp"></span><span class="na">Rp ${fmtN(recs.reduce((s, r) => s + r.cost, 0))} total</span></div><div class="tw"><table><thead><tr><th>Date</th><th>Asset</th><th>Work done</th><th>Technician</th><th>Parts</th><th class="r">Cost</th></tr></thead><tbody>
   ${recs.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${esc(pump(r.pump).short)}</td><td>${esc(r.work)}${r.notes ? `<div class="na">${esc(r.notes)}</div>` : ""}</td><td>${esc(user(r.tech)?.name)}</td><td class="small">${r.parts.map(x => esc(x.name) + " ×" + x.qty).join(", ") || "—"}</td><td class="r num">Rp ${fmtN(r.cost)}</td></tr>`).join("")}</tbody></table></div></section>`);
  return { title: mine ? "My tasks" : "Maintenance", live: false, after: bindMaint };
};
export function maintTab(p) {
  const ts = S.tasks.filter(t => t.pump === p.id), recs = S.records.filter(r => r.pump === p.id);
  return `<section class="panel" style="margin-bottom:16px"><div class="hd"><h2>Tasks</h2><span class="sp"></span>${can("maintain") ? `<button class="btn sm" id="mtnew">New task</button>` : ""}</div><div class="tw"><table><thead><tr><th>Task</th><th>Trigger</th><th>Due</th><th>Technician</th><th>Status</th></tr></thead><tbody>${maintRows(ts) || `<tr><td colspan="5" class="muted">No tasks.</td></tr>`}</tbody></table></div></section>
  <section class="panel"><div class="hd"><h2>Service history</h2></div><div class="tw"><table><thead><tr><th>Date</th><th>Work</th><th>Technician</th><th>Parts</th><th class="r">Cost</th></tr></thead><tbody>${recs.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.work)}<div class="na">${esc(r.notes || "")}</div></td><td>${esc(user(r.tech)?.name)}</td><td class="small">${r.parts.map(x => esc(x.name) + " ×" + x.qty).join(", ") || "—"}</td><td class="r num">Rp ${fmtN(r.cost)}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">No records.</td></tr>`}</tbody></table></div></section>`;
}
export function bindMaint() {
  document.querySelectorAll("[data-mt]").forEach(r => r.onclick = () => openTask(byId(S.tasks, r.dataset.mt)));
  const nb = $("#mtnew"); if (nb) nb.onclick = () => { const p = pump(location.hash.split("/")[2]); modal({ title: "New maintenance task — " + p.short, ok: "Create task", body: `<label class="f">Title<input type="text" id="nt" value="Inspection"></label><label class="f" style="margin-top:8px">Due<input type="date" id="nd" value="${toLocalInput(S.now + 7 * D).slice(0, 10)}"></label>`, onOk: m => { newTask(p, "calendar", $("#nt", m).value, "Manual", fromLocalInput($("#nd", m).value + "T12:00")); } }); };
}
export function openTask(t) {
  const p = pump(t.pump), dg = diagnose(p).find(d => d.key === t.key), ed = can("maintain"), techs = S.users.filter(u => u.org === t.org && u.role === "tech");
  modal({
    title: t.title, wide: true, ok: t.status === "Done" ? "Close" : "Save", body: `<p class="small muted">${esc(p.name)} · ${esc(site(p.site).name)} · due ${fmtDate(t.due)} · trigger: ${esc(t.trigger)}</p>
    ${dg ? `<div class="why" style="margin:8px 0"><b>Why this task exists:</b> ${esc(dg.summary)}<br><span class="small">Evidence: ${esc(dg.evidence.join("; "))}</span></div>` : ""}
    <div class="row" style="margin:8px 0"><label class="f" style="flex-direction:row;align-items:center;gap:8px">Technician <select id="tas" ${ed && S.session.role !== "tech" ? "" : "disabled"}><option value="">Unassigned</option>${techs.map(u => `<option value="${u.id}" ${t.assignee === u.id ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></label></div>
    <h3 style="margin:10px 0 4px">Checklist</h3>${t.checklist.map((c, i) => `<label style="display:flex;gap:8px;padding:4px 0"><input type="checkbox" data-ck="${i}" ${c[1] ? "checked" : ""} ${ed && t.status !== "Done" ? "" : "disabled"}> ${esc(c[0])}</label>`).join("")}
    <details style="margin-top:6px"><summary>Asset quick facts</summary><dl class="kv small" style="margin-top:6px"><dt>Pump</dt><dd>${esc(p.mfr + " " + p.model)}, ${p.serial}</dd><dt>Pump depth</dt><dd>${well(p).pumpDepth} m</dd><dt>Controller</dt><dd>${esc(ctl(p).model)}</dd><dt>Warranty</dt><dd>${p.warranty}</dd><dt>Recent faults</dt><dd>${S.alarms.filter(a => a.pump === p.id && a.sev === "critical").slice(0, 3).map(a => esc(a.title) + " " + fmtDate(a.raisedAt)).join("; ") || "none"}</dd></dl></details>
    ${t.status !== "Done" && ed ? `<h3 style="margin:12px 0 4px">Complete the work</h3><div class="grid g2" style="gap:8px"><label class="f">Parts (name, qty, cost Rp per line)<textarea id="tp" placeholder="Intake screen, 1, 85000"></textarea></label><label class="f">Notes<textarea id="tn"></textarea></label><label class="f">Labour hours<input type="number" id="th" value="2" min="0" step="0.5"></label><label class="f">Labour rate (Rp/h)<input type="number" id="tr" value="75000"></label><label class="f">Before / after photos<input type="file" id="tph" accept="image/*" multiple></label></div>
    <label style="display:flex;gap:8px;margin-top:10px"><input type="checkbox" id="tdone"> Mark task as done and create a service record</label>` : ""}`,
    onOk: m => {
      if (t.status === "Done" || !ed) return;
      m.querySelectorAll("[data-ck]").forEach(c => t.checklist[+c.dataset.ck][1] = c.checked);
      const a = $("#tas", m)?.value; if (a !== undefined && (a || null) !== t.assignee) { audit(S.session.userId, "Task assigned", p.id, user(t.assignee)?.name || "—", user(a)?.name || "—"); t.assignee = a || null; t.status = a ? "Assigned" : "Open"; }
      if (t.checklist.some(c => c[1]) && t.status !== "Done") t.status = "In progress";
      if ($("#tdone", m)?.checked) {
        const parts = $("#tp", m).value.split("\n").map(l => l.split(",").map(x => x.trim())).filter(x => x[0]).map(([name, qty, cost]) => ({ name, qty: +qty || 1, cost: +cost || 0 }));
        const labH = +$("#th", m).value || 0, rate = +$("#tr", m).value || 0, photos = [...($("#tph", m).files || [])].map(f => f.name);
        const r = { id: uid("MR"), org: t.org, pump: p.id, task: t.id, date: S.now, tech: t.assignee || S.session.userId, work: t.title, parts, laborH: labH, laborCost: labH * rate, notes: $("#tn", m).value, photos, cost: parts.reduce((s, x) => s + x.cost * x.qty, 0) + labH * rate };
        S.records.unshift(r); t.status = "Done"; t.done = S.now;
        if (t.key === "calendar") { p.maint.last = S.now; p.maint.next = S.now + p.maint.intervalDays * D; }
        if (t.key === "solar") SIM[p.id].injected = Object.assign(SIM[p.id].injected || {}, { soil: 0.98 });
        if (t.key === "lowflow") SIM[p.id].injected = Object.assign(SIM[p.id].injected || {}, { hyd: 1 });
        if (t.key === "heat") SIM[p.id].injected = Object.assign(SIM[p.id].injected || {}, { hot: 0 });
        audit(S.session.userId, "Maintenance completed", p.id, null, `${t.title} — Rp ${fmtN(r.cost)}`); toast("Service record saved. The fix is now reflected in the simulation.");
      } else audit(S.session.userId, "Maintenance task updated", p.id, null, t.title);
    },
  });
}

/* ---------- ANALYTICS ---------- */
ROUTES.analytics = () => {
  const ps = myPumps(), d0 = dk(S.now);
  const per = { today: [d0, d0, d0 - 1, d0 - 1, "Today", "yesterday"], yesterday: [d0 - 1, d0 - 1, d0 - 2, d0 - 2, "Yesterday", "the day before"], "7d": [d0 - 6, d0, d0 - 13, d0 - 7, "Last 7 days", "the previous 7 days"], "30d": [d0 - 29, d0, d0 - 59, d0 - 30, "Last 30 days", "the previous 30 days"] }[UI.aPer];
  const agg = (list, a, b) => list.reduce((s, p) => { const x = sumDays(p, a, b); s.water += x.water; s.pv += x.pv; s.pump += x.pump; s.run += x.run; return s; }, { water: 0, pv: 0, pump: 0, run: 0 });
  const cur = agg(ps, per[0], per[1]), prev = agg(ps, per[2], per[3]);
  const dlt = (a, b) => b > 0.5 ? `<span class="na">${a >= b ? "▲" : "▼"} ${Math.abs(Math.round((a / b - 1) * 100))}% vs ${per[5]}</span>` : `<span class="na">no comparison data</span>`;
  let body = "";
  if (UI.aTab === "water") {
    const big = (l, v, u, c) => `<div class="kpi"><div class="v">${v}<small>${u}</small></div><div class="l">${l}</div><div style="margin-top:2px">${c}</div></div>`;
    const days = []; for (let d = d0 - 29; d <= d0; d++) days.push({ l: fmtDate(d * D - TZ + 12 * H).split(" ")[0], v: ps.reduce((s, p) => s + (daily(p).find(g => g.day === d)?.water || 0), 0), dim: d === d0 });
    const sites = [...new Set(ps.map(p => p.site))];
    const row = (name, list) => { const x = agg(list, per[0], per[1]); return `<td class="r num">${fmtN(x.water, 1)}</td><td class="r num">${fmtN(x.water / ((per[1] - per[0] + 1)), 1)}</td><td class="r num">${x.run > 0 ? fmtN(x.water * 1000 / (x.run / 60), 0) : "—"}</td><td class="r num">${fmtN(x.pv, 1)}</td><td class="r num">${x.water > 0.5 ? (x.pump / x.water).toFixed(2) : "—"}</td><td class="r num">${x.pv > 0.1 ? fmtN(x.water * 1000 / x.pv, 0) : "—"}</td>`; };
    body = `<div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:16px">${big("Water produced", fmtN(cur.water, 1), "m³", dlt(cur.water, prev.water))}${big("Solar energy", fmtN(cur.pv, 1), "kWh", dlt(cur.pv, prev.pv))}${big("Energy intensity", cur.water > .5 ? (cur.pump / cur.water).toFixed(2) : "—", "kWh/m³", cur.water > .5 && prev.water > .5 ? `<span class="na">${(prev.pump / prev.water).toFixed(2)} ${per[5]} (lower is better)</span>` : "")}${big("Water per solar kWh", cur.pv > .1 ? fmtN(cur.water * 1000 / cur.pv, 0) : "—", "L/kWh", dlt(cur.water / Math.max(.1, cur.pv), prev.water / Math.max(.1, prev.pv)))}</div>
    <section class="panel" style="margin-bottom:16px"><div class="hd"><h2>Daily water production, 30 days</h2><span class="na">all pumps · m³</span></div><div class="bd">${barChart({ items: days, unit: "m³", label: "Fleet daily water" })}</div></section>
    <section class="panel"><div class="hd"><h2>${per[4]} by site and pump</h2></div><div class="tw"><table><thead><tr><th>Site / pump</th><th class="r">Water (m³)</th><th class="r">m³ per day</th><th class="r">L per hour running</th><th class="r">Solar (kWh)</th><th class="r">kWh/m³</th><th class="r">L per solar kWh</th></tr></thead><tbody>
    ${sites.map(s => `<tr style="background:var(--paper)"><td><b>${esc(site(s).name)}</b></td>${row(s, ps.filter(p => p.site === s))}</tr>` + ps.filter(p => p.site === s).map(p => `<tr class="click" data-p="${p.id}"><td style="padding-left:26px">${esc(p.short)}</td>${row(p.id, [p])}</tr>`).join("")).join("")}</tbody></table></div></section>`;
  } else if (UI.aTab === "wells") {
    const ws = ps.map(p => [p, wellM(p)]);
    const series = ws.filter(x => x[1]).map(([p, w], i) => ({ label: p.short, color: ["var(--water)", "var(--well)", "var(--power)", "var(--solar)", "var(--press)"][i % 5], get: x => x.m[p.id] }));
    const pts = []; for (let d = d0 - 29; d <= d0; d++) { const m = {}; for (const [p, w] of ws) if (w) m[p.id] = w.days.find(g => g.day === d)?.static; pts.push({ t: d * D - TZ + 5.5 * H, m }); }
    body = `<section class="panel" style="margin-bottom:16px"><div class="hd"><h2>Well behaviour</h2><span class="na">from well-level sensors; wells without one are listed so the gap is visible</span></div><div class="tw"><table><thead><tr><th>Well</th><th class="r">Resting level</th><th class="r">30-day change</th><th class="r">Pumping level now</th><th class="r">Drawdown</th><th class="r">Recovery (7d / 30d)</th><th class="r">Sustainable rate</th><th class="r">Dry trips 7d</th><th>What it means</th></tr></thead><tbody>
    ${ws.map(([p, w]) => !w ? `<tr><td>${esc(well(p).name)}</td><td colspan="8" class="na">No well-level sensor — static level from drilling log ${well(p).static} m</td></tr>` : `<tr class="click" data-p="${p.id}" data-tab="well"><td>${esc(well(p).name)}</td><td class="r num">${r1(w.static)} m</td><td class="r num" style="color:${w.staticTrend > 1 ? "var(--warn)" : "inherit"}">${w.staticTrend > 0 ? "+" : ""}${r1(w.staticTrend)} m</td><td class="r num">${r1(w.level)} m</td><td class="r num">${r1(Math.max(0, w.drawdown))} m</td><td class="r num">${w.rec7 ? fmtDur(w.rec7) + " / " + fmtDur(w.rec30) : "—"}</td><td class="r num">${w.sustain ? Math.round(w.sustain) + " L/min" : "—"}</td><td class="r num" style="color:${w.dry7 ? "var(--crit)" : "inherit"}">${w.dry7}</td><td class="small" style="min-width:220px">${w.dry7 ? `Over-pumped: rated ${p.Q} L/min but the well sustains ≈${Math.round(w.sustain)} L/min.` : w.staticTrend > 1 ? `${well(p).name} is ${r1(w.staticTrend)} m deeper than a month ago${w.recSlower > 8 ? ` and recovering ${Math.round(w.recSlower)}% slower than its 30-day baseline` : ""}.` : "Stable."}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="panel"><div class="hd"><h2>Resting water level, 30 days</h2><span class="na">metres below ground — a line moving down means the aquifer is dropping</span></div><div class="bd">${lineChart({ from: S.now - 30 * D, to: S.now, pts, unit: "m", invert: true, series })}<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join("")}</div></div></section>`;
  } else {
    body = `<section class="panel"><div class="hd"><h2>Performance against baseline</h2><span class="na">flow delivered as % of what the pump's power should give, per day</span></div><div class="bd"><div class="chgrid">${ps.map(p => `<div class="chbox"><h4>${esc(p.short)}<span>${perfRatio(p, 2) ? Math.round(perfRatio(p, 2) * 100) + "% now" : ""}</span></h4>${barChart({ items: daily(p).filter(g => g.n > 3).slice(-30).map(g => ({ l: fmtDate(g.day * D - TZ + 12 * H).split(" ")[0], v: g.flowSum / g.expSum * 100, c: g.flowSum / g.expSum < 0.85 ? "var(--warn)" : "var(--ok)" })), unit: "%", fmt: 0, h: 120, label: p.short + " performance" })}</div>`).join("")}</div></div></section>`;
  }
  setView(`<div class="row" style="margin-bottom:14px"><div class="tabs" style="margin:0;border:0">${[["water", "Water & energy"], ["wells", "Wells"], ["perf", "Performance"]].map(([k, l]) => `<button data-an="${k}" class="${UI.aTab === k ? "on" : ""}">${l}</button>`).join("")}</div><span style="flex:1"></span>${UI.aTab === "water" ? `<div class="seg">${[["today", "Today"], ["yesterday", "Yesterday"], ["7d", "7 days"], ["30d", "30 days"]].map(([k, l]) => `<button data-per="${k}" class="${UI.aPer === k ? "on" : ""}">${l}</button>`).join("")}</div>` : ""}</div>${body}`);
  return { title: "Water & wells", after() { bindRows(); document.querySelectorAll("[data-an]").forEach(b => b.onclick = () => { UI.aTab = b.dataset.an; renderAll(); }); document.querySelectorAll("[data-per]").forEach(b => b.onclick = () => { UI.aPer = b.dataset.per; renderAll(true); }); } };
};

/* ---------- PUMPS: asset directory (detail cards + data matrix) ---------- */
ROUTES.pumps = () => {
  const ps = myPumps();
  if (!ps.length) { setView(`<div class="panel"><div class="bd">No assets you can see yet.</div></div>`); return { title: "Pumps" }; }
  const rows = ps.map(p => {
    const st = statusM(p), h = healthM(p), lt = last(p.id), m = lt?.m || {}, t = today(p);
    const top = diagM(p).find(d => d.sev !== "info") || null;
    const rank = st.c === "crit" ? 0 : st.c === "off" ? 1 : st.c === "warn" ? 2 : 3;
    return { p, st, h, m, t, lt, top, top1: top ? top.summary.split(/(?<=\.)\s/)[0] : "", rank, off: st.c === "off", perf: perfRatio(p, 2), flow: m.flow_lpm || 0, kw: (m.pump_power || 0) / 1000 };
  });
  const sites = [...new Set(rows.map(r => r.p.site))];
  const counts = {
    all: rows.length,
    run: rows.filter(r => !r.off && r.st.pump === "running").length,
    warn: rows.filter(r => r.st.c === "warn").length,
    crit: rows.filter(r => r.st.c === "crit").length,
    off: rows.filter(r => r.off).length,
  };
  let list = rows.filter(r => UI.puF === "all" || (UI.puF === "run" ? !r.off && r.st.pump === "running" : UI.puF === "warn" ? r.st.c === "warn" : UI.puF === "crit" ? r.st.c === "crit" : r.off));
  if (UI.puSite !== "all") list = list.filter(r => r.p.site === UI.puSite);
  const sorts = { urg: (a, b) => a.rank - b.rank || a.h.score - b.h.score, id: (a, b) => a.p.id.localeCompare(b.p.id), flow: (a, b) => b.flow - a.flow, health: (a, b) => a.h.score - b.h.score };
  list = [...list].sort(sorts[UI.puSort] || sorts.urg);
  const sortLbl = { urg: "most urgent first", id: "pump ID", flow: "highest flow first", health: "lowest health first" }[UI.puSort];
  const kpi = (l, v, c) => `<div class="kpi ${c || ""}" role="listitem"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const flowNow = rows.reduce((s, r) => s + (r.off ? 0 : r.flow), 0);
  const draw = rows.reduce((s, r) => s + (r.off ? 0 : r.kw), 0), rated = ps.reduce((s, p) => s + p.P / 1000, 0);
  const cell = (l, v, n) => `<div class="cell"><div class="cl">${l}</div><div class="cv">${v}</div>${n ? `<div class="cn">${n}</div>` : ""}</div>`;
  const noS = t => `<span class="na" style="font:500 14px var(--num)">${t}</span>`;
  const card = r => {
    const { p, st, h, m, t, lt, top, off, perf } = r, w = wellM(p);
    const stale = off ? "stale · last known" : "";
    return `<article class="pcard">
     <div class="ph"><span class="pn">${esc(p.short)}</span>${pill(st.c, off ? "Offline" : st.label)}</div>
     <div class="pmeta">${esc(site(p.site).name.split(" — ")[0])} · ${esc(well(p).name)}<br>${esc(p.mfr)} ${esc(p.model)} · SN ${esc(p.sn)}<br><span class="na">${off ? esc(st.detail) : "IoT: " + esc(st.iot.t) + " · " + esc(st.iot.d)}</span></div>
     <div class="row small" style="justify-content:space-between"><span>${hbar(h.score)}</span><span class="na">${esc((h.reasons[0]?.txt || "No open findings").slice(0, 44))}${(h.reasons[0]?.txt || "").length > 44 ? "…" : ""}</span></div>
     ${top ? `<div class="pdg ${top.sev}"><b>${esc(r.top1)}</b><div class="act">${esc(top.action.split(/(?<=\.)\s/)[0])}</div></div>` : ""}
     <div class="tel">
      ${cell("Hydraulic flow", !has(p, "flow_lpm") ? noS("no sensor") : `${fmtN(r.flow, 1)}<small>L/min</small>`, !has(p, "flow_lpm") ? "" : stale || (st.pump === "running" && perf ? `<b style="color:var(--${perf >= 0.85 ? "ok" : "warn"})">${Math.round(perf * 100)}%</b> of expected at this power` : st.pump === "running" ? "no baseline yet" : ""))}
      ${cell("Pump power", !has(p, "pump_power") ? noS("no sensor") : `${fmtN(r.kw, 2)}<small>kW</small>`, !has(p, "pump_power") ? "" : stale || `${Math.round((m.pump_power || 0) / p.P * 100)}% of ${r1(p.P / 1000)} kW rated`)}
      ${cell("Well level", w ? `${r1(w.level)}<small>m below</small>` : noS("no sensor"), w ? `static ${r1(well(p).static)} · drawdown ${r1(w.drawdown)} m` : `static ${r1(well(p).static)} m from drilling log`)}
      ${cell("Water today", `${fmtN(t.water, 1)}<small>m³</small>`, `${fmtDur(t.run)} runtime${off ? " · partial" : ""}`)}
     </div>
     <div class="pfoot"><a class="btn sm pri" href="#/pump/${p.id}">Open pump</a><a class="btn sm" href="#/pump/${p.id}/diagnostics">Diagnostics</a><span class="sp"></span><span class="na small">${fmtAgo(lt?.t)}</span></div>
    </article>`;
  };
  const wellTd = r => { const w = wellM(r.p); return w ? `<span class="num">${r1(w.level)} m</span><div class="na">drawdown ${r1(w.drawdown)} m</div>` : `<span class="na">${r1(well(r.p).static)} m (log)</span><div class="na">no level sensor</div>`; };
  const tbl = `<div class="tw"><table><thead><tr><th>Unit</th><th>Site / well</th><th>State</th><th class="r">Flow (L/min)</th><th class="r">Power (kW)</th><th class="r">Well level</th><th class="r">Water today</th><th>Health</th><th>Last seen</th><th></th></tr></thead><tbody>
   ${list.map(r => `<tr class="click" data-p="${r.p.id}"${r.st.c !== "ok" && !r.off ? ` data-tab="diagnostics"` : ""}><td><b>${esc(r.p.short)}</b><div class="na">${esc(r.p.mfr)} ${esc(r.p.model)} · SN ${esc(r.p.sn)}</div></td><td>${esc(site(r.p.site).name.split(" — ")[0])}<div class="na">${esc(well(r.p).name)}</div></td><td>${pill(r.st.c, r.off ? "Offline" : r.st.label)}${r.top ? `<div class="na">${esc(r.top1.slice(0, 42) + (r.top1.length > 42 ? "…" : ""))}</div>` : ""}</td>
   <td class="r">${!has(r.p, "flow_lpm") ? nos() : `<span class="num">${fmtN(r.flow, 1)}</span>${r.perf && r.st.pump === "running" ? `<div class="na">${Math.round(r.perf * 100)}% exp</div>` : ""}`}</td>
   <td class="r">${!has(r.p, "pump_power") ? nos() : `<span class="num">${fmtN(r.kw, 2)}</span><div class="na">${Math.round((r.m.pump_power || 0) / r.p.P * 100)}% rated</div>`}</td>
   <td class="r">${wellTd(r)}</td><td class="r num">${fmtN(r.t.water, 1)}<div class="na">${fmtDur(r.t.run)}</div></td><td>${hbar(r.h.score)}</td><td class="small">${fmtAgo(r.lt?.t)}</td><td><a class="btn sm" href="#/pump/${r.p.id}/diagnostics">Diagnostics</a></td></tr>`).join("") || `<tr><td colspan="10" class="muted">No units match this filter.</td></tr>`}</tbody></table></div>`;
  setView(`
  <div class="kpis k7" role="list" style="margin-bottom:14px">
   ${kpi("Units", `${rows.length}<small>across ${sites.length} site${sites.length === 1 ? "" : "s"}</small>`)}
   ${kpi("Running now", `${counts.run}<small>/${rows.length}</small>`, counts.run ? "ok" : "")}
   ${kpi("Attention", counts.warn, counts.warn ? "warn" : "")}
   ${kpi("Critical", counts.crit, counts.crit ? "crit" : "")}
   ${kpi("Offline", counts.off, counts.off ? "off" : "")}
   ${kpi("Fleet flow now", `${fmtN(flowNow, 0)}<small>L/min</small>`)}
   ${kpi("Solar draw", `${r1(draw)}<small>kW</small><div class="l" style="margin-top:1px">of ${r1(rated)} kWp rated</div>`)}
  </div>
  <div class="row" style="margin-bottom:12px;gap:8px">
   <div class="seg" role="group" aria-label="Filter by state">${[["all", "All", counts.all], ["run", "Running", counts.run], ["warn", "Attention", counts.warn], ["crit", "Critical", counts.crit], ["off", "Offline", counts.off]].map(([k, l, n]) => `<button data-pf="${k}" class="${UI.puF === k ? "on" : ""}">${l} <span class="na">${n}</span></button>`).join("")}</div>
   <div class="seg" role="group" aria-label="Filter by site"><button data-psite="all" class="${UI.puSite === "all" ? "on" : ""}">All sites</button>${sites.map(s => `<button data-psite="${s}" class="${UI.puSite === s ? "on" : ""}">${esc(site(s).name.split(" — ")[0])}</button>`).join("")}</div>
   <span style="flex:1"></span>
   <div class="seg" role="group" aria-label="Sort units" title="Sort order">${[["urg", "Urgency", "Most urgent first"], ["id", "Pump ID", "Pump identifier"], ["flow", "Flow", "Highest flow first"], ["health", "Health", "Lowest health first"]].map(([k, l, tip]) => `<button data-psort="${k}" class="${UI.puSort === k ? "on" : ""}" title="${tip}">${l}</button>`).join("")}</div>
  </div>
  <section class="panel"><div class="hd"><h2>${list.length} of ${rows.length} units in view</h2><span class="na">sorted by ${sortLbl}</span><span class="sp"></span>
   <div class="seg" role="group" aria-label="View"><button data-pv="cards" class="${UI.puView === "cards" ? "on" : ""}" title="Detailed cards">Cards</button><button data-pv="table" class="${UI.puView === "table" ? "on" : ""}" title="Data matrix">Matrix</button></div></div>
   ${UI.puView === "cards" ? `<div class="bd"><div class="pgrid">${list.map(card).join("") || `<p class="muted">No units match this filter.</p>`}</div></div>` : tbl}</section>`);
  return {
    title: "Pumps", after() {
      bindRows();
      document.querySelectorAll("[data-pf]").forEach(b => b.onclick = () => { UI.puF = b.dataset.pf; renderAll(true); });
      document.querySelectorAll("[data-psite]").forEach(b => b.onclick = () => { UI.puSite = b.dataset.psite; renderAll(true); });
      document.querySelectorAll("[data-psort]").forEach(b => b.onclick = () => { UI.puSort = b.dataset.psort; renderAll(true); });
      document.querySelectorAll("[data-pv]").forEach(b => b.onclick = () => { UI.puView = b.dataset.pv; renderAll(true); });
    },
  };
};

/* ---------- CONTROL: automation + schedules ---------- */
export const MET_L = { tank_level_pct: "Tank level (%)", pv_power: "Solar power (W)", flow_lpm: "Flow (L/min)", pump_power: "Pump power (W)", pump_power_pct: "Pump power (% of rated)", well_margin_m: "Well margin above min safe (m)", well_level_m: "Well level (m below ground)", ctrl_temp_c: "Controller temp (°C)", fault: "Pump fault" };
export const ACT_L = { stop: "Stop pump", start: "Start pump (overrides schedule)", stop_alert: "Stop pump + critical alert", notify_ops: "Notify operations manager" };
export const condTxt = c => c.m === "fault" ? "a pump fault occurs" : `${MET_L[c.m].replace(/ \(.*\)/, "").toLowerCase()} ${c.op} ${c.v}${c.for ? ` for ${c.for} min` : ""}`;
ROUTES.control = () => {
  const ed = can("configure"), aus = scoped(S.automations), sch = scoped(S.schedules);
  setView(`${!ed ? `<p class="banner">Read-only: your role can't change automations or schedules.</p>` : ""}
  <section class="panel" style="margin-bottom:16px"><div class="hd"><h2>Automation rules</h2><span class="sp"></span>${ed ? `<button class="btn sm pri" id="newrule">New rule</button>` : ""}</div><div class="tw"><table><thead><tr><th>On</th><th>Rule</th><th>Logic</th><th class="r">Times fired</th></tr></thead><tbody>
  ${aus.map(a => `<tr><td><input type="checkbox" data-aut="${a.id}" ${a.enabled ? "checked" : ""} ${ed ? "" : "disabled"} aria-label="Enable ${esc(a.name)}"></td><td><b>${esc(a.name)}</b><div class="na">${esc(a.createdBy)} · applies to ${a.scope === "all" ? "all pumps" : a.scope.map(x => pump(x).short).join(", ")}</div></td><td class="small">IF ${a.when.map(condTxt).join(" AND ")} THEN ${ACT_L[a.then].toLowerCase()}${a.release ? ` · release when ${condTxt(a.release)}` : a.releaseAfter ? ` · release after ${a.releaseAfter} min` : ""}</td><td class="r num">${a.fired}</td></tr>`).join("")}
  </tbody></table></div><div class="bd small muted">Rules that need a sensor a pump doesn't have are skipped for that pump, never guessed. Rules are evaluated on every reading; stop-holds release with hysteresis so pumps don't chatter on and off.</div></section>
  <section class="panel"><div class="hd"><h2>Schedules</h2><span class="sp"></span><span class="na">Format: 06:00-10:00, 14:00-17:00</span></div><div class="tw"><table><thead><tr><th>Pump</th><th>Windows</th><th>Always respects</th><th></th></tr></thead><tbody>
  ${sch.map(s => `<tr><td><b>${esc(pump(s.pump).short)}</b></td><td><input type="text" data-sch="${s.id}" value="${s.windows.map(w => w.join("-")).join(", ")}" ${ed ? "" : "disabled"} style="width:220px" aria-label="Schedule for ${esc(pump(s.pump).short)}"></td><td class="small">${s.respect.join(" · ")}</td><td>${ed ? `<button class="btn sm" data-schs="${s.id}">Save</button>` : ""}</td></tr>`).join("")}</tbody></table></div></section>`);
  return {
    title: "Automation & schedules", live: false, after() {
      document.querySelectorAll("[data-aut]").forEach(c => c.onchange = () => { const a = byId(S.automations, c.dataset.aut); a.enabled = c.checked; audit(S.session.userId, "Automation " + (c.checked ? "enabled" : "disabled"), null, String(!c.checked), a.name); if (!c.checked) for (const p of S.pumps) delete SIM[p.id].inhibit[a.id]; toast(`Rule ${c.checked ? "enabled" : "disabled"}.`); });
      document.querySelectorAll("[data-schs]").forEach(b => b.onclick = () => { const s = byId(S.schedules, b.dataset.schs), v = $(`[data-sch="${s.id}"]`).value; const w = v.split(",").map(x => x.trim().split("-").map(y => y.trim())).filter(x => x.length === 2 && x.every(y => /^\d{2}:\d{2}$/.test(y))); if (!w.length) return toast("Use the format 06:00-10:00, 14:00-17:00."); const o = s.windows.map(x => x.join("–")).join(", "); s.windows = w; audit(S.session.userId, "Schedule changed", s.pump, o, w.map(x => x.join("–")).join(", ")); toast("Schedule saved for " + pump(s.pump).short + "."); });
      if ($("#newrule")) $("#newrule").onclick = () => modal({
        title: "New automation rule", ok: "Create rule", body: `<label class="f">Name<input type="text" id="rn" value="My rule"></label>
        <div class="row" style="margin-top:10px"><span class="small">IF</span><select id="rm">${Object.entries(MET_L).filter(([k]) => k !== "fault").map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select><select id="ro"><option>&gt;</option><option>&lt;</option></select><input type="number" id="rv" value="50" style="width:90px"><span class="small">for</span><input type="number" id="rf" value="0" style="width:64px"><span class="small">min</span></div>
        <div class="row" style="margin-top:10px"><span class="small">THEN</span><select id="ra">${Object.entries(ACT_L).filter(([k]) => k !== "notify_ops").map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
        <label class="f" style="margin-top:10px">Apply to<select id="rs"><option value="all">All pumps</option>${myPumps().map(p => `<option value="${p.id}">${esc(p.short)}</option>`).join("")}</select></label>
        <p class="small muted" style="margin-top:8px">Stop rules release when the condition has been false for one reading. Well protection and controller faults always take priority over start rules.</p>`,
        onOk: m => { const r = { id: uid("AUT"), org: S.orgId, name: $("#rn", m).value, when: [{ m: $("#rm", m).value, op: $("#ro", m).value, v: +$("#rv", m).value, ...(+$("#rf", m).value ? { for: +$("#rf", m).value } : {}) }], then: $("#ra", m).value, scope: $("#rs", m).value === "all" ? "all" : [$("#rs", m).value], enabled: true, fired: 0, createdBy: user(S.session.userId).name }; S.automations.push(r); audit(S.session.userId, "Automation created", null, null, r.name); }
      });
    },
  };
};

/* ---------- DEVICES ---------- */
ROUTES.devices = () => {
  const ds = scoped(S.devices), ed = can("configure");
  const lg = S.ingestLog.filter(e => !e.device || byId(S.devices, e.device)?.org === S.orgId).slice(0, 14);
  const lastNorm = lg.find(e => e.norm)?.norm;
  setView(`<p class="lead-sum" style="margin-bottom:14px">IoT health is tracked separately from pump health — a pump can be fine while its device has weak signal, and vice versa.</p>
  <section class="panel" style="margin-bottom:16px"><div class="hd"><h2>Devices</h2></div><div class="tw"><table><thead><tr><th>Device</th><th>Pump</th><th>Status</th><th>Hardware / adapter</th><th>Network</th><th class="r">Signal</th><th class="r">Battery</th><th>Firmware</th><th class="r">Uptime</th><th class="r">Retries</th><th class="r">Buffered</th><th>Last upload</th><th>Credential</th><th></th></tr></thead><tbody>
  ${ds.map(d => { const p = pump(d.asset), st = statusM(p).iot; return `<tr><td><b>${d.id}</b></td><td><a href="#/pump/${p.id}">${esc(p.short)}</a><div class="na">pump: ${statusM(p).c === "off" ? "unknown" : statusM(p).label.toLowerCase()}</div></td><td>${pill(st.c, st.t)}</td><td class="small">${esc(d.hw)}<div class="na">${ADAPTERS[d.adapter].label}</div></td><td class="small">${esc(d.net)}<div class="na">${esc(d.sim)}</div></td><td class="r num">${d.online ? (d.rssiNow ?? d.rssi) + " dBm" : "—"}</td><td class="r num">${d.online ? d.battery + " V" : "—"}</td><td class="num">${d.fw}</td><td class="r num">${Math.floor(d.uptimeH / 24)} d</td><td class="r num">${(d.lost / Math.max(1, d.sent) * 100).toFixed(1)}%</td><td class="r num">${SIM[p.id].buffer.length || "—"}</td><td>${fmtAgo(d.lastUpload)}</td><td class="small"><span class="num">${d.fp}</span>${d.rotatedAt ? `<div class="na">rotated ${fmtDT(d.rotatedAt)}</div>` : ""}</td><td>${ed ? `<button class="btn sm" data-rot="${d.id}">Rotate</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>
  <div class="bd small muted">Each device authenticates with its own secret (only a hash is stored server-side; this screen shows a fingerprint, never the secret). Rotation issues a new secret and keeps the old one valid for 24 h so a field device can be re-provisioned without data loss.</div></section>
  <div class="grid g2"><section class="panel"><div class="hd"><h2>Ingestion log</h2><span class="na">latest first</span></div><div class="tw"><table><tbody>${lg.map(e => `<tr><td class="num small" style="white-space:nowrap">${fmtTime(e.at)}</td><td class="small">${e.device || "?"}</td><td class="small">${!e.ok ? `<span style="color:var(--crit)">Rejected: ${esc(e.err)}</span>` : e.flush ? `Buffer flush: <b>${e.accepted}</b> accepted, <b>${e.dup}</b> duplicates dropped` : e.dup ? `Duplicate seq ${e.seq} dropped` : `seq ${e.seq} accepted${e.src === "buffered" ? " (late, original timestamp kept)" : ""} · ${ADAPTERS[e.adapter].label.split(" ")[0]}`}</td></tr>`).join("") || `<tr><td class="muted">Waiting for live data…</td></tr>`}</tbody></table></div></section>
  <section class="panel"><div class="hd"><h2>Latest normalized event</h2><span class="na">every adapter produces this shape</span></div><div class="bd"><pre class="code">${esc(JSON.stringify(lastNorm ? { ...lastNorm, timestamp: new Date(lastNorm.timestamp).toISOString(), received_at: new Date(lastNorm.received_at).toISOString() } : {}, null, 2))}</pre></div></section></div>`);
  return {
    title: "IoT devices", after() {
      document.querySelectorAll("[data-rot]").forEach(b => b.onclick = () => { const d = byId(S.devices, b.dataset.rot); modal({ title: "Rotate credential for " + d.id + "?", ok: "Rotate credential", body: `<p>A new secret is generated and pushed to the device over its authenticated channel. The current secret stays valid for 24 hours, then stops working.</p>`, onOk: () => { const p = pump(d.asset), sec = "sk_" + fnv(d.id + Math.random()) + fnv(String(S.now)); const old = d.fp; d.prevHash = d.secretHash; d.prevUntil = S.now + D; d.secretHash = fnv(sec); d.fp = d.secretHash.slice(0, 4) + "…" + d.secretHash.slice(-4); d.rotatedAt = S.now; SIM[p.id].secret = sec; audit(S.session.userId, "Device credential rotated", p.id, old, d.fp); toast("New credential issued to " + d.id + "."); } }); });
    },
  };
};
