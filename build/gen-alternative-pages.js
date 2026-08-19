/* Generates tool-vs-tool "free alternative" landing pages — the query class AI assistants answer most
   ("free alternative to X"). Honest comparisons: we state plainly what the paid/original tool does better.
   Pages: /coinglass-alternative/ /tradingview-paper-trading-alternative/ /binance-testnet-alternative/
   Run: node build/gen-alternative-pages.js */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');

const PAGES = [
  {
    slug: 'coinglass-alternative',
    title: 'Free Coinglass Alternative — Liquidation Maps, Funding & OI | MarginPad',
    h1: 'Free Coinglass Alternative',
    desc: 'MarginPad covers the core Coinglass feature set for free: live liquidation maps and heatmap, a real-time liquidation feed from 9 exchanges with a free <a href="/liquidations/by-exchange/">per-venue breakdown</a>, funding rates, open interest, long/short ratio, ETF flows and a whale tracker. No signup, no paywall.',
    intro: 'If you use Coinglass mainly for liquidation maps, funding rates, open interest and the long/short ratio, MarginPad gives you that core set <strong>completely free, with no account</strong> — plus a real-time liquidation feed aggregated from 9 exchanges and a free JSON API for the same data. Coinglass remains the deeper research platform; this page shows exactly what you get free here and what still needs a paid plan there.',
    tableHead: ['Feature', 'MarginPad (free)', 'Coinglass'],
    rows: [
      ['Liquidation map / heatmap', 'Free — real events from exchange websockets + estimated clusters, all coins', 'Free tier limited; advanced heatmaps on paid plans'],
      ['Real-time liquidation feed', 'Free — 9 exchanges (Binance, Bybit, OKX, Hyperliquid, Gate, HTX, dYdX, BitMEX, Bitfinex)', 'Available; depth varies by plan'],
      ['Funding rates scanner', 'Free — 160 USDT-perp markets', 'Free with limits; full history paid'],
      ['Open interest by coin', 'Free — live totals + 24h change', 'Free with limits; granular history paid'],
      ['Long/short ratio', 'Free — 20 majors', 'Free with limits'],
      ['Bitcoin/Ethereum ETF flows', 'Free — daily net flows + AUM per fund', 'Free dashboard available'],
      ['Hyperliquid whale tracker', 'Free — live positions, leverage, liq price, PnL', 'Paid feature'],
      ['Liquidation data API', 'Free JSON API, no key, 60 req/min', 'Paid API plans'],
      ['Deep multi-year history & research tools', 'Not the focus — live data and trading practice', 'Stronger — this is what you pay Coinglass for'],
      ['Price', 'Free, no signup', 'Free tier + paid subscriptions'],
    ],
    afterTable: 'The honest summary: <strong>Coinglass is the better pure-research terminal</strong> — longer history, more exchanges per metric, institutional tooling. <strong>MarginPad is the better free daily driver</strong> — the core derivatives dashboard plus a paper-trading terminal to actually act on what you see, and a keyless API to build with.',
    tools: [
      ['/btc-liquidation-map/', 'BTC Liquidation Map', 'Real events + clusters'],
      ['/rekt/', 'Rekt Feed', 'Every liquidation, live'],
      ['/funding/', 'Funding Rates', '160 markets, live'],
      ['/free-crypto-api/', 'Free API', 'Same data as JSON'],
    ],
    faq: [
      { q: 'Is MarginPad really a free alternative to Coinglass?', a: 'For the core derivatives dashboard — liquidation maps and heatmap, a live liquidation feed, funding rates, open interest, long/short ratio, ETF flows and a Hyperliquid whale tracker — yes, MarginPad is free with no account. Coinglass goes deeper on historical research and multi-exchange granularity, which is what its paid plans are for.' },
      { q: 'Where does MarginPad liquidation data come from?', a: 'MarginPad runs its own collector subscribed to the public liquidation websockets of 9 exchanges (Binance, Bybit, OKX, Hyperliquid, Gate, HTX, dYdX, BitMEX, Bitfinex), and aggregates per-coin 24h totals from Coinglass. Real events and estimates are always labelled separately.' },
      { q: 'Does MarginPad have a free liquidation API?', a: 'Yes — /api/v1/liquidations/recent, /api/v1/liquidations/live and /api/v1/clusters are keyless, CORS-enabled JSON endpoints at 60 requests/minute. Documentation at marginpad.io/free-crypto-api/.' },
      { q: 'What does Coinglass do better?', a: 'Deeper multi-year history, more granular per-exchange breakdowns, options data and institutional research tooling. If you need those, Coinglass paid plans are worth it — MarginPad covers the live day-to-day view for free.' },
    ],
  },
  {
    slug: 'tradingview-paper-trading-alternative',
    title: 'TradingView Paper Trading Alternative with Leverage | MarginPad',
    h1: 'TradingView Paper Trading Alternative (with Real Leverage Mechanics)',
    desc: 'MarginPad paper trading simulates what TradingView paper trading does not: leverage, real liquidation math, funding and per-exchange fees — on live crypto, stock, forex and index prices. Free, no signup.',
    intro: 'TradingView paper trading is great for testing entries and exits, but it does not simulate the mechanics that actually blow up leveraged accounts: <strong>leverage, liquidation prices, funding and taker fees</strong>. MarginPad’s free paper-trading terminal simulates all of them on live prices — crypto futures up to 1000x, plus US stocks, forex, indices and commodities as perpetuals — with no account required.',
    tableHead: ['Feature', 'MarginPad Paper Trade', 'TradingView Paper Trading'],
    rows: [
      ['Leverage simulation', 'Yes — up to 1000x on crypto, per-class caps on stocks/forex', 'No native leverage mechanics'],
      ['Liquidation price & forced closure', 'Yes — real maintenance-margin math, close-confirmed', 'No'],
      ['Funding & trading fees', 'Yes — funding applied, per-exchange fee models', 'No'],
      ['Markets', 'Crypto perps, 20+ US stocks, forex majors, indices, metals — one account', 'Everything TradingView charts'],
      ['Charting depth', 'Multi-chart workspace, 19+ indicators, drawing tools', 'Best-in-class charting — TradingView wins here'],
      ['Signup required', 'No — trades work instantly, account optional for leaderboards', 'TradingView account required'],
      ['Leaderboards, duels, missions, XP', 'Yes — weekly prize leaderboards', 'No'],
      ['Bot / API paper trading', 'Yes — free REST API for bot testing', 'No public paper-trading API'],
      ['Price', 'Free', 'Free with a TradingView account'],
    ],
    afterTable: 'The honest summary: <strong>TradingView is the better charting platform</strong>, full stop. But if the point of paper trading is to rehearse <em>leveraged</em> trading — where liquidation, funding and fees decide outcomes — <strong>MarginPad simulates the parts TradingView leaves out</strong>.',
    tools: [
      ['/paper-trade', 'Paper Trade', 'Live prices, real liq math'],
      ['/stock-trading-simulator/', 'Stock Simulator', 'Apple, Tesla, Nvidia…'],
      ['/forex-trading-simulator/', 'Forex Simulator', 'EUR/USD and majors'],
      ['/trading-api/', 'Bot API', 'Paper-trade via REST'],
    ],
    faq: [
      { q: 'Does TradingView paper trading support leverage?', a: 'TradingView paper trading fills orders at market prices but does not simulate leverage mechanics — there is no liquidation price, no margin call and no funding. MarginPad simulates all three with real maintenance-margin math on live prices.' },
      { q: 'Is MarginPad paper trading really free without an account?', a: 'Yes. You can open leveraged paper positions immediately with no signup. A free account adds sync across devices, the trade journal, leaderboards and weekly prizes.' },
      { q: 'Can I paper trade stocks and forex with leverage on MarginPad?', a: 'Yes — 20+ US stocks, forex majors, stock indices and metals trade as perpetuals with per-class leverage caps and market-hours handling, alongside crypto futures on one account.' },
      { q: 'Can I test a trading bot against MarginPad paper trading?', a: 'Yes — the free Trading API exposes paper-trading endpoints over REST so you can open, manage and close simulated positions programmatically. Docs at marginpad.io/trading-api/.' },
    ],
  },
  {
    slug: 'binance-testnet-alternative',
    title: 'Binance Futures Testnet Alternative — No Account, US-Friendly | MarginPad',
    h1: 'Binance Futures Testnet Alternative',
    desc: 'Practice crypto futures without the Binance testnet hassle: no registration, no geoblock, live real-market prices, real liquidation math, up to 1000x. Works in the US. Free forever.',
    intro: 'The Binance futures testnet requires a registered account, is geoblocked where Binance is (including the US), runs on thin testnet liquidity, and resets balances when it pleases. If what you actually want is to <strong>practice leveraged futures on real live prices</strong>, MarginPad does that in the browser with <strong>no account, from any country</strong> — with real liquidation math, funding and fees simulated.',
    tableHead: ['Feature', 'MarginPad Paper Trade', 'Binance Futures Testnet'],
    rows: [
      ['Registration', 'None — instant', 'Binance testnet account + API keys for bots'],
      ['Works in the US / geoblocked regions', 'Yes — it is a simulator, not an exchange', 'No — follows Binance geoblocking'],
      ['Prices', 'Live real-market prices (Bybit WS + multi-exchange fallback)', 'Testnet order book — thin, often far from real prices'],
      ['Liquidation mechanics', 'Real maintenance-margin math, close-confirmed candles', 'Real engine, but on unrealistic testnet liquidity'],
      ['Markets', 'Crypto perps + US stocks, forex, indices, metals', 'Crypto futures only'],
      ['Order matching realism', 'Simulated fills at live prices — no order book depth', 'Real matching engine — testnet wins here'],
      ['Leaderboards / progression', 'Weekly prize leaderboards, XP, duels, missions', 'None'],
      ['Bot testing API', 'Free REST paper-trading API, no key hoops', 'Testnet API with keys'],
      ['Price', 'Free', 'Free'],
    ],
    afterTable: 'The honest summary: if you are integration-testing an exchange connector, use the real <strong>Binance testnet — its matching engine is the point</strong>. If you are practicing trading itself — entries, leverage, liquidation distance, risk — <strong>MarginPad is faster, US-accessible and runs on real prices</strong>.',
    tools: [
      ['/paper-trade', 'Paper Trade', 'No signup, live prices'],
      ['/calculators', 'Liquidation Calculator', 'Know your exit price'],
      ['/trading-api/', 'Bot API', 'REST paper trading'],
      ['/academy/', 'Academy', '96 free lessons + XP'],
    ],
    faq: [
      { q: 'Does the Binance futures testnet work in the US?', a: 'No — the Binance testnet follows Binance’s geoblocking, so US users cannot register. MarginPad’s paper-trading simulator is not an exchange, so it works from any country with no account.' },
      { q: 'Are MarginPad prices real or testnet prices?', a: 'Real live market prices streamed over exchange websockets with multi-exchange fallback — not testnet liquidity. Liquidations are simulated with real maintenance-margin math and confirmed on candle closes, never on wicks.' },
      { q: 'Can I test a trading bot without Binance testnet API keys?', a: 'Yes — MarginPad’s free Trading API lets bots open and manage paper positions over plain REST. If you specifically need to test Binance order types and matching behaviour, the official testnet is still the right tool.' },
      { q: 'How much leverage can I practice with?', a: 'Up to 1000x on crypto perpetuals (with realistic liquidation distances), and per-class caps on stocks, forex and indices — the same mechanics real exchanges apply.' },
    ],
  },
];

function page(P) {
  const url = `https://marginpad.io/${P.slug}/`;
  const faqLd = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[${P.faq.map(f => `{"@type":"Question","name":${JSON.stringify(f.q)},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(f.a)}}}`).join(',')}]}</script>`;
  const crumbLd = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://marginpad.io/"},{"@type":"ListItem","position":2,"name":${JSON.stringify(P.h1)},"item":"${url}"}]}</script>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${P.title}</title>
<meta name="description" content="${P.desc}" />
<link rel="canonical" href="${url}" />
<meta property="og:title" content="${P.h1}" />
<meta property="og:description" content="${P.desc}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${P.h1}" />
<meta name="twitter:description" content="${P.desc}" />
<meta name="twitter:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Familjen+Grotesk:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/assets/blog.css" />
${faqLd}
${crumbLd}
<style>
.alt-table{width:100%;border-collapse:collapse;margin:14px 0 8px;font-size:14px}
.alt-table th,.alt-table td{padding:9px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:top}
.alt-table th{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.08em;color:#9aa3ad;text-transform:uppercase}
.alt-table td:nth-child(2){color:#c2f64a}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="/paper-trade">Paper Trade</a><a href="/liquidations/">Liquidations</a><a href="/blog/">Blog</a></nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / ${P.h1}</div>
  <article>
    <h1>${P.h1}</h1>
    <div class="meta">Honest comparison · everything on the MarginPad side is free</div>
    <p>${P.intro}</p>
    <h2>Side-by-side</h2>
    <table class="alt-table"><thead><tr>${P.tableHead.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>
${P.rows.map(r => `      <tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('\n')}
    </tbody></table>
    <p>${P.afterTable}</p>
    <h2>FAQ</h2>
    ${P.faq.map(f => `<h3>${f.q}</h3>\n    <p>${f.a}</p>`).join('\n    ')}
    <div class="toolshow">
      <div class="ts-head">Everything free on MarginPad — no signup</div>
      <div class="ts-grid">
${P.tools.map(t => `        <a class="ts-card" href="${t[0]}"><b>${t[1]}</b><small>${t[2]}</small></a>`).join('\n')}
      </div>
    </div>
  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="/paper-trade">Paper Trade</a> · <a href="/liquidations/">Liquidations</a> · <a href="/blog/">Blog</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="/privacy/">Privacy</a></span>
  </footer>
</div>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;
}

let written = 0;
PAGES.forEach(P => {
  const dir = path.join(DIST, P.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(P));
  written++;
});
console.log('wrote', written, 'alternative pages');

const SITEMAP = path.join(DIST, 'sitemap.xml');
if (fs.existsSync(SITEMAP)) {
  let sm = fs.readFileSync(SITEMAP, 'utf8');
  let added = 0;
  PAGES.forEach(P => {
    const loc = `https://marginpad.io/${P.slug}/`;
    if (sm.indexOf(loc) === -1) { sm = sm.replace('</urlset>', `  <url><loc>${loc}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>\n</urlset>`); added++; }
  });
  if (added) { fs.writeFileSync(SITEMAP, sm); console.log('sitemap +', added); }
}
