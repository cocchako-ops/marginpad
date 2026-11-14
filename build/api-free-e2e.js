/* THE API IS FREE WITH NO TIME LIMIT, AND THERE IS ONE PAID PLAN (2026-11-14, owner: "ceo API, bukvalno svi planovi postanu jedan
   free i jedan premium. Taj premium nek bude $11.99 a free nek bude skroz free ... istorijske podatke"). Replaces api-trial-e2e.js.
   A real throwaway member: a minted key carries no trial; an account whose OLD trial row is long expired still trades; the catalogue
   lists exactly Free and API Premium; webhooks and the archive download on Free answer plan_required naming premium; a Premium grant
   lifts the key to Premium's ceilings, registers a webhook and downloads a day of the market archive (rows + sha256 in the headers);
   and a stored row of any retired plan (pro, max, business, lab) reads as Premium.
   --pure runs only the table checks lifted out of the shipped worker. */
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const PURE = process.argv.includes('--pure');
const KEY = (fs.readFileSync('ADMIN_KEY.local.txt', 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const O = 'https://marginpad.io';
const UID = 'e2efree' + Math.random().toString(36).slice(2, 7);
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail).slice(0, 240) : '')); } };
const A = (extra) => Object.assign({ 'x-admin-key': KEY, 'content-type': 'application/json' }, extra || {});
const post = async (p, b, h) => { const r = await fetch(O + p, { method: 'POST', headers: h || A(), body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) }; };

(async () => {
  // ---- pure: the table as shipped
  const src = fs.readFileSync('src/worker.js', 'utf8');
  const tbl = src.slice(src.indexOf('const API_PLANS_RAW = ['), src.indexOf('\n];', src.indexOf('const API_PLANS_RAW = [')));
  const ids = [...tbl.matchAll(/\{\s*id:\s*'(\w+)',\s*tier:\s*(\d+)/g)].map(m => m[1] + ':' + m[2]).join(' ');
  ok('the plan table is free:0 premium:1', ids === 'free:0 premium:1', ids);
  ok('API Premium is $11.99, never discounted, and carries the archive', /id: 'premium'[^}]*cents: 1199[^}]*hist: 1[^}]*nopromo: true/.test(tbl));
  {
    const body = src.slice(src.indexOf('function apiSubTier('), src.indexOf('\n}', src.indexOf('function apiSubTier(')) + 2);
    const f = new Function('API_TIER_MAX', 'return ' + body)(1);
    ok('every stored row of a retired paid plan reads as Premium', [f({ p: 1 }), f({ p: 2 }), f({ p: 3 }), f({ p: 1, v: 2 }), f({ p: 4, v: 2 })].every(t => t === 1));
    ok('and nothing reads above Premium or as paid from nothing', f({ p: 9 }) === 1 && f({ p: 0 }) === 0 && f(null) === 0);
  }
  ok('no engine path refuses trial_expired any more', !/return jb\(\{ error: 'trial_expired'/.test(src));
  ok('the long/short ratio is a market-archive dataset', /longshort:\s*\{ src: 'opslog-ls'/.test(src));
  if (PURE) { console.log('\n' + (pass + fail) + ' checks, ' + fail + ' failed'); process.exitCode = fail ? 1 : 0; return; }

  // ---- the catalogue
  const cat = await (await fetch(O + '/api/apiplan?nc=' + Date.now())).json();
  const pr = (cat.plans || []).find(p => p.plan === 'premium');
  ok('the catalogue lists exactly Free and API Premium at $11.99', (cat.plans || []).length === 2 && !!pr && pr.price_usd === 11.99 && pr.market_archive === true, cat.plans);
  ok('the catalogue says Free does not end and carries no trial', !!(cat.free && cat.free.forever) && !cat.free_trial, { free: cat.free, trial: cat.free_trial });

  // ---- a member
  const mk = await post('/api/admin/e2euser', { uid: UID, op: 'mk' });
  ok('throwaway member created', mk.s === 200 && !mk.j.error, mk.j);
  const se = await post('/api/admin/e2euser', { uid: UID, op: 'sess' });
  const ck = { 'content-type': 'application/json', cookie: 'mp_sess=' + (se.j.token || se.j.sess) };
  const kr = await post('/api/bot/key', { act: 'create', name: 'free-proof' }, ck);
  const key = kr.j && kr.j.key;
  ok('key minted', !!key, kr.j);
  ok('the key response carries no trial and says Free is for ever', !!kr.j && !kr.j.trial && !!(kr.j.free && kr.j.free.forever), { trial: kr.j.trial, free: kr.j.free });
  const H = { 'x-api-key': key };
  const eng = () => fetch(O + '/api/bot/v1/account', { headers: H });
  const r1 = await eng();
  ok('the engine answers on Free, with no trial header', r1.status === 200 && !r1.headers.get('x-mp-trial-expires'), { s: r1.status });

  await post('/api/admin/apitrial', { set: { uid: UID, days: 0 } });
  await new Promise(r => setTimeout(r, 65000)); // the per-isolate trial memo is 60 s; wait it out so a stale gate could show
  const r2 = await eng();
  ok('THE POINT: an account whose old trial ended still trades (no 402)', r2.status === 200, { s: r2.status });

  const wh = await fetch(O + '/api/bot/v1/webhooks', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, H), body: JSON.stringify({ url: 'https://example.com/h', events: ['position.opened'] }) });
  const whj = await wh.json().catch(() => ({}));
  ok('a webhook on Free answers 402 plan_required naming premium', wh.status === 402 && whj.error === 'plan_required' && whj.plan_needed === 'premium' && /API Premium/.test(whj.hint || ''), { s: wh.status, j: whj });
  const hc = await (await fetch(O + '/api/bot/v1/history', { headers: H })).json().catch(() => ({}));
  ok('Free reads the archive catalogue (' + ((hc.datasets || []).length) + ' datasets)', Array.isArray(hc.datasets) && hc.datasets.length >= 8 && hc.your_plan_can_download === false, hc);
  const hd = await fetch(O + '/api/bot/v1/history?dataset=liquidations&day=2026-10-07', { headers: H });
  ok('Free is refused the download with 402', hd.status === 402, { s: hd.status });

  const g = await post('/api/admin/apiplans', { uid: UID, plan: 'premium', days: 30, src: 'owner' });
  ok('API Premium can be granted', g.s === 200 && !g.j.error && g.j.plan === 'premium', g.j);
  await post('/api/bot/key', { act: 'list' }, ck);
  await new Promise(r => setTimeout(r, 1500));
  const us = await (await fetch(O + '/api/bot/v1/usage', { headers: H })).json().catch(() => ({}));
  const lim = us.limits || {};
  ok('on Premium the key reads Premium ceilings and features', us.plan === 'premium' && lim.requests_per_minute === 2000 && lim.max_books === 20 && us.features && us.features.market_archive === true, { plan: us.plan, lim, f: us.features });
  const wh2 = await fetch(O + '/api/bot/v1/webhooks', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, H), body: JSON.stringify({ url: O + '/api/whsink/e2e' + UID, events: ['position.opened'] }) });
  ok('on Premium a webhook registers', wh2.status === 200, { s: wh2.status });
  const dl = await fetch(O + '/api/bot/v1/history?dataset=liquidations&day=2026-10-07', { headers: H });
  const buf = Buffer.from(await dl.arrayBuffer());
  let text = ''; try { text = zlib.gunzipSync(buf).toString('utf8'); } catch (e) {}
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  ok('on Premium a day of the archive downloads, gzip CSV with the right header', dl.status === 200 && text.startsWith('ts,exchange,symbol,side,price,qty,notional'), { s: dl.status, head: text.slice(0, 60) });
  ok('and its rows and sha256 match what the response says', +dl.headers.get('x-mp-rows') === text.trim().split('\n').length - 1 && (!dl.headers.get('x-mp-sha256') || dl.headers.get('x-mp-sha256') === sha), { rows: dl.headers.get('x-mp-rows'), lines: text.trim().split('\n').length - 1, sha: dl.headers.get('x-mp-sha256') === sha });
  const bad = await fetch(O + '/api/bot/v1/history?dataset=nope&day=2026-10-07', { headers: H });
  ok('an unknown dataset is a 400 that lists the real ones', bad.status === 400);

  const r4 = await fetch(O + '/api/v1/price?symbol=BTC');
  ok('keyless market data is untouched', r4.status === 200);

  await post('/api/admin/e2euser', { uid: UID, op: 'rm' });
  console.log('\n' + (pass + fail) + ' checks, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();
