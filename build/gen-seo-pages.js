/* Generates per-exchange landing pages (liquidation + PnL calculators) into ../dist/.
   Run: node build/gen-seo-pages.js   (from project root) */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');

const EX = [
  { name:'Bybit',   slug:'bybit',   ref:'https://www.bybit.com/invite?ref=LZKBERJ',                                                              lev:100, mmr:0.5, accent:'#f7a600', fg:'#0a0b0d',
    blurb:'Bybit is one of the most popular derivatives exchanges, known for a fast matching engine and deep USDT-perpetual liquidity.' },
  { name:'Binance', slug:'binance', ref:'https://www.binance.com/register?ref=MAOZM9DS',                                                          lev:125, mmr:0.4, accent:'#f0b90b', fg:'#181a20',
    blurb:'Binance is the largest crypto exchange by volume, offering the widest range of futures pairs and up to 125x leverage on majors.' },
  { name:'OKX',     slug:'okx',     ref:'https://okx.com/join/96160298',                                                                          lev:125, mmr:0.5, accent:'#cfd3d8', fg:'#0a0b0d',
    blurb:'OKX pairs a powerful pro-trading interface with a unified account model and up to 125x leverage on flagship contracts.' },
  { name:'KuCoin',  slug:'kucoin',  ref:'https://www.kucoin.com/r/rf/VHP8AYKY',                                                                   lev:100, mmr:0.5, accent:'#23af91', fg:'#06231d',
    blurb:'KuCoin Futures is known for its huge altcoin selection, letting you trade leverage on coins many larger venues do not list.' },
  { name:'Gate',    slug:'gate',    ref:'https://www.gate.com/VFIWB10KUG?ref=VFIWB10KUG&ref_type=103&ut-m_cmp=rXJBDjtJ&activity_id=1778642196063', lev:100, mmr:0.5, accent:'#3361ff', fg:'#ffffff',
    blurb:'Gate lists thousands of tokens and offers perpetual futures across an enormous range of markets, with up to 100x leverage.' },
  { name:'Kraken',  slug:'kraken',  ref:'https://invite.kraken.com/JDNW/guj2tf28',                                                                lev:50,  mmr:0.5, accent:'#7b5cff', fg:'#ffffff',
    blurb:'Kraken is a security-first, long-established exchange. Its futures offer more conservative leverage, favouring risk control.' },
  { name:'Bitget',  slug:'bitget',  ref:'https://www.bitget.com/referral/register?clacCode=DSSSQKGK',                                             lev:125, mmr:0.5, accent:'#00e5d0', fg:'#04231f',
    blurb:'Bitget is a top-five futures exchange best known for copy trading — automatically mirror pro traders — with deep USDT-perpetual liquidity and up to 125x leverage.' },
];

const esc = s => String(s).replace(/&/g, '&amp;');
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
    <nav class="nav"><a href="/">Calculators</a><a href="/blog/">Blog</a></nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / ${o.crumb}</div>
  <article>`;
}
function foot(scriptSrc) {
  return `  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="/">Calculators</a> · <a href="/blog/">Blog</a></span>
  </footer>
</div>
<script src="${scriptSrc}"></script>
<script>
/* affiliate-click conversion signal — Google Ads + GA4 + admin dashboard. The revenue proxy ad bidding optimises toward. */
(function(){var ADS_CONV_LABEL='';/* paste your Google Ads conversion label here once created, e.g. 'abCdEf1gH' */
Array.prototype.forEach.call(document.querySelectorAll('a.exbtn,[data-ex]'),function(a){a.addEventListener('click',function(){try{
var ex=(a.getAttribute('data-ex')||a.textContent||'').replace(/Trade on|→/g,'').trim();
if(window.gtag){gtag('event','affiliate_click',{exchange:ex,page:location.pathname});if(ADS_CONV_LABEL)gtag('event','conversion',{send_to:'AW-18230384038/'+ADS_CONV_LABEL});}
var u='/api/track?t=exchange&e='+encodeURIComponent(ex)+'&p='+encodeURIComponent(location.pathname);if(navigator.sendBeacon)navigator.sendBeacon(u);
}catch(_){}});});})();
</script>
</body>
</html>
`;
}
function relatedLiq(ex) {
  const others = EX.filter(o => o.slug !== ex.slug);
  return `<div class="related">
      <a href="/calculators">All calculators</a>
      <a href="/${ex.slug}-pnl-calculator/">${ex.name} PnL</a>
      <a href="/calculators?c=size">Position size</a>
      ${others.map(o => `<a href="/${o.slug}-liquidation-calculator/">${o.name} liquidation</a>`).join('\n      ')}
    </div>`;
}
function relatedPnl(ex) {
  const others = EX.filter(o => o.slug !== ex.slug);
  return `<div class="related">
      <a href="/calculators">All calculators</a>
      <a href="/${ex.slug}-liquidation-calculator/">${ex.name} liquidation</a>
      <a href="/calculators?c=tp">Take-profit</a>
      ${others.map(o => `<a href="/${o.slug}-pnl-calculator/">${o.name} PnL</a>`).join('\n      ')}
    </div>`;
}

function liqPage(ex) {
  const url = `https://marginpad.io/${ex.slug}-liquidation-calculator/`;
  const title = `${ex.name} Liquidation Calculator (2026) — Long & Short, Any Leverage`;
  const desc = `Free ${ex.name} liquidation price calculator: see your exact liq price at 10x, 25x, 50x or any leverage, long or short, with ${ex.name}'s real maintenance margin. Instant, no signup.`;
  const entry = 60000, lev = 10, mmr = ex.mmr / 100, liq = entry * (1 - 1 / lev + mmr), dist = (1 - liq / entry) * 100;
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"${ex.name} Liquidation Calculator","applicationCategory":"FinanceApplication","operatingSystem":"Any (web browser)","url":"${url}","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":"${desc}"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How do I calculate my liquidation price on ${ex.name}?","acceptedAnswer":{"@type":"Answer","text":"Enter entry price, leverage and direction. Liquidation = Entry x (1 - 1/Leverage + MMR) for a long and Entry x (1 + 1/Leverage - MMR) for a short."}},{"@type":"Question","name":"What is the maximum leverage on ${ex.name}?","acceptedAnswer":{"@type":"Answer","text":"${ex.name} offers up to ${ex.lev}x leverage on flagship perpetuals. The maximum varies by contract, region and account tier."}}]}</script>`;
  return head({ title, desc, url, crumb: `${ex.name} liquidation calculator`, bcName: `${ex.name} Liquidation Calculator`, ld,
    keywords: `${ex.name.toLowerCase()} liquidation calculator, ${ex.name.toLowerCase()} liquidation price, ${ex.name.toLowerCase()} futures calculator, ${ex.name.toLowerCase()} leverage calculator` })
    + `
    <h1>${ex.name} Liquidation Calculator</h1>
    <p class="lead">Find your exact liquidation price on ${ex.name} futures — for any leverage, long or short. Free, instant, and private (it runs in your browser).</p>
    <div class="calc">
      <div class="calc-in">
        <div class="seg" id="liqSeg"><button class="on" data-side="long">Long</button><button data-side="short">Short</button></div>
        <label>Entry price (USD)</label><input id="liqEntry" type="number" value="60000" step="any">
        <label>Leverage</label><input id="liqLev" type="number" value="10" step="any">
        <label>Maintenance margin rate (%)</label><input id="liqMmr" type="number" value="${ex.mmr}" step="any">
      </div>
      <div class="calc-out">
        <div class="col">Estimated liquidation price</div><div class="big" id="liqOut">—</div>
        <div class="rr"><span>Distance from entry</span><b id="liqDist">—</b></div>
      </div>
    </div>
    <a class="exbtn" data-ex="${ex.name}" style="background:${ex.accent};color:${ex.fg}" href="${esc(ex.ref)}" target="_blank" rel="sponsored noopener noreferrer">Trade on ${ex.name} →</a>
    <h2>How liquidation works on ${ex.name}</h2>
    <p>${ex.blurb} On ${ex.name}, an isolated-margin position is liquidated when losses eat through your posted margin. The estimate is <code>Entry × (1 − 1/Leverage + MMR)</code> for a long and <code>Entry × (1 + 1/Leverage − MMR)</code> for a short, where <b>MMR</b> is the maintenance margin rate.</p>
    <p>Because ${ex.name} allows up to <b>${ex.lev}× leverage</b>, the liquidation buffer can get thin — the higher the leverage, the closer liquidation sits to entry. Treat the figure as an estimate; real liquidation also depends on fees, funding and tiered maintenance margin.</p>
    <h2>Worked example</h2>
    <p>A ${lev}× long on ${ex.name} entered at <code>$${fmt(entry)}</code> with a ${ex.mmr}% maintenance margin rate is liquidated at about:</p>
    <div class="example">
      <div class="row"><span>Liquidation price</span><b>$${fmt(liq)}</b></div>
      <div class="row"><span>Move to liquidation</span><b>−${dist.toFixed(2)}%</b></div>
    </div>
    <p>Set your stop-loss comfortably inside that level. See also the <a href="/blog/what-is-liquidation-in-crypto/">guide to avoiding liquidation</a>.</p>
    <h2>FAQ</h2>
    <h3>What is the maximum leverage on ${ex.name}?</h3>
    <p>Up to <b>${ex.lev}×</b> on flagship perpetuals; the cap varies by contract, region and account tier.</p>
    <h3>How do I avoid liquidation on ${ex.name}?</h3>
    <p>Use lower leverage, set a stop-loss, and size by risk — see our <a href="/blog/crypto-position-sizing-risk-management/">position sizing guide</a>.</p>
    <h2>More calculators</h2>
    ${relatedLiq(ex)}
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:24px">Educational tool, not financial advice. Estimates may differ from ${ex.name}. The ${ex.name} link is a referral link; we may earn a commission at no cost to you.</p>
`
    + foot('/assets/liqcalc.js');
}

function pnlPage(ex) {
  const url = `https://marginpad.io/${ex.slug}-pnl-calculator/`;
  const title = `${ex.name} PnL Calculator (2026) — Profit, ROI & ROE`;
  const desc = `Free ${ex.name} PnL calculator: enter entry, exit and leverage to see profit, ROI and leveraged ROE for any ${ex.name} futures trade in one click, long or short. No signup.`;
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"${ex.name} PnL Calculator","applicationCategory":"FinanceApplication","operatingSystem":"Any (web browser)","url":"${url}","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":"${desc}"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How do I calculate PnL on ${ex.name}?","acceptedAnswer":{"@type":"Answer","text":"PnL = (exit - entry) x size for a long, or (entry - exit) x size for a short. ROE multiplies the price ROI by your leverage."}},{"@type":"Question","name":"What is ROE on ${ex.name} futures?","acceptedAnswer":{"@type":"Answer","text":"ROE is the return on the margin you posted, amplified by leverage. A 10% move at 10x leverage is roughly a 100% return on margin."}}]}</script>`;
  return head({ title, desc, url, crumb: `${ex.name} PnL calculator`, bcName: `${ex.name} PnL Calculator`, ld,
    keywords: `${ex.name.toLowerCase()} pnl calculator, ${ex.name.toLowerCase()} profit calculator, ${ex.name.toLowerCase()} roi calculator, ${ex.name.toLowerCase()} futures pnl` })
    + `
    <h1>${ex.name} PnL Calculator</h1>
    <p class="lead">Calculate your profit and loss, ROI and leveraged ROE for any ${ex.name} futures trade — long or short. Free, instant, no signup.</p>
    <div class="calc">
      <div class="calc-in">
        <div class="seg" id="pnlSeg"><button class="on" data-side="long">Long</button><button data-side="short">Short</button></div>
        <label>Entry price (USD)</label><input id="pnlEntry" type="number" value="60000" step="any">
        <label>Exit price (USD)</label><input id="pnlExit" type="number" value="66000" step="any">
        <label>Position size (coin)</label><input id="pnlQty" type="number" value="0.5" step="any">
        <label>Leverage (for ROE)</label><input id="pnlLev" type="number" value="10" step="any">
      </div>
      <div class="calc-out">
        <div class="col">Profit / Loss</div><div class="big" id="pnlOut">—</div>
        <div class="rr"><span>Price ROI</span><b id="pnlRoi">—</b></div>
        <div class="rr"><span>ROE (on margin)</span><b id="pnlRoe">—</b></div>
      </div>
    </div>
    <a class="exbtn" data-ex="${ex.name}" style="background:${ex.accent};color:${ex.fg}" href="${esc(ex.ref)}" target="_blank" rel="sponsored noopener noreferrer">Trade on ${ex.name} →</a>
    <h2>How PnL and ROE work on ${ex.name}</h2>
    <p>${ex.blurb} Your raw profit on a ${ex.name} trade is the price move times your position size: <code>(Exit − Entry) × Size</code> for a long, and the reverse for a short. <b>Price ROI</b> is the percentage the asset moved; <b>ROE</b> is your return on the margin you actually posted, which ${ex.name}'s leverage multiplies.</p>
    <h2>Worked example</h2>
    <p>A 0.5-coin long opened at <code>$60,000</code> and closed at <code>$66,000</code> at 10× leverage:</p>
    <div class="example">
      <div class="row"><span>Profit</span><b>+$3,000.00</b></div>
      <div class="row"><span>Price ROI</span><b>+10.00%</b></div>
      <div class="row"><span>ROE (10×)</span><b>+100.00%</b></div>
    </div>
    <p>Leverage cuts both ways — the same move down would be a 100% loss of margin. Plan your exit and check your <a href="/${ex.slug}-liquidation-calculator/">${ex.name} liquidation price</a> first.</p>
    <h2>FAQ</h2>
    <h3>How is ROE different from ROI on ${ex.name}?</h3>
    <p>Price ROI is the raw % move. ROE multiplies it by your leverage — it is your return on posted margin. Fees and funding are not included.</p>
    <h3>Does ${ex.name} show PnL automatically?</h3>
    <p>${ex.name} shows live PnL on open positions, but this tool lets you plan and compare scenarios <em>before</em> you trade.</p>
    <h2>More calculators</h2>
    ${relatedPnl(ex)}
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:24px">Educational tool, not financial advice. Estimates may differ from ${ex.name}. The ${ex.name} link is a referral link; we may earn a commission at no cost to you.</p>
`
    + foot('/assets/pnlcalc.js');
}

let n = 0;
for (const ex of EX) {
  const a = path.join(OUT, `${ex.slug}-liquidation-calculator`);
  fs.mkdirSync(a, { recursive: true }); fs.writeFileSync(path.join(a, 'index.html'), liqPage(ex)); n++;
  const b = path.join(OUT, `${ex.slug}-pnl-calculator`);
  fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, 'index.html'), pnlPage(ex)); n++;
  console.log('wrote', ex.slug, '(liquidation + pnl)');
}
console.log('done:', n, 'pages');

// keep sitemap.xml in sync — add any missing per-exchange calculator URLs
try {
  const smp = path.join(OUT, 'sitemap.xml');
  let sm = fs.readFileSync(smp, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  let added = 0;
  for (const ex of EX) {
    for (const suf of ['liquidation-calculator', 'pnl-calculator']) {
      const loc = `https://marginpad.io/${ex.slug}-${suf}/`;
      if (sm.indexOf(loc) === -1) { sm = sm.replace('</urlset>', `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n</urlset>`); added++; }
    }
  }
  if (added) { fs.writeFileSync(smp, sm); console.log('sitemap: +' + added + ' calculator URLs'); }
} catch (e) { console.log('sitemap update skipped:', e.message); }
