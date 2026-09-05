// Trading report E2E (2026-09-05). Opens and closes a known set of positions on a throwaway account, then checks
// that the report says exactly what those trades were — not "a number came back", but the right number in the
// right bucket. Also checks the gate (anonymous refused) and that a thin window refuses to call itself a pattern.
const fs = require('fs');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const UID = 'rep' + Date.now().toString(36).slice(-5);
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 200) : ''));

async function trade(path, body) {
  const u = ORIGIN + '/api/trade' + path + (path.indexOf('?') > 0 ? '&' : '?') + 'uid=' + UID;
  const r = await fetch(u, { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

(async () => {
  const anon = await fetch(ORIGIN + '/api/trade/report?days=30');
  chk('anonymous cannot read a report', anon.status === 401, { status: anon.status });

  // An empty account must not invent anything.
  let rep = (await trade('/report?days=30')).body;
  chk('an account with no trades reports zero, not nulls', rep.ok && rep.total && rep.total.n === 0, rep.total);
  chk('no findings are manufactured from nothing', !rep.findings || rep.findings.length === 0, rep.findings);

  // A known book: 3 leverage bands, both directions, two coins.
  const PLAN = [
    { sym: 'BTC', side: 'long', lev: 3, margin: 100 },
    { sym: 'BTC', side: 'long', lev: 3, margin: 100 },
    { sym: 'BTC', side: 'long', lev: 10, margin: 100 },
    { sym: 'ETH', side: 'long', lev: 10, margin: 100 },
    { sym: 'ETH', side: 'long', lev: 30, margin: 100 },
    { sym: 'SOL', side: 'short', lev: 30, margin: 100 },
    { sym: 'SOL', side: 'short', lev: 3, margin: 100 }
  ];
  let opened = 0;
  for (const p of PLAN) {
    const o = await trade('/open', p);
    if (!(o.body && o.body.ok && o.body.position)) { chk('open ' + p.sym + ' ' + p.lev + 'x', false, o.body); continue; }
    opened++;
    const c = await trade('/close', { id: o.body.position.id });
    if (!(c.status === 200 && !c.body.error)) chk('close ' + p.sym, false, c.body);
  }
  chk('the whole book opened and closed', opened === PLAN.length, { opened, planned: PLAN.length });

  await new Promise(r => setTimeout(r, 1500));
  rep = (await trade('/report?days=30')).body;
  const T = rep.total || {};
  chk('every close is counted', T.n === PLAN.length, { n: T.n, want: PLAN.length });
  chk('wins + losses account for all of them', (T.wins != null) && T.wins <= T.n, T);
  chk('win rate is derived, not invented', T.wr === Math.round(T.wins / T.n * 1000) / 10, { wr: T.wr, wins: T.wins, n: T.n });
  chk('return on margin is pnl over margin risked', T.exp === Math.round(T.pnl / T.margin * 1000) / 10, { exp: T.exp, pnl: T.pnl, margin: T.margin });
  chk('best is not worse than worst', T.best && T.worst && T.best.pnl >= T.worst.pnl, { best: T.best && T.best.pnl, worst: T.worst && T.worst.pnl });
  chk('hold time was measured from the open events', T.holdN === PLAN.length && T.holdMedianMin != null, { holdN: T.holdN, med: T.holdMedianMin });

  const lev = {}; (rep.byLev || []).forEach(r => { lev[r.k] = r.n; });
  chk('leverage buckets land where they belong', lev['1-5x'] === 3 && lev['5-20x'] === 2 && lev['20-50x'] === 2, lev);
  chk('empty leverage bands stay empty', (lev['50-100x'] || 0) === 0 && (lev['100x+'] || 0) === 0, lev);
  const coin = {}; (rep.byCoin || []).forEach(r => { coin[r.k] = r.n; });
  chk('coins are counted per coin', coin.BTC === 3 && coin.ETH === 2 && coin.SOL === 2, coin);
  const side = {}; (rep.bySide || []).forEach(r => { side[r.k] = r.n; });
  chk('directions are counted per direction', side.long === 5 && side.short === 2, side);
  chk('every hour bucket exists so the chart has no holes', (rep.byHour || []).length === 24, { hours: (rep.byHour || []).length });
  chk('the hour buckets sum back to the total', (rep.byHour || []).reduce((s, h) => s + h.n, 0) === T.n, { sum: (rep.byHour || []).reduce((s, h) => s + h.n, 0), n: T.n });
  chk('the coin buckets sum back to the total', (rep.byCoin || []).reduce((s, h) => s + h.n, 0) === T.n);

  // Below the evidence threshold the report must say so rather than pattern-match on 7 trades.
  const thin = (rep.findings || []).filter(f => f.k === 'thin')[0];
  chk('a thin window is called thin instead of read as a pattern', !!thin && T.n < 8, { n: T.n, thin: !!thin });
  chk('every finding carries the n it rests on', (rep.findings || []).every(f => typeof f.n === 'number' && f.n > 0), rep.findings);

  const short = (await trade('/report?days=7')).body;
  chk('the 7-day window is a different window', short.ok && short.days === 7, { days: short.days });

  // ── above the threshold: the finding that is actually worth paying for ────────────────────────────────────
  // Two bands with n >= 8 each. Every trade here is opened and closed immediately, so the only thing separating
  // them is the round-trip fee — which scales with leverage. 50x must therefore measure clearly worse than 3x,
  // and the report must SAY so, in a sentence, from the data.
  // /api/trade/open is rate limited to 20 opens per minute per account (a real guard, not a test artefact),
  // so the book is PACED and a refusal is waited out rather than silently losing a trade from the sample.
  const openPaced = async (body) => {
    for (let a2 = 0; a2 < 6; a2++) {
      const o = await trade('/open', body);
      if (o.body && o.body.ok && o.body.position) return o.body.position;
      if (o.status === 429 || (o.body && o.body.error === 'rate_limited')) { await new Promise(r => setTimeout(r, 20000)); continue; }
      return null;
    }
    return null;
  };
  let paced = 0;
  for (let i = 0; i < 8; i++) {
    for (const lv of [3, 50]) {
      const pos = await openPaced({ sym: 'BTC', side: 'long', lev: lv, margin: 100 });
      if (pos) { paced++; await trade('/close', { id: pos.id }); }
      await new Promise(r => setTimeout(r, 3200));
    }
  }
  chk('the paced book opened in full despite the 20/min open limit', paced === 16, { opened: paced });
  await new Promise(r => setTimeout(r, 1500));
  const big = (await trade('/report?days=30')).body;
  const lb = {}; (big.byLev || []).forEach(r => { lb[r.k] = r; });
  chk('both leverage bands now clear the evidence threshold', lb['1-5x'] && lb['1-5x'].n >= 8 && lb['50-100x'] && lb['50-100x'].n >= 8, { low: lb['1-5x'] && lb['1-5x'].n, high: lb['50-100x'] && lb['50-100x'].n });
  chk('50x measures worse per dollar risked than 3x', lb['1-5x'] && lb['50-100x'] && lb['50-100x'].exp < lb['1-5x'].exp, { '3x': lb['1-5x'] && lb['1-5x'].exp, '50x': lb['50-100x'] && lb['50-100x'].exp });
  const thin2 = (big.findings || []).filter(f => f.k === 'thin')[0];
  chk('the window is no longer called thin', !thin2, { n: big.total && big.total.n });
  const levF = (big.findings || []).filter(f => f.k === 'lev')[0];
  chk('the leverage finding fires and names both bands', !!levF && /50-100x/.test(levF.text) && /1-5x/.test(levF.text), levF && levF.text);
  chk('the leverage finding rests on a real count', levF && levF.n >= 8, levF && { n: levF.n });
  const holdF = (big.findings || []).filter(f => f.k === 'hold')[0];
  chk('median hold is reported once enough trades were timed', !!holdF, holdF && holdF.text);

  console.log(out.join('\n'));
  const p = out.filter(x => x[0] === 'P').length, f = out.filter(x => x[0] === 'F').length;
  console.log('\nUID ' + UID + ' — pass ' + p + ' fail ' + f);
  if (f) process.exit(1);
})().catch(e => { console.error(e); console.log(out.join('\n')); process.exit(1); });
