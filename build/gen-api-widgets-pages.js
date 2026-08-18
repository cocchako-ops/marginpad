/* /api/ (developer JSON API docs) + /widgets/ (embeddable calculator) — multilingual.
   English at /api/ & /widgets/ plus 12 translated variants at /<lang>/api/ & /<lang>/widgets/ (hreflang).
   Prose comes from build/data/aw-i18n.js (BUNDLES, via subagent translation); code/endpoints/JSON stay literal.
   Run: node build/gen-api-widgets-pages.js */
const fs = require('fs');
const path = require('path');
const { BUNDLES } = require('./data/aw-i18n');
const DIST = path.join(__dirname, '..', 'dist');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';
// 2026-08-18: emptied deliberately. 1,008 translated subpages drew 47 pageviews and 7 Google
// visits in 90 days while multiplying every duplicate signal across the domain. This list drives
// both page generation AND the hreflang alternates, so an empty list stops writing the pages and
// stops advertising them. Restore by putting the codes back - dictionaries are untouched.
// was: const LANG_CODES = ['de', 'es', 'pt', 'fr', 'nl', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id'];
const LANG_CODES = [];
const RTL = { ar: 1 };
const escAttr = s => String(s).replace(/&(?!amp;|lt;|gt;|quot;)/g, '&amp;').replace(/"/g, '&quot;');

function hreflang(page) {
  let s = `<link rel="alternate" hreflang="en" href="https://marginpad.io/${page}/" />\n`;
  for (const lc of LANG_CODES) s += `<link rel="alternate" hreflang="${lc}" href="https://marginpad.io/${lc}/${page}/" />\n`;
  s += `<link rel="alternate" hreflang="x-default" href="https://marginpad.io/${page}/" />`;
  return s;
}

function apiPage(lang) {
  const t = BUNDLES[lang || 'en'].api, code = lang || 'en';
  const home = lang ? `/${lang}/` : '/', url = `https://marginpad.io/${lang ? lang + '/' : ''}api/`;
  return `<!DOCTYPE html>
<html lang="${code}"${RTL[lang] ? ' dir="rtl"' : ''}>
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>${escAttr(t.metaTitle)} | MarginPad</title>
<meta name="description" content="${escAttr(t.metaDesc)}" />
<meta name="keywords" content="${escAttr(t.keywords)}" />
<link rel="canonical" href="${url}" />
${hreflang('api')}
<meta property="og:title" content="${escAttr(t.ogTitle)}" />
<meta property="og:description" content="${escAttr(t.ogDesc)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="dns-prefetch" href="https://fonts.gstatic.com" />
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/blog.css" />
<style>
  pre{background:var(--panel);border:1px solid var(--line-bright);border-left:3px solid var(--lime);border-radius:8px;padding:14px 16px;margin:12px 0;overflow-x:auto;font-family:'Space Mono',monospace;font-size:13px;color:var(--ink);line-height:1.5}
  .ep{font-family:'Space Mono',monospace;font-size:14px;color:var(--lime);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:18px 0 8px;word-break:break-all}
  .ep b{color:#2ebd85}
  table.params{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:14px}
  table.params td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
  table.params td:first-child{font-family:'Space Mono',monospace;color:var(--ink);white-space:nowrap;width:120px}
  table.params td:last-child{color:var(--ink-dim)}
</style>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebAPI","name":"MarginPad API","description":"Free JSON API for crypto futures calculations: liquidation price, position size, PnL, risk/reward and take-profit.","url":"https://marginpad.io/api/","documentation":"https://marginpad.io/api/","provider":{"@type":"Organization","name":"MarginPad"}}
</script>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="${home}">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="${home}">${t.navCalc}</a><a href="/blog/">${t.navBlog}</a><a href="${url}">API</a></nav>
  </header>

  <div class="crumb"><a href="${home}">${t.crumbHome}</a> / API</div>
  <article>
    <h1>MarginPad API</h1>
    <p class="lead">${t.lead}</p>

    <pre>Base URL   https://marginpad.io/api
Method     GET
Auth       none
CORS       enabled (Access-Control-Allow-Origin: *)
Format     JSON</pre>

    <h2>${t.h2liq}</h2>
    <div class="ep"><b>GET</b> /api/liquidation?entry=60000&amp;leverage=10&amp;side=long&amp;mmr=0.5</div>
    <table class="params">
      <tr><td>entry</td><td>${t.p_entry_req}</td></tr>
      <tr><td>leverage</td><td>${t.p_lev_req}</td></tr>
      <tr><td>side</td><td>${t.p_side_opt}</td></tr>
      <tr><td>mmr</td><td>${t.p_mmr_opt}</td></tr>
    </table>
    <pre>{
  "side": "long",
  "liquidationPrice": 54300,
  "distancePct": -9.5
}</pre>

    <h2>${t.h2size}</h2>
    <div class="ep"><b>GET</b> /api/position-size?balance=5000&amp;risk=1&amp;entry=60000&amp;stop=58800&amp;leverage=10</div>
    <table class="params">
      <tr><td>balance</td><td>${t.p_balance_req}</td></tr>
      <tr><td>risk</td><td>${t.p_risk_req}</td></tr>
      <tr><td>entry</td><td>${t.p_entry_req}</td></tr>
      <tr><td>stop</td><td>${t.p_stop_req}</td></tr>
      <tr><td>leverage</td><td>${t.p_lev_margin_opt}</td></tr>
    </table>
    <pre>{ "positionSize": 0.041667, "notional": 2500, "riskAmount": 50, "marginRequired": 250 }</pre>

    <h2>${t.h2pnl}</h2>
    <div class="ep"><b>GET</b> /api/pnl?entry=60000&amp;exit=66000&amp;size=0.5&amp;leverage=10&amp;side=long</div>
    <pre>{ "pnl": 3000, "roiPct": 10, "roePct": 100 }</pre>

    <h2>${t.h2rr}</h2>
    <div class="ep"><b>GET</b> /api/risk-reward?entry=60000&amp;stop=58000&amp;tp=66000</div>
    <pre>{ "riskRewardRatio": 3, "riskPerUnit": 2000, "rewardPerUnit": 6000, "breakevenWinRatePct": 25 }</pre>

    <h2>${t.h2tp}</h2>
    <div class="ep"><b>GET</b> /api/take-profit?entry=60000&amp;leverage=10&amp;roe=75&amp;side=long</div>
    <pre>{ "targetExitPrice": 64500, "priceMovePct": 7.5 }</pre>

    <h2>${t.h2notes}</h2>
    <p>${t.notes}</p>

    <div class="endcta">
      <h3>${t.ctaH}</h3>
      <p>${t.ctaP}</p>
      <a class="cta" href="${home}#liq">${t.ctaBtn} →</a>
    </div>
  </article>

  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="${home}">${t.navCalc}</a> · <a href="/blog/">${t.navBlog}</a> · <a href="${url}">API</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="/privacy/">Privacy</a></span>
  </footer>
</div>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;
}

function widgetsPage(lang) {
  const t = BUNDLES[lang || 'en'].widgets, code = lang || 'en';
  const home = lang ? `/${lang}/` : '/', url = `https://marginpad.io/${lang ? lang + '/' : ''}widgets/`;
  return `<!DOCTYPE html>
<html lang="${code}"${RTL[lang] ? ' dir="rtl"' : ''}>
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>${escAttr(t.metaTitle)} | MarginPad</title>
<meta name="description" content="${escAttr(t.metaDesc)}" />
<meta name="keywords" content="${escAttr(t.keywords)}" />
<link rel="canonical" href="${url}" />
${hreflang('widgets')}
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#0a0b0d" />
<meta property="og:title" content="${escAttr(t.metaTitle)}" />
<meta property="og:description" content="${escAttr(t.ogDesc)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="dns-prefetch" href="https://fonts.gstatic.com" />
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/blog.css" />
<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"MarginPad Liquidation Calculator Widget","applicationCategory":"FinanceApplication","operatingSystem":"Any (web browser)","url":"https://marginpad.io/widgets/","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":"Free embeddable crypto liquidation calculator widget with live prices."}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":${JSON.stringify(t.crumbHome)},"item":"https://marginpad.io${home}"},{"@type":"ListItem","position":2,"name":${JSON.stringify(t.crumbWidgets)},"item":"${url}"}]}</script>
<style>
  .embed-grid{display:grid;grid-template-columns:1fr 1.1fr;gap:28px;align-items:start;margin:24px 0 8px}
  @media(max-width:720px){.embed-grid{grid-template-columns:1fr}}
  .embed-prev{background:#0c0f13;border:1px solid var(--line-bright);border-radius:16px;padding:8px}
  .embed-prev iframe{display:block;width:100%;border:0;border-radius:11px}
  .code{position:relative;background:#0a0b0d;border:1px solid var(--line-bright);border-radius:12px;padding:16px 16px 14px;font-family:'Space Mono',monospace;font-size:12.5px;color:#c9d2dc;line-height:1.6;overflow-x:auto;white-space:pre-wrap;word-break:break-all}
  .copy{position:absolute;top:10px;right:10px;background:#1a1f27;border:1px solid var(--line-bright);color:var(--ink-dim);font-family:'Space Mono',monospace;font-size:11px;padding:5px 10px;border-radius:7px;cursor:pointer}
  .copy:hover{color:#c2f64a;border-color:#c2f64a}
  .coins{display:flex;flex-wrap:wrap;gap:7px;margin:6px 0 18px}
  .coins a{font-family:'Space Mono',monospace;font-size:12px;color:var(--ink-dim);text-decoration:none;border:1px solid var(--line-bright);border-radius:8px;padding:6px 11px}
  .coins a:hover{color:#c2f64a;border-color:#c2f64a}
  .feat{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:14px 0 8px}
  @media(max-width:620px){.feat{grid-template-columns:1fr}}
  .feat div{background:var(--panel);border:1px solid var(--line-bright);border-radius:12px;padding:14px 15px;font-size:14px}
  .feat b{display:block;color:#c2f64a;font-family:'Space Mono',monospace;font-size:12px;margin-bottom:5px}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="${home}">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="${home}">${t.navCalc}</a><a href="/blog/">${t.navBlog}</a><a href="/glossary/">${t.navGloss}</a></nav>
  </header>
  <div class="crumb"><a href="${home}">${t.crumbHome}</a> / ${t.crumbWidgets}</div>
  <article>
    <h1>${t.h1}</h1>
    <p class="lead">${t.lead}</p>

    <div class="embed-grid">
      <div class="embed-prev">
        <iframe src="/widget/liquidation-calculator/?coin=BTC" height="430" title="Liquidation Calculator by MarginPad" loading="lazy"></iframe>
      </div>
      <div>
        <h2 style="margin-top:0">${t.copyH}</h2>
        <div class="code"><button class="copy" type="button" onclick="(function(b){var t=b.parentNode.querySelector('code');navigator.clipboard&&navigator.clipboard.writeText(t.textContent);b.textContent='${t.copiedBtn}';setTimeout(function(){b.textContent='${t.copyBtn}';},1400);})(this)">${t.copyBtn}</button><code>&lt;iframe src="https://marginpad.io/widget/liquidation-calculator/?coin=BTC"
  width="360" height="440" loading="lazy"
  style="border:0;border-radius:14px;max-width:100%"
  title="Liquidation Calculator by MarginPad"&gt;&lt;/iframe&gt;</code></div>
        <h2>${t.pickH}</h2>
        <p>${t.pickP}</p>
        <div class="coins">
          <a href="/widget/liquidation-calculator/?coin=BTC" target="_blank">BTC</a>
          <a href="/widget/liquidation-calculator/?coin=ETH" target="_blank">ETH</a>
          <a href="/widget/liquidation-calculator/?coin=SOL" target="_blank">SOL</a>
          <a href="/widget/liquidation-calculator/?coin=XRP" target="_blank">XRP</a>
          <a href="/widget/liquidation-calculator/?coin=BNB" target="_blank">BNB</a>
          <a href="/widget/liquidation-calculator/?coin=DOGE" target="_blank">DOGE</a>
        </div>
      </div>
    </div>

    <div class="feat">
      <div><b>${t.featLiveB}</b>${t.featLiveP}</div>
      <div><b>${t.featLsB}</b>${t.featLsP}</div>
      <div><b>${t.featCostB}</b>${t.featCostP}</div>
    </div>

    <h2>${t.whyH}</h2>
    <p>${t.whyP}</p>

    <h2>${t.moreH}</h2>
    <div class="related">
      <a href="${home}#liq">${t.relLiq}</a>
      <a href="/heatmap">${t.relHeat}</a>
      <a href="/paper-trade">${t.relPaper}</a>
      <a href="/funding-fee-calculator/">${t.relFunding}</a>
      <a href="/blog/">${t.relGuides}</a>
    </div>
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:24px">${t.disclaimer}</p>
  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="${home}">${t.navCalc}</a> · <a href="/blog/">${t.navBlog}</a> · <a href="/glossary/">${t.navGloss}</a></span>
  </footer>
</div>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;
}

let n = 0;
function write(rel, html) { const d = path.join(DIST, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'index.html'), html); n++; }
write('api', apiPage(''));
write('widgets', widgetsPage(''));
for (const lc of LANG_CODES) { write(path.join(lc, 'api'), apiPage(lc)); write(path.join(lc, 'widgets'), widgetsPage(lc)); }
console.log('wrote', n, 'api + widgets pages (en + 12 langs)');
