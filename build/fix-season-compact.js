#!/usr/bin/env node
/* /season/ COMPACT (2026-10-16, owner: "preglednija i da se dosta manje skrola ... dosta teksta ... da se otvara na klik").
 *
 * MEASURED before (scratchpad/season-measure.js, member): desktop 6,369px = 8.3 screens, phone 9,600px = 11.4 screens.
 * Where it went: the Bybit board table listed every registered member (29 rows, 2,296px), "How MarginPad works"
 * 650px of prose, the nine Bronze tiles 589px (1,200 on a phone), two twelve-row feeds 694px, "How a season
 * works" 230px of prose, the code box 100px of explanation around one input.
 *
 * What this does, every piece behind a click rather than deleted:
 *   - fold engine: a `.sec[data-fold]` carries a `.ftg` toggle in its header and a `.fbody`; `data-fold="closed"` starts
 *     folded, `"member"` starts folded only for a signed-in member (a guest still needs the explanation); the choice is
 *     remembered per section in localStorage `mp_sfold`. A folded section shows a one-line `.fteaser`.
 *   - "How MarginPad works": folded for members (the progress line `#hwYou` stays out), the language picker moves inside.
 *   - "How a season works" -> `#rules`, folded for everyone, in the sticky nav.
 *   - Bronze: nine ROWS instead of nine tiles; banked rows hide behind "N banked".
 *   - the board table: registered-but-unranked Bybit rows beyond the first three hide behind "Show N more".
 *   - the floor: eight rows a feed, the rest behind "Show more".
 *   - the code box: one row (label, input, button); the explanation opens on the "?" beside the label.
 * Idempotent (keys on a VALUE it writes, not a key); refuses unless every anchor is unique. split/join only - a `$`
 * in a replacement is live in String.replace. `--dry` prints the plan and writes nothing.
 */
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, '..', 'dist', 'season', 'index.html');
const dry = process.argv.includes('--dry');
let h = fs.readFileSync(F, 'utf8');
if (h.indexOf('mp_sfold') >= 0) { console.log('fix-season-compact: already applied'); process.exit(0); }
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
let n = 0;
function rep(a, b, what) {
  const c = h.split(a).length - 1;
  if (c !== 1) { console.error('fix-season-compact: anchor x' + c + ' for ' + what + ':\n  ' + a.slice(0, 120)); process.exit(1); }
  h = h.split(a).join(b); n++;
}
const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const TG = (id) => '<button type="button" class="ftg" data-fold="' + id + '" aria-expanded="true"><span class="ftl"></span>' + CHEV + '</button>';

/* ---------- CSS ---------- */
rep('</style>' + N + '<meta property="og:image"',
  '/* COMPACT (2026-10-16): prose behind a click, long lists behind "show more" - see build/fix-season-compact.js */' + N +
  '.ftg{display:inline-flex;align-items:center;gap:7px;background:transparent;border:1px solid var(--line2);color:var(--dim);border-radius:999px;padding:7px 12px;font:700 11px \'Space Mono\',monospace;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;transition:border-color .14s,color .14s;flex:0 0 auto}' + N +
  '.ftg svg{width:12px;height:12px;transition:transform .2s}.ftg:hover{border-color:var(--lime);color:var(--ink)}.sec:not(.fd) .ftg svg{transform:rotate(180deg)}' + N +
  '.sec.fd>.fbody{display:none}.fteaser{display:none;font-size:13px;line-height:1.55;color:var(--dim);max-width:72ch}.sec.fd>.fteaser{display:block}' + N +
  '#howto .fbody .hw-lang{margin:0 0 12px}' + N +
  '.tmore,.fmore{display:flex;justify-content:center;margin-top:8px}.tmore button,.fmore button{background:transparent;border:1px dashed var(--line2);color:var(--dim);border-radius:999px;padding:6px 14px;font:700 11px \'Space Mono\',monospace;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}.tmore button:hover,.fmore button:hover{border-color:var(--lime);color:var(--ink)}' + N +
  '.tbl.cap .tr.capx{display:none}.feed.cap .fr:nth-child(n+9){display:none}#tbanner:empty,#tmore:empty{display:none}#tbanner .bybanner{margin-top:6px;max-width:none}#tbanner .bybanner .r{white-space:normal;text-align:right;min-width:0}' + N + /* outside the scroll box a nowrap figure row (461px on a 390px phone) would widen the PAGE */
  '/* Bronze as rows: a to-do list is a list (the tiles were 589px on a desktop and 1,200px on a phone) */' + N +
  '#bronze .bz-grid{grid-template-columns:1fr;grid-auto-rows:auto;gap:6px}' + N +
  '#bronze .bz-t{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-rows:auto auto;align-items:center;column-gap:12px;row-gap:1px;padding:8px 13px;height:auto}' + N +
  '#bronze .bz-x{grid-column:1;grid-row:1/3;margin:0;align-self:center}#bronze .bz-h{grid-column:2;grid-row:1;margin:0;font-size:13.5px;line-height:1.3}#bronze .bz-d{grid-column:2;grid-row:2;font-size:12px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' + N +
  '#bronze .bz-a{grid-column:3;grid-row:1/3;margin:0;padding:0;align-self:center}#bronze .bz-t:hover{transform:none;border-color:var(--lime)}' + N +
  '#bronze .bz-t.got{display:none}#bronze.showgot .bz-t.got{display:grid}#bronze .bz-got{margin-top:8px}' + N +
  '/* desktop: ONE line per task - badge, title, what it is (ellipsis), action. Two-line rows measured 637px, taller than the tiles. */' + N +
  '@media(min-width:721px){#bronze .bz-t{grid-template-columns:auto auto minmax(0,1fr) auto;grid-template-rows:auto;padding:7px 13px}#bronze .bz-x{grid-row:1}#bronze .bz-h{grid-column:2;grid-row:1;white-space:nowrap}#bronze .bz-d{grid-column:3;grid-row:1;color:var(--faint)}#bronze .bz-a{grid-column:4;grid-row:1}}' + N +
  '@media(max-width:720px){#bronze .bz-t{grid-template-columns:auto minmax(0,1fr) auto;padding:8px 11px}#bronze .bz-d{white-space:normal}#bronze .bz-a span{display:none}}' + N +
  '/* the code box: one row */' + N +
  '.redeem{grid-template-columns:auto minmax(0,1fr);align-items:center;padding:10px 14px}.redeem .code{max-width:420px;justify-self:end;width:100%}.redeem .k{white-space:nowrap}.redeem .rq{margin-left:8px;width:18px;height:18px;border-radius:50%;border:1px solid var(--line2);background:transparent;color:var(--dim);font:700 11px \'Space Mono\',monospace;cursor:pointer;vertical-align:middle}.redeem .rq:hover{border-color:var(--lime);color:var(--ink)}.redeem .rsub{grid-column:1/-1;margin-top:2px}.redeem .rsub[hidden]{display:none}' + N +
  '@media(max-width:640px){.redeem{grid-template-columns:1fr}.redeem .code{max-width:none;justify-self:stretch}}' + N +
  '</style>' + N + '<meta property="og:image"', 'css');

/* ---------- How MarginPad works: toggle in the header, picker + prose in the body, a teaser when folded ---------- */
rep('<section class="sec" id="howto">' + N + '<div class="sh">' + N + '<div><span class="eb" data-hw="eb">Start here</span><h2 data-hw="h2">How MarginPad works</h2></div>' + N + '<div class="hw-lang" id="hwLang"><span data-hw="langLabel">Read this in</span></div>' + N + '</div>' + N,
  '<section class="sec" id="howto" data-fold="member">' + N + '<div class="sh">' + N + '<div><span class="eb" data-hw="eb">Start here</span><h2 data-hw="h2">How MarginPad works</h2></div>' + N + TG('howto') + N + '</div>' + N +
  '<div class="fteaser">Bronze (500 XP) opens the money, the Academy is the fastest way there, and your first closed trade already puts you on the boards.</div>' + N, 'howto head');
rep('<div class="lead hw-lead" data-hw="lead" style="margin-bottom:12px">Four things, and only the first one is a gate.</div>' + N + '<div class="hw-you" id="hwYou">',
  '<div class="hw-you" id="hwYou">', 'howto lead out');
rep('<div class="hw-bar" id="hwBar" hidden><i style="width:0"></i></div></div>' + N + '<ol class="hw-steps">',
  '<div class="hw-bar" id="hwBar" hidden><i style="width:0"></i></div></div>' + N + '<div class="fbody">' + N + '<div class="hw-lang" id="hwLang"><span data-hw="langLabel">Read this in</span></div>' + N +
  '<div class="lead hw-lead" data-hw="lead" style="margin-bottom:12px">Four things, and only the first one is a gate.</div>' + N + '<ol class="hw-steps">', 'howto body open');
rep('<div class="hw-rules" data-hw="rules">One account per person. Prizes land on your rewards balance and can be withdrawn. The paper boards are scored server-side from trades you actually closed.</div>' + N + '</section>',
  '<div class="hw-rules" data-hw="rules">One account per person. Prizes land on your rewards balance and can be withdrawn. The paper boards are scored server-side from trades you actually closed.</div>' + N + '</div>' + N + '</section>', 'howto body close');

/* ---------- Bronze: the lead sentence goes, the banked rows get a toggle ---------- */
rep('<div class="lead" style="margin-bottom:2px">These nine are worth 400 XP together. Tap one to go and do it; when it is finished, tap it again to bank the XP.</div>' + N + '<div class="bz-grid" id="bzGrid"></div>',
  '<div class="bz-grid" id="bzGrid"></div>' + N + '<div class="bz-got" id="bzGot" hidden></div>', 'bronze grid');

/* ---------- nav: the rules section is reachable ---------- */
rep('<a href="#floor" data-s="floor">Live floor</a>' + N + '  </nav>',
  '<a href="#floor" data-s="floor">Live floor</a><a href="#rules" data-s="rules">Rules</a>' + N + '  </nav>', 'nav');
rep("['today','pass','boards','floor'].forEach(function(id){var el=$(id);if(el)io.observe(el);});",
  "['today','pass','boards','floor','rules'].forEach(function(id){var el=$(id);if(el)io.observe(el);});", 'nav io');

/* ---------- the code box: one row ---------- */
rep('<div class="redeem" id="redeem">' + N + '      <div><div class="k">Have a code?</div><div class="sub">Every MarginPad code goes here: the pro pass, money on your balance, Premium days or Ticks. They drop in chat, on Telegram and in events. One use per account.</div></div>',
  '<div class="redeem" id="redeem">' + N + '      <div class="k">Have a code?<button type="button" class="rq" id="rq" aria-label="What codes are" aria-expanded="false">?</button></div>', 'redeem head');
rep('<div class="sub" id="codeMsg"></div>' + N + '    </div>' + N + '  </section>',
  '<div class="sub rsub" id="rsub" hidden>Every MarginPad code goes here: the pro pass, money on your balance, Premium days or Ticks. They drop in chat, on Telegram and in events. One use per account.</div>' + N + '      <div class="sub" id="codeMsg"></div>' + N + '    </div>' + N + '  </section>', 'redeem sub');

/* ---------- the rules, folded ---------- */
rep('<section class="sec">' + N + '    <div class="sh"><div><span class="eb">The rules, in short</span><h2>How a season works</h2></div></div>' + N + '    <div class="how">',
  '<section class="sec" id="rules" data-fold="closed">' + N + '    <div class="sh"><div><span class="eb">The rules, in short</span><h2>How a season works</h2></div>' + TG('rules') + '</div>' + N +
  '    <div class="fteaser">Fourteen days on one clock, nothing costs money to enter, everything is counted server-side, and prize money only moves one way - from the boards to your rewards balance.</div>' + N +
  '    <div class="fbody"><div class="how">', 'rules head');
rep('from the boards to your rewards balance.</div>' + N + '    </div>' + N + '  </section>' + N + '</div>' + N + '<div class="tst"',
  'from the boards to your rewards balance.</div>' + N + '    </div></div>' + N + '  </section>' + N + '</div>' + N + '<div class="tst"', 'rules close');

/* ---------- JS: fold engine + the "?" on the code box, inside the page IIFE after the clock ---------- */
rep('  setInterval(tickClock,1000);' + N,
  '  setInterval(tickClock,1000);' + N +
  '  /* ---- fold engine (2026-10-16): prose opens on a click and the choice is remembered per section ---- */' + N +
  "  (function(){var KEY='mp_sfold';var st={};try{st=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){}" + N +
  "    var signed=/(^|; )mp_li=1/.test(document.cookie);" + N +
  "    function lab(sec){var fd=sec.classList.contains('fd'),b=sec.querySelector('.ftg');if(!b)return;b.setAttribute('aria-expanded',String(!fd));var l=b.querySelector('.ftl');if(l)l.textContent=fd?__esT_seasonindex('foldOpen','Read'):__esT_seasonindex('foldClose','Hide');}" + N +
  "    [].forEach.call(document.querySelectorAll('.sec[data-fold]'),function(sec){var d=sec.getAttribute('data-fold'),want=st[sec.id]!=null?st[sec.id]:(d==='member'?(signed?'closed':'open'):d);sec.classList.toggle('fd',want==='closed');lab(sec);});" + N +
  "    document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.ftg[data-fold]');if(!b)return;var sec=$(b.getAttribute('data-fold'));if(!sec)return;sec.classList.toggle('fd');lab(sec);st[sec.id]=sec.classList.contains('fd')?'closed':'open';try{localStorage.setItem(KEY,JSON.stringify(st));}catch(x){}" + N +
  "      try{fetch('/api/track?t=lb&e=fold:'+sec.id+':'+st[sec.id]+'&p='+encodeURIComponent(location.pathname),{keepalive:true});}catch(x){}});" + N +
  "    /* a hash that names a folded section opens it - a link into #rules must show the rules */" + N +
  "    function openHash(){var id=(location.hash||'').slice(1),sec=id&&$(id);if(sec&&sec.classList.contains('fd')&&sec.hasAttribute('data-fold')){sec.classList.remove('fd');lab(sec);}}openHash();window.addEventListener('hashchange',openHash);" + N +
  "    var rq=$('rq'),rs=$('rsub');if(rq&&rs)rq.addEventListener('click',function(){rs.hidden=!rs.hidden;rq.setAttribute('aria-expanded',String(!rs.hidden));});" + N +
  '  })();' + N, 'fold engine');

/* ---------- the board table: the banner and the "more" button live OUTSIDE the scroll box ----------
 * They were rendered inside #tbl, which is `width:max-content` inside the horizontally scrolling .tw: on a 390px phone the
 * orange Bybit banner was 6px wider than the box (clipped on the right at rest, its left half gone once the table was
 * scrolled - owner 2026-10-16: "jedan deo isecen kad se skrola u desno ... narandzasti okvir") and the "Show more" button sat
 * at the centre of a 440px table, i.e. off to the right. Both sit in their own elements now and never scroll. */
rep('<div class="tw" id="tw"><div class="tbl" id="tbl"><div class="empty">Loading…</div></div></div>',
  '<div id="tbanner"></div>' + N + '      <div class="tw" id="tw"><div class="tbl" id="tbl"><div class="empty">Loading…</div></div></div>' + N + '      <div id="tmore"></div>', 'table shell');
rep("    $('tbl').innerHTML=banner+head+body;" + N,
  "    $('tbanner').innerHTML=banner;$('tbl').innerHTML=head+body;" + N, 'table render split');
/* ---------- registered rows beyond three hide behind "Show N more" ---------- */
rep("    if(curBoard==='bybit'&&regRows.length)body+=regRows.map(function(r,i){var isMe=String(r.who||'').toLowerCase()===nm;return '<div class=\"tr reg'+(isMe?' me':'')+'\"",
  "    var capN=0;if(curBoard==='bybit'&&regRows.length)body+=regRows.map(function(r,i){var isMe=String(r.who||'').toLowerCase()===nm;var cx=i>=3&&!isMe&&!tblOpen;if(cx)capN++;return '<div class=\"tr reg'+(isMe?' me':'')+(cx?' capx':'')+'\"", 'table cap rows');
rep("    $('tbanner').innerHTML=banner;$('tbl').innerHTML=head+body;" + N,
  "    $('tbanner').innerHTML=banner;$('tbl').innerHTML=head+body;$('tmore').innerHTML=capN?'<div class=\"tmore\"><button type=\"button\" data-tmore>'+__esT_seasonindex('showMore','Show ')+capN+__esT_seasonindex('moreRegistered',' more registered')+'</button></div>':'';$('tbl').classList.toggle('cap',capN>0);" + N, 'table cap render');
rep("  $('bsw').addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-board]');if(!t)return;switchBoard(t.getAttribute('data-board'));});",
  "  $('bsw').addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-board]');if(!t)return;switchBoard(t.getAttribute('data-board'));});" + N +
  "  var tblOpen=false;$('tmore').addEventListener('click',function(e){if(!(e.target.closest&&e.target.closest('[data-tmore]')))return;tblOpen=true;paintBoards();}); /* the whole list on request; a board switch keeps it open for the session */", 'table cap toggle');

/* ---------- the floor: eight rows a feed, the rest on request ---------- */
rep("    if(closes){$('closeFeed').innerHTML=closes.length?closes.slice(0,20)",
  "    if(closes){$('closeFeed').classList.toggle('cap',closes.length>8&&!feedOpen.c);$('closeFeed').innerHTML=closes.length?closes.slice(0,20)", 'floor closes cap');
rep("    if(duels){$('duelFeed').innerHTML=duels.length?duels.slice(0,12)",
  "    if(duels){$('duelFeed').classList.toggle('cap',duels.length>8&&!feedOpen.d);$('duelFeed').innerHTML=duels.length?duels.slice(0,12)", 'floor duels cap');
rep('  function paintFeeds(closes,duels){' + N,
  "  var feedOpen={c:false,d:false};" + N +
  "  function feedMore(id,k,n){var f=$(id);if(!f)return;var old=f.parentNode.querySelector('.fmore');if(old)old.remove();if(n>8&&!feedOpen[k]){var d=document.createElement('div');d.className='fmore';d.innerHTML='<button type=\"button\">'+__esT_seasonindex('showMore','Show ')+(n-8)+__esT_seasonindex('moreRows',' more')+'</button>';d.firstChild.addEventListener('click',function(){feedOpen[k]=true;f.classList.remove('cap');d.remove();});f.parentNode.appendChild(d);}}" + N +
  '  function paintFeeds(closes,duels){' + N +
  "    if(closes)feedMore('closeFeed','c',Math.min(20,closes.length));if(duels)feedMore('duelFeed','d',Math.min(12,duels.length));" + N, 'floor more');

/* ---------- Bronze: banked rows behind a line ---------- */
rep("    sec.hidden = false;" + N + "    /* the owner's Windows has animation effects off",
  "    sec.hidden = false;" + N +
  "    var gotEl = document.getElementById('bzGot');" + N +
  "    if (gotEl) { gotEl.hidden = !got; if (got) { gotEl.innerHTML = '<button type=\"button\" class=\"ftg\">' + got + __esT_seasonindex('bzBankedN', ' banked') + ' \\u00b7 <span>' + (sec.classList.contains('showgot') ? __esT_seasonindex('foldClose', 'Hide') : __esT_seasonindex('foldOpen', 'Show')) + '</span></button>'; } }" + N +
  "    /* the owner's Windows has animation effects off", 'bronze got');
rep("  grid.addEventListener('click', function (e) {" + N + "    var b = e.target.closest ? e.target.closest('.bz-t') : null; if (!b || busy) return;",
  "  var gotBtn = document.getElementById('bzGot'); if (gotBtn) gotBtn.addEventListener('click', function () { sec.classList.toggle('showgot'); if (D) paint(D); });" + N +
  "  grid.addEventListener('click', function (e) {" + N + "    var b = e.target.closest ? e.target.closest('.bz-t') : null; if (!b || busy) return;", 'bronze got click');

/* ---------- Spanish for the new inline strings (merged into the page's own dictionary) ---------- */
rep('var __esD_seasonindex = {"registeredPh":"registrado",',
  'var __esD_seasonindex = {"foldOpen":"Leer","foldClose":"Ocultar","showMore":"Mostrar ","moreRegistered":" registrados más","moreRows":" más","bzBankedN":" cobradas","registeredPh":"registrado",', 'es dict');

if (dry) { console.log('fix-season-compact: ' + n + ' edits would be written'); process.exit(0); }
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('fix-season-compact: ' + n + ' edits written');
