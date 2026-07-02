(function () {
  var num = function (id) { var e = document.getElementById(id); var v = e ? parseFloat(e.value) : NaN; return isFinite(v) ? v : NaN; };
  var money = function (x) { return (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var side = 'long';
  function calc() {
    var notional = num('ffNotional'), rate = num('ffRate'), periods = num('ffPeriods');
    var out = document.getElementById('ffOut'), per = document.getElementById('ffPer'), note = document.getElementById('ffNote');
    if (!isFinite(notional) || !isFinite(rate)) { if (out) out.textContent = '—'; if (per) per.textContent = '—'; if (note) note.textContent = '—'; return; }
    if (!isFinite(periods) || periods < 0) periods = 1;
    // a positive funding rate: longs pay shorts. Sign flips for shorts.
    var dir = side === 'long' ? 1 : -1;
    var perPeriod = notional * (rate / 100) * dir;
    var total = perPeriod * periods;
    if (out) out.textContent = money(-total); // shown as what you pay (negative) / receive (positive)
    if (per) per.textContent = money(-perPeriod);
    if (note) note.textContent = total > 0 ? 'You pay funding' : (total < 0 ? 'You receive funding' : 'Neutral');
  }
  var seg = document.getElementById('ffSeg');
  if (seg) seg.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () { seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); side = b.getAttribute('data-side'); calc(); });
  });
  ['ffNotional', 'ffRate', 'ffPeriods'].forEach(function (id) { var e = document.getElementById(id); if (e) e.addEventListener('input', calc); });
  calc();
})();
