/* Prop firm Challenge Mode E2E (2026-11-16).
   Pure half: lifts CHAL_TYPES + chalCompute out of the SHIPPED worker and drives the verdict through every rule with numbers worked
   out by hand - daily loss on a close, daily loss from an open loss, static / trailing / end-of-day drawdown, the target with and
   without the minimum days, the reset at 00:00 UTC, and an unpriced open position deciding nothing.
   Live half: a throwaway member starts a challenge, the open gate refuses leverage and margin above the rule, an allowed trade opens
   and closes and is counted, a second start is refused, the board answers, the run is abandoned and the account removed.
   Run: node build/challenge-e2e.js [--pure] [--falsify] */
'use strict';
const fs = require('fs'), path = require('path');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const PURE = process.argv.includes('--pure'), FALSIFY = process.argv.includes('--falsify');
let pass = 0, fail = 0;
const chk = (n, ok, x) => { if (ok) pass++; else fail++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (x !== undefined && !ok ? '  ' + JSON.stringify(x).slice(0, 300) : '')); };

const W = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
function lift() {
  const a = W.indexOf('const CHAL_TYPES = {'), b = W.indexOf('// GOLD ROOM (owner 2026-09-05)', a);
  if (a < 0 || b < 0) throw new Error('challenge block not found');
  let src = W.slice(a, b);
  if (FALSIFY) src = src.split("ddtype === 'eod' ? eodPeak : peak").join("ddtype === 'eod' ? book : book") // trailing behaves as static
    .split('if (!verdict && open.length && priced === open.length)').join('if (false)'); // open losses never checked
  return new Function(src + '\nreturn { CHAL_TYPES, chalCompute, chalRulesNorm, chalBlurb, chalNoCredit };')();
}
const { CHAL_TYPES, chalCompute, chalRulesNorm, chalBlurb, chalNoCredit } = lift();
const T0 = Date.UTC(2026, 10, 10, 9, 0, 0), DAY = 864e5;
const row = (kind, book) => { const t = CHAL_TYPES[kind]; return { book, targets: t.phases.join(','), phase: 1, daily: t.daily, dd: t.dd, ddtype: t.ddtype, mindays: t.mindays, maxpos: t.maxpos || 0, strikes: t.strikes || 0, best: t.best || 0, tlimit: t.tlimit || 0, started: T0 }; };
const cl = (d, h, pnl) => ({ ts: T0 + d * DAY + h * 36e5, pnl, ots: T0 + d * DAY + h * 36e5 - 6e5 });

// ---- pure ----
{ // one-step: 4% daily on $10k = $400. Day opens 10,000; two closes -250, -200 = 9,550 < 9,600 -> fail_daily
  const r = chalCompute(row('one', 10000), [cl(0, 1, -250), cl(0, 2, -200)], [], {}, T0 + 3 * 36e5);
  chk('daily limit fails on a close (-$450 of $400)', r.verdict === 'fail_daily' && r.atValue === 9550, r);
  const r2 = chalCompute(row('one', 10000), [cl(0, 1, -250), cl(0, 2, -140)], [], {}, T0 + 3 * 36e5);
  chk('-$390 of $400 is still running, room $10', r2.verdict === 'active' && r2.room === 10, r2);
}
{ // the reset: -390 yesterday, -390 today = both inside their own day, trailing floor 9,400 not touched (9,220 would be) -> check numbers
  const r = chalCompute(row('two', 10000), [cl(0, 1, -450), cl(1, 1, -450)], [], {}, T0 + DAY + 2 * 36e5);
  chk('daily limit resets at 00:00 UTC (two -$450 days on a 5% limit pass the daily rule)', r.verdict === 'active' && r.dayStart === 9550 && r.dailyFloor === 9050, r);
}
{ // open loss: day opens 10,300 (closed yesterday +300), today close -200 -> 10,100, open long down 250 -> equity 9,850 < floor 9,900
  const ch = row('one', 10000);
  const open = [{ sym: 'BTC', side: 'long', entry: 100, qty: 10, margin: 100, ts: T0 + DAY + 36e5 }];
  const r = chalCompute(ch, [cl(0, 2, 300), cl(1, 2, -200)], open, { BTC: 75 }, T0 + DAY + 3 * 36e5);
  chk('an open loss below the daily floor fails the run (equity $9,850 < $9,900)', r.verdict === 'fail_daily' && r.equity === 9850 && r.dailyFloor === 9900, r);
  const r2 = chalCompute(ch, [cl(0, 2, 300), cl(1, 2, -200)], open, {}, T0 + DAY + 3 * 36e5);
  chk('an UNPRICED open position decides nothing', r2.verdict === 'active' && r2.priced === 0, r2);
}
{ // static 10%: floor 9,000 forever. +700 then -1,600 over days stays above until below 9,000
  const r = chalCompute(row('two', 10000), [cl(0, 1, 400), cl(1, 1, -490), cl(2, 1, -490), cl(3, 1, -400)], [], {}, T0 + 3 * DAY + 2 * 36e5);
  chk('static drawdown floor stays at $9,000 (balance $9,020 is alive)', r.verdict === 'active' && r.ddFloor === 9000 && r.balance === 9020, r);
  const r2 = chalCompute(row('two', 10000), [cl(0, 1, 400), cl(1, 1, -490), cl(2, 1, -490), cl(3, 1, -400), cl(4, 1, -40)], [], {}, T0 + 4 * DAY + 2 * 36e5);
  chk('static drawdown fails below $9,000', r2.verdict === 'fail_drawdown', r2);
}
{ // trailing 6% on 10k: peak closed balance 10,800 -> floor 10,200; then -350 and -300 on two days (inside the 4% daily) -> 10,150 < 10,200
  const r = chalCompute(row('one', 10000), [cl(0, 1, 390), cl(1, 1, 390), cl(2, 1, 20), cl(3, 1, -350), cl(4, 1, -300)], [], {}, T0 + 4 * DAY + 2 * 36e5);
  chk('trailing drawdown follows the highest closed balance ($10,800 -> floor $10,200) and fails at $10,150', r.verdict === 'fail_drawdown' && r.peak === 10800 && r.ddFloor === 10200, r);
}
{ // eod: a profit given back the same day does not lift the floor
  const r = chalCompute(row('eod', 10000), [cl(0, 1, 500), cl(0, 3, -500)], [], {}, T0 + DAY);
  chk('end-of-day trailing ignores an intraday peak (floor stays $9,400)', r.verdict === 'active' && r.ddFloor === 9400, r);
  const r2 = chalCompute(row('eod', 10000), [cl(0, 1, 500), cl(1, 3, -100)], [], {}, T0 + DAY + 5 * 36e5);
  chk('end-of-day trailing rises with a day that closed at $10,500 (floor $9,900)', r2.ddFloor === 9900, r2);
}
{ // target with minimum days: one-step needs 5 days. +1,000 on day 0 -> not passed; trading on 5 days -> pass
  const r = chalCompute(row('one', 10000), [cl(0, 1, 390), cl(0, 2, 390), cl(0, 3, 300)], [], {}, T0 + 4 * 36e5);
  // the daily rule is about LOSS, so +1,080 in a day is fine; but only 1 trading day
  chk('the target alone does not pass before the minimum days', r.verdict === 'active' && r.balance >= 11000 && r.days === 1, r);
  const r2 = chalCompute(row('one', 10000), [cl(0, 1, 300), cl(1, 1, 300), cl(2, 1, 200), cl(3, 1, 100), cl(4, 1, 120)], [], {}, T0 + 4 * DAY + 2 * 36e5);
  chk('target + 5 trading days = pass', r2.verdict === 'pass' && r2.days === 5, r2);
}
{ // the gate numbers the terminal shows
  const r = chalCompute(row('one', 10000), [], [{ sym: 'ETH', side: 'short', entry: 2000, qty: 1, margin: 400, ts: T0 }], { ETH: 1900 }, T0 + 36e5);
  chk('a winning short counts as open profit and free margin is balance minus margin', r.unreal === 100 && r.equity === 10100 && r.freeMargin === 9600, r);
}
{ // IQ Capital shape: no daily limit, a 1% per-trade cap whose THIRD breach ends the run
  const r = chalCompute(row('iq', 10000), [cl(0, 1, -600), cl(0, 2, 300)], [], {}, T0 + 3 * 36e5);
  chk('no daily limit: a -$600 day on $10k does not fail (iq preset)', r.verdict === 'active' && r.dailyFloor === null, r);
  chk('one trade over 1% is a breach, not the end (1 of 3)', r.strikes === 1 && r.strikesMax === 3, r);
  const r3 = chalCompute(row('iq', 10000), [cl(0, 1, -150), cl(0, 2, 200), cl(1, 1, -120), cl(1, 2, 200), cl(2, 1, -110)], [], {}, T0 + 2 * DAY + 3 * 36e5);
  chk('the third breach ends it (fail_position)', r3.verdict === 'fail_position', r3);
}
{ // FTMO 1-Step shape: best day must be under 50% of the profit
  const one = [cl(0, 1, 800), cl(1, 1, 120), cl(2, 1, 100)];
  const r = chalCompute(row('ftmo1', 10000), one, [], {}, T0 + 2 * DAY + 3 * 36e5);
  chk('target reached with the best day at 78% of profit is not a pass yet', r.verdict === 'active' && r.balance === 11020 && r.bestOk === false, r);
  const r2 = chalCompute(row('ftmo1', 10000), one.concat([cl(3, 1, 400), cl(4, 1, 300), cl(5, 1, 100)]), [], {}, T0 + 5 * DAY + 3 * 36e5);
  chk('keep trading until the best day is under 50% -> pass', r2.verdict === 'pass' && r2.bestOk === true, r2);
}
{ // time limit and the pause clock
  const ch = Object.assign(row('one', 10000), { tlimit: 7 });
  chk('a run past its time limit fails (fail_time)', chalCompute(ch, [], [], {}, T0 + 8 * DAY).verdict === 'fail_time');
  chk('paused days do not count toward the limit', chalCompute(Object.assign({}, ch, { paused_ms: 3 * DAY }), [], [], {}, T0 + 8 * DAY).verdict === 'active');
  chk('a run paused right now stops its clock', chalCompute(Object.assign({}, ch, { paused: 1, paused_at: T0 + 2 * DAY }), [], [], {}, T0 + 8 * DAY).verdict === 'active');
}
{ // custom rules are validated, never clamped
  const good = { targets: [8, 4], daily: 4, dd: 8, ddtype: 'eod', mindays: 3, maxlev: 20, maxpos: 1, strikes: 2, best: 40, tlimit: 30 };
  chk('custom: a valid rule set is accepted', chalRulesNorm(good).ok === true);
  chk('custom: a 50% target is refused', chalRulesNorm({ targets: [50], dd: 10, maxlev: 10 }).field === 'targets');
  chk('custom: a 200x leverage is refused', chalRulesNorm({ targets: [10], dd: 10, maxlev: 200 }).field === 'maxlev');
  chk('custom: a daily limit at or above a static drawdown is refused', chalRulesNorm({ targets: [10], daily: 10, dd: 10, ddtype: 'static', maxlev: 10 }).field === 'daily');
  chk('custom: the blurb names every rule', /8% then 4% target, 4% daily loss, 8% end-of-day trailing drawdown, 3 trading days, 1% max loss per trade, best day under 40% of profit, 30-day limit, 20x max/.test(chalBlurb(chalRulesNorm(good).rules)));
  chk('a challenge trade and a copy earn no credit; an ordinary trade does', chalNoCredit({ chal: 'ch1' }) && chalNoCredit({ copy: 1 }) && !chalNoCredit({ id: 'x' }));
}
{ // the worker's grant/record/board paths ask chalNoCredit, and the insert writes cp=2 for a challenge trade
  chk('the tradeev insert tags a challenge trade cp=2', W.indexOf('e.copy ? 1 : (e.chal ? 2 : 0)') > 0);
  chk('no grant / mission path still asks only e.copy', W.indexOf("kind === 'close' && !lbExcluded(e.sym) && !e.copy") < 0 && W.indexOf('!x.copy && +x.ts >= dayStart') < 0);
  chk('a client sync cannot strip the challenge tag (server-held key)', /'feeVenue', 'chal'\]\) if \(cur\[k\] != null\)/.test(W));
}
chk('the three rule sets are the ones the pages describe', CHAL_TYPES.one.phases[0] === 10 && CHAL_TYPES.two.phases.join() === '8,5' && CHAL_TYPES.eod.maxlev === 50 && CHAL_TYPES.one.daily === 4 && CHAL_TYPES.two.dd === 10);
// the page must state the same rules the engine applies
{
  const pg = fs.readFileSync(path.join(__dirname, '..', 'dist', 'prop-firm-challenge', 'index.html'), 'utf8');
  chk('the page states the one-step rules the engine uses', /data-kind="one".*?-6%.*?\+10%.*?<b>10%<\/b><small>Profit target.*?<b>4%<\/b>.*?<b>6%<\/b><small>trailing DD.*?5 days min.*?100x max/s.test(pg));
  chk('the page states the two-step rules', /data-kind="two".*?<b>8% \+ 5%<\/b>.*?<b>5%<\/b>.*?<b>10%<\/b><small>static DD/s.test(pg));
  chk('the page offers the firm presets and custom rules', /data-kind="ftmo1"/.test(pg) && /data-kind="iq"/.test(pg) && /data-kind="custom"/.test(pg) && /id="cxBuild"/.test(pg));
  chk('the iq preset on the page matches the engine (8%, none, 6%, 1%, 5x)', CHAL_TYPES.iq.phases[0] === 8 && CHAL_TYPES.iq.daily === 0 && CHAL_TYPES.iq.dd === 6 && CHAL_TYPES.iq.maxpos === 1 && CHAL_TYPES.iq.maxlev === 5 && /data-kind="iq".*?<b>8%<\/b>.*?<b>None<\/b>.*?<b>6%<\/b><small>end-of-day DD.*?5x max.*?1% max loss per trade.*?3rd breach ends it/s.test(pg));
  chk('the page FAQ ships in the static HTML (crawler)', (pg.match(/<details>/g) || []).length >= 6 && /FAQPage/.test(pg));
}

(async () => {
  if (PURE || FALSIFY) return done();
  const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/)[0];
  const H = { 'x-admin-key': K, 'content-type': 'application/json' };
  const jget = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
  const post = (p, b) => fetch(ORIGIN + p, { method: 'POST', headers: H, body: JSON.stringify(b || {}) }).then(jget);
  const get = (p, h) => fetch(ORIGIN + p, { headers: h || H }).then(jget);
  const uid = 'e2ech' + Math.random().toString(36).slice(2, 8);
  try {
    const mk = await post('/api/admin/e2euser', { uid, op: 'mk' });
    chk('throwaway member', mk.status === 200, mk.body);
    const g0 = await get('/api/challenge?uid=' + uid);
    chk('a member with no challenge reads the rule sets', g0.status === 200 && g0.body.signedIn && !g0.body.active && (g0.body.types || []).length === 6 && !!g0.body.ranges, g0.body);
    const guest = await get('/api/challenge', {});
    chk('a guest reads the rule sets and is told to sign in', guest.status === 200 && guest.body.signedIn === false && (guest.body.books || []).length === 5, guest.body);
    const bad = await post('/api/challenge?uid=' + uid, { op: 'start', kind: 'one', book: 12345 });
    chk('an account size outside the list is refused', bad.status === 400 && bad.body.error === 'bad_book', bad.body);
    const st = await post('/api/challenge?uid=' + uid, { op: 'start', kind: 'eod', book: 5000 });
    chk('start a $5k one-step EOD challenge', st.status === 200 && st.body.ok, st.body);
    const again = await post('/api/challenge?uid=' + uid, { op: 'start', kind: 'one', book: 10000 });
    chk('a second challenge is refused while one runs', again.status === 409 && again.body.error === 'already_active', again.body);
    const hl = await post('/api/trade/open?uid=' + uid, { sym: 'BTC', side: 'long', margin: 50, lev: 75 });
    chk('the open gate refuses 75x on a 50x rule set', hl.body.error === 'challenge_rule' && hl.body.why === 'leverage', { st: hl.status, b: hl.body });
    const hm = await post('/api/trade/open?uid=' + uid, { sym: 'BTC', side: 'long', margin: 6000, lev: 5 });
    chk('the open gate refuses margin above the $5k account', hm.body.error === 'challenge_rule' && hm.body.why === 'margin', { st: hm.status, b: hm.body });
    const op = await post('/api/trade/open?uid=' + uid, { sym: 'BTC', side: 'long', margin: 100, lev: 10 });
    const pid = op.body.position && op.body.position.id;
    chk('an allowed position opens', op.status === 200 && !!pid, op.body);
    const s1 = await get('/api/challenge?uid=' + uid);
    chk('the open position is priced and counted', s1.body.eval && s1.body.eval.open === 1 && s1.body.eval.priced === 1 && s1.body.eval.openMargin === 100, s1.body.eval);
    if (pid) { const c = await post('/api/trade/close?uid=' + uid, { id: pid }); chk('it closes', c.status === 200 && c.body.ok, c.body); }
    let s2 = null; for (let i = 0; i < 8; i++) { await new Promise(r => setTimeout(r, 2500)); s2 = await get('/api/challenge?uid=' + uid); if (s2.body.eval && s2.body.eval.closes >= 1) break; }
    chk('the close is counted on the challenge balance', s2.body.eval && s2.body.eval.closes === 1 && s2.body.eval.days === 1 && Math.abs(s2.body.eval.balance - 5000) < 50, s2.body.eval);
    const bd = await get('/api/challenge/board?e2e=1');
    chk('the board answers with counts', bd.status === 200 && bd.body.ok && bd.body.counts && typeof bd.body.counts.passed === 'number', bd.body);
    const pub = await get('/api/challenge/board', {});
    chk('the public board answers and lists no test account', pub.status === 200 && !(pub.body.passed || []).some(x => /^e2e/i.test(x.who || '')), pub.body);
    const op3 = await post('/api/trade/open?uid=' + uid, { sym: 'BTC', side: 'long', margin: 50, lev: 10 });
    const p3 = op3.body.position && op3.body.position.id;
    const pz1 = await post('/api/challenge?uid=' + uid, { op: 'pause' });
    chk('pause is refused while a challenge position is open', pz1.status === 409 && pz1.body.error === 'positions_open', pz1.body);
    if (p3) await post('/api/trade/close?uid=' + uid, { id: p3 });
    await new Promise(r => setTimeout(r, 2500));
    const pz2 = await post('/api/challenge?uid=' + uid, { op: 'pause' });
    chk('pause works with nothing open', pz2.status === 200 && pz2.body.active && pz2.body.active.paused === true, pz2.body);
    const free = await post('/api/trade/open?uid=' + uid, { sym: 'BTC', side: 'long', margin: 50, lev: 75 });
    chk('while paused the gate is off (75x opens) - an ordinary trade', free.status === 200 && free.body.ok, free.body);
    const fid = free.body.position && free.body.position.id;
    const rs = await post('/api/challenge?uid=' + uid, { op: 'resume' });
    chk('resume works', rs.status === 200 && rs.body.active && rs.body.active.paused === false, rs.body);
    const s4 = await get('/api/challenge?uid=' + uid);
    chk('the trade opened while paused is NOT a challenge position', s4.body.eval && s4.body.eval.open === 0, s4.body.eval);
    if (fid) await post('/api/trade/close?uid=' + uid, { id: fid });
    const ab = await post('/api/challenge?uid=' + uid, { op: 'abandon' });
    chk('abandon ends it', ab.status === 200 && ab.body.ok, ab.body);
    const s3 = await get('/api/challenge?uid=' + uid);
    chk('history keeps the abandoned run', !s3.body.active && (s3.body.history || [])[0] && s3.body.history[0].status === 'abandoned', s3.body);
    const op2 = await post('/api/trade/open?uid=' + uid, { sym: 'BTC', side: 'long', margin: 50, lev: 75 });
    chk('after the challenge the gate is gone (75x opens again)', op2.status === 200 && op2.body.ok, op2.body);
    const p2 = op2.body.position && op2.body.position.id; if (p2) await post('/api/trade/close?uid=' + uid, { id: p2 });
    const cbad = await post('/api/challenge?uid=' + uid, { op: 'start', kind: 'custom', book: 10000, rules: { targets: [10], dd: 10, maxlev: 500 } });
    chk('a custom rule out of range is refused by the server', cbad.status === 400 && cbad.body.error === 'bad_rule' && cbad.body.field === 'maxlev', cbad.body);
    const cok = await post('/api/challenge?uid=' + uid, { op: 'start', kind: 'custom', book: 10000, rules: { targets: [6], daily: 0, dd: 8, ddtype: 'eod', maxlev: 20, maxpos: 1, strikes: 2, best: 40, tlimit: 30 } });
    chk('a custom run starts with its rules stored', cok.status === 200 && cok.body.active && cok.body.active.custom && cok.body.active.maxpos === 1 && cok.body.active.tlimit === 30 && /6% target, no daily limit/.test(cok.body.active.blurb || ''), cok.body);
    await post('/api/challenge?uid=' + uid, { op: 'abandon' });
    const cs = await get('/api/challenge/cert.svg?id=nope', {});
    chk('an unknown certificate is a 404 svg', cs.status === 404);
  } catch (e) { chk('no exception', false, String(e && e.stack || e)); }
  finally { await post('/api/admin/e2euser', { uid, op: 'rm' }); }
  done();
})();
function done() { console.log('\n' + pass + ' ok, ' + fail + ' failed'); process.exitCode = fail ? 1 : 0; }
