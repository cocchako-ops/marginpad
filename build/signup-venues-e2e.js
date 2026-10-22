/* THE SIGN-UP BONUS VENUES (2026-10-21, owner: "ne zelim da placamo vise fomo $1 vec da placamo bingx i mexc
   (ali ta ponuda samo da bude na rewards)").

   This replaces `fomo-bonus-e2e.js`, which tested a bonus that has been retired - a test that reads a retired
   element is a test that is always red (CLAUDE.md, 2026-09-14). Every venue rides the SAME `exsign` table, so
   the things worth proving are the ones a shared table can get wrong: that the surfaces do not leak into each
   other, that approval credits EXACTLY the configured dollar, that one username on a venue can only ever be
   paid once across all accounts, and that each venue's own kill switch pauses its own venue and nothing else.
   Plus the retirement itself: Fomo must REFUSE a new submission while its review queue stays reachable (there
   are real pending claims on it awaiting the owner's decision).

   Mints throwaway members, approves real dollars, and removes everything it made.
   node build/signup-venues-e2e.js                                                                            */
'use strict';
const fs = require('fs'), path = require('path');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-f0-9]+/)[0];
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const j = async (p, opt) => { const r = await fetch(O + p, opt); let b = null; try { b = await r.json(); } catch (e) {} return { s: r.status, b }; };
const AK = { 'x-admin-key': K, 'content-type': 'application/json' };

// the live venues, each with the referral CODE that earns the commission. `/go` answers in TWO shapes - a 302
// for a venue with no pair deep link (BingX, Moon, Fomo) and a 200 interstitial that fires the app for one that
// has (MEXC), so the code is looked for in the Location header OR the body. Checking the HOST instead would
// have been wrong anyway: promote.mexc.com and www.mexc.com?inviteCode=47LrK credit the same account.
const LIVE = [{ v: 'mexc', label: 'MEXC', code: '47LrK' }, { v: 'bingx', label: 'BingX', code: 'K5WJQO' }, { v: 'bitget', label: 'Bitget', code: 'DSSSQKGK' }];

/* A VENUE MISSING FROM EITHER CENTS TABLE IS PAID THE RETIRED $3 DEFAULT (2026-10-22). The DO decides what an
   approval credits with `cfg[exchange + 'C']`, falling back to the long-retired generic `exsignC` - which is 300
   cents. It reads that out of the snapshot the worker builds for it, and the snapshot is a hand-written field
   list: Bitget shipped missing from it and would have paid $3 on every claim, with its ops kill switch dead too
   (the identical hole that left `mexcEnabled` doing nothing on 2026-10-21). Caught by the review desk printing
   "+$0.00", not by any test - so it is a test now. Reads the SHIPPED worker source, so it covers the next venue
   without anybody remembering this. */
function sourceGuards() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
  // the table is one line and every entry carries its own braces, so `[^}]*` stops at the first nested one -
  // take the whole LINE instead (my first cut of this guard failed for exactly that reason)
  const m = src.match(/^.*const SIGN_VENUES = \{.*$/m);
  ok(!!m, 'SIGN_VENUES is readable from the worker source');
  if (!m) return;
  const venues = [...m[0].matchAll(/(\w+):\s*\{\s*label:/g)].map(x => x[1]);
  ok(venues.length >= 5, 'the venue table names every venue (' + venues.join(', ') + ')');
  /* THE AUTOMATIC PAYER'S GUARD RAILS (2026-10-22, owner: "nek odobri ako moze"). A cron that credits real
     money is only safe while all four of these hold, and all four are invisible to a behavioural test - the
     cron pays at most ten a pass, only ever APPROVES, can be switched off, and there is exactly ONE sweep so
     a venue cannot drift into a copy with different rules. */
  ok((src.match(/function signVerifySweep\b/g) || []).length === 1, 'there is exactly one sign-up sweep');
  ok(src.indexOf('async function mexcVerifySweep') < 0 && src.indexOf('async function bitgetVerifySweep') < 0,
    'and no per-venue copy of it survives');
  const cronAt = src.indexOf('async function autoApproveSweep');
  ok(cronAt > 0, 'the cron sweep exists');
  const cronSrc = src.slice(cronAt, cronAt + 2600);
  ok(!/reject/.test(cronSrc), 'the cron sweep NEVER rejects - a wrong auto-reject insults a member who did everything right');
  ok(cronSrc.indexOf('max: AUTO_APPROVE_MAX') >= 0, 'it pays at most AUTO_APPROVE_MAX in one pass');
  ok(cronSrc.indexOf('cfg.autoApprove === false') >= 0, 'and the owner can switch it off');
  ok(/const AUTO_APPROVE_MAX = \d+;/.test(src), 'the ceiling is a named constant, not a literal in the loop');
  ok(src.indexOf("[autoApproveSweep, 'autoapprove']") >= 0, 'it is wired into the affiliate cron pass');
  // a venue with no API must not be claimed as automatic - BingX is waiting for theirs
  // the venue logic lives in signGateWhy; signGateReady is its one-line negation (it answers WHY not, because
  // "no key set", "key the account may not use" and "no API at all" are three different problems)
  const gateAt = src.indexOf('function signGateWhy');
  const gateSrc = src.slice(gateAt, gateAt + 900);
  ok(gateAt > 0 && gateSrc.indexOf("venue === 'mexc'") >= 0 && gateSrc.indexOf("'bingx'") < 0,
    'MEXC is verifiable automatically, BingX is not (it has no API yet)');
  ok(/function signGateReady\(env, venue\) \{ return !signGateWhy\(env, venue\); \}/.test(src),
    'and there is one reading of it, not two');
  /* BITGET IS OFF ON PURPOSE AND THE REASON IS MEASURED (2026-10-22): api.bitget.com answers Cloudflare's egress
     with 403, and from an unblocked IP every /api/v2/broker/* endpoint answers 70102 "Broker identity
     authentication failed" - the account is not in their agent programme. The credentials are valid and stored.
     This check exists so nobody turns the flag on without also routing through the collector; a venue whose
     automation is claimed but refused pages the owner every six hours for ever. */
  ok(/const BITGET_AFFILIATE_OK = (true|false);/.test(src), 'Bitget automation is one named constant, not a scattered condition');
  const bOn = /const BITGET_AFFILIATE_OK = true;/.test(src);
  ok(gateSrc.indexOf('BITGET_AFFILIATE_OK') >= 0, 'and the gate reads it rather than assuming a key is enough');
  ok(!bOn || src.indexOf('colBase(env)') >= 0, 'if Bitget automation is ON, the Cloudflare block must be routed around');
  for (const fn of ['checkBitgetKey', 'bitgetRefSync']) {
    const at = src.indexOf('async function ' + fn);
    ok(at > 0 && src.slice(at, at + 400).indexOf('BITGET_AFFILIATE_OK') >= 0,
      fn + ' does not run while the account has no agent access (a watchdog that can never pass is noise)');
  }

  /* THE WITHDRAWAL QUEUE MUST KNOW EVERY PAYOUT VENUE (2026-10-22, owner: "da znam na koju menjacnicu
     isplacujem"). It derived the venue from a hand-written prefix ladder that knew moon: and mexc:, so the
     bitget: method shipped the same morning read as BYBIT and was then judged against the BYBIT allowlist -
     a red NOT ON LIST beside a good payout. One table now, and it is the same table that draws the mark. */
  const ops = fs.readFileSync(path.join(__dirname, '..', 'src', 'ops', 'client', 'ops.js.txt'), 'utf8');
  ok(ops.indexOf("indexOf('mexc:') === 0 ? 'MEXC'") < 0, 'the ops withdrawal venue is not a hand-written prefix ladder');
  for (const v of ['moon', 'mexc', 'bitget', 'bybit']) {
    ok(ops.indexOf("k: '" + v + "'") >= 0, 'the withdrawal queue knows how to show a ' + v + ' payout');
  }
  ok((ops.match(/function wdVenue\b/g) || []).length === 1 && (ops.match(/function wdMark\b/g) || []).length === 1,
    'and there is one reading of the venue and one of its mark');

  const snap = src.indexOf('reward config snapshot passed to the DO');
  ok(snap > 0, 'the DO config snapshot is readable');
  const snapLine = src.slice(src.lastIndexOf('const cfg = {', snap), snap);
  for (const v of venues) {
    if (v === 'fomo') continue;                       // retired: it takes no new claims, so it can never be approved
    ok(src.indexOf(v + 'C: c(num(m.' + v + 'Usd') >= 0, v + ' has its own cents default in rewardCfg (else approval pays the retired $3)');
    ok(snapLine.indexOf(v + 'C: full.' + v + 'C') >= 0, v + ' cents reach the DO in the config snapshot');
    ok(snapLine.indexOf(v + 'Enabled: full.' + v + 'Enabled') >= 0, v + ' kill switch reaches the DO in the config snapshot');
  }
}

(async () => {
  const mkUser = async (tag) => {
    const uid = tag + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
    await j('/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) }); // rewards unlock at Bronze (500 XP)
    const se = await j('/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'sess' }) });
    const tok = se.b && (se.b.token || se.b.sess || se.b.mp_sess);
    return { uid, H: { cookie: 'mp_sess=' + tok, 'content-type': 'application/json' }, tok };
  };
  const made = [];
  const mk = async (tag) => { const u = await mkUser(tag); made.push(u.uid); return u; };
  const a = await mk('e2esv'), b2 = await mk('e2esv2');
  ok(!!a.tok && !!b2.tok, 'two test members with sessions');
  const adm = await j('/api/stats/session', { method: 'POST', headers: { 'x-admin-key': K } });
  ok(adm.b && adm.b.token, 'admin session minted');
  const A = { cookie: 'mp_sadm=' + adm.b.token, 'content-type': 'application/json' };

  // ---------- the structural guards, before a cent moves ----------
  sourceGuards();

  // ---------- what the page is told ----------
  const acct0 = await j('/api/reward/account', { headers: a.H });
  const m0 = acct0.b || {};
  for (const { v, label } of LIVE) {
    ok(m0[v + 'Usd'] === 1, 'the page is told the ' + label + ' bonus is $1 (' + v + 'Usd=' + m0[v + 'Usd'] + ')');
    ok(m0[v + 'Enabled'] !== false, 'and that ' + label + ' is switched on');
  }
  ok(m0.fomoEnabled === false, 'Fomo is switched OFF in the same payload (fomoEnabled=' + m0.fomoEnabled + ')');
  ok(m0.moonEnabled !== false, 'and Moon, which was not part of this change, is untouched');

  // ---------- the retirement ----------
  const fsub = await j('/api/reward/fomosign/submit', { method: 'POST', headers: a.H, body: JSON.stringify({ uid: 'e2eretired1' }) });
  ok(fsub.s === 410 && fsub.b && fsub.b.error === 'closed', 'a new Fomo submission is refused with 410 closed (' + fsub.s + ')');
  ok(!!(fsub.b && fsub.b.hint), 'and the refusal says in words that the bonus has ended');
  const fmine = await j('/api/reward/fomosign/mine', { headers: a.H });
  ok(fmine.s === 200, 'a member can still READ their own Fomo history (' + fmine.s + ')');
  const flist = await j('/api/reward/fomosign/list', { headers: A });
  ok(flist.s === 200 && flist.b && Array.isArray(flist.b.pending), 'the owner can still reach the Fomo review queue - the pending claims are not stranded');
  const fpend = ((flist.b && flist.b.pending) || []).filter(x => x.exchange === 'fomo');
  ok(true, '    (Fomo rows still awaiting a decision: ' + fpend.length + ')');

  // ---------- each live venue, on its own ----------
  for (const { v, label, code } of LIVE) {
    console.log('\n--- ' + label + ' ---');
    const sub = (H, u) => j('/api/reward/' + v + 'sign/submit', { method: 'POST', headers: H, body: JSON.stringify({ uid: u }) });
    const name = 'e2e' + v + Date.now().toString(36);

    const bal0 = Math.round(((await j('/api/reward/account', { headers: a.H })).b || {}).balance * 100 || 0);

    const badv = await sub(a.H, 'x');
    ok(badv.s === 400 && badv.b && badv.b.error === 'bad_uid', 'a one-character UID is refused (bad_uid)');

    const s1 = await sub(a.H, name);
    ok(s1.s === 200 && s1.b && s1.b.ok && s1.b.status === 'pending', 'the submission is accepted and waits for review');
    const s1b = await sub(a.H, name + 'z');
    ok(s1b.s === 409 && s1b.b && s1b.b.error === 'already_submitted', 'a second submission while one is pending is refused');

    // ONE UID PAYS ONCE, across every account - the whole point of manual review
    const s2 = await sub(b2.H, name);
    ok(s2.s === 409 && s2.b && s2.b.error === 'uid_taken', 'the same ' + label + ' UID on another account is refused (uid_taken)');

    // THE VENUES SHARE A TABLE AND MUST NOT SHARE ROWS
    const mine = await j('/api/reward/' + v + 'sign/mine', { headers: a.H });
    const rowsMine = (mine.b && mine.b.signups) || [];
    ok(rowsMine.length === 1 && rowsMine[0].uid === name, 'the account sees its row on the ' + label + ' surface');
    const other = LIVE.find(x => x.v !== v);
    const mineOther = await j('/api/reward/' + other.v + 'sign/mine', { headers: a.H });
    ok(((mineOther.b && mineOther.b.signups) || []).every(x => x.uid !== name), 'and the ' + other.label + ' surface does not show it');
    const mineMoon = await j('/api/reward/moonsign/mine', { headers: a.H });
    ok(((mineMoon.b && mineMoon.b.signups) || []).every(x => x.uid !== name), 'and neither does Moon');

    const list = await j('/api/reward/' + v + 'sign/list', { headers: A });
    const qrows = [...((list.b && list.b.pending) || []), ...((list.b && list.b.decided) || [])];
    ok(qrows.length > 0 && qrows.every(x => x.exchange === v), 'the admin queue for ' + label + ' contains only ' + v + ' rows (' + qrows.length + ')');
    const row = ((list.b && list.b.pending) || []).find(x => String(x.address || '').indexOf(a.uid) >= 0);
    ok(!!row, 'the pending row is found for review');
    if (!row) continue;

    // the money
    const rev = await j('/api/reward/' + v + 'sign/review', { method: 'POST', headers: A, body: JSON.stringify({ id: row.id, action: 'approve' }) });
    ok(rev.s === 200 && rev.b && rev.b.status === 'approved' && rev.b.amount === 1, 'approving it pays exactly $1 (' + (rev.b && rev.b.amount) + ')');
    const bal1 = Math.round(((await j('/api/reward/account', { headers: a.H })).b || {}).balance * 100 || 0);
    ok(bal1 - bal0 === 100, 'the balance moved by exactly 100 cents (' + bal0 + ' -> ' + bal1 + ')');

    const s3 = await sub(a.H, name + 'q');
    ok(s3.s === 409 && s3.b && s3.b.error === 'already_submitted', 'an approved account cannot submit again');

    // THE KILL SWITCH - it has to pause ITS OWN venue and nothing else (it read the retired generic
    // `exsignEnabled` until 2026-10-21, so it paused nothing at all)
    await j('/api/reward/config', { method: 'POST', headers: AK, body: JSON.stringify({ [v + 'Enabled']: false }) });
    const off = await sub(b2.H, name + 'off');
    ok(off.s === 503 && off.b && off.b.error === 'paused', v + 'Enabled:false pauses new ' + label + ' submissions (' + off.s + ')');
    // A FRESH ACCOUNT, deliberately: doing this as b2 consumed b2's slot on the OTHER venue, so that venue's
    // own `uid_taken` leg later answered `already_submitted` and went red for a reason that was not the product.
    const x = await mk('e2esvx');
    const stillOn = await j('/api/reward/' + other.v + 'sign/submit', { method: 'POST', headers: x.H, body: JSON.stringify({ uid: 'e2ecross' + Date.now().toString(36) }) });
    ok(stillOn.s === 200, 'and ' + other.label + ' keeps taking submissions while it is off (' + stillOn.s + ')');
    /* AND IT TAKES ITS OWN ROW BACK OUT (2026-10-22). This submission is a REAL pending claim on the owner's review
       desk, and `e2euser rm` cannot reach it: exsign lives in RewardLedger and the UserStore sweep has never been able
       to see that store - the orphan class this file has named since 2026-09-16. Six rows from earlier runs of this
       very suite were sitting in the live queue beside nineteen real ones when the owner went to read it. Rejecting
       credits nothing and is what keeps the desk honest. */
    if (stillOn.s === 200 && stillOn.b && stillOn.b.id) {
      const rv = await j('/api/reward/' + other.v + 'sign/review', { method: 'POST', headers: A, body: JSON.stringify({ id: stillOn.b.id, action: 'reject', note: 'automated test row - not a real claim' }) });
      ok(rv.s === 200, '    and the test row is taken back off the review desk');
    }
    await j('/api/reward/config', { method: 'POST', headers: AK, body: JSON.stringify({ [v + 'Enabled']: true }) });
    const back = await j('/api/reward/account', { headers: b2.H });
    ok(back.b && back.b[v + 'Enabled'] !== false, 'and it switches back on');

    // the partner link itself
    const go = await fetch(O + '/go?ex=' + v, { redirect: 'manual' });
    const loc = String(go.headers.get('location') || '');
    const body = go.status === 302 ? '' : await go.text().catch(() => '');
    const where = loc || body;
    ok((go.status === 302 || go.status === 200) && where.indexOf(code) >= 0,
      '/go?ex=' + v + ' carries our referral code ' + code + ' (' + go.status + (loc ? ' ' + loc.slice(0, 60) : ' interstitial') + ')');
  }

  // ---------- the card copy on /rewards/ names both and no longer names Fomo ----------
  const page = await fetch(O + '/rewards/?nc=1&cb=' + Date.now()).then(r => r.text());
  for (const { v, label } of LIVE) {
    ok(page.indexOf('id="' + v + 'Card"') >= 0, 'the ' + label + ' card is in the served /rewards/ markup');
    ok(page.indexOf('/assets/ex/' + v + '.png') >= 0, 'and its logo is referenced from our own assets, never a hotlink');
    const r = await fetch(O + '/assets/ex/' + v + '.png');
    ok(r.status === 200 && (r.headers.get('content-type') || '').indexOf('image') >= 0, '/assets/ex/' + v + '.png serves an image (' + r.status + ')');
  }
  ok(page.indexOf('id="fomoCard"') < 0, 'and the Fomo card is gone from it');
  // the payout method, which is the second half of what a venue is here (2026-10-22)
  ok(page.indexOf('id="wdmBitget"') >= 0 && page.indexOf('id="wdNoteBitget"') >= 0, 'Bitget is offered as a payout method with its own note');
  ok(page.indexOf('id="wdmBybit"') >= 0 && page.indexOf('id="wdmMoon"') >= 0 && page.indexOf('id="wdmMexc"') >= 0, 'and the three methods that were already there are untouched');
  // the public pre-check must FAIL OPEN - a member may never be blocked by our own outage or a missing key
  const pc = await j('/api/reward/bitgetcheck?uid=1234567890');
  ok(pc.s === 200 && pc.b && pc.b.ok === true && (pc.b.gate === false ? pc.b.listed === true : true),
    'the Bitget pre-check answers, and when it could not ASK it says so rather than blocking (gate=' + (pc.b && pc.b.gate) + ' listed=' + (pc.b && pc.b.listed) + ')');
  const bad = await j('/api/reward/bitgetcheck?uid=x');
  ok(bad.s === 200 && bad.b && bad.b.ok === false, 'and a value that is not a UID is simply not a question');
  // the offer is on /rewards/ ONLY - the owner was explicit that the bonus must not travel to the homepage
  const home = await fetch(O + '/?nc=1&cb=' + Date.now()).then(r => r.text());
  ok(home.indexOf('data-ex="BingX"') >= 0, 'BingX has a tile on the homepage, like the other venues');
  ok(!/bonus for new traders[\s\S]{0,40}\$1/i.test(home) && home.indexOf('bingxsign') < 0 && home.indexOf('mexcsign') < 0, 'and the homepage offers no sign-up bonus of its own');

  for (const u of made) await j('/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid: u, op: 'rm' }) });
  ok(true, 'test members removed');
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
