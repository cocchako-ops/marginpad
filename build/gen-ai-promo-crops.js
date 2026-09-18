// Crop the owner's four Ask AI screenshots to the part that carries the analysis, at a consistent
// aspect, and write them at 2x. They are real captures from the current build - the label fix is in
// them, so nothing overlaps - they were simply full browser frames with a lot of empty chart around
// the drawing. Cropping is the whole job; no text is added to the pixels.
const { withBrowser, newPage } = require('D:/part1/money-mission/build/e2e-browser.js');
const fs = require('fs');
const SRC = 'D:/part1/money-mission/Bug - screenshots & videos/';
const OUT = 'D:/part1/money-mission/dist/assets/plus/';

// x0,y0,x1,y1 as FRACTIONS of the natural size - kept fractional so a re-shoot at another resolution still works
const JOBS = [
  { in: 'Screenshot 2026-09-18 223246.png', out: 'ai-btc.jpg', box: [0.55, 0.06, 1.0, 0.88] },
  { in: 'Screenshot 2026-09-18 223431.png', out: 'ai-liq.jpg', box: [0.30, 0.13, 1.0, 0.63] },
  { in: 'Screenshot 2026-09-18 223605.png', out: 'ai-rr.jpg', box: [0.28, 0.16, 1.0, 0.56] },
  { in: 'Screenshot 2026-09-18 223123.png', out: 'ai-structure.jpg', box: [0.58, 0.13, 1.0, 0.56] },
];

withBrowser(async (browser) => {
  for (const j of JOBS) {
    const b64 = fs.readFileSync(SRC + j.in).toString('base64');
    const page = await newPage(browser);
    await page.setViewport({ width: 1000, height: 800, deviceScaleFactor: 2 });
    await page.setContent('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#0a0b0d}'
      + '#w{position:relative;overflow:hidden;background:#0a0b0d}#i{position:absolute;display:block;image-rendering:auto}'
      + '</style><div id="w"><img id="i" src="data:image/png;base64,' + b64 + '"></div>'
      + '<script>window.__fit=function(x0,y0,x1,y1,W){var i=document.getElementById("i"),w=document.getElementById("w");'
      + 'var nw=i.naturalWidth,nh=i.naturalHeight;var cw=(x1-x0)*nw,ch=(y1-y0)*nh;var k=W/cw;'
      + 'i.style.width=(nw*k)+"px";i.style.left=(-x0*nw*k)+"px";i.style.top=(-y0*nh*k)+"px";'
      + 'w.style.width=W+"px";w.style.height=Math.round(ch*k)+"px";return [W,Math.round(ch*k),nw,nh];};<\/script>',
      { waitUntil: 'load' });
    await new Promise(s => setTimeout(s, 700));
    const size = await page.evaluate((b, W) => window.__fit(b[0], b[1], b[2], b[3], W), j.box, 940);
    const el = await page.$('#w');
    await page.screenshot({ path: OUT + j.out, clip: await el.boundingBox(), type: 'jpeg', quality: 90 });
    console.log(j.out.padEnd(18) + size[0] + 'x' + size[1] + ' @2x   from ' + size[2] + 'x' + size[3] + '   ' + Math.round(fs.statSync(OUT + j.out).size / 1024) + ' KB');
    await page.close().catch(() => {});
  }
}, { timeoutMs: 200000 }).catch(e => { console.error('fatal', e.message); process.exitCode = 1; });
