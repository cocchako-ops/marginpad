/* TRADE OF THE DAY (2026-11-12, owner-approved feature #11): a shared CLOSED ticket in the room can be nominated (once a day per member)
   and voted for (one vote a day per member, never your own nomination); the cron settles yesterday after midnight UTC - most votes, a tie
   to the bigger ROE, nobody with zero votes - pays the author TOTD_XP once and posts one house line; the homepage hero carries the winner.
   (default, --local): the card rail from CANNED answers - Nominate on a fresh closed card, Vote with the count on a candidate, the own
            nomination disabled, a guest sent to sign in, the POST body, the repaint after a vote, no rail on an OPEN card, the homepage strip.
   --prod : the real route with two throwaway members: share a closed ticket, nominate it, the nominator refused on their own, the other
            member votes, a second nomination refused, the board on GET, a dry settle naming the winner; both members removed.
   Run: node build/totd-e2e.js [--local] [--prod] */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ROOT = path.join(__dirname, '..'), BASE = 'https://marginpad.io';
const LOCAL = process.argv.includes('--local'), PROD = process.argv.includes('--prod');
let okN = 0, failN = 0; const chk = (n, ok, x) => { ok ? okN++ : failN++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 260) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CT = { js: 'text/javascript', css: 'text/css', html: 'text/html; charset=utf-8' };
function localFile(u) { const p = new URL(u).pathname; if (p.indexOf('/assets/') === 0) return path.join(ROOT, 'dist', p); if (/^\/(paper-trade|charts|heatmap|screener|calculators|swap)$/.test(p)) return path.join(ROOT, 'app', 'index.html'); if (p === '/') return path.join(ROOT, 'dist', 'index.html'); return null; }
const DAY = new Date().toISOString().slice(0, 10);
{ /* THE WINNER IS PAID $1 (2026-11-13): the settle credits the AUTHOR through the ledger's /gift with from:'totd' and a one-day `once`, publishes
     `usd` on GET so the rail, the panel and the homepage strip never type the figure, and the panel + chat chip exist in mp-auth. */
  const W = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8'), MA = fs.readFileSync(path.join(ROOT, 'dist', 'assets', 'mp-auth.js'), 'utf8'), HM = fs.readFileSync(path.join(ROOT, 'dist', 'demo-home', 'index.html'), 'utf8');
  chk('pure: TOTD_USD_C is 100 and the settle pays it through the ledger /gift as from:totd with once:86400, paging on a failed credit', /const TOTD_USD_C = 100;/.test(W) && /JSON\.stringify\(\{ acct: 'u:' \+ auid, cents: TOTD_USD_C, from: 'totd', once: 86400 \}\)/.test(W) && /kind: 'totd-pay-failed'/.test(W));
  chk('pure: the room is the source of the ballot - the cron runs totdBackfill, which enters closed wins shared today by author name, skips test authors and remembers only a final answer', W.includes("bg(totdBackfill, 'totdfill')") && W.includes('async function totdBackfill(env, o)') && W.includes('if (!uid && b.byName && b.auto)') && W.includes("['already_candidate', 'auto_cap', 'no_user', 'restricted']") && W.includes("if (/^e2e/i.test(String(snap.by || ''))) { skip('e2e')"));
  chk('pure: GET /api/totd publishes usd beside xp, under a bumped cache key', /xp: TOTD_XP, usd: TOTD_USD_C \/ 100 \}/.test(W) && /__totd_v2_/.test(W) && !/__totd_v1_/.test(W));
  chk('pure: mp-auth carries the panel (mpTotdPanel), the chat header chip (.ct-totd-btn) and the ?totd=1 opener', /window\.mpTotdPanel = \{ open: tpOpen/.test(MA) && /className = 'ct-totd-btn'/.test(MA) && /\[\?&\]totd=1/.test(MA));
  chk('pure: the homepage strip always prints and links the panel', /paper-trade\?totd=1/.test(HM) && /nominate and vote/.test(HM));
}
const TK = (id, status) => ({ v: 1, sym: 'SOL', side: 'long', status, entry: 80, exit: status === 'open' ? null : 84, lev: 10, roe: 50, pnl: 50, margin: 100, notional: 1000, qty: 12.5, ts: Date.now() - 3600000, closeTs: status === 'open' ? null : Date.now() - 600000, by: 'e2e_sharer', at: Date.now() });
async function mk(browser, url, w, o) {
  o = o || {}; const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport({ width: w, height: 900 });
  if (o.member) await p.setCookie({ name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
  await p.setRequestInterception(true); const posts = [];
  let state = o.state || { ok: true, day: DAY, today: true, cands: [], mine: null, nominated: false, signedIn: !!o.member, xp: 100 };
  p.on('request', r => { const u = r.url();
    if (u.indexOf('/api/track') >= 0) return r.respond({ status: 204, body: '' });
    if (u.indexOf('/api/auth/me') >= 0) return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(o.member ? { user: { id: 'e2evoter', username: 'e2e_voter', xp: 900 } } : { user: null }) });
    if (u.indexOf('/api/auth/xp') >= 0 && r.method() === 'GET') return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: !!o.member, xp: 900, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
    if (/\/api\/tshare\?id=/.test(u)) { const id = u.split('id=')[1].split('&')[0]; return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id, ticket: TK(id, id === 'e2eopen01' ? 'open' : 'win') }) }); }
    if (u.indexOf('/api/totd') >= 0 && r.method() === 'GET') return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(state) });
    if (u.indexOf('/api/totd') >= 0 && r.method() === 'POST') { let b = {}; try { b = JSON.parse(r.postData() || '{}'); } catch (e) {} posts.push(b); const ans = o.post ? o.post(b, state) : null; if (ans) state = Object.assign({}, state, ans.body); return r.respond({ status: ans ? ans.status : 200, contentType: 'application/json', body: JSON.stringify(ans ? ans.body : { ok: true }) }); }
    if (LOCAL) { const f = localFile(u); if (f && fs.existsSync(f)) { const ext = f.split('.').pop(); return r.respond({ status: 200, headers: { 'content-type': CT[ext] || 'application/octet-stream', 'cache-control': 'no-store' }, body: fs.readFileSync(f) }); } }
    r.continue(); });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('mp_ck_ok', '1'); } catch (e) {} });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  await p.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  return { ctx, p, errs, posts };
}
// a room row holding a shared ticket, hydrated by the real card code
const seedCard = async (p, id) => {
  await p.waitForFunction(() => !!(window.mpTradeCard && window.__mpTotd), { timeout: 40000 });
  // the row goes into the REAL room list with the chat box open, so reachability is measured where a reader meets the card
  await p.evaluate(() => { const fab = document.getElementById('chatFab'); const box = document.getElementById('chatBox'); if (fab && (!box || box.hidden || getComputedStyle(box).display === 'none')) fab.click(); });
  await p.waitForFunction(() => { const b = document.getElementById('chatBox'); return !!b && !b.hidden && getComputedStyle(b).display !== 'none' && !!document.getElementById('ctMsgs'); }, { timeout: 20000 }).catch(() => {});
  await sleep(1500); // the room's history frame lands after the socket connects and REPLACES the list - inject after it, and again if it was wiped
  for (let tries = 0; tries < 3; tries++) {
    await p.evaluate((id) => { if (document.querySelector('.ct-tk[data-trade="' + id + '"], a.ct-trade[data-trade="' + id + '"]')) return; let ms = document.getElementById('ctMsgs'); if (!ms) { ms = document.createElement('div'); ms.id = 'ctMsgs'; ms.className = 'ct-msgs'; document.body.appendChild(ms); } ms.insertAdjacentHTML('beforeend', '<div class="ct-msg" data-mid="m' + id + '"><div class="ct-body"><a class="ct-trade" data-trade="' + id + '">trade:' + id + '</a></div></div>'); window.mpTradeCard.hydrate(document); }, id);
    const ok = await p.waitForFunction((id) => !!document.querySelector('.ct-tk[data-trade="' + id + '"]'), { timeout: 6000 }, id).then(() => true).catch(() => false);
    if (ok) break;
  }
  await p.waitForFunction((id) => !!document.querySelector('.ct-tk[data-trade="' + id + '"]'), { timeout: 5000 }, id);
  await p.evaluate((id) => { const c = document.querySelector('.ct-tk[data-trade="' + id + '"]'); if (c) c.scrollIntoView({ block: 'center' }); }, id); await sleep(250);
};
const readRail = (id) => { const c = document.querySelector('.ct-tk[data-trade="' + id + '"]'); if (!c) return null; const r = c.querySelector('.ct-tk-totd'); const b = r && r.querySelector('.ct-tk-totdb'); return { rail: !!r, btn: !!b, txt: b ? b.textContent.trim() : '', op: b && b.getAttribute('data-totdop'), cls: b ? b.className : '', note: (r && r.querySelector('.ct-tk-totdn') || {}).textContent || '' }; };
(async () => {
  await withBrowser(async (browser) => {
    { // a member, a fresh closed card: Nominate -> the POST -> the rail becomes the own candidate
      const { ctx, p, errs, posts } = await mk(browser, '/paper-trade', 1366, { member: true, post: (b) => ({ status: 200, body: { ok: true, day: DAY, cands: [{ id: b.id, by: 'e2e_sharer', sym: 'SOL', side: 'long', roe: 50, pnl: 50, n: 0, own: true }], mine: null, nominated: true } }) });
      const ID = 'e2etotd01'; await p.evaluateOnNewDocument(() => {}); await p.evaluate((id) => { window.__e2eId = id; }, ID); await seedCard(p, ID); await p.waitForFunction((id) => !!document.querySelector('.ct-tk[data-trade="' + id + '"] .ct-tk-totdb'), { timeout: 15000 }, ID);
      const r0 = await p.evaluate(readRail, 'e2etotd01');
      chk('a closed card carries the rail with Nominate', !!r0 && r0.rail && r0.btn && /Nominate for trade of the day/.test(r0.txt) && r0.op === 'nominate', r0);
      const under = await p.evaluate(() => { const b = document.querySelector('.ct-tk[data-trade="' + window.__e2eId + '"] .ct-tk-totdb'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!(e && (e === b || b.contains(e))); });
      chk('the button is what sits under the pointer', under);
      await p.evaluate(() => document.querySelector('.ct-tk[data-trade="' + window.__e2eId + '"] .ct-tk-totdb').click()); await p.waitForFunction(() => window.__mpTotdLast && window.__mpTotdLast.ok, { timeout: 10000 }).catch(() => {});
      const r1 = await p.evaluate(readRail, 'e2etotd01');
      chk('the click posted {op:nominate,id} and the rail repainted as the own candidate (Vote, disabled, running)', posts.length === 1 && posts[0].op === 'nominate' && posts[0].id === 'e2etotd01' && r1.op === 'vote' && /own/.test(r1.cls) && /running/.test(r1.note), { posts, r1 });
      const opened = await p.evaluate(() => !!document.querySelector('.lb-tkm, #lbTkm, .tkm')); // a vote click must not open the ticket
      chk('the tap did not open the ticket modal', !opened);
      chk('no page errors', errs.length === 0, errs);
      await ctx.close(); }
    { // a member, a card already in the vote with 3 votes: Vote · 3 -> after the click the own vote is lit, 4
      const st = { ok: true, day: DAY, today: true, cands: [{ id: 'e2etotd02', by: 'e2e_sharer', sym: 'SOL', side: 'long', roe: 50, pnl: 50, n: 3, own: false }], mine: null, nominated: false, signedIn: true, xp: 100 };
      const { ctx, p, posts } = await mk(browser, '/paper-trade', 1366, { member: true, state: st, post: (b) => ({ status: 200, body: { ok: true, day: DAY, cands: [{ id: 'e2etotd02', by: 'e2e_sharer', sym: 'SOL', side: 'long', roe: 50, pnl: 50, n: 4, own: false }], mine: 'e2etotd02', nominated: false } }) });
      const ID = 'e2etotd02'; await p.evaluate((id) => { window.__e2eId = id; }, ID); await seedCard(p, ID); await p.waitForFunction((id) => !!document.querySelector('.ct-tk[data-trade="' + id + '"] .ct-tk-totdb'), { timeout: 15000 }, ID);
      const r0 = await p.evaluate(readRail, 'e2etotd02');
      chk('a candidate card says Vote with the count', !!r0 && r0.op === 'vote' && /Vote · 3/.test(r0.txt) && !/ on\b/.test(r0.cls), r0);
      await p.evaluate(() => document.querySelector('.ct-tk[data-trade="' + window.__e2eId + '"] .ct-tk-totdb').click()); await p.waitForFunction(() => window.__mpTotdLast && window.__mpTotdLast.ok, { timeout: 10000 }).catch(() => {});
      const r1 = await p.evaluate(readRail, 'e2etotd02');
      chk('after the vote the rail reads 4 and the own vote is lit', posts.length === 1 && posts[0].op === 'vote' && /Vote · 4/.test(r1.txt) && / on\b/.test(r1.cls), { posts, r1 });
      await ctx.close(); }
    { // a guest: the click opens sign-in, posts nothing; an OPEN card has no rail at all
      const { ctx, p, posts } = await mk(browser, '/paper-trade', 1366, { member: false });
      const ID = 'e2etotd03'; await p.evaluate((id) => { window.__e2eId = id; }, ID); await seedCard(p, ID); await p.waitForFunction((id) => !!document.querySelector('.ct-tk[data-trade="' + id + '"] .ct-tk-totdb'), { timeout: 15000 }, ID);
      await p.evaluate(() => { window.__opened = 0; var o = window.mpAuth.open; window.mpAuth.open = function () { window.__opened++; return o.apply(this, arguments); }; document.querySelector('.ct-tk[data-trade="' + window.__e2eId + '"] .ct-tk-totdb').click(); }); await sleep(400);
      const g = await p.evaluate(() => ({ opened: window.__opened, last: window.__mpTotdLast }));
      chk('a guest is sent to sign in and nothing is posted', g.opened === 1 && g.last && g.last.error === 'guest' && posts.length === 0, g);
      await seedCard(p, 'e2eopen01');
      const ro = await p.evaluate(readRail, 'e2eopen01');
      chk('an OPEN ticket carries no rail - only a finished trade can run', !!ro && !ro.rail, ro);
      await ctx.close(); }
    { // the homepage strip: yesterday's winner under the hero copy, reserved from the first frame
      const win = { ok: true, day: DAY, cands: [], win: { day: 'yesterday', id: 'x', by: 'e2e_sharer', sym: 'ETH', side: 'short', roe: 123.4, pnl: 61.7, n: 7, xp: 100 } };
      const { ctx, p } = await mk(browser, '/', 1366, { member: false, state: win });
      const got = await p.waitForFunction(() => /Trade of the day/.test((document.getElementById('ptTotd') || {}).textContent || ''), { timeout: 20000 }).then(() => p.evaluate(() => { const el = document.getElementById('ptTotd'); const r = el.getBoundingClientRect(); return { txt: el.textContent, h: Math.round(r.height), minH: getComputedStyle(el).minHeight }; })).catch(() => null);
      chk('the homepage hero names the winner: who, the market, the side, the ROE, the votes', !!got && /@e2e_sharer/.test(got.txt) && /ETH short/.test(got.txt) && /\+123\.4%/.test(got.txt) && /7 votes/.test(got.txt), got);
      chk('the strip had its room before the answer (min-height reserved)', !!got && got.minH === '20px', got && got.minH);
      await ctx.close(); }
  }, { timeoutMs: 420000 });
  if (PROD) {
    const KEY = fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
    const H = { 'content-type': 'application/json', 'x-admin-key': KEY };
    const adm = (body) => fetch(BASE + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify(body) }).then(r => r.json());
    const A = 'e2etotda' + Date.now().toString(36).slice(-4), B = 'e2etotdb' + Date.now().toString(36).slice(-4);
    await adm({ uid: A, op: 'mk' }); await adm({ uid: B, op: 'mk' });
    const sa = (await adm({ uid: A, op: 'sess' })).token, sb = (await adm({ uid: B, op: 'sess' })).token;
    const as = (tok, u, o) => fetch(BASE + u, Object.assign({ headers: Object.assign({ cookie: 'mp_sess=' + tok, 'content-type': 'application/json' }, (o && o.headers) || {}) }, o || {})).then(async r => ({ st: r.status, j: await r.json().catch(() => null) }));
    // A SHARED WIN IS ON THE BALLOT BY ITSELF (2026-11-13, owner: members shared their trades and none could be voted for - the second
    // tap, Nominate, was one nobody made). A shares a closed win: it is a candidate at once, as A's own entry, A's hand nomination still
    // free; nominating it by hand says it already stands; A cannot vote for it; B votes; a loss does NOT enter by itself; a test author is
    // off the public ballot and visible with ?e2e=1.
    const sh = await as(sa, '/api/tshare', { method: 'POST', body: JSON.stringify({ ticket: { sym: 'SOL', side: 'long', status: 'win', entry: 80, exit: 84, lev: 10, roe: 50, pnl: 50, margin: 100, ts: Date.now() - 3600000, closeTs: Date.now() - 60000 } }) });
    const id = sh.j && sh.j.id; chk('prod: a closed ticket is shared', sh.st === 200 && !!id, sh);
    await new Promise(r => setTimeout(r, 2500)); // the entry rides on waitUntil behind the share's own response
    const b0 = await as(sa, '/api/totd?nc=1', {});
    chk('prod: the shared win is on the board by itself - the sharer\'s own entry, 0 votes, the hand nomination still free', b0.st === 200 && b0.j && b0.j.cands.some(c => c.id === id && c.own && c.n === 0) && b0.j.nominated === false, b0.j);
    const n1 = await as(sa, '/api/totd', { method: 'POST', body: JSON.stringify({ op: 'nominate', id }) });
    chk('prod: nominating it by hand answers already_candidate', n1.st === 409 && n1.j && n1.j.error === 'already_candidate', n1);
    const v0 = await as(sa, '/api/totd', { method: 'POST', body: JSON.stringify({ op: 'vote', id }) });
    chk('prod: the author cannot vote for their own entry (403 own)', v0.st === 403 && v0.j && v0.j.error === 'own', v0);
    const v1 = await as(sb, '/api/totd', { method: 'POST', body: JSON.stringify({ op: 'vote', id }) });
    chk('prod: the other member votes - 1 vote, mine set', v1.st === 200 && v1.j && v1.j.ok && v1.j.mine === id && v1.j.cands.some(c => c.id === id && c.n === 1), v1.j);
    const shl = await as(sa, '/api/tshare', { method: 'POST', body: JSON.stringify({ ticket: { sym: 'ETH', side: 'short', status: 'loss', entry: 2500, exit: 2550, lev: 10, roe: -20, pnl: -20, margin: 100, ts: Date.now() - 3600000, closeTs: Date.now() - 60000 } }) });
    await new Promise(r => setTimeout(r, 2000));
    const b1 = await as(sa, '/api/totd?nc=1', {});
    chk('prod: a shared LOSS does not enter by itself', shl.st === 200 && b1.j && !b1.j.cands.some(c => c.id === (shl.j && shl.j.id)), b1.j && b1.j.cands.map(c => c.id));
    const n2 = await as(sa, '/api/totd', { method: 'POST', body: JSON.stringify({ op: 'nominate', id: 'zzzz0000zzzz' }) });
    chk('prod: a hand nomination of an unknown share is refused', n2.st >= 400 && n2.j && (n2.j.error === 'already_nominated' || n2.j.error === 'not_found'), n2);
    const gPub = await fetch(BASE + '/api/totd?nc=1').then(r => r.json());
    chk('prod: a test author is NOT on the public ballot', gPub && gPub.ok && !gPub.cands.some(c => c.id === id) && !gPub.cands.some(c => /^e2e/i.test(c.by)), gPub && gPub.cands && gPub.cands.map(c => c.by));
    const g = await fetch(BASE + '/api/totd?nc=1&e2e=1').then(r => r.json());
    chk('prod: with ?e2e=1 the board carries the candidate with its vote', g && g.ok && g.cands.some(c => c.id === id && c.n === 1), g && g.cands && g.cands.length);
    const dry = await fetch(BASE + '/api/admin/totd?settle=1&dry=1&e2e=1&day=' + DAY, { headers: H }).then(r => r.json());
    chk('prod: a dry settle of today names the winner without writing', dry && dry.ok && dry.dry && dry.winner && dry.winner.id === id, dry);
    const open = await as(sa, '/api/tshare', { method: 'POST', body: JSON.stringify({ ticket: { sym: 'BTC', side: 'long', status: 'open', entry: 70000, lev: 5, margin: 100, ts: Date.now() } }) });
    const n3 = await as(sb, '/api/totd', { method: 'POST', body: JSON.stringify({ op: 'nominate', id: open.j && open.j.id }) });
    chk('prod: an OPEN ticket cannot be nominated', n3.st === 400 && n3.j && n3.j.error === 'not_closed', n3);
    await adm({ uid: A, op: 'rm' }); await adm({ uid: B, op: 'rm' });
  }
  console.log('\ntotd-e2e: ' + okN + ' passed, ' + failN + ' failed' + (LOCAL ? ' [local]' : '') + (PROD ? ' [+prod]' : ''));
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
