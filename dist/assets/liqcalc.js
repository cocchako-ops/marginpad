/* Shared single liquidation calculator for MarginPad programmatic SEO pages. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var side = 'long';
  var fmt = function (n) {
    return isFinite(n)
      ? (Math.abs(n) >= 1 ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }))
      : '—';
  };
  function calc() {
    var out = $('liqOut'); if (!out) return;
    var entry = parseFloat($('liqEntry').value),
        lev = parseFloat($('liqLev').value),
        mmr = parseFloat($('liqMmr').value) / 100;
    if (!isFinite(entry) || !isFinite(lev) || lev <= 0 || !isFinite(mmr)) { out.textContent = '—'; $('liqDist').textContent = '—'; return; }
    var liq = side === 'long' ? entry * (1 - 1 / lev + mmr) : entry * (1 + 1 / lev - mmr);
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
