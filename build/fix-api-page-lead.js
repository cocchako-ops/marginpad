// The key box was in the right ORDER and still 2.16 screens down a phone.
//
// Measured after the reorder: hero 1,007px + proof strip 480px + status bar 162px stood between the headline
// and "Get your key" (1,823px on a 390px screen, 984px on a desktop). Order alone does not put something in
// the foreground - what sits above it does. So the key box moves directly under the hero, and the proof strip
// and the status bar move BELOW the prices, where they read as evidence for the thing just asked for rather
// than as a delay before the ask. The sequence the owner asked for is untouched: key, quickstart, prices.
//
// Idempotent, and it refuses rather than guesses if the page has changed shape.
const fs = require('fs');
const F = 'dist/trading-api/index.html';
const DRY = process.argv.indexOf('--dry') >= 0;

let h = fs.readFileSync(F, 'utf8');
const before = h;
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';

if (h.indexOf('<!-- PROOF MOVED BELOW THE PRICES -->') >= 0) { console.log('already done - nothing to do'); process.exit(0); }
if (h.indexOf('id="getkey"') < 0) { console.error('run fix-api-page-order.js first'); process.exit(1); }

function must(i, what) { if (i < 0) { console.error('REFUSING: ' + what + ' not found'); process.exit(1); } return i; }

// -- cut the proof strip out of the hero shell -------------------------------------------------------------
const pA = must(h.indexOf('<!-- ── PROOF '), 'proof strip');
const P_TAIL = '</div>' + N + '</div>' + N;            // closes .proof, then the hero .shell
const pE = must(h.indexOf(P_TAIL, pA), 'proof strip end');
const proof = h.slice(pA, pE + '</div>'.length + N.length);   // the strip only - leave the shell's own close
h = h.slice(0, pA) + h.slice(pA + proof.length);

// -- cut the status bar shell --------------------------------------------------------------------------
const sA = must(h.indexOf('<div class="shell">' + N + '  <a class="statusbar"'), 'status bar');
const S_TAIL = '</a>' + N + '</div>' + N;
const sE = must(h.indexOf(S_TAIL, sA), 'status bar end');
const status = h.slice(sA, sE + S_TAIL.length);
h = h.slice(0, sA) + h.slice(sE + S_TAIL.length);

// -- put both under the prices --------------------------------------------------------------------------
const why = must(h.indexOf('<!-- ── WHY '), 'why marker');
const block = '<!-- PROOF MOVED BELOW THE PRICES -->' + N
  + '<div class="shell">' + N + proof + '</div>' + N + N
  + status + N;
h = h.slice(0, why) + block + h.slice(why);

if (h === before) { console.log('no change'); process.exit(0); }
if (DRY) { console.log('would lift the key box under the hero (dry run)'); process.exit(0); }

for (const s of ['class="proof"', 'class="statusbar"', 'id="akb"', 'id="plans"']) {
  const n = h.split(s).length - 1;
  if (n !== 1) { console.error('REFUSING: ' + s + ' appears ' + n + ' times'); process.exit(1); }
}
const body = h.slice(h.indexOf('<body'));
const o = (body.match(/<div\b/g) || []).length, c = (body.match(/<\/div>/g) || []).length;
if (o !== c) { console.error('REFUSING: div tags unbalanced ' + o + '/' + c); process.exit(1); }
const ord = ['id="getkey"', 'id="quickstart"', 'id="plans"', 'class="proof"', 'id="why"'].map(function (s) { return h.indexOf(s); });
for (let i = 1; i < ord.length; i++) {
  if (!(ord[i] > ord[i - 1])) { console.error('REFUSING: sections are out of order'); process.exit(1); }
}

fs.writeFileSync(F + '.tmp', Buffer.from(h, 'utf8'));
fs.renameSync(F + '.tmp', F);
console.log('key box lifted under the hero; proof strip and status bar now sit under the prices');
