/* E2E for Academy course 0 - "Start Here: MarginPad" (2026-09-20).

   The load-bearing check is the LAST one: a brand-new member who finishes the seven lessons must land
   close enough to Bronze that one paper trade crosses it, and NOT already past it. That is the whole
   design brief ("dovoljno xp-a da im posle treba da otvore trejd i malo da budu tu"), and it is the one
   property that silently breaks the moment anyone adds a lesson, changes an XP value or re-weights a
   Road to Bronze task. Falsify it by adding an eighth lesson to build/data/academy-mpstart.js: the
   "still short of Bronze" check must go red.

   It also guards the two failures that are invisible in production:
     - the worker's ACAD_COURSES not knowing a lesson id, so the lesson pays nothing and nobody notices
     - the course losing free:true, which would lock the course after the one every existing member is in

   Run: node build/academy-start-e2e.js [--local]
        --local serves dist/ from the working tree for the browser leg (pre-deploy check)
*/
const fs = require('fs');
const path = require('path');
const http = require('http');
const { withBrowser } = require('./e2e-browser.js');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const LOCAL = process.argv.includes('--local');
const BASE = 'https://marginpad.io';
const KEY = (fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9]+/) || [])[0];
if (!KEY) { console.error('academy-start-e2e: no mpadm_ token in ADMIN_KEY.local.txt'); process.exit(1); }

const COURSE = require('./data/academy-mpstart.js');
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (extra ? '  -> ' + extra : '')); } };
const jget = (u, h) => fetch(u, { headers: h || {} }).then(r => r.json());
const jpost = (u, b, h) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json', ...(h || {}) }, body: JSON.stringify(b) }).then(r => r.json());

// ---------------------------------------------------------------- static: the page and the worker agree
function staticChecks() {
  console.log('\n-- the page');
  const html = fs.readFileSync(path.join(DIST, 'academy', 'index.html'), 'utf8');
  const data = JSON.parse(html.match(/<script type="application\/json" id="acadData">([\s\S]*?)<\/script>/)[1]);
  const c0 = data.courses[0];
  ok(c0 && c0.id === COURSE.id, 'the start course is FIRST in #acadData', c0 && c0.id);
  ok(c0 && c0.free === true, 'it is free:true (outside the lock chain - a non-free course 0 locks every member out of the course after the one they are in)');
  ok(c0 && c0.lessons.length === 7, 'it has seven lessons', c0 && c0.lessons.length);
  const lessons = data.courses.reduce((n, x) => n + x.lessons.length, 0);
  ok(lessons === 147, 'the page holds 147 lessons', lessons);

  // every figure a card names must actually be defined, or the card renders blank
  let missing = [];
  c0.lessons.forEach(L => L.cards.forEach(cd => { if (cd.v && html.indexOf('VIZ.' + cd.v + '=function') < 0) missing.push(L.id + ':' + cd.v); }));
  ok(!missing.length, 'every figure the course names is defined on the page', missing.join(', '));

  // quizzes must be answerable
  let badq = [];
  c0.lessons.forEach(L => L.quiz.forEach((q, i) => { if (!(q.a >= 0 && q.a < q.o.length)) badq.push(L.id + ' q' + i); }));
  ok(!badq.length, 'every quiz answer index points at a real option', badq.join(', '));

  console.log('\n-- the counts a reader and a crawler see');
  [['hero stats', /<div class="hero-stats"><span>(\d+) lessons<\/span><i><\/i><span>(\d+) courses/],
   ['meta description', /content="[^"]*?(\d+) bite-size lessons across (\d+) courses/],
   ['progress counter', /id="pgN">0\/(\d+)</]].forEach(([what, re]) => {
    const m = html.match(re);
    ok(m && +m[1] === 147, what + ' says 147 lessons', m ? m[1] : 'no match');
    if (m && m[2]) ok(+m[2] === 17, what + ' says 17 courses', m[2]);
  });
  ok(html.indexOf('147 lessons across 17 courses') > 0, 'the crawlable syllabus block was rebuilt');

  console.log('\n-- the worker is the grader and must agree');
  const w = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
  const AC = eval('(' + w.match(/const ACAD_COURSES = (\{[\s\S]*?\});/)[1] + ')');
  ok(!!AC[COURSE.id], 'ACAD_COURSES carries the course');
  const ids = (AC[COURSE.id] || []).join(',');
  ok(ids === COURSE.lessons.map(L => L.id).join(','), 'the worker lesson ids match the page exactly', ids);
  const wTotal = Object.values(AC).reduce((n, a) => n + a.length, 0);
  ok(wTotal === lessons, 'the worker and the page hold the same lesson count', wTotal + ' vs ' + lessons);

  console.log('\n-- the Spanish twin');
  const es = fs.readFileSync(path.join(DIST, 'es', 'academy', 'index.html'), 'utf8');
  const esd = JSON.parse(es.match(/<script type="application\/json" id="acadData">([\s\S]*?)<\/script>/)[1]);
  ok(esd.courses[0] && esd.courses[0].id === COURSE.id, 'the /es/ twin carries the course too (English text until the translation round, by design)');
  return data;
}

// ---------------------------------------------------------------- live: a real member walks the course
async function liveChecks() {
  const uid = 'e2e-acad' + Date.now();
  const H = { 'x-admin-key': KEY };
  console.log('\n-- a brand-new member finishes the course (uid ' + uid + ')');
  const mk = await jpost(BASE + '/api/admin/e2euser', { uid, op: 'mk' }, H);
  if (!mk.ok) { fail++; console.log('  FAIL could not mint a test member -> ' + JSON.stringify(mk)); return; }
  const sess = await jpost(BASE + '/api/admin/e2euser', { uid, op: 'sess' }, H);
  const C = { cookie: 'mp_sess=' + sess.token + '; mp_uid=' + uid };

  try {
    const xp0 = (await jget(BASE + '/api/auth/xp?fresh=1', C)).xp || 0;
    ok(xp0 === 0, 'the test member starts at zero', xp0);

    // the daily check-in is paid by a real pageview beacon, which is keyed on mp_uid - not by reading /xp
    await fetch(BASE + '/api/track?t=pageview&p=/academy/', { headers: C });
    await new Promise(r => setTimeout(r, 1200));
    const xpIn = (await jget(BASE + '/api/auth/xp?fresh=1', C)).xp || 0;
    ok(xpIn === 22, 'showing up once pays 22 (check-in 20 + first streak day 2)', xpIn);

    let granted = 0, bonus = 0, errs = [];
    for (const L of COURSE.lessons) {
      const r = await jpost(BASE + '/api/academy', { lesson: L.id, mistakes: 1 }, { ...C });
      if (r.error) errs.push(L.id + ':' + r.error);
      else { granted += (+r.granted || 0); bonus += (+r.bonus || 0); }
    }
    ok(!errs.length, 'the worker accepted all seven lesson ids', errs.join(', '));
    ok(granted === 7 * 25, 'all seven lessons paid 25 XP each', granted);
    ok(bonus === 50, 'finishing the course paid the 50 XP course bonus', bonus);

    // the Road to Bronze ladder must see the lessons too
    const br = await jget(BASE + '/api/bronze', C);
    const byId = {}; (br.tasks || []).forEach(t => { byId[t.tid] = t; });
    ok(byId.lesson && byId.lesson.done, 'the Road to Bronze "first lesson" task is satisfied by course 0');
    ok(byId.lesson4 && byId.lesson4.done, 'the "four lessons" task is satisfied by course 0');
    for (const tid of ['lesson', 'lesson4']) {
      if (byId[tid] && byId[tid].done && !byId[tid].claimed) await jpost(BASE + '/api/bronze', { tid }, C);
    }

    const xp = +(await jget(BASE + '/api/auth/xp?fresh=1', C)).xp || 0;
    // A real member also carries the one-time username grant, which a seeded test account never gets
    // (e2euser writes the username straight into the row). Read it from the worker rather than assume it.
    const w = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
    const UNAME = +((w.match(/'username',\s*(\d+),\s*\{\s*once:\s*true/) || [])[1] || 0);
    ok(UNAME === 50, 'setting a username is worth 50 XP (read from the worker, not assumed)', UNAME);
    const real = xp + UNAME;
    console.log('  .... measured: test member ' + xp + ' XP; a real member with a username ' + real + ' of 500');

    ok(xp < 500 && real < 500, 'STILL SHORT OF BRONZE after the course - the trade is what crosses it (the design brief)', real);
    ok(real >= 400, 'but the course does the bulk of the work', real);
    // first paper trade = Road-to-Bronze task 40 + the trade itself 3; then any ONE of: a stop (40),
    // a green close (50+15) or simply coming back tomorrow (75+20+4).
    const need = 500 - real;
    ok(need <= 83, 'one trade plus one more action crosses Bronze', need + ' XP left, and a trade with a stop pays 83');
    ok(need > 43, 'and a bare trade alone does NOT - there is still a reason to come back', need + ' XP left vs 43 for a trade on its own');
  } finally {
    await jpost(BASE + '/api/admin/e2euser', { uid, op: 'rm' }, H).catch(() => {});
    console.log('  .... test member removed');
  }
}

// ---------------------------------------------------------------- browser: it renders and is reachable
async function browserChecks() {
  let srv = null, base = BASE;
  if (LOCAL) {
    const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
    srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(DIST, p);
      if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    await new Promise(r => srv.listen(8794, r));
    base = 'http://localhost:8794';
  }
  console.log('\n-- in a browser at 390px (' + base + ')');
  await withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    await page.goto(base + '/academy/?nc=1&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 50000 });
    await new Promise(r => setTimeout(r, 2200));
    const v = await page.evaluate((cid) => {
      const sec = document.querySelector('section.course[data-cid="' + cid + '"]');
      const all = [...document.querySelectorAll('section.course')];
      const first = all[0];
      const nodes = sec ? [...sec.querySelectorAll('button.node')] : [];
      const r = sec ? sec.getBoundingClientRect() : null;
      // REACHABILITY, not existence: is the first lesson button actually the thing at its own centre?
      const b0 = nodes[0];
      let hit = false;
      if (b0) { const br = b0.getBoundingClientRect(); const el = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2); hit = !!(el && (el === b0 || b0.contains(el))); }
      return {
        present: !!sec, isFirst: !!(first && first.getAttribute('data-cid') === cid),
        open: !!(sec && sec.classList.contains('open')), locked: !!(sec && sec.classList.contains('lockedc')),
        nodes: nodes.length, firstEnabled: !!(b0 && !b0.disabled), hit,
        top: r ? Math.round(r.top + window.scrollY) : -1,
        hero: (document.querySelector('.hero-stats') || {}).innerText || '',
        wide: [...document.querySelectorAll('*')].filter(e => { const x = e.getBoundingClientRect(); if (x.width < 2) return false; let n = e.parentElement; while (n) { const s = getComputedStyle(n); if (s.overflowX !== 'visible' || s.overflow !== 'visible') return false; n = n.parentElement; } return x.right > 391 || x.left < -1; }).length
      };
    }, COURSE.id);
    ok(v.present, 'the course renders');
    ok(v.isFirst, 'it is the first course on the page');
    ok(!v.locked, 'it is not locked for a fresh visitor');
    ok(v.open, 'it opens expanded (it is the current course for a newcomer)');
    ok(v.nodes === 7, 'seven lesson buttons', v.nodes);
    ok(v.firstEnabled, 'lesson 1 is clickable with no account');
    ok(v.hit, 'lesson 1 is REACHABLE - it is the element at its own centre, nothing covers it');
    ok(v.top < 844 * 1.2, 'the course starts within about one screen of the top on a phone', v.top + 'px');
    ok(/147 LESSONS/i.test(v.hero) && /17 COURSES/i.test(v.hero), 'the hero counts are right', v.hero.replace(/\n/g, ' '));
    ok(v.wide === 0, 'nothing overflows a 390px screen', v.wide + ' element(s)');
    ok(errs.length === 0, 'no page errors', errs.join(' | '));
    const shotDir = path.join(ROOT, 'build', 'academy-shots'); if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });
    await page.screenshot({ path: path.join(shotDir, 'start-course.png') });
    await page.close();
  });
  if (srv) srv.close();
}

(async () => {
  console.log('academy-start-e2e' + (LOCAL ? ' (--local)' : ''));
  staticChecks();
  if (!LOCAL) await liveChecks();
  else console.log('\n-- skipping the live member walk (--local grades the working tree, not production)');
  await browserChecks();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;   // never process.exit() mid-teardown: it aborts inside libuv and the shell sees 127 on a green run
})();
