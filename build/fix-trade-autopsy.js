/* THE TRADE AUTOPSY SHEET (2026-11-12, owner-approved feature #1). A closed ticket gains a "Why" button; it opens a sheet built from
   GET /api/trade/autopsy (the worker route beside /report): the window drawn as a line with entry, exit, best and worst point and the
   trader's own stop; four tiles (best point, worst point, what was taken and what was given back, how long it was held and what it
   cost); where a stop at 1 / 1.5 / 2 ATR - and theirs - would have held; what was liquidated while they were in; the catalysts that
   named the coin. ONE block written into BOTH drawer bundles (home.js + mp-trade.js, hand-mirrored copies) and ONE stylesheet block
   into home.css + mp-trade.css. The `.jrw-lesson` slot is for feature #13. Idempotent; --dry prints what it would do. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DRY = process.argv.includes('--dry');
const MARK = '/* @JRWHY';
const BLOCK = `  ${MARK} THE TRADE AUTOPSY SHEET (2026-11-12, feature #1) - MIRRORED in home.js and mp-trade.js by build/fix-trade-autopsy.js; edit the patcher, not this copy. */
  var _JRWX='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function _wp(v){v=+v;if(!isFinite(v))return '-';var d=v>=1000?2:v>=1?4:v>=0.01?6:8;return v.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:d});}
  function _wt(ms){var x=new Date(+ms);if(!isFinite(x.getTime()))return '-';return x.toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}
  function _wd(ms){ms=Math.max(0,+ms||0);var m=Math.round(ms/60000);if(m<60)return m+'m';var h=Math.floor(m/60);if(h<48)return h+'h '+(m%60)+'m';return Math.floor(h/24)+'d '+(h%24)+'h';}
  function _wu(x){x=+x||0;return (x>=0?'+':'-')+money(Math.abs(x)).replace('-','');}
  function jrWhyBody(d){var t=d.trade||{},s=d.stats||{},long=t.side!=='short',o='';
    var bars=d.bars||[];
    if(bars.length>1){var W=520,H=130,P=6,lo=Infinity,hi=-Infinity;bars.forEach(function(b){if(b[3]<lo)lo=b[3];if(b[2]>hi)hi=b[2];});if(t.stop>0){lo=Math.min(lo,t.stop);hi=Math.max(hi,t.stop);}if(t.entry>0){lo=Math.min(lo,t.entry);hi=Math.max(hi,t.entry);}
      var t0=bars[0][0],t1=bars[bars.length-1][0]||(t0+1);var X=function(ts){return P+(W-2*P)*((ts-t0)/Math.max(1,t1-t0));},Y=function(p){return P+(H-2*P)*(1-(p-lo)/Math.max(1e-12,hi-lo));};
      var pth=bars.map(function(b,i){return (i?'L':'M')+X(b[0]).toFixed(1)+' '+Y(b[4]).toFixed(1);}).join(' ');
      var x0=X(Math.max(t0,t.ts)),x1=X(Math.min(t1,t.cts));
      o+='<svg class="jrw-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true"><rect x="'+x0.toFixed(1)+'" y="0" width="'+Math.max(1,x1-x0).toFixed(1)+'" height="'+H+'" class="win"/>';
      if(t.entry>0)o+='<line x1="0" x2="'+W+'" y1="'+Y(t.entry).toFixed(1)+'" y2="'+Y(t.entry).toFixed(1)+'" class="en"/>';
      if(t.stop>0)o+='<line x1="0" x2="'+W+'" y1="'+Y(t.stop).toFixed(1)+'" y2="'+Y(t.stop).toFixed(1)+'" class="st"/>';
      o+='<path d="'+pth+'" class="px"/>';
      if(s.mfeT&&s.mfePct!=null)o+='<circle cx="'+X(s.mfeT).toFixed(1)+'" cy="'+Y(long?t.entry*(1+s.mfePct/100):t.entry*(1-s.mfePct/100)).toFixed(1)+'" r="4" class="best"/>';
      if(s.maeT&&s.maePct!=null)o+='<circle cx="'+X(s.maeT).toFixed(1)+'" cy="'+Y(long?t.entry*(1-s.maePct/100):t.entry*(1+s.maePct/100)).toFixed(1)+'" r="4" class="worst"/>';
      o+='<circle cx="'+X(t.ts).toFixed(1)+'" cy="'+Y(t.entry).toFixed(1)+'" r="4.5" class="in"/>';if(t.exit>0)o+='<circle cx="'+X(t.cts).toFixed(1)+'" cy="'+Y(t.exit).toFixed(1)+'" r="4.5" class="out"/>';
      o+='</svg><div class="jrw-leg"><span><i class="in"></i>'+MT('whyEntry','entry')+'</span><span><i class="out"></i>'+MT('whyExit','exit')+'</span><span><i class="best"></i>'+MT('whyBest','best point')+'</span><span><i class="worst"></i>'+MT('whyWorst','worst point')+'</span>'+(t.stop>0?'<span><i class="st"></i>'+MT('whyStop','your stop')+'</span>':'')+'</div>';}
    function tile(v,l,c){return '<div class="jrw-tl"><div class="v"'+(c?' style="color:'+c+'"':'')+'>'+v+'</div><div class="l">'+l+'</div></div>';}
    o+='<div class="jrw-tiles">'
      +tile(s.mfePct!=null?'+'+s.mfePct.toFixed(2)+'%'+(s.mfeUsd!=null?' <small>'+_wu(s.mfeUsd)+'</small>':''):'-',MT('whyBestL','Best point in your favour')+(s.mfeT?' · '+_wt(s.mfeT):''),'#34d99a')
      +tile(s.maePct!=null?'-'+s.maePct.toFixed(2)+'%'+(s.maeUsd!=null?' <small>'+_wu(-s.maeUsd)+'</small>':''):'-',MT('whyWorstL','Worst point against you')+(s.maeT?' · '+_wt(s.maeT):''),'#ff7b72')
      +tile(s.movePct!=null?(s.movePct>=0?'+':'')+s.movePct.toFixed(2)+'%'+(t.pnl!=null?' <small>'+_wu(t.pnl)+'</small>':''):'-',MT('whyTook','You took')+(s.giveBackShare!=null&&s.giveBackShare>0.05?' · '+MT('whyGave','gave back')+' '+Math.round(s.giveBackShare*100)+'% '+MT('whyOfBest','of the best'):''),(s.movePct!=null&&s.movePct>=0)?'#34d99a':'#ff7b72')
      +tile(_wd(s.heldMs),MT('whyHeld','Held')+((t.fee!=null||t.fund!=null)?' · '+MT('whyCosts','fees + funding')+' '+money((+t.fee||0)+(+t.fund||0)):''))
      +'</div>';
    if((s.ladder&&s.ladder.length)||s.yourStop){o+='<div class="jrw-sec">'+MT('whyStops','Where a stop would have held')+(s.atrPct!=null?'<small>'+MT('whyAtr','pre-trade range, 1 ATR =')+' '+s.atrPct.toFixed(2)+'%</small>':'')+'</div><div class="jrw-rows">';
      var rowS=function(lbl,px,pct,held,usd,mine){return '<div class="jrw-row'+(mine?' mine':'')+'" data-held="'+(held===true?'1':held===false?'0':'')+'"><span class="a">'+lbl+'</span><span class="b">'+_wp(px)+' <small>'+(+pct).toFixed(2)+'%</small></span><span class="c '+(held===true?'ok':held===false?'no':'')+'">'+(held===true?MT('whyHeldY','held'):held===false?MT('whyHeldN','hit'):'-')+'</span><span class="d">'+(usd!=null?'-'+money(Math.abs(usd)).replace('-',''):'-')+'</span></div>';};
      if(s.yourStop)o+=rowS(MT('whyYours','Your stop')+(s.yourStop.atr!=null?' <small>'+s.yourStop.atr.toFixed(1)+' ATR</small>':''),s.yourStop.px,s.yourStop.pct,s.yourStop.held,s.yourStop.lossUsd,true);
      (s.ladder||[]).forEach(function(l){o+=rowS(l.atr+' ATR',l.px,l.pct,l.held,l.lossUsd,false);});
      o+='</div>';
      if(s.firstHeldAtr!=null)o+='<div class="jrw-note">'+MT('whyFirstHeld','The tightest of these that survived the whole trade:')+' <b>'+s.firstHeldAtr+' ATR</b>'+((s.yourStop&&s.yourStop.held===false&&s.yourStop.atr!=null&&s.yourStop.atr<s.firstHeldAtr)?' - '+MT('whyYoursTight','yours was inside the range the market moved.'):'')+'</div>';
      else if(s.ladder&&s.ladder.length)o+='<div class="jrw-note">'+MT('whyNoneHeld','Even a 2 ATR stop would have been hit - the move against you was bigger than the usual range.')+'</div>';}
    if(d.liq){if(d.liq.none==='older_than_feed')o+='<div class="jrw-sec">'+MT('whyLiqs','Liquidated while you were in')+'</div><div class="jrw-note">'+MT('whyLiqOld','The liquidation feed keeps 14 days - this trade is older.')+'</div>';
      else if(!d.liq.none){o+='<div class="jrw-sec">'+MT('whyLiqs','Liquidated while you were in')+'</div><div class="jrw-liq"><span class="l">'+MT('whyLongs','longs')+' <b>'+money(d.liq.longUsd)+'</b></span><span class="s">'+MT('whyShorts','shorts')+' <b>'+money(d.liq.shortUsd)+'</b></span><span class="n">'+d.liq.n+' '+MT('whyPrints','prints over $1K')+(d.liq.biggest?' · '+MT('whyBiggest','biggest')+' '+money(d.liq.biggest.usd)+' '+(d.liq.biggest.side==='long'?MT('whyLong','long'):MT('whyShort','short'))+(d.liq.biggest.exchange?' @ '+esc(d.liq.biggest.exchange):''):'')+(d.liq.complete===false?' · '+MT('whyPartial','the oldest part of the window is cut by the feed cap'):'')+'</span></div>';}}
    if(d.catalysts){o+='<div class="jrw-sec">'+MT('whyMoved','What moved it')+'</div>';
      if(d.catalysts.items&&d.catalysts.items.length){o+='<div class="jrw-cx">';d.catalysts.items.forEach(function(c){var a=!!c.url;o+='<'+(a?'a href="'+esc(c.url)+'" target="_blank" rel="noopener noreferrer"':'div')+' class="jrw-c"><span class="t">'+_wt(c.ts)+'</span><span class="k">'+esc(c.kind||'')+(c.named?'':' · '+MT('whyMarket','market-wide'))+'</span><span class="h">'+esc(c.title)+'</span></'+(a?'a':'div')+'>';});o+='</div>';}
      else o+='<div class="jrw-note">'+MT('whyNoCxA','No catalyst named')+' '+esc(t.sym||'')+' '+MT('whyNoCxB','in the two hours before or during the trade - the move was the market on its own.')+'</div>';}
    o+=(d.lesson&&d.lesson.id)?'<a class="jrw-lesson" href="/academy/?lesson='+esc(d.lesson.id)+'"><span>'+MT('whyLessonA','One lesson for this')+'</span><b>'+esc(d.lesson.t)+'</b></a>':'<div class="jrw-lesson" hidden></div>'; /* feature #13: the autopsy ends in one Academy lesson */
    o+='<div class="jrw-foot">'+(d.source==='server'?MT('whySrvRec','From the server record of this trade.'):MT('whyDevRec','From the record on this device.'))+(d.interval?' · '+d.interval+'m '+MT('whyCandles','candles'):'')+(d.covered===false?' · '+MT('whyPartialBars','the candles do not reach back to the open'):'')+'</div>';
    return o;}
  function jrWhy(e){
    var old=document.getElementById('jrWhy');if(old)old.remove();var ob=document.getElementById('jrWhyBd');if(ob)ob.remove();
    var long=e.side!=='short',win=(+e.pnl)>=0;
    var bd=document.createElement('div');bd.id='jrWhyBd';bd.className='jrw-bd';
    var sh=document.createElement('div');sh.id='jrWhy';sh.className='jrw';sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');sh.setAttribute('aria-label',MT('whyTitle','Why this trade went the way it did'));
    sh.innerHTML='<div class="jrw-h"><div class="jrw-t"><b>'+esc(e.sym||'-')+'</b><i class="'+(long?'long':'short')+'">'+(long?'LONG':'SHORT')+' '+(e.lev||1)+'x</i><span class="'+(win?'win':'loss')+'">'+(e.liquidated?MT('whyLiq','Liquidated'):(win?MT('whyWin','Win'):MT('whyLoss','Loss')))+(e.pnl!=null?' '+_wu(+e.pnl):'')+'</span></div><button type="button" class="jrw-x" aria-label="'+MT('whyClose','Close')+'">'+_JRWX+'</button></div><div class="jrw-b">'+(window.mpWaitHtml?window.mpWaitHtml(MT('whyReading','Reading the trade')):'<div class="jrw-wait">'+MT('whyReading','Reading the trade')+'</div>')+'</div>';
    document.body.appendChild(bd);document.body.appendChild(sh);
    function close(){sh.remove();bd.remove();document.removeEventListener('keydown',onKey);}
    function onKey(ev){if(ev.key==='Escape')close();}
    bd.addEventListener('click',close);sh.querySelector('.jrw-x').addEventListener('click',close);document.addEventListener('keydown',onKey);
    var ex=(e.exit!=null?+e.exit:(win?(+e.tp||0):(+e.stop||0)));
    var q='/api/trade/autopsy?id='+encodeURIComponent(e.id)+'&sym='+encodeURIComponent(String(e.sym||'').toUpperCase())+'&side='+(long?'long':'short')+'&entry='+(+e.entry||0)+'&exit='+(ex>0?ex:0)+'&lev='+(+e.lev||1)+'&margin='+(+e.margin||0)+'&ts='+(+e.ts||0)+'&cts='+(+e.closeTs||Date.now())+(e.stop>0?'&stop='+(+e.stop):'')+(e.pnl!=null?'&pnl='+(+e.pnl):'')+(e.liquidated?'&liq=1':'');
    window.__mpJrWhyLast={id:e.id,q:q};
    fetch(q,{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){var b=document.getElementById('jrWhy');if(!b)return;b.querySelector('.jrw-b').innerHTML=(d&&d.ok)?jrWhyBody(d):'<div class="jrw-wait">'+MT('whyNoRead','Could not read this trade right now.')+(d&&d.error?' ('+esc(d.error)+')':'')+'</div>';window.__mpJrWhyData=d;}).catch(function(){var b=document.getElementById('jrWhy');if(b)b.querySelector('.jrw-b').innerHTML='<div class="jrw-wait">'+MT('whyNoRead','Could not read this trade right now.')+'</div>';});
  }
  window.__mpJrWhy=jrWhy;
`;
const CSS = `/* My Trades - the trade autopsy sheet, "Why" (2026-11-12, feature #1; build/fix-trade-autopsy.js writes this into home.css AND mp-trade.css) */
.jrw-bd{position:fixed;inset:0;z-index:2147483645;background:rgba(5,7,10,.62)}
.jrw{position:fixed;z-index:2147483646;left:50%;top:50%;transform:translate(-50%,-50%);width:min(580px,calc(100vw - 24px));max-height:min(86vh,780px);overflow:auto;background:#0f1216;border:1px solid #2a313c;border-radius:16px;padding:14px 14px 16px;color:#dfe4ec;font-family:'Familjen Grotesk',sans-serif;box-shadow:0 24px 70px rgba(0,0,0,.6);box-sizing:border-box}
@media(max-width:620px){.jrw{left:0;right:0;top:auto;bottom:0;transform:none;width:auto;max-height:88vh;border-radius:16px 16px 0 0;padding-bottom:calc(16px + env(safe-area-inset-bottom))}}
.jrw-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.jrw-t{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}.jrw-t b{font:800 18px/1 'Bricolage Grotesque',sans-serif;color:#fff}.jrw-t i{font:700 10px/1 'Familjen Grotesk',sans-serif;letter-spacing:.04em;padding:4px 6px;border-radius:5px;font-style:normal}.jrw-t i.long{color:#34d99a;background:rgba(52,217,154,.14)}.jrw-t i.short{color:#ff7b72;background:rgba(255,123,114,.14)}.jrw-t span{font:700 13px/1 'Space Mono',monospace}.jrw-t span.win{color:#34d99a}.jrw-t span.loss{color:#ff7b72}
.jrw-x{width:30px;height:30px;border-radius:8px;border:1px solid #2a313c;background:rgba(255,255,255,.04);color:#aab4be;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:0 0 auto;padding:0}.jrw-x svg{width:14px;height:14px}
.jrw-wait{padding:26px 10px;text-align:center;color:#8a95a3;font-size:13px}
.jrw-svg{display:block;width:100%;height:130px;border:1px solid #1f262f;border-radius:10px;background:#0a0c0f}.jrw-svg .win{fill:rgba(194,246,74,.07)}.jrw-svg .px{fill:none;stroke:#c2f64a;stroke-width:1.6;vector-effect:non-scaling-stroke}.jrw-svg .en{stroke:#8a95a3;stroke-width:1;stroke-dasharray:3 3;vector-effect:non-scaling-stroke}.jrw-svg .st{stroke:#ff7b72;stroke-width:1;stroke-dasharray:4 3;vector-effect:non-scaling-stroke}.jrw-svg .in{fill:#fff}.jrw-svg .out{fill:#c2f64a;stroke:#0a0c0f;stroke-width:1.5}.jrw-svg .best{fill:#34d99a}.jrw-svg .worst{fill:#ff7b72}
.jrw-leg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:10.5px;color:#8a95a3;padding:6px 2px 10px}.jrw-leg i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle}.jrw-leg i.in{background:#fff}.jrw-leg i.out{background:#c2f64a}.jrw-leg i.best{background:#34d99a}.jrw-leg i.worst{background:#ff7b72}.jrw-leg i.st{background:#ff7b72;border-radius:1px;height:2px}
.jrw-tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}.jrw-tl{background:#131821;border:1px solid #2a313c;border-radius:12px;padding:11px 12px;min-width:0}.jrw-tl .v{font:800 17px/1.15 'Bricolage Grotesque',sans-serif;color:#fff;font-variant-numeric:tabular-nums;word-break:break-word}.jrw-tl .v small{font:600 11px/1 'Space Mono',monospace;color:#aab4be;margin-left:4px}.jrw-tl .l{font-size:11px;color:#8a95a3;margin-top:5px;line-height:1.35}
.jrw-sec{font:700 10.5px/1 'Familjen Grotesk',sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#8a95a3;margin:12px 0 7px}.jrw-sec small{text-transform:none;letter-spacing:0;font-weight:500;color:#5b6470;margin-left:6px}
.jrw-rows{display:flex;flex-direction:column;gap:5px}.jrw-row{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.4fr) minmax(0,.7fr) minmax(0,.9fr);gap:8px;align-items:center;font:12px/1.3 'Space Mono',monospace;padding:8px 10px;border:1px solid #1f262f;border-radius:9px;background:#0a0c0f;font-variant-numeric:tabular-nums}.jrw-row.mine{border-color:rgba(194,246,74,.35)}.jrw-row .a{font-family:'Familjen Grotesk',sans-serif;font-weight:700;color:#fff}.jrw-row .a small,.jrw-row .b small{color:#8a95a3;font-weight:400}.jrw-row .c{font-weight:700;text-align:center}.jrw-row .c.ok{color:#34d99a}.jrw-row .c.no{color:#ff7b72}.jrw-row .d{text-align:right;color:#ff7b72}
.jrw-note{font-size:12px;color:#aab4be;line-height:1.45;padding:8px 10px;border-left:2px solid #2a313c;margin:8px 0 2px}.jrw-note b{color:#c2f64a}
.jrw-liq{display:flex;flex-wrap:wrap;gap:6px 14px;font:12px/1.4 'Space Mono',monospace;color:#aab4be;padding:8px 10px;border:1px solid #1f262f;border-radius:9px;background:#0a0c0f}.jrw-liq .l b{color:#ff7b72}.jrw-liq .s b{color:#34d99a}.jrw-liq .n{flex-basis:100%;font-family:'Familjen Grotesk',sans-serif;font-size:11px;color:#8a95a3}
.jrw-cx{display:flex;flex-direction:column;gap:5px}.jrw-c{display:grid;grid-template-columns:auto auto 1fr;gap:4px 10px;align-items:baseline;padding:8px 10px;border:1px solid #1f262f;border-radius:9px;background:#0a0c0f;color:#dfe4ec;text-decoration:none;font-size:12px;line-height:1.35}.jrw-c .t{font:11px/1 'Space Mono',monospace;color:#8a95a3}.jrw-c .k{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#c2f64a}.jrw-c .h{grid-column:1/-1}a.jrw-c:hover{border-color:#3a4350}
.jrw-foot{font-size:11px;color:#5b6470;margin-top:12px;line-height:1.45}
a.jrw-lesson{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding:10px 12px;border:1px solid rgba(194,246,74,.35);border-radius:10px;background:rgba(194,246,74,.06);color:#dfe4ec;text-decoration:none;font-size:12.5px}a.jrw-lesson span{color:#c2f64a;font-weight:700;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;flex:0 0 auto}a.jrw-lesson b{font-weight:600;color:#fff;text-align:right}a.jrw-lesson:hover{border-color:#c2f64a}
.pp-btns button.wy{color:#c2f64a;border-color:rgba(194,246,74,.3)}
@media(max-width:480px){.jrw-row{grid-template-columns:minmax(0,1.2fr) minmax(0,1.3fr) minmax(0,.7fr) minmax(0,.9fr);font-size:11px;padding:7px 8px}.jrw-tl .v{font-size:15px}}
`;
if (BLOCK.indexOf('${') >= 0 || /\\'/.test(BLOCK)) throw new Error('the block must carry no template holes and no escaped apostrophes (a template literal eats the backslash)');
function once(s, a, b, what, file) { const n = s.split(a).length - 1; if (n !== 1) throw new Error(file + ': anchor "' + what + '" found ' + n + ' times (need exactly 1)'); return s.split(a).join(b); }
let changed = 0;
for (const f of ['dist/assets/home.js', 'dist/assets/mp-trade.js']) {
  const p = path.join(ROOT, f); let s = fs.readFileSync(p, 'utf8');
  const has = s.indexOf(MARK) >= 0, hasBtn = s.indexOf('data-act="why"') >= 0;
  if (has && hasBtn) { console.log(f + ': already applied'); continue; }
  if (has !== hasBtn) throw new Error(f + ': half-applied (block ' + has + ', button ' + hasBtn + ') - restore the file first');
  s = once(s, `MT('jPaperTrade','Paper Trade')+'</button></div>'`, `MT('jPaperTrade','Paper Trade')+'</button><button class="wy" data-act="why" data-id="'+e.id+'">'+MT('jWhy','Why')+'</button></div>'`, 'closed ticket buttons', f);
  s = once(s, `    if(act==='share'){shareTicket(e);return;}\n`, `    if(act==='share'){shareTicket(e);return;}\n    if(act==='why'){jrWhy(e);return;}\n`, 'delegate', f);
  s = once(s, `\n  /* @JRRISK`, `\n` + BLOCK + `  /* @JRRISK`, 'risk block', f);
  if (!DRY) { fs.writeFileSync(p + '.tmp', s); fs.renameSync(p + '.tmp', p); }
  console.log(f + ': ' + (DRY ? 'would patch' : 'patched')); changed++;
}
for (const f of ['dist/assets/home.css', 'dist/assets/mp-trade.css']) {
  const p = path.join(ROOT, f); let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf('.jrw-bd{') >= 0) { console.log(f + ': css already present'); continue; }
  const a = '/* My Trades - the Risk tab (2026-11-12'; const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(f + ': risk css anchor found ' + n + ' times');
  s = s.split(a).join(CSS + a);
  if (!DRY) { fs.writeFileSync(p + '.tmp', s); fs.renameSync(p + '.tmp', p); }
  console.log(f + ': css ' + (DRY ? 'would be added' : 'added')); changed++;
}
console.log('fix-trade-autopsy: ' + changed + ' file(s)' + (DRY ? ' (dry run)' : ''));
