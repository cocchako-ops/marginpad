/* Profile pictures for the two partner bonus channels (2026-10-30, owner: "Promeni profilne slike na kanalima i napravi
   nesto Marginpad x Bybit i isto tako za BingX (u njihovim bojama)").

   Two 640x640 JPEGs, each a MARGINPAD x <partner> lock-up in the partner's colour: Bybit's orange on black, BingX's blue
   on black. Telegram masks a channel picture to a CIRCLE and renders it at 50px, so everything sits well inside the inscribed
   circle and the lock-up is large. The Bybit wordmark is their own SVG (build/data); the BingX mark is a vector drawing of
   their square-with-an-X (the only BingX asset we hold is a 64px PNG, which would blur at this size).

   THE FILENAME CARRIES A VERSION: Telegram caches a photo by its URL (see gen-bybit-rebate-img.js) - new art, new name.
   Set them with GET /api/admin/tgchans?photo=/assets/tg-mp-x-bybit-v1.jpg and ?photobingx=/assets/tg-mp-x-bingx-v1.jpg.
   NO EMOJI (house rule).

   Run:  node build/gen-channel-pfp.js       (manual - needs Chrome)
   Then: git add -f dist/assets/tg-mp-x-*.jpg                                                                         */
'use strict';
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser.js');
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'assets');
let FONTS = ''; try { FONTS = fs.readFileSync(path.join(DIST, 'fonts.css'), 'utf8'); } catch (e) {}
let BYBIT = ''; try { BYBIT = fs.readFileSync(path.join(ROOT, 'build', 'data', 'bybit-logo-inline.svg'), 'utf8').replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" '); } catch (e) { console.warn('bybit logo missing'); }
const LIME = '#c2f64a';
// BingX: a rounded blue square carrying a bold white X with the brand's clipped inner corners - drawn, not scaled from the 64px png
const BINGX_MARK = (s) => `<svg viewBox="0 0 100 100" width="${s}" height="${s}" aria-hidden="true"><rect width="100" height="100" rx="22" fill="#2b54fc"/><path fill="#fff" d="M24 27h14l12 15 12-15h14L58 50l18 23H62L50 58 38 73H24l18-23z"/></svg>`;
const BASE = (partner, col, mark, markH) => `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
body{width:640px;height:640px;overflow:hidden;background:#0a0b0d;color:#e8eaed;font-family:'Bricolage Grotesque',system-ui,sans-serif;-webkit-font-smoothing:antialiased;position:relative}
.bg{position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,${col}33,transparent 58%)}
.ring{position:absolute;left:16px;top:16px;width:608px;height:608px;border-radius:50%;border:5px solid ${col};opacity:.9}
.ring2{position:absolute;left:34px;top:34px;width:572px;height:572px;border-radius:50%;border:1px solid ${col};opacity:.35}
.mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0}
.wm{font-family:'Space Mono',monospace;font-weight:700;font-size:46px;letter-spacing:3px;color:#fff;line-height:1}
.wm b{color:${LIME}}
.x{font-weight:800;font-size:72px;line-height:1;color:${col};margin:14px 0 10px;letter-spacing:-2px}
.pt{display:flex;align-items:center;gap:16px;height:${markH}px}
.pt svg{height:${markH}px;width:auto;color:#fff}
.pt .nm{font-weight:800;font-size:66px;letter-spacing:-2px;color:#fff;line-height:1}
.tag{font-family:'Space Mono',monospace;font-size:17px;font-weight:700;letter-spacing:6px;color:${col};margin-top:30px;text-transform:uppercase}
</style></head><body>
  <div class="bg"></div><div class="ring"></div><div class="ring2"></div>
  <div class="mid">
    <div class="wm">MARGIN<b>PAD</b></div>
    <div class="x">&times;</div>
    <div class="pt">${mark}</div>
    <div class="tag">WEEKLY BONUS</div>
  </div>
</body></html>`;
const JOBS = [
  { name: 'tg-mp-x-bybit-v1.jpg', html: BASE('Bybit', '#f7a600', BYBIT, 78), font: '700 46px "Space Mono"' },
  { name: 'tg-mp-x-bingx-v1.jpg', html: BASE('BingX', '#2b54fc', BINGX_MARK(84) + '<span class="nm">BingX</span>', 84), font: '800 66px "Bricolage Grotesque"' }
];
withBrowser(async (browser) => {
  for (const j of JOBS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 640, height: 640, deviceScaleFactor: 1 });
    await page.setContent(j.html, { waitUntil: 'networkidle0', timeout: 30000 });
    try { await page.evaluateHandle('document.fonts.ready'); } catch (e) {}
    await new Promise(r => setTimeout(r, 450));
    const chk = await page.evaluate((font) => {
      const over = [...document.querySelectorAll('.mid *')].filter(n => { const r = n.getBoundingClientRect(); return r.width > 1 && (r.left < 60 || r.top < 60 || r.right > 580 || r.bottom > 580); }).length;
      return { font: document.fonts.check(font), over };
    }, j.font);
    if (!chk.font) console.warn('  WARNING - ' + j.name + ': brand font did not load');
    if (chk.over) console.warn('  WARNING - ' + j.name + ': ' + chk.over + ' element(s) outside the safe circle');
    const buf = await page.screenshot({ type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 640, height: 640 } });
    fs.writeFileSync(path.join(DIST, j.name), buf);
    console.log('wrote dist/assets/' + j.name + ' - ' + Math.round(buf.length / 1024) + ' KB, fonts ' + (chk.font ? 'ok' : 'FALLBACK') + ', outside the safe circle ' + chk.over);
    await page.close();
  }
}, { timeoutMs: 120000 });
