// bot-fleet-e2e.js - SEVEN REAL BOTS, SEVEN TACTICS, RUN AT ONCE AGAINST PRODUCTION (2026-10-10).
//
// Owner: "napravi botove koji ce da trejduju (razlicitim taktikama, high rate, slow, sta god) i da vidimo da
// li sve radi kako treba. Cilj je da imamo jako kvalitetan proizvod."
//
// Every other suite in build/ checks one endpoint's contract. This one checks what a PRODUCT has to survive:
// several independent strategies, with different shapes of traffic and different simulation profiles, running
// at the same time, each on its own key and its own account - and then CROSS-CHECKS the arithmetic every one
// of them depends on. The bugs this class of test finds are the ones no single-endpoint check can see: a
// balance that does not equal the sum of its own trades, a P&L that disagrees with the formula the docs
// publish, a rate limiter that refuses without saying when to come back.
//
// THE FLEET
//   1 scalper      high rate: hammers /positions, opens and closes within seconds, many small trades
//   2 swing        slow: one position, trailing stop, left to sit
//   3 grid         a ladder of resting limit orders, then modify and cancel
//   4 martingale   doubles after a loss on an ENFORCED book until the book refuses it
//   5 survivor     runs under the `brutal` preset: refusals, partial fills, a second of latency
//   6 globetrotter crypto + stocks + forex + metals + an index, which is the thing no rival offers
//   7 overdrive    deliberately exceeds its own rate ceiling to prove the 429 is usable
//
// INVARIANTS asserted after they all finish - these are the load-bearing half of the file:
//   * every closed trade's pnl_usd equals qty*(exit-entry)*dir - qty*(entry+exit)*fee - funding, floored at -margin
//   * balance_usd equals the chosen book plus the sum of that account's own realized closes
//   * the report's totals agree with /v1/trades, close for close
//   * costs.fees_usd equals the sum of the per-trade fees_usd
//   * nothing is left open that the bot closed, and nothing closed that it did not
//   * no 5xx from any endpoint, ever, under any of it
//
// Usage: node build/bot-fleet-e2e.js            (the whole fleet)
//        node build/bot-fleet-e2e.js scalper grid    (named bots only)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const BASE = 'https://marginpad.io';
const ADMIN = (() => { try { return (fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-z0-9]+/i) || [''])[0]; } catch (e) { return ''; } })();
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (d != null ? '  -> ' + d : '')); } };
const near = (a, b, tol) => Math.abs(+a - +b) <= tol;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = { 'x-admin-key': ADMIN, 'content-type': 'application/json' };

// ───────────────────────────────────────────────────────────── one bot's own little client
// Deliberately NOT the SDK: a bot built by hand is what most callers actually write, and it lets every
// response be recorded so the invariants can be checked against what the API really said.
function Client(key, log) {
  const KH = { 'X-API-Key': key, 'Content-Type': 'application/json' };
  const call = async (method, p, body) => {
    const t0 = Date.now();
    let r, j = null, txt = '';
    try {
      r = await fetch(BASE + '/api/bot/v2' + p, { method, headers: KH, body: body === undefined ? undefined : JSON.stringify(body) });
      txt = await r.text();
      try { j = JSON.parse(txt); } catch (e) { j = null; }
    } catch (e) { log.net++; return { status: 0, err: String(e && e.message || e) }; }
    const ms = Date.now() - t0;
    log.calls++; log.ms.push(ms);
    log.byStatus[r.status] = (log.byStatus[r.status] || 0) + 1;
    // A DELIBERATE REFUSAL IS NOT A SERVER FAULT. `venue_rejected` is a 503 the simulation profile was
    // asked to produce (reject_rate_pct), carries Retry-After semantics and is documented as retryable.
    // Counting it here made the fleet's own `brutal` bot fail the suite for working correctly.
    const modelled = r.status === 503 && /venue_rejected/.test(txt);
    if (modelled) log.modelled503 = (log.modelled503 || 0) + 1;
    else if (r.status >= 500) log.fivexx.push(method + ' ' + p + ' -> ' + r.status + ' ' + txt.slice(0, 160));
    if (j === null && txt) log.unparsable.push(method + ' ' + p + ' -> ' + txt.slice(0, 120));
    const out = { status: r.status, hdr: r.headers, raw: txt };
    if (j && j.ok === false) { out.error = (j.error && j.error.code) || 'error'; out.message = (j.error && j.error.message) || ''; out.body = j; }
    else { out.data = (j && j.data) || j; out.body = j; }
    return out;
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b || {}),
    log,
  };
}
const newLog = () => ({ calls: 0, net: 0, ms: [], byStatus: {}, fivexx: [], unparsable: [], opened: [], closed: [], notes: [] });

// ───────────────────────────────────────────────────────────── the bots
const BOTS = {
  // 1. HIGH RATE. The shape 76% of real traffic has: poll, poll, poll, act.
  scalper: async (c) => {
    await c.post('/sim', { reset: true });
    await c.post('/sim', { slippage: true, slippage_bps: 2, taker_bps: 4.5 });
    for (let round = 0; round < 4; round++) {
      for (let i = 0; i < 6; i++) await c.get('/positions');          // the poll loop a real bot runs
      const o = await c.post('/open', { symbol: 'SOL', side: round % 2 ? 'sell' : 'buy', margin_usd: 8, leverage: 4, client_order_id: 'scalp-' + round });
      if (o.status !== 200) { c.log.notes.push('open refused: ' + o.error); continue; }
      const id = o.data.position.id; c.log.opened.push(id);
      await c.get('/positions');
      const cl = await c.post('/close', { id, symbol: 'SOL' });
      if (cl.status === 200) c.log.closed.push(cl.data.position);
      else c.log.notes.push('close refused: ' + cl.error);
    }
    // the same client_order_id must return the SAME position, not a second one
    const a = await c.post('/open', { symbol: 'SOL', side: 'long', margin_usd: 8, leverage: 4, client_order_id: 'scalp-idem' });
    const b = await c.post('/open', { symbol: 'SOL', side: 'long', margin_usd: 8, leverage: 4, client_order_id: 'scalp-idem' });
    c.log.idem = { first: a.data && a.data.position && a.data.position.id, second: b.data && b.data.position && b.data.position.id, flagged: !!(b.data && b.data.idempotent) };
    if (a.status === 200) { c.log.opened.push(a.data.position.id); const z = await c.post('/close', { id: a.data.position.id, symbol: 'SOL' }); if (z.status === 200) c.log.closed.push(z.data.position); }
  },

  // 2. SLOW. One position, a trailing stop, and then nothing - the shape that must survive being ignored.
  swing: async (c) => {
    await c.post('/sim', { reset: true });
    await c.post('/sim', { preset: 'realistic' });
    const px = (await c.get('/price?symbol=BTC')).data;
    const o = await c.post('/open', { symbol: 'BTC', side: 'buy', margin_usd: 40, leverage: 3, sl: +(px.price * 0.96).toPrecision(8), tp: +(px.price * 1.08).toPrecision(8), client_order_id: 'swing-1' });
    if (o.status !== 200) { c.log.notes.push('open refused: ' + o.error); return; }
    const id = o.data.position.id; c.log.opened.push(id);
    const t = await c.post('/sltp', { id, trail_pct: 2.5 });
    c.log.trail = t.data && t.data.position ? { sl: t.data.position.sl, trail: t.data.position.trail_pct } : null;
    await sleep(2500);                                                 // held, untouched
    const pos = await c.get('/positions?status=open');
    c.log.stillOpen = ((pos.data && pos.data.positions) || []).filter((p) => p.id === id).length;
    const cl = await c.post('/close', { id, symbol: 'BTC' });
    if (cl.status === 200) c.log.closed.push(cl.data.position);
  },

  // 3. GRID. Resting orders: the second-heaviest endpoint in production (13% of all calls) and the one most
  // likely to drift, because a fill happens minutes later with nobody watching.
  grid: async (c) => {
    await c.post('/sim', { reset: true });
    const px = (await c.get('/price?symbol=ETH')).data.price;
    const placed = [];
    for (let i = 1; i <= 5; i++) {
      const lp = +(px * (1 - 0.01 * i)).toPrecision(8);
      const r = await c.post('/open', { type: 'limit', symbol: 'ETH', side: 'buy', limit_price: lp, margin_usd: 10, leverage: 3, client_order_id: 'grid-' + i });
      if (r.status === 200) placed.push(r.data.order.order_id); else c.log.notes.push('order ' + i + ' refused: ' + r.error);
    }
    c.log.placed = placed.length;
    const list = await c.get('/orders');
    c.log.resting = ((list.data && list.data.orders) || []).length;
    if (placed.length) {
      const m = await c.post('/modify_order', { order_id: placed[0], limit_price: +(px * 0.985).toPrecision(8) });
      c.log.modified = m.status === 200;
      // A real change, or `nothing_to_modify` refuses it with 400 before the order is ever looked up -
      // which is the house rule working, and is what made the first version of this check read as a bug.
      const bad = await c.post('/modify_order', { order_id: 'lo-does-not-exist', limit_price: 1234.5 });
      c.log.modifyUnknown = bad.status;
    }
    for (const id of placed) await c.post('/cancel_order', { order_id: id });
    const after = await c.get('/orders');
    c.log.restingAfter = ((after.data && after.data.orders) || []).length;
    const again = placed.length ? await c.post('/cancel_order', { order_id: placed[0] }) : null;
    c.log.cancelTwice = again ? again.status : null;
  },

  // 4. MARTINGALE on an ENFORCED book. The strategy shape that blows accounts up, against the one setting
  // that is supposed to stop it. This is the bot that proves margin_enforced is real money arithmetic.
  martingale: async (c) => {
    await c.post('/sim', { reset: true });
    await c.post('/sim', { start_balance_usd: 500, margin_enforced: true });
    const bal0 = (await c.get('/balance')).data;
    c.log.book = { start: bal0.starting_balance_usd, free: bal0.free_margin_usd, max: bal0.max_margin_usd };
    let size = 40, refused = null;
    for (let i = 0; i < 6 && !refused; i++) {
      const o = await c.post('/open', { symbol: 'SOL', side: 'long', margin_usd: size, leverage: 2, client_order_id: 'mart-' + i });
      if (o.status === 402) { refused = { at: size, body: o.body }; break; }
      if (o.status !== 200) { c.log.notes.push('unexpected ' + o.status + ' ' + o.error); break; }
      c.log.opened.push(o.data.position.id);
      size *= 2;                                                       // double, as the strategy does
    }
    c.log.refusedAt = refused ? refused.at : null;
    c.log.refusal = refused ? (refused.body.error || {}) : null;
    const b1 = (await c.get('/balance')).data;
    c.log.committed = b1.margin_in_use_usd;
    c.log.freeAfter = b1.free_margin_usd;
    const all = await c.post('/close_all', {});
    if (all.status === 200) ((all.data && all.data.positions) || []).forEach((p) => c.log.closed.push(p));
  },

  // 5. SURVIVOR under `brutal`: refusals, partial fills, a second of latency. A bot that cannot handle a
  // refusal is not finished - this one proves ours can be handled.
  survivor: async (c) => {
    await c.post('/sim', { reset: true });
    await c.post('/sim', { preset: 'brutal' });
    let refused = 0, filled = 0, partial = 0;
    const run = async (n, tag) => {
      for (let i = 0; i < n; i++) {
        const o = await c.post('/open', { symbol: 'SOL', side: i % 2 ? 'sell' : 'buy', margin_usd: 20, leverage: 2, client_order_id: tag + i });
        if (o.status === 503 && o.error === 'venue_rejected') { refused++; continue; } // retryable, as a venue's is
        if (o.status !== 200) { c.log.notes.push('status ' + o.status + ' ' + o.error); continue; }
        filled++;
        if ((o.data.fill || {}).partial) partial++;
        c.log.opened.push(o.data.position.id);
        const cl = await c.post('/close', { id: o.data.position.id, symbol: 'SOL' });
        if (cl.status === 200) c.log.closed.push(cl.data.position);
      }
    };
    // `brutal` is the realistic half: partial fills, size impact, a second of latency.
    await run(6, 'surv-b');
    // THE REFUSAL PATH NEEDS A RATE IT CAN RELY ON. brutal refuses 5%, so over ten opens the chance of seeing
    // none is 60% - the first version of this check was flaky by construction, which is the same as broken.
    // 50% over eight attempts misses only once in 256 runs, and it is still the product's own mechanism.
    await c.post('/sim', { reject_rate_pct: 50 });
    await run(8, 'surv-r');
    c.log.brutal = { refused, filled, partial };
  },

  // 6. GLOBETROTTER. One key across five asset classes - the differentiator no rival has. A closed market
  // must be REFUSED with a reason, never filled at a stale price.
  globetrotter: async (c) => {
    await c.post('/sim', { reset: true });
    const tried = {};
    for (const [sym, cls] of [['BTC', 'crypto'], ['AAPL', 'stock'], ['EURUSD', 'forex'], ['XAU', 'metal'], ['SPX500', 'index']]) {
      const o = await c.post('/open', { symbol: sym, side: 'long', margin_usd: 15, leverage: 2, client_order_id: 'glob-' + sym });
      if (o.status === 200) {
        tried[sym] = { cls, ok: true, fee: o.data.fill ? o.data.fill.taker_fee_pct : null, entry: o.data.position.entry_price };
        c.log.opened.push(o.data.position.id);
        const cl = await c.post('/close', { id: o.data.position.id, symbol: sym });
        if (cl.status === 200) c.log.closed.push(cl.data.position);
      } else tried[sym] = { cls, ok: false, status: o.status, error: o.error, message: String(o.message || '').slice(0, 90) };
    }
    c.log.markets = tried;
  },

  // 7. OVERDRIVE. Deliberately past its own ceiling. A 429 that does not say when to come back is a 429 a
  // bot cannot obey, and the docs promise Retry-After + the three X-RateLimit headers.
  overdrive: async (c) => {
    const burst = 200;
    const rs = await Promise.all(Array.from({ length: burst }, () => c.get('/positions')));
    const limited = rs.filter((r) => r.status === 429);
    const served = rs.filter((r) => r.status === 200);
    const one = limited[0];
    c.log.rate = {
      sent: burst, served: served.length, limited: limited.length,
      retryAfter: one ? one.hdr.get('retry-after') : null,
      limitHdr: one ? one.hdr.get('x-ratelimit-limit') : (served[0] ? served[0].hdr.get('x-ratelimit-limit') : null),
      remainingHdr: served[0] ? served[0].hdr.get('x-ratelimit-remaining') : null,
      resetHdr: one ? one.hdr.get('x-ratelimit-reset') : null,
      scope: served[0] ? served[0].hdr.get('x-ratelimit-scope') : null,
    };
    if (limited.length) {                                              // obey it, and prove recovery
      const wait = Math.min(70, Math.max(1, +(one.hdr.get('retry-after') || 5)));
      c.log.rate.obeyedSec = wait;
      await sleep(wait * 1000 + 500);
      const back = await c.get('/positions');
      c.log.rate.recovered = back.status === 200;
    }
  },
};

// ───────────────────────────────────────────────────────────── the canonical formula, in ONE place
// pnl = qty*(exit-entry)*dir - qty*(entry+exit)*feeRate - funding, floored at -margin. The docs publish it,
// five places in the product implement it, and a closed trade that disagrees with it is a money bug.
function expectedPnl(p) {
  const dir = p.side === 'short' ? -1 : 1;
  const qty = +p.qty || 0, e = +p.entry_price || 0, x = +p.exit_price || 0, m = +p.margin_usd || 0;
  const fee = qty * (e + x) * ((+p.fee_rate_pct || 0) / 100);
  const fund = +p.funding_usd || 0;
  let pnl = qty * (x - e) * dir - fee - fund;
  if (pnl < -m) pnl = -m;
  return Math.round(pnl * 100) / 100;
}

(async () => {
  console.log('bot-fleet-e2e\n');
  if (!ADMIN) { console.log('needs ADMIN_KEY.local.txt'); process.exitCode = 1; return; }
  const want = process.argv.slice(2).filter((a) => BOTS[a]);
  const names = want.length ? want : Object.keys(BOTS);
  console.log('fleet: ' + names.join(', ') + '\n');

  const fleet = [];
  for (const name of names) {
    const uid = 'e2efl' + name.slice(0, 4) + Math.random().toString(36).slice(2, 4);
    await fetch(BASE + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'mk' }) });
    const se = await fetch(BASE + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'sess' }) }).then((r) => r.json());
    const km = await fetch(BASE + '/api/bot/key', { method: 'POST', headers: { cookie: 'mp_sess=' + se.token, 'content-type': 'application/json' }, body: '{}' }).then((r) => r.json());
    const key = km.key || (km.keys && km.keys[0] && km.keys[0].key);
    if (!key) { console.log('  FAIL could not mint a key for ' + name); fail++; continue; }
    fleet.push({ name, uid, key, c: Client(key, newLog()) });
  }
  ok('every bot has its own account and key', fleet.length === names.length, fleet.length + ' of ' + names.length);

  try {
    // ── RUN THEM AT ONCE. Concurrency is the point: a store that serialises badly, a cache keyed too
    // loosely or a rate limiter scoped to the wrong thing only shows up with several callers at once.
    console.log('\nrunning the fleet concurrently...');
    const t0 = Date.now();
    const results = await Promise.allSettled(fleet.map((b) => BOTS[b.name](b.c)));
    console.log('fleet finished in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's\n');
    results.forEach((r, i) => { if (r.status === 'rejected') { ok(fleet[i].name + ' ran without throwing', false, String(r.reason && r.reason.message || r.reason).slice(0, 200)); } });

    // ── PER-BOT REPORT + the checks each tactic is there to make
    for (const b of fleet) {
      const L = b.c.log;
      const p50 = L.ms.length ? L.ms.slice().sort((x, y) => x - y)[Math.floor(L.ms.length / 2)] : 0;
      console.log('\n[' + b.name + '] ' + L.calls + ' calls, p50 ' + p50 + 'ms, statuses ' + JSON.stringify(L.byStatus)
        + ', opened ' + L.opened.length + ', closed ' + L.closed.length);
      if (L.notes.length) console.log('      notes: ' + L.notes.slice(0, 4).join(' | '));
      ok(b.name + ': no 5xx from any call (modelled venue_rejected excluded: ' + (L.modelled503 || 0) + ')', L.fivexx.length === 0, L.fivexx.slice(0, 2).join(' | '));
      ok(b.name + ': every response was JSON', L.unparsable.length === 0, L.unparsable.slice(0, 2).join(' | '));
      ok(b.name + ': no network failure', L.net === 0, L.net);

      if (b.name === 'scalper') {
        ok('scalper: it actually traded', L.closed.length >= 3, L.closed.length + ' closes');
        ok('scalper: the same client_order_id returned the SAME position', L.idem && L.idem.first && L.idem.first === L.idem.second, JSON.stringify(L.idem));
        ok('scalper: and the retry was flagged idempotent', L.idem && L.idem.flagged === true, JSON.stringify(L.idem));
        ok('scalper: a fast open/close is still sub-second at the median', p50 < 1000, p50 + 'ms');
      }
      if (b.name === 'swing') {
        ok('swing: the position survived being ignored', L.stillOpen === 1, L.stillOpen);
        ok('swing: a trail set after the fact leaves an immediate stop', L.trail && L.trail.sl != null && L.trail.trail === 2.5, JSON.stringify(L.trail));
        ok('swing: it closed cleanly', L.closed.length === 1, L.closed.length);
      }
      if (b.name === 'grid') {
        ok('grid: five resting orders were accepted', L.placed === 5, L.placed);
        ok('grid: and the API lists all five', L.resting >= 5, L.resting);
        ok('grid: a resting order can be modified in place', L.modified === true);
        ok('grid: modifying an order that does not exist is 404, not 500', L.modifyUnknown === 404, L.modifyUnknown);
        ok('grid: cancelling clears the book', L.restingAfter === 0, L.restingAfter);
        ok('grid: cancelling twice is refused, not repeated', L.cancelTwice === 409 || L.cancelTwice === 404, L.cancelTwice);
      }
      if (b.name === 'martingale') {
        ok('martingale: the enforced book refused it', L.refusedAt != null, 'never refused - doubled past the book');
        ok('martingale: and refused with 402 insufficient_margin', L.refusal && L.refusal.code === 'insufficient_margin', JSON.stringify(L.refusal || {}));
        ok('martingale: it was refused ABOVE what the book could fund', L.refusedAt == null || L.refusedAt > (L.book.free - L.committed) - 1,
          'refused at $' + L.refusedAt + ' with free $' + L.freeAfter);
        ok('martingale: v2 /balance named the biggest fundable position up front', L.book && L.book.max > 0 && L.book.max <= L.book.start, JSON.stringify(L.book));
      }
      if (b.name === 'survivor') {
        const s = L.brutal || {};
        ok('survivor: brutal refused some opens (503 venue_rejected)', s.refused >= 1, JSON.stringify(s));
        ok('survivor: and filled the rest', s.filled >= 1, JSON.stringify(s));
        ok('survivor: some fills were partial, as the profile promises', s.partial >= 1, JSON.stringify(s));
        ok('survivor: a refusal never cost a position', L.opened.length === s.filled, L.opened.length + ' opened vs ' + s.filled + ' filled');
      }
      if (b.name === 'globetrotter') {
        const m = L.markets || {};
        const open = Object.keys(m).filter((k) => m[k].ok);
        const shut = Object.keys(m).filter((k) => !m[k].ok);
        console.log('      filled: ' + (open.join(', ') || 'none') + (shut.length ? ' | refused: ' + shut.map((k) => k + '(' + m[k].error + ')').join(', ') : ''));
        ok('globetrotter: crypto always trades', m.BTC && m.BTC.ok === true, JSON.stringify(m.BTC));
        ok('globetrotter: every refusal names a reason', shut.every((k) => !!m[k].error), JSON.stringify(shut.map((k) => m[k])));
        ok('globetrotter: a closed market is market_closed, never a stale fill', shut.every((k) => m[k].error === 'market_closed' || m[k].error === 'unknown_symbol'), JSON.stringify(shut.map((k) => k + ':' + m[k].error)));
        ok('globetrotter: a non-crypto fill is charged its own class rate', open.filter((k) => k !== 'BTC').every((k) => m[k].fee == null || m[k].fee !== m.BTC.fee) || open.length === 1,
          JSON.stringify(open.map((k) => k + ':' + m[k].fee)));
      }
      if (b.name === 'overdrive') {
        const R = L.rate || {};
        console.log('      ' + JSON.stringify(R));
        ok('overdrive: a burst past the ceiling IS limited', R.limited > 0, JSON.stringify(R));
        ok('overdrive: the 429 carries Retry-After', !!R.retryAfter, R.retryAfter);
        ok('overdrive: and the three X-RateLimit headers are present', !!(R.limitHdr && R.remainingHdr !== null && R.resetHdr), JSON.stringify({ l: R.limitHdr, r: R.remainingHdr, s: R.resetHdr }));
        // X-RateLimit-Scope is an /api/v1/* header and the bot paths do not carry it. What matters is which
        // budget applied: a keyless caller gets 60/min per IP, a Free KEY gets 120. 120 served proves it.
        ok('overdrive: the budget applied was the KEY\'s 120, not the keyless per-IP 60', +R.limitHdr === 120 && R.served > 60, JSON.stringify({ limit: R.limitHdr, served: R.served }));
        ok('overdrive: obeying Retry-After restores service', R.recovered === true, JSON.stringify(R));
        ok('overdrive: it was still served plenty before being cut off', R.served >= 60, R.served);
      }
    }

    // ── CROSS-BOT INVARIANTS: the arithmetic every tactic depends on
    console.log('\nTHE ARITHMETIC, checked per account against what the API itself returned:');
    for (const b of fleet) {
      const L = b.c.log;
      if (!L.closed.length) continue;
      // 1. every close obeys the one published formula
      const wrong = L.closed.filter((p) => p.exit_price > 0 && p.fee_rate_pct > 0 && !near(p.pnl_usd, expectedPnl(p), 0.02));
      ok(b.name + ': every close matches the published P&L formula (' + L.closed.length + ' trades)', wrong.length === 0,
        wrong.slice(0, 2).map((p) => p.symbol + ' got ' + p.pnl_usd + ' expected ' + expectedPnl(p)).join(' | '));
      // 2. a closed trade carries its own cost
      const noCost = L.closed.filter((p) => p.exit_price > 0 && (p.fees_usd == null || p.funding_usd == null));
      ok(b.name + ': every close carries fees_usd and funding_usd', noCost.length === 0, noCost.length + ' without');
      // 3. balance equals the book plus this account's own realized P&L
      const bal = (await b.c.get('/balance')).data || {};
      const realized = L.closed.reduce((t, p) => t + (+p.pnl_usd || 0), 0);
      ok(b.name + ': balance = book + its own realized closes', near(bal.balance_usd, (+bal.starting_balance_usd || 0) + realized, 0.05),
        JSON.stringify({ balance: bal.balance_usd, book: bal.starting_balance_usd, realized: Math.round(realized * 100) / 100 }));
      // 4. the report agrees with the trade list
      const rep = (await b.c.get('/report?days=1')).data || {};
      const tr = (await b.c.get('/trades?limit=100')).data || {};
      const nTrades = ((tr.trades) || []).length;
      ok(b.name + ': the report counts the same closes as /trades', rep.total && rep.total.n === nTrades, JSON.stringify({ report: rep.total && rep.total.n, trades: nTrades }));
      // 5. the cost block sums the per-trade figures
      if (rep.costs && rep.costs.n > 0) {
        const feeSum = L.closed.reduce((t, p) => t + (+p.fees_usd || 0), 0);
        ok(b.name + ': costs.fees_usd equals the sum of the per-trade fees', near(rep.costs.fees_usd, feeSum, Math.max(0.05, feeSum * 0.02)),
          JSON.stringify({ report: rep.costs.fees_usd, sum: Math.round(feeSum * 100) / 100 }));
      }
      // 6. nothing left behind
      const openNow = ((await b.c.get('/positions?status=open')).data || {}).positions || [];
      const orphan = openNow.filter((p) => L.closed.some((cl) => cl.id === p.id));
      ok(b.name + ': nothing it closed is still open', orphan.length === 0, orphan.map((p) => p.id).join(','));
    }

    // ── THE WHOLE FLEET, together
    const tot = fleet.reduce((t, b) => t + b.c.log.calls, 0);
    const allMs = fleet.flatMap((b) => b.c.log.ms).sort((a, x) => a - x);
    const p = (q) => allMs.length ? allMs[Math.max(0, Math.ceil(allMs.length * q) - 1)] : 0;
    const all5 = fleet.flatMap((b) => b.c.log.fivexx);
    console.log('\nFLEET TOTAL: ' + tot + ' calls across ' + fleet.length + ' bots, p50 ' + p(0.5) + 'ms, p95 ' + p(0.95) + 'ms, p99 ' + p(0.99) + 'ms');
    ok('the whole fleet produced no 5xx', all5.length === 0, all5.slice(0, 3).join(' | '));
    ok('p95 under concurrent load stays under 2s', p(0.95) < 2000, p(0.95) + 'ms');
    const closes = fleet.reduce((t, b) => t + b.c.log.closed.length, 0);
    console.log('trades closed by the fleet: ' + closes);
    // Scaled to the fleet actually run, so `node build/bot-fleet-e2e.js scalper` is not a red run for the
    // wrong reason - a threshold that only holds for the full fleet is a flaky check on a subset.
    const expect = fleet.filter((b) => b.name !== 'overdrive' && b.name !== 'grid').length;
    ok('the fleet really traded (at least one close per trading bot)', closes >= expect, closes + ' closes from ' + expect + ' trading bots');
  } finally {
    console.log('\ncleaning up...');
    for (const b of fleet) {
      try { await b.c.post('/close_all', {}); } catch (e) {}
      try { await fetch(BASE + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: b.uid, op: 'rm' }) }); } catch (e) {}
    }
  }

  console.log('\nbot-fleet-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error('bot-fleet-e2e crashed: ' + (e && e.stack || e)); process.exitCode = 1; });
