#!/usr/bin/env node
/* CHAT SETTINGS (2026-10-23, owner: "settings za chat, gde ce ljudi moci da biraju kako da vide trejdove koji se
   sheruju (ovako ovo novo, ili po starom, onaj hyperlink). Uz to podesavanje, moze da se napravi jos neko mozda
   (text size i tako nesto)").

   ONE PLACE, NOT TWO. The chat exists twice (home.js on the app shell, mp-trade.js everywhere else), so the
   settings live in mp-auth - the every-page bundle - and reach into whichever chat box the page has: the gear
   is INSERTED into `.ct-head` at runtime rather than written into both markups (and the Spanish dictionary that
   carries the mp-nav copy of that markup), the preferences are read by the one card renderer, and the text size
   is a class on #chatBox. A setting is a device preference (localStorage `mp_ct_prefs`), never an account
   field - it is how THIS screen reads, and a phone and a desktop legitimately differ.

   Two settings, chips never a native select (the owner's rule):
     shared trades  card | link   - `link` is the pre-2026-10-22 look, a plain `trade:<id>` hyperlink. The wire
                                    format never changed, so switching is purely how an existing message is
                                    DRAWN: hydrate() is gated on it and unhydrate() turns a card back into the
                                    link (without the data-tk mark, so a switch back can hydrate it again).
     text size      S | M | L     - 12 / 13.5 / 15.5px on the message rows.

   Idempotent, --dry.                                                                                         */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'assets', 'mp-auth.js');
let h = fs.readFileSync(F, 'utf8');
const done = [];
function one(name, a, b, skipIf) {
  if (skipIf && h.indexOf(skipIf) >= 0) return;
  const n = h.split(a).length - 1;
  if (n !== 1) throw new Error(name + ': anchor appears ' + n + ' times, expected 1');
  h = h.split(a).join(b); done.push(name);
}

/* 1. hydrate() respects the preference, and unhydrate() exists */
one('hydrate is gated on the preference',
  "  function hydrate(root) {\n    root = root || document; if (!root.querySelectorAll) return;",
  "  function hydrate(root) {\n    root = root || document; if (!root.querySelectorAll) return;\n    try { if (window.mpChatPrefs && window.mpChatPrefs.get().trades === 'link') return; } catch (e) {}   // the reader asked for the plain link (chat settings)",
  "window.mpChatPrefs.get().trades === 'link') return;");
one('unhydrate turns a card back into the link',
  "  window.mpTradeCard = { hydrate: hydrate, html: html, res: resOf };",
  [
    "  /* the plain-link look the chat had before 2026-10-22, for a reader who prefers it: the card becomes the same",
    "     `trade:<id>` anchor linkifyMsg writes, WITHOUT the data-tk mark, so switching back can hydrate it again */",
    "  function unhydrate(root) {",
    "    root = root || document; if (!root.querySelectorAll) return;",
    "    Array.prototype.forEach.call(root.querySelectorAll('.ct-tk[data-trade]'), function (card) {",
    "      var id = String(card.getAttribute('data-trade') || '');",
    "      var a = document.createElement('a'); a.className = 'ct-trade'; a.setAttribute('data-trade', id); a.setAttribute('role', 'button'); a.setAttribute('tabindex', '0'); a.setAttribute('title', 'Open shared ticket'); a.textContent = 'trade:' + id;",
    "      var row = card.closest('.ct-msg'); if (row) row.classList.remove('ct-hastk');",
    "      if (card.parentNode) card.parentNode.replaceChild(a, card);",
    "    });",
    "  }",
    "  window.mpTradeCard = { hydrate: hydrate, unhydrate: unhydrate, html: html, res: resOf };",
  ].join('\n'),
  'function unhydrate(root)');

/* 2. the settings themselves */
const PREFS = [
  '',
  '/* CHAT SETTINGS (2026-10-23) - see build/add-chat-prefs.js. One place for both chat copies: the gear is inserted',
  '   into whichever .ct-head the page has, the preference is a device setting, and applying it is a class on',
  '   #chatBox plus a hydrate/unhydrate of the shared-trade cards. Chips, never a native select. */',
  '(function () {',
  '  if (window.mpChatPrefs) return;',
  "  var KEY = 'mp_ct_prefs', DEF = { trades: 'card', size: 'm' }, pop = null;",
  "  function get() { var p = {}; try { p = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {} var o = {}; for (var k in DEF) o[k] = (p[k] != null ? p[k] : DEF[k]); if (['card', 'link'].indexOf(o.trades) < 0) o.trades = 'card'; if (['s', 'm', 'l'].indexOf(o.size) < 0) o.size = 'm'; return o; }",
  "  function set(k, v) { var p = get(); p[k] = v; try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} apply(); if (pop) paint(); }",
  '  function apply() {',
  "    var p = get(), box = document.getElementById('chatBox');",
  "    if (box) { box.classList.toggle('ct-fs-s', p.size === 's'); box.classList.toggle('ct-fs-l', p.size === 'l'); }",
  "    try { if (window.mpTradeCard) { if (p.trades === 'link') window.mpTradeCard.unhydrate(document); else window.mpTradeCard.hydrate(document); } } catch (e) {}",
  '  }',
  "  function T(k, en) { try { return (typeof __esT_mpauth === 'function') ? __esT_mpauth(k, en) : en; } catch (e) { return en; } }",
  '  function paint() {',
  '    if (!pop) return; var p = get();',
  "    pop.innerHTML = '<div class=\"ctp-h\"><b>' + T('chatSettings', 'Chat settings') + '</b><button type=\"button\" class=\"ctp-x\" aria-label=\"Close\">\\u2715</button></div>'",
  "      + '<div class=\"ctp-r\"><span>' + T('sharedTrades', 'Shared trades') + '</span><span class=\"ctp-c\"><button type=\"button\" data-k=\"trades\" data-v=\"card\" class=\"' + (p.trades === 'card' ? 'on' : '') + '\">' + T('tradeCard', 'Card') + '</button><button type=\"button\" data-k=\"trades\" data-v=\"link\" class=\"' + (p.trades === 'link' ? 'on' : '') + '\">' + T('tradeLink', 'Link') + '</button></span></div>'",
  "      + '<div class=\"ctp-r\"><span>' + T('textSize', 'Text size') + '</span><span class=\"ctp-c\"><button type=\"button\" data-k=\"size\" data-v=\"s\" class=\"' + (p.size === 's' ? 'on' : '') + '\">S</button><button type=\"button\" data-k=\"size\" data-v=\"m\" class=\"' + (p.size === 'm' ? 'on' : '') + '\">M</button><button type=\"button\" data-k=\"size\" data-v=\"l\" class=\"' + (p.size === 'l' ? 'on' : '') + '\">L</button></span></div>'",
  "      + '<div class=\"ctp-n\">' + T('chatSettingsNote', 'Saved on this device. The link look is how shared trades appeared before the cards.') + '</div>';",
  '  }',
  '  function close() { if (pop && pop.parentNode) pop.parentNode.removeChild(pop); pop = null; }',
  '  function open() {',
  "    var box = document.getElementById('chatBox'); if (!box) return; if (pop) { close(); return; }",
  "    pop = document.createElement('div'); pop.className = 'ct-prefs'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Chat settings');",
  '    paint(); box.appendChild(pop);',
  "    pop.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-k]'); if (b) { set(b.getAttribute('data-k'), b.getAttribute('data-v')); return; } if (e.target.closest && e.target.closest('.ctp-x')) close(); });",
  "    setTimeout(function () { document.addEventListener('click', function off(e) { if (!pop) { document.removeEventListener('click', off, true); return; } if (!pop.contains(e.target) && !(e.target.closest && e.target.closest('.ct-gear'))) { close(); document.removeEventListener('click', off, true); } }, true); }, 0);",
  '  }',
  '  /* the gear goes into whichever chat header the page has - the app shell carries it in its markup, every',
  '     other page gets it from mp-nav, and both of those are DEFERRED alongside this bundle, so look a few times */',
  '  function gear() {',
  "    var head = document.querySelector('#chatBox .ct-head'); if (!head || head.querySelector('.ct-gear')) return !!head;",
  "    var b = document.createElement('button'); b.type = 'button'; b.className = 'ct-gear'; b.setAttribute('aria-label', T('chatSettings', 'Chat settings')); b.title = T('chatSettings', 'Chat settings');",
  "    b.innerHTML = '<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z\"/></svg>';",
  "    var x = head.querySelector('.ct-x'); if (x) head.insertBefore(b, x); else head.appendChild(b);",
  "    b.addEventListener('click', function (e) { e.stopPropagation(); open(); });",
  '    apply(); return true;',
  '  }',
  '  var tries = 0; (function look() { if (gear() || ++tries > 40) return; setTimeout(look, 500); })();',
  "  window.addEventListener('mp-auth-change', function () { gear(); });",
  '  window.mpChatPrefs = { get: get, set: set, apply: apply, open: open, close: close };',
  '})();',
  '',
].join('\n');
if (h.indexOf('window.mpChatPrefs = {') < 0) { h += PREFS; done.push('the settings: get/set/apply/open + the gear'); }

/* 3. the CSS, in this bundle's own stylesheet so it is on every page the chat is */
one('the settings CSS',
  "    + '.mpa-dbub{-webkit-user-select:none;-moz-user-select:none;user-select:none;-webkit-touch-callout:none}';",
  "    + '.mpa-dbub{-webkit-user-select:none;-moz-user-select:none;user-select:none;-webkit-touch-callout:none}'\n"
  + "    /* chat settings (2026-10-23) */\n"
  + "    + '.ct-gear{background:none;border:none;color:#7c8794;cursor:pointer;padding:2px 6px;line-height:1;display:inline-flex;align-items:center}.ct-gear:hover{color:#e9e7df}'\n"
  + "    + '.ct-prefs{position:absolute;top:46px;right:8px;z-index:5;width:min(300px,calc(100% - 16px));background:#0f1216;border:1px solid #2a3140;border-radius:12px;box-shadow:0 18px 40px -14px rgba(0,0,0,.8);padding:10px 12px 11px;font-family:Familjen Grotesk,system-ui,sans-serif;color:#c9d2dc}'\n"
  + "    + '.ctp-h{display:flex;align-items:center;justify-content:space-between;font-size:13px;margin-bottom:6px}.ctp-h b{color:#e9e7df}.ctp-x{background:none;border:none;color:#7c8794;cursor:pointer;font-size:14px;padding:2px 4px}'\n"
  + "    + '.ctp-r{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid #1c2230;font-size:13px}.ctp-c{display:inline-flex;gap:5px}'\n"
  + "    + '.ctp-c button{font:700 11px Space Mono,monospace;letter-spacing:.04em;padding:5px 10px;border-radius:999px;border:1px solid #2a3140;background:transparent;color:#aab2bd;cursor:pointer}.ctp-c button.on{background:rgba(194,246,74,.12);border-color:rgba(194,246,74,.55);color:#d6f78a}'\n"
  + "    + '.ctp-n{font-size:11px;color:#6c7682;margin-top:6px;line-height:1.45}'\n"
  + "    + '#chatBox.ct-fs-s .ct-msg{font-size:12px}#chatBox.ct-fs-l .ct-msg{font-size:15.5px}#chatBox.ct-fs-l .ct-tk{font-size:1.06em}';",
  '.ct-gear{background:none');

if (!done.length) { console.log('add-chat-prefs: nothing to do'); process.exit(0); }
if ((h.match(/window\.mpChatPrefs = \{/g) || []).length !== 1) throw new Error('mpChatPrefs not defined exactly once');
if (h.indexOf('unhydrate: unhydrate') < 0) throw new Error('unhydrate not exported');
if (!/<select/.test(h) === false && /ct-prefs[\s\S]{0,3000}<select/.test(h)) throw new Error('a native select crept in');
console.log('add-chat-prefs: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('  written: dist/assets/mp-auth.js');
