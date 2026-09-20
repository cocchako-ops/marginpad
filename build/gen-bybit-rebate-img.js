/* Pictures for the weekly Bybit bonus (2026-09-20).

   TWO IMAGES, TWO SHAPES, and the shapes are the whole reason:
     bybit-bonus-v2.jpg      1200x630  - the card above the weekly post in the channel
     bybit-bonus-pfp-v2.jpg   640x640  - the channel's profile picture, cropped to a CIRCLE

   THE FILENAME CARRIES A VERSION, and that is not tidiness. TELEGRAM CACHES A PHOTO BY ITS URL:
   re-uploading different bytes to the same path leaves every existing post AND the channel avatar
   showing the OLD picture, with nothing in any API response to say so - setChatPhoto still answers
   ok:true. That is exactly what happened here: the file on the site was right for hours while
   Telegram kept serving the previous one, and it read as "you did not change it".
   Change the art -> change the filename -> update BYBIT_REBATE_IMG in src/worker.js.

   A profile picture is not a small share card: Telegram renders it at 50px and masks it to a circle,
   so the PFP carries the gift and one word and nothing near a corner. The wide card can hold a
   lock-up, because it is seen at full width directly above the post.

   No numbers in either - the figures change weekly, and a picture with last week's total baked in
   would need regenerating every Tuesday, which is a thing that would eventually not happen.

   NO EMOJI anywhere (house rule). The Bybit mark is their own logo, from build/data.

   Run:  node build/gen-bybit-rebate-img.js       (manual - needs Chrome, like gen-og-images.js)
   Then: git add -f dist/assets/bybit-bonus*.jpg
*/
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser.js');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'assets');

let FONTS = '';
try { FONTS = fs.readFileSync(path.join(DIST, 'fonts.css'), 'utf8'); } catch (e) {}

// Bybit's own wordmark. currentColor drives the letters; the orange bar is theirs and stays theirs.
let BYBIT = '';
try {
  BYBIT = fs.readFileSync(path.join(ROOT, 'build', 'data', 'bybit-logo-inline.svg'), 'utf8')
    .replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" ');
} catch (e) { console.warn('bybit logo missing - the lock-up will be text only'); }

const GOLD = '#f0b90b';     // Bybit
const LIME = '#c2f64a';     // MarginPad

const GIFT = (s, ribbon) => `
<svg viewBox="0 0 120 120" width="${s}" height="${s}" fill="none" aria-hidden="true">
  <rect x="14" y="44" width="92" height="62" rx="7" fill="${GOLD}"/>
  <rect x="6" y="28" width="108" height="24" rx="6" fill="#ffd24a"/>
  <rect x="51" y="28" width="18" height="78" fill="${ribbon}" opacity=".85"/>
  <path d="M60 28c-10-2-22-6-26-14-3-6 1-12 8-12 9 0 15 12 18 26z" fill="#ffd24a"/>
  <path d="M60 28c10-2 22-6 26-14 3-6-1-12-8-12-9 0-15 12-18 26z" fill="#ffd24a"/>
</svg>`;

const BASE = (w, h, inner, extra) => `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${w}px;height:${h}px;overflow:hidden;background:#0a0b0d;color:#e8eaed;
  font-family:'Bricolage Grotesque',system-ui,sans-serif;-webkit-font-smoothing:antialiased;position:relative}
.mono{font-family:'Space Mono',monospace}
${extra || ''}
</style></head><body>${inner}</body></html>`;

/* ---- the wide card ---------------------------------------------------------------------------
   A LOCK-UP, not a headline: two brands, the thing being given, and one line under it. That is all a
   channel card has to do in the second somebody scrolls past it - the headline version said more and
   communicated less. */
const WIDE = BASE(1200, 630, `
  <div class="bg"></div>
  <div class="rule"></div>
  <div class="card">
    <div class="lock">
      <span class="mp mono">MARGIN<b>PAD</b></span>
      <span class="x mono">+</span>
      <span class="by">${BYBIT}</span>
    </div>
    <div class="hero">
      ${GIFT(150, '#0a0b0d')}
      <div class="ht">
        <div class="k mono">Every week</div>
        <div class="h">WEEKLY<br>BONUS</div>
      </div>
    </div>
    <div class="foot mono"><span>Trade on Bybit. Get paid on MarginPad.</span><span class="site">marginpad.io</span></div>
  </div>
`, `
.bg{position:absolute;width:1100px;height:1100px;border-radius:50%;top:-500px;right:-330px;
  background:radial-gradient(circle,${GOLD}2e,transparent 62%)}
.rule{position:absolute;left:0;right:0;bottom:0;height:7px;
  background:linear-gradient(90deg,${LIME} 0%,${LIME} 46%,${GOLD} 54%,${GOLD} 100%)}
.card{position:absolute;inset:0;padding:58px 76px 56px;display:flex;flex-direction:column;justify-content:space-between}
.lock{display:flex;align-items:center;gap:24px}
.mp{font-size:30px;font-weight:700;letter-spacing:2.6px;color:#e8eaed}
.mp b{color:${LIME}}
.x{font-size:26px;font-weight:700;color:#5b636e}
.by{color:#e8eaed;display:inline-flex;align-items:center}
.by svg{height:31px;width:auto;display:block}
.hero{display:flex;align-items:center;gap:42px;margin:auto 0}
.ht{display:flex;flex-direction:column}
.k{font-size:19px;font-weight:700;letter-spacing:4.4px;text-transform:uppercase;color:${GOLD};margin-bottom:12px}
.h{font-weight:800;font-size:104px;line-height:.94;letter-spacing:-3.4px;color:#fff}
.foot{display:flex;align-items:center;justify-content:space-between;font-size:22px;color:#98a1ad}
.foot .site{color:#6b7480}
`);

/* ---- the profile picture ---------------------------------------------------------------------
   Everything well inside a centred circle of diameter 640 - the only part Telegram keeps. */
const PFP = BASE(640, 640, `
  <div class="bg"></div>
  <div class="mid">
    ${GIFT(216, '#0a0b0d')}
    <div class="wm mono">MARGIN<b>PAD</b></div>
    <div class="tag mono">WEEKLY BONUS</div>
  </div>
`, `
.bg{position:absolute;width:760px;height:760px;border-radius:50%;top:-250px;left:-60px;
  background:radial-gradient(circle,${GOLD}26,transparent 64%)}
.mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.wm{font-weight:700;font-size:44px;letter-spacing:2px;color:#e8eaed;margin-top:26px}
.wm b{color:${LIME}}
.tag{font-size:21px;font-weight:700;letter-spacing:5px;color:#8b93a0;margin-top:14px}
`);

const JOBS = [
  { name: 'bybit-bonus-v2.jpg', w: 1200, h: 630, html: WIDE, font: '800 104px "Bricolage Grotesque"', need: '.h' },
  { name: 'bybit-bonus-pfp-v2.jpg', w: 640, h: 640, html: PFP, font: '700 44px "Space Mono"', need: '.wm' }
];

withBrowser(async (browser) => {
  for (const j of JOBS) {
    const page = await browser.newPage();
    await page.setViewport({ width: j.w, height: j.h, deviceScaleFactor: 1 });
    await page.setContent(j.html, { waitUntil: 'networkidle0', timeout: 30000 });
    try { await page.evaluateHandle('document.fonts.ready'); } catch (e) {}
    await new Promise(r => setTimeout(r, 450));
    // The brand font MUST have loaded, and nothing may sit outside the frame. Both are invisible in
    // the source and obvious in the picture, which is the only reason these checks exist.
    const chk = await page.evaluate((sel, font, W, H) => {
      const el = document.querySelector(sel);
      const over = [...document.querySelectorAll('.card *, .mid *')].filter(n => {
        const r = n.getBoundingClientRect();
        return r.width > 1 && (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1);
      }).length;
      return { font: !!(el && document.fonts.check(font)), over };
    }, j.need, j.font, j.w, j.h);
    if (!chk.font) console.warn('  WARNING - ' + j.name + ': brand font did not load, this renders in a fallback');
    if (chk.over) console.warn('  WARNING - ' + j.name + ': ' + chk.over + ' element(s) outside the frame');
    const buf = await page.screenshot({ type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: j.w, height: j.h } });
    fs.writeFileSync(path.join(DIST, j.name), buf);
    console.log('wrote dist/assets/' + j.name + ' - ' + j.w + 'x' + j.h + ', ' + Math.round(buf.length / 1024) + ' KB, fonts ' + (chk.font ? 'ok' : 'FALLBACK') + ', overflow ' + chk.over);
    await page.close();
  }
  console.log('\nTelegram caches by URL: if you change the art, change the filename and update');
  console.log('BYBIT_REBATE_IMG in src/worker.js, or every existing post keeps the old picture.');
});
