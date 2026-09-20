// EVERY INTERNAL LINK ON THE SITE, asked of production. Nothing else does this: seo-surface-e2e checks the
// first 40 sitemap URLs and the AI layer's 124, and the sitemap is a list of pages we MEANT to publish - not of
// the links readers can actually click. A 404 behind a link on a live page is invisible until someone clicks it.
const fs = require('fs'), path = require('path');
const DIST = 'D:/part1/money-mission/dist';
const B = 'https://marginpad.io';

const pages = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['assets', 'og', 'img', 'fonts', 'sdk', 'i18n'].includes(e.name)) walk(p); }
    else if (e.name.endsWith('.html')) pages.push(p);
  }
})(DIST);

const found = new Map();                       // path -> a page that links it
for (const f of pages) {
  let s = ''; try { s = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  // only real anchors in markup; a href inside a script string is not a link a reader can click
  const re = /<a\b[^>]*\bhref\s*=\s*"(\/[^"#?]*)"/g; let m;
  while ((m = re.exec(s))) {
    const u = m[1];
    if (!u || u.startsWith('//') || u.startsWith('/api/') || u.startsWith('/assets/')) continue;
    // an href being BUILT by a script is not a link a reader can click - '/'+esc(sym)+'-liquidation-map/'
    if (u.indexOf("'") >= 0 || u.indexOf('+') >= 0 || u.indexOf('${') >= 0) continue;
    if (/\.(png|jpe?g|svg|webp|ico|css|js|json|xml|txt|gz|csv)$/i.test(u)) continue;
    if (!found.has(u)) found.set(u, f.slice(DIST.length + 1));
  }
}

const list = [...found.keys()].sort();
console.log('unique internal link targets: ' + list.length + ' (from ' + pages.length + ' pages)\n');

(async () => {
  const bad = [];
  let done = 0;
  const work = list.slice();
  const run = async () => {
    while (work.length) {
      const u = work.shift();
      let st = 0, loc = '';
      try {
        const r = await fetch(B + u, { method: 'GET', redirect: 'manual', headers: { 'user-agent': 'marginpad-linkcheck' } });
        st = r.status; loc = r.headers.get('location') || '';
      } catch (e) { st = -1; loc = String(e.message).slice(0, 60); }
      done++;
      if (st >= 400 || st === -1) bad.push({ u, st, loc, from: found.get(u) });
      else if (st >= 300 && st < 400) bad.push({ u, st, loc, from: found.get(u), redirect: true });
    }
  };
  await Promise.all(Array.from({ length: 12 }, run));

  const broken = bad.filter(x => !x.redirect);
  const reds = bad.filter(x => x.redirect);
  console.log('BROKEN (' + broken.length + '):');
  broken.forEach(x => console.log('  ' + String(x.st).padStart(4) + '  ' + x.u + '   linked from ' + x.from));
  console.log('\nREDIRECTS (' + reds.length + ') - a link should point at the destination, not at a hop:');
  reds.slice(0, 25).forEach(x => console.log('  ' + x.st + '  ' + x.u + '  ->  ' + x.loc.replace(B, '') + '   from ' + x.from));
  if (reds.length > 25) console.log('  ... and ' + (reds.length - 25) + ' more');
})();
