// /trading-api/ led with prose and buried the two things a developer actually decides on.
//
// Measured before: the "Get your key" box sat at line 630, BELOW three quickstart steps, five code tabs and a
// paragraph about SDKs - roughly 1,900 words into the page - and the price table sat below a whole section
// arguing against exchange testnets. Both hero buttons pointed at anchors the reader had to scroll past
// everything to reach. Owner's call: the key box first and in the foreground, the quickstart directly under
// it, the prices directly under that, everything else after.
//
// Idempotent: run it twice and the second run reports nothing to do. Anchors #akb, #quickstart and #plans all
// survive - the worker's 402/429 hints, /premium/, the error table and this page's own scripts link into them.
const fs = require('fs');
const F = 'dist/trading-api/index.html';
const DRY = process.argv.indexOf('--dry') >= 0;

let h = fs.readFileSync(F, 'utf8');
const before = h;
// the file is CRLF; every multi-line marker below is built from its OWN ending, never a bare \n
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';

if (h.indexOf('id="getkey"') >= 0) { console.log('already reordered - nothing to do'); process.exit(0); }

function must(i, what) { if (i < 0) { console.error('REFUSING: ' + what + ' not found - the page changed shape'); process.exit(1); } return i; }

// -- 1. lift the key box out of the quickstart ------------------------------------------------------------
const KB_A = '    <div class="keybox" id="akb">';
const KB_END = 'anyone holding one can trade your paper account.</p>' + N + '      </div>' + N + '    </div>' + N;
const kbA = must(h.indexOf(KB_A), 'key box');
const kbE = must(h.indexOf(KB_END, kbA), 'key box end');
let keybox = h.slice(kbA, kbE + KB_END.length);
h = h.slice(0, kbA) + h.slice(kbE + KB_END.length);

// It is the first thing on the page now, so it carries the page's first h2 instead of an h3 buried in a
// section. Nothing in the key-manager script reads this heading (it queries ids only), so that script stays
// verbatim - it is the pre-redesign one and must not be retyped.
keybox = keybox.split('<h3>Get your key</h3>').join('<h2>Get your key</h2>');
keybox = keybox.split('<div class="keybox" id="akb">').join('<div class="keybox kb-lead" id="akb">');

// -- 2. cut the plans section whole ------------------------------------------------------------------------
const plA = must(h.indexOf('<!-- ── PLANS '), 'plans section');
const PL_TAIL = N + '</section>' + N;
const plE = must(h.indexOf(PL_TAIL, plA), 'plans section end');
const plans = h.slice(plA, plE + PL_TAIL.length);
h = h.slice(0, plA) + h.slice(plE + PL_TAIL.length);

// -- 3. put the key box between the status bar and the quickstart -----------------------------------------
const qs = must(h.indexOf('<!-- ── QUICKSTART '), 'quickstart marker');
const getkey = '<!-- GET A KEY -->' + N
  + '<section id="getkey">' + N + '  <div class="shell">' + N
  + keybox
  + '  </div>' + N + '</section>' + N + N;
h = h.slice(0, qs) + getkey + h.slice(qs);

// -- 4. and the prices directly under the quickstart ------------------------------------------------------
const why = must(h.indexOf('<!-- ── WHY '), 'why marker');
h = h.slice(0, why) + plans + N + h.slice(why);

// -- 5. the top nav should read in the order the page now runs --------------------------------------------
const NAV_A = '      <a href="#quickstart">Quickstart</a>' + N
  + '      <a href="#endpoints">Endpoints</a>' + N
  + '      <a href="#plans">Plans</a>' + N;
if (h.indexOf(NAV_A) >= 0) {
  h = h.split(NAV_A).join('      <a href="#akb">Get a key</a>' + N
    + '      <a href="#quickstart">Quickstart</a>' + N
    + '      <a href="#plans">Plans</a>' + N
    + '      <a href="#endpoints">Endpoints</a>' + N);
}

// -- 6. the lead key box is the first block on the page, so it is sized like one ---------------------------
const CSS_A = '  .keybox h3{font-size:21px;font-weight:700;}';
must(h.indexOf(CSS_A), 'keybox css');
h = h.split(CSS_A).join(CSS_A + N
  + '  .keybox h2{font-size:27px;font-weight:700;letter-spacing:-.01em;}' + N
  + '  .keybox.kb-lead{margin-top:0;padding:34px;border-color:rgba(194,246,74,.28);}' + N
  + '  #getkey{margin-top:34px;}' + N
  + '  @media(max-width:860px){.keybox h2{font-size:23px;}.keybox.kb-lead{padding:24px;}#getkey{margin-top:24px;}}');

if (h === before) { console.log('no change'); process.exit(0); }
if (DRY) { console.log('would reorder: key box -> quickstart -> plans (dry run)'); process.exit(0); }

// sanity: nothing lost, nothing duplicated, and the order really is the order
for (const s of ['id="akb"', 'id="plans"', 'id="quickstart"', 'id="getkey"', 'id="akbTable"']) {
  const n = h.split(s).length - 1;
  if (n !== 1) { console.error('REFUSING: ' + s + ' appears ' + n + ' times'); process.exit(1); }
}
const ord = ['id="getkey"', 'id="quickstart"', 'id="plans"', 'id="why"', 'id="endpoints"'].map(function (s) { return h.indexOf(s); });
for (let i = 1; i < ord.length; i++) {
  if (!(ord[i] > ord[i - 1])) { console.error('REFUSING: sections are out of order'); process.exit(1); }
}

fs.writeFileSync(F + '.tmp', Buffer.from(h, 'utf8'));
fs.renameSync(F + '.tmp', F);
console.log('reordered: get your key -> quickstart -> plans -> why -> reference');
