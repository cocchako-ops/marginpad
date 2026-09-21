/* Can anybody be paid a bonus they did not earn? (2026-09-21)

   Owner: "proveri da li ima nacin da claimuje neko ko nije trejdovao na bybitu ili nije imao volumen
   koji pokriva/opravdava taj bonus ... ovo treba da radi tacno kao sat jer smo automatizovali."

   This file tries to take money. Every check here is an ATTEMPT that must be refused; a pass means
   the door held. Run it against production after any change to the claim path.

   The three it was written for, all found by reading the path rather than by it failing:
     - the ledger silently clamps a gift to $5 unless big:true, so a bonus over $5 would be paid short
       and still marked fully claimed
     - `once` is keyed on (account, from, amount), so two weeks owing the same cents inside ten minutes
       read as one retry and the second was swallowed
     - checkBybitBonus reused a stored week, so a rehearsal row with no trading behind it would have
       been published and paid for real

   Run: node build/bybit-bonus-abuse-e2e.js
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://marginpad.io';
const KEY = (fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9]+/) || [])[0];
if (!KEY) { console.error('no mpadm_ token in ADMIN_KEY.local.txt'); process.exit(1); }
const H = { 'x-admin-key': KEY };

let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  -> ' + x : '')); } };
const jget = (u, h) => fetch(u, { headers: h || {} }).then(r => r.json());
const post = (u, b, h) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json', ...(h || {}) }, body: JSON.stringify(b) });

const weekStart = ts => { const d = new Date(ts); const dow = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - dow * 86400000; };
const wkey = ws => new Date(ws).toISOString().slice(0, 10);

(async () => {
  console.log('bybit-bonus-abuse-e2e - every check is an attempt that must be refused\n');

  console.log('-- a member who has never touched Bybit');
  const uid = 'e2e-ab' + Date.now();
  const mk = await (await post(BASE + '/api/admin/e2euser', { uid, op: 'mk' }, H)).json();
  if (!mk.ok) { console.log('  could not mint a test member'); process.exitCode = 1; return; }
  const sess = await (await post(BASE + '/api/admin/e2euser', { uid, op: 'sess' }, H)).json();
  const C = { cookie: 'mp_sess=' + sess.token + '; mp_uid=' + uid };
  const thisWk = wkey(weekStart(Date.now())), lastWk = wkey(weekStart(Date.now()) - 7 * 86400000);

  try {
    const me = await jget(BASE + '/api/bybit/bonus', C);
    ok(me.ok === true, 'the route answers for a member with no UID');
    ok(me.registered === false, 'and says no UID is registered');
    const owed = (me.weeks || []).filter(w => w.cents > 0);
    ok(owed.length === 0, 'no week owes them anything', JSON.stringify(owed));

    for (const wk of [thisWk, lastWk, '2026-01-05', '']) {
      const r = await post(BASE + '/api/bybit/bonus', { week: wk }, C);
      const j = await r.json();
      ok(r.status >= 400, 'claiming "' + (wk || '(empty)') + '" is refused', r.status + ' ' + JSON.stringify(j).slice(0, 90));
      ok(!j.ok && !(j.usd > 0), 'and pays nothing', JSON.stringify(j).slice(0, 90));
    }

    console.log('\n-- a forged body cannot invent an amount or a row');
    for (const body of [{ week: thisWk, cents: 9999 }, { week: thisWk, usd: 50 }, { week: thisWk, key: '575845419' }, { week: thisWk, buid: '575845419' }, { week: thisWk, uid: 'someone-else' }]) {
      const r = await post(BASE + '/api/bybit/bonus', body, C);
      const j = await r.json();
      ok(r.status >= 400 && !(j.usd > 0), 'refused: ' + JSON.stringify(body), r.status + ' ' + (j.error || ''));
    }

    console.log('\n-- claiming somebody else\'s row by registering nothing');
    // 575845419 is a real trader with real volume. A member who has not registered it must not reach it.
    const r2 = await post(BASE + '/api/bybit/bonus', { week: lastWk, week2: lastWk, buid: '575845419' }, C);
    const j2 = await r2.json();
    ok(r2.status >= 400 && !(j2.usd > 0), 'a real trader\'s row cannot be claimed by an unrelated account', r2.status + ' ' + (j2.error || ''));
  } finally {
    await post(BASE + '/api/admin/e2euser', { uid, op: 'rm' }, H).catch(() => {});
    console.log('  .... test member removed');
  }

  console.log('\n-- signed out');
  for (const m of ['GET', 'POST']) {
    const r = m === 'GET' ? await fetch(BASE + '/api/bybit/bonus') : await post(BASE + '/api/bybit/bonus', { week: thisWk });
    ok(r.status === 401, m + ' is 401 without a session', r.status);
  }

  console.log('\n-- the built week itself never carries a row with nothing behind it');
  for (const wk of [thisWk, lastWk]) {
    const b = await jget(BASE + '/api/admin/bybitbonus?build=1&week=' + wk, H);
    if (b.error) { console.log('  .... ' + wk + ': ' + b.error); continue; }
    const empty = (b.rows || []).filter(r => !r.skip && !((+r.vol > 0) || (+r.com > 0)));
    ok(empty.length === 0, wk + ': every payable row has volume or commission behind it', JSON.stringify(empty).slice(0, 120));
    const over = (b.rows || []).filter(r => r.cents > Math.floor(r.com * 0.33 * 100));
    ok(over.length === 0, wk + ': no row exceeds 33% of its own commission', over.map(r => r.buid).join(','));
    const neg = (b.rows || []).filter(r => !(r.cents >= 0) || r.cents > 5000);
    ok(neg.length === 0, wk + ': no row is negative or over the $50 ceiling', JSON.stringify(neg).slice(0, 100));
  }

  console.log('\n-- the ledger will actually pay what we ask (the silent $5 clamp)');
  const src = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
  ok(/big: true, from: 'byb-' \+ target\.week/.test(src), 'the claim sends big:true, so a bonus over $5 is not clamped to $5');
  ok(/from: 'byb-' \+ target\.week/.test(src), 'and keys the retry guard on the WEEK, so two weeks owing the same amount do not collide');
  ok(/!done\.testOnly\) \? done/.test(src), 'a rehearsal week is rebuilt before a real announcement, never paid as it stands');
  ok(/no Bybit trading recorded for that week/.test(src), 'and the claim re-reads the stored row before releasing money');

  /* THE LINK IS PUBLIC (owner, 2026-09-21: "jel smo sigurni da nema veze ko klikne na link iz grupe?").
     It is posted in a Telegram channel anyone can join, and the click IS the claim - so the only thing
     between a stranger and the money is the claim itself. Everything above proves that through the API;
     this proves it through the door people actually use, by fetching the real token link for the live
     week and following it as a guest.

     The token names a WEEK and nothing else. It carries no identity, no amount and no authority: the
     row is found from the caller's session -> their registered Bybit UID -> that week's stored report. */
  console.log('\n-- the public link itself confers nothing');
  {
    const wk = wkey(weekStart(Date.now()) - 7 * 86400000);
    const built = await jget(BASE + '/api/admin/bybitbonus?build=1&week=' + wk, H);
    const tok = built && built.token;
    ok(/^[a-f0-9]{10}$/.test(String(tok || '')), 'the live week has a token link', tok);
    if (tok) {
      const claimedBefore = built.claimedCents || 0;
      const red = await fetch(BASE + '/bybit-bonus/' + tok, { redirect: 'manual' });
      const loc = red.headers.get('location') || '';
      ok(red.status === 302, 'it redirects rather than paying anything itself', red.status);
      ok(loc.indexOf('/rewards/?byw=' + wk) >= 0, 'and names only the week it belongs to', loc);
      ok(!/token|uid|amount|cents|sig/i.test(loc), 'the destination carries no identity and no amount', loc);

      // a stranger following it with no cookies at all
      const page = await fetch(BASE + '/rewards/?byw=' + wk);
      ok(page.status === 200, 'a stranger can open the page', page.status);
      const anon = await post(BASE + '/api/bybit/bonus', { week: wk });   // no session
      ok(anon.status === 401, 'but the claim behind it is 401 without an account', anon.status);

      // an unknown token is not an error and is not a week
      const bogus = await fetch(BASE + '/bybit-bonus/deadbeef00', { redirect: 'manual' });
      const bl = bogus.headers.get('location') || '';
      ok(bogus.status === 302 && /\/rewards\/\?byw=$/.test(bl), 'a made-up token resolves to no week at all', bogus.status + ' ' + bl);

      const after = await jget(BASE + '/api/admin/bybitbonus?build=1&week=' + wk, H);
      ok((after.claimedCents || 0) === claimedBefore, 'and none of this moved the week\'s claimed total',
        '$' + (claimedBefore / 100).toFixed(2) + ' -> $' + ((after.claimedCents || 0) / 100).toFixed(2));
    }
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();
