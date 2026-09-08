/* People > Here now E2E (2026-09-08, owner: "online now ne radi kako treba; neka bude i API i bot; kako bi izgledalo kad dodje 100-200 ljudi").
   Proves on production, against the real presence store (OpsLog DO `onmap` v2):
     WEB: a guest's pageview seeds a presence row that carries the page, source, country, device, browser, first-visit flag and
          the moment the visit began; a heartbeat on another page moves the page and keeps `first`; a click beacon becomes the
          row's "last action"; a member on two devices is ONE person with devs:2 and their username
     API: a real bot key (throwaway e2e member) calling REST shows up under API right now with the endpoint and via:rest; the same
          key through the MCP server shows via:mcp
     WAVE: 200 injected people (+ a Telegram user + a bot stream) — the endpoint answers under 2 s, groups them by page / source /
          country, counts the arrivals of the last 5 and 15 minutes with their top source, resolves the stream's account
     BROWSER (mp-ops People > Here now at #people/online/e2e): tiles, the minute strip, grouped bars, the people table capped at 100
          with "show all", the filter box and the Members chip, API + Telegram cards, a heartbeat that lands as a row WITHOUT a poll,
          phone 390 px reachability, zero console errors; the Activity strip and the Today card link to the view
   Every row is key-tagged (e2) -> hidden from the owner's real view; the run purges them at the end. Run: node build/online-e2e.js
*/
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const get = (p) => { const t0 = Date.now(); return fetch(ORIGIN + p, { headers: H }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})), ms: Date.now() - t0 })); };
const post = (p, b, hd) => fetch(ORIGIN + p, { method: 'POST', headers: Object.assign({}, H, hd || {}), body: JSON.stringify(b || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const on = () => get('/api/admin/online?e2e=1&_=' + Date.now());
const waitFor = async (fn, tries, ms) => { for (let i = 0; i < (tries || 12); i++) { let v = null; try { v = await fn(); } catch (e) {} if (v) return v; await sleep(ms || 1000); } return null; };
const TAG = Math.random().toString(36).slice(2, 8);
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 e2e-online';
const mkDid = () => 'e2e' + Math.random().toString(16).slice(2).padEnd(29, '0').slice(0, 29);
const hex32 = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x => x.toString(16).padStart(2, '0')).join('');
const beacon = (did, q, cookie) => fetch(ORIGIN + '/api/track?' + q, { headers: { cookie: 'mp_did=' + did + (cookie ? '; ' + cookie : ''), 'user-agent': UA, 'x-admin-key': K } }).then(r => r.status);
const findDi = (d, di) => (d.people || []).filter(p => p.di === di.slice(0, 8))[0] || null;

(async () => {
  // ---- 1. a guest: pageview -> presence row with substance; heartbeat moves the page; a click becomes the last action
  const D1 = mkDid(); const t0 = Date.now();
  const b1 = await beacon(D1, 't=pageview&p=%2Fseason%2F&r=https%3A%2F%2Fwww.google.com%2F');
  chk('pageview beacon accepted', b1 === 204, { b1 });
  let p1 = await waitFor(async () => findDi((await on()).body, D1), 8, 1000);
  chk('presence row from the pageview: page, source, country, device, browser, first visit, visit start', !!p1 && p1.p === '/season/' && p1.s === 'google.com' && !!p1.cc && p1.d === 'Mobile' && p1.b === 'Chrome' && p1.nv === 1 && Math.abs(p1.first - t0) < 15000 && !p1.uid, p1 && { p: p1.p, s: p1.s, cc: p1.cc, d: p1.d, b: p1.b, nv: p1.nv, dFirst: p1.first - t0 });
  const first1 = p1 ? p1.first : 0;
  await beacon(D1, 't=hb&p=%2Fpaper-trade');
  p1 = await waitFor(async () => { const p = findDi((await on()).body, D1); return p && p.p === '/paper-trade' ? p : null; }, 8, 1000);
  chk('heartbeat on another page moves the page and keeps the visit start', !!p1 && p1.p === '/paper-trade' && p1.first === first1, p1 && { p: p1.p, first: p1.first, was: first1 });
  await beacon(D1, 't=paper&e=BTC%20long%205x&p=%2Fpaper-trade');
  p1 = await waitFor(async () => { const p = findDi((await on()).body, D1); return p && p.la ? p : null; }, 8, 1000);
  chk('a click beacon becomes the row\'s last action with its time', !!p1 && p1.la === 'paper BTC long 5x' && p1.lats >= p1.first, p1 && { la: p1.la, lats: p1.lats, first: p1.first }); // server stamps on both sides (this machine's clock runs ~10 s ahead of the edge)
  // the Activity endpoint's here-now list reads the presence row (page from the heartbeat, not from a pageview) — checked BEFORE the wave, which fills it
  const A = (await get('/api/admin/activity?h=1&n=500&pv=1&e2e=1&_=' + Date.now())).body;
  const oa = (A.onlineList || []).filter(o => o.p === '/paper-trade' && (A.rows || []).some(r => r.di === D1.slice(0, 8) && r.v === o.v))[0];
  chk('Activity here-now list carries the heartbeat page, the visit start and the last action for the guest', !!oa && oa.first === first1 && /paper BTC/.test(oa.la || ''), oa || { lists: (A.onlineList || []).length, rowsWithDi: (A.rows || []).filter(r => r.di === D1.slice(0, 8)).length });

  // ---- 2. a member on two devices = one person
  const UID = hex32(), UN = 'e2e_on' + TAG, CK = 'mp_uid=' + UID + '; mp_un=' + UN;
  const D2a = mkDid(), D2b = mkDid();
  await beacon(D2a, 't=pageview&p=%2Fcharts', CK); await beacon(D2b, 't=hb&p=%2Frewards%2F', CK);
  const P2 = await waitFor(async () => { const d = (await on()).body; const rows = (d.people || []).filter(p => p.uid === UID); return rows.length && rows[0].devs === 2 ? { rows, d } : null; }, 8, 1000);
  chk('one person for one account on two devices, username from the cookie, devs:2', !!P2 && P2.rows.length === 1 && P2.rows[0].u === UN && P2.rows[0].devs === 2 && ['/charts', '/rewards/'].indexOf(P2.rows[0].p) >= 0, P2 && P2.rows.map(r => ({ u: r.u, devs: r.devs, p: r.p })));
  chk('members / guests / devices tally', !!P2 && P2.d.members >= 1 && P2.d.guests >= 1 && P2.d.devices >= P2.d.n + 1, P2 && { n: P2.d.n, members: P2.d.members, guests: P2.d.guests, devices: P2.d.devices });

  // ---- 3. API presence: a real key through REST, then through MCP
  const uidE = 'e2eon' + TAG; let key = '', sessTok = '';
  const se = await post('/api/admin/e2euser', { uid: uidE, op: 'sess' });
  sessTok = se.body.token || ''; chk('throwaway member + session minted', se.status === 200 && !!sessTok, { status: se.status, u: se.body.username });
  if (sessTok) {
    const kr = await fetch(ORIGIN + '/api/bot/key', { method: 'POST', headers: { cookie: 'mp_sess=' + sessTok, 'content-type': 'application/json' }, body: JSON.stringify({ act: 'create', name: 'e2e online' }) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    key = kr.body.key || ''; chk('bot key created', kr.status === 200 && /^mpb_/.test(key), { status: kr.status });
  }
  if (key) {
    const rr = await fetch(ORIGIN + '/api/bot/v2/balance', { headers: { 'x-api-key': key, 'x-admin-key': K } });
    chk('REST call with the key answers', rr.status === 200, { status: rr.status });
    const a1 = await waitFor(async () => { const d = (await on()).body; return ((d.api || {}).keys || []).filter(k => k.u === 'e2e_' + uidE)[0] || null; }, 8, 1000);
    chk('API right now: the key with the account, key name, endpoint, via:rest, calls this minute', !!a1 && a1.ep === 'balance' && a1.via === 'rest' && a1.kn === 'e2e online' && a1.rpm >= 1 && a1.kid.length === 6 && key.indexOf(a1.kid) === 4, a1);
    const mc = await post('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'paper_balance', arguments: {} } }, { 'x-api-key': key });
    chk('MCP tools/call with the key answers', mc.status === 200 && mc.body.result && !mc.body.result.isError, { status: mc.status, err: mc.body.result && mc.body.result.isError });
    const a2 = await waitFor(async () => { const d = (await on()).body; const k = ((d.api || {}).keys || []).filter(k => k.u === 'e2e_' + uidE)[0]; return k && k.via === 'mcp' ? k : null; }, 8, 1000);
    chk('the same key through the MCP server reads via:mcp', !!a2 && a2.via === 'mcp' && a2.ep === 'balance', a2 && { via: a2.via, ep: a2.ep, rpm: a2.rpm });
  }

  // ---- 4. the wave: 200 people at once (+ a Telegram user + a bot stream), injected e2
  const now = Date.now(), pages = ['/paper-trade', '/', '/charts', '/dolar-cripto/', '/season/'], ccs = ['BR', 'NG', 'IN', 'AR', 'US', 'RS'];
  const m = {}; for (let i = 0; i < 200; i++) m['e2w' + i.toString(36).padStart(3, '0')] = { k: 'web', p: pages[i % 5], cc: ccs[i % 6], d: i % 3 ? 'Mobile' : 'Desktop', b: i % 4 ? 'Chrome' : 'Safari', net: 'e2e carrier', s: i < 150 ? 'x.com' : 'google.com', ts: now, first: now - (i % 10) * 10000, di: 'e2wd' + i, u: i < 30 ? 'e2e_w' + TAG + i : null, uid: i < 30 ? ('e2e' + i.toString(16).padStart(29, '0')) : null, nv: i % 2 };
  m['t:99' + TAG.slice(0, 5)] = { k: 'tg', kn: 'e2e tg ' + TAG, la: 'trade', ts: now, lats: now };
  m['s:' + uidE.slice(0, 13)] = { k: 'stream', uid: uidE, n: 2, kn: 'e2e online', ts: now, lats: now };
  const inj = await post('/api/admin/online?inject=1', { m });
  chk('inject hook stores the wave (key only, forced e2)', inj.status === 200 && inj.body.ok && inj.body.n === 202, inj.body);
  await sleep(800);
  const W = await on();
  const d = W.body;
  chk('the endpoint answers a 200-person wave under 2 s', W.status === 200 && W.ms < 2000 && d.n >= 200, { ms: W.ms, n: d.n });
  chk('arrivals: 200+ in the last 5 min, top source x.com', d.arrived5 >= 200 && d.arrived15 >= 200 && (d.arrivedSrc || [])[0] && d.arrivedSrc[0].l === 'x.com' && d.arrivedSrc[0].n >= 150, { a5: d.arrived5, a15: d.arrived15, src: (d.arrivedSrc || []).slice(0, 2) });
  const bp = (d.byPage || []).filter(x => x.l === '/paper-trade')[0], bs = (d.bySrc || []).filter(x => x.l === 'x.com')[0], bc = (d.byCc || []).filter(x => x.l === 'BR')[0];
  chk('grouped by page (with the member count), source and country', !!bp && bp.n >= 40 && bp.m >= 6 && !!bs && bs.n >= 150 && !!bc && bc.n >= 33, { bp, bs, bc });
  chk('members and first-visit counts across the wave', d.members >= 30 && d.newN >= 100, { members: d.members, newN: d.newN });
  const st = ((d.api || {}).streams || []).filter(s => s.uid === uidE)[0], tg = (d.tg || []).filter(t => t.name === 'e2e tg ' + TAG)[0];
  chk('bot stream row resolved to the account (2 sockets, key name)', !!st && st.n === 2 && st.u === 'e2e_' + uidE && st.kn === 'e2e online', st);
  chk('Telegram user listed with the last command', !!tg && tg.la === 'trade' && tg.linked === null, tg);
  chk('history + usual + peak shapes present', Array.isArray(d.hist) && d.usual && typeof d.usual.n === 'number' && typeof d.usual.samples === 'number' && ('peak' in d), { hist: d.hist.length, usual: d.usual, peak: d.peak });
  chk('people list capped server-side at 600 rows, sorted most recent first', d.people.length <= 600 && d.people.length >= 200 && d.people.every((p, i, a) => i === 0 || Math.max(a[i - 1].ts, a[i - 1].lats) >= Math.max(p.ts, p.lats)), { people: d.people.length });
  // the owner's real view never sees any of this
  const R = (await get('/api/admin/online?_=' + Date.now())).body;
  chk('without ?e2e=1 the wave, the key and the Telegram user are invisible', R.n < 200 && !(R.people || []).some(p => p.di && /^e2wd/.test(p.di)) && !((R.api || {}).keys || []).some(k => k.u === 'e2e_' + uidE) && !(R.tg || []).some(t => t.name === 'e2e tg ' + TAG), { n: R.n });
  const A2 = (await get('/api/admin/activity?h=1&n=50&pv=1&e2e=1&_=' + Date.now())).body;
  chk('Activity here-now list is not cut by the wave (cap 600, so the strip\'s page counts hold at 200 people)', (A2.onlineList || []).length >= 200 && A2.online >= 200, { list: (A2.onlineList || []).length, online: A2.online });

  // ---- 5. the ops view in a browser
  const sess = await (await fetch(ORIGIN + '/api/stats/session', { method: 'POST', headers: { 'x-admin-key': K } })).json();
  chk('ops session minted', !!sess.ok);
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.setCookie({ name: 'mp_sadm', value: sess.token, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true });
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140))); page.on('console', mm => { if (mm.type() === 'error') errs.push('console: ' + mm.text().slice(0, 140)); });
    // instrumentation: when a row is late, the log says whether the socket nudged and whether the view refetched
    await page.evaluateOnNewDocument(() => { window.__fl = []; const f = window.fetch; window.fetch = function (u) { const isOn = String(u).indexOf('/api/admin/online') >= 0; if (isOn) window.__fl.push(Date.now()); const pr = f.apply(this, arguments); if (isOn) pr.then(r => { try { r.clone().json().then(j => { window.__last = j; }); } catch (e) {} }); return pr; }; window.__wsm = []; const W = window.WebSocket; window.WebSocket = function (u, p) { const s = p ? new W(u, p) : new W(u); s.addEventListener('message', m => { try { const j = JSON.parse(m.data); window.__wsm.push([Date.now(), j.pres ? 'pres' : (j.k || 'other')]); } catch (e) {} }); return s; }; });
    await page.goto(ORIGIN + '/api/stats?cb=' + Date.now() + '#people/online/e2e', { waitUntil: 'load', timeout: 60000 });
    let v = null; for (let w = 0; w < 30; w++) { await sleep(500); v = await page.evaluate(() => { const t = document.querySelectorAll('#view .tile'); if (t.length < 4) return null; const val = s => (s ? s.querySelector('.v').textContent.replace(/[^\d]/g, '') : ''); return { n: +val(t[0]), a5: +val(t[2]), api: +val(t[3]), strip: !!document.querySelector('.onsp'), bars: document.querySelectorAll('.hb-r').length, rows: document.querySelectorAll('#view table.tbl tbody tr').length, all: !!document.getElementById('onAll'), live: !!(document.getElementById('onlive') && document.getElementById('onlive').classList.contains('ok')) }; }); if (v && v.n >= 200) break; }
    chk('browser: tiles show the wave (here now >= 200, arrived in 5 min >= 200), strip + grouped bars rendered', !!v && v.n >= 200 && v.a5 >= 200 && v.strip && v.bars >= 12, v);
    chk('browser: the people table is capped at 100 with a "show all" button', !!v && v.all, v && { rows: v.rows, all: v.all });
    const peopleRows = () => page.evaluate(() => { const cards = Array.from(document.querySelectorAll('#view .card')).filter(c => /^People/.test((c.querySelector('h2') || {}).textContent || '')); const t = cards[0] && cards[0].querySelector('table.tbl tbody'); return t ? t.querySelectorAll('tr').length : -1; });
    chk('browser: 100 rows before "show all"', (await peopleRows()) === 100, { rows: await peopleRows() });
    await page.click('#onAll'); await sleep(400);
    chk('browser: "show all" renders every row', (await peopleRows()) >= 200, { rows: await peopleRows() });
    await page.type('#onq', 'e2e_w' + TAG + '1'); await sleep(500);
    const fr = await peopleRows(); chk('browser: the filter box narrows the table', fr >= 1 && fr <= 15, { rows: fr });
    await page.evaluate(() => { const q = document.getElementById('onq'); q.value = ''; q.dispatchEvent(new Event('input')); }); await sleep(500);
    await page.click('[data-who="members"]'); await sleep(400);
    const mr = await peopleRows(); chk('browser: the Members chip keeps only accounts', mr >= 30 && mr < 60, { rows: mr });
    await page.click('[data-who="all"]'); await sleep(300);
    const cards = await page.evaluate((uidE, TAG) => { const txt = Array.from(document.querySelectorAll('#view .card')).map(c => c.textContent.replace(/\s+/g, ' ')); return { api: txt.some(t => /API right now/.test(t) && t.indexOf('e2e_' + uidE) >= 0 && /bot streams/.test(t)), tg: txt.some(t => /Telegram bot right now/.test(t) && t.indexOf('e2e tg ' + TAG) >= 0 && /\/trade/.test(t)) }; }, uidE, TAG);
    chk('browser: API card lists the key + stream, Telegram card lists the user with the command', cards.api && cards.tg, cards);
    chk('browser: live chip is green (socket open)', !!v && v.live, v && { live: v.live });
    // a heartbeat lands as a row without a poll (the socket nudges a refetch; the poll is 30 s while the socket is up)
    const D5 = mkDid(); const tb = Date.now(); await beacon(D5, 't=hb&p=%2Fbitcoin-hoje%2F');
    let row = null; for (let w = 0; w < 40; w++) { await sleep(250); row = await page.evaluate((di) => { const tr = Array.from(document.querySelectorAll('#view table.tbl tbody tr')).filter(r => r.textContent.indexOf('/bitcoin-hoje/') >= 0 && /guest/.test(r.textContent))[0]; return tr ? tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) : null; }, D5.slice(0, 8)); if (row) break; }
    const dbg = await page.evaluate((tb, di) => ({ fetches: window.__fl.map(t => t - tb).filter(t => t > -60000), ws: window.__wsm.filter(x => x[0] > tb - 2000).map(x => [x[0] - tb, x[1]]).slice(0, 12), rows: document.querySelectorAll('#view table.tbl tbody tr').length, idx: window.__last ? (window.__last.people || []).findIndex(p => p.di === di) : -2 }), tb, D5.slice(0, 8));
    chk('browser: a fresh heartbeat appears as a row within 8 s, without waiting for the poll', !!row && Date.now() - tb < 8500, { ms: Date.now() - tb, row, dbg: row ? undefined : dbg });
    chk('browser: zero page/console errors', errs.length === 0, errs.slice(0, 3));
    // Activity strip + Today card point at the view
    await page.evaluate(() => { location.hash = 'people/activity/e2e'; }); let strip = null; for (let w = 0; w < 30; w++) { await sleep(500); strip = await page.evaluate(() => { const a = document.querySelector('#acOnline .acon-go'); return a ? { href: a.getAttribute('href'), n: document.querySelectorAll('#acOnline .acon-i').length } : null; }); if (strip) break; }
    chk('browser: the Activity strip is compact and links to Here now', !!strip && strip.href === '#people/online' && strip.n >= 1, strip);
    await page.evaluate(() => { location.hash = 'today/overview'; }); let today = null; for (let w = 0; w < 40; w++) { await sleep(500); today = await page.evaluate(() => { const c = Array.from(document.querySelectorAll('#view .card')).filter(x => /^Here now/.test((x.querySelector('h2') || {}).textContent || ''))[0]; return c ? { link: !!c.querySelector('a[href="#people/online"]'), txt: c.querySelector('h2').textContent.replace(/\s+/g, ' ').slice(0, 80) } : null; }); if (today) break; }
    chk('browser: Today shows the Here now card from the same numbers with a link to the view', !!today && today.link && /people/.test(today.txt), today);
    // phone
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await page.goto(ORIGIN + '/api/stats?cb=' + Date.now() + '#people/online/e2e', { waitUntil: 'load', timeout: 60000 }); await sleep(4000);
    const ph = await page.evaluate(() => { const r = document.querySelector('#view table.tbl tbody tr td'); if (!r) return { none: true }; r.scrollIntoView({ block: 'center' }); const b = r.getBoundingClientRect(); const hit = document.elementFromPoint(Math.min(b.left + 20, window.innerWidth - 4), b.top + b.height / 2); const t = document.querySelector('#view .tile'); return { reach: !!hit && (r.contains(hit) || hit.contains(r)), sw: document.documentElement.scrollWidth, ww: window.innerWidth, tiles: document.querySelectorAll('#view .tile').length, tileW: t ? Math.round(t.getBoundingClientRect().width) : 0 }; });
    chk('phone 390: tiles fit, the first table cell is reachable and the page does not scroll sideways', !ph.none && ph.reach && ph.sw <= ph.ww && ph.tiles >= 4, ph);
    await ctx.close();
  });

  // ---- cleanup: e2 presence rows, the throwaway key + member, the key-tagged activity rows
  try { await post('/api/admin/online?inject=1', { purge: 1 }); } catch (e) {}
  if (key && sessTok) { try { await fetch(ORIGIN + '/api/bot/key', { method: 'POST', headers: { cookie: 'mp_sess=' + sessTok, 'content-type': 'application/json' }, body: JSON.stringify({ act: 'revoke', key }) }); } catch (e) {} }
  try { await post('/api/admin/e2euser', { uid: uidE, op: 'rm' }); } catch (e) {}
  for (const q of [TAG, '"di":"e2e']) { try { await post('/api/admin/activity?purge=' + encodeURIComponent(q)); } catch (e) {} }
  const gone = (await on()).body; chk('cleanup: no e2 presence row left', !(gone.people || []).some(p => p.e2) && !((gone.api || {}).keys || []).some(k => k.e2) && !((gone.api || {}).streams || []).some(s => s.e2) && !(gone.tg || []).some(t => t.e2), { n: gone.n, left: (gone.people || []).filter(p => p.e2).map(p => p.di) });
  console.log(out.join('\n')); const f = out.filter(l => l.startsWith('FAIL')).length; console.log('\n' + (out.length - f) + '/' + out.length + ' PASS' + (f ? ' — ' + f + ' FAIL' : ''));
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('suite crashed', e); process.exit(1); });
