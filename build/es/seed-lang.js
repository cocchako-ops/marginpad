/* SEED A SECOND TWIN LANGUAGE FROM THE SPANISH CATALOG (2026-10-29, owner: "prevedemo najudarnije stranice na portugalski").
   The Spanish catalog already holds every English segment of every page (id = hash of the English text, ctx = the pages it
   lives on), so a new language needs no re-extraction: copy the items whose ctx touches the chosen pages into
   build/data/<lang>/catalog.json with an empty <lang> field, and cut them into translator chunks.
     node build/es/seed-lang.js --lang pt --pages build/data/pt/pages.txt [--chunk-words 900]
   pages.txt = one path per line (e.g. "/rewards/", "/app.html"). Re-running keeps translations already in the target catalog. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LANG = arg('--lang', 'pt'), CHUNK_WORDS = +arg('--chunk-words', 900);
const DATA = path.join(ROOT, 'build', 'data', LANG);
const pagesFile = arg('--pages', path.join(DATA, 'pages.txt'));
const pages = new Set(fs.readFileSync(pagesFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#')));
const es = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'data', 'es', 'catalog.json'), 'utf8')).items;
let old = {}; try { old = JSON.parse(fs.readFileSync(path.join(DATA, 'catalog.json'), 'utf8')).items || {}; } catch (e) { }
const items = {}; let words = 0, kept = 0, untranslated = 0;
for (const id of Object.keys(es)) {
  const it = es[id]; if (!it.ctx.some(c => pages.has(c))) continue;
  const o = { en: it.en, kind: it.kind, ctx: it.ctx.filter(c => pages.has(c)), n: it.n, w: it.w };
  o[LANG] = (old[id] && old[id][LANG]) || '';
  if (old[id] && old[id].leaf) o.leaf = true;
  items[id] = o; words += it.w || 0; if (o[LANG]) kept++; else untranslated++;
}
fs.mkdirSync(path.join(DATA, 'chunks'), { recursive: true });
fs.writeFileSync(path.join(DATA, 'catalog.json'), JSON.stringify({ meta: { lang: LANG, generated: new Date().toISOString(), pages: pages.size, unique: Object.keys(items).length, words, untranslated }, items }, null, 1));
// chunks: untranslated items only, ordered by page so a translator sees one page's context together
const todo = Object.keys(items).filter(id => !items[id][LANG] && !items[id].leaf).sort((a, b) => (items[a].ctx[0] + a).localeCompare(items[b].ctx[0] + b));
for (const f of fs.readdirSync(path.join(DATA, 'chunks'))) if (/^\d{3}\.json$/.test(f)) fs.unlinkSync(path.join(DATA, 'chunks', f));
let chunk = [], cw = 0, n = 0;
const flush = () => { if (!chunk.length) return; n++; fs.writeFileSync(path.join(DATA, 'chunks', String(n).padStart(3, '0') + '.json'), JSON.stringify(chunk, null, 1)); chunk = []; cw = 0; };
for (const id of todo) { const it = items[id]; const row = { id, ctx: it.ctx[0], kind: it.kind[0], en: it.en }; row[LANG] = ''; chunk.push(row); cw += it.w || 1; if (cw >= CHUNK_WORDS) flush(); }
flush();
console.log(LANG, 'pages', pages.size, 'items', Object.keys(items).length, 'words', words, 'already translated', kept, 'untranslated', untranslated, 'chunks', n);
