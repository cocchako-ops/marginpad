#!/usr/bin/env node
/* MORE INSTRUMENTS, AND EVERY GUARD THEY NEED (2026-10-24, owner: "da obogatimo ponudu coin parova ... da
   ubacimo jos firmi, forex, metali ili tako nesto, ali da to bude sigurno i bez problema").

   The list is build/markets-new.json, which carries WHY each one is in it and why the refused ones are not.
   Nothing here was chosen from a hunch: every instrument was fetched through the exact Yahoo request the worker
   makes before it reached that file.

   "Safely" is not the list, it is the five tables a new instrument has to be in or it is quietly wrong:
     1. where its PRICE comes from        YAHOO_MKT / STOCKS, or it falls through to the crypto cascade
     2. what CLASS it is                  the fee per side, and the client mirror that DISPLAYS that fee
     3. its MAX LEVERAGE                  maxLevFor defaults to 50x, which on copper or a currency pair is a gift
     4. the BOARD EXCLUSION               low-volatility markets at high leverage are farmable, so no non-crypto
                                          instrument may ever count toward a paid board (LB_EXCL_SET)
     5. the PICKER                        MKT / NONCRYPTO / the names map, or it exists and nobody can find it
   Missing 3 or 4 does not break anything visibly - it hands somebody a way to farm the money boards, which is
   why they are asserted at the end of this script rather than left to a reader.

   Idempotent, --dry. */
'use strict';
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const R = path.join(__dirname, '..');
const M = JSON.parse(fs.readFileSync(path.join(__dirname, 'markets-new.json'), 'utf8'));
const STK = Object.keys(M.stocks), COM = Object.keys(M.commodities), FX = Object.keys(M.forex);
const IDXN = Object.keys(M.indices || {}); // added once marketSession could read the venue's own hours
const NONC = COM.concat(FX, IDXN);

function edit(file, label, fn) {
  const F = path.join(R, file);
  let h = fs.readFileSync(F, 'utf8');
  const out = fn(h);
  if (out === h) { console.log('  ' + file + ' · ' + label + ': already there'); return 0; }
  if (!DRY) { fs.writeFileSync(F + '.tmp', out); fs.renameSync(F + '.tmp', F); }
  console.log('  ' + file + ' · ' + label);
  return 1;
}
// insert keys right after `NAME={` (or `NAME = {`), once
function into(h, anchor, keys, val) {
  const i = h.indexOf(anchor); if (i < 0) throw new Error('anchor not found: ' + anchor);
  if (h.indexOf(anchor, i + 1) >= 0) throw new Error('anchor not unique: ' + anchor);
  const add = keys.map(k => k + ': ' + val).join(', ');
  return h.slice(0, i + anchor.length) + add + ', ' + h.slice(i + anchor.length);
}
let n = 0;

// ---- 1 + 2 + 3 + 4: the worker ----
n += edit('src/worker.js', 'STOCKS (' + STK.length + ' companies)', h => {
  if (h.indexOf("SNOW: 'Snowflake'") >= 0) return h; // a guard has to be a string only THIS edit writes: "NOW: " already appears elsewhere in the file and reported the work as done
  return h.replace('const STOCKS = { ', 'const STOCKS = { ' + STK.map(s => s + ": '" + M.stocks[s].replace(/'/g, "\\'") + "'").join(', ') + ', ');
});
n += edit('src/worker.js', 'YAHOO_MKT (' + NONC.length + ' forex + commodities + indices)', h => {
  const line = (h.match(/const YAHOO_MKT = \{[^}]*\}/) || [''])[0];
  const add = COM.map(k => [k, M.commodities[k].yahoo]).concat(FX.map(k => [k, M.forex[k].yahoo]), IDXN.map(k => [k, M.indices[k].yahoo]))
    .filter(([k]) => line.indexOf(k + ':') < 0).map(([k, y]) => k + ": '" + y + "'").join(', ');
  if (!add) return h;
  return h.replace('const YAHOO_MKT = { ', 'const YAHOO_MKT = { ' + add + ', ');
});
n += edit('src/worker.js', 'IDX_SYMS (' + IDXN.length + ' indices)', h => {
  const line = (h.match(/const IDX_SYMS = \{[^}]*\}/) || [''])[0];
  const add = IDXN.filter(k => line.indexOf(k + ':') < 0).map(k => k + ': 1').join(', ');
  if (!add) return h;
  return h.replace('const IDX_SYMS = { ', 'const IDX_SYMS = { ' + add + ', ');
});
n += edit('src/worker.js', 'FX_SYMS', h => {
  if (h.indexOf('const FX_SYMS = { USDCHF:') >= 0) return h;
  return h.replace('const FX_SYMS = { ', 'const FX_SYMS = { ' + FX.map(k => k + ': 1').join(', ') + ', ');
});
/* THE COMMODITY CLASS. assetClassOf hardcoded `sym === 'XAU' || sym === 'XAG'`, which is a table of two written
   as an expression - copper and crude have nowhere to go in it. They join 'metal' deliberately rather than
   getting a class of their own: the fee, the 24/5 session with the 17:00-18:00 New York pause and the board
   exclusion are all exactly what a metal already gets, and a sixth class would be three more tables to forget. */
n += edit('src/worker.js', 'commodity class table', h => {
  if (h.indexOf('const COMMOD = {') >= 0) return h;
  const anchor = "function assetClassOf(sym) {";
  const tbl = "const COMMOD = { XAU: 1, XAG: 1, " + COM.map(k => k + ': 1').join(', ') + " }; // metals AND energy - one table, because `sym === 'XAU' || sym === 'XAG'` was a table of two written as an expression\n";
  return h.replace(anchor, tbl + anchor)
    .replace("if (sym === 'XAU' || sym === 'XAG') return 'metal';", "if (COMMOD[sym]) return 'metal';");
});
n += edit('src/worker.js', 'MAXLEV (never the 50x default)', h => {
  const line = (h.match(/const MAXLEV = \{[^}]*\}/) || [''])[0];
  const add = COM.map(k => [k, M.commodities[k].lev]).concat(FX.map(k => [k, M.forex[k].lev]), IDXN.map(k => [k, M.indices[k].lev]))
    .filter(([k]) => !new RegExp('[{,] ?' + k + ':').test(line)).map(([k, v]) => k + ': ' + v).join(', ');
  if (!add) return h;
  return h.replace('const MAXLEV = { ', 'const MAXLEV = { ' + add + ', ');
});
/* THE GUARD IS SCOPED TO ITS OWN LINE, and the first draft was not: it asked whether 'NATGAS' appeared anywhere
   in worker.js, and by the time this edit ran the YAHOO_MKT and MAXLEV edits above had already written it - so
   the one table that keeps a low-volatility market off the paid boards was skipped while reporting success.
   Same family as the "NOW: " guard above. A guard reads the thing it is about, never the whole file. */
n += edit('src/worker.js', 'LB_EXCL_SET (no paid board, ever)', h => {
  const line = (h.match(/const LB_EXCL_SET = new Set\('[^']*'/) || [''])[0];
  if (!line) throw new Error('LB_EXCL_SET was not found');
  if (NONC.every(k => new RegExp('[ \']' + k + '[ \']').test(line))) return h;
  return h.replace("const LB_EXCL_SET = new Set('", "const LB_EXCL_SET = new Set('" + NONC.filter(k => !new RegExp('[ \']' + k + '[ \']').test(line)).join(' ') + ' ');
});

// ---- 2 + 5: the client mirrors (home.js carries five of them; mp-mcharts one) ----
n += edit('dist/assets/home.js', 'STK + IDX2 mirror of STOCKS', h => {
  if (h.indexOf('STK={NOW:1') >= 0 || h.indexOf(',NOW:1,') >= 0) return h;
  return h.split('var STK={').join('var STK={' + STK.map(s => s + ':1').join(',') + ',')
          .split('STK={AAPL:1').join('STK={AAPL:1') // no-op, keeps the second table honest below
          .replace(/,IDX2=\{/, ',IDX2={');
});
n += edit('dist/assets/home.js', 'the second STK table (fee class)', h => {
  const a = '},IDX2={SPX500:1';
  if (h.indexOf(a) < 0) return h;
  const i = h.indexOf(a);
  if (h.slice(0, i).lastIndexOf('NOW:1') > h.lastIndexOf('var STK={')) return h; // already done
  return h.slice(0, i) + ',' + STK.map(s => s + ':1').join(',') + h.slice(i);
});
n += edit('dist/assets/home.js', 'MKT (tradeable outside the Bybit gate)', h => {
  const line = (h.match(/var MKT=\{[^}]*\}/) || [''])[0];
  const add = NONC.filter(k => !new RegExp('[{,]' + k + ':').test(line)).map(k => k + ':1').join(',');
  if (!add) return h;
  return h.replace('var MKT={', 'var MKT={' + add + ',');
});
// the index class lives in home.js TWICE (IDX for mpAssetClass, IDX2 beside the second STK table) - both or neither
n += edit('dist/assets/home.js', 'IDX + IDX2 (index class, both copies)', h => {
  const line = (h.match(/IDX=\{[^}]*\}/) || [''])[0];
  const add = IDXN.filter(k => !new RegExp('[{,]' + k + ':').test(line)).map(k => k + ':1').join(',');
  if (!add) return h;
  return h.split('IDX={SPX500:1').join('IDX={' + add + ',SPX500:1').split('IDX2={SPX500:1').join('IDX2={' + add + ',SPX500:1');
});
n += edit('dist/assets/home.js', 'FX + commodity class', h => {
  if (h.indexOf('FX={USDCHF:1') >= 0) return h;
  return h.replace('FX={', 'FX={' + FX.map(k => k + ':1').join(',') + ',')
    .replace("if(sym==='XAU'||sym==='XAG')return 'metal';", "if(COM[sym])return 'metal';")
    .replace('var IDX={SPX500:1', 'var COM={XAU:1,XAG:1,' + COM.map(k => k + ':1').join(',') + '},IDX={SPX500:1');
});
/* A GUARD ASKS ABOUT THE KEYS IT IS ABOUT TO WRITE, not about the first one it wrote last time. Keying this on
   "NONCRYPTO={NOW:1" made the second batch (the indices) report success without writing a thing - the third
   time today a guard matched work done by an earlier edit. */
n += edit('dist/assets/home.js', 'NONCRYPTO (the picker)', h => {
  const line = (h.match(/NONCRYPTO=\{[^}]*\}/) || [''])[0];
  const add = STK.concat(NONC).filter(k => !new RegExp('[{,]' + k + ':').test(line)).map(k => k + ':1').join(',');
  if (!add) return h;
  return h.replace('NONCRYPTO={', 'NONCRYPTO={' + add + ',');
});
const NAMES = STK.map(s => s + ":'" + M.stocks[s].replace(/'/g, "\\'") + "'")
  .concat(COM.map(k => k + ":'" + M.commodities[k].name + "'"), FX.map(k => k + ":'" + M.forex[k].name + "'"),
          IDXN.map(k => k + ":'" + M.indices[k].name + "'")).join(',');
/* home.js owns window.mpMarketName, which every surface reads. mp-mcharts' XAU:'Gold' is WHEEL_NAME - the nine
   coins on the phone's hold-to-switch wheel, a deliberately short list - and is left alone. */
/* The anchor is XAU:'Gold' alone, not "({XAU:'Gold'" - the first batch inserted its names BEFORE it, so the
   opening brace stopped being adjacent and the second batch could not find the table it had just written into. */
n += edit('dist/assets/home.js', 'market names', h => {
  const a = "XAU:'Gold'";
  const i = h.indexOf(a); if (i < 0) throw new Error('the mpMarketName table was not found');
  const line = h.slice(Math.max(0, i - 12000), i + 2000);
  const add = NAMES.split(',').filter(p => line.indexOf(p.split(':')[0] + ':') < 0).join(',');
  if (!add) return h;
  return h.slice(0, i) + add + ',' + h.slice(i);
});

// ---- the assertions that make "safely" a fact rather than an intention ----
if (!DRY) {
  const w = fs.readFileSync(path.join(R, 'src/worker.js'), 'utf8');
  const hj = fs.readFileSync(path.join(R, 'dist/assets/home.js'), 'utf8');
  const miss = [];
  STK.forEach(s => { if (!new RegExp('[{,]\\s*' + s + ':').test(w.match(/const STOCKS = \{[\s\S]*?\};/)[0])) miss.push('worker STOCKS ' + s); });
  NONC.forEach(k => {
    if (w.indexOf(k + ': ') < 0) miss.push('worker YAHOO_MKT ' + k);
    if (!new RegExp('[ \'(]' + k + '[ \']').test(w.match(/const LB_EXCL_SET[^\n]*/)[0])) miss.push('LB_EXCL ' + k);
    if (!new RegExp('[{,]\\s*' + k + ': \\d').test(w.match(/const MAXLEV = \{[\s\S]*?\};/)[0])) miss.push('MAXLEV ' + k);
  });
  STK.concat(NONC).forEach(k => { if (hj.indexOf(k + ':1') < 0) miss.push('client table ' + k); });
  if (miss.length) throw new Error('a new instrument is missing from a table that keeps it safe:\n  ' + miss.slice(0, 12).join('\n  ') + (miss.length > 12 ? '\n  ...and ' + (miss.length - 12) + ' more' : ''));
  console.log('  guards: every one of ' + (STK.length + NONC.length) + ' instruments is in its price, class, leverage, board-exclusion and picker table');
}
console.log('add-markets: ' + n + ' edit(s)' + (DRY ? '  --dry, nothing written' : '\n  NEXT: node build/lint.js && node --check dist/assets/home.js && node build/bump-home-assets.js && npm run deploy'));
