#!/usr/bin/env node
/* MEXC AS A PAYOUT METHOD (2026-10-22, owner: "ajde da uvedemo metod isplate takodje i mexc, da sve isto radi kao
   i bybit").

   The two existing methods were written twice over - a Bybit half and a Moon half, in the markup, in setWdMethod,
   in valid() and in the notes. Adding a third by copying a fourth time is how this feature set has already broken
   three times this week, so the page is driven by a WD_METHODS table here and a new venue is one entry.

   THE ADDRESS CARRIES ITS OWN METHOD. A bare number already means a Bybit UID, so a MEXC payout is stored as
   `mexc:<uid>` - the same shape Moon has used since it shipped (`moon:<name>`). Nothing downstream has to guess.

   THE GATE IS THE AFFILIATE API, AND IT FAILS OPEN. We pay a MEXC UID only if it opened under our link, which is
   the same rule Bybit's allowlist enforces - except ours is answered by MEXC itself rather than by a list the
   owner maintains by hand. But when MEXC cannot be reached, or the key has expired, the withdrawal goes THROUGH
   to the manual queue: money a member has already earned must never be trapped by our own API being down. The
   Bybit gate makes the same choice (an empty allowlist turns the gate off) and it is the right one - a false
   block costs a support ticket and a member's trust, while a false pass costs the owner one manual look.

   Idempotent, --dry. Refuses rather than guessing.                                                              */
'use strict';
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'dist', 'rewards', 'index.html');
const WORKER = path.join(__dirname, '..', 'src', 'worker.js');
const DRY = process.argv.indexOf('--dry') >= 0;
const done = [];

function patch(file, edits) {
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  for (const [name, a, b, skip] of edits) {
    if (skip && [].concat(skip).some(m => h.indexOf(m) >= 0)) continue;
    const n = h.split(a).length - 1;
    if (n !== 1) throw new Error(name + ': anchor appears ' + n + ' times, expected 1');
    h = h.split(a).join(b);
    done.push(name);
  }
  return { h, changed: h !== before };
}

/* ---------------- the page ---------------- */
const BTN_A = '<button type="button" id="wdmMoon" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:transparent;color:#c7ced6;font-weight:700;font-size:13px;cursor:pointer"><img src="/assets/moon.png" alt="" width="16" height="16" style="border-radius:4px;background:#fff;padding:1px">Moon</button>';
const BTN_B = BTN_A + '\n        <button type="button" id="wdmMexc" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:transparent;color:#c7ced6;font-weight:700;font-size:13px;cursor:pointer"><img src="/assets/ex/mexc.png" alt="" width="16" height="16" style="border-radius:4px">MEXC</button>';

const NOTE_A = '      <div class="lbl" style="margin:12px 0 6px">How much?</div>';
const NOTE_B = '      <div class="note wd-note" id="wdNoteMexc" hidden style="--wdc:#5b8cff;--wdb:rgba(91,140,255,.42);--wdg:rgba(91,140,255,.08)">USDT is sent to your <b>MEXC</b> account by UID - the account must have been opened through our MEXC link. Your UID is the number under your email in the MEXC account menu.\n'
  + '        <div class="wd-row"><a class="wd-go" data-mpex="MEXC" href="https://promote.mexc.com/a/ZBQaEXe8" target="_blank" rel="sponsored noopener noreferrer">Create your MEXC account &rarr;</a><a class="wd-alt" href="https://marginpad.io/rewards/#" onclick="return !(window.__mpOpenSupport&&window.__mpOpenSupport());">Already have one? Ask support</a></div></div>\n'
  + NOTE_A;

// setWdMethod rewritten as a table - the whole point of this patch
const SET_A_START = 'function setWdMethod(m){wdMethod=m;var bb=document.getElementById(\'wdmBybit\')';
const SET_A_END = "(function(){var bb=document.getElementById('wdmBybit'),mb=document.getElementById('wdmMoon');if(bb)bb.addEventListener('click',function(){setWdMethod('bybit');});if(mb)mb.addEventListener('click',function(){setWdMethod('moon');});})();";
const SET_B = `/* ONE TABLE, NOT ONE BRANCH PER VENUE (2026-10-22). Bybit and Moon were written out twice over here and in
     valid(); a third copy is how this breaks. A new payout venue is one entry below and nothing else. */
  var WD_METHODS = [
    { k: 'bybit', btn: 'wdmBybit', note: 'wdNoteBybit', mode: 'numeric', re: /^[0-9]{5,15}$/, ph: __esT_rewardsindex("yourBybitUidNumbers", 'Your Bybit UID (numbers only)'), bad: __esT_rewardsindex("enterYourBybitUid", 'Enter your Bybit UID (numbers only).') },
    { k: 'moon', btn: 'wdmMoon', note: 'wdNoteMoon', mode: 'text', re: /^[A-Za-z0-9_.-]{3,32}$/, prefix: 'moon:', lower: true, ph: __esT_rewardsindex("yourMoonUsername", 'Your Moon username'), bad: __esT_rewardsindex("enterYourMoonUsername", 'Enter your Moon username (3-32 letters/numbers).') },
    { k: 'mexc', btn: 'wdmMexc', note: 'wdNoteMexc', mode: 'numeric', re: /^[0-9]{5,15}$/, prefix: 'mexc:', ph: 'Your MEXC UID (numbers only)', bad: 'Enter your MEXC UID (numbers only).' }
  ];
  function wdM(k){ for (var i = 0; i < WD_METHODS.length; i++) if (WD_METHODS[i].k === (k || wdMethod)) return WD_METHODS[i]; return WD_METHODS[0]; }
  function setWdMethod(m){wdMethod=m;
    var on='flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 10px;border-radius:10px;border:1px solid rgba(194,246,74,.55);background:rgba(194,246,74,.10);color:#d6f78a;font-weight:700;font-size:13px;cursor:pointer';
    var off='flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:transparent;color:#c7ced6;font-weight:700;font-size:13px;cursor:pointer';
    WD_METHODS.forEach(function(x){ var b=document.getElementById(x.btn), n=document.getElementById(x.note);
      if(b)b.style.cssText=(m===x.k?on:off); if(n)n.hidden=(m!==x.k); });
    var cur=wdM(m);
    if(wdAddr){wdAddr.classList.remove('invalid');wdAddr.setAttribute('inputmode',cur.mode);wdAddr.placeholder=cur.ph;}
  }
  (function(){ WD_METHODS.forEach(function(x){ var b=document.getElementById(x.btn); if(b)b.addEventListener('click',function(){setWdMethod(x.k);}); }); })();`;

const VALID_A = "function valid(a){return wdMethod==='moon' ? /^[A-Za-z0-9_.-]{3,32}$/.test(a) : /^[0-9]{5,15}$/.test(a);}";
const VALID_B = "function valid(a){ var m=wdM(); return m.re.test(a); }";

const p1 = patch(PAGE, [
  ['rewards page: the MEXC method button', BTN_A, BTN_B, 'id="wdmMexc"'],
  ['rewards page: the MEXC payout note', NOTE_A, NOTE_B, 'id="wdNoteMexc"'],
  ['rewards page: valid() reads the table', VALID_A, VALID_B, 'function valid(a){ var m=wdM()'],
]);
let page = p1.h;

// the table replaces the whole setWdMethod + wiring span
if (page.indexOf('var WD_METHODS = [') < 0) {
  const a = page.indexOf(SET_A_START);
  if (a < 0) throw new Error('setWdMethod is not where it was - refusing to guess');
  const b = page.indexOf(SET_A_END, a);
  if (b < 0) throw new Error('the method wiring IIFE is not where it was - refusing to guess');
  page = page.slice(0, a) + SET_B + page.slice(b + SET_A_END.length);
  done.push('rewards page: setWdMethod driven by the table');
}

// doWithdraw: route mexc through its own pre-check, and prefix from the table
const DW_A = "    if(wdMethod==='moon'){a='moon:'+a.toLowerCase();wdSend(a);return;}";
const DW_B = `    if(wdMethod==='moon'){a='moon:'+a.toLowerCase();wdSend(a);return;}
    /* MEXC pre-check, the same reason Bybit has one (2026-08-16): a doomed withdrawal used to sit pending for days
       and end as a support ticket. Ours is answered by MEXC's own affiliate API, so it is a fact rather than a list.
       An unreachable API answers gate:false and the request goes through - never trap money a member has earned. */
    if(wdMethod==='mexc'){
      wdConfirm.disabled=true; clearMsg();
      fetch('/api/reward/mexccheck?uid='+encodeURIComponent(a)).then(function(r){return r.json();}).then(function(j){
        wdConfirm.disabled=false;
        if(j&&j.gate&&j.listed===false){ wdAddr.classList.add('invalid');
          msg('We could not find this UID among the accounts opened through our MEXC link, so we cannot send a payout to it. Open a MEXC account through our link and use that UID, or switch the payout method to Moon. If you did sign up through our link, ask support and we will check - your balance is untouched.','err'); return; }
        wdSend('mexc:'+a);
      }).catch(function(){ wdConfirm.disabled=false; wdSend('mexc:'+a); });
      return;
    }`;
const p2 = patch.call(null, PAGE, []);
if (page.indexOf("wdMethod==='mexc'") < 0) {
  const n = page.split(DW_A).length - 1;
  if (n !== 1) throw new Error('doWithdraw moon branch appears ' + n + ' times, expected 1');
  page = page.split(DW_A).join(DW_B);
  done.push('rewards page: the MEXC pre-check before submitting');
}

/* ---------------- the worker ---------------- */
const CHECK_A = "  if (path === '/uidcheck') {";
const CHECK_B = `  if (path === '/mexccheck') { // public MEXC-UID pre-check for the withdraw form - yes/no only, same contract as /uidcheck
    const u9 = String(url.searchParams.get('uid') || '').trim();
    if (!/^[0-9]{4,20}$/.test(u9)) return jr({ ok: false });
    const v9 = await mexcAffLookup(env, u9);
    // gate:false when we could not ASK (no key, 429, network) - a member must never be blocked by our own outage
    if (!v9.ok) return jr({ ok: true, gate: false, listed: true, why: v9.why });
    return jr({ ok: true, gate: true, listed: !!v9.found, why: v9.found ? 'ours' : v9.why });
  }
${CHECK_A}`;

const GATE_A = "  if (path === '/claim') {\n    if (!(await verifyTurnstile(env, b.token, ip))) return jr({ error: 'captcha' }, 403);";
const GATE_B = `  if (path === '/withdraw') { // MEXC gate: we pay a MEXC UID only if it opened under our link. Answered by MEXC's own
    // affiliate API rather than a hand-kept list - and it FAILS OPEN: an unreachable API or an expired key lets the
    // request through to the manual queue, because earned money must not be trapped by our outage.
    const mx = String((b && b.address) || '').trim();
    if (/^mexc:[0-9]{4,20}$/i.test(mx)) {
      const uidM = mx.split(':')[1];
      try {
        const vm = await mexcAffLookup(env, uidM);
        if (vm.ok && !vm.found) {
          try { await evPush(env, request, 'wdreject', 'MEXC UID ' + uidM + ' is not one of our referrals (blocked at request)', '/rewards/'); } catch (e) {}
          return jr({ error: 'uid_not_ours', message: 'This MEXC UID is not among the accounts that opened through MarginPad\\u2019s MEXC link, so we can\\u2019t send a payout to it. Open a MEXC account through our link and use that UID, or switch the payout method to Moon (just your Moon username). If you DID sign up through our link, contact support and we\\u2019ll check - your balance is untouched.' }, 403);
        }
      } catch (e) {} // never block on a throw
    }
  }
${GATE_A}`;

const p3 = patch(WORKER, [
  ['worker: the public /mexccheck pre-check', CHECK_A, CHECK_B, "path === '/mexccheck'"],
  ['worker: the MEXC payout gate on /withdraw', GATE_A, GATE_B, 'MEXC gate: we pay a MEXC UID only'],
]);

if (!done.length) { console.log('add-mexc-payout: nothing to do (already applied)'); process.exit(0); }

// guards
if ((page.match(/id="wdmMexc"/g) || []).length !== 1) throw new Error('the MEXC button is not present exactly once');
if ((page.match(/var WD_METHODS = \[/g) || []).length !== 1) throw new Error('the method table is not present exactly once');
if (page.indexOf("wdmBybit") < 0 || page.indexOf("wdmMoon") < 0) throw new Error('an existing method button was lost');
if (page.indexOf('function setWdMethod') < 0) throw new Error('setWdMethod vanished');
if (p3.h.indexOf("path === '/uidcheck'") < 0) throw new Error('the Bybit pre-check was swallowed');

console.log('add-mexc-payout: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
for (const [f, txt] of [[PAGE, page], [WORKER, p3.h]]) {
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, txt);
  fs.renameSync(tmp, f);
}
console.log('  written: dist/rewards/index.html + src/worker.js');
console.log('  NEXT: node build/es/check-inline-js.js && node build/lint.js && npm run deploy');
