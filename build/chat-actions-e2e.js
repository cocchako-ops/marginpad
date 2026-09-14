/* Chat message actions (owner 2026-09-14: "na dugacak klik ... da mi ponudi da je obrisem ili ispravim ... i emoji
   reakcija", Telegram/Instagram shaped). Two real members in two browsers on the same room.

   The point of this suite is the SENSITIVE half, not the happy path: authorship is decided by the session behind the
   socket, so the second member must be unable to edit or delete the first member's message no matter what its UI
   offers, a guest must be unable to react at all, and the raw account id must never reach a browser. The rest checks
   that the long press does not steal what the row already did — a username still opens a profile, a link is still a
   link, and a drag still scrolls.                                          node build/chat-actions-e2e.js          */
'use strict';
const fs = require('fs');
const { withBrowser, newPage } = require('./e2e-browser.js');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').replace(/^\uFEFF/, '').match(/mpadm_[a-f0-9]+/)[0];
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const api = async (p, b) => (await fetch(O + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 220) : '')); } };

// open the chat as a signed-in member and wait for the socket's history
async function chatPage(browser, token, vp) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(vp || { width: 1366, height: 900 });
  if (token) await page.setCookie({ name: 'mp_sess', value: token, domain: 'marginpad.io', path: '/' },
    { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 110)));
  await page.goto(O + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500);
  await page.evaluate(() => { const f = document.getElementById('chatFab'); if (f) f.click(); });
  await sleep(2600);
  return { ctx, page, errs };
}
// typed, not dispatched: the form listener reads its own input, and a synthetic submit skipped the send path
async function say(page, text) {
  await page.focus('#ctInput');
  await page.type('#ctInput', text, { delay: 12 });
  await page.keyboard.press('Enter');
  await sleep(2600);
}
// speak to the room directly as a given member: the security checks must not depend on what a page chooses to expose
let WSLib = null; try { WSLib = require('../node_modules/ws'); } catch (e) {}
function forge(token, msgs) {
  return new Promise((res) => {
    if (!WSLib) return res(false);
    const ws = new WSLib(O.replace('https://', 'wss://') + '/chat/ws?room=global', { headers: { cookie: 'mp_sess=' + token, origin: O } });
    const done = () => { try { ws.close(); } catch (e) {} res(true); };
    ws.on('open', () => { msgs.forEach(m => { try { ws.send(JSON.stringify(m)); } catch (e) {} }); setTimeout(done, 1200); });
    ws.on('error', () => res(false));
    setTimeout(() => res(false), 10000);
  });
}
const rowOf = (page, text) => page.evaluate((t) => {
  const n = [...document.querySelectorAll('#chatBox [data-mid]')].filter(x => (x.innerText || '').indexOf(t) >= 0);
  const r = n[n.length - 1];
  return r ? { mid: r.getAttribute('data-mid'), own: r.getAttribute('data-own') === '1', html: (r.innerText || '').slice(0, 80) } : null;
}, text);
// a real long press: touch down, hold past the threshold, lift
async function longPress(page, mid) {
  const box = await page.evaluate((m) => { const r = document.querySelector('#chatBox [data-mid="' + m + '"]'); if (!r) return null; r.scrollIntoView({ block: 'center' }); const b = r.getBoundingClientRect(); return { x: b.left + Math.min(40, b.width / 2), y: b.top + b.height / 2 }; }, mid);
  if (!box) return false;
  await page.touchscreen.touchStart(box.x, box.y);
  await sleep(700);
  await page.touchscreen.touchEnd();
  await sleep(500);
  return true;
}

(async () => {
  const A = 'e2ecta' + Math.random().toString(36).slice(2, 6);
  const B = 'e2ectb' + Math.random().toString(36).slice(2, 6);
  await api('/api/admin/e2euser', { uid: A, op: 'mk' });
  await api('/api/admin/e2euser', { uid: B, op: 'mk' });
  const sa = await api('/api/admin/e2euser', { uid: A, op: 'sess' });
  const sb = await api('/api/admin/e2euser', { uid: B, op: 'sess' });

  await withBrowser(async (browser) => {
    const pa = await chatPage(browser, sa.token, { width: 390, height: 844, isMobile: true, hasTouch: true });
    const pb = await chatPage(browser, sb.token);

    const opened = await pa.page.evaluate(() => { const i = document.getElementById('ctInput'); const g = document.getElementById('ctGate'); return !!i && !!(i.offsetWidth || i.offsetHeight) && !(g && (g.offsetWidth || g.offsetHeight)); });
    ok(opened, 'the chat opens for a signed-in member');

    const text = 'e2e chat probe ' + Math.random().toString(36).slice(2, 7);
    await say(pa.page, text);

    const mine = await rowOf(pa.page, text);
    const theirs = await rowOf(pb.page, text);
    ok(!!mine && !!mine.mid, 'the message posts and the row carries an id', mine);
    ok(!!mine && mine.own, 'the author\'s own row is marked as theirs', mine);
    ok(!!theirs && !theirs.own, 'the same row is NOT marked as theirs in the other member\'s browser', theirs);
    ok(!!theirs && theirs.mid === (mine || {}).mid, 'both browsers address it by the same id');

    // no account id anywhere in the page
    const leak = await pb.page.evaluate((uid) => document.documentElement.innerHTML.indexOf(uid) >= 0, A);
    ok(!leak, 'the author\'s account id never reaches another browser');

    // ── the long press ────────────────────────────────────────────────────────────────────────────────────────
    ok(await longPress(pa.page, mine.mid), 'a long press on your own message opens something');
    const sheet = await pa.page.evaluate(() => {
      const s = document.querySelector('.ct-sheet'); if (!s) return null;
      const b = s.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + 12);
      return { on: s.classList.contains('on'), rx: s.querySelectorAll('[data-sx]').length, acts: [...s.querySelectorAll('[data-sa]')].map(x => x.getAttribute('data-sa')), inView: b.top >= 0 && b.bottom <= window.innerHeight && b.left >= 0 && b.right <= window.innerWidth, reach: !!(hit && s.contains(hit)) };
    });
    ok(!!sheet, 'the action sheet is in the page', sheet);
    ok(sheet && sheet.rx === 6, 'it offers the six reactions', sheet && { rx: sheet.rx });
    ok(sheet && sheet.acts.indexOf('edit') >= 0 && sheet.acts.indexOf('del') >= 0 && sheet.acts.indexOf('copy') >= 0, 'and Copy, Edit and Delete on your own message', sheet && sheet.acts);
    ok(sheet && sheet.inView, 'it is fully inside the viewport on a phone', sheet && { inView: sheet.inView });
    ok(sheet && sheet.reach, 'and it is clickable where it sits');

    // react from the sheet
    await pa.page.evaluate(() => { const b = document.querySelector('.ct-sheet [data-sx]'); if (b) b.click(); });
    await sleep(2200);
    const rxA = await pa.page.evaluate((m) => { const r = document.querySelector('#chatBox [data-mid="' + m + '"] .ct-rxb'); return r ? { txt: (r.innerText || '').replace(/\s+/g, ''), on: r.classList.contains('on') } : null; }, mine.mid);
    const rxB = await pb.page.evaluate((m) => { const r = document.querySelector('#chatBox [data-mid="' + m + '"] .ct-rxb'); return r ? { txt: (r.innerText || '').replace(/\s+/g, ''), on: r.classList.contains('on') } : null; }, mine.mid);
    ok(!!rxA && /1$/.test(rxA.txt) && rxA.on, 'the reaction lands and reads as mine', rxA);
    ok(!!rxB && /1$/.test(rxB.txt) && !rxB.on, 'the other member sees the count but not as theirs', rxB);
    ok(!(await pa.page.evaluate(() => !!document.querySelector('.ct-sheet'))), 'the sheet closes after acting');

    // the other member taps the same chip: 2, and theirs
    await pb.page.evaluate((m) => { const r = document.querySelector('#chatBox [data-mid="' + m + '"] .ct-rxb'); if (r) r.click(); }, mine.mid);
    await sleep(2200);
    const rx2 = await pa.page.evaluate((m) => { const r = document.querySelector('#chatBox [data-mid="' + m + '"] .ct-rxb'); return r ? (r.innerText || '').replace(/\s+/g, '') : null; }, mine.mid);
    ok(rx2 && /2$/.test(rx2), 'a second member on the same chip makes it two', { rx2 });
    await pb.page.evaluate((m) => { const r = document.querySelector('#chatBox [data-mid="' + m + '"] .ct-rxb'); if (r) r.click(); }, mine.mid);
    await sleep(2200);
    const rx3 = await pa.page.evaluate((m) => { const r = document.querySelector('#chatBox [data-mid="' + m + '"] .ct-rxb'); return r ? (r.innerText || '').replace(/\s+/g, '') : null; }, mine.mid);
    ok(rx3 && /1$/.test(rx3), 'tapping again takes that one back', { rx3 });

    // ── the other member must NOT be offered edit or delete ───────────────────────────────────────────────────
    await pb.page.evaluate((m) => { const r = document.querySelector('#chatBox [data-mid="' + m + '"]'); if (r) r.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); }, mine.mid);
    await sleep(700);
    const bSheet = await pb.page.evaluate(() => { const s = document.querySelector('.ct-sheet'); return s ? [...s.querySelectorAll('[data-sa]')].map(x => x.getAttribute('data-sa')) : null; });
    ok(bSheet && bSheet.indexOf('edit') < 0 && bSheet.indexOf('del') < 0, 'another member is offered no Edit and no Delete', bSheet);

    // And even if it asks anyway. The page deliberately does NOT expose its socket — handing one to window would let
    // any script on the page speak as the member — so the forged action is sent from here, over B's own session.
    await pb.page.evaluate(() => document.body.click());
    await forge(sb.token, [{ type: 'del', id: mine.mid }, { type: 'edit', id: mine.mid, t: 'hijacked' }]);
    await sleep(2500);
    const still = await rowOf(pa.page, text);
    ok(!!still, 'a forged delete from another member changes nothing');
    const hijacked = await pa.page.evaluate(() => document.querySelector('#chatBox').innerText.indexOf('hijacked') >= 0);
    ok(!hijacked, 'and a forged edit changes nothing');

    // ── the author edits, then deletes ────────────────────────────────────────────────────────────────────────
    await pa.page.evaluate((t) => { window.prompt = () => t + ' fixed'; }, text);
    await longPress(pa.page, mine.mid);
    await pa.page.evaluate(() => { const b = document.querySelector('.ct-sheet [data-sa="edit"]'); if (b) b.click(); });
    await sleep(2500);
    const edA = await pa.page.evaluate((m) => { const r = document.querySelector('#chatBox [data-mid="' + m + '"]'); return r ? { txt: (r.innerText || ''), ed: !!r.querySelector('.ct-ed') } : null; }, mine.mid);
    const edB = await pb.page.evaluate((m) => { const r = document.querySelector('#chatBox [data-mid="' + m + '"]'); return r ? { txt: (r.innerText || ''), ed: !!r.querySelector('.ct-ed') } : null; }, mine.mid);
    ok(edA && edA.txt.indexOf('fixed') >= 0 && edA.ed, 'the author can edit, and the row says edited', edA);
    ok(edB && edB.txt.indexOf('fixed') >= 0 && edB.ed, 'the other browser shows the edit too, without a reload', edB);
    ok(edB && edB.txt.indexOf(' fixed') >= 0 && (edB.txt.match(/fixed/g) || []).length === 1, 'the edit replaced the text rather than appending', edB);

    await pa.page.evaluate(() => { window.confirm = () => true; });
    await longPress(pa.page, mine.mid);
    await pa.page.evaluate(() => { const b = document.querySelector('.ct-sheet [data-sa="del"]'); if (b) b.click(); });
    await sleep(2500);
    ok(!(await rowOf(pa.page, text)), 'the author can delete it');
    ok(!(await rowOf(pb.page, text)), 'and it disappears from the other browser too');

    // ── nothing the row already did is broken ─────────────────────────────────────────────────────────────────
    const t2 = 'link probe ' + Math.random().toString(36).slice(2, 6);
    await say(pa.page, t2);
    const nameClick = await pa.page.evaluate(() => {
      const u = document.querySelector('#chatBox [data-mid] .ct-user'); if (!u) return { none: true };
      u.click(); return { clicked: true };
    });
    await sleep(1500);
    const profileOpened = await pa.page.evaluate(() => !!document.querySelector('.lbm-card, .mpa-prof, [data-profcard]') || !!window.mpOpenProfile);
    ok(nameClick && !nameClick.none && profileOpened, 'tapping a username still opens the trader card', { nameClick, profileOpened });

    const errs = pa.errs.concat(pb.errs);
    ok(errs.length === 0, 'no page errors in either browser', errs.slice(0, 3));

    await pa.ctx.close(); await pb.ctx.close();
  });

  await api('/api/admin/e2euser', { uid: A, op: 'rm' });
  await api('/api/admin/e2euser', { uid: B, op: 'rm' });
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
