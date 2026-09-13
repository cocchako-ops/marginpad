/* Walk every English dist page → build/data/es/catalog.json (deduped segments) + chunks for translators.
   node build/es/extract.js            (rebuild catalog, keep existing Spanish)
   node build/es/extract.js --chunks   (also write build/data/es/chunks/NNN.json for the untranslated part)      */
'use strict';
const fs = require('fs'), path = require('path');
const { extract, apply, wordsOf, norm } = require('./lib');
const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const DATA = path.join(ROOT, 'build', 'data', 'es');
const CAT = path.join(DATA, 'catalog.json');
const LANG = /^(es|pt|fr|de|ru|tr|zh|ja|ko|ar|id|nl|sv|no|da|fi)$/;
const SKIP_DIRS = new Set(['assets', 'demo-home', 'i18n', 'sdk', 'og', 'img', 'fonts', 'widget']);
// already Spanish / Portuguese by design
const SKIP_PAGES = new Set(['dolar-cripto/index.html', 'bitcoin-hoje/index.html', 'simulador-trading-cripto-argentina/index.html',
  'simulador-trading-cripto-brasil/index.html', 'app-es.html' /* our own output */]);

function pages() {
  const out = [];
  (function walk(d, rel) {
    for (const f of fs.readdirSync(d)) {
      const fp = path.join(d, f), r = rel ? rel + '/' + f : f;
      const st = fs.statSync(fp);
      if (st.isDirectory()) { if (LANG.test(f) || SKIP_DIRS.has(f)) continue; walk(fp, r); }
      else if ((f === 'index.html' || (!rel && f.endsWith('.html'))) && !SKIP_PAGES.has(r)) out.push(r);
    }
  })(DIST, '');
  return out.sort();
}

function main() {
  const withChunks = process.argv.includes('--chunks');
  fs.mkdirSync(DATA, { recursive: true });
  const old = fs.existsSync(CAT) ? JSON.parse(fs.readFileSync(CAT, 'utf8')) : { items: {} };
  const items = {}; let segTotal = 0, bad = 0;
  const list = pages();
  for (const rel of list) {
    const src = fs.readFileSync(path.join(DIST, rel), 'utf8');
    const ex = extract(src);
    // round-trip safety: applying the identity must reproduce the page byte for byte
    const rt = apply(src, (id, en) => en).html;
    if (rt !== src) { bad++; console.error('ROUND-TRIP MISMATCH', rel); }
    const page = '/' + rel.replace(/index\.html$/, '');
    const add = (id, en, kind) => {
      segTotal++;
      const it = items[id] || (items[id] = { en: norm(en), es: (old.items[id] && old.items[id].es) || '', kind: [], ctx: [], n: 0, w: wordsOf(en) });
      if (!it.kind.includes(kind)) it.kind.push(kind);
      if (it.ctx.length < 4 && !it.ctx.includes(page)) it.ctx.push(page);
      it.n++;
    };
    for (const s of ex.segs) add(s.id, s.html, s.kind);
    for (const a of ex.attrs) add(a.id, a.val, 'attr:' + a.attr);
    for (const L of ex.ld) for (const it of L.items) add(it.id, it.val, 'ld');
  }
  const ids = Object.keys(items);
  const words = ids.reduce((a, k) => a + items[k].w, 0);
  const todo = ids.filter(k => !items[k].es);
  const todoW = todo.reduce((a, k) => a + items[k].w, 0);
  const cat = { meta: { generated: new Date().toISOString(), pages: list.length, occurrences: segTotal, unique: ids.length, words, untranslated: todo.length, untranslatedWords: todoW }, items };
  fs.writeFileSync(CAT + '.tmp', JSON.stringify(cat, null, 1)); fs.renameSync(CAT + '.tmp', CAT);
  console.log(`pages ${list.length} · occurrences ${segTotal} · unique ${ids.length} · words ${words} · untranslated ${todo.length} (${todoW} words) · round-trip failures ${bad}`);
  if (withChunks) {
    const CH = path.join(DATA, 'chunks'); fs.mkdirSync(CH, { recursive: true });
    for (const f of fs.readdirSync(CH)) if (/^\d+(\.es(\.\d+)?)?\.json$/.test(f)) fs.unlinkSync(path.join(CH, f)); // chunks + their sidecars (numbering restarts)
    // group by first context page so a chunk reads like one page; cap ~2,800 words per chunk
    const byPage = {};
    for (const id of todo) { const p = items[id].ctx[0]; (byPage[p] = byPage[p] || []).push(id); }
    const order = Object.keys(byPage).sort();
    let chunk = [], cw = 0, ci = 0;
    const flush = () => { if (!chunk.length) return; ci++; fs.writeFileSync(path.join(CH, String(ci).padStart(3, '0') + '.json'), JSON.stringify(chunk.map(id => ({ id, ctx: items[id].ctx[0], kind: items[id].kind[0], en: items[id].en, es: '' })), null, 1)); chunk = []; cw = 0; };
    for (const p of order) { for (const id of byPage[p]) { chunk.push(id); cw += items[id].w; if (cw >= 2800) flush(); } }
    flush();
    console.log('chunks written:', ci, '→', CH);
  }
}
main();
