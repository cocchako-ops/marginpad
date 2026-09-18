// The homepage exchange grid sends people to SIGN UP, not to a chart (owner 2026-09-18).
//
// It was split down the middle: Moon, Hyperliquid, Fomo, Kraken and Coinbase linked their sign-up page while
// Bybit, Binance, OKX, Bitget, Gate and MEXC linked a BTCUSDT pair page - a trading chart with no obvious way
// to open an account. A reader reported it in the global room as "the bybit creation link isn't working", and
// he was right: the section is headed "open an account" and half of it did something else.
//
// Deep links per pair stay everywhere they belong - screener, tickets, /rekt/, coin dashboards - because there
// the reader IS looking at that pair. This file only touches the grid on the homepages.
//
// Idempotent. Run: node build/fix-home-exchange-grid.js [--dry]
const fs = require('fs'), path = require('path');

const PAIR_TO_SIGNUP = [
  ['https://www.bybit.com/trade/usdt/BTCUSDT?affiliate_id=162071&group_id=1922256&group_type=1', 'https://partner.bybit.com/b/162071'],
  ['https://www.binance.com/en/futures/BTCUSDT?ref=MAOZM9DS', 'https://www.binance.com/register?ref=MAOZM9DS'],
  ['https://www.bitget.com/futures/usdt/BTCUSDT?clacCode=DSSSQKGK', 'https://www.bitget.com/referral/register?clacCode=DSSSQKGK&from=%2Fevents%2Freferral-all-program&source=events&utmSource=PremierInviter'],
  ['https://www.gate.com/futures/USDT/BTC_USDT?ref=VFIWB10KUG', 'https://www.gate.com/referral/registry?ref=VFIWB10KUG&ref_type=103&page=superRebate'],
  ['https://www.mexc.com/futures/BTC_USDT?inviteCode=47LrK', 'https://s.mexc.com/referral/YkL887dVgt']
];

const DRY = process.argv.includes('--dry');
const DIST = path.join(__dirname, '..', 'dist');
const files = [path.join(DIST, 'demo-home', 'index.html'), path.join(DIST, 'index.html')];
for (const d of fs.readdirSync(DIST, { withFileTypes: true })) {
  if (!d.isDirectory() || !/^[a-z]{2}$/.test(d.name)) continue;
  const p = path.join(DIST, d.name, 'index.html');
  if (fs.existsSync(p)) files.push(p);
}

let touched = 0;
for (const p of files) {
  let s; try { s = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
  const start = s.indexOf('<div class="exch-grid">');
  if (start < 0) continue;
  // the grid ends at the first element after it that is certainly outside - the section close.
  // Slicing keeps every OTHER pair link on the page (coin rails, tickets) untouched.
  const end = s.indexOf('</section>', start);
  if (end < 0) { console.log('  ! no </section> after the grid in', p); continue; }
  const head = s.slice(0, start), grid0 = s.slice(start, end), tail = s.slice(end);
  let grid = grid0, n = 0;
  for (const [from, to] of PAIR_TO_SIGNUP) {
    if (grid.indexOf(from) < 0) continue;
    n += grid.split(from).length - 1;
    grid = grid.split(from).join(to);   // split/join - never a replacement string
  }
  if (!n) continue;
  touched++;
  console.log('  ' + (DRY ? 'would fix ' : 'fixed ') + String(n) + ' card(s)  ' + path.relative(process.cwd(), p).replace(/\\/g, '/'));
  if (DRY) continue;
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(head + grid + tail, 'utf8'));
  fs.renameSync(tmp, p);
}
console.log((DRY ? '[dry] ' : '') + touched + ' homepage(s) changed of ' + files.length + ' checked');
