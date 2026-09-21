/* Live activity log E2E (2026-09-06). The owner reads mp-ops People > Activity every day to see who does what and what
   is being abused, so the whole chain is proven end to end on production:
     server-written trade rows: open / SL-TP / close / limit order placed + cancelled land in the ring with the username,
       the label the owner reads and the structured x{} (sym, side, lev, margin, pnl, via) - no client beacon involved
     rate limit: the 21st open in a minute is refused AND leaves one 'ratelimit' row
     guest identity: a pageview and a trade beacon from the same device cookie share ONE visitor id and carry the device
     failed sign-in codes leave 'otpfail' rows and the radar raises 'otp_fail' for that (masked) email
     /api/admin/activity: window, actor trace (u:/v:/d:), radar, e2e accounts hidden unless asked
     mp-ops: the view renders the stream, group chips filter, an actor card opens, phone width reaches the rows
   Throwaway member via POST /api/admin/e2euser (username e2e_<uid>); everything is scrubbed at the end.
   Run: node build/activity-e2e.js
*/
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 260) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const post = (p, b, extra) => fetch(ORIGIN + p, { method: 'POST', headers: Object.assign({}, H, extra || {}), body: JSON.stringify(b || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const get = (p, extra) => fetch(ORIGIN + p, { headers: Object.assign({}, H, extra || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const UID = 'e2eac' + Math.random().toString(36).slice(2, 7);
const UN = 'e2e_' + UID;
const act = (q) => get('/api/admin/activity?e2e=1&' + q).then(r => r.body);

(async () => {
  const mk = await post('/api/admin/e2euser', { uid: UID, op: 'mk' });
  chk('e2e member minted', mk.body.ok, mk.body);
  const px = (await get('/api/price?symbol=BTC')).body; const live = +(px.price || (px.data && px.data.price) || 0);
  chk('BTC price for the test', live > 1000, { live });

  // ---- server-side trade lifecycle: open -> SL/TP -> close, limit order placed -> cancelled
  const op = await post('/api/trade/open?uid=' + UID, { sym: 'BTC', side: 'long', margin: 5, lev: 2 });
  chk('open via /api/trade/open', op.status === 200 && op.body.ok && op.body.position, op.body.error || op.body.position && op.body.position.id);
  const pid = op.body.position && op.body.position.id;
  const st = await post('/api/trade/sltp?uid=' + UID, { id: pid, sl: Math.round(live * 0.8), tp: Math.round(live * 1.2) });
  chk('SL/TP via /api/trade/sltp', st.status === 200 && st.body.ok, st.body.error);
  const cl = await post('/api/trade/close?uid=' + UID, { id: pid });
  chk('close via /api/trade/close', cl.status === 200 && cl.body.ok, cl.body.error);
  const oa = await post('/api/trade/order?uid=' + UID, { action: 'add', sym: 'BTC', side: 'long', px: Math.round(live * 0.5), lev: 2, margin: 5 });
  chk('limit order placed', oa.status === 200 && oa.body.ok && oa.body.order, oa.body.error);
  const oid = oa.body.order && oa.body.order.id;
  const oc = await post('/api/trade/order?uid=' + UID, { action: 'cancel', id: oid });
  chk('limit order cancelled', oc.status === 200 && oc.body.ok, oc.body.error);

  // ---- rate limit: 20 opens fit in a minute, the 21st is refused and logged once
  let refused = 0, opened = 0;
  for (let i = 0; i < 21; i++) { const r = await post('/api/trade/open?uid=' + UID, { sym: 'BTC', side: 'long', margin: 1, lev: 1 }); if (r.status === 429) refused++; else if (r.body.ok) opened++; }
  chk('trade open rate limit: 20 fit, the 21st is 429', refused >= 1 && opened <= 20, { opened, refused });

  // ---- failed sign-in codes -> otpfail rows -> radar
  const EM = 'e2e-' + UID + '@' + UID + '.example.com'; // run-specific domain: the masked form must not collide with an earlier run's rows still in the 24h ring
  for (let i = 0; i < 3; i++) await post('/api/auth/verify', { email: EM, code: '000000' }); // the admin key on the request only tags the rows e2 (hidden from the daily read); the verify itself is the public path

  // ---- guest identity: pageview + trade beacon from one device cookie
  const DID = 'e2e' + Math.random().toString(16).slice(2).padEnd(29, '0');
  const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 e2e-activity';
  const beacon = (q) => fetch(ORIGIN + '/api/track?' + q, { headers: { cookie: 'mp_did=' + DID, 'user-agent': UA, 'x-admin-key': K } }).then(r => r.status); // the key tags the rows e2 so the owner's daily read never shows test traffic
  const b1 = await beacon('t=pageview&p=%2Fpaper-trade');
  await sleep(1500); // no batcher since 2026-09-07 - the DO stores the row at once
  const b2 = await beacon('t=paper&e=BTC%20long%205x&p=%2Fpaper-trade');
  chk('guest beacons accepted', b1 === 204 && b2 === 204, { b1, b2 });
  await sleep(1500); await beacon('t=close&e=BTC%20%2B%241.20&p=%2Fpaper-trade'); await sleep(3000);

  // ---- the ring, through the endpoint
  let A = null; for (let w = 0; w < 6; w++) { A = await act('h=1&n=2000&actor=u:' + UN); if ((A.rows || []).some(r => r.t === 'close')) break; await sleep(2000); }
  const rows = A.rows || [], find = (t, re) => rows.filter(r => r.t === t && (!re || re.test(r.e || '')));
  const rOpen = find('open', /LONG BTC 2x \$5 \+SL \+TP via site|LONG BTC 2x \$5 via site/)[0], rSl = find('sltp')[0], rClose = find('close', /LONG BTC 2x closed [+-]\$/)[0], rOrd = find('order', /^placed LONG BTC @/)[0], rCan = find('order', /^cancelled LONG BTC @/)[0], rRl = find('ratelimit')[0];
  chk('ring: open row with the owner-readable label and x{sym,side,lev,margin,via}', !!rOpen && rOpen.u === UN && rOpen.x && rOpen.x.sym === 'BTC' && rOpen.x.lev === 2 && Math.abs(rOpen.x.margin - 5) < 0.06 /* the journal keeps the margin net of the open fee */ && rOpen.x.via === 'site', rOpen && { e: rOpen.e, x: rOpen.x, u: rOpen.u });
  chk('ring: SL/TP row', !!rSl && /SL \d+ \/ TP \d+/.test(rSl.e), rSl && rSl.e);
  chk('ring: close row carries pnl and roe', !!rClose && rClose.x && typeof rClose.x.pnl === 'number' && typeof rClose.x.roe === 'number' && rClose.x.via === 'site', rClose && { e: rClose.e, x: rClose.x });
  chk('ring: limit order placed + cancelled rows', !!rOrd && !!rCan && rOrd.x && rOrd.x.px === Math.round(live * 0.5) && rCan.x && rCan.x.cancel === 1, { placed: rOrd && rOrd.e, cancelled: rCan && rCan.e });
  chk('ring: one ratelimit row for the burst (at most one per isolate that saw the limit, never one per refused call)', find('ratelimit').length >= 1 && find('ratelimit').length <= 3 && /trade open 20\/min/.test(rRl.e) && rRl.u === UN, { n: find('ratelimit').length, e: rRl && rRl.e });
  chk('ring: 20 open rows from the burst are all attributed to the user', find('open', /1x \$1/).length >= 19, { n: find('open', /1x \$1/).length });
  chk('actor trace: summary counts trades and problems', A.actorInfo && A.actorInfo.key === 'u:' + UN.toLowerCase() && A.actorInfo.trades >= 24 && A.actorInfo.problems >= 1, A.actorInfo && { trades: A.actorInfo.trades, problems: A.actorInfo.problems, n: A.actorInfo.n });

  const G = await act('h=1&n=5000&pv=1');
  const gRows = (G.rows || []).filter(r => r.di === DID.slice(0, 8));
  const gPv = gRows.filter(r => r.t === 'pv')[0], gPaper = gRows.filter(r => r.t === 'paper')[0], gClose = gRows.filter(r => r.t === 'close')[0];
  chk('guest: pageview and trade beacons share one visitor id and carry the device', !!gPv && !!gPaper && gPv.v === gPaper.v && gPv.di === DID.slice(0, 8) && gPaper.di === DID.slice(0, 8), { pv: gPv && gPv.v, paper: gPaper && gPaper.v, close: gClose && gClose.v });
  const gActor = gPv && (G.actors || []).filter(a => a.key === 'v:' + gPv.v)[0];
  chk('guest: one actor with pageviews + trade actions, mobile, no username', !!gActor && gActor.pv >= 1 && gActor.trades >= 1 && !gActor.u && /mobile/i.test(gActor.d || ''), gActor && { pv: gActor.pv, trades: gActor.trades, d: gActor.d, n: gActor.n });
  const GT = gPv ? await act('h=1&actor=v:' + gPv.v) : { rows: [] };
  chk('guest trace: v: actor returns the device rows (pageview + beacons)', (GT.rows || []).length >= 2 && (GT.rows || []).every(r => r.v === gPv.v), { n: (GT.rows || []).length });

  const R = await act('h=1&n=50');
  const masked = 'e2***@' + UID + '.example.com';
  const otpHit = (R.radar || []).filter(r => r.k === 'otp_fail' && r.detail === masked)[0];
  chk('radar: 3 failed codes raise otp_fail for the masked email (never the full address)', !!otpHit && otpHit.n >= 3 && !JSON.stringify(R.radar).includes(EM), otpHit);
  const otpRows = (R.rows || []).filter(r => r.t === 'otpfail' && (r.e || '').indexOf(masked) >= 0);
  chk('ring: otpfail rows carry the reason and the masked email', otpRows.length >= 3 && otpRows.every(r => /no_code|expired|bad_code|wrong/.test(r.e)), otpRows[0] && otpRows[0].e);
  const rlHit = (R.radar || []).filter(r => r.k === 'ratelimit' && r.actor === 'u:' + UN.toLowerCase())[0];
  chk('radar: the rate-limited account is listed', !!rlHit, rlHit);
  const hidden = await act('h=1&n=3000').then(d => d); const hid = (await get('/api/admin/activity?h=1&n=3000')).body;
  const hidPv = (await get('/api/admin/activity?h=1&n=5000&pv=1')).body;
  chk('e2e accounts AND key-tagged guest/otp rows hidden from the owner view unless e2e=1', !(hid.rows || []).some(r => r.u === UN) && (hidden.rows || []).some(r => r.u === UN) && !(hidPv.rows || []).some(r => r.di === DID.slice(0, 8)) && !(hid.rows || []).some(r => r.t === 'otpfail' && (r.e || '').indexOf(masked) >= 0) && !(hid.radar || []).some(r => r.detail === masked), { hiddenUser: !(hid.rows || []).some(r => r.u === UN), hiddenGuest: !(hidPv.rows || []).some(r => r.di === DID.slice(0, 8)), hiddenOtp: !(hid.rows || []).some(r => r.t === 'otpfail' && (r.e || '').indexOf(masked) >= 0) });
  chk('endpoint: types map, actors, ring reach, online', R.types && typeof R.nEv === 'number' && Array.isArray(R.actors) && R.ringOldest > 0 && typeof R.online === 'number', { nEv: R.nEv, actors: R.actors.length, h: R.h });

  // ---- mp-ops view
  const sess = await (await fetch(ORIGIN + '/api/stats/session', { method: 'POST', headers: { 'x-admin-key': K } })).json();
  chk('ops session minted', !!sess.ok);
  await withBrowser(async (browser) => {
    for (const vp of [{ w: 1440, h: 900, t: 'desktop' }, { w: 390, h: 800, t: 'phone' }]) {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w < 500, hasTouch: vp.w < 500 });
      await page.setCookie({ name: 'mp_sadm', value: sess.token, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true });
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
      await page.goto(ORIGIN + '/api/stats#people/activity', { waitUntil: 'networkidle2', timeout: 120000 });
      for (let w = 0; w < 40; w++) { await sleep(500); if (await page.evaluate(() => document.querySelectorAll('#acStream .row').length > 0)) break; }
      const v = await page.evaluate(() => { const rows = document.querySelectorAll('#acStream .row'); const r0 = rows[0]; let reach = false; if (r0) { r0.scrollIntoView({ block: 'center' }); const b = r0.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); reach = !!(hit && r0.contains(hit)); } return { rows: rows.length, tiles: document.querySelectorAll('#acTiles .tile').length, rail: document.querySelectorAll('#acRail .card').length, radar: !!document.querySelector('.radar'), chips: document.querySelectorAll('[data-g]').length, reach, sx: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, n: (document.getElementById('acN') || {}).textContent }; });
      chk(vp.t + ': activity view renders stream, tiles, rail with radar, chips; first row reachable; no horizontal scroll', v.rows > 0 && v.tiles === 4 && v.rail >= 4 && v.radar && v.chips === 10 && v.reach && !v.sx && errs.length === 0, Object.assign(v, { errs }));
      if (vp.t === 'desktop') {
        const before = v.rows;
        await page.click('[data-g="money"]'); await sleep(700);
        const f = await page.evaluate(() => ({ on: document.querySelector('[data-g="money"]').classList.contains('on'), rows: document.querySelectorAll('#acStream .row').length, txt: (document.getElementById('acStream').innerText || '').slice(0, 200) }));
        chk('desktop: Money chip filters the stream and stays selected', f.on && f.rows <= before, { before, after: f.rows });
        await page.click('[data-g="all"]'); await sleep(500);
        await page.type('#acq', 'btc'); await sleep(600);
        const q = await page.evaluate(() => ({ rows: document.querySelectorAll('#acStream .row').length, allBtc: Array.from(document.querySelectorAll('#acStream .row')).every(r => /btc/i.test(r.innerText)) }));
        chk('desktop: search narrows to matching rows only', q.rows === 0 || q.allBtc, q);
        await page.evaluate(() => { document.getElementById('acq').value = ''; document.getElementById('acq').dispatchEvent(new Event('input')); }); await sleep(500);
        const opened = await page.evaluate(() => { const b = document.querySelector('#acRail [data-actor], #acStream [data-actor]'); if (!b) return 'none'; b.click(); return b.getAttribute('data-actor'); });
        for (let w = 0; w < 20; w++) { await sleep(500); if (await page.evaluate(() => document.querySelectorAll('#avBody .row').length > 0 || /nothing|no summary/.test((document.getElementById('avBody') || {}).innerText || ''))) break; }
        const m = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), rows: document.querySelectorAll('#avBody .row').length, sub: (document.getElementById('avSub') || {}).textContent, head: (document.querySelector('.mhead b') || {}).textContent }));
        chk('desktop: an actor card opens with its own timeline', opened !== 'none' && m.modal && m.rows > 0, Object.assign({ opened }, m));
        await page.keyboard.press('Escape'); await sleep(300);
        chk('desktop: Escape closes the actor card', await page.evaluate(() => !document.querySelector('.modal')));
        await page.screenshot({ path: path.join(__dirname, 'ops-shots', 'v2-people-activity.png') });
      } else { await page.screenshot({ path: path.join(__dirname, 'ops-shots', 'v2-people-activity-phone.png'), fullPage: false }); }
      await ctx.close();
    }
  });

  // ---- cleanup
  const rm = await post('/api/admin/e2euser', { uid: UID, op: 'rm' });
  chk('cleanup: member scrubbed', rm.body.ok, rm.body);

  /* A RENTED MACHINE IS NOT A VISITOR (2026-09-21). 301 Alibaba Cloud instances walked the site
     overnight, 2 pages each so no single actor looked heavy, and were counted as readers - Singapore
     went ahead of Nigeria in the country ranking and 134 of 147 "people online" were those machines.
     Counted and dropped now, like the injection probes before them.

     THE LOAD-BEARING HALF IS THE EXEMPTION: a signed-in account is always a person, whatever network
     it sits on, or the first member on a VPN disappears from his own stats. */
  {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'worker.js'), 'utf8');
    const i = src.indexOf('A RENTED MACHINE IS NOT A VISITOR. An anonymous beacon');
    const blk = i > 0 ? src.slice(i, i + 1600) : '';
    chk('datacentre gate exists', i > 0);
    chk('it reads the network from Cloudflare, not from a header the caller controls', /request\.cf && request\.cf\.asOrganization/.test(blk));
    chk('a signed-in account is never gated', /_signedIn = !!\(getCookie\(request, 'mp_uid'\) \|\| getCookie\(request, 'mp_sess'\)\)/.test(blk) && /&& !_signedIn/.test(blk));
    chk('an admin-key beacon is never gated, so an E2E still measures itself', /&& !_adm/.test(blk));
    chk('it counts before it drops', /dc:day:/.test(blk) && /dc:org:/.test(blk));
    // and it has to run BEFORE the heartbeat, or the machines keep filling "Here now"
    const hb = src.indexOf("if (type === 'hb')", src.indexOf('async function handleTrack'));
    chk('the gate runs before the presence heartbeat', i > 0 && i < hb, 'gate ' + i + ' hb ' + hb);
    const rad = await get('/api/admin/activity?h=2&n=50');
    const line = ((rad.body && rad.body.radar) || []).find(x => x.k === 'datacentre');
    chk('the radar reports them as one line rather than a row each', !line || /counted and dropped/.test(line.title), line && line.title);
  }

  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed  (uid ' + UID + ')');
  process.exit(bad ? 1 : 0);
})();
