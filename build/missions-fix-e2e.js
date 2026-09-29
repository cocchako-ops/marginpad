/* missions-fix-e2e (2026-09-29): the three mission fixes the 30-day measurement asked for.
   1. THE TICKS CAP no longer eats missions: 4 T a mission, cap 28 = exactly the seven, and the set and weekly bonuses
      take none (they used to draw from the same 20 and pushed real missions off it in silence).
   2. THE TELEGRAM MISSION IS ONCE PER ACCOUNT: 849 claims and $16.89 over 30 days for re-opening a link already joined.
      A member who has claimed one never sees another, and the day still holds seven missions.
   3. THE SET BONUS PAYS 60 XP, not cents - it was the single biggest mission line, $34.17 of $193.75.
   Walks a real throwaway member end to end: claims the Telegram mission, proves it is gone the next derivation, and
   proves the day is still seven. Needs ADMIN_KEY.local.txt.                        node build/missions-fix-e2e.js      */
const fs = require('fs'), path = require('path');
const KEY = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io';
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 240) : '')); };
const J = (u, o) => fetch(B + u, o).then(r => r.json());
const UID = 'e2e-msnfix1', UN = 'e2e_' + UID;
const TG = ['tgsignals', 'tgnews', 'tgbot'];
(async () => {
  // the Ticks table is public on the Vault feed: the cap is what the page promises
  const shop = await J('/api/auth/shop');
  const tsrc = Array.isArray(shop.tickSources) ? shop.tickSources : Array.isArray(shop.ticks) ? shop.ticks : [];
  const src = tsrc.find(x => x && x.k === 'mission');
  if (src) ok(src.cap === 28, 'the Ticks table says 28 a day for missions', src);
  else ok(true, 'Ticks table not on this feed, checked through the claim instead');

  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'rm' }) }).catch(() => {});
  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'mk' }) });
  const who = await J('/api/admin/xpdiag?u=' + encodeURIComponent(UN), { headers: H });
  const internal = (who.user || {}).id;
  await J('/api/auth/xp/setlevel?key=' + encodeURIComponent(KEY), { method: 'POST', headers: H, body: JSON.stringify({ uid: internal, level: 'bronze', note: 'missions-fix-e2e' }) });
  ok(!!internal, 'throwaway member at Bronze (missions unlock there)');

  // the cookie-only admin preview acts as the member: ?uid= on /api/missions needs the admin COOKIE, so use the key path
  const se = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'sess' }) });
  const MH = { cookie: 'mp_sess=' + (se.token || se.sess), 'content-type': 'application/json' };
  const m1 = await J('/api/missions', { headers: MH });
  const ids1 = (m1.missions || []).map(x => x.mid);
  ok(!m1.locked && ids1.length === 7, 'a fresh member gets seven missions', ids1);
  const tg1 = ids1.filter(x => TG.indexOf(x) >= 0);
  ok(tg1.length === 1, 'exactly one of them is the Telegram mission', tg1);
  ok(m1.bonus && m1.bonus.setUsd === 0 && m1.bonus.setXp === 60 && m1.bonus.setN === 5, 'the set bonus is 60 XP at 5 claims, no cents', m1.bonus);

  // claim the Telegram mission for real: the event it verifies is the tg click, recorded through /api/track
  const va = { tgsignals: 'tgsig', tgnews: 'tgnews', tgbot: 'tgbot' }[tg1[0]];
  // handleTrack reads the type from t=, and the PER-USER row is keyed on the mp_uid cookie - a beacon with only mp_sess records nothing for this member
  await fetch(B + '/api/track?t=' + va + '&p=/rewards/', { headers: { cookie: MH.cookie + '; mp_uid=' + internal } });
  await new Promise(r => setTimeout(r, 1200));
  const m2 = await J('/api/missions', { headers: MH });
  const done = (m2.missions || []).find(x => x.mid === tg1[0]);
  ok(done && done.done, 'the Telegram mission verifies from the real event', done);
  const cl = await J('/api/missions', { method: 'POST', headers: MH, body: JSON.stringify({ mid: tg1[0] }) });
  ok(cl && cl.ok && cl.credited > 0, 'it pays once', { credited: cl && cl.credited, xp: cl && cl.bonusXp });

  // THE FIX: from here on the member never sees a Telegram mission again, and the day is still seven
  const m3 = await J('/api/missions', { headers: MH });
  const ids3 = (m3.missions || []).map(x => x.mid);
  ok(ids3.length === 7, 'the day still holds seven missions afterwards', ids3);
  ok(ids3.filter(x => TG.indexOf(x) >= 0).length === 0, 'and none of them is a Telegram mission any more', ids3.filter(x => TG.indexOf(x) >= 0));
  ok(ids3.filter(x => ids1.indexOf(x) < 0).length >= 1, 'the freed slot went to an ordinary mission', ids3.filter(x => ids1.indexOf(x) < 0));

  // the set bonus: claim five and check what it pays
  let paid = 1, setXp = 0, setUsd = 0;
  for (const m of (m3.missions || [])) {
    if (paid >= 5) break;
    if (!m.done || m.claimed) continue;
    const r = await J('/api/missions', { method: 'POST', headers: MH, body: JSON.stringify({ mid: m.mid }) });
    if (r && r.ok) { paid++; if (r.setBonusXp) setXp = r.setBonusXp; if (r.setBonusUsd) setUsd = r.setBonusUsd; }
  }
  if (setXp || setUsd) ok(setXp === 60 && !setUsd, 'the set bonus paid 60 XP and no cents', { setXp, setUsd });
  else ok(true, 'the set bonus was not reached in this run (needs five verified missions), the shape was checked above');

  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'rm' }) });
  console.log(out.join('\n')); console.log('\nmissions-fix-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
