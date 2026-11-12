/* ONE WATCHLIST ON THE ACCOUNT (2026-11-12, owner-approved feature #12).
   window.mpWatch (mp-auth.js) is the one store; the terminal's favourites, the phone charts' stars and the screener's watchlist
   read it, the Browse drawer shows it, and a signed-in member's list lives in uprefs dev:watch through /api/push/device.
   What this locks down:
     - the three device lists this replaces are MERGED into the store on first run (nobody loses a star) and kept as mirrors
     - starring a market in the terminal's picker goes through the store and the Favourites tab shows it
     - the Browse drawer carries the list as reachable chips to /paper-trade?coin=
     - (--prod) a member's star reaches the account and a FRESH device with the same session sees it; a guest never writes
   Run: node build/watchlist-e2e.js [--local] [--prod]   (--local serves the bundles from the tree; --prod adds the server legs,
   which need the deploy that taught /api/push/device the `watch` key) */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = 'https://marginpad.io';
const LOCAL = process.argv.includes('--local'), PROD = process.argv.includes('--prod');
const ROOT = path.join(__dirname, '..');
const K = fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = (p, b) => fetch(ORIGIN + p, { method: 'POST', headers: H, body: JSON.stringify(b || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
let okN = 0, failN = 0;
const chk = (n, ok, x) => { ok ? okN++ : failN++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 260) : '')); };
const CT = { js: 'text/javascript', css: 'text/css', html: 'text/html; charset=utf-8', png: 'image/png', svg: 'image/svg+xml', json: 'application/json' };
function localFile(u) { const p = new URL(u).pathname; if (p.indexOf('/assets/') === 0) return path.join(ROOT, 'dist', p); if (/^\/(paper-trade|charts|heatmap|screener|calculators|swap)$/.test(p)) return path.join(ROOT, 'app', 'index.html'); return null; }
async function prep(page, w) {
  await page.setViewport({ width: w, height: w < 500 ? 844 : 900, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: 2 });
  if (LOCAL) { await page.setRequestInterception(true); page.on('request', r => { const f = localFile(r.url()); if (f && fs.existsSync(f)) { const ext = f.split('.').pop(); return r.respond({ status: 200, headers: { 'content-type': CT[ext] || 'application/octet-stream', 'cache-control': 'no-store' }, body: fs.readFileSync(f) }); } r.continue(); }); }
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160))); return errs;
}
const waitFor = (page, fn, ms) => page.waitForFunction(fn, { timeout: ms || 20000 });

(async () => {
  await withBrowser(async (browser) => {
    /* ---- A. migration + mirrors + the picker + Browse, as a GUEST on a local or production bundle ---- */
    {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); const errs = await prep(page, 1366);
      await page.evaluateOnNewDocument(() => { try { if (!localStorage.getItem('mp_watch')) { localStorage.setItem('mp_pt_favs', JSON.stringify(['SOL'])); localStorage.setItem('mp_mfc_fav', JSON.stringify(['ETH'])); localStorage.setItem('mp_watchlist', JSON.stringify(['BTCUSDT'])); } } catch (e) {} });
      await page.goto(ORIGIN + '/paper-trade', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await waitFor(page, () => !!window.mpWatch && !!document.getElementById('ptSymBtn'), 30000);
      const m = await page.evaluate(() => ({ list: window.mpWatch.list(), pt: JSON.parse(localStorage.getItem('mp_pt_favs') || '[]'), mfc: JSON.parse(localStorage.getItem('mp_mfc_fav') || '[]'), scr: JSON.parse(localStorage.getItem('mp_watchlist') || '[]') }));
      const has = (a, x) => Array.isArray(a) && a.indexOf(x) >= 0;
      chk('the three device lists are merged into one store (SOL from the terminal, ETH from the phone, BTC from the screener)', has(m.list, 'SOL') && has(m.list, 'ETH') && has(m.list, 'BTC') && m.list.length === 3, m.list);
      chk('every legacy key mirrors the store in its own shape', has(m.pt, 'BTC') && has(m.mfc, 'SOL') && has(m.scr, 'ETHUSDT') && m.scr.length === 3, { pt: m.pt, mfc: m.mfc, scr: m.scr });
      // star a market in the picker
      await page.click('#ptSymBtn'); await waitFor(page, () => !!document.getElementById('ptMkList') && document.querySelectorAll('#ptMkList [data-fav]').length > 3, 15000);
      const sym = await page.evaluate(() => { const b = [...document.querySelectorAll('#ptMkList [data-fav]')].find(x => !window.mpWatch.has(x.getAttribute('data-fav'))); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); window.__favBtn = b; return { s: b.getAttribute('data-fav'), x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      chk('the picker offers an unstarred market to star', !!sym, sym);
      if (sym) {
        const under = await page.evaluate((p) => { const e = document.elementFromPoint(p.x, p.y); return !!(e && (e === window.__favBtn || window.__favBtn.contains(e))); }, sym);
        chk('the star is what sits under the pointer', under);
        await page.mouse.click(sym.x, sym.y); await sleep(300);
        const after = await page.evaluate((s) => ({ has: window.mpWatch.has(s), stored: (JSON.parse(localStorage.getItem('mp_watch') || '{}').s || []).indexOf(s) >= 0, mirror: JSON.parse(localStorage.getItem('mp_pt_favs') || '[]').indexOf(s) >= 0 }), sym.s);
        chk('starring goes through the store, the store is written and the mirror follows', after.has && after.stored && after.mirror, after);
        const fav = await page.evaluate((s) => { const t = document.querySelector('#ptMkt [data-mt="fav"]'); if (t) t.click(); return new Promise(r => setTimeout(() => r({ rows: [...document.querySelectorAll('#ptMkList [data-mk]')].map(x => x.getAttribute('data-mk')) }), 250)); }, sym.s);
        chk('the Favourites tab lists it', fav.rows.indexOf(sym.s) >= 0, fav.rows.slice(0, 8));
        await page.evaluate((s) => window.mpWatch.remove(s), sym.s); await sleep(200); // star it off again through the store (the rows moved when the tab switched, so a second click lands elsewhere), so the picker is as it was
      }
      // Browse carries the list
      await page.keyboard.press('Escape'); await sleep(200);
      await page.evaluate(() => window.mpNavOpen && window.mpNavOpen()); await waitFor(page, () => { const b = document.getElementById('mpnavWatch'); return !!b && !b.hidden && b.querySelectorAll('a').length > 0; }, 10000); await sleep(700); // the drawer's rows stagger in through WAAPI - measure where they REST
      const br = await page.evaluate(() => { const a = document.querySelector('#mpnavWatch a'); const r = a.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { n: document.querySelectorAll('#mpnavWatch a').length, href: a.getAttribute('href'), reach: !!(e && (e === a || a.contains(e))), inView: r.top >= 0 && r.bottom <= innerHeight }; });
      chk('the Browse drawer lists the watchlist as chips to the terminal', br.n === 3 && /^\/paper-trade\?coin=[A-Z0-9]+$/.test(br.href), br);
      chk('and the first chip is reachable where it is drawn', br.reach && br.inView, br);
      chk('no page errors on the guest walk', errs.length === 0, errs);
      await ctx.close();
    }
    /* ---- B. the account (production only: needs the deploy that allow-listed `watch`) ---- */
    if (PROD) {
      const uid = 'e2ewl' + Math.random().toString(36).slice(2, 6);
      const se = await post('/api/admin/e2euser', { uid, op: 'sess' }); const tok = se.body.token || '';
      chk('throwaway member + session', !!tok, { status: se.status });
      if (tok) {
        const cookies = [{ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true }, { name: 'mp_uid', value: uid, domain: 'marginpad.io', path: '/', secure: true }, { name: 'mp_un', value: 'e2e_' + uid, domain: 'marginpad.io', path: '/', secure: true }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/', secure: true }];
        const A = await browser.createBrowserContext(); const pa = await A.newPage(); await prep(pa, 1366); await pa.setCookie(...cookies);
        let posts = 0; pa.on('request', r => { if (r.url().indexOf('/api/push/device') >= 0 && r.method() === 'POST') posts++; });
        await pa.goto(ORIGIN + '/paper-trade', { waitUntil: 'domcontentloaded', timeout: 90000 }); await waitFor(pa, () => !!window.mpWatch, 30000); await sleep(2500);
        await pa.evaluate(() => window.mpWatch.toggle('SOL')); await sleep(1800);
        const srv = await fetch(ORIGIN + '/api/push/device', { headers: { cookie: 'mp_sess=' + tok } }).then(r => r.json()).catch(() => null);
        const s = srv && srv.prefs && srv.prefs.watch && srv.prefs.watch.v && srv.prefs.watch.v.s;
        chk('a member\'s star reaches the account (uprefs dev:watch)', Array.isArray(s) && s.indexOf('SOL') >= 0 && posts >= 1, { s, posts });
        const B = await browser.createBrowserContext(); const pb = await B.newPage(); await prep(pb, 390); await pb.setCookie(...cookies);
        await pb.goto(ORIGIN + '/paper-trade', { waitUntil: 'domcontentloaded', timeout: 90000 }); await waitFor(pb, () => !!window.mpWatch && window.mpWatch.list().indexOf('SOL') >= 0, 20000).then(() => chk('a fresh device with the same session has it within seconds', true)).catch(async () => chk('a fresh device with the same session has it within seconds', false, await pb.evaluate(() => window.mpWatch && window.mpWatch.list())));
        await A.close(); await B.close();
        // a guest never writes
        const G = await browser.createBrowserContext(); const pg = await G.newPage(); await prep(pg, 1366); let gposts = 0; pg.on('request', r => { if (r.url().indexOf('/api/push/device') >= 0) gposts++; });
        await pg.goto(ORIGIN + '/paper-trade', { waitUntil: 'domcontentloaded', timeout: 90000 }); await waitFor(pg, () => !!window.mpWatch, 30000); await pg.evaluate(() => window.mpWatch.toggle('XRP')); await sleep(1500);
        chk('a guest\'s star stays on the device: no /api/push/device call at all', gposts === 0, { gposts }); await G.close();
      }
      try { await post('/api/admin/e2euser', { uid, op: 'rm' }); } catch (e) {}
    }
  }, { timeoutMs: 300000 });
  console.log('\nwatchlist-e2e: ' + okN + ' passed, ' + failN + ' failed' + (LOCAL ? ' [local]' : '') + (PROD ? ' [+prod legs]' : ''));
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
