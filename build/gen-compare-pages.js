/* Exchange comparison pages (e.g. /bybit-vs-binance/) — high-intent SEO, affiliate to both.
   Run: node build/gen-compare-pages.js */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');
const esc = s => String(s).replace(/&/g, '&amp;');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const EX = {
  bybit:   { name: 'Bybit',   ref: 'https://www.bybit.com/invite?ref=LZKBERJ',                                                              lev: 100, mmr: 0.5, maker: 0.02, taker: 0.055, accent: '#f7a600', fg: '#0a0b0d', known: 'a fast matching engine and deep USDT-perpetual liquidity' },
  binance: { name: 'Binance', ref: 'https://www.binance.com/register?ref=MAOZM9DS',                                                          lev: 125, mmr: 0.4, maker: 0.02, taker: 0.04,  accent: '#f0b90b', fg: '#181a20', known: 'the largest volume and the widest range of futures pairs' },
  okx:     { name: 'OKX',     ref: 'https://okx.com/join/96160298',                                                                          lev: 125, mmr: 0.5, maker: 0.02, taker: 0.05,  accent: '#cfd3d8', fg: '#0a0b0d', known: 'a powerful pro interface and a unified account model' },
  kucoin:  { name: 'KuCoin',  ref: 'https://www.kucoin.com/r/rf/VHP8AYKY',                                                                   lev: 100, mmr: 0.5, maker: 0.02, taker: 0.06,  accent: '#23af91', fg: '#06231d', known: 'a huge altcoin futures selection' },
  kraken:  { name: 'Kraken',  ref: 'https://invite.kraken.com/JDNW/guj2tf28',                                                                lev: 50,  mmr: 0.5, maker: 0.02, taker: 0.05,  accent: '#7b5cff', fg: '#ffffff', known: 'security and long-standing trust' },
};

const PAIRS = [
  ['bybit', 'binance'], ['binance', 'okx'], ['bybit', 'okx'],
  ['binance', 'kucoin'], ['bybit', 'kucoin'], ['kraken', 'binance'],
];

function head(o) {
  return `<!DOCTYPE html>
<html lang="en">
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${o.title} | MarginPad</title>
<meta name="description" content="${o.desc}" />
<meta name="keywords" content="${o.keywords}" />
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
<style>.cmp{width:100%;border-collapse:collapse;margin:18px 0;font-size:14.5px}.cmp th,.cmp td{padding:12px 14px;border-bottom:1px solid var(--line);text-align:left}.cmp th{font-family:'Space Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-dim)}.cmp td:first-child{color:var(--ink-dim);font-size:13px}.cmp tr td:nth-child(2),.cmp tr td:nth-child(3){font-family:'Space Mono',monospace;color:var(--ink)}.cmpbtns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0}@media(max-width:560px){.cmpbtns{grid-template-columns:1fr}}.cmpbtn{display:block;text-align:center;text-decoration:none;font-family:'Space Mono',monospace;font-weight:700;font-size:14px;padding:15px;border-radius:12px}</style>
${o.ld}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://marginpad.io/"},{"@type":"ListItem","position":2,"name":"${o.bcName}","item":"${o.url}"}]}</script>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b>PAD</b></a>
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

function pct(n) { return n + '%'; }
function comparePage(ak, bk) {
  const a = EX[ak], b = EX[bk];
  const url = `https://marginpad.io/${ak}-vs-${bk}/`;
  const title = `${a.name} vs ${b.name}: Fees, Leverage & Liquidation Compared (2026)`;
  const desc = `${a.name} vs ${b.name} for crypto futures — max leverage, maker/taker fees, maintenance margin and how each handles liquidation. An honest side-by-side.`;
  const lowerTaker = a.taker < b.taker ? a.name : (b.taker < a.taker ? b.name : 'both equally');
  const higherLev = a.lev > b.lev ? a.name : (b.lev > a.lev ? b.name : 'both');
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Is ${a.name} or ${b.name} cheaper for futures?","acceptedAnswer":{"@type":"Answer","text":"On base taker fees, ${lowerTaker} is cheaper (${a.name} ${a.taker}% vs ${b.name} ${b.taker}%). Both offer lower maker fees and tier discounts for higher volume."}},{"@type":"Question","name":"Which has higher leverage, ${a.name} or ${b.name}?","acceptedAnswer":{"@type":"Answer","text":"${higherLev} offers higher maximum leverage (${a.name} up to ${a.lev}x, ${b.name} up to ${b.lev}x). Higher leverage means liquidation sits closer to your entry."}}]}</script>`;
  return head({ title, desc, url, crumb: `${a.name} vs ${b.name}`, bcName: `${a.name} vs ${b.name}`, ld,
    keywords: `${ak} vs ${bk}, ${a.name.toLowerCase()} vs ${b.name.toLowerCase()}, ${ak} or ${bk}, ${a.name.toLowerCase()} ${b.name.toLowerCase()} fees, best crypto futures exchange` })
    + `
    <h1>${a.name} vs ${b.name}</h1>
    <p class="lead">A no-nonsense side-by-side of <strong>${a.name}</strong> and <strong>${b.name}</strong> for crypto futures — leverage, fees, maintenance margin and what each is actually good at. Whichever you pick, plan the trade first with our <a href="/">free calculators</a>.</p>

    <table class="cmp">
      <tr><th>&nbsp;</th><th>${a.name}</th><th>${b.name}</th></tr>
      <tr><td>Max leverage</td><td>${a.lev}×</td><td>${b.lev}×</td></tr>
      <tr><td>Maker fee (base)</td><td>${pct(a.maker)}</td><td>${pct(b.maker)}</td></tr>
      <tr><td>Taker fee (base)</td><td>${pct(a.taker)}</td><td>${pct(b.taker)}</td></tr>
      <tr><td>Maintenance margin</td><td>~${pct(a.mmr)}</td><td>~${pct(b.mmr)}</td></tr>
      <tr><td>Known for</td><td>${a.known}</td><td>${b.known}</td></tr>
    </table>

    <div class="cmpbtns">
      <a class="cmpbtn" style="background:${a.accent};color:${a.fg}" href="${esc(a.ref)}" target="_blank" rel="sponsored noopener noreferrer">Open ${a.name} →</a>
      <a class="cmpbtn" style="background:${b.accent};color:${b.fg}" href="${esc(b.ref)}" target="_blank" rel="sponsored noopener noreferrer">Open ${b.name} →</a>
    </div>

    <h2>Fees</h2>
    <p>On base taker fees, <strong>${lowerTaker}</strong> is cheaper (${a.name} ${pct(a.taker)} vs ${b.name} ${pct(b.taker)}). Both reward makers (resting limit orders) with lower fees and cut rates further as your 30-day volume grows. For most active traders the fee gap is small next to the cost of a single bad liquidation — which is why position sizing matters more than chasing the lowest fee. See <a href="/blog/maker-vs-taker-fees/">maker vs taker fees</a>.</p>

    <h2>Leverage &amp; liquidation</h2>
    <p>${higherLev} offers the higher cap (${a.name} up to <strong>${a.lev}×</strong>, ${b.name} up to <strong>${b.lev}×</strong>), but the headline number is a trap: at ${Math.max(a.lev, b.lev)}× a roughly 1% move liquidates you. The maintenance margin rate (≈${pct(a.mmr)} vs ≈${pct(b.mmr)}) also nudges your liquidation price. Check yours before entering with the <a href="/#liq">liquidation calculator</a>, or the per-exchange pages: <a href="/${ak}-liquidation-calculator/">${a.name}</a> · <a href="/${bk}-liquidation-calculator/">${b.name}</a>.</p>

    <h2>Which should you pick?</h2>
    <p>If you want ${a.known}, go with <strong>${a.name}</strong>. If ${b.known} matters more, <strong>${b.name}</strong> fits better. Many traders keep accounts on both and route each trade to wherever the liquidity and funding are best on the day. There's no wrong answer — there is only an unplanned trade.</p>

    <div class="related">
      <a href="/">All calculators</a>
      <a href="/${ak}-liquidation-calculator/">${a.name} liquidation</a>
      <a href="/${bk}-liquidation-calculator/">${b.name} liquidation</a>
      <a href="/funding-fee-calculator/">Funding fee</a>
    </div>
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:24px">Fees and limits are approximate base-tier figures and change by tier, region and over time — confirm on each exchange. Exchange links are referral links; we may earn a commission at no cost to you. Educational, not financial advice.</p>
`
    + foot();
}

let n = 0;
for (const [ak, bk] of PAIRS) {
  const d = path.join(OUT, `${ak}-vs-${bk}`);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'index.html'), comparePage(ak, bk));
  n++;
  console.log('wrote', ak + '-vs-' + bk);
}
console.log('done:', n, 'comparison pages');
