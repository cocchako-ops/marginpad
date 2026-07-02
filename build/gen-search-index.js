/* dist/search-index.json — a flat [{t:title,u:url}] index of every content page, built by scanning dist for index.html
   <title>s. The Browse search (homepage + the shared mp-nav drawer) lazy-loads it and suggests matching pages/guides
   as the user types. Auto-maintained: any new page with a <title> shows up next build. Skips language-variant dirs. */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const LANG = /^(es|de|fr|pt|ru|tr|zh|ja|ko|ar|id|nl|sv|no|da|fi|it|pl)$/i;

const out = [];
function clean(t) {
  return t.replace(/\s*[|·—–-]\s*MarginPad.*$/i, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim();
}
function walk(dir, rel) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  // skip language-variant directories and assets
  const segs = rel.split('/').filter(Boolean);
  if (segs.some(s => LANG.test(s))) return;
  if (segs[0] === 'assets') return;
  for (const e of ents) {
    if (e.isDirectory()) walk(path.join(dir, e.name), rel + '/' + e.name);
    else if (e.name === 'index.html') {
      try {
        const html = fs.readFileSync(path.join(dir, e.name), 'utf8');
        // skip noindex pages (e.g. private/admin) from the public suggestions
        if (/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(html)) continue;
        const m = html.match(/<title>([^<]+)<\/title>/i);
        if (!m) continue;
        const t = clean(m[1]);
        if (!t || t.length < 3) continue;
        const u = (rel === '' ? '/' : rel + '/');
        out.push({ t, u });
      } catch (e) {}
    }
  }
}
walk(DIST, '');

// de-dupe by url, sort shorter/cleaner titles first, cap to keep the file small
const seen = {};
const list = out.filter(x => (seen[x.u] ? false : (seen[x.u] = 1)));
list.sort((a, b) => a.u.length - b.u.length);
fs.writeFileSync(path.join(DIST, 'search-index.json'), JSON.stringify(list));
console.log('wrote dist/search-index.json — ' + list.length + ' pages indexed');
