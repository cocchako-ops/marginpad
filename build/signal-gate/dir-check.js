const D = JSON.parse(require('fs').readFileSync(__dirname + '/liq90.json', 'utf8')); const E = JSON.parse(require('fs').readFileSync(__dirname + '/flush-events.json', 'utf8'));
const k = {}; for (const [c, d] of Object.entries(D)) k[c] = d.k5;
const fwd = (c, i, h) => { const a = k[c]; if (i + 1 + h >= a.length) return null; return a[i + 1 + h].close / a[i + 1].open - 1; };
const T0 = Math.min(...E.map(e => e.t)), MID = T0 + 45 * 86400;
function line(lab, L, long) { for (const h of [12, 48]) { const f = L.map(e => fwd(e.c, e.i, h)).filter(x => x != null); const up = f.filter(x => (long ? x : -x) > 0).length; const m = f.reduce((a, b) => a + b, 0) / f.length * (long ? 1 : -1) * 100; console.log(lab.padEnd(30), '+' + (h / 12) + 'h', 'n', f.length, 'favourable', (up / f.length * 100).toFixed(1) + '%', 'mean move', m.toFixed(3) + '%'); } }
const L = E.filter(e => e.long); line('long flush, all', L, true); line('long flush, 1st half', L.filter(e => e.t < MID), true); line('long flush, 2nd half', L.filter(e => e.t >= MID), true);
const rnd = []; for (const c of Object.keys(k)) for (let r = 0; r < 400; r++) rnd.push({ c, i: 300 + Math.floor(Math.random() * (k[c].length - 400)) }); line('random bars (up share)', rnd, true);
line('short cascade -> short', E.filter(e => !e.long), false);
