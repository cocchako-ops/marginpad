/* "Best crypto exchange for X" high-intent affiliate landing pages.
   Now multilingual: English at /<slug>/ plus 12 translated variants at /<lang>/<slug>/
   (hreflang cross-linked). Translations in build/data/bestfor-i18n.js (chrome) +
   build/data/bestfor-cases-i18n.js (per-case). Run: node build/gen-bestfor-pages.js */
const VDATE = new Date().toISOString().slice(0, 10);
const fs = require('fs');
const path = require('path');
const { SHARED } = require('./data/bestfor-i18n');
const { CASES: CASE_TR } = require('./data/bestfor-cases-i18n');
const { KNOWN } = require('./data/compare-i18n');
const { FEEC_CSS, feeWidget } = require('./data/feecalc-i18n');
const OUT = path.join(__dirname, '..', 'dist');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const LANG_CODES = ['de', 'es', 'pt', 'fr', 'nl', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id'];
const RTL = { ar: 1 };
function fill(str, map) { return str.replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m)); }

// English chrome baseline (token templates), so every language uses the same builder.
const EN_SHARED = {
  tagBest: 'Top pick', openCta: 'Open {X} account →', offers: '{A} offers {WHY}.',
  thExchange: 'Exchange', thMaxLev: 'Max lev', thMaker: 'Maker', thTaker: 'Taker', thKnown: 'Best known for',
  h2cmp: 'Side-by-side comparison', h2rank: 'How we rank',
  rankP: 'We weight the factors that matter for this use case — here, primarily <strong>{METRIC}</strong> — alongside liquidity, reliability and overall trader experience. Fees and leverage caps vary by contract, region and account tier, so always confirm on the exchange. Before you size a trade, check exactly where it would be wiped with the <a href="/calculators?c=liq">liquidation calculator</a> and practice risk-free in <a href="/paper-trade">Paper Trade</a>.',
  updated: 'Updated for 2026. Links are referral links — see disclosure below.',
  relBeginners: 'For beginners', relLowFee: 'Lowest fees', relHighLev: 'Highest leverage', relAlt: 'For altcoins', relDay: 'For day trading',
  disclosure: 'Disclosure: the exchange links above are referral links. If you sign up through them MarginPad may earn a commission at no extra cost to you — it keeps the tools free. Not financial advice; trade at your own risk.',
  faqFreeQ: 'Are these exchanges free to use?',
  faqFreeA: 'Yes — opening an account is free on all of them; you only pay trading fees when you trade. The links here are referral links that support MarginPad at no cost to you.',
  faqTopA: 'Our top pick is {TOP}, which offers {TOPWHY}. Runners-up are {R1} and {R2}.',
  mLev: 'Max leverage', mTaker: 'Taker fee',
  navCalc: 'Calculators', navBlog: 'Blog', navGloss: 'Glossary', crumbHome: 'Home',
};
const EN_KNOWN = { bybit: 'a fast matching engine and deep USDT-perpetual liquidity', binance: 'the largest volume and the widest range of futures pairs', okx: 'a powerful pro interface and a unified account model', kucoin: 'a huge altcoin futures selection', kraken: 'security and long-standing trust' };

const EX = {
  bybit:   { name: 'Bybit',   ref: 'https://www.bybit.com/invite?ref=LZKBERJ',     lev: 100, mmr: 0.5, maker: 0.02, taker: 0.055, accent: '#f7a600', fg: '#0a0b0d', known: 'a fast matching engine and deep USDT-perp liquidity' },
  binance: { name: 'Binance', ref: 'https://www.binance.com/register?ref=MAOZM9DS', lev: 125, mmr: 0.4, maker: 0.02, taker: 0.04,  accent: '#f0b90b', fg: '#181a20', known: 'the largest volume and the widest range of futures pairs' },
  okx:     { name: 'OKX',     ref: 'https://okx.com/join/96160298',                 lev: 125, mmr: 0.5, maker: 0.02, taker: 0.05,  accent: '#cfd3d8', fg: '#0a0b0d', known: 'a powerful pro interface and a unified account model' },
  kucoin:  { name: 'KuCoin',  ref: 'https://www.kucoin.com/r/rf/VHP8AYKY',          lev: 100, mmr: 0.5, maker: 0.02, taker: 0.06,  accent: '#23af91', fg: '#06231d', known: 'a huge altcoin futures selection' },
  kraken:  { name: 'Kraken',  ref: 'https://invite.kraken.com/JDNW/guj2tf28',       lev: 50,  mmr: 0.5, maker: 0.02, taker: 0.05,  accent: '#7b5cff', fg: '#ffffff', known: 'security and long-standing trust' },
};

const CASES = [
  { slug: 'best-crypto-exchange-for-beginners', title: 'Best Crypto Exchange for Beginners (2026)', h1: 'Best crypto exchange for beginners',
    intro: 'New to leverage? You want a clean interface, fair fees and deep liquidity so your first trades fill well — without a wall of pro tools in the way. Here are the best beginner-friendly futures exchanges, ranked.',
    rank: ['bybit', 'okx', 'kucoin', 'binance', 'kraken'], metricKey: 'lev', metric: 'Max leverage', fmt: v => v + '×',
    why: { bybit: 'the cleanest, least intimidating interface of the majors, with deep liquidity so your first trades fill at a fair price', okx: 'a simple mode alongside its pro tools and a unified account that is easy to follow', kucoin: 'easy onboarding and a huge coin selection once you find your feet', binance: 'the deepest markets, though the interface can overwhelm a first-timer', kraken: 'a strong reputation for security and support if trust matters most' },
    kw: 'best crypto exchange for beginners, beginner futures exchange, easiest crypto exchange, best exchange to start trading' },
  { slug: 'lowest-fee-crypto-exchange', title: 'Lowest-Fee Crypto Futures Exchange (2026)', h1: 'Lowest-fee crypto futures exchange',
    intro: 'Fees compound fast when you trade often. This ranking is by standard taker fee on USDT perpetuals — before VIP tiers or token discounts.',
    rank: ['binance', 'bybit', 'okx', 'kraken', 'kucoin'], metricKey: 'taker', metric: 'Taker fee', fmt: v => v + '%',
    why: { binance: 'the lowest standard taker fee of the majors at 0.04%, before VIP or BNB discounts', bybit: 'very competitive fees plus a fast engine, so slippage stays low too', okx: 'low fees with maker rebates at higher tiers', kraken: 'mid-pack fees but unmatched trust', kucoin: 'slightly higher taker fees, offset by frequent promos' },
    kw: 'lowest fee crypto exchange, cheapest crypto futures, low fee futures exchange, crypto exchange fee comparison' },
  { slug: 'highest-leverage-crypto-exchange', title: 'Highest-Leverage Crypto Exchange (2026)', h1: 'Highest-leverage crypto exchange',
    intro: 'Some venues offer up to 125× on majors. Higher leverage means a tiny move can liquidate you — always check your liquidation price first. Ranked by maximum leverage.',
    rank: ['binance', 'okx', 'bybit', 'kucoin', 'kraken'], metricKey: 'lev', metric: 'Max leverage', fmt: v => v + '×',
    why: { binance: 'up to 125× on BTC and ETH with the deepest liquidity to back it', okx: '125× on majors with pro-grade order types', bybit: '100× on majors with a fast, reliable engine', kucoin: '100× across a wide altcoin list', kraken: 'a conservative 50× cap, favouring safety over extremes' },
    kw: 'highest leverage crypto exchange, 125x crypto exchange, max leverage futures, high leverage trading' },
  { slug: 'best-crypto-exchange-for-altcoins', title: 'Best Crypto Exchange for Altcoin Futures (2026)', h1: 'Best crypto exchange for altcoin futures',
    intro: 'Trading smaller caps? You want the widest perpetual selection and enough liquidity to get filled. Ranked for altcoin coverage.',
    rank: ['kucoin', 'binance', 'bybit', 'okx', 'kraken'], metricKey: 'lev', metric: 'Max leverage', fmt: v => v + '×',
    why: { kucoin: 'one of the largest altcoin futures selections anywhere — new listings arrive fast', binance: 'the widest deep-liquidity perp range among the top venues', bybit: 'a growing altcoin list with tight spreads on the popular names', okx: 'solid altcoin coverage with a clean pro interface', kraken: 'a narrower list focused on the larger caps' },
    kw: 'best exchange for altcoins, altcoin futures exchange, best altcoin perpetuals, altcoin leverage trading' },
  { slug: 'best-crypto-exchange-for-day-trading', title: 'Best Crypto Exchange for Day Trading (2026)', h1: 'Best crypto exchange for day trading',
    intro: 'Active intraday trading rewards low fees, a fast matching engine and deep books. Ranked for day traders and scalpers.',
    rank: ['bybit', 'binance', 'okx', 'kucoin', 'kraken'], metricKey: 'taker', metric: 'Taker fee', fmt: v => v + '%',
    why: { bybit: 'a fast matching engine plus low fees — built for high order volume', binance: 'the deepest books, so large orders move price the least', okx: 'advanced order types for precise entries and exits', kucoin: 'plenty of pairs to rotate through during the day', kraken: 'reliable, but lower leverage and fewer perps' },
    kw: 'best exchange for day trading crypto, day trading futures exchange, best scalping exchange, intraday crypto trading' },
  { slug: 'best-crypto-futures-exchange', title: 'Best Crypto Futures Exchange (2026)', h1: 'Best crypto futures exchange',
    intro: 'The best all-round futures venue balances deep liquidity, low fees, high leverage and a fast, reliable engine. Here are the top crypto futures exchanges for 2026, ranked overall.',
    rank: ['bybit', 'binance', 'okx', 'kucoin', 'kraken'], metricKey: 'lev', metric: 'Max leverage', fmt: v => v + '×',
    why: { bybit: 'the best all-round package — a fast engine, deep USDT-perp liquidity and low fees in a clean interface', binance: 'the largest volume and the widest pair list, with 125× on the majors', okx: 'pro-grade tools and a unified account, with strong liquidity across the board', kucoin: 'a huge altcoin futures range for traders who rotate beyond the majors', kraken: 'a trusted, security-first venue, though with lower leverage and fewer perps' },
    kw: 'best crypto futures exchange, best perpetual exchange, top crypto futures platform, best leverage trading exchange' },
  { slug: 'best-crypto-exchange-for-scalping', title: 'Best Crypto Exchange for Scalping (2026)', h1: 'Best crypto exchange for scalping',
    intro: 'Scalping lives or dies on fees, fill speed and order-book depth — a slow engine or a wide spread eats a high-frequency edge alive. Ranked by taker fee, the cost that matters most when you trade dozens of times a day.',
    rank: ['binance', 'bybit', 'okx', 'kraken', 'kucoin'], metricKey: 'taker', metric: 'Taker fee', fmt: v => v + '%',
    why: { binance: 'the lowest standard taker fee of the majors and the deepest books, so rapid entries barely move price', bybit: 'a famously fast matching engine plus low fees — purpose-built for high order volume', okx: 'advanced order types and tight spreads for precise scalps', kraken: 'reliable execution, though with higher fees and lower leverage', kucoin: 'plenty of pairs to scalp, with slightly higher taker fees' },
    kw: 'best exchange for scalping crypto, scalping futures exchange, fastest crypto exchange, low fee scalping' },
  { slug: 'best-crypto-exchange-for-bitcoin-futures', title: 'Best Crypto Exchange for Bitcoin Futures (2026)', h1: 'Best exchange for Bitcoin futures',
    intro: 'Trading BTC perpetuals rewards the deepest liquidity and tightest spreads so size fills cleanly. Ranked for Bitcoin futures.',
    rank: ['binance', 'bybit', 'okx', 'kucoin', 'kraken'], metricKey: 'lev', metric: 'Max leverage', fmt: v => v + '×',
    why: { binance: 'the deepest BTC perpetual book anywhere, with up to 125× and razor-tight spreads', bybit: 'extremely deep BTCUSDT liquidity and a fast engine at 100× on Bitcoin', okx: '125× on BTC with pro order types and a unified margin account', kucoin: 'solid BTC liquidity alongside its huge altcoin list', kraken: 'a trusted home for Bitcoin with a conservative 50× cap' },
    kw: 'best exchange for bitcoin futures, btc perpetual exchange, bitcoin leverage trading, best btc futures platform' },
  { slug: 'best-crypto-exchange-for-ethereum-futures', title: 'Best Crypto Exchange for Ethereum Futures (2026)', h1: 'Best exchange for Ethereum futures',
    intro: 'ETH perpetuals are among the most liquid markets in crypto. The best venue gives you tight spreads and deep books so size fills without slippage. Ranked for Ethereum futures.',
    rank: ['binance', 'bybit', 'okx', 'kucoin', 'kraken'], metricKey: 'lev', metric: 'Max leverage', fmt: v => v + '×',
    why: { binance: 'the deepest ETH perpetual liquidity with up to 125× and tight spreads', bybit: 'very deep ETHUSDT books and a fast engine at 100×', okx: '125× on ETH with a unified margin account and pro tools', kucoin: 'reliable ETH liquidity alongside a vast altcoin list', kraken: 'a trusted venue for Ethereum with a 50× cap' },
    kw: 'best exchange for ethereum futures, eth perpetual exchange, ethereum leverage trading, best eth futures platform' },
  { slug: 'best-crypto-exchange-for-copy-trading', title: 'Best Crypto Exchange for Copy Trading (2026)', h1: 'Best crypto exchange for copy trading',
    intro: 'Copy trading mirrors the positions of an experienced trader into your account automatically. The best venues combine a large pool of verified lead traders with transparent stats and low fees. Ranked for copy trading.',
    rank: ['bybit', 'okx', 'binance', 'kucoin', 'kraken'], metricKey: 'taker', metric: 'Taker fee', fmt: v => v + '%',
    why: { bybit: 'one of the largest copy-trading marketplaces, with detailed lead-trader stats and deep perp liquidity', okx: 'a polished copy-trading product tied to its unified account', binance: 'copy trading backed by the deepest markets and the widest pair list', kucoin: 'copy trading across a huge altcoin selection', kraken: 'a security-first venue, though without a native copy-trading product' },
    kw: 'best crypto copy trading exchange, copy trading futures, best copy trading platform crypto, mirror trading crypto' },
  { slug: 'best-crypto-exchange-mobile-app', title: 'Best Crypto Exchange Mobile App for Futures (2026)', h1: 'Best crypto exchange mobile app',
    intro: 'A great trading app means fast charts, one-tap orders and full position management on the go. Ranked for mobile futures trading.',
    rank: ['bybit', 'binance', 'okx', 'kucoin', 'kraken'], metricKey: 'lev', metric: 'Max leverage', fmt: v => v + '×',
    why: { bybit: 'a slick, fast app with full futures controls and quick order entry', binance: 'a feature-packed app with the deepest markets behind it', okx: 'a clean app with pro charting and a unified account view', kucoin: 'a capable app with a huge coin list', kraken: 'a tidy, reliable app focused on the larger caps' },
    kw: 'best crypto exchange app, best futures trading app, best crypto app for leverage, mobile crypto futures' },
  { slug: 'best-crypto-exchange-for-shorting', title: 'Best Crypto Exchange for Shorting (2026)', h1: 'Best crypto exchange for shorting',
    intro: 'Shorting crypto means betting on a fall with leverage — you want deep short-side liquidity, reliable funding and a fast engine so your exit fills when volatility spikes. Ranked for short sellers.',
    rank: ['bybit', 'binance', 'okx', 'kucoin', 'kraken'], metricKey: 'taker', metric: 'Taker fee', fmt: v => v + '%',
    why: { bybit: 'deep two-sided perpetual liquidity and a fast engine, so shorts fill cleanly even in a squeeze', binance: 'the deepest books anywhere, which keeps short-side slippage low on the majors', okx: 'pro conditional orders for precise short entries and stop management', kucoin: 'a huge list of altcoins to short, including names other venues do not list', kraken: 'a trusted, US-regulated home for shorts, with conservative leverage' },
    kw: 'best crypto exchange for shorting, how to short crypto, short selling crypto exchange, best exchange to short bitcoin' },
  { slug: 'best-crypto-exchange-for-swing-trading', title: 'Best Crypto Exchange for Swing Trading (2026)', h1: 'Best crypto exchange for swing trading',
    intro: 'Swing traders hold positions for days to weeks, so funding cost, a wide liquidation buffer and reliable uptime matter far more than shaving a fraction off the taker fee. Ranked for swing trading.',
    rank: ['bybit', 'binance', 'okx', 'kraken', 'kucoin'], metricKey: 'lev', metric: 'Max leverage', fmt: v => v + '×',
    why: { bybit: 'stable funding and deep liquidity for positions held across many funding cycles', binance: 'the deepest markets and widest pair list for multi-day holds', okx: 'a unified account that nets margin across products while a swing runs', kraken: 'conservative leverage and a strong security record for positions held overnight', kucoin: 'a vast altcoin list for swinging smaller-cap narratives' },
    kw: 'best crypto exchange for swing trading, swing trading crypto futures, best exchange to hold positions, crypto swing trading platform' },
  { slug: 'best-crypto-exchange-for-solana-futures', title: 'Best Crypto Exchange for Solana (SOL) Futures (2026)', h1: 'Best exchange for Solana futures',
    intro: 'SOL is one of the most-traded and most-volatile large-cap perpetuals, so you want the deepest SOL books and a fast engine to fill during its sharp moves. Ranked for Solana futures.',
    rank: ['bybit', 'binance', 'okx', 'kucoin', 'kraken'], metricKey: 'lev', metric: 'Max leverage', fmt: v => v + '×',
    why: { bybit: 'very deep SOLUSDT liquidity and a fast engine for Solana’s violent candles', binance: 'the deepest SOL perpetual book with up to 125× on the majors', okx: '125× on SOL with pro order types and a unified account', kucoin: 'reliable SOL liquidity alongside its huge altcoin list', kraken: 'a trusted venue for Solana with a conservative 50× cap' },
    kw: 'best exchange for solana futures, sol perpetual exchange, solana leverage trading, best sol futures platform' },
  { slug: 'best-crypto-exchange-for-meme-coins', title: 'Best Crypto Exchange for Meme Coin Futures (2026)', h1: 'Best crypto exchange for meme coins',
    intro: 'Trading DOGE, PEPE, WIF and the rest with leverage needs the widest meme-perp selection and enough liquidity to get in and out before the move is over. Ranked for meme-coin futures.',
    rank: ['kucoin', 'bybit', 'binance', 'okx', 'kraken'], metricKey: 'lev', metric: 'Max leverage', fmt: v => v + '×',
    why: { kucoin: 'one of the largest meme-coin futures selections, with new listings arriving fast', bybit: 'a growing meme-perp list with tight spreads on the popular names', binance: 'deep liquidity on the biggest meme perps and up to 125×', okx: 'clean pro tools for trading meme volatility with precision', kraken: 'a narrower, safety-first list focused on the larger names' },
    kw: 'best exchange for meme coins, meme coin futures exchange, best exchange to trade doge pepe, meme coin leverage trading' },
];

function head(o) {
  return `<!DOCTYPE html>
<html lang="${o.lang}"${o.dir ? ' dir="rtl"' : ''}>
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${o.title} | MarginPad</title>
<meta name="description" content="${o.desc}" />
<meta name="keywords" content="${o.kw}" />
<link rel="canonical" href="${o.url}" />
${o.hreflang}
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#0a0b0d" />
<meta property="og:title" content="${o.title}" />
<meta property="og:description" content="${o.desc}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${o.url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Familjen+Grotesk:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/assets/blog.css" />
<style>
  .rankcard{position:relative;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px;background:linear-gradient(180deg,var(--panel),#0d0f12);border:1px solid var(--line-bright);border-radius:15px;padding:18px 20px;margin:12px 0}
  .rankcard.top{border-color:rgba(194,246,74,.45);box-shadow:0 18px 46px -26px rgba(194,246,74,.45)}
  .rk-no{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:26px;color:#5c656f;width:34px;text-align:center}
  .rankcard.top .rk-no{color:#c2f64a}
  .rk-body h3{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:19px;margin:0 0 3px;display:flex;align-items:center;gap:9px}
  .rk-mark{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;font-family:'Space Mono',monospace;font-weight:700;font-size:11px}
  .rk-body p{margin:0;color:var(--ink-dim);font-size:14px;line-height:1.5}
  .rk-metric{text-align:right;min-width:92px}
  .rk-metric b{display:block;font-family:'Space Mono',monospace;font-size:18px;color:#c2f64a}
  .rk-metric span{font-family:'Space Mono',monospace;font-size:10px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.06em}
  .rk-cta{display:inline-block;text-align:center;text-decoration:none;font-family:'Space Mono',monospace;font-weight:700;font-size:13px;padding:11px 16px;border-radius:10px;margin-top:14px}
  .tag-best{position:absolute;top:-9px;left:18px;background:#c2f64a;color:#0a0b0d;font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.05em;padding:2px 9px;border-radius:6px}
  .cmp{width:100%;border-collapse:collapse;margin:18px 0;font-size:14px}
  .cmp th,.cmp td{padding:11px 13px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}
  .cmp th{font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-dim)}
  .cmp td{font-family:'Space Mono',monospace;color:var(--ink)}.cmp td:first-child{font-family:'Bricolage Grotesque',sans-serif;font-weight:700}
  @media(max-width:600px){.rankcard{grid-template-columns:auto 1fr;gap:11px}.rk-metric,.rankcard .rk-cta{grid-column:2}.rk-metric{text-align:left;margin-top:8px}.cmp{display:block;overflow-x:auto}}
${FEEC_CSS}
</style>
${o.ld}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":${JSON.stringify(o.crumbHome)},"item":"${o.homeHref}"},{"@type":"ListItem","position":2,"name":${JSON.stringify(o.bcName)},"item":"${o.url}"}]}</script>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="${o.homeHref}">MARGIN<b style="color:#c2f64a">PAD</b></a>
    <nav class="nav"><a href="${o.homeHref}">${o.navCalc}</a><a href="/blog/">${o.navBlog}</a><a href="/glossary/">${o.navGloss}</a></nav>
  </header>
  <div class="crumb"><a href="${o.homeHref}">${o.crumbHome}</a> / ${o.crumb}</div>
  <article>`;
}
function foot(o) {
  return `  </article>
<section style="margin:26px 0 6px;border:1px solid #262e3a;border-radius:13px;padding:15px 18px;background:rgba(255,255,255,.015)"><h2 style="font-size:15px;margin:0 0 8px;font-family:'Space Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:#8b95a1">Sources &amp; methodology</h2><ul style="margin:0;padding-left:18px;font-size:12.5px;color:#9aa3ad;line-height:1.7"><li>Fees, leverage caps and KYC rules come from each exchange&#39;s <b>public fee schedule and docs</b>, read at the base (VIP-0) tier.</li><li>Ratings are <b>MarginPad&#39;s editorial opinion</b> (0-5), weighted for this page&#39;s use case — they are not paid placements.</li><li>Exchange links are referral links; they fund the free tools and <b>do not affect rankings</b>. We do not list a venue we would not use ourselves.</li><li>Liquidation and market figures cited on MarginPad come from our own <a href="/liquidations/recap/" style="color:#c2f64a">measured liquidation feed</a>, not estimates.</li><li><b>Figures last verified: ${VDATE}</b> (page regenerated on this date). Terms change — confirm on the exchange before depositing.</li></ul></section>
      <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="${o.homeHref}">${o.navCalc}</a> · <a href="/blog/">${o.navBlog}</a> · <a href="/glossary/">${o.navGloss}</a></span>
  </footer>
</div>
</body>
</html>
`;
}

function hreflang(slug) {
  let s = `<link rel="alternate" hreflang="en" href="https://marginpad.io/${slug}/" />\n`;
  for (const lc of LANG_CODES) s += `<link rel="alternate" hreflang="${lc}" href="https://marginpad.io/${lc}/${slug}/" />\n`;
  s += `<link rel="alternate" hreflang="x-default" href="https://marginpad.io/${slug}/" />`;
  return s;
}

function casePage(c, lang) {
  const L = lang ? SHARED[lang] : EN_SHARED;
  const KN = lang ? KNOWN[lang] : EN_KNOWN;
  const tr = lang ? CASE_TR[lang][c.slug] : null;       // translated case content
  const code = lang || 'en';
  const title = tr ? tr.title : c.title;
  const h1 = tr ? tr.h1 : c.h1;
  const intro = tr ? tr.intro : c.intro;
  const kw = tr ? tr.kw : c.kw;
  const whyMap = tr ? tr.why : c.why;
  const url = `https://marginpad.io/${lang ? lang + '/' : ''}${c.slug}/`;
  const homeHref = lang ? `/${lang}/` : '/';
  const rel = slug => `/${lang ? lang + '/' : ''}${slug}/`;
  const metricLabel = lang ? (c.metricKey === 'lev' ? L.mLev : L.mTaker) : c.metric;
  const metricLower = lang ? metricLabel : c.metric.toLowerCase();
  const top = EX[c.rank[0]];
  const cards = c.rank.map((k, i) => {
    const e = EX[k];
    const offer = fill(L.offers, { A: e.name, WHY: whyMap[k] || KN[k] });
    return `<div class="rankcard${i === 0 ? ' top' : ''}">${i === 0 ? `<span class="tag-best">${L.tagBest}</span>` : ''}
      <div class="rk-no">${i + 1}</div>
      <div class="rk-body"><h3><span class="rk-mark" style="background:${e.accent};color:${e.fg}">${e.name[0]}</span>${e.name}</h3><p>${offer}</p>
      <a class="rk-cta" href="${e.ref}" target="_blank" rel="sponsored noopener nofollow" style="background:${e.accent};color:${e.fg}">${fill(L.openCta, { X: e.name })}</a></div>
      <div class="rk-metric"><b>${c.fmt(e[c.metricKey])}</b><span>${metricLabel}</span></div>
    </div>`;
  }).join('\n');
  const table = `<table class="cmp"><thead><tr><th>${L.thExchange}</th><th>${L.thMaxLev}</th><th>${L.thMaker}</th><th>${L.thTaker}</th><th>${L.thKnown}</th></tr></thead><tbody>${c.rank.map(k => { const e = EX[k]; return `<tr><td>${e.name}</td><td>${e.lev}×</td><td>${e.maker}%</td><td>${e.taker}%</td><td style="white-space:normal;color:var(--ink-dim)">${KN[k]}</td></tr>`; }).join('')}</tbody></table>`;
  const faqTop = fill(L.faqTopA, { TOP: top.name, TOPWHY: whyMap[c.rank[0]] || KN[c.rank[0]], R1: EX[c.rank[1]].name, R2: EX[c.rank[2]].name });
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":${JSON.stringify(h1 + '?')},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(faqTop)}}},{"@type":"Question","name":${JSON.stringify(L.faqFreeQ)},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(L.faqFreeA)}}}]}</script>`;
  return head({ lang: code, dir: RTL[lang] ? 1 : 0, title, desc: intro.slice(0, 155), url, homeHref, hreflang: hreflang(c.slug),
    crumb: h1, bcName: h1, kw, ld, crumbHome: L.crumbHome, navCalc: L.navCalc, navBlog: L.navBlog, navGloss: L.navGloss })
    + `
    <h1>${h1}</h1>
    <p class="lead">${intro}</p>
    <p style="color:var(--ink-faint);font-size:12.5px;margin:-6px 0 18px">${L.updated}</p>
    ${cards}
    ${feeWidget(EX[c.rank[0]], EX[c.rank[1]], lang)}
    <h2>${L.h2cmp}</h2>
    ${table}
    <h2>${L.h2rank}</h2>
    <p>${fill(L.rankP, { METRIC: metricLower })}</p>
${lang ? '' : `
    <h2>How to choose ${c.h1.replace(/^Best /, 'the best ').toLowerCase()}</h2>
    <p>For this use case the factor that matters most is <strong>${c.metric.toLowerCase()}</strong>, which is why our ranking leads with it — but it is never the only thing to weigh. Deep liquidity keeps your fills tight and your slippage low; a fast, reliable matching engine means your orders actually land during the volatile moments that matter; and low fees compound in your favour the more you trade. Our top pick, <strong>${top.name}</strong>, offers ${c.why[c.rank[0]] || EN_KNOWN[c.rank[0]]}, which is what puts it first here. The runners-up, <strong>${EX[c.rank[1]].name}</strong> and <strong>${EX[c.rank[2]].name}</strong>, are close behind and may suit you better depending on which coins you trade and where you live.</p>
    <h3>Our methodology</h3>
    <p>We weight the factors that decide real outcomes for this use case — here, primarily ${c.metric.toLowerCase()} — alongside liquidity, execution reliability, fee schedule and overall trader experience. Figures such as leverage caps and fees are base-tier and change by contract, region and account tier, so we treat them as a starting point, not gospel. We do not rank an exchange we would not use ourselves, and every link below is a referral link that keeps these tools free — it does not change the order.</p>
    <h3>What to watch out for</h3>
    <ul>
      <li><strong>Regional access.</strong> The best venue on paper is useless if it does not serve your country — most of these are not available to US residents (<a href="/highest-leverage-crypto-exchange/">Kraken is the main US-friendly major</a>).</li>
      <li><strong>Leverage is a trap.</strong> A 125× headline means a ~1% move liquidates you. Check exactly where with the <a href="/calculators?c=liq">liquidation calculator</a> before you size up.</li>
      <li><strong>Fees are paid on notional.</strong> They look tiny but scale with your leverage and trade count — see how they add up on the <a href="/bybit-vs-binance/">exchange comparison pages</a>.</li>
    </ul>
    <p>Not sure which fits? <a href="/paper-trade">Practice the exact strategy free</a> on our paper-trading terminal — live prices, real liquidation logic, zero risk — before you fund any of them.</p>`}
    <div class="related">
      <a href="${rel('best-crypto-exchange-for-beginners')}">${L.relBeginners}</a>
      <a href="${rel('lowest-fee-crypto-exchange')}">${L.relLowFee}</a>
      <a href="${rel('highest-leverage-crypto-exchange')}">${L.relHighLev}</a>
      <a href="${rel('best-crypto-exchange-for-altcoins')}">${L.relAlt}</a>
      <a href="${rel('best-crypto-exchange-for-day-trading')}">${L.relDay}</a>
    </div>
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:22px">${L.disclosure}</p>
`
    + foot({ homeHref, navCalc: L.navCalc, navBlog: L.navBlog, navGloss: L.navGloss });
}

let n = 0;
for (const c of CASES) {
  // English at root slug
  fs.mkdirSync(path.join(OUT, c.slug), { recursive: true });
  fs.writeFileSync(path.join(OUT, c.slug, 'index.html'), casePage(c, ''));
  n++;
  // 12 translated variants
  for (const lc of LANG_CODES) {
    const d = path.join(OUT, lc, c.slug);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'index.html'), casePage(c, lc));
    n++;
  }
  console.log('wrote', c.slug, '(en + 12)');
}
// keep sitemap in sync
try {
  const smp = path.join(OUT, 'sitemap.xml');
  let sm = fs.readFileSync(smp, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  let added = 0;
  for (const c of CASES) {
    const loc = `https://marginpad.io/${c.slug}/`;
    if (sm.indexOf(loc) === -1) { sm = sm.replace('</urlset>', `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n</urlset>`); added++; }
  }
  if (added) { fs.writeFileSync(smp, sm); console.log('sitemap: +' + added + ' best-for URLs'); }
} catch (e) { console.log('sitemap skipped:', e.message); }
console.log('done:', n, 'best-for pages');
