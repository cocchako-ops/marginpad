// lb-rail-e2e.js — the homepage leaderboard rails + the Gold Room (2026-09-05).
// The failure this guards against: both pickers were flex rows that made the CARD wider with every board added,
// until the strip ran off the right edge of a phone. Every check here is geometry, not existence.
//   node build/lb-rail-e2e.js
const { withBrowser, newPage } = require('./e2e-browser.js');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, 'pt-shots'); fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
let bad = 0; const ok = (n, c, d) => { console.log((c ? '  OK   ' : '  FAIL ') + n + (d ? ' — ' + d : '')); if (!c) bad++; };
const UA_MOBILE = require('./e2e-browser.js').UA_MOBILE;

(async () => {
  await withBrowser(async (b) => {
    for (const [w, h, tag] of [[360, 740, 'phone 360'], [390, 844, 'phone 390'], [1366, 900, 'desktop']]) {
      console.log('\n== ' + tag + ' ==');
      const ctx = await b.createBrowserContext(); const p = await ctx.newPage();
      if (w < 500) await p.setUserAgent(UA_MOBILE);
      await p.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: 2 });
      const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto('https://marginpad.io/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
      await wait(2600);
      await p.evaluate(() => { const b2 = document.getElementById('mpCkOk'); if (b2) b2.click(); });
      await wait(500);

      const g = await p.evaluate(() => {
        const q = s => document.querySelector(s);
        const rails = [...document.querySelectorAll('[data-rail]')].map(r => {
          const s = r.querySelector('.mprail-s'); const rb = r.getBoundingClientRect();
          const own = r.closest('.lb-card'); return { cls: r.className, w: Math.round(rb.width), clientW: s.clientWidth, scrollW: s.scrollWidth, scrolls: s.scrollWidth > s.clientWidth + 2, canR: r.classList.contains('can-r'), chips: s.children.length, cardW: own ? Math.round(own.getBoundingClientRect().width) : 0 };
        });
        const card = q('.lb-info') || q('.lb-card');
        const wrap = q('.lb-wrap');
        return { vw: innerWidth, rails, cardW: card ? Math.round(card.getBoundingClientRect().width) : 0, wrapW: wrap ? Math.round(wrap.getBoundingClientRect().width) : 0, docScrollW: document.documentElement.scrollWidth };
      });
      console.log('  ' + JSON.stringify(g));
      ok('two rails present', g.rails.length === 2, 'n=' + g.rails.length);
      ok('prize rail has 5 chips', (g.rails[0] || {}).chips === 5, JSON.stringify((g.rails[0] || {}).chips));
      ok('live rail has 6 chips (Gold Room + Following)', (g.rails[1] || {}).chips === 6, JSON.stringify((g.rails[1] || {}).chips));
      ok('card never exceeds its column', g.cardW <= g.wrapW + 1, 'card ' + g.cardW + ' vs column ' + g.wrapW);
      ok('page has no horizontal overflow', g.docScrollW <= g.vw, 'scrollW ' + g.docScrollW + ' vw ' + g.vw);
      for (const r of g.rails) ok('rail fits ITS OWN card: ' + r.cls.replace('mprail ', ''), r.cardW > 0 && r.clientW <= r.cardW + 1, 'rail ' + r.clientW + ' card ' + r.cardW); // the two rails live in two different cards on desktop
      if (w < 500) for (const r of g.rails) ok('rail scrolls instead of stretching: ' + r.cls.replace('mprail ', ''), r.scrolls && r.canR, JSON.stringify(r));

      // choosing the Gold Room scrolls it into view and swaps the panel + the live board
      const sel = await p.evaluate(async () => {
        const chip = document.querySelector('[data-pz="gold"]');
        chip.click(); await new Promise(r => setTimeout(r, 500));
        const s = chip.closest('.mprail-s'), cr = chip.getBoundingClientRect(), sr = s.getBoundingClientRect();
        const panel = document.getElementById('lbpzPanel').innerText.replace(/\s+/g, ' ');
        const lb = document.querySelector('[data-lbm="gold"]'); lb.click();
        await new Promise(r => setTimeout(r, 900));
        const board = document.getElementById('lbBoard').innerText.replace(/\s+/g, ' ').trim();
        const note = (document.getElementById('lbNote') || {}).innerText || '';
        return { chipVisible: cr.left >= sr.left - 1 && cr.right <= sr.right + 1, panel, board: board.slice(0, 120), note: note.replace(/\s+/g, ' ') };
      });
      ok('picking Gold Room scrolls the chip fully into view', sel.chipVisible);
      ok('panel switches to the Gold Room', /Gold Room/i.test(sel.panel) && /prize money starts next season/i.test(sel.panel), sel.panel.slice(0, 90));
      ok('live board switches to the Gold Room', /win|Gold member/i.test(sel.board), sel.board.slice(0, 80));
      ok('live board note states it is unpaid this season', /prize money starts next season/i.test(sel.note), sel.note.slice(0, 90));
      ok('no page errors', errs.length === 0, errs.join(' | '));
      await p.screenshot({ path: path.join(OUT, 'lbrail-' + tag.replace(/\s+/g, '') + '.png') });
      await p.close(); await ctx.close();
    }
  }, { timeoutMs: 500000 });
  console.log(bad ? '\nFAIL ' + bad : '\nPASS');
  process.exit(bad ? 1 : 0);
})();
