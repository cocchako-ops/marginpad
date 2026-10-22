#!/usr/bin/env node
/* THE OPENING ROOM IS DECIDED BY A FUNCTION THAT LIVES IN A DEFERRED BUNDLE (2026-10-22).

   A REGRESSION FROM THE FRAME-0 IDENTITY WORK, and a good lesson: making the chat open EARLIER moved its room
   decision in front of the thing that makes it. `mpWelcomeCard.defaultRoom` is defined in mp-auth.js, so on a
   fast open it is simply not there yet - and `showChat._picked` was set to 1 regardless, so the decision was
   never retried. A brand-new member's FIRST open still landed in Welcome (mp-auth had parsed by then) and the
   one after a reload did not. Caught by chat-welcome-e2e, which is exactly what that suite is for.

   The fix is not to go back to waiting. It is to let the chat OPEN at frame 0 and let the room decision happen
   when it can: `pickRoom()` is the one place it is made, it refuses to mark itself done until the rule it needs
   exists, and it is retried on the mp:xp poll that mp-auth already fires.

   `switchRoom(r, auto)` gained one flag. An AUTOMATIC default must not be written to `mp_ctroom`: that key means
   "the reader deliberately chose this room", and a default that remembers itself would make every later visit
   look like a choice and silently pin the member there.

   MIRRORED BY HAND in home.js and mp-trade.js, like every other copy in this pair.
   Idempotent, --dry. Refuses rather than guessing.                                                            */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const done = [];

const PICK = [
  "  /* THE OPENING ROOM IS DECIDED HERE, ONCE, AND NOT BEFORE IT CAN BE (2026-10-22). defaultRoom lives in",
  "     mp-auth.js, which is DEFERRED - and since the chat now opens at frame 0 it can run first. Marking the",
  "     decision done while the rule was missing is what sent a new member to All after a reload. */",
  "  function pickRoom(){",
  "    if(showChat._picked)return;",
  "    var w=window.mpWelcomeCard; if(!w)return;              // not yet - the mp:xp poll calls this again",
  "    showChat._picked=1;",
  "    var me=(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me())||(window.mpMe&&window.mpMe.in?window.mpMe.user:null);",
  "    var d; try{d=w.defaultRoom(me);}catch(e){return;}",
  "    if(!d||d===room||chatRooms().indexOf(d)<0)return;",
  "    switchRoom(d,true);                                    // true = automatic, so it is NOT remembered as a choice",
  "  }",
  "  window.addEventListener('mp:xp',function(){try{pickRoom();}catch(e){}});",
].join('\n');

for (const f of ['home.js', 'mp-trade.js']) {
  const F = path.join(__dirname, '..', 'dist', 'assets', f);
  let h = fs.readFileSync(F, 'utf8');
  const before = h;

  // 1. switchRoom learns the difference between a choice and a default
  const A1 = "function switchRoom(r){if(r===room||chatRooms().indexOf(r)<0)return;room=r;try{if(window.mpWelcomeCard)window.mpWelcomeCard.remember(r);}catch(e){}";
  const B1 = "function switchRoom(r,auto){if(r===room||chatRooms().indexOf(r)<0)return;room=r;/* an AUTOMATIC default must never be written to mp_ctroom: that key means the reader CHOSE this room, and a default that remembers itself pins them there for ever */try{if(!auto&&window.mpWelcomeCard)window.mpWelcomeCard.remember(r);}catch(e){}";
  if (h.indexOf('function switchRoom(r,auto)') < 0) {
    const n = h.split(A1).length - 1;
    if (n !== 1) throw new Error(f + ': switchRoom appears ' + n + ' times, expected 1');
    h = h.split(A1).join(B1);
    done.push(f + ': switchRoom tells a choice from a default');
  }

  // 2. the decision becomes retryable
  const A2 = "if(!showChat._picked){showChat._picked=1;try{var _dr=window.mpWelcomeCard&&window.mpWelcomeCard.defaultRoom(_me);if(_dr&&_dr!==room&&chatRooms().indexOf(_dr)>=0)room=_dr;}catch(e){}}";
  const B2 = "if(!showChat._picked){var _wc0=window.mpWelcomeCard;if(_wc0){showChat._picked=1;try{var _dr=_wc0.defaultRoom(_me);if(_dr&&_dr!==room&&chatRooms().indexOf(_dr)>=0)room=_dr;}catch(e){}}}";
  if (h.indexOf('var _wc0=window.mpWelcomeCard') < 0) {
    const n = h.split(A2).length - 1;
    if (n !== 1) throw new Error(f + ': the room pick in showChat appears ' + n + ' times, expected 1');
    h = h.split(A2).join(B2);
    done.push(f + ': the pick is not marked done while the rule is missing');
  }

  // 3. and is retried when mp-auth arrives
  const A3 = "  function showGate(){";
  if (h.indexOf('function pickRoom(){') < 0) {
    const n = h.split(A3).length - 1;
    if (n !== 1) throw new Error(f + ': showGate appears ' + n + ' times, expected 1');
    h = h.split(A3).join(PICK + '\n' + A3);
    done.push(f + ': pickRoom(), retried on the mp:xp poll');
  }

  if (h !== before && !DRY) fs.writeFileSync(F, h);
}

if (!done.length) { console.log('fix-chat-room-pick: nothing to do (already applied)'); process.exit(0); }

if (!DRY) {
  for (const f of ['home.js', 'mp-trade.js']) {
    const h = fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', f), 'utf8');
    if ((h.match(/function pickRoom\(\)/g) || []).length !== 1) throw new Error(f + ': pickRoom is not defined exactly once');
    if ((h.match(/function switchRoom\(r,auto\)/g) || []).length !== 1) throw new Error(f + ': switchRoom was not updated exactly once');
    if (h.indexOf('switchRoom(d,true)') < 0) throw new Error(f + ': the automatic pick must not be remembered');
    if (!/if\(!auto&&window\.mpWelcomeCard\)window\.mpWelcomeCard\.remember\(r\)/.test(h)) throw new Error(f + ': a deliberate switch must still be remembered');
  }
}

console.log('fix-chat-room-pick: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
console.log('  NEXT: node build/bump-home-assets.js && npm run deploy && node build/chat-welcome-e2e.js');
