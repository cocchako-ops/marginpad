/* Replace the render-blocking Google Fonts <link> in every dist/*.html with the self-hosted /assets/fonts.css.
   Idempotent post-build step (runs after the generators, like add-gtag.js). Run: node build/self-host-fonts.js */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const LOCAL = '<link rel="stylesheet" href="/assets/fonts.css">';
const reLink = /<link[^>]*href="https:\/\/fonts\.googleapis\.com\/css2[^"]*"[^>]*>/g;
const rePre = /<link rel="preconnect" href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*>\s*/g;

let files = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets' || true) walk(p); }
    else if (e.name.endsWith('.html')) {
      let h = fs.readFileSync(p, 'utf8');
      if (h.indexOf('fonts.googleapis.com/css2') === -1) continue;
      const out = h.replace(reLink, LOCAL).replace(rePre, '');
      if (out !== h) { fs.writeFileSync(p, out); files++; }
    }
  }
}
walk(DIST);
console.log('self-hosted fonts in ' + files + ' html files');
