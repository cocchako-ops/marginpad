// The rebuilt Hyperliquid whale page (2026-09-14) - owner: "sad kad otvoris stranicu sve je nabacano
// i nista se ne vidi lepo ... hocu da bude interaktivno i da bude korisno".
//
// Every check is REACHABILITY (elementFromPoint at the element's centre in the default page state),
// not presence - the bug this suite exists to catch shipped as valid markup: the wallet drawer was
// display:flex under a UA `hidden`, so at 390px it covered the entire page and every row under it was
// dead to a finger while the DOM looked perfect.
//
//   node build/whale-page-e2e.js
const { withBrowser, newPage } = require('./e2e-browser.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 260) : '')); } };
const URL = 'https://marginpad.io/hyperliquid-whales/?nc=1&cb=';

(async () => {
  // the data the page is drawn from
  console.log('\ndata');
  const d = await (await fetch('https://marginpad.io/api/cg/hyper?cb=' + Date.now())).json();
  ok((d.positions || []).length > 0, 'positions (' + (d.positions || []).length + ')');
  ok(Array.isArray(d.coins) && d.coins.length > 0, 'per-market aggregate (' + (d.coins || []).length + ')');
  ok(Array.isArray(d.best) && d.best.length > 0, 'month board (' + (d.best || []).length + ')');
  ok(d.perf && Object.keys(d.perf).length > 0, 'track record per wallet (' + Object.keys(d.perf || {}).length + ')');
  ok((d.best || []).every(b => b.v >= 1e4), 'no emptied account leads the month board', (d.best || []).find(b => b.v < 1e4));
  ok((d.coins || []).every(c => c.longUsd >= 0 && c.shortUsd >= 0 && c.n > 0), 'every market row has both sides and a wallet count');
  { const c = (d.coins || []).find(x => x.oiShare != null);
    ok(!c || (c.oiShare > 0 && c.oiShare <= 100), 'share of open interest is a share', c && { sym: c.sym, oiShare: c.oiShare }); }

  // the profile endpoint behind the drawer
  const addr = (d.positions || [])[0] && d.positions[0].user;
  const prof = addr ? await (await fetch('https://marginpad.io/api/whale/profile?a=' + addr)).json() : null;
  ok(prof && prof.ok, 'the profile endpoint answers for a tracked wallet');
  ok(prof && prof.equity > 0, 'and carries an account value');
  ok(prof && Array.isArray(prof.pos), 'and the open book');
  ok(prof && prof.month && (prof.month.av || []).length > 2, 'and a 30-day equity history (' + ((prof && prof.month && prof.month.av || []).length) + ' points)');
  { const bad = await (await fetch('https://marginpad.io/api/whale/profile?a=notanaddress')).json();
    ok(bad && bad.error === 'bad_address', 'a bad address is refused, not guessed at'); }

  await withBrowser(async b => {
    for (const [w, h, tag] of [[1366, 1000, 'desktop'], [390, 860, 'phone']]) {
      console.log('\n' + tag + ' (' + w + 'px)');
      const p = await newPage(b);
      await p.setViewport({ width: w, height: h });
      const errs = [];
      p.on('pageerror', e => errs.push(String(e.message).slice(0, 130)));
      await p.goto(URL + Date.now(), { waitUntil: 'networkidle2', timeout: 70000 });
      await sleep(4000);

      const base = await p.evaluate(() => ({
        wait: (document.getElementById('wlWait') || {}).hidden,
        drawerHidden: (document.getElementById('wdDrawer') || {}).hidden,
        // the real test: is anything of the drawer painted over the page before it is opened
        drawerPainted: (() => { const el = document.getElementById('wdDrawer'); if (!el) return 'missing';
          return getComputedStyle(el).display !== 'none'; })(),
        over: document.documentElement.scrollWidth > window.innerWidth + 1 ? document.documentElement.scrollWidth : 0,
        tabs: document.querySelectorAll('.wl-tabs button').length,
      }));
      ok(base.wait === true, 'the "refreshing" banner is hidden when there is data');
      ok(base.drawerHidden === true && base.drawerPainted === false, 'the wallet drawer is NOT painted before it is opened', base);
      ok(base.over === 0, 'the page never scrolls sideways', base.over);
      ok(base.tabs === 4, 'four views', base.tabs);

      for (const v of ['pos', 'trades', 'coins', 'best']) {
        const r = await p.evaluate(async (view) => {
          const t = document.querySelector('.wl-tabs button[data-view="' + view + '"]'); if (t) t.click();
          await new Promise(r => setTimeout(r, 450));
          const shown = [...document.querySelectorAll('.wl-view')].filter(s => !s.hidden);
          const sec = shown[0];
          const rows = sec ? [...sec.querySelectorAll('.wl-pr, .wl-tr, .wl-cr, .wl-br')] : [];
          const first = rows[0];
          let hit = false;
          if (first) { first.scrollIntoView({ block: 'center' }); const bb = first.getBoundingClientRect();
            const el = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2); hit = !!(el && first.contains(el)); }
          return { shown: shown.length, id: sec && sec.id, rows: rows.length, hit,
                   empty: !!(sec && sec.querySelector('.wl-empty')),
                   over: document.documentElement.scrollWidth > window.innerWidth + 1 };
        }, v);
        ok(r.shown === 1, '[' + v + '] exactly one view is on screen', r);
        ok(r.rows > 0 && !r.empty, '[' + v + '] has real rows (' + r.rows + ')', r);
        ok(r.hit, '[' + v + '] the first row is reachable where it sits', r);
        ok(!r.over, '[' + v + '] no sideways scroll', r);
      }

      // filters actually filter
      const filt = await p.evaluate(async () => {
        const t = document.querySelector('.wl-tabs button[data-view="pos"]'); t && t.click();
        await new Promise(r => setTimeout(r, 350));
        const before = document.querySelectorAll('#wlPos .wl-pr').length;
        const chip = [...document.querySelectorAll('#wlSym button')].filter(x => x.getAttribute('data-sym'))[0];
        const sym = chip && chip.getAttribute('data-sym');
        chip && chip.click(); await new Promise(r => setTimeout(r, 300));
        const after = document.querySelectorAll('#wlPos .wl-pr').length;
        const allSym = [...document.querySelectorAll('#wlPos .wl-pr .wl-sym')].every(x => x.textContent.indexOf(sym.split(':').pop()) >= 0);
        // short only
        const sh = document.querySelector('#wlSide button[data-side="s"]'); sh && sh.click();
        await new Promise(r => setTimeout(r, 300));
        const allShort = [...document.querySelectorAll('#wlPos .wl-pill')].every(x => x.textContent === 'SHORT');
        const shortN = document.querySelectorAll('#wlPos .wl-pr').length;
        // back to all
        document.querySelector('#wlSide button[data-side=""]').click();
        document.querySelector('#wlSym button[data-sym=""]').click();
        await new Promise(r => setTimeout(r, 300));
        return { before, after, sym, allSym, allShort, shortN, restored: document.querySelectorAll('#wlPos .wl-pr').length };
      });
      ok(filt.after > 0 && filt.after < filt.before, 'a market chip narrows the board (' + filt.before + ' -> ' + filt.after + ' on ' + filt.sym + ')', filt);
      ok(filt.allSym, 'and every surviving row is that market');
      ok(filt.allShort && filt.shortN > 0, 'the SHORT filter leaves only shorts (' + filt.shortN + ')', filt);
      ok(filt.restored === filt.before, 'clearing both filters restores the board', filt);

      // sorting by nearest liquidation really reorders
      const srt = await p.evaluate(async () => {
        document.querySelector('#wlSort button[data-sort="liq"]').click();
        await new Promise(r => setTimeout(r, 300));
        const d = [...document.querySelectorAll('#wlPos .wl-liq small')].map(x => parseFloat(x.textContent));
        let asc = true; for (let i = 1; i < d.length; i++) if (d[i] < d[i - 1] - 0.01) { asc = false; break; }
        document.querySelector('#wlSort button[data-sort="val"]').click();
        return { n: d.length, asc, first: d[0], last: d[d.length - 1] };
      });
      ok(srt.asc && srt.n > 2, 'NEAR LIQ sorts by distance to liquidation, closest first (' + srt.first + '% -> ' + srt.last + '%)', srt);

      // the drawer
      const dr = await p.evaluate(async () => {
        document.querySelector('.wl-tabs button[data-view="pos"]').click();
        await new Promise(r => setTimeout(r, 300));
        const row = document.querySelector('.wl-pr[data-w]');
        const a = row && row.getAttribute('data-w');
        row && row.click();
        await new Promise(r => setTimeout(r, 2800));
        const dw = document.getElementById('wdDrawer'), body = document.getElementById('wdBody');
        const bb = dw ? dw.getBoundingClientRect() : null;
        const el = bb ? document.elementFromPoint(bb.left + bb.width / 2, bb.top + Math.min(200, bb.height / 3)) : null;
        return {
          a, open: !!(dw && !dw.hidden),
          inView: !!(bb && bb.width > 0 && bb.right <= window.innerWidth + 1 && bb.left >= -1),
          reachable: !!(el && dw && dw.contains(el)),
          locked: document.documentElement.style.overflow === 'hidden',
          sections: [...(body ? body.querySelectorAll('.wd-h3') : [])].length,
          rec: (body ? body.querySelectorAll('.wd-rec .c') : []).length,
          pos: body ? body.querySelectorAll('.wd-p').length : 0,
          curve: !!(body ? body.querySelector('.wd-curve svg path') : null),
          links: body ? body.querySelectorAll('.wd-lnk a, .wd-lnk button').length : 0,
          // read the position card itself: innerText on the scrolling drawer body stops at the fold
          text: body && body.querySelector('.wd-p') ? (body.querySelector('.wd-p').textContent || '').replace(/\s+/g, ' ').slice(0, 240) : '',
        };
      });
      ok(dr.open && dr.inView && dr.reachable, 'clicking a row opens the wallet drawer, fully on screen', dr);
      ok(dr.locked, 'and the page behind it stops scrolling');
      ok(dr.rec === 4, 'it shows the track record over four windows', dr.rec);
      ok(dr.pos > 0, 'and the open book (' + dr.pos + ' positions)', dr);
      ok(dr.curve, 'and a 30-day equity curve');
      ok(dr.links >= 3, 'and the links out (' + dr.links + ')', dr);
      ok(/ENTRY|LIQUIDATION/.test(dr.text.toUpperCase()), 'each position names its entry and liquidation', dr.text);

      const cl = await p.evaluate(async () => {
        document.getElementById('wdX').click();
        await new Promise(r => setTimeout(r, 350));
        const dw = document.getElementById('wdDrawer');
        return { hidden: dw.hidden, painted: getComputedStyle(dw).display !== 'none', scroll: document.documentElement.style.overflow };
      });
      ok(cl.hidden && !cl.painted && cl.scroll === '', 'it closes and gives the page back', cl);

      ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
      await p.close();
    }
  });

  console.log('\nwhale-page-e2e: pass ' + pass + '  fail ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
