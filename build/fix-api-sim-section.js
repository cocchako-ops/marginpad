// THE TWO THINGS /trading-api/ WAS MISSING (2026-10-10), both measured rather than guessed:
//
//  1. THE FIRST CALL. 117 of 174 keys ever minted have never made a single request, and 77 of 125 accounts
//     have not either - 17 of those minted a SECOND key and still never called. Of the 57 keys that DID call,
//     16 lived under an hour and 12 under a day, median 4 to 15 calls. The drop-off is not in the engine, it
//     is between "I have a key" and "something answered me". So the moment the key appears, the page now
//     hands over a curl with that key already in it AND a button that makes the call and prints the real
//     answer - the first success happens before the developer has opened an editor.
//
//  2. WHERE TO FIND YOUR OWN SETUP. The owner's ask: "treba sve da moze da se podesi i da dajemo ogroman
//     custom setup build ... da neko moze da pronadje resenje i da testira svog bota preko naseg API-a."
//     #realism documented three switches. The engine now has eighteen fields and eight presets, and a page
//     that does not say so is a product nobody can find.
//
// The page is CRLF: the line ending is read from the file, never assumed. Idempotent, refuses rather than
// guessing, `--dry` prints what it would do.
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '..', 'dist', 'trading-api', 'index.html');
const DRY = process.argv.indexOf('--dry') >= 0;
let h = fs.readFileSync(P, 'utf8');
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const before = h;
const did = [];
function sub(from, to, label) {
  const c = h.split(from).length - 1;
  if (c !== 1) { console.error('REFUSING: expected 1 occurrence for "' + label + '", found ' + c); process.exit(1); }
  h = h.split(from).join(to); did.push(label);
}
if (h.indexOf('id="akbGo"') >= 0 && h.indexOf('id="sim"') >= 0) { console.log('already applied - nothing to do'); process.exit(0); }

// ───────────────────────────────────────────────────────────────────── 1. CSS
const CSS = [
  '  /* THE FIRST CALL (2026-10-10). Measured: 67% of keys ever minted never made one request, so the key',
  '     box now hands over a working call and runs it. */',
  '  .akb-go{margin-top:14px;border:1px solid rgba(194,246,74,.3);border-radius:12px;padding:14px 16px;background:rgba(194,246,74,.045);}',
  '  .akb-go h3{margin:0 0 6px;font-size:15px;letter-spacing:.01em;}',
  '  .akb-go p{margin:0 0 10px;font-size:13.5px;opacity:.82;}',
  '  .akb-go pre{margin:0 0 10px;padding:11px 12px;background:#0b0c0e;border:1px solid rgba(255,255,255,.08);border-radius:9px;overflow-x:auto;font-size:12.5px;line-height:1.55;}',
  '  .akb-go .agb{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}',
  '  .akb-go .ago{margin-top:10px;padding:11px 12px;background:#0b0c0e;border:1px solid rgba(255,255,255,.08);border-radius:9px;max-height:260px;overflow:auto;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;}',
  '  .akb-go .agok{margin-top:9px;font-size:13.5px;color:#c2f64a;font-weight:600;}',
  '  /* THE SIMULATION PROFILE */',
  '  .simg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0 6px;}',
  '  .simc{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px;background:rgba(255,255,255,.02);min-width:0;}',
  '  .simc h3{margin:0 0 7px;font-size:14px;letter-spacing:.01em;}',
  '  .simc code{font-size:11.5px;}',
  '  .simc p{margin:0;font-size:13px;opacity:.8;line-height:1.5;}',
  '  .simc.lead{border-color:rgba(194,246,74,.3);background:rgba(194,246,74,.05);}',
  '  .simt{width:100%;border-collapse:collapse;margin:16px 0 8px;font-size:13px;}',
  '  .simt th,.simt td{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.07);vertical-align:top;}',
  '  .simt th{font-size:11px;letter-spacing:.09em;text-transform:uppercase;opacity:.55;font-weight:600;}',
  '  .simt td:first-child{white-space:nowrap;}',
  '  .simt tr.grp td{padding-top:16px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;opacity:.55;border-bottom:none;}',
  '  .simt .rg{opacity:.6;white-space:nowrap;font-size:12px;}',
  '  @media(max-width:1000px){.simg{grid-template-columns:repeat(2,minmax(0,1fr));}}',
  '  @media(max-width:620px){.simg{grid-template-columns:minmax(0,1fr);}.simtw{overflow-x:auto;}.simt{min-width:520px;}}',
].join(N);
sub('  .keybox.kb-lead{margin-top:0;padding:34px;border-color:rgba(194,246,74,.28);}',
  CSS + N + '  .keybox.kb-lead{margin-top:0;padding:34px;border-color:rgba(194,246,74,.28);}', 'CSS');

// ───────────────────────────────────────────────────────────────────── 2. the first-call block
// showNew() is the ONE moment the full key is on screen. The call goes right there, with the key in it.
sub(
  "  function showNew(k){out.innerHTML='<div class=\"akb-show\">'+esc(k)+'<small>Copy it now and keep it secret - anyone holding it can trade your paper account. The list below masks keys; use show to reveal one again.</small></div>';out.classList.add('on');msg.textContent='';}",
  [
    "  function showNew(k){out.innerHTML='<div class=\"akb-show\">'+esc(k)+'<small>Copy it now and keep it secret - anyone holding it can trade your paper account. The list below masks keys; use show to reveal one again.</small></div>'+goHtml(k);out.classList.add('on');msg.textContent='';wireGo(k);}",
    "  /* MAKE THE FIRST CALL SUCCEED HERE, NOW. Two thirds of every key ever minted has never made a single",
    "     request - the gap is between holding a key and seeing something answer, not in the engine. So the",
    "     curl carries the key already, and the button makes the call from this page and prints the real body. */",
    "  function goHtml(k){return '<div class=\"akb-go\" id=\"akbGo\">'",
    "    +'<h3>Make your first call now</h3>'",
    "    +'<p>This is a real request against your real account. Run it here, or paste it into a terminal - it is the same call.</p>'",
    "    +'<pre><code>curl -s https://marginpad.io/api/bot/v2/account \\\\\\n  -H \"X-API-Key: '+esc(k)+'\"</code></pre>'",
    "    +'<div class=\"agb\"><button class=\"btn akb-sm\" type=\"button\" data-go=\"run\">Run it</button>'",
    "    +'<button class=\"btn akb-sm\" type=\"button\" data-go=\"copy\">Copy the curl</button></div>'",
    "    +'<div class=\"ago\" id=\"akbOut\" hidden></div><div class=\"agok\" id=\"akbWin\" hidden></div></div>';}",
    "  function wireGo(k){var box=document.getElementById('akbGo');if(!box||box._w)return;box._w=1;",
    "    box.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-go]');if(!b)return;",
    "      var act=b.getAttribute('data-go');",
    "      if(act==='copy'){try{navigator.clipboard.writeText('curl -s https://marginpad.io/api/bot/v2/account -H \"X-API-Key: '+k+'\"');b.textContent='copied';setTimeout(function(){b.textContent='Copy the curl';},1500);}catch(x){}return;}",
    "      var o=document.getElementById('akbOut'),w=document.getElementById('akbWin');",
    "      b.disabled=true;b.textContent='Calling...';o.hidden=false;o.textContent='';",
    "      fetch('/api/bot/v2/account',{headers:{'X-API-Key':k}}).then(function(r){return r.text().then(function(t){return {s:r.status,t:t};});}).then(function(d){",
    "        o.textContent=d.t;b.disabled=false;b.textContent='Run it again';",
    "        if(d.s===200){w.hidden=false;w.textContent='That was your first API call. The same key works on every endpoint on this page.';}",
    "        else{w.hidden=false;w.textContent='Status '+d.s+' - the body above says why. Every refusal here names what to do instead.';}",
    "      }).catch(function(){o.textContent='The request could not be made from this page. Copy the curl and run it in a terminal.';b.disabled=false;b.textContent='Run it';});",
    "    });}",
  ].join(N),
  'the first call'
);

// ───────────────────────────────────────────────────────────────────── 3. the rail entry
sub(
  '      <li><a href="#fees">Venue fees</a>' + N + '      <a href="#realism">Fill realism</a></li>',
  '      <li><a href="#fees">Venue fees</a>' + N + '      <a href="#realism">Fill realism</a>' + N + '      <a href="#sim">The simulation profile</a></li>',
  'the rail entry'
);

// ───────────────────────────────────────────────────────────────────── 4. the #sim section
const F = (name, range, text) => '    <tr><td><code>' + name + '</code></td><td class="rg">' + range + '</td><td>' + text + '</td></tr>';
const SIM = [
  '<section id="sim">',
  '  <h2>Build the venue you are actually going to trade</h2>',
  '  <p>The three switches above are part of something larger. <b>Everything this engine assumes is a field you can set</b>: the size of the book and whether it is a real budget, what crossing the order book costs on the way in and on the way out, how long your order is in flight, whether an order fills part-way, how often the venue says no, what you pay in fees, whether funding is charged at all, and where the liquidation price sits.</p>',
  '  <p><b>The defaults are deliberately easy, and that is worth saying plainly.</b> A market order fills whole at the live price, maintenance margin is a flat 0.5%, the balance is a scorecard that never refuses an open, and there is no latency and no size impact. That is the right place to get a bot <em>running</em>. It is the wrong place to judge whether it has an edge. One call changes that.</p>',
  '<pre><code>GET  /api/bot/v2/sim                    <b># your profile, every field with its range, and the presets</b>',
  'POST /api/bot/v2/sim {"preset": "realistic"}',
  '',
  '<b># or exactly your own venue</b>',
  'POST /api/bot/v2/sim {"start_balance_usd": 2500, "margin_enforced": true,',
  '                      "slippage": true, "slippage_bps": 8, "impact_bps_per_100k": 15,',
  '                      "latency_ms": 250, "taker_bps": 5.5, "margin_venue": "bybit"}</code></pre>',
  '  <p>Out-of-range values are <b>refused, never clamped</b> - a strategy must never be measured under a setting you did not choose. A position keeps the maintenance margin, the fee rate and the exit crossing cost it was filled under, for life; turning anything on never rewrites a trade you already hold.</p>',
  '',
  '  <h3>Eight presets, so you do not have to invent eighteen numbers</h3>',
  '  <div class="simg">',
  '    <div class="simc"><h3>frictionless</h3><p>The engine as it has always been. Get the bot running, see trades land, then change it.</p></div>',
  '    <div class="simc lead"><h3>realistic</h3><p>The one to measure an edge on: the book costs what we measure on both legs, size costs more, the risk-limit ladder is on, funding is charged, and the book refuses what it cannot fund.</p></div>',
  '    <div class="simc"><h3>binance &middot; bybit &middot; okx &middot; hyperliquid</h3><p>That venue&rsquo;s own published taker fee and maintenance margin, with our measured crossing cost, margin enforced and the ladder on.</p></div>',
  '    <div class="simc"><h3>thin_book &middot; brutal</h3><p>A mid-cap perp at an unkind hour, and then worse than anything you will meet: 60 bps to cross, 120 bps per $100k of size, fills from a quarter upwards, one open in twenty refused, a second of latency. <b>Ours, not any venue&rsquo;s figures.</b> If a strategy still works here it is not living on execution luck.</p></div>',
  '  </div>',
  '',
  '  <h3>Every field, its range and what it changes</h3>',
  '  <div class="simtw"><table class="simt">',
  '  <thead><tr><th>Field</th><th>Range</th><th>What it does</th></tr></thead>',
  '  <tbody>',
  '    <tr class="grp"><td colspan="3">The book &mdash; what the bot is allowed to risk</td></tr>',
  F('start_balance_usd', '100 &ndash; 10,000,000', 'The book your results are measured against: <code>return_pct</code>, the equity curve and max drawdown all follow it. Test on the account size you will really trade.'),
  F('margin_enforced', 'off / on', '<b>The single biggest difference between a scorecard and a venue.</b> On, an open needing more than your free margin is refused <code>402 insufficient_margin</code>. Free margin is balance minus committed margin &mdash; unrealized profit on an open position is not collateral for a new one, because every position here is isolated margin.'),
  F('leverage_max', '0 &ndash; 10,000', 'Your own ceiling below the per-market cap. Proves a strategy never quietly drifted into 100&times;. 0 = the market cap.'),
  F('max_notional_usd', '0 &ndash; 1,000,000,000', 'Your own ceiling on one position&rsquo;s notional. 0 = none of your own.'),
  '    <tr class="grp"><td colspan="3">The fill &mdash; what crossing the book costs</td></tr>',
  F('slippage', 'off / on', 'Fill against yourself the way walking a real book does: 0.01% crypto majors, 0.05% thinner crypto, 0.005% forex, 0.02% stocks, metals and indices. A buy pays up, a sell sells down.'),
  F('slippage_bps', '0 &ndash; 500', 'Your own figure instead of that table. 10 = 0.10%. <code>null</code> goes back to the table.'),
  F('impact_bps_per_100k', '0 &ndash; 500', 'Size costs more, because a bigger order walks further down the book: this many basis points on top per $100,000 of notional.'),
  F('exit_slippage', 'on / off', 'Pay the crossing cost on the way out as well as in. <b>Without it a scalping strategy reads better than it can ever trade.</b> A stop, take-profit or liquidation still fills at its own level &mdash; see the limits below.'),
  F('latency_ms', '0 &ndash; 2,000', 'Your order is in flight this long, and <b>the price is re-read afterwards</b> &mdash; so the fill is the market as it was when your order arrived, not when you sent it.'),
  F('partial_fills', 'off / on', 'A market order may fill less than it asked for. The filled size is <code>position.margin_usd</code>; the ratio is the <code>X-MP-Fill-Pct</code> header and the <code>fill</code> object on v2.'),
  F('min_fill_pct', '10 &ndash; 100', 'The worst ratio you can be handed. 40 means anywhere from 40% to 100% of what you asked for.'),
  F('reject_rate_pct', '0 &ndash; 50', 'This share of opens are refused <code>503 venue_rejected</code> on purpose. <b>A bot that cannot handle a refusal is not finished</b>, and this is the cheap place to find that out.'),
  '    <tr class="grp"><td colspan="3">The cost</td></tr>',
  F('taker_bps', '0 &ndash; 100', 'Your own per-side fee instead of a venue schedule. 5.5 = 0.055%. The leverage taper still applies, so no setting can make a round trip eat the whole stake.'),
  F('funding', 'on / off', 'Off, funding is never charged. <b>This is how you tell an execution edge from a carry edge</b> &mdash; a short held through positive funding may be profitable only because of the funding.'),
  F('funding_mult', '0 &ndash; 5', 'Scale the real 8-hourly rate.'),
  '    <tr class="grp"><td colspan="3">The liquidation</td></tr>',
  F('margin_venue', '10 venues', 'Whose published maintenance-margin rate decides where liquidation sits. Binance 0.40%, Bybit 0.50%, MEXC 0.10%, Kraken 0.60%, Hyperliquid 1.25%, Coinbase 1.33%. It moves <b>only</b> the liquidation price.'),
  F('margin_tiers', 'off / on', 'Maintenance margin rises with notional the way a risk-limit ladder does, so a large position is liquidated <b>sooner</b>. The whole ladder is published in <code>GET /v2/realism</code>.'),
  F('mmr_pct', '0.05 &ndash; 10', 'Your own maintenance margin, beating <code>margin_venue</code> and our default.'),
  '  </tbody></table></div>',
  '',
  '  <h3>What this does not model, stated rather than discovered</h3>',
  '  <p>A stop-loss, take-profit or liquidation fills <b>at its own level</b> and never pays the crossing cost: the server-side sweep runs over every account at once and cannot read a profile per pass. There is no order book with real depth behind the impact model &mdash; <code>impact_bps_per_100k</code> is a declared linear cost, not a simulated book. And the whole crossing cost on the exit is charged against the mark, which is one spread, not a bid and an ask you can quote separately. Everything else above is applied exactly as written.</p>',
  '  <p class="note">Every figure in this profile is readable back from <code>GET /api/bot/v2/sim</code>, including what a fill would look like right now &mdash; a number a bot cannot read back is a number it has to guess at. <code>GET /api/bot/v2/report</code> then tells you what execution actually cost: fees, funding, gross against net, and <code>kept_pct</code>, the share of the gross that survived. That one is free on every plan, because it is not a breakdown of where your edge is &mdash; it is whether the edge is real.</p>',
  '</section>',
  '',
].join(N);
sub('<section id="fees">', SIM + '<section id="fees">', 'the #sim section');

// and #realism points forward to it
sub(
  '  <p class="note">A position keeps the maintenance margin it was filled with, so turning this on never rewrites a trade you already hold',
  '  <p class="note"><b>These three are a subset.</b> <a href="#sim">The whole simulation is configurable</a> - the book size and whether it is a real budget, your own slippage and fee figures, size impact, latency, partial fills, refusals and funding - and eight presets set it in one call. A position keeps the maintenance margin it was filled with, so turning this on never rewrites a trade you already hold',
  'the realism section points at it'
);

// ───────────────────────────────────────────────────────────────────── guards
const bal = (s, tag) => (s.split('<' + tag).length - 1) === (s.split('</' + tag + '>').length - 1);
if (!bal(h, 'section')) { console.error('REFUSING: <section> tags no longer balance'); process.exit(1); }
if (!bal(h, 'table')) { console.error('REFUSING: <table> tags no longer balance'); process.exit(1); }
if ((h.split('id="sim"').length - 1) !== 1) { console.error('REFUSING: id="sim" is not unique'); process.exit(1); }
if ((h.split('id="akbGo"').length - 1) !== 1) { console.error('REFUSING: id="akbGo" is not unique'); process.exit(1); }
for (const id of ['akb', 'plans', 'quickstart', 'realism', 'fees', 'errors', 'stream', 'mcp', 'replay', 'books', 'arena', 'v2']) {
  if ((h.split('id="' + id + '"').length - 1) !== 1) { console.error('REFUSING: the existing anchor #' + id + ' is no longer unique - the worker, /premium/ and the error table all link into these'); process.exit(1); }
}
if (h.indexOf(N + '\n') >= 0 && N === '\r\n') { console.error('REFUSING: a bare LF was introduced into a CRLF file'); process.exit(1); }

console.log(did.map((d) => '  ok  ' + d).join('\n'));
console.log('  ' + before.length + ' -> ' + h.length + ' bytes (' + (h.length - before.length) + ')');
if (DRY) { console.log('\n--dry: nothing written'); process.exit(0); }
fs.writeFileSync(P, h);
console.log('\nfix-api-sim-section: written');
