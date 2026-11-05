/* /calculators and /swap get the same compact crawlable block /paper-trade has had since 2026-08-15 (owner 2026-11-05:
 * text is allowed when it is compact and does not pile up). Both are SPA routes served from dist/app.html with NO static
 * text at all: GSC 28 d to 2.11 had /calculators at 372 impressions, 0 clicks, position 11.8, and /swap "Crawled -
 * currently not indexed". The block is three cells + a chip rail, appended to the END of the body (below everything the
 * reader came for), the exact footprint PT_SEO was measured at (900x167 desktop, 308px on a 390 phone).
 * One stylesheet for the three blocks: PT_SEO's inline <style> is hoisted to PTS_CSS above the `if (m.pt)` branch.
 * Idempotent (refuses when the marker is present), --dry prints only. Never String.replace with a $ replacement. */
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, '..', 'src', 'worker.js');
const DRY = process.argv.includes('--dry');
let s = fs.readFileSync(F, 'utf8');
const MARK = '/* @SPA_SEO_BLOCKS 2026-11-05 */';
if (s.indexOf(MARK) >= 0) { console.log('fix-spa-seo-blocks: already applied'); process.exit(0); }

const once = (hay, needle, from) => { const i = hay.indexOf(needle, from || 0); if (i < 0) throw new Error('anchor missing: ' + needle.slice(0, 60)); if (hay.indexOf(needle, i + 1) >= 0 && !from) throw new Error('anchor not unique: ' + needle.slice(0, 60)); return i; };

// 1) hoist PT_SEO's <style> into PTS_CSS, defined before `if (m.pt) {`
const iIf = once(s, "      if (m.pt) { // /paper-trade SEO push");
const iSeo = once(s, "const PT_SEO = '<section class=\"pt-seo\"", iIf);
const iSty = once(s, "          + '<style>'\n", iSeo);
const iStyEnd = once(s, "          + '</style>'\n", iSty);
const styleBlock = s.slice(iSty, iStyEnd + "          + '</style>'\n".length); // lines `+ '<style>' ... + '</style>'`
const cssExpr = styleBlock.replace(/^\s*\+ /gm, '    + ').replace(/^\s*\+ /, '').trim(); // drop the leading `+`
const hoist = '      ' + MARK + '\n      const PTS_CSS = ' + cssExpr + ';\n';
s = s.slice(0, iIf) + hoist + s.slice(iIf, iSty) + "          + PTS_CSS\n" + s.slice(iStyEnd + "          + '</style>'\n".length);

// 2) the two new branches, right after the `if (m.pt) { ... }` block closes
const iTail = once(s, "rw = rw.on('head', { element(e) { e.append(PT_SCHEMA, { html: true }); } }).on('body', { element(e) { e.append(PT_SEO, { html: true }); } });");
const iClose = once(s, "\n      }\n", iTail);
const I = {
  liq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l5-6 4 3 7-8"/><path d="M4 21h16"/></svg>',
  size: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8M12 8v8"/></svg>',
  pnl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.6h3.6a1.8 1.8 0 0 1 0 3.6h-2.2a1.8 1.8 0 0 0 0 3.6H14.5"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l2 2M13 9l2 2"/></svg>',
  chain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 15h2"/></svg>'
};
const cell = (cls, ico, k, h, p) => "'<div class=\"pts-c" + (cls ? ' ' + cls : '') + "\"><span class=\"pts-i\">" + ico + "</span><div class=\"pts-b\"><span class=\"pts-k\">" + k + "</span><b class=\"pts-h\">" + h + "</b><p class=\"pts-p\">" + p + "</p></div></div>'";
const chips = (a, tail) => "'<div class=\"pts-f\">" + a.map(([h, t]) => '<a href="' + h + '">' + t + '</a>').join('') + '<span class="pts-t">' + tail + "</span></div>'";

const CALC = [
  "        const CALC_SEO = '<section class=\"pt-seo\" style=\"max-width:900px;margin:14px auto 20px;padding:0;background:#101318;border:1px solid #232a34;border-radius:14px;overflow:hidden;color:#8a94a0;font-size:11.5px;line-height:1.4\">'",
  "          + PTS_CSS + '<div class=\"pts-g\">'",
  '          + ' + cell('', I.liq, 'Liquidation price', 'Where a position dies', 'Entry, leverage and the exchange&#39;s maintenance margin give the exact liquidation price - the formula Bybit, Binance and OKX use. 10x at 0.5% liquidates 9.45% from entry; <a href="/leverage-calculator/">see every leverage</a>.'),
  '          + ' + cell('m', I.size, 'Position size', 'Risk first, size second', 'Choose the dollars you can lose and the stop distance; the calculator returns the size and leverage that fit. The <a href="/risk-of-ruin-calculator/">risk-of-ruin calculator</a> says how long that survives.'),
  '          + ' + cell('w', I.pnl, 'P&amp;L and R:R', 'What the trade pays', 'Profit, ROE and reward-to-risk at any exit with taker fees both sides - the same figures the <a href="/paper-trade">paper terminal</a> books on a real close.'),
  "          + '</div>'",
  '          + ' + chips([['/bybit-liquidation-calculator/', 'Bybit'], ['/binance-liquidation-calculator/', 'Binance'], ['/okx-liquidation-calculator/', 'OKX'], ['/kraken-liquidation-calculator/', 'Kraken'], ['/hyperliquid-liquidation-calculator/', 'Hyperliquid'], ['/bitget-liquidation-calculator/', 'Bitget'], ['/pivot-point-calculator/', 'Pivot points'], ['/crypto-correlation-matrix/', 'Correlation']], 'Liquidation calculators per exchange - same formula, each venue&#39;s own maintenance margin.'),
  "          + '</section>';",
].join('\n');
const SWAP = [
  "        const SWAP_SEO = '<section class=\"pt-seo\" style=\"max-width:900px;margin:14px auto 20px;padding:0;background:#101318;border:1px solid #232a34;border-radius:14px;overflow:hidden;color:#8a94a0;font-size:11.5px;line-height:1.4\">'",
  "          + PTS_CSS + '<div class=\"pts-g\">'",
  '          + ' + cell('', I.key, 'No account', 'Swap without signing up', 'Pick the pair, paste the receiving address, send. No email, no password, no balance held here - swaps are processed by ChangeNOW and the rate is shown before you commit.'),
  '          + ' + cell('m', I.chain, '900+ coins', 'Chain to chain in one step', 'Bitcoin, Ethereum, Solana, stablecoins and long-tail tokens, across the major chains, without an exchange account in between.'),
  '          + ' + cell('w', I.wallet, 'Non-custodial', 'Your keys stay yours', 'Funds move wallet to wallet and never touch MarginPad. New to the chains? Practise the whole flow with demo money on <a href="/spot/">Demo Spot</a> first.'),
  "          + '</div>'",
  '          + ' + chips([['/spot/', 'Demo Spot'], ['/paper-trade', 'Paper trade'], ['/screener', 'Screener'], ['/exchanges/', 'Exchanges compared'], ['/academy/', 'Academy']], 'Swap crypto without an account - non-custodial, 900+ coins.'),
  "          + '</section>';",
].join('\n');
const branch = '\n      if (m.calc || m.swp) { // ' + MARK + ' - /calculators and /swap had no static text at all (GSC: 372 impressions, 0 clicks; "Crawled - currently not indexed")\n'
  + CALC + '\n' + SWAP + '\n'
  + "        rw = rw.on('body', { element(e) { e.append(m.calc ? CALC_SEO : SWAP_SEO, { html: true }); } });\n"
  + '      }';
s = s.slice(0, iClose + "\n      }".length) + branch + s.slice(iClose + "\n      }".length);

if (s.indexOf('PTS_CSS') < 0 || (s.match(/PTS_CSS/g) || []).length < 4) throw new Error('PTS_CSS wiring incomplete');
if (DRY) { console.log('DRY: would write ' + s.length + ' bytes; PTS_CSS refs ' + (s.match(/PTS_CSS/g) || []).length); process.exit(0); }
fs.writeFileSync(F + '.tmp', s); fs.renameSync(F + '.tmp', F);
console.log('fix-spa-seo-blocks: written, PTS_CSS refs ' + (s.match(/PTS_CSS/g) || []).length);
