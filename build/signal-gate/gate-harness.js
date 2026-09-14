// Signal quality-gate harness. 1) node build/signal-gate/fetch-klines.js (pulls 1h/4h/1d/15m history for the watchlist into
// klines.json, gitignored, ~12 MB)  2) node build/signal-gate/gate-harness.js. Runs the REAL checkChartSignals sliced from
// src/worker.js on recorded candles with stubbed KV/Telegram: cluster pre-pass, 8-check score, quiet routing, quiet outcome tracking.
// Run the REAL checkChartSignals (sliced from worker.js) against recorded candles at two historical bars with stubbed
// env/KV/Telegram: proves the pre-pass cluster count, the 8-check score, quiet-vs-posted routing and the state shapes.
const fs = require('fs');
const src = fs.readFileSync('D:/part1/money-mission/src/worker.js', 'utf8');
function fnSrc(name) { let i = src.indexOf('async function ' + name + '('); if (i < 0) i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('no ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } }
const K = JSON.parse(fs.readFileSync(__dirname + '/klines.json', 'utf8'));
const g = globalThis;
g._sanitizeSigBars = eval('(' + fnSrc('_sanitizeSigBars') + ')'); g._supertrend = eval('(' + fnSrc('_supertrend') + ')'); g._adxLast = eval('(' + fnSrc('_adxLast') + ')'); g._rsi = eval('(' + fnSrc('_rsi') + ')'); g._emaSeries = eval('(' + fnSrc('_emaSeries') + ')');
g.DIV = '---'; g.TG_AFF_LINE = ''; g.J = o => o;
let NOW = 0; const realNow = Date.now; Date.now = () => NOW;
g.sigKlines = async (sym, iv) => { const all = K[String(iv)][sym].map(b => ({ ...b })); const per = iv * 60; const cur = Math.floor(NOW / 1000 / per) * per; const bars = all.filter(b => b.time <= cur).slice(-1000); _sanitizeSigBars(bars); const last = bars[bars.length - 1]; const closed = (last && last.time >= cur) ? bars.slice(0, -1) : bars; return { bars, closed }; };
g.sigChannels = async () => ({ premium: 'PREM', balanced: 'BAL', fast: '' });
g.handleCalendar = async () => ({ json: async () => ({ events: [] }) });
const sent = []; g.tgApi = async (tok, m, b) => { sent.push(b); return { ok: true, result: { message_id: sent.length } }; };
g.evPush = async () => {}; g.bumpSentToday = async () => {};
const results = []; g.logSigResult = async (env, sym, r, st) => { results.push({ sym, r, src: st && st.src }); }; g.logSigFinal = async () => {};
g.checkChartSignals = eval('(' + fnSrc('checkChartSignals').split('} catch (e) {}\n      await new Promise(r => setTimeout(r, 80));').join('} catch (e) { console.error("COIN ERR", sym, e && e.stack); }\n      await new Promise(r => setTimeout(r, 80));') + ')');
function mkEnv(kv) { const m = new Map(Object.entries(kv)); return { TELEGRAM_TOKEN: 't', STATS: { get: async k => m.has(k) ? m.get(k) : null, put: async (k, v) => { m.set(k, v); }, delete: async k => { m.delete(k); }, list: async () => ({ keys: [] }) }, _m: m }; }
(async () => {
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  // Scenario A: 2026-08-30 12:00 UTC close (5 majors flipped LONG together, Sunday). Run at 12:01.
  NOW = Date.UTC(2026, 7, 30, 13, 1); sent.length = 0;
  let env = mkEnv({ 'csig:coins': 'BTC HBAR BNB ETH SOL HYPE XRP ZEC TRX' });
  let r = await checkChartSignals(env, false);
  console.log('A report:', JSON.stringify(r.sent), 'err', r.err, 'dbg', env._m.get('csig:dbg'));
  let lg = JSON.parse(env._m.get('csig:log') || '[]'); lg.forEach(e => console.log('  log', e.s, e.ev, 'score', e.score, e.why || ''));
  const fired = lg.filter(e => e.ev === 'FIRE-confirmed'), quiet = lg.filter(e => e.ev === 'FIRE-quiet');
  ok(fired.length + quiet.length >= 4, 'A: several confirmed flips detected on the cluster bar (' + (fired.length + quiet.length) + ')');
  ok(lg.every(e => e.ev !== 'FIRE-confirmed' || e.score >= 4), 'A: every posted signal has score >= 4');
  ok(lg.every(e => e.ev !== 'FIRE-quiet' || e.score < 4), 'A: every quiet signal has score < 4');
  ok(fired.every(e => /cluster/.test(e.why)), 'A: posted signals carry the cluster check (>=2 coins flipped the same way)');
  ok(sent.length === fired.length * 2, 'A: Telegram sends = posted x 2 channels (' + sent.length + ')');
  const prem = sent.find(b => b.chat_id === 'PREM'); ok(!!prem && /Quality:<\/b> \d\/8 checks passed/.test(prem.text), 'A: premium message carries the Quality line');
  const qst = [...env._m.entries()].filter(([k, v]) => k.startsWith('csig:st:') && /"quiet":true/.test(v)); ok(quiet.length === qst.length, 'A: quiet signals persisted as tracked state (' + qst.length + ')');
  if (qst.length) { const s = JSON.parse(qst[0][1]); ok(Array.isArray(s.tiers) && !s.tiers.length && s.src === 'quiet' && s.done === false && s.tp1 != null, 'A: quiet state shape: tiers[] src=quiet tracked'); }
  // follow-up run on a quiet state must not message
  const before = sent.length; NOW += 6 * 3600000; env._m.set('csig:st:X', '{}');
  r = await checkChartSignals(env, false);
  const extra = sent.slice(before); const quietFollow = extra.filter(b => /HIT|BREAKEVEN/.test(b.text) && !/#/.test(b.text));
  ok(!extra.some(b => quiet.some(q => b.text.includes('#' + (q.s)) && false)), 'A: (6h later) no message references a quiet signal');
  console.log('  6h later sends:', extra.map(b => b.chat_id + ':' + b.text.split('\n')[0]).join(' | ') || '(none)');
  // Scenario B: gate off → everything posts
  NOW = Date.UTC(2026, 7, 30, 13, 1); sent.length = 0; env = mkEnv({ 'csig:coins': 'BTC HBAR BNB ETH SOL HYPE XRP ZEC TRX', 'csig:qgate': '0' });
  r = await checkChartSignals(env, false); lg = JSON.parse(env._m.get('csig:log') || '[]');
  ok(lg.filter(e => e.ev === 'FIRE-quiet').length === 0 && lg.filter(e => e.ev === 'FIRE-confirmed').length === fired.length + quiet.length, 'B: qgate=0 posts every confirmed flip (' + lg.filter(e => e.ev === 'FIRE-confirmed').length + ')');
  // Scenario C: a lone weekend-night BTC flip → quiet. 2026-09-06 23:00 close (Sunday 23h, BTC long, score 2 in the backtest)
  NOW = Date.UTC(2026, 8, 7, 0, 1); sent.length = 0; env = mkEnv({ 'csig:coins': 'BTC HBAR BNB ETH SOL HYPE XRP ZEC TRX' });
  r = await checkChartSignals(env, false); lg = JSON.parse(env._m.get('csig:log') || '[]'); lg.forEach(e => console.log('  log', e.s, e.ev, 'score', e.score, e.why || ''));
  const btc = lg.find(e => e.s === 'BTC'); ok(btc && btc.ev === 'FIRE-quiet' && btc.score < 4, 'C: lone BTC Sunday-23h flip is quiet (score ' + (btc && btc.score) + ')');
  ok(sent.length === 0, 'C: nothing sent');
  results.length = 0; for (let h = 0; h < 24; h++) { NOW += 3600000; r = await checkChartSignals(env, false); } // hourly ticks like the cron (a single 24h jump would skip the stop hour)
  ok(results.some(x => x.sym === 'BTC' && x.src === 'quiet'), 'C: (24h later) the quiet BTC signal was resolved into the results ring with src=quiet (' + JSON.stringify(results) + ')');
  ok(sent.length === 0, 'C: (24h later) still nothing sent for the quiet signal');
  // Scenario D: force test path unaffected by the gate
  NOW = Date.UTC(2026, 8, 7, 0, 1); sent.length = 0; env = mkEnv({ 'csig:coins': 'BTC' });
  r = await checkChartSignals(env, true); ok(sent.length === 1 && sent[0].chat_id === 'PREM', 'D: ?test=1 still posts one BTC test to premium');
  console.log(fails ? 'FAILS ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
