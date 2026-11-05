/* WHAT MOVED IT, THE EARLY HALF (2026-11-05, owner: "da se kao indikator na vreme pojavi tako da korisnici mogu da budu
 * obavesteni o potencijalnom skoku zbog odredjenih stvari ... jako precizno"). Measured first (scratchpad/cx-seen-study.js, 30 d,
 * first report of every story, from OUR clock ts_seen): a media item moves nothing on median after we see it (x60 ~1, the
 * direction right 34-52% = a coin flip), and only 12% of items arrive after the move already ran - so lateness is not the
 * problem, predictive value is. What measured something: an exchange's own listing/delisting (F0: delisting 69% down, spot
 * listing +1.6%/60 min), a scheduled macro print (CPI 5.3x, FOMC 4x the usual bar - volatility, no direction), a major story.
 * So: (1) `landed` - a first report that passes the measured gate is recorded the minute it lands and drawn on the chart BEFORE
 * any move, with what events like it have done; (2) `ahead` - a scheduled macro print is announced ~30 min before it;
 * (3) `moving` - the server runs the detector over the coins members hold and alerts an abnormal move while it runs, with the
 * cause; (4) every record is SETTLED against the candles an hour later and the accuracy per cell is public - a cell that keeps
 * missing mutes itself (cxEarlyMuted). Idempotent (marker), --dry prints only, split/join only (never a $ replacement). */
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, '..', 'src', 'worker.js');
const DRY = process.argv.includes('--dry');
let s = fs.readFileSync(F, 'utf8');
const MARK = '/* @CX_EARLY 2026-11-05 */';
if (s.indexOf(MARK) >= 0) { console.log('fix-cx-early: already applied'); process.exit(0); }
const once = (needle) => { const i = s.indexOf(needle); if (i < 0) throw new Error('anchor missing: ' + needle.slice(0, 70)); if (s.indexOf(needle, i + 1) >= 0) throw new Error('anchor not unique: ' + needle.slice(0, 70)); return i; };
const rep = (a, b) => { once(a); s = s.split(a).join(b); };

// ---- 1) pure helpers inside the cx block (lifted by the suites) ----
const PURE = `${MARK}
// THE EARLY HALF: a catalyst judged the minute it LANDS, before any move exists (2026-11-05). The gate is MEASURED from our own
// clock (scratchpad/cx-seen-study.js, 30 days, first report per story, from ts_seen): media kinds - news, regulation, hack
// under $50M, whale, politics, etf, filing - move nothing on median after we see them (x60 about 1 against a placebo of 1,
// direction right 34-52%), so they are never an early alert, however loud; an exchange's own listing or delisting and a major
// story (two desks, importance 70+) are, and a scheduled macro print is announced AHEAD. Every record is settled an hour later
// (cxEarlySettleOne) and a cell whose own record says it misses mutes itself (cxEarlyMuted) - the rule, not a human, retires it.
// listing: 13 first reports in the month, direction right 77%, the hour 1.8x usual (media desks included - a Coinbase or Binance
// listing reaches us through a desk); delisting: the exchange's own only (F0, n 164, 69% down). A desk reporting more than ten
// minutes after its own timestamp is reporting a move (x60 2.4, 35% already running when seen): an explanation, never an alert.
const CX_EARLY_KINDS = { listing: 1, delisting: 1 }, CX_EARLY_LATE_MS = 10 * 60000;
const CX_EARLY_MUTE_N = 20, CX_EARLY_MUTE_HIT = 0.55, CX_EARLY_MUTE_BIG = 0.3, CX_EARLY_SETTLE_MS = 65 * 60000, CX_EARLY_KEEP_MS = 48 * 3600000, CX_EARLY_MAX = 200;
function cxEarlyCell(c) { return (c.kind || 'news') + '|' + (c.tier || '') + '|' + (c.major ? 'major' : c.why === 'score' ? 'score' : 'plain'); }
function cxEarlyMuted(acc, cell) { const a = acc && acc[cell]; if (!a || !(a.n >= CX_EARLY_MUTE_N)) return false; const big = a.big / a.n, hit = a.nd ? a.hit / a.nd : null; return big < CX_EARLY_MUTE_BIG && (hit == null || hit < CX_EARLY_MUTE_HIT); }
// c = an ENRICHED item (cxEnrich: labels, impact, story). null = not an early alert; {muted:true} = would be, but its cell's own record says no.
function cxEarlyDecide(c, now, acc) {
  if (!c || !c.id || CX_SKIP_KIND[c.kind]) return null;
  const syms = String(c.syms || '').split(',').filter(Boolean);
  if (!syms.length || syms.length > 3) return null;
  const seen = +c.ts_seen || 0; if (!(seen > 0) || now - seen > 3 * 60000) return null;
  // a follow-up to a story the market already had is never an alert: only the first report of a story lands
  const first = c.story && +c.story.first > 0 ? +c.story.first : +c.ts_src;
  if (c.story && c.story.n > 1 && (+c.ts_src - first) > 20 * 60000) return null;
  if (c.market === 'tradfi') return null;
  const prim = c.tier === 'primary' || c.tier === 'official';
  const exch = (c.kind === 'listing' && (prim || c.tier === 'mediaA')) || (c.kind === 'delisting' && prim);
  if ((seen - (+c.ts_src || seen)) > (exch ? 3 * CX_EARLY_LATE_MS : CX_EARLY_LATE_MS)) return null; // an exchange kind rides a slow RSS (CoinDesk 22 min on median): 30 min for those, 10 for the rest
  const major = !!c.major;
  const strong = (+c.score >= 70) && c.kind !== 'whale' && c.kind !== 'news';
  const why = exch ? 'exchange' : major ? 'major' : strong ? 'score' : null;
  if (!why) return null;
  if (c.kind === 'hack' && !((c.usd != null ? +c.usd : cxUsd(String(c.title || '') + ' ' + ((c.lbl && c.lbl.sum) || ''))) >= CX_HACK_MIN_USD)) return null;
  const cc = Object.assign({ why }, c); const cell = cxEarlyCell(cc);
  if (cxEarlyMuted(acc, cell)) return { muted: true, cell, id: c.id, kind: c.kind, syms };
  const im = cxImpactOf(c.kind, c.tier, false) || cxImpactOf(c.kind, c.tier, true);
  return { type: 'landed', id: c.id, key: 'l:' + (c.story && c.story.k ? c.story.k : c.id), story: c.story ? c.story.k : null, cell, why, kind: c.kind, tier: c.tier, syms: syms.slice(0, 3), expect: +c.expect || 0, seen, src: +c.ts_src || seen, score: +c.score || 0, imp: c.lbl && c.lbl.imp != null ? +c.lbl.imp : null, title: String((c.story && c.story.firstTitle) || c.title || '').slice(0, 140), source: String((c.story && c.story.firstSource) || c.source || ''), url: String((c.story && c.story.firstUrl) || c.url || '').slice(0, 300), desks: c.story ? +c.story.n || 1 : 1, sum: String((c.lbl && c.lbl.sum) || '').slice(0, 120), exp: im ? { x15: im.x15, x60: im.x60 != null ? im.x60 : null, n: im.n, hit: im.hit15 } : null };
}
// what the record says to a member and on the chart: the kind in words, then the measured record of that kind, never a forecast
function cxEarlyText(r) {
  if (!r) return '';
  if (r.type === 'ahead') return r.title + ' in ' + Math.max(1, Math.round((r.ts - (r.at || r.ts)) / 60000)) + ' min' + (r.exp && r.exp.n >= 12 ? ' - a print like this has moved BTC ' + r.exp.x15 + 'x the usual 15-minute bar (n ' + r.exp.n + '), direction a coin flip' : '');
  if (r.type === 'moving') return (r.pct > 0 ? '+' : '') + r.pct + '% in ' + Math.max(1, Math.round((r.t1 - r.t0) / 60000)) + ' min - ' + (r.labelFull || r.label || 'cause unknown');
  const kindW = r.kind === 'listing' ? 'listing' : r.kind === 'delisting' ? 'delisting' : r.kind + (r.why === 'major' ? ' (major story, ' + r.desks + ' desks)' : '');
  const src = String(r.source || '').replace(/^(rss|tg|x):/, '').replace(/-ann$/, '');
  const e = r.exp;
  const rec = e && e.n >= 12 ? ' Events like this moved price ' + (e.x60 != null ? e.x60 + 'x the usual hour' : e.x15 + 'x the usual 15-minute bar') + ' (n ' + e.n + (e.hit != null ? ', direction right ' + Math.round(100 * e.hit) + '%' : '') + ').' : ' No measured record for this kind yet - a watch, not a forecast.';
  return kindW + ' on ' + src + ': ' + r.title + '.' + rec;
}
// settle one record against 1-minute bars from its own moment: r15/r60, the hour's extremes, the coin's usual 15-minute bar (base15,
// the median |return| of the 15m bars before), big = the hour moved at least 1.5x the usual hour, hit = the direction we said
function cxEarlySettleOne(rec, bars1m, base15) {
  const T = rec.type === 'ahead' ? +rec.ts : rec.type === 'moving' ? +rec.at : +rec.seen; if (!(T > 0)) return null;
  const b = (bars1m || []).filter(x => +x.time > 0).map(x => ({ t: +x.time * 1000, o: +x.open, h: +x.high, l: +x.low, c: +x.close })).sort((x, y) => x.t - y.t);
  const i0 = b.findIndex(x => x.t + 60000 > T); if (i0 < 1) return null;
  const base = b[i0 - 1].c; if (!(base > 0)) return null;
  const at = (h) => { const want = T + h * 60000; let j = i0; while (j < b.length && b[j].t + 60000 <= want) j++; const x = b[Math.min(j, b.length - 1)]; return x && x.t <= want + 120000 && x.t + 60000 >= want - 120000 ? x.c / base - 1 : null; };
  const r15 = at(15), r60 = at(60); if (r60 == null) return null;
  let up = 0, dn = 0; for (let j = i0; j < b.length && b[j].t < T + 3600000; j++) { up = Math.max(up, b[j].h / base - 1); dn = Math.min(dn, b[j].l / base - 1); }
  const b15 = +base15 > 0 ? +base15 : null, b60 = b15 != null ? b15 * 2 : null;
  const x60 = b60 ? +(Math.abs(r60) / b60).toFixed(2) : null, x15 = b15 && r15 != null ? +(Math.abs(r15) / b15).toFixed(2) : null;
  const big = x60 != null ? x60 >= 1.5 : null;
  const ex = +rec.expect || (rec.type === 'moving' ? Math.sign(+rec.pct || 0) : 0);
  const hit = ex ? Math.sign(r60) === ex : null;
  return { at: Date.now(), r15: r15 != null ? +(100 * r15).toFixed(2) : null, r60: +(100 * r60).toFixed(2), up: +(100 * up).toFixed(2), dn: +(100 * dn).toFixed(2), base15: b15 != null ? +(100 * b15).toFixed(3) : null, x15, x60, big, hit, p0: base };
}
function cxEarlyAccAdd(acc, rec) {
  const o = acc || {}; const st = rec && rec.settled; if (!st || st.x60 == null) return o;
  const a = o[rec.cell] = o[rec.cell] || { n: 0, big: 0, nd: 0, hit: 0, x: 0 };
  a.n++; if (st.big) a.big++; a.x += st.x60; if (st.hit != null) { a.nd++; if (st.hit) a.hit++; }
  return o;
}
// the public accuracy table: one row per cell, the muted ones named
function cxEarlyAccPublic(acc) { const out = {}; for (const k in acc || {}) { const a = acc[k]; out[k] = { n: a.n, bigPct: a.n ? Math.round(100 * a.big / a.n) : null, hitPct: a.nd ? Math.round(100 * a.hit / a.nd) : null, nDir: a.nd, x60: a.n ? +(a.x / a.n).toFixed(2) : null, muted: cxEarlyMuted(acc, k) }; } return out; }
`;
const anchorPure = '// GET /api/catalysts/moves?symbol=BTC&tf=15&days=30   |   &at=<ms>&pct=&n=   (one live move, same rules, no month)';
once(anchorPure); s = s.split(anchorPure).join(PURE + anchorPure);

// ---- 2) the cron half + the route, replacing checkCatalystAlerts whole ----
const aStart = once('async function checkCatalystAlerts(env) {');
const aEnd = once('async function checkPositionAlerts(env) {');
const ASYNC = `async function cxEarlyRead(env) { try { const j = JSON.parse(await env.STATS.get('cx:early') || 'null'); return j && Array.isArray(j.items) ? j : { items: [], upcoming: [] }; } catch (e) { return { items: [], upcoming: [] }; } }
async function cxEarlyAccRead(env) { try { return JSON.parse(await env.STATS.get('cx:early:acc') || '{}') || {}; } catch (e) { return {}; } }
// THE MINUTE'S EARLY PASS (2026-11-05): what landed in the last three minutes, what is scheduled inside 35 minutes, and (every other
// minute) whether a coin a member holds is moving abnormally right now. Writes the ring once; the alert sender reads \`fresh\`.
async function cxEarlyTick(env, now, base, heldSyms) {
  const st = await cxEarlyRead(env), acc = await cxEarlyAccRead(env);
  const have = new Set(st.items.map(r => r.key));
  const fresh = [];
  let items = [], upcoming = [];
  const ctl = new AbortController(); const tmr = setTimeout(() => ctl.abort(), 2500);
  try { const r = await __realFetch(base + '/api/v1/catalysts?since=' + (now - 3 * 60000) + '&limit=120&min=25', { signal: ctl.signal }); if (r.ok) { const j = await r.json(); items = (j && j.items) || []; upcoming = (j && j.upcoming) || []; } } catch (e) {} finally { clearTimeout(tmr); }
  // 1) landed
  if (items.length) {
    const en = cxEnrich(items, await cxLabelsGet(env));
    for (const c of en) {
      const d = cxEarlyDecide(c, now, acc); if (!d || d.muted) { if (d && d.muted) st.mutedN = (st.mutedN || 0) + 1; continue; }
      if (have.has(d.key)) continue; have.add(d.key);
      d.at = now; d.sym = d.syms[0];
      try { const p = await fetchPriceCached(d.sym); if (p && +p.price > 0) d.p0 = +p.price; } catch (e) {}
      d.text = cxEarlyText(d); fresh.push(d);
    }
  }
  // 2) ahead: a scheduled print inside 35 minutes, recorded once, at first sight
  const im = cxImpactOf('macro', 'primary', true);
  for (const u of upcoming) {
    const ts = +u.ts || 0; if (!(ts > now) || ts - now > 35 * 60000 || !(+u.impact >= 2)) continue;
    const key = 'a:' + ts + ':' + String(u.title || '').slice(0, 24).toLowerCase().replace(/[^a-z0-9]+/g, '-'); if (have.has(key)) continue; have.add(key);
    const d = { type: 'ahead', key, cell: 'macro|calendar|ahead', kind: 'macro', sym: 'BTC', syms: ['BTC'], ts, at: now, title: String(u.title || '').slice(0, 120), impact: +u.impact || 0, expect: 0, exp: im ? { x15: im.x15, x60: im.x60, n: im.n, hit: null } : null };
    d.text = cxEarlyText(d); fresh.push(d);
  }
  st.upcoming = upcoming.filter(u => +u.ts > now && +u.ts - now < 86400000).slice(0, 12).map(u => ({ ts: +u.ts, title: String(u.title || '').slice(0, 120), impact: +u.impact || 0, type: u.type || '' }));
  // 3) moving: the detector over the coins members hold (and the three majors), every other minute, at most 30 coins
  if (new Date(now).getUTCMinutes() % 2 === 1) {
    const syms = ['BTC', 'ETH', 'SOL']; for (const x of heldSyms || []) if (syms.indexOf(x) < 0 && assetClassOf(x) === 'crypto' && syms.length < 30) syms.push(x);
    const T0 = Date.now();
    const scan = async (sym) => {
      if (Date.now() - T0 > 20000) return;
      let bars = []; try { const kl = await aiKlinesAfter(env, sym, '5', now - 2 * 86400000, 1); bars = (kl && kl.bars) || []; } catch (e) {}
      if (bars.length < 100) return;
      const det = cxDetectMoves(bars); const m = det.moves && det.moves[0]; if (!m) return;
      if (now - m.t1 > 12 * 60000 || now - m.t0 > 90 * 60000) return;        // over, or old
      const key = 'm:' + sym + ':' + Math.floor(m.t0 / 900000); if (have.has(key)) return;
      // the same coin inside two hours only when the move at least doubled
      const prev = st.items.find(r => r.type === 'moving' && r.sym === sym && now - r.at < 2 * 3600000); if (prev && Math.abs(+m.pct) < 2 * Math.abs(+prev.pct)) return;
      let j = null; try { const r = await handleCatalystMoves(new URL('https://marginpad.io/api/catalysts/moves?symbol=' + sym + '&at=' + m.t0 + '&pct=' + m.pct + '&n=' + m.n), env); j = await r.json(); } catch (e) {}
      if (!j || !(j.sure || j.big)) return;
      have.add(key);
      const d = { type: 'moving', key, cell: 'moving|' + (j.cause || 'unknown'), sym, syms: [sym], t0: m.t0, t1: m.t1, at: now, pct: +m.pct, n: m.n, dir: m.dir, cause: j.cause, label: j.label, labelFull: j.labelFull, sure: !!j.sure, big: !!j.big, confidence: j.confidence, expect: m.dir, p0: m.p0, catalyst: j.catalyst ? { title: j.catalyst.title, source: j.catalyst.source, leadMin: j.catalyst.leadMin } : null, note: String(j.note || '').slice(0, 220) };
      d.text = cxEarlyText(d); fresh.push(d);
    };
    for (let i = 0; i < syms.length; i += 6) await Promise.all(syms.slice(i, i + 6).map(scan));
  }
  if (fresh.length || !st.at || now - st.at > 300000) {
    st.items = fresh.concat(st.items).filter(r => now - (+r.at || 0) < CX_EARLY_KEEP_MS).slice(0, CX_EARLY_MAX);
    st.at = now;
    await env.STATS.put('cx:early', JSON.stringify(st), { expirationTtl: 3 * 86400 }).catch(() => {});
  }
  return { fresh, items: items.length, ring: st.items.length };
}
// SETTLE (every tenth minute, in the same invocation as the tick so the ring has one writer): every record older than 65 minutes
// is read against 1-minute candles from its own moment; the outcome goes on the record and into the per-cell accuracy table.
async function cxEarlySettle(env, now) {
  const st = await cxEarlyRead(env); let acc = await cxEarlyAccRead(env); let n = 0;
  const todo = st.items.filter(r => !r.settled && now - (r.type === 'ahead' ? +r.ts : r.type === 'moving' ? +r.at : +r.seen) >= CX_EARLY_SETTLE_MS).slice(0, 12);
  if (!todo.length) return { settled: 0 };
  const baseOf = {};
  for (const r of todo) {
    const T = r.type === 'ahead' ? +r.ts : r.type === 'moving' ? +r.at : +r.seen, sym = r.sym || 'BTC';
    if (now - T > 14 * 3600000) { r.settled = { skip: 'too_old', at: now }; continue; }
    try {
      if (baseOf[sym] === undefined) { const k15 = await aiKlinesAfter(env, sym, '15', now - 5 * 86400000, 1); const rs = ((k15 && k15.bars) || []).map(b => Math.abs(+b.close / +b.open - 1)).filter(x => isFinite(x)); baseOf[sym] = cxMedian(rs); }
      const k1 = await aiKlinesAfter(env, sym, '1', T - 10 * 60000, 1);
      const out = cxEarlySettleOne(r, (k1 && k1.bars) || [], baseOf[sym]);
      r.settled = out || { skip: 'no_bars', at: now };
      if (out) { acc = cxEarlyAccAdd(acc, r); n++; }
    } catch (e) { r.settled = { skip: 'error', at: now }; }
  }
  st.at = now;
  await env.STATS.put('cx:early', JSON.stringify(st), { expirationTtl: 3 * 86400 }).catch(() => {});
  await env.STATS.put('cx:early:acc', JSON.stringify(acc)).catch(() => {});
  return { settled: n, of: todo.length };
}
// GET /api/catalysts/early?symbol=SOL&h=24 - what landed, what is ahead, what is moving, each with its outcome once settled, and the
// accuracy of every cell (keyless, edge 20 s). The chart draws it; the /catalysts/ page and the ops desk read the same object.
async function handleCatalystEarly(url, env) {
  const sym = String(url.searchParams.get('symbol') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const h = Math.max(1, Math.min(48, +url.searchParams.get('h') || 24)), nc = url.searchParams.get('nc') === '1';
  const J = (o, age) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=' + age, ...CORS } });
  const ck = new Request('https://marginpad.io/__cxearly_v1_' + sym + '_' + h);
  if (!nc) { try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {} }
  const now = Date.now(), st = await cxEarlyRead(env), acc = await cxEarlyAccRead(env);
  const items = st.items.filter(r => now - (+r.at || 0) < h * 3600000 && (!sym || r.type === 'ahead' || (r.syms || []).indexOf(sym) >= 0 || r.sym === sym)).slice(0, 80);
  const body = { ts: now, symbol: sym || null, hours: h, at: st.at || null, n: items.length, items, upcoming: st.upcoming || [], accuracy: cxEarlyAccPublic(acc), rules: { landed: 'an exchange listing or delisting from the exchange itself, or a major story (two desks, importance 70+), first report only', ahead: 'a scheduled macro print of impact 2+, recorded 35 minutes before it', moving: 'an abnormal move on a coin members hold, while it runs, with its cause', settled: 'one hour after, against 1-minute candles; big = 1.5x the usual hour', muted: 'a cell with 20+ settled records that moved price in under 30% of them and got the direction right in under 55%' } };
  const res = J(body, 20);
  if (!nc) { try { await caches.default.put(ck, res.clone()); } catch (e) {} }
  return res;
}
// THE ALERT (rewritten 2026-11-05): it sends what the early pass RECORDED - a landed catalyst on a coin the member holds, a scheduled
// print 30 minutes out when they hold anything, an abnormal move running on a coin they hold - to every Premium member with position
// alerts on, Telegram and push, one record per member (\`cxal:\`). \`cxalert:last\` is always stamped so a quiet minute reads as quiet.
async function checkCatalystAlerts(env) {
  try {
    if (!env || !env.STATS || !env.USERS) return;
    const stamp = (o) => { try { return env.STATS.put('cxalert:last', JSON.stringify(Object.assign({ ts: Date.now() }, o)), { expirationTtl: 3600 }); } catch (e) {} };
    const now = Date.now(), base = (env.COLLECTOR_URL || '').replace(/\\/$/, '');
    if (!base || now < COL_DOWN_UNTIL) { await stamp({ items: 0, early: 0, fired: 0, collector: 'down' }); return; }
    let watch = []; try { const r = await usersDO(env, '/posalertwatch', {}); watch = (r && r.watch) || []; } catch (e) {}
    const heldAll = new Set(); for (const w of watch) { (w.pos || []).forEach(p => heldAll.add(String(p.sym || '').toUpperCase())); (w.ord || []).forEach(o => heldAll.add(String(o.sym || '').toUpperCase())); }
    const tick = await cxEarlyTick(env, now, base, [...heldAll]);
    let settled = null; if (new Date(now).getUTCMinutes() % 10 === 5) { try { settled = await cxEarlySettle(env, now); } catch (e) {} }
    const fresh = (tick.fresh || []).filter(r => !r.muted);
    if (!fresh.length || !watch.length) { await stamp({ items: tick.items, early: fresh.length, ring: tick.ring, watched: watch.length, fired: 0, settled }); return; }
    const allow = new Set(PREM_FOUNDERS);
    try { ((await env.STATS.get('premium:allow')) || '').toLowerCase().split(/\\s+/).filter(Boolean).forEach(x => allow.add(x)); } catch (e) {}
    const fired = [];
    for (const w of watch) {
      if (w.cfg && w.cfg.cx === 0) continue;
      const held = new Set(); (w.pos || []).forEach(p => held.add(String(p.sym || '').toUpperCase())); (w.ord || []).forEach(o => held.add(String(o.sym || '').toUpperCase()));
      if (!held.size) continue;
      const hits = fresh.filter(r => r.type === 'ahead' ? [...held].some(x => assetClassOf(x) === 'crypto') : (r.syms || []).some(x => held.has(x)));
      if (!hits.length) continue;
      if (!(await premLiveRow(env, allow, w, now))) continue;
      for (const r of hits) {
        const sym = r.type === 'ahead' ? [...held].filter(x => assetClassOf(x) === 'crypto')[0] || 'BTC' : (r.syms || []).filter(x => held.has(x))[0];
        const kk = 'cxal:' + w.uid + ':' + r.key;
        try { if (await env.STATS.get(kk)) continue; await env.STATS.put(kk, '1', { expirationTtl: 12 * 3600 }); } catch (e) { continue; }
        const title = r.type === 'ahead' ? r.title + ' in ' + Math.max(1, Math.round((r.ts - now) / 60000)) + ' min' : r.type === 'moving' ? sym + ' ' + (r.pct > 0 ? '+' : '') + r.pct + '% right now' : sym + ': ' + (r.kind === 'listing' ? 'listing' : r.kind === 'delisting' ? 'delisting' : 'catalyst') + ' on ' + String(r.source || '').replace(/^(rss|tg|x):/, '').replace(/-ann$/, '');
        const body = (r.type === 'ahead' ? r.text + '. Mind your leverage - you hold ' + sym + '.' : r.type === 'moving' ? r.text + '. You hold ' + sym + '.' : r.text + ' You hold ' + sym + '.').slice(0, 300);
        fired.push({ uid: w.uid, sym, title, body, type: r.type });
        if (w.tg && env.TELEGRAM_TOKEN) { try { await tgApi(env.TELEGRAM_TOKEN, 'sendMessage', { chat_id: w.tg, parse_mode: 'HTML', disable_web_page_preview: true, text: '<b>' + title + '</b>\\n' + body + '\\n\\n<a href="https://marginpad.io/charts?sym=' + sym + '">' + sym + ' on the chart</a> · <a href="https://marginpad.io/catalysts/?sym=' + sym + '">What moved ' + sym + '</a>' }); } catch (e) {} }
      }
    }
    if (fired.length && env.VAPID_JWK) {
      try {
        const uids = [...new Set(fired.map(f => f.uid))];
        const r = await usersDO(env, '/push/byuid', { uids });
        const subs = (r && r.subs) || [];
        const byUid = {}; subs.forEach(s2 => { (byUid[s2.uid] = byUid[s2.uid] || []).push(s2); });
        for (const f of fired) { for (const s2 of (byUid[f.uid] || [])) { try { await sendWebPush(env, s2, { title: f.title, body: f.body, url: 'https://marginpad.io/charts?sym=' + f.sym + '&ref=push' }); } catch (e) {} } }
      } catch (e) {}
    }
    // the fired list is kept on the ring's records so the desk can say who was told (counts only, never names)
    if (fired.length) { try { const st = await cxEarlyRead(env); for (const r of st.items) { const k = fired.filter(f => f.type === r.type && (r.type === 'ahead' || (r.syms || []).indexOf(f.sym) >= 0)).length; if (k) r.fired = (r.fired || 0) + k; } st.at = now; await env.STATS.put('cx:early', JSON.stringify(st), { expirationTtl: 3 * 86400 }); } catch (e) {} }
    await stamp({ items: tick.items, early: fresh.length, ring: tick.ring, watched: watch.length, fired: fired.length, settled });
  } catch (e) {}
}
`;
s = s.slice(0, aStart) + ASYNC + s.slice(aEnd);

// ---- 3) the route ----
rep("    if (url.pathname === '/api/catalysts/top') return handleCatalystTop(url, env);", "    if (url.pathname === '/api/catalysts/early') return handleCatalystEarly(url, env);\n    if (url.pathname === '/api/catalysts/top') return handleCatalystTop(url, env);");

// ---- 4) labels every 50 s, not 110: the early pass needs the model's reading of a major story inside the minute it lands ----
rep("try { const at = +(await env.STATS.get('cx:lbl:at')) || 0; if (now - at < 110000) return; } catch (e) {}", "try { const at = +(await env.STATS.get('cx:lbl:at')) || 0; if (now - at < 50000) return; } catch (e) {}");

// ---- 5) the minute cron: labels, THEN the early pass and the alerts, in one sequence (a label that lands after the alert tick is a minute late) ----
rep("      ctx.waitUntil(cxLabelTick(env).catch(() => {})); // the catalysts' reader: one Haiku call over the newest unlabelled items, self-gated to every two minutes\n      ctx.waitUntil(checkCatalystAlerts(env).catch(() => {}));", "      ctx.waitUntil((async () => { try { await cxLabelTick(env); } catch (e) {} try { await checkCatalystAlerts(env); } catch (e) {} })()); // labels first (Haiku, self-gated 50 s), then the early pass + the alerts in the SAME sequence - the model's reading must be on the item the minute it lands\n      /* checkCatalystAlerts runs above, after the labels */");

// ---- 6) the desk reads the early ring beside the coverage sweep ----
rep("  return { ok: true, now: Date.now(), universe: uni, measured: tot.markets, oldest: isFinite(oldest) ? oldest : null, newest: newest || null, tot, cause, classes: Object.values(classes).sort((a, b) => b.markets - a.markets), worst: worst.slice(0, 60), noBars: thin.slice(0, 40), rows: map, eq };",
  "  let early = null; try { const st = await cxEarlyRead(env), acc = await cxEarlyAccRead(env), nowE = Date.now(); let last = null; try { last = JSON.parse(await env.STATS.get('cxalert:last') || 'null'); } catch (e) {} early = { at: st.at || null, last, upcoming: st.upcoming || [], items: st.items.slice(0, 60), n: st.items.length, fired: st.items.reduce((a, r) => a + (+r.fired || 0), 0), settled: st.items.filter(r => r.settled && r.settled.x60 != null).length, accuracy: cxEarlyAccPublic(acc), ageMin: st.at ? Math.round((nowE - st.at) / 60000) : null }; } catch (e) {}\n  return { ok: true, now: Date.now(), universe: uni, measured: tot.markets, oldest: isFinite(oldest) ? oldest : null, newest: newest || null, tot, cause, classes: Object.values(classes).sort((a, b) => b.markets - a.markets), worst: worst.slice(0, 60), noBars: thin.slice(0, 40), rows: map, eq, early };");

if (s.indexOf('function cxEarlyDecide') < 0 || s.indexOf('async function cxEarlyTick') < 0 || s.indexOf("'/api/catalysts/early'") < 0) throw new Error('wiring incomplete');
if (DRY) { console.log('DRY: would write ' + s.length + ' bytes'); process.exit(0); }
fs.writeFileSync(F + '.tmp', s); fs.renameSync(F + '.tmp', F);
console.log('fix-cx-early: written ' + s.length + ' bytes');
