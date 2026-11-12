/* PAPER COPY (2026-11-12, owner-approved feature #2, with his one condition: a copied trade never counts on a leaderboard).
   --pure (always): the worker source itself - every tradeev reader a board, duel, raid, report, mission, record or exam depends on carries
            the cp=0 filter; the blob-path boards and the public card skip `copy` rows; the grants skip them; the insert writes cp; the
            constants and the fan-out are the ones this file names.
   (default, --local): the profile card - the Copy tile beside Portfolio, the panel with $50 / $100 / $250 and Stop, a press posting
            {leader, margin}, the tile lit from the answer; a guest tile carries data-auth-open; your own card has no tile; My Trades
            draws the COPY badge with the leader's name on a mirrored row (both bundles).
   --prod : two throwaway members - B copies A at $50; A opens a BTC position through /api/trade/open; B's journal gains ONE row with
            copy:1, the same side/lev/entry, margin 50, naming A; A closes; B's row is closed at A's exit with sc:1; B's public card and
            report count none of it; a third leader past the cap is refused; stop; both removed.
   Run: node build/copy-e2e.js [--pure] [--local] [--prod] */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), BASE = 'https://marginpad.io';
const PURE = process.argv.includes('--pure'), LOCAL = process.argv.includes('--local'), PROD = process.argv.includes('--prod');
let okN = 0, failN = 0; const chk = (n, ok, x) => { ok ? okN++ : failN++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 260) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
const strip = (s) => s.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const WS = strip(W);
const count = (re) => (WS.match(re) || []).length;
chk('pure: the constants are the ones the card and the fan-out read (3 leaders, 10 open per leader, $10k leader cap, $50/$100/$250)', /const COPY_MAX_LEADERS = 3, COPY_MAX_PER_LEADER = 10, COPY_LEADER_MAX_MARGIN = 10000, COPY_MARGINS = \[50, 100, 250\];/.test(WS));
chk('pure: tradeev carries cp and the one insert writes it from e.copy', /ALTER TABLE tradeev ADD COLUMN cp INTEGER DEFAULT 0/.test(WS) && /INSERT INTO tradeev\(user_id,ts,kind,sym,side,lev,margin,pnl,roe,liq,via,tid,src,sl,rz,fee,fund,entry,exit,slpx,cp\)/.test(WS) && /e\.copy \? 1 : 0\);/.test(WS));
chk('pure: every board, duel, raid, report, mission, exam, curve and feed reader filters cp=0 (15 sites)', count(/COALESCE\((e\.)?cp,0\)=0/g) >= 15, count(/COALESCE\((e\.)?cp,0\)=0/g));
chk('pure: the win-rate board, the green board (both passes) and the Gold path read cp=0', /kind='close' AND ts>=\? AND ts<\? AND COALESCE\(cp,0\)=0 AND UPPER\(sym\) NOT IN \(" \+ LB_EXCL_SQL \+ "\) ORDER BY user_id, ts LIMIT 40000/.test(WS) && count(/via<>'client' AND COALESCE\(cp,0\)=0 AND pnl IS NOT NULL/g) === 2);
chk('pure: duels and raids read cp=0', /AND ts<\? AND COALESCE\(cp,0\)=0 ORDER BY ts ASC', uid, 'close', from, to\)/.test(WS) && /UPPER\(sym\)=\? AND ts>=\? AND ts<\? AND COALESCE\(cp,0\)=0 ORDER BY ts ASC"/.test(WS));
chk('pure: the blob-path board, the public card and the following list skip copy rows; _lbBest refuses one', /if \(e\.copy\) continue;/.test(WS) && /if \(!e \|\| e\.copy\) continue;/.test(WS) && /if \(!e \|\| e\.copy \|\| \(e\.status !== 'win' && e\.status !== 'loss'\)\) continue;/.test(WS) && /if \(!\(e && e\.src === 'srv' && e\.sc\) \|\| e\.copy\) return;/.test(WS));
chk('pure: Ticks, XP, personal records, promos and the season counters skip a copy', /kind === 'close' && !lbExcluded\(e\.sym\) && !e\.copy\) \{ this\._grantTicks/.test(WS) && /kind === 'close' && !lbExcluded\(e\.sym\) && !e\.copy\) \{ this\._grantXp/.test(WS) && /pv != null && !e\.copy\) this\._pbOnClose/.test(WS) && /if \(roe != null && !e\.copy\) \{ var _pl/.test(WS) && /if \(kind === 'close' && !e\.copy\) \{ const lp9/.test(WS));
chk('pure: the fan-out runs only on a server-authoritative, non-copy, non-replay per-op sync and the mirrored row is src srv + copy:1', /srvAuth && via !== 'copy' && via !== 'replay' && ops\.length && ops\.length <= 8 && this\._copiedSet\(\)\.has\(uid\)\) this\._copyFanOut\(uid, ops\)/.test(WS) && /status: 'open', pnl: null, src: 'srv', swT: now, copy: 1, copyOf: String\(leader\), copyName: ln, copyTid: String\(e\.id \|\| ''\)/.test(WS));
chk('pure: the mirror closes at the LEADER exit with the one P&L formula and sc:1, and the SL/TP edit follows', /closeTs: now, sc: 1, liquidated: !!e\.liquidated/.test(WS) && /_copySltp\(uid, String\(t\.id\), sl, tp\)/.test(WS) && /q \* \(exit - en\) \* dir - q \* \(en \+ exit\) \* \(\+x\.feeRate \|\| 0\) - \(\+x\.fund \|\| 0\)/.test(WS));
chk('pure: /api/lb/copy exists and the public card carries copiers + iCopy', /if \(sub === 'copy'\)/.test(WS) && /iFollow, followsMe, mutual, requested, copiers, iCopy,/.test(WS));
chk('pure: both drawer bundles draw the COPY badge', /class="pp-copy"/.test(fs.readFileSync(path.join(ROOT, 'dist/assets/home.js'), 'utf8')) && /class="pp-copy"/.test(fs.readFileSync(path.join(ROOT, 'dist/assets/mp-trade.js'), 'utf8')) && /\.pp-copy\{/.test(fs.readFileSync(path.join(ROOT, 'dist/assets/home.css'), 'utf8')) && /\.pp-copy\{/.test(fs.readFileSync(path.join(ROOT, 'dist/assets/mp-trade.css'), 'utf8')));
if (PURE) { console.log('\ncopy-e2e: ' + okN + ' passed, ' + failN + ' failed [pure]'); process.exit(failN ? 1 : 0); }
const { withBrowser, newPage, UA_DESKTOP } = require('./e2e-browser');
const A = path.join(ROOT, 'dist', 'assets');
const CARD = { exists: true, isSelf: false, viewerSignedIn: true, uid: 'u:e2eleader', name: 'e2e_leader', level: { k: 'gold', name: 'Gold', col: '#f0c35a', pct: 20, next: 'Platinum', toNext: 9000, xp: 15000, stars: 0 }, iFollow: false, followsMe: false, mutual: false, requested: false, copiers: 2, iCopy: 0, bio: '', avatar: '', coins: [], frame: 'default', cardbg: '', records: null, stats: { trades: 12, closed: 10, wins: 6, winRate: 60, realized: 40, bestRoe: 30, bestPnl: 20, weekTrades: 3, weekWinRate: 66, weekPnl: 12, season: true }, curve: null, sqbadge: '', followers: 4, squad: null };
async function prep(browser, payload, o) {
  o = o || {}; const page = await newPage(browser, { mobile: false, ua: UA_DESKTOP });
  await page.setViewport({ width: 1366, height: 900 });
  const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e).slice(0, 140)));
  await page.setCacheEnabled(false); await page.setRequestInterception(true);
  try { const cdp = await page.target().createCDPSession(); await cdp.send('Network.enable'); await cdp.send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) {}
  if (o.member !== false) await page.setCookie({ name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
  const posts = [];
  page.on('request', (req) => {
    const u = req.url();
    if (u.indexOf('/api/track') >= 0) return req.respond({ status: 204, body: '' });
    if (u.includes('/api/auth/me')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(o.member === false ? { user: null } : { user: { id: 'e2eviewer', username: 'e2e_viewer', xp: 4100 } }) });
    if (u.includes('/api/auth/xp') && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: o.member !== false, xp: 4100, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
    if (u.includes('/api/lb/user')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    if (u.includes('/api/lb/copy') && req.method() === 'POST') { let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {} posts.push(b); return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, copying: +b.margin || 0, leader: b.leader, name: 'e2e_leader', isNew: true }) }); }
    if (LOCAL && /\/assets\/mp-profile\.js/.test(u)) return req.respond({ status: 200, contentType: 'application/javascript; charset=utf-8', body: fs.readFileSync(path.join(A, 'mp-profile.js'), 'utf8') });
    if (LOCAL && /\/assets\/(home|mp-trade|mp-auth|mp-nav)\.(js|css)/.test(u)) { const f = u.split('/assets/')[1].split('?')[0]; return req.respond({ status: 200, contentType: /\.css/.test(f) ? 'text/css' : 'application/javascript; charset=utf-8', body: fs.readFileSync(path.join(A, f)) }); }
    if (LOCAL && /\/paper-trade(\?|$)/.test(u) && !/\/api\//.test(u)) return req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8') });
    req.continue();
  });
  if (o.journal) await page.evaluateOnNewDocument((j) => { try { localStorage.setItem('mp_journal', JSON.stringify(j)); localStorage.setItem('mp_ck_ok', '1'); } catch (e) {} }, o.journal);
  await page.goto(BASE + '/paper-trade', { waitUntil: 'domcontentloaded', timeout: 90000 });
  return { page, errors, posts };
}
async function openCard(page, name) { await page.waitForFunction(() => !!window.mpOpenProfile || !!window.mpEnsureProfile, { timeout: 40000 }); await page.evaluate(() => { if (!window.mpOpenProfile && window.mpEnsureProfile) window.mpEnsureProfile(); }); await page.waitForFunction(() => !!window.mpOpenProfile, { timeout: 30000 }); await page.evaluate((n) => window.mpOpenProfile(n), name); await page.waitForFunction(() => !!document.querySelector('.lbm-card .lbm-acts'), { timeout: 20000 }); }
(async () => {
  await withBrowser(async (browser) => {
    { // a signed-in viewer on another trader: the tile, the panel, a press
      const { page, errors, posts } = await prep(browser, CARD);
      await openCard(page, 'e2e_leader');
      const t = await page.evaluate(() => { const acts = document.querySelector('.lbm-card .lbm-acts'); const b = acts.querySelector('.lbm-copyb'); const r = b && b.getBoundingClientRect(); const all = [...acts.querySelectorAll('button')]; return { has: !!b, on: b && b.classList.contains('on'), auth: b && b.hasAttribute('data-auth-open'), n: all.length, sameSize: all.every(x => Math.abs(x.getBoundingClientRect().width - all[0].getBoundingClientRect().width) < 1), under: !!(r && (function () { const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e === b || b.contains(e); })()), copiers: (document.querySelector('.lbm-cpn2') || {}).textContent }; });
      chk('the card carries a Copy tile beside Portfolio, unlit, the same size as the other tiles, reachable', t.has && !t.on && !t.auth && t.n === 5 && t.sameSize && t.under, t);
      chk('the foot says how many copy this trader', /2/.test(t.copiers || '') && /copying/.test(t.copiers || ''), t.copiers);
      await page.evaluate(() => document.querySelector('.lbm-copyb').click());
      const p1 = await page.waitForFunction(() => { const el = document.getElementById('lbmCopyP'); return !!el && !el.hidden && el.querySelectorAll('.lbm-cpc').length >= 3; }, { timeout: 8000 }).then(() => page.evaluate(() => { const el = document.getElementById('lbmCopyP'); return { chips: [...el.querySelectorAll('.lbm-cpc')].map(x => x.textContent), stop: !!el.querySelector('.lbm-cpc.stop'), head: el.querySelector('.lbm-cph').textContent, note: el.querySelector('.lbm-cpn').textContent, inCard: el.getBoundingClientRect().right <= document.querySelector('.lbm-card').getBoundingClientRect().right + 1 }; })).catch(() => null);
      chk('the panel opens with $50 / $100 / $250, no Stop while not copying, and says copies never rank', !!p1 && p1.chips.join(',') === '$50,$100,$250' && !p1.stop && /Copy @e2e_leader/.test(p1.head) && /never count on any leaderboard/.test(p1.note) && p1.inCard, p1);
      await page.evaluate(() => document.querySelector('[data-lbcopyset="100"]').click());
      const after = await page.waitForFunction(() => window.__mpCopyLast && window.__mpCopyLast.ok, { timeout: 8000 }).then(() => page.evaluate(() => { const el = document.getElementById('lbmCopyP'); return { lit: document.querySelector('.lbm-copyb').classList.contains('on'), on: (el.querySelector('.lbm-cpc.on') || {}).textContent, stop: !!el.querySelector('.lbm-cpc.stop'), head: el.querySelector('.lbm-cph').textContent, st: (el.querySelector('.lbm-cps') || {}).textContent }; })).catch(() => null);
      chk('pressing $100 posts {leader, margin:100}; the tile lights, the chip is on, Stop appears, the head names the margin', posts.length === 1 && posts[0].leader === 'u:e2eleader' && posts[0].margin === 100 && !!after && after.lit && after.on === '$100' && after.stop && /at \$100 a trade/.test(after.head) && /On\./.test(after.st), { posts, after });
      await page.evaluate(() => document.querySelector('.lbm-cpc.stop').click()); await sleep(500);
      chk('Stop posts margin 0 and unlights the tile', posts.length === 2 && posts[1].margin === 0 && !(await page.evaluate(() => document.querySelector('.lbm-copyb').classList.contains('on'))), posts);
      chk('no page errors', errors.length === 0, errors);
      await page.close();
    }
    { // a guest: the tile carries data-auth-open (mp-auth opens sign-in) and posts nothing
      const { page, posts } = await prep(browser, Object.assign({}, CARD, { viewerSignedIn: false }), { member: false });
      await openCard(page, 'e2e_leader');
      const g = await page.evaluate(() => { const b = document.querySelector('.lbm-copyb'); return { has: !!b, auth: b && b.hasAttribute('data-auth-open') }; });
      chk('a guest sees the tile marked to open sign-in', g.has && g.auth, g);
      // mp-auth's own [data-auth-open] handler calls its INTERNAL open(), never window.mpAuth.open - so the proof is the sheet itself
      await page.evaluate(() => { document.querySelector('.lbm-copyb').click(); }); await sleep(600);
      const o = await page.evaluate(() => { const m = document.querySelector('.mpa-modal'); return { sheet: !!(m && !m.hidden), panel: !!(document.getElementById('lbmCopyP') && !document.getElementById('lbmCopyP').hidden) }; });
      chk('the tap opens the sign-in sheet, no panel, nothing posted', o.sheet && !o.panel && posts.length === 0, o);
      await page.close();
    }
    { // your own card has no Copy tile
      const { page } = await prep(browser, Object.assign({}, CARD, { isSelf: true, name: 'e2e_viewer', uid: 'u:e2eviewer' }));
      await openCard(page, 'e2e_viewer');
      chk('your own card offers no Copy', !(await page.evaluate(() => !!document.querySelector('.lbm-copyb'))));
      await page.close();
    }
    { // My Trades: a mirrored row wears the COPY badge with the leader's name (home.js on the shell)
      const now = Date.now();
      const J = [{ id: 'srv' + now.toString(36) + 'cabcde', ts: now - 60000, sym: 'ETH', side: 'short', entry: 2000, stop: 2040, tp: null, lev: 5, qty: 0.125, notional: 250, margin: 50, riskAmt: 50, liq: 2380, mmr: 0.005, feeRate: 0.00055, status: 'open', pnl: null, src: 'srv', copy: 1, copyOf: 'e2eleader', copyName: 'e2e_leader', copyTid: 'srvxyz' }, { id: 'srv' + (now - 5000).toString(36) + 'c12345', ts: now - 7200000, closeTs: now - 3600000, sym: 'BTC', side: 'long', entry: 70000, exit: 70700, lev: 10, qty: 0.0142857, notional: 1000, margin: 100, liq: 63665, mmr: 0.005, feeRate: 0.00055, status: 'win', pnl: 9.1, src: 'srv', sc: 1, copy: 1, copyOf: 'e2eleader', copyName: 'e2e_leader', copyTid: 'srvabc' }, { id: String(now) + '_1', ts: now - 120000, sym: 'SOL', side: 'long', entry: 80, lev: 3, qty: 3.75, notional: 300, margin: 100, liq: 53.6, mmr: 0.005, feeRate: 0.00055, status: 'open', pnl: null }];
      const { page, errors } = await prep(browser, CARD, { journal: J });
      await page.waitForFunction(() => !!window.mpOpenTrades, { timeout: 40000 }); await page.evaluate(() => window.mpOpenTrades()); await sleep(600);
      const o = await page.evaluate(() => [...document.querySelectorAll('#jrList .pp')].map(c => ({ sym: (c.querySelector('.pp-sym') || {}).textContent, copy: (c.querySelector('.pp-copy') || {}).textContent || null })));
      chk('the open mirrored ETH row wears COPY · @e2e_leader and the member own SOL row does not', o.some(x => x.sym === 'ETH' && x.copy === 'COPY · @e2e_leader') && o.some(x => x.sym === 'SOL' && x.copy === null), o);
      await page.evaluate(() => document.querySelector('#jrList [data-jt="closed"]').click()); await sleep(300);
      const c = await page.evaluate(() => [...document.querySelectorAll('#jrList .pp')].map(x => ({ sym: (x.querySelector('.pp-sym') || {}).textContent, copy: (x.querySelector('.pp-copy') || {}).textContent || null, wide: x.querySelector('.pp-h').scrollWidth > x.querySelector('.pp-h').clientWidth + 1 })));
      chk('the closed mirrored BTC row wears the badge too, and the head row does not overflow', c.some(x => x.sym === 'BTC' && x.copy === 'COPY · @e2e_leader' && !x.wide), c);
      chk('no page errors with mirrored rows in the journal', errors.length === 0, errors);
      await page.close();
    }
  }, { timeoutMs: 420000 });
  if (PROD) {
    const KEY = fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
    const H = { 'content-type': 'application/json', 'x-admin-key': KEY };
    const adm = (body) => fetch(BASE + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify(body) }).then(r => r.json());
    const tag = Date.now().toString(36).slice(-4), A = 'e2ecpa' + tag, B = 'e2ecpb' + tag, C = 'e2ecpc' + tag, D = 'e2ecpd' + tag, E = 'e2ecpe' + tag;
    for (const u of [A, B, C, D, E]) await adm({ uid: u, op: 'mk' });
    const tok = {}; for (const u of [A, B]) tok[u] = (await adm({ uid: u, op: 'sess' })).token;
    const as = (u, p, o) => fetch(BASE + p, Object.assign({ headers: Object.assign({ cookie: 'mp_sess=' + tok[u], 'content-type': 'application/json' }, (o && o.headers) || {}) }, o || {})).then(async r => ({ st: r.status, j: await r.json().catch(() => null) }));
    const aCard = await fetch(BASE + '/api/lb/user?name=e2e_' + A).then(r => r.json()); const aUid = aCard && aCard.uid;
    chk('prod: the leader exists on the card with uid', !!aUid, aCard && aCard.uid);
    const s1 = await as(B, '/api/lb/copy', { method: 'POST', body: JSON.stringify({ leader: aUid, margin: 50 }) });
    chk('prod: B copies A at $50', s1.st === 200 && s1.j && s1.j.ok && s1.j.copying === 50 && s1.j.isNew, s1.j);
    const bad = await as(B, '/api/lb/copy', { method: 'POST', body: JSON.stringify({ leader: aUid, margin: 77 }) });
    chk('prod: a margin outside the three is refused', bad.st === 400 && bad.j && bad.j.error === 'bad_margin', bad);
    for (const [u, n] of [[C, 1], [D, 2]]) { const cu = (await fetch(BASE + '/api/lb/user?name=e2e_' + u).then(r => r.json())).uid; await as(B, '/api/lb/copy', { method: 'POST', body: JSON.stringify({ leader: cu, margin: 100 }) }); }
    const eUid = (await fetch(BASE + '/api/lb/user?name=e2e_' + E).then(r => r.json())).uid;
    const cap = await as(B, '/api/lb/copy', { method: 'POST', body: JSON.stringify({ leader: eUid, margin: 100 }) });
    chk('prod: a fourth leader is refused (cap 3)', cap.st === 400 && cap.j && cap.j.error === 'too_many', cap);
    const mine = await as(B, '/api/lb/copy');
    chk('prod: B sees three leaders with their margins', mine.j && Array.isArray(mine.j.leaders) && mine.j.leaders.length === 3 && mine.j.leaders.some(l => l.uid === aUid && l.margin === 50), mine.j && mine.j.leaders);
    const card2 = await fetch(BASE + '/api/lb/user?name=e2e_' + A + '&cb=' + Date.now(), { headers: { cookie: 'mp_sess=' + tok[B] } }).then(r => r.json());
    chk('prod: the leader card shows 1 copier and, to B, iCopy 50', card2 && card2.copiers === 1 && card2.iCopy === 50, card2 && { copiers: card2.copiers, iCopy: card2.iCopy });
    // A opens a server-filled BTC long; B's journal gains the mirror
    const op = await as(A, '/api/trade/open', { method: 'POST', body: JSON.stringify({ sym: 'BTC', side: 'long', lev: 5, margin: 200, cid: 'cp' + tag }) });
    const aRow = op.j && (op.j.raw || op.j.position || op.j.trade || op.j); const aId = aRow && (aRow.id || (op.j.raw && op.j.raw.id));
    chk('prod: A opened a BTC long on the server', op.st === 200 && !!aId, op.j && Object.keys(op.j));
    await sleep(2500);
    const jb = await fetch(BASE + '/api/auth/user?uid=' + encodeURIComponent(B) + '&cb=' + Date.now(), { headers: { 'x-admin-key': KEY } }).then(r => r.json()).catch(() => null);
    const bJ = (jb && (jb.journal || (jb.tradeSummary && jb.tradeSummary.journal))) || [];
    const mirror = bJ.find(x => x && x.copy && String(x.copyTid) === String(aId));
    chk('prod: B holds ONE mirrored row - same side and leverage, entry equal to A, margin 50, naming A, src srv', !!mirror && mirror.side === 'long' && +mirror.lev === 5 && +mirror.margin === 50 && mirror.src === 'srv' && Math.abs(+mirror.entry - +aRow.entry) < 1e-9 && mirror.copyName === 'e2e_' + A && bJ.filter(x => x && x.copy).length === 1, mirror && { side: mirror.side, lev: mirror.lev, margin: mirror.margin, entry: mirror.entry, aEntry: aRow.entry, name: mirror.copyName });
    // A closes; B's mirror closes at A's exit
    const cl = await as(A, '/api/trade/close', { method: 'POST', body: JSON.stringify({ id: aId }) });
    chk('prod: A closed the position', cl.st === 200 && cl.j && (cl.j.ok || cl.j.position), cl.j && Object.keys(cl.j));
    await sleep(2500);
    const jb2 = await fetch(BASE + '/api/auth/user?uid=' + encodeURIComponent(B) + '&cb=' + Date.now(), { headers: { 'x-admin-key': KEY } }).then(r => r.json()).catch(() => null);
    const bJ2 = (jb2 && (jb2.journal || (jb2.tradeSummary && jb2.tradeSummary.journal))) || []; const m2 = bJ2.find(x => x && x.copy && String(x.copyTid) === String(aId));
    const aExit = cl.j && ((cl.j.position && (cl.j.position.exit_price || cl.j.position.exit)) || cl.j.exit);
    chk('prod: the mirror is closed by the server (sc) at A exit', !!m2 && (m2.status === 'win' || m2.status === 'loss') && m2.sc === 1 && (aExit == null || Math.abs(+m2.exit - +aExit) < 1e-6), m2 && { st: m2.status, exit: m2.exit, aExit, sc: m2.sc, pnl: m2.pnl });
    const bc = await fetch(BASE + '/api/lb/user?name=e2e_' + B + '&cb=' + Date.now()).then(r => r.json());
    chk('prod: B public card counts none of it (0 season closes, 0 realized)', bc && bc.stats && +bc.stats.closed === 0 && +bc.stats.realized === 0, bc && bc.stats);
    const rep = await as(B, '/api/trade/report?days=7');
    chk('prod: B report counts none of it', rep.j && rep.j.total && +rep.j.total.n === 0, rep.j && rep.j.total);
    await as(B, '/api/lb/copy', { method: 'POST', body: JSON.stringify({ leader: aUid, margin: 0 }) });
    for (const u of [A, B, C, D, E]) await adm({ uid: u, op: 'rm' });
  }
  console.log('\ncopy-e2e: ' + okN + ' passed, ' + failN + ' failed' + (LOCAL ? ' [local]' : '') + (PROD ? ' [+prod]' : ''));
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
