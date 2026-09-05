/* Academy mastery E2E (2026-09-06). A finished lesson now carries how many hearts the run cost (0-2). First
   completion pays 25 XP as before. A retake pays only when it BEATS the best run, and then 5 XP (a fifth) -- the
   owner's "znatno manje". A perfect run (0 mistakes) pays that 5 the first time it happens. A course where every
   lesson has a perfect run is MASTERED: +50 XP once, a badge on the course card, and a public shareable
   certificate at /academy/?cert=<course>&u=<name>.

   Server, on production with a throwaway member (admin ?uid= hook + /api/admin/e2euser, scrubbed at the end):
     lesson with 2 mistakes -> fresh, 25 XP, best 2
     retake with 1         -> improved, 5 XP, best 1
     retake with 1 again   -> nothing (not better)
     retake with 0         -> improved, 5 XP, best 0
     every lesson of the first course at 0 -> mastered, +50 XP, state lists it, public cert answers ok
   Browser: the certificate page renders for that member; a stranger's cert URL renders nothing.

   Run: node build/academy-mastery-e2e.js
*/
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const UID = 'e2eam' + Date.now().toString(36).slice(-5);
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 200) : ''));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const post = async (u, b) => { const r = await fetch(ORIGIN + u, { method: 'POST', headers: H, body: JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const get = async (u) => { const r = await fetch(ORIGIN + u, { headers: H }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const done = (lesson, mistakes) => post('/api/academy?uid=' + UID, { lesson, mistakes });

(async () => {
  const mk = await post('/api/admin/e2euser', { uid: UID, op: 'mk' });
  chk('throwaway member minted', mk.body && mk.body.ok, mk.body);
  const NAME = mk.body.username;
  // the course map from the live page: first course + its lesson ids (EN master, #acadData)
  const html = await fetch(ORIGIN + '/academy/?cb=' + Date.now()).then(r => r.text());
  const data = JSON.parse((html.match(/<script type="application\/json" id="acadData">([\s\S]*?)<\/script>/) || [])[1] || '{}');
  const course = (data.courses || [])[0]; const ids = course ? course.lessons.map(l => l.id) : [];
  chk('first course + lesson ids read from the page', !!course && ids.length >= 3, { course: course && course.id, n: ids.length });
  const L = ids[0];

  const a = await done(L, 2);
  chk('first completion with 2 mistakes: fresh, 25 XP, best 2', a.body.ok && a.body.fresh && a.body.granted === 25 && a.body.best === 2 && !a.body.improved, a.body);
  const b = await done(L, 1);
  chk('retake with 1: improved, +5 XP, best 1', b.body.ok && !b.body.fresh && b.body.improved && b.body.up === 5 && b.body.best === 1, b.body);
  const c = await done(L, 1);
  chk('retake with 1 again: nothing paid, best stays 1', c.body.ok && !c.body.improved && !c.body.up && c.body.best === 1, c.body);
  const d = await done(L, 0);
  chk('retake with 0: perfect run, +5 XP, best 0', d.body.ok && d.body.improved && d.body.up === 5 && d.body.best === 0, d.body);
  const e = await done(L, 0);
  chk('a second perfect run pays nothing', e.body.ok && !e.body.improved && !e.body.up, e.body);

  let mastered = null, lastBonus = 0;
  for (let i = 1; i < ids.length; i++) { const r = await done(ids[i], 0); if (r.body.mastered) { mastered = r.body.mastered; lastBonus = r.body.masterBonus; } }
  chk('every lesson perfect -> course mastered, +50 XP once', mastered === course.id && lastBonus === 50, { mastered, lastBonus });
  const again = await done(ids[1], 0);
  chk('mastery does not fire twice', !again.body.mastered && !again.body.masterBonus, again.body);

  const st = await get('/api/academy?uid=' + UID);
  chk('state carries best per lesson and the mastered course', st.body.best && st.body.best[L] === 0 && (st.body.mastered || []).indexOf(course.id) >= 0, { best: st.body.best && st.body.best[L], mastered: st.body.mastered });
  const cert = await fetch(ORIGIN + '/api/academy/cert?u=' + NAME + '&c=' + course.id).then(r => r.json());
  chk('public certificate answers ok for the mastered course', cert.ok && cert.name === NAME && cert.course === course.id && cert.ts > 0, cert);
  const nocert = await fetch(ORIGIN + '/api/academy/cert?u=' + NAME + '&c=nope').then(r => r.json());
  chk('no certificate for a course that is not mastered', nocert.ok === false);

  // XP arithmetic the owner asked for: retake pays a fifth of a first completion
  chk('retake XP is a fifth of first-completion XP (5 vs 25)', b.body.up * 5 === a.body.granted);

  let view = null, stranger = null;
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: 1200, height: 900 });
    await page.goto(ORIGIN + '/academy/?cert=' + course.id + '&u=' + NAME + '&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction("document.getElementById('certHost') && !document.getElementById('certHost').hidden", { timeout: 15000 }).catch(() => {});
    view = await page.evaluate(() => { const h = document.getElementById('certHost'); if (!h || h.hidden) return { shown: false }; const r = h.getBoundingClientRect(); h.scrollIntoView({ block: 'center' }); const c = h.querySelector('.cert'), cr = c.getBoundingClientRect(); const hit = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2); return { shown: true, text: h.textContent.replace(/\s+/g, ' ').trim().slice(0, 160), w: Math.round(r.width), reach: !!(hit && c.contains(hit)), scrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; });
    await page.screenshot({ path: path.join(__dirname, 'vault-shots', 'academy-cert.png') });
    await page.goto(ORIGIN + '/academy/?cert=' + course.id + '&u=nobody_' + Date.now().toString(36) + '&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise(r => setTimeout(r, 2500));
    stranger = await page.evaluate(() => { const h = document.getElementById('certHost'); return !!h && h.hidden; });
    await ctx.close();
  });
  chk('certificate page renders the mastered course for that member', view && view.shown && view.text.indexOf(course.name) >= 0 && view.text.indexOf('@' + NAME) >= 0 && view.reach && !view.scrollsX, view);
  chk('a name without the mastery shows no certificate', stranger === true);

  await post('/api/admin/e2euser', { uid: UID, op: 'rm' });
  const gone = await fetch(ORIGIN + '/api/academy/cert?u=' + NAME + '&c=' + course.id).then(r => r.json());
  chk('cleanup: member removed, certificate gone', gone.ok === false);

  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed  (uid ' + UID + ')');
  process.exit(bad ? 1 : 0);
})();
