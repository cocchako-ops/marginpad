// /premium/ owner, 2026-09-19: "ovaj tekst je katastrofa namesten na stranici, bas je razbacan."
//
// It was not a styling opinion, it was broken markup. Measured per section: the PRICING section leaves one
// <div> OPEN (its own .wrap is never closed) and #plus carries one extra </div> with no opener - two halves of
// the same bad edit. The browser recovers by closing the wrap at </section>, so #plus renders with NO container
// at all: its h2 and both notes run the full 1440px from the very edge of the viewport while the .lead inside
// it is max-width:620px;margin:0 auto - a centred paragraph floating between two edge-to-edge ones. Every other
// section on this page is <section><div class="wrap">...</div></section>.
//
// Also fixed here, all text problems the owner listed:
//  - the disclaimer appeared TWICE, and the first copy sat ABOVE the images it refers to, where it says
//    "A real reading of a real chart, captured on a phone. One example is an example" - singular, and a phone,
//    both left over from an earlier version, above a grid of four desktop captures.
//  - #aishow was the one left-aligned block on a centred page (h3 full width, .ai-lead 74ch hard against the
//    left edge), which is the other half of what reads as "scattered".
const fs = require('fs');
const F = 'dist/premium/index.html';
const DRY = process.argv.indexOf('--dry') >= 0;

let h = fs.readFileSync(F, 'utf8');
const before = h;

function bal(html) {
  const b = html.slice(html.indexOf('<body'));
  const parts = b.split(/<section\b/);
  return parts.slice(1).map(p => {
    const seg = p.slice(0, p.indexOf('</section>'));
    return (seg.match(/<div\b/g) || []).length - (seg.match(/<\/div>/g) || []).length;
  });
}
console.log('per-section div balance before: ' + JSON.stringify(bal(h)));

// -- 1. close the pricing section's own wrap --------------------------------------------------------------
const PN = '    <div class="pnote">Prices in USD, paid in crypto via NOWPayments. Educational paper-trading tools - not financial advice.</div>';
const A1 = PN + '\n</section>';
if (h.indexOf(A1) >= 0) {
  h = h.split(A1).join(PN + '\n  </div>\n</section>');
} else if (h.indexOf(PN + '\n  </div>') < 0) {
  console.error('REFUSING: could not find the unclosed pricing wrap'); process.exit(1);
}

// -- 2. give #plus the container every other section has --------------------------------------------------
const A2 = '<section id="plus">\n  <span class="tag">';
if (h.indexOf(A2) >= 0) h = h.split(A2).join('<section id="plus">\n  <div class="wrap">\n  <span class="tag">');
else if (h.indexOf('<section id="plus">\n  <div class="wrap">') < 0) { console.error('REFUSING: #plus opening not found'); process.exit(1); }

// -- 3. one disclaimer, under the images, saying what is actually there -----------------------------------
const A3 = '    <p class="pnote">A real reading of a real chart, captured on a phone. One example is an example, not a track record - the AI is a research tool and it will be wrong sometimes. Nothing here is financial advice.</p>\n  \n  \n';
if (h.indexOf(A3) >= 0) h = h.split(A3).join('\n');
const A4 = '<p class="pnote">Screenshots from the live product. Individual setups, not a track record - Ask AI is a research tool and it will be wrong plenty of times. Nothing here is financial advice.</p>';
if (h.indexOf(A4) >= 0) {
  h = h.split(A4).join('<p class="pnote">Captured from the live product, untouched. Individual reads, not a track record - Ask AI is a research tool and it will be wrong plenty of times. Nothing here is financial advice.</p>');
}

// -- 4. #aishow follows the page's centred language -------------------------------------------------------
const A5 = '.ai-lead{margin:0 0 20px;max-width:74ch;color:#c7d2e0;line-height:1.6}';
if (h.indexOf(A5) >= 0) {
  h = h.split(A5).join('.ai-lead{margin:0 auto 22px;max-width:70ch;color:#c7d2e0;line-height:1.6;text-align:center}');
}
const A6 = '#aishow h3{margin:0 0 8px;font-size:clamp(20px,2.4vw,26px);font-weight:700;letter-spacing:-.3px}';
if (h.indexOf(A6) >= 0) {
  h = h.split(A6).join('#aishow h3{margin:0 0 8px;font-size:clamp(20px,2.4vw,26px);font-weight:700;letter-spacing:-.3px;text-align:center}');
}

if (h === before) { console.log('nothing to do'); process.exit(0); }
const after = bal(h);
console.log('per-section div balance after:  ' + JSON.stringify(after));
if (after.some(n => n !== 0)) { console.error('REFUSING: a section is still unbalanced'); process.exit(1); }
if (DRY) { console.log('(dry run)'); process.exit(0); }

const b = h.slice(h.indexOf('<body'));
if ((b.match(/<div\b/g) || []).length !== (b.match(/<\/div>/g) || []).length) { console.error('REFUSING: whole-page div mismatch'); process.exit(1); }
if ((h.match(/class="pnote">A real reading/g) || []).length) { console.error('REFUSING: the orphan disclaimer is still there'); process.exit(1); }

fs.writeFileSync(F + '.tmp', Buffer.from(h, 'utf8'));
fs.renameSync(F + '.tmp', F);
console.log('#plus has a container, the pricing wrap closes, one disclaimer, showcase centred');
