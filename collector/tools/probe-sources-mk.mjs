// Runs every poller in sources-mk.js (the diff sources twice - the first call only seeds), prints size, time and the rules' reading
// of the newest rows, then proves the diff itself on a synthetic list: a new id prints a listing, an id missing once prints nothing,
// missing twice prints a delisting, a short list throws. node tools/probe-sources-mk.mjs   (from collector/)
import * as SM from '../src/catalyst/sources-mk.js';
import { classify } from '../src/catalyst/rules.js';
const SRC = [['binance-mk', SM.binanceSpot], ['binance-fut', SM.binanceFut], ['bybit-mk', SM.bybitMarkets], ['okx-mk', SM.okxMarkets], ['upbit-mk', SM.upbitMarkets], ['bithumb-mk', SM.bithumbMarkets], ['hl-spot', SM.hlSpot], ['mexc-fut', SM.mexcFut], ['bitget-fut', SM.bitgetFut]];
for (const [n, u, label, sym] of SM.STATUS) SRC.push(['status:' + n, () => SM.statusFeed(n, u, label, sym)]);
for (const [n, q] of SM.GNEWS) SRC.push(['gnews:' + n, () => SM.gnews(n, q)]);
let bad = 0;
for (const [name, fn] of SRC) {
  const t0 = Date.now(); let rows = [], err = null, seeded = null;
  try { rows = await fn(); if (!/^(status|gnews)/.test(name)) { seeded = [...SM._test.state.keys()].filter(k => k.indexOf(name.split(':')[0]) === 0).map(k => k + '=' + SM._test.state.get(k).ids.size); rows = await fn(); } } catch (e) { err = String(e.message || e); bad++; }
  console.log('\n' + name + ': ' + (err ? 'ERR ' + err : rows.length + ' rows') + ' in ' + (Date.now() - t0) + ' ms' + (seeded ? '  seeded ' + seeded.join(' ') : ''));
  for (const r of rows.slice(0, 4)) { const c = classify(r.title, name); console.log('  ' + new Date(r.ts).toISOString().slice(5, 16) + ' [' + c.kind + ' ' + (c.syms.join(',') || '-') + (c.market ? ' ' + c.market : '') + '] ' + r.title.slice(0, 100)); }
}
// the diff, offline
const mk = { list: (id, m, now) => ({ nid: 'l:' + id, ts: now, title: 'New listing: ' + m.base + ' (' + m.base + ') ' + id + ' spot on Test', url: '' }), delist: (id, m, now) => ({ nid: 'd:' + id, ts: now, title: 'Delisting of ' + m.base + ' (' + m.base + ') ' + id + ' on Test', url: '' }) };
const big = n => { const m = new Map(); for (let i = 0; i < n; i++) m.set('S' + i + 'USDT', { base: 'S' + i }); return m; };
const check = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) bad++; };
let r = SM._test.diff('t', big(60), mk); check(r.length === 0, 'the first read only seeds');
const l2 = big(60); l2.set('NEWUSDT', { base: 'NEW' }); r = SM._test.diff('t', l2, mk); check(r.length === 1 && /New listing: NEW \(NEW\)/.test(r[0].title) && classify(r[0].title, 'binance-mk').kind === 'listing' && classify(r[0].title, 'binance-mk').syms.join() === 'NEW', 'a new id is a listing the rules read as one, with the new ticker');
const l3 = big(60); l3.delete('S3USDT'); l3.set('NEWUSDT', { base: 'NEW' }); r = SM._test.diff('t', l3, mk); check(r.length === 0, 'an id missing ONCE prints nothing');
r = SM._test.diff('t', l3, mk); check(r.length === 1 && /Delisting of S3/.test(r[0].title) && classify(r[0].title, 'binance-mk').kind === 'delisting', 'missing twice in a row is a delisting');
r = SM._test.diff('t', l3, mk); check(r.length === 0, 'and it is said once');
let threw = false; try { SM._test.diff('t', big(10), mk); } catch (e) { threw = true; } check(threw, 'a short list throws instead of printing fifty delistings');
check(classify('Upbit lists ABC (ABC) KRW-ABC spot on the KRW market', 'upbit-mk').kind === 'listing', 'an Upbit market listing reads as a listing');
check(classify('Upbit designates ABC (ABC) KRW-ABC as an investment warning asset', 'upbit-mk').kind === 'warning', 'an Upbit warning reads as a warning');
check(classify('Solana status: Degraded Performance on Mainnet Beta (SOL)', 'status:solana').kind === 'protocol' && classify('Solana status: Degraded Performance on Mainnet Beta (SOL)', 'status:solana').syms.join() === 'SOL', 'a status incident reads as protocol on its chain');
console.log('\n' + (bad ? bad + ' problem(s)' : 'all good'));
process.exitCode = bad ? 1 : 0;
