// THE HEADER'S FIRST FRAME IS ITS LAST FRAME (2026-10-27, owner: "kad se krece korisnik sa stranice na stranicu, da
// elementi ne skacu ... na sekundu budu na jednom mestu pa kad se full load page malo mrdnu").
//
// mp-nav.js (deferred, on every standalone page) restyles the page header when it lands: the mobile sticky bar with its
// notch padding, the canonical desktop header normalizeHeader() turns a plain page header into (15/28 padding,
// full-bleed, sticky), the 30px globe in place of the language select. Every page's own CSS drew the header some other
// size first, so everything under it jumped the moment the bundle arrived - measured 23px on a coin page / blog post /
// liquidation page / the API page, 44px on /funding/, 46px on a phone, +19px on the phone homepage.
//
// This inlines the SAME rules (lifted from mp-nav.js between its @HDRCRIT markers - one source, two readers) into every
// page's <head> under a first-paint selector that is true exactly where normalizeHeader() will act: a header already
// carrying .mpnav-hdr, or a plain one (no .hbot sentinel, no widget inside). `:is()` keeps the list forgiving, so a
// browser without `:has()` drops only that member and keeps the rest.
//
// Idempotent (replaces its own <style id="mpHdrCrit">), walks dist/ (every page that loads mp-nav.js, embeds excluded)
// and app/index.html + dist/app.html + dist/app-es.html (the app shell loads mp-nav too). `--dry` reports only.
// <meta charset> stays the first tag in <head>: the block goes right before </head>.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DRY = process.argv.includes('--dry');
const ID = 'mpHdrCrit';

function hdrCritCss() {
  const src = fs.readFileSync(path.join(DIST, 'assets', 'mp-nav.js'), 'utf8');
  const a = src.indexOf('/* @HDRCRIT */'), b = src.indexOf('/* @/HDRCRIT */');
  if (a < 0 || b < a) throw new Error('add-hdr-crit: @HDRCRIT markers not found in mp-nav.js');
  const block = src.slice(a + '/* @HDRCRIT */'.length, b);
  const NOT = ':not(:has(.hbot,input,form,canvas,table,.tabs,[role="tablist"]))';
  const alt = ':is(header.mpnav-hdr,body>.wrap>header' + NOT + ',body>header' + NOT + ')';
  const css = new Function(block + '\nreturn hdrCss(HDR_CRIT, [ALT]);'.replace('ALT', JSON.stringify(alt)))();
  if (!css || css.indexOf('HDRSEL') >= 0 || css.length < 1500) throw new Error('add-hdr-crit: expansion failed');
  if (css.indexOf('</') >= 0) throw new Error('add-hdr-crit: the css would close the style tag');
  return css;
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'assets' || e.name === 'widget' || e.name === 'embed') continue; walk(p, out); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function patch(f, tag) {
  let html = fs.readFileSync(f, 'utf8');
  if (!html.includes('mp-nav.js')) return 'nonav';
  if (!/<\/head>/i.test(html)) return 'nohead';
  const re = new RegExp('<style id="' + ID + '">[\\s\\S]*?<\\/style>\\n?', 'g');
  const had = re.test(html);
  let out = html.replace(re, '');
  const i = out.search(/<\/head>/i);
  out = out.slice(0, i) + tag + '\n' + out.slice(i);
  // the charset prescan rule: <meta charset> must still be the first tag of <head>
  const headOpen = out.search(/<head[^>]*>/i); const after = out.slice(headOpen).replace(/<head[^>]*>/i, '').trimStart();
  if (!/^<meta charset/i.test(after)) return 'charset-order';
  if (out === html) return had ? 'same' : 'same';
  if (!DRY) fs.writeFileSync(f, out);
  return had ? 'replaced' : 'added';
}

const css = hdrCritCss();
const tag = '<style id="' + ID + '">' + css + '</style>';
const files = walk(DIST, []);
for (const extra of [path.join(ROOT, 'app', 'index.html')]) if (fs.existsSync(extra)) files.push(extra);
const stat = {};
for (const f of files) { const r = patch(f, tag); stat[r] = (stat[r] || 0) + 1; if (r === 'charset-order' || r === 'nohead') console.log(r, path.relative(ROOT, f)); }
console.log('add-hdr-crit:', JSON.stringify(stat), 'css', css.length, 'bytes', DRY ? '(dry)' : '');
