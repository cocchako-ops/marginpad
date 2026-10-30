// /hyperliquid-whales/: Hyperliquid wallet analytics. Replaced the old whale board on 2026-10-31 at the same address, so what
// that page earned in search stays: its head (build/hl-head.html) and its reading guide (build/hl-seo.html) moved here verbatim.
// Body in build/hl-page.src.html; header, fonts and bundle tags are lifted from /catalysts/ so a stamp can never be stale here.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const cat = fs.readFileSync(path.join(root, 'dist/catalysts/index.html'), 'utf8');
const src = fs.readFileSync(path.join(__dirname, 'hl-page.src.html'), 'utf8');
const head = fs.readFileSync(path.join(__dirname, 'hl-head.html'), 'utf8');
const seo = fs.readFileSync(path.join(__dirname, 'hl-seo.html'), 'utf8');
const pick = (re, what) => { const m = cat.match(re); if (!m) throw new Error('missing ' + what); return m[0]; };
const preloads = (cat.match(/<link rel="preload"[^>]*>/g) || []).join('\n');
const nav = pick(/<script defer src="\/assets\/mp-nav\.js[^>]*><\/script>/, 'mp-nav');
const crit = pick(/<style id="mpHdrCrit">[\s\S]*?<\/style>/, 'header css');
const hdr = pick(/<header class="mpnav-hdr">[\s\S]*?<\/header>/, 'header');
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
${head}<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
${preloads}
<link rel="stylesheet" href="/assets/fonts.css" />
${nav}
${crit}
</head>
<body>
${hdr}
${src}
${seo}
</body>
</html>
`;
const out = path.join(root, 'dist/hyperliquid-whales');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('hyperliquid-whales page', html.length);
