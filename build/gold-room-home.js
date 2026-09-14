/* THE GOLD ROOM on the bento homepage + the BOARD RAIL (2026-09-05).
   Run against dist/demo-home/index.html (the homepage source of truth), then `node build/gen-home-live.js`.
   Idempotent: it refuses to run twice (the Gold Room marker aborts it), and every anchor must match EXACTLY once -
   a drifted anchor throws before anything is written, so a half-applied file is impossible.

   WHY THE RAIL: both leaderboard pickers were flex rows of `flex:1` chips with non-wrapping labels, so each new
   board made the CARD wider instead of scrolling. The 5th board pushed the strip off the right edge of a 360-390px
   phone (owner report). Both are now one snap-scrolling rail: chips size to their content, edge fades show there is
   more, a hairline tracks the scroll position, and choosing a chip scrolls it into view. A 6th board costs nothing.  */
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, '..', 'dist', 'demo-home', 'index.html');
let s = fs.readFileSync(F, 'utf8');
const n0 = s.length;
if (s.indexOf('data-pz="gold"') >= 0) { console.log('gold-room-home: already applied - nothing to do.'); process.exit(0); }
let n = 0;
// The replacement MUST go through a function. These strings contain JS source with `$'` in them (e.g.
// `'<div class="lbpz-pool">$'+b.pool`), and in String.replace a bare `$'` means "everything after the match" -
// it silently pasted the rest of the document into the file and produced a second </html>. A function replacer
// is taken literally.
const rep = (old, nu, label) => {
  const c = s.split(old).length - 1;
  if (c !== 1) throw new Error('anchor "' + label + '" matched ' + c + ' times (expected 1)');
  s = s.replace(old, () => nu); n++;
};

/* ---------- 1) the board itself: catalogue entry for the prize panel ---------- */
const XP_ENTRY = s.match(/ {6}xp:\{name:'Season XP'[^\n]*\n/);
if (!XP_ENTRY) throw new Error('PZ Season XP entry not found');
const xpLine = XP_ENTRY[0].replace(/\}\s*$/, '},\n'); // it was the LAST entry, so it carries no trailing comma
rep(XP_ENTRY[0], xpLine.replace(/\n$/, '\n') +
  "      gold:{name:'The Gold Room',pool:0,p:[],live:true,gold:true,desc:\"Gold members only. The most WINNING trades of the 14-day season takes it - every closed ticket that finished in profit counts as one win. The same rules the win-rate board is paid on apply, so tiny scalps do not pad it: a win must clear +5% ROE on a real 0.2% price move, on at least $1 of margin, server-settled, and partial closes of one position count once. Reach Gold (12,000 XP) to enter.\"}\n",
  'PZ gold entry');

/* ---------- 2) prize panel: no prize rows, a TITLE pool and an honest footer while it runs unpaid ---------- */
rep("var badge=b.live?'<span class=\"lbpz-livebadge\">● Live now</span>':'<span class=\"lbpz-lockbadge\"> Next season</span>';",
  "var badge=b.live?'<span class=\"lbpz-livebadge\">● Live now</span>':'<span class=\"lbpz-lockbadge\"> Next season</span>';\n      if(b.gold&&!b.p.length){rows='<div class=\"lbpz-row p1\"><span class=\"m\">!</span><span class=\"l\">No prizes this season</span><span class=\"v\">$0</span></div>';}",
  'gold prize rows');
rep("var foot=b.live?('Running this season · pays out at season end (00:00 UTC) · <b>'+ctd()+'</b>'):('Unlocks next season · <b>'+ctd()+'</b>');",
  "var foot=b.live?('Running this season · pays out at season end (00:00 UTC) · <b>'+ctd()+'</b>'):('Unlocks next season · <b>'+ctd()+'</b>');\n      if(b.gold&&!b.p.length)foot='This season runs for the title only - <b>prize money starts next season</b> · <b>'+ctd()+'</b>';",
  'gold footer');
rep("+'<div class=\"lbpz-pool\">$'+b.pool+'<small>season prize pool</small></div>'",
  "+(b.gold&&!b.p.length?'<div class=\"lbpz-pool\">TITLE<small>no prize pool this season</small></div>':'<div class=\"lbpz-pool\">$'+b.pool+'<small>season prize pool</small></div>')",
  'gold pool label');

/* ---------- 3) the rail: CSS ---------- */
const CSS = `
/* ===== board rail: one snap-scrolling picker, used by BOTH leaderboard widgets (2026-09-05) ===== */
.mprail{position:relative;--railbg:#0d1014}
.mprail-s{display:flex;gap:7px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;scroll-behavior:smooth;scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;padding:4px;margin:0;scroll-padding:0 4px}
.mprail-s::-webkit-scrollbar{display:none}
.mprail-s>*{flex:0 0 auto;scroll-snap-align:start}
.mprail-f{position:absolute;top:0;bottom:7px;width:38px;pointer-events:none;z-index:3;opacity:0;transition:opacity .22s}
.mprail-f.l{left:0;background:linear-gradient(90deg,var(--railbg),rgba(0,0,0,0))}
.mprail-f.r{right:0;background:linear-gradient(270deg,var(--railbg),rgba(0,0,0,0))}
.mprail.can-l .mprail-f.l,.mprail.can-r .mprail-f.r{opacity:1}
.mprail-bar{height:2px;border-radius:2px;background:rgba(255,255,255,.07);margin:5px 4px 0;overflow:hidden}
.mprail-bar i{display:block;height:100%;width:30%;border-radius:2px;background:currentColor;opacity:.5;transition:transform .12s linear,width .2s}
.mprail.full .mprail-bar{visibility:hidden}
.lbpz-tabs{display:flex;gap:7px;background:rgba(0,0,0,.28);border:1px solid rgba(255,215,90,.16);border-radius:12px;padding:4px}
.lbpz-tab{flex:0 0 auto;min-width:96px;display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:8px 12px;border:none;border-radius:9px;background:rgba(255,255,255,.03);color:#b9a86a;font:700 10.5px/1.15 'Space Mono',ui-monospace,monospace;letter-spacing:.02em;text-transform:uppercase;cursor:pointer;transition:.16s;white-space:nowrap;text-align:left}
.lbpz-tab .pz{font:700 13px/1 'Space Mono',ui-monospace,monospace;color:#ffd75a;letter-spacing:0}
.lbpz-tab.on{background:linear-gradient(180deg,#ffdf7a,#ffc13c);color:#2a1e00;box-shadow:0 4px 14px -6px rgba(255,215,90,.75)}
.lbpz-tab.on .pz{color:#3a2a00}
.mprail.pz-rail{color:#ffd75a;--railbg:#121016}
.lb-tabs{display:flex;gap:8px;margin:0}
.lb-tab{flex:0 0 auto;padding:8px 13px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);color:#95a1b0;font:700 11px/1 'Space Mono',ui-monospace,monospace;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;transition:.15s;white-space:nowrap}
.mprail.lb-rail{color:#c2f64a;--railbg:#0e1116;margin:12px 0 6px}
@media(max-width:560px){.lbpz-tab{min-width:88px;padding:8px 10px}.lb-tab{padding:8px 11px;font-size:10.5px}}
`;
rep('.lbpz{margin-top:15px;}', '.lbpz{margin-top:15px;}' + CSS, 'rail css');

/* ---------- 4) prize picker -> rail, chips carry what the board pays ---------- */
const OLD_TABS = s.match(/<div class="lbpz-tabs" id="lbpzTabs">[\s\S]*?<\/div>/);
if (!OLD_TABS) throw new Error('prize tab strip not found');
rep(OLD_TABS[0], `<div class="mprail pz-rail" data-rail><span class="mprail-f l"></span><span class="mprail-f r"></span>
          <div class="lbpz-tabs mprail-s" id="lbpzTabs">
            <button type="button" class="lbpz-tab on" data-pz="roe">Green days<span class="pz" data-pzv="roe">$25</span></button>
            <button type="button" class="lbpz-tab" data-pz="roe2">Highest ROE<span class="pz" data-pzv="roe2">$30</span></button>
            <button type="button" class="lbpz-tab" data-pz="wr">Win rate<span class="pz" data-pzv="wr">$67</span></button>
            <button type="button" class="lbpz-tab" data-pz="xp">Season XP<span class="pz" data-pzv="xp">$30</span></button>
            <button type="button" class="lbpz-tab" data-pz="gold">Gold Room<span class="pz" data-pzv="gold">TITLE</span></button>
          </div><div class="mprail-bar"><i></i></div>
        </div>`, 'prize tab strip');

rep("tabs.addEventListener('click',function(e){var t=e.target.closest('.lbpz-tab');if(!t)return;cur=t.getAttribute('data-pz');",
  "tabs.addEventListener('click',function(e){var t=e.target.closest('.lbpz-tab');if(!t)return;cur=t.getAttribute('data-pz');if(window.mpRailShow)window.mpRailShow(t);",
  'prize tab click');

rep("window.mpLbpzSetPrizes=function(bp){if(!bp)return;setArr('roe',bp.green||bp.roe);setArr('roe2',bp.roe);setArr('wr',bp.wr);setArr('xp',bp.xp);render();};",
  "window.mpLbpzSetPrizes=function(bp){if(!bp)return;setArr('roe',bp.green||bp.roe);setArr('roe2',bp.roe);setArr('wr',bp.wr);setArr('xp',bp.xp);setArr('gold',bp.gold);"
  + "try{for(var k in PZ){var c=document.querySelector('[data-pzv=\"'+k+'\"]');if(c)c.textContent=(PZ[k].gold&&!PZ[k].p.length)?'TITLE':('$'+PZ[k].pool);}}catch(e){}render();};",
  'prize sync');

/* ---------- 5) live board picker -> rail + the Gold Room chip ---------- */
const OLD_LB = s.match(/<div class="lb-tabs">[\s\S]*?<\/div>/);
if (!OLD_LB) throw new Error('live board tab strip not found');
rep(OLD_LB[0], '<div class="mprail lb-rail" data-rail><span class="mprail-f l"></span><span class="mprail-f r"></span>'
  + OLD_LB[0].replace('class="lb-tabs"', 'class="lb-tabs mprail-s"').replace('<button type="button" class="lb-tab lb-tab-f" data-lbm="following">', '<button type="button" class="lb-tab" data-lbm="gold">Gold Room</button><button type="button" class="lb-tab lb-tab-f" data-lbm="following">')
  + '<div class="mprail-bar"><i></i></div></div>', 'live board tab strip');

rep("document.querySelectorAll('[data-lbm]').forEach(function(b){b.addEventListener('click',function(){lbMode=b.getAttribute('data-lbm');",
  "document.querySelectorAll('[data-lbm]').forEach(function(b){b.addEventListener('click',function(){lbMode=b.getAttribute('data-lbm');if(window.mpRailShow)window.mpRailShow(b);",
  'live tab click');

rep("note.innerHTML='<b>'+(lbMode==='green'?'Green days':lbMode==='roe'?'Top ROE':lbMode==='xp'?'Top XP':'Best win rate')+'</b> pays the top 5 in real USDT every 14-day season - climb it.'",
  "note.innerHTML=(lbMode==='gold'?'<b>The Gold Room</b> - Gold members only, ranked by winning trades. This season runs for the title; <b>prize money starts next season</b>.':'<b>'+(lbMode==='green'?'Green days':lbMode==='roe'?'Top ROE':lbMode==='xp'?'Top XP':'Best win rate')+'</b> pays the top 5 in real USDT every 14-day season - climb it.')",
  'live board note');

rep('    var st=((d&&d.topGreen)||[]).slice(0,15);',
  "    if(lbMode==='gold'){\n"
  + "      var gt=((d&&d.topGold)||[]).slice(0,15);\n"
  + "      el.innerHTML=gt.length?gt.map(function(t,i){return lbRow(i,t.who,((+t.l||0)+'L'),(+t.w||0)+((+t.w||0)===1?' win':' wins'),'up');}).join('')\n"
  + "        :'<div class=\"lb-empty\">No Gold member has a qualifying win yet this season. Reach Gold (12,000 XP) to enter the room.</div>';\n"
  + '      lbAfter(el);return;\n'
  + '    }\n'
  + '    var st=((d&&d.topGreen)||[]).slice(0,15);', 'live gold branch');

/* ---------- 6) rail behaviour ---------- */
const RAIL_JS = `  /* Board rail: edge fades, a position hairline, and "scroll the chosen chip into view". Every selection path
     (pointer, keyboard, programmatic) goes through window.mpRailShow. A rail with nothing to scroll hides its bar. */
  (function(){
    if(window.mpRailShow)return;
    function sync(r){
      var s=r.querySelector('.mprail-s');if(!s)return;
      var max=s.scrollWidth-s.clientWidth;
      r.classList.toggle('full',max<=2);
      r.classList.toggle('can-l',s.scrollLeft>4);
      r.classList.toggle('can-r',s.scrollLeft<max-4);
      var bar=r.querySelector('.mprail-bar i');
      if(bar&&max>2){var vis=Math.max(14,Math.min(100,s.clientWidth/s.scrollWidth*100));bar.style.width=vis+'%';bar.style.transform='translateX('+(s.scrollLeft/max*(100/vis*100-100))+'%)';}
    }
    function wire(r){
      var s=r.querySelector('.mprail-s');if(!s||s.__railed)return;s.__railed=1;
      s.addEventListener('scroll',function(){sync(r);},{passive:true});
      window.addEventListener('resize',function(){sync(r);});
      sync(r);setTimeout(function(){sync(r);},400);
    }
    window.mpRailShow=function(el){
      try{
        var s=el&&el.closest?el.closest('.mprail-s'):null;if(!s)return;
        var er=el.getBoundingClientRect(),sr=s.getBoundingClientRect();
        if(er.left<sr.left+6)s.scrollLeft-=(sr.left+6-er.left);
        else if(er.right>sr.right-6)s.scrollLeft+=(er.right-(sr.right-6));
      }catch(e){}
    };
    function init(){document.querySelectorAll('[data-rail]').forEach(wire);}
    if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
    setTimeout(init,1200);
  })();
`;
rep('  function lbEsc(x)', RAIL_JS + '  function lbEsc(x)', 'rail js');

/* ---------- 7) copy: five boards, and the Gold Room does NOT pay this season ---------- */
rep('4 boards · win real USDT', '5 boards · win real USDT', 'eyebrow');
rep('Four boards, bigger prizes', 'Five boards, bigger prizes', 'panel heading');
rep('Four boards - Green days, Highest ROE, Win rate and Season XP - each pays the top 5 in real USDT every 14-day season.', 'Green days, Highest ROE, Win rate and Season XP each pay the top 5 in real USDT every 14-day season. The Gold Room is for Gold members only and runs for the title this season.', 'boards sentence');
rep('Four season boards - <b>Green days</b>, <b>Highest ROE</b>, <b>Best win rate</b> and <b>Season XP</b> - each pays the <b>top 5</b> in real USDT when the 14-day season ends. Pick your game:',
  '<b>Green days</b>, <b>Highest ROE</b>, <b>Best win rate</b> and <b>Season XP</b> each pay the <b>top 5</b> in real USDT when the 14-day season ends. The new <b>Gold Room</b> is for Gold members only and runs for the title this season - prize money starts next season. Pick your game:',
  'intro copy');

/* ---------- write + validate ---------- */
const tmp = F + '.tmp';
fs.writeFileSync(tmp, Buffer.from(s, 'utf8'));
fs.renameSync(tmp, F);

const h = fs.readFileSync(F, 'utf8');
const closes = h.split('</html>').length - 1;
if (closes !== 1) throw new Error('document is malformed: ' + closes + ' </html> tags');
const pz = h.match(/var PZ=\{[\s\S]*?\n    \};/); if (!pz) throw new Error('PZ block lost');
const boards = Object.keys(eval('(' + pz[0].replace(/^var PZ=/, '').replace(/;$/, '') + ')'));
for (const [re, label] of [[/function lbRender\(\)\{[\s\S]*?\n  \}/, 'lbRender'], [/function render\(\)\{[\s\S]*?\n    \}/, 'render']]) {
  const m = h.match(re); if (!m) throw new Error('function lost: ' + label);
  new Function(m[0] + ';return true;');
}
console.log('gold-room-home: ' + n + ' edits, ' + (h.length - n0) + ' bytes; PZ boards = ' + boards.join(',') + '; lbRender + render parse; one </html>.');
