/* THE COMMAND PALETTE (2026-11-12, owner-approved feature #5): Ctrl+K / Cmd+K opens Browse with the search focused on every page;
   a query that reads as a command puts ACTION chips above the rows - `short sol 10x` -> the terminal with side and leverage,
   a bare ticker -> Trade X, `chat` -> the live chat, `trades` -> My Trades - walked by the same arrows and opened by Enter.
   Run: node build/palette-e2e.js [--local] */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = 'https://marginpad.io', LOCAL = process.argv.includes('--local'), ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let okN = 0, failN = 0; const chk = (n, ok, x) => { ok ? okN++ : failN++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 240) : '')); };
const CT = { js: 'text/javascript', css: 'text/css', html: 'text/html; charset=utf-8' };
function localFile(u) { const p = new URL(u).pathname; if (p.indexOf('/assets/') === 0) return path.join(ROOT, 'dist', p); if (/^\/(paper-trade|charts|heatmap|screener|calculators|swap)$/.test(p)) return path.join(ROOT, 'app', 'index.html'); if (p === '/rekt/') return path.join(ROOT, 'dist', 'rekt', 'index.html'); return null; }
async function mk(browser, w) {
  const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport({ width: w, height: w < 500 ? 844 : 900, isMobile: w < 500, hasTouch: w < 500 });
  if (LOCAL) { await p.setRequestInterception(true); p.on('request', r => { const f = localFile(r.url()); if (f && fs.existsSync(f)) { const ext = f.split('.').pop(); return r.respond({ status: 200, headers: { 'content-type': CT[ext] || 'application/octet-stream', 'cache-control': 'no-store' }, body: fs.readFileSync(f) }); } r.continue(); }); }
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  return { ctx, p, errs };
}
const chips = () => [...document.querySelectorAll('#mpnavActs a')].map(a => ({ t: a.textContent.trim(), h: a.getAttribute('href'), k: a.getAttribute('data-act') }));
(async () => {
  await withBrowser(async (browser) => {
    { // an SEO page with mp-nav: /rekt/
      const { ctx, p, errs } = await mk(browser, 1366);
      await p.goto(ORIGIN + '/rekt/', { waitUntil: 'load', timeout: 90000 }); await p.waitForFunction(() => !!window.mpNavOpen, { timeout: 30000 });
      await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control'); await sleep(500);
      const st = await p.evaluate(() => ({ open: !!document.querySelector('.mpnav.open') || !(document.querySelector('.mpnav') || { hidden: true }).hidden, focus: document.activeElement && document.activeElement.className, kbd: (document.querySelector('.mpnav-kbd') || {}).textContent }));
      chk('Ctrl+K opens Browse with the search focused', st.open && /mpnav-search/.test(st.focus || ''), st);
      chk('the field carries the Ctrl K hint on a desktop', /K$/.test(st.kbd || ''), st.kbd);
      await p.keyboard.type('short sol 10x'); await sleep(400);
      let c = await p.evaluate(chips);
      chk('`short sol 10x` offers the terminal with side and leverage', c.length === 1 && c[0].h === '/paper-trade?coin=SOL&side=short&lev=10' && /Short/.test(c[0].t) && /SOL 10x/.test(c[0].t), c);
      const under = await p.evaluate(() => { const a = document.querySelector('#mpnavActs a'); const r = a.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!(e && (e === a || a.contains(e))); });
      chk('the chip is where it is drawn', under);
      await p.keyboard.press('Enter'); await p.waitForFunction(() => /\/paper-trade/.test(location.pathname), { timeout: 20000 }).then(() => chk('Enter opens the first chip (the deep link)', true)).catch(async () => chk('Enter opens the first chip (the deep link)', false, await p.evaluate(() => location.href)));
      const q = await p.evaluate(() => location.search);
      chk('and the terminal URL carries coin, side and leverage', /coin=SOL/.test(q) && /side=short/.test(q) && /lev=10/.test(q), q);
      chk('no page errors', errs.length === 0, errs);
      await ctx.close();
    }
    { // the shell: a bare ticker, a reversed command, the chat action, a non-command
      const { ctx, p } = await mk(browser, 1366);
      await p.goto(ORIGIN + '/paper-trade', { waitUntil: 'load', timeout: 90000 }); await p.waitForFunction(() => !!window.mpNavOpen, { timeout: 30000 });
      await p.evaluate(() => window.mpNavOpen()); await sleep(500);
      const type = async (s) => { await p.evaluate(() => { const i = document.querySelector('.mpnav-search'); i.value = ''; i.focus(); }); await p.keyboard.type(s); await sleep(350); return p.evaluate(chips); };
      let c = await type('btc'); chk('a bare ticker offers Trade BTC', c.some(x => x.h === '/paper-trade?coin=BTC'), c);
      c = await type('eth long 25'); chk('`eth long 25` reads the reversed order too', c.some(x => x.h === '/paper-trade?coin=ETH&side=long&lev=25'), c);
      c = await type('long zzzzq'); chk('an unknown ticker offers nothing', c.length === 0, c);
      c = await type('chat'); chk('`chat` offers the live chat', c.some(x => x.k === 'chat'), c);
      await p.evaluate(() => { const a = document.querySelector('#mpnavActs a[data-act="chat"]'); a.click(); }); await p.waitForFunction(() => { const b = document.getElementById('chatBox'); return !!b && !b.hidden && getComputedStyle(b).display !== 'none'; }, { timeout: 15000 }).then(() => chk('and the chip opens it', true)).catch(() => chk('and the chip opens it', false));
      const drawer = await p.waitForFunction(() => { const d = document.querySelector('.mpnav'); return !!d && (d.hidden || !d.classList.contains('open')); }, { timeout: 3000 }).then(() => true).catch(() => false);
      chk('the drawer closed behind the action', drawer, drawer);
      await p.evaluate(() => { try { const b = document.getElementById('chatBox'); const x = b && b.querySelector('.ct-x, .ct-close, [data-ct-close]'); if (x) x.click(); else if (window.mpCloseChat) window.mpCloseChat(); } catch (e) {} }); await sleep(300); // the chat composer took the focus when it opened
      await p.evaluate(() => window.mpNavOpen()); await sleep(500);
      c = await type('liquidation'); const typed = await p.evaluate(() => document.querySelector('.mpnav-search').value);
      chk('an ordinary search shows no action chips (the rows and pages answer it)', typed === 'liquidation' && c.length === 0, { typed, c });
      await ctx.close();
    }
  }, { timeoutMs: 300000 });
  console.log('\npalette-e2e: ' + okN + ' passed, ' + failN + ' failed' + (LOCAL ? ' [local]' : ''));
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
