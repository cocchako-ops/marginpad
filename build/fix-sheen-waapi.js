#!/usr/bin/env node
/* THE MEMBER-TAG SHEEN IS A WEB ANIMATION, NOT A 45 ms TIMER (2026-11-12, perf pass).

   The sheen on the member tag was tweened from a setInterval every 45 ms that ran document.querySelectorAll('[data-sheen]')
   and wrote background-position on every hit. Measured on the homepage at idle on a phone: 134 fires in six seconds, and the
   style recalcs it caused were 486 ms of those six seconds - the biggest single cost on the busiest page of the site, paid by
   GUESTS too (the selector ran even with nothing to sheen). element.animate() paints with OS animation effects off exactly as
   the interval did (that is why the interval existed - see the comment it replaces), the compositor does the work, and a 1 s
   scan arms whatever tag appears later (a re-rendered card loses the attribute and is armed again within a second).

   The block lives in FIFTEEN copies (the bento homepage source, the live homepage, the 12 language homepages and mp-profile.js)
   and they are byte-identical; this rewrites all of them by exact text, idempotent, --dry prints the count. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.indexOf('--dry') >= 0;

const OLD = [
  '(function(){ if (window.__mpSheen) return; window.__mpSheen = 1;',
  '    var t = 0;',
  '    setInterval(function(){',
  '      if (document.hidden) return;',
  "      var els = document.querySelectorAll('[data-sheen]');",
  '      if (!els.length) return;',
  '      t = (t + 3) % 260;',
  "      for (var i = 0; i < els.length; i++) els[i].style.backgroundPosition = (120 - t) + '% 0';",
  '    }, 45);',
  '  })();',
].join('\n');
const NEW = [
  '(function(){ if (window.__mpSheen) return; window.__mpSheen = 1;',
  '    /* WAAPI since 2026-11-12 (build/fix-sheen-waapi.js): the 45 ms interval cost 486 ms of style recalc per six idle seconds on a phone, guests included */',
  "    function arm(){ if (document.hidden) return; var els = document.querySelectorAll('[data-sheen]:not([data-sheen-on])');",
  "      for (var i = 0; i < els.length; i++) { try { els[i].setAttribute('data-sheen-on', '1'); els[i].animate([{ backgroundPosition: '120% 0' }, { backgroundPosition: '-140% 0' }], { duration: 3900, iterations: Infinity, easing: 'linear' }); } catch (e) {} } }",
  '    arm(); setInterval(arm, 1000);',
  '  })();',
].join('\n');
const lf = s => s.split('\r\n').join('\n');

const files = [path.join(ROOT, 'dist', 'assets', 'mp-profile.js'), path.join(ROOT, 'dist', 'demo-home', 'index.html'), path.join(ROOT, 'dist', 'index.html')];
for (const d of fs.readdirSync(path.join(ROOT, 'dist'))) { const f = path.join(ROOT, 'dist', d, 'index.html'); if (/^[a-z]{2}$/.test(d) && fs.existsSync(f)) files.push(f); }
let n = 0, had = 0, miss = 0;
for (const f of files) {
  const h = fs.readFileSync(f, 'utf8');
  const crlf = h.indexOf('\r\n') >= 0 && lf(h) !== h;
  const body = lf(h);
  if (body.indexOf('data-sheen-on') >= 0) { had++; continue; }
  const k = body.split(OLD).length - 1;
  if (k !== 1) { miss++; console.error('fix-sheen-waapi: block found ' + k + 'x in ' + path.relative(ROOT, f) + ' - left alone'); continue; }
  let out = body.split(OLD).join(NEW);
  if (crlf) out = out.split('\n').join('\r\n');
  if (!DRY) { fs.writeFileSync(f + '.tmp', Buffer.from(out, 'utf8')); fs.renameSync(f + '.tmp', f); }
  n++;
}
console.log('fix-sheen-waapi: ' + (DRY ? 'would patch ' : 'patched ') + n + ', already done ' + had + ', not found ' + miss + ' of ' + files.length);
if (miss) process.exit(1);
