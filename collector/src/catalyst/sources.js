// Catalyst Engine - the sources (2026-10-29). Every poller returns raw items { nid, ts, title, url, snippet, meta }
// (ts = the SOURCE's own time in ms, never ours) and index.js does the rest. A poller that fails returns [] and
// says so in `status`; nothing here throws into the scheduler. All of layer 0 and 1 is free and keyless.
'use strict';
import { log } from '../logger.js';

const UA = 'Mozilla/5.0 (compatible; MarginPadBot/1.0; +https://marginpad.io/catalysts)';
async function get(url, { json = false, timeout = 12000, headers = {} } = {}) {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: json ? 'application/json' : 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8', ...headers }, signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error('http ' + r.status);
  return json ? r.json() : r.text();
}
const dec = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
const pick = (block, tag) => { const m = block.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'i')); return m ? m[1] : ''; };
const attr = (block, tag, name) => { const m = block.match(new RegExp('<' + tag + '[^>]*\\s' + name + '="([^"]+)"', 'i')); return m ? m[1] : ''; };

// ---- generic RSS / Atom ----
export function parseFeed(xml) {
  const out = [];
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of items) {
    const title = dec(pick(b, 'title')); if (!title) continue;
    let url = dec(pick(b, 'link')) || attr(b, 'link', 'href') || dec(pick(b, 'guid')) || dec(pick(b, 'id'));
    const when = pick(b, 'pubDate') || pick(b, 'published') || pick(b, 'updated') || pick(b, 'dc:date');
    const ts = Date.parse(dec(when)); if (!(ts > 0)) continue;
    const snippet = dec(pick(b, 'description') || pick(b, 'summary') || pick(b, 'content')).slice(0, 170);
    out.push({ nid: url || title, ts, title, url, snippet });
  }
  return out;
}

// Layer 1 - media RSS. Tier A = primary crypto desks with their own reporters; B = aggregators and smaller desks.
export const RSS = [
  ['coindesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/', 'mediaA'],
  ['theblock', 'https://www.theblock.co/rss.xml', 'mediaA'],
  ['blockworks', 'https://blockworks.co/feed', 'mediaA'],
  ['dlnews', 'https://www.dlnews.com/arc/outboundfeeds/rss/', 'mediaA'],
  ['decrypt', 'https://decrypt.co/feed', 'mediaA'],
  ['cointelegraph', 'https://cointelegraph.com/rss', 'mediaA'],
  ['bitcoinmagazine', 'https://bitcoinmagazine.com/.rss/full/', 'mediaA'],
  ['unchained', 'https://unchainedcrypto.com/feed/', 'mediaA'],
  ['defiant', 'https://thedefiant.io/feed', 'mediaA'],
  ['protos', 'https://protos.com/feed/', 'mediaA'],
  ['cryptoslate', 'https://cryptoslate.com/feed/', 'mediaB'],
  ['beincrypto', 'https://beincrypto.com/feed/', 'mediaB'],
  ['newsbtc', 'https://www.newsbtc.com/feed/', 'mediaB'],
  ['cryptopotato', 'https://cryptopotato.com/feed/', 'mediaB'],
  ['ambcrypto', 'https://ambcrypto.com/feed/', 'mediaB'],
  ['utoday', 'https://u.today/rss', 'mediaB'],
  ['cryptonews', 'https://cryptonews.com/news/feed/', 'mediaB'],
  ['benzinga', 'https://www.benzinga.com/feed', 'mediaB'],
  ['investing', 'https://www.investing.com/rss/news_301.rss', 'mediaB'],
  ['kraken-blog', 'https://blog.kraken.com/feed', 'official'],
  ['tradingview', 'https://www.tradingview.com/feed/', 'mediaB'],
];
export async function rss(name, url) { return parseFeed(await get(url)); }

// Layer 0 - exchange announcements, straight from the exchange, with their own timestamps
export async function bybitAnn() {
  const out = [];
  for (const type of ['new_crypto', 'delistings', 'latest_bybit_news']) out.push(...await bybitAnnPage(type, 1, 30));
  return out;
}
// one page of one Bybit announcement type - the live poll reads page 1, the backfill walks pages back
export async function bybitAnnPage(type, page, limit) {
  const d = await get(`https://api.bybit.com/v5/announcements/index?locale=en-US&type=${type}&limit=${limit || 30}&page=${page || 1}`, { json: true });
  const out = [];
  for (const a of (d && d.result && d.result.list) || []) out.push({ nid: 'bybit:' + (a.id || a.url || a.title), ts: +a.dateTimestamp, title: a.title, url: a.url || '', snippet: dec(a.description || '').slice(0, 170), meta: { type, tags: a.tags } });
  return out;
}
export async function okxAnn() {
  const out = [];
  // OKX answers `latest-events` 400 ("Parameter annType error") from the droplet's region while the same call is 200
  // from Serbia (measured 2026-10-29) - the set of types is regional. One refused type must not sink the other three,
  // so each is its own try; the whole source throws only when every type failed.
  let okN = 0, lastErr = null;
  for (const annType of ['announcements-new-listings', 'announcements-delistings', 'latest-events', 'announcements-trading-updates']) {
    try { out.push(...(await okxAnnPage(annType, 1)).rows); okN++; } catch (e) { lastErr = e; }
  }
  if (!okN && lastErr) throw lastErr;
  return out;
}
// one page of one OKX announcement type; `pages` is the total the API reports, for the backfill's walk
export async function okxAnnPage(annType, page) {
  const d = await get(`https://www.okx.com/api/v5/support/announcements?annType=${annType}&page=${page || 1}`, { json: true });
  const dd = d && d.data && d.data[0], rows = [];
  for (const a of (dd && dd.details) || []) rows.push({ nid: 'okx:' + (a.url || a.title), ts: +a.pTime, title: a.title, url: a.url || '', snippet: '', meta: { type: annType } });
  return { rows, pages: +(dd && dd.totalPage) || 1 };
}
// Hyperliquid has no announcements API: the LISTING is the perp appearing in `meta`. Diffed against the last call.
let hlSeen = null;
export async function hlMeta() {
  const r = await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA }, body: JSON.stringify({ type: 'meta' }), signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('http ' + r.status);
  const d = await r.json(); const names = new Map(); for (const u of (d.universe || [])) names.set(u.name, !!u.isDelisted);
  const out = [];
  if (hlSeen) {
    const now = Date.now();
    for (const [n, del] of names) {
      if (!hlSeen.has(n)) out.push({ nid: 'hl:list:' + n + ':' + now, ts: now, title: `New listing: ${n}USD perpetual on Hyperliquid`, url: 'https://app.hyperliquid.xyz/trade/' + n, snippet: '', meta: { sym: n } });
      else if (del && !hlSeen.get(n)) out.push({ nid: 'hl:delist:' + n + ':' + now, ts: now, title: `Delisting of ${n}USD perpetual on Hyperliquid`, url: 'https://app.hyperliquid.xyz/trade/' + n, snippet: '', meta: { sym: n } });
    }
  }
  hlSeen = names; return out;
}
// SEC EDGAR: the live "current filings" atom (updated within a minute of acceptance), filtered to the companies a
// crypto trader cares about. Company names are EDGAR's own spellings. Forms: 8-K (events), S-1/S-3 (offerings),
// 10-Q/10-K (results), 13F-HR (holdings), N-1A/485 (fund prospectus), 424B (pricing).
export const EDGAR_WATCH = /COINBASE|STRATEGY INC|MICROSTRATEGY|BLACKROCK|ISHARES|GRAYSCALE|FIDELITY|ARK 21SHARES|21SHARES|BITWISE|VANECK|VAN ECK|CIRCLE INTERNET|GALAXY DIGITAL|ROBINHOOD|MARATHON DIGITAL|MARA HOLDINGS|RIOT PLATFORMS|CLEANSPARK|CORE SCIENTIFIC|HUT 8|BULLISH|GEMINI SPACE|KRAKEN|PAYWARD|TETHER|RIPPLE|BITCOIN DEPOT|SEMLER|METAPLANET|FRANKLIN|INVESCO|WISDOMTREE|VALKYRIE|OSPREY|PROSHARES|VOLATILITY SHARES|CANARY|REX |HASHDEX|BITMINE|SHARPLINK|UPEXI|DEFI DEVELOPMENT|TRUMP MEDIA|ETHZILLA|FORWARD INDUSTRIES|SOL STRATEGIES/i;
export async function sec() {
  const out = [];
  for (const type of ['8-K', 'S-1', '13F-HR', '']) {
    const xml = await get(`https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=${encodeURIComponent(type)}&count=100&output=atom`, { headers: { accept: 'application/atom+xml' } });
    for (const it of parseFeed(xml)) if (EDGAR_WATCH.test(it.title)) out.push({ ...it, nid: it.url || it.title, meta: { form: it.title.split(' - ')[0] } });
  }
  return out;
}
export async function fedreg() {
  const xml = await get('https://www.federalregister.gov/api/v1/documents.rss?conditions%5Bagencies%5D%5B%5D=securities-and-exchange-commission&conditions%5Bagencies%5D%5B%5D=commodity-futures-trading-commission&order=newest');
  return parseFeed(xml).filter(it => /crypto|digital asset|bitcoin|ether|stablecoin|token|blockchain|exchange-traded|trust|custody/i.test(it.title + ' ' + it.snippet));
}
export async function cftc() {
  const out = [];
  for (const u of ['https://www.cftc.gov/RSS/RSSENF/rssenf.xml', 'https://www.cftc.gov/RSS/RSSGP/rssgp.xml']) out.push(...parseFeed(await get(u)));
  return out.filter(it => /crypto|digital asset|bitcoin|ether|stablecoin|token|prediction market|perpetual|binance|coinbase|kraken|polymarket|kalshi/i.test(it.title + ' ' + it.snippet));
}
// Telegram public channel preview page (no account, newest ~20 posts). Official exchange channels and the alert bots.
// OKX_Official and lookonchain answer 302 (no public preview) and were dropped 2026-10-29; the five added that day are the
// fast desks that mirror X in seconds (BWEnews, Wu Blockchain, Cointelegraph, Bitcoin Magazine, Unfolded) - the free half
// of what X would cost, measured against the X API before any budget is spent there.
export const TG = [['binance_announcements', 'official'], ['Bybit_Announcements', 'official'], ['whale_alert_io', 'official'], ['PeckShieldAlert', 'official'], ['BWEnews', 'mediaA'], ['wublockchainenglish', 'mediaA'], ['cointelegraph', 'mediaA'], ['Bitcoin_Magazine', 'mediaB'], ['unfolded', 'mediaB'], ['WatcherGuru', 'mediaB'], ['CoinMarketCapAnnouncements', 'mediaB']];
export async function tg(channel, before) {
  // `?before=<post number>` pages the public preview backwards (20 posts a page) - how the backfill reaches a month
  const html = await get('https://t.me/s/' + channel + (before ? '?before=' + before : ''), { headers: { accept: 'text/html' } });
  const out = [];
  for (const b of html.match(/<div class="tgme_widget_message_wrap[\s\S]*?<\/time>/g) || []) {
    const post = attr(b, 'div', 'data-post'); const txt = dec(pick(b, 'div class="tgme_widget_message_text js-message_text" dir="auto"') || (b.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '');
    const when = (b.match(/<time[^>]*datetime="([^"]+)"/) || [])[1]; const ts = Date.parse(when || '');
    if (!txt || !(ts > 0)) continue;
    const num = +(String(post || '').split('/')[1] || 0) || 0;
    out.push({ nid: 'tg:' + (post || txt.slice(0, 40)), ts, title: txt.slice(0, 200), url: post ? 'https://t.me/' + post : '', snippet: txt.slice(0, 170), num });
  }
  return out;
}
// Reddit: the per-subreddit .rss works without a key but 429s fast - one subreddit, every 5 minutes, social tier.
export async function reddit(sub) {
  return parseFeed(await get(`https://www.reddit.com/r/${sub}/new/.rss`, { headers: { accept: 'application/atom+xml' } })).map(it => ({ ...it, nid: it.url }));
}
// Our own calendar: scheduled macro events become catalysts AT their time (kind macro, expect 0), and the upcoming
// list is published beside the live ones so a surface can say "CPI in 40 minutes".
export async function calendar() {
  const d = await get('https://marginpad.io/api/calendar', { json: true });
  return ((d && d.events) || []).filter(e => +e.impact >= 2 && e.ts > 0).map(e => ({ nid: 'cal:' + e.type + ':' + e.ts, ts: +e.ts, title: e.title, url: 'https://marginpad.io/calendar/', snippet: String(e.desc || '').slice(0, 170), meta: { type: e.type, impact: +e.impact } }));
}
// Symbol universe for the extractor: every Bybit linear perp's base (refreshed hourly by index.js)
export async function bybitSymbols() {
  const d = await get('https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000', { json: true });
  const out = [];
  for (const i of (d && d.result && d.result.list) || []) { const m = String(i.symbol || '').match(/^(?:1000|10000|1000000)?([A-Z0-9]{2,10})(?:USDT|USDC|PERP)$/); if (m) out.push(m[1]); }
  return out;
}
export { log };
