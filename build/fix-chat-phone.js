/* THE CHAT ON A PHONE (2026-10-24, owner: "chat se i dalje otvara negde na sredini" + "ako izaberem da tikete
 * hocu da vidim kao hyperlink, hocu tako zauvek da ostane").       node build/fix-chat-phone.js [--dry]
 *
 * TWO CHANGES, AND NEITHER COULD BE REPRODUCED IN AN EMULATOR - measured on a 390px touch viewport in the ALL
 * room with 37 shared-trade cards hydrating 4.5 s late, the view stayed pinned to the newest message and the
 * ticket preference survived a close, a reopen and a socket reconnect. So each change targets the one cause the
 * emulator cannot stage, and says so.
 *
 *  1. `?m=<id>` IS CONSUMED ONCE, THEN REMOVED FROM THE URL. A mention notification links
 *     /paper-trade?chat=1&m=<id>, and opening the chat correctly scrolls to that message - in the MIDDLE of the
 *     room, which is the point. `ctJumpId` is read once per page load, so on an ordinary browser tab it fires
 *     once. On the installed app the URL is restored on every cold start, so every later launch re-read the same
 *     `m=` and landed mid-room again - which is exactly "it still opens somewhere in the middle". The id is
 *     stripped with replaceState the moment it is used (or found to be gone), so it cannot fire twice.
 *
 *  2. THE CHAT PREFERENCES ARE WRITTEN TWICE: localStorage, as before, and a one-year cookie. They are evicted
 *     by different mechanisms - iOS clears a home-screen app's localStorage under storage pressure long before
 *     it drops cookies - so losing one no longer loses the setting. Still a DEVICE setting, no server, no round
 *     trip; reading prefers whichever exists and rewrites the other.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = {
  home: path.join(ROOT, 'dist', 'assets', 'home.js'),
  trade: path.join(ROOT, 'dist', 'assets', 'mp-trade.js'),
  auth: path.join(ROOT, 'dist', 'assets', 'mp-auth.js'),
};
const read = f => fs.readFileSync(f, 'utf8');
function die(m) { console.error('REFUSED: ' + m); process.exit(1); }
function rep(s, from, to, what) { const n = s.split(from).length - 1; if (n !== 1) die(what + ' - expected 1 occurrence, found ' + n); return s.split(from).join(to); }
const out = {};

/* ── 1. the mention deep link is consumed once ─────────────────────────────────────────────────────────── */
const JUMP_OLD = "var ctJumpId=(function(){try{var q=location.search.match(/[?&]m=([A-Za-z0-9]+)/);return q?q[1]:'';}catch(e){return '';}})();";
const JUMP_NEW = "var ctJumpId=(function(){try{var q=location.search.match(/[?&]m=([A-Za-z0-9]+)/);return q?q[1]:'';}catch(e){return '';}})();\n"
  + "  /* CONSUMED ONCE (2026-10-24). The installed app restores its last URL on every cold start, so an `m=` left\n"
  + "     in the address bar re-fired this jump on every launch and the room opened in the middle for ever after a\n"
  + "     single mention. Taking it out of the URL is what makes it a one-off; the back button is unaffected. */\n"
  + "  function ctJumpDone(){ ctJumpId=''; try{ if(location.search.indexOf('m=')<0)return; var u=new URL(location.href); u.searchParams.delete('m'); history.replaceState(history.state,'',u.pathname+(u.search||'')+u.hash); }catch(e){} }";

for (const [k, f] of [['home', F.home], ['trade', F.trade]]) {
  let s = read(f);
  if (s.indexOf('function ctJumpDone') < 0) {
    s = rep(s, JUMP_OLD, JUMP_NEW, k + ': the mention deep link');
    // every place that finishes with the id now also takes it out of the URL
    s = rep(s, "if(!row){if(msgs&&msgs.querySelector('.ct-msg')){ctJumpId='';",
      "if(!row){if(msgs&&msgs.querySelector('.ct-msg')){ctJumpDone();", k + ': the gone-message branch');
    /* the URL is cleaned AFTER the scroll, never before it: a history write in the middle of a jump is one more
       thing that can move the view, and the id is already cleared by then so re-entry is impossible either way */
    s = rep(s, "try{row.animate([{background:'rgba(194,246,74,.38)'},{background:'rgba(194,246,74,.38)',offset:.45},{background:'transparent'}],{duration:2400});}catch(e){}}",
      "try{row.animate([{background:'rgba(194,246,74,.38)'},{background:'rgba(194,246,74,.38)',offset:.45},{background:'transparent'}],{duration:2400});}catch(e){}ctJumpDone();}", k + ': the jump itself');
  }
  /* AND THE PIN HOLDS WHILE THE ROOM IS STILL GROWING. The timed pins (0..2000ms) cover the cards that land
     inside two seconds; a card, an avatar or a coin logo that arrives later used to leave the view mid-room.
     An observer re-pins on any size change while the reader has not scrolled, and stops with them. */
  if (s.indexOf('_ctGrowRO') < 0) {
    s = rep(s, "function ctOpenPinStop(){ctPinT.forEach(function(t){clearTimeout(t);});ctPinT=[];}",
      "function ctOpenPinStop(){ctPinT.forEach(function(t){clearTimeout(t);});ctPinT=[];if(_ctGrowRO){try{_ctGrowRO.disconnect();}catch(e){}_ctGrowRO=null;}}"
      + "\n  var _ctGrowRO=null;"
      + "\n  function ctGrowWatch(){ if(!msgs||!window.ResizeObserver)return; if(_ctGrowRO){try{_ctGrowRO.disconnect();}catch(e){}}"
      + "\n    var h0=msgs.scrollHeight;"
      + "\n    _ctGrowRO=new ResizeObserver(function(){ if(!ctStick||!msgs||box.hidden)return; if(msgs.scrollHeight===h0)return; h0=msgs.scrollHeight; msgs.scrollTop=msgs.scrollHeight; });"
      + "\n    try{_ctGrowRO.observe(msgs);}catch(e){}"
      + "\n    setTimeout(function(){ if(_ctGrowRO){try{_ctGrowRO.disconnect();}catch(e){}_ctGrowRO=null;} },12000); }",
      k + ': the pin watcher');
    s = rep(s, "[0,60,160,360,700,1200,2000].forEach(function(ms){ctPinT.push(setTimeout(function(){if(!ctStick||!msgs||box.hidden)return;msgs.scrollTop=msgs.scrollHeight;},ms));});}",
      "[0,60,160,360,700,1200,2000].forEach(function(ms){ctPinT.push(setTimeout(function(){if(!ctStick||!msgs||box.hidden)return;msgs.scrollTop=msgs.scrollHeight;},ms));});ctGrowWatch();}",
      k + ': the pin itself');
  }
  if (s !== read(f)) out[f] = s;
}

/* ── 2. the chat preferences are written twice ─────────────────────────────────────────────────────────── */
{
  let s = read(F.auth);
  if (s.indexOf('mp_ct_prefs_ck') < 0) {
    const G = "  function get() { var p = {}; try { p = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {} var o = {}; for (var k in DEF) o[k] = (p[k] != null ? p[k] : DEF[k]); if (['card', 'link'].indexOf(o.trades) < 0) o.trades = 'card'; if (['s', 'm', 'l'].indexOf(o.size) < 0) o.size = 'm'; return o; }\n"
      + "  function set(k, v) { var p = get(); p[k] = v; try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} apply(); if (pop) paint(); }";
    const GN = "  /* WRITTEN TWICE, ON PURPOSE (2026-10-24, owner: \"hocu tako zauvek da ostane, a ne stalno da moram da\n"
      + "     vracam na to podesavanje\"). localStorage and cookies are evicted by DIFFERENT mechanisms - iOS clears a\n"
      + "     home-screen app's localStorage under storage pressure long before it drops a cookie - so a setting kept\n"
      + "     in only one of them can quietly go back to the default. Reading prefers whichever still exists and\n"
      + "     rewrites the other. Still a device setting: no server, no round trip. */\n"
      + "  var CKEY = 'mp_ct_prefs_ck';\n"
      + "  function ckRead() { try { var m = document.cookie.match(/(?:^|;\\s*)mp_ct_prefs_ck=([^;]+)/); return m ? JSON.parse(decodeURIComponent(m[1])) : null; } catch (e) { return null; } }\n"
      + "  function ckWrite(o) { try { document.cookie = CKEY + '=' + encodeURIComponent(JSON.stringify(o)) + ';path=/;max-age=31536000;samesite=lax'; } catch (e) {} }\n"
      + "  function get() {\n"
      + "    var p = null; try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}\n"
      + "    var c = ckRead();\n"
      + "    if (!p && c) { p = c; try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} }   // localStorage was wiped\n"
      + "    else if (p && !c) ckWrite(p);                                                                 // the cookie was wiped\n"
      + "    p = p || {};\n"
      + "    var o = {}; for (var k in DEF) o[k] = (p[k] != null ? p[k] : DEF[k]);\n"
      + "    if (['card', 'link'].indexOf(o.trades) < 0) o.trades = 'card'; if (['s', 'm', 'l'].indexOf(o.size) < 0) o.size = 'm';\n"
      + "    return o;\n"
      + "  }\n"
      + "  function set(k, v) { var p = get(); p[k] = v; try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} ckWrite(p); apply(); if (pop) paint(); }";
    s = rep(s, G, GN, 'mp-auth: the chat preferences');
    out[F.auth] = s;
  }
}

const names = Object.keys(out);
if (DRY) { console.log('DRY RUN - would write: ' + (names.map(n => path.basename(n)).join(', ') || 'nothing')); process.exit(0); }
names.forEach(n => fs.writeFileSync(n, out[n]));
console.log('wrote: ' + (names.map(n => path.basename(n)).join(', ') || 'nothing'));
