// Owner, 2026-09-19: the prices go directly under "Get your key", not under the quickstart.
//
// So the page reads key -> prices -> quickstart: what it costs is answered the moment the reader has the key
// in front of them, and the code follows for whoever is still reading. This supersedes the first arrangement
// (key -> quickstart -> prices) from earlier the same day.
//
// Idempotent, and it refuses rather than guesses if the page has changed shape.
const fs = require('fs');
const F = 'dist/trading-api/index.html';
const DRY = process.argv.indexOf('--dry') >= 0;

let h = fs.readFileSync(F, 'utf8');
const before = h;
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';

function must(i, what) { if (i < 0) { console.error('REFUSING: ' + what + ' not found'); process.exit(1); } return i; }

const gk = must(h.indexOf('<section id="getkey">'), 'get-key section');
const qs = must(h.indexOf('<!-- ── QUICKSTART '), 'quickstart marker');
const pl = must(h.indexOf('<!-- ── PLANS '), 'plans section');
if (pl < qs) { console.log('prices already sit above the quickstart - nothing to do'); process.exit(0); }
if (!(gk < qs)) { console.error('REFUSING: the key box is not above the quickstart any more'); process.exit(1); }

// cut the plans section whole
const PL_TAIL = N + '</section>' + N;
const plE = must(h.indexOf(PL_TAIL, pl), 'plans section end');
const plans = h.slice(pl, plE + PL_TAIL.length);
h = h.slice(0, pl) + h.slice(plE + PL_TAIL.length);

// and drop it in front of the quickstart, i.e. straight under the key box
const qs2 = must(h.indexOf('<!-- ── QUICKSTART '), 'quickstart marker (after the cut)');
h = h.slice(0, qs2) + plans + N + h.slice(qs2);

if (h === before) { console.log('no change'); process.exit(0); }
if (DRY) { console.log('would put the prices directly under the key box (dry run)'); process.exit(0); }

for (const s of ['id="akb"', 'id="plans"', 'id="quickstart"', 'id="getkey"', 'class="proof"']) {
  const n = h.split(s).length - 1;
  if (n !== 1) { console.error('REFUSING: ' + s + ' appears ' + n + ' times'); process.exit(1); }
}
const body = h.slice(h.indexOf('<body'));
const o = (body.match(/<div\b/g) || []).length, c = (body.match(/<\/div>/g) || []).length;
if (o !== c) { console.error('REFUSING: div tags unbalanced ' + o + '/' + c); process.exit(1); }
const so = (body.match(/<section\b/g) || []).length, sc = (body.match(/<\/section>/g) || []).length;
if (so !== sc) { console.error('REFUSING: section tags unbalanced ' + so + '/' + sc); process.exit(1); }
const ord = ['id="getkey"', 'id="plans"', 'id="quickstart"', 'class="proof"', 'id="why"'].map(function (s) { return h.indexOf(s); });
for (let i = 1; i < ord.length; i++) {
  if (!(ord[i] > ord[i - 1])) { console.error('REFUSING: sections are out of order'); process.exit(1); }
}

fs.writeFileSync(F + '.tmp', Buffer.from(h, 'utf8'));
fs.renameSync(F + '.tmp', F);
console.log('order is now: get your key -> plans -> quickstart -> proof -> why -> reference');
