/* squad-x-e2e (2026-11-15, owner: "moze sve osim broja 3"). The squad round: roles, find-members, rival, history,
   applications, weekly goals, streak, raid race, share card, season badges on the card, and the page that draws them.

   Load-bearing checks (red if the DESIGN broke):
     - only the leader names roles; a captain starts a race and picks a rival, a recruiter posts and a plain member cannot
     - find-members waits 6 h after a post, and a test squad never reaches the real room (`test: true`)
     - an application to an invite-only squad is answered by the leader and seats the applicant; a second is refused
     - a raid race starts two linked raids; an abandon forfeits and the other side is the winner on both rows
     - the page: four equal status cells, three equal actions, a This week tab, nothing past the screen edge on a phone
     - a "squadad:<SID>" chat row becomes a card that links the squad
                                                        node build/squad-x-e2e.js [--nobrowser]   */
const fs = require('fs'), path = require('path');
const KEY = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = process.env.MP_BASE || 'https://marginpad.io';
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 220) : '')); };
const J = (u, o) => fetch(B + u, o).then(r => r.json().then(j => (j.__s = r.status, j)).catch(() => ({ __s: r.status })));
const adm = (p, b) => J(p, { method: 'POST', headers: H, body: JSON.stringify(b) });
const sq = (op, uid, b) => J('/api/squad/' + op + '?uid=' + encodeURIComponent(uid), { method: 'POST', headers: H, body: JSON.stringify(b || {}) });
const mine = uid => J('/api/squad/mine?uid=' + encodeURIComponent(uid), { headers: H });
const R4 = () => { const A = 'BCDFGHJKLMNPQRSTVWXYZ0123456789'; let v = ''; for (let i = 0; i < 4; i++) v += A[Math.floor(Math.random() * A.length)]; return v; };
const U = ['e2esx1', 'e2esx2', 'e2esx3', 'e2esx4', 'e2esx5'], real = {};
const CREST = { shape: 'shield', sym: 'bolt', bg: '#c2f64a', fg: '#0a0b0d', ring: 'solid' };

(async () => {
  if (!KEY) { console.error('no admin key'); process.exitCode = 1; return; }
  const rules = await J('/api/squad/rules');
  ok(rules.sqx && rules.sqx.recruitHours === 6 && rules.sqx.goals && rules.sqx.goals.length === 3, 'the rules publish the squad round numbers', rules.sqx);
  for (const u of U) {
    await adm('/api/admin/e2euser', { uid: u, op: 'rm' }).catch(() => {});
    await adm('/api/admin/e2euser', { uid: u, op: 'mk' });
    real[u] = ((await J('/api/admin/xpdiag?u=e2e_' + u, { headers: H })).user || {}).id;
  }
  for (const L of ['e2esx1', 'e2esx5']) {
    await J('/api/auth/xp/setlevel?key=' + encodeURIComponent(KEY), { method: 'POST', headers: H, body: JSON.stringify({ uid: real[L], level: 'platinum', note: 'sqx-e2e' }) });
    await adm('/api/admin/ticks', { uid: real[L], amt: 5000, note: 'sqx-e2e' });
  }
  const T1 = R4(), T2 = R4();
  const c1 = await sq('create', real.e2esx1, { name: 'Xray ' + T1, tag: T1, crest: CREST, open: true });
  const c2 = await sq('create', real.e2esx5, { name: 'Yolk ' + T2, tag: T2, crest: CREST, open: true });
  const S1 = c1.squad && c1.squad.sid, S2 = c2.squad && c2.squad.sid;
  ok(!!S1 && !!S2, 'two squads', { S1, S2, e: c1.error || c2.error });
  await sq('join', real.e2esx2, { sid: S1 });
  await sq('join', real.e2esx3, { sid: S1 });
  await adm('/api/admin/foundry', { sid: S1, sxp: 1800 }); // level 3: four seats, two raids a day

  // roles
  const r0 = await sq('role', real.e2esx2, { name: 'e2e_e2esx3', role: 'captain' });
  ok(r0.error === 'not_leader', 'a member cannot name roles', r0.error);
  const r1 = await sq('role', real.e2esx1, { name: 'e2e_e2esx2', role: 'captain' });
  const r2 = await sq('role', real.e2esx1, { name: 'e2e_e2esx3', role: 'recruiter' });
  ok(r1.ok && r2.ok, 'the leader names a captain and a recruiter', [r1, r2].map(x => x.error || x.role));
  const m2 = await mine(real.e2esx2);
  ok(m2.sqx && m2.sqx.may && m2.sqx.may.raid && m2.sqx.may.rival && !m2.sqx.may.recruit && !m2.sqx.may.roles, 'a captain may run raids and pick a rival, not recruit or name roles', m2.sqx && m2.sqx.may);
  const m3 = await mine(real.e2esx3);
  ok(m3.sqx && m3.sqx.may && m3.sqx.may.recruit && !m3.sqx.may.raid, 'a recruiter may recruit, not run raids', m3.sqx && m3.sqx.may);
  ok((m2.squad.members || []).some(x => x.role === 'captain') && (m2.squad.members || []).every(x => typeof x.on === 'boolean'), 'members carry their role and an active flag', (m2.squad.members || []).map(x => [x.name, x.role, x.on]));

  // find members
  const rc = await sq('recruit', real.e2esx3);
  ok(rc.ok && rc.test === true && rc.squad && rc.squad.sid === S1, 'the recruiter posts - a test squad is kept out of the real room', rc);
  const rc2 = await sq('recruit', real.e2esx3);
  ok(rc2.error === 'recruit_wait', 'and cannot post again inside 6 hours', rc2.error);

  // rival + week + streak + goals + season
  const rv = await sq('rival', real.e2esx2, { sid: S2 });
  ok(rv.ok && rv.rival === S2, 'the captain names a rival', rv);
  const m1 = await mine(real.e2esx1), X = m1.sqx || {};
  ok(X.rival && X.rival.sid === S2 && X.rival.week && typeof X.rival.week.xp === 'number', 'the rival is compared this week', X.rival && { sid: X.rival.sid, week: X.rival.week });
  ok(X.week && typeof X.week.closes === 'number' && X.streak && typeof X.streak.days === 'number' && X.season && typeof X.season.rank === 'number', 'week, streak and season are on the squad', { week: X.week, streak: X.streak, season: X.season });
  ok(Array.isArray(X.goals) && X.goals.length === 3 && X.goals.every(g => g.valor === 25), 'three weekly goals worth 25 Valor', X.goals);
  const gc = await sq('goalclaim', real.e2esx1, { gid: 'closes' });
  ok(gc.error === 'not_done', 'a goal that is not done cannot be claimed', gc.error);

  // applications
  await sq('edit', real.e2esx1, { open: false });
  const ap = await sq('apply', real.e2esx4, { sid: S1, msg: 'I scalp BTC' });
  ok(ap.ok, 'an outsider asks to join an invite-only squad', ap.error || 'ok');
  const ap2 = await sq('apply', real.e2esx4, { sid: S1, msg: 'again' });
  ok(ap2.error === 'already_applied', 'twice is refused', ap2.error);
  const ma = await mine(real.e2esx1);
  ok((ma.sqx.apps || []).some(a => a.name === 'e2e_e2esx4' && a.msg === 'I scalp BTC'), 'the leader sees the application with its line', ma.sqx.apps);
  const own = await mine(real.e2esx4);
  ok((own.myApps || []).some(a => a.sid === S1), 'the applicant sees where they applied', own.myApps);
  const dd = await sq('appdecide', real.e2esx3, { name: 'e2e_e2esx4', ok: true });
  ok(dd.ok && dd.joined === 'e2e_e2esx4', 'the recruiter accepts and the applicant is seated', dd);

  // raid race
  const vc = await sq('vs', real.e2esx5, { op: 'challenge', sid: S1, coin: 'ETH' });
  ok(vc.ok && vc.id, 'squad two challenges squad one to a race on ETH', vc.error || vc.id);
  const vin = await mine(real.e2esx2);
  ok((vin.sqx.vsIn || []).some(v => v.id === vc.id && v.coin === 'ETH'), 'the challenge waits on squad one', vin.sqx.vsIn);
  const va = await sq('vs', real.e2esx2, { op: 'accept', id: vc.id });
  ok(va.ok && va.raid && va.raid.vs && va.raid.vsid === S2, 'the captain accepts: two linked raids', va.error || { vs: va.raid.vs, vsid: va.raid.vsid });
  const ml = await mine(real.e2esx1);
  ok(ml.raid && ml.raid.opp && ml.raid.opp.sid === S2 && ml.raid.opp.status === 'active', 'the raid card carries the other side', ml.raid && ml.raid.opp);
  const ab = await sq('raid', real.e2esx5, { op: 'abandon' });
  ok(ab.ok, 'squad two abandons', ab.error || 'ok');
  const h1 = (await mine(real.e2esx1)).raid, h2 = ((await mine(real.e2esx5)).raidHistory || [])[0] || {};
  ok(h1 && h1.vswin === S1 && h2.vswin === S1, 'an abandon forfeits: squad one wins the race on both rows', { mine: h1 && h1.vswin, theirs: h2.vswin });

  // history, share card, profile card
  const hs = await J('/api/squad/history?sid=' + S1);
  const kinds = (hs.events || []).map(e => e.kind);
  ok(['found', 'join', 'role', 'rival', 'raid', 'vs'].every(k => kinds.indexOf(k) >= 0), 'the history tells the story', kinds);
  const svg = await fetch(B + '/api/squad/card.svg?sid=' + S1).then(r => r.text().then(t => ({ s: r.status, t })));
  ok(svg.s === 200 && svg.t.indexOf(T1) >= 0 && svg.t.indexOf('<svg') === 0, 'the share card renders the tag', { s: svg.s, len: svg.t.length });
  const card = await J('/api/lb/user?name=e2e_e2esx1');
  ok(Array.isArray(card.seasonBadges), 'the profile card carries season badges', card.seasonBadges);

  // the page
  if (process.argv.indexOf('--nobrowser') < 0) {
    const { withBrowser } = require('./e2e-browser');
    const ses = await adm('/api/admin/e2euser', { uid: 'e2esx1', op: 'sess' });
    await withBrowser(async (browser) => {
      for (const vp of [{ w: 1366, h: 900, tag: 'desk' }, { w: 390, h: 844, tag: 'phone', m: true }]) {
        const p = await browser.newPage();
        await p.setViewport({ width: vp.w, height: vp.h, isMobile: !!vp.m, hasTouch: !!vp.m, deviceScaleFactor: 1 });
        await p.setCacheEnabled(false);
        await p.setCookie({ name: 'mp_sess', value: ses.token || ses.sess || '', domain: 'marginpad.io', path: '/', secure: true, httpOnly: true }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
        const errs = []; p.on('pageerror', e => errs.push(String(e.message || e)));
        await p.goto(B + '/squads/?nc=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
        await p.waitForFunction(() => document.querySelectorAll('.sqx-c').length === 4, { timeout: 30000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1500));
        const g = await p.evaluate(() => {
          const cs = [...document.querySelectorAll('.sqx-c')].map(e => e.getBoundingClientRect()), as = [...document.querySelectorAll('.sqx-acts .btn')].map(e => e.getBoundingClientRect());
          const eq = a => a.length && a.every(r => Math.abs(r.width - a[0].width) < 1.5 && Math.abs(r.height - a[0].height) < 1.5);
          return { cells: cs.length, cellsEq: eq(cs), acts: as.length, actsEq: eq(as), week: !!document.querySelector('.sqtab[data-tab="week"]'), sx: document.documentElement.scrollWidth - innerWidth, race: !!document.querySelector('.sqx-opp, [data-vsopen]'), on: !!document.querySelector('.mem .av.on') };
        });
        ok(g.cells === 4 && g.cellsEq, vp.tag + ': four equal status cells', g);
        ok(g.acts === 3 && g.actsEq, vp.tag + ': three equal actions', g);
        ok(g.week && g.sx <= 0, vp.tag + ': a This week tab and nothing past the screen edge', g);
        await p.click('.sqtab[data-tab="week"]');
        await new Promise(r => setTimeout(r, 400));
        const w = await p.evaluate(() => ({ goals: document.querySelectorAll('[data-panel="week"] .sqx-g').length, rival: !!document.querySelector('[data-panel="week"] .sqx-vr'), vis: !document.querySelector('[data-panel="week"]').hidden }));
        ok(w.vis && w.goals === 3 && w.rival, vp.tag + ': the week tab shows three goals and the rival side by side', w);
        await p.evaluate(() => document.querySelector('[data-sqhist]').scrollIntoView({ block: 'center' })); await new Promise(r => setTimeout(r, 300)); await p.click('[data-sqhist]');
        await p.waitForFunction(() => document.querySelectorAll('.sqx-tl li').length > 2, { timeout: 15000 }).catch(() => {});
        const hl = await p.evaluate(() => { const s = document.querySelector('.sqsh-p'); const r = s && s.getBoundingClientRect(); return { n: document.querySelectorAll('.sqx-tl li').length, inView: !!r && r.top >= -1 && r.bottom <= innerHeight + 1 }; });
        ok(hl.n > 2 && hl.inView, vp.tag + ': the history sheet opens inside the screen', hl);
        await p.keyboard.press('Escape');
        await p.screenshot({ path: path.join(__dirname, 'data', 'sqx-' + vp.tag + '.png'), fullPage: false });
        ok(!errs.length, vp.tag + ': no page errors', errs.slice(0, 3));
        await p.close();
      }
      // the chat card
      const p = await browser.newPage(); await p.setViewport({ width: 1200, height: 800 });
      await p.goto(B + '/paper-trade', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p.waitForFunction(() => window.mpTradeCard && window.mpTradeCard.hydrate, { timeout: 30000 }).catch(() => {});
      const cc = await p.evaluate((sid) => new Promise(res => { const row = document.createElement('div'); row.className = 'ct-msg'; row.innerHTML = '<span class="ct-body">[X] Xray is looking for members - 1 seat open. squadad:' + sid + '</span>'; document.body.appendChild(row); window.mpTradeCard.hydrate(row); setTimeout(() => { const a = row.querySelector('a.ct-sqad'); const r = a && a.getBoundingClientRect(); res({ a: !!a, href: a && a.getAttribute('href'), h: r && Math.round(r.height), go: a && (a.querySelector('.ct-sqad-go') || {}).textContent }); }, 2500); }), S1);
      ok(cc.a && /\/squads\/\?sid=/.test(cc.href || '') && cc.h <= 52, 'a squadad line becomes one card that opens the squad', cc);
    });
  }

  for (const u of U) await adm('/api/admin/e2euser', { uid: u, op: 'rm' });
  console.log(out.join('\n'));
  console.log('\nsquad-x-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
