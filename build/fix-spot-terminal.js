#!/usr/bin/env node
/* /spot/ BECOMES A TERMINAL (2026-10-24, owner: "update celu spot stranicu tako da izgleda takodje kao terminal
   i nesto vise FOMO aplikaciji ... ne zelim neki mini update, zelim bukvalno ceo terminal posvecen meme coins i
   spot trade"; v2 2026-10-26: five-cell dock, Assets view, movers, stats, watchlist). The reasoning is in the two
   blocks this injects - build/spot-terminal.css.txt and .js.txt.

   The method matters more than the markup: the page's own script binds every control by id, so the terminal is
   built by MOVING those nodes into a stage, not by rewriting the logic. One line of that script is not touched by
   this patcher. That is the same rule the /trading-api/ key manager is under - lift it, do not retype it.

   RE-RUNNABLE (2026-10-26): a previous injection is cut out first - the stylesheet between its own banner and the
   boot-splash banner, the shell between its own <script> and </script> - so iterating on the two .txt files is
   "edit, run, deploy" rather than restoring the page by hand. --dry. */
'use strict';
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'spot', 'index.html');
const CSS = fs.readFileSync(path.join(__dirname, 'spot-terminal.css.txt'), 'utf8').replace(/\s+$/, '');
const JS = fs.readFileSync(path.join(__dirname, 'spot-terminal.js.txt'), 'utf8').replace(/\s+$/, '');
const before = fs.readFileSync(F, 'utf8');
let h = before;
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const nl = (s) => s.replace(/\r?\n/g, N);

// 0. cut a previous injection out (both halves, or neither - a half-stripped page is refused)
const CSS_START = '  /* ─── THE TERMINAL (2026-10-24', CSS_END = '  /* ─── THE BOOT SPLASH';
const JS_START = '<script>' + N + '/* ─── THE TERMINAL SHELL';
let had = false;
{
  const a = h.indexOf(CSS_START), b = h.indexOf(CSS_END);
  const c = h.indexOf(JS_START);
  if ((a >= 0) !== (c >= 0)) throw new Error('a previous injection is only half present (css ' + (a >= 0) + ', js ' + (c >= 0) + ') - refusing');
  if (a >= 0) {
    if (b < a) throw new Error('the boot-splash banner must follow the terminal stylesheet');
    h = h.slice(0, a) + h.slice(b);
    const c2 = h.indexOf(JS_START), d = h.indexOf('</script>' + N, c2);
    if (d < 0) throw new Error('the previous shell has no closing tag');
    h = h.slice(0, c2) + h.slice(d + ('</script>' + N).length);
    had = true;
  }
}

// 1. the stylesheet goes right BEFORE the boot-splash banner (so the splash block stays the last thing in <style>);
//    if that banner is absent (a page without fix-spot-boot) it goes at the end of the page's own <style>
{
  let si = h.indexOf(CSS_END);
  if (si < 0) si = h.lastIndexOf('</style>', h.indexOf('</head>') > 0 ? h.indexOf('</head>') : h.length);
  if (si < 0) throw new Error('no place for the stylesheet');
  h = h.slice(0, si) + nl(CSS) + N + h.slice(si);
}

// 2. the shell script goes after the page's own script and the two deferred bundles, before the boot-splash script
//    (or before </body> when that script is absent)
{
  const BOOT = '<script>' + N + '(function () {' + N + "  var el = document.getElementById('spotBoot')";
  let bi = h.indexOf(BOOT);
  if (bi < 0) bi = h.lastIndexOf('</body>');
  if (bi < 0) throw new Error('no </body>');
  h = h.slice(0, bi) + '<script>' + N + nl(JS) + N + '</script>' + N + h.slice(bi);
}

// the page's own script must be untouched - that is the whole safety argument
const ownScript = (s) => { const i = s.indexOf('<script>' + N + '(function(){'); return i < 0 ? '' : s.slice(i, s.indexOf('</script>', i)); };
if (!ownScript(before) || ownScript(before) !== ownScript(h)) throw new Error("the page's own script changed - it must not");
if ((h.match(/term\.id = 'spotTerm'/g) || []).length !== 1) throw new Error('the shell is not injected exactly once');
if ((h.match(/THE TERMINAL \(2026-10-24/g) || []).length !== 1) throw new Error('the stylesheet is not injected exactly once');
['mWorth', 'mCash', 'mSeason', 'mRankV', 'buyCard', 'floorCard', 'thesisCard', 'hist', 'sheet', 'chart', 'list', 'holdRows', 'spotBoot'].forEach(id => {
  if (h.indexOf('id="' + id + '"') < 0) throw new Error('the terminal must keep every id the script binds: ' + id + ' is gone');
});
console.log('fix-spot-terminal: ' + (had ? 'previous shell replaced' : 'shell injected') + ' - stage, five columns, live head, movers, stats, assets, the five-cell dock');
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('  written: dist/spot/index.html\n  NEXT: node build/gen-spot-i18n.js && node build/es/check-inline-js.js && npm run deploy');
