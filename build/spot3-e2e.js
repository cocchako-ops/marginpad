/* DEMO SPOT v3 (2026-10-16, owner: "prostije i pristupacnije ... buy & hold ... svi po 10k ... $100 dnevno koji moraju da se claim
   ... po contract kao i preko liste i screener-a ... jedan leaderboard, $30, prva 3").

   Proven on production, with a throwaway member (POST /api/admin/e2euser) and the admin ?uid= override:
     API:   a fresh account is minted ONLY by /start (a portfolio read answers none:true); it holds exactly $10,000; Claim adds
            $100 once and the second press the same UTC day is refused (429); a major buys at the live price with NO fee (qty x price
            = usd to the cent); a meme from the trending list buys through its pool and the position carries that pool; a 50% sell
            books P&L = proceeds - half the cost; a pool under $1,000 is refused; the ledger lists claim/buy/sell; the season P&L
            excludes the claim (net worth - deposits); the admin board builder ranks the member; /api/spot/board is public JSON.
     Board: /api/reward/lb carries topMeme + boardPrizes.meme [15,10,5]; /api/competition lists the meme board; the archive API
            names meme in boardSince.
     Browser (desktop + phone): guest gate with the sign-in CTA; member: start card -> Start -> mast shows $10,000.00, Claim button
            live, holdings empty; search by contract address resolves a token; Screener tab sorts; opening a coin shows the sheet
            with the chart; the board card lists rows; nothing wider than the viewport, no page errors.
   Cleans up after itself (the member and its Demo Spot rows). Run: node build/spot3-e2e.js */
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
if (!K) { console.error('no mpadm_ token in ADMIN_KEY.local.txt'); process.exit(1); }
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 260) : ''));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const uid = 'e2espot' + Date.now().toString(36);
const J = async (p, init) => { const r = await fetch(ORIGIN + p, init); let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; };
const spot = (p, body) => J('/api/spot' + p + (p.indexOf('?') >= 0 ? '&' : '?') + 'uid=' + uid, body ? { method: 'POST', headers: H, body: JSON.stringify(body) } : { headers: H });

(async () => {
  // ---- PURE: the one valuation function, lifted out of the shipped worker and driven through the 2026-10-17 bug ----
  // A fresh same-pool list row prices; a stale row (19 h) does not; a fresh row for ANOTHER pool of the same mint does not; an
  // unreadable pool falls back to the last mark and says so; a bag can never be worth more than half its pool.
  try {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'worker.js'), 'utf8');
    const grab = (name) => { const i = src.indexOf('async function ' + name + '('); if (i < 0) throw new Error('no ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } throw new Error('unbalanced ' + name); };
    const consts = (src.match(/^const SPOT_LIST_FRESH_MS = [^\n]+/m) || [''])[0] + '\n' + (src.match(/^const SPOT_LIQ_CAP = [^\n]+/m) || [''])[0] + '\nconst SPOT_THIN_LIQ = 1000;';
    const calls = [];
    const F = new Function('spotMemePrice', 'fetchPriceCached', consts + '\n' + grab('spotPriceHolds') + '\nreturn spotPriceHolds;')(
      async (env, net, pool) => { calls.push(pool); return pool === 'POOL-OK' ? { price: 2, liqUsd: 50000 } : pool === 'POOL-THIN' ? { price: 100, liqUsd: 400 } : null; },
      async () => ({ price: 100 }));
    const now = 1000000000000, mk = (pool, extra) => Object.assign({ key: 'eth:0xmint', qty: 1000, costUsd: 10, meta: { k: 'meme', net: 'eth', pool, mint: '0xmint', lastPx: 0.01 } }, extra || {});
    const fresh = { pool: 'POOL-OK', mint: '0xmint', price: 3, liqUsd: 50000, ts: now - 60000 }, stale = { pool: 'POOL-OK', mint: '0xmint', price: 3, liqUsd: 50000, ts: now - 19 * 3600000 }, other = { pool: 'POOL-OTHER', mint: '0xmint', price: 3000, liqUsd: 50000, ts: now - 60000 };
    let h = await F(null, [mk('POOL-OK')], { byPool: { 'pool-ok': fresh }, now });
    chk('pure: a FRESH row for the position\'s own pool prices it, no pool call', h[0].price === 3 && h[0].valueUsd === 3000 && !calls.length, { price: h[0].price, calls: calls.length });
    calls.length = 0; h = await F(null, [mk('POOL-OK')], { byPool: { 'pool-ok': stale }, now });
    chk('pure: a 19-hour-old list row is NOT a price - the pool is read instead', h[0].price === 2 && calls.length === 1, { price: h[0].price, calls: calls.length });
    calls.length = 0; h = await F(null, [mk('POOL-DEAD')], { byPool: { 'pool-other': other }, now });
    chk('pure: a fresh row for ANOTHER pool of the same mint is never used, and an unreadable pool falls back to the last mark, marked stale (the $10 bag stays $10)', h[0].price === 0.01 && h[0].valueUsd === 10 && h[0].stale === true, { price: h[0].price, value: h[0].valueUsd, stale: h[0].stale });
    h = await F(null, [mk('POOL-THIN', { qty: 1000000 })], { byPool: {}, now });
    chk('pure: a bag is worth at most half its pool (1,000,000 x $100 in a $400 pool = $200), and a thin pool is flagged rugged', h[0].valueUsd === 200 && h[0].capped === true && h[0].rugged === true, { value: h[0].valueUsd, capped: h[0].capped, rugged: h[0].rugged });
  } catch (e) { chk('pure: the valuation function could be lifted from the worker and run', false, String(e.message || e)); }

  let sess = null;
  try {
    const mk = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'mk' }) });
    chk('a throwaway member exists', mk.s === 200 && mk.j && (mk.j.ok || mk.j.user), mk.j);
    const none = await spot('/portfolio');
    chk('a portfolio read never mints an account (none:true)', none.s === 200 && none.j && none.j.none === true, none.j);
    const st = await spot('/start', {});
    chk('/start mints the account once', st.s === 200 && st.j && st.j.ok && st.j.fresh === true, st.j);
    const p0 = (await spot('/portfolio')).j;
    chk('a fresh account holds exactly $10,000 of cash, nothing else, claim available', p0 && p0.usdtUsd === 10000 && p0.equityUsd === 10000 && (p0.holds || []).length === 0 && p0.claimedToday === false && p0.depositedUsd === 10000 && p0.allTimePnlUsd === 0 && p0.seasonPnlUsd === 0, { cash: p0 && p0.usdtUsd, eq: p0 && p0.equityUsd, dep: p0 && p0.depositedUsd });
    const c1 = await spot('/claim', {});
    chk('Claim adds $100 of cash and counts as a deposit, not profit', c1.s === 200 && c1.j && c1.j.ok && c1.j.gotUsd === 100 && c1.j.usdtUsd === 10100 && c1.j.depositedUsd === 10100 && c1.j.claims === 1, c1.j);
    const c2 = await spot('/claim', {});
    chk('a second Claim the same UTC day is refused (429 claimed) with the time to midnight', c2.s === 429 && c2.j && c2.j.error === 'claimed' && c2.j.nextClaimMs > 0 && c2.j.nextClaimMs <= 86400000, c2.j);
    const p1 = (await spot('/portfolio')).j;
    chk('after the claim: worth $10,100, all-time P&L still $0, season P&L still $0', p1 && p1.equityUsd === 10100 && p1.allTimePnlUsd === 0 && p1.seasonPnlUsd === 0, { eq: p1 && p1.equityUsd, all: p1 && p1.allTimePnlUsd, s: p1 && p1.seasonPnlUsd });
    // a major, no fee
    const b1 = await spot('/trade', { side: 'buy', kind: 'cex', sym: 'SOL', usd: 1000 });
    chk('a $1,000 SOL buy fills at the live price with no fee (qty x price = $1,000 to the cent)', b1.s === 200 && b1.j && b1.j.ok && b1.j.key === 'cex:SOL' && Math.abs(b1.j.qty * b1.j.price - 1000) < 0.011 && b1.j.usdtUsd === 9100, b1.j);
    // a meme from the trending list
    const memes = ((await J('/api/spot/memes')).j || {}).memes || [];
    const pick = memes.filter(m => +m.liqUsd > 50000 && +m.price > 0).sort((a, b) => b.liqUsd - a.liqUsd)[0];
    chk('the trending meme list is live (100+ coins on four chains)', memes.length >= 100 && !!pick, { n: memes.length, pick: pick && pick.sym });
    let b2 = { j: null };
    if (pick) {
      b2 = await spot('/trade', { side: 'buy', kind: 'meme', mint: pick.mint, pool: pick.pool, net: pick.net, symbol: pick.sym, name: pick.name, logo: pick.logo, usd: 500 });
      chk('a $500 meme buy fills through its pool and the position carries the pool', b2.s === 200 && b2.j && b2.j.ok && b2.j.key === pick.net + ':' + pick.mint && b2.j.qty > 0 && b2.j.usdtUsd === 8600, b2.j && { ok: b2.j.ok, key: b2.j.key, usdt: b2.j.usdtUsd, err: b2.j.error });
      const hd = (await spot('/portfolio')).j;
      const h = hd && (hd.holds || []).find(x => x.key === pick.net + ':' + pick.mint);
      chk('the portfolio prices the meme position from its own pool (meta.pool kept) and states its liquidity', !!h && h.meta && h.meta.pool === pick.pool && h.meta.k === 'meme' && h.price > 0 && h.valueUsd > 0 && h.liqUsd > 0, h && { pool: h.meta.pool === pick.pool, px: h.price, liq: h.liqUsd });
    }
    // a 50% sell books P&L against half the cost
    const p2 = (await spot('/portfolio')).j; const solH = p2 && (p2.holds || []).find(x => x.key === 'cex:SOL');
    const s1 = await spot('/trade', { side: 'sell', kind: 'cex', sym: 'SOL', pct: 50 });
    chk('selling 50% of SOL books proceeds = half qty x price and P&L = proceeds - half the cost, no fee', s1.s === 200 && s1.j && s1.j.ok && solH && Math.abs(s1.j.qty - solH.qty / 2) < 1e-9 && Math.abs(s1.j.usdUsd - s1.j.qty * s1.j.price) < 0.011 && Math.abs(s1.j.pnlUsd - (s1.j.usdUsd - 500)) < 0.011 && s1.j.closed === false, s1.j && { qty: s1.j.qty, usd: s1.j.usdUsd, pnl: s1.j.pnlUsd, closed: s1.j.closed });
    const s2 = await spot('/trade', { side: 'sell', kind: 'cex', sym: 'SOL', pct: 100 });
    chk('selling the rest closes the position exactly (no dust)', s2.s === 200 && s2.j && s2.j.ok && s2.j.closed === true, s2.j && { closed: s2.j.closed, pnl: s2.j.pnlUsd });
    const p3 = (await spot('/portfolio')).j;
    chk('after the round trip SOL is gone, the P&L equals cash - deposits - meme cost (the meme still held), season P&L = all-time P&L for a fresh account', p3 && !(p3.holds || []).some(x => x.key === 'cex:SOL') && Math.abs(p3.allTimePnlUsd - (p3.equityUsd - p3.depositedUsd)) < 0.011 && Math.abs(p3.seasonPnlUsd - p3.allTimePnlUsd) < 0.011, p3 && { eq: p3.equityUsd, dep: p3.depositedUsd, all: p3.allTimePnlUsd, season: p3.seasonPnlUsd, holds: (p3.holds || []).length });
    const bad = await spot('/trade', { side: 'buy', kind: 'cex', sym: 'SOL', usd: 1e9 });
    chk('a buy bigger than the cash is refused with the balance', bad.s === 400 && bad.j && (bad.j.error === 'too_big' || bad.j.error === 'insufficient'), bad.j);
    const nop = await spot('/trade', { side: 'sell', kind: 'cex', sym: 'BTC', pct: 100 });
    chk('selling what you do not hold is refused', nop.s === 400 && nop.j && nop.j.error === 'no_position', nop.j);
    const sides = ['sell', 'SELL', 'Sell'];
    chk('side is read case-insensitively only on exact words (anything else is a buy by the DO contract, so the page never sends anything else)', sides.every(s => s.toLowerCase() === 'sell'));
    const hist = (await spot('/history')).j;
    const kinds = ((hist && hist.tx) || []).map(t => t.side);
    chk('the ledger lists the claim, the buys and the sells, newest first', kinds.length >= 4 && kinds.indexOf('claim') >= 0 && kinds.indexOf('buy') >= 0 && kinds[0] === 'sell', kinds);
    const csv = await fetch(ORIGIN + '/api/spot/history?csv=1&uid=' + uid, { headers: H });
    chk('the ledger exports as CSV', csv.status === 200 && /text\/csv/.test(csv.headers.get('content-type') || '') && /^time,side,symbol/.test(await csv.text()));
    // the board
    const lb = (await J('/api/reward/lb?full=1&nc=1')).j;
    chk('/api/reward/lb carries the Meme Spot board with its prizes [15,10,5] and the paid-from date', lb && Array.isArray(lb.topMeme) && lb.boardPrizes && JSON.stringify((lb.boardPrizes.meme || []).slice(0, 3)) === '[15,10,5]' && lb.memePaidFrom === Date.UTC(2026, 9, 12) && lb.entrants && lb.entrants.meme != null, lb && { rows: (lb.topMeme || []).length, pz: lb.boardPrizes && lb.boardPrizes.meme, from: lb.memePaidFrom });
    const comp = (await J('/api/competition?nc=1')).j;
    const mb = comp && (comp.boards || []).find(b => b.id === 'meme');
    chk('/api/competition lists the Meme Spot board as a free spot board with a $30 pool and what it requires', !!mb && mb.prize_pool_usd === 30 && mb.entry === 'free_spot' && /Demo Spot/.test((mb.requires || {}).what || '') && (comp.boards || []).length === 9, mb && { pool: mb.prize_pool_usd, entry: mb.entry, n: (comp.boards || []).length });
    const pub = (await J('/api/spot/board?cb=' + Date.now())).j;
    chk('/api/spot/board is public JSON: season window, prizes, rows without account ids', pub && pub.ws && pub.we === pub.ws + 14 * 86400000 && Array.isArray(pub.rows) && pub.rows.every(r => r.who && r.uid === undefined && typeof r.pnlUsd === 'number') && JSON.stringify((pub.prizes || []).slice(0, 3)) === '[15,10,5]', pub && { n: pub.n, ts: pub.ts, rows: pub.rows.length });
    const seasons = (await J('/api/reward/seasons?nc=1')).j;
    chk('the season archive knows the Meme Spot board starts with the 2026-10-12 season', seasons && seasons.boardSince && seasons.boardSince.meme === Date.UTC(2026, 9, 12), seasons && seasons.boardSince);
    // the admin roster sees the member with its worth
    sess = (await J('/api/stats/session', { method: 'POST', headers: H })).j;
    const cookie = sess && sess.token ? 'mp_sadm=' + sess.token : '';
    const adm = (await J('/api/admin/spot?nc=1', { headers: { cookie } })).j;
    const me = adm && (adm.accounts || []).find(a => a.uid === uid);
    chk('mp-ops roster lists the member with cash, worth, deposits and claims', !!me && Math.abs(me.cashUsd - p3.usdtUsd) < 0.011 && me.claims === 1 && me.depUsd === 10100 && me.holdN === (p3.holds || []).length, me && { cash: me.cashUsd, eq: me.equity, dep: me.depUsd, claims: me.claims, holdN: me.holdN });

    // ---- THE BOARD IS THE PORTFOLIO (2026-10-17): on 2026-10-17 the board's key-level pricing valued a $10 bag at $35,290 off a
    // stale trending-list row for another pool of the same mint, while the portfolio held it at cost. The board now re-values its
    // prize zone position by position through the portfolio's own function and says so; these checks go red the day the two
    // paths disagree again, or the day the self-check stops running.
    chk('the board self-check ran over the prize zone (checked >= min(12, n)) and corrected nothing on a normal day', pub && pub.checked >= Math.min(12, pub.n || 0) && pub.corrected === 0, pub && { checked: pub.checked, corrected: pub.corrected, n: pub.n });
    chk('the board is sorted by season P&L, every name once', pub && pub.rows.every((r, i) => i === 0 || r.pnlUsd <= pub.rows[i - 1].pnlUsd) && new Set(pub.rows.map(r => r.who)).size === pub.rows.length, pub && pub.rows.slice(0, 4).map(r => r.who + ':' + r.pnlUsd));
    { const byName = {}; for (const a of (adm && adm.accounts) || []) byName[String(a.name).toLowerCase()] = a.uid;
      const diffs = []; let compared = 0, skipped = 0;
      for (const r of (pub ? pub.rows : []).slice(0, 10)) {
        const ru = byName[String(r.who).toLowerCase()]; if (!ru) { diffs.push(r.who + ':no-uid'); continue; }
        const pp = (await J('/api/spot/public?uid=' + ru + '&cb=' + Date.now())).j;
        if (!pp || pp.none) { diffs.push(r.who + ':no-public'); continue; }
        // a card holding a STALE bag (pool unreadable at that moment, GeckoTerminal 429s our egress) is priced from the last mark and
        // cannot be compared to a board built minutes earlier from a live read - the self-check inside the build is the strict one
        // ... and a RUGGED bag (pool under $1k) is worth half a vanishing pool - a figure that moves faster than a ten-minute board
        if ((pp.holds || []).some(h => h.stale || h.rugged)) { skipped++; continue; }
        compared++;
        if (Math.abs(pp.equityUsd - r.equityUsd) > Math.max(15, Math.abs(r.equityUsd) * 0.02)) diffs.push(r.who + ': board $' + r.equityUsd + ' vs card $' + pp.equityUsd);
      }
      chk('every comparable top-10 board row is worth what its own public portfolio says (within 2% / $15; rows with a stale bag skipped: ' + skipped + ')', diffs.length === 0 && compared >= Math.min(3, (pub ? pub.rows : []).length), { diffs, compared, skipped }); }

    // ---- the social layer (2026-10-16): the floor, the public portfolio, theses ----
    const feed = (await J('/api/spot/feed?cb=' + Date.now())).j;
    chk('the floor feed is public JSON: rows by name with side/coin/usd/time, no account ids, plus what is hot today', !!feed && Array.isArray(feed.rows) && feed.rows.every(r => r.who && (r.side === 'buy' || r.side === 'sell') && r.sym && r.usdUsd > 0 && r.ts > 0 && r.uid === undefined) && feed.rows.every(r => !/^e2e_/i.test(r.who)) && Array.isArray(feed.hot), feed && { rows: feed.rows.length, hot: feed.hot.length, first: feed.rows[0] });
    const pubP = (await J('/api/spot/public?uid=' + uid)).j;
    chk('/api/spot/public prices a member\'s holdings for the profile card: worth, season P&L, the coins with their share - no cash figure, no quantity', !!pubP && pubP.equityUsd > 0 && Array.isArray(pubP.holds) && pubP.holds.length === (p3.holds || []).length && pubP.holds.every(h => h.sym && h.valueUsd > 0 && h.share >= 0 && h.qty === undefined) && pubP.usdtUsd === undefined && Math.abs(pubP.holds.reduce((s, h) => s + h.share, 0) - 100) <= pubP.holds.length, pubP && { eq: pubP.equityUsd, holds: pubP.holds.map(h => h.sym + ' ' + h.share + '%') });
    const noP = (await J('/api/spot/public?uid=nobody_' + Date.now().toString(36))).j;
    chk('/api/spot/public answers none for an account that does not exist', !!noP && noP.none === true, noP);
    // ---- browser ----
    const tok = (await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'sess' }) })).j;
    chk('a member session can be minted for the browser legs', !!(tok && tok.token), tok && Object.keys(tok));
    const thShort = await fetch(ORIGIN + '/api/comm/post', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + tok.token }, body: JSON.stringify({ title: 'E2E thesis that is far too short', body: 'SOL up only.', cat: 'thesis', syms: 'SOL' }) });
    chk('a thesis under 500 characters is refused (body_short), nothing paid', thShort.status === 400 && /body_short/.test(await thShort.text()));
    const thesisBody = ('I hold SOL on Demo Spot because the trend on the daily chart is still up and every pullback to the twenty day average has been bought for six weeks. The thesis is simple: as long as price holds above the last swing low I stay in, and if it closes a daily candle below it I am wrong and I sell the position whole. The level that proves me wrong is the one marked on my chart, not a feeling. I am sizing this at fifteen percent of the account so a loss there costs about two percent of the portfolio. ').repeat(2).trim();
    const thR = await fetch(ORIGIN + '/api/comm/post', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + tok.token }, body: JSON.stringify({ title: 'E2E thesis: why this demo account holds SOL this season', body: thesisBody, cat: 'thesis', syms: 'SOL' }) });
    const thJ = await thR.json().catch(() => null);
    chk('a thesis publishes as a Community post in the thesis category and pays 20 XP + 5 Ticks (the reward rides on the response)', thR.status === 200 && thJ && thJ.ok && thJ.id && thJ.reward && thJ.reward.xp === 20 && thJ.reward.ticks === 5, thJ);
    const thList = (await J('/api/spot/theses?cb=' + Date.now())).j;
    chk('/api/spot/theses lists the newest five by title/author/coins/excerpt with the blog section as "more" - an e2e author never appears there', !!thList && Array.isArray(thList.rows) && thList.rows.length <= 5 && thList.more === '/blog/theses/' && thList.rows.every(r => r.id && r.title && r.author && !/^e2e_/i.test(r.author)), thList && { n: thList.rows.length });
    const bt = await fetch(ORIGIN + '/blog/theses/?nc=1&cb=' + Date.now()); const btH = await bt.text();
    chk('/blog/theses/ is a server-rendered blog section: 200, indexable, CollectionPage JSON-LD, the write-your-own call to Demo Spot', bt.status === 200 && bt.headers.get('x-mp-ssr') === 'blog-theses' && /index, follow/.test(btH) && /"@type":"CollectionPage"/.test(btH) && /href="\/spot\/#thesis"/.test(btH));
    await withBrowser(async (browser) => {
      for (const vp of [{ w: 1366, h: 900, t: 'desktop' }, { w: 390, h: 800, t: 'phone' }]) {
        const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
        await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w < 500, hasTouch: vp.w < 500 });
        const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
        // guest
        await page.goto(ORIGIN + '/spot/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
        await page.waitForSelector('#gate:not([hidden])', { timeout: 20000 }).catch(() => {});
        const g = await page.evaluate(() => { const b = document.getElementById('gateBtn'); const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { gate: !document.getElementById('gate').hidden, app: document.getElementById('app').hidden, cta: b.textContent.trim(), auth: b.hasAttribute('data-auth-open'), reach: !!(el && (el === b || b.contains(el))), h1: (document.querySelector('#gate h1') || {}).textContent, sx: document.documentElement.scrollWidth > window.innerWidth, facts: document.querySelectorAll('.fact').length }; });
        chk(vp.t + ': a guest meets the gate - $10,000 / $100 a day / $30 in the headline, three facts, a reachable sign-in CTA, no sideways scroll', g.gate && g.app && /Sign in/.test(g.cta) && g.auth && g.reach && /\$10,000/.test(g.h1) && /\$100/.test(g.h1) && /\$30/.test(g.h1) && g.facts === 3 && !g.sx, g);
        // member with no account yet -> Start -> app
        await page.setCookie({ name: 'mp_sess', value: tok.token, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
        // the browser member is the SAME throwaway account, which already has an account from the API legs - so the app opens straight away
        await page.goto(ORIGIN + '/spot/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
        await page.waitForFunction("!document.getElementById('app').hidden && /\\$/.test(document.getElementById('mWorth').textContent)", { timeout: 25000 }).catch(() => {});
        const a = await page.evaluate(() => { const cb = document.getElementById('claimBtn'); const r = cb.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { app: !document.getElementById('app').hidden, worth: document.getElementById('mWorth').textContent, cash: document.getElementById('mCash').textContent, claim: cb.textContent.trim(), claimDisabled: cb.disabled, claimReach: !!(el && (el === cb || cb.contains(el))), holds: document.querySelectorAll('#holdRows .row').length, boardRows: document.querySelectorAll('#bRows .brow').length, pz: document.querySelectorAll('#bPz span').length, sx: document.documentElement.scrollWidth > window.innerWidth }; });
        chk(vp.t + ': the member sees the app - worth and cash printed, Claim already used today (a small button, disabled with the countdown), the meme position listed, no sideways scroll', a.app && /^\$[\d,]+\.\d\d$/.test(a.worth) && /^\$[\d,]+\.\d\d$/.test(a.cash) && a.claimDisabled && /Claimed/.test(a.claim) && a.claimReach && a.holds === (p3.holds || []).length && !a.sx, a);
        await page.waitForFunction("document.querySelectorAll('#floorRows .frow').length>0 || /Quiet/.test(document.getElementById('floorRows').textContent)", { timeout: 20000 }).catch(() => {});
        const fl = await page.evaluate(() => { const rows = [...document.querySelectorAll('#floorRows .frow')]; const r0 = rows[0]; const names = rows.map(r => (r.querySelector('[data-lbu]') || {}).textContent); return { rows: rows.length, hot: document.querySelectorAll('#hotRow .hchip').length, named: names.every(Boolean), noBoard: !document.querySelector('#bRows'), theses: !!document.getElementById('thesisCard'), write: !!document.getElementById('thWrite'), sx: document.documentElement.scrollWidth > window.innerWidth, first: r0 ? r0.textContent.replace(/\s+/g, ' ').slice(0, 80) : '' }; });
        chk(vp.t + ': the floor lists real members\' moves by name with hot-today chips, the board card is gone, the theses card with Write a thesis is on the page, nothing wider than the screen', fl.rows > 0 && fl.named && fl.noBoard && fl.theses && fl.write && !fl.sx, fl);
        // the profile card: the four actions sit together in the foot row, Portfolio opens the public holdings panel
        await page.evaluate(() => { const a = document.querySelector('#floorRows [data-lbu]'); if (a) a.click(); });
        await page.waitForSelector('.lbm.on .lbm-port', { timeout: 20000 }).catch(() => {});
        await page.evaluate(() => { const b = document.querySelector('.lbm.on .lbm-port'); if (b) b.click(); });
        await page.waitForFunction("document.getElementById('lbmPortP') && !document.getElementById('lbmPortP').hidden && document.getElementById('lbmPortP').textContent.length>20", { timeout: 20000 }).catch(() => {});
        const pc = await page.evaluate(() => { const f = document.querySelector('.lbm.on .lbm-folb'), x = document.querySelector('.lbm.on .lbm-x'), p = document.querySelector('.lbm.on .lbm-port'); const fr = f && f.getBoundingClientRect(), xr = x && x.getBoundingClientRect(); const pp = document.getElementById('lbmPortP'); return { card: !!document.querySelector('.lbm.on'), folb: !!f, nearX: fr && xr ? (fr.top - xr.top) > 40 : false, /* 2026-10-17: Follow LEFT the corner beside the close - all four actions (Portfolio, Follow, message, duel) are one row of equal tiles in the foot now, so "beside the close" became "well below it" */ legacy: !!document.querySelector('.lbm.on .lbm-follow'), port: !!p, panel: pp && !pp.hidden && /Demo Spot/.test(pp.textContent) && /\$/.test(pp.textContent), inView: p ? (p.getBoundingClientRect().bottom <= window.innerHeight + 1) : false }; });
        chk(vp.t + ': a name on the floor opens the profile card - Follow is an icon in the action row (not beside the close), the old Follow button is gone, Portfolio opens the Demo Spot panel', pc.card && pc.folb && pc.nearX && !pc.legacy && pc.port && pc.panel, pc);
        await page.evaluate(() => { if (window.mpCloseProfile) window.mpCloseProfile(); });
        await page.waitForFunction("!document.querySelector('.lbm') || getComputedStyle(document.querySelector('.lbm')).display === 'none'", { timeout: 5000 }).catch(() => {});
        await page.evaluate(() => window.scrollTo(0, 0));
        // search by contract address
        if (pick) {
          await page.type('#q', pick.mint);
          await page.waitForFunction("document.querySelector('#tokRes [data-tok]')", { timeout: 20000 }).catch(() => {});
          const t = await page.evaluate(() => { const r = document.querySelector('#tokRes [data-tok]'); return { found: !!r, txt: r ? r.textContent.replace(/\s+/g, ' ').slice(0, 80) : (document.getElementById('tokRes') || {}).textContent }; });
          chk(vp.t + ': pasting a contract address resolves the token with its liquidity', t.found && new RegExp(pick.sym.replace(/[^A-Za-z0-9]/g, '')).test(t.txt.replace(/[^A-Za-z0-9 ]/g, '')), t);
          await page.evaluate(() => { const r = document.querySelector('#tokRes [data-tok]'); r.scrollIntoView({ block: 'center' }); r.click(); });
          await page.waitForFunction("document.getElementById('sheet').classList.contains('on')", { timeout: 10000 }).catch(() => {});
          await page.waitForFunction("document.getElementById('chartMsg').hidden || /No chart|failed/.test(document.getElementById('chartMsg').textContent)", { timeout: 25000 }).catch(() => {});
          const sh = await page.evaluate(() => { const s = document.getElementById('sheet'); const r = s.getBoundingClientRect(); return { on: s.classList.contains('on'), name: document.getElementById('shName').textContent, px: document.getElementById('shPx').textContent, chart: document.getElementById('chartMsg').hidden, canvas: !!document.querySelector('#chart canvas'), sell: document.getElementById('swSell').style.display !== 'none', inView: r.top >= 0 && r.bottom <= window.innerHeight + 1, go: document.getElementById('go').textContent }; });
          chk(vp.t + ': the trade sheet opens on the token - name, price, a drawn chart, Sell offered because it is held, inside the viewport', sh.on && sh.name === pick.sym && /^\$/.test(sh.px) && sh.chart && sh.canvas && sh.sell && sh.inView && /Buy/.test(sh.go), sh);
          /* THE PAGE IS A TERMINAL SINCE 2026-10-24: the trade sheet is the permanent centre stage, so there
             is no close button to click (#shX is hidden) and nothing to close. This check is the design
             itself - three columns at once on a desktop, one at a time with a six-cell dock on a phone, the
             site's own bottom bar absorbed into that dock rather than hidden underneath it, and the page
             never scrolling. If the stage ever goes back to being a modal, these go red. */
          const tm = await page.evaluate(() => {
            const s = document.getElementById('sheet'), d = document.getElementById('spotDock'), x = document.getElementById('shX');
            const term = document.getElementById('spotTerm');
            const bn = document.querySelector('nav.mpbn');
            return { term: !!term, pos: getComputedStyle(s).position,
              // ask whether it RENDERS: its own computed display is unchanged when an ancestor is hidden
              xHidden: x ? !x.getClientRects().length : true,
              cols: term ? Array.prototype.filter.call(term.children, function (c) { return getComputedStyle(c).display !== 'none'; }).length : 0,
              dockCells: d ? d.children.length : 0, dockShown: d ? getComputedStyle(d).display !== 'none' : false,
              headSym: (document.getElementById('tSym') || {}).textContent,
              chartInStage: !!document.querySelector('#sheet #chart canvas'),
              mpbn: bn ? getComputedStyle(bn).display : 'absent',
              pageScroll: document.documentElement.scrollHeight - window.innerHeight };
          });
          chk(vp.t + ': the terminal IS the page - the stage is static with the chart inside it, the sheet has no close button, '
            + (vp.w > 999 ? 'three columns stand at once' : 'one column at a time with a six-cell dock and no second bottom bar under it')
            + ', and the page itself does not scroll',
            tm.term && tm.pos === 'static' && tm.xHidden && tm.chartInStage && tm.headSym === pick.sym && tm.pageScroll <= 2
            && (vp.w > 999 ? (tm.cols === 3 && !tm.dockShown) : (tm.cols === 1 && tm.dockShown && tm.dockCells === 6 && tm.mpbn === 'none')), tm);
          /* THE STAGE MUST SURVIVE EVERY WAY THE OLD MODAL COULD BE CLOSED. closeSheet() destroys the chart
             and only a fresh pick rebuilds it, so Escape and the overlay are intercepted - and the thesis
             modal, which shares that same overlay, must still close by both. */
          if (vp.w > 999) {
            const live = () => page.evaluate(() => ({ chart: !!document.querySelector('#chart canvas'), on: document.getElementById('sheet').classList.contains('on'), sym: (document.getElementById('tSym') || {}).textContent }));
            await page.keyboard.press('Escape'); await sleep(500);
            const k1 = await live();
            await page.evaluate(() => document.getElementById('ov').click()); await sleep(500);
            const k2 = await live();
            chk(vp.t + ': neither Escape nor a click on the overlay closes the stage - the chart stays drawn', k1.chart && k1.on && k2.chart && k2.on && k2.sym === pick.sym, { k1, k2 });
            await page.evaluate(() => { const w = document.getElementById('thWrite'); if (w) w.click(); }); await sleep(700);
            const th1 = await page.evaluate(() => ({ th: document.getElementById('thSheet').classList.contains('on'), ov: getComputedStyle(document.getElementById('ov')).display !== 'none' }));
            await page.keyboard.press('Escape'); await sleep(600);
            const th2 = await page.evaluate(() => ({ th: document.getElementById('thSheet').classList.contains('on'), ov: getComputedStyle(document.getElementById('ov')).display !== 'none' }));
            const k3 = await live();
            chk(vp.t + ': the thesis modal still dims the page and still closes on Escape, and the stage is untouched by it', th1.th && th1.ov && !th2.th && !th2.ov && k3.chart && k3.on, { th1, th2, k3 });
          }
          // back to the market: on a phone the pick moved the dock onto the chart
          await page.evaluate(() => { if (window.__mpSpotTerm) window.__mpSpotTerm.show('market'); else { const x = document.getElementById('shX'); if (x) x.click(); } });
          await page.evaluate(() => { const q = document.getElementById('q'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); });
        }
        // screener sorts
        await page.evaluate(() => { document.querySelector('[data-tab="screener"]').click(); });
        await page.waitForFunction("document.querySelectorAll('#scrBody tr.r').length > 10", { timeout: 15000 }).catch(() => {});
        const sc = await page.evaluate(() => { const vols = [...document.querySelectorAll('#scrBody tr.r td:nth-child(4)')].slice(0, 8).map(td => td.textContent); document.querySelector('#scrHead th[data-k="chg24"]').click(); const chgs = [...document.querySelectorAll('#scrBody tr.r td:nth-child(3)')].slice(0, 8).map(td => parseFloat(td.textContent.replace('%', ''))); const tw = document.getElementById('scrWrap'); return { rows: document.querySelectorAll('#scrBody tr.r').length, vols, chgDesc: chgs.every((v, i, a) => i === 0 || a[i - 1] >= v), sx: document.documentElement.scrollWidth > window.innerWidth, boxScrolls: tw.scrollWidth > tw.clientWidth }; });
        chk(vp.t + ': the Screener lists the memes as a table, sorts by 24h change on a header tap, and scrolls inside its own box - never the page', sc.rows > 10 && sc.chgDesc && !sc.sx && (vp.w > 600 || sc.boxScrolls), sc);
        chk(vp.t + ': no page errors', errs.length === 0, errs);
        await page.screenshot({ path: path.join(__dirname, 'vault-shots', 'spot3-' + vp.t + '.png') });
        await ctx.close();
      }
    });
  } catch (e) { chk('run completed without throwing', false, String(e && e.stack || e).slice(0, 300)); }
  finally {
    const rm = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'rm' }) });
    const gone = await spot('/portfolio');
    chk('cleanup: the member is removed and its Demo Spot account with it (a portfolio read answers none)', rm.s === 200 && gone.j && (gone.j.none === true || gone.j.error), { rm: rm.s, after: gone.j });
  }
  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})();
