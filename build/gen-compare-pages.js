/* Exchange comparison pages (e.g. /bybit-vs-binance/) — high-intent SEO, affiliate to both.
   Now multilingual: writes the English page at /<a>-vs-<b>/ plus 12 translated variants
   at /<lang>/<a>-vs-<b>/ (hreflang cross-linked). Run: node build/gen-compare-pages.js */
const VDATE = new Date().toISOString().slice(0, 10);
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

// Exchanges our collector actually subscribes to. KuCoin, Kraken and Bitget publish no public liquidation
// websocket, so a pair of two of them has nothing to measure — those pages skip the measured section
// entirely rather than shipping a "loading…" box that never resolves.
const COVERED = { bybit: 1, binance: 1, okx: 1, gate: 1 };

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

// 2026-08-18: emptied deliberately. 1,008 translated subpages drew 47 pageviews and 7 Google
// visits in 90 days while multiplying every duplicate signal across the domain. This list drives
// both page generation AND the hreflang alternates, so an empty list stops writing the pages and
// stops advertising them. Restore by putting the codes back - dictionaries are untouched.
// was: const LANG_CODES = ['de', 'es', 'pt', 'fr', 'nl', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id'];
const LANG_CODES = [];
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
<style>.cmp{width:100%;border-collapse:collapse;margin:18px 0;font-size:14.5px}.cmp th,.cmp td{padding:12px 14px;border-bottom:1px solid var(--line);text-align:left}.cmp th{font-family:'Space Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-dim)}.cmp td:first-child{color:var(--ink-dim);font-size:13px}.cmp tr td:nth-child(2),.cmp tr td:nth-child(3){font-family:'Space Mono',monospace;color:var(--ink)}.cmpbtns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0}@media(max-width:560px){.cmpbtns{grid-template-columns:1fr}}.cmpbtn{display:block;text-align:center;text-decoration:none;font-family:'Space Mono',monospace;font-weight:700;font-size:14px;padding:15px;border-radius:12px}.vs-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}@media(max-width:560px){.vs-grid{grid-template-columns:1fr}}.vs-col{border:1px solid var(--line);border-radius:13px;padding:14px 16px;display:flex;flex-direction:column;gap:5px;background:rgba(255,255,255,.015)}.vs-col b{font-family:'Space Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-dim)}.vs-big{font-family:'Space Mono',monospace;font-size:25px;font-weight:700;color:var(--ink);line-height:1.1}.vs-sub{font-size:12px;color:#8b95a1}.vs-none{font-size:13px;color:#8b95a1}.vs-bar{display:block;height:5px;border-radius:3px;background:#ff5a4d;overflow:hidden;margin:3px 0 1px}.vs-bar i{display:block;height:100%;background:#2ebd85}.vs-lead{font-size:14.5px;margin:4px 0 0}.vs-src{font-family:'Space Mono',monospace;font-size:11px;color:#6f7885;margin:8px 0 0}.vstat-wait{font-family:'Space Mono',monospace;font-size:13px;color:#8b95a1}${FEEC_CSS}</style>
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
// Renders the measured 24h liquidation comparison for the two venues this page is about. Kept as a
// script rather than baked in at build time on purpose: a number written into 21 static pages starts
// rotting the moment it is written, which is the failure this whole section exists to avoid.
const VSTAT_JS = `
<script>
(function(){
  var box=document.getElementById('vstat');if(!box)return;
  if(box.getAttribute('data-ssr'))return; // the worker already rendered this from the same source
  var ak=box.getAttribute('data-a'),bk=box.getAttribute('data-b');
  var an=box.getAttribute('data-an'),bn=box.getAttribute('data-bn');
  function usd(v){if(v>=1e9)return '$'+(v/1e9).toFixed(2)+'B';if(v>=1e6)return '$'+(v/1e6).toFixed(1)+'M';if(v>=1e3)return '$'+Math.round(v/1e3)+'K';return '$'+Math.round(v);}
  fetch('/api/v1/venues').then(function(r){return r.json();}).then(function(res){
    var d=res.data||res,vs=d.venues||[];
    function find(k){for(var i=0;i<vs.length;i++){if(vs[i].venue===k)return vs[i];}return null;}
    var A=find(ak),B=find(bk);
    if(!A&&!B){box.innerHTML='<p class="vstat-wait">Our collector did not record liquidations on either venue in the last 24 hours.</p>';return;}
    function row(n,v){
      if(!v)return '<div class="vs-col"><b>'+n+'</b><span class="vs-none">no liquidations recorded in 24h</span></div>';
      return '<div class="vs-col"><b>'+n+'</b>'
        +'<span class="vs-big">'+usd(v.total)+'</span>'
        +'<span class="vs-sub">'+v.share+'% of all nine venues</span>'
        +'<span class="vs-bar"><i style="width:'+v.longPct+'%"></i></span>'
        +'<span class="vs-sub">'+v.longPct+'% longs / '+(100-v.longPct).toFixed(1)+'% shorts</span></div>';
    }
    var lead='';
    if(A&&B){
      var big=A.total>=B.total?A:B,bigN=A.total>=B.total?an:bn,smallN=A.total>=B.total?bn:an;
      var ratio=(Math.min(A.total,B.total)>0)?(big.total/Math.min(A.total,B.total)):0;
      lead='<p class="vs-lead">'+bigN+' liquidated '+(ratio>=1.15?('about '+ratio.toFixed(1)+'x more than '+smallN):('roughly the same as '+smallN))+' over the last 24 hours.</p>';
    }
    box.innerHTML='<div class="vs-grid">'+row(an,A)+row(bn,B)+'</div>'+lead
      +'<p class="vs-src">Measured by the MarginPad collector across nine exchange websockets &middot; 24h window &middot; '+new Date(d.ts).toISOString().slice(0,16).replace('T',' ')+' UTC</p>';
  }).catch(function(){box.innerHTML='<p class="vstat-wait">Live venue figures are unavailable right now.</p>';});
})();
</script>`;

function foot(o) {
  return VSTAT_JS + `  </article>
  <section style="margin:26px 0 6px;border:1px solid #262e3a;border-radius:13px;padding:15px 18px;background:rgba(255,255,255,.015)"><h2 style="font-size:15px;margin:0 0 8px;font-family:'Space Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:#8b95a1">Sources &amp; methodology</h2><ul style="margin:0;padding-left:18px;font-size:12.5px;color:#9aa3ad;line-height:1.7"><li>Fees, leverage caps and KYC rules come from each exchange&#39;s <b>public fee schedule and docs</b>, read at the base (VIP-0) tier.</li><li>Ratings are <b>MarginPad&#39;s editorial opinion</b> (0-5), weighted for this page&#39;s use case — they are not paid placements.</li><li>Exchange links are referral links; they fund the free tools and <b>do not affect rankings</b>. We do not list a venue we would not use ourselves.</li><li>Liquidation and market figures cited on MarginPad come from our own <a href="/liquidations/" style="color:#c2f64a">measured liquidation feed</a>, not estimates.</li><li><b>Figures last verified: ${VDATE}</b> (page regenerated on this date). Terms change — confirm on the exchange before depositing.</li></ul></section>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="${o.homeHref}">${o.navCalc}</a> · <a href="/blog/">${o.navBlog}</a> · <a href="/glossary/">${o.navGloss}</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="/privacy/">Privacy</a></span>
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
  // 573 eight-word phrases appeared on nearly every one of these 21 pages, which is what near-duplicate
  // detection keys on and why none of them ranked. The paragraphs below are selected by what actually
  // separates THIS pair — the size of the fee gap, the leverage spread, the age difference, who serves US
  // traders — so two pages only read alike when the two exchanges genuinely are alike.
  const feeGap = Math.abs(aRt - bRt) * 100, cheaper = aRt < bRt ? a : b, pricier = aRt < bRt ? b : a;
  const levGap = Math.abs(a.lev - b.lev), older = a.founded <= b.founded ? a : b, newer = a.founded <= b.founded ? b : a;
  const ageGap = Math.abs(a.founded - b.founded);
  const feeIntro = feeGap < 1
    ? `These two price the taker side within a rounding error of each other, so fees are the wrong axis to pick between them — the decision lives in leverage, listings and who will let you open an account. The arithmetic is still worth seeing, because it is paid on <em>notional</em> (the full leveraged size, not your margin) and charged twice per round trip:`
    : feeGap > 30
      ? `This is the one pairing on this site where the fee gap is large enough to decide the question on its own. ${cheaper.name} charges ${pct(cheaper.taker)} against ${pricier.name}'s ${pct(pricier.taker)}, and because the fee lands on <em>notional</em> — the whole leveraged position, not the margin behind it — and is paid entering and exiting, the difference compounds fast:`
      : `Base fees look tiny until you notice they are charged on <em>notional</em> — the full leveraged position size rather than the margin you put up — and that every round trip pays them twice. On a <strong>$10,000</strong> position taken and closed at market:`;
  const feeAfter = feeGap < 1
    ? `Level on fees, then. What moves the needle instead is order type: resting <strong>maker</strong> limits cost less than taking the book on both venues, and both step rates down as 30-day volume grows. A trader who works limit orders pays less on the "expensive" venue than an impatient one pays on the "cheap" one.`
    : `Over a hundred round trips that is <strong>${feeMoney(feeGap)}</strong> in ${cheaper.name}'s favour${feeGap > 30 ? ' — enough to notice on a small account' : ', which matters if you trade often and barely at all if you do not'}. Keep it in proportion though: one liquidation you could have avoided costs more than a year of the difference. Both venues price <strong>maker</strong> orders below taker and cut rates as 30-day volume grows.`;
  const levPara = levGap === 0
    ? `<p>Both cap out at <strong>${a.lev}x</strong>, so neither can save you from the other's worst-case position sizing. At that ceiling a move of roughly ${(100 / a.lev).toFixed(2)}% against you wipes the margin — which is why the cap is a marketing number and the size you actually choose is the risk decision.</p>`
    : `<p>${a.lev > b.lev ? a.name : b.name} advertises <strong>${Math.max(a.lev, b.lev)}x</strong> against ${a.lev > b.lev ? b.name : a.name}'s <strong>${Math.min(a.lev, b.lev)}x</strong>. Read that as a ceiling, not a recommendation: at ${Math.max(a.lev, b.lev)}x a move of about ${(100 / Math.max(a.lev, b.lev)).toFixed(2)}% against the position is enough to end it, against ${(100 / Math.min(a.lev, b.lev)).toFixed(2)}% at the lower cap. Traders who survive rarely trade anywhere near either number, so a higher cap is only an advantage if you already know why you need it.</p>`;
  const ageLine = ageGap >= 4
    ? `${older.name} has been running since ${older.founded}, ${ageGap} years longer than ${newer.name} (${newer.founded}) — a real difference when the question is who has already survived a full cycle and a bad week.`
    : `Both opened within ${ageGap === 0 ? 'the same year' : ageGap + ' year' + (ageGap > 1 ? 's' : '') + ' of each other'} (${a.name} ${a.founded}, ${b.name} ${b.founded}), so neither wins on track record alone.`;
  const deep = lang ? '' : `
    <h2>What the fees actually cost you</h2>
    <p>${feeIntro}</p>
    <table class="cmp">
      <tr><th>&nbsp;</th><th>${a.name}</th><th>${b.name}</th></tr>
      <tr><td>Taker per side</td><td>${pct(a.taker)}</td><td>${pct(b.taker)}</td></tr>
      <tr><td>Round-trip cost</td><td>${feeMoney(aRt)}</td><td>${feeMoney(bRt)}</td></tr>
      <tr><td>Over 100 trades</td><td>${feeMoney(aRt * 100)}</td><td>${feeMoney(bRt * 100)}</td></tr>
    </table>
    <p>${feeAfter} Model it against your own size with the <a href="/${lang ? lang + '/' : ''}funding-fee-calculator/">funding-fee calculator</a> and the <a href="/calculators?c=pnl">PnL calculator</a>.</p>

    <h2>Leverage: what the caps really mean here</h2>
    ${levPara}

${COVERED[ak] || COVERED[bk] ? `    <h2>Which venue is actually blowing traders up right now</h2>
    <p>Fee schedules are published by the exchanges; forced-close flow is not. We run our own collector on the public liquidation websockets of nine venues, so the block below is a measurement of what ${COVERED[ak] && COVERED[bk] ? `${a.name} and ${b.name}` : `${COVERED[ak] ? a.name : b.name}`} liquidated in the last 24 hours, not an estimate or a vendor figure.${COVERED[ak] && COVERED[bk] ? ' It reloads on every visit — treat a single day as weather, not climate.' : ` ${COVERED[ak] ? b.name : a.name} does not publish a public liquidation websocket, so there is nothing to measure on that side and we show nothing rather than guess.`}</p>
    <div id="vstat" data-a="${ak}" data-b="${bk}" data-an="${a.name}" data-bn="${b.name}">
      <p class="vstat-wait" style="font-family:'Space Mono',monospace;font-size:13px;color:#8b95a1">Reading the last 24 hours from our collector&hellip;</p>
    </div>
    <p>A venue carrying a bigger share of the day's liquidations is not automatically the riskier place to trade — it usually means more leveraged size is open there. What the long/short split tells you is which way the crowd was leaning when it got taken out. The full nine-venue breakdown, updated continuously, sits on the <a href="/liquidations/">liquidation feed</a>, and the same numbers are free as JSON at <a href="/trading-api/"><code>/api/v1/venues</code></a>.</p>
` : ''}
    <h2>Safety, regulation &amp; track record</h2>
    <p>${ageLine}</p>
    <p><strong>${a.name}</strong> ${a.safety}. <strong>${b.name}</strong> ${b.safety}.</p>
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
      <a class="cmpbtn" data-ex="${a.name}" onclick="try{window.__mpTrack&&window.__mpTrack('exchange','${a.name}')}catch(e){}" style="background:${a.accent};color:${a.fg}" href="${esc(a.ref)}" target="_blank" rel="sponsored noopener noreferrer">${fill(L.open, { X: a.name })}</a>
      <a class="cmpbtn" data-ex="${b.name}" onclick="try{window.__mpTrack&&window.__mpTrack('exchange','${b.name}')}catch(e){}" style="background:${b.accent};color:${b.fg}" href="${esc(b.ref)}" target="_blank" rel="sponsored noopener noreferrer">${fill(L.open, { X: b.name })}</a>
    </div>

    ${feeWidget(a, b, lang)}

${lang ? `    <h2>${L.h2fees}</h2>
    <p>${F(L.feesP)}</p>

    <h2>${L.h2lev}</h2>
    <p>${F(L.levP)}</p>
` : ''}
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
