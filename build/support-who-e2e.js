/* WHO SENT A SUPPORT TICKET (2026-10-18, owner: "ne moze da mi pise da mi je mejl stigao sa UID-a, to je bas
   katastrofa. Popravi to da ne moze da se desava vise.")

   A member typed his PHONE NUMBER into the contact box on /rewards/ and the desk filed the ticket under it.
   `/support` was the one member-facing write the worker never resolved a session for, and that column is
   three things at once: what the desk shows as the sender, what a reply is addressed to, and what the
   member's own history is looked up by - so one typed string made a real person invisible on all three.

   The load-bearing checks here are the ones that go red if the identity ever comes from the form again:
     - a signed-in member who types rubbish is filed under their ACCOUNT
     - what they typed is KEPT (it may be a second contact; here it was his phone number)
     - the desk names them, and carries an address a reply can reach
     - they can find their own thread
     - a GUEST is unchanged and LABELLED, because there the typed contact really is all we hold
   node build/support-who-e2e.js                                                                          */
const fs = require('fs'), path = require('path');
const BASE = 'https://marginpad.io';
const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split('\n')[1].replace('\r', '').trim();
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (d === undefined ? '' : '  -> ' + JSON.stringify(d).slice(0, 300))); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const adm = (p, b) => fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify(b) }).then(r => r.json());

(async () => {
  // ---- the source rule, read out of the shipped worker ------------------------------------------------
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
  const list = (src.match(/if \(path === '\/bybitlink'[^)]*\)/) || [''])[0];
  ok("'/support' resolves the session like every other member-facing write", /path === '\/support'/.test(list), list.slice(0, 200));
  ok('the forward overrides the sender from the SESSION, not the body',
    /path === '\/support' && request\.method === 'POST' && acct && suEmail/.test(src));
  ok('and one helper stamps who, for both the ticket list and the conversation view',
    (src.match(/await supportStampWho\(env,/g) || []).length >= 2);

  const sj = await fetch(BASE + '/api/stats/session', { method: 'POST', headers: { 'x-admin-key': KEY } }).then(r => r.json());
  const cookie = 'mp_sadm=' + sj.token;
  const convs = () => fetch(BASE + '/api/reward/support/convs?_=' + Date.now(), { headers: { 'x-admin-key': KEY, cookie } }).then(r => r.json());

  const uid = 'e2ewho' + Math.random().toString(36).slice(2, 6);
  await adm('/api/admin/e2euser', { uid, op: 'mk' });
  try {
    const tok = (await adm('/api/admin/e2euser', { uid, op: 'sess' })).token;

    console.log('\na member types a phone number into the contact box');
    const mark = 'whoe2e-' + Date.now();
    const r = await fetch(BASE + '/api/reward/support', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + tok },
      body: JSON.stringify({ email: '9070579908', address: 'moon:nobody', message: mark + ' where do I put the code' }),
    }).then(x => x.json());
    ok('the ticket is accepted', !!r.ok, r);
    await sleep(2500);

    let d = await convs();
    const mine = (d.conversations || []).find(x => (x.messages || []).some(m => String(m.body || '').includes(mark)));
    ok('a thread exists for it', !!mine);
    ok('THE SENDER IS THE ACCOUNT, never the typed number', !!(mine && mine.email && mine.email !== '9070579908'), mine && mine.email);
    ok('the desk names the member', !!(mine && String(mine.who || '').indexOf('e2e_') === 0), mine && mine.who);
    ok('a reply has somewhere real to go', !!(mine && /@/.test(String(mine.whoEmail || ''))), mine && mine.whoEmail);
    ok('it is marked as a member', !!(mine && mine.whoKind === 'member'), mine && mine.whoKind);
    ok('what they typed is KEPT in the ticket, not thrown away',
      !!(mine && (mine.messages || []).some(m => String(m.body || '').indexOf('contact typed in the form: 9070579908') >= 0)));
    ok('the client never gets to choose the address either (moon:nobody was ignored)',
      !!(mine && mine.whoKind === 'member' && mine.whoVia !== 'moon'), mine && mine.whoVia);

    console.log('\nand the member can find their own thread');
    const own = await fetch(BASE + '/api/reward/support/mine', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + tok }, body: '{}' }).then(x => x.json()).catch(() => ({}));
    ok('their own history shows it', ((own.conversations || []).some(x => (x.messages || []).some(m => String(m.body || '').includes(mark)))), Object.keys(own));

    console.log('\nthe same message typed with their REAL address leaves no note');
    const mark2 = 'whoe2e2-' + Date.now();
    await fetch(BASE + '/api/reward/support', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + tok },
      body: JSON.stringify({ email: 'e2e+' + uid + '@marginpad.test', message: mark2 + ' second question' }),
    }).then(x => x.json());
    await sleep(2500);
    d = await convs();
    const two = (d.conversations || []).find(x => (x.messages || []).some(m => String(m.body || '').includes(mark2)));
    ok('no "contact typed" note when it matches the account',
      !!(two && !(two.messages || []).some(m => String(m.body || '').indexOf('contact typed in the form') >= 0)), two && (two.messages || [])[0]);
  } finally {
    await adm('/api/admin/e2euser', { uid, op: 'rm' }).catch(() => {});
  }

  console.log('\na GUEST is unchanged - there the typed contact really is all we hold');
  const gmail = 'guest+' + Date.now() + '@example.com', gmark = 'whoguest-' + Date.now();
  try {
    await fetch(BASE + '/api/reward/support', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: gmail, message: gmark + ' guest question' }),
    }).then(x => x.json()).catch(() => ({}));
    await sleep(2500);
    const dg = await convs();
    const g = (dg.conversations || []).find(x => (x.messages || []).some(m => String(m.body || '').includes(gmark)));
    ok('a guest ticket keeps what they typed', !!(g && /@example\.com$/.test(String(g.email || ''))), g && g.email);
    ok('and is LABELLED a guest rather than passed off as an identity', !!(g && g.whoKind === 'guest'), g && g.whoKind);
  } finally {
    // A TEST TICKET IS A REAL ROW ON THE OWNER'S DESK. The purge cannot take it (that is scoped to inbound
    // mail, deliberately) and `e2euser rm` cannot either, because a guest has no account - so it is swept here.
    await adm('/api/admin/e2euser', { op: 'supportrm', email: gmail }).catch(() => {});
  }

  console.log('\nnothing this run filed is still on the desk');
  await sleep(1500);
  const after = await convs();
  const left = (after.conversations || []).filter(x => (x.messages || []).some(m => /whoe2e-|whoe2e2-|whoguest-/.test(String(m.body || ''))));
  ok('the desk is clean again', left.length === 0, left.map(x => x.email));

  console.log('\n' + pass + ' ok, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('ERR', e && e.stack || e); process.exitCode = 1; });
