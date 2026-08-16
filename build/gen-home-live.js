/* Go-live: turn the demo-home sandbox into the REAL homepage served at `/`.
 *
 * Reads  dist/demo-home/index.html  (the hand-authored source we keep iterating on, stays noindex)
 * Writes dist/index.html            (the live homepage: indexable, real SEO head, gtag, JSON-LD)
 *
 * WHY a transform instead of just copying: the served `/` must be indexable with proper
 * title/description/canonical/OG + Google Ads gtag, while the demo-home file stays noindex so the
 * two URLs don't compete. Re-run this whenever you change dist/demo-home/index.html.
 *
 *   node build/gen-home-live.js && npx wrangler deploy
 *
 * The old full homepage (paper-trade terminal / charts workspace / calculators / screener app shell)
 * is preserved as dist/app.html and the worker serves THAT at /paper-trade,/charts,/calculators,/screener.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'dist', 'demo-home', 'index.html');
const OUT = path.join(ROOT, 'dist', 'index.html');

let h = fs.readFileSync(SRC, 'utf8');

const TITLE = 'MarginPad — Free Crypto Futures Terminal, Paper Trade & Liquidations';
const DESC = 'Practice crypto, stocks, forex and indices with real live prices and zero risk: a paper-trading terminal, live charts, screener, calculators, real-time liquidations and a free bot API. Free — no deposit, no KYC.';
const CANON = 'https://marginpad.io/';
const OG_IMG = 'https://marginpad.io/assets/og.png';

const GTAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-18230384038');</script>`;

const JSONLD = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"MarginPad","url":"https://marginpad.io/","applicationCategory":"FinanceApplication","operatingSystem":"Web","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":${JSON.stringify(DESC)}}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"MarginPad","url":"https://marginpad.io/","logo":"https://marginpad.io/assets/og.png","sameAs":["https://t.me/MarginPadBot"]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"MarginPad","alternateName":"MarginPad — Free Crypto Futures Tools","url":"https://marginpad.io/","inLanguage":"en"}</script>`;

// hreflang alternates — connect the 13 language homepages so Google/Yandex/Bing treat them as one site's translations
// (huge for international + Yandex-RU targeting). Must stay in sync with build/gen-i18n-pages.js LANGS.
const HREFLANG_LANGS = ['es', 'pt', 'fr', 'de', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id', 'nl'];
const HREFLANG = ['<link rel="alternate" hreflang="x-default" href="https://marginpad.io/" />',
  '<link rel="alternate" hreflang="en" href="https://marginpad.io/" />']
  .concat(HREFLANG_LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="https://marginpad.io/${l}/" />`)).join('\n');

// Yandex.Metrica (counter 110941944) — on the homepage too so quick gen-home-live deploys never drop it (build/add-metrica.js covers the rest of the site).
const METRICA = `<!-- Yandex.Metrika counter -->
<script type="text/javascript">(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=110941944','ym');ym(110941944,'init',{ssr:true,webvisor:(window.innerWidth>880),clickmap:true,ecommerce:"dataLayer",accurateTrackBounce:true,trackLinks:true});</script>
<noscript><div><img src="https://mc.yandex.ru/watch/110941944" style="position:absolute;left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->`;

// 1) indexable
h = h.replace('<meta name="robots" content="noindex,nofollow" />',
              '<meta name="robots" content="index,follow,max-image-preview:large" />');
// 2) real title
h = h.replace('<title>MarginPad — Demo homepage (full-width)</title>',
              '<title>' + TITLE + '</title>');
// 3) inject SEO head (description, canonical, OG, twitter, JSON-LD) + gtag right after <head>
const headExtra = `
${GTAG}
<meta name="google-site-verification" content="7zzuR9GCpGKpdBsHoh1c4CzwY1G55I5yovmJ6WDfZPw" />
${METRICA}
<meta name="description" content="${DESC}" />
<meta name="keywords" content="crypto futures, paper trading, crypto futures simulator, liquidation calculator, crypto screener, liquidations feed, trading bot api, free crypto tools" />
<link rel="canonical" href="${CANON}" />
${HREFLANG}
<meta property="og:type" content="website" />
<meta property="og:url" content="${CANON}" />
<meta property="og:title" content="${TITLE}" />
<meta property="og:description" content="${DESC}" />
<meta property="og:image" content="${OG_IMG}" />
<meta property="og:locale" content="en_US" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${TITLE}" />
<meta name="twitter:description" content="${DESC}" />
<meta name="twitter:image" content="${OG_IMG}" />
${JSONLD}`;
h = h.replace('<head>', '<head>' + headExtra);

// 4) the on-page demo pageview beacon points at /demo-home/ — retarget it to the homepage
h = h.replace("'/api/track?t=pageview&p=/demo-home/'", "'/api/track?t=pageview&p=/'");

fs.writeFileSync(OUT, h);
console.log('gen-home-live: wrote dist/index.html (live homepage from demo-home, indexable + gtag)');
