/* A MENTION NOTIFICATION LANDS ON THE MESSAGE, AND A MENTION TOAST IS SHOWN ONCE, AS TEXT (2026-10-22).
   Malikush (DM): "if I'm tagged on the chat section and am notified, if I click on it it doesn't take me directly to the
   message, instead it takes me to the recent message." Owner: an already-read mention popped up again on return, printed
   as "<b>@ibrar0805</b> mentioned you in chat" - brackets and all.
   Three faults, two bundles (the chat lives byte-identical in home.js and mp-trade.js; this patches both or neither):
     1. the toast passed HTML through `msg`, which mpToast ESCAPES (that is what `msg` is for) - `html` is the field;
     2. ctAfterAdd runs for every HISTORY row too, so a mention in the last 150 messages toasted on every page load the
        chat box was shut - once per message per device now (localStorage mp_ct_mntoast), and never for one over a day old;
     3. the bell link was a bare ?chat=1 - it carries ?m=<message id> now (worker) and ctJump() scrolls that row to the
        centre once the history has rendered, lights it (WAAPI - the owner's machine renders no @keyframes), releases the
        stick-to-bottom so the next live message cannot yank it away, and says so when the room no longer holds it.
   Idempotent; --dry prints without writing; refuses unless every anchor is unique in BOTH files. */
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const DIR = path.join(__dirname, '..', 'dist', 'assets');
const FILES = ['home.js', 'mp-trade.js'];
const EDITS = [
  { what: 'toast as html, once per message',
    skipIf: 'function ctMnFresh(m)',
    a: "    if(hit&&box&&box.hidden){try{if(window.mpToast)window.mpToast({msg:'<b>@'+esc(m.u)+'</b> mentioned you in chat',kind:'xp',ms:7000,key:'ctmn',action:{label:'Open chat',onClick:function(){try{openBox();}catch(e){}}}});}catch(e){}}",
    b: "    if(hit&&box&&box.hidden&&ctMnFresh(m)){try{if(window.mpToast)window.mpToast({html:'<b>@'+esc(m.u)+'</b> mentioned you in chat',kind:'xp',ms:7000,key:'ctmn',action:{label:'Open chat',onClick:function(){try{openBox();}catch(e){}}}});}catch(e){}}" },
  { what: 'ctMnFresh + ctJump helpers',
    skipIf: 'function ctJump()',
    a: "  function ctAfterAdd(d,m){",
    b: "  /* ONCE PER MESSAGE PER DEVICE, AND NEVER A STALE ONE (2026-10-22): ctAfterAdd also runs for the 150 history rows the socket replays on\n"
     + "     every connect, so a mention the reader had already opened toasted again on every page load - with its HTML escaped. */\n"
     + "  function ctMnFresh(m){try{var id=String(m.id!=null?m.id:(m.ts||''));var ts=+m.ts||0;if(!id||(ts&&Date.now()-ts>86400000))return false;var seen=JSON.parse(localStorage.getItem('mp_ct_mntoast')||'[]');if(seen.indexOf(id)>=0)return false;seen.push(id);if(seen.length>40)seen=seen.slice(-40);localStorage.setItem('mp_ct_mntoast',JSON.stringify(seen));return true;}catch(e){return true;}}\n"
     + "  /* A MENTION NOTIFICATION LANDS ON THE MESSAGE (2026-10-22, Malikush: \"it takes me to the recent message\"): the bell link carries ?m=<id>;\n"
     + "     once the history has rendered that row is centred and lit, the auto-stick is released so the next live message cannot pull the\n"
     + "     view away, and a message the room no longer holds says so instead of silently landing at the bottom. */\n"
     + "  var ctJumpId=(function(){try{var q=location.search.match(/[?&]m=([A-Za-z0-9]+)/);return q?q[1]:'';}catch(e){return '';}})();\n"
     + "  function ctJump(){if(!ctJumpId||!box||box.hidden)return;var row=msgById(ctJumpId);if(!row){if(msgs&&msgs.querySelector('.ct-msg')){ctJumpId='';try{if(window.mpToast)window.mpToast({msg:'That message is older than the room keeps (the last 150).',kind:'info',ms:6000,key:'ctmnold'});}catch(e){}}return;}ctJumpId='';ctStick=false;if(row.className.indexOf('ct-hit')<0)row.className+=' ct-hit';try{row.scrollIntoView({block:'center'});}catch(e){try{row.scrollIntoView();}catch(_){}}try{row.animate([{background:'rgba(194,246,74,.38)'},{background:'rgba(194,246,74,.38)',offset:.45},{background:'transparent'}],{duration:2400});}catch(e){}}\n"
     + "  function ctAfterAdd(d,m){" },
  { what: 'jump after the history renders',
    skipIf: 'mnQueue();try{ctJump();}catch(e){}}',
    a: "(d.messages||[]).forEach(addMsg);msgs.scrollTop=msgs.scrollHeight;mnQueue();}",
    b: "(d.messages||[]).forEach(addMsg);msgs.scrollTop=msgs.scrollHeight;mnQueue();try{ctJump();}catch(e){}}" },
  { what: 'jump when the box opens over an already-rendered history',
    skipIf: 'box.hidden=false;fab.hidden=true;setTimeout(function(){try{ctJump();}catch(e){}},80);',
    a: "  function openBox(){chatAlert(false);markChatSeen();box.hidden=false;fab.hidden=true;",
    b: "  function openBox(){chatAlert(false);markChatSeen();box.hidden=false;fab.hidden=true;setTimeout(function(){try{ctJump();}catch(e){}},80);" },
];
let bad = 0;
for (const f of FILES) {
  const F = path.join(DIR, f); let s = fs.readFileSync(F, 'utf8'); const done = [], did = [];
  for (const e of EDITS) {
    if (s.indexOf(e.skipIf) >= 0) { done.push(e.what); continue; }
    const i = s.indexOf(e.a); if (i < 0) { console.error(f + ': anchor missing for "' + e.what + '"'); bad++; continue; }
    if (s.indexOf(e.a, i + 1) >= 0) { console.error(f + ': anchor not unique for "' + e.what + '"'); bad++; continue; }
    s = s.split(e.a).join(e.b); did.push(e.what);
  }
  if (bad) continue;
  if (!DRY && did.length) { fs.writeFileSync(F + '.tmp', s); fs.renameSync(F + '.tmp', F); }
  console.log(f + ': ' + (did.length ? (DRY ? 'would apply ' : 'applied ') + did.join(' | ') : 'nothing to do') + (done.length ? ' (already: ' + done.join(', ') + ')' : ''));
}
if (bad) { console.error('refused - nothing written'); process.exit(1); }
