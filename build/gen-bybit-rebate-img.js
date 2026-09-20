/* Pictures for the weekly Bybit rebate (2026-09-20).

   TWO IMAGES, TWO SHAPES, and the shapes are the whole reason this file exists twice over:
     bybit-rebate.jpg     1200x630  - the card above the weekly post in the channel
     bybit-rebate-pfp.jpg  640x640  - the channel's profile picture, which Telegram crops to a CIRCLE

   A profile picture is not a small share card. Telegram renders it at 50px in a chat list, masks it to
   a circle, and everything near a corner is gone - so the PFP carries a mark and one word, at a size
   that survives being 50 pixels wide, and nothing else. Putting the headline in it would produce a
   grey smudge.

   No numbers in either: the figures change every week, and a picture with last week's total baked in
   would have to be regenerated every Tuesday, which is a thing that would eventually not happen.

   Built on the same ground and fonts as the share cards. NO EMOJI (house rule).

   Run:  node build/gen-bybit-rebate-img.js        (manual - needs Chrome, like gen-og-images.js)
   Then: git add -f dist/assets/bybit-rebate*.jpg  (dist/assets IS committed)
*/
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser.js');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'assets');

let FONTS = '';
try { FONTS = fs.readFileSync(path.join(DIST, 'fonts.css'), 'utf8'); } catch (e) {}

const GOLD = '#f0b90b';   // Bybit's own accent, so the card reads as being about Bybit
const LIME = '#c2f64a';

const BASE = (w, h, inner, extra) => `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${w}px;height:${h}px;overflow:hidden;background:#0a0b0d;color:#e8eaed;
  font-family:'Bricolage Grotesque',system-ui,sans-serif;-webkit-font-smoothing:antialiased;position:relative}
.glow{position:absolute;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle,${GOLD}26,transparent 64%)}
.card{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between}
.mono{font-family:'Space Mono',monospace}
${extra || ''}
</style></head><body><div class="glow"></div><div class="card">${inner}</div></body></html>`;

/* ---- the wide card, above the weekly post -------------------------------------------------- */
// `margin:auto 0` on the middle block, not space-between alone: with a three-line headline the middle
// is tall enough that space-between leaves the eyebrow touching the logo, which the first render did.
const WIDE = BASE(1200, 630, `
  <div class="logo">MARGIN<b>PAD</b></div>
  <div style="margin:auto 0">
    <div class="eyebrow"><span class="dot"></span>Bybit weekly rebate</div>
    <div class="h">A third of what<br>you earn us,<br>back to you.</div>
    <div class="sub mono">Every week, worked out from Bybit&rsquo;s own figures for your UID.</div>
  </div>
  <div class="foot mono"><span class="bar"></span><span class="site">marginpad.io</span></div>
`, `
.glow{width:980px;height:980px;top:-430px;right:-300px}
.card{padding:66px 76px}
.logo{font-family:'Space Mono',monospace;font-size:26px;font-weight:700;letter-spacing:2.4px;color:#e8eaed;z-index:2}
.logo b{color:${LIME}}
.eyebrow{display:inline-flex;align-items:center;gap:12px;font-family:'Space Mono',monospace;font-size:20px;font-weight:700;
  letter-spacing:3.4px;text-transform:uppercase;color:${GOLD}}
.eyebrow .dot{width:11px;height:11px;border-radius:50%;background:${GOLD};display:block}
.h{font-weight:800;letter-spacing:-3px;line-height:1.02;color:#fff;font-size:88px;margin-top:30px}
.sub{line-height:1.45;color:#98a1ad;margin-top:24px;font-size:27px;max-width:820px}
.foot{display:flex;align-items:center;gap:16px;font-size:23px;color:#6b7480;z-index:2}
.foot .bar{height:8px;width:96px;border-radius:5px;background:${GOLD}}
.foot .site{color:#98a1ad}
`);

/* ---- the profile picture ---------------------------------------------------------------------
   Everything is pulled well inside a centred circle of diameter 640, because that is the only part
   Telegram keeps. Nothing is allowed within ~90px of a corner. */
const PFP = BASE(640, 640, `
  <div class="mid">
    <div class="mark mono">%</div>
    <div class="wm">MARGIN<b>PAD</b></div>
    <div class="tag mono">WEEKLY REBATE</div>
  </div>
`, `
.glow{width:760px;height:760px;top:-250px;left:-60px}
.card{padding:0;align-items:center;justify-content:center}
.mid{display:flex;flex-direction:column;align-items:center;gap:0}
.mark{font-weight:700;font-size:250px;line-height:.86;color:${GOLD};letter-spacing:-12px}
.wm{font-family:'Space Mono',monospace;font-weight:700;font-size:44px;letter-spacing:2px;color:#e8eaed;margin-top:26px}
.wm b{color:${LIME}}
.tag{font-size:21px;font-weight:700;letter-spacing:5px;color:#8b93a0;margin-top:14px}
`);

const JOBS = [
  { name: 'bybit-rebate.jpg', w: 1200, h: 630, html: WIDE, sel: '.h', font: '800 88px "Bricolage Grotesque"' },
  { name: 'bybit-rebate-pfp.jpg', w: 640, h: 640, html: PFP, sel: '.wm', font: '700 44px "Space Mono"' }
];

withBrowser(async (browser) => {
  for (const j of JOBS) {
    const page = await browser.newPage();
    await page.setViewport({ width: j.w, height: j.h, deviceScaleFactor: 1 });
    await page.setContent(j.html, { waitUntil: 'networkidle0', timeout: 30000 });
    try { await page.evaluateHandle('document.fonts.ready'); } catch (e) {}
    await new Promise(r => setTimeout(r, 400));
    // The fonts MUST have loaded. The local woff2 subset has no lowercase, which is exactly how the
    // share cards were wrong before 2026-09-14 - a serif fallback that only shows up by looking.
    const fontOk = await page.evaluate((sel, font) => {
      const el = document.querySelector(sel);
      return !!(el && document.fonts.check(font));
    }, j.sel, j.font);
    if (!fontOk) console.warn('  WARNING - ' + j.name + ': the brand font did not load; it will render in a fallback');
    const buf = await page.screenshot({ type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: j.w, height: j.h } });
    fs.writeFileSync(path.join(DIST, j.name), buf);
    console.log('wrote dist/assets/' + j.name + ' - ' + j.w + 'x' + j.h + ', ' + Math.round(buf.length / 1024) + ' KB, fonts ' + (fontOk ? 'ok' : 'FALLBACK'));
    await page.close();
  }
});
