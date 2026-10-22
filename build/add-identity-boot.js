#!/usr/bin/env node
/* IDENTITY BEFORE THE FIRST FRAME (2026-10-22, owner: "zasto me ponekad aplikacija ne prepozna kao ulogovanog
   korisnika? Desavalo se da otvorim chat u sred ulogovane sesije i da mi pise da treba da se ulogujem").

   MEASURED on a real phone profile as a signed-in member, before any of this (scratchpad/identity-timing.js):

                                  fast 4G     slow 4G
     first paint                    880ms      2204ms
     mp_li cookie already says yes  (frame 0)  (frame 0)
     mpAuth.me() finally answers   1750ms      4432ms
     BLIND WINDOW AFTER PAINTING    870ms      2228ms

   For that whole window every surface that asks `mpAuth.me()` believes the member is a GUEST. The chat opens
   its sign-in gate, the account menu is missing, toasts route as a visitor. That is the five seconds he saw.

   AND THE DATA WAS NEVER THE PROBLEM. Two things are true at frame 0: the non-HttpOnly `mp_li` cookie already
   says this browser holds a session, and the account was fully known on the LAST page load. We throw the second
   away - mp-auth keeps NO local copy of the account - so every page re-earns it by downloading 152 KB of
   deferred bundle and then making a network round trip for something the device already knew.

   SO: an inline <head> script, before any bundle, publishes `window.mpMe` synchronously:

     window.mpMe = { in: <the cookie>, user: <last known account or null>, fresh: false, at: <when> }

   THE COOKIE IS THE AUTHORITY, THE SNAPSHOT IS ONLY FOR DISPLAY. Without `mp_li` the snapshot is ignored
   outright, so a logged-out device can never render a member's name out of a stale cache - which is the one way
   a cache like this could do harm, and it is closed by construction rather than by remembering to clear it.
   `fresh` turns true when /api/auth/me has confirmed it on THIS load; a surface that must not act on a stale
   answer (spending money, changing a setting) waits for that, and a surface that merely has to choose between
   guest and member does not.

   THE RULE THIS ESTABLISHES: no surface asks `mpAuth.me()` to decide guest or member. It asks `window.mpMe.in`.
   This is the seventh time a deferred bundle has decided that question wrongly - 12% of trades filed
   client-only (2026-09-29), the follow button offering to follow friends (2026-10-17), the close path that
   never reached the server (2026-10-07) - and every one of them was the same shape.

   Idempotent, --dry. Refuses rather than guessing.                                                             */
'use strict';
const fs = require('fs');
const path = require('path');

const R = (...p) => path.join(__dirname, '..', ...p);
const DRY = process.argv.indexOf('--dry') >= 0;
const done = [];

/* dist/demo-home/index.html is CRLF in places and LF in others (earlier patchers inserted blocks with bare LF),
   so every marker is tried in both endings - the trap build/fix-rekt-day.js recorded word for word. */
function lf(s) { return String(s).split('\r\n').join('\n'); }
function crlf(s) { return lf(s).split('\n').join('\r\n'); }
function find(h, m) {
  for (const x of [lf(m), crlf(m)]) {
    const n = h.split(x).length - 1;
    if (n === 1) return x;
    if (n > 1) throw new Error('marker appears ' + n + ' times: ' + JSON.stringify(x.slice(0, 60)));
  }
  return null;
}
function sameEol(sample, text) { return sample.indexOf('\r\n') >= 0 ? crlf(text) : lf(text); }
function edit(file, name, a, b, skipIf) {
  let h = fs.readFileSync(file, 'utf8');
  if (skipIf && [].concat(skipIf).some(m => h.indexOf(lf(m)) >= 0 || h.indexOf(crlf(m)) >= 0)) return h;
  const mk = find(h, a);
  if (!mk) throw new Error(name + ': anchor not found -> ' + JSON.stringify(lf(a).slice(0, 70)));
  h = h.split(mk).join(sameEol(mk, b));
  done.push(name);
  return h;
}

/* ---------------------------------------------------------------- the boot script ----------------------- */
/* Deliberately tiny and total: no try/catch escape that leaves window.mpMe undefined, because a surface that
   has to null-check it will eventually forget and we are back to the same bug. It always exists. */
const BOOT = '<script>/* IDENTITY AT FRAME 0 (2026-10-22): the mp_li cookie says whether this browser holds a session and the'
  + ' snapshot says who it was last time, so no surface has to wait 0.9-2.2s for a deferred 152 KB bundle to learn it.'
  + ' The COOKIE is the authority - without it the snapshot is ignored, so a signed-out device can never render a member.'
  + ' `fresh` turns true once /api/auth/me confirms it on this load. See build/add-identity-boot.js. */'
  + '\n(function(){var i=false,s=null;'
  + 'try{i=/(?:^|;\\s*)mp_li=1(?:;|$)/.test(document.cookie);}catch(e){}'
  + 'try{if(i)s=JSON.parse(localStorage.getItem("mp_me")||"null");}catch(e){}'
  + 'window.mpMe={in:i,user:(s&&s.u)||null,at:(s&&+s.t)||0,fresh:false};'
  + 'window.mpSignedIn=function(){return !!(window.mpMe&&window.mpMe.in);};'
  + 'try{if(i)document.documentElement.className+=" mp-li";}catch(e){}})();</script>';

/* ---------------------------------------------------------------- 1. the app shell ---------------------- */
{
  const F = R('app', 'index.html');
  const A = '<script>/* Mark dedicated-tool routes on <html> BEFORE first paint';
  const h = edit(F, 'app shell: identity at frame 0', A, BOOT + '\n' + A, 'window.mpMe=');
  if (!DRY && h) fs.writeFileSync(F, h);
}

/* ---------------------------------------------------------------- 2. the bento homepage ----------------- */
/* It already stamps html.mp-li from the same cookie for its own member card - that line is REPLACED rather than
   joined, or the class is added twice and two readings of the same fact start to drift. */
{
  const F = R('dist', 'demo-home', 'index.html');
  const A = 'try{if(/(^|;\\s*)mp_li=1(;|$)/.test(document.cookie))document.documentElement.className+=\' mp-li\';}catch(e){}</script>';
  const h = edit(F, 'bento homepage: identity at frame 0', A, '</script>\n' + BOOT, 'window.mpMe=');
  if (!DRY && h) fs.writeFileSync(F, h);
}

/* ---------------------------------------------------------------- 3. mp-auth fills and clears it -------- */
{
  const F = R('dist', 'assets', 'mp-auth.js');
  let h = fs.readFileSync(F, 'utf8');

  // (a) seed ME from the snapshot the moment the bundle parses, so mpAuth.me() stops being the thing that waits
  const A1 = "  var _liChk; try { _liChk = localStorage.getItem('mp_li_chk') === '1'; } catch (e) { _liChk = false; }";
  const B1 = [
    "  /* THE ACCOUNT WAS NEVER CACHED. ME was set only after /api/auth/me resolved, so the identity cost a 152 KB",
    "     download AND a round trip - on slow 4G, 4.4s after navigation and 2.2s after the page had already painted.",
    "     The snapshot is written below on every confirmed answer and read here before the fetch is even made; the",
    "     fetch still runs and still wins. mpMe.in gates it, so a signed-out device cannot be seeded. */",
    "  try { if (window.mpMe && window.mpMe.in && window.mpMe.user && !ME) { ME = window.mpMe.user; window.mpTktSkin = ME.tktskin || ''; reflect(); } } catch (e) {}",
    "  /* ONE WRITER for the snapshot: every path that learns the truth comes through here, including the one that",
    "     learns there is no account - which must CLEAR it, or a shared device keeps showing the last member. */",
    "  function mpMeSnap(u) {",
    "    try {",
    "      if (!u) { localStorage.removeItem('mp_me'); if (window.mpMe) { window.mpMe.user = null; window.mpMe.in = false; window.mpMe.fresh = true; } return; }",
    "      var s = JSON.stringify({ t: Date.now(), u: u });",
    "      if (s.length < 60000) localStorage.setItem('mp_me', s);   // an avatar is a data URI; refuse to blow the quota",
    "      if (window.mpMe) { window.mpMe.user = u; window.mpMe.in = true; window.mpMe.at = Date.now(); window.mpMe.fresh = true; }",
    "    } catch (e) {}",
    "  }",
    "  window.mpMeSnap = mpMeSnap;",
    A1,
  ].join('\n');
  if (h.indexOf('function mpMeSnap') < 0) {
    const mk = find(h, A1); if (!mk) throw new Error('mp-auth: the cookie gate is not where it was');
    h = h.split(mk).join(sameEol(mk, B1)); done.push('mp-auth: seed from the snapshot, and one writer for it');
  }

  // (b) write it on every confirmed /api/auth/me answer
  const A2 = "ME = d.user || null; try { window.mpTktSkin = (ME && ME.tktskin) || ''; } catch (e) {} BANNED = !!d.banned; reflect();";
  const B2 = "ME = d.user || null; try { window.mpTktSkin = (ME && ME.tktskin) || ''; } catch (e) {} BANNED = !!d.banned; mpMeSnap(ME); reflect();";
  if (h.indexOf('mpMeSnap(ME); reflect();') < 0) {
    const mk = find(h, A2); if (!mk) throw new Error('mp-auth: the /api/auth/me handler is not where it was');
    h = h.split(mk).join(sameEol(mk, B2)); done.push('mp-auth: the confirmed answer writes the snapshot');
  }

  // (c) and on sign-in, and clear it on sign-out
  const A3 = "if (d.ok) { ME = d.user; try { window.mpTktSkin = (ME && ME.tktskin) || ''; } catch (e) {} reflect();";
  const B3 = "if (d.ok) { ME = d.user; try { window.mpTktSkin = (ME && ME.tktskin) || ''; } catch (e) {} mpMeSnap(ME); reflect();";
  if (h.indexOf('mpMeSnap(ME); reflect(); setMsg(') < 0 && h.indexOf(lf(A3)) >= 0) {
    const mk = find(h, A3); if (mk) { h = h.split(mk).join(sameEol(mk, B3)); done.push('mp-auth: a fresh sign-in writes it too'); }
  }
  const A4 = "fetch('/api/auth/logout', { method: 'POST' }).then(function () { ME = null; reflect(); render(); });";
  const B4 = "fetch('/api/auth/logout', { method: 'POST' }).then(function () { ME = null; mpMeSnap(null); reflect(); render(); });";
  if (h.indexOf('mpMeSnap(null)') < 0) {
    const mk = find(h, A4); if (!mk) throw new Error('mp-auth: the logout path is not where it was');
    h = h.split(mk).join(sameEol(mk, B4)); done.push('mp-auth: signing out clears it');
  }
  if (!DRY) fs.writeFileSync(F, h);
}

/* ---------------------------------------------------------------- 4. the chat stops guessing ------------ */
/* MIRRORED BY HAND in home.js and mp-trade.js, like every other copy in this pair. `meUser()` is the ONE place
   the chat decides guest or member, so it is the only line that has to change. */
for (const f of ['home.js', 'mp-trade.js']) {
  const F = R('dist', 'assets', f);
  const A = "function meUser(){var me=(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me())||null;if(!me)return '';";
  const B = "function meUser(){/* IDENTITY AT FRAME 0 (2026-10-22): mpAuth is a DEFERRED bundle, so asking it who you are answered 'nobody' for 0.9s on fast 4G and 2.2s on slow - and the chat rendered its sign-in gate for exactly that long, mid-session. window.mpMe is published by an inline head script before any bundle. */"
    + "var me=(window.mpAuth&&window.mpAuth.me&&window.mpAuth.me())||(window.mpMe&&window.mpMe.in?window.mpMe.user:null)||null;if(!me)return '';";
  const h = edit(F, f + ': the chat reads the frame-0 identity', A, B, 'IDENTITY AT FRAME 0 (2026-10-22): mpAuth is a DEFERRED bundle');
  if (!DRY && h) fs.writeFileSync(F, h);
}

/* ---------------------------------------------------------------- report -------------------------------- */
if (!done.length) { console.log('add-identity-boot: nothing to do (already applied)'); process.exit(0); }

if (!DRY) {
  // guards, read back off disk
  const shell = fs.readFileSync(R('app', 'index.html'), 'utf8');
  const home = fs.readFileSync(R('dist', 'demo-home', 'index.html'), 'utf8');
  const auth = fs.readFileSync(R('dist', 'assets', 'mp-auth.js'), 'utf8');
  for (const [nm, src] of [['app shell', shell], ['bento homepage', home]]) {
    if ((src.match(/window\.mpMe=\{/g) || []).length !== 1) throw new Error(nm + ': the boot script is not present exactly once');
    if (src.indexOf('<meta charset') < 0) throw new Error(nm + ': lost its charset');
    if (src.indexOf('window.mpMe=') > src.indexOf('mp-auth.js')) throw new Error(nm + ': the boot script must come BEFORE the bundle it replaces the wait for');
  }
  if ((home.match(/className\+=" mp-li"/g) || []).length + (home.match(/className\+=' mp-li'/g) || []).length !== 1) throw new Error('bento: mp-li is stamped more than once');
  if ((auth.match(/function mpMeSnap/g) || []).length !== 1) throw new Error('mp-auth: one writer, not more');
  if (auth.indexOf('mpMeSnap(null)') < 0) throw new Error('mp-auth: signing out must clear the snapshot');
  for (const f of ['home.js', 'mp-trade.js']) {
    const s = fs.readFileSync(R('dist', 'assets', f), 'utf8');
    if (s.indexOf('window.mpMe&&window.mpMe.in?window.mpMe.user:null') < 0) throw new Error(f + ': the chat still waits for mpAuth');
  }
}

console.log('add-identity-boot: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
console.log('  NEXT: copy app/index.html -> dist/app.html, node build/gen-home-live.js, node build/bump-home-assets.js, npm run deploy');
