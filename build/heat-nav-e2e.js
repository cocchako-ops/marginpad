// A TOOL REACHED THROUGH BROWSE MUST REPLACE THE ONE YOU LEFT (2026-11-01, owner: the URL changed to /paper-trade and the heatmap stayed on screen).
// html.route-heat is set before first paint and applyRoute must clear it. node build/heat-nav-e2e.js [--local]
const R = require('path').join(__dirname, '..') + '/', fs = require('fs');
const { withBrowser, newPage } = require(R + 'build/e2e-browser.js');
const LOCAL = process.argv.includes('--local');
const FILES = { 'mp-heatmap.js': 'application/javascript', 'home.js': 'application/javascript', 'mp-nav.js': 'application/javascript' };
withBrowser(async b => {
  for (const [from, target] of [['/heatmap', '/paper-trade'], ['/heatmap', '/screener'], ['/heatmap', '/rekt/'], ['/heatmap', '/charts'], ['/paper-trade', '/heatmap'], ['/screener', '/paper-trade']]) {
    const p = await newPage(b); await p.setViewport({ width: 1440, height: 900 });
    const errs = []; p.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 300)));
    if (LOCAL) { await p.setCacheEnabled(false); await p.setRequestInterception(true); const c = await p.createCDPSession(); await c.send('Network.setBypassServiceWorker', { bypass: true }); p.on('request', r => { const m = r.url().match(/\/assets\/(mp-heatmap\.js|home\.js|mp-nav\.js)/); if (m) return r.respond({ status: 200, contentType: FILES[m[1]], body: fs.readFileSync(R + 'dist/assets/' + m[1]) }); r.continue(); }); }
    await p.evaluateOnNewDocument(() => { try { localStorage.setItem('mp_ck_ok', '1'); } catch (e) {} });
    await p.goto('https://marginpad.io' + from, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 7000));
    const ok = await p.evaluate(() => { const t = document.querySelector('[data-mpnav-open],.mpnav-burger,#mpnavBtn,.mpnav-trigger,[aria-label="Browse"]'); if (window.mpNavOpen) { window.mpNavOpen(); return 'open fn'; } if (t) { t.click(); return 'clicked'; } return 'none'; });
    await new Promise(r => setTimeout(r, 600));
    const clicked = await p.evaluate(t => { const a = [...document.querySelectorAll('#mpnavPanel a, .mpnav-panel a, .mpnav-row')].find(x => (x.getAttribute('href') || '').replace(/\/$/, '') === t.replace(/\/$/, '')); if (!a) return 'no row'; a.click(); return a.getAttribute('href'); }, target);
    await new Promise(r => setTimeout(r, 3500));
    const st = await p.evaluate(() => ({ url: location.pathname, prod: document.body.getAttribute('data-prod'), cls: document.body.className.slice(0, 80), heat: (() => { const s = document.getElementById('heatmap'); return s ? getComputedStyle(s).display : 'none'; })(), plan: (() => { const s = document.getElementById('plan'); return s ? getComputedStyle(s).display : 'none'; })(), title: document.title.slice(0, 40) }));
    const pass = target === '/heatmap' ? st.heat !== 'none' : st.heat === 'none'; console.log((pass ? '  ok   ' : '  FAIL ') + from + ' -> ' + target + (pass ? '' : ' ' + JSON.stringify(st))); if (!pass) process.exitCode = 1;
    await p.close();
  }
}, { timeoutMs: 110000 }).catch(e => { console.error(e); process.exit(1); });
