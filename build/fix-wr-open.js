#!/usr/bin/env node
/* WHAT A WIN-RATE ROW IS STILL HOLDING (2026-10-24, owner: "zelim da ubacis koliko jos imaju otvorenih trejdova
   ... ove abjuzere sto drze otvorene trejdove da bi imali dobar win rate").

   The rate counts closed trades, so a trader who takes winners and sits on losers reads 94% while most of what
   they hold is under water. Measured on the live season before building anything: igbekwu 47-3 with 6 of 6 open
   losing, Kingchizzy 90-31 with 15 of 17, Squidward10timeX 34-34 with 24 of 24 - and, on the other side,
   Alibhai001 and Ladyp03 holding mostly WINNERS. That is why the column shows the SHARE that is losing and not
   just a count: a number alone would read the same for both kinds of trader.

   The bar is the cool part and it is information, not decoration: its red width is exactly the losing share, so
   a solid red bar means every position this trader holds is under water. `|o` is deliberately moved from the
   Wilson column to "Won / lost", because on a phone the rate and what is still open are the pair that tells the
   story; the scored figure and the prize always stay (the 2026-10-05 phone rule).

   Both files, because /leaderboards/ is hand-made twice and the script IIFE is byte-identical in each.
   Idempotent, --dry. */
'use strict';
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const FILES = ['dist/leaderboards/index.html', 'dist/es/leaderboards/index.html'];

const OLD_HEAD = `head:['#','Trader',T("winRate",'Win rate'),T("wonLostH",'Won / lost'),T("wilsonH",'Wilson score')+'|o',T("prizeH",'Prize')],`;
const NEW_HEAD = `head:['#','Trader',T("winRate",'Win rate'),T("wonLostH",'Won / lost')+'|o',T("stillOpenH",'Still open'),T("wilsonH",'Wilson score')+'|o',T("prizeH",'Prize')],`;

const OLD_ROW = `row:function(r){return ['<td class="v up">'+(+r.wr||0).toFixed(1)+'%</td>','<td class="v">'+int(r.w)+' / '+int(r.l)+'</td>','<td class="v">'+int(r.score)+'</td>'];},`;
const NEW_ROW = `row:function(r){return ['<td class="v up">'+(+r.wr||0).toFixed(1)+'%</td>','<td class="v">'+int(r.w)+' / '+int(r.l)+'</td>','<td class="v">'+openCell(r)+'</td>','<td class="v">'+int(r.score)+'</td>'];},`;

const OLD_RULE = `rules:[T("aCloseIsA",'A close is a <b>win</b> only with at least 5% ROE and a 0.2% real move; everything else is a loss or ignored.'),`;
const NEW_RULE = `rules:[T("aCloseIsA",'A close is a <b>win</b> only with at least 5% ROE and a 0.2% real move; everything else is a loss or ignored.'),T("theRateCountsClosed",'The rate counts <b>closed</b> trades only. <b>Still open</b> shows what a trader is holding right now and how much of it is losing - the red part of the bar. Someone who closes their winners and sits on their losers can read 95% with every open position under water, and this column is where you see it.'),`;

// the cell + its style, inserted next to the table helpers the file already has
const HELPER = `
  /* STILL OPEN (2026-10-24): the count, and the losing share as the red part of a bar under it. An unpriced
     position is counted as open and never as losing - a gap in our data is not evidence against a trader. */
  function openCell(r){
    var n=+r.open||0; if(!n) return '<span class="opn0">-</span>';
    var lose=+r.openLose||0, priced=+r.openPriced||0, pct=priced?Math.round(lose/priced*100):0;
    var ttl=n+' still open'+(!priced?', not priced yet':(priced<n?', '+lose+' of the '+priced+' we could price are losing right now':', '+lose+' of them losing right now'));
    return '<span class="opn'+(priced&&lose===priced?' all':'')+'" title="'+ttl+'">'+n+'<i style="width:'+pct+'%"></i></span>';
  }`;
const HELPER_AFTER = `  function int(n){`;

const CSS = `
  /* The grey track is the whole open book, the red fill is the part of it that is losing right now. It is the
     only signal on a PHONE, where there is no hover to read the title from, so it is sized to be read at a
     glance rather than to be discreet. */
  .opn{display:inline-block;min-width:36px;position:relative;padding-bottom:9px;font-weight:700}
  .opn::after{content:'';position:absolute;left:0;right:0;bottom:1px;height:4px;border-radius:3px;background:#39424e}
  .opn i{position:absolute;left:0;bottom:1px;height:4px;border-radius:3px;background:#ff5a4d;z-index:1;box-shadow:0 0 6px rgba(255,90,77,.5)}
  .opn.all{color:#ff8a80}
  .opn0{color:#5d666f}`;
const CSS_BEFORE = '</style>';

let done = 0;
for (const rel of FILES) {
  const F = path.join(__dirname, '..', rel);
  if (!fs.existsSync(F)) { console.log('  MISSING ' + rel); continue; }
  let h = fs.readFileSync(F, 'utf8');
  if (h.indexOf('function openCell(') >= 0) { console.log('  ' + rel + ': already applied'); continue; }
  for (const [name, a, b] of [['head', OLD_HEAD, NEW_HEAD], ['row', OLD_ROW, NEW_ROW], ['rule', OLD_RULE, NEW_RULE]]) {
    const n = h.split(a).length - 1;
    if (n !== 1) throw new Error(rel + ': the win-rate ' + name + ' anchor appears ' + n + ' times');
    h = h.split(a).join(b);
  }
  const hi = h.indexOf(HELPER_AFTER);
  if (hi < 0) throw new Error(rel + ': the int() helper was not found');
  h = h.slice(0, hi) + HELPER.replace(/\r?\n/g, h.indexOf('\r\n') >= 0 ? '\r\n' : '\n') + '\n' + h.slice(hi);
  const ci = h.lastIndexOf(CSS_BEFORE, h.indexOf('</head>') > 0 ? h.indexOf('</head>') : h.length);
  if (ci < 0) throw new Error(rel + ': no </style> before </head>');
  h = h.slice(0, ci) + CSS.replace(/\r?\n/g, h.indexOf('\r\n') >= 0 ? '\r\n' : '\n') + '\n' + h.slice(ci);
  if ((h.match(/function openCell\(/g) || []).length !== 1) throw new Error(rel + ': openCell is not unique');
  if (!DRY) { fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F); }
  console.log('  ' + rel + ': Still open column, bar, rule' + (DRY ? ' (dry)' : ''));
  done++;
}
if (!done) { console.log('fix-wr-open: nothing to do'); process.exit(0); }
console.log('fix-wr-open: ' + done + ' file(s)' + (DRY ? '  --dry, nothing written' : '\n  NEXT: node build/es/check-inline-js.js && npm run deploy'));
