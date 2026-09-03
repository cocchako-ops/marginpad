// Guest activation card E2E (2026-09-04): as a GUEST on /paper-trade, the card must be reachable (elementFromPoint at its
// centre), say the right thing for a winning close, open sign-in from its button, and respect the once-per-7-days rule.
// The trigger is driven through window.mpGuestNudge with a simulated close (a real close would need a live fill); the
// eligibility counters are the real ones in localStorage. Run: node build/nudge-e2e.js
const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + JSON.stringify(x).slice(0, 200) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await withBrowser(async (browser) => {
    for (const vp of [{ width: 1366, height: 800, name: 'desktop' }, { width: 390, height: 780, isMobile: true, hasTouch: true, name: 'phone' }]) {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport(vp);
      await page.goto('https://marginpad.io/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 }); await sleep(2500);
      const pre = await page.evaluate(() => ({ fn: typeof window.mpGuestNudge, guest: !(window.mpAuth && window.mpAuth.me && window.mpAuth.me()) }));
      chk(vp.name + ': nudge module loaded, session is a guest', pre.fn === 'function' && pre.guest, pre);
      await page.evaluate(() => { localStorage.removeItem('mp_gn_n'); localStorage.removeItem('mp_gn_last'); localStorage.setItem('mp_gn_closes', '0'); window.mpGuestNudge('manual', 'BTC', -12); }); await sleep(1500);
      chk(vp.name + ': a losing first close shows nothing', await page.evaluate(() => !document.getElementById('mpGn')));
      await page.evaluate(() => { window.mpGuestNudge('manual', 'BTC', 8.5); }); await sleep(2500);
      const c = await page.evaluate(() => { const b = document.getElementById('mpGn'); if (!b) return null; const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); const go = b.querySelector('.mpgn-go').getBoundingClientRect(); return { text: b.innerText.replace(/\s+/g, ' ').slice(0, 80), reachable: !!(hit && b.contains(hit)), inView: r.bottom <= window.innerHeight && r.top >= 0, goX: go.x + go.width / 2, goY: go.y + go.height / 2, n: localStorage.getItem('mp_gn_n') }; });
      chk(vp.name + ': winning close shows the card, reachable and in view, counter = 1', !!(c && c.reachable && c.inView && /Nice close on BTC/.test(c.text) && c.n === '1'), c);
      if (c) { if (vp.hasTouch) await page.touchscreen.tap(c.goX, c.goY); else await page.mouse.click(c.goX, c.goY); await sleep(1200); }
      const after = await page.evaluate(() => ({ card: !!document.getElementById('mpGn'), auth: !!(document.querySelector('#mpAuth, .mpa-modal, [data-mpauth]') && !document.querySelector('#mpAuth[hidden], .mpa-modal[hidden]')), clicked: !!localStorage.getItem('mp_gn_clicked'), anyModal: Array.from(document.querySelectorAll('body *')).some(el => { const s = getComputedStyle(el); return s.position === 'fixed' && el.offsetHeight > 200 && el.id !== 'mpGn' && /sign|email|log in|continue/i.test(el.innerText || ''); }) }));
      chk(vp.name + ': the button hides the card and opens sign-in', !after.card && after.clicked && after.anyModal, after);
      await page.evaluate(() => { window.mpGuestNudge('manual', 'ETH', 20); }); await sleep(1200);
      chk(vp.name + ': no second card within 7 days', await page.evaluate(() => !document.getElementById('mpGn')));
      await ctx.close();
    }
    const ann = await (await fetch('https://marginpad.io/api/announce?cb=' + Date.now())).json();
    chk('announce carries the guestNudge switch', typeof ann.guestNudge === 'boolean', ann);
  });
  console.log(out.join('\n')); console.log('pass', out.filter(x => x[0] === 'P').length, 'fail', out.filter(x => x[0] === 'F').length);
  process.exit(out.some(x => x[0] === 'F') ? 1 : 0);
})().catch(e => { console.error(e); console.log(out.join('\n')); process.exit(1); });
