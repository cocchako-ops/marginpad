/* THE TRADER READINESS TEST (2026-10-31, owner approved after the Academy review). A public page: no account, 15 questions, an instant score per area and the reasoning behind every answer.
   MEASURED before building: "are you ready to trade" answers are broker gates (Binance, BingX, One Trading, IG) you must pass to get in, or generic quizzes (ProProfs, CFTC). No standalone free test on futures turned up.
   EVERY WORD IS IN THE STATIC HTML, and the script only shows and hides it, so a crawler reads the whole test and es/gen-pages translates all of it through the catalog with no inline dictionary.
   The head is lifted from the finished /glossary/ page so this page carries the site's chrome without running the post-processors over dist.
   This is the only quiz here with answers in the page, and that is right: it pays nothing. It never says a reader is ready for real money, because a quiz cannot know that.
   Data: build/data/readiness.json. Run: node build/gen-readiness.js, then es/gen-pages (+ --lang pt|de) after a catalog round. */
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), P = '/trader-readiness-test/', U = 'https://marginpad.io' + P;
const D = JSON.parse(fs.readFileSync(path.join(R, 'build/data/readiness.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');
const TITLE = 'Trader Readiness Test: Are You Ready for Crypto Futures? | MarginPad';
const OGT = 'Are You Ready to Trade Crypto Futures? Free 5-Minute Test';
const DESC = 'A free 15-question test on leverage, risk, fees, reading the market and discipline. Instant score for each area, the reasoning behind every answer, no account needed.';

let g = fs.readFileSync(path.join(R, 'dist/glossary/index.html'), 'utf8');
const navTag = g.match(/<script defer src="\/assets\/mp-nav\.js\?v=[^"]+"><\/script>/)[0];
let head = g.slice(0, g.indexOf('</head>'));
head = head.replace(/\/\* Spanish for this file[\s\S]*?\nfunction __esT_glossaryindex[^\n]*\n/, '');
head = head.replace(/<style>[\s\S]*?<\/style>\n/, '').replace(/<style id="mp-xr-css">[\s\S]*?<\/style>\n/, '').replace(/<script type="application\/ld\+json">[^\n]*\n/g, '');
const set = (re, val) => { if (!re.test(head)) throw new Error('head: ' + re); head = head.replace(re, () => val); };
set(/<title>[^<]*<\/title>/, '<title>' + esc(TITLE) + '</title>');
set(/<meta name="description" content="[^"]*" \/>/, '<meta name="description" content="' + attr(DESC) + '" />');
set(/<meta name="keywords" content="[^"]*" \/>\n/, '');
set(/<meta property="og:title" content="[^"]*" \/>/, '<meta property="og:title" content="' + attr(OGT) + '" />');
set(/<meta property="og:description" content="[^"]*" \/>/, '<meta property="og:description" content="' + attr(DESC) + '" />');
head = head.split('/assets/og/glossary.jpg').join('/assets/og/trader-readiness-test.jpg').split('marginpad.io/glossary/').join('marginpad.io' + P).split('marginpad.io/es/glossary/').join('marginpad.io/es' + P).split('marginpad.io/pt/glossary/').join('marginpad.io/pt' + P).split('marginpad.io/de/glossary/').join('marginpad.io/de' + P);

const CSS = `<style>
.rt{max-width:680px;margin:0 auto}.rt-hero{padding:18px 0 8px}.rt-k{font:700 11px 'Space Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:#c2f64a}.rt-hero h1{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(30px,6vw,44px);line-height:1.08;margin:8px 0 10px}.rt-lead{color:#9aa3ad;font-size:16px;line-height:1.55;margin:0 0 14px}.rt-meta{display:flex;flex-wrap:wrap;gap:6px 16px;font:700 12px 'Space Mono',monospace;color:#e9e7df;margin:0 0 18px}
.rt-go{display:inline-block;background:#c2f64a;color:#0a0b0d;border:0;border-radius:13px;padding:14px 26px;font:800 16px 'Bricolage Grotesque',sans-serif;cursor:pointer;text-decoration:none}.rt-go[disabled]{opacity:.4;cursor:default}
.rt-fr{margin:0 0 14px;padding:10px 13px;border:1px solid rgba(194,246,74,.4);border-radius:12px;font-size:14px;color:#e9e7df}
.rt-bar{position:sticky;top:0;z-index:3;height:5px;border-radius:3px;background:#1b212b;margin:10px 0 18px;overflow:hidden}.rt-bar i{display:block;height:100%;width:0;background:#c2f64a;transition:width .25s}
.rtq{padding:18px 0;border-top:1px solid #232932}.rtn{font:700 11px 'Space Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:#8b95a1}.rtq h3{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:20px;line-height:1.28;margin:7px 0 14px}.rtq ol{list-style:none;margin:0;padding:0}.rtq li{margin:0 0 9px}
.opt{display:block;width:100%;text-align:left;background:#11151c;border:1.5px solid #2f3742;border-radius:13px;color:#e9e7df;font:600 15px 'Familjen Grotesk',sans-serif;padding:13px 15px}.rt-on .opt{cursor:pointer}.opt.sel{border-color:#c2f64a;background:rgba(194,246,74,.1)}.opt.ok{border-color:#2ebd85;background:rgba(46,189,133,.14);color:#7ce8bd}.opt.bad{border-color:#ff6258;background:rgba(255,98,88,.1);color:#ff9d96}
.why{margin:10px 0 0;font-size:14.5px;line-height:1.55;color:#9aa3ad}
html.rt-js .rtq,html.rt-js .why,html.rt-js #rtRes,html.rt-js .rtb,html.rt-js .rt-copied{display:none}html.rt-js .rtq.cur{display:block;border-top:0}html.rt-js.rt-end .rtq{display:block;border-top:1px solid #232932}html.rt-js.rt-end .why{display:block}html.rt-js.rt-end #rtRes{display:block}.rt-nojsbtn{display:none}html.rt-js .rtb.on{display:block}html.rt-js .rt-copied.on{display:inline}html.rt-js .rt-hide{display:none}
.rt-res{padding:6px 0 18px}.rt-sc{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:72px;line-height:1;color:#c2f64a}.rt-sc small{font-size:28px;color:#8b95a1}.rtb h2{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:24px;line-height:1.2;margin:10px 0 8px}.rtb p{color:#9aa3ad;font-size:15.5px;line-height:1.55;margin:0 0 14px}
.rt-dim{margin:18px 0}.rt-d{display:block;margin:0 0 11px;color:#e9e7df;text-decoration:none}.rt-d b{display:flex;justify-content:space-between;font-size:14px;font-weight:600}.rt-d em{font:700 12px 'Space Mono',monospace;color:#c2f64a}.rt-d.lo em{color:#ff9d96}.rt-d i{display:block;height:7px;border-radius:4px;background:#1b212b;margin-top:5px;overflow:hidden}.rt-d i u{display:block;height:100%;width:0;background:#c2f64a;transition:width .5s}.rt-d.lo i u{background:#ff6258}
.rt-share{background:none;border:1px solid #2f3742;border-radius:11px;color:#e9e7df;font:600 14px 'Familjen Grotesk',sans-serif;padding:11px 15px;cursor:pointer;margin-left:8px}.rt-note{font-size:13px;color:#8b95a1;line-height:1.5;margin:14px 0 0}
.rt-faq{margin-top:28px;border-top:1px solid #232932;padding-top:20px}.rt-faq h2{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:22px;margin:0 0 10px}.rt-faq h3{font-size:16px;margin:14px 0 4px}.rt-faq p{color:#9aa3ad;font-size:15px;line-height:1.55;margin:0}
</style>
<script>document.documentElement.classList.add('rt-js')</script>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: D.faq.map((f) => ({ '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } })) })}</script>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://marginpad.io/' }, { '@type': 'ListItem', position: 2, name: 'Academy', item: 'https://marginpad.io/academy/' }, { '@type': 'ListItem', position: 3, name: 'Trader Readiness Test', item: U }] })}</script>
`;
const N = D.q.length;
const qs = D.q.map((q, i) => `<section class="rtq" data-d="${q.d}" data-a="${q.a}"><div class="rtn">Question ${i + 1} of ${N}</div><h3>${esc(q.q)}</h3><ol>${q.o.map((o, j) => `<li><button type="button" class="opt" data-i="${j}">${esc(o)}</button></li>`).join('')}</ol><p class="why">${esc(q.w)}</p></section>`).join('\n');
const bands = D.bands.map((b) => `<div class="rtb" data-min="${b.min}"><h2>${esc(b.h)}</h2><p>${esc(b.p)}</p><a class="rt-go" data-c="1" href="${b.href}">${esc(b.cta)}</a><button type="button" class="rt-share" data-share="1"><span class="rt-sh">Share your score</span><span class="rt-copied">Link copied</span></button></div>`).join('\n');
const dims = Object.keys(D.dims).map((k) => `<a class="rt-d" data-dim="${k}" href="${D.dims[k].href}"><b>${esc(D.dims[k].n)}<em></em></b><i><u></u></i></a>`).join('\n');
const JS = `<script>
(function(){
  var $=function(s,r){return (r||document).querySelector(s);},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
  var Q=$$('.rtq'),N=Q.length,i=0,ans={},root=document.documentElement,beacon=function(e){try{navigator.sendBeacon('/api/track?t=readiness&e='+encodeURIComponent(e)+'&p='+encodeURIComponent(location.pathname));}catch(x){}};
  root.classList.add('rt-on');
  try{var fr=+new URLSearchParams(location.search).get('s');if(fr>=0&&fr<=N&&location.search.indexOf('s=')>=0){$('#rtFr b').textContent=fr+' / '+N;$('#rtFr').hidden=false;}}catch(x){}
  function show(){Q.forEach(function(s,k){s.classList.toggle('cur',k===i);});$('#rtBar i').style.width=(i/N*100)+'%';var y=$('#rtBar').getBoundingClientRect().top+scrollY-12;if(scrollY>y)scrollTo(0,y);}
  $('#rtStart').addEventListener('click',function(){$('#rtIntro').classList.add('rt-hide');$('#rtTest').hidden=false;show();beacon('start');});
  $('#rtTest').addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.opt');if(!b||root.classList.contains('rt-end'))return;
    var s=b.closest('.rtq'),k=Q.indexOf(s);ans[k]=+b.getAttribute('data-i');$$('.opt',s).forEach(function(o){o.classList.toggle('sel',o===b);});
    setTimeout(function(){if(k<N-1){i=k+1;show();}else finish();},220);
  });
  function finish(){
    var score=0,by={};
    Q.forEach(function(s,k){var a=+s.getAttribute('data-a'),d=s.getAttribute('data-d'),r=ans[k]===a;by[d]=by[d]||[0,0];by[d][1]++;if(r){by[d][0]++;score++;}$$('.opt',s).forEach(function(o){var n=+o.getAttribute('data-i');o.classList.remove('sel');if(n===a)o.classList.add('ok');else if(n===ans[k])o.classList.add('bad');});});
    root.classList.add('rt-end');$('#rtBar').hidden=true;$('#rtScore').firstChild.nodeValue=score;
    var bs=$$('.rtb'),pick=bs[0];bs.forEach(function(b){if(score>=+b.getAttribute('data-min'))pick=b;});pick.classList.add('on');
    $$('.rt-d').forEach(function(a){var v=by[a.getAttribute('data-dim')]||[0,1];$('em',a).textContent=v[0]+'/'+v[1];if(v[0]/v[1]<.67)a.classList.add('lo');setTimeout(function(){$('u',a).style.width=(v[0]/v[1]*100)+'%';},60);});
    scrollTo(0,$('#rtRes').getBoundingClientRect().top+scrollY-70);beacon('done:'+score);window.__rtScore=score;
  }
  document.addEventListener('click',function(e){
    var c=e.target.closest&&e.target.closest('[data-share]');
    if(c){var u=location.origin+location.pathname+'?s='+window.__rtScore;function ok(){$('.rt-sh',c).hidden=true;$('.rt-copied',c).classList.add('on');}beacon('share');if(navigator.share){navigator.share({url:u}).catch(function(){});}else{try{navigator.clipboard.writeText(u).then(ok);}catch(x){}}return;}
    if(e.target.closest&&e.target.closest('[data-c]'))beacon('cta');
  });
})();
</script>`;
const body = `</head>
<body class="gloss">
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="/">Calculators</a><a href="/blog/">Blog</a><a href="/academy/">Academy</a></nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / <a href="/academy/">Academy</a> / Trader Readiness Test</div>
  <article class="rt">
    <div class="rt-hero">
      <div class="rt-k">Free test</div>
      <h1>Are you ready to trade crypto futures?</h1>
      <div class="rt-fr" id="rtFr" hidden>A friend scored <b></b> on this test. Can you beat it?</div>
      <div id="rtIntro">
        <p class="rt-lead">Exchanges make you pass a quiz before they let you trade futures, then they let you lose money anyway. This one tells you the truth: your score in each area, the reasoning behind every answer, and what to fix first.</p>
        <div class="rt-meta"><span>${N} questions</span><span>5 minutes</span><span>No account</span></div>
        <button type="button" class="rt-go" id="rtStart">Start the test</button>
      </div>
    </div>
    <div id="rtRes" class="rt-res">
      <div class="rt-sc" id="rtScore">0<small>/${N}</small></div>
      ${bands}
      <div class="rt-dim">${dims}</div>
      <p class="rt-note">A test measures what you know, not what you do when a trade goes against you. A high score is not a signal to trade real money. Futures can lose your whole stake, and nothing here is financial advice.</p>
    </div>
    <div class="rt-bar" id="rtBar"><i></i></div>
    <div id="rtTest">
${qs}
    </div>
    <section class="rt-faq">
      <h2>About this test</h2>
      ${D.faq.map((f) => `<h3>${esc(f[0])}</h3><p>${esc(f[1])}</p>`).join('\n      ')}
    </section>
  </article>
  <footer>
    <span>&copy; 2026 MarginPad</span>
    <span><a href="/academy/">Academy</a> &middot; <a href="/glossary/">Glossary</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="/privacy/">Privacy</a></span>
  </footer>
</div>
${JS}
${navTag}
</body>
</html>
`;
const dir = path.join(R, 'dist', P.replace(/\//g, ''));
fs.mkdirSync(dir, { recursive: true });
const hasCrit = head.lastIndexOf('<style id="mpHdrCrit">');
fs.writeFileSync(path.join(dir, 'index.html'), head.slice(0, hasCrit) + CSS + head.slice(hasCrit) + body);
console.log('written', dir);
