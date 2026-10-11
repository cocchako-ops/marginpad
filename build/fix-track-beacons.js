/* EVERY ONE OF THESE BEACONS HAS BEEN RECORDING NOTHING (2026-10-11, found while answering the owner's "mozemo da
   poboljsamo merenje, logove i da mi izlaze tamo da vidim sta je ko kliknuo").

   `handleTrack` reads the event type from the **t** parameter and the label from **e**:
       const type = (p.get('t') || 'event')...
       let label  = (p.get('e') || '')...
   Fifty call sites across the site send `?t=event&type=sect&l=<thing>` instead. The worker therefore records the
   type as the literal string "event" and the label as EMPTY - the `type` and `l` parameters are read by nothing.

   What that cost, measured: the homepage section-view beacon is the instrument CLAUDE.md says the next cut of the
   homepage will be decided from ("the next cut is decided from AE `sect` counts, never by eye") - 28 call sites,
   and not one of them has ever recorded WHICH section. Same for the Academy, the whale-page filters, the
   liquidation coin sheet, the nav rows and the Premium indicators sheet, which was the only thing /premium/
   measured at all.

   This rewrites the shape to the one the worker reads. It does not change which types reach the live activity
   ring: that is a separate whitelist in handleTrack, and `sect` is deliberately NOT on it - a scroll is for
   counting in Analytics Engine, not for the feed the owner reads every morning.

   node build/fix-track-beacons.js         rewrites dist/ and app/ in place (idempotent)
   node build/fix-track-beacons.js --dry   lists what it would change
*/
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');
const ROOTS = ['dist', 'app', 'build'];
const SKIP = /node_modules|[\\/](assets[\\/]sdk|vault-shots|ops-shots|data)[\\/]/;

// ?t=event&type=X&l=   ->   ?t=X&e=        (and the same without a label)
const RE_L = /t=event&type=([a-z0-9_]+)&l=/g;
const RE_P = /t=event&type=([a-z0-9_]+)(?![a-z0-9_=])/g;

function walk(dir, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (SKIP.test(p)) continue;
    if (f.isDirectory()) walk(p, out);
    else if (/\.(html|js)$/.test(f.name)) out.push(p);
  }
  return out;
}

let files = 0, hits = 0;
const byType = {};
for (const r of ROOTS) {
  const base = path.join(ROOT, r);
  if (!fs.existsSync(base)) continue;
  for (const f of walk(base, [])) {
    const s = fs.readFileSync(f, 'utf8');
    if (/^fix-(track-beacons|premium-track)\.js$/.test(path.basename(f))) continue; // its own documentation contains the shape it hunts
    if (s.indexOf('t=event&type=') < 0) continue;
    let n = 0;
    let out = s.replace(RE_L, (m, t) => { n++; byType[t] = (byType[t] || 0) + 1; return 't=' + t + '&e='; });
    out = out.replace(RE_P, (m, t) => { n++; byType[t] = (byType[t] || 0) + 1; return 't=' + t; });
    if (!n || out === s) continue;
    files++; hits += n;
    console.log('  ' + path.relative(ROOT, f).replace(/\\/g, '/') + '  x' + n);
    if (!DRY) { const tmp = f + '.tmp'; fs.writeFileSync(tmp, out); fs.renameSync(tmp, f); }
  }
}
console.log((DRY ? 'would fix ' : 'fixed ') + hits + ' beacon(s) in ' + files + ' file(s): '
  + Object.keys(byType).sort().map(k => k + ' x' + byType[k]).join(', '));
if (!hits) console.log('nothing to do - every beacon already sends t=<type>&e=<label>');
