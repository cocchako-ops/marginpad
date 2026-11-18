// Autopilot: the bot that executes Premium signals on a member's Binance account (2026-11-18).
// --pure (default here): the SHIPPED src/autotrade.js driven against its own virtual exchange - sizing, entry, the stop
// before anything else, TP1 -> stop to entry, TP2, the loss, the flip exit, a hand-opened position left alone, a refused
// stop closing the position at once, a vanished stop put back, the day-loss brake. Every money rule is a check here.
// --prod: the routes refuse a stranger, the page is a 404 to a non-member, the forwarder refuses a withdrawal path.
const path = require('path'), fs = require('fs');
const PROD = process.argv.includes('--prod');
let pass = 0, fail = 0; const ok = (c, m, d) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m + (d ? '  ' + JSON.stringify(d).slice(0, 300) : '')); } };
(async () => {
  const A = await import('file:///' + path.resolve(__dirname, '../src/autotrade.js').replace(/\\/g, '/'));
  const F = { step: 0.001, minQty: 0.001, tick: 0.1, minNotional: 5, maxQty: 1e9 };
  const cfg = A.apCfgNorm({ risk: 2, levCap: 20, maxOpen: 6, maxRisk: 12, dayLoss: 6 });
  // ---- the plan ----
  const sigL = { sigId: 'T1', sym: 'BTC', long: true, entry: 100000, sl: 99000, tp1: 101500, tp2: 103000, bar: 1000 };
  let p = A.apPlan(sigL, 100000, 10000, 10000, F, cfg, 0);
  ok(p.ok && Math.abs(p.riskUsd - 200) < 1, '2% of $10,000 risked = $200 at the stop', p);
  ok(p.ok && p.qty === 0.2, 'size = risk / stop distance (0.2 BTC)', p);
  ok(p.ok && p.lev === 20, 'leverage capped at 20x for a 1% stop', p);
  ok(!A.apPlan(sigL, 98900, 10000, 10000, F, cfg, 0).ok, 'price already past the stop: no entry');
  ok(A.apPlan(sigL, 100700, 10000, 10000, F, cfg, 0).why === 'price_ran', 'price already ran 47% of the way to TP1: no chase');
  ok(A.apPlan({ ...sigL, sl: 97000 }, 100000, 10000, 10000, F, cfg, 0).why === 'stop_too_wide', 'a 3% stop is refused');
  ok(A.apPlan(sigL, 100000, 10000, 10000, F, cfg, 1100).why === 'risk_budget', 'open risk 11% + 2% over the 12% budget: refused');
  ok(A.apPlan(sigL, 100000, 20, 20, F, cfg, 0).why === 'too_small', 'a $20 account cannot meet the minimum order');
  p = A.apPlan(sigL, 100000, 10000, 500, F, cfg, 0);
  ok(p.ok && p.capped && p.margin <= 450.01, 'size cut to the free margin when the risk-sized position would not fit', p);
  ok(A.floorStep(0.12345, 0.001) === 0.123 && A.roundTick(101500.04, 0.1) === 101500, 'quantities floored to the step, prices to the tick');
  const norm = A.apCfgNorm({ risk: 50, levCap: 125, coins: ['BTC', 'FAKE'], mode: 'yolo' });
  ok(norm.risk === 3 && norm.levCap === 20 && norm.coins.join() === 'BTC' && norm.mode === 'shadow', 'settings clamped: risk <= 3%, leverage <= 20x, unknown coins and modes refused', norm);
  // ---- the bot against the virtual exchange ----
  const mk = (bal) => { const vx = { bal }; const mark = { BTCUSDT: 100000 }; const X = A.virtualTransport(vx, async (s) => mark[s] || 0); const logs = []; const book = { cfg, open: [], day: null, log: (k, s, m, o) => logs.push({ k, s, m, o }) }; return { vx, mark, X, logs, book }; };
  let E = mk(10000);
  let r = await A.apEnter(E.X, E.book, sigL, F, 'aaa');
  ok(r.ok && r.trade.qty === 0.2, 'entry: a market order for the planned size', r);
  const algos = () => E.vx.algos.filter(a => a.algoStatus === 'NEW');
  ok(algos().some(a => a.orderType === 'STOP_MARKET' && a.triggerPrice === 99000 && a.closePosition), 'the stop is on the exchange at the signal stop');
  ok(algos().some(a => a.orderType === 'TAKE_PROFIT_MARKET' && a.triggerPrice === 101500 && a.quantity === 0.1), 'TP1 takes half');
  ok(algos().some(a => a.orderType === 'TAKE_PROFIT_MARKET' && a.triggerPrice === 103000 && a.quantity === 0.1 && a.reduceOnly && !a.closePosition), 'TP2 closes the rest as a reduce-only order (only the stop is close-all - Binance allows one per side)');
  ok(algos().filter(a => a.closePosition).length === 1, 'exactly one close-all order on the position (the stop)');
  ok(E.logs.findIndex(l => /STOP_MARKET/.test(l.m)) < E.logs.findIndex(l => /TAKE_PROFIT/.test(l.m)), 'the stop goes on BEFORE the targets');
  let t = r.trade; E.book.open = [t];
  E.mark.BTCUSDT = 101600; await A.apManage(E.X, E.book, t, null);
  ok(t.phase === 1 && algos().some(a => a.orderType === 'STOP_MARKET' && a.triggerPrice === t.entry), 'TP1 filled: the stop moved to the entry');
  ok(!algos().some(a => a.orderType === 'STOP_MARKET' && a.triggerPrice === 99000), 'the old stop is cancelled');
  E.mark.BTCUSDT = 103100; await A.apManage(E.X, E.book, t, null);
  ok(t.status === 'closed' && t.result === 'tp2', 'TP2: closed, result tp2', { s: t.status, r: t.result });
  ok(t.R > 2 && t.R < 2.25, 'the R matches 0.5x1.5R + 0.5x3R minus fees (~2.2R)', t.R);
  ok(!algos().length, 'nothing left resting on the exchange after the close');
  // the loss
  E = mk(10000); r = await A.apEnter(E.X, E.book, sigL, F, 'bbb'); t = r.trade; E.book.open = [t];
  E.mark.BTCUSDT = 98900; await A.apManage(E.X, E.book, t, null);
  ok(t.status === 'closed' && t.result === 'sl' && t.R < -1 && t.R > -1.2, 'stop hit: closed at about -1R', { r: t.result, R: t.R });
  ok(Math.abs(E.vx.bal - (10000 + t.pnl)) < 0.01, 'the balance moved by exactly the booked P&L', { bal: E.vx.bal, pnl: t.pnl });
  // the flip exit
  E = mk(10000); r = await A.apEnter(E.X, E.book, sigL, F, 'ccc'); t = r.trade; E.book.open = [t];
  E.mark.BTCUSDT = 100300; await A.apManage(E.X, E.book, t, { dir: -1, bar: 2000 });
  ok(t.status === 'closed' && t.result === 'flip', 'the 1h trend flipped against the trade: closed at market', t.result);
  await A.apManage(E.X, E.book, { ...t, status: 'open' }, { dir: 1, bar: 3000 });
  // a hand-opened position is never touched
  E = mk(10000); E.vx.pos.BTCUSDT = { amt: 0.5, entry: 99000 };
  r = await A.apEnter(E.X, E.book, sigL, F, 'ddd');
  ok(!r.ok && r.why === 'manual_position' && E.vx.pos.BTCUSDT.amt === 0.5, 'a position the member opened by hand: signal skipped, position untouched', r.why);
  // the stop refused -> the position is closed at once
  E = mk(10000);
  const X2 = async (m, pth, q, o) => (pth === '/fapi/v1/algoOrder' && m === 'POST' && q.type === 'STOP_MARKET') || (pth === '/fapi/v1/order' && m === 'POST' && q.type === 'STOP_MARKET') ? { ok: false, why: 'binance_-2021', code: -2021, msg: 'Order would immediately trigger.' } : E.X(m, pth, q, o);
  r = await A.apEnter(X2, E.book, sigL, F, 'eee');
  ok(!r.ok && r.why === 'stop_refused_closed' && !E.vx.pos.BTCUSDT.amt, 'the stop could not be placed: the position was closed immediately', { why: r.why, pos: E.vx.pos.BTCUSDT });
  // a stop that vanished is put back
  E = mk(10000); r = await A.apEnter(E.X, E.book, sigL, F, 'fff'); t = r.trade; E.book.open = [t];
  E.vx.algos.find(a => a.orderType === 'STOP_MARKET').algoStatus = 'CANCELED';
  t._chk = 0; await A.apManage(E.X, E.book, t, null);
  ok(t.status === 'open' && algos().some(a => a.orderType === 'STOP_MARKET' && a.triggerPrice === 99000), 'a stop cancelled on the exchange is placed again within the check');
  // the stop check cannot read the order list: it must NOT conclude the stop is gone (that would stack stops or close a healthy trade)
  E = mk(10000); r = await A.apEnter(E.X, E.book, sigL, F, 'ffg'); t = r.trade; E.book.open = [t];
  const nStops = () => E.vx.algos.filter(a => a.algoStatus === 'NEW' && a.orderType === 'STOP_MARKET').length;
  const X4 = async (m, pth, q, o) => pth === '/fapi/v1/openAlgoOrders' ? { ok: false, why: 'binance_-1003', msg: 'Too many requests' } : E.X(m, pth, q, o); X4.tick = E.X.tick;
  t._chk = 0; await A.apManage(X4, E.book, t, null);
  ok(t.status === 'open' && nStops() === 1, 'an unreadable order list never counts as a missing stop (no second stop, no close)', { s: t.status, stops: nStops() });
  // Binance answers -4130 (a close-all stop already exists) to the restore: the trade is kept, not closed
  E.vx.algos.find(a => a.orderType === 'STOP_MARKET' && a.algoStatus === 'NEW').clientAlgoId = 'someone-elses';
  const X5 = async (m, pth, q, o) => (m === 'POST' && q.type === 'STOP_MARKET') ? { ok: false, why: 'binance_-4130', code: -4130, msg: 'An open stop or take profit order with GTE and closePosition in the direction is existing.' } : E.X(m, pth, q, o); X5.tick = E.X.tick;
  t._chk = 0; await A.apManage(X5, E.book, t, null);
  ok(t.status === 'open', 'a -4130 "close-all stop already exists" on the restore keeps the trade open', t.status);
  // the breakeven stop refused -> the rest is closed, never left without protection
  E = mk(10000); r = await A.apEnter(E.X, E.book, sigL, F, 'ggg'); t = r.trade; E.book.open = [t];
  E.mark.BTCUSDT = 101600;
  const X3 = async (m, pth, q, o) => (m === 'POST' && q.type === 'STOP_MARKET') ? { ok: false, why: 'binance_-2021', code: -2021, msg: 'refused' } : E.X(m, pth, q, o); X3.tick = E.X.tick;
  await A.apManage(X3, E.book, t, null);
  ok(t.status === 'closed' && t.result === 'be_refused' && !E.vx.pos.BTCUSDT.amt && t.pnl > 0, 'breakeven stop refused: the runner closed at market, in profit', { r: t.result, pnl: t.pnl });
  // the brakes
  E = mk(10000); E.book.day = { d: new Date().toISOString().slice(0, 10), start: 10000, pnl: -650 };
  r = await A.apEnter(E.X, E.book, sigL, F, 'hhh'); ok(!r.ok && r.why === 'day_loss_limit', 'down 6.5% today: no new trades');
  E = mk(10000); E.book.cfg = { ...cfg, paused: true }; r = await A.apEnter(E.X, E.book, sigL, F, 'iii'); ok(r.why === 'paused', 'paused: nothing opens');
  E = mk(10000); E.book.cfg = { ...cfg, coins: ['ETH'] }; r = await A.apEnter(E.X, E.book, sigL, F, 'jjj'); ok(r.why === 'coin_off', 'a coin switched off is not traded');
  E = mk(10000); E.book.open = [{ sym: 'BTC' }]; r = await A.apEnter(E.X, E.book, sigL, F, 'kkk'); ok(r.why === 'already_in', 'one trade per coin');
  // short side mirrors
  E = mk(10000); E.mark.BTCUSDT = 100000;
  const sigS = { sigId: 'S1', sym: 'BTC', long: false, entry: 100000, sl: 101000, tp1: 98500, tp2: 97000, bar: 1000 };
  r = await A.apEnter(E.X, E.book, sigS, F, 'lll'); t = r.trade; E.book.open = [t];
  ok(r.ok && E.vx.pos.BTCUSDT.amt < 0 && algos().some(a => a.side === 'BUY' && a.orderType === 'STOP_MARKET' && a.triggerPrice === 101000), 'a short: sold, stop above as a BUY');
  E.mark.BTCUSDT = 98400; await A.apManage(E.X, E.book, t, null); E.mark.BTCUSDT = 96900; await A.apManage(E.X, E.book, t, null);
  ok(t.status === 'closed' && t.result === 'tp2' && t.R > 2, 'the short reaches TP2', { r: t.result, R: t.R });
  // close all
  E = mk(10000); r = await A.apEnter(E.X, E.book, sigL, F, 'mmm'); E.book.open = [r.trade];
  const ca = await A.apCloseAll(E.X, E.book, 'test');
  ok(ca.length === 1 && ca[0].status === 'closed' && !E.vx.pos.BTCUSDT.amt && !algos().length, 'Close all: position flat, every order of ours cancelled');
  // ---- source guards ----
  const src = fs.readFileSync(path.resolve(__dirname, '../src/autotrade.js'), 'utf8');
  const paths = (src.match(/'\/(sapi|fapi|api)\/[^']*'/g) || []);
  ok(paths.length > 8 && !paths.some(x => /withdraw|asset|capital|transfer|margin\/loan|sub-account/i.test(x)), 'every Binance path the bot can call is a futures trading or read path (no withdrawal, asset or transfer path)', paths.filter(x => /withdraw|asset|capital|transfer/i.test(x)));
  const col = fs.readFileSync(path.resolve(__dirname, '../collector/src/api/server.js'), 'utf8');
  const xt = col.slice(col.indexOf('const XT_FUT'), col.indexOf("app.post('/api/v1/xtrade'"));
  ok(xt.length > 100 && !/withdraw|capital|transfer|asset\//i.test(xt.replace(/\/\/[^\n]*/g, '')), 'the order forwarder allowlist holds no withdrawal or transfer path');
  ok(/TRADE_FWD_KEY/.test(col) && !/xtrade[\s\S]{0,400}EXPORT_KEY/.test(col.slice(col.indexOf("'/api/v1/xtrade'"), col.indexOf("'/api/v1/xtrade'") + 600)), 'the order forwarder has its own key, not the read forwarder\'s');
  if (PROD) {
    const B = 'https://marginpad.io';
    let q = await fetch(B + '/autopilot/'); ok(q.status === 404, 'the page is a plain 404 to a stranger', q.status);
    q = await fetch(B + '/api/ap/state'); ok(q.status === 401 || q.status === 404, 'the API refuses a stranger', q.status);
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
