#!/usr/bin/env node
/* THE COOKIE NOTICE'S ROOM IS DECIDED BEFORE THE FIRST FRAME (2026-11-12, perf pass).

   mp-nav.js inserts the cookie notice at the top of <body> 900 ms after DOMContentLoaded, and the whole page moved down by
   its height - MEASURED on production: CLS 0.030 on a desktop, 0.056-0.061 on a phone, at ~1.05 s, on EVERY visit by anyone
   who has not pressed OK (a first visit, every visit by somebody who ignores it). It was the one layout shift left on the
   site after the 2026-10-27 round, and it is the first thing a new visitor sees move.

   This inlines ONE line right after <meta charset> on every page that loads mp-nav.js (the pages without it never get the
   bar, so they must not reserve for one): when neither the mp_ck_ok cookie nor localStorage says OK, <html> gets .mp-ckbar
   at frame 0. The HDRCRIT stylesheet (mp-nav.js @HDRCRIT, inlined by add-hdr-crit.js) reserves the bar's measured height
   as a transparent border on <body>; mount() in mp-nav swaps the reservation for the bar in one frame (html.mp-ckon), and
   every path that decides not to mount takes the class off. <meta charset> stays the FIRST tag - this goes after it.

   Idempotent (the marker is the script's own text), --dry prints what it would do. CRLF/LF are kept per file. */
'use strict';
const fs = require('fs');
const path = require('path');
const { htmlFiles } = require('./lib-html-files');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.indexOf('--dry') >= 0;

const MARK = 'mp_ck_ok=1';
const BOOT = '<script>/* cookie notice room at frame 0 - see build/add-ckbar-boot.js */try{var _ck=/(?:^|;\\s*)mp_ck_ok=1(?:;|$)/.test(document.cookie)||!!localStorage.getItem("mp_ck_ok");if(!_ck)document.documentElement.className+=" mp-ckbar";}catch(e){}</script>';
const META_RE = /<meta charset=["']?utf-8["']?\s*\/?>/i;

const files = [path.join(ROOT, 'app', 'index.html')].concat(htmlFiles(ROOT).filter(f => f.indexOf(path.join('dist', 'assets')) < 0));
let patched = 0, skipped = 0, noNav = 0, noMeta = 0, had = 0;
for (const f of files) {
  let h; try { h = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (h.indexOf('/assets/mp-nav.js') < 0) { noNav++; continue; }          // no mp-nav = no bar = nothing to reserve
  if (h.indexOf(MARK) >= 0) { had++; continue; }                             // already carries the boot (or its own copy of the check)
  const m = h.match(META_RE);
  if (!m) { noMeta++; console.error('add-ckbar-boot: no <meta charset> in ' + path.relative(ROOT, f)); continue; }
  const eol = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const at = m.index + m[0].length;
  const out = h.slice(0, at) + eol + BOOT + h.slice(at);
  if (!DRY) { fs.writeFileSync(f + '.tmp', Buffer.from(out, 'utf8')); fs.renameSync(f + '.tmp', f); }
  patched++;
}
console.log('add-ckbar-boot: ' + (DRY ? 'would patch ' : 'patched ') + patched + ' page(s); already had it ' + had + '; without mp-nav (left alone) ' + noNav + '; no charset tag ' + noMeta + ' of ' + files.length);
if (noMeta) process.exit(1);
