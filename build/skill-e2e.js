/* Skill score E2E (2026-09-06). Four habits from the report's own close rows, each 0-25 with its own n and null
   under REPORT_MIN_N; the total (0-100) exists only when two or more habits are measurable. Free for every
   member; the breakdowns stay Premium. Behaviour, not prediction.

   Pure: skillScore() is pulled out of src/worker.js and run on synthetic rows, so the thresholds and the maths
   are proven on the exact code the DO runs. Live: a throwaway member closes nine trades (all with a stop, even
   margins, filled by price injection) and /api/trade/report carries skill with discipline measured on nine
   rows; a fresh member gets a null score with the counts that explain why.

   Run: node build/skill-e2e.js
*/
const fs = require('fs');
const path = require('path');
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const UID = 'e2esk' + Date.now().toString(36).slice(-5);
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 220) : ''));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const post = async (u, b) => { const r = await fetch(ORIGIN + u, { method: 'POST', headers: H, body: JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const get = async (u) => { const r = await fetch(ORIGIN + u, { headers: H }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- pure ------------------------------------------------------------------------------------------------
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
const a = src.indexOf('const REPORT_MIN_N = 8;'), b = src.indexOf('\n}', src.indexOf('function skillScore(')) + 2;
const skillScore = new Function(src.slice(a, b) + '; return skillScore;')();
const T0 = Date.now() - 3600000; // real timestamps: a hold is only measured when the open lies at a positive time before the close
const row = (o) => Object.assign({ ts: T0, sym: 'BTC', side: 'long', lev: 10, margin: 100, pnl: 5, roe: 5, liq: 0, tid: 't', sl: 1 }, o);
const opens = {};
{
  const few = skillScore([row({}), row({}), row({})], opens);
  chk('pure: under 8 rows every part is null and there is no total', few.score == null && few.parts.disc.v == null && few.measured === 0 && few.n === 3, few);
  const rows9 = []; for (let i = 0; i < 9; i++) rows9.push(row({ tid: 't' + i, ts: T0 + i * 1000, sl: 1, margin: 100, pnl: 10 }));
  const nine = skillScore(rows9, {});
  chk('pure: nine even, stopped, +10% trades: discipline 25, sizing 25, edge > 12.5, patience unmeasured (no opens)', nine.parts.disc.v === 25 && nine.parts.size.v === 25 && nine.parts.edge.v > 12.5 && nine.parts.pat.v == null && nine.measured === 3 && nine.score > 60, nine);
  const nostop = skillScore(rows9.map(r => Object.assign({}, r, { sl: 0 })), {});
  chk('pure: same trades without stops: discipline 6.25 (only the no-liquidation quarter)', nostop.parts.disc.v === 6.3 || nostop.parts.disc.v === 6.2 || nostop.parts.disc.v === 6.25, nostop.parts.disc);
  const legacy = skillScore(rows9.map(r => Object.assign({}, r, { sl: null })), {});
  chk('pure: rows from before the column (sl null) do not count for discipline', legacy.parts.disc.v == null && legacy.parts.disc.n === 0, legacy.parts.disc);
  const liq = skillScore(rows9.map((r, i) => Object.assign({}, r, { liq: i < 3 ? 1 : 0, pnl: i < 3 ? -100 : 10 })), {});
  chk('pure: three liquidations in nine cut discipline and edge', liq.parts.disc.v < 25 && liq.parts.edge.v < nine.parts.edge.v, { disc: liq.parts.disc.v, edge: liq.parts.edge.v });
  const uneven = skillScore(rows9.map((r, i) => Object.assign({}, r, { margin: i % 2 ? 10 : 1000 })), {});
  chk('pure: wildly uneven sizing scores far below even sizing', uneven.parts.size.v < 12.5 && uneven.parts.size.v < nine.parts.size.v / 2, uneven.parts.size);
  const op = {}; rows9.forEach((r, i) => { op[r.tid] = r.ts - (i < 4 ? 60000 : 30 * 60000); });
  const held = skillScore(rows9, op);
  const heldLong = skillScore(rows9, Object.keys(op).reduce((m, k) => (m[k] = op[k] - 3 * 3600000, m), {}));
  chk('pure: patience rises with hold time and is measured on rows with a matching open', held.parts.pat.n === 9 && held.parts.pat.v > 0 && heldLong.parts.pat.v === 25, { short: held.parts.pat, long: heldLong.parts.pat });
}

// ---- live ------------------------------------------------------------------------------------------------
(async () => {
  const mk = await post('/api/admin/e2euser', { uid: UID, op: 'mk' });
  chk('throwaway member minted', mk.body && mk.body.ok, mk.body);
  const empty = await get('/api/trade/report?days=30&uid=' + UID);
  chk('fresh member: report carries skill with a null score and the counts that explain it', empty.body && empty.body.skill && empty.body.skill.now.score == null && empty.body.skill.now.n === 0 && empty.body.skill.minN === 8, empty.body && empty.body.skill);

  const px = await fetch(ORIGIN + '/api/price?symbol=BTC').then(r => r.json()).then(d => +d.price || 0);
  const LEVEL = Math.round(px * 0.9);
  let closed = 0;
  for (let i = 0; i < 9; i++) {
    const o = await post('/api/trade/order?uid=' + UID, { action: 'add', sym: 'BTC', side: 'long', px: LEVEL, lev: 5, margin: 100, sl: Math.round(LEVEL * 0.9) });
    if (!o.body.ok) { chk('order ' + i + ' placed', false, o.body); break; }
    await get('/api/admin/porders?run=1&nokl=1&uid=' + UID + '&px=BTC:' + LEVEL);
    const j = await get('/api/admin/journal?uid=' + UID);
    const open = ((j.body && (j.body.journal || j.body.trades || j.body.rows)) || []).filter(t => t.status === 'open');
    if (!open.length) { chk('position ' + i + ' open after fill', false, j.body); break; }
    await sleep(250);
    const c = await post('/api/trade/close?uid=' + UID, { id: open[open.length - 1].id });
    if (c.body && !c.body.error) closed++;
    await sleep(3300); // 20 opens/min on the trade API
  }
  chk('nine stopped, even trades closed', closed === 9, { closed });
  await sleep(800);
  const rep = await get('/api/trade/report?days=30&uid=' + UID);
  const S = rep.body && rep.body.skill;
  chk('live: skill present on the (free) report payload', !!S && !!S.now && S.now.n === 9, S && S.now);
  chk('live: discipline measured on nine rows with a stop on every one', !!S && S.now.parts.disc.n === 9 && S.now.parts.disc.v === 25, S && S.now.parts.disc);
  chk('live: sizing measured, even margins score full', !!S && S.now.parts.size.v === 25, S && S.now.parts.size);
  chk('live: total exists (2+ habits) and this week matches the window', !!S && S.now.score != null && S.week.score === S.now.score && S.prev.score == null, S && { now: S.now.score, week: S.week.score, prev: S.prev.score });

  await post('/api/admin/e2euser', { uid: UID, op: 'rm' });
  const gone = await get('/api/trade/report?days=30&uid=' + UID);
  chk('cleanup: member removed, report empty again', !gone.body.skill || gone.body.skill.now.n === 0);

  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed  (uid ' + UID + ')');
  process.exit(bad ? 1 : 0);
})();
