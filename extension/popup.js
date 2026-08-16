'use strict';
const $ = id => document.getElementById(id);
const num = id => { const v = parseFloat($(id).value); return isFinite(v) ? v : NaN; };
const fmtUSD = n => isFinite(n) ? (Math.abs(n) >= 1 ? n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})) : '—';
const fmtPct = n => isFinite(n) ? (n>=0?'+':'') + n.toFixed(2) + '%' : '—';
const fmtCoin = n => isFinite(n) ? n.toLocaleString('en-US',{maximumFractionDigits:6}) : '—';
const muted = (el,msg) => { el.textContent = msg||'—'; el.className = 'big muted'; };

// tabs
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
  t.classList.add('on');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  $(t.dataset.tab).classList.add('on');
}));

// segmented long/short
const sides = { liqSide:'long', pnlSide:'long', tpSide:'long' };
document.querySelectorAll('[data-seg]').forEach(seg => {
  seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); sides[seg.dataset.seg] = b.dataset.side; calcAll();
  }));
});

function calcLiq(){
  const entry=num('liqEntry'), lev=num('liqLev'), mmr=num('liqMmr')/100, out=$('liqOut');
  if(!isFinite(entry)||!isFinite(lev)||lev<=0||!isFinite(mmr)){ muted(out); $('liqDist').textContent='—'; return; }
  const long=sides.liqSide==='long';
  const liq=long?entry*(1-1/lev+mmr):entry*(1+1/lev-mmr);
  const dist=(liq-entry)/entry*100;
  out.textContent='$'+fmtUSD(liq); out.className='big'+(long?' neg':'');
  $('liqDist').textContent=fmtPct(dist)+'  ('+Math.abs(dist).toFixed(2)+'% '+(long?'down':'up')+')';
}
function calcSize(){
  const bal=num('szBal'), risk=num('szRisk')/100, entry=num('szEntry'), stop=num('szStop'), out=$('szOut');
  const dist=Math.abs(entry-stop);
  if(!isFinite(bal)||!isFinite(risk)||!isFinite(entry)||!isFinite(stop)||dist===0){ muted(out); $('szNotional').textContent=$('szRiskAmt').textContent='—'; return; }
  const riskAmt=bal*risk, qty=riskAmt/dist;
  out.textContent=fmtCoin(qty)+' coin'; out.className='big';
  $('szNotional').textContent='$'+fmtUSD(qty*entry);
  $('szRiskAmt').textContent='$'+fmtUSD(riskAmt);
}
function calcPnl(){
  const entry=num('pnlEntry'), exit=num('pnlExit'), qty=num('pnlQty'), lev=num('pnlLev'), out=$('pnlOut');
  if(!isFinite(entry)||!isFinite(exit)||!isFinite(qty)){ muted(out); $('pnlRoi').textContent=$('pnlRoe').textContent='—'; return; }
  const long=sides.pnlSide==='long';
  const pnl=(long?(exit-entry):(entry-exit))*qty, roi=(long?(exit-entry):(entry-exit))/entry*100;
  out.textContent=(pnl>=0?'+$':'−$')+fmtUSD(Math.abs(pnl)); out.className='big'+(pnl<0?' neg':'');
  $('pnlRoi').textContent=fmtPct(roi);
  $('pnlRoe').textContent=(isFinite(lev)&&lev>0)?fmtPct(roi*lev):'—';
}
function calcDca(){
  const out=$('dcaOut'); let cost=0, qty=0;
  for(let i=1;i<=3;i++){ const p=num('dcaP'+i), q=num('dcaQ'+i); if(isFinite(p)&&isFinite(q)&&p>0&&q>0){ cost+=p*q; qty+=q; } }
  if(qty<=0){ muted(out); $('dcaQty').textContent=$('dcaCost').textContent='—'; return; }
  out.textContent='$'+fmtUSD(cost/qty); out.className='big';
  $('dcaQty').textContent=fmtCoin(qty)+' coin';
  $('dcaCost').textContent='$'+fmtUSD(cost);
}
function calcTp(){
  const entry=num('tpEntry'), lev=(isFinite(num('tpLev'))&&num('tpLev')>0)?num('tpLev'):1, roe=num('tpCustom'), out=$('tpOut');
  const long=sides.tpSide==='long';
  if(!isFinite(entry)||entry<=0||!isFinite(roe)){ muted(out); $('tpMove').textContent='—'; return; }
  const px=long?entry*(1+roe/100/lev):entry*(1-roe/100/lev);
  out.textContent='$'+fmtUSD(px); out.className='big';
  $('tpMove').textContent=(long?'+':'−')+Math.abs(roe/lev).toFixed(2)+'% price';
}
function syncResColors(){ document.querySelectorAll('.res').forEach(r => { const b = r.querySelector('.big'); r.classList.toggle('neg', !!(b && b.classList.contains('neg'))); }); }
function calcAll(){ calcLiq(); calcSize(); calcPnl(); calcDca(); calcTp(); syncResColors(); }
document.querySelectorAll('input[type=number]').forEach(i => i.addEventListener('input', calcAll));
calcAll();
