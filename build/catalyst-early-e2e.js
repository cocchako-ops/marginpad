// WHAT MOVED IT, THE EARLY HALF - the proof (2026-11-05).
//   --pure      lifts cxEarlyDecide / cxEarlySettleOne / cxEarlyAccAdd / cxEarlyMuted / cxEarlyText out of the SHIPPED worker:
//               a media headline is never an early alert however loud (measured: a coin flip from our clock), an exchange's own
//               delisting is, a Coinbase listing through a desk is, a follow-up to a story the market already had is not, a desk
//               ten minutes late is not, a small hack is not, a major story is; settlement reads the hour from the record's own
//               minute; a cell that keeps missing mutes itself and a muted cell stops alerting. `--falsify` lets media news
//               through the gate and must turn red.
//   (default)   production: /api/catalysts/early answers with the shape the chart and the desk read, for a coin and for all.
//   node build/catalyst-early-e2e.js [--pure] [--falsify]
'use strict';
const fs = require('fs'), path = require('path');
const ARGS = process.argv.slice(2), has = k => ARGS.includes(k);
const PURE = has('--pure'), FALSIFY = has('--falsify');
const BASE = 'https://marginpad.io';
let pass = 0, fail = 0;
const ok = (name, cond, note) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (note !== undefined ? '  -> ' + String(note).slice(0, 240) : '')); } };

function lift() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
  const a = src.indexOf('const CX_BEFORE_MS'), b = src.indexOf('// GET /api/catalysts/moves?symbol=');
  if (a < 0 || b < 0 || b < a) throw new Error('cx block not found in worker.js');
  let block = src.slice(a, b);
  if (block.indexOf('function cxEarlyDecide') < 0) throw new Error('cxEarlyDecide is not inside the lifted block');
  if (FALSIFY) {
    const from = "const why = exch ? 'exchange' : major ? 'major' : strong ? 'score' : null;";
    if (block.indexOf(from) < 0) throw new Error('falsify anchor missing');
    block = block.split(from).join("const why = exch ? 'exchange' : major ? 'major' : strong ? 'score' : 'any';");
  }
  return new Function(block + '\nreturn { cxEarlyDecide, cxEarlySettleOne, cxEarlyAccAdd, cxEarlyMuted, cxEarlyText, cxEarlyAccPublic, cxEnrich, CX_EARLY_MUTE_N, CX_HACK_MIN_USD };')();
}
function pureLeg() {
  const X = lift();
  const now = Date.UTC(2026, 10, 5, 12, 0, 0);
  const item = (over) => Object.assign({ id: 'id' + Math.random().toString(36).slice(2, 10), ts_src: now - 60000, ts_seen: now - 40000, source: 'rss:coindesk', tier: 'mediaA', kind: 'news', expect: 0, syms: 'SOL', market: '', score: 48, conf: 1, title: 'Solana ecosystem sees new wallet growth', url: 'https://x', snippet: '' }, over || {});
  const en = (it) => X.cxEnrich([it], { m: {} })[0];
  console.log('[pure] the gate, measured from our own clock');
  ok('a media headline on a coin is NEVER an early alert, however fresh (coin flip measured)', X.cxEarlyDecide(en(item()), now, {}) === null);
  ok('a hack headline from a desk is not either (direction right 49-54%)', X.cxEarlyDecide(en(item({ kind: 'hack', title: 'Protocol drained of $4M', score: 55 })), now, {}) === null);
  const del = X.cxEarlyDecide(en(item({ source: 'bybit-ann', tier: 'primary', kind: 'delisting', expect: -1, syms: 'ZRO', title: 'Delisting of ZROUSDT Perpetual Contract', score: 65 })), now, {});
  ok('the exchange\'s own delisting IS (F0: 69% down, n 164), with its expectation and its measured record', !!del && del.type === 'landed' && del.why === 'exchange' && del.expect === -1 && del.syms[0] === 'ZRO' && del.exp && del.exp.n >= 12, JSON.stringify(del));
  ok('and its text names the kind, the exchange and the record, never a forecast', /delisting on bybit/.test(del.text || X.cxEarlyText(del)) && /n 1\d\d/.test(X.cxEarlyText(del)), X.cxEarlyText(del));
  const lst = X.cxEarlyDecide(en(item({ source: 'rss:theblock', tier: 'mediaA', kind: 'listing', expect: 1, syms: 'ZRO', title: 'Coinbase lists ZRO on its spot market', score: 50 })), now, {});
  ok('a listing reported by a primary desk IS (13 first reports: 77% up, 1.8x the usual hour)', !!lst && lst.type === 'landed' && lst.expect === 1, JSON.stringify(lst));
  ok('a listing from an aggregator desk is not (n 1)', X.cxEarlyDecide(en(item({ source: 'rss:cryptopotato', tier: 'mediaB', kind: 'listing', expect: 1, syms: 'ZRO', title: 'Coinbase lists ZRO' })), now, {}) === null);
  ok('a delisting from a media desk is not (the exchange\'s own only)', X.cxEarlyDecide(en(item({ source: 'rss:theblock', tier: 'mediaA', kind: 'delisting', expect: -1, syms: 'ZRO', title: 'Bybit delists ZRO' })), now, {}) === null);
  ok('a desk reporting twelve minutes after its own timestamp reports a move, it does not precede one (10 min for a story)', X.cxEarlyDecide(Object.assign(en(item({ source: 'rss:theblock', tier: 'mediaA', kind: 'regulation', expect: 1, syms: 'ZRO', title: 'SEC drops its case against ZRO issuer', score: 75, ts_src: now - 12 * 60000 })), {}), now, {}) === null);
  ok('a listing through a slow feed keeps 30 minutes (CoinDesk RSS is 22 min late on median), not more', !!X.cxEarlyDecide(en(item({ source: 'rss:coindesk', tier: 'mediaA', kind: 'listing', expect: 1, syms: 'ZRO', title: 'Coinbase lists ZRO', ts_src: now - 25 * 60000 })), now, {}) && X.cxEarlyDecide(en(item({ source: 'rss:coindesk', tier: 'mediaA', kind: 'listing', expect: 1, syms: 'ZRO', title: 'Coinbase lists ZRO', ts_src: now - 40 * 60000 })), now, {}) === null);
  ok('an item seen four minutes ago is not this minute\'s', X.cxEarlyDecide(en(item({ source: 'bybit-ann', tier: 'primary', kind: 'delisting', expect: -1, ts_seen: now - 4 * 60000, ts_src: now - 4 * 60000 - 1000 })), now, {}) === null);
  ok('a tradfi perp announcement is not a coin event', X.cxEarlyDecide(en(item({ source: 'bybit-ann', tier: 'primary', kind: 'listing', expect: 1, syms: 'NVDA', market: 'tradfi', title: 'New listing: NVDAUSDT TradFi perpetual' })), now, {}) === null);
  ok('an item naming four coins is about the market, not a coin', X.cxEarlyDecide(en(item({ source: 'bybit-ann', tier: 'primary', kind: 'listing', expect: 1, syms: 'A,B,C,D', title: 'New listings: A B C D' })), now, {}) === null);
  // a story: two desks, the second 30 minutes after the first - a follow-up never lands
  const first = now - 35 * 60000;
  const st = X.cxEnrich([item({ id: 'f1', ts_src: first, ts_seen: first + 20000, source: 'rss:theblock', kind: 'listing', expect: 1, syms: 'ZRO', title: 'Coinbase to list ZRO perps', score: 50 }), item({ id: 'f2', ts_src: now - 60000, ts_seen: now - 30000, source: 'rss:decrypt', kind: 'listing', expect: 1, syms: 'ZRO', title: 'Coinbase to list ZRO perps, says desk', score: 50 })], { m: { f1: { imp: 60, sum: 'Coinbase lists ZRO', story: 'coinbase-zro-listing', kind: 'listing', syms: ['ZRO'], expect: 1 }, f2: { imp: 60, sum: 'Coinbase lists ZRO', story: 'coinbase-zro-listing', kind: 'listing', syms: ['ZRO'], expect: 1 } } });
  const fu = st.find(x => x.id === 'f2');
  ok('the second desk on a 35-minute-old story is a follow-up: no alert', fu && fu.story && fu.story.n === 2 && X.cxEarlyDecide(fu, now, {}) === null, JSON.stringify(fu && fu.story));
  const maj = en(item({ id: 'm1', source: 'tg:BWEnews', tier: 'mediaA', kind: 'adoption', expect: 1, syms: 'HYPE', title: 'NYSE parent ICE to bring HYPE perps to US markets', score: 40 }));
  maj.major = true; maj.story = { k: 'ice-hyperliquid', n: 3, first: now - 60000, firstTitle: maj.title, firstSource: maj.source, firstUrl: '' };
  const mj = X.cxEarlyDecide(maj, now, {});
  ok('a MAJOR story (two desks, importance 70+) lands, keyed on the story', !!mj && mj.why === 'major' && mj.key === 'l:ice-hyperliquid' && mj.desks === 3, JSON.stringify(mj));
  ok('a small hack never lands even as a major story', X.cxEarlyDecide(Object.assign(en(item({ kind: 'hack', title: 'Bridge drained of $4M', score: 80 })), { major: true }), now, {}) === null);
  const bigHack = Object.assign(en(item({ kind: 'hack', expect: -1, title: 'Exchange hacked for $120M, withdrawals halted', score: 85 })), { major: true });
  ok('a $120M hack lands with a down expectation', (X.cxEarlyDecide(bigHack, now, {}) || {}).expect === -1);
  // the replay's three holes (2026-11-05)
  const fu2 = X.cxEnrich([item({ id: 'h2', kind: 'hack', expect: -1, title: 'Grok AI predicts wild Bitcoin price amid $6.3B Binance hack', score: 85 })], { m: { h2: { imp: 30, sum: 'commentary on the hack', story: 'binance-hack-commentary', kind: 'hack', syms: ['BTC'], expect: 0 } } })[0];
  ok('a headline that only MENTIONS a $6.3B hack (score 80 by the money rule, importance 30 by the model) is not an alert', X.cxEarlyDecide(fu2, now, {}) === null, JSON.stringify([fu2.score, fu2.lbl && fu2.lbl.imp]));
  const cards = X.cxEarlyDecide(en(item({ source: 'rss:theblock', tier: 'mediaA', kind: 'listing', expect: 1, syms: 'BTC,CARDS,USDT', title: 'Upbit to list CARDS with KRW, BTC and USDT trading pairs', score: 50 })), now, {});
  ok('a listing naming the quote coins is recorded on the coin being listed, not on BTC', !!cards && cards.syms[0] === 'CARDS' && cards.syms.indexOf('BTC') < 0, JSON.stringify(cards && cards.syms));
  ok('a venue adding Bitcoin trading, reported by a desk, is not a listing alert on BTC', X.cxEarlyDecide(en(item({ source: 'rss:theblock', tier: 'mediaA', kind: 'listing', expect: 1, syms: 'BTC', title: 'Moscow Exchange to launch Bitcoin trading in December', score: 50 })), now, {}) === null);
  ok('a collateral notice is not a delisting', X.cxEarlyDecide(en(item({ source: 'bybit-ann', tier: 'primary', kind: 'delisting', expect: -1, syms: 'BILL', title: 'Discontinuation of ZIG, BILL, SATS as Collateral and Lending', score: 65 })), now, {}) === null);

  console.log('[pure] the record settles against its own minute');
  const T = now - 70 * 60000; const bars = []; let p = 100;
  for (let i = -30; i < 80; i++) { const t = Math.floor((T + i * 60000) / 1000); const o = p; if (i >= 0 && i < 20) p = p * 1.001; else if (i >= 20 && i < 40) p = p * 0.9995; bars.push({ time: t, open: o, high: Math.max(o, p) * 1.0005, low: Math.min(o, p) * 0.9995, close: p }); }
  const rec = { type: 'landed', seen: T, expect: 1, cell: 'listing|mediaA|plain' };
  const s1 = X.cxEarlySettleOne(rec, bars, 0.002);
  ok('r15 and r60 are read from the close before the minute, the hour\'s extremes with them', !!s1 && s1.r15 > 1.4 && s1.r15 < 1.7 && s1.r60 > 0.9 && s1.r60 < 1.2 && s1.up >= s1.r60 && s1.dn <= 0, JSON.stringify(s1));
  ok('big = the hour moved 1.5x the usual hour (base15 x 2); the direction we said was right', s1 && s1.big === true && s1.hit === true && s1.x60 > 1.5, JSON.stringify(s1));
  const s2 = X.cxEarlySettleOne({ type: 'landed', seen: T, expect: -1, cell: 'x' }, bars, 0.01);
  ok('against a wild coin the same hour is not big, and a down expectation was wrong', s2 && s2.big === false && s2.hit === false, JSON.stringify(s2));
  ok('no bars at the minute = no settlement, never a zero', X.cxEarlySettleOne(rec, bars.slice(0, 10), 0.002) === null);
  ok('an ahead record settles from the print\'s own time, direction unscored', (X.cxEarlySettleOne({ type: 'ahead', ts: T, expect: 0, cell: 'macro' }, bars, 0.002) || {}).hit === null);

  console.log('[pure] the accuracy table mutes a cell that keeps missing');
  let acc = {};
  for (let i = 0; i < X.CX_EARLY_MUTE_N; i++) acc = X.cxEarlyAccAdd(acc, { cell: 'news|mediaA|score', settled: { x60: 0.8, big: false, hit: i % 4 === 0 } });
  ok('twenty settled misses: the cell is muted', X.cxEarlyMuted(acc, 'news|mediaA|score') === true, JSON.stringify(acc));
  const etfIt = X.cxEnrich([item({ id: 'e1', source: 'rss:theblock', kind: 'etf', expect: 1, score: 75, title: 'SEC approves XYZ ETF' })], { m: { e1: { imp: 80, sum: 'SEC approves', story: 'xyz-etf', kind: 'etf', syms: ['SOL'], expect: 1 } } })[0];
  ok('and the gate refuses it with muted:true, naming the cell', (X.cxEarlyDecide(etfIt, now, { 'etf|mediaA|score': acc['news|mediaA|score'] }) || {}).muted === true, JSON.stringify(X.cxEarlyDecide(etfIt, now, {})));
  let acc2 = {}; for (let i = 0; i < 25; i++) acc2 = X.cxEarlyAccAdd(acc2, { cell: 'delisting|primary|plain', settled: { x60: 2.1, big: i % 3 !== 0, hit: i % 10 !== 0 } });
  ok('a cell that moves price and is right is not muted', X.cxEarlyMuted(acc2, 'delisting|primary|plain') === false);
  const pub = X.cxEarlyAccPublic(Object.assign({}, acc, acc2));
  ok('the public table carries n, the big share, the direction share and the muted flag per cell', pub['delisting|primary|plain'] && pub['delisting|primary|plain'].n === 25 && pub['delisting|primary|plain'].hitPct === 88 && pub['news|mediaA|score'].muted === true, JSON.stringify(pub));
  ok('under twenty records nothing is muted (a cell earns its verdict)', X.cxEarlyMuted({ x: { n: 19, big: 0, nd: 19, hit: 0 } }, 'x') === false);
}
async function prodLeg() {
  console.log('[prod] /api/catalysts/early');
  const get = async (u) => { const r = await fetch(BASE + u, { headers: { 'user-agent': 'Mozilla/5.0 e2e' } }); return { s: r.status, j: await r.json().catch(() => null) }; };
  const all = await get('/api/catalysts/early?h=24&nc=1');
  ok('answers 200 with items, upcoming, accuracy and the rules', all.s === 200 && all.j && Array.isArray(all.j.items) && Array.isArray(all.j.upcoming) && all.j.accuracy && typeof all.j.accuracy === 'object' && all.j.rules && /first report only/.test(all.j.rules.landed), JSON.stringify(all.j).slice(0, 300));
  ok('every item carries a type, a key, a cell and the text a member was sent', (all.j.items || []).every(r => /^(landed|ahead|moving)$/.test(r.type) && r.key && r.cell && typeof r.text === 'string'), JSON.stringify((all.j.items || []).slice(0, 2)));
  const one = await get('/api/catalysts/early?symbol=BTC&h=24&nc=1');
  ok('a symbol filter keeps that coin\'s records and every ahead record', one.s === 200 && one.j && one.j.symbol === 'BTC' && (one.j.items || []).every(r => r.type === 'ahead' || r.sym === 'BTC' || (r.syms || []).indexOf('BTC') >= 0), JSON.stringify(one.j && one.j.items && one.j.items.slice(0, 2)));
  const h = await get('/api/catalysts/health?nc=1');
  ok('the labels run inside a minute of each other now (gate 50 s)', h.j && h.j.labelsAt && Date.now() - h.j.labelsAt < 20 * 60000, h.j && h.j.labelsAt && Math.round((Date.now() - h.j.labelsAt) / 1000) + 's ago');
}
(async () => {
  if (PURE) pureLeg(); else await prodLeg();
  console.log('\n' + (PURE ? 'pure' : 'prod') + ': ' + pass + ' ok, ' + fail + ' fail' + (FALSIFY ? ' (falsified)' : ''));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
