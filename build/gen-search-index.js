/* dist/search-index.json - a flat [{t:title,u:url}] index of every content page, built by scanning dist for index.html
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
/* Words that carry no search intent. Deliberately SHORT and deliberately missing "free", "best", "live" and
   "new" - on this site those are real search terms ("free api", "best paper trading"), not noise. */
const STOP = new Set(('a an and are as at be been but by can cant do does doing for from had has have how i if in'
  + ' into is it its me my no nor not of off on once only or other our out over own same so some such than that'
  + ' the their them then there these they this those to too under until up very was we were what when where'
  + ' which while who whom why will with without you your yours').split(' '));
const MAXKW = 170;              // per page; the whole file is fetched on the first keystroke
function kw(title, desc) {
  const seenW = new Set(String(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean));
  const words = String(desc).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ');
  const keep = [];
  let len = 0;
  for (const w of words) {
    if (w.length < 2 || STOP.has(w) || seenW.has(w)) continue;   // nothing the title already answers for
    seenW.add(w);
    if (len + w.length + 1 > MAXKW) break;
    keep.push(w); len += w.length + 1;
  }
  return keep.length ? { k: keep.join(' ') } : null;
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
        // KEYWORDS FROM THE PAGE'S OWN DESCRIPTION (2026-10-18, owner: "sta god korisnik da kuca, ako imamo
        // negde tu rec, treba da mu preporuci"). The index held the TITLE and nothing else, so a reader typing
        // a word the page is about rather than named after - "order book", "seed phrase", "rebate" - got
        // nothing. Measured before: 116 of 133 realistic queries found something. The description is the one
        // sentence every page already has that states what it is about, and it is already written for readers.
        // Compacted hard, because this file is fetched whole on the first keystroke: lowercased, punctuation
        // dropped, stop-words dropped, anything already in the title dropped, deduped, capped.
        const dm = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i);
        out.push(Object.assign({ t, u }, dm ? kw(t, clean(dm[1])) : null));
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
console.log('wrote dist/search-index.json - ' + list.length + ' pages indexed');
