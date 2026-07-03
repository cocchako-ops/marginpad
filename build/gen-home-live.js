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
const DESC = 'Practice crypto futures with real live prices and zero risk: paper-trading terminal, live screener, real-time liquidations feed, charts, calculators and a bot API. Free — no deposit, no KYC.';
const CANON = 'https://marginpad.io/';
const OG_IMG = 'https://marginpad.io/assets/og.png';

const GTAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-18230384038');</script>`;

const JSONLD = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"MarginPad","url":"https://marginpad.io/","applicationCategory":"FinanceApplication","operatingSystem":"Web","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":${JSON.stringify(DESC)}}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"MarginPad","url":"https://marginpad.io/","logo":"https://marginpad.io/assets/og.png","sameAs":["https://t.me/MarginPadBot"]}</script>`;

// 1) indexable
h = h.replace('<meta name="robots" content="noindex,nofollow" />',
              '<meta name="robots" content="index,follow,max-image-preview:large" />');
// 2) real title
h = h.replace('<title>MarginPad — Demo homepage (full-width)</title>',
              '<title>' + TITLE + '</title>');
// 3) inject SEO head (description, canonical, OG, twitter, JSON-LD) + gtag right after <head>
const headExtra = `
${GTAG}
<meta name="description" content="${DESC}" />
<meta name="keywords" content="crypto futures, paper trading, crypto futures simulator, liquidation calculator, crypto screener, liquidations feed, trading bot api, free crypto tools" />
<link rel="canonical" href="${CANON}" />
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
