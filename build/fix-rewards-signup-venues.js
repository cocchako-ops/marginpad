#!/usr/bin/env node
/* THE $1 SIGN-UP BONUS MOVES FROM FOMO TO MEXC AND BINGX (2026-10-21, owner: "Izbaci Fomo iz rewards taba i
   ubaci mexc i bingx ... Ne zelim da placamo vise fomo $1 vec da placamo bingx i mexc (ali ta ponuda samo da
   bude na rewards)").

   TWO THINGS THIS DOES NOT DO, both deliberate:
   - it does not touch the Fomo PARTNER link (the tile on the homepage, the card in the exchange grid). The
     owner retired the $1 bonus, not the partnership, and that link still earns commission.
   - it does not delete the Fomo review path in the worker. The day this shipped SEVEN people had a Fomo claim
     pending, five of them submitted in the previous 48 hours; they did the work and still need a decision.
     `SIGN_VENUES.fomo.open = false` refuses NEW claims and keeps the desk.

   AND IT WRITES ONE DRIVER, NOT TWO CARDS' WORTH OF COPIED CODE. Moon and Fomo were already two hand-copied
   ~4 KB blocks of the same msg/load/submit flow; adding MEXC and BingX by copying would have made four. The
   generic `signCard()` below is parameterised by venue, so the next one is a line in a table. */
'use strict';
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', 'dist', 'rewards', 'index.html');
const DRY = process.argv.indexOf('--dry') >= 0;

let h = fs.readFileSync(F, 'utf8');
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const before = h;
const done = [];

function cut(name, startMark, endMark, replacement) {
  const a = h.indexOf(startMark);
  // never fail silently: a start marker that does not match is the "it printed ok and changed nothing" trap
  if (a < 0) throw new Error(name + ': start marker not found -> ' + JSON.stringify(startMark.slice(0, 60)));
  const b = h.indexOf(endMark, a);
  if (b < 0) throw new Error(name + ': start found but end marker missing');
  h = h.slice(0, a) + replacement + h.slice(b);
  done.push(name);
  return true;
}
/* `skipIf` must match something only THIS edit writes - the trap the rekt patcher recorded twice: a guard
   that matches text the page already carries elsewhere skips the edit for ever. */
function one(name, a, b, skipIf) {
  if (skipIf && h.indexOf(skipIf) >= 0) return false;
  const n = h.split(a).length - 1;
  if (n !== 1) throw new Error(name + ': anchor appears ' + n + ' times, expected 1 (already applied?)');
  h = h.split(a).join(b);
  done.push(name);
  return true;
}

/* ---------------------------------------------------------------- the two cards ------------------------- */
const VENUES = [
  { k: 'mexc', label: 'MEXC', col: '#0057ff', logo: '/assets/ex/mexc.png' },
  { k: 'bingx', label: 'BingX', col: '#2b54fc', logo: '/assets/ex/bingx.png' },
];
/* The logo is a real 64px mark served by us, not a letter in a coloured square and not a hotlink: the owner
   asked for logos, and a third-party CDN that goes dark would leave an empty box on the page that pays money. */
function cardHtml(v) {
  return [
    '  <div class="card" id="' + v.k + 'Card" hidden>',
    '    <div class="lbl" style="display:flex;align-items:center;gap:9px"><img src="' + v.logo + '" alt="" aria-hidden="true" width="22" height="22" style="width:22px;height:22px;border-radius:6px;display:block;flex:0 0 auto;background:' + v.col + '">' + v.label + ' sign-up bonus <span style="margin-left:auto;color:#c2f64a;font-weight:800;text-shadow:0 0 12px rgba(194,246,74,.65)">+$<span id="' + v.k + 'Amt">1</span></span></div>',
    '    <p class="note" style="text-align:left;margin:10px 0 12px;line-height:1.55">Create a <b>' + v.label + '</b> account through our link, then enter your ' + v.label + ' UID below. After a quick manual check we add <b style="color:#c2f64a">$<span id="' + v.k + 'Amt2">1</span></b> to your MarginPad balance. One bonus per account.</p>',
    '    <a class="btn btn-lime" id="' + v.k + 'RefBtn" data-mpex="' + v.label + '" href="#" target="_blank" rel="noopener sponsored" style="width:100%;display:block;text-align:center;text-decoration:none;margin-bottom:10px">1) Create your ' + v.label + ' account</a>',
    '    <div id="' + v.k + 'Form"><div class="addr-row"><input id="' + v.k + 'User" type="text" placeholder="2) Your ' + v.label + ' UID" autocomplete="off" spellcheck="false" /><button class="btn btn-ghost" id="' + v.k + 'Submit" type="button">Submit</button></div></div>',
    '    <div class="msg" id="' + v.k + 'Msg"></div>',
    '    <div id="' + v.k + 'Status" style="margin-top:8px"></div>',
    '  </div>',
  ].join(N);
}
if (h.indexOf('id="fomoCard"') >= 0) {
  cut('cards: Fomo out, MEXC + BingX in',
    '  <div class="card" id="fomoCard" hidden>',
    '  <div class="card" id="promoCard" hidden>',
    VENUES.map(cardHtml).join(N) + N + N);
} else if (h.indexOf('id="mexcCard"') < 0) {
  throw new Error('neither the Fomo card nor the new cards are present - the page is not in a shape this knows');
}

/* ---------------------------------------------------------------- one driver for every venue ------------- */
const DRIVER = [
  "  /* THE SIGN-UP BONUS CARDS ARE ONE DRIVER (2026-10-21). Moon and Fomo were two hand-copied blocks of the",
  "     same msg/load/submit flow; MEXC and BingX would have made four. The venue is a parameter, the ref link",
  "     comes from window.mpEx so the page never holds a second copy of a partner URL, and the endpoint is",
  "     /api/reward/<venue>sign/* which forces the exchange SERVER-side. Moon keeps its own block above - it",
  "     carries the contest box and the board rules, which these do not. */",
  "  var SIGNV = [{ k: 'mexc', label: 'MEXC' }, { k: 'bingx', label: 'BingX' }];",
  "  function signCard(v) {",
  "    var card = document.getElementById(v.k + 'Card'); if (!card) return;",
  "    function msg(t, kind) { var el = document.getElementById(v.k + 'Msg'); if (!el) return; el.innerHTML = t; el.className = 'msg show ' + (kind || ''); }",
  "    /* the referral URL is mpEx's, resolved at CALL time - mp-auth is DEFERRED, so reading it at parse time",
  "       would leave the button pointing at '#' for the first tick (the rule this file already follows). */",
  "    (function wireRef() {",
  "      var a = document.getElementById(v.k + 'RefBtn'); if (!a) return;",
  "      if (!window.mpEx) { setTimeout(wireRef, 150); return; }",
  "      var u = window.mpEx.url(v.label); if (u) a.href = u;",
  "    })();",
  "    function load() {",
  "      var st = document.getElementById(v.k + 'Status'), form = document.getElementById(v.k + 'Form');",
  "      if (!st) return;",
  "      if (!signedIn) { st.innerHTML = ''; return; }",
  "      fetch('/api/reward/' + v.k + 'sign/mine').then(function (r) { return r.json(); }).then(function (d) {",
  "        var rows = (d && d.signups) || [];",
  "        if (!rows.length) { st.innerHTML = ''; if (form) form.style.display = ''; return; }",
  "        var x = rows[0], chip;",
  "        if (x.status === 'approved') chip = '<span style=\"display:inline-block;padding:5px 11px;border-radius:999px;border:1px solid rgba(194,246,74,.5);color:#c2f64a;font-size:12px;font-weight:700\">+$' + (+x.amount || 1).toFixed(2) + ' PAID</span>';",
  "        else if (x.status === 'rejected') chip = '<span style=\"display:inline-block;padding:5px 11px;border-radius:999px;border:1px solid rgba(255,98,88,.5);color:#ff8a80;font-size:12px;font-weight:700\">REJECTED</span>' + (x.note ? ' <span class=\"note\" style=\"font-size:12px\">' + String(x.note).replace(/</g, '&lt;') + '</span>' : '');",
  "        else chip = '<span style=\"display:inline-block;padding:5px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.22);color:#c9d2dc;font-size:12px;font-weight:700\">WAITING FOR REVIEW</span>';",
  "        st.innerHTML = chip;",
  "        /* a decided row still hides the form: one bonus per account, and an input that cannot succeed is worse",
  "           than no input. A REJECTED row keeps it open - the retry is the member's one way back. */",
  "        if (form) form.style.display = (x.status === 'rejected') ? '' : 'none';",
  "      }).catch(function () {});",
  "    }",
  "    var inp = document.getElementById(v.k + 'User'), sb = document.getElementById(v.k + 'Submit');",
  "    if (sb && inp) {",
  "      sb.addEventListener('click', function () {",
  "        var u = (inp.value || '').trim();",
  "        if (!u) { msg('Enter your ' + v.label + ' UID.', 'err'); return; }",
  "        sb.disabled = true; msg('Sending...', '');",
  "        fetch('/api/reward/' + v.k + 'sign/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid: u }) })",
  "          .then(function (r) { return r.json(); }).then(function (d) {",
  "            sb.disabled = false;",
  "            if (d && d.ok) { msg('Sent - we check it by hand and the $' + ((d.amount != null ? +d.amount : 1)).toFixed(2) + ' lands on your balance once approved.', 'ok'); inp.value = ''; load(); return; }",
  "            var e = (d && d.error) || '';",
  "            if (e === 'closed') msg((d && d.hint) || 'This bonus has ended.', 'err');",
  "            else if (e === 'uid_taken') msg('That ' + v.label + ' UID has already been claimed by another account.', 'err');",
  "            else if (e === 'already_submitted' || e === 'limit_reached') msg('You already submitted a ' + v.label + ' sign-up with this account.', 'err');",
  "            else if (e === 'bad_uid') msg('That does not look like a ' + v.label + ' UID.', 'err');",
  "            else if (e === 'need_xp') msg('Reach Bronze (500 XP) first - the whole rewards area opens there.', 'err');",
  "            else if (e === 'signin_required') msg('Sign in first (top of the page).', 'err');",
  "            else msg('Could not submit right now - try again in a minute.', 'err');",
  "          }).catch(function () { sb.disabled = false; msg('Network error - try again.', 'err'); });",
  "      });",
  "      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') sb.click(); });",
  "    }",
  "    card.__signLoad = load;",
  "    load();",
  "  }",
  "  SIGNV.forEach(signCard);",
  "",
].join(N);

if (h.indexOf('/* Fomo $1 sign-up bonus') >= 0) {
  cut('driver: one signCard() replaces the copied Fomo block',
    '  /* Fomo $1 sign-up bonus', '  function prMsgF(', DRIVER);
}

/* ---------------------------------------------------------------- gating + pricing, venue-driven -------- */
/* The card is members-only and is hidden outright when the venue is paused in ops - the same two conditions
   the Moon card has carried since 2026-08-03. One loop instead of a block per venue. */
one('card gating reads the venue list',
  [
    "    window.__fomoOff=(j.fomoEnabled===false);",
    "    var fc=document.getElementById('fomoCard');",
    "    if(fc)fc.hidden=window.__fomoOff||!signedIn; // members-only, same gating as the Moon card",
  ].join(N),
  [
    "    /* MEXC + BingX (2026-10-21): members-only and hidden when paused in ops, exactly as the Moon card is.",
    "       Fomo's $1 was retired the same day - its card is gone, and the server refuses a new claim with 410. */",
    "    ['mexc','bingx'].forEach(function(vk){",
    "      var off=(j[vk+'Enabled']===false); window['__'+vk+'Off']=off;",
    "      var el=document.getElementById(vk+'Card'); if(el)el.hidden=off||!signedIn;",
    "      var u=j[vk+'Usd'];",
    "      if(u!=null){var s1=document.getElementById(vk+'Amt'),s2=document.getElementById(vk+'Amt2'),sv=fmtShort(u);",
    "        if(s1)s1.textContent=sv; if(s2)s2.textContent=sv;}",
    "    });",
  ].join(N), "['mexc','bingx'].forEach(function(vk){");

one('the old Fomo amount writer goes with it',
  "    if(j.fomoUsd!=null){var f1=document.getElementById('fomoAmt'),f2=document.getElementById('fomoAmt2');var fv=fmtShort(j.fomoUsd);if(f1)f1.textContent=fv;if(f2)f2.textContent=fv;}" + N,
  '', null);
if (/fomoAmt2/.test(h)) throw new Error('the Fomo amount writer survived');

/* the "once when you start" total must count what is actually on offer, or the board overstates it */
one('earn board totals the live venues',
  [
    "    var fomo=(j.fomoEnabled===false)?0:(j.fomoUsd!=null?+j.fomoUsd:1);",
    "    set('eaWel',usd(wel)); set('eaOnce',usd(wel+moon+fomo));",
    "    if(moon)set('eaMoon',usd(moon)); if(fomo)set('eaFomo',usd(fomo));",
  ].join(N),
  [
    "    var mexc=(j.mexcEnabled===false)?0:(j.mexcUsd!=null?+j.mexcUsd:1);",
    "    var bingx=(j.bingxEnabled===false)?0:(j.bingxUsd!=null?+j.bingxUsd:1);",
    "    set('eaWel',usd(wel)); set('eaOnce',usd(wel+moon+mexc+bingx));",
    "    if(moon)set('eaMoon',usd(moon)); if(mexc)set('eaMexc',usd(mexc)); if(bingx)set('eaBingx',usd(bingx));",
  ].join(N), "set('eaMexc'");

/* ---------------------------------------------------------------- the earn board states what is paid ---- */
one('earn board names the two venues',
  '<b id="eaMoon">$1.00</b> for opening a Moon account through us and <b id="eaFomo">$1.00</b> for a Fomo one.',
  '<b id="eaMoon">$1.00</b> for opening a Moon account through us, and <b id="eaMexc">$1.00</b> each for a MEXC or <b id="eaBingx">$1.00</b> a BingX one.',
  'id="eaMexc"');

/* ---------------------------------------------------------------- report -------------------------------- */
if (!done.length) { console.log('fix-rewards-signup-venues: nothing to do (already applied)'); process.exit(0); }

// structural guard: the card wrappers must still balance, and no Fomo card may survive
const o = (h.match(/<div/g) || []).length, c = (h.match(/<\/div>/g) || []).length;
const o0 = (before.match(/<div/g) || []).length, c0 = (before.match(/<\/div>/g) || []).length;
if (o - c !== o0 - c0) throw new Error('div balance changed: ' + (o - c) + ' vs ' + (o0 - c0));
if (/id="fomoCard"/.test(h)) throw new Error('the Fomo card is still present');
for (const v of VENUES) {
  for (const id of ['Card', 'Amt', 'Amt2', 'RefBtn', 'Form', 'User', 'Submit', 'Msg', 'Status']) {
    if (h.indexOf('id="' + v.k + id + '"') < 0) throw new Error('missing element: ' + v.k + id);
  }
}
if (/\bfomoMsg\s*\(/.test(h)) throw new Error('Fomo JS survived the cut');

console.log('fix-rewards-signup-venues: ' + done.length + ' edits -> ' + done.join(', '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F, h);
console.log('  written: dist/rewards/index.html (' + (h.length - before.length > 0 ? '+' : '') + (h.length - before.length) + ' bytes)');
