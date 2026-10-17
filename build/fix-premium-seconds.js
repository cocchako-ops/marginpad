/* /premium/ gains the seconds timeframes (2026-10-17, owner: "takodje ces da update to na premium stranici").
   Idempotent, --dry supported, and it REFUSES rather than guessing if the page changes shape: the anchor card
   must exist exactly once and the new card must not already be there.
   The copy states what it is, where it works, where the data comes from AND its two limits (about a day of
   history, crypto perpetuals only) - a feature card that only lists the upside is an advertisement, and this
   page's whole argument is that its numbers can be checked.
   node build/fix-premium-seconds.js [--dry]                                                                */
const fs = require('fs'), path = require('path');
const DRY = process.argv.includes('--dry');
const FILE = path.join(__dirname, '..', 'dist', 'premium', 'index.html');
const MARK = 'data-sectf="1"';
const ANCHOR = '<h3>Ask AI on your charts</h3>';

const CARD = '<div class="fcard" ' + MARK + '><div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9 2h6"/></svg></div>'
  + '<h3>Seconds charts: 1s, 5s, 15s, 30s</h3>'
  + '<p>Second-by-second candles in the Paper Trade terminal and on Charts, plus the 3m, 30m, 2h, 6h and 12h frames. '
  + 'The one-second candle is Bybit&rsquo;s own and the forming bar is built from the same trade stream the live price comes from, '
  + 'so what you see is the market, not a smoothed line. Roughly a day of history, crypto perpetuals only.</p></div>';

let h = fs.readFileSync(FILE, 'utf8');
if (h.indexOf(MARK) >= 0) { console.log('already there - nothing to do'); process.exit(0); }
const n = h.split(ANCHOR).length - 1;
if (n !== 1) { console.error('REFUSING: the anchor card appears ' + n + ' times, expected exactly 1'); process.exit(1); }

// insert AFTER the whole anchor card (its own </div>), so the new card is a sibling and not nested inside it
const i = h.indexOf(ANCHOR);
const end = h.indexOf('</div>', h.indexOf('</p>', i));
if (end < 0) { console.error('REFUSING: could not find the end of the anchor card'); process.exit(1); }
const at = end + '</div>'.length;
const out = h.slice(0, at) + CARD + h.slice(at);

// the page must stay tag-balanced and gain exactly one card
const count = (s, re) => (s.match(re) || []).length;
const before = { open: count(h, /<div\b/g), close: count(h, /<\/div>/g), cards: count(h, /class="fcard"/g) + count(h, /class="fcard" data-sectf/g) };
const after = { open: count(out, /<div\b/g), close: count(out, /<\/div>/g), cards: count(out, /class="fcard"/g) };
if (after.open - before.open !== 2 || after.close - before.close !== 2) { console.error('REFUSING: div balance moved by ' + (after.open - before.open) + '/' + (after.close - before.close) + ', expected 2/2'); process.exit(1); }
if (after.cards !== before.cards + 1) { console.error('REFUSING: card count went ' + before.cards + ' -> ' + after.cards); process.exit(1); }

console.log((DRY ? '[dry] ' : '') + 'inserting the seconds card after "Ask AI on your charts" - cards ' + before.cards + ' -> ' + after.cards);
if (!DRY) { fs.writeFileSync(FILE + '.tmp', out, 'utf8'); fs.renameSync(FILE + '.tmp', FILE); console.log('written'); }
