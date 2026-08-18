window.__mpWsSeen=window.__mpWsSeen||{};window.__mpPQ=window.__mpPQ||function(ctx,sym){try{var t=window.__mpWsSeen[sym];return '&px='+ctx+'&pxw='+((t&&Date.now()-t<15000)?1:0);}catch(e){return '';}};if(!window.__mpWsL){window.__mpWsL=1;try{document.addEventListener('mp:price',function(ev){if(ev&&ev.detail&&ev.detail.sym)window.__mpWsSeen[ev.detail.sym]=Date.now();});}catch(e){}} /* TEMP pxtag until 2026-09-01 — DELETE with the pxtag round */
/* mp-heatmap.js — Liquidation Heatmap v2.1 (simplified + full-bleed, owner pass 2026-07-24).
   ONE idea on screen: bright horizontal bands = standing crowds of liquidation prices (est. from every
   candle close at 10/25/50/100x, consumed internally the moment price trades through — only what still
   STANDS is drawn). Price hunts the bright bands. Dots = real liquidations from our 6-exchange feed.
   Controls in one row: coin dropdown · window dropdown · Longs/Shorts filter · stats · PNG.
   Desktop: the section goes full-bleed (chartspace-style) with a viewport-tall canvas. */
(function () {
  if (window.mpHeatmap) return;
  var MMR = 0.005, LEVS = [2, 3, 5, 10, 25, 50, 100], LEVW = { 2: 0.08, 3: 0.10, 5: 0.16, 10: 0.26, 25: 0.20, 50: 0.12, 100: 0.08 };
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
    '.hm-btnw{width:auto;padding:0 11px;font-size:11.5px;font-weight:700}.hm-btnw.on{background:#1a2413;border-color:#c2f64a;color:#c2f64a}' +
    '.hm-stage{position:relative;display:flex;min-height:380px;height:calc(100vh - 320px);max-height:820px}' +
    '.hm-cv{flex:1;min-width:0;display:block;border-radius:10px 0 0 10px;background:#07090c;cursor:crosshair}' +
    '.hm-prof{width:132px;flex:none;display:block;background:#07090c;border-left:1px solid #141a24;border-radius:0 10px 10px 0}' +
    '.hm-tip{position:absolute;pointer-events:none;background:rgba(10,12,16,.97);border:1px solid #2a3345;border-radius:8px;padding:7px 10px;font-size:11.5px;line-height:1.55;color:#dbe4f5;z-index:5;display:none;font-family:"Space Mono",monospace;white-space:nowrap}' +
    '.hm-tip b{color:#fff}.hm-tip .l{color:#2ebd85}.hm-tip .s{color:#ff6258}' +
    '.hm-foot{margin-top:8px;font-size:11px;color:#5c6b84;line-height:1.55}' +
    '.hm-foot b{color:#8fa3c4;font-weight:700}.hm-foot .l{color:#2ebd85}.hm-foot .s{color:#ff6258}' +
    '.hm-selbox{position:absolute;top:10px;left:10px;z-index:6;background:rgba(10,12,16,.96);border:1px solid #c2f64a;border-radius:9px;padding:8px 30px 8px 11px;font:11.5px "Space Mono",monospace;color:#dbe4f5;line-height:1.55;max-width:340px;display:none}' +
    '.hm-selbox b{color:#fff}.hm-selbox .l{color:#2ebd85}.hm-selbox .s{color:#ff6258}.hm-selbox .k{color:#c2f64a;font-weight:800;font-size:9.5px;letter-spacing:.08em;display:block;margin-bottom:2px}' +
    '.hm-cl-h{display:block;color:#c9d4e8;margin-bottom:4px}' +
    '.hm-cl-list{max-height:186px;overflow-y:auto;overscroll-behavior:contain;margin:2px -4px 0 0;padding-right:4px}' +
    '.hm-cl-it{display:flex;gap:7px;align-items:baseline;padding:3.5px 4px;border-radius:6px;cursor:pointer;white-space:nowrap}' +
    '.hm-cl-it:hover{background:rgba(255,255,255,.07)}' +
    '.hm-cl-it .ag{color:#5c6b84;margin-left:auto;font-size:10px}' +
    '.hm-selx{position:absolute;top:4px;right:6px;background:none;border:0;color:#5c6b84;font-size:15px;cursor:pointer;font-family:inherit;padding:2px}.hm-selx:hover{color:#fff}' +
    '@media(max-width:980px){.hm-selbox{max-width:78%;font-size:10.5px}}' +
    '.hm-mast{order:0;display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;margin:2px 2px 10px}' +
    '.hm-mast-l{min-width:0}' +
    '.hm-mast-t{display:flex;align-items:center;gap:10px;font:700 13.5px "Space Mono",monospace;letter-spacing:.13em;color:#c2f64a}' +
    '.hm-live{display:inline-flex;align-items:center;gap:5px;font-size:9px;letter-spacing:.1em;color:#ff6258;border:1px solid #ff625855;border-radius:20px;padding:2px 8px}' +
    '.hm-live i{width:6px;height:6px;border-radius:50%;background:#ff6258;animation:hmLive 1.6s infinite}' +
    '@keyframes hmLive{0%,100%{opacity:1}50%{opacity:.25}}' +
    '.hm-mast-s{font:11px "Familjen Grotesk",sans-serif;color:#5c6b84;margin-top:4px}' +
    '.hm-mast-r{margin-left:auto;text-align:right}' +
    '.hm-mast-r .hm-px{margin-left:0;font-size:19px;line-height:1.15}' +
    '.hm-mast-r .hm-stats{display:block;margin-top:2px}' +
    '.hm-bar .hm-btnw{margin-left:auto}' +
    '.hm-tg-row>span:not(:first-child){background:#0d1116;border:1px solid #1d242f;border-radius:8px;padding:3.5px 9px;white-space:nowrap}' +
    '.hm-stage{border:1px solid #1c2230;border-radius:12px;overflow:hidden}' +
    '.hm-foot{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}' +
    '.hm-foot-c{background:#0b0e13;border:1px solid #1c2230;border-radius:12px;padding:10px 13px}' +
    '.hm-foot-h{font:700 10px "Space Mono",monospace;letter-spacing:.12em;color:#c2f64a;margin-bottom:5px}' +
    '@media(max-width:980px){.hm-mast{margin-bottom:8px}.hm-mast-s{display:none}.hm-mast-r .hm-px{font-size:16px}.hm-foot{grid-template-columns:1fr;gap:8px}}' +
    '.hm-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#5c6b84;font-size:13px;background:rgba(7,9,12,.7);z-index:4;border-radius:10px}' +
    '@media(max-width:980px){.hm-targets{order:4;background:#0d1014;border:1px solid #1e242e;border-radius:10px;padding:10px 12px;margin:8px 0 0}.hm-tg-lab{display:none}.hm-tg-h{display:block;font-size:10px;font-weight:800;letter-spacing:.08em;color:#c2f64a;margin-bottom:6px}.hm-tg-exp{display:block;font-size:10.5px;color:#5c6b84;line-height:1.5;margin-top:7px}.hm-tg-row{display:block;margin:3px 0}.hm-tg-row>span{display:inline-block;margin:2px 8px 2px 0}.hm-foot{order:5}}' +
    '@media(max-width:980px){#heatmap.hm-full{width:auto!important;margin-left:0!important}.hm-wrap{padding:8px 8px 7px}.hm-bar{gap:4px;margin-bottom:6px}.hm-sel{height:27px;padding:2px 20px 2px 8px;font-size:11.5px;border-radius:7px;background-position:right 6px center}.hm-seg{height:27px;border-radius:7px}.hm-seg button{padding:0 8px;font-size:10.5px}.hm-btn{width:27px;height:27px;border-radius:7px}.hm-btn svg{width:13px;height:13px}.hm-px{font-size:12px}.hm-px small{font-size:9.5px;margin-left:3px}.hm-stage{height:52vh;min-height:320px}.hm-prof{width:64px}.hm-stats{display:none}.hm-foot{font-size:10px;margin-top:6px}}';

  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function money(n) { n = +n || 0; var a = Math.abs(n); if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'; if (a >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'; return '$' + n.toFixed(0); }
  function poolGone(x) { return S && S.price > 0 && (x.long ? x.price >= S.price : x.price <= S.price); } // crossed by the live price = consumed, waiting for the server sweep
  function fpx(p) { p = +p; if (!isFinite(p)) return '—'; return p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 1 }) : p >= 1 ? p.toFixed(3) : p.toPrecision(4); }
  function liqPx(entry, lev, long) { return long ? entry * (1 - (1 - MMR) / lev) : entry * (1 + (1 - MMR) / lev); }
  function tlabel(t) { var d = new Date(t * 1000); var w = S && WINS[S.win].mins >= 4320; return w ? (d.getUTCDate() + '.' + (d.getUTCMonth() + 1) + '.') : (('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)); }

  // pool model: only what still STANDS is returned (consumed pools vanish — that is the whole point)
  function buildPools(bars) {
    if (!bars || bars.length < 5) return { alive: [], pMin: 0, pMax: 1, binH: 0 };
    var pMin = 1 / 0, pMax = -1 / 0, i, b;
    for (i = 0; i < bars.length; i++) { b = bars[i]; if (b.low < pMin) pMin = b.low; if (b.high > pMax) pMax = b.high; }
    var pad = (pMax - pMin) * 0.7; pMin -= pad; pMax += pad; // wide enough for the 2x rungs (liq ~50% away)
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
      if (poolGone(s)) continue;
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
    // real liquidations — subtle dots; only sizeable ones get an outline (toggleable via the Dots button)
    if (S.showDots) for (i = 0; i < S.events.length; i++) { var e = S.events[i], ts = e.ts / 1000;
      if (ts < v.t0 || ts > v.t1 || e.price < pLo || e.price > pHi) continue;
      var lng = e.side === 'long_liquidated';
      if (S.sideF === 'long' && !lng) continue; if (S.sideF === 'short' && lng) continue;
      var r = Math.max(1.8, Math.min(10, Math.log10(Math.max(10, e.notional)) * 1.8 - 1.6));
      ctx.beginPath(); ctx.arc(X(ts), Y(e.price), r, 0, 6.2832);
      ctx.fillStyle = lng ? 'rgba(46,189,133,.30)' : 'rgba(255,98,88,.30)'; ctx.fill();
      if (e.notional >= 25000) { ctx.lineWidth = 1.2; ctx.strokeStyle = lng ? '#2ebd85' : '#ff6258'; ctx.stroke(); }
    }
    // big server-logged sweeps → distinct clickable dots (was a space-hungry "$52M longs liquidated" text label — terrible on mobile). Bigger + a glow ring so the huge ones stand out; hover/click shows the amount like every other dot.
    if (S.showDots && S.sweeps && S.sweeps.length) {
      for (i = 0; i < S.sweeps.length; i++) { var sv = S.sweeps[i], svt = sv.t / 1000;
        if (svt < v.t0 || svt > v.t1 || sv.p < pLo || sv.p > pHi) continue;
        if (S.sideF === 'long' && !sv.long) continue; if (S.sideF === 'short' && sv.long) continue;
        var sx = X(svt), sy = Y(sv.p), sr = 6, scol = sv.long ? '46,189,133' : '255,98,88'; // FIXED ~6px HOLLOW DIAMOND, decoupled from sv.w (uncalibrated projection) + smaller than a typical real-event dot (~8px) so real data dominates; no glow
        ctx.beginPath(); ctx.moveTo(sx, sy - sr); ctx.lineTo(sx + sr, sy); ctx.lineTo(sx, sy + sr); ctx.lineTo(sx - sr, sy); ctx.closePath();
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgb(' + scol + ')'; ctx.stroke();
      } }
    // top-3 standing pools labelled right on the map — instant read
    var lab = 0, usedY = [];
    for (i = 0; i < P.alive.length && lab < 3; i++) { var tp = P.alive[i];
      if (poolGone(tp)) continue;
      if (S.sideF === 'long' && !tp.long) continue; if (S.sideF === 'short' && tp.long) continue;
      if (tp.price < pLo || tp.price > pHi) continue;
      var ly = Y(tp.price), clash = false;
      for (var u = 0; u < usedY.length; u++) if (Math.abs(usedY[u] - ly) < 16) { clash = true; break; }
      if (clash) continue; usedY.push(ly); lab++;
      var txt = (tp.long ? 'proj. long zone' : 'proj. short zone');
      ctx.font = '700 11px "Space Mono",monospace';
      var tw = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(7,9,12,.85)'; ctx.fillRect(W - tw - 18, ly - 9, tw + 12, 16);
      ctx.fillStyle = tp.long ? '#7ee2b8' : '#ffa39b'; ctx.textAlign = 'left';
      ctx.fillText(txt, W - tw - 12, ly + 3);
    }
    if (S.sel) {
      if (S.sel.type === 'clu') {
        var crefs = S.sel.refs || [];
        for (var cri = 0; cri < crefs.length; cri++) { var ce = crefs[cri], cts = ce.ts / 1000;
          if (cts < v.t0 || cts > v.t1 || ce.price < pLo || ce.price > pHi) continue;
          ctx.beginPath(); ctx.arc(X(cts), Y(ce.price), 7, 0, 6.2832);
          ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2; ctx.stroke();
        }
      } else if (S.sel.type === 'pool') { var sp = S.sel.ref;
        if (sp.price >= pLo && sp.price <= pHi) {
          var shh = Math.max(3, H * (P.binH / (pHi - pLo)) * 1.15), sy0 = Y(sp.price) - shh / 2, sx0 = Math.max(0, X(sp.t0));
          ctx.fillStyle = sp.long ? 'rgba(46,189,133,.95)' : 'rgba(255,98,88,.95)'; ctx.fillRect(sx0, sy0, W - sx0, shh);
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4; ctx.strokeRect(sx0 + 0.5, sy0 - 2, W - sx0 - 1, shh + 4);
        }
      } else if (S.sel.type === 'swp') { var sw = S.sel.ref, swts = sw.t / 1000;
        if (swts >= v.t0 && swts <= v.t1 && sw.p >= pLo && sw.p <= pHi) {
          var swr = 6, swx = X(swts), swy = Y(sw.p), swc = sw.long ? '46,189,133' : '255,98,88'; // fixed size — selected sweep is the SAME hollow diamond, just emphasized (crosshair + white outline), never a giant filled disc
          ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, swy); ctx.lineTo(W, swy); ctx.moveTo(swx, 0); ctx.lineTo(swx, H); ctx.stroke(); ctx.restore(); // crosshair guides to both axes so it's obvious which dot is selected
          ctx.beginPath(); ctx.moveTo(swx, swy - swr); ctx.lineTo(swx + swr, swy); ctx.lineTo(swx, swy + swr); ctx.lineTo(swx - swr, swy); ctx.closePath(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgb(' + swc + ')'; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(swx, swy - swr - 3); ctx.lineTo(swx + swr + 3, swy); ctx.lineTo(swx, swy + swr + 3); ctx.lineTo(swx - swr - 3, swy); ctx.closePath(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
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
    // YOUR position on the map — see whether your liq sits inside a pool the price is hunting
    if (S.myPos && S.myPos.length) {
      ctx.font = '700 10px "Space Mono",monospace'; ctx.textAlign = 'left';
      for (i = 0; i < S.myPos.length; i++) { var mp = S.myPos[i];
        if (mp.entry > pLo && mp.entry < pHi) { var ey2 = Y(mp.entry);
          ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(56,189,248,.85)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(0, ey2); ctx.lineTo(W, ey2); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(7,9,12,.85)'; ctx.fillRect(4, ey2 - 13, 118, 12);
          ctx.fillStyle = '#38bdf8'; ctx.fillText('YOUR ENTRY ' + (mp.long ? 'L' : 'S') + mp.lev + 'x', 7, ey2 - 4);
        }
        if (mp.liq > pLo && mp.liq < pHi) { var ly2 = Y(mp.liq);
          ctx.setLineDash([5, 3]); ctx.strokeStyle = 'rgba(160,107,255,.9)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(0, ly2); ctx.lineTo(W, ly2); ctx.stroke(); ctx.setLineDash([]);
          var inPool = false; for (var pi2 = 0; pi2 < P.alive.length; pi2++) { if (Math.abs(P.alive[pi2].price - mp.liq) < P.binH * 1.5 && P.alive[pi2].w > (P.alive[0] ? P.alive[0].w * 0.2 : 0)) { inPool = true; break; } }
          var lqTxt = 'YOUR LIQ ' + fpx(mp.liq) + (inPool ? ' — INSIDE A POOL' : '');
          var lw2 = ctx.measureText(lqTxt).width;
          ctx.fillStyle = 'rgba(7,9,12,.85)'; ctx.fillRect(4, ly2 - 13, lw2 + 8, 12);
          ctx.fillStyle = inPool ? '#ffd75a' : '#a06bff'; ctx.fillText(lqTxt, 7, ly2 - 4);
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
      if (poolGone(s0)) continue;
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
      ctx.fillStyle = 'rgba(7,9,12,.8)'; var mt = (top.long ? 'long zone' : 'short zone'); var mw = ctx.measureText(mt).width;
      ctx.fillRect(W - mw - 10, ty - 7, mw + 8, 13);
      ctx.fillStyle = top.long ? '#7ee2b8' : '#ffa39b';
      ctx.fillText(mt, W - 6, ty + 3); }
    ctx.fillStyle = 'rgba(92,107,132,.9)'; ctx.font = '9px "Space Mono",monospace'; ctx.textAlign = 'center';
    ctx.fillText('PROJECTED ZONES', W / 2, 12);
  }

  function poolHit(my, H) { // nearest visible pool band to screen-y `my` (px), respecting side filter + current zoom
    if (!S || !(S.yHi > S.yLo) || !(H > 0)) return null;
    var P = S.pools, rng = S.yHi - S.yLo, bh = H * (P.binH / rng), tol = Math.max(bh / 2 + 4, 10), best = null;
    for (var i = 0; i < P.alive.length; i++) { var s = P.alive[i];
      if (poolGone(s)) continue;
      if (S.sideF === 'long' && !s.long) continue; if (S.sideF === 'short' && s.long) continue;
      if (s.price < S.yLo || s.price > S.yHi) continue;
      var py = (S.yHi - s.price) / rng * H, d = Math.abs(py - my);
      if (d < tol && (!best || d < best.d)) best = { d: d, s: s };
    }
    return best ? best.s : null;
  }
  var rafP = false;
  function sched() { if (rafP) return; rafP = true; requestAnimationFrame(function () { rafP = false; try { draw(); } catch (e) {} }); }

  function loadAll(first) {
    var coin = S.coin, w = WINS[S.win];
    if (first && S.loadEl) S.loadEl.style.display = 'flex';
    Promise.all([
      fetch('/api/klines?symbol=' + coin + '&interval=' + w.iv, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch('/api/v1/liquidations/live?symbol=' + coin + '&limit=1000').then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch('/api/price?symbol=' + coin + window.__mpPQ('heatx', coin), { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return null; }),
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
      loadMyPos(); updHead(); updTargets(); if (S.loadEl) S.loadEl.style.display = 'none';
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
  function loadMyPos() { // the user's OPEN paper trades for this coin -> drawn on the map (entry + liq lines)
    if (!S) return;
    try {
      var jn = JSON.parse(localStorage.getItem('mp_journal') || '[]');
      S.myPos = jn.filter(function (t) { return t && t.status !== 'win' && t.status !== 'loss' && String(t.sym || '').toUpperCase() === S.coin && +t.entry > 0; })
        .slice(0, 6).map(function (t) { var lev = +t.lev || 1, long = t.side !== 'short';
          var liq = +t.liq || (long ? t.entry * (1 - (1 - MMR) / lev) : t.entry * (1 + (1 - MMR) / lev));
          return { entry: +t.entry, liq: liq, long: long, lev: lev }; });
    } catch (e) { S.myPos = []; }
  }
  function pollEvents() {
    if (!S || document.hidden) return;
    var coin = S.coin;
    fetch('/api/v1/liquidations/live?symbol=' + coin + '&limit=120').then(function (r) { return r.json(); }).then(function (d) {
      if (!S || coin !== S.coin || !d || !d.events) return;
      var seen = {}; S.events.slice(0, 200).forEach(function (e) { seen[e.ts + '|' + e.price + '|' + e.qty] = 1; });
      var fresh = d.events.filter(function (e) { return !seen[e.ts + '|' + e.price + '|' + e.qty]; });
      if (fresh.length) { S.events = fresh.concat(S.events).slice(0, 2200); updHead(); sched(); }
    }).catch(function () {});
  }
  function magnetScore(x, px) { var dist = Math.abs(x.price - px) / px; if (dist < 0.0008) dist = 0.0008; var age = Math.max(0.1, (Date.now() / 1000 - x.t0) / 86400); return x.w * Math.pow(age + 0.3, 0.35) / Math.pow(dist * 100, 0.6); }
  function updTargets() {
    if (!S || !S.tgEl) return; var px = S.price, P = S.pools; if (!(px > 0) || !P.alive.length) { S.tgEl.innerHTML = ''; return; }
    var up = [], dn = [];
    for (var i = 0; i < P.alive.length; i++) { var x = P.alive[i]; if (poolGone(x)) continue; if (Math.abs(x.price - px) / px > 0.12) continue; (x.price > px ? up : dn).push(x); }
    var sc = function (a, b) { return magnetScore(b, px) - magnetScore(a, px); }; up.sort(sc); dn.sort(sc);
    var cell = function (x) { var d = ((x.price - px) / px * 100); return '<span style="color:' + (x.long ? '#2ebd85' : '#ff6258') + '"><b style="color:#e9e7df">' + fpx(x.price) + '</b> <i style="font-style:normal;color:#5c6b84">' + (d >= 0 ? '+' : '') + d.toFixed(1) + '%</i></span>'; };
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
    h += '</div><div class="hm-tg-exp">Projected leverage zones near the current price \u2014 green = longs would liquidate there (below), red = shorts (above). Estimated from volume \u00d7 leverage, not realized liquidations. Price tends to sweep the largest ones. Drag the map with one finger, pinch with two.</div>';
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
      var _ph = poolHit(my, r.height), best = _ph ? { s: _ph } : null, i;
      var bev = null, nNear = 0;
      if (S.showDots) for (i = 0; i < S.events.length; i++) { var e = S.events[i], ex = S.X(e.ts / 1000), ey = S.Y(e.price); var dd = Math.hypot(ex - mx, ey - my); if (dd < 13) { nNear++; if (!bev || dd < bev.d) bev = { d: dd, e: e }; } }
      var bsw = null;
      if (S.showDots && S.sweeps) for (i = 0; i < S.sweeps.length; i++) { var swv = S.sweeps[i]; if (S.sideF === 'long' && !swv.long) continue; if (S.sideF === 'short' && swv.long) continue; var sd0 = Math.hypot(S.X(swv.t / 1000) - mx, S.Y(swv.p) - my); if (sd0 < 16 && (!bsw || sd0 < bsw.d)) bsw = { d: sd0, s: swv }; }
      if (!best && !bev && !bsw) { tip.style.display = 'none'; return; }
      var h = '';
      if (best) { var s2 = best.s; h += '<b>' + fpx(s2.price) + '</b> — <span class="' + (s2.long ? 'l' : 's') + '">projected ' + (s2.long ? 'long' : 'short') + '-liq zone</span><br>' + (s2.long ? 'longs' : 'shorts') + ' would liquidate here'; }
      if (bsw) { var sw3 = bsw.s; h += (h ? '<br>' : '') + '<span class="' + (sw3.long ? 'l' : 's') + '">price swept a projected ' + (sw3.long ? 'long' : 'short') + ' zone</span>'; }
      else if (bev) { var e2 = bev.e; h += (h ? '<br>' : '') + '<span class="' + (e2.side === 'long_liquidated' ? 'l' : 's') + '">' + (e2.side === 'long_liquidated' ? 'LONG' : 'SHORT') + ' liquidated</span> ' + money(e2.notional) + ' · ' + e2.exchange + (nNear > 1 ? ' <span style="color:#c2f64a">+' + (nNear - 1) + ' more — click to list</span>' : ''); }
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
      if (S.sel.type === 'clu') {
        var refs = S.sel.refs, totC = 0; refs.forEach(function (x) { totC += x.notional; });
        h = '<span class="k">CLUSTER</span><span class="hm-cl-h"><b>' + refs.length + ' liquidations</b> stacked here · <b>' + money(totC) + '</b> total — pick one:</span><div class="hm-cl-list">';
        refs.slice(0, 30).forEach(function (x, ci) {
          var lg2 = x.side === 'long_liquidated';
          h += '<div class="hm-cl-it" data-ci="' + ci + '"><span class="' + (lg2 ? 'l' : 's') + '">' + (lg2 ? 'LONG' : 'SHORT') + '</span><b>' + money(x.notional) + '</b><span>@ ' + fpx(x.price) + '</span><span>' + String(x.exchange).toUpperCase() + '</span><span class="ag">' + ago2(x.ts) + '</span></div>';
        });
        if (refs.length > 30) h += '<div class="hm-cl-it" style="cursor:default;color:#5c6b84">+ ' + (refs.length - 30) + ' more (zoom in to split the cluster)</div>';
        h += '</div>';
        el2.innerHTML = h + '<button type="button" class="hm-selx" title="Clear selection">\u00d7</button>';
        el2.style.display = 'block';
        el2.querySelector('.hm-selx').addEventListener('click', function (ev2) { ev2.stopPropagation(); S.sel = null; showSel(); sched(); });
        el2.querySelectorAll('.hm-cl-it[data-ci]').forEach(function (row) {
          row.addEventListener('click', function (ev3) { ev3.stopPropagation(); var ci = +row.getAttribute('data-ci'); var e4 = S.sel && S.sel.refs && S.sel.refs[ci]; if (e4) { S.sel = { type: 'ev', ref: e4 }; showSel(); sched(); } });
        });
        return;
      }
      if (S.sel.type === 'ev') { var e = S.sel.ref, lg = e.side === 'long_liquidated';
        h += '<span class="' + (lg ? 'l' : 's') + '">' + (lg ? 'LONG' : 'SHORT') + ' liquidation</span> <b>' + money(e.notional) + '</b> @ <b>' + fpx(e.price) + '</b><br>' + String(e.exchange).toUpperCase() + ' · ' + ago2(e.ts);
      } else if (S.sel.type === 'swp') { var sw = S.sel.ref;
        h += '<span class="' + (sw.long ? 'l' : 's') + '">price swept a projected ' + (sw.long ? 'long' : 'short') + ' leverage zone</span> @ <b>' + fpx(sw.p) + '</b><br>the model projected ' + (sw.long ? 'long' : 'short') + ' liquidations clustering here (estimated, not measured) · ' + ago2(sw.t);
      } else { var pl2 = S.sel.ref;
        h += '<span class="' + (pl2.long ? 'l' : 's') + '">projected ' + (pl2.long ? 'long' : 'short') + ' liquidation zone</span> @ <b>' + fpx(pl2.price) + '</b><br>' + (pl2.long ? 'longs' : 'shorts') + ' would liquidate here if price reaches it (estimated leverage exposure, not realized) · building since ' + ago2(pl2.t0 * 1000) + (S.price > 0 ? ' · ' + (((pl2.price - S.price) / S.price * 100) >= 0 ? '+' : '') + ((pl2.price - S.price) / S.price * 100).toFixed(1) + '% from price' : '');
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
      var hits = [], i;
      if (S.showDots && S.sweeps) { var swH = null; for (i = 0; i < S.sweeps.length; i++) { var sw4 = S.sweeps[i]; if (S.sideF === 'long' && !sw4.long) continue; if (S.sideF === 'short' && sw4.long) continue; var d4 = Math.hypot(S.X(sw4.t / 1000) - mx, S.Y(sw4.p) - my); if (d4 < 16 && (!swH || d4 < swH.d)) swH = { d: d4, s: sw4 }; } if (swH) { S.sel = { type: 'swp', ref: swH.s }; showSel(); sched(); return; } }
      if (S.showDots) for (i = 0; i < S.events.length; i++) { var e = S.events[i], ex = S.X(e.ts / 1000), ey = S.Y(e.price); var dd = Math.hypot(ex - mx, ey - my); if (dd < 16) hits.push({ d: dd, e: e }); }
      if (hits.length === 1) { S.sel = { type: 'ev', ref: hits[0].e }; showSel(); sched(); return; }
      if (hits.length > 1) { hits.sort(function (a, b) { return b.e.notional - a.e.notional; }); S.sel = { type: 'clu', refs: hits.map(function (x) { return x.e; }) }; showSel(); sched(); return; }
      var best = poolHit(my, r.height);
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
      var pf = S.pf, g = null, moved = 0;
      function yr() { return { lo: S.yView ? S.yView.lo : S.yLo, hi: S.yView ? S.yView.hi : S.yHi }; }
      function apply(dy) { if (Math.abs(dy) > 4) moved = 1; var r0 = g.r, f = Math.exp(dy / 220); var mid = (r0.lo + r0.hi) / 2, half = (r0.hi - r0.lo) / 2 * f; S.yView = { lo: mid - half, hi: mid + half }; sched(); }
      function pfPick(cy) { var r = pf.getBoundingClientRect(), s = poolHit(cy - r.top, r.height); if (s) { S.sel = { type: 'pool', ref: s }; if (S.showSel) S.showSel(); sched(); } else if (S.sel && S.sel.type === 'pool') { S.sel = null; if (S.showSel) S.showSel(); sched(); } }
      pf.style.cursor = 'ns-resize'; pf.title = 'Drag to zoom the price axis';
      pf.addEventListener('mousedown', function (ev) { g = { y: ev.clientY, r: yr() }; moved = 0; ev.preventDefault(); });
      pf.addEventListener('click', function (ev) { if (moved) { moved = 0; return; } pfPick(ev.clientY); });
      window.addEventListener('mousemove', function (ev) { if (g && S) apply(ev.clientY - g.y); });
      window.addEventListener('mouseup', function () { g = null; });
      pf.addEventListener('touchstart', function (ev) { if (ev.touches.length === 1) g = { y: ev.touches[0].clientY, r: yr() }; }, { passive: true });
      pf.addEventListener('touchmove', function (ev) { if (g && ev.touches.length === 1) { ev.preventDefault(); apply(ev.touches[0].clientY - g.y); } }, { passive: false });
      pf.addEventListener('touchend', function (ev) { if (!moved && g) { var t = (ev.changedTouches && ev.changedTouches[0]); if (t) pfPick(t.clientY); } g = null; });
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


  // ===== Liquidation market pulse (below the map): treemap by coin + window totals + per-exchange split + all-time top 10 =====
  var MKT_TOP10 = [
    ['2025-10-10', '$19.16B', 'U.S. tariff hike on China'],
    ['2021-04-18', '$9.94B', 'AML crackdown rumor + mining halt'],
    ['2021-05-19', '$9.01B', 'Tesla stance reversal + regulatory tightening'],
    ['2021-02-22', '$4.10B', 'Overheated rally correction'],
    ['2021-09-07', '$3.65B', 'El Salvador BTC law launch dump'],
    ['2025-09-22', '$3.62B', 'Over-leveraged longs flushed'],
    ['2021-02-23', '$3.15B', 'Yellen anti-BTC remarks'],
    ['2021-04-23', '$2.92B', 'U.S. capital-gains tax hike plan'],
    ['2021-04-16', '$2.77B', 'Turkey crypto-payment ban'],
    ['2026-01-31', '$2.56B', 'Over-leveraged longs flushed']
  ];
  var MKT_CSS = '.hm-mkt{order:9;margin:26px 0 10px;color:#dbe4f5;font-family:"Familjen Grotesk",system-ui,sans-serif}' +
    '.hm-mkt-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}' +
    '.hm-mkt-head>b{font:700 12px "Space Mono",monospace;letter-spacing:.14em;color:#c2f64a}' +
    '.hm-mkt-sub{font:11px "Space Mono",monospace;color:#5c6b84}' +
    '.hm-mkt-chips{display:flex;gap:6px;margin-left:auto}' +
    '.hm-mkt-chips button{background:#0b0e13;border:1px solid #1c2230;color:#8fa3c4;font:11px "Space Mono",monospace;padding:5px 12px;border-radius:8px;cursor:pointer}' +
    '.hm-mkt-chips button.on{border-color:#c2f64a;color:#c2f64a}' +
    '.hm-mkt-grid{display:grid;grid-template-columns:minmax(0,1fr) 370px;gap:14px;align-items:start}' +
    '.hm-mkt-l,.hm-mkt-r{min-width:0}' +
    '.hm-tm{position:relative;height:340px;background:#0b0e13;border:1px solid #1c2230;border-radius:12px;overflow:hidden}' +
    '.hm-tm-c{position:absolute;border-radius:3px;overflow:hidden;padding:5px 7px;box-sizing:border-box}' +
    '.hm-tm-c b{display:block;font:700 12px "Space Mono",monospace;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.hm-tm-c span{display:block;font:10.5px "Space Mono",monospace;color:rgba(255,255,255,.82);white-space:nowrap;overflow:hidden}' +
    '.hm-ext{margin-top:12px;background:#0b0e13;border:1px solid #1c2230;border-radius:12px;padding:4px 14px 8px;font:11.5px "Space Mono",monospace;overflow-x:auto}' +
    '.hm-ext-h,.hm-ext-r{display:grid;grid-template-columns:1.25fr 1fr 1fr 1fr 1.35fr;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #10151f;min-width:460px}' +
    '.hm-ext-h{color:#5c6b84;font-size:10px;letter-spacing:.08em;text-transform:uppercase}' +
    '.hm-ext-r:last-child{border-bottom:0}' +
    '.hm-ext-r .ex{color:#dbe4f5;text-transform:capitalize;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.hm-ext-r b{color:#fff;font-weight:700}' +
    '.hm-mkt .tl{color:#2ebd85}.hm-mkt .ts{color:#ff6258}' +
    '.hm-ext-r .shr{position:relative;height:14px;background:#10151f;border-radius:4px;overflow:hidden}' +
    '.hm-ext-r .shr i{position:absolute;left:0;top:0;bottom:0;background:rgba(194,246,74,.4);border-radius:4px}' +
    '.hm-ext-r .shr em{position:absolute;right:5px;top:0;line-height:14px;font-style:normal;font-size:9.5px;color:#c9d4e8}' +
    '.hm-tots{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
    '.hm-tot{background:#0b0e13;border:1px solid #1c2230;border-radius:12px;padding:10px 13px;display:flex;flex-direction:column;gap:2px;font:11px "Space Mono",monospace}' +
    '.hm-tot .tw{color:#5c6b84;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase}' +
    '.hm-tot b{font-size:17px;color:#fff;margin:1px 0 2px}' +
    '.hm-story{margin-top:12px;background:#0b0e13;border:1px solid #1c2230;border-radius:12px;padding:11px 14px;font:12px/1.65 "Familjen Grotesk",sans-serif;color:#8fa3c4}' +
    '.hm-story b{color:#fff}' +
    '.hm-t10{margin-top:12px;background:#0b0e13;border:1px solid #1c2230;border-radius:12px;padding:8px 14px 6px;font:11.5px "Space Mono",monospace}' +
    '.hm-t10-h{font:700 10.5px "Space Mono",monospace;letter-spacing:.12em;color:#c2f64a;padding:5px 0 7px;border-bottom:1px solid #10151f}' +
    '.hm-t10-r{display:grid;grid-template-columns:24px 86px 62px minmax(0,1fr);gap:8px;align-items:center;padding:6.5px 0;border-bottom:1px solid #10151f}' +
    '.hm-t10-r:last-child{border-bottom:0}' +
    '.hm-t10-r .rk{display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:50%;background:#141a26;color:#8fa3c4;font-size:10px;font-weight:700}' +
    '.hm-t10-r .rk1{background:rgba(255,215,90,.16);color:#ffd75a}.hm-t10-r .rk2{background:rgba(201,212,232,.14);color:#c9d4e8}.hm-t10-r .rk3{background:rgba(201,127,74,.16);color:#c97f4a}' +
    '.hm-t10-r .dt{color:#5c6b84}.hm-t10-r b{color:#fff}.hm-t10-r .why{color:#8fa3c4;font-family:"Familjen Grotesk",sans-serif;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '@media(max-width:980px){.hm-mkt-grid{grid-template-columns:1fr}.hm-tm{height:250px}.hm-mkt-chips{margin-left:0;width:100%}.hm-t10-r .why{white-space:normal}.hm-mkt-l,.hm-mkt-r{display:contents}.hm-tmw{order:1}.hm-tots{order:2}.hm-story{order:3}.hm-ext{order:4}.hm-t10{order:5}}';
  function layoutTreemap(items, W, H) { // squarified treemap: items [{v,...}] sorted desc -> [{x,y,w,h,it}]
    var sum = 0; items.forEach(function (i) { sum += i.v; }); if (!(sum > 0)) return [];
    var scaled = items.map(function (i) { return { it: i, a: i.v / sum * W * H }; });
    var rects = [], x = 0, y = 0, w = W, h = H, row = [], i = 0;
    function worst(r) { var s = 0, mx = 0, mn = 1e18, side = Math.min(w, h); r.forEach(function (q) { s += q.a; mx = Math.max(mx, q.a); mn = Math.min(mn, q.a); }); var s2 = s * s, d2 = side * side; return Math.max(d2 * mx / s2, s2 / (d2 * mn)); }
    function flush(r) {
      var s = 0; r.forEach(function (q) { s += q.a; });
      if (w >= h) { var rw = s / h, cy = y; r.forEach(function (q) { var rh = q.a / rw; rects.push({ x: x, y: cy, w: rw, h: rh, it: q.it }); cy += rh; }); x += rw; w -= rw; }
      else { var rh2 = s / w, cx = x; r.forEach(function (q) { var rw2 = q.a / rh2; rects.push({ x: cx, y: y, w: rw2, h: rh2, it: q.it }); cx += rw2; }); y += rh2; h -= rh2; }
    }
    while (i < scaled.length) {
      var q = scaled[i];
      if (!row.length || worst(row.concat([q])) <= worst(row)) { row.push(q); i++; }
      else { flush(row); row = []; }
    }
    if (row.length) flush(row);
    return rects;
  }
  var MKT_CSS2 = '.hm-tmw{position:relative}' +
    '.hm-tmd{position:absolute;top:0;left:0;right:0;z-index:6;max-height:100%;overflow:auto;overscroll-behavior:contain;background:rgba(9,11,15,.97);border:1px solid #c2f64a55;border-radius:12px;padding:12px 14px;font:11.5px "Space Mono",monospace;display:none;box-shadow:0 10px 34px rgba(0,0,0,.5)}' +
    '.hm-tmd-x{position:absolute;top:8px;right:10px;background:none;border:0;color:#5c6b84;font-size:16px;cursor:pointer;font-family:inherit}.hm-tmd-x:hover{color:#fff}' +
    '.hm-tmd-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:9px}.hm-tmd-h b{font-size:15px;color:#fff}.hm-tmd-h .pxv{color:#c9d4e8}.hm-tmd-h .chg{font-size:11px}' +
    '.hm-tmd-g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}' +
    '.hm-tmd-c{background:#10151f;border-radius:9px;padding:8px 10px;display:flex;flex-direction:column;gap:2px}' +
    '.hm-tmd-c .tw{color:#5c6b84;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase}.hm-tmd-c b{color:#fff;font-size:13px}' +
    '.hm-tmd-cta{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}' +
    '.hm-tmd-cta a,.hm-tmd-cta button{background:#141a26;border:1px solid #2a3550;color:#c2f64a;font:11px "Space Mono",monospace;padding:6px 12px;border-radius:8px;cursor:pointer;text-decoration:none}' +
    '.hm-tmd-cta a:hover,.hm-tmd-cta button:hover{border-color:#c2f64a}' +
    '.hm-ext-h span[data-k]{cursor:pointer}.hm-ext-h span[data-k]:hover{color:#c2f64a}.hm-ext-h span[data-k].on{color:#c2f64a}' +
    '.hm-ct{margin-top:14px;background:#0b0e13;border:1px solid #1c2230;border-radius:12px;padding:10px 14px 6px}' +
    '.hm-ct-h{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:2px 0 9px;border-bottom:1px solid #10151f}' +
    '.hm-ct-h b{font:700 11px "Space Mono",monospace;letter-spacing:.13em;color:#c2f64a}' +
    '.hm-ct-h input{margin-left:auto;background:#10151f;border:1px solid #1c2230;border-radius:8px;color:#dbe4f5;font:11.5px "Space Mono",monospace;padding:6px 10px;width:150px;outline:none}' +
    '.hm-ct-h input:focus{border-color:#2a3550}' +
    '.hm-ct-tw{height:560px;overflow:auto;overscroll-behavior:contain}' +
    '.hm-ct-hd{position:sticky;top:0;background:#0b0e13;z-index:2}' +
    '.hm-ct-n{font:10.5px "Space Mono",monospace;color:#5c6b84}' +
    '@media(max-width:980px){.hm-ct-tw{height:430px}}' +
    '.hm-ct-hd,.hm-ct-r{display:grid;grid-template-columns:34px 120px 118px repeat(8,minmax(76px,1fr));gap:6px;align-items:center;min-width:1000px;padding:7px 0;border-bottom:1px solid #10151f;font:11px "Space Mono",monospace}' +
    '.hm-ct-hd{color:#5c6b84;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase}' +
    '.hm-ct-hd span[data-ck]{cursor:pointer}.hm-ct-hd span[data-ck]:hover{color:#c2f64a}.hm-ct-hd span[data-ck].on{color:#c2f64a}' +
    '.hm-ct-r:last-child{border-bottom:0}.hm-ct-r{cursor:pointer}.hm-ct-r:hover{background:rgba(255,255,255,.02)}' +
    '.hm-ct-r .rk2c{color:#5c6b84}.hm-ct-r .sym{color:#fff;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.hm-ct-r .pxc{color:#c9d4e8;white-space:nowrap}.hm-ct-r .pxc i{font-style:normal;font-size:9.5px;display:block}' +
    '.hm-ct-r .hv{border-radius:5px;padding:4px 6px;color:#eef3ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '@media(max-width:980px){.hm-tmd-g{grid-template-columns:1fr 1fr}}';
  function buildMkt(wrap) {
    if (!document.getElementById('hmMktCss')) { var st = document.createElement('style'); st.id = 'hmMktCss'; st.textContent = MKT_CSS + MKT_CSS2; document.head.appendChild(st); }
    var M = { win: '24H', p: null, px: {}, exSort: { k: 'v', d: -1 }, ctSort: { k: 't24', d: -1 }, ctQ: '' };
    var host = el('div', 'hm-mkt'); wrap.appendChild(host);
    var WINH = { '1H': 'h1', '4H': 'h4', '12H': 'h12', '24H': 'h24' };
    var head = el('div', 'hm-mkt-head');
    head.appendChild(el('b', '', 'LIQUIDATION MARKET PULSE'));
    head.appendChild(el('span', 'hm-mkt-sub', 'every coin · all venues · orders ≥ $1K · live'));
    var chips = el('div', 'hm-mkt-chips');
    Object.keys(WINH).forEach(function (k) { var b = el('button', k === M.win ? 'on' : '', k.toLowerCase()); b.type = 'button'; b.setAttribute('data-w', k); chips.appendChild(b); });
    head.appendChild(chips); host.appendChild(head);
    var grid = el('div', 'hm-mkt-grid'), left = el('div', 'hm-mkt-l'), right = el('div', 'hm-mkt-r');
    var tm = el('div', 'hm-tm'), det = el('div', 'hm-tmd'), exT = el('div', 'hm-ext'), tots = el('div', 'hm-tots'), story = el('div', 'hm-story'), t10 = el('div', 'hm-t10');
    var tmw = el('div', 'hm-tmw'); tmw.appendChild(tm); tmw.appendChild(det);
    left.appendChild(tmw); left.appendChild(exT);
    right.appendChild(tots); right.appendChild(story); right.appendChild(t10);
    grid.appendChild(left); grid.appendChild(right); host.appendChild(grid);
    var ct = el('div', 'hm-ct');
    var ctH = el('div', 'hm-ct-h'); ctH.appendChild(el('b', '', 'TOTAL LIQUIDATIONS BY COIN'));
    var ctN = el('span', 'hm-ct-n', ''); ctH.appendChild(ctN);
    var ctQ = el('input', ''); ctQ.type = 'text'; ctQ.placeholder = 'Search coin'; ctH.appendChild(ctQ);
    var ctTb = el('div', 'hm-ct-tw');
    ct.appendChild(ctH); ct.appendChild(ctTb); host.appendChild(ct);
    var h10 = '<div class="hm-t10-h">TOP 10 LIQUIDATION EVENTS OF ALL TIME</div>';
    MKT_TOP10.forEach(function (r, i) { h10 += '<div class="hm-t10-r"><span class="rk rk' + (i + 1) + '">' + (i + 1) + '</span><span class="dt">' + r[0] + '</span><b>' + r[1] + '</b><span class="why">' + r[2] + '</span></div>'; });
    t10.innerHTML = h10;
    chips.addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return; M.win = b.getAttribute('data-w'); chips.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); render(); });
    ctQ.addEventListener('input', function () { M.ctQ = (ctQ.value || '').trim().toUpperCase(); ctRender(); });
    function winsOf(sym) {
      var o = {};
      ['h1', 'h4', 'h12', 'h24'].forEach(function (k) {
        var r = null, a = (M.p[k] || {}).bySym || [];
        for (var i = 0; i < a.length; i++) if (a[i].s === sym) { r = a[i]; break; }
        o[k] = r ? { l: +r.l, s: +r.sh } : { l: 0, s: 0 };
      });
      return o;
    }
    function priceOf(sym) {
      if (M.px[sym]) return M.px[sym];
      var a = (M.p && M.p.h24 ? M.p.h24.bySym : []) || [];
      for (var i = 0; i < a.length; i++) if (a[i].s === sym && +a[i].px > 0) return { price: +a[i].px, chg: null };
      return null;
    }
    function showDet(sym) {
      if (!M.p) return;
      var w = winsOf(sym), pr = priceOf(sym);
      var h = '<button type="button" class="hm-tmd-x" title="Close">×</button><div class="hm-tmd-h"><b>' + sym + '</b>';
      if (pr) h += '<span class="pxv">$' + fpx(pr.price) + '</span>' + (pr.chg != null ? '<span class="chg" style="color:' + (pr.chg >= 0 ? '#2ebd85' : '#ff6258') + '">' + (pr.chg >= 0 ? '+' : '') + (+pr.chg).toFixed(2) + '% 24h</span>' : '');
      h += '</div><div class="hm-tmd-g">';
      [['1h', 'h1'], ['4h', 'h4'], ['12h', 'h12'], ['24h', 'h24']].forEach(function (wd) {
        var x = w[wd[1]];
        h += '<div class="hm-tmd-c"><span class="tw">' + wd[0] + ' rekt</span><b>' + money(x.l + x.s) + '</b><span class="tl">Long ' + money(x.l) + '</span><span class="ts">Short ' + money(x.s) + '</span></div>';
      });
      h += '</div><div class="hm-tmd-cta">';
      if (COINS.indexOf(sym) >= 0) h += '<button type="button" data-map="' + sym + '">View ' + sym + ' on the liquidation map</button>';
      if (sym.indexOf(':') < 0 && sym !== 'Others') h += '<a href="/paper-trade?coin=' + sym + '">Paper trade ' + sym + '</a>';
      h += '</div>';
      det.innerHTML = h; det.style.display = 'block';
      det.querySelector('.hm-tmd-x').addEventListener('click', function () { det.style.display = 'none'; });
      var mb = det.querySelector('[data-map]');
      if (mb) mb.addEventListener('click', function () { if (S && S.setCoin) S.setCoin(sym); });
      det.scrollTop = 0;
    }
    tm.addEventListener('click', function (ev) { var c = ev.target.closest('.hm-tm-c'); if (!c) return; var sym = c.getAttribute('data-sym'); if (!sym || sym === 'Others') return; showDet(sym); });
    exT.addEventListener('click', function (ev) { var hh = ev.target.closest('span[data-k]'); if (!hh) return; var k = hh.getAttribute('data-k'); if (M.exSort.k === k) M.exSort.d = -M.exSort.d; else M.exSort = { k: k, d: -1 }; render(); });
    ctTb.addEventListener('click', function (ev) {
      var hh = ev.target.closest('span[data-ck]');
      if (hh) { var k = hh.getAttribute('data-ck'); if (M.ctSort.k === k) M.ctSort.d = -M.ctSort.d; else M.ctSort = { k: k, d: -1 }; ctRender(); return; }
      var row = ev.target.closest('.hm-ct-r'); if (row) { var sy = row.getAttribute('data-sym'); if (sy) showDet(sy); }
    });
    function ctRender() {
      if (!M.p) return;
      var map = {};
      ['h1', 'h4', 'h12', 'h24'].forEach(function (k) {
        ((M.p[k] || {}).bySym || []).forEach(function (r) {
          var m = map[r.s] || (map[r.s] = { sym: r.s, px: 0, h1l: 0, h1s: 0, h4l: 0, h4s: 0, h12l: 0, h12s: 0, h24l: 0, h24s: 0 });
          m[k + 'l'] = +r.l; m[k + 's'] = +r.sh; if (+r.px > 0) m.px = +r.px;
        });
      });
      var rows = Object.keys(map).map(function (k) { var m = map[k]; m.t24 = m.h24l + m.h24s; return m; });
      if (M.ctQ) rows = rows.filter(function (r) { return r.sym.toUpperCase().indexOf(M.ctQ) >= 0; });
      var sk = M.ctSort.k, sd = M.ctSort.d;
      rows.sort(function (a, b) { return ((a[sk] || 0) - (b[sk] || 0)) * sd; });
      var CK = ['h1l', 'h1s', 'h4l', 'h4s', 'h12l', 'h12s', 'h24l', 'h24s'];
      var mx = {}; CK.forEach(function (c) { mx[c] = 0; rows.forEach(function (r) { if (r[c] > mx[c]) mx[c] = r[c]; }); });
      function tint(c, v) { if (!(v > 0) || !mx[c]) return ''; var a = (0.07 + 0.55 * Math.sqrt(v / mx[c])).toFixed(2); return 'background:rgba(' + (c.charAt(c.length - 1) === 'l' ? '46,189,133' : '255,98,88') + ',' + a + ')'; }
      var arrow = function (k) { return M.ctSort.k === k ? (M.ctSort.d < 0 ? ' ↓' : ' ↑') : ''; };
      var hcell = function (k, lb) { return '<span data-ck="' + k + '"' + (M.ctSort.k === k ? ' class="on"' : '') + '>' + lb + arrow(k) + '</span>'; };
      var h = '<div class="hm-ct-hd"><span>#</span><span>Coin</span><span>Price</span>' +
        hcell('h1l', '1h Long') + hcell('h1s', '1h Short') + hcell('h4l', '4h Long') + hcell('h4s', '4h Short') +
        hcell('h12l', '12h Long') + hcell('h12s', '12h Short') + hcell('h24l', '24h Long') + hcell('h24s', '24h Short') + '</div>';
      ctN.textContent = rows.length + ' coins';
      rows.forEach(function (r, i) {
        var pr = M.px[r.sym], pxs = pr ? '$' + fpx(pr.price) : (r.px > 0 ? '$' + fpx(r.px) : '—');
        var chg = pr && pr.chg != null ? '<i style="color:' + (pr.chg >= 0 ? '#2ebd85' : '#ff6258') + '">' + (pr.chg >= 0 ? '+' : '') + (+pr.chg).toFixed(2) + '%</i>' : '';
        h += '<div class="hm-ct-r" data-sym="' + r.sym + '"><span class="rk2c">' + (i + 1) + '</span><span class="sym">' + r.sym + '</span><span class="pxc">' + pxs + chg + '</span>';
        CK.forEach(function (c) { h += '<span class="hv" style="' + tint(c, r[c]) + '">' + (r[c] > 0 ? money(r[c]) : '$0') + '</span>'; });
        h += '</div>';
      });
      var sc0 = ctTb.scrollTop; ctTb.innerHTML = h; ctTb.scrollTop = sc0;
    }
    function render() {
      if (!M.p) return;
      var th = '';
      [['1h', 'h1'], ['4h', 'h4'], ['12h', 'h12'], ['24h', 'h24']].forEach(function (wd) {
        var t = (M.p[wd[1]] || {}).tot || { n: 0, v: 0, l: 0 };
        th += '<div class="hm-tot"><span class="tw">' + wd[0] + ' rekt</span><b>' + money(t.v) + '</b><span class="tl">Long ' + money(t.l) + '</span><span class="ts">Short ' + money(t.v - t.l) + '</span></div>';
      });
      tots.innerHTML = th;
      var A = M.p[WINH[M.win]] || {}, T = A.tot || { n: 0, v: 0, l: 0 };
      if (T.n && A.big) {
        story.innerHTML = 'Past ' + M.win.toLowerCase() + ': <b>' + (+T.n).toLocaleString('en-US') + '</b> liquidation orders totaling <b>' + money(T.v) + '</b> across our tracked venues. The largest single order hit <b>' + String(A.big.exchange).replace('binance-coin', 'Binance COIN-M').toUpperCase() + '</b> — <b>' + A.big.symbol + '</b> ' + (A.big.side === 'long_liquidated' ? '<span class="tl">LONG</span>' : '<span class="ts">SHORT</span>') + ' worth <b>' + money(A.big.notional) + '</b>.';
      } else story.innerHTML = 'No liquidation orders ≥ $1K captured in this window yet.';
      var items = (A.bySym || []).map(function (r) { return { sym: r.s, v: (+r.l) + (+r.sh), l: +r.l, s: +r.sh }; });
      var top = items.slice(0, 18), rest = items.slice(18);
      if (rest.length) { var rv = 0, rl = 0, rs = 0; rest.forEach(function (r) { rv += r.v; rl += r.l; rs += r.s; }); top.push({ sym: 'Others', v: rv, l: rl, s: rs }); }
      tm.innerHTML = '';
      var W = tm.clientWidth || 620, H = tm.clientHeight || 320;
      layoutTreemap(top, W, H).forEach(function (r) {
        var d = el('div', 'hm-tm-c'); var lsh = r.it.v ? r.it.l / r.it.v : 0.5;
        var dom = Math.abs(lsh - 0.5) * 2; // 0 = balanced flow, 1 = one-sided
        d.style.cssText = 'left:' + r.x.toFixed(1) + 'px;top:' + r.y.toFixed(1) + 'px;width:' + Math.max(0, r.w - 2).toFixed(1) + 'px;height:' + Math.max(0, r.h - 2).toFixed(1) + 'px;cursor:pointer;background:' + (lsh >= 0.5 ? 'rgba(210,68,58,' : 'rgba(32,146,100,') + (0.55 + dom * 0.4).toFixed(2) + ')';
        d.setAttribute('data-sym', r.it.sym);
        if (r.w > 46 && r.h > 26) d.innerHTML = '<b>' + r.it.sym + '</b>' + (r.h > 46 ? '<span>' + money(r.it.v) + '</span>' : '');
        d.title = r.it.sym + ' — ' + money(r.it.v) + ' liquidated in the last ' + M.win.toLowerCase() + ': longs ' + money(r.it.l) + ' · shorts ' + money(r.it.s) + '. Click for details.';
        tm.appendChild(d);
      });
      var exr = (A.byEx || []).map(function (r) { return { ex: r.e, v: (+r.l) + (+r.sh), l: +r.l, s: +r.sh }; });
      exr.sort(function (a, b) { return ((a[M.exSort.k] || 0) - (b[M.exSort.k] || 0)) * M.exSort.d; });
      var earr = function (k) { return M.exSort.k === k ? (M.exSort.d < 0 ? ' ↓' : ' ↑') : ''; };
      var eh = '<div class="hm-ext-h"><span>Exchange</span><span data-k="v"' + (M.exSort.k === 'v' ? ' class="on"' : '') + '>Liquidations' + earr('v') + '</span><span data-k="l"' + (M.exSort.k === 'l' ? ' class="on"' : '') + '>Long' + earr('l') + '</span><span data-k="s"' + (M.exSort.k === 's' ? ' class="on"' : '') + '>Short' + earr('s') + '</span><span>Share</span></div>';
      exr.forEach(function (r) {
        var share = T.v ? r.v / T.v * 100 : 0;
        eh += '<div class="hm-ext-r"><span class="ex">' + r.ex.replace('binance-coin', 'binance COIN-M') + '</span><b>' + money(r.v) + '</b><span class="tl">' + money(r.l) + '</span><span class="ts">' + money(r.s) + '</span><span class="shr"><i style="width:' + Math.min(100, share).toFixed(1) + '%"></i><em>' + share.toFixed(1) + '%</em></span></div>';
      });
      exT.innerHTML = eh;
      ctRender();
    }
    function loadMkt() {
      fetch('/api/v1/pulse').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (!j || !j.h24) return;
        M.p = j; render();
      }).catch(function () {});
    }
    fetch('/api/prices').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !Array.isArray(j.pairs)) return;
      j.pairs.forEach(function (pr) { M.px[String(pr.symbol).replace(/USDT$/, '')] = { price: +pr.price, chg: pr.changePct != null ? +pr.changePct : null }; });
      if (M.p) render();
    }).catch(function () {});
    loadMkt();
    S.timers.push(setInterval(function () { if (!document.hidden) loadMkt(); }, 90000));
    var roT; try { new ResizeObserver(function () { clearTimeout(roT); roT = setTimeout(render, 250); }).observe(tm); } catch (e) {}
  }
  function premiumGate(wrap) {
    var stage = wrap.querySelector('.hm-stage'); if (!stage) return;
    fetch('/api/premium/status', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (j) {
      if (!S || !stage.parentNode) return;
      if (j && j.premium) return; // full access for premium members
      var PREVIEW = 60, left = PREVIEW, signedIn = j && j.signedIn;
      var LOCKKEY = 'mp_hm_lock', COOLDOWN = 12 * 3600 * 1000; // one short preview per 12h; a refresh after it locks stays locked
      function lockNow() { // paint the paywall immediately (no preview)
        if (!S || !stage.parentNode) return;
        if (stage.querySelector('.hm-paywall')) return;
        try { if (!window.__hmGateLogged) { window.__hmGateLogged = 1; window.__mpTrack && window.__mpTrack('premgate', 'Heatmap'); } } catch (e) {} // ops feed: a non-premium visitor hit the heatmap premium wall
        var ov = el('div', 'hm-paywall'); ov.style.cssText = 'position:absolute;inset:0;z-index:9;background:rgba(7,9,12,.9);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;gap:10px;cursor:pointer';
        ov.innerHTML = '<div style="font:700 11px \'Space Mono\',monospace;letter-spacing:.16em;color:#c2f64a">MARGINPAD PREMIUM</div>' +
          '<div style="font:800 22px \'Familjen Grotesk\',system-ui,sans-serif;color:#fff;max-width:440px;line-height:1.22">Unlock the live liquidation heatmap</div>' +
          '<div style="color:#8fa3c4;font-size:13px;max-width:440px;line-height:1.55">See exactly where leveraged positions get wiped — plus 8 exclusive AI indicators, Ask-AI on your charts and more, from <b style="color:#c2f64a">$3.99/mo</b>.</div>' +
          '<span class="hm-pw-btn" style="margin-top:10px;background:linear-gradient(180deg,#c2f64a,#a6e02f);color:#0a0b0d;border-radius:12px;padding:13px 26px;font-size:15px;font-weight:800;box-shadow:0 10px 30px rgba(194,246,74,.24)">See Premium plans</span>';
        stage.appendChild(ov);
        ov.addEventListener('click', function () { location.href = '/premium'; });
      }
      var lockedAt = 0; try { lockedAt = +localStorage.getItem(LOCKKEY) || 0; } catch (e) {}
      if (lockedAt && Date.now() - lockedAt < COOLDOWN) { lockNow(); return; } // already used the preview recently → stay locked across refreshes
      var rib = el('div', 'hm-prevrib'); rib.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:7;background:rgba(10,12,16,.92);border:1px solid #c2f64a55;border-radius:20px;padding:5px 14px;font:11px "Space Mono",monospace;color:#c2f64a;pointer-events:none';
      rib.textContent = 'Premium preview — locks in ' + left + 's'; stage.appendChild(rib);
      var iv = setInterval(function () { left--; if (rib) rib.textContent = 'Premium preview — locks in ' + Math.max(0, left) + 's'; if (left <= 0) { try { clearInterval(iv); } catch (e) {} } }, 1000);
      S.timers.push(iv);
      var t = setTimeout(function () {
        if (!S || !stage.parentNode) return; try { clearInterval(iv); } catch (e) {} if (rib && rib.parentNode) rib.parentNode.removeChild(rib);
        try { localStorage.setItem(LOCKKEY, String(Date.now())); } catch (e) {} // remember the lock so a refresh doesn't grant a fresh preview
        lockNow();
      }, PREVIEW * 1000);
      S.timers.push(t);
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
    var dotsB = el('button', 'hm-btn hm-btnw', 'Dots'); dotsB.type = 'button'; dotsB.title = 'Show/hide real liquidation dots';
    var dl = el('button', 'hm-btn', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>'); dl.type = 'button'; dl.title = 'Download PNG';
    var sh = el('button', 'hm-btn', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>'); sh.type = 'button'; sh.title = 'Share on X';
    var stEl = el('span', 'hm-stats', '');
    var pxEl = el('div', 'hm-px', '…');
    bar.appendChild(selC); bar.appendChild(selW); bar.appendChild(seg); bar.appendChild(dotsB); bar.appendChild(dl); bar.appendChild(sh);
    var mast = el('div', 'hm-mast');
    mast.innerHTML = '<div class="hm-mast-l"><div class="hm-mast-t">LIQUIDATION HEATMAP<span class="hm-live"><i></i>LIVE</span></div><div class="hm-mast-s">Real liquidations from 11 venues, streamed the second they happen \u2014 bright bands show where leveraged positions die next.</div></div><div class="hm-mast-r"></div>';
    var mastR = mast.querySelector('.hm-mast-r'); mastR.appendChild(pxEl); mastR.appendChild(stEl);
    var tgEl = el('div', 'hm-targets'); tgEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;align-items:center;font:11.5px "Space Mono",monospace;color:#8fa3c4;margin:0 0 8px;min-height:18px';
    var stage = el('div', 'hm-stage');
    var cv = el('canvas', 'hm-cv'), pf = el('canvas', 'hm-prof'), tip = el('div', 'hm-tip'), loadEl = el('div', 'hm-load', 'Building liquidation map…');
    var selBox = el('div', 'hm-selbox');
    stage.appendChild(cv); stage.appendChild(pf); stage.appendChild(tip); stage.appendChild(loadEl); stage.appendChild(selBox);
    var foot = el('div', 'hm-foot',
      '<div class="hm-foot-c"><div class="hm-foot-h">HOW TO READ IT</div>Bright bands are crowds of traders whose <span class="l">long</span>/<span class="s">short</span> liquidation prices stack there \u2014 price tends to sweep the brightest ones, and a band disappears the moment price trades through it. Drag to pan (any direction) \u00b7 scroll = zoom time \u00b7 Shift+scroll = zoom price \u00b7 double-click resets.</div>' +
      '<div class="hm-foot-c"><div class="hm-foot-h">DATA</div>Real liquidations streamed live from <b>Binance \u00b7 Bybit \u00b7 OKX \u00b7 Hyperliquid (incl. stock &amp; commodity perps) \u00b7 Gate \u00b7 HTX \u00b7 dYdX \u00b7 BitMEX \u00b7 Bitfinex</b> \u2014 roughly <b>85%+</b> of the market\u2019s liquidation flow. The bands are our own estimate computed from live price action (10\u2013100\u00d7 entries at each close).</div>');
    var legend = el('div', 'hm-legend'); legend.style.cssText = 'order:2;display:flex;flex-wrap:wrap;gap:14px;align-items:center;font:11px "Space Mono",monospace;color:#8fa3c4;margin:-2px 0 8px';
    legend.innerHTML = '<b style="color:#c9d4e6;font-weight:700;letter-spacing:.04em">LEGEND</b><span><b style="color:#e9e7df">●</b> real liquidation</span><span><b style="color:#e9e7df">◇</b> projected zone (swept)</span><span><b style="color:#e9e7df">▬</b> leverage cluster (est.)</span>';
    wrap.appendChild(mast); wrap.appendChild(bar); wrap.appendChild(legend); wrap.appendChild(tgEl); wrap.appendChild(stage); wrap.appendChild(foot);
    section.innerHTML = ''; section.appendChild(wrap);
    section.style.display = '';

    S = { coin: coin, win: '1D', sideF: 'all', tgEl: tgEl, sweeps: [], funding: null, sel: null, selBox: selBox, showDots: (function(){ try { return localStorage.getItem('mp_hm_dots') !== '0'; } catch (e) { return true; } })(), bars: [], pools: { alive: [], pMin: 0, pMax: 1, binH: 0 }, events: [], price: 0, chg: 0, view: null, cv: cv, pf: pf, tip: tip, pxEl: pxEl, stEl: stEl, loadEl: loadEl, timers: [] };
    wire();
    S.setCoin = function (c) { if (COINS.indexOf(c) < 0) return; selC.value = c; selC.dispatchEvent(new Event('change')); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } };
    selC.addEventListener('change', function () { if (!S) return; S.coin = selC.value; S.view = null; S.yView = null; S.sel = null; if (S.showSel) S.showSel(); S.events = []; loadAll(true); try { if (window.mpWS) window.mpWS.sub(S.coin); } catch (e) {} });
    selW.addEventListener('change', function () { if (!S) return; S.win = selW.value; S.view = null; S.yView = null; S.sel = null; if (S.showSel) S.showSel(); loadAll(true); });
    function dotsUi() { dotsB.classList.toggle('on', !!S.showDots); }
    dotsUi();
    dotsB.addEventListener('click', function () { if (!S) return; S.showDots = !S.showDots; try { localStorage.setItem('mp_hm_dots', S.showDots ? '1' : '0'); } catch (e) {} if (!S.showDots && S.sel && S.sel.type === 'ev') { S.sel = null; if (S.showSel) S.showSel(); } dotsUi(); sched(); });
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
      ox.fillText('Real liquidations live from Binance \u00b7 Bybit \u00b7 OKX \u00b7 BitMEX \u00b7 Bitfinex \u2014 bright bands = where liquidations are stacking', 22, H - FOOT / 2);
      return out;
    }
    sh.addEventListener('click', function () { try {
      var txt = '$' + S.coin + ' liquidation heatmap — live from 9 exchanges. Price hunts the bright bands.\nhttps://marginpad.io/heatmap';
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
    S.timers.push(setInterval(function () { loadMyPos(); }, 15000));
    S.timers.push(setInterval(pollEvents, 6000));
    S.timers.push(setInterval(function () { if (S && !document.hidden) loadAll(false); }, 60000));
    S.onVis = function () { if (S && !document.hidden) { loadAll(false); pollEvents(); } };
    document.addEventListener('visibilitychange', S.onVis);
    S.timers.push(setTimeout(function () { try { fetch('/api/auth/heatxp', { method: 'POST' }); } catch (e) {} }, 20000)); // signed-in: +15 XP once/day for actually reading the map
    S.ro = new ResizeObserver(sched); S.ro.observe(cv); S.ro.observe(pf);
    try { buildMkt(wrap); } catch (e) {}
    try { premiumGate(wrap); } catch (e) {}
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
