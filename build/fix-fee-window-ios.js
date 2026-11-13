/* THE FEE WINDOW ON A CLOSED TICKET, HARDENED FOR THE PHONE (2026-11-13, owner on iOS Safari / the installed app: "na tiketima kad
   kliknem na fee hyperlink nista se ne otvara").
   The tap could not be reproduced on an emulated iPhone (tab and standalone: the window opens and stays). Three things an emulator
   cannot stage are closed here, in BOTH drawer bundles (the chat/drawer pair is duplicated by design):
   1. A FULL RE-RENDER WIPES THE WINDOW: render() rebuilds #jrList's innerHTML and the window is a class on a node inside it. A
      signed-in phone re-renders on every journal pull that brought anything new (mp-auth: syncTrades 12 s, pullTrades 40 s, the
      visibility change when the app comes to the front) - an emulator with a mocked account never does. render() now remembers the
      card whose window is open and re-opens it on the fresh node.
   2. THE OUTSIDE-CLICK BRANCH CLOSED IT ON ANY CLICK, trusted or not: the haptic label's synthetic click (iosTick) and WebKit's
      TRUSTED activation click on the hidden switch are both document-level clicks whose target is outside the window - the exact
      socials-menu bug of 2026-10-27. The branch ignores untrusted clicks, [data-mp-haptic] and input[switch] targets, and any click
      inside 350 ms of the open.
   3. AN INSTRUMENT, since the phone is the only WebKit we have: on an iOS device the fee branch sends ONE `t=diag` row per tap
      ("fee open ..." - whether the window node exists, is on, its height and what elementFromPoint finds over it 400 ms later), and a
      touchend on the Fees value that is followed by NO click inside 500 ms says so ("fee noclick"). Capped at 4 rows a page, iOS only,
      read at /api/admin/activity?h=24&n=5000&e2e=1 (r.t==='diag', field e starting "fee "). Delete once it has answered.
   Idempotent; --dry prints only. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DRY = process.argv.includes('--dry');
const MARK = '/* @FEEKEEP */';
const RENDER_HEAD = "function render(){\n    var listEl=document.getElementById('jrList'),statsEl=document.getElementById('jrStats'),emptyEl=document.getElementById('jrEmpty');\n    if(!listEl||!statsEl)return;";
const RENDER_KEEP = RENDER_HEAD + "\n    var _fbKeep=null;try{var _fbo=listEl.querySelector('.pp-feebd.on'),_fbc=_fbo&&_fbo.closest('.pp');_fbKeep=_fbc?_fbc.getAttribute('data-id'):null;}catch(_){} " + MARK + " /* the fee window open on a card survives the rebuild (iOS: a journal pull re-renders under the finger, 2026-11-13) */";
const RENDER_TAIL = "    if(emptyEl)emptyEl.style.display='none';\n  }";
const RENDER_TAIL_KEEP = "    if(emptyEl)emptyEl.style.display='none';\n    try{if(_fbKeep){var _fbn=listEl.querySelector('.pp[data-id=\"'+_fbKeep+'\"] .pp-feebd');if(_fbn)_fbn.classList.add('on');}}catch(_){}\n  }";
const OLD_HANDLER_A = "      var f=ev.target.closest&&ev.target.closest('.pp-fee');\n      if(f){ev.stopPropagation();ev.preventDefault();\n        var card=f.closest('.pp');if(!card)return;\n        var bd=card.querySelector('.pp-feebd');if(!bd)return;\n        var was=bd.classList.contains('on');\n        try{document.querySelectorAll('.pp-feebd.on').forEach(function(o){o.classList.remove('on');});}catch(_){}\n        if(!was){bd.classList.add('on');try{feeMxFill(bd);}catch(_){}}\n        return;}\n      try{document.querySelectorAll('.pp-feebd.on').forEach(function(o){if(!o.contains(ev.target))o.classList.remove('on');});}catch(_){}\n    },true);}";
const NEW_HANDLER_A = "      var f=ev.target.closest&&ev.target.closest('.pp-fee');\n      if(f){ev.stopPropagation();ev.preventDefault();window._mpFeeClickAt=Date.now();\n        var card=f.closest('.pp');if(!card){feeDiag('open nocard');return;}\n        var bd=card.querySelector('.pp-feebd');if(!bd){feeDiag('open nobd');return;}\n        var was=bd.classList.contains('on');\n        try{document.querySelectorAll('.pp-feebd.on').forEach(function(o){o.classList.remove('on');});}catch(_){}\n        if(!was){bd.classList.add('on');window._mpFeeOpenAt=Date.now();try{feeMxFill(bd);}catch(_){}feeWatch(bd);}\n        return;}\n      /* the outside tap closes it - but never a synthetic click, the haptic label's activation click (WebKit delivers it TRUSTED, on the hidden switch) or any click inside 350 ms of the open (2026-10-27 socials lesson) */\n      if(ev.isTrusted===false)return;\n      if(ev.target&&ev.target.closest&&ev.target.closest('[data-mp-haptic],input[switch]'))return;\n      if(Date.now()-(window._mpFeeOpenAt||0)<350)return;\n      try{document.querySelectorAll('.pp-feebd.on').forEach(function(o){if(!o.contains(ev.target))o.classList.remove('on');});}catch(_){}\n    },true);\n    /* iOS-only instrument (2026-11-13): the phone says what happened to the window after a tap, and whether a tap produced a click at all */\n    var _feeIos=/iPhone|iPad|iPod/.test(navigator.userAgent),_feeDiagN=0;\n    function feeDiag(s){try{if(!_feeIos||_feeDiagN++>=4)return;var lab=('fee sa'+(navigator.standalone?1:0)+' '+s).replace(/[^a-zA-Z0-9 #:._/-]/g,'').slice(0,110);var u='/api/track?t=diag&e='+encodeURIComponent(lab)+'&p='+encodeURIComponent(location.pathname);if(navigator.sendBeacon)navigator.sendBeacon(u);else fetch(u,{keepalive:true}).catch(function(){});}catch(_){}}\n    function feeWatch(bd){if(!_feeIos)return;setTimeout(function(){try{var on=bd.classList.contains('on'),live=bd.isConnected,r=bd.getBoundingClientRect(),cs=getComputedStyle(bd),c=document.elementFromPoint(r.left+r.width/2,r.top+Math.min(30,r.height/2));var d=c?(c.tagName+(c.className&&typeof c.className==='string'?'.'+c.className.split(' ')[0]:'')):'none';feeDiag('open dt400 on'+(on?1:0)+' live'+(live?1:0)+' h'+Math.round(r.height)+' d:'+cs.display+' o:'+cs.opacity+' top:'+d);}catch(_){}},400);}\n    if(_feeIos)document.addEventListener('touchend',function(ev){try{var f=ev.target&&ev.target.closest&&ev.target.closest('.pp-fee');if(!f)return;var t0=Date.now();setTimeout(function(){if(!(window._mpFeeClickAt>=t0-50))feeDiag('noclick');},500);}catch(_){}},{capture:true,passive:true});}";
function patch(file) {
  const p = path.join(ROOT, 'dist', 'assets', file); let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf(MARK) >= 0) { console.log(file + ': already patched'); return; }
  const n1 = s.split(RENDER_HEAD).length - 1; if (n1 !== 1) throw new Error(file + ': render head found ' + n1 + ' times');
  s = s.split(RENDER_HEAD).join(RENDER_KEEP);
  // the render tail: the FIRST occurrence after the head is this render's own
  const hi = s.indexOf(MARK), ti = s.indexOf(RENDER_TAIL, hi); if (ti < 0 || ti - hi > 40000) throw new Error(file + ': render tail not found after the head');
  s = s.slice(0, ti) + RENDER_TAIL_KEEP + s.slice(ti + RENDER_TAIL.length);
  const n2 = s.split(OLD_HANDLER_A).length - 1; if (n2 !== 1) throw new Error(file + ': fee handler found ' + n2 + ' times');
  s = s.split(OLD_HANDLER_A).join(NEW_HANDLER_A);
  if (!DRY) { fs.writeFileSync(p + '.tmp', s); fs.renameSync(p + '.tmp', p); }
  console.log(file + ': render keeps the open fee window, the handler ignores synthetic/haptic clicks, iOS diag wired' + (DRY ? ' (dry)' : ''));
}
patch('home.js'); patch('mp-trade.js');
/* the copy row's font (owner, same day: "ovo @ kod copied from ... font je jako los i ne spoznaje se da je odma @"): Space Mono's @
   is the glyph the owner rejected on the socials handle on 2026-10-27; the row is Familjen Grotesk like that handle. */
const CSS_OLD = ".pp-copy{display:flex;align-items:center;gap:6px;margin:-3px 0 9px;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.04em;color:#8b97a5;white-space:nowrap;min-width:0;}.pp-copy svg{flex:none;color:#6f7b89;}.pp-copy span{min-width:0;overflow:hidden;text-overflow:ellipsis;}.pp-copy b{font-weight:700;color:#c7cdd4;cursor:pointer;}";
const CSS_NEW = ".pp-copy{display:flex;align-items:center;gap:6px;margin:-3px 0 9px;font-family:'Familjen Grotesk',sans-serif;font-size:11.5px;font-weight:500;letter-spacing:0;color:#8b97a5;white-space:nowrap;min-width:0;font-variant-ligatures:none;}.pp-copy svg{flex:none;color:#6f7b89;}.pp-copy span{min-width:0;overflow:hidden;text-overflow:ellipsis;}.pp-copy b{font-weight:700;color:#e9edf2;cursor:pointer;}";
for (const f of ['home.css', 'mp-trade.css']) {
  const p = path.join(ROOT, 'dist', 'assets', f); let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf(CSS_NEW) >= 0) { console.log(f + ': copy row font already Familjen'); continue; }
  const n = s.split(CSS_OLD).length - 1; if (n !== 1) throw new Error(f + ': copy row rule found ' + n + ' times');
  s = s.split(CSS_OLD).join(CSS_NEW);
  if (!DRY) { fs.writeFileSync(p + '.tmp', s); fs.renameSync(p + '.tmp', p); }
  console.log(f + ': copy row set in Familjen Grotesk' + (DRY ? ' (dry)' : ''));
}
