/* Trading-simulator SEO pages (stock / forex / index) — EN at /<slug>/ + 12 translated variants at
   /<lang>/<slug>/ with hreflang. Content from build/data/sim-i18n.js. Run: node build/gen-sim-pages.js
   Then run the post-processors (or full build) for gtag/metrica/sentry/charset, add to sitemap, deploy. */
const fs = require('fs');
const path = require('path');
const D = require('./data/sim-i18n');
const DIST = path.join(__dirname, '..', 'dist');
const ALL_LANGS = ['de', 'es', 'pt', 'fr', 'nl', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id'];
// Only publish a language page if it actually has a translation (D.SHARED[lc] is populated by sim-i18n.js from
// build/data/sim-i18n/<lc>.json). Prevents English-content-in-a-foreign-lang pages + hreflang pointing at 404s.
// 2026-08-18: emptied deliberately. 1,008 translated subpages drew 47 pageviews and 7 Google
// visits in 90 days while multiplying every duplicate signal across the domain. This list drives
// both page generation AND the hreflang alternates, so an empty list stops writing the pages and
// stops advertising them. Restore by putting the codes back - dictionaries are untouched.
// was: const LANG_CODES = ALL_LANGS.filter(lc => require('./data/sim-i18n').SHARED[lc]);
const LANG_CODES = [];
const RTL = { ar: 1 };
const esc = s => String(s == null ? '' : s).replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escA = s => String(s == null ? '' : s).replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;').replace(/"/g, '&quot;');
const J = v => JSON.stringify(v);
const pick = (obj, lang) => obj[lang] || obj.en;

const PAGES = { stock: D.STOCK, forex: D.FOREX, index: D.INDEX };
const GRIDMIN = { stock: '150px', forex: '160px', index: '170px' };
const OTHER = { stock: ['forex', 'index'], forex: ['stock', 'index'], index: ['stock', 'forex'] };
const OTHERLABEL = { stock: 'stocks', forex: 'forex', index: 'stock indices' }; // EN fallback for the "also practice" note

function hreflang(slug) {
  let s = `<link rel="alternate" hreflang="en" href="https://marginpad.io/${slug}/" />\n`;
  for (const lc of LANG_CODES) s += `<link rel="alternate" hreflang="${lc}" href="https://marginpad.io/${lc}/${slug}/" />\n`;
  s += `<link rel="alternate" hreflang="x-default" href="https://marginpad.io/${slug}/" />`;
  return s;
}
const lp = (lang, slug) => (lang ? `/${lang}/${slug}/` : `/${slug}/`); // lang-aware internal link to a sibling sim page

const CSS = `<style>
  .hero-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:22px}
  .sgrid{display:grid;gap:10px;margin-top:8px}
  .scard{display:flex;align-items:center;gap:11px;background:linear-gradient(180deg,var(--panel),var(--bg2));border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--ink);transition:border-color .16s,transform .16s}
  .scard:hover{border-color:var(--line2);transform:translateY(-2px);color:var(--ink)}
  .scard .tk{font-family:'Space Mono',monospace;font-weight:700;font-size:14px;color:var(--lime)}
  .scard .nm{font-size:12.5px;color:var(--dim);line-height:1.25}
  .steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:8px}
  .step{background:linear-gradient(180deg,var(--panel),var(--bg2));border:1px solid var(--line);border-radius:var(--r);padding:20px}
  .step .n{font-family:'Space Mono',monospace;font-size:12px;font-weight:700;color:var(--cyan);letter-spacing:.1em}
  .step h3{font-family:'Bricolage Grotesque',sans-serif;font-size:17px;margin:10px 0 7px}
  .step p{color:var(--dim);font-size:13.5px;margin:0;line-height:1.55}
  .prose{max-width:760px;color:var(--ink2);font-size:15.5px;line-height:1.7}
  .prose p{margin:0 0 14px}
  .faq{max-width:820px;margin-top:6px}
  .qa{border-bottom:1px solid var(--line);padding:18px 0}
  .qa:last-child{border-bottom:none}
  .qa h3{font-family:'Bricolage Grotesque',sans-serif;font-size:16px;margin:0 0 8px;color:var(--ink)}
  .qa p{margin:0;color:var(--dim);font-size:14px;line-height:1.6}
  .cmp td:first-child{color:var(--ink2)}
  .cta-band{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line2);border-radius:var(--r);padding:30px 26px;margin-top:40px;text-align:center;box-shadow:var(--shadow)}
  .cta-band h2{justify-content:center;margin-top:0}
  .lnav{display:flex;gap:14px;overflow-x:auto;scrollbar-width:none}
  .lnav::-webkit-scrollbar{display:none}
</style>`;

function page(kind, lang) {
  const code = lang || 'en';
  const P = pick(PAGES[kind], lang), S = pick(D.SHARED, lang);
  const slug = D.STOCK.en.slug === PAGES[kind].en.slug ? PAGES[kind].en.slug : PAGES[kind].en.slug; // slug is lang-independent
  const realSlug = PAGES[kind].en.slug;
  const url = `https://marginpad.io/${lang ? lang + '/' : ''}${realSlug}/`;
  const titleFull = escA(P.metaTitle + ' | MarginPad');
  const grid = D.GRID[kind].map(([tk, nm]) => `<a class="scard" href="/paper-trade?coin=${tk.replace(/[^A-Z0-9]/g, '')}"><span class="tk">${esc(tk)}</span><span class="nm">${esc(nm)}</span></a>`).join('\n    ');
  const faqLd = P.faq.map(([q, a]) => `{"@type":"Question","name":${J(q)},"acceptedAnswer":{"@type":"Answer","text":${J(a)}}}`).join(',');
  const faqHtml = P.faq.map(([q, a]) => `<div class="qa"><h3>${esc(q)}</h3><p>${esc(a)}</p></div>`).join('\n    ');
  // "also practice X, Y" note with lang-aware sibling links
  const others = OTHER[kind].map(k => `<a href="${lp(lang, PAGES[k].en.slug)}">${esc(pick(PAGES[k], lang).eyebrow.replace(/^Free\s+/i, '').replace(/\s*simulator$/i, '') || OTHERLABEL[k])}</a>`);
  // simpler, robust label: use the shared nav labels
  const sibLinks = OTHER[kind].map(k => {
    const label = k === 'stock' ? S.navStock : k === 'forex' ? S.navForex : S.navIndex;
    return `<a href="${lp(lang, PAGES[k].en.slug)}">${esc(label)}</a>`;
  });

  return `<!DOCTYPE html>
<html lang="${code}"${RTL[lang] ? ' dir="rtl"' : ''}>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<meta name="theme-color" content="#08090b" />
<title>${titleFull}</title>
<meta name="description" content="${escA(P.metaDesc)}" />
<meta name="keywords" content="${escA(P.keywords)}" />
<link rel="canonical" href="${url}" />
${hreflang(realSlug)}
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${escA(P.metaTitle)}" />
<meta property="og:description" content="${escA(P.metaDesc)}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escA(P.metaTitle)}" />
<meta name="twitter:description" content="${escA(P.metaDesc)}" />
<meta name="twitter:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="stylesheet" href="/assets/lab.css" />
${CSS.replace('.sgrid{display:grid;gap:10px', '.sgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(' + GRIDMIN[kind] + ',1fr));gap:10px')}
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication","name":${J(P.metaTitle.replace(/^Free\s+/, '').replace(/ —.*$/, ''))},"applicationCategory":"FinanceApplication","operatingSystem":"Any","url":"${url}","description":${J(P.metaDesc)},"offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"MarginPad","item":"https://marginpad.io/${lang ? lang + '/' : ''}"},{"@type":"ListItem","position":2,"name":${J(P.h1)},"item":"${url}"}]}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[${faqLd}]}
</script>
</head>
<body>
<header class="topbar"><a class="brand" href="/${lang ? lang + '/' : ''}">MARGIN<b>PAD</b></a><nav class="tool-switch lnav"><a href="/paper-trade">${esc(S.navPaper)}</a><a href="/charts">${esc(S.navCharts)}</a>${sibLinks.join('')}<a href="/${lang ? lang + '/' : ''}tools/">${esc(S.navTools)}</a></nav><a class="home" href="/paper-trade">${esc(S.openApp)} &rarr;</a></header>

<div class="wrap">
  <section class="hero">
    <span class="eyebrow">${esc(P.eyebrow)}</span>
    <h1>${esc(P.h1)}</h1>
    <p class="sub">${esc(P.sub)}</p>
    <div class="hero-cta">
      <a class="btn" href="/paper-trade?coin=${P.startCoin}">${esc(S.startFree)}</a>
      <a class="btn ghost" href="/charts">${esc(S.openCharts)}</a>
    </div>
    <p class="note" style="margin-top:16px">${esc(S.heroNote)}</p>
  </section>

  <h2>${esc(P.whatH)}</h2>
  <div class="prose"><p>${esc(P.whatP1)}</p><p>${esc(P.whatP2)}</p></div>

  <h2>${esc(P.pickH)}</h2>
  <p class="muted">${esc(S.pickNote)}</p>
  <div class="sgrid">
    ${grid}
  </div>

  <h2>${esc(S.howH)}</h2>
  <div class="steps">
    <div class="step"><div class="n">1</div><h3>${esc(S.s1t)}</h3><p>${esc(S.s1p)}</p></div>
    <div class="step"><div class="n">2</div><h3>${esc(S.s2t)}</h3><p>${esc(S.s2p)}</p></div>
    <div class="step"><div class="n">3</div><h3>${esc(S.s3t)}</h3><p>${esc(S.s3p)}</p></div>
  </div>

  <h2>${esc(P.whyH)}</h2>
  <div class="prose"><p>${esc(P.whyP1)}</p><p>${esc(P.whyP2)}</p></div>

  <h2>${esc(S.cmpH)}</h2>
  <div class="tablewrap"><table class="cmp">
    <thead><tr><th>&nbsp;</th><th>${esc(S.cmpCol1)}</th><th>${esc(P.cmpReal)}</th></tr></thead>
    <tbody>
      <tr><td>${esc(S.cmpRisk)}</td><td class="pos">$0</td><td class="neg">${esc(S.cmpRiskR)}</td></tr>
      <tr><td>${esc(S.cmpData)}</td><td>${esc(S.cmpDataV)}</td><td>${esc(S.cmpDataV)}</td></tr>
      <tr><td>${esc(S.cmpLev)}</td><td>${esc(S.cmpLevV)}</td><td>${esc(S.cmpLevV)}</td></tr>
      <tr><td>${esc(S.cmpSign)}</td><td class="pos">${esc(S.cmpNo)}</td><td>${esc(S.cmpYes)}</td></tr>
      <tr><td>${esc(S.cmpCost)}</td><td class="pos">${esc(S.cmpCostV)}</td><td class="neg">${esc(S.cmpCostR)}</td></tr>
    </tbody>
  </table></div>

  <h2>${esc(S.faqH)}</h2>
  <div class="faq">
    ${faqHtml}
  </div>

  <div class="cta-band">
    <h2>${esc(S.ctaH)}</h2>
    <p class="sub" style="margin:0 auto 20px">${esc(P.ctaSub)}</p>
    <a class="btn" href="/paper-trade?coin=${P.startCoin}">${esc(P.ctaBtn)}</a>
  </div>

  <p class="note">${esc(S.alsoPractice)} ${sibLinks.join(', ')}. ${esc(S.disc)}</p>
</div>

<footer class="toolfoot"><div class="wrap" style="padding-bottom:0"><div class="cols">
  <div><a class="brand" href="/${lang ? lang + '/' : ''}" style="font-size:18px">MARGIN<b>PAD</b></a><p class="blurb">${esc(S.footBlurb)}</p></div>
  <div><h4>${esc(S.footPractice)}</h4><a href="${lp(lang, 'stock-trading-simulator')}">${esc(S.navStock)}</a><a href="${lp(lang, 'forex-trading-simulator')}">${esc(S.navForex)}</a><a href="${lp(lang, 'index-trading-simulator')}">${esc(S.navIndex)}</a><a href="/paper-trade">${esc(S.navPaper)}</a></div>
  <div><h4>MarginPad</h4><a href="/charts">${esc(S.navCharts)}</a><a href="/calculators">Calculators</a><a href="/screener">Screener</a><a href="/${lang ? lang + '/' : ''}tools/">${esc(S.navTools)}</a></div>
</div><div class="bottom">${esc(S.footBottom)}</div></div></footer>

<script defer src="/assets/mp-nav.js"></script>
</body>
</html>`;
}

function write(rel, html) {
  const dir = path.join(DIST, rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

let n = 0;
for (const kind of Object.keys(PAGES)) {
  const slug = PAGES[kind].en.slug;
  write(slug, page(kind, '')); n++;
  for (const lc of LANG_CODES) { write(path.join(lc, slug), page(kind, lc)); n++; }
}
console.log('gen-sim-pages: wrote ' + n + ' pages (' + Object.keys(PAGES).length + ' × ' + (LANG_CODES.length + 1) + ' langs)');
