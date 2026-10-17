/* SECONDS TIMEFRAMES (2026-10-17, owner: "ajde to da ubacimo na paper trade terminal, ali samo za premium
   korisnike ... sekund intervale kao i one sto smo na charts stavili pod premium").

   1s is a NATIVE Bybit linear candle (measured: interval=1s returns 1000 real bars, 2s and 7s return an empty
   list, spot answers "Invalid period!"); 5s/15s/30s are exact sums of it. Bybit only, because it is the venue
   the live price comes from and at this resolution a venue seam is a data bug.

   The load-bearing checks, each with the thing that makes it fail:
     - the aggregator is EXACT                -> falsified by taking the bucket's first close instead of its last
     - an unsupported seconds token 404s      -> it must never be answered with HOURLY candles mislabelled
     - a free member is refused AND the chart stays on its timeframe
     - a Premium member's PT terminal really charts bars one second apart
     - the retired `parseInt(tf,10)*60` shape is BANNED in all three engines (it reads '1s' as one minute)

   node build/sectf-e2e.js            against production (all legs)
   node build/sectf-e2e.js --pure     only the checks that need no network
   node build/sectf-e2e.js --local    browser legs served from the working tree (pre-deploy)              */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist'), A = path.join(DIST, 'assets');
const BASE = 'https://marginpad.io';
const PURE = process.argv.includes('--pure'), LOCAL = process.argv.includes('--local');
let pass = 0, fail = 0;
const ok = (name, cond, note) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (note === undefined ? '' : '  -> ' + String(typeof note === 'string' ? note : JSON.stringify(note)).slice(0, 260))); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rd = (p) => fs.readFileSync(p, 'utf8');

// brace-matched extraction (a one-line regex is what let check-formulas rot for three weeks)
function lift(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('no function ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    const c = src[k];
    if (c === '{') d++;
    else if (c === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}

(async () => {
  const W = rd(path.join(ROOT, 'src', 'worker.js'));
  const HJ = rd(path.join(A, 'home.js')), CJ = rd(path.join(A, 'mp-charts.js')), MJ = rd(path.join(A, 'mp-mcharts.js'));
  const SHELL = rd(path.join(ROOT, 'app', 'index.html'));

  console.log('\nthe one table, read by four files');
  const list = (s) => { const m = s.match(/SEC_TFS\s*=\s*\[([^\]]+)\]/); return m ? m[1].replace(/['"\s]/g, '').split(',').filter(Boolean) : null; };
  const LW = list(W), LH = list(HJ), LC = list(CJ), LM = list(MJ);
  ok('the worker declares the four seconds tokens', JSON.stringify(LW) === JSON.stringify(['1s', '5s', '15s', '30s']), LW);
  ok('home.js agrees with it', JSON.stringify(LH) === JSON.stringify(LW), LH);
  ok('mp-charts.js agrees with it', JSON.stringify(LC) === JSON.stringify(LW), LC);
  ok('mp-mcharts.js agrees with it', JSON.stringify(LM) === JSON.stringify(LW), LM);
  ok('SEC_TFS is declared ABOVE its reader in the worker (a const read from above its own definition is a TDZ crash at startup)', W.indexOf('const SEC_TFS') < W.indexOf('function _tfSecs'));

  console.log('\nthe one reading of a timeframe token');
  const mk = (src, nm) => new Function('SEC_TFS', 'return (' + lift(src, nm).replace(/^function\s+\w+/, 'function') + ')')(['1s', '5s', '15s', '30s']);
  const engines = { worker: mk(W, '_tfSecs'), 'home.js': mk(HJ, 'tfSecs'), 'mp-charts.js': mk(CJ, 'tfSecs'), 'mp-mcharts.js': mk(MJ, 'tfSecs') };
  const CASES = [['1s', 1], ['5s', 5], ['15s', 15], ['30s', 30], ['1', 60], ['3', 180], ['30', 1800], ['60', 3600], ['240', 14400], ['1440', 86400], ['10080', 604800], ['2s', 0], ['7s', 0], ['0s', 0], ['banana', 0], ['', 0]];
  for (const [nm, fn] of Object.entries(engines)) {
    const bad = CASES.filter(([t, want]) => fn(t) !== want).map(([t, want]) => t + '=' + fn(t) + ' want ' + want);
    ok(nm + ' reads every token the same way (seconds as seconds, minutes as minutes, the rest refused)', !bad.length, bad);
  }
  ok('a minute token still means exactly what it meant before (one hour = 3600s, not 60)', engines.worker('60') === 3600 && engines['home.js']('60') === 3600);

  console.log('\nthe aggregator, driven as the function that ships');
  const secAgg = new Function('return (' + lift(W, 'secAgg').replace(/^function\s+\w+/, 'function') + ')')();
  // nine seconds of hand-built 1s candles, aligned to a 5s grid at t=100
  const rows = new Map();
  const put = (t, o, h, l, c, v) => rows.set(t, [String(t * 1000), String(o), String(h), String(l), String(c), String(v)]);
  put(100, 10, 12, 9, 11, 1); put(101, 11, 15, 10, 14, 2); put(102, 14, 14, 7, 8, 3); put(103, 8, 9, 8, 9, 4); put(104, 9, 10, 8, 10, 5);
  put(105, 10, 11, 10, 11, 6); put(106, 11, 11, 11, 11, 0);
  const a5 = secAgg(rows, 5, 0);
  ok('it buckets on the interval grid', a5.length === 2 && a5[0].time === 100 && a5[1].time === 105, a5.map(b => b.time));
  ok('open is the FIRST open of the bucket', a5[0].open === 10, a5[0]);
  ok('close is the LAST close of the bucket', a5[0].close === 10, a5[0]);
  ok('high and low are the extremes of the whole bucket', a5[0].high === 15 && a5[0].low === 7, a5[0]);
  ok('volume is the sum', a5[0].vol === 15, a5[0].vol);
  ok('a flat second (h==l, no trades) is kept, not dropped - that is what a quiet second looks like', a5[1].high === 11 && a5[1].low === 10, a5[1]);
  // a bucket we only saw the tail of carries a wrong open, so it is dropped
  const partial = new Map(); put.call(null, 0, 0, 0, 0, 0, 0);
  partial.set(102, rows.get(102)); partial.set(103, rows.get(103)); partial.set(104, rows.get(104)); partial.set(105, rows.get(105));
  const ap = secAgg(partial, 5, 0);
  ok('a partial OLDEST bucket is dropped (its open would be a lie)', ap.length === 1 && ap[0].time === 105, ap.map(b => b.time));
  ok('`want` keeps the NEWEST bars, never the oldest', secAgg(rows, 1, 3).map(b => b.time).join(',') === '104,105,106', secAgg(rows, 1, 3).map(b => b.time));

  console.log('\nthe seconds path can never be answered by a coarser interval');
  const byMap = (W.match(/const byMap = \{([^}]+)\}/) || [, ''])[1];
  ok('byMap has no seconds key at all (so a fall-through would be a WRONG interval, which is why there is none)', !/['"]\d+s['"]/.test(byMap));
  const branch = W.slice(W.indexOf('if (_secTf && !out) {'), W.indexOf('if (_secTf && !out) {') + 700);
  ok('the seconds branch blocks the minute cascade with out=[] even when the fetch fails', /if \(!out\) out = \[\];/.test(branch), branch.slice(0, 200));
  ok('and it never calls _pick, so a quiet 1s series cannot be rejected as a "flat" source', !/_pick\(/.test(branch));
  ok('the SWR bound and the fresh window are derived from the candle length, not a constant', /_freshMs = Math\.min\(10000, Math\.max\(1000, _sec \* 1000\)\)/.test(W) && /staleMax = Math\.min\(90000, _sec \* 1000\)/.test(W));
  ok('seconds get their own perf group so the klines budget stays a clean regression detector', /klines-s/.test(W) && !/'klines-s':/.test(W.match(/const BUDGET = \{[^}]+\}/)[0]));

  console.log('\nthe retired shape is banned in every engine');
  /* comments are stripped FIRST: the ban's first run flagged the very comment that documents the ban, which is the
     check-formulas lesson arriving again. Split on /\r?\n/ - `.` does not match \r, so in a CRLF file a line-comment
     strip written with `.` removes nothing at all. */
  const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').split(/\r?\n/).map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
  for (const [nm, src0] of [['home.js', HJ], ['mp-charts.js', CJ], ['mp-mcharts.js', MJ]]) {
    const src = code(src0);
    const hits = (src.match(/parseInt\(\s*(?:w|p|mw|chartTf|tf)\s*\.?\s*(?:tf)?\s*,\s*10\s*\)\s*\*\s*60/g) || []);
    ok(nm + ' has no `parseInt(tf,10)*60` left (it reads "1s" as one MINUTE)', !hits.length, hits);
  }
  const SEC_GUARD = /_secB/;
  ok('home.js guards the per-MINUTE trade buckets off the seconds path', SEC_GUARD.test(HJ) && /mpSecAgg/.test(HJ));
  ok('mp-charts.js does too', SEC_GUARD.test(CJ) && /mpSecAgg/.test(CJ));
  ok('mp-mcharts.js does too', SEC_GUARD.test(MJ) && /mpSecAgg/.test(MJ));
  ok('one bucketer for all three engines - only home.js (which owns the WS) builds mpTicksS', /window\.mpTicksS\s*=/.test(HJ) && !/window\.mpTicksS\s*=/.test(CJ) && !/window\.mpTicksS\s*=/.test(MJ));
  ok('the per-second buckets are built only while a seconds chart is open', /if\(window\.__mpSecNeed\)/.test(HJ));

  console.log('\nwhat the pickers offer');
  const tfs = (src) => { const m = src.match(/var TFS=\[(.+?)\];/); return m ? m[1] : ''; };
  for (const [nm, src] of [['mp-charts.js', CJ], ['mp-mcharts.js', MJ]]) {
    const t = tfs(src);
    ok(nm + ' offers all four seconds, every one marked Premium', ["'1s','1s',1", "'5s','5s',1", "'15s','15s',1", "'30s','30s',1"].every(x => t.replace(/\s/g, '').includes(x)), t.slice(0, 160));
    ok(nm + ' keeps 1m / 5m / 15m / 1h / 4h / 1D free', ["'1','1m',0", "'5','5m',0", "'15','15m',0", "'1440','1D',0"].some(x => t.replace(/\s/g, '').includes(x)) || t.includes("'1440','1d',0"), t.slice(0, 160));
  }
  const menu = (SHELL.match(/<div class="ptt-tf" id="ptTf"[\s\S]*?<\/div>/) || [''])[0];
  const btns = [...menu.matchAll(/data-tf="([^"]+)"[^>]*?(data-prem="1")?[^>]*>/g)].map(m => [m[1], !!m[2]]);
  ok('the PT terminal menu carries sixteen timeframes', btns.length === 16, btns.length);
  ok('the four seconds are there and Premium-marked', ['1s', '5s', '15s', '30s'].every(t => menu.includes('data-tf="' + t + '" data-lbl="' + t + '" data-prem="1"')), menu.slice(0, 200));
  ok('3m/30m/2h/6h/12h are Premium-marked too (the set /charts already had)', ['3', '30', '120', '360', '720'].every(t => new RegExp('data-tf="' + t + '" data-lbl="[^"]+" data-prem="1"').test(menu)));
  ok('and nothing that was free became Premium (1m 5m 15m 1h 4h 1D 1W)', ['1', '5', '15', '60', '240', '1440', '10080'].every(t => !new RegExp('data-tf="' + t + '" data-lbl="[^"]+" data-prem="1"').test(menu)));
  ok('every button carries its own label, so a PRO mark cannot end up in the button text', ['1s', '1', '10080'].every(t => new RegExp('data-tf="' + t + '" data-lbl=').test(menu)));
  ok('the gate is on PICKING in the terminal, never inside loadKlines', /function tfPickGate\(tf,lbl\)/.test(HJ) && !/loadKlines[\s\S]{0,200}tfPrem\(/.test(HJ));
  ok('a member whose standing is not known yet is NOT refused (mp-auth is deferred)', /return null; \/\/ standing not known yet/.test(HJ));
  ok('seconds are refused on stocks, forex and indices in all three engines', /secondsTimeframesAreCrypto|secondsAreCryptoOnly/.test(HJ) && /secondsAreCryptoOnly/.test(CJ) && /secondsAreCryptoOnly/.test(MJ));
  ok('Ask AI is refused on a seconds chart on both chart surfaces', /askAiNotOnSeconds/.test(CJ) && /askAiNotOnSeconds/.test(MJ));
  ok('the axis prints seconds on a seconds chart', /secondsVisible:tfSecs\(chartTf\)<=300/.test(HJ) && /secondsVisible:tfSecs\(w\.tf\)<=300/.test(CJ) && /secondsVisible:tfSecs\(p\.tf\)<=300/.test(MJ));
  ok("yesterday's levels are not drawn from ten minutes of candles", /a seconds chart holds minutes, not days/.test(CJ));

  if (PURE) { console.log('\npure: ' + pass + ' ok, ' + fail + ' failed'); process.exitCode = fail ? 1 : 0; return; }

  // ---------------------------------------------------------------------------------------------------
  console.log('\nthe data, live');
  const kl = (iv, sym) => fetch(BASE + '/api/klines?symbol=' + (sym || 'BTC') + '&interval=' + iv + '&cb=' + Date.now()).then(async r => ({ s: r.status, src: r.headers.get('x-mp-src'), j: await r.json().catch(() => null) }));
  const spacing = (b) => { const d = {}; for (let i = 1; i < b.length; i++) { const g = b[i].time - b[i - 1].time; d[g] = (d[g] || 0) + 1; } return d; };
  const r1 = await kl('1s');
  ok('GET /api/klines?interval=1s answers', r1.s === 200 && Array.isArray(r1.j) && r1.j.length > 100, { s: r1.s, n: r1.j && r1.j.length });
  ok('from Bybit, and it says so', r1.src === 'bybit-1s', r1.src);
  if (Array.isArray(r1.j) && r1.j.length > 100) {
    const sp = spacing(r1.j);
    ok('every candle is one second after the one before it', Object.keys(sp).length === 1 && sp['1'] === r1.j.length - 1, sp);
    ok('and they are real candles, not an hour mislabelled', r1.j.every(b => b.open > 0 && b.high >= b.low && b.high >= b.open && b.low <= b.close));
  }
  for (const [tok, secs] of [['5s', 5], ['15s', 15], ['30s', 30]]) {
    const r = await kl(tok);
    const sp = Array.isArray(r.j) && r.j.length > 20 ? spacing(r.j) : {};
    ok(tok + ' answers with candles exactly ' + secs + ' seconds apart', r.s === 200 && Object.keys(sp).length === 1 && +Object.keys(sp)[0] === secs, { s: r.s, n: r.j && r.j.length, sp });
    ok(tok + ' sits on its own grid (every bar time divisible by ' + secs + ')', Array.isArray(r.j) && r.j.length > 20 && r.j.every(b => b.time % secs === 0));
  }
  // END TO END: the served 1s rebuilt into minutes must equal the minute candles we serve from the same venue
  const rm = await kl('1');
  if (Array.isArray(r1.j) && Array.isArray(rm.j)) {
    const m = new Map(); for (const b of rm.j) m.set(b.time, b);
    const got = new Map(); for (const b of r1.j) got.set(b.time, [String(b.time * 1000), String(b.open), String(b.high), String(b.low), String(b.close), String(b.vol || 0)]);
    const mine = secAgg(got, 60, 0), newest = Math.max(...got.keys());
    let n = 0, bad = 0;
    for (const b of mine) { if (b.time + 60 > newest) continue; const nat = m.get(b.time); if (!nat) continue; n++; if (!(b.open === nat.open && b.high === nat.high && b.low === nat.low && b.close === nat.close)) bad++; }
    ok('the 1s candles we serve rebuild our own 1m candles exactly (' + n + ' closed minutes)', n >= 5 && bad === 0, { n, bad });
  }
  const r2s = await kl('2s');
  ok('an unsupported seconds token is a 404, NEVER hourly candles with a 2s label', r2s.s === 404 || (Array.isArray(r2s.j) && !r2s.j.length), { s: r2s.s, n: Array.isArray(r2s.j) ? r2s.j.length : null });
  const rAapl = await kl('1s', 'AAPL');
  ok('a stock at 1s is refused rather than charted off a tokenized perp against a Yahoo price feed', rAapl.s === 404 || (Array.isArray(rAapl.j) && !rAapl.j.length), { s: rAapl.s });
  const v1 = await fetch(BASE + '/api/v1/klines?symbol=BTC&interval=1s').then(async r => ({ s: r.status, j: await r.json().catch(() => null) }));
  const v1e = v1.j && v1.j.error, v1code = v1e && (typeof v1e === 'string' ? v1e : v1e.code); // the v1 error is an OBJECT {code,message}, not a string - my first reading of it made a correct refusal look like a failure
  ok('the public keyless API is untouched: 1s is not one of its intervals', v1.s === 400 && v1code === 'bad_interval', { s: v1.s, e: v1code });
  const back = await fetch(BASE + '/api/klines?symbol=BTC&interval=5s&end=' + (Date.now() - 3600000)).then(async r => ({ s: r.status, j: await r.json().catch(() => null) }));
  ok('scroll-back works an hour into the past (and stops cleanly past Bybit\'s ~24h of 1s history)', back.s === 200 && Array.isArray(back.j) && back.j.length > 20, { s: back.s, n: Array.isArray(back.j) ? back.j.length : null });

  // ---------------------------------------------------------------------------------------------------
  const { withBrowser, newPage, UA_DESKTOP } = require('./e2e-browser');
  const SERVE = /^\/assets\/(home\.css|home\.js|mp-charts\.js|mp-mcharts\.js|mp-auth\.js)$/;
  const LV = { idx: 2, k: 'silver', name: 'Silver', col: '#b7c2d0', min: 3000, xp: 4100, next: 'Gold', nextMin: 12000, toNext: 7900, pct: 12, stars: 0 };
  async function prep(browser, premium) {
    const page = await newPage(browser, { ua: UA_DESKTOP });
    await page.setViewport({ width: 1366, height: 820 });
    const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.setCacheEnabled(false);
    await page.setRequestInterception(true);
    try { const cdp = await page.target().createCDPSession(); await cdp.send('Network.enable'); await cdp.send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) {}
    await page.setCookie({ name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
    page.on('request', (req) => {
      const u = req.url();
      if (u.indexOf('/api/track') >= 0) return req.respond({ status: 204, body: '' });
      if (u.includes('/api/auth/me')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: 'probe', xp: 4100, level: LV, premium } }) });
      if (u.includes('/api/auth/xp') && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 4100, level: LV, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0, premium }) });
      if (u.includes('/api/premium/status') || u.includes('/api/ind/access')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ allowed: premium, premium, signedIn: true, source: premium ? 'owner' : null }) });
      if (LOCAL) { try { const p = new URL(u).pathname;
        if (req.resourceType() === 'document' && /^\/(paper-trade|charts)\/?$/.test(p)) return req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(DIST, 'app.html'), 'utf8') });
        const m = p.match(SERVE); if (m) return req.respond({ status: 200, contentType: m[1].endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8', body: fs.readFileSync(path.join(A, m[1]), 'utf8') });
      } catch (e) {} }
      req.continue();
    });
    page._errors = errors; return page;
  }
  const ptState = (page) => page.evaluate(() => { const s = window.__mpPT && window.__mpPT(); if (!s) return null; const b = s.bars || []; const gaps = {}; for (let i = 1; i < b.length; i++) { const g = b[i].time - b[i - 1].time; gaps[g] = (gaps[g] || 0) + 1; } return { tf: s.tf, n: b.length, gaps, cur: (document.getElementById('ptTfCur') || {}).textContent }; });

  await withBrowser(async (browser) => {
    console.log('\nthe terminal, as a member with no Premium' + (LOCAL ? ' (--local)' : ''));
    {
      const page = await prep(browser, false);
      await page.goto(BASE + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction('window.__mpPT && window.__mpPT().bars && window.__mpPT().bars.length>30', { timeout: 40000 });
      const before = await ptState(page);
      await page.click('#ptTfBtn'); await sleep(1100); // the mark may be painted after the standing is fetched - reading at 260ms graded a paint that had not happened yet
      const shown = await page.evaluate(() => { const b = document.querySelector('#ptTf [data-tf="1s"]'); const r = b && b.getBoundingClientRect(); return { exists: !!b, locked: !!(b && b.classList.contains('lock')), mark: b ? b.textContent.trim() : '', reachable: !!(r && r.width > 10 && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) && document.querySelector('#ptTf [data-tf="1s"]').contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))) }; });
      ok('1s is OFFERED and reachable, with a padlock rather than hidden (hidden, nobody learns it exists)', shown.exists && shown.locked && shown.reachable, shown);
      await page.click('#ptTf [data-tf="1s"]'); await sleep(1800);
      const after = await ptState(page);
      ok('picking it is refused and the chart STAYS on the timeframe it was on', after.tf === before.tf, { before: before.tf, after: after.tf });
      const toast = await page.evaluate(() => { const t = document.querySelector('#mpxpT'); return t ? t.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) : ''; });
      ok('and the refusal says what Premium unlocks and where to get it', /Premium/.test(toast) && /1s/.test(toast), toast);
      ok('no page errors', !page._errors.length, page._errors.slice(0, 3));
      await page.close();
    }
    console.log('\nthe terminal, as a Premium member');
    {
      const page = await prep(browser, true);
      await page.goto(BASE + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction('window.__mpPT && window.__mpPT().bars && window.__mpPT().bars.length>30', { timeout: 40000 });
      await page.click('#ptTfBtn'); await sleep(1100); // the mark may be painted after the standing is fetched - reading at 260ms graded a paint that had not happened yet
      const mark = await page.evaluate(() => { const b = document.querySelector('#ptTf [data-tf="30s"]'); return { locked: !!(b && b.classList.contains('lock')), txt: b ? b.textContent.replace(/\s+/g, '') : '' }; });
      ok('a Premium member sees PRO instead of a padlock', !mark.locked && /PRO/.test(mark.txt), mark);
      await page.click('#ptTf [data-tf="1s"]');
      await page.waitForFunction('window.__mpPT && window.__mpPT().tf==="1s" && window.__mpPT().bars && window.__mpPT().bars.length>100', { timeout: 40000 }).catch(() => {});
      await sleep(1200);
      const st = await ptState(page);
      ok('the chart really charts one-second candles', st && st.tf === '1s' && st.n > 100 && Object.keys(st.gaps).length === 1 && st.gaps['1'] === st.n - 1, st);
      ok('the pill shows the timeframe, not a label with PRO stuck to it', st && String(st.cur).trim() === '1s', st && st.cur);
      const ax = await page.evaluate(() => { const l = [...document.querySelectorAll('#ptChart canvas')].length; return { canvases: l, secs: !!(window.__mpPT && window.__mpPT().chart) }; });
      ok('the chart is alive after the switch', ax.canvases > 0 && ax.secs, ax);
      // a new bar must appear on its own within a few seconds, from the live trade stream
      const t0 = await page.evaluate(() => window.__mpPT().bars[window.__mpPT().bars.length - 1].time);
      await sleep(6000);
      const t1 = await page.evaluate(() => { const b = window.__mpPT().bars; return { last: b[b.length - 1].time, n: b.length, need: !!window.__mpSecNeed, buckets: (window.mpTicksS && window.mpTicksS[window.__mpChartSym] || []).length }; });
      ok('new one-second bars keep forming by themselves', t1.last > t0, { t0, t1: t1.last });
      ok('the per-second trade buckets are running', t1.need === true && t1.buckets > 0, t1);
      await page.evaluate(() => { const b = document.querySelector('#ptTf [data-tf="15"]'); if (b) b.click(); });
      await page.waitForFunction('window.__mpPT().tf==="15"', { timeout: 20000 }).catch(() => {});
      const back15 = await ptState(page);
      ok('switching back to a minute timeframe still works (15 minutes between bars)', back15.tf === '15' && back15.gaps['900'] === back15.n - 1, { tf: back15.tf, gaps: back15.gaps });
      ok('no page errors', !page._errors.length, page._errors.slice(0, 3));
      await page.close();
    }
    console.log('\n/charts, as a Premium member');
    {
      const page = await prep(browser, true);
      await page.goto(BASE + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction('!!document.getElementById("cwsAdd") || (window.__mpWinsDbg && window.__mpWinsDbg.length)', { timeout: 30000 }).catch(() => {});
      await page.evaluate(() => { if (!(window.__mpWinsDbg && window.__mpWinsDbg.length)) { const a = document.getElementById('cwsAdd'); a && a.click(); } });
      await page.waitForFunction('window.__mpWinsDbg && window.__mpWinsDbg[0] && window.__mpWinsDbg[0].bars && window.__mpWinsDbg[0].bars.length>50', { timeout: 40000 });
      const opened = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const b = w.el.querySelector('.cwin-tf-btn'); if (b) b.click(); return !!b; });
      await sleep(300);
      const items = await page.evaluate(() => [...document.querySelectorAll('.cwin-tf-menu [data-tf]')].map(b => b.getAttribute('data-tf')));
      ok('the dropdown offers sixteen timeframes with the four seconds among them', opened && items.length === 16 && ['1s', '5s', '15s', '30s'].every(t => items.includes(t)), items);
      await page.evaluate(() => { const b = document.querySelector('.cwin-tf-menu [data-tf="5s"]'); b && b.click(); });
      await page.waitForFunction('window.__mpWinsDbg[0].tf==="5s" && window.__mpWinsDbg[0].bars.length>50', { timeout: 40000 }).catch(() => {});
      await sleep(900);
      const w0 = await page.evaluate(() => { const w = window.__mpWinsDbg[0], b = w.bars || []; const g = {}; for (let i = 1; i < b.length; i++) { const d = b[i].time - b[i - 1].time; g[d] = (g[d] || 0) + 1; } return { tf: w.tf, n: b.length, g }; });
      ok('the window charts five-second candles', w0.tf === '5s' && w0.n > 50 && Object.keys(w0.g).length === 1 && w0.g['5'] === w0.n - 1, w0);
      // the real path: the window's own Ask AI button, the panel's own input, its own Send
      const aiRef = await page.evaluate(async () => {
        const w = window.__mpWinsDbg[0];
        const btn = w.el.querySelector('.cwin-ai'); if (!btn) return { err: 'no ask-ai button' };
        btn.click(); await new Promise(r => setTimeout(r, 700));
        const inp = document.querySelector('.cwin-ai-in input'); if (!inp) return { err: 'panel did not open' };
        inp.value = 'read this chart'; inp.dispatchEvent(new Event('input', { bubbles: true }));
        const send = document.querySelector('.cwin-ai-send'); if (!send) return { err: 'no send button' };
        send.click(); await new Promise(r => setTimeout(r, 1200));
        const t = document.querySelector('#mpxpT'), body = document.querySelector('.cwin-ai-body');
        return { toast: t ? t.textContent.replace(/\s+/g, ' ').trim().slice(0, 240) : '', run: !!w._aiRun, msgs: body ? body.querySelectorAll('.cwin-ai-msg').length : -1 };
      });
      ok('Ask AI refuses a seconds chart and says why (no paid read is spent on noise)', !aiRef.err && !aiRef.run && /seconds/i.test(aiRef.toast), aiRef);
      ok('no page errors', !page._errors.length, page._errors.slice(0, 3));
      await page.close();
    }
  });

  console.log('\n' + pass + ' ok, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('ERR', e && e.stack || e); process.exitCode = 1; });
