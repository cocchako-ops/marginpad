/* Mobile full-screen Charts — landscape-first 1/2-pane workspace: same indicator families as desktop, drawing, trade import, an AI chat bubble and a quick liq calculator. Exposed as window.mpOpenCharts(). */
(function(){
  var ov=null,panes=[],activeI=0,split=1,drawOn=false,tokens=['BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK'];
  function isMob(){return !!(window.matchMedia&&window.matchMedia('(max-width:880px)').matches);}
  // iOS leaves the layout viewport scaled (~2x) after a landscape→portrait rotation when user-scalable=no — re-assert + jiggle the viewport meta to clamp scale back to 1 (kills the "everything is huge" zoom after closing charts)
  function resetViewport(){try{var m=document.querySelector('meta[name="viewport"]');if(!m)return;var c=m.getAttribute('content')||'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';var base=c.replace(/,?\s*minimum-scale=[^,]*/,'');m.setAttribute('content',base+', minimum-scale=1.0');setTimeout(function(){m.setAttribute('content',base);},60);}catch(e){}}
  function resetViewportHard(){resetViewport();setTimeout(resetViewport,280);setTimeout(resetViewport,800);} /* iOS can re-apply the stale scale after the first jiggle — hit it three times */
  function loadLib(cb){if(window.LightweightCharts)return cb();var s=document.createElement('script');s.src='/assets/lightweight-charts-4.2.0.js';s.onload=cb;s.onerror=function(){};document.head.appendChild(s);}
  function price(s){var lp=window.mpLivePrices&&window.mpLivePrices[s];return lp&&lp.p>0?lp.p:0;}
  // clamp ISOLATED phantom wicks (bad/transient prints) so one bad candle can't draw a giant vertical line
  function sanitizeBars(kd){if(!kd||kd.length<2)return kd;var TH=0.035;for(var i=0;i<kd.length;i++){var b=kd[i];if(!b)continue;var o=+b.open,c=+b.close;if(!(o>0&&c>0))continue;var bodyLo=Math.min(o,c),bodyHi=Math.max(o,c);var pl=i>0?+kd[i-1].low:bodyLo,nl=i<kd.length-1?+kd[i+1].low:bodyLo;var ph=i>0?+kd[i-1].high:bodyHi,nh=i<kd.length-1?+kd[i+1].high:bodyHi;var refLo=Math.min(bodyLo,pl||bodyLo,nl||bodyLo);if(+b.low>0&&+b.low<refLo*(1-TH))b.low=refLo*(1-TH);var refHi=Math.max(bodyHi,ph||bodyHi,nh||bodyHi);if(+b.high>refHi*(1+TH))b.high=refHi*(1+TH);}return kd;}
  function fp(p){p=+p;return '$'+p.toLocaleString('en-US',{maximumFractionDigits:p>=100?2:p>=1?4:6});}
  // ---- indicator helpers (own copies; same families as desktop) ----
  function sma(c,p){var o=[],s=0;for(var i=0;i<c.length;i++){s+=c[i];if(i>=p)s-=c[i-p];o.push(i>=p-1?s/p:null);}return o;}
  function ema(c,p){var o=[],k=2/(p+1),e=null;for(var i=0;i<c.length;i++){e=(e==null)?c[i]:c[i]*k+e*(1-k);o.push(i>=p-1?e:null);}return o;}
  function boll(c,p,m){var mid=sma(c,p),u=[],l=[];for(var i=0;i<c.length;i++){if(i>=p-1){var s=0;for(var j=i-p+1;j<=i;j++){var d=c[j]-mid[i];s+=d*d;}var sd=Math.sqrt(s/p);u.push(mid[i]+m*sd);l.push(mid[i]-m*sd);}else{u.push(null);l.push(null);}}return {u:u,m:mid,l:l};}
  function rsi(c,p){var o=[],i;for(i=0;i<c.length;i++)o.push(null);if(c.length<=p)return o;var g=0,ls=0;for(i=1;i<=p;i++){var d=c[i]-c[i-1];if(d>=0)g+=d;else ls-=d;}g/=p;ls/=p;o[p]=100-100/(1+(ls===0?100:g/ls));for(i=p+1;i<c.length;i++){var d2=c[i]-c[i-1],gg=d2>0?d2:0,ll=d2<0?-d2:0;g=(g*(p-1)+gg)/p;ls=(ls*(p-1)+ll)/p;o[i]=100-100/(1+(ls===0?100:g/ls));}return o;}
  function macd(c){var f=ema(c,12),s=ema(c,26),md=[],i;for(i=0;i<c.length;i++)md.push((f[i]!=null&&s[i]!=null)?f[i]-s[i]:null);var sig=[],e=null,k=2/10,cnt=0;for(i=0;i<c.length;i++){if(md[i]==null){sig.push(null);continue;}e=(e==null)?md[i]:md[i]*k+e*(1-k);cnt++;sig.push(cnt>=9?e:null);}return {macd:md,signal:sig};}
  function atr(bs,p){var tr=[],i;for(i=0;i<bs.length;i++){tr.push(i===0?bs[i].high-bs[i].low:Math.max(bs[i].high-bs[i].low,Math.abs(bs[i].high-bs[i-1].close),Math.abs(bs[i].low-bs[i-1].close)));}var o=[],s=0;for(i=0;i<tr.length;i++){if(i<p){s+=tr[i];o.push(i===p-1?s/p:null);}else{o.push((o[i-1]*(p-1)+tr[i])/p);}}return o;}
  function stoch(bs,kP,dP){var kk=[],i,j;for(i=0;i<bs.length;i++){if(i<kP-1){kk.push(null);continue;}var hh=-Infinity,ll=Infinity;for(j=i-kP+1;j<=i;j++){if(bs[j].high>hh)hh=bs[j].high;if(bs[j].low<ll)ll=bs[j].low;}kk.push(hh===ll?50:100*(bs[i].close-ll)/(hh-ll));}var dd=[];for(i=0;i<bs.length;i++){if(i<kP-1+dP-1){dd.push(null);continue;}var sum=0,ok=true;for(j=i-dP+1;j<=i;j++){if(kk[j]==null){ok=false;break;}sum+=kk[j];}dd.push(ok?sum/dP:null);}return {k:kk,d:dd};}
  function vwap(bs){var o=[],pv=0,vv=0;for(var i=0;i<bs.length;i++){var tp=(+bs[i].high+ +bs[i].low+ +bs[i].close)/3,v=+bs[i].vol;if(isFinite(v)&&v>0){pv+=tp*v;vv+=v;}o.push(vv?pv/vv:null);}return o;}
  function wma(c,p){var o=[],i,j;for(i=0;i<c.length;i++){if(i<p-1){o.push(null);continue;}var sum=0,ws=0;for(j=0;j<p;j++){var w=p-j;sum+=c[i-j]*w;ws+=w;}o.push(sum/ws);}return o;}
  function hma(c,p){var half=Math.max(1,Math.round(p/2)),sq=Math.max(1,Math.round(Math.sqrt(p))),w1=wma(c,half),w2=wma(c,p),raw=[],i,j;for(i=0;i<c.length;i++)raw.push((w1[i]!=null&&w2[i]!=null)?2*w1[i]-w2[i]:null);var o=[];for(i=0;i<c.length;i++){if(i<p-2+sq){o.push(null);continue;}var sum=0,ws=0,ok=true;for(j=0;j<sq;j++){var v=raw[i-j];if(v==null){ok=false;break;}var w=sq-j;sum+=v*w;ws+=w;}o.push(ok?sum/ws:null);}return o;}
  function willr(bs,p){var o=[],i,j;for(i=0;i<bs.length;i++){if(i<p-1){o.push(null);continue;}var hh=-Infinity,ll=Infinity;for(j=i-p+1;j<=i;j++){if(bs[j].high>hh)hh=bs[j].high;if(bs[j].low<ll)ll=bs[j].low;}o.push(hh===ll?-50:(hh-bs[i].close)/(hh-ll)*-100);}return o;}
  function cci(bs,p){var tp=bs.map(function(b){return (+b.high+ +b.low+ +b.close)/3;}),o=[],i,j;for(i=0;i<bs.length;i++){if(i<p-1){o.push(null);continue;}var sum=0;for(j=i-p+1;j<=i;j++)sum+=tp[j];var ma=sum/p,md=0;for(j=i-p+1;j<=i;j++)md+=Math.abs(tp[j]-ma);md/=p;o.push(md===0?0:(tp[i]-ma)/(0.015*md));}return o;}
  var TFS=[['1','1m'],['5','5m'],['15','15m'],['60','1h'],['240','4h'],['1440','1d']];
  var INDS=[['ema9','EMA 9'],['ema21','EMA 21'],['ema50','EMA 50'],['ema100','EMA 100'],['ema200','EMA 200'],['sma20','SMA 20'],['sma50','SMA 50'],['sma100','SMA 100'],['sma200','SMA 200'],['hma','Hull MA 21'],['vwap','VWAP'],['bb','Bollinger'],['vol','Volume'],['rsi','RSI'],['macd','MACD'],['stoch','Stoch'],['atr','ATR'],['wr','Williams %R'],['cci','CCI']];
  function tfLabel(tf){for(var i=0;i<TFS.length;i++)if(TFS[i][0]===tf)return TFS[i][1];return tf;}
  function mcT(k,d){return (window.mpT&&window.mpT(k))||d;}
  // ---- build overlay ----
  function build(){
    ov=document.createElement('div');ov.className='mfc';ov.hidden=true;
    ov.innerHTML='<div class="mfc-bar">'
      +'<button class="mfc-b mfc-x" data-act="close" aria-label="Close charts">✕ '+mcT('mcClose','Close')+'</button>'
      +'<button class="mfc-b" data-act="sym"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><span class="mfc-symL">BTC</span></button>'
      +'<button class="mfc-b" data-act="tf"><span class="mfc-tfL">1m</span></button>'
      +'<button class="mfc-b" data-act="ind"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/></svg>'+mcT('indBtn','Indicators')+'</button>'
      +'<button class="mfc-b" data-act="split"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/></svg><span class="mfc-splitL">'+mcT('mc2charts','2 charts')+'</span></button>'
      +'<button class="mfc-b" data-act="draw"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/></svg>'+mcT('mcDraw','Draw')+'</button>'
      +'<button class="mfc-b" data-act="trades"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><polyline points="8 7 3 12 8 17"/></svg>'+mcT('mtMyTrades','My trades')+'</button>'
      +'<button class="mfc-b" data-act="calc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="14" x2="8" y2="14"/></svg>'+mcT('mcCalc','Calc')+'</button>'
      +'<span class="mfc-grow"></span>'
      +'<button class="mfc-b mfc-ai" data-act="ai" aria-label="Ask AI"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>'+mcT('mcAi','AI')+'</button>'
      +'</div>'
      +'<div class="mfc-stage" id="mfcStage"></div>'
      +'<div class="mfc-rot">'+mcT('mcRotate','↻ Rotate your phone for a wider chart')+'</div>';
    document.body.appendChild(ov);
    var fx=document.createElement('button');fx.className='mfc-fx';fx.setAttribute('data-act','close');fx.setAttribute('aria-label','Close charts');fx.textContent='✕';ov.appendChild(fx); /* ALWAYS-reachable close — after a landscape→portrait rotation iOS can leave the layout zoomed and push the toolbar ✕ off-screen */
    var gate=document.createElement('div');gate.className='mfc-gate';gate.hidden=true;
    gate.innerHTML='<button class="mfc-gate-x" data-gx aria-label="Close">✕</button>'
      +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18.5" x2="13" y2="18.5"/></svg>'
      +'<h3>'+mcT('mcGateT','Best in landscape')+'</h3><p>'+mcT('mcGateS','Turn your phone sideways for a wide chart — or just continue in portrait.')+'</p>'
      +'<button class="mfc-gate-go" data-gg>'+mcT('mcContinue','Continue →')+'</button>';
    ov.appendChild(gate);
    gate.querySelector('[data-gx]').addEventListener('click',close);
    gate.querySelector('[data-gg]').addEventListener('click',proceed);
    ov.addEventListener('click',onBarClick);
    function onR(){if(!ov||ov.hidden)return;if(backWait){if(isPortrait())finishBack();return;}if(!entered){if(!isPortrait())proceed();return;}setTimeout(function(){panes.forEach(function(p){if(p.w&&p.w.dr&&p.w.dr.redraw)p.w.dr.redraw();});},140);}
    window.addEventListener('resize',function(){setTimeout(onR,120);});
    window.addEventListener('orientationchange',function(){resetViewportHard();setTimeout(onR,300);});
  }
  function onBarClick(e){var b=e.target.closest&&e.target.closest('[data-act]');if(!b)return;var a=b.getAttribute('data-act');
    if(a==='close')return close();
    if(a==='split')return toggleSplit();
    if(a==='draw')return toggleDraw(b);
    if(a==='trades')return toggleTrades(b);
    if(a==='sym')return openSheet('sym');
    if(a==='tf')return openSheet('tf');
    if(a==='ind')return openSheet('ind');
    if(a==='calc')return openCalc();
    if(a==='ai')return openSheet('ai');
  }
  // ---- panes ----
  var TOOLS='<div class="cwin-tools"><button class="cwin-tool on" data-tool="pen" title="Freehand">✎</button><button class="cwin-tool" data-tool="trend" title="Trend line">╱</button><button class="cwin-tool" data-tool="hline" title="Horizontal">―</button><button class="cwin-tool" data-tool="vline" title="Vertical">│</button><button class="cwin-tool" data-tool="fib" title="Fib retracement">F</button><span class="cwin-color on" data-color="#3fd8e6" style="background:#3fd8e6"></span><span class="cwin-color" data-color="#c2f64a" style="background:#c2f64a"></span><span class="cwin-color" data-color="#ff6258" style="background:#ff6258"></span><span class="cwin-color" data-color="#ffffff" style="background:#fff"></span><button class="cwin-tool cwin-undo" data-undo title="Undo">↶</button><button class="cwin-tool cwin-clear" data-clear title="Clear all">Clear</button></div>';
  function mkPane(sym,tf){
    var el=document.createElement('div');el.className='mfc-pane';
    el.innerHTML='<div class="mfc-chart"></div><canvas class="cwin-draw"></canvas>'+TOOLS+'<div class="mfc-pl"><b class="mfc-pl-s"></b> <span class="mfc-pl-tf"></span> <span class="mfc-pl-p"></span></div>';
    var p={el:el,host:el.querySelector('.mfc-chart'),sym:sym,tf:tf,bars:[],lastBar:null,chart:null,candle:null,inds:{},indSeries:[],tradeLines:[],reload:0,w:null};
    el.addEventListener('pointerdown',function(){setActive(panes.indexOf(p));},true);
    return p;
  }
  function initChart(p){ if(p.chart||!window.LightweightCharts||!p.host.clientWidth){return;}
    p.chart=LightweightCharts.createChart(p.host,{layout:{background:{color:'transparent'},textColor:'#9aa3ad',fontFamily:"'Familjen Grotesk',system-ui,sans-serif",attributionLogo:false},grid:{vertLines:{color:'rgba(35,41,50,.35)'},horzLines:{color:'rgba(35,41,50,.35)'}},rightPriceScale:{borderColor:'#232932'},timeScale:{borderColor:'#232932',timeVisible:true,secondsVisible:false,rightOffset:5,barSpacing:6},crosshair:{mode:0},autoSize:true});
    p.candle=p.chart.addCandlestickSeries({upColor:'#2ebd85',downColor:'#ff6258',borderVisible:false,wickUpColor:'#2ebd85',wickDownColor:'#ff6258'});
    // price-anchored drawing (reuse the desktop engine → trendline/fib/h-line/v-line/pen + colours, and it re-projects on rotation/resize)
    try{if(window.__mpDraw){p.w={chart:p.chart,candle:p.candle,el:p.el,dead:false};window.__mpDraw.setup(p.w,p.el);window.__mpDraw.wire(p.w,null,p.el.querySelector('.cwin-tools'));}}catch(e){}
    loadKlines(p);
  }
  function loadKlines(p){ if(!p.candle)return;var sym=p.sym,tf=p.tf;p.reload=Date.now();
    fetch('/api/klines?symbol='+encodeURIComponent(sym)+'&interval='+tf).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){
      if(p.dead||sym!==p.sym||tf!==p.tf||!p.candle)return;
      if(kd&&kd.length){kd=sanitizeBars(kd);p.bars=kd;p.lastBar=kd[kd.length-1];p._lgp=+p.lastBar.close||0;p._rej=0;try{p.candle.setData(kd);p.chart.priceScale('right').applyOptions({autoScale:true});p.chart.timeScale().scrollToRealTime();}catch(e){}applyInds(p);if(p.trades)drawTrades(p);}
      label(p);
    });
  }
  function live(p){var pr=price(p.sym);if(!p.candle||!p.lastBar||!(pr>0))return;
    if(Date.now()-p.reload>60000){loadKlines(p);return;}
    // spike filter (same as the desktop/paper-trade/heatmap engines): reject a lone tick that jumps >2.5% from the last
    // accepted price — one bad print would otherwise blow out the forming candle's high/low and compress every other candle
    // (the "candles lose their shape / half candle over time" bug). Accept only if 3 in a row confirm a real move.
    if(p._lgp>0){ if(Math.abs(pr-p._lgp)/p._lgp>0.025){ p._rej=(p._rej||0)+1; if(p._rej<3)return; } else { p._rej=0; } }
    p._lgp=pr;
    var iv=parseInt(p.tf,10)*60,nb=Math.floor(Date.now()/1000/iv)*iv;
    if(nb>p.lastBar.time){p.lastBar={time:nb,open:p.lastBar.close,high:Math.max(p.lastBar.close,pr),low:Math.min(p.lastBar.close,pr),close:pr};try{p.chart.priceScale('right').applyOptions({autoScale:true});}catch(e){}}
    else{p.lastBar.close=pr;if(pr>p.lastBar.high)p.lastBar.high=pr;if(pr<p.lastBar.low)p.lastBar.low=pr;}
    try{p.candle.update(p.lastBar);}catch(e){}label(p);
  }
  function label(p){var s=p.el.querySelector('.mfc-pl-s'),t=p.el.querySelector('.mfc-pl-tf'),pe=p.el.querySelector('.mfc-pl-p'),pr=price(p.sym)||(p.lastBar&&p.lastBar.close);if(s)s.textContent=p.sym;if(t)t.textContent=tfLabel(p.tf);if(pe&&pr)pe.textContent=fp(pr);}
  // ---- indicators ----
  function applyInds(p){ if(!p.chart||!p.candle)return;
    p.indSeries.forEach(function(s){try{p.chart.removeSeries(s);}catch(e){}});p.indSeries=[];
    var c=p.bars.map(function(b){return +b.close;}),t=p.bars.map(function(b){return b.time;});
    function add(vals,opts,scale){var s;try{s=p.chart.addLineSeries(Object.assign({lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false},opts));}catch(e){return;}var d=[];for(var i=0;i<vals.length;i++)if(vals[i]!=null&&isFinite(vals[i]))d.push({time:t[i],value:vals[i]});try{s.setData(d);}catch(e){}p.indSeries.push(s);}
    var MA=[['ema9',9,'e','#7fb6ff'],['ema21',21,'e','#3fd8e6'],['ema50',50,'e','#5fe0a6'],['ema100',100,'e','#c2f64a'],['ema200',200,'e','#ffd75a'],['sma20',20,'s','#ff9f43'],['sma50',50,'s','#ff7b72'],['sma100',100,'s','#e0a0ff'],['sma200',200,'s','#ff5a4d']];
    var oscs=['rsi','macd','stoch','atr','vol','wr','cci'].filter(function(k){return p.inds[k];}),oN=oscs.length;
    try{p.chart.priceScale('right').applyOptions({scaleMargins:{top:0.06,bottom:oN?0.34:0.08}});}catch(e){}
    function band(key){var idx=oscs.indexOf(key),b=0.32/Math.max(1,oN);return {top:0.68+idx*b+0.005,bottom:(oN-1-idx)*b+0.02};}
    function setScale(id){try{p.chart.priceScale(id).applyOptions({scaleMargins:band(id)});}catch(e){}}
    MA.forEach(function(m){if(p.inds[m[0]])add(m[2]==='e'?ema(c,m[1]):sma(c,m[1]),{color:m[3]});});
    if(p.inds.bb){var bb=boll(c,20,2);add(bb.u,{color:'rgba(154,163,173,.7)'});add(bb.m,{color:'rgba(154,163,173,.55)',lineStyle:2});add(bb.l,{color:'rgba(154,163,173,.7)'});}
    if(p.inds.vwap)add(vwap(p.bars),{color:'#46e0e6',lineWidth:2});
    if(p.inds.hma)add(hma(c,21),{color:'#ff7bd5'});
    if(p.inds.rsi){add(rsi(c,14),{color:'#e0a0ff',priceScaleId:'rsi'});add(c.map(function(){return 70;}),{color:'rgba(255,98,88,.25)',lineStyle:2,priceScaleId:'rsi'});add(c.map(function(){return 30;}),{color:'rgba(46,189,133,.25)',lineStyle:2,priceScaleId:'rsi'});setScale('rsi');}
    if(p.inds.macd){var mc=macd(c);add(mc.macd,{color:'#3fd8e6',priceScaleId:'macd'});add(mc.signal,{color:'#ff9f4d',priceScaleId:'macd'});add(c.map(function(){return 0;}),{color:'rgba(120,130,140,.4)',lineStyle:2,priceScaleId:'macd'});setScale('macd');}
    if(p.inds.stoch){var st=stoch(p.bars,14,3);add(st.k,{color:'#c2f64a',priceScaleId:'stoch'});add(st.d,{color:'#ff6258',priceScaleId:'stoch'});add(c.map(function(){return 80;}),{color:'rgba(255,159,77,.22)',lineStyle:2,priceScaleId:'stoch'});add(c.map(function(){return 20;}),{color:'rgba(46,189,133,.22)',lineStyle:2,priceScaleId:'stoch'});setScale('stoch');}
    if(p.inds.atr){add(atr(p.bars,14),{color:'#ffb347',priceScaleId:'atr'});setScale('atr');}
    if(p.inds.wr){add(willr(p.bars,14),{color:'#ffd75a',priceScaleId:'wr'});add(c.map(function(){return -20;}),{color:'rgba(255,98,88,.3)',lineStyle:2,priceScaleId:'wr'});add(c.map(function(){return -80;}),{color:'rgba(46,189,133,.3)',lineStyle:2,priceScaleId:'wr'});setScale('wr');}
    if(p.inds.cci){add(cci(p.bars,20),{color:'#7fb6ff',priceScaleId:'cci'});add(c.map(function(){return 100;}),{color:'rgba(255,98,88,.25)',lineStyle:2,priceScaleId:'cci'});add(c.map(function(){return -100;}),{color:'rgba(46,189,133,.25)',lineStyle:2,priceScaleId:'cci'});setScale('cci');}
    if(p.inds.vol){var vs;try{vs=p.chart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'vol',lastValueVisible:false,priceLineVisible:false});}catch(e){}
      if(vs){var vd=[];for(var vi=0;vi<p.bars.length;vi++){var vb=p.bars[vi],vv=+vb.vol;if(isFinite(vv)&&vv>0)vd.push({time:vb.time,value:vv,color:(+vb.close>=+vb.open)?'rgba(46,189,133,.45)':'rgba(255,98,88,.45)'});}try{vs.setData(vd);}catch(e){}p.indSeries.push(vs);}
      setScale('vol');}
  }
  // ---- trade import ----
  function liqOf(e){var long=e.side!=='short',lv=(+e.lev>0)?+e.lev:1,mmr=(e.mmr||0.005);return e.liq||(long?e.entry*(1-(1-mmr)/lv):e.entry*(1+(1-mmr)/lv));}
  function drawTrades(p){clearTrades(p);if(!p.candle)return;var d;try{d=JSON.parse(localStorage.getItem('mp_journal')||'[]')||[];}catch(e){d=[];}
    d.filter(function(e){return e.status==='open'&&e.sym===p.sym;}).forEach(function(e){var long=e.side!=='short';
      try{p.tradeLines.push(p.candle.createPriceLine({price:+e.entry,color:long?'#10b981':'#ef4444',lineWidth:1,lineStyle:0,axisLabelVisible:true,title:(long?'LONG':'SHORT')+' '+(e.lev||1)+'x'}));}catch(_){}
      try{p.tradeLines.push(p.candle.createPriceLine({price:liqOf(e),color:'#ff3b3b',lineWidth:2,lineStyle:0,axisLabelVisible:true,title:'LIQ'}));}catch(_){}});}
  function clearTrades(p){p.tradeLines.forEach(function(l){try{p.candle.removePriceLine(l);}catch(e){}});p.tradeLines=[];}
  // ---- drawing: toggles the price-anchored draw engine on the ACTIVE pane (each pane has its own .cwin-tools palette) ----
  function toggleDraw(btn){var p=panes[activeI];if(!p||!p.w||!p.w.dr)return;p.w.dr.on=!p.w.dr.on;p.el.classList.toggle('drawing',p.w.dr.on);btn.classList.toggle('on',p.w.dr.on);}
  function clearPaneDraw(p){if(p&&p.w&&p.w.dr){p.w.dr.shapes=[];p.w.dr.cur=null;if(p.w.dr.redraw)p.w.dr.redraw();}}
  function toggleTrades(btn){var on=!btn.classList.contains('on');btn.classList.toggle('on',on);panes.forEach(function(p){p.trades=on;if(on)drawTrades(p);else clearTrades(p);});}
  function setActive(i){if(i<0||i>=panes.length)return;activeI=i;panes.forEach(function(p,k){p.el.classList.toggle('active',k===i);});syncBar();var db=ov&&ov.querySelector('[data-act="draw"]'),ap=panes[activeI];if(db)db.classList.toggle('on',!!(ap&&ap.w&&ap.w.dr&&ap.w.dr.on));}
  function syncBar(){var p=panes[activeI];if(!p||!ov)return;var sL=ov.querySelector('.mfc-symL'),tL=ov.querySelector('.mfc-tfL');if(sL)sL.textContent=p.sym;if(tL)tL.textContent=tfLabel(p.tf);}
  // ---- split ----
  function toggleSplit(){split=split===1?2:1;var st=ov.querySelector('#mfcStage'),sL=ov.querySelector('.mfc-splitL');st.classList.toggle('split',split===2);if(sL)sL.textContent=split===2?mcT('mc1chart','1 chart'):mcT('mc2charts','2 charts');
    if(split===2&&panes.length<2){var p=mkPane(panes[0]&&panes[0].sym==='BTC'?'ETH':'BTC','60');panes.push(p);st.appendChild(p.el);loadLib(function(){initChart(p);});}
    else if(split===1&&panes.length>1){var rem=panes.pop();if(rem.w)rem.w.dead=true;try{if(rem.chart)rem.chart.remove();}catch(e){}if(rem.el.parentNode)rem.el.parentNode.removeChild(rem.el);if(activeI>0)setActive(0);}
    setTimeout(function(){panes.forEach(function(p){if(p.w&&p.w.dr&&p.w.dr.redraw)p.w.dr.redraw();});},140);
  }
  // ---- bottom sheets ----
  var sheet=null,floatEl=null;
  function closeSheet(){if(sheet&&sheet.parentNode)sheet.parentNode.removeChild(sheet);sheet=null;}
  function closeFloat(){if(floatEl&&floatEl.parentNode)floatEl.parentNode.removeChild(floatEl);floatEl=null;}
  // floating, draggable calculator — sits at the top so the keyboard never covers it, easy to type, easy to dismiss
  function openCalc(){closeFloat();var p=panes[activeI];floatEl=document.createElement('div');floatEl.className='mfc-float';
    floatEl.innerHTML='<div class="mfc-float-h"><b>'+mcT('mcCalcTitle','Liquidation calculator')+'</b><button class="mfc-float-x" data-fx aria-label="Close">✕</button></div><div class="mfc-float-b" id="mfcFB"></div>';
    ov.appendChild(floatEl);floatEl.querySelector('[data-fx]').addEventListener('click',closeFloat);
    buildCalc(floatEl.querySelector('#mfcFB'),p);dragFloat(floatEl,floatEl.querySelector('.mfc-float-h'));}
  function dragFloat(panel,handle){var sx,sy,ox,oy,drag=false;
    handle.addEventListener('pointerdown',function(e){if(e.target.closest('[data-fx]'))return;drag=true;var r=panel.getBoundingClientRect();panel.style.left=r.left+'px';panel.style.top=r.top+'px';panel.style.transform='none';sx=e.clientX;sy=e.clientY;ox=r.left;oy=r.top;try{handle.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();});
    handle.addEventListener('pointermove',function(e){if(!drag)return;panel.style.left=Math.max(4,ox+(e.clientX-sx))+'px';panel.style.top=Math.max(4,oy+(e.clientY-sy))+'px';});
    handle.addEventListener('pointerup',function(){drag=false;});}
  function openSheet(kind){closeSheet();var p=panes[activeI];sheet=document.createElement('div');sheet.className='mfc-sheet';
    var title={sym:mcT('mcChooseCoin','Choose coin'),tf:mcT('mcTimeframe','Timeframe'),ind:mcT('indBtn','Indicators'),calc:mcT('mcCalcTitle','Liquidation calculator'),ai:mcT('mcAiTitle','AI chart assistant')}[kind]||'';
    sheet.innerHTML='<div class="mfc-sheet-h"><b>'+title+'</b><button class="mfc-sheet-x" data-x>✕</button></div><div class="mfc-sheet-b" id="mfcSB"></div>';
    ov.appendChild(sheet);sheet.querySelector('[data-x]').addEventListener('click',closeSheet);
    var body=sheet.querySelector('#mfcSB');
    if(kind==='sym')buildSym(body,p);
    else if(kind==='tf')buildTf(body,p);
    else if(kind==='ind')buildInd(body,p);
    else if(kind==='calc')buildCalc(body,p);
    else if(kind==='ai')buildAi(body,p);
  }
  function buildTf(body,p){body.innerHTML='<div class="mfc-sl">'+TFS.map(function(t){return '<button class="'+(t[0]===p.tf?'on':'')+'" data-tf="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</div>';
    body.addEventListener('click',function(e){var b=e.target.closest('[data-tf]');if(!b)return;p.tf=b.getAttribute('data-tf');clearPaneDraw(p);loadKlines(p);syncBar();closeSheet();});}
  function buildSym(body,p){body.innerHTML='<input class="mfc-ss" placeholder="'+mcT('mtSearchTicker','Search any ticker…')+'" inputmode="search"><div class="mfc-sl" id="mfcSyl"></div>';
    var inp=body.querySelector('.mfc-ss'),list=body.querySelector('#mfcSyl');
    if(window.mpLoadTokens)window.mpLoadTokens(function(){tokens=window.mpTokens||tokens;});
    function render(q){q=String(q||'').toUpperCase().replace(/[^A-Z0-9]/g,'');var arr=q?(window.mpTokens||tokens).filter(function(t){return t.indexOf(q)===0;}).concat((window.mpTokens||tokens).filter(function(t){return t.indexOf(q)>0;})):tokens.slice(0,12);list.innerHTML=arr.slice(0,40).map(function(t){return '<button class="'+(t===p.sym?'on':'')+'" data-pick="'+t+'">'+t+'</button>';}).join('');}
    render('');inp.addEventListener('input',function(){render(this.value);});
    list.addEventListener('click',function(e){var b=e.target.closest('[data-pick]');if(!b)return;p.sym=b.getAttribute('data-pick');clearPaneDraw(p);try{if(window.mpWS)window.mpWS.sub(p.sym);}catch(_){}loadKlines(p);syncBar();closeSheet();});
    setTimeout(function(){inp.focus();},40);}
  function buildInd(body,p){body.innerHTML='<div class="mfc-indm">'+INDS.map(function(d){return '<button class="'+(p.inds[d[0]]?'on':'')+'" data-ind="'+d[0]+'">'+d[1]+'</button>';}).join('')+'</div><p style="color:#9aa3ad;font-size:11.5px;margin-top:12px">'+mcT('mcIndNote','Same indicator families as the desktop workspace. Applies to the selected chart.')+'</p>';
    body.addEventListener('click',function(e){var b=e.target.closest('[data-ind]');if(!b)return;var k=b.getAttribute('data-ind');p.inds[k]=!p.inds[k];b.classList.toggle('on',!!p.inds[k]);applyInds(p);});}
  function buildCalc(body,p){var pr=price(p.sym)||(p.lastBar&&p.lastBar.close)||0;
    body.innerHTML='<div class="mfc-calc-grid"><div class="mfc-calc-seg" id="mfcCs"><button class="on" data-side="long">'+mcT('long','Long')+'</button><button data-side="short">'+mcT('short','Short')+'</button></div>'
      +'<label>'+mcT('lEntry','Entry price')+' (USD)</label><input id="mfcCe" type="number" inputmode="decimal" value="'+(pr||'').toString()+'" step="any">'
      +'<label>'+mcT('lLeverage','Leverage')+'</label><input id="mfcCl" type="number" inputmode="numeric" value="10" step="any">'
      +'<div class="mfc-calc-out"><div class="big" id="mfcCo">—</div><div class="sub" id="mfcCd">'+mcT('rEstLiq','Estimated liquidation price')+'</div></div></div>';
    var side='long';
    function calc(){var e=+body.querySelector('#mfcCe').value,L=+body.querySelector('#mfcCl').value,mmr=0.005;if(!(e>0)||!(L>0)){body.querySelector('#mfcCo').textContent='—';return;}var liq=side==='long'?e*(1-(1-mmr)/L):e*(1+(1-mmr)/L);var dist=(1/L-mmr)*100;body.querySelector('#mfcCo').textContent=fp(liq);body.querySelector('#mfcCd').textContent=(side==='long'?mcT('long','Long'):mcT('short','Short'))+' '+mcT('mtLiq','liq')+' · '+dist.toFixed(2)+'% '+mcT('mcFromEntry','from entry');}
    body.querySelector('#mfcCs').addEventListener('click',function(e){var b=e.target.closest('[data-side]');if(!b)return;side=b.getAttribute('data-side');this.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);});calc();});
    body.querySelector('#mfcCe').addEventListener('input',calc);body.querySelector('#mfcCl').addEventListener('input',calc);calc();}
  function buildAi(body,p){
    var me=(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me())||null;
    if(!me){body.innerHTML='<p style="color:#cfd4da;font-size:14px;line-height:1.5">'+mcT('mcAiSignin','Sign in (free) to ask the AI about this chart.')+'</p><button class="mfc-b on" data-auth-open style="margin-top:10px">'+mcT('mcSigninFree','Sign in free')+'</button>';return;}
    body.innerHTML='<div class="mfc-ai-body" id="mfcAB"><div class="mfc-ai-msg ai">'+mcT('mcAskAbout','Ask me about')+' '+p.sym+' '+tfLabel(p.tf)+' — '+mcT('mcAiHint','trend, levels, or what the indicators suggest.')+'</div></div><div class="mfc-ai-in"><input id="mfcAI" placeholder="'+mcT('mcAskPh','Ask about')+' '+p.sym+'…"><button id="mfcAS">'+mcT('mcSend','Send')+'</button></div>';
    var msgs=body.querySelector('#mfcAB'),inp=body.querySelector('#mfcAI'),btn=body.querySelector('#mfcAS'),busy=false;
    function add(cls,txt){var d=document.createElement('div');d.className='mfc-ai-msg '+cls;d.textContent=txt;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d;}
    function ctx(){
      // use the desktop's rich analysis builder (price, swing highs/lows, EMA/SMA, RSI, MACD, ATR…) so the AI can actually read the chart
      try{if(window.__mpAiContext&&p.bars&&p.bars.length>10){var rc=window.__mpAiContext({sym:p.sym,tf:p.tf,bars:p.bars});if(rc){rc.indicatorsShown=Object.keys(p.inds).filter(function(k){return p.inds[k];});return rc;}}}catch(e){}
      var pr=price(p.sym)||(p.lastBar&&p.lastBar.close)||0;return 'Symbol '+p.sym+' on '+tfLabel(p.tf)+' timeframe. Current price '+(pr?fp(pr):'unknown')+'.';
    }
    function send(){var q=(inp.value||'').trim();if(!q||busy)return;busy=true;inp.value='';add('me',q);var bub=add('ai','…');
      fetch('/api/ai/chart',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({context:ctx(),question:q,history:[],stream:true,lang:(window.mpLang||document.documentElement.lang||'en')})}).then(function(resp){
        if(!resp.ok){busy=false;bub.textContent=resp.status===429?'Daily AI limit reached — resets tomorrow.':(resp.status===401?'Please sign in to use AI.':'Could not reach AI — try again.');return;}
        if(!resp.body||!resp.body.getReader){busy=false;bub.textContent='Streaming not supported.';return;}
        var rd=resp.body.getReader(),dec=new TextDecoder(),buf='',acc='';
        (function pump(){rd.read().then(function(res){if(res.done){busy=false;if(!acc)bub.textContent='No answer — try again.';return;}buf+=dec.decode(res.value,{stream:true});var idx;while((idx=buf.indexOf('\n'))>=0){var line=buf.slice(0,idx).replace(/\r$/,'');buf=buf.slice(idx+1);if(line.indexOf('data:')!==0)continue;var data=line.slice(5).trim();if(!data)continue;try{var ev=JSON.parse(data);if(ev.type==='content_block_delta'&&ev.delta&&ev.delta.text){acc+=ev.delta.text;bub.textContent=acc;msgs.scrollTop=msgs.scrollHeight;}}catch(e){}}pump();}).catch(function(){busy=false;});})();
      }).catch(function(){busy=false;bub.textContent='Network error — try again.';});}
    btn.addEventListener('click',send);inp.addEventListener('keydown',function(e){if(e.key==='Enter')send();});setTimeout(function(){inp.focus();},40);}
  // ---- open / close ----
  var entered=false;
  function isPortrait(){return !!(window.matchMedia&&window.matchMedia('(orientation:portrait)').matches);}
  function showGate(on){var g=ov&&ov.querySelector('.mfc-gate');if(g)g.hidden=!on;var bar=ov&&ov.querySelector('.mfc-bar'),st=ov&&ov.querySelector('#mfcStage'),fab=ov&&ov.querySelector('.mfc-ai-fab');[bar,st,fab].forEach(function(x){if(x)x.style.visibility=on?'hidden':'';});}
  function open(){ if(!ov)build(); ov.hidden=false; document.documentElement.style.overflow='hidden';
    if(!entered&&isPortrait()){showGate(true);return;}   // first entry in portrait → the "best in landscape" hint
    proceed();
  }
  function proceed(){ entered=true; showGate(false);
    if(!panes.length){var p=mkPane('BTC','60');panes.push(p);ov.querySelector('#mfcStage').appendChild(p.el);setActive(0);loadLib(function(){initChart(p);});}
    else{panes.forEach(function(p){setTimeout(function(){if(!p.chart)loadLib(function(){initChart(p);});else{loadKlines(p);}},20);});setActive(activeI);}
    setTimeout(function(){panes.forEach(function(p){if(p.w&&p.w.dr&&p.w.dr.redraw)p.w.dr.redraw();});},160);
  }
  var backEl=null,backWait=false,backBrowse=false;
  function showBack(){ if(!backEl){ backEl=document.createElement('div');backEl.className='mfc-back';
      backEl.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M12 3v2M12 19v2"/></svg>'
        +'<h3>'+mcT('mcBackT','Turn your phone upright')+'</h3><p>'+mcT('mcBackS','Charts closed — rotate back to keep browsing.')+'</p>'
        +'<button class="mfc-back-x" type="button">'+mcT('mcBackX','Exit anyway')+'</button>';
      ov.appendChild(backEl);
      backEl.querySelector('.mfc-back-x').addEventListener('click',function(){finishBack();}); }
    backEl.hidden=false; var st=ov.querySelector('#mfcStage'),bar=ov.querySelector('.mfc-bar');if(st)st.style.visibility='hidden';if(bar)bar.style.visibility='hidden'; }
  function finishBack(){ backWait=false; if(backEl)backEl.hidden=true;
    var st=ov&&ov.querySelector('#mfcStage'),bar=ov&&ov.querySelector('.mfc-bar');if(st)st.style.visibility='';if(bar)bar.style.visibility='';
    reallyClose();
    if(backBrowse){backBrowse=false;setTimeout(function(){try{if(window.__openBrowse)window.__openBrowse();}catch(e){}},220);} /* land the user straight in Browse, as requested */ }
  function reallyClose(){ if(!ov)return; ov.hidden=true; document.documentElement.style.overflow=''; closeSheet(); closeFloat(); resetViewportHard(); }
  function close(){ if(!ov)return;
    if(!isPortrait()){ /* closing in LANDSCAPE used to dump the user on an 844px-wide page → the DESKTOP homepage flashed and iOS kept a ~25% zoom. Hold a dark "rotate back" panel instead; portrait finishes the close and opens Browse. */
      backWait=true; backBrowse=true; closeSheet(); closeFloat(); showBack(); return; }
    reallyClose();
  }
  window.mpOpenCharts=open;
  // live ticks
  document.addEventListener('mp:price',function(ev){if(!ov||ov.hidden||!ev.detail)return;panes.forEach(function(p){if(p.sym===ev.detail.sym)live(p);});});
  setInterval(function(){if(!ov||ov.hidden)return;panes.forEach(function(p){
    // liveness: if the WS hasn't ticked this symbol for >8s, pull a REST price so the pane can NEVER freeze on a stale value
    var lp=window.mpLivePrices&&window.mpLivePrices[p.sym];
    if(!lp||!lp.t||Date.now()-lp.t>8000){ try{if(window.mpWS)window.mpWS.sub(p.sym);}catch(e){}
      if(!p._rf||Date.now()-p._rf>8000){ p._rf=Date.now();
        fetch('/api/price?symbol='+encodeURIComponent(p.sym),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){var px=j&&+j.price;if(px>0&&window.mpLivePrices){window.mpLivePrices[p.sym]={p:px,t:Date.now(),chg:(j.chg!=null?+j.chg:(lp&&lp.chg))};}live(p);});
      } return; }
    live(p);});},2000);
  // returning to the tab: the 60s reload gate only fires from live ticks, so force a real klines re-sync immediately
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&ov&&!ov.hidden)panes.forEach(function(p){if(p.candle)loadKlines(p);});});
  // Browse "Charts" → open full-screen on mobile (intercept before navigation)
  document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-mcharts]');if(!t)return;if(isMob()){e.preventDefault();e.stopPropagation();open();}},true);
  // landing on /charts on a phone → open the full-screen experience automatically
  if(isMob()&&/^\/charts\/?$/.test(location.pathname)){window.addEventListener('load',function(){setTimeout(open,250);});}
})();
