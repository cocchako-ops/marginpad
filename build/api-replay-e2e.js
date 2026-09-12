/* Bot API 2.6 replay E2E (2026-09-12). With a throwaway member and key, on prod:
     - refusals: today (day_not_finished), a bad day, an unknown symbol (no_data), speed out of range
     - start BTC on the day before yesterday at speed 600; GET shows a running cursor, a price and candles up to it
     - open at the replay price lands in the replay journal (live /positions of the key show it too, because the key is IN replay);
       a second symbol and a limit order are refused; the mark price is the replay price, not the live one
     - stop closes at the cursor and returns the summary; the replay journal is emptied; a fresh start works again
     - the key's LIVE book is untouched throughout (accounts endpoint: main has 0 closes)
   Run: node build/api-replay-e2e.js */
const fs = require('fs'), path = require('path');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jget = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b) => fetch(ORIGIN + p, { method: 'POST', headers: H, body: JSON.stringify(b || {}) }).then(jget);
const out = []; const chk = (n, ok, x) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 260) : '')); console.log(out[out.length - 1]); };
const UID = 'e2erp' + Math.random().toString(36).slice(2, 6);
const dayOf = (back) => new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
(async () => {
  try {
    await post('/api/admin/e2euser', { uid: UID, op: 'mk' }); const se = await post('/api/admin/e2euser', { uid: UID, op: 'sess' }); const cookie = 'mp_sess=' + se.body.token;
    const kj = await (await fetch(ORIGIN + '/api/bot/key', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ act: 'create', name: 'replay' }) })).json(); const KEY = kj.key || '';
    chk('member + key', !!KEY);
    const bot = (p, b, m) => fetch(ORIGIN + '/api/bot/v1' + p, { method: m || (b ? 'POST' : 'GET'), headers: { 'x-api-key': KEY, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(jget);
    const r0 = await bot('/replay'); chk('GET /v1/replay with nothing running says so', r0.status === 200 && r0.body.running === false, r0.body);
    const rt = await bot('/replay', { symbol: 'BTC', day: dayOf(0), speed: 60 }); chk('today is refused (day_not_finished)', rt.status === 400 && rt.body.error === 'day_not_finished', rt.body);
    const rd = await bot('/replay', { symbol: 'BTC', day: '2026-13-40', speed: 60 }); chk('a bad day is refused (day_invalid)', rd.status === 400 && rd.body.error === 'day_invalid');
    const rs = await bot('/replay', { symbol: 'BTC', day: dayOf(2), speed: 5000 }); chk('speed out of range is refused', rs.status === 400 && rs.body.error === 'speed_invalid', rs.body);
    const rn = await bot('/replay', { symbol: 'ZZZZQ', day: dayOf(2), speed: 60 }); chk('an unknown market is refused (no_data)', rn.status === 404 && rn.body.error === 'no_data', rn.body);
    const day = dayOf(2);
    const st = await bot('/replay', { symbol: 'BTC', day, speed: 600 });
    chk('replay starts: BTC, ' + day + ', 600x, ~1440 candles', st.status === 200 && st.body.ok && st.body.replay && st.body.replay.candles >= 1200 && st.body.replay.first_price > 0, st.body.replay && { candles: st.body.replay.candles, first: st.body.replay.first_price, secs: st.body.replay.ends_in_real_seconds });
    await sleep(2500);
    const g1 = await bot('/replay?interval=5&bars=20');
    chk('GET shows a running cursor inside the day, a price and 5m candles up to it', g1.status === 200 && g1.body.running && g1.body.cursor_ts > st.body.replay.start_ts && g1.body.cursor_ts < st.body.replay.end_ts && g1.body.price > 0 && Array.isArray(g1.body.bars) && g1.body.bars.length >= 1 && g1.body.bars.every(x => x.time * 1000 <= g1.body.cursor_ts), { cursor: g1.body.cursor_iso, price: g1.body.price, bars: g1.body.bars && g1.body.bars.length, pct: g1.body.progress_pct });
    const live = await fetch(ORIGIN + '/api/bot/v1/price?symbol=BTC').then(jget);
    const o = await bot('/open', { symbol: 'BTC', side: 'long', leverage: 10, margin_usd: 100, sl: g1.body.price * 0.5, tp: g1.body.price * 2, client_order_id: 'rp-' + Date.now() });
    chk('open in replay fills at the replay price, not the live one', o.status === 200 && o.body.ok && o.body.position && Math.abs(o.body.position.entry_price - g1.body.price) / g1.body.price < 0.02 && /^rp/.test(o.body.position.id), { entry: o.body.position && o.body.position.entry_price, replayPx: g1.body.price, livePx: live.body.price, id: o.body.position && o.body.position.id });
    const oo = await bot('/open', { symbol: 'ETH', side: 'long', leverage: 10, margin_usd: 100 }); chk('another symbol is refused in replay (replay_symbol_only)', oo.status === 409 && oo.body.error === 'replay_symbol_only', oo.body);
    const ol = await bot('/open', { symbol: 'BTC', side: 'long', leverage: 10, margin_usd: 100, type: 'limit', limit_price: g1.body.price * 0.9 }); chk('a limit order is refused in replay (replay_market_only)', ol.status === 400 && ol.body.error === 'replay_market_only');
    await sleep(1500);
    const g2 = await bot('/replay'); const ps = await bot('/positions');
    const p1 = (ps.body.positions || [])[0];
    chk('positions in replay: one open row, mark = the replay price at the cursor', ps.status === 200 && (ps.body.positions || []).length === 1 && p1 && p1.status === 'open' && Math.abs(p1.mark_price - g2.body.price) / g2.body.price < 0.02, { mark: p1 && p1.mark_price, replayPx: g2.body.price, cursor: g2.body.cursor_iso });
    const ac = await bot('/account'); chk('account in replay counts the replay position', ac.status === 200 && ac.body.open_positions === 1, { open: ac.body.open_positions });
    const sp = await bot('/replay', { act: 'stop' });
    chk('stop closes at the cursor and returns the summary (1 close)', sp.status === 200 && sp.body.ok && sp.body.replay && sp.body.replay.closes === 1 && typeof sp.body.replay.pnl_usd === 'number' && sp.body.replay.closed_now === 1, sp.body.replay && { closes: sp.body.replay.closes, pnl: sp.body.replay.pnl_usd, pct: sp.body.replay.progress_pct });
    const g3 = await bot('/replay'); chk('after stop nothing runs', g3.body.running === false);
    const acc = await bot('/accounts'); const main = (acc.body.accounts || []).filter(a => a.account === 'main')[0];
    chk('the live book is untouched (main: 0 closes, 0 open, NEVER reset by a replay)', main && main.closed_trades === 0 && main.open_positions === 0 && !main.reset_ts, main);
    const lp = await bot('/positions'); chk('live /positions of the key is empty (the replay journal is separate and was emptied)', (lp.body.positions || []).length === 0, { n: (lp.body.positions || []).length });
    const st2 = await bot('/replay', { symbol: 'BTC', day: dayOf(3), speed: 600 }); chk('a second replay starts clean', st2.status === 200 && st2.body.ok, st2.body.error);
    const st3 = await bot('/replay', { symbol: 'ETH', day: dayOf(3), speed: 60 }); chk('a second start while one runs -> 409 replay_running', st3.status === 409 && st3.body.error === 'replay_running');
    await bot('/replay', { act: 'stop' });
    const cl = await fetch(ORIGIN + '/api/changelog.json').then(jget); chk('changelog leads with 2.6.0', cl.body.data && cl.body.data.changelog[0].version === '2.6.0');
  } finally { try { await post('/api/admin/e2euser', { uid: UID, op: 'rm' }); } catch (e) {} }
  const bad = out.filter(l => l.slice(0, 4) === 'FAIL').length; console.log('\n' + out.length + ' checks, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
})();
