/* Point every page at its OWN share card (2026-09-14, rewritten).
 *
 * Owner: "jel mozemo za svaki link da napravimo drugaciju i cool stranicu ... da mami klik."
 *
 * Measured before: 856 pages, 758 of them pointing at the same /assets/og.png. `node build/gen-og-images.js`
 * renders one card per page into dist/assets/og/<slug>.jpg; this walks dist and rewrites og:image and
 * twitter:image to that card wherever it exists, falling back to the site card where it does not.
 *
 * A Spanish twin gets the SAME card as its English original: the card carries the subject, and the title
 * and description around it in the preview are already Spanish. Cards with Spanish type can come later
 * without changing anything here.
 *
 * Idempotent: rewrites an existing tag rather than appending a second one. Runs in build.js before
 * fix-charset. Run: node build/add-og-image.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OGDIR = path.join(DIST, 'assets', 'og');
const SITE = 'https://marginpad.io/assets/og.png';
const DRY = process.argv.includes('--dry');

const have = new Set();
try { for (const f of fs.readdirSync(OGDIR)) if (f.endsWith('.jpg')) have.add(f.slice(0, -4)); } catch (e) {}
if (!have.size) { console.error('no cards in dist/assets/og — run node build/gen-og-images.js first'); process.exit(1); }

const slugOf = rel => rel.replace(/^\/+|\/+$/g, '').replace(/\//g, '-') || 'home';

function cardFor(rel) {
  const own = slugOf(rel);
  if (have.has(own)) return own;
  // a Spanish twin shares its English original's card
  if (/^\/es\//.test(rel)) { const en = slugOf(rel.replace(/^\/es/, '')); if (have.has(en)) return en; }
  // a translated subpage (/de/funding/ …) shares the English page's card
  const m = rel.match(/^\/[a-z]{2}\/(.+)$/);
  if (m) { const en = slugOf('/' + m[1]); if (have.has(en)) return en; }
  return null;
}

function setMeta(h, re, tag) {
  if (re.test(h)) return h.replace(re, tag);
  const i = h.indexOf('</head>');
  return i < 0 ? h : h.slice(0, i) + tag + '\n' + h.slice(i);
}

let own = 0, fell = 0, skipped = 0, files = 0;
(function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'assets' || e.name === 'i18n') continue;
      walk(p, rel + '/' + e.name);
      continue;
    }
    if (!e.name.endsWith('.html') || e.name === 'app.html' || e.name === 'app-es.html') continue;
    let h = fs.readFileSync(p, 'utf8');
    if (/name="robots" content="[^"]*noindex/.test(h)) { skipped++; continue; }
    files++;
    const slug = cardFor(e.name === 'index.html' ? rel + '/' : rel + '/' + e.name);
    const img = slug ? 'https://marginpad.io/assets/og/' + slug + '.jpg' : SITE;
    if (slug) own++; else fell++;
    let out = h;
    out = setMeta(out, /<meta property="og:image" content="[^"]*"\s*\/?>/, '<meta property="og:image" content="' + img + '" />');
    out = setMeta(out, /<meta name="twitter:image" content="[^"]*"\s*\/?>/, '<meta name="twitter:image" content="' + img + '" />');
    if (!/name="twitter:card"/.test(out)) out = setMeta(out, /$^/, '<meta name="twitter:card" content="summary_large_image" />');
    // the size is what stops a platform guessing and cropping
    if (!/property="og:image:width"/.test(out)) {
      const i = out.indexOf('</head>');
      if (i > 0) out = out.slice(0, i) + '<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />\n' + out.slice(i);
    }
    if (out !== h && !DRY) fs.writeFileSync(p, out);
  }
})(DIST, '');

// demo-home is NOT touched: it is noindex, and gen-home-live injects the real head (with the homepage
// card) when it writes dist/index.html. Setting it here too put TWO og:image tags in the live homepage.

console.log('share cards: ' + own + ' pages on their own card, ' + fell + ' on the site card, ' + skipped + ' noindex skipped (' + files + ' scanned)' + (DRY ? '  [dry run]' : ''));
