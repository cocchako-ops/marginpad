/* Validate an Academy final-exam bank (drafts/academy-exams/<course>.json, gitignored: it carries the answers, and this repo is public).
   Shape, option bias, and a copy check against the lesson quizzes. Run: node build/academy-exam-check.js [course ...] */
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), BANK = path.join(R, 'drafts/academy-exams');
const html = fs.readFileSync(path.join(R, 'dist/academy/index.html'), 'utf8');
const D = JSON.parse(html.match(/id="acadData">([\s\S]*?)<\/script>/)[1]);
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const want = process.argv.slice(2).length ? process.argv.slice(2) : D.courses.map((c) => c.id);
let bad = 0;
for (const cid of want) {
  const c = D.courses.find((x) => x.id === cid), errs = [];
  if (!c) { console.log(cid, 'NOT A COURSE'); bad++; continue; }
  const f = path.join(BANK, cid + '.json');
  if (!fs.existsSync(f)) { console.log(cid, 'missing'); bad++; continue; }
  let q; try { q = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(cid, 'BAD JSON', e.message); bad++; continue; }
  if (!Array.isArray(q) || q.length !== 15) errs.push('needs 15 questions, has ' + (q.length || 0));
  const lessons = new Set(c.lessons.map((l) => l.id)), seen = new Set(), pos = [0, 0, 0, 0];
  const quiz = new Set(); c.lessons.forEach((l) => l.quiz.forEach((x) => quiz.add(norm(x.q))));
  let longest = 0;
  (q || []).forEach((x, i) => {
    const tag = x.id || ('#' + i);
    if (x.id !== cid + '-' + String(i + 1).padStart(2, '0')) errs.push(tag + ': id should be ' + cid + '-' + String(i + 1).padStart(2, '0'));
    if (!lessons.has(x.l)) errs.push(tag + ': lesson "' + x.l + '" is not in this course');
    if (!x.q || !Array.isArray(x.o) || x.o.length !== 4) { errs.push(tag + ': needs q and 4 options'); return; }
    if (!(x.a >= 0 && x.a <= 3) || x.a !== Math.floor(x.a)) { errs.push(tag + ': bad answer index'); return; }
    pos[x.a]++;
    if (x.q.split(/\s+/).length > 60) errs.push(tag + ': question over 60 words');
    x.o.forEach((o, j) => { if (o.split(/\s+/).length > 22) errs.push(tag + ' option ' + j + ': over 22 words'); });
    if (new Set(x.o.map(norm)).size !== 4) errs.push(tag + ': duplicate options');
    if (quiz.has(norm(x.q))) errs.push(tag + ': copied from a lesson quiz');
    if (seen.has(norm(x.q))) errs.push(tag + ': duplicate question'); seen.add(norm(x.q));
    const all = [x.q].concat(x.o).join(' ');
    if (EMOJI.test(all) || /—|–/.test(all)) errs.push(tag + ': emoji or long dash');
    if (/all of the above|none of the above/i.test(all)) errs.push(tag + ': "of the above" option');
    if (x.o[x.a].length >= Math.max.apply(null, x.o.map((o) => o.length))) longest++;
  });
  if (longest > 6) errs.push('the correct option is the longest in ' + longest + ' of 15 (max 6)');
  if (Math.max.apply(null, pos) > 5 || Math.min.apply(null, pos) < 2) errs.push('answer positions skewed: ' + pos.join('/'));
  console.log(cid, errs.length ? 'FAIL ' + errs.length : 'ok', 'pos ' + pos.join('/'), 'longest ' + longest);
  errs.slice(0, 12).forEach((e) => console.log('   ' + e)); if (errs.length) bad++;
}
process.exit(bad ? 1 : 0);
