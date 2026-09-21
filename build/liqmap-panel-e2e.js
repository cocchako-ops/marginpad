/* liqmap-panel-e2e - the live panel on the 32 liquidation-map SEO pages.

   These pages were prose with a link for years. The panel (ssrLiqMapPanel in worker.js) gives them the
   live price, the 24h liquidation dollars our own collector watched, a ladder of the standing zones at
   true relative scale, and the two exchange buttons. It shipped on 2026-09-21 with NO test, and within
   hours it was found painting the zones in the OPPOSITE colours to the live heatmap those same pages
   link to: green above the price, where shorts get liquidated, red below. A reader met the same zone in
   one colour here and the other colour one tap later. That is exactly the class of defect a suite catches
   and a screenshot review does not, so the colour convention is the load-bearing check here.

   Everything is read from the RAW HTML, as a crawler sees it - a figure that arrives after a fetch is a
   figure no assistant will ever cite, and SSR is the whole point of this panel.

   Checks:
     - the panel is server-rendered into every page, with all four tiles carrying real numbers
     - price and 24h liquidations agree with the APIs they are drawn from
     - ABOVE is red and BELOW is green, matching mp-heatmap's long=green / short=red - the site convention
     - the modelled zone ladder carries NO dollar figure (open interest overstated an average BTC band by
       ~30x what has ever really liquidated there, so a dollar on a MODEL is forbidden site-wide)
     - it says out loud which figures are measured and which are modelled
     - the CTA reaches the live map for THIS coin, and the exchange buttons are tracked and carry our codes
     - it holds on a 390px phone without pushing the page sideways

   Run: node build/liqmap-panel-e2e.js
*/
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const GRN = '#2ebd85', RED = '#ff5a4d';
const COINS = ['btc', 'eth', 'sol'];
let pass = 0, fail = 0;
const chk = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined && (!ok || process.env.V) ? '   ' + JSON.stringify(x).slice(0, 240) : '')); };
const get = async (u) => (await fetch(ORIGIN + u + (u.indexOf('?') > 0 ? '&' : '?') + 'nc=1&cb=' + Date.now())).text();
const num = (s) => (s == null ? null : +String(s).replace(/[^0-9.]/g, ''));

// The colour a header or a bar was painted in: the nearest `color:` / `background:` before the anchor.
const colourBefore = (html, i, prop) => {
  const seg = html.slice(Math.max(0, i - 220), i);
  const m = [...seg.matchAll(new RegExp(prop + ':(#[0-9a-fA-F]{6})', 'g'))];
  return m.length ? m[m.length - 1][1].toLowerCase() : null;
};

(async () => {
  console.log('\nliqmap-panel-e2e  ' + ORIGIN + '\n');

  const liqApi = await (await fetch(ORIGIN + '/api/v1/liquidations?cb=' + Date.now())).json().catch(() => null);

  for (const c of COINS) {
    const C = c.toUpperCase();
    const h = await get('/' + c + '-liquidation-map/');
    const P = (t) => C + ': ' + t;

    chk(P('the panel is server-rendered into the page'), h.indexOf('data-ssr="liqmap"') > 0);
    const iAbove = h.indexOf('where shorts get liquidated');
    const iBelow = h.indexOf('where longs get liquidated');
    chk(P('  it names both sides of the price'), iAbove > 0 && iBelow > iAbove, { iAbove, iBelow });

    // ---- the four tiles ----
    const tile = (label) => { const i = h.indexOf('>' + label + '<'); if (i < 0) return null; const m = /<div[^>]*>([^<]{1,40})<\/div>/.exec(h.slice(i)); return m ? m[1].trim() : null; };
    const pxTxt = tile('Price'), lqTxt = tile('Liquidated 24h'), lsTxt = tile('Long vs short'), chTxt = tile('24h');
    chk(P('  price, 24h move, 24h liquidations and the long/short split are all filled'),
      !!(pxTxt && lqTxt && lsTxt && chTxt) && !/--|n\/a|NaN|\$0\b/i.test([pxTxt, lqTxt, lsTxt, chTxt].join(' ')),
      { pxTxt, chTxt, lqTxt, lsTxt });

    // ---- and they agree with the sources they are drawn from ----
    const live = await (await fetch(ORIGIN + '/api/price?symbol=' + C + '&cb=' + Date.now())).json().catch(() => null);
    const lp = live && +live.price, pp = num(pxTxt);
    chk(P('  the price matches the live price within 2%'), !!(lp > 0 && pp > 0 && Math.abs(pp / lp - 1) < 0.02), { panel: pp, live: lp });

    const row = liqApi && (liqApi.data || liqApi).coins && ((liqApi.data || liqApi).coins.find((x) => String(x.symbol || x.coin).toUpperCase() === C));
    if (row) {
      const apiUsd = (+row.long || 0) + (+row.short || 0) || +row.total || 0;
      const panelUsd = num(lqTxt) * (/billion/i.test(lqTxt) ? 1e9 : /million/i.test(lqTxt) ? 1e6 : 1);
      chk(P('  the 24h liquidation dollars match our own collector within 25%'),
        !(apiUsd > 0) || (panelUsd > 0 && Math.abs(panelUsd / apiUsd - 1) < 0.25), { panel: panelUsd, api: Math.round(apiUsd) });
    }

    // ---- THE LOAD-BEARING CHECK: the colour convention the whole site uses ----
    // mp-heatmap paints a long-liquidation level green and a short-liquidation level red, the same
    // long=green / short=red as the trade form, the tickets and every board. Above the price is where
    // SHORTS die. Invert either one and a reader meets the same zone in two colours one tap apart.
    chk(P('  ABOVE (shorts) is RED, like the live map it links to'), colourBefore(h, iAbove, 'color') === RED, { got: colourBefore(h, iAbove, 'color') });
    chk(P('  BELOW (longs) is GREEN, like the live map it links to'), colourBefore(h, iBelow, 'color') === GRN, { got: colourBefore(h, iBelow, 'color') });
    const barsUp = [...h.slice(iAbove, iBelow).matchAll(/background:(#[0-9a-fA-F]{6});opacity/g)].map((m) => m[1].toLowerCase());
    const barsDn = [...h.slice(iBelow, iBelow + 4000).matchAll(/background:(#[0-9a-fA-F]{6});opacity/g)].map((m) => m[1].toLowerCase());
    chk(P('  every bar above the price is red'), barsUp.length > 0 && barsUp.every((x) => x === RED), { barsUp: [...new Set(barsUp)], n: barsUp.length });
    chk(P('  every bar below the price is green'), barsDn.length > 0 && barsDn.every((x) => x === GRN), { barsDn: [...new Set(barsDn)], n: barsDn.length });

    // ---- a model may never carry a dollar figure ----
    // Measured 2026-09-18: open interest overstated an average BTC band by ~30x what has ever really
    // liquidated in it. The ladder therefore prices a zone only as a MULTIPLE of the typical standing
    // band. Prices ($94,656) are fine - a magnitude ($12.4M) is not.
    const ladder = h.slice(iAbove, h.indexOf('modelled', iBelow) > 0 ? h.indexOf('modelled', iBelow) : iBelow + 4000);
    const money = [...ladder.matchAll(/\$[\d,.]+\s*(million|billion|[MB])\b/g)].map((m) => m[0]);
    chk(P('  the modelled ladder carries no dollar figure, only multiples'), money.length === 0, { money: money.slice(0, 4) });
    chk(P('  and it says which numbers are measured and which are modelled'), /modelled/i.test(h.slice(iBelow, iBelow + 5000)) && /collector watched/i.test(h.slice(iBelow, iBelow + 5000)));

    // ---- where it sends the reader ----
    chk(P('  the CTA opens the live map for THIS coin'), h.indexOf('/heatmap?coin=' + C) > 0);
    const exSeg = h.slice(h.indexOf('data-ssr="liqmap"'), h.indexOf('data-ssr="liqmap"') + 12000);
    // The label is what handleTrack resolves through partnerOf, which lowercases - so "Bybit" is correct
    // and this pattern must not be case-sensitive. The first cut was, found nothing, and reported six
    // failures against a panel that was working: a test can be wrong about the thing it is guarding.
    const tracked = [...exSeg.matchAll(/data-mpex="([A-Za-z0-9.]+)"/g)].map((m) => m[1].toLowerCase());
    chk(P('  the exchange buttons are tracked as money clicks'), tracked.length >= 2, { tracked });
    // The codes are NOT in the href: every partner link on the site goes through our own /go?ex= redirect,
    // which is where the referral code is attached. Asserting the code in the markup would demand the wrong
    // architecture. What must hold is that the tracked label and the redirect name the SAME partner - a
    // click labelled one venue that opens another is how attribution silently goes to the junk bucket.
    const gos = [...exSeg.matchAll(/href="\/go\?ex=([a-z]+)/g)].map((m) => m[1]);
    chk(P('  each button is labelled with the venue it actually opens'), gos.length >= 2 && gos.every((g) => tracked.indexOf(g) >= 0), { gos, tracked });
    chk(P('  and the exchange link is a DEEP link to this pair, not a home page'), exSeg.indexOf('/go?ex=bybit&sym=' + C) > 0);
  }

  // ---- the phone ----
  await withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(ORIGIN + '/btc-liquidation-map/?nc=1&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2500));
    const m = await page.evaluate(() => {
      const p = document.querySelector('[data-ssr="liqmap"]');
      const r = p && p.getBoundingClientRect();
      const wide = [...document.querySelectorAll('[data-ssr="liqmap"] *')].filter((el) => {
        const b = el.getBoundingClientRect();
        if (b.width <= innerWidth + 2) return false;
        let a = el.parentElement;
        while (a) { const s = getComputedStyle(a); if (/auto|scroll|hidden/.test(s.overflowX + s.overflow)) return false; a = a.parentElement; }
        return true;
      }).length;
      return { there: !!p, w: r ? Math.round(r.width) : 0, top: r ? Math.round(r.top + scrollY) : 0, wide, hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2 };
    });
    chk('phone: the panel renders and fits the screen', m.there && m.w > 300 && m.w <= 392, m);
    chk('phone: nothing inside it pushes the page sideways', m.wide === 0 && !m.hScroll, m);
    chk('phone: it is above the fold-and-a-half, not buried under the prose', m.top < 1300, { top: m.top });
    await page.screenshot({ path: path.join(__dirname, 'liqmap-shots', 'panel-phone.png') });
    await page.close();
  });

  console.log('\nliqmap-panel-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error('threw', e); process.exitCode = 1; });
