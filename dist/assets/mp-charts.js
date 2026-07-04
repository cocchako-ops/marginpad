/* ===== Charts workspace: draggable, resizable windowed charts (LightweightCharts) ===== */
(function(){
  var board=document.getElementById('cwsBoard'), space=document.getElementById('chartspace');
  if(!board||!space)return;
  var MAX_DESKTOP=8;
  var SYMS=['BTC','ETH','SOL','XRP','BNB','DOGE','ADA','AVAX','LINK','LTC','TON','TRX','DOT','ATOM','NEAR','ARB','OP'];
  var TFS=[['1','1m'],['5','5m'],['15','15m'],['60','1H'],['240','4H'],['1440','1D']];
  var INDS=[['sig','Buy / Sell signals'],['ema','EMA'],['sma','SMA'],['hma','Hull MA (21)'],['vwap','VWAP'],['bb','Bollinger Bands'],['kc','Keltner Channels'],['dc','Donchian Channel'],['sr','Support / Resistance'],['pp','Pivot Points'],['vol','Volume'],['rsi','RSI (14)'],['macd','MACD (12/26/9)'],['stoch','Stochastic (14/3)'],['atr','ATR (14)'],['wr','Williams %R (14)'],['cci','CCI (20)']];
  var ITIPS={sig:'Green arrow = the trend just flipped UP (a possible buy). Red arrow = flipped DOWN (a possible sell).',ema:'A smooth line of the average price, but recent prices count more. Price above the line = going up; below = going down.',sma:'The plain average price over the last bars. A simple trend line — price above it is bullish.',hma:'A super-smooth, fast average price line — less wobble and less lag than EMA/SMA.',vwap:'The average price weighted by how much was traded. Big traders treat it as today’s fair price.',bb:'Two bands hugging price. Near the top band = pricey, near the bottom = cheap. Wide bands = wild, tight = calm.',kc:'Bands based on how much price usually moves. Price popping outside them signals a strong move.',dc:'The highest high and lowest low of the last bars. Price breaking above = an upside breakout.',sr:'Lines where price often bounces (support) or gets rejected (resistance).',pp:'Key daily price levels (pivot) where price tends to pause or turn.',vol:'How much was traded each bar. Tall bars = lots of people trading right then.',rsi:'A 0–100 speed meter. Above 70 = maybe too high (overbought); below 30 = maybe too low (oversold).',macd:'Shows if the trend is speeding up or slowing down. Above the 0 line = buyers in control.',stoch:'Like RSI for timing turns. Above 80 = overbought, below 20 = oversold.',atr:'How much price usually moves per bar. Big ATR = wild market → use wider stops.',wr:'Williams %R — like an upside-down RSI. Near 0 = overbought, near −100 = oversold.',cci:'Shows how far price is from its average. Above +100 = strong up push; below −100 = strong down push.'};
  var wins=[], notes=[], zTop=10, built=false, libLoading=false, libCbs=[];
  function isMobile(){return !!(window.matchMedia && window.matchMedia('(max-width:880px)').matches);}
  function MAXn(){return isMobile()?1:MAX_DESKTOP;}
  function loadLib(cb){ if(window.LightweightCharts)return cb(); libCbs.push(cb); if(libLoading)return; libLoading=true;
    var s=document.createElement('script'); s.src='/assets/lightweight-charts-4.2.0.js';
    s.onload=function(){var f=libCbs.splice(0);f.forEach(function(fn){try{fn();}catch(e){}});}; s.onerror=function(){}; document.head.appendChild(s); }
  function el(h){var d=document.createElement('div');d.innerHTML=h;return d.firstElementChild;}
  function ema(v,p){var k=2/(p+1),o=[],e;for(var i=0;i<v.length;i++){e=i?v[i]*k+o[i-1]*(1-k):v[i];o.push(e);}return o;}
  // clamp ISOLATED phantom wicks (bad/transient prints) so a single bad candle can't draw a giant vertical line
  function sanitizeBars(kd){if(!kd||kd.length<2)return kd;var TH=0.035;for(var i=0;i<kd.length;i++){var b=kd[i];if(!b)continue;var o=+b.open,c=+b.close;if(!(o>0&&c>0))continue;var bodyLo=Math.min(o,c),bodyHi=Math.max(o,c);var pl=i>0?+kd[i-1].low:bodyLo,nl=i<kd.length-1?+kd[i+1].low:bodyLo;var ph=i>0?+kd[i-1].high:bodyHi,nh=i<kd.length-1?+kd[i+1].high:bodyHi;var refLo=Math.min(bodyLo,pl||bodyLo,nl||bodyLo);if(+b.low>0&&+b.low<refLo*(1-TH))b.low=refLo*(1-TH);var refHi=Math.max(bodyHi,ph||bodyHi,nh||bodyHi);if(+b.high>refHi*(1+TH))b.high=refHi*(1+TH);}return kd;}
  /* Supertrend(10,3) buy/sell — same engine as the Paper Trade "Signals" toggle */
  function computeSignals(d){var n=d?d.length:0,P=10,M=3;if(n<P+3)return [];
    var tr=[],i;for(i=0;i<n;i++){tr.push(i===0?d[i].high-d[i].low:Math.max(d[i].high-d[i].low,Math.abs(d[i].high-d[i-1].close),Math.abs(d[i].low-d[i-1].close)));}
    var atr=[],seed=0;for(i=0;i<P;i++)seed+=tr[i];var a=seed/P;for(i=0;i<n;i++){if(i<P)atr.push(a);else{a=(a*(P-1)+tr[i])/P;atr.push(a);}}
    var fU=[],fL=[],dir=[],mk=[];for(i=0;i<n;i++){var hl2=(d[i].high+d[i].low)/2,bU=hl2+M*atr[i],bL=hl2-M*atr[i];
      var pU=i?fU[i-1]:bU,pL=i?fL[i-1]:bL;
      var cU=(bU<pU||(i&&d[i-1].close>pU))?bU:pU,cL=(bL>pL||(i&&d[i-1].close<pL))?bL:pL;fU.push(cU);fL.push(cL);
      var pd=i?dir[i-1]:1,cd;if(i===0)cd=1;else if(pd===1)cd=d[i].close<cL?-1:1;else cd=d[i].close>cU?1:-1;dir.push(cd);
      if(i>P&&cd!==pd)mk.push(cd===1?{time:d[i].time,position:'belowBar',color:'#2ebd85',shape:'arrowUp',text:'BUY'}:{time:d[i].time,position:'aboveBar',color:'#ff6258',shape:'arrowDown',text:'SELL'});}
    return mk;}
  /* EMA(9/21) crossover buy/sell */
  /* pivot-based support / resistance levels */
  function computeSR(d){var L=6,n=d?d.length:0,lv=[];if(n<2*L+6)return lv;
    for(var i=L;i<n-L;i++){var hi=d[i].high,lo=d[i].low,ph=true,pl=true;
      for(var j=i-L;j<=i+L;j++){if(d[j].high>hi)ph=false;if(d[j].low<lo)pl=false;}
      if(ph)lv.push({price:hi,type:'r'});if(pl)lv.push({price:lo,type:'s'});}
    var rs=lv.filter(function(x){return x.type==='r';}).slice(-3),ss=lv.filter(function(x){return x.type==='s';}).slice(-3);
    return rs.concat(ss);}
  function closes(b){return b.map(function(x){return x.close;});}
  function mapVal(b,arr){var o=[];for(var i=0;i<b.length;i++){if(isFinite(arr[i]))o.push({time:b[i].time,value:arr[i]});}return o;}
  function cwFmt(v,dec){if(v==null||!isFinite(v))return '–';if(dec===0)return String(Math.round(v));if(dec!=null)return (+v).toFixed(dec);var a=Math.abs(v);return a>=1000?(+v).toLocaleString('en-US',{maximumFractionDigits:2}):a>=1?(+v).toFixed(3):(+v).toFixed(6);}
  // decimals to show on the price axis by magnitude — small-cap tokens (e.g. $0.000123) need many more than 2
  function pricePrec(p){p=Math.abs(+p)||0;if(p>=1)return 2;if(p>=0.1)return 4;if(p>=0.01)return 5;if(p>=0.001)return 6;if(p>=0.0001)return 7;if(p>=0.00001)return 8;return 9;}
  function applyPrec(series,p){try{var n=pricePrec(p);series.applyOptions({priceFormat:{type:'price',precision:n,minMove:Math.pow(10,-n)}});}catch(e){}}
  function cwLeg(w,param){if(!w||!w.legEl)return;if(!w.legItems||!w.legItems.length){w.legEl.style.display='none';w.legEl.innerHTML='';return;}w.legEl.style.display='';w.legEl.innerHTML=w.legItems.map(function(it){var v=it.last;if(param&&param.seriesData){var sd=param.seriesData.get(it.series);if(sd!=null)v=(typeof sd==='object'?(sd.value!=null?sd.value:sd.close):sd);}return '<span style="color:'+it.color+'">'+it.label+' <b>'+cwFmt(v,it.dec)+'</b></span>';}).join('');}
  function sma(v,p){var o=[],s=0;for(var i=0;i<v.length;i++){s+=v[i];if(i>=p)s-=v[i-p];o.push(i>=p-1?s/p:NaN);}return o;}
  function bollinger(b,p,k){var c=closes(b),m=sma(c,p),up=[],lo=[],mid=[];for(var i=0;i<c.length;i++){if(i<p-1){up.push(NaN);lo.push(NaN);mid.push(NaN);continue;}var s=0;for(var j=i-p+1;j<=i;j++){var d=c[j]-m[i];s+=d*d;}var sd=Math.sqrt(s/p);up.push(m[i]+k*sd);lo.push(m[i]-k*sd);mid.push(m[i]);}return {up:mapVal(b,up),mid:mapVal(b,mid),low:mapVal(b,lo)};}
  function donchian(b,p){var up=[],lo=[],mid=[];for(var i=0;i<b.length;i++){if(i<p-1){up.push(NaN);lo.push(NaN);mid.push(NaN);continue;}var h=-Infinity,l=Infinity;for(var j=i-p+1;j<=i;j++){if(b[j].high>h)h=b[j].high;if(b[j].low<l)l=b[j].low;}up.push(h);lo.push(l);mid.push((h+l)/2);}return {up:mapVal(b,up),low:mapVal(b,lo),mid:mapVal(b,mid)};}
  function rsiCalc(v,p){var o=[],g=0,l=0;for(var i=0;i<v.length;i++){if(i===0){o.push(NaN);continue;}var ch=v[i]-v[i-1],u=ch>0?ch:0,dn=ch<0?-ch:0;if(i<=p){g+=u;l+=dn;if(i===p){g/=p;l/=p;o.push(100-100/(1+(l===0?100:g/l)));}else o.push(NaN);}else{g=(g*(p-1)+u)/p;l=(l*(p-1)+dn)/p;o.push(100-100/(1+(l===0?100:g/l)));}}return o;}
  function pivotsCalc(b){var n=b.length;if(n<5)return [];var k=Math.min(n,96),H=-Infinity,L=Infinity,C=b[n-1].close;for(var i=n-k;i<n;i++){if(b[i].high>H)H=b[i].high;if(b[i].low<L)L=b[i].low;}var P=(H+L+C)/3;return [{k:'P',v:P,c:'#c2f64a',s:0},{k:'R1',v:2*P-L,c:'#ff9f4d',s:3},{k:'S1',v:2*P-H,c:'#3ad29a',s:3},{k:'R2',v:P+(H-L),c:'#ff6258',s:3},{k:'S2',v:P-(H-L),c:'#2ebd85',s:3}];}
  function atr(b,p){var tr=[],i;for(i=0;i<b.length;i++){if(i===0){tr.push(b[i].high-b[i].low);}else{var h=b[i].high,l=b[i].low,pc=b[i-1].close;tr.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)));}}var o=[],s=0;for(i=0;i<tr.length;i++){if(i<p){s+=tr[i];o.push(i===p-1?s/p:NaN);}else{o.push((o[i-1]*(p-1)+tr[i])/p);}}return o;}
  function macdCalc(c){var f=ema(c,12),s=ema(c,26),m=[],i;for(i=0;i<c.length;i++)m.push(f[i]-s[i]);var sig=ema(m,9),hist=[];for(i=0;i<c.length;i++)hist.push(m[i]-sig[i]);return {macd:m,signal:sig,hist:hist};}
  function stoch(b,kP,dP){var k=[],i,j;for(i=0;i<b.length;i++){if(i<kP-1){k.push(NaN);continue;}var hh=-Infinity,ll=Infinity;for(j=i-kP+1;j<=i;j++){if(b[j].high>hh)hh=b[j].high;if(b[j].low<ll)ll=b[j].low;}k.push(hh===ll?50:100*(b[i].close-ll)/(hh-ll));}var d=sma(k,dP);return {k:k,d:d};}
  function vwapW(bs){var o=[],pv=0,vv=0;for(var i=0;i<bs.length;i++){var tp=(+bs[i].high+ +bs[i].low+ +bs[i].close)/3,v=+bs[i].vol;if(isFinite(v)&&v>0){pv+=tp*v;vv+=v;}o.push(vv?pv/vv:NaN);}return o;}
  function wmaW(c,p){var o=[],i,j;for(i=0;i<c.length;i++){if(i<p-1){o.push(NaN);continue;}var sum=0,ws=0;for(j=0;j<p;j++){var w=p-j;sum+=c[i-j]*w;ws+=w;}o.push(sum/ws);}return o;}
  function hmaW(c,p){var half=Math.max(1,Math.round(p/2)),sq=Math.max(1,Math.round(Math.sqrt(p))),w1=wmaW(c,half),w2=wmaW(c,p),raw=[],i,j;for(i=0;i<c.length;i++)raw.push((isFinite(w1[i])&&isFinite(w2[i]))?2*w1[i]-w2[i]:NaN);var o=[];for(i=0;i<c.length;i++){if(i<p-2+sq){o.push(NaN);continue;}var sum=0,ws=0,ok=true;for(j=0;j<sq;j++){var v=raw[i-j];if(!isFinite(v)){ok=false;break;}var w=sq-j;sum+=v*w;ws+=w;}o.push(ok?sum/ws:NaN);}return o;}
  function willrW(bs,p){var o=[],i,j;for(i=0;i<bs.length;i++){if(i<p-1){o.push(NaN);continue;}var hh=-Infinity,ll=Infinity;for(j=i-p+1;j<=i;j++){if(bs[j].high>hh)hh=bs[j].high;if(bs[j].low<ll)ll=bs[j].low;}o.push(hh===ll?-50:(hh-bs[i].close)/(hh-ll)*-100);}return o;}
  function cciW(bs,p){var tp=bs.map(function(b){return (+b.high+ +b.low+ +b.close)/3;}),o=[],i,j;for(i=0;i<bs.length;i++){if(i<p-1){o.push(NaN);continue;}var sum=0;for(j=i-p+1;j<=i;j++)sum+=tp[j];var ma=sum/p,md=0;for(j=i-p+1;j<=i;j++)md+=Math.abs(tp[j]-ma);md/=p;o.push(md===0?0:(tp[i]-ma)/(0.015*md));}return o;}
  function applyInds(w){ if(!w.candle)return; var bars=w.bars||[];
    var mk=[]; if(w.inds.sig)mk=mk.concat(computeSignals(bars)); mk.sort(function(a,b){return a.time-b.time;}); try{w.candle.setMarkers(mk);}catch(e){}
    (w.indLines||[]).forEach(function(l){try{w.candle.removePriceLine(l);}catch(e){}}); w.indLines=[];
    (w.indSeries||[]).forEach(function(s){try{w.chart.removeSeries(s);}catch(e){}}); w.indSeries=[]; w.legItems=[];
    // allocate the bottom 30% of the chart among the active sub-panes (rsi/macd/stoch/atr) so they stack instead of overlapping; candles take the rest. Reset each call (fixes RSI leaving candles compressed after toggle-off).
    var paneKeys=['vol','rsi','macd','stoch','atr','wr','cci'].filter(function(k){return w.inds[k];}); var paneN=paneKeys.length;
    try{w.chart.priceScale('right').applyOptions({scaleMargins:{top:0.06,bottom:paneN?0.30:0.08}});}catch(e){}
    function pm(key){var idx=paneKeys.indexOf(key),band=0.30/Math.max(1,paneN);return {top:0.70+idx*band+0.006,bottom:(paneN-1-idx)*band+0.02};}
    function pscale(id,key){try{w.chart.priceScale(id).applyOptions({scaleMargins:pm(key)});}catch(e){}}
    if(!bars.length){cwLeg(w);return;}
    function addS(opts,data,leg){try{var s=w.chart.addLineSeries(Object.assign({lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false},opts));s.setData(data);w.indSeries.push(s);if(leg){var last=null;for(var i=data.length-1;i>=0;i--){if(data[i]&&data[i].value!=null&&isFinite(data[i].value)){last=data[i].value;break;}}w.legItems.push({label:leg.label,series:s,color:opts.color,dec:leg.dec,last:last});}return s;}catch(e){}}
    function addPL(o){try{w.indLines.push(w.candle.createPriceLine(o));}catch(e){}}
    if(w.inds.sr)computeSR(bars).forEach(function(L){addPL({price:L.price,color:L.type==='r'?'#ff9f4d':'#3ad29a',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:L.type==='r'?'R':'S'});});
    if(w.inds.ema){var c=closes(bars);(w.emaList||(w.emaP?[w.emaP]:[21])).slice(0,3).forEach(function(p,i){addS({color:['#c2f64a','#86e05a','#4fb36a'][i]||'#c2f64a',lineWidth:2},mapVal(bars,ema(c,p)),{label:'EMA '+p,dec:null});});}
    if(w.inds.sma){var c2=closes(bars);(w.smaList||(w.smaP?[w.smaP]:[50])).slice(0,3).forEach(function(p,i){addS({color:['#ffb347','#ff8c42','#e0662a'][i]||'#ffb347',lineWidth:2},mapVal(bars,sma(c2,p)),{label:'SMA '+p,dec:null});});}
    if(w.inds.bb){var bb=bollinger(bars,20,2);addS({color:'rgba(127,174,255,.85)'},bb.up);addS({color:'rgba(127,174,255,.6)',lineStyle:2},bb.mid,{label:'BB',dec:null});addS({color:'rgba(127,174,255,.85)'},bb.low);}
    if(w.inds.vwap)addS({color:'#46e0e6',lineWidth:2},mapVal(bars,vwapW(bars)),{label:'VWAP',dec:null});
    if(w.inds.hma)addS({color:'#ff7bd5',lineWidth:2},mapVal(bars,hmaW(closes(bars),21)),{label:'HMA 21',dec:null});
    if(w.inds.kc){var kcc=closes(bars),kmid=ema(kcc,20),kat=atr(bars,10),kup=[],klo=[],ki;for(ki=0;ki<bars.length;ki++){var okv=isFinite(kmid[ki])&&isFinite(kat[ki]);kup.push(okv?kmid[ki]+2*kat[ki]:NaN);klo.push(okv?kmid[ki]-2*kat[ki]:NaN);}addS({color:'rgba(110,214,180,.8)'},mapVal(bars,kup));addS({color:'rgba(110,214,180,.55)',lineStyle:2},mapVal(bars,kmid),{label:'Keltner',dec:null});addS({color:'rgba(110,214,180,.8)'},mapVal(bars,klo));}
    if(w.inds.dc){var dc=donchian(bars,20);addS({color:'#2ebd85'},dc.up);addS({color:'#ff6258'},dc.low);addS({color:'#5c656f',lineStyle:2},dc.mid,{label:'Donchian',dec:null});}
    if(w.inds.pp)pivotsCalc(bars).forEach(function(p){addPL({price:p.v,color:p.c,lineWidth:1,lineStyle:p.s,axisLabelVisible:true,title:p.k});});
    if(w.inds.rsi){var rv=rsiCalc(closes(bars),14);addS({color:'#e0a0ff',priceScaleId:'rsi'},mapVal(bars,rv),{label:'RSI 14',dec:0});addS({color:'rgba(255,98,88,.35)',lineStyle:2,priceScaleId:'rsi'},bars.map(function(b){return {time:b.time,value:70};}));addS({color:'rgba(46,189,133,.35)',lineStyle:2,priceScaleId:'rsi'},bars.map(function(b){return {time:b.time,value:30};}));pscale('rsi','rsi');}
    if(w.inds.macd){var mc=macdCalc(closes(bars));addS({color:'#3fd8e6',lineWidth:1.4,priceScaleId:'macd'},mapVal(bars,mc.macd),{label:'MACD',dec:null});addS({color:'#ff9f4d',priceScaleId:'macd'},mapVal(bars,mc.signal),{label:'Signal',dec:null});addS({color:'rgba(120,130,140,.4)',lineStyle:2,priceScaleId:'macd'},bars.map(function(b){return {time:b.time,value:0};}));pscale('macd','macd');}
    if(w.inds.stoch){var sto=stoch(bars,14,3);addS({color:'#c2f64a',priceScaleId:'stoch'},mapVal(bars,sto.k),{label:'Stoch %K',dec:0});addS({color:'#ff6258',priceScaleId:'stoch'},mapVal(bars,sto.d),{label:'%D',dec:0});addS({color:'rgba(255,159,77,.3)',lineStyle:2,priceScaleId:'stoch'},bars.map(function(b){return {time:b.time,value:80};}));addS({color:'rgba(46,189,133,.3)',lineStyle:2,priceScaleId:'stoch'},bars.map(function(b){return {time:b.time,value:20};}));pscale('stoch','stoch');}
    if(w.inds.atr){var av=atr(bars,14);addS({color:'#ffb347',priceScaleId:'atr'},mapVal(bars,av),{label:'ATR 14',dec:null});pscale('atr','atr');}
    if(w.inds.wr){addS({color:'#ffd75a',priceScaleId:'wr'},mapVal(bars,willrW(bars,14)),{label:'%R 14',dec:0});addS({color:'rgba(255,98,88,.3)',lineStyle:2,priceScaleId:'wr'},bars.map(function(b){return {time:b.time,value:-20};}));addS({color:'rgba(46,189,133,.3)',lineStyle:2,priceScaleId:'wr'},bars.map(function(b){return {time:b.time,value:-80};}));pscale('wr','wr');}
    if(w.inds.cci){addS({color:'#7fb6ff',priceScaleId:'cci'},mapVal(bars,cciW(bars,20)),{label:'CCI 20',dec:0});addS({color:'rgba(255,98,88,.25)',lineStyle:2,priceScaleId:'cci'},bars.map(function(b){return {time:b.time,value:100};}));addS({color:'rgba(46,189,133,.25)',lineStyle:2,priceScaleId:'cci'},bars.map(function(b){return {time:b.time,value:-100};}));addS({color:'rgba(120,130,140,.35)',lineStyle:2,priceScaleId:'cci'},bars.map(function(b){return {time:b.time,value:0};}));pscale('cci','cci');}
    if(w.inds.vol){var vhs;try{vhs=w.chart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'vol',lastValueVisible:false,priceLineVisible:false});}catch(e){}
      if(vhs){var vhd=[];for(var vhi=0;vhi<bars.length;vhi++){var vhb=bars[vhi],vhv=+vhb.vol;if(isFinite(vhv)&&vhv>0)vhd.push({time:vhb.time,value:vhv,color:(+vhb.close>=+vhb.open)?'rgba(46,189,133,.45)':'rgba(255,98,88,.45)'});}try{vhs.setData(vhd);}catch(e){}w.indSeries.push(vhs);}
      pscale('vol','vol');}
    cwLeg(w);
  }
  function showSkel(w,on){var s=w.el&&w.el.querySelector('.cwin-skel');if(!s)return;if(on){if(w._skelT)return;w._skelT=setTimeout(function(){w._skelT=null;s.style.display='';},220);}else{if(w._skelT){clearTimeout(w._skelT);w._skelT=null;}s.style.display='none';}} // delay the skeleton → fast cached switches feel instant (no blink)
  /* import the user's open paper-trade positions onto a window as entry/liq/TP/SL lines */
  function hasTrades(sym){try{return jload().some(function(e){return e.status==='open'&&e.sym===sym;});}catch(e){return false;}}
  function updateMTBtn(w){var b=w.el&&w.el.querySelector('.cwin-mt');if(!b)return;b.hidden=!hasTrades(w.sym);b.classList.toggle('on',!!w.mtOn);}
  /* keep imported trade lines in sync with the journal: when a position is opened/closed, redraw (a closed trade's entry/liq/TP/SL lines must disappear). Signature-gated so price-only updates don't churn. */
  var _ctSig='';
  function chartsTradeRefresh(){var sig='';try{jload().forEach(function(e){sig+=e.sym+'|'+e.status+'|'+e.side+'|'+e.entry+';';});}catch(e){}if(sig===_ctSig)return;_ctSig=sig;for(var i=0;i<wins.length;i++){var w=wins[i];if(w&&!w.dead&&w.candle){updateMTBtn(w);if(w.mtOn)try{importTrades(w);}catch(e){}}}}
  (function(){var orig=window.mpJournalRender;window.mpJournalRender=function(){if(orig)try{orig.apply(this,arguments);}catch(e){}try{chartsTradeRefresh();}catch(e){}};})();
  function importTrades(w){ if(!w.candle)return;
    (w.mtLines||[]).forEach(function(l){try{w.candle.removePriceLine(l);}catch(e){}});w.mtLines=[];
    if(w.mtOn){ jload().filter(function(e){return e.status==='open'&&e.sym===w.sym;}).forEach(function(e){var long=e.side!=='short';
      try{w.mtLines.push(w.candle.createPriceLine({price:e.entry,color:long?'#2ebd85':'#ff6258',lineWidth:2,lineStyle:0,axisLabelVisible:true,title:(long?'LONG':'SHORT')+' '+(e.lev||1)+'x'}));}catch(_){}
      if(e.liq)try{w.mtLines.push(w.candle.createPriceLine({price:e.liq,color:'#ff3b3b',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'LIQ'}));}catch(_){}
      if(e.tp!=null)try{w.mtLines.push(w.candle.createPriceLine({price:e.tp,color:'#9aa3ad',lineWidth:1,lineStyle:3,axisLabelVisible:true,title:'TP'}));}catch(_){}
      if(e.stop!=null)try{w.mtLines.push(w.candle.createPriceLine({price:e.stop,color:'#9aa3ad',lineWidth:1,lineStyle:3,axisLabelVisible:true,title:'SL'}));}catch(_){}
    }); }
    updateMTBtn(w); }
  /* notes pinned to a window (drag a note onto a chart to pin it; per-window Notes button) */
  var winSeq=0;
  function winById(id){for(var i=0;i<wins.length;i++)if(wins[i].id===id)return wins[i];return null;}
  function notesFor(w){return notes.filter(function(n){return n.winId===w.id;});}
  function updateNotesBtn(w){var b=w.el&&w.el.querySelector('.cwin-notes-btn');if(!b)return;var arr=notesFor(w);b.hidden=arr.length===0;var k=Math.min(arr.length,5);/* one pinned note = one icon, up to 5 (overlapping stack) */var ic='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10l6-6V5a2 2 0 0 0-2-2z"/><path d="M15 21v-6h6"/></svg>';var h='';for(var i=0;i<k;i++)h+='<span style="display:inline-flex;'+(i?'margin-left:-4px':'')+'">'+ic+'</span>';b.innerHTML=h;b.title=arr.length+' note'+(arr.length===1?'':'s')+' pinned here'+(arr.length>5?' (showing 5)':'');}
  var winNotesEl=null,winNotesW=null;
  function renderWinNotes(){var arr=notesFor(winNotesW);winNotesEl.innerHTML='<div class="cwin-ind-menu-h">Notes pinned to this chart</div>'+(arr.length?('<div class="cwin-ind-menu-list">'+arr.map(function(n,i){var vis=n.el.style.display!=='none';return '<div class="cws-lay-item"><button type="button" class="cws-lay-open" data-noteidx="'+i+'" style="color:'+(n.color||'#e9e7df')+'">'+escHtml((n.text||'(empty note)').slice(0,42))+(vis?' <small>open</small>':'')+'</button><button type="button" class="cws-lay-del" data-unpin="'+i+'" title="Unpin (float again)">&#10548;</button></div>';}).join('')+'</div>'):'<div class="cws-lay-empty">No notes pinned here yet. Make a note, then drag it onto this window to pin it.</div>');}
  function buildWinNotes(){winNotesEl=el('<div class="cwin-ind-menu cws-notes-menu" hidden></div>');document.body.appendChild(winNotesEl);
    winNotesEl.addEventListener('pointerdown',function(e){e.stopPropagation();});
    winNotesEl.addEventListener('click',function(e){if(!winNotesW)return;var arr=notesFor(winNotesW),un=e.target.closest('[data-unpin]'),op=e.target.closest('[data-noteidx]');
      if(un){var n=arr[+un.getAttribute('data-unpin')];if(n){n.winId=null;n.el.style.display='';n.el.style.left=((parseInt(winNotesW.el.style.left,10)||0)+24)+'px';n.el.style.top=((parseInt(winNotesW.el.style.top,10)||0)+46)+'px';n.el.style.zIndex=++zTop;saveNotes();updateNotesBtn(winNotesW);renderWinNotes();}return;}
      if(op){var nn=arr[+op.getAttribute('data-noteidx')];if(nn){var vis=nn.el.style.display!=='none';if(vis)nn.el.style.display='none';else{nn.el.style.display='';nn.el.style.left=((parseInt(winNotesW.el.style.left,10)||0)+24)+'px';nn.el.style.top=((parseInt(winNotesW.el.style.top,10)||0)+46)+'px';nn.el.style.zIndex=++zTop;}renderWinNotes();}}});
    document.addEventListener('pointerdown',function(e){if(winNotesEl&&!winNotesEl.hidden&&!(e.target.closest&&(e.target.closest('.cws-notes-menu')||e.target.closest('.cwin-notes-btn'))))winNotesEl.hidden=true;},true);
    window.addEventListener('scroll',function(){if(winNotesEl)winNotesEl.hidden=true;},true);}
  function openWinNotes(w,btn){if(!winNotesEl)buildWinNotes();winNotesW=w;renderWinNotes();winNotesEl.hidden=false;var r=btn.getBoundingClientRect(),mw=winNotesEl.offsetWidth||240,mh=winNotesEl.offsetHeight||180;var left=Math.min(r.left,window.innerWidth-mw-8),top=r.bottom+6;if(top+mh>window.innerHeight-8)top=Math.max(8,r.top-mh-6);winNotesEl.style.left=Math.max(8,left)+'px';winNotesEl.style.top=top+'px';}
  /* shared Indicators dropdown — one element on <body>, fixed-positioned (never clipped by the window) */
  var indMenuEl=null,indMenuW=null;
  function updateIndN(w){if(!w.el)return;var btn=w.el.querySelector('.cwin-ind-btn'),el=w.el.querySelector('.cwin-ind-n');if(!btn)return;var n=0;for(var k in w.inds)if(w.inds[k])n++;if(el)el.textContent=n?String(n):'';btn.classList.toggle('active',n>0);}
  function buildIndMenu(){
    indMenuEl=el('<div class="cwin-ind-menu" hidden><div class="cwin-ind-menu-h">Indicators</div><div class="cwin-ind-menu-list">'+INDS.map(function(t){var sel='';if(t[0]==='ema')sel='<span class="cwin-ind-pers" data-p="ema" title="Pick up to 3 EMA lengths">'+[9,21,50,100,200].map(function(p){return '<b data-pp="'+p+'">'+p+'</b>';}).join('')+'</span>';else if(t[0]==='sma')sel='<span class="cwin-ind-pers" data-p="sma" title="Pick up to 3 SMA lengths">'+[10,20,50,100,200].map(function(p){return '<b data-pp="'+p+'">'+p+'</b>';}).join('')+'</span>';return '<button type="button" class="cwin-ind-item" data-ind="'+t[0]+'" title="'+(ITIPS[t[0]]||'').replace(/"/g,'&quot;')+'"><span class="cwin-ind-ck"></span><span class="cwin-ind-it-lbl">'+t[1]+'</span>'+sel+'</button>';}).join('')+'</div></div>');
    document.body.appendChild(indMenuEl);
    indMenuEl.addEventListener('pointerdown',function(e){e.stopPropagation();});
    indMenuEl.addEventListener('click',function(e){
      var per=e.target.closest&&e.target.closest('.cwin-ind-pers b[data-pp]');
      if(per&&indMenuW){var row=per.parentNode,pk=row.getAttribute('data-p'),pp=+per.getAttribute('data-pp');var list=pk==='ema'?(indMenuW.emaList=indMenuW.emaList||(indMenuW.emaP?[indMenuW.emaP]:[21])):(indMenuW.smaList=indMenuW.smaList||(indMenuW.smaP?[indMenuW.smaP]:[50]));var ix=list.indexOf(pp);if(ix>=0){if(list.length>1)list.splice(ix,1);}else{if(list.length>=3)list.shift();list.push(pp);}list.sort(function(a,b){return a-b;});Array.prototype.forEach.call(row.querySelectorAll('b'),function(x){x.classList.toggle('on',list.indexOf(+x.getAttribute('data-pp'))>=0);});if(!indMenuW.inds[pk]){indMenuW.inds[pk]=true;var itm=indMenuEl.querySelector('.cwin-ind-item[data-ind="'+pk+'"]');if(itm)itm.classList.add('on');}applyInds(indMenuW);updateIndN(indMenuW);savePersist();return;}
      var b=e.target.closest&&e.target.closest('.cwin-ind-item');if(!b||!indMenuW)return;var k=b.getAttribute('data-ind');indMenuW.inds[k]=!indMenuW.inds[k];b.classList.toggle('on',!!indMenuW.inds[k]);applyInds(indMenuW);updateIndN(indMenuW);savePersist();
    });
    document.addEventListener('pointerdown',function(e){if(indMenuEl&&!indMenuEl.hidden&&!(e.target.closest&&(e.target.closest('.cwin-ind-menu')||e.target.closest('.cwin-ind-btn'))))indMenuEl.hidden=true;},true);
    window.addEventListener('scroll',function(e){if(indMenuEl&&!indMenuEl.hidden&&!(e.target&&e.target.closest&&e.target.closest('.cwin-ind-menu')))indMenuEl.hidden=true;},true);/* scrolling inside the indicator list must not close it */
  }
  function openIndMenu(w,btn){
    if(!indMenuEl)buildIndMenu();
    if(indMenuW===w&&!indMenuEl.hidden){indMenuEl.hidden=true;return;}
    indMenuW=w;
    Array.prototype.forEach.call(indMenuEl.querySelectorAll('.cwin-ind-item'),function(it){it.classList.toggle('on',!!w.inds[it.getAttribute('data-ind')]);});
    Array.prototype.forEach.call(indMenuEl.querySelectorAll('.cwin-ind-pers'),function(row){var pk=row.getAttribute('data-p'),list=(pk==='ema'?(w.emaList||(w.emaP?[w.emaP]:[21])):(w.smaList||(w.smaP?[w.smaP]:[50])));Array.prototype.forEach.call(row.querySelectorAll('b'),function(x){x.classList.toggle('on',list.indexOf(+x.getAttribute('data-pp'))>=0);});});
    indMenuEl.hidden=false;
    var r=btn.getBoundingClientRect(),mw=indMenuEl.offsetWidth||210,mh=indMenuEl.offsetHeight||280;
    var left=Math.min(r.left,window.innerWidth-mw-8),top=r.bottom+6; if(top+mh>window.innerHeight-8)top=Math.max(8,r.top-mh-6);
    indMenuEl.style.left=Math.max(8,left)+'px';indMenuEl.style.top=top+'px';
  }
  function chartToast(msg){var t=document.createElement('div');t.textContent=msg;t.style.cssText='position:fixed;left:50%;bottom:88px;transform:translateX(-50%) translateY(18px);z-index:130;background:#11151b;color:#e9e7df;border:1px solid #2f3742;border-left:3px solid #ffb347;border-radius:12px;padding:12px 16px;font-size:13.5px;line-height:1.4;max-width:90vw;box-shadow:0 12px 34px rgba(0,0,0,.5);opacity:0;transition:.3s;text-align:center;';document.body.appendChild(t);requestAnimationFrame(function(){t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';});setTimeout(function(){t.style.opacity='0';t.style.transform='translateX(-50%) translateY(18px)';setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},350);},4200);}
  /* ---- Ask AI about this chart — multi-turn, streamed, history kept, glued to the window ---- */
  var aiEl=null,aiW=null,aiBusy=false,aiRaf=0,aiLastL=null,aiLastT=null,aiLimit=10,aiOffX=8,aiOffY=0,aiDragging=false;
  function tfWords(tf){return {'15':'15-minute','60':'1-hour','240':'4-hour','1440':'daily'}[tf]||tfLabel(tf);}
  function _p6(x){return (x!=null&&isFinite(x))?+(+x).toPrecision(6):null;}
  function _last(a){for(var i=a.length-1;i>=0;i--)if(isFinite(a[i]))return a[i];return null;}
  function _relPct(price,lvl){return (lvl&&isFinite(lvl)&&price)?+(((price-lvl)/lvl)*100).toFixed(2):null;}
  /* Build a rich, pre-computed technical brief of the window so the AI reasons over real numbers (computed regardless of which indicators the user has toggled). */
  function aiContext(w){
    var bars=w.bars||[],n=bars.length,last=bars[n-1]||{},price=last.close;
    if(n<10||!(price>0))return {symbol:w.sym,timeframe:tfWords(w.tf),price:price||null,note:'Only '+n+' candles loaded — limited read.'};
    var c=closes(bars);
    var win=bars.slice(-150),wf=win[0],chgWin=(wf&&wf.close)?+(((price-wf.close)/wf.close)*100).toFixed(2):null;
    var prev=bars[n-2]||{},chgBar=(prev.close)?+(((price-prev.close)/prev.close)*100).toFixed(2):null;
    // swing high / low over the last ~90 bars (with how many bars ago)
    var seg=bars.slice(-90),sh=-Infinity,sl=Infinity,shAgo=0,slAgo=0;
    seg.forEach(function(b,i){if(b.high>sh){sh=b.high;shAgo=seg.length-1-i;}if(b.low<sl){sl=b.low;slAgo=seg.length-1-i;}});
    // moving averages + price position
    var e9=_last(ema(c,9)),e21=_last(ema(c,21)),e50=_last(ema(c,50)),e200=_last(ema(c,200)),s50=_last(sma(c,50)),s200=_last(sma(c,200));
    var e50arr=ema(c,50),e50slope=(e50arr.length>6)?(e50arr[e50arr.length-1]-e50arr[e50arr.length-6]):0;
    // RSI + slope
    var rA=rsiCalc(c,14),rsi=_last(rA),rsiPrev=rA.length>4?rA[rA.length-4]:null,rsiState=rsi==null?null:(rsi>=70?'overbought':rsi<=30?'oversold':rsi>=55?'bullish':rsi<=45?'bearish':'neutral');
    // MACD
    var mc=macdCalc(c),macd=_last(mc.macd),msig=_last(mc.signal),mhist=_last(mc.hist),mhistPrev=mc.hist.length>2?mc.hist[mc.hist.length-2]:null;
    // ATR (volatility) %
    var atrv=_last(atr(bars,14)),atrPct=(atrv&&price)?+((atrv/price)*100).toFixed(2):null;
    // Bollinger(20,2): %B + bandwidth
    var bbPctB=null,bbWidth=null;if(c.length>=20){var p=20,m=0,i2;for(i2=c.length-p;i2<c.length;i2++)m+=c[i2];m/=p;var sd=0;for(i2=c.length-p;i2<c.length;i2++){var dd=c[i2]-m;sd+=dd*dd;}sd=Math.sqrt(sd/p);var bu=m+2*sd,bl=m-2*sd;bbPctB=(bu>bl)?+(((price-bl)/(bu-bl))*100).toFixed(0):null;bbWidth=m?+(((bu-bl)/m)*100).toFixed(2):null;}
    // loaded range + position within it
    var lh=-Infinity,ll=Infinity;bars.forEach(function(b){if(b.high>lh)lh=b.high;if(b.low<ll)ll=b.low;});
    var rangePos=(lh>ll)?+(((price-ll)/(lh-ll))*100).toFixed(0):null;
    // downsampled recent path (so the model sees the trajectory)
    var rc=c.slice(-24).map(_p6);
    // open paper-trade position on this symbol
    var pos=null;if(w.mtOn){try{var j=jload();for(var i=0;i<j.length;i++){var e=j[i];if(e.status==='open'&&e.sym===w.sym){var dir=e.side==='short'?-1:1,liq=e.liq?+e.liq:null,lev=+e.lev||1;pos={side:e.side==='short'?'short':'long',entry:_p6(+e.entry),leverage:lev,liq:_p6(liq),pnlPctRoe:+(((price-e.entry)/e.entry)*100*lev*dir).toFixed(1),distanceToLiqPct:liq?+(((price-liq)/price)*100*dir).toFixed(2):null};break;}}}catch(e){}}/* only let the AI see a position if the user actually imported it onto THIS chart (mtOn) — otherwise it must not assume any position */
    var indsOn=[];for(var k in w.inds){if(w.inds[k])indsOn.push(k);}
    return {
      symbol:w.sym, timeframe:tfWords(w.tf), barsLoaded:n,
      price:_p6(price), lastBarChangePct:chgBar, changePctOver150Bars:chgWin,
      loadedHigh:_p6(lh), loadedLow:_p6(ll), positionWithinRangePct:rangePos,
      recentSwingHigh:_p6(sh), swingHighBarsAgo:shAgo, distToSwingHighPct:_relPct(price,sh),
      recentSwingLow:_p6(sl), swingLowBarsAgo:slAgo, distToSwingLowPct:_relPct(price,sl),
      movingAverages:{ema9:_p6(e9),ema21:_p6(e21),ema50:_p6(e50),ema200:_p6(e200),sma50:_p6(s50),sma200:_p6(s200),
        priceVsEma50Pct:_relPct(price,e50),priceVsEma200Pct:_relPct(price,e200),
        ema50Trend:e50slope>0?'rising':e50slope<0?'falling':'flat',
        structure:(e50!=null&&e200!=null)?(e50>e200?'ema50 above ema200 (bullish)':'ema50 below ema200 (bearish)'):null},
      rsi14:rsi!=null?+rsi.toFixed(1):null, rsiState:rsiState, rsiSlope:(rsi!=null&&rsiPrev!=null)?(rsi>rsiPrev?'rising':rsi<rsiPrev?'falling':'flat'):null,
      macd:{line:_p6(macd),signal:_p6(msig),histogram:_p6(mhist),position:(macd!=null&&msig!=null)?(macd>msig?'above signal (bullish)':'below signal (bearish)'):null,momentum:(mhist!=null&&mhistPrev!=null)?(Math.abs(mhist)>Math.abs(mhistPrev)?'expanding':'contracting'):null},
      atrPct:atrPct, bollingerPercentB:bbPctB, bollingerBandwidthPct:bbWidth,
      indicatorsUserHasOn:indsOn, recentCloses:rc, openPosition:pos
    };
  }
  function aiSetQuota(used,limit){var q=aiEl&&aiEl.querySelector('.cwin-ai-quota');if(q&&used!=null){q.textContent=used+' / '+limit+' today';q.classList.toggle('low',(limit-used)<=2);}if(limit)aiLimit=limit;}
  function aiHistKey(w){return 'mp_ai_'+(w.id||w.sym);}
  function aiHistLoad(w){try{var a=JSON.parse(localStorage.getItem(aiHistKey(w))||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}}
  function aiHistSave(w,arr){try{if(arr.length>40)arr=arr.slice(-40);localStorage.setItem(aiHistKey(w),JSON.stringify(arr));}catch(e){}}
  function mdLite(t){t=escHtml(String(t||''));t=t.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>');t=t.replace(/`([^`]+)`/g,'<code>$1</code>');t=t.replace(/(^|\n)\s*[-*•]\s+/g,'$1• ');t=t.replace(/\n{2,}/g,'<br><br>').replace(/\n/g,'<br>');return t;}
  var COPY_SVG='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  /* split a trade-plan JSON block (```plan {...}```) off the prose so it never shows as raw text, and parse it for the "Add to chart" button */
  function _aiPlanOk(p){return p&&typeof p==='object'&&(p.entry||p.stop||p.bias||(p.levels&&p.levels.length)||(p.targets&&p.targets.length));}
  /* Pull a trade-plan JSON block off the prose. Robust to ```plan, ```json or a plain ``` fence — and to the closing fence not having streamed in yet. */
  function aiSplitPlan(text){text=String(text||'');
    var re=/```[a-zA-Z]*\s*([\s\S]*?)```/g,m,plan=null,idx=-1;
    while((m=re.exec(text))){var b=m[1].trim();if(b.charAt(0)==='{'){try{var p=JSON.parse(b);if(_aiPlanOk(p)){plan=p;idx=m.index;}}catch(e){}}}
    if(plan!=null)return {prose:text.slice(0,idx).replace(/\s+$/,''),plan:plan};
    var oi=text.search(/```[a-zA-Z]*\s*\{/);if(oi>=0&&text.indexOf('```',oi+3)<0)return {prose:text.slice(0,oi).replace(/\s+$/,''),plan:null};/* opening fence streaming in — hide the partial JSON */
    return {prose:text,plan:null};}
  function aiAiInner(m){var h='<div class="aitxt">'+mdLite(m.text)+'</div>';if(m.plan)h+='<button class="aiplan" type="button" data-plan="'+escAttr(JSON.stringify(m.plan))+'"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/></svg><span>Draw this plan on the chart</span></button>';h+='<button class="aicopy" type="button" title="Copy">'+COPY_SVG+'</button>';return h;}
  function aiBubble(m){return m.role==='user'?('<div class="aimsg user">'+escHtml(m.text)+'</div>'):('<div class="aimsg ai">'+aiAiInner(m)+'</div>');}
  function aiClearPlan(w){if(w&&w._aiPlan){w._aiPlan.forEach(function(l){try{w.candle.removePriceLine(l);}catch(e){}});w._aiPlan=null;}}
  function aiDrawPlan(w,plan){
    if(!w||!w.candle||!plan)return;aiClearPlan(w);w._aiPlan=[];
    function pl(price,color,title,style,width){price=+price;if(!(price>0))return;try{w._aiPlan.push(w.candle.createPriceLine({price:price,color:color,lineWidth:width||1,lineStyle:style==null?2:style,axisLabelVisible:true,title:title}));}catch(e){}}
    if(plan.entry)pl(plan.entry,'#3fd8e6','AI ENTRY',0,2);
    if(plan.stop)pl(plan.stop,'#ff5a4d','AI STOP',2,2);
    (plan.targets||[]).forEach(function(t,i){pl(t,'#2ebd85','AI TP'+(i+1),2,1);});
    (plan.levels||[]).forEach(function(l){if(l)pl(l.price,'#8a93a0',String(l.label||'AI').slice(0,16),3,1);});
    chartToast('AI plan drawn on '+w.sym+' — '+(plan.bias?plan.bias.toUpperCase()+' setup. ':'')+'Change symbol/timeframe to clear.');
  }
  function aiRenderBody(w){var body=aiEl&&aiEl.querySelector('.cwin-ai-body');if(!body)return;var arr=aiHistLoad(w);if(!arr.length){body.innerHTML='<div class="aimsg-empty"><b>New here? Just tap “Read this chart for me”.</b><br>I’ll explain in plain words what this '+escHtml(w.sym+' '+tfLabel(w.tf))+' chart is doing and whether it looks better for a long or a short — no jargon. Ask follow-ups any time.<br><button class="cwin-ai-chip" data-q="" style="margin-top:11px">Read this chart for me</button></div>';return;}body.innerHTML=arr.map(aiBubble).join('');body.scrollTop=body.scrollHeight;}
  function aiSetChips(w){var box=aiEl&&aiEl.querySelector('.cwin-ai-chips');if(!box)return;var chips=[['','Quick read'],['What is the trend and momentum here?','Trend'],['Where are the key support and resistance levels?','Levels'],['What would confirm or invalidate this setup?','What to watch']];var hasPos=false;try{hasPos=jload().some(function(e){return e.status==='open'&&e.sym===w.sym;});}catch(e){}if(hasPos)chips.push(['How risky is my open position on this chart right now?','My position']);box.innerHTML=chips.map(function(c){return '<button class="cwin-ai-chip" data-q="'+escAttr(c[0])+'">'+escHtml(c[1])+'</button>';}).join('');}
  function aiShowGate(){if(!aiEl)return;aiEl.classList.add('gated');var body=aiEl.querySelector('.cwin-ai-body');body.innerHTML='<div class="cwin-ai-gate">Sign in (free — just an email code) to ask AI about your charts.<br>You get <b>'+aiLimit+' questions a day</b>.<br><button class="g-btn" type="button">Sign in free</button></div>';var g=body.querySelector('.g-btn');if(g)g.addEventListener('click',function(){try{if(window.mpAuth&&window.mpAuth.open)window.mpAuth.open();}catch(e){}});}
  function aiClose(){if(aiEl)aiEl.hidden=true;if(aiRaf){cancelAnimationFrame(aiRaf);aiRaf=0;}}
  /* The panel stays attached to its chart window via an offset (aiOffX/aiOffY from the window's top-right) — so it moves WITH the window on drag/scroll, but the user can freely drag it anywhere (which just updates the offset). */
  function aiFollow(){
    if(!aiEl||aiEl.hidden||!aiW||!aiW.el||aiW.dead){aiRaf=0;if(aiW&&aiW.dead)aiClose();return;}
    if(!aiDragging){
      var r=aiW.el.getBoundingClientRect(),pw=aiEl.offsetWidth||360,ph=aiEl.offsetHeight||440,vw=window.innerWidth,vh=window.innerHeight;
      var left=Math.max(6,Math.min(r.right+aiOffX,vw-pw-6)),top=Math.max(6,Math.min(r.top+aiOffY,vh-ph-6));
      if(left!==aiLastL||top!==aiLastT){aiEl.style.left=left+'px';aiEl.style.top=top+'px';aiLastL=left;aiLastT=top;}
    }
    aiRaf=requestAnimationFrame(aiFollow);
  }
  function aiDragStart(e){
    if(e.target.closest&&e.target.closest('button'))return; // header buttons keep working
    aiDragging=true;var sx=e.clientX,sy=e.clientY,sl=parseFloat(aiEl.style.left)||0,st=parseFloat(aiEl.style.top)||0;
    function mv(ev){var pw=aiEl.offsetWidth,ph=aiEl.offsetHeight;var nl=Math.max(6,Math.min(sl+(ev.clientX-sx),window.innerWidth-pw-6)),nt=Math.max(6,Math.min(st+(ev.clientY-sy),window.innerHeight-ph-6));aiEl.style.left=nl+'px';aiEl.style.top=nt+'px';aiLastL=nl;aiLastT=nt;if(aiW&&aiW.el){var r=aiW.el.getBoundingClientRect();aiOffX=nl-r.right;aiOffY=nt-r.top;}}
    function up(){aiDragging=false;document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);}
    document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);e.preventDefault();
  }
  function aiBuild(){
    aiEl=el('<div class="cwin-ai-panel" hidden><div class="cwin-ai-h"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#7fb6ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.7 4.5L18 9l-4.3 1.5L12 15l-1.7-4.5L6 9l4.3-1.5z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/></svg><b>Ask AI</b><span class="cwin-ai-sym"></span><span class="cwin-ai-quota"></span><button class="cwin-ai-clear" type="button" title="Clear this chat" aria-label="Clear chat"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button><button class="cwin-ai-x" type="button" aria-label="Close">&#10005;</button></div><div class="cwin-ai-body"></div><div class="cwin-ai-chips"><button class="cwin-ai-chip" data-q="">Quick read</button><button class="cwin-ai-chip" data-q="What is the trend and momentum here?">Trend</button><button class="cwin-ai-chip" data-q="Where are the key support and resistance levels?">Levels</button><button class="cwin-ai-chip" data-q="What would confirm or invalidate this setup?">What to watch</button></div><div class="cwin-ai-in"><input type="text" placeholder="Ask about this chart…" maxlength="280"><button class="cwin-ai-send" type="button" aria-label="Send"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg></button></div><div class="cwin-ai-note">Reads the live chart each time · AI can be wrong · not financial advice</div></div>');
    document.body.appendChild(aiEl);
    aiEl.querySelector('.cwin-ai-x').addEventListener('click',aiClose);
    aiEl.querySelector('.cwin-ai-clear').addEventListener('click',function(){if(aiW&&confirm('Clear this chart’s AI chat history?')){aiHistSave(aiW,[]);aiRenderBody(aiW);}});
    var inp=aiEl.querySelector('.cwin-ai-in input');
    aiEl.querySelector('.cwin-ai-send').addEventListener('click',function(){askAi(inp.value);});
    inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();askAi(inp.value);}});
    aiEl.querySelector('.cwin-ai-chips').addEventListener('click',function(e){var c=e.target.closest&&e.target.closest('.cwin-ai-chip');if(c)askAi(c.getAttribute('data-q'));});
    aiEl.querySelector('.cwin-ai-body').addEventListener('click',function(e){
      var ch=e.target.closest&&e.target.closest('.cwin-ai-chip');if(ch){askAi(ch.getAttribute('data-q'));return;}
      var pb=e.target.closest&&e.target.closest('.aiplan');if(pb){var pj=pb.getAttribute('data-plan');try{aiDrawPlan(aiW,JSON.parse(pj));pb.classList.add('done');var sp=pb.querySelector('span');if(sp)sp.textContent='On chart ✓';}catch(_){}return;}
      var b=e.target.closest&&e.target.closest('.aicopy');if(!b)return;var t=b.parentNode.querySelector('.aitxt');if(t&&navigator.clipboard){navigator.clipboard.writeText(t.innerText||t.textContent||'').then(function(){var o=b.innerHTML;b.textContent='✓';setTimeout(function(){b.innerHTML=o;},1200);}).catch(function(){});}
    });
    aiEl.querySelector('.cwin-ai-h').addEventListener('pointerdown',aiDragStart);
    document.addEventListener('pointerdown',function(e){if(aiEl&&!aiEl.hidden&&!(e.target.closest&&(e.target.closest('.cwin-ai-panel')||e.target.closest('.cwin-ai'))))aiClose();},true);
  }
  function askAi(question){
    if(aiBusy||!aiW||!aiEl)return;
    var me=(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me())||null;
    if(!me){aiShowGate();return;}
    var w=aiW,q=String(question||'').trim();if(!q)q='Give me a sharp, practical read on this chart right now.';
    var hist=aiHistLoad(w);hist.push({role:'user',text:q,ts:Date.now()});aiHistSave(w,hist);
    var payloadHist=hist.slice(0,-1).map(function(m){return {role:m.role==='user'?'user':'assistant',text:m.text};});
    aiBusy=true;aiRenderBody(w);
    var inp=aiEl.querySelector('.cwin-ai-in input');if(inp)inp.value='';
    var body=aiEl.querySelector('.cwin-ai-body');
    var bub=document.createElement('div');bub.className='aimsg ai streaming';bub.innerHTML='<span class="aitype"><i></i><i></i><i></i></span>';body.appendChild(bub);body.scrollTop=body.scrollHeight;
    var acc='',got=false;
    function fail(msg){aiBusy=false;bub.classList.remove('streaming');bub.innerHTML='<span style="color:#ff8a80">'+escHtml(msg)+'</span>';}
    fetch('/api/ai/chart',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({context:aiContext(w),question:q,history:payloadHist,stream:true,lang:(window.mpLang||document.documentElement.lang||'en')})}).then(function(resp){
      if(!resp.ok){resp.json().then(function(d){aiBusy=false;if(resp.status===401){bub.remove();aiShowGate();}else if(resp.status===429){fail('You’ve used all '+((d&&d.limit)||aiLimit)+' AI questions today — resets tomorrow.');aiSetQuota((d&&d.used)||(d&&d.limit)||aiLimit,(d&&d.limit)||aiLimit);}else if(d&&d.error==='ai_unconfigured'){fail('AI is not switched on yet.');}else{fail('Could not reach AI — please try again.');}}).catch(function(){fail('Could not reach AI — please try again.');});return;}
      var u=resp.headers.get('x-ai-used'),l=resp.headers.get('x-ai-limit');if(u)aiSetQuota(+u,+l);
      if(!resp.body||!resp.body.getReader){resp.text().then(function(){fail('Streaming not supported here.');});return;}
      var reader=resp.body.getReader(),dec=new TextDecoder(),buf='';
      function atBottom(){return (body.scrollHeight-body.scrollTop-body.clientHeight)<60;} // only auto-scroll if the user is already at the bottom — never yank them down while they read/scroll up
      function finish(){aiBusy=false;bub.classList.remove('streaming');var sp=aiSplitPlan(acc),prose=sp.prose||acc;if(!got||!prose){bub.innerHTML='<span style="color:#ff8a80">No answer came back — try again.</span>';return;}var atB=atBottom();bub.innerHTML=aiAiInner({text:prose,plan:sp.plan});if(atB)body.scrollTop=body.scrollHeight;var h2=aiHistLoad(w);h2.push({role:'ai',text:prose,plan:sp.plan||undefined,ts:Date.now()});aiHistSave(w,h2);}
      function pump(){reader.read().then(function(res){
        if(res.done){finish();return;}
        buf+=dec.decode(res.value,{stream:true});var idx;
        while((idx=buf.indexOf('\n'))>=0){var line=buf.slice(0,idx).replace(/\r$/,'');buf=buf.slice(idx+1);if(line.indexOf('data:')!==0)continue;var data=line.slice(5).trim();if(!data)continue;try{var ev=JSON.parse(data);if(ev.type==='content_block_delta'&&ev.delta&&ev.delta.text){got=true;acc+=ev.delta.text;var atB=atBottom();bub.innerHTML=mdLite(aiSplitPlan(acc).prose);if(atB)body.scrollTop=body.scrollHeight;}}catch(e){}}
        pump();
      }).catch(function(){finish();});}
      pump();
    }).catch(function(){fail('Network error — try again.');});
  }
  function openAiPanel(w,btn){
    if(!aiEl)aiBuild();
    if(aiW===w&&!aiEl.hidden){aiClose();return;}
    aiW=w;aiBusy=false;aiLastL=null;aiLastT=null;
    aiEl.querySelector('.cwin-ai-sym').textContent=w.sym+' · '+tfLabel(w.tf);
    var me=(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me())||null;
    if(!me){aiShowGate();}else{aiEl.classList.remove('gated');aiSetChips(w);aiRenderBody(w);}
    aiEl.hidden=false;
    if(aiRaf)cancelAnimationFrame(aiRaf);aiRaf=requestAnimationFrame(aiFollow);
    if(me)fetch('/api/ai/chart',{method:'GET'}).then(function(r){return r.json();}).then(function(d){if(d&&d.signedIn)aiSetQuota(d.used,d.limit);}).catch(function(){});
  }
  /* Set a price alert straight from the chart — tap a level, it creates a real /api/alerts alert + draws an anchored line */
  // remove an alert's line + cancel it server-side (silent skips the toast / used on failed creates)
  function chAlertDel(w,a,silent){if(!a)return;if(a.pl&&w.candle)try{w.candle.removePriceLine(a.pl);}catch(e){}
    if(w.chAlerts)w.chAlerts=w.chAlerts.filter(function(x){return x!==a;});
    if(a.id)fetch('/api/alerts/delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:a.id})}).catch(function(){});
    if(!silent)chartToast('Alert removed.');}
  function createChartAlert(w,y){
    if(!w.candle)return;var price;try{price=w.candle.coordinateToPrice(y);}catch(e){}
    if(!(price>0))return;
    // clicking on/near an existing alert line REMOVES it instead of stacking another (the way to delete a chart alert)
    if(w.chAlerts&&w.chAlerts.length){for(var i=0;i<w.chAlerts.length;i++){var ex=w.chAlerts[i],ey=null;try{ey=w.candle.priceToCoordinate(ex.price);}catch(e){}if(ey!=null&&Math.abs(ey-y)<=8){chAlertDel(w,ex);return;}}}
    var me=(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me())||null;
    if(!me){chartToast('Sign in (free) to set price alerts.');try{if(window.mpAuth&&window.mpAuth.open)window.mpAuth.open();}catch(e){}return;}
    var cur=(w.lastBar&&+w.lastBar.close)||price,dir=price>=cur?'up':'down';
    var pl=null;try{pl=w.candle.createPriceLine({price:price,color:'#ffb347',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'ALERT '+(dir==='up'?'≥':'≤')});}catch(e){}
    var rec={id:null,price:price,dir:dir,pl:pl};(w.chAlerts=w.chAlerts||[]).push(rec);
    fetch('/api/alerts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sym:w.sym,target:price,dir:dir,channel:'email'})}).then(function(r){return r.json();}).then(function(d){
      if(d&&d.ok){rec.id=d.id;chartToast('🔔 Alert set — '+w.sym+' '+(dir==='up'?'≥':'≤')+' '+cwFmt(price)+' · we’ll email you · click the line to remove');}
      else{chAlertDel(w,rec,true);
        if(d&&d.error==='too_many')chartToast('Too many active alerts (max 25). Remove some on /alerts.');
        else if(d&&d.error==='not_signed_in'){chartToast('Sign in (free) to set price alerts.');try{if(window.mpAuth&&window.mpAuth.open)window.mpAuth.open();}catch(e){}}
        else chartToast('Couldn’t set the alert. Try again.');}
    }).catch(function(){chAlertDel(w,rec,true);chartToast('Network error — alert not set.');});
  }
  /* per-window freehand/line drawing overlay (pixel-space annotations on a glass canvas) */
  function setupDraw(w,bodyEl){
    var body=bodyEl||w.el.querySelector('.cwin-body'), cv=body&&body.querySelector('.cwin-draw');
    if(!body||!cv)return; var ctx=cv.getContext('2d');
    w.dr={on:false,tool:'pen',color:'#3fd8e6',shapes:[],cur:null,W:0,H:0};
    function size(){var r=body.getBoundingClientRect(),dpr=window.devicePixelRatio||1;w.dr.W=r.width;w.dr.H=r.height;cv.width=Math.max(1,Math.round(r.width*dpr));cv.height=Math.max(1,Math.round(r.height*dpr));cv.style.width=r.width+'px';cv.style.height=r.height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);redraw();}
    var FIBLV=[0,0.236,0.382,0.5,0.618,0.786,1];
    // anchor every drawing to (logical bar index, price); project to screen pixels each redraw so it tracks pan/zoom
    function xOf(l){if(l==null||!w.chart)return null;try{var c=w.chart.timeScale().logicalToCoordinate(l);return c==null?null:c;}catch(e){return null;}}
    function yOf(p){if(p==null||!w.candle)return null;try{var c=w.candle.priceToCoordinate(p);return c==null?null:c;}catch(e){return null;}}
    function toL(x){if(!w.chart)return null;try{var l=w.chart.timeScale().coordinateToLogical(x);return l==null?null:l;}catch(e){return null;}}
    function toP(y){if(!w.candle)return null;try{var p=w.candle.coordinateToPrice(y);return p==null?null:p;}catch(e){return null;}}
    function drawFib(s){var y1=yOf(s.p1),y2=yOf(s.p2),x1=xOf(s.l1),x2=xOf(s.l2);if(y1==null||y2==null)return;ctx.save();ctx.lineWidth=1;ctx.font="10px 'Space Mono',monospace";ctx.textBaseline='bottom';
      if(x1!=null&&x2!=null){ctx.strokeStyle=s.color;ctx.globalAlpha=.5;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);}
      for(var i=0;i<FIBLV.length;i++){var L=FIBLV[i],pr=s.p1+(s.p2-s.p1)*L,yy=yOf(pr);if(yy==null)continue;ctx.globalAlpha=(L===0||L===1)?.9:.5;ctx.strokeStyle=s.color;ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(w.dr.W,yy);ctx.stroke();
        ctx.globalAlpha=1;ctx.fillStyle=s.color;ctx.fillText((L*100).toFixed(1)+'%  '+cwFmt(pr),4,yy-2);}
      ctx.restore();}
    function strokeShape(s){if(s.t==='fib'){drawFib(s);return;}ctx.lineWidth=2;ctx.strokeStyle=s.color;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
      if(s.t==='pen'){var p=s.pts;if(!p||!p.length)return;var started=false;for(var i=0;i<p.length;i++){var xx=xOf(p[i].l),yy=yOf(p[i].p);if(xx==null||yy==null)continue;if(!started){ctx.moveTo(xx,yy);started=true;}else ctx.lineTo(xx,yy);}}
      else if(s.t==='trend'){var ax=xOf(s.l1),ay=yOf(s.p1),bx=xOf(s.l2),by=yOf(s.p2);if(ax==null||ay==null||bx==null||by==null)return;ctx.moveTo(ax,ay);ctx.lineTo(bx,by);}
      else if(s.t==='hline'){var hy=yOf(s.p);if(hy==null)return;ctx.moveTo(0,hy);ctx.lineTo(w.dr.W,hy);}
      else if(s.t==='vline'){var vx=xOf(s.l);if(vx==null)return;ctx.moveTo(vx,0);ctx.lineTo(vx,w.dr.H);}
      ctx.stroke();}
    function redraw(){if(!ctx)return;ctx.clearRect(0,0,w.dr.W||0,w.dr.H||0);w.dr.shapes.forEach(strokeShape);if(w.dr.cur)strokeShape(w.dr.cur);}
    w.dr.redraw=redraw;
    function pos(e){var r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
    cv.addEventListener('pointerdown',function(e){if(!w.dr.on)return;e.preventDefault();e.stopPropagation();if(w.el&&w.el.classList.contains('cwin'))bringFront(w);var p=pos(e),tl=w.dr.tool,col=w.dr.color,L=toL(p.x),P=toP(p.y);try{cv.setPointerCapture(e.pointerId);}catch(_){}
      if(tl==='pen')w.dr.cur={t:'pen',color:col,pts:[{l:L,p:P}]};
      else if(tl==='trend')w.dr.cur={t:'trend',color:col,l1:L,p1:P,l2:L,p2:P};
      else if(tl==='fib')w.dr.cur={t:'fib',color:col,l1:L,p1:P,l2:L,p2:P};
      else if(tl==='alert'){createChartAlert(w,p.y);}
      else if(tl==='hline'){w.dr.shapes.push({t:'hline',color:col,p:P});redraw();}
      else if(tl==='vline'){w.dr.shapes.push({t:'vline',color:col,l:L});redraw();}});
    cv.addEventListener('pointermove',function(e){if(!w.dr.on||!w.dr.cur)return;var p=pos(e);if(w.dr.cur.t==='pen')w.dr.cur.pts.push({l:toL(p.x),p:toP(p.y)});else if(w.dr.cur.t==='trend'||w.dr.cur.t==='fib'){w.dr.cur.l2=toL(p.x);w.dr.cur.p2=toP(p.y);}redraw();});
    function endStroke(){if(w.dr.cur){w.dr.shapes.push(w.dr.cur);w.dr.cur=null;redraw();}}
    cv.addEventListener('pointerup',endStroke);cv.addEventListener('pointercancel',endStroke);
    if('ResizeObserver'in window){try{w.dr.ro=new ResizeObserver(function(){size();});w.dr.ro.observe(body);}catch(_){}}
    // re-project drawings whenever the chart pans/zooms (its time scale exists once buildChart finishes — poll briefly)
    (function attach(tries){if(w.dead)return;if(w.chart){try{w.chart.timeScale().subscribeVisibleLogicalRangeChange(function(){redraw();});}catch(e){}return;}if((tries||0)<50)setTimeout(function(){attach((tries||0)+1);},120);})(0);
    setTimeout(size,60);
  }
  // shared draw toggle + toolbar wiring (used by desktop windows and the mobile chart)
  function wireDrawTools(w,dtg,tools){
    if(dtg)dtg.addEventListener('click',function(e){e.stopPropagation();if(!w.dr)return;w.dr.on=!w.dr.on;w.el.classList.toggle('drawing',w.dr.on);dtg.classList.toggle('on',w.dr.on);});
    if(tools){tools.addEventListener('pointerdown',function(e){e.stopPropagation();});tools.addEventListener('click',function(e){var b=e.target.closest('.cwin-tool,.cwin-color');if(!b||!w.dr)return;e.stopPropagation();if(b.hasAttribute('data-undo')){w.dr.shapes.pop();if(w.dr.redraw)w.dr.redraw();return;}if(b.hasAttribute('data-clear')){w.dr.shapes=[];if(w.dr.redraw)w.dr.redraw();return;}if(b.classList.contains('cwin-color')){w.dr.color=b.getAttribute('data-color');tools.querySelectorAll('.cwin-color').forEach(function(x){x.classList.remove('on');});b.classList.add('on');return;}var tl=b.getAttribute('data-tool');if(tl){w.dr.tool=tl;tools.querySelectorAll('.cwin-tool[data-tool]').forEach(function(x){x.classList.remove('on');});b.classList.add('on');}});}
  }
  try{window.__mpDraw={setup:setupDraw,wire:wireDrawTools};}catch(e){} // expose the price-anchored draw engine to the mobile full-screen charts module
  try{window.__mpAiContext=aiContext;}catch(e){} // expose the rich chart-analysis context so the mobile AI bubble can actually "read" the chart
  /* movable sticky notes on the board */
  function saveNotes(){try{localStorage.setItem('mp_chart_notes',JSON.stringify(notes.map(function(n){return {text:n.text,html:n.html||'',x:parseInt(n.el.style.left,10)||0,y:parseInt(n.el.style.top,10)||0,w:parseInt(n.el.style.width,10)||0,h:parseInt(n.el.style.height,10)||0,color:n.color||'#e9e7df',winId:(n.winId!=null)?n.winId:null};})));}catch(e){}}
  function loadNotes(){try{return JSON.parse(localStorage.getItem('mp_chart_notes')||'null');}catch(e){return null;}}
  function addNote(cfg){cfg=cfg||{};var n={text:cfg.text||'',html:cfg.html||'',color:cfg.color||'#e9e7df',winId:(cfg.winId!=null)?cfg.winId:null};
    n.el=el('<div class="cws-note"><div class="cws-note-bar"><span class="cws-note-grip">&#9776;</span><span class="cws-note-cols"><span class="cws-note-col" data-c="#e9e7df" style="background:#e9e7df" title="White"></span><span class="cws-note-col" data-c="#2ebd85" style="background:#2ebd85" title="Green"></span><span class="cws-note-col" data-c="#ff6258" style="background:#ff6258" title="Red"></span></span><button class="cws-note-x" type="button" aria-label="Remove">&#10005;</button></div><div class="cws-note-ta" contenteditable="true" data-ph="Type a note…"></div><span class="cws-note-rz" title="Resize"></span></div>');
    var bw=board.clientWidth||700,bh=board.clientHeight||500,i=notes.length;
    var x=(cfg.x!=null)?cfg.x:Math.min(bw-216,40+i*24),y=(cfg.y!=null)?cfg.y:Math.min(bh-150,40+i*24);
    n.el.style.left=Math.max(0,x)+'px';n.el.style.top=Math.max(0,y)+'px';n.el.style.zIndex=++zTop;
    if(cfg.w>0)n.el.style.width=cfg.w+'px'; if(cfg.h>0)n.el.style.height=cfg.h+'px';
    var ta=n.el.querySelector('.cws-note-ta');ta.style.color=n.color;
    if(n.html)ta.innerHTML=n.html; else if(n.text)ta.textContent=n.text; // migrate plain-text notes to rich text
    var cols=n.el.querySelectorAll('.cws-note-col');
    Array.prototype.forEach.call(cols,function(cd){cd.classList.toggle('on',cd.getAttribute('data-c')===n.color);
      cd.addEventListener('mousedown',function(e){e.preventDefault();}); // keep the editor's caret/selection — don't let the swatch steal focus
      cd.addEventListener('click',function(e){e.stopPropagation();var c=cd.getAttribute('data-c');n.color=c;Array.prototype.forEach.call(cols,function(x){x.classList.remove('on');});cd.classList.add('on');try{ta.focus();document.execCommand('styleWithCSS',false,true);document.execCommand('foreColor',false,c);}catch(_){}n.html=ta.innerHTML;n.text=ta.textContent;saveNotes();});});
    ta.addEventListener('input',function(){n.html=ta.innerHTML;n.text=ta.textContent;saveNotes();});
    n.el.addEventListener('pointerdown',function(){n.el.style.zIndex=++zTop;});
    n.el.querySelector('.cws-note-x').addEventListener('click',function(){var pinned=n.winId;if(n.el.parentNode)n.el.parentNode.removeChild(n.el);notes=notes.filter(function(x){return x!==n;});saveNotes();if(pinned!=null){var pw=winById(pinned);if(pw)updateNotesBtn(pw);}if(winNotesEl&&!winNotesEl.hidden&&winNotesW&&winNotesW.id===pinned)renderWinNotes();});
    var rz=n.el.querySelector('.cws-note-rz');
    if(rz)rz.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault();var r=n.el.getBoundingClientRect(),sw=r.width,sh=r.height,sx=e.clientX,sy=e.clientY;try{rz.setPointerCapture(e.pointerId);}catch(_){}
      function rmv(ev){n.el.style.width=Math.max(150,Math.round(sw+(ev.clientX-sx)))+'px';n.el.style.height=Math.max(96,Math.round(sh+(ev.clientY-sy)))+'px';}
      function rup(){rz.removeEventListener('pointermove',rmv);rz.removeEventListener('pointerup',rup);saveNotes();}
      rz.addEventListener('pointermove',rmv);rz.addEventListener('pointerup',rup);});
    var bar=n.el.querySelector('.cws-note-bar');
    bar.addEventListener('pointerdown',function(e){if(e.target.closest('.cws-note-x')||e.target.closest('.cws-note-col'))return;var br=board.getBoundingClientRect(),r=n.el.getBoundingClientRect(),ox=e.clientX-r.left,oy=e.clientY-r.top,lastX=e.clientX,lastY=e.clientY;try{bar.setPointerCapture(e.pointerId);}catch(_){}board.classList.add('note-dragging');
      function curTarget(px,py){for(var i=0;i<wins.length;i++){var hd=wins[i].el&&wins[i].el.querySelector('.cwin-head');if(!hd)continue;var wr=hd.getBoundingClientRect();if(px>=wr.left&&px<=wr.right&&py>=wr.top&&py<=wr.bottom)return wins[i];}return null;}
      function mv(ev){lastX=ev.clientX;lastY=ev.clientY;var x=ev.clientX-br.left-ox,y=ev.clientY-br.top-oy;x=Math.max(0,Math.min(x,board.clientWidth-n.el.offsetWidth));y=Math.max(0,Math.min(y,board.clientHeight-n.el.offsetHeight));n.el.style.left=x+'px';n.el.style.top=y+'px';var tg=curTarget(ev.clientX,ev.clientY);wins.forEach(function(w){if(w.el)w.el.classList.toggle('drop-hover',w===tg);});}
      function up(){bar.removeEventListener('pointermove',mv);bar.removeEventListener('pointerup',up);board.classList.remove('note-dragging');var target=curTarget(lastX,lastY);wins.forEach(function(w){if(w.el)w.el.classList.remove('drop-hover');});
        var prev=n.winId;
        if(target){n.winId=target.id;n.el.style.display='none';}else{n.winId=null;}
        if(prev!=null){var pw=winById(prev);if(pw)updateNotesBtn(pw);}
        if(n.winId!=null){var nw=winById(n.winId);if(nw)updateNotesBtn(nw);}
        saveNotes();}
      bar.addEventListener('pointermove',mv);bar.addEventListener('pointerup',up);e.preventDefault();});
    board.appendChild(n.el);notes.push(n);showEmpty(false);
    if(n.winId!=null){n.el.style.display='none';var pw=winById(n.winId);if(pw)updateNotesBtn(pw);}
    saveNotes();
  }
  /* clickable symbol dropdown for chart windows — search box + scrollable token list (from the screener) + free entry */
  var symMenuEl=null,symMenuW=null,symMenuInput=null;
  function symFallback(){return window.mpTokens||['BTC','ETH','SOL','XRP','BNB','DOGE','ADA','AVAX'];}
  function commitSym(v){v=String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!v||!symMenuInput)return;symMenuEl.hidden=true;symMenuInput.value=v;symMenuInput.dispatchEvent(new Event('change',{bubbles:true}));}
  function renderSymList(){if(!symMenuEl)return;var q=(symMenuEl._srch.value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');var toks=symFallback().filter(function(s){return !q||s.indexOf(q)>=0;});var html=toks.slice(0,150).map(function(s){return '<button type="button" class="cwin-sym-opt'+(s===(symMenuW&&symMenuW.sym)?' on':'')+'" data-sym="'+s+'">'+s+'</button>';}).join('');if(q&&toks.indexOf(q)<0)html='<button type="button" class="cwin-sym-opt cwin-sym-add" data-sym="'+q+'">⊕ Trade '+q+'</button>'+html;symMenuEl._list.innerHTML=html||'<div class="cwin-sym-empty">no match — press Enter to use it</div>';}
  function buildSymMenu(){symMenuEl=el('<div class="cwin-sym-menu" hidden><input class="cwin-sym-search" type="text" placeholder="Search ticker…" autocomplete="off" spellcheck="false"><div class="cwin-sym-list"></div></div>');document.body.appendChild(symMenuEl);
    symMenuEl._srch=symMenuEl.querySelector('.cwin-sym-search');symMenuEl._list=symMenuEl.querySelector('.cwin-sym-list');
    symMenuEl.addEventListener('pointerdown',function(e){e.stopPropagation();});
    symMenuEl._srch.addEventListener('input',renderSymList);
    symMenuEl._srch.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();var f=symMenuEl._list.querySelector('[data-sym]');var typed=(symMenuEl._srch.value||'').replace(/[^A-Za-z0-9]/g,'');commitSym(typed||(f&&f.getAttribute('data-sym')));}else if(e.key==='Escape'){symMenuEl.hidden=true;}});
    symMenuEl._list.addEventListener('click',function(e){var b=e.target.closest('[data-sym]');if(b)commitSym(b.getAttribute('data-sym'));});
    document.addEventListener('pointerdown',function(e){if(symMenuEl&&!symMenuEl.hidden&&!(e.target.closest&&(e.target.closest('.cwin-sym-menu')||e.target.closest('.cwin-sym'))))symMenuEl.hidden=true;},true);
    window.addEventListener('scroll',function(e){if(symMenuEl&&!symMenuEl.hidden){var t=e.target;if(t&&t.closest&&t.closest('.cwin-sym-menu'))return;/* don't close when scrolling INSIDE the menu list */symMenuEl.hidden=true;}},true);}
  function openSymMenu(input,w){if(!symMenuEl)buildSymMenu();symMenuInput=input;symMenuW=w;symMenuEl._srch.value='';renderSymList();symMenuEl.hidden=false;var r=input.getBoundingClientRect(),mw=Math.max(180,r.width),mh=symMenuEl.offsetHeight||300;symMenuEl.style.minWidth=mw+'px';var left=Math.min(r.left,window.innerWidth-mw-8),top=r.bottom+4;if(top+mh>window.innerHeight-8)top=Math.max(8,r.top-mh-4);symMenuEl.style.left=Math.max(8,left)+'px';symMenuEl.style.top=top+'px';setTimeout(function(){try{symMenuEl._srch.focus();}catch(e){}},20);}
  /* chart background theme — dark (default) or light/white. Applies to every window + the board. */
  var chTheme='dark';try{chTheme=(localStorage.getItem('mp_ch_theme')==='light')?'light':'dark';}catch(e){}
  function themeOpts(){return chTheme==='light'
    ?{layout:{background:{color:'#ffffff'},textColor:'#2a2f37'},grid:{vertLines:{color:'rgba(0,0,0,.06)'},horzLines:{color:'rgba(0,0,0,.06)'}},rightPriceScale:{borderColor:'#d6dade'},timeScale:{borderColor:'#d6dade'}}
    :{layout:{background:{color:'transparent'},textColor:'#9aa3ad'},grid:{vertLines:{color:'rgba(35,41,50,.35)'},horzLines:{color:'rgba(35,41,50,.35)'}},rightPriceScale:{borderColor:'#232932'},timeScale:{borderColor:'#232932'}};}
  function applyTheme(){try{var bd=document.getElementById('cwsBoard');if(bd)bd.classList.toggle('cws-light',chTheme==='light');}catch(e){}for(var i=0;i<wins.length;i++){if(wins[i].chart)try{wins[i].chart.applyOptions(themeOpts());}catch(e){}}}
  function buildChart(w){ loadLib(function(){ if(w.dead||!window.LightweightCharts)return;
    var host=w.el.querySelector('.cwin-chart');
    try{ w.chart=LightweightCharts.createChart(host,{layout:{background:{color:'transparent'},textColor:'#9aa3ad',fontFamily:"'Familjen Grotesk',system-ui,sans-serif",attributionLogo:false},grid:{vertLines:{color:'rgba(35,41,50,.35)'},horzLines:{color:'rgba(35,41,50,.35)'}},rightPriceScale:{borderColor:'#232932'},timeScale:{borderColor:'#232932',timeVisible:true,secondsVisible:false,rightOffset:6,barSpacing:6},crosshair:{mode:0},autoSize:true});
      w.candle=w.chart.addCandlestickSeries({upColor:'#10b981',downColor:'#ef4444',borderVisible:false,wickUpColor:'#10b981',wickDownColor:'#ef4444'});
      try{if(chTheme==='light')w.chart.applyOptions(themeOpts());}catch(e){}
      w.legItems=[];var lg=document.createElement('div');lg.className='cwin-leg';host.appendChild(lg);w.legEl=lg;try{w.chart.subscribeCrosshairMove(function(param){cwLeg(w,param);syncCrosshair(w,param);});}catch(_){}try{w.chart.timeScale().subscribeVisibleLogicalRangeChange(function(r){if(r&&r.from<12)loadMoreW(w);});}catch(_){} }catch(e){return;}
    loadData(w,true); }); }
  function loadData(w,first){ if(w._ls&&w._ls!==w.sym&&w.chAlerts&&w.chAlerts.length){w.chAlerts.forEach(function(a){if(a.pl&&w.candle)try{w.candle.removePriceLine(a.pl);}catch(e){}});w.chAlerts=[];} /* alert lines are per-symbol — drop them when the window switches coins (the server alert for the old coin stays) */ w._ls=w.sym;w._lt=w.tf;w._noMore=false;w._lm=false;/* restart history pagination for the new symbol/TF */try{aiClearPlan(w);}catch(e){}/* AI-drawn plan lines are a snapshot for the old symbol/TF — clear on switch */showSkel(w,true);try{if(window.mpWS)window.mpWS.sub(w.sym);}catch(e){} // stream this symbol live the moment its chart loads
    fetch('/api/klines?symbol='+encodeURIComponent(w.sym)+'&interval='+w.tf).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){
      if(w.dead||w._ls!==w.sym||w._lt!==w.tf||!w.candle)return;
      if(kd&&kd.length){kd=sanitizeBars(kd);w.bars=kd;applyPrec(w.candle,kd[kd.length-1].close);try{w.candle.setData(kd);}catch(e){}w.lastBar=kd[kd.length-1];w._lgp=w.lastBar&&w.lastBar.close||0;w._rej=0;w._disp=null;/* snap eased close to the new symbol */applyInds(w);if(first){try{w.chart.priceScale('right').applyOptions({autoScale:true});w.chart.timeScale().scrollToRealTime();}catch(e){}}}/* re-enable price auto-scale on every symbol/TF change so the chart re-fits to the new range (XRP 1.1 → BTC 63k) instead of staying stuck */
      showSkel(w,false); }); }
  // Quietly re-sync the candles with the exchange's true OHLC (no skeleton, preserves the view). The live WS feed only
  // ever EXPANDS the forming bar's high/low, so a transient bad/low print bakes a phantom wick ("a drop that never
  // happened") into the bar — and once it closes it's stuck forever (no other reload on desktop). A periodic refetch of
  // the authoritative klines erases any such phantom. Mirrors the mobile engine's 60s reload.
  function refreshData(w){ if(w.dead||!w.candle||w._lm)return; var sym=w.sym,tf=w.tf; // w._lm: don't race loadMoreW's pagination
    try{var _vr=w.chart.timeScale().getVisibleLogicalRange();if(_vr&&w.bars&&w.bars.length&&_vr.to<w.bars.length-3)return;}catch(e){} // user scrolled into history → don't setData under them (drops paginated bars)
    fetch('/api/klines?symbol='+encodeURIComponent(sym)+'&interval='+tf).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){
      if(w.dead||w.sym!==sym||w.tf!==tf||!w.candle||!kd||!kd.length)return;
      kd=sanitizeBars(kd);w.bars=kd;try{w.candle.setData(kd);}catch(e){}w.lastBar=kd[kd.length-1];w._lgp=w.lastBar&&w.lastBar.close||0;w._rej=0;w._disp=null;try{applyInds(w);}catch(e){}
    }); }
  // load older history when the user scrolls back toward the start (full history to the coin's inception, like Paper Trade)
  function loadMoreW(w){ if(w.dead||w._lm||w._noMore||!w.bars||!w.bars.length||!w.candle)return;
    var sym=w.sym,tf=w.tf,end=w.bars[0].time*1000-1; w._lm=true;
    fetch('/api/klines?symbol='+encodeURIComponent(sym)+'&interval='+tf+'&end='+end).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){
      w._lm=false; if(w.dead||sym!==w.sym||tf!==w.tf||!w.candle)return;
      if(!kd||!kd.length){w._noMore=true;return;}
      var first=w.bars[0].time,older=kd.filter(function(b){return b.time<first;});
      if(!older.length){w._noMore=true;return;}
      if(older.length<900)w._noMore=true;
      var shift=older.length; w.bars=older.concat(w.bars);
      var vr0=null;try{vr0=w.chart.timeScale().getVisibleLogicalRange();}catch(e){}
      try{w.candle.setData(w.bars);}catch(e){}
      // keep the user exactly where they were scrolled (shift the visible range by the prepended count) → seamless, no jump
      if(vr0)try{w.chart.timeScale().setVisibleLogicalRange({from:vr0.from+shift,to:vr0.to+shift});}catch(e){}
      // keep canvas drawings anchored after older bars are prepended (logical indices shift by `shift`)
      try{if(w.dr&&w.dr.shapes&&w.dr.shapes.length){w.dr.shapes.forEach(function(s){if(s.l!=null)s.l+=shift;if(s.l1!=null)s.l1+=shift;if(s.l2!=null)s.l2+=shift;if(s.pts)s.pts.forEach(function(pt){if(pt.l!=null)pt.l+=shift;});});if(w.dr.redraw)w.dr.redraw();}}catch(e){}
      try{applyInds(w);}catch(e){}
    });
  }
  function liveTick(w,p){ if(!w.candle||!w.lastBar)return;
    var ivSec=parseInt(w.tf,10)*60,nowBar=Math.floor(Date.now()/1000/ivSec)*ivSec,nb=false;
    if(nowBar-w.lastBar.time>ivSec*1.5){ if(!w._gapT||Date.now()-w._gapT>8000){w._gapT=Date.now();refreshData(w);} return; } /* missed >1 interval (throttled/backgrounded tab, feed pause) → refetch the real candles instead of leaving a hole. Checked BEFORE the p>0 bail so a stalled feed still refetches (mirrors the Paper Trade fix). */
    if(!(p>0))return;
    if(nowBar>w.lastBar.time){var _wop=w.lastBar.close,_wspk=(w._lgp>0&&Math.abs(p-w._lgp)/w._lgp>0.025),_wcl=_wspk?_wop:p;w.lastBar={time:nowBar,open:_wop,high:Math.max(_wop,_wcl),low:Math.min(_wop,_wcl),close:_wcl};w.bars.push(w.lastBar);if(!_wspk)w._lgp=p;w._rej=0;nb=true;}/* new candle opens at the prior close (contiguous) + spike-filtered seed → no disconnected "from the sky" bar */
    else{if(w._lgp>0&&Math.abs(p-w._lgp)/w._lgp>0.025){if((w._rej=(w._rej||0)+1)<3)return;}/* reject a lone >2.5% print that would ratchet a fake wick */w._lgp=p;w._rej=0;w.lastBar.close=p;if(p>w.lastBar.high)w.lastBar.high=p;if(p<w.lastBar.low)w.lastBar.low=p;}
    if(nb){w._disp=w.lastBar.close;try{w.candle.update(w.lastBar);}catch(e){}applyInds(w);try{w.chart.priceScale('right').applyOptions({autoScale:true});}catch(e){} } // a fresh bar appears instantly + re-fit the price scale so candles never get clipped to "half" if the vertical scale drifted/locked over a long session
    else startSmooth(); // forming-bar close is eased toward the true price by the rAF loop → it glides at 60fps instead of snapping
    if(w.dr&&w.dr.shapes&&w.dr.shapes.length&&w.dr.redraw)w.dr.redraw();
    // once price crosses an alert level it has triggered (cron emails) — clear its line so it doesn't linger
    if(w.chAlerts&&w.chAlerts.length){for(var ai=w.chAlerts.length-1;ai>=0;ai--){var al=w.chAlerts[ai];if((al.dir==='up'&&p>=al.price)||(al.dir==='down'&&p<=al.price)){if(al.pl)try{w.candle.removePriceLine(al.pl);}catch(e){}w.chAlerts.splice(ai,1);chartToast('🔔 '+w.sym+' hit '+cwFmt(al.price)+' — alert triggered');}}} }
  // ---- smoothness: ease each forming candle's displayed close toward its true price at 60fps so it glides (premium feel).
  // Runs only while something is still moving (self-stops when every window has settled; restarted by liveTick), and never while hidden.
  var _smRun=false;
  function startSmooth(){ if(!_smRun){_smRun=true;requestAnimationFrame(smoothLoop);} }
  function smoothLoop(){
    _smRun=false; if(document.hidden||!wins.length)return; var active=false;
    for(var i=0;i<wins.length;i++){ var w=wins[i]; if(w.dead||!w.candle||!w.lastBar)continue;
      var tgt=+w.lastBar.close; if(!(tgt>0))continue;
      var fresh=(w._disp==null||!isFinite(w._disp));
      if(fresh){ w._disp=tgt; }
      else if(w._disp!==tgt){ var d=tgt-w._disp; if(Math.abs(d)<=Math.max(Math.abs(tgt)*1e-5,1e-9))w._disp=tgt; else { w._disp+=d*0.34; active=true; } }
      else continue; // settled — nothing to redraw
      var c=w._disp; if(c>w.lastBar.high)c=w.lastBar.high; else if(c<w.lastBar.low)c=w.lastBar.low;
      try{w.candle.update({time:w.lastBar.time,open:w.lastBar.open,high:w.lastBar.high,low:w.lastBar.low,close:c});}catch(e){}
    }
    if(active){_smRun=true;requestAnimationFrame(smoothLoop);}
  }
  document.addEventListener('visibilitychange',function(){if(!document.hidden){startSmooth();
    wins.forEach(function(w){if(!w.dead&&w.candle)refreshData(w);});/* returning from a backgrounded tab: force a real klines re-sync NOW instead of waiting up to 60s (intervals were throttled while hidden → the forming candle froze / a gap formed) */
  }});
  /* CHART LIVENESS WATCHDOG (same cure as the Paper Trade chart) — every 6s per window while visible:
     (1) re-assert autoScale ONLY when the realtime edge is in view (a locked/drifted price scale makes a chart LOOK
         frozen even though data updates — and on 5m+ new-bar re-fits are rare); never fights a user scrolled into history.
     (2) if NO price has reached this window for >15s (WS quiet for the symbol AND the 12s REST poll failing/skipped),
         hard-recover: re-subscribe the WS and re-sync the candles. A chart can stay stale for at most ~15-20s. */
  setInterval(function(){ if(document.hidden)return; var now=Date.now();
    for(var i=0;i<wins.length;i++){ var w=wins[i]; if(w.dead||!w.candle)continue;
      try{var vr=w.chart.timeScale().getVisibleLogicalRange();if(!vr||!w.bars||!w.bars.length||vr.to>=w.bars.length-2)w.chart.priceScale('right').applyOptions({autoScale:true});}catch(e){}
      // catch a stalled CHART even when the price source LOOKS fresh: newest bar >1.5 intervals behind now → force a re-sync
      try{if(w.lastBar){var _iv=parseInt(w.tf,10)*60,_nb=Math.floor(now/1000/_iv)*_iv;if(_nb-w.lastBar.time>_iv*1.5&&(!w._gapT||now-w._gapT>10000)){w._gapT=now;refreshData(w);continue;}}}catch(e){}
      var src=Math.max(w._wsT||0,w._pollT||0);
      if(!src||now-src>15000){ try{if(window.mpWS)window.mpWS.sub(w.sym);}catch(e){} w._pollT=now;/* claim the slot so the next sweep doesn't double-fire while the fetch is in flight */
        (function(w){fetch('/api/price?symbol='+encodeURIComponent(w.sym),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){if(w.dead)return;var px=j&&+(j.price||j.p||j.last||0);if(px>0){w._pollT=Date.now();liveTick(w,px);}else if(!w._gapT||Date.now()-w._gapT>12000){w._gapT=Date.now();refreshData(w);}});})(w);
      }
    } },6000);
  function bringFront(w){wins.forEach(function(x){if(x.el)x.el.classList.remove('front');});if(w.el){w.el.classList.add('front');w.el.style.zIndex=++zTop;}}
  // sync the crosshair (vertical time line) across every chart window, so hovering one reads them all at the same moment
  var _xhSync=false,_xhSyncOn=false; // crosshair sync is OFF by default — only the hovered chart shows the crosshair
  function toggleSync(){_xhSyncOn=!_xhSyncOn;var b=document.getElementById('cwsSync');if(b)b.classList.toggle('on',_xhSyncOn);if(!_xhSyncOn){wins.forEach(function(o){if(o.chart)try{o.chart.clearCrosshairPosition();}catch(e){}});}}
  function syncCrosshair(src,param){if(!_xhSyncOn||_xhSync)return;_xhSync=true;try{
    if(param&&param.time!=null){wins.forEach(function(o){if(o===src||!o.chart||!o.candle)return;var pr=(o.lastBar&&+o.lastBar.close)||0;if(pr>0)try{o.chart.setCrosshairPosition(pr,param.time,o.candle);}catch(e){}});}
    else{wins.forEach(function(o){if(o===src||!o.chart)return;try{o.chart.clearCrosshairPosition();}catch(e){}});}
  }catch(e){}_xhSync=false;}
  // keyboard shortcuts on the Charts page: 1-6 = timeframe on the front window, A = add chart, D = toggle draw
  document.addEventListener('keydown',function(e){
    if(!built||!wins.length)return;
    if(!(document.body.classList.contains('charts-page')||/^\/charts\/?$/.test(location.pathname)))return;
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    var t=e.target;if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable))return;
    var front=null;for(var i=0;i<wins.length;i++){if(wins[i].el&&wins[i].el.classList.contains('front')){front=wins[i];break;}}if(!front)front=wins[wins.length-1];if(!front||!front.el)return;
    var tfKey={'1':'1','2':'5','3':'15','4':'60','5':'240','6':'1440'};
    if(tfKey[e.key]){var btn=front.el.querySelector('.cwin-tf button[data-tf="'+tfKey[e.key]+'"]');if(btn){btn.click();e.preventDefault();}}
    else if(e.key==='a'||e.key==='A'){var add=document.getElementById('cwsAdd');if(add&&!add.disabled){add.click();e.preventDefault();}}
    else if(e.key==='d'||e.key==='D'){var dtg=front.el.querySelector('.cwin-draw-tg');if(dtg){dtg.click();e.preventDefault();}}
  });
  function nextSym(){for(var i=0;i<SYMS.length;i++){var used=false;for(var j=0;j<wins.length;j++)if(wins[j].sym===SYMS[i]){used=true;break;}if(!used)return SYMS[i];}return SYMS[wins.length%SYMS.length];}
  function showEmpty(on){var e=document.getElementById('cwsEmpty');if(e)e.hidden=!on;}
  function updateCount(){var c=wins.length,mx=MAXn(),cc=document.getElementById('cwsCount');if(cc)cc.textContent=c+'/'+mx;var add=document.getElementById('cwsAdd');if(add)add.disabled=c>=mx;}
  function savePersist(){try{localStorage.setItem('mp_charts',JSON.stringify(wins.map(function(w){return {sym:w.sym,tf:w.tf,inds:w.inds,x:parseInt(w.el.style.left,10)||0,y:parseInt(w.el.style.top,10)||0,w:parseInt(w.el.style.width,10)||0,h:parseInt(w.el.style.height,10)||0,id:w.id,emaList:w.emaList,smaList:w.smaList};})));}catch(e){}}
  function loadPersist(){try{return JSON.parse(localStorage.getItem('mp_charts')||'null');}catch(e){return null;}}
  function startResize(w,dir,e){ if(isMobile())return; bringFront(w);
    var sx=e.clientX,sy=e.clientY,sw=w.el.offsetWidth,sh=w.el.offsetHeight,sl=parseInt(w.el.style.left,10)||0,st=parseInt(w.el.style.top,10)||0;
    var bw=board.clientWidth,bh=board.clientHeight,minW=200,minH=150,handle=e.currentTarget;
    w.el.classList.add('dragging'); try{handle.setPointerCapture(e.pointerId);}catch(_){}
    function mv(ev){var dx=ev.clientX-sx,dy=ev.clientY-sy,L=sl,T=st,W=sw,H=sh;
      if(dir.indexOf('e')>=0)W=sw+dx;
      if(dir.indexOf('s')>=0)H=sh+dy;
      if(dir.indexOf('w')>=0){W=sw-dx;L=sl+dx;}
      if(dir.indexOf('n')>=0){H=sh-dy;T=st+dy;}
      if(W<minW){if(dir.indexOf('w')>=0)L=sl+(sw-minW);W=minW;}
      if(H<minH){if(dir.indexOf('n')>=0)T=st+(sh-minH);H=minH;}
      if(L<0){W+=L;L=0;} if(T<0){H+=T;T=0;}
      if(L+W>bw)W=bw-L; if(T+H>bh)H=bh-T;
      if(W<minW)W=minW; if(H<minH)H=minH;
      w.el.style.left=L+'px';w.el.style.top=T+'px';w.el.style.width=W+'px';w.el.style.height=H+'px';}
    function up(){handle.removeEventListener('pointermove',mv);handle.removeEventListener('pointerup',up);w.el.classList.remove('dragging');try{handle.releasePointerCapture(e.pointerId);}catch(_){}savePersist();}
    handle.addEventListener('pointermove',mv);handle.addEventListener('pointerup',up); e.preventDefault(); e.stopPropagation(); }
  function wireWin(w){
    var head=w.el.querySelector('.cwin-head');
    w.el.addEventListener('pointerdown',function(){bringFront(w);});
    function clearDraw(){if(w.dr){w.dr.shapes=[];w.dr.cur=null;if(w.dr.redraw)w.dr.redraw();}}
    var _si=w.el.querySelector('.cwin-sym');
    _si.addEventListener('change',function(){var v=String(this.value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!v){this.value=w.sym;return;}this.value=v;if(v===w.sym)return;w.sym=v;w.mtOn=false;clearDraw();importTrades(w);updateMTBtn(w);updateNotesBtn(w);loadData(w,true);savePersist();});
    _si.addEventListener('mousedown',function(e){e.stopPropagation();});
    _si.addEventListener('click',function(e){e.stopPropagation();openSymMenu(this,w);});
    if(window.mpLoadTokens)window.mpLoadTokens(function(){if(symMenuEl&&!symMenuEl.hidden)renderSymList();});
    w.el.querySelector('.cwin-tf').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;this.querySelectorAll('button').forEach(function(x){x.classList.remove('on');});b.classList.add('on');w.tf=b.getAttribute('data-tf');clearDraw();loadData(w,true);savePersist();});
    var indBtn=w.el.querySelector('.cwin-ind-btn');if(indBtn)indBtn.addEventListener('click',function(e){e.stopPropagation();openIndMenu(w,indBtn);});updateIndN(w);
    var aiBtn=w.el.querySelector('.cwin-ai');if(aiBtn)aiBtn.addEventListener('click',function(e){e.stopPropagation();openAiPanel(w,aiBtn);});
    var mtBtn=w.el.querySelector('.cwin-mt');if(mtBtn)mtBtn.addEventListener('click',function(e){e.stopPropagation();w.mtOn=!w.mtOn;importTrades(w);});updateMTBtn(w);
    var ntBtn=w.el.querySelector('.cwin-notes-btn');if(ntBtn)ntBtn.addEventListener('click',function(e){e.stopPropagation();openWinNotes(w,ntBtn);});updateNotesBtn(w);
    w.el.querySelector('.cwin-x').addEventListener('click',function(){closeWin(w);});
    wireDrawTools(w,w.el.querySelector('.cwin-draw-tg'),w.el.querySelector('.cwin-tools'));
    head.addEventListener('pointerdown',function(e){
      if(isMobile())return; if(e.target.closest('select,button,input,.cwin-sym'))return; // don't start a window drag when clicking the symbol input / controls
      bringFront(w); var br=board.getBoundingClientRect(),r=w.el.getBoundingClientRect(),ox=e.clientX-r.left,oy=e.clientY-r.top;
      w.el.classList.add('dragging'); try{head.setPointerCapture(e.pointerId);}catch(_){}
      function mv(ev){var x=ev.clientX-br.left-ox,y=ev.clientY-br.top-oy;x=Math.max(0,Math.min(x,board.clientWidth-w.el.offsetWidth));y=Math.max(0,Math.min(y,board.clientHeight-w.el.offsetHeight));w.el.style.left=x+'px';w.el.style.top=y+'px';}
      function up(){head.removeEventListener('pointermove',mv);head.removeEventListener('pointerup',up);w.el.classList.remove('dragging');try{head.releasePointerCapture(e.pointerId);}catch(_){}savePersist();}
      head.addEventListener('pointermove',mv);head.addEventListener('pointerup',up); e.preventDefault(); });
    head.addEventListener('dblclick',function(e){if(isMobile()||e.target.closest('select,button,input,.cwin-sym'))return;
      if(w._max){w.el.style.left=w._max.l;w.el.style.top=w._max.t;w.el.style.width=w._max.w;w.el.style.height=w._max.h;w._max=null;}
      else{w._max={l:w.el.style.left,t:w.el.style.top,w:w.el.style.width,h:w.el.style.height};bringFront(w);w.el.style.left='0px';w.el.style.top='0px';w.el.style.width=board.clientWidth+'px';w.el.style.height=board.clientHeight+'px';}
      savePersist();});
    Array.prototype.forEach.call(w.el.querySelectorAll('.cwin-rz'),function(h){h.addEventListener('pointerdown',function(e){startResize(w,h.getAttribute('data-rz'),e);});});
  }
  function renumber(){for(var i=0;i<wins.length;i++){var n=wins[i].el&&wins[i].el.querySelector('.cwin-num');if(n)n.textContent=String(i+1);}}
  function closeWin(w){w.dead=true;if(w.poll)clearInterval(w.poll);if(w.refreshT)clearInterval(w.refreshT);try{if(w.dr&&w.dr.ro)w.dr.ro.disconnect();}catch(e){}try{if(w.chart)w.chart.remove();}catch(e){}w.chart=null;w.candle=null;w.indSeries=null;w.indLines=null;/* release the disposed LWC instance + its retained closures for GC */if(w.el&&w.el.parentNode)w.el.parentNode.removeChild(w.el);wins=wins.filter(function(x){return x!==w;});renumber();updateCount();savePersist();if(!wins.length)showEmpty(true);}
  function addWin(cfg){ if(wins.length>=MAXn())return; cfg=cfg||{}; showEmpty(false);
    var w={sym:cfg.sym||nextSym(),tf:cfg.tf||'60',inds:cfg.inds||{sig:false,sr:false,bs:false,ema:false},emaList:cfg.emaList||(cfg.emaP?[cfg.emaP]:[21]),smaList:cfg.smaList||(cfg.smaP?[cfg.smaP]:[50]),bars:[],dead:false,id:cfg.id||(++winSeq)};
    var symOpts=SYMS.map(function(s){return '<option'+(s===w.sym?' selected':'')+'>'+s+'</option>';}).join('');
    var tfBtns=TFS.map(function(t){return '<button type="button" data-tf="'+t[0]+'"'+(t[0]===w.tf?' class="on"':'')+'>'+t[1]+'</button>';}).join('');
    var indBtns=INDS.map(function(t){return '<button type="button" class="cwin-ind'+(w.inds[t[0]]?' on':'')+'" data-ind="'+t[0]+'">'+t[1]+'</button>';}).join('');
    w.el=el('<div class="cwin"><div class="cwin-head"><span class="cwin-num"></span><span class="cwin-grip"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><circle cx="8" cy="6" r="1.4"/><circle cx="8" cy="12" r="1.4"/><circle cx="8" cy="18" r="1.4"/><circle cx="14" cy="6" r="1.4"/><circle cx="14" cy="12" r="1.4"/><circle cx="14" cy="18" r="1.4"/></svg></span><input class="cwin-sym" aria-label="Symbol" readonly value="'+w.sym+'" style="width:66px"><div class="cwin-tf">'+tfBtns+'</div><button class="cwin-ai" type="button" title="Ask AI about this chart"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.7 4.5L18 9l-4.3 1.5L12 15l-1.7-4.5L6 9l4.3-1.5z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/></svg><span>AI</span></button><button class="cwin-ind-btn" type="button" title="Indicators"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg><span class="cwin-ind-lbl">Indicators</span><span class="cwin-ind-n"></span></button><button class="cwin-mt" type="button" title="Import My Trades" hidden><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button><button class="cwin-notes-btn" type="button" title="Notes pinned here" hidden><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10l6-6V5a2 2 0 0 0-2-2z"/><path d="M15 21v-6h6"/></svg><span class="cwin-notes-n"></span></button><button class="cwin-draw-tg" type="button" title="Draw / annotate" aria-label="Draw"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button><button class="cwin-x" type="button" aria-label="Close chart">✕</button></div><div class="cwin-body"><div class="cwin-chart"></div><canvas class="cwin-draw"></canvas><div class="cwin-tools"><button class="cwin-tool on" data-tool="pen" title="Freehand">✎</button><button class="cwin-tool" data-tool="trend" title="Trend line">╱</button><button class="cwin-tool" data-tool="hline" title="Horizontal">―</button><button class="cwin-tool" data-tool="vline" title="Vertical">│</button><button class="cwin-tool cwin-tool-fib" data-tool="fib" title="Fib retracement">F</button><button class="cwin-tool cwin-tool-alert" data-tool="alert" title="Set price alert at a level">🔔</button><span class="cwin-color on" data-color="#3fd8e6" style="background:#3fd8e6"></span><span class="cwin-color" data-color="#c2f64a" style="background:#c2f64a"></span><span class="cwin-color" data-color="#ff6258" style="background:#ff6258"></span><span class="cwin-color" data-color="#ffffff" style="background:#fff"></span><button class="cwin-tool cwin-undo" data-undo title="Undo last">↶</button><button class="cwin-tool cwin-clear" data-clear title="Clear all">Clear</button></div><div class="cwin-skel">loading…</div></div><div class="cwin-rz cwin-rz-n" data-rz="n"></div><div class="cwin-rz cwin-rz-s" data-rz="s"></div><div class="cwin-rz cwin-rz-e" data-rz="e"></div><div class="cwin-rz cwin-rz-w" data-rz="w"></div><div class="cwin-rz cwin-rz-ne" data-rz="ne"></div><div class="cwin-rz cwin-rz-nw" data-rz="nw"></div><div class="cwin-rz cwin-rz-se" data-rz="se"></div><div class="cwin-rz cwin-rz-sw" data-rz="sw"></div><div class="cwin-rsz"></div></div>');
    if(!isMobile()){var bw=board.clientWidth||board.offsetWidth||900,bh=board.clientHeight||board.offsetHeight||600,i=wins.length;
      var ww=cfg.w||Math.min(580,Math.max(300,Math.round(bw*0.52))),wh=cfg.h||Math.min(430,Math.max(240,Math.round(bh*0.56)));
      ww=Math.min(ww,bw);wh=Math.min(wh,bh);
      var x=(cfg.x!=null)?cfg.x:Math.min(bw-ww,18+i*30),y=(cfg.y!=null)?cfg.y:Math.min(bh-wh,18+i*30);
      w.el.style.width=ww+'px';w.el.style.height=wh+'px';w.el.style.left=Math.max(0,Math.min(x,bw-ww))+'px';w.el.style.top=Math.max(0,Math.min(y,bh-wh))+'px';}
    board.appendChild(w.el); wins.push(w); renumber(); bringFront(w); wireWin(w); setupDraw(w); buildChart(w);
    w.poll=setInterval(function(){ if(w.dead)return; if(w._wsT&&Date.now()-w._wsT<30000)return; /* WS feed is the single source of truth — don't let the REST value (a different exchange) clobber a fresh tick and flicker the forming candle */ fetch('/api/price?symbol='+encodeURIComponent(w.sym),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){if(!j||w.dead)return;var px=+(j.price||j.p||j.last||j.c||0);if(px>0){w._pollT=Date.now();liveTick(w,px);}}); },12000);
    w.refreshT=setInterval(function(){ if(!w.dead&&!document.hidden)refreshData(w); },60000); // self-heal any phantom wick from a bad live tick by re-syncing with the true klines every 60s
    updateCount(); }
  document.addEventListener('mp:price',function(ev){ if(!ev.detail)return; var s=ev.detail.sym,p=+ev.detail.price; if(!(p>0))return;
    for(var i=0;i<wins.length;i++){ var w=wins[i]; if(w.sym===s){ w._lp=p; w._wsT=Date.now(); if(!w._raf){ w._raf=true; (function(w){requestAnimationFrame(function(){w._raf=false;liveTick(w,w._lp);});})(w); } } } });
  function shareFeedback(msg){var b=document.getElementById('cwsShare'),s=b&&b.querySelector('span');if(s){var o=s.getAttribute('data-o')||s.textContent;s.setAttribute('data-o',o);s.textContent=msg;setTimeout(function(){s.textContent=o;},1700);}}
  function tfLabel(tf){for(var i=0;i<TFS.length;i++)if(TFS[i][0]===tf)return TFS[i][1];return tf;}
  /* Share = a screenshot of the whole workspace (every chart + drawings + notes), composited to one PNG */
  function doShare(){
    if(!wins.length){var url=location.origin+'/?p=charts';if(navigator.share)navigator.share({title:'MarginPad Charts',url:url}).catch(function(){});else if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url);shareFeedback('Link copied');}return;}
    var bw=board.clientWidth,bh=board.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
    var cv=document.createElement('canvas');cv.width=Math.round(bw*dpr);cv.height=Math.round(bh*dpr);var ctx=cv.getContext('2d');ctx.scale(dpr,dpr);
    ctx.fillStyle='#16191e';ctx.fillRect(0,0,bw,bh);
    wins.forEach(function(w){
      var x=parseInt(w.el.style.left,10)||0,y=parseInt(w.el.style.top,10)||0,ww=w.el.offsetWidth,wh=w.el.offsetHeight;
      var hd=w.el.querySelector('.cwin-head'),hh=(hd&&hd.offsetHeight)||34;
      ctx.fillStyle='#0c0f13';ctx.fillRect(x,y,ww,wh);
      try{var shot=w.chart.takeScreenshot();ctx.drawImage(shot,x,y+hh,ww,wh-hh);}catch(e){}
      try{var dcv=w.el.querySelector('.cwin-draw');if(dcv)ctx.drawImage(dcv,x,y+hh,ww,wh-hh);}catch(e){}
      ctx.fillStyle='#13171d';ctx.fillRect(x,y,ww,hh);ctx.fillStyle='#2b323b';ctx.fillRect(x,y+hh-1,ww,1);
      ctx.fillStyle='#c2f64a';ctx.font='700 12px monospace';ctx.textBaseline='middle';ctx.fillText(w.sym+'  ·  '+tfLabel(w.tf),x+9,y+hh/2);
      ctx.strokeStyle='#2b323b';ctx.lineWidth=1;ctx.strokeRect(x+0.5,y+0.5,ww-1,wh-1);
    });
    notes.forEach(function(n){var x=parseInt(n.el.style.left,10)||0,y=parseInt(n.el.style.top,10)||0,nw=n.el.offsetWidth,nh=n.el.offsetHeight;ctx.fillStyle='#2a2e35';ctx.fillRect(x,y,nw,nh);ctx.fillStyle=n.color||'#e9e7df';ctx.font='13px sans-serif';ctx.textBaseline='top';
      var words=(n.text||'').split(/\s+/),line='',yy=y+10;for(var i=0;i<words.length;i++){var test=line+words[i]+' ';if(ctx.measureText(test).width>nw-16&&line){ctx.fillText(line,x+8,yy);line=words[i]+' ';yy+=16;}else line=test;}if(line)ctx.fillText(line,x+8,yy);});
    ctx.fillStyle='rgba(233,231,223,.6)';ctx.font='700 13px sans-serif';ctx.textBaseline='alphabetic';ctx.fillText('marginpad.io',bw-104,bh-12);
    function download(bl){var a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download='marginpad-charts.png';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);if(a.parentNode)a.parentNode.removeChild(a);},2000);shareFeedback('Saved ✓');}
    try{cv.toBlob(function(blob){if(!blob){shareFeedback('Failed');return;}var file=null;try{file=new File([blob],'marginpad-charts.png',{type:'image/png'});}catch(e){}
      if(file&&navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:'MarginPad Charts',text:'My charts on MarginPad'}).then(function(){shareFeedback('Shared ✓');}).catch(function(){download(blob);});}
      else download(blob);},'image/png');}catch(e){shareFeedback('Failed');}
  }
  function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function escAttr(s){return escHtml(s).replace(/"/g,'&quot;');}
  // ---- named layouts (save / open / delete) ----
  function layoutsLoad(){try{return JSON.parse(localStorage.getItem('mp_charts_layouts')||'[]');}catch(e){return [];}}
  function layoutsSave(a){try{localStorage.setItem('mp_charts_layouts',JSON.stringify(a));}catch(e){}}
  function snapshot(){return {wins:wins.map(function(w){return {sym:w.sym,tf:w.tf,inds:w.inds,x:parseInt(w.el.style.left,10)||0,y:parseInt(w.el.style.top,10)||0,w:parseInt(w.el.style.width,10)||0,h:parseInt(w.el.style.height,10)||0,id:w.id,emaList:w.emaList,smaList:w.smaList};}),notes:notes.map(function(n){return {text:n.text,html:n.html||'',x:parseInt(n.el.style.left,10)||0,y:parseInt(n.el.style.top,10)||0,w:parseInt(n.el.style.width,10)||0,h:parseInt(n.el.style.height,10)||0,color:n.color};})};}
  function saveLayout(){ if(!wins.length){alert('Open at least one chart first.');return;} var name=(prompt('Name this layout:','My layout')||'').trim(); if(!name)return; var arr=layoutsLoad(),snap=snapshot();snap.name=name;snap.ts=Date.now(); var idx=-1;for(var i=0;i<arr.length;i++)if(arr[i].name===name)idx=i; if(idx>=0)arr[idx]=snap;else arr.push(snap); layoutsSave(arr); var b=document.getElementById('cwsSave'),s=b&&b.querySelector('span'); if(s){var o=s.textContent;s.textContent='Saved ✓';setTimeout(function(){s.textContent=o;},1600);} }
  function loadLayout(snap){ if(!snap)return; wins.slice().forEach(function(w){closeWin(w);}); notes.slice().forEach(function(n){if(n.el.parentNode)n.el.parentNode.removeChild(n.el);}); notes=[]; (snap.wins||[]).slice(0,MAXn()).forEach(function(c){addWin(c);}); (snap.notes||[]).forEach(function(c){addNote(c);}); savePersist();saveNotes(); }
  var layMenuEl=null;
  function renderLayMenu(){var arr=layoutsLoad();layMenuEl.innerHTML='<div class="cwin-ind-menu-h">Saved layouts</div>'+(arr.length?('<div class="cwin-ind-menu-list">'+arr.map(function(l){var c=(l.wins||[]).length;return '<div class="cws-lay-item"><button type="button" class="cws-lay-open" data-name="'+escAttr(l.name)+'">'+escHtml(l.name)+' <small>'+c+' chart'+(c===1?'':'s')+'</small></button><button type="button" class="cws-lay-del" data-del="'+escAttr(l.name)+'" title="Delete" aria-label="Delete">&#10005;</button></div>';}).join('')+'</div>'):'<div class="cws-lay-empty">No saved layouts yet — arrange your charts, then “Save layout”.</div>');}
  function buildLayMenu(){ layMenuEl=el('<div class="cwin-ind-menu cws-lay-menu" hidden></div>'); document.body.appendChild(layMenuEl);
    layMenuEl.addEventListener('pointerdown',function(e){e.stopPropagation();});
    layMenuEl.addEventListener('click',function(e){var del=e.target.closest('[data-del]'),it=e.target.closest('[data-name]');
      if(del){layoutsSave(layoutsLoad().filter(function(x){return x.name!==del.getAttribute('data-del');}));renderLayMenu();return;}
      if(it){var nm=it.getAttribute('data-name'),arr=layoutsLoad();for(var i=0;i<arr.length;i++)if(arr[i].name===nm){loadLayout(arr[i]);break;}layMenuEl.hidden=true;}});
    document.addEventListener('pointerdown',function(e){if(layMenuEl&&!layMenuEl.hidden&&!(e.target.closest&&(e.target.closest('.cws-lay-menu')||e.target.closest('#cwsLayouts'))))layMenuEl.hidden=true;},true);
    window.addEventListener('scroll',function(){if(layMenuEl)layMenuEl.hidden=true;},true); }
  function openLayMenu(btn){ if(!layMenuEl)buildLayMenu(); if(!layMenuEl.hidden){layMenuEl.hidden=true;return;} renderLayMenu(); layMenuEl.hidden=false; var r=btn.getBoundingClientRect(),mw=layMenuEl.offsetWidth||240,mh=layMenuEl.offsetHeight||200; var left=Math.min(r.left,window.innerWidth-mw-8),top=r.bottom+6; if(top+mh>window.innerHeight-8)top=Math.max(8,r.top-mh-6); layMenuEl.style.left=Math.max(8,left)+'px';layMenuEl.style.top=top+'px'; }
  // ---- quick paper-trade (open a position straight from the charts) ----
  function jload(){try{return JSON.parse(localStorage.getItem('mp_journal'))||[];}catch(e){return [];}}
  function jstore(d){try{localStorage.setItem('mp_journal',JSON.stringify(d));}catch(e){}}
  function qtPrice(sym){var lp=window.mpLivePrices&&window.mpLivePrices[sym];return (lp&&lp.p>0)?lp.p:0;}
  function fmtP(x){return '$'+(+x).toLocaleString('en-US',{maximumFractionDigits:x>=100?2:x>=1?4:6});}
  var qtEl=null,qtSide='long',qtLev=10;
  function qtPosToLev(p){return Math.max(1,Math.min(1000,Math.round(Math.pow(1000,p/1000))));}   // log slider 0..1000 → 1×..1000×
  function qtLevToPos(l){l=Math.max(1,Math.min(1000,l));return Math.round(Math.log(l)/Math.log(1000)*1000);}
  function updateQT(){if(!qtEl||qtEl.hidden)return;var sym=qtEl.querySelector('.cqt-sym').value,lev=qtLev,amt=+qtEl.querySelector('.cqt-amt').value||0,p=qtPrice(sym);
    var lvv=qtEl.querySelector('.cqt-levv');if(lvv)lvv.innerHTML=lev+'&times;';
    var eE=qtEl.querySelector('.cqt-entry'),eL=qtEl.querySelector('.cqt-liq'),eS=qtEl.querySelector('.cqt-size');
    if(!(p>0)){if(eE)eE.textContent='…';if(eL)eL.textContent='…';if(eS)eS.textContent='…';return;}
    var mmr=0.005,liq=qtSide==='long'?p*(1-(1-mmr)/lev):p*(1+(1-mmr)/lev),notional=amt*lev;
    if(eE)eE.textContent=fmtP(p);if(eL)eL.textContent=fmtP(liq);if(eS)eS.textContent=fmtP(notional);}
  function doOpenPos(){ var sym=qtEl.querySelector('.cqt-sym').value,lev=qtLev,amt=+qtEl.querySelector('.cqt-amt').value||0,msg=qtEl.querySelector('.cqt-msg');
    if(amt>100000){amt=100000;qtEl.querySelector('.cqt-amt').value='100000';if(msg)msg.textContent='Max trade size is $100,000';} // owner rule
    var advc=qtEl.querySelector('.cqt-adv-chk'),advOn=advc&&advc.checked,tp=advOn?parseFloat(qtEl.querySelector('.cqt-tp').value):NaN,sl=advOn?parseFloat(qtEl.querySelector('.cqt-sl').value):NaN;
    if(!(amt>0)){msg.style.color='#ff6258';msg.textContent='Enter an amount.';return;}
    if(window.mpTradeGate&&!window.mpTradeGate(sym,qtSide))return; // enforce open-trade limits + one-way mode
    function open(p){var mmr=0.005,L=lev,notional=amt*L,qty=notional/p,liq=qtSide==='long'?p*(1-(1-mmr)/L):p*(1+(1-mmr)/L);
      // drop a stop/target already on the wrong side of entry, so it can't auto-close the position at open
      var _lng=qtSide==='long',_sl=sl,_tp=tp;
      if(isFinite(_sl)&&((_lng&&_sl>=p)||(!_lng&&_sl<=p)))_sl=NaN;
      if(isFinite(_tp)&&((_lng&&_tp<=p)||(!_lng&&_tp>=p)))_tp=NaN;
      var d=jload();d.push({id:String(Date.now())+'_'+Math.floor(Math.random()*1e4),ts:Date.now(),sym:sym,side:qtSide,entry:p,stop:isFinite(_sl)?_sl:null,tp:isFinite(_tp)?_tp:null,lev:L,rr:null,qty:qty,notional:notional,margin:amt,riskAmt:amt,liq:liq,mmr:mmr,feeRate:0,status:'open',pnl:null});
      if(window.mpLivePrices)window.mpLivePrices[sym]={p:p,t:Date.now()};jstore(d);if(window.mpJournalRender)window.mpJournalRender();
      try{window.mpBuzz&&window.mpBuzz([15]);}catch(e){} // haptic on open (chart quick-trade)
      try{if(window.mpLevWarn)window.mpLevWarn(L);}catch(e){} // extreme-leverage nudge (parity with the terminal's add())
      try{wins.forEach(updateMTBtn);}catch(e){}
      try{if(window.mpCheckGrad)window.mpCheckGrad();}catch(e){}
      msg.style.color='#2ebd85';msg.innerHTML=(qtSide==='long'?'Long':'Short')+' '+sym+' '+L+'&times; opened — see it in <b>My Trades</b>.';
      try{if(window.__mpTrack)window.__mpTrack('paper',sym+' '+qtSide);}catch(e){}}
    var entry=qtPrice(sym);
    if(entry>0)open(entry);
    else{msg.style.color='#9aa3ad';msg.textContent='Fetching price…';fetch('/api/price?symbol='+encodeURIComponent(sym)).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){if(j&&j.price>0)open(+j.price);else{msg.style.color='#ff6258';msg.textContent='Could not get price. Try again.';}});} }
  function buildQT(){ qtEl=el('<div class="cqt-modal" hidden><div class="cqt-panel"><div class="cqt-head"><span>Quick Paper Trade</span><button class="cqt-x" type="button" aria-label="Close">&#10005;</button></div><label class="cqt-l">Symbol</label><select class="cqt-sym">'+SYMS.map(function(s){return '<option>'+s+'</option>';}).join('')+'</select><div class="cqt-side"><button type="button" class="on" data-side="long">Long</button><button type="button" class="cqt-short" data-side="short">Short</button></div><label class="cqt-l">Amount (USD)</label><input class="cqt-amt" type="number" value="100" min="0" inputmode="decimal"><label class="cqt-l cqt-levl">Leverage <span class="cqt-levv">10&times;</span></label><input class="cqt-lev" type="range" min="0" max="1000" value="333"><label class="cqt-adv"><input type="checkbox" class="cqt-adv-chk"><span class="cqt-adv-box"></span>Advanced &mdash; take-profit &amp; stop-loss</label><div class="cqt-adv-fields" hidden><div class="cqt-grid2"><div><label class="cqt-l">Take profit</label><input class="cqt-tp" type="number" min="0" inputmode="decimal"></div><div><label class="cqt-l">Stop loss</label><input class="cqt-sl" type="number" min="0" inputmode="decimal"></div></div></div><div class="cqt-info3"><div class="cqt-cell"><span>Entry</span><b class="cqt-entry">&mdash;</b></div><div class="cqt-cell"><span>Liq. price</span><b class="cqt-liq">&mdash;</b></div><div class="cqt-cell"><span>Position</span><b class="cqt-size">&mdash;</b></div></div><button class="cqt-open" type="button">Open position</button><div class="cqt-msg"></div></div></div>');
    document.body.appendChild(qtEl);
    qtEl.querySelector('.cqt-x').addEventListener('click',function(){qtEl.hidden=true;});
    qtEl.addEventListener('click',function(e){if(e.target===qtEl)qtEl.hidden=true;});
    qtEl.querySelector('.cqt-side').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;qtSide=b.getAttribute('data-side');this.querySelectorAll('button').forEach(function(x){x.classList.remove('on');});b.classList.add('on');updateQT();});
    qtEl.querySelector('.cqt-sym').addEventListener('change',updateQT);
    qtEl.querySelector('.cqt-lev').addEventListener('input',function(){qtLev=qtPosToLev(+this.value);updateQT();});
    qtEl.querySelector('.cqt-amt').addEventListener('input',updateQT);
    var advc=qtEl.querySelector('.cqt-adv-chk'),advf=qtEl.querySelector('.cqt-adv-fields');if(advc)advc.addEventListener('change',function(){advf.hidden=!advc.checked;});
    qtEl.querySelector('.cqt-open').addEventListener('click',doOpenPos);
    document.addEventListener('mp:price',function(ev){if(!qtEl||qtEl.hidden||!ev.detail)return;var ss=qtEl.querySelector('.cqt-sym');if(!ss||ev.detail.sym!==ss.value)return;if(qtEl._raf)return;qtEl._raf=true;requestAnimationFrame(function(){qtEl._raf=false;updateQT();});}); }
  function openQuickTrade(){ if(!qtEl)buildQT(); var sym=(wins.length&&wins[0].sym)||'BTC',sel=qtEl.querySelector('.cqt-sym'); for(var i=0;i<sel.options.length;i++)if(sel.options[i].value===sym){sel.selectedIndex=i;break;} qtSide='long'; var sb=qtEl.querySelector('.cqt-side'); sb.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-side')==='long');}); qtLev=10; var lr=qtEl.querySelector('.cqt-lev'); if(lr)lr.value=String(qtLevToPos(10)); var ac=qtEl.querySelector('.cqt-adv-chk'); if(ac)ac.checked=false; var af=qtEl.querySelector('.cqt-adv-fields'); if(af)af.hidden=true; qtEl.querySelector('.cqt-msg').textContent=''; qtEl.hidden=false; updateQT();
    if(!(qtPrice(sym)>0))fetch('/api/price?symbol='+encodeURIComponent(sym)).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){if(j&&j.price>0){if(window.mpLivePrices)window.mpLivePrices[sym]={p:+j.price,t:Date.now()};updateQT();}}); }
  // ---- movable calculator popup ----
  var calcEl=null;
  function fMoney(x){if(!isFinite(x))return '—';var n=Math.abs(x);return (x<0?'-$':'$')+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function doCalc(t,b){var v=function(id){var e=b.querySelector('#'+id);return e?parseFloat(e.value):NaN;},side=b._side||'long',res,rEl=b.querySelector('.cws-calc-res');
    if(t==='liq'){var en=v('clEntry'),lv=Math.max(1,v('clLev')||1);res=(isFinite(en)&&en>0)?('<span>Liquidation price</span><b style="color:#ff6258">'+fMoney(side==='long'?en*(1-(1-0.005)/lv):en*(1+(1-0.005)/lv))+'</b>'):'<span>Liquidation price</span><b>—</b>';}
    else if(t==='pnl'){var e2=v('cpEntry'),x2=v('cpExit'),am=v('cpAmt'),lv2=Math.max(1,v('cpLev')||1);if(isFinite(e2)&&isFinite(x2)&&e2>0&&am>0){var roi=(x2-e2)/e2*(side==='long'?1:-1),pnl=roi*am*lv2;res='<span>PnL · ROE</span><b style="color:'+(pnl>=0?'#2ebd85':'#ff6258')+'">'+(pnl>=0?'+':'')+fMoney(pnl)+'  ·  '+(roi*lv2>=0?'+':'')+(roi*lv2*100).toFixed(1)+'%</b>';}else res='<span>PnL · ROE</span><b>—</b>';}
    else{var bal=v('csBal'),rk=v('csRisk'),en3=v('csEntry'),st=v('csStop');if(isFinite(bal)&&isFinite(rk)&&isFinite(en3)&&isFinite(st)&&Math.abs(en3-st)>0){var ra=bal*rk/100,qty=ra/Math.abs(en3-st);res='<span>Position size</span><b>'+fMoney(qty*en3)+'</b> <small>'+qty.toLocaleString('en-US',{maximumFractionDigits:4})+' units · risk '+fMoney(ra)+'</small>';}else res='<span>Position size</span><b>—</b>';}
    if(rEl)rEl.innerHTML=res; }
  function renderCalc(t){var b=calcEl.querySelector('.cws-calc-body');
    function fld(id,lbl,val){return '<label class="cws-calc-l">'+lbl+'</label><input class="cws-calc-in" id="'+id+'" type="number" inputmode="decimal" value="'+(val!=null?val:'')+'">';}
    var side='<div class="cws-calc-side"><button type="button" class="on" data-cs="long">Long</button><button type="button" class="cws-calc-short" data-cs="short">Short</button></div>';
    if(t==='liq')b.innerHTML=fld('clEntry','Entry price','')+fld('clLev','Leverage','10')+side+'<div class="cws-calc-res"></div>';
    else if(t==='pnl')b.innerHTML=fld('cpEntry','Entry price','')+fld('cpExit','Exit price','')+fld('cpAmt','Margin (USD)','100')+fld('cpLev','Leverage','10')+side+'<div class="cws-calc-res"></div>';
    else b.innerHTML=fld('csBal','Account balance (USD)','1000')+fld('csRisk','Risk %','1')+fld('csEntry','Entry price','')+fld('csStop','Stop price','')+'<div class="cws-calc-res"></div>';
    b._side='long';
    b.oninput=function(){doCalc(t,b);};
    var sr=b.querySelector('.cws-calc-side');if(sr)sr.addEventListener('click',function(e){var bt=e.target.closest('button');if(!bt)return;this.querySelectorAll('button').forEach(function(x){x.classList.remove('on');});bt.classList.add('on');b._side=bt.getAttribute('data-cs');doCalc(t,b);});
    doCalc(t,b); }
  function buildCalc(){ calcEl=el('<div class="cws-calc" hidden><div class="cws-calc-h"><span>Calculator</span><button class="cws-calc-x" type="button" aria-label="Close">&#10005;</button></div><div class="cws-calc-tabs"><button type="button" class="on" data-ct="liq">Liquidation</button><button type="button" data-ct="pnl">PnL</button><button type="button" data-ct="size">Size</button></div><div class="cws-calc-body"></div><a class="cws-ext" href="https://chromewebstore.google.com/detail/fnfmgenngfmflcboejooaeiojnbcinkb" target="_blank" rel="noopener"><span class="cws-ext-ic"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg></span><span class="cws-ext-b"><b>Get the browser extension</b><span>This calculator in your toolbar — free</span></span><span class="cws-ext-go">Add &rarr;</span></a></div>');
    document.body.appendChild(calcEl);
    calcEl.querySelector('.cws-calc-x').addEventListener('click',function(){calcEl.hidden=true;});
    calcEl.querySelector('.cws-calc-tabs').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;this.querySelectorAll('button').forEach(function(x){x.classList.remove('on');});b.classList.add('on');renderCalc(b.getAttribute('data-ct'));});
    var h=calcEl.querySelector('.cws-calc-h');
    h.addEventListener('pointerdown',function(e){if(e.target.closest('button'))return;var r=calcEl.getBoundingClientRect(),ox=e.clientX-r.left,oy=e.clientY-r.top;try{h.setPointerCapture(e.pointerId);}catch(_){}
      function mv(ev){var x=Math.max(4,Math.min(ev.clientX-ox,window.innerWidth-calcEl.offsetWidth-4)),y=Math.max(4,Math.min(ev.clientY-oy,window.innerHeight-calcEl.offsetHeight-4));calcEl.style.left=x+'px';calcEl.style.top=y+'px';calcEl.style.right='auto';}
      function up(){h.removeEventListener('pointermove',mv);h.removeEventListener('pointerup',up);}
      h.addEventListener('pointermove',mv);h.addEventListener('pointerup',up);e.preventDefault();});
    renderCalc('liq'); }
  function openCalc(){ if(!calcEl)buildCalc(); calcEl.hidden=false; if(!calcEl.style.top){calcEl.style.right='20px';calcEl.style.top='96px';} }
  document.addEventListener('click',function(e){ var t=e.target;
    var tplB=t.closest&&t.closest('[data-tpl]');if(tplB){applyTemplate(tplB.getAttribute('data-tpl'));return;}
    if(t.closest&&(t.closest('#cwsAdd')||t.closest('[data-cws-add]'))){addWin();}
    else if(t.closest&&t.closest('#cwsSync')){toggleSync();}
    else if(t.closest&&t.closest('#cwsNote')){addNote();}
    else if(t.closest&&t.closest('#cwsTrade')){openQuickTrade();}
    else if(t.closest&&t.closest('#cwsCalc')){openCalc();}
    else if(t.closest&&t.closest('#cwsSave')){saveLayout();}
    else if(t.closest&&t.closest('#cwsLayouts')){openLayMenu(t.closest('#cwsLayouts'));}
    else if(t.closest&&t.closest('#cwsShare')){doShare();} });
  /* preset layouts: tile N charts edge-to-edge in a grid */
  /* pick a grid that keeps each cell roughly landscape (~1.55 wide:tall) — so 2 charts stack full-width instead of stretching tall, etc. */
  // pick cols×rows: prefer a TIGHT grid (few empty cells → 4 charts = 2×2, not 3×2) then the most landscape cell shape
  function gridFor(n,bw,bh){var best=null;for(var cols=1;cols<=n;cols++){var rows=Math.ceil(n/cols);var empty=cols*rows-n;var ar=(bw/cols)/(bh/rows);var sc=empty*0.6+Math.abs(Math.log(ar/1.5));if(best===null||sc<best.sc)best={cols:cols,rows:rows,sc:sc};}return best||{cols:1,rows:n};}
  function applyPreset(n){ if(!n)return; if(isMobile()){ wins.slice().forEach(function(w){closeWin(w);}); addWin({sym:'BTC',tf:'60'}); return; }
    wins.slice().forEach(function(w){closeWin(w);});
    var bw=board.clientWidth||900,bh=board.clientHeight||600,gap=8;
    var g=gridFor(n,bw,bh),cols=g.cols,rows=g.rows;
    var cw=Math.floor((bw-gap*(cols+1))/cols), chh=Math.floor((bh-gap*(rows+1))/rows);
    for(var i=0;i<n;i++){var r=Math.floor(i/cols),c=i%cols;addWin({x:gap+c*(cw+gap),y:gap+r*(chh+gap),w:cw,h:chh});}
  }
  /* re-tile the CURRENT windows (keeps their symbols/data) to fill the board — used when the sidebar collapses so charts reclaim the freed space */
  function reflowWins(){if(isMobile()||!wins.length)return;var bw=board.clientWidth||900,bh=board.clientHeight||600,gap=8,n=wins.length;var g=gridFor(n,bw,bh),cols=g.cols,rows=g.rows;var cw=Math.floor((bw-gap*(cols+1))/cols),chh=Math.floor((bh-gap*(rows+1))/rows);wins.forEach(function(w,i){var r=Math.floor(i/cols),c=i%cols;w.el.style.left=(gap+c*(cw+gap))+'px';w.el.style.top=(gap+r*(chh+gap))+'px';w.el.style.width=cw+'px';w.el.style.height=chh+'px';});try{savePersist();}catch(e){}try{window.dispatchEvent(new Event('resize'));}catch(e){}}
  function openSymbolW(sym){sym=String(sym||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!sym||isMobile())return;if(wins.length<MAXn()){addWin({sym:sym,tf:'60'});setTimeout(reflowWins,40);return;}var w=wins[wins.length-1];if(!w)return;w.sym=sym;var inp=w.el.querySelector('.cwin-sym');if(inp)inp.value=sym;loadData(w,true);try{updateMTBtn(w);}catch(e){}bringFront(w);}
  /* open a coin from "Top signals" → fully-drawn 4h chart (EMA21/50 + RSI + MACD) + a "why this is a good setup" panel with the 50–100x setup */
  function clearSetupLines(w){if(w&&w._setupLines){w._setupLines.forEach(function(l){try{w.candle.removePriceLine(l);}catch(e){}});w._setupLines=null;}}
  function drawSetupLines(w,su){if(!w||!w.candle||!su)return;clearSetupLines(w);w._setupLines=[];
    function pl(price,color,style,title,width){if(price==null||!isFinite(+price))return;try{w._setupLines.push(w.candle.createPriceLine({price:+price,color:color,lineWidth:width||1,lineStyle:style,axisLabelVisible:true,title:title}));}catch(e){}}
    pl(su.entry,'#3fd8e6',0,'ENTRY',2);pl(su.sl,'#ff3b3b',2,'STOP',1);pl(su.tp1,'#2ebd85',3,'TP1',1);pl(su.tp2,'#2ebd85',3,'TP2',1);pl(su.tp3,'#2ebd85',3,'TP3',1);}
  function su_fmt(v){v=+v;if(!isFinite(v))return '—';var a=Math.abs(v);var d=a<1?5:a<100?3:2;return v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});}
  function su_row(label,val,col){return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:2.5px 0;"><span style="color:#8d96a1;">'+label+'</span><span style="font-family:\'Space Mono\',monospace;font-weight:700;color:'+(col||'#cdd3da')+';">'+val+'</span></div>';}
  var setupPanel=null,setupW=null;
  function hideSetupPanel(){if(setupPanel){try{setupPanel.remove();}catch(e){}}setupPanel=null;setupW=null;}
  function showSetupPanel(sym,info,w){
    var su=info&&info.setup,score=info&&typeof info.score==='number'?info.score:null;
    var col=score==null?'#7f8893':score>=75?'#2ebd85':score>=55?'#c2f64a':score>=45?'#ffb347':'#ff6258';
    var long=su&&su.dir==='long';
    if(!setupPanel){setupPanel=document.createElement('div');setupPanel.id='cwsSetup';setupPanel.style.cssText='position:fixed;right:14px;top:50%;transform:translateY(-50%);width:296px;max-height:88vh;overflow-y:auto;z-index:60;background:linear-gradient(180deg,rgba(13,16,21,.98),rgba(9,11,15,.98));backdrop-filter:blur(8px);border:1px solid #232a33;border-radius:14px;box-shadow:0 30px 70px -24px rgba(0,0,0,.9);font-family:\'Familjen Grotesk\',sans-serif;color:#e6eaef;scrollbar-width:thin;';document.body.appendChild(setupPanel);}
    setupW=w;
    var sig=(info&&info.sig)||[];
    var reasons=sig.length?sig.map(function(s){return '<li>'+escHtml(s)+'</li>';}).join(''):'<li>Aligned technical signals on the 4-hour chart.</li>';
    var setupCard=su?('<div style="margin-top:12px;border:1px solid '+(long?'rgba(46,189,133,.4)':'rgba(255,98,88,.4)')+';border-radius:11px;padding:11px 12px;background:'+(long?'rgba(46,189,133,.06)':'rgba(255,98,88,.06)')+';">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;"><span style="font-family:\'Space Mono\',monospace;font-weight:800;font-size:13px;letter-spacing:.06em;color:'+(long?'#2ebd85':'#ff6258')+';">'+(long?'▲ LONG':'▼ SHORT')+'</span><span style="font-family:\'Space Mono\',monospace;font-size:11px;font-weight:800;color:#c2f64a;border:1px solid rgba(194,246,74,.5);border-radius:6px;padding:2px 8px;">'+su.lev+'x</span></div>'
      +su_row('Entry',su_fmt(su.entry),'#cdd3da')+su_row('Stop loss',su_fmt(su.sl),'#ff6258')+su_row('Target 1',su_fmt(su.tp1),'#2ebd85')+su_row('Target 2',su_fmt(su.tp2),'#2ebd85')+su_row('Target 3',su_fmt(su.tp3),'#2ebd85')+su_row('Risk : reward','1 : '+(su.rrr||1.5),'#cdd3da')
      +'<div style="margin-top:9px;font-size:10.5px;line-height:1.4;color:#ff9a90;">⚠ '+su.lev+'x is extreme risk — a ~'+(100/su.lev).toFixed(1)+'% move against you = liquidation. Always use the stop and size small.</div>'
      +'<div style="display:flex;gap:7px;margin-top:10px;"><button id="cwsSetupDraw" type="button" style="flex:1;background:#13343c;border:1px solid #2e6f7c;color:#9fe7f0;border-radius:8px;padding:8px;font-family:\'Space Mono\',monospace;font-size:11px;font-weight:700;cursor:pointer;">Draw on chart</button><a href="/paper-trade?coin='+encodeURIComponent(sym)+'&side='+(long?'long':'short')+'&lev='+su.lev+'&sl='+(+su.sl).toFixed(6)+'&tp='+(+su.tp1).toFixed(6)+'" style="flex:1;text-align:center;background:rgba(194,246,74,.12);border:1px solid rgba(194,246,74,.5);color:#c2f64a;border-radius:8px;padding:8px;font-family:\'Space Mono\',monospace;font-size:11px;font-weight:700;text-decoration:none;">Practice →</a></div>'
      +'</div>'):'<div style="margin-top:12px;font-size:12px;color:#8d96a1;line-height:1.5;">No high-conviction setup right now — the chart is loaded with EMA, RSI and MACD so you can read it yourself.</div>';
    setupPanel.innerHTML=''
      +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:12px 13px 0;">'
        +'<div style="min-width:0;"><div style="font-family:\'Space Mono\',monospace;font-weight:800;font-size:16px;letter-spacing:.04em;">'+escHtml(sym)+'</div><div style="font-size:11.5px;color:'+col+';font-weight:700;margin-top:2px;">'+escHtml((info&&info.verdict)||'Chart loaded')+'</div></div>'
        +(score!=null?'<div style="font-family:\'Space Mono\',monospace;font-weight:800;font-size:18px;color:'+col+';border:1.5px solid '+col+';border-radius:9px;padding:4px 9px;flex:0 0 auto;">'+score+'</div>':'')
        +'<button id="cwsSetupX" type="button" aria-label="Close" style="background:none;border:none;color:#7f8893;font-size:17px;cursor:pointer;line-height:1;padding:2px 0 0 2px;flex:0 0 auto;">✕</button>'
      +'</div>'
      +'<div style="padding:11px 13px 13px;">'
        +'<div style="font-family:\'Space Mono\',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:#7f8893;margin-bottom:6px;">Why this is a good setup</div>'
        +'<ul style="margin:0;padding-left:16px;font-size:12.5px;line-height:1.55;color:#cdd3da;">'+reasons+'</ul>'
        +(info&&(info.rsi!=null||info.trend||info.atrPct!=null)?'<div style="margin-top:9px;font-size:11px;color:#8d96a1;">'+(info.trend?'Trend <b style="color:#cdd3da;">'+escHtml(String(info.trend))+'</b>':'')+(info.rsi!=null?' · RSI <b style="color:#cdd3da;">'+info.rsi+'</b>':'')+(info.atrPct!=null?' · ATR <b style="color:#cdd3da;">'+info.atrPct+'%</b>':'')+'</div>':'')
        +setupCard
      +'</div>';
    var x=setupPanel.querySelector('#cwsSetupX');if(x)x.onclick=hideSetupPanel;
    var dr=setupPanel.querySelector('#cwsSetupDraw');if(dr&&su)dr.onclick=function(){drawSetupLines(setupW,su);dr.textContent='Drawn ✓';setTimeout(function(){dr.textContent='Draw on chart';},1400);};
  }
  function su_ready(w,fn,tries){tries=tries||0;if(w&&w.candle&&w.bars&&w.bars.length){fn();return;}if(tries>45)return;setTimeout(function(){su_ready(w,fn,tries+1);},150);}
  function openSetupW(sym,info){sym=String(sym||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!sym||isMobile())return;
    var w=null,i;for(i=0;i<wins.length;i++){if(wins[i].sym===sym){w=wins[i];break;}}
    var fresh=false;
    if(!w){if(wins.length<MAXn()){addWin({sym:sym,tf:'240',inds:{ema:true,rsi:true,macd:true}});w=wins[wins.length-1];fresh=true;}else{w=wins[wins.length-1];if(!w)return;w.sym=sym;var inp=w.el.querySelector('.cwin-sym');if(inp)inp.value=sym;}}
    if(w){w.tf='240';w.inds=w.inds||{};w.inds.ema=true;w.emaList=[21,50];w.inds.rsi=true;w.inds.macd=true;
      try{Array.prototype.forEach.call(w.el.querySelectorAll('.cwin-tf button'),function(b){b.classList.toggle('on',b.getAttribute('data-tf')==='240');});}catch(e){}
      loadData(w,true);try{updateMTBtn(w);}catch(e){}bringFront(w);try{updateIndN(w);}catch(e){}
      su_ready(w,function(){try{applyInds(w);}catch(e){}try{drawSetupLines(w,info&&info.setup);}catch(e){}});}
    if(fresh)setTimeout(reflowWins,40);
    showSetupPanel(sym,info,w);}
  /* one-click starter templates from the empty state */
  var TEMPLATES={
    scalp:{wins:[{sym:'BTC',tf:'5',inds:{sig:true,ema:true}}]},
    swing:{wins:[{sym:'BTC',tf:'240',inds:{ema:true,sma:true}}]},
    btcmtf:{wins:[{sym:'BTC',tf:'15'},{sym:'BTC',tf:'60'}]},
    top3:{wins:[{sym:'BTC',tf:'60'},{sym:'ETH',tf:'60'},{sym:'SOL',tf:'60'}]}
  };
  function applyTemplate(key){var t=TEMPLATES[key];if(!t)return;
    wins.slice().forEach(function(w){closeWin(w);});
    if(isMobile()){addWin(t.wins[0]);return;}
    var n=t.wins.length,bw=board.clientWidth||900,bh=board.clientHeight||600,gap=8;
    var cols=n<=1?1:n<=2?2:3,rows=Math.ceil(n/cols);
    var cw=Math.floor((bw-gap*(cols+1))/cols),chh=Math.floor((bh-gap*(rows+1))/rows);
    t.wins.forEach(function(cfg,i){var r=Math.floor(i/cols),c=i%cols;var o={};for(var k in cfg)o[k]=cfg[k];o.x=gap+c*(cw+gap);o.y=gap+r*(chh+gap);o.w=cw;o.h=chh;addWin(o);});
    savePersist();
  }
  document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('.cws-tile[data-preset]');if(b){var n=parseInt(b.getAttribute('data-preset'),10);if(n)applyPreset(n);}});
  function buildInitial(){showEmpty(true);var sn=loadNotes();if(sn&&sn.length)sn.forEach(function(c){addNote(c);});} // opens EMPTY by owner request (no auto-restore); saved named layouts remain in the Layouts menu
  function showMobileNote(){var bd=document.getElementById('cwsBoard');if(!bd)return;showEmpty(false);var d=el('<div class="cws-mobile-note"><div class="cws-mn-ic"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div><h3>Charts works best on desktop</h3><p>The multi-window workspace — drag, resize, indicators &amp; drawing — needs more room than a phone offers. Open <b>marginpad.io/charts</b> on your computer for the full experience.</p><button type="button" class="cws-mn-btn" id="cwsMnGo">Continue anyway</button></div>');bd.appendChild(d);var go=d.querySelector('#cwsMnGo');if(go)go.addEventListener('click',function(){if(d.parentNode)d.parentNode.removeChild(d);buildInitial();});}
  function loadMC(){try{return JSON.parse(localStorage.getItem('mp_mchart')||'{}')||{};}catch(e){return {};}}
  function saveMC(o){try{localStorage.setItem('mp_mchart',JSON.stringify(o));}catch(e){}}
  /* Mobile Charts — a single full-screen live chart (symbol search, timeframes, indicators, My-Trades lines, quick trade).
     Reuses the desktop indicator math + loadData/liveTick/applyInds via a window-shaped object. */
  function buildMobileChart(){
    var bd=document.getElementById('cwsBoard'); if(!bd)return; showEmpty(false);
    var MTFS=[['1','1m'],['5','5m'],['15','15m'],['60','1H'],['240','4H'],['1440','1D']];
    var sv=loadMC(); var mw={sym:(sv.sym||'BTC'),tf:(sv.tf||'60'),inds:(sv.inds||{}),emaP:21,smaP:50,bars:[],dead:false,id:1,mobile:true};
    var tfHtml=MTFS.map(function(t){return '<button type="button" data-mtf="'+t[0]+'"'+(t[0]===mw.tf?' class="on"':'')+'>'+t[1]+'</button>';}).join('');
    var toolsHtml='<div class="cwin-tools"><button class="cwin-tool on" data-tool="pen" title="Freehand">✎</button><button class="cwin-tool" data-tool="trend" title="Trend line">╱</button><button class="cwin-tool" data-tool="hline" title="Horizontal">―</button><button class="cwin-tool" data-tool="vline" title="Vertical">│</button><button class="cwin-tool" data-tool="fib" title="Fib retracement">F</button><button class="cwin-tool" data-tool="alert" title="Set price alert at a level">🔔</button><span class="cwin-color on" data-color="#3fd8e6" style="background:#3fd8e6"></span><span class="cwin-color" data-color="#c2f64a" style="background:#c2f64a"></span><span class="cwin-color" data-color="#ff6258" style="background:#ff6258"></span><span class="cwin-color" data-color="#ffffff" style="background:#fff"></span><button class="cwin-tool cwin-undo" data-undo title="Undo last">↶</button><button class="cwin-tool cwin-clear" data-clear title="Clear all">Clear</button></div>';
    var drawIcon='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
    var wrap=el('<div class="cwm"><div class="cwm-bar"><input class="cwm-sym" readonly value="'+mw.sym+'"><button class="cwm-draw cwin-draw-tg" type="button" title="Draw" aria-label="Draw">'+drawIcon+'</button><button class="cwm-ind" type="button">Indicators<span class="n"></span></button></div><div class="cwm-tf">'+tfHtml+'</div><div class="cwm-chart"></div><div class="cwm-foot"><button class="cwm-mt" type="button" hidden>My Trades</button><button class="cwm-trade" type="button">Trade '+mw.sym+' →</button></div></div>');
    bd.innerHTML=''; bd.appendChild(wrap); mw.el=wrap;
    var symInput=wrap.querySelector('.cwm-sym'),tfWrap=wrap.querySelector('.cwm-tf'),indBtn=wrap.querySelector('.cwm-ind'),indN=indBtn.querySelector('.n'),mtBtn=wrap.querySelector('.cwm-mt'),tradeBtn=wrap.querySelector('.cwm-trade');
    function persist(){saveMC({sym:mw.sym,tf:mw.tf,inds:mw.inds});}
    function indN_(){var n=0;for(var k in mw.inds)if(mw.inds[k])n++;indN.textContent=n?(' '+n):'';indBtn.classList.toggle('on',n>0);}
    function updMT(){var has=hasTrades(mw.sym);mtBtn.hidden=!has;mtBtn.classList.toggle('on',!!mw.mtOn);}
    loadLib(function(){ if(!window.LightweightCharts)return; var host=wrap.querySelector('.cwm-chart');
      try{ mw.chart=LightweightCharts.createChart(host,{layout:{background:{color:'transparent'},textColor:'#9aa3ad',fontFamily:"'Familjen Grotesk',system-ui,sans-serif",attributionLogo:false},grid:{vertLines:{color:'rgba(35,41,50,.3)'},horzLines:{color:'rgba(35,41,50,.3)'}},rightPriceScale:{borderColor:'#232932'},timeScale:{borderColor:'#232932',timeVisible:true,secondsVisible:false,rightOffset:5,barSpacing:5},crosshair:{mode:1},autoSize:true});
        mw.candle=mw.chart.addCandlestickSeries({upColor:'#10b981',downColor:'#ef4444',borderVisible:false,wickUpColor:'#10b981',wickDownColor:'#ef4444'});
        var lg=document.createElement('div');lg.className='cwin-leg';host.appendChild(lg);mw.legEl=lg;
        try{mw.chart.subscribeCrosshairMove(function(p){cwLeg(mw,p);});}catch(e){}
      }catch(e){return;}
      // add the draw overlay AFTER the chart exists, so it's guaranteed present + on top (LWC owns the host)
      try{var dcv=document.createElement('canvas');dcv.className='cwin-draw';host.appendChild(dcv);var tw=el(toolsHtml);if(tw)host.appendChild(tw);setupDraw(mw,host);wireDrawTools(mw,wrap.querySelector('.cwin-draw-tg'),tw);}catch(e){}
      loadData(mw,true); indN_(); updMT();
    });
    symInput.addEventListener('click',function(){openSymMenu(symInput,mw);});
    function clearDrawMW(){if(mw.dr){mw.dr.shapes=[];mw.dr.cur=null;if(mw.dr.redraw)mw.dr.redraw();}}
    symInput.addEventListener('change',function(){var v=String(symInput.value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!v)return;mw.sym=v;symInput.value=v;tradeBtn.textContent='Trade '+v+' →';mw.mtOn=false;clearDrawMW();loadData(mw,true);try{importTrades(mw);}catch(e){}updMT();persist();});
    tfWrap.addEventListener('click',function(e){var b=e.target.closest('[data-mtf]');if(!b)return;Array.prototype.forEach.call(tfWrap.querySelectorAll('button'),function(x){x.classList.remove('on');});b.classList.add('on');mw.tf=b.getAttribute('data-mtf');clearDrawMW();loadData(mw,true);persist();});
    indBtn.addEventListener('click',function(){
      var sheet=el('<div class="cwm-sheet"><div class="cwm-sheet-p"><div class="cwm-sheet-h">Indicators<button class="cwm-sheet-x" type="button">✕</button></div><div>'+INDS.map(function(t){return '<button type="button" class="cwm-ind-opt'+(mw.inds[t[0]]?' on':'')+'" data-ind="'+t[0]+'"><span>'+t[1]+'</span><span class="dot"></span></button>';}).join('')+'</div></div></div>');
      document.body.appendChild(sheet);requestAnimationFrame(function(){sheet.classList.add('on');});
      function close(){sheet.classList.remove('on');setTimeout(function(){if(sheet.parentNode)sheet.parentNode.removeChild(sheet);},280);}
      sheet.addEventListener('click',function(e){if(e.target===sheet||e.target.closest('.cwm-sheet-x')){close();return;}var o=e.target.closest('[data-ind]');if(o){var k=o.getAttribute('data-ind');mw.inds[k]=!mw.inds[k];o.classList.toggle('on',!!mw.inds[k]);try{applyInds(mw);}catch(e2){}indN_();persist();}});
    });
    mtBtn.addEventListener('click',function(){mw.mtOn=!mw.mtOn;try{importTrades(mw);}catch(e){}updMT();});
    tradeBtn.addEventListener('click',function(){location.href='/paper-trade?coin='+encodeURIComponent(mw.sym);});
    document.addEventListener('mp:price',function(ev){ if(!ev.detail||!mw.candle||mw.dead)return; if(ev.detail.sym!==mw.sym)return; var p=+ev.detail.price; if(!(p>0))return; mw._wsT=Date.now(); if(mw._raf)return; mw._raf=true; requestAnimationFrame(function(){mw._raf=false;liveTick(mw,p);}); });
    mw.poll=setInterval(function(){ if(mw.dead||!mw.candle)return; if(mw._wsT&&Date.now()-mw._wsT<30000)return; fetch('/api/price?symbol='+encodeURIComponent(mw.sym),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){if(j&&!mw.dead){var px=+(j.price||j.p||j.last||0);if(px>0)liveTick(mw,px);}}); },12000);
    document.addEventListener('visibilitychange',function(){if(!document.hidden&&mw.candle&&!mw.dead)loadData(mw,false);});
    window.addEventListener('storage',updMT);
  }
  window.mpCharts={ activate:function(){ if(built)return; built=true; setTimeout(function(){ if(isMobile()){buildMobileChart();return;} buildInitial(); if(/^\/charts\/?$/.test(location.pathname)){try{document.body.classList.remove('cws-side-off');localStorage.setItem('mp_cws_side','1');}catch(e){}} },40); }, // /charts lands with the workspace TOOLS side panel open (not Browse) — owner request
    setTheme:function(m){chTheme=(m==='light')?'light':'dark';try{localStorage.setItem('mp_ch_theme',chTheme);}catch(e){}applyTheme();},
    getTheme:function(){return chTheme;},
    reflow:function(){try{reflowWins();}catch(e){}},
    openSymbol:function(sym){try{openSymbolW(sym);}catch(e){}},
    openSetup:function(sym,info){try{openSetupW(sym,info);}catch(e){}} };
  if(/^\/charts\/?$/.test(location.pathname)){try{window.mpCharts.activate();}catch(e){}}
})();
