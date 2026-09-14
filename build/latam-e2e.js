// LATAM live pages E2E (2026-09-07): /dolar-cripto/ (es-AR) + /bitcoin-hoje/ (pt-BR) + the two product landings.
// Run after every deploy that touches them: node build/latam-e2e.js
//   A. API: /api/latam/ar and /api/latam/br return sane, sorted, named rows with fresh timestamps; history accumulates.
//   B. Raw HTML (no JS, what a crawler and an AI bot read): SSR header, the headline number and exchange names are IN the
//      HTML, lang attributes, JSON-LD parses, dateModified is a real date, the Dataset points at the JSON.
//   C. Browser 390 + 1366: the headline is reachable, the table has rows, the calculator answers, the "updated N s ago"
//      ticker moves, the CTA is reachable, the landing's live widget shows a number, no console errors, no horizontal overflow.
const fs = require('fs'); const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 170) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (p) => { const r = await fetch(ORIGIN + p + (p.indexOf('?') > 0 ? '&' : '?') + 'cb=' + Date.now()); return { status: r.status, h: r.headers, text: await r.text() }; };
const ld = (html) => { const m = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]; return m.map(x => { try { return JSON.parse(x[1]); } catch (e) { return null; } }); };
(async () => {
  // A. API
  const ar = await (await fetch(ORIGIN + '/api/latam/ar?cb=' + Date.now())).json();
  chk('A ar: ok, 5+ exchanges, mid in a sane band vs blue', ar.ok && ar.n >= 5 && ar.mid > 0 && ar.dolar.blue && ar.mid > ar.dolar.blue.ask * 0.7 && ar.mid < ar.dolar.blue.ask * 1.5, { n: ar.n, mid: ar.mid, blue: ar.dolar.blue && ar.dolar.blue.ask, stale: ar.stale });
  chk('A ar: rows sorted by ask, every row named, best buy is the min ask', ar.rows.every((r, i) => !i || !r.ask || !ar.rows[i - 1].ask || ar.rows[i - 1].ask <= r.ask) && ar.rows.every(r => r.name && r.name.length > 1) && ar.bestBuy && ar.bestBuy.price === Math.min(...ar.rows.filter(r => r.ask).map(r => r.ask)), { first: ar.rows[0], best: ar.bestBuy });
  chk('A ar: brecha computed against the official and the blue', typeof ar.brecha.oficial === 'number' && typeof ar.brecha.blue === 'number', ar.brecha);
  chk('A ar: timestamp is fresh (under 10 min)', Date.now() - ar.ts < 10 * 60000, { ageMin: Math.round((Date.now() - ar.ts) / 60000) });
  chk('A ar: history holds at least one own hourly point', Array.isArray(ar.hist) && ar.hist.length >= 1 && ar.hist[0].mid > 0, { n: ar.hist.length, first: ar.hist[0] });
  const br = await (await fetch(ORIGIN + '/api/latam/br?cb=' + Date.now())).json();
  chk('B br: ok, 3+ exchanges, BTC mid, USD/BRL in 3..10, BTC/USD > 0', br.ok && br.n >= 3 && br.btcMid > 0 && br.usdbrl > 3 && br.usdbrl < 10 && br.btcUsd > 0, { n: br.n, btcMid: br.btcMid, usdbrl: br.usdbrl, btcUsd: br.btcUsd, stale: br.stale });
  chk('B br: ágio is a finite percentage within ±15% on the cheapest venue', br.btc[0] && isFinite(br.btc[0].agio) && Math.abs(br.btc[0].agio) < 15, { first: br.btc[0], agioMid: br.agioMid });
  chk('B br: USDT rows carry a vs-dollar premium', br.usdt.length >= 2 && br.usdt.every(r => r.agio == null || isFinite(r.agio)), { n: br.usdt.length, first: br.usdt[0] });
  chk('B br: history holds at least one own hourly point', Array.isArray(br.hist) && br.hist.length >= 1 && br.hist[0].btc > 0, { n: br.hist.length });

  // B. raw HTML
  const pa = await get('/dolar-cripto/');
  chk('H ar: 200 + x-mp-ssr header', pa.status === 200 && pa.h.get('x-mp-ssr') === 'latam-ar', { status: pa.status, ssr: pa.h.get('x-mp-ssr') });
  const arNum = '$ ' + Math.round(ar.mid).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  chk('H ar: the headline number and 5+ exchange names are in the HTML itself', pa.text.indexOf('id="lvBig"') > 0 && /id="lvBig">\$ [\d.]+</.test(pa.text) && ar.rows.slice(0, 5).every(r => pa.text.indexOf(r.name) > 0), { num: (pa.text.match(/id="lvBig">([^<]+)</) || [])[1], expect: arNum });
  chk('H ar: lang es-AR, canonical, hreflang', /<html lang="es-AR">/.test(pa.text) && pa.text.indexOf('rel="canonical" href="https://marginpad.io/dolar-cripto/"') > 0 && pa.text.indexOf('hreflang="es-AR"') > 0);
  const la = ld(pa.text); const wp = la.find(x => x && x['@type'] === 'WebPage'), ds = la.find(x => x && x['@type'] === 'Dataset'), fq = la.find(x => x && x['@type'] === 'FAQPage');
  chk('H ar: JSON-LD parses; dateModified is a real ISO date; Dataset points at the JSON; FAQ has 6 questions', la.every(Boolean) && wp && /^\d{4}-\d{2}-\d{2}T/.test(wp.dateModified) && ds && ds.distribution[0].contentUrl.endsWith('/api/latam/ar') && fq && fq.mainEntity.length === 6, { dm: wp && wp.dateModified, n: la.length });
  chk('H ar: no untouched placeholders', pa.text.indexOf('<!--LATAM_') < 0);
  chk('H ar: site nav + sentry + gtag injected', pa.text.indexOf('mp-nav.js') > 0 && pa.text.indexOf('sentry.js') > 0 && pa.text.indexOf('gtag') > 0);
  const pb = await get('/bitcoin-hoje/');
  chk('H br: 200 + x-mp-ssr header', pb.status === 200 && pb.h.get('x-mp-ssr') === 'latam-br', { status: pb.status, ssr: pb.h.get('x-mp-ssr') });
  chk('H br: headline R$ number, ágio column and USDT table in the HTML', /id="lvBig">R\$ [\d.]+</.test(pb.text) && pb.text.indexOf('id="lvTbl2"') > 0 && br.btc.slice(0, 3).every(r => pb.text.indexOf(r.name) > 0), { num: (pb.text.match(/id="lvBig">([^<]+)</) || [])[1] });
  chk('H br: lang pt-BR + JSON-LD dateModified', /<html lang="pt-BR">/.test(pb.text) && ld(pb.text).every(Boolean) && /^\d{4}-\d{2}-\d{2}T/.test((ld(pb.text).find(x => x['@type'] === 'WebPage') || {}).dateModified || ''));
  for (const [p, lang] of [['/simulador-trading-cripto-argentina/', 'es-AR'], ['/simulador-trading-cripto-brasil/', 'pt-BR']]) {
    const r = await get(p);
    chk('L ' + lang + ': 200, lang, JSON-LD (WebApplication + FAQ), CTAs to /paper-trade and /spot/', r.status === 200 && r.text.indexOf('<html lang="' + lang + '">') > 0 && ld(r.text).every(Boolean) && ld(r.text).some(x => x['@type'] === 'WebApplication') && ld(r.text).some(x => x['@type'] === 'FAQPage') && r.text.indexOf('href="/paper-trade"') > 0 && r.text.indexOf('href="/spot/?lang=') > 0 && r.text.indexOf('mp-nav.js') > 0, { status: r.status });
  }
  const sm = await get('/sitemap.xml'); chk('S sitemap lists the four pages', ['/dolar-cripto/', '/bitcoin-hoje/', '/simulador-trading-cripto-argentina/', '/simulador-trading-cripto-brasil/'].every(u => sm.text.indexOf('https://marginpad.io' + u + '</loc>') > 0));

  // C. browser
  await withBrowser(async (browser) => {
    for (const vp of [{ width: 390, height: 844, isMobile: true, hasTouch: true }, { width: 1366, height: 800 }]) {
      const W = vp.width;
      for (const [p, kind] of [['/dolar-cripto/', 'ar'], ['/bitcoin-hoje/', 'br']]) {
        const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport(vp);
        const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
        await page.goto(ORIGIN + p + '?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await sleep(1500);
        const reach = (sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return { none: true }; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { ok: !!hit && (hit === el || el.contains(hit)), txt: (el.textContent || '').trim().slice(0, 40), w: r.width }; }, sel);
        const big = await reach('#lvBig'); chk(W + ' ' + kind + ': headline reachable with a currency number', big.ok && /^(\$|R\$) [\d.]+/.test(big.txt), big);
        const rows = await page.evaluate(() => ({ rows: document.querySelectorAll('#lvTbl tbody tr').length, best: document.querySelectorAll('#lvBest .bc').length, chips: document.querySelectorAll('#lvChips .chip').length }));
        chk(W + ' ' + kind + ': table rows, best cards and chips rendered', rows.rows >= 3 && rows.best >= 1 && rows.chips >= 2, rows);
        // The "updated N ago" label has to AGREE with the data it is describing. This used to assert that the text
        // changed within 2.1 s, which only held while the label was counting seconds - the quote is served from a
        // 60 s cache, so at first paint it is always a minute or more old and the label ticks once a minute. That
        // made the check unpassable rather than flaky (2026-09-14). Comparing it to the inline data's own timestamp
        // tests the thing that matters, and instantly.
        const age = await page.evaluate(() => {
          const el = document.getElementById('lvSub'); const j = document.getElementById('latamData');
          let ts = 0; try { ts = +(JSON.parse(j.textContent).ts) || 0; } catch (e) {}
          return { sub: (el.textContent || '').trim(), secs: ts ? Math.round((Date.now() - ts) / 1000) : null };
        });
        const said = /(\d+)\s*(s|seg|min)/i.exec(age.sub);
        const agrees = !!said && age.secs != null && (/^s/i.test(said[2])
          ? Math.abs(+said[1] - age.secs) <= 20                       // seconds label: within 20 s of the data
          : Math.abs(+said[1] - Math.floor(age.secs / 60)) <= 1);      // minutes label: within one minute
        chk(W + ' ' + kind + ': "updated N ago" matches the data it describes', agrees, { sub: age.sub, dataAgeSecs: age.secs });
        const inId = kind === 'ar' ? 'cArs' : 'cBrl';
        await page.evaluate((id) => { const i = document.getElementById(id); i.value = '1000000'; i.dispatchEvent(new Event('input')); }, inId); await sleep(200);
        const co = await page.evaluate(() => Array.from(document.querySelectorAll('#cOut .co')).map(x => x.textContent.trim()).slice(0, 2));
        chk(W + ' ' + kind + ': calculator answers per exchange', co.length >= 1 && /\d/.test(co[0]), co);
        const cta = await reach('.ctac .btn'); chk(W + ' ' + kind + ': Demo Spot CTA reachable', cta.ok, cta);
        const ov = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth); chk(W + ' ' + kind + ': no horizontal overflow', !ov);
        chk(W + ' ' + kind + ': zero page errors', errs.length === 0, errs);
        await ctx.close();
      }
      for (const [p, kind] of [['/simulador-trading-cripto-argentina/', 'ar'], ['/simulador-trading-cripto-brasil/', 'br']]) {
        const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport(vp);
        const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
        await page.goto(ORIGIN + p + '?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 }); await sleep(2500);
        const w = await page.evaluate(() => ({ v: document.getElementById('lvwV').textContent, ov: document.documentElement.scrollWidth > window.innerWidth }));
        chk(W + ' landing ' + kind + ': live widget shows a number, no overflow', /^(\$|R\$) [\d.]+/.test(w.v) && !w.ov, w);
        const cta = await page.evaluate(() => { const el = document.querySelector('.hero-cta .btn'); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!hit && (hit === el || el.contains(hit)); });
        chk(W + ' landing ' + kind + ': hero CTA reachable, zero errors', cta && errs.length === 0, errs);
        await ctx.close();
      }
    }
  });
  console.log(out.join('\n'));
  const fails = out.filter(l => l.startsWith('FAIL')).length;
  console.log('\n' + (out.length - fails) + '/' + out.length + ' PASS' + (fails ? ' - ' + fails + ' FAIL' : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('suite crashed', e); process.exit(1); });
