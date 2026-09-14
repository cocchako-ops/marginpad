/* RSS + JSON Feed for the blog (2026-09-14).
 *
 * Measured before writing it: 171 blog posts on the site and /feed.xml, /rss.xml, /atom.xml,
 * /blog/feed.xml and /feed/ all returned 404. A feed is how aggregators, Bing and several AI crawlers
 * find out that a site published something TODAY rather than waiting for a recrawl, and it is the only
 * surface another site can subscribe to. We had none.
 *
 * Two formats because they are read by different things: RSS 2.0 for readers and crawlers, JSON Feed
 * for anything modern (and it is trivially parseable by an assistant).
 *
 * Run: node build/gen-feed.js   (in build.js, after the blog generator)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://marginpad.io';
const MAX = 50;

const esc = s => String(s == null ? '' : s)
  .replace(/&(?![a-z#0-9]+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unent = s => String(s || '').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
  .replace(/-/g, '-').replace(/&ndash;/g, '–').replace(/&nbsp;/g, ' ').replace(/&hellip;/g, '…');
const meta = (h, re) => { const m = h.match(re); return m ? unent(m[1]).trim() : ''; };

function posts() {
  const dir = path.join(DIST, 'blog');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const f = path.join(dir, e.name, 'index.html');
    if (!fs.existsSync(f)) continue;
    const h = fs.readFileSync(f, 'utf8');
    if (/name="robots" content="[^"]*noindex/.test(h)) continue;
    // the date the post itself declares, not the file's mtime - a rebuild must not republish the lot
    const pub = meta(h, /"datePublished"\s*:\s*"([^"]+)"/) || meta(h, /<meta property="article:published_time" content="([^"]+)"/);
    const mod = meta(h, /"dateModified"\s*:\s*"([^"]+)"/) || pub;
    const title = meta(h, /<title>([^<]*)<\/title>/).replace(/\s*[|—–-]\s*MarginPad\s*$/, '');
    const desc = meta(h, /<meta name="description" content="([^"]*)"/);
    const img = meta(h, /<meta property="og:image" content="([^"]*)"/);
    if (!title || !pub) continue;
    out.push({ slug: e.name, url: SITE + '/blog/' + e.name + '/', title, desc, img, pub, mod });
  }
  return out.sort((a, b) => new Date(b.pub) - new Date(a.pub)).slice(0, MAX);
}

const p = posts();
if (!p.length) { console.log('gen-feed: no dated posts found - nothing written'); process.exit(0); }
const newest = p[0].pub;

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
<title>MarginPad</title>
<link>${SITE}/blog/</link>
<description>Crypto futures, explained with numbers: liquidations, funding, leverage and the tools to trade them. Free.</description>
<language>en</language>
<lastBuildDate>${new Date(newest).toUTCString()}</lastBuildDate>
<atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
<image><url>${SITE}/assets/og/home.jpg</url><title>MarginPad</title><link>${SITE}/</link></image>
${p.map(x => `<item>
<title>${esc(x.title)}</title>
<link>${esc(x.url)}</link>
<guid isPermaLink="true">${esc(x.url)}</guid>
<pubDate>${new Date(x.pub).toUTCString()}</pubDate>
<description>${esc(x.desc)}</description>
${x.img ? `<enclosure url="${esc(x.img)}" type="image/jpeg" />` : ''}
</item>`).join('\n')}
</channel>
</rss>
`;

const json = JSON.stringify({
  version: 'https://jsonfeed.org/version/1.1',
  title: 'MarginPad',
  home_page_url: SITE + '/blog/',
  feed_url: SITE + '/feed.json',
  description: 'Crypto futures, explained with numbers: liquidations, funding, leverage and the tools to trade them. Free.',
  icon: SITE + '/assets/og/home.jpg',
  language: 'en',
  items: p.map(x => ({
    id: x.url, url: x.url, title: x.title, summary: x.desc,
    image: x.img || undefined,
    date_published: new Date(x.pub).toISOString(),
    date_modified: new Date(x.mod).toISOString(),
  })),
}, null, 1);

fs.writeFileSync(path.join(DIST, 'feed.xml'), rss);
fs.writeFileSync(path.join(DIST, 'feed.json'), json);

/* A feed nobody can find is no feed: every page must declare it in <head>, and robots.txt must name it. */
let linked = 0;
const LINKS = '<link rel="alternate" type="application/rss+xml" title="MarginPad" href="' + SITE + '/feed.xml" />\n'
  + '<link rel="alternate" type="application/feed+json" title="MarginPad" href="' + SITE + '/feed.json" />\n';
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'assets' || e.name === 'i18n') continue; walk(f); continue; }
    if (!e.name.endsWith('.html')) continue;
    let h = fs.readFileSync(f, 'utf8');
    if (h.indexOf('application/rss+xml') >= 0) continue;
    const i = h.indexOf('</head>'); if (i < 0) continue;
    fs.writeFileSync(f, h.slice(0, i) + LINKS + h.slice(i));
    linked++;
  }
})(DIST);

const rp = path.join(DIST, 'robots.txt');
if (fs.existsSync(rp)) {
  let r = fs.readFileSync(rp, 'utf8');
  if (r.indexOf('/feed.xml') < 0) {
    // robots.txt has no Feed directive; the feed is declared in every page's <head>. This is a pointer
    // for a human reading robots.txt, written as a comment rather than an invented rule.
    r = r.trimEnd() + '\n\n# Feeds: ' + SITE + '/feed.xml  and  ' + SITE + '/feed.json\n';
    fs.writeFileSync(rp, r);
  }
}

console.log('gen-feed: ' + p.length + ' posts -> dist/feed.xml + dist/feed.json, newest ' + String(newest).slice(0, 10)
  + ', declared in <head> on ' + linked + ' page(s)');
