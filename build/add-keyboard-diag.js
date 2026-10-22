#!/usr/bin/env node
/* TWO THINGS FROM THE OWNER'S PHOTO OF THE HOME-SCREEN APP (2026-10-22 22:50).

   1. THE COOKIE BAR SAT UNDER THE iOS STATUS BAR. The app shell asks for a black-translucent status bar, which
      means the page's first pixel is under the clock and the signal icons - every fixed/sticky thing on the site
      already pads itself by env(safe-area-inset-top) for exactly that reason (the header, the Browse drawer, the
      chart bar). The cookie bar is inserted as body's FIRST child and padded 7px flat, so in the installed app
      it is the one thing drawn under the clock. In a Safari tab the inset is zero and nothing changes.

   2. THE KEYBOARD STILL DOES NOT COME UP, after two fixes that each removed a real cause (an autofocus that
      poisoned the next tap, a touchmove the containment layer cancelled). There is no WebKit on this machine and
      iOS cannot be emulated, so the next step is not a third guess - it is a MEASUREMENT taken on the owner's
      own phone. When a tap on the chat or DM composer does not end with the field focused and the keyboard open,
      this records, in one line, everything that decides it: whether the page is the installed app, what element
      was really under the finger, what ended up focused, whether any handler called preventDefault on any of the
      seven events of a tap (a document-level bubble listener runs LAST, so defaultPrevented there reflects every
      other handler), whether focus arrived and was then taken away, whether the visual viewport shrank (the
      keyboard did open), and the iOS version. It rides the crash beacon, which the ops desk already reads.

      It never fires where things work: on iOS "focused AND keyboard" is silence, and off iOS a focused field is
      silence too (headless Chrome never has a keyboard, and the E2E taps this field - a row there would be the
      test polluting the owner's read, the rule this repo has carried since 2026-09-06). At most two rows a page.

   Idempotent, --dry. Refuses rather than guessing.                                                            */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const R = f => path.join(__dirname, '..', 'dist', 'assets', f);
const done = [];

/* ---------------------------------------------------------------- 1. the cookie bar -------------------- */
{
  const F = R('mp-nav.js');
  let h = fs.readFileSync(F, 'utf8');
  const A = "border-bottom:1px solid #2b323b;padding:7px 12px;font-family:Familjen Grotesk";
  const B = "border-bottom:1px solid #2b323b;padding:calc(7px + env(safe-area-inset-top)) 12px 7px;font-family:Familjen Grotesk";
  if (h.indexOf(B) < 0) {
    const n = h.split(A).length - 1; if (n !== 1) throw new Error('mp-nav: cookie bar style appears ' + n + ' times');
    h = h.split(A).join(B);
    h = h.split("// one slim line (2026-09-07 UX pass)").join("// one slim line (2026-09-07 UX pass); padded by the safe-area inset since 2026-10-22 - the installed app draws under the iOS status bar and this is body's FIRST child, so it was the one thing under the clock");
    if (!DRY) fs.writeFileSync(F, h);
    done.push('mp-nav: the cookie bar clears the iOS status bar in the installed app');
  }
}

/* ---------------------------------------------------------------- 2. the keyboard diagnostic ----------- */
{
  const F = R('mp-auth.js');
  let h = fs.readFileSync(F, 'utf8');
  const MARK = 'KEYBOARD DIAGNOSTIC (2026-10-22)';
  if (h.indexOf(MARK) < 0) {
    const BLOCK = [
      '',
      '/* ' + MARK + ' - see build/add-keyboard-diag.js. When a tap on the chat or DM composer does not end with the',
      '   field focused and the keyboard open, ONE line with everything that decides it goes out on the crash beacon,',
      '   so the next fix is a measurement from the owner\'s own phone rather than a third guess. Silent wherever',
      '   things work, silent off iOS when the field focused (headless Chrome never has a keyboard, and the E2E taps',
      '   this field), at most two rows a page. */',
      '(function () {',
      '  if (window.__mpKbDiag) return; window.__mpKbDiag = 1;',
      "  var SEL = '#chatBox input,#chatBox textarea,.mpa-dm-form input,.mpa-dm-form textarea';",
      '  function isComposer(t) { try { return !!(t && t.closest && t.closest(SEL)); } catch (e) { return false; } }',
      '  function nm(el) { if (!el) return "none"; var c = (el.className && typeof el.className === "string") ? el.className.split(/\\s+/)[0] : ""; return (el.tagName || "?").toLowerCase() + (el.id ? "#" + el.id : "") + (c ? "." + c : ""); }',
      "  var EV = ['touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointerup', 'mousedown', 'click'], pd = {}, sent = 0, focusAt = 0, blurAt = 0;",
      '  // bubble phase on document runs LAST, so defaultPrevented here reflects every other handler on the page',
      "  EV.forEach(function (n) { document.addEventListener(n, function (e) { if (!isComposer(e.target)) return; if (n === 'touchstart') pd = {}; pd[n] = ((pd[n] || '') + (e.defaultPrevented ? '1' : '0')).slice(0, 3); }, false); });",
      "  document.addEventListener('focusin', function (e) { if (isComposer(e.target)) focusAt = Date.now(); }, true);",
      "  document.addEventListener('focusout', function (e) { if (isComposer(e.target)) blurAt = Date.now(); }, true);",
      "  var IOS = /iPhone|iPad|iPod/.test(navigator.userAgent);",
      "  document.addEventListener('touchend', function (e) {",
      '    var t = e.target; if (!isComposer(t) || sent >= 2) return;',
      '    var x = 0, y = 0; try { var c = e.changedTouches[0]; x = c.clientX; y = c.clientY; } catch (err) {}',
      '    var vv0 = (window.visualViewport && window.visualViewport.height) || window.innerHeight, t0 = Date.now();',
      '    setTimeout(function () {',
      '      var ae = document.activeElement, okf = (ae === t);',
      '      var vv1 = (window.visualViewport && window.visualViewport.height) || window.innerHeight, kb = vv1 < vv0 - 80;',
      '      if (okf && (kb || !IOS)) return;                       // it worked - say nothing',
      '      var efp = null; try { efp = document.elementFromPoint(x, y); } catch (err) {}',
      "      var sa = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));",
      "      var ios = (navigator.userAgent.match(/OS (\\d+_\\d+)/) || [])[1] || '';",
      "      var lbl = 'kbfail sa:' + (sa ? 1 : 0) + ' f:' + (okf ? 1 : 0) + ' kb:' + (kb ? 1 : 0) + ' efp:' + nm(efp) + ' ae:' + nm(ae)",
      "        + ' p:' + EV.map(function (n) { return pd[n] || '-'; }).join('/') + ' fb:' + (focusAt >= t0 ? 1 : 0) + ((blurAt > focusAt && blurAt >= t0) ? 'b' : '')",
      "        + ' vv:' + Math.round(vv0) + '/' + Math.round(vv1) + ' ro:' + (t.readOnly ? 1 : 0) + (t.disabled ? 1 : 0) + ' ios:' + ios;",
      "      lbl = lbl.replace(/[^a-zA-Z0-9 #:._/-]/g, ' ').replace(/\\s+/g, ' ').slice(0, 110);",
      '      sent++;',
      "      try { var u = '/api/track?t=jserr&e=' + encodeURIComponent(lbl) + '&p=' + encodeURIComponent(location.pathname); if (navigator.sendBeacon) navigator.sendBeacon(u); else (new Image()).src = u; } catch (err) {}",
      "      try { if (window.mpToast) window.mpToast({ msg: 'Keyboard check recorded: ' + (okf ? 'focused' : 'no focus') + (kb ? ', keyboard up' : ', no keyboard'), kind: 'info', ms: 5000, key: 'kbdiag' }); } catch (err) {}",
      '    }, 600);',
      '  }, false);',
      '})();',
      '',
    ].join('\n');
    h = h + BLOCK;
    if (!DRY) fs.writeFileSync(F, h);
    done.push('mp-auth: the keyboard diagnostic beacon');
  }
}

if (!done.length) { console.log('add-keyboard-diag: nothing to do (already applied)'); process.exit(0); }
if (!DRY) {
  const a = fs.readFileSync(R('mp-auth.js'), 'utf8');
  if ((a.match(/KEYBOARD DIAGNOSTIC \(2026-10-22\)/g) || []).length !== 1) throw new Error('the diagnostic is not present exactly once');
  if (a.indexOf('if (okf && (kb || !IOS)) return;') < 0) throw new Error('the diagnostic would fire on a working field off iOS - that is the E2E polluting the owner\'s read');
  const n = fs.readFileSync(R('mp-nav.js'), 'utf8');
  if (n.indexOf('padding:calc(7px + env(safe-area-inset-top)) 12px 7px') < 0) throw new Error('the cookie bar padding did not land');
}
console.log('add-keyboard-diag: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
console.log('  NEXT: node build/bump-home-assets.js && npm run deploy, then read /api/admin/activity for kbfail rows after the owner taps');
