  const $ = id => document.getElementById(id);
  const num = id => { const v = parseFloat($(id).value); return isFinite(v) ? v : NaN; };
  const fmtUSD = n => isFinite(n) ? (Math.abs(n) >= 1 ? n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6})) : '—';
  const fmtPct = n => isFinite(n) ? (n>=0?'+':'') + n.toFixed(2) + '%' : '—';
  const fmtCoin = n => isFinite(n) ? n.toLocaleString('en-US',{maximumFractionDigits:6}) : '—';

  function animateNum(el, to, fmt){
    if(!isFinite(to)){ el._cur = NaN; cancelAnimationFrame(el._raf); el.textContent = '—'; return; }
    const from = (typeof el._cur === 'number' && isFinite(el._cur)) ? el._cur : to;
    cancelAnimationFrame(el._raf);
    const start = performance.now(), dur = 380;
    const tick = now => {
      const t = Math.min(1, (now-start)/dur), e = 1 - Math.pow(1-t,3), v = from + (to-from)*e;
      el.textContent = fmt(v);
      if(t<1){ el._raf = requestAnimationFrame(tick); } else { el._cur = to; el.textContent = fmt(to); }
    };
    el._raf = requestAnimationFrame(tick);
  }
  const muted = el => { el.textContent='—'; el.className='rvalue muted'; el._cur=NaN; };

  // exchange comparison menu — single source of truth (max leverage = "up to", varies by market/region)
  const EXLIST = [
    { name:'Bybit',   href:'https://www.bybit.com/invite?ref=LZKBERJ',                                                              accent:'#f7a600', fg:'#0a0b0d', letter:'B', lev:'100×', tag:'Deep liquidity, fast matching engine', bonus:'Up to 30,000 USDT deposit bonus + 20% off fees' },
    { name:'Binance', href:'https://www.binance.com/register?ref=MAOZM9DS',                                                          accent:'#f0b90b', fg:'#181a20', letter:'B', lev:'125×', tag:'Largest exchange, most trading pairs', badge:'Hot', bonus:'20% off trading fees for life + welcome voucher' },
    { name:'OKX',     href:'https://okx.com/join/96160298',                                                                          accent:'#e9e7df', fg:'#0a0b0d', letter:'O', lev:'125×', tag:'Pro tools, unified trading account', bonus:'Up to 100 USDT sign-up rewards + mystery boxes' },
    { name:'Bitget',  href:'https://www.bitget.com/referral/register?clacCode=DSSSQKGK&from=%2Fevents%2Freferral-all-program&source=events&utmSource=PremierInviter', accent:'#00e7d8', fg:'#06231d', letter:'B', lev:'125×', tag:'Copy trading, fast new listings', bonus:'Up to 6,200 USDT welcome pack + 20% off fees' },
    { name:'KuCoin',  href:'https://www.kucoin.com/r/rf/VHP8AYKY',                                                                   accent:'#23af91', fg:'#06231d', letter:'K', lev:'100×', tag:'Huge altcoin selection', bonus:'Up to 11,000 USDT in new-user rewards' },
    { name:'Gate',    href:'https://www.gate.com/VFIWB10KUG?ref=VFIWB10KUG&ref_type=103&ut-m_cmp=rXJBDjtJ&activity_id=1778642196063', accent:'#3361ff', fg:'#ffffff', letter:'G', lev:'100×', tag:'Thousands of tokens listed', bonus:'Up to 6,666 USDT bonus + 20% off fees' },
    { name:'Kraken',  href:'https://invite.kraken.com/JDNW/guj2tf28',                                                                accent:'#7b5cff', fg:'#ffffff', letter:'K', lev:'50×',  tag:'Security-first, long track record', bonus:'Up to $200 bonus — sign up & trade' },
    { name:'MEXC',       href:'https://promote.mexc.com/r/GND4jI97o0',                                                               accent:'#0ac2d6', fg:'#06231d', letter:'M', lev:'500×', tag:'High leverage, fast new listings', bonus:'Up to 10,000 USDT futures bonus + $20 gift' },
    { name:'Crypto.com', href:'https://crypto.com/app/sdf5hb6rkv',                                                                   accent:'#0b2e7a', fg:'#ffffff', letter:'C', lev:'100×', tag:'Trusted, easy fiat on-ramp', bonus:'Up to $50 in CRO for new users' }
  ];
  const exgrid = document.getElementById('exgrid');
  if (exgrid) EXLIST.forEach(ex => {
    const a = document.createElement('a');
    a.className = 'excard';
    a.style.setProperty('--exc', ex.accent);
    a.setAttribute('href', ex.href);   // setAttribute keeps & params literal
    a.target = '_blank';
    a.rel = 'sponsored noopener noreferrer';
    a.innerHTML =
      '<div class="exh"><span class="exmark" style="background:'+ex.accent+';color:'+ex.fg+'">'+ex.letter+'</span><span class="exname">'+ex.name+'</span>'
      + '<span class="exlev exlev-chip"><b>'+ex.lev+'</b><span data-i18n="exMaxLev">max leverage</span></span></div>'
      + '<div class="extag">'+ex.tag+'</div>'
      + (ex.bonus ? '<div class="exbonus"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg><span>'+ex.bonus+'</span></div>' : '')
      + '<span class="exgo" data-i18n="exTrade">Trade →</span>';
    exgrid.appendChild(a);
  });

  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected','false'));
    t.setAttribute('aria-selected','true');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    $(t.dataset.tab).classList.add('active');
  }));

  const sides = { liqSide:'long', pnlSide:'long', tpSide:'long', crSide:'long' };
  document.querySelectorAll('[data-seg]').forEach(seg => {
    seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); sides[seg.dataset.seg] = b.dataset.side; calcAll();
    }));
  });

  function calcLiq(){
    const entry=num('liqEntry'), lev=num('liqLev'), mmr=num('liqMmr')/100, out=$('liqOut');
    if(!isFinite(entry)||!isFinite(lev)||lev<=0||!isFinite(mmr)){ muted(out); $('liqDist').textContent=$('liqMove').textContent=$('liqMargin').textContent='—'; return; }
    const long=sides.liqSide==='long';
    const liq=long?entry*(1-1/lev+mmr):entry*(1+1/lev-mmr);
    const dist=(liq-entry)/entry*100;
    out.className='rvalue '+(dist<0?'neg':'pos'); animateNum(out, liq, v=>'$'+fmtUSD(v));
    $('liqDist').textContent=fmtPct(dist); $('liqDist').className='v '+(dist<0?'neg':'pos');
    $('liqMove').textContent=Math.abs(dist).toFixed(2)+'% '+(long?'↓':'↑');
    $('liqMargin').textContent=(100/lev).toFixed(2)+'%';
  }
  // Cross-margin liquidation (Binance-style): the WHOLE wallet balance backs the position, so liq depends on
  // balance, not on chosen leverage. Liq when balance + uPnL = maintenance margin:
  //   long:  P = (qty·entry − balance) / (qty·(1 − mmr))     short: P = (balance + qty·entry) / (qty·(1 + mmr))
  function calcCross(){
    const entry=num('crEntry'), qty=num('crQty'), bal=num('crBal'), mmr=num('crMmr')/100, out=$('crOut'), lad=$('crLadder');
    if(!out)return;
    const clear=()=>{ muted(out); $('crDist').textContent=$('crEffLev').textContent=$('crNotional').textContent='—'; if(lad)lad.innerHTML=''; };
    if(!isFinite(entry)||entry<=0||!isFinite(qty)||qty<=0||!isFinite(bal)||bal<0||!isFinite(mmr)){ clear(); return; }
    const long=sides.crSide==='long';
    const liqAt=b=>long ? (qty*entry-b)/(qty*(1-mmr)) : (b+qty*entry)/(qty*(1+mmr));
    const notional=qty*entry, effLev=bal>0?notional/bal:Infinity;
    const liq=liqAt(bal), covered=long&&liq<=0, dist=(liq-entry)/entry*100;
    if(covered){ out.className='rvalue pos'; cancelAnimationFrame(out._raf); out.textContent='No liquidation'; out._cur=NaN; }
    else { out.className='rvalue '+(dist<0?'neg':'pos'); animateNum(out, liq, v=>'$'+fmtUSD(v)); }
    $('crDist').textContent=covered?'— fully backed':fmtPct(dist); $('crDist').className='v '+((covered||dist<0)?'neg':'pos');
    $('crEffLev').textContent=isFinite(effLev)?effLev.toFixed(2)+'×':'∞';
    $('crNotional').textContent='$'+fmtUSD(notional);
    if(lad){ const steps=[0.25,0.5,1,2].map(f=>bal>0?bal*f:notional*0.02*(f*4)).filter(a=>a>0);
      lad.innerHTML=steps.map(add=>{
        const l2=liqAt(bal+add), cov2=long&&l2<=0, d2=(l2-entry)/entry*100;
        return '<tr><td>+$'+fmtUSD(add)+'</td><td><span class="p">'+(cov2?'no liquidation':'$'+fmtUSD(l2))+'</span></td><td>'+(cov2?'<span class="g">fully backed</span>':fmtPct(d2))+'</td></tr>';
      }).join(''); }
  }
  function calcSize(){
    const bal=num('szBal'), risk=num('szRisk')/100, entry=num('szEntry'), stop=num('szStop'), lev=num('szLev'), out=$('szOut');
    const dist=Math.abs(entry-stop);
    if(!isFinite(bal)||!isFinite(risk)||!isFinite(entry)||!isFinite(stop)||dist===0){ muted(out); $('szNotional').textContent=$('szRiskAmt').textContent=$('szDist').textContent=$('szMargin').textContent='—'; return; }
    const riskAmt=bal*risk, qty=riskAmt/dist, notional=qty*entry;
    out.className='rvalue'; animateNum(out, qty, v=>fmtCoin(v));
    $('szNotional').textContent='$'+fmtUSD(notional);
    $('szRiskAmt').textContent='$'+fmtUSD(riskAmt);
    $('szDist').textContent=(dist/entry*100).toFixed(2)+'%';
    $('szMargin').textContent=(isFinite(lev)&&lev>0)?'$'+fmtUSD(notional/lev):'—';
  }
  function calcPnl(){
    const entry=num('pnlEntry'), exit=num('pnlExit'), qty=num('pnlQty'), lev=num('pnlLev'), out=$('pnlOut');
    if(!isFinite(entry)||!isFinite(exit)||!isFinite(qty)){ muted(out); $('pnlRoi').textContent=$('pnlRoe').textContent=$('pnlNotional').textContent=$('pnlExitVal').textContent='—'; return; }
    const long=sides.pnlSide==='long';
    const pnl=(long?(exit-entry):(entry-exit))*qty, roi=(long?(exit-entry):(entry-exit))/entry*100, notional=entry*qty;
    out.className='rvalue'+(pnl<0?' neg':' pos'); animateNum(out, pnl, v=>(v>=0?'+$':'−$')+fmtUSD(Math.abs(v)));
    $('pnlRoi').textContent=fmtPct(roi); $('pnlRoi').className='v '+(roi<0?'neg':'pos');
    const roe=(isFinite(lev)&&lev>0)?roi*lev:NaN;
    $('pnlRoe').textContent=isFinite(roe)?fmtPct(roe):'—'; $('pnlRoe').className='v '+(roe<0?'neg':'pos');
    $('pnlNotional').textContent='$'+fmtUSD(notional);
    $('pnlExitVal').textContent='$'+fmtUSD(exit*qty);
  }
  function calcDca(){
    const out=$('dcaOut'); let cost=0, qty=0;
    for(let i=1;i<=4;i++){ const p=num('dcaP'+i), q=num('dcaQ'+i); if(isFinite(p)&&isFinite(q)&&p>0&&q>0){ cost+=p*q; qty+=q; } }
    if(qty<=0){ muted(out); $('dcaQty').textContent=$('dcaCost').textContent=$('dcaVal').textContent=$('dcaPnl').textContent='—'; return; }
    const avg=cost/qty; out.className='rvalue'; animateNum(out, avg, v=>'$'+fmtUSD(v));
    $('dcaQty').textContent=fmtCoin(qty);
    $('dcaCost').textContent='$'+fmtUSD(cost);
    const cur=num('dcaCur');
    if(isFinite(cur)&&cur>0){
      const val=cur*qty, pnl=val-cost, roi=pnl/cost*100;
      $('dcaVal').textContent='$'+fmtUSD(val);
      $('dcaPnl').textContent=(pnl>=0?'+$':'−$')+fmtUSD(Math.abs(pnl))+'  ('+fmtPct(roi)+')';
      $('dcaPnl').className='v '+(pnl<0?'neg':'pos');
    } else { $('dcaVal').textContent='—'; $('dcaPnl').textContent='—'; $('dcaPnl').className='v'; }
  }
  function calcTp(){
    const entry=num('tpEntry'), lev=(isFinite(num('tpLev'))&&num('tpLev')>0)?num('tpLev'):1, qty=num('tpQty'), out=$('tpOut'), body=$('tpLadder');
    const long=sides.tpSide==='long';
    const targetPrice = roe => long ? entry*(1+roe/100/lev) : entry*(1-roe/100/lev);
    const profitAt = price => isFinite(qty) ? (long?(price-entry):(entry-price))*qty : NaN;
    if(!isFinite(entry)||entry<=0){ muted(out); body.innerHTML=''; return; }
    const custom=num('tpCustom');
    if(isFinite(custom)){ out.className='rvalue '+(long?'pos':'neg'); animateNum(out, targetPrice(custom), v=>'$'+fmtUSD(v)); }
    else muted(out);
    const levels=[25,50,100,200];
    body.innerHTML = levels.map(r=>{
      const px=targetPrice(r), pf=profitAt(px);
      return '<tr><td>+'+r+'%</td><td><span class="p">$'+fmtUSD(px)+'</span></td><td>'+(isFinite(pf)?'<span class="g">+$'+fmtUSD(pf)+'</span>':'—')+'</td></tr>';
    }).join('');
  }

  function calcRr(){
    const entry=num('rrEntry'), stop=num('rrStop'), tp=num('rrTp'), out=$('rrOut');
    const risk=Math.abs(entry-stop), reward=Math.abs(tp-entry);
    if(!isFinite(entry)||!isFinite(stop)||!isFinite(tp)||risk===0){ muted(out); $('rrRisk').textContent=$('rrReward').textContent=$('rrBe').textContent='—'; return; }
    const ratio=reward/risk, be=risk/(risk+reward)*100;
    out.className='rvalue'; animateNum(out, ratio, v=>v.toFixed(2)+' : 1');
    $('rrRisk').textContent='$'+fmtUSD(risk);
    $('rrReward').textContent='$'+fmtUSD(reward);
    $('rrBe').textContent=be.toFixed(2)+'%';
  }

  function calcAll(){ calcLiq(); calcCross(); calcSize(); calcPnl(); calcDca(); calcTp(); calcRr(); }
  document.querySelectorAll('input[type=number]').forEach(i => i.addEventListener('input', calcAll));
  // Exchange preset → fills the maintenance-margin rate per venue (rates differ by exchange). Manual edit flips it to "Custom".
  (function(){ const ex=$('liqEx'), mmr=$('liqMmr'); if(!ex||!mmr)return;
    ex.addEventListener('change', () => { if(ex.value!==''){ mmr.value=ex.value; calcAll(); } });
    mmr.addEventListener('input', () => { const cu=ex.querySelector('option[value=""]'); if(cu&&ex.value!==''){ ex.value=''; ex.dispatchEvent(new Event('change',{bubbles:true})); } }); // dispatch so the custom-select label flips to "Custom" too
  })();
  (function(){ const ex=$('crEx'), mmr=$('crMmr'); if(!ex||!mmr)return;
    ex.addEventListener('change', () => { if(ex.value!==''){ mmr.value=ex.value; calcAll(); } });
    mmr.addEventListener('input', () => { const cu=ex.querySelector('option[value=""]'); if(cu&&ex.value!==''){ ex.value=''; ex.dispatchEvent(new Event('change',{bubbles:true})); } }); // dispatch so the custom-select label flips to "Custom" too
  })();
  calcAll();

  // copy-to-clipboard buttons on each main result
  document.querySelectorAll('.copybtn').forEach(btn => btn.addEventListener('click', () => {
    const el = document.getElementById(btn.dataset.copy);
    const txt = el ? el.textContent.trim() : '';
    if (!txt || txt === '—') return;
    const done = () => { btn.classList.add('copied'); setTimeout(() => btn.classList.remove('copied'), 1300); };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(done).catch(done); }
    else { const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} document.body.removeChild(ta); done(); }
  }));

  // ---- hot pairs: live prices via our own /api/prices (proxied, cached, fallback) ----
  (function(){
    const grid = document.getElementById('hpGrid');
    if (!grid) return;
    grid.innerHTML = Array.from({length:8}).map(function(){return '<div class="hp-card hp-skel"><div class="sk sk-1"></div><div class="sk sk-2"></div><div class="sk sk-3"></div></div>';}).join('');
    const PAIRS = [
      {s:'BTCUSDT',n:'BTC'},{s:'ETHUSDT',n:'ETH'},{s:'SOLUSDT',n:'SOL'},{s:'BNBUSDT',n:'BNB'},
      {s:'XRPUSDT',n:'XRP'},{s:'DOGEUSDT',n:'DOGE'},{s:'ADAUSDT',n:'ADA'},{s:'AVAXUSDT',n:'AVAX'}
    ];
    const REF = 'MAOZM9DS', BASE = 'https://www.binance.com/en/futures/';
    const CC = {BTC:'#f7931a',ETH:'#7b8cf0',SOL:'#14f195',BNB:'#f3ba2f',XRP:'#cfd3d8',DOGE:'#c2a633',ADA:'#3468d1',AVAX:'#e84142'};
    const LOGOS = {}; // real coin logos from CoinGecko (progressive enhancement; falls back to the color dot)
    (window.requestIdleCallback||function(f){setTimeout(f,1700);})(function(){try{fetch('/api/gecko/markets',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){if(Array.isArray(j)){j.forEach(function(c){if(c&&c.symbol&&c.image)LOGOS[String(c.symbol).toUpperCase()]=c.image;});if(lastPairs)render(lastPairs);}}).catch(function(){});}catch(e){}});
    const fmtP = v => { v=parseFloat(v); return v>=1 ? v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : v>=0.01 ? v.toFixed(4) : v.toFixed(6); }; // ≥ $1 → always 2 decimals (.00)
    let loaded = false; const prevPx={}; let lastPairs=null;
    const STAR='<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12 2 15.1 8.6 22 9.3 17 14.1 18.2 21 12 17.6 5.8 21 7 14.1 2 9.3 8.9 8.6 12 2"/></svg>';
    function wlGet(){try{return JSON.parse(localStorage.getItem('mp_watchlist')||'[]');}catch(e){return [];}}
    function wlHas(s){return wlGet().indexOf(s)>=0;}
    function wlToggle(s){var a=wlGet(),i=a.indexOf(s);if(i>=0)a.splice(i,1);else a.push(s);try{localStorage.setItem('mp_watchlist',JSON.stringify(a));}catch(e){}}
    function render(pairs){
      lastPairs=pairs;
      const map={}; pairs.forEach(d=>map[d.symbol]=d);
      let hottest=null, hotAbs=0;
      PAIRS.forEach(p=>{ const d=map[p.s]; if(d){ const a=Math.abs(parseFloat(d.changePct)); if(a>hotAbs){hotAbs=a;hottest=p.s;} } });
      const ORD = PAIRS.slice().sort(function(a,b){return (wlHas(a.s)?0:1)-(wlHas(b.s)?0:1);}); // starred pinned to the front
      const html = ORD.map(p=>{
        const d=map[p.s]; if(!d) return '';
        const chg=parseFloat(d.changePct), up=chg>=0, hot=p.s===hottest, star=wlHas(p.s);
        return '<div class="hp-card'+(hot?' hot':'')+(star?' starred':'')+'" data-s="'+p.s+'">'
          + '<div class="hp-top"><span class="hp-sym"><button class="hp-star'+(star?' on':'')+'" data-star="'+p.s+'" type="button" aria-label="Watchlist">'+STAR+'</button>'+(LOGOS[p.n]?'<img class="hp-logo" src="'+LOGOS[p.n]+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">':'<span class="hp-coin" style="background:'+(CC[p.n]||'#8a93a0')+';color:'+(CC[p.n]||'#8a93a0')+'"></span>')+p.n+'<small>/USDT</small></span>'
          + '<span class="hp-chg '+(up?'up':'down')+'">'+(up?'▲ +':'▼ ')+chg.toFixed(2)+'%</span></div>'
          + '<div class="hp-price '+(up?'up':'down')+'">$'+fmtP(d.price)+'</div>'
          + '<svg class="hp-spark" data-spark="'+p.n+'" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true"><path d=""/></svg>'
          + '<a class="hp-trade" href="/paper-trade?coin='+p.n+'">Trade demo →</a>'
          + '</div>';
      }).join('');
      if (html) { grid.innerHTML = html; loaded = true;
        PAIRS.forEach(p=>{ const d=map[p.s]; if(!d)return; const np=parseFloat(d.price), op=prevPx[p.s]; if(op!=null&&np!==op){ const el=grid.querySelector('.hp-card[data-s="'+p.s+'"]'); if(el)el.classList.add(np>op?'flash-up':'flash-dn'); } prevPx[p.s]=np; });
        grid.querySelectorAll('.hp-spark').forEach(function(el){drawSpark(el,el.getAttribute('data-spark'));});
      }
    }
    function sparkPath(a){ if(!a||a.length<2)return ''; var n=a.length,mn=Math.min.apply(null,a),mx=Math.max.apply(null,a),rng=(mx-mn)||1,s=''; for(var i=0;i<n;i++){var x=(i/(n-1))*100,y=25-((a[i]-mn)/rng)*23; s+=(i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)+' ';} return s.trim(); }
    function drawSpark(el,name){ if(!el)return; var h=window.mpHist&&window.mpHist[name]; var p=el.querySelector('path'); if(!p)return; var d=sparkPath(h); if(!d){return;} p.setAttribute('d',d); var upTrend=h[h.length-1]>=h[0]; el.classList.toggle('up',upTrend); el.classList.toggle('dn',!upTrend); }
    var _spk={};
    document.addEventListener('mp:price',function(ev){ if(!ev.detail)return; var s=ev.detail.sym;
      var pcard=grid.querySelector('.hp-card[data-s="'+s+'USDT"]'); var pe=pcard&&pcard.querySelector('.hp-price'); if(pe&&+ev.detail.price>0&&window.mpSmoothPx)window.mpSmoothPx(pe,+ev.detail.price,'hp_'+s); // roll the trending price smoothly between ticks
      var now=(window.performance&&performance.now)?performance.now():+new Date(); if(now-(_spk[s]||0)<700)return; _spk[s]=now; var el=grid.querySelector('.hp-spark[data-spark="'+s+'"]'); if(el)drawSpark(el,s); });
    grid.addEventListener('click',function(e){var st=e.target.closest('.hp-star');if(!st)return;e.preventDefault();e.stopPropagation();wlToggle(st.getAttribute('data-star'));if(lastPairs)render(lastPairs);});
    function load(){
      fetch('/api/prices', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(j => { if (j && j.pairs && j.pairs.length) render(j.pairs); })
        .catch(() => { if (!loaded) grid.innerHTML = '<p class="sec-sub" style="grid-column:1/-1">Loading live prices…</p>'; });
    }
    load();
    setInterval(function(){if(!document.hidden)load();}, 20000);
    document.addEventListener('visibilitychange',function(){if(!document.hidden)load();});
  })();

  (function(){
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reduce) {
      const card = document.querySelector('.card');
      if (card) card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
      const h1 = document.querySelector('.hero h1');
      if (h1) window.addEventListener('pointermove', e => {
        const cx = e.clientX / window.innerWidth - .5, cy = e.clientY / window.innerHeight - .5;
        h1.style.transform = 'translate(' + (cx*10).toFixed(1) + 'px,' + (cy*7).toFixed(1) + 'px)';
      }, { passive: true });
    }

    // ---- live line-chart background: a dot tracing a white line ----
    const cv = document.getElementById('bgchart');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const STEP = 7, SPEED = 0.9;
    let W=0, H=0, dpr=1, pts=[], scrollX=0, vmin=0, vmax=1, tmin=0, tmax=1, raf=0;
    function nextP(prev){ return Math.max(0.0001, prev*(1+(Math.random()-0.5)*0.02)); }
    function recompute(instant){
      let mn=Infinity, mx=-Infinity;
      for (const v of pts){ if(v<mn)mn=v; if(v>mx)mx=v; }
      const pad=(mx-mn)*0.25 || 1; tmin=mn-pad; tmax=mx+pad;
      if(instant){ vmin=tmin; vmax=tmax; }
    }
    function seed(){
      pts=[]; let p=100, n=Math.ceil(W/STEP)+3;
      for (let i=0;i<n;i++){ pts.push(p); p=nextP(p); }
      recompute(true);
    }
    function resize(){
      dpr=Math.min(2, window.devicePixelRatio||1);
      W=cv.clientWidth; H=cv.clientHeight;
      cv.width=Math.max(1,Math.floor(W*dpr)); cv.height=Math.max(1,Math.floor(H*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0); seed();
    }
    function yv(v){ const norm=(v-vmin)/(vmax-vmin); return H*0.22 + (1-norm)*H*0.6; }
    function draw(){
      ctx.clearRect(0,0,W,H);
      vmin += (tmin-vmin)*0.05; vmax += (tmax-vmax)*0.05;
      let lx=0, ly=0;
      // soft area under the line
      ctx.beginPath();
      for (let i=0;i<pts.length;i++){ const x=i*STEP - scrollX, y=yv(pts[i]); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); lx=x; ly=y; }
      ctx.lineTo(lx, H); ctx.lineTo(-STEP, H); ctx.closePath();
      ctx.fillStyle='rgba(255,255,255,0.022)'; ctx.fill();
      // the white line
      ctx.beginPath();
      for (let i=0;i<pts.length;i++){ const x=i*STEP - scrollX, y=yv(pts[i]); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
      ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1.5; ctx.lineJoin='round'; ctx.stroke();
      // glowing dot that "draws" the line at the leading edge
      ctx.shadowColor='rgba(255,255,255,0.9)'; ctx.shadowBlur=14;
      ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI*2); ctx.fillStyle='#ffffff'; ctx.fill();
      ctx.shadowBlur=0;
    }
    function tick(){
      if (document.hidden) { raf=requestAnimationFrame(tick); return; } // pause only when the tab is hidden
      scrollX += SPEED;
      if (scrollX >= STEP){ scrollX-=STEP; pts.shift(); pts.push(nextP(pts[pts.length-1])); recompute(false); }
      pts[pts.length-1] = Math.max(0.0001, pts[pts.length-1]*(1+(Math.random()-0.5)*0.004));
      draw();
      raf=requestAnimationFrame(tick);
    }
    if (window.matchMedia && window.matchMedia('(max-width:760px)').matches) { cv.style.display='none'; return; } // mobile: never start the animated canvas background (perf)
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); resize(); raf=requestAnimationFrame(tick); });
    // Re-measure + restart after the canvas was hidden (e.g. on /charts the bg is display:none, so resize() read 0×0). Called by applyRoute when leaving a tool route, so the homepage background isn't frozen blank.
    window.mpBgKick = function(){ if (window.matchMedia && window.matchMedia('(max-width:760px)').matches) return; if (!cv.clientWidth) return; cancelAnimationFrame(raf); resize(); raf=requestAnimationFrame(tick); };
    resize();
    raf=requestAnimationFrame(tick);
  })();
