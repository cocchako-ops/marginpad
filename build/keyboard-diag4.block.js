/* KEYBOARD DIAGNOSTIC v4 (2026-10-24) - see build/add-keyboard-diag4.js. WHAT THE RING SAID BEFORE THIS: on the owner's
   installed app (iOS 18.7) every composer tap arrives trusted, nothing cancels it, the field gets DOM focus from the tap
   itself, and still no keyboard - with document.hasFocus() FALSE, and window.focus() changing nothing (wf:0). On ANOTHER
   member's installed app on the SAME iOS 18.7 the first tap raised the keyboard with hasFocus() TRUE (kbok2 hf:1 wf:h).
   So it is not the iOS version; it is something about that one instance, and there is no WebKit on this machine to
   stage it. The phone is the lab: a tap that fails is followed by a tap that tries ONE remedy, each tap the next one,
   and every row says which remedy ran (r:) and whether the keyboard came. The moment one works it is kept for the page.
     r:0  nothing (the true baseline - v3's window.focus() is gone, it never changed anything)
     r:1  focus() on the field INSIDE the trusted touchend (WebKit's elementDidRefocus path when already focused)
     r:2  blur(), focus(), click() inside the gesture
     r:3  a bare <input> on <body> focused inside the gesture (a GHOST): if the keyboard comes for IT, the instance can
          raise a keyboard and the fault is the composer's context; focus is then moved onto the real field
     r:4  inputmode=text + focus() + setSelectionRange at the end
     r:5  window.focus() + body.focus() + focus()
   Also ONE row per page for the first NON-composer field focused in the installed app (kbany) - whether any field at
   all gets a keyboard there was never measured, and it decides between "the instance" and "the chat box".
   Quiet when it works (except ONE kbok3 per success in a standalone iOS app, so a remedy's success is on record), quiet
   off iOS when the field is focused (headless Chrome never has a keyboard, and every E2E types into that field). */
(function () {
  if (window.__mpKbDiag) return; window.__mpKbDiag = 4;
  var SEL = '#chatBox input,#chatBox textarea,.mpa-dm-form input,.mpa-dm-form textarea';
  var IOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  var SA = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  var IOSV = (navigator.userAgent.match(/OS (\d+_\d+)/) || [])[1] || '';
  var VER = (function () { try { var s = document.querySelector('script[src*="mp-auth.js?v="]'); return s ? String(s.getAttribute('src').split('v=')[1] || '').slice(0, 4) : '-'; } catch (e) { return '-'; } })();
  function isComposer(t) { try { return !!(t && t.closest && t.closest(SEL)); } catch (e) { return false; } }
  function nm(el) { if (!el) return 'none'; var c = (el.className && typeof el.className === 'string') ? el.className.split(/\s+/)[0] : ''; return (el.tagName || '?').toLowerCase() + (el.id ? '#' + el.id : '') + (c ? '.' + c : ''); }
  function vvh() { return (window.visualViewport && window.visualViewport.height) || window.innerHeight; }
  function hf() { try { return document.hasFocus() ? 1 : 0; } catch (e) { return '?'; } }
  var sent = 0;
  function send(lbl) {
    if (sent >= 12) return; sent++;
    lbl = String(lbl).replace(/[^a-zA-Z0-9 #:._/-]/g, ' ').replace(/\s+/g, ' ').slice(0, 110);
    try { var u = '/api/track?t=jserr&e=' + encodeURIComponent(lbl) + '&p=' + encodeURIComponent(location.pathname); if (navigator.sendBeacon) navigator.sendBeacon(u); else (new Image()).src = u; } catch (err) {}
  }
  function toast(msg) { try { if (window.mpToast) window.mpToast({ msg: msg, kind: 'info', ms: 5000, key: 'kbdiag' }); } catch (e) {} }
  window.__mpKbRows = []; // E2E mirror of every label sent
  var send0 = send; send = function (l) { try { window.__mpKbRows.push(String(l).slice(0, 110)); } catch (e) {} send0(l); };

  // what every event of a tap on the composer saw (bubble phase on document runs LAST, so defaultPrevented here
  // reflects every other handler); pointerdown is the first event of a tap on iOS, so the record resets there
  var EV = ['pointerdown', 'touchstart', 'touchmove', 'touchend', 'pointerup', 'mousedown', 'click'], pd = {}, tsAt = 0, a0 = '', focusAt = 0, blurAt = 0;
  EV.forEach(function (n) { document.addEventListener(n, function (e) { if (!isComposer(e.target)) return; if (n === 'pointerdown' || (n === 'touchstart' && !tsAt)) { pd = {}; tsAt = Date.now(); a0 = nm(document.activeElement); } pd[n] = ((pd[n] || '') + (e.defaultPrevented ? '1' : '0')).slice(0, 3); }, false); });
  document.addEventListener('focusin', function (e) { if (isComposer(e.target)) focusAt = Date.now(); }, true);
  document.addEventListener('focusout', function (e) { if (isComposer(e.target)) blurAt = Date.now(); }, true);

  // THE LADDER - each remedy runs INSIDE the trusted touchend, before the tap's own click focuses the field
  var fails = 0, good = 0, ghost = null, NR = 5;
  function mkGhost(y) {
    rmGhost();
    var g = document.createElement('input'); g.type = 'text'; g.setAttribute('autocomplete', 'off'); g.setAttribute('aria-label', 'keyboard check'); g.className = 'kbghost';
    var top = Math.max(8, Math.min((window.innerHeight || 600) - 48, (y || 200) - 60));
    g.style.cssText = 'position:fixed;left:10px;top:' + top + 'px;width:140px;height:38px;font-size:16px;opacity:.06;z-index:2147483647;border:0;background:#000;color:#fff;padding:0 8px';
    (document.body || document.documentElement).appendChild(g); ghost = g; return g;
  }
  function rmGhost() { if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost); ghost = null; }
  var R = {
    1: function (t) { t.focus({ preventScroll: true }); },
    2: function (t) { t.blur(); t.focus({ preventScroll: true }); t.click(); },
    3: function (t, y, e) { try { e.preventDefault(); } catch (x) {} mkGhost(y).focus({ preventScroll: true }); }, // the cancelled touchend cancels the tap's own click, or that click would hand focus straight back to the composer and the probe would measure nothing
    4: function (t) { try { t.setAttribute('inputmode', 'text'); } catch (e) {} t.focus({ preventScroll: true }); try { var n = (t.value || '').length; t.setSelectionRange(n, n); } catch (e) {} },
    5: function (t) { try { window.focus(); } catch (e) {} try { document.body.focus(); } catch (e) {} t.focus({ preventScroll: true }); }
  };
  function pick() { if (!(IOS && SA) || fails === 0) return 0; if (good) return good; return ((fails - 1) % NR) + 1; }

  document.addEventListener('touchend', function (e) {
    var t = e.target; if (!isComposer(t)) return;
    var x = 0, y = 0; try { var c = e.changedTouches[0]; x = c.clientX; y = c.clientY; } catch (err) {}
    var r = pick(), vv0 = vvh(), t0 = Date.now(), pre = (document.activeElement === t) ? 1 : 0;
    if (r) { try { R[r](t, y, e); } catch (err) {} }
    setTimeout(function () {
      var ae = document.activeElement, vv1 = vvh(), kb = vv1 < vv0 - 80;
      var base = ' sa:' + (SA ? 1 : 0) + ' r:' + r + ' pre:' + pre;
      if (r === 3 && ghost) { // the ghost probe answers its own question, then hands the keyboard to the real field
        var gk = (ae === ghost) ? 1 : 0;
        send('kbghost' + base + ' kb:' + (kb ? 1 : 0) + ' gf:' + gk + ' hf:' + hf() + ' v:' + VER + ' ios:' + IOSV);
        if (kb && gk) { good = 3; try { t.focus({ preventScroll: true }); } catch (err) {} setTimeout(function () { var k2 = vvh() < vv0 - 80; send('kbmove f:' + (document.activeElement === t ? 1 : 0) + ' kb:' + (k2 ? 1 : 0) + ' hf:' + hf() + ' v:' + VER); rmGhost(); toast('Keyboard check: fix 3 worked (ghost) - recorded'); }, 500); return; }
        rmGhost(); fails++; toast('Keyboard check: try ' + r + ' did not help - recorded, tap once more'); return;
      }
      var okf = (ae === t);
      if (okf && (kb || !IOS)) {
        if (IOS && SA) { if (r) good = r; send('kbok3' + base + ' hf:' + hf() + ' a0:' + a0 + ' fb:' + (focusAt >= t0 ? 1 : 0) + ' v:' + VER + ' ios:' + IOSV); if (r) toast('Keyboard check: fix ' + r + ' worked - recorded'); }
        return;
      }
      if (IOS && SA) fails++;
      var efp = null; try { efp = document.elementFromPoint(x, y); } catch (err) {}
      send('kbfail3' + base + ' f:' + (okf ? 1 : 0) + ' kb:' + (kb ? 1 : 0) + ' fb:' + (focusAt >= t0 ? 1 : 0) + ((blurAt > focusAt && blurAt >= t0) ? 'b' : '')
        + ' p:' + EV.map(function (n) { return pd[n] || '-'; }).join('/') + ' a0:' + a0 + ' hf:' + hf() + ' v:' + VER + ' ios:' + IOSV
        + ' vv:' + Math.round(vv0) + '/' + Math.round(vv1) + (efp === t ? '' : ' efp:' + nm(efp)) + (okf ? '' : ' ae:' + nm(ae)));
      if (IOS && SA) toast('Keyboard check: ' + (r ? 'try ' + r + ' did not help' : 'no keyboard') + ' - recorded, tap the field again');
    }, 600);
  }, { passive: false });

  // does ANY other field get a keyboard in this installed app? one row per page, the first non-composer field focused
  if (IOS && SA) {
    var anySent = 0;
    document.addEventListener('focusin', function (e) {
      var t = e.target; if (anySent || !t || isComposer(t) || (t.className === 'kbghost')) return;
      var tg = (t.tagName || '').toUpperCase(); if (tg !== 'INPUT' && tg !== 'TEXTAREA') return;
      var ty = (t.type || '').toLowerCase(); if (['checkbox', 'radio', 'button', 'submit', 'range', 'file', 'hidden'].indexOf(ty) >= 0) return;
      anySent = 1; var vv0 = vvh();
      setTimeout(function () { var kb = vvh() < vv0 - 80; send('kbany sa:1 kb:' + (kb ? 1 : 0) + ' f:' + (document.activeElement === t ? 1 : 0) + ' hf:' + hf() + ' el:' + nm(t) + ' ty:' + (ty || 'text') + ' v:' + VER + ' ios:' + IOSV); }, 600);
    }, true);
  }
})();

