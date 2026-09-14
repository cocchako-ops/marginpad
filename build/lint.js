/* Real lint for the predeploy gate. `node --check` only sees SYNTAX - a duplicate object key is valid JS and passes
   it silently, which is exactly the class that slipped through (the duplicate 'Est. revenue today' key was caught
   ONLY by esbuild, via wrangler --dry-run). This runs the same esbuild bundle wrangler uses and FAILS on any warning.
   ~5-10s (also reads the assets dir) - fine for a deploy gate that runs a few times a day. */
const { execSync } = require('child_process');
const os = require('os');
const path = require('path');

let out = '';
try {
  // 2>&1 is REQUIRED: esbuild warnings go to STDERR, and execSync returns only STDOUT on success - without merging,
  // a dry-run that succeeds WITH warnings would look clean (the exact bug this lint exists to prevent).
  out = execSync('npx wrangler deploy --dry-run --outdir "' + path.join(os.tmpdir(), 'mp-lint') + '" 2>&1', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  out = (e.stdout || '') + '\n' + (e.stderr || '');
  if (!/\[WARNING\]|Total Upload/i.test(out)) { console.error('lint: dry-run FAILED to bundle:\n' + out.slice(-1500)); process.exit(1); }
}
const clean = out.replace(/\x1b\[[0-9;]*m/g, ''); // strip ANSI so the grep is reliable
// Benign wrangler CONFIG warnings (not code problems) - ignore. "Multiple environments defined … no target
// environment specified" always fires now that [env.staging] exists; it's about the deploy command, not the code.
const BENIGN = [/Multiple environments are defined/i, /no target environment was specified/i];
const warns = clean.split('\n')
  .filter(l => /\[WARNING\]|Duplicate key/i.test(l))
  .filter(l => !BENIGN.some(re => re.test(l)))
  .map(l => l.trim());
if (warns.length) { console.error('lint: FAIL - esbuild warning(s) (node --check would have missed these):'); warns.forEach(w => console.error('  ' + w)); process.exit(1); }

// Raw control characters in source (2026-09-05). A patch script that wrote "\\b" from a non-raw Python
// string put a real backspace (0x08) inside a regex literal in home.js and mp-trade.js: the file still
// parsed, the regex simply could never match, and nothing anywhere reported it. They are invisible in an
// editor and in a diff, so the only thing that catches them is a byte scan.
const fsL = require('fs');
const ASSETS = require('path').join(__dirname, '..', 'dist', 'assets');
const bad = [];
for (const f of fsL.readdirSync(ASSETS)) {
  if (!/\.(js|css)$/.test(f)) continue;
  const s = fsL.readFileSync(require("path").join(ASSETS, f), 'utf8');
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 9 || c === 11 || c === 12 || (c > 13 && c < 32) || c === 127) {
      bad.push(f + ' @' + i + ' (0x' + c.toString(16) + ') near: ' + JSON.stringify(s.slice(Math.max(0, i - 34), i + 14)));
      break; // one report per file is enough to go looking
    }
  }
}
if (bad.length) { console.error('lint: FAIL - raw control character in a shipped bundle:'); bad.forEach(b => console.error('  ' + b)); process.exit(1); }

console.log('lint: OK - esbuild bundle has no warnings, no control characters in dist/assets');
