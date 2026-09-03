// Demo Spot E2E (2026-09-03): share card (server snapshot, public link, guest sees the card) + on-ramp refused before the card is linked.
const fs = require('fs'); const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const UID = 'spotshr' + Date.now().toString(36).slice(-4); const B = 'https://marginpad.io/api/spot';
async function api(p, body) { const r = await fetch(B + p + (p.indexOf('?') > 0 ? '&' : '?') + 'uid=' + UID, { method: body ? 'POST' : 'GET', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return await r.json(); }
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + JSON.stringify(x).slice(0, 150) : ''));
(async () => {
  await api('/start', {});
  chk('on-ramp before linking the card -> not_linked', (await api('/onramp', { usd: 50 })).error === 'not_linked');
  await api('/link', {}); chk('on-ramp after linking -> ok', (await api('/onramp', { usd: 200 })).ok);
  await api('/trade', { side: 'buy', kind: 'cex', sym: 'BTC', usd: 50 });
  const sh = await api('/share', {}); chk('share snapshot created', sh.ok && /^[a-z0-9]{8,24}$/.test(sh.id) && /\/spot\/\?share=/.test(sh.url), sh);
  const pub = await (await fetch(B + '/share?id=' + sh.id)).json(); chk('public GET returns the snapshot without auth', pub.totalUsd > 9000 && pub.txN >= 2 && typeof pub.who === 'string', { total: pub.totalUsd, txN: pub.txN, who: pub.who });
  chk('bad id -> 404', (await (await fetch(B + '/share?id=zzzzzzzzzz')).json()).error === 'not_found');
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 100)));
    await page.goto('https://marginpad.io/spot/?share=' + sh.id + '&cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await new Promise(r => setTimeout(r, 3500));
    const card = await page.evaluate(() => { const t = document.querySelector('#smod .shc-t'); const a = document.querySelector('#smod a.m-go'); if (!t) return { card: false }; const r = a && a.getBoundingClientRect(); const h = r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { card: true, total: t.textContent, cta: !!a, reachable: !!(a && h && (h === a || a.contains(h))), gate: !document.getElementById('gate').hidden }; });
    chk('guest sees the share card over the gate with a reachable CTA', card.card && card.cta && card.reachable && card.gate, card);
    chk('zero page errors', errs.length === 0, errs);
    await ctx.close();
  });
  console.log(out.join('\n')); console.log('UID', UID, 'pass', out.filter(x => x[0] === 'P').length, 'fail', out.filter(x => x[0] === 'F').length);
})().catch(e => { console.error(e); console.log(out.join('\n')); process.exit(1); });
