/* mp-heatmap.js — Liquidation Heatmap v2 (rebuilt from scratch 2026-07-24).
   Self-contained module: window.mpHeatmap.mount(sectionEl, coin) takes over the #heatmap section.
   WHAT IT SHOWS (three layers, all interactive):
   1. POOL MODEL (the heat): for every closed candle we assume positions opened near that close at
      10/25/50/100x (weighted by traded notional). Each implies a liquidation price (same mpcLiq math as
      the site, mmr 0.5%). Pools ACCUMULATE as horizontal bands and are CONSUMED the moment a later candle
      trades through them — exactly why price "hunts" bright bands. Long pools below price (green→lime),
      short pools above (red→amber); brightness ∝ pooled $.
   2. REAL liquidations from OUR collector (Binance/Bybit/OKX/BitMEX/Deribit/Bitfinex): dots at (time,price),
      radius ∝ $ size. The model predicts, the dots verify.
   3. Server clusters (/api/v1/clusters) sharpen the right-edge profile.
   INTERACTION: crosshair tooltip (pool $ + nearest real liq), wheel zoom (around cursor), drag pan,
   dblclick reset, coin switch (collector's 10 symbols), window 4H/12H/1D/3D/7D, side filter, layer toggles,
   PNG download. LIVE: price via mp:price WS + 6s event poll + 60s kline resync (all timers die on unmount). */
(function () {
  if (window.mpHeatmap) return;
  var MMR = 0.005, LEVS = [10, 25, 50, 100], LEVW = { 10: 0.34, 25: 0.30, 50: 0.21, 100: 0.15 };
  var COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'LINK', 'AVAX', 'LTC'];
  var WINS = { '4H': { iv: '5', mins: 240 }, '12H': { iv: '15', mins: 720 }, '1D': { iv: '15', mins: 1440 }, '3D': { iv: '60', mins: 4320 }, '7D': { iv: '240', mins: 10080 } };
  var BINS = 220;
  var S = null; // live state

  var CSS = '.hm-wrap{background:#0b0d10;border:1px solid #1c2230;border-radius:14px;padding:14px 14px 10px;color:#dbe4f5;font-family:"Familjen Grotesk",system-ui,sans-serif}' +
    '.hm-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}' +
    '.hm-coins{display:flex;gap:4px;flex-wrap:wrap}' +
    '.hm-coin{background:#12161d;border:1px solid #232b3a;color:#8fa3c4;border-radius:8px;padding:5px 10px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}' +
    '.hm-coin.on{background:#1a2413;border-color:#c2f64a;color:#c2f64a}' +
    '.hm-px{margin-left:auto;font-family:"Space Mono",monospace;font-size:15px;font-weight:700;color:#fff}.hm-px small{color:#8fa3c4;font-size:11px;margin-left:6px}.hm-px small.up{color:#2ebd85}.hm-px small.dn{color:#ff6258}' +
    '.hm-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px}' +
    '.hm-pill{background:#12161d;border:1px solid #232b3a;color:#8fa3c4;border-radius:7px;padding:4px 9px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit}' +
    '.hm-pill.on{background:#0f2030;border-color:#38bdf8;color:#38bdf8}' +
    '.hm-pill.side-l.on{background:#0f2418;border-color:#2ebd85;color:#2ebd85}.hm-pill.side-s.on{background:#2a1512;border-color:#ff6258;color:#ff6258}' +
    '.hm-sep{width:1px;height:18px;background:#232b3a;margin:0 3px}' +
    '.hm-stats{margin-left:auto;font-size:11px;color:#5c6b84;font-family:"Space Mono",monospace}' +
    '.hm-stage{position:relative;display:flex;gap:0;min-height:420px}' +
    '.hm-cv{flex:1;min-width:0;display:block;border-radius:10px;background:#07090c;cursor:crosshair}' +
    '.hm-prof{width:120px;flex:none;display:block;background:#07090c;border-left:1px solid #141a24;border-radius:0 10px 10px 0}' +
    '.hm-tip{position:absolute;pointer-events:none;background:rgba(10,12,16,.96);border:1px solid #2a3345;border-radius:8px;padding:7px 9px;font-size:11px;line-height:1.5;color:#dbe4f5;z-index:5;display:none;max-width:240px;font-family:"Space Mono",monospace;white-space:nowrap}' +
    '.hm-tip b{color:#c2f64a}.hm-tip .l{color:#2ebd85}.hm-tip .s{color:#ff6258}' +
    '.hm-foot{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:8px;font-size:10.5px;color:#5c6b84}' +
    '.hm-leg{display:flex;align-items:center;gap:5px}.hm-leg i{width:14px;height:7px;border-radius:2px;display:inline-block}' +
    '.hm-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#5c6b84;font-size:13px;background:rgba(7,9,12,.7);border-radius:10px;z-index:4}' +
    '@media(max-width:680px){.hm-prof{width:64px}.hm-stage{min-height:340px}.hm-px{width:100%;margin-left:0}}';

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function money(n) { n = +n || 0; var a = Math.abs(n); if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'; return '$' + n.toFixed(0); }
  function fpx(p) { p = +p; if (!isFinite(p)) return '—'; return p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 1 }) : p >= 1 ? p.toFixed(3) : p.toPrecision(4); }
  function liqPx(entry, lev, long) { return long ? entry * (1 - (1 - MMR) / lev) : entry * (1 + (1 - MMR) / lev); }

  // ---------- pool model: candles -> horizontal band segments + live profile ----------
  function buildPools(bars) {
    if (!bars || bars.length < 5) return { segs: [], alive: [], pMin: 0, pMax: 1, binH: 0 };
    var pMin = 1 / 0, pMax = -1 / 0, i, b;
    for (i = 0; i < bars.length; i++) { b = bars[i]; if (b.low < pMin) pMin = b.low; if (b.high > pMax) pMax = b.high; }
    var pad = (pMax - pMin) * 0.35; // pools sit beyond the traded range (esp. low-lev ones)
    pMin -= pad; pMax += pad;
    var binH = (pMax - pMin) / BINS;
    var binOf = function (p) { var x = Math.floor((p - pMin) / binH); return x < 0 ? 0 : x >= BINS ? BINS - 1 : x; };
    var alive = {}; // bin -> {w,long,t0,lev}
    var segs = [];  // closed/rendered: {bin,price,long,w,t0,t1,consumed,lev}
    for (i = 1; i < bars.length; i++) {
      b = bars[i];
      // consume pools the candle traded through
      for (var k in alive) { var a = alive[k], pr = pMin + (+k + 0.5) * binH;
        if (pr >= b.low && pr <= b.high) { segs.push({ bin: +k, price: pr, long: a.long, w: a.w, t0: a.t0, t1: b.time, consumed: 1, lev: a.lev }); delete alive[k]; } }
      // seed new pools from the PREVIOUS close (entries near that price), weighted by traded notional
      var prev = bars[i - 1], notion = (prev.vol || 0) * prev.close || Math.abs(prev.close - prev.open) * 1e4;
      for (var li = 0; li < LEVS.length; li++) { var L = LEVS[li], w = notion * LEVW[L] * 0.5;
        var pl = liqPx(prev.close, L, true), bl = binOf(pl);
        var ps = liqPx(prev.close, L, false), bs = binOf(ps);
        var al = alive[bl]; if (al && al.long) al.w += w; else if (!al) alive[bl] = { w: w, long: true, t0: prev.time, lev: L };
        var as2 = alive[bs]; if (as2 && !as2.long) as2.w += w; else if (!as2) alive[bs] = { w: w, long: false, t0: prev.time, lev: L };
      }
    }
    var lastT = bars[bars.length - 1].time;
    var aliveArr = [];
    for (var k2 in alive) { var a2 = alive[k2]; var seg = { bin: +k2, price: pMin + (+k2 + 0.5) * binH, long: a2.long, w: a2.w, t0: a2.t0, t1: lastT, consumed: 0, lev: a2.lev }; segs.push(seg); aliveArr.push(seg); }
    var wMax = 0; for (i = 0; i < segs.length; i++) if (segs[i].w > wMax) wMax = segs[i].w;
    for (i = 0; i < segs.length; i++) segs[i].a = Math.pow(segs[i].w / (wMax || 1), 0.42); // perceptual alpha
    return { segs: segs, alive: aliveArr, pMin: pMin, pMax: pMax, binH: binH };
  }

  // ---------- render ----------
  function draw() {
    if (!S || !S.cv || !S.bars || !S.bars.length) return;
    var cv = S.cv, ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
    var W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var v = S.view, bars = S.bars, P = S.pools;
    // visible y-range: from candles+pools inside the time view
    var pLo = 1 / 0, pHi = -1 / 0, i, b;
    for (i = 0; i < bars.length; i++) { b = bars[i]; if (b.time < v.t0 || b.time > v.t1) continue; if (b.low < pLo) pLo = b.low; if (b.high > pHi) pHi = b.high; }
    if (!isFinite(pLo)) { pLo = P.pMin; pHi = P.pMax; }
    var yPad = (pHi - pLo) * 0.22; pLo -= yPad; pHi += yPad;
    S.yLo = pLo; S.yHi = pHi;
    var X = function (t) { return (t - v.t0) / (v.t1 - v.t0) * W; };
    var Y = function (p) { return H - (p - pLo) / (pHi - pLo) * H; };
    S.X = X; S.Y = Y;
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 1; ctx.beginPath();
    for (i = 1; i < 6; i++) { var gy = H / 6 * i; ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
    ctx.stroke();
    // 1) pool bands
    if (S.layerPools) {
      var bh = Math.max(1.5, H * (P.binH / (pHi - pLo)));
      for (i = 0; i < P.segs.length; i++) { var s = P.segs[i];
        if (S.sideF === 'long' && !s.long) continue; if (S.sideF === 'short' && s.long) continue;
        if (s.t1 < v.t0 || s.t0 > v.t1 || s.price < pLo || s.price > pHi) continue;
        var x0 = Math.max(0, X(s.t0)), x1 = Math.min(W, X(s.t1)); if (x1 - x0 < 0.6) continue;
        var y = Y(s.price) - bh / 2, al = s.a * (s.consumed ? 0.55 : 0.95);
        ctx.fillStyle = s.long ? 'rgba(46,189,133,' + (al * 0.85).toFixed(3) + ')' : 'rgba(255,98,88,' + (al * 0.85).toFixed(3) + ')';
        ctx.fillRect(x0, y, x1 - x0, bh);
        if (!s.consumed && s.a > 0.55) { ctx.fillStyle = s.long ? 'rgba(194,246,74,' + (al * 0.5).toFixed(3) + ')' : 'rgba(255,179,71,' + (al * 0.5).toFixed(3) + ')'; ctx.fillRect(x0, y + bh * 0.25, x1 - x0, bh * 0.5); }
      }
    }
    // 2) candles (thin, readable over heat)
    var n = 0; for (i = 0; i < bars.length; i++) if (bars[i].time >= v.t0 && bars[i].time <= v.t1) n++;
    var cw = Math.max(1, Math.min(9, W / (n || 1) * 0.66));
    for (i = 0; i < bars.length; i++) { b = bars[i]; if (b.time < v.t0 || b.time > v.t1) continue;
      var x = X(b.time), up = b.close >= b.open;
      ctx.strokeStyle = up ? 'rgba(46,189,133,.9)' : 'rgba(255,98,88,.9)';
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, Y(b.high)); ctx.lineTo(x, Y(b.low)); ctx.stroke();
      ctx.fillStyle = up ? '#2ebd85' : '#ff6258';
      var yO = Y(b.open), yC = Y(b.close); ctx.fillRect(x - cw / 2, Math.min(yO, yC), cw, Math.max(1, Math.abs(yC - yO)));
    }
    // 3) real liq dots
    if (S.layerEvents) {
      for (i = 0; i < S.events.length; i++) { var e = S.events[i], ts = e.ts / 1000;
        if (ts < v.t0 || ts > v.t1 || e.price < pLo || e.price > pHi) continue;
        var lng = e.side === 'long_liquidated';
        if (S.sideF === 'long' && !lng) continue; if (S.sideF === 'short' && lng) continue;
        var r = Math.max(2, Math.min(11, Math.log10(Math.max(10, e.notional)) * 1.9 - 1.5));
        ctx.beginPath(); ctx.arc(X(ts), Y(e.price), r, 0, 6.2832);
        ctx.fillStyle = lng ? 'rgba(46,189,133,.34)' : 'rgba(255,98,88,.34)'; ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = lng ? '#2ebd85' : '#ff6258'; ctx.stroke();
      }
    }
    // 4) live price line
    if (S.price > 0 && S.price > pLo && S.price < pHi) {
      var py = Y(S.price);
      ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(194,246,74,.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#c2f64a'; ctx.font = '700 10.5px "Space Mono",monospace'; ctx.textAlign = 'right';
      ctx.fillText(fpx(S.price), W - 6, py - 4);
    }
    // y labels
    ctx.fillStyle = 'rgba(143,163,196,.75)'; ctx.font = '10px "Space Mono",monospace'; ctx.textAlign = 'left';
    for (i = 1; i < 6; i++) { var lp = pHi - (pHi - pLo) / 6 * i; ctx.fillText(fpx(lp), 6, H / 6 * i - 3); }
    drawProfile(pLo, pHi);
  }

  function drawProfile(pLo, pHi) {
    var cv = S.pf, ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
    var W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var P = S.pools, Y = function (p) { return H - (p - pLo) / (pHi - pLo) * H; };
    // blend model-alive pools with server clusters into one profile
    var prof = {}, wMax = 0, i;
    for (i = 0; i < P.alive.length; i++) { var s = P.alive[i];
      if (S.sideF === 'long' && !s.long) continue; if (S.sideF === 'short' && s.long) continue;
      var kk = s.bin; prof[kk] = prof[kk] || { w: 0, long: s.long, price: s.price }; prof[kk].w += s.w; }
    for (var k in prof) if (prof[k].w > wMax) wMax = prof[k].w;
    var cMax = 0; for (i = 0; i < S.clusters.length; i++) if (S.clusters[i].est_notional > cMax) cMax = S.clusters[i].est_notional;
    for (var k2 in prof) { var p2 = prof[k2], y = Y(p2.price); if (y < -4 || y > H + 4) continue;
      var w2 = (p2.w / (wMax || 1)) * (W - 14);
      ctx.fillStyle = p2.long ? 'rgba(46,189,133,.5)' : 'rgba(255,98,88,.5)';
      ctx.fillRect(0, y - 1.4, w2, 2.8); }
    for (i = 0; i < S.clusters.length; i++) { var c = S.clusters[i], cy = Y(c.price); if (cy < 0 || cy > H) continue;
      var lng = c.side === 'long_liquidated';
      if (S.sideF === 'long' && !lng) continue; if (S.sideF === 'short' && lng) continue;
      ctx.fillStyle = lng ? 'rgba(194,246,74,.85)' : 'rgba(255,179,71,.85)';
      ctx.fillRect(0, cy - 0.8, Math.max(3, c.est_notional / (cMax || 1) * (W - 14)), 1.6); }
    ctx.fillStyle = 'rgba(92,107,132,.9)'; ctx.font = '9px "Space Mono",monospace'; ctx.textAlign = 'center';
    ctx.fillText('POOLS', W / 2, 11);
  }

  var rafP = false;
  function sched() { if (rafP) return; rafP = true; requestAnimationFrame(function () { rafP = false; try { draw(); } catch (e) {} }); }

  // ---------- data ----------
  function loadAll(first) {
    var coin = S.coin, w = WINS[S.win];
    if (first && S.loadEl) S.loadEl.style.display = 'flex';
    var kl = fetch('/api/klines?symbol=' + coin + '&interval=' + w.iv, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    var lv = fetch('/api/v1/liquidations/live?symbol=' + coin + '&limit=400').then(function (r) { return r.json(); }).catch(function () { return null; });
    var cl = fetch('/api/v1/clusters?symbol=' + coin).then(function (r) { return r.json(); }).catch(function () { return null; });
    var pd = fetch('/api/price?symbol=' + coin, { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return null; });
    Promise.all([kl, lv, cl, pd]).then(function (res) {
      if (!S || coin !== S.coin) return;
      var kd = res[0];
      if (kd && kd.length) {
        var cut = Date.now() / 1000 - w.mins * 60 * 1.6; // keep some history left of the window for pool seeding
        S.bars = kd.filter(function (b2) { return b2.time > cut; });
        S.pools = buildPools(S.bars);
        if (first || !S.view) { var t1 = S.bars[S.bars.length - 1].time + (S.bars[1] ? (S.bars[1].time - S.bars[0].time) * 4 : 240); S.view = { t0: Date.now() / 1000 - w.mins * 60, t1: t1 }; }
      }
      if (res[1] && res[1].events) S.events = res[1].events;
      if (res[2] && res[2].clusters) S.clusters = res[2].clusters;
      if (res[3] && +res[3].price > 0) { S.price = +res[3].price; S.chg = +res[3].chg || 0; }
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
    if (S.stEl) { var cut = Date.now() - WINS[S.win].mins * 60000, tot = 0, nn = 0, lo = 0;
      for (var i = 0; i < S.events.length; i++) { var e = S.events[i]; if (e.ts < cut) break; tot += e.notional || 0; nn++; if (e.side === 'long_liquidated') lo += e.notional || 0; }
      S.stEl.textContent = nn ? (nn + ' real liqs · ' + money(tot) + ' (' + Math.round(lo / (tot || 1) * 100) + '% longs) · ' + S.win) : 'no liquidations in window yet'; }
  }

  // ---------- interaction ----------
  function wire() {
    var cv = S.cv, tip = S.tip;
    cv.addEventListener('mousemove', function (ev) {
      if (!S.X) return;
      var r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
      if (S.drag) { var dt = (S.drag.x - mx) / r.width * (S.view.t1 - S.view.t0); S.view.t0 = S.drag.t0 + dt; S.view.t1 = S.drag.t1 + dt; sched(); return; }
      var t = S.view.t0 + mx / r.width * (S.view.t1 - S.view.t0);
      var p = S.yHi - my / r.height * (S.yHi - S.yLo);
      // nearest alive pool bin + nearest real event
      var P = S.pools, best = null, i;
      for (i = 0; i < P.segs.length; i++) { var s = P.segs[i]; if (t < s.t0 || t > s.t1) continue; var d = Math.abs(s.price - p); if (d < P.binH * 2.2 && (!best || d < best.d)) best = { d: d, s: s }; }
      var bev = null;
      for (i = 0; i < S.events.length; i++) { var e = S.events[i], ex = S.X(e.ts / 1000), ey = S.Y(e.price); var dd = Math.hypot(ex - mx, ey - my); if (dd < 13 && (!bev || dd < bev.d)) bev = { d: dd, e: e }; }
      if (!best && !bev) { tip.style.display = 'none'; return; }
      var h = '';
      if (best) { var s2 = best.s; h += '<b>' + fpx(s2.price) + '</b> · <span class="' + (s2.long ? 'l' : 's') + '">' + (s2.long ? 'long' : 'short') + ' pool</span> ~' + money(s2.w) + '<br>' + s2.lev + 'x entries · ' + (s2.consumed ? 'CONSUMED (price traded through)' : 'still standing'); }
      if (bev) { var e2 = bev.e; h += (h ? '<br>' : '') + '<span class="' + (e2.side === 'long_liquidated' ? 'l' : 's') + '">REAL ' + (e2.side === 'long_liquidated' ? 'LONG' : 'SHORT') + ' liq</span> ' + money(e2.notional) + ' @ ' + fpx(e2.price) + ' · ' + e2.exchange; }
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
    cv.addEventListener('dblclick', function () { S.view = null; loadAll(false); setTimeout(function(){ if(S&&!S.view&&S.bars.length){var w=WINS[S.win];S.view={t0:Date.now()/1000-w.mins*60,t1:S.bars[S.bars.length-1].time+240};sched();} },300); });
    // touch: pan
    var tX = null;
    cv.addEventListener('touchstart', function (ev) { if (ev.touches.length === 1) { var r = cv.getBoundingClientRect(); tX = { x: ev.touches[0].clientX - r.left, t0: S.view.t0, t1: S.view.t1 }; } }, { passive: true });
    cv.addEventListener('touchmove', function (ev) { if (tX && ev.touches.length === 1) { var r = cv.getBoundingClientRect(); var dt = (tX.x - (ev.touches[0].clientX - r.left)) / r.width * (tX.t1 - tX.t0); S.view.t0 = tX.t0 + dt; S.view.t1 = tX.t1 + dt; sched(); } }, { passive: true });
    cv.addEventListener('touchend', function () { tX = null; });
  }

  function mount(section, coin) {
    if (!section) return;
    unmount();
    if (!document.getElementById('hmCss')) { var st = document.createElement('style'); st.id = 'hmCss'; st.textContent = CSS; document.head.appendChild(st); }
    coin = (coin || 'BTC').toUpperCase(); if (COINS.indexOf(coin) < 0) coin = 'BTC';
    var wrap = el('div', 'hm-wrap');
    var top = el('div', 'hm-top');
    var coinsEl = el('div', 'hm-coins');
    COINS.forEach(function (c) { var b = el('button', 'hm-coin' + (c === coin ? ' on' : ''), c); b.type = 'button'; b.setAttribute('data-c', c); coinsEl.appendChild(b); });
    var pxEl = el('div', 'hm-px', '…');
    top.appendChild(coinsEl); top.appendChild(pxEl);
    var bar = el('div', 'hm-bar');
    Object.keys(WINS).forEach(function (wk) { var b = el('button', 'hm-pill' + (wk === '1D' ? ' on' : ''), wk); b.type = 'button'; b.setAttribute('data-w', wk); bar.appendChild(b); });
    bar.appendChild(el('span', 'hm-sep'));
    [['all', 'All', ''], ['long', 'Longs', ' side-l'], ['short', 'Shorts', ' side-s']].forEach(function (sd) { var b = el('button', 'hm-pill' + sd[2] + (sd[0] === 'all' ? ' on' : ''), sd[1]); b.type = 'button'; b.setAttribute('data-s', sd[0]); bar.appendChild(b); });
    bar.appendChild(el('span', 'hm-sep'));
    var tgP = el('button', 'hm-pill on', 'Pools'); tgP.type = 'button'; tgP.setAttribute('data-tg', 'pools');
    var tgE = el('button', 'hm-pill on', 'Real liqs'); tgE.type = 'button'; tgE.setAttribute('data-tg', 'events');
    var dl = el('button', 'hm-pill', 'PNG'); dl.type = 'button'; dl.setAttribute('data-dl', '1');
    bar.appendChild(tgP); bar.appendChild(tgE); bar.appendChild(dl);
    var stEl = el('span', 'hm-stats', '');
    bar.appendChild(stEl);
    var stage = el('div', 'hm-stage');
    var cv = el('canvas', 'hm-cv'), pf = el('canvas', 'hm-prof'), tip = el('div', 'hm-tip'), loadEl = el('div', 'hm-load', 'Building liquidation map…');
    stage.appendChild(cv); stage.appendChild(pf); stage.appendChild(tip); stage.appendChild(loadEl);
    var foot = el('div', 'hm-foot',
      '<span class="hm-leg"><i style="background:rgba(46,189,133,.75)"></i>est. long pools (below price)</span>' +
      '<span class="hm-leg"><i style="background:rgba(255,98,88,.75)"></i>est. short pools (above)</span>' +
      '<span class="hm-leg"><i style="background:rgba(194,246,74,.8);border-radius:50%;width:8px;height:8px"></i>real liquidations (our 6-exchange feed)</span>' +
      '<span>model: 10-100x entries at each close, consumed when price trades through · drag to pan · wheel to zoom · dblclick resets</span>');
    wrap.appendChild(top); wrap.appendChild(bar); wrap.appendChild(stage); wrap.appendChild(foot);
    section.innerHTML = ''; section.appendChild(wrap);
    section.style.display = '';

    S = { coin: coin, win: '1D', sideF: 'all', layerPools: true, layerEvents: true, bars: [], pools: { segs: [], alive: [], pMin: 0, pMax: 1, binH: 0 }, events: [], clusters: [], price: 0, chg: 0, view: null, cv: cv, pf: pf, tip: tip, pxEl: pxEl, stEl: stEl, loadEl: loadEl, timers: [] };
    wire();
    wrap.addEventListener('click', function (ev) {
      var t = ev.target.closest('button'); if (!t || !S) return;
      var c = t.getAttribute('data-c'), w = t.getAttribute('data-w'), sd = t.getAttribute('data-s'), tg = t.getAttribute('data-tg');
      if (c) { S.coin = c; S.view = null; S.events = []; S.clusters = []; coinsEl.querySelectorAll('.hm-coin').forEach(function (x) { x.classList.toggle('on', x === t); }); loadAll(true); try { if (window.mpWS) window.mpWS.sub(c); } catch (e) {} }
      else if (w) { S.win = w; S.view = null; bar.querySelectorAll('[data-w]').forEach(function (x) { x.classList.toggle('on', x === t); }); loadAll(true); }
      else if (sd) { S.sideF = sd; bar.querySelectorAll('[data-s]').forEach(function (x) { x.classList.toggle('on', x === t); }); updHead(); sched(); }
      else if (tg) { if (tg === 'pools') { S.layerPools = !S.layerPools; } else { S.layerEvents = !S.layerEvents; } t.classList.toggle('on'); sched(); }
      else if (t.getAttribute('data-dl')) { try { var out = document.createElement('canvas'); out.width = cv.width + pf.width; out.height = cv.height; var ox = out.getContext('2d'); ox.fillStyle = '#07090c'; ox.fillRect(0, 0, out.width, out.height); ox.drawImage(cv, 0, 0); ox.drawImage(pf, cv.width, 0); var a = document.createElement('a'); a.download = 'marginpad-liqmap-' + S.coin + '.png'; a.href = out.toDataURL('image/png'); a.click(); } catch (e) {} }
    });
    // live price from the site WS
    S.onPrice = function (ev) { var d = ev.detail || {}; if (S && d.sym === S.coin && +d.p > 0) { S.price = +d.p; updHead(); sched(); } };
    window.addEventListener('mp:price', S.onPrice);
    try { if (window.mpWS) window.mpWS.sub(coin); } catch (e) {}
    S.timers.push(setInterval(pollEvents, 6000));
    S.timers.push(setInterval(function () { if (S && !document.hidden) loadAll(false); }, 60000));
    S.timers.push(setInterval(function () { if (S && !document.hidden && S.coin) fetch('/api/v1/clusters?symbol=' + S.coin).then(function (r) { return r.json(); }).then(function (d) { if (S && d && d.clusters) { S.clusters = d.clusters; sched(); } }).catch(function () {}); }, 45000));
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
