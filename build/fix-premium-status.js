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
      var name=s.plus?'Premium Plus':'Premium';
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
      if(m&&bar&&dys){ m.hidden=false; bar.style.setProperty('--w',Math.max(4,Math.min(100,Math.round(days/30*100)))+'%'); dys.textContent=(days===1?'1 day':days+' days')+' left'; }
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
