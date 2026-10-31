/* The hub's cards are drawn from index.json, which is English. This writes each twin language's strategy summaries and style
   names beside it, taken from the same catalog the static pages use, so there is no second translation to keep.
   Run after the catalogs are merged: node build/strategies/gen-i18n.js */
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', '..');
const D = JSON.parse(fs.readFileSync(path.join(R, 'dist/strategies/data/index.json'), 'utf8'));
const dec = (s) => String(s).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
for (const l of ['es', 'pt', 'de']) {
  const c = JSON.parse(fs.readFileSync(path.join(R, `build/data/${l}/catalog.json`), 'utf8')).items, by = {};
  for (const it of Object.values(c)) if (it[l]) by[dec(it.en)] = dec(it[l]);
  const out = { styles: {} }; let miss = 0;
  for (const r of D.rules) { const t = by[r.summary]; if (t) out[r.slug] = t; else miss++; }
  for (const [k, v] of Object.entries(D.meta.styles)) out.styles[k] = by[v] || v;
  fs.writeFileSync(path.join(R, `dist/strategies/data/i18n-${l}.json`), JSON.stringify(out));
  console.log(l, 'summaries', D.rules.length - miss, 'of', D.rules.length);
}
