#!/usr/bin/env node
/* THE WELCOME ROOM IS RETIRED, AND THE SQUAD ROOM WEARS ITS LOGO (2026-11-12, owner: "Ugasicemo welcome chat room i
   welcome poruke. To ne treba da postoji. Klan (squad) room logo treba da bude nekako cool.")

   Applied to BOTH chat copies - dist/assets/home.js and dist/assets/mp-trade.js - because the room bar, the opening
   room and the welcome row were byte-identical in the pair and hand-mirroring is how this pair drifts.

   What goes: 'WELCOME' out of chatRooms(), its label, its icon (CT_WAVE), the local welcome row after the history
   frame, the "Say hello" placeholder, and the whole "open a young account in Welcome" decision (mpWelcomeCard.defaultRoom
   + pickRoom). What stays: the REMEMBERED room (localStorage mp_ctroom) - the chat opens where the reader last chose,
   else All; switchRoom writes it directly now that mpWelcomeCard is gone from mp-auth.

   What arrives: the squad room's row in the room menu is a card - the squad's own crest (window.mpSquadCrest, the one
   renderer every squad surface uses) over a tint of its own colour, the TAG, the squad name and its level - and the
   chip in the header wears the crest and the colour while that room is open.

   Idempotent: every edit checks its anchor count and skips a file already patched. `--dry` prints and writes nothing. */
'use strict';
const fs = require('fs'), path = require('path');
const DRY = process.argv.includes('--dry');
const ROOT = path.resolve(__dirname, '..');
const FILES = ['dist/assets/home.js', 'dist/assets/mp-trade.js'];

function must(src, needle, n, what) {
  const c = src.split(needle).length - 1;
  if (c !== n) throw new Error(what + ': expected ' + n + ' occurrence(s) of anchor, found ' + c);
}
function cut(src, startMark, endMarkAfter, what) {
  // remove from the start of the line holding startMark to the end of the line holding endMarkAfter (searched after startMark)
  const i = src.indexOf(startMark); if (i < 0) throw new Error(what + ': start anchor missing');
  const ls = src.lastIndexOf('\n', i) + 1;
  const j = src.indexOf(endMarkAfter, i); if (j < 0) throw new Error(what + ': end anchor missing');
  const le = src.indexOf('\n', j); if (le < 0) throw new Error(what + ': end of line missing');
  return src.slice(0, ls) + src.slice(le + 1);
}

const SQ_ITEM =
  "  /* THE SQUAD ROOM IS A CARD IN THE MENU (2026-11-12, owner: \"logo treba da bude nekako cool\"): the squad's own crest through\n" +
  "     window.mpSquadCrest (the ONE renderer), the tag, the name and the level, on a tint of the crest's own colour (--sq). The\n" +
  "     colour is validated against the renderer's palette so a stale client can never paint an arbitrary string into CSS. */\n" +
  "  function sqCol(){try{var c=window.mpSquad&&window.mpSquad.crest,cols=window.mpSquadCrestCols||[];var bg=c&&String(c.bg||'');return cols.indexOf(bg)>=0?bg:'#4aa3f6';}catch(e){return '#4aa3f6';}}\n" +
  "  function roomItemHtml(r){var isSq=!!(window.mpSquad&&window.mpSquad.sid===r);if(isSq){var sq=window.mpSquad,lv=(sq.level&&+sq.level.lv)||0;return '<button type=\"button\" class=\"ct-roomitem ct-roomsq'+(r===room?' on':'')+'\" data-room=\"'+r+'\" style=\"--sq:'+sqCol()+'\"><span class=\"ct-riw\">'+roomIcon(r)+'</span><span class=\"ct-ri-l\"><b>'+roomLabel(r)+'</b><small>'+esc(String(sq.name||'Squad').slice(0,28))+(lv?' · Lv '+lv:'')+'</small></span>'+CT_CHECK+'</button>';}return '<button type=\"button\" class=\"ct-roomitem'+(r===room?' on':'')+(r==='PREMIUM'?' ct-roomprem':'')+'\" data-room=\"'+r+'\"><span class=\"ct-riw\">'+roomIcon(r)+'</span><span class=\"ct-ri-l\">'+roomLabel(r)+'</span>'+CT_CHECK+'</button>';}\n" +
  "  function roomBtnDeco(){if(!roomBar)return;var b=roomBar.querySelector('.ct-roombtn');if(!b)return;var isSq=!!(window.mpSquad&&window.mpSquad.sid===room);b.classList.toggle('ct-rbsq',isSq);if(isSq)b.style.setProperty('--sq',sqCol());else b.style.removeProperty('--sq');}\n";

for (const rel of FILES) {
  const fp = path.join(ROOT, rel);
  let s = fs.readFileSync(fp, 'utf8');
  if (s.indexOf("var b=['global','WELCOME']") < 0 && s.indexOf('function roomItemHtml(') >= 0) { console.log(rel + ': already patched'); continue; }

  // 1. the room list
  must(s, "var b=['global','WELCOME'];", 1, rel + ' chatRooms'); s = s.split("var b=['global','WELCOME'];").join("var b=['global'];");
  // 2. the label
  must(s, "if(r==='global')return 'All';if(r==='WELCOME')return 'Welcome';", 1, rel + ' roomLabel'); s = s.split("if(r==='global')return 'All';if(r==='WELCOME')return 'Welcome';").join("if(r==='global')return 'All';");
  // 3. the icon constant
  must(s, '  var CT_WAVE=', 1, rel + ' CT_WAVE'); s = cut(s, '  var CT_WAVE=', '</svg>\';', rel + ' CT_WAVE line');
  // 4. the icon switch: the squad room draws its crest
  must(s, "function roomIcon(r){if(r==='WELCOME')return CT_WAVE;if(r==='PREMIUM')return CT_STAR;", 1, rel + ' roomIcon');
  s = s.split("function roomIcon(r){if(r==='WELCOME')return CT_WAVE;if(r==='PREMIUM')return CT_STAR;").join("function roomIcon(r){if(window.mpSquad&&window.mpSquad.sid===r&&window.mpSquadCrest){var _sq=window.mpSquad;return window.mpSquadCrest(_sq.crest,28,_sq.tag,_sq.level&&_sq.level.lv);}if(r==='PREMIUM')return CT_STAR;");
  // 5. the menu rows go through roomItemHtml; the squad helpers sit right above buildRoomBar
  const oldMap = "'<div class=\"ct-roommenu\" hidden>'+chatRooms().map(function(r){return '<button type=\"button\" class=\"ct-roomitem'+(r===room?' on':'')+(r==='PREMIUM'?' ct-roomprem':'')+'\" data-room=\"'+r+'\"><span class=\"ct-riw\">'+roomIcon(r)+'</span><span class=\"ct-ri-l\">'+roomLabel(r)+'</span>'+CT_CHECK+'</button>';}).join('')+'</div>';";
  must(s, oldMap, 1, rel + ' menu map'); s = s.split(oldMap).join("'<div class=\"ct-roommenu\" hidden>'+chatRooms().map(roomItemHtml).join('')+'</div>';roomBtnDeco();");
  must(s, '  function buildRoomBar(){\n', 1, rel + ' buildRoomBar'); s = s.split('  function buildRoomBar(){\n').join(SQ_ITEM + '  function buildRoomBar(){\n');
  // the chip follows the room on every switch
  const mrp = 'function markRoomPills(){if(!roomBar)return;';
  must(s, mrp, 1, rel + ' markRoomPills'); s = s.split(mrp).join('function markRoomPills(){if(!roomBar)return;roomBtnDeco();');
  // 6. the welcome row
  must(s, "  /* THE NEWCOMER'S WELCOME IS A LOCAL ROW", 1, rel + ' welcRow comment'); s = cut(s, "  /* THE NEWCOMER'S WELCOME IS A LOCAL ROW", 'msgs.appendChild(d);}', rel + ' welcRow block');
  must(s, '(d.messages||[]).forEach(addMsg);try{welcRow();}catch(e){}msgs.scrollTop', 1, rel + ' welcRow call'); s = s.split('(d.messages||[]).forEach(addMsg);try{welcRow();}catch(e){}msgs.scrollTop').join('(d.messages||[]).forEach(addMsg);msgs.scrollTop');
  // 7. the remembered room is written by switchRoom itself
  const rem = 'try{if(!auto&&window.mpWelcomeCard)window.mpWelcomeCard.remember(r);}catch(e){}';
  must(s, rem, 1, rel + ' remember'); s = s.split(rem).join("try{if(!auto)localStorage.setItem('mp_ctroom',String(r));}catch(e){}");
  // 8. the placeholder
  must(s, "room==='WELCOME'?'Say hello…':", 2, rel + ' placeholder'); s = s.split("room==='WELCOME'?'Say hello…':").join('');
  // 9. the opening room: the remembered choice, else All, decided at once
  const pick0 = '/* a week-old account with no remembered room opens in the Welcome room (2026-10-22) */if(!showChat._picked){var _wc0=window.mpWelcomeCard;if(_wc0){showChat._picked=1;try{var _dr=_wc0.defaultRoom(_me);if(_dr&&_dr!==room&&chatRooms().indexOf(_dr)>=0)room=_dr;}catch(e){}}}';
  must(s, pick0, 1, rel + ' showChat pick'); s = s.split(pick0).join("/* the chat opens in the room the reader last CHOSE (mp_ctroom, written by switchRoom), else All - the Welcome room and its default were retired 2026-11-12 (owner) */if(!showChat._picked){showChat._picked=1;try{var _dr=localStorage.getItem('mp_ctroom')||'';if(_dr&&_dr!==room&&chatRooms().indexOf(_dr)>=0)room=_dr;}catch(e){}}");
  const go0 = '/* DECIDE THE ROOM BEFORE OPENING THE SOCKET. defaultRoom lives in the deferred mp-auth, so give it a moment rather than connecting to the wrong room and switching under the reader. Capped at ~2.4s; an empty stream for a beat is what they would see anyway while history loads. */(function go(n){try{pickRoom();}catch(e){}if(showChat._picked||n>40){connect();return;}setTimeout(function(){go(n+1);},60);})(0);';
  must(s, go0, 1, rel + ' showChat go'); s = s.split(go0).join('connect();');
  // 10. pickRoom and its poll listener
  must(s, '  /* THE OPENING ROOM IS DECIDED HERE, ONCE', 1, rel + ' pickRoom comment');
  s = cut(s, '  /* THE OPENING ROOM IS DECIDED HERE, ONCE', "window.addEventListener('mp:xp',function(){try{pickRoom();}catch(e){}});", rel + ' pickRoom block');
  for (const left of ['WELCOME', 'welcRow', 'mpWelcomeCard', 'pickRoom', 'CT_WAVE']) { if (s.indexOf(left) >= 0) throw new Error(rel + ': "' + left + '" still present after the patch'); }

  if (DRY) { console.log(rel + ': would write ' + s.length + ' bytes'); continue; }
  fs.writeFileSync(fp + '.tmp', s); fs.renameSync(fp + '.tmp', fp);
  console.log(rel + ': patched');
}
