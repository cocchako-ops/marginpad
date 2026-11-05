// MORE FIRST-HAND SOURCES (2026-11-05, owner: "najbolji moguci free izvor informacija"). Measured first (scratchpad/cx-seen-study.js):
// the kinds that predict a move from the moment WE see them are an exchange's own listing/delisting and a scheduled print - so the
// sources worth adding are the exchanges' own feeds, read first-hand, and the things that mark a listing the second it is live.
// Probed from the droplet on 2026-11-05 (every one 200): Bitget announcements, KuCoin announcements (they state the trading time),
// Coinbase products, Kraken assets, Gate currency pairs, the Federal Reserve press RSS, CoinMarketCap's news aggregator (eight desks we
// do not poll ourselves), and Tokenearly's public listings relay (CC BY 4.0), kept ONLY for the exchanges we cannot reach: MEXC and
// Bithumb answer 403 to every datacentre, HTX's endpoint is gone. A relay row never joins a cluster as a second desk for an exchange
// we read ourselves - that would be one announcement counted twice. Every poller returns { nid, ts, title, url, snippet, meta }.
'use strict';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
async function get(url, { json = false, timeout = 12000, headers = {} } = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try { const r = await fetch(url, { headers: { 'user-agent': UA, accept: json ? 'application/json' : 'application/rss+xml, application/xml, text/xml, text/html;q=0.8', ...headers }, signal: ctl.signal }); if (!r.ok) throw new Error('http ' + r.status); return json ? r.json() : r.text(); }
  finally { clearTimeout(t); }
}
const dec = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();

// Bitget: coin_listings + product_updates (their delistings and contract changes live under product_updates); cTime is ms
export async function bitgetAnn() {
  const out = [];
  for (const type of ['coin_listings', 'product_updates']) {
    const d = await get('https://api.bitget.com/api/v2/public/annoucements?annType=' + type + '&language=en_US', { json: true });
    for (const a of (d && d.data) || []) { const ts = +a.cTime; if (!(ts > 0)) continue; out.push({ nid: 'bitget:' + (a.annId || a.annUrl), ts, title: String(a.annTitle || ''), url: a.annUrl || '', snippet: '', meta: { type, sub: a.annSubType || '' } }); }
  }
  return out;
}
// KuCoin: new-listings and delistings; annDesc carries the trading time ("Trading: 14:00 on November 4, 2026 (UTC)")
export async function kucoinAnn() {
  const out = [];
  for (const type of ['new-listings', 'delistings']) {
    const d = await get('https://api.kucoin.com/api/v3/announcements?annType=' + type + '&lang=en_US&pageSize=20', { json: true });
    for (const a of (d && d.data && d.data.items) || []) { const ts = +a.cTime; if (!(ts > 0)) continue; out.push({ nid: 'kucoin:' + (a.annId || a.annUrl), ts, title: String(a.annTitle || ''), url: a.annUrl || '', snippet: String(a.annDesc || '').slice(0, 170), meta: { type } }); }
  }
  return out;
}
// A LISTING IS THE MOMENT TRADING IS ON (the hl-meta pattern): Coinbase products, Kraken assets and Gate pairs are read whole and
// diffed against the last read; the first read only seeds. A product going to 'delisted' is a delisting. ts = our clock, which is
// exactly when the market changed - these are the only rows whose lateness is zero by construction.
let cbSeen = null;
export async function coinbaseProducts() {
  const list = await get('https://api.exchange.coinbase.com/products', { json: true });
  if (!Array.isArray(list) || list.length < 100) throw new Error('short list');
  const cur = new Map(); for (const p of list) if (p && p.id) cur.set(String(p.id), String(p.status || ''));
  const out = []; const now = Date.now();
  if (cbSeen) {
    for (const [id, st] of cur) {
      const base = id.split('-')[0];
      if (!cbSeen.has(id) && st === 'online') out.push({ nid: 'cb:list:' + id + ':' + now, ts: now, title: `New listing: ${base} (${base}) ${id} spot on Coinbase`, url: 'https://www.coinbase.com/advanced-trade/spot/' + id, snippet: '', meta: { sym: base, pair: id } });
      else if (cbSeen.has(id) && cbSeen.get(id) !== 'delisted' && st === 'delisted') out.push({ nid: 'cb:delist:' + id + ':' + now, ts: now, title: `Delisting of ${base} (${base}) ${id} on Coinbase`, url: 'https://www.coinbase.com/advanced-trade/spot/' + id, snippet: '', meta: { sym: base, pair: id } });
    }
  }
  cbSeen = cur; return out;
}
let krSeen = null;
export async function krakenAssets() {
  const d = await get('https://api.kraken.com/0/public/Assets', { json: true });
  const res = d && d.result; if (!res || Object.keys(res).length < 100) throw new Error('short list');
  const cur = new Set(); for (const k in res) { const a = res[k]; if (a && a.status === 'enabled') cur.add(String(a.altname || k)); }
  const out = []; const now = Date.now();
  if (krSeen) for (const s of cur) if (!krSeen.has(s) && /^[A-Z0-9]{2,10}$/.test(s)) out.push({ nid: 'kr:list:' + s + ':' + now, ts: now, title: `New listing: ${s} (${s}) on Kraken`, url: 'https://pro.kraken.com/app/trade/' + s.toLowerCase() + '-usd', snippet: '', meta: { sym: s } });
  krSeen = cur; return out;
}
let gtSeen = null;
export async function gatePairs() {
  const list = await get('https://api.gateio.ws/api/v4/spot/currency_pairs', { json: true, timeout: 20000 });
  if (!Array.isArray(list) || list.length < 500) throw new Error('short list');
  const cur = new Set(); for (const p of list) if (p && p.id && p.trade_status === 'tradable') cur.add(String(p.id));
  const out = []; const now = Date.now();
  if (gtSeen) for (const id of cur) { if (gtSeen.has(id)) continue; const base = id.split('_')[0]; if (!/_USDT$/.test(id) || !/^[A-Z0-9]{2,10}$/.test(base)) continue; out.push({ nid: 'gate:list:' + id + ':' + now, ts: now, title: `New listing: ${base} (${base}) ${id.replace('_', '/')} spot on Gate`, url: 'https://www.gate.com/trade/' + id, snippet: '', meta: { sym: base, pair: id } }); }
  gtSeen = cur; return out;
}
// the Federal Reserve's own press feed: the FOMC statement lands here the second it is released; only the monetary items are taken
export async function fedPress() {
  const xml = await get('https://www.federalreserve.gov/feeds/press_all.xml');
  const out = [];
  for (const b of xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []) {
    const title = dec((b.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]); if (!title) continue;
    if (!/FOMC|Federal Open Market|monetary policy|interest rate|discount rate|balance sheet|Chair Powell|statement on longer-run/i.test(title)) continue;
    const url = dec((b.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]), when = dec((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1]);
    const ts = Date.parse(when); if (!(ts > 0)) continue;
    out.push({ nid: url || title, ts, title, url, snippet: dec((b.match(/<description>([\s\S]*?)<\/description>/i) || [])[1]).slice(0, 170), meta: { fed: 1 } });
  }
  return out;
}
// CoinMarketCap's news aggregator: a JSON of the newest items across desks we do not poll ourselves (CoinTurk, The Crypto Basic,
// CryptoNews and others); each row names its desk in meta so a story counts the desks it really reached
export async function cmcNews() {
  const d = await get('https://api.coinmarketcap.com/content/v3/news?size=30', { json: true });
  const out = [];
  for (const it of (d && d.data) || []) {
    const m = it && it.meta; if (!m || !m.title) continue;
    const ts = Date.parse(m.releasedAt || it.createdAt || ''); if (!(ts > 0)) continue;
    out.push({ nid: m.sourceUrl || it.id || m.title, ts, title: String(m.title || '').slice(0, 300), url: m.sourceUrl || '', snippet: String(m.subtitle || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').slice(0, 170), meta: { desk: String(m.sourceName || '').slice(0, 40) } });
  }
  return out;
}
// Tokenearly's public relay (CC BY 4.0, attribution kept in meta): only the exchanges no datacentre can read directly
const TE_KEEP = { mexc: 'MEXC', bithumb: 'Bithumb', huobi: 'HTX', htx: 'HTX', lbank: 'LBank', bitmart: 'BitMart', coinone: 'Coinone', korbit: 'Korbit' };
export async function tokenearly() {
  const d = await get('https://tokenearly.com/api/public/listings.json', { json: true });
  const out = [];
  for (const it of (d && d.items) || []) {
    const ex = TE_KEEP[String(it.exchange || '').toLowerCase()]; if (!ex) continue;
    const ts = Date.parse(it.published_at || ''); if (!(ts > 0)) continue;
    let title = String((it.title && (it.title.en || it.title.zh || it.title.ko)) || '').slice(0, 240); if (!title) continue;
    const syms = (Array.isArray(it.symbols) ? it.symbols : []).map(s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(s => s.length >= 2 && s.length <= 10).slice(0, 4);
    for (const s of syms) if (title.indexOf('(' + s + ')') < 0) title += ' (' + s + ')';
    if (!new RegExp('\\b' + ex + '\\b', 'i').test(title)) title = ex + ': ' + title;
    out.push({ nid: 'te:' + (it.source_url || it.permalink || title), ts, title, url: it.source_url || it.permalink || '', snippet: '', meta: { exchange: ex, type: it.type || '', syms, via: 'Tokenearly (CC BY 4.0)' } });
  }
  return out;
}
