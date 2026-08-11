/* Honest freshness stamping (2026-08-11). For every dist page that carries a JSON-LD dateModified:
   - hash the page content with all date stamps stripped out
   - if the content ACTUALLY changed since the last recorded build, bump dateModified to today,
     refresh the visible "Updated <Month> <Year>" meta text and the sitemap <lastmod> for that URL
   - unchanged pages keep their old date (no fake freshness — auto-bumping everything would be
     dishonest and is exactly what search engines penalize)
   First run seeds build/data/page-mod-hashes.json without bumping anything. Idempotent. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DIST = path.join(__dirname, '..', 'dist');
const MANIFEST = path.join(__dirname, 'data', 'page-mod-hashes.json');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const now = new Date();
const today = now.toISOString().slice(0, 10);
const monthYear = MONTHS[now.getUTCMonth()] + ' ' + now.getUTCFullYear();

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets') walk(p, out); }
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}
const strip = h => h
  .replace(/"dateModified":\s*"[0-9T:.Z-]+"/g, '"dateModified":""')
  .replace(/"datePublished":\s*"[0-9T:.Z-]+"/g, '"datePublished":""')
  .replace(/Updated\s+[A-Z][a-z]+\s+\d{4}/g, 'Updated')
  .replace(/\?v=[0-9a-f]+/g, '?v='); // asset cache-busters change every bump run — not content
const sha = s => crypto.createHash('sha1').update(s).digest('hex');

let manifest = {}, seeded = !fs.existsSync(MANIFEST);
if (!seeded) { try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { manifest = {}; seeded = true; } }

const SITEMAP = path.join(DIST, 'sitemap.xml');
let sm = fs.existsSync(SITEMAP) ? fs.readFileSync(SITEMAP, 'utf8') : null;
let smDirty = false;

let bumped = 0, unchanged = 0, added = 0;
for (const f of walk(DIST, [])) {
  let html;
  try { html = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (html.indexOf('dateModified') < 0) continue;
  const rel = path.relative(DIST, path.dirname(f)).replace(/\\/g, '/');
  const key = '/' + (rel === '' ? '' : rel + '/');
  const h = sha(strip(html));
  const prev = manifest[key];
  if (prev === undefined) { manifest[key] = h; added++; continue; } // seed — never bump on first sight
  if (prev === h) { unchanged++; continue; }
  // real content change → stamp today
  let out = html.replace(/"dateModified":\s*"[0-9T:.Z-]+"/g, '"dateModified":"' + today + '"');
  out = out.replace(/Updated\s+[A-Z][a-z]+\s+\d{4}/g, 'Updated ' + monthYear);
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(out, 'utf8'));
  fs.renameSync(tmp, f);
  manifest[key] = sha(strip(out));
  bumped++;
  if (sm) {
    const loc = 'https://marginpad.io' + key;
    const re = new RegExp('(<url><loc>' + loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</loc>)(<lastmod>[^<]*</lastmod>)?');
    if (re.test(sm)) { sm = sm.replace(re, '$1<lastmod>' + today + '</lastmod>'); smDirty = true; }
  }
}
if (smDirty) fs.writeFileSync(SITEMAP, sm);
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 0));
console.log('stamp-updated: ' + (seeded ? 'SEEDED ' + added + ' pages (no bumps on first run)' : bumped + ' bumped, ' + unchanged + ' unchanged, ' + added + ' new') + (smDirty ? ', sitemap lastmod refreshed' : ''));
