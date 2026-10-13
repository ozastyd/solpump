import logo from '../assets/logo.png';
import './i18n.js';
import './core.js';
import './intel.js';
import './motion.js';
import './ui1.js';
import './ui2.js';
import './ui3.js';
import './ui4.js';
import { boot } from './ui4.js';
import { renderLogin } from './ui1.js';

globalThis.LOGO = logo;

setTimeout(() => {
  try {
    boot();
    renderLogin();
  } catch (e) {
    document.body.innerHTML = '<pre>Startup error: ' + e.stack + '</pre>';
  }
}, 30);
