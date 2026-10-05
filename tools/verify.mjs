import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import { ESLint } from 'eslint';
import globals from 'globals';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const FILES = ['core.js', 'intel.js', 'ui1.js', 'ui2.js', 'ui3.js', 'ui4.js', 'main.js'];
let fail = 0;

// ---------- 1. no-undef as ES modules (catches any name that should have been imported) ----------
const eslint = new ESLint({
  cwd: ROOT,
  overrideConfigFile: true,
  overrideConfig: [{
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, LOGO: 'readonly' },
    },
    rules: { 'no-undef': 'error' },
  }],
});
for (const f of FILES) {
  const [r] = await eslint.lintText(fs.readFileSync(path.join(SRC, f), 'utf8'), { filePath: path.join(SRC, f) });
  const bad = r.messages.filter(m => m.ruleId === 'no-undef');
  if (bad.length) {
    fail++;
    console.log(`✗ no-undef in ${f}:`);
    for (const m of bad) console.log(`    line ${m.line}: ${m.message}`);
  } else console.log(`✓ no-undef clean: ${f}`);
}

// ---------- 2. evaluation-order checker (TDZ across the module graph) ----------
const parse = f => acorn.parse(fs.readFileSync(path.join(SRC, f), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', locations: true });
const ast = Object.fromEntries(FILES.map(f => [f, parse(f)]));

const deps = {}, importsOf = {};
for (const f of FILES) {
  const imps = [];
  for (const st of ast[f].body) {
    if (st.type !== 'ImportDeclaration') continue;
    const src = st.source.value;
    if (!src.startsWith('./')) continue; // asset import (logo.png) or external
    const target = path.basename(src);
    if (!FILES.includes(target)) throw new Error(`${f}: import of unknown module ${src}`);
    const names = st.specifiers.map(s => (s.type === 'ImportDefaultSpecifier' ? s.local.name : s.imported.name));
    imps.push({ mod: target, names });
  }
  deps[f] = [...new Set(imps.map(i => i.mod))];
  importsOf[f] = new Set(imps.flatMap(i => i.names));
}

const order = [], state = {};
const visit = m => {
  if (state[m]) return;
  state[m] = 1;
  for (const d of deps[m]) visit(d);
  state[m] = 2;
  order.push(m);
};
for (const f of FILES) visit(f);
console.log('✓ eval order:', order.join(' → '));

// top-level (non-deferred) reads of imported identifiers
const deferred = n => ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type);
const ownerKind = new Map(); // name -> {file, kind}
for (const f of FILES) {
  for (const st of ast[f].body) {
    if (st.type === 'VariableDeclaration') for (const d of st.declarations) walkPat(d.id, st.kind, f);
    else if (st.type === 'FunctionDeclaration') ownerKind.set(st.id.name, { file: f, kind: 'function' });
    else if (st.type === 'ClassDeclaration') ownerKind.set(st.id.name, { file: f, kind: 'class' });
  }
}
function walkPat(id, kind, f) {
  if (id.type === 'Identifier') ownerKind.set(id.name, { file: f, kind });
  else if (id.type === 'ObjectPattern') for (const p of id.properties) walkPat(p.type === 'Property' ? p.value : p.argument, kind, f);
  else if (id.type === 'ArrayPattern') for (const e of id.elements) if (e) walkPat(e, kind, f);
  else if (id.type === 'AssignmentPattern') walkPat(id.left, kind, f);
  else if (id.type === 'RestElement') walkPat(id.argument, kind, f);
}

const violations = [];
for (const f of FILES) {
  const imp = importsOf[f];
  const mi = order.indexOf(f);
  const walk = (node, parent, inDeferred) => {
    if (!node || typeof node.type !== 'string') return;
    if (deferred(node)) return; // body + params run at call time
    const def = inDeferred || node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression';
    if (node.type === 'Identifier' && imp.has(node.name)) {
      const isMemberProp = parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed;
      const isPropKey = parent && parent.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand;
      const isImportDecl = parent && parent.type === 'ImportSpecifier';
      if (!isMemberProp && !isPropKey && !isImportDecl && !def) {
        const o = ownerKind.get(node.name);
        if (o && ['const', 'let', 'class'].includes(o.kind)) {
          const oi = order.indexOf(o.file);
          if (oi > mi) violations.push(`${f}:${node.loc.start.line} top-level read of "${node.name}" (${o.kind} in ${o.file}) — but ${o.file} evaluates later (${o.file} @${oi} vs ${f} @${mi})`);
        }
      }
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach(c => walk(c, node, def));
      else if (v && typeof v.type === 'string') walk(v, node, def);
    }
  };
  ast[f].body.forEach(st => walk(st, null, false));
}
if (violations.length) {
  fail++;
  console.log('✗ evaluation-order violations:');
  violations.forEach(v => console.log('    ' + v));
} else console.log('✓ no evaluation-order (TDZ) violations across the module graph');

// ---------- 3. cross-module leak check ----------
// eslint with NO browser globals reports only identifiers that resolve to nothing locally.
// In the classic concat build those bound to globals created by other src files; as ES modules
// they silently hit window.* (e.g. window.status) or throw. Flag any reported name another src module exports.
const exportsOfName = new Map(); // name -> owning file
const collectPat = (id, f) => {
  if (!id) return;
  if (id.type === 'Identifier') exportsOfName.set(id.name, f);
  else if (id.type === 'ObjectPattern') for (const p of id.properties) collectPat(p.type === 'Property' ? p.value : p.argument, f);
  else if (id.type === 'ArrayPattern') for (const e of id.elements) if (e) collectPat(e, f);
  else if (id.type === 'AssignmentPattern') collectPat(id.left, f);
  else if (id.type === 'RestElement') collectPat(id.argument, f);
};
for (const f of FILES) {
  for (const st of ast[f].body) {
    if (st.type !== 'ExportNamedDeclaration') continue;
    if (st.declaration) {
      if (st.declaration.type === 'VariableDeclaration') for (const d of st.declaration.declarations) collectPat(d.id, f);
      else collectPat(st.declaration.id, f);
    }
    for (const s of st.specifiers) exportsOfName.set(s.exported.name, f);
  }
}
const eslintBare = new ESLint({
  cwd: ROOT,
  overrideConfigFile: true,
  overrideConfig: [{
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { LOGO: 'readonly' } },
    rules: { 'no-undef': 'error' },
  }],
});
const leaks = [];
for (const f of FILES) {
  const [r] = await eslintBare.lintText(fs.readFileSync(path.join(SRC, f), 'utf8'), { filePath: path.join(SRC, f) });
  for (const m of r.messages.filter(m => m.ruleId === 'no-undef')) {
    const name = (m.message.match(/'([^']+)'/) || [])[1];
    const owner = name && exportsOfName.get(name);
    if (owner && owner !== f) leaks.push(`${f}:${m.line} uses "${name}" — exported by ${owner} but not imported (resolves to a browser global or throws)`);
  }
}
if (leaks.length) {
  fail++;
  console.log('✗ cross-module unimported references:');
  leaks.forEach(l => console.log('    ' + l));
} else console.log('✓ no cross-module unimported references');

console.log(fail ? `\nFAILED (${fail} check${fail > 1 ? 's' : ''})` : '\nALL STATIC CHECKS PASSED');
process.exit(fail ? 1 : 0);
