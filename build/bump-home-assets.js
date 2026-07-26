/* Re-stamps the ?v= content hash on EVERY reference to /assets/home.css + /assets/home.js — across the shared
   file list (app/index.html + all of dist/**.html: the app-shell dist/app.html, homepage, language homepages…).
   The home.css/home.js files themselves are edited in place (like mp-trade.js); this only busts the cache-bust
   query so browsers pick up the new bytes. Walk-all replaces the old "stamp 2 hard-coded files, remember dist/app.html
   by hand" flow — that manual step was a recurring source of stale-bundle bugs. Run after ANY edit to home.css/home.js.
   NOTE: dist/index.html (the bento homepage) does NOT load this bundle — it is the APP-SHELL bundle, loaded on
   /paper-trade /charts /calculators /screener /heatmap /swap. Verify with: node build/check-home-hash.js */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { htmlFiles } = require('./lib-html-files');
const ROOT = path.join(__dirname, '..');

const css = fs.readFileSync(path.join(ROOT, 'dist', 'assets', 'home.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'dist', 'assets', 'home.js'), 'utf8');
const v = crypto.createHash('sha256').update(css + js).digest('hex').slice(0, 8);
const RE = /(\/assets\/home\.(?:css|js)\?v=)[a-f0-9]+/g;

const files = htmlFiles(ROOT);
let stamped = 0, referencing = 0;
for (const f of files) {
  let h; try { h = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (h.indexOf('/assets/home.') < 0) continue; // fast skip: page doesn't load the bundle
  referencing++;
  const out = h.replace(RE, '$1' + v);
  if (out !== h) { fs.writeFileSync(f, out); stamped++; }
}
console.log('home assets v=' + v + ' — stamped ' + stamped + ' of ' + referencing + ' referencing file(s) (' + files.length + ' html scanned)');
