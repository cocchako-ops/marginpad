/* Generates per-exchange landing pages (liquidation + PnL calculators) into ../dist/.
   Run: node build/gen-seo-pages.js   (from project root) */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');

const EX = [
  { name:'Bybit',   slug:'bybit',   ref:'https://www.bybit.com/invite?ref=LZKBERJ',                                                              lev:100, mmr:0.5, maker:0.02, taker:0.055, founded:2018, region:'Global; not available to residents of the United States, the UK (retail) or a handful of sanctioned regions', us:false, funding:'every 8 hours',
    blurb:'Bybit is one of the most popular derivatives exchanges, known for a fast matching engine and deep USDT-perpetual liquidity.',
    detail:'Bybit built its reputation on execution speed and reliability during volatile candles, which is why scalpers and high-frequency traders gravitate to it. Its unified trading account lets spot, USDT-perpetual and inverse contracts share one margin pool, and its copy-trading marketplace is among the largest anywhere.' },
  { name:'Binance', slug:'binance', ref:'https://www.binance.com/register?ref=MAOZM9DS',                                                          lev:125, mmr:0.4, maker:0.02, taker:0.04,  founded:2017, region:'Global via Binance.com; US residents are routed to the separate Binance.US, which does not offer futures', us:false, funding:'every 8 hours (occasionally 4h in extreme funding)',
    blurb:'Binance is the largest crypto exchange by volume, offering the widest range of futures pairs and up to 125x leverage on majors.',
    detail:'Binance runs the deepest order books in crypto, so large orders move the price the least and slippage on the majors is minimal. It lists more perpetual pairs than any rival and its BNB token pays a fee discount. The trade-off is an interface that can overwhelm newcomers and tighter regional restrictions than it once had.' },
  { name:'OKX',     slug:'okx',     ref:'https://okx.com/join/96160298',                                                                          lev:125, mmr:0.5, maker:0.02, taker:0.05,  founded:2017, region:'Global; not available to residents of the United States', us:false, funding:'every 8 hours',
    blurb:'OKX pairs a powerful pro-trading interface with a unified account model and up to 125x leverage on flagship contracts.',
    detail:'OKX is the venue of choice for traders who want professional order types — advanced conditional orders, TWAP, and a genuinely powerful charting stack — tied to a unified account that nets margin across products. Liquidity across the board is strong, and its Web3 wallet bridges into on-chain markets.' },
  { name:'KuCoin',  slug:'kucoin',  ref:'https://www.kucoin.com/r/rf/VHP8AYKY',                                                                   lev:100, mmr:0.5, maker:0.02, taker:0.06,  founded:2017, region:'Global; KuCoin has wound down US access, so it is effectively non-US', us:false, funding:'every 8 hours',
    blurb:'KuCoin Futures is known for its huge altcoin selection, letting you trade leverage on coins many larger venues do not list.',
    detail:'KuCoin is where altcoin traders go first: it lists perpetuals on smaller-cap tokens long before the majors add them, so new narratives are tradable early. Liquidity on the flagship pairs is solid, though thinner names carry wider spreads — size accordingly and treat the liquidation buffer with respect.' },
  { name:'Gate',    slug:'gate',    ref:'https://www.gate.com/VFIWB10KUG?ref=VFIWB10KUG&ref_type=103&ut-m_cmp=rXJBDjtJ&activity_id=1778642196063', lev:100, mmr:0.5, maker:0.02, taker:0.05, founded:2013, region:'Global; not serving US users', us:false, funding:'every 8 hours',
    blurb:'Gate lists thousands of tokens and offers perpetual futures across an enormous range of markets, with up to 100x leverage.',
    detail:'Gate.io has one of the longest track records in the industry and the widest listing catalogue — if a token has a perpetual anywhere, Gate probably has it. That breadth makes it a favourite for long-tail and new-listing plays, with the usual caveat that thinner books mean you should keep leverage modest on obscure pairs.' },
  { name:'Kraken',  slug:'kraken',  ref:'https://invite.kraken.com/JDNW/guj2tf28',                                                                lev:50,  mmr:0.5, maker:0.02, taker:0.05, founded:2011, region:'US-friendly — Kraken is a long-regulated US exchange, though futures availability varies by state and country', us:true, funding:'every 4 hours',
    blurb:'Kraken is a security-first, long-established exchange. Its futures offer more conservative leverage, favouring risk control.',
    detail:'Kraken is the trust-first pick: one of the oldest exchanges still standing, with a strong security record and, importantly, one of the few majors that serves US traders. Its leverage cap is a conservative 50x — a feature, not a bug, for anyone who values a wider liquidation buffer over headline numbers.' },
  { name:'Bitget',  slug:'bitget',  ref:'https://www.bitget.com/referral/register?clacCode=DSSSQKGK',                                             lev:125, mmr:0.5, maker:0.02, taker:0.06, founded:2018, region:'Global; not available to residents of the United States', us:false, funding:'every 8 hours',
    blurb:'Bitget is a top-five futures exchange best known for copy trading — automatically mirror pro traders — with deep USDT-perpetual liquidity and up to 125x leverage.',
    detail:'Bitget turned copy trading into its flagship feature: you can mirror the positions of ranked lead traders automatically, with transparent stats on each. Behind that sits one of the larger futures order books in the market and up to 125x on the majors, making it a genuine top-five venue by derivatives volume.' },
];

const esc = s => String(s).replace(/&/g, '&amp;');
const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = n => n + '%';
const { EC, ACTIVE_LANGS, RTL } = require('./data/exchangecalc-i18n');
function hreflang(slug) {
  let s = `<link rel="alternate" hreflang="en" href="https://marginpad.io/${slug}/" />\n`;
  for (const lc of ACTIVE_LANGS) s += `<link rel="alternate" hreflang="${lc}" href="https://marginpad.io/${lc}/${slug}/" />\n`;
  s += `<link rel="alternate" hreflang="x-default" href="https://marginpad.io/${slug}/" />`;
  return s;
}
function fillT(str, map) { return String(str).replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m)); }

// leverage → liquidation-distance table (isolated-margin estimate), capped at the exchange's max leverage
function levTable(mmr, maxLev) {
  const rows = [10, 25, 50, 100, 125].filter(l => l <= maxLev);
  const cells = rows.map(l => {
    const dist = (1 / l - mmr / 100) * 100;             // % adverse move to liquidation (long)
    return `<tr><td>${l}×</td><td>−${dist.toFixed(2)}%</td><td>${(100 / l).toFixed(2)}%</td></tr>`;
  }).join('');
  return `<table class="lvtab"><thead><tr><th>Leverage</th><th>Move to liquidation</th><th>Initial margin</th></tr></thead><tbody>${cells}</tbody></table>`;
}

// compact "how X compares" table against the rest
function compareTable(ex) {
  const rows = EX.map(e => `<tr${e.slug === ex.slug ? ' class="self"' : ''}><td>${e.name}${e.slug === ex.slug ? ' <span class="you">this page</span>' : ''}</td><td>${e.lev}×</td><td>${pct(e.taker)}</td><td>~${pct(e.mmr)}</td></tr>`).join('');
  return `<table class="lvtab"><thead><tr><th>Exchange</th><th>Max leverage</th><th>Taker fee</th><th>Maint. margin</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const EXTRA_CSS = `<style>
  .lvtab{width:100%;border-collapse:collapse;margin:14px 0 18px;font-size:14px}
  .lvtab th,.lvtab td{padding:10px 13px;border-bottom:1px solid var(--line);text-align:left}
  .lvtab th{font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-dim)}
  .lvtab td{font-family:'Space Mono',monospace;color:var(--ink)}
  .lvtab td:first-child{font-family:'Bricolage Grotesque',sans-serif;font-weight:700}
  .lvtab tr.self td{background:rgba(194,246,74,.05)}
  .lvtab .you{font-family:'Space Mono',monospace;font-size:9px;color:#c2f64a;text-transform:uppercase;letter-spacing:.05em;margin-left:5px}
  .avail{display:inline-flex;align-items:center;gap:7px;font-family:'Space Mono',monospace;font-size:12px;padding:6px 11px;border-radius:8px;border:1px solid var(--line-bright);margin:2px 0 14px}
  .avail.no{color:#ff8a80}.avail.yes{color:#34d99a}
  @media(max-width:600px){.lvtab{display:block;overflow-x:auto;white-space:nowrap}}
</style>`;

function head(o) {
  return `<!DOCTYPE html>
<html lang="${o.lang || 'en'}"${o.dir ? ' dir="rtl"' : ''}>
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
${o.hreflang || ''}
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
${EXTRA_CSS}
${o.ld}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":${JSON.stringify(o.crumbHome || 'Home')},"item":"https://marginpad.io${o.homeHref || '/'}"},{"@type":"ListItem","position":2,"name":${JSON.stringify(o.bcName)},"item":"${o.url}"}]}</script>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="${o.homeHref || '/'}">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="${o.homeHref || '/'}">${o.navCalc || 'Calculators'}</a><a href="/blog/">${o.navBlog || 'Blog'}</a></nav>
  </header>
  <div class="crumb"><a href="${o.homeHref || '/'}">${o.crumbHome || 'Home'}</a> / ${o.crumb}</div>
  <article>`;
}
function foot(scriptSrc, o) {
  o = o || {};
  return `  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="${o.homeHref || '/'}">${o.navCalc || 'Calculators'}</a> · <a href="/blog/">${o.navBlog || 'Blog'}</a></span>
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
// live BTC price → prefill the entry field (same pattern as the per-coin pages)
const LIVEPX = `<script>(function(){var el=document.getElementById('livePx');if(!el)return;fetch('/api/price?symbol=BTC').then(function(r){return r.ok?r.json():null;}).then(function(d){if(d&&d.price>0){var p=+d.price;el.innerHTML='<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2ebd85;margin-right:7px;vertical-align:middle"></span>Live BTC price: <b style="color:#c2f64a">$'+p.toLocaleString('en-US',{maximumFractionDigits:2})+'</b> — prefilled below';var e=document.getElementById('liqEntry')||document.getElementById('pnlEntry');if(e){e.value=Math.round(p);e.dispatchEvent(new Event('input'));}}else{el.style.display='none';}}).catch(function(){el.style.display='none';});})();</script>`;

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
  const availClass = ex.us ? 'yes' : 'no';
  const availText = ex.us ? `Available to US traders — ${ex.region}.` : `Not available to US residents. ${ex.region}.`;
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"${ex.name} Liquidation Calculator","applicationCategory":"FinanceApplication","operatingSystem":"Any (web browser)","url":"${url}","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":"${desc}"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How do I calculate my liquidation price on ${ex.name}?","acceptedAnswer":{"@type":"Answer","text":"Enter entry price, leverage and direction. Liquidation = Entry x (1 - 1/Leverage + MMR) for a long and Entry x (1 + 1/Leverage - MMR) for a short."}},{"@type":"Question","name":"What is the maximum leverage on ${ex.name}?","acceptedAnswer":{"@type":"Answer","text":"${ex.name} offers up to ${ex.lev}x leverage on flagship perpetuals. The maximum varies by contract, region and account tier."}},{"@type":"Question","name":"What are ${ex.name}'s trading fees?","acceptedAnswer":{"@type":"Answer","text":"${ex.name}'s base USDT-perpetual fees are about ${pct(ex.maker)} maker and ${pct(ex.taker)} taker, before VIP tiers or token discounts. Funding is exchanged between longs and shorts ${ex.funding}."}},{"@type":"Question","name":"Is ${ex.name} available in the US?","acceptedAnswer":{"@type":"Answer","text":"${availText}"}},{"@type":"Question","name":"How do I avoid liquidation on ${ex.name}?","acceptedAnswer":{"@type":"Answer","text":"Use lower leverage, set a stop-loss inside your liquidation level, and size positions from your stop distance rather than a round dollar figure."}}]}</script>`;
  return head({ title, desc, url, crumb: `${ex.name} liquidation calculator`, bcName: `${ex.name} Liquidation Calculator`, ld, hreflang: hreflang(ex.slug + '-liquidation-calculator'),
    keywords: `${ex.name.toLowerCase()} liquidation calculator, ${ex.name.toLowerCase()} liquidation price, ${ex.name.toLowerCase()} futures calculator, ${ex.name.toLowerCase()} leverage calculator, ${ex.name.toLowerCase()} maintenance margin` })
    + `
    <h1>${ex.name} Liquidation Calculator</h1>
    <p class="lead">Find your exact liquidation price on ${ex.name} futures — for any leverage, long or short. Free, instant, and private (it runs in your browser).</p>
    <p style="font-family:'Space Mono',monospace;font-size:13px;color:var(--ink-dim);margin:-4px 0 14px" id="livePx"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2ebd85;margin-right:7px;vertical-align:middle"></span>Live BTC price loading…</p>
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
    <span class="avail ${availClass}">${ex.us ? '✓' : '✕'} ${ex.us ? 'US-available' : 'Non-US'} · founded ${ex.founded}</span>

    <h2>How liquidation works on ${ex.name}</h2>
    <p>${ex.blurb} ${ex.detail}</p>
    <p>On ${ex.name}, an isolated-margin position is liquidated when losses eat through your posted margin. The estimate is <code>Entry × (1 − 1/Leverage + MMR)</code> for a long and <code>Entry × (1 + 1/Leverage − MMR)</code> for a short, where <b>MMR</b> is the maintenance margin rate — roughly <b>${pct(ex.mmr)}</b> on ${ex.name}'s flagship contracts. Because ${ex.name} allows up to <b>${ex.lev}× leverage</b>, the liquidation buffer can get thin fast; the higher the leverage, the closer liquidation sits to your entry.</p>

    <h2>${ex.name} liquidation distance by leverage</h2>
    <p>How far ${ex.name}'s price has to move against you before an isolated-margin long is liquidated, at ${pct(ex.mmr)} maintenance margin:</p>
    ${levTable(ex.mmr, ex.lev)}
    <p>At ${ex.lev}× — ${ex.name}'s cap on the majors — roughly a <b>${(100 / ex.lev).toFixed(2)}%</b> move wipes the position. That is why most survivors trade well below the maximum: a 5–20× position leaves room for normal volatility, funding and fees before the exchange steps in.</p>

    <h2>Worked example</h2>
    <p>A ${lev}× long on ${ex.name} entered at <code>$${fmt(entry)}</code> with a ${ex.mmr}% maintenance margin rate is liquidated at about:</p>
    <div class="example">
      <div class="row"><span>Liquidation price</span><b>$${fmt(liq)}</b></div>
      <div class="row"><span>Move to liquidation</span><b>−${dist.toFixed(2)}%</b></div>
    </div>
    <p>Set your stop-loss comfortably inside that level. See also the <a href="/blog/what-is-liquidation-in-crypto/">guide to avoiding liquidation</a> and <a href="/blog/how-to-avoid-liquidation-crypto/">seven ways traders get liquidated</a>.</p>

    <h2>Fees &amp; funding on ${ex.name}</h2>
    <p>${ex.name}'s base USDT-perpetual fees are about <b>${pct(ex.maker)} maker</b> and <b>${pct(ex.taker)} taker</b>, before VIP tiers or token discounts — small on any single trade, but they compound if you trade often. On top of that, perpetuals charge <b>funding</b> ${ex.funding}: when the market is crowded long, longs pay shorts, and vice-versa. Funding is not part of the liquidation formula, but it drains (or tops up) your margin every cycle, so a heavily-funded position sits closer to liquidation than the raw price math suggests. Model it with the <a href="/funding-fee-calculator/">funding-fee calculator</a>.</p>

    <h2>How ${ex.name} compares</h2>
    <p>Leverage caps and maintenance margins differ across venues, and both move your liquidation price. Here is ${ex.name} against the other majors:</p>
    ${compareTable(ex)}
    <p>Higher leverage and a lower maintenance margin both push liquidation closer to your entry, so the "best" venue depends on how much buffer you want. See the full <a href="/best-crypto-futures-exchange/">best crypto futures exchange</a> breakdown, or a head-to-head such as <a href="/${ex.slug === 'binance' ? 'bybit-vs-binance' : ex.slug + '-vs-' + (ex.slug === 'bybit' ? 'binance' : 'bybit')}/">${ex.name} vs ${ex.slug === 'bybit' ? 'Binance' : 'Bybit'}</a>.</p>

    <h2>Where ${ex.name} is available</h2>
    <p class="avail ${availClass}" style="display:block;line-height:1.5;white-space:normal">${availText}</p>
    <p>Availability, leverage caps and product access change with regulation and by region — always confirm on ${ex.name} directly before funding an account. If ${ex.name} is not available where you are, ${ex.us ? 'it is one of the few majors that serves US traders' : 'a US-regulated venue such as <a href="/kraken-liquidation-calculator/">Kraken</a> may fit better'}. Practice the strategy either way on the free <a href="/paper-trade">paper-trading terminal</a> — no signup, real ${ex.name}-style liquidation logic, zero risk.</p>

    <h2>FAQ</h2>
    <h3>What is the maximum leverage on ${ex.name}?</h3>
    <p>Up to <b>${ex.lev}×</b> on flagship perpetuals; the cap varies by contract, region and account tier.</p>
    <h3>How do I avoid liquidation on ${ex.name}?</h3>
    <p>Use lower leverage, set a stop-loss, and size by risk — see our <a href="/blog/crypto-position-sizing-risk-management/">position sizing guide</a>.</p>
    <h3>Does ${ex.name} use isolated or cross margin?</h3>
    <p>${ex.name} offers both. This calculator estimates <b>isolated</b> margin (only the margin on that position is at risk). In <b>cross</b> margin your whole balance backs the trade, pushing liquidation further away — model that with the <a href="/calculators?c=cross">cross-margin calculator</a>.</p>

    <h2>More calculators</h2>
    ${relatedLiq(ex)}
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:24px">Educational tool, not financial advice. Fees, leverage caps and availability are approximate and change by tier, region and over time — confirm on ${ex.name}. The ${ex.name} link is a referral link; we may earn a commission at no cost to you.</p>
${LIVEPX}
`
    + foot('/assets/liqcalc.js');
}

function pnlPage(ex) {
  const url = `https://marginpad.io/${ex.slug}-pnl-calculator/`;
  const title = `${ex.name} PnL Calculator (2026) — Profit, ROI & ROE`;
  const desc = `Free ${ex.name} PnL calculator: enter entry, exit and leverage to see profit, ROI and leveraged ROE for any ${ex.name} futures trade in one click, long or short. No signup.`;
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"${ex.name} PnL Calculator","applicationCategory":"FinanceApplication","operatingSystem":"Any (web browser)","url":"${url}","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":"${desc}"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How do I calculate PnL on ${ex.name}?","acceptedAnswer":{"@type":"Answer","text":"PnL = (exit - entry) x size for a long, or (entry - exit) x size for a short. ROE multiplies the price ROI by your leverage."}},{"@type":"Question","name":"What is ROE on ${ex.name} futures?","acceptedAnswer":{"@type":"Answer","text":"ROE is the return on the margin you posted, amplified by leverage. A 10% move at 10x leverage is roughly a 100% return on margin."}},{"@type":"Question","name":"Do ${ex.name} fees reduce my PnL?","acceptedAnswer":{"@type":"Answer","text":"Yes. ${ex.name} charges about ${pct(ex.taker)} taker per side plus funding ${ex.funding}, so net profit is a little below the raw price PnL. This tool shows gross PnL; subtract roughly two taker fees for a round trip."}}]}</script>`;
  return head({ title, desc, url, crumb: `${ex.name} PnL calculator`, bcName: `${ex.name} PnL Calculator`, ld, hreflang: hreflang(ex.slug + '-pnl-calculator'),
    keywords: `${ex.name.toLowerCase()} pnl calculator, ${ex.name.toLowerCase()} profit calculator, ${ex.name.toLowerCase()} roi calculator, ${ex.name.toLowerCase()} futures pnl, ${ex.name.toLowerCase()} roe calculator` })
    + `
    <h1>${ex.name} PnL Calculator</h1>
    <p class="lead">Calculate your profit and loss, ROI and leveraged ROE for any ${ex.name} futures trade — long or short. Free, instant, no signup.</p>
    <p style="font-family:'Space Mono',monospace;font-size:13px;color:var(--ink-dim);margin:-4px 0 14px" id="livePx"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2ebd85;margin-right:7px;vertical-align:middle"></span>Live BTC price loading…</p>
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
    <span class="avail ${ex.us ? 'yes' : 'no'}">${ex.us ? '✓ US-available' : '✕ Non-US'} · base taker ${pct(ex.taker)}</span>

    <h2>How PnL and ROE work on ${ex.name}</h2>
    <p>${ex.blurb} Your raw profit on a ${ex.name} trade is the price move times your position size: <code>(Exit − Entry) × Size</code> for a long, and the reverse for a short. <b>Price ROI</b> is the percentage the asset moved; <b>ROE</b> is your return on the margin you actually posted, which ${ex.name}'s leverage multiplies. ${ex.detail}</p>

    <h2>Worked example</h2>
    <p>A 0.5-coin long opened at <code>$60,000</code> and closed at <code>$66,000</code> at 10× leverage:</p>
    <div class="example">
      <div class="row"><span>Profit (gross)</span><b>+$3,000.00</b></div>
      <div class="row"><span>Price ROI</span><b>+10.00%</b></div>
      <div class="row"><span>ROE (10×)</span><b>+100.00%</b></div>
    </div>
    <p>Leverage cuts both ways — the same move down would be a 100% loss of margin. Plan your exit and check your <a href="/${ex.slug}-liquidation-calculator/">${ex.name} liquidation price</a> first.</p>

    <h2>ROE by leverage — same 10% move</h2>
    <p>ROE is just the price move multiplied by leverage. A single 10% winning move on ${ex.name} returns, on the margin you posted:</p>
    <table class="lvtab"><thead><tr><th>Leverage</th><th>ROE on a +10% move</th><th>ROE on a −10% move</th></tr></thead><tbody>
      ${[5, 10, 25, 50, ex.lev].filter((v, i, a) => a.indexOf(v) === i && v <= ex.lev).map(l => `<tr><td>${l}×</td><td style="color:#34d99a">+${(10 * l).toLocaleString()}%</td><td style="color:#ff8a80">−${(10 * l).toLocaleString()}%</td></tr>`).join('')}
    </tbody></table>
    <p>The higher the leverage, the faster ROE compounds — and the smaller the move that liquidates you. That symmetry is why position sizing beats chasing leverage.</p>

    <h2>Fees &amp; funding on ${ex.name}</h2>
    <p>This tool shows <b>gross</b> PnL. On ${ex.name} you also pay about <b>${pct(ex.taker)} taker</b> per side (so roughly <b>${(ex.taker * 2).toFixed(3)}%</b> for a round trip at market), plus <b>funding</b> ${ex.funding} while the position is open. On a fast scalp the fees can outweigh a small edge, which is why makers (resting limit orders at <b>${pct(ex.maker)}</b>) keep more of their profit. Subtract those costs from the figure above for your true net result.</p>

    <h2>FAQ</h2>
    <h3>How is ROE different from ROI on ${ex.name}?</h3>
    <p>Price ROI is the raw % move. ROE multiplies it by your leverage — it is your return on posted margin. Fees and funding are not included in the gross figure.</p>
    <h3>Does ${ex.name} show PnL automatically?</h3>
    <p>${ex.name} shows live PnL on open positions, but this tool lets you plan and compare scenarios <em>before</em> you trade — and see how leverage changes the ROE.</p>
    <h3>Is ${ex.name} available in the US?</h3>
    <p>${ex.us ? `Yes — ${ex.region}.` : `No — ${ex.region}. US traders can use a domestic venue such as <a href="/kraken-pnl-calculator/">Kraken</a>.`}</p>

    <h2>More calculators</h2>
    ${relatedPnl(ex)}
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:24px">Educational tool, not financial advice. Fees and availability are approximate and change by tier, region and over time — confirm on ${ex.name}. The ${ex.name} link is a referral link; we may earn a commission at no cost to you.</p>
${LIVEPX}
`
    + foot('/assets/pnlcalc.js');
}

// ---- translated (lean, fully-native) lang variants ----
const LIVEPX_LANG = `<script>(function(){var el=document.getElementById('livePx');if(!el)return;fetch('/api/price?symbol=BTC').then(function(r){return r.ok?r.json():null;}).then(function(d){if(d&&d.price>0){var p=+d.price;el.innerHTML='<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2ebd85;margin-right:7px;vertical-align:middle"></span>BTC <b style="color:#c2f64a">$'+p.toLocaleString('en-US',{maximumFractionDigits:2})+'</b>';var e=document.getElementById('liqEntry')||document.getElementById('pnlEntry');if(e){e.value=Math.round(p);e.dispatchEvent(new Event('input'));}}else{el.style.display='none';}}).catch(function(){el.style.display='none';});})();</script>`;

function liqPageLang(ex, lang) {
  const L = EC[lang]; const home = `/${lang}/`;
  const map = { X: ex.name, XL: ex.name.toLowerCase(), LEV: ex.lev, ENTRY: '$' + fmt(60000), MMR: ex.mmr, PCT: (100 / ex.lev).toFixed(2) };
  const T = m => fillT(m, map);
  const url = `https://marginpad.io/${lang}/${ex.slug}-liquidation-calculator/`;
  const entry = 60000, mmr = ex.mmr / 100, liq = entry * (1 - 1 / 10 + mmr), dist = (1 - liq / entry) * 100;
  const others = EX.filter(o => o.slug !== ex.slug).slice(0, 4);
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":${JSON.stringify(T(L.liqH1))},"applicationCategory":"FinanceApplication","operatingSystem":"Any (web browser)","url":"${url}","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":${JSON.stringify(T(L.liqDesc))}}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":${JSON.stringify(T(L.liqFaqQ))},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(T(L.liqFaqA))}}},{"@type":"Question","name":${JSON.stringify(T(L.liqFaqQ2))},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(T(L.liqFaqA2))}}}]}</script>`;
  return head({ lang, dir: RTL[lang] ? 1 : 0, title: T(L.liqTitle), desc: T(L.liqDesc), url, crumb: T(L.liqCrumb), bcName: T(L.liqCrumb), ld, hreflang: hreflang(ex.slug + '-liquidation-calculator'), keywords: T(L.liqKw), homeHref: home, navCalc: L.navCalc, navBlog: L.navBlog, crumbHome: L.crumbHome })
    + `
    <h1>${T(L.liqH1)}</h1>
    <p class="lead">${T(L.liqLead)}</p>
    <p style="font-family:'Space Mono',monospace;font-size:13px;color:var(--ink-dim);margin:-4px 0 14px" id="livePx"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2ebd85;margin-right:7px;vertical-align:middle"></span>${L.liveBtc}</p>
    <div class="calc">
      <div class="calc-in">
        <div class="seg" id="liqSeg"><button class="on" data-side="long">${L.long}</button><button data-side="short">${L.short}</button></div>
        <label>${L.lblEntry}</label><input id="liqEntry" type="number" value="60000" step="any">
        <label>${L.lblLev}</label><input id="liqLev" type="number" value="10" step="any">
        <label>${L.lblMmr}</label><input id="liqMmr" type="number" value="${ex.mmr}" step="any">
      </div>
      <div class="calc-out">
        <div class="col">${L.outLiq}</div><div class="big" id="liqOut">—</div>
        <div class="rr"><span>${L.outDist}</span><b id="liqDist">—</b></div>
      </div>
    </div>
    <a class="exbtn" data-ex="${ex.name}" style="background:${ex.accent};color:${ex.fg}" href="${esc(ex.ref)}" target="_blank" rel="sponsored noopener noreferrer">${T(L.trade)}</a>
    <h2>${T(L.liqHowH)}</h2>
    <p>${T(L.liqHowP)}</p>
    <h2>${T(L.liqExH)}</h2>
    <p>${fillT(L.liqExIntro, { X: ex.name, ENTRY: '$' + fmt(entry), MMR: ex.mmr })}</p>
    <div class="example">
      <div class="row"><span>${L.exLiqL}</span><b>$${fmt(liq)}</b></div>
      <div class="row"><span>${L.exMoveL}</span><b>−${dist.toFixed(2)}%</b></div>
    </div>
    <p>${T(L.liqExAfter)}</p>
    <h2>${L.faqH}</h2>
    <h3>${T(L.liqFaqQ)}</h3><p>${T(L.liqFaqA)}</p>
    <h3>${T(L.liqFaqQ2)}</h3><p>${T(L.liqFaqA2)}</p>
    <h2>${L.moreCalc}</h2>
    <div class="related">
      <a href="${home}">${L.relAll}</a>
      <a href="/${lang}/${ex.slug}-pnl-calculator/">${fillT(L.relPnl, { X: ex.name })}</a>
      ${others.map(o => `<a href="/${lang}/${o.slug}-liquidation-calculator/">${fillT(L.relLiq, { X: o.name })}</a>`).join('\n      ')}
    </div>
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:24px">${T(L.disc)}</p>
${LIVEPX_LANG}
`
    + foot('/assets/liqcalc.js', { homeHref: home, navCalc: L.navCalc, navBlog: L.navBlog });
}

function pnlPageLang(ex, lang) {
  const L = EC[lang]; const home = `/${lang}/`;
  const map = { X: ex.name, XL: ex.name.toLowerCase() };
  const T = m => fillT(m, map);
  const url = `https://marginpad.io/${lang}/${ex.slug}-pnl-calculator/`;
  const others = EX.filter(o => o.slug !== ex.slug).slice(0, 4);
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":${JSON.stringify(T(L.pnlH1))},"applicationCategory":"FinanceApplication","operatingSystem":"Any (web browser)","url":"${url}","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":${JSON.stringify(T(L.pnlDesc))}}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":${JSON.stringify(T(L.pnlFaqQ))},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(T(L.pnlFaqA))}}},{"@type":"Question","name":${JSON.stringify(T(L.pnlFaqQ2))},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(T(L.pnlFaqA2))}}}]}</script>`;
  return head({ lang, dir: RTL[lang] ? 1 : 0, title: T(L.pnlTitle), desc: T(L.pnlDesc), url, crumb: T(L.pnlCrumb), bcName: T(L.pnlCrumb), ld, hreflang: hreflang(ex.slug + '-pnl-calculator'), keywords: T(L.pnlKw), homeHref: home, navCalc: L.navCalc, navBlog: L.navBlog, crumbHome: L.crumbHome })
    + `
    <h1>${T(L.pnlH1)}</h1>
    <p class="lead">${T(L.pnlLead)}</p>
    <p style="font-family:'Space Mono',monospace;font-size:13px;color:var(--ink-dim);margin:-4px 0 14px" id="livePx"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2ebd85;margin-right:7px;vertical-align:middle"></span>${L.liveBtc}</p>
    <div class="calc">
      <div class="calc-in">
        <div class="seg" id="pnlSeg"><button class="on" data-side="long">${L.long}</button><button data-side="short">${L.short}</button></div>
        <label>${L.lblEntry}</label><input id="pnlEntry" type="number" value="60000" step="any">
        <label>${L.lblExit}</label><input id="pnlExit" type="number" value="66000" step="any">
        <label>${L.lblQty}</label><input id="pnlQty" type="number" value="0.5" step="any">
        <label>${L.lblLevRoe}</label><input id="pnlLev" type="number" value="10" step="any">
      </div>
      <div class="calc-out">
        <div class="col">${L.outPnl}</div><div class="big" id="pnlOut">—</div>
        <div class="rr"><span>${L.outRoi}</span><b id="pnlRoi">—</b></div>
        <div class="rr"><span>${L.outRoe}</span><b id="pnlRoe">—</b></div>
      </div>
    </div>
    <a class="exbtn" data-ex="${ex.name}" style="background:${ex.accent};color:${ex.fg}" href="${esc(ex.ref)}" target="_blank" rel="sponsored noopener noreferrer">${T(L.trade)}</a>
    <h2>${T(L.pnlHowH)}</h2>
    <p>${T(L.pnlHowP)}</p>
    <h2>${T(L.pnlExH)}</h2>
    <p>${T(L.pnlExIntro)}</p>
    <div class="example">
      <div class="row"><span>${L.exProfitL}</span><b>+$3,000.00</b></div>
      <div class="row"><span>${L.exRoiL}</span><b>+10.00%</b></div>
      <div class="row"><span>${L.exRoeL}</span><b>+100.00%</b></div>
    </div>
    <p>${T(L.pnlExAfter)}</p>
    <h2>${L.faqH}</h2>
    <h3>${T(L.pnlFaqQ)}</h3><p>${T(L.pnlFaqA)}</p>
    <h3>${T(L.pnlFaqQ2)}</h3><p>${T(L.pnlFaqA2)}</p>
    <h2>${L.moreCalc}</h2>
    <div class="related">
      <a href="${home}">${L.relAll}</a>
      <a href="/${lang}/${ex.slug}-liquidation-calculator/">${fillT(L.relLiq, { X: ex.name })}</a>
      ${others.map(o => `<a href="/${lang}/${o.slug}-pnl-calculator/">${fillT(L.relPnl, { X: o.name })}</a>`).join('\n      ')}
    </div>
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:24px">${T(L.disc)}</p>
${LIVEPX_LANG}
`
    + foot('/assets/pnlcalc.js', { homeHref: home, navCalc: L.navCalc, navBlog: L.navBlog });
}

let n = 0;
for (const ex of EX) {
  const a = path.join(OUT, `${ex.slug}-liquidation-calculator`);
  fs.mkdirSync(a, { recursive: true }); fs.writeFileSync(path.join(a, 'index.html'), liqPage(ex)); n++;
  const b = path.join(OUT, `${ex.slug}-pnl-calculator`);
  fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, 'index.html'), pnlPage(ex)); n++;
  // translated variants (EU langs in EC)
  for (const lc of ACTIVE_LANGS) {
    const la = path.join(OUT, lc, `${ex.slug}-liquidation-calculator`);
    fs.mkdirSync(la, { recursive: true }); fs.writeFileSync(path.join(la, 'index.html'), liqPageLang(ex, lc)); n++;
    const lb = path.join(OUT, lc, `${ex.slug}-pnl-calculator`);
    fs.mkdirSync(lb, { recursive: true }); fs.writeFileSync(path.join(lb, 'index.html'), pnlPageLang(ex, lc)); n++;
  }
  console.log('wrote', ex.slug, '(liquidation + pnl, en +', ACTIVE_LANGS.length, 'langs)');
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
