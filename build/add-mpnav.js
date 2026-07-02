// Inject the shared desktop nav (/assets/mp-nav.js) into every standalone page.
// Skips: the homepage & language homepages (they carry the inline Browse panel — detected via class="mobnav"),
// widget embeds (meant for iframes), and anything that already has it. Idempotent — safe to re-run each build.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');
const TAG = '<script defer src="/assets/mp-nav.js"></script>';

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'assets') continue; walk(p, out); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let added = 0, skipped = 0;
for (const f of walk(ROOT, [])) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  let html = fs.readFileSync(f, 'utf8');
  if (html.includes('mp-nav.js')) { skipped++; continue; }            // already has it
  if (html.includes('hmenuBtn')) { skipped++; continue; }             // homepage / lang homepage — already has the inline hamburger + Browse
  if (rel.startsWith('widget/') || rel.includes('/widget/')) { skipped++; continue; } // iframe embeds
  if (!html.includes('</body>')) { skipped++; continue; }
  const i = html.lastIndexOf('</body>');
  html = html.slice(0, i) + TAG + '\n' + html.slice(i);
  fs.writeFileSync(f, html);
  added++;
}
console.log('mp-nav injected into ' + added + ' pages, skipped ' + skipped);
