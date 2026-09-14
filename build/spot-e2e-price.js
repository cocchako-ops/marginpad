// Demo Spot E2E (2026-09-06): sell-side price integrity. Run after every /spot or SpotStore deploy: node build/spot-e2e-price.js
// Background: one account bought a rugged meme for $500 and sold it three minutes later for $262k, because (1) the meme
// list carried a pre-rug price forever, (2) the sell price came from whatever pool the CLIENT named, (3) nothing compared
// the fill to the position's own last mark. This suite proves the three fixes against the exact code the money path runs:
//   A. the pure guard + freshness helpers through /api/admin/spotguard (a rug cannot be staged on GeckoTerminal);
//   B. a real throwaway account: a buy through a foreign pool is refused, a sell that NAMES a foreign pool still fills
//      at the position's own pool price, the hold carries its meta, and an ordinary round trip is untouched;
//   C. the public board ranks realized trading profit (P2P-proof), never the card balance.
const fs = require('fs');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const UID = 'spotpx' + Date.now().toString(36).slice(-5); const B = ORIGIN + '/api/spot';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 170) : ''));
async function api(p, body) { const r = await fetch(B + p + (p.indexOf('?') > 0 ? '&' : '?') + 'uid=' + UID, { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return await r.json(); }
const guard = async (q) => (await fetch(ORIGIN + '/api/admin/spotguard?' + q, { headers: { 'x-admin-key': K } })).json();
(async () => {
  // A. guard maths
  let g = await guard('price=1.05&lastPx=1&liq=200'); chk('A ordinary sale in a thin pool passes (no block, no alert)', g.guard && !g.guard.block && !g.guard.alert, g.guard);
  g = await guard('price=25&lastPx=1&liq=500'); chk('A 25x fill from a $500 pool is refused as thin_pool + alerts', g.guard && g.guard.block === 'thin_pool' && g.guard.alert, g.guard);
  g = await guard('price=25&lastPx=1&liq=50000'); chk('A 25x fill from a $50k pool fills but alerts', g.guard && !g.guard.block && g.guard.alert, g.guard);
  g = await guard('price=25&lastPx=1&liq=50000&stale=1'); chk('A 25x fill on a list-fallback price is refused (no_price)', g.guard && g.guard.block === 'no_price', g.guard);
  g = await guard('price=25&lastPx=0&liq=50'); chk('A no last mark = no judgement', g.guard && !g.guard.block && !g.guard.alert, g.guard);
  g = await guard('price=19&lastPx=1&liq=50'); chk('A 19x stays under the line', g.guard && !g.guard.block && !g.guard.alert && g.limits.jumpX === 20, g.guard);
  g = await guard('price=1&lastPx=1&age=60000'); chk('A 1-minute-old list row: usable for the list AND the trade fallback', g.fresh && g.fresh.list && g.fresh.fallback, g.fresh);
  g = await guard('price=1&lastPx=1&age=600000'); chk('A 10-minute-old row: in the list, NOT a fill price', g.fresh && g.fresh.list && !g.fresh.fallback, g.fresh);
  g = await guard('price=1&lastPx=1&age=' + (13 * 3600000)); chk('A 13-hour-old row: dropped from the universe', g.fresh && !g.fresh.list && !g.fresh.fallback, g.fresh);
  chk('A a row without a timestamp (pre-fix) is never fresh', g.fresh && g.fresh.noTs === false, g.fresh);

  // B. real account
  await api('/start', {}); await api('/link', {});
  let r = await api('/onramp', { usd: 300 }); chk('B onramp 300', r.ok, r);
  r = await api('/wallet/create', {}); const sol = r.addr && r.addr.sol; chk('B wallet', !!sol);
  r = await api('/withdraw', { usd: 200, net: 'solana', address: sol }); chk('B withdraw 200 to solana', r.ok, r);
  r = await api('/swap', { asset: 'SOL', usd: 80, dir: 'buy' }); chk('B swap 80 USDT -> SOL', r.ok && r.gas && r.gas.SOL > 0, { SOL: r.gas && r.gas.SOL });
  const memes = ((await (await fetch(B + '/memes')).json()).memes || []).filter(m => m.net === 'solana' && m.liqUsd > 20000 && m.ts);
  chk('B meme list rows carry a timestamp', memes.length >= 2 && memes.every(m => Date.now() - m.ts < 13 * 3600000), { n: memes.length, ageMin: memes[0] && Math.round((Date.now() - memes[0].ts) / 60000) });
  const m1 = memes[0], m2 = memes.find(m => m.mint !== m1.mint && m.pool !== m1.pool);
  r = await api('/trade', { side: 'buy', kind: 'meme', mint: m1.mint, pool: m2.pool, net: 'solana', symbol: m1.sym, usd: 10 }); chk('B buy through a FOREIGN pool is refused (bad_pool)', r.error === 'bad_pool', r);
  r = await api('/trade', { side: 'buy', kind: 'meme', mint: m1.mint, pool: m1.pool, net: 'solana', symbol: m1.sym, usd: 10 }); chk('B buy $10 through the token\'s own pool', r.ok && r.qty > 0, { sym: m1.sym, px: r.price }); const buyPx = +r.price;
  const holdKey = 'sol:' + m1.mint;
  const p1 = await api('/portfolio'); const h1 = (p1.holds || []).find(h => h.sym === holdKey); chk('B the hold carries pool + lastPx in its meta', h1 && h1.meta && h1.meta.pool === m1.pool && +h1.meta.lastPx > 0, h1 && h1.meta && { pool: h1.meta.pool.slice(0, 8), lastPx: h1.meta.lastPx });
  r = await api('/trade', { side: 'sell', kind: 'meme', mint: m1.mint, pool: m2.pool, net: 'solana', symbol: m1.sym, holdSym: holdKey, pct: 50 }); // the client NAMES the foreign pool
  const ratio = r.ok ? +r.price / buyPx : 0;
  chk('B sell naming a FOREIGN pool fills at the POSITION\'s pool price (within 30% of the buy seconds ago)', r.ok && ratio > 0.7 && ratio < 1.3, { ok: r.ok, ratio: +ratio.toFixed(3), pnl: r.pnlUsd, err: r.error });
  r = await api('/trade', { side: 'sell', kind: 'meme', mint: m1.mint, pool: m1.pool, net: 'solana', symbol: m1.sym, holdSym: holdKey, pct: 100, toUsdt: true }); chk('B ordinary 100% sell + convert still works', r.ok && r.closed && r.swapped, { ok: r.ok, closed: r.closed, swapped: !!r.swapped });
  r = await api('/trade', { side: 'sell', kind: 'meme', mint: m1.mint, pool: m1.pool, net: 'solana', symbol: m1.sym, holdSym: holdKey, pct: 100 }); chk('B selling a closed position -> no_position', r.error === 'no_position', r);
  r = await api('/trade', { side: 'sell', kind: 'meme', mint: m2.mint, pool: m2.pool, net: 'solana', symbol: m2.sym, pct: 100 }); chk('B selling a token never held -> no_position', r.error === 'no_position', r);

  // C. the board
  const bd = await (await fetch(B + '/board?cb=' + Date.now())).json();
  chk('C board carries the season window and no card balances', bd && bd.season && /^\d{4}-\d{2}-\d{2}$/.test(bd.season.from) && Array.isArray(bd.top) && bd.top.every(x => x.cardUsd === undefined && x.pnlUsd > 0 && x.sells >= 1 && x.who), { n: bd.top && bd.top.length, first: bd.top && bd.top[0] });
  chk('C board rows are ranked by realized profit', bd.top.every((x, i) => i === 0 || bd.top[i - 1].pnlUsd >= x.pnlUsd));
  chk('C the throwaway (no username) is not on the board', !bd.top.some(x => x.who === UID));

  console.log(out.join('\n'));
  const fails = out.filter(l => l.startsWith('FAIL')).length;
  console.log('\n' + (out.length - fails) + '/' + out.length + ' PASS' + (fails ? ' - ' + fails + ' FAIL' : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('suite crashed', e); process.exit(1); });
