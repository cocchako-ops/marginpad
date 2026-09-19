// DEMO SPOT OPENS WITH A DASHBOARD FOR A PORTFOLIO THAT DOES NOT EXIST YET (2026-09-19).
//
// MEASURED on 155 real accounts (test uids dropped) from /api/admin/spot:
//   - onboarding step reached: 8 at 0, 12 at 1, 19 at 2, 21 at 3, 95 finished  -> 39% never finish
//   - 126 of 155 (81%) used it in ONE session under an hour; only 26 ever came back after day one
//   - 43 ever held anything, 32 ever moved money to their own wallet, 14 ever bought a meme
//   - 69 accounts flagged stuck
// And the first screen after the $10,000 lands is: an equity chart reading "draws after your first full
// day", an allocation donut with ONE slice ("Card 100%"), a season board showing a stranger's +$12.01, and
// an empty paper trail. Four of six panels carry nothing, while STEP 1 OF 6 - the only thing that matters
// on day one - is a one-line strip between them.
//
// So: while the six-step journey is unfinished the dashboard folds away and the step IS the page, with one
// line saying what appears as they go and what tomorrow adds. Nothing is deleted; it comes back the moment
// it has something in it. Independently, the allocation donut hides while it has a single slice, which is a
// pie chart carrying no information whatever day it is.
//
// Idempotent, refuses rather than guesses. `node build/fix-spot-dayone.js [--dry]`
const fs = require('fs');
const F = 'dist/spot/index.html';
const DRY = process.argv.indexOf('--dry') >= 0;
let h = fs.readFileSync(F, 'utf8');
const before = h;
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
if (h.indexOf('spot-new') >= 0) { console.log('already applied'); process.exit(0); }

function must(i, what) { if (i < 0) { console.error('REFUSING: ' + what + ' not found'); process.exit(1); } return i; }

// ── 1. the class, set from the one place that already knows whether the journey is done ──────────────────
const A1 = '    var nextIdx=-1;steps.forEach(function(st,i){if(nextIdx<0&&!st.done)nextIdx=i;});';
must(h.indexOf(A1), 'renderMap nextIdx');
h = h.split(A1).join(A1 + N
  + '    /* DAY ONE IS THE JOURNEY, NOT A DASHBOARD (2026-09-19). Measured: 39% of real accounts never finish' + N
  + '       these six steps and 81% never come back after the first session, while the screen under this line' + N
  + '       shows an empty equity chart, a one-slice donut, a stranger on a board and an empty paper trail. */' + N
  + '    try{document.body.classList.toggle("spot-new",nextIdx>=0);}catch(e){}');

// ── 2. the line that replaces the folded dashboard ───────────────────────────────────────────────────────
const A2 = '      <div class="ovr">';
must(h.indexOf(A2), 'overview block');
h = h.split(A2).join('      <div class="newnote" id="newNote" data-th="h_newnote"><b>Your dashboard fills itself in.</b> The equity line draws after your first full day, the allocation ring once your money is in more than one place, and every card purchase, trade, transfer and swap prints a line in the paper trail. Finish the six steps and all of it is here waiting.</div>' + N + A2);

// ── 3. the CSS: fold the dashboard, promote the step ─────────────────────────────────────────────────────
const A3 = '.coach{flex-wrap:wrap;}';
must(h.indexOf(A3), 'coach css');
h = h.split(A3).join(A3 + N
  + '  /* while the six steps are unfinished the step IS the page: the dashboard panels have nothing in them yet */' + N
  + '  .newnote{display:none;margin-top:14px;padding:13px 15px;border:1px solid #1e2531;border-radius:13px;background:#0e1117;color:#8b95a3;font-size:12.5px;line-height:1.65;}' + N
  + '  .newnote b{color:#e9e7df;}' + N
  + '  body.spot-new .ovr,body.spot-new .trail,body.spot-new #noteBox{display:none;}' + N
  + '  body.spot-new .newnote{display:block;}' + N
  + '  body.spot-new .coach{margin-top:16px;padding:16px 17px;border:1px solid rgba(194,246,74,.30);border-radius:14px;background:linear-gradient(180deg,rgba(194,246,74,.07),rgba(194,246,74,0) 70%),#0e1117;color:#c7d2e0;font-size:13.5px;align-items:flex-start;}' + N
  + '  body.spot-new .coach .cnum{align-self:flex-start;}' + N
  + '  body.spot-new .coach b{color:#fff;font-size:15px;display:block;margin-bottom:3px;}' + N
  + '  body.spot-new .coach .go2{margin-left:auto;padding:11px 18px;font-size:13.5px;}' + N
  + '  @media(max-width:620px){body.spot-new .coach{padding:14px;}body.spot-new .coach .go2{margin-left:0;width:100%;justify-content:center;}}');

// ── 4. a one-slice donut is a pie chart with no information in it, on any day ────────────────────────────
const A4 = "    parts=parts.filter(function(p){return p.v>0.01;}).sort(function(a,b){return b.v-a.v;}).slice(0,9);";
must(h.indexOf(A4), 'donut parts');
h = h.split(A4).join(A4 + N
  + '    /* one slice is not an allocation - hide the whole panel until the money is in more than one place */' + N
  + '    try{var ap=$("allocPanel");if(ap)ap.hidden=parts.length<2;}catch(e){}');

if (h === before) { console.log('no change'); process.exit(0); }
// sanity
const b = h.slice(h.indexOf('<body'));
const o = (b.match(/<div\b/g) || []).length, c = (b.match(/<\/div>/g) || []).length;
if (o !== c) { console.error('REFUSING: div tags unbalanced ' + o + '/' + c); process.exit(1); }
if ((h.match(/id="newNote"/g) || []).length !== 1) { console.error('REFUSING: newNote not unique'); process.exit(1); }
if (DRY) { console.log('(dry run) would fold the dashboard until the journey is done'); process.exit(0); }

fs.writeFileSync(F + '.tmp', Buffer.from(h, 'utf8'));
fs.renameSync(F + '.tmp', F);
console.log('day one is the journey now; the dashboard returns when it has something in it');
