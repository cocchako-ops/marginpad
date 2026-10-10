// api-side-e2e.js - `side` means what the developer said (2026-10-10).
//
// MEASURED on the live API before this existed, with fifteen inputs: side:"sell" opened a LONG. So did
// "SELL", "SHORT", "ask", "banana", "", null, 1 and -1 - fourteen of fifteen became a long, every one with
// a 200. The reading was `b.side === 'short' ? 'short' : 'long'` and nothing else, on all three order
// paths. Every futures API a developer ports FROM - Binance, Bybit, OKX, Alpaca - says BUY/SELL, so the
// single most common first request to this endpoint traded the opposite way round and said nothing.
//
// This is a money-correctness invariant, it is invisible in our telemetry (a wrong trade is a 200), and no
// test written in our own vocabulary would ever have caught it. The verdict is taken from the LIQUIDATION
// PRICE, not from the side field the server echoes: a long liquidates below its entry and a short above
// it, so the check cannot be satisfied by a label while the position runs the other way.
//
// Usage: node build/api-side-e2e.js
const fs = require('fs');
const path = require('path');
const BASE = 'https://marginpad.io/api/bot';
const ADMIN = (() => { try { return (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-z0-9]+/i) || [''])[0]; } catch (e) { return ''; } })();
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (d != null ? '  -> ' + d : '')); } };

const LONG = ['long', 'Long', 'LONG', ' long ', 'buy', 'BUY', 'Buy', 'bid', 'l', 'b', 'up', 'bull', 1, '1'];
const SHORT = ['short', 'Short', 'SHORT', ' short ', 'sell', 'SELL', 'Sell', 'ask', 's', 'down', 'bear', -1, '-1'];
const REFUSE = ['', null, 'banana', 'buyy', 'longg', 'x', 0, {}, [], 'true'];

(async () => {
  console.log('api-side-e2e\n');
  if (!ADMIN) { console.log('needs ADMIN_KEY.local.txt'); process.exitCode = 1; return; }
  const H = { 'x-admin-key': ADMIN, 'content-type': 'application/json' };
  const uid = 'e2eside' + Math.random().toString(36).slice(2, 5);
  await fetch('https://marginpad.io/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'mk' }) });
  const se = await fetch('https://marginpad.io/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'sess' }) }).then((r) => r.json());
  const km = await fetch('https://marginpad.io/api/bot/key', { method: 'POST', headers: { cookie: 'mp_sess=' + se.token, 'content-type': 'application/json' }, body: '{}' }).then((r) => r.json());
  const KEY = km.key || (km.keys && km.keys[0] && km.keys[0].key);
  ok('a throwaway key was minted', !!KEY, JSON.stringify(km).slice(0, 120));
  if (!KEY) { process.exitCode = 1; return; }
  const KH = { 'X-API-Key': KEY, 'Content-Type': 'application/json' };
  const open = async (side) => {
    const body = { symbol: 'SOL', margin_usd: 5, leverage: 5 };
    if (side !== null) body.side = side;
    const r = await fetch(BASE + '/v1/open', { method: 'POST', headers: KH, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    const p = j.position || j;
    if (p && p.id) await fetch(BASE + '/v1/close', { method: 'POST', headers: KH, body: JSON.stringify({ id: p.id }) });
    // THE VERDICT IS THE LIQUIDATION PRICE, not the echoed label.
    const dir = (r.status === 200 && +p.entry_price > 0 && +p.liq_price > 0) ? (+p.liq_price < +p.entry_price ? 'long' : 'short') : null;
    return { status: r.status, err: j.error, label: p && p.side, dir };
  };

  try {
    console.log('every spelling of LONG opens a position whose liq sits BELOW the entry:');
    for (const v of LONG) { const r = await open(v); ok(JSON.stringify(v).padEnd(9) + ' -> long', r.status === 200 && r.dir === 'long' && r.label === 'long', 'status=' + r.status + ' label=' + r.label + ' liq says ' + r.dir); }

    console.log('\nevery spelling of SHORT opens one whose liq sits ABOVE it:');
    for (const v of SHORT) { const r = await open(v); ok(JSON.stringify(v).padEnd(9) + ' -> short', r.status === 200 && r.dir === 'short' && r.label === 'short', 'status=' + r.status + ' label=' + r.label + ' liq says ' + r.dir); }

    console.log('\nanything we do not recognise is REFUSED, never guessed into a long:');
    for (const v of REFUSE) { const r = await open(v); ok(JSON.stringify(v).padEnd(9) + ' -> 400 side_required', r.status === 400 && r.err === 'side_required', 'status=' + r.status + ' error=' + r.err + ' dir=' + r.dir); }

    console.log('\nand the refusal tells the developer what we take:');
    const r = await fetch(BASE + '/v1/open', { method: 'POST', headers: KH, body: JSON.stringify({ symbol: 'SOL', margin_usd: 5, leverage: 5, side: 'nope' }) });
    const j = await r.json();
    ok('it names long and short', /long/.test(JSON.stringify(j)) && /short/.test(JSON.stringify(j)), JSON.stringify(j).slice(0, 160));
    ok('and says buy / sell are accepted', /buy/i.test(JSON.stringify(j)) && /sell/i.test(JSON.stringify(j)), JSON.stringify(j).slice(0, 160));

    console.log('\nflags we do not honour are refused rather than swallowed:');
    for (const [nm, extra, code] of [['reduce_only', { reduce_only: true }, 'reduce_only_unsupported'], ['post_only', { post_only: true }, 'post_only_unsupported'], ['margin_mode cross', { margin_mode: 'cross' }, 'margin_mode_unsupported']]) {
      const rr = await fetch(BASE + '/v1/open', { method: 'POST', headers: KH, body: JSON.stringify({ symbol: 'SOL', side: 'long', margin_usd: 5, leverage: 5, ...extra }) });
      const jj = await rr.json().catch(() => ({}));
      ok(nm + ' -> 400 ' + code, rr.status === 400 && jj.error === code, 'status=' + rr.status + ' error=' + jj.error);
      const id = (jj.position || jj).id; if (id) await fetch(BASE + '/v1/close', { method: 'POST', headers: KH, body: JSON.stringify({ id }) });
    }
    // these two ARE harmless and must keep working - a ported bot sends them as defaults
    for (const [nm, extra] of [['time_in_force GTC', { time_in_force: 'GTC' }], ['margin_mode isolated', { margin_mode: 'isolated' }]]) {
      const rr = await fetch(BASE + '/v1/open', { method: 'POST', headers: KH, body: JSON.stringify({ symbol: 'SOL', side: 'long', margin_usd: 5, leverage: 5, ...extra }) });
      const jj = await rr.json().catch(() => ({}));
      ok(nm + ' is still accepted', rr.status === 200, 'status=' + rr.status + ' error=' + jj.error);
      const id = (jj.position || jj).id; if (id) await fetch(BASE + '/v1/close', { method: 'POST', headers: KH, body: JSON.stringify({ id }) });
    }
  } finally {
    await fetch('https://marginpad.io/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'rm' }) });
  }

  console.log('\napi-side-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error('api-side-e2e crashed: ' + (e && e.stack || e)); process.exitCode = 1; });
