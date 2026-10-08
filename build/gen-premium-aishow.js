/* The "Six reads, as they came out" section of /premium/ - built FROM build/data/ai-promo-report.json (written by
   gen-ai-promo.js from real reads of the live product). Every number on the page is lifted from that file; the text is
   templated on what the read actually contains (bias, levels, shapes, receipts), so a regenerated capture can never carry
   a caption written for the previous one (2026-10-08, owner: "screenshots i obrazlozenja u nesto mnogo mnogo bolje").

   Per read: the question, the capture (the plan's own neighbourhood on phones, the whole window on desktops), a readout
   card - what it did on the chart, the plan with every price and distance, the reward-to-risk as a verdict - and one
   sentence of its own reasoning.

   node build/gen-premium-aishow.js          rewrites dist/premium/index.html in place (idempotent)
   node build/gen-premium-aishow.js --dry    prints the section only */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const REPORT = path.join(__dirname, 'data', 'ai-promo-report.json');
const PAGE = path.join(ROOT, 'dist', 'premium', 'index.html');
const DRY = process.argv.includes('--dry');
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TFL = { '1': '1m', '5': '5m', '15': '15m', '60': '1h', '240': '4h', '1440': '1D' };
const fmt = (v) => { v = +v; if (!(v > 0)) return '-'; const d = v >= 1000 ? 1 : v >= 100 ? 2 : v >= 1 ? 4 : 6; return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d }); };
const pct = (v, e) => { v = +v; e = +e; if (!(v > 0 && e > 0)) return ''; const d = (v - e) / e * 100; return (d >= 0 ? '+' : '') + d.toFixed(2) + '%'; };
const KIND = { zone: 'zone', hray: 'level', trend: 'trend line', ray: 'ray', hline: 'line', text: 'label', fib: 'fib', fibx: 'fib extension', poly: 'pattern', pos: 'position block', vp: 'volume profile', fork: 'pitchfork', channel: 'channel', rect: 'box', arrow: 'arrow', vline: 'session line', measure: 'measure' };
function shapesSentence(shapes) {
  const n = {}; (shapes || []).forEach(s => { const t = String(s).split(':')[0]; n[t] = (n[t] || 0) + 1; });
  const parts = Object.keys(n).filter(t => t !== 'text').map(t => (n[t] > 1 ? n[t] + ' ' + (KIND[t] || t) + 's' : (KIND[t] ? ('a ' + KIND[t]) : t)));
  const labels = (shapes || []).map(s => s.split(':').slice(1).join(':')).filter(Boolean).map(s => s.trim()).filter(s => s.length > 2);
  return { parts, labels };
}
function rr(plan) { const e = +plan.entry, s = +plan.stop, t = plan.targets && +plan.targets[0]; if (!(e > 0 && s > 0 && t > 0) || !(Math.abs(e - s) > 0)) return null; return Math.abs(t - e) / Math.abs(e - s); }
function verdict(r) { if (r == null) return ['', '']; if (r < 1) return ['bad', 'risks more than it makes']; if (r < 1.5) return ['thin', 'thin']; if (r >= 2.5) return ['good', 'well paid']; return ['ok', 'acceptable']; }
function card(r) {
  const p = r.plan || {}, bias = String(p.bias || 'wait').toLowerCase(), wait = bias === 'wait', e = +p.entry, st = +p.stop, tg = (p.targets || []).map(Number).filter(v => v > 0);
  const ratio = rr(p), [vc, vt] = verdict(ratio), conf = +p.confidence;
  const { parts, labels } = shapesSentence(r.shapes);
  const rec = (r.receipts || []).join(' · ').replace(/(?<=[a-z0-9)])(?=[A-Z])/g, ' · ').replace(/Undo drawings/gi, '').replace(/\s*·\s*$/, '').replace(/·\s*·/g, '·');/* the receipt is one element whose items run together ("Opened RSI (14)Drew 4 shapes") */
  const dist = (v) => (e > 0 ? ' <small>' + esc(pct(v, e)) + '</small>' : '');
  let rows = '';
  if (e > 0) rows += '<dt>' + (wait ? 'Waiting for' : 'Entry') + '</dt><dd>' + fmt(e) + (r.lastClose > 0 ? ' <small>' + esc(pct(e, r.lastClose)) + ' from the price when asked</small>' : '') + '</dd>';
  if (st > 0) rows += '<dt>' + (wait ? 'Would stop' : 'Stop') + '</dt><dd class="n">' + fmt(st) + dist(st) + '</dd>';
  tg.forEach((t, i) => { rows += '<dt>' + (wait ? 'Would target' : 'Target') + (tg.length > 1 ? ' ' + (i + 1) : '') + '</dt><dd class="p">' + fmt(t) + dist(t) + '</dd>'; });
  if (ratio != null) rows += '<dt>Reward to risk</dt><dd class="rr ' + vc + '">' + ratio.toFixed(2) + (vt ? ' <small>' + vt + '</small>' : '') + '</dd>';
  const biasTxt = wait ? 'WAIT - not a trade yet' : bias.toUpperCase();
  // one sentence of its own reasoning: the first sentence of the prose that carries a number or a level word
  const sents = String(r.prose || '').replace(/[*_#`]/g, '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 30 && s.length < 260);
  const say = sents.find(s => /\d/.test(s) && !/^(plan|bias)/i.test(s)) || sents[0] || '';
  // the explanation, templated on what the read contains
  let why = '';
  if (wait) why = '<b>A wait is an answer - with a price on it.</b> It declines the trade and marks what it is waiting for' + (e > 0 ? ' at ' + fmt(e) : '') + (st > 0 && tg.length ? ', with the stop and target the trade would carry if that level is reached' : '') + '.';
  else why = '<b>It draws the trade and prints the arithmetic.</b> ' + (bias === 'short' ? 'Short' : 'Long') + (e > 0 ? ' from ' + fmt(e) : '') + (st > 0 ? ', stop ' + fmt(st) : '') + (tg.length ? ', target' + (tg.length > 1 ? 's ' : ' ') + tg.map(fmt).join(' and ') : '') + (ratio != null ? ' - reward to risk <b>' + ratio.toFixed(2) + '</b>' + (ratio < 1.5 ? ', and it says so' : ' written on the block') : '') + '.';
  if (parts.length) why += ' On the chart: ' + parts.join(', ') + (labels.length ? ', labelled ' + labels.slice(0, 3).map(l => '&ldquo;' + esc(l) + '&rdquo;').join(', ') : '') + '.';
  if (/RSI|MACD|volume|EMA|Bollinger|Stoch/i.test(rec)) why += ' It opened an indicator on its own to check the move.';
  return { bias, biasTxt, rows, rec, say, why, conf: isFinite(conf) && conf > 0 ? Math.round(conf <= 1 ? conf * 100 : conf) : null };
}
function section(report) {
  const date = report.map(r => r.at).filter(Boolean).sort().pop();
  const when = date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const waits = report.filter(r => String((r.plan || {}).bias || 'wait').toLowerCase() === 'wait').length;
  let h = '<div id="aishow">\n';
  h += '    <h3>' + report.length + ' reads, as they came out</h3>\n';
  h += '    <p class="ai-lead">Untouched from the charts' + (when ? ' on ' + when : '') + ': the assistant picked the levels, drew them and printed its own verdict. Beside each capture is exactly what it did and every number it put on the chart - nothing retyped' + (waits ? ', and ' + (waits === 1 ? 'one of them is a refusal to trade' : waits + ' of the ' + report.length + ' are a refusal to trade') : '') + '.</p>\n';
  h += '    <div class="ai-reads">\n';
  report.forEach((r, idx) => {
    if (idx === 3) h += '    </div><button type="button" class="ai-morebtn" id="aiMore">Show the other ' + (report.length - 3) + ' reads</button><div class="ai-reads ai-more" id="aiMoreBox" hidden>\n';/* three reads on the page, the rest one tap away - six on a phone measured 8.4 screens; every read stays in the HTML for crawlers */
    const c = card(r), tf = TFL[r.tf] || r.tf;
    const alt = 'Ask AI on ' + r.sym + ' ' + tf + ': ' + c.biasTxt.toLowerCase() + (r.plan && r.plan.entry ? ', entry ' + fmt(r.plan.entry) : '') + (r.plan && r.plan.stop ? ', stop ' + fmt(r.plan.stop) : '');
    h += '      <article class="ai-read ai-' + c.bias + '">\n';
    h += '        <div class="ai-ask"><span class="k">You asked</span><q>' + esc(r.q) + '</q><span class="ai-sym">' + esc(r.sym) + ' &middot; ' + esc(tf) + '</span></div>\n';
    h += '        <a class="ai-shot" href="/assets/plus/' + r.file + '.jpg" target="_blank" rel="noopener" title="Open the full capture"><picture><source media="(max-width:700px)" srcset="/assets/plus/' + r.file + '-zoom.jpg"><img src="/assets/plus/' + r.file + '.jpg" alt="' + esc(alt) + '" width="1040" height="680" loading="lazy"></picture></a>\n';
    h += '        <div class="ai-card">\n';
    if (c.rec) h += '          <div class="ai-did"><span class="k">What it did</span>' + esc(c.rec) + '</div>\n';
    h += '          <div class="ai-plan"><div class="ai-bias">' + esc(c.biasTxt) + (c.conf != null ? '<small>confidence ' + c.conf + '%</small>' : '') + '</div>' + (c.rows ? '<dl>' + c.rows + '</dl>' : '') + '</div>\n';
    if (c.say) h += '          <blockquote class="ai-say">' + esc(c.say) + '</blockquote>\n';
    h += '          <p class="ai-why">' + c.why + '</p>\n';
    h += '        </div>\n      </article>\n';
  });
  h += '    </div>\n';
  h += '    <p class="pnote">Captured from the live product, untouched; the cards are read out of the same answers. Individual reads, not a track record - Ask AI is a research tool and it will be wrong plenty of times. Nothing here is financial advice.</p>\n';
  h += '    <script>(function(){var b=document.getElementById("aiMore"),x=document.getElementById("aiMoreBox");if(!b||!x)return;b.addEventListener("click",function(){x.hidden=false;b.hidden=true;});})();</script>\n';
  h += '  </div>';
  return h;
}
const CSS = '<style id="aishowcss">#aishow{margin:34px 0 8px}#aishow h3{margin:0 0 8px;font-size:clamp(20px,2.4vw,26px);font-weight:700;letter-spacing:-.3px;text-align:center}.ai-lead{margin:0 auto 22px;max-width:72ch;color:#c7d2e0;line-height:1.6;text-align:center}'
  + '.ai-reads{display:grid;grid-template-columns:1fr;gap:18px}.ai-read{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);grid-template-areas:"ask ask" "shot card";gap:12px 18px;align-items:start;border:1px solid #1c2230;border-radius:16px;padding:14px 16px 16px;background:linear-gradient(180deg,#0e1218,#0b0e13)}'
  + '.ai-ask{grid-area:ask;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;font-size:14px;color:#e9e7df}.ai-ask .k,.ai-did .k{font:800 10px "Space Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#7c8794}.ai-ask q{quotes:"\\201C" "\\201D";font-style:italic;color:#fff}.ai-sym{margin-left:auto;font:700 11.5px "Space Mono",monospace;color:#c2f64a;letter-spacing:.06em}'
  + '.ai-shot{grid-area:shot;display:block;min-width:0}.ai-shot img{width:100%;height:auto;display:block;border-radius:12px;border:1px solid #1c2230;background:#0a0b0d}'
  + '.ai-card{grid-area:card;min-width:0;display:flex;flex-direction:column;gap:11px}.ai-did{font-size:12.5px;line-height:1.5;color:#9aa6b8;display:flex;flex-direction:column;gap:3px}'
  + '.ai-plan{border:1px solid #232c38;border-radius:12px;padding:11px 13px;background:#0a0d12}.ai-bias{display:flex;align-items:baseline;gap:10px;font:800 13px "Space Mono",monospace;letter-spacing:.08em;margin-bottom:8px}.ai-bias small{font-weight:600;letter-spacing:0;color:#7c8794;font-size:11px}.ai-long .ai-bias{color:#2ebd85}.ai-short .ai-bias{color:#ff5a4d}.ai-wait .ai-bias{color:#9aa3af}'
  + '.ai-plan dl{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;margin:0;font-size:13px}.ai-plan dt{color:#7c8794}.ai-plan dd{margin:0;font-family:"Space Mono",monospace;font-weight:700;color:#e9e7df;text-align:right}.ai-plan dd small{font-weight:600;color:#7c8794;font-size:11px;margin-left:5px}.ai-plan dd.n{color:#ff8a80}.ai-plan dd.p{color:#41e3a3}.ai-plan dd.rr{color:#3fd8e6}.ai-plan dd.rr.good{color:#41e3a3}.ai-plan dd.rr.thin{color:#ffb020}.ai-plan dd.rr.bad{color:#ff5a4d}.ai-wait .ai-plan dd{color:#aeb6c2}'
  + '.ai-say{margin:0;padding:0 0 0 12px;border-left:2px solid #2a3442;font-size:13px;line-height:1.55;color:#c7d2e0;font-style:italic}.ai-why{margin:0;font-size:13.5px;line-height:1.6;color:#9aa6b8}.ai-why b{color:#e9e7df}#aishow .pnote{margin-top:16px}'
  + '.ai-morebtn{display:block;margin:16px auto 0;background:#12161c;border:1px solid #2a3442;color:#e9e7df;font:700 13px "Space Mono",monospace;border-radius:11px;padding:12px 22px;cursor:pointer}.ai-morebtn:hover{border-color:#c2f64a;color:#c2f64a}.ai-morebtn[hidden]{display:none}.ai-more{margin-top:18px}.ai-more[hidden]{display:none}'
  + '@media(max-width:900px){.ai-read{grid-template-columns:1fr;grid-template-areas:"ask" "shot" "card"}.ai-sym{margin-left:0}}'
  + '@media(max-width:700px){.ai-read{padding:12px}.ai-shot img{aspect-ratio:3/2}}</style>';
(function main() {
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  if (!report.length) throw new Error('empty report');
  const html = section(report);
  if (DRY) { console.log(html); return; }
  let page = fs.readFileSync(PAGE, 'utf8');
  const N = page.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const a = page.indexOf('<div id="aishow">'), b = page.indexOf('<div id="howto">');
  if (a < 0 || b < 0 || b < a) throw new Error('aishow/howto anchors not found - refusing to guess');
  // the section ends at the last </div> before #howto
  const endIdx = page.lastIndexOf('</div>', b) + '</div>'.length;
  page = page.slice(0, a) + html.replace(/\n/g, N) + page.slice(endIdx);
  if (page.indexOf('<style id="aishowcss">') >= 0) page = page.replace(/<style id="aishowcss">[\s\S]*?<\/style>/, () => CSS);
  else page = page.replace('</head>', () => CSS + '</head>');
  const tmp = PAGE + '.tmp'; fs.writeFileSync(tmp, page); fs.renameSync(tmp, PAGE);
  const bal = (page.match(/<div\b/g) || []).length - (page.match(/<\/div>/g) || []).length;
  console.log('premium #aishow rewritten from ' + report.length + ' reads; div balance ' + bal + (bal ? '  <-- CHECK' : ' (ok)'));
})();
