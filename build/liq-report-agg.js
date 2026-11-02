const fs=require('fs'),zlib=require('zlib');
const days={},ex={},sym={},hours={};let tot=0,L=0,S=0,n=0;const big=[];let sides={};
for(const f of fs.readdirSync('.').filter(f=>f.endsWith('.gz')).sort()){
  const d=f.slice(0,10);const t=zlib.gunzipSync(fs.readFileSync(f)).toString().split('\n');
  days[d]={usd:0,l:0,s:0,n:0};
  for(let i=1;i<t.length;i++){const r=t[i];if(!r)continue;const c=r.split(',');const ts=+c[0],e=c[1],sy=c[2],sd=c[3],u=+c[6];if(!(u>0))continue;
    sides[sd]=(sides[sd]||0)+1;const lg=/long|sell/i.test(sd);
    n++;tot+=u;lg?L+=u:S+=u;const D=days[d];D.usd+=u;D.n++;lg?D.l+=u:D.s+=u;
    ex[e]=(ex[e]||0)+u;const s=sy.replace(/^.*:/,'').replace(/[-_]?(USDT|USDC|USD|PERP|SWAP)$/i,'').replace(/[-_].*$/,'').toUpperCase();
    sym[s]=sym[s]||{u:0,l:0,s:0,n:0};sym[s].u+=u;sym[s].n++;lg?sym[s].l+=u:sym[s].s+=u;
    const h=new Date(ts>1e12?ts:ts*1000).toISOString().slice(0,13);hours[h]=(hours[h]||0)+u;
    if(big.length<15||u>big[big.length-1].u){big.push({u,e,s,sd,ts:new Date(ts>1e12?ts:ts*1000).toISOString(),px:+c[4]});big.sort((a,b)=>b.u-a.u);if(big.length>15)big.pop();}
  }}
const out={n,tot,L,S,sides,days,ex:Object.entries(ex).sort((a,b)=>b[1]-a[1]),sym:Object.entries(sym).sort((a,b)=>b[1].u-a[1].u).slice(0,25),big,topHours:Object.entries(hours).sort((a,b)=>b[1]-a[1]).slice(0,10)};
fs.writeFileSync('oct.json',JSON.stringify(out));
console.log('rows',n,'total',(tot/1e6).toFixed(1)+'M','long',(L/1e6).toFixed(1),'short',(S/1e6).toFixed(1),'sides',JSON.stringify(sides));
console.log('ex',out.ex.map(([k,v])=>k+':'+(v/1e6).toFixed(1)).join(' '));
console.log('sym',out.sym.slice(0,12).map(([k,v])=>k+':'+(v.u/1e6).toFixed(1)).join(' '));
console.log('days',Object.entries(days).map(([k,v])=>k.slice(8)+':'+(v.usd/1e6).toFixed(0)).join(' '));
console.log('big',out.big.slice(0,6).map(b=>b.s+' '+b.e+' '+b.sd+' '+(b.u/1e6).toFixed(2)+'M '+b.ts).join(' | '));
console.log('hours',out.topHours.slice(0,5).map(([h,v])=>h+':'+(v/1e6).toFixed(0)).join(' '));
