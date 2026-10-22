/* THE WELCOME ROOM, AND A SHARED TRADE AS A CARD (2026-10-22, owner: "napravi novu sobu welcome room koja ce da bude
   default soba kad neko napravi nov nalog ... automatska personalizovana welcome poruka koju samo on vidi ... trade
   share da izgleda jako cool").
   The chat lives byte-identical in home.js and mp-trade.js; this patches both or neither. The CARD and the WELCOME
   text live in mp-auth.js (window.mpTradeCard / window.mpWelcomeCard) - the every-page bundle - so each chat copy
   only learns: a third room (WELCOME, open to everyone, server-exempted from the squad gate), its label, icon and
   placeholder, where the chat OPENS (mpWelcomeCard.defaultRoom: the Welcome room for a week-old account with no
   remembered choice; a switch is remembered), the local welcome row appended after the history frame in that room
   (never a message - nobody else sees it), and one hydrate() call after a row renders so `trade:<id>` becomes a card.
   Idempotent; --dry prints without writing; refuses unless every anchor is found the expected number of times in BOTH files. */
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const DIR = path.join(__dirname, '..', 'dist', 'assets');
const FILES = ['home.js', 'mp-trade.js'];
const CT_WAVE = "  var CT_WAVE='<svg class=\"ct-ric ct-ricwel\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M13 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5\"/><path d=\"M3 12h11M10 8l4 4-4 4\"/></svg>';\n";
const EDITS = [
  { what: 'WELCOME in the room list',
    skipIf: "var b=['global','WELCOME'];",
    a: "function chatRooms(){var b=['global'];",
    b: "function chatRooms(){var b=['global','WELCOME'];" },
  { what: 'label',
    skipIf: "if(r==='WELCOME')return 'Welcome';",
    a: "function roomLabel(r){if(r==='global')return 'All';if(r==='PREMIUM')return 'Premium';",
    b: "function roomLabel(r){if(r==='global')return 'All';if(r==='WELCOME')return 'Welcome';if(r==='PREMIUM')return 'Premium';" },
  { what: 'icon',
    skipIf: "if(r==='WELCOME')return CT_WAVE;",
    a: "  function roomIcon(r){if(r==='PREMIUM')return CT_STAR;",
    b: CT_WAVE + "  function roomIcon(r){if(r==='WELCOME')return CT_WAVE;if(r==='PREMIUM')return CT_STAR;" },
  { what: 'placeholder (switchRoom + showChat)', n: 2,
    skipIf: "room==='WELCOME'?'Say hello…':",
    a: "(room==='global'?'Message…':room==='PREMIUM'?",
    b: "(room==='global'?'Message…':room==='WELCOME'?'Say hello…':room==='PREMIUM'?" },
  { what: 'a switch is remembered',
    skipIf: "window.mpWelcomeCard.remember(r)",
    a: "function switchRoom(r){if(r===room||chatRooms().indexOf(r)<0)return;room=r;",
    b: "function switchRoom(r){if(r===room||chatRooms().indexOf(r)<0)return;room=r;try{if(window.mpWelcomeCard)window.mpWelcomeCard.remember(r);}catch(e){}" },
  { what: 'where the chat opens',
    skipIf: "showChat._picked",
    a: "gate.hidden=true;msgs.hidden=false;form.hidden=false;joined=true;buildRoomBar();",
    b: "gate.hidden=true;msgs.hidden=false;form.hidden=false;joined=true;/* a week-old account with no remembered room opens in the Welcome room (2026-10-22) */if(!showChat._picked){showChat._picked=1;try{var _dr=window.mpWelcomeCard&&window.mpWelcomeCard.defaultRoom(_me);if(_dr&&_dr!==room&&chatRooms().indexOf(_dr)>=0)room=_dr;}catch(e){}}buildRoomBar();" },
  { what: 'the welcome row after the history frame',
    skipIf: "try{welcRow();}catch(e){}",
    a: "(d.messages||[]).forEach(addMsg);msgs.scrollTop=msgs.scrollHeight;mnQueue();",
    b: "(d.messages||[]).forEach(addMsg);try{welcRow();}catch(e){}msgs.scrollTop=msgs.scrollHeight;mnQueue();" },
  { what: 'welcRow helper + card hydration on render',
    skipIf: "function welcRow()",
    a: "  function addMsg(m){",
    b: "  /* THE NEWCOMER'S WELCOME IS A LOCAL ROW (2026-10-22): appended after the history frame in the Welcome room, drawn by mp-auth\n"
     + "     (window.mpWelcomeCard), shown while the account is young and until 'Got it' - never a message, so nobody else can see it,\n"
     + "     it is in no history and it cannot be reacted to. MIRRORED BY HAND in home.js and mp-trade.js. */\n"
     + "  function welcRow(){if(room!=='WELCOME'||!window.mpWelcomeCard||!msgs)return;var me=(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me())||null;if(!window.mpWelcomeCard.want(me))return;if(msgs.querySelector('.ct-welcrow'))return;var d=document.createElement('div');d.className='ct-msg ct-welcrow';d.innerHTML='<b style=\"color:#e9e7df;font-weight:800\">'+MP_BADGE+'Margin<span style=\"color:#c2f64a\">Pad</span></b> <span class=\"ct-body\">'+window.mpWelcomeCard.html(me)+'</span>';msgs.appendChild(d);}\n"
     + "  function addMsg(m){" },
  { what: 'hydrate a shared trade into a card',
    skipIf: "window.mpTradeCard.hydrate(d)",
    a: "msgs.appendChild(d);ctAfterAdd(d,m);",
    b: "msgs.appendChild(d);ctAfterAdd(d,m);try{if(window.mpTradeCard)window.mpTradeCard.hydrate(d);}catch(e){}" },
  { what: 'hydrate after an edit too',
    skipIf: "window.mpTradeCard.hydrate(_r)",
    a: ":mentionify(linkifyMsg(d.t));try{mnPaint();}catch(_e){}",
    b: ":mentionify(linkifyMsg(d.t));try{mnPaint();}catch(_e){}try{if(window.mpTradeCard)window.mpTradeCard.hydrate(_r);}catch(_e2){}" },
];
let bad = 0;
for (const f of FILES) {
  const F = path.join(DIR, f); let s = fs.readFileSync(F, 'utf8'); const done = [], did = [];
  for (const e of EDITS) {
    if (s.indexOf(e.skipIf) >= 0) { done.push(e.what); continue; }
    const n = s.split(e.a).length - 1, want = e.n || 1;
    if (n !== want) { console.error(f + ': anchor for "' + e.what + '" found ' + n + 'x, expected ' + want); bad++; continue; }
    s = s.split(e.a).join(e.b); did.push(e.what);
  }
  if (bad) continue;
  if (!DRY && did.length) { fs.writeFileSync(F + '.tmp', s); fs.renameSync(F + '.tmp', F); }
  console.log(f + ': ' + (did.length ? (DRY ? 'would apply ' : 'applied ') + did.join(' | ') : 'nothing to do') + (done.length ? ' (already: ' + done.join(', ') + ')' : ''));
}
if (bad) { console.error('refused - nothing written'); process.exit(1); }
