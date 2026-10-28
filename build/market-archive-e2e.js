/* THE MARKET ARCHIVE, PROVEN (2026-10-28). Two halves.
   --pure: lifts MARKET_DS and mktVerifyText out of the SHIPPED worker source and drives the verifier with constructed
   bodies - a good day passes with no flags, a wrong header is refused, a row outside the day is refused, a row over the
   plausibility ceiling is FLAGGED not refused, a thin day is flagged, the MPAD minute unit is honoured. `--falsify`
   drifts the header check in the lifted copy and requires the named checks to go red - a verifier that cannot fail
   proves nothing.
   live (default, pure + production): the desk answers, every dataset in the table is listed, the collector's own
   export table agrees with the worker's on every header, the liquidations archive has no gap over the last 30 days
   (the legacy copy was complete; the new one must be too), every archived day carries rows + sha256 + hours in its
   metadata, a correction dry run on a real day drops nothing at an absurd ceiling and writes nothing, and the
   recap pages for the two Bitfinex-phantom days no longer name a $100M+ liquidation.
   Usage: node build/market-archive-e2e.js [--pure] [--falsify] */
const fs = require('fs');
const PURE = process.argv.includes('--pure'), FALSIFY = process.argv.includes('--falsify');
const O = 'https://marginpad.io';
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail).slice(0, 260) : '')); } };

// ---- lift the shipped definitions ----
const src = fs.readFileSync('src/worker.js', 'utf8');
function liftFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let j = src.indexOf('{', i), depth = 0;
  for (let k = j; k < src.length; k++) { const c = src[k]; if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) return src.slice(i, k + 1); } }
  throw new Error('unbalanced: ' + name);
}
function liftConst(name) {
  const i = src.indexOf('const ' + name + ' = {');
  if (i < 0) throw new Error('not found: ' + name);
  let j = src.indexOf('{', i), depth = 0;
  for (let k = j; k < src.length; k++) { const c = src[k]; if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) return src.slice(j, k + 1); } }
  throw new Error('unbalanced: ' + name);
}
let verifySrc = liftFn('mktVerifyText');
if (FALSIFY) verifySrc = verifySrc.replace("if (header !== spec.cols) return", "if (false) return"); // the drift: a header is no longer checked
const mktVerifyText = new Function(verifySrc + '; return mktVerifyText;')();
const MARKET_DS = new Function('return ' + liftConst('MARKET_DS') + ';')();

(async () => {
  console.log('market-archive-e2e' + (PURE ? ' --pure' : '') + (FALSIFY ? ' --falsify' : ''));
  // ---- the table itself ----
  const names = Object.keys(MARKET_DS);
  ok('MARKET_DS names at least the six collector datasets and mpad', ['liquidations', 'agg5m', 'oi', 'funding_oi', 'whale_fills', 'whale_pos', 'mpad'].every(k => names.includes(k)), names);
  ok('every dataset has a header, a first day, a floor and a timestamp column', names.every(k => { const s = MARKET_DS[k]; return typeof s.cols === 'string' && s.cols.includes(',') && /^\d{4}-\d{2}-\d{2}$/.test(s.from) && s.minRows >= 1 && Number.isInteger(s.tsCol) && (s.src === 'collector' || s.src === 'opslog'); }), MARKET_DS);
  ok('the liquidations dataset carries the $50M plausibility ceiling on its USD column', MARKET_DS.liquidations.usdCol === 6 && MARKET_DS.liquidations.maxUsd === 50e6);
  ok('the mpad dataset reads minutes (unit 60000)', MARKET_DS.mpad.tsUnit === 60000);

  // ---- the verifier ----
  const day = '2026-10-27', d0 = Date.parse(day + 'T00:00:00Z');
  const L = MARKET_DS.liquidations;
  const row = (t, usd) => [t, 'bybit', 'BTC', 'long_liquidated', '100000', '1', String(usd)].join(',');
  let good = L.cols + '\n'; for (let h = 0; h < 24; h++) for (let i = 0; i < 300; i++) good += row(d0 + h * 3600000 + i * 1000, 5000) + '\n';
  const vg = mktVerifyText(good, L, day);
  ok('a good day verifies: 7200 rows, 24 hours, no flags', vg.ok && vg.rows === 7200 && vg.hours === 24 && vg.q.length === 0, vg);
  const vh = mktVerifyText('ts,exchange,symbol\n' + row(d0 + 1000, 5000) + '\n', L, day);
  ok('a wrong header is REFUSED (bad_header)', !vh.ok && vh.why === 'bad_header', vh);
  const vo = mktVerifyText(good + row(d0 + 86400000 + 5, 5000) + '\n', L, day);
  ok('one row outside the day is REFUSED (rows_outside_day)', !vo.ok && /rows_outside_day/.test(vo.why), vo);
  const vover = mktVerifyText(good + row(d0 + 5000, 195445833) + '\n', L, day);
  ok('a row over the $50M ceiling is FLAGGED (over), not refused - the archive keeps what the collector held and says so', vover.ok && vover.over === 1 && vover.q.includes('over'), vover);
  let thin = L.cols + '\n'; for (let h = 0; h < 24; h++) thin += row(d0 + h * 3600000, 10) + '\n';
  const vt = mktVerifyText(thin, L, day);
  ok('a day under the floor is flagged thin and still valid', vt.ok && vt.q.includes('thin') && vt.rows === 24, vt);
  const ve = mktVerifyText(L.cols + '\n', L, day);
  ok('an empty day is flagged empty and still valid', ve.ok && ve.rows === 0 && ve.q.includes('empty'), ve);
  let few = L.cols + '\n'; for (let i = 0; i < 6000; i++) few += row(d0 + 3 * 3600000 + i * 100, 5000) + '\n';
  const vf = mktVerifyText(few, L, day);
  ok('6,000 rows inside three hours is flagged hours (under 20 of 24 covered)', vf.ok && vf.hours === 1 && vf.q.includes('hours'), vf);
  const M = MARKET_DS.mpad; const m0 = Math.floor(d0 / 60000);
  let mp = M.cols + '\n'; for (let i = 0; i < 1440; i++) mp += [m0 + i, 17.1, 0.001, '"{""dom"":0.1,""hype"":0.2}"', '"{""btc"":1}"'].join(',') + '\n';
  const vm = mktVerifyText(mp, M, day);
  ok('an MPAD day: 1440 minutes read through the 60000 unit, 24 hours, quoted JSON cells do not break it', vm.ok && vm.rows === 1440 && vm.hours === 24 && vm.q.length === 0, vm);
  const vm2 = mktVerifyText(mp + [m0 + 1440, 17.2, 0, '{}', '{}'].join(',') + '\n', M, day);
  ok('the first minute of the NEXT day is outside and refused', !vm2.ok, vm2);
  const W = MARKET_DS.whale_fills;
  let wf = W.cols + '\n'; for (let i = 0; i < 30; i++) wf += [d0 + 3600000 * 12 + i * 60000, d0 + 3600000 * 12 + i * 60000 + 30000, '0xabc', 'BTC', 'open', 1, 400000, 4, 100000, 3, 5, 0, '', 900000].join(',') + '\n';
  const vw = mktVerifyText(wf, W, day);
  ok('whale fills concentrated in one hour are NOT flagged for hours (hourly:false) and pass', vw.ok && vw.q.length === 0 && vw.rows === 30, vw);

  if (!PURE) {
    const KEY = fs.readFileSync('ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
    const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
    const st = await (await fetch(O + '/api/admin/market?grid=40', { headers: H })).json();
    ok('the desk answers with the bucket and every dataset', st && st.bucket === 'marginpad-market' && names.every(k => st.datasets && st.datasets[k]), st && { bucket: st.bucket, ds: Object.keys(st.datasets || {}) });
    const liq = st.datasets && st.datasets.liquidations;
    ok('liquidations: no day owed is missing (the legacy copy had 96 days without a gap; the new one must too)', liq && liq.missing.length === 0 && liq.days >= 96, liq && { days: liq.days, missing: liq.missing.slice(0, 5), first: liq.firstDay, last: liq.lastDay });
    ok('liquidations: the whole series from 2026-07-24 is present', liq && liq.firstDay === '2026-07-24', liq && liq.firstDay);
    const last2 = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    for (const k of names) { const x = st.datasets[k]; if (x.from > last2) continue; ok(k + ': the newest archived day is at most two days old (' + x.newest + ')', x.newest && x.newest >= last2, { newest: x.newest, missing: x.missing.slice(0, 4) }); }
    const grid = (liq && liq.grid) || [];
    const okDays = grid.filter(c => c.s === 'ok' || c.s === 'flag');
    ok('every archived day in the grid carries a row count and a size', okDays.length > 30 && okDays.every(c => c.rows > 0 && c.kb > 0), okDays.slice(0, 3));
    const one = await (await fetch(O + '/api/admin/market?ds=liquidations&day=' + (okDays[okDays.length - 1] || {}).d, { headers: H })).json();
    ok('one object, read back: present, sha256 (64 hex), rows, hours and a revision in its own metadata', one && one.present && /^[0-9a-f]{64}$/.test((one.meta || {}).sha256 || '') && +one.meta.rows > 0 && +one.meta.hours > 0 && +one.meta.rev >= 1, one && one.meta);
    // the collector's export table agrees with the worker's, header for header
    const lst = await (await fetch('https://collector.marginpad.io/api/v1/export?list=1')).json();
    const cds = (lst && lst.datasets) || {};
    for (const k of names) { if (MARKET_DS[k].src !== 'collector') continue; ok('collector export table has ' + k + ' with the identical header', cds[k] && cds[k].cols === MARKET_DS[k].cols, { worker: MARKET_DS[k].cols, collector: cds[k] && cds[k].cols }); }
    ok('the collector keeps funding_oi for 14 days now, not 50 hours', cds.funding_oi && cds.funding_oi.retentionDays === 14, cds.funding_oi);
    // a correction dry run writes nothing
    const dayX = okDays[Math.max(0, okDays.length - 3)].d;
    const before = await (await fetch(O + '/api/admin/market?ds=liquidations&day=' + dayX, { headers: H })).json();
    const dry = await (await fetch(O + '/api/admin/market', { method: 'POST', headers: H, body: JSON.stringify({ op: 'correct', ds: 'liquidations', day: dayX, dropOver: 1e12, why: 'e2e dry run' }) })).json();
    ok('a correction DRY RUN at an absurd ceiling drops nothing and says dry', dry && dry.dry === true && dry.dropped === 0 && dry.rowsBefore === dry.rowsAfter, dry);
    const after = await (await fetch(O + '/api/admin/market?ds=liquidations&day=' + dayX, { headers: H })).json();
    ok('and the object is byte-identical afterwards (same sha256, same revision)', before && after && before.meta.sha256 === after.meta.sha256 && before.meta.rev === after.meta.rev, { before: before && before.meta, after: after && after.meta });
    const bad = await (await fetch(O + '/api/admin/market', { method: 'POST', headers: H, body: JSON.stringify({ op: 'correct', ds: 'agg5m', day: dayX, dropOver: 1 }) })).json();
    ok('a correction on a dataset with no USD column is refused', bad && bad.error === 'dropOver_required', bad);
    // the two phantom days
    for (const d of ['2026-10-07', '2026-10-08']) {
      const html = await (await fetch(O + '/liquidations/recap/' + d + '/?cb=' + Date.now())).text();
      const m = html.match(/biggest liquidation of the day<\/h2><p>A single <b>([^<]+)<\/b> worth <b>([^<]+)<\/b> was force-closed on <b>([^<]+)<\/b>/);
      const usd = m ? m[2] : '';
      ok('recap ' + d + ' no longer names a $100M+ Bitfinex phantom as the biggest liquidation (' + (m ? m.slice(1).join(' | ') : 'no biggest') + ')', m && !/bitfinex/i.test(m[3]) && !/\$1\d\d\.\dM/.test(usd), m && m.slice(1));
      const o = await (await fetch(O + '/api/admin/market?ds=liquidations&day=' + d, { headers: H })).json();
      ok('archive ' + d + ' is a revision 2 with a correction note and a superseded original beside it', o && +((o.meta || {}).rev) === 2 && o.meta.correction && (o.superseded || []).length === 1, o && { meta: o.meta, sup: (o.superseded || []).map(s => s.key) });
    }
    const dg = await (await fetch(O + '/api/admin/liqdiag?days=5', { headers: H })).json();
    ok('liqdiag marks yesterday as present in the market archive', dg && dg.days && dg.days[1] && dg.days[1].market === true, dg && dg.days && dg.days[1]);
  }
  console.log((fail ? 'FAILED ' : 'OK ') + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crash', e); process.exit(1); });
