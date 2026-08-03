/* Generates per-coin SEO landing pages: /<sym>-liquidation-map/ with server-rendered text + a deep link
   into the live interactive map (/?p=heat&coin=SYM). Run: node build/gen-liqmap-pages.js */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');

const COINS = [
  ['BTC', 'Bitcoin'], ['ETH', 'Ethereum'], ['SOL', 'Solana'], ['XRP', 'XRP'], ['DOGE', 'Dogecoin'],
  ['BNB', 'BNB'], ['ADA', 'Cardano'], ['LINK', 'Chainlink'], ['AVAX', 'Avalanche'], ['LTC', 'Litecoin'],
  ['TRX', 'TRON'], ['DOT', 'Polkadot'], ['PEPE', 'Pepe'], ['WIF', 'dogwifhat'], ['SUI', 'Sui'],
  ['HYPE', 'Hyperliquid'], ['SHIB', 'Shiba Inu'], ['NEAR', 'NEAR Protocol'],
];

const faq = (name, sym) => [
  { q: `What is a ${name} liquidation map?`, a: `A ${name} liquidation map shows where leveraged ${sym} positions are being forcibly closed. MarginPad plots real liquidation events from Binance, Bybit and OKX as bubbles on the ${sym} price chart, with a price-level histogram showing where they cluster.` },
  { q: `Is the ${sym} liquidation data real?`, a: `Yes — the bubbles and the right-edge histogram are real liquidation events streamed live from exchange websockets. The optional "Clusters" layer is a model estimated from open-interest changes and assumed leverage, clearly labelled as an estimate.` },
  { q: `How do I read the ${sym} liquidation map?`, a: `Each bubble is one liquidation at a price and time; bigger bubbles are larger positions. Red means longs were liquidated, green means shorts. The histogram on the right shows total liquidations at each price level — the densest bands are where most leverage was wiped out.` },
  { q: `Is the ${name} liquidation map free?`, a: `Yes, it is completely free with no signup. You can switch coins, change the timeframe (1D/1W/1M/1Y), and toggle the real, estimated and theoretical layers.` },
];

function page(sym, name) {
  const url = `https://marginpad.io/${sym.toLowerCase()}-liquidation-map/`;
  const live = `/?p=heat&coin=${sym}`;
  const F = faq(name, sym);
  const faqLd = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[${F.map(f => `{"@type":"Question","name":${JSON.stringify(f.q)},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(f.a)}}}`).join(',')}]}</script>`;
  const crumbLd = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://marginpad.io/"},{"@type":"ListItem","position":2,"name":"${sym} Liquidation Map","item":"${url}"}]}</script>`;
  const desc = `Live ${name} (${sym}) liquidation map: real ${sym} liquidations from Binance, Bybit and OKX as bubbles plus a price-level histogram, with estimated clusters. Free, no signup.`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-18230384038');</script>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${name} (${sym}) Liquidation Map — Live Liquidations | MarginPad</title>
<meta name="description" content="${desc}" />
<meta name="keywords" content="${sym} liquidation map, ${name} liquidations, ${sym} liquidation heatmap, crypto liquidations, ${sym} liquidation levels, liquidation chart" />
<link rel="canonical" href="${url}" />
<meta property="og:title" content="${name} (${sym}) Liquidation Map — Live" />
<meta property="og:description" content="${desc}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${name} (${sym}) Liquidation Map — Live" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Familjen+Grotesk:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/assets/blog.css" />
${faqLd}
${crumbLd}
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="/">Calculators</a><a href="/?p=heat">Heatmap</a><a href="/blog/">Blog</a></nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / ${sym} Liquidation Map</div>
  <article>
    <h1>${name} (${sym}) Liquidation Map</h1>
    <div class="meta">Live liquidation data · Binance · Bybit · OKX</div>
    <p>The ${name} liquidation map shows, in real time, where leveraged ${sym} traders are getting forced out of their positions. Every red bubble is a long liquidation, every green bubble a short — sized by how big the position was — plotted directly on the ${sym} price chart. A histogram on the right edge sums the liquidations at each price level, so you can see at a glance where the bodies are buried.</p>
    <div class="liqmap-cta"><a class="cta" href="${live}">Open the live ${sym} liquidation map →</a></div>
    <h2>What the ${sym} liquidation map shows</h2>
    <p>MarginPad streams real liquidation events from three of the largest perpetual-futures venues — Binance, Bybit and OKX — over public websockets. They are normalized and shown three ways: <strong>bubbles</strong> at the exact price and time of each liquidation, a <strong>price-level histogram</strong> of where ${sym} liquidations cluster, and a scrolling <strong>ticker</strong> of the largest hits. You can switch the timeframe between 1 day, 1 week, 1 month and 1 year.</p>
    <h2>How to read it</h2>
    <p>High-leverage positions liquidate on tiny moves, so they sit close to the current ${sym} price; lower-leverage positions sit further away. Dense histogram bands act like magnets and as support or resistance — once a cluster is consumed, that level often flips. Red (long) clusters sit below price; green (short) clusters sit above. Hover any bubble for the exchange, side, size and time.</p>
    <h2>Real liquidations vs estimated clusters</h2>
    <p>The bubbles and histogram are <strong>real events</strong>. There is also an optional <strong>Clusters</strong> layer — a model that estimates where future ${sym} liquidations are likely to sit, built from open-interest changes and an assumed leverage distribution. It is clearly labelled as an estimate, not exchange order-book data. A third <strong>Levels</strong> layer overlays the classic theoretical liquidation prices by leverage. Toggle any combination.</p>
    <div class="liqmap-cta"><a class="cta" href="${live}">Open the live ${sym} liquidation map →</a></div>
    <h2>How traders use the ${sym} liquidation map</h2>
    <p>Liquidation clusters are where forced orders pile up, and price is drawn toward them like a magnet — a large band of ${sym} long liquidations below spot is fuel for a flush lower, while a wall of short liquidations above is fuel for a squeeze higher. Many traders use the map to (1) avoid entering just above a thick long-liquidation band, (2) anticipate where a cascade might accelerate or exhaust, and (3) place take-profits just ahead of a cluster rather than inside it. It pairs naturally with <a href="/${sym.toLowerCase()}-liquidation-calculator/">${sym} liquidation prices</a> for your own position and the live <a href="/liquidations/${sym.toLowerCase()}/">${sym} 24h liquidation total</a>.</p>
    <p>None of this is a signal on its own — clusters get consumed and levels flip. Treat the map as context, not a trade trigger, and rehearse the idea risk-free on the <a href="/paper-trade?coin=${sym}">${sym} paper-trading terminal</a> before you size up.</p>
    <div class="toolshow">
      <div class="ts-head">Everything free on MarginPad — no signup</div>
      <div class="ts-grid">
        <a class="ts-card" href="/#liq"><b>Liquidation Calculator</b><small>Know your exit price</small></a>
        <a class="ts-card" href="/?p=heat"><b>Liquidation Heatmap</b><small>All coins, live</small></a>
        <a class="ts-card" href="/?p=swap"><b>Crypto Swap</b><small>900+ coins, no account</small></a>
        <a class="ts-card" href="/blog/how-to-read-a-liquidation-heatmap/"><b>Guide</b><small>How to read a liquidation map</small></a>
      </div>
    </div>
  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="/">Calculators</a> · <a href="/?p=heat">Heatmap</a> · <a href="/blog/">Blog</a></span>
  </footer>
</div>
</body>
</html>
`;
}

let written = 0;
COINS.forEach(([sym, name]) => {
  const dir = path.join(DIST, `${sym.toLowerCase()}-liquidation-map`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(sym, name));
  written++;
});
console.log('wrote', written, 'liquidation-map landing pages');

// add to sitemap
const SITEMAP = path.join(DIST, 'sitemap.xml');
if (fs.existsSync(SITEMAP)) {
  let sm = fs.readFileSync(SITEMAP, 'utf8');
  COINS.forEach(([sym]) => {
    const loc = `https://marginpad.io/${sym.toLowerCase()}-liquidation-map/`;
    if (sm.indexOf(loc) === -1) sm = sm.replace('</urlset>', `  <url><loc>${loc}</loc><lastmod>2026-06-12</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>\n</urlset>`);
  });
  fs.writeFileSync(SITEMAP, sm);
  console.log('sitemap updated');
}
