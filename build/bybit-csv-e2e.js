/* The Bybit report parser decides $200 of prize money, so it is tested against the shapes a real affiliate export
   arrives in - and against the shapes that used to make it guess. Runs the PRODUCTION function, sliced out of
   src/worker.js (no port, no drift).                                            node build/bybit-csv-e2e.js         */
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
const slice = (decl) => { // lift a top-level declaration out of the worker verbatim
  const i = src.indexOf(decl);
  if (i < 0) { console.log(decl + ' not found'); process.exit(1); }
  let d = 0, end = -1;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { end = k + 1; break; } } }
  return src.slice(i, end);
};
const notVolLine = src.split(/\r?\n/).find(l => l.indexOf('const BYBIT_NOT_VOL =') === 0);
if (!notVolLine) { console.log('BYBIT_NOT_VOL not found'); process.exit(1); }
// one scope so the parser still sees its own helper and regex, exactly as it does in the worker
const bybitParseReport = eval('(function(){' + notVolLine + '\n' + slice('function bybitVolScore(t)')
  + '\n' + slice('function bybitParseReport(') + '\nreturn bybitParseReport;})()');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const vol = (r, uid) => { const x = r.rows.find(y => y.uid === uid); return x ? x.vol : null; };

// ---- the shapes a real export arrives in --------------------------------------------------------------------------
let r = bybitParseReport('UID,Trading Volume\n580090490,"1,234,567.89"\n579447222,"98,765.40"');
ok(r.rows.length === 2 && vol(r, '580090490') === 1234567.89, 'plain CSV with quoted thousands (' + vol(r, '580090490') + ')');
ok(r.diag.volCol && /Trading Volume/.test(r.diag.volCol.name), 'it reports which column it read the volume from');

r = bybitParseReport('﻿UID\tTrading Volume (USDT)\tCommission\n580090490\t1234567.89\t12.34');
ok(vol(r, '580090490') === 1234567.89, 'tab-separated, with a BOM and a commission column it must NOT read (' + vol(r, '580090490') + ')');
ok(r.diag.sep === 'tab', 'the separator it chose is reported (' + r.diag.sep + ')');

r = bybitParseReport('UID;Volumen;Provision\n580090490;1.234.567,89;12,34');
ok(vol(r, '580090490') === 1234567.89, 'semicolon file with European decimals (' + vol(r, '580090490') + ')');

r = bybitParseReport('UID,Name,Trading Volume\n580090490,"Doe, John",1234.5');
ok(vol(r, '580090490') === 1234.5, 'a quoted name containing a comma does not shift the columns (' + vol(r, '580090490') + ')');

r = bybitParseReport('UID,Trading Volume\n580090490,\"$12,345.67 USDT\"');
ok(vol(r, '580090490') === 12345.67, 'currency symbol and a trailing USDT (' + vol(r, '580090490') + ')');

// An unquoted comma inside a number is malformed CSV: it used to read as 12 instead of 12,345.67. A wrong volume here
// pays the wrong member, so it must be refused and reported, never guessed.
r = bybitParseReport('UID,Trading Volume\n580090490,$12,345.67 USDT\n579447222,5000');
ok(vol(r, '580090490') === null && r.diag.skippedN >= 1, 'an unquoted comma inside a value is SKIPPED, never read as a smaller number');
ok(vol(r, '579447222') === 5000, 'and the well-formed row beside it still lands');

r = bybitParseReport('580090490,1.2M\n579447222,850k');
ok(vol(r, '580090490') === 1200000 && vol(r, '579447222') === 850000, 'k / M suffixes with no header at all');

// ---- the shapes that used to make it guess -------------------------------------------------------------------------
r = bybitParseReport('UID,Trading Volume,Commission\n580090490,-,12.34\n579447222,5000,9.99');
ok(vol(r, '580090490') === null, 'a dash in the volume column is SKIPPED, never costed from the commission column');
ok(vol(r, '579447222') === 5000, 'the good row in the same file still lands');
ok(r.diag.skippedN === 1 && /volume column/.test(r.diag.skipped[0].why), 'and the skip is reported with a reason (' + (r.diag.skipped[0] || {}).why + ')');

r = bybitParseReport('UID,Trading Volume,Commission\n580090490,,12.34');
ok(vol(r, '580090490') === null && r.diag.skippedN === 1, 'an empty volume cell is skipped too, not read as the commission');

r = bybitParseReport('UID,Trading Volume\n580090490,1000\n580090490,2000');
ok(r.rows.length === 1 && vol(r, '580090490') === 2000, 'a repeated UID keeps the LAST line (' + vol(r, '580090490') + ')');

r = bybitParseReport('Report generated 2026-09-14\nUID,Trading Volume\n580090490,1000');
ok(vol(r, '580090490') === 1000 && r.diag.skippedN === 1, 'a preamble line is skipped and reported, the data still reads');

r = bybitParseReport('UID,Trading Volume\n123,5000');
ok(r.rows.length === 0, 'a number too short to be a Bybit UID is not treated as one');

r = bybitParseReport('');
ok(r.rows.length === 0 && r.diag.lines === 0, 'empty input returns nothing and says so');

r = bybitParseReport('UID,Trading Volume\n580090490,1000\n579447222,2000\n577637675,3000');
ok(r.diag.total === 6000 && r.diag.rows === 3, 'the diagnostics carry the row count and the total volume (' + r.diag.rows + ' rows, ' + r.diag.total + ')');

// ---- the REAL affiliate export (2026-09-14) -------------------------------------------------------------------------
// "Clients_0_All_<affiliateId>_<from>_<to>.csv". The volume column is called TradingAmount, and the fourth column,
// Source, holds the AFFILIATE ID - which the first version of this read as everyone's volume (all 31 accounts tied at
// 162,071). Anything money-ish that is not volume is beside it: Deposits Amount, Fee Profit, Commissions, Tradfi Amount.
const REAL_HEAD = 'UID,VIP Level,User engagement,Joined BYBIT,Source,Remarks,KYC(Lv.),Coin,First-Time Deposited,Deposits Amount,TradingAmount,TakerAmount,MakerAmount,Interest,Fee Profit,Commissions,Tradfi Amount,Rebate Coin';
r = bybitParseReport(REAL_HEAD
  + '\n575652997,,Above 180,2026-07-13 20:59:43,162071,,1,USDT,,5.02000000,9.2296,9.2296,0,0,0.01,0.004,0,USDT'
  + '\n587612885,,,2026-09-13 09:19:12,162071,,1,USDT,,0.00000000,0,0,0,0,0,0,0,USDT');
ok(r.diag.volCol && r.diag.volCol.name === 'TradingAmount', 'the real export reads TradingAmount as the volume (' + (r.diag.volCol ? r.diag.volCol.name : 'none') + ')');
ok(vol(r, '575652997') === 9.23 && vol(r, '587612885') === 0, 'the volumes are the traded amounts, not the affiliate id (' + vol(r, '575652997') + ' / ' + vol(r, '587612885') + ')');
ok(r.rows.every(x => x.vol !== 162071), 'the Source column is never read as volume');
ok(r.diag.zeroN === 1, 'it counts how many accounts have not traded at all (' + r.diag.zeroN + ' of ' + r.diag.rows + ')');

// A file WITH a header and no volume column anywhere is REFUSED, with the column list, rather than guessed at.
r = bybitParseReport('UID,Source,Commissions,Deposits Amount\n587612885,162071,0,5.02');
ok(r.rows.length === 0 && r.diag.error === 'no_volume_column', 'a header with no volume column is refused, not guessed (' + (r.diag.error || 'parsed anyway') + ')');
ok((r.diag.cols || []).length === 4, 'and the refusal hands back every column so the owner can pick one');
r = bybitParseReport('UID,Source,Commissions,Deposits Amount\n587612885,162071,0,5.02', 'Deposits Amount');
ok(vol(r, '587612885') === 5.02 && r.diag.picked === 'Deposits Amount', 'a column named by the owner overrides the scoring (' + vol(r, '587612885') + ')');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
