/* Shared single liquidation calculator for MarginPad programmatic SEO pages. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var side = 'long';
  var fmt = function (n) {
    return isFinite(n)
      ? (Math.abs(n) >= 1 ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }))
      : '-';
  };
  function calc() {
    var out = $('liqOut'); if (!out) return;
    var entry = parseFloat($('liqEntry').value),
        lev = parseFloat($('liqLev').value),
        mmr = parseFloat($('liqMmr').value) / 100;
    if (!isFinite(entry) || !isFinite(lev) || lev <= 0 || !isFinite(mmr)) { out.textContent = '-'; $('liqDist').textContent = '-'; return; }
    // THE CLAMP IS WHAT KEEPS A LIQUIDATION BELOW THE ENTRY (added 2026-10-09). The exchange formula on its
    // own is `entry * (1 - 1/lev + mmr)`, and above 1/(2*mmr) leverage the maintenance term overtakes the
    // initial margin: measured on these pages with the default 0.5%, a 200x long printed a liquidation at
    // EXACTLY the entry price and a 1000x long printed one 0.400% ABOVE it. Hyperliquid's own rule -
    // mmr_eff = min(mmr, im/2) - is what the engine, mpLiqPx and mpcLiq have used since 2026-09-25; this is
    // the documented mirror of it, so all 76 calculators agree with the terminal at every leverage.
    var im = Math.max(1e-6, 1 / lev), me = Math.min(Math.max(0, mmr), im / 2);
    var liq = side === 'long' ? entry * (1 - im + me) : entry * (1 + im - me);
    var dist = (liq - entry) / entry * 100;
    out.textContent = '$' + fmt(liq);
    $('liqDist').textContent = (dist >= 0 ? '+' : '') + dist.toFixed(2) + '% (' + Math.abs(dist).toFixed(2) + '% ' + (side === 'long' ? 'down' : 'up') + ')';
  }
  var seg = $('liqSeg');
  if (seg) Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
      b.classList.add('on'); side = b.getAttribute('data-side'); calc();
    });
  });
  ['liqEntry', 'liqLev', 'liqMmr'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('input', calc); });
  calc();
})();
