/* /api/ (developer JSON API docs) + /widgets/ (embeddable calculator) - multilingual.
   English at /api/ & /widgets/ plus 12 translated variants at /<lang>/api/ & /<lang>/widgets/ (hreflang).
   Prose comes from build/data/aw-i18n.js (BUNDLES, via subagent translation); code/endpoints/JSON stay literal.
   Run: node build/gen-api-widgets-pages.js */
const fs = require('fs');
const path = require('path');
const { BUNDLES } = require('./data/aw-i18n');
const DIST = path.join(__dirname, '..', 'dist');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';
// 2026-08-18: emptied deliberately. 1,008 translated subpages drew 47 pageviews and 7 Google
// visits in 90 days while multiplying every duplicate signal across the domain. This list drives
// both page generation AND the hreflang alternates, so an empty list stops writing the pages and
// stops advertising them. Restore by putting the codes back - dictionaries are untouched.
// was: const LANG_CODES = ['de', 'es', 'pt', 'fr', 'nl', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id'];
const LANG_CODES = [];
const RTL = { ar: 1 };
const escAttr = s => String(s).replace(/&(?!amp;|lt;|gt;|quot;)/g, '&amp;').replace(/"/g, '&quot;');

function hreflang(page) {
  let s = `<link rel="alternate" hreflang="en" href="https://marginpad.io/${page}/" />\n`;
  for (const lc of LANG_CODES) s += `<link rel="alternate" hreflang="${lc}" href="https://marginpad.io/${lc}/${page}/" />\n`;
  s += `<link rel="alternate" hreflang="x-default" href="https://marginpad.io/${page}/" />`;
  return s;
}

function apiPage(lang) {
  // /api/ is THE API hub (rewritten 2026-09-11, owner: "here everything about our API must be written, and the partner
  // cards"). Only English is generated (LANG_CODES is empty); the calculator section still reads the i18n bundle so a
  // restored language keeps its prose, every other section is English prose + literal endpoints.
  const t = BUNDLES[lang || 'en'].api, code = lang || 'en';
  const home = lang ? `/${lang}/` : '/', url = `https://marginpad.io/${lang ? lang + '/' : ''}api/`;
  const HL = 'https://app.hyperliquid.xyz/join/MARGINPAD';
  const row = (m, p, d) => `<tr><td><span class="m ${m.toLowerCase()}">${m}</span></td><td><code>${p}</code></td><td>${d}</td></tr>`;
  return `<!DOCTYPE html>
<html lang="${code}"${RTL[lang] ? ' dir="rtl"' : ''}>
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>MarginPad API - free crypto data, paper-trading Bot API, MCP | MarginPad</title>
<meta name="description" content="Every MarginPad API on one page: a free keyless crypto market-data API (prices, candles, screener, funding, open interest, liquidations, calendar), a paper-trading Bot API with REST, WebSocket, webhooks, trailing stops and limit/stop orders, a remote MCP server with 22 tools, OpenAPI 3.1 and one-file Python and JS clients." />
<meta name="keywords" content="marginpad api, free crypto api, crypto price api no key, paper trading api, trading bot api, crypto liquidation api, funding rate api, mcp server crypto, openapi crypto, crypto calculator api" />
<link rel="canonical" href="${url}" />
${hreflang('api')}
<meta property="og:title" content="MarginPad API - free crypto data, paper-trading Bot API, MCP" />
<meta property="og:description" content="Keyless market data at 60 req/min (120–600 with a free key), a full paper-trading Bot API with webhooks and trailing stops, MCP with 22 tools, OpenAPI 3.1, Python and JS clients." />
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="dns-prefetch" href="https://fonts.gstatic.com" />
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/blog.css" />
<style>
  pre{background:var(--panel);border:1px solid var(--line-bright);border-left:3px solid var(--lime);border-radius:8px;padding:14px 16px;margin:12px 0;overflow-x:auto;font-family:'Space Mono',monospace;font-size:13px;color:var(--ink);line-height:1.5}
  .ep{font-family:'Space Mono',monospace;font-size:14px;color:var(--lime);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:18px 0 8px;word-break:break-all}
  .ep b{color:#2ebd85}
  table.params{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:14px}
  table.params td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
  table.params td:first-child{font-family:'Space Mono',monospace;color:var(--ink);white-space:nowrap;width:120px}
  table.params td:last-child{color:var(--ink-dim)}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 4px}.chips span{font-family:'Space Mono',monospace;font-size:11px;color:var(--ink-dim);border:1px solid var(--line-bright);border-radius:99px;padding:6px 12px}
  .ways{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:22px 0 8px}
  @media(max-width:900px){.ways{grid-template-columns:1fr 1fr}}@media(max-width:520px){.ways{grid-template-columns:1fr}}
  .way{display:flex;flex-direction:column;gap:8px;background:var(--panel);border:1px solid var(--line-bright);border-radius:14px;padding:16px;text-decoration:none;color:var(--ink);min-width:0}
  .way b{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--lime)}
  .way strong{font-family:'Bricolage Grotesque',sans-serif;font-size:17px;line-height:1.2}
  .way span{font-size:13px;color:var(--ink-dim);line-height:1.55}.way em{font-style:normal;font-size:12.5px;color:var(--lime);font-weight:700;margin-top:auto}
  .way:hover{border-color:var(--lime)}
  .tw{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:12px 0 18px}
  table.eps{width:100%;min-width:560px;border-collapse:collapse;font-size:13.5px}
  table.eps th{text-align:left;font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-dim);padding:8px;border-bottom:1px solid var(--line-bright)}
  table.eps td{padding:8px;border-bottom:1px solid var(--line);vertical-align:top;color:var(--ink-dim);line-height:1.5}
  table.eps td:nth-child(2){white-space:nowrap}table.eps code{font-family:'Space Mono',monospace;font-size:12.5px;color:var(--ink)}
  .m{display:inline-block;font-family:'Space Mono',monospace;font-size:10px;font-weight:700;border-radius:6px;padding:3px 7px}
  .m.get{background:rgba(63,216,230,.15);color:#3fd8e6}.m.post{background:rgba(46,189,133,.15);color:#2ebd85}.m.ws{background:rgba(194,246,74,.15);color:#c2f64a}
  .tag{display:inline-block;font:800 9.5px/1 'Space Mono',monospace;letter-spacing:.08em;border-radius:5px;padding:3px 6px;vertical-align:middle;margin-left:4px}
  .tag.p{background:rgba(255,215,90,.12);border:1px solid rgba(255,215,90,.4);color:#ffd75a}.tag.n{background:rgba(94,230,200,.12);border:1px solid rgba(94,230,200,.4);color:#5ee6c8}
  .plans{width:100%;border-collapse:collapse;font-size:13.5px;min-width:520px}.plans th,.plans td{padding:9px 10px;border:1px solid var(--line);text-align:left;vertical-align:top}
  .plans th{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-dim);background:var(--panel)}
  .plans td:first-child{color:var(--ink);font-weight:600}.plans td{color:var(--ink-dim)}.plans .hl{color:var(--lime);font-weight:700}
  .golive{margin:30px 0 10px;padding:22px;border:1px solid var(--line-bright);border-left:3px solid var(--lime);border-radius:14px;background:var(--panel)}
  .golive .gl-h{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:20px;letter-spacing:-.01em;color:var(--ink);margin:0 0 8px}
  .golive>p{color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:0 0 16px}
  .gl-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:0 0 14px}@media(max-width:640px){.gl-grid{grid-template-columns:1fr}}
  .gl-card{position:relative;display:flex;flex-direction:column;gap:10px;padding:18px;border-radius:14px;border:1px solid var(--line-bright);background:#0d1015;overflow:hidden}
  .gl-card p{margin:0;font-size:13.5px;line-height:1.6;color:var(--ink-dim)}
  .gl-hl{border-color:rgba(94,230,200,.35);background:radial-gradient(110% 130% at 100% 0%,rgba(94,230,200,.13),transparent 55%),#0d1412}
  .gl-hl::after{content:'HL';position:absolute;right:-6px;bottom:-30px;font:800 100px/1 'Bricolage Grotesque',sans-serif;letter-spacing:-7px;color:rgba(94,230,200,.07);pointer-events:none}
  .gl-ch{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.gl-ch b{font-family:'Bricolage Grotesque',sans-serif;font-size:17px;color:var(--ink)}
  .gl-mark{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;background:#0f1f1b;color:#5ee6c8;font:800 12px/1 'Bricolage Grotesque',sans-serif}
  .gl-pill{font:700 9.5px/1 'Space Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-dim);border:1px solid var(--line);border-radius:99px;padding:5px 9px}
  .gl-offer{display:flex;align-items:baseline;gap:10px;padding:10px 12px;border-radius:10px;background:rgba(94,230,200,.08);border:1px solid rgba(94,230,200,.28);position:relative;z-index:1}.gl-offer b{font:800 30px/1 'Bricolage Grotesque',sans-serif;color:#5ee6c8;letter-spacing:-.02em}.gl-offer span{font-size:12.5px;line-height:1.3;color:#cfe3dd}.gl-offer i{font-style:normal;font-family:'Space Mono',monospace;font-weight:700;letter-spacing:.1em;color:#f2fbf8}
  .gl-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:auto;padding:12px 18px;border-radius:11px;background:var(--lime);color:#0a0b0d;font:800 13.5px/1 'Bricolage Grotesque',sans-serif;text-decoration:none;position:relative;z-index:1}
  .gl-hl .gl-cta{background:#5ee6c8;color:#062a24}.gl-note{display:block;font-size:11.5px;line-height:1.5;color:var(--ink-faint)}
  .gl-card.mp-ex-off{opacity:.55;filter:saturate(.35)}.mp-ex-na{display:block;font:700 9.5px/1.3 'Space Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#8b97a5;margin-top:5px}
</style>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebAPI","name":"MarginPad API","description":"Free keyless crypto market-data API (prices, OHLC, screener, funding, open interest, liquidations, calendar, calculators), a paper-trading Bot API (REST, WebSocket, webhooks, limit/stop orders, trailing stops) and a remote MCP server with 22 tools. OpenAPI 3.1.","url":"https://marginpad.io/api/","documentation":"https://marginpad.io/api/openapi.json","termsOfService":"https://marginpad.io/terms/","provider":{"@type":"Organization","name":"MarginPad","url":"https://marginpad.io/"},"offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}
</script>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="${home}">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="/free-crypto-api/">Data API</a><a href="/trading-api/">Bot API</a><a href="/api/changelog">Changelog</a></nav>
  </header>

  <div class="crumb"><a href="${home}">${t.crumbHome}</a> / API</div>
  <article>
    <h1>MarginPad API</h1>
    <p class="lead">Everything the site knows, as JSON: live prices and candles, a scored screener, funding, open interest, long/short, liquidations measured from nine exchanges, an economic calendar - keyless. Plus a full <b>paper-trading Bot API</b> to forward-test a trading bot on real prices with no real money, a remote <b>MCP server</b> so an AI assistant can use all of it natively, an OpenAPI 3.1 spec and one-file Python and JavaScript clients.</p>
    <div class="chips"><span>Keyless market data · 60 req/min</span><span>Free key · 120 req/min</span><span>Premium · 600 req/min</span><span>CORS on everything</span><span>OpenAPI 3.1</span><span>MCP · 23 tools</span><span>Bot API 2.4.0</span></div>

    <div class="ways">
      <a class="way" href="/free-crypto-api/"><b>Market data</b><strong>Free crypto data API</strong><span>Prices, candles, screener, funding, OI, long/short, liquidations, calendar, Fear &amp; Greed, DeFi TVL. No key, no sign-up.</span><em>Docs &rarr;</em></a>
      <a class="way" href="/trading-api/"><b>Paper trading</b><strong>Bot API</strong><span>Open, close, limit &amp; stop orders, trailing stops, webhooks, WebSocket, a trading report. Real prices, simulated money.</span><em>Docs + free key &rarr;</em></a>
      <a class="way" href="/mcp"><b>AI assistants</b><strong>Remote MCP server</strong><span>23 tools for Claude, ChatGPT and Cursor: market data, calculators and your paper account.</span><em>https://marginpad.io/mcp &rarr;</em></a>
      <a class="way" href="/api/openapi.json"><b>Machine-readable</b><strong>OpenAPI 3.1 + clients</strong><span>The full spec with request and response schemas, and zero-dependency <code>marginpad.py</code> / <code>marginpad.js</code>.</span><em>Spec &rarr;</em></a>
    </div>

    <h2 id="data">Market data - <code>/api/v1/*</code>, keyless</h2>
    <p>Every response is the envelope <code>{ ok, data, ts }</code> (<code>{ ok:false, error:{ code, message } }</code> on failure) with CORS on, so a browser page can call it directly. <b>60 requests a minute per IP without a key.</b> Send a free <code>X-API-Key</code> (from <a href="/trading-api/">/trading-api/</a>) on the same calls and they are metered against your key instead - 120 a minute, 600 on <a href="/premium/">Premium</a>. Full manual with examples: <a href="/free-crypto-api/">/free-crypto-api/</a>.</p>
    <div class="tw"><table class="eps">
      <tr><th></th><th>Endpoint</th><th>What you get</th></tr>
      ${row('GET', '/api/v1/price?symbol=BTC', 'Live price for one coin, aggregated across Binance / Bybit / OKX / Gate.')}
      ${row('GET', '/api/v1/prices', 'Batch snapshot of the top coins in one call.')}
      ${row('GET', '/api/v1/klines?symbol=BTC&amp;interval=60', 'OHLC candles: 1, 5, 15, 60, 240, 1440 minutes; up to 1000 per call, <code>&amp;end=</code> to page back.')}
      ${row('GET', '/api/v1/symbols', '~500 liquid USDT-perp symbols by volume.')}
      ${row('GET', '/api/v1/screener', 'Scored futures screener: 0-100 score, verdict, RSI, MACD, trend, ATR setup.')}
      ${row('GET', '/api/v1/funding', 'Funding rates across ~160 pairs, measured from exchange public endpoints.')}
      ${row('GET', '/api/v1/open-interest', 'Open interest (USD) across ~160 pairs.')}
      ${row('GET', '/api/v1/long-short', 'Long/short account ratio for majors (Binance + OKX + Bybit).')}
      ${row('GET', '/api/v1/liquidations', '24h liquidation totals per coin, longs vs shorts, from our own nine-exchange collector.')}
      ${row('GET', '/api/v1/venues', 'Liquidations by exchange: 24h total, share, long/short split.')}
      ${row('GET', '/api/v1/feed', 'The newest liquidation events across all symbols (seconds behind the exchanges).')}
      ${row('GET', '/api/v1/liquidations/live?symbol=BTC', 'Raw recent liquidation events for one symbol.')}
      ${row('GET', '/api/v1/liquidations/recent?symbol=BTC&amp;minutes=1440', 'Time-bucketed long/short histogram, up to 30 days.')}
      ${row('GET', '/api/v1/clusters?symbol=BTC', 'Modelled liquidation clusters: price levels where forced selling sits right now.')}
      ${row('GET', '/api/v1/calendar', 'FOMC, CPI, NFP, options expiry and crypto milestones with UTC timestamps.')}
      ${row('GET', '/api/v1/fear-greed', 'Fear &amp; Greed index, value and classification.')}
      ${row('GET', '/api/v1/coins', 'Top ~250 coins: price, market cap, 1h/24h/7d change, sparkline.')}
      ${row('GET', '/api/v1/global', 'Total market cap, volume, BTC dominance.')}
      ${row('GET', '/api/v1/trending', 'Trending coins.')}
      ${row('GET', '/api/v1/defi', 'DeFi TVL: chains, protocols, stablecoins.')}
      ${row('GET', '/api/latam/ar · /api/latam/br', 'Regional quotes: USDT in Argentine pesos across 35 exchanges; Bitcoin and USDT in reais with the premium over the commercial dollar.')}
      ${row('GET', '/api/v1/calc/liquidation · position-size · pnl · risk-reward · take-profit', 'The five calculators below, in the same envelope.')}
    </table></div>
    <pre>curl "https://marginpad.io/api/v1/price?symbol=BTC"
curl "https://marginpad.io/api/v1/screener"
curl -H "X-API-Key: mpb_..." "https://marginpad.io/api/v1/klines?symbol=ETH&amp;interval=15"   # counts against your key, not your IP</pre>

    <h2 id="bot">Paper-trading Bot API - <code>/api/bot/v1/*</code> and <code>/api/bot/v2/*</code></h2>
    <p>Point a trading bot at real live prices and settle every trade in simulated dollars: isolated margin, leverage up to 1000&times;, liquidations confirmed on 1-minute candles, taker fees and funding charged like an exchange. Sign in with an email and mint a key on <a href="/trading-api/">/trading-api/</a>; positions live on your account and count for the season boards. <code>v1</code> response shapes are frozen; <code>v2</code> is the same API in the <code>{ ok, data, ts }</code> envelope. Auth: <code>X-API-Key</code>.</p>
    <div class="tw"><table class="eps">
      <tr><th></th><th>Endpoint</th><th>What it does</th></tr>
      ${row('GET', '/api/bot/v1/price · /klines · /time · /markets', 'Fill price, candles, server clock (with <code>drift_ms</code>) and every tradable symbol with its leverage cap and fee - the first three need no key.')}
      ${row('POST', '/api/bot/v1/open', 'Market open at the live price with optional <code>sl</code>, <code>tp</code>, <code>trail_pct</code> <span class="tag n">2.3</span>, <code>client_order_id</code> (idempotent retries) and <code>dry_run</code> <span class="tag n">2.3</span> (price it, write nothing).')}
      ${row('POST', '/api/bot/v1/open <i>type: limit | stop</i>', 'Resting orders that fill AT your level from 1m candles while the bot is offline: a limit below the market or a stop entry above it <span class="tag n">2.3</span>.')}
      ${row('GET', '/api/bot/v1/orders', 'Resting orders (with <code>type</code>) plus the last 20 that filled, expired or were cancelled.')}
      ${row('POST', '/api/bot/v1/modify_order', 'Change a resting order in place: price, sl, tp, margin, leverage, trailing stop <span class="tag n">2.3</span>.')}
      ${row('POST', '/api/bot/v1/cancel_order', 'Cancel a resting order (a filled one answers 409, so a retry can never undo a fill).')}
      ${row('POST', '/api/bot/v1/close · /close_all', 'Close one position, partially with <code>pct</code>, or everything; P&amp;L settles net of the round-trip fee and funding.')}
      ${row('POST', '/api/bot/v1/sltp', 'Move the stop-loss, take-profit or trailing stop on an open position without closing it.')}
      ${row('GET', '/api/bot/v1/positions?status=open', 'Positions with live mark price and P&amp;L; ETag / 304 when nothing changed; <code>?since=</code>.')}
      ${row('GET', '/api/bot/v1/trades · /account · /balance · /usage', 'Paged closed-trade ledger, lifetime account stats, balance and equity, your plan with limits and entitlements.')}
      ${row('GET', '/api/bot/v1/fees', 'Charge your paper fills at a real venue’s taker schedule less our referral discount (Bybit, Binance, OKX, Bitget, MEXC, Gate, KuCoin, Kraken, Hyperliquid); POST sets the account default, <code>fee_venue</code> on open overrides it <span class="tag n">2.4</span>.')}
      ${row('GET', '/api/bot/v1/report?days=30', 'Your 30-day trading report: totals and skill score free; by coin / leverage / side / hour / day and written findings on Premium <span class="tag n">2.3</span>.')}
      ${row('WS', 'wss://marginpad.io/api/bot/v2/stream?api_key=…', 'Position opened / updated / closed events and mark prices pushed every ~2 s. Free on every plan.')}
      ${row('GET', '/api/bot/v1/webhooks <span class="tag p">Premium</span>', 'Trading events POSTed to your own URL, HMAC-SHA256 signed and retried, whether or not the bot is connected <span class="tag n">2.3</span>.')}
      ${row('POST', '/api/bot/v1/ai <span class="tag p">Premium</span>', 'The chart panel&rsquo;s AI read from the API: an answer, a parsed plan and the brief it reasoned over, 50 a day <span class="tag n">2.3</span>.')}
    </table></div>
    <div class="tw"><table class="plans">
      <tr><th>Plan</th><th>Free</th><th class="hl">Premium ($11.99/mo)</th></tr>
      <tr><td>Requests / minute per key (trading and market data)</td><td>120</td><td class="hl">600</td></tr>
      <tr><td>API keys · open positions · resting orders</td><td>3 · 50 · 20</td><td class="hl">10 · 200 · 20</td></tr>
      <tr><td>Market data, WebSocket, MCP, limit &amp; stop orders, trailing stops, modify, dry run, venue fee schedules</td><td>included</td><td class="hl">included</td></tr>
      <tr><td>Webhooks · AI market read · report breakdowns</td><td>-</td><td class="hl">3 hooks · 50/day · full report</td></tr>
    </table></div>
    <p>Full documentation, the quickstart, error codes and the reliability notes (idempotency, ETags, the WebSocket) are on <a href="/trading-api/">/trading-api/</a>. Every change is logged at <a href="/api/changelog">/api/changelog</a> (JSON at <code>/api/changelog?format=json</code>); the current version is 2.4.0.</p>

    <div class="golive" id="golive">
      <div class="gl-h">When the bot is proven, it needs a real exchange key</div>
      <p>Everything above settles in simulated dollars. Once a strategy has survived weeks of forward testing, the same code needs a live API to place real orders. Two venues we point bot builders at:</p>
      <div class="gl-grid">
        <div class="gl-card gl-hl" data-ex="Hyperliquid" id="glHl">
          <div class="gl-ch"><span class="gl-mark">HL</span><b>Hyperliquid</b><span class="gl-pill">on-chain &middot; API-first</span></div>
          <p>Perps on their own chain with a public REST and WebSocket API, <b>sub-accounts that each get their own API wallet</b>, hourly funding and an order book anyone can audit on-chain.</p>
          <div class="gl-offer"><b>4%</b><span>off trading fees<br>with code <i>MARGINPAD</i></span></div>
          <a class="gl-cta" href="${HL}" target="_blank" rel="sponsored noopener noreferrer" data-mpex="Hyperliquid" data-ex="Hyperliquid">Join Hyperliquid &rarr;</a>
        </div>
        <div class="gl-card" data-ex="Bybit" id="glBy">
          <div class="gl-ch"><span class="gl-mark" style="background:#f7a600;color:#1a1200">B</span><b id="glName">Bybit</b><span class="gl-pill">centralised &middot; deepest books</span></div>
          <p id="glTxt">REST and WebSocket shapes close to this API, a separate key per sub-account, and one of the feeds our own prices come from. The default when you want a centralised book with fiat on-ramps.</p>
          <a class="gl-cta" id="glLink" href="https://partner.bybit.com/b/162071" target="_blank" rel="sponsored noopener noreferrer" data-mpex="Bybit" data-ex="Bybit">Open a Bybit account &rarr;</a>
        </div>
      </div>
      <span class="gl-note">Referral links - MarginPad may earn a commission if you open an account, at no cost to you; the Hyperliquid discount is their referral discount. Every API on this page stays free either way. Hyperliquid is not available to US persons under its terms.</span>
    </div>

    <h2 id="mcp">MCP - use it from Claude, ChatGPT or Cursor</h2>
    <p>Add <code>https://marginpad.io/mcp</code> as a remote MCP server (Streamable HTTP). Market-data tools need no key; set the header <code>X-API-Key</code> for the paper-trading tools. <b>23 tools:</b> get_price, get_klines, get_markets, get_screener, get_funding, get_open_interest, get_liquidations, get_fear_greed, get_economic_calendar, calc_liquidation, calc_position_size, paper_balance, paper_positions, paper_trades, paper_open, paper_close, paper_sltp, paper_modify_order, paper_fees, paper_report, paper_limit_order, paper_orders, paper_cancel_order.</p>

    <h2 id="sdk">Clients - one file, zero dependencies</h2>
    <p><a href="/assets/sdk/marginpad.py">marginpad.py</a> (Python 3.8+, urllib only; <code>websockets</code> optional for the stream) and <a href="/assets/sdk/marginpad.js">marginpad.js</a> (Node 18+ or a browser). Both cover market data, every paper-trading call, ETag polling, 429 back-off, the WebSocket stream and webhook signature verification.</p>
    <pre>from marginpad import MarginPad
mp = MarginPad("mpb_...")                              # key from /trading-api/
print(mp.price("BTC"))                                 # keyless market data
r = mp.open("BTC", "long", margin_usd=100, leverage=10, trail_pct=1.5,
            client_order_id="sig-1403")                # a retry can never open twice
print(r["position"]["liq_price"], mp.report()["skill"])</pre>

    <h2 id="calc">Calculators - <code>/api/*</code>, plain JSON</h2>
    <p>${t.lead}</p>
    <pre>Base URL   https://marginpad.io/api
Method     GET
Auth       none
CORS       enabled (Access-Control-Allow-Origin: *)
Format     JSON   (also under /api/v1/calc/* in the { ok, data, ts } envelope)</pre>

    <h3>${t.h2liq}</h3>
    <div class="ep"><b>GET</b> /api/liquidation?entry=60000&amp;leverage=10&amp;side=long&amp;mmr=0.5</div>
    <table class="params">
      <tr><td>entry</td><td>${t.p_entry_req}</td></tr>
      <tr><td>leverage</td><td>${t.p_lev_req}</td></tr>
      <tr><td>side</td><td>${t.p_side_opt}</td></tr>
      <tr><td>mmr</td><td>${t.p_mmr_opt}</td></tr>
    </table>
    <pre>{
  "side": "long",
  "liquidationPrice": 54300,
  "distancePct": -9.5
}</pre>

    <h3>${t.h2size}</h3>
    <div class="ep"><b>GET</b> /api/position-size?balance=5000&amp;risk=1&amp;entry=60000&amp;stop=58800&amp;leverage=10</div>
    <table class="params">
      <tr><td>balance</td><td>${t.p_balance_req}</td></tr>
      <tr><td>risk</td><td>${t.p_risk_req}</td></tr>
      <tr><td>entry</td><td>${t.p_entry_req}</td></tr>
      <tr><td>stop</td><td>${t.p_stop_req}</td></tr>
      <tr><td>leverage</td><td>${t.p_lev_margin_opt}</td></tr>
    </table>
    <pre>{ "positionSize": 0.041667, "notional": 2500, "riskAmount": 50, "marginRequired": 250 }</pre>

    <h3>${t.h2pnl}</h3>
    <div class="ep"><b>GET</b> /api/pnl?entry=60000&amp;exit=66000&amp;size=0.5&amp;leverage=10&amp;side=long</div>
    <pre>{ "pnl": 3000, "roiPct": 10, "roePct": 100 }</pre>

    <h3>${t.h2rr}</h3>
    <div class="ep"><b>GET</b> /api/risk-reward?entry=60000&amp;stop=58000&amp;tp=66000</div>
    <pre>{ "riskRewardRatio": 3, "riskPerUnit": 2000, "rewardPerUnit": 6000, "breakevenWinRatePct": 25 }</pre>

    <h3>${t.h2tp}</h3>
    <div class="ep"><b>GET</b> /api/take-profit?entry=60000&amp;leverage=10&amp;roe=75&amp;side=long</div>
    <pre>{ "targetExitPrice": 64500, "priceMovePct": 7.5 }</pre>

    <h2>${t.h2notes}</h2>
    <p>${t.notes} Market data is free for public use, attribution appreciated; the Bot API is a simulator and never touches real funds. Educational only, not financial advice.</p>

    <div class="endcta">
      <h3>Build something with it</h3>
      <p>Get a free API key in a minute, or drop the MCP URL into your assistant and ask it what looks bullish right now.</p>
      <a class="cta" href="/trading-api/">Get a free API key →</a>
    </div>
  </article>

  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="/free-crypto-api/">Data API</a> · <a href="/trading-api/">Bot API</a> · <a href="/api/openapi.json">OpenAPI</a> · <a href="/api/changelog">Changelog</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="/privacy/">Privacy</a></span>
  </footer>
</div>
<script>
/* Bybit does not onboard the US or Canada and Hyperliquid's terms exclude US persons: the shared partner table (window.mpEx,
   deferred mp-auth.js pulled in by mp-nav) dims and labels the cards for those readers, same rule as everywhere else. */
(function () {
  var n = 0;
  if (!document.querySelector('script[src*="mp-auth"]')) n = 80; // the bundle is not on this page (mp-nav does not pull it): skip straight to the geo fallback below
  var iv = setInterval(function () {
    if (++n > 80) { clearInterval(iv); try { var cached = null; try { var v = JSON.parse(localStorage.getItem('mp_cc') || 'null'); if (v && v.cc && Date.now() - (+v.ts || 0) < 864e5) cached = v.cc; } catch (e0) {} (cached ? Promise.resolve({ cc: cached }) : fetch('/api/geo', { credentials: 'omit' }).then(function (r) { return r.json(); })).then(function (d) { if (d && d.cc === 'US') { var h = document.getElementById('glHl'); if (h && !h.querySelector('.mp-ex-na')) { h.classList.add('mp-ex-off'); var s = document.createElement('span'); s.className = 'mp-ex-na'; s.textContent = 'not available in the US'; h.appendChild(s); } } }).catch(function () {}); } catch (e) {} return; }
    if (!window.mpEx || !window.mpEx.cc) return;
    clearInterval(iv);
    window.mpEx.cc(function (c) {
      if (!c) return;
      var reg = window.mpEx.region(c) || 'your country';
      if (window.mpEx.blocked('Hyperliquid', c)) { var h = document.getElementById('glHl'); if (h && !h.querySelector('.mp-ex-na')) { h.classList.add('mp-ex-off'); var s = document.createElement('span'); s.className = 'mp-ex-na'; s.textContent = 'not available in ' + reg; h.appendChild(s); } }
      if (!window.mpEx.blocked('Bybit', c)) return;
      var v = ['Kraken', 'Crypto.com'].filter(function (x) { return !window.mpEx.blocked(x, c); })[0] || window.mpEx.best(null, c);
      var a = document.getElementById('glLink'), t = document.getElementById('glTxt'), nm = document.getElementById('glName'), by = document.getElementById('glBy');
      if (!v || !a || !t) return;
      a.href = window.mpEx.url(v); a.setAttribute('data-mpex', v); a.setAttribute('data-ex', v); a.textContent = 'Open a ' + v + ' account →';
      if (nm) nm.textContent = v; if (by) by.setAttribute('data-ex', v);
      t.innerHTML = 'Bybit does not onboard traders in ' + reg + ', so this points at <b>' + v + '</b> instead - a venue that does, with a documented REST API.';
    });
  }, 100);
})();
</script>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;
}

function widgetsPage(lang) {
  const t = BUNDLES[lang || 'en'].widgets, code = lang || 'en';
  const home = lang ? `/${lang}/` : '/', url = `https://marginpad.io/${lang ? lang + '/' : ''}widgets/`;
  return `<!DOCTYPE html>
<html lang="${code}"${RTL[lang] ? ' dir="rtl"' : ''}>
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>${escAttr(t.metaTitle)} | MarginPad</title>
<meta name="description" content="${escAttr(t.metaDesc)}" />
<meta name="keywords" content="${escAttr(t.keywords)}" />
<link rel="canonical" href="${url}" />
${hreflang('widgets')}
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#0a0b0d" />
<meta property="og:title" content="${escAttr(t.metaTitle)}" />
<meta property="og:description" content="${escAttr(t.ogDesc)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="dns-prefetch" href="https://fonts.gstatic.com" />
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/blog.css" />
<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"MarginPad Liquidation Calculator Widget","applicationCategory":"FinanceApplication","operatingSystem":"Any (web browser)","url":"https://marginpad.io/widgets/","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":"Free embeddable crypto liquidation calculator widget with live prices."}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":${JSON.stringify(t.crumbHome)},"item":"https://marginpad.io${home}"},{"@type":"ListItem","position":2,"name":${JSON.stringify(t.crumbWidgets)},"item":"${url}"}]}</script>
<style>
  .embed-grid{display:grid;grid-template-columns:1fr 1.1fr;gap:28px;align-items:start;margin:24px 0 8px}
  @media(max-width:720px){.embed-grid{grid-template-columns:1fr}}
  .embed-prev{background:#0c0f13;border:1px solid var(--line-bright);border-radius:16px;padding:8px}
  .embed-prev iframe{display:block;width:100%;border:0;border-radius:11px}
  .code{position:relative;background:#0a0b0d;border:1px solid var(--line-bright);border-radius:12px;padding:16px 16px 14px;font-family:'Space Mono',monospace;font-size:12.5px;color:#c9d2dc;line-height:1.6;overflow-x:auto;white-space:pre-wrap;word-break:break-all}
  .copy{position:absolute;top:10px;right:10px;background:#1a1f27;border:1px solid var(--line-bright);color:var(--ink-dim);font-family:'Space Mono',monospace;font-size:11px;padding:5px 10px;border-radius:7px;cursor:pointer}
  .copy:hover{color:#c2f64a;border-color:#c2f64a}
  .coins{display:flex;flex-wrap:wrap;gap:7px;margin:6px 0 18px}
  .coins a{font-family:'Space Mono',monospace;font-size:12px;color:var(--ink-dim);text-decoration:none;border:1px solid var(--line-bright);border-radius:8px;padding:6px 11px}
  .coins a:hover{color:#c2f64a;border-color:#c2f64a}
  .feat{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:14px 0 8px}
  @media(max-width:620px){.feat{grid-template-columns:1fr}}
  .feat div{background:var(--panel);border:1px solid var(--line-bright);border-radius:12px;padding:14px 15px;font-size:14px}
  .feat b{display:block;color:#c2f64a;font-family:'Space Mono',monospace;font-size:12px;margin-bottom:5px}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="${home}">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="${home}">${t.navCalc}</a><a href="/blog/">${t.navBlog}</a><a href="/glossary/">${t.navGloss}</a></nav>
  </header>
  <div class="crumb"><a href="${home}">${t.crumbHome}</a> / ${t.crumbWidgets}</div>
  <article>
    <h1>${t.h1}</h1>
    <p class="lead">${t.lead}</p>

    <div class="embed-grid">
      <div class="embed-prev">
        <iframe src="/widget/liquidation-calculator/?coin=BTC" height="430" title="Liquidation Calculator by MarginPad" loading="lazy"></iframe>
      </div>
      <div>
        <h2 style="margin-top:0">${t.copyH}</h2>
        <div class="code"><button class="copy" type="button" onclick="(function(b){var t=b.parentNode.querySelector('code');navigator.clipboard&&navigator.clipboard.writeText(t.textContent);b.textContent='${t.copiedBtn}';setTimeout(function(){b.textContent='${t.copyBtn}';},1400);})(this)">${t.copyBtn}</button><code>&lt;iframe src="https://marginpad.io/widget/liquidation-calculator/?coin=BTC"
  width="360" height="440" loading="lazy"
  style="border:0;border-radius:14px;max-width:100%"
  title="Liquidation Calculator by MarginPad"&gt;&lt;/iframe&gt;</code></div>
        <h2>${t.pickH}</h2>
        <p>${t.pickP}</p>
        <div class="coins">
          <a href="/widget/liquidation-calculator/?coin=BTC" target="_blank">BTC</a>
          <a href="/widget/liquidation-calculator/?coin=ETH" target="_blank">ETH</a>
          <a href="/widget/liquidation-calculator/?coin=SOL" target="_blank">SOL</a>
          <a href="/widget/liquidation-calculator/?coin=XRP" target="_blank">XRP</a>
          <a href="/widget/liquidation-calculator/?coin=BNB" target="_blank">BNB</a>
          <a href="/widget/liquidation-calculator/?coin=DOGE" target="_blank">DOGE</a>
        </div>
      </div>
    </div>

    <div class="feat">
      <div><b>${t.featLiveB}</b>${t.featLiveP}</div>
      <div><b>${t.featLsB}</b>${t.featLsP}</div>
      <div><b>${t.featCostB}</b>${t.featCostP}</div>
    </div>

    <h2>${t.whyH}</h2>
    <p>${t.whyP}</p>

    <h2>${t.moreH}</h2>
    <div class="related">
      <a href="${home}#liq">${t.relLiq}</a>
      <a href="/heatmap">${t.relHeat}</a>
      <a href="/paper-trade">${t.relPaper}</a>
      <a href="/funding-fee-calculator/">${t.relFunding}</a>
      <a href="/blog/">${t.relGuides}</a>
    </div>
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:24px">${t.disclaimer}</p>
  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="${home}">${t.navCalc}</a> · <a href="/blog/">${t.navBlog}</a> · <a href="/glossary/">${t.navGloss}</a></span>
  </footer>
</div>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;
}

let n = 0;
function write(rel, html) { const d = path.join(DIST, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'index.html'), html); n++; }
write('api', apiPage(''));
write('widgets', widgetsPage(''));
for (const lc of LANG_CODES) { write(path.join(lc, 'api'), apiPage(lc)); write(path.join(lc, 'widgets'), widgetsPage(lc)); }
console.log('wrote', n, 'api + widgets pages (en + 12 langs)');
