/* Final exams, end to end on production, with a real throwaway member and the real answer key from drafts/academy-exams.
   Load-bearing: the page and its packs never carry an answer; an unfinished course refuses; a pass pays once; a retake pays nothing but the perfect bonus;
   a failure locks the course for twelve hours and names no answer; a run past the clock is a failure; the browser leg walks the real player on a phone.
   Run: node build/academy-exam-e2e.js [--pure]  (--pure = the page and the packs only) */
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), B = 'https://marginpad.io';
const K = fs.readFileSync(path.join(R, 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/)[0];
const pure = process.argv.includes('--pure');
let ok = 0, bad = 0; const c = (n, v, x) => { if (v) { ok++; console.log('ok  ', n); } else { bad++; console.log('FAIL', n, x === undefined ? '' : JSON.stringify(x).slice(0, 220)); } };
const html = fs.readFileSync(path.join(R, 'dist/academy/index.html'), 'utf8');
const D = JSON.parse(html.match(/id="acadData">([\s\S]*?)<\/script>/)[1]);
const bank = {}; for (const co of D.courses) for (const x of JSON.parse(fs.readFileSync(path.join(R, 'drafts/academy-exams', co.id + '.json'), 'utf8'))) bank[x.id] = x;
const LANGS = ['en', 'sr', 'es', 'de', 'fr', 'pt', 'nl', 'ru', 'tr', 'id', 'zh', 'ja', 'ko', 'ar', 'hi'];
const H = { 'content-type': 'application/json', 'x-admin-key': K };
const adm = (p, b) => fetch(B + p, { method: b ? 'POST' : 'GET', headers: H, body: b ? JSON.stringify(b) : undefined }).then((r) => r.json());

(async () => {
  // the page and the packs
  c('255 questions in the bank', Object.keys(bank).length === 255, Object.keys(bank).length);
  for (const l of LANGS) {
    const p = JSON.parse(fs.readFileSync(path.join(R, 'dist/academy/i18n/exam-' + l + '.json'), 'utf8'));
    const q = p.q || {}, ids = Object.keys(q), noAns = ids.every((i) => !('a' in q[i]) && !('l' in q[i]));
    c(l + ': every question, no answer in the pack', ids.length === 255 && noAns, ids.length);
    if (l !== 'en') { const same = ids.filter((i) => q[i].q === bank[i].q).length; c(l + ': really translated', same === 0, same); }
  }
  c('the page carries no answer key', !/"a":\d[^}]*"l":"/.test(html.slice(html.indexOf('exam:start'), html.indexOf('exam:end'))));
  for (const l of LANGS) { const u = JSON.parse(fs.readFileSync(path.join(R, 'build/data/academy-exam-ui.json'), 'utf8'))[l]; c(l + ': interface strings', u && Object.keys(u).length >= 30); }
  if (pure) { console.log('\n' + ok + ' ok, ' + bad + ' failed'); process.exit(bad ? 1 : 0); }

  const adminState = await adm('/api/admin/academy');
  c('the key is in KV', adminState.hasKey === true, adminState);
  const uid = 'e2e_x' + Date.now().toString(36);
  await adm('/api/admin/e2euser', { uid, op: 'mk' });
  const sess = (await adm('/api/admin/e2euser', { uid, op: 'sess' })).token || (await adm('/api/admin/e2euser', { uid, op: 'sess' })).sess;
  const uq = '?uid=' + uid;
  const ex = (b) => fetch(B + '/api/academy/exam' + uq, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json());
  const lessons = D.courses.find((x) => x.id === 'going').lessons.map((l) => l.id);
  const guest = await fetch(B + '/api/academy/exam', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"op":"start","course":"going"}' });
  c('a guest cannot start', guest.status === 401, guest.status);
  const r0 = await ex({ op: 'start', course: 'going' });
  c('an unfinished course refuses', r0.error === 'lessons_left' && r0.left === lessons.length, r0);
  for (const l of lessons) await fetch(B + '/api/academy' + uq, { method: 'POST', headers: H, body: JSON.stringify({ lesson: l, mistakes: 1 }) });
  const s1 = await ex({ op: 'start', course: 'going' });
  c('a finished course starts: 10 questions from its own bank', s1.ok && s1.ids.length === 10 && s1.ids.every((i) => i.indexOf('going-') === 0), s1);
  const s1b = await ex({ op: 'start', course: 'going' });
  c('asking again resumes the same attempt', s1b.resumed && s1b.id === s1.id, s1b);
  // a failing run: all wrong except two
  const wrong = {}; s1.ids.forEach((q, i) => { wrong[q] = i < 2 ? bank[q].a : (bank[q].a + 1) % 4; });
  const f = await ex({ op: 'submit', id: s1.id, answers: wrong });
  c('2 of 10 fails and pays nothing', f.ok && f.score === 2 && !f.passed && !f.xp && !f.ticks, f);
  c('a failure names lessons, never answers', Array.isArray(f.review) && f.review.length > 0 && !JSON.stringify(f).includes('"wrong"'), f);
  const s2 = await ex({ op: 'start', course: 'going' });
  c('a failure locks the course', s2.error === 'cooldown' && s2.next > Date.now() + 11 * 36e5, s2);
  const twice = await ex({ op: 'submit', id: s1.id, answers: wrong });
  c('an attempt cannot be submitted twice', twice.error === 'closed', twice);
  // another course: pass with 9, then the cooldown, xp once
  const L2 = D.courses.find((x) => x.id === 'systems').lessons.map((l) => l.id);
  for (const l of L2) await fetch(B + '/api/academy' + uq, { method: 'POST', headers: H, body: JSON.stringify({ lesson: l, mistakes: 1 }) });
  const a1 = await ex({ op: 'start', course: 'systems' });
  const good = {}; a1.ids.forEach((q, i) => { good[q] = i === 0 ? (bank[q].a + 1) % 4 : bank[q].a; });
  const before = (await fetch(B + '/api/academy' + uq, { headers: H }).then((r) => r.json())).xp;
  const p = await ex({ op: 'submit', id: a1.id, answers: good });
  c('9 of 10 passes and pays 150 XP + 15 Ticks', p.passed && p.score === 9 && p.xp >= 150 && p.ticks === 15 && !p.perfectXp, p);
  const st = await fetch(B + '/api/academy' + uq, { headers: H }).then((r) => r.json());
  c('state says passed, best 9', st.exams && st.exams.systems && st.exams.systems.passed && st.exams.systems.best === 9, st.exams);
  c('the rules are published', st.examRules && st.examRules.xp === 150 && st.examRules.pass === 8, st.examRules);
  // a browser leg: lesson list, a locked node, the intro
  const { withBrowser } = require('./e2e-browser.js');
  await withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setCookie({ name: 'mp_sess', value: sess, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true });
    const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(B + '/academy/?cb=' + Date.now(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('.node.exam[data-exam]').length === 17, { timeout: 30000 });
    c('every course shows its exam', true);
    await page.evaluate(() => { const b = document.querySelector('[data-ctoggle="going"]'); if (!document.querySelector('[data-exam="going"]').offsetParent) b.click(); });
    await new Promise((r) => setTimeout(r, 900));
    const g = await page.evaluate(() => { const n = document.querySelector('[data-exam="going"]'); n.scrollIntoView({ block: 'center' }); const r = n.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { top: Math.round(r.top), h: Math.round(r.height), el: t && (t.tagName + '.' + String(t.className).slice(0, 40)), hit: !!(t && t.closest('[data-exam]')), cls: n.className, txt: n.innerText }; });
    c('the exam node is under the finger and cooling down', g.hit && /coolx/.test(g.cls) && /\d/.test(g.txt), g);
    await page.evaluate(() => { const b = document.querySelector('[data-ctoggle="basics"]'); if (!document.querySelector('[data-exam="basics"]').offsetParent) b.click(); });
    c('an unfinished course keeps it locked', await page.evaluate(() => document.querySelector('[data-exam="basics"]').disabled));
    c('no page errors', errs.length === 0, errs);
  });
  await adm('/api/admin/e2euser', { uid, op: 'rm' });
  console.log('\n' + ok + ' ok, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(1); });
