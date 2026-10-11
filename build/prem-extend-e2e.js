/* A PREMIUM MEMBER COULD NOT PAY US AGAIN, AND NOBODY WAS EVER TOLD THEIR MONTH WAS ENDING (2026-10-11).
 *
 * Measured the day this was written: six people have ever bought Premium and ZERO have ever renewed. Two causes,
 * both in this file:
 *   1. /api/premium/checkout and /paybalance refused ANY caller who still had a day left - `already_premium` -
 *      while the card beside them said "pay again any time to extend". Only a PERMANENT standing is refused now.
 *   2. The expiry notice went to the OWNER on Telegram. The member themself was never written to, while an
 *      API-plan holder has been mailed at seven days and at one since 2026-09-15.
 *
 * The load-bearing checks are the two that go red if either comes back: a timed member reaching the ledger instead
 * of the guard, and the expiry pass naming that member with a body that says what stops working.
 *
 * Run: node build/prem-extend-e2e.js
 */
const fs = require('fs');
const path = require('path');
const ORIGIN = 'https://marginpad.io';
const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split('\n')[1].replace('\r', '').trim();
const UID = 'e2eprem1';                 // NO HYPHEN: /lbuser strips it, and so does the username sanitiser
const USER = 'e2e_' + UID;

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? '  ' + JSON.stringify(d).slice(0, 260) : '')); } };
const A = { 'x-admin-key': KEY, 'content-type': 'application/json' };
const jget = async (u, h) => { const r = await fetch(ORIGIN + u, { headers: h || A }); const t = await r.text(); try { return { s: r.status, j: JSON.parse(t) }; } catch (e) { return { s: r.status, t: t.slice(0, 200) }; } };
const jpost = async (u, body, h) => { const r = await fetch(ORIGIN + u, { method: 'POST', headers: h || A, body: body == null ? undefined : JSON.stringify(body) }); const t = await r.text(); try { return { s: r.status, j: JSON.parse(t) }; } catch (e) { return { s: r.status, t: t.slice(0, 200) }; } };

(async () => {
  console.log('PREMIUM RENEWAL - ' + ORIGIN);
  let sess = null;
  try {
    await jpost('/api/admin/e2euser', { uid: UID, op: 'mk' });
    const s = await jpost('/api/admin/e2euser', { uid: UID, op: 'sess' });
    sess = (s.j && (s.j.token || s.j.sess || s.j.mp_sess)) || null;
    ok(!!sess, 'a throwaway member and a session for it', { got: Object.keys((s.j) || {}) });
    if (!sess) throw new Error('no session');
    const CK = { cookie: 'mp_sess=' + sess, 'content-type': 'application/json' };

    // ---- 1. no Premium: the ordinary path still behaves ------------------------------------------------------
    const cold = await jpost('/api/premium/paybalance', null, CK);
    ok(cold.j && cold.j.error !== 'already_premium' && cold.j.error !== 'login_required',
      'a signed-in member with no Premium reaches the ledger (not the guard, not the sign-in wall)', cold.j);

    // ---- 2. grant a SIX-day Premium, which is both "active" and inside the notice window ----------------------
    await jget('/api/admin/premium?add=' + USER + '&days=6');
    const st = await jget('/api/premium/status', CK);
    ok(st.j && st.j.premium === true && +st.j.until > Date.now(), 'the grant is live on the account', st.j && { premium: st.j.premium, source: st.j.source });

    /* [LB] THE ONE THAT MATTERS. Before today this answered `already_premium` and the member had no way to pay us
       a second time. `insufficient` is the right refusal - it means the request got all the way to the ledger and
       was turned down for having no balance, which is a different sentence entirely. */
    const warm = await jpost('/api/premium/paybalance', null, CK);
    ok(warm.j && warm.j.error !== 'already_premium',
      '[LB] an ACTIVE member can start a renewal - the guard no longer refuses them', warm.j);
    ok(warm.j && (warm.j.error === 'insufficient' || warm.j.error === 'in_progress' || warm.j.ok),
      'and the refusal it does get is about money, not about standing', warm.j);

    // ---- 3. the expiry notice SEES them, and says the right things --------------------------------------------
    const dry = await jget('/api/admin/premexpiry');
    const mine = ((dry.j && dry.j.rows) || []).find(r => r.user === USER || r.uid === UID);
    ok(dry.j && dry.j.dry === true, 'the expiry endpoint is a DRY RUN by default - it must never mail on a read', dry.j && { dry: dry.j.dry });
    ok(!!mine, '[LB] a member six days from the end is on the list', { rows: (dry.j && dry.j.rows || []).length });
    ok(mine && mine.days <= 7 && mine.days >= 1, 'at the seven-day step, not the one-day step', mine);
    ok(mine && /runs out on|ends on/.test(String(mine.preview)), 'the body opens with the date it ends', mine && mine.preview);
    ok(mine && /nothing/i.test(String(mine.preview)), 'and says plainly that nothing renews or is charged on its own', mine && mine.preview);
    ok(mine && Object.prototype.hasOwnProperty.call(mine, 'email'), 'it reports whether there is an address to send to, rather than failing silently', mine && { email: mine.email });

    // a dry run must not mark anything as sent - run it twice and the same row has to come back
    const dry2 = await jget('/api/admin/premexpiry');
    ok(((dry2.j && dry2.j.rows) || []).some(r => r.user === USER || r.uid === UID), 'a second dry run still lists them - reading never consumes the one notice they get');
    ok((dry.j && dry.j.mailed) === 0 && (dry2.j && dry2.j.mailed) === 0, 'and nothing was mailed by either read', { a: dry.j && dry.j.mailed, b: dry2.j && dry2.j.mailed });

    // ---- 4. a lifetime standing still has nothing to extend ----------------------------------------------------
    const founder = await jpost('/api/premium/paybalance', null, { cookie: 'mp_sess=nonexistent', 'content-type': 'application/json' });
    ok(founder.j && founder.j.error === 'login_required', 'a dead session is still refused at the door', founder.j);
  } catch (e) {
    ok(false, 'threw: ' + String(e.message));
  } finally {
    try { await jget('/api/admin/premium?remove=' + USER); } catch (e) {}
    try { await jpost('/api/admin/e2euser', { uid: UID, op: 'rm' }); } catch (e) {}
    const gone = await jget('/api/auth/user?uid=' + UID);
    ok(!(gone.j && gone.j.user && gone.j.user.username === USER), 'the throwaway member is removed again', gone.j && gone.j.user ? { user: gone.j.user.username } : 'gone');
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();
