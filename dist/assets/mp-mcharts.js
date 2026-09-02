/* ONE journal writer, shared by every bundle (first one to load defines it). localStorage is ~5MB per origin and
   every jstore() used to be a bare setItem in a try/catch that SWALLOWED QuotaExceededError - past the limit a
   trader's closes silently stopped being saved, with no error and no sign. Nothing is dropped preemptively: we
   only shed when the device genuinely has no room, we shed the OLDEST CLOSED trades and never an open position,
   and we say so once instead of failing quietly. */
window.mpJStore=window.mpJStore||function(a){
  try{localStorage.setItem('mp_journal',JSON.stringify(a));return true;}catch(e){}
  try{
    var arr=Array.isArray(a)?a:[];
    var op=[],cl=[],i;
    for(i=0;i<arr.length;i++){var x=arr[i];if(!x)continue;(x.status==='win'||x.status==='loss')?cl.push(x):op.push(x);}
    cl.sort(function(p,q){return ((+p.closeTs||+p.ts||0)-(+q.closeTs||+q.ts||0));}); /* oldest first */
    var keep=cl.length;
    while(keep>0){
      keep=Math.floor(keep*0.7);
      try{
        localStorage.setItem('mp_journal',JSON.stringify(op.concat(cl.slice(cl.length-keep))));
        if(!window.__mpQuotaSaid){window.__mpQuotaSaid=1;try{if(window.mpLimitToast)window.mpLimitToast('This device ran out of storage, so the oldest closed trades were removed from it. Open positions and your stats are safe - your stats live on your account, not on this device.');}catch(_){}}
        return true;
      }catch(e2){}
    }
    try{localStorage.setItem('mp_journal',JSON.stringify(op));return true;}catch(e3){}
  }catch(e4){}
  return false;
};
/* Chart times render in the VIEWER'S timezone. lightweight-charts formats the axis and crosshair in UTC,
   so without this every visitor outside UTC saw a chart clock that disagreed with their own device — the
   long-standing "chart is bugging" report (Belgrade device 17:56 vs axis 15:56, measured 2026-08-17).
   DISPLAY ONLY: bar timestamps stay UTC, so bucketing, close countdowns, WS merging and liq checks are
   unaffected. Shifting the data instead would corrupt every one of those. */
function mpTzMerge(o){
  var p=function(n){return n<10?'0'+n:''+n;};
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var D=function(t){if(t&&typeof t==='object'&&t.year)return new Date(t.year,(t.month||1)-1,t.day||1);return new Date((+t||0)*1000);};
  var hm=function(d){return p(d.getHours())+':'+p(d.getMinutes());};
  o=o||{};
  if(!o.localization)o.localization={};
  if(!o.localization.timeFormatter)o.localization.timeFormatter=function(t){var d=D(t);return p(d.getDate())+' '+MON[d.getMonth()]+'  '+hm(d);};
  if(!o.timeScale)o.timeScale={};
  if(!o.timeScale.tickMarkFormatter)o.timeScale.tickMarkFormatter=function(t,type){var d=D(t);
    if(type===0)return String(d.getFullYear());
    if(type===1)return MON[d.getMonth()];
    if(type===2)return String(d.getDate());
    if(type===4)return hm(d)+':'+p(d.getSeconds());
    return hm(d);};
  return o;
}
function mpCreateChart(host,opts){return LightweightCharts.createChart(host,mpTzMerge(opts));}
window.__mpWsSeen=window.__mpWsSeen||{};window.__mpPQ=window.__mpPQ||function(ctx,sym){try{var t=window.__mpWsSeen[sym];return '&px='+ctx+'&pxw='+((t&&Date.now()-t<15000)?1:0);}catch(e){return '';}};if(!window.__mpWsL){window.__mpWsL=1;try{document.addEventListener('mp:price',function(ev){if(ev&&ev.detail&&ev.detail.sym)window.__mpWsSeen[ev.detail.sym]=Date.now();});}catch(e){}} /* TEMP pxtag until 2026-09-01 — DELETE with the pxtag round */
/* Mobile full-screen Charts — landscape-first 1/2-pane workspace: same indicator families as desktop, drawing, trade import, an AI chat bubble and a quick liq calculator. Exposed as window.mpOpenCharts(). */
(function(){
  var ov=null,panes=[],activeI=0,split=1,drawOn=false,forcePair=null,tokens=['BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK'];
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
  function sanitizeBars(kd){if(!kd||!kd.length)return kd;var _ok=[];for(var _j=0;_j<kd.length;_j++){var _q=kd[_j];if(!_q)continue;var _t=+_q.time,_o=+_q.open,_h=+_q.high,_l=+_q.low,_c=+_q.close;if(!(_t>0&&_o>0&&_h>0&&_l>0&&_c>0&&isFinite(_t)&&isFinite(_o)&&isFinite(_h)&&isFinite(_l)&&isFinite(_c)))continue;_q.open=_o;_q.high=Math.max(_o,_h,_l,_c);_q.low=Math.min(_o,_h,_l,_c);_q.close=_c;_ok.push(_q);}kd=_ok;/* drop null/NaN bars — they poison the chart's render loop ("Value is null" crash) */if(kd.length<2)return kd;var TH=0.035;for(var i=0;i<kd.length;i++){var b=kd[i];if(!b)continue;var o=+b.open,c=+b.close;if(!(o>0&&c>0))continue;var bodyLo=Math.min(o,c),bodyHi=Math.max(o,c);var pl=i>0?+kd[i-1].low:bodyLo,nl=i<kd.length-1?+kd[i+1].low:bodyLo;var ph=i>0?+kd[i-1].high:bodyHi,nh=i<kd.length-1?+kd[i+1].high:bodyHi;var refLo=Math.min(bodyLo,pl||bodyLo,nl||bodyLo);if(+b.low>0&&+b.low<refLo*(1-TH))b.low=refLo*(1-TH);var refHi=Math.max(bodyHi,ph||bodyHi,nh||bodyHi);if(+b.high>refHi*(1+TH))b.high=refHi*(1+TH);}return kd;}
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
  var INDS=[['sig','Buy / Sell signals'],['sr','Support / Resistance'],['ema9','EMA 9'],['ema21','EMA 21'],['ema50','EMA 50'],['ema100','EMA 100'],['ema200','EMA 200'],['sma20','SMA 20'],['sma50','SMA 50'],['sma100','SMA 100'],['sma200','SMA 200'],['hma','Hull MA 21'],['vwap','VWAP'],['bb','Bollinger'],['vol','Volume'],['rsi','RSI'],['macd','MACD'],['stoch','Stoch'],['atr','ATR'],['wr','Williams %R'],['cci','CCI'],['mom','Momentum shift (MACD+RSI)'],['sqz','Squeeze breakout'],['liqr','Liquidation reversal'],['casc','Cascade Radar'],['brain','Market Brain (adaptive AI)'],['memory','Market Memory (AI forecast)'],['magnet','Liquidation Magnet'],['sentf','Sentiment Flip']];
  function mSig(){return window.__mpSig||null;}
  function mEx(k){var S=mSig();return !!(S&&S.MP_INDS&&S.MP_INDS[k]);}
  function mAllowed(){var S=mSig();return !!(S&&S.indAllowed&&S.indAllowed());}
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
    el.innerHTML='<div class="mfc-chart"></div><div class="mfc-sub"></div><canvas class="cwin-draw"></canvas>'+TOOLS()+'<div class="mfc-pl"><b class="mfc-pl-s"></b> <span class="mfc-pl-tf"></span> <span class="mfc-pl-cd"></span> <span class="mfc-pl-p"></span></div><div class="cwin-leg"></div>';
    var p={el:el,host:el.querySelector('.mfc-chart'),sym:sym,tf:tf,bars:[],lastBar:null,chart:null,candle:null,inds:{},indSeries:[],indLines:[],tradeLines:[],_mtPrices:[],reload:0,w:null};
    el.addEventListener('pointerdown',function(){setActive(panes.indexOf(p));},true);
    return p;
  }
  function initChart(p){ if(p.chart||!window.LightweightCharts||!p.host.clientWidth){return;}
    p.chart=mpCreateChart(p.host,{layout:{background:{color:'transparent'},textColor:'#9aa3ad',fontFamily:"'Familjen Grotesk',system-ui,sans-serif",attributionLogo:false},grid:{vertLines:{color:'rgba(35,41,50,.35)'},horzLines:{color:'rgba(35,41,50,.35)'}},rightPriceScale:{borderColor:'#232932'},timeScale:{borderColor:'#232932',timeVisible:true,secondsVisible:false,rightOffset:5,barSpacing:6},crosshair:{mode:0},autoSize:true});
    try{p.chart.subscribeCrosshairMove(function(param){mLeg(p,param);});}catch(e){}
    try{p.chart.timeScale().subscribeVisibleLogicalRangeChange(function(r){if(r&&r.from<12)loadMoreM(p);});}catch(e){} // scrolled near the start → page older history (mirror desktop loadMoreW). Per-pane: closes over THIS p.
    /* FREE PAN (owner 2026-08-13): vertical pane drag -> manual price scale (pan up/down freely); axis drag remembered; p._userPS gates every periodic autoScale re-assert; a fresh symbol/TF load (loadKlines) or price-axis double-tap re-arms autofit. */
    (function(pp){var st={d:0};pp.host.addEventListener('pointerdown',function(e){var r=pp.host.getBoundingClientRect();st.d=1;st.x=e.clientX;st.y=e.clientY;st.ax=(e.clientX>r.right-56);st.dec=0;},true);pp.host.addEventListener('pointermove',function(e){if(!st.d||st.dec)return;var dx=Math.abs(e.clientX-st.x),dy=Math.abs(e.clientY-st.y);if(dx<5&&dy<5)return;st.dec=1;if(st.ax){pp._userPS=true;return;}if(dy>dx){pp._userPS=true;try{pp.chart.priceScale('right').applyOptions({autoScale:false});}catch(_){}}},true);window.addEventListener('pointerup',function(){st.d=0;},true);pp.host.addEventListener('dblclick',function(e){var r=pp.host.getBoundingClientRect();if(e.clientX>r.right-56){pp._userPS=false;try{pp.chart.priceScale('right').applyOptions({autoScale:true});}catch(_){}}});})(p);
    p.chart.timeScale().subscribeVisibleLogicalRangeChange(function(r){if(!r||!p.sub||p._subSync)return;p._subSync=1;try{p.sub.timeScale().setVisibleLogicalRange(r);}catch(_){}p._subSync=0;}); /* oscillator sub-pane follows the main time axis */
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
  // klines fetch is split into two JOBS so the CALLER picks intent, never a bool it passes in (the loadData/chartSync
  // "one function, two jobs, caller decides" shape is exactly what broke twice). loadKlines = user/initial (symbol/TF
  // change, first load, re-open) → apply THEN jump to the live edge. resyncKlines = background re-sync (60s reload,
  // gap, tab-return) → a scroll-back GUARD lives INSIDE it (can't be bypassed) and it NEVER scrolls. _applyKlines is the
  // shared core and NEVER touches the time position (safe default); the edge-jump exists ONLY in loadKlines.
  function _applyKlines(p){ if(!p.candle)return Promise.resolve(false);var sym=p.sym,tf=p.tf;p.reload=Date.now();var _q=p._kq=(p._kq||0)+1;/* request ticket (2026-09-02): only the newest full-window request for this pane may apply */
    return fetch('/api/klines?symbol='+encodeURIComponent(sym)+'&interval='+tf,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){
      if(p.dead||sym!==p.sym||tf!==p.tf||!p.candle||_q!==p._kq)return false;
      var ok=false;
      if(kd&&kd.length){kd=sanitizeBars(kd);p.bars=kd;p._hole=0;p._noMore=false;p._mpg=0;p._lm=false;/* fresh full load (initial/sym/TF/edge-resync) replaces bars → restart history pagination for this pane */p.lastBar=kd[kd.length-1];p._lgp=+p.lastBar.close||0;p._rej=0;try{p.candle.setData(kd);var _lp=Math.abs(+p.lastBar.close)||0,_pc=(_lp>=1000?2:_lp>=100?3:_lp>=10?3:_lp>=1?4:_lp>=0.1?4:_lp>=0.01?5:_lp>=0.001?6:_lp>=0.0001?7:_lp>=0.00001?8:9);p.candle.applyOptions({priceFormat:{type:'price',precision:_pc,minMove:Math.pow(10,-_pc)}});if(!p._userPS)p.chart.priceScale('right').applyOptions({autoScale:true});}catch(e){}applyInds(p);if(p.trades)drawTrades(p);/* ~5 sig figs — mobile had NO precision set (LWC default 2dp hid XRP 1.0904) */try{if(p.w){p.w.sym=p.sym;p.w.tf=p.tf;p.w.bars=p.bars;if(p.w.dr&&p.w.dr.reload)p.w.dr.reload();}}catch(e){}ok=true;}
      label(p);
      return ok;
    });
  }
  function loadKlines(p){ if(!p.candle)return;p._userPS=false;_applyKlines(p).then(function(ok){if(ok&&!p.dead&&p.candle)try{var _vn=(p.bars&&p.bars.length)||0;if(_vn>0)p.chart.timeScale().setVisibleLogicalRange({from:Math.max(0,_vn-120),to:_vn+6});else p.chart.timeScale().scrollToRealTime();}catch(e){}}); } // user/initial: pin the last ~120 bars (was scrollToRealTime, which kept barSpacing → deep-history dataset squished/sparse)
  function resyncKlines(p){ if(!p.candle)return; // background re-sync — mirror of desktop refreshData: bail if the user scrolled into history so we never yank them back to the edge (guard is INSIDE, un-bypassable); never scrolls
    try{var vr=p.chart.timeScale().getVisibleLogicalRange();if(vr&&p.bars&&p.bars.length&&vr.to<p.bars.length-3)return;}catch(e){}
    /* WINDOW-ALIGNED diff (2026-08-12, owner: a closed candle must never visibly change): the old path called
       _applyKlines = unconditional setData every 60s → a full repaint each minute. Now identical bars paint
       NOTHING, new trailing bars are appended via update(), our live forming bar is never regressed to the
       edge-cached snapshot, and setData remains only for a truly-different CLOSED bar. _applyKlines stays the
       initial/symbol-change loader (full setData is correct there). */
    var sym=p.sym,tf=p.tf;p.reload=Date.now();var _q=p._kq=(p._kq||0)+1;
    fetch('/api/klines?symbol='+encodeURIComponent(sym)+'&interval='+tf,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){
      if(p.dead||sym!==p.sym||tf!==p.tf||!p.candle||_q!==p._kq)return;
      if(!kd||!kd.length){label(p);return;}
      kd=sanitizeBars(kd);
      var _rm=0,_app=[],_mism=false;
      if(!p.bars||p.bars.length<3||kd.length<2){_rm=2;p.bars=kd;}
      else{
        var _lastA=p.bars[p.bars.length-1],_lastK=kd[kd.length-1],_tmap={};
        for(var _i2=0;_i2<p.bars.length;_i2++)_tmap[p.bars[_i2].time]=p.bars[_i2];
        /* tick estimate from the data itself (max decimals over the last ~40 bars): the open tolerance below must be
           TICK-relative, not only %-relative — one HYPE tick ($0.01 at $57 = 0.0175%) blew past the 0.005% gate and
           forced a visible full-repaint heal every resync after a roll (probe 2026-08-15), while one BTC tick is 0.00016%. */
        var _tkD=0;for(var _t5=Math.max(0,kd.length-40);_t5<kd.length;_t5++){var _b5=kd[_t5],_v5=[_b5.open,_b5.high,_b5.low,_b5.close];for(var _t6=0;_t6<4;_t6++){var _s5=String(_v5[_t6]),_e5=_s5.indexOf('e-'),_d5=0;if(_e5>=0){_d5=(+_s5.slice(_e5+2)||0)+(((_s5.slice(0,_e5).split('.')[1])||'').length);}else{var _p5=_s5.indexOf('.');_d5=_p5<0?0:_s5.length-_p5-1;}if(_d5>_tkD)_tkD=_d5;}}
        var _otol=function(o){var a=Math.abs(o);return Math.max(a*5e-5,Math.min(Math.pow(10,-_tkD)*1.6,a*0.001));};/* allow 1 tick (not 2+), hard-capped at 0.1% so a degenerate decimals estimate can't mask a real divergence */
        for(var _k2=0;_k2<kd.length;_k2++){var _b=kd[_k2];
          if(_b.time>_lastA.time){_app.push(_b);continue;}
          /* the snapshot's LAST bar = the server's (possibly stale-cached, PARTIAL) forming bar — never an
             authority for a minute we already closed from the live trade stream (measured flip-flop source) */
          if(_k2===kd.length-1&&_b.time<=_lastA.time)continue;
          var _a2=_tmap[_b.time];
          if(!_a2){if(_b.time>=p.bars[0].time){_mism=true;break;}continue;}
          if(Math.abs(_a2.open-_b.open)>_otol(_b.open)||_a2.high!==_b.high||_a2.low!==_b.low||_a2.close!==_b.close){_mism=true;break;}}/* open tolerates max(0.005%, 1 tick): Bybit's kline open can differ one tick from the public trade stream (internal matching the feed doesn't carry) — strict equality forced an invisible 'heal' repaint every minute, and a %-only gate re-broke it on low-priced symbols (HYPE). h/l/c stay strictly exact; a REAL open divergence (>=2 ticks and >0.005%) still heals. */
        if(_mism){_rm=2;p.bars=kd;if(_lastK.time===_lastA.time)p.bars[p.bars.length-1]=_lastA;else if(_lastA.time>_lastK.time){if(_tmap[_lastK.time])p.bars[p.bars.length-1]=_tmap[_lastK.time];p.bars.push(_lastA);}}/* heal history but keep our fresher forming bar AND our trade-finalized copy of the minute the lagging snapshot still shows as partial */
        else if(_app.length){_rm=1;p.bars=p.bars.concat(_app);}
      }
      if(_rm===2){try{p.candle.setData(p.bars);}catch(e){}}
      else if(_rm===1){for(var _a3=0;_a3<_app.length;_a3++){try{p.candle.update(_app[_a3]);}catch(e){}}}
      if(_rm!==0){p.lastBar=p.bars[p.bars.length-1];p._lgp=+p.lastBar.close||0;p._rej=0;try{applyInds(p);}catch(e){}if(p.trades)try{drawTrades(p);}catch(e){}try{if(p.w)p.w.bars=p.bars;}catch(e){}}
      p._hole=0;/* cleared ONLY on a successful snapshot apply/compare — a rolled live bar makes lastBar look current, blinding the interval gap check (same _holeK lesson as desktop) */
      label(p);
    }); }
  // load older history when the pane is scrolled back toward the start (full history to the coin's inception) — per-pane, mirror of desktop loadMoreW incl. the vr0+shift that keeps the view exactly where the user is (prepending resets setData to the edge otherwise = another way to yank them)
  function loadMoreM(p){ if(!p.candle||p._lm||p._noMore||!p.bars||!p.bars.length)return;
    var sym=p.sym,tf=p.tf,end=p.bars[0].time*1000-1; p._lm=true;
    var _lmg=setTimeout(function(){p._lm=false;},12000); // a hung fetch must not pin p._lm forever (that would also disable the 60s resync)
    fetch('/api/klines?symbol='+encodeURIComponent(sym)+'&interval='+tf+'&end='+end,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){
      clearTimeout(_lmg); p._lm=false; if(p.dead||sym!==p.sym||tf!==p.tf||!p.candle)return;
      if(!kd||!kd.length){p._noMore=true;return;} // empty page → the deepest source ran out
      var first=p.bars[0].time,older=sanitizeBars(kd.filter(function(b){return b.time<first;}));
      if(!older.length){p._noMore=true;return;} // oldest bar didn't move back = source can't go deeper (real test, not "returned few")
      p._mpg=(p._mpg||0)+1; if(p._mpg>=30)p._noMore=true; // hard cap ~30 pages/(sym+TF): anti-infinite backstop for thin pairs / history gaps
      var shift=older.length; p.bars=older.concat(p.bars);
      var vr0=null;try{vr0=p.chart.timeScale().getVisibleLogicalRange();}catch(e){}
      try{p.candle.setData(p.bars);}catch(e){}
      if(vr0)try{p.chart.timeScale().setVisibleLogicalRange({from:vr0.from+shift,to:vr0.to+shift});}catch(e){} // keep the user exactly where they were scrolled
      try{if(p.w){p.w.bars=p.bars;if(p.w.dr&&p.w.dr.shapes&&p.w.dr.shapes.length){p.w.dr.shapes.forEach(function(s){if(s.l!=null)s.l+=shift;if(s.l1!=null)s.l1+=shift;if(s.l2!=null)s.l2+=shift;if(s.pts)s.pts.forEach(function(pt){if(pt.l!=null)pt.l+=shift;});});if(p.w.dr.redraw)p.w.dr.redraw();}}}catch(e){} // anchor drawings after older bars prepended (logical indices shift by `shift`)
      try{applyInds(p);}catch(e){}
      if(p.trades)drawTrades(p);
    });
  }
  function live(p){if(!p.candle)return;
    if(Date.now()-p.reload>(p.lastBar?60000:5000)){(p.lastBar?resyncKlines:loadKlines)(p);return;} // cold-start self-heal: FIRST fetch failed (lastBar null) → loadKlines (initial, jump to edge), retry every 5s instead of a permanently blank chart; warm 60s re-sync → resyncKlines (guarded, never yanks a scrolled-back user). checked BEFORE the pr>0 bail so a stalled feed still refetches
    if(!p.lastBar)return;
    /* HOLE GUARD (Safari suspend/resume, 2026-08-15 owner screenshots): newest bar >1.5 intervals behind → mark the
       hole + force a re-sync NOW; a HUGE gap (>30 bars, e.g. a 2h-suspended tab) must NOT roll a detached forming
       candle onto 2h-old history — wait for the real bars. Modest gap still falls through so the chart keeps moving.
       Runs BEFORE the pr>0 bail (a stalled feed must still refetch). */
    try{var _ivH=parseInt(p.tf,10)*60,_nbH=Math.floor((window.mpSrvNow?window.mpSrvNow():Date.now())/1000/_ivH)*_ivH;
      if(_nbH-p.lastBar.time>_ivH*1.5){p._hole=1;if(!p._gapT||Date.now()-p._gapT>8000){p._gapT=Date.now();resyncKlines(p);}if(_nbH-p.lastBar.time>_ivH*30)return;}}catch(e){}
    var pr=price(p.sym);if(!(pr>0))return;
    // spike filter (same as the desktop/paper-trade/heatmap engines): reject a lone tick that jumps >2.5% from the last
    // accepted price — one bad print would otherwise blow out the forming candle's high/low and compress every other candle
    // (the "candles lose their shape / half candle over time" bug). Accept only if 3 in a row confirm a real move.
    if(p._lgp>0){ if(Math.abs(pr-p._lgp)/p._lgp>0.025){ p._rej=(p._rej||0)+1; if(p._rej<3)return; } else { p._rej=0; } }
    p._lgp=pr;
    var _msn=window.mpSrvNow?window.mpSrvNow():Date.now();
    var iv=parseInt(p.tf,10)*60,nb=Math.floor(_msn/1000/iv)*iv; // server-clock bucketing (skewed device clocks rolled bars at wrong boundaries)
    /* ROLL GRACE: hold the roll until the first NEW-minute trade arrives (time-ordered stream → old minute
       complete) or 2s pass — a boundary-crossing ticker event must not finalize an incomplete bucket (clipped body) */
    var _grace=false;
    if(nb>p.lastBar.time){try{var _TKg=window.mpTicks1m&&window.mpTicks1m[p.sym];if(_TKg&&_TKg.cur&&_TKg.cur.t<nb&&(_msn/1000-nb)<2)_grace=true;}catch(_){}}
    if(nb>p.lastBar.time&&!_grace){
      /* FINALIZE the closing bar from exchange-stamped trade buckets BEFORE rolling — the closed candle becomes
         exactly the authoritative kline and never changes again (1m: full OHLC; >1m: final-minute close + extremes). */
      try{var _TKz=window.mpTicks1m&&window.mpTicks1m[p.sym];if(_TKz){var _zbs=[_TKz.cur,_TKz.prev],_zch=false;
        for(var _zi=0;_zi<2;_zi++){var _zb=_zbs[_zi];if(!_zb)continue;if(_zb.t<p.lastBar.time||_zb.t>=p.lastBar.time+iv)continue;
          if(iv===60){if(p.lastBar.high!==_zb.h||p.lastBar.low!==_zb.l||p.lastBar.close!==_zb.c){p.lastBar.high=_zb.h;p.lastBar.low=_zb.l;p.lastBar.close=_zb.c;_zch=true;}}/* h/l/c from the stream; open is NOT the bucket's first trade — Bybit kline open = prevClose EXACTLY (measured 0/998 gaps, 2026-08-15), so the roll-set open already matches the authority */
          else{if(_zb.h>p.lastBar.high){p.lastBar.high=_zb.h;_zch=true;}if(_zb.l<p.lastBar.low){p.lastBar.low=_zb.l;_zch=true;}if(_zb.t===p.lastBar.time+iv-60&&p.lastBar.close!==_zb.c){p.lastBar.close=_zb.c;_zch=true;}}}
        if(_zch){if(p.lastBar.high<Math.max(p.lastBar.open,p.lastBar.close))p.lastBar.high=Math.max(p.lastBar.open,p.lastBar.close);if(p.lastBar.low>Math.min(p.lastBar.open,p.lastBar.close))p.lastBar.low=Math.min(p.lastBar.open,p.lastBar.close);try{p.candle.update(p.lastBar);}catch(_){}}
      }}catch(_){}
      try{if(p.bars&&p.bars.length){if(p.bars[p.bars.length-1].time===p.lastBar.time)p.bars[p.bars.length-1]=p.lastBar;else if(p.lastBar.time>p.bars[p.bars.length-1].time)p.bars.push(p.lastBar);}}catch(_){}
      var _znb=null;try{var _TKo=window.mpTicks1m&&window.mpTicks1m[p.sym];if(_TKo&&_TKo.cur&&_TKo.cur.t===nb)_znb=_TKo.cur;}catch(_){}
      if(_znb){var _zop=p.lastBar.close;p.lastBar={time:nb,open:_zop,high:Math.max(_znb.h,_zop),low:Math.min(_znb.l,_zop),close:_znb.c};p._lgp=_znb.c;}/* open = prevClose ALWAYS (Bybit kline convention — measured 0/998 open!=prevClose gaps, 2026-08-15; the old first-trade open drew phantom gaps between candles); extremes/close stay trade-exact and must contain the open */
      else{p.lastBar={time:nb,open:p.lastBar.close,high:Math.max(p.lastBar.close,pr),low:Math.min(p.lastBar.close,pr),close:pr};}
      try{if(p.bars&&p.bars.length&&p.lastBar.time>p.bars[p.bars.length-1].time)p.bars.push(p.lastBar);}catch(_){}
      try{if(!p._userPS)p.chart.priceScale('right').applyOptions({autoScale:true});}catch(e){}}
    else{if(!_grace){p.lastBar.close=pr;if(pr>p.lastBar.high)p.lastBar.high=pr;if(pr<p.lastBar.low)p.lastBar.low=pr;}/* during the roll grace pr may already be a NEW-minute price — never bake it into the closing bar */
      try{var _TKm=window.mpTicks1m&&window.mpTicks1m[p.sym];if(_TKm&&p._lgp>0){var _mm=[_TKm.cur,_TKm.prev];for(var _mi9=0;_mi9<2;_mi9++){var _mk=_mm[_mi9];if(!_mk)continue;if(_mk.t<p.lastBar.time||_mk.t>=p.lastBar.time+iv)continue;/* NO retro-open: Bybit kline open = prevClose (measured), the first trade is NOT the open — adopting it drew a phantom gap between candles */if(_mk.h>p.lastBar.high&&_mk.h<p._lgp*1.025)p.lastBar.high=_mk.h;if(_mk.l<p.lastBar.low&&_mk.l>p._lgp*0.975)p.lastBar.low=_mk.l;}}}catch(_){} /* exact trade-stream extremes (exchange-stamped) → wicks match the authoritative kline */}
    try{p.candle.update(p.lastBar);}catch(e){}label(p);
  }
  function label(p){var s=p.el.querySelector('.mfc-pl-s'),t=p.el.querySelector('.mfc-pl-tf'),pe=p.el.querySelector('.mfc-pl-p'),pr=price(p.sym)||(p.lastBar&&p.lastBar.close);if(s)s.textContent=p.sym;if(t)t.textContent=tfLabel(p.tf);if(pe&&pr)pe.textContent=fp(pr);}
  // ---- indicator value legend (owner request: RSI etc. must SHOW their number) ----
  function legFmt(v,dec){if(v==null||!isFinite(v))return '\u2014';if(dec===0)return String(Math.round(v));if(dec!=null)return (+v).toFixed(dec);var a=Math.abs(v);return a>=1000?(+v).toLocaleString('en-US',{maximumFractionDigits:2}):a>=1?(+v).toFixed(3):(+v).toFixed(6);}
  function _mLegHidden(){try{var v=localStorage.getItem('mp:leghide');return v==null?true:v==='1';}catch(e){return true;}} /* mobile defaults to a clean chart - values one tap away */
  function mLeg(p,param){var el=p.el.querySelector('.cwin-leg');if(!el)return;
    if(!p.legItems||!p.legItems.length){el.style.display='none';el.innerHTML='';return;}
    el.style.display='';
    if(!el._tgw){el._tgw=1;el.addEventListener('click',function(e){var t=e.target.closest('[data-legtg]');if(!t)return;try{localStorage.setItem('mp:leghide',_mLegHidden()?'0':'1');}catch(_){}panes.forEach(function(x){try{mLeg(x);}catch(_){}});});}
    var _tg='<span data-legtg style="cursor:pointer;color:#5c656f;border:1px solid #2a3140;border-radius:7px;padding:1px 8px;font-size:10px;font-weight:700;letter-spacing:.06em">'+(_mLegHidden()?'VALUES':'HIDE')+'</span>';
    if(_mLegHidden()){el.innerHTML=_tg;return;}
    el.innerHTML=_tg+p.legItems.map(function(it){var v=it.last;
      if(param&&param.seriesData){var sd=param.seriesData.get(it.series);if(sd!=null)v=(typeof sd==='object'?(sd.value!=null?sd.value:sd.close):sd);else if(param.time!=null&&it.arr){var lo=0,hi=it.arr.length-1;while(lo<hi){var mid=(lo+hi+1)>>1;if(it.arr[mid].time<=param.time)lo=mid;else hi=mid-1;}if(it.arr[lo]&&it.arr[lo].time===param.time&&isFinite(it.arr[lo].value))v=it.arr[lo].value;}}
      return it.raw?'<span style="color:'+it.color+';font-weight:700">'+it.label+'</span>':'<span style="color:'+it.color+'">'+it.label+' <b>'+legFmt(v,it.dec)+'</b></span>';}).join('');}
  // ---- indicators ----
  /* OSCILLATOR SUB-PANE (owner 2026-08-13, mirror of desktop mp-charts): oscillators render in their OWN synced
     chart strip below the candles - free vertical pan can never slide candles through them. */
  function ensureSubM(p,on){var el=p.el;if(!el)return null;var sh=el.querySelector('.mfc-sub'),dc=el.querySelector('canvas.cwin-draw'),host=p.host;
    if(!on){if(p.sub){try{p.sub.remove();}catch(e){}p.sub=null;}p.subSeries=[];if(sh){sh.style.display='none';sh.style.height='0px';}if(host)host.style.bottom='0px';if(dc)dc.style.bottom='0px';return null;}
    var _eh=el.clientHeight||300,_sv=0;try{_sv=parseInt(localStorage.getItem('mp:subhm'))||0;}catch(e){}
    var H=Math.max(56,Math.min(Math.round(_eh*0.55),_sv||Math.max(70,Math.min(150,Math.round(_eh*0.26)))));
    if(sh){sh.style.display='block';sh.style.height=H+'px';}if(host)host.style.bottom=H+'px';if(dc)dc.style.bottom=H+'px';
    if(sh&&!sh.querySelector('.mfc-subrz')){var rz=document.createElement('div');rz.className='mfc-subrz';sh.appendChild(rz);
      (function(){var dr={on:false};rz.addEventListener('pointerdown',function(e){dr.on=true;try{rz.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();e.stopPropagation();},true);
      rz.addEventListener('pointermove',function(e){if(!dr.on)return;var br=el.getBoundingClientRect();var nh=Math.max(56,Math.min(Math.round(br.height*0.55),Math.round(br.bottom-e.clientY)));sh.style.height=nh+'px';if(host)host.style.bottom=nh+'px';if(dc)dc.style.bottom=nh+'px';e.preventDefault();},true);
      rz.addEventListener('pointerup',function(){if(!dr.on)return;dr.on=false;try{localStorage.setItem('mp:subhm',String(parseInt(sh.style.height)||0));}catch(_){}},true);})();}
    if(!p.sub&&window.LightweightCharts&&sh){try{p.sub=mpCreateChart(sh,{layout:{background:{color:'transparent'},textColor:'#8b95a1',fontFamily:"'Familjen Grotesk',system-ui,sans-serif",attributionLogo:false},grid:{vertLines:{color:'rgba(35,41,50,.22)'},horzLines:{color:'rgba(35,41,50,.22)'}},rightPriceScale:{borderColor:'#232932'},timeScale:{visible:false},crosshair:{mode:0},autoSize:true,handleScale:{axisPressedMouseMove:{time:false,price:false},mouseWheel:false,pinch:false},handleScroll:{pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false,mouseWheel:false}});
      p.sub.timeScale().subscribeVisibleLogicalRangeChange(function(r){if(!r||!p.chart||p._subSync)return;p._subSync=1;try{p.chart.timeScale().setVisibleLogicalRange(r);}catch(_){}p._subSync=0;});
      try{p.sub.subscribeCrosshairMove(function(prm){mLeg(p,prm);});}catch(e){} /* touch-scrub over the indicator strip drives the value legend */
      try{var _r0=p.chart.timeScale().getVisibleLogicalRange();if(_r0)p.sub.timeScale().setVisibleLogicalRange(_r0);}catch(e){}}catch(e){p.sub=null;}}
    return p.sub;}
  function applyInds(p){ if(!p.chart||!p.candle)return;
    p.indSeries.forEach(function(s){try{p.chart.removeSeries(s);}catch(e){}});p.indSeries=[];(p.subSeries||[]).forEach(function(s){try{if(p.sub)p.sub.removeSeries(s);}catch(e){}});p.subSeries=[];p.legItems=[];
    (p.indLines||[]).forEach(function(l){try{p.candle.removePriceLine(l);}catch(e){}});p.indLines=[];
    p._reapply=function(){applyInds(p);}; // loaders (liq/funding/crowd) re-render THIS pane when data lands
    var S=mSig(),IA=mAllowed(),_mk=[],_ss={};
    function _as(key,arr){if(!arr||!arr.length)return;_mk=_mk.concat(arr);if(S&&S.scoreMarkers){try{var st=S.scoreMarkers(p.bars,arr);if(st)_ss[key]=st;}catch(e){}}}
    if(p.inds.sig)_as('TREND',computeSignals(p.bars));
    p._casc=p._brain=p._mem=p._sent=null;
    if(S&&IA){var iv=parseInt(p.tf,10)*60||3600;
      if(p.inds.mom)_as('MOM',S.computeMomentum(p.bars));
      if(p.inds.sqz)_as('SQZ',S.computeSqueeze(p.bars));
      if(p.inds.liqr){if(p._liqEvents&&p._liqSym===p.sym)_as('LIQ',S.computeLiqRev(p.bars,p._liqEvents,iv));else S.loadLiqRev(p);}
      if(p.inds.casc){try{p._casc=S.cascadeCalc(p.bars);}catch(e){}if(p._casc)_as('CASC',p._casc.mk);}
      if(p.inds.brain){try{p._brain=S.brainCalc(p,p.bars);}catch(e){}if(p._brain)_as('BRAIN',p._brain.mk);}
      if(p.inds.memory){try{p._mem=S.memoryCalc(p,p.bars);}catch(e){}}
      if(p.inds.magnet){try{p._mag=S.magnetCalc(p.bars);}catch(e){}}else p._mag=null;
      if(p.inds.sentf){try{p._sent=S.sentimentCalc(p,p.bars);}catch(e){}if(p._sent)_as('FLIP',p._sent.mk);}
    }else p._mag=null;
    try{p.candle.setMarkers(_mk.sort(function(a,b){return a.time-b.time;}));}catch(e){}
    try{for(var _sk in _ss){var _sv=_ss[_sk];p.legItems.push({raw:true,color:_sv.pct>=55?'#2ebd85':_sv.pct<=45?'#ff6258':'#8fa3c4',label:_sk+' '+_sv.pct+'% ('+_sv.w+'W/'+_sv.l+'L)'});}}catch(e){}
    if(p.inds.sr)computeSR(p.bars).forEach(function(L){try{p.indLines.push(p.candle.createPriceLine({price:L.price,color:L.type==='r'?'#ff9f4d':'#3ad29a',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:L.type==='r'?'R':'S'}));}catch(e){}});
    var c=p.bars.map(function(b){return +b.close;}),t=p.bars.map(function(b){return b.time;});
    function add(vals,opts,leg){var s;try{var _tc=(opts.priceScaleId&&p.sub)?p.sub:p.chart;s=_tc.addLineSeries(Object.assign({lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false},opts));}catch(e){return;}var d=[];for(var i=0;i<vals.length;i++)if(vals[i]!=null&&isFinite(vals[i]))d.push({time:t[i],value:vals[i]});try{s.setData(d);}catch(e){}if(opts.priceScaleId&&p.sub)p.subSeries.push(s);else p.indSeries.push(s);if(leg){var last=null;for(var li=d.length-1;li>=0;li--){if(d[li]&&isFinite(d[li].value)){last=d[li].value;break;}}p.legItems.push({label:leg.label,series:s,color:opts.color,dec:leg.dec,last:last,arr:d});}}
    var MA=[['ema9',9,'e','#7fb6ff'],['ema21',21,'e','#3fd8e6'],['ema50',50,'e','#5fe0a6'],['ema100',100,'e','#c2f64a'],['ema200',200,'e','#ffd75a'],['sma20',20,'s','#ff9f43'],['sma50',50,'s','#ff7b72'],['sma100',100,'s','#e0a0ff'],['sma200',200,'s','#ff5a4d']];
    var oscs=['rsi','macd','stoch','atr','vol','wr','cci'].concat((S&&IA)?['casc','brain','memory','sentf']:[]).filter(function(k){return p.inds[k];}),oN=oscs.length;
    try{p.chart.priceScale('right').applyOptions({scaleMargins:{top:0.06,bottom:0.08}});}catch(e){} /* candles own the full pane - oscillators live in the sub strip */
    ensureSubM(p,oN>0);
    function band(key){var idx=oscs.indexOf(key),b=0.92/Math.max(1,oN);return {top:idx*b+0.04,bottom:(oN-1-idx)*b+0.04};}
    function setScale(id){try{if(p.sub)p.sub.priceScale(id).applyOptions({scaleMargins:band(id)});}catch(e){}}
    MA.forEach(function(m){if(p.inds[m[0]])add(m[2]==='e'?ema(c,m[1]):sma(c,m[1]),{color:m[3]},{label:(m[2]==='e'?'EMA ':'SMA ')+m[1],dec:null});});
    if(p.inds.bb){var bb=boll(c,20,2);add(bb.u,{color:'rgba(154,163,173,.7)'});add(bb.m,{color:'rgba(154,163,173,.55)',lineStyle:2});add(bb.l,{color:'rgba(154,163,173,.7)'});}
    if(p.inds.vwap)add(vwap(p.bars),{color:'#46e0e6',lineWidth:2},{label:'VWAP',dec:null});
    if(p.inds.hma)add(hma(c,21),{color:'#ff7bd5'},{label:'HMA 21',dec:null});
    if(p.inds.rsi){add(rsi(c,14),{color:'#e0a0ff',priceScaleId:'rsi'},{label:'RSI 14',dec:0});add(c.map(function(){return 70;}),{color:'rgba(255,98,88,.25)',lineStyle:2,priceScaleId:'rsi'});add(c.map(function(){return 30;}),{color:'rgba(46,189,133,.25)',lineStyle:2,priceScaleId:'rsi'});setScale('rsi');}
    if(p.inds.macd){var mc=macd(c);add(mc.macd,{color:'#3fd8e6',priceScaleId:'macd'},{label:'MACD',dec:null});add(mc.signal,{color:'#ff9f4d',priceScaleId:'macd'},{label:'Signal',dec:null});add(c.map(function(){return 0;}),{color:'rgba(120,130,140,.4)',lineStyle:2,priceScaleId:'macd'});setScale('macd');}
    if(p.inds.stoch){var st=stoch(p.bars,14,3);add(st.k,{color:'#2ee6a8',priceScaleId:'stoch'},{label:'Stoch %K',dec:0});add(st.d,{color:'#ff6258',priceScaleId:'stoch'},{label:'%D',dec:0});add(c.map(function(){return 80;}),{color:'rgba(255,159,77,.22)',lineStyle:2,priceScaleId:'stoch'});add(c.map(function(){return 20;}),{color:'rgba(46,189,133,.22)',lineStyle:2,priceScaleId:'stoch'});setScale('stoch');}
    if(p.inds.atr){add(atr(p.bars,14),{color:'#ffb347',priceScaleId:'atr'},{label:'ATR 14',dec:null});setScale('atr');}
    if(p.inds.wr){add(willr(p.bars,14),{color:'#ffd75a',priceScaleId:'wr'},{label:'%R 14',dec:0});add(c.map(function(){return -20;}),{color:'rgba(255,98,88,.3)',lineStyle:2,priceScaleId:'wr'});add(c.map(function(){return -80;}),{color:'rgba(46,189,133,.3)',lineStyle:2,priceScaleId:'wr'});setScale('wr');}
    if(p.inds.cci){add(cci(p.bars,20),{color:'#7fb6ff',priceScaleId:'cci'},{label:'CCI 20',dec:0});add(c.map(function(){return 100;}),{color:'rgba(255,98,88,.25)',lineStyle:2,priceScaleId:'cci'});add(c.map(function(){return -100;}),{color:'rgba(46,189,133,.25)',lineStyle:2,priceScaleId:'cci'});setScale('cci');}
    if(p.inds.vol){var vs;try{vs=(p.sub||p.chart).addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'vol',lastValueVisible:false,priceLineVisible:false});}catch(e){}
      if(vs){var vd=[];for(var vi=0;vi<p.bars.length;vi++){var vb=p.bars[vi],vv=+vb.vol;if(isFinite(vv)&&vv>0)vd.push({time:vb.time,value:vv,color:(+vb.close>=+vb.open)?'rgba(46,189,133,.45)':'rgba(255,98,88,.45)'});}try{vs.setData(vd);}catch(e){}if(p.sub)p.subSeries.push(vs);else p.indSeries.push(vs);}
      setScale('vol');}
    if(p.inds.casc&&p._casc){var _cl=p._casc.score[p._casc.score.length-1];if(isFinite(_cl))p.legItems.push({raw:true,color:_cl>=90?'#ff6258':_cl>=70?'#ffb020':'#8fa3c4',label:'Cascade '+Math.round(_cl)+'/100 \u2014 '+(_cl>=90?'EXTREME':_cl>=70?'fragile':'calm')});add(p._casc.score,{color:'#ffb020',lineWidth:1.6,priceScaleId:'casc'},{label:'CASCADE',dec:0});add(c.map(function(){return 90;}),{color:'rgba(255,215,90,.4)',lineStyle:2,priceScaleId:'casc'});setScale('casc');}
    if(p.inds.brain&&p._brain){var _bl=p._brain.score[p._brain.score.length-1];if(isFinite(_bl))p.legItems.push({raw:true,color:_bl>=55?'#2ebd85':_bl<=-55?'#ff6258':'#8fa3c4',label:'Brain '+(_bl>=0?'+':'')+Math.round(_bl)+' \u2014 '+(_bl>=55?'bullish lean':_bl<=-55?'bearish lean':'no edge')});add(p._brain.score,{color:'#c2f64a',lineWidth:1.6,priceScaleId:'brain'},{label:'BRAIN',dec:0});add(c.map(function(){return 0;}),{color:'rgba(120,130,140,.35)',lineStyle:2,priceScaleId:'brain'});setScale('brain');try{if(p._brain.top&&p._brain.top.length)p.legItems.push({raw:true,color:'#c2f64a',label:'BRAIN: '+p._brain.top.join(' + ')});}catch(e){}}
    if(p.inds.memory&&p._mem){add(p._mem.forecast.map(function(v){return isFinite(v)?Math.max(-100,Math.min(100,v*30)):null;}),{color:'#b18cff',lineWidth:1.6,priceScaleId:'memory'},{label:'MEMORY',dec:0});add(c.map(function(){return 0;}),{color:'rgba(120,130,140,.35)',lineStyle:2,priceScaleId:'memory'});setScale('memory');
      if(p._mem.proj){try{p.indLines.push(p.candle.createPriceLine({price:p._mem.proj.p,color:p._mem.proj.ret>=0?'#2ebd85':'#ff6258',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'MEM'}));}catch(e){}p.legItems.push({raw:true,color:'#c2f64a',label:'Memory: '+p._mem.proj.n+' analogs, '+Math.round(p._mem.proj.up*100)+'% up, proj '+(p._mem.proj.ret>=0?'+':'')+(p._mem.proj.ret*100).toFixed(2)+'%'});}}
    if(p.inds.sentf&&p._sent){add(p._sent.sent.map(function(v){return isFinite(v)?v*100:null;}),{color:'#3fd8e6',lineWidth:1.4,priceScaleId:'sentf'},{label:'SENTIMENT',dec:0});add(c.map(function(){return 0;}),{color:'rgba(120,130,140,.35)',lineStyle:2,priceScaleId:'sentf'});setScale('sentf');}
    if(p.inds.magnet&&p._mag&&S){var _mg=p._mag,_M=S.money;
      if(_mg.up)try{p.indLines.push(p.candle.createPriceLine({price:_mg.up.price,color:_mg.side==='up'?'#ff6258':'rgba(255,98,88,.55)',lineWidth:_mg.side==='up'?2:1,lineStyle:_mg.side==='up'?0:2,axisLabelVisible:true,title:'SHORT '+_M(_mg.up.w)}));}catch(e){}
      if(_mg.dn)try{p.indLines.push(p.candle.createPriceLine({price:_mg.dn.price,color:_mg.side==='down'?'#2ebd85':'rgba(46,189,133,.55)',lineWidth:_mg.side==='down'?2:1,lineStyle:_mg.side==='down'?0:2,axisLabelVisible:true,title:'LONG '+_M(_mg.dn.w)}));}catch(e){}
      var _tg=_mg.side==='up'?_mg.up:(_mg.side==='down'?_mg.dn:null);if(_tg)p.legItems.push({raw:true,color:'#c2f64a',label:'Magnet: pulled '+(_mg.side==='up'?'UP':'DOWN')+' to '+_M(_tg.w)+' '+(_tg.long?'long':'short')+' liqs ('+(_tg.dist*100).toFixed(1)+'% away)'});}
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
  function toggleDraw(btn){var p=panes[activeI];if(!p||!p.w||!p.w.dr)return;p.w.dr.on=!p.w.dr.on;if(p.w.dr.on){try{window.__mpTrack&&window.__mpTrack('draw',p.sym||'');}catch(_){}}p.el.classList.toggle('drawing',p.w.dr.on);btn.classList.toggle('on',p.w.dr.on);} // draw event also fires on MOBILE (2026-08-11) — the "Draw on a chart" mission verifies uevents type 'draw', and only desktop mp-charts sent it, so phone users could never complete it
  function clearPaneDraw(p){if(p&&p.w&&p.w.dr){p.w.dr.shapes=[];p.w.dr.cur=null;p.w.dr.sel=null;if(p.w.dr.redraw)p.w.dr.redraw();}}
  function toggleTrades(btn){var on=!btn.classList.contains('on');btn.classList.toggle('on',on);panes.forEach(function(p){p.trades=on;if(on)drawTrades(p);else clearTrades(p);});}
  function setActive(i){if(i<0||i>=panes.length)return;activeI=i;panes.forEach(function(p,k){p.el.classList.toggle('active',k===i);});syncBar();var db=ov&&ov.querySelector('[data-act="draw"]'),ap=panes[activeI];if(db)db.classList.toggle('on',!!(ap&&ap.w&&ap.w.dr&&ap.w.dr.on));mfcSave();}
  function syncBar(){var p=panes[activeI];if(!p||!ov)return;var sL=ov.querySelector('.mfc-symL'),tL=ov.querySelector('.mfc-tfL');if(sL)sL.textContent=p.sym;if(tL)tL.textContent=tfLabel(p.tf);}
  // ---- split ----
  function toggleSplit(){split=split===1?2:1;var st=ov.querySelector('#mfcStage'),sL=ov.querySelector('.mfc-splitL');st.classList.toggle('split',split===2);if(sL)sL.textContent=split===2?mcT('mc1chart','1 chart'):mcT('mc2charts','2 charts');
    if(split===2&&panes.length<2){var base=panes[activeI]||panes[0];var _bi=-1;for(var _ti=0;_ti<TFS.length;_ti++)if(TFS[_ti][0]===String(base&&base.tf))_bi=_ti;var _ntf=_bi<0?'240':(_bi<TFS.length-1?TFS[_bi+1][0]:TFS[_bi-1][0]);/* dual view = SAME symbol on the NEXT LARGER timeframe (BTC 5m -> +BTC 15m); at 1d (no larger) fall back to the next smaller (4h). Was hardcoded "other coin at 1h" (ETH 60), which ignored what the user was looking at (2026-07-30). */var p=mkPane(base?base.sym:'BTC',_ntf);panes.push(p);st.appendChild(p.el);loadLib(function(){initChart(p);});}
    else if(split===1&&panes.length>1){var rem=panes.pop();if(rem.w)rem.w.dead=true;try{if(rem.chart)rem.chart.remove();}catch(e){}try{if(rem.sub)rem.sub.remove();}catch(e){}rem.sub=null;if(rem.el.parentNode)rem.el.parentNode.removeChild(rem.el);if(activeI>0)setActive(0);}
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
  // Demo trade — FULL window (owner v2): own coin picker (independent of the chart), the complete
  // Paper-Trade opener incl. Advanced (exchange margin preset, SL, TP, trailing stop, break-even), big X.
  function openTrade(){closeFloat();
    var old=ov.querySelector('.mfc-trbd');if(old){old.remove();return;}
    var tSym=(panes[activeI]||{}).sym||'BTC',side='long',lev=20,mmr=0.005;
    var el=document.createElement('div');el.className='mfc-trbd';
    el.innerHTML='<div class="mfc-trwin"><div class="mfc-trf-h"><b>'+mcT('mcDemoTrade','Demo trade')+'</b><button class="mfc-trf-x" type="button" aria-label="Close">✕</button></div>'
      +'<div class="mfc-trf-b">'
      +'<label class="mtr-lbl">'+mcT('mtCoin','Coin')+'</label>'
      +'<div class="mtr-symrow"><button class="mtr-symcur" id="mtrSymBtn" type="button"><b id="mtrSymCur">'+tSym+'</b><span>▾</span></button><input class="mtr-in mtr-symq" id="mtrSymQ" placeholder="'+mcT('mtSearchTicker','Search any ticker…')+'" inputmode="search" hidden></div>'
      +'<div class="mfc-sl mtr-syml" id="mtrSymL" hidden></div>'
      +'<div class="mtr-seg" id="mtrSeg"><button class="on" data-side="long" type="button">'+mcT('long','Long')+'</button><button data-side="short" type="button">'+mcT('short','Short')+'</button></div>'
      +'<label class="mtr-lbl">'+mcT('lAmountIn','Amount (USD)')+'</label>'
      +'<input class="mtr-in" id="mtrAmt" type="number" inputmode="decimal" value="100" min="1" max="100000" step="any">'
      +'<label class="mtr-lbl">'+mcT('lLeverage','Leverage')+' <b id="mtrLevV" style="color:#c2f64a">20×</b></label>'
      +'<input class="mtr-sl" id="mtrLev" type="range" min="0" max="1000" value="434" step="1">'
      +'<label class="mtr-adv"><input type="checkbox" id="mtrAdvChk"><span>'+mcT('mtAdvanced','Advanced')+'</span></label>'
      +'<div class="mtr-advbox" id="mtrAdv" hidden>'
      +  '<label class="mtr-lbl">'+mcT('lExchangePt','Exchange (sets margin rate)')+'</label>'
      +  '<select class="mtr-in" id="mtrEx"><option value="0.4">Binance — 0.4%</option><option value="0.5" selected>Bybit — 0.5%</option><option value="0.5">OKX — 0.5%</option><option value="0.5">Bitget — 0.5%</option><option value="0.5">KuCoin — 0.5%</option><option value="0.5">Gate — 0.5%</option><option value="0.6">Kraken — 0.6%</option></select>'
      +  '<label class="mtr-lbl">'+mcT('lStopOpt','Stop-loss (optional)')+'</label><input class="mtr-in" id="mtrSL" type="number" inputmode="decimal" step="any" placeholder="—">'
      +  '<label class="mtr-lbl">'+mcT('lTpOpt','Take-profit (optional)')+'</label><input class="mtr-in" id="mtrTP" type="number" inputmode="decimal" step="any" placeholder="—">'
      +  '<label class="mtr-lbl">'+mcT('lTrail','Trailing stop')+' (%)</label><input class="mtr-in" id="mtrTr" type="number" inputmode="decimal" step="any" min="0" placeholder="off">'
      +  '<label class="mtr-lbl">'+mcT('lBreakEven','Break-even at ROE')+' (%)</label><input class="mtr-in" id="mtrBE" type="number" inputmode="decimal" step="any" min="0" placeholder="off">'
      +'</div>'
      +'<div class="mtr-stats"><div><span>'+mcT('lEntry','Entry price')+'</span><b id="mtrPx">…</b></div><div><span>'+mcT('rEstLiq','Est. liquidation')+'</span><b id="mtrLiq">—</b></div><div><span>'+mcT('rPosSize','Position size')+'</span><b id="mtrSz">—</b></div><div><span>'+mcT('rNotional','Notional value')+'</span><b id="mtrNot">—</b></div></div>'
      +'<button class="mtr-open" id="mtrGo" type="button">'+mcT('mtOpen','Open demo trade')+'</button>'
      +'<div class="mtr-msg" id="mtrMsg"></div>'
      +'</div></div>';
    ov.appendChild(el);
    // windowed modal: the dimmed backdrop swallows everything — no scroll/pan bleeding through to the chart
    el.addEventListener('touchmove',function(e){if(!e.target.closest('.mfc-trf-b'))e.preventDefault();},{passive:false});
    el.addEventListener('pointerdown',function(e){if(!e.target.closest('.mfc-trwin')){e.preventDefault();e.stopPropagation();}});
    el.addEventListener('wheel',function(e){if(!e.target.closest('.mfc-trf-b'))e.preventDefault();},{passive:false});
    var q=function(id){return el.querySelector('#'+id);};
    function closeWin(){try{clearInterval(updT);}catch(e){}el.remove();}
    var xb=el.querySelector('.mfc-trf-x');
    xb.addEventListener('click',closeWin);
    xb.addEventListener('pointerup',function(e){e.preventDefault();closeWin();}); // belt & braces — the old float ✕ missed taps on some phones
    // coin picker (independent of the chart)
    if(window.mpLoadTokens)try{window.mpLoadTokens(function(){tokens=window.mpTokens||tokens;});}catch(e){}
    var symQ=q('mtrSymQ'),symL=q('mtrSymL'),symBtn=q('mtrSymBtn');
    function renderSyms(qs){qs=String(qs||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
      var src=window.mpTokens||tokens;
      var arr=qs?src.filter(function(t){return t.indexOf(qs)===0;}).concat(src.filter(function(t){return t.indexOf(qs)>0;})):src.slice(0,30);
      symL.innerHTML=arr.slice(0,40).map(function(t){return '<button type="button" data-pick="'+t+'"'+(t===tSym?' class="on"':'')+'>'+t+'</button>';}).join('');}
    symBtn.addEventListener('click',function(){var open=symQ.hidden;symQ.hidden=!open;symL.hidden=!open;if(open){renderSyms('');symQ.value='';setTimeout(function(){symQ.focus();},30);}});
    symQ.addEventListener('input',function(){renderSyms(this.value);});
    symL.addEventListener('click',function(e){var b=e.target.closest('[data-pick]');if(!b)return;tSym=b.getAttribute('data-pick');q('mtrSymCur').textContent=tSym;symQ.hidden=true;symL.hidden=true;
      try{if(window.mpWS)window.mpWS.sub(tSym);}catch(_){}
      upd();});
    var posToLev=function(x){return Math.max(1,Math.min(1000,Math.round(Math.pow(1000,x/1000))));};
    q('mtrSeg').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;side=b.getAttribute('data-side');
      Array.prototype.forEach.call(q('mtrSeg').querySelectorAll('button'),function(x){x.classList.toggle('on',x===b);});
      q('mtrSeg').classList.toggle('short',side==='short');upd();});
    q('mtrLev').addEventListener('input',function(){lev=posToLev(+this.value);q('mtrLevV').textContent=lev+'×';upd();});
    q('mtrAmt').addEventListener('input',function(){if(+this.value>100000)this.value=100000;upd();});
    q('mtrAdvChk').addEventListener('change',function(){q('mtrAdv').hidden=!this.checked;});
    q('mtrEx').addEventListener('change',function(){mmr=(+this.value||0.5)/100;upd();});
    function livePx(){
      // FRESH price only — a stale window.mpLivePrices[sym] (e.g. seeded long ago by another open position on the same
      // coin and never updated because the coin isn't in the live WS feed) must NEVER become a new trade's entry: it
      // gave a wrong entry → wrong liq → the trade "instantly liquidated / vanished". So prefer the LIVE chart for this
      // symbol (REST-resynced ≤60s + live ticks — exactly the price the user sees), then mpLivePrices ONLY if <15s old.
      for(var i=0;i<panes.length;i++){var pp=panes[i];if(pp&&pp.sym===tSym&&pp.lastBar&&+pp.lastBar.close>0)return +pp.lastBar.close;}
      var lp=window.mpLivePrices&&window.mpLivePrices[tSym];
      if(lp&&lp.p>0&&lp.t&&(Date.now()-lp.t)<15000)return +lp.p;
      // nothing fresh → pull a REST price + seed the map, return 0 so the opener asks the user to retry (never opens stale)
      fetch('/api/price?symbol='+encodeURIComponent(tSym)+window.__mpPQ('one',tSym),{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){var pv=+((d&&(d.price||d.p))||0);if(pv>0&&window.mpLivePrices)window.mpLivePrices[tSym]={p:pv,t:Date.now()};}).catch(function(){});
      return 0;}
    function upd(){var px=livePx();var amt=+q('mtrAmt').value||0;
      if(px>0){var liq=side==='long'?px*(1-(1-mmr)/lev):px*(1+(1-mmr)/lev);
        q('mtrPx').textContent=fp(px);
        q('mtrLiq').textContent=fp(liq)+' ('+((1/lev-mmr)*100).toFixed(2)+'%)';
      }else{q('mtrPx').textContent='…';q('mtrLiq').textContent='—';}
      q('mtrSz').textContent=fp(amt*lev);q('mtrNot').textContent=fp(amt*lev);
      q('mtrGo').classList.toggle('short',side==='short');}
    upd();
    var updT=setInterval(function(){if(!document.body.contains(el)){clearInterval(updT);return;}upd();},600);
    q('mtrGo').addEventListener('click',function(){
      var msg=q('mtrMsg');
      var amt=+q('mtrAmt').value||0;if(amt>100000)amt=100000;
      if(!(amt>0)){msg.style.color='#ff6258';msg.textContent=mcT('mtEnterAmt','Enter an amount.');return;}
      if(window.mpTradeGate&&!window.mpTradeGate(tSym,side))return;
      // ALWAYS open at a FRESHLY-fetched price. A cached price even a few seconds old opens a volatile coin (US moves >1%/sec)
      // already past its 100× liq distance → the trade "instantly liquidates" the moment the real price loads. Fetch at click.
      msg.style.color='#9aa3ad';msg.textContent=mcT('mtGetPx','Getting live price…');
      fetch('/api/price?symbol='+encodeURIComponent(tSym)+window.__mpPQ('one',tSym),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){
        var px=j&&+(j.price||j.p||0);if(!(px>0))px=livePx();
        if(!(px>0)){msg.style.color='#ff6258';msg.textContent='Waiting for a live price — try again in a second.';return;}
        try{if(j&&j.state!=null&&window.mpMktState)window.mpMktState[String(tSym).toUpperCase()]=String(j.state);}catch(_){}
        if(window.mpIsMktClosed&&window.mpIsMktClosed(tSym)){msg.style.color='#ff6258';msg.textContent=tSym+' market is closed — you can trade it when it reopens.';return;} // stocks: block while the exchange is shut (consistent with the plan form)
        var long=side==='long';
        var sl=parseFloat(q('mtrSL').value),tp=parseFloat(q('mtrTP').value);
        if(isFinite(sl)&&((long&&sl>=px)||(!long&&sl<=px)))sl=NaN; // wrong side — drop so it can't self-trigger
        if(isFinite(tp)&&((long&&tp<=px)||(!long&&tp>=px)))tp=NaN;
        var tr=parseFloat(q('mtrTr').value),be=parseFloat(q('mtrBE').value);
        var notional=amt*lev,qty=notional/px,liq=long?px*(1-(1-mmr)/lev):px*(1+(1-mmr)/lev);
        var _locT={id:String(Date.now())+'_'+Math.floor(Math.random()*1e4),ts:Date.now(),sym:tSym,side:side,entry:px,stop:isFinite(sl)?sl:null,tp:isFinite(tp)?tp:null,trail:(isFinite(tr)&&tr>0)?tr:null,be:(isFinite(be)&&be>0)?be:null,hwm:null,lev:lev,rr:null,qty:qty,notional:notional,margin:amt,riskAmt:amt,liq:liq,mmr:mmr,feeRate:(window.mpFeeRate?window.mpFeeRate(lev,tSym):Math.min(0.00055,0.1/Math.max(1,lev))),status:'open',pnl:null};/* per-class taker fee (was hardcoded 0 → mobile demo-trades closed fee-free, inconsistent with the plan form) */
        var _finMc=function(P){
        var d;try{d=JSON.parse(localStorage.getItem('mp_journal'))||[];}catch(e){d=[];}
        d.push(P);
        try{window.mpJStore(d);}catch(e){}
        if(window.mpLivePrices)window.mpLivePrices[tSym]={p:+P.entry,t:Date.now()};
        if(window.mpJournalRender)window.mpJournalRender();
        try{window.mpBuzz&&window.mpBuzz([15]);}catch(e){}
        try{if(window.mpLevWarn)window.mpLevWarn(lev);}catch(e){}
        try{if(window.mpCheckGrad)window.mpCheckGrad();}catch(e){}
        try{if(typeof updMT==='function')updMT();}catch(e){}
        msg.style.color='#2ebd85';msg.textContent=mcT('mtOpened','Position opened ✓')+' — '+tSym+' '+side+' '+lev+'× · $'+amt;
        var g=q('mtrGo');g.textContent=mcT('mtOpened','Position opened ✓');
        setTimeout(function(){if(document.body.contains(g))g.textContent=mcT('mtOpen','Open demo trade');},1600);
        };
        var _tr9=(isFinite(tr)&&tr>0)?tr:null,_be9=(isFinite(be)&&be>0)?be:null;
        if(window.mpSrvOpen){window.mpSrvOpen({sym:tSym,side:side,lev:lev,margin:amt,sl:isFinite(sl)?sl:null,tp:isFinite(tp)?tp:null},function(t){t.trail=_tr9;t.be=_be9;t.hwm=null;_finMc(t);},function(err){if(err&&err.blocked){try{var g=q('mtrGo');if(g)g.textContent=mcT('mtOpen','Open demo trade');}catch(e){}return;}_finMc(_locT);});}
        else{_finMc(_locT);}
        panes.forEach(function(pn){if(pn.trades)try{drawTrades(pn);}catch(e){}});
      });
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
  function buildInd(body,p){var al=mAllowed();body.innerHTML='<div class="mfc-indm">'+INDS.map(function(d){var lk=mEx(d[0])&&!al,st=mEx(d[0])?' style="color:#c2f64a;font-weight:700'+(lk?';opacity:.5':'')+'"':'';return '<button class="'+(p.inds[d[0]]?'on':'')+(lk?' locked':'')+'" data-ind="'+d[0]+'"'+st+'>'+d[1]+(lk?' LOCKED':'')+'</button>';}).join('')+'</div><p style="color:#9aa3ad;font-size:11.5px;margin-top:12px">'+mcT('mcIndNote','Same indicator families as the desktop workspace. Applies to the selected chart.')+'</p>';
    body.addEventListener('click',function(e){var b=e.target.closest('[data-ind]');if(!b)return;var k=b.getAttribute('data-ind');if(mEx(k)&&!mAllowed()){if(window.mpPremium&&window.mpPremium.show)window.mpPremium.show('Unlock the premium indicators');return;}p.inds[k]=!p.inds[k];b.classList.toggle('on',!!p.inds[k]);applyInds(p);mfcSave();});}
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
        if(!resp.ok){busy=false;bub.textContent=resp.status===429?'Daily AI limit reached — resets tomorrow.':(resp.status===401?'Please sign in to use AI.':(resp.status===402?'Ask AI is part of MarginPad Premium ($3.99/mo) — upgrade from your profile to use it.':'Could not reach AI — try again.'));return;}
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
  function open(sym){ if(!ov)build(); ov.hidden=false; document.documentElement.style.overflow='hidden';
    if(sym){var _S=String(sym).toUpperCase().replace(/[^A-Z0-9]/g,'');if(_S){forcePair=_S;if(panes.length){try{var _st=ov.querySelector('#mfcStage');panes.forEach(function(pp){try{if(pp.chart)pp.chart.remove();}catch(e){}try{if(pp.sub)pp.sub.remove();}catch(e){}pp.sub=null;});if(_st)_st.innerHTML='';panes=[];activeI=0;}catch(e){}}}}
    showGate(false);proceed(); // portrait works too — the inline .mfc-rot hint nudges toward landscape instead of a full-screen wall (UX audit)
  }
  function proceed(){ entered=true; showGate(false);
    if(!panes.length){
      var sv=mfcLoad(),st=ov.querySelector('#mfcStage');
      var cfgs=forcePair?[{sym:forcePair,tf:'60'},{sym:forcePair,tf:'240'}]:((sv&&sv.panes&&sv.panes.length)?sv.panes.slice(0,2):[{sym:'BTC',tf:'60'},{sym:'ETH',tf:'60'}]); if(forcePair)forcePair=null; // ticket "Chart" -> same pair in two timeframes (1h + 4h); else default TWO charts / saved state
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
  function close(){ if(!ov)return; // owner 2026-07-09: closing charts on the phone must land on the HOMEPAGE, no in-between screens
    try{mfcSave();}catch(e){}
    try{reallyClose();}catch(e){}
    try{location.replace('/');}catch(e){location.href='/';}
  }
  window.mpOpenCharts=open;
  try{window.__mfcPanes=function(){return panes;};}catch(e){} // permanent read-only debug accessor (mirror of desktop window.__mpWinsDbg) — lets headless E2E introspect the live pane bars; panes is reassigned on forcePair so return it via closure
  // live ticks
  document.addEventListener('mp:price',function(ev){if(!ov||ov.hidden||!ev.detail)return;panes.forEach(function(p){if(p.sym===ev.detail.sym)live(p);});});
  setInterval(function(){if(!ov||ov.hidden)return;panes.forEach(function(p){
    if(!p.candle)return;
    // (1) re-assert autoScale ONLY at the realtime edge — a locked/drifted price scale (e.g. the user dragged the
    //     price axis) makes the chart LOOK frozen even though live() keeps updating; heal it in ~2s like desktop.
    try{var vr=p.chart.timeScale().getVisibleLogicalRange();if(!p._userPS&&(!vr||!p.bars||!p.bars.length||vr.to>=p.bars.length-2))p.chart.priceScale('right').applyOptions({autoScale:true});}catch(e){}
    // (2) newest bar >1.5 intervals behind now → new bars stopped forming; force a klines re-sync (independent of price freshness)
    try{if(p.lastBar){var _iv=parseInt(p.tf,10)*60,_nb=Math.floor(Date.now()/1000/_iv)*_iv;if((_nb-p.lastBar.time>_iv*1.5||p._hole)&&(!p._gapT||Date.now()-p._gapT>10000)){p._gapT=Date.now();resyncKlines(p);return;}}}catch(e){} // p._hole: keeps retrying even after a live roll made lastBar look current (cleared only on a successful snapshot fetch)
    // liveness: if the WS hasn't ticked this symbol for >8s, pull a REST price so the pane can NEVER freeze on a stale value
    var lp=window.mpLivePrices&&window.mpLivePrices[p.sym];
    if(!lp||!lp.t||Date.now()-lp.t>8000){ try{if(window.mpWS)window.mpWS.sub(p.sym);}catch(e){}
      if(!p._rf||Date.now()-p._rf>8000){ p._rf=Date.now();
        fetch('/api/price?symbol='+encodeURIComponent(p.sym)+window.__mpPQ('mcht',p.sym),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){var px=j&&+j.price;if(px>0&&window.mpLivePrices){window.mpLivePrices[p.sym]={p:px,t:Date.now(),chg:(j.chg!=null?+j.chg:(lp&&lp.chg))};}live(p);});
      } return; }
    live(p);});},2000);
  // returning to the tab: the 60s reload gate only fires from live ticks, so force a real klines re-sync immediately
  // candle-close countdown (2026-07-30): shares the desktop's server-skew (window.__mpSrvSkew); one 1s ticker for all panes, guarded on the overlay being open. Stalled feed -> '--:--'.
  (function(){function skew(){if(window.__mpSrvSkew!=null||window.__mpSrvSkewP)return;window.__mpSrvSkewP=1;fetch('/api/prices',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(d){window.__mpSrvSkew=(d&&+d.ts>0)?(+d.ts-Date.now()):0;}).catch(function(){window.__mpSrvSkew=0;});}
  setInterval(function(){if(!ov||ov.hidden||document.hidden||!panes.length)return;skew();var nowS=(window.mpSrvNow?window.mpSrvNow():(Date.now()+(+window.__mpSrvSkew||0)))/1000; /* SAME clock as the bar roll (mpSrvNow) — the cached /api/prices skew made the timer lag the roll */
    panes.forEach(function(p){var el=p.el&&p.el.querySelector('.mfc-pl-cd');if(!el)return;var iv=parseInt(p.tf,10)*60;if(!(iv>0)){el.textContent='';return;}
      var stale=!p.lastBar||((nowS-p.lastBar.time)>iv*1.5+90);var sec=Math.max(0,Math.floor(iv-(nowS%iv)));var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),x=sec%60,P=function(n){return (n<10?'0':'')+n;};
      el.classList.toggle('stale',!!stale);el.textContent=stale?'--:--':(iv>=3600?(P(h)+':'+P(m)+':'+P(x)):(P(m)+':'+P(x)));});},1000);})();
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&ov&&!ov.hidden)panes.forEach(function(p){if(p.candle)resyncKlines(p);});});
  window.addEventListener('pageshow',function(e){if(e&&e.persisted&&ov&&!ov.hidden)panes.forEach(function(p){if(p.candle)resyncKlines(p);});}); // iOS bfcache restore doesn't reliably fire visibilitychange (re-sync, guarded — don't yank a scrolled-back user)
  // Browse "Charts" → open full-screen on mobile (intercept before navigation)
  document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-mcharts]');if(!t)return;if(isMob()){e.preventDefault();e.stopPropagation();open();}},true);
  // landing on /charts on a phone → open the full-screen experience automatically
  if(isMob()&&/^\/charts\/?$/.test(location.pathname)){window.addEventListener('load',function(){setTimeout(open,250);});}
})();
