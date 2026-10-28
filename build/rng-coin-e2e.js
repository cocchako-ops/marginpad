/* THE RNG MARKET (2026-10-28, owner: "Da li mozemo da ubacimo RNG Marginpad coin (RNG kao kategorija)? Ne sme da se
   racuna u leaderboards ali u ostale stvari moze. Nemoj samo da ima nekih problema, napravi to dobro.")

   The one property that cannot be fixed later is that the SETTLEMENT SWEEP reads the 1m candle minutes or hours after
   the trader saw the price. So the pure half lifts the shipped engine out of worker.js and proves the candle is the
   seconds inside it and recomputes identically for a past minute; the live half opens a REAL position, lets the
   server settle it, and then proves the exclusion the owner asked for is real: no XP, no Ticks, no board row.
   node build/rng-coin-e2e.js            --pure = the engine and the tables, no network                            */
'use strict';
const fs = require('fs'), path = require('path');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const PURE = process.argv.indexOf('--pure') >= 0;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// lift a top-level function out of the SHIPPED worker by brace matching
function lift(names) {
  let code = '';
  for (const n of names) {
    const i = src.indexOf('function ' + n + '(');
    if (i < 0) throw new Error(n + ' not in worker');
    let d = 0, j = src.indexOf('{', i), end = -1;
    for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) { end = k + 1; break; } }
    code += src.slice(i, end) + '\n';
  }
  // scan to the first ';' at bracket depth 0 - a lazy regex ran past the end of RNG_GENESIS because a trailing
  // comment sits between its ';' and the newline, and swallowed the next declaration whole
  const consts = ['RNG_GENESIS', 'RNG_OCT', 'RNG_COINS'].map(n => {
    const i = src.indexOf('const ' + n + ' = ');
    if (i < 0) throw new Error(n + ' not found');
    let d = 0, end = -1;
    for (let k = i; k < src.length; k++) {
      const ch = src[k];
      if (ch === '{' || ch === '[' || ch === '(') d++;
      else if (ch === '}' || ch === ']' || ch === ')') d--;
      else if (ch === ';' && d === 0) { end = k + 1; break; }
    }
    if (end < 0) throw new Error(n + ' unterminated');
    return src.slice(i, end);
  }).join('\n');
  return new Function(consts + '\n' + code + '\nreturn {' + names.join(',') + ',RNG_COINS,RNG_GENESIS};')();
}

(async () => {
  console.log('-- pure: the price engine, lifted from the shipped worker');
  const E = lift(['_rngH', '_rngNoise', 'rngKey', 'rngPx', 'rngCandle', 'rngKlines']);
  const now = Math.floor(Date.now() / 1000);
  ok(Object.keys(E.RNG_COINS).length >= 1, 'the coin table is present (' + Object.keys(E.RNG_COINS).join(',') + ')');
  const S = Object.keys(E.RNG_COINS)[0];
  ok(E.rngPx(S, now) === E.rngPx(S, now), 'the same second gives the same price');
  const past = now - 3 * 86400, pm = Math.floor(past / 60) * 60;
  ok(E.rngPx(S, past) === E.rngPx(S, past), 'a three-day-old price recomputes identically');
  const c1 = JSON.stringify(E.rngCandle(S, pm, 60)), c2 = JSON.stringify(E.rngCandle(S, pm, 60));
  ok(c1 === c2, 'a three-day-old 1m candle recomputes identically ' + c1);
  ok(E.rngPx('NOPE', now) === null, 'an unknown symbol has no price');
  // THE LOAD-BEARING ONE: the 1m candle bounds every second inside it, because that is what the sweep settles from
  let inside = 0, tot = 0, oc = 0;
  for (let k = 0; k < 400; k++) {
    const m0 = Math.floor((now - k * 60) / 60) * 60, cd = E.rngCandle(S, m0, 60);
    for (let s = 0; s < 60; s++) { const p = E.rngPx(S, m0 + s); tot++; if (p >= cd.l && p <= cd.h) inside++; }
    if (cd.o === E.rngPx(S, m0) && cd.c === E.rngPx(S, m0 + 59)) oc++;
  }
  ok(inside === tot, 'every second of 400 one-minute candles lies inside its own high/low (' + inside + '/' + tot + ')');
  ok(oc === 400, 'the open is the first second and the close the last, in all 400');
  // continuity: no gaps, or a stop could be jumped over
  let joins = 0;
  for (let k = 1; k < 300; k++) { const b = Math.floor((now - k * 60) / 60) * 60; const a = E.rngCandle(S, b, 60), n2 = E.rngCandle(S, b + 60, 60); if (Math.abs(n2.o - a.c) / a.c < 0.0008) joins++; }
  ok(joins >= 295, 'candle N+1 opens where candle N closed (' + joins + '/299) - no gap for a stop to jump');
  // a tradable band: never zero, never a blow-up
  let lo = Infinity, hi = 0;
  for (let k = 0; k < 30000; k++) { const p = E.rngPx(S, E.RNG_GENESIS + k * 311); if (p < lo) lo = p; if (p > hi) hi = p; }
  ok(lo > 0 && hi / lo < 12, 'the price stays in a tradable band since genesis (' + lo.toFixed(2) + ' .. ' + hi.toFixed(2) + ')');
  // volatility measured, not assumed: alive but not a slot machine
  const rets = [];
  for (let k = 0; k < 5000; k++) { const a = E.rngPx(S, now - (k + 1) * 60), b = E.rngPx(S, now - k * 60); rets.push(Math.abs(b - a) / a); }
  rets.sort((x, y) => x - y);
  const med = rets[rets.length >> 1] * 100;
  ok(med > 0.02 && med < 0.25, 'the median minute moves ' + med.toFixed(3) + '% - between BTC (~0.05%) and SOL (~0.09%), so 10x is reachable but not instant');
  // nothing before genesis
  ok(E.rngKlines(S, 86400, 1000, 0).every(b => b.t + 86400 > E.RNG_GENESIS), 'no candle is dated before genesis');

  console.log('-- pure: it ranks nowhere, by the table and not by a literal');
  const body = src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).filter(l => !/^\s*\/\//.test(l)).join('\n');
  ok(/for \(const k of Object\.keys\(RNG_COINS\)\) LB_EXCL_SET\.add\(k\)/.test(body), 'every RNG symbol is added to LB_EXCL_SET from the table, so a second coin is excluded without an edit');
  ok(/if \(RNG_COINS\[sym\]\) return 'rng'/.test(body), "assetClassOf returns its own class - it must never read as 'crypto' or the client opens a Bybit socket for it");
  ok(/if \(RNG_COINS\[sym\]\) return RNG_COINS\[sym\]\.lev/.test(body), 'the leverage cap comes from the coin table');
  ok(/if \(RNG_COINS\[sym\]\)/.test(body.slice(body.indexOf('async function leanKlines'))), 'leanKlines - the function the settlement sweep reads - has its own RNG branch');
  // and the exclusion flag really is the one that gates earnings, which is why no new flag was invented
  ok(/kind === 'close' && !lbExcluded\(e\.sym\)[\s\S]{0,200}_grantXp/.test(body), 'trade XP is gated on the same exclusion, so an RNG close cannot mint XP into the season XP board');
  ok(/kind === 'close' && !lbExcluded\(e\.sym\)[\s\S]{0,200}_grantTicks/.test(body), 'trade Ticks are gated on it too - Ticks are buyable with real money');
  if (PURE) { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }

  console.log('-- live: the routes');
  const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
  const j = async (p, opt) => { const r = await fetch(O + p, opt); let b = null; try { b = await r.json(); } catch (e) {} return { s: r.status, b }; };
  const AH = { 'x-admin-key': K, 'content-type': 'application/json' };
  const cat = await j('/api/rng');
  const coin = cat.b && (cat.b.coins || [])[0];
  ok(cat.s === 200 && coin && coin.symbol === S, 'the catalogue serves the coin (' + (coin && coin.symbol) + ' at ' + (coin && coin.price) + ')');
  ok(coin && coin.ranksOnLeaderboards === false, 'the catalogue states plainly that it does not rank');
  ok(coin && coin.maxLeverage === E.RNG_COINS[S].lev && coin.feePctPerSide > 0, 'it publishes the leverage cap and the fee from the same table (' + (coin && coin.maxLeverage) + 'x, ' + (coin && coin.feePctPerSide) + '%)');
  const pr = await j('/api/price?symbol=' + S);
  ok(pr.b && pr.b.price > 0 && pr.b.rng === true, 'the price route answers (' + (pr.b && pr.b.price) + ')');
  // NO `state`: that field is what marks a market with opening hours, and this one never closes
  ok(pr.b && pr.b.state === undefined, 'the price carries no market-state field, so nothing can read it as closed');
  const kl = await j('/api/klines?symbol=' + S + '&interval=1&limit=5');
  ok(Array.isArray(kl.b) && kl.b.length === 5 && kl.b.every(b => b.time > 0 && b.open > 0 && b.high >= b.low && 'vol' in b), 'klines answer as a bare array in the house shape');
  ok(kl.b.every(b => b.high >= b.open && b.high >= b.close && b.low <= b.open && b.low <= b.close), 'every candle is internally consistent');
  const kl2 = await j('/api/klines?symbol=' + S + '&interval=1&limit=5');
  ok(JSON.stringify(kl.b.slice(0, 3)) === JSON.stringify(kl2.b.slice(0, 3)), 'the closed candles are identical on a second request');
  // the served candle must equal the engine's own answer - the chart and the sweep read the same thing
  const eng = E.rngCandle(S, kl.b[0].time, 60);
  ok(eng && Math.abs(eng.o - kl.b[0].open) < 1e-9 && Math.abs(eng.h - kl.b[0].high) < 1e-9 && Math.abs(eng.l - kl.b[0].low) < 1e-9, 'the served candle equals the engine recomputed locally (served ' + JSON.stringify(kl.b[0]) + ')');

  console.log('-- live: a real position, opened and settled by the server');
  const t = Date.now().toString(36), uid = 'e2erng' + t;
  await j('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) });
  const xp0 = await j('/api/auth/xp?fresh=1&uid=' + uid, { headers: AH });
  const px = (await j('/api/price?symbol=' + S)).b.price;
  const open = await j('/api/trade/open?uid=' + uid, { method: 'POST', headers: AH, body: JSON.stringify({ symbol: S, side: 'long', margin: 100, lev: 10, cid: 'rng' + t }) });
  const pos = open.b && (open.b.position || open.b.raw || open.b);
  ok(open.s === 200 && pos && +pos.entry > 0, 'a 10x long opens on the RNG market (entry ' + (pos && pos.entry) + ' vs live ' + px + ')');
  ok(pos && Math.abs(+pos.entry - px) / px < 0.02, 'it filled at the live price, not at some other market');
  const liq = +(pos && (pos.liq || pos.liq_price)) || 0;
  ok(liq > 0 && liq < +pos.entry, 'it carries a liquidation price below the entry (' + liq + ')');
  ok(Math.abs((1 - liq / +pos.entry) - 0.0945) < 0.01, 'the liq sits ~9.45% away, the house formula at 10x (' + ((1 - liq / +pos.entry) * 100).toFixed(2) + '%)');
  // settle it with the admin sweep hook at a price past the stop
  const tid = pos.id || pos.trade_id;
  // A STOP ON A LONG GOES BELOW THE ENTRY. The first cut put it above, which is the wrong side - the server refuses
  // it (sl_wrong_side), so nothing was armed and the sweep correctly closed nothing. Assert the stop was ACCEPTED
  // before asking the sweep to act on it, or a silent refusal reads as a broken sweep.
  const sl = Math.round(+pos.entry * 0.98 * 1e4) / 1e4;
  const st = await j('/api/trade/sltp?uid=' + uid, { method: 'POST', headers: AH, body: JSON.stringify({ id: tid, sl }) });
  ok(st.s === 200 && !(st.b && st.b.error), 'the stop was accepted at ' + sl + ' (' + JSON.stringify(st.b).slice(0, 120) + ')');
  const sw = await j('/api/admin/sweeptest?uid=' + uid + '&px=' + S + ':' + Math.round(+pos.entry * 0.97 * 1e4) / 1e4, { headers: AH });
  ok(sw.s === 200 && +(sw.b && sw.b.swept) >= 1, 'the sweep settled the position from a price past the stop (' + JSON.stringify(sw.b).slice(0, 160) + ')');
  await sleep(2500);
  /* THE POSITION ITSELF IS THE PROOF, and the strong form of it. The route returns CLOSED rows too, so "the id is
     gone from the body" was never going to fail - it has to be read. The close must sit AT the stop and the P&L must
     be the house formula: a 2% adverse move at 10x is -20% of margin, plus the round-trip fee. */
  const op = await j('/api/trade/positions?uid=' + uid, { headers: AH });
  const row = ((op.b && op.b.positions) || []).find(p => String(p.id) === String(tid));
  ok(!!row && row.status === 'closed', 'the server closed the position from the 1m candle (status ' + (row && row.status) + ')');
  ok(row && Math.abs(+row.exit_price - sl) < 1e-6, 'it closed AT the stop, not at some other price (' + (row && row.exit_price) + ' vs ' + sl + ')');
  const expect = -(100 * 0.20) - (+row.fees_usd || 0);
  ok(row && Math.abs(+row.pnl_usd - expect) < 0.6, 'the P&L is the house formula: 2% against a 10x $100 position, plus fees (' + (row && row.pnl_usd) + ' vs ~' + expect.toFixed(2) + ')');

  console.log('-- live: and it earns nothing and ranks nowhere');
  const xp1 = await j('/api/auth/xp?fresh=1&uid=' + uid, { headers: AH });
  const g0 = (xp0.b && (xp0.b.xp || xp0.b.total || 0)) || 0, g1 = (xp1.b && (xp1.b.xp || xp1.b.total || 0)) || 0;
  ok(g1 === g0, 'the close granted NO XP (' + g0 + ' -> ' + g1 + ') - so it cannot reach the season XP board');
  const tk = xp1.b && (xp1.b.ticks != null ? xp1.b.ticks : null), tk0 = xp0.b && (xp0.b.ticks != null ? xp0.b.ticks : null);
  ok(tk === null || tk === tk0, 'and NO Ticks (' + tk0 + ' -> ' + tk + ')');
  const lb = await j('/api/reward/lb?full=1&nc=1&cb=' + Date.now());
  const mine = ['top', 'topGreen', 'topWr', 'topXp', 'topGold'].flatMap(k => ((lb.b && lb.b[k]) || []).filter(r => String(r.who || r.name || '').indexOf(uid) >= 0 || String(r.who || '') === 'e2e_' + uid));
  ok(mine.length === 0, 'the account appears on no board (' + mine.length + ')');
  const anyRng = ['top', 'topGreen', 'topWr'].flatMap(k => ((lb.b && lb.b[k]) || []).filter(r => String(r.symbol || '').toUpperCase() === S));
  ok(anyRng.length === 0, 'no board row anywhere carries the RNG symbol (' + anyRng.length + ')');
  await j('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'rm' }) });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
