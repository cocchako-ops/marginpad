/* srvopen-e2e (2026-09-29): A SIGNED-IN MEMBER'S TRADE MUST REACH THE SERVER EVEN BEFORE mp-auth.js HAS PARSED.
   MEASURED on the season's 20 ranked accounts: 215 of 1,774 journal rows (12.1%) were opened by the browser alone and can
   therefore never rank; 80 of them carry no cid, i.e. mpSrvOpen was never called, because add() and mpSrvOpen both gated on
   window.mpAuth.me() while the server authenticates from the session COOKIE. The gate reads the mp_li cookie now.
   The browser leg deletes window.mpAuth before clicking Open - exactly the state a fast click on a slow connection is in -
   and requires the position that comes back to be a SERVER row (id starts with srv), not a local one.
   Needs ADMIN_KEY.local.txt. Creates a throwaway member and removes it.            node build/srvopen-e2e.js [--local]   */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser.js');
const KEY = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io';
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
const LOCAL = process.argv.indexOf('--local') >= 0;
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 220) : '')); };
const J = (u, o) => fetch(B + u, o).then(r => r.json());
const UID = 'e2e-srvopen1';
(async () => {
  // the shipped bundle must ask the cookie, not mpAuth
  const js = LOCAL ? fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'home.js'), 'utf8')
    : await fetch(B + '/assets/home.js').then(r => r.text());
  ok(/window\.mpSignedInCookie=function/.test(js), 'home.js publishes mpSignedInCookie');
  ok(/if\(\(!me&&!window\.mpSignedInCookie\(\)\)\|\|!window\.fetch\)\{fail\(\);return;\}/.test(js), 'mpSrvOpen bails only when BOTH mpAuth and the cookie say signed out');
  ok(/if\(!_me&&window\.mpSignedInCookie&&window\.mpSignedInCookie\(\)\)_me=1;/.test(js), 'the terminal tries the server when the cookie says there is a session');
  // 2026-10-03: the local-only fallback is GONE. A signed-in open that the server refuses opens NOTHING and says so,
  // because pullTrades re-adds a timeout that actually filled. The bundle must NOT finish a local trade in the fail path.
  ok(/openDidNotGoThrough/.test(js), 'a refused server open tells the trader nothing was opened (no phantom)');
  ok(!/openedOnThisDevice/.test(js), 'the old local-fallback toast is gone from the open path (no phantom that cannot rank)');

  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'rm' }) }).catch(() => {});
  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'mk' }) });
  const se = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'sess' }) });
  const tok = se.token || se.sess;
  ok(!!tok, 'throwaway member with a session');

  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setCacheEnabled(false); await page.setBypassServiceWorker(true);
    await page.setViewport({ width: 1366, height: 900 });
    for (const c of [{ name: 'mp_sess', value: tok, httpOnly: true }, { name: 'mp_li', value: '1' }])
      await page.setCookie({ name: c.name, value: c.value, domain: 'marginpad.io', path: '/', secure: true, httpOnly: !!c.httpOnly });
    if (LOCAL) {
      await page.setRequestInterception(true);
      page.on('request', r => { const u = r.url(); if (/\/assets\/home\.js/.test(u)) r.respond({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'home.js'), 'utf8') }); else r.continue(); });
    }
    await page.goto(B + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction("!!document.getElementById('planSave')", { timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));
    // THE STATE UNDER TEST: signed in by cookie, mpAuth not available (a click before the deferred bundle is ready)
    const before = await page.evaluate(() => { try { window.__mpAuthSaved = window.mpAuth; delete window.mpAuth; } catch (e) { window.mpAuth = undefined; } return { auth: !!window.mpAuth, cookie: !!(window.mpSignedInCookie && window.mpSignedInCookie()) }; });
    ok(before.auth === false && before.cookie === true, 'browser state: mpAuth gone, the cookie still says signed in', before);
    const opened = await page.evaluate(async () => {
      const set = (id, v) => { const e = document.getElementById(id); if (!e) return false; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; };
      set('planMargin', '25'); set('planLev', '5');
      const b = document.getElementById('planSave'); if (!b) return { err: 'no button' };
      b.click();
      for (let i = 0; i < 90; i++) { await new Promise(r => setTimeout(r, 200));
        let j = []; try { j = JSON.parse(localStorage.getItem('mp_journal') || localStorage.getItem('mp_trades') || '[]'); } catch (e) {}
        const open = j.filter(x => x.status === 'open');
        if (open.length) return { id: open[0].id, src: open[0].src || '', cid: open[0].cid || '', sym: open[0].sym };
      }
      return { err: 'nothing opened' };
    });
    ok(!opened.err, 'a position opened from the terminal', opened);
    ok(/^srv/.test(String(opened.id || '')), 'and it is a SERVER position, not a local one (id ' + opened.id + ')', opened);
    // FALSIFICATION: take the cookie reader away and the old behaviour comes back - a local row the boards can never see.
    const old = await page.evaluate(async () => {
      window.mpSignedInCookie = function () { return false; };
      try { window.mpAuth = null; } catch (e) {} // truly signed-out: no cookie AND no mpAuth -> the guest local path (kept on purpose)
      const set = (id, v) => { const e = document.getElementById(id); if (!e) return; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
      set('planMargin', '26'); set('planLev', '5');
      const seen = () => { try { return JSON.parse(localStorage.getItem('mp_journal') || localStorage.getItem('mp_trades') || '[]').filter(x => x.status === 'open').length; } catch (e) { return 0; } };
      const n0 = seen();
      const b = document.getElementById('planSave'); if (b) b.click();
      for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 200)); if (seen() > n0) break; }
      let j = []; try { j = JSON.parse(localStorage.getItem('mp_journal') || localStorage.getItem('mp_trades') || '[]'); } catch (e) {}
      const o = j.filter(x => x.status === 'open');
      return { n: o.length, ids: o.map(x => x.id), local: o.filter(x => !/^srv/.test(String(x.id || ''))).map(x => x.id) };
    });
    ok(old.local.length === 1, 'falsified: signed out (no cookie, no mpAuth) the same click opens a LOCAL guest row (' + old.local.join() + ')', old);
    await ctx.close();
  });
  // the server's own record is the proof
  const jr = await J('/api/admin/journal?uid=' + UID, { headers: H });
  const rows = (jr && jr.journal) || [];
  ok(rows.length >= 1 && rows.every(r => r.src === 'srv'), 'the server journal holds the trade, marked srv', rows.map(r => r.sym + ':' + (r.src || 'client')));
  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'rm' }) });
  console.log(out.join('\n')); console.log('\nsrvopen-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
