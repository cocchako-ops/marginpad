/* Normalise the viewport meta on EVERY built page to a consistent app-like, no-pinch-zoom value.
   Many generators emitted plain "width=device-width, initial-scale=1.0" (pinch-zoomable) while the
   homepage already disabled zoom — this unifies all of them. Idempotent. Run after all pages exist. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');
const CANON = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
const RE = /<meta\s+name="viewport"\s+content="[^"]*"\s*\/?>/i;
const TAG = '<meta name="viewport" content="' + CANON + '" />';

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'assets') continue; walk(p, out); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let changed = 0, already = 0, noMeta = 0;
for (const f of walk(ROOT, [])) {
  let html = fs.readFileSync(f, 'utf8');
  const m = html.match(RE);
  if (!m) { noMeta++; continue; }
  if (m[0] === TAG) { already++; continue; }
  html = html.replace(RE, TAG);
  fs.writeFileSync(f, html);
  changed++;
}
console.log('viewport normalised: ' + changed + ' updated, ' + already + ' already canonical, ' + noMeta + ' without a viewport meta');
