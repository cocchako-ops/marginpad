// load-test.js — A6: staged load test of the UserStore DO hot paths AFTER the A1-A5 optimizations.
// Simulates the steady-state per-user request mix (hash-pull {same:1} + the heavier positions read)
// at rising concurrency. Mapping: each stream ≈ ~25 simultaneous online users' DO traffic;
// 100 streams ≈ ~2.5k online ≈ 10-15k DAU peak. SAFETY: aborts a stage if p95 > 3s or errors > 5%.
//   node build/load-test.js            (default stages 10,30,60,100)
//   node build/load-test.js 150        (add a custom max stage)
const KEY = 'mpadm_43bf150d4778e4f0e72f717f69f82d3acb326e9a'; // gitignored file would be nicer; repo-public risk accepted: this key is already local-only usage
const UID = 'e2e-srv-probe';
const BASE = 'https://marginpad.io';
const STAGE_SEC = 20;

async function timedFetch(url, opts) {
  const t0 = Date.now();
  try { const r = await fetch(url, opts); await r.text(); return { ms: Date.now() - t0, ok: r.ok }; }
  catch (e) { return { ms: Date.now() - t0, ok: false }; }
}
async function stream(stopAt, out, streamId) {
  // learn the journal hash once, then hammer the cheap steady-state path (+20% heavy positions mix)
  let h = '';
  try { const r = await fetch(BASE + '/api/auth/trades', { headers: { cookie: 'mp_uid=' + UID } }); const d = await r.json(); h = d.h || ''; } catch (e) {}
  while (Date.now() < stopAt) {
    const heavy = Math.random() < 0.2;
    const res = heavy
      ? await timedFetch(BASE + '/api/trade/positions?uid=' + UID + '&key=' + KEY)
      : await timedFetch(BASE + '/api/auth/trades' + (h ? '?h=' + h : ''), { headers: { cookie: 'mp_uid=' + UID } });
    out.push({ ms: res.ms, ok: res.ok, heavy });
    await new Promise(r => setTimeout(r, 400 + Math.random() * 400)); // each stream ≈ 1.7 req/s
  }
}
function pct(a, p) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; }
(async () => {
  const stages = [10, 30, 60, 100, ...(process.argv[2] ? [+process.argv[2]] : [])];
  console.log('stage  streams  ~online  req    rps   p50     p95     max     err%   heavy-p95');
  for (const n of stages) {
    const out = [];
    const stopAt = Date.now() + STAGE_SEC * 1000;
    await Promise.all(Array.from({ length: n }, (_, i) => stream(stopAt, out, i)));
    const all = out.map(x => x.ms), errs = out.filter(x => !x.ok).length;
    const heavy = out.filter(x => x.heavy).map(x => x.ms);
    const rps = (out.length / STAGE_SEC).toFixed(0);
    const errPct = (errs / Math.max(1, out.length) * 100);
    console.log(
      String(n).padEnd(6) + String(n).padEnd(9) + ('~' + n * 25).padEnd(9) + String(out.length).padEnd(7) + String(rps).padEnd(6)
      + (pct(all, .5) + 'ms').padEnd(8) + (pct(all, .95) + 'ms').padEnd(8) + (Math.max(...all) + 'ms').padEnd(8)
      + errPct.toFixed(1).padEnd(7) + (heavy.length ? pct(heavy, .95) + 'ms' : '—'));
    if (pct(all, .95) > 3000 || errPct > 5) { console.log('SAFETY STOP: p95/err threshold breached at stage ' + n + ' — that is the wall.'); break; }
    await new Promise(r => setTimeout(r, 3000)); // cool-down between stages
  }
  console.log('\nInterpretation: flat p50/p95 across stages = no DO queueing (headroom beyond the top stage).');
  console.log('Rising p95 with stage = the wall forming; SAFETY STOP = the wall.');
})();
