#!/usr/bin/env node
/* THE CHAT TAB SENT THE INSTALLED APP TO THE HOMEPAGE (2026-10-23, owner: "dok sam na paper trade i otvorim chat,
   vrati me na pocetnu pa onda moram opet klik na chat").

   MEASURED in the activity ring: /paper-trade 22:34:15 -> / 22:34:17 -> /paper-trade 22:34:20 -> / 22:34:21, every
   hop two seconds apart, only on his installed app (sa:1), never in a Safari tab. Two document-level click handlers
   disagree about the phone tab bar's Chat tab: mp-nav builds it as `<a href="/" data-mpbn="chat">` and its handler
   calls preventDefault() and opens the chat - but pwa-nav.js (the iOS home-screen link interceptor, a deferred script
   that stands EARLIER in <head>, so its listener is registered first and runs first) sees an <a> with a real href and
   does `window.location.href = a.href` - to "/", the homepage. The chat then opens there, which is the second click.

   Two fixes, either sufficient alone, both kept because the service worker can hold either file stale on a phone:
     - mp-nav: Chat is an ACTION, not a destination, so it is built exactly like Browse - href="#" + role="button".
       pwa-nav has always skipped `#` hrefs, so even a stale pwa-nav leaves it alone.
     - pwa-nav: never navigate an anchor that is a button (`role="button"`, `[data-mpbn]`) and never one another
       handler has already cancelled (`e.defaultPrevented`).

   Idempotent, --dry. Then bump-home-assets + deploy.                                                                */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const R = f => path.join(__dirname, '..', 'dist', 'assets', f);
const done = [];
function patch(file, edits) {
  let h = fs.readFileSync(R(file), 'utf8'), n = 0;
  for (const [name, a, b, skipIf] of edits) {
    if (h.indexOf(skipIf) >= 0) continue;
    const c = h.split(a).length - 1;
    if (c !== 1) throw new Error(file + ' / ' + name + ': anchor appears ' + c + ' times');
    h = h.split(a).join(b); done.push(file + ': ' + name); n++;
  }
  if (n && !DRY) { fs.writeFileSync(R(file) + '.tmp', h); fs.renameSync(R(file) + '.tmp', R(file)); }
  return h;
}

patch('mp-nav.js', [
  ['the Chat tab is an action like Browse',
    "      var browse = it[0] === 'browse';\n",
    "      var browse = it[0] === 'browse', act = browse || it[1] === 'Chat'; // Chat is an ACTION, not a destination (2026-10-23): a real href here is what pwa-nav.js navigates to in the installed app - see build/fix-pwa-chat-tab.js\n",
    "act = browse || it[1] === 'Chat'"],
  ['no current-tab glow for an action tab',
    "      var cur = (!browse && (it[0].split('?')[0].replace(/\\/$/, '') || '/') === path && iq === (location.search || '')) ? ' cur' : '';",
    "      var cur = (!act && (it[0].split('?')[0].replace(/\\/$/, '') || '/') === path && iq === (location.search || '')) ? ' cur' : '';",
    "var cur = (!act &&"],
  ['href="#" + role=button on both action tabs',
    "      return '<a href=\"' + (browse ? '#' : it[0]) + '\" data-mpbn=\"' + keys[it[1]] + '\"' + (browse ? ' role=\"button\"' : '')",
    "      return '<a href=\"' + (act ? '#' : it[0]) + '\" data-mpbn=\"' + keys[it[1]] + '\"' + (act ? ' role=\"button\"' : '')",
    "(act ? '#' : it[0])"],
]);

patch('pwa-nav.js', [
  ['skip buttons and already-handled clicks',
    "    if (!a) return;\n    if (a.target === '_blank' || a.hasAttribute('download')) return; // new tab / downloads: leave alone\n",
    "    if (!a) return;\n"
    + "    // an anchor that is a BUTTON is not a navigation (2026-10-23: the phone tab bar's Chat tab is <a data-mpbn> and this\n"
    + "    // interceptor sent the installed app to the homepage on every open - see build/fix-pwa-chat-tab.js); and a click\n"
    + "    // another handler has already cancelled is theirs, not ours\n"
    + "    if (e.defaultPrevented || a.hasAttribute('data-mpbn') || a.getAttribute('role') === 'button') return;\n"
    + "    if (a.target === '_blank' || a.hasAttribute('download')) return; // new tab / downloads: leave alone\n",
    "a.getAttribute('role') === 'button') return;"],
]);

if (!done.length) { console.log('fix-pwa-chat-tab: nothing to do'); process.exit(0); }
// the result must hold exactly one `act ?` href expression and the chat tab must no longer be able to carry "/"
const nav = fs.readFileSync(R('mp-nav.js'), 'utf8');
if (!DRY && (nav.match(/\(act \? '#' : it\[0\]\)/g) || []).length !== 1) throw new Error('mp-nav: the href expression is not exactly once');
console.log('fix-pwa-chat-tab: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
console.log('  NEXT: node build/bump-home-assets.js && npm run deploy');
