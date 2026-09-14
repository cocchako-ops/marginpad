/* Live activity feed E2E (2026-09-07, owner: "logovi deluju mrtvo, izlaze u grupama, nemam guest logove, radar laze").
   Proves on production:
     PUSH: a guest pageview / event beacon reaches an open /api/admin/activity/ws socket within 3 s (no batcher anywhere), the
           pageview carries nv (first visit), source, browser, network; the event carries the same visitor id
     IDENTITY: a `username` row (u = old name, e = new name) folds both names into ONE actor - no "One device, 2 accounts" for
           that device, a 'rename' info line instead, old-name rows answer to the new key; a real second account on the same
           device still trips the radar
     ONLINE: the presence heartbeat joins the visitor's last pageview (page + account) in onlineList
     BROWSER (mp-ops People > Activity, #people/activity/e2e so the key-tagged test rows are shown): the live chip goes green
           (socket open), a beacon appears as a row within 4 s WITHOUT a poll (poll is 30 s), the arrival row reads
           "new visitor landed on … from …", a hop row reads "→ /page", hovering holds the stream (pending pill) and leaving
           releases it, the Visitors layout shows the guest's card with the path, phone 390 px reaches the rows.
   Rows are injected/beaconed with the ADMIN key → e2 tagged → never in the owner's daily read. Run: node build/activity-live-e2e.js
*/
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 260) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const get = (p) => fetch(ORIGIN + p, { headers: H }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const post = (p, b) => fetch(ORIGIN + p, { method: 'POST', headers: H, body: JSON.stringify(b || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const act = (q) => get('/api/admin/activity?e2e=1&' + q).then(r => r.body);
const TAG = Math.random().toString(36).slice(2, 8);
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 e2e-live';
const mkDid = () => 'e2e' + Math.random().toString(16).slice(2).padEnd(29, '0');
const beacon = (did, q) => fetch(ORIGIN + '/api/track?' + q, { headers: { cookie: 'mp_did=' + did, 'user-agent': UA, 'x-admin-key': K } }).then(r => r.status);

(async () => {
  // ---- 1. push latency over the socket (node's WebSocket accepts headers)
  const DID = mkDid(), di = DID.slice(0, 8);
  const ws = new WebSocket(ORIGIN.replace(/^http/, 'ws') + '/api/admin/activity/ws', { headers: { 'x-admin-key': K } });
  const got = []; let hello = null;
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); setTimeout(() => rej(new Error('ws timeout')), 10000); }).catch(e => chk('socket opens', false, String(e)));
  ws.onmessage = m => { let d; try { d = JSON.parse(m.data); } catch (e) { return; } if (d.hello) hello = d; got.push([Date.now(), d]); };
  await sleep(500);
  chk('socket opens with a hello carrying the online count', !!hello && typeof hello.on === 'number', hello);
  const bare = await fetch(ORIGIN + '/api/admin/activity/ws').then(r => r.status);
  chk('socket route refuses a request without admin auth', bare === 403 || bare === 401, { bare });
  const t0 = Date.now(); const b1 = await beacon(DID, 't=pageview&p=%2Fdolar-cripto%2F&r=https%3A%2F%2Fwww.google.com%2F');
  await sleep(3000);
  const t1 = Date.now(); const b2 = await beacon(DID, 't=paper&e=BTC%20long%205x&p=%2Fpaper-trade');
  await sleep(3000);
  chk('beacons accepted', b1 === 204 && b2 === 204, { b1, b2 });
  const pvPush = got.filter(([ts, d]) => d.k === 'pvlog' && d.items.some(i => i.di === di))[0];
  const evPush = got.filter(([ts, d]) => d.k === 'evlog' && d.items.some(i => i.di === di))[0];
  chk('pageview pushed over the socket within 3 s of the beacon', !!pvPush && pvPush[0] - t0 < 3000, pvPush && { ms: pvPush[0] - t0 });
  chk('event pushed over the socket within 3 s of the beacon', !!evPush && evPush[0] - t1 < 3000, evPush && { ms: evPush[0] - t1 });
  const pvRow = pvPush && pvPush[1].items.filter(i => i.di === di)[0], evRow = evPush && evPush[1].items.filter(i => i.di === di)[0];
  chk('pageview row: first visit (nv), source, browser, network, device, key-tagged e2', !!pvRow && pvRow.nv === 1 && pvRow.s === 'google.com' && pvRow.b === 'Chrome' && !!pvRow.net && pvRow.d === 'Mobile' && pvRow.e2 === 1, pvRow);
  chk('event row shares the pageview visitor id (one guest, one journey)', !!pvRow && !!evRow && evRow.v === pvRow.v && evRow.t === 'paper', evRow && { v: evRow.v, pv: pvRow && pvRow.v });
  try { ws.close(); } catch (e) {}

  // ---- 2. identity: a rename is ONE person; a second account on the same device is still caught
  const D2 = mkDid(), d2 = D2.slice(0, 8), old = 'e2e_old' + TAG, nu = 'e2e_new' + TAG, ip2 = '203.0.113.' + (Math.floor(Math.random() * 200) + 10);
  const now = Date.now();
  const inj = await post('/api/admin/activity?inject=1', {
    pvlog: [{ v: 'e2' + TAG.slice(0, 4), di: d2, ip: ip2, cc: 'RS', u: old, s: 'direct', p: '/rewards/', f: '', d: 'Mobile', b: 'Chrome', ts: now - 60000 }, { v: 'e2' + TAG.slice(0, 4), di: d2, ip: ip2, cc: 'RS', u: nu, s: 'direct', p: '/season/', f: '/rewards/', d: 'Mobile', b: 'Chrome', ts: now - 20000 }],
    evlog: [{ t: 'claim', e: '+$0.02', cc: 'RS', v: 'e2' + TAG.slice(0, 4), di: d2, ip: ip2, u: old, p: '/rewards/', d: 'Mobile', ts: now - 50000 }, { t: 'username', e: nu, cc: 'RS', v: 'e2' + TAG.slice(0, 4), di: d2, ip: ip2, u: old, p: '/', d: 'Mobile', ts: now - 40000 }, { t: 'claim', e: '+$0.02', cc: 'RS', v: 'e2' + TAG.slice(0, 4), di: d2, ip: ip2, u: nu, p: '/rewards/', d: 'Mobile', ts: now - 10000 }]
  });
  chk('inject hook stores the rename scenario (key only, e2-tagged)', inj.status === 200 && inj.body.ok && inj.body.out.evlog && inj.body.out.pvlog, inj.body);
  await sleep(1200);
  const A = await act('h=1&n=3000&pv=1');
  const hitDev = (A.radar || []).filter(r => r.k === 'multi_device' && r.actor === 'd:' + d2)[0];
  const hitClaim = (A.radar || []).filter(r => r.k === 'claim_device' && r.actor === 'd:' + d2)[0];
  const ren = (A.radar || []).filter(r => r.k === 'rename' && r.detail.indexOf('@' + old.toLowerCase()) >= 0)[0];
  chk('radar: NO "one device, 2 accounts" for a renamed user', !hitDev, hitDev && hitDev.detail);
  chk('radar: NO "claims from 2 accounts on one device" for a renamed user', !hitClaim, hitClaim && hitClaim.detail);
  chk('radar: the rename is listed as information with both names', !!ren && ren.sev === 'info' && ren.detail.indexOf('@' + nu.toLowerCase()) >= 0, ren);
  const actor = (A.actors || []).filter(a => a.key === 'u:' + nu.toLowerCase())[0];
  const oldActor = (A.actors || []).filter(a => a.key === 'u:' + old.toLowerCase())[0];
  chk('one actor under the NEW name, none under the old', !!actor && !oldActor, actor && { key: actor.key, names: actor.names, n: actor.n, pv: actor.pv });
  chk('the actor carries both names and the whole path (both pageviews)', !!actor && (actor.names || []).length === 2 && actor.pv === 2 && actor.n === 3 && actor.path.join('>') === '/rewards/>/season/', actor && { names: actor.names, path: actor.path });
  const oldRows = (A.rows || []).filter(r => r.di === d2 && r.u === old);
  chk('old-name rows resolve to the new key and carry the current name (un)', oldRows.length >= 2 && oldRows.every(r => r.k === 'u:' + nu.toLowerCase() && r.un === nu), oldRows.slice(0, 2).map(r => ({ t: r.t, k: r.k, un: r.un })));
  const T = await act('h=1&n=500&actor=u:' + nu.toLowerCase());
  chk('tracing the new name returns the old-name rows too', (T.rows || []).filter(r => r.u === old).length >= 2 && (T.rows || []).length === 5, { n: (T.rows || []).length });
  // a real second account on that device
  await post('/api/admin/activity?inject=1', { evlog: [{ t: 'claim', e: '+$0.02', cc: 'RS', v: 'e2x' + TAG.slice(0, 3), di: d2, ip: ip2, u: 'e2e_other' + TAG, p: '/rewards/', d: 'Mobile', ts: Date.now() }] });
  await sleep(1200);
  const B = await act('h=1&n=3000');
  const hit2 = (B.radar || []).filter(r => r.k === 'multi_device' && r.actor === 'd:' + d2)[0];
  chk('a genuine second account on the same device still trips the radar (2 accounts, not 3)', !!hit2 && hit2.n === 2 && hit2.detail.indexOf('@' + nu.toLowerCase()) >= 0 && hit2.detail.indexOf('e2e_other') >= 0 && hit2.detail.indexOf('@' + old.toLowerCase()) < 0, hit2 && hit2.detail);
  // carrier NAT: 2 accounts behind an IP with 4+ devices is information, not a red hit
  const ip3 = '198.51.100.' + (Math.floor(Math.random() * 200) + 10);
  await post('/api/admin/activity?inject=1', { evlog: [1, 2, 3, 4, 5].map(i => ({ t: i < 3 ? 'claim' : 'chat', e: i < 3 ? '+$0.02' : '', cc: 'NG', v: 'e2n' + i + TAG.slice(0, 2), di: 'e2nat' + i + TAG.slice(0, 2), ip: ip3, u: i < 3 ? 'e2e_nat' + i + TAG : '', p: '/rewards/', d: 'Mobile', ts: Date.now() })) });
  await sleep(1200);
  const C = await act('h=1&n=3000');
  const nat = (C.radar || []).filter(r => r.actor === 'ip:' + ip3)[0];
  chk('2 accounts behind an IP with 5 devices = "shared network" info, never red', !!nat && nat.k === 'shared_net' && nat.sev === 'info', nat && { k: nat.k, sev: nat.sev, title: nat.title });

  // ---- 3. online list: heartbeat + last pageview
  const D3 = mkDid();
  await beacon(D3, 't=pageview&p=%2Fseason%2F');
  let on = null; for (let w = 0; w < 14; w++) { await sleep(3000); const O = await act('h=1&n=300&pv=1'); on = (O.onlineList || []).filter(o => o.p === '/season/' && o.cc && o.k && o.k.indexOf('v:') === 0 && (O.rows || []).some(r => r.di === D3.slice(0, 8) && r.v === o.v))[0]; if (on) break; }
  chk('online list carries the visitor with the page they are on (presence joined to the last pageview)', !!on, on);

  // ---- 4. the ops view in a browser
  const sess = await (await fetch(ORIGIN + '/api/stats/session', { method: 'POST', headers: { 'x-admin-key': K } })).json();
  chk('ops session minted', !!sess.ok, sess.ok);
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.setCookie({ name: 'mp_sadm', value: sess.token, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true });
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140))); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
    await page.goto(ORIGIN + '/api/stats?cb=' + Date.now() + '#people/activity/e2e', { waitUntil: 'load', timeout: 60000 });
    let live = false; for (let w = 0; w < 20; w++) { await sleep(500); live = await page.evaluate(() => { const c = document.getElementById('aclive'); return !!(c && c.classList.contains('ok')) && !!document.querySelector('#acStream .row.ev'); }); if (live) break; }
    chk('browser: stream rendered and the live chip is green (socket open)', live);
    const D4 = mkDid(), d4 = D4.slice(0, 8);
    const tb = Date.now(); await beacon(D4, 't=pageview&p=%2Fbitcoin-hoje%2F&r=https%3A%2F%2Ft.co%2Fabc');
    let row = null; for (let w = 0; w < 16; w++) { await sleep(250); row = await page.evaluate((d4) => { const r = Array.from(document.querySelectorAll('#acStream .row.ev')).filter(x => x.innerHTML.indexOf('/bitcoin-hoje/') >= 0 && x.classList.contains('arr'))[0]; return r ? { text: r.textContent.replace(/\s+/g, ' ').trim(), cls: r.className, first: r === document.querySelector('#acStream .row.ev') } : null; }, d4); if (row) break; }
    chk('browser: the pageview appears as a row within 4 s of the beacon, without a poll', !!row && Date.now() - tb < 4500, row && { ms: Date.now() - tb, cls: row.cls });
    chk('browser: the arrival row reads "new visitor landed on /bitcoin-hoje/ from …" with device + browser + network', !!row && /new visitor landed on \/bitcoin-hoje\/ from t\.co/.test(row.text) && /Mobile · Chrome ·/.test(row.text), row && row.text);
    await beacon(D4, 't=pageview&p=%2Fpaper-trade&f=%2Fbitcoin-hoje%2F');
    let hop = null; for (let w = 0; w < 16; w++) { await sleep(250); hop = await page.evaluate(() => { const r = Array.from(document.querySelectorAll('#acStream .row.ev.hop')).filter(x => x.textContent.indexOf('/paper-trade') >= 0)[0]; return r ? r.textContent.replace(/\s+/g, ' ').trim() : null; }); if (hop) break; }
    chk('browser: the second page is a quiet hop row "→ /paper-trade"', !!hop && /→ \/paper-trade/.test(hop), hop);
    // hover holds the stream
    await page.hover('#acStream'); await sleep(300);
    await beacon(D4, 't=paper&e=ETH%20long%203x&p=%2Fpaper-trade');
    let pill = null; for (let w = 0; w < 16; w++) { await sleep(250); pill = await page.evaluate(() => { const p = document.querySelector('#acStream .acpend'); return p ? p.textContent : null; }); if (pill) break; }
    const heldRow = await page.evaluate(() => Array.from(document.querySelectorAll('#acStream .row.ev')).some(x => x.textContent.indexOf('ETH long 3x') >= 0));
    chk('browser: hovering holds the stream - the new row waits in a pill instead of moving under the cursor', !!pill && /\d+ new row/.test(pill) && !heldRow, { pill, heldRow });
    await page.mouse.move(5, 5); await sleep(400);
    const released = await page.evaluate(() => ({ pill: !!document.querySelector('#acStream .acpend'), row: Array.from(document.querySelectorAll('#acStream .row.ev')).some(x => x.textContent.indexOf('ETH long 3x') >= 0) }));
    chk('browser: leaving releases the held rows into the stream', !released.pill && released.row, released);
    // visitors layout
    await page.click('[data-lay="visitors"]');
    let vc = { n: 0 }; for (let w = 0; w < 24; w++) { await sleep(500); vc = await page.evaluate((d4) => { const cards = Array.from(document.querySelectorAll('#acStream .vc.guest')); const c = cards.filter(x => x.querySelector('.vc-path') && x.querySelector('.vc-path').textContent.indexOf('/bitcoin-hoje/') >= 0)[0]; return c ? { path: c.querySelector('.vc-path').textContent.replace(/\s+/g, ' '), head: c.querySelector('.vc-h').textContent.replace(/\s+/g, ' ').trim(), sum: c.querySelector('.vc-s').textContent, n: cards.length } : { n: cards.length }; }, d4); if (vc.path) break; }
    chk('browser: Visitors layout shows the guest card with the ordered path and the trade', !!vc.path && /\/bitcoin-hoje\/→\/paper-trade/.test(vc.path.replace(/\s/g, '')) && /new/.test(vc.head) && /paper/.test(vc.sum), vc);
    await page.click('[data-lay="stream"]'); await sleep(500);
    // actor modal from a guest link
    const opened = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#acStream .row.ev .lnk.gst'))[0]; if (!b) return null; b.click(); return b.textContent; });
    await sleep(2500);
    const modal = await page.evaluate(() => { const m = document.querySelector('.modal .mbox'); return m ? { rows: m.querySelectorAll('.row.ev').length, path: !!m.querySelector('.vc-path'), head: (m.querySelector('.mhead b') || {}).textContent } : null; });
    chk('browser: a guest id opens the person card with timeline + path', !!opened && !!modal && modal.rows >= 1 && /^guest /.test(modal.head || ''), modal);
    await page.evaluate(() => { const x = document.getElementById('avX'); if (x) x.click(); });
    chk('browser: zero page/console errors', errs.length === 0, errs.slice(0, 3));
    // phone
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await page.reload({ waitUntil: 'load', timeout: 60000 }); await sleep(4000);
    const ph = await page.evaluate(() => { const r = document.querySelector('#acStream .row.ev .who'); if (!r) return { none: true }; r.scrollIntoView({ block: 'center' }); const b = r.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { reach: !!hit && (r.contains(hit) || hit.contains(r)), sw: document.documentElement.scrollWidth, ww: window.innerWidth }; });
    chk('phone 390: the first row is reachable and nothing overflows', !ph.none && ph.reach && ph.sw <= ph.ww, ph);
    await ctx.close();
  });

  // ---- cleanup: purge every injected/beaconed row (all e2-tagged anyway)
  for (const q of [TAG, '"di":"e2e']) { try { await post('/api/admin/activity?purge=' + encodeURIComponent(q)); } catch (e) {} }
  console.log(out.join('\n')); const f = out.filter(l => l.startsWith('FAIL')).length; console.log('\n' + (out.length - f) + '/' + out.length + ' PASS' + (f ? ' - ' + f + ' FAIL' : ''));
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('suite crashed', e); process.exit(1); });
