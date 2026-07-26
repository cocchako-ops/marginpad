// fix-charset.js — ensure <meta charset> is the FIRST tag inside <head> on every dist HTML page.
// WHY (2026-07-23 incident): the Yandex.Metrika + gtag head injections landed BEFORE the charset meta,
// pushing it past the browser's 1024-byte encoding prescan window. With no charset in the HTTP
// Content-Type header (Cloudflare assets serve bare "text/html"), browsers fell back to windows-1252
// → site-wide mojibake (Â·, â€”, zavrÅ¡ena…) on every raw UTF-8 character. Per the HTML spec the
// charset declaration MUST appear within the first 1024 bytes — so it goes first, always.
// Idempotent; runs over dist/ (incl. demo-home + app.html). Wired into build.js as a late post-processor.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');
let fixed = 0, walked = 0, missing = [];
function fixFile(p) {
  let s = fs.readFileSync(p, 'utf8');
  const head = s.match(/<head[^>]*>/i);
  if (!head) return;
  const hEnd = head.index + head[0].length;
  const meta = s.match(/[ \t]*<meta charset=[^>]*>\r?\n?/i);
  if (!meta) { missing.push(p); return; }
  // already immediately after <head> (allow only whitespace between)? then done
  const between = s.slice(hEnd, meta.index);
  if (/^\s*$/.test(between)) {
    if (meta.index - hEnd <= 2) return; // tight enough
  }
  const tag = meta[0].trim();
  s = s.slice(0, meta.index) + s.slice(meta.index + meta[0].length); // remove from old spot
  const h2 = s.match(/<head[^>]*>/i); // recompute (indexes shifted)
  const at = h2.index + h2[0].length;
  s = s.slice(0, at) + '\n' + tag + s.slice(at);
  fs.writeFileSync(p, s);
  fixed++;
}
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (f.endsWith('.html')) { walked++; try { fixFile(p); } catch (e) { console.error('ERR', p, e.message); } }
  }
})(ROOT);
console.log('fix-charset: walked ' + walked + ' html, moved charset first on ' + fixed + (missing.length ? (', NO charset meta on ' + missing.length + ' (first: ' + missing.slice(0, 3).join(', ') + ')') : ''));
