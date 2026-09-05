/* Personal records E2E (2026-09-06). Four all-time records per account, updated on every close, with the last
   record broken remembered for the /xp toast: best ROE, biggest $ win, longest run of green closes, most closes
   in a day. A first-ever value is a seed (no toast); a streak or day record only counts once it means something.

   Deterministic wins: a limit order at 75% of the market is filled by injecting that price into the fill engine
   (/api/admin/porders?run=1&px=BTC:<level>&nokl=1), then the position is closed at the REAL price -- a large,
   certain green close. A short filled the same way and closed at the real price is a certain loss.

   Run: node build/pb-e2e.js
*/
const fs = require('fs');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const UID = 'pb' + Date.now().toString(36).slice(-5);
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 190) : ''));

async function trade(path, body) {
  const r = await fetch(ORIGIN + '/api/trade' + path + '?uid=' + UID, { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function admin(path) { const r = await fetch(ORIGIN + path, { headers: { 'x-admin-key': K } }); return r.json().catch(() => ({})); }
const records = async () => ((await admin('/api/admin/records?uid=' + UID)) || {}).records;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// one certain win or loss: level order filled by price injection, closed at the real price
async function round(side, margin, lev, level) {
  const o = await trade('/order', { action: 'add', sym: 'BTC', side, px: level, lev, margin });
  if (!o.body || !o.body.ok) return { err: 'order ' + JSON.stringify(o.body).slice(0, 120) };
  const run = await admin('/api/admin/porders?run=1&nokl=1&uid=' + UID + '&px=BTC:' + level);
  const pos = (run.positions || run.filled || []);
  const j = await admin('/api/admin/journal?uid=' + UID);
  const open = ((j && (j.journal || j.trades || j.rows)) || []).filter(t => t.status === 'open');
  if (!open.length) return { err: 'no open position after fill ' + JSON.stringify(run).slice(0, 160) };
  const id = open[open.length - 1].id;
  await sleep(300);
  const c = await trade('/close', { id });
  return { close: c.body, id };
}

(async () => {
  const px = await fetch(ORIGIN + '/api/price?symbol=BTC').then(r => r.json()).then(d => +d.price || 0).catch(() => 0);
  chk('live BTC price known', px > 1000, { px });
  const LEVEL = Math.round(px * 0.75);

  const r1 = await round('long', 100, 10, LEVEL);
  chk('round 1: close accepted', r1.close && !r1.close.error, r1.close ? Object.keys(r1.close) : r1);
  await sleep(600);
  const a = await records();
  chk('round 1: records seeded (roe, pnl, streak 1, day 1)', !!a && a.roe > 0 && a.pnl > 0 && a.streak === 1 && a.day === 1, a);
  chk('round 1: a first value is a seed, not a broken record (no toast)', !!a && !a.fresh, a && a.fresh);

  const r2 = await round('long', 200, 10, LEVEL); // same ROE, double the dollars
  chk('round 2: close accepted', r2.close && !r2.close.error, r2.close ? Object.keys(r2.close) : r2);
  await sleep(600);
  const b = await records();
  chk('round 2: biggest-win record broken, ROE not (same leverage, same level)', !!b && b.pnl > a.pnl && Math.abs(b.roe - a.roe) < 1, b);
  chk('round 2: the toast payload names pnl with the previous value', !!b && b.fresh && b.fresh.items.some(i => i.k === 'pnl' && i.prev != null && Math.abs(i.prev - a.pnl) < 0.02) && !b.fresh.items.some(i => i.k === 'roe'), b && b.fresh);

  const r3 = await round('long', 50, 10, LEVEL); // smaller win: no money record, but three green in a row
  chk('round 3: close accepted', r3.close && !r3.close.error, r3.close ? Object.keys(r3.close) : r3);
  await sleep(600);
  const c = await records();
  chk('round 3: win streak record = 3 and it is the fresh record', !!c && c.streak === 3 && c.streakNow === 3 && c.fresh && c.fresh.items.some(i => i.k === 'streak' && i.v === 3), c && { streak: c.streak, now: c.streakNow, fresh: c.fresh });
  chk('round 3: money records untouched by a smaller win', !!c && Math.abs(c.pnl - b.pnl) < 0.02, { c: c && c.pnl, b: b && b.pnl });

  const r4 = await round('short', 100, 2, LEVEL); // short filled 25% below the market, closed at the market: a certain loss (2x so the sweep does not liquidate it first)
  chk('round 4: close accepted', r4.close && !r4.close.error, r4.close ? Object.keys(r4.close) : r4);
  await sleep(600);
  const d = await records();
  chk('round 4: streak reset to 0, best streak kept at 3', !!d && d.streakNow === 0 && d.streak === 3, d && { now: d.streakNow, best: d.streak });
  chk('round 4: four closes today counted (no toast under 5)', !!d && d.day === 4 && !(d.fresh && d.fresh.items.some(i => i.k === 'day')), d && { day: d.day });
  chk('a loss never touches the money records', !!d && Math.abs(d.pnl - b.pnl) < 0.02 && Math.abs(d.roe - a.roe) < 1);

  // source guard: the records hook sits on the same close path as the XP grant, and /xp carries them
  const src = fs.readFileSync('D:/part1/money-mission/src/worker.js', 'utf8');
  chk('worker: records hook lives next to the XP grant on close', src.indexOf("this._pbOnClose(uid, e, pv, roe, ts9)") > 0);
  chk('worker: /xp poll carries records + pbNew', src.indexOf('pbNew: records && records.fresh') > 0);
  chk('worker: /close busts the 45s /xp cache', /path === '\/close'[\s\S]{0,4000}__xpC[\s\S]{0,80}xc\.delete\(tok\)/.test(src));
  for (const f of ['home.js', 'mp-trade.js']) chk(f + ': pokes the XP poll after a close', fs.readFileSync('D:/part1/money-mission/dist/assets/' + f, 'utf8').indexOf('function fullClose(e,m){try{setTimeout(function(){if(window.mpXpCheck)window.mpXpCheck();},1400)') > 0);
  chk('mp-auth: toasts a fresh record once per device', fs.readFileSync('D:/part1/money-mission/dist/assets/mp-auth.js', 'utf8').indexOf("mp_pb_seen_") > 0);
  chk('mp-profile: renders the records strip', fs.readFileSync('D:/part1/money-mission/dist/assets/mp-profile.js', 'utf8').indexOf('lbm-rec') > 0);

  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed  (uid ' + UID + ')');
  process.exit(bad ? 1 : 0);
})();
