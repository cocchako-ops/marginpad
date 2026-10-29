// Catalyst Engine - phase 1 on the collector (2026-10-29). Polls every source on its own cadence, dedupes, classifies
// with the rules, counts confirmations, scores, stores (SQLite `catalyst`, 30 days) and keeps a 48-hour ring in
// memory for the API. The worker only ever reads the ring through /api/v1/catalysts; it never sees a source.
// Everything is OPTIONAL to the rest of the collector: a source that is down marks itself in status and nothing else.
'use strict';
import { createHash } from 'node:crypto';
import { log } from '../logger.js';
import * as S from './sources.js';
import { classify, scoreOf, setSymbols, symbolsKnown, tokens, jaccard, SAME_STORY, stripEmoji } from './rules.js';

const RING_MS = 48 * 3600000, CONF_MS = 6 * 3600000, KEEP_DAYS = 30, LATE_MAX_MS = 2 * 3600000;
const ring = [];                 // newest first
const seen = new Map();          // id -> ts_seen (dedup, 48 h)
const clusters = [];             // { key, tok:Set, srcs:Set, ids:[], ts } - newest first, 6 h
const status = { started: Date.now(), sources: {}, ring: 0, stored: 0, errors: 0, symbols: 0, warm: false };
let store = null, timers = [], upcoming = [];
// the same story from another desk joins the first desk's cluster; a new story opens one
function clusterFor(title, ts) {
  const tok = tokens(title);
  for (const c of clusters) { if (ts - c.ts > CONF_MS) break; if (jaccard(tok, c.tok) >= SAME_STORY) return c; }
  const c = { key: [...tok].sort().slice(0, 8).join(' '), tok, srcs: new Set(), ids: [], ts };
  clusters.unshift(c); return c;
}

const sha = s => createHash('sha1').update(String(s)).digest('hex').slice(0, 20);
const normUrl = u => String(u || '').trim().replace(/^http:/, 'https:').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();

function ingest(items, source, tier) {
  const now = Date.now(); let added = 0, late = [];
  for (const it of items) {
    if (!it || !it.title || !(it.ts > 0)) continue;
    if (it.ts > now + 60000 && source !== 'calendar') continue;             // a future-dated article is a feed bug
    if (now - it.ts > 3 * 86400000 && source !== 'calendar') continue;       // a backfilled old row is not an event
    const id = sha(source + '|' + (normUrl(it.url) || it.nid || it.title));
    if (seen.has(id)) continue;
    const title = stripEmoji(it.title).slice(0, 300); if (!title) continue;
    const c = classify(title, source);
    const cl = clusterFor(title, it.ts);
    cl.srcs.add(source.split(':')[0] === 'rss' ? source : source.split(':')[0]); cl.ids.push(id);
    const conf = cl.srcs.size;
    const row = { id, ts_src: it.ts, ts_seen: now, source, tier, kind: c.kind, expect: c.expect, syms: c.syms.join(','), market: c.market, score: scoreOf({ tier, kind: c.kind, conf, market: c.market, syms: c.syms }), conf, cluster: cl.key, title, url: it.url || '', snippet: stripEmoji(it.snippet || '').slice(0, 170), meta: it.meta ? JSON.stringify(it.meta).slice(0, 800) : null };
    seen.set(id, now); ring.unshift(row); added++;
    // lateness = our clock minus the source's, only for items that are genuinely fresh (the first pass drains a backlog)
    if (status.warm && source !== 'calendar' && now - it.ts < LATE_MAX_MS) late.push(now - it.ts);
    // a confirmation lifts the earlier rows of the same cluster too
    if (conf > 1) for (const r of ring) if (cl.ids.includes(r.id) && r.conf < conf) { r.conf = conf; r.score = scoreOf({ tier: r.tier, kind: r.kind, conf, market: r.market, syms: r.syms ? r.syms.split(',') : [] }); }
    if (store) { try { store.insertCatalyst(row); status.stored++; } catch (e) { status.errors++; } }
  }
  late.sort((a, b) => a - b);
  const st = status.sources[source] = status.sources[source] || { ok: 0, err: 0, added: 0 };
  st.ok++; st.added += added; st.last = now; if (late.length) { st.lateP50 = late[Math.floor(late.length / 2)]; st.lateMin = late[0]; }
  return added;
}
function trim() {
  const cut = Date.now() - RING_MS;
  while (ring.length && ring[ring.length - 1].ts_seen < cut) ring.pop();
  for (const [k, v] of seen) if (v < cut) seen.delete(k);
  while (clusters.length && Date.now() - clusters[clusters.length - 1].ts > CONF_MS) clusters.pop();
  status.ring = ring.length; status.clusters = clusters.length;
}
async function run(name, fn, tier) {
  try { ingest(await fn(), name, tier); }
  catch (e) { const st = status.sources[name] = status.sources[name] || { ok: 0, err: 0, added: 0 }; st.err++; st.lastErr = String(e && e.message || e).slice(0, 80); }
}
function every(ms, fn) { const t = setInterval(fn, ms); t.unref?.(); timers.push(t); }

export function startCatalyst(storage) {
  store = storage && typeof storage.insertCatalyst === 'function' ? storage : null;
  // symbol universe first, then the sources on their own clocks (staggered so no source bursts at :00)
  const syms = async () => { try { const l = await S.bybitSymbols(); setSymbols(l); status.symbols = symbolsKnown(); } catch (e) { status.symErr = String(e.message || e).slice(0, 60); } };
  const layer0 = async () => { await run('bybit-ann', S.bybitAnn, 'primary'); await run('okx-ann', S.okxAnn, 'primary'); await run('hl-meta', S.hlMeta, 'primary'); };
  const gov = async () => { await run('sec', S.sec, 'primary'); };
  const govSlow = async () => { await run('fedreg', S.fedreg, 'primary'); await run('cftc', S.cftc, 'primary'); };
  const media = async () => { for (const [name, url, tier] of S.RSS) { await run('rss:' + name, () => S.rss(name, url), tier); await new Promise(r => setTimeout(r, 400)); } };
  const tgs = async () => { for (const [ch, tier] of S.TG) { await run('tg:' + ch, () => S.tg(ch), tier); await new Promise(r => setTimeout(r, 500)); } };
  const red = async () => { await run('reddit:CryptoCurrency', () => S.reddit('CryptoCurrency'), 'social'); };
  const cal = async () => {
    try { const ev = await S.calendar(); const now = Date.now(); upcoming = ev.filter(e => e.ts > now && e.ts < now + 48 * 3600000).map(e => ({ ts: e.ts, title: e.title, type: e.meta && e.meta.type, impact: e.meta && e.meta.impact })); ingest(ev.filter(e => e.ts <= now && now - e.ts < 15 * 60000), 'calendar', 'primary'); status.sources.calendar = { ...(status.sources.calendar || {}), upcoming: upcoming.length, last: now }; }
    catch (e) { status.sources.calendar = { ...(status.sources.calendar || {}), lastErr: String(e.message || e).slice(0, 80) }; }
  };
  (async () => { await syms(); await layer0(); await gov(); await cal(); await media(); await tgs(); await govSlow(); await red(); trim(); status.warm = true; log.info('[catalyst] first pass', { ring: ring.length, symbols: status.symbols, clusters: clusters.length }); })().catch(e => { status.warm = true; log.warn('[catalyst] first pass failed', { e: String(e.message || e) }); });
  every(3600e3, syms);
  every(20e3, layer0);
  every(60e3, gov);
  every(600e3, govSlow);
  every(45e3, media);
  every(90e3, tgs);
  every(300e3, red);
  every(300e3, cal);
  every(60e3, () => { cal(); });            // the minute a scheduled event lands it becomes a catalyst (15-min window)
  every(120e3, trim);
  every(3600e3, () => { if (store) try { store.pruneCatalyst(KEEP_DAYS); } catch (e) {} });
  log.info('[catalyst] started');
}
export function stopCatalyst() { timers.forEach(t => clearInterval(t)); timers = []; }

// the API's read: filters over the ring, never the database
export function getCatalysts({ sym = '', since = 0, min = 0, kind = '', limit = 100 } = {}) {
  const S_ = String(sym || '').toUpperCase();
  const out = [];
  for (const r of ring) {
    if (since && r.ts_src < since) continue;
    if (min && r.score < min) continue;
    if (kind && r.kind !== kind) continue;
    if (S_ && !(',' + r.syms + ',').includes(',' + S_ + ',')) continue;
    out.push(r); if (out.length >= limit) break;
  }
  return { ts: Date.now(), n: out.length, ring: ring.length, items: out, upcoming: upcoming.slice(0, 20) };
}
export function catalystStatus() { return { ...status, ring: ring.length, upcoming: upcoming.length, uptimeSec: Math.round((Date.now() - status.started) / 1000) }; }
export const _test = { ingest, ring, seen, clusters };
