/* Bot API 2.5 E2E (phase 1 of the API plan, 2026-09-12): books, reset, equity, arena, usage. Proves on prod with a
   throwaway member: a key bound to a book trades a separate journal from the main key; /v1/accounts lists both with
   the right numbers; reset is refused while a position is open, then archives the closes and restarts the ledger,
   the report and the equity curve; /v1/usage carries usage_30d; /api/arena and /arena/ answer; named errors intact.
   Run: node build/api-phase1-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jget = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b) => fetch(ORIGIN + p, { method: 'POST', headers: H, body: JSON.stringify(b || {}) }).then(jget);
const out = []; const chk = (n, ok, x) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 260) : '')); console.log(out[out.length - 1]); };
const UID = 'e2eph1' + Math.random().toString(36).slice(2, 6);
(async () => {
  try {
    await post('/api/admin/e2euser', { uid: UID, op: 'mk' }); const se = await post('/api/admin/e2euser', { uid: UID, op: 'sess' }); const cookie = 'mp_sess=' + se.body.token;
    const mintK = async (name, book) => (await fetch(ORIGIN + '/api/bot/key', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ act: 'create', name, book }) })).json();
    const k1 = await mintK('main-key'), k2 = await mintK('rsi-key', 'rsi');
    chk('two keys: one on the main account, one bound to the book "rsi"', !!k1.key && !!k2.key && k2.book === 'rsi' && k1.plan && k1.plan.max_books >= 1, { book: k2.book, plan: k1.plan });
    const k3 = await mintK('second-book', 'macd');
    chk('a free account cannot open a second book (max_books)', k3.error === 'max_books' && k3.max === 1, k3);
    const bot = (key) => (p, b) => fetch(ORIGIN + '/api/bot/v1' + p, { method: b ? 'POST' : 'GET', headers: { 'x-api-key': key, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }).then(jget);
    const M = bot(k1.key), B = bot(k2.key);
    const o = await B('/open', { symbol: 'BTC', side: 'long', leverage: 10, margin_usd: 50, client_order_id: 'ph1-' + Date.now() });
    chk('the book key opens a position', o.status === 200 && o.body.ok && o.body.position, { status: o.status, id: o.body.position && o.body.position.id });
    const pm = await M('/positions'), pb = await B('/positions');
    chk('the main key sees NO position, the book key sees ONE (separate journals)', (pm.body.positions || []).length === 0 && (pb.body.positions || []).length === 1, { main: (pm.body.positions || []).length, book: (pb.body.positions || []).length });
    const am = await M('/account'), ab = await B('/account');
    chk('/v1/account names the book: main vs rsi', am.body.account === 'main' && ab.body.account === 'rsi' && ab.body.open_positions === 1, { main: am.body.account, book: ab.body.account, openB: ab.body.open_positions });
    const acc = await M('/accounts');
    const names = (acc.body.accounts || []).map(a => a.account);
    chk('/v1/accounts lists main and rsi with keys and numbers', acc.status === 200 && names.indexOf('main') >= 0 && names.indexOf('rsi') >= 0 && (acc.body.accounts.filter(a => a.account === 'rsi')[0] || {}).open_positions === 1, { names, this_key: acc.body.this_key_account });
    const rNo = await B('/reset', { confirm: true });
    chk('reset refused while the position is open (409 open_positions_exist)', rNo.status === 409 && rNo.body.error === 'open_positions_exist', rNo.body);
    const rConf = await B('/reset', {});
    chk('reset without confirm -> 400 confirm_required', rConf.status === 400 && rConf.body.error === 'confirm_required');
    const ca = await B('/close_all', {}); chk('close_all on the book closes it', ca.status === 200 && ca.body.closed === 1, { closed: ca.body.closed });
    await sleep(800);
    const tr1 = await B('/trades?limit=10'); chk('the book has one closed trade in its ledger', tr1.status === 200 && (tr1.body.trades || []).length === 1, { n: (tr1.body.trades || []).length });
    const rs = await B('/reset', { confirm: true });
    chk('reset archives the close and restarts the book', rs.status === 200 && rs.body.ok && rs.body.archived_trades === 1 && rs.body.reset_ts > 0, rs.body);
    const tr2 = await B('/trades?limit=10'), ab2 = await B('/account'), rep = await B('/report?days=7');
    chk('after reset: ledger empty, account back to $10,000, report has no closes', (tr2.body.trades || []).length === 0 && ab2.body.closed_trades === 0 && Math.abs(ab2.body.balance_usd - 10000) < 0.01 && rep.body.total && rep.body.total.n === 0, { trades: (tr2.body.trades || []).length, closed: ab2.body.closed_trades, bal: ab2.body.balance_usd, repN: rep.body.total && rep.body.total.n });
    const mainStill = await M('/positions'); chk('the main account is untouched by the book reset', (mainStill.body.positions || []).length === 0);
    const eq = await B('/equity?days=7&step_min=60');
    chk('/v1/equity: points + live now point + drawdown', eq.status === 200 && eq.body.ok && Array.isArray(eq.body.points) && eq.body.points.length > 0 && eq.body.now && Math.abs(eq.body.now.equity_usd - 10000) < 0.01 && eq.body.starting_balance_usd === 10000, { n: eq.body.points && eq.body.points.length, now: eq.body.now, dd: eq.body.max_drawdown_pct });
    const us = await B('/usage');
    chk('/v1/usage carries usage_30d with today and the account name', us.status === 200 && Array.isArray(us.body.usage_30d) && us.body.usage_30d.length >= 1 && us.body.usage_30d[us.body.usage_30d.length - 1].calls >= 3 && us.body.account === 'rsi', { days: us.body.usage_30d && us.body.usage_30d.length, today: us.body.usage_30d && us.body.usage_30d[us.body.usage_30d.length - 1], account: us.body.account });
    const lm = await B('/open', { symbol: 'BTC', side: 'long', leverage: 5000, margin_usd: 10 }); chk('named errors still in force on a book (leverage_max)', lm.status === 400 && lm.body.error === 'leverage_max');
    const ar = await fetch(ORIGIN + '/api/arena?cb=' + Date.now()).then(jget);
    chk('/api/arena answers with the season and rows (e2e accounts excluded)', ar.status === 200 && ar.body.ok && ar.body.season && Array.isArray(ar.body.rows) && !ar.body.rows.some(r => /^e2e_/i.test(r.who)), { season: ar.body.season && ar.body.season.idx, rows: ar.body.rows && ar.body.rows.length, first: ar.body.rows && ar.body.rows[0] && ar.body.rows[0].who });
    const cl = await fetch(ORIGIN + '/api/changelog.json').then(jget); chk('changelog carries 2.5.0 (books, reset, equity, arena)', cl.body.data && cl.body.data.changelog.some(c => c.version === '2.5.0'));
    await withBrowser(async (browser) => {
      const page = await browser.newPage(); await page.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true });
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
      await page.goto(ORIGIN + '/arena/?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await sleep(3500);
      const m = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, season: document.getElementById('season').textContent, rows: document.querySelectorAll('#rows tr').length, sw: document.documentElement.scrollWidth, iw: innerWidth, txt: document.getElementById('rows').innerText.slice(0, 80) }));
      chk('/arena/ renders the season line and the board (or the honest empty state) on a phone, no sideways scroll', /Bots ranked/.test(m.h1) && /Season/.test(m.season) && m.rows >= 1 && m.sw <= m.iw, m);
      chk('/arena/ no page errors', errs.length === 0, errs);
      await page.close();
      // the key manager on /trading-api/: book column + usage panel for a signed-in member
      const p2 = await browser.newPage(); await p2.setViewport({ width: 1366, height: 900 });
      await p2.setCookie({ name: 'mp_sess', value: se.body.token, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/', secure: true }, { name: 'mp_ck', value: '1', domain: 'marginpad.io', path: '/', secure: true });
      const errs2 = []; p2.on('pageerror', e => errs2.push(String(e.message).slice(0, 120)));
      await p2.goto(ORIGIN + '/trading-api/?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await sleep(5000);
      const km = await p2.evaluate(() => ({ heads: Array.from(document.querySelectorAll('#akbTable thead th')).map(t => t.textContent), books: Array.from(document.querySelectorAll('#akbTable tbody tr td:nth-child(2)')).map(t => t.textContent.trim()), useHidden: (document.getElementById('akbUse') || { hidden: true }).hidden, useRows: document.querySelectorAll('#akbUse .u').length, bookInput: !!document.getElementById('akbBook') }));
      chk('/trading-api/ key manager shows the Book column (main + rsi), the book input and the usage panel', km.heads.indexOf('Book') >= 0 && km.books.indexOf('rsi') >= 0 && km.books.indexOf('main') >= 0 && km.bookInput && !km.useHidden && km.useRows >= 2, km);
      chk('/trading-api/ no page errors', errs2.length === 0, errs2);
      await p2.close();
    }, { timeoutMs: 120000 });
  } finally { try { await post('/api/admin/e2euser', { uid: UID, op: 'rm' }); } catch (e) {} }
  const bad = out.filter(l => l.slice(0, 4) === 'FAIL').length; console.log('\n' + out.length + ' checks, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
})();
