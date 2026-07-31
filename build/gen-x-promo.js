// Generate X promo screenshots from the LIVE site → dist/assets/x/*.png (1200x675 @2x, X 16:9).
// These are attached to the evergreen auto-posts (see xPromoMedia/checkXPost in worker.js). Regenerate
// when the UI changes materially:  node build/gen-x-promo.js   then force-add + npm run deploy.
const fs = require('fs'), path = require('path');
const { withBrowser, newPage } = require('./e2e-browser');

const OUT = path.join(__dirname, '..', 'dist', 'assets', 'x');
const SHOTS = [
  { name: 'screener.png', url: 'https://marginpad.io/screener', waitMs: 7000 },
  { name: 'papertrade.png', url: 'https://marginpad.io/paper-trade', waitMs: 9000 },
  { name: 'liquidations.png', url: 'https://marginpad.io/liquidations', waitMs: 8000 },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await withBrowser(async (browser) => {
    for (const s of SHOTS) {
      const page = await newPage(browser);
      await page.setViewport({ width: 1200, height: 675, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument(() => { try { localStorage.setItem('mp_ck_ok', '1'); } catch (e) {} }); // suppress the cookie banner
      try {
        await page.goto(s.url, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
        await new Promise(r => setTimeout(r, s.waitMs)); // let charts/data render
        await page.addStyleTag({ content: '#mpCkBar,#chatFab,.totop{display:none!important}' }).catch(() => {}); // hide floating chrome for a clean hero
        const file = path.join(OUT, s.name);
        await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1200, height: 675 } });
        const kb = Math.round(fs.statSync(file).size / 1024);
        console.log(s.name + ' -> ' + kb + 'KB');
      } catch (e) { console.error(s.name + ' FAILED: ' + e.message); }
      finally { await page.close().catch(() => {}); }
    }
  }, { timeoutMs: 120000 });
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ generated: new Date().toISOString(), shots: SHOTS.map(s => s.name) }));
  console.log('done — wrote manifest.json (force-add dist/assets/x/manifest.json + the pngs, then npm run deploy)');
})();
