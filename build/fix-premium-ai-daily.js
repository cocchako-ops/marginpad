// ONE ASK-AI READ A DAY COMES WITH ORDINARY PREMIUM (2026-09-19, owner order).
//
// Ask AI was Plus-only because it is the only feature with a real per-call cost - measured, a member on the
// 50-a-day cap runs to about $66 a month. One read a day is ~$0.018 of model spend against an $11.99
// subscription, so it costs nothing and turns the feature from a wall into a trial that runs every day.
//
// The page said the opposite in nine places, including its meta description, both social cards and a
// JSON-LD offer - an assistant quoting us would have told a reader Premium has no AI at all. Every one of
// them moves together or the site contradicts itself.
//
// Idempotent; refuses rather than guesses. `node build/fix-premium-ai-daily.js [--dry]`
const fs = require('fs');
const DRY = process.argv.indexOf('--dry') >= 0;
let touched = 0;

function patch(file, pairs, opt) {
  if (!fs.existsSync(file)) { if (!opt || !opt.optional) { console.error('REFUSING: missing ' + file); process.exit(1); } return; }
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  for (const [a, b] of pairs) {
    if (s.indexOf(a) < 0) {
      if (s.indexOf(b) >= 0) continue;                       // already applied
      if (opt && opt.soft) { console.log('  skip (not found): ' + a.slice(0, 60)); continue; }
      console.error('REFUSING: anchor not found in ' + file + '\n  ' + a.slice(0, 100)); process.exit(1);
    }
    s = s.split(a).join(b);
  }
  if (s === before) return;
  touched++;
  console.log('  ' + file);
  if (DRY) return;
  fs.writeFileSync(file + '.tmp', Buffer.from(s, 'utf8'));
  fs.renameSync(file + '.tmp', file);
}

// ── /premium/ ────────────────────────────────────────────────────────────────────────────────────────────
const P = 'dist/premium/index.html';
patch(P, [
  ['$11.99/month. Premium Plus adds Ask AI on your charts for $159/month - pay with crypto.',
   '$11.99/month, and it now includes one Ask AI read on your charts every day. Premium Plus raises that to 50 a day for $159/month - pay with crypto.'],
  ['$11.99/mo. Premium Plus adds Ask AI for $159/mo - pay with crypto.',
   '$11.99/mo, with one Ask AI read a day. Premium Plus raises it to 50 a day for $159/mo - pay with crypto.'],
  ['"description": "Everything in Premium plus Ask AI on the charts - 50 questions a day."',
   '"description": "Everything in Premium, with Ask AI on the charts raised from one read a day to 50."'],
  ['Premium Plus adds Ask AI on your charts - the one thing Premium does not include, because it is the one thing that costs us money every time you use it.',
   'Premium now includes <b>one Ask AI read on your charts every day</b>. It is the one feature that costs us money every time it runs, so Premium Plus is what raises it to 50 a day.'],
  ['Ask AI on your charts - 50 questions a day</li>',
   'Ask AI on your charts - <b>50 reads a day</b>, against one on Premium</li>'],
  // the Premium column never listed the feature at all, which is the whole point of this change
  ['Instant access after payment</li>',
   'Instant access after payment</li>\n          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><b>One Ask AI read a day</b> on any chart</li>'],
]);

// ── the AI layer: an assistant quotes these files verbatim ───────────────────────────────────────────────
for (const L of ['dist/llms.txt', 'dist/llms-full.txt']) {
  patch(L, [
    ['Ask AI on charts is Premium Plus only', 'Ask AI on charts: one read a day on Premium, 50 a day on Premium Plus'],
    ['Ask-AI on charts is Premium Plus only', 'Ask-AI on charts: one read a day on Premium, 50 a day on Premium Plus'],
  ], { soft: true });
}

if (DRY) { console.log('(dry run) files that would change: ' + touched); process.exit(0); }
console.log('files changed: ' + touched);
