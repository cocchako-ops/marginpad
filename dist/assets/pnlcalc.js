/* Shared single PnL / ROI calculator for MarginPad programmatic SEO pages. */
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
  var pct = function (n) { return isFinite(n) ? (n >= 0 ? '+' : '') + n.toFixed(2) + '%' : '—'; };
  function calc() {
    var out = $('pnlOut'); if (!out) return;
    var entry = parseFloat($('pnlEntry').value),
        exit = parseFloat($('pnlExit').value),
        qty = parseFloat($('pnlQty').value),
        lev = parseFloat($('pnlLev').value);
    if (!isFinite(entry) || !isFinite(exit) || !isFinite(qty)) { out.textContent = '—'; $('pnlRoi').textContent = '—'; $('pnlRoe').textContent = '—'; return; }
    var pnl = (side === 'long' ? (exit - entry) : (entry - exit)) * qty;
    var roi = (side === 'long' ? (exit - entry) : (entry - exit)) / entry * 100;
    out.textContent = (pnl >= 0 ? '+$' : '−$') + fmt(Math.abs(pnl));
    out.style.color = pnl < 0 ? '#ff6258' : '#2ebd85';
    $('pnlRoi').textContent = pct(roi);
    $('pnlRoe').textContent = (isFinite(lev) && lev > 0) ? pct(roi * lev) : '—';
  }
  var seg = $('pnlSeg');
  if (seg) Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
      b.classList.add('on'); side = b.getAttribute('data-side'); calc();
    });
  });
  ['pnlEntry', 'pnlExit', 'pnlQty', 'pnlLev'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('input', calc); });
  calc();
})();
