// Partner-link correction (2026-09-18). Idempotent: run it as often as you like.
//
// WHY. Measured in a real browser (curl cannot see this - three venues bot-block it and Bybit stores the
// referral in a cookie):
//   - Bybit `invite?ref=LZKBERJ` is a PERSONAL invite ("…@privaterelay.appleid.com invites you"), not the
//     affiliate programme. The owner's affiliate is 162071 - the same id his CSV export carries in `Source`,
//     which is the file the volume board is built from. `partner.bybit.com/b/162071` lands on a MarginPad-
//     branded sign-up page, and a PAIR page carries it too (`?affiliate_id=…&group_id=…&group_type=1`
//     writes REG_REF_prod with "medium":"affiliate").
//   - MEXC `promote.mexc.com/r/GND4jI97o0` resolved to inviteCode 41aeB - a DIFFERENT MEXC account
//     ("65****35 invites you"). Every MEXC sign-up we ever sent was credited to someone else.
//   - Gate `gate.com/VFIWB10KUG?ref=…` answered a real HTTP 404 ("Sorry, page not found").
//   - OKX `okx.com/trade-swap/<pair>` answered 404 AND carried no code at all. An OKX pair page cannot carry
//     our code (established 2026-09-13), so OKX is the one venue with no deep link - it goes to /join.
//
// Run: node build/fix-partner-links.js [--dry]
const fs = require('fs'), path = require('path');

const BYBIT_AFF = 'https://partner.bybit.com/b/162071';
const BYBIT_PAIR_Q = 'USDT?affiliate_id=162071&group_id=1922256&group_type=1';
const MEXC_REF = 'https://s.mexc.com/referral/YkL887dVgt';
const GATE_REF = 'https://www.gate.com/referral/registry?ref=VFIWB10KUG&ref_type=103&page=superRebate';
const OKX_JOIN = 'https://okx.com/join/96160298';

// Longest first where one is a prefix of another. Plain substrings only - split/join, never String.replace
// with a replacement string (a `$` in one is live: `$'` means "everything after the match").
// Both ampersand conventions are in the tree: the homepage and /exchanges/ write a raw `&` in an href while
// the comparison and calculator pages write `&amp;`. A pass that knew only the raw form left the dead Gate
// link standing on 27 pages. Replacements emit a raw `&` (what mpEx and the homepage already use; none of
// these parameter names is a named HTML entity, so nothing misparses).
const SUBS = [
  ['https://www.gate.com/VFIWB10KUG?ref=VFIWB10KUG&amp;ref_type=103&amp;ut-m_cmp=rXJBDjtJ&amp;activity_id=1778642196063', GATE_REF],
  ['https://www.gate.com/VFIWB10KUG?ref=VFIWB10KUG&amp;ref_type=103', GATE_REF],
  ['https://www.gate.com/VFIWB10KUG?ref=VFIWB10KUG&ref_type=103&ut-m_cmp=rXJBDjtJ&activity_id=1778642196063', GATE_REF],
  ['https://www.gate.com/VFIWB10KUG?ref=VFIWB10KUG&ref_type=103', GATE_REF],
  ['https://www.bybit.com/invite?ref=LZKBERJ', BYBIT_AFF],
  ['https://promote.mexc.com/r/GND4jI97o0', MEXC_REF],
  ['USDT?ref=LZKBERJ', BYBIT_PAIR_Q],          // concrete pair URLs AND the `+ s + 'USDT?ref=…'` concat
  ['https://futures.mexc.com/exchange/', 'https://www.mexc.com/futures/'],
  ['inviteCode=GND4jI97o0', 'inviteCode=47LrK']
];
// OKX pair pages: any /trade-swap/<something> becomes the join link. Function replacement (never a string).
const OKX_RE = /https:\/\/(?:www\.)?okx\.com\/trade-swap\/[a-z0-9-]*/g;

const DRY = process.argv.includes('--dry');
const EXT = /\.(html|js|txt|json|xml)$/i;
const SKIPDIR = /^(node_modules|\.git|og-images|ops-shots|vault-shots|fonts)$/;
// This file documents the old URLs on purpose; the probe scripts are disposable.
const SKIPFILE = /fix-partner-links\.js$/;

let files = 0, changed = 0;
const hits = Object.create(null);

function patch(p) {
  let s;
  try { s = fs.readFileSync(p, 'utf8'); } catch (e) { return; }
  files++;
  const before = s;
  for (const [from, to] of SUBS) {
    if (s.indexOf(from) < 0) continue;
    hits[from] = (hits[from] || 0) + s.split(from).length - 1;
    s = s.split(from).join(to);
  }
  if (OKX_RE.test(s)) {
    OKX_RE.lastIndex = 0;
    s = s.replace(OKX_RE, (m) => { hits['okx trade-swap'] = (hits['okx trade-swap'] || 0) + 1; return OKX_JOIN; });
  }
  OKX_RE.lastIndex = 0;
  if (s === before) return;
  changed++;
  if (DRY) { console.log('  would patch', path.relative(process.cwd(), p).replace(/\\/g, '/')); return; }
  // bytes to a .tmp then os.replace-equivalent: a failed write can never truncate the original
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(s, 'utf8'));
  fs.renameSync(tmp, p);
}

function walk(d) {
  let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
  for (const f of ents) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!SKIPDIR.test(f.name)) walk(p); continue; }
    if (EXT.test(f.name) && !SKIPFILE.test(f.name)) patch(p);
  }
}

['dist', 'src', 'app', 'build'].forEach(walk);
console.log((DRY ? '[dry] ' : '') + 'scanned ' + files + ' files, ' + changed + ' changed');
for (const k of Object.keys(hits)) console.log('  ' + String(hits[k]).padStart(5) + '  ' + k);
