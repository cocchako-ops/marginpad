/* THE EARLY HALF ON THE CHART (2026-11-05): a catalyst that LANDED on this coin is drawn on the candle it was seen on BEFORE any
 * move exists (a lime "NEW" pill with the kind and the exchange, the outcome written onto it an hour later), a scheduled print
 * is drawn AHEAD at the right edge with the minutes left, and the legend says both in one line each. The data is
 * /api/catalysts/early (polled every 60 s while the indicator is on, through the same 20-s watch the live flag uses). The
 * painter lives in the shared draw layer, so the phone gets it through the same functions mp-mcharts already calls.
 * Idempotent (marker), --dry prints only, split/join only. Both bundles are LF files edited in place (never git checkout them). */
const fs = require('fs');
const path = require('path');
const DRY = process.argv.includes('--dry');
const A = path.join(__dirname, '..', 'dist', 'assets');
const MARK = '/* @CX_EARLY_CHART 2026-11-05 */';
function patch(file, edits) {
  let s = fs.readFileSync(file, 'utf8');
  if (s.indexOf(MARK) >= 0) { console.log(path.basename(file) + ': already applied'); return; }
  for (const [from, to] of edits) {
    const i = s.indexOf(from); if (i < 0) throw new Error(path.basename(file) + ': anchor missing: ' + from.slice(0, 80));
    if (s.indexOf(from, i + 1) >= 0) throw new Error(path.basename(file) + ': anchor not unique: ' + from.slice(0, 80));
    s = s.split(from).join(to);
  }
  if (DRY) { console.log('DRY ' + path.basename(file) + ': ' + s.length + ' bytes'); return; }
  fs.writeFileSync(file + '.tmp', s); fs.renameSync(file + '.tmp', file);
  console.log(path.basename(file) + ': written');
}

const FN = `  ${MARK}
  /* THE EARLY HALF: what LANDED on this coin (a listing, a delisting, a major story - drawn before any move), what is AHEAD (a scheduled
     print inside 35 min) and what the server saw MOVING, from /api/catalysts/early; an hour later each record carries its outcome */
  function loadCxEarly(w,force){if(!w||w.dead||!w.sym||w._cxeFetch)return;if(!force&&w._cxe&&w._cxeSym===w.sym&&Date.now()-(w._cxeT||0)<60000)return;w._cxeFetch=true;
    fetch('/api/catalysts/early?symbol='+encodeURIComponent(w.sym)+'&h=24').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){w._cxeFetch=false;if(!w||w.dead)return;var was=w._cxe?w._cxe.n:-1;w._cxe=j||null;w._cxeSym=w.sym;w._cxeT=Date.now();if(j&&j.n!==was){try{(w._reapply||function(){applyInds(w);})();}catch(e){}}});}
  function cxEarlyMarks(bars,cxe,sym){var out=[];if(!cxe||!cxe.items||!bars||!bars.length)return out;var now=Date.now();
    cxe.items.forEach(function(r){if(r.type==='moving')return;/* a running move is the live flag's */
      if(r.type==='ahead'){if(+r.ts>now-30*60000&&now-(+r.at||0)<3*3600000)out.push({ahead:true,r:r});return;}
      if((r.syms||[]).indexOf(sym)<0&&r.sym!==sym)return;var i=barAtTs(bars,+r.seen);if(i<0)return;out.push({i:i,r:r});});
    return out;}
  function cxEarlySrc(r){return String(r.source||'').replace(/^(rss|tg|x):/,'').replace(/-ann$/,'');}
  function cxEarlyKind(r){return r.kind==='listing'?__esT_mpcharts("listingWord",'listing'):r.kind==='delisting'?__esT_mpcharts("delistingWord",'delisting'):r.why==='major'?__esT_mpcharts("majorStory",'major story'):String(r.kind||'catalyst');}
  function cxEarlyOut(r){var s=r.settled;if(!s||s.x60==null)return '';return (s.r60>=0?'+':'')+s.r60.toFixed(2)+'% '+__esT_mpcharts("afterWord",'after')+(s.big?'':' · '+__esT_mpcharts("noReaction",'no reaction'));}
  function cxEarlyAgo(ms){var m=Math.max(0,Math.round((Date.now()-ms)/60000));return m>=120?Math.round(m/6)/10+' h':m+' min';}
  /* one legend line per record (newest two), and the marks the painter draws */
  function cxEarlyLegend(w,bars,legItems){var li=legItems||w.legItems;if(!li)return;var mk=cxEarlyMarks(bars,w._cxe,w.sym);w._cxeMarks=mk.length?mk:null;
    mk.slice(0,2).forEach(function(k){var r=k.r,a=w._cxe&&w._cxe.accuracy&&w._cxe.accuracy[r.cell];
      var acc=a&&a.n>=5?' · '+__esT_mpcharts("ourRecord",'our record')+' '+a.n+': '+(a.bigPct!=null?a.bigPct+'% '+__esT_mpcharts("movedWord",'moved'):'')+(a.hitPct!=null?', '+a.hitPct+'% '+__esT_mpcharts("rightWord",'right'):''):'';
      if(k.ahead){li.push({raw:true,color:'#c2f64a',label:__esT_mpcharts("aheadWord",'AHEAD')+' · '+r.title+' '+__esT_mpcharts("inWord",'in')+' '+Math.max(0,Math.round((+r.ts-Date.now())/60000))+' min'+(r.exp&&r.exp.n>=12?' · '+r.exp.x15+'x '+__esT_mpcharts("usualBar",'usual bar'):''),title:r.text||''});return;}
      var out=cxEarlyOut(r);
      li.push({raw:true,color:'#c2f64a',label:__esT_mpcharts("landedWord",'LANDED')+' '+cxEarlyAgo(+r.seen)+' · '+cxEarlyKind(r)+' '+__esT_mpcharts("onWord",'on')+' '+cxEarlySrc(r)+(out?' · '+out:(r.exp&&r.exp.n>=12?' · '+(r.exp.x60!=null?r.exp.x60+'x '+__esT_mpcharts("usualHour",'usual hour'):r.exp.x15+'x '+__esT_mpcharts("usualBar",'usual bar'))+(r.exp.hit!=null?', '+Math.round(100*r.exp.hit)+'% '+__esT_mpcharts("rightWord",'right'):''):' · '+__esT_mpcharts("noRecordYet",'no record yet')))+acc,title:r.text||''});});}
  function cxEarlyCardOpen(w,r,px,py){liqCardClose(w);
    var body=w.el&&(w.el.querySelector('.cwin-body')||w.el.querySelector('.mfc-chart')||w.el);if(!body)return;
    try{if(getComputedStyle(body).position==='static')body.style.position='relative';}catch(e){}
    var esc=function(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');},hh=function(n){return (n<10?'0':'')+n;};
    var a=w._cxe&&w._cxe.accuracy&&w._cxe.accuracy[r.cell],s=r.settled,d=new Date(r.type==='ahead'?+r.ts:+r.seen);
    var head=r.type==='ahead'?__esT_mpcharts("aheadWord",'AHEAD')+' · '+esc(r.title):__esT_mpcharts("landedWord",'LANDED')+' · '+esc(cxEarlyKind(r))+' '+__esT_mpcharts("onWord",'on')+' '+esc(cxEarlySrc(r));
    var el=document.createElement('div');el.className='cwin-liqc cwin-cxc';
    el.innerHTML='<button class="cwin-liqc-x" type="button" aria-label="Close">'+((typeof RP_IC!=='undefined'&&RP_IC&&RP_IC.x)?RP_IC.x:'&#10005;')+'</button>'
      +'<div class="lqc-h" style="color:#c2f64a">'+head+'</div>'
      +(r.type!=='ahead'?'<div class="cxc-cat"><b>'+esc(r.title)+'</b><span>'+esc(cxEarlySrc(r))+' · '+esc(r.kind)+(r.desks>1?' · '+r.desks+' '+__esT_mpcharts("desksWord",'desks'):'')+' · '+__esT_mpcharts("scoreWord",'score')+' '+(r.score||0)+(r.imp!=null?' · '+__esT_mpcharts("importanceWord",'importance')+' '+r.imp:'')+'</span>'+(r.url?'<a href="'+esc(r.url)+'" target="_blank" rel="noopener">'+__esT_mpcharts("openSource",'open the source')+'</a>':'')+(r.sum?'<em class="cxc-real">'+esc(r.sum)+'</em>':'')+'</div>':'')
      +'<p class="cxc-note">'+esc(r.text||'')+'</p>'
      +'<dl class="lqc-d"><dt>'+(r.type==='ahead'?__esT_mpcharts("printsAt",'Prints at'):__esT_mpcharts("seenAt",'Seen at'))+'</dt><dd>'+hh(d.getHours())+':'+hh(d.getMinutes())+' · '+d.toLocaleDateString(undefined,{day:'numeric',month:'short'})+(r.p0?' · '+cwFmt(r.p0):'')+'</dd>'
      +(s&&s.x60!=null?'<dt>'+__esT_mpcharts("whatHappened",'What happened')+'</dt><dd>'+(s.r15!=null?(s.r15>=0?'+':'')+s.r15.toFixed(2)+'% / 15 min · ':'')+(s.r60>=0?'+':'')+s.r60.toFixed(2)+'% / 60 min · '+__esT_mpcharts("rangeWord",'range')+' +'+s.up.toFixed(2)+'% / '+s.dn.toFixed(2)+'% · '+s.x60+'x '+__esT_mpcharts("usualHour",'usual hour')+(s.hit!=null?' · '+(s.hit?__esT_mpcharts("directionRight",'direction right'):__esT_mpcharts("directionWrong",'direction wrong')):'')+'</dd>':'<dt>'+__esT_mpcharts("outcomeWord",'Outcome')+'</dt><dd>'+__esT_mpcharts("settlesInAnHour",'settles an hour after, against 1-minute candles')+'</dd>')
      +(a&&a.n?'<dt>'+__esT_mpcharts("ourRecordCap",'Our record')+'</dt><dd>'+a.n+' '+__esT_mpcharts("settledWord",'settled')+' · '+(a.bigPct!=null?a.bigPct+'% '+__esT_mpcharts("movedWord",'moved'):'-')+(a.hitPct!=null?' · '+a.hitPct+'% '+__esT_mpcharts("directionRightLc",'direction right')+' ('+a.nDir+')':'')+(a.muted?' · <b style="color:#ff6258">'+__esT_mpcharts("mutedWord",'muted')+'</b>':'')+'</dd>':'')
      +'</dl>'
      +'<p class="lqc-n">'+__esT_mpcharts("cxEarlyMethod",'An early mark is a first report that passed a measured gate (an exchange listing or delisting, a major story), drawn the minute it landed and before any move. The record under it is what events of that kind really did, never a forecast. A kind that keeps missing mutes itself.')+'</p>';
    body.appendChild(el);
    var bw=body.clientWidth||300,bh=body.clientHeight||200,cw=el.offsetWidth||220,ch=el.offsetHeight||170;
    el.style.left=Math.max(6,Math.min(px-cw/2,bw-cw-6))+'px';el.style.top=Math.max(6,Math.min(py+18,bh-ch-6))+'px';
    el.querySelector('.cwin-liqc-x').addEventListener('click',function(e){e.stopPropagation();liqCardClose(w);});}
`;

const PAINT = `    /* the early marks: a lime NEW pill on the candle a catalyst was seen on (its outcome on it once settled), an AHEAD pill at the right edge */
    function drawCxEarly(){var mk=w._cxeMarks;w._cxeHit=[];if(!mk||!mk.length||!(w.inds&&w.inds.catalyst))return;
      var H=w.dr.H||0,th=0;try{th=w.chart.timeScale().height()||0;}catch(e){}var plotH=Math.max(0,H-th),W=w.dr.W||0,lastI=(w.bars||[]).length-1,row=0;
      for(var i=0;i<mk.length;i++){var k=mk[i],r=k.r,txt,x;
        if(k.ahead){x=xOf(lastI);if(x==null)continue;x=Math.min(W-6,x+26);txt=String(r.title||'').slice(0,22)+' '+__esT_mpcharts("inWord",'in')+' '+Math.max(0,Math.round((+r.ts-Date.now())/60000))+'m';}
        else{x=xOf(k.i);if(x==null||x<-10||x>W+10)continue;var out=cxEarlyOut(r);txt=__esT_mpcharts("newWord",'NEW')+' \\u00b7 '+cxEarlyKind(r)+(out?' \\u00b7 '+out.replace(/ \\u00b7 .*$/,''):'');}
        ctx.save();ctx.font='800 10.5px "Space Mono",monospace';var tw=ctx.measureText(txt).width,bw=tw+14,bh=18,bx=Math.max(2,Math.min(W-bw-2,x-bw/2)),by=30+row*22;row=(row+1)%3;
        if(!k.ahead){var yH=null;try{yH=yOf(+w.bars[k.i].high);}catch(e){}if(yH!=null){ctx.setLineDash([3,3]);ctx.strokeStyle='rgba(194,246,74,.7)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,by+bh);ctx.lineTo(x,Math.max(by+bh,Math.min(plotH,yH)));ctx.stroke();ctx.setLineDash([]);}}
        ctx.beginPath();if(ctx.roundRect)ctx.roundRect(bx,by,bw,bh,6);else ctx.rect(bx,by,bw,bh);ctx.fillStyle='rgba(12,14,18,.95)';ctx.fill();ctx.lineWidth=1.6;ctx.strokeStyle='#c2f64a';ctx.stroke();
        ctx.fillStyle=r.settled&&r.settled.x60!=null&&!r.settled.big?'#aab5c4':'#e9edf3';ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillText(txt,bx+7,by+bh/2+.5);ctx.restore();
        w._cxeHit.push({x:bx,y:by,w:bw,h:bh,r:r});}}
`;

patch(path.join(A, 'mp-charts.js'), [
  ["  function cxCauseText(a){if(!a)return '';var c=a.catalyst;", FN + "  function cxCauseText(a){if(!a)return '';var c=a.catalyst;"],
  ["      var lv=cxLiveCheck(w);if(lv)cxLiveAsk(w,lv);else if(w._cxLive&&w._cxLive.on){", "      try{loadCxEarly(w);}catch(e){}var lv=cxLiveCheck(w);if(lv)cxLiveAsk(w,lv);else if(w._cxLive&&w._cxLive.on){"],
  ["      wireLiqClick(w);loadCx(w);cxWatch(w,true);", "      wireLiqClick(w);loadCx(w);loadCxEarly(w);cxWatch(w,true);"],
  ["    w._cxMarks=null;if(!w.inds.catalyst){w._cxHit=null;cxWatch(w,false);}", "    w._cxMarks=null;w._cxeMarks=null;if(!w.inds.catalyst){w._cxHit=null;w._cxeHit=null;cxWatch(w,false);}"],
  ["+(+_cx.floorPct||0.6)+'%.'});\n", "+(+_cx.floorPct||0.6)+'%.'});\n        try{cxEarlyLegend(w,bars);}catch(e){}\n"],
  ["try{drawCxMarks();}catch(e){}try{drawCxNote();}catch(e){}", "try{drawCxMarks();}catch(e){}try{drawCxEarly();}catch(e){}try{drawCxNote();}catch(e){}"],
  ["    function drawLiqMarks(){var mk=w._liqMarks;if(!mk||!mk.length)return;", PAINT + "    function drawLiqMarks(){var mk=w._liqMarks;if(!mk||!mk.length)return;"],
  ["      var hc=w._cxHit;if(hc&&hc.length){var x2=prm.point.x,y2=prm.point.y;", "      var he=w._cxeHit;if(he&&he.length){var x3=prm.point.x,y3=prm.point.y;for(var q3=0;q3<he.length;q3++){var r3=he[q3];if(x3>=r3.x-3&&x3<=r3.x+r3.w+3&&y3>=r3.y-3&&y3<=r3.y+r3.h+3){cxEarlyCardOpen(w,r3.r,r3.x+r3.w/2,r3.y+r3.h);return;}}}\n      var hc=w._cxHit;if(hc&&hc.length){var x2=prm.point.x,y2=prm.point.y;"],
  ["cxCardOpen:cxCardOpen,", "cxCardOpen:cxCardOpen,loadCxEarly:loadCxEarly,cxEarlyMarks:cxEarlyMarks,cxEarlyLegend:cxEarlyLegend,"],
]);
patch(path.join(A, 'mp-mcharts.js'), [
  ["    if(p.w){p.w._cxMarks=null;if(!p.inds.catalyst&&S&&S.cxWatch){", "    " + MARK + "\n    if(p.w){p.w._cxMarks=null;p.w._cxeMarks=null;if(!p.inds.catalyst&&S&&S.cxWatch){"],
  ["try{S.wireLiqClick(p.w);}catch(e){}try{S.loadCx(p.w);}catch(e){}try{S.cxWatch(p.w,true);}catch(e){}", "try{S.wireLiqClick(p.w);}catch(e){}try{S.loadCx(p.w);}catch(e){}try{if(S.loadCxEarly)S.loadCxEarly(p.w);}catch(e){}try{S.cxWatch(p.w,true);}catch(e){}"],
  ["(_cx.collector!=='ok'?' · offline':'')});\n", "(_cx.collector!=='ok'?' · offline':'')});\n        try{if(S.cxEarlyLegend)S.cxEarlyLegend(p.w,p.bars,p.legItems);}catch(e){}\n"],
]);
