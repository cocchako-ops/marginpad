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
const L1 = read('dist/llms.txt'), L2 = read('dist/llms-full.txt');
const BOTH = L1 + '\n' + L2;
let bad = 0, warn = 0;
const fail = (m) => { bad++; console.log('  STALE  ' + m); };
const note = (m) => { warn++; console.log('  check  ' + m); };
const ok = (m) => console.log('  ok     ' + m);

(async () => {
  const j = (p) => fetch(ORIGIN + p).then(r => r.json()).catch(() => null);

  console.log('\n== prices quoted in the AI layer vs the live endpoints ==');
  const prem = await j('/api/premium/status');
  if (prem) {
    for (const [label, v] of [['Premium', prem.price], ['Premium Plus', prem.plusPrice]]) {
      const s = '$' + v;
      if (BOTH.indexOf(s) < 0) fail(label + ' is ' + s + ' live and that string appears in NEITHER llms file');
      else ok(label + ' ' + s + ' is quoted');
    }
    const daily = prem.aiDaily || {};
    if (String(daily.premium) === '1' && /one (Ask AI )?read a day|1 read a day|one read a day/i.test(BOTH)) ok('the one-read-a-day allowance is stated');
    else fail('aiDaily.premium=' + daily.premium + ' but the files do not say it in words');
  } else note('could not read /api/premium/status');

  const plans = await j('/api/apiplan');
  const list = plans && (plans.plans || plans.catalogue || []);
  if (Array.isArray(list) && list.length) {
    list.forEach(p => {
      const usd = p.usd != null ? p.usd : (p.price_usd != null ? p.price_usd : null);
      if (usd == null || usd === 0) return;
      if (BOTH.indexOf('$' + usd) < 0) fail('API plan ' + (p.name || p.id) + ' is $' + usd + ' live and is not quoted in the AI layer');
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
    const missing = names.filter(n => BOTH.indexOf(n) < 0);
    if (missing.length) fail('MCP: ' + missing.length + ' of ' + nTools + ' tools are never named in the AI layer (' + missing.slice(0, 6).join(', ') + ')');
    else ok('MCP: all ' + nTools + ' tools are named');
    // and any CURRENT (undated) claim of a different number is a real drift
    const cur = [...BOTH.matchAll(/carries\s+(\d+)\s+tools/gi)].map(m => +m[1]).filter(x => x !== nTools);
    if (cur.length) fail('a current line claims ' + [...new Set(cur)].join('/') + ' MCP tools, live is ' + nTools);
  } else note('could not reach the MCP server for tools/list');

  // things countable from dist
  const count = (dir, re) => { try { return fs.readdirSync('dist/' + dir, { withFileTypes: true }).filter(e => e.isDirectory() && (!re || re.test(e.name))).length; } catch (e) { return null; } };
  const blog = count('blog');
  if (blog) {
    const claimed = [...BOTH.matchAll(/(\d+)\s+(?:blog )?(?:posts|articles)/gi)].map(m => +m[1]);
    const near = claimed.filter(c => Math.abs(c - blog) > 3 && c > 20 && c < 500);
    if (near.length) fail('blog posts: ' + blog + ' directories in dist, the files claim ' + [...new Set(near)].join('/'));
    else ok('blog posts: ' + blog);
  }
  const maps = count('', /-liquidation-map$/);
  if (maps) {
    const claimed = [...BOTH.matchAll(/(\d+)\s+(?:per-coin )?liquidation maps|maps\s*=\s*(\d+)/gi)].map(m => +(m[1] || m[2]));
    const wrong = claimed.filter(c => c && c !== maps);
    if (wrong.length) fail('liquidation maps: ' + maps + ' in dist, the files claim ' + [...new Set(wrong)].join('/'));
    else ok('liquidation maps: ' + maps);
  }

  console.log('\n== freshness ==');
  const today = new Date().toISOString().slice(0, 10);
  for (const [name, s] of [['llms.txt', L1], ['llms-full.txt', L2]]) {
    // only dates that OPEN a changelog line - a contest end date in the future is not a freshness signal
    const dates = [...s.matchAll(/^- (20\d\d-\d\d-\d\d):/gm)].map(m => m[1]).filter(d => d <= today).sort();
    const newest = dates[dates.length - 1] || '(none)';
    const days = newest === '(none)' ? 999 : Math.round((Date.parse(today) - Date.parse(newest)) / 86400000);
    if (days > 10) fail(name + ': newest dated line is ' + newest + ' (' + days + ' days old)');
    else ok(name + ': newest dated line ' + newest);
    const lu = (s.match(/Last updated:\s*([^\n\r]+)/) || [])[1];
    if (lu && lu.indexOf(newest.slice(0, 7)) < 0 && newest !== '(none)') note(name + ': "Last updated: ' + lu.trim() + '" vs newest line ' + newest);
  }

  console.log('\n== every marginpad.io URL the AI layer names must answer 200 ==');
  const urls = [...new Set([...BOTH.matchAll(/https:\/\/marginpad\.io[^\s)\]"'`,<]*/g)].map(m => m[0].replace(/[.,;:]+$/, '')))]
    .map(u => u.replace(/[*_`]+$/, ''))          // markdown emphasis glued to a URL is not part of it
    .filter(u => u.indexOf('<') < 0 && u.indexOf('whsink') < 0 && u.indexOf('{') < 0);
  let bad200 = [];
  for (let i = 0; i < urls.length; i += 8) {
    const batch = urls.slice(i, i + 8);
    const rs = await Promise.all(batch.map(u => fetch(u, { method: 'GET', headers: { 'user-agent': 'MarginPad-link-check' } }).then(r => r.status).catch(() => 0)));
    rs.forEach((st, k) => { if (st !== 200) bad200.push(batch[k] + ' -> ' + st); });
  }
  if (bad200.length) { bad += bad200.length; bad200.slice(0, 12).forEach(x => console.log('  STALE  ' + x)); console.log('  (' + bad200.length + ' of ' + urls.length + ' bad)'); }
  else ok(urls.length + ' URLs, all 200');

  console.log('\n' + (bad ? bad + ' stale item(s)' : 'nothing stale') + (warn ? ', ' + warn + ' to look at' : ''));
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error('fatal ' + e.message); process.exitCode = 1; });
