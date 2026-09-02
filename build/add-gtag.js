/* Injects the Google tag immediately after <head> in every dist/*.html (idempotent). */
const fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n' +
  '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');(function(){function l(){if(window.__gtagL)return;window.__gtagL=1;var s=document.createElement(\'script\');s.async=true;s.src=\'https://www.googletagmanager.com/gtag/js?id=AW-18230384038\';document.head.appendChild(s);}if(document.readyState===\'complete\'){setTimeout(l,1500);}else{window.addEventListener(\'load\',function(){setTimeout(l,1500);});}})();</script>'; // library deferred to load+1.5s (2026-09-02): 165KB third-party on the critical path cost ~5s on Slow 4G; gtag() calls queue in dataLayer meanwhile
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
