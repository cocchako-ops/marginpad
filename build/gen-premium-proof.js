/* THE PROOF WAS SIX SCREENS DOWN (2026-10-11, owner: "ako mislis da nesto treba da radis, slobodno radi").

   Measured on the live page: /premium/ is 10.0 screens on a desktop and 13.8 on a phone, and `#aishow` - the real
   chart with a real trade drawn on it and the arithmetic beside it, which is the single strongest thing this page
   owns - starts at 5.9 screens down, behind eleven feature cards. The hero above it is entirely words.

   This puts ONE of those reads directly under the hero, as the first thing after the price. Not a second copy of
   the section: one capture, what it did, the plan's own numbers, and a link into the full six. Every figure is
   lifted from build/data/ai-promo-report.json - the same file gen-premium-aishow.js builds the section from - so
   the headline proof and the section below it can never quote different numbers.

   It picks a read that found a TRADE. A refusal is an honest answer and belongs in the section; it is the wrong
   thing to lead with, the same reason the section sorts trades first.

   node build/gen-premium-proof.js         rewrites dist/premium/index.html in place (idempotent)
   node build/gen-premium-proof.js --dry   prints the block only
*/
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const REPORT = path.join(__dirname, 'data', 'ai-promo-report.json');
const PAGE = path.join(ROOT, 'dist', 'premium', 'index.html');
const DRY = process.argv.includes('--dry');
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TFL = { 1: '1m', 5: '5m', 15: '15m', 60: '1h', 240: '4h', 1440: '1D' };
const fmt = (v) => { v = +v; if (!(v > 0)) return '-'; const d = v >= 1000 ? 1 : v >= 100 ? 2 : v >= 1 ? 4 : 6; return v.toLocaleString('en-US', { maximumFractionDigits: d }); };
const pct = (v, e) => { v = +v; e = +e; if (!(v > 0 && e > 0)) return ''; const d = (v - e) / e * 100; return (d >= 0 ? '+' : '') + d.toFixed(2) + '%'; };

const CSS = '<style id="proofcss">#proof{max-width:1000px;margin:26px auto 0;padding:0 20px}'
  + '#proof .pf{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px 22px;align-items:center;border:1px solid #1c2230;border-radius:18px;padding:16px;background:linear-gradient(180deg,#0e1218,#0b0e13)}'
  + '#proof .pf-k{grid-column:1/-1;font:800 10px "Space Mono",monospace;letter-spacing:.14em;color:var(--lime);display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}'
  + '#proof .pf-k i{font-style:normal;color:var(--faint);letter-spacing:.02em;font-weight:600;font-size:11px}'
  + '#proof a.pf-img{display:block;min-width:0;border-radius:12px;overflow:hidden;border:1px solid #1c2230;background:#0a0b0d}'
  + '#proof a.pf-img img{display:block;width:100%;height:auto}'
  + '#proof .pf-r{min-width:0}'
  + '#proof .pf-q{margin:0 0 10px;font-size:14px;font-style:italic;color:#fff;line-height:1.45}'
  + '#proof dl{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;margin:0 0 11px;font-size:13px}'
  + '#proof dt{color:#7c8794}#proof dd{margin:0;font-family:"Space Mono",monospace;font-weight:700;color:#e9e7df;text-align:right}'
  + '#proof dd small{font-weight:600;color:#7c8794;font-size:11px;margin-left:5px}#proof dd.n{color:#ff8a80}#proof dd.p{color:#41e3a3}#proof dd.rr{color:#41e3a3}'
  + '#proof .pf-s{margin:0 0 12px;font-size:12.5px;color:#9aa6b8;line-height:1.55}'
  + '#proof .pf-go{display:inline-flex;align-items:center;gap:7px;font:700 13px "Space Mono",monospace;color:var(--lime);text-decoration:none;border:1px solid rgba(194,246,74,.4);border-radius:10px;padding:9px 14px}'
  + '#proof .pf-go:hover{background:rgba(194,246,74,.08)}'
  + '@media(max-width:820px){#proof .pf{grid-template-columns:1fr;padding:13px}#proof{padding:0 14px}#proof dd small{display:none}}</style>';

function block(r) {
  const p = r.plan || {}, tf = TFL[r.tf] || r.tf, e = +p.entry, st = +p.stop;
  const tg = (p.targets || []).map(Number).filter((v) => v > 0);
  const rr = (e > 0 && st > 0 && tg[0] > 0 && Math.abs(e - st) > 0) ? (Math.abs(tg[0] - e) / Math.abs(e - st)).toFixed(2) : null;
  const bias = String(p.bias || '').toLowerCase();
  let rows = '';
  if (e > 0) rows += '<dt>Entry</dt><dd>' + fmt(e) + (r.lastClose > 0 ? ' <small>' + esc(pct(e, r.lastClose)) + ' from the price when asked</small>' : '') + '</dd>';
  if (st > 0) rows += '<dt>Stop</dt><dd class="n">' + fmt(st) + '</dd>';
  if (tg[0] > 0) rows += '<dt>Target</dt><dd class="p">' + fmt(tg[0]) + '</dd>';
  if (rr) rows += '<dt>Reward to risk</dt><dd class="rr">' + rr + '</dd>';
  const shapes = (r.shapes || []).map((s) => String(s).split(':')[0]).filter((t) => t !== 'text').length;
  return '<div id="proof">\n'
    + '    <div class="pf">\n'
    + '      <span class="pf-k">ASK AI, ON A REAL CHART<i>' + esc(r.sym) + ' &middot; ' + esc(tf) + ' &middot; untouched, as it came out</i></span>\n'
    + '      <a class="pf-img" href="#aishow"><picture><source media="(max-width:700px)" srcset="/assets/plus/' + r.file + '-zoom.jpg"><img src="/assets/plus/' + r.file + '.jpg" alt="Ask AI on ' + esc(r.sym + ' ' + tf) + ': ' + esc(bias) + ', entry ' + fmt(e) + ', stop ' + fmt(st) + '" width="1040" height="680" loading="eager" decoding="async"></picture></a>\n'
    + '      <div class="pf-r">\n'
    + '        <p class="pf-q">&ldquo;' + esc(r.q) + '&rdquo;</p>\n'
    + '        <dl>' + rows + '</dl>\n'
    + '        <p class="pf-s">It read the chart, drew ' + shapes + ' shapes on it and printed the arithmetic. One of your Premium reads, every day.</p>\n'
    + '        <a class="pf-go" href="#aishow">See all 6 reads &rarr;</a>\n'
    + '      </div>\n'
    + '    </div>\n'
    + '  </div>';
}

function main() {
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  const trade = report.filter((r) => { const b = String((r.plan || {}).bias || '').toLowerCase(); return (b === 'long' || b === 'short') && +((r.plan || {}).entry) > 0; });
  if (!trade.length) throw new Error('no read in the report found a trade - refusing to lead with a refusal');
  // the most confident one, so the lead is the best work in the file rather than whichever came first
  trade.sort((a, b) => (+(b.plan || {}).confidence || 0) - (+(a.plan || {}).confidence || 0));
  const html = block(trade[0]);
  if (DRY) { console.log(html); return; }

  let h = fs.readFileSync(PAGE, 'utf8');
  const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const a = h.indexOf('<div id="proof">');
  if (a >= 0) {
    const end = h.indexOf('</div>', h.lastIndexOf('</div>', h.indexOf('<section>', a)) ) ;
    // rebuild in place: cut from the opening tag to the last </div> before the next <section>
    const nx = h.indexOf('<section>', a);
    if (nx < 0) throw new Error('no <section> after #proof - refusing');
    const cut = h.lastIndexOf('</div>', nx) + '</div>'.length;
    h = h.slice(0, a) + html.split('\n').join(N) + h.slice(cut);
  } else {
    const anchor = '<section>' + N + '  <div class="wrap">' + N + '    <div class="sh"><div class="k">WHAT YOU UNLOCK</div>';
    if (h.split(anchor).length !== 2) throw new Error('the WHAT YOU UNLOCK section is not where it was - refusing to guess');
    h = h.replace(anchor, html.split('\n').join(N) + N + N + anchor);
  }
  if (h.indexOf('<style id="proofcss">') < 0) h = h.replace('</head>', CSS + '</head>');
  else h = h.replace(/<style id="proofcss">[\s\S]*?<\/style>/, () => CSS);

  const bad = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;
  if (bad) throw new Error('div balance would be ' + bad + ' - refusing to write');
  const tmp = PAGE + '.tmp';
  fs.writeFileSync(tmp, h);
  fs.renameSync(tmp, PAGE);
  console.log('premium #proof built from ' + trade[0].sym + ' ' + (TFL[trade[0].tf] || trade[0].tf) + ' (' + (trade[0].plan || {}).bias + ', confidence ' + ((trade[0].plan || {}).confidence || '-') + '); div balance ok');
}
main();
