/* ONE LESSON AFTER A LOSS (2026-11-12, owner-approved feature #13).
   --pure : lessonFor / autopsyLesson / reportFindings lifted out of the SHIPPED worker - every finding kind maps to a real lesson id
            or deliberately to none, the autopsy rule in order (liquidated, a clean win, no stop, stopped-then-went, a stop inside the
            range, macro in the window, a cascade against the side, 100x, a fast high-leverage loss, a plain loss), and every id named
            exists in the Academy's own data.
   (default): the pure checks, then a browser: /academy/?lesson=<free id> opens that lesson, ?lesson=<locked id> scrolls to and marks
            its node, the autopsy sheet draws the lesson link from a canned answer, /trading-report/ draws a finding's lesson link.
   Run: node build/lesson-e2e.js [--pure] [--local] */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), ORIGIN = 'https://marginpad.io';
const PURE = process.argv.includes('--pure'), LOCAL = process.argv.includes('--local');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let okN = 0, failN = 0; const chk = (n, ok, x) => { ok ? okN++ : failN++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 240) : '')); };
const W = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
const lift = (from, to) => { const a = W.indexOf(from), b = W.indexOf(to, a); if (a < 0 || b < 0) throw new Error('cannot lift ' + from); return W.slice(a, b); };
const minN = +(W.match(/const REPORT_MIN_N = (\d+)/) || [])[1] || 8;
const src = lift('const ACAD_LESSON_T = {', '\n// Which of this trader\'s levels are close enough');
const { ACAD_LESSON_T, LESSON_MAP, lessonFor, autopsyLesson, reportFindings } = new Function('REPORT_MIN_N', src + '\nreturn { ACAD_LESSON_T, LESSON_MAP, lessonFor, autopsyLesson, reportFindings };')(minN);
// every lesson id the server may name exists in the Academy's own data
const acad = JSON.parse((fs.readFileSync(path.join(ROOT, 'dist', 'academy', 'index.html'), 'utf8').match(/<script[^>]*id="acadData"[^>]*>([\s\S]*?)<\/script>/) || [])[1]);
const ids = {}; (acad.courses || acad).forEach(c => (c.lessons || []).forEach((l, i) => { ids[l.id] = { t: l.t, free: !!c.free, course: c.id, first: i === 0 }; })); // only the FIRST lesson of a free course is open to a fresh guest - lessons unlock in sequence inside a course
const named = Object.keys(ACAD_LESSON_T);
chk('pure: every lesson the server may name exists in #acadData with that title', named.every(id => ids[id] && ids[id].t === ACAD_LESSON_T[id]), named.filter(id => !ids[id] || ids[id].t !== ACAD_LESSON_T[id]));
chk('pure: the finding map: lev -> leverage, coin -> skipping, side -> journal review, liq -> liquidation; hold and thin carry none', lessonFor('lev').id === 'l2' && lessonFor('coin').id === 'r8' && lessonFor('side').id === 'r12' && lessonFor('liq').id === 'l3' && lessonFor('hold') === null && lessonFor('thin') === null && lessonFor('nope') === null, LESSON_MAP);
chk('pure: a lesson carries its href', lessonFor('liq').href === '/academy/?lesson=l3', lessonFor('liq'));
const T = (o) => Object.assign({ sym: 'BTC', long: true, entry: 100, exit: 97, lev: 10, margin: 100, ts: 0, cts: 600000, stop: 98, pnl: -30, liquidated: false }, o);
const S = (o) => Object.assign({ mfePct: 0.5, maePct: 3, movePct: -3, giveBackShare: null, yourStop: { px: 98, pct: 2, held: false, atr: 2 }, heldMs: 600000 }, o);
chk('pure: a liquidation -> l3 first, whatever else is true', autopsyLesson(T({ liquidated: true, stop: 0 }), S(), {}).id === 'l3');
chk('pure: a clean win teaches nothing', autopsyLesson(T({ pnl: 20, exit: 102 }), S({ movePct: 2, mfePct: 2.2, giveBackShare: 0.09 }), {}) === null);
chk('pure: a win that gave back half of its best -> r2', (autopsyLesson(T({ pnl: 5, exit: 100.5 }), S({ movePct: 0.5, mfePct: 3, giveBackShare: 0.83 }), {}) || {}).id === 'r2');
chk('pure: a loss with no stop -> ft4', autopsyLesson(T({ stop: 0 }), S({ yourStop: null }), {}).id === 'ft4');
chk('pure: stopped out and then it went your way twice the stop distance -> r2', autopsyLesson(T(), S({ mfePct: 4.5, yourStop: { px: 98, pct: 2, held: false, atr: 2 } }), {}).id === 'r2');
chk('pure: a stop inside one ATR that was hit -> tr8', autopsyLesson(T(), S({ mfePct: 0.5, yourStop: { px: 99.5, pct: 0.5, held: false, atr: 0.6 } }), {}).id === 'tr8');
chk('pure: a macro item in the window -> mm4', autopsyLesson(T(), S(), { catalysts: { items: [{ kind: 'macro' }] } }).id === 'mm4');
chk('pure: a $5M+ cascade on your side -> m5; on the other side it is not the reason', autopsyLesson(T(), S(), { liq: { n: 40, longUsd: 6e6, shortUsd: 1e6 } }).id === 'm5' && autopsyLesson(T(), S(), { liq: { n: 40, longUsd: 1e6, shortUsd: 6e6 } }).id !== 'm5');
chk('pure: 100x -> l11; 25x held under three minutes -> py1; otherwise a plain loss -> r3', autopsyLesson(T({ lev: 100 }), S(), {}).id === 'l11' && autopsyLesson(T({ lev: 25 }), S({ heldMs: 90000 }), {}).id === 'py1' && autopsyLesson(T(), S(), {}).id === 'r3');
{ // reportFindings carries the lesson on the kinds that have one
  const rep = { total: { n: 40, pnl: -500, liq: 5, holdMedianMin: 30, holdN: 40 }, byLev: [{ k: '10x', n: 20, exp: -12 }, { k: '3x', n: 20, exp: 4 }], byCoin: [{ k: 'SOL', n: 12, pnl: -400, wr: 30 }], bySide: [{ k: 'long', n: 20, exp: 5 }, { k: 'short', n: 20, exp: -9 }] };
  const f = reportFindings(rep); const byK = {}; f.forEach(x => { byK[x.k] = x; });
  chk('pure: the report findings carry a lesson on lev / coin / side / liq and none on hold', byK.lev && byK.lev.lesson.id === 'l2' && byK.coin && byK.coin.lesson.id === 'r8' && byK.side && byK.side.lesson.id === 'r12' && byK.liq && byK.liq.lesson.id === 'l3' && byK.hold && !byK.hold.lesson, f.map(x => [x.k, x.lesson && x.lesson.id]));
  chk('pure: a thin window carries no lesson', !reportFindings({ total: { n: 3 } })[0].lesson);
}
if (PURE) { console.log('\nlesson-e2e: ' + okN + ' passed, ' + failN + ' failed [pure]'); process.exit(failN ? 1 : 0); }
const { withBrowser } = require('./e2e-browser');
const CT = { js: 'text/javascript', css: 'text/css', html: 'text/html; charset=utf-8' };
function localFile(u) { const p = new URL(u).pathname; if (p.indexOf('/assets/') === 0) return path.join(ROOT, 'dist', p); if (/^\/(paper-trade|charts|heatmap|screener|calculators|swap)$/.test(p)) return path.join(ROOT, 'app', 'index.html'); if (p === '/academy/') return path.join(ROOT, 'dist', 'academy', 'index.html'); if (p === '/trading-report/') return path.join(ROOT, 'dist', 'trading-report', 'index.html'); return null; }
const freeId = named.find(id => ids[id] && ids[id].free && ids[id].first) || 'py1', lockedId = named.find(id => ids[id] && !ids[id].free && ids[id].course !== 'firsttrade') || 'r2';
(async () => {
  await withBrowser(async (browser) => {
    const mk = async (url, w, pre, mock) => { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: w, height: 900 }); await p.setRequestInterception(true); const reqs = []; p.reqs = reqs; p.on('request', r => { const u = r.url(); reqs.push(u); if (mock) { const m = mock(u); if (m) return r.respond({ status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(m) }); } if (LOCAL) { const f = localFile(u); if (f && fs.existsSync(f)) { const ext = f.split('.').pop(); return r.respond({ status: 200, headers: { 'content-type': CT[ext] || 'application/octet-stream', 'cache-control': 'no-store' }, body: fs.readFileSync(f) }); } } r.continue(); }); if (pre) await p.evaluateOnNewDocument(pre); const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 140))); await p.goto(ORIGIN + url, { waitUntil: 'domcontentloaded', timeout: 90000 }); return { ctx, p, errs }; };
    { // a free lesson opens straight from the link
      const { ctx, p, errs } = await mk('/academy/?lesson=' + freeId, 1366);
      const open = await p.waitForFunction(() => { const lp = document.getElementById('lp') || document.querySelector('.lp'); return !!lp && lp.classList.contains('on'); }, { timeout: 20000 }).then(() => true).catch(() => false);
      await sleep(400); // the open beacon (t=academy&e=<id>) is what names WHICH lesson opened - the panel's own body shows the first card, not the title
      const beacon = p.reqs.find(u => u.indexOf('/api/track?t=academy&e=' + freeId) >= 0);
      chk('/academy/?lesson=' + freeId + ' opens that lesson (the panel is up and the open beacon names it)', open && !!beacon, { open, beacon: !!beacon });
      chk('no page errors on the academy', errs.length === 0, errs);
      await ctx.close(); }
    { // a locked lesson is scrolled to and marked, not opened
      const { ctx, p } = await mk('/academy/?lesson=' + lockedId, 1366);
      const st = await p.waitForFunction((id) => { const b = document.querySelector('.node[data-lesson="' + id + '"]'); return !!b && b.classList.contains('deep'); }, { timeout: 20000 }, lockedId).then(() => p.evaluate((id) => { const b = document.querySelector('.node[data-lesson="' + id + '"]'); const r = b.getBoundingClientRect(); const lp = document.querySelector('.lp'); return { disabled: b.disabled, inView: r.top >= 0 && r.bottom <= innerHeight, open: !!(lp && lp.classList.contains('on')) }; }, lockedId)).catch(() => null);
      chk('/academy/?lesson=' + lockedId + ' (locked for a guest) scrolls to the node, marks it, opens nothing', !!st && st.disabled && st.inView && !st.open, st);
      await ctx.close(); }
    { // the autopsy sheet draws the lesson link
      const NOW = Date.now(), OPEN = NOW - 60 * 60000, CLOSE = NOW - 30 * 60000;
      const ROW = { id: 'e2elesson1', ts: OPEN, closeTs: CLOSE, sym: 'ETH', side: 'long', entry: 2000, exit: 1960, stop: 1960, tp: null, lev: 10, qty: 0.5, notional: 1000, margin: 100, riskAmt: 100, liq: 1819, mmr: 0.005, feeRate: 0.00055, status: 'loss', pnl: -20.5 };
      const canned = { ok: true, source: 'device', trade: { sym: 'ETH', side: 'long', entry: 2000, exit: 1960, lev: 10, margin: 100, pnl: -20.5, ts: OPEN, cts: CLOSE, stop: 1960 }, interval: '1', covered: true, bars: [[OPEN - 60000, 2000, 2010, 1990, 2000], [OPEN, 2000, 2005, 1955, 1960], [CLOSE, 1960, 1990, 1958, 1985]], stats: { bars: 2, preBars: 1, mfePct: 0.25, mfeUsd: 2.5, mfeT: OPEN, maePct: 2.25, maeUsd: 22.5, maeT: OPEN, atrPct: 1, ladder: [], yourStop: { px: 1960, pct: 2, held: false, atr: 2, lossUsd: 20 }, movePct: -2, moveUsd: -20, giveBackPct: null, giveBackShare: null, firstHeldAtr: null, notional: 1000, heldMs: CLOSE - OPEN }, liq: null, catalysts: null, lesson: { id: 'r3', t: 'Risk:reward - being wrong profitably', href: '/academy/?lesson=r3', why: 'loss' }, now: NOW };
      const { ctx, p, errs } = await mk('/paper-trade', 1366, (j) => { try { localStorage.setItem('mp_journal', JSON.stringify(j)); localStorage.setItem('mp_ck_ok', '1'); } catch (e) {} }, (u) => u.indexOf('/api/trade/autopsy') >= 0 ? canned : null);
      await p.evaluateOnNewDocument; // no-op: pre was given above
      await p.waitForFunction(() => !!window.mpOpenTrades && !!window.__mpJrWhy, { timeout: 40000 });
      await p.evaluate((j) => { try { localStorage.setItem('mp_journal', JSON.stringify(j)); } catch (e) {} }, [ROW]);
      await p.evaluate(() => window.mpOpenTrades()); await p.waitForFunction(() => !!document.querySelector('#jrList [data-jt="closed"]'), { timeout: 15000 }); await p.evaluate(() => document.querySelector('#jrList [data-jt="closed"]').click());
      await p.waitForFunction(() => !!document.querySelector('#jrList .pp [data-act="why"]'), { timeout: 10000 }); await p.evaluate(() => document.querySelector('#jrList .pp [data-act="why"]').click());
      await p.waitForFunction(() => !!document.querySelector('#jrWhy a.jrw-lesson'), { timeout: 15000 }).catch(() => {});
      const l = await p.evaluate(() => { const a = document.querySelector('#jrWhy a.jrw-lesson'); if (!a) return null; const r = a.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { href: a.getAttribute('href'), txt: a.textContent, under: !!(e && (e === a || a.contains(e))) }; });
      chk('the autopsy sheet ends in the lesson link, reachable where it is drawn', !!l && l.href === '/academy/?lesson=r3' && /One lesson for this/.test(l.txt) && /Risk:reward/.test(l.txt) && l.under, l);
      chk('no page errors', errs.length === 0, errs);
      await ctx.close(); }
    { // /trading-report/ draws a finding's lesson link (canned report)
      const rep = { ok: true, premium: true, days: 30, total: { n: 40, pnl: -500, liq: 5, wins: 15, wr: 37 }, skill: null, findings: [{ k: 'liq', n: 5, text: '5 of your 40 closes were liquidations (12%). Each one cost the whole margin on that trade.', lesson: { id: 'l3', t: 'Liquidation: the point of no return', href: '/academy/?lesson=l3' } }, { k: 'hold', n: 40, text: 'Median hold: 30 minutes across 40 trades.' }], byLev: [], byCoin: [], bySide: [], byHour: [], byDay: [] };
      const { ctx, p } = await mk('/trading-report/', 1366, () => { try { localStorage.setItem('mp_ck_ok', '1'); } catch (e) {} }, (u) => u.indexOf('/api/trade/report') >= 0 ? rep : null);
      await sleep(600); await p.evaluate(() => window.dispatchEvent(new CustomEvent('mp-auth-change', { detail: { user: { username: 'e2e_lesson' } } }))); // the page loads the report only for a member; the answer itself is canned above
      const got = await p.waitForFunction(() => !!document.querySelector('.find .find-l'), { timeout: 25000 }).then(() => p.evaluate(() => { const as = [...document.querySelectorAll('.find .find-l')]; return { n: as.length, href: as[0] && as[0].getAttribute('href'), txt: as[0] && as[0].textContent, finds: document.querySelectorAll('.find').length }; })).catch(() => null);
      chk('/trading-report/ draws the lesson link on the finding that has one, and none on the hold line', !!got && got.n === 1 && got.finds === 2 && got.href === '/academy/?lesson=l3' && /Liquidation: the point/.test(got.txt), got);
      await ctx.close(); }
  }, { timeoutMs: 420000 });
  console.log('\nlesson-e2e: ' + okN + ' passed, ' + failN + ' failed' + (LOCAL ? ' [local]' : ''));
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
