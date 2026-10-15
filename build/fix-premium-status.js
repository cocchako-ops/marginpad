/* THE MEMBERSHIP CARD ON /premium/ (2026-10-11, owner: "dodaj da pise lepo na premium stranici tamo gde pise da je
   plan aktivan. Uredi to lepo da izgleda.")

   It was a tinted box with a tick, an eyebrow and one sentence of prose carrying the date. The date is the thing a
   member actually wants off that card, and prose is the slowest way to read a number. It now carries the plan as a
   badge, the days left as a figure with a meter behind it, the sentence underneath (unchanged - it is what a
   crawler and the E2E read), and - the part that matters - a way to pay again.

   THAT LAST PART WAS IMPOSSIBLE UNTIL TODAY. /api/premium/checkout and /paybalance both refused any caller who
   still had a day left, while the card beside them said "pay again any time to extend". Six people have ever
   bought Premium and not one has ever renewed. The worker now refuses only a PERMANENT standing (a Founder, an
   owner allow-list grant) - there is nothing to extend on those - and the card offers the two ways to do it.

   Inside the last seven days the whole card turns amber and leads with "ends in N days", because that is the one
   week in the month when this card has something to say.

   node build/fix-premium-status.js         rewrites dist/premium/index.html in place (idempotent)
   node build/fix-premium-status.js --dry   prints what it would change
*/
const fs = require('fs');
const path = require('path');
const PAGE = path.join(__dirname, '..', 'dist', 'premium', 'index.html');
const DRY = process.argv.includes('--dry');

const CSS_MARK = '/* membership card v2 */';
const CSS = CSS_MARK + `
  .pmst .pmst-k{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
  .pmst .pmst-tag{font:800 9.5px "Space Mono",monospace;letter-spacing:.12em;padding:3px 8px;border-radius:999px;background:rgba(194,246,74,.16);border:1px solid rgba(194,246,74,.45);color:var(--lime)}
  .pmst .pmst-m{grid-column:2/-1;display:flex;align-items:center;gap:13px;margin-top:11px}
  .pmst .pmst-m[hidden]{display:none}
  .pmst .pmst-m i{flex:1;min-width:0;height:7px;border-radius:999px;background:rgba(255,255,255,.08);position:relative;display:block}
  .pmst .pmst-m i::after{content:"";position:absolute;top:0;bottom:0;left:0;width:var(--w,0%);border-radius:999px;background:var(--lime);transition:width .6s ease}
  .pmst .pmst-m span{font:700 12.5px "Space Mono",monospace;color:var(--lime);white-space:nowrap}
  .pmst .pmst-a{grid-column:2/-1}
  .pmst .pmst-a[hidden]{display:none}
  .pmst .pmst-a .btn{pointer-events:auto!important}
  .pmst .pmst-a .pmst-note{flex-basis:100%;font-size:12px;color:var(--faint);line-height:1.5;margin:2px 0 0}
  .pmst[data-soon="1"]{border-color:rgba(255,176,32,.5);background:linear-gradient(180deg,rgba(255,176,32,.10),rgba(255,176,32,.02))}
  .pmst[data-soon="1"] .pmst-ic{background:#ffb020}
  .pmst[data-soon="1"] .pmst-k,.pmst[data-soon="1"] .pmst-m span{color:#ffb020}
  .pmst[data-soon="1"] .pmst-tag{background:rgba(255,176,32,.16);border-color:rgba(255,176,32,.45);color:#ffb020}
  .pmst[data-soon="1"] .pmst-m i::after{background:#ffb020}
  @media(max-width:560px){.pmst{padding:16px 15px;gap:5px 13px}.pmst .pmst-ic{width:40px;height:40px;border-radius:12px}.pmst .pmst-t{font-size:19px}.pmst .pmst-a .btn{flex:1;min-width:150px;justify-content:center}}`;

const OLD_ROW = '      <div class="pmst-k">YOUR MEMBERSHIP</div>';
const NEW_ROW = '      <div class="pmst-k">YOUR MEMBERSHIP<span class="pmst-tag" id="pmPlan">PREMIUM</span></div>';
const AFTER_U = '      <div class="pmst-u" id="pmUntil">Checking your plan…</div>';
const ADD_ROWS = `
      <div class="pmst-m" id="pmMeter" hidden><i id="pmBar"></i><span id="pmDays"></span></div>
      <div class="pmst-a" id="pmAct" hidden></div>`;

/* The decorator runs off the SAME /api/premium/status answer the sentence already uses, so there is no second
   request and no second source of truth about what this account holds. */
const JS_MARK = 'function pmDecorate(';
const JS = `function pmDecorate(s){
      var st=document.getElementById('pmStatus'); if(!st) return;
      var tag=document.getElementById('pmPlan'), ttl=st.querySelector('.pmst-t');
      var m=document.getElementById('pmMeter'), bar=document.getElementById('pmBar'), dys=document.getElementById('pmDays'), act=document.getElementById('pmAct');
      var name=s.plus?'Premium AI+':'Premium';
      if(tag) tag.textContent=(s.source==='founder'?'FOUNDER':name.toUpperCase());
      /* no end date = a Founder or an owner grant: there is nothing to count down and nothing to extend */
      if(!s.until){ if(ttl) ttl.textContent=(s.source==='founder'?'Founder - yours for life':name+' is active on your account'); return; }
      var days=Math.max(0,Math.ceil((new Date(s.until)-Date.now())/864e5)), soon=days<=7;
      st.setAttribute('data-soon',soon?'1':'0');
      /* THE MARK HAS TO AGREE WITH THE SENTENCE. A tick beside 'Premium ends in 3 days' reads as reassurance
         exactly where the card is trying to get attention - it becomes a clock for that last week. */
      var ic=st.querySelector('.pmst-ic svg');
      if(ic) ic.innerHTML=soon?'<circle cx="12" cy="12" r="9"></circle><path d="M12 7.5V12l3 1.8"></path>':'<path d="M20 6L9 17l-5-5"></path>';
      if(ttl) ttl.textContent=soon?(name+' ends in '+(days===1?'1 day':days+' days')):(name+' is active on your account');
      if(m&&bar&&dys){ m.hidden=false; bar.style.setProperty('--w',Math.max(3,Math.min(100,Math.round(ms/(30*864e5)*100)))+'%'); dys.textContent=(days===1?'1 day':days+' days')+' left'; }
      /* PAYING AGAIN IS THE POINT OF THIS CARD. Until 2026-10-11 the worker refused a member who still had a day
         left, so "pay again any time to extend" was a sentence with nothing behind it. data-buy="extend" and
         "extendbal" go through the same handler as the buy buttons; they are deliberately NOT data-buy="monthly",
         which the member stylesheet deadens on purpose. */
      if(act){ act.hidden=false;
        act.innerHTML='<button class="btn btn-primary" data-buy="extend">Add another month - $11.99</button>'
          +'<button class="btn btn-ghost" data-buy="extendbal">Pay from my rewards balance</button>'
          +'<p class="pmst-note">A month you add starts when this one ends, never instead of it.</p>'; }
    }
    `;

/* ---- v3 (2026-10-11, owner: "i dalje mi stoji gore iznad staro Premium is active i Premium Plus is active
   odmah ispod, pa ispod svega toga ovo novo. To staro moze da se obrise. Takodje treba da bude countdown do
   isteka premium-a.") ------------------------------------------------------------------------------------- */
const CSS2 = `<style id="pmstcss2">
  /* A DEAD BUTTON IS NOT A STATUS. A member met "Premium is active" and, if they held Plus, "Premium Plus is
     active" directly beside it - two buttons that cannot be pressed, saying what the card below says properly.
     The 2026-09 rule was that the Premium button should "read as held rather than vanishing"; with a real
     membership card under it that is one sentence too many, so it goes. What stays is anything a member can
     still DO: a Premium holder keeps the live Premium Plus upsell. A Plus holder has nothing to buy, so the
     whole row goes with it. */
  body.pm-member [data-buy="monthly"]{display:none!important}
  body.pm-plus .cta-row{display:none!important}
  body.pm-plus .ish-f [data-buy]{display:none!important}
  /* the countdown */
  .pmst .pmst-m span{font-size:15px;letter-spacing:.02em}
  .pmst .pmst-m span b{font-weight:700}
  .pmst .pmst-m span i{font-style:normal;font-size:11px;color:var(--faint);margin-left:7px;letter-spacing:.06em}
  @media(max-width:560px){.pmst .pmst-m{flex-wrap:wrap;gap:8px 13px}.pmst .pmst-m i{flex-basis:100%;order:2}.pmst .pmst-m span{order:1;font-size:14px}}
</style>`;

/* THE COUNTDOWN IS SECONDS, NOT A ROUNDED DAY COUNT. "21 days left" is the same string for twenty-four hours,
   which is exactly the wrong behaviour on the last day of a membership nobody is told about anywhere else.
   It falls through days -> hours -> minutes as it runs out, so the display gets more urgent by itself. */
const JS3 = `function pmLeft(ms){
      if(!(ms>0)) return '<b>'+__esT_premiumindex('pmEnded','ended')+'</b>';
      var d=Math.floor(ms/864e5), h=Math.floor(ms%864e5/36e5), m=Math.floor(ms%36e5/6e4), sec=Math.floor(ms%6e4/1000);
      var p2=function(n){return (n<10?'0':'')+n;};
      if(d>0) return '<b>'+d+'d '+p2(h)+'h '+p2(m)+'m</b>';
      if(h>0) return '<b>'+p2(h)+'h '+p2(m)+'m '+p2(sec)+'s</b>';
      return '<b>'+p2(m)+'m '+p2(sec)+'s</b>';
    }
    var _pmTimer=null;
    function pmDecorate(s){
      var st=document.getElementById('pmStatus'); if(!st) return;
      var tag=document.getElementById('pmPlan'), ttl=st.querySelector('.pmst-t');
      var m=document.getElementById('pmMeter'), bar=document.getElementById('pmBar'), dys=document.getElementById('pmDays'), act=document.getElementById('pmAct');
      var name=s.plus?'Premium AI+':'Premium';
      if(tag) tag.textContent=(s.source==='founder'?'FOUNDER':name.toUpperCase());
      /* no end date = a Founder or an owner grant: there is nothing to count down and nothing to extend */
      if(!s.until){ if(ttl) ttl.textContent=(s.source==='founder'?__esT_premiumindex('pmFounderLife','Founder - yours for life'):name+' '+__esT_premiumindex('pmIsActiveOn','is active on your account')); return; }
      var end=+new Date(s.until);
      var ic=st.querySelector('.pmst-ic svg');
      if(act){ act.hidden=false;
        act.innerHTML='<button class="btn btn-primary" data-buy="extend">'+__esT_premiumindex('pmAddMonth','Add another month - $11.99')+'</button>'
          +'<button class="btn btn-ghost" data-buy="extendbal">'+__esT_premiumindex('pmPayBalance','Pay from my rewards balance')+'</button>'
          +'<p class="pmst-note">'+__esT_premiumindex('pmAddNote','A month you add starts when this one ends, never instead of it.')+'</p>'; }
      var lastTxt='', lastSoon=null;
      var tick=function(){
        var ms=end-Date.now(), days=Math.max(0,Math.floor(ms/864e5)), soon=ms<=7*864e5;
        if(soon!==lastSoon){
          lastSoon=soon;
          st.setAttribute('data-soon',soon?'1':'0');
          /* THE MARK HAS TO AGREE WITH THE SENTENCE. A tick beside "Premium ends in 3 days" reads as
             reassurance exactly where the card is trying to get attention - it becomes a clock for that week. */
          if(ic) ic.innerHTML=soon?'<circle cx="12" cy="12" r="9"></circle><path d="M12 7.5V12l3 1.8"></path>':'<path d="M20 6L9 17l-5-5"></path>';
        }
        if(ttl) ttl.textContent=(ms<=0)?(name+' '+__esT_premiumindex('pmHasEnded','has ended')):(soon?(name+(days<1?' '+__esT_premiumindex('pmEndsToday','ends today'):(' '+__esT_premiumindex('pmEndsIn','ends in')+' '+(days===1?__esT_premiumindex('pmOneDay','1 day'):days+' '+__esT_premiumindex('pmDaysWord','days'))))):(name+' '+__esT_premiumindex('pmIsActiveOn','is active on your account')));
        if(m&&bar&&dys){ m.hidden=false; bar.style.setProperty('--w',Math.max(3,Math.min(100,Math.round(ms/(30*864e5)*100)))+'%');
          var t=pmLeft(ms); if(t!==lastTxt){ lastTxt=t; dys.innerHTML=t; } }
      };
      tick();
      if(_pmTimer) clearInterval(_pmTimer);
      _pmTimer=setInterval(tick,1000);   /* one DOM write only when the string changes - the seconds appear on the last day */
    }
    `;

function main() {
  let h = fs.readFileSync(PAGE, 'utf8');
  const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const before = h;
  const did = [];

  // 1. the CSS, injected once, right after the rules it extends
  if (h.indexOf(CSS_MARK) < 0) {
    const anchor = '.pmst .pmst-a .btn{padding:11px 16px;font-size:14px}';
    if (h.split(anchor).length !== 2) throw new Error('the .pmst-a rule is not unique - refusing to guess where the CSS goes');
    h = h.replace(anchor, anchor + N + '  ' + CSS.split('\n').join(N));
    did.push('css');
  }

  // 2. the plan badge
  if (h.indexOf('id="pmPlan"') < 0) {
    if (h.split(OLD_ROW).length !== 2) throw new Error('the YOUR MEMBERSHIP row is not where it was - refusing');
    h = h.replace(OLD_ROW, NEW_ROW);
    did.push('badge');
  }

  // 3. the meter and the action row
  if (h.indexOf('id="pmMeter"') < 0) {
    if (h.split(AFTER_U).length !== 2) throw new Error('the pmUntil row is not where it was - refusing');
    h = h.replace(AFTER_U, AFTER_U + ADD_ROWS.split('\n').join(N));
    did.push('meter+actions');
  }

  // 4. the decorator, and the one call that runs it
  if (h.indexOf(JS_MARK) < 0) {
    const anchor = '    function memberUntil(s){';
    if (h.split(anchor).length !== 2) throw new Error('memberUntil is not unique - refusing');
    h = h.replace(anchor, '    ' + JS.split('\n').join(N) + anchor.trimStart());
    did.push('js');
  }
  if (h.indexOf('pmDecorate(s)') >= 0 && h.indexOf('try{pmDecorate(s);}') < 0) {
    const anchor = "document.getElementById('pmUntil').innerHTML=memberUntil(s);";
    if (h.split(anchor).length !== 2) throw new Error('the pmUntil fill is not unique - refusing');
    h = h.replace(anchor, anchor + ' try{pmDecorate(s);}catch(e){}');
    did.push('call');
  }

  // 5. the balance branch has to know the new name
  const bal = "if(plan==='balance'){";
  if (h.indexOf("plan==='balance'||plan==='extendbal'") < 0) {
    if (h.split(bal).length !== 2) throw new Error('the balance branch is not unique - refusing');
    h = h.replace(bal, "if(plan==='balance'||plan==='extendbal'){");
    did.push('balance-branch');
  }

  // 6. v3 rules, in their own element so a re-run upgrades instead of appending
  if (h.indexOf('<style id="pmstcss2">') < 0) { h = h.replace('</head>', CSS2 + '</head>'); did.push('css2'); }
  else { const was = h; h = h.replace(/<style id="pmstcss2">[\s\S]*?<\/style>/, () => CSS2); if (h !== was) did.push('css2'); }

  // 7. pmDecorate, swapped whole between two anchors that have not moved since it was written
  {
    const s0 = h.indexOf('function pmLeft(ms){') >= 0 ? h.indexOf('function pmLeft(ms){') : h.indexOf('function pmDecorate(s){');
    const s1 = h.indexOf('function memberUntil(s){');
    if (s0 < 0 || s1 < 0 || s1 < s0) throw new Error('pmDecorate/memberUntil anchors are not where they were - refusing');
    const cur = h.slice(s0, s1);
    const next = JS3.split('\n').join(N);
    if (cur !== next) { h = h.slice(0, s0) + next + h.slice(s1); did.push('countdown'); }
  }

  // 8. the prose sentence counts days the same way the countdown does, or one card carries two answers
  {
    const a8 = 'days=Math.max(0,Math.ceil((d-Date.now())/864e5))';
    if (h.indexOf(a8) >= 0) { h = h.split(a8).join('days=Math.max(0,Math.floor((d-Date.now())/864e5))'); did.push('day-count'); }
  }

  // 9. and on the last day it read "0 days left", which is not a number anybody says out loud
  {
    const a9 = "(days===1?'1 day':days+' days')+' left. '";
    if (h.indexOf(a9) >= 0) { h = h.split(a9).join("(days<1?__esT_premiumindex('lessThanADay','less than a day'):(days===1?'1 day':days+' days'))+' left. '"); did.push('last-day'); }
  }

  // 10. the card writes its own title from JS, so gen-pages cannot see it - the strings join the page's own
  //     inline-JS dictionary (the 2026-09-19 layer), or a Spanish member reads an English card
  {
    const ES = {"pmFounderLife": "Founder - tuyo de por vida", "pmIsActiveOn": "está activo en tu cuenta", "pmHasEnded": "ha terminado", "pmEndsToday": "termina hoy", "pmEndsIn": "termina en", "pmOneDay": "1 día", "pmDaysWord": "días", "pmAddMonth": "Añadir otro mes - $11.99", "pmPayBalance": "Pagar desde mi saldo de recompensas", "pmAddNote": "El mes que añades empieza cuando termina este, nunca en su lugar.", "pmEnded": "terminado", "lessThanADay": "menos de un día"};
    const dm = h.match(/__esD_premiumindex = (\{[\s\S]*?\});/);
    if (!dm) throw new Error('the inline Spanish dictionary is gone - refusing');
    let dict; try { dict = JSON.parse(dm[1]); } catch (e) { throw new Error('the inline Spanish dictionary does not parse - refusing'); }
    let add = 0;
    for (const k of Object.keys(ES)) if (dict[k] !== ES[k]) { dict[k] = ES[k]; add++; }
    if (add) { h = h.replace(dm[0], '__esD_premiumindex = ' + JSON.stringify(dict) + ';'); did.push('es x' + add); }
  }

  const bad = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;
  if (bad) throw new Error('div balance would be ' + bad + ' - refusing to write');
  if (!did.length) { console.log('premium status card: already current, nothing to do'); return; }
  if (DRY) { console.log('would apply: ' + did.join(', ') + '  (' + (h.length - before.length) + ' bytes)'); return; }
  const tmp = PAGE + '.tmp';
  fs.writeFileSync(tmp, h);
  fs.renameSync(tmp, PAGE);
  console.log('premium status card: ' + did.join(', ') + '  (+' + (h.length - before.length) + ' bytes, div balance ok)');
}
main();
