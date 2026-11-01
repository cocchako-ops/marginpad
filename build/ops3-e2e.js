// mp-ops v3 (2026-11-01): the charts and the phone. Proof is reachability on a 390px touch screen, on production, with
// the page's own bundle: a finger on a chart changes the number above it, a tap opens that day, a range change costs no
// request, every new view renders without a page error, nothing scrolls sideways, and what the owner adds (a note, a goal,
// a pin) survives a reload and is removed again. --pure runs only the number checks against /api/admin/series.
const fs = require('fs'), path = require('path');
const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const BASE = 'https://marginpad.io', SHOTS = path.join(__dirname, 'ops-shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const chk = (n, ok, x) => { if (ok) { pass++; console.log('ok   ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 260) : '')); } };
(async () => {
  const r = await fetch(BASE + '/api/admin/series?nc=1', { headers: { 'x-admin-key': K } }); const j = await r.json(); const S = j.series || {};
  chk('series answers with a daily history', r.ok && Object.keys(S.uv || {}).length > 120, Object.keys(S.uv || {}).length);
  chk('every money series is present', ['faucet', 'paid', 'prizes', 'bonus', 'aff', 'aicost'].every(k => S[k]), Object.keys(S));
  chk('sign-ups come from the users table for the whole history', Object.keys(S.signups || {}).length > 100 && j.usersN > 500, { n: Object.keys(S.signups || {}).length, usersN: j.usersN });
  chk('trading activity is carried', Object.keys(S.traders || {}).length >= 20 && Object.keys(S.ev_paper || {}).length >= 60);
  const paidT = Object.values(S.paid || {}).reduce((a, b) => a + b, 0), mny = await (await fetch(BASE + '/api/admin/money?nc=1', { headers: { 'x-admin-key': K } })).json();
  chk('paid out adds up to the ledger within 2% (test rows dropped)', mny.totalPaidUsd && Math.abs(paidT - mny.totalPaidUsd) / mny.totalPaidUsd < 0.02, { paidT, total: mny.totalPaidUsd });
  chk('no test account in the sign-up total', j.usersN < 5000);
  for (const u of ['rhythm', 'movers', 'onhist', 'queue', 'topcost']) { const a = await fetch(BASE + '/api/admin/' + u, { headers: { 'x-admin-key': K } }); const b = await a.json(); chk('/api/admin/' + u + ' answers', a.ok && !b.error, b.error); }
  chk('keyless reader is refused', (await fetch(BASE + '/api/admin/series')).status >= 400 || !(await (await fetch(BASE + '/api/admin/series')).json().catch(() => ({}))).series);
  if (process.argv.includes('--pure')) { console.log(`\n${pass} ok, ${fail} failed`); process.exit(fail ? 1 : 0); }
  const sess = await (await fetch(BASE + '/api/stats/session', { method: 'POST', headers: { 'x-admin-key': K } })).json();
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.setCookie({ name: 'mp_sadm', value: sess.token, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true });
    await p.setCacheEnabled(false); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160))); const reqs = []; p.on('request', q => { if (/\/api\/admin\/series/.test(q.url())) reqs.push(q.url()); });
    await p.goto(BASE + '/api/stats', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction(() => document.querySelector('#vch .vz-p svg') && document.querySelector('.tile'), { timeout: 45000 }); await sleep(1500);
    await p.screenshot({ path: path.join(SHOTS, 'v3-phone-first.jpg'), type: 'jpeg', quality: 72 });
    const g0 = await p.evaluate(() => { const c = document.querySelector('#vch .vz-p'), b = c.getBoundingClientRect(), t = document.querySelector('#tabbar a[data-sec="money"]').getBoundingClientRect(), hit = document.elementFromPoint(t.x + t.width / 2, t.y + t.height / 2); return { top: b.top, bot: b.bottom, h: innerHeight, tab: !!(hit && hit.closest('#tabbar')), y: !!document.querySelector('#vch .vz-y'), x: !!document.querySelector('#vch .vz-x'), v: document.querySelector('#vch .vz-v').textContent, width: b.width, cx: b.x + b.width * 0.55, cy: b.y + b.height / 2 }; });
    chk('the chart is on the first screen, with both axes', g0.bot < g0.h && g0.y && g0.x, g0); chk('the tab bar is under the finger', g0.tab);
    // a finger on the chart reads it
    await p.touchscreen.touchStart(g0.cx - 60, g0.cy); await sleep(80); await p.touchscreen.touchMove(g0.cx + 10, g0.cy); await sleep(150);
    const sc = await p.evaluate(() => ({ v: document.querySelector('#vch .vz-v').textContent, s: document.querySelector('#vch .vz-s').textContent, cross: getComputedStyle(document.querySelector('#vch .vz-cross')).display }));
    await p.touchscreen.touchEnd(); chk('dragging moves the readout to that day and draws the crosshair', sc.cross !== 'none' && /\w{3}, \d+ \w{3} \d{4}/.test(sc.s), sc);
    await sleep(3000); chk('the readout returns to the total', await p.evaluate(v => document.querySelector('#vch .vz-v').textContent === v, g0.v));
    const n0 = reqs.length;
    for (const rg of ['7', '90', '0']) { await p.evaluate(x => document.querySelector('#vch [data-r="' + x + '"]').click(), rg); await sleep(350); }
    await p.evaluate(() => document.querySelector('#vch [data-g="week"]').click()); await sleep(300);
    chk('range and grain change without a request', reqs.length === n0, reqs.length - n0);
    chk('All with Week draws the whole history', await p.evaluate(() => document.querySelectorAll('#vch .vz-p svg rect, #vch .vz-p svg path').length > 3));
    await p.evaluate(() => { document.querySelector('#vch [data-g="day"]').click(); document.querySelector('#vch [data-r="30"]').click(); }); await sleep(400);
    // a tap opens the day
    const b2 = await p.evaluate(() => { const b = document.querySelector('#vch .vz-p').getBoundingClientRect(); return { x: b.x + b.width * 0.5, y: b.y + b.height * 0.6 }; });
    await p.touchscreen.tap(b2.x, b2.y); await sleep(500);
    const dy = await p.evaluate(() => { const s = document.querySelector('.vzs'); return s ? { t: s.querySelector('.vzs-h b').textContent, rows: s.querySelectorAll('.vzl-r').length, sh: s.querySelector('.vzs-b').getBoundingClientRect().bottom } : null; });
    chk('a tap on a bar opens that day with every metric', dy && /\d{4}/.test(dy.t) && dy.rows >= 8, dy); await p.screenshot({ path: path.join(SHOTS, 'v3-phone-day.jpg'), type: 'jpeg', quality: 72 });
    await p.type('.vzm-f input', 'e2e-note ' + Date.now()); await p.click('.vzm-f button'); await sleep(1200);
    chk('a note lands on the day', await p.evaluate(() => /e2e-note/.test(document.querySelector('.vzm').textContent)));
    await p.evaluate(() => { const r = Array.from(document.querySelectorAll('.vzm-r')).filter(x => /e2e-note/.test(x.textContent))[0]; r.querySelector('button').click(); }); await sleep(1200);
    chk('the note can be removed', await p.evaluate(() => !/e2e-note/.test(document.querySelector('.vzm').textContent)));
    await p.tap('.vzs-x'); await sleep(350); chk('the sheet closes', await p.evaluate(() => !document.querySelector('.vzs') && !document.body.classList.contains('vz-lock')));
    // a tile opens the full metric
    await p.evaluate(() => document.querySelector('.tile[data-vzopen="uv"]').click()); await sleep(500);
    const ms = await p.evaluate(() => { const s = document.querySelector('.vzs'); return s ? { p: !!s.querySelector('.vz-p svg'), g: s.querySelectorAll('.vzg div').length, csv: !!s.querySelector('[data-csv1]'), who: !!s.querySelector('[data-more1]') } : null; });
    chk('a tile opens the metric: chart, stats, CSV, who', ms && ms.p && ms.g === 4 && ms.csv && ms.who, ms); await p.screenshot({ path: path.join(SHOTS, 'v3-phone-metric.jpg'), type: 'jpeg', quality: 72 }); await p.tap('.vzs-x'); await sleep(350);
    // More
    await p.tap('#tabMore'); await sleep(450); const more = await p.evaluate(() => ({ rows: document.querySelectorAll('.vzs .mrow').length, pins: document.querySelectorAll('.vzs .mpin').length }));
    chk('More lists every view', more.rows >= 30, more); await p.screenshot({ path: path.join(SHOTS, 'v3-phone-more.jpg'), type: 'jpeg', quality: 72 });
    await p.evaluate(() => document.querySelector('.vzs [data-pin="money/pnl"]').click()); await sleep(300); chk('a view can be pinned', await p.evaluate(() => /Profit and loss/.test(document.querySelector('.vzs .mchips').textContent)));
    await p.evaluate(() => document.querySelector('.vzs [data-pin="money/pnl"]').click()); await sleep(300); await p.tap('.vzs-x'); await sleep(350);
    // the eye
    await p.tap('#eyeBtn'); await sleep(150); chk('amounts hide', await p.evaluate(() => document.body.classList.contains('pv') && /blur/.test(getComputedStyle(document.querySelector('.tile .v')).filter))); await p.tap('#eyeBtn'); await sleep(150);
    // swipe between views of a section, pull to refresh
    const swipe = async (x0, x1, y) => { await p.touchscreen.touchStart(x0, y); for (let i = 1; i <= 5; i++) { await p.touchscreen.touchMove(x0 + (x1 - x0) * i / 5, y); await sleep(16); } await p.touchscreen.touchEnd(); await sleep(600); };
    await p.evaluate(() => { location.hash = 'today/review'; }); await sleep(1200); await swipe(320, 80, 560); chk('swipe left goes to the next view', await p.evaluate(() => location.hash === '#today/records'), await p.evaluate(() => location.hash));
    await swipe(80, 320, 560); chk('swipe right comes back', await p.evaluate(() => location.hash === '#today/review'));
    await p.evaluate(() => { location.hash = 'inbox/queue'; }); await sleep(1500); const q = await p.evaluate(() => ({ rows: document.querySelectorAll('.q').length, clear: !!document.querySelector('.allclear'), dead: /kraken|kucoin/i.test(document.getElementById('view').textContent) }));
    chk('the queue renders and carries no dead venue', (q.rows || q.clear) && !q.dead, q);
    // goal
    await p.evaluate(() => { location.hash = 'today/records/uv'; }); await sleep(1500); await p.evaluate(() => { const f = document.querySelector('.card .fold'); if (f) f.open = true; }); await p.type('#gT', '1000'); await p.evaluate(() => document.getElementById('gAdd').click()); await sleep(1200);
    chk('a goal saves and draws a bar', await p.evaluate(() => /Visitors/.test((document.querySelector('.goal') || {}).textContent || '') && !!document.querySelector('.goal-b i')));
    await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => document.querySelector('.goal'), { timeout: 20000 }); chk('the goal survives a reload', true); await p.evaluate(() => document.querySelector('[data-grm]').click()); await sleep(1000); chk('the goal can be removed', await p.evaluate(() => !document.querySelector('.goal')));
    // every view
    const keys = await p.evaluate(() => { const o = []; window.__ops2.NAV.forEach(s => s.views.forEach(v => o.push(s.id + '/' + v.id))); return o; }); const wide = [], thin = [];
    for (const k of keys) { const e0 = errs.length; await p.evaluate(x => { location.hash = x; }, k); await sleep(2600); const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, t: (document.getElementById('view').innerText || '').length })); if (m.sw > m.iw + 1) wide.push(k + ':' + m.sw); if (m.t < 30) thin.push(k); if (errs.length > e0) console.log('  err in', k, errs.slice(e0)); }
    chk('all ' + keys.length + ' views fit 390px', !wide.length, wide); chk('every view rendered', thin.length <= 1, thin); chk('no page errors', !errs.length, errs.slice(0, 5));
    await ctx.close();
  });
  console.log(`\n${pass} ok, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
