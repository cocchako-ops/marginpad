/* Injects the Google tag immediately after <head> in every dist/*.html (idempotent). */
const fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n' +
  '<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n' +
  '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';
let n = 0, skip = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) {
      let h = fs.readFileSync(p, 'utf8');
      if (h.indexOf('AW-18230384038') >= 0) { skip++; continue; }
      const i = h.indexOf('<head>');
      if (i >= 0) { h = h.slice(0, i + 6) + GTAG + h.slice(i + 6); fs.writeFileSync(p, h); n++; }
    }
  }
}
walk(DIST);
console.log('gtag injected into', n, 'files,', skip, 'already had it');
