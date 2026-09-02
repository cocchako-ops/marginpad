/* Assembles the Academy translation bundles the page actually fetches:
     dist/academy/i18n/_<lang>-<course>.json  (per-course translations, hand/AI authored)
   + dist/academy/i18n/_<lang>-viz.json       (visual labels+captions, keyed by the exact EN string)
   → dist/academy/i18n/<lang>.json            (what /academy fetches at runtime)

   Source of truth for course ORDER and lesson MECHANICS is the inline #acadData in
   dist/academy/index.html. Translations only carry text: the page merges each pack onto a pristine
   EN structure, and it does that per-lesson with a STRICT shape check —
     tl.cards.length === L.cards.length   and   tl.quiz[i].o.length === q.o.length
   — so a translated lesson with the wrong number of cards or options is silently dropped and the
   user reads that lesson in English. That failure is invisible in production, which is why this
   script validates shape against EN and refuses to write a bundle that would lose a lesson.

   A course with no translation file is simply omitted from the bundle: the page falls back to the
   EN text for it, which is correct behaviour while a new course is being translated.

   Run: node build/gen-academy-i18n.js   (also: --check to validate without writing)
*/
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const I18N = path.join(DIST, 'academy', 'i18n');
const PAGE = path.join(DIST, 'academy', 'index.html');
const LANGS = ['sr', 'es', 'de', 'fr', 'pt', 'nl', 'ru', 'tr', 'id', 'zh', 'ja', 'ko', 'ar'];
const CHECK_ONLY = process.argv.includes('--check');

// ---- EN master out of the page (order + shape authority) ----
const html = fs.readFileSync(PAGE, 'utf8');
const m = html.match(/<script type="application\/json" id="acadData">([\s\S]*?)<\/script>/);
if (!m) { console.error('gen-academy-i18n: #acadData not found in dist/academy/index.html'); process.exit(1); }
const EN = JSON.parse(m[1]);
const ORDER = EN.courses.map(c => c.id);
const enById = {}; EN.courses.forEach(c => { enById[c.id] = c; });

const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
let problems = 0;

// ---- shape check: mirrors the page's merge conditions exactly ----
function checkCourse(lang, cid, tc) {
  const en = enById[cid];
  const errs = [];
  if (!en) { errs.push('course "' + cid + '" is not in #acadData'); return errs; }
  const tl = {}; (tc.lessons || []).forEach(L => { tl[L.id] = L; });
  en.lessons.forEach(L => {
    const t = tl[L.id];
    if (!t) { errs.push(L.id + ': missing (falls back to English)'); return; }
    if (!t.cards || t.cards.length !== L.cards.length)
      errs.push(L.id + ': ' + ((t.cards || []).length) + ' cards, EN has ' + L.cards.length + ' — WHOLE LESSON DROPPED');
    if (!t.quiz || t.quiz.length !== L.quiz.length)
      errs.push(L.id + ': ' + ((t.quiz || []).length) + ' quiz questions, EN has ' + L.quiz.length + ' — quiz stays English');
    else L.quiz.forEach((q, i) => {
      const to = t.quiz[i] && t.quiz[i].o;
      if (to && to.length !== q.o.length) errs.push(L.id + ' q' + (i + 1) + ': ' + to.length + ' options, EN has ' + q.o.length + ' — options stay English');
    });
    L.cards.forEach((cd, i) => {
      if (cd.act && t.cards[i] && !t.cards[i].prompt) errs.push(L.id + ' card' + (i + 1) + ': exercise prompt not translated');
    });
  });
  (tc.lessons || []).forEach(L => { if (!en.lessons.some(x => x.id === L.id)) errs.push(L.id + ': not in EN — ignored'); });
  return errs;
}

// ---- viz dictionary coverage: every EN <text> body and caption that has no entry stays English ----
function vizKeysFromPage() {
  const keys = new Set();
  const body = html.slice(html.indexOf('var VIZ={'));
  const re = /<text[^>]*>([^<>{}]+)<\/text>/g; let x;
  while ((x = re.exec(body))) { const s = x[1].trim(); if (s && !/^[\d\s.,%$x/+-]*$/i.test(s)) keys.add(s); }
  const rc = /svgWrap\([\s\S]{0,4000}?,\s*'((?:[^'\\]|\\.)*)'\s*\)/g;
  while ((x = rc.exec(body))) { const s = x[1].replace(/\\'/g, "'").trim(); if (s && /[a-z]{3}/i.test(s)) keys.add(s); }
  return keys;
}

const pageVizKeys = vizKeysFromPage();

for (const lang of LANGS) {
  const courses = [];
  const missing = [];
  for (const cid of ORDER) {
    const f = path.join(I18N, '_' + lang + '-' + cid + '.json');
    if (!fs.existsSync(f)) { missing.push(cid); continue; }
    let tc;
    try { tc = read(f); } catch (e) { console.error('  ' + lang + '/' + cid + ': INVALID JSON — ' + e.message); problems++; continue; }
    const errs = checkCourse(lang, cid, tc);
    if (errs.length) { problems++; console.error('  ' + lang + '/' + cid + ':'); errs.forEach(e => console.error('    - ' + e)); }
    courses.push(tc);
  }
  // Diagram labels come from two files: the original dictionary and any later additions. Keeping the
  // additions separate means a new batch of visuals can be translated and re-translated without
  // touching (or risking) the entries that are already live.
  let viz = {};
  for (const name of ['_' + lang + '-viz.json', '_' + lang + '-vizadd.json']) {
    const vf = path.join(I18N, name);
    if (!fs.existsSync(vf)) continue;
    const v = read(vf);
    Object.assign(viz, v.viz || v);
  }
  for (const k of Object.keys(viz)) if (!String(viz[k]).trim()) delete viz[k]; // empty = untranslated, let it fall back
  const uncovered = [...pageVizKeys].filter(k => !viz[k]);

  const out = { courses, viz };
  const dest = path.join(I18N, lang + '.json');
  const json = JSON.stringify(out);
  const changed = !fs.existsSync(dest) || fs.readFileSync(dest, 'utf8') !== json;
  if (!CHECK_ONLY && changed) fs.writeFileSync(dest, json);
  console.log(
    lang.padEnd(3) + ' ' + String(courses.length).padStart(2) + '/' + ORDER.length + ' courses · ' +
    String(Object.keys(viz).length).padStart(3) + ' viz strings' +
    (uncovered.length ? ' · ' + uncovered.length + ' viz UNTRANSLATED' : '') +
    (missing.length ? ' · no file: ' + missing.join(',') : '') +
    (CHECK_ONLY ? '' : (changed ? ' · written' : ' · unchanged'))
  );
}

console.log(problems ? '\n' + problems + ' course file(s) with shape problems — fix before deploying.' : '\nAll translation packs match the EN structure.');
process.exit(problems && CHECK_ONLY ? 1 : 0);
