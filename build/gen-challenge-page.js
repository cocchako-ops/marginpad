/* /prop-firm-challenge/ (2026-11-16, owner: "odradi sve ovo za funded vezbanje ... detaljno, bez bagova ... sa stilom i da izgleda lepo").
   The landing page AND the app of Challenge Mode: pick a rule set and an account size, then a live dashboard of the run the SERVER is
   scoring (handleChallenge / chalCompute in the worker), the member's history, the certificate of a passed run (?c=<id>), and the public
   board of passed challenges. Crawler-first: the rules, the explanation and the FAQ are static HTML; the script only fills the live parts.
   Run: node build/gen-challenge-page.js  then the post-processor chain (see CLAUDE.md, the prop-firm round). */
'use strict';
const fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const SLUG = 'prop-firm-challenge';
const URL = 'https://marginpad.io/' + SLUG + '/';
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TITLE = 'Crypto Prop Firm Challenge Simulator - Practice a Funded Account Free';
const DESC = 'Take a crypto prop firm challenge for free: one-step, two-step or end-of-day rules on a $5k-$100k account, scored by our server on live prices. Daily loss and drawdown are enforced like a real firm, and a pass earns a shareable certificate.';
// the three rule sets, written out for the crawler; the live page reads the same table from /api/challenge (CHAL_TYPES in the worker)
const TYPES = [
  { kind: 'one', name: 'One-step', rows: [['Profit target', '10%'], ['Daily loss limit', '4% of the account'], ['Max drawdown', '6%, trailing your highest closed balance'], ['Minimum trading days', '5'], ['Max leverage', '100x']] },
  { kind: 'two', name: 'Two-step', rows: [['Profit target', '8% in phase 1, then 5% in phase 2'], ['Daily loss limit', '5% of the account'], ['Max drawdown', '10%, static from the start'], ['Minimum trading days', '4 per phase'], ['Max leverage', '100x']] },
  { kind: 'eod', name: 'One-step EOD', rows: [['Profit target', '10%'], ['Daily loss limit', '5% of the account'], ['Max drawdown', '6%, trailing the highest end-of-day balance'], ['Minimum trading days', '5'], ['Max leverage', '50x']] },
];
const FAQ = [
  ['Is the MarginPad prop firm challenge free?', 'Yes. There is no fee, no deposit and no card. You start a challenge on your free MarginPad account, trade it on live crypto prices in the paper-trading terminal, and the server scores it against the rules. You can retry as often as you like.'],
  ['Do I get funded if I pass?', 'No - MarginPad does not fund traders and sells no challenges. A pass earns a certificate you can share and proves to yourself that you can hit a target without breaking the limits. Take that to a real prop firm only once you can do it repeatedly.'],
  ['How is the daily loss limit measured?', 'From your closed balance at 00:00 UTC. Your equity - balance plus the open profit and loss of your challenge positions - may not fall more than the daily limit, as a percentage of the account size, below it. Closed trades are checked the moment they close; open losses are checked every ten minutes and whenever you open the challenge.'],
  ['What counts as a challenge trade?', 'Every position you open in the MarginPad terminal (or through the Bot API) after the challenge starts. Positions you held before starting are ignored. Leverage above the rule set and margin above your free challenge balance are refused, as a real firm would refuse them.'],
  ['What is the difference between the three rule sets?', 'One-step asks for 10% with a 4% daily limit and a 6% drawdown that trails your highest closed balance. Two-step splits the target into 8% and then 5% with a looser, static 10% drawdown. One-step EOD trails the drawdown from the highest end-of-day balance and caps leverage at 50x. Most real crypto prop firms use one of these shapes.'],
  ['Which rule fails the most challenges?', 'The daily loss limit. Measured on our own traders, it ends far more runs than the overall drawdown, because it resets every day and ignores how far ahead you were. Size every trade so two full stops in a row still leave you trading tomorrow.'],
];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />${GTAG}
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<meta name="theme-color" content="#08090b" />
<title>${esc(TITLE)} | MarginPad</title>
<meta name="description" content="${esc(DESC)}" />
<meta name="keywords" content="crypto prop firm challenge, prop firm challenge simulator, funded account practice, free prop firm challenge, crypto funded trader, prop firm evaluation practice, pass prop firm challenge" />
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
  .cx-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0 6px}
  .cx-stat{padding:13px 15px;border:1px solid var(--line);border-radius:13px;background:linear-gradient(180deg,var(--panel),var(--bg2))}
  .cx-stat b{display:block;font-family:'Bricolage Grotesque',sans-serif;font-size:26px;font-weight:800;color:var(--ink);letter-spacing:-.02em}
  .cx-stat span{font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3)}
  .cx-app{margin:22px 0 8px;padding:20px;border:1px solid var(--line);border-radius:18px;background:radial-gradient(90% 60% at 100% 0,rgba(194,246,74,.07),transparent 60%),var(--panel)}
  .cx-app[data-state="loading"]{min-height:260px}
  .cx-types{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  .cx-type{position:relative;text-align:left;padding:15px 15px 13px;border:1px solid var(--line);border-radius:14px;background:var(--bg2);color:var(--ink2);cursor:pointer;font:inherit;transition:border-color .15s,transform .12s,background .15s}
  .cx-type:active{transform:scale(.99)}
  .cx-type.on{border-color:var(--lime);background:rgba(194,246,74,.06)}
  .cx-type h3{margin:0 0 9px;font-family:'Bricolage Grotesque',sans-serif;font-size:18px;color:var(--ink)}
  .cx-type dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:5px 10px;font-size:12.5px}
  .cx-type dt{color:var(--ink3)}.cx-type dd{margin:0;color:var(--ink2);text-align:right;font-family:'Space Mono',monospace;font-size:11.5px}
  .cx-type .tick{position:absolute;top:13px;right:13px;width:18px;height:18px;border-radius:50%;border:1px solid var(--line);display:flex;align-items:center;justify-content:center}
  .cx-type.on .tick{background:var(--lime);border-color:var(--lime)}
  .cx-type.on .tick::after{content:'';width:5px;height:9px;border:solid #0a0b0d;border-width:0 2px 2px 0;transform:rotate(45deg) translate(-1px,-1px)}
  .cx-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:16px}
  .cx-lbl{font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);margin-right:4px}
  .cx-chip{height:34px;padding:0 13px;border:1px solid var(--line);border-radius:10px;background:var(--bg2);color:var(--ink2);font-family:'Space Mono',monospace;font-size:12.5px;cursor:pointer;transition:border-color .13s,color .13s}
  .cx-chip.on{border-color:var(--lime);color:var(--lime);background:rgba(194,246,74,.07)}
  .cx-go{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 22px;border:0;border-radius:13px;background:var(--lime);color:#0a0b0d;font-family:'Space Mono',monospace;font-weight:700;font-size:14px;cursor:pointer;text-decoration:none;transition:filter .15s,transform .12s}
  .cx-go:active{transform:scale(.98)}.cx-go:disabled{filter:grayscale(.6) brightness(.8)}
  .cx-ghost{display:inline-flex;align-items:center;height:46px;padding:0 18px;border:1px solid var(--line);border-radius:13px;background:transparent;color:var(--ink2);font-family:'Space Mono',monospace;font-size:12.5px;cursor:pointer;text-decoration:none}
  .cx-start{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:20px}
  .cx-fine{font-size:12.5px;color:var(--ink3);line-height:1.5}
  .cx-dash{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:20px}
  .cx-eqk{font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3)}
  .cx-eq{font-family:'Bricolage Grotesque',sans-serif;font-size:46px;font-weight:800;letter-spacing:-.03em;color:var(--ink);line-height:1.05;margin:4px 0 2px}
  .cx-ret{font-family:'Space Mono',monospace;font-size:13px}.cx-ret.up{color:var(--green,#2ebd85)}.cx-ret.dn{color:var(--red)}
  .cx-badge{display:inline-flex;align-items:center;gap:7px;height:24px;padding:0 10px;border-radius:99px;border:1px solid rgba(194,246,74,.4);color:var(--lime);font-family:'Space Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
  .cx-badge i{width:7px;height:7px;border-radius:50%;background:var(--lime);box-shadow:0 0 8px var(--lime)}
  .cx-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:16px}
  .cx-cell{padding:10px 12px;border:1px solid var(--line);border-radius:11px;background:var(--bg2)}
  .cx-cell b{display:block;font-family:'Space Mono',monospace;font-size:14px;color:var(--ink)}.cx-cell span{font-size:11px;color:var(--ink3)}
  .cx-m{margin-bottom:15px}
  .cx-mh{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:13.5px;color:var(--ink2)}
  .cx-mh b{font-family:'Space Mono',monospace;font-size:12.5px;color:var(--ink)}.cx-mh b.warn{color:#ffb020}.cx-mh b.bad{color:var(--red)}.cx-mh b.tgt{color:var(--lime)}
  .cx-bar{height:9px;margin-top:7px;border-radius:99px;background:#161b22;overflow:hidden}
  .cx-bar i{display:block;height:100%;border-radius:99px;background:#2ebd85;transition:width .6s cubic-bezier(.2,.8,.2,1)}.cx-bar i.warn{background:#ffb020}.cx-bar i.bad{background:var(--red)}.cx-bar i.tgt{background:linear-gradient(90deg,#8fc23a,#c2f64a)}
  .cx-ms{margin-top:5px;font-family:'Space Mono',monospace;font-size:10.5px;color:var(--ink3)}
  .cx-acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
  .cx-cert{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:20px;align-items:center}
  .cx-cert img{width:100%;height:auto;border-radius:14px;border:1px solid var(--line);display:block}
  .cx-partner{margin-top:14px;padding:13px 15px;border:1px dashed rgba(194,246,74,.4);border-radius:13px;font-size:13px;color:var(--ink2);line-height:1.55}
  .cx-partner a{color:var(--lime);font-weight:700}
  .cx-hist{margin-top:22px}.cx-hist h3{font-size:15px;margin:0 0 8px}
  .tblw{overflow-x:auto;border:1px solid var(--line);border-radius:13px}
  table.cx-t{width:100%;border-collapse:collapse;font-size:13px;min-width:560px}
  .cx-t th{text-align:left;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);font-weight:700;padding:10px 12px;border-bottom:1px solid var(--line)}
  .cx-t td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04);color:var(--ink2)}.cx-t tr:last-child td{border-bottom:0}
  .cx-t td.n{font-family:'Space Mono',monospace;font-size:12px;color:var(--ink)}
  .cx-st{font-family:'Space Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.cx-st.passed{color:var(--lime)}.cx-st.failed{color:var(--red)}.cx-st.abandoned{color:var(--ink3)}.cx-st.active{color:#46e0e6}
  .cx-empty{padding:18px;text-align:center;color:var(--ink3);font-size:13px}
  .cx-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:12px 0}
  .cx-step{padding:15px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}
  .cx-step b{display:block;font-family:'Space Mono',monospace;color:var(--lime);font-size:12px;margin-bottom:6px}
  .cx-step p{margin:0;font-size:13.5px;line-height:1.6;color:var(--ink2)}
  .content{max-width:780px;margin-top:8px}
  .content p{color:var(--ink2);font-size:14.5px;line-height:1.7;margin:0 0 14px}
  .faq{margin-top:10px}
  .faq details{border:1px solid var(--line);border-radius:12px;background:linear-gradient(180deg,var(--panel),var(--bg2));margin-bottom:10px;overflow:hidden}
  .faq summary{cursor:pointer;padding:15px 18px;font-weight:700;font-size:15px;color:var(--ink);list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px}
  .faq summary::-webkit-details-marker{display:none}
  .faq summary::after{content:'+';color:var(--cyan);font-family:'Space Mono',monospace;font-size:18px;font-weight:700}
  .faq details[open] summary::after{content:'\\2212'}
  .faq details[open] summary{border-bottom:1px solid var(--line)}
  .faq .a{padding:14px 18px 17px;color:var(--ink2);font-size:14px;line-height:1.7}
  .cta{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 4px}
  .cta a{flex:1;min-width:200px;text-align:center;text-decoration:none;font-family:'Space Mono',monospace;font-weight:700;font-size:13px;padding:13px 14px;border-radius:11px;border:1px solid var(--line);color:var(--ink);background:var(--panel)}
  @media(max-width:760px){.cx-types,.cx-steps{grid-template-columns:1fr}.cx-dash,.cx-cert{grid-template-columns:1fr}.cx-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cx-eq{font-size:38px}.cx-app{padding:15px}.cx-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.cx-stat b{font-size:21px}}
</style>
<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Crypto Prop Firm Challenge Simulator', applicationCategory: 'FinanceApplication', operatingSystem: 'Web', url: URL, description: DESC, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } })}
</script>
<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(q => ({ '@type': 'Question', name: q[0], acceptedAnswer: { '@type': 'Answer', text: q[1] } })) })}
</script>
</head>
<body>
<header class="topbar"><a class="brand" href="/">MARGIN<b>PAD</b></a><nav class="tool-switch"><a href="/tools/">All tools</a><a href="/${SLUG}/" class="on">Challenge</a><a href="/prop-firm-drawdown-calculator/">Drawdown</a><a href="/crypto-prop-firms/">Prop firms</a><a href="/practice-for-a-funded-account/">Pass rate</a></nav><a class="home" href="/">&larr; marginpad.io</a></header>

<div class="wrap">
  <section class="hero">
    <span class="eyebrow">Free prop firm challenge</span>
    <h1>Crypto Prop Firm Challenge Simulator</h1>
    <p class="sub">Take a funded-account evaluation for free before you pay for one. Pick a rule set and an account size, trade it in the MarginPad terminal on live crypto prices, and our server enforces the daily loss limit, the drawdown and the target exactly as a prop firm would. Pass it and you get a certificate you can share.</p>
  </section>

  <div class="cx-stats" id="cxStats">
    <div class="cx-stat"><b id="sPass">-</b><span>Challenges passed</span></div>
    <div class="cx-stat"><b id="sDaily">-</b><span>Ended on daily loss</span></div>
    <div class="cx-stat"><b id="sDd">-</b><span>Ended on drawdown</span></div>
  </div>

  <section class="cx-app" id="cxApp" data-state="loading" aria-live="polite">
    <div class="cx-types" id="cxTypes">
${TYPES.map((t, i) => `      <button type="button" class="cx-type${i === 0 ? ' on' : ''}" data-kind="${t.kind}"><span class="tick"></span><h3>${t.name}</h3><dl>${t.rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl></button>`).join('\n')}
    </div>
    <div class="cx-row"><span class="cx-lbl">Account size</span>${[5000, 10000, 25000, 50000, 100000].map(b => `<button type="button" class="cx-chip${b === 10000 ? ' on' : ''}" data-book="${b}">$${b / 1000}k</button>`).join('')}</div>
    <div class="cx-start"><button type="button" class="cx-go" id="cxGo" data-auth-open>Sign in to start - free</button><span class="cx-fine">No fee, no card, no deposit. Retry as often as you like.</span></div>
  </section>

  <section class="content" id="board">
    <h2>Passed challenges</h2>
    <p>Every challenge passed on MarginPad, newest first. Each one was scored by our server on live prices, rule by rule, from the moment it started.</p>
    <div class="tblw"><table class="cx-t"><thead><tr><th>Trader</th><th>Rule set</th><th>Account</th><th>Return</th><th>Max DD</th><th>Days</th><th>Passed</th></tr></thead><tbody id="cxBoard"><tr><td colspan="7" class="cx-empty">Loading the board&hellip;</td></tr></tbody></table></div>
  </section>

  <section class="content">
    <h2>How it works</h2>
    <div class="cx-steps">
      <div class="cx-step"><b>01 / Pick the rules</b><p>One-step, two-step or end-of-day trailing, on a $5,000 to $100,000 account - the three shapes most crypto prop firms sell.</p></div>
      <div class="cx-step"><b>02 / Trade the terminal</b><p>Every position you open in the <a href="/paper-trade">paper trading terminal</a> from now on counts, with real fees and funding. Leverage above the rule and margin above your free balance are refused.</p></div>
      <div class="cx-step"><b>03 / Pass or learn</b><p>Hit the target on closed trades with the minimum trading days and no rule broken, and the run is certified. Break a rule and the run ends at that moment - start another one.</p></div>
    </div>
    <h2>The rules, exactly as we score them</h2>
    <p><strong>What counts.</strong> Every server-filled position you open after the challenge starts. Positions you already held are ignored, so a challenge always starts clean. Partial closes count when they close.</p>
    <p><strong>Daily loss.</strong> Measured from your closed balance at 00:00 UTC: your equity - closed balance plus the open profit and loss of your challenge positions - may not fall further below it than the daily limit, taken as a percentage of the account size. It resets every day and does not care how far ahead you were.</p>
    <p><strong>Maximum drawdown.</strong> Static sits at the account size minus the limit and never moves. Trailing rises with your highest closed balance. End-of-day trailing rises with your highest balance at the close of a UTC day. None of them ever move down.</p>
    <p><strong>When it is checked.</strong> Every close is checked the moment it lands. Open losses are checked every ten minutes and whenever you open the challenge in the terminal or here. A breach ends the run on the spot - a later recovery does not undo it, exactly as at a firm.</p>
    <p><strong>Passing.</strong> Your closed balance reaches the target and you have traded on at least the minimum number of days (a day with a challenge trade opened or closed). Two-step runs phase 2 from a fresh balance. A pass earns a certificate and 100 XP.</p>
    <div class="cta">
      <a href="/prop-firm-drawdown-calculator/">Prop firm drawdown calculator</a>
      <a href="/crypto-prop-firms/">Compare crypto prop firms</a>
      <a href="/academy/?lesson=pf1">Free course: passing a challenge</a>
    </div>
  </section>

  <section class="content faq">
    <h2>FAQ</h2>
${FAQ.map(q => `    <details>\n      <summary>${esc(q[0])}</summary>\n      <div class="a">${esc(q[1])}</div>\n    </details>`).join('\n')}
  </section>
</div>

<div class="wrap" style="padding-bottom:0">
<footer class="toolfoot"><div class="cols"><div><a class="brand" href="/" style="font-size:18px">MARGIN<b>PAD</b></a><p class="blurb">Free crypto futures tools - calculators, a live charts workspace, a paper-trading terminal and a real-time liquidation feed. No signup.</p></div><div><h4>Funded practice</h4><a href="/${SLUG}/">Prop Firm Challenge</a><a href="/prop-firm-drawdown-calculator/">Drawdown Calculator</a><a href="/crypto-prop-firms/">Crypto Prop Firms</a><a href="/practice-for-a-funded-account/">Our Pass Rate</a></div><div><h4>MarginPad</h4><a href="/paper-trade">Paper Trade</a><a href="/charts">Charts</a><a href="/calculators">Calculators</a><a href="/screener">Screener</a><a href="/rekt/">Liquidations</a></div></div><div class="bottom">&copy; 2026 MarginPad &middot; Free crypto trading tools &middot; Not financial advice</div></footer>
</div>

<script>
(function(){
  var $=function(id){return document.getElementById(id);};
  var app=$('cxApp'), S=null, pick={kind:'one',book:10000}, armed=0, busy=false, poll=0;
  var qs=new URLSearchParams(location.search), certId=(qs.get('c')||'').replace(/[^a-z0-9]/g,'');
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function money(v){v=+v||0;return (v<0?'-$':'$')+Math.abs(v).toLocaleString('en-US',{maximumFractionDigits:Math.abs(v)<100?2:0});}
  function pct(v){v=+v||0;return (v>=0?'+':'')+v.toFixed(2)+'%';}
  function day(ts){return ts?new Date(+ts).toISOString().slice(0,10):'';}
  function cls(room,full){var f=room/Math.max(1,full);return f>0.55?'ok':f>0.25?'warn':'bad';}
  function bar(label,val,frac,c,sub){frac=Math.max(0,Math.min(1,+frac||0));return '<div class="cx-m"><div class="cx-mh"><span>'+label+'</span><b class="'+(c||'')+'">'+val+'</b></div><div class="cx-bar"><i class="'+(c||'')+'" style="width:'+(frac*100).toFixed(1)+'%"></i></div>'+(sub?'<div class="cx-ms">'+sub+'</div>':'')+'</div>';}
  function wireChoice(){
    app.querySelectorAll('[data-kind]').forEach(function(b){b.addEventListener('click',function(){pick.kind=b.getAttribute('data-kind');app.querySelectorAll('[data-kind]').forEach(function(x){x.classList.toggle('on',x===b);});});});
    app.querySelectorAll('[data-book]').forEach(function(b){b.addEventListener('click',function(){pick.book=+b.getAttribute('data-book');app.querySelectorAll('[data-book]').forEach(function(x){x.classList.toggle('on',x===b);});});});
  }
  function choiceHtml(signed){
    var t=(S&&S.types)||[], h=S&&S.history&&S.history[0], last='';
    if(h&&h.status==='failed'&&Date.now()-(+h.ended||0)<7*864e5)last='<p class="cx-fine" style="margin:0 0 14px">Your last run ('+esc(h.name)+' '+money(h.book)+') ended on '+(h.reason==='fail_daily'?'the daily loss limit':'the maximum drawdown')+' at '+pct(h.result&&h.result.returnPct)+'. Every run is practice - pick the rules and go again.</p>';
    var tp=document.getElementById('cxTypes');
    return last+(tp?tp.outerHTML:'')+'<div class="cx-row"><span class="cx-lbl">Account size</span>'+((S&&S.books)||[5000,10000,25000,50000,100000]).map(function(b){return '<button type="button" class="cx-chip'+(b===pick.book?' on':'')+'" data-book="'+b+'">$'+(b/1000)+'k</button>';}).join('')+'</div>'
      +'<div class="cx-start">'+(signed?'<button type="button" class="cx-go" id="cxGo">Start the challenge</button>':'<button type="button" class="cx-go" id="cxGo" data-auth-open>Sign in to start - free</button>')+'<span class="cx-fine">No fee, no card, no deposit. Retry as often as you like.</span></div>';
  }
  function dashHtml(){
    var a=S.active,e=S.eval,book=+e.book;
    var dRoom=Math.max(0,e.equity-e.dailyFloor),dFull=book*a.daily/100,ddRoom=Math.max(0,e.equity-e.ddFloor),ddFull=book*a.dd/100,tFull=book*e.target/100,tDone=Math.max(0,Math.min(tFull,e.balance-book));
    var ddName=a.ddtype==='static'?'static':a.ddtype==='eod'?'end-of-day trailing':'trailing';
    return '<div class="cx-dash"><div>'
      +'<span class="cx-badge"><i></i>Challenge running</span>'
      +'<div class="cx-eqk" style="margin-top:14px">'+esc(a.name)+' &middot; '+money(book)+(e.phases>1?' &middot; phase '+e.phase+' of '+e.phases:'')+' &middot; equity</div>'
      +'<div class="cx-eq">'+money(e.equity)+'</div><div class="cx-ret '+(e.equity>=book?'up':'dn')+'">'+pct((e.equity-book)/book*100)+(e.open?' &middot; '+e.open+' open ('+(e.unreal>=0?'+':'')+money(e.unreal)+')':'')+'</div>'
      +'<div class="cx-grid"><div class="cx-cell"><b>'+money(e.balance)+'</b><span>Closed balance</span></div><div class="cx-cell"><b>'+e.days+' / '+e.minDays+'</b><span>Trading days</span></div><div class="cx-cell"><b>'+e.closes+'</b><span>Closed trades</span></div>'
      +'<div class="cx-cell"><b>'+money(e.freeMargin)+'</b><span>Free margin</span></div><div class="cx-cell"><b>'+a.maxlev+'x</b><span>Max leverage</span></div><div class="cx-cell"><b>'+day(a.started)+'</b><span>Started</span></div></div>'
      +'<div class="cx-acts"><a class="cx-go" href="/paper-trade">Trade it in the terminal</a><button type="button" class="cx-ghost" id="cxQuit">'+(armed&&Date.now()-armed<5000?'Tap again to end it':'End challenge')+'</button></div>'
      +'</div><div>'
      +bar('Daily loss room',money(dRoom)+' of '+money(dFull),dRoom/Math.max(1,dFull),cls(dRoom,dFull),'Floor today '+money(e.dailyFloor)+' &middot; resets 00:00 UTC')
      +bar('Drawdown room ('+ddName+')',money(ddRoom)+' of '+money(ddFull),ddRoom/Math.max(1,ddFull),cls(ddRoom,ddFull),'Floor '+money(e.ddFloor)+' &middot; highest closed balance '+money(e.peak))
      +bar('Profit target '+e.target+'%',money(tDone)+' of '+money(tFull),tDone/Math.max(1,tFull),'tgt',e.toGo>0?money(e.toGo)+' to go on closed trades':'Target reached - keep going until you have '+e.minDays+' trading days')
      +'<p class="cx-fine">Closes are checked the moment they land; open losses every ten minutes and whenever you look. Worst day so far '+(+e.worstDayPct||0).toFixed(2)+'% &middot; max drawdown '+(+e.maxDdPct||0).toFixed(2)+'%.</p>'
      +(a.phase1?'<p class="cx-fine">Phase 1 passed '+day(a.phase1.passed)+' at '+pct(a.phase1.returnPct)+'.</p>':'')
      +'</div></div>';
  }
  function histHtml(){
    var h=(S&&S.history)||[]; if(!h.length)return '';
    return '<div class="cx-hist"><h3>Your challenges</h3><div class="tblw"><table class="cx-t"><thead><tr><th>Rule set</th><th>Account</th><th>Result</th><th>Return</th><th>Days</th><th>Started</th><th></th></tr></thead><tbody>'
      +h.map(function(x){var r=x.result||{};var res=x.status==='failed'?(x.reason==='fail_daily'?'Daily loss':'Drawdown'):x.status;return '<tr><td>'+esc(x.name)+'</td><td class="n">'+money(x.book)+'</td><td><span class="cx-st '+esc(x.status)+'">'+esc(res)+'</span></td><td class="n">'+(x.status==='active'?'-':pct(r.returnPct))+'</td><td class="n">'+(x.status==='active'?'-':(r.days||0))+'</td><td class="n">'+day(x.started)+'</td><td>'+(x.status==='passed'?'<a href="?c='+esc(x.id)+'" style="color:var(--lime)">Certificate</a>':'')+'</td></tr>';}).join('')
      +'</tbody></table></div></div>';
  }
  function render(){
    if(!S){return;}
    app.setAttribute('data-state',S.active?'active':'choose');
    app.innerHTML=(S.active&&S.eval?dashHtml():choiceHtml(S.signedIn))+(S.signedIn?histHtml():'');
    wireChoice();
    var go=$('cxGo'); if(go&&S.signedIn)go.addEventListener('click',start);
    var q=$('cxQuit'); if(q)q.addEventListener('click',quit);
    // the static type cards are cloned into the app on every render; keep the chosen one lit
    app.querySelectorAll('[data-kind]').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-kind')===pick.kind);});
  }
  function load(){
    fetch('/api/challenge',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json();}).then(function(d){
      S=d||{signedIn:false}; render();
      if(d&&d.ended&&window.mpToast)window.mpToast({kind:d.ended==='passed'?'good':'warn',key:'chal-end',msg:d.ended==='passed'?'You passed - your certificate is below.':'Your challenge ended on a rule.'});
      clearTimeout(poll); if(S.active)poll=setTimeout(function(){if(!document.hidden)load();},20000);
    }).catch(function(){S={signedIn:false};render();});
  }
  function start(){
    if(busy)return; busy=true; var g=$('cxGo'); if(g){g.disabled=true;g.textContent='Starting...';}
    fetch('/api/challenge',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({op:'start',kind:pick.kind,book:pick.book})}).then(function(r){return r.json();}).then(function(d){
      busy=false; if(d&&d.ok){try{if(window.__mpTrack)window.__mpTrack('challenge','start:'+pick.kind+':'+pick.book);}catch(e){} if(window.mpToast)window.mpToast({kind:'good',msg:'Challenge started. Every trade you open from now counts.'}); load(); try{app.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){} }
      else { if(window.mpToast)window.mpToast({kind:'warn',msg:d&&d.error==='already_active'?'You already have a challenge running.':'Could not start the challenge - try again.'}); load(); }
    }).catch(function(){busy=false;load();});
  }
  function quit(){
    if(!(armed&&Date.now()-armed<5000)){armed=Date.now();render();setTimeout(function(){if(armed&&Date.now()-armed>=5000){armed=0;render();}},5100);return;}
    armed=0; fetch('/api/challenge',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({op:'abandon'})}).then(function(){load();}).catch(load);
  }
  function board(){
    fetch('/api/challenge/board').then(function(r){return r.json();}).then(function(d){
      var c=(d&&d.counts)||{}; $('sPass').textContent=(c.passed||0).toLocaleString('en-US'); $('sDaily').textContent=(c.fail_daily||0).toLocaleString('en-US'); $('sDd').textContent=(c.fail_drawdown||0).toLocaleString('en-US');
      var p=(d&&d.passed)||[];
      $('cxBoard').innerHTML=p.length?p.map(function(x){return '<tr><td><a href="?c='+esc(x.id)+'" style="color:var(--ink)">@'+esc(x.who)+'</a></td><td>'+esc(x.name)+'</td><td class="n">'+money(x.book)+'</td><td class="n" style="color:var(--lime)">'+pct(x.returnPct)+'</td><td class="n">'+(+x.maxDdPct||0).toFixed(2)+'%</td><td class="n">'+(x.days||0)+'</td><td class="n">'+day(x.passed)+'</td></tr>';}).join(''):'<tr><td colspan="7" class="cx-empty">Nobody has passed yet - the first certificate on this board could be yours.</td></tr>';
    }).catch(function(){$('cxBoard').innerHTML='<tr><td colspan="7" class="cx-empty">The board could not be loaded - refresh in a moment.</td></tr>';});
  }
  function shareCert(id,who){
    var url=location.origin+'/prop-firm-challenge/?c='+id, img=new Image(); img.crossOrigin='anonymous';
    img.onload=function(){try{var cv=document.createElement('canvas');cv.width=1200;cv.height=630;cv.getContext('2d').drawImage(img,0,0);cv.toBlob(function(bl){var f=bl&&new File([bl],'marginpad-challenge-'+id+'.png',{type:'image/png'});
      if(f&&navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:'Prop firm challenge passed',text:'I passed a prop firm challenge on MarginPad: '+url}).catch(function(){});}
      else{var a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download='marginpad-challenge-'+id+'.png';document.body.appendChild(a);a.click();a.remove();}},'image/png');}catch(e){}};
    img.src='/api/challenge/cert.svg?id='+encodeURIComponent(id);
  }
  function cert(){
    fetch('/api/challenge/cert?id='+encodeURIComponent(certId)).then(function(r){return r.json();}).then(function(d){
      if(!d||!d.ok){app.innerHTML='<p class="cx-fine">That certificate does not exist, or the challenge did not pass.</p>';load();return;}
      var c=d.cert,r=c.result||{},p=d.partner;
      app.setAttribute('data-state','cert');
      app.innerHTML='<div class="cx-cert"><img src="/api/challenge/cert.svg?id='+encodeURIComponent(c.id)+'" alt="Prop firm challenge certificate for @'+esc(c.who)+'" width="1200" height="630">'
        +'<div><span class="cx-badge"><i></i>Verified pass</span><h2 style="margin:12px 0 6px">@'+esc(c.who)+' passed the '+esc(c.name)+' challenge</h2>'
        +'<p class="cx-fine">'+money(c.book)+' account &middot; '+pct(r.returnPct)+' &middot; max drawdown '+(+r.maxDdPct||0).toFixed(2)+'% &middot; '+(r.days||0)+' trading days &middot; passed '+day(c.ended)+'. Scored server-side on live prices; every rule was enforced from the first trade.</p>'
        +'<div class="cx-acts"><button type="button" class="cx-go" id="cxShare">Share the certificate</button><button type="button" class="cx-ghost" id="cxCopy">Copy link</button></div>'
        +'<div class="cx-partner">Ready to be measured for real? '+(p?'<a href="'+esc(p.url)+'" target="_blank" rel="sponsored noopener noreferrer" data-ex="'+esc(p.name)+'">'+esc(p.name)+' &rarr;</a> '+esc(p.note||''):'Compare the crypto prop firms that sell this evaluation - rules, prices and payouts from their own pages: <a href="/crypto-prop-firms/">crypto prop firms compared &rarr;</a>')+'</div></div></div>'
        +'<p style="margin:18px 0 0"><a href="/prop-firm-challenge/" style="color:var(--lime)">Start your own challenge &rarr;</a></p>';
      $('cxShare').addEventListener('click',function(){shareCert(c.id,c.who);});
      $('cxCopy').addEventListener('click',function(){var u=location.origin+'/prop-firm-challenge/?c='+c.id;try{navigator.clipboard.writeText(u);if(window.mpToast)window.mpToast({kind:'good',msg:'Link copied.'});}catch(e){}});
    }).catch(function(){load();});
  }
  wireChoice();
  if(certId)cert(); else load();
  board();
  window.addEventListener('mp-auth-change',function(){if(!certId)load();});
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&S&&S.active)load();});
  window.__cxState=function(){return S;};
})();
</script>
<script defer src="/assets/mp-auth.js"></script>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;
fs.mkdirSync(path.join(DIST, SLUG), { recursive: true });
fs.writeFileSync(path.join(DIST, SLUG, 'index.html'), html);
console.log('wrote dist/' + SLUG + '/index.html (' + Math.round(html.length / 1024) + ' KB)');
