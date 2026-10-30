// /hyperliquid/: the wallet analytics product. Body in build/hl-page.src.html; the header, fonts and bundle tags are lifted from
// /catalysts/ so a stamp can never be stale here, and the callsign code from the whale page so a wallet keeps its name.
// Stays noindex until coverage is real and it takes over from /hyperliquid-whales/.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const cat = fs.readFileSync(path.join(root, 'dist/catalysts/index.html'), 'utf8');
const gw = fs.readFileSync(path.join(__dirname, 'gen-whales-page.js'), 'utf8');
const src = fs.readFileSync(path.join(__dirname, 'hl-page.src.html'), 'utf8');
const pick = (re, what) => { const m = cat.match(re); if (!m) throw new Error('missing ' + what); return m[0]; };
const preloads = (cat.match(/<link rel="preload"[^>]*>/g) || []).join('\n');
const nav = pick(/<script defer src="\/assets\/mp-nav\.js[^>]*><\/script>/, 'mp-nav');
const crit = pick(/<style id="mpHdrCrit">[\s\S]*?<\/style>/, 'header css');
const hdr = pick(/<header class="mpnav-hdr">[\s\S]*?<\/header>/, 'header');
const a = gw.indexOf("  var WH_A=['Quiet'"), b = gw.indexOf("'<g fill=\"url(#'+gid+')\" opacity=\".93\">'+cells+'</g></svg>';", a);
if (a < 0 || b < 0) throw new Error('callsign block moved');
const who = gw.slice(a, gw.indexOf('}', b) + 1);
if (src.indexOf('/*@WHO*/') < 0) throw new Error('marker');
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>Hyperliquid Wallets: Cohorts, Positions and Top Traders | MarginPad</title>
<meta name="description" content="Who is long and who is short on Hyperliquid, grouped by all-time profit and account size, with top positions and position changes on every coin." />
<meta name="robots" content="noindex" />
<meta name="theme-color" content="#0a0b0d" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
${preloads}
<link rel="stylesheet" href="/assets/fonts.css" />
${nav}
${crit}
</head>
<body>
${hdr}
${src.replace('/*@WHO*/', () => who)}
</body>
</html>
`;
const out = path.join(root, 'dist/hyperliquid');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('hyperliquid page', html.length);
