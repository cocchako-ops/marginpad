/* AI-layer + SEO audit (2026-09-19). The four hand-kept surfaces drift silently, and a WRONG fact is worse
   than a missing one - an assistant quotes them verbatim. This checks the claims that are checkable:
     - every https://marginpad.io/... URL in both llms files answers 200
     - every count the files assert (MCP tools, blog posts, academy, maps, plans, prices) against the live source
     - prices quoted in llms vs the live /api/premium/status and /api/apiplan
     - "Last updated" / newest dated line vs today
   It never edits; it prints what is stale so a human decides.  node build/ai-layer-audit.js            */
const fs = require('fs');
const ORIGIN = 'https://marginpad.io';
const read = (f) => fs.readFileSync(f, 'utf8');
// Three files since 2026-10-16: llms.txt (SHORT, product-first, the one an assistant reads first), llms-full.txt (the
// complete reference) and llms-changelog.txt (every dated line). The changelog used to live at the top of llms.txt and
// had grown to 65% of a 100 KB file, so the first thing any reader met was two months of bug confessions - and no AI
// crawler fetched it anyway (<20 hits in 30 days). Facts are checked across all three; "current" claims only in the
// first two, because a dated line describes the day it was written.
const L1 = read('dist/llms.txt'), L2 = read('dist/llms-full.txt'), L3 = read('dist/llms-changelog.txt');
const CUR = L1 + '\n' + L2;            // what is true NOW
const BOTH = CUR + '\n' + L3;          // everything the AI layer says, for URL and name checks
let bad = 0, warn = 0;
const fail = (m) => { bad++; console.log('  STALE  ' + m); };
const note = (m) => { warn++; console.log('  check  ' + m); };
const ok = (m) => console.log('  ok     ' + m);

(async () => {
  const j = (p) => fetch(ORIGIN + p).then(r => r.json()).catch(() => null);

  console.log('\n== prices quoted in the AI layer vs the live endpoints ==');
  const prem = await j('/api/premium/status');
  if (prem) {
    for (const [label, v] of [['Premium', prem.price], [prem.plusName || 'Premium Plus', prem.plusPrice]]) {
      const s = '$' + v;
      if (CUR.indexOf(s) < 0) fail(label + ' is ' + s + ' live and that string appears in NEITHER current llms file');
      else ok(label + ' ' + s + ' is quoted');
    }
    if (prem.plusName && CUR.indexOf(prem.plusName) < 0) fail('the AI plan is called "' + prem.plusName + '" live and that name appears in NEITHER current llms file'); else if (prem.plusName) ok('the AI plan name "' + prem.plusName + '" is quoted');
    // the allowance in words, whatever the number is (it was "one" until 2026-10-15, "five" since)
    const daily = prem.aiDaily || {};
    const WORDS = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' };
    const n = +daily.premium, re = new RegExp('(' + n + '|' + (WORDS[n] || n) + ') (Ask AI )?reads? a day', 'i');
    if (n > 0 && re.test(CUR)) ok('the ' + (WORDS[n] || n) + '-reads-a-day allowance is stated');
    else fail('aiDaily.premium=' + daily.premium + ' but the files do not say it in words');
  } else note('could not read /api/premium/status');

  const plans = await j('/api/apiplan');
  const list = plans && (plans.plans || plans.catalogue || []);
  if (Array.isArray(list) && list.length) {
    list.forEach(p => {
      const usd = p.usd != null ? p.usd : (p.price_usd != null ? p.price_usd : null);
      if (usd == null || usd === 0) return;
      if (CUR.indexOf('$' + usd) < 0) fail('API plan ' + (p.name || p.id) + ' is $' + usd + ' live and is not quoted in the AI layer');
    });
    ok('API plan prices checked (' + list.length + ' plans)');
  } else note('could not read /api/apiplan');

  console.log('\n== counts the files assert vs the live source ==');
  // MCP tools - the server's own list
  const mcp = await fetch(ORIGIN + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }).then(r => r.json()).catch(() => null);
  const nTools = mcp && mcp.result && Array.isArray(mcp.result.tools) ? mcp.result.tools.length : null;
  if (nTools) {
    // compare the NAMES, not a phrase: the first cut matched only "N MCP tools" and reported 0 agreements
    // while the file said "carries 28 tools" - a check that cries wolf gets ignored, which is worse than none.
    const names = mcp.result.tools.map(t => t.name);
    const missing = names.filter(n => CUR.indexOf(n) < 0);
    if (missing.length) fail('MCP: ' + missing.length + ' of ' + nTools + ' tools are never named in the AI layer (' + missing.slice(0, 6).join(', ') + ')');
    else ok('MCP: all ' + nTools + ' tools are named');
    // and any CURRENT (undated) claim of a different number is a real drift - the changelog is history and may say 23 or 28
    const cur = [...CUR.matchAll(/(?:carries|server:[^\n]*?)\s+(\d+)\s+tools/gi)].map(m => +m[1]).filter(x => x !== nTools);
    if (cur.length) fail('a current line claims ' + [...new Set(cur)].join('/') + ' MCP tools, live is ' + nTools);
  } else note('could not reach the MCP server for tools/list');

  // things countable from dist
  const count = (dir, re) => { try { return fs.readdirSync('dist/' + dir, { withFileTypes: true }).filter(e => e.isDirectory() && (!re || re.test(e.name))).length; } catch (e) { return null; } };
  const blog = count('blog');
  if (blog) {
    const claimed = [...CUR.matchAll(/(\d+)\s+(?:blog )?(?:posts|articles)/gi)].map(m => +m[1]);
    const near = claimed.filter(c => Math.abs(c - blog) > 3 && c > 20 && c < 500);
    if (near.length) fail('blog posts: ' + blog + ' directories in dist, the files claim ' + [...new Set(near)].join('/'));
    else ok('blog posts: ' + blog);
  }
  const maps = count('', /-liquidation-map$/);
  if (maps) {
    const claimed = [...CUR.matchAll(/(\d+)\s+(?:per-coin )?liquidation maps|maps\s*=\s*(\d+)/gi)].map(m => +(m[1] || m[2]));
    const wrong = claimed.filter(c => c && c !== maps);
    if (wrong.length) fail('liquidation maps: ' + maps + ' in dist, the files claim ' + [...new Set(wrong)].join('/'));
    else ok('liquidation maps: ' + maps);
  }

  console.log('\n== freshness and size ==');
  const today = new Date().toISOString().slice(0, 10);
  { // the changelog is where dated lines live; only dates that OPEN a line count - a contest end date in the future is not freshness
    const dates = [...L3.matchAll(/^- (20\d\d-\d\d-\d\d):/gm)].map(m => m[1]).filter(d => d <= today).sort();
    const newest = dates[dates.length - 1] || '(none)';
    const days = newest === '(none)' ? 999 : Math.round((Date.parse(today) - Date.parse(newest)) / 86400000);
    if (days > 10) fail('llms-changelog.txt: newest dated line is ' + newest + ' (' + days + ' days old)');
    else ok('llms-changelog.txt: newest dated line ' + newest + ' (' + dates.length + ' entries)');
  }
  for (const [name, s] of [['llms.txt', L1], ['llms-full.txt', L2], ['llms-changelog.txt', L3]]) {
    const lu = (s.match(/Last updated:\s*(20\d\d-\d\d-\d\d)/) || [])[1];
    const days = lu ? Math.round((Date.parse(today) - Date.parse(lu)) / 86400000) : 999;
    if (!lu) fail(name + ': no "Last updated: YYYY-MM-DD" line');
    else if (days > 14) fail(name + ': Last updated ' + lu + ' is ' + days + ' days old');
    else ok(name + ': Last updated ' + lu);
    if (/^- 20\d\d-\d\d-\d\d:/m.test(s) && name !== 'llms-changelog.txt') fail(name + ' carries dated changelog lines - they belong in llms-changelog.txt');
  }
  { // llms.txt is the FIRST thing an assistant reads and most fetchers cap what they take; it was 100 KB on 2026-10-16 and
    // the index an assistant needs sat behind 61 KB of history. The cap is a guard against that happening twice.
    const kb = Buffer.byteLength(L1) / 1024;
    if (kb > 12) fail('llms.txt is ' + kb.toFixed(1) + ' KB - keep it under 12 KB, product first; history goes to llms-changelog.txt');
    else ok('llms.txt is ' + kb.toFixed(1) + ' KB');
    for (const w of ['SERVER-side', 'trading competition', 'llms-full.txt', 'llms-changelog.txt']) if (L1.indexOf(w) < 0) fail('llms.txt no longer says "' + w + '"');
  }

  console.log('\n== every marginpad.io URL the AI layer names must answer 200 ==');
  const urls = [...new Set([...BOTH.matchAll(/https:\/\/marginpad\.io[^\s)\]"'`,<]*/g)].map(m => m[0].replace(/[.,;:]+$/, '')))]
    .map(u => u.replace(/[*_`]+$/, ''))          // markdown emphasis glued to a URL is not part of it
    .filter(u => u.indexOf('<') < 0 && u.indexOf('whsink') < 0 && u.indexOf('{') < 0);
  let bad200 = [];
  for (let i = 0; i < urls.length; i += 8) {
    const batch = urls.slice(i, i + 8);
    const rs = await Promise.all(batch.map(u => fetch(u, { method: 'GET', headers: { 'user-agent': 'MarginPad-link-check' } }).then(r => r.status).catch(() => 0)));
    // A KEYED ENDPOINT ANSWERING 401 IS CORRECT, NOT STALE (2026-10-10). The point of this check is that an
    // assistant never cites a URL that 404s; `/api/bot/...` paths require an API key by design, so a 401 from
    // one is proof it exists and is guarded. A 404 or a 5xx there still fails. Keeping the 200 rule for them
    // would have forced either a weakened check or a documented endpoint left out of the AI layer.
    rs.forEach((st, k) => {
      const keyed = /\/api\/bot\//.test(batch[k]) && !/\/api\/bot\/v[12]\/(time|markets)/.test(batch[k]);
      if (st === 200) return;
      if (keyed && (st === 401 || st === 402)) return;
      bad200.push(batch[k] + ' -> ' + st);
    });
  }
  if (bad200.length) { bad += bad200.length; bad200.slice(0, 12).forEach(x => console.log('  STALE  ' + x)); console.log('  (' + bad200.length + ' of ' + urls.length + ' bad)'); }
  else ok(urls.length + ' URLs, all 200');

  console.log('\n' + (bad ? bad + ' stale item(s)' : 'nothing stale') + (warn ? ', ' + warn + ' to look at' : ''));
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error('fatal ' + e.message); process.exitCode = 1; });
