/* E2E for the weekly Bybit rebate (2026-09-20).

   THE LOAD-BEARING CHECK IS THE CAP. The owner's rule is "not more than 33% of my 100%", and the only
   way that rule survives a future edit is if a test fails when it is broken. Two checks enforce it:
   the total payout against 33% of the week's commission, and EVERY ROW against 33% of that row's own
   commission - because a per-row breach can hide inside a total that still looks fine.
   Falsify by raising BYBIT_BONUS_SHARE in worker.js and deploying: both go red.

   NOTHING HERE ANNOUNCES OR PAYS. ?build=1 computes a week without announcing it; ?run=1 is the cron
   pass that DMs real traders and is never called from a test.

   Run: node build/bybit-bonus-e2e.js
*/
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser.js');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://marginpad.io';
const KEY = (fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9]+/) || [])[0];
if (!KEY) { console.error('bybit-bonus-e2e: no mpadm_ token in ADMIN_KEY.local.txt'); process.exit(1); }
const H = { 'x-admin-key': KEY };

let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  -> ' + x : '')); } };
const jget = (u, h) => fetch(u, { headers: h || {} }).then(r => r.json());
const jpost = (u, b, h) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json', ...(h || {}) }, body: JSON.stringify(b) });

// Monday 00:00 UTC of the week a timestamp is in - mirrors bybitWeekStart in the worker
function weekStart(ts) { const d = new Date(ts); const dow = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - dow * 86400000; }
const wkey = ws => new Date(ws).toISOString().slice(0, 10);

(async () => {
  console.log('bybit-bonus-e2e');

  console.log('\n-- the affiliate feed the whole thing stands on');
  const aff = await jget(BASE + '/api/admin/bybitaff?days=7', H);
  ok(!aff.error, 'the feed reads from production', aff.error);
  if (aff.error) { console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exitCode = 1; return; }
  ok(aff.referred > 0, 'it returns referred accounts', aff.referred);
  ok(aff.bpsOfVolume === null || aff.bpsOfVolume > 0, 'it reports a measured rate rather than assuming one', aff.bpsOfVolume);
  // the caveat has to travel WITH the data, or the next reader treats it as a payment record
  ok(/T\+1/.test(aff.note || '') && /NOT the commission settlement/i.test(aff.note || ''),
    'and it carries the caveat: late by a day, and not the payment record', aff.note);

  console.log('\n-- building a week (computes, announces nothing, pays nothing)');
  // the week that is running now has the volume; last week is what the cron would settle
  const thisWk = weekStart(Date.now());
  for (const ws of [thisWk, thisWk - 7 * 86400000]) {
    const b = await jget(BASE + '/api/admin/bybitbonus?build=1&week=' + wkey(ws), H);
    if (b.error) { ok(false, 'week ' + wkey(ws) + ' built', b.error); continue; }
    console.log('   .... ' + b.week + ': volume $' + Math.round(b.volumeUsd).toLocaleString('en-US') +
      ', commission $' + b.commissionUsd.toFixed(4) + ', rebate $' + (b.payoutCents / 100).toFixed(2) +
      ' (' + b.shareOfCommissionPct + '% of commission), ' + b.payableN + ' payable');
    ok(b.week === wkey(ws), 'week ' + wkey(ws) + ' builds and names itself');
    ok(b.announced === false || b.announced === true, 'it reports whether it was announced', b.announced);
    ok(b.share === 0.33, 'the share is the owner\'s 33%', b.share);

    // THE RULE, as a total
    const maxC = Math.floor(b.commissionUsd * 0.33 * 100);
    ok(b.payoutCents <= maxC, 'total payout is within 33% of the week\'s commission', b.payoutCents + 'c vs ' + maxC + 'c');
    ok(b.capOk === true, 'and the worker agrees it is within the cap', b.capWhy);

    // THE RULE, row by row - a breach can hide inside a total that still passes
    const over = (b.rows || []).filter(r => r.cents > Math.floor(r.com * 0.33 * 100));
    ok(over.length === 0, 'no single row is paid more than 33% of its own commission', over.map(r => r.buid + ' ' + r.cents + 'c vs com $' + r.com).join(', '));

    // a row that cannot be paid must say why, in the row
    const bad = (b.rows || []).filter(r => !r.skip && !r.uid);
    ok(bad.length === 0, 'every payable row names a registered account', bad.map(r => r.buid).join(', '));
    const skips = (b.rows || []).filter(r => r.skip);
    ok(skips.every(r => ['not_registered', 'test_account', 'under_floor'].indexOf(r.skip) >= 0), 'every skipped row gives a reason we recognise', skips.map(r => r.skip).join(','));
    // and nothing under the floor is ever payable
    ok(!(b.rows || []).some(r => !r.skip && r.cents < 25), 'nothing under the 25c floor is offered to anyone');
    ok(b.payoutCents === (b.rows || []).filter(r => !r.skip).reduce((s, r) => s + r.cents, 0), 'the total is the sum of the payable rows');
  }

  console.log('\n-- the two ceilings are two different numbers, and stay that way');
  {
    const b = await jget(BASE + '/api/admin/bybitbonus?build=1&week=' + wkey(thisWk), H);
    // capMaxCents = the 33% rule applied to this week. capCents = the figure FROZEN when the week was
    // announced, which is what a claim is checked against. They were one field named capCents, which
    // is precisely how one rule silently becomes a different rule.
    ok(typeof b.capMaxCents === 'number', 'the desk reports the 33% ceiling for the week', b.capMaxCents);
    ok(b.capMaxCents === Math.floor(b.commissionUsd * 0.33 * 100), 'and it really is 33% of the commission', b.capMaxCents + ' vs ' + Math.floor(b.commissionUsd * 0.33 * 100));
    ok(b.announced ? b.capCents > 0 : !b.capCents, 'the frozen ceiling exists only once a week is announced', 'announced=' + b.announced + ' capCents=' + b.capCents);
  }

  console.log('\n-- the claim link and the member route');
  const red = await fetch(BASE + '/bybit-bonus/', { redirect: 'manual' });
  ok(red.status === 302, '/bybit-bonus/ redirects', red.status);
  ok(/\/rewards\/\?byw=/.test(red.headers.get('location') || ''), 'and it lands on the claim itself, not on a page with a second button to press', red.headers.get('location'));

  const anon = await fetch(BASE + '/api/bybit/bonus');
  ok(anon.status === 401, 'a signed-out reader gets 401, not a number', anon.status);
  const anonPost = await jpost(BASE + '/api/bybit/bonus', { week: wkey(thisWk) });
  ok(anonPost.status === 401, 'and cannot claim', anonPost.status);

  console.log('\n-- a real member with no Bybit UID');
  const uid = 'e2e-byb' + Date.now();
  const mk = await (await jpost(BASE + '/api/admin/e2euser', { uid, op: 'mk' }, H)).json();
  if (!mk.ok) { ok(false, 'could not mint a test member', JSON.stringify(mk)); }
  else {
    const sess = await (await jpost(BASE + '/api/admin/e2euser', { uid, op: 'sess' }, H)).json();
    const C = { cookie: 'mp_sess=' + sess.token + '; mp_uid=' + uid };
    try {
      const me = await jget(BASE + '/api/bybit/bonus', C);
      ok(me.ok === true, 'the member route answers', JSON.stringify(me).slice(0, 120));
      ok(me.registered === false, 'it says they have no UID registered yet');
      ok(me.share === 0.33, 'it publishes the same 33% share the engine uses', me.share);
      const cl = await (await jpost(BASE + '/api/bybit/bonus', { week: wkey(thisWk) }, C)).json();
      ok(cl.error === 'no_uid' || cl.error === 'no_week', 'claiming without a registered UID is refused', cl.error);
    } finally {
      await jpost(BASE + '/api/admin/e2euser', { uid, op: 'rm' }, H).catch(() => {});
      console.log('   .... test member removed');
    }
  }

  console.log('\n-- the card on /rewards/, in a browser at 390px');
  await withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    await page.goto(BASE + '/rewards/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 50000 });
    await new Promise(r => setTimeout(r, 2500));
    /* THERE IS NO CARD ANY MORE, and that is the assertion. The channel post already says "Claim your
       bonus", so a page that then asks for a second press is a step that exists only because the page
       was built before the link was. /rewards/ opened normally must be completely untouched by this. */
    const v = await page.evaluate(() => {
      const card = document.getElementById('bybonus');
      const win = document.getElementById('bybWin');
      return { card: !!card, win: !!win, winOpen: !!(win && win.classList.contains('on')),
               locked: document.body.style.overflow === 'hidden' };
    });
    ok(!v.card, 'no bonus card on /rewards/ - the link is the button');
    ok(v.win, 'the claim window is in the markup, ready for an arrival');
    ok(!v.winOpen, 'but it stays shut when the page is opened normally');
    ok(!v.locked, 'and nothing scroll-locks the page behind it');
    ok(errs.length === 0, 'no page errors', errs.join(' | '));
    await page.close();
  });

  /* THE ANNOUNCEMENT HAS TO REACH THEM. Measured 2026-09-21: 13 of 600 accounts have ever linked
     Telegram, so the channel post and the direct message speak to 2% of the base and the bell waits
     for a visit that may never come. Email is the channel every one of these accounts has. */
  console.log('\n-- the announcement reaches people who are not on Telegram');
  {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
    const cron = src.slice(src.indexOf('async function checkBybitBonus'));
    const body = cron.slice(0, cron.indexOf('\nasync function', 10));
    ok(/sendBybitBonusEmail\(env, u\.email/.test(body), 'the announcement also goes out by email');
    const markAt = body.indexOf("'bybonus:mail:'"), putAt = body.indexOf('bybonus:mail:', body.indexOf("'bybonus:mail:'") + 5), sendAt = body.indexOf('sendBybitBonusEmail(env, u.email');
    ok(markAt > 0 && markAt < sendAt, 'the once-per-week mark is written BEFORE the send, so a cron retry cannot mail twice');

    const tpl = src.slice(src.indexOf('async function sendBybitBonusEmail'));
    const tplBody = tpl.slice(0, tpl.indexOf('\nasync function', 10));
    // the owner's framing rule, stated twice: a bonus MarginPad pays, never a share of fees coming back
    ok(!/%|rebate|fee|commission/i.test(tplBody.replace(/\/\*[\s\S]*?\*\//g, '')), 'the mail never mentions fees, commission or a percentage');
    ok(/Claim your bonus/.test(tplBody), 'it carries one button, and the click is the claim');
    ok(/info\.link/.test(tplBody), 'pointed at the week\'s own tokenised link, the same one Telegram sends');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;   // never process.exit() mid-teardown
})();
