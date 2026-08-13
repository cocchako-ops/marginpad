/* Big visitor-focused update: leverage-specific liquidation pages, a funding-fee
   calculator, and a glossary. Run: node build/gen-bigupdate.js */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');
const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function head(o) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-18230384038');</script>
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
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Familjen+Grotesk:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/assets/blog.css" />
${o.ld || ''}
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
function foot(scriptSrc) {
  return `  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="/">Calculators</a> · <a href="/blog/">Blog</a> · <a href="/glossary/">Glossary</a> · <a href="/about/">About</a></span>
  </footer>
</div>${scriptSrc ? '\n<script src="' + scriptSrc + '"></script>' : ''}
</body>
</html>
`;
}

// ---------- leverage-specific liquidation pages ----------
const LEVS = [5, 10, 20, 25, 50, 100];
function levPage(L) {
  const mmr = 0.5, entry = 60000;
  const url = `https://marginpad.io/${L}x-liquidation-calculator/`;
  const liq = entry * (1 - 1 / L + mmr / 100), dist = (1 / L - mmr / 100) * 100;
  const tone = L >= 50 ? 'extremely thin' : (L >= 20 ? 'thin' : 'moderate');
  const risk = L >= 50 ? 'Only the smallest adverse move wipes you out — this is for experienced traders managing tight risk.'
    : (L >= 20 ? 'The buffer is small, so a fast wick can liquidate you before a stop fills.' : 'The wider buffer gives a stop-loss room to work, which is why beginners are steered here.');
  const title = `${L}x Liquidation Calculator — Crypto Futures Long & Short`;
  const desc = `Free ${L}x liquidation calculator. See exactly where a ${L}x long or short is liquidated and how ${tone} the buffer is. Instant, private, no signup.`;
  const others = LEVS.filter(x => x !== L);
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"${L}x Liquidation Calculator","applicationCategory":"FinanceApplication","operatingSystem":"Any (web browser)","url":"${url}","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":"${desc}"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"At what percentage does a ${L}x position get liquidated?","acceptedAnswer":{"@type":"Answer","text":"Roughly ${dist.toFixed(2)}% against you — about 1/${L} of the price minus the maintenance margin. Fees and funding make the real number slightly closer."}},{"@type":"Question","name":"Is ${L}x leverage safe?","acceptedAnswer":{"@type":"Answer","text":"${L}x means a ~${dist.toFixed(1)}% move liquidates you. ${risk}"}}]}</script>`;
  return head({ title, desc, url, crumb: `${L}x liquidation calculator`, bcName: `${L}x Liquidation Calculator`, ld,
    keywords: `${L}x liquidation calculator, ${L}x leverage calculator, ${L}x liquidation price, crypto ${L}x calculator, ${L}x futures liquidation` })
    + `
    <h1>${L}x Liquidation Calculator</h1>
    <p class="lead">See exactly where a <b>${L}× leveraged</b> position gets liquidated — long or short, any entry. At ${L}×, liquidation sits only about <b>${dist.toFixed(2)}%</b> from your entry. Free and private.</p>
    <div class="calc">
      <div class="calc-in">
        <div class="seg" id="liqSeg"><button class="on" data-side="long">Long</button><button data-side="short">Short</button></div>
        <label>Entry price (USD)</label><input id="liqEntry" type="number" value="60000" step="any">
        <label>Leverage</label><input id="liqLev" type="number" value="${L}" step="any">
        <label>Maintenance margin rate (%)</label><input id="liqMmr" type="number" value="${mmr}" step="any">
      </div>
      <div class="calc-out">
        <div class="col">Estimated liquidation price</div><div class="big" id="liqOut">—</div>
        <div class="rr"><span>Distance from entry</span><b id="liqDist">—</b></div>
      </div>
    </div>
    <h2>How far is liquidation at ${L}× leverage?</h2>
    <p>The liquidation buffer is approximately <code>1 / leverage</code>, minus a small maintenance margin. At ${L}×, that's about <b>${dist.toFixed(2)}%</b> against your position. ${risk}</p>
    <h2>Worked example</h2>
    <p>A ${L}× long entered at <code>$${fmt(entry)}</code> is liquidated at roughly:</p>
    <div class="example">
      <div class="row"><span>Liquidation price</span><b>$${fmt(liq)}</b></div>
      <div class="row"><span>Move to liquidation</span><b>−${dist.toFixed(2)}%</b></div>
    </div>
    <p>Always set your stop-loss <em>inside</em> that level. Learn more in <a href="/blog/crypto-leverage-explained/">crypto leverage explained</a> and <a href="/blog/what-is-liquidation-in-crypto/">how to avoid liquidation</a>.</p>

    <h2>${L}× in context — liquidation distance by leverage</h2>
    <p>The same trade at different leverage levels, showing how much room each one gives before an isolated-margin long is liquidated (0.5% maintenance margin):</p>
    <table style="width:100%;border-collapse:collapse;margin:14px 0 18px;font-size:14px">
      <thead><tr><th style="padding:10px 13px;border-bottom:1px solid var(--line);text-align:left;font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-dim)">Leverage</th><th style="padding:10px 13px;border-bottom:1px solid var(--line);text-align:left;font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-dim)">Move to liquidation</th><th style="padding:10px 13px;border-bottom:1px solid var(--line);text-align:left;font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-dim)">Buffer</th></tr></thead>
      <tbody>${LEVS.map(x => { const d = (1 / x - mmr / 100) * 100; return `<tr${x === L ? ' style="background:rgba(194,246,74,.06)"' : ''}><td style="padding:10px 13px;border-bottom:1px solid var(--line);font-family:'Bricolage Grotesque',sans-serif;font-weight:700">${x}×${x === L ? ' <span style="font-family:\'Space Mono\',monospace;font-size:9px;color:#c2f64a;text-transform:uppercase">this page</span>' : ''}</td><td style="padding:10px 13px;border-bottom:1px solid var(--line);font-family:'Space Mono',monospace">−${d.toFixed(2)}%</td><td style="padding:10px 13px;border-bottom:1px solid var(--line);font-family:'Space Mono',monospace;color:${x >= 50 ? '#ff8a80' : (x >= 20 ? '#ffd75a' : '#34d99a')}">${x >= 50 ? 'extremely thin' : (x >= 20 ? 'thin' : 'comfortable')}</td></tr>`; }).join('')}</tbody>
    </table>

    <h2>Who ${L}× leverage is for</h2>
    <p>${L >= 50
      ? `${L}× is high-conviction, tight-risk territory. A ~${dist.toFixed(1)}% wick against you ends the trade, and crypto prints wicks that size regularly — so ${L}× only makes sense for experienced traders scalping liquid pairs with a hard stop and a small slice of their book. If you cannot watch it, do not use it.`
      : (L >= 20
        ? `${L}× is an intermediate level: enough amplification to matter, but the ~${dist.toFixed(1)}% buffer leaves almost no room for normal volatility. Use it only on liquid majors, with a stop-loss set before you enter and position size worked out from that stop — not the other way round.`
        : `${L}× is the sensible starting range. The ~${dist.toFixed(1)}% buffer gives a stop-loss room to work without a routine pullback wiping you out, which is why disciplined traders — and every beginner — should live here far more often than at the 50–125× end.`)}</p>

    <h2>How to survive ${L}× leverage</h2>
    <ul>
      <li><strong>Set the stop first.</strong> Decide your invalidation price, then size the position so that stop equals a fixed % of your account (1–2%). The <a href="/calculators?c=size">position-size calculator</a> does the math.</li>
      <li><strong>Keep liquidation far from your stop.</strong> If liquidation and your stop are almost on top of each other, a wick can beat your stop to the punch — lower the leverage or widen the stop.</li>
      <li><strong>Count fees and funding.</strong> Both eat margin and pull liquidation closer than the raw ${dist.toFixed(2)}% — model them with the <a href="/funding-fee-calculator/">funding calculator</a>.</li>
      <li><strong>Rehearse it first.</strong> Open the same ${L}× trade on the <a href="/paper-trade">paper-trading terminal</a> at live prices, risk-free, until the liquidation behaviour is muscle memory.</li>
    </ul>

    <h2>Compare other leverage levels</h2>
    <div class="related">
      <a href="/calculators?c=liq">Custom leverage</a>
      ${others.map(x => `<a href="/${x}x-liquidation-calculator/">${x}× liquidation</a>`).join('\n      ')}
    </div>
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:24px">Educational tool, not financial advice. Estimates exclude fees and funding and may differ from your exchange.</p>
`
    + foot('/assets/liqcalc.js');
}

// ---------- funding fee calculator ----------
function fundingPage() {
  const url = 'https://marginpad.io/funding-fee-calculator/';
  const title = 'Funding Fee Calculator — Crypto Perpetual Futures';
  const desc = 'Free funding fee calculator for crypto perpetual futures. Work out what you pay or receive in funding for any position size, rate and number of periods.';
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"Funding Fee Calculator","applicationCategory":"FinanceApplication","operatingSystem":"Any (web browser)","url":"${url}","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":"${desc}"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How is the funding fee calculated?","acceptedAnswer":{"@type":"Answer","text":"Funding fee = position notional value x funding rate, charged each funding interval (usually every 8 hours). A positive rate means longs pay shorts."}},{"@type":"Question","name":"Do I pay funding if I close before the funding time?","acceptedAnswer":{"@type":"Answer","text":"No. Funding is only exchanged at the funding timestamp. If your position is closed before it, you neither pay nor receive funding for that interval."}}]}</script>`;
  return head({ title, desc, url, crumb: 'Funding fee calculator', bcName: 'Funding Fee Calculator', ld,
    keywords: 'funding fee calculator, funding rate calculator, perpetual funding calculator, crypto funding cost, futures funding fee' })
    + `
    <h1>Funding Fee Calculator</h1>
    <p class="lead">Work out exactly what you'll pay — or receive — in funding on a perpetual futures position. Free, instant, runs in your browser.</p>
    <div class="calc">
      <div class="calc-in">
        <div class="seg" id="ffSeg"><button class="on" data-side="long">Long</button><button data-side="short">Short</button></div>
        <label>Position size — notional (USD)</label><input id="ffNotional" type="number" value="10000" step="any">
        <label>Funding rate per interval (%)</label><input id="ffRate" type="number" value="0.01" step="any">
        <label>Number of funding intervals</label><input id="ffPeriods" type="number" value="3" step="any">
      </div>
      <div class="calc-out">
        <div class="col">Total funding</div><div class="big" id="ffOut">—</div>
        <div class="rr"><span>Per interval</span><b id="ffPer">—</b></div>
        <div class="rr"><span>Direction</span><b id="ffNote">—</b></div>
      </div>
    </div>
    <h2>How funding fees work</h2>
    <p>Perpetual futures have no expiry, so exchanges use a <b>funding rate</b> to keep the contract price tethered to spot. Every funding interval — usually every 8 hours — longs and shorts exchange a payment based on the rate:</p>
    <p><code>Funding = Notional × Funding rate</code>, each interval.</p>
    <p>When the rate is <b>positive</b>, longs pay shorts (the market is long-heavy). When it's <b>negative</b>, shorts pay longs. A negative output above means you <em>receive</em> funding.</p>
    <h2>Worked example</h2>
    <p>A $10,000 long held across three 8-hour intervals at a 0.01% rate:</p>
    <div class="example">
      <div class="row"><span>Per interval</span><b>−$1.00</b></div>
      <div class="row"><span>Total (3 intervals)</span><b>−$3.00</b></div>
    </div>
    <p>Small per interval, but it compounds on big or long-held positions. Read <a href="/blog/what-is-funding-rate/">what is a funding rate</a> for the full picture.</p>
    <h2>More calculators</h2>
    <div class="related">
      <a href="/calculators?c=liq">Liquidation price</a><a href="/calculators?c=pnl">PnL / ROI</a><a href="/calculators?c=size">Position size</a><a href="/glossary/">Glossary</a>
    </div>
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:24px">Educational tool, not financial advice. Real funding depends on your exchange's rate and timing.</p>
`
    + foot('/assets/fundingcalc.js');
}

// ---------- glossary ----------
const TERMS = [
  ['Liquidation', 'The forced closure of a leveraged position when losses consume the margin backing it. See the <a href="/calculators?c=liq">liquidation calculator</a>.'],
  ['Liquidation price', 'The price at which your position is liquidated. Long ≈ Entry × (1 − 1/Leverage + MMR).'],
  ['Leverage', 'Borrowed exposure that multiplies both gains and losses. 10× means $1 controls $10. See <a href="/blog/crypto-leverage-explained/">leverage explained</a>.'],
  ['Margin', 'The collateral you post to open and hold a leveraged position.'],
  ['Initial margin', 'The collateral required to open a position — roughly notional ÷ leverage.'],
  ['Maintenance margin (MMR)', 'The minimum margin to keep a position open. Drop below it and you are liquidated.'],
  ['Isolated margin', 'Margin mode where only the margin assigned to a position is at risk. See <a href="/blog/cross-vs-isolated-margin/">cross vs isolated</a>.'],
  ['Cross margin', 'Margin mode where your whole balance backs the position, lowering liquidation risk but exposing more capital.'],
  ['Perpetual futures', 'A futures contract with no expiry, kept near spot by the funding mechanism.'],
  ['Funding rate', 'A periodic payment between longs and shorts on perpetuals. See the <a href="/funding-fee-calculator/">funding fee calculator</a>.'],
  ['PnL', 'Profit and loss — the gain or loss on a position. See the <a href="/calculators?c=pnl">PnL calculator</a>.'],
  ['ROI', 'Return on investment — the raw percentage the asset moved.'],
  ['ROE', 'Return on equity — your return on posted margin, amplified by leverage. A 10% move at 10× ≈ 100% ROE.'],
  ['Long', 'A position that profits when price rises.'],
  ['Short', 'A position that profits when price falls.'],
  ['Position size', 'How much of an asset you hold. Size it by risk with the <a href="/calculators?c=size">position size calculator</a>.'],
  ['Notional value', 'The full market value of a position — size × price — not just the margin posted.'],
  ['Mark price', 'A smoothed reference price used to calculate unrealised PnL and trigger liquidations, less manipulable than last price.'],
  ['Index price', 'An average of spot prices across exchanges that anchors the mark price.'],
  ['Stop-loss', 'An order that closes a position at a set price to cap losses. See <a href="/blog/how-to-set-a-stop-loss/">how to set a stop-loss</a>.'],
  ['Take-profit', 'An order that closes a position at a target price to lock in gains. See the <a href="/#tp">take-profit calculator</a>.'],
  ['Risk/reward ratio', 'Reward divided by risk on a trade. See <a href="/blog/risk-reward-ratio-explained/">risk/reward explained</a>.'],
  ['Break-even win rate', 'The win rate needed to break even at a given risk/reward — e.g. 33% at 2:1.'],
  ['DCA', 'Dollar-cost averaging — building a position in tranches to smooth your entry. See the <a href="/#dca">DCA calculator</a>.'],
  ['Maker', 'An order that adds liquidity to the book (a resting limit order), usually with a lower fee. See <a href="/blog/maker-vs-taker-fees/">maker vs taker</a>.'],
  ['Taker', 'An order that removes liquidity (a market order), usually with a higher fee.'],
  ['Open interest', 'The total value of outstanding futures contracts — a gauge of market participation.'],
  ['Slippage', 'The difference between expected and executed price, worst in thin or fast markets.'],
  ['ADL', 'Auto-deleveraging — when the insurance fund can\'t cover a liquidation, profitable opposing traders are partially closed.'],
  ['Insurance fund', 'A reserve that absorbs bankrupt liquidations so winners get paid in full.'],
  ['Basis', 'The gap between futures and spot price.'],
  ['Margin call', 'A warning that your margin is running low before liquidation. See <a href="/blog/what-is-a-margin-call/">what is a margin call</a>.'],
  ['Drawdown', 'The peak-to-trough drop in account equity.'],
  ['Hedge', 'A position taken to offset risk in another.'],
  ['Spot', 'Buying the actual asset for immediate delivery — no leverage, no liquidation. See <a href="/blog/spot-vs-futures-trading/">spot vs futures</a>.'],
  ['Derivative', 'A contract whose value derives from an underlying asset, like futures or options.'],
];
function glossaryPage() {
  const url = 'https://marginpad.io/glossary/';
  const title = 'Crypto Futures Glossary — Leverage, Liquidation & Margin Terms';
  const desc = 'A plain-English glossary of crypto futures and leverage trading terms: liquidation, margin, funding rate, ROE, mark price and more.';
  const items = TERMS.map(t => ({ name: t[0], desc: t[1].replace(/<[^>]+>/g, '') }));
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"DefinedTermSet","name":"Crypto Futures Glossary","url":"${url}","hasDefinedTerm":[${items.map(i => `{"@type":"DefinedTerm","name":"${i.name.replace(/"/g, '')}","description":"${i.desc.replace(/"/g, '').replace(/×/g, 'x')}"}`).join(',')}]}</script>`;
  return head({ title, desc, url, crumb: 'Glossary', bcName: 'Glossary', ld,
    keywords: 'crypto futures glossary, leverage trading terms, liquidation meaning, funding rate meaning, margin terms crypto' })
    + `
    <h1>Crypto Futures Glossary</h1>
    <p class="lead">Every term you'll meet trading leveraged crypto, in plain English — with links to the calculator or guide for each. ${TERMS.length} terms and counting.</p>
    <dl class="glossary">
${TERMS.map(t => `      <dt id="${t[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}">${t[0]}</dt>\n      <dd>${t[1]}</dd>`).join('\n')}
    </dl>
    <h2>Put the terms to work</h2>
    <div class="related">
      <a href="/calculators?c=liq">Liquidation calculator</a><a href="/calculators?c=size">Position size</a><a href="/funding-fee-calculator/">Funding fee</a><a href="/blog/">All guides</a>
    </div>
`
    + foot('');
}

// ---------- write everything ----------
let n = 0;
for (const L of LEVS) {
  const d = path.join(OUT, `${L}x-liquidation-calculator`);
  fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'index.html'), levPage(L)); n++;
  console.log('wrote', L + 'x-liquidation-calculator');
}
const fd = path.join(OUT, 'funding-fee-calculator'); fs.mkdirSync(fd, { recursive: true }); fs.writeFileSync(path.join(fd, 'index.html'), fundingPage()); n++;
console.log('wrote funding-fee-calculator');
const gd = path.join(OUT, 'glossary'); fs.mkdirSync(gd, { recursive: true }); fs.writeFileSync(path.join(gd, 'index.html'), glossaryPage()); n++;
console.log('wrote glossary');
console.log('done:', n, 'pages');
