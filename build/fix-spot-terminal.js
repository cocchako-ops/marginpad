#!/usr/bin/env node
/* /spot/ BECOMES A TERMINAL (2026-10-24, owner: "update celu spot stranicu tako da izgleda takodje kao terminal
   i nesto vise FOMO aplikaciji ... ne zelim neki mini update, zelim bukvalno ceo terminal posvecen meme coins i
   spot trade"). The reasoning is in the two blocks this injects - build/spot-terminal.css.txt and .js.txt.

   The method matters more than the markup: the page's own script binds every control by id, so the terminal is
   built by MOVING those nodes into a stage, not by rewriting the logic. One line of that script is not touched.
   That is the same rule the /trading-api/ key manager is under - lift it, do not retype it - and it is what makes
   a change this size safe to ship in one go.

   Idempotent, --dry. */
'use strict';
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'spot', 'index.html');
const CSS = fs.readFileSync(path.join(__dirname, 'spot-terminal.css.txt'), 'utf8').replace(/\s+$/, '');
const JS = fs.readFileSync(path.join(__dirname, 'spot-terminal.js.txt'), 'utf8').replace(/\s+$/, '');
let h = fs.readFileSync(F, 'utf8');
if (h.indexOf('spotTerm') >= 0) { console.log('fix-spot-terminal: already applied'); process.exit(0); }
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const nl = (s) => s.replace(/\r?\n/g, N);

// 1. the stylesheet goes at the END of the page's own <style>, so every rule here wins a plain tie
const SEND = '</style>';
const si = h.lastIndexOf(SEND, h.indexOf('</head>') > 0 ? h.indexOf('</head>') : h.length);
if (si < 0) throw new Error('no </style> before </head>');
h = h.slice(0, si) + nl(CSS) + N + h.slice(si);

// 2. the shell script goes LAST, after the page's own script has wired everything
const BEND = '</body>';
const bi = h.lastIndexOf(BEND);
if (bi < 0) throw new Error('no </body>');
h = h.slice(0, bi) + '<script>' + N + nl(JS) + N + '</script>' + N + h.slice(bi);

// the page's own script must be untouched - that is the whole safety argument
const before = fs.readFileSync(F, 'utf8');
const ownScript = (s) => { const i = s.indexOf('<script>' + (s.indexOf('\r\n') >= 0 ? '\r\n' : '\n') + '(function(){'); return i < 0 ? '' : s.slice(i, s.indexOf('</script>', i)); };
if (ownScript(before) && ownScript(before) !== ownScript(h)) throw new Error("the page's own script changed - it must not");
// the shell's id is set in script (term.id = 'spotTerm'), not written as markup - assert the thing that exists
if ((h.match(/term\.id = 'spotTerm'/g) || []).length !== 1) throw new Error('the shell is not injected exactly once');
['mWorth', 'mCash', 'mSeason', 'mRankV', 'buyCard', 'floorCard', 'thesisCard', 'hist', 'sheet', 'chart', 'list', 'holdRows'].forEach(id => {
  if (h.indexOf('id="' + id + '"') < 0) throw new Error('the terminal must keep every id the script binds: ' + id + ' is gone');
});
console.log('fix-spot-terminal: stage, columns, worth strip, live head and the phone dock');
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('  written: dist/spot/index.html\n  NEXT: node build/gen-spot-i18n.js && node build/es/check-inline-js.js && npm run deploy');
