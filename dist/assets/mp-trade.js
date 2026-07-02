/* My Trades drawer + price feed + Trader Chat — shared widget logic (ported from the homepage).
   View-only journal on pages without the Paper Trade form (add() simply finds no form and no-ops). */

/* Disable pinch-zoom on iOS (Safari ignores user-scalable=no in the viewport meta). */
(function(){['gesturestart','gesturechange','gestureend'].forEach(function(g){document.addEventListener(g,function(e){e.preventDefault();},{passive:false});});})();

/* ---------- My Trades journal / drawer ---------- */
(function(){
  var KEY='mp_journal';
  function MT(k,d){return (window.mpT&&window.mpT(k))||d;}
  function load(){try{return JSON.parse(localStorage.getItem(KEY))||[];}catch(e){return [];}}
  function store(a){try{localStorage.setItem(KEY,JSON.stringify(a));}catch(e){}}
  function esc(s){return String(s).replace(/[<>&]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}
  function money(x){x=+x||0;var n=x<0;x=Math.abs(x);return (n?'-$':'$')+x.toLocaleString('en-US',{maximumFractionDigits:2});}
  function num(id){var e=document.getElementById(id);var v=e?parseFloat(e.value):NaN;return isFinite(v)?v:NaN;}
  var jrTab='open';
  var SHARE_SVG='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"></line><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"></line></svg>';
  var COPY_SVG='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
  var CHART_SVG='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;vertical-align:-1px"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/></svg>';
  function gotoChart(sym){location.href='/paper-trade'+(sym?'?coin='+encodeURIComponent(sym):'');}
  function ppActions(e){return '<div class="pp-actions"><button class="pp-ic" data-act="share" data-id="'+e.id+'" title="'+MT('jShare','Share')+'" aria-label="'+MT('jShare','Share')+'">'+SHARE_SVG+'</button><button class="pp-ic" data-act="copy" data-id="'+e.id+'" title="'+MT('jCopyLink','Copy link + image')+'" aria-label="'+MT('jCopyLink','Copy link')+'">'+COPY_SVG+'</button></div>';}
  function fp(x){x=+x||0;return '$'+x.toLocaleString('en-US',{maximumFractionDigits:x>=100?2:x>=1?4:8});}
  function pctS(x){return ((+x)>=0?'+':'')+(+x).toFixed(2)+'%';}
  function dur(ms){var s=Math.floor(ms/1000);if(s<60)return s+'s';var m=Math.floor(s/60);if(m<60)return m+'m';var h=Math.floor(m/60);if(h<24)return h+'h '+(m%60)+'m';return Math.floor(h/24)+'d '+(h%24)+'h';}
  function metrics(e){var px=window.mpLivePrices||{};var live=(px[e.sym]&&px[e.sym].p)||(e.status!=='open'&&e.exit)||e.entry;var long=e.side!=='short',lev=(+e.lev>0)?+e.lev:1;var move=(live-e.entry)/e.entry*(long?1:-1);var gross=(e.qty!=null&&isFinite(e.qty))?e.qty*(live-e.entry)*(long?1:-1):null;var pnl=gross;var margin=(+e.margin>0)?+e.margin:(e.notional&&lev?e.notional/lev:null);var roe=(pnl!=null&&margin>0)?pnl/margin:move*lev;var liq=e.liq||(long?e.entry*(1-(1-(e.mmr||0.005))/lev):e.entry*(1+(1-(e.mmr||0.005))/lev));var liqDist=(live-liq)/live*100*(long?1:-1);if(margin>0){if(pnl!=null&&pnl<-margin)pnl=-margin;if(roe<-1)roe=-1;}return {live:live,long:long,lev:lev,move:move,roe:roe,pnl:pnl,liq:liq,liqDist:liqDist,margin:margin};}
  function openCard(e){var m=metrics(e),long=m.long,cls=(m.pnl!=null?(m.pnl>0?'pf':(m.pnl<0?'ls':'be')):(m.move>0?'pf':(m.move<0?'ls':'be')));
    return '<div class="pp '+cls+'" data-id="'+e.id+'">'+ppActions(e)
      +'<div class="pp-h"><span class="pp-sym">'+esc(e.sym||'—')+'</span><span class="pp-dir '+(long?'long':'short')+'">'+(long?'LONG':'SHORT')+'</span><span class="pp-live">'+(e.lev||1)+'× · '+fp(m.live)+'</span></div>'
      +'<div class="pp-pnl"><span class="big">'+(m.pnl!=null?((m.pnl>=0?'+':'−')+money(Math.abs(m.pnl)).replace('-','')):pctS(m.move*100))+'</span><span class="roe">ROE '+pctS(m.roe*100)+'</span></div>'
      +'<div class="pp-perf"></div>'
      +'<div class="pp-meta">'
        +'<div><span>'+MT('jEntry','Entry')+'</span><b>'+fp(e.entry)+'</b></div>'
        +'<div><span>'+MT('jMargin2','Margin')+'</span><b>'+(m.margin!=null?money(m.margin):'—')+'</b></div>'
        +'<div><span>'+MT('jLiq2','Liq')+'</span><b>'+fp(m.liq)+'</b></div>'
        +'<div><span>'+MT('jBuffer','Buffer')+'</span><b>'+pctS(m.liqDist)+'</b></div>'
        +'<div><span>SL</span><b>'+(e.stop!=null?fp(e.stop):'—')+'</b></div>'
        +'<div><span>TP</span><b>'+(e.tp!=null?fp(e.tp):'—')+'</b></div>'
      +'</div>'
      +'<div class="pp-foot">'+dur(Date.now()-e.ts)+' '+MT('jOpenLc','open')+'</div>'
      +'<div class="pp-btns"><button class="ch" data-act="chart" data-id="'+e.id+'">'+CHART_SVG+MT('jChart','Chart')+'</button><button class="cl" data-act="close" data-id="'+e.id+'">'+MT('jCloseBtn','Close')+'</button></div></div>';}
  function closedCard(e){var win=((+e.pnl)>=0),cls=win?'pf':'ls',long=e.side!=='short';
    return '<div class="pp '+cls+'" data-id="'+e.id+'">'+ppActions(e)
      +'<div class="pp-h"><span class="pp-sym">'+esc(e.sym||'—')+'</span><span class="pp-dir '+(long?'long':'short')+'">'+(long?'LONG':'SHORT')+'</span><span class="pp-live">'+(e.liquidated?'LIQ':(win?'WIN':'LOSS'))+'</span></div>'
      +'<div class="pp-pnl"><span class="big">'+(e.pnl!=null?(((+e.pnl)>=0?'+':'−')+money(Math.abs(e.pnl)).replace('-','')):(win?'TP hit':'SL hit'))+'</span>'+((e.margin&&e.pnl!=null)?'<span class="roe">ROE '+pctS(((+e.pnl)/(+e.margin||1))*100)+'</span>':'')+'</div>'
      +'<div class="pp-perf"></div>'
      +'<div class="pp-meta">'
        +'<div><span>'+MT('jEntry','Entry')+'</span><b>'+fp(e.entry)+'</b></div>'
        +'<div><span>'+MT('jExit','Exit')+'</span><b>'+fp(e.exit!=null?e.exit:(win?e.tp:e.stop))+'</b></div>'
        +'<div><span>'+MT('jLev','Leverage')+'</span><b>'+(e.lev||1)+'×</b></div>'
        +'<div><span>'+MT('jHeld','Held')+'</span><b>'+(e.closeTs?dur(e.closeTs-e.ts):'—')+'</b></div>'
      +'</div>'
      +'<div class="pp-btns"><button class="ch" data-act="chart" data-id="'+e.id+'">'+CHART_SVG+MT('jChart','Chart')+'</button><button class="cl" data-act="del" data-id="'+e.id+'">'+MT('jDelete','Delete')+'</button></div></div>';}
  function rr(x,X,Y,w,h,r){x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+w,Y,X+w,Y+h,r);x.arcTo(X+w,Y+h,X,Y+h,r);x.arcTo(X,Y+h,X,Y,r);x.arcTo(X,Y,X+w,Y,r);x.closePath();}
  function buildTicket(e){
    var m=metrics(e),closed=(e.status==='win'||e.status==='loss'),long=e.side!=='short';
    var pnl=closed?(+e.pnl||0):(m.pnl||0),roe=closed?((e.margin&&e.pnl!=null)?(+e.pnl)/(+e.margin):0):m.roe;
    var entry=e.entry,markpx=closed?(e.exit!=null?e.exit:(e.status==='win'?e.tp:e.stop)):m.live,win=pnl>=0;
    var W=1080,H=1080,c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');
    var g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0d1117');g.addColorStop(1,'#070809');x.fillStyle=g;x.fillRect(0,0,W,H);
    var ac=win?'#2ebd85':'#ff6258';
    var rgl=x.createRadialGradient(W*0.5,H*0.42,80,W*0.5,H*0.42,660);rgl.addColorStop(0,win?'rgba(46,189,133,0.16)':'rgba(255,98,88,0.16)');rgl.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=rgl;x.fillRect(0,0,W,H);
    x.strokeStyle='rgba(255,255,255,0.08)';x.lineWidth=2;rr(x,40,40,W-80,H-80,28);x.stroke();
    x.textBaseline='alphabetic';x.fillStyle='#c2f64a';x.font='700 38px Arial';x.fillText('MARGINPAD',70,120);
    x.fillStyle='#6b7682';x.font='400 26px Arial';x.textAlign='right';x.fillText('marginpad.io',W-70,120);x.textAlign='left';
    x.fillStyle='#fff';x.font='800 92px Arial';x.fillText(e.sym||'—',70,252);
    var bs=(long?'LONG':'SHORT')+'  '+(e.lev||1)+'x';x.font='700 34px Arial';var bw=x.measureText(bs).width+44;
    x.fillStyle=long?'rgba(46,189,133,0.18)':'rgba(255,98,88,0.18)';rr(x,70,292,bw,60,14);x.fill();
    x.fillStyle=long?'#34d99a':'#ff7b72';x.fillText(bs,92,334);
    x.textAlign='center';x.fillStyle=ac;x.font='800 190px Arial';x.fillText((roe>=0?'+':'')+(roe*100).toFixed(2)+'%',W/2,628);
    x.fillStyle=win?'#9fe9c8':'#ffb3ad';x.font='700 58px Arial';x.fillText((pnl>=0?'+$':'-$')+Math.abs(pnl).toLocaleString('en-US',{maximumFractionDigits:2})+(closed?'':' (live)'),W/2,722);x.textAlign='left';
    x.fillStyle='rgba(255,255,255,0.04)';rr(x,70,800,W-140,168,20);x.fill();
    function kv(lbl,val,cx){x.fillStyle='#6b7682';x.font='400 29px Arial';x.fillText(lbl,cx,856);x.fillStyle='#fff';x.font='700 44px Arial';x.fillText(val,cx,914);}
    kv(MT('jEntry','Entry'),fp(entry),110);kv(closed?MT('jExit','Exit'):MT('jMark','Mark'),fp(markpx),470);kv(MT('jStatus','Status'),closed?(win?'WIN':'LOSS'):'OPEN',830);
    x.fillStyle='#4b545d';x.font='400 24px Arial';x.textAlign='center';x.fillText(MT('jPaperDisc','Paper trade · not financial advice'),W/2,1020);x.textAlign='left';
    return c;
  }
  function shareTicket(e){
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
    var url='https://marginpad.io/?p=plan';
    if(!navigator.clipboard){toast(MT('jCopyFail','Copy not supported'));return;}
    if(!window.ClipboardItem){navigator.clipboard.writeText(url).then(function(){toast(MT('jLinkCopied','Link copied'));},function(){});return;}
    try{
      var blobP=new Promise(function(res){var c=buildTicket(e);c.toBlob(function(b){res(b);},'image/png');});
      var item=new ClipboardItem({'image/png':blobP,'text/plain':new Blob([url],{type:'text/plain'})});
      navigator.clipboard.write([item]).then(function(){toast(MT('jImgLinkCopied','Image + link copied'));},function(){navigator.clipboard.writeText(url).then(function(){toast(MT('jLinkCopied','Link copied'));},function(){});});
    }catch(_){navigator.clipboard.writeText(url).then(function(){toast(MT('jLinkCopied','Link copied'));},function(){});}
  }
  function render(){
    var listEl=document.getElementById('jrList'),statsEl=document.getElementById('jrStats'),emptyEl=document.getElementById('jrEmpty');
    if(!listEl||!statsEl)return;
    var data=load();
    var open=data.filter(function(e){return e.status==='open';});
    var closed=data.filter(function(e){return e.status==='win'||e.status==='loss';});
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
    var cards=rows.length?rows.slice().reverse().map(jrTab==='open'?openCard:closedCard).join(''):'<div class="pp-empty"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg><span>'+(jrTab==='open'?MT('jNoOpen','No open positions — open one from Paper Trade.'):MT('jNoClosed','No closed trades yet.'))+'</span></div>';
    listEl.innerHTML='<div class="jr-tabs"><button data-jt="open" class="'+(jrTab==='open'?'on':'')+'">'+MT('jOpenN','Open')+' ('+open.length+')</button><button data-jt="closed" class="'+(jrTab==='closed'?'on':'')+'">'+MT('jClosedN','Closed')+' ('+closed.length+')</button></div>'+cards;
    if(emptyEl)emptyEl.style.display='none';
  }
  function add(){
    var pl=window.mpPlanLive, entry=pl&&pl.price;
    var amt=num('planAmt'), lev=num('planLev');
    if(!isFinite(entry)||entry<=0||!isFinite(amt)||amt<=0)return;
    var seg=document.getElementById('planSeg'); var on=seg&&seg.querySelector('button.on'); var side=on?on.getAttribute('data-side'):'long';
    var symEl=document.getElementById('planSym'); var sym=((symEl&&symEl.value)||'').toUpperCase();
    var L=isFinite(lev)&&lev>0?Math.min(lev,1000):1, mmr=0.005;
    var feeRate=num('planFee'); feeRate=(isFinite(feeRate)&&feeRate>=0)?feeRate/100:0;
    var sl=num('planSlOpt'), tp=num('planTpOpt');
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
    var btn=document.getElementById('planSave'),sp=btn&&btn.querySelector('span');
    if(btn&&sp){var o=sp.textContent;btn.classList.add('saved');sp.textContent=MT('jOpened','Position opened ✓');setTimeout(function(){sp.textContent=o;btn.classList.remove('saved');},1600);}
    try{if(window.__mpTrack){window.__mpTrack('paper',(sym||'?')+' '+side);window.__mpTrack('plev',L<=5?'1-5x':L<=20?'5-20x':L<=50?'20-50x':L<=100?'50-100x':'100x+');}}catch(e){}
  }
  var saveBtn=document.getElementById('planSave'); if(saveBtn)saveBtn.addEventListener('click',add);
  document.addEventListener('click',function(ev){
    var b=ev.target.closest&&ev.target.closest('#jrList [data-act], #jrList [data-jt]'); if(!b)return;
    if(b.hasAttribute('data-jt')){jrTab=b.getAttribute('data-jt');render();return;}
    var id=b.getAttribute('data-id'),act=b.getAttribute('data-act');
    var data=load(),i=-1; for(var k=0;k<data.length;k++){if(data[k].id===id){i=k;break;}} if(i<0)return; var e=data[i];
    if(act==='share'){shareTicket(e);return;}
    if(act==='copy'){copyTicket(e);return;}
    if(act==='chart'){gotoChart(e.sym);return;}
    if(act==='del'){ data.splice(i,1); }
    else if(act==='close'){ if(window.mpCloseSheet){window.mpCloseSheet(id,function(){render();});return;} var m=metrics(e); e.status=(m.pnl!=null?(m.pnl>=0?'win':'loss'):(m.move>=0?'win':'loss')); e.exit=m.live; e.closeTs=Date.now(); e.pnl=(m.pnl!=null?m.pnl:0); }
    else if(act==='reopen'){ e.status='open'; e.exit=null; e.closeTs=null; e.pnl=null; }
    else if(act==='edit'){ var ns=prompt(MT('jNewSL','New stop-loss price:'),e.stop); if(ns!==null){var v=parseFloat(ns);if(isFinite(v))e.stop=v;} var nt=prompt(MT('jNewTP','New take-profit (blank = none):'),e.tp!=null?e.tp:''); if(nt!==null){var v2=parseFloat(nt);e.tp=isFinite(v2)?v2:null;} }
    store(data); render(); if(window.mpDrawLines)window.mpDrawLines();
  });
  var jrTimer=null,_jrTouchT=0;
  function renderLive(){var d=document.getElementById('jrDrawer');if(!d||d.hidden)return;if(Date.now()-_jrTouchT<800)return;/* on touch there's no :hover — pin the list while the finger is down so a live re-render can't destroy the tapped button */if(d.querySelector('button:hover,a:hover,[data-act]:hover,[data-jt]:hover'))return;render();}
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
  /* Overnight realism: liquidate any open trade that blew through its liq level while the tab was closed.
     This page has no live tick that closes trades, so we replay historical candles since each trade opened. */
  function sweepLiq(){var d=load(),open=d.filter(function(e){return e.status==='open'&&e.sym&&e.sym!=='—'&&e.entry>0;});if(!open.length)return;
    open.forEach(function(e){if((Date.now()-e.ts)<8*60000)return;
      var lng=e.side!=='short',liq=metrics(e).liq,ageH=(Date.now()-e.ts)/3600000;
      var tf=ageH>72?'1440':ageH>24?'240':ageH>6?'60':ageH>2?'30':'5';
      fetch('/api/klines?symbol='+encodeURIComponent(e.sym)+'&interval='+tf).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){
        if(!kd||!kd.length)return;var ivMs=parseInt(tf,10)*60000,cross=null;
        for(var i=0;i<kd.length;i++){var b=kd[i],bt=b.time*1000;if(bt+ivMs<e.ts)continue;
          if(lng?(+b.low<=liq):(+b.high>=liq)){cross=Math.max(bt,e.ts);break;}}
        if(cross==null)return;
        var d2=load(),idx=-1;for(var k=0;k<d2.length;k++){if(d2[k].id===e.id){idx=k;break;}}if(idx<0)return;var t=d2[idx];if(t.status!=='open')return;
        var dir=(t.side!=='short')?1:-1;t.status='loss';t.exit=liq;t.liquidated=true;t.pnl=(+t.margin>0)?-(+t.margin):((t.qty!=null&&isFinite(t.qty))?t.qty*(t.exit-t.entry)*dir:null);t.closeTs=cross;
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
  function reconnect(){retry=Math.min(retry+1,6);setTimeout(connect,Math.min(1200*retry,8000));}
  connect();
})();

/* ---------- trader chat ---------- */
(function(){
  var fab=document.getElementById('chatFab'),box=document.getElementById('chatBox'),gate=document.getElementById('ctGate'),
      msgs=document.getElementById('ctMsgs'),form=document.getElementById('ctForm'),input=document.getElementById('ctInput'),
      signinBtn=document.getElementById('ctSignin'),onlineEl=document.getElementById('ctOnline'),
      closeBtn=document.getElementById('ctClose');
  if(!fab)return;
  var ws=null,user='',joined=false;
  function meUser(){var me=(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me())||null;if(!me)return '';return String(me.username||(me.email||'').split('@')[0]||'trader').replace(/[<>&]/g,'').slice(0,20);}
  function esc(s){return String(s).replace(/[<>&]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}
  function colorFor(u){var h=0;for(var i=0;i<u.length;i++)h=(h*31+u.charCodeAt(i))%360;return 'hsl('+h+',65%,70%)';}
  var MP_BADGE='<svg viewBox="0 0 24 24" width="12" height="12" style="vertical-align:-2px;margin-left:3px"><circle cx="12" cy="12" r="11" fill="#c2f64a"/><path d="M7 12.5l3.2 3.2L17 8.5" fill="none" stroke="#0a0b0d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function addMsg(m){var d=document.createElement('div');d.className='ct-msg';var who=m.admin?'<b style="color:#e9e7df;font-weight:800">Margin<span style="color:#c2f64a">Pad</span>'+MP_BADGE+'</b>':'<b style="color:'+colorFor(m.u)+'">'+esc(m.u)+'</b>';d.innerHTML=who+' '+esc(m.t);msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;}
  function setOnline(n){if(n!=null)onlineEl.textContent=n+(n===1?' online':' online');}
  function sysMsg(html){var d=document.createElement('div');d.className='ct-msg ct-sys';d.innerHTML=html;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d;}
  function showLeaderboard(){var lbMsg=sysMsg('<b style="color:#c2f64a">🏆 Weekly leaderboard</b><br><span style="color:#9aa3ad">loading…</span>');
    fetch('/api/reward/lb').then(function(r){return r.json();}).then(function(d){var t=(d&&d.top)||[],medal=['🥇','🥈','🥉'];
      var html='<b style="color:#c2f64a">🏆 Weekly leaderboard</b><br>';
      if(!t.length)html+='<span style="color:#9aa3ad">No trades yet this week — be the first! Open Paper Trade and close a winner.</span>';
      else html+=t.slice(0,10).map(function(x,i){return (medal[i]||((i+1)+'.'))+' '+esc(x.who||'anon')+' — <b style="color:'+((+x.roe)>=0?'#2ebd85':'#ff6258')+'">'+((+x.roe)>=0?'+':'')+(+x.roe).toFixed(0)+'%</b>';}).join('<br>');
      var _we=d&&d.weekEnd,_es='';if(_we){var _ms=_we-Date.now();if(_ms>0){var _d=Math.floor(_ms/86400000),_h=Math.floor(_ms%86400000/3600000);_es=(_d>0?_d+'d ':'')+_h+'h';}}
      html+='<br><span style="color:#ffce8a;font-size:11.5px">⏳ Runs Mon → Sun (UTC)'+(_es?' · ends in '+_es:'')+'</span>';
      html+='<br><span style="color:#7f8893;font-size:11.5px">Members only — sign in (free) to join · prizes paid weekly in USDT · full board on Telegram @MarginPadBot</span>';
      lbMsg.innerHTML=html;msgs.scrollTop=msgs.scrollHeight;
    }).catch(function(){lbMsg.innerHTML='<span style="color:#ff6258">Could not load the leaderboard. Try again.</span>';});
  }
  function connect(){
    if(ws)return;
    try{ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/chat/ws');}catch(e){return;}
    ws.onmessage=function(ev){var d;try{d=JSON.parse(ev.data);}catch(e){return;}
      if(d.type==='history'){msgs.innerHTML='';(d.messages||[]).forEach(addMsg);setOnline(d.online);}
      else if(d.type==='msg'){addMsg(d.message);setOnline(d.online);}
      else if(d.type==='presence'){setOnline(d.online);}};
    ws.onclose=function(){ws=null;if(joined)setTimeout(connect,3000);};
    ws.onerror=function(){try{ws.close();}catch(e){}};
  }
  function showChat(){gate.hidden=true;msgs.hidden=false;form.hidden=false;joined=true;connect();try{input.placeholder='Message…  ·  type /leaderboard';}catch(e){}if(!window._mpLbTip){window._mpLbTip=1;setTimeout(function(){sysMsg('💬 Tip: type <b>/leaderboard</b> for the top traders. Full board on Telegram <b>@MarginPadBot</b>.');},400);}setTimeout(function(){input.focus();},50);}
  function showGate(){gate.hidden=false;msgs.hidden=true;form.hidden=true;}
  function openBox(){box.hidden=false;fab.hidden=true;document.body.classList.add('chat-open');var u=meUser();if(u){user=u;showChat();}else{showGate();}}
  window.mpOpenChat=openBox;
  fab.addEventListener('click',openBox);
  var hOpen=document.getElementById('chatOpen');if(hOpen)hOpen.addEventListener('click',openBox);
  var dchat=document.querySelectorAll('[data-chat]');for(var ci=0;ci<dchat.length;ci++)dchat[ci].addEventListener('click',openBox);
  if(/[?&]chat=1/.test(location.search)){try{openBox();}catch(e){}}
  closeBtn.addEventListener('click',function(){box.hidden=true;fab.hidden=false;document.body.classList.remove('chat-open');});
  if(signinBtn)signinBtn.addEventListener('click',function(){try{if(window.mpAuth&&window.mpAuth.open)window.mpAuth.open();}catch(e){}});
  window.addEventListener('mp-auth-change',function(){if(!box.hidden&&!joined){var u=meUser();if(u){user=u;showChat();}}});
  form.addEventListener('submit',function(e){e.preventDefault();var t=(input.value||'').trim();if(!t)return;if(/^\/(leaderboard|lb|leaders)\b/i.test(t)){input.value='';showLeaderboard();return;}if(!ws||ws.readyState!==1)return;ws.send(JSON.stringify({type:'msg',u:user,t:t}));input.value='';});
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
  function jstore(a){try{localStorage.setItem('mp_journal',JSON.stringify(a));}catch(e){}}
  function mx(e){var px=window.mpLivePrices||{};var live=(px[e.sym]&&px[e.sym].p)||e.entry;var long=e.side!=='short',lev=(+e.lev>0)?+e.lev:1;var move=(live-e.entry)/e.entry*(long?1:-1);var pnl=(e.qty!=null&&isFinite(e.qty))?e.qty*(live-e.entry)*(long?1:-1):null;var margin=(+e.margin>0)?+e.margin:(e.notional&&lev?e.notional/lev:null);if(margin>0&&pnl!=null&&pnl<-margin)pnl=-margin;var roe=(pnl!=null&&margin>0)?pnl/margin:move*lev;return{live:live,long:long,move:move,pnl:pnl,margin:margin,roe:roe};}
  function fm(x){x=+x||0;var n=x<0;x=Math.abs(x);return (n?'-$':'$')+x.toLocaleString('en-US',{maximumFractionDigits:2});}
  function esc(s){return String(s).replace(/[<>&]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}
  var ov=null,pct=100,curId=null,after=null,syncT=null;
  function fullClose(e,m){e.status=(m.pnl!=null?(m.pnl>=0?'win':'loss'):(m.move>=0?'win':'loss'));e.exit=m.live;e.closeTs=Date.now();e.pnl=(m.pnl!=null?m.pnl:0);window._mpSltpHidden=true;try{if(window.mpHidePlanLines)window.mpHidePlanLines();}catch(_){}}
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
    Array.prototype.forEach.call(ov.querySelectorAll('.mpcs-chips button'),function(b){b.addEventListener('click',function(){pct=+b.getAttribute('data-p');ov.querySelector('.mpcs-sl').value=pct;sync();try{if(navigator.vibrate)navigator.vibrate(8);}catch(_){}});});
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
    // legacy entries without qty AND margin can't be split meaningfully → close in full immediately (old behaviour)
    if(!(tgt.qty!=null&&isFinite(tgt.qty))&&!(+tgt.margin>0)){var m0=mx(tgt);fullClose(tgt,m0);jstore(d);done();return;}
    build();pct=100;ov.querySelector('.mpcs-sl').value=100;ov.classList.add('on');sync();
    if(syncT)clearInterval(syncT);syncT=setInterval(function(){if(ov&&ov.classList.contains('on'))sync();else{clearInterval(syncT);syncT=null;}},1200);
  }
  function hide(){if(ov)ov.classList.remove('on');if(syncT){clearInterval(syncT);syncT=null;}}
  function done(){try{if(window.mpBuzz)window.mpBuzz([22]);else if(navigator.vibrate)navigator.vibrate(22);}catch(_){}
    try{if(window.mpJournalRender)window.mpJournalRender();}catch(_){}
    if(after)try{after();}catch(_){}}
  function go(){ var d=jload(),e=null;for(var i=0;i<d.length;i++)if(d[i].id===curId){e=d[i];break;}
    if(!e||e.status!=='open'){hide();return;}
    var m=mx(e),f=Math.min(100,Math.max(5,pct))/100;
    if(f>=1){ fullClose(e,m); }
    else{
      var part={};for(var k in e)if(Object.prototype.hasOwnProperty.call(e,k))part[k]=e[k];
      part.id=String(e.id)+'p'+Date.now().toString(36)+Math.floor(Math.random()*1e3);
      if(e.qty!=null&&isFinite(e.qty)){part.qty=e.qty*f;e.qty=e.qty*(1-f);}
      if(+e.margin>0){part.margin=+e.margin*f;e.margin=+e.margin*(1-f);}
      if(+e.notional>0){part.notional=+e.notional*f;e.notional=+e.notional*(1-f);}
      var pnl=(m.pnl!=null?m.pnl:(m.move*(+part.margin>0?(part.margin*(+e.lev>0?+e.lev:1)):0)))||0;
      if(m.pnl!=null)pnl=m.pnl*f;
      part.status=pnl>=0?'win':'loss';part.exit=m.live;part.closeTs=Date.now();part.pnl=pnl;part.partial=Math.round(f*100);
      d.push(part);
    }
    jstore(d);hide();done();
  }
  window.mpCloseSheet=show;
})();
