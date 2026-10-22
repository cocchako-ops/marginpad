#!/usr/bin/env node
/* THE PANELS DRAW FROM THE LAST ANSWER AND REFRESH UNDER YOU (2026-10-22, item 3 of the plan the owner
   approved: "kes za panele ... isti obrazac koji /season/ vec koristi").

   Every panel behind the account menu opens on the word "Loading…" and stays there until a request comes back -
   messages, a conversation, notifications. On the measurements this session took, that is 0.3-1.5s on a decent
   connection and far longer on a bad one, every single time the panel is opened, for data that was already on
   the device a minute ago. /season/ has done the right thing since 2026-09-10 (`mp_dash_snap`: paint from the
   cache at once, refresh in place) and nothing else learned it.

   `window.mpSWR(key, url, draw, fail)` is that pattern, once:
     - draws the last answer IMMEDIATELY if there is one, then draws the fresh one when it lands,
     - hands `draw(data, fresh)` so a side effect that must happen ONCE - marking notifications read - can ask
       which pass it is on,
     - caches nothing for a guest and nothing that came back as an error,
     - is keyed PER ACCOUNT and cleared on sign-out, because a shared device must never open somebody else's
       messages out of a cache. That is the same rule the frame-0 identity follows: the cookie is the authority.

   Idempotent, --dry. Refuses rather than guessing.                                                            */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'assets', 'mp-auth.js');
const done = [];

let h = fs.readFileSync(F, 'utf8');
function one(name, a, b, skipIf) {
  if (skipIf && h.indexOf(skipIf) >= 0) return;
  const n = h.split(a).length - 1;
  if (n !== 1) throw new Error(name + ': anchor appears ' + n + ' times, expected 1');
  h = h.split(a).join(b);   // split/join, never String.replace
  done.push(name);
}

/* ---------------------------------------------------------------- the helper --------------------------- */
const SWR = [
  "  /* STALE-WHILE-REVALIDATE FOR A PANEL (2026-10-22). Draw the last answer at once, then the fresh one.",
  "     KEYED PER ACCOUNT AND CLEARED ON SIGN-OUT: a shared device must never open somebody else's messages out",
  "     of a cache, which is the one way a cache like this could do harm - so it is closed by construction, the",
  "     same rule the frame-0 identity follows. Nothing is cached for a guest, and nothing that came back as an",
  "     error. `draw(d, fresh)` says which pass it is, for a side effect that must happen only once. */",
  "  function mpcKey(k) {",
  "    var me = (window.mpMe && window.mpMe.in && window.mpMe.user) || null;",
  "    var id = me && (me.id || me.uid || me.username);",
  "    return id ? ('mpc:' + id + ':' + k) : '';",
  "  }",
  "  function mpcClear() {",
  "    try { var rm = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('mpc:') === 0) rm.push(k); } rm.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}",
  "  }",
  "  window.mpSWR = function (key, url, draw, fail) {",
  "    var ck = mpcKey(key), had = false;",
  "    if (ck) { try { var c = JSON.parse(localStorage.getItem(ck) || 'null'); if (c && c.d) { had = true; draw(c.d, false); } } catch (e) {} }",
  "    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {",
  "      var bad = !d || d.error;",
  "      if (ck && !bad) { try { var s = JSON.stringify({ t: Date.now(), d: d }); if (s.length < 200000) localStorage.setItem(ck, s); } catch (e) {} }",
  "      draw(d, true);",
  "      return d;",
  "    }).catch(function (e) { if (!had && fail) fail(e); });   // a cached panel never flashes an error over good content",
  "  };",
  "  window.mpCacheClear = mpcClear;",
].join('\n');

one('the stale-while-revalidate helper',
  '  function reflect() {\n    var on = !!ME;',
  SWR + '\n  function reflect() {\n    var on = !!ME;',
  'window.mpSWR = function');

/* sign-out drops every cached panel along with the identity snapshot */
one('signing out drops the cached panels too',
  "ME = null; mpMeSnap(null); reflect(); render(); });",
  "ME = null; mpMeSnap(null); mpcClear(); reflect(); render(); });",
  'mpcClear(); reflect(); render();');

/* ---------------------------------------------------------------- the panels --------------------------- */
one('messages: the inbox draws from the last answer',
  "fetch('/api/dm/inbox').then(function (r) { return r.json(); }).then(function (d) {",
  "window.mpSWR('dm:inbox', '/api/dm/inbox', function (d) {",
  "window.mpSWR('dm:inbox'");
one('messages: and its failure path still reads',
  "}).catch(function () { var ib = bodyEl.querySelector('#mpaIb'); if (ib) ib.innerHTML = __esT_mpauth(\"couldNotLoadYour2\",'<div class=\"mpa-xp-empty\">Could not load your messages.</div>'); });",
  "}, function () { var ib = bodyEl.querySelector('#mpaIb'); if (ib) ib.innerHTML = __esT_mpauth(\"couldNotLoadYour2\",'<div class=\"mpa-xp-empty\">Could not load your messages.</div>'); });",
  "}, function () { var ib = bodyEl.querySelector('#mpaIb');");

one('a conversation opens on what it said last time',
  "fetch('/api/dm/thread?with=' + encodeURIComponent(name)).then(function (r) { return r.json(); }).then(function (d) {\n      if (!d || d.error) {",
  "window.mpSWR('dm:t:' + name, '/api/dm/thread?with=' + encodeURIComponent(name), function (d) {\n      if (!d || d.error) {",
  "window.mpSWR('dm:t:'");
one('and its failure path still reads',
  "}).catch(function () { scroll.innerHTML = __esT_mpauth(\"couldNotLoadThis2\",'<div class=\"mpa-dm-empty\">Could not load this chat.</div>'); });",
  "}, function () { scroll.innerHTML = __esT_mpauth(\"couldNotLoadThis2\",'<div class=\"mpa-dm-empty\">Could not load this chat.</div>'); });",
  "}, function () { scroll.innerHTML = __esT_mpauth(\"couldNotLoadThis2\"");

one('notifications draw from the last answer',
  "fetch('/api/auth/notifs').then(function (r) { return r.json(); }).then(function (d) {",
  "window.mpSWR('notifs', '/api/auth/notifs', function (d, fresh) {",
  "window.mpSWR('notifs'");
/* MARKING THEM READ IS A SIDE EFFECT AND MUST HAPPEN ONCE - on the fresh pass, never on the cached one, or the
   bell would be cleared on the strength of a list that may be a day old. */
one('but they are only marked read on the fresh pass',
  "      // mark all read (clears the bell) once viewed\n      fetch('/api/auth/notifs?seen=1').then(function () { notifSetBadge(0); }).catch(function () {});",
  "      // mark all read (clears the bell) once viewed - on the FRESH pass only: clearing the bell on the\n      // strength of a cached list would hide a notification that arrived since it was written\n      if (fresh) fetch('/api/auth/notifs?seen=1').then(function () { notifSetBadge(0); }).catch(function () {});",
  'if (fresh) fetch(\'/api/auth/notifs?seen=1\')');
one('notifications: and their failure path still reads',
  "}).catch(function () { var nf = bodyEl.querySelector('#mpaNf'); if (nf) nf.innerHTML = __esT_mpauth(\"couldNotLoadNotifications\",'<div class=\"mpa-xp-empty\">Could not load notifications.</div>'); })",
  "}, function () { var nf = bodyEl.querySelector('#mpaNf'); if (nf) nf.innerHTML = __esT_mpauth(\"couldNotLoadNotifications\",'<div class=\"mpa-xp-empty\">Could not load notifications.</div>'); })",
  "}, function () { var nf = bodyEl.querySelector('#mpaNf');");

/* ---------------------------------------------------------------- report ------------------------------- */
if (!done.length) { console.log('add-panel-cache: nothing to do (already applied)'); process.exit(0); }

if ((h.match(/window\.mpSWR = function/g) || []).length !== 1) throw new Error('mpSWR is not defined exactly once');
if ((h.match(/window\.mpSWR\(/g) || []).length !== 3) throw new Error('expected exactly three cached panels, found ' + (h.match(/window\.mpSWR\(/g) || []).length);
if (h.indexOf('mpcClear();') < 0) throw new Error('sign-out does not clear the cache');
if (h.indexOf("if (fresh) fetch('/api/auth/notifs?seen=1')") < 0) throw new Error('notifications would be marked read from a cached list');
if (h.indexOf("fetch('/api/dm/thread?with=' + encodeURIComponent(name), { cache: 'no-store' })") < 0) throw new Error('the thread POLL must stay a plain fetch - it is the live one');

console.log('add-panel-cache: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
const tmp = F + '.tmp';
fs.writeFileSync(tmp, h);
fs.renameSync(tmp, F);
console.log('  written: dist/assets/mp-auth.js');
console.log('  NEXT: node build/bump-home-assets.js && npm run deploy && node build/panel-cache-e2e.js');
