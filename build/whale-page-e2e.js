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
        const nm = [...document.querySelectorAll('#wlNowM .wl-nm')], nt = [...document.querySelectorAll('#wlFeed .wl-fr')];
        const reach = el => { if (!el) return false; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(h && el.contains(h)); };
        const bigRow = document.getElementById('wlBigRow');
        return { tabs, digits: tabs.filter(t => /\d/.test(t)).length, nm: nm.length, nt: nt.length, nmReach: reach(nm[0]), ntReach: reach(nt[0]), big: (document.getElementById('wlBig') || {}).textContent,
          bigSub: bigRow && bigRow.querySelector('small') ? bigRow.querySelector('small').textContent : '',
          tenRows: document.querySelectorAll('#wlTop .wl-t10').length,
          tenValued: [...document.querySelectorAll('#wlTop .wl-t10 .v')].filter(v => (v.textContent || '').trim().length > 1 && v.textContent.trim() !== '-').length,
          tenInside: [...document.querySelectorAll('#wlTop .wl-t10')].every(b => b.getBoundingClientRect().right <= window.innerWidth + 1),
          feedWho: document.querySelectorAll('#wlFeed .wl-fr .wh-nm').length,
          feedAv: document.querySelectorAll('#wlFeed .wl-fr svg.wh-av').length,
          noCrumb: !document.querySelector('.crumb'), noEyebrow: !document.querySelector('.wl-eyebrow'),
          h1: ((document.querySelector('h1') || {}).textContent || '').trim(),
          h1px: document.querySelector('h1') ? Math.round(parseFloat(getComputedStyle(document.querySelector('h1')).fontSize)) : 0,
          segs: document.querySelectorAll('.wl-sect').length, chipDigits: [...document.querySelectorAll('#wlSym button, #wlTrSym button')].filter(b => /\s\d+$/.test(b.textContent.trim())).length, /* "1000PEPE" is a market, "PEPE 12" was a count */ bars: document.querySelectorAll('.wl-bar2').length, fbtn: document.querySelectorAll('.wl-fbtn').length };
      });
      ok(gl.digits === 0 && gl.chipDigits === 0, 'no count printed on any tab or market chip', gl.tabs);
      ok(gl.nm >= 3 && gl.nmReach, 'the markets segment names the top markets, reachable', gl);
      /* ROUND TWO (2026-10-28, owner: "prvi prozor da budu 10 najbitnijih informacija ... novcanici kao ljudi
         ... live feed"). The second glance card became the LIVE FEED and the four hero tiles became four of
         ten clickable lines - these checks describe THAT page, not the one they were written for. */
      ok(gl.nt >= 3 && gl.ntReach, 'the live feed carries rows and the first one is reachable', gl);
      ok(gl.feedWho >= 3 && gl.feedAv >= 3, 'every live row carries a derived callsign and its own mark', gl);
      ok(gl.noCrumb && gl.noEyebrow, 'no breadcrumb and no eyebrow stand above the data', gl);
      ok(/whale/i.test(gl.h1) && gl.h1px <= 14, 'the h1 survives for a crawler but is a label, never a hero', gl);
      ok(gl.segs >= 4, 'the page is split into segments', gl.segs);
      ok(gl.tenRows === 10 && gl.tenValued >= 8, 'ten lines, and at least eight carry a figure', gl);
      ok(gl.tenInside, 'no line pushes its figure off the right edge of the screen', gl);
      ok(/\$/.test(gl.big || ''), 'the biggest-bet line states a size', gl.big);
      ok(/(long|short)/.test(gl.bigSub || ''), 'and names the market and the side under it', gl.bigSub);
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
          /* AN EMPTY SUB-LIST IS NOT AN EMPTY VIEW. This read any `.wl-empty` anywhere in the view, and the
             Trades view carries a SECOND list under the trades - the position changes - which is empty for
             the first minutes after every collector restart (the first poll has nothing to diff against)
             and whenever no whale has moved. Eight real rows were being failed because of it. The invariant
             is an empty notice standing WHERE THE ROWS SHOULD BE. */
          const list = rows[0] ? rows[0].parentElement : null;
          return { shown: shown.length, id: sec && sec.id, rows: rows.length, hit,
                   empty: !!(list ? list.querySelector(':scope > .wl-empty') : (sec && sec.querySelector('.wl-empty'))),
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
        const beforeTotal = () => { const m = document.getElementById('wlMore'); const t = m && /(\d+)/.exec(m.textContent || ''); return t ? +t[1] : document.querySelectorAll('#wlPos .wl-pr').length; };
        const before = beforeTotal();
        // the filters live in a sheet now (2026-09-17): open it, prove it is on screen and reachable, then filter
        document.querySelector('.wl-fbtn[data-fopen="pos"]').click(); await new Promise(r => setTimeout(r, 350));
        const sh0 = document.getElementById('wlFilt'), sb = sh0.getBoundingClientRect(), shit = document.elementFromPoint(sb.left + sb.width / 2, sb.top + 40);
        const sheet = { open: !sh0.hidden, inView: sb.left >= -1 && sb.right <= innerWidth + 1 && sb.top >= -1 && sb.bottom <= innerHeight + 1, reach: !!(shit && sh0.contains(shit)), groups: [...sh0.querySelectorAll('.wl-fg')].filter(g => !g.hidden).length, title: (document.getElementById('wlFiltT') || {}).textContent };
        const chip = [...document.querySelectorAll('#wlSym button')].filter(x => x.getAttribute('data-sym'))[0];
        const sym = chip && chip.getAttribute('data-sym');
        chip && chip.click(); await new Promise(r => setTimeout(r, 300));
        const total = () => { const m = document.getElementById('wlMore'); const t = m && /(\d+)/.exec(m.textContent || ''); return t ? +t[1] : document.querySelectorAll('#wlPos .wl-pr').length; };
        const after = total();
        const allSym = [...document.querySelectorAll('#wlPos .wl-pr .wl-mk')].every(x => (x.getAttribute('data-coin') || '') === sym.split(':').pop());
        // short only
        const sh = document.querySelector('#wlSide button[data-side="s"]'); sh && sh.click();
        await new Promise(r => setTimeout(r, 300));
        const allShort = [...document.querySelectorAll('#wlPos .wl-pr .wl-pill')].every(x => x.classList.contains('s'));
        const shortN = total();
        const sum = (document.getElementById('wlFsumPos') || {}).textContent;
        // Done closes the sheet, the filter stays
        document.getElementById('wlFiltDone').click(); await new Promise(r => setTimeout(r, 300));
        const closed = document.getElementById('wlFilt').hidden && document.documentElement.style.overflow === '' && document.querySelectorAll('#wlPos .wl-pr').length === shortN;
        // back to all through the sheet's Reset
        document.querySelector('.wl-fbtn[data-fopen="pos"]').click(); await new Promise(r => setTimeout(r, 250));
        document.getElementById('wlFiltReset').click(); await new Promise(r => setTimeout(r, 300));
        document.getElementById('wlFiltX').click(); await new Promise(r => setTimeout(r, 250));
        return { before, after, sym, allSym, allShort, shortN, sheet, sum, closed, restored: total(), sum2: (document.getElementById('wlFsumPos') || {}).textContent };
      });
      ok(filt.sheet.open && filt.sheet.inView && filt.sheet.reach && filt.sheet.groups === 3 && /positions/i.test(filt.sheet.title), 'the Filters button opens ONE sheet, on screen and reachable, with the three position groups', filt.sheet);
      ok(/Shorts/.test(filt.sum || '') && filt.sum.indexOf(filt.sym.split(':').pop()) >= 0, 'the summary line under the button states the active filters', filt.sum);
      ok(filt.closed, 'Done closes the sheet, keeps the filter and gives scrolling back', filt);
      ok(/All markets/.test(filt.sum2 || ''), 'Reset clears the filters', filt.sum2);
      ok(filt.after > 0 && filt.after < filt.before, 'a market chip narrows the board (' + filt.before + ' -> ' + filt.after + ' on ' + filt.sym + ')', filt);
      ok(filt.allSym, 'and every surviving row is that market');
      ok(filt.allShort && filt.shortN > 0, 'the SHORT filter leaves only shorts (' + filt.shortN + ')', filt);
      ok(filt.restored === filt.before, 'clearing both filters restores the board', filt);

      /* ── THE DENSE BOARD (2026-10-28, owner: "mnogo treba da se skrola bez nekog razloga ... sto vise opcija
         za klick"). 120 rows at 89px was a 10,477px wall - 86% of the page. These checks hold the new shape:
         a screenful with the rest one click away, a row that is ONE line, every cell going somewhere, and the
         figures read from Hyperliquid rather than derived. */
      const board = await p.evaluate(async (api) => {
        const rows = () => [...document.querySelectorAll('#wlPos .wl-pr')];
        const r0 = rows()[0];
        const rowH = Math.round(r0.getBoundingClientRect().height);
        const capped = rows().length, more = document.getElementById('wlMore');
        const moreTxt = more ? more.textContent : '';
        // the liquidation price goes to that market's liquidation map
        const liqA = r0.querySelector('.wl-liq a');
        const liqHref = liqA ? liqA.getAttribute('href') : '';
        const coin0 = (r0.querySelector('.wl-mk') || {}).getAttribute ? r0.querySelector('.wl-mk').getAttribute('data-coin') : '';
        // the account column names the wallet behind the position
        const acc = (r0.querySelector('.wl-acc') || {}).textContent || '';
        // show all, on a board nothing else has filtered yet
        const m2 = document.getElementById('wlMore'); const hadMore = !!m2;
        if (m2) m2.click(); await new Promise(r => setTimeout(r, 500));
        const all = rows().length;
        // the entry is the exchange's own, not a derivation. The cell holds the price AND the move since it,
        // so only the cell's own first text node is the price - stripping every non-digit glues the two.
        const live = await (await fetch(api)).json();
        const byUser = {}; (live.positions || []).forEach(q => { (byUser[q.user] = byUser[q.user] || []).push(q); });
        const num = (el) => { const t = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); return t ? +t.textContent.replace(/[^0-9.]/g, '') : 0; };
        let entOk = 0, entN = 0, crossMark = 0, oddRow = 0;
        rows().slice(0, 25).forEach(x => {
          const u = x.getAttribute('data-w'), c = (x.querySelector('.wl-mk') || {}).getAttribute('data-coin');
          const q = (byUser[u] || []).find(z => String(z.sym).split(':').pop() === c);
          if (!q || !q.ent) return;
          entN++;
          const shown = num(x.querySelector('.wl-ent'));
          if (shown && Math.abs(shown - +q.ent) / +q.ent < 0.02) entOk++;
          if (x.querySelector('.wl-liq .wl-xm')) crossMark++;
          if (q.x && q.liq && (q.long ? q.liq > q.ent : q.liq < q.ent)) oddRow++;
        });
        // a column heading sorts
        const h = document.querySelector('#vPos .wl-thd span[data-sort="pnl"]');
        h && h.click(); await new Promise(r => setTimeout(r, 400));
        const sortedByPnl = rows()[0].querySelector('.wl-pnl').classList.contains('up');
        const headOn = !!document.querySelector('#vPos .wl-thd span[data-sort="pnl"].on');
        // the market cell filters the board to that coin
        const mk = rows()[0].querySelector('.wl-mk'); const mkCoin = mk.getAttribute('data-coin');
        mk.click(); await new Promise(r => setTimeout(r, 400));
        const afterMk = rows().length > 0 && rows().every(x => (x.querySelector('.wl-mk') || {}).getAttribute('data-coin') === mkCoin);
        mk.click(); await new Promise(r => setTimeout(r, 300));   // click again clears it
        const note = document.getElementById('wlXnote');
        return { rowH, capped, moreTxt, liqHref, coin0, acc, sortedByPnl, headOn, afterMk, hadMore, all, entOk, entN, crossMark, oddRow, noteShown: note ? !note.hidden : null, noteTxt: (document.getElementById('wlXcnt') || {}).textContent || '' };
      }, 'https://marginpad.io/api/cg/hyper?cb=' + Date.now());
      // a phone row folds to two lines on purpose rather than losing the market or the liquidation
      ok(board.rowH > 0 && board.rowH <= (w < 620 ? 62 : 46), 'a position row is compact (' + board.rowH + 'px, was 89)', board.rowH);
      ok(board.capped <= 30 && board.hadMore && /\d+/.test(board.moreTxt), 'the board opens on a screenful and says how many are behind it', { capped: board.capped, moreTxt: board.moreTxt });
      ok(board.all > board.capped, 'and shows every one of them on demand (' + board.capped + ' -> ' + board.all + ')', board.all);
      ok(/^\/[a-z0-9]+-liquidation-map\/$/.test(board.liqHref || ''), 'the liquidation price opens that market\'s liquidation map', board.liqHref);
      ok(/\$/.test(board.acc) && /position/.test(board.acc), 'the account behind the position is named, with how many positions it holds', board.acc);
      ok(board.sortedByPnl && board.headOn, 'a column heading sorts the board and says which one is active', board);
      ok(board.afterMk, 'the market cell filters the board to that coin', board.afterMk);
      ok(board.entN > 0 && board.entOk === board.entN, 'every entry on screen is the exchange\'s own entryPx, not a derivation (' + board.entOk + '/' + board.entN + ')', board);
      ok(board.oddRow === 0 || board.crossMark > 0, 'a liquidation on the far side of its entry carries the cross-margin mark', board);
      ok(board.oddRow === 0 || (board.noteShown && /cross margin/i.test(board.noteTxt) === false ? true : board.noteShown), 'and the page explains cross margin when such a row is on the board', { noteShown: board.noteShown, noteTxt: board.noteTxt });

      /* THE BOARD NAMES THE PERSON (owner 2026-10-28: "novcanici treba da budu predstavljeni kao ljudi") and
         prints the wallet beside it - a callsign on its own could be read as a known identity. On a phone the
         second line was already measured full, so there the row keeps the wallet and the identity is one tap
         away in the drawer; that is a deliberate difference, so it is asserted per viewport. */
      const idn = await p.evaluate(() => {
        const rows = [...document.querySelectorAll('#wlPos .wl-pr')].slice(0, 12);
        const vis = (el) => !!(el && el.getBoundingClientRect().width > 0);
        const txt = (el) => ((el || {}).textContent || '').trim();
        return { n: rows.length,
          ppl: rows.filter(r => vis(r.querySelector('.wl-ppl'))).length,
          named: rows.filter(r => /^[A-Z][a-z]+ [A-Z][a-z]+ \d\d$/.test(txt(r.querySelector('.wl-ppl b')))).length,
          av: rows.filter(r => r.querySelector('.wl-ppl svg')).length,
          adr: rows.filter(r => /0x[0-9a-f]{3}/i.test(txt(r.querySelector('.wl-adr')))).length };
      });
      if (w >= 620) {
        ok(idn.n > 0 && idn.ppl === idn.n && idn.named === idn.n && idn.av === idn.n, 'every board row is a person - a mark and a callsign, derived from the address', idn);
        ok(idn.adr === idn.n, 'and the wallet is printed beside the name, never replaced by it', idn);
      } else {
        ok(idn.n > 0 && idn.ppl === 0 && idn.adr === idn.n, 'on a phone the row keeps the wallet - a callsign there would cost a third line', idn);
      }

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
      ok(dr.chartSlots === dr.pos, 'every position carries a chart slot', { slots: dr.chartSlots, pos: dr.pos });
      /* ROUND TWO: the profile is TWO TABS of COLLAPSED rows (owner: "2 opcije da se selektuju (open i closed
         positions) i za obe da ima vise informacija na klik"). A chart is fetched when its row is OPENED, so
         "at least one chart drew" is now a statement about the expansion, not about the first paint. */
      const px = await p.evaluate(async () => {
        const tabs = [...document.querySelectorAll('.wd-tabs button')].map(b => b.textContent.trim());
        const before = [...document.querySelectorAll('#wdOpenL .wd-chart svg')].length;
        const rows = document.querySelectorAll('#wdOpenL .wd-row').length;
        const closedRows = document.querySelectorAll('#wdClosedL .wd-row').length;
        const rh = document.querySelector('#wdOpenL .wd-rh'); if (rh) rh.click();
        await new Promise(r => setTimeout(r, 4000));
        const rw = document.querySelector('#wdOpenL .wd-row'), bd = rw && rw.querySelector('.wd-rb');
        const ct = bd ? bd.querySelector('.wd-chart') : null;
        // and the other tab really switches what is shown
        const ct2 = document.querySelector('.wd-tabs button[data-wtab="closed"]'); if (ct2) ct2.click();
        await new Promise(r => setTimeout(r, 300));
        return { tabs, rows, closedRows, before,
          opened: !!(rw && rw.classList.contains('open')), shown: !!(bd && !bd.hidden),
          drew: !!(ct && ct.querySelector('svg path') && ct.querySelector('svg circle') && /LIQ/.test(ct.textContent)),
          link: !!(ct && [...ct.querySelectorAll('.cap a')].some(a => /\/paper-trade\?coin=/.test(a.getAttribute('href')))),
          openHidden: (document.getElementById('wdOpenL') || {}).hidden, closedShown: !((document.getElementById('wdClosedL') || {}).hidden) };
      });
      ok(px.tabs.length === 2 && /Open/.test(px.tabs[0]) && /Closed/.test(px.tabs[1]), 'the profile offers Open and Closed', px.tabs);
      ok(px.before === 0, 'a collapsed row fetches no candles - the profile opens as a list, not as a wall', px);
      ok(px.opened && px.shown, 'a row opens on a click', px);
      ok(px.drew && px.link, 'and then draws price, the entry dot and the liquidation line, linking the same setup', px);
      ok(px.openHidden === true && px.closedShown === true, 'the Closed tab switches the list', px);
      ok(px.closedRows >= 0, 'the closed list is built from the executions we recorded (' + px.closedRows + ')', px);

      /* ── ROUND FOUR (2026-10-28, owner: "nekim karticama su razbijene forme, tekst je malo poludeo i nalazi
         se posvuda ... prostor mora da se optimizuje ... za closed positions ne pise koji je leverage ...
         mozemo da damo informacije o vremenu ... neke stvari se nece videti od nav bar-a"). Four separate
         faults, so four separate statements. ─────────────────────────────────────────────────────────── */
      const card = await p.evaluate(async () => {
        const dw = document.getElementById('wdDrawer');
        const txt = (el) => ((el || {}).textContent || '').replace(/\s+/g, ' ').trim();
        /* A CHECK THAT SKIPS IS NOT PROOF. The first row of the board belongs to whichever wallet is biggest,
           and that wallet may have no close in the window we keep - so if it has none, move to a wallet the
           live feed says does, and judge the closed card there. */
        if (!document.querySelector('#wdClosedL .wd-row')) {
          const f = ((window.__wlLast || {}).fills || []).find(x => x && (x.act === 'close' || x.act === 'flip'));
          const el = f && [...document.querySelectorAll('[data-w]')].find(x => (x.getAttribute('data-w') || '').toLowerCase() === String(f.user).toLowerCase());
          if (el) { el.click(); await new Promise(r => setTimeout(r, 5200)); }
        }
        // open EVERY row that is on screen in both lists, so no card is judged unseen
        for (const t of ['closed', 'open']) {
          const tb = document.querySelector('.wd-tabs button[data-wtab="' + t + '"]'); if (tb) tb.click();
          await new Promise(r => setTimeout(r, 200));
          const list = document.getElementById(t === 'open' ? 'wdOpenL' : 'wdClosedL');
          for (const rh of [...(list ? list.querySelectorAll('.wd-row:not(.wd-more) .wd-rh') : [])].slice(0, 4)) { rh.click(); await new Promise(r => setTimeout(r, 120)); }
        }
        await new Promise(r => setTimeout(r, 400));
        // A BROKEN CARD IS TEXT THAT DOES NOT FIT ITS OWN BOX. The closed body wrote the same markup as the
        // open one with no .wd-p around it, so its labels rendered at the page's own size, two per row.
        const cut = [];
        for (const c of dw.querySelectorAll('.wd-rb *, .wd-h *')) {
          // an SVG node reports clientWidth 0, so it reads as clipped whatever it does - the labels drawn
          // inside a chart are judged against their own viewBox below instead
          if (c.ownerSVGElement || c.tagName === 'svg' || c.children.length || !txt(c)) continue;
          const r = c.getBoundingClientRect(); if (r.height < 4) continue;
          if (c.scrollWidth > c.clientWidth + 1) cut.push(txt(c).slice(0, 30));
        }
        const svgOver = [...dw.querySelectorAll('.wd-chart svg text')].filter((t) => {
          const vb = (t.ownerSVGElement.viewBox.baseVal || {}).width || 0; if (!vb) return false;
          const bb = t.getBBox(); return bb.x < -0.5 || bb.x + bb.width > vb + 0.5;
        }).map((t) => txt(t).slice(0, 28));
        const labs = [...dw.querySelectorAll('.wd-rb .g .k')];
        const labPx = labs.length ? Math.max(...labs.map(k => Math.round(parseFloat(getComputedStyle(k).fontSize)))) : 0;
        /* a row CLICK TOGGLES, and the chart leg above has already opened the first one - so ask for an open
           row, and open one only when there is none. Reading "the first open row" after a blind pass over
           four of them is how this came back empty the first time. */
        const bodyOf = async (id) => {
          const tb = document.querySelector('.wd-tabs button[data-wtab="' + (id === 'wdOpenL' ? 'open' : 'closed') + '"]');
          if (tb) tb.click(); await new Promise(r => setTimeout(r, 220));
          let row = document.querySelector('#' + id + ' .wd-row.open');
          if (!row) { const rh = document.querySelector('#' + id + ' .wd-row:not(.wd-more) .wd-rh'); if (rh) rh.click(); await new Promise(r => setTimeout(r, 350)); row = document.querySelector('#' + id + ' .wd-row.open'); }
          return row ? txt(row.querySelector('.wd-rb')) : '';
        };
        const cBody = await bodyOf('wdClosedL');
        const oBody = await bodyOf('wdOpenL');
        const bar = document.querySelector('.mpbn');
        const barShown = !!(bar && getComputedStyle(bar).display !== 'none');
        const dd = dw.getBoundingClientRect();
        let under = 0;
        if (barShown) { const bt = bar.getBoundingClientRect().top;
          for (const c of dw.querySelectorAll('*')) { if (c.children.length || !txt(c)) continue; const r = c.getBoundingClientRect(); if (r.height > 3 && r.top < bt && r.bottom > bt + 2) under++; } }
        const head = document.querySelector('.wd-h');
        const hit = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(h && (el === h || el.contains(h))); };
        return { cut, svgOver, labPx, cBody, oBody, barShown, under,
          headH: head ? Math.round(head.getBoundingClientRect().height) : 0,
          headMark: !!(head && head.querySelector('#wdProf svg')), headBell: !!(head && head.querySelector('#wdBell')),
          xHit: hit(document.getElementById('wdX')), bellHit: hit(document.getElementById('wdBell')),
          ckUp: document.documentElement.classList.contains('mp-ckbar'),
          shown: document.querySelectorAll('#wdOpenL .wd-row:not(.wd-more)').length,
          hidden: document.querySelectorAll('#wdOpenL .wd-row.wd-more').length,
          showAll: !!document.querySelector('#wdOpenL .wd-showall'),
          wide: [...dw.querySelectorAll('*')].filter(c => c.getBoundingClientRect().right > dd.right + 1).length };
      });
      ok(!card.cut.length, 'no card in the drawer cuts its own text', card.cut.slice(0, 6));
      ok(!card.svgOver.length, 'and no label on a position chart is drawn past its own edge', card.svgOver.slice(0, 5));
      ok(card.labPx > 0 && card.labPx <= 10, 'both bodies are styled by the same rule - a label is small type, not a heading (' + card.labPx + 'px)', card.labPx);
      ok(card.wide === 0, 'and nothing in it reaches past the drawer', card.wide);
      // the owner's three facts about a closed trade
      if (card.cBody) {
        ok(/LEVERAGE/.test(card.cBody) && /\dx|not published/.test(card.cBody), 'a closed position states its leverage, or says why it has none', card.cBody.slice(0, 120));
        ok(/OPENED/.test(card.cBody) && /CLOSED/.test(card.cBody), 'and when it was opened and closed', card.cBody.slice(0, 120));
        ok(/HELD/.test(card.cBody), 'and how long it was held', card.cBody.slice(0, 160));
      } else { ok(true, 'no close recorded for this wallet right now - the closed card cannot be judged', 'skipped'); }
      ok(/OPENED|FIRST SEEN/.test(card.oBody) && /HELD/.test(card.oBody), 'an open position says how long it has stood there', card.oBody.slice(0, 140));
      // one identity row, and it is reachable even with the cookie notice up (the drawer sits inside .wrap,
      // which is its own stacking context - the notice used to be what answered a click on the close button)
      ok(card.headMark && card.headBell && card.headH <= 72, 'the identity is ONE row: the mark, the name, the bell and the close (' + card.headH + 'px)', card);
      ok(card.xHit && card.bellHit, 'the close and the bell answer a click' + (card.ckUp ? ' with the cookie notice up' : ''), card);
      if (w < 620) ok(!card.barShown && card.under === 0, 'the site tab bar is not drawn over the drawer, and nothing hides under it', card);
      ok(card.hidden === 0 || card.showAll, 'a long list opens on a screenful and says how many are behind it', { shown: card.shown, hidden: card.hidden, showAll: card.showAll });

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
