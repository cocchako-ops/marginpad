/* Mobile full-screen Charts — landscape-first 1/2-pane workspace: same indicator families as desktop, drawing, trade import, an AI chat bubble and a quick liq calculator. Exposed as window.mpOpenCharts(). */
(function(){
  var ov=null,panes=[],activeI=0,split=1,drawOn=false,tokens=['BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK'];
  function isMob(){return !!(window.matchMedia&&window.matchMedia('(max-width:880px)').matches);}
  // iOS leaves the layout viewport scaled (~2x) after a landscape→portrait rotation when user-scalable=no — re-assert + jiggle the viewport meta to clamp scale back to 1 (kills the "everything is huge" zoom after closing charts)
  function resetViewport(){try{var m=document.querySelector('meta[name="viewport"]');if(!m)return;var c=m.getAttribute('content')||'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';var base=c.replace(/,?\s*minimum-scale=[^,]*/,'');m.setAttribute('content',base+', minimum-scale=1.0');setTimeout(function(){m.setAttribute('content',base);},60);}catch(e){}}
  function resetViewportHard(){resetViewport();setTimeout(resetViewport,280);setTimeout(resetViewport,800);}
  var _fsT=null;
  function forceScale1(then){ /* verify-and-retry: iOS sometimes re-applies the stale scale — loop the meta jiggle until visualViewport really reads ~1 (max ~3s) */
    if(_fsT){clearInterval(_fsT);_fsT=null;}
    var n=0;resetViewport();
    _fsT=setInterval(function(){ n++;
      var vv=window.visualViewport,okNow=!vv||Math.abs((vv.scale||1)-1)<0.03;
      if(okNow||n>18){clearInterval(_fsT);_fsT=null;if(then)try{then(okNow);}catch(e){}return;}
      resetViewport();
    },160);
  }
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
  /* Supertrend(10,3) buy/sell markers — same engine as the desktop workspace + Paper Trade "Signals" */
  function computeSignals(d){var n=d?d.length:0,P=10,M=3;if(n<P+3)return [];
    var tr=[],i;for(i=0;i<n;i++){tr.push(i===0?d[i].high-d[i].low:Math.max(d[i].high-d[i].low,Math.abs(d[i].high-d[i-1].close),Math.abs(d[i].low-d[i-1].close)));}
    var at=[],seed=0;for(i=0;i<P;i++)seed+=tr[i];var a=seed/P;for(i=0;i<n;i++){if(i<P)at.push(a);else{a=(a*(P-1)+tr[i])/P;at.push(a);}}
    var fU=[],fL=[],dir=[],mk=[];for(i=0;i<n;i++){var hl2=(d[i].high+d[i].low)/2,bU=hl2+M*at[i],bL=hl2-M*at[i];
      var pU=i?fU[i-1]:bU,pL=i?fL[i-1]:bL;
      var cU=(bU<pU||(i&&d[i-1].close>pU))?bU:pU,cL=(bL>pL||(i&&d[i-1].close<pL))?bL:pL;fU.push(cU);fL.push(cL);
      var pd=i?dir[i-1]:1,cd;if(i===0)cd=1;else if(pd===1)cd=d[i].close<cL?-1:1;else cd=d[i].close>cU?1:-1;dir.push(cd);
      if(i>P&&cd!==pd)mk.push(cd===1?{time:d[i].time,position:'belowBar',color:'#2ebd85',shape:'arrowUp',text:'BUY'}:{time:d[i].time,position:'aboveBar',color:'#ff6258',shape:'arrowDown',text:'SELL'});}
    return mk;}
  /* Support/resistance — recent pivot highs/lows (same as desktop computeSR) */
  function computeSR(d){var L=6,n=d?d.length:0,lv=[];if(n<2*L+6)return lv;
    for(var i=L;i<n-L;i++){var hi=d[i].high,lo=d[i].low,ph=true,pl=true;
      for(var j=i-L;j<=i+L;j++){if(d[j].high>hi)ph=false;if(d[j].low<lo)pl=false;}
      if(ph)lv.push({price:hi,type:'r'});if(pl)lv.push({price:lo,type:'s'});}
    var rs=lv.filter(function(x){return x.type==='r';}).slice(-3),ss=lv.filter(function(x){return x.type==='s';}).slice(-3);
    return rs.concat(ss);}
  var TFS=[['1','1m'],['5','5m'],['15','15m'],['60','1h'],['240','4h'],['1440','1d']];
  var INDS=[['sig','Buy / Sell signals'],['sr','Support / Resistance'],['ema9','EMA 9'],['ema21','EMA 21'],['ema50','EMA 50'],['ema100','EMA 100'],['ema200','EMA 200'],['sma20','SMA 20'],['sma50','SMA 50'],['sma100','SMA 100'],['sma200','SMA 200'],['hma','Hull MA 21'],['vwap','VWAP'],['bb','Bollinger'],['vol','Volume'],['rsi','RSI'],['macd','MACD'],['stoch','Stoch'],['atr','ATR'],['wr','Williams %R'],['cci','CCI']];
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
      +'<button class="mfc-b mfc-tradebtn" data-act="trade"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'+mcT('mcDemoTrade','Demo trade')+'</button>'
      +'<span class="mfc-grow"></span>'
      +'<button class="mfc-b mfc-ai" data-act="ai" aria-label="Ask AI"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>'+mcT('mcAi','AI')+'</button>'
      +'</div>'
      +'<div class="mfc-stage" id="mfcStage"></div>'
      +'<div class="mfc-rot"'+(rotOff()?' hidden':'')+'><span>'+mcT('mcRotate','↻ Rotate your phone for a wider chart')+'</span><button class="mfc-rot-x" type="button" aria-label="Dismiss">✕</button></div>';
    document.body.appendChild(ov);
    var rx=ov.querySelector('.mfc-rot-x');if(rx)rx.addEventListener('click',function(e){e.stopPropagation();var r=ov.querySelector('.mfc-rot');if(r)r.hidden=true;try{localStorage.setItem('mp_mfc_rot_off','1');}catch(_){}});
    var gate=document.createElement('div');gate.className='mfc-gate';gate.hidden=true;
    gate.innerHTML='<button class="mfc-gate-x" data-gx aria-label="Close">✕</button>'
      +'<svg style="animation:mfcRotPulse 2.2s ease-in-out infinite" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18.5" x2="13" y2="18.5"/></svg>'
      +'<h3>'+mcT('mcGateT2','Rotate your phone')+'</h3><p>'+mcT('mcGateS2','Charts work in landscape — turn your phone sideways and they open instantly.')+'</p>'
      +'<button class="mfc-gate-go" data-gx style="background:none;border:1px solid #2c3540;color:#9aa3ad">'+mcT('mcClose','Close')+' ✕</button>';
    ov.appendChild(gate);
    Array.prototype.forEach.call(gate.querySelectorAll('[data-gx]'),function(x){x.addEventListener('click',close);});
    ov.addEventListener('click',onBarClick);
    function onR(){if(!ov||ov.hidden)return;if(backWait){if(isPortrait())finishBack();return;}
      // portrait no longer walls off the charts — they WORK in portrait (verified by the real-browser UX audit); the
      // full-screen gate was blocking a functional experience. The inline .mfc-rot hint still nudges toward landscape.
      showGate(false);if(!entered){proceed();return;}
      setTimeout(function(){panes.forEach(function(p){if(p.w&&p.w.dr&&p.w.dr.redraw)p.w.dr.redraw();});},140);}
    window.addEventListener('resize',function(){setTimeout(onR,120);});
    window.addEventListener('orientationchange',function(){resetViewportHard();setTimeout(onR,300);setTimeout(pinBar,120);setTimeout(pinBar,500);});
    if(window.visualViewport){window.visualViewport.addEventListener('resize',pinBar);window.visualViewport.addEventListener('scroll',pinBar);}
  }
  function pinBar(){try{ var vv=window.visualViewport,bar=ov&&ov.querySelector('.mfc-bar'); if(!vv||!bar)return;
    if(ov.hidden){bar.style.transform='';bar.style.width='';return;}
    var sc=vv.scale||1,ox=vv.offsetLeft||0,oy=vv.offsetTop||0;
    if(Math.abs(sc-1)<0.02&&ox<2&&oy<2){bar.style.transform='';bar.style.width='';return;}
    bar.style.transformOrigin='0 0';
    bar.style.width=(vv.width*sc)+'px';
    bar.style.transform='translate('+ox+'px,'+oy+'px) scale('+(1/sc)+')';
  }catch(e){}}
  function onBarClick(e){var b=e.target.closest&&e.target.closest('[data-act]');if(!b)return;var a=b.getAttribute('data-act');
    if(a==='close')return close();
    if(a==='split')return toggleSplit();
    if(a==='draw')return toggleDraw(b);
    if(a==='trades')return toggleTrades(b);
    if(a==='sym')return openSheet('sym');
    if(a==='tf')return openSheet('tf');
    if(a==='ind')return openSheet('ind');
    if(a==='calc')return openCalc();
    if(a==='trade')return openTrade();
    if(a==='ai')return openSheet('ai');
  }
  // ---- panes ----
  // Drawing palette comes from the shared builder in mp-charts.js (loaded before this module by the home.js loader) — no alert tool on mobile. Evaluated lazily at pane build so load order can't race.
  function TOOLS(){return (window.__mpDrawToolsHtml?window.__mpDrawToolsHtml(false):'<div class="cwin-tools"></div>');}
  function mkPane(sym,tf){
    var el=document.createElement('div');el.className='mfc-pane';
    el.innerHTML='<div class="mfc-chart"></div><canvas class="cwin-draw"></canvas>'+TOOLS()+'<div class="mfc-pl"><b class="mfc-pl-s"></b> <span class="mfc-pl-tf"></span> <span class="mfc-pl-p"></span></div><div class="cwin-leg"></div>';
    var p={el:el,host:el.querySelector('.mfc-chart'),sym:sym,tf:tf,bars:[],lastBar:null,chart:null,candle:null,inds:{},indSeries:[],indLines:[],tradeLines:[],_mtPrices:[],reload:0,w:null};
    el.addEventListener('pointerdown',function(){setActive(panes.indexOf(p));},true);
    return p;
  }
  function initChart(p){ if(p.chart||!window.LightweightCharts||!p.host.clientWidth){return;}
    p.chart=LightweightCharts.createChart(p.host,{layout:{background:{color:'transparent'},textColor:'#9aa3ad',fontFamily:"'Familjen Grotesk',system-ui,sans-serif",attributionLogo:false},grid:{vertLines:{color:'rgba(35,41,50,.35)'},horzLines:{color:'rgba(35,41,50,.35)'}},rightPriceScale:{borderColor:'#232932'},timeScale:{borderColor:'#232932',timeVisible:true,secondsVisible:false,rightOffset:5,barSpacing:6},crosshair:{mode:0},autoSize:true});
    try{p.chart.subscribeCrosshairMove(function(param){mLeg(p,param);});}catch(e){}
    p.candle=p.chart.addCandlestickSeries({upColor:'#2ebd85',downColor:'#ff6258',borderVisible:false,wickUpColor:'#2ebd85',wickDownColor:'#ff6258',
      // extend the auto-fit range to include the imported position's entry/liq lines (capped at 2.4× the candle range)
      // so a TF switch can't re-fit to candles only and push the lines off-screen — mirrors the desktop engines.
      autoscaleInfoProvider:function(orig){try{
        if(!p.bars||!p.bars.length)return orig?orig():null;
        var vr=null;try{vr=p.chart.timeScale().getVisibleLogicalRange();}catch(e){}
        var n=p.bars.length,from=vr?Math.max(0,Math.floor(vr.from)):Math.max(0,n-160),to=vr?Math.min(n-1,Math.ceil(vr.to)):n-1;
        var cLo=Infinity,cHi=-Infinity;for(var i=from;i<=to;i++){var b=p.bars[i];if(!b)continue;if(b.low<cLo)cLo=b.low;if(b.high>cHi)cHi=b.high;}
        if(p.lastBar){if(p.lastBar.low<cLo)cLo=p.lastBar.low;if(p.lastBar.high>cHi)cHi=p.lastBar.high;}
        if(!(isFinite(cLo)&&isFinite(cHi)&&cHi>cLo))return orig?orig():null;
        var cRange=cHi-cLo,lo=cLo,hi=cHi,budget=cRange*2.4,mp=p._mtPrices||[];
        for(var k=0;k<mp.length;k++){var v=mp[k];if(!(v>0))continue;
          if(v<cLo){if((cLo-v)<=budget&&v<lo)lo=v;}
          else if(v>cHi){if((v-cHi)<=budget&&v>hi)hi=v;}}
        var pad=(hi-lo)*0.06;
        return {priceRange:{minValue:lo-pad,maxValue:hi+pad}};
      }catch(e){return orig?orig():null;}}});
    // price-anchored drawing (reuse the desktop engine → trendline/fib/h-line/v-line/pen + colours, and it re-projects on rotation/resize)
    try{if(window.__mpDraw){p.w={chart:p.chart,candle:p.candle,el:p.el,sym:p.sym,tf:p.tf,bars:p.bars,dead:false};window.__mpDraw.setup(p.w,p.el);window.__mpDraw.wire(p.w,null,p.el.querySelector('.cwin-tools'));}}catch(e){}
    loadKlines(p);
  }
  function loadKlines(p){ if(!p.candle)return;var sym=p.sym,tf=p.tf;p.reload=Date.now();
    fetch('/api/klines?symbol='+encodeURIComponent(sym)+'&interval='+tf,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){
      if(p.dead||sym!==p.sym||tf!==p.tf||!p.candle)return;
      if(kd&&kd.length){kd=sanitizeBars(kd);p.bars=kd;p.lastBar=kd[kd.length-1];p._lgp=+p.lastBar.close||0;p._rej=0;try{p.candle.setData(kd);p.chart.priceScale('right').applyOptions({autoScale:true});p.chart.timeScale().scrollToRealTime();}catch(e){}applyInds(p);if(p.trades)drawTrades(p);try{if(p.w){p.w.sym=p.sym;p.w.tf=p.tf;p.w.bars=p.bars;if(p.w.dr&&p.w.dr.reload)p.w.dr.reload();}}catch(e){}}
      label(p);
    });
  }
  function live(p){if(!p.candle)return;
    if(Date.now()-p.reload>(p.lastBar?60000:5000)){loadKlines(p);return;} // cold-start self-heal: if the FIRST klines fetch failed (lastBar still null) retry every 5s instead of a permanently blank chart; otherwise the normal 60s re-sync (checked BEFORE the pr>0 bail so a stalled feed still refetches)
    if(!p.lastBar)return;
    var pr=price(p.sym);if(!(pr>0))return;
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
  // ---- indicator value legend (owner request: RSI etc. must SHOW their number) ----
  function legFmt(v,dec){if(v==null||!isFinite(v))return '\u2014';if(dec===0)return String(Math.round(v));if(dec!=null)return (+v).toFixed(dec);var a=Math.abs(v);return a>=1000?(+v).toLocaleString('en-US',{maximumFractionDigits:2}):a>=1?(+v).toFixed(3):(+v).toFixed(6);}
  function mLeg(p,param){var el=p.el.querySelector('.cwin-leg');if(!el)return;
    if(!p.legItems||!p.legItems.length){el.style.display='none';el.innerHTML='';return;}
    el.style.display='';
    el.innerHTML=p.legItems.map(function(it){var v=it.last;
      if(param&&param.seriesData){var sd=param.seriesData.get(it.series);if(sd!=null)v=(typeof sd==='object'?(sd.value!=null?sd.value:sd.close):sd);}
      return '<span style="color:'+it.color+'">'+it.label+' <b>'+legFmt(v,it.dec)+'</b></span>';}).join('');}
  // ---- indicators ----
  function applyInds(p){ if(!p.chart||!p.candle)return;
    p.indSeries.forEach(function(s){try{p.chart.removeSeries(s);}catch(e){}});p.indSeries=[];p.legItems=[];
    (p.indLines||[]).forEach(function(l){try{p.candle.removePriceLine(l);}catch(e){}});p.indLines=[];
    try{p.candle.setMarkers(p.inds.sig?computeSignals(p.bars):[]);}catch(e){}
    if(p.inds.sr)computeSR(p.bars).forEach(function(L){try{p.indLines.push(p.candle.createPriceLine({price:L.price,color:L.type==='r'?'#ff9f4d':'#3ad29a',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:L.type==='r'?'R':'S'}));}catch(e){}});
    var c=p.bars.map(function(b){return +b.close;}),t=p.bars.map(function(b){return b.time;});
    function add(vals,opts,leg){var s;try{s=p.chart.addLineSeries(Object.assign({lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false},opts));}catch(e){return;}var d=[];for(var i=0;i<vals.length;i++)if(vals[i]!=null&&isFinite(vals[i]))d.push({time:t[i],value:vals[i]});try{s.setData(d);}catch(e){}p.indSeries.push(s);if(leg){var last=null;for(var li=d.length-1;li>=0;li--){if(d[li]&&isFinite(d[li].value)){last=d[li].value;break;}}p.legItems.push({label:leg.label,series:s,color:opts.color,dec:leg.dec,last:last});}}
    var MA=[['ema9',9,'e','#7fb6ff'],['ema21',21,'e','#3fd8e6'],['ema50',50,'e','#5fe0a6'],['ema100',100,'e','#c2f64a'],['ema200',200,'e','#ffd75a'],['sma20',20,'s','#ff9f43'],['sma50',50,'s','#ff7b72'],['sma100',100,'s','#e0a0ff'],['sma200',200,'s','#ff5a4d']];
    var oscs=['rsi','macd','stoch','atr','vol','wr','cci'].filter(function(k){return p.inds[k];}),oN=oscs.length;
    try{p.chart.priceScale('right').applyOptions({scaleMargins:{top:0.06,bottom:oN?0.34:0.08}});}catch(e){}
    function band(key){var idx=oscs.indexOf(key),b=0.32/Math.max(1,oN);return {top:0.68+idx*b+0.005,bottom:(oN-1-idx)*b+0.02};}
    function setScale(id){try{p.chart.priceScale(id).applyOptions({scaleMargins:band(id)});}catch(e){}}
    MA.forEach(function(m){if(p.inds[m[0]])add(m[2]==='e'?ema(c,m[1]):sma(c,m[1]),{color:m[3]},{label:(m[2]==='e'?'EMA ':'SMA ')+m[1],dec:null});});
    if(p.inds.bb){var bb=boll(c,20,2);add(bb.u,{color:'rgba(154,163,173,.7)'});add(bb.m,{color:'rgba(154,163,173,.55)',lineStyle:2});add(bb.l,{color:'rgba(154,163,173,.7)'});}
    if(p.inds.vwap)add(vwap(p.bars),{color:'#46e0e6',lineWidth:2},{label:'VWAP',dec:null});
    if(p.inds.hma)add(hma(c,21),{color:'#ff7bd5'},{label:'HMA 21',dec:null});
    if(p.inds.rsi){add(rsi(c,14),{color:'#e0a0ff',priceScaleId:'rsi'},{label:'RSI 14',dec:0});add(c.map(function(){return 70;}),{color:'rgba(255,98,88,.25)',lineStyle:2,priceScaleId:'rsi'});add(c.map(function(){return 30;}),{color:'rgba(46,189,133,.25)',lineStyle:2,priceScaleId:'rsi'});setScale('rsi');}
    if(p.inds.macd){var mc=macd(c);add(mc.macd,{color:'#3fd8e6',priceScaleId:'macd'},{label:'MACD',dec:null});add(mc.signal,{color:'#ff9f4d',priceScaleId:'macd'},{label:'Signal',dec:null});add(c.map(function(){return 0;}),{color:'rgba(120,130,140,.4)',lineStyle:2,priceScaleId:'macd'});setScale('macd');}
    if(p.inds.stoch){var st=stoch(p.bars,14,3);add(st.k,{color:'#c2f64a',priceScaleId:'stoch'},{label:'Stoch %K',dec:0});add(st.d,{color:'#ff6258',priceScaleId:'stoch'},{label:'%D',dec:0});add(c.map(function(){return 80;}),{color:'rgba(255,159,77,.22)',lineStyle:2,priceScaleId:'stoch'});add(c.map(function(){return 20;}),{color:'rgba(46,189,133,.22)',lineStyle:2,priceScaleId:'stoch'});setScale('stoch');}
    if(p.inds.atr){add(atr(p.bars,14),{color:'#ffb347',priceScaleId:'atr'},{label:'ATR 14',dec:null});setScale('atr');}
    if(p.inds.wr){add(willr(p.bars,14),{color:'#ffd75a',priceScaleId:'wr'},{label:'%R 14',dec:0});add(c.map(function(){return -20;}),{color:'rgba(255,98,88,.3)',lineStyle:2,priceScaleId:'wr'});add(c.map(function(){return -80;}),{color:'rgba(46,189,133,.3)',lineStyle:2,priceScaleId:'wr'});setScale('wr');}
    if(p.inds.cci){add(cci(p.bars,20),{color:'#7fb6ff',priceScaleId:'cci'},{label:'CCI 20',dec:0});add(c.map(function(){return 100;}),{color:'rgba(255,98,88,.25)',lineStyle:2,priceScaleId:'cci'});add(c.map(function(){return -100;}),{color:'rgba(46,189,133,.25)',lineStyle:2,priceScaleId:'cci'});setScale('cci');}
    if(p.inds.vol){var vs;try{vs=p.chart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'vol',lastValueVisible:false,priceLineVisible:false});}catch(e){}
      if(vs){var vd=[];for(var vi=0;vi<p.bars.length;vi++){var vb=p.bars[vi],vv=+vb.vol;if(isFinite(vv)&&vv>0)vd.push({time:vb.time,value:vv,color:(+vb.close>=+vb.open)?'rgba(46,189,133,.45)':'rgba(255,98,88,.45)'});}try{vs.setData(vd);}catch(e){}p.indSeries.push(vs);}
      setScale('vol');}
    mLeg(p);
  }
  // ---- trade import ----
  function liqOf(e){var long=e.side!=='short',lv=(+e.lev>0)?+e.lev:1,mmr=(e.mmr||0.005);return e.liq||(long?e.entry*(1-(1-mmr)/lv):e.entry*(1+(1-mmr)/lv));}
  function drawTrades(p){clearTrades(p);if(!p.candle)return;var d;try{d=JSON.parse(localStorage.getItem('mp_journal')||'[]')||[];}catch(e){d=[];}
    var _g={};var _add=function(px,label,color,lw){if(!(px>0))return;p._mtPrices.push(px);var k=label+'@'+px.toPrecision(6);if(_g[k]){_g[k].n++;return;}_g[k]={p:px,t:label,c:color,w:lw,n:1};};
    d.filter(function(e){return e.status==='open'&&e.sym===p.sym;}).forEach(function(e){var long=e.side!=='short';
      _add(+e.entry,(long?'LONG':'SHORT')+' '+(e.lev||1)+'x',long?'#10b981':'#ef4444',1);
      _add(liqOf(e),'LIQ','#ff3b3b',2);});
    for(var gk in _g){var g=_g[gk];try{p.tradeLines.push(p.candle.createPriceLine({price:g.p,color:g.c,lineWidth:g.w,lineStyle:0,axisLabelVisible:true,title:g.t+(g.n>1?' ×'+g.n:'')}));}catch(_){}}} // one line per level (×N) — stacked labels covered the candles (UX audit, mobile)
  function clearTrades(p){p.tradeLines.forEach(function(l){try{p.candle.removePriceLine(l);}catch(e){}});p.tradeLines=[];p._mtPrices=[];}
  // ---- drawing: toggles the price-anchored draw engine on the ACTIVE pane (each pane has its own .cwin-tools palette) ----
  function toggleDraw(btn){var p=panes[activeI];if(!p||!p.w||!p.w.dr)return;p.w.dr.on=!p.w.dr.on;p.el.classList.toggle('drawing',p.w.dr.on);btn.classList.toggle('on',p.w.dr.on);}
  function clearPaneDraw(p){if(p&&p.w&&p.w.dr){p.w.dr.shapes=[];p.w.dr.cur=null;p.w.dr.sel=null;if(p.w.dr.redraw)p.w.dr.redraw();}}
  function toggleTrades(btn){var on=!btn.classList.contains('on');btn.classList.toggle('on',on);panes.forEach(function(p){p.trades=on;if(on)drawTrades(p);else clearTrades(p);});}
  function setActive(i){if(i<0||i>=panes.length)return;activeI=i;panes.forEach(function(p,k){p.el.classList.toggle('active',k===i);});syncBar();var db=ov&&ov.querySelector('[data-act="draw"]'),ap=panes[activeI];if(db)db.classList.toggle('on',!!(ap&&ap.w&&ap.w.dr&&ap.w.dr.on));mfcSave();}
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
  function openTrade(){closeFloat();var p=panes[activeI];if(!p)return;
    floatEl=document.createElement('div');floatEl.className='mfc-float mfc-trw';
    floatEl.innerHTML='<div class="mfc-float-h"><b>'+mcT('mcDemoTrade','Demo trade')+' — <span id="mtrSym">'+p.sym+'</span></b><button class="mfc-float-x" data-fx aria-label="Close">✕</button></div>'
      +'<div class="mfc-float-b">'
      +'<div class="mtr-seg" id="mtrSeg"><button class="on" data-side="long" type="button">'+mcT('long','Long')+'</button><button data-side="short" type="button">'+mcT('short','Short')+'</button></div>'
      +'<label class="mtr-lbl">'+mcT('lAmountIn','Amount (USD)')+'</label>'
      +'<input class="mtr-in" id="mtrAmt" type="number" inputmode="decimal" value="100" min="1" max="100000" step="any">'
      +'<label class="mtr-lbl">'+mcT('lLeverage','Leverage')+' <b id="mtrLevV" style="color:#c2f64a">20×</b></label>'
      +'<input class="mtr-sl" id="mtrLev" type="range" min="0" max="1000" value="434" step="1">'
      +'<div class="mtr-stats"><div><span>'+mcT('lEntry','Entry price')+'</span><b id="mtrPx">…</b></div><div><span>'+mcT('rEstLiq','Est. liquidation')+'</span><b id="mtrLiq">—</b></div><div><span>'+mcT('rPosSize','Position size')+'</span><b id="mtrSz">—</b></div></div>'
      +'<button class="mtr-open" id="mtrGo" type="button">'+mcT('mtOpen','Open demo trade')+'</button>'
      +'<div class="mtr-msg" id="mtrMsg"></div>'
      +'</div>';
    ov.appendChild(floatEl);floatEl.querySelector('[data-fx]').addEventListener('click',closeFloat);
    dragFloat(floatEl,floatEl.querySelector('.mfc-float-h'));
    var side='long';
    var posToLev=function(x){return Math.max(1,Math.min(1000,Math.round(Math.pow(1000,x/1000))));};
    var lev=posToLev(434);
    var q=function(id){return floatEl.querySelector('#'+id);};
    q('mtrSeg').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;side=b.getAttribute('data-side');
      Array.prototype.forEach.call(q('mtrSeg').querySelectorAll('button'),function(x){x.classList.toggle('on',x===b);});
      q('mtrSeg').classList.toggle('short',side==='short');upd();});
    q('mtrLev').addEventListener('input',function(){lev=posToLev(+this.value);q('mtrLevV').textContent=lev+'×';upd();});
    q('mtrAmt').addEventListener('input',function(){if(+this.value>100000)this.value=100000;upd();});
    function upd(){var px=price(p.sym)||(p.lastBar&&p.lastBar.close)||0;if(!(px>0))return;
      var amt=+q('mtrAmt').value||0,mmr=0.005;
      var liq=side==='long'?px*(1-(1-mmr)/lev):px*(1+(1-mmr)/lev);
      q('mtrPx').textContent=fp(px);
      q('mtrLiq').textContent=fp(liq)+' ('+((1/lev-mmr)*100).toFixed(2)+'%)';
      q('mtrSz').textContent=fp(amt*lev);
      q('mtrGo').classList.toggle('short',side==='short');}
    upd();
    var updT=setInterval(function(){if(!floatEl||!document.body.contains(floatEl)){clearInterval(updT);return;}if(floatEl.querySelector('#mtrSym'))floatEl.querySelector('#mtrSym').textContent=panes[activeI]?panes[activeI].sym:p.sym;upd();},600);
    q('mtrGo').addEventListener('click',function(){
      var pp=panes[activeI]||p,sym=pp.sym,msg=q('mtrMsg');
      var amt=+q('mtrAmt').value||0;if(amt>100000)amt=100000;
      if(!(amt>0)){msg.style.color='#ff6258';msg.textContent=mcT('mtEnterAmt','Enter an amount.');return;}
      var px=price(sym)||(pp.lastBar&&pp.lastBar.close)||0;
      if(!(px>0)){msg.style.color='#ff6258';msg.textContent='No live price yet — try again.';return;}
      if(window.mpTradeGate&&!window.mpTradeGate(sym,side))return;
      var mmr=0.005,notional=amt*lev,qty=notional/px,liq=side==='long'?px*(1-(1-mmr)/lev):px*(1+(1-mmr)/lev);
      var d;try{d=JSON.parse(localStorage.getItem('mp_journal'))||[];}catch(e){d=[];}
      d.push({id:String(Date.now())+'_'+Math.floor(Math.random()*1e4),ts:Date.now(),sym:sym,side:side,entry:px,stop:null,tp:null,lev:lev,rr:null,qty:qty,notional:notional,margin:amt,riskAmt:amt,liq:liq,mmr:mmr,feeRate:0,status:'open',pnl:null});
      try{localStorage.setItem('mp_journal',JSON.stringify(d));}catch(e){}
      if(window.mpLivePrices)window.mpLivePrices[sym]={p:px,t:Date.now()};
      if(window.mpJournalRender)window.mpJournalRender();
      try{window.mpBuzz&&window.mpBuzz([15]);}catch(e){}
      try{if(window.mpLevWarn)window.mpLevWarn(lev);}catch(e){}
      try{if(window.mpCheckGrad)window.mpCheckGrad();}catch(e){}
      try{if(typeof updMT==='function')updMT();}catch(e){}
      msg.style.color='#2ebd85';msg.textContent=mcT('mtOpened','Position opened ✓')+' — '+sym+' '+side+' '+lev+'× · $'+amt;
      var g=q('mtrGo');g.textContent=mcT('mtOpened','Position opened ✓');
      setTimeout(function(){if(g&&document.body.contains(g))g.textContent=mcT('mtOpen','Open demo trade');},1600);
      panes.forEach(function(px2){if(px2.trades)try{drawTrades(px2);}catch(e){}});
    });
  }
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
    body.addEventListener('click',function(e){var b=e.target.closest('[data-tf]');if(!b)return;p.tf=b.getAttribute('data-tf');clearPaneDraw(p);loadKlines(p);syncBar();closeSheet();mfcSave();});}
  function buildSym(body,p){body.innerHTML='<input class="mfc-ss" placeholder="'+mcT('mtSearchTicker','Search any ticker…')+'" inputmode="search"><div class="mfc-sl" id="mfcSyl"></div>';
    var inp=body.querySelector('.mfc-ss'),list=body.querySelector('#mfcSyl');
    if(window.mpLoadTokens)window.mpLoadTokens(function(){tokens=window.mpTokens||tokens;});
    function render(q){q=String(q||'').toUpperCase().replace(/[^A-Z0-9]/g,'');var arr=q?(window.mpTokens||tokens).filter(function(t){return t.indexOf(q)===0;}).concat((window.mpTokens||tokens).filter(function(t){return t.indexOf(q)>0;})):tokens.slice(0,12);list.innerHTML=arr.slice(0,40).map(function(t){return '<button class="'+(t===p.sym?'on':'')+'" data-pick="'+t+'">'+t+'</button>';}).join('');}
    render('');inp.addEventListener('input',function(){render(this.value);});
    list.addEventListener('click',function(e){var b=e.target.closest('[data-pick]');if(!b)return;p.sym=b.getAttribute('data-pick');clearPaneDraw(p);try{if(window.mpWS)window.mpWS.sub(p.sym);}catch(_){}loadKlines(p);syncBar();closeSheet();mfcSave();});
    setTimeout(function(){inp.focus();},40);}
  function buildInd(body,p){body.innerHTML='<div class="mfc-indm">'+INDS.map(function(d){return '<button class="'+(p.inds[d[0]]?'on':'')+'" data-ind="'+d[0]+'">'+d[1]+'</button>';}).join('')+'</div><p style="color:#9aa3ad;font-size:11.5px;margin-top:12px">'+mcT('mcIndNote','Same indicator families as the desktop workspace. Applies to the selected chart.')+'</p>';
    body.addEventListener('click',function(e){var b=e.target.closest('[data-ind]');if(!b)return;var k=b.getAttribute('data-ind');p.inds[k]=!p.inds[k];b.classList.toggle('on',!!p.inds[k]);applyInds(p);mfcSave();});}
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
  function rotOff(){try{return localStorage.getItem('mp_mfc_rot_off')==='1';}catch(e){return false;}}
  // persist the mobile workspace (split + each pane's sym/tf/indicators) so returning to /charts looks exactly as left
  function mfcSave(){try{localStorage.setItem('mp_mfc_state',JSON.stringify({split:split,active:activeI,panes:panes.map(function(p){return {sym:p.sym,tf:p.tf,inds:p.inds};})}));}catch(e){}}
  function mfcLoad(){try{return JSON.parse(localStorage.getItem('mp_mfc_state')||'null');}catch(e){return null;}}
  function isPortrait(){return !!(window.matchMedia&&window.matchMedia('(orientation:portrait)').matches);}
  function showGate(on){var g=ov&&ov.querySelector('.mfc-gate');if(g)g.hidden=!on;var bar=ov&&ov.querySelector('.mfc-bar'),st=ov&&ov.querySelector('#mfcStage'),fab=ov&&ov.querySelector('.mfc-ai-fab');[bar,st,fab].forEach(function(x){if(x)x.style.visibility=on?'hidden':'';});}
  function open(){ if(!ov)build(); ov.hidden=false; document.documentElement.style.overflow='hidden';
    showGate(false);proceed(); // portrait works too — the inline .mfc-rot hint nudges toward landscape instead of a full-screen wall (UX audit)
  }
  function proceed(){ entered=true; showGate(false);
    if(!panes.length){
      var sv=mfcLoad(),st=ov.querySelector('#mfcStage');
      var cfgs=(sv&&sv.panes&&sv.panes.length)?sv.panes.slice(0,2):[{sym:'BTC',tf:'60'},{sym:'ETH',tf:'60'}]; // default = TWO charts (owner request 2026-07-09), portrait included; saved state wins
      split=cfgs.length>1?2:1;
      cfgs.forEach(function(c){var p=mkPane(c.sym||'BTC',c.tf||'60');if(c.inds)p.inds=c.inds;panes.push(p);st.appendChild(p.el);});
      st.classList.toggle('split',split===2);
      var sL=ov.querySelector('.mfc-splitL');if(sL)sL.textContent=split===2?mcT('mc1chart','1 chart'):mcT('mc2charts','2 charts');
      setActive((sv&&sv.active>0&&sv.active<panes.length)?sv.active:0);
      loadLib(function(){panes.forEach(function(p){initChart(p);});});
    }
    else{panes.forEach(function(p){setTimeout(function(){if(!p.chart)loadLib(function(){initChart(p);});else{loadKlines(p);}},20);});setActive(activeI);}
    setTimeout(function(){panes.forEach(function(p){if(p.w&&p.w.dr&&p.w.dr.redraw)p.w.dr.redraw();});},160);
  }
  var backEl=null,backWait=false,backBrowse=false;
  function showBack(){ if(!backEl){ backEl=document.createElement('div');backEl.className='mfc-back';
      backEl.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M12 3v2M12 19v2"/></svg>'
        +'<h3>'+mcT('mcBackT','Turn your phone upright')+'</h3><p>'+mcT('mcBackS','Charts closed — rotate back to keep browsing.')+'</p>'
        +'<button class="mfc-back-x" type="button">'+mcT('mcBackX','Exit anyway')+'</button>';
      ov.appendChild(backEl);
      backEl.addEventListener('click',function(){finishBack();}); /* the whole dark panel is the exit — no button hunting, zoom-proof */ }
    backEl.hidden=false; var st=ov.querySelector('#mfcStage'),bar=ov.querySelector('.mfc-bar');if(st)st.style.visibility='hidden';if(bar)bar.style.visibility='hidden'; }
  function finishBack(){ backWait=false; if(backEl)backEl.hidden=true;
    var st=ov&&ov.querySelector('#mfcStage'),bar=ov&&ov.querySelector('.mfc-bar');if(st)st.style.visibility='';if(bar)bar.style.visibility='';
    reallyClose();
    if(backBrowse){backBrowse=false;forceScale1(function(){try{if(window.__openBrowse)window.__openBrowse();}catch(e){}});} /* open Browse only after the zoom is verified back at 1:1 (or the retry window ends) */ }
  function reallyClose(){ if(!ov)return; ov.hidden=true; document.documentElement.style.overflow=''; closeSheet(); closeFloat(); resetViewportHard(); setTimeout(pinBar,80); }
  function close(){ if(!ov)return;
    if(!isPortrait()){ /* closing in LANDSCAPE used to dump the user on an 844px-wide page → the DESKTOP homepage flashed and iOS kept a ~25% zoom. Hold a dark "rotate back" panel instead; portrait finishes the close and opens Browse. */
      backWait=true; backBrowse=true; closeSheet(); closeFloat(); showBack(); return; }
    reallyClose();
  }
  window.mpOpenCharts=open;
  // live ticks
  document.addEventListener('mp:price',function(ev){if(!ov||ov.hidden||!ev.detail)return;panes.forEach(function(p){if(p.sym===ev.detail.sym)live(p);});});
  setInterval(function(){if(!ov||ov.hidden)return;panes.forEach(function(p){
    if(!p.candle)return;
    // (1) re-assert autoScale ONLY at the realtime edge — a locked/drifted price scale (e.g. the user dragged the
    //     price axis) makes the chart LOOK frozen even though live() keeps updating; heal it in ~2s like desktop.
    try{var vr=p.chart.timeScale().getVisibleLogicalRange();if(!vr||!p.bars||!p.bars.length||vr.to>=p.bars.length-2)p.chart.priceScale('right').applyOptions({autoScale:true});}catch(e){}
    // (2) newest bar >1.5 intervals behind now → new bars stopped forming; force a klines re-sync (independent of price freshness)
    try{if(p.lastBar){var _iv=parseInt(p.tf,10)*60,_nb=Math.floor(Date.now()/1000/_iv)*_iv;if(_nb-p.lastBar.time>_iv*1.5&&(!p._gapT||Date.now()-p._gapT>10000)){p._gapT=Date.now();loadKlines(p);return;}}}catch(e){}
    // liveness: if the WS hasn't ticked this symbol for >8s, pull a REST price so the pane can NEVER freeze on a stale value
    var lp=window.mpLivePrices&&window.mpLivePrices[p.sym];
    if(!lp||!lp.t||Date.now()-lp.t>8000){ try{if(window.mpWS)window.mpWS.sub(p.sym);}catch(e){}
      if(!p._rf||Date.now()-p._rf>8000){ p._rf=Date.now();
        fetch('/api/price?symbol='+encodeURIComponent(p.sym),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){var px=j&&+j.price;if(px>0&&window.mpLivePrices){window.mpLivePrices[p.sym]={p:px,t:Date.now(),chg:(j.chg!=null?+j.chg:(lp&&lp.chg))};}live(p);});
      } return; }
    live(p);});},2000);
  // returning to the tab: the 60s reload gate only fires from live ticks, so force a real klines re-sync immediately
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&ov&&!ov.hidden)panes.forEach(function(p){if(p.candle)loadKlines(p);});});
  window.addEventListener('pageshow',function(e){if(e&&e.persisted&&ov&&!ov.hidden)panes.forEach(function(p){if(p.candle)loadKlines(p);});}); // iOS bfcache restore doesn't reliably fire visibilitychange
  // Browse "Charts" → open full-screen on mobile (intercept before navigation)
  document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-mcharts]');if(!t)return;if(isMob()){e.preventDefault();e.stopPropagation();open();}},true);
  // landing on /charts on a phone → open the full-screen experience automatically
  if(isMob()&&/^\/charts\/?$/.test(location.pathname)){window.addEventListener('load',function(){setTimeout(open,250);});}
})();
