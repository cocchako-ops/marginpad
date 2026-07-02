/* /pivot-point-calculator/ (+ the other tool apps later) — multilingual rebuild from build/data/tools-i18n.js.
   English at /<slug>/ plus 12 translated variants at /<lang>/<slug>/ (hreflang). SHARED = topbar/footer chrome.
   Run: node build/gen-tools-pages.js */
const fs = require('fs');
const path = require('path');
const T = require('./data/tools-i18n');
const DIST = path.join(__dirname, '..', 'dist');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';
const LANG_CODES = ['de', 'es', 'pt', 'fr', 'nl', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id'];
const RTL = { ar: 1 };
const escAttr = s => String(s).replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;').replace(/"/g, '&quot;');
const J = v => JSON.stringify(v);

function hreflang(slug) {
  let s = `<link rel="alternate" hreflang="en" href="https://marginpad.io/${slug}/" />\n`;
  for (const lc of LANG_CODES) s += `<link rel="alternate" hreflang="${lc}" href="https://marginpad.io/${lc}/${slug}/" />\n`;
  s += `<link rel="alternate" hreflang="x-default" href="https://marginpad.io/${slug}/" />`;
  return s;
}
// topbar tool-switch + footer, reused across all 5 tools. Cross-tool links stay English until those tools are translated.
function topbar(lang, S, activeSlug) {
  const home = lang ? `/${lang}/` : '/';
  const link = (slug, label) => {
    const on = slug === activeSlug ? ' class="on"' : '';
    const href = (slug === activeSlug && lang) ? `/${lang}/${slug}/` : `/${slug}/`;
    return `<a href="${href}"${on}>${label}</a>`;
  };
  return `<header class="topbar"><a class="brand" href="${home}">MARGIN<b>PAD</b></a><nav class="tool-switch"><a href="/${lang ? lang + '/' : ''}tools/">${S.toolsAll}</a>${link('crypto-backtester', S.toolBack)}${link('trading-journal', S.toolJournal)}${link('pivot-point-calculator', S.toolPivots)}${link('risk-of-ruin-calculator', S.toolRisk)}${link('crypto-correlation-matrix', S.toolCorr)}</nav><a class="home" href="${home}">${S.backHome}</a></header>`;
}
function footer(lang, S) {
  const home = lang ? `/${lang}/` : '/';
  return `<div class="wrap" style="padding-bottom:0">
<footer class="toolfoot"><div class="cols"><div><a class="brand" href="${home}" style="font-size:18px">MARGIN<b>PAD</b></a><p class="blurb">${S.footBlurb}</p></div><div><h4>${S.footToolsH}</h4><a href="/crypto-backtester/">${S.ftBacktester}</a><a href="/trading-journal/">${S.ftJournal}</a><a href="/pivot-point-calculator/">${S.ftPivots}</a><a href="/risk-of-ruin-calculator/">${S.ftRisk}</a><a href="/crypto-correlation-matrix/">${S.ftCorr}</a></div><div><h4>MarginPad</h4><a href="/paper-trade">${S.mpPaper}</a><a href="/charts">${S.mpCharts}</a><a href="/calculators">${S.mpCalc}</a><a href="/screener">${S.mpScreener}</a><a href="/rekt/">${S.mpLiq}</a></div></div><div class="bottom">${S.footBottom}</div></footer>
</div>`;
}

function pivotPage(lang) {
  const S = T.SHARED[lang || 'en'], P = T.PIVOT[lang || 'en'], code = lang || 'en';
  const slug = 'pivot-point-calculator', url = `https://marginpad.io/${lang ? lang + '/' : ''}${slug}/`;
  const titleFull = escAttr(P.metaTitle + ' | MarginPad');
  return `<!DOCTYPE html>
<html lang="${code}"${RTL[lang] ? ' dir="rtl"' : ''}>
<head>
${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<meta name="theme-color" content="#08090b" />
<title>${titleFull}</title>
<meta name="description" content="${escAttr(P.metaDesc)}" />
<meta name="keywords" content="${escAttr(P.keywords)}" />
<link rel="canonical" href="${url}" />
${hreflang(slug)}
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${titleFull}" />
<meta property="og:description" content="${escAttr(P.metaDesc)}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${titleFull}" />
<meta name="twitter:description" content="${escAttr(P.metaDesc)}" />
<meta name="twitter:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="stylesheet" href="/assets/lab.css" />
<style>
  .lvl{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid rgba(32,38,47,.55);font-family:'Space Mono',monospace}
  .lvl:last-child{border-bottom:none}
  .lvl .nm{width:44px;font-weight:700;font-size:13px;letter-spacing:.02em}
  .lvl .pr{flex:1;font-size:15px;color:var(--ink)}
  .lvl .ds{color:var(--faint);font-size:12px}
  .lvl.r{background:linear-gradient(90deg,rgba(255,98,88,.06),transparent)}
  .lvl.s{background:linear-gradient(90deg,rgba(55,211,152,.06),transparent)}
  .lvl.p{background:linear-gradient(90deg,rgba(194,246,74,.05),transparent)}
  .lvl.p .nm{color:var(--lime)}
  .lvl.r .nm{color:var(--red)}
  .lvl.s .nm{color:var(--up)}
  .lvl.nowrow{background:rgba(70,224,230,.09)!important}
  .lvl.nowrow .nm,.lvl.nowrow .pr{color:var(--cyan)}
  .nowrow{display:flex;align-items:center;gap:10px;padding:11px 16px;background:#0a0d11;border:1px dashed var(--cyan);border-radius:var(--rs);margin:0;color:var(--cyan);font-family:'Space Mono',monospace;font-weight:700;font-size:14px}
</style>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication","name":"Crypto Pivot Point Calculator","applicationCategory":"FinanceApplication","operatingSystem":"Any","url":"https://marginpad.io/pivot-point-calculator/","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":${J(S.toolsAll)},"item":"https://marginpad.io/${lang ? lang + '/' : ''}tools/"},{"@type":"ListItem","position":2,"name":${J(P.h1)},"item":"${url}"}]}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":${J(P.faq1q)},"acceptedAnswer":{"@type":"Answer","text":${J(P.faq1a)}}},{"@type":"Question","name":${J(P.faq2q)},"acceptedAnswer":{"@type":"Answer","text":${J(P.faq2a)}}},{"@type":"Question","name":${J(P.faq3q)},"acceptedAnswer":{"@type":"Answer","text":${J(P.faq3a)}}}]}
</script>
</head>
<body>
${topbar(lang, S, slug)}

<div class="wrap">
  <section class="hero">
    <span class="eyebrow">${P.eyebrow}</span>
    <h1>${P.h1}</h1>
    <p class="sub">${P.sub}</p>
  </section>

  <div class="toolbar">
    <div class="row">
      <label class="f">${P.lblCoin}<input id="coin" value="BTC" maxlength="12" autocomplete="off" style="width:120px"></label>
      <label class="f">${P.lblPeriod}<select id="per"><option value="d">${P.optDaily}</option><option value="w">${P.optWeekly}</option></select></label>
      <label class="f">${P.lblMethod}<select id="method"><option value="classic">${P.optClassic}</option><option value="fib">${P.optFib}</option><option value="cam">${P.optCam}</option></select></label>
      <button class="btn" id="run">${P.btnCompute}</button>
    </div>
    <div class="status" id="status"></div>
  </div>

  <div id="out" hidden style="margin-top:18px">
    <div class="nowrow" id="now"></div>
    <div class="tablewrap" id="ladder" style="margin-top:12px"></div>
    <div class="note">${P.note}</div>
  </div>

  <h2>${P.h2how}</h2>
  <p class="muted" style="max-width:760px;font-size:15px;color:var(--ink2);line-height:1.65">
    ${P.howP}
  </p>

  <h2>${P.h2faq}</h2>
  <p style="font-weight:700;color:var(--ink);margin:18px 0 4px">${P.faq1q}</p>
  <p class="muted" style="font-size:14px;line-height:1.65;max-width:760px">${P.faq1a}</p>

  <p style="font-weight:700;color:var(--ink);margin:18px 0 4px">${P.faq2q}</p>
  <p class="muted" style="font-size:14px;line-height:1.65;max-width:760px">${P.faq2a}</p>

  <p style="font-weight:700;color:var(--ink);margin:18px 0 4px">${P.faq3q}</p>
  <p class="muted" style="font-size:14px;line-height:1.65;max-width:760px">${P.faq3a}</p>
</div>

<script>
(function(){
  var $=function(id){return document.getElementById(id);};
  function fp(x){x=+x;return x>=1000?x.toLocaleString('en-US',{maximumFractionDigits:2}):x>=1?x.toFixed(4):x.toPrecision(5);}
  function levels(method,H,L,C){
    var P=(H+L+C)/3,r=H-L,out=[];
    if(method==='classic'){out=[['R3',H+2*(P-L)],['R2',P+r],['R1',2*P-L],['P',P],['S1',2*P-H],['S2',P-r],['S3',L-2*(H-P)]];}
    else if(method==='fib'){out=[['R3',P+r],['R2',P+0.618*r],['R1',P+0.382*r],['P',P],['S1',P-0.382*r],['S2',P-0.618*r],['S3',P-r]];}
    else{var u=1.1;out=[['R4',C+r*u/2],['R3',C+r*u/4],['R2',C+r*u/6],['R1',C+r*u/12],['P',P],['S1',C-r*u/12],['S2',C-r*u/6],['S3',C-r*u/4],['S4',C-r*u/2]];}
    return out.map(function(x){return {nm:x[0],v:x[1],type:x[0][0]==='R'?'r':x[0][0]==='S'?'s':'p'};});
  }
  function run(){
    var coin=($('coin').value||'BTC').toUpperCase().replace(/[^A-Z0-9]/g,'')||'BTC';
    var per=$('per').value, method=$('method').value;
    $('status').textContent=${J(P.jsLoading)};$('run').disabled=true;$('perL').textContent=per==='w'?${J(P.jsWeek)}:${J(P.jsDay)};
    Promise.all([
      fetch('/api/klines?symbol='+coin+'&interval=1440',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}),
      fetch('/api/price?symbol='+coin,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
    ]).then(function(res){
      var d=res[0];var k=Array.isArray(d)?d:((d&&(d.klines||d.data||d.candles))||[]);
      k=k.map(function(x){return Array.isArray(x)?{high:+x[2],low:+x[3],close:+x[4]}:{high:+x.high,low:+x.low,close:+x.close};}).filter(function(x){return isFinite(x.close);});
      if(k.length<3){$('status').textContent=${J(P.jsNotEnough)}+coin+'.';$('run').disabled=false;return;}
      var H,L,C;
      if(per==='w'){var seg=k.slice(-8,-1);if(seg.length<2)seg=k.slice(0,-1);H=Math.max.apply(null,seg.map(function(x){return x.high;}));L=Math.min.apply(null,seg.map(function(x){return x.low;}));C=seg[seg.length-1].close;}
      else{var prev=k[k.length-2];H=prev.high;L=prev.low;C=prev.close;}
      var live=res[1]&&(+res[1].price||+res[1].p);if(!(live>0))live=k[k.length-1].close;
      var lv=levels(method,H,L,C);
      lv.sort(function(a,b){return b.v-a.v;});
      var html='';lv.forEach(function(x,i){
        if(i>0&&lv[i-1].v>=live&&x.v<live){html+='<div class="lvl nowrow"><span class="nm">'+${J(P.jsNow)}+'</span><span class="pr">'+fp(live)+'</span><span class="ds">'+${J(P.jsLive)}+'</span></div>';}
        var dist=(live-x.v)/live*100;
        html+='<div class="lvl '+x.type+'"><span class="nm">'+x.nm+'</span><span class="pr">'+fp(x.v)+'</span><span class="ds">'+(dist>=0?'+':'')+dist.toFixed(2)+'%</span></div>';
      });
      if(live<lv[lv.length-1].v){html+='<div class="lvl nowrow"><span class="nm">'+${J(P.jsNow)}+'</span><span class="pr">'+fp(live)+'</span><span class="ds">'+${J(P.jsLive)}+'</span></div>';}
      $('ladder').innerHTML=html;
      $('now').innerHTML=coin+' · '+${J(P.jsLive)}+' '+fp(live)+' · '+${J(P.jsPivot)}+' '+fp(lv.filter(function(x){return x.type==='p';})[0].v);
      $('out').hidden=false;$('status').textContent='';$('run').disabled=false;
    }).catch(function(){$('status').textContent=${J(P.jsErr)};$('run').disabled=false;});
  }
  $('run').addEventListener('click',run);$('coin').addEventListener('keydown',function(e){if(e.key==='Enter')run();});
  run();
})();
</script>

${footer(lang, S)}
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;
}

function corrPage(lang) {
  const S = T.SHARED[lang || 'en'], C = T.CORR[lang || 'en'], code = lang || 'en';
  const slug = 'crypto-correlation-matrix', url = `https://marginpad.io/${lang ? lang + '/' : ''}${slug}/`;
  const titleFull = escAttr(C.metaTitle + ' | MarginPad');
  return `<!DOCTYPE html>
<html lang="${code}"${RTL[lang] ? ' dir="rtl"' : ''}>
<head>
${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<title>${titleFull}</title>
<meta name="description" content="${escAttr(C.metaDesc)}" />
<meta name="keywords" content="${escAttr(C.keywords)}" />
<link rel="canonical" href="${url}" />
${hreflang(slug)}
<meta name="theme-color" content="#08090b" />
<meta property="og:title" content="${titleFull}" />
<meta property="og:description" content="${escAttr(C.metaDesc)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${titleFull}" />
<meta name="twitter:description" content="${escAttr(C.twDesc)}" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="stylesheet" href="/assets/lab.css" />
<style>
  .mx{border-collapse:separate;border-spacing:4px;font-family:'Space Mono',monospace}
  .mx td,.mx th{text-align:center;padding:0}
  .mx th{font-size:11.5px;color:var(--dim);font-weight:700;letter-spacing:.03em;width:58px;padding-bottom:4px}
  .mx td.lbl{color:var(--ink2);font-weight:700;font-size:11.5px;letter-spacing:.03em;text-align:right;padding-right:9px;white-space:nowrap}
  .cell{width:58px;height:46px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;color:#f4f2ec;border:1px solid rgba(255,255,255,.05);text-shadow:0 1px 2px rgba(0,0,0,.45);transition:transform .12s}
  .cell:hover{transform:scale(1.06)}
  .cell.diag{background:var(--panel3)!important;color:var(--faint);border-color:var(--line2)}
  .mxlegend{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:16px;font-size:12px;color:var(--dim)}
  .mxlegend .scale{display:flex;height:11px;width:200px;border-radius:6px;overflow:hidden;border:1px solid var(--line)}
  .mxlegend .scale i{flex:1}
  .faq h3{font-family:'Bricolage Grotesque',sans-serif;font-size:15.5px;font-weight:700;margin:22px 0 6px;letter-spacing:-.01em}
  .faq p{color:var(--dim);font-size:14px;line-height:1.65;margin:0;max-width:760px}
  .prose p{color:var(--dim);font-size:14.5px;line-height:1.7;max-width:760px;margin:0 0 12px}
</style>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication","name":"Crypto Correlation Matrix","applicationCategory":"FinanceApplication","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"url":"https://marginpad.io/crypto-correlation-matrix/","description":${J(C.metaDesc)}}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":${J(S.toolsAll)},"item":"https://marginpad.io/${lang ? lang + '/' : ''}tools/"},{"@type":"ListItem","position":2,"name":${J(C.h1)},"item":"${url}"}]}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":${J(C.faq1q)},"acceptedAnswer":{"@type":"Answer","text":${J(C.faq1a)}}},{"@type":"Question","name":${J(C.faq2q)},"acceptedAnswer":{"@type":"Answer","text":${J(C.faq2a)}}},{"@type":"Question","name":${J(C.faq3q)},"acceptedAnswer":{"@type":"Answer","text":${J(C.faq3a)}}}]}
</script>
</head>
<body>
${topbar(lang, S, slug)}
<div class="wrap">
  <section class="hero">
    <span class="eyebrow">${C.eyebrow}</span>
    <h1>${C.h1}</h1>
    <p class="sub">${C.sub}</p>
  </section>

  <div class="toolbar">
    <div class="row">
      <label class="f">${C.lblTf}<select id="tf"><option value="60">1h</option><option value="240" selected>4h</option><option value="1440">1d</option></select></label>
      <label class="f">${C.lblWin}<select id="win"><option>60</option><option selected>120</option><option>200</option></select></label>
      <button class="btn" id="run">${C.btnCompute}</button>
    </div>
    <div class="status" id="status"></div>
  </div>

  <div id="out" hidden style="margin-top:18px">
    <div class="card scrollx"><table class="mx" id="mx"></table></div>
    <div class="mxlegend">
      <span style="color:var(--up);font-weight:700">${C.legHedge}</span>
      <span class="scale"><i style="background:rgba(46,189,133,.70)"></i><i style="background:rgba(46,189,133,.34)"></i><i style="background:#1a2028"></i><i style="background:rgba(255,98,88,.34)"></i><i style="background:rgba(255,98,88,.70)"></i></span>
      <span style="color:var(--red);font-weight:700">${C.legTogether}</span>
    </div>
    <div class="note">${C.note}</div>
  </div>

  <h2>${C.h2read}</h2>
  <div class="prose">
    <p>${C.prose1}</p>
    <p>${C.prose2}</p>
  </div>

  <h2>${C.h2faq}</h2>
  <div class="faq">
    <h3>${C.faq1q}</h3>
    <p>${C.faq1a}</p>
    <h3>${C.faq2q}</h3>
    <p>${C.faq2a}</p>
    <h3>${C.faq3q}</h3>
    <p>${C.faq3a}</p>
  </div>
</div>

${footer(lang, S)}
<script>
(function(){
  var $=function(id){return document.getElementById(id);};
  var COINS=['BTC','ETH','SOL','BNB','XRP','DOGE','LINK','AVAX'];
  function col(v){if(v>=0)return 'rgba(255,98,88,'+(0.08+v*0.62).toFixed(3)+')';return 'rgba(46,189,133,'+(0.08+(-v)*0.62).toFixed(3)+')';}
  function corr(a,b){var n=Math.min(a.length,b.length);if(n<3)return 0;a=a.slice(-n);b=b.slice(-n);var ma=0,mb=0,i;for(i=0;i<n;i++){ma+=a[i];mb+=b[i];}ma/=n;mb/=n;var sa=0,sb=0,sab=0;for(i=0;i<n;i++){var da=a[i]-ma,db=b[i]-mb;sa+=da*da;sb+=db*db;sab+=da*db;}var d=Math.sqrt(sa*sb);return d?sab/d:0;}
  function run(){
    var tf=$('tf').value, win=+$('win').value||120;
    $('status').textContent=${J(C.jsLoadingPre)}+COINS.length+${J(C.jsLoadingPost)};$('run').disabled=true;
    Promise.all(COINS.map(function(c){return fetch('/api/klines?symbol='+c+'&interval='+tf,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});})).then(function(res){
      var rets={};COINS.forEach(function(c,i){var d=res[i];var k=Array.isArray(d)?d:((d&&(d.klines||d.data||d.candles))||[]);var cl=k.map(function(x){return Array.isArray(x)?+x[4]:+x.close;}).filter(function(x){return isFinite(x);}).slice(-win-1);var r=[];for(var j=1;j<cl.length;j++)r.push(Math.log(cl[j]/cl[j-1]));rets[c]=r;});
      var have=COINS.filter(function(c){return rets[c]&&rets[c].length>=10;});
      if(have.length<2){$('status').textContent=${J(C.jsErrData)};$('run').disabled=false;return;}
      var html='<tr><th></th>'+have.map(function(c){return '<th>'+c+'</th>';}).join('')+'</tr>';
      have.forEach(function(a){html+='<tr><td class="lbl">'+a+'</td>'+have.map(function(b){var v=a===b?1:corr(rets[a],rets[b]);return '<td><div class="cell'+(a===b?' diag':'')+'" style="background:'+(a===b?'#1a2028':col(v))+'">'+v.toFixed(2)+'</div></td>';}).join('')+'</tr>';});
      $('mx').innerHTML=html;$('out').hidden=false;$('status').textContent='';$('run').disabled=false;
    }).catch(function(){$('status').textContent=${J(C.jsErr)};$('run').disabled=false;});
  }
  $('run').addEventListener('click',run);run();
})();
</script>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;
}

function riskPage(lang) {
  const S = T.SHARED[lang || 'en'], R = T.RISK[lang || 'en'], code = lang || 'en';
  const slug = 'risk-of-ruin-calculator', url = `https://marginpad.io/${lang ? lang + '/' : ''}${slug}/`;
  const titleFull = escAttr(R.metaTitle + ' | MarginPad');
  return `<!DOCTYPE html>
<html lang="${code}"${RTL[lang] ? ' dir="rtl"' : ''}>
<head>
${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<meta name="theme-color" content="#08090b" />
<title>${titleFull}</title>
<meta name="description" content="${escAttr(R.metaDesc)}" />
<meta name="keywords" content="${escAttr(R.keywords)}" />
<link rel="canonical" href="${url}" />
${hreflang(slug)}
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${titleFull}" />
<meta property="og:description" content="${escAttr(R.ogDesc)}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<meta property="og:site_name" content="MarginPad" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${titleFull}" />
<meta name="twitter:description" content="${escAttr(R.ogDesc)}" />
<meta name="twitter:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="stylesheet" href="/assets/lab.css" />
<style>
  .fan{width:100%;height:260px;background:#0a0c10;border:1px solid var(--line);border-radius:14px;margin-top:8px;display:block}
  .verdict{font-size:13.5px;color:var(--ink2);line-height:1.65;margin-top:16px;background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);border-left:3px solid var(--cyan);border-radius:12px;padding:14px 16px}
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
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication","name":"Risk of Ruin Calculator","applicationCategory":"FinanceApplication","operatingSystem":"Web","url":"https://marginpad.io/risk-of-ruin-calculator/","description":${J(R.appDesc)},"offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":${J(S.toolsAll)},"item":"https://marginpad.io/${lang ? lang + '/' : ''}tools/"},{"@type":"ListItem","position":2,"name":${J(R.h1)},"item":"${url}"}]}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":${J(R.faq1q)},"acceptedAnswer":{"@type":"Answer","text":${J(R.faq1a)}}},{"@type":"Question","name":${J(R.faq2q)},"acceptedAnswer":{"@type":"Answer","text":${J(R.faq2a)}}},{"@type":"Question","name":${J(R.faq3q)},"acceptedAnswer":{"@type":"Answer","text":${J(R.faq3a)}}}]}
</script>
</head>
<body>
${topbar(lang, S, slug)}

<div class="wrap">
  <section class="hero">
    <span class="eyebrow">${R.eyebrow}</span>
    <h1>${R.h1}</h1>
    <p class="sub">${R.sub}</p>
  </section>

  <div class="toolbar">
    <div class="row">
      <label class="f">${R.lblWr}<input id="wr" type="number" value="45" min="1" max="99" style="width:96px"></label>
      <label class="f">${R.lblRr}<input id="rr" type="number" value="2" step="0.1" min="0.1" style="width:96px"></label>
      <label class="f">${R.lblRisk}<input id="risk" type="number" value="2" step="0.5" min="0.1" max="100" style="width:108px"></label>
      <label class="f">${R.lblTrades}<input id="n" type="number" value="100" min="10" max="1000" style="width:96px"></label>
      <button class="btn" id="run">${R.btnSimulate}</button>
    </div>
    <div class="status" id="status"></div>
  </div>

  <div id="out" hidden>
    <h2>${R.h2edge}</h2>
    <div class="kpis" id="kEdge"></div>

    <h2>${R.h2overPre}<span id="nL">100</span>${R.h2overMid}<span class="muted">${R.h2overSims}</span></h2>
    <div class="kpis" id="kSim"></div>

    <h2>${R.h2fan}</h2>
    <svg class="fan" id="fan" viewBox="0 0 600 230" preserveAspectRatio="none"></svg>
    <div class="legend"><span><i style="background:rgba(70,224,230,.15);height:9px;border-radius:2px"></i>${R.legRange595}</span><span><i style="background:rgba(70,224,230,.3);height:9px;border-radius:2px"></i>${R.legRange2575}</span><span><i style="background:var(--lime)"></i>${R.legMedian}</span><span><i style="background:var(--red)"></i>${R.legStart}</span></div>

    <div class="verdict" id="verdict"></div>
  </div>

  <section class="content">
    <h2>${R.h2how}</h2>
    <p>${R.howP}</p>
  </section>

  <section class="content faq">
    <h2>${R.h2faq}</h2>
    <details>
      <summary>${R.faq1q}</summary>
      <div class="a">${R.faq1a}</div>
    </details>
    <details>
      <summary>${R.faq2q}</summary>
      <div class="a">${R.faq2a}</div>
    </details>
    <details>
      <summary>${R.faq3q}</summary>
      <div class="a">${R.faq3a}</div>
    </details>
  </section>
</div>

${footer(lang, S)}

<script>
(function(){
  var $=function(id){return document.getElementById(id);};
  function pc(x){return (+x).toFixed(1)+'%';}
  function run(){
    var wr=Math.min(99,Math.max(1,+$('wr').value||45))/100, R=Math.max(0.1,+$('rr').value||2), risk=Math.min(100,Math.max(0.1,+$('risk').value||2))/100, N=Math.min(1000,Math.max(10,+$('n').value||100));
    $('nL').textContent=N;
    var expR=wr*R-(1-wr);
    var expPct=expR*risk*100;
    var kelly=(wr*R-(1-wr))/R;
    function kpi(v,l,cls){return '<div class="kpi"><div class="v '+(cls||'')+'">'+v+'</div><div class="l">'+l+'</div></div>';}
    $('kEdge').innerHTML=kpi((expR>=0?'+':'')+expR.toFixed(2)+'R',${J(R.kEdgeExp)},expR>=0?'pos':'neg')
      +kpi((expPct>=0?'+':'')+expPct.toFixed(2)+'%',${J(R.kEdgeAvg)},expPct>=0?'pos':'neg')
      +kpi(kelly>0?pc(kelly*100):'0%',${J(R.kEdgeFullKelly)},kelly>0?'pos':'neg')
      +kpi(kelly>0?pc(kelly*50):'0%',${J(R.kEdgeHalfKelly)},kelly>0?'pos':'neg');
    var S=2000, finals=[], ruin50=0, ruin0=0, steps=[];for(var s=0;s<=N;s++)steps.push([]);
    for(var sim=0;sim<S;sim++){
      var eq=1, minEq=1, path=[1];
      for(var t=0;t<N;t++){ eq*= (Math.random()<wr)?(1+R*risk):(1-risk); if(eq<minEq)minEq=eq; path.push(eq);}
      finals.push(eq);
      if(minEq<=0.5)ruin50++; if(eq<1)ruin0++;
      for(var st=0;st<=N;st++)steps[st].push(path[st]);
    }
    finals.sort(function(a,b){return a-b;});
    function q(arr,p){var a=arr.slice().sort(function(x,y){return x-y;});return a[Math.min(a.length-1,Math.floor(p*a.length))];}
    var med=finals[Math.floor(S*0.5)], p5=finals[Math.floor(S*0.05)], p95=finals[Math.floor(S*0.95)];
    $('kSim').innerHTML=kpi('×'+med.toFixed(2),${J(R.kSimMedian)},med>=1?'pos':'neg')
      +kpi(pc((1-ruin0/S)*100),${J(R.kSimProfit)},(1-ruin0/S)>=0.5?'pos':'neg')
      +kpi(pc(ruin50/S*100),${J(R.kSimRor)},ruin50/S>0.1?'neg':'pos')
      +kpi('×'+p95.toFixed(2),${J(R.kSimBest)},'pos')
      +kpi('×'+p5.toFixed(2),${J(R.kSimWorst)},'neg');
    var W=600,H=230,pad=8;var qs={p5:[],p25:[],p50:[],p75:[],p95:[]};
    steps.forEach(function(col){qs.p5.push(q(col,0.05));qs.p25.push(q(col,0.25));qs.p50.push(q(col,0.5));qs.p75.push(q(col,0.75));qs.p95.push(q(col,0.95));});
    var mx=Math.max.apply(null,qs.p95),mn=Math.min.apply(null,qs.p5);mx=Math.max(mx,1.05);mn=Math.min(mn,0.95);
    function X(i){return pad+i/N*(W-2*pad);}function Y(v){return H-pad-((v-mn)/((mx-mn)||1))*(H-2*pad);}
    function band(lo,hi){var d='';for(var i=0;i<=N;i++)d+=(i?'L':'M')+X(i).toFixed(1)+' '+Y(qs[hi][i]).toFixed(1);for(var j=N;j>=0;j--)d+='L'+X(j).toFixed(1)+' '+Y(qs[lo][j]).toFixed(1);return d+'Z';}
    function line(k,col,w){var d='';for(var i=0;i<=N;i++)d+=(i?'L':'M')+X(i).toFixed(1)+' '+Y(qs[k][i]).toFixed(1);return '<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="'+w+'"/>';}
    var oneY=Y(1).toFixed(1);
    $('fan').innerHTML='<path d="'+band('p5','p95')+'" fill="rgba(70,224,230,.13)"/><path d="'+band('p25','p75')+'" fill="rgba(70,224,230,.28)"/><line x1="'+pad+'" y1="'+oneY+'" x2="'+(W-pad)+'" y2="'+oneY+'" stroke="#ff6258" stroke-dasharray="3 3"/>'+line('p50','#c2f64a',2);
    var v;if(expR<=0)v=${J(R.vNeg)};
    else if(ruin50/S>0.2)v=${J(R.vRisk)}.replace('{risk}',(risk*100).toFixed(1)).replace('{ror}',pc(ruin50/S*100)).replace('{hk}',pc(kelly*50));
    else v=${J(R.vPos)}.replace('{med}',med.toFixed(2)).replace('{n}',N).replace('{ror}',pc(ruin50/S*100));
    $('verdict').textContent=v;
    $('out').hidden=false;$('status').textContent='';
  }
  $('run').addEventListener('click',run);run();
})();
</script>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;
}

function backPage(lang) {
  const S = T.SHARED[lang || 'en'], B = T.BACK[lang || 'en'], code = lang || 'en';
  const slug = 'crypto-backtester', url = `https://marginpad.io/${lang ? lang + '/' : ''}${slug}/`;
  const titleFull = escAttr(B.metaTitle + ' | MarginPad');
  return `<!DOCTYPE html>
<html lang="${code}"${RTL[lang] ? ' dir="rtl"' : ''}>
<head>
${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<title>${titleFull}</title>
<meta name="description" content="${escAttr(B.metaDesc)}" />
<meta name="keywords" content="${escAttr(B.keywords)}" />
<link rel="canonical" href="${url}" />
${hreflang(slug)}
<meta name="theme-color" content="#08090b" />
<meta property="og:title" content="${titleFull}" />
<meta property="og:description" content="${escAttr(B.ogDesc)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${titleFull}" />
<meta name="twitter:description" content="${escAttr(B.ogDesc)}" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="stylesheet" href="/assets/lab.css" />
<style>
  .eq{height:230px}
  .faq h3{font-family:'Bricolage Grotesque',sans-serif;font-size:15.5px;font-weight:700;margin:22px 0 6px;letter-spacing:-.01em}
  .faq p{color:var(--dim);font-size:14px;line-height:1.65;margin:0;max-width:760px}
  .prose p{color:var(--dim);font-size:14.5px;line-height:1.7;max-width:760px;margin:0 0 12px}
</style>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication","name":"Crypto Strategy Backtester","applicationCategory":"FinanceApplication","operatingSystem":"Any","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"url":"https://marginpad.io/crypto-backtester/","description":${J(B.appDesc)}}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":${J(S.toolsAll)},"item":"https://marginpad.io/${lang ? lang + '/' : ''}tools/"},{"@type":"ListItem","position":2,"name":${J(B.h1)},"item":"${url}"}]}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":${J(B.faq1q)},"acceptedAnswer":{"@type":"Answer","text":${J(B.faq1a)}}},{"@type":"Question","name":${J(B.faq2q)},"acceptedAnswer":{"@type":"Answer","text":${J(B.faq2a)}}},{"@type":"Question","name":${J(B.faq3q)},"acceptedAnswer":{"@type":"Answer","text":${J(B.faq3a)}}}]}
</script>
</head>
<body>
${topbar(lang, S, slug)}
<div class="wrap">
  <section class="hero">
    <span class="eyebrow">${B.eyebrow}</span>
    <h1>${B.h1}</h1>
    <p class="sub">${B.sub}</p>
  </section>

  <div class="toolbar">
    <div class="row">
      <label class="f">${B.lblCoin}<input id="coin" value="BTC" maxlength="12" autocomplete="off" style="width:110px"></label>
      <label class="f">${B.lblTf}<select id="tf"><option value="60">1h</option><option value="240" selected>4h</option><option value="1440">1d</option><option value="15">15m</option></select></label>
      <label class="f">${B.lblStrat}<select id="strat">
        <optgroup label="Trend">
          <option value="emacross">${B.optEmaCross}</option>
          <option value="smatrend">${B.optSmaTrend}</option>
          <option value="goldcross">Golden cross (SMA 50/200)</option>
          <option value="ema3">EMA ribbon (8&gt;21&gt;50)</option>
          <option value="st">Supertrend (10, 3)</option>
          <option value="macd">MACD cross (12/26/9)</option>
        </optgroup>
        <optgroup label="Momentum">
          <option value="momo">Momentum (ROC 10 &gt; 0)</option>
          <option value="stoch">Stochastic (14,3) 20/80</option>
          <option value="rsi">${B.optRsi}</option>
          <option value="rsi2">RSI-2 scalp (10/60)</option>
        </optgroup>
        <optgroup label="Breakout">
          <option value="donch">${B.optDonch}</option>
          <option value="donch55">Donchian 55 (turtle)</option>
          <option value="bbbreak">Bollinger breakout (20,2)</option>
          <option value="kelt">Keltner breakout (20, 2xATR)</option>
        </optgroup>
        <optgroup label="Mean reversion">
          <option value="bbrevert">Bollinger dip-buy (20,2)</option>
          <option value="mrev">Buy 2% below SMA-20</option>
        </optgroup>
      </select></label>
      <label class="f">${B.lblCap}<input id="cap" type="number" value="1000" min="1" style="width:110px"></label>
      <label class="f">${B.lblFee}<input id="fee" type="number" value="0.05" step="0.01" min="0" style="width:90px"></label>
      <button class="btn" id="run">${B.btnRun}</button>
    </div>
    <div class="status" id="status"></div>
  </div>

  <div id="out" hidden>
    <h2>${B.h2result} <span class="muted" id="resSub"></span></h2>
    <div class="kpis" id="kpis"></div>

    <h2>${B.h2equity}</h2>
    <div class="tablewrap" style="padding:16px 18px 14px">
      <svg class="viz eq" id="eq" viewBox="0 0 600 230" preserveAspectRatio="none" style="margin-top:0;border:none;background:transparent"></svg>
      <div class="legend"><span><i style="background:#c2f64a"></i>${B.legStrategy}</span><span><i style="background:#5c656f"></i>${B.buyHold}</span></div>
    </div>

    <h2>${B.h2trades} <span class="muted" id="trSub"></span></h2>
    <div class="tablewrap"><div class="tablescroll"><table id="trades"></table></div></div>
  </div>

  <h2>${B.h2how}</h2>
  <div class="prose">
    <p>${B.prose1}</p>
    <p>${B.prose2}</p>
  </div>

  <h2>${B.h2faq}</h2>
  <div class="faq">
    <h3>${B.faq1q}</h3>
    <p>${B.faq1a}</p>
    <h3>${B.faq2q}</h3>
    <p>${B.faq2a}</p>
    <h3>${B.faq3q}</h3>
    <p>${B.faq3a}</p>
  </div>
</div>

${footer(lang, S)}
<script>
(function(){
  var $=function(id){return document.getElementById(id);};
  function ema(v,p){var k=2/(p+1),o=[],e;for(var i=0;i<v.length;i++){e=i?v[i]*k+o[i-1]*(1-k):v[i];o.push(e);}return o;}
  function sma(v,p){var o=[],s=0;for(var i=0;i<v.length;i++){s+=v[i];if(i>=p)s-=v[i-p];o.push(i>=p-1?s/p:NaN);}return o;}
  function rsi(v,p){var o=[],g=0,l=0;for(var i=0;i<v.length;i++){if(i===0){o.push(NaN);continue;}var ch=v[i]-v[i-1],u=ch>0?ch:0,d=ch<0?-ch:0;if(i<=p){g+=u;l+=d;o.push(i===p?100-100/(1+(l===0?100:g/l)):NaN);if(i===p){g/=p;l/=p;}}else{g=(g*(p-1)+u)/p;l=(l*(p-1)+d)/p;o.push(100-100/(1+(l===0?100:g/l)));}}return o;}
  function money(x){var n=x<0;x=Math.abs(+x||0);var s=x>=1000?x.toLocaleString('en-US',{maximumFractionDigits:0}):x.toFixed(2);return (n?'-$':'$')+s;}
  function pct(x){return (x>=0?'+':'')+(+x).toFixed(1)+'%';}
  function stdv(v,p){var o=[];for(var i=0;i<v.length;i++){if(i<p-1){o.push(NaN);continue;}var s=0,j;for(j=i-p+1;j<=i;j++)s+=v[j];var m=s/p,q=0;for(j=i-p+1;j<=i;j++)q+=(v[j]-m)*(v[j]-m);o.push(Math.sqrt(q/p));}return o;}
  function atr(h,l,c,p){var tr=[],o=[];for(var i=0;i<c.length;i++){tr.push(i?Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])):h[i]-l[i]);}var a=0;for(i=0;i<c.length;i++){if(i<p){a+=tr[i];o.push(i===p-1?a/p:NaN);}else{a=(o[i-1]*(p-1)+tr[i])/p;o.push(a);}}return o;}
  function donchWant(c,h,P){var want=[],inpos=false;for(var i=0;i<c.length;i++){if(i<P){want.push(false);continue;}var hh=-Infinity,ll=Infinity;for(var j=i-P;j<i;j++){if(h[j]>hh)hh=h[j];}for(j=i-Math.ceil(P/2);j<i;j++){}if(!inpos&&c[i]>hh)inpos=true;else if(inpos){var mid=0,n=0;for(j=Math.max(0,i-P);j<i;j++){mid+=c[j];n++;}if(c[i]<mid/n)inpos=false;}want.push(inpos);}return want;}
  function signals(strat,c,h,l){
    var want=[],i,j,inpos=false;
    if(strat==='emacross'){var f=ema(c,9),s=ema(c,21);for(i=0;i<c.length;i++)want.push(f[i]>s[i]);}
    else if(strat==='smatrend'){var m=sma(c,50);for(i=0;i<c.length;i++)want.push(isFinite(m[i])&&c[i]>m[i]);}
    else if(strat==='goldcross'){var s50=sma(c,50),s200=sma(c,200);for(i=0;i<c.length;i++)want.push(isFinite(s200[i])&&s50[i]>s200[i]);}
    else if(strat==='ema3'){var e8=ema(c,8),e21=ema(c,21),e50=ema(c,50);for(i=0;i<c.length;i++)want.push(i>50&&e8[i]>e21[i]&&e21[i]>e50[i]);}
    else if(strat==='st'){var a10=atr(h,l,c,10),dir=1,ub=NaN,lb=NaN;for(i=0;i<c.length;i++){if(!isFinite(a10[i])){want.push(false);continue;}var hl2=(h[i]+l[i])/2,bu=hl2+3*a10[i],bl=hl2-3*a10[i];ub=isFinite(ub)?(c[i-1]>ub?bu:Math.min(bu,ub)):bu;lb=isFinite(lb)?(c[i-1]<lb?bl:Math.max(bl,lb)):bl;if(dir===1&&c[i]<lb)dir=-1;else if(dir===-1&&c[i]>ub)dir=1;want.push(dir===1);}}
    else if(strat==='macd'){var e12=ema(c,12),e26=ema(c,26),md=[],sg;for(i=0;i<c.length;i++)md.push(e12[i]-e26[i]);sg=ema(md,9);for(i=0;i<c.length;i++)want.push(i>30&&md[i]>sg[i]);}
    else if(strat==='momo'){for(i=0;i<c.length;i++)want.push(i>=10&&c[i]>c[i-10]);}
    else if(strat==='stoch'){for(i=0;i<c.length;i++){if(i<14){want.push(false);continue;}var hh=-Infinity,ll=Infinity;for(j=i-13;j<=i;j++){if(h[j]>hh)hh=h[j];if(l[j]<ll)ll=l[j];}var kk=hh>ll?(c[i]-ll)/(hh-ll)*100:50;if(!inpos&&kk<20)inpos=true;else if(inpos&&kk>80)inpos=false;want.push(inpos);}}
    else if(strat==='rsi'){var r=rsi(c,14);for(i=0;i<c.length;i++){if(!isFinite(r[i])){want.push(false);continue;}if(!inpos&&r[i]<30)inpos=true;else if(inpos&&r[i]>55)inpos=false;want.push(inpos);}}
    else if(strat==='rsi2'){var r2=rsi(c,2);for(i=0;i<c.length;i++){if(!isFinite(r2[i])){want.push(false);continue;}if(!inpos&&r2[i]<10)inpos=true;else if(inpos&&r2[i]>60)inpos=false;want.push(inpos);}}
    else if(strat==='donch55'){want=donchWant(c,h,55);}
    else if(strat==='bbbreak'){var m20=sma(c,20),sd=stdv(c,20);for(i=0;i<c.length;i++){if(!isFinite(m20[i])){want.push(false);continue;}if(!inpos&&c[i]>m20[i]+2*sd[i])inpos=true;else if(inpos&&c[i]<m20[i])inpos=false;want.push(inpos);}}
    else if(strat==='kelt'){var e20=ema(c,20),a10b=atr(h,l,c,10);for(i=0;i<c.length;i++){if(!isFinite(a10b[i])||i<20){want.push(false);continue;}if(!inpos&&c[i]>e20[i]+2*a10b[i])inpos=true;else if(inpos&&c[i]<e20[i])inpos=false;want.push(inpos);}}
    else if(strat==='bbrevert'){var mB=sma(c,20),sdB=stdv(c,20);for(i=0;i<c.length;i++){if(!isFinite(mB[i])){want.push(false);continue;}if(!inpos&&c[i]<mB[i]-2*sdB[i])inpos=true;else if(inpos&&c[i]>mB[i])inpos=false;want.push(inpos);}}
    else if(strat==='mrev'){var mR=sma(c,20);for(i=0;i<c.length;i++){if(!isFinite(mR[i])){want.push(false);continue;}if(!inpos&&c[i]<mR[i]*0.98)inpos=true;else if(inpos&&c[i]>=mR[i])inpos=false;want.push(inpos);}}
    else{want=donchWant(c,h,20);}
    return want;
  }
  function run(){
    var coin=($('coin').value||'BTC').toUpperCase().replace(/[^A-Z0-9]/g,'')||'BTC';
    var tf=$('tf').value, strat=$('strat').value, cap0=+$('cap').value||1000, fee=(+$('fee').value||0)/100;
    $('status').textContent=${J(B.jsLoadingPre)}+coin+${J(B.jsLoadingPost)}; $('run').disabled=true;
    fetch('/api/klines?symbol='+coin+'&interval='+tf,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(d){
      var k=Array.isArray(d)?d:((d&&(d.klines||d.data||d.candles))||[]);
      k=k.map(function(x){return Array.isArray(x)?{time:x[0],open:+x[1],high:+x[2],low:+x[3],close:+x[4]}:{time:x.time,open:+x.open,high:+x.high,low:+x.low,close:+x.close};}).filter(function(x){return isFinite(x.close);});
      if(k.length<60){$('status').textContent=${J(B.jsNotEnoughPre)}+coin+${J(B.jsNotEnoughPost)};$('run').disabled=false;return;}
      var c=k.map(function(x){return x.close;}),h=k.map(function(x){return x.high;}),l=k.map(function(x){return x.low;});
      var want=signals(strat,c,h,l);
      var eq=cap0, pos=0, entry=0, trades=[], curve=[], bh=cap0, peak=cap0, maxDD=0;
      for(var i=1;i<k.length;i++){
        if(pos>0){eq*= (c[i]/c[i-1]);}
        var sigPrev=want[i-1];
        if(pos===0 && sigPrev){pos=eq/c[i]*(1-fee);entry=c[i];eq*=(1-fee);}
        else if(pos>0 && !sigPrev){var ret=(c[i]/entry)-1;eq*=(1-fee);trades.push({i:i,entry:entry,exit:c[i],ret:ret*100-fee*200,t:k[i].time});pos=0;}
        bh*= (c[i]/c[i-1]);
        if(eq>peak)peak=eq; var dd=(eq-peak)/peak*100; if(dd<maxDD)maxDD=dd;
        curve.push({s:eq,b:bh});
      }
      if(pos>0){var rr=(c[c.length-1]/entry)-1;trades.push({i:k.length-1,entry:entry,exit:c[c.length-1],ret:rr*100-fee*100,t:k[k.length-1].time,open:true});}
      var wins=trades.filter(function(t){return t.ret>0;}),losses=trades.filter(function(t){return t.ret<=0;});
      var gw=wins.reduce(function(s,t){return s+t.ret;},0),gl=Math.abs(losses.reduce(function(s,t){return s+t.ret;},0));
      var ret=(eq/cap0-1)*100, bhret=(bh/cap0-1)*100, wr=trades.length?wins.length/trades.length*100:0;
      var pf=gl>0?gw/gl:(gw>0?99:0), avgW=wins.length?gw/wins.length:0, avgL=losses.length?-gl/losses.length:0;
      render({coin:coin,tf:tf,ret:ret,bhret:bhret,eq:eq,cap0:cap0,trades:trades,wr:wr,pf:pf,avgW:avgW,avgL:avgL,maxDD:maxDD,curve:curve,bars:k.length});
      $('status').textContent=''; $('run').disabled=false;
    }).catch(function(){$('status').textContent=${J(B.jsErr)};$('run').disabled=false;});
  }
  function render(R){
    $('out').hidden=false;
    var tfl={'15':'15m','60':'1h','240':'4h','1440':'1d'}[R.tf]||R.tf;
    $('resSub').textContent='· '+R.coin+' '+tfl+' · '+R.bars+${J(B.jsCandles)};
    function kpi(v,l,cls){return '<div class="kpi '+(cls||'')+'"><div class="v '+(cls||'')+'">'+v+'</div><div class="l">'+l+'</div></div>';}
    $('kpis').innerHTML=kpi(pct(R.ret),${J(B.kStratReturn)},R.ret>=0?'pos':'neg')
      +kpi(pct(R.bhret),${J(B.buyHold)},R.bhret>=0?'pos':'neg')
      +kpi((R.ret-R.bhret>=0?'+':'')+(R.ret-R.bhret).toFixed(1)+'%',${J(B.kVsHold)},R.ret-R.bhret>=0?'pos':'neg')
      +kpi(R.trades.length,${J(B.kTrades)})
      +kpi(R.wr.toFixed(0)+'%',${J(B.kWinRate)})
      +kpi(R.pf.toFixed(2),${J(B.kProfitFactor)})
      +kpi(R.avgW.toFixed(1)+'%',${J(B.kAvgWin)},'pos')
      +kpi(R.avgL.toFixed(1)+'%',${J(B.kAvgLoss)},'neg')
      +kpi(R.maxDD.toFixed(1)+'%',${J(B.kMaxDD)},'neg')
      +kpi(money(R.eq),${J(B.kFinalEquity)},R.eq>=R.cap0?'pos':'neg');
    var cv=R.curve,mn=Infinity,mx=-Infinity;cv.forEach(function(p){mn=Math.min(mn,p.s,p.b);mx=Math.max(mx,p.s,p.b);});
    var W=600,H=230,pad=8;function X(i){return pad+i/(cv.length-1||1)*(W-2*pad);}function Y(v){return H-pad-((v-mn)/((mx-mn)||1))*(H-2*pad);}
    function path(key){var d='';cv.forEach(function(p,i){d+=(i?'L':'M')+X(i).toFixed(1)+' '+Y(p[key]).toFixed(1);});return d;}
    $('eq').innerHTML='<path d="'+path('b')+'" fill="none" stroke="#5c656f" stroke-width="1.5"/><path d="'+path('s')+'" fill="none" stroke="#c2f64a" stroke-width="2"/>';
    $('trSub').textContent='· '+R.trades.length+${J(B.jsTotal)};
    var rows='<thead><tr><th>#</th><th>${B.thEntry}</th><th>${B.thExit}</th><th>${B.thReturn}</th></tr></thead><tbody>';
    R.trades.slice().reverse().forEach(function(t,idx){var n=R.trades.length-idx;rows+='<tr><td>'+n+(t.open?' <span style="color:#ffb347">'+${J(B.jsOpen)}+'</span>':'')+'</td><td>'+t.entry.toPrecision(6)+'</td><td>'+t.exit.toPrecision(6)+'</td><td class="'+(t.ret>=0?'pos':'neg')+'">'+pct(t.ret)+'</td></tr>';});
    rows+='</tbody>';
    $('trades').innerHTML=rows;
  }
  $('run').addEventListener('click',run);
  $('coin').addEventListener('keydown',function(e){if(e.key==='Enter')run();});
  run();
})();
</script>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;
}

let n = 0;
function write(rel, html) { const d = path.join(DIST, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'index.html'), html); n++; }
write('pivot-point-calculator', pivotPage(''));
write('crypto-correlation-matrix', corrPage(''));
write('risk-of-ruin-calculator', riskPage(''));
write('crypto-backtester', backPage(''));
for (const lc of LANG_CODES) { write(path.join(lc, 'pivot-point-calculator'), pivotPage(lc)); write(path.join(lc, 'crypto-correlation-matrix'), corrPage(lc)); write(path.join(lc, 'risk-of-ruin-calculator'), riskPage(lc)); write(path.join(lc, 'crypto-backtester'), backPage(lc)); }
console.log('wrote', n, 'tool pages (pivot + correlation + risk + backtester, en + 12 langs each)');
