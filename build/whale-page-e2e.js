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

      // 2026-09-17 (owner): no counts on tabs, chips or tiles; a glance block says what whales are buying
      const gl = await p.evaluate(() => {
        const tabs = [...document.querySelectorAll('.wl-tabs button')].map(b => b.textContent.trim());
        const nm = [...document.querySelectorAll('#wlNowM .wl-nm')], nt = [...document.querySelectorAll('#wlNowT .wl-nt')];
        const reach = el => { if (!el) return false; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(h && el.contains(h)); };
        return { tabs, digits: tabs.filter(t => /\d/.test(t)).length, nm: nm.length, nt: nt.length, nmReach: reach(nm[0]), ntReach: reach(nt[0]), big: (document.getElementById('wlBig') || {}).textContent, chipDigits: [...document.querySelectorAll('#wlSym button, #wlTrSym button')].filter(b => /\s\d+$/.test(b.textContent.trim())).length, /* "1000PEPE" is a market, "PEPE 12" was a count */ bars: document.querySelectorAll('.wl-bar2').length, fbtn: document.querySelectorAll('.wl-fbtn').length };
      });
      ok(gl.digits === 0 && gl.chipDigits === 0, 'no count printed on any tab or market chip', gl.tabs);
      ok(gl.nm >= 3 && gl.nmReach && gl.nt >= 1 && gl.ntReach, 'the glance block names the top markets and the latest big moves, reachable', gl);
      ok(/\$/.test(gl.big || '') && /(long|short)/.test(gl.big || ''), 'the hero names the biggest open bet instead of a wallet count', gl.big);
      ok(gl.bars === 0 && gl.fbtn === 2, 'the inline filter strips are gone; one Filters button per filterable view', gl);

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
        // the filters live in a sheet now (2026-09-17): open it, prove it is on screen and reachable, then filter
        document.querySelector('.wl-fbtn[data-fopen="pos"]').click(); await new Promise(r => setTimeout(r, 350));
        const sh0 = document.getElementById('wlFilt'), sb = sh0.getBoundingClientRect(), shit = document.elementFromPoint(sb.left + sb.width / 2, sb.top + 40);
        const sheet = { open: !sh0.hidden, inView: sb.left >= -1 && sb.right <= innerWidth + 1 && sb.top >= -1 && sb.bottom <= innerHeight + 1, reach: !!(shit && sh0.contains(shit)), groups: [...sh0.querySelectorAll('.wl-fg')].filter(g => !g.hidden).length, title: (document.getElementById('wlFiltT') || {}).textContent };
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
        const sum = (document.getElementById('wlFsumPos') || {}).textContent;
        // Done closes the sheet, the filter stays
        document.getElementById('wlFiltDone').click(); await new Promise(r => setTimeout(r, 300));
        const closed = document.getElementById('wlFilt').hidden && document.documentElement.style.overflow === '' && document.querySelectorAll('#wlPos .wl-pr').length === shortN;
        // back to all through the sheet's Reset
        document.querySelector('.wl-fbtn[data-fopen="pos"]').click(); await new Promise(r => setTimeout(r, 250));
        document.getElementById('wlFiltReset').click(); await new Promise(r => setTimeout(r, 300));
        document.getElementById('wlFiltX').click(); await new Promise(r => setTimeout(r, 250));
        return { before, after, sym, allSym, allShort, shortN, sheet, sum, closed, restored: document.querySelectorAll('#wlPos .wl-pr').length, sum2: (document.getElementById('wlFsumPos') || {}).textContent };
      });
      ok(filt.sheet.open && filt.sheet.inView && filt.sheet.reach && filt.sheet.groups === 3 && /positions/i.test(filt.sheet.title), 'the Filters button opens ONE sheet, on screen and reachable, with the three position groups', filt.sheet);
      ok(/Shorts/.test(filt.sum || '') && filt.sum.indexOf(filt.sym.split(':').pop()) >= 0, 'the summary line under the button states the active filters', filt.sum);
      ok(filt.closed, 'Done closes the sheet, keeps the filter and gives scrolling back', filt);
      ok(/All markets/.test(filt.sum2 || ''), 'Reset clears the filters', filt.sum2);
      ok(filt.after > 0 && filt.after < filt.before, 'a market chip narrows the board (' + filt.before + ' -> ' + filt.after + ' on ' + filt.sym + ')', filt);
      ok(filt.allSym, 'and every surviving row is that market');
      ok(filt.allShort && filt.shortN > 0, 'the SHORT filter leaves only shorts (' + filt.shortN + ')', filt);
      ok(filt.restored === filt.before, 'clearing both filters restores the board', filt);

      // sorting by nearest liquidation really reorders
      const srt = await p.evaluate(async () => {
        document.querySelector('.wl-fbtn[data-fopen="pos"]').click(); await new Promise(r => setTimeout(r, 250));
        document.querySelector('#wlSort button[data-sort="liq"]').click();
        await new Promise(r => setTimeout(r, 300));
        const d = [...document.querySelectorAll('#wlPos .wl-liq small')].map(x => parseFloat(x.textContent));
        let asc = true; for (let i = 1; i < d.length; i++) if (d[i] < d[i - 1] - 0.01) { asc = false; break; }
        document.querySelector('#wlSort button[data-sort="val"]').click();
        document.getElementById('wlFiltX').click(); await new Promise(r => setTimeout(r, 250));
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
        await new Promise(r => setTimeout(r, 4500)); /* the profile, then one klines fetch per market for the position charts */
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
          // 2026-09-17: every position card carries a chart slot; at least one drew price + entry dot + liquidation line
          chartSlots: body ? body.querySelectorAll('.wd-chart').length : 0,
          charts: body ? [...body.querySelectorAll('.wd-chart')].filter(c => c.querySelector('svg path') && c.querySelector('svg circle') && /LIQ/.test(c.textContent)).length : 0,
          chartLink: body ? [...body.querySelectorAll('.wd-chart .cap a')].some(a => /\/paper-trade\?coin=/.test(a.getAttribute('href'))) : false,
          chartNone: body ? body.querySelectorAll('.wd-chart .none').length : 0,
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
      ok(dr.chartSlots === dr.pos && dr.charts >= 1 && dr.chartLink, 'every position has a chart slot and at least one drew price, the entry dot and the liquidation line, linking a paper trade of the same setup', { slots: dr.chartSlots, charts: dr.charts, none: dr.chartNone, link: dr.chartLink });

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
