
/* Spanish for this file. Inline, not the lazy i18n pack: a string that fires before a pack
   arrives would be English, which is the partial translation this exists to end. A top-level function
   declaration so every IIFE in the file can see it (see the mp-nav cookie-bar incident, 2026-09-19). */
var __esD_mpprofile = {"followT":"Seguir","followingT":"Siguiendo","friendsT":"Amigos - se siguen mutuamente","friendsPill":"Amigos","followBackT":"Te sigue - sigue de vuelta","squadBadge":"Insignia de escuadra","signInToFollow2":"Inicia sesión para seguir","portfolio":"Portafolio","demoSpot":"Demo Spot","noPortfolioYet":"Todavía no tiene portafolio en Demo Spot.","startYours":"Empieza el tuyo con $10,000","seasonL":"temporada","ofL":" de ","allInCash":"Todo en efectivo ahora mismo - no tiene monedas.","moreCoins":" monedas más · ","openDemoSpot":"Abrir Demo Spot","loadingPortfolio":"Cargando el portafolio…","couldNotLoadPortfolio":"No se pudo cargar el portafolio.","squadLeader":"Líder de escuadra","squadIn":"Escuadra","loadingTrader":"<div class=\"lbm-load\">Cargando trader…</div>","noPublicProfileFor":"<div class=\"lbm-load\">Este trader aún no tiene un perfil público.</div>","titleMessage":"\" title=\"Mensaje\">","titleChallengeToA":"\" title=\"Retar a un duelo\">","thisIsYou":"<div class=\"lbm-self\">Este eres tú</div>","signInToFollow":"<button type=\"button\" class=\"lbm-follow\" data-auth-open>Inicia sesión para seguir</button>","premiumMember":"MIEMBRO PREMIUM","seasonBoardWin":" victoria en la tabla de temporada","seasonWinner":"</svg><span>GANADOR DE TEMPORADA</span></div>","followsYou":"<span class=\"lbm-fw\" title=\"Te sigue\">Te sigue</span>","tradesSeason":"Operaciones · temporada","winRate":"Tasa de acierto","bestTrade":"Mejor operación","tradesWk":" operaciones · sem","thisSeason":"esta temporada","biggestWin":"mayor ganancia","inARow":" seguidas","winStreak":"racha de victorias","closesInADay":"cierres en un día","couldNotLoadThis":"<div class=\"lbm-load\">No se pudo cargar este trader.</div>","pctTo":"% para ","maxTier":" · nivel máximo","greenDays":"Días en Verde","bestWinRate":"Mejor Tasa de Acierto","seasonXp":"XP de Temporada","friendsYouFollowEach":"Amigos - se siguen mutuamente","followingTapToUnfollow":"Siguiendo - toca para dejar de seguir","requestSentTapTo":"Solicitud enviada - toca para cancelar","followsYouAskTo":"Te sigue - pide seguirle también","askToFollow":"Pedir seguir"};
function __esT_mpprofile(k, en) { try { if ((document.documentElement.lang || "").slice(0, 2).toLowerCase() === "es" && __esD_mpprofile[k] != null) return __esD_mpprofile[k]; } catch (e) {} return en; }
/* Shared trader-profile card + Follow - click any [data-lbu="username"] to open a level-styled profile
   (same card as the homepage leaderboard). Self-contained: injects its own CSS, exposes window.mpOpenProfile.
   Load ONLY on pages that DON'T already have the inline leaderboard handler (e.g. /levels/) to avoid double delegation. */
(function () {
  if (window.mpOpenProfile) return;
  function esc(x) { return String(x).replace(/</g, '&lt;'); }
  function moneyC(x) { x = +x || 0; var s = x < 0 ? '-' : '+', a = Math.abs(x), u = '', d = a; if (a >= 1e9) { d = a / 1e9; u = 'B'; } else if (a >= 1e6) { d = a / 1e6; u = 'M'; } else if (a >= 1e3) { d = a / 1e3; u = 'K'; } var str = u ? (d >= 100 ? Math.round(d) : d.toFixed(1)) + u : (a >= 1 ? Math.round(a).toString() : a.toFixed(2)); return s + '$' + str; }
  function pctC(x) { x = +x || 0; var s = x < 0 ? '-' : '+', a = Math.abs(x), u = '', d = a; if (a >= 1e6) { d = a / 1e6; u = 'M'; } else if (a >= 1e3) { d = a / 1e3; u = 'K'; } var str = u ? (d >= 100 ? Math.round(d) : d.toFixed(1)) + u : Math.round(a).toString(); return s + str + '%'; }
        var CSS = ''
    + '.lbm{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(4,6,9,.72);opacity:0;transition:opacity .18s}'
    + '.lbm.on{opacity:1}'
    + '.lbm-card{--lc:#c97f4a;position:relative;width:100%;max-width:380px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01)),#0c1017;border:1px solid var(--lc);border-radius:18px;padding:20px 20px 18px;box-shadow:0 30px 80px -30px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.03),0 0 46px -22px var(--lc);transform:translateY(10px) scale(.98);transition:transform .2s}'
    + '.lbm.on .lbm-card{transform:translateY(0) scale(1)}'
    + '.lbm-card::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;border-radius:18px 18px 0 0;background:linear-gradient(90deg,transparent,var(--lc),transparent);opacity:.9}'
    + '.lbm-x{position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#8b97a5;font-size:13px;cursor:pointer;line-height:1}'
    + '.lbm-x:hover{color:#fff;background:rgba(255,255,255,.1)}'
    + '.lbm-load{padding:34px 10px;text-align:center;color:#8b97a5;font-size:13px}'
    + '.lbm-head{display:flex;align-items:flex-start;gap:13px;margin-bottom:12px;min-width:0}'
    /* THE CLOSE BUTTON IS ABSOLUTE, SO THE ROW UNDER IT HAS TO RESERVE ITS CORNER (2026-10-18, owner:
       "Squidward10timeX ima malo duzi name pa neke stvari na profil kartici su pomerene"). `.lbm-toprow` has
       carried padding-right:34px for exactly this since the medals shipped; the head row never got it, so a
       16-character name stopped 13px short of the X on a 390 phone and sat UNDER it at 360. Only when the head
       is the FIRST row - with a premium tag or a medal above it the X is beside THAT row and the head is clear.
       And `align-items` is flex-start, not center: when the relationship pill wraps, centring slid the 46px
       level badge down beside the PILL instead of the name, which is what read as "everything has moved". */
    + '.lbm-body>.lbm-head:first-child{padding-right:34px}'
    /* A FLEX ITEM DEFAULTS TO min-width:auto, so without this the identity column cannot shrink and a long
       name pushes it past the card padding - the same trap /trading-api/ and the Rekt hero hit. */
    + '.lbm-id{flex:1 1 auto;min-width:0}'
    + '.lbm-badge{width:46px;height:46px;flex:none;padding:2px}'
    + '.lbm-name{display:flex;flex-wrap:wrap;align-items:center;column-gap:8px;row-gap:5px;min-width:0;font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:20px;color:#fff;line-height:1.1}'
    /* A NAME IS IDENTITY: SHRINK IT RATHER THAN CUT IT. `.lbm-nm` holds the avatar AND the name, so `fitName`
       measures exactly what has to sit on that line and steps the type down 20px -> 15px until it does. The
       longest username the DO will issue is 20 characters (/^[a-zA-Z0-9_]{3,20}$/) and the longest one any
       member actually has - HopeyouarealldoingOk - lands whole at 16px on a 390 phone.
       IT STAYS ON ONE LINE. Two wrapping attempts were measured and both were worse: `overflow-wrap:anywhere`
       collapses a flex item's automatic minimum size to ONE CHARACTER (a name stacked over eight lines), and
       `-webkit-line-clamp` needs `display:-webkit-box`, which turns the span into a legacy vertical BOX and
       puts the avatar on a row of its own. Below 15px the ellipsis takes over and the full name is the title -
       only reachable with a 16+ character name on a 320px screen, where nothing else would fit either. */
    + '.lbm-nm{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.lbm-lvl{font:700 11px "Space Mono",monospace;letter-spacing:.04em;text-transform:uppercase;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    /* THE LEVEL METER (owner 2026-10-17: "prost i zalepljen uz ovo kao da je dete pravilo ... ozbiljniji izgled
       ali da ne gubimo na prostoru"). It was a flat 5px strip of one colour sitting FLUSH against the squad card -
       the squad row ends and the bar begins with no gap at all, which is what read as glued on. Now: a carved
       track (inset shadow + a hairline top edge, so it reads cut INTO the card rather than painted on), a fill
       that goes dark-to-colour with a gloss along its top, and a bright cap with a glow at the leading edge so
       the eye lands on where the member actually is. The vertical budget is UNCHANGED: 9 + 6 + 5 = 20px, exactly
       what 0 + 5 + 15 was. */
    + '.lbm-bar{position:relative;height:6px;border-radius:4px;background:linear-gradient(180deg,rgba(0,0,0,.42),rgba(255,255,255,.035));box-shadow:inset 0 1px 2px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,255,255,.05);overflow:hidden;margin:9px 0 5px}'
    + '.lbm-bar:after{content:"";position:absolute;inset:0;border-radius:4px;border-top:1px solid rgba(255,255,255,.07);pointer-events:none}'
    + '.lbm-bar i{position:relative;display:block;height:100%;min-width:6px;border-radius:4px;background-image:linear-gradient(180deg,rgba(255,255,255,.34),rgba(255,255,255,0) 55%,rgba(0,0,0,.22));background-blend-mode:overlay;box-shadow:0 0 7px -1px currentColor,inset 0 0 0 1px rgba(255,255,255,.14)}'
    + '.lbm-bar i:after{content:"";position:absolute;top:0;right:0;width:2px;height:100%;background:rgba(255,255,255,.75);border-radius:2px}'
    + '.lbm-rech{display:flex;align-items:baseline;gap:7px;margin:12px 0 7px;font:800 11px "Space Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:#ffd75a}'
    + '.lbm-rech span{font-weight:700;letter-spacing:.04em;text-transform:none;color:#6c7681}'
    + '.lbm-rec{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:7px;margin-bottom:12px}'
    + '.lbm-r{padding:8px 9px;border-radius:10px;background:linear-gradient(180deg,rgba(255,215,90,.07),rgba(255,215,90,.02));border:1px solid rgba(255,215,90,.18);min-width:0}'
    + '.lbm-r b{display:block;font:800 13.5px "Bricolage Grotesque",sans-serif;letter-spacing:-.02em;color:#ffe08a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}'
    + '.lbm-r span{display:block;margin-top:2px;font:600 10px "Space Mono",monospace;color:#8a93a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.lbm-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-bottom:15px}'
    + '.lbm-s{min-width:0;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:11px;padding:10px 6px;text-align:center;overflow:hidden}'
    + '.lbm-sv{font-family:"Space Mono",monospace;font-weight:700;font-size:14px;color:#fff;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.lbm-sl{font-size:9px;color:#7a8592;text-transform:uppercase;letter-spacing:.03em;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    /* MEASURED 2026-10-18 at 320px: the four tiles plus "28 followers" ran 28px PAST the card's own padding,
       for every member, long name or not - 4x34 + 3x8 + the followers line does not fit 244px. What pays for
       it is the 30px tiles under 375 and min-width:0 on the followers block; `flex-wrap` is the graceful
       fallback for a bigger follower count (the suite shows it is not reached at 320 today). Nothing changes
       at 390 and above. */
    + '.lbm-foot{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}'
    + '@media(max-width:374px){.lbm-acts{gap:6px}.lbm-acts>button,.lbm-acts>.lbm-folb{width:30px;height:30px}}'
    + '.lbm-fol{min-width:0;font-size:13.5px;color:#c7cdd4;display:flex;align-items:center;gap:7px}.lbm-fol b{color:#fff;font-weight:800;font-size:16px;font-family:"Space Mono",monospace}.lbm-fol svg{color:#8b97a5}'
    + '.lbm-self{font-size:12px;color:#c2f64a;font-weight:700}'
    + '.lbm-follow{background:#38bdf8;color:#0a0b0d;border:1px solid #38bdf8;border-radius:10px;padding:9px 13px;font:800 12px "Space Mono",monospace;line-height:14px;letter-spacing:.03em;cursor:pointer;transition:filter .15s,background .15s}'
    + '.lbm-follow:hover{filter:brightness(1.08)}'
    + '.lbm-follow.on{background:transparent;color:#8a93a0;border:1px solid #2b333d}.lbm-follow.on:hover{filter:none;background:rgba(255,255,255,.05)}'
    + '.lbm-acts{display:flex;align-items:center;gap:8px;flex:none;margin-left:auto}'
    /* FOLLOW IS AN ICON BESIDE THE CLOSE (owner 2026-10-16: "follow button ce da ide na vrh kartice do x ... mali coveculjak i plus"); its old place in the foot row is the Portfolio button */
    /* ALL FOUR ACTIONS ARE ONE ROW OF EQUAL SQUARES (owner 2026-10-17: "portfolio i follow treba da se nalaze
       pored chat i duel ikonice, znaci sve 4 zajedno, i da budu istih dimenzija"). Follow spent one day in the
       top-right corner beside the close; it is a 34px tile in the foot row with the others now, and Portfolio
       lost its word so it is the same tile rather than a wide pill. */
    + '.lbm-acts>button{width:34px;height:34px;padding:0;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;flex:none}'
    + '.lbm-folb{width:34px;height:34px;border-radius:10px;background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.45);color:#38bdf8;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,color .15s,border-color .15s}'
    + '.lbm-folb:hover{background:rgba(56,189,248,.22)}.lbm-folb svg{display:block}'
    /* TWO GLYPHS, never a word (owner 2026-10-17, second pass: "samo treba da budu 2 razlicita coveculjka ... tekst nikako ne sme"):
       not following = person + plus (blue) · following = person + CHECK (lime), whether or not it is mutual; friends keep the same
       check on a FILLED lime tile. An earlier cut this day made the one-way state the person ALONE, which at 34px reads as the same
       icon as the plus - which is why he was still being offered to follow people he already followed. Both paths used to be drawn
       at once, so the states differed only by border colour; exactly one is visible now. The button carries NO title: a title is a
       tooltip, i.e. text, and this button may never print a word. */
    + '.lbm-folb .fchk{display:none}.lbm-folb.on .fplus{display:none}.lbm-folb.on .fchk{display:block}'
    + '.lbm-folb .freq{display:none}.lbm-folb.pending .fplus{display:none}.lbm-folb.pending .fchk{display:none}.lbm-folb.pending .freq{display:block}.lbm-folb.pending{background:rgba(234,179,8,.12);border-color:rgba(234,179,8,.55);border-style:dashed;color:#eab308}.lbm-folb.pending:hover{background:rgba(234,179,8,.2)}' /* a sent, not-yet-approved follow request: amber dashed clock (owner 2026-10-23) */
    + '.lbm-folb.on{background:rgba(194,246,74,.12);border-color:rgba(194,246,74,.5);color:#c2f64a}'
    + '.lbm-folb.friend{background:#c2f64a;border-color:#c2f64a;color:#0a0b0d}.lbm-folb.friend:hover{background:#d4ff6a}'
    + '.lbm-port{position:relative;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid transparent;background:linear-gradient(180deg,#141a22,#0d1117) padding-box,linear-gradient(120deg,#a06bff,#c2f64a 55%,#38bdf8) border-box;color:#ecebe4;font:800 12px "Space Mono",monospace;letter-spacing:.04em;cursor:pointer;box-shadow:0 10px 26px -14px rgba(160,107,255,.8),inset 0 1px 0 rgba(255,255,255,.06);transition:transform .14s,box-shadow .14s}'
    + '.lbm-port:hover{transform:translateY(-1px);box-shadow:0 14px 30px -14px rgba(160,107,255,.95),inset 0 1px 0 rgba(255,255,255,.08)}'
    + '.lbm-port.open{transform:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}'
    + '.lbm-port svg{display:block;color:#c2f64a}.lbm-port b{background:linear-gradient(90deg,#c2f64a,#a06bff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}'
    + '.lbm-portp{margin-top:12px;padding:12px 12px 10px;border-radius:12px;background:rgba(160,107,255,.05);border:1px solid rgba(160,107,255,.22)}'
    + '.lbm-portp[hidden]{display:none}'
    + '.lbm-pph{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;font:700 10px "Space Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:#8b97a5;margin-bottom:8px}.lbm-pph b{font:800 15px "Bricolage Grotesque",sans-serif;letter-spacing:-.02em;color:#fff;text-transform:none;letter-spacing:0}.lbm-pph .up{color:#34d99a}.lbm-pph .dn{color:#ff6c5c}'
    + '.lbm-ppr{display:grid;grid-template-columns:22px minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:5px 0;font-size:12.5px}'
    + '.lbm-ppr img,.lbm-ppr .lg{width:22px;height:22px;border-radius:50%;background:#1b212b;object-fit:cover;display:inline-flex;align-items:center;justify-content:center;font:700 8px "Space Mono",monospace;color:#8b97a5}'
    + '.lbm-ppr .sy{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;color:#ecebe4}.lbm-ppr .sy small{font:700 8.5px "Space Mono",monospace;color:#a06bff;margin-left:5px;letter-spacing:.06em}.lbm-ppr .sy i{display:block;height:3px;border-radius:2px;background:rgba(255,255,255,.08);margin-top:4px;overflow:hidden}.lbm-ppr .sy i b{display:block;height:100%;background:linear-gradient(90deg,#a06bff,#c2f64a)}'
    + '.lbm-ppr .v{font-family:"Space Mono",monospace;font-size:12px;color:#fff;white-space:nowrap}.lbm-ppr .p{font-family:"Space Mono",monospace;font-size:11px;white-space:nowrap;min-width:52px;text-align:right}.lbm-ppr .p.up{color:#34d99a}.lbm-ppr .p.dn{color:#ff6c5c}'
    + '.lbm-ppf{margin-top:8px;font-size:12px;color:#8b97a5}.lbm-ppf a{color:#c2f64a;text-decoration:none;font-weight:700}'
    + '.lbm-dm{background:transparent;color:#38bdf8;border:1px solid rgba(56,189,248,.5);border-radius:10px;font:800 13px "Space Mono",monospace;letter-spacing:.02em;cursor:pointer;transition:background .15s}'
    + '.lbm-dm:hover{background:rgba(56,189,248,.12)}'
    + '.lbm-duel{color:#ff9640;border-color:rgba(255,150,64,.5)}.lbm-duel:hover{background:rgba(255,150,64,.12)}'
    /* flex:none and no margin of their own - the row's column-gap spaces them, so a pill that wraps to a second
       line lands flush with the avatar instead of hanging 8px in from it. */
    + '.lbm-friend{flex:none;font-size:10.5px;font-weight:800;letter-spacing:.03em;color:#0a0b0d;background:#c2f64a;border-radius:20px;padding:3px 9px}'
    + '.lbm-fw{flex:none;font-size:10px;font-weight:700;letter-spacing:.03em;color:#8b97a5;border:1px solid #2f3742;border-radius:20px;padding:2px 8px}'
    + '.lbm-av{margin-right:7px;font-size:19px;vertical-align:-2px}'
    + '.lbm-av-img{width:26px;height:26px;border-radius:50%;object-fit:cover;vertical-align:-8px}'
    + '.lbm-bio{margin:12px 0 0;padding:10px 13px;background:rgba(255,255,255,.03);border:1px solid #2a323c;border-left-width:3px;border-radius:10px;font-size:13px;line-height:1.5;color:#d3d8de}'
    + '.lbm-coins{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}.lbm-coin{font:800 11px "Space Mono",monospace;color:#9aa3ad;border:1px solid #2f3742;border-radius:7px;padding:3px 8px}'
    + '.lbm-card.lbm-premium{border-color:#c2f64a;box-shadow:0 0 0 1px rgba(194,246,74,.5),0 24px 70px -20px rgba(0,0,0,.7),0 0 40px -10px rgba(194,246,74,.32);animation:lbmPremGlow 3.2s ease-in-out infinite}'
    + '@keyframes lbmPremGlow{0%,100%{box-shadow:0 0 0 1px rgba(194,246,74,.42),0 24px 70px -20px rgba(0,0,0,.7),0 0 30px -12px rgba(194,246,74,.24)}50%{box-shadow:0 0 0 1px rgba(194,246,74,.72),0 24px 70px -20px rgba(0,0,0,.7),0 0 54px -6px rgba(194,246,74,.52)}}'
    + '.lbm-card.lbm-premium:before{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(120% 60% at 50% 0,rgba(194,246,74,.10),transparent 70%);pointer-events:none}'
    /* SEASON MEDALS, 2026-10-17 (owner: "medalja treba da bude dosta manja ... da ne pise season winner ...
       medalje razlicite po boji u zavisnosti od leaderboard-a ... kad se klikne, text prozor koje je takmicenje i
       kog datuma"). One medal PER BOARD, 24px, in the same row as the Premium tag so it costs no row of its own -
       the old one was a 34x43 medal plus a SEASON WINNER caption in a padded pill, about 150x55 on its own line. */
    + '.lbm-toprow{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:0 0 10px;padding-right:34px}.lbm-toprow .lbm-premtag{margin-bottom:0}'
    + '.lbm-meds{display:inline-flex;align-items:center;gap:5px}'
    + '.lbm-med1{width:24px;height:30px;padding:0;border:0;background:none;cursor:pointer;line-height:0;border-radius:6px;transition:transform .14s,filter .14s}'
    + '.lbm-med1.real{width:26px;height:32px}'
    + '.lbm-med1:hover,.lbm-med1.on{transform:translateY(-1px) scale(1.06)}.lbm-med1:focus-visible{outline:2px solid #c2f64a;outline-offset:2px}'
    + '.lbm-med1 svg{display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))}'
    + '.lbm-med1.real svg{filter:drop-shadow(0 2px 4px rgba(0,0,0,.55)) drop-shadow(0 0 5px var(--mc,#fff))}'
    /* A POPOVER, NOT A PANEL (owner 2026-10-17: "otvara prozor koji je na kartici, pa se kartica produzi kad se
       prozor otvori - nije bas idealno da se profil kartica pomera zbog nekog prozora"). It is absolute inside
       .lbm-card, which is position:relative and does not clip, so opening it moves NOTHING on the card; it is
       anchored under the medal that was tapped and clamped to the card's edges. */
    + '.lbm-medp{position:absolute;z-index:6;min-width:146px;max-width:232px;padding:9px 11px;border-radius:11px;background:#10151c;border:1px solid #2f3843;border-left-width:3px;box-shadow:0 20px 44px -18px rgba(0,0,0,.95)}'
    + '.lbm-medp:after{content:"";position:absolute;top:-5px;left:var(--ax,16px);width:9px;height:9px;background:#10151c;border-left:1px solid #2f3843;border-top:1px solid #2f3843;transform:rotate(45deg)}'
    + '.lbm-medp[hidden]{display:none}'
    + '.lbm-medp h4{margin:0 0 5px;font:800 12.5px "Bricolage Grotesque",sans-serif;letter-spacing:-.01em}'
    + '.lbm-medreal{font:700 9.5px "Space Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#8b97a5;margin:-2px 0 6px}'
    + '.lbm-medp ul{margin:0;padding:0;list-style:none}.lbm-medp li{font:600 11.5px "Space Mono",monospace;color:#c7cdd4;padding:1.5px 0}.lbm-medp li b{color:#fff;font-weight:700}'
    + '.lbm-premtag{display:inline-block;font:800 9px "Space Mono",monospace;letter-spacing:.18em;color:#0a0b0d;background:linear-gradient(90deg,#c2f64a,#e5ff8a);border-radius:20px;padding:3px 11px;margin-bottom:10px}'
    + '.lbm-pro{display:inline-block;font:800 8.5px "Space Mono",monospace;letter-spacing:.05em;color:#0a0b0d;background:#c2f64a;border-radius:5px;padding:1px 5px;margin-left:7px;vertical-align:middle}'
    + '.lbm-dm svg{display:block}'
    + '.mp-progold{background:linear-gradient(100deg,#e0a52a 0%,#ffe07a 18%,#fff6c8 30%,#ffd75a 46%,#e0a52a 68%,#ffe98a 100%) !important;background-size:200% auto !important;-webkit-background-clip:text !important;background-clip:text !important;-webkit-text-fill-color:transparent !important;color:transparent !important;font-weight:800 !important;text-shadow:none !important;animation:mpGold 3.2s linear infinite}'
    + '.lbm-ownertag{background:linear-gradient(90deg,#7a4d0a,#ffd75a 22%,#fff6d0 50%,#ffd75a 78%,#7a4d0a);background-size:200% 100%;color:#1a1002;letter-spacing:.26em;padding:4px 14px;box-shadow:0 0 22px -4px rgba(255,200,60,.75),0 0 0 1px rgba(255,215,90,.55),inset 0 1px 0 rgba(255,255,255,.35);animation:mpGold 2.4s linear infinite}'
    + '@keyframes mpGold{to{background-position:200% center}}';
  var st = document.createElement('style'); st.textContent = CSS; (document.head || document.documentElement).appendChild(st);
  /* SEASON MEDALS (2026-10-17). ONE PER BOARD, coloured by the board, and a tap names the competition and the
     day. The board ids are the ones payWeeklyPrizes / payMoonPrizes / payBybitPrizes actually write into the
     ledger's lbpay rows ('wr', not COMP_BOARDS' 'winrate'), plus the retired 'spot' bank board and the legacy
     lbpayouts rows, which carry 'roe'. An id we do not know still draws - in grey, named by its own id - because
     a new board must never make a member's medal disappear. */
  var MED_BOARDS = {
    roe:   { n: 'Highest ROE',    a: '#ffd75a', b: '#b8860b', t: '#4a3608' },
    green: { n: __esT_mpprofile("greenDays",'Green Days'),     a: '#34d99a', b: '#116b4e', t: '#05291d' },
    wr:    { n: __esT_mpprofile("bestWinRate",'Best Win Rate'),  a: '#38bdf8', b: '#15618a', t: '#042536' },
    xp:    { n: __esT_mpprofile("seasonXp",'Season XP'),      a: '#a06bff', b: '#4a2a8a', t: '#1b0e38' },
    gold:  { n: 'The Gold Room',  a: '#ffb33a', b: '#8a5a0b', t: '#3a2403' },
    /* THE TWO REAL-MONEY BOARDS WEAR THEIR PARTNER'S OWN COLOURS (2026-10-18, owner: "treba da ima bybit ili
       moon logo ili bar njihove logo boje, tacne i precizne"). They were a generic orange and a pale blue -
       approximations of brands we already hold exactly: `window.mpEx` in mp-auth.js carries Bybit as
       #f7a600 on #0a0b0d and Moon as #14161c with its mark at /assets/moon.png. Those are the values, not
       something picked by eye, and `card-medals-e2e` reads them back out of mpEx so the two cannot drift.
       `mark` makes the medal draw the partner's sign instead of the house gem. */
    bybit: { n: 'Bybit Volume',   a: '#f7a600', b: '#8a5a00', t: '#2a1a00', real: 1, mark: 'bybit' },
    // Moon is TWO facts and the medal carries both: the accent `window.mpEx` records (#8a5cff) on the ribbon
    // and the bezel, and the mark itself - a white crescent on their near-black, which is what
    // /assets/moon.png is. Using the violet for the DISC would have thrown their own logo away.
    moon:  { n: 'King of the Moon', a: '#8a5cff', b: '#14161c', t: '#0a0b0d', real: 1, mark: 'moon' },
    call:  { n: 'Daily BTC Call', a: '#ff5a9e', b: '#8a1f4d', t: '#380a1d' },
    meme:  { n: 'Meme Spot',      a: '#c2f64a', b: '#6a8a16', t: '#243405' },
    spot:  { n: 'Demo Spot',      a: '#9fb0c2', b: '#45525f', t: '#161d24' }
  };
  function medBoard(id) { id = String(id || 'roe').toLowerCase(); if (id === 'winrate') id = 'wr'; return MED_BOARDS[id] || { n: id.charAt(0).toUpperCase() + id.slice(1), a: '#9aa3ad', b: '#424b56', t: '#14181d' }; }
  function medDate(ms) { var d = new Date(+ms || 0); if (!(+ms > 0) || isNaN(d.getTime())) return ''; try { return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return d.toISOString().slice(0, 10); } }
  /* The gradient ids MUST be unique per medal: two medals on one card with the same <defs> id both render with
     whichever was parsed first, so every disc would wear the first board's colour. */
  /* THE TWO REAL-MONEY BOARDS WEAR A DIFFERENT MEDAL (owner 2026-10-17: "King of the moon i Bybit leaderboard
     medalje treba da izgledaju bas cool ... moraju da se izdvajaju jer je pravi trade u pitanju"). Everything
     else on the card is paper; these two are won with a real exchange account, so they get a milled metal bezel
     (a dashed rim stroke - real milling on a disc, unlike the conic teeth that read as hatching on a rectangle),
     a second inner ring, a gem at the ribbon knot and a glow in the board's own colour. Two pixels bigger, which
     is enough to catch the eye in a row and not enough to cost a line.
     The gradient ids MUST be unique per medal: two medals sharing a <defs> id both render with whichever was
     parsed first, so every disc would wear the first board's colour - almost right and completely wrong. */
  function medSvg(key, c, count) {
    var g = 'mdg_' + key, r = 'mdr_' + key, real = !!c.real;
    var W = real ? 26 : 24, H = real ? 32 : 30;
    var defs = '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="' + (real ? '.95' : '.85') + '"/><stop offset="' + (real ? '.34' : '.4') + '" stop-color="' + c.a + '"/><stop offset="' + (real ? '.66' : '.62') + '" stop-color="' + c.b + '"/><stop offset="1" stop-color="' + c.a + '"/></linearGradient>'
      + '<linearGradient id="' + r + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c.a + '"/><stop offset="1" stop-color="' + c.b + '"/></linearGradient></defs>';
    var ribbon = '<path d="M13 1h7l-2.5 13h-8z" fill="url(#' + r + ')"/><path d="M31 1h-7l2.5 13h8z" fill="url(#' + r + ')" opacity=".8"/>';
    var num = count > 1 ? '<text x="22" y="40" text-anchor="middle" font-family="Space Mono, monospace" font-size="17" font-weight="700" fill="' + c.t + '">' + (count > 9 ? '9+' : count) + '</text>' : '';
    if (!real) {
      return '<svg viewBox="0 0 44 54" width="' + W + '" height="' + H + '" aria-hidden="true">' + defs + ribbon
        + '<circle cx="22" cy="34" r="18" fill="url(#' + g + ')" stroke="' + c.b + '" stroke-width="1.4"/>'
        + '<circle cx="22" cy="34" r="13" fill="none" stroke="' + c.b + '" stroke-width="1" opacity=".55"/>'
        + num + '</svg>';
    }
    /* A BRANDED FACE REPLACES THE HOUSE GEM AND THE COUNT MOVES OFF IT. The partner's sign has to sit in the
       middle of the disc to read at 24px, and the old count was drawn right there - two things in one place.
       On a branded medal the count becomes a small badge on the rim instead. */
    if (c.mark) {
      var badge = count > 1 ? '<circle cx="34.5" cy="45" r="7" fill="' + c.b + '" stroke="' + c.a + '" stroke-width="1.2"/>'
        + '<text x="34.5" y="48.4" text-anchor="middle" font-family="Space Mono, monospace" font-size="9" font-weight="700" fill="' + c.a + '">' + (count > 9 ? '9+' : count) + '</text>' : '';
      // Moon: their mark is a white crescent on near-black - built the way the file is, one disc minus another
      var face = c.mark === 'moon'
        ? '<circle cx="22" cy="34" r="15" fill="#14161c" stroke="#39404e" stroke-width="1.1"/>'
          + '<circle cx="21.2" cy="34.2" r="8.6" fill="#ffffff"/>'
          + '<circle cx="25.1" cy="32.3" r="7.4" fill="#14161c"/>'
        // Bybit: their amber with their own dark on top, and the B the site already uses as their mark
        : '<circle cx="22" cy="34" r="15" fill="#f7a600" stroke="#8a5a00" stroke-width="1.1"/>'
          + '<circle cx="22" cy="34" r="11.6" fill="none" stroke="#0a0b0d" stroke-width=".9" opacity=".25"/>'
          + '<text x="22" y="40.6" text-anchor="middle" font-family="Bricolage Grotesque, Inter, Helvetica, Arial, sans-serif" font-size="17.5" font-weight="800" fill="#0a0b0d">B</text>';
      return '<svg viewBox="0 0 44 54" width="' + W + '" height="' + H + '" aria-hidden="true">' + defs + ribbon
        + '<circle cx="22" cy="34" r="19" fill="' + c.b + '"/>'
        + '<circle cx="22" cy="34" r="17.6" fill="none" stroke="' + c.a + '" stroke-width="2.6" stroke-dasharray="1.9 2.6" opacity=".95"/>'
        + face + badge + '</svg>';
    }
    return '<svg viewBox="0 0 44 54" width="' + W + '" height="' + H + '" aria-hidden="true">' + defs + ribbon
      + '<circle cx="22" cy="34" r="19" fill="' + c.b + '"/>'
      + '<circle cx="22" cy="34" r="17.6" fill="none" stroke="' + c.a + '" stroke-width="2.6" stroke-dasharray="1.9 2.6" opacity=".95"/>'
      + '<circle cx="22" cy="34" r="15" fill="url(#' + g + ')" stroke="' + c.b + '" stroke-width="1.1"/>'
      + '<circle cx="22" cy="34" r="11.4" fill="none" stroke="' + c.b + '" stroke-width=".9" opacity=".5"/>'
      + '<path d="M22 9.5l3.4 3.6-3.4 3.6-3.4-3.6z" fill="' + c.a + '" stroke="' + c.b + '" stroke-width=".8" stroke-linejoin="round"/>'
      + num + '</svg>';
  }
  /* The list is additive and may be absent (an older worker, or a cached body): fall back to `boards`, which has
     been there all along, so the medals still render - only the dates are missing, and the panel says so. */
  function medalsHtml(w) {
    if (!w || !(+w.n > 0)) return '';
    var list = Array.isArray(w.list) ? w.list : [], by = {}, order = [];
    for (var i = 0; i < list.length; i++) { var id = String(list[i].b || 'roe').toLowerCase(); if (id === 'winrate') id = 'wr'; if (!by[id]) { by[id] = []; order.push(id); } by[id].push(list[i]); }
    /* UNION, not a fallback: `list` is capped at 40 rows while `boards` is computed over every win there has ever
       been, so a board can be named in `boards` and have no row here - and the first cut simply dropped its medal.
       A board with no dated row still gets its medal; the panel then says it was won without naming a day. */
    (w.boards || []).forEach(function (b) { var id = String(b || 'roe').toLowerCase(); if (id === 'winrate') id = 'wr'; if (!by[id]) { by[id] = []; order.push(id); } });
    if (!order.length && +w.n > 0) { by.roe = []; order.push('roe'); }
    if (!order.length) return '';
    order.sort(function (a, b) { return (by[b].length || 1) - (by[a].length || 1); });
    var out = order.slice(0, 10).map(function (id) { // ten is every board that has ever paid, including the retired bank board - a winner must never silently lose a medal
      var c = medBoard(id), rows = by[id] || [], n = rows.length || 1;
      var dates = rows.map(function (r) { return medDate(r.w || r.t); }).filter(Boolean);
      var ttl = c.n + ' - won ' + n + ' time' + (n === 1 ? '' : 's') + (dates.length ? ' (' + dates.join(', ') + ')' : '');
      return '<button type="button" class="lbm-med1' + (c.real ? ' real' : '') + '" style="--mc:' + c.a + '66" data-lbmed="' + id + '" data-mn="' + esc(c.n) + '" data-md="' + esc(dates.join('|')) + '" title="' + esc(ttl) + '" aria-label="' + esc(ttl) + '">' + medSvg(id, c, n) + '</button>';
    }).join('');
    return '<span class="lbm-meds">' + out + '</span>';
  }
  /* THE FOLLOW BUTTON, REWRITTEN 2026-10-17. One state, read from the server, and one painter used by the first
     render and by every click. The three glyphs are in the SVG and the class picks which one shows:
       guest    - not signed in          -> plus, and a click opens the sign-in sheet
       none     - signed in, not following -> plus
       follow   - I follow them, one way   -> the person alone, lime outline
       friends  - we follow each other     -> the check on a filled lime tile
     `self` draws no button at all. Nothing here reads localStorage or window.mpAuth: the card payload carries
     isSelf / viewerSignedIn / iFollow / followsMe / mutual, and the toggle answers with the same four, so a
     card opened before the deferred auth bundle parsed is still correct. */
  function folState(d) {
    if (!d) return 'guest';
    if (d.isSelf) return 'self';
    if (!d.viewerSignedIn) return 'guest';
    if (d.mutual || (d.iFollow && d.followsMe)) return 'friends';
    if (d.iFollow) return 'follow';
    if (d.requested) return 'requested';
    return 'none';
  }
  function folTitle(st, followsMe) {
    if (st === 'friends') return __esT_mpprofile('friendsT', __esT_mpprofile("friendsYouFollowEach",'Friends - you follow each other'));
    if (st === 'follow') return __esT_mpprofile('followingT', __esT_mpprofile("followingTapToUnfollow",'Following - tap to unfollow'));
    if (st === 'requested') return __esT_mpprofile('requestedT', __esT_mpprofile("requestSentTapTo",'Request sent - tap to cancel'));
    if (st === 'guest') return __esT_mpprofile('signInToFollow2', __esT_mpprofile("signInToFollow",'Sign in to follow'));
    return followsMe ? __esT_mpprofile('askToFollowBackT', __esT_mpprofile("followsYouAskTo",'Follows you - ask to follow back')) : __esT_mpprofile('askToFollowT', __esT_mpprofile("askToFollow",'Ask to follow'));
  }
  /* The pill beside the name says the same thing in words and is painted from the same state - it used to be
     inserted and removed by hand inside the click handler, with its own copy of the wording. */
  function folPill(st, followsMe) {
    if (st === 'friends') return '<span class="lbm-friend" title="' + esc(folTitle('friends')) + '">\u2605 ' + __esT_mpprofile('friendsPill', 'Friends') + '</span>';
    if (followsMe) return __esT_mpprofile('followsYou', '<span class="lbm-fw" title="Follows you">Follows you</span>');
    return '';
  }
  function folPaint(btn, st, followsMe) {
    if (!btn) return;
    btn.classList.toggle('on', st === 'follow' || st === 'friends');
    btn.classList.toggle('friend', st === 'friends');
    btn.classList.toggle('pending', st === 'requested');
    btn.setAttribute('aria-pressed', (st === 'follow' || st === 'friends') ? 'true' : 'false');
    btn.removeAttribute('title'); // a title is a tooltip, i.e. TEXT, and this button may never show a word
    btn.setAttribute('aria-label', folTitle(st, followsMe));
    btn.setAttribute('data-st', st);
    var body = btn.closest('.lbm-body'), nameEl = body && body.querySelector('.lbm-name');
    if (nameEl) {
      var old = nameEl.querySelector('.lbm-friend, .lbm-fw'); if (old) old.remove();
      var pill = folPill(st, followsMe); if (pill) nameEl.insertAdjacentHTML('beforeend', pill);
      fitName(body); // the pill takes room off the name, so the fit has to be redone whenever it changes
    }
  }
  /* FIT THE NAME TO THE ROOM IT HAS (2026-10-18). A username is identity - the card is where a reader confirms
     WHO they are looking at - so it is shrunk, not cut: 20px down to 16px, and only if it still will not fit at
     16px does it wrap onto a second line whole. Measured against the longest legal username (20 chars, the DO's
     own /^[a-zA-Z0-9_]{3,20}$/), with the avatar and the relationship pill beside it, down to a 320px phone.
     It MUST run again on document.fonts.ready: Bricolage Grotesque loads async and a measurement taken against
     the fallback face sizes the name for a font nobody is reading. */
  function fitName(body) {
    try {
      var row = body && body.querySelector('.lbm-name'), el = row && row.querySelector('.lbm-nm');
      if (!el) return;
      row.style.fontSize = ''; el.removeAttribute('title');
      for (var s = 19; s >= 15; s--) {
        if (el.scrollWidth <= el.clientWidth + 0.5) return;
        row.style.fontSize = s + 'px';
      }
      if (el.scrollWidth > el.clientWidth + 0.5) el.title = el.textContent || ''; // clipped: the whole name is still readable
    } catch (e) {}
  }
  var modal = null;
  function closeModal() { if (modal) { modal.classList.remove('on'); setTimeout(function () { if (modal && !modal.classList.contains('on')) modal.style.display = 'none'; }, 200); } }
  var TAGC = { bronze: ['#c97f4a', '#f0c39a'], silver: ['#c3cdda', '#eef3fa'], gold: ['#ffcf3f', '#ffe98a'], platinum: ['#8fe6ff', '#d8f6ff'], diamond: ['#b795ff', '#e6d8ff'], master: ['#ff4d6d', '#ffb0bf'], legendary: ['#ff8a2a', '#ffcf8a'], unranked: ['#8b95a1', '#c9d2dc'], neon: ['#c2f64a', '#e5ff8a'], aurora: ['#8b5cff', '#5ad0ff'], founder: ['#ffd75a', '#fff3c0'], owner: ['#7a4d0a', '#ffd75a'], default: ['#c2f64a', '#e5ff8a'], carbon: ['#9aa3ad', '#cdd3da'], jade: ['#4ade80', '#a7f3c8'], royal: ['#a06bff', '#d0b5ff'], blood: ['#ff5a4d', '#ff9a8a'], matrix: ['#2ebd85', '#7de8bc'], ice: ['#35c0e8', '#a8f0ff'], ember: ['#8a5a3a', '#ff7a4a'], sakura: ['#ff9ad0', '#ffd0e8'], void: ['#8a6cff', '#c0aaff'], sovereign: ['#f0e6c8', '#fffaf0'], eclipse: ['#ff9a2a', '#ffcf8a'], inferno: ['#ff6a1a', '#ffb056'], streak7: ['#ffb84a', '#ffdf8a'], streak30: ['#ff6a2a', '#ffae4a'], streak100: ['#ffffff', '#dff6f6'], dwell10: ['#d29a6a', '#eccaa8'], dwell100: ['#34d99a', '#9fe9c8'], dwell500: ['#b8895a', '#e0c8a8'], closer: ['#ff5a4d', '#ffb3ad'], closer2k: ['#ff3b30', '#ffd0cc'], operative: ['#a9b96a', '#d5e0a8'], mission500: ['#ffd75a', '#14120a'], og180: ['#b87333', '#5ec8ae'], xp100k: ['#e05a4a', '#ffd75a'], dragonfire: ['#ff5a28', '#ffc060'], singularity: ['#7a5cff', '#9adfff'], midas: ['#ffd75a', '#fff3c0'], realtrader: ['#2ee6a8', '#ffe98a'], champion: ['#ffd75a', '#fff3c0'], deadeye: ['#c3cdda', '#ff6a5e'], overdrive: ['#ff2ad0', '#ff9af0'], tycoon: ['#2ebd85', '#ffd75a'] }; /* member-tag tint follows the equipped frame */
  window.mpCloseProfile = closeModal;
  window.mpOpenProfile = function (name) {
    if (!name) return;
    try { window.__mpTrack && window.__mpTrack('profile', String(name).slice(0, 24)); } catch (e) {}
    if (!modal) { modal = document.createElement('div'); modal.className = 'lbm'; modal.innerHTML = '<div class="lbm-card"><button type="button" class="lbm-x" aria-label="Close">✕</button><div class="lbm-body"></div></div>'; document.body.appendChild(modal); modal.addEventListener('click', function (e) { if (e.target === modal || e.target.closest('.lbm-x')) closeModal(); }); }
    var body = modal.querySelector('.lbm-body'), card = modal.querySelector('.lbm-card');
    body.innerHTML = __esT_mpprofile("loadingTrader",'<div class="lbm-load">Loading trader…</div>'); card.style.setProperty('--lc', '#c97f4a'); card.className = 'lbm-card';
    modal.style.display = 'flex'; requestAnimationFrame(function () { modal.classList.add('on'); });
    fetch('/api/lb/user?name=' + encodeURIComponent(name)).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.exists) { body.innerHTML = __esT_mpprofile("noPublicProfileFor",'<div class="lbm-load">No public profile for this trader yet.</div>'); return; }
      var L = d.level || { k: 'bronze', name: 'Bronze', col: '#c97f4a' }, s2 = d.stats || {}, lc = L.col || '#c97f4a';
      card.style.setProperty('--lc', lc); card.className = 'lbm-card lvl-' + (L.k || 'bronze') + (d.frame && d.frame !== 'default' ? ' frame-' + String(d.frame).replace(/[^a-z0-9_]/g, '') : (d.owner ? ' frame-owner' : d.founder ? ' frame-founder' : (d.premium ? ' lbm-premium' : ''))) + (d.cardbg ? ' bg-' + String(d.cardbg).replace(/[^a-z0-9_]/g, '') : ''); // the CHOSEN frame beats the owner/founder auto-halo (owner: a picked frame must actually show), which stays as the no-choice default; bg-* = MP Shop card background
      // Squad cosmetics (borders + badges) take the member's OWN squad colours (2026-10-01). A hidden squad (MP-One) sets neither, so it keeps its designed look. removeProperty matters: the modal is reused, so a previous card's tint must not linger.
      try { if (d.squad && !d.squad.hidden && d.squad.crest) { var _cr = d.squad.crest, _bg = _cr.bg || '#0a0b0d', _fg = _cr.fg || '#c2f64a'; var _lum = function (h) { h = String(h).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); return 0.299 * (parseInt(h.slice(0, 2), 16) || 0) + 0.587 * (parseInt(h.slice(2, 4), 16) || 0) + 0.114 * (parseInt(h.slice(4, 6), 16) || 0); }; var _a = _lum(_fg) >= _lum(_bg) ? _fg : _bg, _a2 = _a === _fg ? _bg : _fg; card.style.setProperty('--sqc', _a); card.style.setProperty('--sqc2', _a2); } else { card.style.removeProperty('--sqc'); card.style.removeProperty('--sqc2'); } } catch (e) {} // the brighter of the two crest colours is the highlight, so a squad with a dark field still gets a visible flame
      var svg = (window.mpLvlSvg ? window.mpLvlSvg(L.k, lc) : '');
      var isSelf = !!d.isSelf; // the SERVER's word - asking the deferred mp-auth bundle made a freshly-opened card offer you a Follow button for yourself
      // The viewer-relative truth comes from the server (iFollow / followsMe / mutual, computed for the signed-in viewer, uncached);
      // the localStorage set is only the fallback for a payload that carries no flags. Before 2026-10-17 the button read localStorage
      // alone, which is per device and knows nothing about the other direction.
      var folSt = folState(d), folFm = !!d.followsMe;
      function stat(v, l, c) { return '<div class="lbm-s"><div class="lbm-sv"' + (c ? ' style="color:' + c + '"' : '') + '>' + v + '</div><div class="lbm-sl">' + l + '</div></div>'; }
      var CHAT_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
      var DUEL_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/></svg>';
      var dmBtn = (folSt !== 'self' && folSt !== 'guest') ? '<button type="button" class="lbm-dm" data-lbdm="' + esc(d.name) + __esT_mpprofile("titleMessage",'" title="Message">') + CHAT_SVG + '</button><button type="button" class="lbm-dm lbm-duel" data-lbduel="' + esc(d.name) + __esT_mpprofile("titleChallengeToA",'" title="Challenge to a duel">') + DUEL_SVG + '</button>' : '';
      // Follow lives beside the close as an icon (person + plus; a check when following); the foot row holds Portfolio instead (2026-10-16)
      var FOL_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path class="fplus" d="M19 8v6M22 11h-6"/><path class="fchk" d="M16 11l2 2 4-4"/><g class="freq"><circle cx="19" cy="11" r="3.9" stroke-width="1.9"/><path d="M19 9.2v2l1.3.9" stroke-width="1.7"/></g></svg>';
      var PORT_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>';
      var folBtn = (folSt === 'self') ? '' : ('<button type="button" class="lbm-folb" data-lbfollow="' + esc(d.name) + '" data-tuid="' + esc(d.uid) + '"' + (folSt === 'guest' ? ' data-auth-open' : '') + '>' + FOL_SVG + '</button>');
      /* FOUR ACTIONS, ONE ROW, ONE SIZE (owner 2026-10-17). Portfolio keeps its own gradient border but loses the
         word - it is a tile like the other three, and the word is in its title and aria-label so it is still named
         for a screen reader and on hover. Follow comes down from the top-right corner it held for one day. */
      var portTtl = __esT_mpprofile("portfolioTitle", 'Portfolio - what they hold on Demo Spot');
      var mBtn = '<div class="lbm-acts">' + (isSelf ? __esT_mpprofile("thisIsYou",'<div class="lbm-self">This is you</div>') : '')
        + '<button type="button" class="lbm-port" data-lbport="' + esc(d.uid) + '" data-lbname="' + esc(d.name) + '" title="' + esc(portTtl) + '" aria-label="' + esc(portTtl) + '">' + PORT_SVG + '</button>'
        + folBtn + dmBtn + '</div>';
      var av = d.avatar ? (/^data:image\//.test(d.avatar) ? '<img class="lbm-av lbm-av-img" src="' + esc(d.avatar) + '" alt="">' : '<span class="lbm-av">' + esc(d.avatar) + '</span>') : '';
      var bioHtml = d.bio ? '<div class="lbm-bio"' + '' + '>' + esc(d.bio) + '</div>' : '';
      var coinsHtml = (d.coins && d.coins.length) ? '<div class="lbm-coins">' + d.coins.map(function (c) { return '<span class="lbm-coin"' + '' + '>' + esc(c) + '</span>'; }).join('') + '</div>' : '';
      // The squad badge lives IN the squad row, at its right end (2026-10-17). Its first home was the top-left corner, where it sat
      // on the FOUNDER tag; its second was top-right at right:50px, which is exactly where the follow icon went on 10-16, so a
      // badge covered the button. The row is the one place that is the squad's own, and a 22px sigil there costs no height.
      var SQB_NAMES = { sqember: 'Ember Sigil', sqwraith: 'Wraith' };
      var sqbId = d.sqbadge ? String(d.sqbadge).replace(/[^a-z0-9]/g, '') : '';
      var sqbHtml = sqbId ? '<span class="lbm-sqb" title="' + __esT_mpprofile("squadBadge", 'Squad badge') + ': ' + (SQB_NAMES[sqbId] || sqbId) + '"><span class="mp-sqbadge sqbadge-' + sqbId + '"></span></span>' : '';
      /* The Premium tag and the medals share ONE row (2026-10-17): the medal used to be a 34x43 disc plus a
         SEASON WINNER caption in a padded pill on a line of its own, which is the space the owner asked back.
         A member with neither gets no row at all. */
      var tagHtml = (d.otag ? '<div class="lbm-premtag lbm-ownertag">' + d.otag + '</div>' : d.owner ? '<div class="lbm-premtag lbm-ownertag">OWNER</div>' : d.premium ? (function(){var tc=TAGC[String(d.frame||'').replace(/[^a-z0-9_]/g,'')]||TAGC['default'];return '<div class="lbm-premtag" data-sheen style="background:linear-gradient(100deg,'+tc[0]+' 0%,'+tc[1]+' 42%,#ffffff 50%,'+tc[1]+' 58%,'+tc[0]+' 100%);background-size:280% 100%;background-position:120% 0;box-shadow:0 0 16px -6px '+tc[0]+'">' + (d.plus ? 'PREMIUM PLUS' : __esT_mpprofile("premiumMember",'PREMIUM MEMBER')) + '</div>';})() : '');
      var medHtml = medalsHtml(d.wins);
      var topRow = (tagHtml || medHtml) ? ('<div class="lbm-toprow">' + tagHtml + medHtml + '</div><div class="lbm-medp" id="lbmMedP" hidden></div>') : '';
      body.innerHTML = topRow
        + '<div class="lbm-head"><div class="lbm-badge">' + svg + '</div><div class="lbm-id"><div class="lbm-name">' + '<span class="lbm-nm">' + av + (d.premium ? '<span class="mp-progold">' + esc(d.name) + '</span>' : esc(d.name)) + '</span>' + (d.mutual ? '<span class="lbm-friend" title="You follow each other">★ Friends</span>' : (d.followsMe ? __esT_mpprofile("followsYou",'<span class="lbm-fw" title="Follows you">Follows you</span>') : '')) + '</div><div class="lbm-lvl" style="color:' + lc + '">' + esc(L.name || 'Bronze') + (L.stars && window.mpPrestigeSvg ? window.mpPrestigeSvg(L.stars, lc) : '') + (L.next ? ' · ' + (L.pct || 0) + __esT_mpprofile("pctTo", '% to ') + esc(L.next) : __esT_mpprofile("maxTier", ' · max tier')) + '</div></div></div>'
        + bioHtml + coinsHtml
        // The squad logo on every member's card is the whole point of the feature (owner 2026-09-29). The
        // renderer lives in mp-auth.js; if that has somehow not parsed the row is skipped rather than drawn
        // half-built - mp-nav pulls mp-auth before any profile card can be opened.
        + ((d.squad && window.mpSquadCrest) ? (d.squad.hidden
            // a hidden squad (MP-One) shows on the card but is NOT a link - it opens for no one
            ? ('<div class="lbm-sq"><span>' + window.mpSquadCrest(d.squad.crest, 30, d.squad.tag) + '</span><div style="min-width:0"><div class="lbm-sqn">' + esc(d.squad.name || '') + '</div><div class="lbm-sqr">' + (d.squad.leader ? __esT_mpprofile("squadLeader", 'Squad leader') : __esT_mpprofile("squadIn", 'Squad')) + ' &middot; ' + esc(String(d.squad.tag || '').toUpperCase()) + '</div></div>' + sqbHtml + '</div>')
            : ('<div class="lbm-sq"><a href="/squads/?sid=' + encodeURIComponent(d.squad.sid) + '">' + window.mpSquadCrest(d.squad.crest, 30, d.squad.tag) + '</a><div style="min-width:0"><div class="lbm-sqn"><a href="/squads/?sid=' + encodeURIComponent(d.squad.sid) + '">' + esc(d.squad.name || '') + '</a></div><div class="lbm-sqr">' + (d.squad.leader ? __esT_mpprofile("squadLeader", 'Squad leader') : __esT_mpprofile("squadIn", 'Squad')) + ' &middot; ' + esc(String(d.squad.tag || '').toUpperCase()) + '</div></div>' + sqbHtml + '</div>')) : '')
        + '<div class="lbm-bar"><i style="width:' + (L.pct || 0) + '%;background-color:' + lc + ';color:' + lc + '"></i></div>'
        + '<div class="lbm-grid">'
          + stat((s2.trades || 0), s2.season ? __esT_mpprofile("tradesSeason",'Trades · season') : 'Trades')
          + stat((s2.winRate || 0) + '%', __esT_mpprofile("winRate",'Win rate'), s2.winRate >= 50 ? '#34d99a' : '')
          + stat((s2.bestRoe == null ? '-' : pctC(s2.bestRoe)), 'Best ROE', s2.bestRoe > 0 ? '#34d99a' : '')
          + stat((s2.bestPnl == null ? '-' : moneyC(s2.bestPnl)), __esT_mpprofile("bestTrade",'Best trade'), s2.bestPnl > 0 ? '#34d99a' : '')
          + stat(moneyC(s2.realized || 0), 'Realized P&L', (s2.realized >= 0 ? '#34d99a' : '#ff6c5c'))
          + stat(moneyC(s2.weekPnl || 0), (s2.weekTrades || 0) + __esT_mpprofile("tradesWk",' trades · wk'), (s2.weekPnl >= 0 ? '#34d99a' : '#ff6c5c'))
        + '</div>'
        // The "Records" card was removed from the profile card on 2026-10-01 (owner). The server still sends d.records; it is simply not rendered.
        + ''
        + '<div class="lbm-foot"><span class="lbm-fol"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M15 3.13a4 4 0 0 1 0 7.75"/></svg><b>' + (d.followers || 0) + '</b> follower' + ((d.followers === 1) ? '' : 's') + '</span>' + mBtn + '</div>'
        + '<div class="lbm-portp" id="lbmPortP" hidden></div>';
      try { folPaint(body.querySelector('.lbm-folb'), folSt, folFm); } catch (e) {}
      fitName(body); // own card has no follow button, so folPaint returns early and never fits it
      try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitName(body); }); } catch (e) {}
    }).catch(function () { body.innerHTML = __esT_mpprofile("couldNotLoadThis",'<div class="lbm-load">Could not load this trader.</div>'); });
  };
  // PORTFOLIO (owner 2026-10-16): what this member holds on Demo Spot - worth, season P&L, rank and the coins with their share.
  // Public endpoint, never a cash figure or a quantity; cached a minute at the edge.
  function fmtM(v) { v = +v || 0; return '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  function pnlM(v) { v = +v || 0; return '<span class="' + (v >= 0 ? 'up' : 'dn') + '">' + (v >= 0 ? '+' : '-') + fmtM(v) + '</span>'; }
  function renderPort(el, d) {
    if (d && d.error) { el.innerHTML = '<div class="lbm-ppf">' + __esT_mpprofile("couldNotLoadPortfolio",'Could not load the portfolio.') + '</div>'; return; }
    if (!d || d.none) { el.innerHTML = '<div class="lbm-pph">' + __esT_mpprofile("demoSpot",'Demo Spot') + '</div><div class="lbm-ppf">' + __esT_mpprofile("noPortfolioYet",'No Demo Spot portfolio yet.') + ' <a href="/spot/">' + __esT_mpprofile("startYours",'Start yours with $10,000') + '</a></div>'; return; }
    var hs = d.holds || [];
    el.innerHTML = '<div class="lbm-pph"><span>' + __esT_mpprofile("demoSpot",'Demo Spot') + '</span><b>' + fmtM(d.equityUsd) + '</b><span>' + __esT_mpprofile("seasonL",'season') + ' ' + pnlM(d.seasonPnlUsd) + '</span>' + (d.rank ? '<span>#' + d.rank + __esT_mpprofile("ofL",' of ') + d.n + '</span>' : '') + '</div>'
      + (hs.length ? hs.slice(0, 6).map(function (h) { return '<div class="lbm-ppr">' + (h.logo ? '<img src="' + esc(h.logo) + '" alt="" loading="lazy" onerror="this.outerHTML=\'<span class=&quot;lg&quot;>' + esc(String(h.sym || '?').slice(0, 3)) + '</span>\'">' : '<span class="lg">' + esc(String(h.sym || '?').slice(0, 3)) + '</span>') + '<span class="sy">' + esc(h.sym) + (h.net ? '<small>' + esc(String(h.net).toUpperCase()) + '</small>' : '') + (h.rugged ? '<small style="color:#ff6c5c">RUGGED</small>' : '') + '<i><b style="width:' + Math.max(2, Math.min(100, +h.share || 0)) + '%"></b></i></span><span class="v">' + fmtM(h.valueUsd) + '</span><span class="p ' + ((+h.pnlPct || 0) >= 0 ? 'up' : 'dn') + '">' + ((+h.pnlPct || 0) >= 0 ? '+' : '') + (+h.pnlPct || 0).toFixed(1) + '%</span></div>'; }).join('') : '<div class="lbm-ppf">' + __esT_mpprofile("allInCash",'All in cash right now - nothing held.') + '</div>')
      + '<div class="lbm-ppf">' + (hs.length > 6 ? '+' + (hs.length - 6) + __esT_mpprofile("moreCoins",' more coins · ') : '') + '<a href="/spot/">' + __esT_mpprofile("openDemoSpot",'Open Demo Spot') + ' &rarr;</a></div>';
  }
  /* A MEDAL IS A QUESTION (owner 2026-10-17: "kad se klikne medalja, treba da izadje text prozor da kaze koje je
     takmicenje i kog datuma je osvojio"). A title attribute answers it on a desktop hover and NEVER on a phone,
     which is most of this audience - so the answer is a panel in the card, the same shape the Portfolio panel uses.
     Tapping the open medal closes it; tapping another switches to it. */
  function medClose() { var el = document.getElementById('lbmMedP'); if (el) { el.hidden = true; el.innerHTML = ''; } var a = document.querySelectorAll('[data-lbmed].on'); for (var i = 0; i < a.length; i++) a[i].classList.remove('on'); }
  /* a popover that closes only by tapping the same medal again is one people leave open: any other click and
     Escape close it too. It runs on the same click as the opener, so it must ignore a medal and itself or it
     would close what was just opened. */
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('[data-lbmed]') || e.target.closest('#lbmMedP')) return;
    medClose();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') medClose(); });
  document.addEventListener('click', function (e) {
    var mb = e.target.closest && e.target.closest('[data-lbmed]'); if (!mb) return;
    var el = document.getElementById('lbmMedP'); if (!el) return;
    var was = mb.classList.contains('on');
    var all = document.querySelectorAll('[data-lbmed]'); for (var i = 0; i < all.length; i++) all[i].classList.remove('on');
    if (was) { el.hidden = true; el.innerHTML = ''; return; }
    mb.classList.add('on');
    var name = mb.getAttribute('data-mn') || '', dates = (mb.getAttribute('data-md') || '').split('|').filter(Boolean);
    var c = medBoard(mb.getAttribute('data-lbmed'));
    var n = dates.length;
    var head = '<h4 style="color:' + c.a + '">' + esc(name) + '</h4>'
      + (c.real ? '<div class="lbm-medreal">' + __esT_mpprofile("realTradingBoard", 'Real trading board - scored on a live exchange account') + '</div>' : '');
    var line = n ? ('<ul>' + dates.map(function (dt) { return '<li>' + __esT_mpprofile("wonFirstPlaceOn", 'First place &middot; ') + '<b>' + esc(dt) + '</b></li>'; }).join('') + '</ul>')
      : ('<ul><li>' + __esT_mpprofile("wonThisBoard", 'First place on this board') + '</li></ul>');
    el.innerHTML = head + line;
    el.style.borderLeftColor = c.a;
    el.hidden = false;
    /* measure AFTER it is visible, and clamp to the card so a medal at either end cannot push it off an edge.
       Offsets come from the card's own rect: .lbm-body is static, so .lbm-card is the offset parent. */
    try {
      var card = mb.closest('.lbm-card');
      if (card) {
        el.style.left = '0px'; el.style.top = '0px';
        var cr = card.getBoundingClientRect(), br = mb.getBoundingClientRect(), pw = el.offsetWidth;
        var mid = br.left - cr.left + br.width / 2;
        var left = Math.max(10, Math.min(cr.width - pw - 10, mid - pw / 2));
        el.style.left = Math.round(left) + 'px';
        el.style.top = Math.round(br.bottom - cr.top + 8) + 'px';
        el.style.setProperty('--ax', Math.round(Math.max(10, Math.min(pw - 19, mid - left - 4.5))) + 'px');
      }
    } catch (x2) {}
    try { window.__mpTrack && window.__mpTrack('profile', 'medal:' + mb.getAttribute('data-lbmed')); } catch (x) {}
  });
  document.addEventListener('click', function (e) {
    var pb = e.target.closest && e.target.closest('[data-lbport]'); if (!pb) return;
    var el = document.getElementById('lbmPortP'); if (!el) return;
    if (!el.hidden) { el.hidden = true; pb.classList.remove('open'); return; }
    el.hidden = false; pb.classList.add('open'); el.innerHTML = '<div class="lbm-ppf">' + __esT_mpprofile("loadingPortfolio",'Loading portfolio…') + '</div>';
    try { window.__mpTrack && window.__mpTrack('profile', 'portfolio'); } catch (x) {}
    fetch('/api/spot/public?uid=' + encodeURIComponent(pb.getAttribute('data-lbport'))).then(function (r) { return r.json(); }).then(function (d) { renderPort(el, d); }).catch(function () { el.innerHTML = '<div class="lbm-ppf">' + __esT_mpprofile("couldNotLoadPortfolio",'Could not load the portfolio.') + '</div>'; });
  });
  document.addEventListener('click', function (e) {
    var fb = e.target.closest && e.target.closest('[data-lbfollow]');
    if (fb) {
      if (fb.hasAttribute('data-auth-open')) return; // a guest: mp-auth's own handler opens the sign-in sheet
      if (fb.getAttribute('data-busy') === '1') return; // a second tap while the first is in flight would paint the answer to a question nobody asked
      var name = fb.getAttribute('data-lbfollow'), tuid = fb.getAttribute('data-tuid');
      fb.setAttribute('data-busy', '1');
      fetch('/api/lb/follow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tuid: tuid, tname: name }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          fb.removeAttribute('data-busy');
          if (j && j.error === 'login_required') { if (window.mpAuth && window.mpAuth.open) window.mpAuth.open(); return; }
          if (!j || !j.ok) return;
          /* the SERVER's new truth, both directions - the old handler guessed the other direction from a
             data- attribute rendered when the card opened, so following someone who already followed you
             left the button on the one-way glyph until the card was closed and opened again. */
          folPaint(fb, folState({ viewerSignedIn: true, iFollow: !!j.following, followsMe: !!j.followsMe, mutual: !!j.mutual, requested: !!j.requested }), !!j.followsMe);
        })
        .catch(function () { fb.removeAttribute('data-busy'); });
      return;
    }
    var du = e.target.closest && e.target.closest('[data-lbduel]');
    if (du) { var un = du.getAttribute('data-lbduel'); closeModal(); if (window.mpAuth && window.mpAuth.duel) window.mpAuth.duel(un); else if (window.mpAuth && window.mpAuth.open) window.mpAuth.open(); return; }
    var db = e.target.closest && e.target.closest('[data-lbdm]');
    if (db) { var dn = db.getAttribute('data-lbdm'); closeModal(); if (window.mpAuth && window.mpAuth.dm) window.mpAuth.dm(dn); else if (window.mpAuth && window.mpAuth.open) window.mpAuth.open(); return; }
    var row = e.target.closest && e.target.closest('[data-lbu]');
    if (row && !e.target.closest('[data-auth-open]')) window.mpOpenProfile(row.getAttribute('data-lbu'));
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  /* Sheen for the member tag: driven from JS, NOT a CSS @keyframes - animation effects can be turned off
     at the OS level (the owner runs that way) and keyframes then never paint. A transform-free
     background-position tween always renders, and it stops while the tab is hidden. */
  (function(){ if (window.__mpSheen) return; window.__mpSheen = 1;
    var t = 0;
    setInterval(function(){
      if (document.hidden) return;
      var els = document.querySelectorAll('[data-sheen]');
      if (!els.length) return;
      t = (t + 3) % 260;
      for (var i = 0; i < els.length; i++) els[i].style.backgroundPosition = (120 - t) + '% 0';
    }, 45);
  })();
})();
