/* THE FAUCET IS A LEGACY-ACCOUNT FEATURE (2026-11-12, owner: "za sve nove korisnike iskljucimo opciju faucet ... misije za nove
   korisnike ce davati samo ticks a stari korisnici nek imaju sve kao i pre"). Two real throwaway members on production:
     LEGACY  (created 2026-01-01): /api/reward/me says faucet:true, missions carry cents, the weekly bonus is money
     NEW     (created now):        /me says faucet:false, every mission is 0 cents + Ticks, the weekly bonus is 0, POST /api/reward/claim -> 403 faucet_closed
   Plus: the rewards page served to a guest advertises no faucet (static HTML), and the sign-up bonus route still answers a new account
   (the owner's rule: "signup na exchange bonusa ... ne sme da im se ukine"). Needs ADMIN_KEY.local.txt.
     node build/faucet-legacy-e2e.js                                                                                            */
'use strict';
const fs = require('fs'), path = require('path');
const KEY = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io', H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 240) : '')); };
const J = (u, o) => fetch(B + u, o).then(r => r.json().then(j => (j && typeof j === 'object' ? Object.assign(j, { _status: r.status }) : { _status: r.status, raw: j })));
const mk = async (uid, created) => { await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'rm' }) }).catch(() => {}); await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'mk', created }) }); const se = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'sess' }) }); return se.token; };
const rm = (uid) => J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'rm' }) }).catch(() => {});
(async () => {
  const sfx = Math.random().toString(36).slice(2, 6), L = 'e2e-fcll' + sfx, N = 'e2e-fcln' + sfx; // fresh ids every run: a row left by an earlier run would carry an older created
  const tl = await mk(L, Date.UTC(2026, 0, 1)), tn = await mk(N);
  ok(!!tl && !!tn, 'two member sessions minted (legacy + new)');
  const hl = { cookie: 'mp_sess=' + tl }, hn = { cookie: 'mp_sess=' + tn };
  // legacy
  const meL = await J('/api/reward/me', { headers: hl });
  ok(meL.faucet === true && meL.legacy === true, 'legacy: /me says faucet:true legacy:true', { faucet: meL.faucet, legacy: meL.legacy });
  const msL = await J('/api/missions', { headers: hl });
  ok(Array.isArray(msL.missions) && msL.missions.length === 7 && msL.missions.every(m => m.cents > 0), 'legacy: seven missions, every one carries cents', msL.missions && msL.missions.map(m => m.cents));
  ok(msL.legacy === true && msL.bonus && msL.bonus.weekUsd > 0, 'legacy: weekly bonus is money', msL.bonus);
  // new
  const meN = await J('/api/reward/me', { headers: hn });
  ok(meN.faucet === false && meN.legacy === false && meN.legacyBefore === Date.UTC(2026, 10, 12), 'new: /me says faucet:false legacy:false, with the cutoff', { faucet: meN.faucet, legacy: meN.legacy, before: meN.legacyBefore });
  const msN = await J('/api/missions', { headers: hn });
  ok(Array.isArray(msN.missions) && msN.missions.length === 7 && msN.missions.every(m => m.cents === 0 && m.ticks === 4), 'new: seven missions, 0 cents and 4 Ticks each', msN.missions && msN.missions.map(m => [m.cents, m.ticks]));
  ok(msN.legacy === false && msN.bonus && msN.bonus.weekUsd === 0 && msN.bonus.setXp === 60, 'new: weekly bonus 0, set bonus still 60 XP', msN.bonus);
  const cl = await J('/api/reward/claim', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, hn), body: '{}' });
  ok(cl._status === 403 && cl.error === 'faucet_closed' && /12 Nov 2026/.test(cl.message || ''), 'new: POST /claim is refused as faucet_closed naming the date', { status: cl._status, error: cl.error });
  // a guest reads the new-account truth
  const meG = await J('/api/reward/me');
  ok(meG.faucet === false && meG.legacy === false, 'guest: /me says faucet:false', { faucet: meG.faucet });
  const html = await fetch(B + '/rewards/?cb=' + Date.now()).then(r => r.text());
  const stat = html.replace(/<script[\s\S]*?<\/script>/g, '');
  ok(!/Claim every 5 min|Free USDT Faucet|Stack <span>free USDT/i.test(stat), 'rewards page static HTML advertises no faucet', (stat.match(/Claim every 5 min|Free USDT Faucet|Stack <span>free USDT/gi) || []).slice(0, 3));
  ok(/<title>Earn USDT Rewards/.test(html) && /class="fcl-only"/.test(html) && /fcl-no/.test(html), 'rewards page carries the new title and the legacy-only / legacy-no markup');
  // the sign-up bonus stays open to a new account: the submit path answers it (a bad UID is refused for the UID, never for the account's age)
  const sg = await J('/api/reward/mexcsign/submit', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, hn), body: JSON.stringify({ uid: 'x' }) });
  ok(sg._status !== 403 && sg.error !== 'faucet_closed' && sg.error !== 'closed', 'new: the exchange sign-up bonus route is still open to a new account', { status: sg._status, error: sg.error });
  await rm(L); await rm(N);
  console.log(out.join('\n')); console.log('faucet-legacy-e2e: ' + pass + ' ok, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log(out.join('\n')); console.error('crashed', e); process.exit(1); });
