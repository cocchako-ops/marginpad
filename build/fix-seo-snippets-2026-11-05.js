/* SEO snippet prepis 2026-11-05 (owner: "bez novog teksta po stranicama, pozadinski").
 * Rewrites ONLY title / meta description / og / twitter / JSON-LD name+description on the pages Google already
 * shows and nobody clicks (GSC 28 d to 2.11): /forex-trading-simulator/ 1.173 impr / 2 clicks / pos 23,
 * /stock-trading-simulator/ 216 / 10 / 24, /index-trading-simulator/ 114 / 8 / 5.6, /rewards/ 2.172 / 171 / 17.
 * The simulator strings also live in build/data/sim-i18n.js (changed in the same commit) so a regen keeps them;
 * /rewards/ is hand-made. Idempotent: a page already carrying the new string is skipped.
 * Every replacement is split/join (never String.replace with a $ in the replacement). --dry prints only. */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const DRY = process.argv.includes('--dry');
const esc = s => s.replace(/&/g, '&amp;');

const PAGES = [
  { f: 'forex-trading-simulator/index.html', pairs: [
    ['Free Forex Trading Simulator - Practice EUR/USD & Majors, $0 Risk', 'Forex Trading Simulator - Free, No Sign-Up, Live Rates'],
    ['Practice forex trading free with live rates on EUR/USD, GBP/USD, USD/JPY and more. Real charts, leverage and stop-loss - a forex demo with no sign-up and no real money. Learn before you risk a cent.',
     'Free forex trading simulator with no sign-up: live EUR/USD, GBP/USD and USD/JPY rates, real charts, leverage, stop-loss and liquidation on a virtual balance. Practice forex in your browser, nothing to download.'],
  ] },
  { f: 'stock-trading-simulator/index.html', pairs: [
    ['Free Stock Trading Simulator - Practice Stocks with $0 Risk', 'Stock Trading Simulator - Free, No Sign-Up, Live Prices'],
    ['Practice trading Apple, Tesla, Nvidia and 20+ real stocks with live prices and $0 real money. Free stock trading simulator - no sign-up, real charts, instant paper trades. Learn before you risk a cent.',
     'Free stock trading simulator with no sign-up: Apple, Tesla, Nvidia and 20+ real stocks at live prices, real charts, leverage, shorting and stop-loss on a virtual balance. Practice in your browser, nothing to download.'],
  ] },
  { f: 'index-trading-simulator/index.html', pairs: [
    ['Free Index Trading Simulator - Practice S&P 500, Nasdaq & Dow, $0 Risk', 'Index Trading Simulator - Free, No Sign-Up, S&P 500 and Nasdaq Live'],
    ['Practice trading the S&P 500, Nasdaq 100, Dow Jones and DAX with live prices and $0 real money. Free stock index simulator - real charts, leverage and stop-loss, no sign-up.',
     'Free index trading simulator with no sign-up: S&P 500, Nasdaq 100, Dow Jones and DAX at live prices, real charts, leverage and stop-loss on a virtual balance. Practice in your browser, nothing to download.'],
  ] },
  { f: 'rewards/index.html', pairs: [
    ['Free USDT Faucet - Welcome Bonus + Claim Every 5 Minutes | MarginPad', 'Free USDT Faucet - Claim Every 5 Minutes, No Deposit | MarginPad'],
    ['Free USDT - Welcome Bonus + Claim Every 5 Minutes | MarginPad', 'Free USDT Faucet - Claim Every 5 Minutes, No Deposit | MarginPad'],
    ['Free USDT - Welcome Bonus + Claim Every 5 Minutes', 'Free USDT Faucet - Claim Every 5 Minutes, No Deposit'],
    ['Earn free USDT on MarginPad: sign in with just your email (no password), get an instant welcome bonus, claim every 5 minutes and complete daily missions. Withdraw from $5 to your Bybit UID or Moon account. No deposit.',
     'Claim free USDT every 5 minutes with no deposit: sign in with just your email, get a welcome bonus, complete daily missions and withdraw from $5 to Bybit, MEXC, BingX or Moon.'],
    ['Sign in with your email, get an instant welcome bonus, claim free USDT every 5 minutes and earn extra with daily missions. Withdraw from $5.',
     'Claim free USDT every 5 minutes with no deposit: email sign-in, welcome bonus, daily missions, withdraw from $5 to Bybit, MEXC, BingX or Moon.'],
  ] },
];

let changed = 0;
for (const p of PAGES) {
  const file = path.join(DIST, p.f);
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  for (const [a, b] of p.pairs) {
    for (const [A, B] of [[a, b], [esc(a), esc(b)]]) {
      if (A === a && a.indexOf('&') < 0 && A !== esc(a)) { /* no-op */ }
      const n = h.split(A).length - 1;
      if (!n) continue;
      h = h.split(A).join(B);
      console.log(`${p.f}: ${n} x "${A.slice(0, 48)}..." -> "${B.slice(0, 48)}..."`);
    }
  }
  if (h === before) { console.log(`${p.f}: nothing to change (already applied?)`); continue; }
  for (const [, b] of p.pairs) if (h.indexOf(b) < 0 && h.indexOf(esc(b)) < 0) throw new Error(p.f + ': expected new string missing: ' + b.slice(0, 60));
  if (!DRY) { fs.writeFileSync(file + '.tmp', h); fs.renameSync(file + '.tmp', file); }
  changed++;
}
console.log((DRY ? 'DRY ' : '') + 'fix-seo-snippets: ' + changed + ' files');
