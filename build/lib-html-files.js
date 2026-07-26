/* Single source of truth for "which HTML files can reference the home/app bundle" — shared by
   bump-home-assets.js (the stamper) and check-home-hash.js (the guard) so the two can never drift onto
   different file sets. That drift is exactly the bug class the guard exists to catch, so the guard and the
   stamper MUST look at the same list. Covers app/index.html (the app-shell source) + all of dist/**.html. */
const fs = require('fs');
const path = require('path');

function walkHtml(dir, out) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    if (e.isDirectory()) { if (e.name === 'node_modules' || e.name === '.git' || e.name === 'assets') continue; walkHtml(path.join(dir, e.name), out); }
    else if (e.name.endsWith('.html')) out.push(path.join(dir, e.name));
  }
}

function htmlFiles(root) {
  const files = [path.join(root, 'app', 'index.html')];
  walkHtml(path.join(root, 'dist'), files);
  return files;
}

module.exports = { htmlFiles };
