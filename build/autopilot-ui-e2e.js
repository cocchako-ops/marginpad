// Autopilot dashboard, end to end on production with a throwaway member in SHADOW mode (2026-11-18):
// grant from the desk -> the page opens for the member and stays a 404 for a stranger -> a shadow test signal opens a
// virtual BTC long -> the open-position card, the signal row and the execution log show it -> settings save -> Close all
// flattens it -> cleanup (forget + account removed). Screenshots in build/ap-shots/.
const fs = require('fs'), path = require('path');
const { withBrowser, newPage } = require('./e2e-browser');
const BASE = 'https://marginpad.io';
const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_]+/)[0];
let pass = 0, fail = 0; const ok = (n, c, d) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (d === undefined ? '' : '  -> ' + JSON.stringify(d).slice(0, 300))); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const adm = (p, b) => fetch(BASE + p, { method: b ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());
const SHOTS = path.join(__dirname, 'ap-shots'); fs.mkdirSync(SHOTS, { recursive: true });
(async () => {
  const U = 'e2eap' + Math.random().toString(36).slice(2, 7); let tok = null;
  try {
    await adm('/api/admin/e2euser', { uid: U, op: 'mk' });
    tok = (await adm('/api/admin/e2euser', { uid: U, op: 'sess' })).token;
    const as = (p, o) => fetch(BASE + p, Object.assign({ headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + tok, origin: BASE } }, o || {}));
    let r = await as('/api/ap/state'); ok('before the grant the API answers 404 to the member', r.status === 404, r.status);
    r = await as('/autopilot/'); ok('before the grant the page is a 404 to the member', r.status === 404, r.status);
    const g = await adm('/api/admin/autopilot', { op: 'grant', uid: U, username: 'e2e_' + U }); ok('the desk grants access', g.ok, g);
    r = await as('/autopilot/'); const html = await r.text();
    ok('after the grant the page opens', r.status === 200 && /MarginPad <em>Autopilot/.test(html), r.status);
    ok('the page is noindex and not frameable', /noindex/.test(r.headers.get('x-robots-tag') || '') && r.headers.get('x-frame-options') === 'DENY');
    let st = await as('/api/ap/state').then(x => x.json());
    ok('a new account starts in shadow mode at 2% risk', st.cfg && st.cfg.mode === 'shadow' && st.cfg.risk === 2, st.cfg);
    const cross = await fetch(BASE + '/api/ap/cfg', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + tok, origin: 'https://evil.example' }, body: '{"patch":{"risk":3}}' });
    ok('a request from another site is refused', cross.status === 403, cross.status);
    const la = await as('/api/ap/mode', { method: 'POST', body: JSON.stringify({ mode: 'live', code: '123456' }) }).then(x => x.json());
    ok('Live without ticking the risk statement is refused', la.error === 'ack_required', la);
    const lv = await as('/api/ap/mode', { method: 'POST', body: JSON.stringify({ mode: 'live', code: '123456', ack: true }) }).then(x => x.json());
    ok('Live without a valid email code is refused', lv.error === 'code_expired' || lv.error === 'code_wrong', lv);
    const tl = await as('/api/ap/tg').then(x => x.json());
    ok('Connect Telegram hands out a one-time bot link', /^https:\/\/t\.me\/MarginPadBot\?start=ap[0-9a-f]{16}$/.test(tl.url || ''), tl);
    const tt = await as('/api/ap/tg', { method: 'POST', body: JSON.stringify({ op: 'test' }) }).then(x => x.json());
    ok('a test message with no chat linked reports not delivered', tt.ok === false, tt);
    const ec = await adm('/api/admin/autopilot', { op: 'cfg', uid: U, patch: { dayLoss: 5 } });
    st = await as('/api/ap/state').then(x => x.json());
    ok('the owner changes a member setting from mp-ops', ec.ok && st.cfg.dayLoss === 5, { ec, d: st.cfg && st.cfg.dayLoss });
    ok('the change is written to the member log as made by MarginPad', (st.log || []).some(l => /by MarginPad/.test(l.msg)));
    const t = await adm('/api/admin/autopilot', { op: 'shadowtest', uid: U, sym: 'BTC', long: true });
    ok('a shadow test signal opens a virtual BTC long', t.taken === true, t);
    const dup = await adm('/api/admin/autopilot', { op: 'shadowtest', uid: U, sym: 'BTC', long: true });
    ok('a second signal on the same coin is skipped (one trade per coin)', dup.taken === false && /already_in/.test(dup.why || ''), dup);
    st = await as('/api/ap/state').then(x => x.json());
    const open = (st.trades || []).filter(x => x.status === 'open');
    ok('the store holds one open trade with a stop below and targets above', open.length === 1 && open[0].sl < open[0].entry && open[0].tp1 > open[0].entry && open[0].tp2 > open[0].tp1, open[0]);
    ok('the execution log recorded the entry, the stop and both targets', ['entry MARKET', 'STOP_MARKET', 'TAKE_PROFIT_MARKET'].every(k => (st.log || []).some(l => l.msg.indexOf(k) >= 0)), (st.log || []).map(l => l.msg).slice(0, 8));
    await withBrowser(async (browser) => {
      for (const mobile of [false, true]) {
        const page = await newPage(browser, { mobile });
        if (mobile) await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await page.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' });
        const errs = []; page.on('pageerror', e => errs.push(String(e)));
        await page.goto(BASE + '/autopilot/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => document.querySelectorAll('.al').length === 6 && document.querySelector('.fp'), { timeout: 30000 }).catch(() => {});
        await sleep(1500);
        const m = await page.evaluate(() => {
          const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
          const fp = document.querySelector('.fp'), mk = document.querySelector('.mk');
          return { ann: document.querySelectorAll('.al').length, onLights: document.querySelectorAll('.al.on').length, fp: r(fp), eq: document.getElementById('eqBig').textContent, sw: document.documentElement.scrollWidth, vw: innerWidth, mk: r(mk), text: fp ? fp.innerText.slice(0, 120) : '' };
        });
        const tag = mobile ? 'phone' : 'desktop';
        ok(tag + ': six status lights drawn', m.ann === 6, m);
        ok(tag + ': the open BTC position is drawn with its live mark', m.fp && m.mk && /BTC/.test(m.text), m);
        ok(tag + ': the account figure is shown', /\$[0-9]/.test(m.eq), m.eq);
        ok(tag + ': nothing wider than the screen', m.sw <= m.vw + 1, { sw: m.sw, vw: m.vw });
        ok(tag + ': no page errors', !errs.length, errs);
        await page.screenshot({ path: path.join(SHOTS, tag + '-open.png'), fullPage: !mobile });
        for (const p of ['sigs', 'log', 'set', 'key']) { await page.click('.tab[data-p="' + p + '"]'); await sleep(350); await page.screenshot({ path: path.join(SHOTS, tag + '-' + p + '.png'), fullPage: !mobile }); }
        if (!mobile) {
          const sv = await page.evaluate(async () => { const r = document.querySelector('#p-set input[data-k="risk"]'); r.value = '1.5'; r.dispatchEvent(new Event('input')); document.getElementById('saveCfg').click(); await new Promise(s => setTimeout(s, 1500)); return document.getElementById('cfgMsg').textContent; });
          ok('settings: a risk change saves', /Saved/.test(sv), sv);
        }
        await page.close();
      }
    });
    st = await as('/api/ap/state').then(x => x.json());
    ok('the saved risk is what the store holds', st.cfg.risk === 1.5, st.cfg.risk);
    const ca = await as('/api/ap/closeall', { method: 'POST', body: '{}' }).then(x => x.json());
    st = await as('/api/ap/state').then(x => x.json());
    const tr = (st.trades || [])[0] || {};
    ok('Close all flattens the shadow position and books its result', ca.ok && ca.closed === 1 && tr.status === 'closed' && isFinite(tr.pnl), { ca, tr: { s: tr.status, pnl: tr.pnl, r: tr.result } });
  } catch (e) { ok('no crash', false, String(e && e.stack || e)); }
  finally {
    try { const f = await adm('/api/admin/autopilot', { op: 'forget', uid: U }); ok('cleanup: the member leaves the list', f.ok, f); } catch (e) {}
    try { await adm('/api/admin/e2euser', { uid: U, op: 'rm' }); } catch (e) {}
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exitCode = fail ? 1 : 0;
})();
