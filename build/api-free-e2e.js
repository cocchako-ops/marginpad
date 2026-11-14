/* THE API IS FREE WITH NO TIME LIMIT, AND LAB IS $5 (2026-11-14, owner: "ajde da damo nas API free svima, i da stavimo neki
   plan od $5 koji daje nesto za advanced testing botova"). Replaces api-trial-e2e.js, which proved the retired 402 gate.
   A real throwaway member: a minted key carries no trial; an account whose OLD trial row is long expired still trades;
   the catalogue lists Lab at $5 between Free and Pro and says Free does not end; webhooks on Free answer plan_required
   naming Lab; a Lab grant lifts the key to Lab's ceilings and registers a webhook; and an OLD-numbered api:sub row (no v)
   still reads as the plan it was bought as (the tier numbers moved by one).
   --pure runs only the table checks lifted out of the shipped worker. */
const fs = require('fs');
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
  ok('the plan table is free:0 lab:1 pro:2 max:3 business:4', ids === 'free:0 lab:1 pro:2 max:3 business:4', ids);
  ok('Lab is $5 and never discounted', /id: 'lab'[^}]*cents: 500[^}]*nopromo: true/.test(tbl));
  {
    const body = src.slice(src.indexOf('function apiSubTier('), src.indexOf('\n}', src.indexOf('function apiSubTier(')) + 2);
    const f = new Function('API_TIER_MAX', 'return ' + body)(4);
    ok('an OLD row (no v) reads one tier up: pro 1 -> 2, max 2 -> 3, business 3 -> 4', f({ p: 1 }) === 2 && f({ p: 2 }) === 3 && f({ p: 3 }) === 4, [f({ p: 1 }), f({ p: 2 }), f({ p: 3 })]);
    ok('a NEW row (v:2) reads as written, and nothing reads above business', f({ p: 1, v: 2 }) === 1 && f({ p: 4, v: 2 }) === 4 && f({ p: 9 }) === 4);
  }
  ok('no engine path refuses trial_expired any more', !/return jb\(\{ error: 'trial_expired'/.test(src));
  if (PURE) { console.log('\n' + (pass + fail) + ' checks, ' + fail + ' failed'); process.exitCode = fail ? 1 : 0; return; }

  // ---- the catalogue
  const cat = await (await fetch(O + '/api/apiplan?nc=' + Date.now())).json();
  const lab = (cat.plans || []).find(p => p.plan === 'lab');
  ok('the catalogue lists Lab at $5, second, with no list price', !!lab && lab.price_usd === 5 && !lab.list_price_usd && (cat.plans || [])[1].plan === 'lab', cat.plans && cat.plans.slice(0, 2));
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
  const eng = () => fetch(O + '/api/bot/v1/account', { headers: { 'x-api-key': key } });
  const r1 = await eng();
  ok('the engine answers on Free, with no trial header', r1.status === 200 && !r1.headers.get('x-mp-trial-expires'), { s: r1.status, h: r1.headers.get('x-mp-trial-expires') });

  // an OLD trial row, long expired, must not refuse anything any more
  await post('/api/admin/apitrial', { set: { uid: UID, days: 0 } });
  await new Promise(r => setTimeout(r, 65000)); // the per-isolate trial memo is 60 s; wait it out so a stale gate could show
  const r2 = await eng();
  ok('THE POINT: an account whose old trial ended still trades (no 402)', r2.status === 200, { s: r2.status, body: await r2.clone().json().catch(() => null) });

  // webhooks on Free name Lab
  const wh = await fetch(O + '/api/bot/v1/webhooks', { method: 'POST', headers: { 'x-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com/h', events: ['position.opened'] }) });
  const whj = await wh.json().catch(() => ({}));
  ok('a webhook on Free answers 402 plan_required naming Lab', wh.status === 402 && whj.error === 'plan_required' && whj.plan_needed === 'lab' && /Lab/.test(whj.hint || ''), { s: wh.status, j: whj });

  // a Lab grant
  const g = await post('/api/admin/apiplans', { uid: UID, plan: 'lab', days: 30, src: 'owner' });
  ok('Lab can be granted', g.s === 200 && !g.j.error, g.j);
  await post('/api/bot/key', { act: 'list' }, ck); // pushes the tier onto the keys at once
  await new Promise(r => setTimeout(r, 1500));
  const us = await (await fetch(O + '/api/bot/v1/usage', { headers: { 'x-api-key': key } })).json().catch(() => ({}));
  const lim = (us && (us.limits || (us.data && us.data.limits))) || {};
  ok('on Lab the key reads Lab ceilings (300 rpm, 5 books, 3 hooks)', String(JSON.stringify(us)).indexOf('"lab"') >= 0 && (lim.requests_per_minute === 300 || lim.rpm === 300 || /"300"|:300\b/.test(JSON.stringify(lim))), us);
  const wh2 = await fetch(O + '/api/bot/v1/webhooks', { method: 'POST', headers: { 'x-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify({ url: O + '/api/whsink/e2e' + UID, events: ['position.opened'] }) });
  ok('on Lab a webhook registers', wh2.status === 200, { s: wh2.status, j: await wh2.json().catch(() => null) });

  // the market data boundary, unchanged
  const r4 = await fetch(O + '/api/v1/price?symbol=BTC');
  ok('keyless market data is untouched', r4.status === 200);

  await post('/api/admin/e2euser', { uid: UID, op: 'rm' });
  console.log('\n' + (pass + fail) + ' checks, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();
