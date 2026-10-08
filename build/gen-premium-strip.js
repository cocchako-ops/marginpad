/* gen-premium-strip: a REAL capture of the /charts indicator strip with the four MarginPad indicators on, plus the
   card readings taken from the DOM at capture time, written into /premium/ as the "The chart reads itself" block.
   Never write a caption by hand - the figures under the picture are the figures in the picture.
     node build/gen-premium-strip.js            captures + rewrites dist/premium/index.html (idempotent)
     node build/gen-premium-strip.js --dry      prints the block only (no capture, uses the last report)
     node build/gen-premium-strip.js --page     rebuild the page block from the last report, no capture */
const fs = require('fs'), path = require('path');
const { withBrowser, newPage, UA_DESKTOP } = require('./e2e-browser.js');
const OUT = path.join(__dirname, '..', 'dist', 'assets', 'plus');
const REPORT = path.join(__dirname, 'data', 'strip-promo-report.json');
const PAGE = path.join(__dirname, '..', 'dist', 'premium', 'index.html');
const DRY = process.argv.includes('--dry'), PAGE_ONLY = process.argv.includes('--page');
const SYM = 'BTC', TF = '60', W = 1040, H = 720;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function capture() {
  fs.mkdirSync(OUT, { recursive: true });
  let report = null;
  await withBrowser(async (browser) => {
    const page = await newPage(browser, { mobile: false, ua: UA_DESKTOP });
    await page.setCacheEnabled(false); await page.setBypassServiceWorker(true);
    await page.setViewport({ width: 1560, height: 1000, deviceScaleFactor: 2 });
    await page.setCookie({ name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('/api/track')) return req.respond({ status: 204, body: '' });
      if (u.includes('/api/auth/me')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e-promo', username: 'probe', xp: 4100, level: 'silver', premium: true } }) });
      if (u.includes('/api/auth/xp') && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 4100, level: 'silver', log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
      if (u.includes('/api/premium/status') || u.includes('/api/ind/access')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ allowed: true, premium: true, signedIn: true, source: 'owner' }) });
      return req.continue();
    });
    await page.evaluateOnNewDocument((sym, tf, W, H) => { try { localStorage.setItem('mp_charts', JSON.stringify([{ sym, tf, inds: { ema: true, casc: true, brain: true, memory: true, magnet: true }, x: 80, y: 10, w: W, h: H, id: 1 }])); localStorage.setItem('mp_cws_rail', 'off'); localStorage.setItem('mp:leghide', '0'); localStorage.setItem('mp:subh', '380'); localStorage.setItem('mp_ch_theme', 'dark'); } catch (e) {} }, SYM, TF, W, H);/* the window is BUILT at the capture size - resizing it afterwards leaves the strip at the height the first applyInds measured */
    await page.goto('https://marginpad.io/charts?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 }); /* not networkidle2 - the price feed keeps the network busy and the wait timed out once */
    await sleep(12000);
    const ready = await page.evaluate(() => { const w = window.__mpWinsDbg && window.__mpWinsDbg[0]; return !!(w && w.sub && w._brain && w._casc && w._mem && document.querySelectorAll('.cwin .cwin-subcard[data-ix]').length >= 4); });
    if (!ready) throw new Error('the strip did not come up with the four MarginPad indicators - is Premium mocked?');
    // frame the window to the capture size and strip the chrome the reader does not need
    await page.evaluate(() => { const w = document.querySelector('.cwin'); w.querySelectorAll('.cwin-tools,.cwin-golive,#mpxpT,.cwin-rz').forEach(el => el.remove()); try { window.__mpWinsDbg[0].chart.timeScale().scrollToPosition(4, false); } catch (e) {} });
    await sleep(1500);
    const cards = await page.evaluate(() => [...document.querySelectorAll('.cwin .cwin-subcard[data-ix]')].map(c => ({ k: c.getAttribute('data-ix'), name: (c.querySelector('.k') || {}).textContent || '', value: (c.querySelector('.v') || {}).textContent || '', states: [...c.querySelectorAll('.st')].map(x => x.textContent), sub: [...c.querySelectorAll('.sv')].map(x => x.textContent) })));
    const price = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; return w.lastBar ? w.lastBar.close : null; });
    /* THE WHOLE VIEWPORT, THEN CROP IN THE BROWSER: both an element screenshot and a page clip came back shifted by the
       board's own scroll offset (three captures lost their left edge). A full-viewport shot has no offset to get wrong, and
       getBoundingClientRect is exact in those coordinates; the crop and the 2:1 downscale happen in one canvas draw. */
    const box = await page.evaluate(() => { const r = document.querySelector('.cwin').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height, dpr: window.devicePixelRatio || 1 }; });
    const png = await page.screenshot({ type: 'png', captureBeyondViewport: false });
    const b64 = await page.evaluate(async (data, box, W, H) => { const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode(); const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(img, box.x * box.dpr, box.y * box.dpr, box.width * box.dpr, box.height * box.dpr, 0, 0, W, H); return c.toDataURL('image/jpeg', 0.82).split(',')[1]; }, png.toString('base64'), box, W, H);
    fs.writeFileSync(path.join(OUT, 'strip-' + SYM.toLowerCase() + '.jpg'), Buffer.from(b64, 'base64'));
    report = { at: new Date().toISOString(), sym: SYM, tf: TF, w: W, h: H, file: 'strip-' + SYM.toLowerCase() + '.jpg', price, cards };
    fs.mkdirSync(path.dirname(REPORT), { recursive: true });
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
    await page.close();
  });
  return report;
}

const MP = { casc: 'Cascade Radar', brain: 'Market Brain', memory: 'Market Memory', magnet: 'Liquidation Magnet' };
function block(r) {
  const mp = r.cards.filter(c => MP[c.k]);
  const std = r.cards.filter(c => !MP[c.k]);
  let h = '<div id="stripshow">\n';
  h += '<div class="ss-h"><span class="k">THE CHART READS ITSELF</span><h3>Every indicator says what its line means, right where the line is</h3>';
  h += '<p class="ss-lead">A real capture of ' + esc(r.sym) + ' on the 1-hour chart with the four MarginPad indicators on. Each band carries a card with its value and the state a trader acts on - overbought or oversold, a cross and how many candles ago, a divergence against price, where the liquidation fuel sits, what is driving the Brain. Tap any card and the indicator explains itself: what you see, what it means, before a long, before a short.</p></div>\n';
  h += '<figure class="ss-fig"><img src="/assets/plus/' + r.file + '" width="' + r.w + '" height="' + r.h + '" alt="MarginPad charts: the indicator strip with Cascade Radar, Market Brain, Market Memory and the Liquidation Magnet cards reading their state" loading="lazy" decoding="async"><figcaption>Captured ' + esc(r.at.slice(0, 16).replace('T', ' ')) + ' UTC. The cards below are the cards in the picture.</figcaption></figure>\n';
  h += '<div class="ss-cards">' + mp.map(c => '<div class="ss-card mp"><b>' + esc(c.name || MP[c.k]) + '</b><span class="v">' + esc(c.value) + '</span>' + (c.states.length ? '<span class="st">' + c.states.map(esc).join(' &middot; ') + '</span>' : '') + (c.sub.length ? '<span class="sv">' + c.sub.map(esc).join(' &middot; ') + '</span>' : '') + '</div>').join('') + '</div>\n';
  if (std.length) h += '<div class="ss-cards std">' + std.map(c => '<div class="ss-card"><b>' + esc(c.name) + '</b><span class="v">' + esc(c.value) + '</span>' + (c.states.length ? '<span class="st">' + c.states.map(esc).join(' &middot; ') + '</span>' : '') + '</div>').join('') + '</div>\n';
  h += '<p class="ss-note">Free members get every standard indicator with the same cards. Premium adds the four MarginPad readouts above, built on our own liquidation data. Also new on every chart: bar replay, compare with a second coin, trading sessions, daily levels, six chart styles.</p>\n';
  h += '</div>';
  return h;
}
const CSS = '<style id="stripshowcss">#stripshow{margin:38px 0 10px;padding:26px 22px 22px;border:1px solid #1a212c;border-radius:18px;background:linear-gradient(180deg,#0e1218,#0a0d12)}#stripshow .ss-h .k{display:block;font-size:11px;font-weight:800;letter-spacing:.14em;color:#c2f64a;margin-bottom:8px}#stripshow h3{margin:0 0 10px;font-size:clamp(21px,2.6vw,30px);font-weight:800;letter-spacing:-.4px;line-height:1.15;color:#e9edf3}#stripshow .ss-lead{margin:0 0 18px;max-width:820px;font-size:14.5px;line-height:1.6;color:#aab5c4}#stripshow .ss-fig{margin:0 0 16px}#stripshow .ss-fig img{display:block;width:100%;height:auto;border-radius:12px;border:1px solid #232a36;background:#0b0f14}#stripshow figcaption{margin-top:7px;font-size:11.5px;color:#5c6b84;font-family:"Space Mono",monospace}#stripshow .ss-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:10px}#stripshow .ss-card{display:flex;flex-direction:column;gap:5px;padding:12px 13px;border-radius:12px;border:1px solid #1e2632;background:#0d1117}#stripshow .ss-card.mp{border-color:rgba(194,246,74,.28);background:linear-gradient(180deg,rgba(194,246,74,.07),rgba(194,246,74,.02))}#stripshow .ss-card b{font-size:12.5px;color:#cfd4da;letter-spacing:.02em}#stripshow .ss-card.mp b{color:#c2f64a}#stripshow .ss-card .v{font-family:"Space Mono",monospace;font-size:20px;font-weight:700;color:#e9edf3}#stripshow .ss-card .st{font-size:12px;color:#aab5c4}#stripshow .ss-card .sv{font-size:11.5px;color:#7c8794}#stripshow .ss-cards.std .ss-card{padding:9px 11px}#stripshow .ss-cards.std .v{font-size:15px}#stripshow .ss-note{margin:8px 0 0;font-size:12.5px;line-height:1.55;color:#8b98a8}@media(max-width:560px){#stripshow{padding:18px 13px 16px;border-radius:14px}#stripshow .ss-cards{grid-template-columns:1fr 1fr;gap:8px}#stripshow .ss-card .v{font-size:17px}}</style>';

function inject(r) {
  let page = fs.readFileSync(PAGE, 'utf8');
  const blockHtml = block(r);
  if (page.indexOf('<div id="stripshow">') >= 0) {
    const a = page.indexOf('<div id="stripshow">'), b = page.indexOf('</div>\n', page.indexOf('<p class="ss-note">', a)) + 7;
    page = page.slice(0, a) + blockHtml + page.slice(b);
  } else {
    // right under the eleven feature cards' wrap, before the Bot API note
    const anchor = '<p style="margin:18px auto 0;max-width:760px;text-align:center;font-size:13px;color:var(--dim);line-height:1.6">Building a bot?';
    const i = page.indexOf(anchor);
    if (i < 0) throw new Error('anchor (Building a bot? note) not found - refusing to guess');
    page = page.slice(0, i) + blockHtml + '\n    ' + page.slice(i);
  }
  if (page.indexOf('<style id="stripshowcss">') >= 0) page = page.replace(/<style id="stripshowcss">[\s\S]*?<\/style>/, () => CSS);
  else page = page.replace('</head>', () => CSS + '\n</head>');
  fs.writeFileSync(PAGE + '.tmp', page); fs.renameSync(PAGE + '.tmp', PAGE);
}

(async () => {
  let r = null;
  if (DRY || PAGE_ONLY) r = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  else r = await capture();
  if (DRY) { console.log(block(r)); return; }
  inject(r);
  console.log('stripshow: ' + r.cards.length + ' cards (' + r.cards.filter(c => MP[c.k]).length + ' MarginPad) from ' + r.file + ' -> dist/premium/index.html');
})().catch(e => { console.error(e); process.exit(1); });
