#!/usr/bin/env node
/* mp-ops Trading > Bot API desk (2026-10-24) - replaces the html() of simple('trading/botapi') in ops.js.txt with
   build/ops-botapi-view.block.txt (the wire() half with the grant chips is untouched). Idempotent, --dry.
   The block is a file, not a string in this script: it carries quotes and regexes that a patch string has lost before. */
'use strict';
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'src', 'ops', 'client', 'ops.js.txt');
const BLOCK = fs.readFileSync(path.join(__dirname, 'ops-botapi-view.block.txt'), 'utf8');
let h = fs.readFileSync(F, 'utf8');
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const block = BLOCK.replace(/\r?\n/g, N);
if (h.indexOf(block) >= 0) { console.log('fix-ops-botapi-view: already applied'); process.exit(0); }
const STARTS = ["  simple('trading/botapi', { urls: ['/api/admin/apistats', '/api/admin/apiplans'], every: 60000, html: function (d, pl) {", "  /* BOT API DESK (2026-10-24"];
let s = -1; for (const a of STARTS) { s = h.indexOf(a); if (s >= 0) { if (h.indexOf(a, s + 1) >= 0) throw new Error('start anchor appears twice'); break; } }
if (s < 0) throw new Error('start anchor not found');
const END = '  }, wire: function (el, d, paint) {' + N + '    var plan = AP_PLAN_SEL, days = AP_DAYS_SEL;';
const e = h.indexOf(END, s);
if (e < 0) throw new Error('end anchor (wire) not found');
if (h.indexOf(END, e + 1) >= 0) throw new Error('end anchor appears twice');
const old = h.slice(s, e);
if (old.length > 40000 || old.length < 2000) throw new Error('block to replace has an unexpected size: ' + old.length);
h = h.slice(0, s) + block + h.slice(e);
if ((h.match(/simple\('trading\/botapi'/g) || []).length !== 1) throw new Error('view registered more than once');
console.log('fix-ops-botapi-view: replacing ' + old.length + ' chars with ' + block.length);
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
// the client must still parse as a script
const tmp = path.join(require('os').tmpdir(), 'ops-check-' + process.pid + '.js'); fs.writeFileSync(tmp, h);
try { require('child_process').execFileSync(process.execPath, ['--check', tmp], { stdio: 'inherit' }); console.log('  node --check: OK'); } finally { try { fs.unlinkSync(tmp); } catch (e) {} }
console.log('  written: src/ops/client/ops.js.txt\n  NEXT: npm run deploy && node build/ops2-e2e.js trading/botapi');
