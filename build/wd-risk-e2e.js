#!/usr/bin/env node
/* THE PAYOUT DESK'S ABUSE PICTURE (2026-10-28, owner: "zelim odlican uvid u to da li je neko abuser ili nije i
   bas da imam sazeto o njemu bas na stranici za povlacenje").
     node build/wd-risk-e2e.js            pure checks + production + a browser walk
     node build/wd-risk-e2e.js --pure     only the checks that need no network
     node build/wd-risk-e2e.js --falsify  grades every piece of information as evidence; checks MUST go red

   wdRiskOf is LIFTED OUT OF THE SHIPPED worker and driven here, so this suite grades the function that runs.
   Its load-bearing checks are the three the measurement settled:
     - a single piece of information is not a verdict (27 of the 99 accounts that have ever withdrawn share an IP);
     - a store that did not answer is neither a clean account nor a flag (the first live run accused all 60 rows of
       never registering their payout target, because an exsign query had the wrong column name and threw);
     - the owner's own accounts are never flagged. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PURE = process.argv.includes('--pure');
const FALSIFY = process.argv.includes('--falsify');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';

let pass = 0, fail = 0;
const chk = (name, ok, detail) => { if (ok) { pass++; console.log('ok   ' + name); } else { fail++; console.log('FAIL ' + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); } };

// ---- lift the shipped function, brace-matched from its own declaration
function lift(name) {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('no ' + name + ' in the worker');
  let i = src.indexOf('{', at), d = 0, end = -1;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = i + 1; break; } } }
  let body = src.slice(at, end);
  if (FALSIFY) body = body.replace(/add\('look'/g, "add('strong'");   // every scrap of information graded as evidence
  return { fn: new Function('return ' + body)(), src: body };
}
const { fn: wdRiskOf, src: RISK_SRC } = lift('wdRiskOf');

// ---- fixtures. A row is everything the route gathers for ONE withdrawal.
const base = () => ({
  profile: { known: true, status: 'active', trades: 400, ccN: 1, ccList: ['NG'], org: 'MTN Nigeria', vpn: false, devBanned: false, sameDid: [], sameIp: [], sameEmail: [] },
  account: { banned: false },
  target: { venue: 'bybit', venueName: 'Bybit', value: '575652997', label: 'Bybit UID', regKnown: true, regOk: true, uidCheck: 'ok' },
  history: { targetsN: 1 }, sharedPaid: [], sharedOther: [], promoShared: [], protected: false,
});

console.log('--- the verdict');
let r = wdRiskOf(base());
chk('a member with nothing against them is CLEAN', r.level === 'clean' && !r.strongN && !r.lookN, { level: r.level, flags: r.flags.map(f => f.k) });

let ev = base(); ev.sharedPaid = [{ uid: 'aaaa1111', username: 'Papis', paidN: 2, paidUsd: 10.2 }];
r = wdRiskOf(ev);
chk('a target already PAID to another account is evidence -> HOLD', r.level === 'hold' && r.flags[0].k === 'target_paid_elsewhere' && r.flags[0].sev === 'strong', { level: r.level, k: r.flags[0] && r.flags[0].k });
chk('the evidence NAMES the other account', /@Papis/.test(r.flags[0].text), r.flags[0].text);

ev = base(); ev.profile.sameDid = [{ uid: 'bbbb2222', username: 'Ferna2' }];
r = wdRiskOf(ev);
chk('a second account on the same browser is evidence -> HOLD', r.level === 'hold' && r.flags.some(f => f.k === 'same_device' && f.sev === 'strong'));

ev = base(); ev.profile.sameIp = [{ uid: 'cccc3333', username: 'Bala' }];
r = wdRiskOf(ev);
chk('A SHARED IP ALONE IS NOT A VERDICT (27 of 99 share one)', r.level === 'clean' && r.lookN === 1, { level: r.level, lookN: r.lookN });

ev = base(); ev.profile.sameIp = [{ uid: 'cccc3333', username: 'Bala' }]; ev.profile.ccN = 4; ev.profile.ccList = ['NG', 'NL', 'CA', 'DE'];
r = wdRiskOf(ev);
chk('two pieces of information is where it starts to mean something -> LOOK', r.level === 'look' && r.lookN === 2, { level: r.level, lookN: r.lookN });

ev = base(); ev.protected = true; ev.profile.sameDid = [{ uid: 'dddd4444', username: 'Chako' }]; ev.sharedPaid = [{ uid: 'e', username: 'x', paidN: 1 }];
r = wdRiskOf(ev);
chk("the owner's own accounts are never flagged", r.level === 'clean' && r.state.protected === true, { level: r.level });

console.log('--- a store that did not answer');
ev = base(); ev.profile.known = false; ev.profile.trades = 0; ev.target.regKnown = false; ev.target.unregistered = true; ev.target.regRejected = true;
r = wdRiskOf(ev);
chk('an unread store raises NO flag of its own', !r.flags.some(f => /reg_missing|reg_rejected|no_trades/.test(f.k)), r.flags.map(f => f.k));
chk('an unread store is named in the summary, never passed off as clean', /could not be read/.test(r.summary) && r.state.unread.length === 2, { summary: r.summary, unread: r.state.unread });

ev = base(); ev.profile.trades = 0;
r = wdRiskOf(ev);
chk('never having traded IS information once the profile was read', r.flags.some(f => f.k === 'no_trades'));

console.log('--- the partner target');
ev = base(); ev.target = { venue: 'moon', venueName: 'Moon', value: 'sandeepjnv11', label: 'Moon username', regKnown: true, unregistered: true, ownedBy: [{ uid: 'f1', username: 'nilam' }], inList: true, partnerIdle: true };
r = wdRiskOf(ev);
chk('a Moon name registered by ANOTHER member is evidence', r.level === 'hold' && r.flags.some(f => f.k === 'reg_other_member' && f.sev === 'strong'));
chk('...and "they never registered it" rides along as information', r.flags.some(f => f.k === 'reg_missing' && f.sev === 'look'));
chk('a partner account that has never wagered is information', r.flags.some(f => f.k === 'partner_idle' && f.sev === 'look'));

ev = base(); ev.target.uidCheck = 'missing';
r = wdRiskOf(ev);
chk('a Bybit UID off the affiliate allowlist is evidence', r.level === 'hold' && r.flags.some(f => f.k === 'uid_not_listed'));

ev = base(); ev.target = { venue: 'moon', venueName: 'Moon', value: 'ghost', label: 'Moon username', regKnown: true, regOk: true, inList: false };
r = wdRiskOf(ev);
chk('a Moon name absent from the affiliate list informs, it never refuses', r.flags.some(f => f.k === 'not_in_affiliate_list' && f.sev === 'look') && r.level !== 'hold');
chk('...and it says the list may simply be stale', /stale/.test(r.flags.find(f => f.k === 'not_in_affiliate_list').text));

console.log('--- banned is a state, not a flag (25 of the 99 are already banned)');
ev = base(); ev.account.banned = true; ev.profile.status = 'banned'; ev.profile.devBanned = true;
r = wdRiskOf(ev);
chk('a banned account raises no risk flag', !r.flags.length && r.level === 'clean', r.flags.map(f => f.k));
chk('...but the state is carried so the desk can say it', r.state.banned === true && r.state.devBanned === true);

console.log('--- the retired rules stay retired');
const noComment = RISK_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
chk('no "/rewards is their #1 page" flag (fired on 60 of 99)', !/rwRank\s*===?\s*1/.test(noComment));
chk('no claim-cadence flag (there is no automation signature: 1-2%)', !/cadence|gapMed|tight/i.test(noComment));
chk('no "asked within 24h of signing up" flag (fired on 0 of 99)', !/firstAsk/i.test(noComment));

(async () => {
  if (PURE) return done();
  console.log('--- production');
  const K = (fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1] || '').trim();
  const H = { 'x-admin-key': K };
  let d = null;
  try { const res = await fetch(ORIGIN + '/api/admin/wdrisk?all=1', { headers: H }); d = await res.json(); chk('/api/admin/wdrisk answers', res.status === 200 && !!d.risks, res.status); } catch (e) { chk('/api/admin/wdrisk answers', false, e.message); }
  if (d && d.risks) {
    const rows = Object.values(d.risks);
    chk('both stores answered', d.diag && d.diag.profile === 200 && d.diag.money === 200, d.diag);
    chk('every row carries a verdict', rows.length > 0 && rows.every(x => ['hold', 'look', 'clean'].indexOf(x.level) >= 0), rows.length);
    chk('every flag is graded strong or look', rows.every(x => (x.flags || []).every(f => f.sev === 'strong' || f.sev === 'look')));
    chk('a HOLD always has at least one piece of evidence', rows.filter(x => x.level === 'hold').every(x => x.strongN > 0));
    // a PROTECTED account is forced clean on purpose, flags and all - it is the one row where the count may stand
    chk('a CLEAN never has two pieces of information', rows.filter(x => x.level === 'clean' && !x.state.protected).every(x => x.lookN < 2), rows.filter(x => x.level === 'clean' && !x.state.protected && x.lookN >= 2).map(x => x.uid));
    chk('no row accuses an account while its store is unread', !rows.some(x => (x.state.unread || []).length && (x.flags || []).some(f => /reg_/.test(f.k))));
    chk('the facts carry what the account did, not only what it took', rows.some(x => x.facts && (x.facts.trades > 0 || x.facts.xp > 0)));
    chk('a payout target twin is named, never a hash', !rows.some(x => (x.flags || []).some(f => f.k === 'target_paid_elsewhere' && /@[0-9a-f]{8}\b/.test(f.text))));
    const lv = rows.reduce((a, x) => { a[x.level] = (a[x.level] || 0) + 1; return a; }, {});
    console.log('     verdicts over ' + rows.length + ' rows: ' + JSON.stringify(lv));
  }
  console.log('--- the desk');
  try {
    const { withBrowser } = require('./e2e-browser.js');
    const sess = await (await fetch(ORIGIN + '/api/stats/session', { method: 'POST', headers: H })).json();
    chk('ops session minted', !!sess.token);
    await withBrowser(async (browser) => {
      for (const vp of [{ w: 1440, h: 1000, t: 'desktop' }, { w: 390, h: 900, t: 'phone' }]) {
        const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
        const errs = []; page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 120)));
        await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w < 500, hasTouch: vp.w < 500 });
        await page.setCookie({ name: 'mp_sadm', value: sess.token, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true });
        await page.goto(ORIGIN + '/api/stats#money/withdrawals', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('.wdv'), { timeout: 45000 }).catch(() => {});
        await new Promise(r2 => setTimeout(r2, 6000));
        await page.evaluate(() => { const c = [...document.querySelectorAll('[data-f]')].find(x => x.getAttribute('data-f') === 'flagged'); if (c) c.click(); });
        await new Promise(r2 => setTimeout(r2, 1200));
        await page.evaluate(() => { const b = document.querySelector('.wdv[data-wdx]'); if (b) b.click(); });
        await new Promise(r2 => setTimeout(r2, 1500));
        const m = await page.evaluate(() => {
          const k = document.querySelector('.wdk');
          if (k) k.scrollIntoView({ block: 'center' });
          return {
            badges: document.querySelectorAll('.wdv').length, cards: document.querySelectorAll('.wdk').length,
            flags: k ? k.querySelectorAll('.wdk-f').length : 0, factLines: k ? k.querySelectorAll('.wdk-facts div').length : 0,
            clipped: k ? [...k.querySelectorAll('.wdk-f, .wdk-facts div')].filter(e => e.scrollWidth > e.clientWidth + 1).length : -1,
            wide: [...document.querySelectorAll('.wdk, .wdk-f, .wdk-facts div')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length,
            docW: document.documentElement.scrollWidth, innerW: innerWidth,
          };
        });
        chk(vp.t + ': the queue carries a verdict per row', m.badges > 0, m);
        chk(vp.t + ': the flagged filter opens a dossier', m.cards > 0 && m.flags > 0 && m.factLines >= 4, m);
        chk(vp.t + ': every line of the dossier is readable without scrolling sideways', m.clipped === 0 && m.wide === 0, m);
        chk(vp.t + ': the page itself never scrolls sideways', m.docW <= m.innerW + 1, m);
        chk(vp.t + ': no page errors', errs.length === 0, errs.slice(0, 3));
        await ctx.close();
      }
    });
  } catch (e) { chk('the desk renders', false, e.message); }
  done();
})();

function done() {
  console.log('\n' + pass + ' ok, ' + fail + ' FAIL' + (FALSIFY ? '   (--falsify: the reds are the point)' : ''));
  process.exitCode = fail ? 1 : 0;
}
