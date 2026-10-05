
/* Spanish for this file. Inline, not the lazy i18n pack: a string that fires before a pack
   arrives would be English, which is the partial translation this exists to end. A top-level function
   declaration so every IIFE in the file can see it (see the mp-nav cookie-bar incident, 2026-09-19). */
var __esD_mpscreener = {"loadingOnChainPools":"<div class=\"scr-loading\">Cargando pools on-chain…</div>","noPoolsRightNow":"<div class=\"scr-loading\">No hay pools por ahora - prueba la otra pestaña.</div>","technicalAnalysisNotAvaila":"<div class=\"scr-an-note\">El análisis técnico aún no está disponible para este par.</div>","openInt":"</b></div><div><span>Int. abierto</span><b>","noHighConvictionSetup":"<div class=\"scr-an-note\">Sin setup de alta convicción - zona neutral, espera confirmación.</div>","mostVolatile":"Más volátil","noPairsMatchClear":"Ningún par coincide - borra la búsqueda/filtro.","noDataRetryShortly":"Sin datos - vuelve a intentarlo en breve.","marketsUnavailableRetrySho":"<div class=\"scr-loading\">Mercados no disponibles - vuelve a intentarlo en breve.</div>","notIn":"No disponible en ","yourCountry":"tu país","tradeRarr":"Operar &rarr;","openInterest":"<div><span>Interés abierto</span><b>","liquidatedIn24hWatch":" liquidados en 24h - mira en vivo →</a>","loadingLiveDerivativesData":"<div class=\"scr-live-load\">Cargando datos de derivados en vivo…</div>",
  "colCoin":"Moneda","colPrice":"Precio","colChg":"24h","colVol":"Vol 24h","colOi":"OI","colFund":"Funding","colOiChg":"OI Δ24h","colLiq":"Liq 24h","colRsi":"RSI","colTrend":"Tendencia","colSetup":"Setup",
  "showAllPairs":"Ver los {n} pares","morePairs":"{n} más","bestLongSetup":"Mejor setup largo","bestShortSetup":"Mejor setup corto","score":"score","range4h":"rango · 4h",
  "volumePairs":"Vol 24h","pairs":"pares","bullish":"Alcistas","bearish":"Bajistas","scored":"con score","avg":"media","liveExch":"bolsas en vivo",
  "trendUp":"↗ Sube","trendDown":"↘ Baja","trendSide":"→ Lateral","up":"sube","down":"baja","side":"lateral",
  "setupNote":"Si salta el stop pierdes el {p}% del margen · niveles por ATR 4h · simulación, no es un consejo",
  "technicalScore4h":"score técnico · 4h","trend":"Tendencia","volatility":"Volatilidad","bullishW":"Alcista","bearishW":"Bajista","setupW":"setup",
  "setPriceAlert":"Crear alerta de precio","openInPaperTrade":"Abrir en Paper Trade (demo)","notOnBybit":"No está en Bybit · solo ver","openChart":"Abrir en el gráfico",
  "liveDerivatives":"Derivados en vivo","realTime":"· MarginPad · tiempo real","fundingRate":"Tasa de funding","liqLongs":"Liq 24h · largos","liqShorts":"Liq 24h · cortos","longPct":"Largos ","shortPct":" Cortos","tradeSym":"Operar ",
  "aiBestSetups":"Mejores setups por IA","aiScanTease":"Los 3 setups más fuertes entre las grandes, ordenados por IA - toca para abrir y dibujar.","plusSp":"Premium Plus","confSp":"conf","openDrawChart":"Abrir y dibujar en el gráfico","justNow":"ahora mismo","agoSp":"atrás"};
function __esT_mpscreener(k, en) { try { if ((document.documentElement.lang || "").slice(0, 2).toLowerCase() === "es" && __esD_mpscreener[k] != null) return __esD_mpscreener[k]; } catch (e) {} return en; }
/* Market Screener - live USDT-perp TABLE (multi-exchange via /api/screener: aggregated volume, venue count, median-price cross-check),
   sortable by every column header, with a per-coin action sheet. Runs only on /screener.
   2026-10-05: it was a list of 119 full-width cards (16,786px desktop / 25,414px phone) with ZERO coins in the first screen on
   either; measured before the rewrite. Now a dense table, first 30 rows + "Show all", the banners below the data, and every
   interaction sends a `screener` beacon so the next decision is made from use, not by eye. */
(function(){
  var listEl=document.getElementById('scrList');if(!listEl)return;
  if(!/^\/screener\/?$/.test((location.pathname||'').replace(/^\/es(?=\/|$)/,'')))return; /* /es/screener too (audit 2026-09-25) */ // dedicated route only - don't fetch on every homepage load
  try{window.mpLoadTokens&&window.mpLoadTokens();}catch(e){} // warm the Bybit set so window.mpIsBybit() can gate the sheet's paper-trade action
  var T=__esT_mpscreener;
  var DATA=[],sortKey='score',sortDir='desc',filterKey='all',query='',sheet=null,curRow=null,LOGOS={},NAMES={},showAll=false,LIMIT=30;
  function track(e){try{window.__mpTrack&&window.__mpTrack('screener',String(e||'').slice(0,40));}catch(_e){}}
  function wlGet(){try{return JSON.parse(localStorage.getItem('mp_watchlist')||'[]');}catch(e){return [];}}
  function wlHas(s){var a=wlGet();return a.indexOf(s+'USDT')>=0||a.indexOf(s)>=0;}
  function wlToggle(s){var a=wlGet(),k=s+'USDT',i=a.indexOf(k);if(i<0&&a.indexOf(s)>=0){k=s;i=a.indexOf(s);}if(i>=0)a.splice(i,1);else a.push(k);try{localStorage.setItem('mp_watchlist',JSON.stringify(a));}catch(e){}}
  function fmtPx(p){p=+p;return '$'+p.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:p>=1?2:6});}
  function fmtBig(n){n=+n;if(n>=1e9)return '$'+(n/1e9).toFixed(2)+'B';if(n>=1e6)return '$'+(n/1e6).toFixed(1)+'M';if(n>=1e3)return '$'+(n/1e3).toFixed(0)+'K';return '$'+(n||0).toFixed(0);}
  /* ===== On-chain · Memecoins mode (GeckoTerminal trending + new pairs - the DexScreener direction) ===== */
  var OC=null,ocTab='trending',scrMode='perp';
  function ocAge(t){if(!t)return '';var h=(Date.now()-t)/3600000;return h<1?Math.max(1,Math.round(h*60))+'m':h<24?Math.round(h)+'h':Math.round(h/24)+'d';}
  function ocPx(p){p=+p;if(p>=1)return '$'+p.toLocaleString('en-US',{maximumFractionDigits:2});if(p>=0.0001)return '$'+p.toFixed(6).replace(/0+$/,'').replace(/\.$/,'');var s=p.toExponential(2);return '$'+s;}
  function ocRow(p){var up=p.chg24>=0,bs=p.buys+p.sells>0?Math.round(p.buys/(p.buys+p.sells)*100):null;
    return '<a class="oc-row" href="'+esc(p.url)+'" target="_blank" rel="noopener">'
      +'<span class="oc-l1"><span class="oc-sym">'+esc(p.n)+'</span><span class="oc-net">'+esc(p.net)+'</span><span class="oc-age">'+ocAge(p.age)+' old</span></span>'
      +'<span class="oc-px">'+ocPx(p.px)+'<span class="chg '+(up?'up':'dn')+'">'+(up?'+':'')+(+p.chg24).toFixed(1)+'%</span></span>'
      +'<span class="oc-boxes">'
        +'<span class="oc-box">Vol 24h <b>'+fmtBig(p.vol)+'</b></span>'
        +'<span class="oc-box">Liquidity <b>'+fmtBig(p.liq)+'</b></span>'
        +(p.fdv>0?'<span class="oc-box">FDV <b>'+fmtBig(p.fdv)+'</b></span>':'')
        +(bs!=null?'<span class="oc-box">B/S <b class="bs-b">'+p.buys+'</b>/<b class="bs-s">'+p.sells+'</b> ('+bs+'% buys)</span>':'')
        +(p.chg1!=null?'<span class="oc-box">1h <b class="'+(p.chg1>=0?'bs-b':'bs-s')+'">'+(p.chg1>=0?'+':'')+(+p.chg1).toFixed(1)+'%</b></span>':'')
      +'</span></a>';}
  function ocRender(){var el=document.getElementById('scrOcList');if(!el)return;
    if(!OC){el.innerHTML=T("loadingOnChainPools",'<div class="scr-loading">Loading on-chain pools…</div>');return;}
    var list=(ocTab==='fresh'?OC.fresh:OC.trending)||[];
    el.innerHTML=list.length?list.map(ocRow).join(''):T("noPoolsRightNow",'<div class="scr-loading">No pools right now - try the other tab.</div>');}
  function ocLoad(){fetch('/api/onchain').then(function(r){return r.ok?r.json():null;}).then(function(d){if(d&&(d.trending||d.fresh)){OC=d;ocRender();}}).catch(function(){});}
  function esc(s){return String(s==null?'':s).replace(/[<>&"]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m];});}
  (function(){var mode=document.getElementById('scrMode'),oc=document.getElementById('scrOnchain');if(!mode||!oc)return;
    var perpEls=['scrTop','scrFbar','scrList'].map(function(id){return document.getElementById(id);});
    mode.addEventListener('click',function(ev){var b=ev.target.closest('button[data-mode]');if(!b)return;
      scrMode=b.getAttribute('data-mode');mode.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);});
      var on=scrMode==='onchain';oc.hidden=!on;perpEls.forEach(function(e){if(e)e.style.display=on?'none':'';});
      if(on){if(!OC)ocLoad();track('onchain');}else track('perp');});
    var tabs=document.getElementById('scrOcTabs');if(tabs)tabs.addEventListener('click',function(ev){var b=ev.target.closest('button[data-oct]');if(!b)return;ocTab=b.getAttribute('data-oct');tabs.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);});ocRender();track('onchain:'+ocTab);});
    setInterval(function(){if(scrMode==='onchain'&&!document.hidden)ocLoad();},180000);
  })();
  // screener enrichment from OUR collector: per-coin 24h liquidations + OI Δ24h - data no free screener shows
  var XTRA={};
  function loadXtra(){fetch('/api/v1/screener-extra').then(function(r){return r.ok?r.json():null;}).then(function(d){if(d&&(d.liq||d.oi)){XTRA=d;try{render();}catch(_e){}}}).catch(function(){});}
  loadXtra();setInterval(loadXtra,180000);
  function pct(v){return ((+v)>=0?'+':'')+(+v).toFixed(2)+'%';}
  /* funding is a rate per 8h in the 0.001-0.05% range: two decimals printed "+0.00%" / "+0.01%" for every coin on the board,
     so the column carried a sign and nothing else. Four decimals is what the venues print. */
  function fundTxt(v){v=+v||0;return (v>=0?'+':'')+v.toFixed(4)+'%';}
  function live(s,fb){var lp=window.mpLivePrices&&window.mpLivePrices[s];return lp&&lp.p>0?lp.p:fb;}
  function scoreCls(s){return s==null?'neu':s>=75?'bull':s>=60?'bull2':s>=40?'neu':s>=25?'bear2':'bear';}
  function trendTxt(t){return t==='up'?T("trendUp",'↗ Up'):t==='down'?T("trendDown",'↘ Down'):T("trendSide",'→ Side');}
  function symColor(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return 'hsl('+h+',60%,56%)';}
  /* a coin outside CoinGecko's top 250 (the slim list) used to get a letter: 45 of 127 rows on 2026-10-05. The worker's
     /api/coinicon resolves the long tail (aliases, exact-ticker search, stock logos, our own metal/oil icons) and caches it;
     a symbol nothing resolves keeps the letter - a wrong logo would be worse. */
  function icHtml(s){var src=LOGOS[s]||('/api/coinicon?sym='+encodeURIComponent(s));return '<span class="scr-ic" style="--c:'+symColor(s)+'">'+s.charAt(0)+'<img src="'+src+'" alt="" loading="lazy" onerror="this.style.display=\'none\'"></span>';}
  function loadLogos(){fetch('/api/gecko/markets?slim=1',{cache:'force-cache'}).then(function(r){return r.ok?r.json():null;}).then(function(a){if(!a||!a.length)return;a.forEach(function(c){var sym=(c.symbol||'').toUpperCase();if(sym){if(c.image)LOGOS[sym]=c.image;if(c.name)NAMES[sym]=c.name;}});if(DATA.length)render();}).catch(function(){});}
  function anHtml(e){if(e.score==null)return T("technicalAnalysisNotAvaila",'<div class="scr-an-note">Technical analysis not available for this pair yet.</div>');
    var cls=scoreCls(e.score),h='<div class="scr-an"><div class="scr-an-top sc-'+cls+'"><div class="scr-an-num">'+e.score+'<small>/100</small></div><div class="scr-an-v"><b>'+(e.verdict||'')+'</b><span>'+T("technicalScore4h",'technical score · 4h')+'</span></div></div>';
    h+='<div class="scr-an-grid"><div><span>'+T("trend",'Trend')+'</span><b>'+trendTxt(e.trend)+'</b></div><div><span>RSI</span><b>'+(e.rsi!=null?e.rsi:'-')+'</b></div><div><span>MACD</span><b>'+(e.macd==='bull'?T("bullishW",'Bullish'):e.macd==='bear'?T("bearishW",'Bearish'):'-')+'</b></div><div><span>Funding</span><b class="'+((e.f||0)>=0?'up':'dn')+'">'+fundTxt(e.f)+'</b></div><div><span>'+T("volatility",'Volatility')+'</span><b>'+(e.atrPct!=null?e.atrPct+'%':'-')+T("openInt",'</b></div><div><span>Open Int.</span><b>')+fmtBig(e.oi||0)+'</b></div></div>';
    if(e.sig&&e.sig.length)h+='<div class="scr-an-sig">'+e.sig.map(function(s){var pos=/bullish|golden|oversold|above 200|breakout|negative fund|at support|spike \(up/i.test(s),neg=/bearish|death|overbought|below 200|high positive|spike \(down/i.test(s);return '<span class="'+(pos?'pos':neg?'neg':'')+'">'+s+'</span>';}).join('')+'</div>';
    if(e.setup){var su=e.setup,L=su.dir==='long';
      /* `lev` and `levAgg` are the same number on every row the server has ever sent (worker: `levAgg: lev`), so this used to print "56–56×" */
      h+='<div class="scr-setup '+(L?'long':'short')+'"><div class="scr-setup-h">'+(L?'▲ LONG':'▼ SHORT')+' '+T("setupW",'setup')+' · '+su.lev+'× · R:R '+su.rrr+'</div><div class="scr-setup-g"><span>Entry<b>'+fmtPx(su.entry)+'</b></span><span>Stop<b>'+fmtPx(su.sl)+'</b></span><span>TP1<b>'+fmtPx(su.tp1)+'</b></span><span>TP2<b>'+fmtPx(su.tp2)+'</b></span><span>TP3<b>'+fmtPx(su.tp3)+'</b></span></div>'
        /* what the stop costs at that leverage - the server computes slLossPct for every setup and nothing showed it; a reader
           picking 54x off this card should know it is sized so the stop takes about half the margin */
        +(su.slLossPct!=null?'<div class="scr-setup-n">'+T("setupNote",'If the stop hits you lose {p}% of margin · levels from 4h ATR · simulation, not advice').replace('{p}',Math.round(su.slLossPct*100))+'</div>':'')+'</div>';}
    else h+=T("noHighConvictionSetup",'<div class="scr-an-note">No high-conviction setup - neutral zone, wait for confirmation.</div>');
    return h+'</div>';}
  /* ---- sorting: one value function per column, nulls always last whichever direction ---- */
  function xo(e){return XTRA.oi&&XTRA.oi[e.s];}
  function xl(e){return XTRA.liq&&XTRA.liq[e.s];}
  function sv(e,k){var o;
    switch(k){
      case 'score':return e.score;
      case 'chg':return e.chg;
      case 'vol':return e.vol;
      case 'oi':return e.oi||0;
      case 'fund':return e.f==null?null:+e.f;
      case 'fundabs':return e.f==null?null:Math.abs(+e.f);
      case 'oichg':o=xo(e);return o&&o.chg!=null?+o.chg:null;
      case 'liq':o=xl(e);return o&&o.liq>0?+o.liq:null;
      case 'rsi':return e.rsi;
      case 'trend':return e.trend==='up'?2:e.trend==='down'?0:1;
      case 'setup':return e.setup?(e.setup.dir==='long'?2:0):1;
      case 'vol24':return (e.hi-e.lo)/(e.lo||1);
    }return null;}
  function sorted(){var d=DATA.slice();
    if(query)d=d.filter(function(e){return e.s.indexOf(query)>=0||((NAMES[e.s]||'').toUpperCase().indexOf(query)>=0);});
    if(filterKey==='long')d=d.filter(function(e){return e.setup&&e.setup.dir==='long';});
    else if(filterKey==='short')d=d.filter(function(e){return e.setup&&e.setup.dir==='short';});
    else if(filterKey==='watch')d=d.filter(function(e){return wlHas(e.s);});
    var k=sortKey,desc=sortDir!=='asc';
    d.sort(function(a,b){var va=sv(a,k),vb=sv(b,k),na=(va==null||!isFinite(va)),nb=(vb==null||!isFinite(vb));
      if(na&&nb)return b.vol-a.vol;if(na)return 1;if(nb)return -1;
      return (desc?vb-va:va-vb)||(b.vol-a.vol);});
    return d;}
  function renderTop(d){var totVol=0,bull=0,bear=0,scSum=0,scN=0,vmax=0;
    d.forEach(function(e){totVol+=(e.vol||0);if((e.vens||0)>vmax)vmax=e.vens;if(e.score!=null){scSum+=e.score;scN++;if(e.score>=60)bull++;else if(e.score<=40)bear++;}});
    var avg=scN?Math.round(scSum/scN):0,st=document.getElementById('scrStats');
    // bullish/bearish can only come from rows that carry a technical score, so the denominator is scN - not
    // every row on the board. Stocks, metals and commodities ship without a score and used to inflate it.
    if(st)st.innerHTML='<span class="scr-st"><i>'+T("volumePairs",'24h vol')+'</i><b>'+fmtBig(totVol)+'</b><small>· '+d.length+' '+T("pairs",'pairs')+'</small></span>'
      +'<span class="scr-st"><i>'+T("bullish",'Bullish')+'</i><b class="up">'+bull+'</b><i>'+T("bearish",'Bearish')+'</i><b class="dn">'+bear+'</b><small>· '+scN+' '+T("scored",'scored')+' · '+T("avg",'avg')+' '+avg+'</small></span>'
      +(vmax?'<span class="scr-st"><i>Live</i><b>'+vmax+'</b><small>'+T("liveExch",'exchanges')+'</small></span>':'');}
  function renderPicks(){var el=document.getElementById('scrPicks');if(!el)return;
    var L=null,S=null,V=null;
    DATA.forEach(function(e){
      if(e.setup&&e.setup.dir==='long'&&(L==null||(e.score||0)>(L.score||0)))L=e;
      if(e.setup&&e.setup.dir==='short'&&(S==null||(e.score||100)<(S.score||100)))S=e;
      var vv=(e.atrPct!=null)?+e.atrPct:((e.hi-e.lo)/(e.lo||1)*100);e._vv=vv;if(V==null||vv>V._vv)V=e;
    });
    function pk(tag,cls,e,stat){return e?'<button type="button" class="scr-pick '+cls+'" data-pick="'+e.s+'"><i>'+tag+'</i><b>'+icHtml(e.s)+e.s+'</b><span>'+stat+'</span></button>':'';}
    el.innerHTML=(L||S||V)?(pk(T("bestLongSetup",'Best long setup'),'pk-l',L,L?(T("score",'score')+' '+L.score+(L.setup.lev?' · '+L.setup.lev+'×':'')):'')
      +pk(T("bestShortSetup",'Best short setup'),'pk-s',S,S?(T("score",'score')+' '+S.score+(S.setup.lev?' · '+S.setup.lev+'×':'')):'')
      +pk(T("mostVolatile",'Most volatile'),'pk-v',V,V?((V._vv).toFixed(1)+'% '+T("range4h",'range · 4h')):'')):'';}
  var COLS=[
    {k:'score',l:'Score',c:'c-sc'},
    {k:'',l:T("colCoin",'Coin'),c:'c-coin'},
    {k:'',l:T("colPrice",'Price'),c:'c-px'},
    {k:'chg',l:T("colChg",'24h'),c:'c-num'},
    {k:'vol',l:T("colVol",'Vol 24h'),c:'c-num'},
    {k:'oi',l:T("colOi",'OI'),c:'c-num'},
    {k:'fund',l:T("colFund",'Funding'),c:'c-num'},
    {k:'oichg',l:T("colOiChg",'OI Δ24h'),c:'c-num c-x'},
    {k:'liq',l:T("colLiq",'Liq 24h'),c:'c-num c-x'},
    {k:'rsi',l:T("colRsi",'RSI'),c:'c-num'},
    {k:'trend',l:T("colTrend",'Trend'),c:'c-tr'},
    {k:'setup',l:T("colSetup",'Setup'),c:'c-su'}];
  function headHtml(){return '<thead><tr>'+COLS.map(function(c){var on=c.k&&c.k===sortKey||(c.k==='fund'&&sortKey==='fundabs');
      return '<th class="'+c.c+(on?' on '+sortDir:'')+(c.k?' sortable':'')+'"'+(c.k?' data-k="'+c.k+'" role="button" tabindex="0" aria-sort="'+(on?(sortDir==='asc'?'ascending':'descending'):'none')+'"':'')+'><span>'+c.l+'</span></th>';}).join('')+'</tr></thead>';}
  function numCell(v,cls){return '<td class="c-num'+(cls?' '+cls:'')+'">'+(v==null?'<span class="na">–</span>':v)+'</td>';}
  function rowHtml(e){var p=live(e.s,e.p),cls=(e.score==null?'na':scoreCls(e.score)),o=xo(e),l=xl(e);
    var tr=e.trend==='up'?'<span class="scr-tag t-up">↗ '+T("up",'up')+'</span>':e.trend==='down'?'<span class="scr-tag t-dn">↘ '+T("down",'down')+'</span>':(e.trend?'<span class="scr-tag">→ '+T("side",'side')+'</span>':'<span class="na">–</span>');
    var su=(e.setup&&e.setup.lev)?'<span class="scr-tag '+(e.setup.dir==='long'?'t-up':'t-dn')+'">'+(e.setup.dir==='long'?'▲':'▼')+' '+e.setup.lev+'×</span>':'<span class="na">–</span>';
    return '<tr class="scr-row" data-sym="'+e.s+'" data-p="'+e.p+'" tabindex="0">'
      +'<td class="c-sc"><span class="scr-sc sc-'+cls+'" title="'+esc(e.verdict||'')+'">'+(e.score==null?'–':e.score)+'</span></td>'
      +'<td class="c-coin"><span class="scr-coin">'+icHtml(e.s)+'<span class="scr-sym">'+e.s+'</span><span class="scr-name">'+esc(NAMES[e.s]||'')+'</span><span class="scr-star'+(wlHas(e.s)?' on':'')+'" data-star="'+e.s+'" role="button" tabindex="0" aria-label="Watchlist">★</span></span></td>'
      +'<td class="c-px"><b class="scr-px" data-px>'+fmtPx(p)+'</b></td>'
      +numCell('<b class="'+(e.chg>=0?'up':'dn')+'">'+pct(e.chg)+'</b>')
      +numCell(fmtBig(e.vol))
      +numCell(e.oi>0?fmtBig(e.oi):null)
      +numCell(e.f==null?null:'<b class="'+((+e.f)>=0?'up':'dn')+'">'+fundTxt(e.f)+'</b>')
      +numCell(o&&o.chg!=null?'<b class="'+(o.chg>=0?'up':'dn')+'">'+(o.chg>=0?'+':'')+(+o.chg).toFixed(1)+'%</b>':null,'c-x')
      +numCell(l&&l.liq>0?'<b class="liq">'+fmtBig(l.liq)+'</b>':null,'c-x')
      +numCell(e.rsi!=null?e.rsi:null)
      +'<td class="c-tr">'+tr+'</td>'
      +'<td class="c-su">'+su+'</td>'
      +'</tr>';}
  function render(){var d=sorted();renderTop(d);renderPicks();
    if(!d.length){listEl.innerHTML='<div class="scr-loading">'+((query||filterKey!=='all')?T("noPairsMatchClear",'No pairs match - clear the search/filter.'):T("noDataRetryShortly",'No data - retry shortly.'))+'</div>';return;}
    var all=showAll||!!query||filterKey!=='all',shown=all?d:d.slice(0,LIMIT),rest=d.length-shown.length;
    listEl.innerHTML='<div class="scr-tw"><table class="scr-tbl">'+headHtml()+'<tbody>'+shown.map(rowHtml).join('')+'</tbody></table></div>'
      +(rest>0?'<button type="button" class="scr-more" id="scrMore">'+T("showAllPairs",'Show all {n} pairs').replace('{n}',d.length)+' <small>· '+T("morePairs",'{n} more').replace('{n}',rest)+'</small></button>':'');}
  function updLive(){if(document.hidden)return;var rows=listEl.querySelectorAll('.scr-row');for(var i=0;i<rows.length;i++){var s=rows[i].getAttribute('data-sym'),fb=+rows[i].getAttribute('data-p'),pe=rows[i].querySelector('[data-px]');if(!pe)continue;var t=fmtPx(live(s,fb));if(pe._t!==t){pe._t=t;pe.textContent=t;}}}
  function load(){Promise.all([
      fetch('/api/screener',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
      fetch('/api/cg/funding',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
    ]).then(function(res){var j=res[0],cg=res[1];
      if(j&&j.rows&&j.rows.length){
        if(cg&&cg.coins&&cg.coins.length){var cm={};cg.coins.forEach(function(c){cm[c.s]=c;});j.rows.forEach(function(e){var c=cm[e.s];if(c){if(c.funding!=null&&isFinite(c.funding))e.f=c.funding;if(c.oiUsd!=null&&isFinite(c.oiUsd))e.oi=c.oiUsd;e.agg=true;}});}/* overlay funding + OI aggregated across all exchanges onto the majors - Bybit-only for the long tail */
        DATA=j.rows;render();
      }else if(!DATA.length){listEl.innerHTML=T("marketsUnavailableRetrySho",'<div class="scr-loading">Markets unavailable - retry shortly.</div>');}});}
  var CHIP={score:['score','desc'],gain:['chg','desc'],lose:['chg','asc'],vol:['vol','desc'],fund:['fundabs','desc'],oi:['oi','desc'],vol24:['vol24','desc']};
  function syncChips(){var fEl=document.getElementById('scrFilters');if(!fEl)return;fEl.querySelectorAll('[data-sort]').forEach(function(x){var c=CHIP[x.getAttribute('data-sort')];x.classList.toggle('on',!!c&&c[0]===sortKey&&c[1]===sortDir);});}
  function setSort(k,dir){sortKey=k;sortDir=dir;syncChips();render();track('sort:'+k+(dir==='asc'?':asc':''));}
  var fEl=document.getElementById('scrFilters');
  if(fEl)fEl.addEventListener('click',function(e){
    var f=e.target.closest('[data-filter]');
    if(f){var k=f.getAttribute('data-filter');filterKey=(filterKey===k)?'all':k;this.querySelectorAll('[data-filter]').forEach(function(x){x.classList.toggle('on',x===f&&filterKey!=='all');});render();track('filter:'+(filterKey==='all'?'off':filterKey));return;}
    var b=e.target.closest('[data-sort]');if(!b)return;var c=CHIP[b.getAttribute('data-sort')];if(c)setSort(c[0],c[1]);});
  var sIn=document.getElementById('scrSearch');
  if(sIn)sIn.addEventListener('input',function(){query=(sIn.value||'').trim().toUpperCase();render();
    clearTimeout(window.__scrSrchT);window.__scrSrchT=setTimeout(function(){if(query&&query.length>=2){try{window.__mpTrack&&window.__mpTrack('search',query+' (screener)');}catch(_){}}},1300);});
  function buildSheet(){sheet=document.createElement('div');sheet.className='scr-sheet';
    sheet.innerHTML='<div class="scr-sheet-bd"></div><div class="scr-sheet-card"><button type="button" class="scr-sheet-x" aria-label="Close">✕</button><div class="scr-sheet-h"><b id="scrSheetSym">-</b><span id="scrSheetPx"></span></div><div id="scrAn"></div><div id="scrLive"></div><div id="scrActs" style="margin:12px 0"></div>'
      +'<div class="scr-exch" id="scrExch"></div></div>';
    document.body.appendChild(sheet);
    sheet.addEventListener('click',function(e){var ex=e.target.closest&&e.target.closest('[data-ex]');if(ex){try{if(window.__mpTrack)window.__mpTrack('exchange',ex.getAttribute('data-ex'));}catch(_){}}
      var ac=e.target.closest&&e.target.closest('[data-act]');if(ac)track(ac.getAttribute('data-act')+':'+(curRow?curRow.s:''));
      if(e.target.closest('.scr-sheet-bd')||e.target.closest('.scr-sheet-x'))closeSheet();});}
  // exchanges where the pair can be traded - affiliate deep-links (Bybit/Binance open the exact pair with our ref)
  var SCR_EXCH=[
    {n:'Bybit',c:'#f7a600',fg:'#0a0b0d',u:function(s){return 'https://www.bybit.com/trade/usdt/'+s+'USDT?affiliate_id=162071&group_id=1922256&group_type=1';}},
    {n:'Binance',c:'#f0b90b',fg:'#181a20',u:function(s){return 'https://www.binance.com/en/futures/'+s+'USDT?ref=MAOZM9DS';}},
    {n:'OKX',c:'#cfd3d8',fg:'#0a0b0d',u:function(s){return 'https://okx.com/join/96160298';}}, /* the OKX pair page cannot carry our code - the join page attributes (2026-09-13) */
    {n:'Bitget',c:'#00e7d8',fg:'#06231d',u:function(s){return 'https://www.bitget.com/futures/usdt/'+s+'USDT?clacCode=DSSSQKGK';}},
    {n:'KuCoin',c:'#23af91',fg:'#06231d',u:function(s){return 'https://www.kucoin.com/futures/trade/'+(s==='BTC'?'XBT':s)+'USDTM?rcode=VHP8AYKY';}},
    {n:'Gate',c:'#3361ff',fg:'#ffffff',u:function(s){return 'https://www.gate.com/futures/USDT/'+s+'_USDT?ref=VFIWB10KUG';}},
    {n:'MEXC',c:'#0ac2d6',fg:'#06231d',u:function(s){return 'https://www.mexc.com/futures/'+s+'_USDT?inviteCode=47LrK';}},
    {n:'Hyperliquid',c:'#5ee6c8',fg:'#062a24',u:function(s){return 'https://app.hyperliquid.xyz/join/MARGINPAD';}},
    {n:'Fomo',c:'#ff4d8d',fg:'#0a0b0d',u:function(s){return 'https://fomo.family/r/Marginpad';}}, /* no public pair link keeps the referral - the /r/ link is the referral */
    {n:'Kraken',c:'#7b5cff',fg:'#ffffff',u:function(s){return 'https://invite.kraken.com/JDNW/guj2tf28';}},
    {n:'Crypto.com',c:'#0b2e7a',fg:'#ffffff',u:function(s){return 'https://crypto.com/app/sdf5hb6rkv';}}
  ];
  /* The venue list for one coin, in the order that fits the reader (2026-09-09). Ranking + referral URLs come from the
     shared partner table (window.mpEx in mp-auth.js) so this sheet can never drift from the homepage or the terminal;
     SCR_EXCH stays as the fallback when that bundle has not parsed yet. Deep links to the exact pair were already here -
     that is why this sheet converts ~5x better per pageview than the terminal did. */
  function exchHtml(sym){
    var list=SCR_EXCH.slice(),cc='',E=window.mpEx;
    if(E){try{cc=E.ccNow();var pos={};E.rank(cc).forEach(function(n,i){pos[n]=i;});
      var key=function(x){return (E.blocked(x.n,cc)?1000:0)+(pos[x.n]!=null?pos[x.n]:500);};
      list=list.map(function(x,i){return {x:x,i:i,k:key(x)};}).sort(function(a,b){return a.k-b.k||a.i-b.i;}).map(function(o){return o.x;});}catch(e){}}
    var reg=(E&&cc)?E.region(cc):'';
    return '<div class="scr-exch-h">'+T("tradeSym",'Trade ')+sym+'USDT</div>'+list.map(function(x){
      var off=E?E.blocked(x.n,cc):false, href=(E&&E.url(x.n,sym))||x.u(sym);
      return '<a class="scr-exch-a'+(off?' mp-ex-off':'')+'" href="'+href+'" target="_blank" rel="noopener sponsored" data-ex="'+x.n+'" style="--exc:'+x.c+'"><span class="scr-exch-ic" style="background:'+x.c+';color:'+x.fg+'">'+x.n.charAt(0)+'</span><span class="scr-exch-n">'+x.n+'</span><span class="scr-exch-go">'+(off?(T("notIn",'Not in ')+(reg||T("yourCountry",'your country'))):T("tradeRarr",'Trade &rarr;'))+'</span></a>';}).join('');}
  function cgBn(x){if(x==null||!isFinite(x))return '-';var a=Math.abs(x);if(a>=1e9)return '$'+(x/1e9).toFixed(2)+'B';if(a>=1e6)return '$'+(x/1e6).toFixed(1)+'M';if(a>=1e3)return '$'+(x/1e3).toFixed(0)+'K';return '$'+x.toFixed(0);}
  function cgHtml(d){if(!d||d.error)return '';var fund=(d.funding!=null&&isFinite(d.funding))?((d.funding>=0?'+':'')+d.funding.toFixed(4)+'%'):'-';var oiCh=(d.oiChg24h!=null&&isFinite(d.oiChg24h))?((d.oiChg24h>=0?'+':'')+d.oiChg24h.toFixed(2)+'%'):'';var lp=(d.longPct!=null)?d.longPct:50,sp=(d.shortPct!=null)?d.shortPct:50;
 return '<div class="scr-live"><div class="scr-live-h">'+T("liveDerivatives",'Live derivatives')+' <span>'+T("realTime",'· MarginPad · real-time')+'</span></div>'
      +'<div class="scr-live-grid">'
      +T("openInterest",'<div><span>Open interest</span><b>')+cgBn(d.oiUsd)+(oiCh?' <i class="'+(d.oiChg24h>=0?'up':'dn')+'">'+oiCh+'</i>':'')+'</b></div>'
      +'<div><span>'+T("fundingRate",'Funding rate')+'</span><b class="'+((d.funding||0)>=0?'up':'dn')+'">'+fund+'</b></div>'
      +'<div><span>'+T("liqLongs",'24h liq · longs')+'</span><b class="dn">'+cgBn(d.longLiq24h)+'</b></div>'
      +'<div><span>'+T("liqShorts",'24h liq · shorts')+'</span><b class="up">'+cgBn(d.shortLiq24h)+'</b></div>'
      +'</div>'
      +(d.longPct!=null?'<div class="scr-ls"><div class="scr-ls-bar"><i class="l" style="width:'+lp+'%"></i><i class="s" style="width:'+sp+'%"></i></div><div class="scr-ls-lbl"><span class="up">'+T("longPct",'Long ')+lp+'%</span><span class="dn">'+sp+'%'+T("shortPct",' Short')+'</span></div></div>':'') /* no positioning data = no bar; a 50/50 placeholder read as a measurement */
      +'</div>';}
  var ICO={alert:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    plan:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
    chart:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 6-8"/></svg>',
    rekt:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>'};
  function openSheet(e,how){if(!sheet)buildSheet();curRow=e;var sym=e.s;document.getElementById('scrSheetSym').textContent=sym;document.getElementById('scrSheetPx').textContent=fmtPx(live(sym,e.p));document.getElementById('scrAn').innerHTML=anHtml(e);
    track((how||'sheet')+':'+sym);
    var _xl=xl(e),onBybit=(!window.mpIsBybit||window.mpIsBybit(sym));
    var ab=document.getElementById('scrActs');if(ab)ab.innerHTML=
      (onBybit?'<a class="scr-act a-plan" data-act="paper" href="/paper-trade?coin='+sym+'">'+ICO.plan+T("openInPaperTrade",'Open in Paper Trade (demo)')+'</a>':'<span class="scr-act a-plan" style="opacity:.42;cursor:default" title="Not listed on Bybit - no live feed, so paper trade is unavailable for this token">'+ICO.plan+T("notOnBybit",'Not on Bybit · view only')+'</span>')
      +(onBybit?'<a class="scr-act a-chart" data-act="chart" href="/charts?coin='+sym+'">'+ICO.chart+T("openChart",'Open on the chart')+'</a>':'')
      +'<a class="scr-act a-alert" data-act="alert" href="/alerts/?coin='+sym+'">'+ICO.alert+T("setPriceAlert",'Set a price alert')+'</a>'
      +(_xl&&_xl.liq>0?'<a class="scr-act a-rekt" data-act="rekt" href="/rekt/?coin='+sym+'">'+ICO.rekt+fmtBig(_xl.liq)+T("liquidatedIn24hWatch",' liquidated in 24h - watch live →</a>'):'');
    // copy-trade prefill is intentionally OFF (owner's choice): just open the coin; the full setup (recommended leverage / SL / TP) stays visible on the screener sheet to read.
    var exb=document.getElementById('scrExch');if(exb)exb.innerHTML=exchHtml(sym);
    // the country lands within a few hundred ms on a first-ever visit; repaint the venue list once it does
    if(window.mpEx&&!window.mpEx.ccNow())try{window.mpEx.cc(function(){var b2=document.getElementById('scrExch');if(b2&&curRow===e)b2.innerHTML=exchHtml(sym);});}catch(e2){}
    var lb=document.getElementById('scrLive');if(lb){lb.innerHTML=T("loadingLiveDerivativesData",'<div class="scr-live-load">Loading live derivatives data…</div>');fetch('/api/cg/coin?symbol='+encodeURIComponent(sym),{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){if(curRow!==e||!lb)return;lb.innerHTML=cgHtml(d);}).catch(function(){if(lb)lb.innerHTML='';});}
    sheet.classList.add('on');}
  function closeSheet(){if(sheet){sheet.classList.remove('on');curRow=null;}}
  function findRow(sym){for(var i=0;i<DATA.length;i++){if(DATA[i].s===sym)return DATA[i];}return null;}
  listEl.addEventListener('click',function(ev){
    var st=ev.target.closest&&ev.target.closest('[data-star]');
    if(st){ev.stopPropagation();wlToggle(st.getAttribute('data-star'));st.classList.toggle('on');if(st.classList.contains('on')){try{window.__mpTrack&&window.__mpTrack('watch',(st.getAttribute('data-star')||'').toUpperCase());}catch(_){}}if(filterKey==='watch')render();return;}
    var th=ev.target.closest&&ev.target.closest('th[data-k]');
    if(th){var k=th.getAttribute('data-k');setSort(k,(k===sortKey&&sortDir==='desc')?'asc':'desc');return;}
    var more=ev.target.closest&&ev.target.closest('#scrMore');
    if(more){showAll=true;render();track('more');return;}
    var b=ev.target.closest('.scr-row');if(!b)return;var e=findRow(b.getAttribute('data-sym'));if(e)openSheet(e,'sheet');});
  listEl.addEventListener('keydown',function(ev){if(ev.key!=='Enter'&&ev.key!==' ')return;var t=ev.target;if(!t||!t.closest)return;
    if(t.closest('th[data-k]')||t.closest('.scr-row')||t.closest('[data-star]')){ev.preventDefault();t.click();}});
  document.addEventListener('click',function(ev){var pk=ev.target.closest&&ev.target.closest('[data-pick]');if(!pk)return;var e=findRow(pk.getAttribute('data-pick'));if(e)openSheet(e,'pick');});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeSheet();});
  var _luT=0;document.addEventListener('mp:price',function(){var n=Date.now();if(n-_luT<450)return;_luT=n;updLive();}); // throttle: emit() fires sub-second per major → this was doing dozens of full row sweeps/sec; the 2s interval below already backstops

  /* AI OPPORTUNITY SCANNER (2026-10-04, owner): the 3 best setups across the majors, above the screener, Plus-only.
     A click opens /charts on that pair where the AI prepares and draws the setup. 402/401 = not Plus → upsell teaser. */
  function aiScanCard(s){var side=/^(long|short|wait)$/.test(s.side)?s.side:'wait';
    return '<button type="button" class="scr-ai-card" data-aiscan="'+esc(s.coin)+'">'
      +'<div class="scr-ai-top"><span class="scr-ai-co">'+esc(s.coin)+'</span><span class="scr-ai-side '+side+'">'+side.toUpperCase()+'</span>'
      +'<span class="scr-ai-conf"><b>'+(+s.confidence||0)+'</b>% '+T("confSp","conf")+'</span></div>'
      +'<div class="scr-ai-th">'+esc(s.thesis||'')+'</div>'
      +'<div class="scr-ai-go">'+T("openDrawChart","Open & draw on chart")+' &rarr;</div></button>';}
  function renderAiScan(j){var el=document.getElementById('scrAiScan');if(!el)return;var setups=(j&&j.setups)||[];
    if(!setups.length){el.hidden=true;return;}
    var age=j.ts?Math.max(0,Math.round((Date.now()-j.ts)/60000)):0;
    el.innerHTML='<div class="scr-ai-h"><span class="ic"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.7 4.5L18 9l-4.3 1.5L12 15l-1.7-4.5L6 9l4.3-1.5z"/></svg></span>'
      +'<span class="t">'+T("aiBestSetups","AI best setups")+'</span><span class="pl">Plus</span>'
      +'<span class="age">'+(age<1?T("justNow","just now"):(age+'m '+T("agoSp","ago")))+'</span></div>'
      +'<div class="scr-ai-grid">'+setups.map(aiScanCard).join('')+'</div>';
    el.hidden=false;}
  function renderAiLock(){var el=document.getElementById('scrAiScan');if(!el)return;
    el.className='scr-ai locked';
    el.innerHTML='<a class="scr-ai-lock" href="/premium/" onclick="try{window.__mpTrack&&window.__mpTrack(\'premview\',\'screener-aiscan\')}catch(e){}">'
      +'<span class="lk"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>'
      +'<span class="lx"><b>'+T("aiBestSetups","AI best setups")+'</b><i>'+T("aiScanTease","The 3 strongest setups across the majors, ranked by AI - tap to open and draw.")+'</i></span>'
      +'<span class="cta">'+T("plusSp","Premium Plus")+'</span></a>';
    el.hidden=false;}
  function loadAiScan(){fetch('/api/ai/scan',{cache:'no-store'}).then(function(r){if(r.status===402||r.status===401){renderAiLock();return null;}return r.json();}).then(function(j){if(j)renderAiScan(j);}).catch(function(){});}
  document.addEventListener('click',function(ev){var ac=ev.target.closest&&ev.target.closest('[data-aiscan]');if(!ac)return;var co=ac.getAttribute('data-aiscan');if(co){try{window.__mpTrack&&window.__mpTrack('aiscan',co);}catch(_){}location.href='/charts?coin='+encodeURIComponent(co)+'&aiscan=1';}});

  /* the server recomputes the score every ~15 min from 4h candles and the edge caches the JSON for 10; a 30 s poll
     refreshed nothing but the request counter. Prices are live through the WebSocket feed regardless. */
  load();loadLogos();setInterval(load,120000);setInterval(updLive,2000);
  loadAiScan();setInterval(loadAiScan,300000);
  try{window.__mpScreener={rows:function(){return DATA.length;},shown:function(){return listEl.querySelectorAll('.scr-row').length;},sort:function(){return sortKey+':'+sortDir;}};}catch(_e){} /* read-only mirror for the E2E */
})();
