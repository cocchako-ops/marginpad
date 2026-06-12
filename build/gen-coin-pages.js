/* Per-coin liquidation calculator landing pages for long-tail SEO.
   Run: node build/gen-coin-pages.js */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');
const fmt = n => n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 5 : 2 });

const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const COINS = [
  { sym: 'BTC', name: 'Bitcoin', slug: 'btc', entry: 62000, lev: 125, blurb: 'Bitcoin has the deepest, most liquid perpetual-futures market in crypto, so spreads are tight and high leverage is widely available.' },
  { sym: 'ETH', name: 'Ethereum', slug: 'eth', entry: 1650, lev: 100, blurb: 'Ethereum perps are the second most traded contract after BTC, with deep liquidity across every major exchange.' },
  { sym: 'SOL', name: 'Solana', slug: 'sol', entry: 63, lev: 75, blurb: 'Solana is one of the most volatile large-cap perps — fast moves mean liquidation can arrive quicker than the number suggests.' },
  { sym: 'XRP', name: 'XRP', slug: 'xrp', entry: 1.1, lev: 75, blurb: 'XRP perps see sharp, news-driven spikes, so a generous liquidation buffer matters more than usual.' },
  { sym: 'BNB', name: 'BNB', slug: 'bnb', entry: 590, lev: 75, blurb: 'BNB futures are most liquid on Binance, where the token also pays a fee discount.' },
  { sym: 'DOGE', name: 'Dogecoin', slug: 'doge', entry: 0.08, lev: 75, blurb: 'Dogecoin is a high-beta meme perp — it can double or halve on sentiment, so high leverage is especially risky.' },
  { sym: 'ADA', name: 'Cardano', slug: 'ada', entry: 0.16, lev: 75, blurb: 'Cardano perps can trend hard for weeks; size for the move, not the candle.' },
  { sym: 'AVAX', name: 'Avalanche', slug: 'avax', entry: 6.5, lev: 75, blurb: 'Avalanche is a volatile large-cap alt where liquidation distance shrinks fast at high leverage.' },
  { sym: 'LINK', name: 'Chainlink', slug: 'link', entry: 11, lev: 75, blurb: 'Chainlink perps are popular among alt traders and move sharply around major partnership news.' },
  { sym: 'LTC', name: 'Litecoin', slug: 'ltc', entry: 70, lev: 75, blurb: 'Litecoin is an older, comparatively steady large-cap, but leverage still puts liquidation close to entry.' },
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
<script src="/assets/liqcalc.js"></script>
</body>
</html>
`;
}

function coinPage(c) {
  const mmr = 0.5, url = `https://marginpad.io/${c.slug}-liquidation-calculator/`;
  const liq = c.entry * (1 - 1 / 10 + mmr / 100), dist = (1 / 10 - mmr / 100) * 100;
  const title = `${c.sym} Liquidation Calculator — ${c.name} Futures (Long & Short)`;
  const desc = `Free ${c.sym} liquidation calculator. Find the exact ${c.name} liquidation price for any leverage and position, long or short. Instant, private, no signup.`;
  const others = COINS.filter(x => x.slug !== c.slug).slice(0, 6);
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"${c.sym} Liquidation Calculator","applicationCategory":"FinanceApplication","operatingSystem":"Any (web browser)","url":"${url}","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":"${desc}"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How do I calculate ${c.sym} liquidation price?","acceptedAnswer":{"@type":"Answer","text":"Enter your ${c.sym} entry price, leverage and direction. Liquidation = Entry x (1 - 1/Leverage + MMR) for a long and Entry x (1 + 1/Leverage - MMR) for a short."}},{"@type":"Question","name":"At what percentage is a ${c.sym} position liquidated?","acceptedAnswer":{"@type":"Answer","text":"Roughly 1/Leverage minus the maintenance margin. A 10x ${c.sym} position is liquidated after about a 9-10% move; 100x after about 1%."}}]}</script>`;
  return head({ title, desc, url, crumb: `${c.sym} liquidation calculator`, bcName: `${c.sym} Liquidation Calculator`, ld,
    keywords: `${c.slug} liquidation calculator, ${c.name.toLowerCase()} liquidation calculator, ${c.slug} liquidation price, ${c.slug} futures calculator, ${c.slug} leverage calculator` })
    + `
    <h1>${c.sym} Liquidation Calculator</h1>
    <p class="lead">Find your exact <strong>${c.name} (${c.sym})</strong> liquidation price — for any leverage, long or short. Free, instant and private (it runs in your browser).</p>
    <div class="calc">
      <div class="calc-in">
        <div class="seg" id="liqSeg"><button class="on" data-side="long">Long</button><button data-side="short">Short</button></div>
        <label>Entry price (USD)</label><input id="liqEntry" type="number" value="${c.entry}" step="any">
        <label>Leverage</label><input id="liqLev" type="number" value="10" step="any">
        <label>Maintenance margin rate (%)</label><input id="liqMmr" type="number" value="${mmr}" step="any">
      </div>
      <div class="calc-out">
        <div class="col">Estimated ${c.sym} liquidation price</div><div class="big" id="liqOut">—</div>
        <div class="rr"><span>Distance from entry</span><b id="liqDist">—</b></div>
      </div>
    </div>
    <h2>How ${c.sym} liquidation works</h2>
    <p>${c.blurb} Liquidation happens when losses eat through the margin backing your position. The isolated-margin estimate is <code>Entry × (1 − 1/Leverage + MMR)</code> for a long and <code>Entry × (1 + 1/Leverage − MMR)</code> for a short, where <b>MMR</b> is the maintenance margin rate.</p>
    <h2>Worked example — 10× ${c.sym} long</h2>
    <p>A 10× ${c.sym} long entered at <code>$${fmt(c.entry)}</code> with a 0.5% maintenance margin rate is liquidated at about:</p>
    <div class="example">
      <div class="row"><span>Liquidation price</span><b>$${fmt(liq)}</b></div>
      <div class="row"><span>Move to liquidation</span><b>−${dist.toFixed(2)}%</b></div>
    </div>
    <p>Because ${c.sym} can move fast, keep your stop-loss well inside that level and size by risk. See <a href="/blog/crypto-position-sizing-risk-management/">how to size a position</a> and <a href="/blog/what-is-liquidation-in-crypto/">how to avoid liquidation</a>.</p>
    <h2>Other coins &amp; tools</h2>
    <div class="related">
      <a href="/#liq">All calculators</a>
      <a href="/funding-fee-calculator/">Funding fee</a>
      ${others.map(o => `<a href="/${o.slug}-liquidation-calculator/">${o.sym} liquidation</a>`).join('\n      ')}
    </div>
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:24px">Educational tool, not financial advice. Estimates exclude fees and funding and may differ from your exchange.</p>
`
    + foot();
}

let n = 0;
for (const c of COINS) {
  const d = path.join(OUT, `${c.slug}-liquidation-calculator`);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'index.html'), coinPage(c));
  n++;
  console.log('wrote', c.slug + '-liquidation-calculator');
}
console.log('done:', n, 'coin pages');
