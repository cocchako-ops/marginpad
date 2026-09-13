/* The Bybit report parser decides $200 of prize money, so it is tested against the shapes a real affiliate export
   arrives in — and against the shapes that used to make it guess. Runs the PRODUCTION function, sliced out of
   src/worker.js (no port, no drift).                                            node build/bybit-csv-e2e.js         */
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
const i = src.indexOf('function bybitParseReport(text)');
if (i < 0) { console.log('bybitParseReport not found'); process.exit(1); }
let d = 0, j = src.indexOf('{', i), end = -1;
for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { end = k + 1; break; } } }
const bybitParseReport = eval('(' + src.slice(i, end) + ')');

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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
