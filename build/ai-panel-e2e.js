/* ASK AI v2 - the panel as a VIEW of a read that runs on its window (2026-10-15, owner: "kad se otvori ask ai chat treba
   da izgleda mnogo vise cool ... ako korisnik klikne negde pa se vrati, to treba da tece neometano ... korisnik moze da
   bira 5-10 strategija ... samo overall analiza").

   Desktop: the mode strip (Find a trade / Analysis only) and the strategy picker exist, persist, and ride on the request;
   the status line walks reading -> writing -> done; a read answered while the panel was CLOSED and another window's panel
   was open still lands in its own thread, lights the window's Ask AI button and toasts; an analysis-mode answer renders
   the ANALYSIS card with levels and no entry, and draws no plan lines. Phone: the same strip and status on the sheet, and
   a read that outlives the sheet being closed and reopened. The model is canned (SSE built from the request's own price),
   so this runs --local before a deploy and against production after.

   node build/ai-panel-e2e.js [--local] */
const fs = require('fs'), path = require('path');
const { withBrowser, newPage, UA_DESKTOP, UA_MOBILE } = require('./e2e-browser');
const BASE = 'https://marginpad.io', DIST = path.join(__dirname, '..', 'dist'), A = path.join(DIST, 'assets');
const LOCAL = process.argv.includes('--local');
let pass = 0, fail = 0;
const ok = (name, cond, note) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (note ? '  -> ' + String(typeof note === 'string' ? note : JSON.stringify(note)).slice(0, 300) : '')); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SERVE = /^\/assets\/(home\.css|home\.js|mp-charts\.js|mp-mcharts\.js|mp-auth\.js)$/;
const LV = { idx: 2, k: 'silver', name: 'Silver', col: '#b7c2d0', min: 3000, xp: 4100, next: 'Gold', nextMin: 12000, toNext: 7900, pct: 12, stars: 0 };
const sse = (text) => { const parts = []; for (let i = 0; i < text.length; i += 48) parts.push(text.slice(i, i + 48)); return parts.map(t => 'event: content_block_delta\ndata: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }) + '\n\n').join('') + 'event: message_stop\ndata: {"type":"message_stop"}\n\n'; };
function answerFor(body) {
  const px = +((body.context || {}).price) || 100, r = (v) => +(px * v).toFixed(px > 100 ? 1 : 4);
  if (body.mode === 'analysis') return '**The map.** Structure is a range between ' + r(0.97) + ' and ' + r(1.03) + '; the money sits in the long pool under ' + r(0.96) + '.\n\n```plan\n' + JSON.stringify({ bias: 'analysis', lean: 'bullish', confidence: 61, levels: [{ price: r(1.03), label: 'Range top', kind: 'resistance' }, { price: r(0.97), label: 'Range low', kind: 'support' }, { price: r(0.96), label: 'Long liqs', kind: 'liquidity' }], watch: 'A close above the range top turns the lean to trending.' }) + '\n```\n```actions\n' + JSON.stringify({ actions: [{ a: 'draw', shape: 'level', p: r(1.03), barsAgo: 6, label: 'Range top' }, { a: 'draw', shape: 'zone', from: r(0.955), to: r(0.965), label: 'Long liqs' }], chips: ['What flips the lean?', 'Which level matters most?'] }) + '\n```';
  /* a trade the chart will call a trade: entry inside this market's reach, stop 1.5% away (past any 1h ATR floor), 2x paid */
  return '**Long bias, on a pullback.** Buy the hold at ' + r(0.998) + ', stop under ' + r(0.985) + ', target ' + r(1.03) + '.\n\n```plan\n' + JSON.stringify({ bias: 'long', confidence: 64, reason: 'Pullback to support inside an uptrend.', entry: r(0.998), stop: r(0.985), targets: [r(1.03), r(1.05)], invalidation: 'A close under ' + r(0.985), horizonBars: 30, leverage: 5, levels: [{ price: r(1.03), label: 'Range top', kind: 'resistance' }] }) + '\n```\n```actions\n' + JSON.stringify({ actions: [{ a: 'draw', shape: 'ray', p1: r(0.97), barsAgo1: 40, p2: r(0.99), barsAgo2: 8, label: 'Rising lows' }, { a: 'draw', shape: 'level', p: r(1.03), barsAgo: 6, label: 'Range top' }], chips: ['Why that entry?', 'What kills it?'] }) + '\n```';
}
async function prep(browser, mobile, w, h, delays) {
  const page = await newPage(browser, { mobile, ua: mobile ? UA_MOBILE : UA_DESKTOP });
  await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const errors = [], posts = []; page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.setCacheEnabled(false); await page.setRequestInterception(true);
  try { const cdp = await page.target().createCDPSession(); await cdp.send('Network.enable'); await cdp.send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) {}
  await page.setCookie({ name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
  page.on('request', (req) => {
    const u = req.url();
    if (u.indexOf('/api/track') >= 0) return req.respond({ status: 204, body: '' });
    if (u.includes('/api/auth/me')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: 'probe', xp: 4100, level: LV, premium: true } }) });
    if (u.includes('/api/auth/xp') && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 4100, level: LV, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
    if (u.includes('/api/premium/status') || u.includes('/api/ind/access')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ allowed: true, premium: true, signedIn: true, source: 'owner' }) });
    if (u.includes('/api/ai/chart')) {
      if (req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('hist=') ? { ok: true, msgs: [] } : { signedIn: true, premium: true, used: 1, limit: 50, ai: true, strategies: [{ id: 'auto', name: 'Any setup', short: 'Auto' }, { id: 'trend_pullback', name: 'Trend pullback', short: 'Pullback' }, { id: 'breakout', name: 'Breakout and retest', short: 'Breakout' }, { id: 'mean_reversion', name: 'Range mean reversion', short: 'Range' }, { id: 'swing', name: 'Swing with HTF structure', short: 'Swing' }] }) });
      let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
      if (b.op === 'hist') return req.respond({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      posts.push({ mode: b.mode, strategy: b.strategy, q: b.question, hasCtx: !!(b.context && b.context.symbol), hasImg: !!b.image });
      const d = delays.shift() || 0;
      const go = () => req.respond({ status: 200, contentType: 'text/event-stream; charset=utf-8', headers: { 'x-ai-used': String(posts.length + 1), 'x-ai-limit': '50' }, body: sse(answerFor(b)) });
      if (d) setTimeout(go, d); else go(); return;
    }
    if (LOCAL) { try { const p = new URL(u).pathname;
      if (req.resourceType() === 'document' && /^\/charts\/?$/.test(p)) return req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(DIST, 'app.html'), 'utf8') });
      const m = p.match(SERVE); if (m) return req.respond({ status: 200, contentType: m[1].endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8', body: fs.readFileSync(path.join(A, m[1]), 'utf8') });
    } catch (e) {} }
    req.continue();
  });
  page._errors = errors; page._posts = posts; return page;
}
const killToasts = (page) => page.evaluate(() => { const t = document.getElementById('mpxpT'); if (t) t.innerHTML = ''; });

withBrowser(async (browser) => {
  console.log('\ndesktop 1366x768' + (LOCAL ? ' (--local)' : ''));
  {
    const delays = [0, 3000, 0];
    const page = await prep(browser, false, 1366, 768, delays);
    await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('mp_ai_mode'); localStorage.removeItem('mp_ai_strat'); } catch (e) {} });
    await page.goto(BASE + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction('!!document.getElementById("cwsAdd") || (window.__mpWinsDbg && window.__mpWinsDbg.length)', { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => { if (!(window.__mpWinsDbg && window.__mpWinsDbg.length)) { const a = document.getElementById('cwsAdd'); a && a.click(); } });
    await page.waitForFunction('window.__mpWinsDbg && window.__mpWinsDbg[0] && window.__mpWinsDbg[0].bars && window.__mpWinsDbg[0].bars.length>50', { timeout: 40000 });
    await page.evaluate(() => { const w = window.__mpWinsDbg[0]; w.el.style.left = '0px'; w.el.style.top = '0px'; w.el.style.width = '760px'; w.el.style.height = '520px'; });
    await sleep(500); await killToasts(page);
    await page.evaluate(() => { window.__mpWinsDbg[0].el.querySelector('.cwin-ai').click(); });
    await page.waitForFunction("!!document.querySelector('.cwin-ai-panel') && !document.querySelector('.cwin-ai-panel').hidden", { timeout: 15000 });
    await sleep(400);
    const m0 = await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); return { strip: !!p.querySelector('.cwin-ai-mode'), tradeOn: p.querySelector('[data-mode="trade"]').classList.contains('on'), strat: p.querySelector('.aim-strat-name').textContent, status: p.querySelector('.cwin-ai-status').getAttribute('data-st'), statusTxt: p.querySelector('.cwin-ai-status span').textContent }; });
    ok('the panel opens with the mode strip, Find a trade on, strategy Any setup, status Ready', m0.strip && m0.tradeOn && /Any setup/.test(m0.strat) && m0.status === 'idle', m0);
    await page.evaluate(() => { document.querySelector('.cwin-ai-panel [data-mode="analysis"]').click(); }); await sleep(200);
    const m1 = await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); return { cls: p.classList.contains('mode-analysis'), ls: localStorage.getItem('mp_ai_mode'), stratOff: p.querySelector('.aim-strat').disabled, chips: [...p.querySelectorAll('.cwin-ai-chips .cwin-ai-chip')].map(c => c.textContent), empty: (p.querySelector('.aimsg-modeline') || {}).textContent || '' }; });
    ok('Analysis only switches the panel, is remembered, parks the strategy picker and swaps the chips', m1.cls && m1.ls === 'analysis' && m1.stratOff && /Map the chart/.test(m1.chips.join('|')) && /Analysis only is on/.test(m1.empty), m1);
    await page.evaluate(() => { document.querySelector('.cwin-ai-panel [data-mode="trade"]').click(); document.querySelector('.cwin-ai-panel [data-stratpick]').click(); }); await sleep(200);
    const m2 = await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); const pop = p.querySelector('.aim-pop'); return { open: !pop.hidden, n: pop.querySelectorAll('[data-strat]').length }; });
    ok('the strategy picker opens with the worker\'s list (five here)', m2.open && m2.n === 5, m2);
    await page.evaluate(() => { document.querySelector('.cwin-ai-panel [data-strat="breakout"]').click(); }); await sleep(200);
    const m3 = await page.evaluate(() => ({ name: document.querySelector('.cwin-ai-panel .aim-strat-name').textContent, ls: localStorage.getItem('mp_ai_strat') }));
    ok('picking Breakout is shown and remembered', /Breakout/.test(m3.name) && m3.ls === 'breakout', m3);
    // first read: trade mode + breakout, instant answer
    await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); const i = p.querySelector('.cwin-ai-in input'); i.value = 'Read this chart'; p.querySelector('.cwin-ai-send').click(); });
    await page.waitForFunction("document.querySelector('.cwin-ai-panel .cwin-ai-status').getAttribute('data-st')==='done'", { timeout: 20000 }).catch(() => {});
    await sleep(400);
    const r1 = await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); const w = window.__mpWinsDbg[0]; const h = JSON.parse(localStorage.getItem('mp_ai_s_' + w.sym) || '[]'); const last = h.filter(m => m.role === 'ai').pop() || {}; return { st: p.querySelector('.cwin-ai-status').getAttribute('data-st'), stTxt: p.querySelector('.cwin-ai-status span').textContent, card: !!p.querySelector('.aiplan-card[data-bias="long"]'), cardBias: (p.querySelector('.aiplan-card') || {}).getAttribute && p.querySelector('.aiplan-card').getAttribute('data-bias'), acts: !!p.querySelector('.aiacts'), rej: last.rej, actsRec: last.acts, planLines: (w._aiPlan || []).length, aiShapes: w.dr.shapes.filter(s => s.by === 'ai').length, busyBtn: w.el.querySelector('.cwin-ai').classList.contains('busy') }; });
    const p1 = page._posts[0] || {};
    ok('the request carries mode trade + strategy breakout + the brief', p1.mode === 'trade' && p1.strategy === 'breakout' && p1.hasCtx, p1);
    ok('the answer lands: status All set with the receipt, the plan card, plan lines and the AI shape drawn, button no longer busy', r1.st === 'done' && r1.card && r1.acts && r1.planLines >= 3 && r1.aiShapes >= 1 && !r1.busyBtn, r1);
    // second read answered in 3 s: close the panel at once, open ANOTHER window's panel meanwhile
    await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); const i = p.querySelector('.cwin-ai-in input'); i.value = 'And now?'; p.querySelector('.cwin-ai-send').click(); });
    await sleep(300);
    const b1 = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; return { st: document.querySelector('.cwin-ai-panel .cwin-ai-status').getAttribute('data-st'), busyBtn: w.el.querySelector('.cwin-ai').classList.contains('busy'), run: !!w._aiRun }; });
    ok('while waiting the status reads reading/thinking and the window\'s Ask AI button is marked busy', /^(reading|thinking)$/.test(b1.st) && b1.busyBtn && b1.run, b1);
    await page.evaluate(() => { document.querySelector('.cwin-ai-panel .cwin-ai-x').click(); });
    await page.evaluate(() => { const a = document.getElementById('cwsAdd'); a && a.click(); });
    await page.waitForFunction('window.__mpWinsDbg.length>=2 && window.__mpWinsDbg[1].bars && window.__mpWinsDbg[1].bars.length>50', { timeout: 40000 });
    await page.evaluate(() => { const w2 = window.__mpWinsDbg[1]; w2.el.style.left = '780px'; w2.el.style.top = '0px'; w2.el.style.width = '540px'; w2.el.style.height = '520px'; w2.el.querySelector('.cwin-ai').click(); });
    await sleep(300);
    const b2 = await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); return { shown: !p.hidden, sym: p.querySelector('.cwin-ai-sym').textContent, streaming: !!p.querySelector('.aimsg.streaming'), first: !!window.__mpWinsDbg[0]._aiRun }; });
    ok('the second window\'s panel opens clean while the first window\'s read is still running', b2.shown && !b2.streaming && b2.first, b2);
    await page.waitForFunction('!window.__mpWinsDbg[0]._aiRun', { timeout: 20000 }).catch(() => {});
    await sleep(500);
    const b3 = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const t = document.getElementById('mpxpT'); const h = JSON.parse(localStorage.getItem('mp_ai_s_' + w.sym) || '[]'); return { done: w.el.querySelector('.cwin-ai').classList.contains('done'), toast: !!(t && /Ask AI is done/.test(t.textContent)), answers: h.filter(m => m.role === 'ai').length, st: (w._aiSt || {}).st }; });
    ok('the first read finished in the background: its thread holds both answers, the window\'s button lights up and a toast says so', b3.answers === 2 && b3.done && b3.toast && b3.st === 'done', b3);
    await page.evaluate(() => { window.__mpWinsDbg[0].el.querySelector('.cwin-ai').click(); }); await sleep(400);
    const b4 = await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); const w = window.__mpWinsDbg[0]; return { sym: p.querySelector('.cwin-ai-sym').textContent.split(' ')[0], cards: p.querySelectorAll('.aiplan-card').length, st: p.querySelector('.cwin-ai-status').getAttribute('data-st'), doneCleared: !w.el.querySelector('.cwin-ai').classList.contains('done'), streaming: !!p.querySelector('.aimsg.streaming') }; });
    ok('reopening the first window\'s panel shows the finished thread (two cards), status All set, nothing still streaming', b4.cards === 2 && b4.st === 'done' && b4.doneCleared && !b4.streaming, b4);
    // analysis mode read
    await page.evaluate(() => { document.querySelector('.cwin-ai-panel [data-mode="analysis"]').click(); }); await sleep(150);
    await page.evaluate(() => { document.querySelector('.cwin-ai-panel .cwin-ai-chips .cwin-ai-chip').click(); });
    await page.waitForFunction("document.querySelector('.cwin-ai-panel .cwin-ai-status').getAttribute('data-st')==='done'", { timeout: 20000 }).catch(() => {});
    await sleep(400);
    const p3 = page._posts[2] || {};
    const a1 = await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); const w = window.__mpWinsDbg[0]; const c = [...p.querySelectorAll('.aiplan-card')].pop(); return { an: !!(c && c.classList.contains('aiplan-an')), head: c ? c.querySelector('.aipc-b').textContent : '', entryRow: !!(c && c.querySelector('.aipr.e')), levels: c ? c.querySelectorAll('.aipc-lv-rows .aipr').length : 0, watch: !!(c && /Watch/.test(c.textContent)), planLines: (w._aiPlan || []).length, zones: w.dr.shapes.filter(s => s.by === 'ai').length }; });
    ok('an analysis read sends mode analysis and no strategy', p3.mode === 'analysis' && !p3.strategy, p3);
    ok('the ANALYSIS card: lean + levels + watch, no entry row, no plan lines, the zones drawn as shapes', a1.an && /ANALYSIS/.test(a1.head) && !a1.entryRow && a1.levels === 3 && a1.watch && a1.planLines === 0 && a1.zones >= 2, a1);
    ok('no page errors on the desktop', !page._errors.length, page._errors);
    await page.close();
  }
  console.log('\nphone 390x844' + (LOCAL ? ' (--local)' : ''));
  {
    const delays = [2500];
    const page = await prep(browser, true, 390, 844, delays);
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('mp_ai_mode', 'analysis'); localStorage.removeItem('mp_ai_strat'); } catch (e) {} });
    await page.goto(BASE + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction('window.__mpMfcDbg && window.__mpMfcDbg()[0] && window.__mpMfcDbg()[0].bars && window.__mpMfcDbg()[0].bars.length>50', { timeout: 40000 }); await sleep(600);
    await killToasts(page);
    await page.tap('.mfc-bar [data-act="ai"]'); await page.waitForSelector('.mfc-sheet #mfcAB', { timeout: 10000 }); await sleep(400);
    const s0 = await page.evaluate(() => { const b = document.querySelector('.mfc-sheet'); return { strip: !!b.querySelector('.mfc-ai-mode'), anOn: b.querySelector('[data-mode="analysis"]').classList.contains('on'), st: b.querySelector('#mfcAST').getAttribute('data-st'), chips: [...b.querySelectorAll('#mfcAC .cwin-ai-chip')].map(c => c.textContent) }; });
    ok('the sheet carries the mode strip (Analysis only remembered from the desktop key), the status line and analysis chips', s0.strip && s0.anOn && s0.st === 'idle' && /Map the chart/.test(s0.chips.join('|')), s0);
    await page.evaluate(() => { document.querySelector('.mfc-sheet #mfcAC .cwin-ai-chip').click(); }); await sleep(300);
    const s1 = await page.evaluate(() => { const b = document.querySelector('.mfc-sheet'); return { st: b.querySelector('#mfcAST').getAttribute('data-st'), run: !!window.__mpMfcDbg()[0]._aiRun }; });
    ok('the read starts: status reading and a run on the pane', /^(reading|thinking)$/.test(s1.st) && s1.run, s1);
    await page.evaluate(() => { const x = document.querySelector('.mfc-sheet [data-x]'); x && x.click(); }); await sleep(300);
    const s2 = await page.evaluate(() => ({ sheet: !!document.querySelector('.mfc-sheet #mfcAB'), run: !!window.__mpMfcDbg()[0]._aiRun }));
    ok('closing the sheet does not stop the read', !s2.sheet && s2.run, s2);
    await page.tap('.mfc-bar [data-act="ai"]'); await page.waitForSelector('.mfc-sheet #mfcAB', { timeout: 10000 }); await sleep(300);
    const s3 = await page.evaluate(() => { const b = document.querySelector('.mfc-sheet'); return { streaming: !!b.querySelector('.mfc-ai-msg.streaming'), st: b.querySelector('#mfcAST').getAttribute('data-st') }; });
    ok('reopening mid-read re-attaches the streaming bubble', s3.streaming && /^(reading|thinking|writing)$/.test(s3.st), s3);
    await page.waitForFunction('!window.__mpMfcDbg()[0]._aiRun', { timeout: 20000 }).catch(() => {}); await sleep(500);
    const s4 = await page.evaluate(() => { const b = document.querySelector('.mfc-sheet'); return { st: b.querySelector('#mfcAST').getAttribute('data-st'), an: !!b.querySelector('.aiplan-an'), streaming: !!b.querySelector('.mfc-ai-msg.streaming'), post: null }; });
    ok('it finishes in the same bubble: status All set, the ANALYSIS card in the sheet', s4.st === 'done' && s4.an && !s4.streaming, s4);
    ok('the phone request carried mode analysis', (page._posts[0] || {}).mode === 'analysis', page._posts[0]);
    ok('no page errors on the phone', !page._errors.length, page._errors);
    await page.close();
  }
  console.log('\nai-panel-e2e' + (LOCAL ? ' (--local)' : '') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
}, { timeoutMs: 600000 });
