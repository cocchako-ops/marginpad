
/* Spanish for this file. Inline, not the lazy i18n pack: a string that fires before a pack
   arrives would be English, which is the partial translation this exists to end. A top-level function
   declaration so every IIFE in the file can see it (see the mp-nav cookie-bar incident, 2026-09-19). */
var __esD_fundingcalc = {"youPayFunding":"Pagas funding","youReceiveFunding":"Recibes funding"};
function __esT_fundingcalc(k, en) { try { if ((document.documentElement.lang || "").slice(0, 2).toLowerCase() === "es" && __esD_fundingcalc[k] != null) return __esD_fundingcalc[k]; } catch (e) {} return en; }
(function () {
  var num = function (id) { var e = document.getElementById(id); var v = e ? parseFloat(e.value) : NaN; return isFinite(v) ? v : NaN; };
  var money = function (x) { return (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var side = 'long';
  function calc() {
    var notional = num('ffNotional'), rate = num('ffRate'), periods = num('ffPeriods');
    var out = document.getElementById('ffOut'), per = document.getElementById('ffPer'), note = document.getElementById('ffNote');
    if (!isFinite(notional) || !isFinite(rate)) { if (out) out.textContent = '-'; if (per) per.textContent = '-'; if (note) note.textContent = '-'; return; }
    if (!isFinite(periods) || periods < 0) periods = 1;
    // a positive funding rate: longs pay shorts. Sign flips for shorts.
    var dir = side === 'long' ? 1 : -1;
    var perPeriod = notional * (rate / 100) * dir;
    var total = perPeriod * periods;
    if (out) out.textContent = money(-total); // shown as what you pay (negative) / receive (positive)
    if (per) per.textContent = money(-perPeriod);
    if (note) note.textContent = total > 0 ? __esT_fundingcalc("youPayFunding",'You pay funding') : (total < 0 ? __esT_fundingcalc("youReceiveFunding",'You receive funding') : 'Neutral');
  }
  var seg = document.getElementById('ffSeg');
  if (seg) seg.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () { seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); side = b.getAttribute('data-side'); calc(); });
  });
  ['ffNotional', 'ffRate', 'ffPeriods'].forEach(function (id) { var e = document.getElementById(id); if (e) e.addEventListener('input', calc); });
  calc();
})();
