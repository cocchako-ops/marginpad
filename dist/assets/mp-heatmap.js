/* mp-heatmap.js — Liquidation Heatmap v2.1 (simplified + full-bleed, owner pass 2026-07-24).
   ONE idea on screen: bright horizontal bands = standing crowds of liquidation prices (est. from every
   candle close at 10/25/50/100x, consumed internally the moment price trades through — only what still
   STANDS is drawn). Price hunts the bright bands. Dots = real liquidations from our 6-exchange feed.
   Controls in one row: coin dropdown · window dropdown · Longs/Shorts filter · stats · PNG.
   Desktop: the section goes full-bleed (chartspace-style) with a viewport-tall canvas. */
(function () {
  if (window.mpHeatmap) return;
  var MMR = 0.005, LEVS = [10, 25, 50, 100], LEVW = { 10: 0.34, 25: 0.30, 50: 0.21, 100: 0.15 };
  var COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'LINK', 'AVAX', 'LTC'];
  var WINS = { '4H': { iv: '5', mins: 240 }, '12H': { iv: '15', mins: 720 }, '1D': { iv: '15', mins: 1440 }, '3D': { iv: '60', mins: 4320 }, '7D': { iv: '240', mins: 10080 } };
  var BINS = 200;
  var S = null;

  var CSS = '#heatmap.hm-full{width:min(96vw,1860px)!important;margin-left:calc(50% - min(48vw,930px))!important;max-width:none!important}' +
    '.hm-wrap{background:#0b0d10;border:1px solid #1c2230;border-radius:14px;padding:12px 14px 10px;color:#dbe4f5;font-family:"Familjen Grotesk",system-ui,sans-serif}' +
    '.hm-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}' +
    '.hm-sel{appearance:none;-webkit-appearance:none;background:#12161d url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%276%27%3E%3Cpath d=%27M1 1l4 4 4-4%27 stroke=%27%238fa3c4%27 stroke-width=%271.6%27 fill=%27none%27/%3E%3C/svg%3E") no-repeat right 10px center;border:1px solid #232b3a;color:#fff;border-radius:9px;padding:8px 28px 8px 12px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}' +
    '.hm-sel:focus{outline:none;border-color:#c2f64a}' +
    '.hm-seg{display:flex;background:#12161d;border:1px solid #232b3a;border-radius:9px;overflow:hidden}' +
    '.hm-seg button{background:none;border:0;color:#8fa3c4;padding:8px 13px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}' +
    '.hm-seg button.on{background:#1a2413;color:#c2f64a}.hm-seg button.on.s-l{background:#0f2418;color:#2ebd85}.hm-seg button.on.s-s{background:#2a1512;color:#ff6258}' +
    '.hm-px{margin-left:auto;font-family:"Space Mono",monospace;font-size:16px;font-weight:700;color:#fff;white-space:nowrap}.hm-px small{font-size:11.5px;margin-left:6px}.hm-px small.up{color:#2ebd85}.hm-px small.dn{color:#ff6258}' +
    '.hm-stats{font-size:11px;color:#5c6b84;font-family:"Space Mono",monospace;white-space:nowrap}' +
    '.hm-btn{background:#12161d;border:1px solid #232b3a;color:#8fa3c4;border-radius:9px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}' +
    '.hm-btn:hover{color:#dbe4f5;border-color:#3a465c}' +
    '.hm-stage{position:relative;display:flex;min-height:380px;height:calc(100vh - 320px);max-height:820px}' +
    '.hm-cv{flex:1;min-width:0;display:block;border-radius:10px 0 0 10px;background:#07090c;cursor:crosshair}' +
    '.hm-prof{width:132px;flex:none;display:block;background:#07090c;border-left:1px solid #141a24;border-radius:0 10px 10px 0}' +
    '.hm-tip{position:absolute;pointer-events:none;background:rgba(10,12,16,.97);border:1px solid #2a3345;border-radius:8px;padding:7px 10px;font-size:11.5px;line-height:1.55;color:#dbe4f5;z-index:5;display:none;font-family:"Space Mono",monospace;white-space:nowrap}' +
    '.hm-tip b{color:#fff}.hm-tip .l{color:#2ebd85}.hm-tip .s{color:#ff6258}' +
    '.hm-foot{margin-top:8px;font-size:11px;color:#5c6b84;line-height:1.55}' +
    '.hm-foot b{color:#8fa3c4;font-weight:700}.hm-foot .l{color:#2ebd85}.hm-foot .s{color:#ff6258}' +
    '.hm-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#5c6b84;font-size:13px;background:rgba(7,9,12,.7);z-index:4;border-radius:10px}' +
    '@media(max-width:980px){#heatmap.hm-full{width:auto!important;margin-left:0!important}.hm-stage{height:52vh;min-height:320px}.hm-prof{width:70px}.hm-px{width:100%;margin-left:0;order:9}.hm-stats{display:none}}';

  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function money(n) { n = +n || 0; var a = Math.abs(n); if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'; if (a >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'; return '$' + n.toFixed(0); }
  function fpx(p) { p = +p; if (!isFinite(p)) return '—'; return p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 1 }) : p >= 1 ? p.toFixed(3) : p.toPrecision(4); }
  function liqPx(entry, lev, long) { return long ? entry * (1 - (1 - MMR) / lev) : entry * (1 + (1 - MMR) / lev); }
  function tlabel(t) { var d = new Date(t * 1000); var w = S && WINS[S.win].mins >= 4320; return w ? (d.getUTCDate() + '.' + (d.getUTCMonth() + 1) + '.') : (('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)); }

  // pool model: only what still STANDS is returned (consumed pools vanish — that is the whole point)
  function buildPools(bars) {
    if (!bars || bars.length < 5) return { alive: [], pMin: 0, pMax: 1, binH: 0 };
    var pMin = 1 / 0, pMax = -1 / 0, i, b;
    for (i = 0; i < bars.length; i++) { b = bars[i]; if (b.low < pMin) pMin = b.low; if (b.high > pMax) pMax = b.high; }
    var pad = (pMax - pMin) * 0.35; pMin -= pad; pMax += pad;
    var binH = (pMax - pMin) / BINS;
    var binOf = function (p) { var x = Math.floor((p - pMin) / binH); return x < 0 ? 0 : x >= BINS ? BINS - 1 : x; };
    var alive = {};
    for (i = 1; i < bars.length; i++) {
      b = bars[i];
      for (var k in alive) { var pr = pMin + (+k + 0.5) * binH; if (pr >= b.low && pr <= b.high) delete alive[k]; }
      var prev = bars[i - 1], notion = (prev.vol || 0) * prev.close || Math.abs(prev.close - prev.open) * 1e4;
      for (var li = 0; li < LEVS.length; li++) { var L = LEVS[li], w = notion * LEVW[L] * 0.5;
        var bl = binOf(liqPx(prev.close, L, true)), bs = binOf(liqPx(prev.close, L, false));
        var al = alive[bl]; if (al && al.long) { al.w += w; } else if (!al) alive[bl] = { w: w, long: true, t0: prev.time, lev: L };
        var as2 = alive[bs]; if (as2 && !as2.long) { as2.w += w; } else if (!as2) alive[bs] = { w: w, long: false, t0: prev.time, lev: L };
      }
    }
    var arr = [], wMax = 0;
    for (var k2 in alive) { var a2 = alive[k2]; a2.price = pMin + (+k2 + 0.5) * binH; a2.bin = +k2; arr.push(a2); if (a2.w > wMax) wMax = a2.w; }
    for (i = 0; i < arr.length; i++) arr[i].a = Math.pow(arr[i].w / (wMax || 1), 0.4);
    arr.sort(function (x, y) { return y.w - x.w; });
    return { alive: arr, pMin: pMin, pMax: pMax, binH: binH };
  }

  function draw() {
    if (!S || !S.cv || !S.bars || !S.bars.length) return;
    var cv = S.cv, ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
    var W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var v = S.view, bars = S.bars, P = S.pools, i, b;
    var pLo = 1 / 0, pHi = -1 / 0;
    for (i = 0; i < bars.length; i++) { b = bars[i]; if (b.time < v.t0 || b.time > v.t1) continue; if (b.low < pLo) pLo = b.low; if (b.high > pHi) pHi = b.high; }
    if (!isFinite(pLo)) { pLo = P.pMin; pHi = P.pMax; }
    var yPad = (pHi - pLo) * 0.28; pLo -= yPad; pHi += yPad;
    S.yLo = pLo; S.yHi = pHi;
    var X = function (t) { return (t - v.t0) / (v.t1 - v.t0) * W; };
    var Y = function (p) { return H - (p - pLo) / (pHi - pLo) * H; };
    S.X = X; S.Y = Y;
    // grid + time ticks
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1; ctx.beginPath();
    for (i = 1; i < 6; i++) { var gy = H / 6 * i; ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(92,107,132,.85)'; ctx.font = '10px "Space Mono",monospace'; ctx.textAlign = 'center';
    for (i = 1; i < 6; i++) { var tt = v.t0 + (v.t1 - v.t0) / 6 * i; ctx.fillText(tlabel(tt), W / 6 * i, H - 6); }
    // STANDING pool bands — the heat. Band starts when the crowd started building and runs to the right edge.
    var bh = Math.max(2, H * (P.binH / (pHi - pLo)) * 1.15);
    for (i = P.alive.length - 1; i >= 0; i--) { var s = P.alive[i];
      if (S.sideF === 'long' && !s.long) continue; if (S.sideF === 'short' && s.long) continue;
      if (s.price < pLo || s.price > pHi) continue;
      var x0 = Math.max(0, X(s.t0)), y = Y(s.price) - bh / 2;
      var al = 0.14 + s.a * 0.78;
      ctx.fillStyle = s.long ? 'rgba(46,189,133,' + (al * 0.5).toFixed(3) + ')' : 'rgba(255,98,88,' + (al * 0.5).toFixed(3) + ')';
      ctx.fillRect(x0, y - bh * 0.6, W - x0, bh * 2.2); // soft halo
      ctx.fillStyle = s.long ? 'rgba(46,189,133,' + al.toFixed(3) + ')' : 'rgba(255,98,88,' + al.toFixed(3) + ')';
      ctx.fillRect(x0, y, W - x0, bh);
      if (s.a > 0.72) { ctx.fillStyle = s.long ? 'rgba(194,246,74,' + (al * 0.55).toFixed(3) + ')' : 'rgba(255,179,71,' + (al * 0.55).toFixed(3) + ')'; ctx.fillRect(x0, y + bh * 0.28, W - x0, bh * 0.44); }
    }
    // candles
    var n = 0; for (i = 0; i < bars.length; i++) if (bars[i].time >= v.t0 && bars[i].time <= v.t1) n++;
    var cw = Math.max(1.5, Math.min(11, W / (n || 1) * 0.62));
    for (i = 0; i < bars.length; i++) { b = bars[i]; if (b.time < v.t0 || b.time > v.t1) continue;
      var x = X(b.time), up = b.close >= b.open;
      ctx.strokeStyle = up ? 'rgba(46,189,133,.95)' : 'rgba(255,98,88,.95)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, Y(b.high)); ctx.lineTo(x, Y(b.low)); ctx.stroke();
      ctx.fillStyle = up ? '#2ebd85' : '#ff6258';
      var yO = Y(b.open), yC = Y(b.close); ctx.fillRect(x - cw / 2, Math.min(yO, yC), cw, Math.max(1.2, Math.abs(yC - yO)));
    }
    // real liquidations — subtle dots; only sizeable ones get an outline
    for (i = 0; i < S.events.length; i++) { var e = S.events[i], ts = e.ts / 1000;
      if (ts < v.t0 || ts > v.t1 || e.price < pLo || e.price > pHi) continue;
      var lng = e.side === 'long_liquidated';
      if (S.sideF === 'long' && !lng) continue; if (S.sideF === 'short' && lng) continue;
      var r = Math.max(1.8, Math.min(10, Math.log10(Math.max(10, e.notional)) * 1.8 - 1.6));
      ctx.beginPath(); ctx.arc(X(ts), Y(e.price), r, 0, 6.2832);
      ctx.fillStyle = lng ? 'rgba(46,189,133,.30)' : 'rgba(255,98,88,.30)'; ctx.fill();
      if (e.notional >= 25000) { ctx.lineWidth = 1.2; ctx.strokeStyle = lng ? '#2ebd85' : '#ff6258'; ctx.stroke(); }
    }
    // top-3 standing pools labelled right on the map — instant read
    var lab = 0, usedY = [];
    for (i = 0; i < P.alive.length && lab < 3; i++) { var tp = P.alive[i];
      if (S.sideF === 'long' && !tp.long) continue; if (S.sideF === 'short' && tp.long) continue;
      if (tp.price < pLo || tp.price > pHi) continue;
      var ly = Y(tp.price), clash = false;
      for (var u = 0; u < usedY.length; u++) if (Math.abs(usedY[u] - ly) < 16) { clash = true; break; }
      if (clash) continue; usedY.push(ly); lab++;
      var txt = money(tp.w) + (tp.long ? ' long liqs' : ' short liqs');
      ctx.font = '700 11px "Space Mono",monospace';
      var tw = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(7,9,12,.85)'; ctx.fillRect(W - tw - 18, ly - 9, tw + 12, 16);
      ctx.fillStyle = tp.long ? '#7ee2b8' : '#ffa39b'; ctx.textAlign = 'left';
      ctx.fillText(txt, W - tw - 12, ly + 3);
    }
    // live price
    if (S.price > 0 && S.price > pLo && S.price < pHi) {
      var py = Y(S.price);
      ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(194,246,74,.85)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#0a0b0d'; var pt = fpx(S.price); ctx.font = '700 11px "Space Mono",monospace';
      var ptw = ctx.measureText(pt).width;
      ctx.fillStyle = '#c2f64a'; ctx.fillRect(W - ptw - 14, py - 9, ptw + 10, 17);
      ctx.fillStyle = '#0a0b0d'; ctx.textAlign = 'left'; ctx.fillText(pt, W - ptw - 9, py + 4);
    }
    // y labels
    ctx.fillStyle = 'rgba(143,163,196,.8)'; ctx.font = '10px "Space Mono",monospace'; ctx.textAlign = 'left';
    for (i = 1; i < 6; i++) { var lp = pHi - (pHi - pLo) / 6 * i; ctx.fillText(fpx(lp), 6, H / 6 * i - 3); }
    drawProfile(pLo, pHi);
  }

  function drawProfile(pLo, pHi) {
    var cv = S.pf, ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
    var W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var P = S.pools, Y = function (p) { return H - (p - pLo) / (pHi - pLo) * H; }, i;
    var wMax = 0;
    for (i = 0; i < P.alive.length; i++) if (P.alive[i].w > wMax) wMax = P.alive[i].w;
    for (i = 0; i < P.alive.length; i++) { var s = P.alive[i];
      if (S.sideF === 'long' && !s.long) continue; if (S.sideF === 'short' && s.long) continue;
      var y = Y(s.price); if (y < -4 || y > H + 4) continue;
      ctx.fillStyle = s.long ? 'rgba(46,189,133,.62)' : 'rgba(255,98,88,.62)';
      ctx.fillRect(0, y - 1.6, Math.max(2, s.w / (wMax || 1) * (W - 12)), 3.2); }
    ctx.fillStyle = 'rgba(92,107,132,.9)'; ctx.font = '9px "Space Mono",monospace'; ctx.textAlign = 'center';
    ctx.fillText('WHERE $ SITS', W / 2, 12);
  }

  var rafP = false;
  function sched() { if (rafP) return; rafP = true; requestAnimationFrame(function () { rafP = false; try { draw(); } catch (e) {} }); }

  function loadAll(first) {
    var coin = S.coin, w = WINS[S.win];
    if (first && S.loadEl) S.loadEl.style.display = 'flex';
    Promise.all([
      fetch('/api/klines?symbol=' + coin + '&interval=' + w.iv, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch('/api/v1/liquidations/live?symbol=' + coin + '&limit=400').then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch('/api/price?symbol=' + coin, { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) {
      if (!S || coin !== S.coin) return;
      var kd = res[0];
      if (kd && kd.length) {
        var cut = Date.now() / 1000 - w.mins * 60 * 1.6;
        S.bars = kd.filter(function (b2) { return b2.time > cut; });
        S.pools = buildPools(S.bars);
        if (first || !S.view) { var last = S.bars[S.bars.length - 1]; var step = S.bars[1] ? S.bars[1].time - S.bars[0].time : 60; S.view = { t0: Date.now() / 1000 - w.mins * 60, t1: last.time + step * 5 }; }
      }
      if (res[1] && res[1].events) S.events = res[1].events;
      if (res[2] && +res[2].price > 0) { S.price = +res[2].price; S.chg = +res[2].chg || 0; }
      updHead(); if (S.loadEl) S.loadEl.style.display = 'none';
      sched();
    });
  }
  function pollEvents() {
    if (!S || document.hidden) return;
    var coin = S.coin;
    fetch('/api/v1/liquidations/live?symbol=' + coin + '&limit=120').then(function (r) { return r.json(); }).then(function (d) {
      if (!S || coin !== S.coin || !d || !d.events) return;
      var seen = {}; S.events.slice(0, 200).forEach(function (e) { seen[e.ts + '|' + e.price + '|' + e.qty] = 1; });
      var fresh = d.events.filter(function (e) { return !seen[e.ts + '|' + e.price + '|' + e.qty]; });
      if (fresh.length) { S.events = fresh.concat(S.events).slice(0, 900); updHead(); sched(); }
    }).catch(function () {});
  }
  function updHead() {
    if (!S) return;
    if (S.pxEl) S.pxEl.innerHTML = S.price > 0 ? '$' + fpx(S.price) + ' <small class="' + (S.chg >= 0 ? 'up' : 'dn') + '">' + (S.chg >= 0 ? '+' : '') + (S.chg || 0).toFixed(2) + '%</small>' : '…';
    if (S.stEl) { var cut = Date.now() - WINS[S.win].mins * 60000, tot = 0, nn = 0;
      for (var i = 0; i < S.events.length; i++) { var e = S.events[i]; if (e.ts < cut) break; tot += e.notional || 0; nn++; }
      S.stEl.textContent = nn ? (money(tot) + ' liquidated · ' + nn + ' liqs · ' + S.win) : ''; }
  }

  function wire() {
    var cv = S.cv, tip = S.tip;
    cv.addEventListener('mousemove', function (ev) {
      if (!S.X) return;
      var r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
      if (S.drag) { var dt = (S.drag.x - mx) / r.width * (S.view.t1 - S.view.t0); S.view.t0 = S.drag.t0 + dt; S.view.t1 = S.drag.t1 + dt; sched(); return; }
      var p = S.yHi - my / r.height * (S.yHi - S.yLo);
      var P = S.pools, best = null, i;
      for (i = 0; i < P.alive.length; i++) { var s = P.alive[i]; var d = Math.abs(s.price - p); if (d < P.binH * 2.4 && (!best || s.w > best.s.w)) best = { d: d, s: s }; }
      var bev = null;
      for (i = 0; i < S.events.length; i++) { var e = S.events[i], ex = S.X(e.ts / 1000), ey = S.Y(e.price); var dd = Math.hypot(ex - mx, ey - my); if (dd < 13 && (!bev || dd < bev.d)) bev = { d: dd, e: e }; }
      if (!best && !bev) { tip.style.display = 'none'; return; }
      var h = '';
      if (best) { var s2 = best.s; h += '<b>' + fpx(s2.price) + '</b> — <span class="' + (s2.long ? 'l' : 's') + '">' + (s2.long ? 'longs get liquidated here' : 'shorts get liquidated here') + '</span><br>~' + money(s2.w) + ' waiting'; }
      if (bev) { var e2 = bev.e; h += (h ? '<br>' : '') + '<span class="' + (e2.side === 'long_liquidated' ? 'l' : 's') + '">' + (e2.side === 'long_liquidated' ? 'LONG' : 'SHORT') + ' liquidated</span> ' + money(e2.notional) + ' · ' + e2.exchange; }
      tip.innerHTML = h; tip.style.display = 'block';
      var tx = mx + 14, ty = my + 12;
      if (tx + tip.offsetWidth > r.width - 4) tx = mx - tip.offsetWidth - 12;
      if (ty + tip.offsetHeight > r.height - 4) ty = my - tip.offsetHeight - 10;
      tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.style.display = 'none'; S.drag = null; });
    cv.addEventListener('mousedown', function (ev) { var r = cv.getBoundingClientRect(); S.drag = { x: ev.clientX - r.left, t0: S.view.t0, t1: S.view.t1 }; });
    window.addEventListener('mouseup', function () { if (S) S.drag = null; });
    cv.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var r = cv.getBoundingClientRect(), fx = (ev.clientX - r.left) / r.width;
      var span = S.view.t1 - S.view.t0, f = ev.deltaY > 0 ? 1.18 : 0.85;
      var ns = Math.max(600, Math.min(WINS[S.win].mins * 60 * 2.2, span * f));
      var pivot = S.view.t0 + fx * span;
      S.view.t0 = pivot - fx * ns; S.view.t1 = pivot + (1 - fx) * ns; sched();
    }, { passive: false });
    cv.addEventListener('dblclick', function () { if (S.bars.length) { var w = WINS[S.win]; S.view = { t0: Date.now() / 1000 - w.mins * 60, t1: S.bars[S.bars.length - 1].time + 300 }; sched(); } });
    var tX = null;
    cv.addEventListener('touchstart', function (ev) { if (ev.touches.length === 1) { var r = cv.getBoundingClientRect(); tX = { x: ev.touches[0].clientX - r.left, t0: S.view.t0, t1: S.view.t1 }; } }, { passive: true });
    cv.addEventListener('touchmove', function (ev) { if (tX && ev.touches.length === 1) { var r = cv.getBoundingClientRect(); var dt = (tX.x - (ev.touches[0].clientX - r.left)) / r.width * (tX.t1 - tX.t0); S.view.t0 = tX.t0 + dt; S.view.t1 = tX.t1 + dt; sched(); } }, { passive: true });
    cv.addEventListener('touchend', function () { tX = null; });
  }

  function mount(section, coin) {
    if (!section) return;
    unmount();
    if (!document.getElementById('hmCss')) { var st = document.createElement('style'); st.id = 'hmCss'; st.textContent = CSS; document.head.appendChild(st); }
    section.classList.add('hm-full');
    coin = (coin || 'BTC').toUpperCase(); if (COINS.indexOf(coin) < 0) coin = 'BTC';
    var wrap = el('div', 'hm-wrap');
    var bar = el('div', 'hm-bar');
    var selC = el('select', 'hm-sel'); COINS.forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; if (c === coin) o.selected = true; selC.appendChild(o); });
    var selW = el('select', 'hm-sel'); Object.keys(WINS).forEach(function (wk) { var o = document.createElement('option'); o.value = wk; o.textContent = wk === '4H' ? 'Last 4 hours' : wk === '12H' ? 'Last 12 hours' : wk === '1D' ? 'Last 24 hours' : wk === '3D' ? 'Last 3 days' : 'Last 7 days'; if (wk === '1D') o.selected = true; selW.appendChild(o); });
    var seg = el('div', 'hm-seg');
    [['all', 'All', ''], ['long', 'Longs', ' s-l'], ['short', 'Shorts', ' s-s']].forEach(function (sd) { var b = el('button', (sd[0] === 'all' ? 'on' : '') + sd[2], sd[1]); b.type = 'button'; b.setAttribute('data-s', sd[0]); seg.appendChild(b); });
    var dl = el('button', 'hm-btn', 'PNG'); dl.type = 'button';
    var stEl = el('span', 'hm-stats', '');
    var pxEl = el('div', 'hm-px', '…');
    bar.appendChild(selC); bar.appendChild(selW); bar.appendChild(seg); bar.appendChild(dl); bar.appendChild(pxEl); bar.appendChild(stEl);
    var stage = el('div', 'hm-stage');
    var cv = el('canvas', 'hm-cv'), pf = el('canvas', 'hm-prof'), tip = el('div', 'hm-tip'), loadEl = el('div', 'hm-load', 'Building liquidation map…');
    stage.appendChild(cv); stage.appendChild(pf); stage.appendChild(tip); stage.appendChild(loadEl);
    var foot = el('div', 'hm-foot', '<b>How to read it:</b> bright bands are crowds of traders whose <span class="l">long</span>/<span class="s">short</span> liquidation prices are stacking up there — price tends to sweep the brightest ones. Bands disappear the moment price trades through them. Drag to pan · scroll to zoom · double-click resets.<br><b>Data:</b> real liquidations streamed live from <b>Binance · Bybit · OKX · BitMEX · Deribit · Bitfinex</b> — that covers roughly <b>70%+</b> of the market&rsquo;s liquidation flow, not 100% of every venue, but the ones that move the market. The bands are our own estimate computed from live price action (10–100&times; entries at each close).');
    wrap.appendChild(bar); wrap.appendChild(stage); wrap.appendChild(foot);
    section.innerHTML = ''; section.appendChild(wrap);
    section.style.display = '';

    S = { coin: coin, win: '1D', sideF: 'all', bars: [], pools: { alive: [], pMin: 0, pMax: 1, binH: 0 }, events: [], price: 0, chg: 0, view: null, cv: cv, pf: pf, tip: tip, pxEl: pxEl, stEl: stEl, loadEl: loadEl, timers: [] };
    wire();
    selC.addEventListener('change', function () { if (!S) return; S.coin = selC.value; S.view = null; S.events = []; loadAll(true); try { if (window.mpWS) window.mpWS.sub(S.coin); } catch (e) {} });
    selW.addEventListener('change', function () { if (!S) return; S.win = selW.value; S.view = null; loadAll(true); });
    seg.addEventListener('click', function (ev) { var t = ev.target.closest('button'); if (!t || !S) return; S.sideF = t.getAttribute('data-s'); seg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === t); }); updHead(); sched(); });
    dl.addEventListener('click', function () { try { var out = document.createElement('canvas'); out.width = cv.width + pf.width; out.height = cv.height; var ox = out.getContext('2d'); ox.fillStyle = '#07090c'; ox.fillRect(0, 0, out.width, out.height); ox.drawImage(cv, 0, 0); ox.drawImage(pf, cv.width, 0); var a = document.createElement('a'); a.download = 'marginpad-liqmap-' + S.coin + '.png'; a.href = out.toDataURL('image/png'); a.click(); } catch (e) {} });
    S.onPrice = function (ev) { var d = ev.detail || {}; if (S && d.sym === S.coin && +d.p > 0) { S.price = +d.p; updHead(); sched(); } };
    window.addEventListener('mp:price', S.onPrice);
    try { if (window.mpWS) window.mpWS.sub(coin); } catch (e) {}
    S.timers.push(setInterval(pollEvents, 6000));
    S.timers.push(setInterval(function () { if (S && !document.hidden) loadAll(false); }, 60000));
    S.onVis = function () { if (S && !document.hidden) { loadAll(false); pollEvents(); } };
    document.addEventListener('visibilitychange', S.onVis);
    S.ro = new ResizeObserver(sched); S.ro.observe(cv); S.ro.observe(pf);
    loadAll(true);
  }
  function unmount() {
    if (!S) return;
    try { S.timers.forEach(clearInterval); } catch (e) {}
    try { window.removeEventListener('mp:price', S.onPrice); } catch (e) {}
    try { document.removeEventListener('visibilitychange', S.onVis); } catch (e) {}
    try { S.ro && S.ro.disconnect(); } catch (e) {}
    S = null;
  }
  window.mpHeatmap = { mount: mount, unmount: unmount };
})();
