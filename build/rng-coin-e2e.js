/* THE RNG SECTION AND ITS COIN, MarginPad / MPAD (2026-10-28, owner: "se zove RNG umesto da se zove Marginpad i
   zelim da ga napravis tako da je cena od danas krenula sa nekih 17 dolara, zavisi od btc-a 35% (btc-dominance), od
   zcash-a nekih 20% i od hype-a 30%, ostalo nek bude skroz random")

   THE ENGINE IS NO LONGER A PURE FUNCTION OF TIME, SO THE GUARANTEE THIS SUITE PROVES IS A DIFFERENT ONE. The first
   coin recomputed any past candle from the clock; this one depends on Bitcoin dominance, Zcash and Hyperliquid at
   that second, which are gone. What holds instead is that the series is RECORDED ONCE A MINUTE AND NEVER REWRITTEN,
   and that is what the settlement sweep reads minutes or hours after the trader saw the price. So:
     - the pure half lifts the shipped mix out of worker.js and proves the step is bounded, deterministic, and that
       a feed we could not read contributes NOTHING rather than a jump;
     - it carries the two measured regressions as checks, because both shipped and both were found by measuring:
       the random sleeve run as a WALK (-39% to +153% over 14 days), and a candle walk priced per minute per span
       (4h and 1D served no candles at all);
     - the live half opens a REAL position, lets the server settle it at the stop from the recorded candle, and then
       proves the exclusion the owner asked for: no XP, no Ticks, no board row.
   node build/rng-coin-e2e.js            --pure = the engine and the tables, no network                            */
'use strict';
const fs = require('fs'), path = require('path');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const PURE = process.argv.indexOf('--pure') >= 0;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* Lift the engine out of the SHIPPED worker - never a second copy of a money rule. `const` inside an `eval` stays
   in the eval's own block, so the declarations have to be RETURNED out of a Function. */
function lift(fns, consts) {
  const block = (head) => {
    const i = src.indexOf(head);
    if (i < 0) throw new Error('not in worker: ' + head);
    let d = 0, end = -1;
    for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) { end = k + 1; break; } }
    if (end < 0) throw new Error('unterminated: ' + head);
    return src.slice(i, end);
  };
  const code = consts.map(n => block('const ' + n + ' = {')).concat(fns.map(n => block('function ' + n + '('))).join('\n');
  return new Function(code + '\nreturn {' + consts.concat(fns).join(',') + '};')();
}

(async () => {
  console.log('-- pure: the mix, lifted from the shipped worker');
  const E = lift(['mpadFine', 'mpadRound', 'mpadPxAt', 'mpadStep', 'mpadRandLevel', '_mpH', '_mpNoise', 'mpadIs'], ['MPAD']);
  const M = E.MPAD;
  ok(M.sym === 'MPAD' && M.name === 'MarginPad', 'the coin is MPAD / MarginPad (the SECTION is RNG - owner, 2026-10-28)');
  ok(M.start === 17, 'the launch price is the $17 the owner set');
  const wsum = M.mix.reduce((a, c) => a + c.w, 0);
  ok(Math.abs(wsum - 1) < 1e-9, 'the weights sum to exactly 1 (' + M.mix.map(c => c.k + ' ' + Math.round(c.w * 100) + '%').join(' / ') + ')');
  const w = k => (M.mix.find(c => c.k === k) || {}).w;
  ok(w('dom') === 0.35 && w('hype') === 0.30 && w('zec') === 0.20, 'the three the owner named carry his own weights: dominance 35, HYPE 30, ZEC 20');
  ok(Math.abs(w('rand') - 0.15) < 1e-9, 'and the remainder is pure chance (15%)');

  // DETERMINISM: the same inputs for the same minute must give the same price, or a recorded series means nothing
  const cur = { dom: 59.4, zec: 1300, hype: 81 }, prev = { dom: 59.3, zec: 1290, hype: 80.5 };
  const a1 = E.mpadStep(17, cur, prev, 29885881), a2 = E.mpadStep(17, cur, prev, 29885881);
  ok(JSON.stringify(a1) === JSON.stringify(a2), 'one minute priced twice gives the identical step and parts');
  ok(a1.parts && ['dom', 'zec', 'hype', 'rand'].every(k => k in a1.parts), 'the step says WHY it moved - every component is reported (' + JSON.stringify(a1.parts) + ')');

  // A FEED WE COULD NOT READ CONTRIBUTES NOTHING. This is the one that keeps an outage from moving money.
  const none = E.mpadStep(17, {}, {}, 29885881);
  ok(none.parts.dom === 0 && none.parts.zec === 0 && none.parts.hype === 0, 'with every external feed missing, those components contribute exactly zero');
  const half = E.mpadStep(17, { zec: 1300 }, { zec: 1290 }, 29885881);
  ok(half.parts.zec !== 0 && half.parts.dom === 0 && half.parts.hype === 0, 'one feed present and two missing prices only the one we could read');
  ok(E.mpadStep(17, { zec: 0 }, { zec: 1290 }, 1).parts.zec === 0, 'a zero quote is treated as missing, never as a crash to nothing');
  ok(E.mpadStep(17, { zec: NaN }, { zec: 1290 }, 1).parts.zec === 0, 'and so is an unparsable one');

  // THE TWO CLAMPS: a feed glitch must not move the price, the same rule spotSellGuard applies to a meme pool
  const glitch = E.mpadStep(17, { zec: 13000 }, { zec: 1300 }, 29885881);
  ok(Math.abs(glitch.parts.zec) <= M.clampIn + 1e-9, 'a tenfold feed glitch is clamped to ' + (M.clampIn * 100) + '% on that input (' + glitch.parts.zec + ')');
  const allGlitch = E.mpadStep(17, { dom: 594, zec: 13000, hype: 810 }, { dom: 59.4, zec: 1300, hype: 81 }, 29885881);
  ok(Math.abs(allGlitch.step) <= M.clampStep + 1e-9, 'and every feed glitching at once still moves the index at most ' + (M.clampStep * 100) + '% in a minute (' + allGlitch.step + ')');
  ok(allGlitch.px > 0 && isFinite(allGlitch.px), 'the clamped price is still a real number (' + allGlitch.px + ')');
  const down = E.mpadStep(17, { zec: 1 }, { zec: 1300 }, 1);
  ok(down.px > 0 && down.px > 17 * 0.9, 'a collapse on one feed cannot wipe the price either (' + down.px + ')');

  /* THE RANDOM SLEEVE IS A BOUNDED LEVEL, NOT A WALK - and this is the shipped regression. Measured over the
     backfill's own 14 days, `(level(m) - level(m-1)) * randSd * 1440` is a worst single minute of 3.000% (the input
     clamp, hit on 2,409 of 20,160 minutes) and a drift from chance alone of -39% to +153%, which printed daily
     candles between $9.35 and $33.23 around a $17 launch. The check demands the shipped form stay bounded AND that
     the retired form would fail it, so this cannot pass for the wrong reason. */
  const drift = (perStep) => {
    let cum = 0, lo = 0, hi = 0, worst = 0, clipped = 0;
    for (let m = 1; m <= 20160; m++) {
      let r = perStep(m);
      if (Math.abs(r) > M.clampIn) { clipped++; r = Math.max(-M.clampIn, Math.min(M.clampIn, r)); }
      worst = Math.max(worst, Math.abs(r));
      cum += w('rand') * r; lo = Math.min(lo, cum); hi = Math.max(hi, cum);
    }
    return { worst, clipped, span: Math.exp(hi) - Math.exp(lo) };
  };
  const shipped = drift(m => (E.mpadRandLevel(m) - E.mpadRandLevel(m - 1)) * M.randAmp);
  const retired = drift(m => (E.mpadRandLevel(m) - E.mpadRandLevel(m - 1)) * 0.0040 * 1440);
  ok(shipped.clipped === 0, 'the random sleeve never reaches the input clamp over 14 days (' + shipped.clipped + ' of 20160 minutes)');
  ok(shipped.worst < 0.01, 'its worst single minute is under 1% before the weight (' + (shipped.worst * 100).toFixed(3) + '%)');
  ok(shipped.span < 0.25, 'chance alone moves the price by under 25% over 14 days (' + (shipped.span * 100).toFixed(1) + '%)');
  ok(retired.clipped > 1000 && retired.span > 1, 'and the retired walk form would fail all three (' + retired.clipped + ' clamped, ' + (retired.span * 100).toFixed(0) + '% span) - so these checks can fail');

  /* THE SUB-MINUTE WIGGLE IS BOUNDED AND CONTINUOUS, because the 1m candle is the exact aggregate of its own 60
     seconds and is what the sweep settles from. */
  const anchor = 17.1234, m0 = Math.floor(Date.now() / 60000) - 500, t0 = m0 * 60;
  let inside = 0, tot = 0, maxDev = 0;
  for (let k = 0; k < 400; k++) {
    const mm = (m0 - k) * 60;
    let hi = -Infinity, lo = Infinity;
    for (let s = 0; s < 60; s++) { const p = E.mpadPxAt(anchor, mm + s); if (p > hi) hi = p; if (p < lo) lo = p; maxDev = Math.max(maxDev, Math.abs(Math.log(p / anchor))); }
    for (let s = 0; s < 60; s++) { const p = E.mpadPxAt(anchor, mm + s); tot++; if (p >= lo - 1e-9 && p <= hi + 1e-9) inside++; }
  }
  ok(inside === tot, 'every second of 400 minutes lies inside that minute\'s own high/low (' + inside + '/' + tot + ')');
  ok(maxDev <= M.fineAmp + 1e-9, 'the wiggle never leaves its declared bound of ' + (M.fineAmp * 100).toFixed(2) + '% (worst ' + (maxDev * 100).toFixed(3) + '%)');
  ok(E.mpadPxAt(anchor, t0) === E.mpadPxAt(anchor, t0), 'the same anchor and second recompute identically');
  let joins = 0;
  for (let s = t0; s < t0 + 300; s++) { if (Math.abs(E.mpadPxAt(anchor, s + 1) - E.mpadPxAt(anchor, s)) / anchor < 0.0006) joins++; }
  ok(joins === 300, 'second to second it is continuous - no gap for a stop to be jumped over (' + joins + '/300)');
  ok(E.mpadRound(17.123456) === 17.1235 && String(E.mpadRound(17.1)) === '17.1', 'the price is rounded to the ' + M.dp + ' decimals it publishes');
  ok(E.mpadIs('mpadusdt') && E.mpadIs('MPAD') && !E.mpadIs('MP') && !E.mpadIs('BTC'), 'the symbol test accepts the pair spellings and nothing else');

  console.log('-- pure: it ranks nowhere, and the rules come from the table');
  const body = src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).filter(l => !/^\s*\/\//.test(l)).join('\n');
  ok(/LB_EXCL_SET\.add\(MPAD\.sym\)/.test(body), 'the house symbol is added to LB_EXCL_SET from the table, not as a literal');
  ok(/if \(sym === MPAD\.sym\) return 'house'/.test(body), "assetClassOf returns its own class - as 'crypto' the client would open a Bybit socket for a market that has none");
  ok(/if \(sym === MPAD\.sym\) return MPAD\.lev/.test(body), 'the leverage cap comes from the table');
  ok(/mpadIs\(/.test(body.slice(body.indexOf('async function leanKlines'))), 'leanKlines - the function the settlement sweep reads - has its own branch');
  ok(/mpadIs\(/.test(body.slice(body.indexOf('async function handleKlines'))), 'and so does handleKlines, which the chart reads');
  ok(/kind === 'close' && !lbExcluded\(e\.sym\)[\s\S]{0,200}_grantXp/.test(body), 'trade XP is gated on the same exclusion, so a close here cannot mint XP into the season XP board');
  ok(/kind === 'close' && !lbExcluded\(e\.sym\)[\s\S]{0,200}_grantTicks/.test(body), 'trade Ticks are gated on it too - Ticks are bought with real money');
  ok(/INSERT OR IGNORE INTO mpadpx/.test(body), 'a recorded minute is written with INSERT OR IGNORE - the guarantee that a past candle is never rewritten');
  ok(/mpad: '\/assets\/app-icon-192\.png'/.test(body), 'the coin wears our own app icon, so a four-letter ticker can never be answered with a look-alike token');
  ok(/ORDER BY m DESC LIMIT 8000/.test(body), 'the window read is DESC - a LIMIT on an ascending read would keep the oldest minutes and drop the newest candles');
  ok(!/randSd/.test(body), 'the retired walk constant is gone from the shipped source');
  if (PURE) { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }

  console.log('-- live: the catalogue, the price and the logo');
  const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
  const j = async (p, opt) => { const r = await fetch(O + p, opt); let b = null; try { b = await r.json(); } catch (e) {} return { s: r.status, b }; };
  const AH = { 'x-admin-key': K, 'content-type': 'application/json' };
  const cat = await j('/api/mpad');
  const c = cat.b || {};
  ok(cat.s === 200 && c.symbol === 'MPAD' && c.name === 'MarginPad', 'the catalogue serves the coin (' + c.symbol + ' / ' + c.name + ' at ' + c.price + ')');
  ok(c.category === 'RNG', 'and it states the SECTION the owner named: ' + c.category);
  ok(c.ranksOnLeaderboards === false && c.earnsXpOrTicks === false, 'it says plainly that it neither ranks nor earns');
  ok(c.launchPrice === 17 && c.price > 8 && c.price < 40, 'the live price is in a sane band around the $17 launch (' + c.price + ')');
  ok((c.mix || []).reduce((a, x) => a + x.weightPct, 0) === 100, 'the published mix sums to 100% (' + (c.mix || []).map(x => x.weightPct + '% ' + x.of).join(' | ') + ')');
  ok(c.head && c.head.minute > 0 && c.lagMin != null && c.lagMin <= 3, 'the recorded series is current - the minute writer is ' + c.lagMin + ' minute(s) behind');
  ok(c.inputs && (c.inputs.dom > 0 || c.inputs.zec > 0), 'the last recorded minute carries the inputs it was priced from (' + JSON.stringify(c.inputs) + ')');
  const alias = await j('/api/rng');
  ok(alias.s === 200 && alias.b && alias.b.symbol === 'MPAD', 'the /api/rng alias answers the same catalogue');
  const pr = await j('/api/price?symbol=MPAD');
  ok(pr.b && pr.b.price > 0 && pr.b.house === true && pr.b.rng === true, 'the price route answers and carries both names - the house class and the RNG section (' + (pr.b && pr.b.price) + ')');
  // NO `state`: that field is what marks a market with opening hours, and this one never closes
  ok(pr.b && pr.b.state === undefined, 'the price carries no market-state field, so nothing can read it as closed');
  const ico = await fetch(O + '/api/coinicon?sym=MPAD&v=2', { redirect: 'manual' });
  ok(ico.status === 302 && String(ico.headers.get('location') || '').indexOf('/assets/app-icon-192.png') >= 0, 'its logo resolves to our own app icon (' + ico.status + ' -> ' + ico.headers.get('location') + ')');

  /* EVERY TIMEFRAME SERVES CANDLES. This is the second shipped regression: the candle walk priced every minute of
     every span, so `interval=240&limit=1000` asked the store for 240,000 minutes, was refused as too wide, and 4h
     and 1D charts were EMPTY while 1m and 1h sat under the ceiling and looked perfectly healthy. */
  console.log('-- live: candles on every timeframe');
  for (const iv of [1, 15, 60, 240, 1440]) {
    const kl = await j('/api/klines?symbol=MPAD&interval=' + iv + '&limit=1000');
    const arr = Array.isArray(kl.b) ? kl.b : null;
    ok(!!arr && arr.length > 0, 'interval ' + iv + ' answers as a bare array with candles in it (' + (arr ? arr.length : JSON.stringify(kl.b).slice(0, 90)) + ')');
    if (!arr || !arr.length) continue;
    ok(arr.every(b => b.time > 0 && b.open > 0 && b.high >= Math.max(b.open, b.close) - 1e-9 && b.low <= Math.min(b.open, b.close) + 1e-9 && 'vol' in b), 'interval ' + iv + ': every candle is internally consistent and in the house shape');
    let lo = Infinity, hi = 0; for (const b of arr) { if (b.low < lo) lo = b.low; if (b.high > hi) hi = b.high; }
    ok(lo > 5 && hi < 60 && hi / lo < 3, 'interval ' + iv + ': the whole window stays in a tradable band (' + lo.toFixed(3) + ' .. ' + hi.toFixed(3) + ')');
    ok(arr.every((b, i) => i === 0 || b.time > arr[i - 1].time), 'interval ' + iv + ': candles are ordered oldest first with no repeats');
    // the forming candle must agree with the live price - a decimated window once closed it on a four-hour-old sample
    const last = arr[arr.length - 1], live = (await j('/api/price?symbol=MPAD')).b.price;
    ok(Math.abs(last.close - live) / live < 0.01, 'interval ' + iv + ': the forming candle closes at the live price, within 1% (' + last.close + ' vs ' + live + ')');
  }
  const k1 = await j('/api/klines?symbol=MPAD&interval=1&limit=6');
  const k2 = await j('/api/klines?symbol=MPAD&interval=1&limit=6');
  ok(JSON.stringify(k1.b.slice(0, 4)) === JSON.stringify(k2.b.slice(0, 4)), 'a closed 1m candle is byte-identical on a second request - the recorded series is never rewritten');
  ok(!(await j('/api/symbols')).b || JSON.stringify((await j('/api/symbols')).b).indexOf('MPAD') < 0, 'MPAD is NOT in /api/symbols, so no client opens an exchange socket for it');

  console.log('-- live: a real position, settled by the server from the recorded candle');
  const t = Date.now().toString(36), uid = 'e2empad' + t;
  await j('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) });
  const xp0 = await j('/api/auth/xp?fresh=1&uid=' + uid, { headers: AH });
  const px = (await j('/api/price?symbol=MPAD')).b.price;
  const open = await j('/api/trade/open?uid=' + uid, { method: 'POST', headers: AH, body: JSON.stringify({ symbol: 'MPAD', side: 'long', margin: 100, lev: 10, cid: 'mpad' + t }) });
  const pos = open.b && (open.b.position || open.b.raw || open.b);
  ok(open.s === 200 && pos && +pos.entry > 0, 'a 10x long opens on the house market (entry ' + (pos && pos.entry) + ' vs live ' + px + ')');
  ok(pos && Math.abs(+pos.entry - px) / px < 0.02, 'it filled at the live price, not at some other market');
  const liq = +(pos && (pos.liq || pos.liq_price)) || 0;
  ok(liq > 0 && liq < +pos.entry, 'it carries a liquidation price below the entry (' + liq + ')');
  ok(Math.abs((1 - liq / +pos.entry) - 0.0945) < 0.01, 'the liq sits ~9.45% away, the house formula at 10x (' + ((1 - liq / +pos.entry) * 100).toFixed(2) + '%)');
  const tid = pos.id || pos.trade_id;
  // A STOP ON A LONG GOES BELOW THE ENTRY, and the acceptance is asserted BEFORE the sweep is asked to act on it -
  // a silently refused stop (sl_wrong_side) reads exactly like a broken sweep.
  const sl = Math.round(+pos.entry * 0.98 * 1e4) / 1e4;
  const st = await j('/api/trade/sltp?uid=' + uid, { method: 'POST', headers: AH, body: JSON.stringify({ id: tid, sl }) });
  ok(st.s === 200 && !(st.b && st.b.error), 'the stop was accepted at ' + sl + ' (' + JSON.stringify(st.b).slice(0, 110) + ')');
  const sw = await j('/api/admin/sweeptest?uid=' + uid + '&px=MPAD:' + Math.round(+pos.entry * 0.97 * 1e4) / 1e4, { headers: AH });
  ok(sw.s === 200 && +(sw.b && sw.b.swept) >= 1, 'the sweep settled it from a price past the stop (' + JSON.stringify(sw.b).slice(0, 150) + ')');
  await sleep(2500);
  /* THE POSITION ROW IS THE PROOF, in its strong form: the route returns CLOSED rows too, so "the id is gone" could
     never have failed. The close must sit AT the stop and the P&L must be the house formula. */
  const op = await j('/api/trade/positions?uid=' + uid, { headers: AH });
  const row = ((op.b && op.b.positions) || []).find(p => String(p.id) === String(tid));
  ok(!!row && row.status === 'closed', 'the server closed the position (status ' + (row && row.status) + ')');
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
  const anyH = ['top', 'topGreen', 'topWr'].flatMap(k => ((lb.b && lb.b[k]) || []).filter(r => String(r.symbol || '').toUpperCase() === 'MPAD'));
  ok(anyH.length === 0, 'no board row anywhere carries the house symbol (' + anyH.length + ')');
  await j('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'rm' }) });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
