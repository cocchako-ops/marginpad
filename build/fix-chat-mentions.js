/* @MENTIONS, A COMPOSER THAT SUGGESTS REAL ACCOUNTS, AND A ROOM THAT STOPS YANKING THE READER TO THE BOTTOM
   (2026-10-18, owner: "kad kucam @, hocu da kako kucam username da mi se ponudi taj korisnik kog zelim da tagujem.
   Svaki mora da postoji." + "hteo bih da ovo sredimo maksimalno i da radi bas bas smooth ... haptics takodje")

   The room chat exists TWICE - dist/assets/home.js and dist/assets/mp-trade.js - and every function this touches is
   byte-identical in the two files (checked before writing, and checked again here). So the same replacements are
   applied to both from ONE table: that is the only way this pair stays in step, and hand-mirroring is how it has
   drifted before. The shared panel engine itself lives in mp-auth.js (window.mpMention).

   Idempotent: re-running finds the new text already in place and reports no-op. --dry prints without writing.      */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const DIR = path.join(__dirname, '..', 'dist', 'assets');
const FILES = ['home.js', 'mp-trade.js'];

/* ── the block of chat-side machinery, inserted once per file ─────────────────────────────────────────────────── */
const BLOCK = [
  "  /* ── @MENTIONS: EVERY SUGGESTION IS A REAL ACCOUNT (2026-10-18, owner) ───────────────────────",
  "     Two sources, both of them the server's, never a guess:",
  "       THE ROOM - the names the page can see speaking here, verified ONCE per chat session against the users",
  "                  table (/chat/who?c=), so the people in this conversation come first and the panel answers with",
  "                  no latency at all while typing;",
  "       THE REST  - a prefix query (/chat/who?q=), edge-cached, from two characters up.",
  "     A name the page shows but the table does not know is DROPPED from the list, which is the whole requirement:",
  "     an @ that notifies nobody is the bug, not the feature. Suspended and banned accounts are not suggestible",
  "     either, and neither is the reader themselves.",
  "     MIRRORED BY HAND in home.js and mp-trade.js - applied by build/fix-chat-mentions.js so it cannot drift. */",
  "  var mnVer={},mnBad={},mnPre={},mnPend={},mnCtl=null,mnTm=null,mnWt=null,mnWn=0,mnMe=null;",
  "  function mnKnown(k){return mnVer[String(k||'').toLowerCase()]||null;}",
  "  function mnNote(n){var k=String(n||'').toLowerCase();if(k&&!mnVer[k]&&!mnBad[k])mnPend[k]=n;}",
  "  function mnRoomReset(){mnPend={};}",
  "  /* newest speaker first - that order IS the ranking, because the person you mean is almost always the person",
  "     who just spoke. Read off the rendered stream, so it costs nothing and needs no second store. */",
  "  function mnSeen(){var out=[],at={};if(!msgs)return out;var n=msgs.querySelectorAll('.ct-user[data-lbu]');for(var i=n.length-1;i>=0;i--){var u=n[i].getAttribute('data-lbu')||'';var k=u.toLowerCase();if(!u||at[k])continue;at[k]=1;out.push(u);if(out.length>=14)break;}return out;}",
  "  function mnQueue(ms){if(mnTm)return;mnTm=setTimeout(function(){mnTm=null;try{mnVerify();}catch(e){}},ms||900);}",
  "  /* A MENTION IS NEVER A DEAD TAP. A chip is marked clickable only once the account is confirmed, and there is",
  "     always a window before that - measured on the live room the day this shipped, 16 of 56 chips were still",
  "     unconfirmed six seconds in, every one of them a real account. Tapping an unconfirmed one resolves it THEN,",
  "     in one request, and either opens the card or says plainly that no account carries that name. */",
  "  function mnOpen(n){n=String(n||'').replace(/[^a-zA-Z0-9_]/g,'');if(!n)return;",
  "    if(mnKnown(n)){openTraderCard(n);return;}",
  "    fetch('/chat/who?c='+encodeURIComponent(n),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){",
  "      var x=((j&&j.room)||[])[0];",
  "      if(x){var kk=String(x.u).toLowerCase();mnVer[kk]=x;delete mnBad[kk];try{mnPaint();}catch(e){}openTraderCard(x.u);return;}",
  "      chatNote('No account is named @'+n);",
  "    }).catch(function(){chatNote('Could not look up that name');});",
  "  }",
  "  function mnVerify(){",
  "    var need=[],at={},all=mnSeen(),k,i;",
  "    for(i=0;i<all.length;i++){k=all[i].toLowerCase();if(!mnVer[k]&&!mnBad[k]&&!at[k]){at[k]=1;need.push(all[i]);}}",
  "    for(k in mnPend){if(!mnVer[k]&&!mnBad[k]&&!at[k]){at[k]=1;need.push(mnPend[k]);}}",
  "    if(!need.length)return;",
  "    /* 40 A ROUND, NOT 14: a busy room carries ~14 speakers and five times that many names INSIDE messages, so a",
  "       small round spent its whole budget on speakers and the chips stayed plain for the best part of ten",
  "       seconds. The store chunks the lookup, so one round is one query. */",
  "    need=need.slice(0,40);",
  "    /* in flight: marked unknown so the next round does not ask for the same names again */",
  "    need.forEach(function(nm){mnBad[nm.toLowerCase()]=1;});",
  "    fetch('/chat/who?c='+encodeURIComponent(need.join(',')),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){",
  "      /* ONLY WHAT THE SERVER ACTUALLY LOOKED AT STAYS MARKED. A name it never examined - the two caps",
  "         disagreeing across a deploy, which really happened - would otherwise be unknown for ever. */",
  "      var seen={};((j&&j.seen&&j.seen.length)?j.seen:need).forEach(function(nm){seen[String(nm).toLowerCase()]=1;});",
  "      need.forEach(function(nm){var k2=nm.toLowerCase();if(!seen[k2])delete mnBad[k2];});",
  "      ((j&&j.room)||[]).forEach(function(x){var kk=String(x.u).toLowerCase();delete mnBad[kk];mnVer[kk]=x;});",
  "      try{mnPaint();}catch(e){}if(mnCtl)mnCtl.refresh();",
  "      /* A ROUND CARRIES 14 NAMES, and in a busy room the speakers alone fill it - so a name met only INSIDE a",
  "         message would never be confirmed and its chip would stay plain for ever (seen on the first render).",
  "         Ask again while anything is still unknown: a name the table does not have stays in mnBad, so a round",
  "         can only ever shrink the queue and this always converges. */",
  "      mnQueue(300);",
  "    }).catch(function(){need.forEach(function(nm){delete mnBad[nm.toLowerCase()];});});",
  "  }",
  "  /* a chip drawn before its name was confirmed becomes clickable the moment it is - no repaint of the stream */",
  "  function mnPaint(){if(!msgs)return;var n=msgs.querySelectorAll('[data-mn]');for(var i=0;i<n.length;i++){var el=n[i],nm=el.getAttribute('data-mn')||'';if(!nm||el.className.indexOf('ok')>=0)continue;if(!mnKnown(nm))continue;el.className='ct-mn ok';el.setAttribute('data-lbu',nm);el.setAttribute('role','button');el.setAttribute('tabindex','0');el.style.color=colorFor(nm);}}",
  "  function mnFind(q,cb){",
  "    q=String(q||'').toLowerCase();",
  "    var me=(user||'').toLowerCase(),out=[],at={};",
  "    var push=function(x,hint){var k=String(x.u||'').toLowerCase();if(!k||at[k]||k===me)return;at[k]=1;out.push({ins:x.u,label:'@'+x.u,hint:hint||'',col:x.col||''});};",
  "    var order=mnSeen();",
  "    for(var i=0;i<order.length;i++){var v=mnKnown(order[i]);if(v&&(!q||order[i].toLowerCase().indexOf(q)===0))push(v,'in the room');}",
  "    cb(out.slice(0,8));                 /* instant: the people in front of them, no request at all */",
  "    if(q.length<2)return;               /* one letter is a member directory, not a suggestion */",
  "    var done=function(j){((j&&j.more)||[]).forEach(function(x){var kk=String(x.u||'').toLowerCase();if(kk)mnVer[kk]=x;push(x,'');});try{mnPaint();}catch(e){}cb(out.slice(0,8));};",
  "    if(mnPre[q]){done(mnPre[q]);return;}",
  "    fetch('/chat/who?q='+encodeURIComponent(q)).then(function(r){return r.json();}).then(function(j){mnPre[q]=j||{};done(j);}).catch(function(){});",
  "  }",
  "  /* the SAME engine drives the slash commands, which is how they finally got arrow keys (mouse-only until now) */",
  "  function mnCmds(q,cb){ccProbe();if(!ccCmds){cb([]);return;}var qq='/'+String(q||'').toLowerCase();var l=(qq==='/')?ccCmds:ccCmds.filter(function(c){return c.c.indexOf(qq)===0;});cb(l.slice(0,8).map(function(c){return {ins:c.c.slice(1),label:c.u,hint:c.d,cmd:1};}));}",
  "  /* mp-auth.js is DEFERRED, so this bundle parses first and window.mpMention does not exist yet - looked up at",
  "     CALL time and retried, the same rule window.mpOrders follows. */",
  "  function mnWire(){",
  "    if(mnCtl||!input)return;",
  "    if(!window.mpMention){if(!mnWt&&mnWn<30){mnWt=setInterval(function(){mnWn++;if(window.mpMention||mnWn>=30){clearInterval(mnWt);mnWt=null;if(window.mpMention)mnWire();}},300);}return;}",
  "    mnCtl=window.mpMention(input,{host:form,triggers:{'@':mnFind,'/':mnCmds}});",
  "    var u=(user||'').toLowerCase();if(u)mnVer[u]={u:user,col:''};   /* the reader's own name needs no lookup */",
  "    mnQueue();",
  "  }",
  "  /* ── THE READER WHO SCROLLED UP KEEPS THEIR PLACE (2026-10-18) ─────────────────────────────",
  "     addMsg slammed the list to the bottom on EVERY arriving message, so reading anything older than the newest",
  "     line was impossible in a live room - the same fault /leaderboards/ had with its 120 s repaint. The jump now",
  "     happens only when they are already at the bottom (or it is their own message), and a pill says how much",
  "     they have not seen. */",
  "  var ctStick=true,ctNew=0,ctPillEl=null,ctMeRe=null;",
  "  function ctBottom(){return !msgs||(msgs.scrollHeight-msgs.scrollTop-msgs.clientHeight)<48;}",
  "  function ctPill(n){",
  "    ctNew=n||0;",
  "    if(!ctPillEl){",
  "      if(!ctNew||!box)return;",
  "      ctPillEl=document.createElement('button');ctPillEl.type='button';ctPillEl.className='ct-newp';",
  "      ctPillEl.addEventListener('click',function(){ctStick=true;ctPill(0);if(msgs)msgs.scrollTop=msgs.scrollHeight;});",
  "      box.appendChild(ctPillEl);",
  "    }",
  "    if(!ctNew){ctPillEl.className='ct-newp';return;}",
  "    ctPillEl.innerHTML='<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 5v14M5 12l7 7 7-7\"/></svg>'+ctNew+(ctNew===1?' new message':' new messages');",
  "    ctPillEl.className='ct-newp on';",
  "  }",
  "  if(msgs)msgs.addEventListener('scroll',function(){if(ctBottom()){ctStick=true;if(ctNew)ctPill(0);}else ctStick=false;});",
  "  /* did this message name the reader? word-bounded, case-insensitive, built once per name */",
  "  function ctNamesMe(t){if(!user)return false;if(!ctMeRe||ctMeRe._u!==user){ctMeRe=new RegExp('(^|[^a-zA-Z0-9_])@'+user.replace(/[^a-zA-Z0-9_]/g,'')+'(?![a-zA-Z0-9_])','i');ctMeRe._u=user;}return ctMeRe.test(String(t||''));}",
  "  function ctHit(row,m){if(!row)return false;var hit=!!(m&&!m.admin&&m.u!==user&&ctNamesMe(m.t));if(hit&&row.className.indexOf('ct-hit')<0)row.className+=' ct-hit';return hit;}",
  "  function ctAfterAdd(d,m){",
  "    var hit=ctHit(d,m),mine=!!(m&&m.u===user);",
  "    if(ctStick||mine){ctStick=true;if(ctNew)ctPill(0);msgs.scrollTop=msgs.scrollHeight;}",
  "    else if(m&&!m.admin)ctPill(ctNew+1);",
  "    try{mnNote(m&&m.u);}catch(e){}",
  "    if(m&&m.u&&m.u!==user)mnQueue();",
  "    /* NAMED WHILE THE CHAT IS SHUT: the one notification channel, with the one tap that answers it. The bell",
  "       notification covers the member who is not on the site at all; this covers the one who is. */",
  "    if(hit&&box&&box.hidden){try{if(window.mpToast)window.mpToast({msg:'<b>@'+esc(m.u)+'</b> mentioned you in chat',kind:'xp',ms:7000,key:'ctmn',action:{label:'Open chat',onClick:function(){try{openBox();}catch(e){}}}});}catch(e){}}",
  "  }",
  "  /* A MESSAGE NEEDS A NAME, AND THE ACCOUNT PANEL ALREADY ASKS FOR ONE. The room stamps the author from the",
  "     session now, so a member who never chose a username has no name to post under - 45 of 1,165 accounts the day",
  "     this shipped. They are told once, with the tap that fixes it, never silently dropped. */",
  "  function ctNeedName(){try{if(window.mpToast){window.mpToast({msg:'Pick a username to chat - one second, and it is yours for good.',kind:'warn',ms:8000,key:'ctname',action:{label:'Pick one',onClick:function(){try{if(window.mpAuth&&window.mpAuth.open)window.mpAuth.open();}catch(e){}}}});return;}}catch(e){}try{sysMsg('Pick a username in your account to chat.');}catch(e){}}",
  ""
].join('\n');

/* the on-demand opener, as one text so the undo below can match it exactly */
const MNOPEN = [
  "  /* A MENTION IS NEVER A DEAD TAP. A chip is marked clickable only once the account is confirmed, and there is",
  "     always a window before that - measured on the live room the day this shipped, 16 of 56 chips were still",
  "     unconfirmed six seconds in, every one of them a real account. Tapping an unconfirmed one resolves it THEN,",
  "     in one request, and either opens the card or says plainly that no account carries that name. */",
  "  function mnOpen(n){n=String(n||'').replace(/[^a-zA-Z0-9_]/g,'');if(!n)return;",
  "    if(mnKnown(n)){openTraderCard(n);return;}",
  "    fetch('/chat/who?c='+encodeURIComponent(n),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){",
  "      var x=((j&&j.room)||[])[0];",
  "      if(x){var kk=String(x.u).toLowerCase();mnVer[kk]=x;delete mnBad[kk];try{mnPaint();}catch(e){}openTraderCard(x.u);return;}",
  "      chatNote('No account is named @'+n);",
  "    }).catch(function(){chatNote('Could not look up that name');});",
  "  }",
  ""
].join('\n');

/* ── the replacement table: every `from` is byte-identical in both bundles ─────────────────────────────────────── */
const EDITS = [
  // undo first: a tree the previous cut double-inserted into (the anchor was the tail of its own replacement)
  { what: 'on-demand opener double undo', from: MNOPEN + MNOPEN, to: MNOPEN },
  // 1. the machinery block, inserted immediately before mentionify (which it feeds)
  {
    what: 'mention machinery block',
    from: "  /* @name -> the same clickable trader chip the chat already knows how to open. Applied ONLY to MarginPad's\n     own lines (welcome, gift announcements), where every name is one the server just resolved. */\n",
    to: BLOCK
  },
  // 1b. a second verification round while anything is still unknown (a busy room fills one round with speakers).
  //     Written into BLOCK too, so a fresh run produces the final text and this entry simply reports done.
  {
    what: 'second verification round',
    from: "      try{mnPaint();}catch(e){}if(mnCtl)mnCtl.refresh();\n    }).catch(",
    to: "      try{mnPaint();}catch(e){}if(mnCtl)mnCtl.refresh();\n      /* A ROUND CARRIES 14 NAMES, and in a busy room the speakers alone fill it - so a name met only INSIDE a\n         message would never be confirmed and its chip would stay plain for ever (seen on the first render).\n         Ask again while anything is still unknown: a name the table does not have stays in mnBad, so a round\n         can only ever shrink the queue and this always converges. */\n      mnQueue();\n    }).catch("
  },
  // 1c. bigger, faster verification rounds + the on-demand opener (measured 2026-10-18: 16 of 56 chips were still
  //     unconfirmed six seconds in, all of them real accounts). Written into BLOCK too, so a fresh run is a no-op.
  {
    what: 'rounds of 40',
    from: "    if(!need.length)return;\n    need=need.slice(0,14);",
    to: "    if(!need.length)return;\n    /* 40 A ROUND, NOT 14: a busy room carries ~14 speakers and five times that many names INSIDE messages, so a\n       small round spent its whole budget on speakers and the chips stayed plain for the best part of ten\n       seconds. The store chunks the lookup, so one round is one query. */\n    need=need.slice(0,40);"
  },
  {
    what: 'faster follow-up round',
    from: "  function mnQueue(){if(mnTm)return;mnTm=setTimeout(function(){mnTm=null;try{mnVerify();}catch(e){}},1200);}",
    to: "  function mnQueue(ms){if(mnTm)return;mnTm=setTimeout(function(){mnTm=null;try{mnVerify();}catch(e){}},ms||900);}"
  },
  { what: 'follow-up delay', from: "      mnQueue();\n    }).catch(", to: "      mnQueue(300);\n    }).catch(" },
  {
    what: 'on-demand mention opener',
    // AN ANCHOR THAT IS ALSO THE TAIL OF ITS OWN REPLACEMENT MATCHES FOR EVER (the switchRoom trap, the other way
    // round): this one inserts a function ABOVE mnFind and ends with mnFind's own opening line, so a second run
    // inserted it twice. skipIf is the guard - the function's name can only be there if this already ran.
    skipIf: 'function mnOpen(n)',
    from: "  function mnFind(q,cb){",
    to: MNOPEN + "  function mnFind(q,cb){"
  },
  {
    what: 'an unconfirmed chip is still a click',
    from: "var el=e.target.closest&&e.target.closest('[data-lbu]');if(el){e.stopPropagation();openTraderCard(el.getAttribute('data-lbu'));}});",
    to: "var el=e.target.closest&&e.target.closest('[data-lbu]');if(el){e.stopPropagation();openTraderCard(el.getAttribute('data-lbu'));return;}var mn=e.target.closest&&e.target.closest('[data-mn]');if(mn){e.stopPropagation();mnOpen(mn.getAttribute('data-mn'));}});"
  },
  // 1d. only what the server examined stays marked unknown (see BLOCK for why)
  {
    what: 'mark only what was examined',
    skipIf: 'ONLY WHAT THE SERVER ACTUALLY LOOKED AT',
    from: "      ((j&&j.room)||[]).forEach(function(x){var kk=String(x.u).toLowerCase();delete mnBad[kk];mnVer[kk]=x;});",
    to: "      /* ONLY WHAT THE SERVER ACTUALLY LOOKED AT STAYS MARKED. A name it never examined - the two caps\n         disagreeing across a deploy, which really happened - would otherwise be unknown for ever. */\n      var seen={};((j&&j.seen&&j.seen.length)?j.seen:need).forEach(function(nm){seen[String(nm).toLowerCase()]=1;});\n      need.forEach(function(nm){var k2=nm.toLowerCase();if(!seen[k2])delete mnBad[k2];});\n      ((j&&j.room)||[]).forEach(function(x){var kk=String(x.u).toLowerCase();delete mnBad[kk];mnVer[kk]=x;});"
  },
  // 2. mentionify: every message, and clickable only once the account is confirmed
  {
    what: 'mentionify',
    from: "  function mentionify(h){return h.replace(/(^|\\s)@([a-zA-Z0-9_]{2,20})/g,function(mm,p,n){return p+'<b class=\"ct-user\" data-lbu=\"'+n+'\" role=\"button\" tabindex=\"0\" style=\"color:'+colorFor(n)+'\">@'+n+'</b>';});}",
    to: "  /* @name in ANY message now, not only MarginPad's own lines - a mention the room cannot see is a mention that\n     did not happen. The chip is plain text until the server has confirmed the account exists (mnKnown), and only\n     then clickable, so a typo reads as what it is instead of a dead button. Names met here join the queue. */\n  function mentionify(h){return h.replace(/(^|\\s)@([a-zA-Z0-9_]{2,20})/g,function(mm,p,n){var ok=!!mnKnown(n);mnNote(n);return p+'<span class=\"ct-mn'+(ok?' ok':'')+'\" data-mn=\"'+n+'\"'+(ok?' data-lbu=\"'+n+'\" role=\"button\" tabindex=\"0\" style=\"color:'+colorFor(n)+'\"':'')+'>@'+n+'</span>';});}"
  },
  // 3. addMsg: mentionify every body
  {
    what: 'addMsg body',
    from: ":linkifyMsg(m.t);if(m.admin)_body=mentionify(_body);",
    to: ":mentionify(linkifyMsg(m.t));"
  },
  // 4. addMsg tail: scroll decision, mention hit, verification queue
  {
    what: 'addMsg tail',
    from: "msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;if(window.mpLvlDecorate)window.mpLvlDecorate();}",
    to: "msgs.appendChild(d);ctAfterAdd(d,m);if(window.mpLvlDecorate)window.mpLvlDecorate();}"
  },
  // 5. an edited message keeps its mentions (and its highlight)
  {
    what: 'edited body',
    from: "if(_b)_b.innerHTML=(window._mpParseSig&&window._mpParseSig(d.t))?window._mpSigCardHtml(window._mpParseSig(d.t)):linkifyMsg(d.t);",
    to: "if(_b)_b.innerHTML=(window._mpParseSig&&window._mpParseSig(d.t))?window._mpSigCardHtml(window._mpParseSig(d.t)):mentionify(linkifyMsg(d.t));try{mnPaint();}catch(_e){}"
  },
  // 6. history: the stream is new, so the reader is at the bottom by definition
  {
    what: 'history reset',
    from: "msgs.innerHTML='';(d.messages||[]).forEach(addMsg);}",
    to: "msgs.innerHTML='';ctStick=true;ctPill(0);(d.messages||[]).forEach(addMsg);msgs.scrollTop=msgs.scrollHeight;mnQueue();}"
  },
  // 7. a refused post must say WHY - a member with no username is sent to the one control that fixes it
  {
    what: 'actfail noname',
    from: "else if(d.type==='actfail'){chatNote(",
    to: "else if(d.type==='actfail'){if(d.why==='noname'){ctNeedName();}else chatNote("
  },
  // 8. a mention chip opens the profile card too - inside the stream, data-lbu only ever means a trader
  {
    what: 'msgs click target',
    from: "var el=e.target.closest&&e.target.closest('.ct-user[data-lbu]');",
    to: "var el=e.target.closest&&e.target.closest('[data-lbu]');"
  },
  // 9. the old mouse-only command palette: the engine replaces the panel, ccProbe stays (it owns the fetch)
  {
    what: 'command palette -> engine',
    from: "  var ccPal=null,ccCmds=null,ccDeny=false;\n  function ccHide(){if(ccPal)ccPal.style.display='none';}\n",
    to: "  var ccCmds=null,ccDeny=false;\n"
  },
  {
    what: 'ccRender removal',
    fromLine: "  function ccRender(){",
    untilLine: "  }",
    to: ""
  },
  {
    what: 'ccProbe repaint',
    from: "if(j&&j.ok&&j.cmds&&j.cmds.length){ccCmds=j.cmds;ccRender();}else{ccDeny=true;}",
    to: "if(j&&j.ok&&j.cmds&&j.cmds.length){ccCmds=j.cmds;if(mnCtl)mnCtl.refresh();}else{ccDeny=true;}"
  },
  {
    what: 'input listeners -> engine',
    from: "  input.addEventListener('input',function(){var v=(input.value||'');if(v.charAt(0)==='/'){ccProbe();ccRender();}else ccHide();});\n  input.addEventListener('keyup',function(){var v=(input.value||'');if(v.charAt(0)!=='/')ccHide();});\n  input.addEventListener('blur',function(){setTimeout(ccHide,160);});\n",
    to: "  /* the input's own listeners now belong to the engine (window.mpMention): one token reader, one panel, one\n     keyboard, for @ and / alike. ccProbe is still the thing that knows how to ASK for the command list. */\n"
  },
  // 10. a sent message is a moment that earns a buzz, and the panel must not survive the send
  {
    what: 'send haptic',
    from: "ws.send(JSON.stringify({type:'msg',u:user,t:t}));try{window.__mpTrack&&window.__mpTrack('chat','sent');}catch(_){}input.value='';});",
    to: "ws.send(JSON.stringify({type:'msg',u:user,t:t}));try{window.__mpTrack&&window.__mpTrack('chat','sent');if(window.mpHaptic)window.mpHaptic('tick');}catch(_){}input.value='';if(mnCtl)mnCtl.close();});"
  },
  // 11. wire the composer the moment the chat is really open
  {
    what: 'showChat wiring',
    from: "connect();try{input.placeholder=(room==='global'",
    to: "connect();mnWire();try{input.placeholder=(room==='global'"
  },
  // 12. a room switch is a new stream and a new set of speakers.
  //     THE ANCHOR MUST NOT BE A PREFIX OF ITS OWN REPLACEMENT - the first cut's `from` still matched after it had
  //     been applied, so a second run appended the reset a second time. It carries the trailing `try{` now, which
  //     the replacement ends with exactly once.
  // the undo runs FIRST: on a tree the first cut already doubled, the anchor below cannot match until it has
  {
    what: 'switchRoom double undo',
    from: "ctStick=true;ctPill(0);mnRoomReset();ctStick=true;ctPill(0);mnRoomReset();",
    to: "ctStick=true;ctPill(0);mnRoomReset();"
  },
  {
    what: 'switchRoom reset',
    from: "room=r;markRoomPills();if(msgs)msgs.innerHTML='';try{",
    to: "room=r;markRoomPills();if(msgs)msgs.innerHTML='';ctStick=true;ctPill(0);mnRoomReset();try{"
  }
];

let bad = 0;
const report = [];
for (const f of FILES) {
  const p = path.join(DIR, f);
  let src = fs.readFileSync(p, 'utf8');
  const before = src;
  const done = [];
  for (const e of EDITS) {
    if (e.fromLine) {
      // a whole function, matched from its opening line to the first line that is exactly its closing brace
      const L = src.split('\n');
      const i = L.indexOf(e.fromLine);
      if (i < 0) { done.push(e.what + ': already done'); continue; }
      let j = i + 1; while (j < L.length && L[j] !== e.untilLine) j++;
      if (j >= L.length) { console.log('  ' + f + ' REFUSED ' + e.what + ' - no closing line'); bad++; continue; }
      L.splice(i, j - i + 1, ...(e.to ? [e.to] : []));
      src = L.join('\n');
      done.push(e.what + ': cut ' + (j - i + 1) + ' lines');
      continue;
    }
    if (e.skipIf && src.indexOf(e.skipIf) >= 0) { done.push(e.what + ': already done'); continue; }
    const n = src.split(e.from).length - 1;
    if (n === 0) {
      // idempotency: the replacement must already be there, or something has moved and we refuse
      if (src.indexOf(e.to) >= 0 || (e.to && src.indexOf(e.to.split('\n')[0]) >= 0)) { done.push(e.what + ': already done'); continue; }
      console.log('  ' + f + ' REFUSED ' + e.what + ' - anchor not found and replacement absent');
      bad++; continue;
    }
    if (n > 1) { console.log('  ' + f + ' REFUSED ' + e.what + ' - anchor appears ' + n + ' times'); bad++; continue; }
    src = src.split(e.from).join(e.to);   // split/join: a `$` in a replacement STRING is a loaded gun
    done.push(e.what + ': ok');
  }
  if (bad) break;
  // the chat block must still be free of the retired helpers, and the new ones must all be present
  for (const must of ['function mnFind', 'function ctAfterAdd', 'window.mpMention', "data-mn=", 'ctNeedName']) {
    if (src.indexOf(must) < 0) { console.log('  ' + f + ' REFUSED - missing ' + must + ' after the pass'); bad++; }
  }
  for (const gone of ['ccRender()', 'ccHide(']) {
    if (src.indexOf(gone) >= 0) { console.log('  ' + f + ' REFUSED - ' + gone + ' still referenced'); bad++; }
  }
  if (bad) break;
  report.push({ f, p, src, changed: src !== before, done });
}
if (bad) { console.log('\nREFUSED - nothing written (' + bad + ' problem' + (bad === 1 ? '' : 's') + ')'); process.exit(1); }

for (const r of report) {
  console.log(r.f + (r.changed ? '' : ' (no change)'));
  r.done.forEach(d => console.log('    ' + d));
}
if (DRY) { console.log('\n--dry: nothing written'); process.exit(0); }
// WRITE, THEN REPORT (the 2026-10-10 lesson: a patch script that prints ok at substitution time has told you nothing)
for (const r of report) if (r.changed) fs.writeFileSync(r.p, r.src);
// and verify from DISK, not from the variable we just built
for (const r of report) {
  const back = fs.readFileSync(r.p, 'utf8');
  if (back !== r.src) { console.log('WROTE BUT DID NOT MATCH: ' + r.f); process.exit(1); }
}
console.log('\nwritten and verified from disk: ' + report.filter(r => r.changed).map(r => r.f).join(', '));
