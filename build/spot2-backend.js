/* DEMO SPOT v3 BACKEND (2026-10-16, owner: "spot pretvorimo u nesto prostije i pristupacnije, da lakse mogu da trejduju
   meme coin-e i da imaju svi po 10k u pocetku (reset) i dobija se $100 dnevno koji moraju da se claim ... samo buy & hold ...
   po contract kao i preko liste i screener-a ... jedan leaderboard ... prize pool od $30 i samo prva 3 dobijaju").

   One-shot patcher over src/worker.js. It REPLACES, by marker, three regions:
     1. the SpotStore DO routes between `/portfolio` and `/export` (card, on-ramp, wallet, swap, P2P chain, limit orders,
        lifeline, reset, bank board) with the v3 routes under /s2/*;  the old tables stay in the DB and in the backup,
        nothing reads them;
     2. the worker's handleSpot ... spotDailyLine block with handleSpot v3 + the daily mark + the season board builder;
     3. the stuck-wallet nudge and the limit-order sweep crons, and the admin test hooks that served the old shape.
   Refuses unless every marker is found exactly once. Writes to a .tmp and renames. Idempotent (the v3 marker). */
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, '..', 'src', 'worker.js');
let h = fs.readFileSync(F, 'utf8');
if (h.indexOf("path === '/s2/portfolio'") >= 0) { console.log('already v3'); process.exit(0); }
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const once = (s, nm) => { const n = h.split(s).length - 1; if (n !== 1) { console.error('marker ' + nm + ' matched ' + n + ' - refusing'); process.exit(1); } return h.indexOf(s); };
const cut = (a, b, repl, nm) => { const i0 = once(a, nm + ' start'), i1 = h.indexOf(b, i0 + a.length); if (!(i1 > i0)) { console.error(nm + ': end marker not found after start'); process.exit(1); } h = h.slice(0, i0) + repl + h.slice(i1); }; // the start is unique; the end is the FIRST match after it (several DO classes share method names)
const J = (s) => s.split('\n').join(N);

/* ---------------------------------------------------------------- 1. the DO ---------------------------------------------------------------- */
const DO_TABLES = J(`    try { s.exec('CREATE INDEX IF NOT EXISTS spo_u ON spotorder(user_id, status)'); s.exec('CREATE INDEX IF NOT EXISTS spo_s ON spotorder(status)'); } catch (e) {}
    // v3 (2026-10-16, owner: "nesto prostije i pristupacnije ... buy & hold ... svi po 10k ... $100 dnevno koji moraju da se
    // claim"): ONE cash balance, holdings, a ledger and a daily mark. Every account starts again at $10,000. The v1/v2
    // tables above (card, wallet, gas, chain, orders) stay in the database and in the nightly backup; nothing reads them.
    s.exec("CREATE TABLE IF NOT EXISTS sp2acct(user_id TEXT PRIMARY KEY, usdt INTEGER, created INTEGER, claims INTEGER DEFAULT 0, claim_day TEXT DEFAULT '', realized INTEGER DEFAULT 0, last_seen INTEGER DEFAULT 0, buys INTEGER DEFAULT 0, sells INTEGER DEFAULT 0)");
    s.exec('CREATE TABLE IF NOT EXISTS sp2hold(user_id TEXT, key TEXT, qty REAL, cost INTEGER, meta TEXT, updated INTEGER, PRIMARY KEY(user_id,key))');
    s.exec('CREATE TABLE IF NOT EXISTS sp2tx(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, ts INTEGER, side TEXT, key TEXT, qty REAL, price REAL, usd INTEGER, pnl INTEGER, meta TEXT)');
    try { s.exec('CREATE INDEX IF NOT EXISTS sp2tx_u ON sp2tx(user_id, ts)'); } catch (e) {}
    s.exec('CREATE TABLE IF NOT EXISTS sp2snap(user_id TEXT, day TEXT, value INTEGER, dep INTEGER, PRIMARY KEY(user_id,day))');
  }`);
cut(`    try { s.exec('CREATE INDEX IF NOT EXISTS spo_u ON spotorder(user_id, status)'); s.exec('CREATE INDEX IF NOT EXISTS spo_s ON spotorder(status)'); } catch (e) {}
  }`.split('\n').join(N), [`  j(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } }); }`, `  rows(q, ...b) { return this.state.storage.sql.exec(q, ...b).toArray(); }`, `  _acct(uid, now) {`].join(N), DO_TABLES + N, 'DO tables');

const DO_HELPERS = J(`  _acct2(uid, now, create) { // get, or create on the ONE path that mints an account (/s2/portfolio?create=1 from the Start button)
    let a = this.rows('SELECT * FROM sp2acct WHERE user_id=?', uid)[0];
    if (!a && create) { this.state.storage.sql.exec('INSERT INTO sp2acct(user_id,usdt,created,last_seen) VALUES(?,?,?,?)', uid, SP2_START_C, now, now); a = this.rows('SELECT * FROM sp2acct WHERE user_id=?', uid)[0]; a._fresh = true; }
    return a || null;
  }
  _day(ms) { return new Date(ms).toISOString().slice(0, 10); }
  _dep(a) { return SP2_START_C + SP2_CLAIM_C * (+a.claims || 0); } // everything the house ever put in: the start plus every claimed day - P&L is measured against THIS, so claiming cannot climb the board
  _nextMidnight(now) { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now; }
  async fetch(request) {`);
cut(`  _acct(uid, now) { // get-or-create: v2 accounts are born with $10,000 ON THE CARD (the sim starts at "money in the bank")`, `  async fetch(request) {`, DO_HELPERS, 'DO helpers');

const DO_ROUTES = J(`    if (path === '/s2/portfolio') {
      if (!uid) return this.j({ error: 'bad' }, 400);
      const a = this._acct2(uid, now, url.searchParams.get('create') === '1');
      if (!a) return this.j({ none: true });
      sql.exec('UPDATE sp2acct SET last_seen=? WHERE user_id=?', now, uid);
      const holds = this.rows('SELECT key,qty,cost,meta FROM sp2hold WHERE user_id=? AND qty>0', uid).map(x => { let m = {}; try { m = JSON.parse(x.meta || '{}'); } catch (e) {} return { key: x.key, qty: x.qty, costUsd: x.cost / 100, meta: m }; });
      const snaps = this.rows('SELECT day,value,dep FROM sp2snap WHERE user_id=? ORDER BY day DESC LIMIT 60', uid).reverse().map(r => ({ day: r.day, valueUsd: r.value / 100, depUsd: (r.dep || 0) / 100 }));
      const day = this._day(now);
      return this.j({ fresh: !!a._fresh, usdtUsd: a.usdt / 100, created: a.created, claims: +a.claims || 0, claimedToday: String(a.claim_day || '') === day, nextClaimMs: this._nextMidnight(now), claimUsd: SP2_CLAIM_C / 100, depositedUsd: this._dep(a) / 100, realizedUsd: (a.realized || 0) / 100, holds, snaps, txN: (+a.buys || 0) + (+a.sells || 0), buys: +a.buys || 0, sells: +a.sells || 0 });
    }
    if (path === '/s2/claim') { // $100 of demo cash, once per UTC day, for anyone with an account - it has to be pressed (owner: "moraju da se claim")
      if (!uid) return this.j({ error: 'bad' }, 400);
      const a = this._acct2(uid, now, false); if (!a) return this.j({ none: true }, 404);
      const day = this._day(now), nextMs = this._nextMidnight(now);
      if (String(a.claim_day || '') === day) return this.j({ error: 'claimed', nextClaimMs: nextMs }, 429);
      sql.exec('UPDATE sp2acct SET usdt=usdt+?, claims=COALESCE(claims,0)+1, claim_day=?, last_seen=? WHERE user_id=?', SP2_CLAIM_C, day, now, uid);
      sql.exec("INSERT INTO sp2tx(user_id,ts,side,key,qty,price,usd,pnl,meta) VALUES(?,?,'claim','USD',0,0,?,0,'{}')", uid, now, SP2_CLAIM_C);
      const a2 = this.rows('SELECT usdt,claims FROM sp2acct WHERE user_id=?', uid)[0];
      return this.j({ ok: true, gotUsd: SP2_CLAIM_C / 100, usdtUsd: a2.usdt / 100, claims: +a2.claims || 0, claimedToday: true, nextClaimMs: nextMs, depositedUsd: this._dep(a2) / 100 });
    }
    if (path === '/s2/trade') { // the atomic ledger step: the worker decided the price (pool or exchange), this moves the money. No fee, no slippage (owner 2026-10-16).
      const side = b.side === 'sell' ? 'sell' : 'buy', key = String(b.key || '').slice(0, 80), price = +b.price;
      if (!uid || !key || !(price > 0) || !isFinite(price)) return this.j({ error: 'bad' }, 400);
      const a = this._acct2(uid, now, false); if (!a) return this.j({ none: true }, 404);
      if (side === 'buy') {
        const usdC = Math.round(+b.usdC || 0);
        if (usdC < 100) return this.j({ error: 'min_trade', minUsd: 1 }, 400);
        if (usdC > a.usdt) return this.j({ error: 'insufficient', usdtUsd: a.usdt / 100 }, 400);
        const qty = (usdC / 100) / price;
        if (!(qty > 0) || !isFinite(qty)) return this.j({ error: 'bad' }, 400);
        const hld = this.rows('SELECT qty,cost,meta FROM sp2hold WHERE user_id=? AND key=?', uid, key)[0];
        let stored = {}; try { stored = JSON.parse((hld && hld.meta) || '{}') || {}; } catch (e) {}
        // the POSITION keeps the pool it was first bought through (that pool prices every later sale - the 2026-09-06 rule); the newest mark always updates
        const meta = JSON.stringify(Object.assign({}, (b.meta && typeof b.meta === 'object') ? b.meta : {}, stored, { lastPx: price }));
        sql.exec('UPDATE sp2acct SET usdt=usdt-?, buys=COALESCE(buys,0)+1, last_seen=? WHERE user_id=?', usdC, now, uid);
        if (hld) sql.exec('UPDATE sp2hold SET qty=qty+?, cost=cost+?, meta=?, updated=? WHERE user_id=? AND key=?', qty, usdC, meta, now, uid, key);
        else sql.exec('INSERT INTO sp2hold(user_id,key,qty,cost,meta,updated) VALUES(?,?,?,?,?,?)', uid, key, qty, usdC, meta, now);
        sql.exec("INSERT INTO sp2tx(user_id,ts,side,key,qty,price,usd,pnl,meta) VALUES(?,?,'buy',?,?,?,?,0,?)", uid, now, key, qty, price, usdC, meta);
        const a2 = this.rows('SELECT usdt FROM sp2acct WHERE user_id=?', uid)[0];
        const h2 = this.rows('SELECT qty,cost FROM sp2hold WHERE user_id=? AND key=?', uid, key)[0] || { qty, cost: usdC };
        return this.j({ ok: true, side: 'buy', key, qty, price, usdUsd: usdC / 100, usdtUsd: a2.usdt / 100, holdQty: h2.qty, holdCostUsd: h2.cost / 100 });
      }
      const hld = this.rows('SELECT qty,cost,meta FROM sp2hold WHERE user_id=? AND key=?', uid, key)[0];
      if (!hld || !(hld.qty > 0)) return this.j({ error: 'no_position' }, 400);
      let qty = +b.qty; const pct = +b.pct;
      if (isFinite(pct) && pct > 0) qty = pct >= 100 ? hld.qty : hld.qty * Math.min(100, pct) / 100; // 100% sells the EXACT stored qty - no float dust left behind
      if (!(qty > 0) || !isFinite(qty)) return this.j({ error: 'bad' }, 400);
      if (qty > hld.qty * 1.0000001) return this.j({ error: 'too_much', have: hld.qty }, 400);
      qty = Math.min(qty, hld.qty);
      const grossC = Math.round(qty * price * 100);
      if (grossC < 1) return this.j({ error: 'dust' }, 400);
      const costPart = Math.round(hld.cost * (qty / hld.qty)), pnlC = grossC - costPart, left = hld.qty - qty, closed = left <= hld.qty * 1e-9;
      if (closed) sql.exec('DELETE FROM sp2hold WHERE user_id=? AND key=?', uid, key);
      else sql.exec('UPDATE sp2hold SET qty=?, cost=?, updated=? WHERE user_id=? AND key=?', left, Math.max(0, hld.cost - costPart), now, uid, key);
      sql.exec('UPDATE sp2acct SET usdt=usdt+?, realized=COALESCE(realized,0)+?, sells=COALESCE(sells,0)+1, last_seen=? WHERE user_id=?', grossC, pnlC, now, uid);
      sql.exec("INSERT INTO sp2tx(user_id,ts,side,key,qty,price,usd,pnl,meta) VALUES(?,?,'sell',?,?,?,?,?,?)", uid, now, key, qty, price, grossC, pnlC, hld.meta || '{}');
      const a3 = this.rows('SELECT usdt,realized FROM sp2acct WHERE user_id=?', uid)[0];
      return this.j({ ok: true, side: 'sell', key, qty, price, usdUsd: grossC / 100, pnlUsd: pnlC / 100, costUsd: costPart / 100, usdtUsd: a3.usdt / 100, realizedUsd: (a3.realized || 0) / 100, closed });
    }
    if (path === '/s2/hold') { // worker sell path: exact stored qty + the position's own meta (pool/net/lastPx price the sale)
      const key = String(url.searchParams.get('key') || '');
      const x = this.rows('SELECT qty,cost,meta FROM sp2hold WHERE user_id=? AND key=?', uid, key)[0];
      let m = {}; try { m = JSON.parse((x && x.meta) || '{}') || {}; } catch (e) {}
      return this.j(x ? { qty: x.qty, costUsd: x.cost / 100, meta: m } : { qty: 0 });
    }
    if (path === '/s2/tx') {
      if (!uid) return this.j({ error: 'bad' }, 400);
      const list = this.rows('SELECT ts,side,key,qty,price,usd,pnl,meta FROM sp2tx WHERE user_id=? ORDER BY ts DESC LIMIT 150', uid)
        .map(t => { let m = {}; try { m = JSON.parse(t.meta || '{}'); } catch (e) {} return { ts: t.ts, side: t.side, key: t.key, qty: t.qty, price: t.price, usdUsd: t.usd / 100, pnlUsd: (t.pnl || 0) / 100, sym: m.sym || String(t.key || '').replace(/^cex:/, ''), name: m.name || '', logo: m.logo || '', net: m.net || '' }; });
      return this.j({ tx: list });
    }
    if (path === '/s2/allsyms') { // the pricing crons: every distinct held key + one meta sample (net/pool for a meme, sym for a major)
      const out = {}; this.rows('SELECT key, meta FROM sp2hold WHERE qty>0 GROUP BY key').forEach(r => { let m = {}; try { m = JSON.parse(r.meta || '{}'); } catch (e) {} out[r.key] = { k: m.k || 'cex', net: m.net || '', pool: m.pool || '', mint: m.mint || '', sym: m.sym || String(r.key).replace(/^cex:/, ''), lastPx: +m.lastPx || 0 }; });
      return this.j({ syms: out });
    }
    if (path === '/s2/snapshot-all') { // cron, once a day after 00:00 UTC: {day, prices:{key:px}} -> each account's start-of-day worth AND what the house had put in by then
      const day = String(b.day || '').slice(0, 10), prices = (b.prices && typeof b.prices === 'object') ? b.prices : {};
      if (!day) return this.j({ error: 'bad' }, 400);
      const accts = this.rows('SELECT user_id, usdt, claims FROM sp2acct');
      const holds = this.rows('SELECT user_id, key, qty, meta FROM sp2hold WHERE qty>0');
      const byU = {}; for (const x of holds) { (byU[x.user_id] = byU[x.user_id] || []).push(x); }
      let n = 0;
      for (const a of accts) {
        let v = a.usdt || 0;
        for (const x of (byU[a.user_id] || [])) { let px = +prices[x.key] || 0; if (!(px > 0)) { try { px = +(JSON.parse(x.meta || '{}').lastPx) || 0; } catch (e) {} } v += Math.round(x.qty * px * 100); }
        sql.exec('INSERT INTO sp2snap(user_id,day,value,dep) VALUES(?,?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET value=excluded.value, dep=excluded.dep', a.user_id, day, v, this._dep(a));
        n++;
      }
      for (const x of holds) { const px = +prices[x.key]; if (px > 0) { try { const m = JSON.parse(x.meta || '{}'); m.lastPx = px; sql.exec('UPDATE sp2hold SET meta=? WHERE user_id=? AND key=?', JSON.stringify(m), x.user_id, x.key); } catch (e) {} } }
      return this.j({ ok: true, accounts: n });
    }
    if (path === '/s2/board') { // THE SEASON BOARD: season P&L = (worth now - put in now) - (worth at the season start - put in then). A claim raises both sides, so only trading moves it. {ws, prices:{key:px}, limit}
      const ws = +b.ws || 0, we = ws + LB_PERIOD, prices = (b.prices && typeof b.prices === 'object') ? b.prices : {}, lim = Math.max(1, Math.min(1000, +b.limit || 300));
      if (!ws) return this.j({ error: 'bad' }, 400);
      const sday = this._day(ws);
      const accts = this.rows('SELECT user_id, usdt, claims, created, buys FROM sp2acct WHERE COALESCE(buys,0)>0');
      const holds = this.rows('SELECT user_id, key, qty, meta FROM sp2hold WHERE qty>0');
      const byU = {}; for (const x of holds) { (byU[x.user_id] = byU[x.user_id] || []).push(x); }
      const rows = [];
      for (const a of accts) {
        const hs = byU[a.user_id] || [];
        let equity = a.usdt || 0;
        for (const x of hs) { let px = +prices[x.key] || 0; if (!(px > 0)) { try { px = +(JSON.parse(x.meta || '{}').lastPx) || 0; } catch (e) {} } equity += Math.round(x.qty * px * 100); }
        const net = equity - this._dep(a);
        let base = 0;
        if ((+a.created || 0) < ws) { const sn = this.rows('SELECT value, dep FROM sp2snap WHERE user_id=? AND day<=? ORDER BY day DESC LIMIT 1', a.user_id, sday)[0]; if (sn) base = (+sn.value || 0) - (+sn.dep || 0); }
        const trades = (this.rows("SELECT COUNT(*) n FROM sp2tx WHERE user_id=? AND side IN ('buy','sell') AND ts>=? AND ts<?", a.user_id, ws, we)[0] || { n: 0 }).n;
        if (!hs.length && !trades) continue; // nothing held and nothing done this season - not a standing
        rows.push({ uid: a.user_id, pnlC: net - base, equityC: equity, netC: net, trades: +trades || 0, holdN: hs.length });
      }
      rows.sort((x, y) => (y.pnlC - x.pnlC) || (x.trades - y.trades));
      return this.j({ ws, we, n: rows.length, rows: rows.slice(0, lim) });
    }
    if (path === '/s2/admin') { // mp-ops roster; the worker prices the holdings into live worth
      const accts = this.rows('SELECT user_id uid, usdt, claims, created, last_seen, realized, buys, sells FROM sp2acct ORDER BY last_seen DESC LIMIT 3000');
      const holds = this.rows('SELECT user_id, key, qty, cost, meta FROM sp2hold WHERE qty>0');
      const byU = {}; for (const x of holds) { let m = {}; try { m = JSON.parse(x.meta || '{}'); } catch (e) {} (byU[x.user_id] = byU[x.user_id] || []).push({ key: x.key, qty: x.qty, costC: x.cost, meta: m }); }
      return this.j({ accounts: accts.map(a => ({ uid: a.uid, usdtC: a.usdt, claims: +a.claims || 0, depC: this._dep(a), created: a.created, last: a.last_seen, realizedC: a.realized || 0, buys: +a.buys || 0, sells: +a.sells || 0, holds: byU[a.uid] || [] })) });
    }
    if (path === '/s2/e2erm') { // E2E cleanup: e2e-prefixed uids only, the /e2euser rule
      if (!/^e2e/i.test(uid)) return this.j({ error: 'not_e2e' }, 400);
      for (const t of ['sp2acct', 'sp2hold', 'sp2tx', 'sp2snap']) sql.exec('DELETE FROM ' + t + ' WHERE user_id=?', uid);
      return this.j({ ok: true });
    }
`);
cut(`    if (path === '/portfolio') {
      if (!uid) return this.j({ error: 'bad' }, 400);
      if (url.searchParams.get('create') !== '1' && !this.rows('SELECT 1 FROM spotacct WHERE user_id=?', uid)[0]) return this.j({ none: true }); // no auto-create on a read (2026-09-03)`.split('\n').join(N),
  `    if (path === '/export') { // nightly backup dump`, DO_ROUTES, 'DO routes');
h = h.split(`for (const t of ['spotacct', 'spothold', 'spottx', 'spotsnap', 'spotxfer']) { try { out.tables[t] = this.rows('SELECT * FROM ' + t + ' LIMIT 200000'); }`).join(`for (const t of ['sp2acct', 'sp2hold', 'sp2tx', 'sp2snap', 'spotacct', 'spothold', 'spottx', 'spotsnap', 'spotxfer']) { try { out.tables[t] = this.rows('SELECT * FROM ' + t + ' LIMIT 200000'); }`);
once(`'sp2acct', 'sp2hold', 'sp2tx', 'sp2snap', 'spotacct'`, 'export list');
h = h.split(`let realN = 0; try { realN = (this.rows('SELECT COUNT(*) n FROM spotacct')[0] || {}).n || 0; } catch (e) {}`).join(`let realN = 0; try { realN = ((this.rows('SELECT COUNT(*) n FROM spotacct')[0] || {}).n || 0) + ((this.rows('SELECT COUNT(*) n FROM sp2acct')[0] || {}).n || 0); } catch (e) {}`);
// the start / claim amounts, beside the retired ones
h = h.split(`const SPOT_START_C = 1000000; // $10,000.00 demo money (lands on the CARD; USDT is bought on the exchange)`).join(`const SPOT_START_C = 1000000; // $10,000.00 demo money (lands on the CARD; USDT is bought on the exchange) - v1/v2, retired 2026-10-16
const SP2_START_C = 1000000; // v3 (2026-10-16): every account starts with $10,000.00 of demo cash
const SP2_CLAIM_C = 10000;   // and claims $100.00 more once every UTC day`);
once('const SP2_CLAIM_C = 10000;', 'SP2 consts');

/* ---------------------------------------------------------------- 2. the worker ---------------------------------------------------------------- */
const WORKER = J(`async function handleSpot(url, request, env) {
  const jr = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (!env.SPOT) return jr({ error: 'unavailable' }, 503);
  const path = url.pathname.slice('/api/spot'.length) || '/';
  let b = {}; if (request.method === 'POST') { try { b = await request.json(); } catch (e) {} }
  // public market data (no auth)
  if (path === '/memes') {
    const list = await spotMemeList(env);
    let updatedAt = 0; try { updatedAt = +(await env.STATS.get('spot:memes:ts')) || 0; } catch (e) {} // when the trending list was last rebuilt - the page prints its age instead of implying "live"
    return new Response(JSON.stringify({ memes: list, updatedAt }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60', ...CORS } });
  }
  if (path === '/memechart') {
    const pool = String(url.searchParams.get('pool') || '');
    const net = SPOT_NETS[String(url.searchParams.get('net') || '')] ? String(url.searchParams.get('net')) : 'solana';
    if (!/^[A-Za-z0-9]{20,60}$/.test(pool)) return jr({ error: 'bad_pool' }, 400);
    const M = { '1m': ['minute', 1], '5m': ['minute', 5], '15m': ['minute', 15], '1h': ['hour', 1], '4h': ['hour', 4], '1d': ['day', 1] }; // 1m/5m (2026-09-10): a pool minutes old has ONE 15m candle, which draws as an empty chart
    const mm = M[String(url.searchParams.get('tf') || '1h')] || M['1h'];
    const j = await gtFetch(env, '/networks/' + net + '/pools/' + pool + '/ohlcv/' + mm[0] + '?aggregate=' + mm[1] + '&limit=300', 60, 'ohlcv_' + net + '_' + pool + '_' + mm[0] + mm[1]);
    const list = (j && j.data && j.data.attributes && j.data.attributes.ohlcv_list) || [];
    const bars = list.map(r => ({ time: +r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4], vol: +r[5] })).filter(x => x.time > 0 && x.close > 0).sort((x, y) => x.time - y.time);
    return new Response(JSON.stringify(bars), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60', ...CORS } });
  }
  if (path === '/token') return spotTokenLookup(url, env, jr);
  if (path === '/board') { // the Meme Spot season board, public: the KV snapshot the */10 cron writes (lb:meme:<ws>) - a request never prices every account
    const ck = new Request('https://marginpad.io/__meme_board_v1');
    try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
    const ws = lbPeriodStart(Date.now());
    const snap = await memeSnapshot(env, ws);
    let prizes = [15, 10, 5, 0, 0]; try { prizes = (await rewardCfg(env)).lbMeme; } catch (e) {}
    const resp = new Response(JSON.stringify({ ws, we: ws + LB_PERIOD, ts: snap.ts || 0, n: snap.n || 0, paidFrom: MEME_LB_START, prizes, rows: (snap.rows || []).map(r => ({ rank: r.rank, who: r.who, pnlUsd: r.pnl, equityUsd: r.equity, trades: r.trades })) }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60', ...CORS } });
    try { await caches.default.put(ck, resp.clone()); } catch (e) {}
    return resp;
  }
  // everything below acts on a user's account -> session required (admin ?uid= override for testing/support)
  let uid = null;
  const tok = getCookie(request, SESS_COOKIE);
  if (tok && env.USERS) { const su = await sessionUser(env, tok); if (su && su.id) { if (su.status && su.status !== 'active') return jr({ error: 'restricted' }, 403); uid = String(su.id); } }
  if (!uid) { const ov = url.searchParams.get('uid'); if (ov && (await adminCookieOk(request, env) || isAdminKey(env, adminKeyFrom(request, url)))) uid = String(ov); }
  if (!uid) return jr({ error: 'login_required' }, 401);
  const stub = spotStub(env);
  const sdo = async (p, body) => { const r = await stub.fetch(new Request('https://do' + p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)); return r.json(); };
  if (path === '/start' && request.method === 'POST') { // the ONLY place an account is minted: the Start button
    try { const d = await sdo('/s2/portfolio?uid=' + encodeURIComponent(uid) + '&create=1'); if (d && d.fresh) { try { await evPush(env, request, 'spottrade', 'started with $10,000', '/spot/'); } catch (e) {} } return jr({ ok: !d.error, fresh: !!d.fresh }); } catch (e) { return spotFail(env, jr, path); }
  }
  if (path === '/portfolio' || path === '/') {
    let d = null; try { d = await sdo('/s2/portfolio?uid=' + encodeURIComponent(uid)); } catch (e) { return spotFail(env, jr, path); }
    if (d && d.none) return jr({ none: true }); // signed in, no account yet - the page shows the start card
    const holds = d.holds || [];
    for (const x of holds) {
      let px = 0;
      try {
        if (x.meta && x.meta.k === 'meme') { const mp = await spotMemePrice(env, x.meta.net || 'solana', x.meta.pool); px = mp ? mp.price : 0; if (mp && !mp.stale) { x.liqUsd = Math.round(+mp.liqUsd || 0); x.rugged = x.liqUsd < SPOT_THIN_LIQ; } }
        else { const pd = await fetchPriceCached(x.meta && x.meta.sym || String(x.key).replace(/^cex:/, '')); px = pd ? +pd.price : 0; }
      } catch (e) {}
      if (!(px > 0)) { px = +((x.meta && x.meta.lastPx)) || 0; x.stale = true; } // dead feed (rugged meme) -> last known mark + a stale flag for the UI
      x.price = px; x.valueUsd = Math.round(x.qty * px * 100) / 100; x.pnlUsd = Math.round((x.valueUsd - x.costUsd) * 100) / 100; x.pnlPct = x.costUsd > 0 ? Math.round(x.pnlUsd / x.costUsd * 10000) / 100 : 0;
    }
    const equityUsd = Math.round(((+d.usdtUsd || 0) + holds.reduce((s, x) => s + x.valueUsd, 0)) * 100) / 100;
    const netUsd = Math.round((equityUsd - (+d.depositedUsd || 0)) * 100) / 100;
    // season P&L exactly as the board computes it: net worth now minus net worth at the season start (the first daily mark on/after... the last one ON OR BEFORE the season's first day)
    const ws = lbPeriodStart(Date.now()), sday = new Date(ws).toISOString().slice(0, 10);
    let base = 0; if ((+d.created || 0) < ws) { const sn = (d.snaps || []).filter(s => s.day <= sday).slice(-1)[0]; if (sn) base = (+sn.valueUsd || 0) - (+sn.depUsd || 0); }
    const seasonPnlUsd = Math.round((netUsd - base) * 100) / 100;
    let rank = null, boardN = 0; try { const snap = await memeSnapshot(env, ws); boardN = snap.n || 0; const me = (snap.rows || []).find(r => String(r.uid) === uid); if (me) rank = me.rank; } catch (e) {}
    const snaps = d.snaps || [];
    const today = snaps.length ? snaps[snaps.length - 1] : null;
    return jr({ ...d, holds, equityUsd, netUsd, allTimePnlUsd: netUsd, seasonPnlUsd, season: { ws, we: ws + LB_PERIOD, rank, n: boardN }, todayPnlUsd: today ? Math.round((equityUsd - (+today.valueUsd || 0) - ((+d.depositedUsd || 0) - (+today.depUsd || 0))) * 100) / 100 : null, nets: SPOT_NETS });
  }
  if (path === '/claim' && request.method === 'POST') {
    let d = null; try { d = await sdo('/s2/claim', { uid }); } catch (e) { return spotFail(env, jr, path); }
    if (d && d.error) return jr(d, d.error === 'claimed' ? 429 : d.none ? 404 : 400);
    if (d && d.none) return jr({ error: 'no_account' }, 404);
    try { await evPush(env, request, 'spottrade', 'claimed $' + (SP2_CLAIM_C / 100).toFixed(0), '/spot/'); } catch (e) {}
    await spotTrack(env, request, uid, 'spotclaim', '$' + (SP2_CLAIM_C / 100).toFixed(0));
    return jr(d);
  }
  if (path === '/trade' && request.method === 'POST') {
    const side = b.side === 'sell' ? 'sell' : 'buy';
    const kind = b.kind === 'meme' ? 'meme' : 'cex';
    let key, price = 0, liq = 0, meta = { k: kind }, net = '', holdMeta = null, priceStale = false;
    if (kind === 'meme') {
      let pool = String(b.pool || ''); const mint = String(b.mint || '');
      if (!/^[A-Za-z0-9]{20,60}$/.test(mint)) return jr({ error: 'bad_token' }, 400);
      let info = null; try { info = (await spotMemeList(env)).find(m => m.mint === mint); } catch (e) {} // identity from OUR list when possible - client fields only as a sanitized fallback
      net = (info && info.net) || (SPOT_NETS[String(b.net || '')] ? String(b.net) : 'solana');
      key = net + ':' + mint; // the mint is the identity (tickers collide)
      if (side === 'sell') { // the POSITION says which pool prices it (2026-09-06) - never the pool the client names
        try { const hd = await sdo('/s2/hold?uid=' + encodeURIComponent(uid) + '&key=' + encodeURIComponent(key)); if (hd && hd.qty > 0) holdMeta = hd.meta || {}; } catch (e) {}
        if (!holdMeta) return jr({ error: 'no_position' }, 400);
        if (holdMeta.pool) pool = String(holdMeta.pool);
        if (holdMeta.net && SPOT_NETS[holdMeta.net]) { net = holdMeta.net; key = net + ':' + mint; }
      }
      if (!/^[A-Za-z0-9]{20,60}$/.test(pool)) return jr({ error: 'bad_token' }, 400);
      const mp = await spotMemePrice(env, net, pool);
      if (!mp) return jr({ error: 'no_price' }, 503);
      if (mp.mint && mp.mint.toLowerCase() !== mint.toLowerCase()) return jr({ error: 'bad_pool' }, 400); // the pool prices a DIFFERENT token - no fill through a foreign pool, either direction
      price = mp.price; liq = mp.liqUsd; priceStale = !!mp.stale;
      if (side === 'buy' && liq > 0 && liq < SPOT_THIN_LIQ) return jr({ error: 'thin_pool', liqUsd: Math.round(liq) }, 400); // under $1k of liquidity the price is fiction, and the board pays real money
      meta = { k: 'meme', mint, pool, net, sym: (info && info.sym) || String(b.symbol || '').replace(/[^A-Za-z0-9$]/g, '').slice(0, 12) || '?', name: (info && info.name) || String(b.name || '').slice(0, 48), logo: (info && info.logo) || (SPOT_LOGO_OK.test(String(b.logo || '')) ? String(b.logo).slice(0, 300) : '') };
    } else {
      const sym = String(b.sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
      if (!sym || sym === 'USDT' || sym === 'USDC') return jr({ error: 'bad_sym' }, 400);
      const pd = await fetchPriceCached(sym);
      if (!pd || !(+pd.price > 0)) return jr({ error: 'no_price' }, 503);
      price = +pd.price; key = 'cex:' + sym;
      meta = { k: 'cex', sym, logo: SPOT_LOGO_OK.test(String(b.logo || '')) ? String(b.logo).slice(0, 300) : '' };
    }
    if (side === 'buy') {
      const usdC = Math.round((+b.usd || 0) * 100);
      if (!(usdC >= 100)) return jr({ error: 'min_trade', minUsd: 1 }, 400);
      if (usdC > 100000000) return jr({ error: 'too_big' }, 400);
      let d = null; try { d = await sdo('/s2/trade', { uid, side: 'buy', key, usdC, price, meta }); } catch (e) { return spotFail(env, jr, path); }
      if (d && d.none) return jr({ error: 'no_account' }, 404);
      if (d && d.ok) { d.sym = meta.sym || key.replace(/^cex:/, ''); d.net = net || null; try { await evPush(env, request, 'spottrade', 'BUY ' + d.sym + ' $' + (usdC / 100).toFixed(2), '/spot/'); } catch (e) {} await spotTrack(env, request, uid, 'spotbuy', d.sym); }
      return jr(d || { error: 'fail' }, d && d.ok ? 200 : 400);
    }
    // sell: the hold decides the exact qty (100% = the stored qty) and, for a meme, the pool
    let hq = 0; try { const hd = await sdo('/s2/hold?uid=' + encodeURIComponent(uid) + '&key=' + encodeURIComponent(key)); hq = +hd.qty || 0; if (!holdMeta) holdMeta = hd.meta || {}; } catch (e) {}
    if (!(hq > 0)) return jr({ error: 'no_position' }, 400);
    const pct = Math.min(100, Math.max(0, +b.pct || 0));
    const qty = pct >= 100 ? hq : (isFinite(+b.qty) && +b.qty > 0 ? Math.min(+b.qty, hq) : hq * pct / 100);
    if (!(qty > 0)) return jr({ error: 'bad' }, 400);
    const estUsd = qty * price;
    if (estUsd < 0.5 && pct < 100) return jr({ error: 'min_trade', minUsd: 1 }, 400); // dust positions may sell whole regardless of the $1 floor
    if (kind === 'meme') { // integrity guard: a fill far above the position's own last mark needs a pool that could actually pay it
      const gd = spotSellGuard({ price, lastPx: +(holdMeta && holdMeta.lastPx) || 0, liqUsd: liq, stale: priceStale });
      if (gd.alert) { try { if (env.AE) env.AE.writeDataPoint({ indexes: ['spotjump'], blobs: ['spotjump', key.slice(0, 64), String(gd.block || 'filled'), String(uid)], doubles: [1, gd.x, estUsd, liq] }); } catch (e) {} try { await tgAdmin(env, '<b>Demo Spot: sell fill ' + Math.round(gd.x) + 'x above the last mark' + (gd.block ? ' (refused: ' + gd.block + ')' : '') + '</b>\\n' + (meta.sym || key.slice(0, 20)) + ' est $' + Math.round(estUsd) + ' at ' + price.toPrecision(4) + ' (last mark ' + (+(holdMeta && holdMeta.lastPx) || 0).toPrecision(4) + ', pool liq $' + Math.round(liq) + (priceStale ? ', list fallback' : '') + ')\\nuid ' + String(uid).slice(0, 12), { kind: 'spotjump', sev: gd.block ? 'warn' : 'red' }); } catch (e) {} }
      if (gd.block === 'thin_pool') return jr({ error: 'thin_pool', liqUsd: Math.round(liq) }, 400);
      if (gd.block) return jr({ error: gd.block }, 503);
    }
    let d = null; try { d = await sdo('/s2/trade', { uid, side: 'sell', key, qty, pct: pct >= 100 ? 100 : 0, price }); } catch (e) { return spotFail(env, jr, path); }
    if (d && d.ok) { d.sym = (holdMeta && holdMeta.sym) || key.replace(/^cex:/, '').replace(/^[a-z]+:/, '').slice(0, 14); d.net = net || null; await spotTrack(env, request, uid, 'spotsell', d.sym); try { await evPush(env, request, 'spottrade', 'SELL ' + d.sym + ' $' + (+d.usdUsd || 0).toFixed(2) + (d.pnlUsd != null ? ' (' + (d.pnlUsd >= 0 ? '+' : '') + (+d.pnlUsd).toFixed(2) + ')' : ''), '/spot/'); } catch (e) {} }
    return jr(d || { error: 'fail' }, d && d.ok ? 200 : 400);
  }
  if (path === '/history') {
    try { const d = await sdo('/s2/tx?uid=' + encodeURIComponent(uid));
      if (url.searchParams.get('csv') === '1') { // the ledger as a file - the same rows the page shows, oldest first
        const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const rows = ((d && d.tx) || []).slice().reverse().map(t => [new Date(t.ts).toISOString(), t.side, t.sym || '', t.name || '', t.qty, t.price, t.usdUsd, t.pnlUsd].map(q).join(','));
        return new Response('time,side,symbol,name,qty,price,usd,pnl\\n' + rows.join('\\n') + '\\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="demo-spot-history.csv"', 'cache-control': 'no-store', ...CORS } });
      }
      return jr(d); } catch (e) { return jr({ tx: [] }); }
  }
  return jr({ error: 'not_found' }, 404);
}
// Prices for a set of held keys, cheaply: majors from the price cache, memes from the trending list when it carries the
// mint (one aggregate read instead of one pool call each - the list is rebuilt every two minutes and GeckoTerminal allows
// about 30 calls a minute from our egress), and only then the pool itself. Returns {key: px}.
async function spotPricesFor(env, syms) {
  const prices = {}; let list = []; try { list = await spotMemeList(env); } catch (e) {}
  const byMint = {}; for (const m of list) if (m && m.mint && +m.price > 0) byMint[String(m.mint).toLowerCase()] = +m.price;
  const majors = {};
  for (const key of Object.keys(syms || {})) {
    const info = syms[key] || {};
    try {
      if (info.k === 'meme') {
        const lp = byMint[String(info.mint || key.split(':')[1] || '').toLowerCase()];
        if (lp > 0) { prices[key] = lp; continue; }
        const mp = await spotMemePrice(env, info.net || 'solana', info.pool); if (mp && +mp.price > 0) prices[key] = +mp.price;
        await new Promise(r => setTimeout(r, 40));
      } else {
        const sym = info.sym || key.replace(/^cex:/, '');
        if (!(majors[sym] > 0)) { const pd = await fetchPriceCached(sym); if (pd && +pd.price > 0) majors[sym] = +pd.price; }
        if (majors[sym] > 0) prices[key] = majors[sym];
      }
    } catch (e) {}
  }
  return prices;
}
// Daily mark (first */10 cron after 00:00 UTC, idempotent via KV stamp): every account's start-of-day worth + what the house
// had put in by then. It is the season baseline the board subtracts, so a missed day costs a wrong baseline - that is why
// the board falls back to the newest mark on or before the season's first day rather than to zero.
async function spotDailySnapshot(env) {
  try {
    if (!env || !env.SPOT || !env.STATS) return;
    const day = new Date().toISOString().slice(0, 10);
    if (await env.STATS.get('spot:snap2:' + day)) return;
    await env.STATS.put('spot:snap2:' + day, '1', { expirationTtl: 172800 });
    const stub = spotStub(env);
    const sd = await (await stub.fetch(new Request('https://do/s2/allsyms'))).json();
    const prices = await spotPricesFor(env, sd.syms || {});
    await stub.fetch(new Request('https://do/s2/snapshot-all', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ day, prices }) }));
  } catch (e) {}
}
// THE MEME SPOT BOARD (2026-10-16): built by the cron every ten minutes into KV lb:meme:<ws> (what the page, /api/reward/lb
// and /api/competition read), and rebuilt once more by the payer the moment the season ends. Names are resolved here;
// e2e members and banned accounts never reach the public rows.
const MEME_LB_START = Date.UTC(2026, 9, 12); // the season running when it shipped - every account was reset to $10,000 on 2026-10-16, so the whole field starts level
async function memeSnapshot(env, ws) { try { const x = JSON.parse((await env.STATS.get('lb:meme:' + ws)) || 'null'); if (x) return x; } catch (e) {} return { ws, ts: 0, rows: [], n: 0 }; }
async function spotBoardBuild(env, ws) {
  const stub = spotStub(env);
  const sd = await (await stub.fetch(new Request('https://do/s2/allsyms'))).json();
  const prices = await spotPricesFor(env, sd.syms || {});
  const bd = await (await stub.fetch(new Request('https://do/s2/board', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ws, prices, limit: 400 }) }))).json();
  const raw = (bd && bd.rows) || [];
  let names = {}; try { const nr = await usersDO(env, '/names', { ids: raw.map(x => x.uid) }); names = (nr && nr.names) || {}; } catch (e) {}
  const banned = await lbBanned(env);
  const rows = [];
  for (const x of raw) {
    const who = names[x.uid]; if (!who || /^e2e_/i.test(who)) continue;
    if (banned['u:' + x.uid] || banned[x.uid]) continue;
    rows.push({ rank: rows.length + 1, uid: x.uid, who, pnl: Math.round(+x.pnlC || 0) / 100, equity: Math.round(+x.equityC || 0) / 100, trades: +x.trades || 0 });
  }
  return { ws, we: ws + LB_PERIOD, ts: Date.now(), n: rows.length, rows, priced: Object.keys(prices).length, keys: Object.keys(sd.syms || {}).length };
}
async function spotBoardCron(env) {
  try {
    if (!env || !env.SPOT || !env.STATS) return;
    const ws = lbPeriodStart(Date.now());
    const snap = await spotBoardBuild(env, ws);
    await env.STATS.put('lb:meme:' + ws, JSON.stringify(snap), { expirationTtl: 400 * 86400 });
    try { await caches.default.delete(new Request('https://marginpad.io/__meme_board_v1')); } catch (e) {}
  } catch (e) {}
}`);
// the /token lookup is kept verbatim as its own function: cut it out of the old handleSpot first, then drop the rest
const tokStart = once(`  if (path === '/token') { // any token by CONTRACT ADDRESS (owner, 2026-09-03, "like Phantom").`, 'token start');
const tokEnd = once(`  if (path === '/share' && request.method === 'GET') { // public: a shared portfolio snapshot (server-made, 30 days)`, 'token end');
let tokBody = h.slice(tokStart, tokEnd);
tokBody = tokBody.replace(`  if (path === '/token') { // any token by CONTRACT ADDRESS (owner, 2026-09-03, "like Phantom").`, `async function spotTokenLookup(url, env, jr) { // any token by CONTRACT ADDRESS (owner, 2026-09-03, "like Phantom").`);
tokBody = tokBody.replace(/\s+$/, '') + N;
// the token block closes with "  }" (the if) - that now closes the function; its first line was rewritten above
cut(`async function handleSpot(url, request, env) {`, `// One line a day for accounts that asked for it (Demo Spot, 2026-09-06): "your portfolio moved +$212.40 (+2.1%) yesterday",`, WORKER + N + tokBody, 'worker handleSpot');
// the day-2 line (spotDailyText/spotDailyLine) goes whole: from its header comment to the function after it
cut(`// One line a day for accounts that asked for it (Demo Spot, 2026-09-06): "your portfolio moved +$212.40 (+2.1%) yesterday",`, `async function handleReward(url, request, env) {`, 'async function handleReward(url, request, env) {', 'spotDailyLine');
// spotTokenLookup references `url` and `env` and `jr` only (it did inside handleSpot too) - verified by esbuild

/* ------------------------------------------------- 3. crons, admin hooks, digest helpers ------------------------------------------------- */
cut(`// Demo Spot summary for one user (weekly digest line + stuck nudge). Read-only portfolio; null when there is no account.`, `async function sendDigestEmail(`, J(`// Demo Spot summary for one user (weekly digest line). Read-only; null when there is no account. v3 shape (2026-10-16).
async function spotSummary(env, uid) {
  try { if (!env.SPOT) return null; const r = await spotStub(env).fetch(new Request('https://do/s2/portfolio?uid=' + encodeURIComponent(uid))); const d = await r.json(); if (!d || d.none || d.error) return null;
    return { cashUsd: +d.usdtUsd || 0, holds: (d.holds || []).length, txN: +d.txN || 0, claimedToday: !!d.claimedToday }; } catch (e) { return null; }
}
function spotDigestHtml(sp) { if (!sp || !sp.txN) return ''; return '<p style="margin:14px 0 0;color:#8b97a5;font-size:13px">Demo Spot: $' + sp.cashUsd.toFixed(0) + ' in cash, ' + sp.holds + (sp.holds === 1 ? ' coin' : ' coins') + ' held' + (sp.claimedToday ? '' : ' - your 00 for today is unclaimed') + '. <a href="https://marginpad.io/spot/" style="color:#c2f64a">Open Demo Spot</a></p>'; }
function spotDigestText(sp) { if (!sp || !sp.txN) return ''; return '

Demo Spot: $' + sp.cashUsd.toFixed(0) + ' in cash, ' + sp.holds + ' coins held' + (sp.claimedToday ? '' : ' - your 00 for today is unclaimed') + '. https://marginpad.io/spot/'; }
`) + 'async function sendDigestEmail(', 'spotSummary + stuck nudge');
h = h.split(`    bg(spotStuckNudge, 'spotnudge');` + N).join('');
h = h.split(`    bg(spotOrdersSweep, 'spotorders'); // limit-order fills through the normal trade path // one email, once per a`).join(`    bg(spotBoardCron, 'memeboard'); // the Meme Spot season board into KV every ten minutes (2026-10-16) // one email, once per a`);
once(`bg(spotBoardCron, 'memeboard');`, 'memeboard cron');
h = h.split(`      spotorders: ['fills Demo Spot limit orders', 'spot limit orders sit unfilled'],`).join(`      memeboard: ['builds the Meme Spot season board', '/spot/ and /leaderboards/ show a stale Meme Spot board'],`);
once(`memeboard: ['builds the Meme Spot season board'`, 'cron list');
// admin test hooks of the retired shape
const dropRoute = (startMarker, nm) => { const i0 = once(startMarker, nm); const i1 = h.indexOf(N + '    if (url.pathname === ', i0 + 10); if (i1 < 0) { console.error(nm + ': no next route'); process.exit(1); } h = h.slice(0, i0) + h.slice(i1 + N.length); };
dropRoute(`    if (url.pathname === '/api/admin/spotorders' && `, 'spotorders route');
dropRoute(`    if (url.pathname === '/api/admin/spotdaily' && `, 'spotdaily route');
dropRoute(`    if (url.pathname === '/api/admin/spotdrain' && `, 'spotdrain route');
dropRoute(`    if (url.pathname === '/api/admin/spotguard' && `, 'spotguard route');
// the attention strip's "money parked in a wallet" probe read the retired roster
const attStart = once(`        (async () => { // Demo Spot: money parked in a wallet with no action for a week (the cash-out dead end; the nudge email covers it once)`, 'attention spot');
const attEnd = h.indexOf(N + '        })(),', attStart) + (N + '        })(),').length;
h = h.slice(0, attStart) + h.slice(attEnd + N.length);
// retired helpers nothing references now
{ const i0 = once(`function spotGenAddr() {`, 'spotGenAddr'); const i1 = h.indexOf(N + '}' + N, i0); h = h.slice(0, i0) + h.slice(i1 + (N + '}' + N).length); }
for (const m of [`const SPOT_WORDS = `, `function spotGenSeed() {`, `function spotSlip(usd, liqUsd)`, `const SPOT_MEME_FEE_BP = 30;`, `const SPOT_ONRAMP_BP = 180;`, `const SPOT_OFFRAMP_BP = 100;`, `const SPOT_SWAP_BP = 30;`, `const SPOT_FEE_BP = 10;`]) {
  const i0 = h.indexOf(m); if (i0 < 0) { console.error('retired helper missing: ' + m); process.exit(1); }
  const i1 = h.indexOf(N, i0); h = h.slice(0, i0) + h.slice(i1 + N.length);
}

/* ---------------------------------------------------------------- write ---------------------------------------------------------------- */
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('worker.js rewritten: Demo Spot v3 backend in place');
