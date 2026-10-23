#!/usr/bin/env node
/* A NULL POINT NEVER REACHES LIGHTWEIGHT-CHARTS (2026-10-24) - see build/series-guard.block.txt for why.
   Replaces the one-line mpCreateChart in all three chart bundles (it is byte-identical in each, the documented
   duplication) with the guarded factory. Idempotent, --dry. The block lives in its own file because it carries
   regexes and quotes, and a patch string typed into a script has lost backslashes twice in this repo. */
'use strict';
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const BLOCK = fs.readFileSync(path.join(__dirname, 'series-guard.block.txt'), 'utf8').replace(/\s+$/, '');
const OLD = 'function mpCreateChart(host,opts){return LightweightCharts.createChart(host,mpTzMerge(opts));}';
const FILES = ['home.js', 'mp-charts.js', 'mp-mcharts.js'];
let done = 0, skipped = 0;
for (const f of FILES) {
  const F = path.join(__dirname, '..', 'dist', 'assets', f);
  let h = fs.readFileSync(F, 'utf8');
  if (h.indexOf('function mpPtBad(') >= 0) { console.log('  ' + f + ': already guarded'); skipped++; continue; }
  const n = h.split(OLD).length - 1;
  if (n !== 1) throw new Error(f + ': mpCreateChart one-liner appears ' + n + ' times');
  const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  h = h.split(OLD).join(BLOCK.replace(/\r?\n/g, N));
  if ((h.match(/function mpCreateChart\(/g) || []).length !== 1) throw new Error(f + ': mpCreateChart defined more than once after the patch');
  if (!DRY) { fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F); require('child_process').execFileSync(process.execPath, ['--check', F], { stdio: 'inherit' }); }
  console.log('  ' + f + ': guarded' + (DRY ? ' (dry)' : ', node --check OK'));
  done++;
}
if (!done) { console.log('fix-series-guard: nothing to do (' + skipped + ' already guarded)'); process.exit(0); }
console.log('fix-series-guard: ' + done + ' bundle(s)' + (DRY ? ' - --dry, nothing written' : '\n  NEXT: node build/series-guard-e2e.js --local && node build/bump-home-assets.js && npm run deploy'));
