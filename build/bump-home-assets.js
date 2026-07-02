/* Re-stamps the ?v= content hash on /assets/home.css + /assets/home.js references in app/index.html
   and dist/index.html (whichever exist). Run after ANY edit to dist/assets/home.css or home.js so
   browsers pick up the new version (the files themselves are edited in place, like mp-trade.js). */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'dist', 'assets', 'home.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'dist', 'assets', 'home.js'), 'utf8');
const v = crypto.createHash('sha256').update(css + js).digest('hex').slice(0, 8);
let n = 0;
for (const f of [path.join(ROOT, 'app', 'index.html'), path.join(ROOT, 'dist', 'index.html')]) {
  if (!fs.existsSync(f)) continue;
  let h = fs.readFileSync(f, 'utf8');
  const out = h.replace(/(\/assets\/home\.(?:css|js)\?v=)[a-f0-9]+/g, '$1' + v);
  if (out !== h) { fs.writeFileSync(f, out); n++; }
}
console.log('home assets v=' + v + ' stamped into ' + n + ' file(s)');
