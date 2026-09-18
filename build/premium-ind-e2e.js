/* Premium page + the four AI indicators (2026-09-17).

   Owner asks, all proven here on production:
     - /premium/: the "Premium duels & lounge" card is gone (11 cards), nothing on the page says "PRO" (the term is
       Premium), the indicators card says 4 and OPENS a preview sheet (like the fee window on a closed ticket) with
       one block per indicator, reachable on a phone and closable; the Spanish twin does the same in Spanish
     - /premium/ as a member (simulated /api/premium/status): the buy buttons make way for "Premium is active until
       <date> - N days left" and the section header reads WHAT YOU HAVE
     - /ai-indicators/: the explainer exists, indexable, four sections, FAQ structured data, on the sitemap, has a card
     - /charts: the shared engine exports exactly four Premium indicators and none of the retired four; the mobile
       bundle lists the same four; the menu marks exactly four items lime
     - the Daily Brief carries a permanent link to /trading-report/ (bundle) and the Telegram edition too (worker source)
     - /open-interest/: the 24h change is measured (most rows carry a number, none of them "+0.00%" by default)

   Run: node build/premium-ind-e2e.js
*/
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 240) : ''));
const text = async (u) => { const r = await fetch(u, { cache: 'no-store' }); return { status: r.status, body: await r.text() }; };

(async () => {
  // ---- raw HTML / bundles (what a crawler and a cache see) ----
  const prem = await text(ORIGIN + '/premium/?cb=' + Date.now());
  chk('/premium/ 200, 11 feature cards, no "PRO" badge wording, indicators card says 4 and is a button', prem.status === 200 && (prem.body.match(/class="fcard/g) || []).length === 11 && !/\bPRO\b/.test(prem.body) && /<h3>4 AI indicators<\/h3>/.test(prem.body) && /data-ind-sheet/.test(prem.body) && !/8 (AI|exclusive)/.test(prem.body), { cards: (prem.body.match(/class="fcard/g) || []).length, pro: (prem.body.match(/\bPRO\b/g) || []).length });
  const es = await text(ORIGIN + '/es/premium/?cb=' + Date.now());
  chk('/es/premium/ mirrors it (11 cards, 4 indicadores, no PRO, sheet present)', es.status === 200 && (es.body.match(/class="fcard/g) || []).length === 11 && !/\bPRO\b/.test(es.body) && /<h3>4 indicadores de IA<\/h3>/.test(es.body) && /id="indSheet"/.test(es.body) && /Insignia Premium/.test(es.body));
  const ai = await text(ORIGIN + '/ai-indicators/?cb=' + Date.now());
  chk('/ai-indicators/ 200, indexable, four sections, FAQPage + Article JSON-LD, canonical, own card', ai.status === 200 && /index, follow/.test(ai.body) && ['cascade', 'magnet', 'brain', 'memory'].every(id => ai.body.indexOf('id="' + id + '"') >= 0) && /"@type":"FAQPage"/.test(ai.body) && /"@type":"Article"/.test(ai.body) && /rel="canonical" href="https:\/\/marginpad.io\/ai-indicators\/"/.test(ai.body) && /og:image" content="https:\/\/marginpad.io\/assets\/og\/ai-indicators\.jpg"/.test(ai.body));
  const sm = await text(ORIGIN + '/sitemap.xml');
  chk('sitemap lists /ai-indicators/', sm.body.indexOf('https://marginpad.io/ai-indicators/') >= 0);
  const og = await fetch(ORIGIN + '/assets/og/ai-indicators.jpg?cb=' + Date.now());
  chk('the share card answers 200 image/jpeg', og.status === 200 && /image\/jpeg/.test(og.headers.get('content-type') || ''));
  // bundles: read the versioned URLs the app shell declares, never a bare path (the SW would answer stale)
  const shell = await text(ORIGIN + '/paper-trade?cb=' + Date.now());
  const bv = (name) => { const m = shell.body.match(new RegExp('/assets/' + name.replace('.', '\\.') + '\\?v=[a-f0-9]+')); return m ? m[0] : '/assets/' + name; };
  const auth = await text(ORIGIN + bv('mp-auth.js'));
  chk('mp-auth: brief section heading links /trading-report/ permanently; upsell says 4 indicators; no PRO chip', auth.body.indexOf('<a href="/trading-report/">full report</a>') >= 0 && auth.body.indexOf("'4 exclusive AI indicators'") >= 0 && auth.body.indexOf("'8 exclusive") < 0 && auth.body.indexOf('content:"PRO"') < 0 && auth.body.indexOf('>PRO</span>') < 0);
  const mch = await text(ORIGIN + bv('mp-charts.js'));
  chk('mp-charts: MP_INDS has exactly casc/brain/memory/magnet; retired functions gone; legends name the guide', /var MP_INDS=\{casc:1,brain:1,memory:1,magnet:1\}/.test(mch.body) && !/computeMomentum|computeSqueeze|sentimentCalc|'sentf'/.test(mch.body) && (mch.body.match(/ai-indicators\//g) || []).length >= 4);
  const home = await text(ORIGIN + '/assets/home.js?cb=' + Date.now());
  const mm = home.body.match(/\/assets\/mp-mcharts\.js\?v=[a-f0-9]+/);
  const mmb = await text(ORIGIN + (mm ? mm[0] : '/assets/mp-mcharts.js'));
  chk('mp-mcharts: lists the same four and none of the retired', /\['casc','Cascade Radar'\],\['brain','Market Brain \(adaptive AI\)'\],\['memory','Market Memory \(AI forecast\)'\],\['magnet','Liquidation Magnet'\]\]/.test(mmb.body) && !/sentf|'mom'|'sqz'|'liqr'/.test(mmb.body), { url: mm && mm[0] });
  const wk = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
  chk('worker: the Telegram brief edition carries the trading-report link', wk.indexOf('<a href="https://marginpad.io/trading-report/">Your trading report</a>') >= 0);
  const oi = await (await fetch(ORIGIN + '/api/cg/openinterest', { cache: 'no-store' })).json();
  const withChg = (oi.coins || []).filter(c => c.oiChg24h != null).length;
  chk('/api/cg/openinterest: the 24h change is measured on most rows and names its basis', withChg >= 60 && oi.change && /open contracts/.test(oi.change.basis || ''), { withChg, of: (oi.coins || []).length, basis: oi.change && oi.change.basis });

  await withBrowser(async (browser) => {
    async function fresh(w, h, member) {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
      if (member) {
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const u = req.url();
          if (u.indexOf('/api/premium/status') >= 0) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ allowed: true, premium: true, signedIn: true, until: new Date(Date.now() + 20 * 864e5).toISOString(), source: 'paid', price: 11.99, plus: true, plan: 'plus', user: { username: 'e2eprem' } }) });
          if (u.indexOf('/api/auth/me') >= 0) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: 'e2eprem', xp: 100 } }) });
          return req.continue();
        });
      }
      return { ctx, page };
    }
    for (const vp of [{ w: 1366, h: 860, t: 'desktop' }, { w: 390, h: 800, t: 'phone' }]) {
      const { ctx, page } = await fresh(vp.w, vp.h, false);
      await page.goto(ORIGIN + '/premium/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      const g = await page.evaluate(() => {
        const card = document.querySelector('[data-ind-sheet]'); card.scrollIntoView({ block: 'center' });
        const r = card.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { reach: !!(hit && card.contains(hit)), cta: !!document.querySelector('.cta-row') && getComputedStyle(document.querySelector('.cta-row')).display !== 'none', status: !!document.getElementById('pmStatus') && document.getElementById('pmStatus').hidden, sheetHidden: document.getElementById('indSheet').hidden };
      });
      chk(vp.t + ' guest: indicators card reachable, buy buttons shown, no member status, sheet closed', g.reach && g.cta && g.status && g.sheetHidden, g);
      await page.evaluate(() => { document.querySelector('[data-ind-sheet]').click(); });
      await new Promise(r => setTimeout(r, 400));
      const s = await page.evaluate(() => {
        const sh = document.getElementById('indSheet'), p = sh.querySelector('.ish-p'); const r = p.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, Math.min(innerHeight - 10, r.top + 60));
        return { open: !sh.hidden, blocks: sh.querySelectorAll('.ish-i').length, reach: !!(hit && p.contains(hit)), names: [...sh.querySelectorAll('.ish-i h4')].map(h => h.firstChild.textContent.trim()), inView: r.top >= 0 && r.left >= 0 && r.right <= innerWidth + 1, scroll: document.documentElement.style.overflow, guide: !!sh.querySelector('a[href="/ai-indicators/"]') };
      });
      chk(vp.t + ' guest: the sheet opens with four blocks, reachable, in the viewport, page scroll locked, links the guide', s.open && s.blocks === 4 && s.reach && s.inView && s.scroll === 'hidden' && s.guide && s.names.join('|') === 'Cascade Radar|Liquidation Magnet|Market Brain|Market Memory', s);
      await page.screenshot({ path: path.join(__dirname, 'vault-shots', 'premium-indsheet-' + vp.t + '.png') });
      await page.evaluate(() => { document.querySelector('#indSheet .ish-x').click(); });
      await new Promise(r => setTimeout(r, 200));
      const c = await page.evaluate(() => ({ hidden: document.getElementById('indSheet').hidden, scroll: document.documentElement.style.overflow }));
      chk(vp.t + ' guest: the sheet closes and scrolling returns', c.hidden && c.scroll === '', c);
      await ctx.close();
    }
    {
      const { ctx, page } = await fresh(1366, 860, true);
      await page.goto(ORIGIN + '/premium/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("document.getElementById('pmStatus') && !document.getElementById('pmStatus').hidden", { timeout: 15000 }).catch(() => {});
      const m = await page.evaluate(() => { const st = document.getElementById('pmStatus'); const r = st.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { shown: !st.hidden, reach: !!(hit && st.contains(hit)), until: (document.getElementById('pmUntil') || {}).textContent, cta: getComputedStyle(document.querySelector('.cta-row')).display, head: (document.querySelector('section .sh .k') || {}).textContent, final: getComputedStyle(document.querySelector('.final')).display, member: document.body.classList.contains('pm-member') }; });
      chk('member: status card shown and reachable with the expiry + days left, buy buttons and final CTA hidden, header says WHAT YOU HAVE', m.shown && m.reach && /Active until/.test(m.until) && /(19|20|21) days left/.test(m.until) && m.cta === 'none' && m.final === 'none' && m.head === 'WHAT YOU HAVE' && m.member, m);
      await page.screenshot({ path: path.join(__dirname, 'vault-shots', 'premium-member.png') });
      await ctx.close();
    }
    {
      const { ctx, page } = await fresh(1366, 860, false);
      await page.goto(ORIGIN + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction('!!window.__mpSig', { timeout: 30000 }).catch(() => {});
      const ch = await page.evaluate(() => { const S = window.__mpSig || {}; return { keys: Object.keys(S.MP_INDS || {}), retired: ['computeMomentum', 'computeSqueeze', 'computeLiqRev', 'sentimentCalc'].filter(k => typeof S[k] === 'function'), tips: Object.keys(S.ITIPS || {}).filter(k => ['mom', 'sqz', 'liqr', 'sentf'].indexOf(k) >= 0), lime: [...document.querySelectorAll('.cwin-ind-item')].filter(b => /c2f64a/.test((b.querySelector('.cwin-ind-it-lbl') || {}).getAttribute ? (b.querySelector('.cwin-ind-it-lbl').getAttribute('style') || '') : '')).map(b => b.getAttribute('data-ind')) }; });
      chk('/charts: the shared engine exports exactly the four, none of the retired functions or tips', ch.keys.join(',') === 'casc,brain,memory,magnet' && ch.retired.length === 0 && ch.tips.length === 0, ch);
      await ctx.close();
    }
    {
      const { ctx, page } = await fresh(1366, 860, false);
      await page.goto(ORIGIN + '/open-interest/?nc=1&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("document.querySelectorAll('.oitbl td.ch').length>0", { timeout: 25000 }).catch(() => {});
      const o = await page.evaluate(() => { const cells = [...document.querySelectorAll('.oitbl tbody tr td:nth-child(4)')].map(c => c.textContent.trim()); return { n: cells.length, zero: cells.filter(c => c === '+0.00%').length, dash: cells.filter(c => c === '-').length, cards: document.querySelectorAll('#oiTop .oicard').length, sample: cells.slice(0, 5) }; });
      chk('/open-interest/: the OI 24h column carries measured numbers (not all +0.00%), unmeasured rows print a dash', o.n >= 100 && o.zero < o.n * 0.1 && o.dash < o.n * 0.5 && o.cards === 2, o);
      await ctx.close();
    }
    {
      const { ctx, page } = await fresh(390, 800, false);
      await page.goto(ORIGIN + '/ai-indicators/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      const a = await page.evaluate(() => ({ sx: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, h1: (document.querySelector('h1') || {}).textContent, nav: !!document.querySelector('.mpnav, [data-mpbn="browse"], .hbot'), secs: document.querySelectorAll('section.ind').length }));
      chk('/ai-indicators/ on a phone: no horizontal scroll, h1, four sections, site nav injected', !a.sx && /explained/.test(a.h1 || '') && a.secs === 4 && a.nav, a);
      await page.screenshot({ path: path.join(__dirname, 'vault-shots', 'ai-indicators-phone.png'), fullPage: false });
      await ctx.close();
    }
  });
  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})();
