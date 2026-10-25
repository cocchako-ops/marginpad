/* THE SENTENCE MUST NAME THE GATE'S OWN FIRST OPEN MINUTE (2026-10-25, owner: "Slobodno nek pise kad se otvara
 * tacno i da je po njujorku samo nek bude tacna informacija. Prosli iskaz je omasio za jedan dan.")
 *
 * A claim about when a market opens can be checked against exactly one thing: the code that decides whether it
 * is open. So this does not read the sentence and nod at it - it lifts `marketSession` out of the SHIPPED
 * worker, steps it ONE MINUTE AT A TIME across a whole weekend for a symbol of every class, finds the first
 * minute it answers open, and requires the refusal printed the minute before to name that minute.
 *
 * That is what makes "off by one day" impossible to ship again: the previous sentence said Sunday 17:00 for a
 * New York index, the gate opened it Monday 09:30, and nothing in the codebase compared the two.
 *
 * `--falsify` puts the retired sentences back and must turn the load-bearing checks red.
 */
'use strict';
const fs = require('fs');
const FALSIFY = process.argv.indexOf('--falsify') >= 0;
const LIVE = process.argv.indexOf('--live') >= 0;

let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (extra ? '   ' + extra : '')); } };

// ---- lift the real gate out of the shipped worker ----------------------------------------------------------
const src = fs.readFileSync('src/worker.js', 'utf8');
function fn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not in worker source: ' + name);
  let d = 0, end = -1;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { end = k; break; } }
  }
  return src.slice(i, end + 1);
}
function table(name) {
  const i = src.indexOf('const ' + name + ' = {');
  if (i < 0) throw new Error('table not in worker source: ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { j = k; break; } } }
  // eslint-disable-next-line no-new-func
  return new Function('return (' + src.slice(src.indexOf('{', i), j + 1) + ')')();
}

let body = [fn('_nyParts'), fn('_nextOpenAt'), fn('_clockAt'), fn('_nextOpenMsg'), fn('marketSession')].join('\n');
if (FALSIFY) {
  body = body
    .replace(/'Closed for the weekend\. It opens again '\s*\+ \(cls === 'forex' \? 'Sunday 17:00' : 'Sunday 18:00'\) \+ ' New York time\.'/,
      `'Closed for the weekend - reopens Sunday 17:00 New York time.'`)
    .replace(/return 'It opens again ' \+ ny\.day \+ ' ' \+ ny\.hm \+ ' New York time\.';/,
      `return 'Closed for the weekend - reopens Sunday 17:00 New York time.';`);
}
// eslint-disable-next-line no-new-func
const G = new Function('STOCKS', 'BYBIT_EQ', 'COMMOD', 'IDX_SYMS', 'FX_SYMS', 'SESS_EXCH_MAX',
  'function assetClassOf(sym){sym=String(sym||"").toUpperCase().replace(/[^A-Z0-9]/g,"").replace(/USDT$/,"");'
  + 'if(STOCKS[sym]||BYBIT_EQ[sym])return "stock";if(COMMOD[sym])return "metal";if(IDX_SYMS[sym])return "index";'
  + 'if(FX_SYMS[sym])return "forex";return "crypto";}\n' + body + '\nreturn { marketSession, assetClassOf };')(
  table('STOCKS'), table('BYBIT_EQ'), table('COMMOD'), table('IDX_SYMS'), table('FX_SYMS'),
  +(src.match(/const SESS_EXCH_MAX = (\d+) \* (\d+);/) || [0, 20, 3600]).slice(1).reduce((a, b) => a * b));

// ---- the sessions the live feed published, 2026-10-25 ------------------------------------------------------
const PD = {
  AAPL: { state: 'CLOSED', sess: { s: 1792762200, e: 1792785600, tz: 'America/New_York', gmt: -14400 } },
  SPX500: { sess: { s: 1792762200, e: 1792785600, tz: 'America/New_York', gmt: -14400 } },
  GER40: { sess: { s: 1792738800, e: 1792769400, tz: 'Europe/Berlin', gmt: 3600 } },   // Fri 08:00-16:30 Berlin
  BRENT: { sess: { s: 1792900800, e: 1792987140, tz: 'America/New_York', gmt: -14400 } }, // 24h
  XAU: {},
  EURUSD: { sess: { s: 1792710000, e: 1792796340, tz: 'Europe/London', gmt: 0 } },      // 24h
  BTC: {},
};
const nyStr = (ms) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false })
  .formatToParts(new Date(ms)).reduce((a, p) => (a[p.type] = p.value, a), {});

/* THE FIXTURE MUST MOVE THE WAY THE FEED MOVES, or the walk measures a frozen Friday rather than the gate.
   Yahoo publishes the session that is current or next: a real exchange window rolls to the next WEEKDAY, a
   24h futures or FX window rolls day by day, and a stock's `state` is REGULAR only inside its own window.
   Without this the suite's first run reported that AAPL never opens, which is a fact about the fixture. */
const DAY = 86400;
function pdAt(sym, now) {
  const base = PD[sym]; if (!base || !base.sess) return base || {};
  const w = base.sess, nowS = Math.floor(now / 1000), dur = +w.e - +w.s, short = dur <= 20 * 3600;
  let s = +w.s, e = +w.e, guard = 0;
  while (e <= nowS && guard++ < 20) {
    s += DAY; e += DAY;
    if (short) { // an exchange does not sit a weekend session
      let g2 = 0;
      while (g2++ < 8) { const d = new Date((s + (+w.gmt || 0)) * 1000).getUTCDay(); if (d !== 0 && d !== 6) break; s += DAY; e += DAY; }
    }
  }
  const out = { sess: { s, e, tz: w.tz, gmt: w.gmt } };
  if (Object.prototype.hasOwnProperty.call(base, 'state')) out.state = (nowS >= s && nowS <= e) ? 'REGULAR' : 'CLOSED';
  return out;
}

// Saturday 2026-10-24 12:00 New York -> walk forward 4 days a minute at a time
const START = Date.parse('2026-10-24T16:00:00Z');
const MIN = 60000, SPAN = 4 * 24 * 60;

function firstOpen(sym) {
  let lastMsg = '', satMsg = '';
  for (let i = 0; i < SPAN; i++) {
    const now = START + i * MIN;
    const r = G.marketSession(sym, pdAt(sym, now), now);
    if (r.open) return { at: now, msg: lastMsg, sat: satMsg };
    lastMsg = r.msg || '';
    if (!satMsg && nyStr(now).weekday === 'Saturday') satMsg = r.msg || '';
  }
  return null;
}

console.log('\n-- the shipped gate, walked a minute at a time from Saturday 12:00 New York');
console.log('   symbol   gate opens at                      the refusal one minute earlier');

// what each class is EXPECTED to open at, and it is a FACT about the venue, not about our code:
//   a New York listing   -> Monday 09:30 New York (the shares open)
//   a Frankfurt listing  -> Monday, Frankfurt's own open, which is 03:00 New York in this week
//   FX                   -> Sunday 17:00 New York (the currency week)
//   metals and energy    -> Sunday 18:00 New York (the pit, and our daily 17:00-18:00 break)
const WANT = {
  AAPL: { day: 'Monday', hm: '09:30' },
  SPX500: { day: 'Monday', hm: '09:30' },
  GER40: { day: 'Monday' },
  EURUSD: { day: 'Sunday', hm: '17:00' },
  BRENT: { day: 'Sunday', hm: '18:00' },
  XAU: { day: 'Sunday', hm: '18:00' },
};

for (const sym of Object.keys(WANT)) {
  const f = firstOpen(sym);
  if (!f) { ok(false, sym + ' opens at some point inside four days'); continue; }
  const n = nyStr(f.at), got = n.weekday + ' ' + (n.hour === '24' ? '00' : n.hour) + ':' + n.minute;
  console.log('   ' + sym.padEnd(9) + got.padEnd(35) + (f.msg || '(none)').slice(0, 96));

  const w = WANT[sym], hm = got.split(' ')[1];
  ok(n.weekday === w.day, sym + ': the gate really opens on ' + w.day, 'it opened ' + got);
  if (w.hm) ok(got === w.day + ' ' + w.hm, sym + ': to the minute, ' + w.day + ' ' + w.hm + ' New York', got);
  /* THE LOAD-BEARING ONE: the refusal a minute earlier must name that MINUTE in New York. It may be the
     weekend sentence ("Sunday 18:00 New York time") or the daily break's ("18:00 New York time today") -
     both are exact, which is the whole requirement; only a missing or wrong minute is a failure. */
  ok(f.msg.indexOf(hm) >= 0 && /New York time/.test(f.msg),
    sym + ': the refusal one minute earlier names ' + hm + ' New York', f.msg);
  // and the WEEKEND sentence - what a reader meets on a Saturday - must name the day as well as the minute
  ok(f.sat.indexOf(w.day) >= 0 && f.sat.indexOf(hm) >= 0 && /New York time/.test(f.sat),
    sym + ': the Saturday refusal names ' + w.day + ' ' + hm + ' New York', f.sat);
}

console.log('\n-- what a reader is told, class by class, the minute before it opens');
ok(/09:30 New York time/.test((firstOpen('AAPL') || {}).sat || ''), 'a stock names Monday 09:30 New York');
const g40 = (firstOpen('GER40') || {}).sat || '';
ok(/New York time \(\d\d:\d\d Berlin\)/.test(g40), 'a Frankfurt index leads with New York and names Berlin in brackets', g40);
ok(/Sunday 17:00 New York time/.test((firstOpen('EURUSD') || {}).sat || ''), 'a currency pair names Sunday 17:00 New York');
ok(/Sunday 18:00 New York time/.test((firstOpen('XAU') || {}).sat || ''), 'gold names Sunday 18:00 New York');
ok(/Sunday 18:00 New York time/.test((firstOpen('BRENT') || {}).sat || ''), 'crude names Sunday 18:00 New York');
ok(!G.marketSession('BTC', PD.BTC, START).open === false, 'crypto is open on a Saturday afternoon');

console.log('\n-- no refusal anywhere in the walk may be vague or name the wrong day');
let vague = 0, sundayNY = 0, seen = 0;
for (const sym of ['AAPL', 'SPX500', 'GER40', 'BRENT', 'XAU', 'EURUSD']) {
  for (let i = 0; i < SPAN; i += 7) {
    const r = G.marketSession(sym, pdAt(sym, START + i * MIN), START + i * MIN);
    if (r.open || !r.msg) continue;
    seen++;
    if (/evening|at some point|when the exchange reopens/i.test(r.msg)) vague++;
    // a NEW YORK listing may never be told it comes back on a Sunday - the owner's correction
    if ((sym === 'AAPL' || sym === 'SPX500') && /Sunday/.test(r.msg)) sundayNY++;
  }
}
ok(seen > 500, 'the walk really exercised the refusals', 'refusals seen: ' + seen);
ok(vague === 0, 'not one refusal is vague about when it opens', vague + ' vague');
ok(sundayNY === 0, 'a New York listing is never told it reopens on a Sunday', sundayNY + ' such');

console.log('\n-- the terminal carries the same two constants, so it cannot drift from the gate');
const home = fs.readFileSync('dist/assets/home.js', 'utf8');
ok(/mpNextGateOpen/.test(home), 'the terminal can compute our own gate\'s next open');
ok(/\(cls===.forex.\)\?17:18/.test(home.replace(/\s/g, '')), 'it uses 17 for forex and 18 for everything else');
ok(/America\/New_York/.test(home) && /newYorkTime/.test(home), 'it states New York time');

if (LIVE) {
  (async () => {
    console.log('\n-- what production answers a real open, right now');
    const KEY = (fs.readFileSync('ADMIN_KEY.local.txt', 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
    const AH = { 'x-admin-key': KEY, 'content-type': 'application/json' };
    const J = async (u, o) => { const r = await fetch('https://marginpad.io' + u, o); const t = await r.text(); try { return { s: r.status, j: JSON.parse(t) }; } catch (e) { return { s: r.status, t }; } };
    const uid = 'e2e-mx' + Math.random().toString(36).slice(2, 6);
    await J('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'mk' }) });
    const se = await J('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'sess' }) });
    const CK = { 'content-type': 'application/json', cookie: 'mp_sess=' + (se.j.token || se.j.sess) };
    try {
      for (const sym of ['AAPL', 'SPX500', 'GER40', 'JPN225', 'BRENT', 'XAU', 'EURUSD', 'BTC']) {
        const o = await J('/api/trade/open', { method: 'POST', headers: CK, body: JSON.stringify({ sym, side: 'long', lev: 5, margin: 10, cid: 'mx' + Math.random().toString(36).slice(2, 8) }) });
        const open = o.s === 200 && !(o.j && o.j.error);
        const msg = open ? 'OPEN' : String((o.j && (o.j.message || o.j.hint)) || o.s);
        console.log('     ' + sym.padEnd(8) + msg);
        if (!open) ok(/New York time/.test(msg) && !/evening/i.test(msg), sym + ': production names a New York minute', msg);
        if (open) { const id = (o.j.position && o.j.position.id) || o.j.id; if (id) await J('/api/trade/close', { method: 'POST', headers: CK, body: JSON.stringify({ id: String(id), pct: 100 }) }); }
      }
    } finally { await J('/api/admin/e2euser', { method: 'POST', headers: AH, body: JSON.stringify({ uid, op: 'rm' }) }); }
    done();
  })();
} else done();

function done() {
  console.log('\nmarket-open-exact-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
}
