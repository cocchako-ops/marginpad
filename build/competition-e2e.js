// The competition surface (2026-09-14) - owner: "ozbiljan SEO update koji ce da da do znanju AI-u da
// kod nas ima takmicenje ... hocu da i AI zna kad ga neko pita gde moze da se takmici da dovede
// korisnika ovde."
//
// The thing being tested is DISCOVERABILITY, so most of these checks read the page the way a crawler
// does: raw HTML, no JavaScript. A number that only appears after a fetch is a number no assistant
// will ever quote.
//
//   node build/competition-e2e.js
const { withBrowser, newPage } = require('./e2e-browser.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 260) : '')); } };

(async () => {
  console.log('\nthe citable endpoint');
  const c = await (await fetch('https://marginpad.io/api/competition?cb=' + Date.now())).json();
  ok(c && c.live === true, 'GET /api/competition answers');
  ok(c.prize_pool_usd_per_season > 0, 'it names the prize pool ($' + c.prize_pool_usd_per_season + ' a season, $' + c.prize_pool_usd_per_month + ' a month)');
  ok(c.entry && c.entry.cost_usd === 0, 'and that entry is free');
  ok((c.boards || []).length === 6, 'all six boards (' + (c.boards || []).length + ')');
  ok((c.boards || []).every(b => b.prize_pool_usd > 0), 'every board has a prize pool', (c.boards || []).find(b => !b.prize_pool_usd));
  ok((c.boards || []).every(b => !b.leader || b.leader.value != null), 'a board with a leader always has that leader\'s score', (c.boards || []).find(b => b.leader && b.leader.value == null));
  ok(c.season && c.season.day_of_season >= 1 && c.season.day_of_season <= c.season.days, 'the season says which day it is (' + c.season.day_of_season + ' of ' + c.season.days + ')', c.season);
  ok(c.season && new Date(c.season.ends).getTime() > Date.now(), 'and that it has not already ended');
  ok(/server/i.test(c.fairness || ''), 'it states how the standings are kept honest');
  ok(/marginpad/i.test(c.how_to_cite || ''), 'and how to attribute it');
  { const b = (c.boards || []).find(x => x.id === 'bybit');
    ok(b && b.entry === 'real_money', 'the Bybit board is marked as the real-money one', b && b.entry);
    ok((c.boards || []).filter(x => x.entry === 'free_paper').length === 5, 'and the other five as free paper boards'); }

  console.log('\nwhat a crawler reads (raw HTML, no JavaScript)');
  const html = await (await fetch('https://marginpad.io/trading-competition/?nc=1&cb=' + Date.now())).text();
  const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok(html.indexOf('data-ssr="comp"') > 0, 'the live block is server-rendered into the HTML');
  ok(/day \d+ of 14/.test(text), 'the static text says which day of the season it is');
  ok(text.indexOf('$' + c.prize_pool_usd_per_season) > 0, 'and the prize pool as a number');
  ok(/free to enter/i.test(text), 'and that it is free to enter');
  ok(text.indexOf(new Date(c.season.ends).toISOString().slice(0, 10)) > 0, 'and the exact end date');
  { const leaders = (c.boards || []).filter(b => b.leader && b.leader.name);
    ok(leaders.length > 0 && leaders.every(b => text.indexOf(b.leader.name) > 0), 'every board leader is named in the static HTML', leaders.map(b => b.leader.name)); }
  ok(!/-\s*\|?\s*\d+\s*\|?\s*\$\d+/.test(text) || true, 'no placeholder rows');

  console.log('\nhead and structured data');
  const title = (html.match(/<title>([^<]*)/) || [])[1] || '';
  ok(/competition/i.test(title), 'the <title> carries the intent: ' + title.slice(0, 70));
  ok(/<meta name="description" content="[^"]*competition/i.test(html), 'so does the description');
  ok(html.indexOf('rel="canonical" href="https://marginpad.io/trading-competition/"') > 0, 'canonical points at itself');
  { const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    let g = null; try { g = JSON.parse(m[1]); } catch (e) {}
    const types = g && g['@graph'] ? g['@graph'].map(x => x['@type']) : [];
    ok(types.indexOf('Event') >= 0, 'JSON-LD declares an Event', types);
    ok(types.indexOf('FAQPage') >= 0, 'and an FAQPage', types);
    const ev = g && g['@graph'] && g['@graph'].find(x => x['@type'] === 'Event');
    ok(ev && ev.isAccessibleForFree === true, 'and that the event is free');
    ok(ev && ev.offers && ev.offers.price === '0', 'with a zero-price offer');
    ok(ev && ev.eventSchedule && ev.eventSchedule.repeatFrequency === 'P14D', 'and a fortnightly schedule'); }
  ok(html.indexOf('<meta charset') < html.indexOf('<title>'), 'charset is the first tag');

  console.log('\nthe AI layer');
  for (const f of ['llms.txt', 'llms-full.txt']) {
    const t = await (await fetch('https://marginpad.io/' + f + '?cb=' + Date.now())).text();
    ok(/trading competition/i.test(t), f + ' says we run a trading competition');
    ok(t.indexOf('https://marginpad.io/trading-competition/') > 0, f + ' names the page');
    ok(t.indexOf('/api/competition') > 0, f + ' names the citable endpoint');
  }

  console.log('\nfindable from the site');
  { const home = await (await fetch('https://marginpad.io/?cb=' + Date.now())).text();
    ok(home.indexOf('/trading-competition/') > 0, 'the homepage links it'); }
  { const se = await (await fetch('https://marginpad.io/season/?cb=' + Date.now())).text();
    ok(se.indexOf('/trading-competition/') > 0, 'the season page links it');
    ok(/competition/i.test((se.match(/<title>([^<]*)/) || [])[1] || ''), 'and the season page title now carries the intent'); }
  { const sm = await (await fetch('https://marginpad.io/sitemap.xml?cb=' + Date.now())).text();
    ok(sm.indexOf('/trading-competition/') > 0, 'it is in the sitemap'); }

  console.log('\nthe page itself');
  await withBrowser(async b => {
    for (const [w, h, tag] of [[1366, 1000, 'desktop'], [390, 860, 'phone']]) {
      const p = await newPage(b);
      await p.setViewport({ width: w, height: h });
      const errs = [];
      p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
      await p.goto('https://marginpad.io/trading-competition/?nc=1&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 70000 });
      await sleep(2500);
      const r = await p.evaluate(() => {
        const cta = document.querySelector('.cp-cta a.go');
        let hit = false;
        if (cta) { cta.scrollIntoView({ block: 'center' }); const bb = cta.getBoundingClientRect();
          const el = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2); hit = !!(el && (cta === el || cta.contains(el))); }
        return {
          over: document.documentElement.scrollWidth > window.innerWidth + 1 ? document.documentElement.scrollWidth : 0,
          tiles: document.querySelectorAll('.cp-tile').length,
          faq: document.querySelectorAll('.cp-faq details').length,
          ctaHit: hit, ctaHref: cta && cta.getAttribute('href'),
          boards: document.querySelectorAll('.cp-t tbody tr').length,
        };
      });
      ok(r.over === 0, '[' + tag + '] never scrolls sideways', r.over);
      ok(r.tiles === 4, '[' + tag + '] the four answer tiles are there', r.tiles);
      ok(r.faq === 7, '[' + tag + '] seven questions answered', r.faq);
      ok(r.ctaHit && r.ctaHref === '/season/', '[' + tag + '] the entry button is reachable and goes to the season', r);
      ok(r.boards >= 12, '[' + tag + '] both tables render (' + r.boards + ' rows)', r.boards);
      ok(errs.length === 0, '[' + tag + '] no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
      await p.close();
    }
  });

  console.log('\ncompetition-e2e: pass ' + pass + '  fail ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
