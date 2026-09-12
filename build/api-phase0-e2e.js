/* Bot API plan, Phase 0 E2E (2026-09-12). Proves on prod:
     - out-of-range input is refused with a named error (leverage_max carries the market's cap), never clamped
     - the stream answers a wrong parameter name with a hint, and accepts key= as an alias
     - /api/changelog.xml is a valid RSS feed of the API changelog, /api/changelog.json its JSON twin
     - /api/status returns live checks + a 90-day series, and /status/ renders them (browser, reachable)
     - /api-docs/ renders the OpenAPI reference (browser) with the spec loaded
   Run: node build/api-phase0-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jget = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})), headers: r.headers });
const post = (p, b) => fetch(ORIGIN + p, { method: 'POST', headers: H, body: JSON.stringify(b || {}) }).then(jget);
const out = []; const chk = (n, ok, x) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 260) : '')); console.log(out[out.length - 1]); };
const UID = 'e2eph0' + Math.random().toString(36).slice(2, 6);
(async () => {
  let KEY = '';
  try {
    await post('/api/admin/e2euser', { uid: UID, op: 'mk' }); const se = await post('/api/admin/e2euser', { uid: UID, op: 'sess' });
    const kj = await (await fetch(ORIGIN + '/api/bot/key', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + se.body.token }, body: JSON.stringify({ act: 'create', name: 'ph0' }) })).json(); KEY = kj.key || '';
    chk('throwaway member + key', !!KEY);
    const bot = (p, b) => fetch(ORIGIN + '/api/bot/v1' + p, { method: b ? 'POST' : 'GET', headers: { 'x-api-key': KEY, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(jget);
    const lm = await bot('/open', { symbol: 'BTC', side: 'long', leverage: 5000, margin_usd: 10 });
    chk('leverage 5000 on BTC -> 400 leverage_max with the cap, nothing opened', lm.status === 400 && lm.body.error === 'leverage_max' && lm.body.max === 1000 && lm.body.requested === 5000, lm.body);
    let lm2 = null; for (const sy of ['ADA', 'LINK', 'SUI', 'ORDI', 'ARB']) { const r = await bot('/open', { symbol: sy, side: 'short', leverage: 999, margin_usd: 10, dry_run: true }); if (r.status === 400 && r.body.error === 'leverage_max') { lm2 = r; break; } } // the majors allow 1000x; a thinner market carries a lower cap
    chk('dry_run refuses the same way on a market whose cap is below 1000', !!lm2 && lm2.body.max < 1000 && lm2.body.requested === 999, lm2 && lm2.body);
    const lz = await bot('/open', { symbol: 'BTC', side: 'long', leverage: 0.5, margin_usd: 10 });
    chk('leverage 0.5 -> leverage_min', lz.status === 400 && lz.body.error === 'leverage_min', lz.body);
    const ok = await bot('/open', { symbol: 'BTC', side: 'long', leverage: 1000, margin_usd: 10, dry_run: true });
    chk('leverage exactly at the cap still works (dry run)', ok.status === 200 && ok.body.ok && ok.body.position && ok.body.position.leverage === 1000, { status: ok.status, lev: ok.body.position && ok.body.position.leverage });
    const pos = await bot('/positions'); chk('nothing was opened by the refused calls', pos.status === 200 && (pos.body.positions || []).length === 0, { n: (pos.body.positions || []).length });
    // stream: wrong parameter name -> hint; key= alias works
    const s401 = await fetch(ORIGIN + '/api/bot/v2/stream?nokey=1').then(jget);
    chk('stream without a key: 401 with a hint that names api_key', s401.status === 401 && /api_key/.test(String(s401.body.error && s401.body.error.message || s401.body.hint || '')), s401.body);
    try { const WebSocket = require('ws'); const got = await new Promise(res => { const ws = new WebSocket('wss://marginpad.io/api/bot/v2/stream?key=' + KEY); let n = 0; ws.on('message', () => { n++; if (n >= 1) { ws.close(); res(n); } }); ws.on('error', () => res(-1)); setTimeout(() => { try { ws.close(); } catch (e) {} res(n); }, 8000); });
      chk('stream accepts key= as an alias (welcome frame arrives)', got >= 1, { frames: got }); } catch (e) { chk('stream alias check skipped (ws module missing)', true, e.message); }
    // changelog feeds
    const rss = await fetch(ORIGIN + '/api/changelog.xml?cb=' + Date.now()); const xml = await rss.text();
    chk('/api/changelog.xml is RSS with items and the current version', rss.status === 200 && /<rss/.test(xml) && /<item>/.test(xml) && /2\.4\.0/.test(xml) && /application\/rss\+xml/.test(rss.headers.get('content-type') || ''), { status: rss.status, ct: rss.headers.get('content-type'), items: (xml.match(/<item>/g) || []).length });
    const cj = await fetch(ORIGIN + '/api/changelog.json').then(jget); chk('/api/changelog.json carries the same list', cj.status === 200 && cj.body.ok && Array.isArray(cj.body.data.changelog) && cj.body.data.changelog[0].version, { first: cj.body.data && cj.body.data.changelog[0] && cj.body.data.changelog[0].version });
    // status api
    const st = await fetch(ORIGIN + '/api/status?cb=' + Date.now()).then(jget);
    chk('/api/status: live checks + 90-day series', st.status === 200 && st.body.ok && st.body.now && st.body.now.collector && Array.isArray(st.body.days) && st.body.days.length === 90, { cron: st.body.now && st.body.now.cron, coll: st.body.now && st.body.now.collector && st.body.now.collector.connected, days: st.body.days && st.body.days.length, today: st.body.days && st.body.days[89] });
    await withBrowser(async (browser) => {
      for (const [w, h, label] of [[1366, 900, 'desktop'], [390, 780, 'phone']]) {
        const page = await browser.newPage(); await page.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
        const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
        await page.goto(ORIGIN + '/status/?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await sleep(4000);
        const m = await page.evaluate(() => { const ov = document.getElementById('ovT'); const bars = document.querySelectorAll('#bStore i').length; const cards = document.querySelectorAll('#cards .c').length; const venues = document.querySelectorAll('#venues tr').length; const r = ov.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + 5, r.top + r.height / 2); return { ov: ov.textContent, bars, cards, venues, reach: !!hit && (hit === ov || ov.contains(hit) || hit.closest('.overall') != null), sw: document.documentElement.scrollWidth, iw: innerWidth }; });
        chk(label + ': /status/ renders the verdict, 4 cards, 90 bars and the venue table, no sideways scroll', /operational|degraded/i.test(m.ov) && m.cards === 4 && m.bars === 90 && m.venues >= 5 && m.reach && m.sw <= m.iw, m);
        chk(label + ': /status/ no page errors', errs.length === 0, errs.slice(0, 2));
        await page.close();
      }
      const page = await browser.newPage(); await page.setViewport({ width: 1366, height: 900 });
      await page.goto(ORIGIN + '/api-docs/?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await sleep(9000);
      const d = await page.evaluate(() => ({ ops: document.body.innerText.match(/\/api\/bot\/v1\/open|\/api\/v1\/liquidations/g) ? true : false, scalar: !!document.querySelector('.scalar-app, .references-layout, [class*="scalar"]'), fb: !(document.getElementById('fb') || { hidden: true }).hidden, len: document.body.innerText.length }));
      chk('/api-docs/ renders the OpenAPI reference with the Bot API routes', d.scalar && d.ops && !d.fb, d);
      await page.close();
    }, { timeoutMs: 240000 });
  } finally { try { await post('/api/admin/e2euser', { uid: UID, op: 'rm' }); } catch (e) {} }
  const bad = out.filter(l => l.slice(0, 4) === 'FAIL').length; console.log('\n' + out.length + ' checks, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
})();
