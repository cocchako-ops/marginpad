/* Remove what E2E runs leave in LIVE data, so the owner's numbers are the owner's numbers (2026-09-14).

   Suites mint throwaway members and some of them post into the global room. Every suite removes its own member at the
   end, but a crash mid-run leaves one behind, and a chat message is never removed by the suite that wrote it — 15 of
   them were sitting in the room when this was written, and three accounts from older harnesses had been in Users for
   weeks (those could not be removed at all: the id sanitiser stripped the hyphen out of `e2e-vault1`).

   Run it after a test session:   node build/e2e-sweep.js          (add --dry to only list)

   The filter is the naming the harnesses themselves use — `e2e…`, plus the few older prefixes — and every removal is
   printed. Nothing a real member wrote is touched.                                                                */
'use strict';
const fs = require('fs'), path = require('path');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').replace(/^﻿/, '').match(/mpadm_[a-f0-9]+/)[0];
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const DRY = process.argv.includes('--dry');
const sleep = ms => new Promise(r => setTimeout(r, ms));
// the ids and names the suites mint; `probe` texts are what the chat-action suites type
const ACCT = /^(e2e|spotctr|spotdbg|spoterr|mktest|test-)/i;
const PROBE = /\bprobe\b/i;

(async () => {
  const sess = await (await fetch(O + '/api/stats/session', { method: 'POST', headers: H })).json();
  if (!sess.ok) { console.log('could not mint an ops session'); process.exit(1); }
  const CK = { cookie: 'mp_sadm=' + sess.token };
  let removedMsgs = 0, removedAccts = 0;

  // ── the global room ───────────────────────────────────────────────────────────────────────────────────────────
  const h = await (await fetch(O + '/chat/admin/history?key=' + K + '&room=global')).json().catch(() => ({}));
  const msgs = h.messages || [];
  const junk = msgs.filter(m => ACCT.test(String(m.u || '')) || PROBE.test(String(m.t || '')));
  console.log('chat: ' + msgs.length + ' messages, ' + junk.length + ' written by test runs');
  for (const m of junk) {
    console.log('   ' + (DRY ? 'would remove' : 'removing') + '  ' + String(m.u).padEnd(20) + String(m.t).slice(0, 46));
    if (DRY) continue;
    const r = await fetch(O + '/chat/admin/delete?key=' + K + '&room=global', { method: 'POST', headers: H, body: JSON.stringify({ ts: m.ts }) });
    if (r.ok) removedMsgs++;
    await sleep(120);
  }

  // ── the accounts, and every table row keyed to them ───────────────────────────────────────────────────────────
  const listAll = async () => {
    let all = [];
    for (let off = 0; off < 4000; off += 200) {
      const d = await (await fetch(O + '/api/auth/admin?limit=200&offset=' + off, { headers: CK })).json();
      const u = d.users || []; all = all.concat(u); if (u.length < 200) break;
    }
    return all;
  };
  const users = await listAll();
  const mine = users.filter(u => ACCT.test(String(u.username || '')) || ACCT.test(String(u.id || '')));
  console.log('\naccounts: ' + users.length + ' total, ' + mine.length + ' from test runs');
  for (const u of mine) {
    console.log('   ' + (DRY ? 'would remove' : 'removing') + '  ' + String(u.username || '(no name)').padEnd(24) + String(u.id).slice(0, 18));
    if (DRY) continue;
    const r = await (await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: u.id, op: 'rm' }) })).json();
    if (r && r.ok) removedAccts++;
    await sleep(120);
  }

  if (DRY) { console.log('\n--dry: nothing was removed'); return; }

  // ── prove it ──────────────────────────────────────────────────────────────────────────────────────────────────
  const after = await listAll();
  const leftA = after.filter(u => ACCT.test(String(u.username || '')) || ACCT.test(String(u.id || '')));
  const h2 = await (await fetch(O + '/chat/admin/history?key=' + K + '&room=global')).json().catch(() => ({}));
  const leftM = (h2.messages || []).filter(m => ACCT.test(String(m.u || '')) || PROBE.test(String(m.t || '')));
  const lb = await (await fetch(O + '/api/reward/lb')).json();
  const onBoard = [];
  for (const k of ['topGreen', 'topRoe', 'topWr', 'topXp', 'topGold', 'topBybit']) (lb[k] || []).forEach(x => { if (ACCT.test(String(x.who || ''))) onBoard.push(k + ':' + x.who); });
  const au = await (await fetch(O + '/api/admin/lbaudit', { headers: H })).json();
  const inLb = (au.flagged || []).filter(f => ACCT.test(String(f.uid || '')));

  console.log('\nremoved ' + removedAccts + ' account(s) and ' + removedMsgs + ' message(s)');
  console.log('  accounts left from tests : ' + leftA.length + (leftA.length ? '  ' + leftA.map(u => u.id).join(', ') : ''));
  console.log('  chat messages left       : ' + leftM.length);
  console.log('  on a public board        : ' + (onBoard.length ? onBoard.join(', ') : 'none'));
  console.log('  in the ROE board table   : ' + inLb.length);
  process.exit((leftA.length + leftM.length + onBoard.length + inLb.length) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
