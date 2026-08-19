/* Stamp dateModified onto indexable pages that carry no freshness signal.

   Measured 2026-08-19: only 113 of 445 indexable pages (25%) publish a date, and all of them are blog
   articles. Calculators, comparisons, hubs and landing pages publish nothing. That matters more for AI
   assistants than for Google — asked a question about a fast-moving market, an assistant choosing between
   two sources will prefer the one that says when it was last checked, and ours mostly do not say.

   The date is the FILE'S OWN mtime, not the build date and not today. A page that has not changed in three
   months should say so; stamping everything with today's date would be a lie that happens to look good,
   and the whole point of the signal is that it can be trusted. Pages already carrying dateModified or
   datePublished are left completely alone.

   Idempotent: re-running rewrites the stamp in place rather than adding a second one, so it can sit in the
   build pipeline. Run: node build/add-datemodified.js */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const MARK_OPEN = '<!--dm-->';
const MARK_CLOSE = '<!--/dm-->';

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === 'assets' || e.name === 'node_modules') continue;
      walk(path.join(dir, e.name), out);
    } else if (e.name === 'index.html') {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

let stamped = 0, skippedHasDate = 0, skippedNoindex = 0, refreshed = 0;

for (const file of walk(DIST, [])) {
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }

  if (/noindex/.test(html.slice(0, 3000))) { skippedNoindex++; continue; }

  const already = new RegExp(MARK_OPEN).test(html);
  if (!already && /"dateModified"|"datePublished"/.test(html)) { skippedHasDate++; continue; }

  // strip a previous stamp so re-runs update rather than accumulate
  if (already) {
    html = html.replace(new RegExp(MARK_OPEN + '[\\s\\S]*?' + MARK_CLOSE), '');
    refreshed++;
  }

  const url = 'https://marginpad.io/' + path.relative(DIST, path.dirname(file)).replace(/\\/g, '/') + '/';
  const mtime = fs.statSync(file).mtime.toISOString();

  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'MarginPad';
  const ld = MARK_OPEN + '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title.replace(/\s*\|\s*MarginPad\s*$/, '').trim(),
    url: url.replace('//', '/').replace('https:/', 'https://'),
    dateModified: mtime,
    isPartOf: { '@type': 'WebSite', name: 'MarginPad', url: 'https://marginpad.io/' },
    publisher: { '@type': 'Organization', name: 'MarginPad', url: 'https://marginpad.io/' },
  }) + '</script>' + MARK_CLOSE;

  if (!/<\/head>/.test(html)) continue;
  html = html.replace('</head>', ld + '</head>');
  fs.writeFileSync(file, html);
  stamped++;
}

console.log('dateModified: stamped ' + stamped + ' page(s) (' + refreshed + ' refreshed), '
  + skippedHasDate + ' already dated, ' + skippedNoindex + ' noindex');
