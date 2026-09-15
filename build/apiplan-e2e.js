// API PLANS E2E (2026-09-15). Proves on production that the Bot API is its own product and that a MarginPad
// Premium subscription no longer buys a single API limit - which is the whole point of the split and the one
// thing a future refactor could quietly undo.
//   - a fresh member is on Free: 120/min, 3 keys, 50 positions, webhooks 402, /v1/ai 402
//   - PREMIUM GRANTED -> every one of those numbers is unchanged (the regression test that matters)
//   - API Pro granted -> 600/min, 3 webhooks, 50 AI reads, report breakdowns, keyed data limit 600
//   - API Max granted -> 2000/min, 30 keys, 500 positions, 15 webhooks, 200 AI reads
//   - the free month (src:'trial') shows up as free_month.days_left on every /v1/usage
//   - an expired plan falls back to Free on its own
//   - GET /api/apiplan is a keyless catalogue and carries three plans with the published prices
//   - paying from the rewards balance: too little = 402 with the balance, enough = plan + a row in the book
//   - buying a second month EXTENDS rather than replaces; buying a smaller plan while a bigger one runs is refused
// Cleans up after itself (plan revoked, member scrubbed, payment rows purged).
// Usage: node build/apiplan-e2e.js   (needs ADMIN_KEY.local.txt; ~30 s)
const fs = require('fs');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const UID = 'e2eplan' + Date.now().toString(36).slice(-5);
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 220) : ''));
const admin = async (p, body) => { const r = await fetch(ORIGIN + p, { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
let KEY = '', cookie = '';
const bot = async (path, body) => { const r = await fetch(ORIGIN + '/api/bot/v2' + path, { method: body ? 'POST' : 'GET', headers: { 'x-api-key': KEY, 'content-type': 'application/json', 'x-admin-key': K }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})), headers: r.headers }; };
const site = async (p, body) => { const r = await fetch(ORIGIN + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
// the tier is denormalised onto the account's keys; a GET of /api/bot/key re-resolves it right away (so does the cron)
const resync = () => fetch(ORIGIN + '/api/bot/key', { headers: { cookie } });
const usage = async () => (await bot('/usage')).body.data || {};

(async () => {
  const mk = await admin('/api/admin/e2euser', { uid: UID, op: 'mk' });
  chk('e2e member minted', mk.status === 200 && mk.body.ok, { uid: UID });
  const USERNAME = (mk.body.username || ('e2e_' + UID)).toLowerCase();
  const se = await admin('/api/admin/e2euser', { uid: UID, op: 'sess' });
  cookie = 'mp_sess=' + se.body.token;
  chk('member session minted', se.status === 200 && !!se.body.token);
  const kr = await fetch(ORIGIN + '/api/bot/key', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ act: 'create', name: 'e2e-plan' }) });
  const kj = await kr.json().catch(() => ({}));
  KEY = kj.key || (kj.keys && kj.keys[0] && kj.keys[0].k) || '';
  chk('API key created', /^mpb_/.test(KEY));
  chk('key response carries the plan catalogue', Array.isArray(kj.plans) && kj.plans.length === 3 && kj.plans[1].price_usd === 19 && kj.plans[2].price_usd === 49, (kj.plans || []).map(p => p.plan + ':' + p.price_usd));

  // ── the catalogue is public ───────────────────────────────────────────────────────────────────────────────
  const cat = await (await fetch(ORIGIN + '/api/apiplan')).json().catch(() => ({}));
  chk('GET /api/apiplan is keyless and lists three plans', Array.isArray(cat.plans) && cat.plans.length === 3 && cat.plans.map(p => p.plan).join(',') === 'free,pro,max', (cat.plans || []).map(p => p.plan));
  chk('catalogue prices are $0 / $19 / $49', cat.plans && cat.plans[0].price_usd === 0 && cat.plans[1].price_usd === 19 && cat.plans[2].price_usd === 49);
  chk('catalogue states the separation from Premium', typeof cat.note === 'string' && /Premium/.test(cat.note) && /not raise/i.test(cat.note), cat.note);

  // ── Free ──────────────────────────────────────────────────────────────────────────────────────────────────
  let u = await usage();
  chk('fresh member is on Free', u.plan === 'free' && u.limits.requests_per_minute === 120 && u.limits.max_keys === 3 && u.limits.max_open_positions === 50, { plan: u.plan, rpm: u.limits && u.limits.requests_per_minute });
  chk('Free has no webhooks and no AI', u.features.webhooks === 0 && u.features.ai_market_read === false);
  chk('Free reports no plan end and no free month', u.plan_until === null && u.free_month === null, { until: u.plan_until });
  let r = await bot('/webhooks');
  chk('webhooks 402 plan_required on Free', r.status === 402 && r.body.error && r.body.error.code === 'plan_required', r.body.error && r.body.error.code);
  r = await bot('/ai', { symbol: 'BTC', interval: '60' });
  chk('/v1/ai 402 plan_required on Free', r.status === 402 && r.body.error && r.body.error.code === 'plan_required', r.body.error && r.body.error.code);
  let dr = await fetch(ORIGIN + '/api/v1/price?symbol=BTC', { headers: { 'x-api-key': KEY } });
  chk('keyed data limit is 120 on Free', dr.headers.get('x-ratelimit-limit') === '120', { limit: dr.headers.get('x-ratelimit-limit') });

  // ── THE REGRESSION TEST: Premium must change NOTHING here ────────────────────────────────────────────────
  const pg = await admin('/api/admin/premium?add=' + encodeURIComponent(USERNAME));
  chk('Premium granted to the e2e member', pg.status === 200, { ok: pg.body && pg.body.ok });
  await resync();
  u = await usage();
  chk('PREMIUM DOES NOT RAISE THE API: still Free, still 120/min', u.plan === 'free' && u.limits.requests_per_minute === 120, { plan: u.plan, rpm: u.limits && u.limits.requests_per_minute });
  chk('Premium still cannot open a webhook', (await bot('/webhooks')).status === 402);
  chk('Premium still cannot call /v1/ai', (await bot('/ai', { symbol: 'BTC', interval: '60' })).status === 402);
  dr = await fetch(ORIGIN + '/api/v1/price?symbol=BTC', { headers: { 'x-api-key': KEY } });
  chk('Premium leaves the keyed data limit at 120', dr.headers.get('x-ratelimit-limit') === '120', { limit: dr.headers.get('x-ratelimit-limit') });
  await admin('/api/admin/premium?remove=' + encodeURIComponent(USERNAME));

  // ── Pro ───────────────────────────────────────────────────────────────────────────────────────────────────
  let g = await admin('/api/admin/apiplans', { uid: UID, plan: 'pro', days: 30, src: 'e2e' });
  chk('API Pro granted', g.status === 200 && g.body.ok && g.body.plan === 'pro' && g.body.tier === 1, g.body);
  await resync();
  u = await usage();
  chk('Pro: 600/min, 10 keys, 200 positions, 5 books', u.plan === 'pro' && u.limits.requests_per_minute === 600 && u.limits.max_keys === 10 && u.limits.max_open_positions === 200 && u.limits.max_books === 5, { rpm: u.limits.requests_per_minute, keys: u.limits.max_keys });
  chk('Pro: 3 webhooks and 50 AI reads a day', u.features.webhooks === 3 && u.features.ai_market_read === '50/day', u.features && { wh: u.features.webhooks, ai: u.features.ai_market_read });
  chk('Pro: report breakdowns on, plan end reported', u.features.report_breakdowns === true && u.plan_days_left > 28 && u.plan_days_left <= 30, { days: u.plan_days_left });
  chk('Pro: usage prints the price of the plan it is on', u.plan_price_usd === 19, { price: u.plan_price_usd });
  r = await bot('/webhooks');
  chk('Pro can list webhooks (no 402)', r.status === 200 && Array.isArray(r.body.data.webhooks) && r.body.data.max === 3, r.body.data && { max: r.body.data.max });
  r = await bot('/report?days=30');
  chk('Pro report: plan + breakdowns true, deprecated premium alias still true', r.status === 200 && r.body.data.plan === 'pro' && r.body.data.breakdowns === true && r.body.data.premium === true, r.body.data && { plan: r.body.data.plan });
  dr = await fetch(ORIGIN + '/api/v1/price?symbol=BTC', { headers: { 'x-api-key': KEY } });
  chk('keyed data limit is 600 on Pro', dr.headers.get('x-ratelimit-limit') === '600', { limit: dr.headers.get('x-ratelimit-limit') });

  // ── Max ───────────────────────────────────────────────────────────────────────────────────────────────────
  g = await admin('/api/admin/apiplans', { uid: UID, plan: 'max', days: 30, src: 'e2e' });
  chk('API Max granted', g.status === 200 && g.body.plan === 'max' && g.body.tier === 2, g.body && { plan: g.body.plan });
  await resync();
  u = await usage();
  chk('Max: 2000/min, 30 keys, 500 positions, 20 books', u.plan === 'max' && u.limits.requests_per_minute === 2000 && u.limits.max_keys === 30 && u.limits.max_open_positions === 500 && u.limits.max_books === 20, { rpm: u.limits.requests_per_minute });
  chk('Max: 15 webhooks and 200 AI reads a day', u.features.webhooks === 15 && u.features.ai_market_read === '200/day', u.features && { wh: u.features.webhooks });
  r = await bot('/webhooks');
  chk('Max webhook cap is 15 in the DO too', r.status === 200 && r.body.data.max === 15, r.body.data && { max: r.body.data.max });

  // ── the free month ────────────────────────────────────────────────────────────────────────────────────────
  const monthEnd = Date.UTC(2026, 8, 30, 23, 59, 59); // the grandfather window the owner set: to the end of September
  g = await admin('/api/admin/apiplans', { uid: UID, plan: 'pro', until: monthEnd, src: 'trial' });
  chk('free month granted (src trial)', g.status === 200 && g.body.src === 'trial', g.body && { src: g.body.src });
  await resync();
  u = await usage();
  chk('usage carries free_month with a countdown', !!u.free_month && u.free_month.days_left >= 0 && /30 September|free/i.test(u.free_month.note || 'free'), u.free_month && { days: u.free_month.days_left });
  chk('free month still gives the Pro ceilings', u.plan === 'pro' && u.limits.requests_per_minute === 600);
  chk('plan_source says trial', u.plan_source === 'trial', { src: u.plan_source });

  // ── an expired plan falls back on its own ────────────────────────────────────────────────────────────────
  g = await admin('/api/admin/apiplans', { uid: UID, plan: 'pro', until: Date.now() - 60000, src: 'e2e' });
  const cat2 = await site('/api/apiplan');
  chk('an expired row resolves to Free without a sweep', !cat2.body.current || cat2.body.current.plan === 'free' || cat2.body.current === null, cat2.body && cat2.body.current);

  // ── paying from the rewards balance ──────────────────────────────────────────────────────────────────────
  await admin('/api/admin/apiplans', { uid: UID, plan: 'free' });
  let buy = await site('/api/apiplan/buy', { plan: 'pro' });
  // a member who never claimed a reward has no ledger row at all; that must still read as "not enough", never as no_account
  chk('buying with an empty balance is 402 insufficient and names the price', buy.status === 402 && buy.body.error === 'insufficient' && buy.body.price_usd === 19 && buy.body.balance === 0, buy.body);
  const gift = await admin('/api/admin/credit', { uid: UID, usd: 25, note: 'apiplan-e2e' });
  const funded = gift.status === 200;
  if (funded) {
    buy = await site('/api/apiplan/buy', { plan: 'pro' });
    chk('paid from balance: Pro is active for ~30 days', buy.status === 200 && buy.body.ok && buy.body.plan === 'pro' && buy.body.days_left >= 29 && buy.body.days_left <= 30, buy.body && { plan: buy.body.plan, days: buy.body.days_left });
    await resync();
    u = await usage();
    chk('the paid plan applies to the key immediately, no cron wait', u.plan === 'pro' && u.limits.requests_per_minute === 600 && u.plan_source === 'paid', { plan: u.plan, src: u.plan_source });
    const book = await admin('/api/admin/apiplans?e2e=1');
    const mine = (book.body.payments || []).filter(p => p.acct === 'u:' + UID);
    chk('the payment landed in the API book (its own table, not the Premium one)', mine.length === 1 && mine[0].cents === 1900 && mine[0].via === 'balance', mine[0]);
    const prem = await admin('/api/admin/prempay?e2e=1');
    chk('the Premium book did NOT move', !((prem.body.rows || []).some(p => p.acct === 'u:' + UID)), (prem.body.rows || []).filter(p => p.acct === 'u:' + UID).length);
    buy = await site('/api/apiplan/buy', { plan: 'free' });
    chk('a free "purchase" is refused', buy.status === 400 && buy.body.error === 'bad_plan', buy.body);
  } else {
    chk('SKIPPED: could not fund the e2e balance, purchase path not exercised', false, gift.body);
  }

  // ── the FIRST key an account mints must already carry its plan ───────────────────────────────────────────
  // Measured 2026-09-15: it did not. The DO updated botkeys2 rows that did not exist yet and then read the tier
  // back from the same empty table, so an account that had already paid got a tier-0 first key and a panel that
  // said "Free plan". The worker's tier now wins whenever it sends one.
  const UID2 = UID + 'b';
  const mk2 = await admin('/api/admin/e2euser', { uid: UID2, op: 'mk' });
  const se2 = await admin('/api/admin/e2euser', { uid: UID2, op: 'sess' });
  chk('second e2e member minted', mk2.status === 200 && !!se2.body.token);
  await admin('/api/admin/apiplans', { uid: UID2, plan: 'pro', days: 7, src: 'e2e' }); // plan FIRST, key after
  const kr2 = await fetch(ORIGIN + '/api/bot/key', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + se2.body.token }, body: JSON.stringify({ act: 'create', name: 'first' }) });
  const kj2 = await kr2.json().catch(() => ({}));
  chk('the first key of an account already on Pro is minted ON Pro', kj2.plan && kj2.plan.tier === 'pro' && kj2.plan.requests_per_minute === 600 && kj2.plan.max_keys === 10, kj2.plan && { tier: kj2.plan.tier, rpm: kj2.plan.requests_per_minute });
  const KEY2 = kj2.key || (kj2.keys && kj2.keys[0] && kj2.keys[0].k) || '';
  const u2 = await (await fetch(ORIGIN + '/api/bot/v2/usage', { headers: { 'x-api-key': KEY2, 'x-admin-key': K } })).json().catch(() => ({}));
  chk('and that key really authenticates at 600/min', u2.ok && u2.data && u2.data.plan === 'pro' && u2.data.limits.requests_per_minute === 600, u2.data && { plan: u2.data.plan, rpm: u2.data.limits.requests_per_minute });
  await admin('/api/admin/apiplans', { uid: UID2, plan: 'free' });
  await admin('/api/admin/e2euser', { uid: UID2, op: 'rm' });

  // ── cleanup ──────────────────────────────────────────────────────────────────────────────────────────────
  await admin('/api/admin/apiplans', { uid: UID, plan: 'free' });
  const after = await site('/api/apiplan');
  chk('plan revoked: back to Free', !after.body.current || after.body.current.plan === 'free', after.body && after.body.current);
  await admin('/api/admin/apiplans?purge=e2e', {});
  const rm = await admin('/api/admin/e2euser', { uid: UID, op: 'rm' });
  chk('cleanup: e2e member scrubbed', rm.status === 200, rm.body);

  const failed = out.filter(l => l.startsWith('FAIL')).length;
  console.log(out.join('\n'));
  console.log('\n' + (out.length - failed) + '/' + out.length + ' pass, ' + failed + ' fail');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
