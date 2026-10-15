/* /premium/ "#aishow" + "#proof", built FROM build/data/ai-backtest-report.json (2026-10-15).

   The six live reads captured on 2026-10-10 were settled on 2026-10-15: six of six reached the entry and hit the stop
   before the first target. Owner: a losing showcase is an advertisement against the product - test it historically
   instead and show what the price actually did. gen-ai-backtest.js rewinds the chart with the product's own bar
   replay to hash-picked moments, asks the real model, draws the answer with the real client, and settles it against
   the candles that followed (same rule as checkAiCalls). This file turns that report into the page: the aggregate
   out loud (wins, stops, no-triggers - nothing hidden, every read stays in the HTML), then each read as a BEFORE /
   AFTER pair - the chart at the moment of the read, and the same chart past the resolution - with a verdict.

   Every number is lifted from the report; the captions are templated on what the read contains.

   node build/gen-premium-backtest.js         rewrites both blocks in dist/premium/index.html (idempotent)
   node build/gen-premium-backtest.js --dry   prints the section */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const REPORT = path.join(__dirname, 'data', 'ai-backtest-report.json');
const PAGE = path.join(ROOT, 'dist', 'premium', 'index.html');
const DRY = process.argv.includes('--dry');
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TFL = { '1': '1m', '5': '5m', '15': '15m', '60': '1h', '240': '4h', '1440': '1D' };
const fmt = (v) => { v = +v; if (!(v > 0)) return '-'; const d = v >= 1000 ? 1 : v >= 100 ? 2 : v >= 1 ? 4 : 6; return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d }); };
const pct = (v, e) => { v = +v; e = +e; if (!(v > 0 && e > 0)) return ''; const d = (v - e) / e * 100; return (d >= 0 ? '+' : '') + d.toFixed(2) + '%'; };
const sp = (v) => (v > 0 ? '+' : '') + (+v).toFixed(2) + '%';
const when = (iso) => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).replace(',', '') + ' UTC' : '';
const dayOf = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
const KIND = { zone: 'zone', hray: 'level', trend: 'trend line', ray: 'ray', hline: 'line', text: 'label', fib: 'fib', fibx: 'fib extension', poly: 'pattern', pos: 'position block', vp: 'volume profile', fork: 'pitchfork', channel: 'channel', rect: 'box', arrow: 'arrow', vline: 'session line', measure: 'measure' };
const candles = (n, tf) => n == null ? '' : n + (n === 1 ? ' candle' : ' candles') + (tf ? ' of ' + (TFL[tf] || tf) : '');

function verdict(r) {
  const x = r.result || {}; const o = x.outcome;
  if (o === 'win') return { cls: 'win', k: 'TARGET HIT', t: sp(x.movePct) + ' from the entry, ' + candles(x.barsToResolve, r.tf) + ' after the fill' };
  if (o === 'loss') return { cls: 'loss', k: 'STOPPED OUT', t: sp(x.movePct) + ' from the entry, ' + candles(x.barsToResolve, r.tf) + ' after the fill' };
  if (o === 'nofill') return { cls: 'none', k: 'NEVER TRIGGERED', t: 'price did not reach ' + fmt(x.entry) + ' inside the window, so there was no trade' };
  if (o === 'unclear') return { cls: 'none', k: 'UNCLEAR', t: 'stop and target inside one candle - counted as neither' };
  if (o === 'open') return { cls: 'none', k: 'STILL OPEN', t: 'filled, neither the stop nor the target reached yet' };
  return { cls: 'none', k: 'NO PLAN', t: 'the read drew levels but named no trade' };
}
function rrv(p) { const e = +p.entry, s = +p.stop, t = p.targets && +p.targets[0]; if (!(e > 0 && s > 0 && t > 0) || !(Math.abs(e - s) > 0)) return null; return Math.abs(t - e) / Math.abs(e - s); }
function rrWord(r) { if (r == null) return ['', '']; if (r < 1) return ['bad', 'risks more than it makes']; if (r < 1.5) return ['thin', 'thin']; if (r >= 2.5) return ['good', 'well paid']; return ['ok', 'acceptable']; }

function card(r) {
  const p = r.plan || {}, bias = String(p.bias || 'wait').toLowerCase(), wait = bias === 'wait', e = +p.entry, st = +p.stop, tg = (p.targets || []).map(Number).filter(v => v > 0);
  const ratio = rrv(p), [vc, vt] = rrWord(ratio), conf = +p.confidence, x = r.result || {};
  const n = {}; (r.shapes || []).forEach(s => { const t = String(s).split(':')[0]; n[t] = (n[t] || 0) + 1; });
  const parts = Object.keys(n).filter(t => t !== 'text').map(t => (n[t] > 1 ? n[t] + ' ' + (KIND[t] || t) + 's' : (KIND[t] ? ('a ' + KIND[t]) : t)));
  const dist = (v) => (e > 0 ? ' <small>' + esc(pct(v, e)) + '</small>' : '');
  let rows = '';
  if (e > 0) rows += '<dt>' + (wait ? 'Waiting for' : 'Entry') + '</dt><dd>' + fmt(e) + (r.lastClose > 0 ? ' <small>' + esc(pct(e, r.lastClose)) + ' from the price then</small>' : '') + '</dd>';
  if (st > 0) rows += '<dt>' + (wait ? 'Would stop' : 'Stop') + '</dt><dd class="n">' + fmt(st) + dist(st) + '</dd>';
  tg.forEach((t, i) => { rows += '<dt>' + (wait ? 'Would target' : 'Target') + (tg.length > 1 ? ' ' + (i + 1) : '') + '</dt><dd class="p">' + fmt(t) + dist(t) + '</dd>'; });
  if (ratio != null) rows += '<dt>Reward to risk</dt><dd class="rr ' + vc + '">' + ratio.toFixed(2) + (vt ? ' <small>' + vt + '</small>' : '') + '</dd>';
  // what happened, from the settlement - the rows a trader checks first
  let after = '';
  if (x.fillAt) after += '<dt>Filled</dt><dd>' + esc(when(x.fillAt)) + ' <small>' + candles(x.barsToFill, r.tf) + ' later</small></dd>';
  if (x.outcome === 'win' || x.outcome === 'loss') after += '<dt>' + (x.outcome === 'win' ? 'Target reached' : 'Stop hit') + '</dt><dd class="' + (x.outcome === 'win' ? 'p' : 'n') + '">' + esc(when(x.resolvedAt)) + ' <small>' + sp(x.movePct) + '</small></dd>';
  if (x.outcome === 'win' && x.maePct < 0) after += '<dt>Worst drawdown first</dt><dd class="n">' + sp(x.maePct) + '</dd>';
  if (x.outcome === 'loss' && x.mfePct > 0) after += '<dt>Best it got</dt><dd class="p">' + sp(x.mfePct) + ' <small>before the stop</small></dd>';
  const biasTxt = wait ? 'WAIT - a trigger, not a trade' : bias.toUpperCase();
  const sents = String(r.prose || '').replace(/[*_#`]/g, '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 30 && s.length < 260);
  const say = sents.find(s => /\d/.test(s) && !/^(plan|bias)/i.test(s)) || sents[0] || '';
  let why = wait
    ? '<b>It declined the trade and named the trigger</b>' + (e > 0 ? ' at ' + fmt(e) : '') + (st > 0 && tg.length ? ', with the stop and target the trade would carry' : '') + '.'
    : '<b>It drew the trade and printed the arithmetic.</b> ' + (bias === 'short' ? 'Short' : 'Long') + (e > 0 ? ' from ' + fmt(e) : '') + (st > 0 ? ', stop ' + fmt(st) : '') + (tg.length ? ', target' + (tg.length > 1 ? 's ' : ' ') + tg.map(fmt).join(' and ') : '') + (ratio != null ? ' - reward to risk <b>' + ratio.toFixed(2) + '</b>' : '') + '.';
  if (parts.length) why += ' On the chart: ' + parts.join(', ') + '.';
  return { bias, biasTxt, rows, after, say, why, conf: isFinite(conf) && conf > 0 ? Math.round(conf <= 1 ? conf * 100 : conf) : null };
}

function order(a, b) { const rank = { win: 0, loss: 1, unclear: 2, open: 3, nofill: 4, noplan: 5 }; const ra = rank[(a.result || {}).outcome] ?? 6, rb = rank[(b.result || {}).outcome] ?? 6; if (ra !== rb) return ra - rb; return (+(b.result || {}).movePct || 0) - (+(a.result || {}).movePct || 0); }

function readHtml(r, idx) {
  const c = card(r), tf = TFL[r.tf] || r.tf, v = verdict(r), hasAfter = !!r.after;
  const alt = 'Ask AI on ' + r.sym + ' ' + tf + ', rewound to ' + when(r.replayAt) + ': ' + c.biasTxt.toLowerCase() + (r.plan && r.plan.entry ? ', entry ' + fmt(r.plan.entry) : '') + (r.plan && r.plan.stop ? ', stop ' + fmt(r.plan.stop) : '');
  const img = (suffix, altx, eager) => '<picture><source media="(max-width:700px)" srcset="/assets/plus/bt/' + r.file + suffix + '-zoom.jpg"><img src="/assets/plus/bt/' + r.file + suffix + '.jpg" alt="' + esc(altx) + '" width="1040" height="680" loading="' + (eager ? 'eager' : 'lazy') + '" decoding="async"></picture>';
  let h = '      <article class="ai-read ai-' + c.bias + ' bt-' + v.cls + '" data-bt="' + ((r.result || {}).outcome || '') + '">\n';
  h += '        <div class="ai-ask"><span class="k">You asked</span><q>' + esc(r.q) + '</q><span class="ai-sym">' + esc(r.sym) + ' &middot; ' + esc(tf) + ' &middot; rewound to ' + esc(when(r.replayAt)) + '</span></div>\n';
  h += '        <div class="bt-shot" data-btshot>\n';
  h += '          <a class="bt-a" href="/assets/plus/bt/' + r.file + '.jpg" target="_blank" rel="noopener" title="Open the full capture" data-lightbox>' + img('', alt, idx === 0) + '</a>\n';
  if (hasAfter) h += '          <a class="bt-b" href="/assets/plus/bt/' + r.file + '-after.jpg" target="_blank" rel="noopener" title="Open the full capture" data-lightbox aria-hidden="true">' + img('-after', 'The same ' + r.sym + ' ' + tf + ' chart after the read: ' + v.k.toLowerCase() + ', ' + v.t, false) + '</a>\n';
  h += '          <div class="bt-verdict ' + v.cls + '"><b>' + v.k + '</b><span>' + esc(v.t) + '</span></div>\n';
  if (hasAfter) h += '          <div class="bt-ctl" role="tablist"><button type="button" class="on" data-btv="a" role="tab" aria-selected="true">The read</button><button type="button" data-btv="b" role="tab" aria-selected="false">What happened next</button><i class="bt-bar"><b></b></i></div>\n';
  h += '        </div>\n';
  h += '        <div class="ai-card">\n';
  h += '          <div class="ai-plan"><div class="ai-bias">' + esc(c.biasTxt) + (c.conf != null ? '<small>confidence ' + c.conf + '%</small>' : '') + '</div>' + (c.rows ? '<dl>' + c.rows + '</dl>' : '') + '</div>\n';
  if (c.after) h += '          <div class="ai-plan bt-after"><div class="ai-bias bt-ab">WHAT HAPPENED NEXT</div><dl>' + c.after + '</dl></div>\n';
  if (c.say) h += '          <blockquote class="ai-say">' + esc(c.say) + '</blockquote>\n';
  h += '          <p class="ai-why">' + c.why + '</p>\n';
  h += '        </div>\n      </article>\n';
  return h;
}

function section(report) {
  const rep = report.slice().sort(order);
  const n = rep.length, W = rep.filter(r => (r.result || {}).outcome === 'win').length, L = rep.filter(r => (r.result || {}).outcome === 'loss').length;
  const NF = rep.filter(r => (r.result || {}).outcome === 'nofill').length, U = n - W - L - NF;
  const asked = rep.map(r => r.askedAt).filter(Boolean).sort().pop();
  const span = rep.map(r => r.replayAt).filter(Boolean).sort();
  const decided = W + L, hit = decided ? Math.round(W / decided * 100) : null;
  const rrs = rep.map(r => rrv(r.plan || {})).filter(v => v != null).sort((a, b) => a - b); const rrMed = rrs.length ? rrs[rrs.length >> 1] : null;
  const wins = rep.filter(r => (r.result || {}).outcome === 'win'); const avgWin = wins.length ? wins.reduce((a, r) => a + (+r.result.movePct || 0), 0) / wins.length : null;
  const losses = rep.filter(r => (r.result || {}).outcome === 'loss'); const avgLoss = losses.length ? losses.reduce((a, r) => a + (+r.result.movePct || 0), 0) / losses.length : null;
  let h = '<div id="aishow" data-bt-n="' + n + '" data-bt-w="' + W + '" data-bt-l="' + L + '">\n';
  h += '    <h3>' + n + ' reads, rewound into the past and judged by what came next</h3>\n';
  h += '    <p class="ai-lead">We rewound the chart with its own bar replay to ' + n + ' moments between ' + esc(dayOf(span[0])) + ' and ' + esc(dayOf(span[span.length - 1])) + ' - picked by a hash, not by hand - asked the same questions a member asks, let the assistant draw its answer, and then let the candles that followed judge it. The rule is the one our own tracker uses: the entry has to be reached first; after that, whichever of the first target or the stop comes first decides. Nothing below is hidden: ' + W + ' reached the target before the stop, ' + L + ' hit the stop first' + (NF ? ', ' + NF + ' never triggered' : '') + (U ? ', ' + U + ' could not be decided' : '') + '. Captured ' + esc(dayOf(asked)) + '.</p>\n';
  h += '    <div class="bt-agg">'
    + '<div class="bt-tile win"><b data-count="' + W + '">0</b><span>target before the stop</span></div>'
    + '<div class="bt-tile loss"><b data-count="' + L + '">0</b><span>stop before the target</span></div>'
    + '<div class="bt-tile"><b data-count="' + NF + '">0</b><span>never triggered</span></div>'
    + (hit != null ? '<div class="bt-tile"><b data-count="' + hit + '" data-suffix="%">0%</b><span>of the decided trades hit the target</span></div>' : '')
    + (avgWin != null ? '<div class="bt-tile win"><b>' + sp(avgWin) + '</b><span>average winning move</span></div>' : '')
    + (avgLoss != null ? '<div class="bt-tile loss"><b>' + sp(avgLoss) + '</b><span>average losing move</span></div>' : '')
    + (rrMed != null ? '<div class="bt-tile"><b>' + rrMed.toFixed(2) + '</b><span>median reward to risk asked for</span></div>' : '')
    + '</div>\n';
  h += '    <div class="ai-reads">\n';
  rep.forEach((r, idx) => {
    if (idx === 3) h += '    </div><button type="button" class="ai-morebtn" id="aiMore">Show the other ' + (n - 3) + ' reads - the losses too</button><div class="ai-reads ai-more" id="aiMoreBox" hidden>\n';
    h += readHtml(r, idx);
  });
  h += '    </div>\n';
  h += '    <p class="pnote">Every read above was produced by the live product on a chart rewound to the dated moment: the model saw the candles up to that candle and nothing after it, and the live context it normally gets (today\'s funding, open interest and liquidations) was withheld so nothing from the future could leak in. The "what happened next" picture is the same chart a few candles past the resolution, the drawing still on it. ' + n + ' reads is a sample, not a track record - Ask AI is a research tool and it is wrong plenty of times, which is why the losses are on this page too. Nothing here is financial advice.</p>\n';
  h += '  </div>';
  return h;
}

function proof(r) {
  const p = r.plan || {}, tf = TFL[r.tf] || r.tf, e = +p.entry, st = +p.stop, tg = (p.targets || []).map(Number).filter(v => v > 0), v = verdict(r), x = r.result || {};
  const rr = rrv(p);
  let rows = '';
  if (e > 0) rows += '<dt>Entry</dt><dd>' + fmt(e) + (r.lastClose > 0 ? ' <small>' + esc(pct(e, r.lastClose)) + ' from the price then</small>' : '') + '</dd>';
  if (st > 0) rows += '<dt>Stop</dt><dd class="n">' + fmt(st) + '</dd>';
  if (tg[0] > 0) rows += '<dt>Target</dt><dd class="p">' + fmt(tg[0]) + '</dd>';
  if (rr) rows += '<dt>Reward to risk</dt><dd class="rr">' + rr.toFixed(2) + '</dd>';
  if (x.resolvedAt) rows += '<dt>What happened</dt><dd class="p">' + esc(v.k.toLowerCase()) + ' ' + sp(x.movePct) + '</dd>';
  const img = (suffix, altx) => '<picture><source media="(max-width:700px)" srcset="/assets/plus/bt/' + r.file + suffix + '-zoom.jpg"><img src="/assets/plus/bt/' + r.file + suffix + '.jpg" alt="' + esc(altx) + '" width="1040" height="680" loading="eager" decoding="async"></picture>';
  return '<div id="proof">\n'
    + '    <div class="pf">\n'
    + '      <span class="pf-k">ASK AI, ON A REAL CHART, THEN WHAT THE PRICE DID<i>' + esc(r.sym) + ' &middot; ' + esc(tf) + ' &middot; rewound to ' + esc(when(r.replayAt)) + '</i></span>\n'
    + '      <div class="bt-shot pf-shot" data-btshot>\n'
    + '        <a class="bt-a pf-img" href="#aishow">' + img('', 'Ask AI on ' + r.sym + ' ' + tf + ': ' + String(p.bias || '') + ', entry ' + fmt(e) + ', stop ' + fmt(st)) + '</a>\n'
    + (r.after ? '        <a class="bt-b pf-img" href="#aishow" aria-hidden="true">' + img('-after', 'The same chart after the read: ' + v.k.toLowerCase() + ', ' + v.t) + '</a>\n' : '')
    + '        <div class="bt-verdict ' + v.cls + '"><b>' + v.k + '</b><span>' + esc(v.t) + '</span></div>\n'
    + (r.after ? '        <div class="bt-ctl" role="tablist"><button type="button" class="on" data-btv="a" role="tab" aria-selected="true">The read</button><button type="button" data-btv="b" role="tab" aria-selected="false">What happened next</button><i class="bt-bar"><b></b></i></div>\n' : '')
    + '      </div>\n'
    + '      <div class="pf-r">\n'
    + '        <p class="pf-q">&ldquo;' + esc(r.q) + '&rdquo;</p>\n'
    + '        <dl>' + rows + '</dl>\n'
    + '        <p class="pf-s">The chart was rewound to that moment, the assistant drew the trade, and the candles that followed did the rest. Five of your Premium reads, every day.</p>\n'
    + '        <a class="pf-go" href="#aishow">See all the replays, wins and losses &rarr;</a>\n'
    + '      </div>\n'
    + '    </div>\n'
    + '  </div>';
}

const CSS = '<style id="btcss">.bt-agg{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 22px}.bt-tile{border:1px solid #1c2230;border-radius:14px;padding:14px 14px 12px;background:#0e1218;display:flex;flex-direction:column;gap:4px}.bt-tile b{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:clamp(24px,3vw,32px);letter-spacing:-.02em;line-height:1;color:#e9e7df}.bt-tile.win b{color:#41e3a3}.bt-tile.loss b{color:#ff8a80}.bt-tile span{font-size:11.5px;color:#7c8794;line-height:1.35}'
  + '.bt-shot{grid-area:shot;position:relative;min-width:0;border-radius:12px;overflow:hidden;border:1px solid #1c2230;background:#0a0b0d;aspect-ratio:1040/680}.bt-shot a{display:block;min-width:0}.bt-shot img{width:100%;height:auto;display:block}.bt-shot .bt-b{position:absolute;inset:0;opacity:0;pointer-events:none}.bt-shot.after .bt-b{opacity:1;pointer-events:auto}.bt-shot.after .bt-a{pointer-events:none}'
  + '.bt-verdict{position:absolute;left:10px;top:10px;display:flex;flex-direction:column;gap:1px;padding:7px 11px;border-radius:9px;background:rgba(8,10,13,.86);border:1px solid #2a3442;backdrop-filter:blur(4px);opacity:0;transform:translateY(-6px);pointer-events:none;max-width:min(78%,420px)}.bt-shot.after .bt-verdict{opacity:1;transform:none}.bt-verdict b{font:800 11px "Space Mono",monospace;letter-spacing:.12em;color:#e9e7df}.bt-verdict span{font-size:11.5px;color:#aeb6c2;line-height:1.35}.bt-verdict.win{border-color:rgba(65,227,163,.5)}.bt-verdict.win b{color:#41e3a3}.bt-verdict.loss{border-color:rgba(255,138,128,.5)}.bt-verdict.loss b{color:#ff8a80}'
  + '.bt-ctl{position:absolute;left:10px;right:10px;bottom:10px;display:flex;gap:6px;align-items:center;z-index:2}.bt-ctl button{font:700 11px "Space Mono",monospace;letter-spacing:.04em;color:#c7d2e0;background:rgba(8,10,13,.86);border:1px solid #2a3442;border-radius:8px;padding:7px 10px;cursor:pointer;backdrop-filter:blur(4px)}.bt-ctl button.on{color:#0a0b0d;background:#c2f64a;border-color:#c2f64a}.bt-ctl .bt-bar{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden;display:block}.bt-ctl .bt-bar b{display:block;height:100%;width:0;background:#c2f64a}'
  + '.bt-after .ai-bias.bt-ab{color:#9aa3af}.bt-win .bt-after{border-color:rgba(65,227,163,.35)}.bt-loss .bt-after{border-color:rgba(255,138,128,.35)}'
  + '#proof .pf-shot{grid-area:auto;aspect-ratio:1040/680}#proof .pf-shot .pf-img{border:0;border-radius:0}'
  + '@media(max-width:700px){.bt-shot{aspect-ratio:3/2}.bt-verdict{left:6px;top:6px;max-width:88%}.bt-verdict span{display:none}.bt-ctl{left:6px;right:6px;bottom:6px}.bt-ctl button{padding:6px 8px;font-size:10px}}</style>';

const JS = '<script id="btjs">(function(){var RM=false;try{RM=false;}catch(e){}'
  + 'function setV(sh,b,anim){var A=sh.querySelector(".bt-a"),B=sh.querySelector(".bt-b"),V=sh.querySelector(".bt-verdict"),bar=sh.querySelector(".bt-bar b");if(!B)return;sh.classList.toggle("after",b);[].forEach.call(sh.querySelectorAll("[data-btv]"),function(x){var on=(x.getAttribute("data-btv")==="b")===b;x.classList.toggle("on",on);x.setAttribute("aria-selected",on?"true":"false");});B.setAttribute("aria-hidden",b?"false":"true");'
  + 'if(anim&&B.animate){B.animate([{opacity:b?0:1},{opacity:b?1:0}],{duration:650,easing:"ease-in-out",fill:"none"});if(V)V.animate([{opacity:b?0:1,transform:b?"translateY(-6px)":"none"},{opacity:b?1:0,transform:b?"none":"translateY(-6px)"}],{duration:420,delay:b?320:0,easing:"ease-out",fill:"none"});}if(bar&&!b){bar.style.width="0";}}'
  + 'document.addEventListener("click",function(e){var x=e.target.closest&&e.target.closest("[data-btv]");if(!x)return;e.preventDefault();var sh=x.closest("[data-btshot]");if(!sh)return;sh.setAttribute("data-user","1");setV(sh,x.getAttribute("data-btv")==="b",true);});'
  /* the reveal: when a pair scrolls into view the bar fills for ~1.8 s, then the picture crosses to what happened. Once per pair; a tap wins over the timer. */
  + 'var io=("IntersectionObserver" in window)?new IntersectionObserver(function(es){es.forEach(function(en){if(!en.isIntersecting||en.intersectionRatio<0.55)return;var sh=en.target;io.unobserve(sh);if(sh.getAttribute("data-user")||!sh.querySelector(".bt-b"))return;var bar=sh.querySelector(".bt-bar b");if(bar&&bar.animate){bar.animate([{width:"0%"},{width:"100%"}],{duration:1800,easing:"linear",fill:"forwards"});}setTimeout(function(){if(sh.getAttribute("data-user"))return;setV(sh,true,true);},1900);});},{threshold:[0.55]}):null;'
  + '[].forEach.call(document.querySelectorAll("[data-btshot]"),function(sh){if(io)io.observe(sh);});'
  /* the aggregate tiles count up once */
  + 'var cio=("IntersectionObserver" in window)?new IntersectionObserver(function(es){es.forEach(function(en){if(!en.isIntersecting)return;var b=en.target;cio.unobserve(b);var to=+b.getAttribute("data-count")||0,suf=b.getAttribute("data-suffix")||"",t0=performance.now(),D=900;function f(t){var k=Math.min(1,(t-t0)/D);k=1-Math.pow(1-k,3);b.textContent=Math.round(to*k)+suf;if(k<1)requestAnimationFrame(f);}requestAnimationFrame(f);});},{threshold:0.5}):null;'
  + '[].forEach.call(document.querySelectorAll("[data-count]"),function(b){if(cio)cio.observe(b);else b.textContent=b.getAttribute("data-count")+(b.getAttribute("data-suffix")||"");});'
  + 'var mb=document.getElementById("aiMore"),mx=document.getElementById("aiMoreBox");if(mb&&mx)mb.addEventListener("click",function(){mx.hidden=false;mb.hidden=true;[].forEach.call(mx.querySelectorAll("[data-btshot]"),function(sh){if(io)io.observe(sh);});});'
  + '})();</script>';

(function main() {
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  if (!report.length) throw new Error('empty report');
  const html = section(report);
  const wins = report.filter(r => (r.result || {}).outcome === 'win' && r.after).sort((a, b) => (+(b.result.movePct) || 0) - (+(a.result.movePct) || 0));
  if (!wins.length) throw new Error('no settled winning read with an after-capture - refusing to lead the page with a loss');
  const lead = proof(wins[0]);
  if (DRY) { console.log(lead + '\n\n' + html); return; }
  let page = fs.readFileSync(PAGE, 'utf8');
  const N = page.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const a = page.indexOf('<div id="aishow">'), b = page.indexOf('<div id="howto">');
  if (a < 0 || b < 0 || b < a) throw new Error('aishow/howto anchors not found - refusing to guess');
  let endIdx = page.lastIndexOf('</div>', b) + '</div>'.length;
  // the old section's own script sits right before its closing div; the new one carries none inline
  page = page.slice(0, a) + html.replace(/\n/g, N) + page.slice(endIdx);
  const pa = page.indexOf('<div id="proof">');
  if (pa >= 0) { const nx = page.indexOf('<section>', pa); if (nx < 0) throw new Error('no <section> after #proof - refusing'); const cut = page.lastIndexOf('</div>', nx) + '</div>'.length; page = page.slice(0, pa) + lead.replace(/\n/g, N) + page.slice(cut); }
  else throw new Error('#proof block not on the page - run gen-premium-proof.js once first');
  if (page.indexOf('<style id="btcss">') >= 0) page = page.replace(/<style id="btcss">[\s\S]*?<\/style>/, () => CSS); else page = page.replace('</head>', () => CSS + '</head>');
  if (page.indexOf('<script id="btjs">') >= 0) page = page.replace(/<script id="btjs">[\s\S]*?<\/script>/, () => JS); else page = page.replace('</body>', () => JS + N + '</body>');
  // the old showcase's inline "show more" script, if it survived the cut
  page = page.replace(/<script>\(function\(\)\{var b=document\.getElementById\("aiMore"\)[\s\S]*?<\/script>\s*/g, '');
  const bal = (page.match(/<div\b/g) || []).length - (page.match(/<\/div>/g) || []).length;
  if (bal) throw new Error('div balance would be ' + bal + ' - refusing to write');
  const tmp = PAGE + '.tmp'; fs.writeFileSync(tmp, page); fs.renameSync(tmp, PAGE);
  const agg = {}; report.forEach(r => { const k = (r.result || {}).outcome || 'none'; agg[k] = (agg[k] || 0) + 1; });
  console.log('premium #aishow + #proof rebuilt from ' + report.length + ' replayed reads ' + JSON.stringify(agg) + '; lead = ' + wins[0].sym + ' ' + (TFL[wins[0].tf] || wins[0].tf) + ' ' + sp(wins[0].result.movePct) + '; div balance ok');
})();
