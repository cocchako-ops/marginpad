/* /liquidations/by-exchange/ — which venue is liquidating traders, measured by our own collector.

   Why this page exists: AI assistants send more traffic to this site than Google does on the pages where
   we hold data nobody else gives away (measured 2026-08-19: chatgpt.com 527 visits/month against Google's
   846 across the whole site, and 65 vs 5 on /btc-liquidation-map/). What gets cited is a checkable
   first-party number with a stated method — and per-exchange liquidation flow is exactly that. Coinglass
   puts the same breakdown behind a paywall; we run the websockets ourselves, so we can publish it free.

   The table is EMPTY in this file on purpose. handleSsrVenues in the worker fills it per request from
   /api/v1/venues and caches for ten minutes, so a crawler reads real figures in the static HTML rather
   than a JavaScript placeholder — the mistake that made the comparison-page fix worse before it was
   moved server-side. Run: node build/gen-venue-page.js */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist', 'liquidations', 'by-exchange');
const url = 'https://marginpad.io/liquidations/by-exchange/';
const title = 'Crypto Liquidations by Exchange — Live 24h Totals per Venue | MarginPad';
const desc = 'Which exchange is liquidating the most traders right now. Live 24-hour liquidation totals per venue with the long/short split, measured from the public websockets of nine exchanges. Free, no signup, free JSON API.';

const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const FAQ = [
  ['Which exchange has the most crypto liquidations?',
   'It changes daily, which is why the table above is measured rather than written down. Binance is usually the largest by absolute size because it carries the most open leverage, but share moves with the day: Hyperliquid regularly takes a bigger slice during sharp moves because its book is thinner, and a venue can jump from five percent to a quarter of the day’s total in one cascade. Read the share column, not the raw dollars, when comparing venues of different sizes.'],
  ['Where does this liquidation data come from?',
   'MarginPad runs its own collector subscribed to the public liquidation websocket of each venue: Binance, Bybit, OKX, Hyperliquid, Gate, HTX, dYdX, BitMEX and Bitfinex. Every forced close is normalised (symbol, side, price, notional, timestamp) and aggregated into a rolling 24-hour window. These are observed events, not estimates or a model, and nothing is filled in when a feed is quiet.'],
  ['What does the long/short split tell me?',
   'It shows which side the crowd was caught on. A venue whose 24-hour flow is mostly long liquidations was carrying crowded longs into a drop; mostly short liquidations means the squeeze went the other way. The split is often more informative than the total, because it describes positioning rather than size.'],
  ['Does a bigger liquidation total mean an exchange is riskier?',
   'No. It mostly means more leveraged size is open there. A venue with deep books and many traders will liquidate more dollars than a small one on the same market move. What would indicate risk is a venue liquidating far above its share of open interest, or repeated cascades on thin books.'],
  ['Can I get this data as an API?',
   'Yes, free and without a key: GET https://marginpad.io/api/v1/venues returns each venue with its 24-hour total, the long and short breakdown and its share of the market-wide figure. The same collector also powers /api/v1/liquidations for market totals and /api/v1/clusters for the heatmap bands.'],
];

const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/blog.css" />
<style>
.vx-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:18px 0 8px}
.vx{width:100%;border-collapse:collapse;font-size:14.5px;min-width:520px}
.vx th,.vx td{padding:11px 13px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}
.vx th{font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-dim);font-weight:400}
.vx td:first-child{font-weight:700}
.vx td.n{font-family:'Space Mono',monospace}
.vx .bar{display:block;height:5px;border-radius:3px;background:#ff5a4d;overflow:hidden;min-width:80px}
.vx .bar i{display:block;height:100%;background:#2ebd85}
.vx-stamp{font-family:'Space Mono',monospace;font-size:11.5px;color:#6f7885;margin:2px 0 26px}
.vx-note{border:1px solid #262e3a;border-radius:13px;padding:14px 17px;background:rgba(255,255,255,.015);margin:22px 0}
.vx-note b{display:block;font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8b95a1;margin-bottom:6px}
.vx-note p{font-size:13px;color:#9aa3ad;line-height:1.65;margin:0}
</style>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Dataset","name":"Crypto liquidations by exchange (24h)","description":"Rolling 24-hour forced-liquidation totals per derivatives venue, with the long and short breakdown, observed from each exchange's public liquidation websocket.","url":"${url}","license":"https://marginpad.io/terms/","isAccessibleForFree":true,"creator":{"@type":"Organization","name":"MarginPad","url":"https://marginpad.io/"},"temporalCoverage":"P1D","distribution":[{"@type":"DataDownload","encodingFormat":"application/json","contentUrl":"https://marginpad.io/api/v1/venues"}],"measurementTechnique":"Direct subscription to each venue's public liquidation websocket; events normalised and aggregated over a rolling 24-hour window."}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[${FAQ.map(([q, a]) => `{"@type":"Question","name":${JSON.stringify(q)},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(a)}}}`).join(',')}]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Liquidations","item":"https://marginpad.io/liquidations/"},{"@type":"ListItem","position":2,"name":"By exchange","item":"${url}"}]}</script>
${GTAG}
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="/liquidations/">Liquidations</a><a href="/heatmap">Heatmap</a><a href="/trading-api/">API</a></nav>
  </header>
  <div class="crumb"><a href="/liquidations/">Liquidations</a> / By exchange</div>
  <article>
    <h1>Crypto liquidations by exchange</h1>
    <p class="lead">Which venue is actually blowing traders up, over the last 24 hours. These are observed forced closes read from each exchange&#39;s own public websocket &mdash; not an estimate, not a vendor feed, and not a model.</p>

    <div id="vxdata">
      <p class="vx-stamp">Reading the last 24 hours from our collector&hellip;</p>
    </div>

    <div class="vx-note">
      <b>How to read this</b>
      <p>Share matters more than the raw dollar figure. A venue carrying more open leverage will always liquidate more money on the same market move, so a big total is mostly a statement about size. The long/short split is the more useful column: it tells you which side the crowd was caught on when the move came. And one day is weather, not climate &mdash; a single cascade can hand a quarter of the day&#39;s total to a venue that normally sits at five percent.</p>
    </div>

    <h2>Why this is hard to find for free</h2>
    <p>Per-venue liquidation flow is one of the few derivatives datasets that is genuinely gated. The aggregators that publish it charge for the breakdown, because collecting it means holding a live websocket connection to every exchange, normalising nine different message formats, and staying connected through their outages rather than sampling a REST endpoint every few minutes. MarginPad runs that collector for its own <a href="/heatmap">liquidation heatmap</a> and <a href="/rekt/">live feed</a>, so publishing the per-venue split costs nothing extra and there is no reason to charge for it.</p>

    <h2>Method, in full</h2>
    <p>The collector subscribes to the public liquidation stream of <strong>nine exchanges</strong>: Binance, Bybit, OKX, Hyperliquid, Gate, HTX, dYdX, BitMEX and Bitfinex. Binance is read on two feeds (USD-margined and coin-margined) which are counted as one venue. Each event carries a symbol, a side, a fill price and a size; notional is price times size in US dollars. Events are aggregated into a rolling 24-hour window and the table above is that window at the moment the page was served.</p>
    <p>Nothing is inferred. If a venue&#39;s socket is quiet it shows zero rather than an interpolated figure, and if the collector itself is down the table says so instead of showing stale numbers as if they were current. Totals will differ from other trackers, and they should: exchanges publish liquidation events at different granularity, some batch them, and any aggregator that models the gaps will report more than one that does not.</p>

    <h2>Take the data</h2>
    <p>The same figures are free as JSON with no key and no signup: <code>GET https://marginpad.io/api/v1/venues</code> returns every venue with its 24-hour total, the long and short breakdown and its share. Market-wide totals live at <code>/api/v1/liquidations</code> and the heatmap bands at <code>/api/v1/clusters</code>. Full documentation is on the <a href="/trading-api/">free crypto API</a> page &mdash; attribution is appreciated but not required.</p>

    <h2>Questions</h2>
    ${FAQ.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('\n    ')}

    <p style="margin-top:26px">Related: <a href="/liquidations/">live liquidation totals</a> &middot; <a href="/heatmap">liquidation heatmap</a> &middot; <a href="/rekt/">real-time liquidation feed</a> &middot; <a href="/liquidation-statistics/">liquidation statistics by coin</a></p>
  </article>
  <footer>
    <span>&copy; 2026 MarginPad</span>
    <span><a href="/">Calculators</a> &middot; <a href="/blog/">Blog</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="/privacy/">Privacy</a></span>
  </footer>
</div>
</body>
</html>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('wrote /liquidations/by-exchange/ (' + Math.round(html.length / 1024) + ' KB)');
