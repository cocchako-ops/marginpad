'use strict';
var API = 'https://marginpad.io';
var COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE'];
var state = { coin: 'BTC' };
var $ = function (id) { return document.getElementById(id); };

function fmtPx(n) { n = +n; if (!isFinite(n)) return '—'; if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 }); if (n >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }); return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 8 }); }
function fmtM(n) { n = +n || 0; var a = Math.abs(n); if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'; if (a >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'; return '$' + n.toFixed(0); }
function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, function (m) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]; }); }
// intensity 0..1 -> cyan -> lime -> amber -> red
function heatColor(t) {
  t = Math.max(0, Math.min(1, t));
  var stops = [[70, 224, 230], [194, 246, 74], [255, 179, 71], [255, 98, 88]];
  var seg = t * 3, i = Math.min(2, Math.floor(seg)), f = seg - i, a = stops[i], b = stops[i + 1];
  return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ',' + Math.round(a[1] + (b[1] - a[1]) * f) + ',' + Math.round(a[2] + (b[2] - a[2]) * f) + ')';
}

function renderCoins() {
  var c = $('coins'); c.innerHTML = '';
  COINS.forEach(function (sym) {
    var b = document.createElement('button');
    b.className = 'coin' + (sym === state.coin ? ' on' : ''); b.textContent = sym;
    b.addEventListener('click', function () { if (state.coin === sym) return; state.coin = sym; renderCoins(); $('heat').innerHTML = '<div class="skel">Loading heatmap…</div>'; load(); });
    c.appendChild(b);
  });
}

function renderHeat(d) {
  var el = $('heat'), alive = (d && d.alive) || [], price = +d.price || 0;
  if (!alive.length || !price) { el.innerHTML = '<div class="heat-empty">No heatmap data right now.</div>'; $('legend').hidden = true; return; }
  var lo = price * 0.82, hi = price * 1.18, N = 16, binSize = (hi - lo) / N;
  var bins = []; for (var i = 0; i < N; i++) bins.push({ lo: lo + i * binSize, hi: lo + (i + 1) * binSize, w: 0 });
  alive.forEach(function (p) { var pr = +p.p; if (pr < lo || pr >= hi) return; var idx = Math.floor((pr - lo) / binSize); if (idx < 0 || idx >= N) return; bins[idx].w += (+p.w || 0); });
  var maxW = Math.max.apply(null, bins.map(function (b) { return b.w; })) || 1;
  if (maxW <= 0) { el.innerHTML = '<div class="heat-empty">No clusters near the current price.</div>'; $('legend').hidden = true; return; }
  var rows = '', placed = false;
  for (var j = N - 1; j >= 0; j--) {
    var b = bins[j], mid = (b.lo + b.hi) / 2;
    if (!placed && price >= b.lo && price < b.hi) { rows += '<div class="hnow"><span class="lab">' + fmtPx(price) + '</span></div>'; placed = true; }
    var t = b.w > 0 ? b.w / maxW : 0;
    var wpct = b.w > 0 ? Math.max(4, Math.round(Math.sqrt(t) * 100)) : 0; // sqrt so small clusters still read
    var col = heatColor(t);
    rows += '<div class="hrow"><span class="hp">' + fmtPx(mid) + '</span><span class="hbarwrap"><span class="hbar" style="width:' + wpct + '%;background:' + col + ';box-shadow:0 0 ' + (t > 0.5 ? 8 : 3) + 'px ' + col + '44"></span></span><span class="hw">' + (b.w > 0 ? fmtM(b.w) : '') + '</span></div>';
  }
  if (!placed) rows = '<div class="hnow"><span class="lab">' + fmtPx(price) + '</span></div>' + rows;
  el.innerHTML = rows; $('legend').hidden = false;
}

function render24(pulse) {
  var l = (pulse && pulse.liq24h) || null;
  if (!l || !(+l.total > 0)) { $('l24Tot').textContent = '—'; $('l24Cap').textContent = ''; $('l24Bar').innerHTML = ''; return; }
  $('l24Tot').textContent = fmtM(l.total);
  var lng = +l.long || 0, sht = +l.short || 0, tot = lng + sht || 1;
  var lp = Math.round(lng / tot * 100), sp = 100 - lp;
  $('l24Cap').textContent = 'liquidated';
  $('l24Bar').innerHTML = '<div class="ls-l" style="flex:' + Math.max(lng, 1) + '">L ' + lp + '%</div><div class="ls-s" style="flex:' + Math.max(sht, 1) + '">' + sp + '% S</div>';
}

function renderRekt(pulse) {
  var top = (pulse && pulse.topLiq) || [];
  if (!top.length) { $('rekt').innerHTML = '<div class="skel">—</div>'; return; }
  top = top.slice(0, 6);
  var max = Math.max.apply(null, top.map(function (x) { return +x.liq || 0; })) || 1;
  $('rekt').innerHTML = top.map(function (x) { var w = Math.round((+x.liq || 0) / max * 100); return '<div class="rk-row"><span class="rk-sym">' + esc(x.s) + '</span><span class="rk-bar"><i style="width:' + w + '%"></i></span><span class="rk-amt">' + fmtM(x.liq) + '</span></div>'; }).join('');
}

function setUpd() { var d = new Date(); $('pxUpd').textContent = 'upd ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

function load() {
  var sym = state.coin;
  var cta = $('ctaLink'); if (cta) cta.href = API + '/heatmap?coin=' + sym;
  var sl = $('siteLink'); if (sl) sl.href = API + '/heatmap';
  Promise.all([
    fetch(API + '/api/heatmap/pools?symbol=' + sym).then(function (r) { return r.json(); }).catch(function () { return null; }),
    fetch(API + '/api/cg/pulse').then(function (r) { return r.json(); }).catch(function () { return null; })
  ]).then(function (res) {
    var pools = res[0], pulse = res[1];
    if (pools && pools.price) $('pxVal').textContent = fmtPx(pools.price);
    renderHeat(pools || {});
    render24(pulse);
    renderRekt(pulse);
    setUpd();
  }).catch(function () {});
}

renderCoins();
load();
setInterval(load, 45000);
