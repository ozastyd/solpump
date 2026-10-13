// i18n completeness: every tl("…")/tlk("…") literal in src/ must have an Indonesian entry; placeholders must match.
import fs from 'node:fs';
import * as acorn from 'acorn';
import { ID_CORE } from '../src/id-core.js';
import { ID_INTEL } from '../src/id-intel.js';
import { ID_UI1 } from '../src/id-ui1.js';
import { ID_UI2 } from '../src/id-ui2.js';
import { ID_UI3 } from '../src/id-ui3.js';
import { ID_UI4 } from '../src/id-ui4.js';
const DICT = Object.assign({}, ID_CORE, ID_INTEL, ID_UI1, ID_UI2, ID_UI3, ID_UI4);
const FILES = ['core.js', 'intel.js', 'ui1.js', 'ui2.js', 'ui3.js', 'ui4.js'];
const used = new Map(), bad = [];
const walk = (n, f, src) => {
  if (!n || typeof n.type !== 'string') return;
  if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && (n.callee.name === 'tl' || n.callee.name === 'tlk') && n.arguments.length) {
    const a = n.arguments[0], line = src.slice(0, n.start).split('\n').length;
    const key = a.type === 'Literal' && typeof a.value === 'string' ? a.value : a.type === 'TemplateLiteral' && a.expressions.length === 0 ? a.quasis[0].value.cooked : null;
    if (key === null) { if (n.callee.name === 'tl') bad.push(`${f}:${line} tl() needs a plain string literal (use tlk() markers for constants)`); }
    else if (!used.has(key)) used.set(key, `${f}:${line}`);
  }
  for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach(x => walk(x, f, src)); else if (v && typeof v.type === 'string') walk(v, f, src); }
};
for (const f of FILES) { const src = fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8'); walk(acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: false }), f, src); }
const ph = s => (s.match(/\{\w+\}/g) || []).sort().join();
const miss = [...used].filter(([k]) => DICT[k] === undefined);
for (const [k, w] of used) if (DICT[k] !== undefined && ph(k) !== ph(DICT[k])) bad.push(`${w} placeholder mismatch: ${JSON.stringify(k)}`);
if (miss.length) bad.push(`${miss.length} string(s) missing from the Indonesian dictionary:\n` + miss.slice(0, 40).map(([k, w]) => `  ${w}  ${JSON.stringify(k)}`).join('\n') + (miss.length > 40 ? `\n  … and ${miss.length - 40} more` : ''));
const unused = Object.keys(DICT).filter(k => !used.has(k)).length;
if (bad.length) { console.error('i18n check FAILED\n' + bad.join('\n')); process.exit(1); }
console.log(`i18n check passed: ${used.size} strings translated${unused ? ` (${unused} dictionary entries not referenced by tl()/tlk() — fine for tlx() stored strings)` : ''}`);
