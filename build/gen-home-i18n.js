/* Translate the NEW bento homepage BODY into each language page.
   Runs AFTER gen-i18n-pages.js (which already sets lang/title/description/canonical/hreflang on
   dist/<lang>/index.html). This is a post-processor: it reads each dist/<lang>/index.html (new design,
   English body) and swaps English visible text + UI attributes for the translated strings in
   scratch_home_i18n_<lang>.json (produced by the translation pass).

   Matching is full-text-node (`>text<`) so a short string can never partially replace inside a longer
   node; whitespace in a key is matched flexibly (\s+) so wrapped paragraphs still match; `&` in a key
   is matched as its HTML entity `&amp;`. Attribute values are swapped with `="value"` except a blacklist
   of technical values (og:type, locale, robots, twitter:card, the duplicated og:title). Idempotent-ish:
   English needles no longer exist after translation, so a second run is a near no-op. */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const LANGS = ['es', 'pt', 'fr', 'de', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id', 'nl'];

// technical attribute values that must NEVER be translated (they'd break OG/locale/robots/twitter)
const ATTR_SKIP = new Set([
  'website', 'en_US', 'summary_large_image', 'index,follow,max-image-preview:large',
  'MarginPad — Free Crypto Futures Terminal, Paper Trade & Liquidations', // og:title dup — title already localized by gen-i18n-pages
]);

const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escText = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = v => escText(v).replace(/"/g, '&quot;');
// build a whitespace-flexible, entity-tolerant regex source for a plain-text key
const needle = k => reEsc(k).replace(/&/g, '&amp;').replace(/\s+/g, '\\s+');

let grand = 0;
for (const lang of LANGS) {
  const file = path.join(DIST, lang, 'index.html');
  const mapFile = path.join(__dirname, 'data', 'home-i18n', lang + '.json');
  if (!fs.existsSync(file) || !fs.existsSync(mapFile)) { console.log('skip', lang, '(missing file)'); continue; }
  let html = fs.readFileSync(file, 'utf8');
  const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  const keys = Object.keys(map).sort((a, b) => b.length - a.length); // longest first
  let txt = 0, att = 0;
  for (const k of keys) {
    const v = map[k];
    if (!v || v === k || k.length < 2) continue;
    // 1) full text-node replacement: >  k  < → > v <
    const reT = new RegExp('>(\\s*)' + needle(k) + '(\\s*)<', 'g');
    html = html.replace(reT, (m, p1, p2) => { txt++; return '>' + p1 + escText(v) + p2 + '<'; });
    // 2) attribute value replacement (UI labels, keywords, descriptions) — skip technical values
    if (!ATTR_SKIP.has(k)) {
      const an = reEsc(k).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      const reA = new RegExp('="' + an + '"', 'g');
      html = html.replace(reA, () => { att++; return '="' + escAttr(v) + '"'; });
    }
  }
  fs.writeFileSync(file, html);
  grand += txt + att;
  console.log(`${lang}: ${txt} text nodes + ${att} attrs translated`);
}
console.log('done — total replacements:', grand);
