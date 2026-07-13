/* Market Screener — live USDT-perp table (multi-exchange Bybit+OKX+Gate via /api/screener: aggregated volume, venue count, median-price cross-check), sortable, with a per-coin action sheet. Runs only on /screener. */
(function(){
  var listEl=document.getElementById('scrList');if(!listEl)return;
  if(!/^\/screener\/?$/.test(location.pathname))return; // dedicated route only — don't fetch on every homepage load
  try{window.mpLoadTokens&&window.mpLoadTokens();}catch(e){} // warm the Bybit set so window.mpIsBybit() can gate the sheet's paper-trade action
  var DATA=[],sortKey='score',filterKey='all',query='',sheet=null,curRow=null,LOGOS={},NAMES={};
  function wlGet(){try{return JSON.parse(localStorage.getItem('mp_watchlist')||'[]');}catch(e){return [];}}
  function wlHas(s){var a=wlGet();return a.indexOf(s+'USDT')>=0||a.indexOf(s)>=0;}
  function wlToggle(s){var a=wlGet(),k=s+'USDT',i=a.indexOf(k);if(i<0&&a.indexOf(s)>=0){k=s;i=a.indexOf(s);}if(i>=0)a.splice(i,1);else a.push(k);try{localStorage.setItem('mp_watchlist',JSON.stringify(a));}catch(e){}}
  function fmtPx(p){p=+p;return '$'+p.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:p>=1?2:6});}
  function fmtBig(n){n=+n;if(n>=1e9)return '$'+(n/1e9).toFixed(2)+'B';if(n>=1e6)return '$'+(n/1e6).toFixed(1)+'M';if(n>=1e3)return '$'+(n/1e3).toFixed(0)+'K';return '$'+(n||0).toFixed(0);}
  /* ===== On-chain · Memecoins mode (GeckoTerminal trending + new pairs — the DexScreener direction) ===== */
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
    if(!OC){el.innerHTML='<div class="scr-loading">Loading on-chain pools…</div>';return;}
    var list=(ocTab==='fresh'?OC.fresh:OC.trending)||[];
    el.innerHTML=list.length?list.map(ocRow).join(''):'<div class="scr-loading">No pools right now — try the other tab.</div>';}
  function ocLoad(){fetch('/api/onchain').then(function(r){return r.ok?r.json():null;}).then(function(d){if(d&&(d.trending||d.fresh)){OC=d;ocRender();}}).catch(function(){});}
  function esc(s){return String(s==null?'':s).replace(/[<>&"]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m];});}
  (function(){var mode=document.getElementById('scrMode'),oc=document.getElementById('scrOnchain');if(!mode||!oc)return;
    var perpEls=['scrStats','scrMeta','scrPicks','scrSearch','scrFilters','scrList'].map(function(id){return document.getElementById(id);});
    mode.addEventListener('click',function(ev){var b=ev.target.closest('button[data-mode]');if(!b)return;
      scrMode=b.getAttribute('data-mode');mode.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);});
      var on=scrMode==='onchain';oc.hidden=!on;perpEls.forEach(function(e){if(e)e.style.display=on?'none':'';});
      if(on){if(!OC)ocLoad();try{window.__mpTrack&&window.__mpTrack('screener','onchain');}catch(_e){}}});
    var tabs=document.getElementById('scrOcTabs');if(tabs)tabs.addEventListener('click',function(ev){var b=ev.target.closest('button[data-oct]');if(!b)return;ocTab=b.getAttribute('data-oct');tabs.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);});ocRender();});
    setInterval(function(){if(scrMode==='onchain'&&!document.hidden)ocLoad();},180000);
  })();
  // screener enrichment from OUR collector: per-coin 24h liquidations + OI Δ24h — data no free screener shows
  var XTRA={};
  function loadXtra(){fetch('/api/v1/screener-extra').then(function(r){return r.ok?r.json():null;}).then(function(d){if(d&&(d.liq||d.oi)){XTRA=d;try{render();}catch(_e){}}}).catch(function(){});}
  loadXtra();setInterval(loadXtra,180000);
  function pct(v){return ((+v)>=0?'+':'')+(+v).toFixed(2)+'%';}
  function live(s,fb){var lp=window.mpLivePrices&&window.mpLivePrices[s];return lp&&lp.p>0?lp.p:fb;}
  function scoreCls(s){return s==null?'neu':s>=75?'bull':s>=60?'bull2':s>=40?'neu':s>=25?'bear2':'bear';}
  function trendTxt(t){return t==='up'?'↗ Up':t==='down'?'↘ Down':'→ Side';}
  function symColor(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return 'hsl('+h+',60%,56%)';}
  function icHtml(s){return '<span class="scr-ic" style="--c:'+symColor(s)+'">'+s.charAt(0)+(LOGOS[s]?'<img src="'+LOGOS[s]+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">':'')+'</span>';}
  function loadLogos(){fetch('/api/gecko/markets?slim=1',{cache:'force-cache'}).then(function(r){return r.ok?r.json():null;}).then(function(a){if(!a||!a.length)return;a.forEach(function(c){var sym=(c.symbol||'').toUpperCase();if(sym){if(c.image)LOGOS[sym]=c.image;if(c.name)NAMES[sym]=c.name;}});if(DATA.length)render();}).catch(function(){});}
  function anHtml(e){if(e.score==null)return '<div class="scr-an-note">Technical analysis not available for this pair yet.</div>';
    var cls=scoreCls(e.score),h='<div class="scr-an"><div class="scr-an-top sc-'+cls+'"><div class="scr-an-num">'+e.score+'<small>/100</small></div><div class="scr-an-v"><b>'+(e.verdict||'')+'</b><span>technical score · 4h</span></div></div>';
    h+='<div class="scr-an-grid"><div><span>Trend</span><b>'+trendTxt(e.trend)+'</b></div><div><span>RSI</span><b>'+(e.rsi!=null?e.rsi:'—')+'</b></div><div><span>MACD</span><b>'+(e.macd==='bull'?'Bullish':e.macd==='bear'?'Bearish':'—')+'</b></div><div><span>Funding</span><b class="'+((e.f||0)>=0?'up':'dn')+'">'+pct(e.f||0)+'</b></div><div><span>Volatility</span><b>'+(e.atrPct!=null?e.atrPct+'%':'—')+'</b></div><div><span>Open Int.</span><b>'+fmtBig(e.oi||0)+'</b></div></div>';
    if(e.sig&&e.sig.length)h+='<div class="scr-an-sig">'+e.sig.map(function(s){var pos=/bullish|golden|oversold|above 200|breakout|negative fund|at support|spike \(up/i.test(s),neg=/bearish|death|overbought|below 200|high positive|spike \(down/i.test(s);return '<span class="'+(pos?'pos':neg?'neg':'')+'">'+s+'</span>';}).join('')+'</div>';
    if(e.setup){var su=e.setup,L=su.dir==='long';h+='<div class="scr-setup '+(L?'long':'short')+'"><div class="scr-setup-h">'+(L?'▲ LONG':'▼ SHORT')+' setup · '+su.lev+'–'+su.levAgg+'× · R:R '+su.rrr+'</div><div class="scr-setup-g"><span>Entry<b>'+fmtPx(su.entry)+'</b></span><span>Stop<b>'+fmtPx(su.sl)+'</b></span><span>TP1<b>'+fmtPx(su.tp1)+'</b></span><span>TP2<b>'+fmtPx(su.tp2)+'</b></span><span>TP3<b>'+fmtPx(su.tp3)+'</b></span></div></div>';}
    else h+='<div class="scr-an-note">No high-conviction setup — neutral zone, wait for confirmation.</div>';
    return h+'</div>';}
  function sorted(){var d=DATA.slice();
    if(query)d=d.filter(function(e){return e.s.indexOf(query)>=0||((NAMES[e.s]||'').toUpperCase().indexOf(query)>=0);});
    if(filterKey==='long')d=d.filter(function(e){return e.setup&&e.setup.dir==='long';});
    else if(filterKey==='short')d=d.filter(function(e){return e.setup&&e.setup.dir==='short';});
    else if(filterKey==='watch')d=d.filter(function(e){return wlHas(e.s);});
    if(sortKey==='score')d.sort(function(a,b){return (b.score==null?-1:b.score)-(a.score==null?-1:a.score)||b.vol-a.vol;});
    else if(sortKey==='vol')d.sort(function(a,b){return b.vol-a.vol;});
    else if(sortKey==='gain')d.sort(function(a,b){return b.chg-a.chg;});
    else if(sortKey==='lose')d.sort(function(a,b){return a.chg-b.chg;});
    else if(sortKey==='fund')d.sort(function(a,b){return Math.abs(b.f||0)-Math.abs(a.f||0);});
    else if(sortKey==='oi')d.sort(function(a,b){return (b.oi||0)-(a.oi||0);});
    else if(sortKey==='vol24')d.sort(function(a,b){return ((b.hi-b.lo)/(b.lo||1))-((a.hi-a.lo)/(a.lo||1));});
    return d;}
  function renderTop(d){var totVol=0,bull=0,bear=0,scSum=0,scN=0,topG=null;
    d.forEach(function(e){totVol+=(e.vol||0);if(e.score!=null){scSum+=e.score;scN++;if(e.score>=60)bull++;else if(e.score<=40)bear++;}if(topG==null||e.chg>topG.chg)topG=e;});
    var avg=scN?Math.round(scSum/scN):0,st=document.getElementById('scrStats'),mt=document.getElementById('scrMeta');
    if(st)st.innerHTML='<div><span>24h volume · '+d.length+' pairs</span><b>'+fmtBig(totVol)+'</b></div>'
      +'<div><span>Bullish setups</span><b>'+bull+'<small> / '+d.length+'</small></b></div>';
    if(mt)mt.innerHTML='<span class="mchip"><i>Avg score</i><b>'+avg+'</b></span>'
      +'<span class="mchip"><i>Bullish</i><b class="up">'+bull+'</b></span>'
      +'<span class="mchip"><i>Bearish</i><b class="dn">'+bear+'</b></span>'
      +(topG?'<span class="mchip"><i>Top gainer</i><b class="up">'+topG.s+' '+pct(topG.chg)+'</b></span>':'')
      +'<span class="mchip"><i>Live</i><b>7 exchanges</b></span>';}
  function renderPicks(){var el=document.getElementById('scrPicks');if(!el)return;
    var L=null,S=null,V=null;
    DATA.forEach(function(e){
      if(e.setup&&e.setup.dir==='long'&&(L==null||(e.score||0)>(L.score||0)))L=e;
      if(e.setup&&e.setup.dir==='short'&&(S==null||(e.score||100)<(S.score||100)))S=e;
      var vv=(e.atrPct!=null)?+e.atrPct:((e.hi-e.lo)/(e.lo||1)*100);e._vv=vv;if(V==null||vv>V._vv)V=e;
    });
    function pk(tag,cls,e,stat){return e?'<button type="button" class="scr-pick '+cls+'" data-pick="'+e.s+'"><i>'+tag+'</i><b>'+icHtml(e.s)+e.s+'</b><span>'+stat+'</span></button>':'';}
    el.innerHTML=(L||S||V)?(pk('Best long setup','pk-l',L,L?('score '+L.score+(L.setup.lev?' · '+L.setup.lev+'×':'')):'')
      +pk('Best short setup','pk-s',S,S?('score '+S.score+(S.setup.lev?' · '+S.setup.lev+'×':'')):'')
      +pk('Most volatile','pk-v',V,V?((V._vv).toFixed(1)+'% range · 4h'):'')):'';}
  function render(){var d=sorted();renderTop(d);renderPicks();if(!d.length){listEl.innerHTML='<div class="scr-loading">'+((query||filterKey!=='all')?'No pairs match — clear the search/filter.':'No data — retry shortly.')+'</div>';return;}
    listEl.innerHTML=d.map(function(e){var p=live(e.s,e.p),chgCls=e.chg>=0?'up':'dn',cls=(e.score==null?'na':scoreCls(e.score));
      var tr=e.trend==='up'?'<span class="scr-tag t-up">↗ up</span>':e.trend==='down'?'<span class="scr-tag t-dn">↘ down</span>':'<span class="scr-tag">→ side</span>';
      var lev=(e.setup&&e.setup.lev)?'<span class="scr-tag t-lev">'+e.setup.lev+'×</span>':'';
      var fc=(e.f||0)>=0?'up':'dn';
      var boxes='<span class="scr-box"><i>Vol</i><b>'+fmtBig(e.vol)+'</b></span>'
        +'<span class="scr-box"><i>OI</i><b>'+fmtBig(e.oi||0)+'</b></span>'
        +'<span class="scr-box"><i>Fund</i><b class="'+fc+'">'+pct(e.f||0)+'</b></span>'
        +(e.rsi!=null?'<span class="scr-box"><i>RSI</i><b>'+e.rsi+'</b></span>':'');
      // OUR data: 24h liquidations per coin (collector) + OI change vs 24h ago (hourly snapshots)
      var xl=XTRA.liq&&XTRA.liq[e.s],xo=XTRA.oi&&XTRA.oi[e.s];
      if(xl&&xl.liq>0)boxes+='<span class="scr-box"><i>Liq 24h</i><b style="color:#ff8a80">'+fmtBig(xl.liq)+'</b></span>';
      if(xo&&xo.chg!=null)boxes+='<span class="scr-box"><i>OI Δ24h</i><b class="'+(xo.chg>=0?'up':'dn')+'">'+(xo.chg>=0?'+':'')+xo.chg.toFixed(1)+'%</b></span>';
      if(xo&&xo.fchg!=null&&Math.abs(xo.fchg)>=0.005)boxes+='<span class="scr-box"><i>Fund Δ</i><b class="'+(xo.fchg>=0?'up':'dn')+'">'+(xo.fchg>=0?'+':'')+xo.fchg.toFixed(3)+'pp</b></span>'; // funding trend vs 24h ago — a flip is a squeeze tell
      return '<button type="button" class="scr-row" data-sym="'+e.s+'" data-p="'+e.p+'">'
        +'<span class="scr-score3 sc-'+cls+'"><b>'+(e.score==null?'—':e.score)+'</b><i>score</i></span>'
        +'<span class="scr-main">'
        +'<span class="scr-line1">'+icHtml(e.s)+'<span class="scr-sym">'+e.s+'</span><span class="scr-star'+(wlHas(e.s)?' on':'')+'" data-star="'+e.s+'" role="button" tabindex="0" aria-label="Watchlist">★</span><span class="scr-name">'+(NAMES[e.s]||'')+'</span>'
        +'<span class="scr-pxw"><b class="scr-px" data-px>'+fmtPx(p)+'</b><span class="scr-chg '+chgCls+'">'+pct(e.chg)+'</span></span></span>'
        +'<span class="scr-line2">'+(e.verdict?'<span class="scr-vd sc-'+cls+'">'+e.verdict+'</span>':'')+tr+lev+'</span>'
        +'<span class="scr-boxes">'+boxes+'</span>'
        +'</span></button>';
    }).join('');}
  function updLive(){var rows=listEl.querySelectorAll('.scr-row');for(var i=0;i<rows.length;i++){var s=rows[i].getAttribute('data-sym'),fb=+rows[i].getAttribute('data-p'),pe=rows[i].querySelector('[data-px]');if(pe)pe.textContent=fmtPx(live(s,fb));}}
  function load(){Promise.all([
      fetch('/api/screener',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
      fetch('/api/cg/funding',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
    ]).then(function(res){var j=res[0],cg=res[1];
      if(j&&j.rows&&j.rows.length){
        if(cg&&cg.coins&&cg.coins.length){var cm={};cg.coins.forEach(function(c){cm[c.s]=c;});j.rows.forEach(function(e){var c=cm[e.s];if(c){if(c.funding!=null&&isFinite(c.funding))e.f=c.funding;if(c.oiUsd!=null&&isFinite(c.oiUsd))e.oi=c.oiUsd;e.agg=true;}});}/* overlay funding + OI aggregated across all exchanges (Coinglass) onto the majors — Bybit-only for the long tail */
        DATA=j.rows;render();
      }else if(!DATA.length){listEl.innerHTML='<div class="scr-loading">Markets unavailable — retry shortly.</div>';}});}
  var fEl=document.getElementById('scrFilters');
  if(fEl)fEl.addEventListener('click',function(e){
    var f=e.target.closest('[data-filter]');
    if(f){var k=f.getAttribute('data-filter');filterKey=(filterKey===k)?'all':k;this.querySelectorAll('[data-filter]').forEach(function(x){x.classList.toggle('on',x===f&&filterKey!=='all');});render();return;}
    var b=e.target.closest('[data-sort]');if(!b)return;sortKey=b.getAttribute('data-sort');this.querySelectorAll('[data-sort]').forEach(function(x){x.classList.toggle('on',x===b);});render();});
  var sIn=document.getElementById('scrSearch');
  if(sIn)sIn.addEventListener('input',function(){query=(sIn.value||'').trim().toUpperCase();render();});
  function buildSheet(){sheet=document.createElement('div');sheet.className='scr-sheet';
    sheet.innerHTML='<div class="scr-sheet-bd"></div><div class="scr-sheet-card"><button type="button" class="scr-sheet-x" aria-label="Close">✕</button><div class="scr-sheet-h"><b id="scrSheetSym">—</b><span id="scrSheetPx"></span></div><div id="scrAn"></div><div id="scrLive"></div><div id="scrActs" style="margin:12px 0"></div>'
      +'<div class="scr-exch" id="scrExch"></div></div>';
    document.body.appendChild(sheet);
    sheet.addEventListener('click',function(e){var ex=e.target.closest&&e.target.closest('[data-ex]');if(ex){try{if(window.__mpTrack)window.__mpTrack('exchange',ex.getAttribute('data-ex'));}catch(_){}}if(e.target.closest('.scr-sheet-bd')||e.target.closest('.scr-sheet-x'))closeSheet();});}
  // exchanges where the pair can be traded — affiliate deep-links (Bybit/Binance open the exact pair with our ref)
  var SCR_EXCH=[
    {n:'Bybit',c:'#f7a600',fg:'#0a0b0d',u:function(s){return 'https://www.bybit.com/trade/usdt/'+s+'USDT?ref=LZKBERJ';}},
    {n:'Binance',c:'#f0b90b',fg:'#181a20',u:function(s){return 'https://www.binance.com/en/futures/'+s+'USDT?ref=MAOZM9DS';}},
    {n:'OKX',c:'#cfd3d8',fg:'#0a0b0d',u:function(s){return 'https://www.okx.com/trade-swap/'+s.toLowerCase()+'-usdt-swap';}},
    {n:'Bitget',c:'#00e7d8',fg:'#06231d',u:function(s){return 'https://www.bitget.com/futures/usdt/'+s+'USDT?clacCode=DSSSQKGK';}},
    {n:'KuCoin',c:'#23af91',fg:'#06231d',u:function(s){return 'https://www.kucoin.com/futures/trade/'+(s==='BTC'?'XBT':s)+'USDTM?rcode=VHP8AYKY';}},
    {n:'Gate',c:'#3361ff',fg:'#ffffff',u:function(s){return 'https://www.gate.com/futures/USDT/'+s+'_USDT?ref=VFIWB10KUG';}},
    {n:'MEXC',c:'#0ac2d6',fg:'#06231d',u:function(s){return 'https://futures.mexc.com/exchange/'+s+'_USDT?inviteCode=GND4jI97o0';}},
    {n:'Kraken',c:'#7b5cff',fg:'#ffffff',u:function(s){return 'https://invite.kraken.com/JDNW/guj2tf28';}},
    {n:'Crypto.com',c:'#0b2e7a',fg:'#ffffff',u:function(s){return 'https://crypto.com/app/sdf5hb6rkv';}}
  ];
  function exchHtml(sym){return '<div class="scr-exch-h">Trade '+sym+'USDT</div>'+SCR_EXCH.map(function(x){return '<a class="scr-exch-a" href="'+x.u(sym)+'" target="_blank" rel="noopener sponsored" data-ex="'+x.n+'" style="--exc:'+x.c+'"><span class="scr-exch-ic" style="background:'+x.c+';color:'+x.fg+'">'+x.n.charAt(0)+'</span><span class="scr-exch-n">'+x.n+'</span><span class="scr-exch-go">Trade &rarr;</span></a>';}).join('');}
  function cgBn(x){if(x==null||!isFinite(x))return '—';var a=Math.abs(x);if(a>=1e9)return '$'+(x/1e9).toFixed(2)+'B';if(a>=1e6)return '$'+(x/1e6).toFixed(1)+'M';if(a>=1e3)return '$'+(x/1e3).toFixed(0)+'K';return '$'+x.toFixed(0);}
  function cgHtml(d){if(!d||d.error)return '';var fund=(d.funding!=null&&isFinite(d.funding))?((d.funding>=0?'+':'')+d.funding.toFixed(4)+'%'):'—';var oiCh=(d.oiChg24h!=null&&isFinite(d.oiChg24h))?((d.oiChg24h>=0?'+':'')+d.oiChg24h.toFixed(2)+'%'):'';var lp=(d.longPct!=null)?d.longPct:50,sp=(d.shortPct!=null)?d.shortPct:50;
    return '<div class="scr-live"><div class="scr-live-h">Live derivatives <span>· Coinglass · real-time</span></div>'
      +'<div class="scr-live-grid">'
      +'<div><span>Open interest</span><b>'+cgBn(d.oiUsd)+(oiCh?' <i class="'+(d.oiChg24h>=0?'up':'dn')+'">'+oiCh+'</i>':'')+'</b></div>'
      +'<div><span>Funding rate</span><b class="'+((d.funding||0)>=0?'up':'dn')+'">'+fund+'</b></div>'
      +'<div><span>24h liq · longs</span><b class="dn">'+cgBn(d.longLiq24h)+'</b></div>'
      +'<div><span>24h liq · shorts</span><b class="up">'+cgBn(d.shortLiq24h)+'</b></div>'
      +'</div>'
      +'<div class="scr-ls"><div class="scr-ls-bar"><i class="l" style="width:'+lp+'%"></i><i class="s" style="width:'+sp+'%"></i></div><div class="scr-ls-lbl"><span class="up">Long '+lp+'%</span><span class="dn">'+sp+'% Short</span></div></div>'
      +'</div>';}
  function openSheet(e){if(!sheet)buildSheet();curRow=e;var sym=e.s;document.getElementById('scrSheetSym').textContent=sym;document.getElementById('scrSheetPx').textContent=fmtPx(live(sym,e.p));document.getElementById('scrAn').innerHTML=anHtml(e);
    var _xl=XTRA.liq&&XTRA.liq[sym];
    var ab=document.getElementById('scrActs');if(ab)ab.innerHTML='<a class="scr-act a-alert" href="/alerts/?coin='+sym+'"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>Set a price alert</a>'+((!window.mpIsBybit||window.mpIsBybit(sym))?('<a class="scr-act a-plan" href="/paper-trade?coin='+sym+'"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>Open in Paper Trade (demo)</a>'):('<span class="scr-act a-plan" style="opacity:.42;cursor:default" title="Not listed on Bybit — no live feed, so paper trade is unavailable for this token"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>Not on Bybit · view only</span>'))+''
      +(_xl&&_xl.liq>0?'<a class="scr-act" style="color:#ff8a80" href="/rekt/?coin='+sym+'"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>'+fmtBig(_xl.liq)+' liquidated in 24h — watch live →</a>':'');
    // copy-trade prefill is intentionally OFF (owner's choice): just open the coin; the full setup (recommended leverage / SL / TP) stays visible on the screener sheet to read.
    var exb=document.getElementById('scrExch');if(exb)exb.innerHTML=exchHtml(sym);
    var lb=document.getElementById('scrLive');if(lb){lb.innerHTML='<div class="scr-live-load">Loading live derivatives data…</div>';fetch('/api/cg/coin?symbol='+encodeURIComponent(sym),{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){if(curRow!==e||!lb)return;lb.innerHTML=cgHtml(d);}).catch(function(){if(lb)lb.innerHTML='';});}
    // copy-trade to Paper Trade is turned off — the Paper Trade action is a disabled "Soon" item for now
    sheet.classList.add('on');}
  function closeSheet(){if(sheet){sheet.classList.remove('on');curRow=null;}}
  listEl.addEventListener('click',function(ev){
    var st=ev.target.closest&&ev.target.closest('[data-star]');
    if(st){ev.stopPropagation();wlToggle(st.getAttribute('data-star'));st.classList.toggle('on');if(filterKey==='watch')render();return;}
    var b=ev.target.closest('.scr-row');if(!b)return;var sym=b.getAttribute('data-sym'),e=null;for(var i=0;i<DATA.length;i++){if(DATA[i].s===sym){e=DATA[i];break;}}if(e)openSheet(e);});
  document.addEventListener('click',function(ev){var pk=ev.target.closest&&ev.target.closest('[data-pick]');if(!pk)return;var sym=pk.getAttribute('data-pick');for(var i=0;i<DATA.length;i++){if(DATA[i].s===sym){openSheet(DATA[i]);break;}}});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeSheet();});
  var _luT=0;document.addEventListener('mp:price',function(){var n=Date.now();if(n-_luT<450)return;_luT=n;updLive();}); // throttle: emit() fires sub-second per major → this was doing dozens of full row sweeps/sec; the 2s interval below already backstops
  load();loadLogos();setInterval(load,30000);setInterval(updLive,2000);
})();
