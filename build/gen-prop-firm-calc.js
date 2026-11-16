/* /prop-firm-drawdown-calculator/ (2026-11-16, owner: "optimizuj SEO i marketing da se reklamiramo kao test platforma
   za funded naloge"). Measured first: Google showed marginpad.io for 3 prop/funded/challenge queries in 90 days, and
   /practice-for-a-funded-account/ took 8 impressions. The SERP for "prop firm drawdown calculator" is a row of small
   single-page clones (pages.dev, github.io); the challenge-simulator SERP is paid forex tools. Nobody free covers crypto.
   So: a working calculator a challenge trader actually uses (where is my floor today, how many losers can I take, how
   big can one position be), the one fact nobody selling challenges publishes (which rule ends most runs - measured on
   our own traders, live from /api/funded), and the way out to practising the rules free.
   Run: node build/gen-prop-firm-calc.js  then the post-processor chain (add-mpnav ... bump-home-assets). */
'use strict';
const fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const SLUG = 'prop-firm-drawdown-calculator';
const URL = 'https://marginpad.io/' + SLUG + '/';
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TITLE = 'Prop Firm Drawdown Calculator - Daily Loss, Trailing & Static Drawdown';
const DESC = 'Free prop firm drawdown calculator for crypto challenges: your daily loss floor, static or trailing max drawdown, how many losing trades you can take, and the position size that keeps one stop inside the rules. Then practise the challenge free on live prices.';

const FAQ = [
  ['What is trailing drawdown on a prop firm account?', 'Trailing drawdown is a loss limit measured from the highest equity your account has reached, not from where it started. On a $10,000 account with a 6% trailing drawdown the floor starts at $9,400; if you grow the account to $10,800 the floor moves up to $10,152. It never moves down, so profit you give back counts against you. Some firms stop the trail once it reaches the starting balance.'],
  ['What is the difference between static and trailing drawdown?', 'A static drawdown floor is fixed at the starting balance minus the limit and never moves. A trailing floor follows your peak equity upward. Static is more forgiving: once you are in profit you have more room than you started with. Trailing means a winning streak raises the bar you must stay above.'],
  ['How is the daily loss limit calculated?', 'Most firms take the balance (or equity) at the start of the trading day and subtract the daily percentage of the starting account size. On crypto challenges the day usually resets at 00:00 UTC, because the market never closes - check your firm, some use their server time. Open losses usually count, so a position sitting in a drawdown can break the rule before you close it.'],
  ['Does unrealised loss count toward the drawdown?', 'At most firms yes: the limit is checked against equity, which includes the open profit and loss of positions you are still holding. That is why a stop loss matters more on a challenge than anywhere else - a trade you intend to hold through a dip can end the account while it is still open.'],
  ['How much should I risk per trade on a prop firm challenge?', 'Size from the tightest limit, which is almost always the daily loss. A common rule is that one full stop loss should never cost more than a third to a half of the daily limit, so two losers in a row still leave you trading tomorrow. On a 4% daily limit that is roughly 1-2% of the account per trade. The calculator above does that arithmetic for your stop distance.'],
  ['Which rule fails the most prop firm challenges?', 'Measured on our own traders, the daily loss limit ends far more runs than the overall drawdown, and the profit target is rarely the problem. It resets every day and ignores how far ahead you were, so one bad session sized to win back a loss is enough. The live count is on this page and at /api/funded.'],
];

async function liveFunded() {
  try { const r = await fetch('https://marginpad.io/api/funded'); if (!r.ok) return null; return await r.json(); } catch (e) { return null; }
}

(async () => {
  const f = await liveFunded();
  const b = (f && f.breakdown) || {};
  const decided = f ? +f.runs_decided || 0 : 0;
  // the build-time sentence a crawler reads; the page script refreshes it from /api/funded on every visit
  const seen = f && decided >= 20
    ? `Measured on MarginPad traders this season (${esc(f.season.from)} to ${esc(f.season.to)}), scored against a one-step rule set: of <b>${decided}</b> decided runs, <b>${b.failed_daily_loss || 0}</b> ended on the daily loss limit, <b>${b.failed_max_drawdown || 0}</b> on the maximum drawdown and <b>${b.pass || 0}</b> passed.`
    : 'Measured on MarginPad traders every season: the daily loss limit ends more challenge runs than the maximum drawdown does.';

  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Prop Firm Drawdown Calculator', applicationCategory: 'FinanceApplication', operatingSystem: 'Web', url: URL, description: DESC, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'All tools', item: 'https://marginpad.io/tools/' }, { '@type': 'ListItem', position: 2, name: 'Prop Firm Drawdown Calculator', item: URL }] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(q => ({ '@type': 'Question', name: q[0], acceptedAnswer: { '@type': 'Answer', text: q[1] } })) },
  ].map(o => '<script type="application/ld+json">\n' + JSON.stringify(o) + '\n</script>').join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />${GTAG}
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<meta name="theme-color" content="#08090b" />
<title>${esc(TITLE)} | MarginPad</title>
<meta name="description" content="${esc(DESC)}" />
<meta name="keywords" content="prop firm drawdown calculator, trailing drawdown calculator, daily loss limit calculator, prop firm challenge calculator, funded account calculator, crypto prop firm, prop firm position size calculator" />
<link rel="canonical" href="${URL}" />
<link rel="alternate" hreflang="en" href="${URL}" />
<link rel="alternate" hreflang="x-default" href="${URL}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${URL}" />
<meta property="og:title" content="${esc(TITLE)} | MarginPad" />
<meta property="og:description" content="${esc(DESC)}" />
<meta property="og:site_name" content="MarginPad" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(TITLE)} | MarginPad" />
<meta name="twitter:description" content="${esc(DESC)}" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="stylesheet" href="/assets/lab.css" />
<style>
  .pf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:6px}
  .pf-grid label.f{display:flex;flex-direction:column;gap:5px}
  .pf-grid input,.pf-grid select{width:100%;box-sizing:border-box}
  .presets{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 12px}
  .presets button{font-family:'Space Mono',monospace;font-size:12px;padding:7px 11px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink2);cursor:pointer}
  .presets button.on{border-color:var(--lime);color:var(--lime)}
  .bar{position:relative;height:16px;border-radius:8px;background:#0f1318;border:1px solid var(--line);margin:14px 0 8px;overflow:hidden}
  .bar i{position:absolute;top:0;bottom:0}
  .bar .safe{background:linear-gradient(90deg,rgba(255,98,88,.35),rgba(194,246,74,.25))}
  .bar .now{width:3px;background:#fff}
  .barl{display:flex;justify-content:space-between;font-family:'Space Mono',monospace;font-size:11px;color:var(--ink3)}
  .verdict{font-size:13.5px;color:var(--ink2);line-height:1.65;margin-top:16px;background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);border-left:3px solid var(--lime);border-radius:12px;padding:14px 16px}
  .verdict.warn{border-left-color:var(--red)}
  .seen{font-size:13.5px;color:var(--ink2);line-height:1.65;margin:18px 0 0;padding:12px 15px;border:1px dashed var(--line);border-radius:12px}
  .cta{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0 4px}
  .cta a{flex:1;min-width:200px;text-align:center;text-decoration:none;font-family:'Space Mono',monospace;font-weight:700;font-size:13.5px;padding:13px 14px;border-radius:11px;border:1px solid var(--line);color:var(--ink);background:var(--panel)}
  .cta a.go{background:var(--lime);color:#0a0b0d;border-color:var(--lime)}
  .content{max-width:760px;margin-top:8px}
  .content p{color:var(--ink2);font-size:14.5px;line-height:1.7;margin:0 0 14px}
  .faq{margin-top:10px}
  .faq details{border:1px solid var(--line);border-radius:12px;background:linear-gradient(180deg,var(--panel),var(--bg2));margin-bottom:10px;overflow:hidden}
  .faq summary{cursor:pointer;padding:15px 18px;font-weight:700;font-size:15px;color:var(--ink);list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px}
  .faq summary::-webkit-details-marker{display:none}
  .faq summary::after{content:'+';color:var(--cyan);font-family:'Space Mono',monospace;font-size:18px;font-weight:700}
  .faq details[open] summary::after{content:'\\2212'}
  .faq details[open] summary{border-bottom:1px solid var(--line)}
  .faq .a{padding:14px 18px 17px;color:var(--ink2);font-size:14px;line-height:1.7}
</style>
${ld}
</head>
<body>
<header class="topbar"><a class="brand" href="/">MARGIN<b>PAD</b></a><nav class="tool-switch"><a href="/tools/">All tools</a><a href="/strategies/">Backtester</a><a href="/trading-journal/">Journal</a><a href="/risk-of-ruin-calculator/">Risk</a><a href="/${SLUG}/" class="on">Prop firm</a><a href="/practice-for-a-funded-account/">Funded practice</a></nav><a class="home" href="/">&larr; marginpad.io</a></header>

<div class="wrap">
  <section class="hero">
    <span class="eyebrow">Prop firm challenge</span>
    <h1>Prop Firm Drawdown Calculator</h1>
    <p class="sub">Where your floor is today, how much room the rules leave you, how many losing trades in a row you can take, and the largest position one stop loss can afford - for static, trailing and end-of-day drawdown. Built for crypto challenges, where the day resets at 00:00 UTC.</p>
  </section>

  <div class="toolbar">
    <div class="presets" id="presets">
      <button type="button" data-p="one" class="on">One-step: 10% target, 4% daily, 6% trailing</button>
      <button type="button" data-p="two">Two-step: 8% target, 5% daily, 10% static</button>
      <button type="button" data-p="eod">10% target, 5% daily, 6% end-of-day trailing</button>
    </div>
    <div class="pf-grid">
      <label class="f">Account size $<input id="acct" type="number" value="10000" min="100" step="100"></label>
      <label class="f">Profit target %<input id="tgt" type="number" value="10" step="0.5" min="0"></label>
      <label class="f">Max daily loss %<input id="dll" type="number" value="4" step="0.5" min="0.1"></label>
      <label class="f">Max drawdown %<input id="mdd" type="number" value="6" step="0.5" min="0.1"></label>
      <label class="f">Drawdown type<select id="ddt"><option value="trail">Trailing (from peak equity)</option><option value="eod">Trailing end-of-day</option><option value="static">Static (from start)</option></select></label>
      <label class="f">Current equity $<input id="eq" type="number" value="10000" step="10"></label>
      <label class="f">Peak equity so far $<input id="peak" type="number" value="10000" step="10"></label>
      <label class="f">Equity at today's start $<input id="sod" type="number" value="10000" step="10"></label>
      <label class="f">Risk per trade %<input id="risk" type="number" value="1" step="0.25" min="0.05"></label>
      <label class="f">Stop distance %<input id="stop" type="number" value="1.5" step="0.1" min="0.01"></label>
      <label class="f">Leverage<input id="lev" type="number" value="10" step="1" min="1"></label>
    </div>
  </div>

  <div id="out">
    <h2>Where you stand</h2>
    <div class="kpis" id="kRoom"></div>
    <div class="bar" id="bar"><i class="safe" id="barSafe"></i><i class="now" id="barNow"></i></div>
    <div class="barl"><span id="blFloor">floor</span><span id="blTgt">target</span></div>
    <h2>Sizing inside the rules</h2>
    <div class="kpis" id="kSize"></div>
    <div class="verdict" id="verdict"></div>
  </div>

  <p class="seen" id="seen">${seen} <a href="/practice-for-a-funded-account/">How we measure it</a>.</p>

  <div class="cta">
    <a class="go" href="/paper-trade">Practise the challenge free on live prices</a>
    <a href="/practice-for-a-funded-account/">Our measured challenge pass rate</a>
    <a href="/risk-of-ruin-calculator/">Risk of ruin for your edge</a>
  </div>

  <section class="content">
    <h2>The three numbers that decide a challenge</h2>
    <p>Every prop firm evaluation comes down to a profit target and two loss limits. The <strong>profit target</strong> (commonly 8-10%) is what everybody watches, and it is rarely what ends a run. The <strong>maximum drawdown</strong> is your overall floor: static floors sit at the starting balance minus the limit and never move, while trailing floors follow your highest equity upward, so profit you give back counts against you. The <strong>daily loss limit</strong> is the one that does the damage. It resets every day from that day's opening equity, it ignores how far ahead you are, and on most firms it counts open losses too - one session sized to win back a loss is enough.</p>
    <p>That is why sizing has to start from the tightest limit, not from the target. If a single stop loss costs half your daily room, two losers in a row end the day and a third ends the account. Put your own numbers in above: the calculator shows the floor that binds right now, how many full-size losers in a row you can absorb before breaking it, and the position size that keeps one stop inside your chosen risk.</p>
    <p>Crypto challenges have one more wrinkle. The market never closes, so "the day" is a clock, usually 00:00 UTC, and a position held across it carries its open loss into tomorrow's starting equity. Know your firm's reset time before you hold anything overnight.</p>
    <h2>Practise the rules before you pay for them</h2>
    <p>A challenge costs anywhere from about $50 to $1,000, and most attempts end on the daily limit inside the first week. On <a href="/paper-trade">MarginPad Paper Trade</a> you can run the same rules for free on live crypto prices with fees, funding and liquidation simulated server-side - set your daily loss and drawdown numbers, trade a full challenge's worth of days, and only pay a firm once you can reach the target without touching the limits, more than once.</p>
  </section>

  <section class="content faq">
    <h2>FAQ</h2>
${FAQ.map(q => `    <details>\n      <summary>${esc(q[0])}</summary>\n      <div class="a">${esc(q[1])}</div>\n    </details>`).join('\n')}
  </section>
</div>

<div class="wrap" style="padding-bottom:0">
<footer class="toolfoot"><div class="cols"><div><a class="brand" href="/" style="font-size:18px">MARGIN<b>PAD</b></a><p class="blurb">Free crypto futures tools - calculators, a live charts workspace, a paper-trading terminal and a real-time liquidation feed. No signup.</p></div><div><h4>Tools</h4><a href="/strategies/">Strategy Backtester</a><a href="/trading-journal/">Trading Journal</a><a href="/risk-of-ruin-calculator/">Risk of Ruin</a><a href="/${SLUG}/">Prop Firm Drawdown</a><a href="/practice-for-a-funded-account/">Funded Account Practice</a></div><div><h4>MarginPad</h4><a href="/paper-trade">Paper Trade</a><a href="/charts">Charts</a><a href="/calculators">Calculators</a><a href="/screener">Screener</a><a href="/rekt/">Liquidations</a></div></div><div class="bottom">&copy; 2026 MarginPad &middot; Free crypto trading tools &middot; Not financial advice</div></footer>
</div>

<script>
(function(){
  var $=function(id){return document.getElementById(id);};
  var P={one:{tgt:10,dll:4,mdd:6,ddt:'trail'},two:{tgt:8,dll:5,mdd:10,ddt:'static'},eod:{tgt:10,dll:5,mdd:6,ddt:'eod'}};
  function money(v){var s=Math.abs(v).toLocaleString('en-US',{maximumFractionDigits:0});return (v<0?'-$':'$')+s;}
  function kpi(v,l,cls){return '<div class="kpi"><div class="v '+(cls||'')+'">'+v+'</div><div class="l">'+l+'</div></div>';}
  function num(id,d){var v=parseFloat($(id).value);return isFinite(v)?v:d;}
  function run(){
    var A=Math.max(1,num('acct',10000)),tgt=num('tgt',10)/100,dll=num('dll',4)/100,mdd=num('mdd',6)/100,ddt=$('ddt').value;
    var eq=num('eq',A),peak=Math.max(num('peak',A),A),sod=num('sod',A),risk=num('risk',1)/100,stop=Math.max(0.0001,num('stop',1.5)/100),lev=Math.max(1,num('lev',10));
    // the overall floor: static from the start, trailing from the peak (end-of-day trails the closing peak - the same number
    // here, because you enter the peak you have reached; intraday it does not move until the day closes)
    var ddFloor=ddt==='static'?A*(1-mdd):peak-A*mdd;
    var dayFloor=sod-A*dll;
    var floor=Math.max(ddFloor,dayFloor), binds=dayFloor>=ddFloor?'daily loss limit':'maximum drawdown';
    var room=eq-floor, target=A*(1+tgt), toGo=target-eq;
    var riskUsd=A*risk, losers=riskUsd>0?Math.floor(room/riskUsd):0;
    var notional=riskUsd/stop, margin=notional/lev;
    var half=Math.max(0,room/2), safeRisk=Math.min(riskUsd,half);
    $('kRoom').innerHTML=kpi(money(floor),'Floor that binds now ('+binds+')',room>0?'':'neg')
      +kpi(money(room),'Room before a rule breaks',room>A*0.01?'pos':'neg')
      +kpi(money(dayFloor),'Daily loss floor today','')
      +kpi(money(ddFloor),(ddt==='static'?'Static':'Trailing')+' drawdown floor','')
      +kpi(toGo>0?money(toGo):'Reached','To the profit target',toGo>0?'':'pos');
    $('kSize').innerHTML=kpi(money(riskUsd),'One full stop at '+(risk*100).toFixed(2)+'% risk','')
      +kpi(String(Math.max(0,losers)),'Losers in a row before the floor',losers>=3?'pos':'neg')
      +kpi(money(notional),'Position size for a '+(stop*100).toFixed(2)+'% stop','')
      +kpi(money(margin),'Margin at '+lev+'x','');
    var lo=Math.min(floor,eq)-A*0.01, hi=Math.max(target,eq)+A*0.01, span=hi-lo||1;
    var fx=(floor-lo)/span*100, nx=(eq-lo)/span*100, tx=(target-lo)/span*100;
    $('barSafe').style.left=fx+'%';$('barSafe').style.width=Math.max(0,tx-fx)+'%';$('barNow').style.left='calc('+nx+'% - 1px)';
    $('blFloor').textContent='floor '+money(floor);$('blTgt').textContent='target '+money(target);
    var v,warn=false;
    if(room<=0){v='Your equity is at or below the floor - under these rules the account has already failed.';warn=true;}
    else if(losers<2){v='One more full-size loss puts you at or past the '+binds+'. Cut risk per trade to about '+money(half)+' or less until you have room again.';warn=true;}
    else if(riskUsd>half){v='Two losers in a row would use more than your whole room. Risking about '+money(safeRisk)+' per trade keeps a second loss survivable.';warn=true;}
    else v='You can take '+losers+' full-size losses in a row before the '+binds+' breaks. Size each trade at '+money(notional)+' (about '+money(margin)+' margin at '+lev+'x) so one stop costs '+money(riskUsd)+'.';
    $('verdict').textContent=v;$('verdict').className='verdict'+(warn?' warn':'');
  }
  document.querySelectorAll('#presets button').forEach(function(b){b.addEventListener('click',function(){var p=P[b.getAttribute('data-p')];if(!p)return;$('tgt').value=p.tgt;$('dll').value=p.dll;$('mdd').value=p.mdd;$('ddt').value=p.ddt;document.querySelectorAll('#presets button').forEach(function(x){x.classList.toggle('on',x===b);});run();});});
  document.querySelectorAll('.pf-grid input,.pf-grid select').forEach(function(i){i.addEventListener('input',run);i.addEventListener('change',run);});
  run();
  // the measured line, live: which rule ended this season's runs (never printed under 20 decided runs)
  fetch('/api/funded').then(function(r){return r.json();}).then(function(f){
    if(!f||!f.breakdown||(+f.runs_decided||0)<20)return;var b=f.breakdown;
    $('seen').innerHTML='Measured on MarginPad traders this season ('+f.season.from+' to '+f.season.to+'), scored against a one-step rule set: of <b>'+f.runs_decided+'</b> decided runs, <b>'+(b.failed_daily_loss||0)+'</b> ended on the daily loss limit, <b>'+(b.failed_max_drawdown||0)+'</b> on the maximum drawdown and <b>'+(b.pass||0)+'</b> passed. <a href="/practice-for-a-funded-account/">How we measure it</a>.';
  }).catch(function(){});
})();
</script>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;
  fs.mkdirSync(path.join(DIST, SLUG), { recursive: true });
  fs.writeFileSync(path.join(DIST, SLUG, 'index.html'), html);
  console.log('wrote dist/' + SLUG + '/index.html (' + Math.round(html.length / 1024) + ' KB)' + (f ? ', live: ' + decided + ' decided runs' : ', no live data'));
})();
