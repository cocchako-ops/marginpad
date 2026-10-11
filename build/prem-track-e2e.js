/* THE INSTRUMENT ON THE PAGE THAT IS SUPPOSED TO MAKE MONEY (2026-10-11, owner: "mozemo da poboljsamo merenje,
 * logove i da mi izlaze tamo da vidim sta je ko kliknuo na toj stranici, kao i da ih cuvamo negde za analizu").
 *
 * Measured before: /premium/ sent ONE beacon, for the indicators sheet, and it recorded nothing - it used
 * `?t=event&type=indsheet&l=open` while the worker reads the type from `t` and the label from `e`. Fifty call
 * sites across the site had the same shape, the homepage section beacons among them, so months of "which band do
 * people reach" was the literal type "event" with an empty label.
 *
 * The load-bearing checks are the ones that read the QUERY STRING the browser actually sends: a beacon whose type
 * and label the worker cannot see is exactly the bug this file exists to stop coming back.
 *
 * Run: node build/prem-track-e2e.js
 */
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser.js');
const ORIGIN = process.argv.includes('--local') ? 'http://127.0.0.1:8788' : 'https://marginpad.io';

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? '  ' + JSON.stringify(d).slice(0, 260) : '')); } };

// the one rule every beacon on the site has to obey, written once
const parse = (u) => { try { const q = new URL(u, ORIGIN).searchParams; return { t: q.get('t'), e: q.get('e'), p: q.get('p'), legacy: q.get('type') || q.get('l') }; } catch (x) { return {}; } };

(async () => {
  console.log('PREMIUM PAGE TRACKING - ' + ORIGIN);

  // ---- the shape, across every file that ships one ------------------------------------------------------------
  {
    const bad = [];
    const walk = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p2 = path.join(dir, f.name);
      if (/node_modules|[\\/](sdk|vault-shots|ops-shots)[\\/]/.test(p2)) continue;
      if (f.isDirectory()) walk(p2);
      else if (/\.(html|js)$/.test(f.name) && !/fix-(track-beacons|premium-track)\.js$/.test(f.name)) {
        const s = fs.readFileSync(p2, 'utf8');
        if (s.indexOf('t=event&type=') >= 0) bad.push(path.relative(path.join(__dirname, '..'), p2));
      } } };
    walk(path.join(__dirname, '..', 'dist'));
    walk(path.join(__dirname, '..', 'app'));
    ok(bad.length === 0, '[LB] no file still sends the shape the worker cannot read (t=event&type=...&l=...)', bad.slice(0, 6));
  }

  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    const sent = [];
    await page.setViewport({ width: 1366, height: 820, deviceScaleFactor: 1 });
    await page.setBypassServiceWorker(true);
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message)));
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const u = r.url();
      if (u.indexOf('/api/track') >= 0) { sent.push(parse(u)); return r.respond({ status: 204, body: '' }); }
      return r.continue();
    });
    await page.goto(ORIGIN + '/premium/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 1500));

    // ---- scroll depth ------------------------------------------------------------------------------------------
    await page.evaluate(async () => {
      const step = Math.round(innerHeight * 0.8);
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 170)); }
    });
    await new Promise((r) => setTimeout(r, 1200));
    const sect = sent.filter((x) => x.t === 'sect');
    ok(sect.length >= 4, '[LB] scrolling the page sends a section beacon per block (' + sect.length + ')', sect.map((x) => x.e).slice(0, 8));
    ok(sect.every((x) => x.e && x.e.length > 1), 'and every one of them carries the block it is about', sect.map((x) => x.e).slice(0, 8));
    ok(sect.every((x) => x.p === '/premium/'), 'and says which page it was on', sect.map((x) => x.p).slice(0, 3));
    const dup = sect.map((x) => x.e).filter((v, i, a) => a.indexOf(v) !== i);
    ok(dup.length === 0, 'once per block per pageview, never twice', dup);

    // ---- the press, as a GUEST ----------------------------------------------------------------------------------
    sent.length = 0;
    await page.evaluate(() => { const b = [...document.querySelectorAll('[data-buy="monthly"]')].find((x) => x.offsetParent); b && b.click(); });
    await new Promise((r) => setTimeout(r, 1200));
    const buys = sent.filter((x) => x.t === 'premview' && /^buy:/.test(x.e || ''));
    ok(buys.length === 1, '[LB] pressing a price sends exactly one beacon', sent);
    ok(buys[0] && /guest/.test(buys[0].e), '[LB] and it records that this one was NOT signed in - the moment most readers leave', buys[0]);
    ok(buys[0] && /monthly/.test(buys[0].e), 'and which plan was pressed', buys[0]);
    const si = sent.filter((x) => x.t === 'signin');
    ok(si.length >= 1, 'the sign-in sheet it raises is recorded too', si);

    // ---- and the sheet it raises says the right thing (owner: "5. realno to treba da se resi") -------------------
    const sheet = await page.evaluate(() => {
      const m = [...document.querySelectorAll('.mpa-modal, [role=dialog], #mpaModal')].filter((e) => e.offsetParent !== null);
      const t = (m[0] && m[0].innerText) || document.body.innerText;
      return { sub: (document.querySelector('.mpa-sub') || {}).textContent || '', foot: (document.querySelector('.mpa-foot') || {}).textContent || '', open: m.length > 0 };
    });
    ok(/checkout|pago|paiement|Zahlung|оплат|odeme|支付|お支払|결제|الدفع|pembayaran|betaling|plaćanj/i.test(sheet.sub),
      '[LB] the sign-in sheet raised by a PRICE says what happens next', sheet);
    ok(!/Optional - MarginPad works without an account/.test(sheet.foot),
      '[LB] and no longer tells them an account is optional at the moment they chose to pay', sheet);

    // ---- the other two -------------------------------------------------------------------------------------------
    sent.length = 0;
    await page.evaluate(() => { const b = document.getElementById('aiMore'); b && b.click(); });
    await new Promise((r) => setTimeout(r, 700));
    ok(sent.some((x) => x.t === 'premview' && /reads/.test(x.e || '')), 'opening the other AI reads is recorded', sent);

    sent.length = 0;
    await page.evaluate(() => { const c = document.querySelector('[data-ind-sheet]'); c && c.click(); });
    await new Promise((r) => setTimeout(r, 700));
    ok(sent.some((x) => x.t === 'premview' && /indsheet/.test(x.e || '')), 'and so is the indicators sheet - on a type that reaches the activity ring', sent);

    ok(sent.every((x) => !x.legacy) && buys.every((x) => !x.legacy), 'no beacon still carries the dead `type` or `l` parameters');
    ok(errs.length === 0, 'no page errors', errs.slice(0, 2));
    await ctx.close();
  }, { timeoutMs: 300000 });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();
