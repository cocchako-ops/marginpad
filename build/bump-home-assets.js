/* Re-stamps the ?v= content hash on EVERY reference to the shared bundles - across app/index.html + all of dist/**.html
   (the app-shell dist/app.html, homepage, language homepages, every standalone page), the dynamic loaders inside
   home.js, and the one mp-nav.js injection in src/worker.js. The bundles themselves are edited in place (they ARE the
   source); this only busts the cache-bust query so browsers pick up the new bytes.

   2026-09-05: generalised from home.css/home.js to EVERY hand-edited bundle (mp-nav, mp-auth, mp-trade, mp-charts,
   mp-mcharts, mp-heatmap, mp-screener, mp-profile, mp-calc, pwa-nav, sentry, i18n, lightweight-charts). Why: the service
   worker serves ?v= URLs stale-while-revalidate (instant on repeat loads) but unversioned JS/CSS NETWORK-first (so a
   hotfix lands on the next load) - which made every repeat load of /paper-trade wait on ~125 KB gz of mp-* bundles.
   Each bundle gets its OWN hash, so touching mp-auth.js does not invalidate home.js for everyone.

   Order matters: the loaders inside home.js are stamped FIRST (they change home.js's bytes), then the home hash is
   computed, then every HTML file. Idempotent. Run after ANY edit to a bundle; build.js runs it as its last step.
   Verify with: node build/check-home-hash.js */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { htmlFiles } = require('./lib-html-files');
const ROOT = path.join(__dirname, '..');
const A = path.join(ROOT, 'dist', 'assets');

const BUNDLES = ['mp-nav.js', 'mp-auth.js', 'mp-trade.js', 'mp-trade.css', 'mp-profile.js', 'mp-calc.js', 'pwa-nav.js', 'sentry.js', 'i18n.js', 'mp-charts.js', 'mp-mcharts.js', 'mp-heatmap.js', 'mp-screener.js', 'lightweight-charts-4.2.0.js'];
const hashOf = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
const esc = (s) => s.replace(/[.]/g, '\\.');
function writeIfChanged(f, next) { const cur = fs.readFileSync(f, 'utf8'); if (cur === next) return false; const tmp = f + '.tmp'; fs.writeFileSync(tmp, Buffer.from(next, 'utf8')); fs.renameSync(tmp, f); return true; }

// 1) hashes for the independent bundles (content only - they do not reference each other)
const ver = {};
for (const b of BUNDLES) { const f = path.join(A, b); if (fs.existsSync(f)) ver[b] = hashOf(fs.readFileSync(f)); }

// 1b) mp-nav.js carries the chat-everywhere loader (mp-trade.js + mp-trade.css) since 2026-09-06: stamp those
//     references inside it FIRST, then re-hash it, so the HTML stamps of mp-nav.js match the file that ships.
{
  const navPath = path.join(A, 'mp-nav.js');
  if (fs.existsSync(navPath)) { writeIfChanged(navPath, stampText(fs.readFileSync(navPath, 'utf8'))); ver['mp-nav.js'] = hashOf(fs.readFileSync(navPath)); }
}

// 2) stamp the dynamic loaders inside home.js ('/assets/mp-charts.js' etc.) and the worker's mp-nav injection
function stampText(text) {
  let out = text;
  for (const b of Object.keys(ver)) {
    const re = new RegExp('(/assets/' + esc(b) + ')(\\?v=[a-f0-9]+)?(?=["\'\\s)>?&#]|$)', 'g');
    out = out.replace(re, '$1?v=' + ver[b]);
  }
  return out;
}
const homeJsPath = path.join(A, 'home.js');
const loadersStamped = writeIfChanged(homeJsPath, stampText(fs.readFileSync(homeJsPath, 'utf8')));
const workerPath = path.join(ROOT, 'src', 'worker.js');
const workerStamped = fs.existsSync(workerPath) && writeIfChanged(workerPath, stampText(fs.readFileSync(workerPath, 'utf8')));

// 3) home bundle hash (AFTER the loaders inside it were stamped)
const css = fs.readFileSync(path.join(A, 'home.css'), 'utf8');
const js = fs.readFileSync(homeJsPath, 'utf8');
const vHome = hashOf(css + js);
const RE_HOME = /(\/assets\/home\.(?:css|js)\?v=)[a-f0-9]+/g;

// 4) every HTML file
const files = htmlFiles(ROOT);
let stamped = 0, referencing = 0;
for (const f of files) {
  let h; try { h = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (h.indexOf('/assets/') < 0) continue;
  referencing++;
  let out = h.replace(RE_HOME, '$1' + vHome);
  out = stampText(out);
  if (out !== h) { fs.writeFileSync(f, out); stamped++; }
}
// 5) the SAME version, written into the worker, so /api/announce can tell an open tab that it is running old code.
// A tab left open across a deploy keeps its bundles forever (nothing reloads on its own) - that is how three rounds
// of fixes to the winning-ticket line stayed invisible to the owner on 2026-09-10.
try {
  const wp = fs.readFileSync(workerPath, 'utf8');
  const RE_AV = /(const ASSET_V = ')[a-f0-9]*(')/;
  const avNow = ver['mp-auth.js'] || vHome; // mp-auth compares against its own ?v= - stamp the same thing it will read
  if (RE_AV.test(wp)) { const nw = wp.replace(RE_AV, (m, a1, b1) => a1 + avNow + b1); if (nw !== wp) fs.writeFileSync(workerPath, nw); }
  else console.log('  (no ASSET_V constant in worker.js - the stale-tab notice will not update)');
} catch (e) {}
console.log('home assets v=' + vHome + ' - stamped ' + stamped + ' of ' + referencing + ' referencing file(s) (' + files.length + ' html scanned)'
  + (loadersStamped ? '; home.js loaders re-stamped' : '') + (workerStamped ? '; worker.js mp-nav injection re-stamped' : ''));
console.log('bundle versions: ' + Object.keys(ver).map(b => b + '=' + ver[b]).join(' '));
