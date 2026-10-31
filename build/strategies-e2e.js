/* /strategies/ as a reader meets it. Everything a figure says is compared with the data the engine wrote.
   node build/strategies-e2e.js [--local]   (--local serves the tree over production) */
const fs = require('fs'), path = require('path');
const { withBrowser, newPage } = require('./e2e-browser.js');
const LOCAL = process.argv.includes('--local'), BASE = 'https://marginpad.io', DIST = path.join(__dirname, '..', 'dist');
const IDX = JSON.parse(fs.readFileSync(path.join(DIST, 'strategies/data/index.json'), 'utf8'));
const { fmtRet } = require('../dist/assets/mp-strategies.js');
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('FAIL  ' + m + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = { html: 'text/html; charset=utf-8', js: 'application/javascript', css: 'text/css', json: 'application/json', pine: 'text/plain', py: 'text/plain', md: 'text/plain' };

async function setup(p) {
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  if (LOCAL) {
    await p.setRequestInterception(true);
    p.on('request', (r) => {
      const u = new URL(r.url());
      if (u.hostname === 'marginpad.io') {
        let f = null;
        if (u.pathname.startsWith('/strategies')) { f = u.pathname.replace(/\/$/, '/index.html'); if (!/\.\w+$/.test(f)) f += '/index.html'; }
        else if (/^\/assets\/(mp-strat|mp-strategies|mp-nav)/.test(u.pathname)) f = u.pathname;
        if (f) {
          const fp = path.join(DIST, f);
          if (fs.existsSync(fp)) return r.respond({ status: 200, contentType: TYPES[fp.split('.').pop()] || 'text/plain', body: fs.readFileSync(fp) });
        }
      }
      r.continue();
    });
  }
  return errs;
}
const go = async (p, u) => { await p.goto(BASE + u, { waitUntil: 'domcontentloaded', timeout: 40000 }); };
const ready = (p) => p.waitForFunction(() => window.mpStrategies && window.mpStrategies.state().n > 0 && document.querySelector('.wp'), { timeout: 20000 });

(async () => {
  const html = fs.readFileSync(path.join(DIST, 'strategies/index.html'), 'utf8');
  ok((html.match(/class="sc"/g) || []).length >= 58, 'the cards are in the static HTML, for a reader with no script', (html.match(/class="sc"/g) || []).length);
  ok((html.match(/<h1/g) || []).length === 1, 'one h1');
  ok(/^<!DOCTYPE html>\s*<html[^>]*>\s*<head>\s*<meta charset/i.test(html), 'charset is the first tag in head');
  ok(!/3commas/i.test(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/Can I run one on 3Commas\?[\s\S]*?<\/p>/, '')), 'no 3Commas promotion on the hub');
  const auto = fs.readFileSync(path.join(DIST, 'strategies/automate/index.html'), 'utf8');
  ok(/c=tc2235309/.test(auto) && /rel="sponsored noopener"/.test(auto) && /Partner link/.test(auto), 'the referral link is on the guide, marked as one');
  const pages = fs.readdirSync(path.join(DIST, 'strategies')).filter((d) => fs.existsSync(path.join(DIST, 'strategies', d, 'index.html')) && d !== 'automate');
  ok(pages.length === IDX.rules.length, 'one page per strategy', pages.length);
  ok(IDX.rules.every((r) => ['pine', 'py'].every((x) => fs.existsSync(path.join(DIST, `strategies/files/${r.slug}/${r.slug}.${x}`)))), 'every strategy has its downloads');
  const emoji = /[\u{1F300}-\u{1FAFF}☀-➿]/u;
  ok(!emoji.test(html) && !emoji.test(auto), 'no emoji');

  await withBrowser(async (b) => {
    const p = await newPage(b, {}); await p.setViewport({ width: 1366, height: 800 });
    await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const errs = await setup(p);
    await go(p, '/strategies/'); await ready(p);
    const anim = await p.evaluate(() => document.querySelector('#wSvg').getAnimations().length);
    ok(anim > 0, 'the wall animates on a machine with animation effects off', anim);
    const count = await p.evaluate(() => document.querySelectorAll('.wp').length);
    ok(count === IDX.rules.filter((r) => r.classes.crypto).length, 'one line per strategy on the wall', count);
    const shown = await p.evaluate(() => [...document.querySelectorAll('.sc')].slice(0, 60).map((c) => [c.dataset.open, c.querySelector('dd').textContent]));
    ok(shown.every(([s, v]) => { const r = IDX.rules.find((x) => x.slug === s); return fmtRet(r.classes.crypto.m.ret) === v; }), 'every card prints the engine figure', shown.slice(0, 2));
    const scroll = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(scroll <= 0, 'nothing wider than the screen', scroll);

    // the wall answers a pointer, and a click opens the strategy
    const box = await (await p.$('#wFrame')).boundingBox();
    await p.evaluate(() => document.querySelector('#wFrame').scrollIntoView({ block: 'center' })); await sleep(300);
    const fb = await (await p.$('#wFrame')).boundingBox();
    const target = await p.evaluate(() => { const m = document.querySelector('.wp'); const pt = m.getPointAtLength(m.getTotalLength() * .7); const r = document.querySelector('#wFrame').getBoundingClientRect(); return { x: r.left + pt.x / 1000 * r.width, y: r.top + pt.y / 400 * r.height }; });
    await p.mouse.move(target.x, target.y); await sleep(250);
    const tip = await p.evaluate(() => { const t = document.querySelector('#wTip'); return !t.hidden && t.querySelector('h4') && t.querySelector('h4').textContent; });
    ok(!!tip, 'pointing at a line names the strategy', tip);
    await p.mouse.click(target.x, target.y); await sleep(700);
    ok(await p.evaluate(() => !document.querySelector('#dr').hidden && location.hash.length > 1), 'a click opens that strategy in the drawer');
    await p.waitForSelector('#drB .cl', { timeout: 10000 });
    const dr = await p.evaluate(() => ({ lines: document.querySelectorAll('#drB .cl').length, tiles: document.querySelectorAll('#drB .d-m dd').length, rows: document.querySelectorAll('#drB tbody tr').length }));
    ok(dr.lines === 2 && dr.tiles >= 12 && dr.rows >= 20, 'the drawer carries the curve, the metrics and every market', dr);
    const a = await p.evaluate(() => document.querySelector('#drH h2').textContent);
    await p.click('#drN'); await sleep(500);
    ok(a !== await p.evaluate(() => document.querySelector('#drH h2').textContent), 'next walks the library');
    await p.keyboard.press('Escape'); await sleep(200);
    ok(await p.evaluate(() => document.querySelector('#dr').hidden && !location.hash), 'Escape closes it');

    // market switch
    await p.evaluate(() => document.querySelector('[data-m="stocks"]').click()); await sleep(300);
    const m = await p.evaluate(() => ({ url: location.search, n: document.querySelectorAll('.sc').length, lbl: document.querySelector('#wLbl').textContent }));
    ok(m.url.includes('market=stocks') && /on Stocks/.test(m.lbl) && m.n === IDX.rules.filter((r) => r.classes.stocks).length, 'the market tab re-reads the library and the wall', m);
    await p.evaluate(() => document.querySelector('[data-m="crypto"]').click()); await sleep(200);

    // library
    await p.type('#q', 'rsi'); await sleep(200);
    const q = await p.evaluate(() => [...document.querySelectorAll('.sc h3')].map((x) => x.textContent));
    ok(q.length > 2 && q.length < 15, 'search narrows the list', q.length);
    await p.evaluate(() => { document.querySelector('#q').value = ''; document.querySelector('#q').dispatchEvent(new Event('input')); });
    await p.select('#sort', 'ret'); await sleep(200);
    const top = await p.evaluate(() => document.querySelector('.sc').dataset.open);
    const best = IDX.rules.filter((r) => r.classes.crypto).sort((x, y) => y.classes.crypto.m.ret - x.classes.crypto.m.ret)[0];
    ok(top === best.slug, 'sorting by return puts the highest first', [top, best.slug]);
    await p.evaluate(() => document.querySelector('[data-v="table"]').click()); await sleep(200);
    ok(await p.evaluate(() => document.querySelectorAll('#lib tbody tr').length >= 58), 'table view lists every strategy');
    await p.evaluate(() => document.querySelector('[data-v="cards"]').click()); await sleep(150);
    await p.evaluate(() => document.querySelector('#fBeat').click()); await sleep(200);
    const nb = await p.evaluate(() => document.querySelectorAll('.sc').length);
    ok(nb === IDX.rules.filter((r) => r.classes.crypto && r.classes.crypto.m.ret > r.classes.crypto.bench).length, 'Beat holding is exactly the rows that beat holding', nb);
    await p.evaluate(() => document.querySelector('#fBeat').click()); await sleep(150);

    // compare
    await p.evaluate(() => { const c = document.querySelectorAll('.sc-cmp'); c[0].click(); c[1].click(); }); await sleep(150);
    await p.click('#trayGo'); await p.waitForSelector('#cmpB .cl', { timeout: 10000 });
    ok(await p.evaluate(() => document.querySelectorAll('#cmpB .cl').length === 2 && document.querySelectorAll('#cmpB tbody tr').length >= 6), 'compare draws both curves and the table');
    await p.keyboard.press('Escape'); await sleep(200);
    await go(p, '/strategies/'); await ready(p); await sleep(200);
    ok(await p.evaluate(() => !document.querySelector('#tray').hidden), 'the compare list survives a reload');
    await p.click('#trayX');

    // a strategy page, and the lab on real candles
    const slug = 'supertrend';
    await go(p, `/strategies/${slug}/`);
    await p.waitForSelector('#sDetail .cl', { timeout: 15000 });
    ok(await p.evaluate(() => document.querySelectorAll('h1').length === 1 && document.querySelector('link[rel=canonical]').href.endsWith('/strategies/supertrend/')), 'a strategy page has its own h1 and canonical');
    await p.evaluate(() => document.querySelector('#lRun').click());
    await p.waitForFunction(() => /Return/.test(document.querySelector('#lOut').textContent) || /Could not|No candles/.test(document.querySelector('#lOut').textContent), { timeout: 20000 });
    ok(await p.evaluate(() => /Return/.test(document.querySelector('#lOut').textContent)), 'the lab runs the engine on live candles', await p.evaluate(() => document.querySelector('#lOut').textContent.slice(0, 90)));
    await go(p, '/strategies/automate/'); await sleep(500);
    ok(errs.length === 0, 'no page errors on a desktop', errs.slice(0, 3));

    // phone
    const f = await newPage(b, { mobile: true }); await f.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const e2 = await setup(f);
    await go(f, '/strategies/'); await ready(f);
    const ph = await f.evaluate(() => {
      const w = document.documentElement.scrollWidth - innerWidth, c = document.querySelector('.sc'); c.scrollIntoView({ block: 'center' });
      const r = c.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { w, reach: c.contains(e) };
    });
    ok(ph.w <= 0, 'nothing wider than a phone', ph.w);
    ok(ph.reach, 'the first card is under the finger');
    await f.evaluate(() => document.querySelector('.sc').click()); await f.waitForSelector('#drB .cl', { timeout: 12000 });
    await sleep(500); // the sheet slides in; a rect read during the slide is 30px low
    const sh = await f.evaluate(() => { const r = document.querySelector('#dr').getBoundingClientRect(); return { b: r.bottom <= innerHeight + 1, t: r.top >= 0, w: r.width }; });
    ok(sh.b && sh.t && sh.w <= 390, 'the drawer is a sheet inside the screen', sh);
    ok(e2.length === 0, 'no page errors on a phone', e2.slice(0, 3));
  }, { timeoutMs: 170000 });
  console.log(`\n${pass} ok, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log('ERR', e.message); process.exitCode = 1; });
