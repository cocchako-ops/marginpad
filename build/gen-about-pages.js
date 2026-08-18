/* Generates translated About + Contact pages (/es/about/, /zh/contact/, ...) with hreflang.
   Run: node build/gen-about-pages.js */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

// translations live in build/about-data.js to keep this file readable
const ABOUT = require('./about-data.js');

// 2026-08-18: emptied deliberately. 1,008 translated subpages drew 47 pageviews and 7 Google
// visits in 90 days while multiplying every duplicate signal across the domain. This list drives
// both page generation AND the hreflang alternates, so an empty list stops writing the pages and
// stops advertising them. Restore by putting the codes back - dictionaries are untouched.
// was: const LANGS = ['es', 'pt', 'fr', 'de', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id', 'nl'];
const LANGS = [];
const RTL = ['ar'];
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function hreflang(page) {
  return ['<link rel="alternate" hreflang="x-default" href="https://marginpad.io/' + page + '/" />',
    '<link rel="alternate" hreflang="en" href="https://marginpad.io/' + page + '/" />']
    .concat(LANGS.map(l => '<link rel="alternate" hreflang="' + l + '" href="https://marginpad.io/' + l + '/' + page + '/" />')).join('\n');
}
function shell(lang, page, urlPath, title, desc, bodyHtml, extraHead) {
  const dir = RTL.includes(lang) ? ' dir="rtl"' : '';
  const home = lang === 'en' ? '/' : '/' + lang + '/';
  const otherCrumb = page === 'about' ? ABOUT[lang].aTitle : ABOUT[lang].cTitle;
  return `<!DOCTYPE html>
<html lang="${lang}"${dir}>
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escAttr(title)}${title.includes('MarginPad') ? '' : ' | MarginPad'}</title>
<meta name="description" content="${escAttr(desc)}" />
<link rel="canonical" href="https://marginpad.io${urlPath}" />
${hreflang(page)}
<meta property="og:title" content="${escAttr(title)}" />
<meta property="og:description" content="${escAttr(desc)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://marginpad.io${urlPath}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Familjen+Grotesk:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/assets/blog.css" />
${extraHead || ''}</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="${home}">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="${home}">Calculators</a><a href="/blog/">Blog</a><a href="${page === 'about' ? '/contact/' : '/about/'}">${page === 'about' ? ABOUT[lang].cTitle : ABOUT[lang].aTitle}</a></nav>
  </header>
  <div class="crumb"><a href="${home}">Home</a> / ${otherCrumb}</div>
  <article>${bodyHtml}</article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="${home}">Calculators</a> · <a href="/blog/">Blog</a> · <a href="/about/">About</a> · <a href="/contact/">Contact</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="/privacy/">Privacy</a></span>
  </footer>
</div>
</body>
</html>
`;
}
function aboutBody(lang) {
  const t = ABOUT[lang], home = lang === 'en' ? '/' : '/' + lang + '/';
  return `
    <h1>${t.aH1Page || t.aTitle}</h1>
    <p class="lead">${t.aLead}</p>
    <h2>${t.aH1}</h2>
    <p>${t.aP1}</p>
    ${t.aExtra || ''}
    <h2>${t.aH2}</h2>
    <p>${t.aP2}</p>
    <h2>${t.aH3}</h2>
    <p>${t.aP3}</p>
    <div class="endcta"><a class="cta" href="${t.aCtaHref || (home + '#liq')}">${t.aCta} →</a></div>
  `;
}
function contactBody(lang) {
  const t = ABOUT[lang];
  const p1 = t.cP1.replace('@MarginPadBot', '<a href="https://t.me/MarginPadBot" target="_blank" rel="noopener">@MarginPadBot</a>');
  const p2 = t.cP2.replace('hello@marginpad.io', '<a href="mailto:hello@marginpad.io">hello@marginpad.io</a>');
  return `
    <h1>${t.cTitle}</h1>
    <p class="lead">${t.cLead}</p>
    <h2>${t.cH1}</h2>
    <p>${p1}</p>
    <h2>${t.cH2}</h2>
    <p>${p2}</p>
    <h2>${t.cH3}</h2>
    <p>${t.cP3}</p>
  `;
}

const ALL = ['en'].concat(LANGS);
let n = 0; const smap = [];
for (const lang of ALL) {
  const base = lang === 'en' ? '' : '/' + lang;
  // about
  let p = base + '/about/';
  let dir = path.join(OUT, base.replace(/^\//, ''), 'about');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), shell(lang, 'about', p, ABOUT[lang].aMetaTitle || ABOUT[lang].aTitle, ABOUT[lang].aMetaDesc || ABOUT[lang].aLead, aboutBody(lang), ABOUT[lang].aHeadLd));
  smap.push(p); n++;
  // contact
  p = base + '/contact/';
  dir = path.join(OUT, base.replace(/^\//, ''), 'contact');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), shell(lang, 'contact', p, ABOUT[lang].cTitle, ABOUT[lang].cLead, contactBody(lang)));
  smap.push(p); n++;
}
console.log('wrote', n, 'about/contact pages');
console.log('\n--- sitemap entries (lang about/contact) ---');
smap.filter(u => u.split('/').length > 3).forEach(u => console.log('  <url><loc>https://marginpad.io' + u + '</loc><lastmod>2026-06-11</lastmod><changefreq>monthly</changefreq><priority>0.4</priority></url>'));
