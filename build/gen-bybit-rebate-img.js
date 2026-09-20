/* The picture on the weekly Bybit rebate post (2026-09-20).

   A channel of plain text gets scrolled past, so the weekly post carries a card. It is NOT an og card:
   nobody shares it, Telegram just shows it above the caption - so it says the one thing the caption
   then explains, and nothing else. No numbers on it: the figures change every week and a picture with
   last week's total baked in would have to be regenerated every Tuesday, which is a thing that would
   eventually not happen.

   Built on the same shell as the share cards (build/og/templates.js) so it uses the brand fonts and the
   house ground, and rendered the same way - Chrome, 1200x630, JPEG q90. NO EMOJI (house rule).

   Run: node build/gen-bybit-rebate-img.js       (manual - needs Chrome, like gen-og-images.js)
   Then: git add -f dist/assets/bybit-rebate.jpg  (dist/assets IS committed)
*/
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser.js');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'assets', 'bybit-rebate.jpg');
const tpl = require('./og/templates.js');

// the share-card renderer embeds the fonts as base64 because the page has no network; reuse that
let FONTS = '';
try {
  const css = fs.readFileSync(path.join(ROOT, 'dist', 'assets', 'fonts.css'), 'utf8');
  FONTS = css;   // gstatic @font-face - the renderer has network here, unlike the og pass
} catch (e) {}

const GOLD = '#f0b90b';   // Bybit's own accent, so the card reads as being about Bybit
// `margin:auto 0` on the middle block, not space-between alone: with a three-line headline the middle
// is tall enough that space-between leaves the eyebrow touching the logo, which is what the first
// render did. Centring the block distributes what is left evenly instead.
const inner = `
  <div class="logo">MARGIN<b>PAD</b></div>
  <div style="margin:auto 0">
    <div class="eyebrow"><span class="dot"></span>Bybit weekly rebate</div>
    <div class="h" style="font-size:88px;margin-top:30px">A third of what<br>you earn us,<br>back to you.</div>
    <div class="sub" style="font-size:27px;max-width:820px">Every week, worked out from Bybit&rsquo;s own figures for your UID.</div>
  </div>
  <div class="foot"><span class="bar"></span><span class="site">marginpad.io</span></div>
`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#0a0b0d;color:#e8eaed;
  font-family:'Bricolage Grotesque',system-ui,sans-serif;-webkit-font-smoothing:antialiased;position:relative}
.glow{position:absolute;width:980px;height:980px;border-radius:50%;top:-430px;right:-300px;
  background:radial-gradient(circle,${GOLD}26,transparent 64%);pointer-events:none}
.card{position:absolute;inset:0;padding:66px 76px;display:flex;flex-direction:column;justify-content:space-between}
.logo{font-family:'Space Mono',monospace;font-size:26px;font-weight:700;letter-spacing:2.4px;color:#e8eaed;z-index:2}
.logo b{color:#c2f64a}
.eyebrow{display:inline-flex;align-items:center;gap:12px;font-family:'Space Mono',monospace;font-size:20px;font-weight:700;
  letter-spacing:3.4px;text-transform:uppercase;color:${GOLD}}
.eyebrow .dot{width:11px;height:11px;border-radius:50%;background:${GOLD};display:block}
.h{font-weight:800;letter-spacing:-3px;line-height:1.02;color:#fff}
.sub{font-family:'Space Mono',monospace;line-height:1.45;color:#98a1ad;margin-top:24px}
.foot{display:flex;align-items:center;gap:16px;font-family:'Space Mono',monospace;font-size:23px;color:#6b7480;z-index:2}
.foot .bar{height:8px;width:96px;border-radius:5px;background:${GOLD}}
.foot .site{color:#98a1ad}
</style></head><body><div class="glow"></div><div class="card">${inner}</div></body></html>`;

withBrowser(async (browser) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
  try { await page.evaluateHandle('document.fonts.ready'); } catch (e) {}
  await new Promise(r => setTimeout(r, 400));
  // the fonts MUST have loaded or the card renders in a serif fallback - the local woff2 subset has no
  // lowercase, which is exactly how the share cards were wrong before 2026-09-14
  const fontOk = await page.evaluate(() => {
    const el = document.querySelector('.h');
    return el ? getComputedStyle(el).fontFamily.indexOf('Bricolage') >= 0 && document.fonts.check('800 96px "Bricolage Grotesque"') : false;
  });
  if (!fontOk) console.warn('gen-bybit-rebate-img: WARNING - Bricolage did not load; the card will look wrong');
  const buf = await page.screenshot({ type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  fs.writeFileSync(OUT, buf);
  console.log('wrote ' + path.relative(ROOT, OUT) + ' - ' + Math.round(buf.length / 1024) + ' KB, fonts ' + (fontOk ? 'ok' : 'FALLBACK'));
  await page.close();
});
