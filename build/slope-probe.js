/* Is the projected slope realistic? Compare the path's %/candle against what this market actually does. */
const { withBrowser } = require('./e2e-browser');
const LV={idx:2,k:'silver',name:'Silver',col:'#b7c2d0',min:3000,xp:4100,next:'Gold',nextMin:12000,toNext:7900,pct:12,stars:0};
const CASES=[['SOL','5',2.2],['SOL','5',0.5],['BTC','60',2.0],['ETH','240',3.0],['XRP','15',1.0]];
(async()=>{await withBrowser(async(browser)=>{
 const ctx=await browser.createBrowserContext(),page=await ctx.newPage();
 await page.setCacheEnabled(false);await page.setBypassServiceWorker(true);await page.setViewport({width:1400,height:900});
 await page.setCookie({name:'mp_li',value:'1',domain:'marginpad.io',path:'/'});
 await page.setRequestInterception(true);
 page.on('request',r=>{const u=r.url();
  if(u.includes('/api/auth/me'))return r.respond({status:200,contentType:'application/json',body:JSON.stringify({user:{id:'e2e',username:'p',xp:4100,level:LV,premium:true}})});
  if(u.includes('/api/premium/status')||u.includes('/api/ind/access'))return r.respond({status:200,contentType:'application/json',body:JSON.stringify({allowed:true,premium:true,signedIn:true})});
  return r.continue();});
 await page.goto('https://marginpad.io/charts?cb='+Date.now(),{waitUntil:'networkidle2',timeout:90000});
 await page.evaluate(()=>{if(!(window.__mpWinsDbg&&window.__mpWinsDbg.length))document.getElementById('cwsAdd').click();});
 await page.waitForFunction('window.__mpWinsDbg&&window.__mpWinsDbg[0]&&window.__mpWinsDbg[0].bars&&window.__mpWinsDbg[0].bars.length>50&&window.__mpWinsDbg[0].dr',{timeout:40000}).catch(()=>{});
 console.log('  case            target   horizon   what the path covers vs what this market typically covers in that time');
 for(const [sym,tf,pct] of CASES){
   await page.evaluate((sym,tf)=>{const w=window.__mpWinsDbg[0],si=w.el.querySelector('.cwin-sym');
     if(w.sym!==sym){si.value=sym;si.dispatchEvent(new Event('change',{bubbles:true}));}
     const tb=w.el.querySelector('.cwin-tf button[data-tf="'+tf+'"]');if(tb&&w.tf!==tf)tb.click();},sym,tf);
   await page.waitForFunction(`window.__mpWinsDbg[0].sym==='${sym}'&&window.__mpWinsDbg[0].tf==='${tf}'&&window.__mpWinsDbg[0].bars.length>60`,{timeout:30000}).catch(()=>{});
   // the bar array is replaced asynchronously after a symbol/timeframe switch - wait until it stops changing, or the rhythm is measured across two different markets
   await page.waitForFunction(()=>{const w=window.__mpWinsDbg[0];const k=w.bars.length+':'+w.bars[0].time+':'+w.bars[w.bars.length-1].time;
     if(window.__lastKey===k){return true;}window.__lastKey=k;return false;},{polling:700,timeout:30000}).catch(()=>{});
   await new Promise(r=>setTimeout(r,600));
   const o=await page.evaluate((pct)=>{const w=window.__mpWinsDbg[0],n=w.bars.length,px=+w.bars[n-1].close;
     window.__mpAi.clearAi(w);
     window.__mpAi.draw(w,[{a:'draw',shape:'arrow',p2:px*(1+pct/100),barsAgo2:-12,color:'#2ebd85'}],9);
     const pa=w.dr.shapes.filter(s=>s.t==='path')[0];if(!pa)return null;
     const H=pa.pts[pa.pts.length-1].l-pa.pts[0].l;
     const pathPer=((pa.pts[pa.pts.length-1].p-pa.pts[0].p)/px*100)/H;
     // the honest yardstick: what this market TYPICALLY travels over the same number of candles (median absolute move over H bars)
     const d=[];for(let i=H;i<n;i++){const a2=+w.bars[i].close,b2=+w.bars[i-H].close;if(a2>0&&b2>0)d.push(Math.abs(a2-b2)/px*100);}
     d.sort((x,y)=>x-y);const typ=d.length?d[Math.floor(d.length*0.55)]:0;
     return {H:Math.round(H),moved:+((pa.pts[pa.pts.length-1].p-pa.pts[0].p)/px*100).toFixed(3),typ:+typ.toFixed(3)};},pct);
   if(!o){console.log('  '+sym+' '+tf+'m  no path');continue;}
   console.log('  '+(sym+' '+tf+'m').padEnd(14)+(' +'+pct+'%').padEnd(9)+String(o.H).padStart(4)+' bars   path moves '+String(o.moved).padStart(6)+'%   market typically '+String(o.typ).padStart(6)+'%   '+(o.typ?(o.moved/o.typ).toFixed(2)+'x':'?'));
 }
 await ctx.close();});})();
