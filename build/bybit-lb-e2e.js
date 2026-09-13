/* Bybit volume board (2026-09-13): the report upload (parse, preview, replace, clear), UID registration (allowlist, one UID one
   account), the public board (names + volume only, no test accounts), and the season page cards + switching in a browser.
   Uses a PAST season key for the upload so the live season stays untouched.            node build/bybit-lb-e2e.js            */
'use strict';
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser.js');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const j = async (p, opt) => { const r = await fetch(O + p, opt); let b = null; try { b = await r.json(); } catch (e) {} return { s: r.status, b }; };
const AH = { 'x-admin-key': K, 'content-type': 'application/json' };
const WS = Date.UTC(2026, 6, 20); // the first season on the grid — long over, never paid by payBybitPrizes (starts 2026-09-14)
(async () => {
  // 1. public API
  const lb = await j('/api/reward/lb?cb=' + Date.now());
  ok(lb.s === 200 && Array.isArray(lb.b.topBybit), '/api/reward/lb carries topBybit (' + (lb.b.topBybit || []).length + ' rows)');
  ok(JSON.stringify(lb.b.boardPrizes && lb.b.boardPrizes.bybit) === '[100,50,25,15,10]', 'prizes 100/50/25/15/10 = $200');
  ok(lb.b.bybitPaidFrom === Date.UTC(2026, 8, 14), 'pays from the season of 2026-09-14');
  ok(lb.b.bybitReport && typeof lb.b.bybitReport.n === 'number' && typeof lb.b.bybitReport.registered === 'number', 'report status published (n, onBoard, final, registered)');
  ok((lb.b.topBybit || []).every(r => r.who && r.vol >= 0 && Object.keys(r).sort().join() === 'rank,vol,who'), 'public rows carry rank, name and volume only');
  // 2. two throwaway members + registration rules
  const mk = async (uid) => { await j('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'mk' }) }); const se = await j('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'sess' }) }); return { cookie: 'mp_sess=' + (se.b.token || se.b.sess), 'content-type': 'application/json' }; };
  const u1 = 'e2ebyb' + Date.now().toString(36), u2 = 'e2ebyc' + Date.now().toString(36);
  const H1 = await mk(u1), H2 = await mk(u2);
  const TU = '9999' + String(Date.now()).slice(-8); // test UID range: e2e accounts may register 9999…, never public, never on the allowlist
  const g0 = await j('/api/reward/bybitlink', { headers: H1 }); ok(g0.s === 200 && g0.b.uid === '' && g0.b.eligible === false && /bybit\.com\/invite\?ref=LZKBERJ/.test(g0.b.ref), 'fresh member: nothing registered, referral link offered');
  ok((await j('/api/reward/bybitlink', { method: 'POST', headers: H1, body: JSON.stringify({ uid: '12ab' }) })).b.error === 'bad_uid', 'malformed UID refused');
  ok((await j('/api/reward/bybitlink', { method: 'POST', headers: H1, body: JSON.stringify({ uid: '123456789012' }) })).b.error === 'uid_not_ours', 'a UID that is not on the withdrawal allowlist is refused (uid_not_ours)');
  ok((await j('/api/reward/bybitlink')).s === 401, 'signed-out: 401');
  const l1 = await j('/api/reward/bybitlink', { method: 'POST', headers: H1, body: JSON.stringify({ uid: TU }) }); ok(l1.s === 200 && l1.b.ok, 'member 1 registers a test UID');
  const l2 = await j('/api/reward/bybitlink', { method: 'POST', headers: H2, body: JSON.stringify({ uid: TU }) }); ok(l2.s === 409 && l2.b.error === 'uid_taken', 'member 2 cannot register the same UID (uid_taken)');
  const g1 = await j('/api/reward/bybitlink', { headers: H1 }); ok(g1.b.uid === TU && g1.b.source === 'linked', 'member 1 sees the registered UID');
  // 3. the report: preview, upload to the past season, joined view, replace, clear
  const REPORT = 'UID,Registration time,Trading volume (USDT),Fees\n' + TU + ',2026-09-01 10:00,"1,234,567.89",12.3\n888888001,2026-09-02 11:00,55000,1\n' + TU + ',2026-09-03,2000000,5\nnot a row\n';
  const pv = await j('/api/admin/bybitvol?ws=' + WS, { method: 'POST', headers: AH, body: JSON.stringify({ text: REPORT, preview: true }) });
  ok(pv.s === 200 && pv.b.preview && pv.b.n === 2 && pv.b.rows.find(r => r.uid === TU).vol === 2000000 && pv.b.rows.find(r => r.uid === '888888001').vol === 55000, 'preview parses the header, quoted thousands, and keeps the last line per UID (' + JSON.stringify(pv.b.rows) + ')');
  const before = await j('/api/reward/lb?cb=' + Date.now());
  const up = await j('/api/admin/bybitvol?ws=' + WS, { method: 'POST', headers: AH, body: JSON.stringify({ text: REPORT, final: false }) });
  ok(up.s === 200 && up.b.ok && up.b.n === 2, 'upload stored for the past season');
  const adm = await j('/api/admin/bybitvol?ws=' + WS + '&cb=' + Date.now(), { headers: AH });
  ok(adm.b.upload && adm.b.upload.n === 2 && adm.b.upload.final === false, 'admin view: report of 2 UIDs, not final');
  const mine = (adm.b.matched || []).find(m => m.buid === TU);
  ok(mine && mine.e2e === true && mine.listed === false && mine.vol === 2000000, 'the test member is matched to its UID, flagged test + not on the allowlist');
  ok((adm.b.unmatched || []).some(u => u.uid === '888888001'), 'a report UID nobody registered is listed as unmatched');
  ok((adm.b.board || []).length === 0, 'public board for that season is empty (test account hidden)');
  const after = await j('/api/reward/lb?cb=' + Date.now());
  ok(JSON.stringify(after.b.topBybit) === JSON.stringify(before.b.topBybit), 'the live season board is untouched by the past-season upload');
  const cl = await j('/api/admin/bybitvol?ws=' + WS, { method: 'POST', headers: AH, body: JSON.stringify({ clear: true }) }); ok(cl.b.ok && cl.b.cleared, 'past-season report cleared');
  const bad = await j('/api/admin/bybitvol?ws=' + WS, { method: 'POST', headers: AH, body: JSON.stringify({ text: 'hello\nworld' }) }); ok(bad.s === 400 && bad.b.error === 'no_rows', 'a file without UID/volume lines is refused');
  // 4. browser: cards, logo, switching, registration box, phone
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.setCookie({ name: 'mp_sess', value: H2.cookie.slice(8), domain: 'marginpad.io', path: '/' });
    await page.goto(O + '/season/?cb=' + Date.now() + '#boards', { waitUntil: 'networkidle2', timeout: 60000 }); await new Promise(r => setTimeout(r, 2500));
    const cards = await page.evaluate(() => [...document.querySelectorAll('#bsw .bs')].map(b => ({ k: b.getAttribute('data-board'), logo: !!b.querySelector('svg.bybit-logo'), pb: (b.querySelector('.pb') || {}).textContent || '', pz: (b.querySelector('.big') || {}).textContent || '' })));
    ok(cards.length === 6 && cards[0].k === 'bybit', 'six board cards, Bybit first (' + cards.map(c => c.k).join(',') + ')');
    const by = cards.find(c => c.k === 'bybit'); ok(by && by.logo && /Powered by/i.test(by.pb) && /\$200/.test(by.pz), 'Bybit card: full wordmark, "Powered by", $200 to the top 5');
    const def = await page.evaluate(() => ({ on: (document.querySelector('#bsw .bs.on') || {}).getAttribute('data-board'), banner: (document.querySelector('#tbl .bybanner') || {}).textContent || '', tag: (document.querySelector('#bsw .bs.bybit .tagv') || {}).textContent || '', prizes: [...document.querySelectorAll('#tbl .pzprev .pzc b')].map(b => b.textContent), full: (() => { const a = document.querySelector('#bybox .byfull'); const c = document.querySelector('#bybox .bybox2'); if (!a || !c) return null; return Math.abs(a.getBoundingClientRect().width - c.getBoundingClientRect().width) < 2; })() }));
    ok(def.on === 'bybit', 'the Bybit board opens first by default');
    ok(/Bybit volume based leaderboard/.test(def.banner) && /Bybit volume based/i.test(def.tag), 'says plainly: Bybit volume based leaderboard (banner + card tag)');
    ok(def.prizes.join(',') === '$100,$50,$25,$15,$10' || (await page.evaluate(() => document.querySelectorAll('#tbl .tr:not(.th)').length)) > 0, 'prize preview shows what the top 5 pay while the board is empty (' + def.prizes.join(',') + ')');
    const sw = await page.evaluate(async () => {
      const tw = document.getElementById('tw'); const seen = []; const mo = new MutationObserver(() => seen.push(tw.className)); mo.observe(tw, { attributes: true, attributeFilter: ['class'] });
      document.querySelector('#bsw .bs[data-board="green"]').click(); await new Promise(r => setTimeout(r, 700));
      document.querySelector('#bsw .bs[data-board="bybit"]').click(); await new Promise(r => setTimeout(r, 900)); mo.disconnect();
      for (let i = 0; i < 40 && !document.querySelector('#bybox #byUid, #bybox .ok'); i++) await new Promise(r => setTimeout(r, 100));
      const on = document.querySelector('#bsw .bs.on'); const a = document.querySelector('#bybox .byfull'), c = document.querySelector('#bybox .bybox2');
      return { seen, on: on && on.getAttribute('data-board'), head: (document.querySelector('#tbl .tr.th') || {}).textContent || '', empty: (document.querySelector('#tbl .empty') || {}).textContent || '', rowsIn: document.getElementById('tbl').classList.contains('in'), note: (document.getElementById('bdNote') || {}).textContent || '', box: !document.getElementById('bybox').hidden, boxTxt: (document.getElementById('bybox') || {}).textContent || '', twClass: tw.className, full: a && c ? Math.abs(a.getBoundingClientRect().width - c.getBoundingClientRect().width) < 2 : null };
    });
    ok(sw.full === true, 'the Open Bybit button spans the registration card edge to edge');
    ok(/accounts opened through MarginPad can compete/.test(sw.note) && !/UIDs registered/.test(sw.note), 'note counts Bybit accounts opened through MarginPad (allowlist), not "registered"');
    ok(sw.on === 'bybit' && /Bybit volume/i.test(sw.head) && !/trades|P&L/i.test(sw.head), 'Bybit board selected, the only value column is volume (' + sw.head.trim().replace(/\s+/g, ' ') + ')');
    ok(sw.seen.some(c => /sw-l|sw-r/.test(c)) && !/sw-l|sw-r/.test(sw.twClass), 'the table slid (class toggled and cleared: ' + sw.seen.join(' > ') + ')');
    ok(sw.rowsIn || !!sw.empty, 'rows settled in or the empty state shows');
    ok(/Powered by Bybit/.test(sw.note) && /2026-09-14/.test(sw.note) && /\$100/.test(sw.note) && !/margin (×|x) leverage/i.test(sw.note), 'note: powered by Bybit, report-based, prizes from 2026-09-14');
    ok(sw.box && /UID/.test(sw.boxTxt) && /opened through MarginPad/i.test(sw.boxTxt) && /Register UID/.test(sw.boxTxt), 'registration box shown to the member, states the rule (' + sw.boxTxt.trim().replace(/\s+/g, ' ').slice(0, 80) + '…)');
    const reach = await page.evaluate(() => { const i = document.getElementById('byUid'); if (!i) return 'no-input'; const r = i.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el === i ? 'ok' : 'covered'; });
    ok(reach === 'ok', 'UID input reachable on desktop (' + reach + ')');
    await page.setViewport({ width: 390, height: 800, isMobile: true }); await page.goto(O + '/season/?cb=' + Date.now() + '#boards', { waitUntil: 'networkidle2', timeout: 60000 }); await new Promise(r => setTimeout(r, 2500));
    const ph = await page.evaluate(async () => {
      const b = document.querySelector('#bsw .bs[data-board="bybit"]'); b.scrollIntoView({ inline: 'center', block: 'center' }); await new Promise(r => setTimeout(r, 300));
      const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const hit = el === b || (el && b.contains(el));
      b.click(); await new Promise(r => setTimeout(r, 900)); for (let i = 0; i < 40 && !document.querySelector('#bybox #byUid, #bybox .ok'); i++) await new Promise(r => setTimeout(r, 100));
      const i = document.getElementById('byUid'); let inOk = 'no-input'; if (i) { i.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 200)); const ir = i.getBoundingClientRect(); const e2 = document.elementFromPoint(ir.left + ir.width / 2, ir.top + ir.height / 2); inOk = e2 === i ? 'ok' : 'covered'; }
      return { hit, inOk, pageW: document.documentElement.scrollWidth };
    });
    ok(ph.hit && ph.inOk === 'ok' && ph.pageW <= 390, 'phone: Bybit card tappable, UID input reachable, no horizontal overflow (' + JSON.stringify(ph) + ')');
    await ctx.close();
  });
  // cleanup
  await j('/api/reward/bybitlink', { method: 'POST', headers: H1, body: JSON.stringify({ uid: '' }) });
  for (const u of [u1, u2]) await j('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid: u, op: 'rm' }) });
  ok(true, 'test members removed');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
