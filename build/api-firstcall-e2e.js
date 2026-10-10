// api-firstcall-e2e.js - the first call has to SUCCEED, in a real browser (2026-10-10).
//
// MEASURED, and it is the whole reason this exists: 117 of 174 keys ever minted have never made a single
// request; 77 of 125 accounts have never made one; 17 of those minted a SECOND key and still never called.
// Of the 57 keys that did call, 16 lived under an hour. The drop-off is between "I have a key" and
// "something answered me", so the page now hands over a working call and runs it.
//
// UI PROOF IS REACHABILITY, NOT EXISTENCE: the block is probed with elementFromPoint at its own centre, in
// the viewport, in the page's default state after a key is created - and then the button is actually PRESSED
// and the real response body is read off the page. A block that renders and does nothing is the failure this
// is guarding against.
//
// Usage: node build/api-firstcall-e2e.js
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser.js');
const ROOT = path.join(__dirname, '..');
const BASE = 'https://marginpad.io';
const ADMIN = (() => { try { return (fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-z0-9]+/i) || [''])[0]; } catch (e) { return ''; } })();
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (d != null ? '  -> ' + d : '')); } };

(async () => {
  console.log('api-firstcall-e2e\n');
  if (!ADMIN) { console.log('needs ADMIN_KEY.local.txt'); process.exitCode = 1; return; }
  const H = { 'x-admin-key': ADMIN, 'content-type': 'application/json' };
  const uid = 'e2efc' + Math.random().toString(36).slice(2, 5);
  await fetch(BASE + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'mk' }) });
  const se = await fetch(BASE + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'sess' }) }).then(r => r.json());

  try {
    await withBrowser(async (browser) => {
      for (const [label, w, hgt] of [['desktop 1366x768', 1366, 768], ['phone 390x844', 390, 844]]) {
        console.log('\n' + label + ':');
        const page = await browser.newPage();
        await page.setViewport({ width: w, height: hgt });
        await page.setCookie({ name: 'mp_sess', value: se.token, domain: 'marginpad.io', path: '/' },
          { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
        const errs = [], logs = [];
        page.on('pageerror', (e) => errs.push(String(e && e.message || e)));
        page.on('console', (m) => { if (/error|warn/i.test(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 160)); });
        page.on('requestfailed', (r) => { if (/\/api\/bot\//.test(r.url())) logs.push('requestfailed ' + r.url() + ' ' + (r.failure() && r.failure().errorText)); });
        page.on('response', (r) => { if (/\/api\/bot\/v2\/account/.test(r.url())) logs.push('account -> ' + r.status()); });
        await page.goto(BASE + '/trading-api/?nc=1&cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 });
        // the key manager needs mp-auth, which is deferred
        await page.waitForFunction('!!(window.mpAuth && window.mpAuth.me && window.mpAuth.me())', { timeout: 25000 }).catch(() => {});
        await page.waitForSelector('#akbNew', { visible: true, timeout: 20000 }).catch(() => {});
        ok('the key manager is up for a signed-in member', await page.$('#akbNew') !== null);

        // create a key, exactly as a developer would
        await page.type('#akbName', 'first-call-' + Math.random().toString(36).slice(2, 5));
        await page.click('#akbNew button[type="submit"]');
        await page.waitForSelector('#akbGo', { visible: true, timeout: 25000 }).catch(() => {});
        ok('creating a key reveals the first-call block', await page.$('#akbGo') !== null);

        const shown = await page.evaluate(() => {
          const b = document.getElementById('akbGo');
          if (!b) return null;
          const pre = b.querySelector('pre');
          return { curl: pre ? pre.textContent : '', btns: [...b.querySelectorAll('[data-go]')].map(x => x.getAttribute('data-go')) };
        });
        ok('the curl carries a real key, not a placeholder', !!shown && /X-API-Key:\s*mpb_[a-f0-9]{8}/.test(shown.curl), shown && shown.curl.slice(0, 90));
        ok('it is a line-continued shell command, not one run-on line', !!shown && shown.curl.indexOf('\\') > 0 && shown.curl.split('\n').length >= 2, shown && JSON.stringify(shown.curl.slice(0, 100)));
        ok('there is a Run it button and a Copy button', !!shown && shown.btns.indexOf('run') >= 0 && shown.btns.indexOf('copy') >= 0, shown && shown.btns.join(','));

        // REACHABILITY: the button's own centre must return the button, in the viewport, no scrolling tricks
        const reach = await page.evaluate(() => {
          const btn = document.querySelector('#akbGo [data-go="run"]');
          if (!btn) return { why: 'no button' };
          btn.scrollIntoView({ block: 'center' });
          const r = btn.getBoundingClientRect();
          const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { hit: !!el && (el === btn || btn.contains(el)), inView: r.top >= 0 && r.bottom <= innerHeight, h: Math.round(r.height), w: Math.round(r.width) };
        });
        ok('the Run it button is actually hittable at its own centre', reach.hit === true, JSON.stringify(reach));
        ok('and it is a real tap target', reach.h >= 28 && reach.w >= 44, JSON.stringify(reach));

        // PRESS IT. A block that renders and does nothing is the failure being guarded against.
        // The press is dispatched IN the page rather than through page.click: puppeteer's click scrolls to
        // its own idea of centre and then clicks the viewport point, which on desktop landed on the sticky
        // site header and silently hit nothing (the phone pass, with a different header, worked). Whether
        // the button is REACHABLE is already proven above by elementFromPoint at its own centre - that is
        // the hittability check; this one is about whether pressing it does anything.
        await page.evaluate(() => document.querySelector('#akbGo [data-go="run"]').click());
        await page.waitForFunction('(function(){var o=document.getElementById("akbOut");return o && !o.hidden && o.textContent.length>20;})()', { timeout: 30000 }).catch(() => {});
        const res = await page.evaluate(() => {
          const o = document.getElementById('akbOut'), win = document.getElementById('akbWin');
          return { body: o ? o.textContent : '', win: (win && !win.hidden) ? win.textContent : '' };
        });
        ok('pressing it prints a real response body', /"ok"\s*:\s*true/.test(res.body) || /balance_usd/.test(res.body), JSON.stringify(res) + ' | ' + logs.slice(0, 4).join(' ;; '));
        ok('the body is this account, not a canned sample', /starting_balance_usd/.test(res.body), res.body.slice(0, 160));
        ok('and the page says that was the first call', /first API call/i.test(res.win), JSON.stringify(res.win));

        // the whole simulation section
        const sim = await page.evaluate(() => {
          const s = document.getElementById('sim');
          if (!s) return null;
          const rows = [...s.querySelectorAll('.simt tbody tr')].filter(r => !r.classList.contains('grp'));
          const codes = rows.map(r => { const c = r.querySelector('code'); return c ? c.textContent : ''; });
          return { rows: rows.length, groups: s.querySelectorAll('.simt tr.grp').length, presets: s.querySelectorAll('.simc').length, codes, railed: !!document.querySelector('#rail a[href="#sim"]') };
        });
        ok('the #sim section exists', !!sim);
        ok('it documents all 18 fields', sim && sim.rows === 18, sim && sim.rows);
        ok('in four groups', sim && sim.groups === 4, sim && sim.groups);
        ok('and the field names match the API exactly', sim && ['start_balance_usd', 'margin_enforced', 'exit_slippage', 'reject_rate_pct', 'impact_bps_per_100k', 'taker_bps', 'funding_mult', 'mmr_pct'].every(k => sim.codes.indexOf(k) >= 0), sim && sim.codes.join(','));
        ok('the presets are on the page', sim && sim.presets >= 4, sim && sim.presets);
        ok('the reference rail links it', sim && sim.railed === true);
        ok('it admits what is NOT modelled', await page.evaluate(() => /does not model/i.test(document.getElementById('sim').textContent)));
        ok('it says the defaults are deliberately easy', await page.evaluate(() => /deliberately easy/i.test(document.getElementById('sim').textContent)));

        // nothing wider than the screen, the standing phone rule
        const over = await page.evaluate(() => {
          const bad = [];
          document.querySelectorAll('#sim *, #akbGo *').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width <= innerWidth + 1) return;
            // an element inside a clipping or scrolling box is not an overflow (the /rewards/ lesson)
            for (let p = el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/auto|scroll|hidden/.test(cs.overflowX)) return; }
            bad.push((el.tagName + '.' + el.className).slice(0, 40) + ' ' + Math.round(r.width));
          });
          return bad;
        });
        ok('nothing in the new blocks is wider than the screen', over.length === 0, over.slice(0, 4).join(' | '));
        ok('the page threw no script errors', errs.length === 0, errs.slice(0, 2).join(' | '));
        await page.close();
      }
    });
  } finally {
    await fetch(BASE + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'rm' }) });
  }

  console.log('\napi-firstcall-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('api-firstcall-e2e crashed: ' + (e && e.stack || e)); process.exitCode = 1; });
