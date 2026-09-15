/* wts-e2e.js - /where-to-start/ is a ROUTER, and it must stay one.
 *
 * WHY (2026-09-15): the page used to be a second academy outside the Academy - 12 lessons, quizzes, XP, badges,
 * streaks, practice missions, advanced tracks and a glossary, all built from the Academy's own data. Owner:
 * lessons belong in the Academy and nowhere else. This suite fails if a lesson, a quiz or an XP counter ever
 * comes back, if a recommended page stops answering 200, or if the recommendations stop being in the raw HTML
 * (a crawler runs no JavaScript - a link that only appears after a click is a link nobody will ever follow).
 *
 *   node build/wts-e2e.js           - against production
 *   node build/wts-e2e.js --local   - serve the page from dist/ (pre-deploy)
 */
const fs = require('fs');
const path = require('path');
const { withBrowser, newPage } = require('./e2e-browser.js');

const LOCAL = process.argv.includes('--local');
const BASE = 'https://marginpad.io';
const PAGE = BASE + '/where-to-start/';
const FILE = path.join(__dirname, '..', 'dist', 'where-to-start', 'index.html');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const eq = (a, b, m) => ok(a === b, m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');

// words that mean the page started teaching again, rather than pointing at the Academy
const TEACH = [/\bquiz\b/i, /\bbadge/i, /\bstreak\b/i, /\bxp\b/i, /lesson \d/i, /\bmodule\b/i, /\bcertificate\b/i];

(async () => {
  const raw = fs.readFileSync(FILE, 'utf8');

  console.log('\n-- the page a crawler sees (raw HTML, no JavaScript) --');
  const body = raw.slice(raw.indexOf('<body'));
  const inArticle = body.slice(body.indexOf('<article'), body.indexOf('</article>'));
  const links = [...new Set((inArticle.match(/href="(\/[^"]*)"/g) || []).map(h => h.slice(6, -1)))];
  ok(links.length >= 30, 'every recommendation is already in the HTML (' + links.length + ' internal links)');
  ok(/data-goal="learn"/.test(raw) && /data-goal="earn"/.test(raw), 'all six goal blocks are rendered server-side');
  eq((raw.match(/class="block"/g) || []).length, 6, 'six blocks');
  eq((raw.match(/data-pick=/g) || []).length, 6, 'six goal buttons');
  // scoped to the buttons: the STEPS carry data-lv too (that is how the filter works)
  eq((raw.match(/class="lvl" type="button" data-lv=/g) || []).length, 3, 'three level buttons');

  // teaching must be gone from the page's own prose - a reference to the Academy is fine, a lesson is not
  const prose = inArticle.replace(/<[^>]+>/g, ' ');
  const taught = TEACH.filter(re => {
    const m = prose.match(re); if (!m) return false;
    // allow it when the sentence is pointing at the Academy
    const i = prose.toLowerCase().indexOf(m[0].toLowerCase());
    return !/academy/i.test(prose.slice(Math.max(0, i - 160), i + 160));
  });
  eq(taught.length, 0, 'no lesson, quiz, badge, streak or XP on the page itself' + (taught.length ? ': ' + taught.join(', ') : ''));
  ok(/\/academy\//.test(raw), 'and learning is answered by linking the Academy');

  console.log('\n-- every recommended page answers 200 --');
  const bad = [];
  for (const u of links) {
    if (u.indexOf('/where-to-start') === 0) continue;
    const r = await fetch(BASE + u, { redirect: 'manual' }).catch(() => ({ status: 0 }));
    if (r.status !== 200) bad.push(u + '=' + r.status);
  }
  eq(bad.length, 0, links.length + ' links checked' + (bad.length ? ' - BAD: ' + bad.join(', ') : ''));

  await withBrowser(async (browser) => {
    const open = async (mobile) => {
      const page = await newPage(browser, {});
      if (mobile) await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.setCacheEnabled(false);
      await page.setRequestInterception(true);
      await page.target().createCDPSession().then(async c => { await c.send('Network.enable'); await c.send('Network.setBypassServiceWorker', { bypass: true }); }).catch(() => {});
      page.on('request', (req) => {
        const u = req.url();
        if (u.indexOf('/api/track') >= 0) return req.respond({ status: 204, body: '' });
        if (LOCAL && u.replace(/[?#].*$/, '') === PAGE) return req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: raw });
        req.continue();
      });
      const errs = [];
      page.on('pageerror', e => errs.push(String(e.message || e)));
      await page.goto(PAGE + '?nc=1', { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 1200));
      page._errs = errs;
      return page;
    };

    console.log('\n-- choosing narrows what is already there --');
    const page = await open(false);
    eq(page._errs.length, 0, 'no page errors' + (page._errs.length ? ': ' + page._errs[0] : ''));

    const vis = () => page.evaluate(() => {
      const bl = [...document.querySelectorAll('.block')].filter(b => !b.hidden);
      return {
        blocks: bl.length,
        goal: bl.length === 1 ? bl[0].getAttribute('data-goal') : null,
        steps: bl.length === 1 ? [...bl[0].querySelectorAll('.step')].filter(s => !s.hidden).length : null,
        first: bl.length === 1 ? (bl[0].querySelector('.step.first') ? bl[0].querySelector('.step.first').getAttribute('href') : null) : null,
        startHere: document.querySelectorAll('.tag.go').length,
        label: (document.getElementById('outLabel') || {}).textContent || '',
      };
    });

    const before = await vis();
    eq(before.blocks, 6, 'before any choice, all six blocks are visible');
    eq(before.startHere, 0, 'and nothing is marked "start here" yet');

    // REACHABILITY is asserted separately (below); the FLOW is driven with el.click() so a smooth scroll
    // mid-sequence cannot make the test miss a target and report a product bug that is not there.
    const tap = async (sel) => { await page.$eval(sel, el => el.click()); await new Promise(r => setTimeout(r, 320)); };

    const reach = await page.evaluate(() => {
      const hit = (sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect();
        const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === e || e.contains(t)); };
      return { goal: hit('[data-pick="learn"]'), lvl: hit('.lvl[data-lv="new"]') };
    });
    ok(reach.goal, 'a goal button is actually reachable at its own centre (not covered)');
    ok(reach.lvl, 'and so is a level button');

    await tap('[data-pick="bot"]');
    let v = await vis();
    eq(v.blocks, 1, 'picking a goal shows one block');
    eq(v.goal, 'bot', 'the one you picked');
    ok(/build or test/i.test(v.label), 'and the heading names it: "' + v.label + '"');

    const allSteps = v.steps;
    await tap('.lvl[data-lv="new"]');
    v = await vis();
    ok(v.steps < allSteps, 'picking "never traded" drops the steps that are not for them (' + allSteps + ' -> ' + v.steps + ')');
    eq(v.startHere, 1, 'exactly one step is marked "start here"');
    ok(v.first === '/trading-api/', 'and it is the right one (' + v.first + ')');

    await tap('.lvl[data-lv="pro"]');
    const vp = await vis();
    ok(vp.steps >= v.steps, 'an experienced trader is shown the deeper pages too (' + vp.steps + ')');
    eq(vp.startHere, 1, 'still exactly one "start here"');

    // the numbering must renumber, not leave gaps
    const nums = await page.evaluate(() => [...document.querySelectorAll('.block:not([hidden]) .step')].filter(s => !s.hidden).map(s => s.querySelector('.sn').textContent));
    ok(nums.join(',') === nums.map((_, i) => String(i + 1)).join(','), 'the visible steps are numbered 1..n with no gaps (' + nums.join(',') + ')');

    await tap('#reset');
    const after = await vis();
    eq(after.blocks, 6, 'Start over brings all six back');
    eq(after.startHere, 0, 'and clears the marker');

    // the choice survives a reload (localStorage), which is the whole point of asking
    await tap('[data-pick="market"]');
    await tap('.lvl[data-lv="some"]');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 900));
    const rel = await vis();
    eq(rel.goal, 'market', 'the choice survives a reload');
    eq(rel.startHere, 1, 'and so does the level');

    console.log('\n-- the toast exception (this page loads no mp-auth, so it keeps its own) --');
    const t = await page.evaluate(async () => {
      if (typeof toast !== 'function') return { none: 1 };
      toast('channel check');
      await new Promise(r => setTimeout(r, 500));
      const el = document.querySelector('.wts-toast');
      if (!el) return { none: 1 };
      const q = el.getBoundingClientRect();
      const bar = document.querySelector('.mpbn');
      const b = bar ? bar.getBoundingClientRect() : null;
      const overBar = b ? !(q.right <= b.left || b.right <= q.left || q.bottom <= b.top || b.bottom <= q.top) : false;
      return { inside: q.left >= 0 && q.right <= innerWidth + 1, right: Math.round(innerWidth - q.right), overBar };
    });
    ok(!t.none, 'toast() still exists and renders .wts-toast (toast-e2e depends on it)');
    ok(t.inside, 'and it sits inside the viewport');
    // the site has ONE notification corner (window.mpToast, bottom-right); this page's own toast must match it
    // and must never cover the mobile tab bar. It regressed to the old centred version once - hence this check.
    ok(t.right <= 40, 'it is in the bottom-RIGHT corner like every other notice (' + t.right + 'px from the edge)');
    ok(!t.overBar, 'and it does not cover the bottom tab bar');
    await page.close();

    console.log('\n-- phone, 390px --');
    const ph = await open(true);
    const p = await ph.evaluate(() => {
      const tap = [...document.querySelectorAll('.goal,.lvl,.step,.reset')].filter(e => e.getBoundingClientRect().height > 0);
      return {
        docW: document.documentElement.scrollWidth,
        small: tap.filter(e => e.getBoundingClientRect().height < 44).length,
        h1: !!document.querySelector('h1'),
        firstGoalTop: Math.round(document.querySelector('.goal').getBoundingClientRect().top),
      };
    });
    ok(p.docW <= 390, 'no horizontal overflow (' + p.docW + 'px)');
    eq(p.small, 0, 'no tap target under 44px');
    ok(p.h1, 'the page has its h1');
    ok(p.firstGoalTop < 844, 'the first question is on the first screen (' + p.firstGoalTop + 'px)');
    eq(ph._errs.length, 0, 'no page errors on the phone');
    await ph.close();
  }, { timeoutMs: 200000 });

  console.log('\n' + (fail ? 'FAIL' : 'PASS') + ' - ' + pass + ' ok, ' + fail + ' failed' + (LOCAL ? '  [local page]' : ''));
  process.exit(fail ? 1 : 0);
})();
