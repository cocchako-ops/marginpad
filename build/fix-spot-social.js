/* DEMO SPOT: THE SOCIAL LAYER ON THE PAGE (2026-10-16, owner: no board on the page, a small Claim, a live floor feed of who
   trades what, and theses - posts that earn XP + Ticks and land on /blog/theses/, the newest five shown here).
   Patches dist/spot/index.html by block (indent-matched <div> blocks, the JS between two section comments) and adds the
   English strings to dist/spot/i18n/en.json (packs get them in the next translation pass; the page falls back to English).
   Idempotent; refuses on a missing anchor. */
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '..', 'dist', 'spot', 'index.html');
const EN = path.join(__dirname, '..', 'dist', 'spot', 'i18n', 'en.json');
let h = fs.readFileSync(P, 'utf8');
if (h.indexOf('id="floorRows"') >= 0) { console.log('already'); process.exit(0); }
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
let lines = h.split(N);
const find = (pred, from) => { for (let i = from || 0; i < lines.length; i++) if (pred(lines[i], i)) return i; return -1; };
const must = (i, nm) => { if (i < 0) { console.error('anchor ' + nm + ' missing'); process.exit(1); } return i; };
// remove an indent-matched <div ...> ... </div> block starting at line i
function cutBlock(i) { const ind = lines[i].match(/^\s*/)[0]; const j = must(find((l, k) => k > i && l === ind + '</div>', i), 'block end'); const out = lines.slice(i, j + 1); lines.splice(i, j - i + 1); return out; }
function insertAt(i, txt) { lines.splice(i, 0, ...txt.split('\n')); }

/* 1. the gate's board card goes */
cutBlock(must(find(l => l.indexOf('<div class="card board" id="gateBoard" hidden>') >= 0), 'gate board'));
/* 2. the claim card goes; the worth card gets a fourth tile and a compact claim row; the mast is one column */
cutBlock(must(find(l => l.indexOf('<div class="card claim">') >= 0), 'claim card'));
{
  const i = must(find(l => l.indexOf('<div class="tile"><div class="k" data-t="m_all">All time</div>') >= 0), 'all tile');
  lines[i] = lines[i] + N + '          <div class="tile"><div class="k" data-t="m_rank_k">Board</div><div class="v mono" id="mRankV">-</div><div class="s" id="mRankS"><a href="/leaderboards/#meme" data-t="b_full">Full board</a></div></div>';
  const j = must(find((l, k) => k > i && l === '        </div>', i), 'tiles end');
  insertAt(j + 1, '        <div class="claimrow"><span class="ck" data-th="c_row">Daily top-up · <b>$100</b> of demo cash, once per UTC day. Never counts as profit.</span><button class="cbtn" type="button" id="claimBtn" data-t="c_btn">Claim $100</button></div>');
}
/* 3. the board card beside the coins becomes THE FLOOR */
{
  const i = must(find(l => l === '      <div class="card board">'), 'board card');
  cutBlock(i);
  insertAt(i, `      <div class="card floor" id="floorCard">
        <h2><span data-t="f_h">The floor</span><small id="floorSub" data-t="f_s">who is buying what, live</small><span class="r"><i class="livedot"></i><span data-t="f_live">live</span></span></h2>
        <div class="hot" id="hotRow"></div>
        <div class="frows" id="floorRows"><div class="empty" data-t="f_empty">Quiet for now - the first buy on the floor shows up here.</div></div>
      </div>`);
}
/* 4. theses: the card after the buy card, and the writing sheet before the toast */
{
  const i = must(find(l => l === '    <div class="card" style="margin-top:12px">'), 'history card');
  insertAt(i, `    <div class="card theses" id="thesisCard">
      <h2 id="thesis"><span data-t="th_h">Theses</span><small data-t="th_s">why members hold what they hold</small><button class="r thbtn" type="button" id="thWrite" data-t="th_write">Write a thesis</button></h2>
      <p class="th-lead" data-th="th_lead">Say what you hold, why, and what would prove you wrong. A published thesis pays <b>20 XP</b> and <b>5 Ticks</b> and lands on <a href="/blog/theses/">the blog</a>.</p>
      <div class="throws" id="thRows"><div class="empty" data-t="th_empty">No thesis yet - the first one lands here within a minute of being written.</div></div>
      <a class="more" href="/blog/theses/" id="thMore" data-t="th_more">All theses</a>
    </div>
`);
  const t = must(find(l => l === '<div class="toast" id="toast"></div>'), 'toast');
  insertAt(t, `<div class="sheet" id="thSheet" role="dialog" aria-modal="true">
  <div class="sh-h"><div class="nm"><b data-t="ths_h">Write a thesis</b><small data-t="ths_s">it lands on the blog and in the Community · 20 XP + 5 Ticks</small></div><button class="sh-x" type="button" id="thX" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
  <div class="lbl" data-t="ths_title">Title</div>
  <input class="tin" id="thTitle" type="text" maxlength="140" data-tp="ths_title_ph" placeholder="Why I hold PEPE into the listing">
  <div class="lbl" data-t="ths_coins">Coins (comma separated)</div>
  <input class="tin" id="thSyms" type="text" maxlength="60" placeholder="PEPE, SOL">
  <div class="lbl" data-t="ths_body">Thesis</div>
  <textarea class="tta" id="thBody" rows="9" data-tp="ths_body_ph" placeholder="The setup, the reasoning, the level that would prove you wrong. At least 500 characters - real sentences, not padding."></textarea>
  <div class="cnt" id="thCnt">0 / 500</div>
  <button class="go" type="button" id="thGo" data-t="ths_go">Publish</button>
  <div class="msg" id="thMsg"></div>
</div>
`);
}
/* 5. JS: the board block becomes the floor + theses */
{
  const i = must(find(l => l === '  // ---- board ----'), 'js board start');
  const j = must(find((l, k) => k > i && l === '  // ---- lists ----', i), 'js lists');
  lines.splice(i, j - i, ...`  // ---- the board prizes (for the rank tile) ----
  function loadBoard(){fetch('/api/spot/board',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){if(j&&j.rows){BOARD=j;renderMast();}}).catch(function(){});}
  // ---- THE FLOOR: the newest buys and sells across every member, and what is hot today ----
  var FEED=null,FEED_T=0;
  function loadFeed(){fetch('/api/spot/feed',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){if(j&&j.rows){FEED=j;FEED_T=Date.now();renderFeed();}}).catch(function(){});}
  setInterval(function(){if(!document.hidden)loadFeed();},30000);
  function coinOfRow(r){return r.k==='meme'?{kind:'meme',mint:r.mint,pool:r.pool,net:r.net,sym:r.sym,name:r.name||'',logo:r.logo||'',price:+r.price||0,key:r.net+':'+r.mint}:{kind:'cex',sym:r.sym,name:r.name||'',logo:r.logo||'',price:+r.price||0,key:'cex:'+r.sym};}
  function renderFeed(){
    var el=$('floorRows'),hot=$('hotRow');if(!FEED)return;var rows=FEED.rows||[],hs=FEED.hot||[];
    hot.innerHTML=hs.length?'<span class="hk">'+L('f_hot')+'</span>'+hs.slice(0,6).map(function(x,i){return '<button class="hchip" type="button" data-hot="'+i+'">'+logo(x.logo,x.sym)+'<b>'+esc(x.sym)+'</b><small>'+x.buyers+'</small></button>';}).join(''):'';
    if(!rows.length){el.innerHTML='<div class="empty">'+L('f_empty')+'</div>';return;}
    el.innerHTML=rows.slice(0,25).map(function(r,i){var sell=r.side==='sell';
      return '<div class="frow" data-fi="'+i+'">'+logo(r.logo,r.sym)+'<div class="nm"><b><a data-lbu="'+esc(r.who)+'">'+esc(r.who)+'</a> <span class="'+(sell?'dn':'up')+'">'+L(sell?'f_sold':'f_bought')+'</span> '+esc(r.sym)+'</b><small>'+fmtUsd(r.usdUsd,0)+(r.net?' · '+netb(r.net):'')+' · '+ago(r.ts)+'</small></div><div class="num">'+(sell&&r.pnlUsd!=null?pnl(r.pnlUsd):'')+'</div></div>';}).join('');
    $('floorSub').textContent=L('f_s2',{n:rows.length});
  }
  $('floorRows').addEventListener('click',function(e){if(e.target.closest('[data-lbu]'))return;var r=e.target.closest('[data-fi]');if(!r||!FEED)return;var row=FEED.rows[+r.getAttribute('data-fi')];if(row)openSheet(coinOfRow(row),'buy');});
  $('hotRow').addEventListener('click',function(e){var c=e.target.closest('[data-hot]');if(!c||!FEED)return;var x=FEED.hot[+c.getAttribute('data-hot')];if(x)openSheet(coinOfRow(x),'buy');track('hot:'+x.sym);});
  // ---- THESES: the newest five, and the writing sheet (a thesis is a Community post in the thesis category) ----
  var TH=null;
  function loadTheses(){fetch('/api/spot/theses',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){if(j&&j.rows){TH=j.rows;renderTheses();}}).catch(function(){});}
  function renderTheses(){var el=$('thRows');if(!TH)return;if(!TH.length){el.innerHTML='<div class="empty">'+L('th_empty')+'</div>';$('thMore').hidden=true;return;}$('thMore').hidden=false;
    el.innerHTML=TH.map(function(p){return '<a class="throw" href="/community/p/'+esc(p.id)+'/'+esc(p.slug||'')+'"><b>'+esc(p.title)+'</b><small><span data-lbu="'+esc(p.author)+'" class="au">'+esc(p.author)+'</span> · '+ago(p.ts)+(p.syms&&p.syms.length?' · '+p.syms.map(function(s){return '<em>$'+esc(s)+'</em>';}).join(' '):'')+' · '+p.likes+' '+L('th_likes')+'</small><span class="ex">'+esc(p.excerpt||'')+'</span></a>';}).join('');}
  $('thWrite').addEventListener('click',function(){if(!ME){if(window.mpAuth&&window.mpAuth.open)window.mpAuth.open();return;}
    var syms=(PORT&&PORT.holds||[]).map(function(h){return (h.meta&&h.meta.sym)||String(h.key).replace(/^cex:/,'');}).slice(0,4).join(', ');if(!$('thSyms').value)$('thSyms').value=syms;
    $('thMsg').textContent='';$('thMsg').className='msg';$('ov').classList.add('on');$('thSheet').classList.add('on');setTimeout(function(){$('thTitle').focus();},50);track('thesis:open');});
  function thClose(){$('thSheet').classList.remove('on');if(!$('sheet').classList.contains('on'))$('ov').classList.remove('on');}
  $('thX').addEventListener('click',thClose);$('ov').addEventListener('click',thClose);
  $('thBody').addEventListener('input',function(){var n=$('thBody').value.trim().length;$('thCnt').textContent=n+' / 500';$('thCnt').className='cnt'+(n>=500?' ok':'');});
  $('thGo').addEventListener('click',function(){var t=$('thTitle').value.trim(),b=$('thBody').value.trim(),m=$('thMsg'),g=$('thGo');m.className='msg';
    if(t.length<15){m.className='msg err';m.textContent=L('ths_e_title');return;}if(b.length<500){m.className='msg err';m.textContent=L('ths_e_short',{n:b.length});return;}
    g.disabled=true;m.textContent=L('ths_publishing');
    var syms=$('thSyms').value.toUpperCase().replace(/[^A-Z0-9,\\s]/g,'').split(/[,\\s]+/).filter(Boolean).slice(0,6).join(',');
    fetch('/api/comm/post',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:t,body:b,cat:'thesis',syms:syms})}).then(function(r){return r.json();}).then(function(j){g.disabled=false;
      if(j&&j.ok){var rw=j.reward||{};m.className='msg ok';m.innerHTML=L('ths_ok',{xp:rw.xp||0,ticks:rw.ticks||0});toast(L('ths_toast',{xp:rw.xp||0,ticks:rw.ticks||0}));$('thTitle').value='';$('thBody').value='';$('thCnt').textContent='0 / 500';track('thesis:post');setTimeout(loadTheses,1500);if(window.mpXpCheck)try{window.mpXpCheck();}catch(e){}return;}
      m.className='msg err';var c=(j&&j.error)||'fail';var k='ths_e_'+c;var s=L(k);m.textContent=s===k?L('ths_e_fail',{e:esc(c)}):s;if(c==='login_required'||c==='need_username'){if(window.mpAuth&&window.mpAuth.open)window.mpAuth.open();}
    }).catch(function(){g.disabled=false;m.className='msg err';m.textContent=L('err_net');});});
`.split('\n'));
}
/* 6. the mast reads the rank tile; the old board-driven lines go */
{
  const i = must(find(l => l.indexOf("$('mRank').textContent=sn.rank?") >= 0), 'mRank line');
  lines[i] = "    $('mRankV').innerHTML=sn.rank?'#'+sn.rank+'<small style=\"font:600 11px Space Mono,monospace;color:var(--faint)\"> / '+(sn.n||0)+'</small>':'<span style=\"color:var(--faint)\">-</span>';$('mRankS').innerHTML=sn.rank&&pz[sn.rank-1]>0?L('m_rank_pz',{usd:pz[sn.rank-1]})+' · <a href=\"/leaderboards/#meme\">'+L('b_full')+'</a>':'<a href=\"/leaderboards/#meme\">'+L('b_full')+'</a>';";
  const k = must(find(l => l.indexOf("$('mRank').textContent") >= 0 || l.indexOf("    $('mRank')") >= 0, i + 1) >= 0 ? -2 : 0, 'rank dup'); // -2 = no duplicate (expected)
  if (k === 0) { /* fine */ }
}
{
  const i = must(find(l => l.indexOf('function rerender(){try{renderMast();renderHolds();renderBoard();renderList();renderHist();}catch(e){}}') >= 0), 'rerender');
  lines[i] = '  function rerender(){try{renderMast();renderHolds();renderFeed();renderTheses();renderList();renderHist();}catch(e){}}';
  const j = must(find(l => l.indexOf("renderMast();renderHolds();renderBoard();if(first)loadHist();") >= 0), 'portfolio render');
  lines[j] = lines[j].replace("renderMast();renderHolds();renderBoard();if(first)loadHist();", "renderMast();renderHolds();if(first){loadHist();loadFeed();loadTheses();}");
  const b = must(find(l => l.indexOf("if(!booted){booted=true;loadPortfolio(true);loadMemes();loadMajors();}else loadPortfolio();") >= 0), 'boot');
  // a guest also sees the floor and the theses on the gate? no - the gate is the pitch; the member gets them with the app
  const lb = must(find(l => l === '  loadBoard();'), 'loadBoard call');
  lines[lb] = '  loadBoard();';
}
/* 7. CSS */
{
  const i = must(find(l => l.indexOf('  /* trade sheet */') >= 0), 'css sheet');
  insertAt(i, `  /* the mast is one column now (the claim is a row inside it), four tiles */
  .mast{grid-template-columns:1fr;}
  .tiles{grid-template-columns:repeat(4,minmax(0,1fr));}
  @media(max-width:640px){.tiles{grid-template-columns:1fr 1fr;}}
  .claimrow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding:8px 8px 8px 12px;border:1px dashed var(--line2);border-radius:11px;}
  .claimrow .ck{color:var(--faint);font-size:12px;line-height:1.4;min-width:0;}
  .claimrow .ck b{color:var(--ink);}
  .cbtn{flex:0 0 auto;background:var(--lime);color:#0a0b0d;border:0;border-radius:9px;padding:8px 13px;font:800 12.5px 'Familjen Grotesk',sans-serif;cursor:pointer;white-space:nowrap;}
  .cbtn[disabled]{background:#1b212b;color:var(--dim);border:1px solid var(--line2);cursor:default;}
  /* the floor */
  .livedot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--up);box-shadow:0 0 8px var(--up);margin-right:5px;vertical-align:1px;}
  .hot{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:10px 0 2px;padding-bottom:2px;align-items:center;}
  .hot::-webkit-scrollbar{display:none;}
  .hot .hk{font:700 9.5px 'Space Mono',monospace;letter-spacing:.14em;color:var(--faint);text-transform:uppercase;white-space:nowrap;margin-right:2px;}
  .hchip{display:inline-flex;align-items:center;gap:6px;background:#171c24;border:1px solid var(--line2);border-radius:999px;padding:4px 9px 4px 4px;color:var(--ink);font:700 12px 'Familjen Grotesk',sans-serif;cursor:pointer;white-space:nowrap;}
  .hchip .logo{width:20px;height:20px;flex-basis:20px;}
  .hchip small{font:700 10px 'Space Mono',monospace;color:var(--lime);}
  .frows{margin-top:6px;max-height:420px;overflow:auto;}
  .frow{display:flex;align-items:center;gap:10px;padding:7px 2px;border-top:1px solid var(--line);cursor:pointer;min-width:0;}
  .frow:first-child{border-top:0;}
  .frow .nm{flex:1;min-width:0;}
  .frow .nm b{display:block;font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .frow .nm b a{color:var(--ink);font-weight:800;cursor:pointer;}
  .frow .nm small{display:block;color:var(--faint);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .frow .num{font-family:'Space Mono',monospace;font-size:12px;white-space:nowrap;}
  /* theses */
  .card.theses{margin-top:12px;}
  .thbtn{background:linear-gradient(120deg,var(--viol),#7c5cff);color:#fff;border:0;border-radius:9px;padding:7px 12px;font:800 12px 'Familjen Grotesk',sans-serif;cursor:pointer;}
  .th-lead{color:var(--dim);font-size:13px;line-height:1.55;margin:8px 0 6px;}
  .th-lead b{color:var(--ink);}
  .throws{margin-top:4px;}
  .throw{display:block;padding:10px 2px;border-top:1px solid var(--line);color:var(--ink);text-decoration:none;min-width:0;}
  .throw:first-child{border-top:0;}
  .throw b{display:block;font-family:'Bricolage Grotesque',sans-serif;font-size:15px;letter-spacing:-.01em;line-height:1.25;}
  .throw small{display:block;color:var(--faint);font-size:11.5px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .throw small .au{color:var(--lime);font-weight:700;}
  .throw small em{font-style:normal;font-family:'Space Mono',monospace;color:var(--viol);}
  .throw .ex{display:block;color:var(--dim);font-size:12.5px;line-height:1.5;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  a.more{text-align:center;color:var(--lime);text-decoration:none;}
  .tin,.tta{display:block;width:100%;background:#0a0c10;border:1px solid var(--line2);color:var(--ink);border-radius:11px;padding:10px 12px;font:500 14px 'Familjen Grotesk',sans-serif;outline:none;}
  .tta{resize:vertical;min-height:160px;line-height:1.5;}
  .tin:focus,.tta:focus{border-color:var(--lime);}
  .cnt{font:700 11px 'Space Mono',monospace;color:var(--faint);text-align:right;margin:6px 0 10px;}
  .cnt.ok{color:var(--up);}
`);
}
h = lines.join(N);
fs.writeFileSync(P + '.tmp', h); fs.renameSync(P + '.tmp', P);
console.log('spot page: floor + theses in, board + claim card out');

/* 8. the English strings */
const en = JSON.parse(fs.readFileSync(EN, 'utf8'));
const add = {
  m_rank_k: 'Board', m_rank_pz: '${usd} if it holds',
  c_row: 'Daily top-up · <b>$100</b> of demo cash, once per UTC day. Never counts as profit.',
  f_h: 'The floor', f_s: 'who is buying what, live', f_s2: 'last {n} moves', f_live: 'live', f_hot: 'Hot today', f_bought: 'bought', f_sold: 'sold',
  f_empty: 'Quiet for now - the first buy on the floor shows up here.',
  th_h: 'Theses', th_s: 'why members hold what they hold', th_write: 'Write a thesis', th_more: 'All theses', th_likes: 'likes',
  th_lead: 'Say what you hold, why, and what would prove you wrong. A published thesis pays <b>20 XP</b> and <b>5 Ticks</b> and lands on <a href="/blog/theses/">the blog</a>.',
  th_empty: 'No thesis yet - the first one lands here within a minute of being written.',
  ths_h: 'Write a thesis', ths_s: 'it lands on the blog and in the Community · 20 XP + 5 Ticks', ths_title: 'Title', ths_title_ph: 'Why I hold PEPE into the listing',
  ths_coins: 'Coins (comma separated)', ths_body: 'Thesis', ths_body_ph: 'The setup, the reasoning, the level that would prove you wrong. At least 500 characters - real sentences, not padding.',
  ths_go: 'Publish', ths_publishing: 'Publishing…', ths_ok: 'Published. <b>+{xp} XP</b> and <b>+{ticks} Ticks</b> - it is on the blog and in the Community.', ths_toast: 'Thesis published · +{xp} XP · +{ticks} Ticks',
  ths_e_title: 'The title needs at least 15 characters - a real headline.', ths_e_short: 'A thesis needs at least 500 characters ({n} so far) - the setup, the reasoning, the levels.',
  ths_e_title_short: 'The title needs at least 15 characters.', ths_e_body_short: 'A thesis needs at least 500 characters of real text.', ths_e_title_words: 'The title has to be real words.', ths_e_body_words: 'The thesis has to be readable text - real sentences, not padding.',
  ths_e_slow_down: 'Easy - wait two minutes between posts.', ths_e_daily_cap: 'Daily post limit reached.', ths_e_login_required: 'Sign in to publish.', ths_e_need_username: 'Pick a username first (account menu).', ths_e_fail: 'Could not publish ({e}) - try again.',
};
let n = 0; for (const k of Object.keys(add)) if (en[k] == null) { en[k] = add[k]; n++; }
delete en.b_h; delete en.b_sub; delete en.b_empty; delete en.b_you; delete en.b_you_pz; delete en.b_you_none; delete en.m_rank; delete en.m_norank;
fs.writeFileSync(EN + '.tmp', JSON.stringify(en, null, 2) + '\n'); fs.renameSync(EN + '.tmp', EN);
console.log('en.json +' + n + ' keys, board keys removed');
