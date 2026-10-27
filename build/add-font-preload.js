/* Preloads the LATIN face of every family fonts.css declares, on every page that loads /assets/fonts.css.
   Why (2026-10-27, layout shift pass): fonts.css is Google's gstatic @font-face CSS with font-display:swap, and the
   browser only asks for a font file AFTER the stylesheet is parsed and the first layout has found text that needs
   it. So every page painted once in the fallback font and re-flowed when the real one landed - measured 3-28px per
   block (the calculator tabs wrapped from two rows to three, the h1 grew, the season strip moved), on cold AND warm
   loads, because even a cached font arrives a frame after first paint when nothing asked for it early. A preload
   starts the fetch with the HTML, so a cached font is ready for the first paint and a cold one arrives as early as
   the network allows. The URLs are READ out of fonts.css at run time (a version bump there moves them), one file per
   family (the variable faces share one file across weights). Idempotent; mirrors add-preconnect.js; runs after it.
   Run: node build/add-font-preload.js [--dry] */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');
const DRY = process.argv.includes('--dry');
const MARK = 'data-fontpre';

const css = fs.readFileSync(path.join(ROOT, 'assets', 'fonts.css'), 'utf8');
const re = /\/\*\s*latin\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
const urls = []; let m;
while ((m = re.exec(css))) {
  const u = (m[1].match(/url\(([^)]+)\)/) || [])[1];
  if (u && urls.indexOf(u) < 0) urls.push(u);
}
if (!urls.length) throw new Error('no latin faces found in fonts.css');
const BLOCK = urls.map(u => '<link rel="preload" as="font" type="font/woff2" crossorigin href="' + u + '" ' + MARK + ' />').join('\n') + '\n';
const FONTS_LINK = '<link rel="stylesheet" href="/assets/fonts.css"';

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && p.endsWith('.html')) out.push(p);
  }
  return out;
}
const files = walk(ROOT, []);
for (const extra of [path.join(__dirname, '..', 'app', 'index.html')]) if (fs.existsSync(extra)) files.push(extra);

let touched = 0, replaced = 0, skipped = 0;
for (const f of files) {
  let h = fs.readFileSync(f, 'utf8');
  const i = h.indexOf(FONTS_LINK);
  if (i < 0) { skipped++; continue; }
  if (h.indexOf(MARK) >= 0) {
    // re-run after a fonts.css version bump: replace the old block
    const out = h.split(/<link rel="preload" as="font"[^>]*data-fontpre \/>\n?/g).join('');
    const next = out.replace(FONTS_LINK, BLOCK + FONTS_LINK);
    if (next === h) { skipped++; continue; }
    h = next; replaced++;
  } else {
    h = h.slice(0, i) + BLOCK + h.slice(i); touched++;
  }
  if (!DRY) fs.writeFileSync(f, h);
}
console.log('add-font-preload: ' + urls.length + ' faces, injected ' + touched + ', replaced ' + replaced + ', skipped ' + skipped + (DRY ? ' (dry)' : ''));
