/* Propagate the overnight-liquidation sweep into the language homepages' Paper Trade module.
   Idempotent: skips files that already contain sweepLiq. Run: node build/add-sweepliq.js */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const LANGS = ['es', 'pt', 'fr', 'de', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id', 'nl'];
const ANCHOR = '  tick();setInterval(tick,1000);';
const SWEEP = `
  function sweepLiq(){var d=load(),open=d.filter(function(e){return e.status==='open'&&e.sym&&e.sym!=='—'&&e.entry>0;});if(!open.length)return;
    open.forEach(function(e){if((Date.now()-e.ts)<8*60000)return;
      var lng=e.side!=='short',liq=liqOf(e),ageH=(Date.now()-e.ts)/3600000;
      var tf=ageH>72?'1440':ageH>24?'240':ageH>6?'60':ageH>2?'30':'5';
      fetch('/api/klines?symbol='+encodeURIComponent(e.sym)+'&interval='+tf).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(kd){
        if(!kd||!kd.length)return;var ivMs=parseInt(tf,10)*60000,cross=null;
        for(var i=0;i<kd.length;i++){var b=kd[i],bt=b.time*1000;if(bt+ivMs<e.ts)continue;
          if(lng?(+b.low<=liq):(+b.high>=liq)){cross=Math.max(bt,e.ts);break;}}
        if(cross==null)return;
        var d2=load(),idx=-1;for(var k=0;k<d2.length;k++){if(d2[k].id===e.id){idx=k;break;}}if(idx<0)return;var t=d2[idx];if(t.status!=='open')return;
        var dir=(t.side!=='short')?1:-1;t.status='loss';t.exit=liq;t.liquidated=true;t.pnl=(+t.margin>0)?-(+t.margin):((t.qty!=null&&isFinite(t.qty))?t.qty*(t.exit-t.entry)*dir:null);t.closeTs=cross;notified[t.id]=true;
        store(d2);renderPos();renderLast();drawLines();mtCount();if(window.mpJournalRender)window.mpJournalRender();});});}
  sweepLiq();
  document.addEventListener('visibilitychange',function(){if(!document.hidden)sweepLiq();});`;

let done = 0, skip = 0;
for (const L of LANGS) {
  const f = path.join(DIST, L, 'index.html');
  if (!fs.existsSync(f)) { console.log('missing', L); continue; }
  let h = fs.readFileSync(f, 'utf8');
  if (h.indexOf('sweepLiq') !== -1) { skip++; continue; }
  if (h.indexOf(ANCHOR) === -1) { console.log('NO ANCHOR in', L); continue; }
  h = h.replace(ANCHOR, ANCHOR + SWEEP);
  fs.writeFileSync(f, h);
  done++; console.log('patched', L);
}
console.log(`done: ${done} patched, ${skip} already had it`);
