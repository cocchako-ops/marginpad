/* ai-draw-vision-check.js - OFFLINE, ADMIN-ONLY quality gate for the chart AI's drawings (2026-10-04).
   Owner: "broj 2 (vizuelna provera) da se odradi 5-10 testiranja samo, da mi proverimo pre nego sto pustimo
   korisnicima, a oni da nastave da koriste kao sto su i do sad." - so this is NOT in any reader's path. It drives
   the REAL /charts client, asks the AI to draw a setup, screenshots the chart window, and posts the image to the
   admin-only /api/admin/visioncheck endpoint, which sends it to a vision model with a rubric. It prints a verdict
   per run and saves the shots to build/ai-vision-shots/ so we can LOOK as well.

   Run:  node build/ai-draw-vision-check.js            (5 default combos)
         node build/ai-draw-vision-check.js SOL:15 BTC:60 ETH:240   (symbol:tfMinutes pairs, up to 10)
   Needs ADMIN_KEY.local.txt (the mpadm_ token) and a signed-in e2e member session (minted here). */
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser.js');

const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const SHOTDIR = path.join(__dirname, 'ai-vision-shots');
try { fs.mkdirSync(SHOTDIR, { recursive: true }); } catch (e) {}

function adminKey() {
  const t = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8');
  const m = t.match(/mpadm_[A-Za-z0-9]+/);
  if (!m) throw new Error('no mpadm_ token in ADMIN_KEY.local.txt');
  return m[0];
}

// combos: symbol:timeframeMinutes
let COMBOS = process.argv.slice(2).filter(a => /:/.test(a)).map(a => { const [s, tf] = a.split(':'); return { sym: s.toUpperCase(), tf: String(+tf || 60) }; });
if (!COMBOS.length) COMBOS = [{ sym: 'BTC', tf: '60' }, { sym: 'ETH', tf: '240' }, { sym: 'SOL', tf: '15' }, { sym: 'XRP', tf: '60' }, { sym: 'BNB', tf: '240' }];
COMBOS = COMBOS.slice(0, 10);

(async () => {
  const KEY = adminKey();
  const uid = 'e2eaivision';            // NO hyphen - lookups strip it
  const uname = 'e2e_' + uid;           // the username e2euser mk assigns
  // mint a real member, grant it Premium (Ask AI is Premium-gated in the client), THEN mint the session - the grant
  // revokes sessions, so the session must come last.
  let cookie = '';
  try {
    await fetch(ORIGIN + '/api/admin/e2euser', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify({ uid, op: 'mk' }) });
    await fetch(ORIGIN + '/api/admin/premium?add=' + uname + '&days=2', { headers: { 'x-admin-key': KEY } });
    // ordinary Premium is only 1 AI read/day, so raise this throwaway account's AI limit via a stats-session cookie
    try {
      const ss = await fetch(ORIGIN + '/api/stats/session', { method: 'POST', headers: { 'x-admin-key': KEY } });
      const sj2 = await ss.json(); const sadm = sj2 && sj2.token;
      if (sadm) await fetch(ORIGIN + '/api/ai/admin', { method: 'POST', headers: { 'content-type': 'application/json', 'cookie': 'mp_sadm=' + sadm }, body: JSON.stringify({ uid, userLimit: 300 }) });
    } catch (e) { console.error('ai-limit override failed:', e.message); }
    const sr = await fetch(ORIGIN + '/api/admin/e2euser', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify({ uid, op: 'sess' }) });
    const sj = await sr.json(); cookie = sj && (sj.token || sj.sess || sj.mp_sess) || '';
  } catch (e) { console.error('session mint failed:', e.message); }

  const results = [];
  await withBrowser(async browser => {
    for (const c of COMBOS) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 860, deviceScaleFactor: 2 });
      if (cookie) { try { await page.setCookie({ name: 'mp_sess', value: cookie, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' }); } catch (e) {} }
      const errs = []; page.on('pageerror', e => errs.push(String(e.message || e)));
      try {
        await page.goto(ORIGIN + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
        await page.waitForFunction('!!document.getElementById("cwsAdd") || (window.__mpWinsDbg && window.__mpWinsDbg.length)', { timeout: 30000 }).catch(() => {});
        await page.evaluate(() => { if (!(window.__mpWinsDbg && window.__mpWinsDbg.length)) { const a = document.getElementById('cwsAdd'); a && a.click(); } });
        await page.waitForFunction('window.__mpWinsDbg && window.__mpWinsDbg[0] && window.__mpWinsDbg[0].bars && window.__mpWinsDbg[0].bars.length>50 && window.__mpWinsDbg[0].dr', { timeout: 40000 });
        // put the right symbol + timeframe on the window directly (not via the model), so each run tests a known chart
        await page.evaluate((sym, tf) => { const w = window.__mpWinsDbg[0]; try { if (window.__mpAi.setTf) window.__mpAi.setTf(w, tf); } catch (e) {} try { if (window.__mpAi.setSym) window.__mpAi.setSym(w, sym); } catch (e) {} }, c.sym, c.tf);
        // wait for the RIGHT symbol's candles to be loaded AND the loading skeleton gone (a screenshot mid-reload scores the wrong frame)
        await page.waitForFunction((sym) => { const w = window.__mpWinsDbg[0]; if (!(w && String(w.sym) === sym && w.bars && w.bars.length > 50)) return false; const sk = w.el && w.el.querySelector('.cwin-skel'); return !sk || sk.offsetParent === null; }, { timeout: 40000 }, c.sym).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));
        // the panel is Premium-gated in the client, so the account must be restored before we send
        await page.waitForFunction('window.mpAuth && window.mpAuth.me && window.mpAuth.me()', { timeout: 40000 }).catch(() => {});
        // open the AI panel
        await page.evaluate(() => { const btn = document.querySelector('.cwin-ai'); if (btn) btn.click(); });
        await page.waitForFunction("!!document.querySelector('.cwin-ai-panel .cwin-ai-in input')", { timeout: 15000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 2200)); // let the panel's quota GET settle so aiPremium is true before we send
        // type a draw request and send it the way a reader would (no symbol switch - the chart is already set)
        await page.evaluate(() => {
          const p = document.querySelector('.cwin-ai-panel'); if (!p) return;
          const inp = p.querySelector('.cwin-ai-in input'); const send = p.querySelector('.cwin-ai-send');
          if (inp) { inp.value = 'Draw the full setup on this chart - structure, the key levels, and the trade if there is one.'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
          if (send) send.click();
          else if (inp) inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });
        // wait for the drawing to land (shapes tagged by:ai) - up to 40s for the stream + exec
        await page.waitForFunction('window.__mpWinsDbg[0].dr.shapes.filter(function(s){return s.by===\"ai\";}).length>0', { timeout: 45000 }).catch(() => {});
        // let the draw, the forecast candles and any zoom settle, and make sure nothing is still loading, before the shot
        await page.waitForFunction('(function(){var w=window.__mpWinsDbg[0];var sk=w.el&&w.el.querySelector(".cwin-skel");return !sk||sk.offsetParent===null;})()', { timeout: 10000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 3500));
        // collapse the /charts left workspace rail so it does not cover the plan legend (a real user hides it; the rail is a probe artifact)
        await page.evaluate(() => { try { var hide = [...document.querySelectorAll('button,a')].find(b => /^\s*hide\s*$/i.test(b.textContent || '')); if (hide && hide.offsetParent !== null) hide.click(); } catch (e) {}
          try { var r = document.querySelector('.cws-side, .cws-rail, .cws-left, #cwsSide'); if (r) r.style.display = 'none'; } catch (e) {} });
        await new Promise(r => setTimeout(r, 500));
        const info = await page.evaluate(() => {
          const w = window.__mpWinsDbg[0];
          const p = document.querySelector('.cwin-ai-panel');
          let plan = null; try { const h = window.__mpAi.histLoad({ sym: w.sym }); const ai = h.filter(m => m.role === 'ai').slice(-1)[0]; plan = ai && ai.plan || null; } catch (e) {}
          return { sym: w.sym, tf: w.tf, shapes: w.dr.shapes.filter(s => s.by === 'ai').length, plan };
        });
        // screenshot the chart window (the drawing)
        const el = await page.$('.cwin');
        const shotPath = path.join(SHOTDIR, c.sym + '-' + c.tf + '.png');
        let b64 = '';
        if (el) { await el.screenshot({ path: shotPath }); b64 = fs.readFileSync(shotPath).toString('base64'); }
        if (!b64) { results.push({ combo: c.sym + ':' + c.tf, error: 'no screenshot', shapes: info.shapes }); await page.close(); continue; }
        // post to the admin vision endpoint
        const vr = await fetch(ORIGIN + '/api/admin/visioncheck', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify({ image: b64, mediaType: 'image/png', plan: info.plan }) });
        const vj = await vr.json();
        results.push({ combo: info.sym + ':' + info.tf, shapes: info.shapes, verdict: vj.verdict || null, raw: vj.raw, err: vj.error, shot: shotPath, pageErrs: errs.slice(0, 2) });
      } catch (e) {
        results.push({ combo: c.sym + ':' + c.tf, error: String(e && e.message || e).slice(0, 160) });
      }
      await page.close();
    }
  });

  // report
  console.log('\n=== CHART AI DRAWING - VISION VERDICTS ===');
  let sum = 0, n = 0;
  for (const r of results) {
    if (r.verdict && typeof r.verdict.overall === 'number') { sum += r.verdict.overall; n++; }
    const v = r.verdict;
    console.log('\n' + r.combo + '   shapes=' + (r.shapes != null ? r.shapes : '?') + (r.error ? ('   ERROR: ' + r.error) : ''));
    if (v) {
      console.log('  overall ' + v.overall + '/5   anchored ' + v.anchored + '  onScreen ' + v.onScreen + '  legible ' + v.legible + '  matchesPlan ' + v.matchesPlan + '  clutter ' + v.clutter);
      if (v.issues && v.issues.length) v.issues.forEach(i => console.log('    - ' + i));
    } else if (r.raw) console.log('  (unparsed) ' + r.raw);
    else if (r.err) console.log('  endpoint error: ' + r.err);
    if (r.shot) console.log('  shot: ' + r.shot);
  }
  console.log('\n' + n + ' graded, mean overall ' + (n ? (sum / n).toFixed(2) : '-') + '/5. Shots in ' + SHOTDIR + ' - LOOK at them too.');

  // clean up the throwaway member
  try { await fetch(ORIGIN + '/api/admin/e2euser', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify({ uid, op: 'rm' }) }); } catch (e) {}
  process.exitCode = 0;
})().catch(e => { console.error(e); process.exit(1); });
