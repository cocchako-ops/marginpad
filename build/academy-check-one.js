/* Validate ONE academy translation file against the EN master, precisely (2026-09-05).
   The page merges a translated lesson only when its shape matches EN exactly — same lesson ids, same number of
   cards, same number of quiz options. A mismatch is not an error anywhere: the lesson silently falls back to
   English and nobody finds out. So every retranslated file goes through this before it is allowed to ship.

   Run: node build/academy-check-one.js <lang> <chapter>
        node build/academy-check-one.js sr psychology
*/
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const I18N = path.join(DIST, 'academy', 'i18n');
const PAGE = path.join(DIST, 'academy', 'index.html');
const [lang, chap] = process.argv.slice(2);
if (!lang || !chap) { console.error('usage: node build/academy-check-one.js <lang> <chapter>'); process.exit(1); }

const html = fs.readFileSync(PAGE, 'utf8');
const EN = JSON.parse(html.match(/<script type="application\/json" id="acadData">([\s\S]*?)<\/script>/)[1]);
const ec = EN.courses.filter(c => c.id === chap)[0];
if (!ec) { console.error('no such EN course: ' + chap); process.exit(1); }
const f = path.join(I18N, '_' + lang + '-' + chap + '.json');
if (!fs.existsSync(f)) { console.error('missing file: ' + f); process.exit(1); }
let tc; try { tc = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error('INVALID JSON: ' + e.message); process.exit(1); }

const errs = [], warns = [];
if (tc.id !== ec.id) errs.push('course id is "' + tc.id + '", expected "' + ec.id + '"');
if (!tc.name) errs.push('course name missing');
if (!tc.sub) warns.push('course sub missing');
const tl = {}; (tc.lessons || []).forEach(l => { tl[l.id] = l; });
let cards = 0, quizzes = 0, strings = 0;
for (const L of ec.lessons) {
  const t = tl[L.id];
  if (!t) { errs.push(L.id + ': lesson missing — it would silently render in English'); continue; }
  if (!t.t) errs.push(L.id + ': title missing');
  const tc2 = t.cards || [];
  if (tc2.length !== L.cards.length) { errs.push(L.id + ': ' + tc2.length + ' cards, EN has ' + L.cards.length + ' — the page DROPS this lesson'); }
  else L.cards.forEach((c, i) => {
    cards++;
    if (!tc2[i] || !tc2[i].h) errs.push(L.id + ' card ' + i + ': h missing');
    if (!tc2[i] || !tc2[i].p) errs.push(L.id + ' card ' + i + ': p missing');
    if (tc2[i] && tc2[i].h === c.h && c.h.length > 14) warns.push(L.id + ' card ' + i + ': h identical to English');
    if (tc2[i] && tc2[i].p === c.p && c.p.length > 40) warns.push(L.id + ' card ' + i + ': p identical to English');
    if (tc2[i]) strings += 2;
  });
  const eq = L.quiz || [], tq = t.quiz || [];
  if (tq.length !== eq.length) { errs.push(L.id + ': ' + tq.length + ' quiz questions, EN has ' + eq.length + ' — the page DROPS this lesson'); }
  else eq.forEach((q, i) => {
    quizzes++;
    if (!tq[i] || !tq[i].q) errs.push(L.id + ' quiz ' + i + ': q missing');
    if (!tq[i] || !Array.isArray(tq[i].o) || tq[i].o.length !== q.o.length) errs.push(L.id + ' quiz ' + i + ': ' + ((tq[i] && tq[i].o) || []).length + ' options, EN has ' + q.o.length + ' — the page DROPS this lesson');
    else if (tq[i].o.some(o => !o || !String(o).trim())) errs.push(L.id + ' quiz ' + i + ': an empty option');
    if (tq[i] && tq[i].a !== undefined) warns.push(L.id + ' quiz ' + i + ': carries its own "a" — the answer index must come from EN');
    if (tq[i]) strings += 1 + (tq[i].o || []).length;
  });
}
const extra = Object.keys(tl).filter(id => !ec.lessons.some(l => l.id === id));
if (extra.length) warns.push('lessons not in EN (ignored by the page): ' + extra.join(', '));

console.log(lang + '/' + chap + ': ' + ec.lessons.length + ' lessons, ' + cards + ' cards, ' + quizzes + ' quizzes, ' + strings + ' strings');
warns.forEach(w => console.log('  warn  ' + w));
errs.forEach(e => console.log('  ERROR ' + e));
if (errs.length) { console.log('\nFAIL — ' + errs.length + ' error(s); this file would lose lessons to the English fallback.'); process.exit(1); }
console.log('OK — shape matches EN exactly.');
