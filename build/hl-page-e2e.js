// /hyperliquid/ on both viewports: every view renders real rows, nothing is wider than the screen, no page errors.
// Shots go to build/hl-shots/. `node build/hl-page-e2e.js [base]`
const fs = require('fs'), path = require('path');
const { withBrowser, newPage } = require('./e2e-browser.js');
const BASE = process.argv[2] || 'https://marginpad.io';
const OUT = path.join(__dirname, 'hl-shots'); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m, x === undefined ? '' : JSON.stringify(x)); } };
const VP = [['desk', 1366, 800], ['phone', 390, 844]];
(async () => {
  await withBrowser(async (b) => {
    for (const [tag, w, h] of VP) {
      console.log(tag);
      const p = await newPage(b); const errs = [];
      await p.setViewport({ width: w, height: h });
      await p.setCacheEnabled(false);
      p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
      await p.goto(BASE + '/hyperliquid-whales/?nc=1&cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 });
      const wait = (fn, ms) => p.waitForFunction(fn, { timeout: ms || 12000 }).then(() => true).catch(() => false);
      const size = () => p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
      const shot = (n) => p.screenshot({ path: path.join(OUT, tag + '-' + n + '.png') });

      ok(await wait(() => document.querySelectorAll('.cc').length >= 11), 'cohorts: eleven cards');
      const c = await p.evaluate(() => ({ n: document.querySelectorAll('.cc').length, money: [...document.querySelectorAll('.cc .L')].filter((e) => /\$[1-9]/.test(e.textContent)).length, cov: (document.querySelector('.cov') || {}).textContent }));
      ok(c.money >= 6, 'cohorts carry real money', c);
      let s = await size(); ok(s.sw <= s.iw, 'cohorts fit the screen', s); await shot('cohorts');

      await p.evaluate(() => { location.hash = '#cohort/elite'; });
      ok(await wait(() => document.querySelectorAll('a.tr').length >= 3), 'cohort detail lists wallets');
      s = await size(); ok(s.sw <= s.iw, 'cohort detail fits', s); await shot('cohort');
      await p.evaluate(() => { const b = document.querySelector('[data-ct="markets"]'); if (b) b.click(); });
      ok(await wait(() => document.querySelector('.sbar') !== null), 'cohort markets tab');

      await p.evaluate(() => { location.hash = '#markets'; });
      ok(await wait(() => document.querySelectorAll('a.tr[href*="#market/"]').length >= 10), 'markets list'); await shot('markets');

      await p.evaluate(() => { location.hash = '#market/BTC'; });
      ok(await wait(() => document.querySelectorAll('.sbar').length >= 3 && document.querySelectorAll('a.tr[href*="#wallet/"]').length >= 3), 'BTC: groups and top positions');
      s = await size(); ok(s.sw <= s.iw, 'market fits', s); await shot('market');
      await p.evaluate(() => { location.hash = '#leaderboard'; });
      ok(await wait(() => document.querySelectorAll('a.tr[href*="#wallet/"]').length >= 20), 'leaderboard'); await shot('leaderboard');
      await p.evaluate(() => { location.hash = '#traders'; });
      ok(await wait(() => document.querySelectorAll('a.tr[href*="#wallet/"]').length >= 20), 'top positions'); await shot('traders');
      await p.evaluate(() => { location.hash = '#market/BTC'; });
      await wait(() => document.querySelectorAll('.sbar').length >= 3 && document.querySelectorAll('a.tr[href*="#wallet/"]').length >= 3);
      const addr = await p.evaluate(() => { const a = document.querySelector('a.tr[href*="#wallet/"]'); return a && a.getAttribute('href'); });

      await p.evaluate(() => { location.hash = '#changes'; });
      ok(await wait(() => document.querySelectorAll('.chip').length >= 6), 'changes view renders');
      s = await size(); ok(s.sw <= s.iw, 'changes fits', s); await shot('changes');

      await p.evaluate((a) => { location.hash = a; }, addr);
      ok(await wait(() => document.querySelectorAll('.tile').length >= 4), 'wallet page');
      ok(await wait(() => !!document.querySelector('#pc svg') && !!document.querySelector('#wb')), 'wallet: PnL curve from the chain and the alert bell');
      s = await size(); ok(s.sw <= s.iw, 'wallet fits', s); await shot('wallet');

      const cut = await p.evaluate(() => [...document.querySelectorAll('.tr .num, .tile b')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent).slice(0, 5));
      ok(!cut.length, 'no figure cut off', cut);
      ok(!errs.length, 'no page errors', errs);
      await p.close();
    }
  });
  console.log('hl-page-e2e: pass', pass, 'fail', fail);
  process.exitCode = fail ? 1 : 0;
})();
