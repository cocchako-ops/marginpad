#!/usr/bin/env node
/* THE SIGN-UP HUB SWAPS BITGET FOR BYBIT (2026-10-24, owner: "Bitget ukini $1 bonus. Samo umesto njega ubaci
   Bybit. (automatski approve)").

   The hub is one card with a tab per venue and a PANEL per venue carrying that venue's own ids - `signCard(v)`
   drives every one of them off `v`, so a venue is a tab, a panel and one entry in the hub's list. Bitget's panel
   is REPLACED rather than hidden: the bonus is retired, and a tab that opens a card nobody can be paid from is
   worse than no tab. Claims already filed stay on the ops desk, which reads SIGN_VENUES and keeps a closed
   venue's fold for exactly that reason.

   The Bybit copy says the check is AUTOMATIC, because it is: the affiliate API names every referred UID, so a
   member who opened through our link is paid on the next sweep without anyone reading a portal.

   Idempotent, --dry. */
'use strict';
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'rewards', 'index.html');
let h = fs.readFileSync(F, 'utf8');
if (h.indexOf('bybitCard') >= 0) { console.log('fix-rewards-bybit-panel: already applied'); process.exit(0); }

/* 1. the tab */
const TAB_OLD = '<button type="button" role="tab" data-v="bitget"><img src="/assets/ex/bitget.png" alt="" width="18" height="18" style="background:#00e7d8;padding:0">Bitget<i class="rw-st" aria-hidden="true"></i></button>';
const TAB_NEW = '<button type="button" role="tab" data-v="bybit"><img src="/assets/ex/bybit.png" alt="" width="18" height="18" style="background:#16181e;padding:0">Bybit<i class="rw-st" aria-hidden="true"></i></button>';
if ((h.split(TAB_OLD).length - 1) !== 1) throw new Error('the Bitget tab is not where it was');
h = h.split(TAB_OLD).join(TAB_NEW);

/* 2. the panel - same shape as its neighbours, its own ids, and copy that states the check is automatic */
const P_START = '      <div class="card" id="bitgetCard" hidden>';
const P_END = '    </div>\n  </div>\n  <div class="card" id="msnCard" hidden>';
const ps = h.indexOf(P_START);
if (ps < 0) throw new Error('the Bitget panel is gone');
const pe = h.indexOf('</div>', h.indexOf('id="bitgetStatus"'));
if (pe < 0) throw new Error('the Bitget panel has no end');
const panelEnd = h.indexOf('</div>', pe + 6) + 6;   // the status div, then the panel's own close
const NEW_PANEL = '      <div class="card" id="bybitCard" hidden>\n'
  + '    <div class="lbl" style="display:flex;align-items:center;gap:9px"><img src="/assets/ex/bybit.png" alt="" aria-hidden="true" width="22" height="22" style="width:22px;height:22px;border-radius:6px;display:block;flex:0 0 auto;background:#16181e">Bybit sign-up bonus <span style="margin-left:auto;color:#c2f64a;font-weight:800;text-shadow:0 0 12px rgba(194,246,74,.65)">+$<span id="bybitAmt">1</span></span></div>\n'
  + '    <p class="note" style="text-align:left;margin:10px 0 12px;line-height:1.55">Create a <b>Bybit</b> account through our link, then enter your Bybit UID below. We check it against Bybit’s own referral list and the bonus is paid <b>automatically</b> - usually within ten minutes, with <b style="color:#c2f64a">$<span id="bybitAmt2">1</span></b> on your MarginPad balance. One bonus per account.</p>\n'
  + '    <a class="btn btn-lime" id="bybitRefBtn" data-mpex="Bybit" href="#" target="_blank" rel="noopener sponsored" style="width:100%;display:block;text-align:center;text-decoration:none;margin-bottom:10px">1) Create your Bybit account</a>\n'
  + '    <div id="bybitForm"><div class="addr-row"><input id="bybitUser" type="text" inputmode="numeric" placeholder="2) Your Bybit UID" autocomplete="off" spellcheck="false" /><button class="btn btn-ghost" id="bybitSubmit" type="button">Submit</button></div></div>\n'
  + '    <div class="msg" id="bybitMsg"></div>\n'
  + '    <div id="bybitStatus" style="margin-top:8px"></div>\n'
  + '  </div>';
h = h.slice(0, ps) + NEW_PANEL + h.slice(panelEnd);

/* 3. the hub's own list */
const L_OLD = "['moon','mexc','bingx','bitget']";
if ((h.split(L_OLD).length - 1) < 1) throw new Error('the hub venue list is not where it was');
h = h.split(L_OLD).join("['moon','mexc','bingx','bybit']");

/* 4. the lead sentence promised a manual check for every venue; two of the four are automatic now */
const LEAD_OLD = 'send us the UID it got (Moon: the username), and the bonus lands on your balance after a check.';
const LEAD_NEW = 'send us the UID it got (Moon: the username), and the bonus lands on your balance - automatically for Bybit, MEXC and BingX, after a quick check for Moon.';
if (h.indexOf(LEAD_OLD) >= 0) h = h.split(LEAD_OLD).join(LEAD_NEW);

if ((h.match(/id="bybitCard"/g) || []).length !== 1) throw new Error('the Bybit panel is not unique');
if (h.indexOf('id="bitgetCard"') >= 0) throw new Error('the Bitget panel survived');
if (h.indexOf('bitgetAmt') >= 0 || h.indexOf('data-v="bitget"') >= 0) throw new Error('a Bitget hook survived the swap');
console.log('fix-rewards-bybit-panel: tab, panel, hub list and the lead sentence');
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('  written: dist/rewards/index.html');
