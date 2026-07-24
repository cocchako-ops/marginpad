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

  var CSS = 'body.heatmap-page .wrap{max-width:none!important}#heatmap.hm-full{width:auto!important;margin-left:0!important;max-width:none!important}' + // same full-width wrap as /paper-trade — header/logo land at the SAME x on both pages (owner 2026-07-25)
    
    '.hm-wrap{background:#0b0d10;border:1px solid #1c2230;border-radius:14px;padding:12px 14px 10px;color:#dbe4f5;font-family:"Familjen Grotesk",system-ui,sans-serif;display:flex;flex-direction:column}' +
    '.hm-bar{order:1}.hm-targets{order:2}.hm-stage{order:3}.hm-foot{order:4}' +
    '.hm-tg-h{display:none}' +
    '.hm-tg-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}' +
    '.hm-tg-exp{display:none}' +
    '.hm-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:9px}' +
    '.hm-sel{appearance:none;-webkit-appearance:none;background:#12161d url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%276%27%3E%3Cpath d=%27M1 1l4 4 4-4%27 stroke=%27%238fa3c4%27 stroke-width=%271.6%27 fill=%27none%27/%3E%3C/svg%3E") no-repeat right 10px center;border:1px solid #232b3a;color:#fff;border-radius:8px;padding:5px 24px 5px 10px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;height:32px}' +
    '.hm-sel:focus{outline:none;border-color:#c2f64a}' +
    '.hm-seg{display:flex;background:#12161d;border:1px solid #232b3a;border-radius:8px;overflow:hidden;height:32px}' +
    '.hm-seg button{background:none;border:0;color:#8fa3c4;padding:0 11px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}' +
    '.hm-seg button.on{background:#1a2413;color:#c2f64a}.hm-seg button.on.s-l{background:#0f2418;color:#2ebd85}.hm-seg button.on.s-s{background:#2a1512;color:#ff6258}' +
    '.hm-px{margin-left:auto;font-family:"Space Mono",monospace;font-size:14.5px;font-weight:700;color:#fff;white-space:nowrap}.hm-px small{font-size:11px;margin-left:5px}.hm-px small.up{color:#2ebd85}.hm-px small.dn{color:#ff6258}' +
    '.hm-stats{font-size:11px;color:#5c6b84;font-family:"Space Mono",monospace;white-space:nowrap}' +
    '.hm-btn{background:#12161d;border:1px solid #232b3a;color:#8fa3c4;border-radius:8px;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-family:inherit;padding:0}' +
    '.hm-btn:hover{color:#dbe4f5;border-color:#3a465c}.hm-btn svg{width:15px;height:15px}' +
    '.hm-stage{position:relative;display:flex;min-height:380px;height:calc(100vh - 320px);max-height:820px}' +
    '.hm-cv{flex:1;min-width:0;display:block;border-radius:10px 0 0 10px;background:#07090c;cursor:crosshair}' +
    '.hm-prof{width:132px;flex:none;display:block;background:#07090c;border-left:1px solid #141a24;border-radius:0 10px 10px 0}' +
    '.hm-tip{position:absolute;pointer-events:none;background:rgba(10,12,16,.97);border:1px solid #2a3345;border-radius:8px;padding:7px 10px;font-size:11.5px;line-height:1.55;color:#dbe4f5;z-index:5;display:none;font-family:"Space Mono",monospace;white-space:nowrap}' +
    '.hm-tip b{color:#fff}.hm-tip .l{color:#2ebd85}.hm-tip .s{color:#ff6258}' +
    '.hm-foot{margin-top:8px;font-size:11px;color:#5c6b84;line-height:1.55}' +
    '.hm-foot b{color:#8fa3c4;font-weight:700}.hm-foot .l{color:#2ebd85}.hm-foot .s{color:#ff6258}' +
    '.hm-selbox{position:absolute;top:10px;left:10px;z-index:6;background:rgba(10,12,16,.96);border:1px solid #c2f64a;border-radius:9px;padding:8px 30px 8px 11px;font:11.5px "Space Mono",monospace;color:#dbe4f5;line-height:1.55;max-width:340px;display:none}' +
    '.hm-selbox b{color:#fff}.hm-selbox .l{color:#2ebd85}.hm-selbox .s{color:#ff6258}.hm-selbox .k{color:#c2f64a;font-weight:800;font-size:9.5px;letter-spacing:.08em;display:block;margin-bottom:2px}' +
    '.hm-selx{position:absolute;top:4px;right:6px;background:none;border:0;color:#5c6b84;font-size:15px;cursor:pointer;font-family:inherit;padding:2px}.hm-selx:hover{color:#fff}' +
    '@media(max-width:980px){.hm-selbox{max-width:78%;font-size:10.5px}}' +
    '.hm-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#5c6b84;font-size:13px;background:rgba(7,9,12,.7);z-index:4;border-radius:10px}' +
    '@media(max-width:980px){.hm-targets{order:4;background:#0d1014;border:1px solid #1e242e;border-radius:10px;padding:10px 12px;margin:8px 0 0}.hm-tg-lab{display:none}.hm-tg-h{display:block;font-size:10px;font-weight:800;letter-spacing:.08em;color:#c2f64a;margin-bottom:6px}.hm-tg-exp{display:block;font-size:10.5px;color:#5c6b84;line-height:1.5;margin-top:7px}.hm-tg-row{display:block;margin:3px 0}.hm-tg-row>span{display:inline-block;margin:2px 8px 2px 0}.hm-foot{order:5}}' +
    '@media(max-width:980px){#heatmap.hm-full{width:auto!important;margin-left:0!important}.hm-wrap{padding:8px 8px 7px}.hm-bar{gap:4px;margin-bottom:6px}.hm-sel{height:27px;padding:2px 20px 2px 8px;font-size:11.5px;border-radius:7px;background-position:right 6px center}.hm-seg{height:27px;border-radius:7px}.hm-seg button{padding:0 8px;font-size:10.5px}.hm-btn{width:27px;height:27px;border-radius:7px}.hm-btn svg{width:13px;height:13px}.hm-px{font-size:12px}.hm-px small{font-size:9.5px;margin-left:3px}.hm-stage{height:52vh;min-height:320px}.hm-prof{width:64px}.hm-stats{display:none}.hm-foot{font-size:10px;margin-top:6px}}';

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
    if (S.yView && (!isFinite(S.yView.lo) || !isFinite(S.yView.hi) || S.yView.hi <= S.yView.lo)) S.yView = null; // corrupt view state self-heals instead of blanking the canvas
    if (S.yView) { pLo = S.yView.lo; pHi = S.yView.hi; } // user panned/zoomed the price axis — respect it
    else {
      for (i = 0; i < bars.length; i++) { b = bars[i]; if (b.time < v.t0 || b.time > v.t1) continue; if (b.low < pLo) pLo = b.low; if (b.high > pHi) pHi = b.high; }
      if (!isFinite(pLo)) { pLo = P.pMin; pHi = P.pMax; }
      var yPad = (pHi - pLo) * 0.28; pLo -= yPad; pHi += yPad;
    }
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
      var al = 0.03 + Math.pow(s.a, 2.1) * 0.85; // owner 2026-07-25: weak pools nearly invisible, strong ones keep the punch — the yellow core is the highlight
      ctx.fillStyle = s.long ? 'rgba(46,189,133,' + (al * 0.5).toFixed(3) + ')' : 'rgba(255,98,88,' + (al * 0.5).toFixed(3) + ')';
      if (s.a > 0.45) ctx.fillRect(x0, y - bh * 0.6, W - x0, bh * 2.2); // soft halo only for meaningful pools — small ones stay whisper-thin
      ctx.fillStyle = s.long ? 'rgba(46,189,133,' + al.toFixed(3) + ')' : 'rgba(255,98,88,' + al.toFixed(3) + ')';
      ctx.fillRect(x0, y, W - x0, bh);
      if (s.a > 0.62) { ctx.fillStyle = s.long ? 'rgba(194,246,74,' + Math.min(0.85, al * 0.75).toFixed(3) + ')' : 'rgba(255,179,71,' + Math.min(0.85, al * 0.75).toFixed(3) + ')'; ctx.fillRect(x0, y + bh * 0.28, W - x0, bh * 0.44); } // the yellow/amber highlight — slightly wider entry, brighter
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
    // post-sweep annotations: where price recently ate a BIG pool (server-logged)
    if (S.sweeps && S.sweeps.length) { ctx.font = '700 10px "Space Mono",monospace'; ctx.textAlign = 'center';
      var shown = 0;
      for (i = 0; i < S.sweeps.length && shown < 3; i++) { var sv = S.sweeps[i], svt = sv.t / 1000;
        if (svt < v.t0 || svt > v.t1 || sv.p < pLo || sv.p > pHi) continue; shown++;
        var sx = X(svt), sy = Y(sv.p);
        ctx.strokeStyle = 'rgba(255,215,90,.95)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx - 4, sy - 4); ctx.lineTo(sx + 4, sy + 4); ctx.moveTo(sx + 4, sy - 4); ctx.lineTo(sx - 4, sy + 4); ctx.stroke();
        var lb = money(sv.w) + ' ' + (sv.long ? 'longs' : 'shorts') + ' liquidated';
        var lw = ctx.measureText(lb).width;
        ctx.fillStyle = 'rgba(7,9,12,.85)'; ctx.fillRect(sx + 8, sy - 8, lw + 8, 14);
        ctx.fillStyle = '#ffd75a'; ctx.textAlign = 'left'; ctx.fillText(lb, sx + 12, sy + 3); ctx.textAlign = 'center';
      } }
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
    if (S.sel) {
      if (S.sel.type === 'pool') { var sp = S.sel.ref;
        if (sp.price >= pLo && sp.price <= pHi) {
          var shh = Math.max(3, H * (P.binH / (pHi - pLo)) * 1.15), sy0 = Y(sp.price) - shh / 2, sx0 = Math.max(0, X(sp.t0));
          ctx.fillStyle = sp.long ? 'rgba(46,189,133,.95)' : 'rgba(255,98,88,.95)'; ctx.fillRect(sx0, sy0, W - sx0, shh);
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4; ctx.strokeRect(sx0 + 0.5, sy0 - 2, W - sx0 - 1, shh + 4);
        }
      } else { var se = S.sel.ref, sts = se.ts / 1000;
        if (sts >= v.t0 && sts <= v.t1 && se.price >= pLo && se.price <= pHi) {
          var sr = Math.max(4, Math.min(12, Math.log10(Math.max(10, se.notional)) * 1.9 - 1));
          ctx.beginPath(); ctx.arc(X(sts), Y(se.price), sr + 4, 0, 6.2832);
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.stroke();
          ctx.beginPath(); ctx.arc(X(sts), Y(se.price), sr + 8, 0, 6.2832);
          ctx.strokeStyle = 'rgba(194,246,74,.55)'; ctx.lineWidth = 1; ctx.stroke();
        }
      }
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
    // scale against the biggest VISIBLE pool — normalizing to the global max (often far off-screen)
    // squashed every visible bar to a 2px sliver and the panel read as empty (owner report 2026-07-24)
    var vis = [];
    for (i = 0; i < P.alive.length; i++) { var s0 = P.alive[i];
      if (S.sideF === 'long' && !s0.long) continue; if (S.sideF === 'short' && s0.long) continue;
      if (s0.price < pLo || s0.price > pHi) continue; vis.push(s0); }
    var wMax = 0; for (i = 0; i < vis.length; i++) if (vis[i].w > wMax) wMax = vis[i].w;
    var bh = Math.max(3, H * (P.binH / (pHi - pLo)));
    for (i = vis.length - 1; i >= 0; i--) { var s = vis[i];
      var y = Y(s.price), rel = s.w / (wMax || 1);
      var bw = 4 + rel * (W - 20);
      ctx.fillStyle = s.long ? 'rgba(46,189,133,' + (0.3 + rel * 0.6).toFixed(2) + ')' : 'rgba(255,98,88,' + (0.3 + rel * 0.6).toFixed(2) + ')';
      ctx.fillRect(0, y - bh / 2, bw, bh); }
    // label the single biggest visible pool with its $ size
    if (vis.length) { var top = vis[0]; var ty = Y(top.price);
      ctx.font = '700 9.5px "Space Mono",monospace'; ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(7,9,12,.8)'; var mt = money(top.w); var mw = ctx.measureText(mt).width;
      ctx.fillRect(W - mw - 10, ty - 7, mw + 8, 13);
      ctx.fillStyle = top.long ? '#7ee2b8' : '#ffa39b';
      ctx.fillText(mt, W - 6, ty + 3); }
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
      fetch('/api/price?symbol=' + coin, { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch('/api/heatmap/pools?symbol=' + coin).then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) {
      if (!S || coin !== S.coin) return;
      var kd = res[0];
      if (kd && kd.length) {
        if (S.bars.length && S.bars[0].time < kd[0].time) { var older = S.bars.filter(function (b3) { return b3.time < kd[0].time; }); kd = older.concat(kd); } // keep back-paginated history — the 60s refresh only replaces the fresh tail
        S.bars = kd;
        var srv = res[3]; // server-accumulated pools (cron model — days of history, same map for everyone); local build = fallback
        if (srv && srv.alive && srv.alive.length > 10 && srv.binH > 0) {
          var arr = srv.alive.map(function (x) { return { price: +x.p, w: +x.w, long: !!x.long, t0: +x.t0, lev: +x.lev }; });
          var wMax = 0; arr.forEach(function (x) { if (x.w > wMax) wMax = x.w; });
          arr.forEach(function (x) { x.a = Math.pow(x.w / (wMax || 1), 0.4); });
          arr.sort(function (a, b) { return b.w - a.w; });
          var pmin = 1 / 0, pmax = -1 / 0; arr.forEach(function (x) { if (x.price < pmin) pmin = x.price; if (x.price > pmax) pmax = x.price; });
          S.pools = { alive: arr, pMin: pmin, pMax: pmax, binH: +srv.binH, srv: 1 };
          S.sweeps = srv.sweeps || [];
        } else { S.pools = buildPools(S.bars); S.sweeps = []; }
        if (!S._fr || Date.now() - S._fr > 300000) { S._fr = Date.now(); fetch('/api/v1/bnc?path=' + encodeURIComponent('/fapi/v1/premiumIndex') + '&symbol=' + coin + 'USDT').then(function (r) { return r.json(); }).then(function (f) { if (S && f && f.lastFundingRate != null) { S.funding = +f.lastFundingRate; updTargets(); } }).catch(function () {}); }
        if (first || !S.view) { var last = S.bars[S.bars.length - 1]; var step = S.bars[1] ? S.bars[1].time - S.bars[0].time : 60; S.view = { t0: Date.now() / 1000 - w.mins * 60, t1: last.time + step * 5 }; }
      }
      if (res[1] && res[1].events) S.events = res[1].events;
      if (res[2] && +res[2].price > 0) { S.price = +res[2].price; S.chg = +res[2].chg || 0; }
      updHead(); updTargets(); if (S.loadEl) S.loadEl.style.display = 'none';
      sched();
      if (first) { S._noMore = 0; S._lm = 0; setTimeout(function () { loadMore(3); }, 800); } // ~5000 candles of history in the background
    });
  }
  function loadMore(chain) { // back-pagination like /charts: pull candles older than the first loaded bar
    if (!S || S._lm || S._noMore || !S.bars.length) return;
    S._lm = 1;
    var coin = S.coin, w = WINS[S.win], endMs = (S.bars[0].time - 1) * 1000;
    fetch('/api/klines?symbol=' + coin + '&interval=' + w.iv + '&end=' + endMs).then(function (r) { return r.ok ? r.json() : null; }).then(function (kd) {
      if (!S || coin !== S.coin) return;
      S._lm = 0;
      var older = (kd || []).filter(function (b3) { return b3.time < S.bars[0].time; });
      if (older.length < 20) { S._noMore = 1; return; }
      S.bars = older.concat(S.bars);
      if (!(S.pools && S.pools.srv)) S.pools = buildPools(S.bars);
      sched();
      if (chain > 0) loadMore(chain - 1); // eager warm-up right after the first paint
    }).catch(function () { S._lm = 0; });
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
  function magnetScore(x, px) { var dist = Math.abs(x.price - px) / px; if (dist < 0.0008) dist = 0.0008; var age = Math.max(0.1, (Date.now() / 1000 - x.t0) / 86400); return x.w * Math.pow(age + 0.3, 0.35) / Math.pow(dist * 100, 0.6); }
  function updTargets() {
    if (!S || !S.tgEl) return; var px = S.price, P = S.pools; if (!(px > 0) || !P.alive.length) { S.tgEl.innerHTML = ''; return; }
    var up = [], dn = [];
    for (var i = 0; i < P.alive.length; i++) { var x = P.alive[i]; if (Math.abs(x.price - px) / px > 0.12) continue; (x.price > px ? up : dn).push(x); }
    var sc = function (a, b) { return magnetScore(b, px) - magnetScore(a, px); }; up.sort(sc); dn.sort(sc);
    var cell = function (x) { var d = ((x.price - px) / px * 100); return '<span style="color:' + (x.long ? '#2ebd85' : '#ff6258') + '"><b style="color:#e9e7df">' + fpx(x.price) + '</b> ' + money(x.w) + ' <i style="font-style:normal;color:#5c6b84">' + (d >= 0 ? '+' : '') + d.toFixed(1) + '%</i></span>'; };
    var h = '<div class="hm-tg-h">TARGETS \u2014 where liquidity pulls price</div>';
    var row1 = '<span style="color:#5c6b84;font-weight:700"><span class="hm-tg-lab">TARGETS </span>\u2191</span>' + (up.length ? up.slice(0, 3).map(cell).join(' ') : '<span style="color:#3a465c">none nearby</span>');
    var row2 = '<span style="color:#5c6b84;font-weight:700;margin-left:6px">\u2193</span>' + (dn.length ? dn.slice(0, 3).map(cell).join(' ') : '<span style="color:#3a465c">none nearby</span>');
    h += '<div class="hm-tg-row">' + row1 + row2;
    // squeeze: strong pools close on BOTH sides
    var wMax = P.alive.length ? P.alive[0].w : 0;
    var nu = up[0], nd = dn[0];
    if (nu && nd && Math.abs(nu.price - px) / px < 0.03 && Math.abs(nd.price - px) / px < 0.03 && nu.w > wMax * 0.35 && nd.w > wMax * 0.35) {
      var lean = S.funding == null ? '' : (S.funding > 0.0001 ? ' \u00b7 longs pay funding \u2192 downside sweep slightly favored' : S.funding < -0.0001 ? ' \u00b7 shorts pay funding \u2192 upside sweep slightly favored' : '');
      h += '<span style="background:rgba(255,215,90,.12);border:1px solid rgba(255,215,90,.45);color:#ffd75a;border-radius:7px;padding:2px 8px;font-weight:800">SQUEEZE SETUP' + lean + '</span>';
    }
    h += '</div><div class="hm-tg-exp">The biggest crowds of liquidation prices near the current price \u2014 green = longs get liquidated there (below), red = shorts (above). Price tends to sweep the largest ones. Drag the map with one finger, pinch with two.</div>';
    S.tgEl.innerHTML = h;
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
      if (S.drag) { if (Math.abs(S.drag.x - mx) + Math.abs(my - S.drag.y) > 5) S._dragged = 1; var dt = (S.drag.x - mx) / r.width * (S.drag.t1 - S.drag.t0); S.view.t0 = S.drag.t0 + dt; S.view.t1 = S.drag.t1 + dt; if (S.bars.length && S.view.t0 < S.bars[0].time + (S.bars[1] ? (S.bars[1].time - S.bars[0].time) : 60) * 30) loadMore(0);
        var dp = (my - S.drag.y) / r.height * (S.drag.yHi - S.drag.yLo); S.yView = { lo: S.drag.yLo + dp, hi: S.drag.yHi + dp }; sched(); return; }
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
    function ago2(t) { var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 2880 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; }
    function showSel() {
      var el2 = S.selBox; if (!el2) return;
      if (!S.sel) { el2.style.display = 'none'; return; }
      var h = '<span class="k">SELECTED</span>';
      if (S.sel.type === 'ev') { var e = S.sel.ref, lg = e.side === 'long_liquidated';
        h += '<span class="' + (lg ? 'l' : 's') + '">' + (lg ? 'LONG' : 'SHORT') + ' liquidation</span> <b>' + money(e.notional) + '</b> @ <b>' + fpx(e.price) + '</b><br>' + String(e.exchange).toUpperCase() + ' · ' + ago2(e.ts);
      } else { var pl2 = S.sel.ref;
        h += '<span class="' + (pl2.long ? 'l' : 's') + '">' + (pl2.long ? 'long' : 'short') + ' liquidation pool</span> <b>~' + money(pl2.w) + '</b> @ <b>' + fpx(pl2.price) + '</b><br>' + (pl2.long ? 'longs get liquidated here' : 'shorts get liquidated here') + ' · building since ' + ago2(pl2.t0 * 1000) + (S.price > 0 ? ' · ' + (((pl2.price - S.price) / S.price * 100) >= 0 ? '+' : '') + ((pl2.price - S.price) / S.price * 100).toFixed(1) + '% from price' : '');
      }
      el2.innerHTML = h + '<button type="button" class="hm-selx" title="Clear selection">×</button>';
      el2.style.display = 'block';
      el2.querySelector('.hm-selx').addEventListener('click', function (ev2) { ev2.stopPropagation(); S.sel = null; showSel(); sched(); });
    }
    S.showSel = showSel;
    cv.addEventListener('click', function (ev) {
      if (S._dragged) { S._dragged = 0; return; }
      if (!S.X) return;
      var r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
      var p = S.yHi - my / r.height * (S.yHi - S.yLo);
      var bev = null, i;
      for (i = 0; i < S.events.length; i++) { var e = S.events[i], ex = S.X(e.ts / 1000), ey = S.Y(e.price); var dd = Math.hypot(ex - mx, ey - my); if (dd < 14 && (!bev || dd < bev.d)) bev = { d: dd, e: e }; }
      if (bev) { S.sel = { type: 'ev', ref: bev.e }; showSel(); sched(); return; }
      var P = S.pools, best = null, t = S.view.t0 + mx / r.width * (S.view.t1 - S.view.t0);
      for (i = 0; i < P.alive.length; i++) { var s2 = P.alive[i]; if (t < s2.t0) continue; var d2 = Math.abs(s2.price - p); if (d2 < P.binH * 2.2 && (!best || s2.w > best.w)) best = s2; }
      if (best) { S.sel = { type: 'pool', ref: best }; showSel(); sched(); return; }
      if (S.sel) { S.sel = null; showSel(); sched(); }
    });

    cv.addEventListener('mousedown', function (ev) { var r = cv.getBoundingClientRect(); S.drag = { x: ev.clientX - r.left, y: ev.clientY - r.top, t0: S.view.t0, t1: S.view.t1, yLo: S.yLo, yHi: S.yHi }; });
    window.addEventListener('mouseup', function () { if (S) S.drag = null; });
    cv.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var r = cv.getBoundingClientRect(), f = ev.deltaY > 0 ? 1.18 : 0.85;
      if (ev.shiftKey || ev.ctrlKey) { // price-axis zoom around the cursor
        var fy = (ev.clientY - r.top) / r.height;
        var lo = S.yView ? S.yView.lo : S.yLo, hi = S.yView ? S.yView.hi : S.yHi;
        var pv = hi - fy * (hi - lo), nsp = (hi - lo) * f;
        S.yView = { lo: pv - (1 - fy) * nsp, hi: pv + fy * nsp }; sched(); return;
      }
      var fx = (ev.clientX - r.left) / r.width;
      var span = S.view.t1 - S.view.t0;
      var full = S.bars.length ? (S.bars[S.bars.length - 1].time - S.bars[0].time) * 1.15 : span * 4; // zoom out to the WHOLE loaded history
      var ns = Math.max(600, Math.min(full, span * f));
      var pivot = S.view.t0 + fx * span;
      S.view.t0 = pivot - fx * ns; S.view.t1 = pivot + (1 - fx) * ns;
      if (S.bars.length && S.view.t0 < S.bars[0].time + 1800) loadMore(1);
      sched();
    }, { passive: false });
    cv.addEventListener('dblclick', function () { if (S.bars.length) { var w = WINS[S.win]; S.view = { t0: Date.now() / 1000 - w.mins * 60, t1: S.bars[S.bars.length - 1].time + 300 }; S.yView = null; sched(); } });
    // touch: 1 finger = pan, 2 fingers = pinch zoom (around the midpoint). passive:false so the page
    // doesn't scroll/rubber-band underneath while the user works the chart.
    var tX = null, tP = null;
    function tDist(ev) { var a = ev.touches[0], b = ev.touches[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1; }
    cv.addEventListener('touchstart', function (ev) {
      var r = cv.getBoundingClientRect();
      if (ev.touches.length === 2) { tX = null; tP = { d: tDist(ev), t0: S.view.t0, t1: S.view.t1, fx: ((ev.touches[0].clientX + ev.touches[1].clientX) / 2 - r.left) / r.width }; }
      else if (ev.touches.length === 1) { tP = null; tX = { x: ev.touches[0].clientX - r.left, y: ev.touches[0].clientY - r.top, t0: S.view.t0, t1: S.view.t1, yLo: S.yLo, yHi: S.yHi }; }
    }, { passive: true });
    cv.addEventListener('touchmove', function (ev) {
      var r = cv.getBoundingClientRect();
      if (tP && ev.touches.length === 2) {
        ev.preventDefault();
        var span0 = tP.t1 - tP.t0;
        var ns = Math.max(600, Math.min(WINS[S.win].mins * 60 * 2.2, span0 * (tP.d / tDist(ev))));
        var pivot = tP.t0 + tP.fx * span0;
        S.view.t0 = pivot - tP.fx * ns; S.view.t1 = pivot + (1 - tP.fx) * ns; sched();
      } else if (tX && ev.touches.length === 1) {
        ev.preventDefault();
        var dt = (tX.x - (ev.touches[0].clientX - r.left)) / r.width * (tX.t1 - tX.t0);
        S.view.t0 = tX.t0 + dt; S.view.t1 = tX.t1 + dt;
        var dp = ((ev.touches[0].clientY - r.top) - tX.y) / r.height * (tX.yHi - tX.yLo);
        S.yView = { lo: tX.yLo + dp, hi: tX.yHi + dp }; sched();
      }
    }, { passive: false });
    // WHERE-$-SITS column = price-axis zoom control (TradingView-style): drag DOWN = expand the range
    // (zoom out, see far pools), drag UP = tighten. Works with finger and mouse; wheel too.
    (function () {
      var pf = S.pf, g = null;
      function yr() { return { lo: S.yView ? S.yView.lo : S.yLo, hi: S.yView ? S.yView.hi : S.yHi }; }
      function apply(dy) { var r0 = g.r, f = Math.exp(dy / 220); var mid = (r0.lo + r0.hi) / 2, half = (r0.hi - r0.lo) / 2 * f; S.yView = { lo: mid - half, hi: mid + half }; sched(); }
      pf.style.cursor = 'ns-resize'; pf.title = 'Drag to zoom the price axis';
      pf.addEventListener('mousedown', function (ev) { g = { y: ev.clientY, r: yr() }; ev.preventDefault(); });
      window.addEventListener('mousemove', function (ev) { if (g && S) apply(ev.clientY - g.y); });
      window.addEventListener('mouseup', function () { g = null; });
      pf.addEventListener('touchstart', function (ev) { if (ev.touches.length === 1) g = { y: ev.touches[0].clientY, r: yr() }; }, { passive: true });
      pf.addEventListener('touchmove', function (ev) { if (g && ev.touches.length === 1) { ev.preventDefault(); apply(ev.touches[0].clientY - g.y); } }, { passive: false });
      pf.addEventListener('touchend', function () { g = null; });
      pf.addEventListener('wheel', function (ev) { ev.preventDefault(); var r0 = yr(), f = ev.deltaY > 0 ? 1.15 : 0.87; var mid = (r0.lo + r0.hi) / 2, half = (r0.hi - r0.lo) / 2 * f; S.yView = { lo: mid - half, hi: mid + half }; sched(); }, { passive: false });
      pf.addEventListener('dblclick', function () { S.yView = null; sched(); });
    })();
    cv.addEventListener('touchend', function (ev) {
      if (ev.touches.length < 2) tP = null;
      if (ev.touches.length === 1) { var r = cv.getBoundingClientRect(); tX = { x: ev.touches[0].clientX - r.left, y: ev.touches[0].clientY - r.top, t0: S.view.t0, t1: S.view.t1, yLo: S.yLo, yHi: S.yHi }; } // FULL state incl. y — the old rebuild here missed y/yLo/yHi, the next 1-finger move produced a NaN price range and the map went blank
      else if (!ev.touches.length) tX = null;
      // double-tap = reset both axes (phones have no dblclick/wheel)
      if (!ev.touches.length) { var nw = Date.now(); if (S._lt && nw - S._lt < 320) { if (S.bars.length) { var w = WINS[S.win]; S.view = { t0: Date.now() / 1000 - w.mins * 60, t1: S.bars[S.bars.length - 1].time + 300 }; S.yView = null; sched(); } S._lt = 0; } else S._lt = nw; }
    });
  }

  function mount(section, coin) {
    if (!section) return;
    unmount();
    if (!document.getElementById('hmCss')) { var st = document.createElement('style'); st.id = 'hmCss'; st.textContent = CSS; document.head.appendChild(st); }
    section.classList.add('hm-full');
    try { document.documentElement.style.overflowY = 'scroll'; } catch (e) {} // keep the scrollbar gutter ALWAYS on — without it this page (which fits the viewport) centers 8px wider than /paper-trade and the logo visibly shifts
    coin = (coin || 'BTC').toUpperCase(); if (COINS.indexOf(coin) < 0) coin = 'BTC';
    var wrap = el('div', 'hm-wrap');
    var bar = el('div', 'hm-bar');
    var selC = el('select', 'hm-sel'); COINS.forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; if (c === coin) o.selected = true; selC.appendChild(o); });
    var selW = el('select', 'hm-sel'); Object.keys(WINS).forEach(function (wk) { var o = document.createElement('option'); o.value = wk; o.textContent = wk === '4H' ? 'Last 4 hours' : wk === '12H' ? 'Last 12 hours' : wk === '1D' ? 'Last 24 hours' : wk === '3D' ? 'Last 3 days' : 'Last 7 days'; if (wk === '1D') o.selected = true; selW.appendChild(o); });
    var seg = el('div', 'hm-seg');
    [['all', 'All', ''], ['long', 'Longs', ' s-l'], ['short', 'Shorts', ' s-s']].forEach(function (sd) { var b = el('button', (sd[0] === 'all' ? 'on' : '') + sd[2], sd[1]); b.type = 'button'; b.setAttribute('data-s', sd[0]); seg.appendChild(b); });
    var dl = el('button', 'hm-btn', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>'); dl.type = 'button'; dl.title = 'Download PNG';
    var sh = el('button', 'hm-btn', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>'); sh.type = 'button'; sh.title = 'Share on X';
    var stEl = el('span', 'hm-stats', '');
    var pxEl = el('div', 'hm-px', '…');
    bar.appendChild(selC); bar.appendChild(selW); bar.appendChild(seg); bar.appendChild(dl); bar.appendChild(sh); bar.appendChild(pxEl); bar.appendChild(stEl);
    var tgEl = el('div', 'hm-targets'); tgEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;align-items:center;font:11.5px "Space Mono",monospace;color:#8fa3c4;margin:0 0 8px;min-height:18px';
    var stage = el('div', 'hm-stage');
    var cv = el('canvas', 'hm-cv'), pf = el('canvas', 'hm-prof'), tip = el('div', 'hm-tip'), loadEl = el('div', 'hm-load', 'Building liquidation map…');
    var selBox = el('div', 'hm-selbox');
    stage.appendChild(cv); stage.appendChild(pf); stage.appendChild(tip); stage.appendChild(loadEl); stage.appendChild(selBox);
    var foot = el('div', 'hm-foot', '<b>How to read it:</b> bright bands are crowds of traders whose <span class="l">long</span>/<span class="s">short</span> liquidation prices are stacking up there — price tends to sweep the brightest ones. Bands disappear the moment price trades through them. Drag to pan (any direction) · scroll = zoom time · Shift+scroll = zoom price · double-click resets.<br><b>Data:</b> real liquidations streamed live from <b>Binance · Bybit · OKX · Gate · HTX · dYdX · BitMEX · Deribit · Bitfinex</b> — that covers roughly <b>80%+</b> of the market&rsquo;s liquidation flow, not 100% of every venue, but the ones that move the market. The bands are our own estimate computed from live price action (10–100&times; entries at each close).');
    wrap.appendChild(bar); wrap.appendChild(tgEl); wrap.appendChild(stage); wrap.appendChild(foot);
    section.innerHTML = ''; section.appendChild(wrap);
    section.style.display = '';

    S = { coin: coin, win: '1D', sideF: 'all', tgEl: tgEl, sweeps: [], funding: null, sel: null, selBox: selBox, bars: [], pools: { alive: [], pMin: 0, pMax: 1, binH: 0 }, events: [], price: 0, chg: 0, view: null, cv: cv, pf: pf, tip: tip, pxEl: pxEl, stEl: stEl, loadEl: loadEl, timers: [] };
    wire();
    selC.addEventListener('change', function () { if (!S) return; S.coin = selC.value; S.view = null; S.yView = null; S.sel = null; if (S.showSel) S.showSel(); S.events = []; loadAll(true); try { if (window.mpWS) window.mpWS.sub(S.coin); } catch (e) {} });
    selW.addEventListener('change', function () { if (!S) return; S.win = selW.value; S.view = null; S.yView = null; S.sel = null; if (S.showSel) S.showSel(); loadAll(true); });
    seg.addEventListener('click', function (ev) { var t = ev.target.closest('button'); if (!t || !S) return; S.sideF = t.getAttribute('data-s'); seg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === t); }); updHead(); sched(); });
    function shot() { var out = document.createElement('canvas'); var sc = window.devicePixelRatio || 1; out.width = cv.width + pf.width; out.height = cv.height + Math.round(34 * sc); var ox = out.getContext('2d'); ox.fillStyle = '#07090c'; ox.fillRect(0, 0, out.width, out.height); ox.drawImage(cv, 0, 0); ox.drawImage(pf, cv.width, 0); ox.fillStyle = '#c2f64a'; ox.font = '700 ' + Math.round(13 * sc) + 'px "Space Mono",monospace'; ox.textAlign = 'left'; ox.fillText(S.coin + ' LIQUIDATION MAP', Math.round(10 * sc), out.height - Math.round(11 * sc)); ox.fillStyle = '#8fa3c4'; ox.textAlign = 'right'; ox.fillText('marginpad.io/heatmap', out.width - Math.round(10 * sc), out.height - Math.round(11 * sc)); return out; }
    dl.addEventListener('click', function () { try { var a = document.createElement('a'); a.download = 'marginpad-liqmap-' + S.coin + '.png'; a.href = shot().toDataURL('image/png'); a.click(); } catch (e) {} });
    function shotX() { // 1200x675 (16:9) — the exact card X shows uncropped in the timeline
      var W = 1200, H = 675, out = document.createElement('canvas'); out.width = W; out.height = H;
      var ox = out.getContext('2d'); ox.fillStyle = '#07090c'; ox.fillRect(0, 0, W, H);
      var HEAD = 62, FOOT = 40, mapH = H - HEAD - FOOT;
      var srcW = cv.width + pf.width, srcH = cv.height;
      // stitch the two canvases, then COVER the map area anchored RIGHT (price line, labels and the profile live there)
      var stg = document.createElement('canvas'); stg.width = srcW; stg.height = srcH;
      var sx = stg.getContext('2d'); sx.fillStyle = '#07090c'; sx.fillRect(0, 0, srcW, srcH); sx.drawImage(cv, 0, 0); sx.drawImage(pf, cv.width, 0);
      var scl = Math.max(W / srcW, mapH / srcH);
      var dw = srcW * scl, dh = srcH * scl;
      ox.drawImage(stg, W - dw, HEAD + (mapH - dh) / 2, dw, dh);
      ox.fillStyle = '#07090c'; ox.fillRect(0, 0, W, HEAD); ox.fillRect(0, H - FOOT, W, FOOT);
      ox.strokeStyle = '#1c2230'; ox.lineWidth = 1; ox.beginPath(); ox.moveTo(0, HEAD - 0.5); ox.lineTo(W, HEAD - 0.5); ox.moveTo(0, H - FOOT + 0.5); ox.lineTo(W, H - FOOT + 0.5); ox.stroke();
      ox.textBaseline = 'middle'; ox.textAlign = 'left';
      ox.fillStyle = '#c2f64a'; ox.font = '700 24px "Space Mono",monospace';
      ox.fillText('$' + S.coin + ' LIQUIDATION HEATMAP', 22, HEAD / 2 + 1);
      if (S.price > 0) { ox.fillStyle = '#ffffff'; ox.font = '700 20px "Space Mono",monospace'; var tW = ox.measureText('$' + S.coin + ' LIQUIDATION HEATMAP').width; ox.font = '700 24px "Space Mono",monospace'; tW = ox.measureText('$' + S.coin + ' LIQUIDATION HEATMAP').width; ox.font = '700 20px "Space Mono",monospace'; ox.fillText('$' + fpx(S.price), 22 + tW + 26, HEAD / 2 + 2); }
      ox.textAlign = 'right'; ox.fillStyle = '#8fa3c4'; ox.font = '700 17px "Space Mono",monospace';
      ox.fillText('marginpad.io/heatmap', W - 22, HEAD / 2 + 1);
      ox.textAlign = 'left'; ox.fillStyle = '#5c6b84'; ox.font = '13px "Space Mono",monospace';
      ox.fillText('Real liquidations live from Binance \u00b7 Bybit \u00b7 OKX \u00b7 BitMEX \u00b7 Deribit \u00b7 Bitfinex \u2014 bright bands = where liquidations are stacking', 22, H - FOOT / 2);
      return out;
    }
    sh.addEventListener('click', function () { try {
      var txt = '$' + S.coin + ' liquidation heatmap — live from 6 exchanges. Price hunts the bright bands.\nhttps://marginpad.io/heatmap';
      shotX().toBlob(function (bl) { try {
        var f = bl ? new File([bl], 'marginpad-liqmap-' + S.coin + '.png', { type: 'image/png' }) : null;
        if (f && navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], text: txt }).catch(function () {}); return; }
        if (bl) { var a = document.createElement('a'); a.download = 'marginpad-liqmap-' + S.coin + '.png'; a.href = URL.createObjectURL(bl); a.click(); }
        window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(txt), '_blank'); // desktop: the PNG just downloaded — attach it to the tweet
      } catch (e2) {} }, 'image/png');
    } catch (e) {} });
    S.onPrice = function (ev) { var d = ev.detail || {}; if (S && d.sym === S.coin && +d.p > 0) { S.price = +d.p; updHead(); if (!S._tgT || Date.now() - S._tgT > 5000) { S._tgT = Date.now(); updTargets(); } sched(); } };
    window.addEventListener('mp:price', S.onPrice);
    try { if (window.mpWS) window.mpWS.sub(coin); } catch (e) {}
    S.timers.push(setInterval(pollEvents, 6000));
    S.timers.push(setInterval(function () { if (S && !document.hidden) loadAll(false); }, 60000));
    S.onVis = function () { if (S && !document.hidden) { loadAll(false); pollEvents(); } };
    document.addEventListener('visibilitychange', S.onVis);
    S.timers.push(setTimeout(function () { try { fetch('/api/auth/heatxp', { method: 'POST' }); } catch (e) {} }, 20000)); // signed-in: +15 XP once/day for actually reading the map
    S.ro = new ResizeObserver(sched); S.ro.observe(cv); S.ro.observe(pf);
    loadAll(true);
  }
  function unmount() {
    if (!S) return;
    try { document.documentElement.style.overflowY = ''; } catch (e) {}
    try { S.timers.forEach(clearInterval); } catch (e) {}
    try { window.removeEventListener('mp:price', S.onPrice); } catch (e) {}
    try { document.removeEventListener('visibilitychange', S.onVis); } catch (e) {}
    try { S.ro && S.ro.disconnect(); } catch (e) {}
    S = null;
  }
  window.mpHeatmap = { mount: mount, unmount: unmount };
})();
