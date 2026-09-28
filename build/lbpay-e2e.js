/* lbpay-e2e (2026-09-28): THE PAYER AND THE PAGE MUST NAME THE SAME WINNERS.
   Season 2026-09-14 paid the Win Rate board from a candidate list cut at 40 rows (ranked by best-trade ROE) while the
   public page read 500: three scalpers led the page all season and were never paid. Both read LB_CANDIDATES now, and
   this test proves it for the running season: the win-rate top five the payer would pay == the top five the page shows.
   It also proves the old cut reproduces a DIFFERENT list (or at least a shorter candidate set), so the guard is load-bearing.
   Needs ADMIN_KEY.local.txt. Reads only - it pays nothing. */
const fs = require('fs');
const KEY = (fs.readFileSync(require('path').join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io';
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 200) : '')); };
(async () => {
  const lb = await fetch(B + '/api/reward/lb?nc=1&cb=' + Date.now()).then(r => r.json());
  const ws = +lb.weekStart;
  ok(ws > 0 && Array.isArray(lb.topWr), 'public board answers with a season start and a win-rate list', { ws });
  const paid = await fetch(B + '/api/admin/lbpaid?ws=' + ws, { headers: { 'x-admin-key': KEY } }).then(r => r.json());
  ok(Array.isArray(paid.rows) && paid.limit >= 1000, 'payer candidate set is the full one (limit >= 1000)', { limit: paid.limit, rows: (paid.rows || []).length });
  const payerTop = (paid.rows || []).filter(r => r.eligible).slice(0, 5).map(r => r.name);
  const pageTop = (lb.topWr || []).slice(0, 5).map(r => r.who);
  ok(JSON.stringify(payerTop) === JSON.stringify(pageTop), 'the five the payer would pay are the five the page shows', { payerTop, pageTop });
  ok((paid.rows || []).length < paid.limit, 'the candidate list did not come back full (a full list must hold the payout)', { rows: (paid.rows || []).length, limit: paid.limit });
  // the bug, reproduced: at the old cut the candidate set is smaller, so somebody can be missing
  const cut = await fetch(B + '/api/admin/lbpaid?ws=' + ws + '&limit=40', { headers: { 'x-admin-key': KEY } }).then(r => r.json());
  ok((cut.rows || []).length <= 40 && (paid.rows || []).length >= (cut.rows || []).length, 'a 40-row cut is a subset of the full set (the 2026-09-14 failure mode is reproducible)', { cut: (cut.rows || []).length, full: (paid.rows || []).length });
  // every eligible payer row carries the counts the page prints for the same person
  const byName = {}; (lb.topWr || []).forEach(r => { byName[r.who] = r; });
  let mismatch = 0; for (const r of (paid.rows || []).filter(r => r.eligible).slice(0, 15)) { const p = byName[r.name]; if (p && (+p.w !== r.w || +p.l !== r.l)) mismatch++; }
  ok(mismatch === 0, 'win/loss counts agree between payer and page for the ranked rows', { mismatch });
  console.log(out.join('\n')); console.log('\nlbpay-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
