// mp-ops E2E (2026-09-03): renders the admin dashboard and every tab after a deploy, with a short session minted
// from the ADMIN_KEY (POST /api/stats/session) - no owner password involved. For each tab it asserts: the tab
// panel is visible, no page errors, no failed admin fetches (4xx/5xx), no "could not load"/"forbidden" placeholder,
// and takes a screenshot into build/ops-shots/. The session is revoked at the end.
// Run: node build/ops-e2e.js            (all tabs)
//      node build/ops-e2e.js stats ops  (only these tabs)
const fs = require('fs'), path = require('path');
const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const BASE = 'https://marginpad.io';
const TABS = ['stats', 'settings', 'rewards', 'users', 'support', 'chat', 'security', 'ops', 'premium', 'api', 'mail', 'tgbot', 'affiliate', 'revenue', 'shop', 'seo', 'funnel', 'wd', 'retention', 'community', 'jmap', 'activity', 'perf', 'spot'];
const only = process.argv.slice(2).filter(a => TABS.includes(a));
const SHOTS = path.join(__dirname, 'ops-shots'); if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS);
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + JSON.stringify(x).slice(0, 220) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const sess = await (await fetch(BASE + '/api/stats/session', { method: 'POST', headers: { 'x-admin-key': K } })).json();
  chk('session minted from ADMIN_KEY', sess.ok && /^[0-9a-f]{64}$/.test(sess.token), { ok: sess.ok, ttl: sess.ttl });
  if (!sess.ok) { console.log(out.join('\n')); process.exit(1); }
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setCookie({ name: 'mp_sadm', value: sess.token, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true });
    const errs = [], bad = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
    await page.evaluateOnNewDocument(() => { window.addEventListener('unhandledrejection', e => { console.error('unhandledrejection: ' + (e.reason && (e.reason.stack || e.reason.message || e.reason))); }); });
    page.on('response', r => { try { const u = r.url(); if (u.indexOf(BASE + '/api/') === 0 && r.status() >= 400 && !/\/api\/prices?\b/.test(u)) bad.push(r.status() + ' ' + u.slice(BASE.length, BASE.length + 70)); } catch (e) {} });
    const t0 = Date.now();
    await page.goto(BASE + '/api/stats?nc=1', { waitUntil: 'networkidle2', timeout: 120000 });
    const load = Date.now() - t0; await sleep(2500);
    const g = await page.evaluate(() => ({ tabs: document.querySelectorAll('.tab').length, gate: !!document.querySelector('input[type="password"]'), title: document.title, bytes: document.documentElement.outerHTML.length }));
    chk('dashboard renders behind the minted session (no password gate)', !g.gate && g.tabs >= 20, { tabs: g.tabs, load, kb: Math.round(g.bytes / 1024) });
    const feed = await page.evaluate(() => fetch('/api/stats?format=json').then(r => r.json()).then(j => ({ online: j.online, uvToday: j.uvToday, feed: (j.feed || []).length })).catch(e => ({ err: String(e) })));
    chk('live JSON feed answers', feed && feed.err == null && typeof feed.online === 'number', feed);
    for (const tab of (only.length ? only : TABS)) {
      const e0 = errs.length, b0 = bad.length;
      const has = await page.evaluate((t) => { const b = document.querySelector('.tab[data-tab="' + t + '"]'); if (!b) return false; b.click(); return true; }, tab);
      if (!has) { chk('tab ' + tab + ': button exists', false); continue; }
      await sleep(tab === 'jmap' || tab === 'perf' || tab === 'users' ? 5000 : 3500);
      const s = await page.evaluate((t) => {
        const el = document.getElementById('tab-' + t); if (!el) return { panel: false };
        const r = el.getBoundingClientRect(); const txt = (el.innerText || '').replace(/\s+/g, ' ');
        return { panel: true, hidden: el.hidden, h: Math.round(r.height), chars: txt.length, placeholder: (txt.match(/could not load|forbidden|Loading…|loading\.\.\./gi) || []).length, sample: txt.slice(0, 80) };
      }, tab);
      const newErrs = errs.slice(e0), newBad = bad.slice(b0);
      const ok = s.panel && !s.hidden && s.h > 40 && s.chars > 20 && newErrs.length === 0 && newBad.length === 0 && s.placeholder === 0;
      chk('tab ' + tab, ok, { h: s.h, chars: s.chars, ph: s.placeholder, errs: newErrs, bad: newBad, sample: ok ? undefined : s.sample });
      try { await page.screenshot({ path: path.join(SHOTS, tab + '.png') }); } catch (e) {}
    }
    // phone width: the same page must not scroll horizontally and the tab bar must be reachable
    await page.setViewport({ width: 390, height: 780 }); await page.evaluate(() => { const b = document.querySelector('.tab[data-tab="stats"]'); b && b.click(); }); await sleep(1500);
    const m = await page.evaluate(() => ({ hscroll: document.documentElement.scrollWidth > window.innerWidth + 2, tabsVisible: Array.from(document.querySelectorAll('.tab')).filter(t => t.getBoundingClientRect().width > 0).length }));
    chk('phone width: no horizontal scroll, tab bar visible', !m.hscroll && m.tabsVisible > 5, m);
    try { await page.screenshot({ path: path.join(SHOTS, '_phone.png') }); } catch (e) {}
    chk('zero page errors overall', errs.length === 0, errs.slice(0, 5));
    await page.evaluate(() => fetch('/api/stats/logout', { method: 'POST' }).catch(() => {})); // revoke the minted session
    await ctx.close();
  });
  console.log(out.join('\n'));
  console.log('pass', out.filter(x => x[0] === 'P').length, 'fail', out.filter(x => x[0] === 'F').length, '· shots in build/ops-shots/');
  process.exit(out.some(x => x[0] === 'F') ? 1 : 0);
})().catch(e => { console.error(e); console.log(out.join('\n')); process.exit(1); });
