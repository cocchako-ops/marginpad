// Bot API 2.3 E2E (2026-09-11). Proves, on production, every surface the 2.3.0 changelog entry claims, from the
// account's point of view (a throwaway e2e member with a real key), and cleans up after itself.
//   - dry_run prices an open and writes nothing
//   - type:"stop" = breakout entry (accepted on the breakout side, refused on the wrong side), GET /v1/orders says type
//   - /v1/modify_order changes a resting order in place; a done order is 409
//   - trailing stop: opened with trail_pct, ratcheted by an injected price (/api/admin/sweeptest), then stopped out AT
//     the ratcheted level - never at the entry stop
//   - webhooks: 402 on free, then (Premium grant) add / bad url / test ping into the sink / a real position.opened
//     delivery, signed, / delete; the sink shows the body
//   - /v1/report: totals free, breakdowns locked; Premium unlocks findings
//   - keyed data tier: X-API-Key on /api/v1/price -> per-key limit headers; a revoked key is 401
//   - /v1/positions?status=open, /v1/usage features, MCP 22 tools, OpenAPI paths, changelog current version
//   - /v1/ai (Premium): one real call, or a clean 503 when the AI is not configured
// Usage: node build/api23-e2e.js   (needs ADMIN_KEY.local.txt; ~40 s)
const fs = require('fs');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const UID = 'e2eapi' + Date.now().toString(36).slice(-5);
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 220) : ''));
const near = (a, b, tol) => Math.abs(+a - +b) <= (tol == null ? 1e-6 : tol);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const admin = async (p, body) => { const r = await fetch(ORIGIN + p, { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
let KEY = '';
async function bot(path, body, extra) { // Bot API v2 with the account key; returns {status, body, headers}
  const r = await fetch(ORIGIN + '/api/bot/v2' + path, { method: body ? 'POST' : 'GET', headers: { 'x-api-key': KEY, 'content-type': 'application/json', 'x-admin-key': K, ...(extra || {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})), headers: r.headers };
}

(async () => {
  // ── a throwaway member with a real API key ────────────────────────────────────────────────────────────────
  let mk = await admin('/api/admin/e2euser', { uid: UID, op: 'mk' });
  chk('e2e member minted', mk.status === 200 && mk.body.ok, { uid: UID, username: mk.body.username });
  const USERNAME = (mk.body.username || ('e2e_' + UID)).toLowerCase();
  const se = await admin('/api/admin/e2euser', { uid: UID, op: 'sess' });
  chk('member session minted', se.status === 200 && se.body.token, { has: !!se.body.token });
  const cookie = 'mp_sess=' + se.body.token;
  const kr = await fetch(ORIGIN + '/api/bot/key', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ act: 'create', name: 'e2e-2.3' }) });
  const kj = await kr.json().catch(() => ({}));
  KEY = kj.key || (kj.keys && kj.keys[0] && kj.keys[0].k) || '';
  chk('API key created', /^mpb_/.test(KEY), { keyLen: KEY.length });
  const px = (await (await fetch(ORIGIN + '/api/price?symbol=BTC')).json()).price;
  chk('live BTC price available', px > 0, { px });

  // ── dry_run ──────────────────────────────────────────────────────────────────────────────────────────────
  let r = await bot('/open', { symbol: 'BTC', side: 'long', margin_usd: 100, leverage: 10, dry_run: true });
  chk('dry_run open prices the trade and writes nothing', r.status === 200 && r.body.ok && r.body.data.dry_run === true && r.body.data.position.liq_price > 0 && r.body.data.position.fee_round_trip_usd > 0 && !r.body.data.position.id, r.body.data && r.body.data.position);
  let pos = await bot('/positions');
  chk('no position after dry_run', pos.status === 200 && (pos.body.data.positions || []).length === 0, { n: (pos.body.data.positions || []).length });
  r = await bot('/open', { symbol: 'BTC', side: 'long', type: 'stop', limit_price: Math.round(px * 1.05), margin_usd: 50, leverage: 5, dry_run: true });
  chk('dry_run stop order says direction + would_fill_now', r.status === 200 && r.body.data.dry_run && r.body.data.order.type === 'stop' && r.body.data.order.direction === 'up' && r.body.data.order.would_fill_now === false && r.body.data.position_if_filled.liq_price > 0, r.body.data && r.body.data.order);

  // ── stop entries + modify ────────────────────────────────────────────────────────────────────────────────
  r = await bot('/open', { symbol: 'BTC', side: 'long', type: 'stop', limit_price: Math.round(px * 0.95), margin_usd: 50, leverage: 5 });
  chk('stop long BELOW the market refused (stop_wrong_side)', r.status === 400 && r.body.error && r.body.error.code === 'stop_wrong_side', r.body.error);
  r = await bot('/open', { symbol: 'BTC', side: 'long', type: 'stop', limit_price: Math.round(px * 1.06), margin_usd: 50, leverage: 5, client_order_id: 'e2e-stop-' + UID });
  chk('stop long ABOVE the market rests', r.status === 200 && r.body.ok && r.body.data.order && r.body.data.order.status === 'open' && r.body.data.order.type === 'stop', r.body.data && r.body.data.order);
  const stopId = r.body.data && r.body.data.order && r.body.data.order.id;
  r = await bot('/open', { symbol: 'ETH', side: 'short', type: 'limit', limit_price: Math.round((await (await fetch(ORIGIN + '/api/price?symbol=ETH')).json()).price * 1.06), margin_usd: 40, leverage: 3, trail_pct: 2 });
  chk('limit short above the market rests, carries trail_pct', r.status === 200 && r.body.ok && r.body.data.order.status === 'open', r.body.data && r.body.data.order);
  const limId = r.body.data && r.body.data.order && r.body.data.order.id;
  let ol = await bot('/orders');
  const stopRow = (ol.body.data.orders || []).filter(o => o.order_id === stopId)[0], limRow = (ol.body.data.orders || []).filter(o => o.order_id === limId)[0];
  chk('GET /orders labels type stop / limit and trail_pct', !!stopRow && stopRow.type === 'stop' && !!limRow && limRow.type === 'limit' && limRow.trail_pct === 2, { stop: stopRow && stopRow.type, lim: limRow && limRow.type, trail: limRow && limRow.trail_pct });
  r = await bot('/modify_order', { order_id: stopId, limit_price: Math.round(px * 1.08), sl: Math.round(px * 1.02), margin_usd: 75, leverage: 8, trail_pct: 1.5 });
  chk('modify_order changes price / sl / margin / leverage / trail in place', r.status === 200 && r.body.ok && near(r.body.data.order.limit_price, Math.round(px * 1.08)) && near(r.body.data.order.sl, Math.round(px * 1.02)) && r.body.data.order.margin_usd === 75 && r.body.data.order.leverage === 8 && r.body.data.order.trail_pct === 1.5 && r.body.data.order.order_id === stopId, r.body.data && r.body.data.order);
  r = await bot('/modify_order', { order_id: stopId, sl: Math.round(px * 1.20) });
  chk('modify_order refuses an SL above a long level (sl_wrong_side)', r.status === 400 && r.body.error && r.body.error.code === 'sl_wrong_side', r.body.error);
  r = await bot('/modify_order', { order_id: stopId });
  chk('modify_order with nothing to change is 400', r.status === 400 && r.body.error && r.body.error.code === 'nothing_to_modify', r.body.error);
  r = await bot('/cancel_order', { order_id: stopId });
  chk('cancel the stop order', r.status === 200 && r.body.ok, r.body.data);
  r = await bot('/modify_order', { order_id: stopId, limit_price: Math.round(px * 1.07) });
  chk('modify a cancelled order is 409', r.status === 409, r.body.error);
  r = await bot('/cancel_order', { order_id: limId });
  chk('cancel the limit order', r.status === 200 && r.body.ok, r.body.data);

  // ── trailing stop, deterministic ─────────────────────────────────────────────────────────────────────────
  r = await bot('/open', { symbol: 'BTC', side: 'long', margin_usd: 100, leverage: 5, trail_pct: 1, client_order_id: 'e2e-trail-' + UID });
  const tp0 = r.body.data && r.body.data.position;
  chk('open long with trail_pct 1 -> initial stop 1% under entry, trail fields present', r.status === 200 && tp0 && tp0.trail_pct === 1 && tp0.sl != null && near(tp0.sl, tp0.entry_price * 0.99, tp0.entry_price * 1e-4) && near(tp0.trail_hwm, tp0.entry_price, 1e-6), tp0 && { entry: tp0.entry_price, sl: tp0.sl, hwm: tp0.trail_hwm });
  const E = tp0 ? tp0.entry_price : px;
  let sw = await admin('/api/admin/sweeptest?uid=' + UID + '&px=BTC:' + (E * 1.05).toFixed(2));
  chk('sweeptest with +5% price runs', sw.status === 200 && sw.body.ok && sw.body.checked >= 1, sw.body);
  // read the RAW journal here, not /positions: a /positions read runs the live-price sweep, and the live price is
  // below the ratcheted stop, so it would (correctly) stop the position out before we could look at the ratchet
  let jn = await admin('/api/admin/journal?uid=' + UID);
  let tpos = ((jn.body && jn.body.journal) || []).filter(p => p.id === tp0.id)[0];
  chk('trailing stop ratcheted: hwm = 1.05 x entry, stop = hwm x 0.99, still open', !!tpos && tpos.status === 'open' && near(tpos.hwm, E * 1.05, E * 1e-4) && near(tpos.stop, E * 1.05 * 0.99, E * 1e-4), tpos && { stop: tpos.stop, hwm: tpos.hwm, status: tpos.status });
  sw = await admin('/api/admin/sweeptest?uid=' + UID + '&px=BTC:' + (E * 1.03).toFixed(2));
  chk('sweeptest with a pullback to +3% settles the trailing stop', sw.status === 200 && sw.body.swept >= 1, sw.body);
  pos = await bot('/positions');
  tpos = (pos.body.data.positions || []).filter(p => p.id === tp0.id)[0];
  chk('stopped out AT the ratcheted level (1.05 x 0.99 x entry), in profit', !!tpos && tpos.status === 'closed' && near(tpos.exit_price, E * 1.05 * 0.99, E * 1e-4) && tpos.pnl_usd > 0, tpos && { status: tpos.status, exit: tpos.exit_price, pnl: tpos.pnl_usd });
  pos = await bot('/positions?status=open');
  chk('?status=open returns only open positions', pos.status === 200 && (pos.body.data.positions || []).every(p => p.status === 'open'), { n: (pos.body.data.positions || []).length });
  r = await bot('/open', { symbol: 'BTC', side: 'long', margin_usd: 100, leverage: 5, trail_pct: 99 });
  chk('trail_pct out of range refused', r.status === 400 && r.body.error && r.body.error.code === 'trail_pct_invalid', r.body.error);

  // ── /v1/sltp with trail_pct keeps the other level ───────────────────────────────────────────────────────
  r = await bot('/open', { symbol: 'BTC', side: 'short', margin_usd: 60, leverage: 4, tp: Math.round(px * 0.9), client_order_id: 'e2e-sltp-' + UID });
  const sp = r.body.data && r.body.data.position;
  r = await bot('/sltp', { id: sp.id, trail_pct: 2 });
  pos = await bot('/positions?status=open');
  const spos = (pos.body.data.positions || []).filter(p => p.id === sp.id)[0];
  chk('sltp trail_pct only: trailing on, initial stop 2% above entry, TP kept', r.status === 200 && !!spos && spos.trail_pct === 2 && spos.tp != null && near(spos.tp, Math.round(px * 0.9)) && spos.sl != null, spos && { sl: spos.sl, tp: spos.tp, trail: spos.trail_pct });
  r = await bot('/sltp', { id: sp.id, trail_pct: null });
  pos = await bot('/positions?status=open');
  const spos2 = (pos.body.data.positions || []).filter(p => p.id === sp.id)[0];
  chk('sltp trail_pct null switches trailing off', r.status === 200 && !!spos2 && spos2.trail_pct === undefined, spos2 && { trail: spos2.trail_pct });

  // ── free plan: webhooks 402, report totals only, usage ───────────────────────────────────────────────────
  r = await bot('/webhooks');
  chk('webhooks are 402 plan_required on the free plan', r.status === 402 && r.body.error && r.body.error.code === 'plan_required', r.body.error);
  r = await bot('/report?days=30');
  chk('report on free: totals + skill, breakdowns locked', r.status === 200 && r.body.ok && r.body.data.premium === false && r.body.data.total && Array.isArray(r.body.data.locked) && r.body.data.locked.indexOf('findings') >= 0 && !r.body.data.byCoin, r.body.data && { locked: r.body.data.locked, closes: r.body.data.total && r.body.data.total.n });
  r = await bot('/usage');
  chk('usage lists features (webhooks 0 on free, report_breakdowns false, trailing/stop/modify/dry_run true)', r.status === 200 && r.body.data.features && r.body.data.features.webhooks === 0 && r.body.data.features.report_breakdowns === false && r.body.data.features.trailing_stops && r.body.data.features.modify_order && r.body.data.features.dry_run && r.body.data.limits.data_api_requests_per_minute === 120, r.body.data && r.body.data.features);

  // ── keyed data tier ──────────────────────────────────────────────────────────────────────────────────────
  let dr = await fetch(ORIGIN + '/api/v1/price?symbol=BTC', { headers: { 'x-api-key': KEY } });
  chk('keyed /api/v1/price: per-key limit headers (scope=key, limit 120)', dr.status === 200 && dr.headers.get('x-ratelimit-scope') === 'key' && dr.headers.get('x-ratelimit-limit') === '120', { scope: dr.headers.get('x-ratelimit-scope'), limit: dr.headers.get('x-ratelimit-limit'), remaining: dr.headers.get('x-ratelimit-remaining') });
  dr = await fetch(ORIGIN + '/api/v1/fear-greed');
  chk('keyless /api/v1/* unchanged (scope=ip, limit 60)', dr.status === 200 && dr.headers.get('x-ratelimit-scope') === 'ip' && dr.headers.get('x-ratelimit-limit') === '60', { scope: dr.headers.get('x-ratelimit-scope'), limit: dr.headers.get('x-ratelimit-limit') });
  dr = await fetch(ORIGIN + '/api/v1/price?symbol=BTC', { headers: { 'x-api-key': 'mpb_doesnotexist' } });
  chk('bad key on the data API is 401 invalid_api_key', dr.status === 401, { status: dr.status });

  // ── Premium grant: webhooks end to end, report findings, AI ─────────────────────────────────────────────
  let g = await admin('/api/admin/apiplans', { uid: UID, plan: 'pro', days: 1, src: 'e2e' }); // 2026-09-15: the API has its own plans; a Premium grant buys nothing here
  chk('API Pro granted to the e2e member', g.status === 200 && g.body.ok && g.body.plan === 'pro', g.body);
  await fetch(ORIGIN + '/api/bot/key', { method: 'GET', headers: { cookie } }); // re-resolves the tier onto the account's keys
  r = await bot('/usage');
  chk('key now on the pro plan (600/min, webhooks 3, breakdowns)', r.status === 200 && r.body.data.plan === 'pro' && r.body.data.features.webhooks === 3 && r.body.data.features.report_breakdowns === true, r.body.data && { plan: r.body.data.plan, rpm: r.body.data.limits.requests_per_minute });
  const TOKEN = 'e2e' + UID + Date.now().toString(36);
  const SINK = ORIGIN + '/api/whsink/' + TOKEN;
  r = await bot('/webhooks', { act: 'add', url: 'http://example.com/hook' });
  chk('http:// webhook URL refused (bad_url)', r.status === 400 && r.body.error && r.body.error.code === 'bad_url', r.body.error);
  r = await bot('/webhooks', { act: 'add', url: SINK, events: ['nope.event'] });
  chk('unknown event name refused (bad_event)', r.status === 400 && r.body.error && r.body.error.code === 'bad_event', r.body.error);
  r = await bot('/webhooks', { act: 'add', url: SINK });
  const hook = r.body.data && r.body.data.webhook;
  chk('webhook added, secret returned once', r.status === 200 && hook && /^wh/.test(hook.id) && /^whs_/.test(hook.secret) && hook.active === true, hook && { id: hook.id, events: hook.events });
  r = await bot('/webhooks', { act: 'test', id: hook.id });
  chk('test ping delivered to the sink (HTTP 200)', r.status === 200 && r.body.data.delivered === true && r.body.data.status === 200, r.body.data);
  let sink = await (await fetch(SINK)).json();
  const ping = (sink.deliveries || []).filter(d => d.body && d.body.event === 'ping')[0];
  chk('sink shows the ping with event/delivery/signature headers', !!ping && ping.headers['x-mp-event'] === 'ping' && /^sha256=[0-9a-f]{64}$/.test(ping.headers['x-mp-signature'] || '') && ping.headers['x-mp-delivery'], ping && ping.headers);
  // verify the signature with the secret - the receiver's side of the contract
  if (ping) { const { createHmac } = require('crypto'); const raw = JSON.stringify(ping.body); const want = 'sha256=' + createHmac('sha256', hook.secret).update(raw).digest('hex'); chk('HMAC-SHA256 over the raw body verifies with the hook secret', want === ping.headers['x-mp-signature'], { match: want === ping.headers['x-mp-signature'] }); }
  r = await bot('/open', { symbol: 'BTC', side: 'long', margin_usd: 20, leverage: 3, client_order_id: 'e2e-wh-' + UID });
  const whPos = r.body.data && r.body.data.position;
  chk('position opened for the webhook', r.status === 200 && whPos && whPos.id, whPos && { id: whPos.id });
  let opened = null; for (let i = 0; i < 12 && !opened; i++) { await sleep(1500); sink = await (await fetch(SINK)).json(); opened = (sink.deliveries || []).filter(d => d.body && d.body.event === 'position.opened' && d.body.data && d.body.data.id === whPos.id)[0]; }
  chk('position.opened delivered to the webhook within seconds, in the Position shape', !!opened && opened.body.data.symbol === 'BTC' && opened.body.data.status === 'open' && opened.body.data.margin_usd === 20 && opened.body.hook_id === hook.id, opened && { ts: opened.ts, entry: opened.body.data.entry_price, via: opened.body.data.via });
  r = await bot('/close', { id: whPos.id, symbol: 'BTC' });
  let closed = null; for (let i = 0; i < 12 && !closed; i++) { await sleep(1500); sink = await (await fetch(SINK)).json(); closed = (sink.deliveries || []).filter(d => d.body && d.body.event === 'position.closed' && d.body.data && d.body.data.id === whPos.id)[0]; }
  chk('position.closed delivered after /close, with pnl and close_reason', !!closed && closed.body.data.status === 'closed' && typeof closed.body.data.pnl_usd === 'number' && closed.body.data.close_reason, closed && { pnl: closed.body.data.pnl_usd, reason: closed.body.data.close_reason });
  r = await bot('/webhooks');
  const listed = ((r.body.data && r.body.data.webhooks) || []).filter(h => h.id === hook.id)[0];
  chk('GET /webhooks counts the deliveries, zero consecutive failures, still active', r.status === 200 && listed && listed.deliveries >= 3 && listed.consecutive_failures === 0 && listed.active === true, listed && { deliveries: listed.deliveries, fails: listed.consecutive_failures, last_error: listed.last_error });
  r = await bot('/webhooks', { act: 'add', url: SINK + 'b' }); r = await bot('/webhooks', { act: 'add', url: SINK + 'c' });
  r = await bot('/webhooks', { act: 'add', url: SINK + 'd' });
  chk('a fourth webhook is refused (too_many_webhooks, max 3)', r.status === 409 && r.body.error && r.body.error.code === 'too_many_webhooks', r.body.error);
  r = await bot('/webhooks', { act: 'delete', id: hook.id });
  chk('webhook deleted', r.status === 200 && r.body.ok, r.body.data);
  r = await bot('/report?days=30');
  chk('report on premium: findings + breakdowns present', r.status === 200 && r.body.data.premium === true && Array.isArray(r.body.data.findings) && r.body.data.byCoin !== undefined, r.body.data && { findings: r.body.data.findings.length, total: r.body.data.total && r.body.data.total.n });
  r = await bot('/ai', { symbol: 'BTC', interval: '60', question: 'One sentence: is this leaning long or short?' });
  chk('/v1/ai on premium: an answer with the brief (or a clean 503 when unconfigured)', (r.status === 200 && r.body.ok && r.body.data.answer && r.body.data.brief && r.body.data.brief.rsi14 != null && r.body.data.used >= 1) || (r.status === 503 && r.body.error && r.body.error.code === 'ai_unconfigured'), r.body.data ? { used: r.body.data.used, limit: r.body.data.limit, rsi: r.body.data.brief.rsi14, plan: !!r.body.data.plan, answer: String(r.body.data.answer).slice(0, 80) } : r.body.error);
  r = await bot('/ai', { symbol: 'ZZZZNOPE', interval: '60' });
  chk('/v1/ai unknown symbol is 404', r.status === 404 || r.status === 503, r.body.error);
  dr = await fetch(ORIGIN + '/api/v1/price?symbol=BTC', { headers: { 'x-api-key': KEY } });
  chk('keyed data API on premium: limit 600', dr.headers.get('x-ratelimit-limit') === '600', { limit: dr.headers.get('x-ratelimit-limit') });

  // ── fee venues (Bot API 2.4) ─────────────────────────────────────────────────────────────────────────────
  r = await bot('/fees');
  chk('GET /fees lists 9 venues with effective rates and no default yet', r.status === 200 && r.body.data.fee_venue === null && (r.body.data.venues || []).length === 9 && r.body.data.venues.some(v => v.venue === 'hyperliquid' && v.referral_discount_pct === 4 && near(v.effective_taker_pct, 0.0432, 1e-6) && v.code === 'MARGINPAD'), r.body.data && r.body.data.venues && r.body.data.venues.map(v => v.venue + ':' + v.effective_taker_pct));
  r = await bot('/open', { symbol: 'BTC', side: 'long', margin_usd: 100, leverage: 10, fee_venue: 'nope' });
  chk('unknown fee_venue refused (400 unknown_fee_venue)', r.status === 400 && r.body.error && r.body.error.code === 'unknown_fee_venue', r.body.error);
  r = await bot('/open', { symbol: 'BTC', side: 'long', margin_usd: 100, leverage: 10, fee_venue: 'hyperliquid', dry_run: true });
  chk('dry_run with fee_venue quotes the venue rate and the dollar difference', r.status === 200 && r.body.data.position.fee_venue === 'hyperliquid' && near(r.body.data.position.taker_fee_pct, 0.0432, 1e-5) && r.body.data.position.fee_vs_marginpad_default_usd < 0, r.body.data && { rate: r.body.data.position.taker_fee_pct, diff: r.body.data.position.fee_vs_marginpad_default_usd });
  r = await bot('/open', { symbol: 'BTC', side: 'long', margin_usd: 100, leverage: 10, fee_venue: 'bybit', client_order_id: 'e2e-fee-' + UID });
  const fp = r.body.data && r.body.data.position;
  chk('open with fee_venue bybit: position stamped 0.044% (0.055% less 20%)', r.status === 200 && fp && fp.fee_venue === 'bybit' && near(fp.fee_rate_pct, 0.044, 1e-5), fp && { venue: fp.fee_venue, rate: fp.fee_rate_pct });
  r = await bot('/fees', { venue: 'hyperliquid' });
  chk('POST /fees sets the account default', r.status === 200 && r.body.data.fee_venue === 'hyperliquid', r.body.data);
  r = await bot('/open', { symbol: 'ETH', side: 'short', margin_usd: 50, leverage: 5, client_order_id: 'e2e-feedef-' + UID });
  const fp2 = r.body.data && r.body.data.position;
  chk('an open with no fee_venue inherits the account default (hyperliquid 0.0432%)', r.status === 200 && fp2 && fp2.fee_venue === 'hyperliquid' && near(fp2.fee_rate_pct, 0.0432, 1e-5), fp2 && { venue: fp2.fee_venue, rate: fp2.fee_rate_pct });
  r = await bot('/open', { symbol: 'ETH', side: 'short', margin_usd: 50, leverage: 5, fee_venue: null, dry_run: true });
  chk('fee_venue null overrides the default back to 0.055% for one call', r.status === 200 && r.body.data.position.fee_venue === null && near(r.body.data.position.taker_fee_pct, 0.055, 1e-5), r.body.data && r.body.data.position.taker_fee_pct);
  r = await bot('/open', { symbol: 'SOL', side: 'long', type: 'limit', limit_price: Math.round((await (await fetch(ORIGIN + '/api/price?symbol=SOL')).json()).price * 0.9 * 100) / 100, margin_usd: 30, leverage: 3, fee_venue: 'mexc' });
  chk('a resting order carries its fee venue', r.status === 200 && r.body.data.order && r.body.data.order.fv === 'mexc', r.body.data && r.body.data.order && { fv: r.body.data.order.fv });
  await bot('/cancel_order', { order_id: r.body.data && r.body.data.order && r.body.data.order.id });
  r = await bot('/fees', { venue: null });
  chk('POST /fees null resets the default', r.status === 200 && r.body.data.fee_venue === null, r.body.data);
  r = await bot('/usage');
  chk('usage lists fee_venues', r.status === 200 && Array.isArray(r.body.data.features.fee_venues) && r.body.data.features.fee_venues.length === 9, r.body.data && r.body.data.features.fee_venues);

  // ── meta surfaces ────────────────────────────────────────────────────────────────────────────────────────
  const mcp = await (await fetch(ORIGIN + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })).json();
  const names = ((mcp.result && mcp.result.tools) || []).map(t => t.name);
  chk('MCP lists 27 tools incl. paper_modify_order + paper_report + paper_fees + paper_replay', names.length >= 27 && names.indexOf('paper_replay') >= 0 && names.indexOf('paper_modify_order') >= 0 && names.indexOf('paper_report') >= 0 && names.indexOf('paper_fees') >= 0, { n: names.length });
  const oa = await (await fetch(ORIGIN + '/api/openapi.json')).json();
  chk('OpenAPI carries the 2.3+ paths + schemas', /^2\.[5-9]\.|^[3-9]\./.test(String(oa.info.version)) && oa.paths['/api/bot/v1/fees'] && oa.paths['/api/bot/v1/webhooks'] && oa.paths['/api/bot/v1/modify_order'] && oa.paths['/api/bot/v1/report'] && oa.paths['/api/bot/v1/ai'] && oa.components.schemas.WebhookDelivery, { paths: Object.keys(oa.paths).length });
  const cl = await (await fetch(ORIGIN + '/api/changelog?format=json')).json();
  chk('changelog current_version is 2.5 or newer', cl.data && /^2\.[5-9]\.|^[3-9]\./.test(String(cl.data.current_version)), { v: cl.data && cl.data.current_version });
  const sdkPy = await fetch(ORIGIN + '/assets/sdk/marginpad.py'), sdkJs = await fetch(ORIGIN + '/assets/sdk/marginpad.js');
  chk('SDK files served (python + js)', sdkPy.status === 200 && sdkJs.status === 200, { py: sdkPy.status, js: sdkJs.status });

  // ── cleanup ──────────────────────────────────────────────────────────────────────────────────────────────
  await bot('/close_all', {});
  await admin('/api/admin/apiplans', { uid: UID, plan: 'free' });
  const rm = await admin('/api/admin/e2euser', { uid: UID, op: 'rm' });
  chk('cleanup: premium removed, e2e member scrubbed', rm.status === 200, rm.body);

  console.log(out.join('\n'));
  const fails = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + (out.length - fails) + '/' + out.length + ' checks passed' + (fails ? ' - ' + fails + ' FAILED' : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('E2E crashed:', e); console.log(out.join('\n')); process.exit(1); });
