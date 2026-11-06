/* Lists the Academy diagram labels a language pack is missing, and merges translated ones back.
     node build/academy-viz-todo.js dump  -> build/data/academy-viz/todo.json  {key: [langs missing]}
     node build/academy-viz-todo.js merge -> reads build/data/academy-viz/<lang>.json {en: translation} into
                                             dist/academy/i18n/_<lang>-vizadd.json (never overwrites an entry already there)
   Then run node build/gen-academy-i18n.js. */
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), I18N = path.join(R, 'dist/academy/i18n'), D = path.join(R, 'build/data/academy-viz');
const LANGS = ['sr', 'es', 'de', 'fr', 'pt', 'nl', 'ru', 'tr', 'id', 'zh', 'ja', 'ko', 'ar', 'hi'];
const html = fs.readFileSync(path.join(R, 'dist/academy/index.html'), 'utf8');
function keys() {
  const k = new Set(), body = html.slice(html.indexOf('var VIZ={')); let x;
  const re = /<text[^>]*>([^<>{}]+)<\/text>/g; while ((x = re.exec(body))) { const s = x[1].trim(); if (s && !/^[\d\s.,%$x/+-]*$/i.test(s)) k.add(s); }
  const rc = /svgWrap\([\s\S]{0,4000}?,\s*'((?:[^'\\]|\\.)*)'\s*\)/g; while ((x = rc.exec(body))) { const s = x[1].replace(/\\'/g, "'").trim(); if (s && /[a-z]{3}/i.test(s)) k.add(s); }
  return k;
}
const read = (f) => { try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return j.viz || j; } catch (e) { return {}; } };
const have = (l) => Object.assign({}, read(path.join(I18N, '_' + l + '-viz.json')), read(path.join(I18N, '_' + l + '-vizadd.json')));
fs.mkdirSync(D, { recursive: true });
if (process.argv[2] === 'merge') {
  for (const l of LANGS) {
    const f = path.join(D, l + '.json'); if (!fs.existsSync(f)) continue;
    const add = JSON.parse(fs.readFileSync(f, 'utf8')), vf = path.join(I18N, '_' + l + '-vizadd.json'), cur = read(vf), h = have(l); let n = 0;
    for (const [en, t] of Object.entries(add)) if (typeof t === 'string' && t.trim() && !h[en]) { cur[en] = t; n++; }
    fs.writeFileSync(vf, JSON.stringify(cur, null, 1)); console.log(l, 'merged', n);
  }
} else {
  const all = keys(), todo = {};
  for (const l of LANGS) { const h = have(l); for (const k of all) if (!String(h[k] || '').trim()) (todo[k] = todo[k] || []).push(l); }
  fs.writeFileSync(path.join(D, 'todo.json'), JSON.stringify(todo, null, 1)); console.log('keys missing somewhere', Object.keys(todo).length);
}
