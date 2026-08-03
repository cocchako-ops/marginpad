/* Per-coin liquidation SEO pages: /liquidations/btc/ etc. — live data from /api/cg/liquidations (client-side),
   modeled on the /liquidations/ hub. Also links the coins row into the hub + adds sitemap entries (idempotent). */
const fs = require('fs');
const path = require('path');

const COINS = [
  ['BTC', 'Bitcoin'], ['ETH', 'Ethereum'], ['SOL', 'Solana'], ['XRP', 'XRP'],
  ['BNB', 'BNB'], ['DOGE', 'Dogecoin'], ['ADA', 'Cardano'], ['AVAX', 'Avalanche'],
  ['LINK', 'Chainlink'], ['TRX', 'TRON'], ['LTC', 'Litecoin'], ['PEPE', 'Pepe'],
  ['DOT', 'Polkadot'], ['SUI', 'Sui'], ['WIF', 'dogwifhat'], ['HYPE', 'Hyperliquid'],
  ['NEAR', 'NEAR Protocol'], ['APT', 'Aptos'], ['ARB', 'Arbitrum'], ['OP', 'Optimism'],
];

const page = (sym, name) => {
  const low = sym.toLowerCase();
  const others = COINS.filter(c => c[0] !== sym).map(c => `<a href="/liquidations/${c[0].toLowerCase()}/">${c[0]}</a>`).join('\n          ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-18230384038');</script>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>${name} (${sym}) Liquidations Today — Live 24h Data | MarginPad</title>
<meta name="description" content="How much ${name} was liquidated in the last 24 hours — live ${sym} long vs short liquidations, share of the market, and where ${sym} ranks among the most-liquidated coins. Free, updates automatically." />
<meta name="keywords" content="${low} liquidations, ${low} liquidations today, ${name.toLowerCase()} liquidations, ${low} long short liquidations, ${low} futures liquidations, crypto liquidations" />
<link rel="canonical" href="https://marginpad.io/liquidations/${low}/" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#0a0b0d" />
<meta property="og:title" content="${name} (${sym}) Liquidations Today — Live 24h Data" />
<meta property="og:description" content="Live ${sym} futures liquidations: 24h total, longs vs shorts, market share and rank. Free, auto-updating." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://marginpad.io/liquidations/${low}/" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/blog.css" />
<style>
  .lqhero{background:linear-gradient(180deg,var(--panel),#0d0f12);border:1px solid var(--line-bright);border-radius:16px;padding:20px;margin:14px 0 8px}
  .lqhero-top{display:flex;align-items:center;gap:9px;font-family:'Space Mono',monospace;font-size:11px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px}
  .lqdot{width:8px;height:8px;border-radius:50%;background:#2ebd85;box-shadow:0 0 7px #2ebd85;animation:lqp 1.8s ease-in-out infinite}
  @keyframes lqp{0%,100%{opacity:1}50%{opacity:.3}}
  .lqlive-tag{color:#06231d;background:#2ebd85;font-weight:700;padding:2px 6px;border-radius:5px;letter-spacing:.1em}
  .lqtot{font-family:'Space Mono',monospace;font-weight:800;font-size:38px;letter-spacing:-1px;line-height:1}
  @media(max-width:600px){.lqtot{font-size:30px}}
  .lqsub{color:var(--ink-dim);font-size:13px;margin-top:5px}
  .lqls{display:flex;height:11px;border-radius:6px;overflow:hidden;background:var(--line);margin:16px 0 7px}
  .lqls i{display:block;height:100%}.lqls .l{background:#ff5a4d}.lqls .s{background:#2ebd85}
  .lqls-l{display:flex;justify-content:space-between;font-family:'Space Mono',monospace;font-size:12.5px;font-weight:700}
  .lqls-l .lng{color:#ff7b72}.lqls-l .sht{color:#34d99a}
  .lqstats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0 4px}
  @media(max-width:600px){.lqstats{grid-template-columns:1fr}}
  .lqstats div{background:#0c0f13;border:1px solid var(--line);border-radius:12px;padding:12px 14px}
  .lqstats span{display:block;font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-faint)}
  .lqstats b{display:block;font-family:'Space Mono',monospace;font-size:19px;margin-top:4px}
  .lqnote{font-family:'Space Mono',monospace;font-size:11px;color:var(--ink-faint);text-align:center;margin:8px 0 0}
  .lqcta{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 8px}
  .lqcta a{flex:1;min-width:150px;text-align:center;text-decoration:none;font-family:'Space Mono',monospace;font-weight:700;font-size:13.5px;padding:13px 14px;border-radius:11px;border:1px solid var(--line-bright);background:linear-gradient(180deg,var(--panel),#0d0f12);color:var(--ink)}
  .lqcta a.go{background:#c2f64a;color:#0a0b0d;border-color:#c2f64a}
  .lqload{font-family:'Space Mono',monospace;font-size:12.5px;color:var(--ink-faint);padding:16px 0;text-align:center}
  .coins{display:flex;flex-wrap:wrap;gap:7px;margin:6px 0 12px}
  .coins a{font-family:'Space Mono',monospace;font-size:12px;color:var(--ink-dim);text-decoration:none;border:1px solid var(--line-bright);border-radius:8px;padding:6px 11px}
  .coins a:hover{color:#c2f64a;border-color:#c2f64a}
</style>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://marginpad.io/"},{"@type":"ListItem","position":2,"name":"Liquidations","item":"https://marginpad.io/liquidations/"},{"@type":"ListItem","position":3,"name":"${sym}","item":"https://marginpad.io/liquidations/${low}/"}]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How much ${sym} has been liquidated today?","acceptedAnswer":{"@type":"Answer","text":"This page shows the live 24-hour ${name} liquidation total, split into long and short liquidations, aggregated across major exchanges. The number updates automatically."}},{"@type":"Question","name":"What do ${sym} long liquidations mean?","acceptedAnswer":{"@type":"Answer","text":"Long liquidations are leveraged ${name} buyers force-closed by a price drop. A spike in long liquidations often marks local capitulation; a spike in short liquidations marks a squeeze."}},{"@type":"Question","name":"How can I avoid being liquidated on ${sym}?","acceptedAnswer":{"@type":"Answer","text":"Use lower leverage, size positions from your stop distance, and know your liquidation price before you enter — you can calculate it free with MarginPad's liquidation calculator, or practice on the paper-trading terminal with zero risk."}}]}</script>
<script defer src="/assets/sentry.js"></script>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b style="color:#c2f64a">PAD</b></a>
    <nav class="nav"><a href="/markets/">Markets</a><a href="/liquidations/">Liquidations</a><a href="/funding/">Funding</a><a href="/open-interest/">Open Interest</a><a href="/screener">Screener</a></nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / <a href="/liquidations/">Liquidations</a> / ${sym}</div>
  <article>
    <h1>${name} (${sym}) Liquidations Today</h1>
    <p class="lead">Live ${name} futures liquidations over the last 24 hours — total wiped out, longs vs shorts, ${sym}'s share of all crypto liquidations and its rank among the most-liquidated coins. Updates automatically.</p>

    <div class="lqhero">
      <div class="lqhero-top"><span class="lqdot"></span>${sym} liquidations · 24h <span class="lqlive-tag">LIVE</span></div>
      <div id="lqCoin"><div class="lqload">Loading live ${sym} liquidation data…</div></div>
    </div>
    <p class="lqnote" id="lqUpd"></p>

    <div class="lqcta">
      <a class="go" href="/paper-trade?coin=${sym}">Paper-trade ${sym} risk-free →</a>
      <a href="/rekt/">Live liquidation feed</a>
      <a href="/calculators?c=liq">Liquidation calculator</a>
    </div>

    <h2>Other coins</h2>
    <div class="coins">
          <a href="/liquidations/">All coins</a>
          ${others}
    </div>

    <h2>What ${sym} liquidations tell you</h2>
    <p>A <strong>liquidation</strong> is a leveraged position force-closed by the exchange when its margin runs out. When ${name} moves fast, over-leveraged traders get wiped in clusters — and those clusters are information: a spike in <strong>long liquidations</strong> during a dump often marks local capitulation (forced sellers exhausting), while a spike in <strong>short liquidations</strong> during a rally marks a squeeze. Watching the balance between the two on ${sym} helps you avoid entering right before a cascade — or spot the moment one has burned itself out.</p>
    <p>If you trade ${sym} with leverage, know your liquidation price <em>before</em> you enter — the free <a href="/${low}-liquidation-calculator/">${sym} liquidation calculator</a> does it in seconds (and the <a href="/calculators?c=cross">cross-margin version</a> shows how your wallet balance moves it). Better yet, rehearse the trade first on the <a href="/paper-trade?coin=${sym}">paper-trading terminal</a> at the live ${sym} price with zero risk, and keep an eye on the <a href="/calendar/">economic calendar</a> — most violent liquidation cascades happen around FOMC and CPI releases.</p>

    <h2>Where ${sym} liquidations cluster</h2>
    <p>The 24-hour total above tells you <em>how much</em> ${name} leverage was wiped; the <a href="/${low}-liquidation-map/">${sym} liquidation map</a> shows <em>where</em> — plotting every long (red) and short (green) liquidation on the price chart with a level-by-level histogram, so you can see which price bands are magnets for the next cascade. For the wider picture, the <a href="/liquidations/">all-coin liquidations hub</a> ranks ${sym} against every other market, and the <a href="/open-interest/">open-interest</a> and <a href="/funding/">funding</a> pages show whether leverage is building back up or unwinding.</p>
  </article>
  <footer>© MarginPad · <a href="/">Tools</a> · <a href="/liquidations/">Liquidations</a> · <a href="/rekt/">Rekt</a> · <a href="/blog/">Blog</a> · Not financial advice</footer>
</div>
<script>
(function(){
  try{var u='/api/track?t=pageview&p='+encodeURIComponent(location.pathname);if(document.referrer)u+='&r='+encodeURIComponent(document.referrer);if(navigator.sendBeacon)navigator.sendBeacon(u);else fetch(u);}catch(e){}
  function bn(x){x=+x||0;var a=Math.abs(x);if(a>=1e9)return '$'+(x/1e9).toFixed(2)+'B';if(a>=1e6)return '$'+(x/1e6).toFixed(1)+'M';if(a>=1e3)return '$'+(x/1e3).toFixed(0)+'K';return '$'+x.toFixed(0);}
  function render(d){
    var el=document.getElementById('lqCoin');if(!el||!d||!d.coins){if(el)el.innerHTML='<div class="lqload">Data unavailable right now — try the <a href="/rekt/">live feed</a>.</div>';return;}
    var coins=d.coins.slice().sort(function(a,b){return b.liq-a.liq;});
    var idx=coins.findIndex(function(c){return c.s==='${sym}';});
    var c=idx>=0?coins[idx]:null;
    if(!c){el.innerHTML='<div class="lqload">No ${sym} liquidations recorded in the last 24h — quiet day. See <a href="/liquidations/">all coins</a>.</div>';return;}
    var lp=c.liq?c.long/c.liq*100:50,sp=100-lp;
    var share=d.market&&d.market.total?c.liq/d.market.total*100:0;
    el.innerHTML='<div class="lqtot">'+bn(c.liq)+'</div><div class="lqsub">${name} liquidated in the last 24 hours</div>'
      +'<div class="lqls"><i class="l" style="width:'+lp.toFixed(1)+'%"></i><i class="s" style="width:'+sp.toFixed(1)+'%"></i></div>'
      +'<div class="lqls-l"><span class="lng">Longs '+bn(c.long)+' ('+lp.toFixed(0)+'%)</span><span class="sht">'+bn(c.short)+' Shorts</span></div>'
      +'<div class="lqstats">'
      +'<div><span>Rank · most liquidated</span><b>#'+(idx+1)+'</b></div>'
      +'<div><span>Share of all liquidations</span><b>'+share.toFixed(1)+'%</b></div>'
      +'<div><span>Whole market · 24h</span><b>'+bn(d.market?d.market.total:0)+'</b></div>'
      +'</div>';
    var up=document.getElementById('lqUpd');if(up)up.textContent='Aggregated across major exchanges · auto-refreshes every 5 minutes';
  }
  function load(){fetch('/api/cg/liquidations',{cache:'no-store'}).then(function(r){return r.json();}).then(render).catch(function(){render(null);});}
  load();setInterval(load,300000);
})();
</script>
</body>
</html>
`;
};

let n = 0;
for (const [sym, name] of COINS) {
  const dir = path.join(__dirname, '..', 'dist', 'liquidations', sym.toLowerCase());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(sym, name));
  n++;
}

// link the coin pages from the hub (idempotent)
const hub = path.join(__dirname, '..', 'dist', 'liquidations', 'index.html');
let h = fs.readFileSync(hub, 'utf8');
if (!h.includes('id="lqCoinLinks"')) {
  const links = COINS.map(c => `<a href="/liquidations/${c[0].toLowerCase()}/">${c[0]} liquidations</a>`).join('\n      ');
  h = h.replace('<h2>What is a liquidation?</h2>',
    `<h2>Liquidations by coin</h2>\n    <div class="coins" id="lqCoinLinks" style="display:flex;flex-wrap:wrap;gap:7px;margin:6px 0 12px">\n      ${links}\n    </div>\n    <style>#lqCoinLinks a{font-family:'Space Mono',monospace;font-size:12px;color:var(--ink-dim);text-decoration:none;border:1px solid var(--line-bright);border-radius:8px;padding:6px 11px}#lqCoinLinks a:hover{color:#c2f64a;border-color:#c2f64a}</style>\n\n    <h2>What is a liquidation?</h2>`);
  fs.writeFileSync(hub, h);
}

// sitemap (idempotent)
const SP = path.join(__dirname, '..', 'dist', 'sitemap.xml');
if (fs.existsSync(SP)) {
  let xml = fs.readFileSync(SP, 'utf8');
  let added = 0;
  for (const [sym] of COINS) {
    const loc = `https://marginpad.io/liquidations/${sym.toLowerCase()}/`;
    if (!xml.includes(loc)) { xml = xml.replace('</urlset>', `  <url><loc>${loc}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>\n</urlset>`); added++; }
  }
  fs.writeFileSync(SP, xml);
  console.log(`liq coin pages: ${n} written, sitemap +${added}`);
} else {
  console.log(`liq coin pages: ${n} written (no sitemap found)`);
}
