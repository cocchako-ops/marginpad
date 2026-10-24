#!/usr/bin/env node
/* /spot/ OPENS ON ITS OWN LOGO, NEVER ON THE GUEST GATE (2026-10-24, owner: "kad iz browse pritisnem demo spot,
   na trenutak (maks 5 sekundi) gledam stari demo spot i onda se otvori terminal. Bolje da bude neka loading
   animacija dok se terminal ne otvori").

   MEASURED on a throttled phone before writing a line: #app is unhidden 3.9 s after the navigation and the
   terminal is built in the SAME frame - so there is no "old layout" at all. What he was reading for four
   seconds is the GUEST GATE: "$10,000 to start - Sign in to start", served to a signed-in member because the
   page cannot know who he is until /api/spot/portfolio answers. That is the same trap /season/ and the member
   card hit (CLAUDE.md: "the guest hero must never be PAINTED for a member"), and it has the same answer: the
   non-HttpOnly `mp_li` cookie, read in an inline script BEFORE the first frame.

   So: html.mp-li hides the gate and shows a splash carrying the app icon; the splash goes the moment the page
   has decided - the terminal built, or the gate shown because this member has no Spot account - and in any case
   after SPLASH_MAX. A splash that can outlive its own page is worse than the flash it replaces.

   Idempotent, --dry. Run AFTER build/fix-spot-terminal.js. */
'use strict';
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'spot', 'index.html');
let h = fs.readFileSync(F, 'utf8');
if (h.indexOf('spotBoot') >= 0) { console.log('fix-spot-boot: already applied'); process.exit(0); }
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const nl = (s) => s.replace(/\r?\n/g, N);

/* 0. THE HEADER'S OWN TOP PADDING CARRIES THE NOTCH. The terminal stylesheet wrote a flat 13px !important over
      mp-nav's `calc(env(safe-area-inset-top) + 14px)`, so on a home-screen iPhone the clock and the battery sat
      on the brand. This upgrades the rule in place when it finds the old form - the undo-entry-first pattern,
      because a later round that REPLACES an earlier round's line cannot anchor on text that has already gone. */
const PAD_OLD = ".spot-term #siteHead{margin:0!important;padding:13px 16px 12px!important;border-bottom:1px solid var(--line)}";
const PAD_NEW = ".spot-term #siteHead{margin:0!important;border-bottom:1px solid var(--line);" + N
  + "    padding:calc(13px + env(safe-area-inset-top)) 16px 12px!important}";
if (h.indexOf(PAD_OLD) >= 0) h = h.split(PAD_OLD).join(PAD_NEW);
if (h.indexOf('padding:calc(13px + env(safe-area-inset-top)) 16px 12px!important') < 0) throw new Error('the header rule is neither the old nor the new form - look before writing');

/* 0b. THE PAGE ANNOUNCES ITS OWN DECISION, AND ONLY THE SERVER'S ANSWER COUNTS. gateMode() looked like the
      signal and is not: boot() calls gateMode('signin') straight away whenever `ME` is still null, and for an
      mp_li holder that is EVERY early pass, because mp-auth.js is deferred - so marking there switched the
      splash off at 200 ms and put the gate back, which is the whole bug. The two branches below run only after
      /api/spot/portfolio has answered: the session is dead, or this member has no Spot account yet. The third
      answer (an account) raises the terminal, and body.spot-term is its own signal.
      These two lines and nothing else are what this patcher changes in the page's own script. */
const DEC = [
  ["if(!d||d.error==='login_required'){ME=null;", "if(!d||d.error==='login_required'){ME=null;document.body.classList.add('spot-booted');"],
  ["if(d.none){PORT=null;", "if(d.none){PORT=null;document.body.classList.add('spot-booted');"]
];
DEC.forEach(function (p) {
  if ((h.split(p[0]).length - 1) !== 1) throw new Error('boot() decision anchor is not unique: ' + p[0]);
  h = h.split(p[0]).join(p[1]);
});

/* 1. WHO IS THIS, BEFORE THE FIRST PIXEL. `mp_li` is the non-HttpOnly companion of the session cookie - the
      same first-frame signal /season/ uses. It can be stale (a dead session), which is why the splash always
      has a way out rather than being trusted as proof. */
const HEAD = `<script>try{if(/(^|; )mp_li=1/.test(document.cookie))document.documentElement.className+=' mp-li';}catch(e){}</script>`;
// the charset tag is written `<meta charset="UTF-8" />` here and must stay the FIRST tag in <head> (the
// 1024-byte prescan rule), so the script goes immediately AFTER it, whatever its spelling
const cm = h.indexOf('<meta charset');
const chi = cm >= 0 ? h.indexOf('>', cm) + 1 : -1;
if (chi < 1) throw new Error('no <meta charset ...> to anchor the first-frame class on');
h = h.slice(0, chi) + N + HEAD + h.slice(chi);

/* 2. THE SPLASH ITSELF */
const CSS = `
  /* ─── THE BOOT SPLASH (2026-10-24) ───────────────────────────────────────────────────────────────────── */
  /* a member never reads the sign-up gate (measured: 4 s of it) - but ONLY while the page is still deciding.
     A member with no Spot account yet is shown that same gate with a Start button, so hiding it for good would
     have left them a blank screen; '.spot-booted' is the page's own "I have decided" and it lifts this. */
  html.mp-li body:not(.spot-booted) #gate{display:none!important}
  #spotBoot{position:fixed;inset:0;z-index:70;display:none;flex-direction:column;align-items:center;
    justify-content:center;gap:18px;background:var(--bg);padding-bottom:12vh}
  html.mp-li #spotBoot{display:flex}
  #spotBoot img{width:72px;height:72px;border-radius:18px;display:block}
  #spotBoot .bl{font:700 10px/1 'Space Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
  #spotBoot .bb{width:132px;height:3px;border-radius:3px;background:var(--line2);overflow:hidden}
  #spotBoot .bb i{display:block;width:40%;height:100%;border-radius:3px;background:var(--lime)}
  body.spot-booted #spotBoot{display:none!important}`;
const SEND = '</style>';
const si = h.lastIndexOf(SEND, h.indexOf('</head>') > 0 ? h.indexOf('</head>') : h.length);
if (si < 0) throw new Error('no </style> before </head>');
h = h.slice(0, si) + nl(CSS) + N + h.slice(si);

const MARKUP = `<div id="spotBoot" aria-hidden="true">
  <img src="/assets/app-icon-192.png" width="72" height="72" alt="">
  <div class="bl" data-t="term_loading">Opening the terminal</div>
  <div class="bb"><i></i></div>
</div>`;
const WRAP = '<div class="wrap">';
const wi = h.indexOf(WRAP);
if (wi < 0) throw new Error('no .wrap to put the splash in front of');
h = h.slice(0, wi) + nl(MARKUP) + N + h.slice(wi);

/* 3. THE WAY OUT. Three of them, because a splash nobody can dismiss is worse than the flash it replaced:
      the terminal is up, the page decided this member has no account and showed the gate, or the ceiling. */
const JS = `<script>
(function () {
  var el = document.getElementById('spotBoot'); if (!el) return;
  if (!/(^|; )mp_li=1/.test(document.cookie)) return;   // a guest meets the gate at once, as it should be
  var SPLASH_MAX = 9000, done = false;
  // the house rule: motion is WAAPI, never @keyframes (the owner's Windows does not render those)
  try {
    el.querySelector('img').animate([{ opacity: .55, transform: 'scale(.97)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: 1100, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
    el.querySelector('.bb i').animate([{ transform: 'translateX(-110%)' }, { transform: 'translateX(260%)' }],
      { duration: 1250, iterations: Infinity, easing: 'cubic-bezier(.45,.05,.55,.95)' });
  } catch (e) {}
  function off() { if (done) return; done = true; document.body.classList.add('spot-booted'); try { mo.disconnect(); } catch (e) {} }
  // ASK WHAT THE PAGE DECIDED, NEVER WHAT THE MARKUP SAYS. The first cut tested the gate's hidden attribute -
  // which starts FALSE in the markup - so the splash switched itself off 200 ms in and the reader got a blank
  // screen instead. The terminal's own body class, or gateMode() saying it has chosen, are the two real signals.
  function ready() {
    var b = document.body;
    return !!(b && (b.classList.contains('spot-term') || b.classList.contains('spot-booted')));
  }
  var mo = new MutationObserver(function () { if (ready()) off(); });
  try { mo.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['class', 'hidden'] }); } catch (e) {}
  setTimeout(off, SPLASH_MAX);
  if (ready()) off();
})();
</script>`;
const BEND = '</body>';
const bi = h.lastIndexOf(BEND);
if (bi < 0) throw new Error('no </body>');
h = h.slice(0, bi) + nl(JS) + N + h.slice(bi);

if ((h.match(/id="spotBoot"/g) || []).length !== 1) throw new Error('the splash is not injected exactly once');
if (h.indexOf('<meta charset') > h.indexOf('<head') + 40) throw new Error('charset must stay the first tag in head');
if (h.indexOf('term\.id = \'spotTerm\'') < 0 && h.indexOf("term.id = 'spotTerm'") < 0) throw new Error('run build/fix-spot-terminal.js first - the splash waits for its class');
console.log('fix-spot-boot: first-frame mp-li, the gate hidden for a member, the app-icon splash and its three exits');
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('  written: dist/spot/index.html\n  NEXT: node build/gen-spot-i18n.js && node build/es/check-inline-js.js');
