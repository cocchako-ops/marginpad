// rewards-e2e.js - the /rewards/ page, as a guest and as a signed-in member, on desktop and on a phone.
//
// There was no test for this page until 2026-09-18, on a page that pays real money and carries the faucet, the
// missions, withdrawals, referrals, the Moon and Fomo bonuses, promo submissions and code redemption. The checks
// that matter most are the boring ones: a member still sees every card they are supposed to, and the earnings
// figures on the page are the ones the server is actually paying.
//
//   node build/rewards-e2e.js
// Needs ADMIN_KEY.local.txt for the member half; without it that half is skipped, loudly.

const { withBrowser } = require('./e2e-browser.js');
const fs = require('fs'), path = require('path');

const ORIGIN = 'https://marginpad.io';
const ADMIN = (() => { try { return (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-z0-9]+/i) || [''])[0]; } catch (e) { return ''; } })();
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const url = () => ORIGIN + '/rewards/?nc=1&cb=' + Date.now() + Math.random().toString(36).slice(2, 6);

let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 220) : '')); } };
const usd = v => '$' + (+v).toFixed(2);

const LOOK = () => {
  const q = s => document.querySelector(s);
  const txt = s => { const e = q(s); return e ? e.textContent.trim() : null; };
  const shown = s => { const e = q(s); if (!e) return false; if (e.hidden) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const ints = [...document.querySelectorAll('a,button,input,select')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  return {
    vw: innerWidth,
    signedIn: document.body.classList.contains('rwd-in'),
    board: shown('#earnBoard'),
    rows: document.querySelectorAll('#earnBoard .et-r').length,
    cadences: [...document.querySelectorAll('#earnBoard .et-k')].map(e => e.textContent.trim()),
    amts: [...document.querySelectorAll('#earnBoard .eamt')].map(e => e.textContent.trim()),
    gate: txt('.et-gate'),
    foot: txt('.et-f'),
    once: txt('#eaOnce'), day: txt('#eaDay'), amt: txt('#eaAmt'), min: txt('#eaMin'),
    wel: txt('#eaWel'), moon: txt('#eaMoon'), fomo: txt('#eaFomo'), post: txt('#eaPost'),
    lvlCard: shown('#lvlCard'),
    authCard: shown('#authCard'),
    dash: shown('#dash'),
    msnCard: shown('#msnCard'),
    refCard: shown('#refCard'),
    moonCard: shown('#moonCard'),
    fomoCard: shown('#fomoCard'),
    promoCard: shown('#promoCard'),
    lbCard: shown('#lbCompCard'),
    lockedCard: shown('#lockedCard'),
    locked: document.body.classList.contains('rewards-locked'),
    // one bordered card inside another bordered card is the smell this pass removed
    nestedFrame: (() => { const w = q('#welcomeHook > div'); if (!w) return false; const cs = getComputedStyle(w); return cs.borderTopWidth !== '0px' || (cs.backgroundImage && cs.backgroundImage !== 'none'); })(),
    scrollW: document.documentElement.scrollWidth,
    pageH: document.documentElement.scrollHeight,
    wide: [...document.querySelectorAll('body *')].filter(e => {
      const r = e.getBoundingClientRect();
      if (!(r.width > innerWidth + 2) || !(r.height > 0)) return false;
      for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
        const o = getComputedStyle(a);
        if (/hidden|clip|auto|scroll/.test(o.overflowX)) return false;
      }
      return true;
    }).map(e => ({ tag: e.tagName, cls: String(e.className).slice(0, 30), w: Math.round(e.getBoundingClientRect().width) })),
    small: ints.filter(e => e.getBoundingClientRect().height < 30).length,
    fairUse: (document.body.innerText.match(/Fair use/g) || []).length
  };
};

async function visit(vp, ua, cookie) {
  let out = null, errs = [];
  await withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport(vp);
    if (ua) await page.setUserAgent(ua);
    if (cookie) await page.setCookie({ name: 'mp_sess', value: cookie, domain: 'marginpad.io', path: '/' });
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 150)); });
    page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 150)));
    await page.goto(url(), { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 7000));
    out = await page.evaluate(LOOK);
    out.errors = errs;
    await page.close();
  }, { timeoutMs: 160000 });
  return out;
}

(async () => {
  console.log('rewards-e2e\n');

  // ---- the figures on the page must be the ones the server pays -----------------------------------------
  const cfg = await (await fetch(ORIGIN + '/api/reward/me?cb=' + Date.now())).json();
  console.log('config the server is serving a guest');
  ok(cfg && cfg.amount > 0 && cfg.perDay > 0, 'a guest can read the reward config without signing in', { amount: cfg.amount, perDay: cfg.perDay });

  console.log('\nguest, desktop 1366');
  const g = await visit({ width: 1366, height: 768 }, null, null);
  ok(g.errors.length === 0, 'no page or console errors', g.errors);
  ok(g.board, 'the earnings table is on the page');
  ok(g.rows === 4, 'four rows, one per cadence', g.cadences);
  ok(/once/i.test(g.cadences[0] || '') && /every day/i.test(g.cadences[1] || ''), 'and they are labelled by cadence, not by product', g.cadences);
  ok(g.amts.length === 4 && g.amts.every(a => /^\$[\d,.]+$/.test(a)), 'every row states one amount', g.amts);

  // the point of the block: the numbers are the live ones, not decoration
  ok(g.amt === usd(cfg.amount), 'the faucet amount matches the server (' + g.amt + ')', { page: g.amt, server: usd(cfg.amount) });
  ok(g.day === usd(cfg.perDay), 'the daily ceiling matches the server (' + g.day + ')', { page: g.day, server: usd(cfg.perDay) });
  ok(g.min === usd(cfg.minWd), 'the withdrawal minimum matches the server (' + g.min + ')', { page: g.min, server: usd(cfg.minWd) });
  ok(g.wel === usd(cfg.welcomeAmt), 'the welcome bonus matches the server (' + g.wel + ')', { page: g.wel, server: usd(cfg.welcomeAmt) });
  if (cfg.moonEnabled !== false) ok(g.moon === usd(cfg.moonUsd), 'the Moon bonus matches the server (' + g.moon + ')', { page: g.moon, server: usd(cfg.moonUsd) });
  if (cfg.fomoEnabled !== false) ok(g.fomo === usd(cfg.fomoUsd), 'the Fomo bonus matches the server (' + g.fomo + ')', { page: g.fomo, server: usd(cfg.fomoUsd) });
  {
    const expect = (+cfg.welcomeAmt || 0) + (cfg.moonEnabled === false ? 0 : (+cfg.moonUsd || 0)) + (cfg.fomoEnabled === false ? 0 : (+cfg.fomoUsd || 0));
    ok(g.once === usd(expect), 'the one-off total is the sum of its parts (' + g.once + ')', { page: g.once, sum: usd(expect) });
  }

  // THE BIGGEST REWARDS ON THE SITE WERE INVISIBLE TO A GUEST: the Moon and Fomo cards are members-only, so
  // before this block a signed-out reader could not learn that $1.00 was on offer at all.
  ok(!g.moonCard && !g.fomoCard, 'the Moon and Fomo cards are still members-only');
  ok(/\$1\.00/.test(g.foot + ' ' + (g.amts.join(' ')) + ' ' + (g.once || '')) || g.moon === usd(cfg.moonUsd),
    'but a guest can read the $1.00 sign-up bonuses anyway', { moon: g.moon, fomo: g.fomo });

  // a block that promises earnings has to carry the precondition
  ok(/Bronze/.test(g.gate || '') && /500 XP/.test(g.gate || ''), 'the Bronze gate is stated with the amounts, not below them', g.gate);
  ok(/cash out|Cash out/.test(g.foot || '') && /Fair use/.test(g.foot || ''), 'and the payout minimum and fair-use rule sit with them', g.foot);
  ok(g.fairUse === 1, 'fair use is said once on the page, not twice', g.fairUse);

  ok(!g.lvlCard, 'a guest is not shown an empty level card');
  ok(g.authCard, 'a guest is shown the sign-in card');
  ok(!g.nestedFrame, 'the sign-in card holds no second bordered card inside it');
  ok(!g.dash, 'and no member dashboard');
  ok(g.scrollW <= g.vw, 'the page never scrolls sideways', g.scrollW);

  console.log('\nguest, phone 390');
  const p = await visit({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, IPHONE, null);
  ok(p.errors.length === 0, 'no page or console errors', p.errors);
  ok(p.board && p.rows === 4, 'the earnings table survives the phone', { board: p.board, rows: p.rows });
  ok(p.scrollW <= p.vw, 'the page never scrolls sideways', p.scrollW);
  ok(p.wide.length === 0, 'nothing unclipped is wider than the screen', p.wide);
  ok(!p.lvlCard, 'no empty level card');

  // ---- the member half: nothing this pass touched may hide a card a member needs ------------------------
  console.log('\nsigned-in member');
  if (!ADMIN) { console.log('  SKIPPED - no ADMIN_KEY.local.txt, so the member half did not run'); fail++; }
  else {
    const uid = 'e2erw' + Math.random().toString(36).slice(2, 6);
    const H = { 'x-admin-key': ADMIN, 'content-type': 'application/json' };
    const po = (p2, b2) => fetch(ORIGIN + p2, { method: 'POST', headers: H, body: JSON.stringify(b2) }).then(r => r.json().catch(() => ({})));
    await po('/api/admin/e2euser', { uid, op: 'mk' });
    const se = await po('/api/admin/e2euser', { uid, op: 'sess' });
    if (!se || !se.token) { ok(false, 'could not mint a member session', se); }
    else {
      const m = await visit({ width: 1366, height: 768 }, null, se.token);
      ok(m.errors.length === 0, 'no page or console errors as a member', m.errors);
      ok(m.signedIn, 'the page knows it is signed in (body.rwd-in)');
      ok(!m.authCard, 'the sign-in card is gone');
      ok(m.lvlCard, 'the level card appears for a member');
      ok(m.board && m.rows === 4, 'the earnings table is there for a member too', { board: m.board, rows: m.rows });
      ok(m.locked, 'a brand-new member is below Bronze, as expected');
      ok(m.lockedCard, 'and is told why, instead of just being shown empty cards');
      ok(!m.refCard && !m.msnCard, 'the cards that pay stay shut until Bronze', { ref: m.refCard, msn: m.msnCard });
      ok(m.lbCard, 'the season board card renders');
      // the gate line has to name everything the gate actually shuts
      ok(/referral/i.test(m.gate || ''), 'and the gate line names referrals, which the gate also hides', m.gate);
      ok(m.scrollW <= m.vw, 'the page never scrolls sideways', m.scrollW);
    }
    await po('/api/admin/e2euser', { uid, op: 'rm' });
  }

  console.log('\nrewards-e2e: ' + pass + ' passed, ' + fail + ' failed');
  // process.exit() here aborts inside libuv mid-teardown and the shell sees 127 on a green run
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('rewards-e2e crashed: ' + (e && e.stack || e)); process.exitCode = 1; });
