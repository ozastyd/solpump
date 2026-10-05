(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const results = [], problems = [];
  const push = p => problems.push(String(p));
  addEventListener('error', e => push('uncaught: ' + (e.message || e) + ' | ' + (e.error && e.error.stack ? e.error.stack : '')));
  addEventListener('unhandledrejection', e => push('unhandledrejection: ' + (e.reason && e.reason.stack || e.reason)));
  const origError = console.error;
  console.error = (...a) => {
    push('console.error: ' + a.map(x => { try { return String(x); } catch (_) { return '(unstringifiable)'; } }).join(' '));
    origError.apply(console, a);
  };
  const step = (name, fn) => {
    const before = problems.length;
    let err = null;
    try { fn(); } catch (e) { err = e; }
    const grew = problems.length - before;
    results.push({ name, ok: !err && grew === 0, detail: err ? String(err.message) : grew ? problems[problems.length - 1].slice(0, 300) : '' });
    if (err) push(name + ' threw: ' + (err.stack || err));
    return !err && grew === 0;
  };
  const setHash = async h => { location.hash = h; await sleep(70); };
  const qs = s => document.querySelector(s);
  const viewLen = () => (qs('#view') ? qs('#view').innerHTML : '').trim().length;
  const tap = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  let bootState = '';
  for (let i = 0; i < 300 && !bootState; i++) {
    if (qs('pre') && /Startup error/.test(qs('pre').textContent)) bootState = 'startup-error';
    else if (qs('.acct')) bootState = 'login';
    else await sleep(50);
  }
  if (bootState === 'startup-error') push('startup error: ' + qs('pre').textContent.slice(0, 600));
  if (!bootState) push('boot timeout: login screen never appeared');
  step('boot → login screen renders', () => { if (!qs('.acct')) throw new Error('no demo accounts rendered'); });
  if (qs('.acct')) step('sign in (first account)', () => { tap(qs('.acct')); if (!qs('#view')) throw new Error('app shell missing after login'); });
  results.push({ name: 'post-signin state', ok: true, detail: `hash=${location.hash} viewLen=${viewLen()} title=${document.querySelector('.top h1') ? document.querySelector('.top h1').textContent : '(none)'}` });

  const routes = ['overview', 'map', 'alerts', 'incidents', 'maintenance', 'analytics', 'pumps', 'control', 'devices', 'reports', 'audit', 'settings', 'blueprint'];
  for (const r of routes) {
    await setHash('#/' + r);
    step('route #/' + r, () => {
      if (viewLen() < 100) throw new Error('empty view');
      if (!(document.querySelector('.top h1') ? document.querySelector('.top h1').textContent : '').trim()) throw new Error('no page title');
    });
  }

  await setHash('#/alerts');
  const pumpLink = qs('a[href^="#/pump/"]');
  const pumpHref = pumpLink ? pumpLink.getAttribute('href') : null;
  if (pumpHref) {
    await setHash(pumpHref);
    step('pump detail ' + pumpHref, () => { if (!qs('.tabs')) throw new Error('no tabs rendered'); });
    const tabs = [...document.querySelectorAll('#view [data-tab]')].map(b => b.dataset.tab);
    for (const t of tabs) {
      await setHash(pumpHref + '/' + t);
      step('pump tab ' + t, () => { if (viewLen() < 100) throw new Error('empty view'); });
    }
  } else push('no pump link found on alerts page');

  await setHash('#/incidents');
  const incRow = qs('[data-i]');
  if (incRow) {
    tap(incRow);
    await sleep(80);
    step('incident detail opens', () => { if (!/^#\/incident\//.test(location.hash)) throw new Error('hash is ' + location.hash); });
  } else results.push({ name: 'incident detail (none seeded — skipped)', ok: true, detail: '' });

  await setHash('#/map');
  step('map marker opens popup', () => {
    const mk = qs('[data-mk]');
    if (!mk) throw new Error('no markers');
    tap(mk);
    if (!qs('[data-go]')) throw new Error('popup content missing');
  });
  const goBtn = qs('[data-go]');
  if (goBtn) { tap(goBtn); await sleep(80); }
  step('popup "Open pump" navigates', () => { if (!/^#\/pump\//.test(location.hash)) throw new Error('hash is ' + location.hash); });

  step('scenarios drawer opens', () => {
    const b = document.getElementById('b-lab');
    if (!b) throw new Error('no b-lab button');
    tap(b);
    if (!qs('.drawer')) throw new Error('no drawer');
    const c = document.getElementById('dcl');
    if (c) tap(c);
  });
  step('notifications drawer opens', () => {
    const b = document.getElementById('b-bell');
    if (!b) throw new Error('no b-bell button');
    tap(b);
    if (!qs('.drawer')) throw new Error('no drawer');
    const c = document.getElementById('dcl');
    if (c) tap(c);
  });

  return { results, problems, hash: location.hash };
})()
