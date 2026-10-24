#!/usr/bin/env node
/* BITGET ON THE SURFACES: the /rewards/ sign-up card, the payout method, and the ops review fold (2026-10-22).

   The worker half (build/add-bitget-affiliate.js) is what verifies and gates; this is what a member and the owner
   can actually see. Every one of these three places is ALREADY table-driven - the sign-up cards by `SIGNV`, the
   payout methods by `WD_METHODS`, the review desk by its own `SIGNV` - precisely because this feature set broke
   three times in one week when they were hand-copied per venue. So a venue is a line in each table, and the only
   hand-written things left are the card markup (it carries a logo and a sentence) and the payout note.

   ONE THING IS DELIBERATELY GENERALISED RATHER THAN COPIED: the withdraw pre-check. It was a `wdMethod==='mexc'`
   branch; a Bitget twin would have been a fourth copy of the same six lines, so it now reads the venue off the
   chosen method and asks that venue's own endpoint.

   Idempotent, --dry. Refuses rather than guessing.                                                             */
'use strict';
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'dist', 'rewards', 'index.html');
const OPS = path.join(__dirname, '..', 'src', 'ops', 'client', 'ops.js.txt');
const DRY = process.argv.indexOf('--dry') >= 0;
const done = [];

/* dist/rewards/index.html HAS MIXED LINE ENDINGS - it is CRLF, but blocks inserted by earlier patchers carry bare
   LF, and one of those blocks is exactly the withdraw branch this has to touch. So a marker built from the file's
   DOMINANT ending matches nothing in precisely the region that matters (the trap `build/fix-rekt-day.js` recorded
   word for word). `find` therefore tries BOTH endings and keeps whichever matches exactly once, and the
   replacement is written in the SAME ending as the anchor it replaced, so no region becomes internally mixed. */
function lf(s) { return String(s).split('\r\n').join('\n'); }
function crlf(s) { return lf(s).split('\n').join('\r\n'); }
function find(h, marker) {
  for (const m of [lf(marker), crlf(marker)]) {
    const n = h.split(m).length - 1;
    if (n === 1) return m;
    if (n > 1) throw new Error('marker appears ' + n + ' times: ' + JSON.stringify(m.slice(0, 60)));
  }
  return null;
}
function sameEol(sample, text) { return sample.indexOf('\r\n') >= 0 ? crlf(text) : lf(text); }

function patch(file, edits) {
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  for (const [name, a0, b0, skip] of edits) {
    if (skip && [].concat(skip).some(m => h.indexOf(lf(m)) >= 0 || h.indexOf(crlf(m)) >= 0)) continue;
    const a = find(h, a0);
    if (!a) throw new Error(name + ': anchor not found in either line ending -> ' + JSON.stringify(lf(a0).slice(0, 60)));
    h = h.split(a).join(sameEol(a, b0));   // split/join, never String.replace - a `$` in the replacement is a capture reference
    done.push(name);
  }
  return { h, changed: h !== before };
}

/* ---------------------------------------------------------------- the rewards page ----------------------- */
const V = { k: 'bitget', label: 'Bitget', col: '#00e7d8', logo: '/assets/ex/bitget.png' };

/* the card is the same shape the other two carry - the logo is a real 64px mark served by US, never a hotlink:
   a third-party CDN going dark would leave an empty box on the page that pays money */
const CARD_A = '  <div class="card" id="bingxCard" hidden>';
const CARD_PREV_END = '    <div id="bingxStatus" style="margin-top:8px"></div>\n  </div>';
const CARD = CARD_PREV_END + '\n'
  + '  <div class="card" id="bitgetCard" hidden>\n'
  + '    <div class="lbl" style="display:flex;align-items:center;gap:9px"><img src="' + V.logo + '" alt="" aria-hidden="true" width="22" height="22" style="width:22px;height:22px;border-radius:6px;display:block;flex:0 0 auto;background:' + V.col + '">Bitget sign-up bonus <span style="margin-left:auto;color:#c2f64a;font-weight:800;text-shadow:0 0 12px rgba(194,246,74,.65)">+$<span id="bitgetAmt">1</span></span></div>\n'
  + '    <p class="note" style="text-align:left;margin:10px 0 12px;line-height:1.55">Create a <b>Bitget</b> account through our link, then enter your Bitget UID below. We check it against Bitget’s own referral list and add <b style="color:#c2f64a">$<span id="bitgetAmt2">1</span></b> to your MarginPad balance. One bonus per account.</p>\n'
  + '    <a class="btn btn-lime" id="bitgetRefBtn" data-mpex="Bitget" href="#" target="_blank" rel="noopener sponsored" style="width:100%;display:block;text-align:center;text-decoration:none;margin-bottom:10px">1) Create your Bitget account</a>\n'
  + '    <div id="bitgetForm"><div class="addr-row"><input id="bitgetUser" type="text" placeholder="2) Your Bitget UID" autocomplete="off" spellcheck="false" /><button class="btn btn-ghost" id="bitgetSubmit" type="button">Submit</button></div></div>\n'
  + '    <div class="msg" id="bitgetMsg"></div>\n'
  + '    <div id="bitgetStatus" style="margin-top:8px"></div>\n'
  + '  </div>';

const p1 = patch(PAGE, [
  ['rewards: the Bitget sign-up card', CARD_PREV_END, CARD, 'id="bitgetCard"'],
  ['rewards: the card driver knows the venue',
    "var SIGNV = [{ k: 'mexc', label: 'MEXC' }, { k: 'bingx', label: 'BingX' }];",
    "var SIGNV = [{ k: 'mexc', label: 'MEXC' }, { k: 'bingx', label: 'BingX' }, { k: 'bitget', label: 'Bitget' }];",
    "{ k: 'bitget', label: 'Bitget' }];"],
  ['rewards: the gating loop knows the venue',
    "    ['mexc','bingx'].forEach(function(vk){",
    "    ['mexc','bingx','bitget'].forEach(function(vk){",
    "['mexc','bingx','bitget'].forEach"],
  ['rewards: the earn board totals Bitget too',
    "    var bingx=(j.bingxEnabled===false)?0:(j.bingxUsd!=null?+j.bingxUsd:1);\n"
    + "    set('eaWel',usd(wel)); set('eaOnce',usd(wel+moon+mexc+bingx));\n"
    + "    if(moon)set('eaMoon',usd(moon)); if(mexc)set('eaMexc',usd(mexc)); if(bingx)set('eaBingx',usd(bingx));",
    "    var bingx=(j.bingxEnabled===false)?0:(j.bingxUsd!=null?+j.bingxUsd:1);\n"
    + "    var bitget=(j.bitgetEnabled===false)?0:(j.bitgetUsd!=null?+j.bitgetUsd:1);\n"
    + "    set('eaWel',usd(wel)); set('eaOnce',usd(wel+moon+mexc+bingx+bitget));\n"
    + "    if(moon)set('eaMoon',usd(moon)); if(mexc)set('eaMexc',usd(mexc)); if(bingx)set('eaBingx',usd(bingx)); if(bitget)set('eaBitget',usd(bitget));",
    "set('eaBitget'"],
  ['rewards: the earn board names Bitget',
    '<b id="eaMoon">$1.00</b> for opening a Moon account through us, and <b id="eaMexc">$1.00</b> each for a MEXC or <b id="eaBingx">$1.00</b> a BingX one.',
    '<b id="eaMoon">$1.00</b> for opening a Moon account through us, and <b id="eaMexc">$1.00</b> each for a MEXC, <b id="eaBingx">$1.00</b> a BingX or <b id="eaBitget">$1.00</b> a Bitget one.',
    'id="eaBitget"'],
  ['rewards: the Bitget payout button',
    '<button type="button" id="wdmMexc" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:transparent;color:#c7ced6;font-weight:700;font-size:13px;cursor:pointer"><img src="/assets/ex/mexc.png" alt="" width="16" height="16" style="border-radius:4px">MEXC</button>',
    '<button type="button" id="wdmMexc" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:transparent;color:#c7ced6;font-weight:700;font-size:13px;cursor:pointer"><img src="/assets/ex/mexc.png" alt="" width="16" height="16" style="border-radius:4px">MEXC</button>\n'
    + '        <button type="button" id="wdmBitget" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:transparent;color:#c7ced6;font-weight:700;font-size:13px;cursor:pointer"><img src="/assets/ex/bitget.png" alt="" width="16" height="16" style="border-radius:4px">Bitget</button>',
    'id="wdmBitget"'],
  ['rewards: the Bitget payout note',
    '      <div class="lbl" style="margin:12px 0 6px">How much?</div>',
    '      <div class="note wd-note" id="wdNoteBitget" hidden style="--wdc:#00e7d8;--wdb:rgba(0,231,216,.42);--wdg:rgba(0,231,216,.08)">USDT is sent to your <b>Bitget</b> account by UID - the account must have been opened through our Bitget link. Your UID is the number in your Bitget account menu.\n'
    + '        <div class="wd-row"><a class="wd-go" data-mpex="Bitget" href="https://partner.bitget.com/bg/CUWBCM" target="_blank" rel="sponsored noopener noreferrer">Create your Bitget account &rarr;</a><a class="wd-alt" href="https://marginpad.io/rewards/#" onclick="return !(window.__mpOpenSupport&amp;&amp;window.__mpOpenSupport());">Already have one? Ask support</a></div></div>\n'
    + '      <div class="lbl" style="margin:12px 0 6px">How much?</div>',
    'id="wdNoteBitget"'],
  ['rewards: WD_METHODS carries Bitget',
    "    { k: 'mexc', btn: 'wdmMexc', note: 'wdNoteMexc', mode: 'numeric', re: /^[0-9]{5,15}$/, prefix: 'mexc:', ph: 'Your MEXC UID (numbers only)', bad: 'Enter your MEXC UID (numbers only).' }",
    "    { k: 'mexc', btn: 'wdmMexc', note: 'wdNoteMexc', mode: 'numeric', re: /^[0-9]{5,15}$/, prefix: 'mexc:', ph: 'Your MEXC UID (numbers only)', bad: 'Enter your MEXC UID (numbers only).' },\n"
    + "    /* `check` names the venue's own pre-check endpoint; a method without one simply submits, which is what\n"
    + "       keeps Bybit and Moon on exactly the path they were on. */\n"
    + "    { k: 'bitget', btn: 'wdmBitget', note: 'wdNoteBitget', mode: 'numeric', re: /^[0-9]{5,15}$/, prefix: 'bitget:', check: 'bitgetcheck', ph: 'Your Bitget UID (numbers only)', bad: 'Enter your Bitget UID (numbers only).' }",
    "k: 'bitget', btn: 'wdmBitget'"],
]);
let page = p1.h;

/* the MEXC pre-check branch becomes the one branch for every venue that has a pre-check */
const DW_A = "    if(wdMethod==='mexc'){\n"
  + "      wdConfirm.disabled=true; clearMsg();\n"
  + "      fetch('/api/reward/mexccheck?uid='+encodeURIComponent(a)).then(function(r){return r.json();}).then(function(j){\n"
  + "        wdConfirm.disabled=false;\n"
  + "        if(j&&j.gate&&j.listed===false){ wdAddr.classList.add('invalid');\n"
  + "          msg('We could not find this UID among the accounts opened through our MEXC link, so we cannot send a payout to it. Open a MEXC account through our link and use that UID, or switch the payout method to Moon. If you did sign up through our link, ask support and we will check - your balance is untouched.','err'); return; }\n"
  + "        wdSend('mexc:'+a);\n"
  + "      }).catch(function(){ wdConfirm.disabled=false; wdSend('mexc:'+a); });\n"
  + "      return;\n"
  + "    }";
const DW_B = "    /* ONE PRE-CHECK BRANCH FOR EVERY VENUE THAT HAS ONE (2026-10-22). This was written out for MEXC; Bitget\n"
  + "       would have been a fourth copy of the same six lines in a file that has already broken from exactly that.\n"
  + "       It FAILS OPEN in both directions - a network error still submits, because the server re-checks anyway and\n"
  + "       a member must never be stopped by our own outage. */\n"
  + "    var wdC=wdM();\n"
  + "    if(wdC.check){\n"
  + "      var wdLbl=wdC.k==='bitget'?'Bitget':'MEXC';\n"
  + "      wdConfirm.disabled=true; clearMsg();\n"
  + "      fetch('/api/reward/'+wdC.check+'?uid='+encodeURIComponent(a)).then(function(r){return r.json();}).then(function(j){\n"
  + "        wdConfirm.disabled=false;\n"
  + "        if(j&&j.gate&&j.listed===false){ wdAddr.classList.add('invalid');\n"
  + "          msg('We could not find this UID among the accounts opened through our '+wdLbl+' link, so we cannot send a payout to it. Open a '+wdLbl+' account through our link and use that UID, or switch the payout method to Moon. If you did sign up through our link, ask support and we will check - your balance is untouched.','err'); return; }\n"
  + "        wdSend(wdC.prefix+a);\n"
  + "      }).catch(function(){ wdConfirm.disabled=false; wdSend(wdC.prefix+a); });\n"
  + "      return;\n"
  + "    }";
if (page.indexOf('var wdC=wdM();') < 0) {
  const a = find(page, DW_A);
  if (!a) throw new Error('the MEXC withdraw branch is not where it was - refusing to guess');
  page = page.split(a).join(sameEol(a, DW_B));
  done.push('rewards: one pre-check branch for every venue that has one');
}
// the MEXC method needs its own `check` now that the branch is generic
if (page.indexOf("prefix: 'mexc:', check: 'mexccheck'") < 0) {
  const a = "prefix: 'mexc:', ph: 'Your MEXC UID (numbers only)'";
  const n = page.split(a).length - 1;
  if (n !== 1) throw new Error('the MEXC method entry appears ' + n + ' times, expected 1');
  page = page.split(a).join("prefix: 'mexc:', check: 'mexccheck', ph: 'Your MEXC UID (numbers only)'");
  done.push('rewards: the MEXC method names its own pre-check');
}

/* ---------------------------------------------------------------- the ops review desk -------------------- */
const p2 = patch(OPS, [
  ['ops: fetch the Bitget queue',
    "J('/api/reward/bingxsign/list').catch(function () { return {}; })]).then(function (r) {",
    "J('/api/reward/bingxsign/list').catch(function () { return {}; }), J('/api/reward/bitgetsign/list').catch(function () { return {}; })]).then(function (r) {",
    "J('/api/reward/bitgetsign/list')"],
  ['ops: bind it',
    'mexcQ = r[12] || {}, bingxQ = r[13] || {};',
    'mexcQ = r[12] || {}, bingxQ = r[13] || {}, bitgetQ = r[14] || {};',
    'bitgetQ = r[14]'],
  ['ops: one more fold, from the same table',
    "          { v: 'bingx', label: 'BingX', d: bingxQ, note: 'check the UID in the BingX affiliate dashboard before you approve' },",
    "          { v: 'bingx', label: 'BingX', d: bingxQ, note: 'check the UID in the BingX affiliate dashboard before you approve' },\n"
    + "          { v: 'bitget', label: 'Bitget', d: bitgetQ, note: 'the Bitget affiliate API answers this one - /api/admin/bitgetverify is a dry run that says which are real' },",
    "{ v: 'bitget', label: 'Bitget'"],
]);

/* ---------------------------------------------------------------- report --------------------------------- */
if (!done.length) { console.log('add-bitget-surfaces: nothing to do (already applied)'); process.exit(0); }

// structural guards
const o = (page.match(/<div/g) || []).length, c = (page.match(/<\/div>/g) || []).length;
const b0 = fs.readFileSync(PAGE, 'utf8');
const o0 = (b0.match(/<div/g) || []).length, c0 = (b0.match(/<\/div>/g) || []).length;
if (o - c !== o0 - c0) throw new Error('div balance changed: ' + (o - c) + ' vs ' + (o0 - c0));
for (const id of ['Card', 'Amt', 'Amt2', 'RefBtn', 'Form', 'User', 'Submit', 'Msg', 'Status']) {
  if ((page.match(new RegExp('id="bitget' + id + '"', 'g')) || []).length !== 1) throw new Error('bitget' + id + ' is not present exactly once');
}
if (page.indexOf('id="wdmBybit"') < 0 || page.indexOf('id="wdmMoon"') < 0 || page.indexOf('id="wdmMexc"') < 0) throw new Error('an existing payout method was lost');
if (page.indexOf("wdMethod==='moon'") < 0) throw new Error('the Moon withdraw branch was swallowed');
if ((p2.h.match(/SIGNV\.map\(signFold\)/g) || []).length !== 1) throw new Error('the ops venue loop is not rendered exactly once');
for (const v of ['moon', 'mexc', 'bingx', 'bitget', 'fomo']) {
  if (p2.h.indexOf("v: '" + v + "'") < 0) throw new Error('venue ' + v + ' missing from the ops desk');
}

console.log('add-bitget-surfaces: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
for (const [f, txt] of [[PAGE, page], [OPS, p2.h]]) {
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, txt);
  fs.renameSync(tmp, f);
}
console.log('  written: dist/rewards/index.html + src/ops/client/ops.js.txt');
console.log('  NEXT: node build/es/check-inline-js.js && node build/lint.js && npm run deploy');
