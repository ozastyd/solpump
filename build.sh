#!/bin/sh
# Rebuild dist/index.html from src/ and assets/ as a CLASSIC single-file bundle.
# src/ files are ES modules (Vite is the primary build: npm run build) — this script
# strips their import/export syntax and concatenates them in dependency order,
# reproducing the original global-scope bundle. Verify round-trip: strip(convert(x)) == x.
cd "$(dirname "$0")" || exit 1
# python3 may be a 0-byte Microsoft Store alias on Windows — probe it, else fall back to python
PYPATH=python3; "$PYPATH" -c '' >/dev/null 2>&1 || PYPATH=python
command -v "$PYPATH" >/dev/null 2>&1 || { echo "error: python not found on PATH" >&2; exit 1; }
"$PYPATH" - <<'PY'
import base64, re
ENC = "utf-8"  # sources are UTF-8; locale encoding (cp1252) crashes on src/ui1.js
IMPORT = re.compile(r"import \{[^}]*\} from '\./[a-z0-9]+\.js';")
def classic(f):
    s = open('src/' + f, encoding=ENC).read()
    lines = [l for l in s.split('\n') if not IMPORT.fullmatch(l)]
    return '\n'.join(re.sub(r'^export ', '', l).replace('; export ', '; ') for l in lines)
logo=base64.b64encode(open('assets/logo.png','rb').read()).decode()
css=open('src/style.css', encoding=ENC).read()
js="\n".join(classic(f) for f in ['core.js','intel.js','ui1.js','ui2.js','ui3.js','ui4.js'])
html=f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>SolPump Operations — Assalaam</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Semi-Condensed:wght@500;600&display=swap" rel="stylesheet">
<style>{css}</style></head>
<body><div style="padding:40px;font:16px system-ui">Loading 30 days of simulated field data…</div>
<script>
const LOGO="data:image/png;base64,{logo}";
{js}
setTimeout(()=>{{ try {{ boot(); renderLogin(); }} catch(e) {{ document.body.innerHTML='<pre>Startup error: '+e.stack+'</pre>'; }} }}, 30);
</script></body></html>'''
open('dist/index.html','w',encoding=ENC,newline='\n').write(html)
print('Built dist/index.html (classic bundle, utf-8, LF)')
PY
