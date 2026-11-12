// THE MARKET LISTS THEMSELVES, READ AS DIFFS (2026-11-12, owner: "da li za catalysts mozemo da poboljsamo izvor informacija koji je
// azuran? Ovo ce direktno uticati i na indikator what moved the price").
//
// Measured before this file existed (2026-11-05 study, 742 first reports): a LISTING from an exchange's own desk is the one kind of
// catalyst that predicts a move from the minute we see it (77% direction, 1.8x the usual hour); a media headline is a coin flip.
// And measured on 2026-11-12 from the droplet itself: of the 58 sources, the eight X accounts were dead (429, 0 items in two weeks),
// Upbit's notice API was dead (429), and the only first-hand listing diffs were Coinbase, Kraken, Gate and Hyperliquid's perps -
// Binance, Bybit, OKX, Upbit, Bithumb, MEXC and Bitget, the venues whose listings actually move a coin, were read through their
// ANNOUNCEMENT pages (minutes to hours before trading) or not at all.
//
// So this module reads each venue's own MARKET LIST and diffs it against the last read: a symbol that appears is a listing at the
// second trading is switched on (lateness zero by construction, the hl-meta pattern), a symbol that disappears for two reads in a
// row is a delisting. Payloads were sized from the droplet: Binance spot 17.8 MB through exchangeInfo but 200 KB through ticker/price,
// so the ticker lists are read where they exist. Upbit's trading API (api.upbit.com) answers 200 where its notice API 429s, and its
// market list carries the exchange's own warning flags - the Korean premium's listing AND its cautionary designations.
//
// Also here, the same shape: the status pages of Solana, Coinbase and Kraken (an outage is a catalyst and those feeds are the first to
// say so), and Google News as an aggregator for the mainstream desks we do not poll (Reuters, Bloomberg, CNBC, FT reach it in minutes).
// Every poller returns { nid, ts, title, url, snippet, meta }; index.js does the rest. A failed read throws and is counted in status.
'use strict';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
async function get(url, { json = false, timeout = 15000, headers = {}, method = 'GET', body = null } = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { method, body, headers: { 'user-agent': UA, accept: json ? 'application/json' : 'application/rss+xml, application/xml, text/xml, text/html;q=0.8', ...headers }, signal: ctl.signal });
    if (!r.ok) throw new Error('http ' + r.status);
    return json ? r.json() : r.text();
  } finally { clearTimeout(t); }
}
const dec = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
const SYM_OK = /^[A-Z0-9]{2,12}$/;
const MIN_LIST = 50;              // a venue list shorter than this is a failed page, never a mass delisting

// ---- the diff: one state per source, a listing on first sight, a delisting after two consecutive absences ----
const state = new Map();           // name -> { ids: Map(id -> meta), miss: Map(id -> n) }
function diff(name, cur, mk) {
  if (!(cur instanceof Map)) throw new Error('bad list');
  if (cur.size < MIN_LIST) throw new Error('short list (' + cur.size + ')');
  const now = Date.now(), prev = state.get(name), out = [];
  const next = { ids: new Map(cur), miss: new Map() };
  if (prev) {
    for (const [id, m] of cur) if (!prev.ids.has(id)) { const row = mk.list(id, m, now); if (row) out.push(row); }
    for (const [id, m] of prev.ids) {
      if (cur.has(id)) continue;
      const n = (prev.miss.get(id) || 0) + 1;
      if (n >= 2) { if (mk.delist) { const row = mk.delist(id, m, now); if (row) out.push(row); } }
      else { next.ids.set(id, m); next.miss.set(id, n); }   // carried one more read; a flaky page must not print a delisting
    }
  }
  state.set(name, next);
  return out;
}
const listRow = (venue, kind, sym, pair, url, now, extra) => ({ nid: venue.toLowerCase().replace(/\s+/g, '-') + ':' + kind + ':' + pair + ':' + now, ts: now, title: (kind === 'list' ? 'New listing: ' : 'Delisting of ') + sym + ' (' + sym + ') ' + pair + ' on ' + venue, url, snippet: '', meta: Object.assign({ sym, pair, venue, diff: 1 }, extra || {}) });

// Binance spot: every symbol that prints a price is trading. 200 KB against 17.8 MB for exchangeInfo.
export async function binanceSpot() {
  const list = await get('https://api.binance.com/api/v3/ticker/price', { json: true });
  const cur = new Map();
  for (const t of Array.isArray(list) ? list : []) { const s = String(t && t.symbol || ''); const m = s.match(/^([A-Z0-9]{2,12})(USDT|USDC|FDUSD|BTC|BNB|TRY|EUR)$/); if (m && m[2] === 'USDT') cur.set(s, { base: m[1] }); }
  return diff('binance-mk', cur, {
    list: (id, m, now) => listRow('Binance', 'list', m.base, m.base + '/USDT spot', 'https://www.binance.com/en/trade/' + m.base + '_USDT', now),
    delist: (id, m, now) => listRow('Binance', 'delist', m.base, m.base + '/USDT spot', 'https://www.binance.com/en/trade/' + m.base + '_USDT', now),
  });
}
// Binance USD-M futures: the perp list, ~1,000 rows of symbol + price
export async function binanceFut() {
  const list = await get('https://fapi.binance.com/fapi/v1/ticker/price', { json: true });
  const cur = new Map();
  for (const t of Array.isArray(list) ? list : []) { const s = String(t && t.symbol || ''); const m = s.match(/^(?:1000|1000000)?([A-Z0-9]{2,12})(USDT|USDC)$/); if (m && !/_\d{6}$/.test(s)) cur.set(s, { base: m[1] }); }
  return diff('binance-fut', cur, {
    list: (id, m, now) => listRow('Binance Futures', 'list', m.base, id + ' perpetual', 'https://www.binance.com/en/futures/' + id, now),
    delist: (id, m, now) => listRow('Binance Futures', 'delist', m.base, id + ' perpetual', 'https://www.binance.com/en/futures/' + id, now),
  });
}
// Bybit: linear perps and spot, status Trading only (a PreLaunch perp is the pre-market; it is listed when it turns Trading)
export async function bybitMarkets() {
  const out = [];
  for (const [cat, label] of [['linear', 'perpetual'], ['spot', 'spot']]) {
    const d = await get('https://api.bybit.com/v5/market/instruments-info?category=' + cat + '&limit=1000', { json: true });
    const cur = new Map();
    for (const i of (d && d.result && d.result.list) || []) {
      if (String(i.status || '') !== 'Trading') continue;
      const s = String(i.symbol || ''), base = String(i.baseCoin || '').replace(/^(1000|10000|1000000)/, '');
      if (!SYM_OK.test(base)) continue;
      if (cat === 'spot' && !/USDT$/.test(s)) continue;
      cur.set(s, { base });
    }
    out.push(...diff('bybit-mk:' + cat, cur, {
      list: (id, m, now) => listRow('Bybit', 'list', m.base, id + ' ' + label, 'https://www.bybit.com/trade/usdt/' + id, now),
      delist: (id, m, now) => listRow('Bybit', 'delist', m.base, id + ' ' + label, 'https://www.bybit.com/trade/usdt/' + id, now),
    }));
  }
  return out;
}
// OKX: swaps and USDT spot pairs, state live
export async function okxMarkets() {
  const out = [];
  for (const [type, label] of [['SWAP', 'perpetual'], ['SPOT', 'spot']]) {
    const d = await get('https://www.okx.com/api/v5/public/instruments?instType=' + type, { json: true, timeout: 20000 });
    const cur = new Map();
    for (const i of (d && d.data) || []) {
      if (String(i.state || '') !== 'live') continue;
      const id = String(i.instId || ''), base = String(i.baseCcy || (id.split('-')[0]) || '');
      if (type === 'SWAP' && !/-USDT-SWAP$/.test(id)) continue;
      if (type === 'SPOT' && !/-USDT$/.test(id)) continue;
      if (!SYM_OK.test(base)) continue;
      cur.set(id, { base });
    }
    out.push(...diff('okx-mk:' + type, cur, {
      list: (id, m, now) => listRow('OKX', 'list', m.base, id + ' ' + label, 'https://www.okx.com/trade-' + (type === 'SWAP' ? 'swap/' : 'spot/') + id.toLowerCase(), now),
      delist: (id, m, now) => listRow('OKX', 'delist', m.base, id + ' ' + label, 'https://www.okx.com/trade-' + (type === 'SWAP' ? 'swap/' : 'spot/') + id.toLowerCase(), now),
    }));
  }
  return out;
}
// Upbit: the trading API's market list answers where the notice API 429s. A KRW market appearing is THE Korean-premium listing;
// market_event carries Upbit's own warning / caution flags, which it designates hours before a delisting.
let upbitFlags = null;
export async function upbitMarkets() {
  const list = await get('https://api.upbit.com/v1/market/all?is_details=true', { json: true, headers: { accept: 'application/json' } });
  const cur = new Map(), flags = new Map();
  for (const m of Array.isArray(list) ? list : []) {
    const id = String(m && m.market || ''), mm = id.match(/^(KRW|BTC|USDT)-([A-Z0-9]{2,12})$/); if (!mm) continue;
    cur.set(id, { base: mm[2], quote: mm[1] });
    const ev = m.market_event || {}; const w = !!(ev.warning || m.market_warning === 'CAUTION'), c = ev.caution && typeof ev.caution === 'object' ? Object.keys(ev.caution).filter(k => ev.caution[k]) : [];
    if (w || c.length) flags.set(id, { warning: w, caution: c });
  }
  const out = diff('upbit-mk', cur, {
    list: (id, m, now) => ({ nid: 'upbit:list:' + id + ':' + now, ts: now, title: 'Upbit lists ' + m.base + ' (' + m.base + ') ' + id + ' spot on the ' + m.quote + ' market', url: 'https://upbit.com/exchange?code=CRIX.UPBIT.' + id, snippet: '', meta: { sym: m.base, pair: id, venue: 'Upbit', krw: m.quote === 'KRW', diff: 1 } }),
    delist: (id, m, now) => ({ nid: 'upbit:delist:' + id + ':' + now, ts: now, title: 'Upbit delisting of ' + m.base + ' (' + m.base + ') ' + id + ' on the ' + m.quote + ' market', url: 'https://upbit.com/exchange?code=CRIX.UPBIT.' + id, snippet: '', meta: { sym: m.base, pair: id, venue: 'Upbit', krw: m.quote === 'KRW', diff: 1 } }),
  });
  // a NEW warning designation (not one that was already there when this process started)
  if (upbitFlags) {
    const now = Date.now();
    for (const [id, f] of flags) {
      const was = upbitFlags.get(id); if (was && was.warning === f.warning && was.caution.join() === f.caution.join()) continue;
      const base = id.split('-')[1]; if (!base) continue;
      if (f.warning && !(was && was.warning)) out.push({ nid: 'upbit:warn:' + id + ':' + now, ts: now, title: 'Upbit designates ' + base + ' (' + base + ') ' + id + ' as an investment warning asset', url: 'https://upbit.com/exchange?code=CRIX.UPBIT.' + id, snippet: '', meta: { sym: base, pair: id, venue: 'Upbit', warning: 1 } });
      else if (f.caution.length && !(was && was.caution.length)) out.push({ nid: 'upbit:caution:' + id + ':' + now, ts: now, title: 'Upbit designates ' + base + ' (' + base + ') ' + id + ' as a trading caution asset (' + f.caution.join(', ').toLowerCase() + ')', url: 'https://upbit.com/exchange?code=CRIX.UPBIT.' + id, snippet: '', meta: { sym: base, pair: id, venue: 'Upbit', caution: f.caution } });
    }
  }
  upbitFlags = flags;
  return out;
}
// Bithumb: the second Korean venue, same API shape as Upbit's
export async function bithumbMarkets() {
  const list = await get('https://api.bithumb.com/v1/market/all?isDetails=true', { json: true, headers: { accept: 'application/json' } });
  const cur = new Map();
  for (const m of Array.isArray(list) ? list : []) { const id = String(m && m.market || ''), mm = id.match(/^(KRW|BTC)-([A-Z0-9]{2,12})$/); if (mm) cur.set(id, { base: mm[2], quote: mm[1] }); }
  return diff('bithumb-mk', cur, {
    list: (id, m, now) => ({ nid: 'bithumb:list:' + id + ':' + now, ts: now, title: 'Bithumb lists ' + m.base + ' (' + m.base + ') ' + id + ' spot on the ' + m.quote + ' market', url: 'https://www.bithumb.com/react/trade/order/' + m.base + '-' + m.quote, snippet: '', meta: { sym: m.base, pair: id, venue: 'Bithumb', krw: m.quote === 'KRW', diff: 1 } }),
    delist: (id, m, now) => ({ nid: 'bithumb:delist:' + id + ':' + now, ts: now, title: 'Bithumb delisting of ' + m.base + ' (' + m.base + ') ' + id + ' on the ' + m.quote + ' market', url: 'https://www.bithumb.com/react/trade/order/' + m.base + '-' + m.quote, snippet: '', meta: { sym: m.base, pair: id, venue: 'Bithumb', krw: m.quote === 'KRW', diff: 1 } }),
  });
}
// Hyperliquid SPOT (the perp list is hl-meta in sources.js): canonical pairs only, named like PURR/USDC
export async function hlSpot() {
  const d = await get('https://api.hyperliquid.xyz/info', { json: true, method: 'POST', body: JSON.stringify({ type: 'spotMeta' }), headers: { 'content-type': 'application/json' } });
  const cur = new Map(), toks = (d && d.tokens) || [];
  // a spot pair is named '@<n>' with its two token indexes; only PURR/USDC carries a readable name. The base is tokens[i].name.
  for (const u of (d && d.universe) || []) {
    const ti = Array.isArray(u && u.tokens) ? u.tokens : []; const base = toks[ti[0]] && String(toks[ti[0]].name || ''), quote = toks[ti[1]] && String(toks[ti[1]].name || '');
    if (!base || quote !== 'USDC' || !SYM_OK.test(base)) continue;
    cur.set(base + '/USDC', { base });
  }
  return diff('hl-spot', cur, {
    list: (id, m, now) => listRow('Hyperliquid', 'list', m.base, id + ' spot', 'https://app.hyperliquid.xyz/trade/' + m.base, now),
  });
}
// MEXC futures: the venue that lists first and most; 2.3 MB every two minutes
export async function mexcFut() {
  const d = await get('https://contract.mexc.com/api/v1/contract/detail', { json: true, timeout: 20000 });
  const cur = new Map();
  for (const c of (d && d.data) || []) { if (+c.state !== 0) continue; const s = String(c.symbol || ''), base = String(c.baseCoin || s.split('_')[0] || ''); if (!/_USDT$/.test(s) || !SYM_OK.test(base)) continue; cur.set(s, { base }); }
  return diff('mexc-fut', cur, {
    list: (id, m, now) => listRow('MEXC Futures', 'list', m.base, id + ' perpetual', 'https://futures.mexc.com/exchange/' + id, now),
    delist: (id, m, now) => listRow('MEXC Futures', 'delist', m.base, id + ' perpetual', 'https://futures.mexc.com/exchange/' + id, now),
  });
}
// Bitget USDT-M futures
export async function bitgetFut() {
  const d = await get('https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES', { json: true, timeout: 20000 });
  const cur = new Map();
  for (const c of (d && d.data) || []) { if (String(c.symbolStatus || '') !== 'normal') continue; const s = String(c.symbol || ''), base = String(c.baseCoin || '').replace(/^(1000|10000|1000000)/, ''); if (!SYM_OK.test(base)) continue; cur.set(s, { base }); }
  return diff('bitget-fut', cur, {
    list: (id, m, now) => listRow('Bitget Futures', 'list', m.base, id + ' perpetual', 'https://www.bitget.com/futures/usdt/' + id, now),
    delist: (id, m, now) => listRow('Bitget Futures', 'delist', m.base, id + ' perpetual', 'https://www.bitget.com/futures/usdt/' + id, now),
  });
}

// ---- status pages (Atlassian Statuspage RSS): an incident is a catalyst, scheduled maintenance is not ----
export const STATUS = [['solana', 'https://status.solana.com/history.rss', 'Solana', 'SOL'], ['coinbase', 'https://status.coinbase.com/history.rss', 'Coinbase', ''], ['kraken', 'https://status.kraken.com/history.rss', 'Kraken', '']];
export async function statusFeed(name, url, label, sym) {
  const xml = await get(url);
  const out = [];
  for (const b of xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []) {
    const title = dec((b.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]); if (!title) continue;
    if (/maintenance|scheduled|planned|upgrade window/i.test(title)) continue;
    // an exchange's status page is mostly plumbing (delayed sends on one network, a banking partner, a payments product); only the
    // incidents that stop TRADING are catalysts. A chain's page (Solana) is kept whole - any incident there is the asset itself.
    if (!sym && !/(trading|platform|exchange|website|app|api|login|order|market)s?\b[^.]*\b(unavailable|outage|degraded|down|halted|paused|issues?)|major outage|partial outage|degraded performance|site (is )?down/i.test(title)) continue;
    if (!sym && /\b(deposit|withdraw|send|payment|banking|fiat|card|staking|reward)/i.test(title)) continue;
    const link = dec((b.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]), when = dec((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1]);
    const ts = Date.parse(when); if (!(ts > 0)) continue;
    const desc = dec((b.match(/<description>([\s\S]*?)<\/description>/i) || [])[1]);
    const t = label + ' status: ' + title + (sym && title.indexOf('(' + sym + ')') < 0 ? ' (' + sym + ')' : '');
    out.push({ nid: link || title, ts, title: t, url: link, snippet: desc.slice(0, 170), meta: { status: name, sym: sym || '' } });
  }
  return out;
}

// ---- Google News: the mainstream desks in one aggregator, newest hour, the desk kept in meta ----
// the macro query is kept to the prints and the institutions by NAME - a bare "Powell" or "tariffs" pulled college sports and a
// Nvidia affair on the first probe (2026-11-12); the title filter below is the second gate, because Google ORs loosely
export const GNEWS = [['crypto', 'bitcoin OR ethereum OR crypto OR stablecoin OR "digital asset" when:1h'], ['macro', '"Federal Reserve" OR FOMC OR "rate cut" OR "rate hike" OR "CPI report" OR "jobs report" OR "nonfarm payrolls" OR "Treasury yields" when:1h']];
const GN_KEEP = { crypto: /\b(bitcoin|btc|ethereum|ether|eth|crypto|stablecoin|digital asset|token|blockchain|defi|exchange|coinbase|binance|solana|xrp|ripple|dogecoin|etf)\b/i, macro: /\b(fed|federal reserve|fomc|rate (cut|hike|decision)|inflation|cpi|ppi|payrolls|jobs report|unemployment|treasur(y|ies)|yields?|gdp|recession|tariff)\b/i };
export async function gnews(name, q) {
  const xml = await get('https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-US&gl=US&ceid=US:en');
  const out = [], keep = GN_KEEP[name];
  for (const b of xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []) {
    let title = dec((b.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]); if (!title) continue;
    if (keep && !keep.test(title)) continue;
    const desk = dec((b.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1]);
    if (desk && title.endsWith(' - ' + desk)) title = title.slice(0, -(' - ' + desk).length);
    const link = dec((b.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]) || dec((b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1]);
    const ts = Date.parse(dec((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1])); if (!(ts > 0)) continue;
    out.push({ nid: link || title, ts, title: title.slice(0, 300), url: link, snippet: '', meta: { desk: desk.slice(0, 40), q: name } });
  }
  return out;
}
export const _test = { diff, state };
