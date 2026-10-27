/* THE CRAWLER'S ENTRY FILES ANSWER 304 (2026-10-27, owner: "jos uvek nema poseta od claude AI").
   MEASURED first: ClaudeBot made 2,196 requests in 30 days and 1,933 of them (88%) were robots.txt and the four
   sitemaps, re-downloaded whole about every two hours, while /paper-trade got 16 and most of the 972 urls those
   sitemaps declare got none. This proves the fix: every entry file carries an ETag, honours If-None-Match with a
   bodyless 304, ignores a wrong tag, and keeps the content a crawler came for. Plus the telemetry blind spot:
   Claude-SearchBot (Claude's own search indexer) and Google-CloudVertexBot (Gemini's grounding fetcher) must be in
   the aibot regex, or "that crawler never came" is a statement we cannot make.
   node build/crawl-budget-e2e.js          --pure = the regex + robots.txt checks only (no network)               */
'use strict';
const fs = require('fs'), path = require('path');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const PURE = process.argv.indexOf('--pure') >= 0;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
const UA = 'ClaudeBot/1.0 (+claudebot@anthropic.com)';

// the five files ClaudeBot polls, plus the llms trio an assistant reads; maxAge = the floor we require
const FILES = [
  { p: '/robots.txt', min: 3600, want: 'Sitemap:' },
  { p: '/sitemap.xml', min: 21600, want: '<urlset' },
  { p: '/sitemap-es.xml', min: 21600, want: '<urlset' },
  { p: '/sitemap-recaps.xml', min: 21600, want: '<urlset' },
  { p: '/community/sitemap.xml', min: 21600, want: '<urlset' },
  { p: '/llms.txt', min: 3600, want: 'MarginPad' },
  { p: '/llms-full.txt', min: 3600, want: 'MarginPad' },
  { p: '/llms-changelog.txt', min: 3600, want: 'MarginPad' },
];

(async () => {
  console.log('-- pure: the telemetry regex and robots.txt');
  const m = src.match(/const m9 = ua9\.match\((\/[^\n]*?\/i)\);/);
  ok(!!m, 'the aibot token regex is in the worker');
  if (m) {
    const re = new Function('return ' + m[1])();
    const cases = [
      ['Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +claudebot@anthropic.com)', 'claude-searchbot'],
      ['Mozilla/5.0 (compatible; Google-CloudVertexBot/1.0)', 'google-cloudvertexbot'],
      ['Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'claudebot'],
      ['Claude-User/1.0; +Claude-User@anthropic.com', 'claude-user'],
      ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'googlebot'],
      ['Mozilla/5.0 (compatible; Bravebot/1.0)', 'bravebot'],
    ];
    for (const [ua, want] of cases) { const g = (ua.match(re) || [])[0]; ok(g && g.toLowerCase() === want, 'UA "' + ua.slice(0, 34) + '" records as ' + want + ' (got ' + (g ? g.toLowerCase() : 'NOTHING') + ')'); }
    // a token that falls through is recorded NOWHERE - that is the blind spot this round found
    ok(!re.test('Mozilla/5.0 (compatible; SomeFutureBot/1.0)'), 'an unknown crawler is not mis-recorded as a known one');
  }
  const rb = fs.readFileSync(path.join(__dirname, '..', 'dist', 'robots.txt'), 'utf8');
  for (const t of ['Claude-SearchBot', 'ClaudeBot', 'Claude-User', 'Bravebot', 'Google-CloudVertexBot', 'GPTBot', 'OAI-SearchBot']) ok(new RegExp('^User-agent: ' + t + '$', 'mi').test(rb), 'robots.txt names ' + t);
  ok((rb.match(/^Sitemap: /mg) || []).length >= 4, 'robots.txt still declares every sitemap (' + (rb.match(/^Sitemap: /mg) || []).length + ')');
  ok(/^Disallow: \/api\/$/m.test(rb) && /^Allow: \/api\/v1\/$/m.test(rb), 'the /api/ rule and its Allow lines survive');
  if (PURE) { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }

  console.log('-- live: conditional requests');
  for (const f of FILES) {
    const r1 = await fetch(O + f.p, { headers: { 'user-agent': UA } });
    const body = await r1.text();
    const tag = r1.headers.get('etag') || '';
    const cc = r1.headers.get('cache-control') || '';
    const age = +((cc.match(/max-age=(\d+)/) || [])[1] || 0);
    ok(r1.status === 200 && body.indexOf(f.want) >= 0, f.p + ' serves the content a crawler came for (' + r1.status + ', ' + body.length + 'B)');
    ok(/^"?[0-9a-f]{8,}"?$/.test(tag.replace(/^W\//, '')), f.p + ' carries a content ETag (' + (tag || 'NONE') + ')');
    ok(age >= f.min, f.p + ' tells a crawler to come back no sooner than ' + f.min + 's (max-age=' + age + ')');
    if (!tag) { fail++; console.log('  FAIL ' + f.p + ': no ETag, so the conditional checks cannot run'); continue; }
    const r2 = await fetch(O + f.p, { headers: { 'user-agent': UA, 'if-none-match': tag } });
    const b2 = await r2.text();
    ok(r2.status === 304 && b2.length === 0, f.p + ' answers 304 with NO body when the tag matches (' + r2.status + ', ' + b2.length + 'B)');
    // compare NORMALISED: Cloudflare weakens a strong tag when it compresses, so the two answers must agree once W/ is stripped
    const bare = tag.replace(/^W\//, '');
    ok((r2.headers.get('etag') || '').replace(/^W\//, '') === bare, f.p + ' repeats the same tag on the 304 (200 ' + tag + ' vs 304 ' + r2.headers.get('etag') + ')');
    // both forms of our own tag, and a list of tags, must still match
    const r2w = await fetch(O + f.p, { headers: { 'user-agent': UA, 'if-none-match': bare } });
    ok(r2w.status === 304, f.p + ' honours the strong form of its own tag (' + r2w.status + ')');
    const r2l = await fetch(O + f.p, { headers: { 'user-agent': UA, 'if-none-match': '"deadbeefdeadbeef", W/' + bare } });
    ok(r2l.status === 304, f.p + ' honours a list of tags (' + r2l.status + ')');
    // THE LOAD-BEARING OTHER HALF: a stale tag must still get the file, or a crawler would never see a change
    const r3 = await fetch(O + f.p, { headers: { 'user-agent': UA, 'if-none-match': '"0000000000000000"' } });
    const b3 = await r3.text();
    ok(r3.status === 200 && b3.length === body.length, f.p + ' still serves the body for a stale tag (' + r3.status + ', ' + b3.length + 'B)');
  }
  // the content must not have changed shape: the sitemap still declares its urls and the fresh-stamp still runs
  const sm = await fetch(O + '/sitemap.xml', { headers: { 'user-agent': UA } });
  const smx = await sm.text();
  ok((smx.match(/<url>/g) || []).length > 400, 'sitemap.xml still declares its urls (' + (smx.match(/<url>/g) || []).length + ')');
  ok(+(sm.headers.get('x-mp-sitemap-fresh') || 0) > 0, 'the daily lastmod stamp still runs (' + sm.headers.get('x-mp-sitemap-fresh') + ')');
  const today = new Date().toISOString().slice(0, 10);
  ok(smx.indexOf('<lastmod>' + today + '</lastmod>') >= 0, 'the daily entries carry today (' + today + ')');
  // every Claude and Gemini agent must still get the real page - delivery was never the fault and must not become one
  for (const ua of ['ClaudeBot/1.0', 'Claude-User/1.0', 'Claude-SearchBot/1.0', 'Mozilla/5.0 (compatible; Google-CloudVertexBot/1.0)', 'Mozilla/5.0 (compatible; Googlebot/2.1)']) {
    const r = await fetch(O + '/paper-trade', { headers: { 'user-agent': ua } });
    const t = await r.text();
    ok(r.status === 200 && /<title>[^<]*Paper Trading/i.test(t), ua.slice(0, 30) + ' still gets the full page (' + r.status + ', ' + t.length + 'B)');
  }
  // THE READ THAT SAYS WHETHER THIS WORKED. Its AE query must come back non-empty: ordering by the raw `timestamp`
  // column instead of the alias makes the AE SQL API answer an EMPTY SET WITH NO ERROR, which read as "no crawler has
  // ever come" on the day this shipped. And the route must refuse to publish an estimate it cannot calibrate.
  const K = fs.existsSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt')) ? fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim() : '';
  if (K) {
    const ac = await (await fetch(O + '/api/admin/aiclicks?days=30', { headers: { 'x-admin-key': K } })).json();
    ok(ac && Array.isArray(ac.crawlHealth) && ac.crawlHealth.length > 0, 'the crawl-health read returns rows (the AE query is not silently empty)');
    ok(ac && ac.coveragePct > 0 && ac.pathsSampled > 0, 'it sampled real paths (coverage ' + (ac && ac.coveragePct) + '%, paths ' + (ac && ac.pathsSampled) + ')');
    const cb = (ac.crawlHealth || []).find(h => h.bot === 'claudebot');
    ok(!!cb && typeof cb.pagePct === 'number', 'claudebot has a page share - the number this round exists to move (' + (cb ? cb.pagePct + '%' : 'MISSING') + ')');
    ok(ac && ac.calib && typeof ac.calib.verdict === 'string' && typeof ac.calib.trustworthy === 'boolean', 'the estimator states its own verdict and whether it may be trusted');
    ok(ac && ac.calib && (ac.calib.trustworthy === true || /REJECTED|uncalibrated/.test(ac.calib.verdict)), 'an estimator that fails its ChatGPT calibration says REJECTED instead of publishing a figure');
  } else console.log('  (no admin key - skipped the ops read checks)');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
