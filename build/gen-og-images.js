/* Generate branded 1200x630 OG/social-card images for the data pages (rendered via puppeteer, brand font embedded).
   Run: node build/gen-og-images.js  (manual — not in build.js since it needs Chrome). Output: dist/assets/og/<file>.png */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const DIST = path.join(__dirname, '..', 'dist');
const OGDIR = path.join(DIST, 'assets', 'og');
fs.mkdirSync(OGDIR, { recursive: true });

const bric = fs.readFileSync(path.join(DIST, 'assets', 'fonts', 'bricolage.woff2')).toString('base64');
const mono = fs.readFileSync(path.join(DIST, 'assets', 'fonts', 'spacemono.woff2')).toString('base64');

const CARDS = [
  { file: 'liquidations', title: 'Crypto Liquidations', sub: 'Live 24h liquidations · longs vs shorts · most-rekt coins', emoji: '\u{1F4A5}' },
  { file: 'funding', title: 'Crypto Funding Rates', sub: 'Live funding · crowded longs, crowded shorts, squeeze setups', emoji: '\u{1F4CA}' },
  { file: 'long-short', title: 'Long / Short Ratio', sub: 'Live trader positioning across the top perpetual markets', emoji: '' },
  { file: 'open-interest', title: 'Crypto Open Interest', sub: 'Live OI · where leverage is building and unwinding', emoji: '\u{1F4C8}' },
  { file: 'coin', title: 'Perpetual Futures Data', sub: 'Live price, funding, open interest & liquidations per coin', emoji: '\u{1FA99}' },
];

function html(c) {
  return `<!doctype html><html><head><meta charset="utf8"><style>
@font-face{font-family:Bric;src:url(data:font/woff2;base64,${bric}) format('woff2');font-weight:600 800}
@font-face{font-family:Mono;src:url(data:font/woff2;base64,${mono}) format('woff2')}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:radial-gradient(900px 520px at 72% -130px,#16202b 0%,#0a0b0d 62%);color:#e9e7df;font-family:Bric,sans-serif;padding:72px 84px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
.logo{font-family:Mono;font-size:31px;font-weight:700;letter-spacing:2px}.logo b{color:#c2f64a}
.emoji{font-size:96px;position:absolute;top:62px;right:84px}
.title{font-size:90px;font-weight:800;letter-spacing:-2.5px;line-height:1.02;max-width:920px}
.sub{font-size:33px;color:#9aa3ad;font-family:Mono;margin-top:24px;max-width:940px;line-height:1.36}
.foot{display:flex;align-items:center;gap:18px;font-family:Mono;font-size:27px;color:#c2f64a}
.bar{height:9px;width:130px;background:#c2f64a;border-radius:5px}
.live{font-size:21px;color:#06231d;background:#2ebd85;padding:5px 13px;border-radius:8px;font-weight:700;letter-spacing:1px}
</style></head><body>
<div class="logo">MARGIN<b>PAD</b></div>
<div class="emoji">${c.emoji}</div>
<div><div class="title">${c.title}</div><div class="sub">${c.sub}</div></div>
<div class="foot"><span class="bar"></span>marginpad.io <span class="live">LIVE DATA</span></div>
</body></html>`;
}

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  for (const c of CARDS) {
    await p.setContent(html(c), { waitUntil: 'domcontentloaded' });
    await p.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 200));
    await p.screenshot({ path: path.join(OGDIR, c.file + '.png') });
    console.log('og: ' + c.file + '.png');
  }
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
