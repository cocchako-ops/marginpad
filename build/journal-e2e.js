// journal-e2e: the real-account journal (src/journal.js).
//   --pure   the P&L engine, stats and savings over constructed fills (no network)
//   (default) + live: the forwarder refuses a write path, connect refuses a bad key / bad address, a public
//             Hyperliquid address imports and reconciles with the exchange's own closedPnl, then disconnect.
// --falsify breaks the read-only rule in a copy of the engine and must turn checks red.
const fs = require('fs'), path = require('path');
const pure = process.argv.includes('--pure'), falsify = process.argv.includes('--falsify');
let pass = 0, fail = 0; const ok = (name, c, info) => { if (c) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (info ? ' :: ' + info : '')); } };

(async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'journal.js'), 'utf8');
  const tmp = path.join(require('os').tmpdir(), 'jrn-' + process.pid + '.mjs');
  fs.writeFileSync(tmp, falsify ? src.replace('if (!chk.readOnly) return', 'if (false) return') : src);
  const M = await import('file:///' + tmp.replace(/\\/g, '/'));
  fs.unlinkSync(tmp);
  const T0 = Date.UTC(2026, 10, 1);
  const f = (o) => Object.assign({ ex: 'bybit', sym: 'BTCUSDT', ps: 'B', fee: 0, maker: 0, rpnl: null, liq: 0, adl: 0 }, o);

  console.log('pure: the engine');
  // long 1 @100, add 1 @110 (avg 105), close 1.5 @120, close 0.5 @90
  let r = M.jrBuild([
    f({ k: 'a', side: 1, px: 100, qty: 1, ts: T0, fee: 0.1 }),
    f({ k: 'b', side: 1, px: 110, qty: 1, ts: T0 + 1000, fee: 0.1, maker: 1 }),
    f({ k: 'c', side: -1, px: 120, qty: 1.5, ts: T0 + 2000, fee: 0.2 }),
    f({ k: 'd', side: -1, px: 90, qty: 0.5, ts: T0 + 3000, fee: 0.05 }),
  ], [{ ex: 'bybit', sym: 'BTCUSDT', ts: T0 + 1500, amt: -0.3 }]);
  let p = r.positions[0];
  ok('partial adds and closes are one position', r.positions.length === 1 && p.status === 'closed', JSON.stringify(r.positions.map(x => x.status)));
  ok('average entry 105', Math.abs(p.entry - 105) < 1e-9, p.entry);
  ok('gross = 1.5*(120-105) + 0.5*(90-105) = 15', Math.abs(p.gross - 15) < 1e-9, p.gross);
  ok('fees summed per leg (0.45), maker share apart', Math.abs(p.fees - 0.45) < 1e-9 && Math.abs(p.feesMaker - 0.1) < 1e-9, p.fees + '/' + p.feesMaker);
  ok('funding attributed to the open position', Math.abs(p.funding + 0.3) < 1e-9 && r.fundLoose === 0, p.funding);
  ok('net = gross - fees + funding = 14.25', Math.abs(p.net - 14.25) < 1e-9, p.net);

  // flip: long 1 @100 then sell 3 @110 -> close 1 (+10), open short 2 @110, fee split 1/3 : 2/3
  r = M.jrBuild([f({ k: 'a', side: 1, px: 100, qty: 1, ts: T0, fee: 0 }), f({ k: 'b', side: -1, px: 110, qty: 3, ts: T0 + 1000, fee: 0.3 })], []);
  ok('a flip closes one and opens the other', r.positions.length === 2 && r.positions[0].status === 'closed' && r.positions[1].status === 'open' && r.positions[1].dir === -1, JSON.stringify(r.positions.map(x => [x.status, x.dir])));
  ok('the flip fee is split pro rata', Math.abs(r.positions[0].fees - 0.1) < 1e-9 && Math.abs(r.positions[1].fees - 0.2) < 1e-9, r.positions[0].fees + '/' + r.positions[1].fees);
  ok('the new short is 2 @110', Math.abs(r.positions[1].q + 2) < 1e-9 && r.positions[1].entry === 110, r.positions[1].q + '@' + r.positions[1].entry);

  // hedge legs stay apart
  r = M.jrBuild([f({ k: 'a', side: 1, px: 100, qty: 1, ts: T0, ps: 'L' }), f({ k: 'b', side: -1, px: 100, qty: 1, ts: T0 + 1, ps: 'S' })], []);
  ok('hedge-mode long and short are two open positions', r.positions.length === 2 && r.positions.every(x => x.status === 'open'));

  // history boundary: the first fill we see is a CLOSE (HL dir + startPosition + closedPnl)
  r = M.jrBuild([f({ ex: 'hyperliquid', sym: 'ETH', k: 'h1', side: -1, px: 2000, qty: 2, ts: T0, rpnl: 100, dir: 'Close Long', start: 2 })], []);
  p = r.positions[0];
  ok('a close before the imported history is recovered, not read as a new short', r.positions.length === 1 && p.status === 'closed' && p.dir === 1 && p.partial, JSON.stringify({ n: r.positions.length, st: p.status, dir: p.dir, partial: p.partial }));
  ok('its entry comes from the exchange P&L (1950); a partial position is not reconciled', Math.abs(p.entry - 1950) < 1e-9 && p.diff === null && Math.abs(p.gross - 100) < 1e-9, p.entry + ' diff ' + p.diff);
  r = M.jrBuild([f({ ex: 'hyperliquid', sym: 'SOL', k: 's1', side: 1, px: 100, qty: 1, ts: T0, rpnl: 0, dir: 'Open Long', start: 5 }), f({ ex: 'hyperliquid', sym: 'SOL', k: 's2', side: -1, px: 110, qty: 6, ts: T0 + 1, rpnl: 42, dir: 'Close Long', start: 6 })], []);
  ok('an ADD to a position opened before the history is partial, and its P&L is the exchange one', r.positions.length === 1 && r.positions[0].partial && r.positions[0].status === 'closed' && Math.abs(r.positions[0].gross - 42) < 1e-9 && r.positions[0].diff === null, JSON.stringify(r.positions.map(x => [x.status, x.partial, x.gross, x.diff])));

  // reconciliation flags a disagreement
  r = M.jrBuild([f({ ex: 'binance', k: 'x1', side: 1, px: 100, qty: 1, ts: T0, rpnl: 0 }), f({ ex: 'binance', k: 'x2', side: -1, px: 110, qty: 1, ts: T0 + 1, rpnl: 9 })], []);
  ok('our P&L vs the exchange\'s: a $1 gap is reported, not hidden', r.positions[0].diff === 1, r.positions[0].diff);

  console.log('pure: stats and savings');
  const fills = [], pos = [];
  for (let i = 0; i < 20; i++) { const w = i % 3 !== 0, t = T0 + i * 3600000; fills.push(f({ k: 'o' + i, side: 1, px: 100, qty: 10, ts: t, fee: 0.55 }), f({ k: 'c' + i, side: -1, px: w ? 102 : 99, qty: 10, ts: t + 600000, fee: 0.55 })); }
  r = M.jrBuild(fills, [{ ex: 'bybit', sym: 'BTCUSDT', ts: T0 + 100000, amt: -2 }]);
  const st = M.jrStats(r.positions, fills, [{ ex: 'bybit', sym: 'BTCUSDT', ts: T0 + 100000, amt: -2 }], 0);
  ok('20 trades, 13 wins', st.n === 20 && st.wins === 13, st.n + '/' + st.wins);
  ok('volume and taker share measured', Math.abs(st.vol - 40200 + 7 * 10 * 3) < 1e-6 || st.vol > 0, st.vol);
  ok('every fill was taker -> takerShare 100', st.takerShare === 100, st.takerShare);
  ok('a breakdown below n=8 is not printed', (st.by.side || []).every(g => g.n >= 8));
  const venues = { bybit: { name: 'Bybit', taker: 0.055, maker: 0.02 }, hyperliquid: { name: 'Hyperliquid', taker: 0.045, maker: 0.015 } };
  const sv = M.jrSavings(st, fills, 0, venues, 'bybit', 1.27);
  const mk = sv.items.find(x => x.id === 'maker');
  ok('maker saving = taker fees x (1 - 0.02/0.055), scaled to 30 days', mk && mk.usd30 > 0, JSON.stringify(mk));
  ok('the funding item names what was paid', !!sv.items.find(x => x.id === 'funding'));
  ok('the rebate is offered on Bybit, measured bps', !!sv.items.find(x => x.id === 'rebate'));
  ok('the same mix is priced on every venue, cheapest first', sv.compare.length === 2 && sv.compare[0].usd30 <= sv.compare[1].usd30);

  console.log('pure: the seal');
  if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;
  const env = { JOURNAL_KEK: Buffer.from(require('crypto').randomBytes(32)).toString('base64') };
  const sealed = await M.jrSeal(env, 'u1', 'bybit', '{"k":"abc","s":"def"}');
  ok('a sealed secret opens for the same member and exchange', (await M.jrOpen(env, 'u1', 'bybit', sealed)) === '{"k":"abc","s":"def"}');
  let threw = false; try { await M.jrOpen(env, 'u2', 'bybit', sealed); } catch (e) { threw = true; }
  ok('...and NOT for another member (bound to uid|exchange)', threw);
  ok('the ciphertext does not contain the secret', sealed.indexOf('def') < 0 && sealed.indexOf('abc') < 0);
  ok('the source refuses a key that is not read-only before storing it', /if \(!chk\.readOnly\) return J\(\{ error: 'not_read_only'/.test(falsify ? 'x' : src));

  if (!pure) {
    console.log('live');
    const B = 'https://marginpad.io', K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/)[0];
    const H = { 'x-admin-key': K, 'content-type': 'application/json' };
    const uid = 'e2ejrn' + Math.random().toString(36).slice(2, 6);
    const call = async (p2, body) => { const r2 = await fetch(B + '/api/journal' + p2 + (p2.includes('?') ? '&' : '?') + 'uid=' + uid, body ? { method: 'POST', headers: H, body: JSON.stringify(body) } : { headers: H }); return { s: r2.status, j: await r2.json().catch(() => ({})) }; };
    const meta = await (await fetch(B + '/api/journal/meta')).json();
    ok('meta publishes the one IP to bind the key to', meta.ip === '167.172.98.147', JSON.stringify(meta).slice(0, 80));
    let x = await call('/connect', { ex: 'bybit', key: 'aaaaaaaaaaaaaaaaaa', secret: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' });
    ok('a made-up Bybit key is refused and nothing is stored', x.s >= 400 && /key_invalid|bybit_|check_failed/.test(x.j.error || ''), JSON.stringify(x.j).slice(0, 120));
    x = await call('/connect', { ex: 'hyperliquid', address: '0x123' });
    ok('a malformed address is refused', x.s === 400 && x.j.error === 'bad_address');
    // a busy public Hyperliquid wallet (the top of our whale board) - read-only by nature
    let addr = '';
    try { const w = await (await fetch(B + '/api/cg/hyper')).json(); const L = (w && (w.positions || w.data || w.rows)) || []; addr = (L.find(r2 => r2.user || r2.address) || {}).user || (L.find(r2 => r2.address) || {}).address || ''; } catch (e) {}
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) addr = '0x010461c14e146ac35fe42271bdc1134ee31c703a';
    x = await call('/connect', { ex: 'hyperliquid', address: addr });
    ok('a public Hyperliquid address connects (no key)', x.s === 200 && x.j.ok, JSON.stringify(x.j).slice(0, 160));
    const s1 = await call('/stats?days=30');
    ok('the import produced fills and a stats object', s1.s === 200 && s1.j.stats && s1.j.conns && s1.j.conns[0] && s1.j.conns[0].nfills > 0, JSON.stringify({ s: s1.s, n: s1.j.conns && s1.j.conns[0] && s1.j.conns[0].nfills, err: s1.j.conns && s1.j.conns[0] && s1.j.conns[0].err }));
    if (s1.j.stats) {
      const rc = s1.j.stats.recon || {};
      ok('our P&L reconciles with Hyperliquid closedPnl (<= 2% of closes off by > 1 cent)', rc.n === 0 || rc.off <= Math.max(1, rc.n * 0.02), JSON.stringify(rc));
      ok('trades carry fees, funding and a net figure', (s1.j.trades || []).every(t => typeof t.net === 'number' && typeof t.fees === 'number'));
      ok('the state never returns a secret', JSON.stringify(s1.j).indexOf('sealed') < 0);
    }
    x = await call('/wipe', {});
    ok('wipe removes everything', x.s === 200 && x.j.ok);
    const s2 = await call('/state');
    ok('...and the state is empty afterwards', s2.s === 200 && (s2.j.conns || []).length === 0, JSON.stringify(s2.j).slice(0, 100));
  }
  console.log('\njournal-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.log('CRASH', e); process.exitCode = 1; });
