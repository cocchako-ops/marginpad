// THE FREE HALF OF X, MEASURED (2026-10-29): X's own embed-timeline endpoint answers a public profile's newest ~20 posts
// with no key, full text and the post's own time - at 30 requests per 15-minute window per IP, which stays at zero for
// as long as it is touched and comes back after a rest (probed 429 x 20 in a row, then 200 with 9 of 30 left after half
// an hour). So this source polls a SHORT list of accounts (eight), one every 38 seconds, which is 24 of the 30 - never
// more, or the whole source dies for a quarter of an hour. Replies and retweets are dropped; a quote keeps its own words.
// Binance's CMS and Upbit's notices (also probed that day from the droplet) ride in the same file: both are primary
// listing sources with their own timestamps, and Upbit's titles are Korean, so a symbol is read off the brackets and an
// English title is built for the rules.
'use strict';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
async function get(url, { json = false, timeout = 12000, headers = {} } = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try { const r = await fetch(url, { headers: { 'user-agent': UA, ...headers }, signal: ctl.signal }); if (!r.ok) throw new Error('http ' + r.status); return json ? r.json() : r.text(); }
  finally { clearTimeout(t); }
}
// [handle, tier] - DeItaone and FirstSquawk are the fastest macro wires on X, tier10k leaks listings, the rest are the
// desks and the two accounts whose own words move a coin (Musk for DOGE, Hyperliquid for HYPE)
export const X_ACCOUNTS = [['DeItaone', 'mediaA'], ['FirstSquawk', 'mediaA'], ['tier10k', 'mediaA'], ['WatcherGuru', 'mediaB'], ['elonmusk', 'official'], ['binance', 'official'], ['Bybit_Official', 'official'], ['HyperliquidX', 'official']];
export const X_INTERVAL_MS = 60000;             // one request a minute = 15 per 15-min window, half the budget: at 38 s (24 of 30) the live
                                                // collector read 429 on every account for its first twenty minutes (2026-10-29) - the window refills slowly, not at once
export async function xSynd(handle) {
  const html = await get('https://syndication.twitter.com/srv/timeline-profile/screen-name/' + encodeURIComponent(handle));
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); if (!m) return [];
  let j; try { j = JSON.parse(m[1]); } catch (e) { return []; }
  const ents = (j.props && j.props.pageProps && j.props.pageProps.timeline && j.props.pageProps.timeline.entries) || [];
  const out = [];
  for (const e of ents) {
    const t = e && e.content && e.content.tweet; if (!t) continue;
    if (t.retweeted_status || t.in_reply_to_status_id_str || /^RT @/.test(t.full_text || '')) continue;
    const ts = Date.parse(t.created_at || ''); if (!(ts > 0)) continue;
    const text = String(t.full_text || '').replace(/https?:\/\/t\.co\/\S+/g, '').replace(/\s+/g, ' ').trim(); if (!text) continue;
    const who = (t.user && t.user.screen_name) || handle;
    out.push({ nid: 'x:' + (t.id_str || ts), ts, title: text.slice(0, 220), url: 'https://x.com/' + who + '/status/' + (t.id_str || ''), snippet: text.slice(0, 170), meta: { x: who } });
  }
  return out;
}
// Binance announcements: the public CMS behind binance.com/en/support/announcement - 48 = new listings, 161 = delistings
export const BINANCE_CATS = [[48, 'listing'], [161, 'delisting']];
export async function binanceAnnPage(catalogId, page, size) {
  const d = await get('https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&pageNo=' + (page || 1) + '&pageSize=' + (size || 20) + '&catalogId=' + catalogId, { json: true });
  const cat = d && d.data && d.data.catalogs && d.data.catalogs[0], rows = [];
  for (const a of (cat && cat.articles) || []) rows.push({ nid: 'binance:' + (a.code || a.id), ts: +a.releaseDate, title: a.title, url: a.code ? 'https://www.binance.com/en/support/announcement/' + a.code : '', snippet: '', meta: { catalog: catalogId } });
  return { rows, total: +(cat && cat.total) || 0 };
}
export async function binanceAnn() { const out = []; for (const [c] of BINANCE_CATS) out.push(...(await binanceAnnPage(c, 1, 20)).rows); return out; }
// Upbit notices (the Korean premium: an Upbit KRW listing is the one announcement that moves a coin in minutes).
// Cloudflare 1015s a second call inside a few seconds, so this is polled once a minute and never paged in a burst.
export async function upbitAnn() {
  const d = await get('https://api-manager.upbit.com/api/v1/announcements?os=web&page=1&per_page=20&category=trade', { json: true });
  const out = [];
  for (const n of (d && d.data && d.data.notices) || []) {
    const title = String(n.title || ''), ts = Date.parse(n.first_listed_at || n.listed_at || '');
    if (!(ts > 0)) continue;
    const syms = [...title.matchAll(/\(([A-Z0-9]{2,12})\)/g)].map(x => x[1]);
    const krw = /KRW/.test(title), btcm = /BTC 마켓/.test(title), usdt = /USDT/.test(title);
    let en;
    // the rules read a NEW ticker off brackets - '(NIL)' - so the English title keeps them beside the bare symbol
    const named = syms.length ? syms.map(x => x + ' (' + x + ')').join(', ') : title;
    if (/거래지원 종료|상장 폐지|거래 종료/.test(title)) en = 'Upbit delisting of ' + named;
    else if (/디지털 자산 추가|신규 거래지원|상장/.test(title)) en = 'Upbit lists ' + named + (krw ? ' on the KRW market' : btcm ? ' on the BTC market' : usdt ? ' on the USDT market' : '');
    else en = 'Upbit notice: ' + title;
    out.push({ nid: 'upbit:' + (n.uuid || n.id), ts, title: en, url: n.id ? 'https://upbit.com/service_center/notice?id=' + n.id : '', snippet: title.slice(0, 170), meta: { ko: title.slice(0, 120), krw, syms } });
  }
  return out;
}
