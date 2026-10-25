/* EVERY CLOSED MARKET NAMES THE MINUTE IT OPENS, IN NEW YORK TIME (2026-10-25, owner: "Slobodno nek pise kad se
 * otvara tacno i da je po njujorku samo nek bude tacna informacija. Prosli iskaz je omasio za jedan dan.")
 *
 * The earlier fix stopped the false claim (New York reopening on a Sunday) but paid for it with vagueness: a
 * futures market was told "reopens Sunday evening" and gold was told the same, which is true and useless. The
 * owner's rule is the stronger one - state the exact minute, in New York, and be right.
 *
 * MEASURED first, because the answer is different for three groups and only one of them was derivable before:
 *   - EVERY index publishes a real exchange session, foreign ones included: GER40 Fri 08:00-16:30 Berlin,
 *     JPN225 09:00-15:30 Tokyo, HK50 09:30-16:10 Hong Kong, AUS200 10:00-16:12 Sydney, VIX 02:00-15:15 Chicago.
 *     So the roll-forward answers for all of them - it simply had to say the result in NEW YORK rather than in
 *     the venue's own city, which is also DST-proof: Europe left summer time on 2026-10-25 and the United
 *     States leaves on 2026-11-01, so for one week the offset between them is not what it is in any other, and
 *     arithmetic on the offset would be wrong exactly then. Formatting the TIMESTAMP in America/New_York cannot
 *     be wrong in that week or any other.
 *   - XAU and XAG publish nothing, and BRENT, OIL, NATGAS, COPPER and every currency pair publish a 24h window
 *     that says nothing about when the pit reopens. For those the schedule is OURS - it is the weekend rule and
 *     the daily 17:00-18:00 break in this very function - so the minute can be stated exactly and the test
 *     drives the shipped gate minute by minute to prove the sentence equals the gate's own first open:
 *       forex  -> Sunday 17:00 New York (the FX week; forex is exempt from the daily break)
 *       metals, energy -> Sunday 18:00 New York (the weekend rule clears at 17:00, the daily break holds to 18:00)
 *     and on a weeknight a metal reopens at 18:00 the same day, which is the same rule.
 */
'use strict';
const fs = require('fs');
const DRY = process.argv.indexOf('--dry') >= 0;

const edits = [];
const one = (file, from, to, note) => edits.push({ file, from, to, note });

/* ---------------------------------------------------------------- worker ----------------------------------- */

one('src/worker.js',
  `function _nextOpenMsg(pd, now) {
  const at = _nextOpenAt(pd, now); if (!at) return '';
  const w = pd.sess, d = new Date((at + (+w.gmt || 0)) * 1000);
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
  const hh = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
  const city = String(w.tz || '').split('/').pop().replace(/_/g, ' ');
  return 'It opens again ' + day + ' ' + hh + (city ? ' ' + city + ' time' : '') + '.';
}`,
  `/* THE EXCHANGE'S OWN CLOCK IS NEW YORK'S, FORMATTED FROM THE TIMESTAMP (2026-10-25, owner: "da je po
   njujorku samo nek bude tacna informacija"). Europe left summer time on 2026-10-25 and the United States
   leaves on 2026-11-01, so for one week the offset between Frankfurt and New York is not what it is in any
   other week - deriving the New York hour by arithmetic on an offset is wrong exactly then, and formatting
   the instant in America/New_York is right always. The venue's own city follows in brackets when it is not
   New York, so a reader can check it against what the exchange says about itself. */
function _clockAt(ms, tz) {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(ms));
    const g = (t) => ((p.find((x) => x.type === t) || {}).value || '');
    const h = g('hour') === '24' ? '00' : g('hour'); // some ICU builds print midnight as 24 under hour12:false
    return { day: g('weekday'), hm: h + ':' + g('minute') };
  } catch (e) { return null; }
}
function _nextOpenMsg(pd, now) {
  const at = _nextOpenAt(pd, now); if (!at) return '';
  const tz = String((pd && pd.sess && pd.sess.tz) || '') || 'America/New_York';
  const ny = _clockAt(at * 1000, 'America/New_York'); if (!ny) return '';
  if (tz === 'America/New_York') return 'It opens again ' + ny.day + ' ' + ny.hm + ' New York time.';
  const vn = _clockAt(at * 1000, tz), city = tz.split('/').pop().replace(/_/g, ' ');
  return 'It opens again ' + ny.day + ' ' + ny.hm + ' New York time' + (vn ? ' (' + vn.hm + ' ' + city + ')' : '') + '.';
}`,
  'worker: the derived open is stated in New York time');

one('src/worker.js',
  `    const nx = _nextOpenMsg(pd, now);
    if (nx) return { open: false, cls, msg: 'Closed for the weekend. ' + nx };
    return { open: false, cls, msg: cls === 'forex'
      ? 'Closed for the weekend - the currency market reopens Sunday 17:00 New York time.'
      : 'Closed for the weekend - this market reopens Sunday evening New York time.' };`,
  `    const nx = _nextOpenMsg(pd, now);
    if (nx) return { open: false, cls, msg: 'Closed for the weekend. ' + nx };
    /* NO PUBLISHED EXCHANGE SESSION (XAU, XAG) OR A 24h ONE (futures, FX) - so the schedule is the rule in
       THIS function, and the minute can therefore be stated exactly rather than vaguely: the currency week
       opens Sunday 17:00 New York, and a metal or an energy contract is then held by the daily 17:00-18:00
       break below until 18:00. market-open-e2e walks the SHIPPED gate minute by minute across a weekend and
       requires these two sentences to name its own first open to the minute. */
    return { open: false, cls, msg: 'Closed for the weekend. It opens again '
      + (cls === 'forex' ? 'Sunday 17:00' : 'Sunday 18:00') + ' New York time.' };`,
  'worker: the weekend minute is exact for a market with no published session');

one('src/worker.js',
  `  if (cls !== 'forex' && min >= 17 * 60 && min < 18 * 60) return { open: false, cls, msg: (cls === 'metal' ? 'Metals' : 'Indices') + ' pause daily 17:00-18:00 New York time.' };`,
  `  if (cls !== 'forex' && min >= 17 * 60 && min < 18 * 60) return { open: false, cls, msg: (cls === 'metal' ? 'Metals' : 'Indices') + ' pause daily 17:00-18:00 New York time. It opens again 18:00 New York time today.' };`,
  'worker: the daily break names the minute it ends');

/* ---------------------------------------------------------------- terminal --------------------------------- */

one('dist/assets/home.js',
  `  window.mpMktExplain=function(sym){`,
  `  /* WHEN OUR OWN GATE OPENS A MARKET THAT PUBLISHES NO SESSION (2026-10-25). XAU and XAG publish nothing and
     a futures or FX contract publishes a 24h window, so the schedule is the worker's weekend rule and its daily
     17:00-18:00 New York break - the same two constants, stated here so the terminal can name the minute and
     count down to it instead of falling back to "when the exchange reopens". Stepping UTC hour boundaries and
     ASKING what New York reads is DST-proof; deriving it from an offset is not, and the week of 2026-10-25 is
     exactly the week that would catch it (Europe off summer time, the United States still on it). */
  window.mpNextGateOpen=function(cls){
    var want=(cls==='forex')?17:18, base=Math.ceil(Date.now()/3600000)*3600000;
    for(var i=0;i<=24*9;i++){
      var ms=base+i*3600000, p=null;
      try{
        var pr=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date(ms));
        var g=function(k){var f=pr.filter(function(x){return x.type===k;})[0];return f?f.value:'';};
        p={wd:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(g('weekday')),h:(+g('hour')||0)%24,m:+g('minute')||0};
      }catch(e){return 0;}
      if(!p||p.m!==0||p.h!==want) continue;
      if(cls==='forex'){ if(p.wd===0) return ms; }        // the FX week starts Sunday 17:00 New York
      else if(p.wd>=0&&p.wd<=4) return ms;                 // Sunday to Thursday 18:00 - never Friday or Saturday
    }
    return 0;
  };
  window.mpMktExplain=function(sym){`,
  'home.js: the terminal can name our own gate’s next open');

one('dist/assets/home.js',
  `    var open=window.mpNextOpen(sym), ss=window.mpMktSess[sym]||{};
    var when='', local='', exWhen='';`,
  `    var open=window.mpNextOpen(sym), ss=window.mpMktSess[sym]||{};
    // no published exchange session to roll forward (gold, silver, a futures contract, a currency pair) - the
    // worker's own weekend / daily-break rule is the schedule, so ask it rather than going vague
    if(!open&&cls!=='crypto'){try{open=window.mpNextGateOpen(cls)||0;}catch(e){}}
    var when='', local='', exWhen='';`,
  'home.js: a market with no session still gets a minute');

one('dist/assets/home.js',
  `      if(ss.tz){try{
        var _p=new Intl.DateTimeFormat('en-US',{timeZone:ss.tz,weekday:'long',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(dt);
        var _g=function(k){var f=_p.filter(function(x){return x.type===k;})[0];return f?f.value:'';};
        exWhen=_g('weekday')+' '+_g('hour')+':'+_g('minute')+' '+String(ss.tz).split('/').pop().replace(/_/g,' ')+__esT_home("exchangeTime",' time');
      }catch(e){}}`,
  `      try{
        var _clk=function(tz){
          var _p=new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'long',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(dt);
          var _g=function(k){var f=_p.filter(function(x){return x.type===k;})[0];return f?f.value:'';};
          var _h=_g('hour')==='24'?'00':_g('hour');
          return {day:_g('weekday'),hm:_h+':'+_g('minute')};
        };
        var _ny=_clk('America/New_York'), _tz=String(ss.tz||'America/New_York');
        exWhen=_ny.day+' '+_ny.hm+__esT_home("newYorkTime",' New York time');
        // the venue's own clock follows in brackets, so a reader can check it against what the exchange says
        if(_tz&&_tz!=='America/New_York'){var _v=_clk(_tz);exWhen+=' ('+_v.hm+' '+_tz.split('/').pop().replace(/_/g,' ')+')';}
      }catch(e){}`,
  'home.js: the terminal leads with New York, the venue follows in brackets');

/* ---------------------------------------------------------------- apply ------------------------------------ */

const byFile = {};
for (const e of edits) (byFile[e.file] = byFile[e.file] || []).push(e);
let bad = 0; const out = {};
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
