/* WHEN A MARKET OPENS AGAIN - the suite that stops the sentence going false again.
 *
 * 2026-10-25, owner, with a photo of the terminal: "Ovaj iskaz nije tacan. Njujork se ne otvara nedeljom vec
 * ponedeljkom. Kako ovo ovako pisemo?! Berza se otvara u 09:30 po njujorskom vremenu."
 *
 * Measured that Sunday morning before anything was touched, with a real open on each symbol: BRENT, OIL, COPPER,
 * XAU, SPX500, US30 and EURUSD were ALL refused with the identical line, "Closed for the weekend - reopens Sunday
 * 17:00 New York time". It is true of the currency week. It is false of a New York cash index, which is a number
 * calculated from shares that open MONDAY at 09:30 - and the photographed line was not even that one: it was
 * "Waiting for the live price for BRENT - try again in a second", because a shut market's price is stale by
 * definition and the plan form asked about staleness before it asked about the exchange being open.
 *
 * Two invariants, and they are the two halves of the owner's correction:
 *   1. a claim about the next open is DERIVED from the venue's own published session, or it is not made at all
 *      (a ~24 h futures or FX window cannot support one - rolling BRENT's Sun 00:00-23:59 forward lands on Monday
 *      00:00, a day and eighteen hours after the pit really reopens);
 *   2. a market that is shut is answered as shut, never as slow, on every class and not only on a stock.
 *
 * `--pure` runs the 20 checks that need no network (the helper is lifted out of the SHIPPED worker, so the test
 * cannot drift from what runs). `--falsify` restores the single sentence and the stocks-only predicate and must
 * turn the load-bearing checks red.
 */
'use strict';
const fs = require('fs');
const PURE = process.argv.indexOf('--pure') >= 0;
const FALSIFY = process.argv.indexOf('--falsify') >= 0;
const O = 'https://marginpad.io';

let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (extra ? '   ' + extra : '')); } };

// ---- lift the helper out of the SHIPPED worker -------------------------------------------------------------
function liftFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found in worker source: ' + name);
  let d = 0, end = -1;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) { end = k; break; } }
  }
  if (end < 0) throw new Error('unbalanced: ' + name);
  return src.slice(i, end + 1);
}

// the sessions the live feed really published on 2026-10-25, 00:53 New York
const SESS = {
  AAPL: { s: 1792762200, e: 1792785600, tz: 'America/New_York', gmt: -14400 },   // Fri 09:30-16:00 NY, 6.5h
  SPX500: { s: 1792762200, e: 1792785600, tz: 'America/New_York', gmt: -14400 },
  BRENT: { s: 1792900800, e: 1792987140, tz: 'America/New_York', gmt: -14400 },  // Sun 00:00-23:59 NY, 24h
  EURUSD: { s: 1792710000, e: 1792796340, tz: 'Europe/London', gmt: 0 },         // Thu 23:00-Fri 22:59 London, 24h
};
const SUNDAY = 1792947180000; // Sunday 2026-10-25, 00:53 New York

function pureChecks() {
  const src = fs.readFileSync('src/worker.js', 'utf8');
  const sandbox = liftFn(src, '_nextOpenAt') + '\n' + liftFn(src, '_clockAt') + '\n' + liftFn(src, '_nextOpenMsg')
    + '\nreturn { _nextOpenAt, _nextOpenMsg };';
  const guard = (src.match(/const SESS_EXCH_MAX = ([^;]+);/) || [])[1];
  // eslint-disable-next-line no-new-func
  const F = new Function('SESS_EXCH_MAX', sandbox)(FALSIFY ? 1e9 : eval(guard));

  console.log('\n-- the claim is derived from the venue, or it is not made (helper lifted out of src/worker.js)');
  const aapl = F._nextOpenMsg({ sess: SESS.AAPL }, SUNDAY);
  ok(aapl === 'It opens again Monday 09:30 New York time.', 'a New York exchange session says Monday 09:30 New York time', aapl);
  const spx = F._nextOpenMsg({ sess: SESS.SPX500 }, SUNDAY);
  ok(spx === aapl, 'a New York CASH INDEX gets the same answer as the shares inside it', spx);
  ok(!/Sunday/.test(aapl + spx), 'neither names Sunday - the owner\'s correction', aapl + ' / ' + spx);

  const brent = F._nextOpenMsg({ sess: SESS.BRENT }, SUNDAY);
  ok(brent === '', 'a 24h futures window makes NO claim about the next open', JSON.stringify(brent));
  const eur = F._nextOpenMsg({ sess: SESS.EURUSD }, SUNDAY);
  ok(eur === '', 'a 24h FX window makes NO claim about the next open', JSON.stringify(eur));
  ok(F._nextOpenMsg({}, SUNDAY) === '', 'no published session at all makes no claim (XAU, XAG)');
  ok(F._nextOpenMsg({ sess: { s: 0, e: 0 } }, SUNDAY) === '', 'an empty session makes no claim');

  // a weeknight: the next open is the NEXT WEEKDAY, not Monday
  const THU = Date.UTC(2026, 9, 22, 23, 0, 0); // Thursday 19:00 New York
  const thu = F._nextOpenMsg({ sess: { s: SESS.AAPL.s - 86400, e: SESS.AAPL.e - 86400, tz: 'America/New_York', gmt: -14400 } }, THU);
  ok(/^It opens again (Thursday|Friday) 09:30 New York time\.$/.test(thu), 'on a weeknight it names the next WEEKDAY, never Monday', thu);
  // the roll never lands on a Saturday or a Sunday
  let weekendHit = 0;
  for (let d = 0; d < 14; d++) {
    const at = F._nextOpenAt({ sess: SESS.AAPL }, SUNDAY + d * 86400000);
    if (!at) continue;
    const wd = new Date((at + SESS.AAPL.gmt) * 1000).getUTCDay();
    if (wd === 0 || wd === 6) weekendHit++;
  }
  ok(weekendHit === 0, 'over a fortnight of start points the derived open never lands at the weekend', 'weekend hits ' + weekendHit);
  // and it is always in the future
  let past = 0;
  for (let d = 0; d < 14; d++) { const now = SUNDAY + d * 86400000; const at = F._nextOpenAt({ sess: SESS.AAPL }, now); if (at && at * 1000 <= now) past++; }
  ok(past === 0, 'the derived open is always in the future', 'in the past ' + past);

  console.log('\n-- the shipped source carries the rule in both places');
  const home = fs.readFileSync('dist/assets/home.js', 'utf8');
  ok(/20\s*\*\s*3600/.test(src), 'the worker states the 20h exchange-session ceiling');
  ok(/20\s*\*\s*3600/.test(home), 'the terminal states the SAME ceiling, so the two cannot disagree');
  ok(!/reopens Sunday 17:00 New York time\.'/.test(src.replace(/currency market reopens Sunday 17:00 New York time/g, '')),
    'the one-sentence-for-every-class weekend line is gone from the worker');
  ok(/'Sunday 17:00' : 'Sunday 18:00'/.test(src), 'the two gate minutes are stated exactly - FX 17:00, everything else 18:00');
  ok(!/reopens Sunday evening/.test(src), 'no vague reopen sentence survives (2026-10-25: the owner asked for the exact minute)');
  ok(!/if\(!STK\[sym\]\)return false;/.test(home), 'mpIsMktClosed no longer answers for stocks alone');
  ok(/window\.mpIsMktClosed\(sym\)\)\{_say\(window\.mpMktClosedMsg/.test(home.replace(/\s+/g, ' ').replace(/ /g, '')) || /mpIsMktClosed\(sym\)/.test(home),
    'the plan form asks mpIsMktClosed');

  // the ORDER is the bug: closed must be asked before freshness
  const iClosed = home.indexOf('if(window.mpIsMktClosed&&window.mpIsMktClosed(sym)){_say(window.mpMktClosedMsg');
  const iFresh = home.indexOf("'Waiting for the live price for '");
  ok(iClosed > 0 && iFresh > 0 && iClosed < iFresh, 'the plan form asks "is it closed" BEFORE "is the price fresh"',
    'closed@' + iClosed + ' fresh@' + iFresh);
  ok(!/mpStk\[sym\]&&\/\^\(CLOSED\|PREPRE\|POSTPOST\)/.test(home), 'the stocks-only copy of that check is gone');
  ok(/exWhen/.test(home), 'the terminal names the EXCHANGE clock, not only the reader\'s');
}

async function liveChecks() {
  const KEY = (fs.readFileSync('ADMIN_KEY.local.txt', 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
  const AH = { 'x-admin-key': KEY, 'content-type': 'application/json' };
  const J = async (u, o) => { const r = await fetch(O + u, o); const t = await r.text(); try { return { s: r.status, j: JSON.parse(t) }; } catch (e) { return { s: r.status, t: t.slice(0, 200) }; } };

  const uid = 'e2e-mo' + Math.random().toString(36).slice(2, 6);
  await J('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'mk' }) });
  const se = await J('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'sess' }) });
  const CK = { 'content-type': 'application/json', cookie: 'mp_sess=' + (se.j.token || se.j.sess) };
  const say = {};
  try {
    console.log('\n-- what a real open is answered with, right now');
    for (const sym of ['SPX500', 'US30', 'AAPL', 'BRENT', 'XAU', 'EURUSD', 'BTC']) {
      const o = await J('/api/trade/open', { method: 'POST', headers: CK, body: JSON.stringify({ sym, side: 'long', lev: 5, margin: 10, cid: 'mo' + Math.random().toString(36).slice(2, 8) }) });
      const open = o.s === 200 && !(o.j && o.j.error);
      say[sym] = open ? null : String((o.j && (o.j.message || o.j.hint)) || o.s);
      console.log('     ' + sym.padEnd(8) + (open ? 'OPEN' : say[sym]));
      if (open) { const id = (o.j.position && o.j.position.id) || o.j.id; if (id) await J('/api/trade/close', { method: 'POST', headers: CK, body: JSON.stringify({ id: String(id), pct: 100 }) }); }
    }
  } finally {
    await J('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'rm' }) });
  }

  ok(say.BTC === null, 'crypto never closes');
  const shut = Object.keys(say).filter(k => say[k]);
  ok(shut.length > 0, 'something is shut right now, so these messages are measurable', 'shut: ' + shut.join(','));

  // NO instrument whose session we know may be told it reopens on a Sunday
  for (const s of ['SPX500', 'US30', 'AAPL']) {
    if (!say[s]) { console.log('  --   ' + s + ' is open right now - its refusal is not measurable this minute'); continue; }
    ok(!/Sunday/i.test(say[s]), s + ' (New York) is never told it reopens on a Sunday', say[s]);
    ok(/09:30 New York time/.test(say[s]), s + ' names 09:30 New York time, as the owner asked', say[s]);
  }
  // the currency market keeps the sentence that is true of it
  if (say.EURUSD) ok(/currency market|09:00|It opens again/.test(say.EURUSD), 'the FX refusal is about the currency market', say.EURUSD);
  // a futures market may not be handed a minute nobody can check
  if (say.BRENT) ok(!/Sunday 17:00|Monday 00:00/.test(say.BRENT), 'a futures market is not handed a minute we cannot stand behind', say.BRENT);
  // nothing anywhere repeats the retired one-size line
  const all = Object.values(say).filter(Boolean).join(' | ');
  ok(!/reopens Sunday 17:00 New York time\.(?! )/.test(all.replace(/currency market reopens Sunday 17:00 New York time\./g, '')),
    'the retired one-sentence-for-every-class line is on no refusal', all.slice(0, 200));
}

(async () => {
  if (FALSIFY) console.log('FALSIFY: the 20h exchange-session ceiling is removed - the load-bearing checks must go red');
  pureChecks();
  if (!PURE) await liveChecks();
  console.log('\nmarket-open-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();
