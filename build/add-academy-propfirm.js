/* Adds the "Passing a Prop Firm Challenge" course (build/data/academy-propfirm.js) to the Academy: the #acadData list in
   dist/academy/index.html, ACAD_COURSES in the worker, and every printed course/lesson count. Idempotent: a second run replaces the
   course with the current data file and leaves the counts alone. Then run gen-academy-syllabus, gen-academy-i18n and academy-exam-build --key. */
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const C = require('./data/academy-propfirm.js');
const PAGE = path.join(R, 'dist/academy/index.html'), W = path.join(R, 'src/worker.js');
let h = fs.readFileSync(PAGE, 'utf8');
const re = /(<script type="application\/json" id="acadData">)([\s\S]*?)(<\/script>)/;
const m = h.match(re); if (!m) throw new Error('acadData not found');
const D = JSON.parse(m[2]);
const before = { courses: D.courses.length, lessons: D.courses.reduce((t, c) => t + c.lessons.length, 0) };
const at = D.courses.findIndex(c => c.id === C.id);
if (at >= 0) D.courses[at] = C; else D.courses.push(C);
// validate the shape the page expects
for (const l of C.lessons) {
  if (!l.id || !l.t || !Array.isArray(l.cards) || l.cards.length < 3) throw new Error('bad lesson ' + l.id);
  for (const q of l.quiz) if (q.o.length !== 4 || !(q.a >= 0 && q.a < 4)) throw new Error('bad quiz ' + l.id);
}
const after = { courses: D.courses.length, lessons: D.courses.reduce((t, c) => t + c.lessons.length, 0) };
const json = JSON.stringify(D).replace(/<\//g, '<\\/');
h = h.replace(re, (all, a, b, c) => a + json + c);
if (at < 0) {
  const swaps = [[before.lessons + ' bite-size lessons across ' + before.courses + ' courses', after.lessons + ' bite-size lessons across ' + after.courses + ' courses'],
    [before.lessons + ' lessons across', after.lessons + ' lessons across'], ['all ' + before.lessons + ' lessons', 'all ' + after.lessons + ' lessons'],
    ['<span>' + before.lessons + ' lessons</span>', '<span>' + after.lessons + ' lessons</span>'], ['<span>' + before.courses + ' courses</span>', '<span>' + after.courses + ' courses</span>'],
    [before.lessons + ' lessons across ' + before.courses + ' courses', after.lessons + ' lessons across ' + after.courses + ' courses']];
  for (const [a, b] of swaps) h = h.split(a).join(b);
}
fs.writeFileSync(PAGE, h);
let w = fs.readFileSync(W, 'utf8');
if (!w.includes("propfirm: ['pf1'")) {
  const a = "mastery: ['mm1','mm2','mm3','mm4','mm5','mm6','mm7','mm8'] };";
  if (w.split(a).length !== 2) throw new Error('ACAD_COURSES anchor');
  w = w.split(a).join("mastery: ['mm1','mm2','mm3','mm4','mm5','mm6','mm7','mm8'], propfirm: [" + C.lessons.map(l => "'" + l.id + "'").join(',') + "] };");
  w = w.split('(17 courses, 147 lessons;').join('(18 courses, ' + after.lessons + " lessons; 'propfirm' added 2026-11-16, free:true;");
  fs.writeFileSync(W, w);
}
for (const f of ['dist/llms.txt', 'dist/llms-full.txt']) {
  const p = path.join(R, f); if (!fs.existsSync(p)) continue; let s = fs.readFileSync(p, 'utf8');
  s = s.split(before.courses + ' courses, ' + before.lessons + ' lessons').join(after.courses + ' courses, ' + after.lessons + ' lessons');
  fs.writeFileSync(p, s);
}
console.log('courses', before.courses, '->', after.courses, 'lessons', before.lessons, '->', after.lessons);
