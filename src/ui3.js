/* ---------- ALERTS ---------- */
import { $, ADAPTERS, D, H, MIN, ROLES, S, SIM, TZ, audit, byId, can, ctl, dk, fmtAgo, fmtDT, fmtDate, fmtDur, fmtN, fmtTime, fnv, has, last, myPumps, notify, pump, r1, scoped, site, toast, uid, user, well } from './core.js';
import { daily, diagnose, perfRatio, sumDays, today } from './intel.js';
import { ROUTES, UI, barChart, bindRows, diagM, esc, go, hbar, healthM, lineChart, nos, pill, renderAll, setView, sev, stCell, statusM, wellM } from './ui1.js';
import { bindAck, fromLocalInput, modal, toLocalInput } from './ui2.js';
import { tl, tlk, tlx } from './i18n.js';
ROUTES.alerts = () => {
  const all = scoped(S.alarms), f = { open: a => a.state === "active", ack: a => a.state === "acknowledged", cleared: a => a.state === "cleared", all: () => true }[UI.alertTab];
  const list = all.filter(f).slice(0, 200);
  const cnt = k => all.filter({ open: a => a.state === "active", ack: a => a.state === "acknowledged", cleared: a => a.state === "cleared", all: () => true }[k]).length;
  setView(`<div class="tabs">${[["open", tl("Active")], ["ack", tl("Acknowledged")], ["cleared", tl("Cleared")], ["all", tl("All")]].map(([k, l]) => `<button class="${UI.alertTab === k ? "on" : ""}" data-at="${k}">${l} <span class="na">${cnt(k)}</span></button>`).join("")}</div>
  <section class="panel"><div class="hd"><h2>${tl("{n} alerts", { n: list.length })}</h2><span class="sp"></span>${(h => `<span class="na hw">${h}</span><details class="hm"><summary>${tl("How alerts work")}</summary><p class="na">${h}</p></details>`)(tl("Duplicates are merged (count shows repeats); alerts wait for the condition to persist, clear with hysteresis, and observe a {m}-minute cooldown.", { m: S.thresholds.cooldownMin }))}</div>
  <div class="tw"><table class="stk al"><thead><tr><th>${tl("Severity")}</th><th>${tl("Asset")}</th><th>${tl("Alert")}</th><th>${tl("Raised")}</th><th>${tl("Duration")}</th><th>${tl("State")}</th><th></th></tr></thead><tbody>
  ${list.map(a => { const p = pump(a.pump); return `<tr><td>${sev(a.sev)}</td><td class="as"><a href="#/pump/${p.id}">${esc(p.short)}</a><div class="na">${esc(site(p.site).name.split(" — ")[0])}</div></td><td>${esc(tlx(a.title))}${a.occurrences > 1 ? ` <span class="na">×${a.occurrences}</span>` : ""}${a.msg ? `<div class="na">${esc(tlx(a.msg))}</div>` : ""}${Object.keys(a.evidence).length ? `<details><summary>${tl("Evidence at trigger")}</summary><div class="small">${Object.entries(a.evidence).filter(([, v]) => v).map(([k, v]) => `${esc(tlx(k))}: <b>${esc(tlx(v))}</b>`).join(" · ")}</div></details>` : ""}${a.escalated ? `<div class="na" style="color:var(--crit)">${tl("Escalated to owner")}</div>` : ""}</td>
   <td data-l="${tl("Raised")}">${fmtDT(a.raisedAt)}</td><td class="num" data-l="${tl("Open")}">${fmtDur(((a.clearedAt || S.now) - a.raisedAt) / MIN)}</td><td>${a.state === "active" ? pill(a.sev === "critical" ? "crit" : a.sev === "warning" ? "warn" : "off", tl("Active")) : a.state === "acknowledged" ? pill("warn", tl("Acknowledged")) + `<div class="na">${esc(user(a.ackBy)?.name)} ${fmtTime(a.ackAt)}</div>` : pill("off", tl("Cleared"))}</td>
   <td class="r" style="white-space:nowrap">${a.state === "active" && can("ack") ? `<button class="btn sm" data-ack="${a.id}">${tl("Acknowledge")}</button> ` : ""}${a.incident ? `<a class="btn sm" href="#/incident/${a.incident}">${tl("Incident")}</a>` : a.state !== "cleared" && a.sev !== "info" && can("ack") ? `<button class="btn sm" data-inc="${a.id}">${tl("Create incident")}</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="7" class="muted">${tl("No alerts here.")}</td></tr>`}
  </tbody></table></div></section>`);
  return { title: tl("Alerts"), after() { document.querySelectorAll("[data-at]").forEach(b => b.onclick = () => { UI.alertTab = b.dataset.at; renderAll(); }); bindAck(); document.querySelectorAll("[data-inc]").forEach(b => b.onclick = () => go("#/incident/" + makeIncident(byId(S.alarms, b.dataset.inc)).id)); } };
};
export function makeIncident(a, quiet) {
  const p = pump(a.pump), dg = diagnose(p)[0];
  const i = { id: uid("INC"), org: a.org, pump: a.pump, alarm: a.id, title: `${p.short}: ${a.title}`, sev: a.sev, detectedAt: a.raisedAt, assignee: null, status: "Open", diagnosis: dg ? dg.likely + " — " + dg.summary : "", actions: [], parts: [], resolution: "", cost: 0, photos: [], notes: "" };
  S.incidents.unshift(i); a.incident = i.id; if (!quiet) audit(S.session.userId, tlk("Incident created from alarm"), a.pump, null, i.title); return i;
}

/* ---------- INCIDENTS ---------- */
export const INC_ST = [tlk("Open"), tlk("Acknowledged"), tlk("Assigned"), tlk("In Progress"), tlk("Resolved"), tlk("Closed")];
const incT = i => { const m = String(i.title).match(/^([^:]+): (.*)$/); return m ? m[1] + ": " + tlx(m[2]) : tlx(i.title); };
ROUTES.incidents = () => {
  const list = scoped(S.incidents);
  setView(`<section class="panel"><div class="hd"><h2>${tl("Incidents")}</h2><span class="sp"></span><span class="na">${tl("Create one from any critical or warning alert to track the fix end-to-end.")}</span></div><div class="tw"><table class="stk inc"><thead><tr><th>${tl("Incident")}</th><th>${tl("Severity")}</th><th>${tl("Detected")}</th><th>${tl("Assigned")}</th><th>${tl("Status")}</th><th class="r">${tl("Cost")}</th></tr></thead><tbody>
  ${list.map(i => `<tr class="click" data-i="${i.id}"><td><b>${esc(incT(i))}</b><div class="na">${i.id}</div></td><td>${sev(i.sev)}</td><td data-l="${tl("Detected")}">${fmtDT(i.detectedAt)}</td><td data-l="${tl("Assigned")}">${esc(user(i.assignee)?.name || "—")}</td><td>${pill(["Resolved", "Closed"].includes(i.status) ? "ok" : i.status === "Open" ? "crit" : "warn", tlx(i.status))}</td><td class="r num">${i.cost ? "Rp " + fmtN(i.cost) : "—"}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">${tl("No incidents. Convert a critical alert into an incident from the Alerts page.")}</td></tr>`}
  </tbody></table></div></section>`);
  return { title: tl("Incidents"), after() { document.querySelectorAll("[data-i]").forEach(r => r.onclick = () => go("#/incident/" + r.dataset.i)); } };
};
ROUTES.incident = (id) => {
  const i = byId(S.incidents, id); if (!i || i.org !== S.orgId) { setView("<div class='panel'><div class='bd'>" + tl("Incident not found.") + "</div></div>"); return { title: tl("Incident") }; }
  const p = pump(i.pump), techs = S.users.filter(u => u.org === i.org && ["tech", "ops"].includes(u.role)), ed = can("maintain") || can("ack");
  const k = INC_ST.indexOf(i.status);
  setView(`<div class="grid g-main"><div class="stack"><section class="panel"><div class="hd"><h2>${esc(incT(i))}</h2><span class="sp"></span>${sev(i.sev)}</div><div class="bd">
   <div class="row" style="margin-bottom:14px">${INC_ST.map((s, j) => `<button class="btn sm ${j === k ? "pri" : ""}" data-ist="${s}" ${ed ? "" : "disabled"} ${j < k ? 'style="opacity:.6"' : ""}>${j < k ? "✓ " : ""}${tlx(s)}</button>`).join("")}</div>
   <dl class="kv"><dt>${tl("Asset")}</dt><dd><a href="#/pump/${p.id}">${esc(p.name)}</a>, ${esc(site(p.site).name)}</dd><dt>${tl("Detected")}</dt><dd>${fmtDT(i.detectedAt)}</dd><dt>${tl("Source alarm")}</dt><dd>${esc(tlx(byId(S.alarms, i.alarm)?.title) || "—")}</dd>
   <dt>${tl("Assigned to")}</dt><dd><select id="iasg" ${ed ? "" : "disabled"}><option value="">${tl("Unassigned")}</option>${techs.map(t => `<option value="${t.id}" ${i.assignee === t.id ? "selected" : ""}>${esc(t.name)} — ${esc(tlx(ROLES[t.role].label))}</option>`).join("")}</select></dd>
   <dt>${tl("Diagnosis")}</dt><dd>${esc(tlx(i.diagnosis) || "—")}</dd></dl>
   <h3 style="margin:16px 0 6px">${tl("Actions taken")}</h3>${i.actions.length ? `<ul class="reasons">${i.actions.map(a => `<li><span class="na" style="min-width:90px">${fmtDT(a.at)}</span><span><b>${esc(user(a.by)?.name || a.by)}:</b> ${esc(tlx(a.text))}</span></li>`).join("")}</ul>` : `<p class="muted small">${tl("Nothing logged yet.")}</p>`}
   ${ed ? `<div class="row" style="margin-top:8px"><input type="text" id="iact" placeholder="${tl("Log an action, e.g. 'Reduced controller max frequency to 42 Hz'")}" style="flex:1;min-width:220px"><button class="btn" id="iadd">${tl("Add")}</button></div>` : ""}</div></section></div>
   <div class="stack"><section class="panel"><div class="hd"><h2>${tl("Resolution")}</h2></div><div class="bd stack" style="gap:10px">
    <label class="f">${tl("Parts used (one per line: name, qty, cost in Rp)")}<textarea id="iparts" ${ed ? "" : "disabled"}>${esc(i.parts.map(x => `${x.name}, ${x.qty}, ${x.cost}`).join("\n"))}</textarea></label>
    <label class="f">${tl("Resolution")}<textarea id="ires" ${ed ? "" : "disabled"}>${esc(i.resolution)}</textarea></label>
    <label class="f">${tl("Labour cost (Rp)")}<input type="number" id="ilab" value="${i.labor || 0}" ${ed ? "" : "disabled"}></label>
    <label class="f">${tl("Notes")}<textarea id="inotes" ${ed ? "" : "disabled"}>${esc(i.notes)}</textarea></label>
    <label class="f">${tl("Photos")}<input type="file" id="iph" accept="image/*" multiple ${ed ? "" : "disabled"}></label><div class="row">${i.photos.map(ph => `<img src="${ph}" alt="${tl("Incident photo")}" style="width:72px;height:72px;object-fit:cover;border-radius:6px;border:1px solid var(--line)">`).join("")}</div>
    <p class="small">${tl("Total cost:")} <b class="num">Rp ${fmtN(i.cost)}</b></p>
    ${ed ? `<button class="btn pri" id="isave">${tl("Save incident")}</button>` : ""}</div></section></div></div>`);
  return {
    title: tl("Incident {id}", { id: i.id }), crumb: `<a href="#/incidents">${tl("Incidents")}</a>`, live: false, after() {
      document.querySelectorAll("[data-ist]").forEach(b => b.onclick = () => { const o = i.status; i.status = b.dataset.ist; if (i.status === "Acknowledged") { const a = byId(S.alarms, i.alarm); if (a && a.state === "active") { a.state = "acknowledged"; a.ackBy = S.session.userId; a.ackAt = S.now; } } i.actions.push({ at: S.now, by: S.session.userId, text: `Status ${o} → ${i.status}` }); audit(S.session.userId, tlk("Incident status"), i.pump, o, i.status); renderAll(true); });
      if ($("#iasg")) $("#iasg").onchange = e => { const o = i.assignee; i.assignee = e.target.value || null; if (i.assignee && k < 2) i.status = "Assigned"; i.actions.push({ at: S.now, by: S.session.userId, text: "Assigned to " + (user(i.assignee)?.name || "nobody") }); audit(S.session.userId, tlk("Incident assigned"), i.pump, user(o)?.name || "—", user(i.assignee)?.name || "—"); notify(i.org, "info", `${user(i.assignee)?.name} was assigned: ${i.title}`, i.pump); renderAll(true); };
      if ($("#iadd")) $("#iadd").onclick = () => { const v = $("#iact").value.trim(); if (!v) return; i.actions.push({ at: S.now, by: S.session.userId, text: v }); renderAll(true); };
      if ($("#iph")) $("#iph").onchange = e => { [...e.target.files].slice(0, 6).forEach(f => { const r = new FileReader(); r.onload = () => { i.photos.push(r.result); renderAll(true); }; r.readAsDataURL(f); }); };
      if ($("#isave")) $("#isave").onclick = () => { i.parts = $("#iparts").value.split("\n").map(l => l.split(",").map(x => x.trim())).filter(x => x[0]).map(([name, qty, cost]) => ({ name, qty: +qty || 1, cost: +cost || 0 })); i.resolution = $("#ires").value; i.notes = $("#inotes").value; i.labor = +$("#ilab").value || 0; const o = i.cost; i.cost = i.parts.reduce((s, x) => s + x.cost * x.qty, 0) + i.labor; audit(S.session.userId, tlk("Incident updated"), i.pump, "Rp " + fmtN(o), "Rp " + fmtN(i.cost)); toast(tl("Incident saved.")); renderAll(true); };
    },
  };
};

/* ---------- MAINTENANCE ---------- */
export const CHECK = {
  lowflow: [tlk("Check discharge and gate-valve positions"), tlk("Inspect and clean the intake screen"), tlk("Check the non-return valve"), tlk("Measure flow (meter or bucket test) and compare with expected"), tlk("Pull the pump if flow doesn't recover")],
  solar: [tlk("Inspect panels for dust, droppings and new shading"), tlk("Clean panels early morning with water and a soft brush"), tlk("Check MC4 connectors and string voltages"), tlk("Record PV power after cleaning")],
  heat: [tlk("Check enclosure vents and fan"), tlk("Clean the controller heatsink"), tlk("Fit a sun shade over the controller box"), tlk("Log enclosure temperature at 13:00")],
  dry: [tlk("Dip-meter the well to verify the level sensor"), tlk("Reduce controller max frequency to limit flow"), tlk("Add a midday recovery break to the schedule"), tlk("Check the pump and cable for heat damage")],
  calendar: [tlk("Inspect wellhead, cable and splice"), tlk("Check earthing and surge protection"), tlk("Clean panels"), tlk("Verify sensors against a reference reading"), tlk("Tighten terminals"), tlk("Update the logbook")],
  comms: [tlk("Check device power LED and fuse"), tlk("Check antenna and SIM data balance"), tlk("Power-cycle the device"), tlk("Confirm buffered data was uploaded")],
};
export function newTask(p, key, title, trigger, due, assignee, quiet) {
  const t = { id: uid("MT"), org: p.org, pump: p.id, key, title, trigger, due, assignee: assignee || null, status: assignee ? "Assigned" : "Open", checklist: (CHECK[key] || CHECK.calendar).map(x => [x, false]), created: S.now };
  S.tasks.unshift(t); if (!quiet) { audit("system", tlk("Maintenance task created"), p.id, null, `${title} (${trigger})`); notify(p.org, "info", `New maintenance task: ${p.short} — ${title}`, p.id); } return t;
}
export function autoMaint() {
  for (const p of S.pumps) {
    const open = k => S.tasks.some(t => t.pump === p.id && t.key === k && t.status !== "Done");
    const dg = diagnose(p);
    for (const d of dg) {
      if (d.key === "lowflow" && d.sev !== "info" && !open("lowflow")) newTask(p, "lowflow", tlk("Inspect intake, valves and pump — low flow"), tlk("Performance degradation"), S.now + 3 * D);
      if (d.key === "solar" && !open("solar")) newTask(p, "solar", tlk("Clean PV panels and check strings"), tlk("Performance degradation"), S.now + 4 * D);
      if (d.key === "heat" && d.sev !== "info" && !open("heat")) newTask(p, "heat", tlk("Shade and ventilate the controller enclosure"), tlk("Fault frequency"), S.now + 5 * D);
      if (d.key === "dry" && !open("dry")) newTask(p, "dry", tlk("Reduce pumping rate to protect the well"), tlk("Fault frequency (dry-run trips)"), S.now + 2 * D);
    }
    if (S.now > p.maint.next - 7 * D && !open("calendar")) newTask(p, "calendar", `Scheduled ${p.maint.intervalDays}-day service`, tlk("Calendar interval"), p.maint.next);
  }
}
export function maintRows(list) {
  return list.map(t => { const p = pump(t.pump), over = t.status !== "Done" && S.now > t.due; return `<tr class="click" data-mt="${t.id}" tabindex="0"><td class="o1 fw"><b>${esc(tlx(t.title))}</b><div class="na">${esc(p.short)} · ${tl("{done}/{total} checks", { done: t.checklist.filter(c => c[1]).length, total: t.checklist.length })}</div></td><td class="small o5" data-l="${tl("Trigger")}">${esc(tlx(t.trigger))}</td><td class="o3" data-l="${tl("Due")}">${fmtDate(t.due)}${over ? `<div class="na" style="color:var(--crit)">${Math.floor((S.now - t.due) / D) === 1 ? tl("{n} day overdue", { n: 1 }) : tl("{n} days overdue", { n: Math.floor((S.now - t.due) / D) })}</div>` : ""}</td><td class="o4" data-l="${tl("Tech")}">${esc(user(t.assignee)?.name || "—")}</td><td class="o2">${pill(t.status === "Done" ? "ok" : over ? "crit" : t.status === "Open" ? "off" : "warn", tlx(t.status))}</td></tr>`; }).join("");
}
ROUTES.maintenance = () => {
  const all = scoped(S.tasks), mine = S.session.role === "tech", list = mine ? all.filter(t => t.assignee === S.session.userId && t.status !== "Done") : all.filter(t => t.status !== "Done");
  const recs = scoped(S.records);
  setView(`${mine ? `<p class="lead-sum" style="margin-bottom:14px">${list.length ? (list.length === 1 ? tl("You have {n} task. Open one for the checklist, diagnosis and asset details.", { n: list.length }) : tl("You have {n} tasks. Open one for the checklist, diagnosis and asset details.", { n: list.length })) : tl("No tasks assigned to you.")}</p>` : ""}
   <section class="panel" style="margin-bottom:16px"><div class="hd"><h2>${mine ? tl("My tasks") : tl("Open tasks")}</h2><span class="sp"></span><span class="na">${tl("Tasks are created automatically from calendar intervals, fault frequency and performance degradation — or by hand.")}</span></div>
   <div class="tw"><table class="stk"><thead><tr><th>${tl("Task")}</th><th>${tl("Trigger")}</th><th>${tl("Due")}</th><th>${tl("Technician")}</th><th>${tl("Status")}</th></tr></thead><tbody>${maintRows(list) || `<tr><td colspan="5" class="muted">${tl("Nothing open.")}</td></tr>`}</tbody></table></div></section>
   ${mine && all.some(t => t.assignee !== S.session.userId && t.status !== "Done") ? `<section class="panel" style="margin-bottom:16px"><div class="hd"><h2>${tl("Other open tasks")}</h2></div><div class="tw"><table class="stk"><tbody>${maintRows(all.filter(t => t.assignee !== S.session.userId && t.status !== "Done"))}</tbody></table></div></section>` : ""}
   <section class="panel"><div class="hd"><h2>${tl("Service history")}</h2><span class="sp"></span><span class="na">${tl("Rp {n} total", { n: fmtN(recs.reduce((s, r) => s + r.cost, 0)) })}</span></div><div class="tw"><table class="stk sh"><thead><tr><th>${tl("Date")}</th><th>${tl("Asset")}</th><th>${tl("Work done")}</th><th>${tl("Technician")}</th><th>${tl("Parts")}</th><th class="r">${tl("Cost")}</th></tr></thead><tbody>
   ${recs.map(r => `<tr><td class="hd">${fmtDate(r.date)}</td><td class="hd">${esc(pump(r.pump).short)}</td><td class="o1 fw">${esc(tlx(r.work))}<div class="mm">${fmtDate(r.date)} · ${esc(pump(r.pump).short)}</div>${r.notes ? `<div class="na">${esc(tlx(r.notes))}</div>` : ""}</td><td class="by" data-l="${tl("By")}">${esc(user(r.tech)?.name)}</td><td class="small pt" data-l="${tl("Parts")}">${r.parts.map(x => esc(tlx(x.name)) + " ×" + x.qty).join(", ") || "—"}</td><td class="r num cs">Rp ${fmtN(r.cost)}</td></tr>`).join("")}</tbody></table></div></section>`);
  return { title: mine ? tl("My tasks") : tl("Maintenance"), live: false, after: bindMaint };
};
export function maintTab(p) {
  const ts = S.tasks.filter(t => t.pump === p.id), recs = S.records.filter(r => r.pump === p.id);
  return `<section class="panel" style="margin-bottom:16px"><div class="hd"><h2>${tl("Tasks")}</h2><span class="sp"></span>${can("maintain") ? `<button class="btn sm" id="mtnew">${tl("New task")}</button>` : ""}</div><div class="tw"><table class="stk"><thead><tr><th>${tl("Task")}</th><th>${tl("Trigger")}</th><th>${tl("Due")}</th><th>${tl("Technician")}</th><th>${tl("Status")}</th></tr></thead><tbody>${maintRows(ts) || `<tr><td colspan="5" class="muted">${tl("No tasks.")}</td></tr>`}</tbody></table></div></section>
  <section class="panel"><div class="hd"><h2>${tl("Service history")}</h2></div><div class="tw"><table class="stk sh"><thead><tr><th>${tl("Date")}</th><th>${tl("Work")}</th><th>${tl("Technician")}</th><th>${tl("Parts")}</th><th class="r">${tl("Cost")}</th></tr></thead><tbody>${recs.map(r => `<tr><td class="hd">${fmtDate(r.date)}</td><td class="o1 fw">${esc(tlx(r.work))}<div class="mm">${fmtDate(r.date)}</div><div class="na">${esc(tlx(r.notes || ""))}</div></td><td class="by" data-l="${tl("By")}">${esc(user(r.tech)?.name)}</td><td class="small pt" data-l="${tl("Parts")}">${r.parts.map(x => esc(tlx(x.name)) + " ×" + x.qty).join(", ") || "—"}</td><td class="r num cs">Rp ${fmtN(r.cost)}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">${tl("No records.")}</td></tr>`}</tbody></table></div></section>`;
}
export function bindMaint() {
  document.querySelectorAll("[data-mt]").forEach(r => { const f = () => openTask(byId(S.tasks, r.dataset.mt)); r.onclick = f; r.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f(); } }; });
  const nb = $("#mtnew"); if (nb) nb.onclick = () => { const p = pump(location.hash.split("/")[2]); modal({ title: tl("New maintenance task — {p}", { p: p.short }), ok: tl("Create task"), body: `<label class="f">${tl("Title")}<input type="text" id="nt" value="${tl("Inspection")}"></label><label class="f" style="margin-top:8px">${tl("Due")}<input type="date" id="nd" value="${toLocalInput(S.now + 7 * D).slice(0, 10)}"></label>`, onOk: m => { newTask(p, "calendar", $("#nt", m).value, tlk("Manual"), fromLocalInput($("#nd", m).value + "T12:00")); } }); };
}
export function openTask(t) {
  const p = pump(t.pump), dg = diagnose(p).find(d => d.key === t.key), ed = can("maintain"), techs = S.users.filter(u => u.org === t.org && u.role === "tech");
  modal({
    title: tlx(t.title), wide: true, ok: t.status === "Done" ? tl("Close") : tl("Save"), body: `<p class="small muted">${esc(p.name)} · ${esc(site(p.site).name)} · ${tl("due {d}", { d: fmtDate(t.due) })} · ${tl("trigger: {t}", { t: esc(tlx(t.trigger)) })}</p>
    ${dg ? `<div class="why" style="margin:8px 0"><b>${tl("Why this task exists:")}</b> ${esc(dg.summary)}<br><span class="small">${tl("Evidence:")} ${esc(dg.evidence.join("; "))}</span></div>` : ""}
    <div class="row" style="margin:8px 0"><label class="f" style="flex-direction:row;align-items:center;gap:8px">${tl("Technician")} <select id="tas" ${ed && S.session.role !== "tech" ? "" : "disabled"}><option value="">${tl("Unassigned")}</option>${techs.map(u => `<option value="${u.id}" ${t.assignee === u.id ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></label></div>
    <h3 style="margin:10px 0 4px">${tl("Checklist")}</h3>${t.checklist.map((c, i) => `<label style="display:flex;gap:8px;padding:4px 0"><input type="checkbox" data-ck="${i}" ${c[1] ? "checked" : ""} ${ed && t.status !== "Done" ? "" : "disabled"}> ${esc(tlx(c[0]))}</label>`).join("")}
    <details style="margin-top:6px"><summary>${tl("Asset quick facts")}</summary><dl class="kv small" style="margin-top:6px"><dt>${tl("Pump")}</dt><dd>${esc(p.mfr + " " + p.model)}, ${p.serial}</dd><dt>${tl("Pump depth")}</dt><dd>${well(p).pumpDepth} m</dd><dt>${tl("Controller")}</dt><dd>${esc(ctl(p).model)}</dd><dt>${tl("Warranty")}</dt><dd>${p.warranty}</dd><dt>${tl("Recent faults")}</dt><dd>${S.alarms.filter(a => a.pump === p.id && a.sev === "critical").slice(0, 3).map(a => esc(tlx(a.title)) + " " + fmtDate(a.raisedAt)).join("; ") || tl("none")}</dd></dl></details>
    ${t.status !== "Done" && ed ? `<h3 style="margin:12px 0 4px">${tl("Complete the work")}</h3><div class="grid g2" style="gap:8px"><label class="f">${tl("Parts (name, qty, cost Rp per line)")}<textarea id="tp" placeholder="${tl("Intake screen, 1, 85000")}"></textarea></label><label class="f">${tl("Notes")}<textarea id="tn"></textarea></label><label class="f">${tl("Labour hours")}<input type="number" id="th" value="2" min="0" step="0.5"></label><label class="f">${tl("Labour rate (Rp/h)")}<input type="number" id="tr" value="75000"></label><label class="f">${tl("Before / after photos")}<input type="file" id="tph" accept="image/*" multiple></label></div>
    <label style="display:flex;gap:8px;margin-top:10px"><input type="checkbox" id="tdone"> ${tl("Mark task as done and create a service record")}</label>` : ""}`,
    onOk: m => {
      if (t.status === "Done" || !ed) return;
      m.querySelectorAll("[data-ck]").forEach(c => t.checklist[+c.dataset.ck][1] = c.checked);
      const a = $("#tas", m)?.value; if (a !== undefined && (a || null) !== t.assignee) { audit(S.session.userId, tlk("Task assigned"), p.id, user(t.assignee)?.name || "—", user(a)?.name || "—"); t.assignee = a || null; t.status = a ? "Assigned" : "Open"; }
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
        audit(S.session.userId, tlk("Maintenance completed"), p.id, null, `${t.title} — Rp ${fmtN(r.cost)}`); toast(tl("Service record saved. The fix is now reflected in the simulation."));
      } else audit(S.session.userId, tlk("Maintenance task updated"), p.id, null, t.title);
    },
  });
}

/* ---------- ANALYTICS ---------- */
ROUTES.analytics = () => {
  const ps = myPumps(), d0 = dk(S.now);
  const per = { today: [d0, d0, d0 - 1, d0 - 1, tl("Today"), tl("yesterday")], yesterday: [d0 - 1, d0 - 1, d0 - 2, d0 - 2, tl("Yesterday"), tl("the day before")], "7d": [d0 - 6, d0, d0 - 13, d0 - 7, tl("Last 7 days"), tl("the previous 7 days")], "30d": [d0 - 29, d0, d0 - 59, d0 - 30, tl("Last 30 days"), tl("the previous 30 days")] }[UI.aPer];
  const agg = (list, a, b) => list.reduce((s, p) => { const x = sumDays(p, a, b); s.water += x.water; s.pv += x.pv; s.pump += x.pump; s.run += x.run; return s; }, { water: 0, pv: 0, pump: 0, run: 0 });
  const cur = agg(ps, per[0], per[1]), prev = agg(ps, per[2], per[3]);
  const dlt = (a, b) => b > 0.5 ? `<span class="na">${a >= b ? "▲" : "▼"} ${tl("{n}% vs {p}", { n: Math.abs(Math.round((a / b - 1) * 100)), p: per[5] })}</span>` : `<span class="na">${tl("no comparison data")}</span>`;
  let body = "";
  if (UI.aTab === "water") {
    const big = (l, v, u, c) => `<div class="kpi"><div class="v">${v}<small>${u}</small></div><div class="l">${l}</div><div style="margin-top:2px">${c}</div></div>`;
    const days = []; for (let d = d0 - 29; d <= d0; d++) days.push({ l: fmtDate(d * D - TZ + 12 * H).split(" ")[0], v: ps.reduce((s, p) => s + (daily(p).find(g => g.day === d)?.water || 0), 0), dim: d === d0 });
    const sites = [...new Set(ps.map(p => p.site))];
    const row = (name, list) => { const x = agg(list, per[0], per[1]); return `<td class="r num">${fmtN(x.water, 1)}</td><td class="r num">${fmtN(x.water / ((per[1] - per[0] + 1)), 1)}</td><td class="r num">${x.run > 0 ? fmtN(x.water * 1000 / (x.run / 60), 0) : "—"}</td><td class="r num">${fmtN(x.pv, 1)}</td><td class="r num">${x.water > 0.5 ? (x.pump / x.water).toFixed(2) : "—"}</td><td class="r num">${x.pv > 0.1 ? fmtN(x.water * 1000 / x.pv, 0) : "—"}</td>`; };
    body = `<div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:16px">${big(tl("Water produced"), fmtN(cur.water, 1), "m³", dlt(cur.water, prev.water))}${big(tl("Solar energy"), fmtN(cur.pv, 1), "kWh", dlt(cur.pv, prev.pv))}${big(tl("Energy intensity"), cur.water > .5 ? (cur.pump / cur.water).toFixed(2) : "—", "kWh/m³", cur.water > .5 && prev.water > .5 ? `<span class="na">${tl("{v} {p} (lower is better)", { v: (prev.pump / prev.water).toFixed(2), p: per[5] })}</span>` : "")}${big(tl("Water per solar kWh"), cur.pv > .1 ? fmtN(cur.water * 1000 / cur.pv, 0) : "—", "L/kWh", dlt(cur.water / Math.max(.1, cur.pv), prev.water / Math.max(.1, prev.pv)))}</div>
    <section class="panel" style="margin-bottom:16px"><div class="hd"><h2>${tl("Daily water production, 30 days")}</h2><span class="na">${tl("all pumps · m³")}</span></div><div class="bd">${barChart({ items: days, unit: "m³", label: tl("Fleet daily water") })}</div></section>
    <section class="panel"><div class="hd"><h2>${tl("{p} by site and pump", { p: per[4] })}</h2></div><div class="tw"><table><thead><tr><th>${tl("Site / pump")}</th><th class="r">${tl("Water (m³)")}</th><th class="r">${tl("m³ per day")}</th><th class="r">${tl("L per hour running")}</th><th class="r">${tl("Solar (kWh)")}</th><th class="r">kWh/m³</th><th class="r">${tl("L per solar kWh")}</th></tr></thead><tbody>
    ${sites.map(s => `<tr style="background:var(--paper)"><td><b>${esc(site(s).name)}</b></td>${row(s, ps.filter(p => p.site === s))}</tr>` + ps.filter(p => p.site === s).map(p => `<tr class="click" data-p="${p.id}"><td style="padding-left:26px">${esc(p.short)}</td>${row(p.id, [p])}</tr>`).join("")).join("")}</tbody></table></div></section>`;
  } else if (UI.aTab === "wells") {
    const ws = ps.map(p => [p, wellM(p)]);
    const series = ws.filter(x => x[1]).map(([p, w], i) => ({ label: p.short, color: ["var(--water)", "var(--well)", "var(--power)", "var(--solar)", "var(--press)"][i % 5], get: x => x.m[p.id] }));
    const pts = []; for (let d = d0 - 29; d <= d0; d++) { const m = {}; for (const [p, w] of ws) if (w) m[p.id] = w.days.find(g => g.day === d)?.static; pts.push({ t: d * D - TZ + 5.5 * H, m }); }
    body = `<section class="panel" style="margin-bottom:16px"><div class="hd"><h2>${tl("Well behaviour")}</h2><span class="na">${tl("from well-level sensors; wells without one are listed so the gap is visible")}</span></div><div class="tw"><table><thead><tr><th>${tl("Well")}</th><th class="r">${tl("Resting level")}</th><th class="r">${tl("30-day change")}</th><th class="r">${tl("Pumping level now")}</th><th class="r">${tl("Drawdown")}</th><th class="r">${tl("Recovery (7d / 30d)")}</th><th class="r">${tl("Sustainable rate")}</th><th class="r">${tl("Dry trips 7d")}</th><th>${tl("What it means")}</th></tr></thead><tbody>
    ${ws.map(([p, w]) => !w ? `<tr><td>${esc(well(p).name)}</td><td colspan="8" class="na">${tl("No well-level sensor — static level from drilling log {s} m", { s: well(p).static })}</td></tr>` : `<tr class="click" data-p="${p.id}" data-tab="well"><td>${esc(well(p).name)}</td><td class="r num">${r1(w.static)} m</td><td class="r num" style="color:${w.staticTrend > 1 ? "var(--warn)" : "inherit"}">${w.staticTrend > 0 ? "+" : ""}${r1(w.staticTrend)} m</td><td class="r num">${r1(w.level)} m</td><td class="r num">${r1(Math.max(0, w.drawdown))} m</td><td class="r num">${w.rec7 ? fmtDur(w.rec7) + " / " + fmtDur(w.rec30) : "—"}</td><td class="r num">${w.sustain ? Math.round(w.sustain) + " L/min" : "—"}</td><td class="r num" style="color:${w.dry7 ? "var(--crit)" : "inherit"}">${w.dry7}</td><td class="small" style="min-width:220px">${w.dry7 ? tl("Over-pumped: rated {q} L/min but the well sustains ≈{s} L/min.", { q: p.Q, s: Math.round(w.sustain) }) : w.staticTrend > 1 ? tl("{w} is {d} m deeper than a month ago", { w: well(p).name, d: r1(w.staticTrend) }) + (w.recSlower > 8 ? tl(" and recovering {n}% slower than its 30-day baseline", { n: Math.round(w.recSlower) }) : "") + "." : tl("Stable.")}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="panel"><div class="hd"><h2>${tl("Resting water level, 30 days")}</h2><span class="na">${tl("metres below ground — a line moving down means the aquifer is dropping")}</span></div><div class="bd">${lineChart({ from: S.now - 30 * D, to: S.now, pts, unit: "m", invert: true, series })}<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join("")}</div></div></section>`;
  } else {
    body = `<section class="panel"><div class="hd"><h2>${tl("Performance against baseline")}</h2><span class="na">${tl("flow delivered as % of what the pump's power should give, per day")}</span></div><div class="bd"><div class="chgrid">${ps.map(p => `<div class="chbox"><h4>${esc(p.short)}<span>${perfRatio(p, 2) ? tl("{n}% now", { n: Math.round(perfRatio(p, 2) * 100) }) : ""}</span></h4>${barChart({ items: daily(p).filter(g => g.n > 3).slice(-30).map(g => ({ l: fmtDate(g.day * D - TZ + 12 * H).split(" ")[0], v: g.flowSum / g.expSum * 100, c: g.flowSum / g.expSum < 0.85 ? "var(--warn)" : "var(--ok)" })), unit: "%", fmt: 0, h: 120, label: tl("{p} performance", { p: p.short }) })}</div>`).join("")}</div></div></section>`;
  }
  setView(`<div class="row" style="margin-bottom:14px"><div class="tabs" style="margin:0;border:0">${[["water", tl("Water & energy")], ["wells", tl("Wells")], ["perf", tl("Performance")]].map(([k, l]) => `<button data-an="${k}" class="${UI.aTab === k ? "on" : ""}">${l}</button>`).join("")}</div><span style="flex:1"></span>${UI.aTab === "water" ? `<div class="seg">${[["today", tl("Today")], ["yesterday", tl("Yesterday")], ["7d", tl("7 days")], ["30d", tl("30 days")]].map(([k, l]) => `<button data-per="${k}" class="${UI.aPer === k ? "on" : ""}">${l}</button>`).join("")}</div>` : ""}</div>${body}`);
  return { title: tl("Water & wells"), after() { bindRows(); document.querySelectorAll("[data-an]").forEach(b => b.onclick = () => { UI.aTab = b.dataset.an; renderAll(); }); document.querySelectorAll("[data-per]").forEach(b => b.onclick = () => { UI.aPer = b.dataset.per; renderAll(true); }); } };
};

/* ---------- PUMPS: asset directory (detail cards + data matrix) ---------- */
ROUTES.pumps = () => {
  const ps = myPumps();
  if (!ps.length) { setView(`<div class="panel"><div class="bd">${tl("No assets you can see yet.")}</div></div>`); return { title: tl("Pumps") }; }
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
  const sortLbl = { urg: tl("most urgent first"), id: tl("pump ID"), flow: tl("highest flow first"), health: tl("lowest health first") }[UI.puSort];
  const kpi = (l, v, c) => `<div class="kpi ${c || ""}" role="listitem"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const flowNow = rows.reduce((s, r) => s + (r.off ? 0 : r.flow), 0);
  const draw = rows.reduce((s, r) => s + (r.off ? 0 : r.kw), 0), rated = ps.reduce((s, p) => s + p.P / 1000, 0);
  const cell = (l, v, n) => `<div class="cell"><div class="cl">${l}</div><div class="cv">${v}</div>${n ? `<div class="cn" title="${esc(String(n).replace(/<[^>]+>/g, ""))}">${n}</div>` : ""}</div>`;
  const noS = t => `<span class="na" style="font:500 14px var(--num)">${t}</span>`;
  const card = r => {
    const { p, st, h, m, t, lt, top, off, perf } = r, w = wellM(p);
    const stale = off ? tl("stale · last known") : "";
    return `<article class="pcard">
     <div class="ph"><span class="pn">${esc(p.short)}</span><span class="stx-w">${stCell(st)}</span></div>
     <div class="pmeta">${esc(site(p.site).name.split(" — ")[0])} · ${esc(well(p).name)}<br>${esc(p.mfr)} ${esc(p.model)} · SN ${esc(p.sn)}<br><span class="na">${off ? esc(st.detail) : "IoT: " + esc(st.iot.t) + " · " + esc(st.iot.d)}</span></div>
     <div class="row small" style="justify-content:space-between"><span>${hbar(h.score)}</span><span class="na" title="${esc(h.reasons[0]?.txt || tl("No open findings"))}">${esc(h.reasons[0]?.txt || tl("No open findings"))}</span></div>
     ${top ? `<div class="pdg ${top.sev}"><b>${esc(r.top1)}</b><div class="act">${esc(top.action.split(/(?<=\.)\s/)[0])}</div></div>` : ""}
     <div class="tel">
      ${cell(tl("Hydraulic flow"), !has(p, "flow_lpm") ? noS(tl("no sensor")) : `${fmtN(r.flow, 1)}<small>L/min</small>`, !has(p, "flow_lpm") ? "" : stale || (st.pump === "running" && perf ? `<b style="color:var(--${perf >= 0.85 ? "ok" : "warn"})">${Math.round(perf * 100)}%</b> ${tl("of expected at this power")}` : st.pump === "running" ? tl("no baseline yet") : ""))}
      ${cell(tl("Pump power"), !has(p, "pump_power") ? noS(tl("no sensor")) : `${fmtN(r.kw, 2)}<small>kW</small>`, !has(p, "pump_power") ? "" : stale || tl("{n}% of {r} kW rated", { n: Math.round((m.pump_power || 0) / p.P * 100), r: r1(p.P / 1000) }))}
       ${cell(tl("Well level"), w ? `${r1(w.level)}<small>${tl("m below")}</small>` : noS(tl("no sensor")), w ? tl("static {s} m · drawdown {d} m", { s: r1(well(p).static), d: r1(w.drawdown) }) : tl("static {s} m from drilling log", { s: r1(well(p).static) }))}
      ${cell(tl("Water today"), `${fmtN(t.water, 1)}<small>m³</small>`, `${tl("{d} runtime", { d: fmtDur(t.run) })}${off ? tl(" · partial") : ""}`)}
     </div>
     <div class="pfoot"><a class="btn sm pri" href="#/pump/${p.id}">${tl("Open pump")}</a><a class="btn sm" href="#/pump/${p.id}/diagnostics">${tl("Diagnostics")}</a><span class="sp"></span><span class="na small">${fmtAgo(lt?.t)}</span></div>
    </article>`;
  };
  const wellTd = r => { const w = wellM(r.p); return w ? `<span class="num">${r1(w.level)} m</span><div class="na" style="white-space:nowrap" title="${tl("drawdown {d} m", { d: r1(w.drawdown) })}">${tl("drawdown {d} m", { d: r1(w.drawdown) })}</div>` : `<span class="na">${tl("{s} m (log)", { s: r1(well(r.p).static) })}</span><div class="na">${tl("no level sensor")}</div>`; };
  const tbl = `<div class="tw wide"><table><thead><tr><th>${tl("Unit")}</th><th>${tl("Site / well")}</th><th>${tl("State")}</th><th class="r">${tl("Flow (L/min)")}</th><th class="r">${tl("Power (kW)")}</th><th class="r">${tl("Well level")}</th><th class="r">${tl("Water today (m³)")}</th><th>${tl("Health")}</th><th>${tl("Last seen")}</th><th></th></tr></thead><tbody>
   ${list.map(r => `<tr class="click" data-p="${r.p.id}"${r.st.c !== "ok" && !r.off ? ` data-tab="diagnostics"` : ""}><td><b>${esc(r.p.short)}</b><div class="na">${esc(r.p.mfr)} ${esc(r.p.model)} · SN ${esc(r.p.sn)}</div></td><td>${esc(site(r.p.site).name.split(" — ")[0])}<div class="na">${esc(well(r.p).name)}</div></td><td>${stCell(r.st)}${r.top ? `<div class="na" title="${esc(r.top1)}">${esc(r.top1)}</div>` : ""}</td>
   <td class="r">${!has(r.p, "flow_lpm") ? nos() : `<span class="num">${fmtN(r.flow, 1)}</span>${r.perf && r.st.pump === "running" ? `<div class="na">${tl("{n}% exp", { n: Math.round(r.perf * 100) })}</div>` : ""}`}</td>
   <td class="r">${!has(r.p, "pump_power") ? nos() : `<span class="num">${fmtN(r.kw, 2)}</span><div class="na">${tl("{n}% rated", { n: Math.round((r.m.pump_power || 0) / r.p.P * 100) })}</div>`}</td>
   <td class="r">${wellTd(r)}</td><td class="r num">${fmtN(r.t.water, 1)}<div class="na">${fmtDur(r.t.run)}</div></td><td>${hbar(r.h.score)}</td><td class="small">${fmtAgo(r.lt?.t)}</td><td><a class="btn sm" href="#/pump/${r.p.id}/diagnostics">${tl("Diagnostics")}</a></td></tr>`).join("") || `<tr><td colspan="10" class="muted">${tl("No units match this filter.")}</td></tr>`}</tbody></table></div>`;
  setView(`
  <div class="kpis k7" role="list" style="margin-bottom:14px">
   ${kpi(tl("Units"), `${rows.length}<small>${sites.length === 1 ? tl("across {n} site", { n: sites.length }) : tl("across {n} sites", { n: sites.length })}</small>`)}
   ${kpi(tl("Running now"), `${counts.run}<small>/${rows.length}</small>`, counts.run ? "ok" : "")}
   ${kpi(tl("Attention"), counts.warn, counts.warn ? "warn" : "")}
   ${kpi(tl("Critical"), counts.crit, counts.crit ? "crit" : "")}
   ${kpi(tl("Offline"), counts.off, counts.off ? "off" : "")}
   ${kpi(tl("Fleet flow now"), `${fmtN(flowNow, 0)}<small>L/min</small>`)}
   ${kpi(tl("Solar draw"), `${r1(draw)}<small>kW</small><div class="l" style="margin-top:1px">${tl("of {r} kWp rated", { r: r1(rated) })}</div>`)}
  </div>
  <div class="row" style="margin-bottom:12px;gap:8px">
   <div class="seg" role="group" aria-label="${tl("Filter by state")}">${[["all", tl("All"), counts.all], ["run", tl("Running"), counts.run], ["warn", tl("Attention"), counts.warn], ["crit", tl("Critical"), counts.crit], ["off", tl("Offline"), counts.off]].map(([k, l, n]) => `<button data-pf="${k}" class="${UI.puF === k ? "on" : ""}">${l} <span class="na">${n}</span></button>`).join("")}</div>
   <div class="seg" role="group" aria-label="${tl("Filter by site")}"><button data-psite="all" class="${UI.puSite === "all" ? "on" : ""}">${tl("All sites")}</button>${sites.map(s => `<button data-psite="${s}" class="${UI.puSite === s ? "on" : ""}">${esc(site(s).name.split(" — ")[0])}</button>`).join("")}</div>
   <span style="flex:1"></span>
   <div class="seg" role="group" aria-label="${tl("Sort units")}" title="${tl("Sort order")}">${[["urg", tl("Urgency"), tl("Most urgent first")], ["id", tl("Pump ID"), tl("Pump identifier")], ["flow", tl("Flow"), tl("Highest flow first")], ["health", tl("Health"), tl("Lowest health first")]].map(([k, l, tip]) => `<button data-psort="${k}" class="${UI.puSort === k ? "on" : ""}" title="${tip}">${l}</button>`).join("")}</div>
  </div>
  <section class="panel"><div class="hd"><h2>${tl("{a} of {b} units in view", { a: list.length, b: rows.length })}</h2><span class="na">${tl("sorted by {s}", { s: sortLbl })}</span><span class="sp"></span>
   <div class="seg" role="group" aria-label="${tl("View")}"><button data-pv="cards" class="${UI.puView === "cards" ? "on" : ""}" title="${tl("Detailed cards")}">${tl("Cards")}</button><button data-pv="table" class="${UI.puView === "table" ? "on" : ""}" title="${tl("Data matrix")}">${tl("Matrix")}</button></div></div>
   ${UI.puView === "cards" ? `<div class="bd"><div class="pgrid">${list.map(card).join("") || `<p class="muted">${tl("No units match this filter.")}</p>`}</div></div>` : tbl}</section>`);
  return {
    title: tl("Pumps"), after() {
      bindRows();
      document.querySelectorAll("[data-pf]").forEach(b => b.onclick = () => { UI.puF = b.dataset.pf; renderAll(true); });
      document.querySelectorAll("[data-psite]").forEach(b => b.onclick = () => { UI.puSite = b.dataset.psite; renderAll(true); });
      document.querySelectorAll("[data-psort]").forEach(b => b.onclick = () => { UI.puSort = b.dataset.psort; renderAll(true); });
      document.querySelectorAll("[data-pv]").forEach(b => b.onclick = () => { UI.puView = b.dataset.pv; renderAll(true); });
    },
  };
};

/* ---------- CONTROL: automation + schedules ---------- */
export const MET_L = { tank_level_pct: tlk("Tank level (%)"), pv_power: tlk("Solar power (W)"), flow_lpm: tlk("Flow (L/min)"), pump_power: tlk("Pump power (W)"), pump_power_pct: tlk("Pump power (% of rated)"), well_margin_m: tlk("Well margin above min safe (m)"), well_level_m: tlk("Well level (m below ground)"), ctrl_temp_c: tlk("Controller temp (°C)"), fault: tlk("Pump fault") };
export const ACT_L = { stop: tlk("Stop pump"), start: tlk("Start pump (overrides schedule)"), stop_alert: tlk("Stop pump + critical alert"), notify_ops: tlk("Notify operations manager") };
export const condTxt = c => c.m === "fault" ? tl("a pump fault occurs") : `${tlx(MET_L[c.m]).replace(/ \(.*\)/, "").toLowerCase()} ${c.op} ${c.v}${c.for ? tl(" for {n} min", { n: c.for }) : ""}`;
ROUTES.control = () => {
  const ed = can("configure"), aus = scoped(S.automations), sch = scoped(S.schedules);
  setView(`${!ed ? `<p class="banner">${tl("Read-only: your role can't change automations or schedules.")}</p>` : ""}
  <section class="panel" style="margin-bottom:16px"><div class="hd"><h2>${tl("Automation rules")}</h2><span class="sp"></span>${ed ? `<button class="btn sm pri" id="newrule">${tl("New rule")}</button>` : ""}</div><div class="tw"><table class="stk rl"><thead><tr><th>${tl("On")}</th><th>${tl("Rule")}</th><th>${tl("Logic")}</th><th class="r">${tl("Times fired")}</th></tr></thead><tbody>
  ${aus.map(a => `<tr><td class="ck"><label class="chk"><input type="checkbox" data-aut="${a.id}" ${a.enabled ? "checked" : ""} ${ed ? "" : "disabled"} aria-label="${tl("Enable {n}", { n: esc(tlx(a.name)) })}"></label></td><td class="rn"><b>${esc(tlx(a.name))}</b><div class="na">${esc(tlx(a.createdBy))} · ${tl("applies to {s}", { s: a.scope === "all" ? tl("all pumps") : a.scope.map(x => pump(x).short).join(", ") })}</div></td><td class="small lg"><span class="lk">${tl("IF")}</span> <span class="lv">${a.when.map(condTxt).join(" " + tl("AND") + " ")}</span> <span class="lk">${tl("THEN")}</span> <span class="lv">${tlx(ACT_L[a.then]).toLowerCase()}</span>${a.release ? ` <span class="dt">·</span> <span class="lk">${tl("release")}</span> <span class="lv">${tl("when {c}", { c: condTxt(a.release) })}</span>` : a.releaseAfter ? ` <span class="dt">·</span> <span class="lk">${tl("release")}</span> <span class="lv">${tl("after {n} min", { n: a.releaseAfter })}</span>` : ""}</td><td class="r num fd" data-l="${tl("Fired")}">${a.fired}</td></tr>`).join("")}
  </tbody></table></div><div class="bd small muted">${(h => `<span class="hw">${h}</span><details class="hm"><summary>${tl("How rules work")}</summary><p>${h}</p></details>`)(tl("Rules that need a sensor a pump doesn't have are skipped for that pump, never guessed. Rules are evaluated on every reading; stop-holds release with hysteresis so pumps don't chatter on and off."))}</div></section>
  <section class="panel"><div class="hd"><h2>${tl("Schedules")}</h2><span class="sp"></span><span class="na">${tl("Format: 06:00-10:00, 14:00-17:00")}</span></div><div class="tw"><table class="stk sc"><thead><tr><th>${tl("Pump")}</th><th>${tl("Windows")}</th><th>${tl("Always respects")}</th><th></th></tr></thead><tbody>
  ${sch.map(s => `<tr><td class="o1 fw2"><b>${esc(pump(s.pump).short)}</b></td><td class="o2 fw2"><input type="text" class="wi" data-sch="${s.id}" value="${s.windows.map(w => w.join("-")).join(", ")}" ${ed ? "" : "disabled"} aria-label="${tl("Schedule for {p}", { p: esc(pump(s.pump).short) })}"></td><td class="small o3 fw2" data-l="${tl("Respects")}">${s.respect.map(tlx).join(" · ")}</td><td class="o4 fw2">${ed ? `<button class="btn sm" data-schs="${s.id}">${tl("Save")}</button>` : ""}</td></tr>`).join("")}</tbody></table></div></section>`);
  return {
    title: tl("Automation & schedules"), live: false, after() {
      document.querySelectorAll("[data-aut]").forEach(c => c.onchange = () => { const a = byId(S.automations, c.dataset.aut); a.enabled = c.checked; audit(S.session.userId, c.checked ? tlk("Automation enabled") : tlk("Automation disabled"), null, String(!c.checked), a.name); if (!c.checked) for (const p of S.pumps) delete SIM[p.id].inhibit[a.id]; toast(c.checked ? tl("Rule enabled.") : tl("Rule disabled.")); });
      document.querySelectorAll("[data-schs]").forEach(b => b.onclick = () => { const s = byId(S.schedules, b.dataset.schs), v = $(`[data-sch="${s.id}"]`).value; const w = v.split(",").map(x => x.trim().split("-").map(y => y.trim())).filter(x => x.length === 2 && x.every(y => /^\d{2}:\d{2}$/.test(y))); if (!w.length) return toast(tl("Use the format 06:00-10:00, 14:00-17:00.")); const o = s.windows.map(x => x.join("–")).join(", "); s.windows = w; audit(S.session.userId, tlk("Schedule changed"), s.pump, o, w.map(x => x.join("–")).join(", ")); toast(tl("Schedule saved for {p}.", { p: pump(s.pump).short })); });
      if ($("#newrule")) $("#newrule").onclick = () => modal({
        title: tl("New automation rule"), ok: tl("Create rule"), body: `<label class="f">${tl("Name")}<input type="text" id="rn" value="${tl("My rule")}"></label>
        <div class="row" style="margin-top:10px"><span class="small">${tl("IF")}</span><select id="rm">${Object.entries(MET_L).filter(([k]) => k !== "fault").map(([k, l]) => `<option value="${k}">${tlx(l)}</option>`).join("")}</select><select id="ro"><option>&gt;</option><option>&lt;</option></select><input type="number" id="rv" value="50" style="width:90px"><span class="row" style="flex-wrap:nowrap;gap:6px"><span class="small">${tl("for")}</span><input type="number" id="rf" value="0" style="width:64px"><span class="small">${tl("min")}</span></span></div>
        <div class="row" style="margin-top:10px"><span class="small">${tl("THEN")}</span><select id="ra">${Object.entries(ACT_L).filter(([k]) => k !== "notify_ops").map(([k, l]) => `<option value="${k}">${tlx(l)}</option>`).join("")}</select></div>
        <label class="f" style="margin-top:10px">${tl("Apply to")}<select id="rs"><option value="all">${tl("All pumps")}</option>${myPumps().map(p => `<option value="${p.id}">${esc(p.short)}</option>`).join("")}</select></label>
        <p class="small muted" style="margin-top:8px">${tl("Stop rules release when the condition has been false for one reading. Well protection and controller faults always take priority over start rules.")}</p>`,
        onOk: m => { const r = { id: uid("AUT"), org: S.orgId, name: $("#rn", m).value, when: [{ m: $("#rm", m).value, op: $("#ro", m).value, v: +$("#rv", m).value, ...(+$("#rf", m).value ? { for: +$("#rf", m).value } : {}) }], then: $("#ra", m).value, scope: $("#rs", m).value === "all" ? "all" : [$("#rs", m).value], enabled: true, fired: 0, createdBy: user(S.session.userId).name }; S.automations.push(r); audit(S.session.userId, tlk("Automation created"), null, null, r.name); }
      });
    },
  };
};

/* ---------- DEVICES ---------- */
ROUTES.devices = () => {
  const ds = scoped(S.devices), ed = can("configure");
  const lg = S.ingestLog.filter(e => !e.device || byId(S.devices, e.device)?.org === S.orgId).slice(0, 14);
  const lastNorm = lg.find(e => e.norm)?.norm;
  setView(`<p class="lead-sum" style="margin-bottom:14px">${tl("IoT health is tracked separately from pump health — a pump can be fine while its device has weak signal, and vice versa.")}</p>
  <section class="panel" style="margin-bottom:16px"><div class="hd"><h2>${tl("Devices")}</h2></div><div class="tw"><table><thead><tr><th>${tl("Device")}</th><th>${tl("Pump")}</th><th>${tl("Status")}</th><th>${tl("Hardware / adapter")}</th><th>${tl("Network")}</th><th class="r">${tl("Signal")}</th><th class="r">${tl("Battery")}</th><th>${tl("Firmware")}</th><th class="r">${tl("Uptime")}</th><th class="r">${tl("Retries")}</th><th class="r">${tl("Buffered")}</th><th>${tl("Last upload")}</th><th>${tl("Credential")}</th><th></th></tr></thead><tbody>
  ${ds.map(d => { const p = pump(d.asset), st = statusM(p).iot; return `<tr><td><b>${d.id}</b></td><td><a href="#/pump/${p.id}">${esc(p.short)}</a><div class="na">${tl("pump: {s}", { s: statusM(p).c === "off" ? tl("unknown") : statusM(p).label.toLowerCase() })}</div></td><td>${pill(st.c, st.t)}</td><td class="small">${esc(d.hw)}<div class="na">${tlx(ADAPTERS[d.adapter].label)}</div></td><td class="small">${esc(d.net)}<div class="na">${esc(d.sim)}</div></td><td class="r num">${d.online ? (d.rssiNow ?? d.rssi) + " dBm" : "—"}</td><td class="r num">${d.online ? d.battery + " V" : "—"}</td><td class="num">${d.fw}</td><td class="r num">${tl("{n} d", { n: Math.floor(d.uptimeH / 24) })}</td><td class="r num">${(d.lost / Math.max(1, d.sent) * 100).toFixed(1)}%</td><td class="r num">${SIM[p.id].buffer.length || "—"}</td><td>${fmtAgo(d.lastUpload)}</td><td class="small"><span class="num">${d.fp}</span>${d.rotatedAt ? `<div class="na">${tl("rotated {d}", { d: fmtDT(d.rotatedAt) })}</div>` : ""}</td><td>${ed ? `<button class="btn sm" data-rot="${d.id}">${tl("Rotate")}</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>
  <div class="bd small muted">${tl("Each device authenticates with its own secret (only a hash is stored server-side; this screen shows a fingerprint, never the secret). Rotation issues a new secret and keeps the old one valid for 24 h so a field device can be re-provisioned without data loss.")}</div></section>
  <div class="grid g2"><section class="panel"><div class="hd"><h2>${tl("Ingestion log")}</h2><span class="na">${tl("latest first")}</span></div><div class="tw"><table><tbody>${lg.map(e => `<tr><td class="num small" style="white-space:nowrap">${fmtTime(e.at)}</td><td class="small">${e.device || "?"}</td><td class="small">${!e.ok ? `<span style="color:var(--crit)">${tl("Rejected: {e}", { e: esc(tlx(e.err)) })}</span>` : e.flush ? tl("Buffer flush: <b>{a}</b> accepted, <b>{d}</b> duplicates dropped", { a: e.accepted, d: e.dup }) : e.dup ? tl("Duplicate seq {s} dropped", { s: e.seq }) : `${tl("seq {s} accepted", { s: e.seq })}${e.src === "buffered" ? tl(" (late, original timestamp kept)") : ""} · ${ADAPTERS[e.adapter].label.split(" ")[0]}`}</td></tr>`).join("") || `<tr><td class="muted">${tl("Waiting for live data…")}</td></tr>`}</tbody></table></div></section>
  <section class="panel"><div class="hd"><h2>${tl("Latest normalized event")}</h2><span class="na">${tl("every adapter produces this shape")}</span></div><div class="bd"><pre class="code">${esc(JSON.stringify(lastNorm ? { ...lastNorm, timestamp: new Date(lastNorm.timestamp).toISOString(), received_at: new Date(lastNorm.received_at).toISOString() } : {}, null, 2))}</pre></div></section></div>`);
  return {
    title: tl("IoT devices"), after() {
      document.querySelectorAll("[data-rot]").forEach(b => b.onclick = () => { const d = byId(S.devices, b.dataset.rot); modal({ title: tl("Rotate credential for {d}?", { d: d.id }), ok: tl("Rotate credential"), body: `<p>${tl("A new secret is generated and pushed to the device over its authenticated channel. The current secret stays valid for 24 hours, then stops working.")}</p>`, onOk: () => { const p = pump(d.asset), sec = "sk_" + fnv(d.id + Math.random()) + fnv(String(S.now)); const old = d.fp; d.prevHash = d.secretHash; d.prevUntil = S.now + D; d.secretHash = fnv(sec); d.fp = d.secretHash.slice(0, 4) + "…" + d.secretHash.slice(-4); d.rotatedAt = S.now; SIM[p.id].secret = sec; audit(S.session.userId, tlk("Device credential rotated"), p.id, old, d.fp); toast(tl("New credential issued to {d}.", { d: d.id })); } }); });
    },
  };
};
