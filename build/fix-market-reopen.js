/* WHEN A MARKET OPENS AGAIN IS DERIVED FROM THE VENUE'S OWN SESSION, AND A CLOSED MARKET IS NOT A SLOW ONE
 * (2026-10-25, owner, photo + "Ovaj iskaz nije tacan. Njujork se ne otvara nedeljom vec ponedeljkom. Kako ovo
 *  ovako pisemo?! Berza se otvara u 09:30 po njujorskom vremenu.")
 *
 * TWO SEPARATE FAULTS, both measured on a Sunday morning (00:53 New York) before anything was touched.
 *
 * 1. ONE SENTENCE ANSWERED FOR FOUR CLASSES. A real open on each refused with the identical line:
 *      BRENT OIL COPPER XAU SPX500 US30 EURUSD -> "Closed for the weekend - reopens Sunday 17:00 New York time."
 *    It is TRUE of the currency market, whose week really does start Sunday 17:00 New York. It is FALSE of a NEW
 *    YORK CASH INDEX: SPX500 and US30 are calculated from shares that open MONDAY at 09:30, which is exactly the
 *    correction the owner made. Yahoo publishes each instrument's own regular session (`sess`), so where that
 *    window is a real exchange session - under 20 h; AAPL and SPX500 read Fri 09:30-16:00 New York - the next
 *    open is DERIVED by rolling it forward over the weekend. A ~24 h window (BRENT reads Sun 00:00-23:59, EURUSD
 *    Thu 23:00-Fri 22:59 London) says nothing about when the pit reopens, so those keep a class sentence - and
 *    that sentence may only claim what we can check.
 *
 * 2. THE PHOTOGRAPHED LINE WAS NOT THE MARKET-CLOSED ONE AT ALL. It was "Waiting for the live price for BRENT -
 *    try again in a second", raised by the plan form's 3-second freshness test. A shut market's price is stale BY
 *    DEFINITION - it stopped when the exchange did - and that test ran BEFORE the closed test, so the one case
 *    where the price can never arrive was the one case promised it "in a second". Worse, the closed test it ran
 *    before was `window.mpStk[sym]`, i.e. STOCKS ONLY, so for a commodity, an index or a currency pair it could
 *    not have fired even in the right order. `mpIsMktClosed` now answers for every market the price feed reports
 *    a session state for, and the plan form asks it first.
 */
'use strict';
const fs = require('fs');
const DRY = process.argv.indexOf('--dry') >= 0;

const edits = [];
function one(file, from, to, note) { edits.push({ file, from, to, note }); }

/* ---------------------------------------------------------------- worker: derive the next open ------------- */

const HELPERS = `/* WHEN IT OPENS AGAIN IS DERIVED, NEVER ASSERTED (2026-10-25, owner: "Njujork se ne otvara nedeljom vec
   ponedeljkom ... berza se otvara u 09:30 po njujorskom vremenu"). The weekend used to answer with ONE sentence
   naming Sunday 17:00 New York for every non-crypto class at once - measured that morning, BRENT, OIL, COPPER,
   XAU, SPX500, US30 and EURUSD all got it. It is true of the currency week and false of a New York cash index,
   which is calculated from shares that open MONDAY 09:30. Yahoo publishes the instrument's own regular session,
   so where that window is a real exchange session (under 20 h) the next open is rolled forward out of it, over
   the weekend, which is the same walk the terminal's own mpNextOpen does. A ~24 h futures or FX window carries
   no such information and gets a class sentence instead. */
const SESS_EXCH_MAX = 20 * 3600; // longer than this is a 24h futures/FX day, not an exchange session
function _nextOpenAt(pd, now) {
  const w = pd && pd.sess; if (!w || !(+w.s > 0) || !(+w.e > 0)) return 0;
  const dur = +w.e - +w.s; if (dur <= 0 || dur > SESS_EXCH_MAX) return 0;
  const DAY = 86400, gmt = +w.gmt || 0, nowS = Math.floor((now || Date.now()) / 1000);
  let open = +w.s, close = +w.e, guard = 0;
  while ((open <= nowS || close <= nowS) && guard++ < 14) { open += DAY; close += DAY; }
  guard = 0; // an exchange does not open at the weekend - step over Saturday and Sunday in EXCHANGE-local time
  while (guard++ < 14) { const d = new Date((open + gmt) * 1000).getUTCDay(); if (d !== 0 && d !== 6) break; open += DAY; close += DAY; }
  return open > nowS ? open : 0;
}
function _nextOpenMsg(pd, now) {
  const at = _nextOpenAt(pd, now); if (!at) return '';
  const w = pd.sess, d = new Date((at + (+w.gmt || 0)) * 1000);
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
  const hh = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
  const city = String(w.tz || '').split('/').pop().replace(/_/g, ' ');
  return 'It opens again ' + day + ' ' + hh + (city ? ' ' + city + ' time' : '') + '.';
}
function marketSession(sym, pd, now) {`;

one('src/worker.js', 'function marketSession(sym, pd, now) {', HELPERS, 'worker: _nextOpenAt + _nextOpenMsg');

// the stock branch - it named the hours and never the next open
one('src/worker.js',
  `  if (cls === 'stock') { const st = String((pd && pd.state) || 'CLOSED').toUpperCase(); return { open: st === 'REGULAR', cls, msg: st === 'REGULAR' ? '' : 'US stocks trade 9:30-16:00 New York time, Monday to Friday (now: ' + st.toLowerCase() + ').' }; }`,
  `  if (cls === 'stock') { const st = String((pd && pd.state) || 'CLOSED').toUpperCase(); const nx = _nextOpenMsg(pd, now); return { open: st === 'REGULAR', cls, msg: st === 'REGULAR' ? '' : 'US stocks trade 9:30-16:00 New York time, Monday to Friday (now: ' + st.toLowerCase() + ').' + (nx ? ' ' + nx : '') }; }`,
  'worker: the stock refusal names the next open');

// the three weekend branches - one sentence for four classes
one('src/worker.js',
  `  if (t.wd === 6) return { open: false, cls, msg: 'Closed for the weekend - reopens Sunday 17:00 New York time (' + (cls === 'forex' ? '22:00' : '22:00') + ' UTC in summer).' };
  if (t.wd === 0 && min < 17 * 60) return { open: false, cls, msg: 'Closed for the weekend - reopens Sunday 17:00 New York time.' };
  if (t.wd === 5 && min >= 17 * 60) return { open: false, cls, msg: 'Closed for the weekend - reopens Sunday 17:00 New York time.' };`,
  `  if (t.wd === 6 || (t.wd === 0 && min < 17 * 60) || (t.wd === 5 && min >= 17 * 60)) {
    /* THE REOPEN MUST MATCH THE INSTRUMENT. Where the venue publishes a real exchange session we say the day and
       the minute it opens, out of that session (a New York cash index: Monday 09:30 New York time). Where it
       publishes a 24 h window - a futures contract, a currency pair - that window cannot say when the pit
       reopens, so the class sentence does, and only as far as it can be checked: the currency week genuinely
       starts Sunday 17:00 New York, and everything else here comes back on Sunday evening. */
    const nx = _nextOpenMsg(pd, now);
    if (nx) return { open: false, cls, msg: 'Closed for the weekend. ' + nx };
    return { open: false, cls, msg: cls === 'forex'
      ? 'Closed for the weekend - the currency market reopens Sunday 17:00 New York time.'
      : 'Closed for the weekend - this market reopens Sunday evening New York time.' };
  }`,
  'worker: the weekend reopen matches the instrument');

// the venue-session branch - it named the hours and never the next open
one('src/worker.js',
  `      return { open: false, cls, msg: 'The exchange is closed. This market trades ' + hh(+w9.s) + '-' + hh(+w9.e) + (w9.tz ? ' ' + w9.tz : '') + ', and its price does not move outside those hours.' };`,
  `      const nx9 = _nextOpenMsg(pd, now);
      return { open: false, cls, msg: 'The exchange is closed. This market trades ' + hh(+w9.s) + '-' + hh(+w9.e) + (w9.tz ? ' ' + w9.tz : '') + ', and its price does not move outside those hours.' + (nx9 ? ' ' + nx9 : '') };`,
  'worker: the venue-hours refusal names the next open');

/* ---------------------------------------------------------------- client: ask the closed question first ---- */

one('dist/assets/home.js',
  `window.mpIsMktClosed=function(sym){sym=String(sym||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!STK[sym])return false;if(BEQ[sym])return false;`,
  `window.mpIsMktClosed=function(sym){sym=String(sym||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(BEQ[sym])return false;/* EVERY MARKET THAT KEEPS HOURS, NOT ONLY A STOCK (2026-10-25): this asked \`STK[sym]\` first, so a
     commodity, an index and a currency pair were never closed as far as the client was concerned - and on a Sunday
     the plan form therefore fell through to its 3 s freshness test and promised a BRENT price "in a second". The
     state is written from our own /api/price, which publishes one ONLY for a Yahoo-fed instrument, so the state's
     own presence is what says this market keeps hours - a coin never has one, and XAU/XAG (Bybit linear, no
     published session) correctly stay unknown and therefore allowed. */`,
  'home.js: mpIsMktClosed answers for every market that keeps hours');

const FRESH = `    if(!pl||pl.sym!==sym||!(+pl.price>0)||!pl.t||(Date.now()-pl.t)>3000){_say(__esT_home("waitingForTheLive2",'Waiting for the live price for ')+(sym||__esT_home("thisCoin",'this coin'))+__esT_home("tryAgainInA",' - try again in a second.'));add._busy=false;return;}`;
one('dist/assets/home.js', FRESH,
  `    /* A CLOSED MARKET IS NOT A SLOW ONE, SO IT IS ASKED ABOUT FIRST (2026-10-25, owner's photo: "Waiting for the
       live price for BRENT - try again in a second" at 00:53 Sunday New York, with "Ovaj iskaz nije tacan"). A shut
       market's price is stale by definition - it stopped when the exchange did - so the freshness test below was
       always the one that fired, and it is the one sentence that cannot be true in that state. */
    if(window.mpIsMktClosed&&window.mpIsMktClosed(sym)){_say(window.mpMktClosedMsg?window.mpMktClosedMsg(sym):(sym+__esT_home("marketIsClosedRight2",' market is closed right now.')));add._busy=false;return;}
${FRESH}`,
  'home.js: the plan form asks the closed question before the freshness one');

// the old stocks-only check, now redundant and in the wrong place
one('dist/assets/home.js',
  `
    if(window.mpStk&&window.mpStk[sym]&&/^(CLOSED|PREPRE|POSTPOST)$/i.test(pl.state||'')){_say(window.mpMktClosedMsg?window.mpMktClosedMsg(sym):(sym+__esT_home("marketIsClosedRight2",' market is closed right now.')));add._busy=false;return;} // stocks: no fills while the exchange is shut (price is frozen at last close)`,
  '', 'home.js: the stocks-only copy of that check is gone');

/* ---------------------------------------------------------------- apply ------------------------------------ */

const byFile = {};
for (const e of edits) (byFile[e.file] = byFile[e.file] || []).push(e);
let bad = 0;
const out = {};
for (const f of Object.keys(byFile)) {
  let s = fs.readFileSync(f, 'utf8');
  for (const e of byFile[f]) {
    const n = s.split(e.from).length - 1;
    if (n !== 1) { console.log('REFUSING: ' + f + ' holds ' + n + ' of the anchor for "' + e.note + '" (want exactly 1)'); bad++; continue; }
    s = s.split(e.from).join(e.to);
    console.log('  ok  ' + e.note);
  }
  out[f] = s;
}
if (bad) { console.log('\n' + bad + ' anchor(s) missing - nothing written'); process.exit(1); }
if (DRY) { console.log('\n--dry: nothing written'); process.exit(0); }
for (const f of Object.keys(out)) fs.writeFileSync(f, out[f]);
console.log('\nwritten: ' + Object.keys(out).join(', '));
