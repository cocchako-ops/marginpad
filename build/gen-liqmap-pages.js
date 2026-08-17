/* Generates per-coin SEO landing pages: /<sym>-liquidation-map/ with server-rendered text + a deep link
   into the live interactive map (/heatmap?coin=SYM). Run: node build/gen-liqmap-pages.js */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');

const COINS = [
  ['BTC', 'Bitcoin'], ['ETH', 'Ethereum'], ['SOL', 'Solana'], ['XRP', 'XRP'], ['DOGE', 'Dogecoin'],
  ['BNB', 'BNB'], ['ADA', 'Cardano'], ['LINK', 'Chainlink'], ['AVAX', 'Avalanche'], ['LTC', 'Litecoin'],
  ['TRX', 'TRON'], ['DOT', 'Polkadot'], ['PEPE', 'Pepe'], ['WIF', 'dogwifhat'], ['SUI', 'Sui'],
  ['HYPE', 'Hyperliquid'], ['SHIB', 'Shiba Inu'], ['NEAR', 'NEAR Protocol'],
  // +14 (2026-08-16 SEO kompas: alt-coin map SERPs are soft — even X posts rank; every new slug auto-gets the SSR live block via the /*-liquidation-map/* middle-glob)
  ['TON', 'Toncoin'], ['ATOM', 'Cosmos'], ['APT', 'Aptos'], ['ARB', 'Arbitrum'], ['OP', 'Optimism'],
  ['INJ', 'Injective'], ['SEI', 'Sei'], ['FIL', 'Filecoin'], ['UNI', 'Uniswap'], ['AAVE', 'Aave'],
  ['BONK', 'Bonk'], ['FLOKI', 'Floki'], ['ORDI', 'ORDI'], ['TAO', 'Bittensor'],
];

// Build-time snapshot of OUR OWN measurements, so every map page carries per-coin substance instead of
// the same templated prose with the ticker swapped. Regenerate with scratchpad/liqmap_percoin.py.
function usdShort(v){v=+v||0;if(v>=1e9)return '$'+(v/1e9).toFixed(2)+' billion';if(v>=1e6)return '$'+(v/1e6).toFixed(1)+' million';if(v>=1e3)return '$'+Math.round(v/1e3)+'K';return '$'+Math.round(v);}
const SNAP = {'1000BONK':{oi:6961475,share:0.0,b:'thin',liq:0},'1000PEPE':{oi:35319042,share:0.1,b:'thin',liq:1144042},'1000RATS':{oi:3922595,share:0.0,b:'thin',liq:0},'AAPL':{oi:4319667,share:0.0,b:'thin',liq:0},'AAVE':{oi:39088618,share:0.1,b:'thin',liq:0},'ACE':{oi:4131809,share:0.0,b:'thin',liq:611828},'ADA':{oi:360046540,share:1.3,b:'thin',liq:564113},'AERO':{oi:7681327,share:0.0,b:'thin',liq:0},'AKE':{oi:26210512,share:0.1,b:'thin',liq:0},'ALGO':{oi:5692699,share:0.0,b:'thin',liq:0},'ALLO':{oi:4024208,share:0.0,b:'thin',liq:0},'AMZN':{oi:4302989,share:0.0,b:'thin',liq:0},'APR':{oi:3568953,share:0.0,b:'thin',liq:1712258},'APT':{oi:74816768,share:0.3,b:'thin',liq:0},'ARB':{oi:76744409,share:0.3,b:'thin',liq:0},'ARC':{oi:3368091,share:0.0,b:'thin',liq:0},'ASTER':{oi:40234463,share:0.1,b:'thin',liq:0},'ATOM':{oi:14660478,share:0.1,b:'thin',liq:0},'AVAX':{oi:210755660,share:0.7,b:'thin',liq:0},'BAN':{oi:3631469,share:0.0,b:'thin',liq:0},'BANK':{oi:4168712,share:0.0,b:'thin',liq:0},'BCH':{oi:28294974,share:0.1,b:'thin',liq:0},'BEAT':{oi:4426063,share:0.0,b:'thin',liq:732620},'BICO':{oi:3509382,share:0.0,b:'thin',liq:0},'BLESS':{oi:3333574,share:0.0,b:'thin',liq:0},'BNB':{oi:765332313,share:2.7,b:'thin',liq:0},'BSB':{oi:3230125,share:0.0,b:'thin',liq:0},'BTC':{oi:28447797857,share:100.0,b:'deep',liq:27203789},'BTW':{oi:19704448,share:0.1,b:'thin',liq:1404963},'BZ':{oi:6395217,share:0.0,b:'thin',liq:0},'CAP':{oi:9526690,share:0.0,b:'thin',liq:0},'CASHCAT':{oi:4961593,share:0.0,b:'thin',liq:0},'CC':{oi:6243787,share:0.0,b:'thin',liq:0},'CHIP':{oi:6808700,share:0.0,b:'thin',liq:704125},'CL':{oi:21535011,share:0.1,b:'thin',liq:0},'COIN':{oi:3889123,share:0.0,b:'thin',liq:0},'COTI':{oi:3271891,share:0.0,b:'thin',liq:0},'COW':{oi:3883594,share:0.0,b:'thin',liq:0},'CRCL':{oi:10891358,share:0.0,b:'thin',liq:0},'CRV':{oi:16890216,share:0.1,b:'thin',liq:0},'CYS':{oi:4349321,share:0.0,b:'thin',liq:1223353},'DASH':{oi:3417473,share:0.0,b:'thin',liq:0},'DEXE':{oi:3293652,share:0.0,b:'thin',liq:0},'DOGE':{oi:998169110,share:3.5,b:'mid',liq:966825},'DOT':{oi:141690343,share:0.5,b:'thin',liq:0},'DRAM':{oi:6803756,share:0.0,b:'thin',liq:0},'DYDX':{oi:3866816,share:0.0,b:'thin',liq:0},'EIGEN':{oi:4684936,share:0.0,b:'thin',liq:0},'ENA':{oi:37594555,share:0.1,b:'thin',liq:0},'ENS':{oi:3275967,share:0.0,b:'thin',liq:0},'ESPORTS':{oi:3212692,share:0.0,b:'thin',liq:0},'ETC':{oi:8947841,share:0.0,b:'thin',liq:0},'ETH':{oi:16582900670,share:58.3,b:'deep',liq:24243842},'ETHBTC':{oi:3286669,share:0.0,b:'thin',liq:0},'ETHFI':{oi:12438969,share:0.0,b:'thin',liq:0},'EWY':{oi:5046661,share:0.0,b:'thin',liq:0},'FARTCOIN':{oi:21215297,share:0.1,b:'thin',liq:0},'FF':{oi:8566636,share:0.0,b:'thin',liq:0},'FIL':{oi:8215164,share:0.0,b:'thin',liq:688160},'GALA':{oi:4349495,share:0.0,b:'thin',liq:0},'GOOGL':{oi:9231477,share:0.0,b:'thin',liq:0},'GPS':{oi:3444457,share:0.0,b:'thin',liq:1033314},'GRAM':{oi:21499568,share:0.1,b:'thin',liq:0},'GRASS':{oi:12638275,share:0.0,b:'thin',liq:0},'GRVT':{oi:3610696,share:0.0,b:'thin',liq:0},'H':{oi:12315968,share:0.0,b:'thin',liq:648239},'HBAR':{oi:14455618,share:0.1,b:'thin',liq:0},'HOLO':{oi:3272632,share:0.0,b:'thin',liq:0},'HOME':{oi:5598753,share:0.0,b:'thin',liq:0},'HYPE':{oi:236801752,share:0.8,b:'thin',liq:1992533},'ICP':{oi:12752385,share:0.0,b:'thin',liq:0},'INJ':{oi:82913306,share:0.3,b:'thin',liq:0},'INTC':{oi:8653780,share:0.0,b:'thin',liq:0},'JTO':{oi:4665893,share:0.0,b:'thin',liq:0},'JUP':{oi:8646248,share:0.0,b:'thin',liq:0},'KAITO':{oi:6178447,share:0.0,b:'thin',liq:0},'KAS':{oi:4811107,share:0.0,b:'thin',liq:0},'KORU':{oi:7132071,share:0.0,b:'thin',liq:0},'LAB':{oi:5357826,share:0.0,b:'thin',liq:0},'LDO':{oi:11509494,share:0.0,b:'thin',liq:0},'LINK':{oi:533092850,share:1.9,b:'thin',liq:0},'LIT':{oi:30914701,share:0.1,b:'thin',liq:0},'LTC':{oi:260203998,share:0.9,b:'thin',liq:0},'M':{oi:4053514,share:0.0,b:'thin',liq:0},'MEGA':{oi:3640439,share:0.0,b:'thin',liq:0},'MET':{oi:4138602,share:0.0,b:'thin',liq:0},'META':{oi:4101069,share:0.0,b:'thin',liq:0},'MMT':{oi:3171275,share:0.0,b:'thin',liq:0},'MNT':{oi:28164112,share:0.1,b:'thin',liq:0},'MON':{oi:11491500,share:0.0,b:'thin',liq:0},'MORPHO':{oi:5928379,share:0.0,b:'thin',liq:0},'MRVL':{oi:6848242,share:0.0,b:'thin',liq:0},'MSFT':{oi:11160654,share:0.0,b:'thin',liq:0},'MSTR':{oi:5607579,share:0.0,b:'thin',liq:0},'MU':{oi:18860957,share:0.1,b:'thin',liq:1207756},'MUU':{oi:3405854,share:0.0,b:'thin',liq:0},'NBIS':{oi:8814633,share:0.0,b:'thin',liq:0},'NEAR':{oi:276136660,share:1.0,b:'thin',liq:0},'NVDA':{oi:7195690,share:0.0,b:'thin',liq:0},'ONDO':{oi:36466551,share:0.1,b:'thin',liq:0},'OP':{oi:45516232,share:0.2,b:'thin',liq:0},'PAXG':{oi:21321805,share:0.1,b:'thin',liq:0},'PENDLE':{oi:7453019,share:0.0,b:'thin',liq:0},'PENGU':{oi:14995917,share:0.1,b:'thin',liq:0},'PIEVERSE':{oi:6229064,share:0.0,b:'thin',liq:0},'PIPPIN':{oi:3901838,share:0.0,b:'thin',liq:0},'POL':{oi:11465639,share:0.0,b:'thin',liq:0},'POPCAT':{oi:5899076,share:0.0,b:'thin',liq:0},'PORTAL':{oi:3182725,share:0.0,b:'thin',liq:1691830},'PRL':{oi:3781483,share:0.0,b:'thin',liq:0},'PUMPFUN':{oi:33384620,share:0.1,b:'thin',liq:0},'PYTH':{oi:5953473,share:0.0,b:'thin',liq:0},'QQQ':{oi:9079143,share:0.0,b:'thin',liq:0},'RENDER':{oi:6807123,share:0.0,b:'thin',liq:0},'RIVER':{oi:3473996,share:0.0,b:'thin',liq:0},'SAMSUNG':{oi:5516553,share:0.0,b:'thin',liq:0},'SEI':{oi:7159216,share:0.0,b:'thin',liq:0},'SHIB1000':{oi:9087602,share:0.0,b:'thin',liq:0},'SKHY':{oi:22839309,share:0.1,b:'thin',liq:0},'SKHYNIX':{oi:29895629,share:0.1,b:'thin',liq:1246852},'SKY':{oi:5098733,share:0.0,b:'thin',liq:0},'SNDK':{oi:61468848,share:0.2,b:'thin',liq:13595434},'SNXX':{oi:7069882,share:0.0,b:'thin',liq:1220736},'SOL':{oi:3638867094,share:12.8,b:'mid',liq:6014354},'SOXL':{oi:35124762,share:0.1,b:'thin',liq:0},'SPCX':{oi:58886418,share:0.2,b:'thin',liq:1068152},'SPX':{oi:6111477,share:0.0,b:'thin',liq:0},'SPY':{oi:4776714,share:0.0,b:'thin',liq:0},'STABLE':{oi:3235862,share:0.0,b:'thin',liq:0},'STRK':{oi:5526802,share:0.0,b:'thin',liq:0},'SUI':{oi:464579770,share:1.6,b:'thin',liq:0},'TAO':{oi:33868674,share:0.1,b:'thin',liq:0},'TIA':{oi:36942891,share:0.1,b:'thin',liq:0},'TQQQ':{oi:3202180,share:0.0,b:'thin',liq:0},'TRB':{oi:4199123,share:0.0,b:'thin',liq:0},'TRIA':{oi:3208816,share:0.0,b:'thin',liq:0},'TRUMP':{oi:15196663,share:0.1,b:'thin',liq:0},'TRX':{oi:201951363,share:0.7,b:'thin',liq:0},'TSLA':{oi:11332283,share:0.0,b:'thin',liq:0},'TWT':{oi:3308406,share:0.0,b:'thin',liq:0},'UNI':{oi:214973320,share:0.8,b:'thin',liq:0},'US':{oi:4814236,share:0.0,b:'thin',liq:0},'USDC':{oi:10962244,share:0.0,b:'thin',liq:0},'USELESS':{oi:3695129,share:0.0,b:'thin',liq:0},'VELVET':{oi:4295439,share:0.0,b:'thin',liq:0},'VIRTUAL':{oi:12451452,share:0.0,b:'thin',liq:0},'VVV':{oi:8520925,share:0.0,b:'thin',liq:0},'WIF':{oi:9493956,share:0.0,b:'thin',liq:0},'WLD':{oi:51424500,share:0.2,b:'thin',liq:1080027},'WLFI':{oi:27728797,share:0.1,b:'thin',liq:0},'XAG':{oi:40785459,share:0.1,b:'thin',liq:549821},'XAU':{oi:110755150,share:0.4,b:'thin',liq:1319331},'XAUT':{oi:144827634,share:0.5,b:'thin',liq:0},'XLM':{oi:30694085,share:0.1,b:'thin',liq:0},'XMR':{oi:22747353,share:0.1,b:'thin',liq:0},'XPL':{oi:19954082,share:0.1,b:'thin',liq:0},'XRP':{oi:2012082264,share:7.1,b:'mid',liq:2142286},'ZEC':{oi:80278041,share:0.3,b:'thin',liq:2456477},'ZEREBRO':{oi:7764525,share:0.0,b:'thin',liq:0},'ZRO':{oi:11709914,share:0.0,b:'thin',liq:0}};
// Some venues list these only as 1000-denominated contracts, so the OI feed keys them differently.
const SNAP_ALIAS = { PEPE: '1000PEPE', BONK: '1000BONK', SHIB: 'SHIB1000' };
const snapOf = (s) => SNAP[s] || SNAP[SNAP_ALIAS[s]] || null;
const SNAP_N = Object.keys(SNAP).length;
const SNAP_TOTSHARE = (function(){ var t = 0; for (var k in SNAP) t += SNAP[k].oi; return t > 0 && SNAP.BTC ? Math.round(SNAP.BTC.oi / t * 100) : 0; })();
const SNAP_DATE = '17 August 2026';
const faq = (name, sym) => [
  { q: `What is a ${name} liquidation map?`, a: `A ${name} liquidation map shows where leveraged ${sym} positions are being forcibly closed. MarginPad plots real liquidation events from Binance, Bybit and OKX as bubbles on the ${sym} price chart, with a price-level histogram showing where they cluster.` },
  { q: `Is the ${sym} liquidation data real?`, a: `Yes — the bubbles and the right-edge histogram are real liquidation events streamed live from exchange websockets. The optional "Clusters" layer is a model estimated from open-interest changes and assumed leverage, clearly labelled as an estimate.` },
  { q: `How do I read the ${sym} liquidation map?`, a: `Each bubble is one liquidation at a price and time; bigger bubbles are larger positions. Red means longs were liquidated, green means shorts. The histogram on the right shows total liquidations at each price level — the densest bands are where most leverage was wiped out.` },
  { q: `Is the ${name} liquidation map free?`, a: `Yes, it is completely free with no signup. You can switch coins, change the timeframe (1D/1W/1M/1Y), and toggle the real, estimated and theoretical layers.` },
];

function page(sym, name) {
  const url = `https://marginpad.io/${sym.toLowerCase()}-liquidation-map/`;
  const live = `/heatmap?coin=${sym}`;
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
<title>${name} (${sym}) Liquidation Map — Live, Free, No Login | MarginPad</title>
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
    <nav class="nav"><a href="/calculators">Calculators</a><a href="/heatmap">Heatmap</a><a href="/blog/">Blog</a></nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / ${sym} Liquidation Map</div>
  <article>
    <h1>${name} (${sym}) Liquidation Map</h1>
    <div class="meta">Live liquidation data · Binance · Bybit · OKX</div>
    <p><strong>What this is:</strong> a free ${name} liquidation map with no login and no paywall — it shows, in real time, where leveraged ${sym} traders are getting forced out of their positions and where the next clusters sit relative to the current price. Every red bubble is a long liquidation, every green bubble a short — sized by how big the position was — plotted directly on the ${sym} price chart. A histogram on the right edge sums the liquidations at each price level, so you can see at a glance where the bodies are buried.</p>
    <div class="liqmap-cta"><a class="cta" href="${live}">Open the live ${sym} liquidation map →</a></div>
    <h2>What the ${sym} liquidation map shows</h2>
    <p>MarginPad streams real liquidation events from three of the largest perpetual-futures venues — Binance, Bybit and OKX — over public websockets. They are normalized and shown three ways: <strong>bubbles</strong> at the exact price and time of each liquidation, a <strong>price-level histogram</strong> of where ${sym} liquidations cluster, and a scrolling <strong>ticker</strong> of the largest hits. You can switch the timeframe between 1 day, 1 week, 1 month and 1 year.</p>
    <h2>How to read it</h2>
    <p>High-leverage positions liquidate on tiny moves, so they sit close to the current ${sym} price; lower-leverage positions sit further away. Dense histogram bands act like magnets and as support or resistance — once a cluster is consumed, that level often flips. Red (long) clusters sit below price; green (short) clusters sit above. Hover any bubble for the exchange, side, size and time.</p>
    <h2>Real liquidations vs estimated clusters</h2>
    <p>The bubbles and histogram are <strong>real events</strong>. There is also an optional <strong>Clusters</strong> layer — a model that estimates where future ${sym} liquidations are likely to sit, built from open-interest changes and an assumed leverage distribution. It is clearly labelled as an estimate, not exchange order-book data. A third <strong>Levels</strong> layer overlays the classic theoretical liquidation prices by leverage. Toggle any combination.</p>
    <div class="liqmap-cta"><a class="cta" href="${live}">Open the live ${sym} liquidation map →</a></div>
    ${(function(){var d=snapOf(sym);if(!d)return '';
      var depth = d.b==='deep' ? `${sym} is one of the deepest perpetual markets there is, and a map on a book this size behaves differently from a small-cap one: it takes real size to push price through a cluster, so bands tend to be consumed gradually rather than in one sweep.`
        : d.b==='mid' ? `${sym} sits in the middle of the depth range — liquid enough that clusters do not evaporate on a single order, thin enough that a determined move can run several bands in a row. This is the size where cascades are most readable on a map.`
        : `${sym} is a thin market by open-interest standards, and that changes how you read this map: the same dollar flow moves price much further than it would on a major, so clusters sit closer together and get taken out in fast, violent sequences rather than one at a time.`;
      var liqLine = d.liq > 0 ? ` Over the 24 hours before that snapshot, ${usdShort(d.liq)} of ${sym} positions were liquidated.` : '';
      return `<h2>How deep is the ${sym} perpetual market?</h2>\n    <p>When this page was last rebuilt (${SNAP_DATE}), ${sym} perpetuals carried <strong>${usdShort(d.oi)}</strong> of open interest — ${sym === 'BTC' ? `<strong>${SNAP_TOTSHARE}%</strong> of all open interest across the ${SNAP_N} perpetual markets we track` : `${d.share < 0.1 ? `under <strong>0.1%</strong> of Bitcoin's` : `about <strong>${d.share.toFixed(1)}%</strong> of Bitcoin's`}`}.${liqLine} Those figures are a snapshot; the live box at the top of this page always shows the current ones.</p>\n    <p>${depth}</p>`;})()}
    <h2>How traders use the ${sym} liquidation map</h2>
    <p>Liquidation clusters are where forced orders pile up, and price is drawn toward them like a magnet — a large band of ${sym} long liquidations below spot is fuel for a flush lower, while a wall of short liquidations above is fuel for a squeeze higher. Many traders use the map to (1) avoid entering just above a thick long-liquidation band, (2) anticipate where a cascade might accelerate or exhaust, and (3) place take-profits just ahead of a cluster rather than inside it. It pairs naturally with <a href="/${sym.toLowerCase()}-liquidation-calculator/">${sym} liquidation prices</a> for your own position and the live <a href="/liquidations/${sym.toLowerCase()}/">${sym} 24h liquidation total</a>.</p>
    <p>None of this is a signal on its own — clusters get consumed and levels flip. Treat the map as context, not a trade trigger, and rehearse the idea risk-free on the <a href="/paper-trade?coin=${sym}">${sym} paper-trading terminal</a> before you size up.</p>
    <div class="toolshow">
      <div class="ts-head">Everything free on MarginPad — no signup</div>
      <div class="ts-grid">
        <a class="ts-card" href="/calculators?c=liq"><b>Liquidation Calculator</b><small>Know your exit price</small></a>
        <a class="ts-card" href="/heatmap"><b>Liquidation Heatmap</b><small>All coins, live</small></a>
        <a class="ts-card" href="/swap"><b>Crypto Swap</b><small>900+ coins, no account</small></a>
        <a class="ts-card" href="/blog/how-to-read-a-liquidation-heatmap/"><b>Guide</b><small>How to read a liquidation map</small></a>
      </div>
    </div>
  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="/">Calculators</a> · <a href="/heatmap">Heatmap</a> · <a href="/blog/">Blog</a></span>
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
