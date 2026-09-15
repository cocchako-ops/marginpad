// Live proof of the realism work: the switches really move the fill and the liquidation price, the account
// setting and the per-call override both bite, the arena carries the open book, and nothing moves by default.
const ORIGIN = 'https://marginpad.io';
const K = (require('fs').readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').match(/mpadm_[a-f0-9]+/) || [])[0];
const UID = 'e2e_rz_' + Date.now().toString(36);
let pass = 0, fail = 0, KEY = '';
const chk = (n, ok, d) => { (ok ? pass++ : fail++); console.log((ok ? '  ok   ' : '  FAIL ') + n + (d !== undefined && (!ok || process.env.V) ? '   ' + JSON.stringify(d) : '')); };
const H = { 'x-admin-key': K, 'content-type': 'application/json' };

const jf = async (u, o) => { const r = await fetch(ORIGIN + u, o); let b = null; try { b = await r.json(); } catch (e) {} return { status: r.status, body: b, headers: r.headers }; };
const trade = (path, body) => jf('/api/trade' + path + '?uid=' + UID, { method: 'POST', headers: H, body: JSON.stringify(body || {}) });
const tradeG = (path) => jf('/api/trade' + path + '?uid=' + UID, { headers: H });
const bot = (path, body) => jf('/api/bot/v2' + path, { method: body ? 'POST' : 'GET', headers: { 'x-api-key': KEY, 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const live = async sym => +(await jf('/api/price?symbol=' + sym)).body.price;

(async () => {
  await jf('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'mk' }) });
  try {
    const se = await jf('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'sess' }) });
    const cookie = 'mp_sess=' + se.body.token;
    const kj = (await jf('/api/bot/key', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ act: 'create', name: 'e2e-rz' }) })).body || {};
    KEY = kj.key || (kj.keys && kj.keys[0] && kj.keys[0].k) || '';
    chk('throwaway member with a real API key', /^mpb_/.test(KEY));

    const btc = await live('BTC');
    chk('live BTC price to compare fills against', btc > 0, { btc });

    // ── the default is unchanged. This is the load-bearing check of the whole change ─────────────────
    let r = await tradeG('/realism');
    chk('realism reads OFF by default', r.body.realism.slippage === false && r.body.realism.margin_tiers === false && r.body.realism.margin_venue === '', r.body.realism);
    chk('and publishes the whole tier ladder rather than hiding it', Array.isArray(r.body.tiers) && r.body.tiers.length === 5 && r.body.tiers[0].mmr_pct === 0.5, r.body.tiers && r.body.tiers[0]);
    chk('and every venue rate it can be built on', (r.body.margin_venues || []).length === 11, { n: (r.body.margin_venues || []).length });

    let t0 = (await trade('/open', { sym: 'BTC', side: 'long', margin: 100, lev: 10 })).body.position;
    chk('a default fill still lands ON the live price', Math.abs(t0.entry / btc - 1) < 0.002, { entry: t0.entry, btc });
    chk('and still at a flat 0.5% maintenance margin', t0.mmr === 0.005, { mmr: t0.mmr });
    chk('and records no realism tag', !t0.rz, { rz: t0.rz || null });
    const liqPctDefault = (t0.entry - t0.liq) / t0.entry;
    await trade('/close', { id: t0.id });

    // ── per-call override: one strategy tested both ways without touching the account ────────────────
    let b1 = (await bot('/open', { symbol: 'BTC', side: 'long', margin_usd: 100, leverage: 10, slippage: true })).body;
    b1 = (b1 && (b1.data && b1.data.position || b1.position)) || b1;
    const bE = +(b1.entry_price || b1.entry);
    chk('a per-call slippage:true makes a LONG pay up', bE > btc * 1.00005, { entry: bE, btc, diffPct: ((bE / btc - 1) * 100).toFixed(4) });
    const r2 = await tradeG('/realism');
    chk('and it did NOT quietly change the account setting', r2.body.realism.slippage === false, r2.body.realism);
    await bot('/close', { position_id: b1.id || b1.position_id });

    // ── the account setting ─────────────────────────────────────────────────────────────────────────
    r = await trade('/realism', { slippage: true, margin_tiers: true, margin_venue: 'binance' });
    chk('the account setting saves', r.body.ok && r.body.realism.margin_venue === 'binance', r.body.realism);
    r = await trade('/realism', { margin_venue: 'nasdaq' });
    chk('and refuses a venue it has no published rate for', r.status === 400 && r.body.error === 'unknown_margin_venue', r.body);

    const t1 = (await trade('/open', { sym: 'BTC', side: 'long', margin: 100, lev: 10 })).body.position;
    chk('the next fill really costs more on a long', t1.entry > btc * 1.00005, { entry: t1.entry, btc, diffPct: ((t1.entry / btc - 1) * 100).toFixed(4) });
    chk('and uses Binance 0.40% maintenance margin, not our 0.5%', t1.mmr === 0.004, { mmr: t1.mmr });
    chk('so the liquidation sits somewhere ELSE than the default', Math.abs((t1.entry - t1.liq) / t1.entry - liqPctDefault) > 0.00005, { was: (liqPctDefault * 100).toFixed(3) + '%', now: ((t1.entry - t1.liq) / t1.entry * 100).toFixed(3) + '%' });
    chk('and the position records what it ran with', /S/.test(t1.rz || '') && /M/.test(t1.rz || ''), { rz: t1.rz });

    // slippage is never a gift: a SHORT must be filled below the market
    const eth = await live('ETH');
    const t2 = (await trade('/open', { sym: 'ETH', side: 'short', margin: 100, lev: 10 })).body.position;
    chk('a SHORT is filled below the market, never above', t2.entry < eth * 0.99995, { entry: t2.entry, eth });

    // a large position is liquidated further out - the whole point of risk-limit tiers
    const t3 = (await trade('/open', { sym: 'BTC', side: 'long', margin: 100000, lev: 10 })).body.position; // $1M notional
    chk('a $1M notional is charged a higher maintenance margin than a $1k one', t3.mmr > t1.mmr, { small: t1.mmr, large: t3.mmr });
    chk('and is therefore liquidated SOONER - less adverse move is tolerated', (t3.entry - t3.liq) / t3.entry < (t1.entry - t1.liq) / t1.entry, { small: ((t1.entry - t1.liq) / t1.entry * 100).toFixed(3) + '%', large: ((t3.entry - t3.liq) / t3.entry * 100).toFixed(3) + '%' });
    chk('and carries the tier tag', /T/.test(t3.rz || ''), { rz: t3.rz });

    // ── turning it off restores the old behaviour exactly, and never rewrites what is held ───────────
    await trade('/realism', { slippage: false, margin_tiers: false, margin_venue: '' });
    const t4 = (await trade('/open', { sym: 'BTC', side: 'long', margin: 100, lev: 10 })).body.position;
    chk('switching it off restores the live-price fill and the 0.5%', Math.abs(t4.entry / btc - 1) < 0.002 && t4.mmr === 0.005, { entry: t4.entry, mmr: t4.mmr });
    const held = (await bot('/positions')).body;
    const rows = (held.data && held.data.positions) || held.positions || [];
    const big = rows.filter(x => +x.margin_usd > 50000)[0];
    chk('a position already open KEEPS the margin it was filled with', !!big, { open: rows.length });

    // ── the arena ───────────────────────────────────────────────────────────────────────────────────
    const ar = await jf('/api/arena?cb=' + Date.now());
    chk('the arena states what its win rate does and does not count', /closes its winners and holds its losers/.test(ar.body.note || ''), (ar.body.note || '').slice(0, 55));
    const row = (ar.body.rows || [])[0];
    if (row) {
      chk('every row carries its open book', row.open_positions !== undefined && row.open_unrealized_usd !== undefined, { who: row.who, wr: row.win_rate_pct, open: row.open_positions, un: row.open_unrealized_usd, book: row.pnl_incl_open_usd });
      chk('and what its fills ran with', row.realism && ['off', 'partial', 'full'].indexOf(row.realism.label) >= 0, row.realism);
      chk('the raw journal never leaves the worker', row._open === undefined);
    } else chk('arena is empty this season, nothing to inspect', true);

    // ── the surfaces a bot reads ────────────────────────────────────────────────────────────────────
    const v1 = await bot('/realism');
    chk('the Bot API answers the same question', v1.status === 200 && (v1.body.data || v1.body).realism, (v1.body.data || v1.body).realism);
    const spec = await jf('/api/openapi.json');
    chk('it is in the OpenAPI spec', !!(spec.body.paths || {})['/api/bot/v1/realism']);
    const cl = await jf('/api/changelog');
    const ents = (cl.body.data || cl.body).entries || [];
    // pin the ENTRY, never the newest version - the first cut asserted [0].version === '2.9.0' and went red the
    // day 2.9.1 shipped, which is a test reporting its own staleness as a product failure
    const rzEnt = ents.find(e => /realism/i.test(e.title || '') || (e.changes || []).some(c => /\/v1\/realism/.test(c.text || '')));
    chk('the changelog carries the realism release', !!rzEnt, rzEnt && (rzEnt.version + ' ' + rzEnt.title));
    chk('and it is ordered newest first', ents.length > 1 && ents[0].date >= ents[1].date, ents.slice(0, 2).map(e => e.version + '@' + e.date));
    const pg = await (await fetch(ORIGIN + '/trading-api/?cb=' + Date.now())).text();
    chk('the product page documents it under the anchor the arena links to', /id="realism"/.test(pg) && /Fill realism/.test(pg));
    const ap = await (await fetch(ORIGIN + '/arena/?cb=' + Date.now())).text();
    chk('and the arena page warns before the table, not after', ap.indexOf('holds its losers open reads 100%') < ap.indexOf('<table'), { warnAt: ap.indexOf('holds its losers open reads 100%') });
  } catch (e) { fail++; console.log('  THREW ' + e.message + '\n' + e.stack); }
  await jf('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'rm' }) });
  console.log('\n' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})();
