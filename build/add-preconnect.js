/* Injects a fonts.gstatic.com preconnect into every dist HTML page that loads /assets/fonts.css.
   fonts.css @font-face points at fonts.gstatic.com, which the browser only discovers AFTER parsing
   fonts.css — a late connection on the LCP (text) critical path. Preconnecting warms DNS+TLS in parallel.
   Idempotent + safe to re-run after every build (pattern mirrors add-gtag.js). Run LAST.
   Run: node build/add-preconnect.js */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');

const BLOCK = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n<link rel="dns-prefetch" href="https://fonts.gstatic.com" />\n';
const FONTS_LINK = '<link rel="stylesheet" href="/assets/fonts.css"';

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && p.endsWith('.html')) out.push(p);
  }
  return out;
}

let touched = 0, skipped = 0;
for (const f of walk(ROOT, [])) {
  let h = fs.readFileSync(f, 'utf8');
  if (h.indexOf(FONTS_LINK) === -1) { skipped++; continue; }                 // no self-hosted fonts.css
  if (h.indexOf('preconnect" href="https://fonts.gstatic.com"') !== -1) { skipped++; continue; } // already warmed
  h = h.replace(FONTS_LINK, BLOCK + FONTS_LINK);
  fs.writeFileSync(f, h);
  touched++;
}
console.log('add-preconnect: injected into ' + touched + ' pages, skipped ' + skipped);
