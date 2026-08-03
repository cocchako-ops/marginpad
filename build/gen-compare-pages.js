/* Exchange comparison pages (e.g. /bybit-vs-binance/) — high-intent SEO, affiliate to both.
   Now multilingual: writes the English page at /<a>-vs-<b>/ plus 12 translated variants
   at /<lang>/<a>-vs-<b>/ (hreflang cross-linked). Run: node build/gen-compare-pages.js */
const fs = require('fs');
const path = require('path');
const { LANGS, KNOWN } = require('./data/compare-i18n');
const OUT = path.join(__dirname, '..', 'dist');
const esc = s => String(s).replace(/&/g, '&amp;');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const EX = {
  bybit:   { name: 'Bybit',   ref: 'https://www.bybit.com/invite?ref=LZKBERJ',                                                              lev: 100, mmr: 0.5, maker: 0.02, taker: 0.055, accent: '#f7a600', fg: '#0a0b0d', known: 'a fast matching engine and deep USDT-perpetual liquidity', founded: 2018, us: false, safety: 'publishes proof-of-reserves and has no major custodial hack on record; restricted in several regulated markets and not open to US residents' },
  binance: { name: 'Binance', ref: 'https://www.binance.com/register?ref=MAOZM9DS',                                                          lev: 125, mmr: 0.4, maker: 0.02, taker: 0.04,  accent: '#f0b90b', fg: '#181a20', known: 'the largest volume and the widest range of futures pairs', founded: 2017, us: false, safety: 'the largest venue by volume, publishes proof-of-reserves, and now operates under tighter compliance after its 2023 US settlement; futures are not available to US residents' },
  okx:     { name: 'OKX',     ref: 'https://okx.com/join/96160298',                                                                          lev: 125, mmr: 0.5, maker: 0.02, taker: 0.05,  accent: '#cfd3d8', fg: '#0a0b0d', known: 'a powerful pro interface and a unified account model', founded: 2017, us: false, safety: 'publishes proof-of-reserves and runs a unified account model; not available to US residents' },
  kucoin:  { name: 'KuCoin',  ref: 'https://www.kucoin.com/r/rf/VHP8AYKY',                                                                   lev: 100, mmr: 0.5, maker: 0.02, taker: 0.06,  accent: '#23af91', fg: '#06231d', known: 'a huge altcoin futures selection', founded: 2017, us: false, safety: 'settled US regulatory action and wound down US access; carries one of the largest altcoin listing bases in the industry' },
  kraken:  { name: 'Kraken',  ref: 'https://invite.kraken.com/JDNW/guj2tf28',                                                                lev: 50,  mmr: 0.5, maker: 0.02, taker: 0.05,  accent: '#7b5cff', fg: '#ffffff', known: 'security and long-standing trust', founded: 2011, us: true, safety: 'one of the oldest exchanges still running, US-regulated with a strong security record, favouring conservative leverage over headline numbers' },
  bitget:  { name: 'Bitget',  ref: 'https://www.bitget.com/referral/register?clacCode=DSSSQKGK', lev: 125, mmr: 0.5, maker: 0.02, taker: 0.06, accent: '#00e5d0', fg: '#04231f', known: 'copy trading and one of the largest futures order books', founded: 2018, us: false, safety: 'publishes a protection fund, ranks top-five by futures volume, and centres its product on copy trading; not available to US residents' },
  gate:    { name: 'Gate',    ref: 'https://www.gate.com/VFIWB10KUG?ref=VFIWB10KUG&ref_type=103&ut-m_cmp=rXJBDjtJ&activity_id=1778642196063', lev: 100, mmr: 0.5, maker: 0.02, taker: 0.05, accent: '#3361ff', fg: '#ffffff', known: 'the widest selection of altcoin and new-listing futures', founded: 2013, us: false, safety: 'has one of the longest track records in the industry, publishes proof-of-reserves, and lists an enormous catalogue of long-tail markets' }
};

const PAIRS = [
  ['bybit', 'binance'], ['binance', 'okx'], ['bybit', 'okx'],
  ['binance', 'kucoin'], ['bybit', 'kucoin'], ['kraken', 'binance'],
  ['okx', 'kucoin'], ['bybit', 'kraken'], ['okx', 'kraken'], ['kucoin', 'kraken'],
  // 2026: Bitget (top-5 futures venue) + Gate (widest altcoin selection) — high-intent commercial queries
  ['bybit', 'bitget'], ['bitget', 'binance'], ['bitget', 'okx'], ['bitget', 'kucoin'],
  ['bybit', 'gate'], ['binance', 'gate'], ['bitget', 'gate'], ['gate', 'okx'], ['gate', 'kucoin'],
  // complete the matrix — remaining high-intent pairs
  ['bitget', 'kraken'], ['gate', 'kraken'],
];

const LANG_CODES = ['de', 'es', 'pt', 'fr', 'nl', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id'];
const RTL = { ar: 1 };

// English baseline (token templates), so every language uses the same builder.
const EN = {
  titleSuf: ': Which Is Better for Crypto Futures? (2026)',
  desc: '{A} vs {B} for crypto futures — max leverage, maker/taker fees, maintenance margin and liquidation handling, with a clear verdict on which fits which trader. Honest side-by-side.',
  q1: 'Is {A} or {B} cheaper for futures?',
  q1a: 'On base taker fees, {LT} is cheaper ({A} {AT} vs {B} {BT}). Both offer lower maker fees and tier discounts for higher volume.',
  q2: 'Which has higher leverage, {A} or {B}?',
  q2a: '{HL} offers higher maximum leverage ({A} up to {AL}x, {B} up to {BL}x). Higher leverage means liquidation sits closer to your entry.',
  lead: 'A no-nonsense side-by-side of <strong>{A}</strong> and <strong>{B}</strong> for crypto futures — leverage, fees, maintenance margin and what each is actually good at. Whichever you pick, plan the trade first with our <a href="/calculators">free calculators</a>.',
  thLev: 'Max leverage', thMaker: 'Maker fee (base)', thTaker: 'Taker fee (base)', thMmr: 'Maintenance margin', thKnown: 'Known for',
  open: 'Open {X} →',
  h2fees: 'Fees',
  feesP: 'On base taker fees, <strong>{LT}</strong> is cheaper ({A} {AT} vs {B} {BT}). Both reward makers (resting limit orders) with lower fees and cut rates further as your 30-day volume grows. For most active traders the fee gap is small next to the cost of a single bad liquidation — which is why position sizing matters more than chasing the lowest fee. See <a href="/blog/maker-vs-taker-fees/">maker vs taker fees</a>.',
  h2lev: 'Leverage & liquidation',
  levP: '{HL} offers the higher cap ({A} up to <strong>{AL}×</strong>, {B} up to <strong>{BL}×</strong>), but the headline number is a trap: at {MAX}× a roughly 1% move liquidates you. The maintenance margin rate (≈{AMR} vs ≈{BMR}) also nudges your liquidation price. Check yours before entering with the <a href="/calculators?c=liq">liquidation calculator</a>, or the per-exchange pages: <a href="/{AK}-liquidation-calculator/">{A}</a> · <a href="/{BK}-liquidation-calculator/">{B}</a>.',
  h2pick: 'Which should you pick?',
  pickP: 'If you want {AKNOWN}, go with <strong>{A}</strong>. If {BKNOWN} matters more, <strong>{B}</strong> fits better. Many traders keep accounts on both and route each trade to wherever the liquidity and funding are best on the day. There is no wrong answer — there is only an unplanned trade.',
  relAll: 'All calculators', relLiq: '{X} liquidation', relFunding: 'Funding fee',
  disc: 'Fees and limits are approximate base-tier figures and change by tier, region and over time — confirm on each exchange. Exchange links are referral links; we may earn a commission at no cost to you. Educational, not financial advice.',
  bothEq: 'both equally', both: 'both',
  navCalc: 'Calculators', navBlog: 'Blog', navGloss: 'Glossary', crumbHome: 'Home',
};
const EN_KNOWN = Object.fromEntries(Object.keys(EX).map(k => [k, EX[k].known]));

const { FEEC_CSS, feeWidget } = require('./data/feecalc-i18n');

function fill(str, map) {
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
}
function pct(n) { return n + '%'; }

function hreflang(ak, bk) {
  const slug = `${ak}-vs-${bk}`;
  let s = `<link rel="alternate" hreflang="en" href="https://marginpad.io/${slug}/" />\n`;
  for (const lc of LANG_CODES) s += `<link rel="alternate" hreflang="${lc}" href="https://marginpad.io/${lc}/${slug}/" />\n`;
  s += `<link rel="alternate" hreflang="x-default" href="https://marginpad.io/${slug}/" />`;
  return s;
}

function head(o) {
  return `<!DOCTYPE html>
<html lang="${o.lang}"${o.dir ? ' dir="rtl"' : ''}>
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${o.title} | MarginPad</title>
<meta name="description" content="${o.desc}" />
<meta name="keywords" content="${o.keywords}" />
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
<style>.cmp{width:100%;border-collapse:collapse;margin:18px 0;font-size:14.5px}.cmp th,.cmp td{padding:12px 14px;border-bottom:1px solid var(--line);text-align:left}.cmp th{font-family:'Space Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-dim)}.cmp td:first-child{color:var(--ink-dim);font-size:13px}.cmp tr td:nth-child(2),.cmp tr td:nth-child(3){font-family:'Space Mono',monospace;color:var(--ink)}.cmpbtns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0}@media(max-width:560px){.cmpbtns{grid-template-columns:1fr}}.cmpbtn{display:block;text-align:center;text-decoration:none;font-family:'Space Mono',monospace;font-weight:700;font-size:14px;padding:15px;border-radius:12px}${FEEC_CSS}</style>
${o.ld}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"${o.crumbHome}","item":"${o.homeHref}"},{"@type":"ListItem","position":2,"name":"${o.bcName}","item":"${o.url}"}]}</script>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="${o.homeHref}">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="${o.homeHref}">${o.navCalc}</a><a href="/blog/">${o.navBlog}</a><a href="/glossary/">${o.navGloss}</a></nav>
  </header>
  <div class="crumb"><a href="${o.homeHref}">${o.crumbHome}</a> / ${o.crumb}</div>
  <article>`;
}
function foot(o) {
  return `  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="${o.homeHref}">${o.navCalc}</a> · <a href="/blog/">${o.navBlog}</a> · <a href="/glossary/">${o.navGloss}</a></span>
  </footer>
</div>
</body>
</html>
`;
}

function comparePage(ak, bk, lang) {
  const a = EX[ak], b = EX[bk];
  const L = lang ? LANGS[lang] : EN;
  const KN = lang ? KNOWN[lang] : EN_KNOWN;
  const code = lang || 'en';
  const slug = `${ak}-vs-${bk}`;
  const url = `https://marginpad.io/${lang ? lang + '/' : ''}${slug}/`;
  const homeHref = lang ? `/${lang}/` : '/';
  const lowerTaker = a.taker < b.taker ? a.name : (b.taker < a.taker ? b.name : L.bothEq);
  const higherLev = a.lev > b.lev ? a.name : (b.lev > a.lev ? b.name : L.both);
  const map = {
    A: a.name, B: b.name, AT: pct(a.taker), BT: pct(b.taker), AL: a.lev, BL: b.lev,
    MAX: Math.max(a.lev, b.lev), AMR: pct(a.mmr), BMR: pct(b.mmr),
    LT: lowerTaker, HL: higherLev, AK: ak, BK: bk, AKNOWN: KN[ak] || EN_KNOWN[ak], BKNOWN: KN[bk] || EN_KNOWN[bk],
  };
  const F = s => fill(s, map);
  const title = `${a.name} vs ${b.name}${L.titleSuf}`;
  // EN-only: a third "which is better" FAQ + a TL;DR verdict box (translations unchanged)
  const q3 = lang ? '' : `,{"@type":"Question","name":${JSON.stringify(`Which is better, ${a.name} or ${b.name}?`)},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(`Neither is universally better. Pick ${a.name} for ${EN_KNOWN[ak]}; pick ${b.name} for ${EN_KNOWN[bk]}. ${lowerTaker === L.bothEq ? 'Base taker fees are the same' : lowerTaker + ' has the lower base taker fee'}, and ${higherLev} offers the higher leverage cap. Many traders keep both accounts and route each trade to the better venue that day.`)}}}`;
  const verdict = lang ? '' : `
    <div style="border:1px solid var(--line);border-left:4px solid #c2f64a;border-radius:12px;padding:16px 18px;margin:18px 0;background:rgba(194,246,74,.04)">
      <div style="font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#c2f64a;margin-bottom:8px">TL;DR — our verdict</div>
      <p style="margin:0;font-size:15px;line-height:1.55">Pick <strong>${a.name}</strong> if you want ${EN_KNOWN[ak]}. Pick <strong>${b.name}</strong> if ${EN_KNOWN[bk]} matters more. ${lowerTaker === L.bothEq ? 'Base taker fees are identical' : `<strong>${lowerTaker}</strong> is cheaper on base taker fees`}; <strong>${higherLev}</strong> has the higher leverage cap. Not sure yet? <a href="/paper-trade">Practice the strategy free</a> before funding either.</p>
    </div>`;
  // EN-only deep sections: real fee cost + safety/regulation (translations keep the shorter version)
  const aRt = (10000 * a.taker / 100 * 2), bRt = (10000 * b.taker / 100 * 2);
  const feeMoney = v => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const deep = lang ? '' : `
    <h2>What the fees actually cost you</h2>
    <p>Base fees look tiny, but they are paid on <em>notional</em> — the full leveraged position size, not your margin — and every round trip pays them twice (in and out). On a <strong>$10,000</strong> position taken and closed at market:</p>
    <table class="cmp">
      <tr><th>&nbsp;</th><th>${a.name}</th><th>${b.name}</th></tr>
      <tr><td>Taker per side</td><td>${pct(a.taker)}</td><td>${pct(b.taker)}</td></tr>
      <tr><td>Round-trip cost</td><td>${feeMoney(aRt)}</td><td>${feeMoney(bRt)}</td></tr>
      <tr><td>Over 100 trades</td><td>${feeMoney(aRt * 100)}</td><td>${feeMoney(bRt * 100)}</td></tr>
    </table>
    <p>${aRt === bRt ? 'The two are level on base taker fees' : `Over a hundred round trips the gap is <strong>${feeMoney(Math.abs(aRt - bRt) * 100)}</strong> in ${aRt < bRt ? a.name : b.name}'s favour`} — real money for an active trader, but still small next to a single avoidable liquidation. Both venues charge <strong>maker</strong> orders (resting limits) less than taker, and cut rates further as your 30-day volume climbs, so patient limit-order entries beat chasing the lowest headline fee. Model any trade first with the <a href="/${lang ? lang + '/' : ''}funding-fee-calculator/">funding-fee calculator</a> and <a href="/calculators?c=pnl">PnL calculator</a>.</p>

    <h2>Safety, regulation &amp; track record</h2>
    <p><strong>${a.name}</strong> (founded ${a.founded}) ${a.safety}. <strong>${b.name}</strong> (founded ${b.founded}) ${b.safety}.</p>
    <p>${a.us || b.us ? `On US access: ${a.us && b.us ? 'both serve US traders (subject to state rules)' : (a.us ? a.name : b.name) + ' is the US-friendly option here, while ' + (a.us ? b.name : a.name) + ' does not serve US residents'}.` : 'Neither is available to US residents — a US-regulated venue such as <a href="/kraken-liquidation-calculator/">Kraken</a> fits that case better.'} Whichever you choose, never keep more on any exchange than you are actively trading, enable withdrawal whitelists and two-factor authentication, and confirm current fees, leverage caps and regional availability on the exchange itself before funding.</p>`;
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":${JSON.stringify(F(L.q1))},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(F(L.q1a))}}},{"@type":"Question","name":${JSON.stringify(F(L.q2))},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(F(L.q2a))}}}${q3}]}</script>`;
  return head({
    lang: code, dir: RTL[lang] ? 1 : 0, title, desc: F(L.desc), url, homeHref, hreflang: hreflang(ak, bk),
    crumb: `${a.name} vs ${b.name}`, bcName: `${a.name} vs ${b.name}`, crumbHome: L.crumbHome, ld,
    navCalc: L.navCalc, navBlog: L.navBlog, navGloss: L.navGloss,
    keywords: `${ak} vs ${bk}, ${a.name.toLowerCase()} vs ${b.name.toLowerCase()}, ${ak} or ${bk}, ${a.name.toLowerCase()} ${b.name.toLowerCase()} fees, best crypto futures exchange`,
  })
    + `
    <h1>${a.name} vs ${b.name}</h1>
    <p class="lead">${F(L.lead)}</p>
${verdict}
    <table class="cmp">
      <tr><th>&nbsp;</th><th>${a.name}</th><th>${b.name}</th></tr>
      <tr><td>${L.thLev}</td><td>${a.lev}×</td><td>${b.lev}×</td></tr>
      <tr><td>${L.thMaker}</td><td>${pct(a.maker)}</td><td>${pct(b.maker)}</td></tr>
      <tr><td>${L.thTaker}</td><td>${pct(a.taker)}</td><td>${pct(b.taker)}</td></tr>
      <tr><td>${L.thMmr}</td><td>~${pct(a.mmr)}</td><td>~${pct(b.mmr)}</td></tr>
      <tr><td>${L.thKnown}</td><td>${KN[ak]}</td><td>${KN[bk]}</td></tr>
    </table>

    <div class="cmpbtns">
      <a class="cmpbtn" style="background:${a.accent};color:${a.fg}" href="${esc(a.ref)}" target="_blank" rel="sponsored noopener noreferrer">${fill(L.open, { X: a.name })}</a>
      <a class="cmpbtn" style="background:${b.accent};color:${b.fg}" href="${esc(b.ref)}" target="_blank" rel="sponsored noopener noreferrer">${fill(L.open, { X: b.name })}</a>
    </div>

    ${feeWidget(a, b, lang)}

    <h2>${L.h2fees}</h2>
    <p>${F(L.feesP)}</p>

    <h2>${L.h2lev}</h2>
    <p>${F(L.levP)}</p>

    <h2>${L.h2pick}</h2>
    <p>${F(L.pickP)}</p>
${deep}
    <div class="related">
      <a href="${homeHref}">${L.relAll}</a>
      <a href="/${ak}-liquidation-calculator/">${fill(L.relLiq, { X: a.name })}</a>
      <a href="/${bk}-liquidation-calculator/">${fill(L.relLiq, { X: b.name })}</a>
      <a href="/funding-fee-calculator/">${L.relFunding}</a>
    </div>
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:24px">${L.disc}</p>
`
    + foot({ homeHref, navCalc: L.navCalc, navBlog: L.navBlog, navGloss: L.navGloss });
}

let n = 0;
for (const [ak, bk] of PAIRS) {
  // English at root slug
  fs.mkdirSync(path.join(OUT, `${ak}-vs-${bk}`), { recursive: true });
  fs.writeFileSync(path.join(OUT, `${ak}-vs-${bk}`, 'index.html'), comparePage(ak, bk, ''));
  n++;
  // 12 translated variants
  for (const lc of LANG_CODES) {
    const d = path.join(OUT, lc, `${ak}-vs-${bk}`);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'index.html'), comparePage(ak, bk, lc));
    n++;
  }
  console.log('wrote', ak + '-vs-' + bk, '(en + 12)');
}
console.log('done:', n, 'comparison pages (' + PAIRS.length + ' × 13 langs)');

// keep sitemap.xml in sync — add any missing EN comparison URLs (lang variants are covered by hreflang)
try {
  const smp = path.join(OUT, 'sitemap.xml');
  let sm = fs.readFileSync(smp, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  let added = 0;
  for (const [ak, bk] of PAIRS) {
    const loc = `https://marginpad.io/${ak}-vs-${bk}/`;
    if (sm.indexOf(loc) === -1) { sm = sm.replace('</urlset>', `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n</urlset>`); added++; }
  }
  if (added) { fs.writeFileSync(smp, sm); console.log('sitemap: +' + added + ' comparison URLs'); }
} catch (e) { console.log('sitemap update skipped:', e.message); }
