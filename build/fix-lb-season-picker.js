/* A SEASON PICKER ON /leaderboards/ (2026-10-12, owner: "da kad gledaju neki leaderboard, imaju negde opciju
   padajuceg menija (odradjen dobro u stilu sajta) gde mogu da biraju sezonu i da vide ishode (npr. izabere
   'season 3' i vidi ko je tad pobedio i koja je bila nagrada").

   WHAT IT SHOWS IS THE PAYMENT RECORD, NOT A RECOMPUTED BOARD. `/api/reward/seasons` is built from the ledger's
   own `lbpay` rows, so every line is money that really left the ledger. Recomputing a finished season from
   today's rules would quietly rewrite history the first time a rule changed - and the rules HAVE changed four
   times (the WR Wilson bound, the 5%-ROE win gate, the Bybit rebate pool, the Green open-season rule). The one
   thing an archive owes a reader is that it does not move.
   The honest cost of that choice is that we never stored the SCORES, only rank and amount, so the archive
   column is the prize. The page says so in one line rather than leaving a reader to wonder.

   The dropdown is a custom control in the page's own idiom (dark panel, lime figure, Space Mono numerals), not
   a native select - the same rule the ops desk follows, and here it also lets each row carry what the season
   paid beside its name.

   The page is hand-made in TWO files whose <style> and script IIFE are byte-identical (EN + the ES twin), so
   every piece is injected into both and the Spanish strings go into the dictionary both already share. The
   script refuses to write unless every anchor is unique in both files. Idempotent; `--dry` to inspect. */
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const FILES = ['dist/leaderboards/index.html', 'dist/es/leaderboards/index.html'];
const MARK = 'sdd-b'; // the picker's own class - its presence means this already ran

const CSS = `
  /* season picker + the archived-results view (2026-10-12) */
  .sbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 0 0}
  .sdd{position:relative}
  .sdd-b{display:inline-flex;align-items:center;gap:9px;background:#11151b;border:1px solid #2b323b;border-radius:10px;padding:8px 12px;color:#e9e7df;font:inherit;font-size:13px;line-height:1;cursor:pointer;transition:border-color .14s,background .14s}
  .sdd-b:hover{border-color:#3d4654;background:#141922}
  .sdd-b .cl{color:#5c656f;font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;font-family:'Space Mono',monospace}
  .sdd-b .cv{font-family:'Space Mono',monospace;font-weight:700;color:#c2f64a}
  .sdd-b .ar{width:10px;height:10px;opacity:.55;transition:transform .16s}
  .sdd.open .sdd-b{border-color:#c2f64a}
  .sdd.open .sdd-b .ar{transform:rotate(180deg)}
  .sdd-p{position:absolute;z-index:60;top:calc(100% + 6px);left:0;min-width:286px;max-height:min(62vh,340px);overflow:auto;overscroll-behavior:contain;background:#0d1014;border:1px solid #2b323b;border-radius:12px;box-shadow:0 26px 60px -18px rgba(0,0,0,.9);padding:6px}
  .sdd-o{display:flex;align-items:baseline;justify-content:space-between;gap:14px;width:100%;background:none;border:0;border-radius:9px;padding:9px 10px;color:#e9e7df;font:inherit;font-size:13px;text-align:left;cursor:pointer}
  .sdd-o:hover{background:#161b22}
  .sdd-o.on{background:#1b2431;color:#c2f64a}
  .sdd-o .sn{font-weight:600}
  .sdd-o .sv{font-family:'Space Mono',monospace;font-size:11.5px;color:#5c656f;white-space:nowrap}
  .sdd-o.on .sv{color:#8aa04f}
  .sdd-o .lv{display:inline-block;margin-left:7px;padding:1px 5px;border-radius:4px;background:#1d2a16;color:#c2f64a;font-family:'Space Mono',monospace;font-size:9.5px;letter-spacing:.08em;vertical-align:1px}
  .snote{margin:0;color:#8b939c;font-size:12.5px;line-height:1.45}
  .snote b{color:#e9e7df}
  .board.arch .btools,.board.arch .you{display:none}
  .board.arch #bTw{max-height:none}
  td.pzc{text-align:right;font-family:'Space Mono',monospace;font-weight:700;color:#c2f64a;white-space:nowrap}
  @media(max-width:620px){.sdd-p{min-width:min(92vw,286px)}}
`;

const MARKUP = `    <div class="sbar" id="sBar" hidden>
      <div class="sdd" id="sDd">
        <button type="button" class="sdd-b" id="sDdB" aria-haspopup="listbox" aria-expanded="false"><span class="cl">Season</span><span class="cv" id="sDdV">&mdash;</span><svg class="ar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
        <div class="sdd-p" id="sDdP" role="listbox" hidden></div>
      </div>
      <p class="snote" id="sNote" hidden></p>
    </div>
`;

const SCRIPT = `
  /* ---- SEASON PICKER (2026-10-12): the live board, or any finished season's payout record ---- */
  var SEASONS=null, SEL=0;
  function sName(s){return s.early?T("beforeSeason1",'Before season 1'):(T("seasonSp",'Season ')+s.n);}
  function sddPaint(){
    var p=$('sDdP');if(!p)return;
    var live=T("liveNow",'live now'), html='<button type="button" class="sdd-o'+(SEL?'':' on')+'" data-s="0" role="option"><span class="sn">'+(T("seasonSp",'Season ')+(LIVE_N||''))+'<span class="lv">'+live+'</span></span><span class="sv">'+T("inProgress",'in progress')+'</span></button>';
    (SEASONS||[]).forEach(function(s){
      html+='<button type="button" class="sdd-o'+(SEL===s.ws?' on':'')+'" data-s="'+s.ws+'" role="option"><span class="sn">'+esc(sName(s))+'</span><span class="sv">$'+int(s.paidUsd)+T("paidToL",' to ')+s.winners+'</span></button>';
    });
    p.innerHTML=html;
    var v=$('sDdV');if(v)v.innerHTML=SEL?esc(sName(selSeason())):(T("seasonSp",'Season ')+(LIVE_N||'')+' <span class="lv">'+T("liveNow",'live now')+'</span>');
  }
  function selSeason(){for(var i=0;i<(SEASONS||[]).length;i++)if(SEASONS[i].ws===SEL)return SEASONS[i];return null;}
  function sddOpen(on){var d=$('sDd'),b=$('sDdB'),p=$('sDdP');if(!d)return;d.classList.toggle('open',!!on);if(p)p.hidden=!on;if(b)b.setAttribute('aria-expanded',on?'true':'false');}
  function setSeason(ws,how){
    SEL=+ws||0;sddPaint();sddOpen(false);
    if(LB)paintBoard();
    try{history.replaceState(null,'','#'+CUR+(SEL?('/s'+SEL):''));}catch(_){ }
    if(how)track('season:'+(SEL||'live'));
  }
  function loadSeasons(){
    fetch('/api/reward/seasons',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){
      if(!j||!j.seasons||!j.seasons.length)return;   /* nothing finished yet - the picker stays hidden rather than offering one empty choice */
      SEASONS=j.seasons;var bar=$('sBar');if(bar)bar.hidden=false;sddPaint();
      var h=(location.hash||'').slice(1),m=/\\/s(\\d+)$/.exec(h);if(m){var w=+m[1];for(var i=0;i<SEASONS.length;i++)if(SEASONS[i].ws===w)setSeason(w);}
    }).catch(function(){});
  }
  /* the archive is the PAYOUT record: rank, who, and what it paid. We never stored the scores, and the note says so. */
  function paintArchive(){
    var s=selSeason(), b=B[CUR], rows=(s&&s.boards&&s.boards[PK[CUR]])||[];
    $('board').className='board arch g-'+b.grp;
    $('bT').innerHTML=esc(b.name)+'<small id="bS">'+T("whatThisBoardPaid",'what this board paid that season')+'</small>';
    $('bPz').innerHTML='';
    $('bHead').innerHTML='<tr><th>#</th><th>'+T("traderTh",'Trader')+'</th><th class="r">'+T("prizeTh",'Prize')+'</th></tr>';
    $('bBody').innerHTML=rows.length
      ? rows.map(function(r){return '<tr class="'+(r.rank<=3?'t'+r.rank:'')+' paid"><td class="rk">'+(r.rank||'-')+'</td><td class="who"><a data-lbu="'+esc(r.who)+'" title="'+esc(r.who)+'">'+esc(r.who)+'</a></td><td class="pzc">$'+r.usd.toFixed(2).replace(/\\.00$/,'')+'</td></tr>';}).join('')
      : '<tr><td class="empty" colspan="3">'+T("thisBoardPaidNothing",'This board paid nothing that season - it was either not running yet or nobody qualified.')+'</td></tr>';
    var tot=rows.reduce(function(a,r){return a+r.usd;},0);
    $('bCount').innerHTML='';
    var nt=$('sNote');
    if(nt){nt.hidden=false;nt.innerHTML='<b>'+esc(sName(s))+'</b> '+(s.ws?(T("ranFromL",'ran ')+dayS(s.ws)+T("toSp",' to ')+dayS(s.we)):'')+' · '+T("paidL",'paid ')+'<b>$'+int(s.paidUsd)+'</b>'+T("acrossEveryBoardL",' across every board, ')+'<b>$'+int(tot)+'</b>'+T("onThisOneL",' on this one. ')+T("paidPlacesFromThePayout",'Paid places, from the payout record - the scores themselves were never stored.');}
    $('bRules').innerHTML=b.rules.map(function(x){return '<li>'+x+'</li>';}).join('');
    try{var tw=$('bTw');if(tw)tw.scrollTop=0;}catch(_){ }
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('#sDdB');
    if(b){e.preventDefault();sddOpen(!$('sDd').classList.contains('open'));return;}
    var o=e.target.closest&&e.target.closest('.sdd-o[data-s]');
    if(o){e.preventDefault();setSeason(o.getAttribute('data-s'),'pick');return;}
    if(!(e.target.closest&&e.target.closest('#sDd')))sddOpen(false);
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape')sddOpen(false);});
`;

let changed = 0;
for (const rel of FILES) {
  const p = path.join(__dirname, '..', rel);
  let h = fs.readFileSync(p, 'utf8');
  if (h.indexOf(MARK) >= 0) { console.log(rel + ': already'); continue; }
  const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';

  const A_CSS = N + '</style>';
  const A_MARK = '    <div class="btools">';
  const A_SCRIPT = '  function setBoard(k,how){';
  const A_PAINT = '  function paintBoard(opts){' + N + '    opts=opts||{};';
  const A_LOAD = 'function load(){fetch(\'/api/reward/lb?full=1\'';
  for (const [a, nm] of [[A_CSS, '</style>'], [A_MARK, '.btools'], [A_SCRIPT, 'setBoard'], [A_PAINT, 'paintBoard'], [A_LOAD, 'load()']]) {
    const n = h.split(a).length - 1;
    if (n !== 1) { console.error(rel + ': anchor ' + nm + ' matched ' + n + ' - refusing'); process.exit(1); }
  }

  h = h.split(A_CSS).join(N + CSS.split('\n').join(N) + N + '</style>');
  h = h.split(A_MARK).join(MARKUP.split('\n').join(N) + A_MARK);
  h = h.split(A_SCRIPT).join(SCRIPT.split('\n').join(N) + N + A_SCRIPT);
  // a past season takes over the whole paint; the live path below is untouched
  h = h.split(A_PAINT).join(A_PAINT + N + '    if(SEL){paintArchive();return;}' + N + '    var _nt=$(\'sNote\');if(_nt)_nt.hidden=true;');
  // LIVE_N is the running season number, derived from the board payload the page already fetches
  h = h.split(A_LOAD).join('var LIVE_N=0;' + N + '  ' + A_LOAD);
  h = h.split('var first=!LB;LB=j;').join('var first=!LB;LB=j;try{LIVE_N=Math.round((j.weekStart-Date.UTC(2026,6,20))/1209600000)+1;}catch(_){ }if(first)loadSeasons();');

  if (h.indexOf('loadSeasons();') < 0) { console.error(rel + ': the loader hook did not land - refusing'); process.exit(1); }
  if (!DRY) fs.writeFileSync(p, h);
  console.log(rel + ': ' + (DRY ? 'would inject' : 'injected') + ' the season picker');
  changed++;
}

// the Spanish strings go into the dictionary BOTH files already share
const ES = {
  seasonSp: 'Temporada ', beforeSeason1: 'Antes de la temporada 1', liveNow: 'en vivo', inProgress: 'en curso',
  paidToL: ' a ', whatThisBoardPaid: 'lo que pagó esta tabla esa temporada', traderTh: 'Trader', prizeTh: 'Premio',
  thisBoardPaidNothing: 'Esta tabla no pagó nada esa temporada: o no existía todavía, o nadie calificó.',
  ranFromL: 'fue del ', toSp: ' al ', paidL: 'pagó ', acrossEveryBoardL: ' en todas las tablas, ',
  onThisOneL: ' en esta. ', paidPlacesFromThePayout: 'Puestos pagados, del registro de pagos: las puntuaciones nunca se guardaron.',
};
for (const rel of FILES) {
  const p = path.join(__dirname, '..', rel);
  let h = fs.readFileSync(p, 'utf8');
  const k = 'var __esD_leaderboardsindex = {';
  if (h.indexOf(k) < 0) { console.error(rel + ': no ES dictionary - refusing'); process.exit(1); }
  // guard on a VALUE, not a key: the injected script itself contains T("beforeSeason1", ...), so keying on the
  // key matched the payload and skipped the dictionary - the Spanish twin would have read English for ever
  if (h.indexOf('Antes de la temporada 1') >= 0) { console.log(rel + ': ES already'); continue; }
  const add = Object.keys(ES).map((x) => JSON.stringify(x) + ':' + JSON.stringify(ES[x])).join(',') + ',';
  h = h.split(k).join(k + add);
  if (!DRY) fs.writeFileSync(p, h);
  console.log(rel + ': ' + (DRY ? 'would add' : 'added') + ' ' + Object.keys(ES).length + ' Spanish strings');
}
console.log(changed ? 'done' : 'nothing to do');
