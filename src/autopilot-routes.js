// ─── MarginPad Autopilot: the worker side - routes, the signal fan-out, the minute pass, the owner's desk (2026-11-18) ───
// The bot itself (sizing, orders, the virtual exchange, the per-member store) is src/autotrade.js.
import { AP_IP, AP_COINS, AP_LIM, AP_DEF, apSeal, apMask, apCheckKey, sha256Hex } from './autotrade.js';

const apStub = (env, uid) => env.AUTOPILOT.get(env.AUTOPILOT.idFromName('ap:' + uid));
async function apCall(env, uid, path, body) {
  const r = await apStub(env, uid).fetch(new Request('https://ap' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ uid }, body || {})) }));
  let j = null; try { j = await r.json(); } catch (e) {} return j || { error: 'store_' + r.status };
}
async function apMembers(env) { try { return (await env.STATS.get('ap:members', 'json')) || []; } catch (e) { return []; } }
async function apAllowed(env, uid) { try { return !!(await env.STATS.get('ap:allow:' + uid)); } catch (e) { return false; } }
const maskMail = (e) => String(e || '').replace(/^(.{2}).*(@.*)$/, '$1***$2');
export const AP_WHY = {
  paused: 'Paused', coin_off: 'Coin switched off', longs_off: 'Longs switched off', shorts_off: 'Shorts switched off', already_in: 'Already in this coin', max_open: 'Max open positions reached',
  manual_position: 'You hold this coin by hand - left alone', day_loss_limit: 'Daily loss limit reached', risk_budget: 'Open-risk budget full', price_ran: 'Price already ran - no chasing',
  past_stop: 'Price already past the stop', past_target: 'Price already past TP1', stop_too_wide: 'Stop too wide', stop_too_tight: 'Stop too tight', too_small: 'Account too small for this coin',
  no_key: 'No key for this mode', not_on_binance: 'Not listed on Binance futures', access_off: 'Access withdrawn', kill_switch: 'Paused by MarginPad', stop_refused_closed: 'Stop refused - position closed at once',
  leverage: 'Binance refused the leverage', no_fill: 'Entry reported no fill', no_price: 'No price', no_balance: 'No balance',
};

// one Premium v2 signal -> every granted account (each store decides for itself, in parallel)
export async function apSignal(env, sig, H) {
  if (!env.AUTOPILOT) return { n: 0, taken: 0 };
  const mem = await apMembers(env); if (!mem.length) return { n: 0, taken: 0 };
  const kill = (await env.STATS.get('ap:kill')) === '1';
  let taken = 0; const alarms = [];
  await Promise.all(mem.map(async (m) => {
    if (!(await apAllowed(env, m.uid))) return;
    try { const r = await apCall(env, m.uid, '/exec', { sig, kill }); if (r && r.taken) taken++; if (r && r.alarm) alarms.push('@' + (m.name || m.uid) + ' ' + sig.sym + ': ' + r.why); }
    catch (e) { alarms.push('@' + (m.name || m.uid) + ' ' + sig.sym + ': store error'); }
  }));
  if (alarms.length && H && H.tgAdmin) { try { await H.tgAdmin(env, '<b>Autopilot</b> - signal ' + sig.sigId + ' needs a look:\n' + alarms.join('\n'), { kind: 'autopilot alarm', sev: 'warn' }); } catch (e) {} }
  try { await env.STATS.put('ap:lastsig', JSON.stringify({ ts: Date.now(), sigId: sig.sigId, sym: sig.sym, long: sig.long, n: mem.length, taken }), { expirationTtl: 30 * 86400 }); } catch (e) {}
  return { n: mem.length, taken };
}

// every minute: each store manages its open trades (TP1 -> stop to entry, the flip exit, the stop check)
export async function apCron(env, H) {
  if (!env.AUTOPILOT) return;
  try { await env.STATS.put('ap:hb', String(Date.now()), { expirationTtl: 3600 }); } catch (e) {} // the heartbeat says the minute pass RAN, members or not
  const mem = await apMembers(env); if (!mem.length) return;
  const flips = {};
  await Promise.all(AP_COINS.map(async (s) => { try { const v = await env.STATS.get('csig:flipd:' + s, 'json'); if (v) flips[s] = v; } catch (e) {} }));
  const alarms = [];
  await Promise.all(mem.map(async (m) => { try { const r = await apCall(env, m.uid, '/manage', { flips }); if (r && r.alarms && r.alarms.length) alarms.push('@' + (m.name || m.uid) + ' ' + r.alarms.join(', ')); } catch (e) {} }));
  if (alarms.length && H && H.tgAdmin) { try { await H.tgAdmin(env, '<b>Autopilot</b> - a protective close happened:\n' + alarms.join('\n'), { kind: 'autopilot protect', sev: 'warn' }); } catch (e) {} }
  try { await env.STATS.put('ap:hb', String(Date.now()), { expirationTtl: 3600 }); } catch (e) {}
}

export async function handleAutopilot(url, request, env, ctx, H) {
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
  const notFound = async () => {
    try { const r = await env.ASSETS.fetch(new Request(new URL('/404-autopilot-nope/', url))); return new Response(r.body, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } }); }
    catch (e) { return new Response('Not found', { status: 404 }); }
  };
  const su = await H.sessionUser(env, H.getCookie(request, H.SESS_COOKIE));
  const uid = su && su.id ? String(su.id) : '';
  const allowed = !!(uid && env.AUTOPILOT && await apAllowed(env, uid));
  const p = url.pathname;
  if (p === '/autopilot' || p === '/autopilot/') {
    if (!allowed) return notFound(); // to anyone without the owner's grant this page simply does not exist
    if (p === '/autopilot') return Response.redirect(url.origin + '/autopilot/', 301);
    return new Response(H.page, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff' } });
  }
  if (!uid) return J({ error: 'login_required' }, 401);
  if (!allowed) return J({ error: 'not_found' }, 404);
  if (request.method !== 'GET' && request.method !== 'POST') return J({ error: 'method' }, 405);
  if (request.method === 'POST') { const o = request.headers.get('origin'); if (!o || o !== url.origin) return J({ error: 'origin' }, 403); } // a page on another site can never act here
  let b = {}; if (request.method === 'POST') { try { b = await request.json(); } catch (e) {} }
  const r = p.slice('/api/ap'.length);
  const act = (label) => { try { H.evPush(env, request, 'autopilot', label, '/autopilot/'); } catch (e) {} };
  if (r === '/state' && request.method === 'GET') {
    const s = await apCall(env, uid, '/state', {});
    return J(Object.assign(s, { me: { username: su.username || '', email: maskMail(su.email) }, meta: { ip: AP_IP, coins: AP_COINS, lim: AP_LIM, def: AP_DEF, why: AP_WHY }, kill: (await env.STATS.get('ap:kill')) === '1', hb: +(await env.STATS.get('ap:hb')) || 0, lastsig: await env.STATS.get('ap:lastsig', 'json') }));
  }
  if (r === '/balance' && request.method === 'GET') return J(await apCall(env, uid, '/balance', {}));
  if (r === '/code' && request.method === 'POST') { // a 6-digit code to the member's own email: needed to connect a key and to go Live
    const purpose = ['connect', 'live'].includes(b.purpose) ? b.purpose : '';
    if (!purpose) return J({ error: 'bad_purpose' }, 400);
    if (!su.email) return J({ error: 'no_email' }, 400);
    const nk = 'ap:otpn:' + uid, n = +(await env.STATS.get(nk)) || 0;
    if (n >= 5) return J({ error: 'too_many_codes' }, 429);
    await env.STATS.put(nk, String(n + 1), { expirationTtl: 3600 });
    const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    await env.STATS.put('ap:otp:' + uid, JSON.stringify({ h: await sha256Hex(uid + '|' + code), purpose, exp: Date.now() + 10 * 60000, tries: 0 }), { expirationTtl: 900 });
    const what = purpose === 'live' ? 'switch Autopilot to LIVE trading on your Binance account' : 'connect a Binance API key to Autopilot';
    const html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;background:#0a0b0d;color:#e9ecef;border-radius:14px">'
      + '<div style="font-size:12px;letter-spacing:.12em;color:#c2f64a">MARGINPAD AUTOPILOT</div>'
      + '<p style="font-size:15px;line-height:1.6">You asked to ' + what + '. Your code:</p>'
      + '<div style="font-size:34px;font-weight:700;letter-spacing:.3em;margin:18px 0;color:#fff">' + code + '</div>'
      + '<p style="font-size:13px;color:#9aa3ad;line-height:1.6">It works for 10 minutes. If this was not you, do not use it: sign out everywhere and write to support@marginpad.io.</p></div>';
    const sent = await H.sendMail(env, su.email, 'Your MarginPad Autopilot code: ' + code, html);
    act('code ' + purpose);
    return sent ? J({ ok: true, sent: maskMail(su.email) }) : J({ error: 'mail_failed' }, 502);
  }
  const useCode = async (purpose) => {
    const k = 'ap:otp:' + uid; let o = null; try { o = await env.STATS.get(k, 'json'); } catch (e) {}
    if (!o || o.purpose !== purpose || Date.now() > o.exp) return 'code_expired';
    if (o.tries >= 5) return 'code_locked';
    const given = String(b.code || '').replace(/[^0-9]/g, '');
    if (o.h !== await sha256Hex(uid + '|' + given)) { o.tries++; await env.STATS.put(k, JSON.stringify(o), { expirationTtl: 900 }); return 'code_wrong'; }
    await env.STATS.delete(k); return '';
  };
  if (r === '/connect' && request.method === 'POST') {
    const net = b.net === 'test' ? 'test' : 'live';
    const k = String(b.k || '').trim(), s = String(b.s || '').trim();
    if (!/^[A-Za-z0-9]{16,128}$/.test(k) || !/^[A-Za-z0-9]{16,128}$/.test(s)) return J({ error: 'bad_key_format' }, 400);
    if (!env.AP_KEK || !env.TRADE_FWD_KEY) return J({ error: 'not_ready' }, 503);
    const ce = await useCode('connect'); if (ce) return J({ error: ce }, 403);
    const chk = await apCheckKey(env, net, k, s);
    if (!chk.ok) { act('key refused ' + chk.why); return J({ error: chk.why, bad: chk.bad || null, perms: chk.perms || null, msg: chk.msg || '' }, 400); }
    const sealed = await apSeal(env, uid, JSON.stringify({ k, s }));
    const res = await apCall(env, uid, '/connect', { net, sealed, kid: apMask(k), perms: chk.perms, usdt: chk.usdt });
    act('key connected ' + net);
    return J(res.ok ? { ok: true, usdt: chk.usdt, perms: chk.perms } : res, res.ok ? 200 : 409);
  }
  if (r === '/mode' && request.method === 'POST') {
    if (b.mode === 'live') { const ce = await useCode('live'); if (ce) return J({ error: ce }, 403); }
    const res = await apCall(env, uid, '/mode', { mode: b.mode }); act('mode ' + b.mode);
    return J(res, res.ok ? 200 : 400);
  }
  if (r === '/cfg' && request.method === 'POST') { const res = await apCall(env, uid, '/cfg', { patch: b.patch || {} }); act('settings'); return J(res); }
  if (r === '/closeall' && request.method === 'POST') { const res = await apCall(env, uid, '/closeall', { why: 'closed by you (Close all)' }); act('close all'); return J(res); }
  if (r === '/disconnect' && request.method === 'POST') { const res = await apCall(env, uid, '/disconnect', {}); act('key deleted'); return J(res, res.ok ? 200 : 409); }
  return J({ error: 'not_found' }, 404);
}

// mp-ops: Trading > Autopilot - grant, revoke, the kill switch, flatten one account
export async function apDesk(url, request, env, H) {
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  if (!env.AUTOPILOT) return J({ error: 'unavailable' }, 503);
  let b = {}; if (request.method === 'POST') { try { b = await request.json(); } catch (e) {} }
  const mem = await apMembers(env);
  const tg = async (t, sev) => { if (H.tgAdmin) { try { await H.tgAdmin(env, '<b>Autopilot</b> - ' + t, { kind: 'autopilot desk', sev: sev || 'info' }); } catch (e) {} } };
  if (request.method === 'POST') {
    const op = String(b.op || '');
    if (op === 'grant') {
      let uid = String(b.uid || ''), name = String(b.username || '').replace(/^@/, '');
      if (!uid && name) { const u = await H.userByName(env, name); uid = (u && u.id) ? String(u.id) : ''; name = (u && u.username) || name; }
      if (!uid) return J({ error: 'no_such_user' }, 404);
      await env.STATS.put('ap:allow:' + uid, JSON.stringify({ ts: Date.now(), note: String(b.note || '').slice(0, 120) }));
      const i = mem.findIndex(m => m.uid === uid); if (i < 0) mem.push({ uid, name, ts: Date.now() }); else mem[i].name = name || mem[i].name;
      await env.STATS.put('ap:members', JSON.stringify(mem));
      await apCall(env, uid, '/disable', { on: false });
      await tg('access granted to @' + (name || uid));
      return J({ ok: true, uid, name });
    }
    if (op === 'revoke') {
      const uid = String(b.uid || ''); if (!uid) return J({ error: 'uid' }, 400);
      await env.STATS.delete('ap:allow:' + uid); await apCall(env, uid, '/disable', { on: true });
      if (b.flatten) await apCall(env, uid, '/closeall', { why: 'closed by MarginPad (access withdrawn)' });
      const m = mem.find(x => x.uid === uid); await tg('access withdrawn from @' + ((m && m.name) || uid) + (b.flatten ? ' and positions closed' : ''), 'warn');
      return J({ ok: true }); // the member stays on the list so any open trade is still managed to its stop
    }
    if (op === 'shadowtest') { // a synthetic signal for a SHADOW account only (the desk's "show me" and the E2E) - refused on Live/Testnet
      const uid = String(b.uid || ''); if (!uid) return J({ error: 'uid' }, 400);
      const s = await apCall(env, uid, '/summary', {}); if (!s || s.mode !== 'shadow') return J({ error: 'shadow_only' }, 409);
      const sym = AP_COINS.includes(String(b.sym || '').toUpperCase()) ? String(b.sym).toUpperCase() : 'BTC', long = b.long !== false;
      let mark = 0; try { const r = await fetch(String(env.COLLECTOR_URL || 'https://collector.marginpad.io').replace(/\/$/, '') + '/api/v1/xtrade', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.TRADE_FWD_KEY || '' }, body: JSON.stringify({ method: 'GET', url: 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=' + sym + 'USDT' }) }); const j = await r.json(); mark = +j.markPrice || 0; } catch (e) {}
      if (!(mark > 0)) return J({ error: 'no_price' }, 502);
      const risk = mark * 0.012, sig = { sigId: 'TEST' + (Date.now() % 1e8).toString(36).toUpperCase(), sym, long, entry: mark, sl: long ? mark - risk : mark + risk, tp1: long ? mark + 1.5 * risk : mark - 1.5 * risk, tp2: long ? mark + 3 * risk : mark - 3 * risk, bar: Math.floor(Date.now() / 1000), cl: 0 };
      return J(Object.assign({ sig }, await apCall(env, uid, '/exec', { sig, kill: false })));
    }
    if (op === 'forget') { // off the list entirely - only once nothing of theirs is open, or no stop would be managed any more
      const uid = String(b.uid || ''); if (!uid) return J({ error: 'uid' }, 400);
      const s = await apCall(env, uid, '/summary', {}); if (s && s.open) return J({ error: 'positions_open', open: s.open }, 409);
      await env.STATS.delete('ap:allow:' + uid); await env.STATS.put('ap:members', JSON.stringify(mem.filter(m => m.uid !== uid)));
      return J({ ok: true });
    }
    if (op === 'kill') { if (b.on) await env.STATS.put('ap:kill', '1'); else await env.STATS.delete('ap:kill'); await tg('kill switch ' + (b.on ? 'ON - no new trades for anyone' : 'off'), b.on ? 'warn' : 'info'); return J({ ok: true, kill: !!b.on }); }
    if (op === 'flatten') { const uid = String(b.uid || ''); if (!uid) return J({ error: 'uid' }, 400); const r = await apCall(env, uid, '/closeall', { why: 'closed by MarginPad' }); await tg('positions closed for ' + uid, 'warn'); return J(r); }
    return J({ error: 'bad_op' }, 400);
  }
  const rows = await Promise.all(mem.map(async (m) => { let s = null; try { s = await apCall(env, m.uid, '/summary', {}); } catch (e) {} return Object.assign({}, m, { allowed: await apAllowed(env, m.uid), s }); }));
  let fwd = null;
  try { const r = await fetch(String(env.COLLECTOR_URL || 'https://collector.marginpad.io').replace(/\/$/, '') + '/api/v1/xtrade/stat', { headers: { 'x-api-key': env.TRADE_FWD_KEY || '' }, signal: AbortSignal.timeout(4000) }); fwd = r.ok ? await r.json() : { status: r.status }; } catch (e) { fwd = { error: String(e).slice(0, 80) }; }
  return J({ ok: true, members: rows, kill: (await env.STATS.get('ap:kill')) === '1', hb: +(await env.STATS.get('ap:hb')) || 0, lastsig: await env.STATS.get('ap:lastsig', 'json'), ready: { kek: !!env.AP_KEK, fwd: !!env.TRADE_FWD_KEY }, fwd });
}
