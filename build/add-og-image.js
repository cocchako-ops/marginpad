/* og:image / twitter:image fallback (2026-09-02): 14 indexable hand-made pages (alerts, coins, fear-greed, news, levels,
   spot, vault, premium, privacy, terms, where-to-start, free-crypto-api, liquidations/by-exchange, one blog post) had no
   share image at all, so links pasted into X / Telegram / Discord rendered as bare text. Idempotent: only pages that
   carry NO og:image get the site card. Skips noindex pages and the app shell. Runs in build.js before fix-charset:
   node build/add-og-image.js */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const IMG = 'https://marginpad.io/assets/og.png';
let n = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'assets' || e.name === 'i18n') continue; walk(p); continue; }
    if (!e.name.endsWith('.html') || e.name === 'app.html') continue;
    let h = fs.readFileSync(p, 'utf8');
    if (/property="og:image"/.test(h) || /name="robots" content="[^"]*noindex/.test(h)) continue;
    const i = h.indexOf('</head>'); if (i < 0) continue;
    const tw = /name="twitter:image"/.test(h) ? '' : '<meta name="twitter:image" content="' + IMG + '" />\n';
    const card = /name="twitter:card"/.test(h) ? '' : '<meta name="twitter:card" content="summary_large_image" />\n';
    h = h.slice(0, i) + '<meta property="og:image" content="' + IMG + '" />\n' + tw + card + h.slice(i);
    fs.writeFileSync(p, h); n++;
  }
}
walk(DIST);
console.log('og:image fallback added to', n, 'pages');
