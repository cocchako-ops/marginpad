/* The homepage "Get funded" block (2026-11-16, owner: FTMO + IQ Capital under the exchanges, cool cards, details on click, our link
   inside the details). Sources: build/data/home-propfirms.{html,css,js} + home-propfirms-iq.html (the IQ Capital details).
   Idempotent: replaces whatever sits between its own markers. Writes dist/demo-home/index.html only - then run gen-home-live.
   Run: node build/fix-home-propfirms.js [--dry] */
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), F = path.join(R, 'dist/demo-home/index.html'), D = path.join(__dirname, 'data');
const dry = process.argv.includes('--dry');
let h = fs.readFileSync(F, 'utf8');
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const rd = (f) => fs.readFileSync(path.join(D, f), 'utf8').replace(/\r?\n/g, N);
const iq = rd('home-propfirms-iq.html').trim();
const html = rd('home-propfirms.html').split('@IQDET@').join(iq);
const css = '<style id="homeprop">' + rd('home-propfirms.css') + '</style>';
const js = rd('home-propfirms.js');

function between(src, a, b) { const i = src.indexOf(a), j = i < 0 ? -1 : src.indexOf(b, i); return i >= 0 && j > i ? [i, j + b.length] : null; }
function once(src, needle) { const i = src.indexOf(needle); if (i < 0 || src.indexOf(needle, i + 1) >= 0) throw new Error('anchor not unique: ' + needle.slice(0, 60)); return i; }

// markup: right after the exchange disclaimer, inside the Go live band
let r = between(h, '<!--@PROPFIRMS:start-->', '<!--@PROPFIRMS:end-->');
if (r) h = h.slice(0, r[0]) + html.trim() + h.slice(r[1]);
else { const a = '<div class="exch-disc">'; const i = once(h, a); const e = h.indexOf('</div>', i) + 6; h = h.slice(0, e) + N + html.trimEnd() + h.slice(e); }
// css
r = between(h, '<style id="homeprop">', '</style>');
if (r && h.slice(r[0], r[1]).indexOf('@PROPFIRMS:css') >= 0) h = h.slice(0, r[0]) + css + h.slice(r[1]);
else { const i = once(h, '</head>'); h = h.slice(0, i) + css + N + h.slice(i); }
// js
r = between(h, '<script>/*@PROPFIRMS:js', '})();</script>');
if (r) h = h.slice(0, r[0]) + js.trim() + h.slice(r[1]);
else { const i = h.lastIndexOf('</body>'); h = h.slice(0, i) + js.trim() + N + h.slice(i); }

for (const m of ['<!--@PROPFIRMS:start-->', '@PROPFIRMS:css', '@PROPFIRMS:js']) if (h.split(m).length !== 2) throw new Error('marker count wrong: ' + m);
if (h.indexOf('@IQDET@') >= 0) throw new Error('IQ details not filled');
if (dry) { console.log('dry ok', h.length); process.exit(0); }
fs.writeFileSync(F, h);
console.log('wrote', F, h.length);
