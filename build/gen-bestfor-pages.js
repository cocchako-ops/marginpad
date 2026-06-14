/* "Best crypto exchange for X" high-intent affiliate landing pages.
   Run: node build/gen-bestfor-pages.js */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

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
];

function head(o) {
  return `<!DOCTYPE html>
<html lang="en">
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${o.title} | MarginPad</title>
<meta name="description" content="${o.desc}" />
<meta name="keywords" content="${o.kw}" />
<link rel="canonical" href="${o.url}" />
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
</style>
${o.ld}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://marginpad.io/"},{"@type":"ListItem","position":2,"name":"${o.bcName}","item":"${o.url}"}]}</script>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b style="color:#c2f64a">PAD</b></a>
    <nav class="nav"><a href="/">Calculators</a><a href="/blog/">Blog</a><a href="/glossary/">Glossary</a></nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / ${o.crumb}</div>
  <article>`;
}
function foot() {
  return `  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="/">Calculators</a> · <a href="/blog/">Blog</a> · <a href="/glossary/">Glossary</a></span>
  </footer>
</div>
</body>
</html>
`;
}

function casePage(c) {
  const url = `https://marginpad.io/${c.slug}/`;
  const desc = c.intro.slice(0, 155);
  const top = EX[c.rank[0]];
  const cards = c.rank.map((k, i) => {
    const e = EX[k];
    return `<div class="rankcard${i === 0 ? ' top' : ''}">${i === 0 ? '<span class="tag-best">Top pick</span>' : ''}
      <div class="rk-no">${i + 1}</div>
      <div class="rk-body"><h3><span class="rk-mark" style="background:${e.accent};color:${e.fg}">${e.name[0]}</span>${e.name}</h3><p>${e.name} offers ${c.why[k] || e.known}.</p>
      <a class="rk-cta" href="${e.ref}" target="_blank" rel="sponsored noopener nofollow" style="background:${e.accent};color:${e.fg}">Open ${e.name} account →</a></div>
      <div class="rk-metric"><b>${c.fmt(e[c.metricKey])}</b><span>${c.metric}</span></div>
    </div>`;
  }).join('\n');
  const table = `<table class="cmp"><thead><tr><th>Exchange</th><th>Max lev</th><th>Maker</th><th>Taker</th><th>Best known for</th></tr></thead><tbody>${c.rank.map(k => { const e = EX[k]; return `<tr><td>${e.name}</td><td>${e.lev}×</td><td>${e.maker}%</td><td>${e.taker}%</td><td style="white-space:normal;color:var(--ink-dim)">${e.known}</td></tr>`; }).join('')}</tbody></table>`;
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"${c.h1}?","acceptedAnswer":{"@type":"Answer","text":"Our top pick is ${top.name}, which offers ${(c.why ? c.why[c.rank[0]] : top.known).replace(/"/g, '')}. Runners-up are ${EX[c.rank[1]].name} and ${EX[c.rank[2]].name}."}},{"@type":"Question","name":"Are these exchanges free to use?","acceptedAnswer":{"@type":"Answer","text":"Yes — opening an account is free on all of them; you only pay trading fees when you trade. The links here are referral links that support MarginPad at no cost to you."}}]}</script>`;
  return head({ title: c.title, desc, url, crumb: c.h1, bcName: c.h1, kw: c.kw, ld })
    + `
    <h1>${c.h1}</h1>
    <p class="lead">${c.intro}</p>
    <p style="color:var(--ink-faint);font-size:12.5px;margin:-6px 0 18px">Updated for 2026. Links are referral links — see disclosure below.</p>
    ${cards}
    <h2>Side-by-side comparison</h2>
    ${table}
    <h2>How we rank</h2>
    <p>We weight the factors that matter for this use case — here, primarily <strong>${c.metric.toLowerCase()}</strong> — alongside liquidity, reliability and overall trader experience. Fees and leverage caps vary by contract, region and account tier, so always confirm on the exchange. Before you size a trade, check exactly where it would be wiped with the <a href="/#liq">liquidation calculator</a> and practice risk-free in <a href="/?p=plan">Paper Trade</a>.</p>
    <div class="related">
      <a href="/best-crypto-exchange-for-beginners/">For beginners</a>
      <a href="/lowest-fee-crypto-exchange/">Lowest fees</a>
      <a href="/highest-leverage-crypto-exchange/">Highest leverage</a>
      <a href="/best-crypto-exchange-for-altcoins/">For altcoins</a>
      <a href="/best-crypto-exchange-for-day-trading/">For day trading</a>
    </div>
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:22px">Disclosure: the exchange links above are referral links. If you sign up through them MarginPad may earn a commission at no extra cost to you — it keeps the tools free. Not financial advice; trade at your own risk.</p>
`
    + foot();
}

let n = 0;
for (const c of CASES) {
  const d = path.join(OUT, c.slug);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'index.html'), casePage(c));
  n++;
  console.log('wrote', c.slug);
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
