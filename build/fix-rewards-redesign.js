#!/usr/bin/env node
/* /rewards/ REDESIGN + THE GATE COMES OFF THE PAGE (2026-10-23, owner: "iskljuci i ispravi sve iskaze da je bronza potrebna
   za nagrade. Molim te sredi rewards tab da izgleda jako dobro ... novi izgled i nesto nesvakidasnje. Mora da bude prakticno,
   ako imamo 4 kartice koje su ista stvar samo npr. razlicit brend, mozda to moze da se spoji u jednu").

   MEASURED BEFORE (scratchpad/rewards-measure.js, production): a signed-in member at 1366x768 met the hero, then a 603px
   "What's on the table" table, then the level card, then a 351px "Rewards are locked" card, then THREE 240px cards that
   differed only by exchange logo (MEXC / BingX / Bitget; Moon is a fourth) - the balance sat 894px down and never in
   the first screen. 4.58 desktop screens, 4.57 on a phone.

   THE SHAPE NOW - a wallet beside a ledger:
     - The scoreboard: "What's on the table" is four TILES in one row (two by two on a phone) instead of four stacked
       table rows - every figure keeps its id (rewards-e2e compares them with /api/reward/me).
     - Two columns from 1000px: a STICKY wallet column (balance, today's claims, Claim, Withdraw, level, payout history)
       and a numbered LEDGER of every way to earn (01 sign-up bonuses, 02 daily missions, 03 invite, 04 post & earn,
       05 season boards, 06 creator program). One column on a phone, wallet first.
     - The four sign-up bonus cards are ONE card with a venue switch (Moon / MEXC / BingX / Bitget). The four old cards
       become PANELS inside it - their ids, inputs, buttons and status slots are untouched, so the page's own
       signCard()/loadMoon() drivers keep working; a small hub script only switches panels, disables a venue ops has
       paused (its panel is `hidden`), mirrors each panel's status onto its tab, and sums the amounts in the header.
     - The Bronze gate is gone from the page: the "Rewards are locked" card can no longer be raised (isUnranked() is
       false - the server says ranked:true for everybody since the same day), the gate line under the scoreboard is
       deleted, and every "Bronze (500 XP)" sentence is rewritten or removed.
   Markup is MOVED, never retyped: each card block is cut by its own opening tag and re-inserted; the JS binds by id.

   Idempotent, --dry. Then: node build/es/check-inline-js.js, scratchpad/rewards-measure.js --local, deploy.      */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'rewards', 'index.html');
let h = fs.readFileSync(F, 'utf8');
if (h.indexOf('class="rwd-cards rw3"') >= 0) { console.log('fix-rewards-redesign: nothing to do'); process.exit(0); }
const N = '\r\n';
const done = [];
function idx(m, from) { const i = h.indexOf(m, from || 0); if (i < 0) throw new Error('anchor not found: ' + m.slice(0, 70)); if (h.indexOf(m, i + 1) >= 0) throw new Error('anchor not unique: ' + m.slice(0, 70)); return i; }
function one(name, a, b) { const n = h.split(a).length - 1; if (n !== 1) throw new Error(name + ': anchor x' + n); h = h.split(a).join(b); done.push(name); }

/* ---- 1. cut every card block out of .rwd-cards (opening tag to the next card's opening tag) ---- */
const START = '  <div class="rwd-cards">';
const CARD = {
  auth: '  <div class="card" id="authCard">',
  locked: '  <div class="card card--primary" id="lockedCard" hidden',
  dash: '  <div class="card card--primary" id="dash" hidden>',
  wdh: '  <div class="card" id="wdHistCard" hidden>',
  byb: '<div class="bybwin" id="bybWin"',
  moon: '    <div class="card" id="moonCard" hidden>',
  mexc: '  <div class="card" id="mexcCard" hidden>',
  bingx: '  <div class="card" id="bingxCard" hidden>',
  bitget: '  <div class="card" id="bitgetCard" hidden>',
  promo: '  <div class="card" id="promoCard" hidden>',
  lvl: '  <div class="card" id="lvlCard">',
  msn: '  <div class="card" id="msnCard" hidden>',
};
const order = ['auth', 'locked', 'dash', 'wdh', 'byb', 'moon', 'mexc', 'bingx', 'bitget', 'promo', 'lvl', 'msn'];
const s0 = idx(START);
const pos = {}; order.forEach(k => { pos[k] = idx(CARD[k]); });
for (let i = 1; i < order.length; i++) if (pos[order[i]] <= pos[order[i - 1]]) throw new Error('card order is not what this patcher expects: ' + order[i]);
const tailAt = h.indexOf('<style>', pos.msn); if (tailAt < 0) throw new Error('no style block after msnCard');
const blk = {}; order.forEach((k, i) => { const end = i + 1 < order.length ? pos[order[i + 1]] : tailAt; blk[k] = h.slice(pos[k], end).replace(/\s+$/, ''); });
const head = h.slice(0, s0), tail = h.slice(tailAt); // tail = [style][refCard][streamCard][lbCompCard][howCard][style][aff] </div> ...

/* ---- 2. the merged sign-up card ---- */
const tab = (v, label, img, bg) => '<button type="button" role="tab" data-v="' + v + '"><img src="' + img + '" alt="" width="18" height="18"' + (bg ? ' style="background:' + bg + ';padding:' + (v === 'moon' ? '2px' : '0') + '"' : '') + '>' + label + '<i class="rw-st" aria-hidden="true"></i></button>';
const HUB = [
  '  <div class="card" id="signupHub" hidden>',
  '    <div class="lbl">Exchange sign-up bonuses <span class="rw-amt">+$<span id="hubTotal">4</span> in total</span></div>',
  '    <p class="rw-p">Open an account through our link, send us the UID it got (Moon: the username), and the bonus lands on your balance after a check. One bonus per exchange, one per account - no level needed.</p>',
  '    <div class="rw-tabs" id="hubTabs" role="tablist" aria-label="Exchange">',
  '      ' + tab('moon', 'Moon', '/assets/moon.png', '#fff') + tab('mexc', 'MEXC', '/assets/ex/mexc.png', '#0057ff') + tab('bingx', 'BingX', '/assets/ex/bingx.png', '#2b54fc') + tab('bitget', 'Bitget', '/assets/ex/bitget.png', '#00e7d8'),
  '    </div>',
  '    <div class="rw-panels">',
  blk.moon.replace(/^ {4}/, '      '), blk.mexc.replace(/^ {2}/, '      '), blk.bingx.replace(/^ {2}/, '      '), blk.bitget.replace(/^ {2}/, '      '),
  '    </div>',
  '  </div>',
].join(N);

/* ---- 3. reassemble: scoreboard stays above, then the wallet aside + the ledger main ---- */
const dash = blk.dash.replace('  <div class="card card--primary" id="dash" hidden>' + N + '    <div class="bal-wrap">', '  <div class="card card--primary" id="dash" hidden>' + N + '    <div class="lbl">Your wallet</div>' + N + '    <div class="bal-wrap">');
if (dash === blk.dash) throw new Error('dash label not inserted');
h = head
  + '  <div class="rwd-cards rw3">' + N
  + '  <aside class="rw-side" aria-label="Your wallet">' + N
  + blk.auth + N + dash + N + blk.lvl + N + blk.wdh + N + blk.locked + N
  + '  </aside>' + N
  + '  <main class="rw-main" aria-label="Ways to earn">' + N
  + HUB + N + blk.msn + N + blk.promo + N
  + tail;
done.push('cards regrouped: wallet aside + ledger main, four sign-up cards as one hub');
// close <main> where .rwd-cards closes, and park the win modal outside the grid
one('close the ledger + park the modal', '  </div>' + N + N + '  <p class="note">Bots and multi-accounting get nothing.</p>', '  </main>' + N + '  </div>' + N + blk.byb + N + N + '  <p class="note">Bots and multi-accounting get nothing.</p>');

/* ---- 4. the gate leaves the page ---- */
one('the gate line under the scoreboard', '    <p class="et-gate">The faucet, the missions, referrals and withdrawals open at <b>Bronze - 500 XP</b>, which is free to earn on the <a href="/academy/">Academy</a> and <a href="/paper-trade">Paper Trade</a>. The welcome bonus and the sign-up bonuses do not wait for it.</p>' + N, '');
one('isUnranked is false', "  function isUnranked(user){ if(!user)return false; if(user.level&&user.level.k)return user.level.k==='unranked'; if(user.xp!=null)return +user.xp<MIN_XP; return false; }", "  function isUnranked(user){ return false; } // THE BRONZE GATE IS OFF (2026-10-23, owner) - the server answers ranked:true for every account; the locked card can no longer be raised");
one('locked card copy 1', 'You\'re <b style="color:#8fb0c8">Unranked</b> - reach <b style="color:#c97f4a">Bronze&nbsp;(500&nbsp;XP)</b> to unlock', 'This account cannot use the rewards area right now');
one('locked card copy 2', 'The faucet, daily missions, withdrawals and the Moon sign-up bonus open up at <b style="color:#c97f4a">Bronze - 500 XP</b>. It keeps rewards for people who actually use the platform. The good news: XP is quick to earn, and every way to earn it is free.', 'If you think this is a mistake, write to support from your account menu.');
one('locked card copy 3', 'Fastest routes to 500 XP: finish a few', 'Meanwhile: finish a few');
one('locked card progress label', '<span id="lockProgLbl">0 / 500 XP</span>', '<span id="lockProgLbl"></span>');
one('need_xp 1', "else if (e === 'need_xp') msg('Reach Bronze (500 XP) first - the whole rewards area opens there.', 'err');", "else if (e === 'need_xp') msg('This account cannot claim a sign-up bonus right now.', 'err');");
one('referral copy', 'Your reward drops automatically once your friend becomes a <b>real trader</b>: reaches <b style="color:#c97f4a">Bronze</b> (500 XP), closes <b>5 trades</b> and sticks around for <b>3 days</b>.', 'Your reward drops automatically once your friend becomes a <b>real trader</b>: closes <b>5 trades</b> and sticks around for <b>3 days</b>.');
one('hero sub', '<p class="sub">Use the site, finish the daily missions, stack USDT - then cash it out to your Bybit or Moon account.</p>', '<p class="sub">Every account earns from its first day - no level to reach, no deposit. Claim, run the missions, invite, compete, then cash out from $5 to Bybit, Moon, MEXC or Bitget.</p>');
one('reg comment', "  // Faucet/rewards gate (2026-08-04): the whole rewards system unlocks at Bronze (500 XP). Signed-in users below" + N + "  // that are 'unranked' → the earn cards hide and #lockedCard explains why + points to Academy/Paper Trade/Charts.", "  // The faucet/rewards gate of 2026-08-04 (Bronze, 500 XP) was switched OFF on 2026-10-23 - isUnranked() below is false for everybody.");
one('withdraw need_xp copy', "'Reach Bronze (500 XP) to unlock withdrawals - earn free XP on the Academy a", "'Withdrawals are not open to this account right now - write to support. a");
one('withdrawals-open copy', '__esT_rewardsindex("withdrawalsOpenAtBronze","Withdrawals open at <b>Bronze</b> (500 XP) - free to earn on the Academy. Your balance keeps growing until then.")', '__esT_rewardsindex("withdrawalsOpenAtBronze","Withdrawals open from $5.00 on this page - your balance keeps growing until then.")');
one('welcome hook copy', 'The faucet, missions and withdrawals unlock at <b style=\\"color:#c97f4a\\">Bronze - 500 XP</b>, which is quick and free to earn on the <a href=\\"/academy/\\" style=\\"color:#c2f64a\\">Academy</a> and <a href=\\"/paper-trade\\" style=\\"color:#c2f64a\\">Paper Trade</a> - then claim free USDT every few minutes.', 'The faucet, missions and withdrawals are open from your first day - no level to reach. Claim free USDT every few minutes, and earn XP on the <a href=\\"/academy/\\" style=\\"color:#c2f64a\\">Academy</a> and <a href=\\"/paper-trade\\" style=\\"color:#c2f64a\\">Paper Trade</a> for bigger claims.');
one('claim need_xp copy', "__esT_rewardsindex(\"reachBronze500Xp\",'Reach Bronze (500 XP) to unlock the faucet - earn free XP on the Academy and Paper Trade.')", "__esT_rewardsindex(\"reachBronze500Xp\",'This account cannot claim right now - write to support.')");
/* the Spanish dictionary the twin is generated from carries the same four sentences */
one('es: welcomeBody', 'El faucet, las misiones y los retiros se desbloquean en <b style=\\"color:#c97f4a\\">Bronze - 500 XP</b>, que se consiguen rápido y gratis en la <a href=\\"/es/academy/\\" style=\\"color:#c2f64a\\">Academia</a> y en <a href=\\"/es/paper-trade\\" style=\\"color:#c2f64a\\">Paper Trade</a> - y luego reclama USDT gratis cada pocos minutos.', 'El faucet, las misiones y los retiros están abiertos desde tu primer día - sin nivel que alcanzar. Reclama USDT gratis cada pocos minutos, y gana XP en la <a href=\\"/es/academy/\\" style=\\"color:#c2f64a\\">Academia</a> y en <a href=\\"/es/paper-trade\\" style=\\"color:#c2f64a\\">Paper Trade</a> para reclamos más grandes.');
one('es: reachBronze500Xp', '"reachBronze500Xp":"Alcanza Bronze (500 XP) para desbloquear el faucet - gana XP gratis en la Academia y en Paper Trade."', '"reachBronze500Xp":"Esta cuenta no puede reclamar ahora mismo - escribe a soporte."');
one('es: reachBronze500Xp2', '"reachBronze500Xp2":"Alcanza Bronze (500 XP) para desbloquear los retiros - gana XP gratis en la Academia y en Paper Trade."', '"reachBronze500Xp2":"Los retiros no están abiertos para esta cuenta ahora mismo - escribe a soporte."');
one('es: withdrawalsOpenAtBronze', '"withdrawalsOpenAtBronze":"Los retiros se abren en <b>Bronze</b> (500 XP) - lo consigues gratis en la Academia. Tu saldo sigue creciendo hasta entonces."', '"withdrawalsOpenAtBronze":"Los retiros se abren desde $5.00 en esta página - tu saldo sigue creciendo hasta entonces."');

/* ---- 5. the look ---- */
const CSS = [
  '<style id="rw3css">',
  '/* ═══ REWARDS REDESIGN (2026-10-23): a wallet beside a ledger - see build/fix-rewards-redesign.js ═══ */',
  '.wrap{max-width:1120px}',
  '@media(max-width:1000px){.wrap{max-width:660px}}',
  '.rwd-hero{margin:0 0 18px;display:flex;align-items:flex-end;justify-content:space-between;gap:14px 28px;flex-wrap:wrap}',
  '.rwd-hero h1{margin:0;font-size:36px}.rwd-hero .sub{margin:0 0 4px;font-size:14px;max-width:520px;color:var(--dim)}',
  '.rwd-hero .pill{margin:0 0 10px;display:block;width:max-content}',
  '@media(max-width:560px){.rwd-hero h1{font-size:28px}}',
  '/* the scoreboard: four tiles in one row, the amount first */',
  '.rwd-table{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:0 0 18px}',
  '.rwd-table .et-h{grid-column:1/-1;display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;padding:16px 20px 12px}',
  '.rwd-table .et-h h2{margin:0;font-size:16px}.rwd-table .et-h p{margin:0;font-size:12.5px}',
  '.rwd-table .et-r{display:flex;flex-direction:column;gap:7px;padding:16px 18px 17px;border-top:1px solid var(--line);border-left:1px solid var(--line);min-width:0}',
  '.rwd-table .et-r:nth-child(2){border-left:0}',
  '.rwd-table .et-k{order:0}.rwd-table .et-v{order:1;text-align:left;white-space:normal}.rwd-table .et-d{order:2;font-size:12.5px;line-height:1.5}',
  '.rwd-table .eamt{font-size:34px}.rwd-table .et-v i{display:inline;margin-left:7px}',
  '.rwd-table .et-f{grid-column:1/-1;padding:12px 20px 13px}',
  '@media(max-width:860px){.rwd-table{grid-template-columns:repeat(2,minmax(0,1fr))}.rwd-table .et-r:nth-child(4){border-left:0}.rwd-table .eamt{font-size:28px}.rwd-table .et-r{padding:14px 15px}}',
  '@media(max-width:560px){.rwd-table .et-h{padding:14px 15px 10px}.rwd-table .et-f{padding:11px 15px 12px}}',
  '/* two columns from 1000px: the wallet stays put, the ledger scrolls */',
  '.rwd-cards.rw3{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:16px!important;align-items:start}',
  '@media(min-width:1000px){.rwd-cards.rw3{grid-template-columns:372px minmax(0,1fr)!important;gap:20px!important}.rw-side{position:sticky;top:96px}}',
  '.rw-side,.rw-main{display:grid;gap:14px;min-width:0;margin:0}',
  '.rw-side>.card,.rw-main>.card{margin:0;min-width:0}',
  '.rw-main{counter-reset:rw}.rw-main>.card{counter-increment:rw;position:relative}',
  '.rw-main>#howCard,.rw-main>.card.aff{display:none!important}',
  '/* one eyebrow grammar for every way to earn: a number, a name, the amount on the right */',
  '.rw-main>.card>.lbl,.rw-main>#lbCompCard>.lbc-tag{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:10.5px;letter-spacing:.14em;color:var(--dim);margin-bottom:10px}',
  '.rw-main>.card>.lbl::before,.rw-main>#lbCompCard>.lbc-tag::before,#streamCard .st-eyebrow::before{content:counter(rw,decimal-leading-zero) " /";color:var(--lime);font-weight:700;letter-spacing:.08em}',
  '.rw-main>.card>.lbl .rw-amt,.rw-main>.card>.lbl>span[style*="margin-left:auto"]{margin-left:auto!important;letter-spacing:0;text-transform:none;font-family:\'Space Mono\',monospace;font-size:12.5px}',
  '.rw-p{margin:0 0 12px;font-size:13px;line-height:1.55;color:var(--dim)}',
  '/* the wallet */',
  '#dash>.lbl:first-child{display:flex;align-items:center;gap:9px}#dash>.lbl:first-child::before{content:\'\';width:7px;height:7px;border-radius:50%;background:var(--lime);box-shadow:0 0 10px rgba(194,246,74,.9)}',
  '#streamCard .st-eyebrow::before{margin-right:6px}',
  'body.rwd-in #lbCompCard .lbc-note{display:none}',
  '#dash .bal{font-size:50px;letter-spacing:-2.5px}@media(max-width:560px){#dash .bal{font-size:42px}}',
  '#dash .prog{height:11px;border-radius:8px;margin:16px 0 7px}#dash .claim-row{margin-top:14px}#dash .claim-row .btn{padding:16px;font-size:14.5px;border-radius:13px}',
  '#dash #wdBtn{border-radius:11px;padding:11px 15px;font-size:12.5px}',
  '@media(max-width:460px){#wdAddrRow>div[style*="display:flex"]{flex-wrap:wrap}#wdAddrRow>div[style*="display:flex"]>button{flex:1 1 45%!important}}',
  '#lvlCard .lbl{display:flex;align-items:center;gap:9px}',
  '/* the sign-up hub: the four old cards are panels, one shown at a time */',
  '.rw-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:0 0 14px}',
  '.rw-tabs button{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 8px;border-radius:12px;border:1px solid var(--line2);background:#0c0f13;color:#c7ced6;font:700 12.5px \'Familjen Grotesk\',system-ui,sans-serif;cursor:pointer;transition:border-color .15s,background .15s,transform .12s}',
  '.rw-tabs button img{width:18px;height:18px;border-radius:5px;display:block;flex:none;object-fit:contain}',
  '.rw-tabs button:hover{border-color:rgba(194,246,74,.45)}.rw-tabs button.on{border-color:var(--lime);background:rgba(194,246,74,.09);color:#e9e7df}',
  '.rw-tabs button[disabled]{opacity:.32;cursor:default}.rw-tabs button[disabled]:hover{border-color:var(--line2)}',
  '.rw-tabs .rw-st{position:absolute;top:-5px;right:-5px;width:13px;height:13px;border-radius:50%;border:2px solid #0d1015;display:none}',
  '.rw-tabs .done .rw-st{display:block;background:var(--lime)}.rw-tabs .wait .rw-st{display:block;background:#ffd75a}.rw-tabs .bad .rw-st{display:block;background:#ff6258}',
  '@media(max-width:460px){.rw-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}}',
  '#signupHub .rw-panels>.card{border:0;background:none;box-shadow:none;padding:0;margin:0;border-radius:0}',
  '#signupHub .rw-panels>.card:not(.rw-on){display:none!important}',
  '#signupHub .rw-panels>.card>.lbl{display:none!important}', /* the panel headers carry an inline display:flex */
  '#signupHub .rw-panels>.card .note{text-align:left}',
  '/* the season boards card: four tiles stay, the long paragraph tightens */',
  '#lbCompCard .lbc-title{font-size:21px}#lbCompCard .lbc-p{font-size:13.5px}',
  '/* owner 2026-10-23: no "which level you are" on this page - the card keeps only the signed-in line (sign out, contact) */',
  '#lvlCard>.lbl,#lvlMine,#lvlCard>a[href="/levels/"]{display:none!important}#lvlCard #authWho{margin:0!important;padding-bottom:0!important;border-bottom:0!important}',
  '/* phone: the four board tiles stay two by two (one column was 1,089px of the page), the scoreboard tiles tighten */',
  '@media(max-width:460px){#lbCompCard .pboards{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px}#lbCompCard .pboard{padding:12px 11px 10px}#lbCompCard .pboard-nm{font-size:13.5px}#lbCompCard .pboard-sub{font-size:10.5px;max-width:none}#lbCompCard .pboard-tag{position:static;display:inline-block;margin-bottom:8px}#lbCompCard .pboard-ic{width:28px;height:28px;margin-bottom:8px}}',
  '@media(max-width:560px){.rwd-table .et-d{font-size:12px;line-height:1.45}.rwd-table .et-r{gap:5px;padding:12px 13px 13px}.rwd-table .eamt{font-size:26px}}',
  '</style>',
].join(N);
one('the stylesheet', '<script defer src="/assets/sentry.js', CSS + N + '<script defer src="/assets/sentry.js');

/* ---- 6. the hub script ---- */
const JS = [
  '<script>',
  '/* the sign-up hub (2026-10-23): switches the four venue panels, disables a venue ops paused, mirrors each panel\'s status onto its tab, sums the header */',
  '(function(){var hub=document.getElementById(\'signupHub\'),tabs=document.getElementById(\'hubTabs\');if(!hub||!tabs)return;var V=[\'moon\',\'mexc\',\'bingx\',\'bitget\'];',
  '  function card(v){return document.getElementById(v+\'Card\');}',
  '  function show(v){V.forEach(function(k){var c=card(k);if(c)c.classList.toggle(\'rw-on\',k===v);});Array.prototype.forEach.call(tabs.querySelectorAll(\'button\'),function(b){b.classList.toggle(\'on\',b.getAttribute(\'data-v\')===v);});try{localStorage.setItem(\'mp_rw_hub\',v);}catch(e){}}',
  '  function sync(){var any=false,first=null,tot=0;',
  '    V.forEach(function(k){var c=card(k),b=tabs.querySelector(\'[data-v="\'+k+\'"]\'),off=!c||c.hidden;if(b)b.disabled=off;if(!off){any=true;if(!first)first=k;var a=document.getElementById(k+\'Amt\');tot+=parseFloat(a&&a.textContent)||0;}',
  '      var st=document.getElementById(k+\'Status\'),t=st?st.textContent:\'\';if(b){b.classList.toggle(\'done\',/PAID/.test(t));b.classList.toggle(\'wait\',/REVIEW/.test(t));b.classList.toggle(\'bad\',/REJECTED/.test(t));}});',
  '    hub.hidden=!any;var te=document.getElementById(\'hubTotal\');if(te)te.textContent=(tot%1?tot.toFixed(2):String(tot));',
  '    var cur=tabs.querySelector(\'button.on\');if(any&&(!cur||cur.disabled)){var want=null;try{want=localStorage.getItem(\'mp_rw_hub\');}catch(e){}var w=want&&tabs.querySelector(\'[data-v="\'+want+\'"]\');show(w&&!w.disabled?want:first);}}',
  '  tabs.addEventListener(\'click\',function(e){var b=e.target.closest&&e.target.closest(\'button[data-v]\');if(!b||b.disabled)return;show(b.getAttribute(\'data-v\'));});',
  '  var mo=new MutationObserver(sync);V.forEach(function(k){var c=card(k);if(c)mo.observe(c,{attributes:true,attributeFilter:[\'hidden\']});var st=document.getElementById(k+\'Status\');if(st)mo.observe(st,{childList:true,subtree:true});});',
  '  sync();window.__mpRwHub={show:show,sync:sync};',
  '})();',
  '</script>',
].join(N);
one('the hub script', '</body>', JS + N + '</body>');

/* ---- 7. structural proof before writing ---- */
const must = ['id="signupHub"', 'id="hubTabs"', 'class="rw-side"', 'class="rw-main"', 'id="moonCard"', 'id="mexcCard"', 'id="bingxCard"', 'id="bitgetCard"', 'id="dash"', 'id="lvlCard"', 'id="msnCard"', 'id="refCard"', 'id="lbCompCard"', 'id="streamCard"', 'id="bybWin"', 'id="eaOnce"', 'id="eaMin"'];
for (const m of must) if ((h.split(m).length - 1) !== 1) throw new Error('after the patch ' + m + ' appears ' + (h.split(m).length - 1) + ' times');
// Bronze is still a LEVEL name on the level card; what may not survive is Bronze as a condition
if (/Bronze[^<]{0,12}\(500|500 XP|reach(es)? Bronze|at Bronze|open at <b>Bronze|unlock/i.test(h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, ''))) {
  const rest = h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').match(/.{60}(?:Bronze[^<]{0,12}\(500|500 XP|reach(?:es)? Bronze|at Bronze|unlock).{60}/gi);
  throw new Error('a gate sentence survives in the markup: ' + JSON.stringify(rest));
}
const opens = (h.match(/<div\b/g) || []).length, closes = (h.match(/<\/div>/g) || []).length;
if (opens !== closes) throw new Error('div balance broke: ' + opens + ' open vs ' + closes + ' close');
console.log('fix-rewards-redesign: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('  written: dist/rewards/index.html');
