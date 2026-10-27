/* ONE SOCIALS BUTTON IN EVERY STATIC HEADER (2026-10-27, owner: "jedan logo za socials i da kad kliknu tu izadje im cool padajuci
   meni sa sva 3"). mp-nav.js carries the markup as ONE string (the @SOCHTML block) and puts it into a page's own header when it
   runs - but a button that appears after the deferred bundle lands slides the whole right cluster of the header, which is the
   layout-shift rule. So this writes the SAME string statically into every page that keeps its own header:
     - a page still carrying the retired Telegram + Instagram pair (`.htg` [+ `.hig`]): the pair is replaced in place;
     - a page with the `.hbot` Bot link and no socials (defi, exchanges, whales, cycle, calendar, etf + twins): inserted after it.
   Pages with a plain header are left alone - mp-nav rebuilds those from its template, which already carries the button.
   Idempotent (exactly one `.hsoc` per page afterwards); `--dry` reports only.
   Run: node build/add-social.js [--dry]   (build.js runs it after add-hdr-crit) */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');
const nav = fs.readFileSync(path.join(ROOT, 'dist', 'assets', 'mp-nav.js'), 'utf8');
const m = nav.match(/\/\* @SOCHTML \*\/\s*var SOC_HTML = '((?:[^'\\]|\\.)*)';/);
if (!m) throw new Error('SOC_HTML block not found in mp-nav.js');
const SOC = m[1].replace(/\\'/g, "'");
if (SOC.indexOf('class="hsoc"') < 0 || SOC.indexOf('class="hlink hsocb"') < 0 || SOC.indexOf('x.com/marginpad') < 0) throw new Error('SOC_HTML lost its shape');

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'assets' || e.name === 'widget' || e.name === 'embed') continue; walk(p, out); }
    else if (e.isFile() && p.endsWith('.html')) out.push(p);
  }
  return out;
}
const files = walk(path.join(ROOT, 'dist'), []);
for (const extra of ['app/index.html', 'dist/app.html', 'dist/app-es.html']) { const f = path.join(ROOT, extra); if (fs.existsSync(f) && files.indexOf(f) < 0) files.push(f); }

const count = (h, s) => h.split(s).length - 1;
let replaced = 0, added = 0, same = 0, skipped = 0, bad = 0;
for (const f of files) {
  let h = fs.readFileSync(f, 'utf8');
  if (h.indexOf('class="hsoc"') >= 0) { if (count(h, 'class="hsoc"') !== 1) { bad++; console.log('add-social: more than one .hsoc in', path.relative(ROOT, f)); } same++; continue; }
  let out = null;
  const t = h.indexOf('class="hlink htg"');
  if (t >= 0) {
    // the Telegram anchor runs from its own "<a " to the first "</a>" after the class; an Instagram anchor right after it goes too
    const a0 = h.lastIndexOf('<a ', t), a1 = h.indexOf('</a>', t);
    if (a0 < 0 || a1 < 0) { bad++; console.log('add-social: odd .htg anchor in', path.relative(ROOT, f)); continue; }
    let end = a1 + 4;
    const rest = h.slice(end);
    const ig = rest.match(/^\s*<a [^>]*class="hlink hig"[^>]*>[\s\S]*?<\/a>/);
    if (ig) end += ig[0].length;
    out = h.slice(0, a0) + SOC + h.slice(end);
    replaced++;
  } else {
    const b = h.indexOf('class="hlink hbot"');
    if (b < 0) { skipped++; continue; }
    const b1 = h.indexOf('</a>', b);
    if (b1 < 0) { bad++; console.log('add-social: odd .hbot anchor in', path.relative(ROOT, f)); continue; }
    out = h.slice(0, b1 + 4) + SOC + h.slice(b1 + 4);
    added++;
  }
  if (count(out, 'class="hsoc"') !== 1 || out.indexOf('class="hlink htg"') >= 0 || out.indexOf('class="hlink hig"') >= 0) { bad++; console.log('add-social: refused', path.relative(ROOT, f)); continue; }
  if (!DRY) fs.writeFileSync(f, out);
}
console.log('add-social: replaced the pair in ' + replaced + ', added after Bot in ' + added + ', already there ' + same + ', no static header ' + skipped + (bad ? ', REFUSED ' + bad : '') + (DRY ? ' (dry)' : ''));
if (bad) process.exitCode = 1;
