/* Injects the lean Sentry reporter (dist/assets/sentry.js) before </head> in every dist/*.html (idempotent). */
const fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const TAG = '\n<script defer src="/assets/sentry.js"></script>';
let n = 0, skip = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) {
      let h = fs.readFileSync(p, 'utf8');
      if (h.indexOf('/assets/sentry.js') >= 0) { skip++; continue; }
      const i = h.indexOf('</head>');
      if (i >= 0) { h = h.slice(0, i) + TAG + '\n' + h.slice(i); fs.writeFileSync(p, h); n++; }
    }
  }
}
walk(DIST);
console.log('sentry.js injected into', n, 'files,', skip, 'already had it');
