/* CI / pre-deploy guard: greps the SAME file list the stamper writes (app/index.html + all dist/**.html - via
   lib-html-files) and FAILS (exit 1) if any versioned bundle carries more than one distinct ?v= hash, or if a
   reference to a bundle that should be versioned is still bare. More than one hash means a bump-home-assets run
   missed a file and some page would load a stale bundle against a newer API; a bare reference means the service
   worker serves that file network-first on every load (slow repeat loads). Sharing the file list with the stamper is
   deliberate: if they scanned different sets, the guard could pass while a file it never looked at drifted.
   Wired as npm "predeploy". Usage: node build/check-home-hash.js */
const fs = require('fs');
const path = require('path');
const { htmlFiles } = require('./lib-html-files');
const ROOT = path.join(__dirname, '..');
const BUNDLES = ['ui-es.js', 'ui-es-app.js', 'ui-pt.js', 'ui-pt-app.js', 'ui-de.js', 'ui-de-app.js', 'home.css', 'home.js', 'mp-nav.js', 'mp-auth.js', 'mp-trade.js', 'mp-trade.css', 'mp-profile.js', 'mp-calc.js', 'pwa-nav.js', 'sentry.js', 'i18n.js', 'mp-charts.js', 'mp-mcharts.js', 'mp-heatmap.js', 'mp-screener.js', 'lightweight-charts-4.2.0.js'];
const esc = (s) => s.replace(/[.]/g, '\\.');

const files = htmlFiles(ROOT);
const seen = {}; // bundle -> hash -> Set(files); hash '' = bare
for (const f of files) {
  let h; try { h = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (h.indexOf('/assets/') < 0) continue;
  for (const b of BUNDLES) {
    const re = new RegExp('/assets/' + esc(b) + '(?:\\?v=([a-f0-9]+))?(?=["\'\\s)>?&#]|$)', 'g');
    let m; while ((m = re.exec(h))) { const k = m[1] || ''; ((seen[b] = seen[b] || {})[k] = seen[b][k] || new Set()).add(path.relative(ROOT, f)); }
  }
}
// the two in-bundle references: home.js dynamic loaders + the worker's mp-nav injection
for (const [label, f] of [['dist/assets/home.js', path.join(ROOT, 'dist', 'assets', 'home.js')], ['src/worker.js', path.join(ROOT, 'src', 'worker.js')]]) {
  let h; try { h = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  for (const b of (label === 'src/worker.js' ? ['mp-nav.js'] : BUNDLES)) { // the worker only INJECTS mp-nav.js; its other mentions are comments ("mirror of dist/assets/home.js")
    const re = new RegExp('/assets/' + esc(b) + '(?:\\?v=([a-f0-9]+))?(?=["\'\\s)>?&#]|$)', 'g');
    let m; while ((m = re.exec(h))) { const k = m[1] || ''; ((seen[b] = seen[b] || {})[k] = seen[b][k] || new Set()).add(label); }
  }
}

let bad = 0;
for (const b of Object.keys(seen)) {
  const hashes = Object.keys(seen[b]);
  const bare = seen[b][''] ? [...seen[b]['']] : [];
  const versioned = hashes.filter(x => x);
  if (bare.length) { bad++; console.error('check-home-hash: FAIL - ' + b + ' referenced WITHOUT ?v= in ' + bare.length + ' file(s): ' + bare.slice(0, 5).join(', ') + (bare.length > 5 ? ' (+' + (bare.length - 5) + ' more)' : '')); }
  if (versioned.length > 1) { bad++; console.error('check-home-hash: FAIL - ' + b + ' carries ' + versioned.length + ' different hashes (a bump was missed):'); for (const hh of versioned) { const fl = [...seen[b][hh]]; console.error('  ' + hh + '  -> ' + fl.slice(0, 5).join(', ') + (fl.length > 5 ? '  (+' + (fl.length - 5) + ' more)' : '')); } }
}
/* FRESHNESS (2026-11-12): a `?v=` asset is served `immutable` for a year by the worker, so the stamp MUST be the file's
   own content hash - a bundle edited after the last bump would otherwise be cached under the OLD url for ever on every
   returning browser (2026-10-21: every page pointed at mp-auth.js?v=7aa2374f while the file hashed to 6f2e5459, and
   this check was green because it only proved the stamps AGREED with each other). Same arithmetic as bump-home-assets:
   each bundle = sha256(file)[0:8]; home.css + home.js share hash(css + js). */
const crypto = require('crypto');
const hashOf = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
{
  const A = path.join(ROOT, 'dist', 'assets');
  let vHome = ''; try { vHome = hashOf(fs.readFileSync(path.join(A, 'home.css'), 'utf8') + fs.readFileSync(path.join(A, 'home.js'), 'utf8')); } catch (e) {}
  for (const b of Object.keys(seen)) {
    const stamp = Object.keys(seen[b]).filter(x => x)[0]; if (!stamp) continue;
    let want = '';
    if (b === 'home.js' || b === 'home.css') want = vHome;
    else { try { want = hashOf(fs.readFileSync(path.join(A, b))); } catch (e) { continue; } }
    if (want && want !== stamp) { bad++; console.error('check-home-hash: FAIL - ' + b + ' is stamped ?v=' + stamp + ' but the file hashes to ' + want + ' (edited after the last bump - a returning browser would keep the OLD bytes under the old url for a year)'); }
  }
}
if (bad) { console.error('Fix: node build/bump-home-assets.js  (then re-run this check).'); process.exit(1); }
const summary = Object.keys(seen).map(b => b + '=' + Object.keys(seen[b])[0]).join(' ');
console.log('check-home-hash: OK - one consistent hash per bundle across ' + files.length + ' html files (' + summary + ').');
