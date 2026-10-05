import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Smoke-tests dist/index.html. Auto-picks the runner:
//   classic bundle (build.sh)  → jsdom (fast, no browser)
//   Vite module bundle         → headless Edge via CDP (jsdom can't execute <script type=module>)
// Override: node tools/smoke.mjs [file] --jsdom | --browser
const target = process.argv[2] || 'dist/index.html';
const flags = new Set(process.argv.slice(3));
const html = fs.readFileSync(target, 'utf8');
const stepsSrc = fs.readFileSync(new URL('./smoke-steps.js', import.meta.url), 'utf8');
const isModule = /<script[^>]*type=["']module["']/.test(html);
const useBrowser = flags.has('--browser') || (!flags.has('--jsdom') && isModule);
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.error('smoke: timed out after 120s'); process.exit(2); }, 120000).unref();

function printReport(report, extraProblems = []) {
  for (const r of report.results || []) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  const fatal = [...new Set([...(report.problems || []), ...extraProblems])];
  console.log(`\n${fatal.length ? `FAILED — ${fatal.length} problem(s):` : 'ALL SMOKE CHECKS PASSED'}`);
  fatal.slice(0, 12).forEach(p => console.log('  - ' + String(p).slice(0, 500)));
  return fatal.length;
}

async function runJsdom() {
  const { JSDOM, VirtualConsole } = await import('jsdom');
  const early = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    const m = e.stack || String(e.message || e);
    if (!/Could not parse CSS stylesheet/i.test(m)) early.push('jsdomError: ' + m);
  });
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) { w.scrollTo = () => {}; w.Element.prototype.scrollTo = () => {}; },
  });
  let report;
  try {
    report = await dom.window.eval(stepsSrc);
  } catch (e) {
    report = { results: [], problems: ['steps evaluation failed: ' + (e.stack || e)] };
  }
  dom.window.close();
  return printReport(report, early);
}

async function runBrowser() {
  const { spawn, spawnSync } = await import('node:child_process');
  const os = await import('node:os');

  const browser = ['ProgramFiles', 'ProgramFiles(x86)', 'LocalAppData']
    .map(k => process.env[k]).filter(Boolean)
    .flatMap(b => [
      path.join(b, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(b, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ])
    .find(fs.existsSync);
  if (!browser) throw new Error('no Chrome/Edge found — cannot smoke the module build');

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-smoke-'));
  const proc = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', `--user-data-dir=${profile}`,
    '--remote-debugging-port=0', '--remote-allow-origins=*', 'about:blank',
  ], { stdio: 'ignore' });
  const killTree = () => {
    try { spawnSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch (_) {}
  };

  let ws = null, port = '', wsPath = '';
  console.log(`smoke: browser = ${browser}`);
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !port; i++) {
      try {
        const lines = fs.readFileSync(portFile, 'utf8').split('\n');
        port = lines[0].trim(); wsPath = (lines[1] || '').trim();
      } catch (_) { await sleep(100); }
    }
    if (!port) throw new Error('browser DevTools port never appeared');

    let list = null;
    for (let i = 0; i < 100 && !list; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/list`);
        if (r.ok) list = await r.json();
      } catch (_) { await sleep(100); }
    }
    const page = (list || []).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!page) throw new Error('no CDP page target');

    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = () => res(); ws.onerror = () => rej(new Error('CDP websocket failed')); });

    let seq = 0;
    const pending = new Map();
    const waiters = new Map();
    const early = [];
    let evaluating = false;
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id) {
        const p = pending.get(m.id);
        if (p) { pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
        return;
      }
      if (waiters.has(m.method)) { waiters.get(m.method)(m.params); waiters.delete(m.method); }
      if (!evaluating && m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        early.push('exceptionThrown: ' + ((d.exception && d.exception.description) || d.text || ''));
      }
      if (m.method === 'Log.entryAdded') {
        const e2 = m.params.entry;
        if (e2.level === 'error' && !/fonts\.googleapis\.com|Could not parse CSS/i.test(e2.text)) early.push('log: ' + e2.text);
      }
    };
    const send = (method, params = {}, timeout = 30000) => new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (pending.delete(id)) rej(new Error('CDP timeout: ' + method)); }, timeout);
    });
    const once = (method, timeout = 20000) => new Promise((res, rej) => {
      const t = setTimeout(() => { waiters.delete(method); rej(new Error('waiting for ' + method)); }, timeout);
      waiters.set(method, p => { clearTimeout(t); res(p); });
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: pathToFileURL(path.resolve(target)).href });
    await loaded;

    evaluating = true;
    const out = await send('Runtime.evaluate',
      { expression: stepsSrc, awaitPromise: true, returnByValue: true }, 60000);
    evaluating = false;
    if (out.exceptionDetails) throw new Error('steps evaluation failed: ' + (out.exceptionDetails.exception?.description || out.exceptionDetails.text));
    return printReport(out.result.value, early);
  } finally {
    try { if (ws) ws.close(); } catch (_) {}
    if (port && wsPath) { // graceful shutdown so the profile unlocks for rm
      try {
        const bws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
        await new Promise(res => { bws.onopen = res; bws.onerror = res; setTimeout(res, 1500); });
        bws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
        await sleep(700);
        try { bws.close(); } catch (_) {}
      } catch (_) {}
    }
    killTree();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
  }
}

console.log(`smoke: ${target} (${useBrowser ? 'browser CDP' : 'jsdom'})`);
const code = useBrowser ? await runBrowser() : await runJsdom();
process.exit(code ? 1 : 0);
