/* THE SEASON ARCHIVE SHOWS THE SCORES WE KEPT, AND A BOARD OFFERS ONLY THE SEASONS IT EXISTED IN (2026-10-16, owner:
   "leaderboards kad se menja po sezoni, neki ne rade, neki ne prikazuju potpuno a neki nude sezone za taj liderboard
   kad nije ni postojao ... mozemo i wager/volumen i ostale rezultate da prikazemo ako ih imamo i ako ih cuvamo").

   What changes on the page, over the 2026-10-12 picker:
   - the dropdown is filtered PER BOARD from `boardSince` on /api/reward/seasons (a season is offered when the board
     paid in it, or when the board already existed - never "Season 2" on a board born in season 6); a board with no
     finished season hides the picker; switching boards drops a season the new board cannot show;
   - picking a season fetches `/api/reward/seasons?ws=` once and the table becomes the board's OWN columns (ROE, XP,
     points, volume, wagered...) with the prize joined from the payout record by name - a row with a score and no
     prize was not eligible when it was paid, and the note says so;
   - where no durable store kept the scores (win rate / green days / gold room beyond the tradeev window), the table
     stays the payout record with a line saying the scores were not kept;
   - the hash carries the season on a board switch (#moon/s<ws>) and is read back whole on load.

   Both files (EN + ES twin) carry a byte-identical script, so the old picker block is REPLACED whole in both and the
   Spanish strings go into the shared dictionary. Refuses unless every anchor is unique in both files. Idempotent;
   `--dry` to inspect. */
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const FILES = ['dist/leaderboards/index.html', 'dist/es/leaderboards/index.html'];
const MARK = 'function archKept('; // present = this already ran

const SCRIPT = `
  /* ---- SEASON PICKER (2026-10-12; stored scores + per-board seasons 2026-10-16): the live board, or a finished season ---- */
  var SEASONS=null, SEL=0, SINCE={}, SDET={}, LB_ANCHOR_MS=Date.UTC(2026,6,20);
  function sName(s){return s.early?T("beforeSeason1",'Before season 1'):(T("seasonSp",'Season ')+s.n);}
  /* may THIS board offer THAT season? it paid in it, or it already existed (boardSince) - never a season before the board was born */
  function seasonOk(s,k){var pk=PK[k||CUR];if(s.boards&&s.boards[pk])return true;if(s.early)return false;var since=SINCE[pk];return since!=null&&s.ws>=since;}
  function seasonsFor(k){return (SEASONS||[]).filter(function(s){return seasonOk(s,k);});}
  function sddPaint(){
    var p=$('sDdP'),bar=$('sBar');if(!p)return;
    var list=seasonsFor(CUR);
    if(bar)bar.hidden=!list.length;   /* a board with no finished season has nothing to pick */
    var live=T("liveNow",'live now'), html='<button type="button" class="sdd-o'+(SEL?'':' on')+'" data-s="0" role="option"><span class="sn">'+(T("seasonSp",'Season ')+(LIVE_N||''))+'<span class="lv">'+live+'</span></span><span class="sv">'+T("inProgress",'in progress')+'</span></button>';
    list.forEach(function(s){
      var pk=PK[CUR],paid=(s.boards&&s.boards[pk])||[],tot=paid.reduce(function(a,r){return a+r.usd;},0);
      html+='<button type="button" class="sdd-o'+(SEL===s.ws?' on':'')+'" data-s="'+s.ws+'" role="option"><span class="sn">'+esc(sName(s))+'</span><span class="sv">'+(paid.length?'$'+int(tot)+T("paidToL",' to ')+paid.length:T("notPaidL",'not paid'))+'</span></button>';
    });
    p.innerHTML=html;
    var v=$('sDdV');if(v)v.innerHTML=SEL?esc(sName(selSeason())):(T("seasonSp",'Season ')+(LIVE_N||'')+' <span class="lv">'+T("liveNow",'live now')+'</span>');
  }
  function selSeason(){for(var i=0;i<(SEASONS||[]).length;i++)if(SEASONS[i].ws===SEL)return SEASONS[i];return null;}
  function sddOpen(on){var d=$('sDd'),b=$('sDdB'),p=$('sDdP');if(!d)return;d.classList.toggle('open',!!on);if(p)p.hidden=!on;if(b)b.setAttribute('aria-expanded',on?'true':'false');}
  function setSeason(ws,how){
    SEL=+ws||0;if(SEL&&!(selSeason()&&seasonOk(selSeason(),CUR)))SEL=0;
    sddPaint();sddOpen(false);
    if(LB)paintBoard();
    try{history.replaceState(null,'','#'+CUR+(SEL?('/s'+SEL):''));}catch(_){ }
    if(how)track('season:'+(SEL||'live'));
  }
  function loadSeasons(){
    fetch('/api/reward/seasons',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){
      if(!j||!j.seasons||!j.seasons.length)return;   /* nothing finished yet - the picker stays hidden rather than offering one empty choice */
      SEASONS=j.seasons;SINCE=j.boardSince||{};sddPaint();
      /* the hash as it was ON LOAD (window.__lbHash0): the board init has already rewritten location.hash without the season by now */
      var h=String(window.__lbHash0||location.hash||'').replace(/^#/,''),m=/\\/s(\\d+)$/.exec(h);if(m){var w=+m[1];for(var i=0;i<SEASONS.length;i++)if(SEASONS[i].ws===w)setSeason(w);}
    }).catch(function(){});
  }
  /* one season's stored scores, fetched once when it is first picked; the payout record paints at once and the scores repaint on arrival */
  function loadSeasonDetail(ws){
    if(SDET[ws]||SDET['~'+ws])return;SDET['~'+ws]=1;
    fetch('/api/reward/seasons?ws='+ws,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){
      delete SDET['~'+ws];SDET[ws]=(j&&!j.error)?j:{scores:{},kept:{},err:1};if(SEL===ws)paintArchive();
    }).catch(function(){delete SDET['~'+ws];SDET[ws]={scores:{},kept:{},err:1};if(SEL===ws)paintArchive();});
  }
  function archRows(s){var d=SDET[s.ws];return (d&&d.scores&&d.scores[PK[CUR]])||null;}
  function archKept(s){var d=SDET[s.ws];return !!(d&&d.kept&&d.kept[PK[CUR]]);}
  function pzTxt(v){return '$'+(+v).toFixed(2).replace(/\\.00$/,'');}
  /* the archive: the board's OWN columns where a durable store kept the scores, the payout record always */
  function paintArchive(){
    var s=selSeason(), b=B[CUR];if(!s)return;
    var paid=(s.boards&&s.boards[PK[CUR]])||[];
    if(!s.early&&!SDET[s.ws])loadSeasonDetail(s.ws);
    var sc=archRows(s), have=!!(sc&&sc.length), pending=!s.early&&!SDET[s.ws], q=Q.toLowerCase();
    $('board').className='board arch'+(have?' arch-sc':' arch-pz')+' g-'+b.grp;
    $('bT').innerHTML=esc(b.name)+'<small id="bS">'+(have?T("howThisBoardStood",'how this board stood when the season ended'):T("whatThisBoardPaid",'what this board paid that season'))+'</small>';
    $('bPz').innerHTML='';
    var pzOf={};paid.forEach(function(r){pzOf[String(r.who||'').toLowerCase()]=r.usd;});
    var html='';
    if(have){
      var opt=b.head.map(function(h){return /\\|o$/.test(h);}), hd=b.head.map(function(h){return h.replace(/\\|o$/,'');});
      $('bHead').innerHTML='<tr>'+hd.map(function(h,i){var cls=(opt[i]?'o':'')+(i===hd.length-1?' r':'');return '<th'+(cls.trim()?' class="'+cls.trim()+'"':'')+'>'+h+'</th>';}).join('')+'</tr>';
      var shown=q?sc.filter(function(r){return String(r.who||'').toLowerCase().indexOf(q)>=0;}):sc, seen={};
      html=shown.map(function(r){var pz=pzOf[String(r.who||'').toLowerCase()];seen[String(r.who||'').toLowerCase()]=1;
        var cells=b.row(r).map(function(td,i){return opt[i+2]?td.replace(/^<td class="/,'<td class="o ').replace(/^<td>/,'<td class="o">'):td;}).join('');
        var sb=b.sb?'<small class="sb">'+b.sb(r)+'</small>':'';
        return '<tr class="'+(r.rank<=3?'t'+r.rank:'')+(pz>0?' paid':'')+'"><td class="rk">'+r.rank+'</td><td class="who"><a data-lbu="'+esc(r.who)+'" title="'+esc(r.who)+'">'+esc(r.who)+'</a>'+sb+'</td>'+cells+'<td class="prz">'+(pz>0?pzTxt(pz):'')+'</td></tr>';}).join('');
      /* a paid name the score store no longer holds still shows its prize - the payout record is the authority on money */
      if(!q)paid.filter(function(r){return !seen[String(r.who||'').toLowerCase()];}).forEach(function(r){html+='<tr class="paid"><td class="rk">'+(r.rank||'-')+'</td><td class="who"><a data-lbu="'+esc(r.who)+'" title="'+esc(r.who)+'">'+esc(r.who)+'</a></td>'+hd.slice(2,-1).map(function(){return '<td class="v">-</td>';}).join('')+'<td class="prz">'+pzTxt(r.usd)+'</td></tr>';});
      $('bBody').innerHTML=html||('<tr><td class="empty" colspan="6">'+T("noTraderMatches",'No trader on this board matches that name.')+'</td></tr>');
      $('bCount').innerHTML=q?('<b>'+shown.length+'</b>'+T("ofSp"," of ")+'<b>'+sc.length+'</b>'+T("matchL",' match')):('<b>'+sc.length+T("rankedOnThisBoard",'</b> ranked on this board'));
    } else {
      $('bHead').innerHTML='<tr><th>#</th><th>'+T("traderTh",'Trader')+'</th><th class="r">'+T("prizeTh",'Prize')+'</th></tr>';
      var pShown=q?paid.filter(function(r){return String(r.who||'').toLowerCase().indexOf(q)>=0;}):paid;
      $('bBody').innerHTML=pShown.length
        ? pShown.map(function(r){return '<tr class="'+(r.rank<=3?'t'+r.rank:'')+' paid"><td class="rk">'+(r.rank||'-')+'</td><td class="who"><a data-lbu="'+esc(r.who)+'" title="'+esc(r.who)+'">'+esc(r.who)+'</a></td><td class="pzc">'+pzTxt(r.usd)+'</td></tr>';}).join('')
        : '<tr><td class="empty" colspan="3">'+(q?T("noTraderMatches",'No trader on this board matches that name.'):pending?T("loadingScores",'Loading the standings...'):T("thisBoardPaidNothing",'This board paid nothing that season - it was either not running yet or nobody qualified.'))+'</td></tr>';
      $('bCount').innerHTML='';
    }
    var tot=paid.reduce(function(a,r){return a+r.usd;},0);
    var nt=$('sNote');
    if(nt){nt.hidden=false;nt.innerHTML='<b>'+esc(sName(s))+'</b> '+(s.early?T("everythingPaidBeforeThe",'covers everything paid before the 14-day format began'):(T("ranFromL",'ran ')+dayS(s.ws)+T("toSp",' to ')+dayS(s.we)))+' · '+T("paidL",'paid ')+'<b>$'+int(s.paidUsd)+'</b>'+T("acrossEveryBoardL",' across every board, ')+'<b>$'+int(tot)+'</b>'+T("onThisOneL",' on this one. ')
      +(have?T("standingsAtEnd",'Standings as the board stood when the season ended; prizes from the payout record - a row with a score and no prize was not eligible when it was paid.'):pending?'':T("scoresNotKept",'The scores of this season were not kept - paid places, from the payout record.'));}
    $('bRules').innerHTML=b.rules.map(function(x){return '<li>'+x+'</li>';}).join('');
    var meBtn=$('bMe');if(meBtn)meBtn.hidden=true;
    try{var tw=$('bTw');if(tw)tw.scrollTop=0;}catch(_){ }
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('#sDdB');
    if(b){e.preventDefault();sddOpen(!$('sDd').classList.contains('open'));return;}
    var o=e.target.closest&&e.target.closest('.sdd-o[data-s]');
    if(o){e.preventDefault();setSeason(o.getAttribute('data-s'),'pick');return;}
    if(!(e.target.closest&&e.target.closest('#sDd')))sddOpen(false);
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape')sddOpen(false);});`;

const ES = {
  howThisBoardStood: 'cómo quedó esta tabla al cerrar la temporada',
  notPaidL: 'sin pago',
  loadingScores: 'Cargando la clasificación...',
  standingsAtEnd: 'Clasificación tal como quedó al cerrar la temporada; premios del registro de pagos: una fila con puntuación y sin premio no era elegible cuando se pagó.',
  scoresNotKept: 'Las puntuaciones de esta temporada no se conservaron: puestos pagados, del registro de pagos.',
};

let changed = 0;
for (const rel of FILES) {
  const p = path.join(__dirname, '..', rel);
  let h = fs.readFileSync(p, 'utf8');
  if (h.indexOf(MARK) >= 0) { console.log(rel + ': already'); continue; }
  const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const A_START = '  /* ---- SEASON PICKER (2026-10-12): the live board, or any finished season\'s payout record ---- */';
  const A_END = "  document.addEventListener('keydown',function(e){if(e.key==='Escape')sddOpen(false);});";
  const A_SETB = "CUR=k;[].forEach.call(document.querySelectorAll('.tab')";
  const A_HASH = "if(LB)paintBoard();try{history.replaceState(null,'','#'+k);localStorage.setItem('mp_lb_last',k);}catch(_){ }if(how)track('board:'+k);}";
  const A_INIT = "var k=B[h]?h:(B[last]?last:'roe');if(k!=='roe'||h)setBoard(k);";
  const A_CSS = '  .board.arch .btools,.board.arch .you{display:none}' + N + '  .board.arch #bTw{max-height:none}';
  for (const [a, nm] of [[A_START, 'picker start'], [A_END, 'picker end'], [A_SETB, 'setBoard'], [A_HASH, 'setBoard hash'], [A_INIT, 'init hash'], [A_CSS, 'arch css']]) {
    const n = h.split(a).length - 1;
    if (n !== 1) { console.error(rel + ': anchor ' + nm + ' matched ' + n + ' - refusing'); process.exit(1); }
  }
  const i0 = h.indexOf(A_START), i1 = h.indexOf(A_END) + A_END.length;
  if (!(i1 > i0)) { console.error(rel + ': the picker block is inside out - refusing'); process.exit(1); }
  h = h.slice(0, i0) + SCRIPT.split('\n').join(N).replace(/^\r?\n/, '') + h.slice(i1);
  // a board switch keeps a season the new board can show and drops one it cannot; the hash carries both
  h = h.split(A_SETB).join("CUR=k;if(SEL&&!(selSeason()&&seasonOk(selSeason(),k)))SEL=0;sddPaint();[].forEach.call(document.querySelectorAll('.tab')");
  h = h.split(A_HASH).join("if(LB)paintBoard();try{history.replaceState(null,'','#'+k+(SEL?('/s'+SEL):''));localStorage.setItem('mp_lb_last',k);}catch(_){ }if(how)track('board:'+k);}");
  // #moon/s1790553600000 on load: the board is the part before the slash (it used to fail the B[] lookup whole and fall back to the last board)
  h = h.split(A_INIT).join("window.__lbHash0=h;var h0=h.split('/')[0];var k=B[h0]?h0:(B[last]?last:'roe');if(k!=='roe'||h0)setBoard(k);");
  // with real standings the archive keeps the live board's scroll box and find box; the prize-only table stays open
  h = h.split(A_CSS).join('  .board.arch .you{display:none}' + N + '  .board.arch-pz .btools{display:none}' + N + '  .board.arch-pz #bTw{max-height:none}');
  if (!DRY) fs.writeFileSync(p, h);
  console.log(rel + ': ' + (DRY ? 'would replace' : 'replaced') + ' the season picker block');
  changed++;
}
for (const rel of FILES) {
  const p = path.join(__dirname, '..', rel);
  let h = fs.readFileSync(p, 'utf8');
  const k = 'var __esD_leaderboardsindex = {';
  if (h.indexOf(k) < 0) { console.error(rel + ': no ES dictionary - refusing'); process.exit(1); }
  if (h.indexOf(ES.scoresNotKept) >= 0) { console.log(rel + ': ES already'); continue; } // guard on a VALUE, never a key (the script carries the keys)
  const add = Object.keys(ES).map((x) => JSON.stringify(x) + ':' + JSON.stringify(ES[x])).join(',') + ',';
  h = h.split(k).join(k + add);
  if (!DRY) fs.writeFileSync(p, h);
  console.log(rel + ': ' + (DRY ? 'would add' : 'added') + ' ' + Object.keys(ES).length + ' Spanish strings');
}
