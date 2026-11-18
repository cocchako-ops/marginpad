// 2026-11-18 (owner: "ne bitno da kanal spamuje, vec da se salju sigurni trejdovi"): the liquidation flush as a TRADE.
// Causal detector (trailing 14d percentiles), entry at the next 5m open, real stop/target/time-stop, 0.11% fee,
// split by period half and by coin group, random-entry control. Data: liq90.json (fetch-liq90.js).
const D = JSON.parse(require('fs').readFileSync(__dirname + '/liq90.json', 'utf8'));
const CHAN = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'HYPE', 'ZEC', 'TRX', 'HBAR'];
const FEE = 0.0011, W14 = 14 * 288;
const pctl = (a, p) => { if (a.length < 80) return Infinity; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const events = [];
const prep = {};
for (const [c, d] of Object.entries(D)) {
  const k = d.k5; if (!k.length) continue;
  const L = new Map(d.liq.map(b => [Math.floor(b.t / 1000), b]));
  const lo = k.map(b => L.get(b.time) ? L.get(b.time).long : 0), sh = k.map(b => L.get(b.time) ? L.get(b.time).short : 0);
  // hourly range proxy: mean over the prior 14h of the 12-bar high-low range
  const hr = []; for (let i = 0; i < k.length; i++) { if (i < 12) { hr.push(null); continue; } let H = -Infinity, Lw = Infinity; for (let j = i - 11; j <= i; j++) { H = Math.max(H, k[j].high); Lw = Math.min(Lw, k[j].low); } hr.push(H - Lw); }
  const hATR = []; for (let i = 0; i < k.length; i++) { if (i < 12 * 15) { hATR.push(null); continue; } let s = 0, n = 0; for (let j = i - 12 * 14; j <= i; j += 12) if (hr[j] != null) { s += hr[j]; n++; } hATR.push(n ? s / n : null); }
  const oiT = d.oi; const oiAt = (ms) => { let v = null; for (let i = oiT.length - 1; i >= 0; i--) if (oiT[i][0] <= ms) { v = oiT[i][1]; break; } return v; };
  prep[c] = { k, lo, sh, hATR, oiAt };
  let p99 = Infinity, p95 = Infinity, s99 = Infinity, last = -1e9;
  for (let i = 300; i < k.length - 1; i++) {
    if (i % 12 === 0) { const win = []; const ws = []; for (let j = Math.max(0, i - W14); j < i; j++) { if (lo[j] > 0) win.push(lo[j]); if (sh[j] > 0) ws.push(sh[j]); } p99 = pctl(win, 0.99); p95 = pctl(win, 0.95); s99 = pctl(ws, 0.99); }
    const b = k[i]; if (hATR[i] == null) continue;
    let minLow = Infinity; for (let j = i - 288; j < i; j++) minLow = Math.min(minLow, k[j].low);
    const cascade = lo[i] >= p99 && lo[i] > 2 * sh[i];
    const sweep = b.low < minLow && lo[i] >= p95 && b.close >= (b.high + b.low) / 2;
    const scas = sh[i] >= s99 && sh[i] > 2 * lo[i];
    if ((cascade || sweep || scas) && i - last >= 12) {
      last = i;
      const o0 = oiAt(b.time * 1000), o4 = oiAt(b.time * 1000 - 4 * 3600e3);
      events.push({ c, i, t: b.time, kind: scas ? 'short_cascade' : cascade && sweep ? 'both' : cascade ? 'cascade' : 'sweep', long: !scas, usd: scas ? sh[i] : lo[i], oiChg: o0 && o4 ? (o0 / o4 - 1) * 100 : null });
    }
  }
}
// market-wide: BTC/ETH flushing in the same hour
const hourKey = (t) => Math.floor(t / 3600);
const majorsHr = new Set(events.filter(e => (e.c === 'BTC' || e.c === 'ETH') && e.long).map(e => hourKey(e.t)));
events.forEach(e => { e.mkt = majorsHr.has(hourKey(e.t)); });
// run one trade
function trade(e, cfg) {
  const { k, hATR } = prep[e.c]; const i = e.i, ent = k[i + 1].open, dir = e.long ? 1 : -1;
  const ev = k[i]; let stop;
  if (cfg.stop === 'low') stop = e.long ? ev.low * 0.999 : ev.high * 1.001; else stop = ent - dir * cfg.stop * hATR[i];
  const risk = Math.abs(ent - stop); if (!(risk > 0) || risk / ent > 0.08) return null;
  const tgt = ent + dir * cfg.tp * risk, tEnd = i + 1 + cfg.hold * 12;
  let R = null, tag = 'time';
  for (let j = i + 1; j < Math.min(k.length, tEnd); j++) {
    const b = k[j];
    if (e.long ? b.low <= stop : b.high >= stop) { R = -1; tag = 'stop'; break; }
    if (e.long ? b.high >= tgt : b.low <= tgt) { R = cfg.tp; tag = 'tp'; break; }
  }
  if (R == null) { const last = k[Math.min(k.length - 1, tEnd - 1)]; R = (last.close - ent) * dir / risk; }
  return { R: R - FEE * ent / risk, tag, slPct: risk / ent * 100 };
}
function stat(list, cfg) {
  const rs = list.map(e => trade(e, cfg)).filter(Boolean); const R = rs.map(x => x.R), s = R.reduce((a, b) => a + b, 0), w = R.filter(x => x > 0).length;
  const gw = R.filter(x => x > 0).reduce((a, b) => a + b, 0), gl = -R.filter(x => x < 0).reduce((a, b) => a + b, 0);
  return { n: R.length, wr: R.length ? w / R.length : 0, avg: R.length ? s / R.length : 0, pf: gl ? gw / gl : 0, sum: s };
}
const fmt = (s) => 'n' + String(s.n).padStart(4) + ' WR ' + String(Math.round(s.wr * 100)).padStart(3) + '% R ' + (s.avg >= 0 ? '+' : '') + s.avg.toFixed(2) + ' PF ' + s.pf.toFixed(2);
const T0 = Math.min(...events.map(e => e.t)), MID = T0 + 45 * 86400;
const row = (lab, list, cfg) => console.log(lab.padEnd(44) + '| ALL ' + fmt(stat(list, cfg)) + ' | 1st half ' + fmt(stat(list.filter(e => e.t < MID), cfg)) + ' | 2nd half ' + fmt(stat(list.filter(e => e.t >= MID), cfg)) + ' | channel coins ' + fmt(stat(list.filter(e => CHAN.includes(e.c)), cfg)) + ' | other coins ' + fmt(stat(list.filter(e => !CHAN.includes(e.c)), cfg)));
const L = events.filter(e => e.long), S = events.filter(e => !e.long);
console.log('events: long flushes', L.length, '(cascade ' + L.filter(e => e.kind === 'cascade').length + ', sweep ' + L.filter(e => e.kind === 'sweep').length + ', both ' + L.filter(e => e.kind === 'both').length + ') | short cascades', S.length, '| from', new Date(T0 * 1000).toISOString().slice(0, 10));
console.log('\n=== exit geometry, every long flush ===');
for (const stop of ['low', 1, 1.5]) for (const tp of [1, 1.5, 2]) for (const hold of [4, 12]) row('stop ' + stop + ' tp ' + tp + 'R hold ' + hold + 'h', L, { stop, tp, hold });
const B = { stop: 1, tp: 1.5, hold: 4 };
console.log('\n=== filters (stop 1 hourly ATR, target 1.5R, 4h) ===');
row('every long flush', L, B);
row('cascade only', L.filter(e => e.kind !== 'sweep'), B);
row('sweep (incl. both)', L.filter(e => e.kind !== 'cascade'), B);
row('both cascade AND sweep', L.filter(e => e.kind === 'both'), B);
row('OI fell >1% in 4h', L.filter(e => e.oiChg != null && e.oiChg < -1), B);
row('OI fell >2% in 4h', L.filter(e => e.oiChg != null && e.oiChg < -2), B);
row('OI rose', L.filter(e => e.oiChg != null && e.oiChg >= 0), B);
row('BTC or ETH flushed the same hour', L.filter(e => e.mkt), B);
row('alone (no BTC/ETH flush)', L.filter(e => !e.mkt), B);
row('weekday', L.filter(e => { const d = new Date(e.t * 1000).getUTCDay(); return d !== 0 && d !== 6; }), B);
row('market flush AND OI fell >1%', L.filter(e => e.mkt && e.oiChg != null && e.oiChg < -1), B);
console.log('\n=== short side mirror (shorts liquidated -> short) ===');
row('short cascade, stop 1 ATR tp 1.5R 4h', S, B);
console.log('\n=== random control: long entries on random 5m bars, same coins, same exits ===');
const rnd = []; for (const c of Object.keys(prep)) { const n = prep[c].k.length; for (let r = 0; r < 300; r++) { const i = 300 + Math.floor(Math.random() * (n - 400)); if (prep[c].hATR[i]) rnd.push({ c, i, t: prep[c].k[i].time, long: true }); } }
row('random longs', rnd, B);
require('fs').writeFileSync(__dirname + '/flush-events.json', JSON.stringify(events));
