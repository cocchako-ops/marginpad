#!/usr/bin/env node
/* KEYBOARD DIAGNOSTIC v2 + THE WEBKIT REMEDY (2026-10-22, after the owner's first reading).

   WHAT THE FIRST READING SAID, three taps on the installed app, iOS 18.7, the homepage chat:
     sa:1 f:1 kb:0 efp:input#ctInput ae:input#ctInput p:0/-/0/-/0/0/0 fb:1 vv:852/852 ro:00
   The field is under the finger, nothing covers it, nothing cancelled any event, the field IS focused, and the
   keyboard did not come. Every earlier hypothesis is now ruled out by measurement rather than by argument.

   WHAT IT COULD NOT SAY: WHO focused the field. iOS raises the keyboard only for a focus that is the default
   action of the tap; a focus() called from script - even one millisecond later - gives the caret and no
   keyboard, and then every further tap lands on an already-focused field and changes nothing. `fb:1` only says
   focusin fired after touchend. So v2 wraps HTMLInputElement.prototype.focus for the composer and records the
   calling frame (`pf:<ms after touchend> <file:line>`), plus the tap's duration, isTrusted, document.hasFocus()
   and visibilityState. One measuring bug fixed: pointerdown fires BEFORE touchstart and the reset on touchstart
   wiped it, which is why it read as '-'.

   AND THE REMEDY THAT COSTS NOTHING: `-webkit-user-select: text` on the composer fields themselves. It is the
   documented WebKit answer to "focused, no keyboard" in several shapes of this bug, it is the field's natural
   value anyway, and if the next reading comes back kb:1 that is the finding. Three copies (the chat exists
   twice; the DM composer is mp-auth's own stylesheet).

   Idempotent, --dry.                                                                                         */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const R = f => path.join(__dirname, '..', 'dist', 'assets', f);
const done = [];

/* ---------------------------------------------------------------- the remedy --------------------------- */
const RULE = '#chatBox input,#chatBox textarea,.mpa-dm-form input,.mpa-dm-form textarea{-webkit-user-select:text!important;user-select:text!important;-webkit-touch-callout:default}';
for (const f of ['home.css', 'mp-trade.css']) {
  let h = fs.readFileSync(R(f), 'utf8');
  if (h.indexOf('-webkit-user-select:text!important;user-select:text!important;-webkit-touch-callout:default') < 0) {
    h += '\n/* KEYBOARD ON iOS (2026-10-22): the documented WebKit remedy for a field that focuses and raises no keyboard - see build/add-keyboard-diag2.js */\n' + RULE + '\n';
    if (!DRY) fs.writeFileSync(R(f), h);
    done.push(f + ': the composer fields are explicitly selectable text');
  }
}
{
  const F = R('mp-auth.js');
  let h = fs.readFileSync(F, 'utf8');
  const A = "    + '.mpa-dbub{-webkit-user-select:none;-moz-user-select:none;user-select:none;-webkit-touch-callout:none}';";
  const B = A + "\n  css += '" + RULE + "'; // KEYBOARD ON iOS (2026-10-22) - see build/add-keyboard-diag2.js";
  if (h.indexOf('-webkit-touch-callout:default}') < 0) {
    const n = h.split(A).length - 1; if (n !== 1) throw new Error('mp-auth: the DM bubble rule appears ' + n + ' times');
    h = h.split(A).join(B);
    if (!DRY) fs.writeFileSync(F, h);
    done.push('mp-auth: the DM composer gets the same rule');
  }
}

/* ---------------------------------------------------------------- the diagnostic, v2 ------------------- */
{
  const F = R('mp-auth.js');
  let h = fs.readFileSync(F, 'utf8');
  const MARK = 'KEYBOARD DIAGNOSTIC (2026-10-22)';
  const i = h.indexOf('/* ' + MARK);
  if (i < 0) throw new Error('mp-auth: the v1 diagnostic is not there to replace');
  if (h.indexOf('KEYBOARD DIAGNOSTIC v2') < 0) {
    const V2 = [
      '/* KEYBOARD DIAGNOSTIC v2 (2026-10-22) - see build/add-keyboard-diag2.js. The first reading proved the field is under the',
      '   finger, focused, unblocked, and keyboard-less. v2 answers the question that leaves open: WHO focused it. A focus() from',
      '   script gives iOS the caret and no keyboard, so every programmatic focus on a composer is recorded with its frame. */',
      '(function () {',
      '  if (window.__mpKbDiag) return; window.__mpKbDiag = 2;',
      "  var SEL = '#chatBox input,#chatBox textarea,.mpa-dm-form input,.mpa-dm-form textarea';",
      '  function isComposer(t) { try { return !!(t && t.closest && t.closest(SEL)); } catch (e) { return false; } }',
      '  function nm(el) { if (!el) return "none"; var c = (el.className && typeof el.className === "string") ? el.className.split(/\\s+/)[0] : ""; return (el.tagName || "?").toLowerCase() + (el.id ? "#" + el.id : "") + (c ? "." + c : ""); }',
      '  // every programmatic focus() on a composer, with the frame that called it',
      '  var pfAt = 0, pfFrame = "";',
      '  try {',
      '    [HTMLInputElement, HTMLTextAreaElement].forEach(function (C) {',
      '      var orig = C.prototype.focus;',
      '      C.prototype.focus = function () {',
      '        if (isComposer(this)) { pfAt = Date.now(); try { var st = String(new Error().stack || "").split("\\n").filter(function (l) { return /\\/assets\\/|\\.html/.test(l); })[1] || ""; pfFrame = (st.match(/([a-z0-9-]+\\.(?:js|html))[^:]*:(\\d+)/i) || []).slice(1, 3).join(":"); } catch (e) { pfFrame = "?"; } }',
      '        return orig.apply(this, arguments);',
      '      };',
      '    });',
      '  } catch (e) {}',
      "  var EV = ['pointerdown', 'touchstart', 'touchmove', 'touchend', 'pointerup', 'mousedown', 'click'], pd = {}, sent = 0, focusAt = 0, blurAt = 0, tsAt = 0, trusted = '';",
      '  // bubble phase on document runs LAST, so defaultPrevented here reflects every other handler; pointerdown is the FIRST',
      '  // event of a tap on iOS, so it is where the record resets (v1 reset on touchstart and wiped it)',
      "  EV.forEach(function (n) { document.addEventListener(n, function (e) { if (!isComposer(e.target)) return; if (n === 'pointerdown') { pd = {}; tsAt = Date.now(); pfAt = 0; pfFrame = ''; } if (n === 'touchstart' && !tsAt) { pd = {}; tsAt = Date.now(); } pd[n] = ((pd[n] || '') + (e.defaultPrevented ? '1' : '0')).slice(0, 3); if (n === 'touchend') trusted = e.isTrusted ? '1' : '0'; }, false); });",
      "  document.addEventListener('focusin', function (e) { if (isComposer(e.target)) focusAt = Date.now(); }, true);",
      "  document.addEventListener('focusout', function (e) { if (isComposer(e.target)) blurAt = Date.now(); }, true);",
      "  var IOS = /iPhone|iPad|iPod/.test(navigator.userAgent);",
      "  document.addEventListener('touchend', function (e) {",
      '    var t = e.target; if (!isComposer(t) || sent >= 3) return;',
      '    var x = 0, y = 0; try { var c = e.changedTouches[0]; x = c.clientX; y = c.clientY; } catch (err) {}',
      '    var vv0 = (window.visualViewport && window.visualViewport.height) || window.innerHeight, t0 = Date.now(), wasFocused = (document.activeElement === t);',
      '    setTimeout(function () {',
      '      var ae = document.activeElement, okf = (ae === t);',
      '      var vv1 = (window.visualViewport && window.visualViewport.height) || window.innerHeight, kb = vv1 < vv0 - 80;',
      '      if (okf && (kb || !IOS)) return;',
      '      var efp = null; try { efp = document.elementFromPoint(x, y); } catch (err) {}',
      "      var sa = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));",
      "      var ios = (navigator.userAgent.match(/OS (\\d+_\\d+)/) || [])[1] || '';",
      "      var lbl = 'kbfail2 sa:' + (sa ? 1 : 0) + ' f:' + (okf ? 1 : 0) + ' kb:' + (kb ? 1 : 0) + ' pre:' + (wasFocused ? 1 : 0)",
      "        + ' pf:' + (pfAt && pfAt >= tsAt ? (pfAt - t0) + (pfFrame ? '@' + pfFrame : '') : 0)",
      "        + ' fb:' + (focusAt >= t0 ? 1 : 0) + ((blurAt > focusAt && blurAt >= t0) ? 'b' : '')",
      "        + ' p:' + EV.map(function (n) { return pd[n] || '-'; }).join('/') + ' tr:' + trusted + ' dur:' + (tsAt ? (t0 - tsAt) : '-')",
      "        + ' hf:' + (document.hasFocus() ? 1 : 0) + ' vis:' + String(document.visibilityState).charAt(0) + ' efp:' + nm(efp) + ' ae:' + nm(ae) + ' vv:' + Math.round(vv0) + '/' + Math.round(vv1) + ' ios:' + ios;",
      "      lbl = lbl.replace(/[^a-zA-Z0-9 #:._/@-]/g, ' ').replace(/\\s+/g, ' ').slice(0, 110);",
      '      sent++;',
      "      try { var u = '/api/track?t=jserr&e=' + encodeURIComponent(lbl) + '&p=' + encodeURIComponent(location.pathname); if (navigator.sendBeacon) navigator.sendBeacon(u); else (new Image()).src = u; } catch (err) {}",
      "      try { if (window.mpToast) window.mpToast({ msg: 'Keyboard check 2 recorded: ' + (okf ? 'focused' : 'no focus') + (kb ? ', keyboard up' : ', no keyboard'), kind: 'info', ms: 5000, key: 'kbdiag' }); } catch (err) {}",
      '    }, 600);',
      '  }, false);',
      '})();',
      '',
    ].join('\n');
    h = h.slice(0, i) + V2;
    if (!DRY) fs.writeFileSync(F, h);
    done.push('mp-auth: the diagnostic is v2 (who focused it, pointerdown first, isTrusted, duration)');
  }
}

if (!done.length) { console.log('add-keyboard-diag2: nothing to do'); process.exit(0); }
if (!DRY) {
  const a = fs.readFileSync(R('mp-auth.js'), 'utf8');
  if ((a.match(/KEYBOARD DIAGNOSTIC v2/g) || []).length !== 1) throw new Error('v2 not present exactly once');
  if (a.indexOf('KEYBOARD DIAGNOSTIC (2026-10-22) - see build/add-keyboard-diag.js') >= 0) throw new Error('v1 survived');
  if (a.indexOf('if (okf && (kb || !IOS)) return;') < 0) throw new Error('the silence rule is gone');
  if (a.indexOf('-webkit-touch-callout:default') < 0) throw new Error('the DM remedy did not land');
}
console.log('add-keyboard-diag2: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
console.log('  NEXT: node build/bump-home-assets.js && npm run deploy');
