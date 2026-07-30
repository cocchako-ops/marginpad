/* MarginPad homepage bundle — extracted from app/index.html inline blocks (order preserved).
   This file is the SOURCE (edited in place like mp-trade.js); app/index.html references it. */
/* TEMP pxtag (until 2026-09-01): identify WHO drives /api/price. __mpPQ(ctx,sym) → query suffix &px=<ctx>&pxw=<0|1>
   appended to every /api/price poll; pxw = is this symbol WS-covered (fresh <15s in __mpWsSeen, marked in emit()).
   Worker samples 1:10 → /api/admin/pxtag. DELETE this block + __mpWsSeen mark + the &px= call-site suffixes after. */
window.__mpWsSeen=window.__mpWsSeen||{};
window.__mpPQ=window.__mpPQ||function(ctx,sym){try{var t=window.__mpWsSeen[sym];return '&px='+ctx+'&pxw='+((t&&Date.now()-t<15000)?1:0);}catch(e){return '';}};

/* Is this ticket a Balance-Mode trade? Gold/BAL badge derive from the DURABLE mp_bal_tags map (id->sid), NOT the
   e.bal field on the journal entry — the server journal sync strips e.bal, so keying the render off it made the
   gold flicker on/off every re-render (the ticket list rebuilds innerHTML on every price tick). The tag map is
   never stripped, so this is stable across ALL renders. e.bal is still the fast path so a brand-new open is gold
   instantly. Cached 1.2s to avoid a localStorage parse per ticket per tick. Defined once (guard) — home.js loads
   before mp-trade.js/mp-auth.js. */
window.mpBalTkt = window.mpBalTkt || (function () { var c = null, t = 0; return function (e) { if (!e) return false; if (e.bal) return true; if (!e.id) return false; var n = Date.now(); if (!c || n - t > 1200) { try { c = JSON.parse(localStorage.getItem('mp_bal_tags') || '{}') || {}; } catch (x) { c = {}; } t = n; } return !!c[e.id]; }; })();

;/* extreme-leverage warning — non-blocking, throttled once/6h (mterm defaults to 1000×, so a blocking
   confirm on every open would kill the one-tap flow the terminal is built around). Fires on lev≥500;
   teaches that the position liquidates ~0.1% from entry (why skyfall/whyme lost big wins instantly). */
window.mpLevWarn=function(lev){try{lev=+lev;if(!(lev>=500))return;var now=Date.now(),last=+(localStorage.getItem('mp_lev_warned')||0);if(now-last<216e5)return;localStorage.setItem('mp_lev_warned',String(now));
  var move=(100/lev).toFixed(lev>=500?2:1),T=function(k,d){return (window.mpT&&window.mpT(k))||d;};
  var d=document.createElement('div');d.className='mp-levwarn';
  d.style.cssText='position:fixed;left:50%;bottom:86px;transform:translateX(-50%);z-index:400;max-width:340px;width:calc(100% - 32px);background:rgba(22,7,7,.97);border:1px solid #ff5a4d;border-radius:14px;padding:12px 14px;color:#ffd9d4;font:500 12.5px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 12px 44px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:3px';
  d.innerHTML='<b style="color:#ff6258;font-size:13px">⚠ '+T('levWarnT','Extreme leverage')+'</b><span>'+T('levWarnB1','At ')+lev+'× '+T('levWarnB2','a move of only ~')+move+'% '+T('levWarnB3','against you wipes the whole position. Trade small.')+'</span>';
  document.body.appendChild(d);
  setTimeout(function(){d.style.transition='opacity .4s,transform .4s';d.style.opacity='0';d.style.transform='translateX(-50%) translateY(8px)';setTimeout(function(){try{d.remove();}catch(e){}},450);},4600);
}catch(e){}};
;/* ══════════ inline block from app/index.html line 2435 ══════════ */
/* shared token list for the typeable symbol pickers (Paper Trade + Charts) — the screener tokens + common coins. Fills #symTokens too. */
  // Paper Trade + Charts are BYBIT-ONLY (owner decision): only tokens Bybit lists get a smooth live WS feed, so the
  // pickers list ONLY Bybit-tradeable symbols and window.mpIsBybit() gates the screener's paper-trade action + free-entry.
  window.mpMarketName=function(s){return ({XAU:'Gold',XAG:'Silver',SPX500:'S&P 500',NAS100:'Nasdaq 100',US30:'Dow Jones',GER40:'DAX 40',EURUSD:'EUR/USD',GBPUSD:'GBP/USD'})[String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'')]||'';};
  window.mpLoadTokens=function(cb){if(window.mpTokens){cb&&cb(window.mpTokens);return;}
    var base=['BTC','ETH','SOL','XRP','BNB','DOGE','ADA','AVAX','LINK','LTC','ENA','TRX','DOT','ATOM','NEAR','ARB','OP','PEPE','SHIB','SUI','APT','INJ','TIA','SEI','WIF','LDO','UNI','AAVE','FIL','RENDER'];
    fetch('/api/symbols').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){
      var byb={};                                             // Bybit set: raw (1000PEPE) + de-prefixed clean (PEPE)
      // Bybit uses a 1000x multiplier as a PREFIX (1000PEPE) on some and a SUFFIX (SHIB1000) on others — normalize BOTH to the clean ticker.
      function clean(s){return String(s||'').toUpperCase().replace(/^1(0{3,6})(?=[A-Z])/,'').replace(/([A-Z0-9])1(0{3,6})$/,'$1');}
      if(j&&j.symbols)j.symbols.forEach(function(s){s=String(s||'').toUpperCase();if(!s)return;byb[s]=1;byb[clean(s)]=1;});
      var hasSyms=!!(j&&j.symbols&&j.symbols.length);
      window.mpBybitSet=byb;
      var _byb0=function(sym){sym=String(sym||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!sym)return false;if(!hasSyms)return true;return !!(byb[sym]||byb['1000'+sym]||byb['10000'+sym]||byb['1000000'+sym]||byb[sym+'1000']||byb[sym+'10000']||byb[sym+'1000000']);};
      // non-crypto markets: metals (Bybit linear XAUUSDT/XAGUSDT) + indices/forex (Gate futures) — always tradeable regardless of the Bybit-only gate; price/klines resolve via the worker fallback chain (REST poll, no WS — fine for slower-moving assets)
      var MKT={XAU:1,XAG:1,SPX500:1,NAS100:1,US30:1,GER40:1,EURUSD:1,GBPUSD:1};
      window.mpIsBybit=function(sym){sym=String(sym||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return MKT[sym]?true:_byb0(sym);};
      // Per-coin max leverage — only the deepest-liquidity coins get 1000×; illiquid tokens, metals, indices & forex are capped (roughly what real exchanges allow). Default = 50×.
      // Per-trade taker fee, applied ONLY at close (live P&L stays clean → no -99% at open). Capped so the round-trip fee can never exceed ~20% of margin at any leverage: realistic 0.055% up to ~180×, tapering above so 1000× fees don't nuke the position.
      window.mpFeeRate=function(lev){return Math.min(0.00055,0.1/Math.max(1,+lev||1));};
      window.mpMaxLev=(function(){var M={BTC:1000,ETH:1000,SOL:1000,XRP:1000,BNB:1000,DOGE:1000,HYPE:1000,ADA:1000,AVAX:1000,LINK:1000,LTC:1000,DOT:200,TRX:1000,TON:1000,SUI:1000,BCH:200,NEAR:200,PEPE:1000,SHIB:200,WIF:200,ATOM:100,APT:100,ARB:100,OP:100,MATIC:100,POL:100,INJ:100,SEI:100,TIA:100,FIL:100,ETC:100,UNI:100,AAVE:100,RUNE:100,LDO:100,FTM:100,ALGO:100,HBAR:100,ICP:100,IMX:100,STX:100,RENDER:100,FET:100,ENA:100,ONDO:100,JUP:100,PYTH:100,STRK:100,ORDI:100,BONK:100,FLOKI:100,GALA:100,SAND:100,MANA:100,AXS:100,GRT:100,CRV:100,COMP:100,DYDX:100,WLD:100,KAS:100,TAO:100,XLM:100,VET:100,XAU:20,XAG:20,SPX500:20,NAS100:20,US30:20,GER40:20,EURUSD:50,GBPUSD:50};return function(sym){sym=String(sym||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/USDT$/,'');return M[sym]||50;};})();
      var seen={},out=[];function add(s){s=String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(s&&!seen[s]&&window.mpIsBybit(s)){seen[s]=1;out.push(s);}}
      Object.keys(MKT).forEach(add);                          // gold / silver / indices / forex group first
      base.forEach(add);                                      // then crypto majors (only those Bybit actually has)
      if(hasSyms)j.symbols.forEach(function(s){add(clean(s));}); // then the rest of Bybit, multiplier stripped to the clean ticker
      if(!out.length)base.forEach(function(s){if(!seen[s]){seen[s]=1;out.push(s);}}); // /api/symbols failed → don't leave pickers empty
      window.mpTokens=out;
      var dl=document.getElementById('symTokens');if(dl){dl.innerHTML=out.map(function(s){var nm=window.mpMarketName(s);return '<option value="'+s+'">'+(nm||'')+'</option>';}).join('');}
      cb&&cb(out);});};

;/* ══════════ inline block from app/index.html line 2762 ══════════ */
(function(){var grid=document.getElementById('mpGrid'),upd=document.getElementById('mpUpd');if(!grid)return;function bn(x){x=+x||0;var a=Math.abs(x);if(a>=1e9)return '$'+(x/1e9).toFixed(2)+'B';if(a>=1e6)return '$'+(x/1e6).toFixed(1)+'M';if(a>=1e3)return '$'+(x/1e3).toFixed(0)+'K';return '$'+x.toFixed(0);}function fgc(v){return v<=24?'#ff5a4d':v<=44?'#ff9f43':v<=55?'#cfd3d8':v<=75?'#2ebd85':'#19d98a';}function render(d){if(!d||d.error){grid.innerHTML='<div class="mp-load">Live market data unavailable right now.</div>';return;}var fg=d.fearGreed,liq=d.liq24h,top=d.topLiq||[],h='';if(fg){var deg=Math.round(fg.value*3.6);var pv=(fg.prev!=null)?('Yesterday '+fg.prev+(fg.value>=fg.prev?' ▲':' ▼')):'';h+='<div class="mp-card mp-fg"><div class="mp-k">Fear &amp; Greed Index</div><div class="mp-fg-row"><div class="mp-gauge" style="background:conic-gradient('+fgc(fg.value)+' '+deg+'deg,#1a1f27 '+deg+'deg)"><span>'+fg.value+'</span></div><div class="mp-fg-info"><div class="mp-fg-lbl" style="color:'+fgc(fg.value)+'">'+fg.label+'</div><div class="mp-fg-prev">'+pv+'</div></div></div><div class="mp-fg-scale"><i style="left:'+fg.value+'%"></i></div><div class="mp-fg-ticks"><span>Extreme fear</span><span>Extreme greed</span></div></div>';}if(liq){var lp=liq.total?liq.long/liq.total*100:50,sp=100-lp;h+='<div class="mp-card mp-liq"><div class="mp-k">Liquidations · 24h</div><div class="mp-liq-v">'+bn(liq.total)+'</div><div class="mp-ls"><i class="l" style="width:'+lp.toFixed(1)+'%"></i><i class="s" style="width:'+sp.toFixed(1)+'%"></i></div><div class="mp-ls-l"><span class="up">Longs '+bn(liq.long)+'</span><span class="dn">'+bn(liq.short)+' Shorts</span></div></div>';}if(top.length){h+='<div class="mp-card mp-top"><div class="mp-k">Most rekt · 24h</div>'+top.slice(0,4).map(function(c){var lp2=c.liq?c.long/c.liq*100:50;return '<div class="mp-top-r"><span class="mp-top-s">'+c.s+'</span><span class="mp-top-bar"><i class="l" style="width:'+lp2.toFixed(0)+'%"></i><i class="s" style="width:'+(100-lp2).toFixed(0)+'%"></i></span><span class="mp-top-v">'+bn(c.liq)+'</span></div>';}).join('')+'</div>';}grid.innerHTML=h;if(upd)upd.textContent='updated just now';}function load(){fetch('/api/cg/pulse',{cache:'no-store'}).then(function(r){return r.json();}).then(render).catch(function(){});}(window.requestIdleCallback||function(f){setTimeout(f,1400);})(load);setInterval(load,120000);})();

;/* ══════════ inline block from app/index.html line 2785 ══════════ */
(function(){var box=document.getElementById('derivBoard');if(!box)return;function bn(x){x=+x||0;var a=Math.abs(x);if(a>=1e9)return '$'+(x/1e9).toFixed(2)+'B';if(a>=1e6)return '$'+(x/1e6).toFixed(0)+'M';if(a>=1e3)return '$'+(x/1e3).toFixed(0)+'K';return '$'+x.toFixed(0);}function fpx(x){x=+x;return '$'+x.toLocaleString('en-US',{maximumFractionDigits:x>=100?2:x>=1?4:6});}function fn(f){if(f==null||!isFinite(f))return '—';return (f>=0?'+':'')+(+f).toFixed(4)+'%';}function render(d){if(!d||!d.coins||!d.coins.length){box.innerHTML='<div class="db-load">Live data unavailable right now.</div>';return;}box.innerHTML=d.coins.map(function(c){var up=(c.chg24h||0)>=0,lp=c.longPct!=null?c.longPct:50,sp=c.shortPct!=null?c.shortPct:50,fpos=(c.funding||0)>=0;return '<a class="db-card" href="/screener"><div class="db-top"><span class="db-sym">'+c.symbol+'</span><span class="db-chg '+(up?'up':'dn')+'">'+(up?'+':'')+(c.chg24h!=null?c.chg24h.toFixed(1):'0')+'%</span></div><div class="db-px">'+(c.price!=null?fpx(c.price):'—')+'</div><div class="db-ls" title="Long '+lp+'% / Short '+sp+'%"><i class="l" style="width:'+lp+'%"></i><i class="s" style="width:'+sp+'%"></i></div><div class="db-meta"><span class="'+(fpos?'up':'dn')+'">Fund '+fn(c.funding)+'</span><span>OI '+bn(c.oiUsd)+'</span></div></a>';}).join('');}function load(){fetch('/api/cg/board',{cache:'no-store'}).then(function(r){return r.json();}).then(render).catch(function(){});}(window.requestIdleCallback||function(f){setTimeout(f,1600);})(load);setInterval(load,120000);})();

;/* ══════════ inline block from app/index.html line 2955 ══════════ */
/* Paper Trade: open a position at the live price, track it live in the Journal */
(function(){
  var side='long', live=NaN, liveChg=0, pollT=null;
  var seg=document.getElementById('planSeg');
  function num(id){var e=document.getElementById(id);var v=e?parseFloat(e.value):NaN;return isFinite(v)?v:NaN;}
  function money(x){if(!isFinite(x))return '—';var neg=x<0;x=Math.abs(x);var s=x>=1e12?(x/1e12).toFixed(2)+'T':x>=1e9?(x/1e9).toFixed(2)+'B':x>=1e6?(x/1e6).toFixed(2)+'M':x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});return (neg?'-$':'$')+s;}
  function fmtPx(x){return '$'+(+x).toLocaleString('en-US',{maximumFractionDigits:x>=100?2:x>=1?4:8});}
  function set(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
  function setBtn(){var t=document.getElementById('planOpenTxt'),b=document.getElementById('planSave');if(t)t.textContent=(window.mpT&&window.mpT('mtOpen'))||'Open demo trade';if(b)b.classList.toggle('short',side==='short');}
  function showLive(){var el=document.getElementById('planLivePx');if(el){if(isFinite(live)&&window.mpSmoothPx){window.mpSmoothPx(el,live,fmtPx);}else{el.textContent=isFinite(live)?fmtPx(live):'…';}el.classList.toggle('up',isFinite(live)&&liveChg>=0);el.classList.toggle('down',isFinite(live)&&liveChg<0);}var c=document.getElementById('planLiveChg');if(c){c.textContent=isFinite(live)?((liveChg>=0?'↑ +':'↓ ')+liveChg.toFixed(2)+'%'):'';c.style.color=liveChg>=0?'var(--up)':'var(--red)';}window.mpPlanLive={sym:((document.getElementById('planSym')||{}).value||''),price:live,chg:liveChg,t:(isFinite(live)?Date.now():0)};}
  function calc(){
    var amt=num('planAmt'),lev=num('planLev'),ids=['planSize','planLiq','planNotional'];
    if(!isFinite(live)||live<=0||!isFinite(amt)||amt<=0||!isFinite(lev)||lev<=0){ids.forEach(function(i){set(i,'—');});setBtn();return;}
    var _mmr=(window.mpPlanMmr||0.005),long=side==='long',notional=amt*lev,qty=notional/live,liq=long?live*(1-(1-_mmr)/lev):live*(1+(1-_mmr)/lev);
    var sym=((document.getElementById('planSym')||{}).value||'');
    set('planSize', qty.toLocaleString('en-US',{maximumFractionDigits:6})+(sym?' '+sym:''));
    set('planLiq', money(liq)); set('planNotional', money(notional)); setBtn();
  }
  // REST /api/price (Binance, edge-cached 5s) is a FALLBACK only. The Bybit WS is the real-time truth; never let
  // the slower cached REST value clobber a fresh WS tick — that 0–5s staleness was the ±$1k forming-candle flicker.
  function poll(){if(document.hidden||document.body.getAttribute('data-prod')!=='plan')return;if(_wsT&&Date.now()-_wsT<6000)return;var sym=((document.getElementById('planSym')||{}).value||'');if(!sym)return;fetch('/api/price?symbol='+encodeURIComponent(sym)+window.__mpPQ('frm',sym),{cache:'no-store'}).then(function(r){return r.json();}).then(function(pd){if(pd&&pd.price>0&&(!_wsT||Date.now()-_wsT>=6000)){live=+pd.price;liveChg=+pd.chg||0;showLive();calc();}}).catch(function(){});}
  if(seg)seg.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){seg.querySelectorAll('button').forEach(function(x){x.classList.remove('on');});b.classList.add('on');side=b.getAttribute('data-side');calc();});});
  ['planAmt','planLev'].forEach(function(id){var e=document.getElementById(id);if(e)e.addEventListener('input',calc);});
  var levEl=document.getElementById('planLev'),levR=document.getElementById('planLevR');
  function posToLev(p){return Math.max(1,Math.min(1000,Math.round(Math.pow(1000,p/1000))));}  // logarithmic 1×…1000×
  function levToPos(l){l=Math.max(1,Math.min(1000,l));return Math.round(Math.log(l)/Math.log(1000)*1000);}
  function levFill(){if(levR)levR.style.setProperty('--fill',(levR.value/(levR.max||1000)*100).toFixed(1)+'%');}
  function syncLevR(){if(!levR||!levEl)return;var v=parseFloat(levEl.value);if(isFinite(v)&&v>0){levR.value=String(levToPos(v));levFill();}}
  function levRisk(){var l=document.getElementById('planLev'),f=l&&l.closest('.pt2-fields');if(f)f.classList.toggle('risky',num('planLev')>50);}
  var _levHT=0;
  function planCap(){var s=(document.getElementById('planSym')||{}).value||'';return (window.mpMaxLev?window.mpMaxLev(s):1000);}
  function applyLevCap(loud){var cap=planCap();if(!levEl)return;if(parseFloat(levEl.value)>cap){levEl.value=String(cap);syncLevR();levRisk();try{calc();}catch(_){}var _n=Date.now();if(loud&&_n-_levHT>3000){_levHT=_n;if(window.mpLimitToast)window.mpLimitToast('Max leverage for '+((document.getElementById('planSym')||{}).value||'this coin')+' is '+cap+'×.');}}var h=document.getElementById('planLevMax');if(h)h.textContent='max '+cap+'×';}
  window.mpApplyLevCap=applyLevCap;
  if(levEl)levEl.addEventListener('input',function(){var cap=planCap();if(parseFloat(levEl.value)>cap){levEl.value=String(cap);var _n=Date.now();if(_n-_levHT>3000){_levHT=_n;if(window.mpLimitToast)window.mpLimitToast('Max leverage for '+((document.getElementById('planSym')||{}).value||'this coin')+' is '+cap+'×.');}}syncLevR();levRisk();});
  var _levRaf=false;
  if(levR)levR.addEventListener('input',function(){if(!levEl)return;levEl.value=String(Math.min(planCap(),posToLev(parseFloat(levR.value))));levFill();levRisk();if(_levRaf)return;_levRaf=true;requestAnimationFrame(function(){_levRaf=false;calc();});});
  var _pSymCap=document.getElementById('planSym');if(_pSymCap)_pSymCap.addEventListener('change',function(){applyLevCap(true);});
  syncLevR();levRisk();setTimeout(function(){applyLevCap(false);},200);
  (function(){var row=document.querySelector('.pt2-px');if(!row||document.getElementById('mpBalNote'))return;var note=document.createElement('div');note.id='mpBalNote';note.className='mp-balnote';note.hidden=true;note.innerHTML='<span class="mbn-dot"></span>Balance Mode ON';row.parentNode.appendChild(note);function upd(){var on=false;try{var c=JSON.parse(localStorage.getItem('mp_balmode')||'null');on=!!(c&&c.on);}catch(e){}note.hidden=!on;}upd();window.addEventListener('mp-balmode',upd);window.addEventListener('storage',function(e){if(e.key==='mp_balmode')upd();});setTimeout(upd,800);})(); // "Balance Mode ON" tag in the LIVE-price row — reads localStorage directly so it doesn't depend on mp-auth (defer) being loaded yet
  var advChk=document.getElementById('planAdvChk');
  if(advChk)advChk.addEventListener('change',function(){var ai=document.getElementById('planAdvIn');if(ai)ai.hidden=!advChk.checked;
    if(advChk.checked){window._mpSltpHidden=false;try{ensureDrag();}catch(e){}var sl=document.getElementById('planSlOpt'),tp=document.getElementById('planTpOpt'),entry=(window.mpPlanLive&&+window.mpPlanLive.price)||0,seg=document.getElementById('planSeg'),onb=seg&&seg.querySelector('button.on'),lng=!(onb&&onb.getAttribute('data-side')==='short'),dp=(entry>=1?2:6);
      if(entry>0&&sl&&!(parseFloat(sl.value)>0))sl.value=String(+(entry*(lng?0.98:1.02)).toFixed(dp));
      if(entry>0&&tp&&!(parseFloat(tp.value)>0))tp.value=String(+(entry*(lng?1.03:0.97)).toFixed(dp));
      try{calc();}catch(e){}}
    try{posDragLines();}catch(e){}try{updatePlanRisk();}catch(e){}});
  // live "what you risk" readout — shows the $ lost if the stop hits and gained if TP hits, from amount × leverage × distance
  function updatePlanRisk(){var rs=document.getElementById('planRiskSl'),rt=document.getElementById('planRiskTp');if(!rs&&!rt)return;
    function setBox(b,h){if(!b)return;b.innerHTML=h||'';b.hidden=!h;}
    var adv=document.getElementById('planAdvChk');
    var sl=parseFloat((document.getElementById('planSlOpt')||{}).value),tp=parseFloat((document.getElementById('planTpOpt')||{}).value);
    var margin=parseFloat((document.getElementById('planAmt')||{}).value)||0,lev=parseFloat((document.getElementById('planLev')||{}).value)||1;
    var entry=(window.mpPlanLive&&+window.mpPlanLive.price)||0;
    if(!(adv&&adv.checked)||!margin||!entry){setBox(rs,'');setBox(rt,'');return;}
    var seg=document.getElementById('planSeg'),onb=seg&&seg.querySelector('button.on'),lng=!(onb&&onb.getAttribute('data-side')==='short');
    // SL readout — directly under the stop-loss field
    var hs='';
    if(sl>0){var wrong=lng?(sl>=entry):(sl<=entry);
      if(wrong){hs='<div class="pr-warn">⚠ Stop-loss is on the wrong side of entry</div>';}
      else{var lossFrac=Math.min(1,lev*Math.abs(entry-sl)/entry);hs='<div class="pr-sl"><span>If stop-loss hits</span><span class="v"><b>−$'+(margin*lossFrac).toFixed(2)+'</b> ('+Math.round(lossFrac*100)+'%)</span></div>';}}
    setBox(rs,hs);
    // TP readout — directly under the take-profit field
    var ht='';
    if(tp>0){var wt=lng?(tp<=entry):(tp>=entry);if(!wt){var gainFrac=lev*Math.abs(tp-entry)/entry;ht='<div class="pr-tp"><span>If take-profit hits</span><span class="v"><b>+$'+(margin*gainFrac).toFixed(2)+'</b> (+'+Math.round(gainFrac*100)+'%)</span></div>';}}
    setBox(rt,ht);}
  window.mpPlanRisk=updatePlanRisk;
  // Exchange margin preset (paper trade) — sets the maintenance-margin rate used for the liq estimate + opened position
  window.mpPlanMmr=0.005;
  (function(){var px=document.getElementById('planEx');if(!px)return;px.addEventListener('change',function(){var v=parseFloat(px.value);window.mpPlanMmr=(isFinite(v)&&v>0)?v/100:0.005;try{calc();}catch(_){}try{updatePlanRisk();}catch(_){}});})();
  ['planSlOpt','planTpOpt','planLev','planAmt'].forEach(function(id){var e=document.getElementById(id);if(e)e.addEventListener('input',function(){window._mpSltpHidden=false;try{posDragLines();}catch(_){}try{updatePlanRisk();}catch(_){}});});
  var _prT=0;try{window.addEventListener('mp:price',function(){var n=Date.now();if(n-_prT<600)return;_prT=n;try{updatePlanRisk();}catch(_){}});}catch(_){}
  var pSym=document.getElementById('planSym');
  if(pSym)pSym.addEventListener('change',function(){live=NaN;_wsT=0;showLive();calc();poll();});
  // real-time price from the WebSocket feed (sub-100ms); REST poll stays as a slower fallback
  var _rafF=false,_wsT=0;
  document.addEventListener('mp:price',function(ev){var sym=((document.getElementById('planSym')||{}).value||'');if(!ev.detail||ev.detail.sym!==sym)return;live=+ev.detail.price;_wsT=Date.now();if(ev.detail.chg!=null&&isFinite(ev.detail.chg))liveChg=+ev.detail.chg;if(_rafF)return;_rafF=true;requestAnimationFrame(function(){_rafF=false;showLive();calc();});});
  poll(); pollT=setInterval(poll,3000); calc();
})();
/* Paper Trade terminal: live candlestick chart + open/closed positions list */
(function(){
  var KEY='mp_journal';
  function load(){try{return JSON.parse(localStorage.getItem(KEY))||[];}catch(e){return [];}}
  function store(a){try{localStorage.setItem(KEY,JSON.stringify(a));}catch(e){}}
  function esc(s){return String(s).replace(/[<>&]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}
  function money(x){x=+x||0;var n=x<0;x=Math.abs(x);var s=x>=1e12?(x/1e12).toFixed(2)+'T':x>=1e9?(x/1e9).toFixed(2)+'B':x>=1e6?(x/1e6).toFixed(2)+'M':x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});return (n?'-$':'$')+s;}
  function fp(x){x=+x||0;return '$'+x.toLocaleString('en-US',{maximumFractionDigits:x>=100?2:x>=1?4:8});}
  function pctS(x){return (x>=0?'+':'')+x.toFixed(2)+'%';}
  function dur(ms){var s=Math.floor(ms/1000);if(s<60)return s+'s';var m=Math.floor(s/60);if(m<60)return m+'m '+(s%60)+'s';var h=Math.floor(m/60);if(h<24)return h+'h '+(m%60)+'m';return Math.floor(h/24)+'d '+(h%24)+'h';}
  function hm(ts){var d=new Date(ts);function z(n){return (n<10?'0':'')+n;}return z(d.getHours())+':'+z(d.getMinutes());}
  var prices={},posTab='open',notified={},chart=null,candle=null,lastBar=null,chartSym='',chartTf='5',plines=[],inited=false,_plc='',_openLines=[],_openMarks=[],klCache={},_linesSig=null;
  var _lgp=0,_rej=0; // spike filter: last accepted price + consecutive-reject count, so one bad print can't ratchet a fake high/low wick
  var _clArm={}; // per-trade LIQUIDATION arming: liq needs 2 consecutive ticks (a sub-2.5% phantom can still cross the ~0.1% liq at 1000×). TP/SL fire on first touch of the spike-validated price below.
  var _vpx={}; // spike-validated close-check price per symbol: a lone >2.5% jump is held for one tick, so a bad print can't trigger a TP/SL/liq. Idempotent per underlying tick (keyed by prices[sym].t) so N positions on one symbol don't double-count.
  function ccPx(sym, raw){ if(!(raw>0))return raw; var v=_vpx[sym], t=(prices[sym]&&prices[sym].t)||0;
    if(!v){_vpx[sym]={p:raw,t:t,rej:0};return raw;}
    if(v.t===t)return v.p;                                    // same underlying price already validated this cycle
    v.t=t;
    if(v.p>0&&Math.abs(raw-v.p)/v.p>0.025){v.rej=(v.rej||0)+1;if(v.rej<2)return v.p;} // hold last-good until a 2nd tick confirms the jump
    v.p=raw;v.rej=0;return raw; }
  window.mpLivePrices=prices; // shared with the My Trades drawer so it shows live P&L without double-polling
  function openSyms(){var s={};load().forEach(function(e){if(e.status==='open'&&e.sym&&e.sym!=='—')s[e.sym]=1;});if(chartSym&&!(document.hidden||document.body.getAttribute('data-prod')!=='plan'))s[chartSym]=1;return Object.keys(s);} // OPEN positions always polled (liq safety); the chart-only symbol is dropped when the Paper Trade chart isn't visible so an idle /calculators or /screener or hidden tab with no positions stops the 3s /api/price poll entirely
  // REST is only a FALLBACK: prices[] is shared with the live WS feed (window.mpLivePrices). Never clobber a
  // fresh WS tick with the slower/edge-cached /api/price value — that mismatch was the ±$1k position flicker.
  function pollPrices(){openSyms().forEach(function(sym){try{if(window.mpWS)window.mpWS.sub(sym);}catch(e){} /* stream every open-position & chart symbol live, not just the base 8 */ var cur=prices[sym];if(cur&&cur.t&&(Date.now()-cur.t)<4000)return;fetch('/api/price?symbol='+encodeURIComponent(sym)+window.__mpPQ('pos',sym),{cache:'no-store'}).then(function(r){return r.json();}).then(function(pd){if(pd&&pd.price>0){prices[sym]={p:+pd.price,t:Date.now(),chg:(pd.chg!=null?+pd.chg:(cur&&cur.chg))};if(window.mpJournalRender)window.mpJournalRender();}}).catch(function(){});});}
  function metrics(e){var live=(prices[e.sym]&&prices[e.sym].p)||(e.status!=='open'&&e.exit)||e.entry;var long=e.side!=='short',lev=(+e.lev>0)?+e.lev:1;var move=(live-e.entry)/e.entry*(long?1:-1);var gross=(e.qty!=null&&isFinite(e.qty))?e.qty*(live-e.entry)*(long?1:-1):null;var pnl=(gross!=null)?gross-(+e.fund||0):null;/* P1: taker fee (feeRate/side) settled into P&L — legacy trades carry feeRate 0 so nothing changes for them */var margin=(+e.margin>0)?+e.margin:(e.notional&&lev?e.notional/lev:null);var roe=(pnl!=null&&margin>0)?pnl/margin:move*lev;var liq=e.liq||(long?e.entry*(1-(1-(e.mmr||0.005))/lev):e.entry*(1+(1-(e.mmr||0.005))/lev));var liqDist=(live-liq)/live*100*(long?1:-1);var notional=(e.qty!=null&&isFinite(e.qty))?Math.abs(e.qty)*live:(e.notional||null);if(margin>0){var _op=e.status!=='win'&&e.status!=='loss';var _pf=_op?-margin*0.99:-margin;if(pnl!=null&&pnl<_pf)pnl=_pf;var _rf=_op?-0.99:-1;if(roe<_rf)roe=_rf;}/* open positions cap at -99% (never show -100% until actually liquidated/closed) */return {live:live,long:long,lev:lev,move:move,roe:roe,pnl:pnl,liq:liq,liqDist:liqDist,notional:notional,margin:margin};}
  function checkClose(e,m){if(e.status!=='open')return false;var dir=m.long?1:-1;
    // ROOT-CAUSE GUARD (proven from [LIQ-DECISION] logs): only decide an exit when there is a REAL market price for the
    // symbol. When prices[sym] is unset/seed, metrics() falls back to EACH trade's OWN entry — so two open trades on the
    // same coin feed DIFFERENT "live" values into the per-symbol spike filter ccPx()/_vpx[sym]; ccPx sees the newer entry
    // as a >2.5% "spike" off the older one and RETURNS THE OLDER ENTRY → the newer 100× trade is measured against the old
    // 1000× entry (e.g. 0.0465 vs 0.0237) → −49% → phantom liquidation. Display P&L can use the entry fallback; liquidation must NOT.
    var _spx=prices[e.sym]; if(!_spx||!(+_spx.p>0)||_spx.seed)return false;
    var px=ccPx(e.sym,m.live);                                 // spike-validated: a lone >2.5% bad print can't fire an exit
    if(window.__mpDebug){try{var _tb=window.__mpTicks||(window.__mpTicks={});var _ta=_tb[e.sym]||(_tb[e.sym]=[]);_ta.push({t:Date.now(),rawLive:+m.live,px:+px,priceMap:(prices[e.sym]?+prices[e.sym].p:null),seed:(prices[e.sym]&&prices[e.sym].seed)||false});if(_ta.length>25)_ta.shift();}catch(_){}} // DIAG (opt-in): per-symbol tick trail — was allocating for every open position every tick
    var clamp=function(p){return (+e.margin>0&&p!=null&&p<-(+e.margin))?-(+e.margin):p;}; // a paper loss can never exceed the isolated margin (an SL set BEYOND liq used to book more than −margin)
    var pnlAt=function(exit){return (e.qty!=null&&isFinite(e.qty))?e.qty*(exit-e.entry)*dir-((+e.qty||0)*(e.entry+exit)*(+e.feeRate||0))-(+e.fund||0):null;};
    var tp=e.tp!=null&&(m.long?px>=e.tp:px<=e.tp);
    var sl=e.stop!=null&&(m.long?px<=e.stop:px>=e.stop);
    var liqHit=m.liq>0&&(m.long?px<=m.liq:px>=m.liq);
    if(!(tp||sl||liqHit)){_clArm[e.id]=0;return false;}        // no exit condition → disarm the liq counter
    try{ // DIAG: log EVERY exit decision with full context so we can prove the root cause from the browser console
      var _reason=tp?'TP':sl?'SL':'LIQ';
      var _rec={ts:new Date().toISOString(),id:e.id,sym:e.sym,side:e.side,reason:_reason,lev:+e.lev,entry:+e.entry,liqPrice:+m.liq,rawLive:+m.live,validatedPx:+px,priceMap:(prices[e.sym]?+prices[e.sym].p:null),priceMapSeed:(prices[e.sym]&&prices[e.sym].seed)||false,priceMapAgeMs:(prices[e.sym]&&prices[e.sym].t)?(Date.now()-prices[e.sym].t):null,qty:+e.qty,margin:+e.margin,notional:+e.notional,unrealPnl:(m.pnl!=null?+m.pnl.toFixed(4):null),liqHit:!!liqHit,slHit:!!sl,tpHit:!!tp,pctFromEntry:+(((px-e.entry)/e.entry)*100).toFixed(3),last20:((window.__mpTicks&&window.__mpTicks[e.sym])||[]).slice(-20)};
      var _lg=window.__mpLiqLog||(window.__mpLiqLog=[]);_lg.unshift(_rec);if(_lg.length>40)_lg.length=40;
      if(_reason==='LIQ'&&window.console)console.warn('[LIQ-DECISION]',JSON.stringify(_rec));
    }catch(_){}
    // TP/SL are touch orders → fill at the EXACT level on the FIRST touch of the validated price (the spike filter above
    // is the phantom protection; a real move fills immediately with no delay). Liquidation additionally needs 2 consecutive
    // ticks because a small (<2.5%) phantom can still cross the ~0.1% liq distance at 1000× and slip past the spike filter.
    if(tp){e.status='win';e.exit=e.tp;e.pnl=clamp(pnlAt(e.tp));_clArm[e.id]=0;}
    else if(sl){var _p=pnlAt(e.stop);e.status=(_p!=null&&_p>0)?'win':'loss';e.exit=e.stop;e.pnl=clamp(_p);_clArm[e.id]=0;} // a trailing/break-even stop can lock PROFIT → count it as a win
    else{
      // Liquidation fills on the FIRST validated touch of liq. EXCEPTION: only at EXTREME leverage (liq <0.3% from entry,
      // ~>300×) require 2 ticks so a sub-2.5% phantom print can't cross the razor-thin liq.
      if(e.entry>0&&Math.abs(m.liq-e.entry)/e.entry<0.003){_clArm[e.id]=(_clArm[e.id]||0)+1;if(_clArm[e.id]<2)return false;}
      _clArm[e.id]=0;
      e.status='loss';e.exit=m.liq;e.liquidated=true;e.pnl=(+e.margin>0)?-(+e.margin):pnlAt(m.liq);} // liquidated = lose the full margin
    e.closeTs=Date.now();notify(e,tp?'tp':(e.liquidated?'liq':'sl'));if(e.src==='srv')queueNudge(e.id);return true;}
  var _nudgeIds={},_nudgeT=null;
  // A srv (server-filled, signed-in) position that auto-closes LOCALLY must tell the server so it settles the SAME
  // position at its OWN level (candle-check) and stamps sc — otherwise the client's local close syncs WITHOUT sc and the
  // trade never counts on the paid board. Debounced: one nudge per close-burst; the server rate-limits (1/3s) + verifies
  // from its own candles (no client price/reason trusted). keepalive so a tab close still delivers it. Fire-and-forget:
  // the server is authoritative and pullTrades reconciles the sc'd close (local-closed display is kept until then).
  function queueNudge(id){if(!id)return;_nudgeIds[String(id)]=1;if(_nudgeT)return;_nudgeT=setTimeout(function(){var ids=Object.keys(_nudgeIds);_nudgeIds={};_nudgeT=null;if(!ids.length)return;try{fetch('/api/trade/nudge',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',keepalive:true,body:JSON.stringify({ids:ids})}).catch(function(){});}catch(e){}},500);}
  function buzz(p){try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}}
  window.mpBuzz=buzz;
  function notify(e,kind){if(notified[e.id])return;notified[e.id]=true;
    var t=kind==='tp'?'Take-Profit hit':(kind==='liq'?'LIQUIDATED':'Stop-Loss hit');
    var sym=(e.sym||'Trade'),side=String(e.side||'').toUpperCase();
    buzz(kind==='liq'?[50,45,50,45,95]:(kind==='tp'?[18,55,18]:[35]));   // distinct haptic per outcome (liq = strongest)
    var pnl=(e.pnl!=null&&isFinite(e.pnl))?((e.pnl>=0?'+$':'−$')+Math.abs(e.pnl).toFixed(2)):'';
    try{if('Notification'in window&&Notification.permission==='granted')new Notification(sym+' '+side+' — '+t,{body:'Closed at '+fp(e.exit)+(pnl?' · PnL '+pnl:''),tag:'mp-'+e.id});}catch(_){}
    try{window.__mpTrack&&window.__mpTrack('close',sym+(kind==='liq'?' — liquidated':kind==='tp'?' — take-profit':' — stop-loss')+(pnl?' '+pnl:''));}catch(_){}}
  function openCard(e){var m=metrics(e),long=m.long,cls=(m.pnl!=null?(m.pnl>0?'pf':(m.pnl<0?'ls':'be')):(m.move>0?'pf':(m.move<0?'ls':'be')));
    return '<div class="pp '+cls+(window.mpBalTkt(e)?' pp-gold':'')+'" data-id="'+e.id+'"><div class="pp-h"><span class="pp-sym">'+esc(e.sym||'—')+'</span><span class="pp-dir '+(long?'long':'short')+'">'+(long?'LONG':'SHORT')+'</span>'+(window.mpBalTkt(e)?'<span class="pp-bal">BAL</span>':'')+'<span class="pp-live">'+fp(m.live)+'</span></div>'
      +'<div class="pp-pnl"><span class="big">'+(m.pnl!=null?((m.pnl>=0?'+':'−')+money(Math.abs(m.pnl)).replace('-','')):pctS(m.move*100))+'</span><span class="roe">ROE '+pctS(m.roe*100)+'</span></div>'
      +'<div class="pp-meta">Entry <b>'+fp(e.entry)+'</b> · Size <b>'+(e.qty!=null?(+e.qty).toLocaleString('en-US',{maximumFractionDigits:5}):'—')+'</b> · '+(e.lev||1)+'×<br>Notional <b>'+(m.notional!=null?money(m.notional):'—')+'</b> · Liq <b>'+fp(m.liq)+'</b> ('+pctS(m.liqDist)+')<br>SL <b>'+(window.mpLvlTxt?window.mpLvlTxt(e,false,fp):(e.stop!=null?fp(e.stop):'—'))+'</b> · TP <b>'+(window.mpLvlTxt?window.mpLvlTxt(e,true,fp):(e.tp!=null?fp(e.tp):'—'))+'</b> · '+dur(Date.now()-e.ts)+' · '+hm(e.ts)+'</div>'
      +'<div class="pp-btns"><button class="cl" data-act="close" data-id="'+e.id+'">Close</button><button data-act="edit" data-id="'+e.id+'">Modify</button><button data-act="del" data-id="'+e.id+'">✕</button></div></div>';}
  function closedCard(e){var win=e.status==='win',cls=win?'pf':'ls';
    return '<div class="pp '+cls+(window.mpBalTkt(e)?' pp-gold':'')+'" data-id="'+e.id+'"><div class="pp-h"><span class="pp-sym">'+esc(e.sym||'—')+'</span><span class="pp-dir '+(e.side!=='short'?'long':'short')+'">'+(e.side!=='short'?'LONG':'SHORT')+'</span>'+(window.mpBalTkt(e)?'<span class="pp-bal">BAL</span>':'')+'<span class="pp-live pp-res '+(e.liquidated?'liq':(win?'win':'loss'))+'">'+(e.liquidated?'Liquidated':(win?'Win':'Loss'))+'</span></div>'
      +'<div class="pp-pnl"><span class="big">'+(e.pnl!=null?((+e.pnl>=0?'+':'−')+money(Math.abs(e.pnl)).replace('-','')):(win?'TP hit':'SL hit'))+'</span></div>'
      +'<div class="pp-meta">'+fp(e.entry)+' → '+fp(e.exit!=null?e.exit:(win?e.tp:e.stop))+((+e.margin>0)?' · Size <b>'+money(+e.margin)+'</b>':'')+(e.partial?' · <b>'+e.partial+'%</b>':'')+(e.closeTs?' · '+dur(e.closeTs-e.ts):'')+'</div>'
      +'<div class="pp-btns"><button data-act="reopen" data-id="'+e.id+'">Reopen</button><button data-act="del" data-id="'+e.id+'">✕</button></div></div>';}
  document.addEventListener('mp:sltp',function(ev){try{if(ev.detail)notified[ev.detail.id]=false;}catch(_){}}); // edited SL/TP -> allow a fresh close notification
  var _lastSig='';
  function _tkCls(m){return (m.pnl!=null?(m.pnl>0?'pf':(m.pnl<0?'ls':'be')):(m.move>0?'pf':(m.move<0?'ls':'be')));}
  function _tkPnl(m){return (m.pnl!=null?((m.pnl>=0?'+':'−')+money(Math.abs(m.pnl)).replace('-','')):pctS(m.move*100));}
  function _tkMeta(e,m){return 'Entry <b>'+fp(e.entry)+'</b> · Liq <b>'+fp(m.liq)+'</b> ('+pctS(m.liqDist)+') · Margin <b>'+money((+e.margin||+e.riskAmt||0))+'</b>';}
  function renderLast(){var el=document.getElementById('ptLastTrade');if(!el)return;var open=load().filter(function(e){return e.status==='open';});
    if(!open.length){el.hidden=true;el.className='pt-tickets';el.innerHTML='';_lastSig='';return;}
    el.className='pt-tickets';el.hidden=false;
    var list=open.slice(-5).reverse(); // up to 5 most recent open positions, newest first
    var _prevIds=_lastSig?_lastSig.split(','):[];
    _lastSig=list.map(function(e){return e.id;}).join(',');
    el.innerHTML=list.map(function(e,idx){var m=metrics(e),long=m.long;
      return '<div class="pt-last '+_tkCls(m)+(window.mpBalTkt(e)?' pt-gold':'')+'" data-tid="'+e.id+'">'
        +'<div class="ptl-top"><span class="ptl-sym">'+esc(e.sym||'—')+'</span><span class="ptl-dir '+(long?'long':'short')+'">'+(long?'LONG':'SHORT')+'</span><span class="ptl-lev">'+(e.lev||1)+'×</span><span class="ptl-live">● <b class="ptl-px">'+fp(m.live)+'</b></span></div>'
        +'<div class="ptl-pnl"><span class="big">'+_tkPnl(m)+'</span><span class="roe">ROE '+pctS(m.roe*100)+'</span><button type="button" class="ptl-close" data-ptl-close="'+e.id+'">Close</button></div>'
        +'<div class="ptl-cut"></div>'
        +'<div class="ptl-meta">'+_tkMeta(e,m)+'</div>'
        +'</div>';
    }).join('');
    // only the NEW ticket animates in — re-running panelIn on every existing card was the "shake" on spawn
    Array.prototype.forEach.call(el.querySelectorAll('.pt-last'),function(c){if(_prevIds.indexOf(c.getAttribute('data-tid'))>=0)c.style.animation='none';});}
  // live refresh that NEVER rebuilds the DOM unless the open-set changes — replacing innerHTML every tick re-ran the
  // panelIn animation + reflowed the cards = the "shaking/flicker" on mobile. In-place text updates don't shake.
  function renderLastLive(){var el=document.getElementById('ptLastTrade');if(!el)return;if(el.querySelector('button:hover'))return; // leave the DOM alone while Close is hovered → no lost tap
    var open=load().filter(function(e){return e.status==='open';});
    if(!open.length){if(_lastSig!=='')renderLast();return;}
    var list=open.slice(-5).reverse(),sig=list.map(function(e){return e.id;}).join(',');
    if(sig!==_lastSig){renderLast();return;} // a trade opened/closed → structural rebuild (re-animates once, intentionally)
    list.forEach(function(e){var row=el.querySelector('.pt-last[data-tid="'+e.id+'"]');if(!row)return;var m=metrics(e);
      var pnlc=_tkCls(m);if(!row.classList.contains(pnlc)){row.classList.remove('pf','ls','be');row.classList.add(pnlc);} // swap ONLY the pnl state class — the old wholesale row.className='pt-last '+pnlc dropped pt-gold every tick (Balance Mode gold on the small ticket)
      var px=row.querySelector('.ptl-px');if(px){var pv=fp(m.live);if(px.textContent!==pv)px.textContent=pv;}
      var big=row.querySelector('.big');if(big){var bv=_tkPnl(m);if(big.textContent!==bv)big.textContent=bv;}
      var roe=row.querySelector('.roe');if(roe){var rv='ROE '+pctS(m.roe*100);if(roe.textContent!==rv)roe.textContent=rv;}
      var meta=row.querySelector('.ptl-meta');if(meta){var mv=_tkMeta(e,m);if(meta.innerHTML!==mv)meta.innerHTML=mv;}
    });}
  document.addEventListener('click',function(ev){var b=ev.target.closest&&ev.target.closest('[data-ptl-close]');if(!b)return;
    var id=b.getAttribute('data-ptl-close'),d=load(),i=-1;for(var k=0;k<d.length;k++){if(d[k].id===id){i=k;break;}}if(i<0)return;
    var e=d[i];
    if(window.mpCloseSheet){window.mpCloseSheet(id,function(){renderLast();renderPos();drawLines();mtCount();});return;} /* partial-close sheet (owner task) — the sheet stores + rerenders */
    var m=metrics(e);e.status=(m.pnl!=null?(m.pnl>=0?'win':'loss'):(m.move>=0?'win':'loss'));e.exit=m.live;e.closeTs=Date.now();e.pnl=(m.pnl!=null?m.pnl:0);buzz([22]); // haptic on manual close
    window._mpSltpHidden=true;store(d);renderLast();renderPos();drawLines();mtCount();if(window.mpJournalRender)window.mpJournalRender();});
  var _posSig='';
  // DEAD CODE (2026-07-26): #ptPosList + #ptPosTabs are in NO markup (app/index.html, dist/app.html) — this render + openCard(the terminal copy)/closedCard here NO-OP (getElementById returns null). The LIVE small tickets are #ptLastTrade (renderLast, .pt-last). Kept only so the renderPos() calls in the close handlers stay harmless no-ops; delete in the cleanup round. (Caused a mis-diagnosis of the Balance-Mode gold bug — the real render was renderLast.)
  function renderPos(d0){var el=document.getElementById('ptPosList');if(!el)return;var d=d0||load();
    // same pattern as renderLastLive: rebuild the DOM only when the SET of cards changes (open/close/tab switch);
    // otherwise update the live numbers IN PLACE. The old unconditional innerHTML rebuild every second killed hover
    // states, restarted CSS transitions and dropped taps that landed mid-rebuild.
    if(posTab==='open'){var o=d.filter(function(e){return e.status==='open';});
      var sig='o|'+o.map(function(e){return e.id;}).join(',');
      if(sig!==_posSig||!o.length){_posSig=sig;el.innerHTML=o.length?o.slice().reverse().map(openCard).join(''):'<div class="pp-empty">No open positions — open one above ↑</div>';return;}
      if(el.querySelector('button:hover'))return; // leave the DOM alone while a button is hovered → no lost tap
      o.forEach(function(e){var card=el.querySelector('.pp[data-id="'+e.id+'"]');if(!card)return;var m=metrics(e);
        var pnlc=(m.pnl!=null?(m.pnl>0?'pf':(m.pnl<0?'ls':'be')):(m.move>0?'pf':(m.move<0?'ls':'be')));if(!card.classList.contains(pnlc)){card.classList.remove('pf','ls','be');card.classList.add(pnlc);} // swap ONLY the pnl state class — the old wholesale card.className='pp '+pnlc dropped pp-gold EVERY tick, so balance tickets flickered gold→normal on each price change (the real root cause behind 5 reports; earlier fixes only touched the full-render path, not this in-place tick update)
        var lv=card.querySelector('.pp-live');if(lv){var lvv=fp(m.live);if(lv.textContent!==lvv)lv.textContent=lvv;}
        var big=card.querySelector('.big');if(big){var bv=(m.pnl!=null?((m.pnl>=0?'+':'−')+money(Math.abs(m.pnl)).replace('-','')):pctS(m.move*100));if(big.textContent!==bv)big.textContent=bv;}
        var roe=card.querySelector('.roe');if(roe){var rv='ROE '+pctS(m.roe*100);if(roe.textContent!==rv)roe.textContent=rv;}
        var meta=card.querySelector('.pp-meta');if(meta){var mv='Entry <b>'+fp(e.entry)+'</b> · Size <b>'+(e.qty!=null?(+e.qty).toLocaleString('en-US',{maximumFractionDigits:5}):'—')+'</b> · '+(e.lev||1)+'×<br>Notional <b>'+(m.notional!=null?money(m.notional):'—')+'</b> · Liq <b>'+fp(m.liq)+'</b> ('+pctS(m.liqDist)+')<br>SL <b>'+(window.mpLvlTxt?window.mpLvlTxt(e,false,fp):(e.stop!=null?fp(e.stop):'—'))+'</b> · TP <b>'+(window.mpLvlTxt?window.mpLvlTxt(e,true,fp):(e.tp!=null?fp(e.tp):'—'))+'</b> · '+dur(Date.now()-e.ts)+' · '+hm(e.ts);if(meta.innerHTML!==mv)meta.innerHTML=mv;}
      });return;}
    var c=d.filter(function(e){return e.status==='win'||e.status==='loss';});
    var sigC='c|'+c.map(function(e){return e.id;}).join(',');
    if(sigC!==_posSig){_posSig=sigC;el.innerHTML=c.length?c.slice().reverse().map(closedCard).join(''):'<div class="pp-empty">No closed trades yet.</div>';}}
  var tabsEl=document.getElementById('ptPosTabs');
  if(tabsEl)tabsEl.addEventListener('click',function(ev){var b=ev.target.closest('button');if(!b)return;tabsEl.querySelectorAll('button').forEach(function(x){x.classList.remove('on');});b.classList.add('on');posTab=b.getAttribute('data-pt');renderPos();});
  var listEl=document.getElementById('ptPosList');
  if(listEl)listEl.addEventListener('click',function(ev){var b=ev.target.closest('[data-act]');if(!b)return;var id=b.getAttribute('data-id'),act=b.getAttribute('data-act');var d=load(),i=-1;for(var k=0;k<d.length;k++){if(d[k].id===id){i=k;break;}}if(i<0)return;var e=d[i];
    if(act==='del')d.splice(i,1);
    else if(act==='close'){if(window.mpCloseSheet){window.mpCloseSheet(id,function(){renderLast();renderPos();drawLines();mtCount();});return;}var m=metrics(e);e.status=(m.pnl!=null?(m.pnl>=0?'win':'loss'):(m.move>=0?'win':'loss'));e.exit=m.live;e.closeTs=Date.now();e.pnl=(m.pnl!=null?m.pnl:0);buzz([22]);window._mpSltpHidden=true;}
    else if(act==='reopen'){e.status='open';e.exit=null;e.closeTs=null;e.pnl=null;notified[id]=false;}
    else if(act==='edit'){if(window.mpSltpSheet){window.mpSltpSheet(id,function(){renderPos();drawLines();});return;}var ns=prompt('New stop-loss price:',e.stop);if(ns!==null){var v=parseFloat(ns);if(isFinite(v))e.stop=v;}var nt=prompt('New take-profit (blank = none):',e.tp!=null?e.tp:'');if(nt!==null){var v2=parseFloat(nt);e.tp=isFinite(v2)?v2:null;}notified[id]=false;}
    store(d);renderPos();drawLines();});
  function loadLib(cb){if(window.LightweightCharts)return cb();var s=document.createElement('script');s.src='/assets/lightweight-charts-4.2.0.js';s.onload=cb;s.onerror=function(){};document.head.appendChild(s);}
  function initChart(){if(chart||!window.LightweightCharts)return;var el=document.getElementById('ptChart');if(!el||!el.clientWidth)return;chart=LightweightCharts.createChart(el,{layout:{background:{color:'transparent'},textColor:'#9aa3ad',fontFamily:"'Familjen Grotesk',system-ui,sans-serif",attributionLogo:false},grid:{vertLines:{color:'rgba(35,41,50,.4)'},horzLines:{color:'rgba(35,41,50,.4)'}},rightPriceScale:{borderColor:'#232932'},timeScale:{borderColor:'#232932',timeVisible:true,secondsVisible:false,rightOffset:10,barSpacing:7},crosshair:{mode:1},autoSize:true});candle=chart.addCandlestickSeries({upColor:'#10b981',downColor:'#ef4444',borderVisible:false,wickUpColor:'#10b981',wickDownColor:'#ef4444',lastValueVisible:false,priceLineVisible:true,priceLineColor:'#9aa3ad',autoscaleInfoProvider:function(orig){try{
    // Scale = the visible candles, EXTENDED to include the open position's entry/liq/tp/sl lines so they're visible on EVERY
    // timeframe — but the expansion is CAPPED so the candles never shrink below ~30% of the view (no "zoomed-out like a higher TF").
    if(!bars||!bars.length)return orig?orig():null;
    var vr=null;try{vr=chart.timeScale().getVisibleLogicalRange();}catch(e){}
    var n=bars.length,from=vr?Math.max(0,Math.floor(vr.from)):Math.max(0,n-160),to=vr?Math.min(n-1,Math.ceil(vr.to)):n-1;
    var cLo=Infinity,cHi=-Infinity;for(var i=from;i<=to;i++){var b=bars[i];if(!b)continue;if(b.low<cLo)cLo=b.low;if(b.high>cHi)cHi=b.high;}
    if(lastBar){if(lastBar.low<cLo)cLo=lastBar.low;if(lastBar.high>cHi)cHi=lastBar.high;}
    if(!(isFinite(cLo)&&isFinite(cHi)&&cHi>cLo))return orig?orig():null;
    var cRange=cHi-cLo,lo=cLo,hi=cHi,budget=cRange*2.4; // include a position line ONLY if it sits within ~2.4x the visible candle range (keeps the "fits on 15m+" behaviour). A line farther than that (a far liq on 1m/5m) is left to the edge marker instead of shrinking the candles to a flat line for nothing.
    for(var k=0;k<_openLines.length;k++){var v=_openLines[k];if(!(v>0))continue;
      if(v<cLo){if((cLo-v)<=budget&&v<lo)lo=v;}
      else if(v>cHi){if((v-cHi)<=budget&&v>hi)hi=v;}} // entry/liq/tp/sl cached by drawLines
    var pad=(hi-lo)*0.06;
    return {priceRange:{minValue:lo-pad,maxValue:hi+pad}};
  }catch(e){}return orig?orig():null;}});
    chart.timeScale().subscribeVisibleLogicalRangeChange(function(r){if(r&&r.from<10)loadMore();updateZone();try{posDragLines();}catch(e){}});try{chart.subscribeCrosshairMove(updatePtLegend);}catch(e){}try{ensureDrag();}catch(e){}showSkel();}
  // ---- Trade from chart: draggable SL/TP lines synced to the inputs (shown when Advanced is on) ----
  var dragEl=null,slLine=null,tpLine=null;window._mpSltpHidden=false; // window-scoped so the input handler (a different IIFE) can reset it
  window.mpHidePlanLines=function(){window._mpSltpHidden=true;try{posDragLines();}catch(e){}}; // called when a position closes so the SL/TP lines vanish (and reappear only when the user sets up a new trade)
  function fmtDl(p){return '$'+(+p).toLocaleString('en-US',{maximumFractionDigits:(p>=1?2:6)});}
  function bindDrag(line,inputId){/* drag disabled per owner: SL/TP lines are set by typing numbers only, never by dragging. Lines stay as read-only markers that vanish on hit/close. */}
  function ensureDrag(){if(dragEl)return;var host=document.getElementById('ptChart');if(!host)return;
    dragEl=document.createElement('div');dragEl.className='ptt-drag';
    slLine=document.createElement('div');slLine.className='ptt-dl ptt-dl-sl';slLine.hidden=true;slLine.innerHTML='<span class="ptt-dl-tag">SL <b></b></span>';
    tpLine=document.createElement('div');tpLine.className='ptt-dl ptt-dl-tp';tpLine.hidden=true;tpLine.innerHTML='<span class="ptt-dl-tag">TP <b></b></span>';
    dragEl.appendChild(slLine);dragEl.appendChild(tpLine);host.appendChild(dragEl);
    bindDrag(slLine,'planSlOpt');bindDrag(tpLine,'planTpOpt');}
  function posDragLines(){if(!dragEl||!candle)return;var adv=document.getElementById('planAdvChk');if(window._mpSltpHidden||!(adv&&adv.checked)){slLine.hidden=true;tpLine.hidden=true;return;}
    [['planSlOpt',slLine],['planTpOpt',tpLine]].forEach(function(pr){var inp=document.getElementById(pr[0]),line=pr[1],v=inp?parseFloat(inp.value):NaN;
      if(!isFinite(v)||v<=0){line.hidden=true;return;}var y;try{y=candle.priceToCoordinate(v);}catch(e){y=null;}if(y==null){line.hidden=true;return;}
      line.style.top=y+'px';line.hidden=false;var b=line.querySelector('b');if(b)b.textContent=fmtDl(v);});}
  var _skelT=null;
  function showSkel(){if(_skelT)return;_skelT=setTimeout(function(){_skelT=null;var el=document.getElementById('ptChart');if(!el||el.querySelector('.chart-skel'))return;var b='';for(var i=0;i<26;i++){var h=16+Math.round(62*Math.abs(Math.sin(i*0.7)));b+='<i style="height:'+h+'%;animation-delay:'+(i*0.04).toFixed(2)+'s"></i>';}var d=document.createElement('div');d.className='chart-skel';d.innerHTML=b;el.appendChild(d);},220);} // only show the skeleton if the load is actually slow → no blink on fast (cached) symbol/TF switches
  function hideSkel(){if(_skelT){clearTimeout(_skelT);_skelT=null;}var el=document.getElementById('ptChart');if(!el)return;var s=el.querySelector('.chart-skel');if(s&&s.parentNode)s.parentNode.removeChild(s);}
  function clearNoData(){var el=document.getElementById('ptChart');if(el){var n=el.querySelector('.chart-nodata');if(n&&n.parentNode)n.parentNode.removeChild(n);}}
  function showNoData(sym){var el=document.getElementById('ptChart');if(!el)return;var s=el.querySelector('.chart-skel');if(s&&s.parentNode)s.parentNode.removeChild(s);if(el.querySelector('.chart-nodata'))return;var d=document.createElement('div');d.className='chart-nodata';d.style.cssText='position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;text-align:center;color:#9aa3ad;z-index:6;pointer-events:none;padding:24px';d.innerHTML='<div style="font-size:15px;font-weight:700;color:#e9e7df">No market data for '+String(sym||'').replace(/[^A-Za-z0-9]/g,'')+'</div><small style="font-size:12px;color:#707a86;line-height:1.5;max-width:280px">This coin isn\'t on our live data feed (it may be delisted or renamed on the exchanges). Pick another pair to keep trading.</small>';el.appendChild(d);} // a coin our sources can\'t resolve now shows a message instead of a silent, frozen blank chart
  function formSym(){return (document.getElementById('planSym')||{}).value||'BTC';}
  var bars=[],loadingMore=false,noMore=false,morePages=0;
  try{window.__mpPT=function(){return {bars:bars,chart:chart,candle:candle,noMore:noMore,morePages:morePages,sym:chartSym,tf:chartTf};};}catch(e){} // permanent read-only debug accessor (mirror of /charts __mpWinsDbg + mobile __mfcPanes) — lets headless E2E introspect the paper-trade chart's live bars/pagination state (bars/noMore/morePages are reassigned, so return via closure)
  // Clamp ISOLATED phantom wicks (bad/transient prints in the exchange klines): a candle whose low/high is an extreme
  // outlier vs its OWN body AND BOTH neighbouring candles is almost certainly bad data (the "a drop/spike that never
  // happened" candle). Clamp it to a sane bound so it doesn't show as a giant vertical line — or feed a liquidation.
  function sanitizeBars(kd){ if(!kd||!kd.length)return kd;
    /* a bar with a null/NaN OHLC value poisons lightweight-charts' own render loop — every frame throws
       "Value is null" and the chart is permanently broken until reload. Drop such bars entirely. */
    var _ok=[];for(var _j=0;_j<kd.length;_j++){var _q=kd[_j];if(!_q)continue;var _t=+_q.time,_o=+_q.open,_h=+_q.high,_l=+_q.low,_c=+_q.close;
      if(!(_t>0&&_o>0&&_h>0&&_l>0&&_c>0&&isFinite(_t)&&isFinite(_o)&&isFinite(_h)&&isFinite(_l)&&isFinite(_c)))continue;
      _q.open=_o;_q.high=Math.max(_o,_h,_l,_c);_q.low=Math.min(_o,_h,_l,_c);_q.close=_c;_ok.push(_q);}
    kd=_ok;
    if(kd.length<2)return kd; var TH=0.035; // >3.5% beyond the corroborated reference = phantom
    for(var i=0;i<kd.length;i++){var b=kd[i];if(!b)continue;var o=+b.open,c=+b.close;if(!(o>0&&c>0))continue;
      var bodyLo=Math.min(o,c),bodyHi=Math.max(o,c);
      var pl=i>0?+kd[i-1].low:bodyLo,nl=i<kd.length-1?+kd[i+1].low:bodyLo;
      var ph=i>0?+kd[i-1].high:bodyHi,nh=i<kd.length-1?+kd[i+1].high:bodyHi;
      var refLo=Math.min(bodyLo,pl||bodyLo,nl||bodyLo); if(+b.low>0&&+b.low<refLo*(1-TH))b.low=refLo*(1-TH);
      var refHi=Math.max(bodyHi,ph||bodyHi,nh||bodyHi); if(+b.high>refHi*(1+TH))b.high=refHi*(1+TH);
    } return kd; }
  // render a klines array onto the chart (precision + data + scale + live-seed of the forming candle + position lines)
  function renderKlines(kd){ if(!(kd&&kd.length&&candle))return;
    bars=sanitizeBars(kd);
    try{var _lp=Math.abs(+kd[kd.length-1].close)||0,_pc=(_lp>=1000?2:_lp>=100?3:_lp>=10?3:_lp>=1?4:_lp>=0.1?4:_lp>=0.01?5:_lp>=0.001?6:_lp>=0.0001?7:_lp>=0.00001?8:9);candle.applyOptions({priceFormat:{type:'price',precision:_pc,minMove:Math.pow(10,-_pc)}});}catch(e){}/* ~5 sig figs — $1-100 coins were 2dp (XRP 1.09 hid 1.0904) */
    try{candle.setData(bars);chart.priceScale('right').applyOptions({autoScale:true});chart.timeScale().applyOptions({secondsVisible:parseInt(chartTf,10)<=5});chart.timeScale().scrollToRealTime();}catch(e){}
    lastBar=bars[bars.length-1];_lgp=lastBar&&lastBar.close||0;_rej=0;_dispP=null;
    /* seed the forming candle with the live price immediately — the klines tail is edge-cached up to ~20s, so the last candle (and the price-line basis) isn't a few ticks behind the live number */
    try{var _slp=(window.mpPlanLive&&window.mpPlanLive.sym===chartSym&&+window.mpPlanLive.price>0)?+window.mpPlanLive.price:((prices[chartSym]&&prices[chartSym].p)||0);if(_slp>0&&lastBar){var _siv=parseInt(chartTf,10)*60,_snb=Math.floor(Date.now()/1000/_siv)*_siv;if(lastBar.time>=_snb){lastBar.close=_slp;if(_slp>lastBar.high)lastBar.high=_slp;if(_slp<lastBar.low)lastBar.low=_slp;candle.update(lastBar);}}}catch(e){}
    _linesSig=null;drawLines();applySignals();hideSkel(); } // reset the line-diff so lines are re-asserted after a full setData
  function preloadTfs(sym,curTf){ if(window.innerWidth<721)return; /* mobile: skip the 6-TF prewarm (~150KB/symbol) — TF switches just fetch on demand (edge-cached); desktop keeps instant switching */ ['1','5','15','60','240','1440','10080'].forEach(function(tf){ if(tf===curTf)return; var ck=sym+'|'+tf; if(klCache[ck])return; fetch('/api/klines?symbol='+encodeURIComponent(sym)+'&interval='+tf,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){if(kd&&kd.length)klCache[ck]=kd;}); }); }
  function loadKlines(){var sym=formSym();chartSym=sym;var tf=chartTf;try{if(window.mpWS)window.mpWS.sub(sym);}catch(e){}bars=[];loadingMore=false;noMore=false;morePages=0;
    var ck=sym+'|'+tf,cached=klCache[ck],_csT=performance.now(); // UX budget: TF/symbol switch → candles painted
    if(cached&&cached.length&&candle){renderKlines(cached);try{if(window.__mpCsWarm&&window.__mpUxm)window.__mpUxm('cs',performance.now()-_csT);}catch(e){}} // INSTANT from the preload cache — no flash on a TF/symbol switch
    var _pk=null;try{if(window.__preK){var _hit=(window.__preK.key===ck);if(_hit)_pk=window.__preK.p;window.__preR=_hit?'hit':'miss';window.__preK=null;}}catch(e){}/* cold-load waterfall: an inline <head> preload may have fired this exact klines request in parallel with the bundle download — pick up its promise instead of a fresh serial fetch. no-store means the browser won't dedupe, so the handoff MUST be the promise not the cache. DRIFT DETECTOR: __preR = hit (key matched) or miss (inline drifted from what loadKlines asks → a wasted request on EVERY cold load, silently, forever — the exact thing this optimization is supposed to REDUCE). __preR rides the perf probe → AE 'preload' rows, so drift surfaces as a metric with a denominator instead of quietly burning infra. consume __preK once either way. */
    (_pk||fetch('/api/klines?symbol='+encodeURIComponent(sym)+'&interval='+tf,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})).then(function(kd){
      if(sym!==chartSym||tf!==chartTf)return; // user switched again before this resolved → drop the stale response
      if(kd&&kd.length){klCache[ck]=kd;clearNoData();renderKlines(kd);if(!(cached&&cached.length)){try{if(window.__mpUxm){if(window.__mpCsWarm)window.__mpUxm('cs',performance.now()-_csT);else window.__mpUxm('cc',performance.now());}}catch(e){}}try{window.__mpCsWarm=1;}catch(e){}/* cc = COLD first-chart telemetry: performance.now() = nav->first render (the first-impression time ux-chart deliberately skips). Fires once per page load (first cold render, __mpCsWarm still falsy). */} // first load is a COLD page-load fetch, not a switch — the 100ms budget measures switches onlyelse if(!cached){hideSkel();showNoData(sym);} // empty klines = coin our feed can't resolve → show a message, don't leave a silent blank/frozen chart
      preloadTfs(sym,tf); // warm the other timeframes in the background so the next switch is instant
    }); }
  // quietly re-sync candles with the true exchange OHLC WITHOUT scrolling the view — self-heals a phantom wick a bad live
  // tick baked into a (now closed) candle. renderKlines() scrolls to realtime so it can't be used for a periodic refresh.
  function refreshKlinesQuiet(){var sym=chartSym,tf=chartTf;if(!candle||document.hidden||loadingMore)return; // don't race loadMore's pagination (setData mid-append → duplicate/non-monotonic bars)
    try{var _vr=chart.timeScale().getVisibleLogicalRange();if(_vr&&bars.length&&_vr.to<bars.length-3)return;}catch(e){} // user is scrolled into HISTORY → skip the re-sync (setData would drop their paginated bars + the autoScale re-assert would override their zoom). The live edge they're not watching heals on their return.
    fetch('/api/klines?symbol='+encodeURIComponent(sym)+'&interval='+tf,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){
      if(sym!==chartSym||tf!==chartTf||!candle||!kd||!kd.length)return;
      kd=sanitizeBars(kd);klCache[sym+'|'+tf]=kd;bars=kd;try{candle.setData(kd);}catch(e){}try{chart.priceScale('right').applyOptions({autoScale:true});}catch(e){}/* re-assert autoscale: after a big move (e.g. a +15% pump) the price scale can lock/drift so data keeps updating but the chart LOOKS frozen — re-fitting every quiet refresh self-heals it */lastBar=kd[kd.length-1];_lgp=lastBar&&lastBar.close||0;_rej=0;_dispP=null;_linesSig=null;try{applySignals();}catch(e){}try{drawLines();}catch(e){}
    }); }
  function loadMore(){if(loadingMore||noMore||!bars.length||!candle)return;var sym=chartSym,tf=chartTf,end=bars[0].time*1000-1;loadingMore=true;var _lmg=setTimeout(function(){loadingMore=false;},12000);/* a hung (never-settling) fetch would otherwise pin loadingMore=true forever, which permanently disables the 30s refreshKlinesQuiet re-sync (a real freeze) */fetch('/api/klines?symbol='+encodeURIComponent(sym)+'&interval='+tf+'&end='+end,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){clearTimeout(_lmg);loadingMore=false;if(sym!==chartSym||tf!==chartTf)return;if(!kd||!kd.length){noMore=true;return;}var first=bars[0].time,older=sanitizeBars(kd.filter(function(b){return b.time<first;}));if(!older.length){noMore=true;return;}/* !older.length = oldest bar didn't move back = source can't go deeper (real "no more" test, not "returned few") */morePages++;if(morePages>=30)noMore=true;/* hard cap ~30 pages: anti-infinite for thin pairs. Removed `older.length<900 → noMore` which stopped at the SOURCE's inception (bybit-lin BTC 2020) instead of the coin's — the worker cascade falls through to a deeper source (gate-spot BTC 2013) on the next end= window */bars=older.concat(bars);try{candle.setData(bars);}catch(e){}applySignals();drawLines();});}
  /* Buy/Sell signals — a Supertrend(10,3) overlay (our own equivalent of TradingView "Buy Sell" indicators;
     kelfry98's proprietary Pine script can't be embedded here). Toggleable; plots BUY/SELL arrows on trend flips. */
  var inds={};try{inds=JSON.parse(localStorage.getItem('mp_pt_inds')||'null')||{};}catch(e){inds={};}
  try{if(localStorage.getItem('mp_sig')==='1'&&inds.sig==null)inds.sig=true;}catch(e){} // migrate the old single Signals toggle
  function computeSignals(d){var n=d?d.length:0,P=10,M=3;if(n<P+3)return [];
    var tr=[],i;for(i=0;i<n;i++){tr.push(i===0?d[i].high-d[i].low:Math.max(d[i].high-d[i].low,Math.abs(d[i].high-d[i-1].close),Math.abs(d[i].low-d[i-1].close)));}
    var atr=[],seed=0;for(i=0;i<P;i++)seed+=tr[i];var a=seed/P;for(i=0;i<n;i++){if(i<P)atr.push(a);else{a=(a*(P-1)+tr[i])/P;atr.push(a);}}
    var fU=[],fL=[],dir=[],mk=[];for(i=0;i<n;i++){var hl2=(d[i].high+d[i].low)/2,bU=hl2+M*atr[i],bL=hl2-M*atr[i];
      var pU=i?fU[i-1]:bU,pL=i?fL[i-1]:bL;
      var cU=(bU<pU||(i&&d[i-1].close>pU))?bU:pU,cL=(bL>pL||(i&&d[i-1].close<pL))?bL:pL;fU.push(cU);fL.push(cL);
      var pd=i?dir[i-1]:1,cd;if(i===0)cd=1;else if(pd===1)cd=d[i].close<cL?-1:1;else cd=d[i].close>cU?1:-1;dir.push(cd);
      if(i>P&&cd!==pd)mk.push(cd===1?{time:d[i].time,position:'belowBar',color:'#2ebd85',shape:'arrowUp',text:'BUY'}:{time:d[i].time,position:'aboveBar',color:'#ff6258',shape:'arrowDown',text:'SELL'});}
    return mk;}
  function smaArr(c,p){var o=[],sum=0;for(var i=0;i<c.length;i++){sum+=c[i];if(i>=p)sum-=c[i-p];o.push(i>=p-1?sum/p:null);}return o;}
  function emaArr(c,p){var o=[],k=2/(p+1),e=null;for(var i=0;i<c.length;i++){e=(e==null)?c[i]:c[i]*k+e*(1-k);o.push(i>=p-1?e:null);}return o;}
  function bollinger(c,p,m){var mid=smaArr(c,p),u=[],l=[];for(var i=0;i<c.length;i++){if(i>=p-1){var s=0;for(var j=i-p+1;j<=i;j++)s+=(c[j]-mid[i])*(c[j]-mid[i]);var sd=Math.sqrt(s/p);u.push(mid[i]+m*sd);l.push(mid[i]-m*sd);}else{u.push(null);l.push(null);}}return {u:u,m:mid,l:l};}
  function rsiArr(c,p){var o=[],i;for(i=0;i<c.length;i++)o.push(null);if(c.length<=p)return o;var g=0,ls=0;for(i=1;i<=p;i++){var d=c[i]-c[i-1];if(d>=0)g+=d;else ls-=d;}g/=p;ls/=p;o[p]=100-100/(1+(ls===0?100:g/ls));for(i=p+1;i<c.length;i++){var d2=c[i]-c[i-1],gg=d2>0?d2:0,ll=d2<0?-d2:0;g=(g*(p-1)+gg)/p;ls=(ls*(p-1)+ll)/p;o[i]=100-100/(1+(ls===0?100:g/ls));}return o;}
  function atrArr(bs,p){var tr=[],i;for(i=0;i<bs.length;i++){tr.push(i===0?bs[i].high-bs[i].low:Math.max(bs[i].high-bs[i].low,Math.abs(bs[i].high-bs[i-1].close),Math.abs(bs[i].low-bs[i-1].close)));}var o=[],s=0;for(i=0;i<tr.length;i++){if(i<p){s+=tr[i];o.push(i===p-1?s/p:null);}else{o.push((o[i-1]*(p-1)+tr[i])/p);}}return o;}
  function macdArr(c){var f=emaArr(c,12),s=emaArr(c,26),md=[],i;for(i=0;i<c.length;i++)md.push((f[i]!=null&&s[i]!=null)?f[i]-s[i]:null);var sig=[],e=null,k=2/10,cnt=0;for(i=0;i<c.length;i++){if(md[i]==null){sig.push(null);continue;}e=(e==null)?md[i]:md[i]*k+e*(1-k);cnt++;sig.push(cnt>=9?e:null);}return {macd:md,signal:sig};}
  function stochArr(bs,kP,dP){var kk=[],i,j;for(i=0;i<bs.length;i++){if(i<kP-1){kk.push(null);continue;}var hh=-Infinity,ll=Infinity;for(j=i-kP+1;j<=i;j++){if(bs[j].high>hh)hh=bs[j].high;if(bs[j].low<ll)ll=bs[j].low;}kk.push(hh===ll?50:100*(bs[i].close-ll)/(hh-ll));}var dd=[];for(i=0;i<bs.length;i++){if(i<kP-1+dP-1){dd.push(null);continue;}var sum=0,ok=true;for(j=i-dP+1;j<=i;j++){if(kk[j]==null){ok=false;break;}sum+=kk[j];}dd.push(ok?sum/dP:null);}return {k:kk,d:dd};}
  function donchianArr(bs,p){var up=[],lo=[],i,j;for(i=0;i<bs.length;i++){if(i<p-1){up.push(null);lo.push(null);continue;}var hh=-Infinity,ll=Infinity;for(j=i-p+1;j<=i;j++){if(bs[j].high>hh)hh=bs[j].high;if(bs[j].low<ll)ll=bs[j].low;}up.push(hh);lo.push(ll);}return {u:up,l:lo};}
  function vwapArr(bs){var o=[],pv=0,vv=0;for(var i=0;i<bs.length;i++){var tp=(+bs[i].high+ +bs[i].low+ +bs[i].close)/3,v=+bs[i].vol;if(isFinite(v)&&v>0){pv+=tp*v;vv+=v;}o.push(vv?pv/vv:null);}return o;}
  function wmaArr(c,p){var o=[],i,j;for(i=0;i<c.length;i++){if(i<p-1){o.push(null);continue;}var sum=0,wsum=0;for(j=0;j<p;j++){var w=p-j;sum+=c[i-j]*w;wsum+=w;}o.push(sum/wsum);}return o;}
  function hmaArr(c,p){var half=Math.max(1,Math.round(p/2)),sq=Math.max(1,Math.round(Math.sqrt(p))),w1=wmaArr(c,half),w2=wmaArr(c,p),raw=[],i,j;for(i=0;i<c.length;i++)raw.push((w1[i]!=null&&w2[i]!=null)?2*w1[i]-w2[i]:null);var o=[];for(i=0;i<c.length;i++){if(i<p-2+sq){o.push(null);continue;}var sum=0,wsum=0,ok=true;for(j=0;j<sq;j++){var v=raw[i-j];if(v==null){ok=false;break;}var w=sq-j;sum+=v*w;wsum+=w;}o.push(ok?sum/wsum:null);}return o;}
  function willrArr(bs,p){var o=[],i,j;for(i=0;i<bs.length;i++){if(i<p-1){o.push(null);continue;}var hh=-Infinity,ll=Infinity;for(j=i-p+1;j<=i;j++){if(bs[j].high>hh)hh=bs[j].high;if(bs[j].low<ll)ll=bs[j].low;}o.push(hh===ll?-50:(hh-bs[i].close)/(hh-ll)*-100);}return o;}
  function cciArr(bs,p){var tp=bs.map(function(b){return (+b.high+ +b.low+ +b.close)/3;}),o=[],i,j;for(i=0;i<bs.length;i++){if(i<p-1){o.push(null);continue;}var sum=0;for(j=i-p+1;j<=i;j++)sum+=tp[j];var ma=sum/p,md=0;for(j=i-p+1;j<=i;j++)md+=Math.abs(tp[j]-ma);md/=p;o.push(md===0?0:(tp[i]-ma)/(0.015*md));}return o;}
  var indSeries=[];
  var ptLeg=null, ptLegItems=[];
  function ensurePtLeg(){if(ptLeg)return;var host=document.getElementById('ptChart');if(!host)return;ptLeg=document.createElement('div');ptLeg.className='pt-leg';host.appendChild(ptLeg);}
  function fmtLeg(v,dec){if(v==null||!isFinite(v))return '–';return dec===0?String(Math.round(v)):(dec==null?fp(v):(+v).toFixed(dec));}
  function updatePtLegend(param){ensurePtLeg();if(!ptLeg)return;if(!ptLegItems.length){ptLeg.style.display='none';ptLeg.innerHTML='';return;}ptLeg.style.display='';ptLeg.innerHTML=ptLegItems.map(function(it){var v=it.last;if(param&&param.seriesData){var sd=param.seriesData.get(it.series);if(sd!=null)v=(typeof sd==='object'?(sd.value!=null?sd.value:sd.close):sd);}return '<span style="color:'+it.color+'">'+it.label+' <b>'+fmtLeg(v,it.dec)+'</b></span>';}).join('');}
  function applyInds(){if(!chart||!candle)return; // indicators removed from Paper Trade — cleanup no-op (kept so loadKlines/loadMore/refresh callers stay valid)
    try{candle.setMarkers([]);}catch(e){}
    indSeries.forEach(function(s){try{chart.removeSeries(s);}catch(e){}});indSeries=[];ptLegItems=[];
    try{updatePtLegend();}catch(e){}return;
    if(!bars||!bars.length){updatePtLegend();return;}var c=bars.map(function(b){return +b.close;}),t=bars.map(function(b){return b.time;});
    function addLine(vals,opts,leg){var s;try{s=chart.addLineSeries(Object.assign({lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false},opts));}catch(e){return null;}var data=[],i,last=null;for(i=0;i<vals.length;i++){if(vals[i]!=null&&isFinite(vals[i])){data.push({time:t[i],value:vals[i]});last=vals[i];}}try{s.setData(data);}catch(e){}indSeries.push(s);if(leg)ptLegItems.push({label:leg.label,series:s,color:opts.color,dec:leg.dec,last:last});return s;}
    var _panes=['vol','rsi','macd','stoch','atr','wr','cci'].filter(function(k){return inds[k];}),_pN=_panes.length;
    try{chart.priceScale('right').applyOptions({scaleMargins:{top:0.06,bottom:_pN?0.34:0.1}});}catch(e){}
    function _pm(key){var idx=_panes.indexOf(key),band=0.32/Math.max(1,_pN);return {top:0.68+idx*band+0.005,bottom:(_pN-1-idx)*band+0.02};}
    function _ps(id,key){try{chart.priceScale(id).applyOptions({scaleMargins:_pm(key)});}catch(e){}}
    if(inds.ema)addLine(emaArr(c,21),{color:'#3fd8e6'},{label:'EMA 21',dec:null});
    if(inds.sma)addLine(smaArr(c,50),{color:'#c2f64a'},{label:'SMA 50',dec:null});
    if(inds.sma2)addLine(smaArr(c,200),{color:'#ff9f43'},{label:'SMA 200',dec:null});
    if(inds.bb){var bb=bollinger(c,20,2);addLine(bb.u,{color:'rgba(154,163,173,.75)'});addLine(bb.m,{color:'rgba(154,163,173,.6)',lineStyle:2},{label:'BB',dec:null});addLine(bb.l,{color:'rgba(154,163,173,.75)'});}
    if(inds.kc){var _km=emaArr(c,20),_ka=atrArr(bars,10),_ku=[],_kl=[],_ki;for(_ki=0;_ki<c.length;_ki++){var _okv=_km[_ki]!=null&&_ka[_ki]!=null;_ku.push(_okv?_km[_ki]+2*_ka[_ki]:null);_kl.push(_okv?_km[_ki]-2*_ka[_ki]:null);}addLine(_ku,{color:'rgba(110,214,180,.8)'});addLine(_km,{color:'rgba(110,214,180,.55)',lineStyle:2},{label:'Keltner',dec:null});addLine(_kl,{color:'rgba(110,214,180,.8)'});}
    if(inds.dc){var _dc=donchianArr(bars,20);addLine(_dc.u,{color:'#2ebd85'});addLine(_dc.l,{color:'#ff6258'});}
    if(inds.vwap)addLine(vwapArr(bars),{color:'#46e0e6',lineWidth:2},{label:'VWAP',dec:null});
    if(inds.hma)addLine(hmaArr(c,21),{color:'#ff7bd5'},{label:'HMA 21',dec:null});
    if(inds.rsi){addLine(rsiArr(c,14),{color:'#e0a0ff',priceScaleId:'ptrsi'},{label:'RSI 14',dec:0});addLine(c.map(function(){return 70;}),{color:'rgba(255,98,88,.3)',lineStyle:2,priceScaleId:'ptrsi'});addLine(c.map(function(){return 30;}),{color:'rgba(46,189,133,.3)',lineStyle:2,priceScaleId:'ptrsi'});_ps('ptrsi','rsi');}
    if(inds.macd){var _mc=macdArr(c);addLine(_mc.macd,{color:'#3fd8e6',priceScaleId:'ptmacd'},{label:'MACD',dec:null});addLine(_mc.signal,{color:'#ff9f4d',priceScaleId:'ptmacd'});addLine(c.map(function(){return 0;}),{color:'rgba(120,130,140,.4)',lineStyle:2,priceScaleId:'ptmacd'});_ps('ptmacd','macd');}
    if(inds.stoch){var _st=stochArr(bars,14,3);addLine(_st.k,{color:'#c2f64a',priceScaleId:'ptstoch'},{label:'Stoch',dec:0});addLine(_st.d,{color:'#ff6258',priceScaleId:'ptstoch'});addLine(c.map(function(){return 80;}),{color:'rgba(255,159,77,.25)',lineStyle:2,priceScaleId:'ptstoch'});addLine(c.map(function(){return 20;}),{color:'rgba(46,189,133,.25)',lineStyle:2,priceScaleId:'ptstoch'});_ps('ptstoch','stoch');}
    if(inds.atr){addLine(atrArr(bars,14),{color:'#ffb347',priceScaleId:'ptatr'},{label:'ATR 14',dec:null});_ps('ptatr','atr');}
    if(inds.wr){addLine(willrArr(bars,14),{color:'#ffd75a',priceScaleId:'ptwr'},{label:'%R 14',dec:0});addLine(c.map(function(){return -20;}),{color:'rgba(255,98,88,.3)',lineStyle:2,priceScaleId:'ptwr'});addLine(c.map(function(){return -80;}),{color:'rgba(46,189,133,.3)',lineStyle:2,priceScaleId:'ptwr'});_ps('ptwr','wr');}
    if(inds.cci){addLine(cciArr(bars,20),{color:'#7fb6ff',priceScaleId:'ptcci'},{label:'CCI 20',dec:0});addLine(c.map(function(){return 100;}),{color:'rgba(255,98,88,.25)',lineStyle:2,priceScaleId:'ptcci'});addLine(c.map(function(){return -100;}),{color:'rgba(46,189,133,.25)',lineStyle:2,priceScaleId:'ptcci'});addLine(c.map(function(){return 0;}),{color:'rgba(120,130,140,.35)',lineStyle:2,priceScaleId:'ptcci'});_ps('ptcci','cci');}
    if(inds.vol){var _vs;try{_vs=chart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'ptvol',lastValueVisible:false,priceLineVisible:false});}catch(e){}
      if(_vs){var _vd=[];for(var _vi=0;_vi<bars.length;_vi++){var _vb=bars[_vi],_vv=+_vb.vol;if(isFinite(_vv)&&_vv>0)_vd.push({time:_vb.time,value:_vv,color:(+_vb.close>=+_vb.open)?'rgba(46,189,133,.45)':'rgba(255,98,88,.45)'});}try{_vs.setData(_vd);}catch(e){}indSeries.push(_vs);}
      _ps('ptvol','vol');}
    updatePtLegend();
  }
  function applySignals(){applyInds();} // existing loadKlines/loadMore callers route through here
  var PT_INDS=[['sig','Buy / Sell signals'],['ema','EMA 21'],['sma','SMA 50'],['sma2','SMA 200'],['hma','Hull MA 21'],['vwap','VWAP'],['bb','Bollinger Bands'],['kc','Keltner Channels'],['dc','Donchian Channel'],['vol','Volume'],['rsi','RSI 14'],['macd','MACD'],['stoch','Stochastic'],['atr','ATR 14'],['wr','Williams %R'],['cci','CCI']];
  var ptIndMenu=null;
  function updIndN(){var n=0,k;for(k in inds)if(inds[k])n++;var el=document.getElementById('ptIndN');if(el)el.textContent=n?String(n):'';var btn=document.getElementById('ptInd');if(btn)btn.classList.toggle('on',n>0);}
  var PTIPS={sig:'Green arrow = trend just flipped UP (possible buy). Red arrow = flipped DOWN (possible sell).',ema:'Smooth average price, recent bars count more. Above the line = going up; below = going down.',sma:'The plain average price over the last 50 bars — a simple trend line.',sma2:'The average price over 200 bars — the big long-term trend line.',hma:'A super-smooth, fast average price line — less wobble and less lag.',vwap:'Average price weighted by how much was traded — big traders’ idea of fair price.',bb:'Two bands around price. Near the top = pricey, near the bottom = cheap. Wide = wild, tight = calm.',kc:'Bands based on how much price usually moves. Popping outside = a strong move.',dc:'The highest high and lowest low recently. Breaking above = an upside breakout.',vol:'How much was traded each bar. Tall bars = lots of trading right then.',rsi:'A 0–100 meter. Above 70 = maybe too high (overbought); below 30 = too low (oversold).',macd:'Shows if the trend is speeding up or slowing down. Above 0 = buyers in control.',stoch:'Like RSI for timing turns. Above 80 = overbought, below 20 = oversold.',atr:'How much price usually moves per bar. Big ATR = wild → use wider stops.',wr:'Williams %R — upside-down RSI. Near 0 = overbought, near −100 = oversold.',cci:'How far price is from its average. Above +100 = strong up; below −100 = strong down.'};
  function buildIndMenu(){ptIndMenu=document.createElement('div');ptIndMenu.className='ptt-ind-menu';ptIndMenu.hidden=true;ptIndMenu.innerHTML='<div class="ptt-ind-h">Indicators</div>'+PT_INDS.map(function(t){return '<button type="button" class="ptt-ind-item" data-ind="'+t[0]+'" title="'+(PTIPS[t[0]]||'').replace(/"/g,'&quot;')+'"><span class="ptt-ind-ck"></span>'+t[1]+'</button>';}).join('');document.body.appendChild(ptIndMenu);
    ptIndMenu.addEventListener('click',function(e){var b=e.target.closest('.ptt-ind-item');if(!b)return;var k=b.getAttribute('data-ind');inds[k]=!inds[k];b.classList.toggle('on',!!inds[k]);try{localStorage.setItem('mp_pt_inds',JSON.stringify(inds));}catch(_){}applyInds();updIndN();});
    document.addEventListener('pointerdown',function(e){if(ptIndMenu&&!ptIndMenu.hidden&&!(e.target.closest&&(e.target.closest('.ptt-ind-menu')||e.target.closest('#ptInd'))))ptIndMenu.hidden=true;},true);
    window.addEventListener('scroll',function(e){if(ptIndMenu&&!ptIndMenu.hidden&&!(e.target&&e.target.closest&&e.target.closest('.ptt-ind-menu')))ptIndMenu.hidden=true;},true);}/* only close on OUTSIDE scroll — scrolling inside the (now taller) menu must not dismiss it */
  function openIndMenu(btn){if(!ptIndMenu)buildIndMenu();if(!ptIndMenu.hidden){ptIndMenu.hidden=true;return;}Array.prototype.forEach.call(ptIndMenu.querySelectorAll('.ptt-ind-item'),function(it){it.classList.toggle('on',!!inds[it.getAttribute('data-ind')]);});ptIndMenu.hidden=false;var r=btn.getBoundingClientRect(),mw=ptIndMenu.offsetWidth||210,mh=ptIndMenu.offsetHeight||280;var left=Math.min(r.left,window.innerWidth-mw-8),top=r.bottom+6;if(top+mh>window.innerHeight-8)top=Math.max(8,r.top-mh-6);ptIndMenu.style.left=Math.max(8,left)+'px';ptIndMenu.style.top=top+'px';}
  var indBtn=document.getElementById('ptInd');
  if(indBtn)indBtn.addEventListener('click',function(){openIndMenu(indBtn);});
  updIndN();
  var _klReload=0;
  // Re-fetch the candles (throttled). Used to self-heal the chart after the tab was backgrounded / the feed paused
  // for a while — browsers throttle setInterval in hidden tabs, so liveCandle stops rolling new bars and a gap forms.
  function reloadKlinesThrottled(){var now=Date.now();if(now-_klReload<8000)return;_klReload=now;loadKlines();}
  function liveCandle(){var pd=window.mpPlanLive,pdFresh=(pd&&pd.sym===chartSym&&pd.price>0&&pd.t&&Date.now()-pd.t<6000);
    /* the WS-fed form price (window.mpPlanLive) is the real-time truth — but ONLY while it's fresh. If it goes stale (form feed paused/disconnected) fall back to the chart's own /api/price poll so the chart can NEVER freeze on a stale value. */
    var p=0;
    if(pdFresh)p=pd.price;
    else{var _pr=prices[chartSym],_prT=(_pr&&_pr.p>0)?(_pr.t||0):-1,_pdT=(pd&&pd.sym===chartSym&&pd.price>0)?(pd.t||0):-1;
      if(_prT>=0||_pdT>=0)p=(_prT>=_pdT)?_pr.p:pd.price;}/* both sources stale → use the FRESHER one (the old code preferred the poll map even when it was minutes older than the WS value) */
    if(!candle||!lastBar)return;var ivSec=parseInt(chartTf,10)*60,nowBar=Math.floor(Date.now()/1000/ivSec)*ivSec;
    if(nowBar-lastBar.time>ivSec*1.5){reloadKlinesThrottled();if(!(p>0)||nowBar-lastBar.time>ivSec*30)return;} // klines is behind → refetch real candles; BUT if we have a live WS price and the gap is modest (≤30 bars), fall through and roll a LIVE forming candle so the chart keeps MOVING instead of freezing while klines catches up (fixes "candles freeze but price doesn't" on a brief klines stall). Huge gaps (e.g. a 4h-stale klines endpoint) still wait for the real refetch. THIS RUNS EVEN WITH NO LIVE PRICE (checked BEFORE the p>0 bail below) — the old order bailed on a stalled feed and never refetched, so new bars stopped forming and the chart "froze" until the 60s re-sync.
    if(!(p>0))return; // no usable live price this tick → the gap above is already handled; nothing else to update
    if(nowBar>lastBar.time){var _op=lastBar.close,_spk=(_lgp>0&&Math.abs(p-_lgp)/_lgp>0.025),_cl=_spk?_op:p;lastBar={time:nowBar,open:_op,high:Math.max(_op,_cl),low:Math.min(_op,_cl),close:_cl};if(!_spk)_lgp=p;_rej=0;/* new candle opens at the prior close (contiguous — no "from the sky" gap) and ignores a spiked first print */try{var _vr=chart.timeScale().getVisibleLogicalRange();if(!_vr||!bars.length||_vr.to>=bars.length-2)chart.timeScale().scrollToRealTime();}catch(e){}_dispP=lastBar.close;try{candle.update(lastBar);}catch(e){} /* only snap to the live edge if the user is ALREADY there — don't yank them back while they pan history */}else{if(_lgp>0&&Math.abs(p-_lgp)/_lgp>0.025){if(++_rej<3)return;/* reject a lone >2.5% print (a bad tick that would ratchet a fake wick); accept only if 3 in a row confirm it's a real move */}_lgp=p;_rej=0;lastBar.close=p;if(p>lastBar.high)lastBar.high=p;if(p<lastBar.low)lastBar.low=p;startSmoothP();}}
  // ease the forming candle's displayed close toward the true price at 60fps so it glides instead of snapping
  var _smP=false,_dispP=null;
  function startSmoothP(){ if(!_smP){_smP=true;requestAnimationFrame(smoothLoopP);} }
  function smoothLoopP(){
    _smP=false; if(document.hidden||!candle||!lastBar)return;
    var tgt=+lastBar.close; if(!(tgt>0))return;
    var fresh=(_dispP==null||!isFinite(_dispP));
    if(fresh){ _dispP=tgt; }
    else if(_dispP!==tgt){ var d=tgt-_dispP; if(Math.abs(d)<=Math.max(Math.abs(tgt)*1e-5,1e-9))_dispP=tgt; else { _dispP+=d*0.34; _smP=true; } }
    else return;
    var c=_dispP; if(c>lastBar.high)c=lastBar.high; else if(c<lastBar.low)c=lastBar.low;
    try{candle.update({time:lastBar.time,open:lastBar.open,high:lastBar.high,low:lastBar.low,close:c});}catch(e){}
    if(_smP)requestAnimationFrame(smoothLoopP);
  }
  document.addEventListener('visibilitychange',function(){if(!document.hidden)startSmoothP();});
  function liqOf(e){var long=e.side!=='short',lev=(+e.lev>0)?+e.lev:1,mmr=(e.mmr||0.005);return e.liq||(long?e.entry*(1-(1-mmr)/lev):e.entry*(1+(1-mmr)/lev));}
  function drawLines(d){if(!candle)return;
    var op=(d||load()).filter(function(e){return e.status==='open'&&e.sym===chartSym;});
    // diff: only destroy/recreate the chart price-line objects when the open-position set actually changes. This used
    // to churn every line EVERY tick (1Hz), and each createPriceLine re-fires the autoscale recompute + a chart redraw.
    // updateZone still runs so the liq zone/edge pills track scroll/scale. renderKlines/refreshKlinesQuiet reset _linesSig.
    var sig=op.map(function(e){return e.id+':'+e.entry+':'+e.stop+':'+e.tp+':'+e.side+':'+e.lev+':'+liqOf(e)+':'+JSON.stringify(e.tps||0)+':'+JSON.stringify(e.sls||0);}).join('|');
    if(sig===_linesSig){updateZone();return;} _linesSig=sig;
    plines.forEach(function(l){try{candle.removePriceLine(l);}catch(e){}});plines=[];
    // cache the line prices FIRST so the autoscale provider (which fires the moment a price line is created) already sees them
    // GROUP identical levels first — 3 positions at (nearly) the same entry used to stack 3 overlapping LONG/LIQ/TP
    // labels on the axis + 3 edge pills covering each other (UX audit, mobile). One line/pill per level, titled ×N.
    _openLines=[];_openMarks=[];var _grp={};
    function _gAdd(p,label,color,w,style){if(!(p>0))return;_openLines.push(p);var k=label+'@'+p.toPrecision(6);var g=_grp[k];if(g){g.n++;return;}_grp[k]={p:p,label:label,color:color,w:w,style:style,n:1};}
    op.forEach(function(e){var long=e.side!=='short';
      _gAdd(+e.entry,(long?'LONG':'SHORT'),long?'#10b981':'#ef4444',1,0);
      _gAdd(liqOf(e),'LIQ','#ff3b3b',2,0);
      if(e.tps&&e.tps.length)e.tps.forEach(function(L){if(+L.p>0)_gAdd(+L.p,'TP'+(+L.pct<100?' '+(+L.pct)+'%':''),'#6b7280',1,2);});
      else if(e.tp!=null)_gAdd(+e.tp,'TP','#6b7280',1,2);
      if(e.sls&&e.sls.length)e.sls.forEach(function(L){if(+L.p>0)_gAdd(+L.p,'SL'+(+L.pct<100?' '+(+L.pct)+'%':''),'#6b7280',1,2);});
      else if(e.stop!=null)_gAdd(+e.stop,'SL','#6b7280',1,2);});
    for(var gk in _grp){var g=_grp[gk];var t=g.label+(g.n>1?' ×'+g.n:'');
      _openMarks.push({p:g.p,label:t,color:(g.label.slice(0,2)==='TP'||g.label.slice(0,2)==='SL')?'#9aa3ad':g.color});
      if(isFinite(g.p))try{plines.push(candle.createPriceLine({price:g.p,color:g.color,lineWidth:g.w,lineStyle:g.style,axisLabelVisible:true,title:t}));}catch(e){}}
    updateZone();}
  // shaded "liquidation zone" beyond the liq line: a translucent red overlay (slight blur) so candles still show through
  var zoneEl=null,edgeEl=null;
  /* Edge pills RETIRED (owner 2026-07-14): the ▲/▼ LIQ/LONG markers duplicated the axis labels and read as
     phantom extra liquidations (bug screenshot: 7 stacked pills next to visible lines). Only the price lines +
     their right-axis labels remain. Kept as a cleaner so any previously rendered pills disappear. */
  function updateEdges(){if(edgeEl&&edgeEl.childNodes.length)edgeEl.innerHTML='';}
  function updateZone(){var host=document.getElementById('ptChart');if(!host||!candle){return;}
    updateEdges();
    if(!zoneEl){zoneEl=document.createElement('div');zoneEl.className='ptt-zones';host.appendChild(zoneEl);}
    var pos=load().filter(function(e){return e.status==='open'&&e.sym===chartSym;});
    if(!pos.length){if(zoneEl._h){zoneEl._h='';zoneEl.innerHTML='';}return;}
    var H=host.clientHeight||0,html='';
    pos.forEach(function(e){var long=e.side!=='short',y;try{y=candle.priceToCoordinate(liqOf(e));}catch(_){y=null;}
      if(y==null||!isFinite(y))return;
      if(long)html+='<div class="zone" style="top:'+Math.max(0,y).toFixed(1)+'px;height:'+Math.max(0,H-y).toFixed(1)+'px"></div>';
      else html+='<div class="zone" style="top:0;height:'+Math.max(0,Math.min(H,y)).toFixed(1)+'px"></div>';});
    if(zoneEl._h!==html){zoneEl._h=html;zoneEl.innerHTML=html;}} // only touch the DOM when the zone geometry actually changed — was an unconditional innerHTML rebuild at ~60fps
  window.mpDrawLines=drawLines; // let the My Trades drawer refresh the chart lines the instant a position is closed/edited
  function chartHeader(){var px=document.getElementById('ptChartPx'),ch=document.getElementById('ptChartChg'),pd=window.mpPlanLive;var p=(pd&&pd.sym===chartSym&&pd.price>0)?pd.price:(prices[chartSym]&&prices[chartSym].p),cg=(pd&&pd.sym===chartSym)?pd.chg:0;if(p>0){if(px){if(window.mpSmoothPx)window.mpSmoothPx(px,p,fp);else px.textContent=fp(p);}if(ch){ch.textContent=((cg>=0?'+':'')+(+cg||0).toFixed(2))+'%';ch.style.color=cg>=0?'var(--up)':'var(--red)';}}
    // the on-chart live-price label colour follows the 24h change (consistent) — never the current TF candle's up/down
    if(candle){var _cc=(cg>=0?'#2ebd85':'#ff5a4d');if(_cc!==_plc){_plc=_cc;try{candle.applyOptions({priceLineColor:_cc});}catch(e){}}}}
  var tfEl=document.getElementById('ptTf'),tfBtn=document.getElementById('ptTfBtn'),tfCur=document.getElementById('ptTfCur');
  function tfMenu(open){if(!tfEl||!tfBtn)return;tfEl.hidden=!open;tfBtn.setAttribute('aria-expanded',open?'true':'false');}
  if(tfBtn)tfBtn.addEventListener('click',function(e){e.stopPropagation();tfMenu(tfEl.hidden);});
  if(tfEl)tfEl.addEventListener('click',function(ev){var b=ev.target.closest('button');if(!b)return;tfEl.querySelectorAll('button').forEach(function(x){x.classList.remove('on');});b.classList.add('on');chartTf=b.getAttribute('data-tf');if(tfCur)tfCur.textContent=b.textContent;tfMenu(false);loadKlines();});
  document.addEventListener('click',function(e){if(tfEl&&!tfEl.hidden&&!e.target.closest('.ptt-tfwrap'))tfMenu(false);});
  var pSym=document.getElementById('planSym');
  if(pSym)pSym.addEventListener('change',function(){setTimeout(loadKlines,30);});
  var sv=document.getElementById('planSave');
  if(sv)sv.addEventListener('click',function(){setTimeout(function(){renderPos();renderLast();
    // ONLY pop the ticket when a NEW position actually opened this click — a blocked/spam click (cooldown, empty
    // amount, wrong-side SL/TP) must NOT re-shake the last ticket as if it just opened (owner report).
    if(Date.now()-(window._mpLastOpenTs||0)<500){window._mpLastOpenTs=0; /* consume: pop exactly once per real open, never on a later blocked click */ var _lt=document.getElementById('ptLastTrade');if(_lt&&!_lt.hidden){var _f=_lt.querySelector('.pt-last');if(_f){_f.classList.remove('justopened');void _f.offsetWidth;_f.classList.add('justopened');setTimeout(function(){_f.classList.remove('justopened');},1000);}}}
    drawLines();mtCount();if(window.mpJournalRender)window.mpJournalRender();},140);});
  function ensureChart(){var pl=document.getElementById('plan');if(!pl||!pl.classList.contains('active')||!pl.offsetParent)return;if(!inited){inited=true;loadLib(function(){initChart();loadKlines();});}else if(!chart&&window.LightweightCharts){initChart();loadKlines();}}
  function mtCount(){var el=document.getElementById('ptMtCount');if(!el)return;var n=load().filter(function(e){return e.status==='open';}).length;el.textContent=n?String(n):'';}
  // dynamic stop management — trailing stop trails the best price; break-even snaps the stop to entry once ROE hits the trigger
  function manageStops(e,m){if(e.status!=='open'||!(m.live>0))return false;var moved=false,long=m.long;
    if(e.be>0&&isFinite(m.roe)&&m.roe*100>=e.be){if(long){if(e.stop==null||e.stop<e.entry){e.stop=e.entry;moved=true;}}else{if(e.stop==null||e.stop>e.entry){e.stop=e.entry;moved=true;}}}
    if(e.trail>0){if(long){if(e.hwm==null||m.live>e.hwm)e.hwm=m.live;var ts=e.hwm*(1-e.trail/100);if(e.stop==null||ts>e.stop){e.stop=ts;moved=true;}}else{if(e.hwm==null||m.live<e.hwm)e.hwm=m.live;var ts2=e.hwm*(1+e.trail/100);if(e.stop==null||ts2<e.stop){e.stop=ts2;moved=true;}}}
    return moved;}
  /* ---- Multi-level TP/SL (owner 2026-07-13): e.tps / e.sls = [{p,pct}]. Each level closes pct% of the position
     when touched. Legacy e.tp / e.stop stay MIRRORS of the nearest 100% level, so checkClose, sweepLiq and every
     display/liq path keep working untouched — only pct<100 levels are executed here (live tick only, like the
     partial-close sheet). Positions edited into multiple SL levels skip trailing/break-even (they'd fight the mirror). */
  function lvlSync(e){var long=e.side!=='short';
    function mir(arr,isTp){if(!arr||!arr.length)return null;var full=arr.filter(function(L){return +L.pct>=100&&+L.p>0;});if(!full.length)return null;
      full.sort(function(a,b){return (isTp===long)?(a.p-b.p):(b.p-a.p);});return +full[0].p;}
    if(e.tps)e.tp=mir(e.tps,true);
    if(e.sls)e.stop=mir(e.sls,false);}
  window.mpLvlSync=lvlSync;
  window.mpLvlTxt=function(e,isTp,fmt){var arr=isTp?e.tps:e.sls,lg=e.side!=='short';
    if(arr&&arr.length){var a=arr.slice().sort(function(x,y){return (isTp===lg)?(x.p-y.p):(y.p-x.p);});
      var s=fmt(+a[0].p)+(+a[0].pct<100?' ('+(+a[0].pct)+'%)':'');if(a.length>1)s+=' +'+(a.length-1);return s;}
    var v=isTp?e.tp:e.stop;return v!=null?fmt(v):'—';};
  function lvlHit(d,e,m){if(e.status!=='open')return false;
    if(!((e.tps&&e.tps.length)||(e.sls&&e.sls.length)))return false;
    if(!(e.qty!=null&&isFinite(e.qty))&&!(+e.margin>0))return false; // legacy entries can't be split
    var px=ccPx(e.sym,m.live);if(!(px>0))return false;
    var long=m.long,dir=long?1:-1,changed=false;
    function slice(pct,exitPx,isTp){var f=Math.min(0.99,Math.max(0.01,pct/100));
      var part={};for(var k in e)if(Object.prototype.hasOwnProperty.call(e,k))part[k]=e[k];
      part.id=String(e.id)+'l'+Date.now().toString(36)+Math.floor(Math.random()*1e3);
      delete part.tps;delete part.sls;
      if(e.qty!=null&&isFinite(e.qty)){part.qty=e.qty*f;e.qty=e.qty*(1-f);}
      if(+e.margin>0){part.margin=+e.margin*f;e.margin=+e.margin*(1-f);}
      if(+e.notional>0){part.notional=+e.notional*f;e.notional=+e.notional*(1-f);}
      if(+e.fund){part.fund=+e.fund*f;e.fund=+e.fund*(1-f);}
      var pnl=(part.qty!=null&&isFinite(part.qty))?part.qty*(exitPx-e.entry)*dir:0;
      if(+part.margin>0&&pnl<-(+part.margin))pnl=-(+part.margin);
      part.status=pnl>=0?'win':'loss';part.exit=exitPx;part.closeTs=Date.now();part.pnl=pnl;part.partial=Math.round(f*100);
      d.push(part);
      try{if(window.mpLimitToast)window.mpLimitToast((isTp?'Take-profit':'Stop-loss')+' level filled — closed '+Math.round(f*100)+'% of '+String(e.sym||'')+' at '+fp(exitPx)+' · '+(pnl>=0?'+$':'−$')+Math.abs(pnl).toFixed(2));}catch(_){}
      try{buzz(isTp?[18,55,18]:[35]);}catch(_){}}
    function proc(arr,isTp){if(!arr||!arr.length)return arr;
      return arr.filter(function(L){var p=+L.p,pct=+L.pct||100;
        if(!(p>0)||pct>=100)return true; // 100% levels close through the legacy mirror in checkClose (touch-fill there)
        var hit=isTp?(long?px>=p:px<=p):(long?px<=p:px>=p);
        if(!hit)return true;
        slice(pct,p,isTp);changed=true;return false;});}
    e.tps=proc(e.tps,true);e.sls=proc(e.sls,false);
    if(changed)lvlSync(e);
    return changed;}
  function tick(){ensureChart();var d=load(),changed=false,closedAny=false;d.forEach(function(e){if(e.status==='open'){var _rp=prices[e.sym];if(!_rp||!(+_rp.p>0)||_rp.seed)return; /* ROOT FIX: no REAL feed price for this symbol → skip stops/levels/liquidation entirely. metrics() falls back to THIS trade's own entry, so 2 open trades on one coin push different values into the per-symbol spike filter ccPx()/_vpx and it returns the wrong (older) entry → phantom liquidation. Display P&L still uses the fallback; only decisions are gated. */var m=metrics(e);if(!(e.sls&&e.sls.length)&&manageStops(e,m))changed=true;if(lvlHit(d,e,m))changed=true;if(checkClose(e,m)){changed=true;closedAny=true;}}});if(changed){store(d);if(window.mpJournalRender)window.mpJournalRender();}
    if(closedAny)window._mpSltpHidden=true; // a position hit SL/TP/liq and closed → hide the SL/TP lines (they reappear only when a new trade is set up)
    if(document.documentElement.classList.contains('jr-open')&&window.innerWidth<721)return; // My Trades drawer covers the terminal on mobile — skip the invisible chart/position re-render to keep the main thread free (liquidation checks above still run)
    if(document.hidden||document.body.getAttribute('data-prod')!=='plan')return; // the liq/SL/TP protection loop above ALWAYS runs; skip the RENDER work (innerHTML rebuilds, chart price-line churn, layout reads) when the Paper Trade panel isn't the visible product or the tab is hidden — it used to rebuild the whole positions list + recreate every chart line EVERY SECOND on /calculators, /screener, /charts and backgrounded tabs
    liveCandle();chartHeader();renderPos();renderLastLive();mtCount();drawLines();/* drawLines() ends with updateZone(), so it's no longer called separately here (was running updateZone twice/tick). drawLines is now signature-diffed so it only churns chart price-lines when the open set changes. */
    try{posDragLines();}catch(e){}/* keep the draggable SL/TP lines aligned as the chart scrolls/scales — never let it break the lines above */}
  // real-time chart updates from the WebSocket feed (the forming candle, header price and liq zone follow every tick)
  var _rafC=false;
  document.addEventListener('mp:price',function(ev){if(!ev.detail||ev.detail.sym!==chartSym)return;if(document.hidden||document.body.getAttribute('data-prod')!=='plan')return;if(_rafC)return;_rafC=true;requestAnimationFrame(function(){_rafC=false;liveCandle();chartHeader();updateZone();renderLastLive();});});
  pollPrices();setInterval(pollPrices,3000);
  tick();setInterval(tick,1000);
  setInterval(function(){if(document.body.getAttribute('data-prod')==='plan'&&chart&&candle)refreshKlinesQuiet();},30000); // self-heal phantom wicks + any freeze by re-syncing with true klines every 30s
  /* CHART LIVENESS WATCHDOG — the permanent cure for "the chart stands still" (esp. on higher TFs like 5m where new bars are
     rare, so the per-new-bar autoscale re-assert almost never fires). Every 5s while the Paper Trade chart is visible:
     (1) re-assert autoScale so a locked/drifted price scale (data updating but chart LOOKS frozen) heals within 5s, not 60s;
     (2) if NO usable live price has reached the chart for >9s (WS+poll both stalled, or the spike-filter got stuck rejecting
         every tick), hard-recover: reset the spike filter, re-subscribe the WS, and refetch the candles. Covers every known
         freeze cause at the root, so it can't persist. */
  setInterval(function(){
    if(document.hidden||document.body.getAttribute('data-prod')!=='plan'||!chart||!candle)return;
    // re-assert autoScale ONLY when the realtime edge is in view (don't fight a user who scrolled back / zoomed into history)
    try{var vr=chart.timeScale().getVisibleLogicalRange();if(!vr||!bars.length||vr.to>=bars.length-2)chart.priceScale('right').applyOptions({autoScale:true});}catch(e){}
    var _pd=window.mpPlanLive,_srcT=Math.max((_pd&&_pd.sym===chartSym&&_pd.t)||0,(prices[chartSym]&&prices[chartSym].t)||0);
    if(!_srcT||Date.now()-_srcT>9000){_lgp=0;_rej=0;try{if(window.mpWS&&chartSym)(window.mpWS.resub||window.mpWS.sub)(chartSym);}catch(e){}try{pollPrices();}catch(e){}reloadKlinesThrottled();try{chart.timeScale().scrollToRealTime();}catch(e){}}
    // ALSO: catch a stalled CHART even when the price source LOOKS fresh — if the newest bar is more than ~1.5
    // intervals behind now, new bars stopped forming (the real "chart froze" symptom). Force a fresh klines sync.
    try{if(lastBar){var _ivS=parseInt(chartTf,10)*60,_nb=Math.floor(Date.now()/1000/_ivS)*_ivS;if(_nb-lastBar.time>_ivS*1.5)refreshKlinesQuiet();}}catch(e){}
  },5000);
  /* Overnight realism: while the tab is closed the live tick can't watch price, so a position left for hours
     never gets liquidated even if it blew through its liq level. On load (and when the tab regains focus) we
     replay each open trade against historical candles since it opened and liquidate any that crossed liq. */
  // Offline backfill: while the tab is away, checkClose can't watch price, so on return we replay candles since the
  // trade opened and close it at the FIRST of {SL, TP, liquidation} that the price reached — at that exact level. This
  // used to only detect liquidation, so a position that had hit its SL while you were away got wrongly liquidated for
  // the full margin instead of stopping out at the (smaller) SL loss.
  function sweepLiq(){var d=load(),open=d.filter(function(e){return e.status==='open'&&e.sym&&e.sym!=='—'&&e.entry>0;});if(!open.length)return;
    open.forEach(function(e){if((Date.now()-e.ts)<8*60000)return; // skip fresh trades — the live tick owns those (and we don't want a phantom insta-close right after open)
      var lng=e.side!=='short',liq=liqOf(e),ageH=(Date.now()-e.ts)/3600000;
      var stop=(e.stop!=null&&isFinite(+e.stop))?+e.stop:null,tp=(e.tp!=null&&isFinite(+e.tp))?+e.tp:null;
      // the loss-side exit hit FIRST on an adverse move: for a long the HIGHER of {SL, liq} (price passes it first going
      // down) — so an SL above liq caps at the SL, an SL below liq (or none) liquidates at liq. Mirror for a short.
      var lossExit=stop!=null?(lng?Math.max(stop,liq):Math.min(stop,liq)):liq, isLiq=(lossExit===liq);
      var tf=ageH>72?'1440':ageH>24?'240':ageH>6?'60':ageH>2?'30':'5'; // coarser interval for longer gaps so the returned candles still span the whole period
      fetch('/api/klines?symbol='+encodeURIComponent(e.sym)+'&interval='+tf,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){
        if(!kd||!kd.length)return;kd=sanitizeBars(kd);var cross=null,exitPx=null,liab=false;
        for(var i=0;i<kd.length;i++){var b=kd[i],bt=b.time*1000;if(bt<e.ts)continue; // only candles that START after the open — the open candle's pre-open wick must never close the position (2026-07-03 fix)
          // liq requires CLOSE-confirmation (a lone wick, esp. after an offline gap, must never liquidate); SL/TP are
          // touch orders and fill on the wick (sanitizeBars already clamped isolated bad prints).
          var lossHit=lng?(isLiq?(+b.low<=liq&&+b.close<=liq*1.03):(+b.low<=lossExit)):(isLiq?(+b.high>=liq&&+b.close>=liq*0.97):(+b.high>=lossExit));
          var tpHit=tp!=null&&(lng?+b.high>=tp:+b.low<=tp);
          if(!(lossHit||tpHit))continue;
          if(lossHit&&tpHit){var o=+b.open;if(Math.abs(o-lossExit)<=Math.abs(o-tp)){exitPx=lossExit;liab=isLiq;}else{exitPx=tp;liab=false;}} // both in one candle → the level closest to the open filled first
          else if(lossHit){exitPx=lossExit;liab=isLiq;}
          else{exitPx=tp;liab=false;}
          cross=Math.max(bt,e.ts);break;}
        if(cross==null)return;
        var d2=load(),idx=-1;for(var k=0;k<d2.length;k++){if(d2[k].id===e.id){idx=k;break;}}if(idx<0)return;var t=d2[idx];if(t.status!=='open')return;
        var dir=(t.side!=='short')?1:-1,pnl=(t.qty!=null&&isFinite(t.qty))?t.qty*(exitPx-t.entry)*dir:null;
        if(liab){pnl=(+t.margin>0)?-(+t.margin):pnl;t.liquidated=true;} else if(+t.margin>0&&pnl!=null&&pnl<-(+t.margin))pnl=-(+t.margin); // clamp any loss to −margin
        t.status=(pnl!=null&&pnl>0)?'win':'loss';t.exit=exitPx;t.pnl=pnl;t.closeTs=cross;notified[t.id]=true;
        store(d2);renderPos();renderLast();drawLines();mtCount();if(window.mpJournalRender)window.mpJournalRender();});});}
  sweepLiq();
  document.addEventListener('visibilitychange',function(){if(!document.hidden){sweepLiq();if(chart&&candle){try{chart.priceScale('right').applyOptions({autoScale:true});}catch(e){}reloadKlinesThrottled();try{refreshKlinesQuiet();}catch(e){}}}}); // on return from AFK: re-assert autoscale + force a fresh klines sync so a chart that "froze" while hidden recovers immediately (the throttled reload alone could skip)
  window.addEventListener('focus',function(){if(chart&&candle&&!document.hidden)reloadKlinesThrottled();});
})();

;/* ══════════ inline block from app/index.html line 3391 ══════════ */
/* Trading Journal — saved setups + results, all in localStorage */
(function(){
  var KEY='mp_journal';
  function MT(k,d){return (window.mpT&&window.mpT(k))||d;}
  function load(){try{return JSON.parse(localStorage.getItem(KEY))||[];}catch(e){return [];}}
  function store(a){try{localStorage.setItem(KEY,JSON.stringify(a));}catch(e){}}
  function esc(s){return String(s).replace(/[<>&]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}
  function money(x){x=+x||0;var n=x<0;x=Math.abs(x);var s=x>=1e12?(x/1e12).toFixed(2)+'T':x>=1e9?(x/1e9).toFixed(2)+'B':x>=1e6?(x/1e6).toFixed(2)+'M':x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});return (n?'-$':'$')+s;}
  function num(id){var e=document.getElementById(id);var v=e?parseFloat(e.value):NaN;return isFinite(v)?v:NaN;}
  var jrTab='open';
  var SHARE_SVG='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"></line><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"></line></svg>';
  var COPY_SVG='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
  var CHART_SVG='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;vertical-align:-1px"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/></svg>';
  var TRASH_SVG='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
  // Take the user from a My Trades ticket straight into Paper Trade with the chart loaded on that symbol/side
  function gotoChart(sym,side){
    if(/paper-page|charts-page|calc-page/.test(document.body.className)){var _u='/paper-trade'+(sym?'?coin='+encodeURIComponent(sym):'');if(window.mpGo){closeJr&&closeJr();window.mpGo(_u);}else{location.href=_u;}return;}
    closeJr();
    var psel=document.getElementById('planSym');
    if(psel&&sym){var u=String(sym).toUpperCase(),found=false;for(var o=0;o<psel.options.length;o++){if(psel.options[o].value.toUpperCase()===u){found=true;break;}}if(!found){var op=document.createElement('option');op.value=u;op.textContent=u;psel.appendChild(op);}psel.value=u;}
    var pt=document.querySelector('.prod[data-prod="plan"]');if(pt)pt.click();
    if(psel)psel.dispatchEvent(new Event('change',{bubbles:true}));
    if(side){var seg=document.getElementById('planSeg');if(seg){var sb=seg.querySelector('[data-side="'+side+'"]');if(sb&&!sb.classList.contains('on'))sb.click();}}
    setTimeout(function(){var card=document.querySelector('.card');if(card&&card.scrollIntoView)card.scrollIntoView({behavior:'smooth',block:'start'});},170);
  }
  function ppActions(e,close){return '<div class="pp-actions"><div class="pp-icons"><button class="pp-ic" data-act="share" data-id="'+e.id+'" title="'+MT('jShare','Share')+'" aria-label="'+MT('jShare','Share')+'">'+SHARE_SVG+'</button></div>'+(close?'<button class="pp-close" data-act="close" data-id="'+e.id+'">'+MT('jCloseBtn','Close')+'</button>':'')+'</div>';}
  function fp(x){x=+x||0;return '$'+x.toLocaleString('en-US',{maximumFractionDigits:x>=100?2:x>=1?4:8});}
  function pctS(x){return ((+x)>=0?'+':'')+(+x).toFixed(2)+'%';}
  function dur(ms){var s=Math.floor(ms/1000);if(s<60)return s+'s';var m=Math.floor(s/60);if(m<60)return m+'m';var h=Math.floor(m/60);if(h<24)return h+'h '+(m%60)+'m';return Math.floor(h/24)+'d '+(h%24)+'h';}
  function tsf(t){if(!t)return '';var d=new Date(t),MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return d.getDate()+' '+MO[d.getMonth()]+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
  function metrics(e){var px=window.mpLivePrices||{};var live=(px[e.sym]&&px[e.sym].p)||(e.status!=='open'&&e.exit)||e.entry;var long=e.side!=='short',lev=(+e.lev>0)?+e.lev:1;var move=(live-e.entry)/e.entry*(long?1:-1);var gross=(e.qty!=null&&isFinite(e.qty))?e.qty*(live-e.entry)*(long?1:-1):null;var pnl=(gross!=null)?gross-(+e.fund||0):null;/* P1: taker fee (feeRate/side) settled into P&L — legacy trades carry feeRate 0 so nothing changes for them */var margin=(+e.margin>0)?+e.margin:(e.notional&&lev?e.notional/lev:null);var roe=(pnl!=null&&margin>0)?pnl/margin:move*lev;var liq=e.liq||(long?e.entry*(1-(1-(e.mmr||0.005))/lev):e.entry*(1+(1-(e.mmr||0.005))/lev));var liqDist=(live-liq)/live*100*(long?1:-1);if(margin>0){var _op=e.status!=='win'&&e.status!=='loss';var _pf=_op?-margin*0.99:-margin;if(pnl!=null&&pnl<_pf)pnl=_pf;var _rf=_op?-0.99:-1;if(roe<_rf)roe=_rf;}/* open positions cap at -99% (never show -100% until actually liquidated/closed) */return {live:live,long:long,lev:lev,move:move,roe:roe,pnl:pnl,liq:liq,liqDist:liqDist,margin:margin};}
  function openCard(e){var m=metrics(e),long=m.long,cls=(m.pnl!=null?(m.pnl>0?'pf':(m.pnl<0?'ls':'be')):(m.move>0?'pf':(m.move<0?'ls':'be')));
    return '<div class="pp '+cls+(window.mpBalTkt(e)?' pp-gold':'')+'" data-id="'+e.id+'">'+ppActions(e,true)
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
    return '<div class="pp '+cls+(window.mpBalTkt(e)?' pp-gold':'')+'" data-id="'+e.id+'">'+ppActions(e)
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
    var url='https://marginpad.io/?p=plan';
    if(!navigator.clipboard){toast(MT('jCopyFail','Copy not supported'));return;}
    if(!window.ClipboardItem){navigator.clipboard.writeText(url).then(function(){toast(MT('jLinkCopied','Link copied'));},function(){});return;}
    try{
      var blobP=new Promise(function(res){var c=buildTicket(e);c.toBlob(function(b){res(b);},'image/png');});
      var item=new ClipboardItem({'image/png':blobP,'text/plain':new Blob([url],{type:'text/plain'})});
      navigator.clipboard.write([item]).then(function(){toast(MT('jImgLinkCopied','Image + link copied'));},function(){navigator.clipboard.writeText(url).then(function(){toast(MT('jLinkCopied','Link copied'));},function(){});});
    }catch(_){navigator.clipboard.writeText(url).then(function(){toast(MT('jLinkCopied','Link copied'));},function(){});}
  }
  function balCfg(){return (window.mpBal&&window.mpBal.cfg&&window.mpBal.cfg())||{on:false,start:10000,since:0,sid:''};}
  function balTags(){try{return JSON.parse(localStorage.getItem('mp_bal_tags')||'{}')||{};}catch(e){return {};}} // id -> sid map, survives ANY server journal sync (the e.bal field can be stripped when the server rewrites the journal for signed-in/premium users)
  function balMine(e,sid,tags){return !!(sid&&e&&(e.bal===sid||(tags&&tags[e.id]===sid)));}
  function balRealized(closed,sid,tags){return closed.reduce(function(s,e){return balMine(e,sid,tags)?s+(+e.pnl||0):s;},0);}
  function balOpenMargin(open,sid,tags){return open.reduce(function(s,e){return balMine(e,sid,tags)?s+(+e.margin||0):s;},0);}
  function balAvail(){var bm=balCfg();if(!bm.on)return null;var t=balTags(),data=load();var open=data.filter(function(e){return e.status==='open';});var closed=data.filter(function(e){return e.status==='win'||e.status==='loss';});return bm.start+balRealized(closed,bm.sid,t)-balOpenMargin(open,bm.sid,t);}
  window.mpBalAvail=balAvail; // exposed so the plan-form "Balance Mode ON" notice can show available margin
  document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-baltgl]');if(!t)return;e.preventDefault();e.stopPropagation();var c=(window.mpBal&&window.mpBal.cfg&&window.mpBal.cfg())||{on:false};if(!c.on&&window._mpPrem!==true){if(window.mpPremium&&window.mpPremium.show)window.mpPremium.show('Balance Mode');return;}if(window.mpBal&&window.mpBal.setCfg)window.mpBal.setCfg(!c.on);try{if(window.mpBuzz)window.mpBuzz([12]);}catch(_){}}); // My Trades Balance-Mode on/off toggle
  function balHasTagged(){var bm=balCfg();if(!bm.on||!bm.sid)return false;var t=balTags(),d=load();for(var i=0;i<d.length;i++)if(balMine(d[i],bm.sid,t))return true;return false;} // has this Balance Mode session actually opened any trade yet? (load() = this IIFE's journal loader; jload() lives in OTHER IIFEs and was undefined here → threw → dead open button whenever Balance Mode was ON)
  function balStrip(open,closed,unreal){var bm=balCfg();var prem=(window._mpPrem===true)||bm.on;if(!prem)return '';// show the card (with the on/off toggle) to premium members; hidden for everyone else
    var _tgl='<button type="button" class="bal-tgl'+(bm.on?' on':'')+'" data-baltgl="1" title="Balance Mode '+(bm.on?'ON':'OFF')+'" aria-label="Toggle Balance Mode"><span class="bal-tgl-k"></span></button>';
    if(!bm.on)return '<div class="jr-bal jr-bal-gold jr-bal-off"><div class="jrb-row" style="display:flex;align-items:center;gap:9px"><span style="font:700 9px \'Space Mono\',monospace;letter-spacing:.14em;color:#f0c35a">BALANCE MODE</span><span style="font-size:10.5px;color:#8a7a52;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">trade a real portfolio</span>'+_tgl+'</div></div>';
    var _t=balTags(),realized=balRealized(closed,bm.sid,_t),openMargin=balOpenMargin(open,bm.sid,_t),myUnreal=open.reduce(function(s,e){if(!balMine(e,bm.sid,_t))return s;var mm=metrics(e);return s+(mm.pnl||0);},0),equity=bm.start+realized+myUnreal,pl=equity-bm.start,plc=pl>=0?'#34d99a':'#ff7b72';// only Balance-Mode-tagged trades count toward realized/margin/equity
    function mK(n){n=+n||0;var g=n<0?'-':'',a=Math.abs(n);if(a>=1e12)return g+'$'+(a/1e12).toFixed(2).replace(/\.?0+$/,'')+'T';if(a>=1e9)return g+'$'+(a/1e9).toFixed(2).replace(/\.?0+$/,'')+'B';if(a>=1e6)return g+'$'+(a/1e6).toFixed(2).replace(/\.?0+$/,'')+'M';if(a>=1e4)return g+'$'+(a/1e3).toFixed(1).replace(/\.0$/,'')+'K';return g+'$'+a.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}// K/M/B/T so nothing overflows
    function cell(l,v,col){return '<div style="flex:1;min-width:0"><div style="font:11px \'Space Mono\',monospace;color:#5c6b84">'+l+'</div><div style="font:700 17px \'Space Mono\',monospace;color:'+(col||'#e9e7df')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+v+'</div></div>';}
    return '<div class="jr-bal jr-bal-gold">'
      +'<div class="jrb-row" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px"><span style="display:inline-flex;align-items:center;gap:8px;font:700 9px \'Space Mono\',monospace;letter-spacing:.14em;color:#f0c35a">BALANCE MODE'+_tgl+'</span><span style="display:inline-flex;align-items:center;gap:6px"><span style="font:11px \'Space Mono\',monospace;color:#5c6b84">all-time</span><span style="font:700 11px \'Space Mono\',monospace;color:'+plc+';background:'+(pl>=0?'rgba(52,217,154,.12)':'rgba(255,123,114,.13)')+';border-radius:20px;padding:2px 9px;white-space:nowrap">'+(pl>=0?'+':'')+(bm.start>0?(pl/bm.start*100).toFixed(1):'0')+'%</span></span></div>'
      +'<div class="jrb-row" style="font:800 26px \'Space Mono\',monospace;color:#f4cf7a;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;text-shadow:0 0 18px rgba(240,195,90,.28)">'+mK(equity)+'</div>'
      +'<div class="jrb-row" style="font:11px \'Space Mono\',monospace;color:#8a7a52;margin:0 0 10px">from '+mK(bm.start)+'</div>'
      +'<div class="jrb-row" style="display:flex;gap:14px;border-top:1px solid rgba(240,195,90,.18);padding-top:9px">'+cell('In trades',mK(openMargin))+cell('Available',mK(bm.start+realized-openMargin))+cell('Realized',(realized>=0?'+':'')+mK(realized),realized>=0?'#34d99a':'#ff7b72')+'</div></div>';}
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
    listEl.innerHTML=balStrip(open,closed,unreal)+'<div class="jr-tabs"><button data-jt="open" class="'+(jrTab==='open'?'on':'')+'">'+MT('jOpenN','Open')+' ('+open.length+')</button><button data-jt="closed" class="'+(jrTab==='closed'?'on':'')+'">'+MT('jClosedN','Closed')+' ('+closed.length+')</button></div>'+cards;
    if(emptyEl)emptyEl.style.display='none';
  }
  function add(){
    if(add._busy){ // 1s cooldown active — nudge the button so a repeat click reads as "just opened, one sec", never as a dead/broken button
      var _nb=document.getElementById('planSave'); if(_nb){_nb.classList.remove('cd-nudge');void _nb.offsetWidth;_nb.classList.add('cd-nudge');setTimeout(function(){_nb.classList.remove('cd-nudge');},340);} return; }
    add._busy=true; setTimeout(function(){add._busy=false;},1000); // 1s anti-spam lock (was a silent 650ms debounce) — paired with the visible cooldown bar below
    var pl=window.mpPlanLive, entry=pl&&pl.price;          // open AT the current live price
    var amt=num('planAmt'), lev=num('planLev');
    var _say=function(m){if(window.mpLimitToast)window.mpLimitToast(m);}; // honest micro-feedback: never swallow a click silently (UX audit: "enabled button that does nothing")
    if(isFinite(amt)&&amt>100000){amt=100000;var _ael=document.getElementById('planAmt');if(_ael)_ael.value='100000';_say('Max trade size is $100,000 — the amount was capped.');} // hard cap: max $100k per trade (owner rule)
    if(!isFinite(amt)||amt<=0){_say('Enter an amount (USD) above $0 to open a trade.');return;}
    if(!isFinite(entry)||entry<=0){_say('Waiting for the live price — try again in a second.');return;}
    var _bav=balAvail(); if(_bav!=null&&balHasTagged()&&_bav>0.5&&amt>_bav){amt=Math.max(1,Math.floor(_bav));var _pa=document.getElementById('planAmt');if(_pa)_pa.value=String(amt);_say('Balance Mode: capped to your available $'+amt.toLocaleString()+'.');} // Balance Mode only CAPS the size to what's left — it NEVER blocks the open button. A used-up balance just drives equity negative (shown red on the strip), like a real blow-up. Fixes the "nothing happens" dead-button for good.
    var seg=document.getElementById('planSeg'); var on=seg&&seg.querySelector('button.on'); var side=on?on.getAttribute('data-side'):'long';
    var symEl=document.getElementById('planSym'); var sym=((symEl&&symEl.value)||'').toUpperCase();
    // the live price MUST be a fresh reading for THIS exact symbol — a stale mpPlanLive, or one still holding the
    // previously-selected coin's price, would set a wrong entry → wrong liq → the trade "instantly liquidates / vanishes".
    if(!pl||pl.sym!==sym||!(+pl.price>0)||!pl.t||(Date.now()-pl.t)>3000){_say('Waiting for the live price for '+(sym||'this coin')+' — try again in a second.');add._busy=false;return;}
    entry=+pl.price;
    var L=isFinite(lev)&&lev>0?Math.min(lev,1000):1, mmr=(window.mpPlanMmr||0.005);
    var feeRate=num('planFee'); feeRate=(isFinite(feeRate)&&feeRate>=0)?feeRate/100:window.mpFeeRate(L); // default to a realistic 0.055% taker fee (matches the server-fill) so EVERY trade carries a fee — was 0, which made some closed tickets show no Fees line
    var sl=num('planSlOpt'), tp=num('planTpOpt'), trail=num('planTrail'), be=num('planBE');
    trail=(isFinite(trail)&&trail>0)?trail:0; be=(isFinite(be)&&be>0)?be:0;
    // Guard: a stop/target already on the WRONG side of the live entry would trigger the instant the position
    // opens (this is what made copied / stale screener setups self-close at open with a random-looking result).
    // Drop it — a long's stop must be below entry & target above; a short's the reverse.
    var _long=side==='long';
    // BLOCK the open while a typed SL/TP is on the wrong side of entry — matching the SL/TP edit modal. The old
    // behavior (strip it and open WITHOUT the stop) made the user's protective order silently vanish (UX audit
    // called it "the worst possible message for a risk-education product").
    var _bad=[];
    if(isFinite(sl)&&((_long&&sl>=entry)||(!_long&&sl<=entry)))_bad.push('stop-loss');
    if(isFinite(tp)&&((_long&&tp<=entry)||(!_long&&tp>=entry)))_bad.push('take-profit');
    if(_bad.length){_say('Your '+_bad.join(' and ')+' is on the wrong side of the entry price — fix it (or clear the field) to open the trade.');try{if(window.mpPlanRisk)window.mpPlanRisk();}catch(e){}return;}
    var notional=amt*L, qty=notional/entry;
    var liq=side==='long'?entry*(1-(1-mmr)/L):entry*(1+(1-mmr)/L);  // always on the correct side of entry, even at extreme leverage
    var stop=isFinite(sl)?sl:null;                          // optional user SL; the position still auto-liquidates at `liq`
    var rr=(isFinite(tp)&&isFinite(sl))?Math.abs(tp-entry)/Math.abs(entry-sl):NaN;
    if(window.mpTradeGate&&!window.mpTradeGate(sym,side))return; // enforce open-trade limits + one-way mode (no long+short hedge)
    /* P0 dual-write: signed-in opens are SERVER-FILLED (/api/trade/open) — the server takes its own live
       price and writes the trade into the account journal (src:'srv'). We insert the SERVER position (same
       id!) locally so the UI is instant and the 12s sync/pull merge is idempotent. Timeout or any error →
       the classic local open below, so trading never blocks on the network. Anonymous users: local as always. */
    var _tLocal={id:String(Date.now())+'_'+Math.floor(Math.random()*1e4),ts:Date.now(),sym:sym||'—',side:side,entry:entry,stop:stop,tp:isFinite(tp)?tp:null,trail:trail,be:be,hwm:entry,lev:L,rr:isFinite(rr)?rr:null,qty:qty,notional:notional,margin:amt,riskAmt:amt,liq:liq,mmr:mmr,feeRate:feeRate,status:'open',pnl:null};
    var _finishOpen=function(t){
      try{if(window.mpBal&&window.mpBal.tag)window.mpBal.tag(t);}catch(_){} // stamp the trade with the current Balance Mode session so it (and only it) counts toward the balance
      var data=load();
      data.push(t);
      if(window.mpLivePrices&&sym)window.mpLivePrices[sym]={p:t.entry,t:Date.now()}; // start P&L at exactly 0 — kills the phantom -100% / instant-liquidation at open
      store(data); window._mpLastOpenTs=Date.now(); /* shows live in the My Trades drawer — no popup; stamp the open so the ticket pop only fires for a REAL open */
    try{if(window.mpLevWarn)window.mpLevWarn(L);}catch(e){} // extreme-leverage nudge (throttled)
    if(window.mpBuzz)window.mpBuzz([15]); // haptic on open (this IIFE has no local buzz — use the global)
    try{if(window.mpCheckGrad)window.mpCheckGrad();}catch(e){}
    var btn=document.getElementById('planSave'),sp=btn&&btn.querySelector('span');
    if(btn&&sp){var o=sp.textContent;btn.classList.add('saved','cooldown');sp.textContent=MT('jOpened','Position opened \u2713');setTimeout(function(){btn.classList.remove('cooldown');},1000);setTimeout(function(){sp.textContent=o;btn.classList.remove('saved');},1120);}
    try{if(window.__mpTrack){window.__mpTrack('paper',(sym||'?')+' '+side);window.__mpTrack('plev',L<=5?'1-5x':L<=20?'5-20x':L<=50?'20-50x':L<=100?'50-100x':'100x+');}}catch(e){}
      try{drawLines();}catch(e){} // async server path finishes after add() returns — draw lines here too
    };
    var _me=null;try{_me=window.mpAuth&&window.mpAuth.me&&window.mpAuth.me();}catch(_){ }
    if(_me&&window.fetch){
      var _ac=(typeof AbortController!=='undefined')?new AbortController():null;
      var _to=setTimeout(function(){try{if(_ac)_ac.abort();}catch(_){}},1400);
      fetch('/api/trade/open',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',signal:_ac?_ac.signal:undefined,body:JSON.stringify({sym:sym,side:side,lev:L,margin:amt,sl:stop,tp:isFinite(tp)?tp:null})})
        .then(function(r){return r.json();})
        .then(function(d2){clearTimeout(_to);
          if(d2&&d2.ok&&d2.position&&d2.position.id){var t=d2.position;t.trail=trail;t.be=be;t.hwm=t.entry;t.feeRate=feeRate;t.rr=isFinite(rr)?rr:null;_finishOpen(t);}
          else{_finishOpen(_tLocal);}
        })
        .catch(function(){clearTimeout(_to);_finishOpen(_tLocal);});
    }else{_finishOpen(_tLocal);}
    try{drawLines();}catch(e){} // draw the entry/liq lines the instant the position opens (don't wait for the next 1s tick)
  }
  var saveBtn=document.getElementById('planSave'); if(saveBtn)saveBtn.addEventListener('click',add);
  // ticket + tab actions are delegated to document — the list lives in the drawer, which parses after this script
  document.addEventListener('click',function(ev){
    var b=ev.target.closest&&ev.target.closest('#jrList [data-act], #jrList [data-jt]'); if(!b)return;
    if(b.hasAttribute('data-jt')){jrTab=b.getAttribute('data-jt');render();return;}
    var id=b.getAttribute('data-id'),act=b.getAttribute('data-act');
    var data=load(),i=-1; for(var k=0;k<data.length;k++){if(data[k].id===id){i=k;break;}} if(i<0)return; var e=data[i];
    if(act==='share'){shareTicket(e);return;}
    if(act==='copy'){copyTicket(e);return;}
    if(act==='chart'){var _cs=String(e.sym||'').toUpperCase();closeJr();if(window.matchMedia&&window.matchMedia('(max-width:880px)').matches){if(window.mpOpenMobileCharts){window.mpOpenMobileCharts(_cs);}else{try{sessionStorage.setItem('mp_force_chart',_cs);}catch(_){}location.href='/charts';}return;}try{sessionStorage.setItem('mp_force_chart',_cs);}catch(_){}if(window.mpGo)window.mpGo('/charts');else location.href='/charts';var _t=0,_iv=setInterval(function(){_t++;var _c=null;try{_c=sessionStorage.getItem('mp_force_chart');}catch(_){}if(!_c){clearInterval(_iv);return;}if(window.mpCharts&&window.mpCharts.openOnly){clearInterval(_iv);try{sessionStorage.removeItem('mp_force_chart');}catch(_){}window.mpCharts.openOnly(_c);}else if(_t>25){clearInterval(_iv);}},120);return;}    if(act==='ptrade'){var _pu='/paper-trade?coin='+encodeURIComponent(String(e.sym||'').toUpperCase())+(e.side?'&side='+(e.side==='short'?'short':'long'):'');closeJr();if(window.mpGo)window.mpGo(_pu);else location.href=_pu;return;}
    if(act==='sltp'){if(window.mpSltpSheet)window.mpSltpSheet(id,function(){render();if(window.mpDrawLines)window.mpDrawLines();});return;}
    if(act==='del'){ if(!confirm(MT('jDelConfirm','Are you sure you want to delete this trade?')))return; data.splice(i,1); }
    else if(act==='close'){ if(window.mpCloseSheet){window.mpCloseSheet(id,function(){render();if(window.mpDrawLines)window.mpDrawLines();});return;} var m=metrics(e); e.status=(m.pnl!=null?(m.pnl>=0?'win':'loss'):(m.move>=0?'win':'loss')); e.exit=m.live; e.closeTs=Date.now(); e.pnl=(m.pnl!=null?m.pnl:0); if(window.mpBuzz)window.mpBuzz([22]); try{if(window.mpHidePlanLines)window.mpHidePlanLines();}catch(_){} }
    else if(act==='reopen'){ e.status='open'; e.exit=null; e.closeTs=null; e.pnl=null; }
    else if(act==='edit'){ var ns=prompt(MT('jNewSL','New stop-loss price:'),e.stop); if(ns!==null){var v=parseFloat(ns);if(isFinite(v))e.stop=v;} var nt=prompt(MT('jNewTP','New take-profit (blank = none):'),e.tp!=null?e.tp:''); if(nt!==null){var v2=parseFloat(nt);e.tp=isFinite(v2)?v2:null;} }
    store(data); render(); if(window.mpDrawLines)window.mpDrawLines();
  });
  // look up the drawer lazily so it works no matter when this script ran relative to the markup
  var jrTimer=null;
  // auto-refresh that yields to the pointer: skip the full rebuild while a control is hovered, so clicks aren't lost and hover doesn't flicker
  var _jrTouchT=0;
  // On touch there is NO :hover, so the 1s interval + mp:price re-render rebuilds #jrList innerHTML between touchstart and
  // the synthesized click → the tapped button (Close/Chart) is destroyed mid-tap and the click is lost. Pin the list for
  // ~800ms after any pointer/touch lands on it so a live re-render can't swallow the tap. (Desktop already had the :hover guard.)
  var _jrSig='';
  function renderLive(){var d=document.getElementById('jrDrawer');if(!d||d.hidden)return;if(Date.now()-_jrTouchT<800)return;if(d.querySelector('button:hover,a:hover,[data-act]:hover,[data-jt]:hover'))return;
    // structural sig-diff: full innerHTML rebuild ONLY when a card appears/disappears or the tab changes; otherwise
    // update the price-driven fields in place. The old every-second rebuild flashed the whole drawer + restarted
    // card transitions the entire time it was open.
    var data=load(),open=data.filter(function(e){return e.status==='open';});
    var sig=jrTab+'|'+open.map(function(e){return e.id;}).join(',')+'|'+(data.length-open.length);
    if(sig!==_jrSig){_jrSig=sig;render();return;}
    var listEl=document.getElementById('jrList'),statsEl=document.getElementById('jrStats');
    if(statsEl){var closed=data.filter(function(e){return e.status==='win'||e.status==='loss';});var wins=closed.filter(function(e){return e.status==='win';}).length;var wr=closed.length?Math.round(wins/closed.length*100):null;var realized=closed.reduce(function(s,e){return s+(+e.pnl||0);},0);var unreal=open.reduce(function(s,e){var mm=metrics(e);return s+(mm.pnl||0);},0);
      var vs=statsEl.querySelectorAll('.jr-stat .v');if(vs.length>=4){vs[1].textContent=(unreal>=0?'+':'−')+money(Math.abs(unreal)).replace('-','');vs[1].style.color=unreal>=0?'#34d99a':'#ff7b72';vs[3].textContent=(realized>=0?'+':'−')+money(Math.abs(realized)).replace('-','');}}
    if(listEl&&jrTab==='open')open.forEach(function(e){var card=listEl.querySelector('.pp[data-id="'+e.id+'"]');if(!card)return;var m=metrics(e);
      var pnlc=(m.pnl!=null?(m.pnl>0?'pf':(m.pnl<0?'ls':'be')):(m.move>0?'pf':(m.move<0?'ls':'be')));if(!card.classList.contains(pnlc)){card.classList.remove('pf','ls','be');card.classList.add(pnlc);} // swap ONLY the pnl class — wholesale className= dropped pp-gold every tick (2nd copy: the My Trades drawer, same flicker as the terminal list)
      var lv=card.querySelector('.pp-live');if(lv){var lvv=(e.lev||1)+'× · '+fp(m.live);if(lv.textContent!==lvv)lv.textContent=lvv;}
      var big=card.querySelector('.big');if(big){var bv=(m.pnl!=null?((m.pnl>=0?'+':'−')+money(Math.abs(m.pnl)).replace('-','')):pctS(m.move*100));if(big.textContent!==bv)big.textContent=bv;}
      var roe=card.querySelector('.roe');if(roe){var rv='ROE '+pctS(m.roe*100);if(roe.textContent!==rv)roe.textContent=rv;}
      var bb=card.querySelector('.ppb');if(bb){var bbv=pctS(m.liqDist);if(bb.textContent!==bbv)bb.textContent=bbv;}
    });}
  var _jrScrollY=0,_jrLocked=false;
  function jrLockBody(){if(window.innerWidth<721&&!_jrLocked){_jrScrollY=window.scrollY||window.pageYOffset||0;document.body.style.top=(-_jrScrollY)+'px';document.documentElement.classList.add('jr-lock');_jrLocked=true;}}
  function jrUnlockBody(){if(_jrLocked){document.documentElement.classList.remove('jr-lock');document.body.style.top='';_jrLocked=false;window.scrollTo(0,_jrScrollY);}}
  function openJr(){var d=document.getElementById('jrDrawer'),b=document.getElementById('jrBackdrop');if(d)d.hidden=false;if(b)b.hidden=false;document.documentElement.classList.add('jr-open');jrLockBody();render();if(jrTimer)clearInterval(jrTimer);jrTimer=setInterval(renderLive,1000);}
  window.mpOpenTrades=openJr; // mp-nav's mobile bottom-bar "Trades" prefers this over navigating (mobile white-flash fix 2026-07-13 — mp-trade.js already exported it, the app shell didn't)
  function closeJr(){var d=document.getElementById('jrDrawer'),b=document.getElementById('jrBackdrop');if(d)d.hidden=true;if(b)b.hidden=true;document.documentElement.classList.remove('jr-open');jrUnlockBody();if(jrTimer){clearInterval(jrTimer);jrTimer=null;}}
  // PC: wheel over the drawer must never scroll the page behind it (overscroll-behavior covers scroll-chaining;
  // this also handles a short/empty drawer that isn't scrollable at all).
  (function(){var d=document.getElementById('jrDrawer');if(!d)return;d.addEventListener('wheel',function(e){var noScroll=d.scrollHeight<=d.clientHeight+1,atTop=d.scrollTop<=0,atBot=d.scrollTop+d.clientHeight>=d.scrollHeight-1;if(noScroll||(e.deltaY<0&&atTop)||(e.deltaY>0&&atBot))e.preventDefault();},{passive:false});})();
  // Close on pointerdown (fires at touch-start, before the synthesized click) so the drawer dismisses instantly
  // even when the Paper Trade tick / live render has the main thread busy — fixes the mobile "tap close → ~1s lag".
  // Swallow the ghost mousedown+click that the same tap fires AFTER the drawer is hidden — otherwise it lands on
  // whatever is now under the finger (the language <select> sits top-right, exactly under the close ✕) and opens it.
  function swallowGhost(){
    var killM=function(ev){if(ev.target&&ev.target.closest&&ev.target.closest('.mobnav,[data-mn],[data-mytrades]')){document.removeEventListener('mousedown',killM,true);return;} /* never swallow a deliberate nav/My-Trades tap */ ev.preventDefault();ev.stopPropagation();document.removeEventListener('mousedown',killM,true);};
    var killC=function(ev){if(ev.target&&ev.target.closest&&ev.target.closest('.mobnav,[data-mn],[data-mytrades]')){document.removeEventListener('click',killC,true);return;} ev.preventDefault();ev.stopPropagation();document.removeEventListener('click',killC,true);};
    document.addEventListener('mousedown',killM,true);
    document.addEventListener('click',killC,true);
    setTimeout(function(){document.removeEventListener('mousedown',killM,true);document.removeEventListener('click',killC,true);},700);
  }
  document.addEventListener('pointerdown',function(e){var t=e.target;if(!t||!t.closest)return;
    if(t.closest('#jrList'))_jrTouchT=Date.now(); // pin the list while the finger is down so a live re-render can't destroy the button mid-tap
    if(t.closest('#jrClose,[data-jr-close]')||(t.id==='jrBackdrop'&&window.innerWidth<721)){closeJr();swallowGhost();}
  },true);
  document.addEventListener('touchstart',function(e){var t=e.target;if(t&&t.closest&&t.closest('#jrList'))_jrTouchT=Date.now();},{capture:true,passive:true});
  document.addEventListener('click',function(e){var t=e.target;if(!t)return;
    if(t.closest&&t.closest('[data-mytrades]')){var dd=document.getElementById('jrDrawer');if(dd&&!dd.hidden)closeJr();else openJr();} // toggle: re-click closes
    else if(t.closest&&t.closest('#jrClose,[data-jr-close]'))closeJr();
    else if(t.id==='jrBackdrop'&&window.innerWidth<721)closeJr(); // click-outside closes on mobile only; on PC use the X or re-click My Trades
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeJr();});
  var _jrPend=null;
  window.mpJournalRender=function(){var d=document.getElementById('jrDrawer');if(d&&!d.hidden){if(Date.now()-_jrTouchT<800){clearTimeout(_jrPend);_jrPend=setTimeout(render,820);}else render();}try{if(window.mpActivationNudge)window.mpActivationNudge();}catch(e){}}; // defer the live re-render past a finger-down so it can't destroy a Close/Chart button mid-tap
  // live P&L: re-render the open drawer on each price tick (throttled to ~4/s so the list doesn't thrash)
  var _jrLast=0;
  document.addEventListener('mp:price',function(){var d=document.getElementById('jrDrawer');if(!d||d.hidden)return;var now=(window.performance&&performance.now)?performance.now():+new Date();if(now-_jrLast<800)return;_jrLast=now;renderLive();});
  render();
  if(/[?&]trades=1/.test(location.search)){window.addEventListener('load',function(){try{openJr();}catch(e){}});} // deep-link: /?trades=1 opens My Trades — deferred to load because the drawer markup is parsed after this script
})();

;/* ══════════ inline block from app/index.html line 3609 ══════════ */
/* Real-time price feed — a single Bybit USDT-perp (linear) WebSocket streaming whatever symbols the user views.
   Updates window.mpLivePrices and fires a 'mp:price' event on every tick (sub-100ms), so the Paper Trade
   price, chart candle and live P&L feel instant. REST polling stays as a fallback if the socket is down. */
(function(){
  if(!('WebSocket'in window))return;
  var BASE=['BTC','ETH','SOL','XRP','BNB','DOGE','ADA','AVAX'];
  window.mpLivePrices=window.mpLivePrices||{};
  window.mpHist=window.mpHist||{};
  var ws=null,alive=false,retry=0,pingT=null,lastH={},chgMap={};
  // stream whatever the user actually looks at (chart/paper-trade symbol, open positions) — not just a fixed 8.
  var want={},order=[],MAXW=44;
  BASE.forEach(function(s){want[s]=1;order.push(s);});
  function clean(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
  function argsFor(syms){var a=[];syms.forEach(function(s){a.push('publicTrade.'+s+'USDT');a.push('tickers.'+s+'USDT');});return a;}
  function sendOp(op,syms){if(!ws||ws.readyState!==1||!syms.length)return;var a=argsFor(syms);for(var i=0;i<a.length;i+=10){try{ws.send(JSON.stringify({op:op,args:a.slice(i,i+10)}));}catch(_){}}}
  function ensureSub(sym){sym=clean(sym);if(!sym||want[sym])return;want[sym]=1;order.push(sym);
    if(order.length>MAXW){for(var i=0;i<order.length;i++){var os=order[i];if(BASE.indexOf(os)<0){order.splice(i,1);delete want[os];sendOp('unsubscribe',[os]);break;}}} // evict oldest dynamic symbol so we never grow unbounded
    sendOp('subscribe',[sym]);}
  window.mpWS={sub:ensureSub,resub:function(sym){sym=clean(sym);if(!sym)return;try{sendOp('unsubscribe',[sym]);}catch(_){}delete want[sym];var i=order.indexOf(sym);if(i>=0)order.splice(i,1);ensureSub(sym);}}; // resub = force a real re-subscribe (ensureSub short-circuits when already subscribed, so it can't recover a topic Bybit silently dropped)
  function pushHist(sym,price){var now=Date.now();if(now-(lastH[sym]||0)<1000)return;lastH[sym]=now;var h=window.mpHist[sym]||(window.mpHist[sym]=[]);h.push(price);if(h.length>46)h.shift();}
  var lastTick=Date.now(), lastWsTick=Date.now(), reT=null, connT=null; // lastWsTick = WS-only freshness (REST bridge must NOT refresh it, or a dead socket looks alive)
  function emit(sym,price,chg){
    lastTick=Date.now();
    try{window.__mpWsSeen[sym]=Date.now();}catch(_){} // TEMP pxtag: mark this symbol as WS-covered (see __mpPQ) — DELETE with the pxtag round
    var prev=window.mpLivePrices[sym]||{};
    window.mpLivePrices[sym]={p:price,t:Date.now(),chg:(chg!=null&&isFinite(chg))?chg:prev.chg};
    pushHist(sym,price);
    try{document.dispatchEvent(new CustomEvent('mp:price',{detail:{sym:sym,price:price,chg:window.mpLivePrices[sym].chg}}));}catch(_){}
  }
  // Coalesce: high-volume symbols (BTC/ETH on perp) fire hundreds of trades/sec. Stage the latest price per symbol and
  // flush once per animation frame, so each symbol emits ≤~60×/sec (newest price) instead of flooding the main thread.
  var pend={},pendSched=false;
  function stage(sym,price,chg){if(!(price>0))return;lastTick=Date.now();lastWsTick=Date.now();pend[sym]={p:price,c:chg};if(!pendSched){pendSched=true;requestAnimationFrame(flushPend);}}
  function flushPend(){pendSched=false;var p=pend;pend={};for(var s in p)emit(s,p[s].p,p[s].c);}
  function connect(){
    if(connT){clearTimeout(connT);connT=null;}
    try{ws=new WebSocket('wss://stream.bybit.com/v5/public/linear');}catch(e){return reconnect();}/* USDT-perp stream: covers TRX & virtually every pair (spot was missing many) + matches futures pricing */
    connT=setTimeout(function(){connT=null;if(!ws||ws.readyState!==1){try{ws&&(ws.onclose=null,ws.close());}catch(_){}reconnect();}},10000); // handshake stuck in CONNECTING (mobile radio hand-off / captive portal) never fires onopen/onclose → force a retry
    ws.onopen=function(){alive=true;retry=0;lastWsTick=Date.now();if(connT){clearTimeout(connT);connT=null;}try{if(window.__mpWsDownT){window.__mpUxm&&window.__mpUxm('rc',Date.now()-window.__mpWsDownT);window.__mpWsDownT=0;}}catch(e){}sendOp('subscribe',order.slice()); // (re)subscribe every wanted symbol (base + dynamic) on connect/reconnect — sendOp chunks at 10/req
      if(pingT)clearInterval(pingT);pingT=setInterval(function(){try{ws.send(JSON.stringify({op:'ping'}));}catch(_){}},18000);};
    ws.onmessage=function(ev){try{var m=JSON.parse(ev.data);if(m.ts&&isFinite(+m.ts)){var _wl=Date.now()-(+m.ts);if(_wl>-2000&&_wl<30000){var _ww=window.__mpWsLatW;if(!_ww||Date.now()-_ww.t>60000){window.__mpWsLatW={t:Date.now(),v:_wl};}else if(_wl<_ww.v){_ww.v=_wl;}window.__mpWsLat=(window.__mpWsLatW||{}).v;}}if(!m.topic)return;
      if(m.topic.indexOf('publicTrade.')===0&&Array.isArray(m.data)&&m.data.length){var sym=m.topic.slice(12).replace('USDT','');var p=parseFloat(m.data[m.data.length-1].p);if(isFinite(p))stage(sym,p,chgMap[sym]);} // every trade → staged + coalesced per frame
      else if(m.topic.indexOf('tickers.')===0&&m.data){var sym2=m.topic.slice(8).replace('USDT','');var lp=parseFloat(m.data.lastPrice);var chg=(m.data.price24hPcnt!=null&&m.data.price24hPcnt!=='')?parseFloat(m.data.price24hPcnt)*100:null;if(chg!=null&&isFinite(chg))chgMap[sym2]=chg;if(isFinite(lp))stage(sym2,lp,chgMap[sym2]);} // 24h change %
    }catch(_){}};
    ws.onclose=function(){alive=false;try{if(!window.__mpWsDownT)window.__mpWsDownT=Date.now();}catch(e){}if(pingT){clearInterval(pingT);pingT=null;}if(connT){clearTimeout(connT);connT=null;}reconnect();};
    ws.onerror=function(){try{ws.close();}catch(_){}reconnect();}; // some mobile webviews fire onerror WITHOUT a following onclose → reconnect here too (reconnect() is self-guarded against stacking)
  }
  function reconnect(){if(reT)return;retry=Math.min(retry+1,6);reT=setTimeout(function(){reT=null;connect();},[250,900,2500,5000,8000,8000][retry-1]||8000);} // fast first retry (250ms — ws-recon budget is 1s), then exponential; guarded: never stack multiple reconnects
  function kick(){ // force a brand-new socket NOW (dead/stuck one) — used by the watchdog / resume / online
    try{if(ws){ws.onclose=null;ws.close();}}catch(_){}
    ws=null;if(reT){clearTimeout(reT);reT=null;}if(connT){clearTimeout(connT);connT=null;}retry=0;connect();
  }
  connect();
  // Watchdog: key off lastWsTick (WS-ONLY freshness — the REST bridge below must NOT mask a dead socket). If the WS itself
  // has delivered nothing for >8s while visible AND we're not already (re)connecting, force a fresh socket regardless of
  // readyState (covers CONNECTING/CLOSING/CLOSED that the old readyState===1 check ignored). Then bridge with a REST poll.
  setInterval(function(){
    if(document.hidden)return;
    if(!connT&&!reT&&Date.now()-lastWsTick>8000)kick();
    if(Date.now()-lastTick>7000){ // prices haven't moved from ANY source in 7s → bridge with REST so the UI never fully freezes while the socket re-establishes
      order.slice(-4).forEach(function(s){fetch('/api/price?symbol='+encodeURIComponent(s)+window.__mpPQ('wsrc',s),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){if(j&&+j.price>0)emit(s,+j.price,(j.chg!=null?+j.chg:undefined));}).catch(function(){});});
    }
  },3000);
  function onResume(){if(Date.now()-lastWsTick>5000&&!connT&&!reT)kick();} // returned to a stale tab / bfcache restore → new socket now
  document.addEventListener('visibilitychange',function(){if(!document.hidden)onResume();});
  window.addEventListener('pageshow',function(e){if(e&&e.persisted)onResume();}); // iOS bfcache restore doesn't always fire visibilitychange
  window.addEventListener('online',function(){kick();}); // network restored (sleep/wake, wifi↔cellular) → reconnect immediately
})();

;/* ══════════ inline block from app/index.html line 3666 ══════════ */
/* Lazy-load the heavy TradingView embeds — inject each widget's script only when it scrolls near view.
   The below-fold advanced chart often never loads at all, saving a large third-party payload on most visits. */
(function(){
  function loadTV(c){var cfg=c.querySelector('.tv-cfg'),type=c.getAttribute('data-tv');if(!cfg||!type||c.getAttribute('data-tv-done'))return;c.setAttribute('data-tv-done','1');var s=document.createElement('script');s.type='text/javascript';s.async=true;s.src='https://s3.tradingview.com/external-embedding/embed-widget-'+type+'.js';s.textContent=cfg.textContent.trim();c.appendChild(s);}
  var els=document.querySelectorAll('.tradingview-widget-container[data-tv]');
  if(!els.length)return;
  if(!('IntersectionObserver'in window)){Array.prototype.forEach.call(els,loadTV);return;}
  var io=new IntersectionObserver(function(ents){ents.forEach(function(e){if(e.isIntersecting){loadTV(e.target);io.unobserve(e.target);}});},{rootMargin:'300px'});
  Array.prototype.forEach.call(els,function(c){io.observe(c);});
})();

;/* ══════════ inline block from app/index.html line 3678 ══════════ */
(function(){
  var CLARITY_ID = ''; // set to a Microsoft Clarity project ID for visual click heatmaps + recordings
  var ADS_CONV_LABEL = ''; // Google Ads conversion label for affiliate clicks — paste the label from your conversion action (e.g. 'abCdEf1gH'); leave '' until created
  if (CLARITY_ID) { (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,'clarity','script',CLARITY_ID); }
  // Accurate traffic source: referrer alone is empty for most real traffic (app webviews, referrer-policy stripping,
  // typed/bookmark, PWA, and paid ad clicks). Compute the ENTRY source once per session from URL campaign params
  // (gclid = Google Ads, utm_source, fbclid, ref) FIRST, then the external referrer host — persisted so internal hops keep it.
  function mpEntrySrc(){
    try{
      var s=sessionStorage.getItem('mp_src'); if(s!==null)return s;
      var q; try{q=new URLSearchParams(location.search||'');}catch(_){q=null;}
      var src='';
      if(q){
        if(q.get('gclid')||q.get('gbraid')||q.get('wbraid'))src='google-ads';
        else if(q.get('msclkid'))src='bing-ads';
        else if(q.get('utm_source')){src=q.get('utm_source')+(q.get('utm_medium')?' / '+q.get('utm_medium'):'');}
        else if(q.get('fbclid'))src='facebook';
        else if(q.get('twclid'))src='twitter';
        else if(q.get('ttclid'))src='tiktok';
        else if(q.get('ref'))src=q.get('ref');
      }
      if(!src&&document.referrer){try{var h=new URL(document.referrer).hostname.replace(/^www\./,'');if(h&&h!=='marginpad.io')src=h;}catch(_){}}
      src=(src||'').slice(0,40);
      try{sessionStorage.setItem('mp_src',src);}catch(_){}
      return src;
    }catch(_){return '';}
  }
  window.mpEntrySrc=mpEntrySrc;
  function send(t,e){
    try{
      var u='/api/track?t='+encodeURIComponent(t)+(e?'&e='+encodeURIComponent(e):'')+'&p='+encodeURIComponent(location.pathname);
      if(t==='pageview'){
        if(document.referrer){u+='&r='+encodeURIComponent(document.referrer);}
        try{var _es=mpEntrySrc();if(_es)u+='&src='+encodeURIComponent(_es);}catch(_){}
        try{var lp=sessionStorage.getItem('mp_lastpath');if(lp&&lp!==location.pathname)u+='&f='+encodeURIComponent(lp);sessionStorage.setItem('mp_lastpath',location.pathname);}catch(_){}
      }
      if(navigator.sendBeacon){navigator.sendBeacon(u);}else{fetch(u,{keepalive:true});}
      if(window.clarity){window.clarity('event', t+(e?':'+e:''));}
    }catch(_){}
    // Google Ads / GA4 conversion signal on affiliate (exchange) clicks — the revenue proxy the campaign optimises toward
    if(t==='exchange'&&window.gtag){try{gtag('event','affiliate_click',{exchange:e||'',page:location.pathname});if(ADS_CONV_LABEL){gtag('event','conversion',{send_to:'AW-18230384038/'+ADS_CONV_LABEL});}}catch(_){}}
  }
  send('pageview');
  window.__mpTrack=send;
  // log nav-bar taps (Browse / Practice / Trades / Chat) so the admin sees WHEN visitors use the nav bar, not just which pages load
  document.addEventListener('click',function(e){try{var mn=e.target.closest&&e.target.closest('.mobnav [data-mn]');if(mn)send('nav',(mn.getAttribute('aria-label')||mn.getAttribute('data-mn')||'nav').slice(0,24));}catch(_){}},true);
  // in-page product switches (Calc/Heatmap/Swap/Paper Trade/Charts on the homepage) don't reload, so fire a virtual
  // pageview for them too — same nav stream as real page loads, carrying where the visitor came from (&f).
  function navTo(path){try{var from=null;try{from=sessionStorage.getItem('mp_lastpath');}catch(_){}if(from===path)return;var u='/api/track?t=pageview&p='+encodeURIComponent(path)+(from?('&f='+encodeURIComponent(from)):'');if(navigator.sendBeacon){navigator.sendBeacon(u);}else{fetch(u,{keepalive:true});}try{sessionStorage.setItem('mp_lastpath',path);}catch(_){}}catch(_){}}
  window.__mpNav=navTo;
  // scroll depth — fire once per 25/50/75/100% threshold
  (function(){var hit={};function s(){var st=window.scrollY||document.documentElement.scrollTop||0,dh=(document.documentElement.scrollHeight-window.innerHeight)||1,pct=st/dh*100;[25,50,75,100].forEach(function(t){if(pct>=t&&!hit[t]){hit[t]=1;send('scroll',String(t));}});}window.addEventListener('scroll',s,{passive:true});})();
  // time on page — bucketed, sent once when the tab is hidden/closed
  (function(){var t0=Date.now(),sent=false;function leave(){if(sent)return;sent=true;var x=Math.round((Date.now()-t0)/1000);send('time',x<10?'0-10s':x<30?'10-30s':x<60?'30-60s':x<180?'1-3m':x<600?'3-10m':'10m+');}document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')leave();});window.addEventListener('pagehide',leave);})();
  // human-readable label for whatever was clicked, so the stats dashboard reads clearly
  var ID2NAME={planSave:'Open position (Long/Short)',jrOpen:'My Trades (header)',jrClose:'Close My Trades',jrBackdrop:'Close My Trades (tap-away)',planSym:'Symbol picker',planLev:'Leverage input',planAmt:'Amount input',ptSig:'Signals toggle',planAdvChk:'Advanced toggle',planSlOpt:'Stop-loss input',planTpOpt:'Take-profit input',ptMtCount:'My Trades (in terminal)',chatOpen:'Open chat',chatClose:'Close chat'};
  var ACT2NAME={close:'Close position',del:'Delete trade',edit:'Edit SL/TP',reopen:'Reopen trade',share:'Share ticket',copy:'Copy ticket',win:'Mark win',loss:'Mark loss'};
  function describe(t){
    if(!t||!t.closest) return 'Empty space / background';
    if(t.closest('#ptChart')) return 'Price chart';
    if(t.closest('.mobnav')) return 'Mobile nav bar';
    var m=t.closest('a,button,input,select,label,[data-mytrades],[data-act],.prod,.pp-ic,.ptt-sig')||t;
    if(m.id&&ID2NAME[m.id]) return ID2NAME[m.id];
    if(m.getAttribute){
      if(m.getAttribute('data-mytrades')!=null) return 'My Trades';
      var act=m.getAttribute('data-act'); if(act) return ACT2NAME[act]||('Trade action: '+act);
    }
    if(m.classList){
      if(m.classList.contains('prod')){var b=m.querySelector('.pt b'); return 'Product card: '+((b&&b.textContent.trim().slice(0,24))||'?');}
      if(m.classList.contains('pp-ic')) return m.getAttribute&&m.getAttribute('data-act')==='copy'?'Copy ticket':'Share ticket';
      if(m.classList.contains('ptt-sig')) return 'Signals toggle';
      if(t.closest('.ptt-tf')) return 'Chart timeframe';
      if(t.closest('.pt2-side')) return 'Long / Short toggle';
    }
    var tag=m.tagName?m.tagName.toLowerCase():'';
    if(tag==='canvas') return 'Price chart';
    if(/^(body|html|section|div|main|header|footer|span|em|i|small|p|h1|h2|h3|ul|li|nav|svg|path|img|aside)$/.test(tag)) return 'Empty space / background';
    var txt=(m.textContent||'').trim().replace(/\s+/g,' ').slice(0,26);
    if(txt&&(tag==='a'||tag==='button'||tag==='label')) return (tag==='a'?'Link: ':'Button: ')+txt;
    if(tag==='input'||tag==='select') return 'Field: '+(m.id||m.name||tag);
    return 'Other';
  }
  document.addEventListener('click',function(ev){
    // spatial heatmap cell (20 cols x 40 rows of the page)
    try{
      var col=Math.max(0,Math.min(19,Math.floor(ev.clientX/Math.max(1,window.innerWidth)*20)));
      var dh=Math.max(document.documentElement.scrollHeight||1,1);
      var row=Math.max(0,Math.min(39,Math.floor((ev.pageY!=null?ev.pageY:(ev.clientY+(window.scrollY||0)))/dh*40)));
      send('grid',col+'_'+row);
    }catch(_){}
    // one descriptor per click (typed for key elements, else generic)
    var el=ev.target.closest&&ev.target.closest('.excard,.hp-trade,.toolcard,.hbot,.tab');
    if(el&&el.classList.contains('excard')){var n=el.querySelector('.exname'); send('exchange', n?n.textContent:'');}
    else if(el&&el.classList.contains('hp-trade')){var hc=el.closest('.hp-card');var hs=hc?(hc.getAttribute('data-s')||''):'';send('hotpair',hs.replace(/USDT$/,'')||'pair');}
    else if(el&&el.classList.contains('toolcard')){var t=el.querySelector('.tc-name'); send('tool', t?t.textContent:'');}
    else if(el&&el.classList.contains('hbot')) send('nav','bot');
    else if(el&&el.classList.contains('tab')) send('tab', el.getAttribute('data-tab')||'');
    else send('el', describe(ev.target));
  },true);
  // ---- shareable state: encode a calculator's inputs in the URL so a link reproduces it ----
  function panelState(panel){
    if(!panel||!panel.id) return location.pathname;
    var p=new URLSearchParams(); p.set('c', panel.id);
    panel.querySelectorAll('input, select').forEach(function(el){ if(el.id && el.value!=='') p.set(el.id, el.value); });
    var on=panel.querySelector('.seg button.on'); if(on) p.set('_s', on.getAttribute('data-side'));
    return location.pathname+'?'+p.toString();
  }
  function restoreState(){
    var q; try{ q=new URLSearchParams(location.search); }catch(e){ return; }
    var c=q.get('c'); if(!c) return;
    var panel=document.getElementById(c); if(!panel) return;
    var tab=document.querySelector('[data-tab="'+c+'"]'); if(tab) tab.click();
    q.forEach(function(v,k){ if(k==='c'||k==='_s') return; var el=document.getElementById(k); if(el) el.value=v; });
    var side=q.get('_s'); if(side){ var btn=panel.querySelector('.seg button[data-side="'+side+'"]'); if(btn) btn.click(); }
    panel.querySelectorAll('input, select').forEach(function(el){ try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){} });
  }
  window.addEventListener('load', restoreState);
  // ---- share buttons (viral loop): one next to each result's copy button ----
  document.querySelectorAll('.copybtn').forEach(function(cb){
    var sb=document.createElement('button');
    sb.className='sharebtn'; sb.type='button'; sb.setAttribute('aria-label','Share'); sb.title=(window.mpT&&window.mpT('jShare'))||'Share result';
    sb.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
    cb.parentNode.insertBefore(sb, cb);
    sb.addEventListener('click', function(){
      var rm=cb.closest('.result-main'); if(!rm) return;
      var lbl=rm.querySelector('.rlabel'), val=rm.querySelector('.rvalue');
      var lt=lbl?lbl.textContent.trim():'', vt=val?val.textContent.trim():'';
      if(!vt||vt==='—') return;
      var msg=''+lt+': '+vt+' — free crypto futures calculators at marginpad.io';
      var url='https://marginpad.io'+panelState(rm.closest('.panel'));
      send('share', lt);
      if(navigator.share){ navigator.share({title:'MarginPad', text:msg, url:url}).catch(function(){}); }
      else { window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(msg+' '+url), '_blank', 'noopener,width=560,height=480'); }
    });
  });
})();

;/* ══════════ inline block from app/index.html line 3801 ══════════ */
(function(){
  var LB='/api/reward/lb';
  function jload(){try{return JSON.parse(localStorage.getItem('mp_journal')||'[]')||[];}catch(e){return [];}}
  function getAddr(){try{var a=localStorage.getItem('mp_reward_addr')||'';return /^0x[0-9a-fA-F]{40}$/.test(a)?a:'';}catch(e){return '';}}
  function render(){var list=document.getElementById('lbList');if(!list)return;fetch(LB).then(function(r){return r.json();}).then(function(d){var t=(d&&d.top)||[];list.innerHTML=t.length?t.slice(0,6).map(function(x){return '<div class="lbw-row"><span class="lbw-rank">'+x.rank+'</span><span class="lbw-who">'+x.who+'</span><span class="lbw-roe">'+((+x.roe)>=0?'+':'')+(+x.roe).toFixed(0)+'%</span></div>';}).join(''):'<div class="lbw-empty">No trades yet this season — be the first.</div>';}).catch(function(){});}
  function sync(){var me=(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me())||null;if(!me)return;/* Trade League is account-based: signed in = eligible, no wallet needed (server keys by the account) */var sub={};try{sub=JSON.parse(localStorage.getItem('mp_lb_sub')||'{}');}catch(e){}var d=jload(),changed=false;d.forEach(function(e){if((e.status==='win'||e.status==='loss')&&e.id&&!sub[e.id]){var margin=(+e.margin>0)?+e.margin:0,pnl=+e.pnl;if(margin>0&&isFinite(pnl)){var roe=pnl/margin*100;sub[e.id]=1;changed=true;try{fetch(LB,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:me.username||'',symbol:e.sym||'',side:e.side||'long',roe:roe,pnl:pnl})});}catch(_){}}}});if(changed){try{localStorage.setItem('mp_lb_sub',JSON.stringify(sub));}catch(e){}setTimeout(render,900);}}
  var tog=document.getElementById('lbToggle'),w=document.getElementById('lbWidget');
  if(tog&&w)tog.addEventListener('click',function(){w.classList.toggle('open');});
  render();setInterval(render,60000);
  sync();setInterval(sync,20000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden){sync();render();}});
})();

;/* ══════════ inline block from app/index.html line 3835 ══════════ */
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
  function chatRooms(){var b=['global','BTC','ETH','SOL','BNB','XRP','DOGE'];if(window._mpPrem===true)b.splice(1,0,'PREMIUM');return b;} // Premium lounge appears only for VIPs (server also enforces it)
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
  function switchRoom(r){if(r===room||chatRooms().indexOf(r)<0)return;room=r;markRoomPills();if(msgs)msgs.innerHTML='';try{input.placeholder=(room==='global'?'Message…':room==='PREMIUM'?'Premium lounge — VIPs only…':'Message '+room+' room…')+'  ·  type /leaderboard';}catch(e){}if(ws){try{ws.onclose=null;ws.close();}catch(e){}ws=null;}if(joined)connect();}
  function meUser(){var me=(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me())||null;if(!me)return '';return String(me.username||(me.email||'').split('@')[0]||'trader').replace(/[<>&]/g,'').slice(0,20);}
  function esc(s){return String(s).replace(/[<>&]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}
  function colorFor(u){var h=0;for(var i=0;i<u.length;i++)h=(h*31+u.charCodeAt(i))%360;return 'hsl('+h+',65%,70%)';}
  var MP_BADGE='<svg viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-3px;margin-right:4px;filter:drop-shadow(0 0 3px rgba(194,246,74,.55))"><path d="M12 1L14.83 3.3L18.47 3.1L19.4 6.62L22.46 8.6L21.15 12L22.46 15.4L19.4 17.38L18.47 20.9L14.83 20.7L12 23L9.17 20.7L5.53 20.9L4.6 17.38L1.54 15.4L2.85 12L1.54 8.6L4.6 6.62L5.53 3.1L9.17 3.3Z" fill="#c2f64a"/><path d="M7.7 12.3l2.9 2.9L16.4 9.3" fill="none" stroke="#0a0b0d" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function addMsg(m){var d=document.createElement('div');d.className='ct-msg';var who=m.admin?'<b style="color:#e9e7df;font-weight:800">'+MP_BADGE+'Margin<span style="color:#c2f64a">Pad</span></b>':'<span data-lvln="'+esc(m.u)+'"></span><b class="ct-user" data-lbu="'+esc(m.u)+'" role="button" tabindex="0" style="color:'+colorFor(m.u)+'">'+esc(m.u)+'</b><span data-lpro="'+esc(m.u)+'"></span>';d.innerHTML=who+' '+esc(m.t);msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;if(window.mpLvlDecorate)window.mpLvlDecorate();}
  /* click a username in chat → open that trader's profile card */
  function openTraderCard(n){n=String(n||'').replace(/[^a-zA-Z0-9_]/g,'');if(!n)return;if(window.mpOpenProfile){try{window.mpOpenProfile(n);}catch(_){}}}
  if(msgs)msgs.addEventListener('click',function(e){var el=e.target.closest&&e.target.closest('.ct-user[data-lbu]');if(el){e.stopPropagation();openTraderCard(el.getAttribute('data-lbu'));}});
  function setOnline(n){/* online count removed per owner */}
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
  function sysMsg(html){var d=document.createElement('div');d.className='ct-msg ct-sys';d.innerHTML=html;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d;}
  var LB_META={1:{t:'🏆 Top ROE',k:'top'},2:{t:'🎯 Best win rate',k:'topWr'},3:{t:'✨ Season XP',k:'topXp'}};
  function showLeaderboard(board){board=(board===2||board===3)?board:1;var meta=LB_META[board];
    var lbMsg=sysMsg('<b style="color:#c2f64a">'+meta.t+'</b><br><span style="color:#9aa3ad">loading…</span>');
    fetch('/api/reward/lb').then(function(r){return r.json();}).then(function(d){var t=(d&&d[meta.k])||[],medal=['🥇','🥈','🥉'];
      var html='<b style="color:#c2f64a">'+meta.t+' · this week</b><br>';
      if(!t.length)html+='<span style="color:#9aa3ad">No one on this board yet — be the first!</span>';
      else html+=t.slice(0,10).map(function(x,i){var val;
        if(board===2)val='<b style="color:#c2f64a">'+(+x.wr).toFixed(0)+'%</b> <span style="color:#7f8893">('+(+x.w||0)+'W-'+(+x.l||0)+'L)</span>';
        else if(board===3)val='<b style="color:#c2f64a">'+(+x.xp||0).toLocaleString()+' XP</b>';
        else val='<b style="color:'+((+x.roe)>=0?'#2ebd85':'#ff6258')+'">'+((+x.roe)>=0?'+':'')+(+x.roe).toFixed(0)+'%</b>';
        return (medal[i]||((i+1)+'.'))+' '+esc(x.who||'anon')+'<span data-lvln="'+esc(x.who||'')+'"></span> — '+val;}).join('<br>');
      var _we=d&&d.weekEnd,_es='';if(_we){var _ms=_we-Date.now();if(_ms>0){var _d=Math.floor(_ms/86400000),_h=Math.floor(_ms%86400000/3600000);_es=(_d>0?_d+'d ':'')+_h+'h';}}
      html+='<br><span style="color:#ffce8a;font-size:11.5px">⏳ 14-day season (UTC)'+(_es?' · ends in '+_es:'')+'</span>';
      html+='<br><span style="color:#7f8893;font-size:11.5px">Boards: <b>/leaderboard1</b> ROE · <b>/leaderboard2</b> win rate · <b>/leaderboard3</b> XP · members only, prizes paid in USDT each 14-day season</span>';
      lbMsg.innerHTML=html;msgs.scrollTop=msgs.scrollHeight;if(window.mpLvlDecorate)window.mpLvlDecorate();
    }).catch(function(){lbMsg.innerHTML='<span style="color:#ff6258">Could not load the leaderboard. Try again.</span>';});
  }
  function connect(){
    if(ws)return;
    try{ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/chat/ws?room='+encodeURIComponent(room));}catch(e){return;}
    ws.onmessage=function(ev){var d;try{d=JSON.parse(ev.data);}catch(e){return;}
      if(d.type==='poll'||d.type==='pollv'){try{var pb=document.getElementById('ctPollBox');if(!pb){pb=document.createElement('div');pb.id='ctPollBox';msgs.parentNode.insertBefore(pb,msgs);}if(d.type==='poll'&&!d.poll){pb.innerHTML='';window.__ctPoll=null;}else{var P=d.type==='poll'?d.poll:(window.__ctPoll?Object.assign(window.__ctPoll,{votes:d.votes}):null);if(P){window.__ctPoll=P;var tot=0;P.votes.forEach(function(v){tot+=v;});var oh=P.opts.map(function(o,i){var pc=tot?Math.round(P.votes[i]/tot*100):0;var mi=window.__ctPollMy&&window.__ctPollMy.id===P.id?window.__ctPollMy.i:null;return '<button type="button" data-pvi="'+i+'" '+(P.closed?'disabled':'')+' style="display:block;width:100%;text-align:left;margin:4px 0;padding:7px 9px;background:'+(mi===i?'#1a2413':'#12161d')+';border:1px solid '+(mi===i?'#c2f64a':'#232b3a')+';border-radius:8px;color:#dbe4f5;font-size:12px;cursor:'+(P.closed?'default':'pointer')+';position:relative;overflow:hidden;font-family:inherit"><span style="position:absolute;left:0;top:0;bottom:0;width:'+pc+'%;background:rgba(194,246,74,.12)"></span><span style="position:relative">'+o+' <b style="float:right;color:#c2f64a">'+pc+'%</b></span></button>';}).join('');pb.innerHTML='<div style="background:#0d1014;border:1px solid #2a3345;border-radius:10px;padding:10px 12px;margin:8px 10px"><div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:#c2f64a;margin-bottom:5px">'+(P.closed?'POLL · FINAL RESULTS':'📊 LIVE POLL — tap to vote')+'</div><div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:6px">'+P.q+'</div>'+oh+'<div style="font-size:10px;color:#5c6b84;margin-top:4px">'+tot+' vote'+(tot===1?'':'s')+'</div></div>';if(!P.closed&&!pb._pw){pb._pw=1;pb.addEventListener('click',function(ev){var b=ev.target.closest('[data-pvi]');if(!b||!window.__ctPoll||window.__ctPoll.closed)return;var i=+b.getAttribute('data-pvi');window.__ctPollMy={id:window.__ctPoll.id,i:i};try{ws.send(JSON.stringify({type:'vote',id:window.__ctPoll.id,i:i,u:user}));}catch(e){}});}}}}catch(e){}}
      if(d.type==='history'){msgs.innerHTML='';(d.messages||[]).forEach(addMsg);setOnline(d.online);}
      else if(d.type==='msg'){addMsg(d.message);setOnline(d.online);if(d.message&&d.message.u===user){markChatSeen();}else if(box.hidden&&d.message){chatAlert(true);}}
      else if(d.type==='presence'){setOnline(d.online);}};
    ws.onclose=function(){ws=null;if(joined)setTimeout(connect,3000);};
    ws.onerror=function(){try{ws.close();}catch(e){}};
  }
  function showChat(){var _me=window.mpAuth&&window.mpAuth.me&&window.mpAuth.me();if(_me&&(_me.muted||(','+String(_me.restrictions||'')+',').indexOf(',chat,')>=0)){gate.hidden=true;msgs.hidden=false;form.hidden=true;sysMsg('Your account is currently restricted from the chat. If you believe this is a mistake, contact <b>support@marginpad.io</b>.');return;}gate.hidden=true;msgs.hidden=false;form.hidden=false;joined=true;buildRoomBar();if(roomBar)roomBar.hidden=false;connect();try{input.placeholder=(room==='global'?'Message…':'Message '+room+' room…')+'  ·  type /leaderboard';}catch(e){}setTimeout(function(){input.focus();},50);}
  function showGate(){gate.hidden=false;msgs.hidden=true;form.hidden=true;if(roomBar)roomBar.hidden=true;}
  function openBox(){chatAlert(false);markChatSeen();box.hidden=false;fab.hidden=true;document.body.classList.add('chat-open');var u=meUser();if(u){user=u;showChat();}else{showGate();}}
  fab.addEventListener('click',openBox);
  var hOpen=document.getElementById('chatOpen');if(hOpen)hOpen.addEventListener('click',openBox);
  if(/[?&]chat=1/.test(location.search)){try{openBox();}catch(e){}}
  closeBtn.addEventListener('click',function(){box.hidden=true;fab.hidden=false;document.body.classList.remove('chat-open');});
  if(signinBtn)signinBtn.addEventListener('click',function(){try{if(window.mpAuth&&window.mpAuth.open)window.mpAuth.open();}catch(e){}});
  window.addEventListener('mp-auth-change',function(){if(!box.hidden&&!joined){var u=meUser();if(u){user=u;showChat();}}});
  form.addEventListener('submit',function(e){e.preventDefault();var t=(input.value||'').trim();if(!t)return;var _lbm=t.match(/^\/(leaderboard|lb|leaders)\s*([123])?\b/i);if(_lbm){input.value='';showLeaderboard(+_lbm[2]||1);return;}if(!ws||ws.readyState!==1)return;ws.send(JSON.stringify({type:'msg',u:user,t:t}));try{window.__mpTrack&&window.__mpTrack('chat','sent');}catch(_){}input.value='';});
})();

;/* ══════════ inline block from app/index.html line 3884 ══════════ */
window.addEventListener('load', function () {
  function MT(k){ return (window.mpT && window.mpT(k)) || null; }
  var HINTS = [
    [/sym/i,'hSym'],[/mmr/i,'hMmr'],[/lev/i,'hLev'],[/entry/i,'hEntry'],[/exit/i,'hExit'],[/stop/i,'hStop'],
    [/risk/i,'hRisk'],[/bal/i,'hBal'],[/(qty|pos)/i,'hQty'],[/(roe|custom)/i,'hRoe'],[/tp/i,'hTp'],[/cur/i,'hCur']
  ];
  function hintFor(id) { for (var i = 0; i < HINTS.length; i++) { if (HINTS[i][0].test(id)) return MT(HINTS[i][1]); } return null; }
  var els = document.querySelectorAll('.field input, .field select');
  for (var i = 0; i < els.length; i++) {
    var inp = els[i], h = hintFor(inp.id || '');
    if (!h) continue;
    var field = inp.closest('.field'); if (!field) continue;
    var lab = field.querySelector('label'); if (!lab || lab.getAttribute('data-hinted')) continue;
    lab.setAttribute('title', h);            // hover the label text → explanation
    lab.setAttribute('data-hinted', '1');
    lab.style.cursor = 'help';
    if (!lab.querySelector('.hint')) {
      var s = document.createElement('span');
      s.className = 'hint'; s.textContent = '?';
      s.setAttribute('title', h); s.setAttribute('aria-label', h);
      lab.appendChild(s);
    }
  }
  // ---- value steppers: fine-tune any price with arrow buttons ----
  function smartStep(v){v=Math.abs(v);if(!v)return 1;if(v>=10000)return 100;if(v>=1000)return 10;if(v>=100)return 5;if(v>=10)return 1;if(v>=1)return 0.1;return 0.01;}
  document.querySelectorAll('.panel .input-line').forEach(function(line){
    var inp=line.querySelector('input[type="number"]');
    if(!inp||line.querySelector('.stepper'))return;
    var st=document.createElement('div');st.className='stepper';
    st.innerHTML='<button type="button" data-d="1" tabindex="-1" aria-label="Increase">▲</button><button type="button" data-d="-1" tabindex="-1" aria-label="Decrease">▼</button>';
    line.appendChild(st);line.classList.add('has-stepper');
    st.addEventListener('click',function(e){
      var b=e.target.closest('button');if(!b)return;
      var dir=+b.getAttribute('data-d'),v=parseFloat(inp.value);if(!isFinite(v))v=0;
      var nv=v+dir*smartStep(v);if(nv<0)nv=0;nv=Math.round(nv*1e6)/1e6;
      inp.value=nv;inp.dispatchEvent(new Event('input',{bubbles:true}));
    });
  });
});

;/* ══════════ inline block from app/index.html line 3925 ══════════ */
(function(){
  var mn=document.querySelector('.mobnav');
  if(mn)mn.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b)return;
    var a=b.getAttribute('data-mn');
    if(a==='journal'){/* opens the My Trades drawer via the global [data-mytrades] handler — same UI as Paper Trade ▸ My Trades */}
    else if(a==='chat'){ var bx=document.getElementById('chatBox'); if(bx&&!bx.hidden){ var x=document.getElementById('ctClose'); if(x)x.click(); } else { var c=document.getElementById('chatFab'); if(c)c.click(); } }
    else if(a==='home'){location.href='/';}
    else if(a==='plan'){if(window.mpGo){window.mpGo('/paper-trade');}else{location.href='/paper-trade';}}
  });
  var pop;
  function showHint(t){if(!t)return;if(!pop){pop=document.createElement('div');pop.id='hintPop';document.body.appendChild(pop);}pop.textContent=t;pop.style.display='block';}
  function hideHint(){if(pop)pop.style.display='none';}
  document.addEventListener('click',function(e){
    var h=e.target.closest&&e.target.closest('.hint');
    if(h){e.preventDefault();e.stopPropagation();showHint(h.getAttribute('title')||h.getAttribute('aria-label'));return;}
    if(pop&&pop.style.display!=='none'&&!(e.target.closest&&e.target.closest('#hintPop')))hideHint();
  });
})();

;/* ══════════ inline block from app/index.html line 3964 ══════════ */
(function(){
  var KEY='mp_pwa_dismissed';
  function standalone(){try{return window.matchMedia('(display-mode:standalone)').matches||window.navigator.standalone===true;}catch(e){return false;}}
  var ua=navigator.userAgent||'';
  var isIOS=/iPhone|iPad|iPod/i.test(ua)&&!window.MSStream;
  var isMobile=isIOS||/Android/i.test(ua);
  if(!isMobile||standalone())return;
  try{if(localStorage.getItem(KEY))return;}catch(e){}
  var banner=document.getElementById('pwaBanner'),msg=document.getElementById('pwaMsg'),act=document.getElementById('pwaAction'),closeB=document.getElementById('pwaClose');
  var sheet=document.getElementById('pwaSheet'),sheetClose=document.getElementById('pwaSheetClose');
  if(!banner)return;
  function dismiss(){banner.hidden=true;try{localStorage.setItem(KEY,'1');}catch(e){}}
  closeB.addEventListener('click',dismiss);
  /* Install-promo etiquette (2026-07 UX pass). The old "show on first touch or 6s" fired the banner right when the
     user STARTED doing something — screenshots showed it covering the Browse panel, the My Trades drawer and the
     just-opened-position feedback. Now: appears after 45s of engaged dwell (12s for returning visitors), NEVER while
     an overlay/drawer/chat is open (hides itself if one opens), auto-hides after 15s without burning the dismissal —
     only an explicit ✕ or Install ends it for good. */
  function overlayOpen(){try{return document.documentElement.classList.contains('jr-open')||!!document.querySelector('#browsePanel.on,.scr-sheet.on')||(function(){var cb=document.getElementById('chatBox');return cb&&!cb.hidden;})()||(sheet&&!sheet.hidden);}catch(e){return false;}}
  var VIS=1;try{VIS=+localStorage.getItem('mp_pwa_v')||0;if(!sessionStorage.getItem('mp_pwa_sv')){VIS++;localStorage.setItem('mp_pwa_v',String(VIS));sessionStorage.setItem('mp_pwa_sv','1');}}catch(e){}
  function showLater(fn){var delay=VIS>=2?12000:45000,shown=false;
    function attempt(){if(shown)return;
      if(document.hidden||overlayOpen()){setTimeout(attempt,8000);return;}
      shown=true;fn();
      setTimeout(function(){if(!banner.hidden)banner.hidden=true;},15000);
      var guard=setInterval(function(){if(banner.hidden){clearInterval(guard);return;}if(overlayOpen())banner.hidden=true;},800);}
    setTimeout(attempt,delay);}
  if(isIOS){
    msg.textContent=(window.mpT&&window.mpT('pwaIos'))||'Tap Share, then “Add to Home Screen”.';
    act.textContent=(window.mpT&&window.mpT('pwaHow'))||'How';
    act.addEventListener('click',function(){sheet.hidden=false;});
    sheetClose.addEventListener('click',function(){sheet.hidden=true;dismiss();});
    sheet.addEventListener('click',function(e){if(e.target===sheet)sheet.hidden=true;});
    showLater(function(){banner.hidden=false;});
  } else {
    var deferred=null;
    window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferred=e;msg.textContent=(window.mpT&&window.mpT('pwaDesc'))||'Full-screen, app-like access from your home screen.';act.textContent=(window.mpT&&window.mpT('pwaInstall'))||'Install';showLater(function(){banner.hidden=false;});});
    act.addEventListener('click',function(){if(deferred){deferred.prompt();deferred.userChoice.then(function(){deferred=null;dismiss();});}else dismiss();});
  }
})();

;/* ══════════ inline block from app/index.html line 3994 ══════════ */
(function(){
  var stage=document.getElementById('heatChart'); if(!stage)return;
  // (the 'coming soon' placeholder injection + UI hiding lived here 2026-07..2026-07-24 — removed when the collector came back on the new droplet)
  var HEAT_DISABLED=false; // re-enabled 2026-07-24: the heatmap is fed by OUR collector (/api/v1 recent+live+clusters) which lives again on the new droplet. (Do NOT `return` here — the rest of this IIFE runs the product switcher + swap + mobile hub.)
  var chart=null, candle=null, plines=[], libBusy=false;
  function ensureLib(cb){ if(window.LightweightCharts){cb();return;} if(libBusy)return; libBusy=true;
    var s=document.createElement('script'); s.src='/assets/lightweight-charts-4.2.0.js';
    s.onload=function(){libBusy=false;cb();}; s.onerror=function(){libBusy=false;stage.innerHTML='<div class="heat-err">Chart failed to load — check your connection.</div>';};
    document.head.appendChild(s); }
  function initChart(){ if(chart||!window.LightweightCharts)return;
    chart=LightweightCharts.createChart(stage,{layout:{background:{color:'transparent'},textColor:'#9aa3ad',fontFamily:"'Space Mono', monospace",attributionLogo:false},grid:{vertLines:{color:'rgba(35,41,50,0.4)'},horzLines:{color:'rgba(35,41,50,0.4)'}},rightPriceScale:{borderColor:'#232932'},timeScale:{borderColor:'#232932',timeVisible:true,secondsVisible:false},crosshair:{mode:1,vertLine:{color:'rgba(194,246,74,0.45)',labelBackgroundColor:'#3a4416'},horzLine:{color:'rgba(194,246,74,0.45)',labelBackgroundColor:'#3a4416'}},autoSize:true});
    candle=chart.addCandlestickSeries({upColor:'#2ebd85',downColor:'#ff6258',borderVisible:false,wickUpColor:'#2ebd85',wickDownColor:'#ff6258'}); }
  function setLines(P){ if(!candle)return; for(var i=0;i<plines.length;i++){try{candle.removePriceLine(plines[i]);}catch(e){}} plines=[]; if(!P)return;
    plines.push(candle.createPriceLine({price:P,color:'#ffffff',lineWidth:2,lineStyle:2,axisLabelVisible:true,title:'PRICE'}));
    [100,50,25,10,5].forEach(function(L){ var t=Math.min(1,L/100); var lc=mix('#1d6e4c','#76ffb2',t),sc=mix('#1d4c8c','#79ceff',t),w=L>=50?3:(L>=25?2:1);
      plines.push(candle.createPriceLine({price:P*(1-1/L+0.005),color:lc,lineWidth:w,lineStyle:0,axisLabelVisible:true,title:L+'x long'}));
      plines.push(candle.createPriceLine({price:P*(1+1/L-0.005),color:sc,lineWidth:w,lineStyle:0,axisLabelVisible:true,title:L+'x short'})); }); }
  function refresh(){ if(chart){try{chart.timeScale().fitContent();}catch(e){}} }
  var sel=document.getElementById('heatCoin'), pxEl=document.getElementById('heatPx');
  var cur={coin:'BTC',price:0,chg:0};
  var LEVS=[2,3,5,10,20,25,50,100];
  function MT(k,d){return (window.mpT&&window.mpT(k))||d;}
  function money(x){if(x>=1000)return x.toLocaleString('en-US',{maximumFractionDigits:0});if(x>=1)return x.toLocaleString('en-US',{maximumFractionDigits:2});return x.toLocaleString('en-US',{maximumFractionDigits:8}).replace(/0+$/,'').replace(/\.$/,'');}
  function hx(c){c=c.replace('#','');return[parseInt(c.substr(0,2),16),parseInt(c.substr(2,2),16),parseInt(c.substr(4,2),16)];}
  function mix(a,b,t){var A=hx(a),B=hx(b);return 'rgb('+Math.round(A[0]+(B[0]-A[0])*t)+','+Math.round(A[1]+(B[1]-A[1])*t)+','+Math.round(A[2]+(B[2]-A[2])*t)+')';}
  function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function draw(){
    var P=cur.price; ctx.clearRect(0,0,W,H);
    var bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#0c1016');bg.addColorStop(1,'#080a0e');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    if(!P){return;}
    var x0=132,x1=W-116,pt=132,pb=H-118,ph=pb-pt,pTop=P*1.45,pBot=P*0.55,plotW=x1-x0;
    function Y(pr){return pt+ph*(pTop-pr)/(pTop-pBot);}
    var cy=Y(P);
    // density fills: shorts (blue, above) + longs (green, below), brightest near price
    var gs=ctx.createLinearGradient(0,pt,0,cy);gs.addColorStop(0,'rgba(60,150,255,0)');gs.addColorStop(1,'rgba(70,165,255,0.24)');ctx.fillStyle=gs;ctx.fillRect(x0,pt,plotW,cy-pt);
    var gl=ctx.createLinearGradient(0,cy,0,pb);gl.addColorStop(0,'rgba(46,205,140,0.24)');gl.addColorStop(1,'rgba(46,205,140,0)');ctx.fillStyle=gl;ctx.fillRect(x0,cy,plotW,pb-cy);
    // gridlines + left price axis
    for(var pc=-40;pc<=40;pc+=5){var pr=P*(1+pc/100),yy=Y(pr);if(yy<pt-1||yy>pb+1)continue;
      ctx.strokeStyle='rgba(255,255,255,0.05)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0,yy);ctx.lineTo(x1,yy);ctx.stroke();
      if(pc%10===0){ctx.fillStyle='#5c6672';ctx.font='21px "Space Mono",monospace';ctx.textAlign='right';ctx.fillText('$'+money(pr),x0-16,yy+7);}}
    // leverage bands
    var lbls=[cy];
    LEVS.forEach(function(L){var i=Math.min(1,L/100);
      [['#1d6e4c','#76ffb2',P*(1-1/L+0.005)],['#1d4c8c','#79ceff',P*(1+1/L-0.005)]].forEach(function(a){
        var pr=a[2];if(pr<=pBot||pr>=pTop)return;var yy=Y(pr),col=mix(a[0],a[1],i);
        ctx.save();ctx.shadowColor=col;ctx.shadowBlur=13*i+5;ctx.strokeStyle=col;ctx.globalAlpha=0.45+0.55*i;ctx.lineWidth=2.5+5.5*i;ctx.beginPath();ctx.moveTo(x0,yy);ctx.lineTo(x1,yy);ctx.stroke();ctx.restore();
        var ok=true;for(var k=0;k<lbls.length;k++){if(Math.abs(lbls[k]-yy)<34){ok=false;break;}}
        if(ok){lbls.push(yy);
          ctx.fillStyle=col;ctx.font='bold 27px "Space Mono",monospace';ctx.textAlign='left';ctx.fillText(L+'×',x1+16,yy+9);
          var dp=(pr-P)/P*100;ctx.fillStyle='rgba(233,231,223,0.92)';ctx.font='22px "Space Mono",monospace';ctx.textAlign='right';ctx.fillText((dp>=0?'+':'')+dp.toFixed(1)+'%',x1-16,yy-10);}
      });});
    // current price line + pill
    ctx.save();ctx.shadowColor='#fff';ctx.shadowBlur=14;ctx.strokeStyle='rgba(255,255,255,0.92)';ctx.lineWidth=2.5;ctx.setLineDash([12,8]);ctx.beginPath();ctx.moveTo(x0,cy);ctx.lineTo(x1,cy);ctx.stroke();ctx.restore();
    var pT='PRICE  $'+money(P);ctx.font='bold 26px "Space Mono",monospace';var pw=ctx.measureText(pT).width+44,pxp=(x0+x1)/2-pw/2;
    ctx.fillStyle='#11161d';rr(pxp,cy-23,pw,46,13);ctx.fill();ctx.strokeStyle='rgba(255,255,255,0.45)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(pT,(x0+x1)/2,cy+9);
    // zone labels
    ctx.font='bold 22px "Space Mono",monospace';ctx.textAlign='center';
    ctx.fillStyle='rgba(121,206,255,0.7)';ctx.fillText('▲  SHORTS LIQUIDATE',(x0+x1)/2,pt+34);
    ctx.fillStyle='rgba(118,255,178,0.65)';ctx.fillText('▼  LONGS LIQUIDATE',(x0+x1)/2,pb-16);
    // header
    ctx.textAlign='left';ctx.fillStyle='#f0eee6';ctx.font='bold 47px "Bricolage Grotesque",sans-serif';ctx.fillText('LIQUIDATION HEATMAP',44,66);
    ctx.fillStyle='#9aa3ad';ctx.font='28px "Space Mono",monospace';ctx.fillText(cur.coin+' / USDT',44,106);
    ctx.textAlign='right';ctx.fillStyle='#f0eee6';ctx.font='bold 42px "Space Mono",monospace';ctx.fillText('$'+money(P),W-44,72);
    ctx.fillStyle=cur.chg>=0?'#2ebd85':'#ff6258';ctx.font='25px "Space Mono",monospace';ctx.fillText((cur.chg>=0?'+':'')+cur.chg.toFixed(2)+'%  24h',W-44,108);
    // footer / brand
    ctx.fillStyle='#f5f5f2';ctx.font='bold 39px "Bricolage Grotesque",sans-serif';ctx.textAlign='left';ctx.fillText('MARGIN',44,H-44);var mw=ctx.measureText('MARGIN').width;ctx.fillStyle='#c2f64a';ctx.fillText('PAD',44+mw,H-44);
    ctx.fillStyle='#9aa3ad';ctx.font='25px "Space Mono",monospace';ctx.textAlign='right';ctx.fillText('marginpad.io',W-44,H-44);
    ctx.fillStyle='#5c656f';ctx.font='18px "Space Mono",monospace';ctx.textAlign='left';ctx.fillText('Estimated levels by leverage · not order-book data',44,H-16);
  }
  // ============ LIVE LIQUIDATION LAYER (real data via /api/v1, graceful fallback to theoretical) ============
  var overlay=null,octx=null,odpr=1,liqEvents=[],liqBuckets=[],liqMax=0,clusters=[],clMax=0,dispBins=[],levLines=[],realMode=false,showReal=true,showClusters=false,showTheo=false,win='1D',sideMode='all',levSet={5:false,10:false,25:true,50:false,100:true},pollT=null,drawQ=false,subd=false,loadedKlines=false;
  var WIN={'1H':{iv:'15',mins:60,lbl:'1h'},'4H':{iv:'15',mins:240,lbl:'4h'},'1D':{iv:'15',mins:1440,lbl:'24h'},'7D':{iv:'60',mins:10080,lbl:'7d'},'30D':{iv:'240',mins:43200,lbl:'30d'}};
  var MOCK=/[?&]mockliq=1/.test(location.search);
  var lastBar=null,priceT=null,klT=null,_hWsT=0,_hRaf=false,_hlgp=0,_hrej=0; // live candle: forming bar fed by the live WS tick (_hWsT = last WS tick time, so the slower cached REST poll never clobbers a fresh price); _hlgp/_hrej = spike filter
  function ensureOverlay(){ if(overlay)return; overlay=document.createElement('canvas'); overlay.className='heat-ovl';
    stage.style.position='relative'; stage.appendChild(overlay); octx=overlay.getContext('2d');
    if(window.ResizeObserver)new ResizeObserver(function(){sizeOverlay();sched();}).observe(stage); sizeOverlay(); }
  function sizeOverlay(){ if(!overlay)return; odpr=Math.min(2,window.devicePixelRatio||1); var w=stage.clientWidth,h=stage.clientHeight;
    overlay.width=Math.max(1,w*odpr); overlay.height=Math.max(1,h*odpr); overlay.style.width=w+'px'; overlay.style.height=h+'px'; }
  function sched(){ if(drawQ)return; drawQ=true; requestAnimationFrame(function(){drawQ=false;drawLiq();}); }
  function bcol(side,a){ return side==='long_liquidated'?'rgba(255,92,92,'+a+')':'rgba(46,211,154,'+a+')'; }
  function kfmt(v){ v=+v||0; return v>=1e9?'$'+(v/1e9).toFixed(1)+'B':v>=1e6?'$'+(v/1e6).toFixed(1)+'M':v>=1e3?'$'+Math.round(v/1e3)+'K':'$'+Math.round(v); }
  function dispStep(p){ if(!(p>0))return 100; var t=p*0.0016,m=Math.pow(10,Math.floor(Math.log10(t))),n=t/m,s=n<1.5?1:n<3.5?2:n<7.5?5:10; return s*m; } // ~$100 bins for BTC, scales for ETH
  function drawLiq(){ if(!overlay||!chart||!candle)return; octx.setTransform(odpr,0,0,odpr,0,0); octx.clearRect(0,0,overlay.width,overlay.height);
    if(!realMode)return; var ts=chart.timeScale(),paneW; try{paneW=ts.width();}catch(e){paneW=stage.clientWidth-64;} var H=overlay.height/odpr;
    // ---- real liquidation histogram: ±5% of price, ~$100 bins, side-filtered (All / Long / Short) ----
    dispBins=[];
    if(showReal&&liqBuckets.length&&cur.price>0){
      var lo=cur.price*0.95,hi=cur.price*1.05,step=dispStep(cur.price),mm={};
      for(var i=0;i<liqBuckets.length;i++){ var b=liqBuckets[i]; if(b.price<lo||b.price>hi)continue;
        var key=Math.round(b.price/step)*step,bn=mm[key]||(mm[key]={price:key,long:0,short:0,cnt:0}); bn.long+=b.long||0; bn.short+=b.short||0; bn.cnt+=b.count||0; }
      for(var kk in mm){ var bn2=mm[kk]; bn2.above=bn2.price>=cur.price;
        bn2.vol = sideMode==='long'?bn2.long : sideMode==='short'?bn2.short : (bn2.above?bn2.short:bn2.long);
        bn2.green = sideMode==='long'?false : sideMode==='short'?true : bn2.above; /* green=short, red=long */
        if(bn2.vol>0)dispBins.push(bn2); }
      var vmx=0; for(var i2=0;i2<dispBins.length;i2++) if(dispBins[i2].vol>vmx)vmx=dispBins[i2].vol;
      if(vmx>0){ var maxLen=Math.max(80,paneW*0.46);
        var p0=candle.priceToCoordinate(cur.price),p1=candle.priceToCoordinate(cur.price+step),barH=Math.max(2.5,(p0!=null&&p1!=null?Math.abs(p0-p1):4)-1);
        for(var i3=0;i3<dispBins.length;i3++){ var bn3=dispBins[i3],y3=candle.priceToCoordinate(bn3.price); if(y3==null||y3<0||y3>H)continue;
          var len=Math.max(2,Math.sqrt(bn3.vol/vmx)*maxLen); /* sqrt scale: one giant cluster no longer flattens every other bar to invisible — big stays biggest, the rest stay readable */ octx.fillStyle=bn3.green?'rgba(46,211,154,0.62)':'rgba(255,92,92,0.62)'; octx.fillRect(paneW-len,y3-barH/2,len,barH); }
        var top=dispBins.slice().sort(function(a,b){return b.vol-a.vol;}).slice(0,4);
        octx.font='600 10px "Space Mono",monospace'; octx.textBaseline='middle'; octx.textAlign='right'; octx.lineWidth=3; octx.lineJoin='round';
        for(var i4=0;i4<top.length;i4++){ var bn4=top[i4],y4=candle.priceToCoordinate(bn4.price); if(y4==null||y4<6||y4>H-6)continue;
          octx.strokeStyle='rgba(8,9,11,0.9)'; octx.strokeText(kfmt(bn4.vol),paneW-6,y4);
          octx.fillStyle=bn4.green?'rgba(132,238,198,0.99)':'rgba(255,168,168,0.99)'; octx.fillText(kfmt(bn4.vol),paneW-6,y4); }
        octx.textAlign='left'; } }
    // ---- leverage liquidation levels (computed: an Nx long liquidates near P*(1-1/N), short near P*(1+1/N)) ----
    levLines=[];
    if(cur.price>0){ var mmr=0.005, levs=[5,10,25,50,100];
      for(var L=0;L<levs.length;L++){ var lev=levs[L]; if(!levSet[lev])continue;
        if(sideMode!=='short'){ var pl=cur.price*(1-1/lev+mmr),yl=candle.priceToCoordinate(pl); if(yl!=null&&yl>=0&&yl<=H){ levLines.push({y:yl,price:pl,lev:lev,side:'long'});
          octx.strokeStyle='rgba(255,92,92,0.45)'; octx.lineWidth=1.4; octx.setLineDash([5,4]); octx.beginPath(); octx.moveTo(0,yl); octx.lineTo(paneW,yl); octx.stroke(); octx.setLineDash([]);
          octx.font='700 9.5px "Space Mono",monospace'; octx.textAlign='left'; octx.textBaseline='bottom'; octx.fillStyle='rgba(255,150,150,0.95)'; octx.fillText(lev+'× long',5,yl-1); } }
        if(sideMode!=='long'){ var psr=cur.price*(1+1/lev-mmr),yr=candle.priceToCoordinate(psr); if(yr!=null&&yr>=0&&yr<=H){ levLines.push({y:yr,price:psr,lev:lev,side:'short'});
          octx.strokeStyle='rgba(46,211,154,0.45)'; octx.lineWidth=1.4; octx.setLineDash([5,4]); octx.beginPath(); octx.moveTo(0,yr); octx.lineTo(paneW,yr); octx.stroke(); octx.setLineDash([]);
          octx.font='700 9.5px "Space Mono",monospace'; octx.textAlign='left'; octx.textBaseline='top'; octx.fillStyle='rgba(120,235,190,0.95)'; octx.fillText(lev+'× short',5,yr+1); } }
      } }
    octx.textBaseline='alphabetic';
  }
  function onCross(param){ var tip=document.getElementById('heatTip'); if(!tip)return;
    if(!realMode||!param.point||!candle){ tip.style.display='none'; return; } var py=param.point.y;
    var lv=null,ld=7; for(var j=0;j<levLines.length;j++){ var d2=Math.abs(levLines[j].y-py); if(d2<ld){ld=d2;lv=levLines[j];} } /* nearest leverage level */
    var best=null,bd=9; for(var i=0;i<dispBins.length;i++){ var bn=dispBins[i],y=candle.priceToCoordinate(bn.price); if(y==null)continue; var d=Math.abs(y-py); if(d<bd){bd=d;best=bn;} } /* nearest histogram bin */
    var html='';
    if(lv&&ld<=bd){ var pct=(100/lv.lev).toFixed(1); html='<b>'+lv.lev+'× '+(lv.side==='long'?'long':'short')+' liquidation</b>@ $'+money(lv.price)+'<small>where '+lv.lev+'× '+(lv.side==='long'?'longs liquidate (−'+pct+'%)':'shorts liquidate (+'+pct+'%)')+' · estimated</small>'; }
    else if(best){ var L=best.long||0,S=best.short||0,tot=L+S,lp=tot?Math.round(L/tot*100):0;
      html='<b>'+(best.green?'Shorts liquidated':'Longs liquidated')+' @ $'+money(best.price)+'</b>$'+money(best.vol)+(best.cnt?' · '+best.cnt+' liqs':'')+'<small>'+kfmt(L)+' long / '+kfmt(S)+' short · '+lp+'% / '+(100-lp)+'% · last '+WIN[win].lbl+'</small>'; }
    else { tip.style.display='none'; return; }
    tip.innerHTML=html; tip.style.display='block'; tip.style.left=Math.min(stage.clientWidth-210,param.point.x+14)+'px'; tip.style.top=Math.max(4,py-10)+'px'; }
  function applyTheo(){ if(showTheo||!realMode){ setLines(cur.price); } else { for(var i=0;i<plines.length;i++){try{candle.removePriceLine(plines[i]);}catch(e){}} plines=[]; } }
  function setFallback(fb){ realMode=!fb; var n=document.getElementById('heatFallback'); if(n)n.style.display=fb?'flex':'none'; applyTheo(); updateTicker(); updateStats(); sched(); }
  function updateStats(){ var el=document.getElementById('heatStats'); if(!el)return; if(!realMode){el.textContent='';return;}
    var cnt=0,nl=0,ns=0; for(var i=0;i<liqBuckets.length;i++){cnt+=liqBuckets[i].count||0;nl+=liqBuckets[i].long||0;ns+=liqBuckets[i].short||0;}
    var not=sideMode==='long'?nl:sideMode==='short'?ns:nl+ns, sl=sideMode==='long'?' long':sideMode==='short'?' short':'';
    el.innerHTML = (not>0) ? cur.coin+sl+' liquidations · last '+WIN[win].lbl+' · <b>'+cnt+'</b> · <b>$'+money(not)+'</b>' : '<span class="hs-quiet">'+cur.coin+' quiet — liquidations spike on moves</span>'; }
  function updateTicker(){ var el=document.getElementById('heatTicker'); if(!el)return; if(!realMode){el.innerHTML='';return;}
    var big=liqEvents.filter(function(e){return e.notional>=50000;}).slice(0,20);
    el.innerHTML = big.length ? '<div class="tk-track">'+big.concat(big).map(function(e){return '<span class="tk-i '+(e.side==='long_liquidated'?'tk-l':'tk-s')+'">'+(e.side==='long_liquidated'?'▼ LONG':'▲ SHORT')+' $'+money(e.notional)+' @ '+money(e.price)+' · '+e.exchange+'</span>';}).join('')+'</div>' : '<span class="tk-empty">No liquidations above $50k in view yet.</span>'; }
  function fetchLiq(){ if(MOCK){ mock(); return; } var c=cur.coin;
    Promise.all([
      fetch('/api/v1/liquidations/recent?symbol='+encodeURIComponent(c)+'&minutes='+WIN[win].mins).then(function(r){return r.json();}).catch(function(){return {fallback:true};}),
      fetch('/api/v1/liquidations/live?symbol='+encodeURIComponent(c)+'&limit=400').then(function(r){return r.json();}).catch(function(){return {fallback:true};}),
      fetch('/api/v1/clusters?symbol='+encodeURIComponent(c)).then(function(r){return r.json();}).catch(function(){return {clusters:[]};}),
      fetch('/api/price?symbol='+encodeURIComponent(c)+window.__mpPQ('cdash',c),{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return null;})
    ]).then(function(res){ if(c!==cur.coin)return; var rec=res[0],lv=res[1],cls=res[2],pd=res[3];
      if(pd&&pd.price){cur.price=+pd.price;cur.chg=+pd.chg||0;if(pxEl)pxEl.innerHTML='$'+money(cur.price)+' <small>'+(cur.chg>=0?'+':'')+cur.chg.toFixed(2)+'%</small>';liveCandle();}
      if(!rec||rec.fallback||!Array.isArray(rec.buckets)||!lv||lv.fallback){ setFallback(true); return; }
      liqBuckets=rec.buckets; liqMax=0; for(var i=0;i<liqBuckets.length;i++){var t=(liqBuckets[i].long||0)+(liqBuckets[i].short||0);if(t>liqMax)liqMax=t;}
      liqEvents=lv.events||[];
      clusters=(cls&&Array.isArray(cls.clusters))?cls.clusters:[]; clMax=0; for(var k=0;k<clusters.length;k++){if(clusters[k].est_notional>clMax)clMax=clusters[k].est_notional;}
      setFallback(false); }); }
  function mock(){ var P=cur.price||63000,now=Date.now(); liqEvents=[];
    for(var i=0;i<65;i++){ var up=Math.random()<0.5,pr=P*(1+(Math.random()-0.5)*0.05),no=Math.pow(10,3.7+Math.random()*3.2);
      liqEvents.push({ts:now-Math.random()*WIN[win].mins*60000,exchange:['binance','bybit','okx'][i%3],symbol:cur.coin,side:up?'short_liquidated':'long_liquidated',price:pr,qty:no/pr,notional:no}); }
    var bs=P*0.004,bm={}; liqEvents.forEach(function(e){var b=Math.round(e.price/bs)*bs;bm[b]=bm[b]||{price:b,long:0,short:0};if(e.side==='long_liquidated')bm[b].long+=e.notional;else bm[b].short+=e.notional;});
    liqBuckets=Object.keys(bm).map(function(k){return bm[k];}); liqMax=0; liqBuckets.forEach(function(b){var t=b.long+b.short;if(t>liqMax)liqMax=t;});
    clusters=[]; var cbs=P*0.004; [[5,0.1],[10,0.25],[25,0.3],[50,0.2],[100,0.15]].forEach(function(a){ var lev=a[0],w=a[1];
      clusters.push({price:Math.round(P*(1-1/lev+0.005)/cbs)*cbs,side:'long_liquidated',est_notional:w*6e6*(0.6+Math.random())});
      clusters.push({price:Math.round(P*(1+1/lev-0.005)/cbs)*cbs,side:'short_liquidated',est_notional:w*6e6*(0.6+Math.random())}); });
    clMax=0; clusters.forEach(function(c){if(c.est_notional>clMax)clMax=c.est_notional;});
    setFallback(false); }
  // Keep the forming candle alive between full kline reloads: move its close (and high/low) with the live price,
  // and roll a fresh candle when the interval ticks over — so the chart never looks frozen even when liquidations are sparse.
  function liveCandle(){ if(!candle||!cur.price||!lastBar)return;
    var p=cur.price, ivSec=parseInt(WIN[win].iv,10)*60, nowBar=Math.floor(Date.now()/1000/ivSec)*ivSec;
    var rolled=nowBar>lastBar.time;
    if(rolled){ var _hop=lastBar.close,_hspk=(_hlgp>0&&Math.abs(p-_hlgp)/_hlgp>0.025),_hcl=_hspk?_hop:p; lastBar={time:nowBar,open:_hop,high:Math.max(_hop,_hcl),low:Math.min(_hop,_hcl),close:_hcl}; if(!_hspk)_hlgp=p; _hrej=0; }
    else { if(_hlgp>0 && Math.abs(p-_hlgp)/_hlgp>0.025){ if(++_hrej<3) return; } /* reject a lone >2.5% print that would ratchet a fake wick; accept only if 3 in a row confirm a real move */ _hlgp=p; _hrej=0; lastBar.close=p; if(p>lastBar.high)lastBar.high=p; if(p<lastBar.low)lastBar.low=p; }
    try{ candle.update(lastBar); if(rolled)chart.timeScale().scrollToRealTime(); }catch(e){} }
  function pricePoll(){ if(document.hidden)return; var c=cur.coin; fetch('/api/price?symbol='+encodeURIComponent(c)+window.__mpPQ('heat',c),{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return null;}).then(function(pd){ if(c!==cur.coin||!pd||!pd.price)return;
    if(_hWsT&&Date.now()-_hWsT<6000){sched();return;} // a fresh WS tick already moved the candle — don't clobber it with the slower (≤10s) cached REST value
    cur.price=+pd.price; cur.chg=+pd.chg||0; if(pxEl)pxEl.innerHTML='$'+money(cur.price)+' <small>'+(cur.chg>=0?'+':'')+cur.chg.toFixed(2)+'%</small>'; liveCandle(); sched(); }); }
  function startPoll(){ stopPoll(); fetchLiq(); pollT=setInterval(fetchLiq,8000); pricePoll(); priceT=setInterval(pricePoll,6000); klT=setInterval(function(){ if(loadedKlines)reloadKlines(); },45000); }
  function stopPoll(){ if(pollT){clearInterval(pollT);pollT=null;} if(priceT){clearInterval(priceT);priceT=null;} if(klT){clearInterval(klT);klT=null;} }
  // Feed the forming candle from the live WebSocket tick (sub-second, fresh) instead of only the cached REST poll —
  // kills the stale-price flicker that briefly inverted the last candle. Cheap when the heatmap is closed (no candle yet → early return).
  document.addEventListener('mp:price',function(ev){ if(!ev.detail||ev.detail.sym!==cur.coin)return; var p=+ev.detail.price; if(!(p>0))return;
    cur.price=p; _hWsT=Date.now(); if(ev.detail.chg!=null&&isFinite(+ev.detail.chg))cur.chg=+ev.detail.chg;
    if(pxEl)pxEl.innerHTML='$'+money(cur.price)+' <small>'+(cur.chg>=0?'+':'')+cur.chg.toFixed(2)+'%</small>';
    if(_hRaf)return; _hRaf=true; requestAnimationFrame(function(){ _hRaf=false; liveCandle(); sched(); }); });
  document.addEventListener('click',function(ev){ if(!ev.target.closest)return;
    var lev=ev.target.closest('.heat-lev'); if(lev){ var n=+lev.getAttribute('data-lev'); levSet[n]=!levSet[n]; lev.classList.toggle('active',levSet[n]); sched(); return; }
    var sd=ev.target.closest('.heat-side'); if(sd){ var sds=document.querySelectorAll('.heat-side'); for(var s=0;s<sds.length;s++)sds[s].classList.remove('active'); sd.classList.add('active'); sideMode=sd.getAttribute('data-side'); updateStats(); sched(); return; }
    var w=ev.target.closest('.heat-win'); if(w&&w.getAttribute('data-w')){ var ws=document.querySelectorAll('.heat-win[data-w]'); for(var i=0;i<ws.length;i++)ws[i].classList.remove('active'); w.classList.add('active'); win=w.getAttribute('data-w'); if(loadedKlines)reloadKlines(); fetchLiq(); return; } });
  function reloadKlines(){ var c=cur.coin,iv=WIN[win].iv;
    fetch('/api/klines?symbol='+encodeURIComponent(c)+'&interval='+iv,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){ if(c!==cur.coin)return;
      if(kd&&kd.length&&candle){ try{candle.setData(kd);chart.timeScale().fitContent();}catch(e){} lastBar=kd[kd.length-1]; _hlgp=lastBar&&lastBar.close||0; _hrej=0; }
      loadedKlines=true; setTimeout(sched,80); setTimeout(sched,400); }); }
  function load(coin){ // HEATMAP v2 (2026-07-24): the whole section is owned by the standalone /assets/mp-heatmap.js
    // (pool-model + real-liq canvas engine). Everything below this function (ensureLib/initChart/fetchLiq/startPoll)
    // is the RETIRED v1 — dormant, unreachable, kept only to avoid a risky mass-delete in this shared IIFE.
    var sec=document.getElementById('heatmap');
    if(window.mpHeatmap){window.mpHeatmap.mount(sec,coin);return;}
    if(window.__mpHmLd)return; window.__mpHmLd=1;
    var s=document.createElement('script'); s.src='/assets/mp-heatmap.js';
    s.onload=function(){window.mpHeatmap&&window.mpHeatmap.mount(document.getElementById('heatmap'),coin);};
    s.onerror=function(){window.__mpHmLd=0;};
    document.head.appendChild(s);
  }
  window.mpHeatBoot=function(c){load(c||'BTC');};
  if(sel)sel.addEventListener('change',function(){load(sel.value);});
  function shot(cb){ if(!chart)return; try{ var base=chart.takeScreenshot(),c=document.createElement('canvas'); c.width=base.width; c.height=base.height; var x=c.getContext('2d');
    x.fillStyle='#0a0b0d'; x.fillRect(0,0,c.width,c.height); /* chart layout bg is transparent -> paint our dark bg so the PNG isn't white */
    x.drawImage(base,0,0);
    if(overlay&&realMode){try{x.drawImage(overlay,0,0,c.width,c.height);}catch(e){}}
    var pad=Math.round(c.width*0.018); x.textAlign='left'; x.font='bold '+Math.round(c.width*0.026)+'px "Bricolage Grotesque",sans-serif'; x.fillStyle='#f5f5f2'; x.fillText('MARGIN',pad,c.height-pad); var mw=x.measureText('MARGIN').width; x.fillStyle='#c2f64a'; x.fillText('PAD',pad+mw,c.height-pad);
    x.textAlign='right'; x.fillStyle='#9aa3ad'; x.font=Math.round(c.width*0.016)+'px "Space Mono",monospace'; x.fillText(cur.coin+' · '+new Date().toISOString().slice(0,16).replace('T',' ')+' UTC · marginpad.io',c.width-pad,c.height-pad);
    c.toBlob(function(b){cb(b);}); }catch(e){} }
  function dl(){shot(function(b){if(!b)return;var u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='marginpad-'+cur.coin+'-liquidation-heatmap.png';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u);},3000);});}
  var dlb=document.getElementById('heatDl');if(dlb)dlb.addEventListener('click',dl);
  var shb=document.getElementById('heatSh');if(shb)shb.addEventListener('click',function(){
    shot(function(b){if(!b)return;try{var f=new File([b],'marginpad-'+cur.coin+'-heatmap.png',{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:cur.coin+' Liquidation Heatmap',text:cur.coin+' liquidation levels — marginpad.io'}).catch(function(){});return;}}catch(e){}dl();});
  });
  // product switcher
  var heatmap=document.getElementById('heatmap'),swapEl=document.getElementById('swap'),tabsEl=document.querySelector('.tabs'),cardEl=document.querySelector('.card'),loaded=false,swapInit=false;
  // Mobile: hide the calculator/product content on the landing (Browse is the entry point) — show it only on a tool route/tab.
  if(!/^\/(charts|calculators)\/?$/.test(location.pathname)&&window.matchMedia&&window.matchMedia('(max-width:680px)').matches){if(tabsEl)tabsEl.style.display='none';if(cardEl)cardEl.style.display='none';}
  function showPlan(){var ps=document.querySelectorAll('.panel');for(var q=0;q<ps.length;q++)ps[q].classList.toggle('active',ps[q].id==='plan');}
  function initSwap(){
    if(swapInit)return;swapInit=true;
    var CN_LINK='4fd768841c89de';/* ChangeNOW affiliate link_id */
    var f=document.getElementById('iframe-widget');if(!f)return;
    var lm={ru:'ru-RU',es:'es-ES',fr:'fr-FR',de:'de-DE',pt:'pt-PT',tr:'tr-TR',zh:'zh-CN',ja:'ja-JP',ko:'ko-KR',ar:'ar-AE',id:'id-ID',nl:'nl-NL'};
    var pr=['FAQ=false','amount=0.01','backgroundColor=0a0b0d','darkMode=true','from=btc','horizontal=false','lang='+(lm[window.mpLang]||'en-US'),'locales=false','logo=false','primaryColor=2ebd85','to=eth'];
    if(CN_LINK)pr.push('link_id='+CN_LINK);
    f.onload=function(){var l=document.getElementById('swapLoad');if(l)l.style.display='none';};
    f.src='https://changenow.io/embeds/exchange-widget/v2/widget.html?'+pr.join('&');
    var s=document.createElement('script');s.defer=true;s.src='https://changenow.io/embeds/exchange-widget/v2/stepper-connector.js';document.body.appendChild(s);
  }
  var prods=document.querySelectorAll('.prod');
  for(var i=0;i<prods.length;i++){prods[i].addEventListener('click',function(){
    var p=this.getAttribute('data-prod');if(!p)return; // skip nav-only cards (Rekt link, Coming-soon)
    for(var j=0;j<prods.length;j++)prods[j].classList.remove('active');this.classList.add('active');
    document.body.setAttribute('data-prod',p); // the floating liq feed only shows on the heatmap
    try{var _vp={calc:'/calculators',heat:'/heatmap',swap:'/swap',plan:'/paper-trade',charts:'/charts'}[p];if(_vp&&window.__mpNav&&!_inApply)window.__mpNav(_vp);}catch(_){}
    if(typeof stopPoll==='function')stopPoll();
    heatmap.style.display=(p==='heat')?'':'none';
    if(swapEl)swapEl.style.display=(p==='swap')?'':'none';
    var _cs=document.getElementById('chartspace');if(_cs)_cs.style.display=(p==='charts')?'':'none';
    if(p==='heat'){if(tabsEl)tabsEl.style.display='none';if(cardEl)cardEl.style.display='none';if(!HEAT_DISABLED){if(!loaded){loaded=true;load(sel?sel.value:'BTC');}else{refresh();}}}
    else if(p==='swap'){if(tabsEl)tabsEl.style.display='none';if(cardEl)cardEl.style.display='none';initSwap();}
    else if(p==='plan'){if(tabsEl)tabsEl.style.display='none';if(cardEl)cardEl.style.display='';showPlan();}
    else if(p==='charts'){if(tabsEl)tabsEl.style.display='none';if(cardEl)cardEl.style.display='none';window.mpLoadCharts(function(){window.mpCharts&&window.mpCharts.activate();});}
    else{if(tabsEl)tabsEl.style.display='';if(cardEl)cardEl.style.display='';var tb=document.querySelector('.tab[data-tab="liq"]');if(tb)tb.click();}
  });}
  if(/^\/charts\/?$/.test(location.pathname)){document.body.classList.add('charts-page');document.body.setAttribute('data-prod','charts');var _cs0=document.getElementById('chartspace');if(_cs0){var _wrap0=_cs0.parentNode;Array.prototype.forEach.call(_wrap0.children,function(ch){if(ch!==_cs0&&ch.tagName!=='HEADER'&&ch.tagName!=='FOOTER')ch.style.display='none';});_cs0.style.display='';}}
  /* Reward XP for genuinely using the charts workspace: first real interaction on the board per session → +25 XP
     (server grants once/day via dayCap, so it can't be farmed). Signed-in only; toast comes from the /api/auth/xp poll. */
  (function(){var done=false;function fire(){if(done)return;var me=(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me());if(!me||!me.id)return;done=true;try{fetch('/api/auth/chartxp',{method:'POST',credentials:'same-origin'}).catch(function(){});}catch(_){}}
    document.addEventListener('pointerdown',function(e){if(done)return;if(!document.body.classList.contains('charts-page'))return;if(e.target&&e.target.closest&&e.target.closest('#chartspace'))fire();},true);
    window.mpChartXp=fire;})();
  /* remember the last Paper Trade symbol across refreshes (owner 2026-07-13: refresh reset the chart to BTC) */
  document.addEventListener('change',function(ev){var t=ev.target;if(t&&t.id==='planSym'&&t.value)try{localStorage.setItem('mp_pt_sym',String(t.value).toUpperCase());}catch(_){}});
  window.mpPtRestoreSym=function(){try{
    if(/[?&]coin=/.test(location.search))return; // an explicit ?coin= link always wins
    var v=localStorage.getItem('mp_pt_sym');if(!v)return;
    var ps=document.getElementById('planSym');if(!ps||String(ps.value).toUpperCase()===v)return;
    var ok=false;for(var i=0;i<ps.options.length;i++)if(ps.options[i].value.toUpperCase()===v){ok=true;break;}
    if(!ok){var o=document.createElement('option');o.value=v;o.textContent=v;ps.appendChild(o);}
    ps.value=v;ps.dispatchEvent(new Event('change',{bubbles:true}));
  }catch(_){}};
  if(/^\/paper-trade\/?$/.test(location.pathname)){document.body.classList.add('paper-page');var _pt=document.querySelector('.prod[data-prod="plan"]');if(_pt)_pt.click();var _cd=document.querySelector('.card'),_wp=document.querySelector('.wrap');if(_cd&&_wp){Array.prototype.forEach.call(_wp.children,function(ch){if(ch!==_cd&&ch.tagName!=='HEADER'&&ch.tagName!=='FOOTER')ch.style.display='none';});_cd.style.display='';}var _pc=(location.search.match(/[?&]coin=([A-Za-z0-9]+)/)||[])[1];if(_pc){var _ps=document.getElementById('planSym');if(_ps){var _u=_pc.toUpperCase(),_ok=false;for(var _k=0;_k<_ps.options.length;_k++)if(_ps.options[_k].value.toUpperCase()===_u){_ok=true;break;}if(!_ok){var _o=document.createElement('option');_o.value=_u;_o.textContent=_u;_ps.appendChild(_o);}_ps.value=_u;_ps.dispatchEvent(new Event('change',{bubbles:true}));}}else{window.mpPtRestoreSym();}
    // copy-trade from the screener: also pre-fill side / leverage / SL / TP from the setup
    setTimeout(function(){var _q=location.search;function _g(k){var m=_q.match(new RegExp('[?&]'+k+'=([^&]+)'));return m?decodeURIComponent(m[1]):'';}
      var _side=_g('side'),_lev=_g('lev'),_sl=_g('sl'),_tp=_g('tp');
      if(_side==='long'||_side==='short'){var _sg=document.getElementById('planSeg');if(_sg){var _b=_sg.querySelector('[data-side="'+_side+'"]');if(_b&&!_b.classList.contains('on'))_b.click();}}
      if(_lev&&isFinite(+_lev)){var _lv=document.getElementById('planLev');if(_lv){_lv.value=String(Math.round(+_lev));_lv.dispatchEvent(new Event('input',{bubbles:true}));}}
      var _tf=_g('tf');if(_tf){var _tb=document.querySelector('#ptTf [data-tf="'+_tf+'"]');if(_tb&&!_tb.classList.contains('on'))_tb.click();} // open the chart on the requested timeframe (15m from the screener)
      if(_sl||_tp){var _ac=document.getElementById('planAdvChk');if(_ac&&!_ac.checked){_ac.checked=true;_ac.dispatchEvent(new Event('change',{bubbles:true}));}if(_sl){var _se=document.getElementById('planSlOpt');if(_se){_se.value=String(+_sl);_se.dispatchEvent(new Event('input',{bubbles:true}));}}if(_tp){var _te=document.getElementById('planTpOpt');if(_te){_te.value=String(+_tp);_te.dispatchEvent(new Event('input',{bubbles:true}));}}}
      try{if(window.mpPlanRisk)window.mpPlanRisk();}catch(e){}
    },300);}
  if(/^\/calculators\/?$/.test(location.pathname)){document.body.classList.add('calc-page');var _ccd=document.querySelector('.card'),_ctb0=document.querySelector('.tabs'),_cwp=document.querySelector('.wrap');if(_cwp){Array.prototype.forEach.call(_cwp.children,function(ch){if(ch!==_ccd&&ch!==_ctb0&&ch.tagName!=='HEADER'&&ch.tagName!=='FOOTER')ch.style.display='none';});}if(_ctb0)_ctb0.style.display='';if(_ccd)_ccd.style.display='';var _ct=(location.search.match(/[?&]c=([a-z]+)/)||[])[1]||'liq';var _ctb=document.querySelector('.tab[data-tab="'+_ct+'"]')||document.querySelector('.tab[data-tab="liq"]');if(_ctb)_ctb.click();}
  if(/^\/(heatmap|swap)\/?$/.test(location.pathname)){var _pid=/heatmap/.test(location.pathname)?'heatmap':'swap',_pd=_pid==='heatmap'?'heat':'swap';document.body.classList.add(_pid+'-page');document.body.setAttribute('data-prod',_pd);var _pe=document.querySelector('.prod[data-prod="'+_pd+'"]');if(_pe)_pe.click();var _se=document.getElementById(_pid),_we=document.querySelector('.wrap');if(_se&&_we){Array.prototype.forEach.call(_we.children,function(ch){if(ch!==_se&&ch.tagName!=='HEADER'&&ch.tagName!=='FOOTER')ch.style.display='none';});_se.style.display='';}var _hc=(location.search.match(/[?&]coin=([A-Za-z0-9]+)/)||[])[1];if(_pid==='heatmap'&&window.mpHeatBoot)window.mpHeatBoot(_hc);}/* boots the v2 module directly — the old .prod[data-prod=heat] click has been a no-op since the prodnav card became an <a href> (2026-07-03) */
  var _pq=(location.search.match(/[?&]p=(heat|swap|plan|charts)/)||[])[1]||(/heatmap/i.test(location.hash)?'heat':(/swap/i.test(location.hash)?'swap':''));
  var _coin=(location.search.match(/[?&]coin=([A-Za-z0-9]+)/)||[])[1];
  if(_pq){var hb=document.querySelector('.prod[data-prod="'+_pq+'"]');if(hb)hb.click();
    if(_pq==='heat'&&_coin){var hcS=document.getElementById('heatCoin');if(hcS){var cu=_coin.toUpperCase(),ok=false;for(var ci=0;ci<hcS.options.length;ci++)if(hcS.options[ci].value===cu){ok=true;break;}if(ok){hcS.value=cu;hcS.dispatchEvent(new Event('change',{bubbles:true}));}}}}
  // ===== Instant in-page navigation between the homepage-served tools (no reload, smooth cross-fade) =====
  var _inApply=false;
  function _unhideWrap(){var wrap=document.querySelector('.wrap');if(wrap)Array.prototype.forEach.call(wrap.children,function(ch){if(ch.style&&ch.style.display==='none')ch.style.display='';});}
  // Apply a screener copy-trade setup (side / leverage / SL / TP) to the Paper Trade form. Used BOTH on first page load
  // AND on SPA navigation (applyRoute) — the screener links are intercepted into in-page routes, so without this the
  // leverage/SL/TP never get applied (only the coin did) and the trade opened at the default 1000×.
  function mpPlanSetup(search){ search=search||'';
    function _g(k){var m=search.match(new RegExp('[?&]'+k+'=([^&]+)'));return m?decodeURIComponent(m[1]):'';}
    var _side=_g('side'),_lev=_g('lev'),_sl=_g('sl'),_tp=_g('tp'),_tf=_g('tf');
    if(!(_side||_lev||_sl||_tp||_tf))return;
    setTimeout(function(){
      if(_side==='long'||_side==='short'){var _sg=document.getElementById('planSeg');if(_sg){var _b=_sg.querySelector('[data-side="'+_side+'"]');if(_b&&!_b.classList.contains('on'))_b.click();}}
      if(_lev&&isFinite(+_lev)){var _lv=document.getElementById('planLev');if(_lv){_lv.value=String(Math.round(+_lev));_lv.dispatchEvent(new Event('input',{bubbles:true}));}}
      if(_tf){var _tb=document.querySelector('#ptTf [data-tf="'+_tf+'"]');if(_tb&&!_tb.classList.contains('on'))_tb.click();}
      if(_sl||_tp){var _ac=document.getElementById('planAdvChk');if(_ac&&!_ac.checked){_ac.checked=true;_ac.dispatchEvent(new Event('change',{bubbles:true}));}if(_sl){var _se=document.getElementById('planSlOpt');if(_se){_se.value=String(+_sl);_se.dispatchEvent(new Event('input',{bubbles:true}));}}if(_tp){var _te=document.getElementById('planTpOpt');if(_te){_te.value=String(+_tp);_te.dispatchEvent(new Event('input',{bubbles:true}));}}}
      try{if(window.mpPlanRisk)window.mpPlanRisk();}catch(e){}
    },320);
  }
  window.mpPlanSetup=mpPlanSetup;
  function applyRoute(path,search){ search=search||'';
    try{var _uxT=performance.now();requestAnimationFrame(function(){try{window.__mpUxm&&window.__mpUxm('nav',performance.now()-_uxT);}catch(e){}});}catch(e){} // UX budget: SPA transition → next paint
    try{var _ss=document.querySelector('.scr-sheet.on');if(_ss)_ss.classList.remove('on');}catch(e){} // close the screener action sheet so it doesn't carry over onto the new route
    var hc=document.documentElement;
    hc.className=hc.className.replace(/\s*\broute-(paper|charts|calc|screener)\b/g,'');
    document.body.classList.remove('paper-page','charts-page','calc-page','heatmap-page','swap-page');
    _unhideWrap(); // restore marketing sections, then re-hide the default-hidden tool sections (each route shows the one it needs)
    var cs=document.getElementById('chartspace');
    ['chartspace','heatmap','swap','screener'].forEach(function(id){var _e=document.getElementById(id);if(_e)_e.style.display='none';});
    if(/^\/charts\/?$/.test(path)){
      document.body.classList.add('charts-page');document.body.setAttribute('data-prod','charts');
      if(cs){var w=cs.parentNode;Array.prototype.forEach.call(w.children,function(ch){if(ch!==cs&&ch.tagName!=='HEADER'&&ch.tagName!=='FOOTER')ch.style.display='none';});cs.style.display='';}
      try{window.mpLoadCharts(function(){window.mpCharts&&window.mpCharts.activate();});}catch(_){}
    } else if(/^\/paper-trade\/?$/.test(path)){
      document.body.classList.add('paper-page');
      var pt=document.querySelector('.prod[data-prod="plan"]');if(pt)pt.click();
      var cd=document.querySelector('.card'),wp=document.querySelector('.wrap');
      if(cd&&wp){Array.prototype.forEach.call(wp.children,function(ch){if(ch!==cd&&ch.tagName!=='HEADER'&&ch.tagName!=='FOOTER')ch.style.display='none';});cd.style.display='';}
      var pc=(search.match(/[?&]coin=([A-Za-z0-9]+)/)||[])[1];
      if(pc){var ps=document.getElementById('planSym');if(ps){var u=pc.toUpperCase(),ok=false;for(var k=0;k<ps.options.length;k++)if(ps.options[k].value.toUpperCase()===u){ok=true;break;}if(!ok){var o=document.createElement('option');o.value=u;o.textContent=u;ps.appendChild(o);}ps.value=u;ps.dispatchEvent(new Event('change',{bubbles:true}));}}
      else{try{window.mpPtRestoreSym();}catch(_){}}
      mpPlanSetup(search); // also apply side / leverage / SL / TP from a screener copy-trade link (SPA navigation)
    } else if(/^\/calculators\/?$/.test(path)){
      document.body.classList.add('calc-page');document.body.setAttribute('data-prod','calc');
      var cd2=document.querySelector('.card'),tb0=document.querySelector('.tabs'),wp2=document.querySelector('.wrap');
      if(wp2){Array.prototype.forEach.call(wp2.children,function(ch){if(ch!==cd2&&ch!==tb0&&ch.tagName!=='HEADER'&&ch.tagName!=='FOOTER')ch.style.display='none';});}
      if(tb0)tb0.style.display='';if(cd2)cd2.style.display='';
      var ctv=(search.match(/[?&]c=([a-z]+)/)||[])[1]||'liq';var ctb=document.querySelector('.tab[data-tab="'+ctv+'"]')||document.querySelector('.tab[data-tab="liq"]');if(ctb)ctb.click();
    } else if(/^\/(heatmap|swap)\/?$/.test(path)){ var _pid=/heatmap/.test(path)?'heatmap':'swap',_pd=_pid==='heatmap'?'heat':'swap'; document.body.classList.add(_pid+'-page'); document.body.setAttribute('data-prod',_pd); var _pe=document.querySelector('.prod[data-prod="'+_pd+'"]'); if(_pe)_pe.click(); var _se=document.getElementById(_pid),_we=document.querySelector('.wrap'); if(_se&&_we){Array.prototype.forEach.call(_we.children,function(ch){if(ch!==_se&&ch.tagName!=='HEADER'&&ch.tagName!=='FOOTER')ch.style.display='none';});_se.style.display='';} var _hc=(search.match(/[?&]coin=([A-Za-z0-9]+)/)||[])[1]; if(_pid==='heatmap'&&window.mpHeatBoot)window.mpHeatBoot(_hc);
    } else { // homepage ("/"), optionally with ?p=heat|swap
      document.body.setAttribute('data-prod','calc');
      var pq=(search.match(/[?&]p=(heat|swap|plan|charts)/)||[])[1];
      if(pq){var hb=document.querySelector('.prod[data-prod="'+pq+'"]');if(hb)hb.click();}
      else{var cb=document.querySelector('.prod[data-prod="calc"]');if(cb)cb.click();} // reset the shared .card back to the calculator (fixes Back-to-home showing the Paper Trade panel)
      try{window.scrollTo(0,0);}catch(_){}
    }
    if(!/^\/charts\/?$/.test(path)){ requestAnimationFrame(function(){ try{ if(window.mpBgKick) window.mpBgKick(); }catch(_){} }); } // re-wake the animated background after the /charts page kept it display:none → 0×0
  }
  function mpGo(path){ var u; try{u=new URL(path,location.href);}catch(e){location.href=path;return;}
    if(u.pathname==='/'&&!u.search){ location.href='/'; return; } // the homepage is now the separate bento page — a real nav, not an in-page applyRoute that would show the stale app-shell homepage
    if(/^\/charts\/?$/.test(u.pathname)&&window.matchMedia&&window.matchMedia('(max-width: 880px)').matches){ location.href=u.pathname+u.search; return; } // MOBILE /charts must FULL-navigate (2026-07-30): the mp-mcharts loader only hooks the INITIAL /charts landing, never SPA routes (documented gotcha — same root cause as the My Trades Chart-button break). An intercepted SPA route (e.g. the mp-nav drawer's Charts link on /paper-trade) stranded the user on a dead app-shell page with no mobile charts. Guard here covers the link-interceptor AND every programmatic mpGo; since mobile never pushStates /charts, no popstate case can arise either.
    var run=function(){ _inApply=true; try{ history.pushState({mp:1},'',u.pathname+u.search); applyRoute(u.pathname,u.search); }catch(e){ _inApply=false; location.href=u.pathname+u.search; return; } _inApply=false; try{if(window.__mpNav)window.__mpNav(u.pathname);}catch(_){} };
    if(document.startViewTransition){try{document.startViewTransition(run);}catch(e){run();}}else run();
  }
  window.mpGo=mpGo;
  document.addEventListener('click',function(ev){
    if(ev.defaultPrevented||ev.button!==0||ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey)return;
    var a=ev.target.closest&&ev.target.closest('a[href]');if(!a)return;
    if((a.target&&a.target!=='_self')||a.hasAttribute('download'))return;
    var hrefAttr=a.getAttribute('href');if(!hrefAttr||hrefAttr.charAt(0)==='#')return;
    var u;try{u=new URL(a.href,location.href);}catch(e){return;}
    if(u.origin!==location.origin)return;
    var p=u.pathname;
    if(!(/^\/paper-trade\/?$/.test(p)||/^\/charts\/?$/.test(p)||/^\/calculators\/?$/.test(p)||/^\/heatmap\/?$/.test(p)||/^\/swap\/?$/.test(p)))return; // only intercept in-page switches between the homepage-served TOOLS. '/' (the new bento homepage), screener/rewards/rekt/coins/blog navigate normally.
    if(p===location.pathname&&u.search===location.search)return;
    ev.preventDefault(); mpGo(u.pathname+u.search);
  });
  window.addEventListener('popstate',function(){ var run=function(){ _inApply=true; try{applyRoute(location.pathname,location.search);}catch(e){} _inApply=false; }; if(document.startViewTransition){try{document.startViewTransition(run);}catch(e){run();}}else run(); });
  if(window.addEventListener)window.addEventListener('resize',refresh);
})();

;/* ══════════ inline block from app/index.html line 4331 ══════════ */
(function(){
  if(window.matchMedia&&window.matchMedia('(max-width:760px)').matches)return; // desktop-only polish (cursor spotlight / scroll-reveal / count-up) — skip on phones: it wires mousemove + reads getBoundingClientRect in loops (forced layout) + sets MutationObservers, all wasted on touch where the calc is hidden and reveals are frozen
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  // 1) spotlight that follows the cursor on the product cards
  var prods=document.querySelectorAll('.prod');
  for(var i=0;i<prods.length;i++){(function(c){c.addEventListener('mousemove',function(e){var r=c.getBoundingClientRect();c.style.setProperty('--mx',(e.clientX-r.left)+'px');c.style.setProperty('--my',(e.clientY-r.top)+'px');});})(prods[i]);}
  // 2) scroll-reveal for below-the-fold sections
  if(!reduce && 'IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target);}});},{threshold:0.08,rootMargin:'0px 0px -40px 0px'});
    var secs=document.querySelectorAll('.hotpairs,.exchanges,.league,.tvsec,.tools,.content2');
    for(var s=0;s<secs.length;s++){ if(secs[s].getBoundingClientRect().top > window.innerHeight*0.9){ secs[s].classList.add('reveal'); io.observe(secs[s]); } }
  }
  // 3) count-up on calculator result numbers
  if(!reduce){
    function countUp(el, finalStr){
      var m=String(finalStr).match(/^([^\d\-]*)(-?[\d,]*\.?\d+)([\s\S]*)$/);
      if(!m){ el.textContent=finalStr; el._cuFinal=finalStr; return; }
      var pre=m[1], numStr=m[2], suf=m[3], hasComma=numStr.indexOf(',')>=0, dot=numStr.split('.'), dec=dot[1]?dot[1].length:0;
      var target=parseFloat(numStr.replace(/,/g,''));
      if(!isFinite(target)){ el.textContent=finalStr; el._cuFinal=finalStr; return; }
      var start=(el._cuVal!=null&&isFinite(el._cuVal))?el._cuVal:target;
      if(Math.abs(target-start)<1e-9){ el.textContent=finalStr; el._cuFinal=finalStr; el._cuVal=target; return; }
      el._cuFinal=finalStr; el._busy=true;
      el.classList.remove('cu-pop'); void el.offsetWidth; el.classList.add('cu-pop');
      function fmt(v){ var sg=v<0?'-':''; v=Math.abs(v); var sv=v.toFixed(dec); if(hasComma){var p=sv.split('.');p[0]=(+p[0]).toLocaleString('en-US');sv=p.join('.');} return pre+sg+sv+suf; }
      var t0=performance.now(), dur=420;
      function step(now){var p=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-p,3),v=start+(target-start)*e;el.textContent=fmt(v);if(p<1){el._raf=requestAnimationFrame(step);}else{el.textContent=finalStr;el._cuVal=target;el._busy=false;}}
      if(el._raf)cancelAnimationFrame(el._raf); el._raf=requestAnimationFrame(step);
    }
    var obs=new MutationObserver(function(muts){
      for(var k=0;k<muts.length;k++){var t=muts[k].target;var el=t.nodeType===3?t.parentNode:t;
        if(!el||el._isCu!==true||el._busy)continue;
        var txt=el.textContent; if(txt===el._cuFinal)continue; countUp(el,txt);}
    });
    var tg=document.querySelectorAll('.results .rvalue, .results .rrow .v');
    for(var g=0;g<tg.length;g++){(function(el){el._isCu=true;el._cuFinal=el.textContent;var n=parseFloat(String(el.textContent).replace(/[^0-9.\-]/g,''));el._cuVal=isFinite(n)?n:null;obs.observe(el,{childList:true,characterData:true,subtree:true});})(tg[g]);}
  }
})();

;/* ══════════ inline block from app/index.html line 4371 ══════════ */
(function(){
  function enhance(sel, withSearch, freeEntry, floating){
    if(!sel||sel._csel)return; sel._csel=true;
    var wrap=document.createElement('div'); wrap.className='csel';
    sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(sel); sel.classList.add('csel-native');
    var trig=document.createElement('button'); trig.type='button'; trig.className='csel-trigger';
    trig.innerHTML='<span class="csel-val"></span><svg class="csel-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
    var lab=trig.querySelector('.csel-val'); wrap.appendChild(trig);
    var panel=document.createElement('div'); panel.className='csel-panel'; panel.hidden=true;
    var search=null;
    if(withSearch){ search=document.createElement('input'); search.className='csel-search'; search.type='text'; search.setAttribute('placeholder','Search…'); panel.appendChild(search); }
    var list=document.createElement('div'); list.className='csel-list'; panel.appendChild(list); if(floating){document.body.appendChild(panel);}else{wrap.appendChild(panel);}
    function sync(){ var o=sel.options[sel.selectedIndex]; if(sel._cselDeco&&o){lab.innerHTML=sel._cselDeco(o);}else{lab.textContent=o?o.textContent:'';} }
    function build(){ list.innerHTML='';
      for(var i=0;i<sel.options.length;i++){(function(o,idx){
        var it=document.createElement('button'); it.type='button'; it.className='csel-opt'+(idx===sel.selectedIndex?' sel':'');
        if(sel._cselDeco){it.innerHTML=sel._cselDeco(o);}else{it.textContent=o.textContent;} /* deco: rich option rows (e.g. exchange chips) */
        it.addEventListener('click',function(){ if(sel.selectedIndex!==idx){ sel.selectedIndex=idx; sync(); sel.dispatchEvent(new Event('change',{bubbles:true})); } close(); }); /* selectedIndex, NOT value — the exchange presets share values (0.5) and value-matching snapped every pick to the first one */
        list.appendChild(it);
      })(sel.options[i],i); }
    }
    function onTouchMove(e){ if(list.contains(e.target))return; e.preventDefault(); } // while the dropdown is open, only the list scrolls — never the page behind it (fixes mobile scroll-chaining / first-touch break-through)
    function place(){ var r=trig.getBoundingClientRect(); panel.style.position='fixed'; panel.style.left=r.left+'px'; panel.style.top=(r.bottom+6)+'px'; panel.style.width=Math.max(r.width,160)+'px'; panel.style.right='auto'; panel.style.zIndex='1000'; } // floating mode: anchor the panel to the trigger and escape the chart card's overflow/stacking so it never hides behind the chart
    function open(){ build(); panel.hidden=false; trig.classList.add('open'); if(floating){place();window.addEventListener('scroll',place,true);window.addEventListener('resize',place);} document.addEventListener('touchmove',onTouchMove,{passive:false}); if(search){search.value='';filter('');setTimeout(function(){search.focus();},20);} var s=list.querySelector('.csel-opt.sel'); if(s)s.scrollIntoView({block:'nearest'}); }
    function close(){ panel.hidden=true; trig.classList.remove('open'); if(floating){window.removeEventListener('scroll',place,true);window.removeEventListener('resize',place);} document.removeEventListener('touchmove',onTouchMove,{passive:false}); }
    function useVal(v){ v=String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,16); if(!v)return; var f=false; for(var i=0;i<sel.options.length;i++){ if(sel.options[i].value.toUpperCase()===v){f=true;break;} } if(!f){ var o=document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o); } var ch=sel.value!==v; sel.value=v; sync(); if(ch)sel.dispatchEvent(new Event('change',{bubbles:true})); close(); }
    function filter(q){ q=(q||'').toLowerCase(); var exact=false,o=list.children; for(var i=0;i<o.length;i++){ if(o[i].classList.contains('csel-add'))continue; var t=o[i].textContent.toLowerCase(); o[i].style.display=t.indexOf(q)>=0?'':'none'; if(t===q)exact=true; }
      if(freeEntry){ var add=list.querySelector('.csel-add'); var qc=(search?search.value:'').toUpperCase().replace(/[^A-Z0-9]/g,''); if(qc&&!exact){ var _tok=!window.mpIsBybit||window.mpIsBybit(qc); if(!add){ add=document.createElement('button'); add.type='button'; add.className='csel-opt csel-add'; add.addEventListener('click',function(){ if(add._ok)useVal(add._sym); }); list.appendChild(add); } add._ok=_tok; add._sym=qc; if(_tok){ add.textContent='⊕ Trade '+qc; add.style.opacity=''; } else { add.textContent=qc+' — not on Bybit (paper trade unavailable)'; add.style.opacity='.5'; } add.style.display=''; } else if(add){ add.style.display='none'; } } }
    trig.addEventListener('click',function(e){ e.stopPropagation(); if(panel.hidden){open();}else{close();} });
    if(search){ search.addEventListener('input',function(){ filter(search.value); }); if(freeEntry)search.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); var _q=(search.value||'').toUpperCase().replace(/[^A-Z0-9]/g,''); if(!window.mpIsBybit||window.mpIsBybit(_q))useVal(search.value); } }); }
    document.addEventListener('click',function(e){ if(!wrap.contains(e.target)&&!panel.contains(e.target)) close(); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') close(); });
    sel.addEventListener('change', sync); sync();
  }
  function init(){
    enhance(document.getElementById('heatCoin'), true);
    enhance(document.getElementById('planSym'), true, true, true);
    // exchange presets (liq + cross calc + paper-trade advanced) → branded rows instead of the OS default dropdown
    var EXCOL={'Binance':['#f0b90b','#181a20'],'Bybit':['#f7a600','#0a0b0d'],'OKX':['#e9e7df','#0a0b0d'],'Bitget':['#00e7d8','#06231d'],'KuCoin':['#23af91','#06231d'],'Gate':['#3361ff','#ffffff'],'Kraken':['#7b5cff','#ffffff'],'MEXC':['#0ac2d6','#06231d'],'Crypto.com':['#0b2e7a','#ffffff']};
    function exDeco(o){var t=o.textContent||'',m=t.split('—'),name=(m[0]||t).trim(),rate=(m[1]||'').trim();
      if(!rate&&/custom/i.test(name))return '<span class="csel-ex"><i class="cx-m cx-custom">%</i><b>Custom</b><small>type your own rate</small></span>';
      var c=EXCOL[name]||['#3a4450','#e9e7df'];
      return '<span class="csel-ex"><i class="cx-m" style="background:'+c[0]+';color:'+c[1]+'">'+name.charAt(0)+'</i><b>'+name+'</b>'+(rate?'<small>'+rate+'</small>':'')+'</span>';}
    ['liqEx','crEx','planEx'].forEach(function(id){var el=document.getElementById(id);if(el){el._cselDeco=exDeco;enhance(el);}});
    /* langSel stays a native select — matches the homepage header (EN box, not a globe) */
    (window.requestIdleCallback||function(f){setTimeout(f,1500);})(function(){if(window.mpLoadTokens)window.mpLoadTokens(function(toks){var ps=document.getElementById('planSym');if(!ps)return;var have={};for(var i=0;i<ps.options.length;i++)have[ps.options[i].value.toUpperCase()]=1;toks.forEach(function(s){if(!have[s]){var o=document.createElement('option');o.value=s;o.textContent=s;ps.appendChild(o);}});});});
  }
  if(document.readyState!=='loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();

;/* ══════════ inline block from app/index.html line 4414 ══════════ */
/* Global live-liquidation feed (floating left cards) — REMOVED; replaced by the /rekt/ live feed page. */
(function(){
  return;
  var box=null, seen={}, order=[], first=true;
  function money(n){ n=+n; if(n>=1e6)return (n/1e6).toFixed(n>=1e7?0:1)+'M'; if(n>=1e3)return (n/1e3).toFixed(0)+'K'; return n.toFixed(0); }
  function px(p){ p=+p; return p>=1?p.toLocaleString('en-US',{maximumFractionDigits:2}):p.toLocaleString('en-US',{maximumFractionDigits:6}); }
  function ensure(){ if(box)return; box=document.createElement('div'); box.className='lqfeed'; box.setAttribute('aria-hidden','true'); document.body.appendChild(box); }
  function add(e){ ensure(); var card=document.createElement('div'); card.className='lqf-card'; var lng=e.side==='long_liquidated';
    card.innerHTML='<div class="lqf-r"><span class="lqf-s">'+(lng?'LONG LIQ':'SHORT LIQ')+'</span><span class="lqf-a">$'+money(e.notional)+'</span></div><div class="lqf-m">'+e.symbol+' · '+px(e.price)+' · '+e.exchange+'</div>';
    box.appendChild(card); requestAnimationFrame(function(){card.classList.add('in');});
    setTimeout(function(){ card.classList.remove('in'); card.classList.add('out'); setTimeout(function(){ if(card.parentNode)card.remove(); },600); },20000);
    while(box.children.length>6) box.firstChild.remove();
  }
  function poll(){ fetch('/api/v1/feed?min=5000&limit=25').then(function(r){return r.json();}).then(function(j){
    if(!j||!Array.isArray(j.events))return; var fresh=[];
    for(var i=0;i<j.events.length;i++){ var e=j.events[i],k=e.ts+'|'+e.symbol+'|'+e.price+'|'+e.exchange; if(!seen[k]){seen[k]=1;order.push(k);fresh.push(e);} }
    while(order.length>600) delete seen[order.shift()];
    var show=(first?fresh.slice(0,2):fresh.slice(0,4)); first=false; show.reverse(); for(var s=0;s<show.length;s++) add(show[s]);
  }).catch(function(){}); }
  function start(){ if(window.innerWidth<760)return; poll(); setInterval(poll,4500); } // re-enabled 2026-07-24 — collector lives on the new DigitalOcean droplet
  if(document.readyState!=='loading')start(); else document.addEventListener('DOMContentLoaded',start);
})();

;/* ══════════ inline block from app/index.html line 4438 ══════════ */
/* reveal sections on scroll (staggered, respects reduced-motion) */
(function(){
  var sel='.exchanges,.hotpairs,.tvsec,.tools,.site-foot,.faqs,.calc-seo';
  if(window.matchMedia&&window.matchMedia('(max-width:760px)').matches)return; // phones: render sections immediately (no reveal-up) — skips the per-section getBoundingClientRect + IntersectionObserver setup
  var els=[].slice.call(document.querySelectorAll(sel));
  if(!els.length)return;
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){return;}
  if(!('IntersectionObserver'in window)){els.forEach(function(e){e.classList.add('in');});return;}
  var io=new IntersectionObserver(function(ents){ents.forEach(function(en){if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target);}});},{threshold:.06,rootMargin:'0px 0px -36px 0px'});
  els.forEach(function(e){e.classList.add('reveal-up');io.observe(e);});
})();
/* sticky-header backdrop appears once scrolled */
(function(){var on=false;function upd(){var s=(window.scrollY||window.pageYOffset||0)>16;if(s!==on){on=s;document.body.classList.toggle('scrolled',s);}}window.addEventListener('scroll',upd,{passive:true});upd();})();
/* scroll-to-top */
(function(){var b=document.getElementById('toTop');if(!b)return;function upd(){b.classList.toggle('on',(window.scrollY||window.pageYOffset||0)>520);}window.addEventListener('scroll',upd,{passive:true});upd();b.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});})();
/* click-to-copy on the calculator result + Paper Trade price */
(function(){
  document.querySelectorAll('.rvalue').forEach(function(el){el.classList.add('copynum');if(!el.title)el.title='Click to copy';});
  function tip(x,y,msg){var t=document.createElement('div');t.className='copied-tip';t.textContent=msg;t.style.left=x+'px';t.style.top=y+'px';document.body.appendChild(t);setTimeout(function(){t.style.transition='opacity .3s';t.style.opacity='0';},750);setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},1100);}
  document.addEventListener('click',function(e){var el=e.target.closest&&e.target.closest('.copynum');if(!el)return;var txt=(el.textContent||'').trim();if(!txt||txt==='…'||txt==='—')return;var r=el.getBoundingClientRect();function ok(){tip(r.left+r.width/2,r.top,'Copied ✓');}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,function(){});}else{ok();}});
})();
/* 15. + #5 count-up tween & pulse the calculator result when its value changes */
(function(){if(!('MutationObserver'in window)||!window.requestAnimationFrame)return;
  if(window.matchMedia&&window.matchMedia('(max-width:760px)').matches)return; // calc is hidden on phones — skip the per-result MutationObserver count-up
  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
  function parse(txt){var m=String(txt).match(/-?[\d,]*\.?\d+/);if(!m)return null;var raw=m[0];var num=parseFloat(raw.replace(/,/g,''));if(!isFinite(num))return null;
    return {num:num,dec:(raw.split('.')[1]||'').length,pre:txt.slice(0,m.index),suf:txt.slice(m.index+raw.length),grp:raw.indexOf(',')>=0};}
  function fmt(v,info){var s=info.grp?v.toLocaleString('en-US',{minimumFractionDigits:info.dec,maximumFractionDigits:info.dec}):v.toFixed(info.dec);return info.pre+s+info.suf;}
  document.querySelectorAll('.rvalue').forEach(function(el){
    var last=null,i0=parse((el.textContent||'').trim());if(i0)last=i0.num;
    var mo=new MutationObserver(function(){
      if(el.dataset.ctng==='1')return;
      var txt=(el.textContent||'').trim(),info=parse(txt);
      el.classList.remove('changed');void el.offsetWidth;el.classList.add('changed');
      if(!info||last===null||last===info.num||RM){if(info)last=info.num;return;}
      var from=last,to=info.num,start=null,dur=420;el.dataset.ctng='1';
      function step(ts){if(start===null)start=ts;var p=Math.min(1,(ts-start)/dur),e=1-Math.pow(1-p,3),cur=from+(to-from)*e;
        el.textContent=fmt(cur,info);if(p<1){requestAnimationFrame(step);}else{el.textContent=txt;el.dataset.ctng='';last=to;}}
      requestAnimationFrame(step);
    });
    mo.observe(el,{childList:true,characterData:true,subtree:true});
  });
})();
/* #2 directional price-tick flash on live numbers */
(function(){if(!('MutationObserver'in window))return;
  var SEL='#heatPx,.hp-price'; /* paper-trade live prices now roll smoothly (mpSmoothPx) instead of flashing */
  function val(el){var m=String(el.textContent||'').replace(/,/g,'').match(/-?\d*\.?\d+/);return m?parseFloat(m[0]):NaN;}
  function watch(el){if(el.__tf)return;el.__tf=1;var last=val(el);
    new MutationObserver(function(){var v=val(el);if(isFinite(v)&&isFinite(last)&&v!==last){el.classList.remove('tickflash-up','tickflash-dn');void el.offsetWidth;el.classList.add(v>last?'tickflash-up':'tickflash-dn');}if(isFinite(v))last=v;}).observe(el,{childList:true,characterData:true,subtree:true});}
  function scan(){document.querySelectorAll(SEL).forEach(watch);}
  scan();setInterval(scan,2500);
})();
/* #4 skeleton on the heatmap price until it loads */
(function(){var el=document.getElementById('heatPx');if(!el)return;
  function has(){return /\d/.test(el.textContent||'');}
  if(!has()){el.classList.add('skel');new MutationObserver(function(){if(has())el.classList.remove('skel');}).observe(el,{childList:true,characterData:true,subtree:true});}
})();
/* #9 heatmap colour legend (injected once, above the chart) */
(function(){var anchor=document.getElementById('heatChart');if(!anchor||document.querySelector('.heat-legend'))return;
  var d=document.createElement('div');d.className='heat-legend';
  d.innerHTML='<span class="lg"><span class="sw long"></span>Longs liquidate</span>'+
    '<span class="lg"><span class="sw short"></span>Shorts liquidate</span>'+
    '<span class="lg"><span class="sw px"></span>Live price</span>'+
    '<span class="scale">low<span class="bar"></span>high · liq volume</span>';
  anchor.parentNode.insertBefore(d,anchor);
})();
/* 4. mobile-nav active item tracks the current product */
(function(){var nav=document.querySelector('.mobnav');if(!nav)return;var map={plan:'plan'};function upd(){var p=document.body.getAttribute('data-prod')||'calc';var mn=map[p]||null;nav.querySelectorAll('button').forEach(function(b){b.classList.toggle('active',!!mn&&b.getAttribute('data-mn')===mn);});}if('MutationObserver'in window)new MutationObserver(upd).observe(document.body,{attributes:true,attributeFilter:['data-prod']});upd();})();
/* Hero CTA → jump to a product tab */
(function(){document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-prod-jump]');if(!b)return;e.preventDefault();var t=document.querySelector('.prod[data-prod="'+b.getAttribute('data-prod-jump')+'"]');if(t){t.click();var n=document.querySelector('.prodnav')||t;n.scrollIntoView({behavior:'smooth',block:'start'});}});})();
/* Paper Trade always opens the dedicated full-screen /paper-trade page (homepage prodnav card + hero CTA). The in-page .prod[data-prod=plan].click() is still used internally by the router when already on /paper-trade — so only intercept a USER click made elsewhere. */
(function(){var pc=document.querySelector('.prod[data-prod="plan"]');if(!pc)return;
  pc.addEventListener('click',function(e){
    if(/^\/paper-trade\/?$/.test(location.pathname))return; // on the dedicated page → let the in-page activation proceed
    e.preventDefault();e.stopPropagation();
    if(window.mpGo){window.mpGo('/paper-trade');}else{location.href='/paper-trade';}
  },true);
})();
/* Smooth live prices — ease the displayed value toward the latest real price every frame so big numbers ROLL
   instead of jumping (feels alive + smooth, never a static step). Honest: only ever shows values between two
   real consecutive ticks. mpSmoothPx(el, value, fmtFn) registers an element; the rAF loop animates it. */
(function(){
  var states={}; // keyed state so the roll persists even when a ticket rebuilds its element
  function dpFor(v){ v=Math.abs(+v)||0; return v>=1000?2 : v>=100?3 : v>=10?3 : v>=1?4 : v>=0.1?4 : v>=0.01?5 : v>=0.001?6 : v>=0.0001?7 : 8; }     // ~5 sig figs; $1-100 coins now keep 3-4 dp (XRP 1.0904, SOL 74.093) instead of collapsing to 2
  function fmt(v,dp){ return '$'+v.toLocaleString('en-US',{minimumFractionDigits:dp,maximumFractionDigits:dp}); } // min=max → width never changes
  window.mpSmoothPx=function(el,value,key){
    if(!el||!(value>0))return false;
    key=(typeof key==='string'&&key)?key:(el.id||null); if(!key)return false;
    var s=states[key]; if(!s){s=states[key]={cur:value};}
    s.el=el; s.target=value; s.dp=dpFor(value);
    if(!(s.cur>0)||Math.abs(value-s.cur)>value*0.25)s.cur=value; // snap on first set or a huge jump (e.g. symbol switch)
    el.textContent=fmt(s.cur,s.dp);
    return true;
  };
  var EASE=0.045; // slower, more visible roll (~1.1s to settle) — the price "rolls" gently between ticks instead of snapping
  /* event-driven since 2026-07-14 (mobile perf): the loop used to rAF forever even with nothing to ease — it now
     stops when every price has settled and restarts on the next mpSmoothPx() call (pollers/WS keep those coming),
     plus a visibilitychange kick. Worst case with no new ticks: the last written value stays — correct. */
  var _smRun=false;
  function tick(){
    var busy=false,now=Date.now();
    if(!document.hidden){
      for(var k in states){var s=states[k];if(!s.el||!(s.target>0))continue;
        if(s.visT===undefined||now-s.visT>1000){s.vis=!!s.el.offsetParent;s.visT=now;} // hidden elements (hp-grid etc. on route pages) don't deserve 60fps formatting — re-check 1x/s
        if(!s.vis){if(s.cur!==s.target){s.cur=s.target;s.el.textContent=fmt(s.cur,s.dp);}continue;}
        var d=s.target-s.cur, eps=Math.max(1e-9,Math.abs(s.target)*5e-7);
        if(Math.abs(d)>eps){s.cur+=d*EASE;s.el.textContent=fmt(s.cur,s.dp);busy=true;}
        else if(s.cur!==s.target){s.cur=s.target;s.el.textContent=fmt(s.cur,s.dp);}
      }
    }
    if(busy)requestAnimationFrame(tick);else _smRun=false;
  }
  function kick(){if(!_smRun){_smRun=true;requestAnimationFrame(tick);}}
  var _reg=window.mpSmoothPx;
  window.mpSmoothPx=function(el,value,key){var r=_reg(el,value,key);if(r)kick();return r;};
  try{document.addEventListener('visibilitychange',function(){if(!document.hidden)kick();});}catch(_){}
})();

;/* ══════════ inline block from app/index.html line 4547 ══════════ */
/* Charts workspace is lazy-loaded (was 111KB inline → off the homepage critical path). Injected on first Charts open or /charts landing. */
window.mpLoadCharts=function(cb){
  if(window.mpCharts){ if(cb)cb(); return; }
  window.__chCbs=window.__chCbs||[]; if(cb)window.__chCbs.push(cb);
  if(window.__chLoading)return; window.__chLoading=true;
  var sc=document.createElement('script'); sc.src='/assets/mp-charts.js'; sc.defer=true;
  sc.onload=function(){ (window.__chCbs||[]).forEach(function(f){try{f&&f();}catch(e){}}); window.__chCbs=[]; };
  document.head.appendChild(sc);
};
if(/^\/charts\/?$/.test(location.pathname)){ window.mpLoadCharts(); } /* direct /charts landing → load + the module self-activates */

;/* ══════════ inline block from app/index.html line 4559 ══════════ */
/* Mobile "living terminal" — live ticker + one-tap paper trade with live P&L. Mobile-only; desktop untouched. */
(function(){
  var term=document.querySelector('.mterm'); if(!term)return;
  if(!(window.matchMedia&&window.matchMedia('(max-width:680px)').matches))return;
  var TICK=['BTC','ETH','SOL','BNB'];
  var sym='BTC',side='long',lev=20,amt=100,curPos=null; // sane default leverage — 1000× liquidated positions on the tiniest tick ("positions disappear"); 20× gives ~5% liq buffer. Slider still goes to 1000×.
  var tickEl=document.getElementById('mTick'),pxEl=document.getElementById('mtpPx'),chgEl=document.getElementById('mtpChg'),goEl=document.getElementById('mtpGo'),pnlEl=document.getElementById('mtpPnl');
  function price(s){var lp=window.mpLivePrices&&window.mpLivePrices[s];return lp&&lp.p>0?lp.p:0;}
  function chgv(s){var lp=window.mpLivePrices&&window.mpLivePrices[s];return lp&&lp.chg!=null?+lp.chg:null;}
  /* live price ALWAYS keeps 2 decimals (e.g. 65,500.00) so the trailing digits never pop in/out and the width is fixed */
  function fmt(p){p=+p;return '$'+p.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:p>=1?2:6});}
  // roll the price to its new value (same count-up feel as the calculator's main result), chasing the live feed smoothly
  function rollPx(el,target){if(!el)return;var start=(el._cur!=null&&isFinite(el._cur))?el._cur:target;if(el._raf)cancelAnimationFrame(el._raf);if(Math.abs(target-start)<1e-7){el._cur=target;el.textContent=fmt(target);return;}var t0=null,dur=850;function step(now){if(t0==null)t0=now;var pr=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-pr,3),v=start+(target-start)*e;el._cur=v;el.textContent=fmt(v);if(pr<1){el._raf=requestAnimationFrame(step);}else{el._cur=target;el.textContent=fmt(target);el._raf=null;}}el._raf=requestAnimationFrame(step);}
  function jload(){try{return JSON.parse(localStorage.getItem('mp_journal')||'[]')||[];}catch(e){return [];}}
  function jstore(d){try{localStorage.setItem('mp_journal',JSON.stringify(d));}catch(e){}}
  function buildTick(){tickEl.innerHTML=TICK.map(function(s){return '<div class="mtk" data-tk="'+s+'"><span class="mtk-s">'+s+'</span><span class="mtk-p" data-p>$—</span><span class="mtk-c" data-c></span></div>';}).join('');}
  function updTick(s){var row=tickEl.querySelector('.mtk[data-tk="'+s+'"]');if(!row)return;var p=price(s),c=chgv(s),pe=row.querySelector('[data-p]'),ce=row.querySelector('[data-c]');if(p>0){var old=pe._v;pe.textContent=fmt(p);if(old!=null&&p!==old){pe.style.color=p>old?'var(--up)':'var(--red)';setTimeout(function(){pe.style.color='';},260);}pe._v=p;}if(c!=null){ce.textContent=(c>=0?'+':'')+c.toFixed(2)+'%';ce.className='mtk-c '+(c>=0?'up':'dn');}}
  function updTickAll(){TICK.forEach(updTick);}
  function updPanel(){var p=price(sym),c=chgv(sym);if(pxEl&&p>0)rollPx(pxEl,p);if(pxEl&&c!=null){pxEl.classList.toggle('up',c>=0);pxEl.classList.toggle('down',c<0);}if(chgEl&&c!=null){chgEl.textContent=(c>=0?'↑ +':'↓ ')+Math.abs(c).toFixed(2)+'%';chgEl.className='mtp-chg '+(c>=0?'up':'dn');}}/* the open button stays "Open demo trade" — no live price/coin in it */
  function mtMet(e){var lp=price(e.sym)||e.entry,long=e.side!=='short',lv=+e.lev||1;var move=(lp-e.entry)/e.entry*(long?1:-1);var pnl=e.qty*(lp-e.entry)*(long?1:-1)-(+e.fund||0);if(e.margin>0){var _op=e.status!=='win'&&e.status!=='loss',_pf=_op?-e.margin*0.99:-e.margin;if(pnl<_pf)pnl=_pf;}var roe=e.margin>0?pnl/e.margin*100:move*lv*100;var liq=e.liq||(long?e.entry*(1-(1-0.005)/lv):e.entry*(1+(1-0.005)/lv));var liqDist=(lp-liq)/lp*100*(long?1:-1);return {lp:lp,long:long,pnl:pnl,roe:roe,liq:liq,liqDist:liqDist,move:move};}
  function pl(v){var a=Math.abs(v),m=a>=1e9?(a/1e9).toFixed(2)+'B':a>=1e6?(a/1e6).toFixed(2)+'M':a.toLocaleString('en-US',{maximumFractionDigits:2});return (v>=0?'+':'−')+'$'+m;}
  function pc(v){return (v>=0?'+':'')+v.toFixed(2)+'%';}
  // render the latest open position as the same "LAST TRADE" torn ticket used in Paper Trade (with a live price + Close)
  function updPnl(){if(!pnlEl)return;var d=jload(),open=d.filter(function(e){return e.status==='open';});if(!open.length){pnlEl.hidden=true;pnlEl.innerHTML='';pnlEl.className='mtp-pnl';curPos=null;return;}var e=open[open.length-1];curPos=e;var lp=price(e.sym);if(!(lp>0)){return;}var m=mtMet(e),long=m.long,cls=(m.pnl>0?'pf':(m.pnl<0?'ls':'be'));pnlEl.className='pt-last '+cls;pnlEl.hidden=false;
    var _T=function(k,d){return (window.mpT&&window.mpT(k))||d;};
    pnlEl.innerHTML='<div class="ptl-top"><span class="ptl-tag">'+_T('mtLast','OPEN POSITION')+'</span><span class="ptl-sym">'+String(e.sym||'—')+'</span><span class="ptl-dir '+(long?'long':'short')+'">'+(long?_T('long','LONG'):_T('short','SHORT'))+'</span><span class="ptl-lev">'+(e.lev||1)+'×</span><span class="ptl-live">● <b>'+fmt(m.lp)+'</b></span></div>'
      +'<div class="ptl-pnl"><span class="big">'+pl(m.pnl)+'</span><span class="roe">ROE '+pc(m.roe)+'</span><button type="button" class="ptl-close ptl-mt" data-mytrades>'+_T('mtMyTrades','My Trades')+'</button></div>'
      +'<div class="ptl-meta">'+_T('jEntry','Entry')+' <b>'+fmt(e.entry)+'</b> · '+_T('mtLiq','Liq')+' <b>'+fmt(m.liq)+'</b> ('+pc(m.liqDist)+')</div>';}
  document.addEventListener('click',function(ev){if(ev.target.closest&&ev.target.closest('[data-ptl-close]'))setTimeout(updPnl,0);}); // re-render the ticket after its Close fires (the global handler does the actual close)
  function openPos(){if(window.mpTradeGate&&!window.mpTradeGate(sym,side))return; /* enforce open-trade limits + one-way mode */
    // FRESH price only: a stale mpLivePrices[sym] (seeded long ago by another open position on the same coin, never
    // updated because the coin isn't in the live feed) must never be the entry → wrong liq → phantom "instant liquidation".
    var _lp=window.mpLivePrices&&window.mpLivePrices[sym],p=(_lp&&_lp.p>0&&_lp.t&&(Date.now()-_lp.t)<2000)?+_lp.p:0; // 2s window: majors (WS, sub-second) use the cache; a polled altcoin (US) forces a fresh fetch so the entry matches the live market to the second (else it opens past its 100× liq → instant liquidation)
    if(!(p>0)){fetch('/api/price?symbol='+sym+window.__mpPQ('mterm',sym),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){if(j&&j.price>0){if(window.mpLivePrices)window.mpLivePrices[sym]={p:+j.price,t:Date.now()};openPos();}});return;}
    var L=lev,mmr=(window.mpPlanMmr||0.005),notional=amt*L,qty=notional/p,liq=side==='long'?p*(1-(1-mmr)/L):p*(1+(1-mmr)/L);
    var pos={id:String(Date.now())+'_'+Math.floor(Math.random()*1e4),ts:Date.now(),sym:sym,side:side,entry:p,stop:null,tp:null,lev:L,rr:null,qty:qty,notional:notional,margin:amt,riskAmt:amt,liq:liq,mmr:mmr,feeRate:window.mpFeeRate(lev),status:'open',pnl:null};
    var _finMt=function(P){var d=jload();d.push(P);if(window.mpLivePrices)window.mpLivePrices[sym]={p:+P.entry,t:Date.now()};jstore(d);if(window.mpJournalRender)window.mpJournalRender();
    try{if(window.mpLevWarn)window.mpLevWarn(L);}catch(e){} // extreme-leverage nudge (throttled)
    try{if(window.mpCheckGrad)window.mpCheckGrad();}catch(e){}
    try{if(navigator.vibrate)navigator.vibrate(14);}catch(e){}
    curPos=P;updPnl();try{mtRefresh();}catch(e){}
    try{if(window.__mpTrack)window.__mpTrack('paper',sym+' '+side+' '+lev+'x');}catch(e){} /* every open shows in ops Live activity (this quick-tap path was silent) */
    if(goEl){goEl.textContent=(window.mpT&&window.mpT('mtOpened'))||'Position opened ✓';setTimeout(function(){goEl.textContent=(window.mpT&&window.mpT('mtOpen'))||'Open demo trade';},1300);}
    try{var _pp=document.getElementById('mtpPnl');if(_pp){var _pr=_pp.getBoundingClientRect();if(_pr.bottom>window.innerHeight-76||_pr.top<0)setTimeout(function(){_pp.scrollIntoView({behavior:'smooth',block:'center'});},380);}}catch(e){}/* UX: bring the live P&L pill into view right after opening — the payoff moment was below the fold */};
    if(window.mpSrvOpen){window.mpSrvOpen({sym:sym,side:side,lev:L,margin:amt},function(t){_finMt(t);},function(){_finMt(pos);});}else{_finMt(pos);}}
  // ---- mini chart: Paper-Trade candlestick engine + a live LIQ preview (thin lines, tiny tag, blurred see-through red/green zone) ----
  var chartEl=document.getElementById('mtpChart'),mtCv=null,mtCtx2=null,mtBars=[],mtChartSym=null,mtTagEl=null,_mlgp=0,_mrej=0,_mReload=0,mtReady=false;
  function sizeChart(){if(!chartEl||!term)return;var mtp=term.querySelector('.mtp');if(mtp&&mtp.offsetHeight>120)chartEl.style.height=Math.round(mtp.offsetHeight*1.2)+'px';}
  // Lightweight CUSTOM CANVAS mini-chart for the homepage preview — NO charting library (loads + runs on weak phones / old in-app WebViews). The real /charts workspace + /paper-trade keep the full LightweightCharts engine untouched.
  function mtEnsure(){if(!chartEl)return null;if(!mtCv){mtCv=document.createElement('canvas');mtCv.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block';chartEl.appendChild(mtCv);mtTagEl=document.createElement('div');mtTagEl.className='mtc-tag';chartEl.appendChild(mtTagEl);mtCtx2=mtCv.getContext('2d');}var w=chartEl.clientWidth||320,h=chartEl.clientHeight||220,dpr=Math.min(2,window.devicePixelRatio||1),pw=Math.round(w*dpr),ph=Math.round(h*dpr);if(mtCv.width!==pw||mtCv.height!==ph){mtCv.width=pw;mtCv.height=ph;}return {w:w,h:h,dpr:dpr};}
  function mtDraw(){var d=mtEnsure();if(!d||!mtBars.length||!mtCtx2)return;var ctx=mtCtx2,W=d.w,H=d.h,i;ctx.setTransform(d.dpr,0,0,d.dpr,0,0);ctx.clearRect(0,0,W,H);
    var n=mtBars.length,closes=new Array(n);for(i=0;i<n;i++)closes[i]=+mtBars[i].close;var lp=price(sym);if(lp>0)closes[n-1]=lp;
    var pos=mtPos(),lo=Infinity,hi=-Infinity;for(i=0;i<n;i++){if(closes[i]<lo)lo=closes[i];if(closes[i]>hi)hi=closes[i];}
    var liq=null,long=pos?(pos.side!=='short'):true;if(pos){liq=mtLiqOf(pos);lo=Math.min(lo,pos.entry,liq);hi=Math.max(hi,pos.entry,liq);}
    if(!(hi>lo)){var mm=lo||1;hi=mm*1.002;lo=mm*0.998;}var pd=(hi-lo)*0.12;lo-=pd;hi+=pd;
    var pT=8,pB=8,pX=1,pR=Math.max(16,Math.round(W*0.15)),plotH=H-pT-pB,plotW=W-pX-pR;function Y(v){return pT+(hi-v)/(hi-lo)*plotH;}function X(k){return pX+(n<2?plotW:k/(n-1)*plotW);}/* pR = right offset so the live point isn't flush to the edge (room for the chart to grow rightward) */
    if(pos&&liq!=null){var ly=Y(liq);ctx.fillStyle='rgba(255,59,59,0.10)';if(long)ctx.fillRect(0,ly,W,Math.max(0,H-ly));else ctx.fillRect(0,0,W,Math.max(0,ly));}
    var up=closes[n-1]>=closes[0],col=up?'#2ebd85':'#ff6258';
    var g=ctx.createLinearGradient(0,pT,0,H);g.addColorStop(0,up?'rgba(46,189,133,0.20)':'rgba(255,98,88,0.20)');g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath();ctx.moveTo(X(0),Y(closes[0]));for(i=1;i<n;i++)ctx.lineTo(X(i),Y(closes[i]));ctx.lineTo(X(n-1),H);ctx.lineTo(X(0),H);ctx.closePath();ctx.fillStyle=g;ctx.fill();
    ctx.beginPath();ctx.moveTo(X(0),Y(closes[0]));for(i=1;i<n;i++)ctx.lineTo(X(i),Y(closes[i]));ctx.strokeStyle=col;ctx.lineWidth=1.6;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
    var lx=X(n-1),lyy=Y(closes[n-1]);ctx.beginPath();ctx.arc(lx,lyy,3,0,6.2832);ctx.fillStyle=col;ctx.fill();
    if(pos&&liq!=null){ctx.beginPath();ctx.moveTo(0,Y(pos.entry));ctx.lineTo(W,Y(pos.entry));ctx.strokeStyle=long?'#2ebd85':'#ff6258';ctx.lineWidth=1;ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,Y(liq));ctx.lineTo(W,Y(liq));ctx.strokeStyle='#ff3b3b';ctx.lineWidth=2;ctx.stroke();
      if(mtTagEl){var pp=lp||pos.entry,dist=Math.abs((liq-pp)/pp*100);mtTagEl.className='mtc-tag'+(long?'':' short');mtTagEl.innerHTML=(long?'LONG':'SHORT')+' '+(pos.lev||1)+'\u00d7 \u00b7 liq <b>'+dist.toFixed(dist<1?2:1)+'%</b>';}
    }else if(mtTagEl){mtTagEl.textContent='';}}
  function mtInit(){if(mtReady||!chartEl)return;mtReady=true;mtLoadKlines();}
  function mtReset(){if(mtTagEl)mtTagEl.textContent='';mtDraw();}
  function mtLoadKlines(){var s=sym;mtChartSym=s;try{if(window.mpWS)window.mpWS.sub(s);}catch(e){}_mReload=Date.now();fetch('/api/klines?symbol='+encodeURIComponent(s)+'&interval=1',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){if(s!==mtChartSym)return;if(kd&&kd.length){mtBars=kd;_mlgp=+mtBars[mtBars.length-1].close||0;_mrej=0;mtDraw();}});}
  function mtLive(){var p=price(sym);if(!mtBars.length)return;if(Date.now()-_mReload>45000){mtLoadKlines();return;}if(!(p>0))return;if(_mlgp>0&&Math.abs(p-_mlgp)/_mlgp>0.025){if(++_mrej<3)return;}_mlgp=p;_mrej=0;var last=mtBars[mtBars.length-1];last.close=p;if(p>last.high)last.high=p;if(p<last.low)last.low=p;}
  function mtPos(){var d=jload();for(var i=d.length-1;i>=0;i--){if(d[i]&&d[i].status==='open'&&d[i].sym===sym)return d[i];}return null;}
  function mtLiqOf(e){var long=e.side!=='short',lv=(+e.lev>0)?+e.lev:1,mmr=(e.mmr||0.005);return e.liq||(long?e.entry*(1-(1-mmr)/lv):e.entry*(1+(1-mmr)/lv));}
  function mtRefresh(){mtDraw();}
  function mtDrawLiq(){mtDraw();}
  var _cRaf=false;function mtTick(){if(_cRaf)return;_cRaf=true;requestAnimationFrame(function(){_cRaf=false;mtLive();mtRefresh();});}
  buildTick();
  fetch('/api/prices',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){if(j&&j.pairs){window.mpLivePrices=window.mpLivePrices||{};j.pairs.forEach(function(d){var c=d.symbol.replace('USDT','');if(!window.mpLivePrices[c]||!window.mpLivePrices[c].p)window.mpLivePrices[c]={p:+d.price,t:Date.now(),chg:+d.changePct};});updTickAll();updPanel();mtDrawLiq();}});
  updTickAll();updPanel();updPnl();
  (window.requestIdleCallback||function(f){setTimeout(f,300);})(function(){sizeChart();mtInit();}); // canvas mini-chart, no library — instant + works on weak phones
  window.addEventListener('resize',function(){sizeChart();setTimeout(mtDraw,60);});
  var _symBtn=document.getElementById('mtpSymBtn'),_symCur=document.getElementById('mtpSymCur');
  function setMtSym(s){s=String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!s||s===sym)return;sym=s;
    if(_symCur)_symCur.textContent=s;
    var _cap=(window.mpMaxLev?window.mpMaxLev(s):1000);if(lev>_cap){lev=_cap;if(levVal)levVal.textContent=lev+'×';if(levSl)levSl.value=levToPos(lev);hiChips(lev);if(window.mpLimitToast)window.mpLimitToast('Max leverage for '+s+' is '+_cap+'×.');}
    if(pxEl)pxEl._cur=null;updPanel();mtReset();mtLoadKlines();}
  var _dd=document.getElementById('mtpDD'),_dds=document.getElementById('mtpDDs'),_ddl=document.getElementById('mtpDDl');
  // search-only: nothing is listed until the user types (BTC stays selected by default)
  function renderDD(q){q=String(q||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!q){_ddl.innerHTML='<div class="mtp-dd-e">'+((window.mpT&&window.mpT('mtTypeTicker'))||'Type a ticker to search 500+ coins')+'</div>';return;}
    var toks=window.mpTokens||['BTC','ETH','SOL'];var arr=toks.filter(function(t){return t.indexOf(q)===0;}).concat(toks.filter(function(t){return t.indexOf(q)>0;}));
    _ddl.innerHTML=arr.length?arr.slice(0,150).map(function(t){return '<button type="button" class="mtp-dd-i'+(t===sym?' on':'')+'" data-pick="'+t+'">'+t+'</button>';}).join(''):'<div class="mtp-dd-e">'+((window.mpT&&window.mpT('mtNoMatch'))||'No match for')+' "'+q+'"</div>';}
  function openDD(){if(window.mpLoadTokens)window.mpLoadTokens(function(){renderDD(_dds.value);});renderDD(_dds.value);_dd.hidden=false;if(_symBtn)_symBtn.classList.add('open');setTimeout(function(){_dds.focus();},30);}
  function closeDD(){_dd.hidden=true;if(_symBtn)_symBtn.classList.remove('open');}
  if(_symBtn)_symBtn.addEventListener('click',function(){if(_dd.hidden)openDD();else closeDD();});
  if(_dds)_dds.addEventListener('input',function(){renderDD(this.value);});
  if(_ddl)_ddl.addEventListener('mousedown',function(e){var b=e.target.closest('[data-pick]');if(!b)return;e.preventDefault();_dds.value='';closeDD();setMtSym(b.getAttribute('data-pick'));});
  document.addEventListener('click',function(e){if(_dd&&!_dd.hidden&&!e.target.closest('#mtpDD')&&!e.target.closest('#mtpSymBtn'))closeDD();});
  document.getElementById('mtpSide').addEventListener('click',function(e){var b=e.target.closest('[data-side]');if(!b)return;side=b.getAttribute('data-side');this.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);});if(goEl)goEl.classList.toggle('short',side==='short');updPanel();mtDrawLiq();});
  var levVal=document.getElementById('mtpLevVal'),levSl=document.getElementById('mtpLevSl'),levChips=document.getElementById('mtpLev');
  var LMAX=Math.log(1000);
  function levToPos(L){return Math.round(1000*Math.log(Math.max(1,L))/LMAX);}
  function posToLev(p){return Math.max(1,Math.min(1000,Math.round(Math.exp(LMAX*p/1000))));}
  function snapLev(L){if(L>=200)return Math.round(L/50)*50;if(L>=100)return Math.round(L/25)*25;if(L>=20)return Math.round(L/5)*5;return Math.round(L);}
  function hiChips(L){if(levChips)levChips.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',+x.getAttribute('data-lev')===L);});}
  if(levSl)levSl.addEventListener('input',function(){lev=Math.min((window.mpMaxLev?window.mpMaxLev(sym):1000),snapLev(posToLev(+this.value)));if(levVal)levVal.textContent=lev+'×';hiChips(lev);mtDrawLiq();});
  if(levChips)levChips.addEventListener('click',function(e){var b=e.target.closest('[data-lev]');if(!b)return;lev=Math.min((window.mpMaxLev?window.mpMaxLev(sym):1000),+b.getAttribute('data-lev'));if(levVal)levVal.textContent=lev+'×';if(levSl)levSl.value=levToPos(lev);hiChips(lev);mtDrawLiq();});
  if(levSl)levSl.value=levToPos(lev);if(levVal)levVal.textContent=lev+'×';hiChips(lev); // sync slider/display/chips to the default leverage on load
  goEl.addEventListener('click',openPos);
  function mtVis(){return !document.hidden&&term.offsetParent!==null;} // mterm is CSS-hidden on route pages + open products — its per-tick tweens/canvas draws used to burn CPU there anyway (mobile perf 2026-07-14)
  document.addEventListener('mp:price',function(ev){if(!ev.detail||!mtVis())return;var s=ev.detail.sym;if(TICK.indexOf(s)>=0)updTick(s);if(s===sym){updPanel();mtTick();}if(curPos&&curPos.sym===s)updPnl();});
  setInterval(function(){if(!mtVis())return;updTickAll();updPanel();updPnl();mtTick();},3000);
})();

;/* ══════════ inline block from app/index.html line 4662 ══════════ */
/* Mobile liquidation-heatmap teaser — renders a heat silhouette and opens the real heatmap on tap. Mobile-only. */
(function(){
  var viz=document.getElementById('mteaserViz'),card=document.getElementById('mteaserHeat');
  if(!viz||!card)return;
  if(!(window.matchMedia&&window.matchMedia('(max-width:680px)').matches))return;
  var H=[16,22,30,26,38,58,82,96,74,46,30,22,18,24,34,50,70,90,99,80,52,34,24,18];
  function heat(h){return h<35?'#3fd8e6':h<55?'#c2f64a':h<75?'#ffd23f':h<90?'#ff9f43':'#ff5b50';}
  viz.innerHTML=H.map(function(h,i){var c=heat(h);return '<span class="mtv-bar" style="height:'+h+'%;background:'+c+';box-shadow:0 0 8px -2px '+c+';animation-delay:'+(i*16)+'ms"></span>';}).join('');
  function go(){var pt=document.querySelector('.prod[data-prod="heat"]');if(pt)pt.click();var hm=document.getElementById('heatmap');setTimeout(function(){if(hm&&hm.scrollIntoView)hm.scrollIntoView({behavior:'smooth',block:'start'});},170);}
  card.addEventListener('click',go);
  card.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});
})();

;/* ══════════ inline block from app/index.html line 4676 ══════════ */
/* On-site weekly leaderboard (live from /api/reward/lb) + the visitor's own stats & achievements (from mp_journal). */
(function(){
  var board=document.getElementById('lgBoard'),you=document.getElementById('lgYou'),gate=document.getElementById('lgGate');
  if(!board)return;
  function LT(k,d){return (window.mpT&&window.mpT(k))||d;}
  function esc(s){return String(s).replace(/[<>&]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}
  function getAddr(){try{var a=localStorage.getItem('mp_reward_addr')||'';return /^0x[0-9a-fA-F]{40}$/.test(a)?a:'';}catch(e){return '';}}
  function renderGate(){if(!gate)return;var me=(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me())||null;
    if(!me){gate.className='lg-gate locked';gate.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'+LT('lgGateAnon','The Trade League is for registered users.')+' <button type="button" class="lg-signin" data-auth-open>'+LT('lgGateBtn','Sign in free to join')+'</button>';return;}
    gate.className='lg-gate ok';gate.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#41e3a3" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><path d="M20 6L9 17l-5-5"/></svg>'+LT('lgInAs','You are in the league as')+' <b>'+esc(me.username||(me.email?me.email.split('@')[0]:'you'))+'</b> '+LT('lgClimb','— close winning trades to climb.');}
  function lbEnds(weekEnd){if(!weekEnd)return '';var ms=weekEnd-Date.now();if(ms<=0)return '';var d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000);var t=(d>0?d+'d ':'')+((d>0||h>0)?h+'h ':'')+m+'m';return '<div class="lg-ends">⏳ 14-day season · '+LT('lgEndsIn','ends in')+' <b>'+t+'</b></div>';}
  var lgMode='roe',lgLast=null;
  function lgPills(){return '<div class="lg-pills"><button type="button" class="lg-pill'+(lgMode==='roe'?' on':'')+'" data-lgm="roe">'+LT('lgTopRoe','Top ROE')+'</button><button type="button" class="lg-pill'+(lgMode==='pnl'?' on':'')+'" data-lgm="pnl">'+LT('lgTopPnl','Top PnL')+'</button><button type="button" class="lg-pill'+(lgMode==='wr'?' on':'')+'" data-lgm="wr">'+LT('lgBestWr','Best win rate')+'</button></div>';}
  function lgNote(){return lgMode==='roe'?'<div class="lg-wr-note pay">'+LT('lgPayRoe','Top ROE pays the season prizes — the other boards start paying soon.')+'</div>':'<div class="lg-wr-note">'+LT('lgPaySoon','No prizes yet — this board starts paying out soon.')+'</div>';}
  function lgMoneyH(x){x=+x||0;var sg=x<0?'-':'+';x=Math.abs(x);return sg+'$'+(x>=1000?Math.round(x).toLocaleString('en-US'):x.toFixed(2));}
  function lgDraw(){var d=lgLast;if(!d)return;var ends=lbEnds(d&&d.weekEnd);
    if(lgMode==='wr'){
      var wt=(d&&d.topWr)||[];
      if(!wt.length){board.innerHTML=lgPills()+lgNote()+'<div class="lg-empty">'+LT('lgWrEmpty','No one has 20 closed trades this week yet — close 20+ trades and claim the win-rate crown.')+'</div>'+ends;wireLgPills();return;}
      board.innerHTML=lgPills()+lgNote()+'<div class="lg-board-h">'+LT('lgWrHead','Best win rate this season')+' <span class="lg-live">'+LT('lgLive','live')+'</span></div>'+wt.slice(0,5).map(function(x,i){var rk=i+1;
        return '<div class="lg-row"><span class="lg-rank lg-r'+rk+'">'+rk+'</span><span class="lg-who"><span data-lvln="'+esc(x.who||'')+'"></span>'+esc(x.who||'anon')+'<span data-lpro="'+esc(x.who||'')+'"></span></span><span class="lg-tr">'+(+x.w||0)+'W-'+(+x.l||0)+'L</span><span class="lg-roe up">'+(+x.wr||0).toFixed(0)+'%</span></div>';}).join('')
        +ends;
      if(window.mpLvlDecorate)window.mpLvlDecorate();wireLgPills();return;}
    if(lgMode==='pnl'){
      var pt=(d&&d.topPnl)||[];
      if(!pt.length){board.innerHTML=lgPills()+lgNote()+'<div class="lg-empty">'+LT('lgPnlEmpty','No winning trades yet this week — close one in profit to top the PnL board.')+'</div>'+ends;wireLgPills();return;}
      board.innerHTML=lgPills()+lgNote()+'<div class="lg-board-h">'+LT('lgPnlHead','Top PnL this week')+' <span class="lg-live">'+LT('lgLive','live')+'</span></div>'+pt.slice(0,5).map(function(x,i){var rk=i+1,p=+x.pnl;
        return '<div class="lg-row"><span class="lg-rank lg-r'+rk+'">'+rk+'</span><span class="lg-who"><span data-lvln="'+esc(x.who||'')+'"></span>'+esc(x.who||'anon')+'<span data-lpro="'+esc(x.who||'')+'"></span></span>'+(x.symbol?'<span class="lg-tr">'+esc(x.symbol)+' '+esc(x.side||'')+'</span>':'')+'<span class="lg-roe '+(p>=0?'up':'dn')+'">'+lgMoneyH(p)+'</span></div>';}).join('')+ends;
      if(window.mpLvlDecorate)window.mpLvlDecorate();wireLgPills();return;}
    var t=(d&&d.top)||[];
    var pz=(d&&d.prizes)||[30,20,10];
    try{var sub=document.querySelector('.lg-sub');if(sub&&pz.length>=3){var k=0;sub.innerHTML=sub.innerHTML.replace(/\$\d+/g,function(m){k++;return k<=3?('$'+pz[k-1]):m;});}}catch(e){}
    if(!t.length){board.innerHTML=lgPills()+lgNote()+'<div class="lg-empty">'+LT('lgEmpty','No trades yet this season — be the first. Open Paper Trade, close a winner, and you are on the board.')+'</div>'+ends;wireLgPills();return;}
    board.innerHTML=lgPills()+lgNote()+'<div class="lg-board-h">'+LT('lgTopWeek','This week’s top traders')+' <span class="lg-live">'+LT('lgLive','live')+'</span></div>'+t.slice(0,5).map(function(x,i){var rk=i+1,roe=+x.roe,prize=(pz[i]!=null&&+pz[i]>0)?('$'+pz[i]):'';
      return '<div class="lg-row"><span class="lg-rank lg-r'+rk+'">'+rk+'</span><span class="lg-who"><span data-lvln="'+esc(x.who||'')+'"></span>'+esc(x.who||'anon')+'<span data-lpro="'+esc(x.who||'')+'"></span></span>'+(x.symbol?'<span class="lg-tr">'+esc(x.symbol)+' '+esc(x.side||'')+'</span>':'')+'<span class="lg-roe '+(roe>=0?'up':'dn')+'">'+(roe>=0?'+':'')+roe.toFixed(0)+'%</span>'+(prize?'<span class="lg-prize">'+prize+'</span>':'')+'</div>';}).join('')+ends;
    if(window.mpLvlDecorate)window.mpLvlDecorate();wireLgPills();}
  function wireLgPills(){board.querySelectorAll('[data-lgm]').forEach(function(b){b.addEventListener('click',function(){lgMode=b.getAttribute('data-lgm');lgDraw();});});}
  function renderBoard(){fetch('/api/reward/lb').then(function(r){return r.json();}).then(function(d){lgLast=d;lgDraw();}).catch(function(){});}
  function renderYou(){if(!you)return;var d;try{d=JSON.parse(localStorage.getItem('mp_journal')||'[]')||[];}catch(e){d=[];}
    var closed=d.filter(function(e){return e.status==='win'||e.status==='loss';}),wins=closed.filter(function(e){return e.status==='win';}).length,total=d.length,wr=closed.length?Math.round(wins/closed.length*100):0,bestRoe=0,streak=0;
    closed.forEach(function(e){if(e.margin>0&&e.pnl!=null){var r=e.pnl/e.margin*100;if(r>bestRoe)bestRoe=r;}});
    for(var i=closed.length-1;i>=0;i--){if(closed[i].status==='win')streak++;else break;}
    if(!total){you.innerHTML='';return;}
    function stat(v,l,win){return '<div class="lg-yc'+(win?' win':'')+'"><div class="lg-yv">'+v+'</div><div class="lg-yl">'+l+'</div></div>';}
    you.innerHTML='<div class="lg-you-h">'+LT('lgYouStats','Your trading stats')+'</div><div class="lg-you-grid">'+stat(total,LT('jTrades','Trades'))+stat(wr+'%',LT('jWinRate','Win rate'),wr>=50)+stat('+'+bestRoe.toFixed(0)+'%',LT('lgBestRoe','Best ROE'),bestRoe>0)+stat(streak,LT('lgWinStreak','Win streak'),streak>=3)+'</div>';}
  renderGate(); // gate is cheap + can be above the fold once signed in — keep it instant
  // the leaderboard board + your-stats are below the fold and do a /lb fetch + DOM build → defer off the load critical path (weak-phone perf)
  (window.requestIdleCallback||function(f){setTimeout(f,900);})(function(){renderBoard();renderYou();});
  setInterval(renderBoard,60000);
  // the language pack loads async — repaint board+stats once it's in so LT() picks up the translations (not English fallback from the first paint)
  setTimeout(function(){renderBoard();renderYou();},1800);setTimeout(function(){renderBoard();renderYou();},4500);
  var _gt=setInterval(function(){renderGate();renderYou();},2000);setTimeout(function(){clearInterval(_gt);},14000); // mpAuth resolves login state async
  document.addEventListener('visibilitychange',function(){if(!document.hidden){renderBoard();renderYou();renderGate();}});
})();

;/* ══════════ inline block from app/index.html line 4712 ══════════ */
/* "Graduation" CTA — nudge the user to a real (affiliate) exchange after 20 paper trades, then every 30 (20, 50, 80, …). */
(function(){
  var NXKEY='mp_grad_next';
  function count(){try{return (JSON.parse(localStorage.getItem('mp_journal')||'[]')||[]).length;}catch(e){return 0;}}
  var EX=[{n:'Bybit',h:'https://www.bybit.com/invite?ref=LZKBERJ',c:'#f7a600',fg:'#0a0b0d',l:'B',t:'100x · deep liquidity'},
          {n:'Binance',h:'https://www.binance.com/register?ref=MAOZM9DS',c:'#f0b90b',fg:'#181a20',l:'B',t:'125x · most pairs'},
          {n:'OKX',h:'https://okx.com/join/96160298',c:'#e9e7df',fg:'#0a0b0d',l:'O',t:'125x · pro tools'},
          {n:'Coinbase',h:'https://base.app/invite/chakko/FHSFNY5H',c:'#0052ff',fg:'#fff',l:'C',t:'US-regulated · beginner-friendly'}];
  var elm=null;
  function build(){ elm=document.createElement('div'); elm.className='grad-modal'; elm.hidden=true;
    elm.innerHTML='<div class="grad-panel"><button class="grad-x" type="button" aria-label="Close">&#10005;</button><div class="grad-badge">5 trades practiced</div><h3>Ready to trade for real?</h3><p>You have opened 5 paper trades — the mechanics are second nature now. Put it to work on a real futures account (new sign-ups often get fee discounts and bonuses).</p><div class="grad-ex">'+EX.map(function(x){return '<a class="grad-card" href="'+x.h+'" target="_blank" rel="sponsored noopener noreferrer" data-ex="'+x.n+'"><span class="grad-mark" style="background:'+x.c+';color:'+x.fg+'">'+x.l+'</span><span class="grad-cn"><b>'+x.n+'</b><small>'+x.t+'</small></span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>';}).join('')+'</div><button class="grad-later" type="button">Keep practicing</button></div>';
    document.body.appendChild(elm);
    elm.addEventListener('click',function(e){var t=e.target;if(t.closest('.grad-x')||t.closest('.grad-later')||t===elm){elm.hidden=true;return;}var c=t.closest('[data-ex]');if(c){try{if(window.__mpTrack)window.__mpTrack('exchange',c.getAttribute('data-ex'));}catch(_){}setTimeout(function(){elm.hidden=true;},80);}}); }
  function show(){if(!elm)build();var n=window.__gradN||count();
    try{var bd=elm.querySelector('.grad-badge');if(bd)bd.textContent=n+' trades practiced';
        var pp=elm.querySelector('.grad-panel > p');if(pp)pp.textContent='You have opened '+n+' paper trades — the mechanics are second nature now. Put it to work on a real futures account (new sign-ups often get fee discounts and bonuses).';}catch(e){}
    elm.hidden=false;}
  window.mpCheckGrad=function(){try{var n=count();var nx=parseInt(localStorage.getItem(NXKEY)||'20',10);if(!(nx>0))nx=20;if(n>=nx){var k=Math.floor((n-20)/30)+1;localStorage.setItem(NXKEY,String(20+30*k));window.__gradN=n;setTimeout(show,600);}}catch(e){}};
  setTimeout(function(){try{window.mpCheckGrad();}catch(e){}},1500);
})();

;/* ══════════ inline block from app/index.html line 4733 ══════════ */
/* /charts workspace — collapsible left control panel (neon reopen tab) + Ctrl+wheel to grow the working area. Desktop only. */
(function(){
  function isCharts(){return document.body.classList.contains('charts-page')&&window.matchMedia('(min-width:881px)').matches;}
  var sx=document.getElementById('cwsSideX'),re=document.getElementById('cwsReopen'),board=document.getElementById('cwsBoard'),cs=document.getElementById('chartspace');
  // the sidebar OVERLAYS the board now — opening/closing must NOT move or re-tile the charts
  function setOff(off){document.body.classList.toggle('cws-side-off',off);try{localStorage.setItem('mp_cws_side',off?'0':'1');}catch(e){}}
  if(sx)sx.addEventListener('click',function(){setOff(true);});
  if(re)re.addEventListener('click',function(){setOff(false);});
  try{if(localStorage.getItem('mp_cws_side')==='0')document.body.classList.add('cws-side-off');}catch(e){}
  if(board&&cs){var zoom=1;
    board.addEventListener('wheel',function(ev){
      if(!ev.ctrlKey||!isCharts())return;            // plain scroll inside a chart still pans/zooms it
      ev.preventDefault();
      zoom=Math.max(1,Math.min(2.6,zoom+(ev.deltaY<0?0.18:-0.18)));
      if(zoom<=1.001){board.style.height='';board.style.overflowY='';}
      else{board.style.height=Math.round(cs.clientHeight*zoom)+'px';board.style.overflowY='auto';}
      try{window.dispatchEvent(new Event('resize'));}catch(e){}
    },{passive:false});
  }
  // chart background toggle (Dark / Light)
  var bg=document.getElementById('cwsBg');
  if(bg){ try{var cur=(localStorage.getItem('mp_ch_theme')==='light')?'light':'dark';Array.prototype.forEach.call(bg.children,function(b){b.classList.toggle('on',b.getAttribute('data-bg')===cur);});}catch(e){}
    bg.addEventListener('click',function(e){var b=e.target.closest('[data-bg]');if(!b)return;var m=b.getAttribute('data-bg');Array.prototype.forEach.call(bg.children,function(x){x.classList.toggle('on',x===b);});try{if(window.mpCharts&&window.mpCharts.setTheme)window.mpCharts.setTheme(m);}catch(_){}});
  }
  // sidebar widgets — Watchlist (from mp_watchlist) + Top signals (from /api/screener). Click a coin → open it in a chart. /charts route only.
  var watch=document.getElementById('cwsWatch'),scr=document.getElementById('cwsScr'),CHG={},SCR={};
  function fmtChg(v){return (v>=0?'+':'')+(+v).toFixed(1)+'%';}
  function openSym(s){try{if(window.mpCharts&&window.mpCharts.openSymbol)window.mpCharts.openSymbol(s);}catch(e){}}
  function renderWatch(){ if(!watch)return; var list=[];try{list=JSON.parse(localStorage.getItem('mp_watchlist')||'[]')||[];}catch(e){}
    if(!list.length){watch.innerHTML='<div class="cws-w-empty">Star coins on the homepage to pin them here.</div>';return;}
    watch.innerHTML=list.slice(0,12).map(function(s){var ch=CHG[s];return '<button type="button" class="cws-wcoin" data-sym="'+s+'"><span class="sym">'+s+'</span>'+(ch!=null?'<span class="chg '+(ch>=0?'up':'dn')+'">'+fmtChg(ch)+'</span>':'')+'</button>';}).join(''); }
  function scoreColor(sc){return sc>=75?'#2ebd85':sc>=55?'#c2f64a':sc>=45?'#ffb347':'#ff6258';}
  function renderScr(rows){ if(!scr)return; rows=rows||[];
    // "Top signals" = the most actionable SETUPS first (decisive score, long OR short), then highest-conviction rest
    var withSetup=rows.filter(function(r){return r&&r.setup&&typeof r.score==='number';}).sort(function(a,b){return Math.abs(b.score-50)-Math.abs(a.score-50);});
    var top=withSetup.slice(0,8);
    if(top.length<8){var rest=rows.filter(function(r){return r&&typeof r.score==='number'&&!r.setup;}).sort(function(a,b){return b.score-a.score;});top=top.concat(rest.slice(0,8-top.length));}
    if(!top.length){scr.innerHTML='<div class="cws-w-empty">No signals right now — markets are quiet. Refreshing…</div>';return;}
    scr.innerHTML=top.map(function(r){var dir=r.setup?(r.setup.dir==='long'?'<span class="sd up">▲</span>':'<span class="sd dn">▼</span>'):'';return '<button type="button" class="cws-wcoin" data-sym="'+r.s+'" title="Open '+r.s+' with indicators + setup">'+dir+'<span class="sym">'+r.s+'</span><span class="chg '+(r.chg>=0?'up':'dn')+'">'+fmtChg(r.chg)+'</span><span class="sc" style="background:'+scoreColor(r.score)+'">'+r.score+'</span></button>';}).join(''); }
  var scrLoaded=false,scrTimer=null,scrInflight=false;
  function scheduleScr(ms){clearTimeout(scrTimer);scrTimer=setTimeout(loadScr,ms);}
  function scrRetry(){ if(!scrLoaded&&scr){var em=scr.querySelector('.cws-w-empty');if(em)em.innerHTML='Loading live signals… <span style="opacity:.55">retrying</span>';} scheduleScr(scrLoaded?120000:7000); }
  function loadScr(){ if(scrInflight)return; scrInflight=true;
    fetch('/api/screener',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){ scrInflight=false;
      if(!j||!j.rows||!j.rows.length){scrRetry();return;}
      scrLoaded=true; SCR={}; j.rows.forEach(function(r){if(r&&r.s){if(typeof r.chg==='number')CHG[r.s]=r.chg;SCR[r.s]=r;}});
      renderScr(j.rows); renderWatch(); scheduleScr(120000);
    }).catch(function(){scrInflight=false;scrRetry();}); }
  if((watch||scr)&&/^\/charts\/?$/.test(location.pathname)){ renderWatch(); loadScr();
    document.addEventListener('click',function(e){var c=e.target.closest&&e.target.closest('.cws-wcoin[data-sym]');if(!c)return;var sym=c.getAttribute('data-sym');
      if(scr&&scr.contains(c)&&SCR[sym]&&window.mpCharts&&window.mpCharts.openSetup){window.mpCharts.openSetup(sym,SCR[sym]);}
      else openSym(sym);});
    window.addEventListener('storage',function(e){if(e.key==='mp_watchlist')renderWatch();});
  }
})();

;/* ══════════ inline block from app/index.html line 4790 ══════════ */
/* Activation nudge — when an ANONYMOUS user has closed 2 paper trades (peak engagement), prompt a free 1-tap sign-up. Shows once. */
(function(){
  var KEY='mp_act_nudge_shown';
  function closedCount(){try{return (JSON.parse(localStorage.getItem('mp_journal')||'[]')||[]).filter(function(e){return e&&(e.status==='win'||e.status==='loss');}).length;}catch(e){return 0;}}
  function signedIn(){try{return !!(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me());}catch(e){return false;}}
  var elm=null,welcome=0,busy=false;
  function bonusBit(){return 'get a <b>free USDT</b> welcome bonus';} // amount stays hidden until they sign in (per owner)
  function build(){ elm=document.createElement('div'); elm.className='grad-modal'; elm.hidden=true;
    elm.innerHTML='<div class="grad-panel"><button class="grad-x" type="button" aria-label="Close">&#10005;</button><div class="grad-badge">Save your progress</div><h3>Save your trades — sign up free</h3><p>You have closed 2 paper trades. Create a free account (just an email code, no password) to keep your journal across devices, '+bonusBit()+', and set price alerts on any coin.</p><button class="grad-go" type="button" style="display:block;width:100%;margin:4px 0 6px;padding:13px;border:none;border-radius:11px;background:#c2f64a;color:#0a0b0d;font-weight:800;font-size:14px;cursor:pointer">Sign up free &#8594;</button><button class="grad-later" type="button">Maybe later</button></div>';
    document.body.appendChild(elm);
    elm.addEventListener('click',function(e){var t=e.target;if(t.closest('.grad-go')){elm.hidden=true;try{if(window.mpAuth&&window.mpAuth.open)window.mpAuth.open();}catch(_){}return;}if(t.closest('.grad-x')||t.closest('.grad-later')||t===elm){elm.hidden=true;}}); }
  function show(){if(!elm)build();elm.hidden=false;}
  window.mpActivationNudge=function(){try{
    if(busy||localStorage.getItem(KEY)||signedIn()||closedCount()<2)return;
    busy=true;localStorage.setItem(KEY,'1'); // set immediately so it can never show twice
    fetch('/api/reward/me',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){if(j&&j.welcomeAmt!=null)welcome=+j.welcomeAmt;}).catch(function(){}).then(function(){setTimeout(show,500);});
  }catch(e){}};
})();

;/* ══════════ inline block from app/index.html line 4810 ══════════ */
/* Mobile "Browse" — a full-screen slide-up navigator (replaces Home in the bottom nav).
   Progressive disclosure: primary Trade tools first, Calculators expand on demand, the rest tucked into "More". */
(function(){
  if(!document.querySelector('.mobnav'))return;
  var I={
    plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
    charts:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/></svg>',
    heat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    rekt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    calc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg>',
    gift:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
    scr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3.5" y1="6" x2="3.51" y2="6"/><line x1="3.5" y1="12" x2="3.51" y2="12"/><line x1="3.5" y1="18" x2="3.51" y2="18"/></svg>',
    alert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    news:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h13a1 1 0 0 1 1 1v14a1 1 0 0 0 1 1H5a1 1 0 0 1-1-1z"/><path d="M18 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2"/><line x1="7" y1="8" x2="14" y2="8"/><line x1="7" y1="12" x2="14" y2="12"/><line x1="7" y1="16" x2="11" y2="16"/></svg>',
    fng:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16a7 7 0 1 1 14 0"/><path d="M5 16h-1M20 16h-1M12 9v-1M7 10.5l-.7-.7M17 10.5l.7-.7"/><path d="M12 16l3.4-3.4"/><circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none"/><path d="M4 20h16"/></svg>',
    chev:'<svg class="browse-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>'
  };
  function row(open,close,ic,t,s,col,badge,tk,sk,bk){return open+'<span class="browse-ic" style="color:'+col+';background:'+col+'22">'+ic+'</span><span class="browse-rt"><b><span'+(tk?' data-i18n="'+tk+'"':'')+'>'+t+'</span>'+(badge?' <em class="browse-badge"'+(bk?' data-i18n="'+bk+'"':'')+'>'+badge+'</em>':'')+'</b><small'+(sk?' data-i18n="'+sk+'"':'')+'>'+s+'</small></span>'+I.chev+close;}
  var html='<div class="browse-sheet"><div class="browse-head"><span class="browse-title" data-i18n="brBrowse">Browse</span><button type="button" class="browse-x" aria-label="Close">&#10005;</button></div><div class="browse-searchwrap"><input type="text" class="browse-search" placeholder="Search pages, guides, coins…" data-ph="brSearch" autocomplete="off" aria-label="Search"></div><div class="browse-scroll">'
   +'<div class="browse-sugg" id="browseSugg" hidden></div>'
   +'<div class="browse-sec" data-i18n="secNew">New here?</div>'
   +row('<a class="browse-row" href="/where-to-start/">','</a>','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-5"/></svg>','Where to start','Crypto from zero — a free beginner path','#c2f64a','START','brWtsT','brWtsS','brStart')
   +'<div class="browse-sec" data-i18n="secCalc">Calculators</div>'
   +row('<button type="button" class="browse-row browse-expand" data-expand="calc">','</button>',I.calc,'Calculators','Liquidation, PnL, size &amp; more','#c2f64a','','brCalcT','brCalcS')
   +'<div class="browse-sub" data-sub="calc" hidden>'
     +'<button type="button" class="browse-subrow" data-calc="liq" data-i18n="subLiq">Liquidation price</button>'
     +'<button type="button" class="browse-subrow" data-calc="size" data-i18n="subSize">Position size</button>'
     +'<button type="button" class="browse-subrow" data-calc="pnl" data-i18n="subPnl">PnL / ROI</button>'
     +'<button type="button" class="browse-subrow" data-calc="dca" data-i18n="subDca">DCA / average down</button>'
     +'<button type="button" class="browse-subrow" data-calc="tp" data-i18n="subTp">Take-profit</button>'
     +'<button type="button" class="browse-subrow" data-calc="rr" data-i18n="subRr">Risk / reward</button>'
   +'</div>'
   +'<div class="browse-sec" data-i18n="secTrade">Trade</div>'
   +row('<button type="button" class="browse-row" data-go="plan">','</button>',I.plan,'Paper Trade','Practice at the live price · zero risk','#2ebd85','','prodPaper','brPaperS')
   +row('<a class="browse-row" href="/charts" data-mcharts>','</a>',I.charts,'Charts','Full-screen charts · landscape · 1–2 panes, indicators, AI','#3fd8e6','NEW','prodCharts','brChartsS','brNew')
   +row('<a class="browse-row" href="/screener">','</a>',I.scr,'Screener','Live markets · movers, funding, OI','#6aa3ff','','prodScreener','brScrS')
   +row('<a class="browse-row" href="/calendar/">','</a>','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>','Calendar','FOMC, CPI &amp; key crypto dates · countdowns','#ffd75a','NEW','','','brNew')
   +row('<a class="browse-row" href="/news/">','</a>',I.news,'Crypto News','Latest headlines · live','#ff8c5a','','brNewsT','brNewsS')
   +row('<a class="browse-row" href="/community/">','</a>','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>','Community','Trader posts, ideas &amp; discussion','#c2f64a','NEW','brCommT','brCommS')
   +row('<a class="browse-row" href="/tools/">','</a>','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h10"/><path d="M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h2"/><path d="M10 12h10"/><circle cx="8" cy="12" r="2"/><path d="M4 18h10"/><path d="M18 18h2"/><circle cx="16" cy="18" r="2"/></svg>','Trading Tools','Backtester · journal · pivots · risk','#46e0e6','NEW','brToolsT','brToolsS','brNew')
      +row('<a class="browse-row" href="/trading-api/">','</a>','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>','Bot API','Test your trading bot — free','#3fd8e6','NEW','','')
   +row('<a class="browse-row" href="/coins/">','</a>','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>','Markets','Top 100 coins · prices &amp; market cap','#16c2d6','','brMktsT','brMktsS')
   +row('<a class="browse-row" href="/defi/">','</a>','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>','DeFi','TVL, chains, protocols &amp; stablecoins','#9d7bff','','brDefiT','brDefiS')
   +row('<a class="browse-row" href="/fear-greed/">','</a>',I.fng,'Fear &amp; Greed','Live market sentiment','#7fd957','','brFngT','brFngS')
   +row('<a class="browse-row" href="/heatmap">','</a>',I.heat,'Liquidation Heatmap','Liquidation pools & real liqs — live','#ffb347','','brHeatT','brHeatS')
   +row('<a class="browse-row" href="/rekt/">','</a>',I.rekt,'Rekt','Live liquidations feed','#ff6258','','navRekt','prodRektS')
   +row('<a class="browse-row" href="/alerts/">','</a>',I.alert,'Price Alerts','Email or Telegram when a coin hits your price','#c2f64a','','brAlertsT','brAlertsS')
   +'<div class="browse-sec" data-i18n="secEarn">Earn</div>'
   +row('<a class="browse-row" href="/rewards/">','</a>',I.gift,'Rewards','Claim every 5 minutes','#ffd75a','','brFreeT','brFreeS')
   +'<div class="browse-sec" data-i18n="secMore">More</div><div class="browse-more">'
     +'<a class="browse-mrow" href="/blog/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg><span data-i18n="navBlog">Blog</span></a>'
     +'<a class="browse-mrow" href="https://t.me/MarginPadBot" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>Telegram</a>'
     +'<a class="browse-mrow" href="/api/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>API</a>'
     +'<a class="browse-mrow" href="/widgets/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg><span data-i18n="navWidgets">Widgets</span></a>'
     +'<a class="browse-mrow" href="/about/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/></svg><span data-i18n="navAbout">About</span></a>'
     +'<a class="browse-mrow" href="/contact/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg><span data-i18n="navContact">Contact</span></a>'
   +'</div></div></div>';
  var bp=document.createElement('div');bp.id='browsePanel';bp.className='browse';bp.hidden=true;bp.innerHTML=html;document.body.appendChild(bp);
  var searchEl=bp.querySelector('.browse-search'),scrollEl=bp.querySelector('.browse-scroll');
  function filterBrowse(q){
    q=(q||'').trim().toLowerCase();if(!scrollEl)return;
    var sub=scrollEl.querySelector('[data-sub="calc"]');if(sub)sub.hidden=!q; // searching reveals calculator sub-items so they can match
    var curSec=null,secHas=false;
    function flush(){if(curSec)curSec.style.display=secHas?'':'none';}
    Array.prototype.forEach.call(scrollEl.children,function(el){
      if(el.classList.contains('browse-sec')){flush();curSec=el;secHas=false;return;}
      var items=(el.matches('.browse-row,.browse-mrow,.browse-subrow'))?[el]:Array.prototype.slice.call(el.querySelectorAll('.browse-row,.browse-mrow,.browse-subrow'));
      if(!items.length){return;}
      var anyVis=false;
      items.forEach(function(it){var m=!q||(it.textContent||'').toLowerCase().indexOf(q)>=0;it.style.display=m?'':'none';if(m)anyVis=true;});
      el.style.display=anyVis?'':'none';if(anyVis)secHas=true;
    });
    flush();
    renderSugg(q);
    var sg=document.getElementById('browseSugg');var hasSugg=sg&&!sg.hidden&&sg.children.length;
    var nores=scrollEl.querySelector('.browse-nores');var anyShown=Array.prototype.some.call(scrollEl.querySelectorAll('.browse-row,.browse-mrow,.browse-subrow'),function(it){return it.style.display!=='none';});
    if(!anyShown&&!hasSugg&&q){if(!nores){nores=document.createElement('div');nores.className='browse-nores';scrollEl.appendChild(nores);}nores.textContent=((window.mpT&&window.mpT('brNoRes'))||'No matches for')+' “'+q+'”.';nores.style.display='';}
    else if(nores){nores.style.display='none';}
  }
  // Browse search → live content suggestions from the whole site (lazy-loads /search-index.json on first use)
  var SIDX=null,_sidxL=false;
  function _esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function loadSidx(cb){if(SIDX){cb&&cb();return;}if(_sidxL){return;}_sidxL=true;fetch('/search-index.json').then(function(r){return r.ok?r.json():[];}).then(function(a){SIDX=a||[];_sidxL=false;if(cb)cb();}).catch(function(){SIDX=[];_sidxL=false;});}
  function renderSugg(q){var box=document.getElementById('browseSugg');if(!box)return;q=(q||'').trim().toLowerCase();
    if(q.length<2){box.hidden=true;box.innerHTML='';return;}
    if(!SIDX){loadSidx(function(){renderSugg(q);});return;}
    var hits=[];for(var i=0;i<SIDX.length&&hits.length<8;i++){var x=SIDX[i];if(x.t.toLowerCase().indexOf(q)>=0||x.u.toLowerCase().indexOf(q)>=0)hits.push(x);}
    if(!hits.length){box.hidden=true;box.innerHTML='';return;}
    box.innerHTML='<div class="browse-sec">Pages &amp; content</div>'+hits.map(function(h){return '<a class="browse-sg" href="'+h.u+'"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><span>'+_esc(h.t)+'</span><small>'+_esc(h.u)+'</small></a>';}).join('');
    box.hidden=false;}
  if(searchEl)searchEl.addEventListener('input',function(){filterBrowse(searchEl.value);});
  var _bsY=0;
  function open(mode){bp.classList.toggle('aside',mode==='aside');if(searchEl){searchEl.value='';filterBrowse('');}loadSidx();bp.hidden=false;_bsY=window.scrollY||window.pageYOffset||0;document.body.style.top=(-_bsY)+'px';document.documentElement.classList.add('browse-lock');requestAnimationFrame(function(){bp.classList.add('open');if(mode==='aside'&&searchEl)setTimeout(function(){searchEl.focus();},250);});}
  function close(){bp.classList.remove('open');document.documentElement.classList.remove('browse-lock');document.body.style.top='';if(_bsY)window.scrollTo(0,_bsY);setTimeout(function(){bp.hidden=true;},300);}
  window.__openBrowse=open;
  var hm=document.getElementById('hmenuBtn');if(hm)hm.addEventListener('click',function(){if(window.mpNavOpen){window.mpNavOpen();return;}var b=document.querySelector('.mpnav-burger');if(b){b.click();return;}open('aside');});
  bp.addEventListener('click',function(e){var t=e.target;
    if(t===bp){close();return;} // click the dimmed area beside the drawer
    if(t.closest('.browse-x')){close();return;}
    var exp=t.closest('[data-expand]');if(exp){var sub=bp.querySelector('[data-sub="'+exp.getAttribute('data-expand')+'"]');if(sub){var show=sub.hidden;sub.hidden=!show;exp.classList.toggle('expanded',show);}return;}
    var go=t.closest('[data-go]');if(go){var p=go.getAttribute('data-go');
      var _dest={plan:'/paper-trade',charts:'/charts',calc:'/calculators',heat:'/heatmap',swap:'/swap'}[p]||('/?p='+p);
      if(window.mpGo){close();window.mpGo(_dest);return;} // in-page switch (no reload) — works from the homepage or a dedicated page
      if(p==='plan'){location.href='/paper-trade';return;}
      if(/paper-page|charts-page|calc-page|heatmap-page|swap-page/.test(document.body.className)){location.href=_dest;return;}
      var c=document.querySelector('.prod[data-prod="'+p+'"]');close();setTimeout(function(){if(c)c.click();window.scrollTo({top:0,behavior:'smooth'});},130);return;}
    var cc=t.closest('[data-calc]');if(cc){var _cu='/calculators?c='+cc.getAttribute('data-calc');if(window.mpGo){close();window.mpGo(_cu);}else{location.href=_cu;}return;}
    if(t.closest('a'))close();
  });
  var bb=document.querySelector('.mobnav [data-mn="browse"]');if(bb)bb.addEventListener('click',function(e){e.preventDefault();open();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!bp.hidden)close();});
})();

;/* ══════════ inline block from app/index.html line 4921 ══════════ */
/* Screener lazy-loaded — only the /screener route needs it (was 13KB inline, dead weight on the homepage). */
if(/^\/screener\/?$/.test(location.pathname)){var _ss=document.createElement('script');_ss.src='/assets/mp-screener.js';_ss.defer=true;document.head.appendChild(_ss);}

;/* ══════════ inline block from app/index.html line 4935 ══════════ */
/* P0 dual-write shared helper: server-first open for ANY opener. Signed-in -> POST /api/trade/open
   (1.4s abort) -> ok(serverPosition) ; anon/timeout/error -> fail() = the caller's classic local open. */
window.mpSrvOpen=function(payload,ok,fail){
  var me=null;try{me=window.mpAuth&&window.mpAuth.me&&window.mpAuth.me();}catch(e){}
  if(!me||!window.fetch){fail();return;}
  var ac=(typeof AbortController!=='undefined')?new AbortController():null;
  var to=setTimeout(function(){try{if(ac)ac.abort();}catch(e){}},1400);
  fetch('/api/trade/open',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',signal:ac?ac.signal:undefined,body:JSON.stringify(payload)})
    .then(function(r){return r.json();})
    .then(function(d){clearTimeout(to);if(d&&d.ok&&d.position&&d.position.id)ok(d.position);else fail();})
    .catch(function(){clearTimeout(to);fail();});
};
/* Daily-visit streak + comeback hook — pure client (localStorage), reaches every visitor. Builds a daily-return habit; window.mpStreak is exposed for the faucet/league to read. */
(function(){try{
  var K='mp_streak';
  function dstr(off){var d=new Date();if(off)d.setUTCDate(d.getUTCDate()+off);return d.toISOString().slice(0,10);}
  var T=dstr(0),Y=dstr(-1),s={};try{s=JSON.parse(localStorage.getItem(K)||'{}');}catch(e){}
  var prev=s.last,isNew=(prev!==T),returning=!!prev&&isNew;
  if(isNew){s.d=(prev===Y)?((s.d||0)+1):1;s.last=T;s.best=Math.max(s.best||0,s.d||1);try{localStorage.setItem(K,JSON.stringify(s));}catch(e){}}
  window.mpStreak=s;
  if(!returning)return; // only nudge on a real return visit (new day), never on first-ever visit or same-day reloads
  var n=s.d||1,el=document.getElementById('mpStreak');if(!el)return;
  var line;
  if(n>=30)line='A month straight. At this point the market checks on YOU.';
  else if(n>=14)line='Two weeks deep — this is what discipline looks like.';
  else if(n>=7)line='A full week. Most people quit by Wednesday.';
  else if(n>=3)line='Day '+n+'. Habits beat hunches — keep stacking.';
  else line='Back-to-back days. The chart noticed.';
  var sub=n>=2?(line+' Set a price alert so you never miss a move.'):'Welcome back. Show up tomorrow and this becomes a streak.';
  el.innerHTML='<span class="fr">🔥</span><div style="flex:1"><b>'+n+'-day streak</b><small>'+sub+'</small>'+(n>=2?'<a class="mps-cta" href="/alerts/">Set a price alert →</a>':'')+'</div><span class="mps-x">×</span>';
  function hide(){el.classList.remove('show');setTimeout(function(){el.hidden=true;},400);}
  // Only the explicit CTA link navigates. Tapping anywhere else on the toast just dismisses it — it must NEVER hijack a tap meant for the page underneath (e.g. the trade button) and send it to /alerts.
  el.addEventListener('click',function(e){if(e.target.closest('.mps-cta'))return;hide();});
  setTimeout(function(){el.hidden=false;requestAnimationFrame(function(){el.classList.add('show');});},1400);
  setTimeout(hide,8500);
}catch(e){}})();

;/* ══════════ inline block from app/index.html line 4955 ══════════ */
/* Import a paper position opened from the Telegram bot (?claim=TOKEN) into My Trades — works on web or mobile, idempotent. */
(function(){
  try{
    var u=new URL(location.href);var tok=u.searchParams.get('claim');if(!tok||!/^[a-z0-9]{6,48}$/i.test(tok))return;
    function cleanUrl(){try{u.searchParams.delete('claim');history.replaceState(null,'',u.pathname+(u.searchParams.toString()?'?'+u.searchParams.toString():'')+u.hash);}catch(e){}}
    function toast(){var t=document.createElement('div');t.innerHTML='Imported your Telegram trade — open in <b>My Trades</b>.';t.style.cssText='position:fixed;left:50%;bottom:84px;transform:translateX(-50%) translateY(20px);z-index:120;background:#0a0b0d;color:#e9e7df;border:1px solid #2f3742;border-left:3px solid #c2f64a;border-radius:12px;padding:12px 16px;font-size:13.5px;line-height:1.4;box-shadow:0 12px 34px rgba(0,0,0,.5);opacity:0;transition:.35s;max-width:90vw;cursor:pointer';document.body.appendChild(t);requestAnimationFrame(function(){t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';});var go=function(){var b=document.querySelector('[data-mytrades]');if(b)b.click();};t.addEventListener('click',go);setTimeout(go,700);setTimeout(function(){t.style.opacity='0';t.style.transform='translateX(-50%) translateY(20px)';setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},400);},6000);}
    fetch('/api/tgclaim?token='+encodeURIComponent(tok)).then(function(r){return r.ok?r.json():null;}).then(function(j){
      if(!j||!j.ok||!j.pos)return;var p=j.pos;
      var arr;try{arr=JSON.parse(localStorage.getItem('mp_journal')||'[]')||[];}catch(e){arr=[];}
      if(arr.some(function(e){return e&&e.tgClaim===tok;})){cleanUrl();try{if(window.mpJournalRender)window.mpJournalRender();}catch(e){}toast();return;}
      var lev=Math.max(1,+p.lev||1),entry=+p.entry,margin=+p.margin||0,long=p.side!=='short';
      if(!(entry>0)){cleanUrl();return;}
      if(window.mpTradeGate&&!window.mpTradeGate(p.sym,long?'long':'short')){cleanUrl();return;} // respect open-trade limits + one-way mode for Telegram imports too
      var notional=margin*lev,qty=entry>0?notional/entry:0,mmr=0.005;
      var liq=long?entry*(1-(1-mmr)/lev):entry*(1+(1-mmr)/lev);
      arr.push({id:String(Date.now())+'_'+Math.floor(Math.random()*1e4),ts:+p.ts||Date.now(),sym:p.sym,side:long?'long':'short',entry:entry,stop:null,tp:null,lev:lev,rr:null,qty:qty,notional:notional,margin:margin,riskAmt:margin,liq:liq,mmr:mmr,feeRate:window.mpFeeRate(lev),status:'open',pnl:null,src:'telegram',tgClaim:tok});
      try{localStorage.setItem('mp_journal',JSON.stringify(arr));}catch(e){}
      try{window.mpLivePrices=window.mpLivePrices||{};if(!(window.mpLivePrices[p.sym]&&window.mpLivePrices[p.sym].p>0))window.mpLivePrices[p.sym]={p:entry,t:Date.now()};}catch(e){}
      cleanUrl();try{if(window.mpJournalRender)window.mpJournalRender();}catch(e){}toast();
    }).catch(function(){});
  }catch(e){}
})();

;/* ══════════ inline block from app/index.html line 4979 ══════════ */
/* Paper-trade limits: max 50 open positions total, max 10 open per pair, and ONE-WAY mode (can't hold a long and a short on the same pair at once — kills the hedge trick). Blocks the open and shows a toast. */
(function(){
  var MAX_TOTAL=50,MAX_PAIR=10;
  function openTrades(){try{return (JSON.parse(localStorage.getItem('mp_journal')||'[]')||[]).filter(function(e){return e&&e.status==='open';});}catch(e){return [];}}
  var _lt=0;
  window.mpLimitToast=function(msg){
    var now=Date.now();if(now-_lt<600)return;_lt=now; // de-dupe rapid double-fires
    var t=document.createElement('div');t.textContent=msg;
    t.style.cssText='position:fixed;left:50%;bottom:84px;transform:translateX(-50%) translateY(20px);z-index:130;background:#1a0f0f;color:#ffd2cc;border:1px solid #ff6258;border-left:3px solid #ff6258;border-radius:12px;padding:13px 17px;font-size:13.5px;line-height:1.4;max-width:90vw;box-shadow:0 12px 34px rgba(0,0,0,.5);opacity:0;transition:.3s;font-family:inherit;text-align:center;';
    document.body.appendChild(t);requestAnimationFrame(function(){t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';});
    setTimeout(function(){t.style.opacity='0';t.style.transform='translateX(-50%) translateY(20px)';setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},350);},4500);
  };
  // returns true if a new `side` trade on `sym` is allowed; otherwise shows the limit toast and returns false
  window.mpTradeGate=function(sym,side){
    var open=openTrades();
    if(open.length>=MAX_TOTAL){window.mpLimitToast('Limit reached — '+MAX_TOTAL+' open trades is the max. Close some to open new ones.');return false;}
    if(sym){var s=String(sym).toUpperCase();
      if(side){ // one-way mode: can't open the OPPOSITE direction on a pair you already hold open (no long+short hedge on the same coin)
        var want=(side==='short')?'short':'long';
        var hasOpp=open.some(function(e){return String(e.sym||'').toUpperCase()===s&&((e.side==='short'?'short':'long')!==want);});
        if(hasOpp){window.mpLimitToast('You already have a '+(want==='long'?'SHORT':'LONG')+' '+s+' position open — close it before opening a '+(want==='long'?'LONG':'SHORT')+'.');return false;}
      }
      var n=open.filter(function(e){return String(e.sym||'').toUpperCase()===s;}).length;
      if(n>=MAX_PAIR){window.mpLimitToast('Limit reached — max '+MAX_PAIR+' open '+s+' trades. Close one to open another.');return false;}}
    return true;
  };
})();

;/* ══════════ inline block from app/index.html line 5008 ══════════ */
/* Site-wide announcement banner (admin Settings → Site announcement): red=severe, orange=blocker, green=fix. */
(function(){try{fetch('/api/announce').then(function(r){return r.ok?r.json():null;}).then(function(a){if(!a||!a.level||!a.msg)return;try{if(sessionStorage.getItem('mp_ann_x')===String(a.ts))return;}catch(e){}if(document.getElementById('mpAnnounce'))return;var C={severe:['rgba(176,28,28,.94)','#fff'],blocker:['rgba(226,128,20,.95)','#1a1205'],fix:['rgba(36,164,96,.95)','#04140b']}[a.level]||['rgba(40,40,46,.95)','#fff'];var d=document.createElement('div');d.id='mpAnnounce';d.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483600;padding:9px 38px 9px 14px;text-align:center;font:600 13px/1.45 system-ui,-apple-system,sans-serif;background:'+C[0]+';color:'+C[1]+';-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 2px 14px rgba(0,0,0,.45)';d.textContent=a.msg;var x=document.createElement('button');x.type='button';x.setAttribute('aria-label','Dismiss');x.innerHTML='&#10005;';x.style.cssText='position:absolute;right:9px;top:50%;transform:translateY(-50%);background:none;border:none;color:inherit;font-size:14px;cursor:pointer;opacity:.85';x.onclick=function(){d.remove();try{sessionStorage.setItem('mp_ann_x',String(a.ts));}catch(e){}};d.appendChild(x);(document.body||document.documentElement).appendChild(d);}).catch(function(){});}catch(e){}})();

;/* ══════════ inline block from app/index.html line 5091 ══════════ */
/* Mobile full-screen Charts lazy-loaded (was 29KB inline). Loader handles the data-mcharts tap + /charts mobile landing, then loads the module (and the draw engine for __mpDraw). */
(function(){
  var loading=false;
  function isMob(){return !!(window.matchMedia&&window.matchMedia('(max-width:880px)').matches);}
  function ensure(cb){
    if(window.mpOpenCharts){cb&&cb();return;}
    try{if(window.mpLoadCharts)window.mpLoadCharts();}catch(e){}
    if(loading){document.addEventListener('mp-mch-ready',function h(){document.removeEventListener('mp-mch-ready',h);cb&&cb();});return;}
    loading=true;
    var sc=document.createElement('script'); sc.src='/assets/mp-mcharts.js'; sc.defer=true;
    sc.onload=function(){try{document.dispatchEvent(new Event('mp-mch-ready'));}catch(e){} cb&&cb();};
    document.head.appendChild(sc);
  }
  document.addEventListener('click',function(e){
    if(window.mpOpenCharts)return;
    var t=e.target.closest&&e.target.closest('[data-mcharts]'); if(!t)return;
    if(isMob()){e.preventDefault();e.stopPropagation();ensure(function(){if(window.mpOpenCharts)window.mpOpenCharts();});}
  },true);
  window.mpOpenMobileCharts=function(sym){ensure(function(){if(window.mpOpenCharts)window.mpOpenCharts(sym);});};
  if(isMob()&&/^\/charts\/?$/.test(location.pathname)){window.addEventListener('load',function(){setTimeout(function(){var _fc=null;try{_fc=sessionStorage.getItem('mp_force_chart');if(_fc)sessionStorage.removeItem('mp_force_chart');}catch(e){}if(!_fc){try{_fc=(location.search.match(/[?&]coin=([A-Za-z0-9]+)/i)||[])[1]||null;}catch(e){}}ensure(function(){if(window.mpOpenCharts)window.mpOpenCharts(_fc||undefined);});},250);});}
})();

;/* ══════════ service worker registration (added 2026-07) ══════════
   Register for EVERYONE — offline app-shell + instant repeat loads. Previously sw.js was only
   registered when a user enabled push notifications, so the installed PWA had no offline support. */
(function(){ if('serviceWorker' in navigator){ try{ navigator.serviceWorker.register('/sw.js'); }catch(e){} } })();

;/* ══════════ UX pass (2026-07): calculators remember your numbers + live-price prefill ══════════
   The calc tabs shipped with a hardcoded 60000 entry price and forgot everything on reload. Now every
   calculator input persists in localStorage (your setup survives reloads/visits), and on a first-ever
   visit the untouched entry-price fields fill with the LIVE BTC price the moment it arrives. */
(function(){
  var PANES=['liq','cross','size','pnl','dca','tp','rr'],K='mp_calc_vals';
  var saved={};try{saved=JSON.parse(localStorage.getItem(K)||'{}')||{};}catch(e){}
  var els=[];PANES.forEach(function(pid){var p=document.getElementById(pid);if(!p)return;els=els.concat(Array.prototype.slice.call(p.querySelectorAll('input[type=number],select')));});
  if(!els.length)return;
  var restored=[];
  function persist(el){if(!el.id)return;saved[el.id]=el.value;try{localStorage.setItem(K,JSON.stringify(saved));}catch(e){}}
  els.forEach(function(el){ if(!el.id)return;
    if(saved[el.id]!=null&&saved[el.id]!==''&&saved[el.id]!==el.value){el.value=saved[el.id];restored.push(el);}
    el.addEventListener('input',function(){persist(el);});
    el.addEventListener('change',function(){persist(el);});
  });
  var ENTRY=['liqEntry','crEntry','szEntry','pnlEntry','tpEntry','rrEntry','dcaP1','dcaCur'];
  function prefill(){var lp=window.mpLivePrices&&window.mpLivePrices.BTC,px=lp&&lp.p;if(!(px>0))return false;
    ENTRY.forEach(function(id){ if(saved[id]!=null&&saved[id]!=='')return; var el=document.getElementById(id);if(!el)return;
      var v=+el.value; if(v===60000||v===58000||v===65000){el.value=Math.round(px);try{el.dispatchEvent(new Event('input',{bubbles:true}));}catch(e){}} });
    return true;}
  if(!prefill()){var n=0,t=setInterval(function(){if(prefill()||++n>24)clearInterval(t);},700);}
  restored.forEach(function(el){try{el.dispatchEvent(new Event('input',{bubbles:true}));}catch(e){}}); // recompute results with the restored values
})();

;/* ══════════ UX pass (2026-07): bottom-nav "Trades" badge — open-position count at a glance ══════════ */
(function(){
  var btn=document.querySelector('.mobnav [data-mn="journal"]');if(!btn)return;
  var b=document.createElement('span');b.className='mn-badge';b.hidden=true;btn.appendChild(b);
  function count(){try{return (JSON.parse(localStorage.getItem('mp_journal')||'[]')).filter(function(e){return e.status==='open';}).length;}catch(e){return 0;}}
  function upd(){var n=count();if(n>0){b.textContent=n>9?'9+':String(n);b.hidden=false;}else b.hidden=true;}
  upd();setInterval(upd,3000);window.addEventListener('storage',upd);
  try{var _jr=window.mpJournalRender;if(typeof _jr==='function')window.mpJournalRender=function(){try{_jr.apply(this,arguments);}finally{try{upd();}catch(e){}}};}catch(e){} /* instant badge on open/close (render fires on every journal change) */
})();

;/* ══════════ Partial-close sheet (owner task 2026-07): Close anywhere → pick how much to close ══════════
   window.mpCloseSheet(id, onDone): bottom sheet with 25/50/75/100% chips + slider + live preview.
   Partial close splits the position: a proportional slice (qty/margin/notional × pct) becomes its own CLOSED
   trade (same entry/leverage → identical ROE math, so the Leaderboard/journal/stats treat it like any trade),
   and the remainder stays OPEN with entry/liq/SL/TP untouched. 100% behaves exactly like the old full close. */
(function(){ if(window.mpCloseSheet)return;
  function jload(){try{return JSON.parse(localStorage.getItem('mp_journal'))||[];}catch(e){return[];}}
  function jstore(a){try{localStorage.setItem('mp_journal',JSON.stringify(a));}catch(e){}}
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
    jstore(d);hide();
    var _tear=(f>=1)?mpcsCaptureTear(curId):null; // desktop full-close receipt tear
    done();
    if(_tear)_tear();
    // confirm the close — the card just vanishing left users asking "where did my trade go?" (UX audit)
    try{var _cp=(f>=1?(+e.pnl||0):pnl)||0,_px=(+m.live).toLocaleString('en-US',{maximumFractionDigits:6});
      if(window.mpLimitToast)window.mpLimitToast((f>=1?'Closed ':'Closed '+Math.round(f*100)+'% of ')+String(e.sym||'')+' at '+_px+' · '+(_cp>=0?'+$':'−$')+Math.abs(_cp).toFixed(2)+' — saved to My Trades.');}catch(_){}
  }
  // DESKTOP receipt-tear animation: on a FULL close, clone the just-closed ticket, tear off its bottom stub
  // along the perforation, then fly the top toward My Trades — so the close reads as "filed away", not "vanished".
  function mpcsCaptureTear(id){
    try{
      if(window.innerWidth<721)return null; // desktop only (owner scope)
      var _dr=document.getElementById('jrDrawer'); if(_dr&&!_dr.hidden)return null; // My Trades drawer open -> the mini ticket is hidden behind it; tearing it would bleed a phantom clone over the drawer
      var host=document.getElementById('ptLastTrade'); if(!host)return null;
      var card=null,cards=host.querySelectorAll('.pt-last');
      for(var i=0;i<cards.length;i++){if(cards[i].getAttribute('data-tid')===String(id)){card=cards[i];break;}}
      if(!card)return null;
      var r=card.getBoundingClientRect(); if(!(r.width>0&&r.height>0))return null;
      var W=r.width,H=r.height,cls=(/\bpf\b/.test(card.className)?' pf':/\bls\b/.test(card.className)?' ls':' be');
      // the tear runs along the perforation (.ptl-cut); both fragments share the SAME jagged line so they interlock
      var cutEl=card.querySelector('.ptl-cut'),cutY=cutEl?(cutEl.getBoundingClientRect().top-r.top+1):Math.round(H*0.6);
      cutY=Math.max(20,Math.min(H-16,cutY));
      var A=5,TW=11,Z=[],x=0,k=0; // zigzag boundary points, left→right (clip-path needs px units on every coord)
      for(x=0;x<=W;x+=TW){Z.push(x.toFixed(0)+'px '+((k%2?cutY-A:cutY)).toFixed(0)+'px');k++;}
      Z.push(W.toFixed(0)+'px '+((k%2?cutY-A:cutY)).toFixed(0)+'px');
      var topPoly='polygon(0px 0px, '+W.toFixed(0)+'px 0px, '+Z.slice().reverse().join(', ')+')';
      var botPoly='polygon('+Z.join(', ')+', '+W.toFixed(0)+'px '+H.toFixed(0)+'px, 0px '+H.toFixed(0)+'px)';
      // fly target = the first on-screen "My Trades" trigger; fall back to the top-right corner
      var tgt=null,cand=document.querySelectorAll('[data-mytrades]');
      for(var j=0;j<cand.length;j++){var rr=cand[j].getBoundingClientRect();if(rr.width>0&&rr.height>0&&rr.bottom>0&&rr.top<window.innerHeight){tgt=rr;break;}}
      var cx=r.left+r.width/2,cy=r.top+cutY/2;
      var tx=tgt?(tgt.left+tgt.width/2):(window.innerWidth-46),ty=tgt?(tgt.top+tgt.height/2):46;
      var wrap=document.createElement('div');
      wrap.className='mpcs-tearwrap';
      wrap.style.cssText='position:fixed;left:'+r.left+'px;top:'+r.top+'px;width:'+W+'px;height:'+H+'px;margin:0;';
      function frag(poly,extra){var f=card.cloneNode(true);f.className='pt-last mpcs-frag'+cls+' '+extra;
        f.style.cssText='position:absolute;left:0;top:0;width:'+W+'px;height:'+H+'px;margin:0;clip-path:'+poly+';-webkit-clip-path:'+poly+';';return f;}
      var top=frag(topPoly,'mpcs-top'),bot=frag(botPoly,'mpcs-bot');
      top.style.setProperty('--dx',(tx-cx).toFixed(0)+'px');
      top.style.setProperty('--dy',(ty-cy).toFixed(0)+'px');
      wrap.appendChild(bot);wrap.appendChild(top);
      document.body.appendChild(wrap);
      // remember where the OTHER tickets sit now, so after the list rebuilds we can slide them up smoothly
      // (FLIP) instead of letting the one below snap into the torn ticket's slot — which read as "a hidden position".
      var oldTops={};
      Array.prototype.forEach.call(host.querySelectorAll('.pt-last'),function(c){var tid=c.getAttribute('data-tid');if(tid&&tid!==String(id))oldTops[tid]=c.getBoundingClientRect().top;});
      return function(){ void wrap.offsetWidth; wrap.classList.add('tearing');
        try{ var nh=document.getElementById('ptLastTrade');
          if(nh)Array.prototype.forEach.call(nh.querySelectorAll('.pt-last'),function(c){
            var tid=c.getAttribute('data-tid'),o=oldTops[tid]; if(o==null)return;
            var dy=o-c.getBoundingClientRect().top; if(Math.abs(dy)<1)return;
            // HOLD the gap open (pin the survivor at its old spot) while the stub tears off, THEN glide it up.
            // Sliding immediately made the one below arrive before the tear finished — it read as a hidden position.
            c.style.transition='none'; c.style.transform='translateY('+dy.toFixed(1)+'px)';
            setTimeout(function(){
              c.style.transition='transform .55s cubic-bezier(.22,.61,.36,1)'; c.style.transform='translateY(0)';
              setTimeout(function(){c.style.transition='';c.style.transform='';},600);
            },320); // hold ~320ms so the torn stub has visibly fallen away first
          });
        }catch(_){}
        setTimeout(function(){try{wrap.parentNode&&wrap.parentNode.removeChild(wrap);}catch(_){}} ,1100); };
    }catch(e){return null;}
  }
  window.mpCloseSheet=function(id,cb){var _t0=performance.now();var r=show(id,cb);try{requestAnimationFrame(function(){try{window.__mpUxm&&window.__mpUxm('mo',performance.now()-_t0);}catch(e){}});}catch(e){}return r;}; // UX budget: modal open → next paint
})();

;/* ══════════ SL/TP edit sheet (owner tasks 2026-07 + 2026-07-13 multi-level): edit stop-loss / take-profit
   LEVELS on any OPEN ticket. window.mpSltpSheet(id, onDone). Up to 3 levels per side, each with a % of the
   position to close at that price (100% = full close, smaller % = partial, remainder stays open). Every level
   has an ✕ remove button — no levels = no SL/TP. Wrong-side values are rejected per level. Storage: a single
   100% level stays in legacy e.stop/e.tp; anything richer goes to e.sls/e.tps=[{p,pct}] with the legacy field
   mirroring the nearest 100% level (so checkClose/sweepLiq/legacy displays keep working unchanged). */
(function(){ if(window.mpSltpSheet)return;
  function jload(){try{return JSON.parse(localStorage.getItem('mp_journal'))||[];}catch(e){return[];}}
  function jstore(a){try{localStorage.setItem('mp_journal',JSON.stringify(a));}catch(e){}}
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
    try{document.dispatchEvent(new CustomEvent('mp:sltp',{detail:{id:e.id}}));}catch(_){}
    try{window.__mpTrack&&window.__mpTrack('sltp',(e.sym||'')+' '+(e.side==='short'?'SHORT':'LONG'));}catch(_){}
    try{if(window.mpBuzz)window.mpBuzz([14]);else if(navigator.vibrate)navigator.vibrate(14);}catch(_){}
    try{if(window.mpJournalRender)window.mpJournalRender();}catch(_){}
    if(after)try{after();}catch(_){}
  }
  window.mpSltpSheet=show;
})();

;/* $100k cap directly on the amount input (typing 250000 snaps to 100000; add() re-checks as a backstop) */
(function(){var MAXT=100000,a=document.getElementById("planAmt"),_hT=0;if(!a)return;try{a.max=String(MAXT);}catch(e){}a.addEventListener("input",function(){var v=parseFloat(a.value);if(isFinite(v)&&v>MAXT){a.value=String(MAXT);var n=Date.now();if(n-_hT>4000){_hT=n;if(window.mpLimitToast)window.mpLimitToast('Max trade size is $100,000.');}}});})(); /* explain the snap instead of changing the number under the user's fingers (UX audit) */

;/* ══════════ iOS leftover-zoom shield for the Browse panel (owner: "zumirani browse 10-20% posle charts") ══════════
   If the visual viewport is still scaled after a rotation, counter-transform the panel into the real on-screen
   rect (same technique as the charts toolbar) so Browse always renders 1:1 until a navigation resets the zoom. */
(function(){ if(!window.visualViewport)return; var vv=window.visualViewport;
  function pin(){try{var bp=document.getElementById('browsePanel');if(!bp)return;
    if(bp.hidden){bp.style.transform='';bp.style.width='';bp.style.height='';return;}
    var sc=vv.scale||1,ox=vv.offsetLeft||0,oy=vv.offsetTop||0;
    if(Math.abs(sc-1)<0.03&&ox<2&&oy<2){bp.style.transform='';bp.style.width='';bp.style.height='';return;}
    bp.style.transformOrigin='0 0';
    bp.style.width=(vv.width*sc)+'px';bp.style.height=(vv.height*sc)+'px';
    bp.style.transform='translate('+ox+'px,'+oy+'px) scale('+(1/sc)+')';
  }catch(e){}}
  vv.addEventListener('resize',pin);vv.addEventListener('scroll',pin);setInterval(pin,700);
})();

/* Anonymous open-position sync -> ops Live-trades board. Signed-in users already sync via mp-auth (utrades);
   guests would otherwise be invisible to the board. Posts ONLY when the open set changes (idle = no writes). */
(function(){
  function opens(){ try{ var a=JSON.parse(localStorage.getItem('mp_journal')||'[]'); return Array.isArray(a)?a.filter(function(e){return e&&e.status!=='win'&&e.status!=='loss';}):[]; }catch(e){ return []; } }
  function signedIn(){ try{ return !!(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me()); }catch(e){ return false; } }
  var lastSig=null;
  function sync(force){
    if(signedIn()){ lastSig=null; return; }                       // signed-in -> utrades covers them
    var o=opens();
    var sig=JSON.stringify(o.map(function(e){return [e.id,e.qty,e.side,e.status];}));
    if(!force && sig===lastSig) return;                            // no change -> no write
    if(lastSig===null && !o.length){ lastSig=sig; return; }        // never sent + nothing open -> skip empty post
    lastSig=sig;
    try{
      var body=JSON.stringify({opens:o.slice(0,40)});
      if(navigator.sendBeacon){ navigator.sendBeacon('/api/livepos', new Blob([body],{type:'application/json'})); }
      else { fetch('/api/livepos',{method:'POST',headers:{'content-type':'application/json'},body:body,keepalive:true}); }
    }catch(e){}
  }
  setInterval(function(){ sync(false); }, 8000);
  document.addEventListener('visibilitychange', function(){ if(document.hidden) sync(false); });
  window.addEventListener('pagehide', function(){ sync(false); });
  setTimeout(function(){ sync(true); }, 4000);
})();

/* Presence heartbeat (2026-07-17): svakih 60s dok je tab vidljiv -> t=hb, da "online now" na ops-u
   broji i ljude koji drze stranicu otvorenu bez navigacije. Ne broji se kao pageview ni event. */
(function () {
  try {
    if (window.__mpHb) return; window.__mpHb = 1;
    function hb() { try { if (document.hidden) return; var u = '/api/track?t=hb&p=' + encodeURIComponent(location.pathname); if (navigator.sendBeacon) { navigator.sendBeacon(u); } else { (new Image()).src = u; } } catch (e) {} }
    setInterval(hb, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) hb(); });
  } catch (e) {}
})();

/* MarginPad Health probe: once per ~5 min per client, beacon real WS latency (Bybit msg.ts delta) + chart FPS. */
(function(){try{
  if(!window.fetch||!navigator.sendBeacon)return;
  window.__mpUx={};window.__mpUxm=function(k,v){try{if(!isFinite(v)||v<0)return;var u=window.__mpUx;if(u[k]==null||v>u[k])u[k]=v;}catch(e){}};
  function fps(cb){var n=0,t0=performance.now();function f(){n++;if(performance.now()-t0<2000)requestAnimationFrame(f);else cb(Math.round(n/((performance.now()-t0)/1000)));}requestAnimationFrame(f);}
  function probe(){
    if(document.hidden)return;
    var last=0;try{last=+localStorage.getItem('mp_perf_ts')||0;}catch(e){}
    if(Date.now()-last<300000)return;
    try{localStorage.setItem('mp_perf_ts',String(Date.now()));}catch(e){}
    fps(function(f2){
      var ws=(window.__mpWsLat!=null&&window.__mpWsLat>=0)?Math.round(window.__mpWsLat):null;
      var payload={};if(ws!=null)payload.ws=ws;payload.fps=f2;
      try{var u=window.__mpUx||{};for(var k in u){payload[k]=Math.round(u[k]);}window.__mpUx={};}catch(e){}
      try{if(window.__preR){payload.pr=window.__preR;window.__preR=null;}}catch(e){} // preload drift detector: hit|miss (miss = inline drifted → wasted request on every cold load)
      try{var pr=window.mpLivePrices||{},best=1/0,n2=Date.now();for(var s in pr){if(pr[s]&&pr[s].t&&!pr[s].seed)best=Math.min(best,n2-pr[s].t);}if(isFinite(best))payload.pa=Math.max(0,Math.round(best));}catch(e){}
      try{navigator.sendBeacon('/api/perf',new Blob([JSON.stringify(payload)],{type:'application/json'}));}catch(e){}
    });
  }
  setTimeout(probe,15000);setInterval(probe,320000);
}catch(e){}})();
