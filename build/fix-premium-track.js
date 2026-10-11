/* WHAT ANYBODY ACTUALLY DOES ON /premium/ (2026-10-11, owner: "mozemo da poboljsamo merenje, logove i da mi
   izlaze tamo da vidim sta je ko kliknuo na toj stranici, kao i da ih cuvamo negde za analizu").

   Measured before: the page recorded ONE thing, the indicators sheet opening - and even that recorded nothing,
   because it sent the broken shape (type in a `type` param, label in `l`) while the worker reads the type from `t` and the label from `e`
   (see build/fix-track-beacons.js). So the page that is supposed to make money had no instrument on it at all,
   on a day when six people have ever bought and zero have ever renewed.

   Four beacons, all through the SAME /api/track the rest of the site uses, so they land in Analytics Engine (kept
   for as long as AE keeps anything) and - for the two that are rare and valuable - in the live activity ring the
   owner reads every morning:
     premview buy:<plan>[:guest]  a price was pressed, which plan, and whether they were signed in. A GUEST's
                                  press is recorded BEFORE the sign-in sheet goes up, because that is the exact
                                  moment most readers leave and it was invisible.
     premview reads:more          the AI reads section was opened past the first three.
     premview indsheet            the indicators preview.
     sect <block>                 how far down the page anybody gets. Deliberately NOT in the activity-ring
                                  whitelist - a scroll is for counting, not for the feed.

   node build/fix-premium-track.js         rewrites dist/premium/index.html in place (idempotent)
   node build/fix-premium-track.js --dry   prints what it would change
*/
const fs = require('fs');
const path = require('path');
const PAGE = path.join(__dirname, '..', 'dist', 'premium', 'index.html');
const DRY = process.argv.includes('--dry');

const SECT_JS = `
    /* HOW FAR DOWN ANYBODY GETS. Same shape as the homepage band beacons: once per block per pageview, at 30%
       visibility OR when the block fills 60% of the screen - a section taller than the viewport can never reach
       30% and would otherwise never be counted. */
    try{
      var _pvSeen={};
      var _pvIo=new IntersectionObserver(function(es){es.forEach(function(x){
        if(!x.isIntersecting)return;
        if(x.intersectionRatio<.3&&x.intersectionRect.height<window.innerHeight*.6)return;
        var el=x.target,k=el.id||((el.querySelector('h1,h2,h3')||{}).textContent||'')||el.className||el.tagName;
        k=String(k).replace(/\\s+/g,' ').trim().slice(0,32);
        if(!k||_pvSeen[k])return;_pvSeen[k]=1;
        try{navigator.sendBeacon('/api/track?t=sect&e='+encodeURIComponent(k)+'&p=/premium/');}catch(e){}
        _pvIo.unobserve(el);
      });},{threshold:[.05,.15,.3]});
      [].forEach.call(document.querySelectorAll('.hero,#stripshow,#plus,#whyplus,#aishow,#howto,section'),function(el){
        if(el.offsetHeight>60)_pvIo.observe(el);
      });
    }catch(e){}
`;

function main() {
  let h = fs.readFileSync(PAGE, 'utf8');
  const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const before = h;
  const did = [];

  // 1. the press itself, recorded BEFORE the sign-in gate
  if (h.indexOf("'buy:' + plan") < 0) {   // guard on what is WRITTEN, not on what it produces at runtime
    const anchor = "    function buy(plan, btn){" + N + "      var me = (window.mpAuth && window.mpAuth.me && window.mpAuth.me());";
    if (h.split(anchor).length !== 2) throw new Error('the buy() head is not where it was - refusing to guess');
    h = h.replace(anchor, "    function buy(plan, btn){" + N
      + "      var me = (window.mpAuth && window.mpAuth.me && window.mpAuth.me());" + N
      + "      /* a GUEST pressing a price is the moment most readers leave, and it was invisible - record it first */" + N
      + "      try{ navigator.sendBeacon('/api/track?t=premview&e=' + encodeURIComponent('buy:' + plan + (me ? '' : ':guest')) + '&p=/premium/'); }catch(e){}");
    did.push('buy-intent');
  }

  // 2. the indicators sheet, on a type that reaches the activity ring
  if (h.indexOf('t=indsheet&e=open') >= 0) {
    h = h.split('/api/track?t=indsheet&e=open&p=/premium/').join('/api/track?t=premview&e=indsheet&p=/premium/');
    did.push('indsheet');
  }

  // 3. the AI reads, opened past the first three
  if (h.indexOf('reads%3Amore') < 0) {   // the written form is URL-encoded; guarding on the plain one re-applies for ever
    const anchor = 'b.addEventListener("click",function(){x.hidden=false;b.hidden=true;});';
    if (h.split(anchor).length !== 2) throw new Error('the aiMore handler is not where it was - refusing');
    h = h.replace(anchor, 'b.addEventListener("click",function(){x.hidden=false;b.hidden=true;try{navigator.sendBeacon("/api/track?t=premview&e=reads%3Amore&p=/premium/");}catch(e){}});');
    did.push('reads-more');
  }

  // 4. scroll depth
  if (h.indexOf('_pvIo') < 0) {
    const anchor = "    var msg = document.getElementById('pmsg');";
    if (h.split(anchor).length !== 2) throw new Error('the page script head is not where it was - refusing');
    h = h.replace(anchor, anchor + SECT_JS.split('\n').join(N));
    did.push('sect');
  }

  const bad = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;
  if (bad) throw new Error('div balance would be ' + bad + ' - refusing to write');
  if (!did.length) { console.log('premium tracking: already current, nothing to do'); return; }
  if (DRY) { console.log('would apply: ' + did.join(', ') + '  (' + (h.length - before.length) + ' bytes)'); return; }
  const tmp = PAGE + '.tmp';
  fs.writeFileSync(tmp, h);
  fs.renameSync(tmp, PAGE);
  console.log('premium tracking: ' + did.join(', ') + '  (+' + (h.length - before.length) + ' bytes)');
}
main();
