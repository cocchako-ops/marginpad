// The alerts hub (2026-10-30): one page for every alert the site can send, and where it reaches you.
// API half: the hub refuses a guest, answers a member with every section, every write round-trips through the
// route that already validated it (positions + the catalyst switch, zones, whales, wrap, email digest, price alerts),
// a free member is refused the Premium switches by the SERVER, and the catalyst cron honours cx=0.
// Browser half (1366 + 390): every row is reachable, a guest sees the catalogue read-only, a member can create and
// remove a price alert, a Premium switch really saves, nothing is wider than the screen, zero page errors.
const fs = require('fs');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const PURE = process.argv.includes('--pure');
const out = []; const ok = (n, c, x) => out.push((c ? 'ok   ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 200) : ''));
const admin = async (p, body) => { const r = await fetch(ORIGIN + p, { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UID = 'e2ealhub' + Math.random().toString(36).slice(2, 6);
let SESS = '';
const as = async (p, body, method) => { const r = await fetch(ORIGIN + p, { method: method || (body ? 'POST' : 'GET'), headers: { cookie: 'mp_sess=' + SESS, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; };

(async () => {
  // ---- pure: the shipped worker's posAlertCfg carries the catalyst switch, the cron honours it, the hub route exists
  const W = fs.readFileSync('D:/part1/money-mission/src/worker.js', 'utf8');
  const fn = W.match(/function posAlertCfg\(v\) \{[\s\S]*?\n\}/);
  ok('posAlertCfg is in the worker', !!fn);
  const posAlertCfg = new Function('POSALERT_DEF', fn[0] + '; return posAlertCfg;')({ on: 0, liq: 5, sltp: 1, ord: 1, cx: 1 });
  ok('an old stored config with no cx reads as cx ON (nobody loses a catalyst they were getting)', posAlertCfg('{"on":1,"liq":5}').cx === 1);
  ok('cx:0 is kept', posAlertCfg({ on: 1, cx: 0 }).cx === 0 && posAlertCfg({ on: 1, cx: 1 }).cx === 1);
  ok('the catalyst cron skips a member with cx 0', /w\.cfg && w\.cfg\.cx === 0\) continue;/.test(W));
  ok('the hub route composes every section', ["sub === '/hub'", "sub === '/email'", "sub === '/wrap'", "sub === '/calrem'"].every(s => W.indexOf(s) >= 0));
  ok('the store can read and set the digest bit', W.indexOf("path === '/digest/get'") >= 0 && W.indexOf("path === '/digest/set'") >= 0);
  const page = fs.readFileSync('D:/part1/money-mission/dist/alerts/index.html', 'utf8');
  ok('the page asks the hub and names every row', ['/api/alerts/hub', "id:'price'", "id:'line'", "id:'tape'", "id:'pos'", "id:'zone'", "id:'whale'", "id:'brief'", "id:'wrap'", "id:'cal'", 'emDigest', 'data-kind', '[hidden]{display:none !important;}'].every(s => page.indexOf(s) >= 0));
  ok('no emoji on the page', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(page));
  if (PURE) return done();

  // ---- API, as a guest
  const g = await fetch(ORIGIN + '/api/alerts/hub'); ok('the hub refuses a guest with 401', g.status === 401, g.status);
  // ---- a real member
  const mk = await admin('/api/admin/e2euser', { uid: UID, op: 'mk' }); ok('e2e member minted', mk.s === 200 && mk.j && mk.j.ok !== false, mk.j);
  const se = await admin('/api/admin/e2euser', { uid: UID, op: 'sess' }); SESS = (se.j && (se.j.token || se.j.sess || se.j.mp_sess)) || ''; ok('session minted', !!SESS);
  let h = await as('/api/alerts/hub');
  ok('the hub answers a member with every section', h.s === 200 && h.j && h.j.ok && h.j.channels && h.j.price && h.j.line && h.j.tape && h.j.zone && h.j.whale && h.j.pos && h.j.brief && h.j.wrap && h.j.calendar && h.j.kinds && h.j.lastRun, h.j && Object.keys(h.j));
  ok('a fresh member is not Premium, has no Telegram, no push, digest on', h.j && h.j.premium === false && h.j.channels.telegram.linked === false && h.j.channels.push.on === false && h.j.channels.email.digest === 1, h.j && h.j.channels);
  ok('every alert cron has stamped a run (the hub shows when)', h.j && ['posalert', 'zonealert', 'linealert'].every(k => h.j.lastRun[k] > 0), h.j && h.j.lastRun);
  // the SERVER is the Premium gate
  const p402 = await as('/api/alerts/posalert', { on: 1, liq: 5, sltp: 1, ord: 1, cx: 1 }); ok('position alerts refused to a free member by the server (402)', p402.s === 402, p402.s);
  const z402 = await as('/api/alerts/zonealert', { on: 1, coins: ['BTC'] }); ok('zone alerts refused to a free member (402)', z402.s === 402, z402.s);
  const w402 = await as('/api/alerts/whale', { addr: '0x' + 'a'.repeat(40), on: true }); ok('whale alerts refused to a free member (402)', w402.s === 402, w402.s);
  const b402 = await as('/api/brief', { push: true, tg: false, h: 8 }); ok('the brief refused to a free member (402)', b402.s === 402, b402.s);
  // free things work
  const em = await as('/api/alerts/email', { digest: 0 }); const em2 = await as('/api/alerts/email'); ok('the weekly recap can be switched off and reads back off', em.s === 200 && em.j.ok && em2.j && em2.j.digest === 0, [em.j, em2.j]);
  const em3 = await as('/api/alerts/email', { digest: 1 }); const em4 = await as('/api/alerts/email'); ok('and back on', em3.j && em3.j.ok && em4.j && em4.j.digest === 1);
  const wr = await as('/api/alerts/wrap', { on: true, h: 8 }); ok('the wrap refuses without Telegram, with a reason', wr.s === 400 && wr.j && wr.j.error === 'telegram_required', wr.j);
  const tp = await as('/api/alerts/tapealert', { on: true, usd: 250000, side: 0, coins: ['BTC'] }); ok('the tape alert refuses without Telegram, with a reason', tp.s === 400 && tp.j && tp.j.error === 'telegram_required', tp.j);
  const pa = await as('/api/alerts', { sym: 'BTC', dir: 'up', target: 999999, note: 'e2e', channel: 'email' }); ok('a price alert is created', pa.s === 200 && pa.j && pa.j.ok, pa.j);
  h = await as('/api/alerts/hub'); const mine = (h.j && h.j.price.alerts) || []; ok('the hub lists it', mine.some(a => a.sym === 'BTC' && a.active), mine.length);
  const kinds = await as('/api/push/prefs', { prefs: { dm: false } }); const h2 = await as('/api/alerts/hub'); ok('a notification kind switched off reads back off on the hub', kinds.j && kinds.j.ok && h2.j && h2.j.kinds.dm === false, h2.j && h2.j.kinds);
  // ---- Premium: the same switches work, and the catalyst switch round-trips
  const pr = await admin('/api/admin/premium?add=e2e_' + UID + '&days=1'); ok('premium granted for the test', pr.s === 200, pr.j);
  await sleep(1500);
  await as('/api/auth/xp', { ack: 1 }); // mark the Premium celebration card seen, or it sits over the page in the browser legs
  const p1 = await as('/api/alerts/posalert', { on: 1, liq: 7, sltp: 2, ord: 1.5, cx: 0 }); ok('a Premium member switches position alerts on with the catalyst half OFF', p1.s === 200 && p1.j && p1.j.ok && p1.j.cfg.on === 1 && p1.j.cfg.cx === 0 && p1.j.cfg.liq === 7, p1.j);
  const h3 = await as('/api/alerts/hub'); ok('the hub reads the position config back, cx 0', h3.j && h3.j.premium === true && h3.j.pos.cfg.on === 1 && h3.j.pos.cfg.cx === 0 && h3.j.pos.cfg.liq === 7, h3.j && h3.j.pos);
  const p2 = await as('/api/alerts/posalert', { on: 1, liq: 7, sltp: 2, ord: 1.5, cx: 1 }); ok('and cx back on', p2.j && p2.j.cfg.cx === 1);
  const z1 = await as('/api/alerts/zonealert', { on: 1, rel: 3, dist: 0.5, swept: 1, coins: ['BTC', 'ETH'] }); ok('zone alerts refuse with nowhere to go (no push, no Telegram) even for Premium', z1.s === 400 && z1.j && z1.j.error === 'telegram_required', z1.j);
  const wh1 = await as('/api/alerts/whale', { addr: '0x' + 'b'.repeat(40), on: true }); const h4 = await as('/api/alerts/hub'); ok('a whale wallet is watched and listed on the hub', wh1.s === 200 && wh1.j.ok && h4.j.whale.addrs.indexOf('0x' + 'b'.repeat(40)) >= 0, h4.j && h4.j.whale);
  const wh2 = await as('/api/alerts/whale', { addr: '0x' + 'b'.repeat(40), on: false }); ok('and removed', wh2.j && wh2.j.ok && wh2.j.addrs.length === 0);

  // ---- browser
  const { withBrowser, newPage, UA_DESKTOP, UA_MOBILE } = require('./e2e-browser.js');
  await withBrowser(async (browser) => {
    for (const [mobile, w, hh, vp] of [[false, 1366, 820, 'desk'], [true, 390, 844, 'phone']]) {
      for (const who of ['guest', 'member']) {
        const ctx = await browser.createBrowserContext();
        const page = await newPage(ctx, { mobile, ua: mobile ? UA_MOBILE : UA_DESKTOP });
        await page.setViewport({ width: w, height: hh, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
        await page.setCacheEnabled(false);
        const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
        await page.evaluateOnNewDocument(() => { try { localStorage.setItem('mp_ck_ok', '1'); } catch (e) {} });
        if (who === 'member') await page.setCookie({ name: 'mp_sess', value: SESS, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
        await page.goto(ORIGIN + '/alerts/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => document.querySelectorAll('.row').length >= 9 && window.mpAuth, { timeout: 30000 }).catch(() => {});
        if (who === 'member') await page.waitForFunction(() => !!window.__mpAlertsHub, { timeout: 30000 }).catch(() => {});
        await sleep(800);
        // a test member granted Premium meets the one-time celebration card over the page - close it, it is not the page
        await page.evaluate(() => { const x = document.querySelector('#mpPgc button.mpxp-x, #mpPgc .mpxp-x'); if (x) x.click(); const g = document.getElementById('mpPgc'); if (g) g.remove(); });
        await sleep(300);
        const st = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('.row[data-row]')];
          const reach = rows.map(r => { const hd = r.querySelector('.row-h'); hd.scrollIntoView({ block: 'center' }); const b = hd.getBoundingClientRect(); const el = document.elementFromPoint(b.left + 40, b.top + b.height / 2); return { id: r.getAttribute('data-row'), hit: !!(el && hd.contains(el)) }; });
          const sx = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
          const wide = [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map(e => e.tagName + '.' + (e.className || '').toString().slice(0, 20));
          return { rows: rows.length, reach, sx, wide, gate: !document.getElementById('gateAll').hidden, hub: !!window.__mpAlertsHub, prem: document.querySelectorAll('.tag.prem').length, free: document.querySelectorAll('.tag.free').length, kinds: document.querySelectorAll('[data-kind]').length, lockedSw: [...document.querySelectorAll('.sw[data-sw]')].filter(x => x.disabled).length };
        });
        ok(vp + ' ' + who + ': nine alert rows, every header under the pointer', st.rows === 9 && st.reach.every(r => r.hit), st.reach.filter(r => !r.hit));
        ok(vp + ' ' + who + ': nothing wider than the screen, no sideways scroll', !st.sx && !st.wide.length, st.wide);
        ok(vp + ' ' + who + ': the catalogue is visible to everyone - Premium and Free tags, six notification kinds', st.prem >= 4 && st.free >= 4 && st.kinds === 6, { prem: st.prem, free: st.free, kinds: st.kinds });
        if (who === 'guest') ok(vp + ' guest: the sign-in gate is shown and every main switch is locked', st.gate && st.lockedSw >= 5, { gate: st.gate, locked: st.lockedSw });
        else {
          ok(vp + ' member: the hub loaded and the gate is gone', st.hub && !st.gate, { hub: st.hub, gate: st.gate });
          // create + remove a price alert through the page
          await page.evaluate(() => { document.getElementById('r-price').classList.add('open'); document.getElementById('r-price').scrollIntoView({ block: 'center' }); });
          await page.type('#coin', 'ETH'); await page.keyboard.press('Escape'); await sleep(200); await page.click('#target'); await page.type('#target', '1');
          const n0 = await page.evaluate(() => window.__mpAlertsHubN || 0);
          await page.click('#createBtn');
          await page.waitForFunction(n => (window.__mpAlertsHubN || 0) > n, { timeout: 15000 }, n0).catch(() => {});
          await page.waitForFunction(() => /Alert set/.test((document.getElementById('pMsg') || {}).textContent || ''), { timeout: 15000 }).catch(() => {});
          await page.waitForFunction(() => [...document.querySelectorAll('#aList .it .sym')].some(s => s.textContent === 'ETH'), { timeout: 15000 }).catch(() => {});
          const made = await page.evaluate(() => ({ msg: (document.getElementById('pMsg') || {}).textContent, rows: [...document.querySelectorAll('#aList .it .sym')].map(s => s.textContent) }));
          ok(vp + ' member: a price alert created from the page is listed', made.rows.indexOf('ETH') >= 0, made);
          const n1 = await page.evaluate(() => window.__mpAlertsHubN || 0);
          const del = await page.evaluate(() => { const b = [...document.querySelectorAll('#aList .it')].find(r => r.querySelector('.sym').textContent === 'ETH'); const btn = b && b.querySelector('[data-del]'); if (!btn) return false; btn.click(); return true; });
          await page.waitForFunction(n => (window.__mpAlertsHubN || 0) > n, { timeout: 15000 }, n1).catch(() => {});
          await sleep(400);
          const gone = await page.evaluate(() => ![...document.querySelectorAll('#aList .it:not(.fired) .sym')].some(s => s.textContent === 'ETH'));
          ok(vp + ' member: and removed from the page', del && gone);
          // a Premium switch saves through the page (the member holds Premium for the test)
          await page.evaluate(() => { const r = document.getElementById('r-pos'); r.classList.add('open'); r.scrollIntoView({ block: 'center' }); });
          const before = await page.evaluate(() => document.getElementById('sw-pos').checked);
          await page.click('#sw-pos');
          await page.waitForFunction(() => /Saved/.test((document.getElementById('posMsg') || {}).textContent || ''), { timeout: 15000 }).catch(() => {});
          const after = await page.evaluate(() => ({ msg: (document.getElementById('posMsg') || {}).textContent, on: document.getElementById('sw-pos').checked }));
          const srv = await as('/api/alerts/posalert');
          ok(vp + ' member: the position-alert switch saves from the page and the server holds it', after.on === !before && srv.j && srv.j.cfg && (srv.j.cfg.on === 1) === after.on, { after, srv: srv.j && srv.j.cfg });
        }
        ok(vp + ' ' + who + ': no page errors', errs.length === 0, errs);
        await ctx.close();
      }
    }
  }, { timeout: 420000 });
  await admin('/api/admin/e2euser', { uid: UID, op: 'rm' });
  done();
  function done() { console.log(out.join('\n')); const f = out.filter(x => x.startsWith('FAIL')).length; console.log('\n' + (out.length - f) + ' passed, ' + f + ' failed'); process.exitCode = f ? 1 : 0; }
})().catch(async e => { console.error(e); try { await admin('/api/admin/e2euser', { uid: UID, op: 'rm' }); } catch (x) {} console.log(out.join('\n')); process.exitCode = 1; });
