// /premium/ MOVES (2026-10-15, owner: "ovu stranicu za premium da malo osvezimo sa nekim animacijama ... slike da
// napravimo interaktivnim").
//
// Every motion here is the Web Animations API, never @keyframes: the owner's Windows has animation effects OFF, which
// silences CSS keyframes (the hero's blinking dots have been invisible to him since the page was built) while
// element.animate() still plays. Nothing moves on its own except a one-time entrance; after that motion answers the
// reader - a scroll (cards rise into place as they arrive), a hover (the capture lifts), a tap (the lightbox).
//
//   1. Entrance: the hero's tag, title, lead and buttons rise in on load, staggered.
//   2. Reveal on scroll: feature cards, price cards, the three "why" columns, the strip cards and every read rise
//      into place the first time they cross 18% of the viewport. The resting state is VISIBLE - a page whose cards are
//      transparent until a script runs is a blank page for a crawler and for anyone whose observer never fires.
//   3. The $40 OFF chip breathes once a few seconds (a card that says "off" should draw the eye once, not nag).
//   4. Lightbox: every capture on the page opens full-size in an overlay (Escape / tap / X closes) instead of a new
//      tab - the images are the proof and a tab switch loses the page.
//   5. Copy: "six MarginPad readouts" -> five (the wall was withdrawn on 10-13 and this sentence was missed).
//
// Idempotent; refuses rather than guesses. `node build/fix-premium-motion.js [--dry]`
const fs = require('fs');
const F = 'dist/premium/index.html';
const DRY = process.argv.indexOf('--dry') >= 0;
let h = fs.readFileSync(F, 'utf8');
const before = h;
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';

// 5. copy
h = h.split('Premium adds the six MarginPad readouts above').join('Premium adds the five MarginPad readouts above');

// 1-4. one style block + one script, keyed by id so a re-run replaces rather than appends
const CSS = '<style id="motioncss">.mv-item{will-change:transform,opacity}[data-lightbox] img{transition:transform .25s ease,box-shadow .25s ease}[data-lightbox]:hover img{transform:translateY(-3px) scale(1.012);box-shadow:0 18px 50px rgba(0,0,0,.45)}'
  + '#mpLb{position:fixed;inset:0;z-index:2147483000;background:rgba(5,6,8,.93);display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out}#mpLb[hidden]{display:none}#mpLb img{max-width:min(96vw,1400px);max-height:92vh;width:auto;height:auto;border-radius:12px;border:1px solid #2a3442;box-shadow:0 30px 90px rgba(0,0,0,.7);cursor:default}'
  + '#mpLb .lb-x{position:absolute;top:14px;right:16px;width:40px;height:40px;border-radius:50%;border:1px solid #2a3442;background:#0e1218;color:#e9e7df;display:flex;align-items:center;justify-content:center;cursor:pointer}#mpLb .lb-x svg{width:18px;height:18px}#mpLb .lb-cap{position:absolute;left:0;right:0;bottom:16px;text-align:center;font:600 12px "Space Mono",monospace;color:#9aa6b8;letter-spacing:.04em;padding:0 60px}</style>';

const JS = '<script id="motionjs">(function(){var A=function(el){return el&&typeof el.animate==="function";};'
  // 1. entrance
  + 'try{var hero=document.querySelector(".hero");if(hero){var items=[].slice.call(hero.querySelectorAll(".tag,h1,.lead,.cta-row,.scarcity,.pmst,.trustrow")).filter(function(e){return e.offsetParent!==null;});items.forEach(function(e,i){if(!A(e))return;e.animate([{opacity:0,transform:"translateY(14px)"},{opacity:1,transform:"none"}],{duration:620,delay:60+i*90,easing:"cubic-bezier(.2,.7,.2,1)",fill:"backwards"});});}}catch(e){}'
  // 2. reveal on scroll - resting state visible; the animation starts FROM hidden on arrival
  + 'try{var sel=".fcard,.pcard,#whyplus .wpc,.ss-card,.ai-read,.bt-tile,.qa,#proof .pf";var els=[].slice.call(document.querySelectorAll(sel));if("IntersectionObserver" in window&&els.length){var seen=new WeakSet();var io=new IntersectionObserver(function(es){es.forEach(function(en){if(!en.isIntersecting)return;var el=en.target;io.unobserve(el);if(seen.has(el))return;seen.add(el);if(!A(el))return;var sib=[].slice.call(el.parentNode.children).indexOf(el);el.animate([{opacity:0,transform:"translateY(18px)"},{opacity:1,transform:"none"}],{duration:560,delay:Math.min(4,sib)*70,easing:"cubic-bezier(.2,.7,.2,1)",fill:"backwards"});});},{threshold:0.18});els.forEach(function(el){var r=el.getBoundingClientRect();if(r.top<innerHeight*0.9&&r.bottom>0){seen.add(el);return;}io.observe(el);});}}catch(e){}'
  // 3. the OFF chip breathes once, after the entrance
  + 'try{var off=document.querySelector(".pt .off");if(off&&A(off))setTimeout(function(){off.animate([{transform:"scale(1)"},{transform:"scale(1.12)"},{transform:"scale(1)"},{transform:"scale(1.08)"},{transform:"scale(1)"}],{duration:1100,easing:"ease-in-out"});},1400);}catch(e){}'
  // 4. lightbox
  + 'try{var lb=document.createElement("div");lb.id="mpLb";lb.hidden=true;lb.setAttribute("role","dialog");lb.setAttribute("aria-modal","true");lb.innerHTML=\'<button type="button" class="lb-x" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button><img alt=""><div class="lb-cap"></div>\';document.body.appendChild(lb);var im=lb.querySelector("img"),cap=lb.querySelector(".lb-cap");'
  + 'function open(src,alt){im.src=src;im.alt=alt||"";cap.textContent=alt||"";lb.hidden=false;document.documentElement.style.overflow="hidden";if(A(im))im.animate([{opacity:0,transform:"scale(.96)"},{opacity:1,transform:"none"}],{duration:260,easing:"ease-out"});try{navigator.sendBeacon("/api/track?t=premview&e=lightbox&p=/premium/");}catch(e){}}'
  + 'function close(){if(lb.hidden)return;lb.hidden=true;document.documentElement.style.overflow="";}'
  + 'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[data-lightbox], .ss-fig img, #proof .pf-img");if(!a)return;var img=a.tagName==="IMG"?a:a.querySelector("img");if(!img)return;var full=a.tagName==="A"&&a.getAttribute("href")&&/\\.jpg$/i.test(a.getAttribute("href"))?a.getAttribute("href"):(img.currentSrc||img.src);e.preventDefault();open(full,img.alt);});'
  + 'lb.addEventListener("click",function(e){if(e.target===lb||e.target.closest(".lb-x"))close();});document.addEventListener("keydown",function(e){if(e.key==="Escape")close();});}catch(e){}'
  + '})();</script>';

if (h.indexOf('<style id="motioncss">') >= 0) h = h.replace(/<style id="motioncss">[\s\S]*?<\/style>/, () => CSS); else h = h.replace('</head>', () => CSS + '</head>');
if (h.indexOf('<script id="motionjs">') >= 0) h = h.replace(/<script id="motionjs">[\s\S]*?<\/script>/, () => JS); else h = h.replace('</body>', () => JS + N + '</body>');
// the strip figure gets a pointer so a reader knows it opens
h = h.split('<figure class="ss-fig"><img ').join('<figure class="ss-fig" style="cursor:zoom-in"><img ');

if (h === before) { console.log('no change'); process.exit(0); }
if ((h.match(/id="motionjs"/g) || []).length !== 1 || (h.match(/id="motioncss"/g) || []).length !== 1) { console.error('REFUSING: motion block not unique'); process.exit(1); }
if (DRY) { console.log('(dry run) would add the motion layer + lightbox and fix the readout count'); process.exit(0); }
fs.writeFileSync(F + '.tmp', Buffer.from(h, 'utf8'));
fs.renameSync(F + '.tmp', F);
console.log('premium: entrance + reveal-on-scroll + lightbox (WAAPI), readout count fixed');
