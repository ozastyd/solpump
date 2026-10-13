/* ============================================================
   i18n — English (source) + Indonesian. No dependencies on other src files.
   tl("English text with {vars}", { vars }) — key IS the English string; missing keys fall back to English.
   tlk("text") — identity marker for string constants (translate at use: tl(CONST[k])).
   tlx(stored) — runtime translation of strings stored in state (exact match, then PAT_* regexes).
   ============================================================ */
import { ID_CORE, PAT_CORE } from './id-core.js';
import { ID_INTEL, PAT_INTEL } from './id-intel.js';
import { ID_UI1, PAT_UI1 } from './id-ui1.js';
import { ID_UI2, PAT_UI2 } from './id-ui2.js';
import { ID_UI3, PAT_UI3 } from './id-ui3.js';
import { ID_UI4, PAT_UI4 } from './id-ui4.js';
export const LANGS = [["en", "EN", "English"], ["id", "ID", "Bahasa Indonesia"]];
export const I18N = { lang: "en" };
export const DICT = Object.assign({}, ID_CORE, ID_INTEL, ID_UI1, ID_UI2, ID_UI3, ID_UI4);
const PATS = [].concat(PAT_CORE, PAT_INTEL, PAT_UI1, PAT_UI2, PAT_UI3, PAT_UI4);
try { const l = localStorage.getItem("solpump.lang"); if (LANGS.some(x => x[0] === l)) I18N.lang = l; } catch (_) {}
const fill = (s, v) => v ? s.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m) : s;
export const tl = (s, v) => fill(I18N.lang === "id" && DICT[s] !== undefined ? DICT[s] : s, v);
export const tlk = s => s;
export const tlx = s => { if (I18N.lang !== "id" || typeof s !== "string") return s; if (DICT[s] !== undefined) return DICT[s]; for (const [re, to] of PATS) if (re.test(s)) return s.replace(re, to); return s; };
export function setLang(l) {
  if (!LANGS.some(x => x[0] === l)) return;
  I18N.lang = l; try { localStorage.setItem("solpump.lang", l); } catch (_) {}
  if (typeof document !== "undefined") document.documentElement.lang = l;
}
