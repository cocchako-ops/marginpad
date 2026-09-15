/* A SERVER-OWNED POSITION PAST ITS LIQUIDATION PRICE MUST CLOSE (2026-09-16, owner: "zasto mi se pozicije ne
   zatvaraju nakon sto su presle liq cenu ... ovo je kritican bug", with a screenshot of four XRP shorts at 500-800x
   all sitting past liq at -99%).

   The client is right to refuse to liquidate a srv/bot position itself - only the server can confirm one. The bug was
   that the branch which refuses set window.__mpSrvLiq and NOTHING READ IT, so the trader waited for the ten-minute
   cron while looking at a ticket that should already be gone. It now calls /api/trade/nudge, which re-sweeps that one
   account from the server's own prices and candles.

   This proves the server half end to end on a throwaway account: a position past its liq closes as a liquidation at
   the liq price for the full margin, and - the load-bearing half - a position that is NOT past its liq is left alone.
   node build/liqsweep-e2e.js                                                                                        */
'use strict';
const fs = require('fs'), path = require('path');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const j = async (p, opt) => { const r = await fetch(O + p, opt); let b = null; try { b = await r.json(); } catch (e) {} return { s: r.status, b }; };
const AK = { 'x-admin-key': K, 'content-type': 'application/json' };

(async () => {
  const uid = 'e2eliq' + Date.now().toString(36);
  await j('/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) });
  ok(true, 'test member minted (' + uid + ')');

  const openOne = async (side, lev) => {
    const r = await j('/api/trade/open?uid=' + uid, { method: 'POST', headers: AK, body: JSON.stringify({ sym: 'BTC', side, lev, margin: 100, cid: 'e2eliq' + Math.random().toString(36).slice(2, 9) }) });
    return r;
  };
  const journal = async () => (await j('/api/admin/journal?uid=' + uid, { headers: AK })).b;
  const openRows = async () => { const d = await journal(); return ((d && (d.rows || d.journal || d.trades)) || []).filter(x => x.status === 'open'); };

  const a = await openOne('short', 50);
  ok(a.s === 200 && a.b && !a.b.error, 'a 50x short opened server-side (' + a.s + ' ' + JSON.stringify(a.b && (a.b.error || a.b.id || '')).slice(0, 60) + ')');
  let rows = await openRows();
  ok(rows.length === 1, 'it is open on the server (' + rows.length + ')');
  const pos = rows[0];
  const liq = +pos.liq, entry = +pos.entry;
  ok(liq > entry, 'a short liquidates ABOVE its entry (entry ' + entry + ', liq ' + liq + ')');

  // 1. price still SHORT of the liq - nothing may close. This is the half that matters: a sweep that closes
  //    everything it looks at would pass a naive "does it close?" test and destroy real positions.
  const below = liq * 0.999;
  const s1 = await j('/api/admin/sweeptest?uid=' + uid + '&px=BTC:' + below.toFixed(2), { headers: AK });
  ok(s1.s === 200 && s1.b && s1.b.swept === 0, 'a price just short of the liq sweeps nothing (swept ' + (s1.b && s1.b.swept) + ')');
  ok((await openRows()).length === 1, 'and the position is still open');

  // 2. price past the liq - it must close, as a liquidation, at the liq price, for the whole margin
  const above = liq * 1.001;
  const s2 = await j('/api/admin/sweeptest?uid=' + uid + '&px=BTC:' + above.toFixed(2), { headers: AK });
  ok(s2.s === 200 && s2.b && s2.b.swept === 1, 'a price past the liq sweeps it (swept ' + (s2.b && s2.b.swept) + ')');
  const after = (await journal());
  const all = (after && (after.rows || after.journal || after.trades)) || [];
  const closed = all.find(x => String(x.id) === String(pos.id));
  ok((await openRows()).length === 0, 'nothing is left open');
  ok(closed && closed.status === 'loss', 'the trade is booked as a loss (' + (closed && closed.status) + ')');
  ok(closed && closed.liquidated === true, 'and flagged as a liquidation');
  ok(closed && Math.abs(+closed.exit - liq) < Math.max(0.01, liq * 1e-6), 'it exits AT the liquidation price, not at the price that triggered it (' + (closed && closed.exit) + ' vs ' + liq + ')');
  ok(closed && Math.round(+closed.pnl) === -100, 'the loss is the whole margin, never more (' + (closed && closed.pnl) + ')');

  // 3. the same for a long, so the sign is not backwards in one direction only
  const bres = await openOne('long', 50);
  ok(bres.s === 200, 'a 50x long opened');
  rows = await openRows();
  const lp = rows[0];
  ok(rows.length === 1 && +lp.liq < +lp.entry, 'a long liquidates BELOW its entry (entry ' + lp.entry + ', liq ' + lp.liq + ')');
  const s3 = await j('/api/admin/sweeptest?uid=' + uid + '&px=BTC:' + (+lp.liq * 1.001).toFixed(2), { headers: AK });
  ok(s3.b && s3.b.swept === 0, 'a price ABOVE a long’s liq leaves it alone (swept ' + (s3.b && s3.b.swept) + ')');
  const s4 = await j('/api/admin/sweeptest?uid=' + uid + '&px=BTC:' + (+lp.liq * 0.999).toFixed(2), { headers: AK });
  ok(s4.b && s4.b.swept === 1, 'a price below it liquidates it (swept ' + (s4.b && s4.b.swept) + ')');

  // 4. THE HALF THAT WAS ACTUALLY BROKEN: does the terminal ASK? The client must never liquidate a server-owned
  //    position itself, and it did not - it set window.__mpSrvLiq, which nothing in the codebase ever read, so the
  //    trader waited for the ten-minute cron. It now calls /api/trade/nudge. The same run proves the safety property
  //    that makes this safe to do: the page's price is faked here, the server fetches the REAL one, and refuses.
  if (!process.argv.includes('--no-browser')) {
    const se = await j('/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'sess' }) });
    const tok = se.b && (se.b.token || se.b.sess || se.b.mp_sess);
    const o3 = await openOne('short', 50);
    const rows3 = await openRows();
    const p3 = rows3[0];
    ok(o3.s === 200 && !!p3 && !!tok, 'a fresh short and a member session for the browser leg');
    let res = { n: 0 };
    try {
      const { withBrowser } = require('./e2e-browser.js');
      await withBrowser(async (browser) => {
        const page = await browser.newPage();
        await page.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' });
        await page.evaluateOnNewDocument(() => {
          window.__nudges = [];
          const real = window.fetch;
          window.fetch = function (u, o) { try { if (String(u).indexOf('/api/trade/nudge') >= 0) window.__nudges.push(String((o && o.body) || '')); } catch (e) {} return real.apply(this, arguments); };
        });
        await page.goto(O + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
        await new Promise(r => setTimeout(r, 6000));
        const past = +p3.liq * 1.0005;
        for (let i = 0; i < 10; i++) {   // hold it past the liq: the client arms a liquidation over 2 consecutive ticks
          await page.evaluate((p) => { if (window.mpLivePrices) window.mpLivePrices.BTC = { p: p, t: Date.now() }; }, past);
          await new Promise(r => setTimeout(r, 900));
        }
        res = await page.evaluate(() => ({ n: window.__nudges.length, first: window.__nudges[0] || '' }));
      });
    } catch (e) { res.err = String(e && e.message || e).slice(0, 120); }
    ok(res.n > 0 && String(res.first).indexOf(String(p3.id)) >= 0, 'the terminal asks the server to settle it (' + res.n + ' nudge(s), body ' + JSON.stringify(res.first || res.err || '') + ')');
    ok((await openRows()).length === 1, 'and the server REFUSES a cross it cannot find in its own prices - the faked page price settles nothing');
  }

  await j('/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'rm' }) });
  ok(true, 'test member removed');
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
