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
window.__mpWsSeen=window.__mpWsSeen||{};window.__mpPQ=window.__mpPQ||function(ctx,sym){try{var t=window.__mpWsSeen[sym];return '&px='+ctx+'&pxw='+((t&&Date.now()-t<15000)?1:0);}catch(e){return '';}};if(!window.__mpWsL){window.__mpWsL=1;try{document.addEventListener('mp:price',function(ev){if(ev&&ev.detail&&ev.detail.sym)window.__mpWsSeen[ev.detail.sym]=Date.now();});}catch(e){}} /* TEMP pxtag until 2026-09-01 — DELETE with the pxtag round */
/* My Trades drawer + price feed + Trader Chat — shared widget logic (ported from the homepage).
   View-only journal on pages without the Paper Trade form (add() simply finds no form and no-ops). */

/* Balance-Mode ticket check — see home.js for the full rationale (durable mp_bal_tags map, not the strippable
   e.bal field, so the gold/BAL never flickers). Guard-defined so whichever of home.js/mp-trade.js loads first wins. */
window.mpBalTkt = window.mpBalTkt || (function () { var c = null, t = 0; return function (e) { if (!e) return false; if (e.bal) return true; if (!e.id) return false; var n = Date.now(); if (!c || n - t > 1200) { try { c = JSON.parse(localStorage.getItem('mp_bal_tags') || '{}') || {}; } catch (x) { c = {}; } t = n; } return !!c[e.id]; }; })();

/* Season stats reset — mirror of home.js (guard: whichever bundle loads first wins; the bento homepage loads
   mp-trade.js WITHOUT home.js, so the definition must live in both). See home.js for the full rationale. */
window.mpSsnStart = window.mpSsnStart || function () { var A = Date.UTC(2026, 6, 20), n = Date.now(); if (n < Date.UTC(2026, 7, 17)) return 0; return A + Math.floor((n - A) / 1209600000) * 1209600000; };
window.mpSsnShow = window.mpSsnShow || function (e) { var s = window.mpSsnStart(); return !s || !e || ((+e.closeTs || +e.ts || 0) >= s); };

/* Disable pinch-zoom on iOS (Safari ignores user-scalable=no in the viewport meta). */
(function(){['gesturestart','gesturechange','gestureend'].forEach(function(g){document.addEventListener(g,function(e){e.preventDefault();},{passive:false});});})();

/* ---------- My Trades journal / drawer ---------- */
(function(){
  var KEY='mp_journal';
  function MT(k,d){return (window.mpT&&window.mpT(k))||d;}
  function load(){try{return JSON.parse(localStorage.getItem(KEY))||[];}catch(e){return [];}}
  function store(a){try{localStorage.setItem(KEY,JSON.stringify(a));}catch(e){}}
  function esc(s){return String(s).replace(/[<>&]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}
  function money(x){x=+x||0;var n=x<0;x=Math.abs(x);return (n?'-$':'$')+x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function num(id){var e=document.getElementById(id);var v=e?parseFloat(e.value):NaN;return isFinite(v)?v:NaN;}
  var jrTab='open';var jrShow=50;/* RENDER WINDOW. The list used to build a DOM card for every closed trade and hand the lot to innerHTML in one go; a heavy account froze Chrome on Android outright (reported 2026-08-15). Bounded here, extended on demand. Reset whenever the tab changes. */
  var SHARE_SVG='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"></line><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"></line></svg>';
  var CHATSHARE_SVG='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"></path></svg>';
  var COPY_SVG='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
  var CHART_SVG='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;vertical-align:-1px"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/></svg>';
  var TRASH_SVG='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
  function gotoChart(sym){location.href='/paper-trade'+(sym?'?coin='+encodeURIComponent(sym):'');}
  function ppActions(e,close){return '<div class="pp-actions"><div class="pp-icons"><button class="pp-ic pp-ic-chat" data-act="chatshare" data-id="'+e.id+'" title="'+MT('jShareChat','Share to chat')+'" aria-label="'+MT('jShareChat','Share to chat')+'">'+CHATSHARE_SVG+'</button><button class="pp-ic" data-act="share" data-id="'+e.id+'" title="'+MT('jShare','Share')+'" aria-label="'+MT('jShare','Share')+'">'+SHARE_SVG+'</button></div>'+(close?'<button class="pp-close" data-act="close" data-id="'+e.id+'">'+MT('jCloseBtn','Close')+'</button>':'')+'</div>';}
  function fp(x){x=+x||0;return '$'+x.toLocaleString('en-US',{maximumFractionDigits:x>=100?2:x>=1?4:8});}
  function pctS(x){return ((+x)>=0?'+':'')+(+x).toFixed(2)+'%';}
  function dur(ms){var s=Math.floor(ms/1000);if(s<60)return s+'s';var m=Math.floor(s/60);if(m<60)return m+'m';var h=Math.floor(m/60);if(h<24)return h+'h '+(m%60)+'m';return Math.floor(h/24)+'d '+(h%24)+'h';}
  function tsf(t){if(!t)return '';var d=new Date(t),MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return d.getDate()+' '+MO[d.getMonth()]+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
  function metrics(e){var px=window.mpLivePrices||{};var live=(px[e.sym]&&px[e.sym].p)||(e.status!=='open'&&e.exit)||e.entry;var long=e.side!=='short',lev=(+e.lev>0)?+e.lev:1;var move=(live-e.entry)/e.entry*(long?1:-1);var gross=(e.qty!=null&&isFinite(e.qty))?e.qty*(live-e.entry)*(long?1:-1):null;var pnl=(gross!=null)?gross-(+e.fund||0):null;var margin=(+e.margin>0)?+e.margin:(e.notional&&lev?e.notional/lev:null);var roe=(pnl!=null&&margin>0)?pnl/margin:move*lev;var liq=e.liq||(long?e.entry*(1-(1-(e.mmr||0.005))/lev):e.entry*(1+(1-(e.mmr||0.005))/lev));var liqDist=(live-liq)/live*100*(long?1:-1);if(margin>0){var _op=e.status!=='win'&&e.status!=='loss';var _pf=_op?-margin*0.99:-margin;if(pnl!=null&&pnl<_pf)pnl=_pf;var _rf=_op?-0.99:-1;if(roe<_rf)roe=_rf;}/* open caps at -99% until real liquidation */return {live:live,long:long,lev:lev,move:move,roe:roe,pnl:pnl,liq:liq,liqDist:liqDist,margin:margin};}
  function openCard(e){var m=metrics(e),long=m.long,cls=(m.pnl!=null?(m.pnl>0?'pf':(m.pnl<0?'ls':'be')):(m.move>0?'pf':(m.move<0?'ls':'be')));
    return '<div class="pp '+cls+(window.mpBalTkt(e)?' pp-gold':'')+(window.mpTktSkin?' tsk-'+window.mpTktSkin:'')+'" data-id="'+e.id+'">'+ppActions(e,true)
      +'<div class="pp-h"><span class="pp-sym">'+esc(e.sym||'—')+'</span><span class="pp-dir '+(long?'long':'short')+'">'+(long?'LONG':'SHORT')+'</span>'+(window.mpBalTkt(e)?'<span class="pp-bal">BAL</span>':'')+'<span class="pp-live">'+(e.lev||1)+'× · '+fp(m.live)+'</span></div>'
      +'<div class="pp-pnl"><span class="big">'+(m.pnl!=null?((m.pnl>=0?'+':'−')+money(Math.abs(m.pnl)).replace('-','')):pctS(m.move*100))+'</span><span class="roe">ROE '+pctS(m.roe*100)+'</span></div>'
      +'<div class="pp-perf"></div>'
      +'<div class="pp-meta">'
        +'<div><span>'+MT('jEntry','Entry')+'</span><b>'+fp(e.entry)+'</b></div>'
        +'<div><span>'+MT('jMargin2','Margin')+'</span><b>'+(m.margin!=null?money(m.margin):'—')+'</b></div>'
        +'<div><span>'+MT('jValue','Value')+'</span><b>'+((m.margin!=null)?money(m.margin*((+e.lev>0)?+e.lev:1)):'—')+'</b></div>'
        +'<div><span>'+MT('jQty2','Qty')+'</span><b>'+((e.qty!=null&&isFinite(e.qty))?(+e.qty).toLocaleString('en-US',{maximumFractionDigits:6}):'—')+'</b></div>'
        +'<div><span>'+MT('jLiq2','Liq')+'</span><b>'+fp(m.liq)+'</b></div>'
        +'<div><span>'+MT('jBuffer','Buffer')+'</span><b class="ppb">'+pctS(m.liqDist)+'</b></div>' /* .ppb = updated in place by the live ticker */
        +'<div><span>SL</span><b>'+(window.mpLvlTxt?window.mpLvlTxt(e,false,fp):(e.stop!=null?fp(e.stop):'—'))+'</b></div>'
        +'<div><span>TP</span><b>'+(window.mpLvlTxt?window.mpLvlTxt(e,true,fp):(e.tp!=null?fp(e.tp):'—'))+'</b></div>'
      +'</div>'
      +'<div class="pp-foot">'+dur(Date.now()-e.ts)+' '+MT('jOpenLc','open')+'</div>'
      +'<div class="pp-btns"><button class="ch" data-act="chart" data-id="'+e.id+'">'+CHART_SVG+MT('jChart','Chart')+'</button><button class="pt" data-act="ptrade" data-id="'+e.id+'">'+MT('jPaperTrade','Paper Trade')+'</button><button class="ed" data-act="sltp" data-id="'+e.id+'">SL/TP</button></div>'
      +'<div class="pp-times">'+MT('jOpened','Opened')+' '+tsf(e.ts)+'</div></div>';}
  
  /* fee breakdown (P1 realism): itemize what this closed trade actually cost */
  function feeBrk(e){var qty=+e.qty||0,fr=+e.feeRate||0,entry=+e.entry||0,exit=(e.exit!=null?+e.exit:entry);
    var fo=qty*entry*fr,fc=qty*exit*fr,fu=+e.fund||0;
    var MJ={BTC:1,ETH:1,SOL:1,BNB:1,XRP:1,DOGE:1,ADA:1,LINK:1,AVAX:1,LTC:1};
    var slip=(e.src==='srv')?qty*entry*(MJ[String(e.sym||'').toUpperCase()]?0.0001:0.0005):null;
    return {fo:fo,fc:fc,fu:fu,slip:slip,total:fo+fc+fu};}
  function feeF(v){v=Math.abs(v);return '$'+(v>=0.005?v.toFixed(2):v.toFixed(4));}
  function feeHas(e){return (e.status==='win'||e.status==='loss')&&((+e.feeRate>0)||(+e.fund));}
  function feeLbl(e){var b=feeBrk(e);return (b.total<0?'+':'\u2212')+feeF(b.total);}
  function feeBdHtml(e){var b=feeBrk(e);
    return '<div class="pp-feebd" data-fbwrap><div class="fb-h">'+MT('jFeeBd','What this trade cost')+'<span class="fb-x" data-fbx role="button" aria-label="Close">\u2715</span></div>'
      +'<div class="fb-r"><span>'+MT('jFeeOpen','Open fee')+' <i>(0.055%)</i></span><b>\u2212'+feeF(b.fo)+'</b></div>'
      +'<div class="fb-r"><span>'+MT('jFeeClose','Close fee')+' <i>(0.055%)</i></span><b>\u2212'+feeF(b.fc)+'</b></div>'
      +(b.fu?'<div class="fb-r"><span>'+MT('jFeeFund','Funding')+' <i>(8h)</i></span><b'+(b.fu<0?' class="fb-rec"':'')+'>'+(b.fu<0?'+'+feeF(b.fu)+' '+MT('jFeeRec','received'):'\u2212'+feeF(b.fu))+'</b></div>':'')
      +((b.slip!=null&&b.slip>0)?'<div class="fb-r fb-dim"><span>'+MT('jFeeSlip','Entry slippage')+'</span><b>\u2248 \u2212'+feeF(b.slip)+' <i>'+MT('jFeeSlipN','(in the fill price)')+'</i></b></div>':'')
      +'<div class="fb-t"><span>'+MT('jFeeTot','Total costs')+'</span><b'+(b.total<0?' class="fb-rec"':'')+'>'+(b.total<0?'+':'\u2212')+feeF(b.total)+'</b></div>'
      +'<div class="fb-n">'+MT('jFeeNote','Already settled into this P&L \u2014 the same costs a real exchange charges.')+'</div></div>';}
  if(!window._mpFeeWired){window._mpFeeWired=1;
    document.addEventListener('click',function(ev){
      var x=ev.target.closest&&ev.target.closest('[data-fbx]');
      if(x){var w=x.closest('.pp-feebd');if(w)w.classList.remove('on');ev.stopPropagation();ev.preventDefault();return;}
      var f=ev.target.closest&&ev.target.closest('.pp-fee');
      if(f){ev.stopPropagation();ev.preventDefault();
        var card=f.closest('.pp');if(!card)return;
        var bd=card.querySelector('.pp-feebd');if(!bd)return;
        var was=bd.classList.contains('on');
        try{document.querySelectorAll('.pp-feebd.on').forEach(function(o){o.classList.remove('on');});}catch(_){}
        if(!was)bd.classList.add('on');
        return;}
      try{document.querySelectorAll('.pp-feebd.on').forEach(function(o){if(!o.contains(ev.target))o.classList.remove('on');});}catch(_){}
    },true);}

  function closedCard(e){var win=((+e.pnl)>=0),cls=win?'pf':'ls',long=e.side!=='short';
    return '<div class="pp '+cls+(window.mpBalTkt(e)?' pp-gold':'')+(window.mpTktSkin?' tsk-'+window.mpTktSkin:'')+'" data-id="'+e.id+'">'+ppActions(e)
      +'<div class="pp-h"><span class="pp-sym">'+esc(e.sym||'—')+'</span><span class="pp-dir '+(long?'long':'short')+'">'+(long?'LONG':'SHORT')+'</span>'+(window.mpBalTkt(e)?'<span class="pp-bal">BAL</span>':'')+'<span class="pp-live pp-res '+(e.liquidated?'liq':(win?'win':'loss'))+'">'+(e.liquidated?'Liquidated':(win?'Win':'Loss'))+(e.partial?' · '+e.partial+'%':'')+'</span></div>'
      +'<div class="pp-pnl"><span class="big">'+(e.pnl!=null?(((+e.pnl)>=0?'+':'−')+money(Math.abs(e.pnl)).replace('-','')):(win?'TP hit':'SL hit'))+'</span>'+((e.margin&&e.pnl!=null)?'<span class="roe">ROE '+pctS(((+e.pnl)/(+e.margin||1))*100)+'</span>':'')+'</div>'
      +'<div class="pp-perf"></div>'
      +'<div class="pp-meta">'
        +'<div><span>'+MT('jEntry','Entry')+'</span><b>'+fp(e.entry)+'</b></div>'
        +'<div><span>'+MT('jExit','Exit')+'</span><b>'+fp(e.exit!=null?e.exit:(win?e.tp:e.stop))+'</b></div>'
        +'<div><span>'+MT('jLev','Leverage')+'</span><b>'+(e.lev||1)+'×</b></div>'
        +'<div><span>'+MT('jHeld','Held')+'</span><b>'+(e.closeTs?dur(e.closeTs-e.ts):'—')+'</b></div>'
        +'<div><span>'+MT('jSize2','Size')+'</span><b>'+((+e.margin>0)?money(+e.margin)+(e.partial?' ('+e.partial+'%)':''):'—')+'</b></div>'
        +'<div><span>'+MT('jValue','Value')+'</span><b>'+((+e.margin>0)?money(+e.margin*((+e.lev>0)?+e.lev:1)):'—')+'</b></div>'
        +(feeHas(e)?'<div><span>'+MT('jFees','Fees')+'</span><b class="pp-fee" role="button" tabindex="0" title="'+MT('jFeeTip','Tap for the fee breakdown')+'">'+feeLbl(e)+'</b></div>':'')
      +'</div>'
      +(feeHas(e)?feeBdHtml(e):'')
      +'<div class="pp-btns"><button class="ch" data-act="chart" data-id="'+e.id+'">'+CHART_SVG+MT('jChart','Chart')+'</button><button class="pt" data-act="ptrade" data-id="'+e.id+'">'+MT('jPaperTrade','Paper Trade')+'</button></div>'
      +'<div class="pp-times">'+MT('jOpened','Opened')+' '+tsf(e.ts)+(e.closeTs?(' \u00b7 '+MT('jClosed','Closed')+' '+tsf(e.closeTs)):'')+'</div></div>';}
  function rr(x,X,Y,w,h,r){x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+w,Y,X+w,Y+h,r);x.arcTo(X+w,Y+h,X,Y+h,r);x.arcTo(X,Y+h,X,Y,r);x.arcTo(X,Y,X+w,Y,r);x.closePath();}
  function buildTicket(e){
    var m=metrics(e),closed=(e.status==='win'||e.status==='loss'),long=e.side!=='short';
    var pnl=closed?(+e.pnl||0):(m.pnl||0),roe=closed?((e.margin&&e.pnl!=null)?(+e.pnl)/(+e.margin):0):m.roe;
    var entry=e.entry,markpx=closed?(e.exit!=null?e.exit:(e.status==='win'?e.tp:e.stop)):m.live,win=pnl>=0;
    var prem=(window._mpPrem===true),GOLD='#f0c35a',GOLD2='#ffd97a';
    var W=1080,H=1080,c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');
    var g=x.createLinearGradient(0,0,0,H);if(prem){g.addColorStop(0,'#171105');g.addColorStop(0.55,'#0a0a0b');g.addColorStop(1,'#000');}else{g.addColorStop(0,'#0d1117');g.addColorStop(1,'#070809');}x.fillStyle=g;x.fillRect(0,0,W,H);
    var ac=win?'#2ebd85':'#ff6258';
    var rgl=x.createRadialGradient(W*0.5,H*0.42,80,W*0.5,H*0.42,660);rgl.addColorStop(0,prem?'rgba(240,195,90,0.15)':(win?'rgba(46,189,133,0.16)':'rgba(255,98,88,0.16)'));rgl.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=rgl;x.fillRect(0,0,W,H);
    x.strokeStyle=prem?'rgba(240,195,90,0.55)':'rgba(255,255,255,0.08)';x.lineWidth=prem?3:2;rr(x,40,40,W-80,H-80,28);x.stroke();
    if(prem){x.strokeStyle='rgba(240,195,90,0.22)';x.lineWidth=1.5;rr(x,54,54,W-108,H-108,22);x.stroke();}
    x.textBaseline='alphabetic';x.fillStyle=prem?GOLD:'#c2f64a';x.font='700 38px Arial';x.fillText('MARGINPAD',70,120);
    if(prem){var pw=x.measureText('MARGINPAD').width;x.fillStyle='rgba(240,195,90,0.16)';rr(x,70+pw+16,88,138,40,11);x.fill();x.fillStyle=GOLD2;x.font='800 22px Arial';x.fillText('PREMIUM',70+pw+31,116);}
    x.fillStyle='#6b7682';x.font='400 26px Arial';x.textAlign='right';x.fillText('marginpad.io',W-70,120);x.textAlign='left';
    x.fillStyle='#fff';x.font='800 92px Arial';x.fillText(e.sym||'—',70,252);
    var bs=(long?'LONG':'SHORT')+'  '+(e.lev||1)+'x';x.font='700 34px Arial';var bw=x.measureText(bs).width+44;
    x.fillStyle=long?'rgba(46,189,133,0.18)':'rgba(255,98,88,0.18)';rr(x,70,292,bw,60,14);x.fill();
    x.fillStyle=long?'#34d99a':'#ff7b72';x.fillText(bs,92,334);
    x.textAlign='center';x.fillStyle=ac;x.font='800 190px Arial';x.fillText((roe>=0?'+':'')+(roe*100).toFixed(2)+'%',W/2,628);
    if(prem){x.strokeStyle=GOLD;x.lineWidth=3;x.beginPath();x.moveTo(W/2-120,662);x.lineTo(W/2+120,662);x.stroke();}
    x.fillStyle=win?'#9fe9c8':'#ffb3ad';x.font='700 58px Arial';x.fillText((pnl>=0?'+$':'-$')+Math.abs(pnl).toLocaleString('en-US',{maximumFractionDigits:2})+(closed?'':' (live)'),W/2,722);x.textAlign='left';
    x.fillStyle=prem?'rgba(240,195,90,0.05)':'rgba(255,255,255,0.04)';rr(x,70,800,W-140,168,20);x.fill();if(prem){x.strokeStyle='rgba(240,195,90,0.25)';x.lineWidth=1.5;rr(x,70,800,W-140,168,20);x.stroke();}
    function kv(lbl,val,cx){x.fillStyle=prem?'#9a865a':'#6b7682';x.font='400 29px Arial';x.fillText(lbl,cx,856);x.fillStyle='#fff';x.font='700 44px Arial';x.fillText(val,cx,914);}
    kv(MT('jEntry','Entry'),fp(entry),110);kv(closed?MT('jExit','Exit'):MT('jMark','Mark'),fp(markpx),470);kv(MT('jStatus','Status'),closed?(win?'WIN':'LOSS'):'OPEN',830);
    x.fillStyle=prem?'#8a7a52':'#4b545d';x.font='400 24px Arial';x.textAlign='center';x.fillText((prem?'Premium member · ':'')+MT('jPaperDisc','Paper trade · not financial advice'),W/2,1020);x.textAlign='left';
    return c;
  }
  /* build the safe, self-contained snapshot posted to /api/tshare so a shared ticket resolves for ANYONE in chat */
  function tShareSnap(e){var m=metrics(e),closed=(e.status==='win'||e.status==='loss');
    var roe=closed?((e.margin&&e.pnl!=null)?(+e.pnl)/(+e.margin):0):m.roe;
    var pnl=closed?(+e.pnl||0):(m.pnl||0);
    return {sym:e.sym,side:e.side,status:e.status,entry:e.entry,exit:(closed?(e.exit!=null?e.exit:(e.status==='win'?e.tp:e.stop)):m.live),lev:e.lev,margin:e.margin,notional:e.notional,qty:e.qty,liq:m.liq,stop:e.stop,tp:e.tp,fund:e.fund,liquidated:!!e.liquidated,partial:e.partial,ts:e.ts,closeTs:e.closeTs,roe:roe*100,pnl:pnl,skin:window.mpTktSkin||undefined};}
  function shareTicketChat(e,btn){
    if(!(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me())){try{if(window.mpAuth&&window.mpAuth.open)window.mpAuth.open();}catch(_){}return;}
    if(btn){if(btn._busy)return;btn._busy=1;btn.classList.add('pp-ic-busy');}
    try{window.__mpTrack&&window.__mpTrack('share',(e.sym||'')+' chat');}catch(_){}
    fetch('/api/tshare',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ticket:tShareSnap(e)})})
      .then(function(r){return r.json();})
      .then(function(d){if(btn){btn._busy=0;btn.classList.remove('pp-ic-busy');}
        if(d&&d.id){try{closeJr();}catch(_){}if(window.mpChatSay)window.mpChatSay('trade:'+d.id);toast(MT('jSharedChat','Shared to chat'));}
        else if(d&&d.error==='login_required'){try{if(window.mpAuth&&window.mpAuth.open)window.mpAuth.open();}catch(_){}}
        else if(d&&d.error==='rate_limited'){toast(MT('jShareLimit','Too many shares right now — try again later.'));}
        else{toast(MT('jShareFail','Could not share the ticket.'));}})
      .catch(function(){if(btn){btn._busy=0;btn.classList.remove('pp-ic-busy');}toast(MT('jShareFail','Could not share the ticket.'));});
  }
  function shareTicket(e){
    try{window.__mpTrack&&window.__mpTrack('share',(e.sym||'')+' ticket');}catch(_){}
    var roe2=(function(){var m=metrics(e),closed=(e.status==='win'||e.status==='loss');return closed?((e.margin&&e.pnl!=null)?(+e.pnl)/(+e.margin):0):m.roe;})();
    var long=e.side!=='short',c=buildTicket(e);
    c.toBlob(function(blob){if(!blob)return;var fn='marginpad-'+(e.sym||'trade')+'-'+(roe2>=0?'plus':'minus')+Math.abs(roe2*100).toFixed(0)+'.png';
      try{var file=new File([blob],fn,{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:'MarginPad',text:(e.sym||'')+' '+(long?'LONG':'SHORT')+' '+(roe2>=0?'+':'')+(roe2*100).toFixed(2)+'% ROE · marginpad.io'}).catch(function(){});return;}}catch(_){}
      var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fn;a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},5000);
    },'image/png');
  }
  var toastT=null;
  function toast(msg){var t=document.getElementById('mpToast');if(!t){t=document.createElement('div');t.id='mpToast';t.className='mp-toast';document.body.appendChild(t);}t.textContent=msg;t.classList.add('on');if(toastT)clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('on');},2200);}
  function copyTicket(e){
    var url='https://marginpad.io/paper-trade';
    if(!navigator.clipboard){toast(MT('jCopyFail','Copy not supported'));return;}
    if(!window.ClipboardItem){navigator.clipboard.writeText(url).then(function(){toast(MT('jLinkCopied','Link copied'));},function(){});return;}
    try{
      var blobP=new Promise(function(res){var c=buildTicket(e);c.toBlob(function(b){res(b);},'image/png');});
      var item=new ClipboardItem({'image/png':blobP,'text/plain':new Blob([url],{type:'text/plain'})});
      navigator.clipboard.write([item]).then(function(){toast(MT('jImgLinkCopied','Image + link copied'));},function(){navigator.clipboard.writeText(url).then(function(){toast(MT('jLinkCopied','Link copied'));},function(){});});
    }catch(_){navigator.clipboard.writeText(url).then(function(){toast(MT('jLinkCopied','Link copied'));},function(){});}
  }
  function balCfg(){return (window.mpBal&&window.mpBal.cfg&&window.mpBal.cfg())||{on:false,start:10000,since:0};}
  function balStrip(open,closed,unreal){var bm=balCfg();var prem=(window._mpPrem===true)||bm.on;if(!prem)return '';
    var _tgl='<button type="button" class="bal-tgl'+(bm.on?' on':'')+'" data-baltgl="1" title="Balance Mode '+(bm.on?'ON':'OFF')+'" aria-label="Toggle Balance Mode"><span class="bal-tgl-k"></span></button>';
    if(!bm.on)return '<div class="jr-bal jr-bal-gold jr-bal-off"><div class="jrb-row" style="display:flex;align-items:center;gap:9px"><span style="font:700 9px monospace;letter-spacing:.14em;color:#f0c35a">BALANCE MODE</span><span style="font-size:10.5px;color:#8a7a52;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">trade a real portfolio</span>'+_tgl+'</div></div>';
    var _tags={};try{_tags=JSON.parse(localStorage.getItem('mp_bal_tags')||'{}')||{};}catch(_e){}var _bmine=function(e){return !!(bm.sid&&e&&(e.bal===bm.sid||_tags[e.id]===bm.sid));};var realized=closed.reduce(function(s,e){return _bmine(e)?s+(+e.pnl||0):s;},0),openMargin=open.reduce(function(s,e){return _bmine(e)?s+(+e.margin||0):s;},0),myUnreal=open.reduce(function(s,e){if(!_bmine(e))return s;var mm=metrics(e);return s+(mm.pnl||0);},0),equity=bm.start+realized+myUnreal,avail=bm.start+realized-openMargin,pl=equity-bm.start,plc=pl>=0?'#34d99a':'#ff7b72';// Balance Mode counts ONLY trades tagged with the current session id (e.bal OR the mp_bal_tags map — sync-proof)
    function mK(n){n=+n||0;var g=n<0?'-':'',a=Math.abs(n);if(a>=1e12)return g+'$'+(a/1e12).toFixed(2).replace(/\.?0+$/,'')+'T';if(a>=1e9)return g+'$'+(a/1e9).toFixed(2).replace(/\.?0+$/,'')+'B';if(a>=1e6)return g+'$'+(a/1e6).toFixed(2).replace(/\.?0+$/,'')+'M';if(a>=1e4)return g+'$'+(a/1e3).toFixed(1).replace(/\.0$/,'')+'K';return g+'$'+a.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
    function cell(l,v,col){return '<div style="flex:1;min-width:0"><div style="font:11px monospace;color:#5c6b84">'+l+'</div><div style="font:700 17px monospace;color:'+(col||'#e9e7df')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+v+'</div></div>';}
    return '<div class="jr-bal jr-bal-gold">'
      +'<div class="jrb-row" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px"><span style="display:inline-flex;align-items:center;gap:8px;font:700 9px monospace;letter-spacing:.14em;color:#f0c35a">BALANCE MODE'+_tgl+'</span><span style="display:inline-flex;align-items:center;gap:6px"><span style="font:11px monospace;color:#5c6b84">all-time</span><span style="font:700 11px monospace;color:'+plc+';background:'+(pl>=0?'rgba(52,217,154,.12)':'rgba(255,123,114,.13)')+';border-radius:20px;padding:2px 9px;white-space:nowrap">'+(pl>=0?'+':'')+(bm.start>0?(pl/bm.start*100).toFixed(1):'0')+'%</span></span></div>'
      +'<div class="jrb-row" style="font:800 26px monospace;color:#f4cf7a;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;text-shadow:0 0 18px rgba(240,195,90,.28)">'+mK(equity)+'</div>'
      +'<div class="jrb-row" style="font:11px monospace;color:#8a7a52;margin:0 0 10px">from '+mK(bm.start)+'</div>'
      +'<div class="jrb-row" style="display:flex;gap:14px;border-top:1px solid rgba(240,195,90,.18);padding-top:9px">'+cell('In trades',mK(openMargin))+cell('Available',mK(avail))+cell('Realized',(realized>=0?'+':'')+mK(realized),realized>=0?'#34d99a':'#ff7b72')+'</div></div>';}
  document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-baltgl]');if(!t)return;e.preventDefault();e.stopPropagation();var c=(window.mpBal&&window.mpBal.cfg&&window.mpBal.cfg())||{on:false};if(!c.on&&window._mpPrem!==true){if(window.mpPremium&&window.mpPremium.show)window.mpPremium.show('Balance Mode');return;}if(window.mpBal&&window.mpBal.setCfg)window.mpBal.setCfg(!c.on);}); // My Trades Balance-Mode on/off toggle
  function render(){
    var listEl=document.getElementById('jrList'),statsEl=document.getElementById('jrStats'),emptyEl=document.getElementById('jrEmpty');
    if(!listEl||!statsEl)return;
    var data=load();
    var open=data.filter(function(e){return e.status==='open';});
    var allClosed=data.filter(function(e){return e.status==='win'||e.status==='loss';});
    var closed=allClosed.filter(window.mpSsnShow); // season display scope (pre-epoch: identity)
    var archN=allClosed.length-closed.length;
    var wins=closed.filter(function(e){return e.status==='win';}).length;
    var wr=closed.length?Math.round(wins/closed.length*100):null;
    var realized=closed.reduce(function(s,e){return s+(+e.pnl||0);},0);
    var unreal=open.reduce(function(s,e){var mm=metrics(e);return s+(mm.pnl||0);},0);
    function stat(v,l,col){return '<div class="jr-stat"><div class="v"'+(col?' style="color:'+col+'"':'')+'>'+v+'</div><div class="l">'+l+'</div></div>';}
    statsEl.innerHTML=stat(open.length,MT('jOpenN','Open'))
      +stat((unreal>=0?'+':'−')+money(Math.abs(unreal)).replace('-',''),MT('jUnreal','Unrealized'),unreal>=0?'#34d99a':'#ff7b72')
      +stat(wr==null?'—':wr+'%',MT('jWinRate','Win rate'))
      +stat((realized>=0?'+':'−')+money(Math.abs(realized)).replace('-',''),MT('jRealized','Realized'),realized>=0?'#34d99a':'#ff7b72');
    var rows=(jrTab==='open'?open:closed);
    var _ord=rows.slice().reverse(),_vis=_ord.slice(0,jrShow),_rest=_ord.length-_vis.length;
    var cards=rows.length?_vis.map(jrTab==='open'?openCard:closedCard).join(''):'<div class="pp-empty"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg><span>'+(jrTab==='open'?MT('jNoOpen','No open positions — open one from Paper Trade.'):MT('jNoClosed','No closed trades yet.'))+'</span></div>';
    if(_rest>0)cards+='<button type="button" data-more="1" style="display:block;width:100%;margin:10px 0 2px;padding:11px;background:rgba(255,255,255,.05);border:1px solid #2a313c;border-radius:10px;color:#c2f64a;font:600 13px/1 \'Familjen Grotesk\',sans-serif;cursor:pointer">'+MT('jShowMore','Show more')+' ('+_rest+')</button>';
    if(jrTab==='closed'&&archN>0)cards+='<div style="text-align:center;font:11px/1.5 \'Familjen Grotesk\',sans-serif;color:#5b6470;padding:10px 12px 4px">'+MT('jSsnArch','New season — stats restarted. Earlier trades are archived, your XP and progress are untouched.')+'</div>';
    listEl.innerHTML=balStrip(open,closed,unreal)+'<div class="jr-tabs"><button data-jt="open" class="'+(jrTab==='open'?'on':'')+'">'+MT('jOpenN','Open')+' ('+open.length+')</button><button data-jt="closed" class="'+(jrTab==='closed'?'on':'')+'">'+MT('jClosedN','Closed')+' ('+closed.length+')</button></div>'+cards;
    if(emptyEl)emptyEl.style.display='none';
  }
  function add(){
    var pl=window.mpPlanLive, entry=pl&&pl.price;
    var amt=num('planAmt'), lev=num('planLev');
    if(isFinite(amt)&&amt>100000)amt=100000; // hard cap: max $100k margin per trade (matches home.js; was missing here)
    if(!isFinite(entry)||entry<=0||!isFinite(amt)||amt<=0)return;
    var seg=document.getElementById('planSeg'); var on=seg&&seg.querySelector('button.on'); var side=on?on.getAttribute('data-side'):'long';
    var symEl=document.getElementById('planSym'); var sym=((symEl&&symEl.value)||'').toUpperCase();
    var L=isFinite(lev)&&lev>0?Math.min(lev,1000):1, mmr=0.005;
    var feeRate=num('planFee'); feeRate=(isFinite(feeRate)&&feeRate>=0)?feeRate/100:(window.mpFeeRate?window.mpFeeRate(L,sym):Math.min(0.00055,0.1/Math.max(1,L))); // default 0.055% taker fee so every trade carries a fee
    var sl=num('planSlOpt'), tp=num('planTpOpt');
    // block a wrong-side SL/TP instead of storing it (parity with home.js add() — it would self-trigger instantly)
    var _lng2=side==='long',_bad2=[];
    if(isFinite(sl)&&((_lng2&&sl>=entry)||(!_lng2&&sl<=entry)))_bad2.push('stop-loss');
    if(isFinite(tp)&&((_lng2&&tp<=entry)||(!_lng2&&tp>=entry)))_bad2.push('take-profit');
    if(_bad2.length){var _bm='Your '+_bad2.join(' and ')+' is on the wrong side of the entry price — fix it (or clear the field) to open the trade.';if(window.mpLimitToast)window.mpLimitToast(_bm);else alert(_bm);return;}
    var notional=amt*L, qty=notional/entry;
    var liq=side==='long'?entry*(1-(1-mmr)/L):entry*(1+(1-mmr)/L);
    var stop=isFinite(sl)?sl:null;
    var rrv=(isFinite(tp)&&isFinite(sl))?Math.abs(tp-entry)/Math.abs(entry-sl):NaN;
    var data=load();
    // one-way mode: can't open the opposite direction on a pair you already hold open (no long+short hedge)
    if(window.mpTradeGate){ if(!window.mpTradeGate(sym,side))return; }
    else { try{ var _w=(side==='short')?'short':'long'; if(data.some(function(e){return e&&e.status==='open'&&String(e.sym||'').toUpperCase()===sym&&((e.side==='short'?'short':'long')!==_w);})){ var _m='You already have a '+(_w==='long'?'SHORT':'LONG')+' '+sym+' position open — close it before opening a '+(_w==='long'?'LONG':'SHORT')+'.'; if(window.mpLimitToast)window.mpLimitToast(_m); else alert(_m); return; } }catch(_){} }
    data.push({id:String(Date.now())+'_'+Math.floor(Math.random()*1e4),ts:Date.now(),sym:sym||'—',side:side,entry:entry,stop:stop,tp:isFinite(tp)?tp:null,lev:L,rr:isFinite(rrv)?rrv:null,qty:qty,notional:notional,margin:amt,riskAmt:amt,liq:liq,mmr:mmr,feeRate:feeRate,status:'open',pnl:null});
    if(window.mpLivePrices&&sym)window.mpLivePrices[sym]={p:entry,t:Date.now()};
    store(data);
    try{if(window.mpLevWarn)window.mpLevWarn(L);}catch(e){} // extreme-leverage nudge (parity with home.js add())
    try{if(window.mpCheckGrad)window.mpCheckGrad();}catch(e){}
    var btn=document.getElementById('planSave'),sp=btn&&btn.querySelector('span');
    if(btn&&sp){var o=sp.textContent;btn.classList.add('saved');sp.textContent=MT('jOpened','Position opened ✓');setTimeout(function(){sp.textContent=o;btn.classList.remove('saved');},1600);}
    try{if(window.__mpTrack){window.__mpTrack('paper',(sym||'?')+' '+side);window.__mpTrack('plev',L<=5?'1-5x':L<=20?'5-20x':L<=50?'20-50x':L<=100?'50-100x':'100x+');}}catch(e){}
  }
  var saveBtn=document.getElementById('planSave'); if(saveBtn)saveBtn.addEventListener('click',add);
  document.addEventListener('click',function(ev){
    var b=ev.target.closest&&ev.target.closest('#jrList [data-act], #jrList [data-jt], #jrList [data-more]'); if(!b)return;
    if(b.hasAttribute('data-more')){jrShow+=100;render();return;}
    if(b.hasAttribute('data-jt')){jrTab=b.getAttribute('data-jt');jrShow=50;render();return;}
    var id=b.getAttribute('data-id'),act=b.getAttribute('data-act');
    var data=load(),i=-1; for(var k=0;k<data.length;k++){if(data[k].id===id){i=k;break;}} if(i<0)return; var e=data[i];
    if(act==='share'){shareTicket(e);return;}
    if(act==='chatshare'){shareTicketChat(e,b);return;}
    if(act==='copy'){copyTicket(e);return;}
    if(act==='chart'){var _cs=String(e.sym||'').toUpperCase();try{sessionStorage.setItem('mp_force_chart',_cs);}catch(_){}try{closeJr();}catch(_){}if(window.mpGo)window.mpGo('/charts');else location.href='/charts';var _t=0,_iv=setInterval(function(){_t++;var _c=null;try{_c=sessionStorage.getItem('mp_force_chart');}catch(_){}if(!_c){clearInterval(_iv);return;}if(window.mpCharts&&window.mpCharts.openOnly){clearInterval(_iv);try{sessionStorage.removeItem('mp_force_chart');}catch(_){}window.mpCharts.openOnly(_c);}else if(_t>25){clearInterval(_iv);}},120);return;}if(act==='ptrade'){var _pu='/paper-trade?coin='+encodeURIComponent(String(e.sym||'').toUpperCase())+(e.side?'&side='+(e.side==='short'?'short':'long'):'');try{closeJr();}catch(_){}if(window.mpGo)window.mpGo(_pu);else location.href=_pu;return;}
    if(act==='sltp'){if(window.mpSltpSheet)window.mpSltpSheet(id,function(){render();});return;}
    if(act==='del'){ if(!confirm(MT('jDelConfirm','Are you sure you want to delete this trade?')))return; data.splice(i,1); }
    else if(act==='close'){ if(window.mpCloseSheet){window.mpCloseSheet(id,function(){render();});return;} var m=metrics(e); e.status=(m.pnl!=null?(m.pnl>=0?'win':'loss'):(m.move>=0?'win':'loss')); e.exit=m.live; e.closeTs=Date.now(); e.pnl=(m.pnl!=null?m.pnl:0); }
    else if(act==='reopen'){ e.status='open'; e.exit=null; e.closeTs=null; e.pnl=null; }
    else if(act==='edit'){ var ns=prompt(MT('jNewSL','New stop-loss price:'),e.stop); if(ns!==null){var v=parseFloat(ns);if(isFinite(v))e.stop=v;} var nt=prompt(MT('jNewTP','New take-profit (blank = none):'),e.tp!=null?e.tp:''); if(nt!==null){var v2=parseFloat(nt);e.tp=isFinite(v2)?v2:null;} }
    store(data); render(); if(window.mpDrawLines)window.mpDrawLines();
  });
  var jrTimer=null,_jrTouchT=0;
  var _jrSig='';
  function renderLive(){var d=document.getElementById('jrDrawer');if(!d||d.hidden)return;if(Date.now()-_jrTouchT<800)return;/* on touch there's no :hover — pin the list while the finger is down so a live re-render can't destroy the tapped button */if(d.querySelector('button:hover,a:hover,[data-act]:hover,[data-jt]:hover'))return;
    // structural sig-diff (mirrors home.js): full rebuild only when a card appears/disappears or the tab changes;
    // otherwise update price-driven fields in place — kills the every-second whole-drawer flash.
    var data=load(),open=data.filter(function(e){return e.status==='open';});
    var sig=jrTab+'|'+open.map(function(e){return e.id;}).join(',')+'|'+(data.length-open.length);
    if(sig!==_jrSig){_jrSig=sig;render();return;}
    var listEl=document.getElementById('jrList'),statsEl=document.getElementById('jrStats');
    if(statsEl){var closed=data.filter(function(e){return e.status==='win'||e.status==='loss';}).filter(window.mpSsnShow);var wins=closed.filter(function(e){return e.status==='win';}).length;var realized=closed.reduce(function(s,e){return s+(+e.pnl||0);},0);var unreal=open.reduce(function(s,e){var mm=metrics(e);return s+(mm.pnl||0);},0);
      var vs=statsEl.querySelectorAll('.jr-stat .v');if(vs.length>=4){vs[1].textContent=(unreal>=0?'+':'−')+money(Math.abs(unreal)).replace('-','');vs[1].style.color=unreal>=0?'#34d99a':'#ff7b72';vs[3].textContent=(realized>=0?'+':'−')+money(Math.abs(realized)).replace('-','');}}
    if(listEl&&jrTab==='open')open.forEach(function(e){var card=listEl.querySelector('.pp[data-id="'+e.id+'"]');if(!card)return;var m=metrics(e);
      var pnlc=(m.pnl!=null?(m.pnl>0?'pf':(m.pnl<0?'ls':'be')):(m.move>0?'pf':(m.move<0?'ls':'be')));if(!card.classList.contains(pnlc)){card.classList.remove('pf','ls','be');card.classList.add(pnlc);} // swap ONLY the pnl state class — wholesale card.className= dropped pp-gold every tick (balance tickets flickered gold→normal on each price change)
      var lv=card.querySelector('.pp-live');if(lv){var lvv=(e.lev||1)+'× · '+fp(m.live);if(lv.textContent!==lvv)lv.textContent=lvv;}
      var big=card.querySelector('.big');if(big){var bv=(m.pnl!=null?((m.pnl>=0?'+':'−')+money(Math.abs(m.pnl)).replace('-','')):pctS(m.move*100));if(big.textContent!==bv)big.textContent=bv;}
      var roe=card.querySelector('.roe');if(roe){var rv='ROE '+pctS(m.roe*100);if(roe.textContent!==rv)roe.textContent=rv;}
      var bb=card.querySelector('.ppb');if(bb){var bbv=pctS(m.liqDist);if(bb.textContent!==bbv)bb.textContent=bbv;}
    });}
  var _jrScrollY=0,_jrLocked=false;
  function jrLockBody(){if(window.innerWidth<721&&!_jrLocked){_jrScrollY=window.scrollY||window.pageYOffset||0;document.body.style.top=(-_jrScrollY)+'px';document.documentElement.classList.add('jr-lock');_jrLocked=true;}}
  function jrUnlockBody(){if(_jrLocked){document.documentElement.classList.remove('jr-lock');document.body.style.top='';_jrLocked=false;window.scrollTo(0,_jrScrollY);}}
  function openJr(){var d=document.getElementById('jrDrawer'),b=document.getElementById('jrBackdrop');if(d)d.hidden=false;if(b)b.hidden=false;document.documentElement.classList.add('jr-open');jrLockBody();render();if(jrTimer)clearInterval(jrTimer);jrTimer=setInterval(renderLive,1000);}
  function closeJr(){var d=document.getElementById('jrDrawer'),b=document.getElementById('jrBackdrop');if(d)d.hidden=true;if(b)b.hidden=true;document.documentElement.classList.remove('jr-open');jrUnlockBody();if(jrTimer){clearInterval(jrTimer);jrTimer=null;}}
  (function(){var d=document.getElementById('jrDrawer');if(!d)return;d.addEventListener('wheel',function(e){var noScroll=d.scrollHeight<=d.clientHeight+1,atTop=d.scrollTop<=0,atBot=d.scrollTop+d.clientHeight>=d.scrollHeight-1;if(noScroll||(e.deltaY<0&&atTop)||(e.deltaY>0&&atBot))e.preventDefault();},{passive:false});})();
  // Close on pointerdown (fires at touch-start, before the synthesized click) so the drawer dismisses instantly
  // even when the main thread is mid-render — fixes the "tap close → ~1s lag" on mobile. Close-only controls,
  // so a double-fire with the click handler is harmless; the toggle (data-mytrades) stays on click.
  // Swallow the ghost mousedown+click the same tap fires AFTER the drawer hides, so it doesn't land on whatever is
  // now under the finger (the language <select> sits top-right, exactly under the close ✕) and open it.
  function swallowGhost(){
    var killM=function(ev){if(ev.target&&ev.target.closest&&ev.target.closest('.mobnav,[data-mn],[data-mytrades]')){document.removeEventListener('mousedown',killM,true);return;}ev.preventDefault();ev.stopPropagation();document.removeEventListener('mousedown',killM,true);};
    var killC=function(ev){if(ev.target&&ev.target.closest&&ev.target.closest('.mobnav,[data-mn],[data-mytrades]')){document.removeEventListener('click',killC,true);return;}ev.preventDefault();ev.stopPropagation();document.removeEventListener('click',killC,true);};
    document.addEventListener('mousedown',killM,true);document.addEventListener('click',killC,true);
    setTimeout(function(){document.removeEventListener('mousedown',killM,true);document.removeEventListener('click',killC,true);},700);
  }
  document.addEventListener('pointerdown',function(e){var t=e.target;if(!t||!t.closest)return;
    if(t.closest('#jrList'))_jrTouchT=Date.now(); /* pin the list while the finger is down */
    if(t.closest('#jrClose,[data-jr-close]')||(t.id==='jrBackdrop'&&window.innerWidth<721)){closeJr();swallowGhost();}
  },true);
  document.addEventListener('touchstart',function(e){var t=e.target;if(t&&t.closest&&t.closest('#jrList'))_jrTouchT=Date.now();},{capture:true,passive:true});
  document.addEventListener('click',function(e){var t=e.target;if(!t)return;
    if(t.closest&&t.closest('[data-mytrades]')){var dd=document.getElementById('jrDrawer');if(dd&&!dd.hidden)closeJr();else openJr();}
    else if(t.closest&&t.closest('#jrClose,[data-jr-close]'))closeJr();
    else if(t.id==='jrBackdrop'&&window.innerWidth<721)closeJr();
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeJr();});
  var _jrPend=null;
  window.mpJournalRender=function(){var d=document.getElementById('jrDrawer');if(d&&!d.hidden){if(Date.now()-_jrTouchT<800){clearTimeout(_jrPend);_jrPend=setTimeout(render,820);}else render();}}; // defer live re-render past a finger-down so it can't destroy a button mid-tap
  window.mpOpenTrades=openJr;
  /* clamp an ISOLATED outlier wick (a bad exchange print) that sits >3.5% beyond the candle's own body AND both
     neighbours — so a phantom wick can't trigger a false liquidation. Ported verbatim from home.js (was missing here). */
  function sanitizeBars(kd){ if(!kd||kd.length<2)return kd; var TH=0.035;
    for(var i=0;i<kd.length;i++){var b=kd[i];if(!b)continue;var o=+b.open,c=+b.close;if(!(o>0&&c>0))continue;
      var bodyLo=Math.min(o,c),bodyHi=Math.max(o,c);
      var pl=i>0?+kd[i-1].low:bodyLo,nl=i<kd.length-1?+kd[i+1].low:bodyLo;
      var ph=i>0?+kd[i-1].high:bodyHi,nh=i<kd.length-1?+kd[i+1].high:bodyHi;
      var refLo=Math.min(bodyLo,pl||bodyLo,nl||bodyLo); if(+b.low>0&&+b.low<refLo*(1-TH))b.low=refLo*(1-TH);
      var refHi=Math.max(bodyHi,ph||bodyHi,nh||bodyHi); if(+b.high>refHi*(1+TH))b.high=refHi*(1+TH);
    } return kd; }
  /* Overnight realism: liquidate any open trade that blew through its liq level while the tab was closed.
     This page has no live tick that closes trades, so we replay historical candles since each trade opened. */
  // Offline backfill (Rekt/Rewards have no live tick at all): on load/return, replay candles since the trade opened and
  // close it at the FIRST of {SL, TP, liquidation} the price reached, at that exact level. Mirrors home.js — this copy
  // previously detected liquidation ONLY, so an SL/TP hit while the user sat here never fired and a stopped-out position
  // could get wrongly liquidated for the full margin.
  function sweepLiq(){var d=load(),open=d.filter(function(e){return e.status==='open'&&e.sym&&e.sym!=='—'&&e.entry>0;});if(!open.length)return;
    open.forEach(function(e){if((Date.now()-e.ts)<8*60000)return;
      var lng=e.side!=='short',liq=metrics(e).liq,ageH=(Date.now()-e.ts)/3600000;
      var stop=(e.stop!=null&&isFinite(+e.stop))?+e.stop:null,tp=(e.tp!=null&&isFinite(+e.tp))?+e.tp:null;
      var lossExit=stop!=null?(lng?Math.max(stop,liq):Math.min(stop,liq)):liq, isLiq=(lossExit===liq); // SL caps the loss only if hit before liq; else liq
      var tf=ageH>72?'1440':ageH>24?'240':ageH>6?'60':ageH>2?'30':'5';
      fetch('/api/klines?symbol='+encodeURIComponent(e.sym)+'&interval='+tf).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){
        if(!kd||!kd.length)return;kd=sanitizeBars(kd);var cross=null,exitPx=null,liab=false;
        for(var i=0;i<kd.length;i++){var b=kd[i],bt=b.time*1000;if(bt<e.ts)continue; // only candles that START after the open (pre-open wick guard)
          var lossHit=lng?(isLiq?(+b.low<=liq&&+b.close<=liq*1.03):(+b.low<=lossExit)):(isLiq?(+b.high>=liq&&+b.close>=liq*0.97):(+b.high>=lossExit)); // liq close-confirmed; SL fills on the wick
          var tpHit=tp!=null&&(lng?+b.high>=tp:+b.low<=tp);
          if(!(lossHit||tpHit))continue;
          if(lossHit&&tpHit){var o=+b.open;if(Math.abs(o-lossExit)<=Math.abs(o-tp)){exitPx=lossExit;liab=isLiq;}else{exitPx=tp;liab=false;}}
          else if(lossHit){exitPx=lossExit;liab=isLiq;}
          else{exitPx=tp;liab=false;}
          cross=Math.max(bt,e.ts);break;}
        if(cross==null)return;
        var d2=load(),idx=-1;for(var k=0;k<d2.length;k++){if(d2[k].id===e.id){idx=k;break;}}if(idx<0)return;var t=d2[idx];if(t.status!=='open')return;
        var dir=(t.side!=='short')?1:-1,pnl=(t.qty!=null&&isFinite(t.qty))?t.qty*(exitPx-t.entry)*dir:null;
        if(liab){pnl=(+t.margin>0)?-(+t.margin):pnl;t.liquidated=true;try{if(window.__mpTrack)window.__mpTrack('cliq','sweep '+t.sym+' tf'+tf+' liq'+(+lossExit).toPrecision(6));}catch(_){}} else if(+t.margin>0&&pnl!=null&&pnl<-(+t.margin))pnl=-(+t.margin);
        t.status=(pnl!=null&&pnl>0)?'win':'loss';t.exit=exitPx;t.pnl=pnl;t.closeTs=cross;
        store(d2);if(window.mpJournalRender)window.mpJournalRender();});});}
  sweepLiq();
  document.addEventListener('visibilitychange',function(){if(!document.hidden)sweepLiq();});
  var _jrLast=0;
  document.addEventListener('mp:price',function(){var d=document.getElementById('jrDrawer');if(!d||d.hidden)return;var now=(window.performance&&performance.now)?performance.now():+new Date();if(now-_jrLast<800)return;_jrLast=now;renderLive();});
  render();
  if(/[?&]trades=1/.test(location.search)){window.addEventListener('load',function(){try{openJr();}catch(e){}});}
})();

/* ---------- real-time price feed (Bybit spot WS) ---------- */
(function(){
  if(!('WebSocket'in window))return;
  var SYMS=['BTC','ETH','SOL','XRP','BNB','DOGE','ADA','AVAX'];
  window.mpLivePrices=window.mpLivePrices||{};
  window.mpHist=window.mpHist||{};
  var ws=null,alive=false,retry=0,pingT=null,lastH={},chgMap={};
  function pushHist(sym,price){var now=Date.now();if(now-(lastH[sym]||0)<1000)return;lastH[sym]=now;var h=window.mpHist[sym]||(window.mpHist[sym]=[]);h.push(price);if(h.length>46)h.shift();}
  function emit(sym,price,chg){
    var prev=window.mpLivePrices[sym]||{};
    window.mpLivePrices[sym]={p:price,t:Date.now(),chg:(chg!=null&&isFinite(chg))?chg:prev.chg};
    pushHist(sym,price);
    try{document.dispatchEvent(new CustomEvent('mp:price',{detail:{sym:sym,price:price,chg:window.mpLivePrices[sym].chg}}));}catch(_){}
  }
  function connect(){
    try{ws=new WebSocket('wss://stream.bybit.com/v5/public/spot');}catch(e){return reconnect();}
    ws.onopen=function(){alive=true;retry=0;try{var args=[];SYMS.forEach(function(s){args.push('publicTrade.'+s+'USDT');args.push('tickers.'+s+'USDT');});for(var i=0;i<args.length;i+=10){ws.send(JSON.stringify({op:'subscribe',args:args.slice(i,i+10)}));}}catch(_){}
      if(pingT)clearInterval(pingT);pingT=setInterval(function(){try{ws.send(JSON.stringify({op:'ping'}));}catch(_){}},18000);};
    ws.onmessage=function(ev){try{var m=JSON.parse(ev.data);if(!m.topic)return;
      if(m.topic.indexOf('publicTrade.')===0&&Array.isArray(m.data)&&m.data.length){var sym=m.topic.slice(12).replace('USDT','');var p=parseFloat(m.data[m.data.length-1].p);if(isFinite(p))emit(sym,p,chgMap[sym]);}
      else if(m.topic.indexOf('tickers.')===0&&m.data){var sym2=m.topic.slice(8).replace('USDT','');var lp=parseFloat(m.data.lastPrice);var chg=(m.data.price24hPcnt!=null&&m.data.price24hPcnt!=='')?parseFloat(m.data.price24hPcnt)*100:null;if(chg!=null&&isFinite(chg))chgMap[sym2]=chg;if(isFinite(lp))emit(sym2,lp,chgMap[sym2]);}
    }catch(_){}};
    ws.onclose=function(){alive=false;if(pingT){clearInterval(pingT);pingT=null;}reconnect();};
    ws.onerror=function(){try{ws.close();}catch(_){}};
  }
  function reconnect(){retry=Math.min(retry+1,6);setTimeout(connect,Math.min(1200*retry,3000));} // backoff capped at 3s (was 8s) so a returned network reconnects faster when the `online` event doesn't fire (mobile) — matches home.js
  connect();
})();

/* ---------- REST price poll for OPEN-position symbols the WS doesn't cover ----------
   The WS above only streams 8 majors. Any other open position (e.g. TLM and every altcoin) had NO live
   source on this page, so My Trades P&L sat frozen at $0 on the homepage / Rekt / Rewards until the user
   opened Paper Trade (which runs its own poller). This polls /api/price for each open symbol that the WS
   isn't already keeping fresh, updates mpLivePrices, and re-renders the drawer. */
(function(){
  window.mpLivePrices=window.mpLivePrices||{};
  function openSyms(){try{var j=JSON.parse(localStorage.getItem('mp_journal')||'[]');if(!Array.isArray(j))return [];var s={};j.forEach(function(e){if(e&&e.status==='open'&&e.sym&&e.sym!=='—')s[String(e.sym).toUpperCase()]=1;});return Object.keys(s);}catch(e){return [];}}
  var _busy={};
  function poll(){
    var syms=openSyms();if(!syms.length)return;var now=Date.now();
    syms.forEach(function(sym){
      var lp=window.mpLivePrices[sym];
      if(lp&&lp.t&&(now-lp.t)<6000)return;               // WS or a recent poll already fresh → skip
      if(_busy[sym])return;_busy[sym]=1;
      fetch('/api/price?symbol='+encodeURIComponent(sym)+window.__mpPQ('ptr',sym),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){
        _busy[sym]=0;var p=j&&(+j.price);if(!(p>0))return;
        var prev=window.mpLivePrices[sym]||{};
        window.mpLivePrices[sym]={p:p,t:Date.now(),chg:(j&&j.chg!=null&&isFinite(j.chg))?+j.chg:prev.chg};
        try{document.dispatchEvent(new CustomEvent('mp:price',{detail:{sym:sym,price:p,chg:window.mpLivePrices[sym].chg}}));}catch(_){}
        if(window.mpJournalRender)window.mpJournalRender();
      });
    });
  }
  setInterval(poll,4000);poll();
  document.addEventListener('visibilitychange',function(){if(!document.hidden)poll();}); // instant refresh when the tab returns
})();

/* ---------- trader chat ---------- */
(function(){
  var fab=document.getElementById('chatFab'),box=document.getElementById('chatBox'),gate=document.getElementById('ctGate'),
      msgs=document.getElementById('ctMsgs'),form=document.getElementById('ctForm'),input=document.getElementById('ctInput'),
      signinBtn=document.getElementById('ctSignin'),onlineEl=document.getElementById('ctOnline'),
      closeBtn=document.getElementById('ctClose');
  if(!fab)return;
  var ws=null,user='',joined=false;
  /* per-coin chat rooms: All + a few majors. 'global' = the original shared room (history preserved). */
  var ROOMS=['global','BTC','ETH','SOL','BNB','XRP','DOGE'],room='global',roomBar=null;
  var CT_STAR='<svg class="ct-ric ct-ricprem" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m12 2 2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z"/></svg>';
  function chatRooms(){var b=['global','BTC','ETH','SOL','BNB','XRP','DOGE'];if(window._mpPrem===true)b.splice(1,0,'PREMIUM');return b;}
  function roomLabel(r){return r==='global'?'All':r==='PREMIUM'?'Premium':r;}
  var CT_CARET='<svg class="ct-rcaret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  var CT_CHECK='<svg class="ct-ri-ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-11"/></svg>';
  var CT_COIN={BTC:1,ETH:1027,SOL:5426,BNB:1839,XRP:52,DOGE:74};
  var CT_ALL='<svg class="ct-ric ct-ricall" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3.2 9.5h17.6M3.2 14.5h17.6M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>';
  function roomIcon(r){if(r==='PREMIUM')return CT_STAR;if(r==='global')return CT_ALL;var id=CT_COIN[r];if(id)return '<img class="ct-ricimg" data-coin="'+r+'" src="https://s2.coinmarketcap.com/static/img/coins/64x64/'+id+'.png" alt="">';return '<span class="ct-ricl">'+r.charAt(0)+'</span>';}
  function ctImgFallback(root){if(!root)return;Array.prototype.forEach.call(root.querySelectorAll('.ct-ricimg'),function(img){img.addEventListener('error',function(){var s=document.createElement('span');s.className='ct-ricl';s.textContent=(img.getAttribute('data-coin')||'?').charAt(0);if(img.parentNode)img.parentNode.replaceChild(s,img);});});}
  function buildRoomBar(){
    if(roomBar||!box)return;var head=box.querySelector('.ct-head');if(!head)return;
    roomBar=document.createElement('div');roomBar.className='ct-roomsel';
    roomBar.innerHTML='<button type="button" class="ct-roombtn" aria-haspopup="true"><span class="ct-ricw">'+roomIcon(room)+'</span><span class="ct-roomcur">'+roomLabel(room)+'</span>'+CT_CARET+'</button>'
      +'<div class="ct-roommenu" hidden>'+chatRooms().map(function(r){return '<button type="button" class="ct-roomitem'+(r===room?' on':'')+(r==='PREMIUM'?' ct-roomprem':'')+'" data-room="'+r+'"><span class="ct-riw">'+roomIcon(r)+'</span><span class="ct-ri-l">'+roomLabel(r)+'</span>'+CT_CHECK+'</button>';}).join('')+'</div>';
    var title=head.querySelector('.ct-title');if(title&&title.nextSibling)head.insertBefore(roomBar,title.nextSibling);else head.appendChild(roomBar);
    ctImgFallback(roomBar);
    var btn=roomBar.querySelector('.ct-roombtn'),menu=roomBar.querySelector('.ct-roommenu');
    btn.addEventListener('click',function(e){e.stopPropagation();var open=menu.hidden;menu.hidden=!open;btn.classList.toggle('open',open);});
    menu.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-room]');if(b){switchRoom(b.getAttribute('data-room'));menu.hidden=true;btn.classList.remove('open');}});
    document.addEventListener('click',function(){if(menu&&!menu.hidden){menu.hidden=true;btn.classList.remove('open');}});
  }
  function markRoomPills(){if(!roomBar)return;var cur=roomBar.querySelector('.ct-roomcur');if(cur)cur.textContent=roomLabel(room);var iw=roomBar.querySelector('.ct-roombtn .ct-ricw');if(iw){iw.innerHTML=roomIcon(room);ctImgFallback(iw);}var its=roomBar.querySelectorAll('[data-room]');for(var i=0;i<its.length;i++)its[i].classList.toggle('on',its[i].getAttribute('data-room')===room);}
  function switchRoom(r){if(r===room||chatRooms().indexOf(r)<0)return;room=r;markRoomPills();if(msgs)msgs.innerHTML='';try{input.placeholder=(room==='global'?'Message…':room==='PREMIUM'?'Premium lounge — VIPs only…':'Message '+room+' room…')+'  ·  /leaderboard · /signal';}catch(e){}if(ws){try{ws.onclose=null;ws.close();}catch(e){}ws=null;}if(joined)connect();}
  function meUser(){var me=(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me())||null;if(!me)return '';return String(me.username||(me.email||'').split('@')[0]||'trader').replace(/[<>&]/g,'').slice(0,20);}
  function esc(s){return String(s).replace(/[<>&]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}
  /* escape first (XSS-safe), THEN turn `trade:<id>` tokens into clickable links that open the shared ticket */
  function linkifyMsg(t){return esc(t).replace(/\btrade:([a-z0-9]{6,16})\b/gi,function(mm,id){id=id.toLowerCase();return '<a class="ct-trade" data-trade="'+id+'" role="button" tabindex="0" title="Open shared ticket">trade:'+id+'</a>';});}
  function colorFor(u){var h=0;for(var i=0;i<u.length;i++)h=(h*31+u.charCodeAt(i))%360;return 'hsl('+h+',65%,70%)';}
  var MP_BADGE='<svg viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-3px;margin-right:4px;filter:drop-shadow(0 0 3px rgba(194,246,74,.55))"><path d="M12 1L14.83 3.3L18.47 3.1L19.4 6.62L22.46 8.6L21.15 12L22.46 15.4L19.4 17.38L18.47 20.9L14.83 20.7L12 23L9.17 20.7L5.53 20.9L4.6 17.38L1.54 15.4L2.85 12L1.54 8.6L4.6 6.62L5.53 3.1L9.17 3.3Z" fill="#c2f64a"/><path d="M7.7 12.3l2.9 2.9L16.4 9.3" fill="none" stroke="#0a0b0d" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function addMsg(m){var d=document.createElement('div');d.className='ct-msg';var _ts=+m.ts||0;var _hm=_ts?(function(x){var p=function(n){return n<10?'0'+n:''+n;};return p(x.getHours())+':'+p(x.getMinutes());})(new Date(_ts)):'';var _tm=_hm?'<span class="ct-time" title="'+new Date(_ts).toLocaleString()+'">'+_hm+'</span>':'';var who=_tm+(m.admin?'<b style="color:#e9e7df;font-weight:800">'+MP_BADGE+'Margin<span style="color:#c2f64a">Pad</span></b>':'<span data-lvln="'+esc(m.u)+'"></span><b class="ct-user" data-lbu="'+esc(m.u)+'" role="button" tabindex="0" style="color:'+colorFor(m.u)+'">'+esc(m.u)+'</b><span data-lpro="'+esc(m.u)+'"></span>');var _sg=window._mpParseSig&&window._mpParseSig(m.t);d.innerHTML=who+' '+(_sg?window._mpSigCardHtml(_sg):linkifyMsg(m.t));msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;if(window.mpLvlDecorate)window.mpLvlDecorate();}
  /* click a username in chat → open that trader's profile card (window.mpOpenProfile provided by mp-profile.js, or the homepage's inline lbOpenProfile exposed as it) */
  function openTraderCard(n){n=String(n||'').replace(/[^a-zA-Z0-9_]/g,'');if(!n)return;if(window.mpOpenProfile){try{window.mpOpenProfile(n);}catch(_){}}}
  if(msgs)msgs.addEventListener('click',function(e){var tr=e.target.closest&&e.target.closest('.ct-trade[data-trade]');if(tr){e.stopPropagation();e.preventDefault();if(window.mpOpenTrade)window.mpOpenTrade(tr.getAttribute('data-trade'));return;}var el=e.target.closest&&e.target.closest('.ct-user[data-lbu]');if(el){e.stopPropagation();openTraderCard(el.getAttribute('data-lbu'));}});
  /* unread signal: glow the chat FAB (desktop) + a dot on the bottom-nav Chat button (mobile) when a new message lands while the chat is closed */
  function chatAlert(on){try{
    if(fab){fab.classList.toggle('ct-alert',on);var fd=fab.querySelector('.ctfab-dot');if(on&&!fd){fd=document.createElement('span');fd.className='ctfab-dot';fab.appendChild(fd);}else if(!on&&fd){fd.remove();}}
    var navs=document.querySelectorAll('.mobnav [data-mn="chat"], .mpbn [data-mpbn="chat"]');for(var _i=0;_i<navs.length;_i++){var el=navs[_i];el.classList.toggle('ct-alert',on);el.style.color=on?'#38bdf8':'';if(on){el.style.position='relative';if(!el.querySelector('.mn-chat-dot')){var md=document.createElement('span');md.className='mn-chat-dot';md.style.cssText='position:absolute;top:1px;left:calc(50% + 7px);width:8px;height:8px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px #38bdf8;pointer-events:none;animation:ctDotPulse 1.3s ease-in-out infinite;z-index:2;';el.appendChild(md);}}else{var md2=el.querySelector('.mn-chat-dot');if(md2)md2.remove();}}
    if(on&&window.mpBuzz)try{window.mpBuzz([12]);}catch(e){}
  }catch(e){}}
  window.mpChatAlert=chatAlert;
  /* "new messages" glow that works WITHOUT the WS (every visitor): poll the latest message ts, glow if newer than last-opened (and recent). */
  function chatSeenTs(){try{return +localStorage.getItem('mp_chat_seen')||0;}catch(e){return 0;}}
  function markChatSeen(){try{localStorage.setItem('mp_chat_seen',String(Date.now()));}catch(e){}}
  function pollChatLast(){try{if(!box.hidden)return;fetch('/chat/last?room='+encodeURIComponent(room),{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){if(d&&d.ts&&d.ts>chatSeenTs()&&d.ts>Date.now()-259200000)chatAlert(true);}).catch(function(){});}catch(e){}}
  setTimeout(pollChatLast,2500);setInterval(pollChatLast,45000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)pollChatLast();});
  function setOnline(n){/* online count removed per owner */}
  function sysMsg(html){var d=document.createElement('div');d.className='ct-msg ct-sys';d.innerHTML=html;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d;}
 var LB_META={1:{t:'Green days',k:'topGreen'},4:{t:'Top ROE',k:'top'},2:{t:'Best win rate',k:'topWr'},3:{t:'Weekly XP',k:'topXp'}};
  function showLeaderboard(board){board=(board===2||board===3||board===4)?board:1;var meta=LB_META[board];
    var lbMsg=sysMsg('<b style="color:#c2f64a">'+meta.t+'</b><br><span style="color:#9aa3ad">loading…</span>');
    fetch('/api/reward/lb').then(function(r){return r.json();}).then(function(d){var t=(d&&d[meta.k])||[],medal=['','',''];
      var html='<b style="color:#c2f64a">'+meta.t+' · this season</b><br>';
      if(!t.length)html+='<span style="color:#9aa3ad">No one on this board yet — be the first!</span>';
      else html+=t.slice(0,10).map(function(x,i){var val;
        if(board===2)val='<b style="color:#c2f64a">'+(+x.wr).toFixed(0)+'%</b> <span style="color:#7f8893">('+(+x.w||0)+'W-'+(+x.l||0)+'L)</span>';
        else if(board===3)val='<b style="color:#c2f64a">'+(+x.xp||0).toLocaleString()+' XP</b>';
        else if(board===4)val='<b style="color:'+((+x.roe)>=0?'#2ebd85':'#ff6258')+'">'+((+x.roe)>=0?'+':'')+(+x.roe).toFixed(0)+'%</b>';
        else val='<b style="color:#2ebd85">$'+(+x.bankUsd||0).toLocaleString('en-US',{maximumFractionDigits:0})+'</b>';
        return (medal[i]||((i+1)+'.'))+' '+esc(x.who||'anon')+'<span data-lvln="'+esc(x.who||'')+'"></span> — '+val;}).join('<br>');
      var _we=d&&d.weekEnd,_es='';if(_we){var _ms=_we-Date.now();if(_ms>0){var _d=Math.floor(_ms/86400000),_h=Math.floor(_ms%86400000/3600000);_es=(_d>0?_d+'d ':'')+_h+'h';}}
 html+='<br><span style="color:#ffce8a;font-size:11.5px"> 14-day season (UTC)'+(_es?' · ends in '+_es:'')+'</span>';
 html+='<br><span style="color:#7f8893;font-size:11.5px">Boards: <b>/leaderboard1</b> green days · <b>/leaderboard2</b> win rate · <b>/leaderboard3</b> XP · <b>/leaderboard4</b> ROE · members only, prizes paid in USDT each 14-day season</span>';
      lbMsg.innerHTML=html;msgs.scrollTop=msgs.scrollHeight;if(window.mpLvlDecorate)window.mpLvlDecorate();
    }).catch(function(){lbMsg.innerHTML='<span style="color:#ff6258">Could not load the leaderboard. Try again.</span>';});
  }
  function connect(){
    if(ws)return;
    try{ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/chat/ws?room='+encodeURIComponent(room));}catch(e){return;}
    ws.onmessage=function(ev){var d;try{d=JSON.parse(ev.data);}catch(e){return;}
      if(d.type==='poll'||d.type==='pollv'){try{var pb=document.getElementById('ctPollBox');if(!pb){pb=document.createElement('div');pb.id='ctPollBox';msgs.parentNode.insertBefore(pb,msgs);}if(d.type==='poll'&&!d.poll){pb.innerHTML='';window.__ctPoll=null;}else{var P=d.type==='poll'?d.poll:(window.__ctPoll?Object.assign(window.__ctPoll,{votes:d.votes}):null);if(P){window.__ctPoll=P;var tot=0;P.votes.forEach(function(v){tot+=v;});var oh=P.opts.map(function(o,i){var pc=tot?Math.round(P.votes[i]/tot*100):0;var mi=window.__ctPollMy&&window.__ctPollMy.id===P.id?window.__ctPollMy.i:null;return '<button type="button" data-pvi="'+i+'" '+(P.closed?'disabled':'')+' style="display:block;width:100%;text-align:left;margin:4px 0;padding:7px 9px;background:'+(mi===i?'#1a2413':'#12161d')+';border:1px solid '+(mi===i?'#c2f64a':'#232b3a')+';border-radius:8px;color:#dbe4f5;font-size:12px;cursor:'+(P.closed?'default':'pointer')+';position:relative;overflow:hidden;font-family:inherit"><span style="position:absolute;left:0;top:0;bottom:0;width:'+pc+'%;background:rgba(194,246,74,.12)"></span><span style="position:relative">'+o+' <b style="float:right;color:#c2f64a">'+pc+'%</b></span></button>';}).join('');pb.innerHTML='<div style="background:#0d1014;border:1px solid #2a3345;border-radius:10px;padding:10px 12px;margin:8px 10px"><div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:#c2f64a;margin-bottom:5px">'+(P.closed?'POLL · FINAL RESULTS':'LIVE POLL — tap to vote')+'</div><div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:6px">'+P.q+'</div>'+oh+'<div style="font-size:10px;color:#5c6b84;margin-top:4px">'+tot+' vote'+(tot===1?'':'s')+'</div></div>';if(!P.closed&&!pb._pw){pb._pw=1;pb.addEventListener('click',function(ev){var b=ev.target.closest('[data-pvi]');if(!b||!window.__ctPoll||window.__ctPoll.closed)return;var i=+b.getAttribute('data-pvi');window.__ctPollMy={id:window.__ctPoll.id,i:i};try{ws.send(JSON.stringify({type:'vote',id:window.__ctPoll.id,i:i,u:user}));}catch(e){}});}}}}catch(e){}}
      if(d.type==='history'){msgs.innerHTML='';(d.messages||[]).forEach(addMsg);setOnline(d.online);}
      else if(d.type==='msg'){addMsg(d.message);setOnline(d.online);if(d.message&&d.message.u===user){markChatSeen();}else if(box.hidden&&d.message){chatAlert(true);}}
      else if(d.type==='presence'){setOnline(d.online);}};
 ws.onclose=function(ev){ws=null;if(ev&&ev.code===4001)return;/* replaced by a newer tab — reconnect only when this tab is visible again */if(joined)setTimeout(connect,3000);};
    ws.onerror=function(){try{ws.close();}catch(e){}};
  }
 /* Safari keeps background-tab sockets half-open; close ours cleanly when the page goes away and
 come back when the tab is visible again (also covers the 4001 replaced case). */
 window.addEventListener('pagehide',function(){if(ws){try{ws.onclose=null;ws.close(1000);}catch(e){}ws=null;}});
 document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&joined&&!ws)connect();});
 window.addEventListener('pageshow',function(){if(joined&&!ws)connect();});
  function showChat(){var _me=window.mpAuth&&window.mpAuth.me&&window.mpAuth.me();if(_me&&(_me.muted||(','+String(_me.restrictions||'')+',').indexOf(',chat,')>=0)){gate.hidden=true;msgs.hidden=false;form.hidden=true;sysMsg('Your account is currently restricted from the chat. If you believe this is a mistake, contact <b>support@marginpad.io</b>.');return;}gate.hidden=true;msgs.hidden=false;form.hidden=false;joined=true;buildRoomBar();if(roomBar)roomBar.hidden=false;connect();try{input.placeholder=(room==='global'?'Message…':'Message '+room+' room…')+'  ·  /leaderboard · /signal';}catch(e){}setTimeout(function(){input.focus();},50);}
  function showGate(){gate.hidden=false;msgs.hidden=true;form.hidden=true;if(roomBar)roomBar.hidden=true;}
  function openBox(){chatAlert(false);markChatSeen();box.hidden=false;fab.hidden=true;document.body.classList.add('chat-open');var u=meUser();if(u){user=u;showChat();}else{showGate();}}
  window.mpOpenChat=openBox;
  fab.addEventListener('click',openBox);
  var hOpen=document.getElementById('chatOpen');if(hOpen)hOpen.addEventListener('click',openBox);
  var dchat=document.querySelectorAll('[data-chat]');for(var ci=0;ci<dchat.length;ci++)dchat[ci].addEventListener('click',openBox);
  if(/[?&]chat=1/.test(location.search)){try{openBox();}catch(e){}}
  closeBtn.addEventListener('click',function(){box.hidden=true;fab.hidden=false;document.body.classList.remove('chat-open');});
  if(signinBtn)signinBtn.addEventListener('click',function(){try{if(window.mpAuth&&window.mpAuth.open)window.mpAuth.open();}catch(e){}});
  window.addEventListener('mp-auth-change',function(){if(!box.hidden&&!joined){var u=meUser();if(u){user=u;showChat();}}});
  var ccPal=null,ccCmds=null,ccDeny=false;
  function ccHide(){if(ccPal)ccPal.style.display='none';}
  function ccRender(){
    var v=(input.value||'');if(v.charAt(0)!=='/'||!ccCmds){ccHide();return;}
    if(!ccPal){ccPal=document.createElement('div');ccPal.style.cssText='position:absolute;left:8px;right:8px;bottom:100%;margin-bottom:6px;background:#101318;border:1px solid #2a3140;border-radius:12px;box-shadow:0 -8px 30px rgba(0,0,0,.5);z-index:60;max-height:260px;overflow:auto;padding:5px;display:none';form.style.position='relative';form.appendChild(ccPal);
      ccPal.addEventListener('mousedown',function(e){var r=e.target.closest&&e.target.closest('[data-cc]');if(!r)return;e.preventDefault();input.value=r.getAttribute('data-cc')+' ';input.focus();ccRender();});}
    var q=v.toLowerCase().split(' ')[0];
    var list=q==='/'?ccCmds:ccCmds.filter(function(c){return c.c.indexOf(q)===0;});
    if(!list.length){ccHide();return;}
    ccPal.style.display='block';
    ccPal.innerHTML=list.map(function(c){return '<div data-cc="'+c.c+'" style="display:flex;gap:10px;align-items:baseline;padding:7px 10px;border-radius:8px;cursor:pointer"><b style="color:#c2f64a;font:700 12.5px Consolas,monospace;white-space:nowrap">'+c.u+'</b><span style="color:#8a93a0;font-size:11.5px">'+c.d+'</span></div>';}).join('');
  }
  function ccProbe(){
    if(ccDeny||ccCmds)return;
    if(ccCmds===null){ccCmds=false;fetch('/api/auth/chatcmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cmd:'/cmds'})}).then(function(r){return r.json();}).then(function(j){if(j&&j.ok&&j.cmds&&j.cmds.length){ccCmds=j.cmds;ccRender();}else{ccDeny=true;}}).catch(function(){ccCmds=null;});}
  }
  input.addEventListener('input',function(){var v=(input.value||'');if(v.charAt(0)==='/'){ccProbe();ccRender();}else ccHide();});
  input.addEventListener('keyup',function(){var v=(input.value||'');if(v.charAt(0)!=='/')ccHide();});
  input.addEventListener('blur',function(){setTimeout(ccHide,160);});
  form.addEventListener('submit',function(e){e.preventDefault();var t=(input.value||'').trim();if(!t)return;var _lbm=t.match(/^\/(leaderboard|lb|leaders)\s*([1234])?\b/i);if(_lbm){input.value='';showLeaderboard(+_lbm[2]||1);return;}if(/^\/sig(nal)?\b/i.test(t)){input.value='';if(window._mpOpenSigForm)window._mpOpenSigForm({anchor:form,send:function(txt){if(ws&&ws.readyState===1){ws.send(JSON.stringify({type:'msg',u:user,t:txt}));try{window.__mpTrack&&window.__mpTrack('chat','signal');}catch(_){}return true;}return false;}});return;}if(t.charAt(0)==='/'){input.value='';fetch('/api/auth/chatcmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cmd:t})}).then(function(r){return r.json();}).then(function(j){window.__mpCcSys((j&&j.reply)||'Command failed.');}).catch(function(){window.__mpCcSys('Network error.');});return;}if(!ws||ws.readyState!==1)return;ws.send(JSON.stringify({type:'msg',u:user,t:t}));try{window.__mpTrack&&window.__mpTrack('chat','sent');}catch(_){}input.value='';});
  /* post a message into chat programmatically (used by "Share to chat" on a ticket): open the chat, ensure the WS is
     up, queue the send until it connects. Returns false if the user isn't signed in (chat requires login). */
  window.mpChatSay=function(text){text=String(text||'').trim();if(!text)return false;var u=meUser();if(!u){try{if(window.mpAuth&&window.mpAuth.open)window.mpAuth.open();}catch(e){}return false;}user=u;if(box&&box.hidden){try{openBox();}catch(e){}}else if(!joined){try{showChat();}catch(e){}}var payload=JSON.stringify({type:'msg',u:user,t:text}),tries=0;(function trySend(){if(ws&&ws.readyState===1){try{ws.send(payload);window.__mpTrack&&window.__mpTrack('chat','shareticket');}catch(e){}return;}if(tries++>40)return;if(!ws){try{connect();}catch(e){}}setTimeout(trySend,250);})();return true;};
})();

;/* ══════════ shared trade-ticket viewer — opens a chat `trade:<id>` link in a branded modal (self-contained) ══════════ */
(function(){
  if(window.mpOpenTrade)return;
  var CSS='.mptk-ov{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(4,5,7,.8);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .18s}'
   +'.mptk-ov.on{opacity:1}'
   +'.mptk{position:relative;width:min(440px,94vw);max-height:92vh;overflow:auto;border-radius:20px;border:1px solid #232b36;background:linear-gradient(180deg,#0e1218,#08090b);box-shadow:0 30px 90px -20px rgba(0,0,0,.8);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;color:#e9e7df;transform:translateY(8px);transition:transform .2s}'
   +'.mptk-ov.on .mptk{transform:none}'
   +'.mptk-glow{position:absolute;inset:0;border-radius:20px;pointer-events:none}'
   +'.mptk-in{position:relative;padding:22px 22px 20px}'
   +'.mptk-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}'
   +'.mptk-brand{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-weight:800;font-size:15px;letter-spacing:-.02em;color:#f1efe8}'
   +'.mptk-brand b{color:#c2f64a}'
   +'.mptk-x{width:30px;height:30px;border-radius:9px;border:1px solid #2a3340;background:#12161d;color:#9aa3ad;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;padding:0}'
   +'.mptk-x:hover{color:#fff;border-color:#3a4657}'
   +'.mptk-hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px}'
   +'.mptk-sym{font-family:"Space Mono",monospace;font-size:25px;font-weight:700;letter-spacing:-.01em}'
   +'.mptk-pill{font-family:"Space Mono",monospace;font-size:11px;font-weight:700;padding:4px 9px;border-radius:8px;letter-spacing:.03em}'
   +'.mptk-long{color:#34d99a;background:rgba(46,189,133,.14)}.mptk-short{color:#ff7b72;background:rgba(255,98,88,.14)}'
   +'.mptk-lev{color:#c8cdd4;background:#161b23;border:1px solid #262e3a}'
   +'.mptk-st{margin-left:auto;font-family:"Space Mono",monospace;font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px}'
   +'.mptk-st.open{color:#8fd4ff;background:rgba(56,189,248,.13)}.mptk-st.win{color:#34d99a;background:rgba(46,189,133,.14)}.mptk-st.loss{color:#ff7b72;background:rgba(255,98,88,.14)}'
   +'.mptk-roe{font-family:"Space Mono",monospace;font-size:50px;font-weight:700;line-height:1;letter-spacing:-.02em;margin:6px 0 2px}'
   +'.mptk-pnl{font-family:"Space Mono",monospace;font-size:16px;font-weight:700;margin-bottom:18px}'
   +'.mptk-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#1b222c;border:1px solid #1b222c;border-radius:14px;overflow:hidden;margin-bottom:16px}'
   +'.mptk-cell{background:#0c1015;padding:12px 14px}'
   +'.mptk-cell .l{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#5f6770;font-weight:600;margin-bottom:3px}'
   +'.mptk-cell .v{font-family:"Space Mono",monospace;font-size:15px;font-weight:700;color:#e9e7df;word-break:break-word}'
   +'.mptk-by{font-size:12px;color:#7f8893;margin-bottom:16px}.mptk-by b{color:#c8cdd4}'
   +'.mptk-cta{display:block;text-align:center;text-decoration:none;background:linear-gradient(180deg,#d3ff5e,#a6e02a);color:#0a0b0d;font-weight:800;border-radius:12px;padding:13px;font-size:14px;letter-spacing:.01em;box-shadow:0 10px 26px -10px rgba(194,246,74,.6)}'
   +'.mptk-cta:hover{filter:brightness(1.05)}'
   +'.mptk-foot{text-align:center;font-size:11px;color:#4b545d;margin-top:14px}'
   +'.mptk-err{padding:38px 12px;text-align:center;color:#9aa3ad;font-size:14px}'
   /* two-rails partner strip (Bybit amber rail / Moon violet-lime rail, slanted ticket cut). MIRROR: home.js */
   +'.mprl{margin:16px 0 0}'
   +'.mprl-t{display:flex;align-items:center;gap:10px;font-family:"Space Mono",monospace;font-size:9.5px;font-weight:700;letter-spacing:.24em;color:#5c656f;margin-bottom:9px;white-space:nowrap}'
   +'.mprl-t::before{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,#28303c)}'
   +'.mprl-t::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,#28303c,transparent)}'
   +'.mprl-row{display:flex;border:1px solid #262e3a;border-radius:13px;overflow:hidden;background:#0c0f13}'
   +'.mprl-c{position:relative;flex:1;display:flex;align-items:center;gap:9px;min-width:0;padding:12px 12px 12px 15px;text-decoration:none;color:#e9e7df;transition:background .16s}'
   +'.mprl-c::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px}'
   +'.mprl-by::before{background:#f7a600}'
   +'.mprl-mn::before{background:linear-gradient(180deg,#8a5cff,#c2f64a)}'
   +'.mprl-cut{width:1px;background:#262e3a;transform:skewX(-14deg);flex-shrink:0}'
   +'.mprl-k{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:13.5px;letter-spacing:.01em;flex-shrink:0}'
   +'.mprl-by .mprl-k{color:#f7a600}'
   +'.mprl-mn .mprl-k{color:#cdb7ff}'
   +'.mprl-d{font-size:11px;color:#8b95a1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}'
   +'.mprl-a{color:#5c656f;flex-shrink:0;transition:transform .16s,color .16s;font-weight:700}'
   +'.mprl-c:hover{background:#12161c}'
   +'.mprl-c:hover .mprl-a{transform:translateX(3px);color:#e9e7df}'
   +'.mprl-c img{border-radius:5px;flex-shrink:0;display:block}'
   +'@media(max-width:520px){.mprl-row{flex-direction:column}.mprl-cut{width:auto;height:1px;transform:none}}';
  function inject(){if(document.getElementById('mptkCss'))return;var s=document.createElement('style');s.id='mptkCss';s.textContent=CSS;(document.head||document.documentElement).appendChild(s);}
  function esc(s){return String(s==null?'':s).replace(/[<>&"]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m];});}
  function fp(x){x=+x;if(!isFinite(x))return '—';return '$'+x.toLocaleString('en-US',{maximumFractionDigits:x>=100?2:x>=1?4:8});}
  function money(x){var n=x<0;x=Math.abs(+x||0);var s;if(x>=1e9)s=(x/1e9).toFixed(2)+'B';else if(x>=1e6)s=(x/1e6).toFixed(2)+'M';else if(x>=1e5)s=(x/1e3).toFixed(1)+'K';else s=x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});return (n?'-$':'$')+s;}
  function ago(t){t=+t;if(!t)return '';var s=Math.floor((Date.now()-t)/1000);if(s<60)return 'just now';var m=Math.floor(s/60);if(m<60)return m+'m ago';var h=Math.floor(m/60);if(h<24)return h+'h ago';return Math.floor(h/24)+'d ago';}
  var curOv=null;
  function closeOv(){if(!curOv)return;var o=curOv;curOv=null;o.classList.remove('on');document.removeEventListener('keydown',onKey);setTimeout(function(){if(o&&o.parentNode)o.parentNode.removeChild(o);},220);}
  function onKey(e){if(e.key==='Escape')closeOv();}
  function wire(ov){var x=ov.querySelector('.mptk-x');if(x)x.onclick=closeOv;}
  function shell(inner){inject();
    if(curOv){var c=curOv.querySelector('.mptk');if(c){c.innerHTML=inner;wire(curOv);return curOv;}}
    var ov=document.createElement('div');ov.className='mptk-ov';ov.innerHTML='<div class="mptk" role="dialog" aria-modal="true">'+inner+'</div>';
    document.body.appendChild(ov);curOv=ov;ov.addEventListener('click',function(e){if(e.target===ov)closeOv();});document.addEventListener('keydown',onKey);wire(ov);requestAnimationFrame(function(){ov.classList.add('on');});return ov;}
  function top(){return '<div class="mptk-top"><span class="mptk-brand">MARGIN<b>PAD</b></span><button class="mptk-x" type="button" aria-label="Close">✕</button></div>';}
  function body(h){return '<div class="mptk-in">'+top()+h+'</div>';}
  function render(t){
    var long=t.side!=='short',closed=(t.status==='win'||t.status==='loss');
    var pnl=(t.pnl!=null?+t.pnl:null),roe=(t.roe!=null?+t.roe:null);
    var win=(pnl!=null?pnl>=0:(roe!=null?roe>=0:true)),ac=win?'#2ebd85':'#ff6258';
    var stCls=t.liquidated?'loss':(closed?(win?'win':'loss'):'open');
    var stTxt=t.liquidated?'LIQUIDATED':(closed?(win?'WIN':'LOSS'):'OPEN');
    var mark=(t.exit!=null?t.exit:t.entry),margin=(+t.margin>0)?+t.margin:null;
    var val=(margin!=null&&+t.lev>0)?margin*(+t.lev):(t.notional!=null?+t.notional:null);
    var inner='<div class="mptk-glow" style="background:radial-gradient(120% 55% at 50% 0%,'+(win?'rgba(46,189,133,.16)':'rgba(255,98,88,.16)')+',transparent 70%)"></div>'
      +'<div class="mptk-in">'+top()
      +'<div class="mptk-hd"><span class="mptk-sym">'+esc(t.sym||'—')+'</span><span class="mptk-pill '+(long?'mptk-long':'mptk-short')+'">'+(long?'LONG':'SHORT')+'</span><span class="mptk-pill mptk-lev">'+(+t.lev>0?(+t.lev):1)+'×</span><span class="mptk-st '+stCls+'">'+stTxt+(t.partial?' · '+t.partial+'%':'')+'</span></div>'
      +'<div class="mptk-roe" style="color:'+ac+'">'+(roe!=null?((roe>=0?'+':'')+roe.toFixed(2)+'%'):'—')+'</div>'
      +'<div class="mptk-pnl" style="color:'+(win?'#9fe9c8':'#ffb3ad')+'">'+(pnl!=null?((pnl>=0?'+':'−')+money(Math.abs(pnl)).replace('-','')+(closed?'':' (live)')):'')+'</div>'
      +'<div class="mptk-grid">'
        +'<div class="mptk-cell"><div class="l">Entry</div><div class="v">'+fp(t.entry)+'</div></div>'
        +'<div class="mptk-cell"><div class="l">'+(closed?'Exit':'Mark')+'</div><div class="v">'+fp(mark)+'</div></div>'
        +'<div class="mptk-cell"><div class="l">Leverage</div><div class="v">'+(+t.lev>0?(+t.lev):1)+'×</div></div>'
        +'<div class="mptk-cell"><div class="l">Liquidation</div><div class="v">'+(t.liq!=null?fp(t.liq):'—')+'</div></div>'
        +'<div class="mptk-cell"><div class="l">Size</div><div class="v">'+(margin!=null?money(margin):'—')+'</div></div>'
        +'<div class="mptk-cell"><div class="l">Value</div><div class="v">'+(val!=null?money(val):'—')+'</div></div>'
      +'</div>'
      +'<div class="mptk-by">Shared by <b>@'+esc(t.by||'trader')+'</b>'+((t.closeTs||t.ts)?' · '+ago(t.closeTs||t.ts):'')+'</div>'
      +'<a class="mptk-cta" href="/paper-trade?coin='+encodeURIComponent(String(t.sym||'').toUpperCase())+(long?'&side=long':'&side=short')+'">Paper trade '+esc(t.sym||'')+' →</a>'
      +'<div class="mprl"><div class="mprl-t">TRADE IT FOR REAL</div><div class="mprl-row">'
      +'<a class="mprl-c mprl-by" data-ex="Bybit" href="https://www.bybit.com/invite?ref=LZKBERJ" target="_blank" rel="sponsored noopener noreferrer" onclick="try{window.__mpTrack&&window.__mpTrack(&#39;exchange&#39;,&#39;Bybit&#39;)}catch(e){}"><span class="mprl-k">Bybit</span><span class="mprl-d">Futures · 100× · deep liquidity</span><span class="mprl-a">→</span></a>'
      +'<i class="mprl-cut"></i>'
      +'<a class="mprl-c mprl-mn" data-ex="Moon" href="https://moon.com/?c=moonkickstart" target="_blank" rel="sponsored noopener noreferrer" onclick="try{window.__mpTrack&&window.__mpTrack(&#39;exchange&#39;,&#39;Moon&#39;)}catch(e){}"><img src="/assets/moon.png" alt="" width="18" height="18"><span class="mprl-k">Moon</span><span class="mprl-d">Call it up or down · 24/7</span><span class="mprl-a">→</span></a>'
      +'</div></div>'
      +'<div class="mptk-foot">Paper trade · not financial advice</div></div>';
    shell(inner);
    try{if(t.skin){var _sc=document.querySelector('.mptk-ov .mptk');if(_sc)_sc.className+=' tsk-'+String(t.skin).replace(/[^a-z0-9_]/g,'');}}catch(_){}
  }
  window.mpOpenTrade=function(id){
    id=String(id||'').replace(/[^a-z0-9]/gi,'').slice(0,16);if(!id)return;
    shell(body('<div class="mptk-err">Loading ticket…</div>'));
    fetch('/api/tshare?id='+encodeURIComponent(id),{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){
      if(d&&d.ok&&d.ticket)render(d.ticket);
      else shell(body('<div class="mptk-err">This shared ticket is no longer available.</div>'));
    }).catch(function(){shell(body('<div class="mptk-err">Could not load the ticket. Check your connection.</div>'));});
  };
})();

/* UX pass (2026-07): bottom-nav "Trades" badge — open-position count (rekt/rewards; the homepage has its own copy in home.js) */
(function(){
  var btn=document.querySelector('.mobnav [data-mn="journal"]');if(!btn||btn.querySelector('.mn-badge'))return;
  var b=document.createElement('span');b.className='mn-badge';b.hidden=true;btn.appendChild(b);
  function count(){try{return (JSON.parse(localStorage.getItem('mp_journal')||'[]')).filter(function(e){return e.status==='open';}).length;}catch(e){return 0;}}
  function upd(){var n=count();if(n>0){b.textContent=n>9?'9+':String(n);b.hidden=false;}else b.hidden=true;}
  upd();setInterval(upd,3000);window.addEventListener('storage',upd);
})();

;/* ══════════ Partial-close sheet (owner task 2026-07): Close anywhere → pick how much to close ══════════
   window.mpCloseSheet(id, onDone): bottom sheet with 25/50/75/100% chips + slider + live preview.
   Partial close splits the position: a proportional slice (qty/margin/notional × pct) becomes its own CLOSED
   trade (same entry/leverage → identical ROE math, so the Leaderboard/journal/stats treat it like any trade),
   and the remainder stays OPEN with entry/liq/SL/TP untouched. 100% behaves exactly like the old full close. */
(function(){ if(window.mpCloseSheet)return;
  function jload(){try{return JSON.parse(localStorage.getItem('mp_journal'))||[];}catch(e){return[];}}
  function jstore(a){try{window.mpJStore(a);}catch(e){}}
  function mx(e){var px=window.mpLivePrices||{};var live=(px[e.sym]&&px[e.sym].p)||e.entry;var long=e.side!=='short',lev=(+e.lev>0)?+e.lev:1;var move=(live-e.entry)/e.entry*(long?1:-1);var pnl=(e.qty!=null&&isFinite(e.qty))?e.qty*(live-e.entry)*(long?1:-1)-(+e.fund||0):null;var margin=(+e.margin>0)?+e.margin:(e.notional&&lev?e.notional/lev:null);if(margin>0&&pnl!=null){var _op=e.status!=='win'&&e.status!=='loss',_pf=_op?-margin*0.99:-margin;if(pnl<_pf)pnl=_pf;}var roe=(pnl!=null&&margin>0)?pnl/margin:move*lev;return{live:live,long:long,move:move,pnl:pnl,margin:margin,roe:roe};}
  function fm(x){x=+x||0;var n=x<0;x=Math.abs(x);return (n?'-$':'$')+x.toLocaleString('en-US',{maximumFractionDigits:2});}
  function esc(s){return String(s).replace(/[<>&]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}
  var ov=null,pct=100,curId=null,after=null,syncT=null;
  function fullClose(e,m){e.status=(m.pnl!=null?(m.pnl>=0?'win':'loss'):(m.move>=0?'win':'loss'));e.exit=m.live;e.closeTs=Date.now();e.pnl=(m.pnl!=null?m.pnl:0);window._mpSltpHidden=true;try{if(window.mpHidePlanLines)window.mpHidePlanLines();}catch(_){}try{var _pn=(e.pnl!=null&&isFinite(e.pnl))?((e.pnl>=0?' +$':' −$')+Math.abs(e.pnl).toFixed(2)):'';window.__mpTrack&&window.__mpTrack('close',(e.sym||'trade')+' — '+(e.status==='win'?'win':'loss')+_pn);}catch(_){}}
  function build(){ if(ov)return;
    ov=document.createElement('div');ov.className='mpcs';ov.innerHTML=
      '<div class="mpcs-card" role="dialog" aria-label="Close position">'
      +'<div class="mpcs-h"><span class="mpcs-t"></span><button type="button" class="mpcs-x" aria-label="Cancel">✕</button></div>'
      +'<div class="mpcs-pnl"></div>'
      +'<div class="mpcs-chips"><button type="button" data-p="25">25%</button><button type="button" data-p="50">50%</button><button type="button" data-p="75">75%</button><button type="button" data-p="100" class="on">100%</button></div>'
      +'<input class="mpcs-sl" type="range" min="5" max="100" step="5" value="100" aria-label="Percent to close">'
      +'<div class="mpcs-prev"></div>'
      +'<button type="button" class="mpcs-go"></button>'
      +'</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){if(e.target===ov)hide();});
    ov.querySelector('.mpcs-x').addEventListener('click',hide);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')hide();});
    ov.querySelector('.mpcs-sl').addEventListener('input',function(){pct=+this.value;sync();});
 Array.prototype.forEach.call(ov.querySelectorAll('.mpcs-chips button'),function(b){b.addEventListener('click',function(){pct=+b.getAttribute('data-p');ov.querySelector('.mpcs-sl').value=pct;sync();try{if(navigator.vibrate)(navigator.userActivation&&navigator.userActivation.hasBeenActive)&&navigator.vibrate(8);}catch(_){}});});
    ov.querySelector('.mpcs-go').addEventListener('click',go);
  }
  function entry(){var d=jload();for(var i=0;i<d.length;i++)if(d[i].id===curId)return d[i];return null;}
  function sync(){ var e=entry(); if(!e||e.status!=='open'){hide();return;}
    var m=mx(e);
    Array.prototype.forEach.call(ov.querySelectorAll('.mpcs-chips button'),function(b){b.classList.toggle('on',+b.getAttribute('data-p')===pct);});
    ov.querySelector('.mpcs-t').innerHTML=esc(e.sym||'—')+' <b class="'+(m.long?'lg':'sh')+'">'+(m.long?'LONG':'SHORT')+'</b> '+(e.lev||1)+'× · '+fm(m.live);
    var pnl=(m.pnl!=null?m.pnl:0);
    ov.querySelector('.mpcs-pnl').innerHTML='<span class="'+(pnl>=0?'up':'dn')+'">'+(pnl>=0?'+':'−')+fm(Math.abs(pnl)).replace('-','')+'</span><small>ROE '+((m.roe*100)>=0?'+':'')+(m.roe*100).toFixed(2)+'%</small>';
    var f=pct/100,part=pnl*f,keepM=(m.margin||0)*(1-f);
    ov.querySelector('.mpcs-prev').innerHTML= pct>=100
      ? 'Closes the whole position at '+fm(m.live)+'.'
      : 'Realize <b class="'+(part>=0?'up':'dn')+'">'+(part>=0?'+':'−')+fm(Math.abs(part)).replace('-','')+'</b> now · <b>'+fm(keepM)+'</b> margin stays open (entry, liq, SL/TP unchanged).';
    var go=ov.querySelector('.mpcs-go');go.textContent='Close '+pct+'%';go.className='mpcs-go '+(pnl>=0?'up':'dn');
  }
  function show(id,cb){ curId=id;after=cb||null;
    var e=entry?null:null; // placeholder for lint clarity
    var d=jload(),tgt=null;for(var i=0;i<d.length;i++)if(d[i].id===id){tgt=d[i];break;}
    if(!tgt||tgt.status!=='open')return;
    if(tgt&&window.mpIsMktClosed&&window.mpIsMktClosed(tgt.sym)){
      var _m=(window.mpMktClosedMsg?window.mpMktClosedMsg(String(tgt.sym||'').toUpperCase()):(tgt.sym+' is closed'));
      try{(window.mpLimitToast||window.alert)(_m+' Your position cannot move while the exchange is shut, and exits fill when it reopens.');}catch(e){}
      return;
    }
    // legacy entries without qty AND margin can't be split meaningfully → close in full immediately (old behaviour)
    if(!(tgt.qty!=null&&isFinite(tgt.qty))&&!(+tgt.margin>0)){var m0=mx(tgt);fullClose(tgt,m0);jstore(d);done();return;}
    build();pct=100;ov.querySelector('.mpcs-sl').value=100;ov.classList.add('on');sync();
    if(syncT)clearInterval(syncT);syncT=setInterval(function(){if(ov&&ov.classList.contains('on'))sync();else{clearInterval(syncT);syncT=null;}},1200);
  }
  function hide(){if(ov)ov.classList.remove('on');if(syncT){clearInterval(syncT);syncT=null;}}
 function done(){try{if(window.mpBuzz)window.mpBuzz([22]);else if(navigator.vibrate)(navigator.userActivation&&navigator.userActivation.hasBeenActive)&&navigator.vibrate(22);}catch(_){}
    try{if(window.mpJournalRender)window.mpJournalRender();}catch(_){}
    if(after)try{after();}catch(_){}}
  function go(){ var d=jload(),e=null;for(var i=0;i<d.length;i++)if(d[i].id===curId){e=d[i];break;}
    if(!e||e.status!=='open'){hide();return;}
    var m=mx(e),f=Math.min(100,Math.max(5,pct))/100;
    /* P0 dual-write: server-filled trades (src:'srv') also close ON THE SERVER (fire-and-forget) so it
       learns instantly; the local apply below stays for instant UX and the regular journal sync converges
       both sides. Failure = exactly today's behavior. */
    var _pid9=null;
    try{var _me9=window.mpAuth&&window.mpAuth.me&&window.mpAuth.me();
      if(_me9&&e.src==='srv'&&window.fetch){
        if(f<1)_pid9=String(e.id)+'p'+Date.now().toString(36)+Math.floor(Math.random()*1e3); // shared part id → local split and server split converge on ONE row
        fetch('/api/trade/close',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',keepalive:true,body:JSON.stringify({id:e.id,pct:Math.round(f*100),pid:_pid9})}).catch(function(){});}
    }catch(_){}
    if(f>=1){ fullClose(e,m); }
    else{
      var part={};for(var k in e)if(Object.prototype.hasOwnProperty.call(e,k))part[k]=e[k];
      part.id=_pid9||(String(e.id)+'p'+Date.now().toString(36)+Math.floor(Math.random()*1e3));
      if(e.qty!=null&&isFinite(e.qty)){part.qty=e.qty*f;e.qty=e.qty*(1-f);}
      if(+e.margin>0){part.margin=+e.margin*f;e.margin=+e.margin*(1-f);}
      if(+e.notional>0){part.notional=+e.notional*f;e.notional=+e.notional*(1-f);}
      if(+e.fund){part.fund=+e.fund*f;e.fund=+e.fund*(1-f);}
      var pnl=(m.pnl!=null?m.pnl:(m.move*(+part.margin>0?(part.margin*(+e.lev>0?+e.lev:1)):0)))||0;
      if(m.pnl!=null)pnl=m.pnl*f;
      part.status=pnl>=0?'win':'loss';part.exit=m.live;part.closeTs=Date.now();part.pnl=pnl;part.partial=Math.round(f*100);
      d.push(part);
      try{window.__mpTrack&&window.__mpTrack('close',(e.sym||'trade')+' — closed '+part.partial+'% '+(pnl>=0?'+$':'−$')+Math.abs(pnl).toFixed(2));}catch(_){}
    }
    jstore(d);hide();done();
    // confirm the close (parity with home.js) — the card just vanishing left users asking "where did my trade go?"
    try{var _cp=(f>=1?(+e.pnl||0):pnl)||0,_px=(+m.live).toLocaleString('en-US',{maximumFractionDigits:6});
      if(window.mpLimitToast)window.mpLimitToast((f>=1?'Closed ':'Closed '+Math.round(f*100)+'% of ')+String(e.sym||'')+' at '+_px+' · '+(_cp>=0?'+$':'−$')+Math.abs(_cp).toFixed(2)+' — saved to My Trades.');}catch(_){}
  }
  window.mpCloseSheet=function(id,cb){return show(id,cb);};
})();

;/* ══════════ SL/TP edit sheet (owner tasks 2026-07 + 2026-07-13 multi-level): edit stop-loss / take-profit
   LEVELS on any OPEN ticket. window.mpSltpSheet(id, onDone). Up to 3 levels per side, each with a % of the
   position to close at that price (100% = full close, smaller % = partial, remainder stays open). Every level
   has an ✕ remove button — no levels = no SL/TP. Wrong-side values are rejected per level. Storage: a single
   100% level stays in legacy e.stop/e.tp; anything richer goes to e.sls/e.tps=[{p,pct}] with the legacy field
   mirroring the nearest 100% level (so checkClose/sweepLiq/legacy displays keep working unchanged). */
(function(){ if(window.mpSltpSheet)return;
  function jload(){try{return JSON.parse(localStorage.getItem('mp_journal'))||[];}catch(e){return[];}}
  function jstore(a){try{window.mpJStore(a);}catch(e){}}
  function fp(x){x=+x||0;return '$'+x.toLocaleString('en-US',{maximumFractionDigits:x>=100?2:x>=1?4:8});}
  function esc(s){return String(s).replace(/[<>&]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}
  if(!window.mpLvlTxt)window.mpLvlTxt=function(e,isTp,fmt){var arr=isTp?e.tps:e.sls,lg=e.side!=='short';
    if(arr&&arr.length){var a=arr.slice().sort(function(x,y){return (isTp===lg)?(x.p-y.p):(y.p-x.p);});
      var s=fmt(+a[0].p)+(+a[0].pct<100?' ('+(+a[0].pct)+'%)':'');if(a.length>1)s+=' +'+(a.length-1);return s;}
    var v=isTp?e.tp:e.stop;return v!=null?fmt(v):'—';};
  var ov=null,curId=null,after=null,MAXL=3;
  function rowHtml(p,pct){return '<div class="mpss-row"><input type="number" step="any" inputmode="decimal" class="p" placeholder="price" value="'+(p!=null?p:'')+'"><select class="pc" aria-label="Percent to close">'+[10,25,50,75,100].map(function(v){return '<option value="'+v+'"'+(v===(+pct||100)?' selected':'')+'>'+v+'%</option>';}).join('')+'</select><button type="button" class="rm" aria-label="Remove level">✕</button></div>';}
  function build(){ if(ov)return;
    ov=document.createElement('div');ov.className='mpcs mpss';ov.innerHTML=
      '<div class="mpcs-card" role="dialog" aria-label="Edit SL / TP">'
      +'<div class="mpcs-h"><span class="mpcs-t"></span><button type="button" class="mpcs-x" aria-label="Cancel">✕</button></div>'
      +'<div class="mpss-live"></div>'
      +'<div class="mpss-sec" data-k="sl"><div class="mpss-lab">Stop-loss levels</div><div class="mpss-rows"></div><button type="button" class="mpss-add">+ Add stop-loss</button></div>'
      +'<div class="mpss-sec" data-k="tp"><div class="mpss-lab">Take-profit levels</div><div class="mpss-rows"></div><button type="button" class="mpss-add">+ Add take-profit</button></div>'
      +'<div class="mpss-hint">Each level closes its % of the position when the price touches it — 100% closes everything, a smaller % closes part and the rest stays open. ✕ removes a level; no levels = none.</div>'
      +'<div class="mpss-warn" hidden></div>'
      +'<button type="button" class="mpcs-go up">Save SL / TP</button>'
      +'</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){ if(e.target===ov){hide();return;}
      var add=e.target.closest&&e.target.closest('.mpss-add');
      if(add){var rows=add.parentNode.querySelector('.mpss-rows');if(rows.children.length<MAXL){rows.insertAdjacentHTML('beforeend',rowHtml(null,100));syncAdds();var inp=rows.lastElementChild.querySelector('.p');if(inp)try{inp.focus();}catch(_){}}return;}
      var rm=e.target.closest&&e.target.closest('.mpss-row .rm');
      if(rm){var row=rm.closest('.mpss-row');if(row)row.parentNode.removeChild(row);syncAdds();return;}
    });
    ov.querySelector('.mpcs-x').addEventListener('click',hide);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')hide();});
    ov.querySelector('.mpcs-go').addEventListener('click',save);
  }
  function syncAdds(){Array.prototype.forEach.call(ov.querySelectorAll('.mpss-sec'),function(sec){var n=sec.querySelector('.mpss-rows').children.length;sec.querySelector('.mpss-add').disabled=n>=MAXL;});}
  function find(){var d=jload();for(var i=0;i<d.length;i++)if(d[i].id===curId)return {d:d,e:d[i]};return null;}
  function live(e){var lp=window.mpLivePrices&&window.mpLivePrices[e.sym];return (lp&&lp.p>0)?lp.p:e.entry;}
  function levelsOf(e,isTp){var arr=isTp?e.tps:e.sls;
    if(arr&&arr.length)return arr.map(function(L){return {p:+L.p,pct:+L.pct||100};});
    var v=isTp?e.tp:e.stop;return v!=null?[{p:+v,pct:100}]:[];}
  function show(id,cb){ curId=id;after=cb||null;
    var r0=find(); if(!r0||r0.e.status!=='open')return; var e=r0.e;
    build();
    var long=e.side!=='short',lev=(+e.lev>0)?+e.lev:1,mmr=(e.mmr||0.005);
    var liq=e.liq||(long?e.entry*(1-(1-mmr)/lev):e.entry*(1+(1-mmr)/lev));
    ov.querySelector('.mpcs-t').innerHTML=esc(e.sym||'—')+' <b class="'+(long?'lg':'sh')+'">'+(long?'LONG':'SHORT')+'</b> '+(e.lev||1)+'×';
    ov.querySelector('.mpss-live').innerHTML='Live <b>'+fp(live(e))+'</b> · Entry <b>'+fp(e.entry)+'</b> · Liq <b class="lq">'+fp(liq)+'</b>';
    Array.prototype.forEach.call(ov.querySelectorAll('.mpss-sec'),function(sec){
      var isTp=sec.getAttribute('data-k')==='tp',rows=sec.querySelector('.mpss-rows');
      rows.innerHTML=levelsOf(e,isTp).slice(0,MAXL).map(function(L){return rowHtml(L.p,L.pct);}).join('');
    });
    syncAdds();
    var w=ov.querySelector('.mpss-warn');w.hidden=true;w.textContent='';
    ov.classList.add('on');
  }
  function hide(){if(ov)ov.classList.remove('on');}
  function warn(t){var w=ov.querySelector('.mpss-warn');w.textContent=t;w.hidden=false;}
  function collect(isTp){var sec=ov.querySelector('.mpss-sec[data-k="'+(isTp?'tp':'sl')+'"]'),out=[];
    Array.prototype.forEach.call(sec.querySelectorAll('.mpss-row'),function(row){
      var raw=row.querySelector('.p').value.trim();if(raw==='')return; // empty price row = removed
      out.push({p:parseFloat(raw),pct:+row.querySelector('.pc').value||100});
    });return out;}
  function save(){ var r=find(); if(!r||r.e.status!=='open'){hide();return;} var e=r.e;
    var long=e.side!=='short',lv=live(e);
    var sls=collect(false),tps=collect(true);
    for(var i=0;i<sls.length;i++){var s=sls[i];
      if(!isFinite(s.p)||!(s.p>0)){warn('Stop-loss price is not a number.');return;}
      if(long?s.p>=lv:s.p<=lv){warn('For a '+(long?'LONG every stop-loss must be BELOW':'SHORT every stop-loss must be ABOVE')+' the live price ('+fp(lv)+') — otherwise it would trigger instantly.');return;}}
    for(var j=0;j<tps.length;j++){var t=tps[j];
      if(!isFinite(t.p)||!(t.p>0)){warn('Take-profit price is not a number.');return;}
      if(long?t.p<=lv:t.p>=lv){warn('For a '+(long?'LONG every take-profit must be ABOVE':'SHORT every take-profit must be BELOW')+' the live price ('+fp(lv)+').');return;}}
    function put(list,isTp){
      if(!list.length){ if(isTp){e.tp=null;delete e.tps;} else {e.stop=null;delete e.sls;} return; }
      if(list.length===1&&+list[0].pct>=100){ if(isTp){e.tp=+list[0].p;delete e.tps;} else {e.stop=+list[0].p;delete e.sls;} return; }
      if(isTp)e.tps=list;else e.sls=list;
      var full=list.filter(function(L){return +L.pct>=100;}),v=null;
      if(full.length){full.sort(function(a,b){return (isTp===long)?(a.p-b.p):(b.p-a.p);});v=+full[0].p;}
      if(isTp)e.tp=v;else e.stop=v;
    }
    put(sls,false);put(tps,true);
    jstore(r.d);hide();
    /* Server-first for server-filled trades — mirror of home.js (see the rationale there). */
    try{var _me8=window.mpAuth&&window.mpAuth.me&&window.mpAuth.me();
      if(_me8&&e.src==='srv'&&window.fetch){
        fetch('/api/trade/sltp',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',keepalive:true,body:JSON.stringify({id:e.id,sl:(e.stop==null?null:+e.stop),tp:(e.tp==null?null:+e.tp)})}).catch(function(){});}
    }catch(_){}
    try{document.dispatchEvent(new CustomEvent('mp:sltp',{detail:{id:e.id}}));}catch(_){}
    try{window.__mpTrack&&window.__mpTrack('sltp',(e.sym||'')+' '+(e.side==='short'?'SHORT':'LONG'));}catch(_){}
 try{if(window.mpBuzz)window.mpBuzz([14]);else if(navigator.vibrate)(navigator.userActivation&&navigator.userActivation.hasBeenActive)&&navigator.vibrate(14);}catch(_){}
    try{if(window.mpJournalRender)window.mpJournalRender();}catch(_){}
    if(after)try{after();}catch(_){}
  }
  window.mpSltpSheet=show;
})();

// ---- /signal chat cards (2026-08-03): parse + card render + mini form (shared shape home.js/mp-trade.js) ----
(function(){
  if(window._mpParseSig)return;
  function fpx(v){v=+v;return '$'+v.toLocaleString('en-US',{maximumFractionDigits:v>=100?2:v>=1?4:6});}
  function pct(a,b){return Math.abs((a-b)/b*100).toFixed(1);}
  window._mpParseSig=function(t){
    var m=/^\[SIGNAL\] (LONG|SHORT) ([A-Z0-9]{2,10})\/USDT (15m|1h|4h|1d) \| E ([0-9.]+) \| TP1 ([0-9.]+) \| TP2 ([0-9.]+) \| SL ([0-9.]+) \| LEV ([0-9]{1,3})$/.exec(String(t||'').trim());
    if(!m)return null;
    var s={side:m[1],sym:m[2],tf:m[3],e:+m[4],tp1:+m[5],tp2:+m[6],sl:+m[7],lev:+m[8]};
    if(!(s.e>0&&s.tp1>0&&s.tp2>0&&s.sl>0&&s.lev>0))return null;
    return s;
  };
  window._mpSigCardHtml=function(s){
    var long=s.side==='LONG';
    return '<div class="ct-sig '+(long?'lg':'sh')+'">'
      +'<div class="ct-sig-h"><span class="ct-sig-pill">'+(long?'BUY':'SELL')+' signal</span><b>'+s.sym+'/USDT</b><span class="ct-sig-tf">'+s.tf+'</span></div>'
      +'<div class="ct-sig-r"><span>Entry</span><code>'+fpx(s.e)+'</code></div>'
      +'<div class="ct-sig-r"><span>TP1</span><code>'+fpx(s.tp1)+'</code><i>+'+pct(s.tp1,s.e)+'%</i><em>take ~half</em></div>'
      +'<div class="ct-sig-r"><span>TP2</span><code>'+fpx(s.tp2)+'</code><i>+'+pct(s.tp2,s.e)+'%</i></div>'
      +'<div class="ct-sig-r sl"><span>SL</span><code>'+fpx(s.sl)+'</code><i>-'+pct(s.sl,s.e)+'%</i></div>'
      +'<div class="ct-sig-r lev"><span>Max lev</span><code>~'+s.lev+'×</code><em>more risks liquidation before TP</em></div>'
      +'</div>';
  };
  window._mpOpenSigForm=function(ctx){
    if(!ctx||!ctx.anchor)return;
    var old=document.querySelector('.ctsg');if(old)old.remove();
    var p=document.createElement('div');p.className='ctsg';
    p.innerHTML='<div class="ctsg-h"><b>New signal</b><button type="button" class="ctsg-x" aria-label="Close">×</button></div>'
      +'<div class="ctsg-seg"><button type="button" class="ctsg-side lg on" data-s="LONG">LONG</button><button type="button" class="ctsg-side sh" data-s="SHORT">SHORT</button></div>'
      +'<div class="ctsg-row2"><input class="ctsg-in" data-f="sym" placeholder="Coin (e.g. XRP)" maxlength="10" autocapitalize="characters" spellcheck="false"><select class="ctsg-in" data-f="tf"><option>15m</option><option selected>1h</option><option>4h</option><option>1d</option></select></div>'
      +'<div class="ctsg-grid">'
      +'<label>Entry<input class="ctsg-in" data-f="e" inputmode="decimal" placeholder="1.0825"></label>'
      +'<label>TP1<input class="ctsg-in" data-f="tp1" inputmode="decimal" placeholder="1.0960"><s class="ctsg-pc" data-p="tp1"></s></label>'
      +'<label>TP2<input class="ctsg-in" data-f="tp2" inputmode="decimal" placeholder="1.1094"><s class="ctsg-pc" data-p="tp2"></s></label>'
      +'<label>SL<input class="ctsg-in" data-f="sl" inputmode="decimal" placeholder="1.0735"><s class="ctsg-pc sl" data-p="sl"></s></label>'
      +'<label>Max lev<input class="ctsg-in" data-f="lev" inputmode="numeric" placeholder="20" maxlength="3"></label>'
      +'</div>'
      +'<button type="button" class="ctsg-post">Post signal</button>'
      +'<div class="ctsg-err"></div>';
    ctx.anchor.parentNode.insertBefore(p,ctx.anchor);
    var side='LONG';
    function q(sel){return p.querySelector(sel);}
    function val(f){var el=q('[data-f="'+f+'"]');return el?el.value.trim():'';}
    function num(f){var v=parseFloat(val(f));return isFinite(v)&&v>0?v:null;}
    function upPc(){var e=num('e');['tp1','tp2','sl'].forEach(function(f){var el=q('[data-p="'+f+'"]'),v=num(f);
      if(!el)return;if(!(e&&v)){el.textContent='';return;}
      var d=Math.abs((v-e)/e*100).toFixed(1);el.textContent=(f==='sl'?'-':'+')+d+'%';});}
    Array.prototype.forEach.call(p.querySelectorAll('.ctsg-side'),function(b){b.addEventListener('click',function(){
      side=b.getAttribute('data-s');Array.prototype.forEach.call(p.querySelectorAll('.ctsg-side'),function(x){x.classList.toggle('on',x===b);});upPc();});});
    Array.prototype.forEach.call(p.querySelectorAll('.ctsg-in'),function(el){el.addEventListener('input',upPc);});
    q('.ctsg-x').addEventListener('click',function(){p.remove();});
    q('.ctsg-post').addEventListener('click',function(){
      var err=q('.ctsg-err');err.textContent='';
      var sym=val('sym').toUpperCase().replace(/[^A-Z0-9]/g,'');
      var e=num('e'),tp1=num('tp1'),tp2=num('tp2'),sl=num('sl'),lev=Math.round(num('lev')||0);
      if(sym.length<2){err.textContent='Enter the coin (e.g. XRP).';return;}
      if(!e||!tp1||!tp2||!sl){err.textContent='Fill entry, TP1, TP2 and SL (numbers).';return;}
      if(!(lev>=1&&lev<=125)){err.textContent='Max lev must be 1-125.';return;}
      var long=side==='LONG';
      if(long&&!(tp1>e&&tp2>=tp1&&sl<e)){err.textContent='For a LONG: TP1 above entry, TP2 above TP1, SL below entry.';return;}
      if(!long&&!(tp1<e&&tp2<=tp1&&sl>e)){err.textContent='For a SHORT: TP1 below entry, TP2 below TP1, SL above entry.';return;}
      var txt='[SIGNAL] '+side+' '+sym+'/USDT '+val('tf')+' | E '+e+' | TP1 '+tp1+' | TP2 '+tp2+' | SL '+sl+' | LEV '+lev;
      if(txt.length>278){err.textContent='Too long - shorten the numbers.';return;}
      if(!ctx.send(txt)){err.textContent='Chat is reconnecting - try again in a second.';return;}
      p.remove();
    });
    setTimeout(function(){var f=q('[data-f="sym"]');if(f)f.focus();},40);
  };
})();

/* GUEST CLOSES -> homepage Live closes feed (owner 2026-08-15): every close (manual, TP/SL, partial, liquidation) is
   swept from the journal and beaconed to /api/trades/guestclose. The SERVER decides: signed-in sessions are dropped
   there (their closes arrive via tradeev), anonymous visitors show up as a stable guestNNNNN. Recency guard (<2min)
   means historical closes never spam the feed on first run. Mirrored in home.js and mp-trade.js; one instance per page. */
(function(){if(window.__mpGW)return;window.__mpGW=1;
  function sweep(){try{
    var raw=localStorage.getItem('mp_journal')||'[]';
    if(raw===sweep._l)return; /* unchanged journal -> skip the JSON.parse entirely (runs every 4s; big journals stay free on idle) */
    var arr=JSON.parse(raw)||[];var ch=false,now=Date.now();
    for(var i=0;i<arr.length;i++){var e=arr[i];if(!e||e._gs)continue;
      if(e.status!=='win'&&e.status!=='loss')continue;
      e._gs=1;ch=true;
      if(!e.closeTs||now-e.closeTs>120000)continue;
      var mg=+e.margin||0,pnl=+e.pnl||0;if(!(mg>0))continue;
      try{fetch('/api/trades/guestclose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sym:String(e.sym||'').toUpperCase(),side:e.side==='short'?'short':'long',lev:+e.lev||1,margin:mg,pnl:pnl,liq:e.liquidated?1:0,cid:String(e.id||'')}),keepalive:true});}catch(_){}
    }
    if(ch){try{window.mpJStore(arr);sweep._l=localStorage.getItem('mp_journal');}catch(_){}}
    else sweep._l=raw;
  }catch(_){}}
  setInterval(sweep,4000);setTimeout(sweep,2500);
})();

/* shared toast for role-gated chat command replies (visible only to the sender; mirrored home.js/mp-trade.js, one instance per page) */
(function(){if(window.__mpCcSys)return;window.__mpCcSys=function(t){var h=document.getElementById('ccSysT');if(!h){h=document.createElement('div');h.id='ccSysT';h.style.cssText='position:fixed;bottom:86px;left:50%;transform:translateX(-50%);z-index:1400;background:#12151d;border:1px solid rgba(194,246,74,.5);color:#c2f64a;border-radius:12px;padding:9px 16px;font:600 12.5px system-ui,sans-serif;max-width:88vw;opacity:0;transition:opacity .25s;pointer-events:none;text-align:center';document.body.appendChild(h);}h.textContent=t;h.style.opacity='1';clearTimeout(window.__mpCcT);window.__mpCcT=setTimeout(function(){h.style.opacity='0';},4600);};})();
