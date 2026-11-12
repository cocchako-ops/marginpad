/* THE RISK TAB IN MY TRADES (2026-11-12, owner-approved feature #3). ONE block written into BOTH chat/journal bundles (home.js and
   mp-trade.js are hand-mirrored copies of the drawer - this is how the pair stays byte-identical) and ONE stylesheet block into
   home.css + mp-trade.css. Everything is computed on the client from the journal and mpLivePrices through the drawer's own
   metrics(): margin in use, notional exposure, the nearest liquidation across every open position, what a 3% move against every
   net side would cost, and a correlation flag when 60%+ of the margin sits on one side of crypto across two or more coins.
   Idempotent (refuses on a half-present state), --dry prints what it would do. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DRY = process.argv.includes('--dry');
const MARK = '/* @JRRISK';
const BLOCK = `  ${MARK} THE RISK TAB (2026-11-12, feature #3) - MIRRORED in home.js and mp-trade.js by build/fix-jr-risk.js; edit the patcher, not this copy. */
  function jrRisk(open){
    var out='<div class="jr-risk" data-n="'+open.length+'">';
    if(!open.length)return out+'<div class="pp-empty"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg><span>'+MT('rkNone','No open positions - nothing at risk right now.')+'</span></div></div>';
    var by={},tm=0,tn=0,tu=0,near=null,near3=0,past=0,cl=0,cs=0,cn={},cN=0;
    open.forEach(function(e){var m=metrics(e);var mg=m.margin>0?m.margin:0;var nt=(e.qty!=null&&isFinite(e.qty)&&m.live>0)?Math.abs(+e.qty)*m.live:mg*m.lev;var s=String(e.sym||'-').toUpperCase();
      var r=by[s]||(by[s]={sym:s,l:0,s:0,m:0,n:0,u:0,liq:null});if(m.long)r.l+=nt;else r.s+=nt;r.m+=mg;r.n++;r.u+=(m.pnl||0);
      if(isFinite(m.liqDist)){if(r.liq==null||m.liqDist<r.liq)r.liq=m.liqDist;if(near==null||m.liqDist<near.d)near={d:m.liqDist,sym:s,long:m.long,lev:m.lev};if(m.liqDist<=0)past++;else if(m.liqDist<3)near3++;}
      tm+=mg;tn+=nt;tu+=(m.pnl||0);
      var crypto=window.mpAssetClass?window.mpAssetClass(s)==='crypto':true;if(crypto){if(m.long)cl+=mg;else cs+=mg;cn[s]=1;cN++;}});
    var rows=Object.keys(by).map(function(k){return by[k];}).sort(function(a,b){return (b.l+b.s)-(a.l+a.s);});
    var cost3=rows.reduce(function(a,r){return a+Math.abs(r.l-r.s)*0.03;},0);
    function tile(v,l,c){return '<div class="jr-stat jr-rk-t"><div class="v"'+(c?' style="color:'+c+'"':'')+'>'+v+'</div><div class="l">'+l+'</div></div>';}
    var nearTxt=near?(near.sym+' '+(near.long?MT('rkLong','long'):MT('rkShort','short'))+' '+Math.round(near.lev)+'x · '+(near.d<=0?MT('rkAtLiq','at the level'):Math.abs(near.d).toFixed(near.d<10?2:1)+'% '+MT('rkAway','away'))):'-';
    var nearCol=near?(near.d<=0||near.d<3?'#ff7b72':near.d<8?'#f0c35a':'#34d99a'):'';
    out+='<div class="jr-rk-tiles">'+tile(money(tm),MT('rkMargin','Margin in use'))+tile(money(tn),MT('rkNotional','Open exposure'))+tile(nearTxt,MT('rkNearest','Nearest liquidation'),nearCol)+tile('-'+money(cost3).replace('-',''),MT('rkCost3','A 3% move against every net side'),'#ff7b72')+'</div>';
    if(past>0)out+='<div class="jr-rk-note warn">'+past+' '+(past===1?MT('rkPast1','position is at its liquidation level - the server is settling it.'):MT('rkPastN','positions are at their liquidation level - the server is settling them.'))+'</div>';
    else if(near3>0)out+='<div class="jr-rk-note warn">'+near3+' '+(near3===1?MT('rkNear1','position is inside 3% of its liquidation.'):MT('rkNearN','positions are inside 3% of their liquidation.'))+'</div>';
    var cc=cl+cs,coins=Object.keys(cn).length;
    if(cc>0&&cN>=2&&coins>=2){var big=Math.max(cl,cs),pct=Math.round(big/cc*100),sideW=cl>=cs?MT('rkLong','long'):MT('rkShort','short');
      if(pct>=60)out+='<div class="jr-rk-note corr">'+pct+'% '+MT('rkCorrA','of your margin is')+' '+sideW+' '+MT('rkCorrB','crypto across')+' '+coins+' '+MT('rkCorrC','coins - they move together, so one BTC move hits all of them at once.')+'</div>';
      else out+='<div class="jr-rk-note">'+MT('rkBal','Longs')+' '+Math.round(cl/cc*100)+'% / '+MT('rkBalS','shorts')+' '+Math.round(cs/cc*100)+'% '+MT('rkBalB','of your crypto margin across')+' '+coins+' '+MT('rkCoins','coins')+'.</div>';}
    out+='<div class="jr-rk-h"><span>'+MT('rkCoin','Coin')+'</span><span>'+MT('rkNet','Net exposure')+'</span><span>'+MT('rkMarginS','Margin')+'</span><span>'+MT('rk3','3% costs')+'</span><span>'+MT('rkLiq','Liq')+'</span></div>';
    rows.forEach(function(r){var net=r.l-r.s,side=(r.l>0&&r.s>0)?'both':(net>=0?'long':'short'),share=tn>0?Math.round((r.l+r.s)/tn*100):0;
      out+='<div class="jr-rk-row" data-sym="'+esc(r.sym)+'"><span class="c"><b>'+esc(r.sym)+'</b><i class="'+side+'">'+(side==='both'?MT('rkBoth','both'):(side==='long'?MT('rkLong','long'):MT('rkShort','short')))+'</i>'+(r.n>1?'<em>x'+r.n+'</em>':'')+'</span><span class="n"><b>'+money(Math.abs(net))+'</b><span class="jr-rk-bar"><span style="width:'+share+'%"></span></span></span><span class="m">'+money(r.m)+'</span><span class="k">-'+money(Math.abs(net)*0.03).replace('-','')+'</span><span class="q'+(r.liq!=null&&r.liq<3?' hot':'')+'">'+(r.liq==null?'-':(r.liq<=0?MT('rkAtLiq','at the level'):Math.abs(r.liq).toFixed(r.liq<10?2:1)+'%'))+'</span></div>';});
    out+='<div class="jr-rk-foot">'+MT('rkFoot','Measured from your open positions at the live price. Exposure is position size (margin x leverage); a coin held both ways counts its net.')+'</div>';
    return out+'</div>';
  }
`;
const CSS = `/* My Trades - the Risk tab (2026-11-12, feature #3; build/fix-jr-risk.js writes this into home.css AND mp-trade.css) */
.jr-risk{display:block}.jr-rk-tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 10px}.jr-rk-t .v{font-size:17px;line-height:1.15;word-break:break-word}.jr-rk-t .l{margin-top:5px}
.jr-rk-note{font:12.5px/1.45 'Familjen Grotesk',sans-serif;color:#aab4be;padding:9px 11px;border:1px solid var(--line-bright,#2a313c);border-radius:10px;margin:0 0 10px;background:rgba(255,255,255,.03)}
.jr-rk-note.warn{color:#ffb4ad;border-color:rgba(255,123,114,.35);background:rgba(255,123,114,.08)}.jr-rk-note.corr{color:#f6d98a;border-color:rgba(240,195,90,.35);background:rgba(240,195,90,.08)}
.jr-rk-h,.jr-rk-row{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.5fr) minmax(0,.9fr) minmax(0,.9fr) minmax(0,.7fr);gap:8px;align-items:center;font-variant-numeric:tabular-nums}
.jr-rk-h{font:700 10px/1 'Familjen Grotesk',sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#5b6470;padding:4px 10px 6px}
.jr-rk-row{font:12.5px/1.3 'Space Mono',monospace;color:#dfe4ec;padding:9px 10px;border:1px solid var(--line-bright,#2a313c);border-radius:10px;margin:0 0 6px;background:var(--panel-2,#0f1216)}
.jr-rk-row .c{display:flex;align-items:center;gap:6px;min-width:0}.jr-rk-row .c b{font:700 13px/1 'Familjen Grotesk',sans-serif;color:#fff}.jr-rk-row .c i{font:700 9px/1 'Familjen Grotesk',sans-serif;letter-spacing:.04em;text-transform:uppercase;padding:3px 5px;border-radius:4px;font-style:normal}
.jr-rk-row .c i.long{color:#34d99a;background:rgba(52,217,154,.14)}.jr-rk-row .c i.short{color:#ff7b72;background:rgba(255,123,114,.14)}.jr-rk-row .c i.both{color:#f0c35a;background:rgba(240,195,90,.14)}.jr-rk-row .c em{font:11px/1 'Familjen Grotesk',sans-serif;color:#5b6470;font-style:normal}
.jr-rk-row .n{display:flex;flex-direction:column;gap:5px;min-width:0}.jr-rk-row .n b{font-weight:400}.jr-rk-bar{display:block;height:3px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden}.jr-rk-bar span{display:block;height:100%;background:#c2f64a;border-radius:2px}
.jr-rk-row .k{color:#ff7b72}.jr-rk-row .q.hot{color:#ff7b72;font-weight:700}
.jr-rk-foot{font:11px/1.5 'Familjen Grotesk',sans-serif;color:#5b6470;padding:8px 10px 2px}
@media(max-width:480px){.jr-rk-h span:nth-child(3),.jr-rk-row .m{display:none}.jr-rk-h,.jr-rk-row{grid-template-columns:minmax(0,1.2fr) minmax(0,1.4fr) minmax(0,.9fr) minmax(0,.7fr)}.jr-rk-row{font-size:11.5px;padding:8px}}
`;
function once(s, a, b, what, file) { const n = s.split(a).length - 1; if (n !== 1) throw new Error(file + ': anchor "' + what + '" found ' + n + ' times (need exactly 1)'); return s.split(a).join(b); }
let changed = 0;
for (const f of ['dist/assets/home.js', 'dist/assets/mp-trade.js']) {
  const p = path.join(ROOT, f); let s = fs.readFileSync(p, 'utf8');
  const has = s.indexOf(MARK) >= 0, hasTab = s.indexOf('data-jt="risk"') >= 0;
  if (has && hasTab) { console.log(f + ': already applied'); continue; }
  if (has !== hasTab) throw new Error(f + ': half-applied (block ' + has + ', tab ' + hasTab + ') - restore the file first');
  s = once(s, `MT('jClosedN','Closed')+' ('+closed.length+')</button></div>'`, `MT('jClosedN','Closed')+' ('+closed.length+')</button><button data-jt="risk" class="'+(jrTab==='risk'?'on':'')+'">'+MT('jRiskN','Risk')+'</button></div>'`, 'tabs', f);
  s = once(s, `    var rows=(jrTab==='orders'?ords:(jrTab==='open'?open:closed));\n`, `    var rows=(jrTab==='orders'?ords:(jrTab==='open'?open:closed));if(jrTab==='risk')rows=[]; /* the Risk tab is a reading of the OPEN rows, drawn by jrRisk() - it lists nothing */\n`, 'rows', f);
  s = once(s, `    var cards=rows.length?_vis.map(`, `    var cards=jrTab==='risk'?jrRisk(open):rows.length?_vis.map(`, 'cards', f);
  // the filter bar and the "nothing matches" line belong to the list tabs, not to the risk reading
  s = once(s, `+(jrTab!=='orders'?jrFbar(_all,rows.length):'')+(jrTab!=='orders'&&_all&&!rows.length?`, `+(jrTab!=='orders'&&jrTab!=='risk'?jrFbar(_all,rows.length):'')+(jrTab!=='orders'&&jrTab!=='risk'&&_all&&!rows.length?`, 'fbar', f);
  // live refresh: the reading follows the price like the open cards do, replaced only when its text changed
  s = once(s, `    if(listEl&&jrTab==='open')open.forEach(function(e){var card=listEl.querySelector('.pp[data-id="'+e.id+'"]');if(!card)return;var m=metrics(e);\n`, `    if(listEl&&jrTab==='risk'){var _rk=listEl.querySelector('.jr-risk');if(_rk){var _rh=jrRisk(open);if(_rh!==listEl.__jrRisk){listEl.__jrRisk=_rh;_rk.outerHTML=_rh;}}}\n    if(listEl&&jrTab==='open')open.forEach(function(e){var card=listEl.querySelector('.pp[data-id="'+e.id+'"]');if(!card)return;var m=metrics(e);\n`, 'live', f);
  s = once(s, `\n  function render(){\n    var listEl=document.getElementById('jrList'),statsEl=document.getElementById('jrStats'),emptyEl=document.getElementById('jrEmpty');`, `\n` + BLOCK + `  function render(){\n    var listEl=document.getElementById('jrList'),statsEl=document.getElementById('jrStats'),emptyEl=document.getElementById('jrEmpty');`, 'render', f);
  if (!DRY) fs.writeFileSync(p + '.tmp', s), fs.renameSync(p + '.tmp', p);
  console.log(f + ': ' + (DRY ? 'would patch' : 'patched')); changed++;
}
for (const f of ['dist/assets/home.css', 'dist/assets/mp-trade.css']) {
  const p = path.join(ROOT, f); let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf('.jr-rk-tiles{') >= 0) { console.log(f + ': css already present'); continue; }
  const a = `.jr-tabs button.on{background:rgba(255,255,255,.1);color:#fff;}`; const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(f + ': .jr-tabs button.on anchor found ' + n + ' times');
  s = s.split(a).join(a + '\n' + CSS);
  if (!DRY) fs.writeFileSync(p + '.tmp', s), fs.renameSync(p + '.tmp', p);
  console.log(f + ': css ' + (DRY ? 'would be added' : 'added')); changed++;
}
console.log('fix-jr-risk: ' + changed + ' file(s)' + (DRY ? ' (dry run)' : ''));
