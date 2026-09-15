// Does it actually READ on a screen? The arena grew three columns (phones are the rule here) and the trade
// form grew a row. Reachability, not existence: elementFromPoint on the element's own centre must return it.
const { withBrowser } = require('./e2e-browser.js');
const ORIGIN = 'https://marginpad.io';
let pass = 0, fail = 0;
const chk = (n, ok, d) => { (ok ? pass++ : fail++); console.log((ok ? '  ok   ' : '  FAIL ') + n + (d !== undefined && (!ok || process.env.V) ? '   ' + JSON.stringify(d) : '')); };

const reach = (page, sel) => page.evaluate(s => {
  const el = document.querySelector(s); if (!el) return { err: 'missing' };
  const r = el.getBoundingClientRect(); if (!r.width || !r.height) return { err: 'zero-size' };
  if (r.top < 0 || r.bottom > innerHeight) return { err: 'off-screen', top: Math.round(r.top), bottom: Math.round(r.bottom) };
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { ok: !!hit && (hit === el || el.contains(hit) || hit.contains(el)), tag: hit && hit.tagName };
}, sel);

withBrowser(async browser => {
  for (const [label, w, h] of [['desktop', 1366, 900], ['phone', 390, 844]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    const errs = []; page.on('pageerror', e => errs.push(String(e.message)));

    // ── the arena ────────────────────────────────────────────────────────────────────────────────────
    await page.goto(ORIGIN + '/arena/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(() => !/Loading/.test(document.querySelector('#rows') ? document.querySelector('#rows').textContent : 'Loading'), { timeout: 30000 }).catch(() => {});
    const a = await page.evaluate(() => {
      const ths = [...document.querySelectorAll('thead th')].map(t => t.textContent.trim());
      const r0 = document.querySelector('#rows tr');
      const cells = r0 ? [...r0.children].map(c => c.textContent.trim()) : [];
      return { ths, cells, n: document.querySelectorAll('#rows tr').length,
        flagged: document.querySelectorAll('td.flagwr').length, chips: document.querySelectorAll('.rz').length,
        docW: document.documentElement.scrollWidth, winW: innerWidth,
        warn: !!document.querySelector('.warnline') };
    });
    chk(label + ': the arena has the open book beside the win rate', a.ths.indexOf('Open') === a.ths.indexOf('Win rate') + 1 && a.ths.includes('Unrealized') && a.ths.includes('Book'), a.ths);
    chk(label + ': rows carry a fills chip', a.chips >= a.n && a.n > 0, { chips: a.chips, rows: a.n });
    chk(label + ': a 100% win rate with open positions is flagged', a.flagged > 0 || !a.cells.length, { flagged: a.flagged, first: a.cells.slice(0, 8) });
    chk(label + ': the warning sits above the table', a.warn);
    chk(label + ': the page does not scroll sideways', a.docW <= a.winW + 1, { doc: a.docW, win: a.winW });
    chk(label + ': no page errors on the arena', !errs.length, errs.slice(0, 2));
    if (a.cells.length) console.log('         row 1: ' + a.cells.join(' | '));

    // ── the trade form ───────────────────────────────────────────────────────────────────────────────
    errs.length = 0;
    await page.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#planAdvChk', { timeout: 30000 }).catch(() => {});
    const hidden = await page.evaluate(() => { const f = document.getElementById('planRzField'); return !!f && !f.offsetParent; });
    chk(label + ': realistic fills stays folded inside Advanced', hidden);
    await page.evaluate(() => { const c = document.getElementById('planAdvChk'); if (c && !c.checked) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); } });
    // wait for the panel to be PAINTED, not for a guessed number of milliseconds - `hidden` on the wrapper
    // makes every child zero-size, and a fixed delay races the terminal's own boot on a cold load
    await page.waitForFunction(() => { const f = document.getElementById('planRzField'); return !!f && f.offsetParent && f.getBoundingClientRect().height > 0; }, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { const f = document.getElementById('planRzField'); if (f) f.scrollIntoView({ block: 'center' }); });
    await new Promise(r => setTimeout(r, 400));
    const sw = await reach(page, '#planRzSlip');
    chk(label + ': the slippage switch is reachable once Advanced is open', sw.ok, sw);
    const st = await page.evaluate(() => { const e = document.getElementById('planRzSt'); return e ? e.textContent : null; });
    chk(label + ': and says which mode the next fill is in', st === 'engine defaults', { st });
    const hint = await page.evaluate(() => { const b = document.querySelector('[data-hint="planRzHint"]'); if (!b) return 'no-button'; b.click(); const h = document.getElementById('planRzHint'); return h && !h.hidden ? h.textContent.slice(0, 40) : 'still-hidden'; });
    chk(label + ': the ? explains it', /By default a market order/.test(hint), { hint });
    const w2 = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: innerWidth }));
    chk(label + ': the form does not widen the page', w2.doc <= w2.win + 1, w2);
    chk(label + ': no page errors on the terminal', !errs.length, errs.slice(0, 2));
    await page.close();
  }
  console.log('\n' + pass + ' pass, ' + fail + ' fail');
  process.exitCode = fail ? 1 : 0;
}, { timeout: 220000 });
