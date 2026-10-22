#!/usr/bin/env node
/* KEYBOARD DIAGNOSTIC v3 (2026-10-23). Two readings AFTER the window.focus() remedy was deployed (22:33:56 and
   22:34:03, installed app, iOS 18.7) still said hf:0 - the document had no system focus. Two things the label could
   not say, and the next reading has to:
     v:<hash>  - WHICH mp-auth the phone ran. The service worker has served a stale bundle on iOS before
                 (memory sw-stale-ios-2026-10-15), so "the remedy did not help" and "the remedy never arrived" read
                 the same today.
     wf:<x>    - whether the remedy RAN on that tap and what document.hasFocus() said right after window.focus():
                 'h' = focus was already held, '1' = focus() gave it, '0' = focus() changed nothing, '-' = no record.
   And ONE row when the keyboard DID come up (kbok2, once per page, iOS standalone only): a phone where it works
   tells us what hf reads on a healthy tap - without that, hf:0 on the broken phone cannot be told from
   "hasFocus() is always false in a home-screen app". `tr:` is dropped (every reading so far was 1) to stay inside
   the worker's 110-char label.

   Idempotent, --dry.                                                                                               */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'assets', 'mp-auth.js');
let h = fs.readFileSync(F, 'utf8');
const done = [];
function one(name, a, b, skipIf) {
  if (h.indexOf(skipIf) >= 0) return;
  const n = h.split(a).length - 1;
  if (n !== 1) throw new Error(name + ': anchor appears ' + n + ' times');
  h = h.split(a).join(b); done.push(name);
}

one('the remedy records what it did',
  "  document.addEventListener('touchstart', function (e) { if (!isComposer(e.target)) return; try { if (!document.hasFocus()) window.focus(); } catch (err) {} }, true);",
  "  var wf = '-', okSent = 0, VER = (function () { try { var s = document.querySelector('script[src*=\"mp-auth.js?v=\"]'); return s ? String(s.getAttribute('src').split('v=')[1] || '').slice(0, 4) : '-'; } catch (e) { return '-'; } })();\n"
  + "  document.addEventListener('touchstart', function (e) { if (!isComposer(e.target)) return; try { if (document.hasFocus()) wf = 'h'; else { window.focus(); wf = document.hasFocus() ? '1' : '0'; } } catch (err) { wf = '?'; } }, true);",
  "var wf = '-', okSent = 0, VER =");

one('a healthy tap reports once, and the fail label carries wf + v',
  "      if (okf && (kb || !IOS)) return;\n      var efp = null; try { efp = document.elementFromPoint(x, y); } catch (err) {}\n      var sa = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));\n      var ios = (navigator.userAgent.match(/OS (\\d+_\\d+)/) || [])[1] || '';",
  "      var sa = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));\n"
  + "      var ios = (navigator.userAgent.match(/OS (\\d+_\\d+)/) || [])[1] || '';\n"
  + "      if (okf && (kb || !IOS)) { // the keyboard came - on an installed iOS app say so ONCE, so a phone where it works tells us what hf reads there\n"
  + "        if (IOS && sa && !okSent) { okSent = 1; try { var ul = 'kbok2 sa:1 hf:' + (document.hasFocus() ? 1 : 0) + ' wf:' + wf + ' ios:' + ios + ' v:' + VER; var uu = '/api/track?t=jserr&e=' + encodeURIComponent(ul) + '&p=' + encodeURIComponent(location.pathname); if (navigator.sendBeacon) navigator.sendBeacon(uu); else (new Image()).src = uu; } catch (err) {} }\n"
  + "        return;\n"
  + "      }\n"
  + "      var efp = null; try { efp = document.elementFromPoint(x, y); } catch (err) {}",
  "kbok2 sa:1 hf:");

one('tr: makes room for wf: and v:',
  "        + ' p:' + EV.map(function (n) { return pd[n] || '-'; }).join('/') + ' tr:' + trusted + ' dur:' + (tsAt ? (t0 - tsAt) : '-')",
  "        + ' p:' + EV.map(function (n) { return pd[n] || '-'; }).join('/') + ' wf:' + wf + ' v:' + VER + ' dur:' + (tsAt ? (t0 - tsAt) : '-')",
  "' wf:' + wf + ' v:' + VER + ' dur:'");

if (!done.length) { console.log('add-keyboard-diag3: nothing to do'); process.exit(0); }
if ((h.match(/kbok2 sa:1 hf:/g) || []).length !== 1) throw new Error('kbok2 not exactly once');
if (h.indexOf("' tr:' + trusted") >= 0) throw new Error('tr: survived');
console.log('add-keyboard-diag3: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('  written: dist/assets/mp-auth.js\n  NEXT: node build/bump-home-assets.js && npm run deploy');
