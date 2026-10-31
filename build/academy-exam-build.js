/* Final exams: bank (drafts/academy-exams/<course>.json, gitignored) -> public packs + private answer key.
   Writes dist/academy/i18n/exam-<lang>.json ({q:{qid:{q,o}}}, never an answer) and, with --key, posts {qid:[answer,lesson]} to KV through /api/admin/academy.
   A translation in drafts/academy-exams/i18n/<lang>-<course>.json is [{id,q,o[4]}]; option ORDER must match English, the page sends the English index.
   Run: node build/academy-exam-build.js [--key] */
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), B = path.join(R, 'drafts/academy-exams'), OUT = path.join(R, 'dist/academy/i18n');
const LANGS = ['sr', 'es', 'de', 'fr', 'pt', 'nl', 'ru', 'tr', 'id', 'zh', 'ja', 'ko', 'ar', 'hi'];
const html = fs.readFileSync(path.join(R, 'dist/academy/index.html'), 'utf8');
const D = JSON.parse(html.match(/id="acadData">([\s\S]*?)<\/script>/)[1]);
const en = {}, key = {};
for (const c of D.courses) for (const x of JSON.parse(fs.readFileSync(path.join(B, c.id + '.json'), 'utf8'))) { en[x.id] = { q: x.q, o: x.o }; key[x.id] = [x.a, x.l]; }
fs.writeFileSync(path.join(OUT, 'exam-en.json'), JSON.stringify({ q: en }));
let problems = 0;
const nums = (s) => (String(s).match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/[.,\s]/g, '')).sort().join(' ');
for (const l of LANGS) {
  const q = {}; let miss = 0;
  for (const c of D.courses) {
    const f = path.join(B, 'i18n', l + '-' + c.id + '.json');
    if (!fs.existsSync(f)) continue;
    for (const x of JSON.parse(fs.readFileSync(f, 'utf8'))) {
      const e = en[x.id];
      if (!e) { console.log(l, x.id, 'unknown id'); problems++; continue; }
      if (!x.q || !Array.isArray(x.o) || x.o.length !== 4 || x.o.some((o) => !o)) { console.log(l, x.id, 'bad shape'); problems++; continue; }
      if (nums(x.q) !== nums(e.q)) { console.log(l, x.id, 'numbers differ in q:', nums(e.q), '|', nums(x.q)); problems++; }
      x.o.forEach((o, i) => { if (nums(o) !== nums(e.o[i])) { console.log(l, x.id, 'numbers differ in option', i, ':', nums(e.o[i]), '|', nums(o)); problems++; } });
      q[x.id] = { q: x.q, o: x.o };
    }
  }
  for (const id of Object.keys(en)) if (!q[id]) { q[id] = en[id]; miss++; }
  fs.writeFileSync(path.join(OUT, 'exam-' + l + '.json'), JSON.stringify({ q }));
  console.log(l, Object.keys(q).length, 'questions', miss ? miss + ' in English' : 'all translated');
}
console.log('bank', Object.keys(en).length, 'problems', problems);
if (process.argv.includes('--key')) {
  const K = fs.readFileSync(path.join(R, 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/)[0];
  fetch('https://marginpad.io/api/admin/academy', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': K }, body: JSON.stringify({ key }) }).then((r) => r.text()).then(console.log);
}
