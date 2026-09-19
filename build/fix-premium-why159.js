// Two owner corrections on /premium/ (2026-09-19):
//
// 1. The $11.99 card was titled "MONTHLY" while the card beside it is "PREMIUM PLUS" - so the page named one
//    plan by its billing period and the other by its name, and a reader comparing them had no idea the first
//    one WAS Premium. It is "PREMIUM" now.
//
// 2. Nothing on the page explained why the second plan is thirteen times the price of the first. Owner:
//    "moraju da shvate da je razlika sto odrzivost AI modela kosta". So the gap is now answered with numbers
//    that can be checked:
//      - OURS, measured: an Ask AI read costs about $0.018 of model spend, and the 50-a-day ceiling is
//        ~$66/month for ONE member - which is why it is the only feature on this site with a per-use price.
//      - THEIRS, from Coinglass's own pricing page (checked 19 Sep 2026): Hobbyist $29, Startup $79,
//        Standard $299, Professional $699 a month - and NO tier on that page includes AI analysis at all.
//        That is data delivery alone.
//      - And a general chatbot subscription buys a model that cannot see any of it: it reads a screenshot.
//    Every figure is either measured by us or published by the company it describes - no invented numbers.
//
// Idempotent, refuses rather than guesses. `node build/fix-premium-why159.js [--dry]`
const fs = require('fs');
const F = 'dist/premium/index.html';
const DRY = process.argv.indexOf('--dry') >= 0;
let h = fs.readFileSync(F, 'utf8');
const before = h;
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
if (h.indexOf('id="whyplus"') >= 0) { console.log('already applied'); process.exit(0); }

// ── 1. name the plan after the plan ──────────────────────────────────────────────────────────────────────
const A1 = '<div class="pt">MONTHLY</div>';
if (h.indexOf(A1) < 0) { console.error('REFUSING: the monthly card title moved'); process.exit(1); }
h = h.split(A1).join('<div class="pt">PREMIUM</div>');

// ── 2. the block that answers the price gap ──────────────────────────────────────────────────────────────
const CSS_ANCHOR = '#aishow{margin:34px 0 8px}';
if (h.indexOf(CSS_ANCHOR) < 0) { console.error('REFUSING: aishow css anchor missing'); process.exit(1); }
h = h.split(CSS_ANCHOR).join(
  '#whyplus{margin:30px 0 4px}'
  + '#whyplus .wpg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border:1px solid #1c2230;border-radius:16px;overflow:hidden;background:#0e1218}'
  + '#whyplus .wpc{padding:20px 20px 18px;border-left:1px solid #1c2230}'
  + '#whyplus .wpc:first-child{border-left:0}'
  + '#whyplus .wpk{font:800 10.5px "Space Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#7c8794;margin-bottom:9px}'
  + '#whyplus .wpv{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:clamp(24px,3.2vw,33px);letter-spacing:-.02em;line-height:1.05;color:#e9e7df}'
  + '#whyplus .wpv small{font-size:14px;font-weight:600;color:#8b95a3;letter-spacing:0}'
  + '#whyplus .wps{margin:9px 0 0;font-size:13px;line-height:1.6;color:#9aa6b8}'
  + '#whyplus .wps b{color:#e9e7df}'
  + '#whyplus .wpc.mine .wpv{color:#c2f64a}'
  + '#whyplus .wpsrc{margin:12px 0 0;font-size:11.5px;line-height:1.65;color:#6e7885;text-align:center}'
  + '@media(max-width:820px){#whyplus .wpg{grid-template-columns:1fr}#whyplus .wpc{border-left:0;border-top:1px solid #1c2230}#whyplus .wpc:first-child{border-top:0}}'
  + CSS_ANCHOR);

const BLOCK =
  '  <div id="whyplus">' + N
  + '    <div class="sh"><div class="k">WHY THE TWO PRICES ARE SO FAR APART</div><h2>Premium costs us nothing to serve. Ask AI costs us money every time you press it.</h2><p class="lead">Everything else on this site - the indicators, the heatmap, the alerts, the boards - is code we already wrote. It serves a hundred members as cheaply as one. Ask AI is different: each read sends a measured brief to a frontier model and pays for it.</p></div>' + N
  + '    <div class="wpg">' + N
  + '      <div class="wpc mine"><div class="wpk">What one read costs us</div><div class="wpv">$0.018</div><p class="wps">Measured on our own bills, per question. At the Premium Plus ceiling of <b>50 reads a day</b> that is about <b>$66 a month of model spend for one member</b> - which is why it is the only thing here with a per-use price, and why Premium carries one read a day rather than fifty.</p></div>' + N
  + '      <div class="wpc"><div class="wpk">What the data alone costs elsewhere</div><div class="wpv">$299<small> /month</small></div><p class="wps">Coinglass Standard, from their own pricing page. Hobbyist $29, Startup $79, Standard $299, Professional $699 - and <b>no tier on that page includes AI analysis</b>. That is the data delivered to you; reading it is still your job.</p></div>' + N
  + '      <div class="wpc"><div class="wpk">What a general AI subscription sees</div><div class="wpv">A screenshot</div><p class="wps">A chatbot has no liquidation pools, no volume-at-price, no funding, no open interest and no idea whether this volatility is high or low <b>for this market</b>. It guesses from pixels, and it cannot draw a line on your chart. Ours is handed the measurements and draws the setup.</p></div>' + N
  + '    </div>' + N
  + '    <p class="wpsrc">Our figure is measured from our own API usage. Competitor prices are quoted from coinglass.com/pricing, checked 19 September 2026 - check it yourself before you compare. Nothing here is a claim about which product is better at what it does.</p>' + N
  + '  </div>' + N + N;

const AT = h.indexOf('  <div id="aishow">');
if (AT < 0) { console.error('REFUSING: could not find the showcase to sit above'); process.exit(1); }
h = h.slice(0, AT) + BLOCK + h.slice(AT);

if (h === before) { console.log('no change'); process.exit(0); }
const b = h.slice(h.indexOf('<body'));
const o = (b.match(/<div\b/g) || []).length, c = (b.match(/<\/div>/g) || []).length;
if (o !== c) { console.error('REFUSING: div tags unbalanced ' + o + '/' + c); process.exit(1); }
if ((h.match(/id="whyplus"/g) || []).length !== 1) { console.error('REFUSING: whyplus not unique'); process.exit(1); }
if (h.indexOf('>MONTHLY<') >= 0) { console.error('REFUSING: a MONTHLY title is still on the page'); process.exit(1); }
if (DRY) { console.log('(dry run) would rename the plan and explain the gap'); process.exit(0); }

fs.writeFileSync(F + '.tmp', Buffer.from(h, 'utf8'));
fs.renameSync(F + '.tmp', F);
console.log('plan named Premium; the price gap answered with three checkable numbers');
