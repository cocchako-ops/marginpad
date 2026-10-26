/* wd-same-target-e2e (2026-10-26): THE WITHDRAWALS DESK NAMES WHO ELSE WITHDREW TO THE SAME UID / MOON NAME
   (owner: "ako je neko ranije vec povlacio na taj isti, treba da mi izadje taj i taj je vec povlacio na ovaj username/uid").
   Two throwaway members each ask for a $5 payout to the SAME Moon username; the admin list must attach, on each row, the
   OTHER account by name (pending twin). The paid wording is proven on the shipped client function with fixtures - a paid e2e
   row would sit in the owner's money book for ever (the ledger keeps paid rows, e2euser rm cannot reach them), so nothing
   here is ever marked paid. Then the real dashboard in a browser: the warning is painted on the row and names the twin.
   Cleans up: both withdrawals cancelled silently (refund), balances drained, members removed.
   Needs ADMIN_KEY.local.txt (the mpadm_ token). Pays nobody.                               node build/wd-same-target-e2e.js */
const fs = require('fs'), path = require('path');
const KEY = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io';
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 260) : '')); };
const J = (u, o) => fetch(B + u, o).then(r => r.json());
const TARGET = 'moon:e2ewdsame';
const M = [{ uid: 'e2e-wdsame1' }, { uid: 'e2e-wdsame2' }].map(m => ({ ...m, un: 'e2e_' + m.uid }));

// ---- 1. the client sentence, lifted out of the SHIPPED ops.js.txt (no browser, no network) ----
function liftWdShared() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'ops', 'client', 'ops.js.txt'), 'utf8');
  const i = src.indexOf('function wdShared(w, vv)'); if (i < 0) throw new Error('wdShared not in ops.js.txt');
  let j = src.indexOf('{', i), depth = 0; for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
  const fn = src.slice(i, j + 1);
  const stubs = 'var esc=function(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",\'"\':"&quot;"}[c];});};var N=function(n){return String(n);};var USD=function(v){return "$"+(+v||0).toFixed(2);};var ago=function(){return "3d";};var userHref=function(u){return "/api/admin/user?username="+u;};';
  return new Function(stubs + fn + ';return wdShared;')();
}
try {
  const wdShared = liftWdShared();
  const BY = { k: 'bybit', label: 'Bybit' }, MO = { k: 'moon', label: 'Moon' };
  ok(wdShared({ shared: [] }, BY) === '' && wdShared({}, BY) === '', 'a target nobody else used carries nothing');
  const p = wdShared({ shared: [{ who: 'alice', paidN: 2, paidUsd: 12.3, pendN: 0, otherN: 0, last: 1 }] }, BY);
  ok(/@alice<\/b><\/a> already withdrew to this Bybit UID - 2 paid, \$12\.30, last 3d ago/.test(p) && /badge red">SAME UID/.test(p) && /wd-same paid/.test(p), 'PAID twin: "@alice already withdrew to this Bybit UID", red', p.slice(0, 200));
  const q = wdShared({ shared: [{ who: 'bob', paidN: 0, paidUsd: 0, pendN: 1, otherN: 0, last: 1 }] }, MO);
  ok(/@bob<\/b><\/a> also has a pending withdrawal to this Moon username/.test(q) && /badge amber">SAME ACCOUNT/.test(q) && !/wd-same paid/.test(q), 'pending twin on a Moon name: its own sentence, amber, "SAME ACCOUNT"', q.slice(0, 200));
  const r = wdShared({ shared: [{ who: 'cara', paidN: 0, paidUsd: 0, pendN: 0, otherN: 2, last: 1 }] }, BY);
  ok(/asked for a payout to this Bybit UID before \(2 refused or withdrawn\)/.test(r), 'a refused-only twin is never called "withdrew"', r.slice(0, 200));
  const many = wdShared({ shared: [1, 2, 3, 4, 5].map(n => ({ who: 'u' + n, paidN: 0, pendN: 1, otherN: 0, last: n })) }, BY);
  ok((many.match(/<br>/g) || []).length === 3 && /\+2 more accounts/.test(many), 'at most three named, the rest counted');
  ok(/<b>@&lt;x&gt;<\/b>/.test(wdShared({ shared: [{ who: '<x>', paidN: 1, paidUsd: 1, pendN: 0, otherN: 0, last: 1 }] }, BY)), 'a username is escaped');
} catch (e) { ok(false, 'lifting wdShared out of ops.js.txt', String(e)); }

(async () => {
  const near = (a, b) => Math.abs(a - b) < 0.001;
  const sess = {};
  for (const m of M) {
    await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: m.uid, op: 'rm' }) }).catch(() => {});
    const mk = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: m.uid, op: 'mk' }) });
    const se = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: m.uid, op: 'sess' }) });
    m.MH = { cookie: 'mp_sess=' + (se.token || se.sess), 'content-type': 'application/json' };
    const who = await J('/api/admin/xpdiag?u=' + encodeURIComponent(m.un), { headers: H });
    m.id = who && who.user && who.user.id;
    ok(mk && m.id, 'throwaway member ' + m.un + ' minted', { id: !!m.id });
    const cr = await J('/api/admin/credit', { method: 'POST', headers: H, body: JSON.stringify({ username: m.un, usd: 6, op: 'gift', note: 'wd-same-target-e2e' }) });
    ok(cr && (cr.ok || cr.balanceUsd != null), m.un + ' credited $6.00', cr);
    const me = await J('/api/reward/me', { headers: m.MH }); m.bal = +((me || {}).balance || 0);
    ok(me && m.bal >= 6 && me.canWithdraw === true, m.un + ' can withdraw', { bal: m.bal });
  }
  // ---- 2. both ask for a payout to the SAME target ----
  for (const m of M) {
    const w = await fetch(B + '/api/reward/withdraw', { method: 'POST', headers: m.MH, body: JSON.stringify({ address: TARGET, amountUsd: 5 }) });
    const j = await w.json(); m.wd = j.id;
    ok(w.status === 200 && j.ok && near(j.amount, 5) && j.id, m.un + ' queued $5.00 to ' + TARGET, j);
  }
  // ---- 3. the admin list names the twin on each row ----
  const sm = await J('/api/stats/session', { method: 'POST', headers: { 'x-admin-key': KEY } });
  ok(sm && sm.ok && /^[0-9a-f]{64}$/.test(sm.token), 'admin session minted');
  const AH = { cookie: 'mp_sadm=' + sm.token };
  const list = await J('/api/admin/withdrawals', { headers: AH });
  const rowOf = m => (list.wds || []).find(w => w.id === m.wd);
  const r1 = rowOf(M[0]), r2 = rowOf(M[1]);
  ok(r1 && r2, 'both rows are on the desk', { r1: !!r1, r2: !!r2 });
  if (r1 && r2) {
    ok(Array.isArray(r1.shared) && r1.shared.length === 1 && r1.shared[0].who === M[1].un && r1.shared[0].acct === 'u:' + M[1].id && r1.shared[0].pendN === 1 && r1.shared[0].paidN === 0, 'row 1 names member 2 as a pending twin, by username', r1.shared);
    ok(Array.isArray(r2.shared) && r2.shared.length === 1 && r2.shared[0].who === M[0].un && r2.shared[0].acct === 'u:' + M[0].id && r2.shared[0].pendN === 1, 'row 2 names member 1', r2.shared);
    ok(!r1.shared.some(s => s.acct === r1.acct) && !r2.shared.some(s => s.acct === r2.acct), 'a row never lists its own account as a twin');
    ok(r1.wallet === TARGET && r2.wallet === TARGET, 'both rows carry the target as typed');
  }
  const stranger = (list.wds || []).filter(w => w.id !== M[0].wd && w.id !== M[1].wd && String(w.wallet || '').toLowerCase() === TARGET);
  ok(stranger.length === 0, 'no third account on the e2e target (a leftover from an aborted run would be one)', stranger.map(s => s.who));
  // ---- 4. the dashboard paints it ----
  try {
    const { withBrowser } = require(path.join(__dirname, 'e2e-browser.js'));
    await withBrowser(async (browser) => {
      const page = await browser.newPage(); await page.setViewport({ width: 1366, height: 900 });
      await page.setCookie({ name: 'mp_sadm', value: sm.token, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true });
      await page.goto(B + '/api/stats#money/withdrawals', { waitUntil: 'domcontentloaded', timeout: 60000 });
      let got = null;
      for (let i = 0; i < 40 && !got; i++) { await new Promise(r => setTimeout(r, 750)); got = await page.evaluate((un1, un2) => { const el = Array.from(document.querySelectorAll('#view .wd-same')).find(x => x.innerText.indexOf(un1) >= 0 || x.innerText.indexOf(un2) >= 0); if (!el) return null; const r = el.getBoundingClientRect(); el.scrollIntoView({ block: 'center' }); const r2 = el.getBoundingClientRect(); const hit = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2); return { text: el.innerText, h: r.height, reach: !!(hit && el.contains(hit)), paid: el.classList.contains('paid'), n: document.querySelectorAll('#view .wd-same').length }; }, M[0].un, M[1].un); }
      ok(!!got, 'the warning is painted on the desk', got && got.text);
      if (got) {
        ok(/SAME ACCOUNT/.test(got.text) && /also has a pending withdrawal to this Moon username/.test(got.text) && (got.text.indexOf(M[0].un) >= 0 || got.text.indexOf(M[1].un) >= 0), 'it reads "@twin also has a pending withdrawal to this Moon username"', got.text);
        ok(got.reach && got.h > 10 && !got.paid, 'reachable, and amber (nobody was paid)', { h: got.h, reach: got.reach, paid: got.paid });
      }
      const q = await page.evaluate((un) => { const i = document.getElementById('wdq'); if (!i) return null; i.value = un; i.dispatchEvent(new Event('input')); return true; }, M[1].un);
      await new Promise(r => setTimeout(r, 2500));
      const found = await page.evaluate((un1) => Array.from(document.querySelectorAll('#view .tbl tbody tr')).some(tr => tr.innerText.indexOf('@' + un1) >= 0), M[0].un);
      ok(q && found, 'searching the TWIN\'s name also finds the other member\'s row (the warning names them)', { found });
      await page.close();
    });
  } catch (e) { ok(false, 'browser leg', String(e).slice(0, 200)); }
  // ---- 5. clean up: cancel silently (refund), drain, remove ----
  for (const m of M) {
    if (m.wd) { const cx = await J('/api/reward/wd/cancel', { method: 'POST', headers: H, body: JSON.stringify({ id: m.wd }) }); ok(cx && cx.ok && near(+cx.refundedUsd, 5), m.un + ': withdrawal cancelled, $5.00 refunded', cx); }
    const me = await J('/api/reward/me', { headers: m.MH }); let left = +((me || {}).balance || 0), dbOk = true;
    while (left > 0.004) { const step = Math.min(5, Math.round(left * 100) / 100); const db = await J('/api/admin/credit', { method: 'POST', headers: H, body: JSON.stringify({ username: m.un, usd: step, op: 'debit', note: 'wd-same-target-e2e' }) }); if (!(db && (db.ok || db.balanceUsd != null))) { dbOk = false; break; } left = Math.round((left - step) * 100) / 100; }
    const me9 = await J('/api/reward/me', { headers: m.MH });
    ok(dbOk && me9 && +me9.balance < 0.005, m.un + ': test money taken back', { bal: me9 && me9.balance });
    await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: m.uid, op: 'rm' }) });
  }
  const after = await J('/api/admin/withdrawals', { headers: AH });
  ok(!(after.wds || []).some(w => String(w.wallet || '').toLowerCase() === TARGET), 'nothing left on the desk for the e2e target');
  console.log(out.join('\n')); console.log('\nwd-same-target-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); console.log(out.join('\n')); process.exitCode = 1; });
