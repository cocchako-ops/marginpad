/* The strategy engine. ONE file on purpose: the build runs it over the whole history and the "Test it" lab runs the same
   bytes in the reader's browser, so a figure on a card and a figure in the lab cannot come from two implementations.

   A rule is data, not code (build/strategies/rules.js), because the same rule must also compile to Pine and Python.
   Indicators follow Pine's definitions (RMA for RSI/ATR, SMA-seeded EMA), so an exported script reads the same bars.

   Fill rules, all deliberately unflattering:
   - a signal is read on a CLOSED bar and fills at the NEXT bar's open, plus slippage against the trade
   - a stop that gaps fills at the open, not at the stop
   - when one bar touches both stop and target, the stop counted first
   - fee on both sides of notional; crypto also pays or earns the real funding print
   - one position, 100% of equity, no leverage */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.mpStrat = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var F = typeof Float64Array !== 'undefined' ? Float64Array : Array;
  function nan(n) { var a = new F(n); for (var i = 0; i < n; i++) a[i] = NaN; return a; }

  function sma(s, p) {
    var n = s.length, o = nan(n), sum = 0, c = 0;
    for (var i = 0; i < n; i++) {
      var v = s[i]; if (isNaN(v)) { sum = 0; c = 0; continue; }
      sum += v; c++;
      if (c > p) { sum -= s[i - p]; c--; }
      if (c === p) o[i] = sum / p;
    }
    return o;
  }
  function seeded(s, p, k) { // ema (k = 2/(p+1)) and rma (k = 1/p) share everything but k
    var n = s.length, o = nan(n), prev = NaN, sum = 0, c = 0;
    for (var i = 0; i < n; i++) {
      var v = s[i]; if (isNaN(v)) continue;
      if (isNaN(prev)) { sum += v; c++; if (c === p) { prev = sum / p; o[i] = prev; } continue; }
      prev = v * k + prev * (1 - k); o[i] = prev;
    }
    return o;
  }
  function ema(s, p) { return seeded(s, p, 2 / (p + 1)); }
  function rma(s, p) { return seeded(s, p, 1 / p); }
  function wma(s, p) {
    var n = s.length, o = nan(n), d = p * (p + 1) / 2;
    for (var i = p - 1; i < n; i++) {
      var t = 0, ok = true;
      for (var j = 0; j < p; j++) { var v = s[i - j]; if (isNaN(v)) { ok = false; break; } t += v * (p - j); }
      if (ok) o[i] = t / d;
    }
    return o;
  }
  function hma(s, p) {
    var a = wma(s, Math.floor(p / 2)), b = wma(s, p), n = s.length, d = nan(n);
    for (var i = 0; i < n; i++) d[i] = 2 * a[i] - b[i];
    return wma(d, Math.floor(Math.sqrt(p)));
  }
  function std(s, p) {
    var n = s.length, o = nan(n), m = sma(s, p);
    for (var i = p - 1; i < n; i++) {
      if (isNaN(m[i])) continue;
      var t = 0; for (var j = 0; j < p; j++) { var d = s[i - j] - m[i]; t += d * d; }
      o[i] = Math.sqrt(t / p);
    }
    return o;
  }
  function rsi(s, p) {
    var n = s.length, up = nan(n), dn = nan(n);
    for (var i = 1; i < n; i++) { var c = s[i] - s[i - 1]; if (!isNaN(c)) { up[i] = c > 0 ? c : 0; dn[i] = c < 0 ? -c : 0; } }
    var u = rma(up, p), d = rma(dn, p), o = nan(n);
    for (i = 0; i < n; i++) if (!isNaN(u[i])) o[i] = d[i] === 0 ? 100 : u[i] === 0 ? 0 : 100 - 100 / (1 + u[i] / d[i]);
    return o;
  }
  function trueRange(b) {
    var n = b.c.length, o = nan(n);
    for (var i = 1; i < n; i++) o[i] = Math.max(b.h[i] - b.l[i], Math.abs(b.h[i] - b.c[i - 1]), Math.abs(b.l[i] - b.c[i - 1]));
    return o;
  }
  function highest(s, p, skip) { // highest of the p bars ending `skip` bars back
    var n = s.length, o = nan(n);
    for (var i = p - 1 + skip; i < n; i++) {
      var m = -Infinity; for (var j = 0; j < p; j++) { var v = s[i - skip - j]; if (v > m) m = v; }
      o[i] = m;
    }
    return o;
  }
  function lowest(s, p, skip) {
    var n = s.length, o = nan(n);
    for (var i = p - 1 + skip; i < n; i++) {
      var m = Infinity; for (var j = 0; j < p; j++) { var v = s[i - skip - j]; if (v < m) m = v; }
      o[i] = m;
    }
    return o;
  }
  function dmi(b, p) {
    var n = b.c.length, pl = nan(n), mi = nan(n);
    for (var i = 1; i < n; i++) {
      var u = b.h[i] - b.h[i - 1], d = b.l[i - 1] - b.l[i];
      pl[i] = u > d && u > 0 ? u : 0; mi[i] = d > u && d > 0 ? d : 0;
    }
    var tr = rma(trueRange(b), p), sp = rma(pl, p), sm = rma(mi, p), dp = nan(n), dm = nan(n), dx = nan(n);
    for (i = 0; i < n; i++) {
      if (isNaN(tr[i]) || tr[i] === 0) continue;
      dp[i] = 100 * sp[i] / tr[i]; dm[i] = 100 * sm[i] / tr[i];
      var t = dp[i] + dm[i]; dx[i] = t === 0 ? 0 : 100 * Math.abs(dp[i] - dm[i]) / t;
    }
    return { plus: dp, minus: dm, adx: rma(dx, p) };
  }
  function superDir(b, p, m) { // +1 uptrend, -1 downtrend
    var n = b.c.length, a = rma(trueRange(b), p), o = nan(n), up = NaN, lo = NaN, dir = 1;
    for (var i = 0; i < n; i++) {
      if (isNaN(a[i])) continue;
      var mid = (b.h[i] + b.l[i]) / 2, u = mid + m * a[i], l = mid - m * a[i];
      if (!isNaN(up)) { u = (u < up || b.c[i - 1] > up) ? u : up; l = (l > lo || b.c[i - 1] < lo) ? l : lo; }
      if (!isNaN(up)) { if (dir === -1 && b.c[i] > up) dir = 1; else if (dir === 1 && b.c[i] < lo) dir = -1; }
      up = u; lo = l; o[i] = dir;
    }
    return o;
  }

  /* A series is an array: ['ema',['close'],21]. Every result is cached per bar set, so sixty rules sharing an EMA pay once. */
  function series(x, b) {
    if (typeof x === 'number') return series(['num', x], b);
    var key = JSON.stringify(x); if (b._c[key]) return b._c[key];
    var k = x[0], n = b.c.length, o, i, S = function (e) { return series(e, b); };
    switch (k) {
      case 'close': o = b.c; break;
      case 'open': o = b.o; break;
      case 'high': o = b.h; break;
      case 'low': o = b.l; break;
      case 'vol': o = b.v; break;
      case 'hl2': o = nan(n); for (i = 0; i < n; i++) o[i] = (b.h[i] + b.l[i]) / 2; break;
      case 'num': o = new F(n); for (i = 0; i < n; i++) o[i] = x[1]; break;
      case 'ema': o = ema(S(x[1]), x[2]); break;
      case 'sma': o = sma(S(x[1]), x[2]); break;
      case 'wma': o = wma(S(x[1]), x[2]); break;
      case 'hma': o = hma(S(x[1]), x[2]); break;
      case 'rsi': o = rsi(S(x[1]), x[2]); break;
      case 'std': o = std(S(x[1]), x[2]); break;
      case 'atr': o = rma(trueRange(b), x[1]); break;
      case 'roc': { var s = S(x[1]); o = nan(n); for (i = x[2]; i < n; i++) o[i] = 100 * (s[i] / s[i - x[2]] - 1); break; }
      case 'hh': o = highest(S(x[1]), x[2], 1); break;
      case 'll': o = lowest(S(x[1]), x[2], 1); break;
      case 'stoch': {
        var hh = highest(b.h, x[1], 0), ll = lowest(b.l, x[1], 0); o = nan(n);
        for (i = 0; i < n; i++) { var r = hh[i] - ll[i]; if (!isNaN(r)) o[i] = r === 0 ? 50 : 100 * (b.c[i] - ll[i]) / r; }
        break;
      }
      case 'cci': {
        var tp = nan(n); for (i = 0; i < n; i++) tp[i] = (b.h[i] + b.l[i] + b.c[i]) / 3;
        var m = sma(tp, x[1]), p = x[1]; o = nan(n);
        for (i = p - 1; i < n; i++) {
          var d = 0; for (var j = 0; j < p; j++) d += Math.abs(tp[i - j] - m[i]);
          d /= p; o[i] = d === 0 ? 0 : (tp[i] - m[i]) / (0.015 * d);
        }
        break;
      }
      case 'mfi': {
        var pos = new F(n), neg = new F(n), q = x[1], tq = nan(n); o = nan(n);
        for (i = 0; i < n; i++) tq[i] = (b.h[i] + b.l[i] + b.c[i]) / 3;
        for (i = 1; i < n; i++) { var f = tq[i] * b.v[i]; if (tq[i] > tq[i - 1]) pos[i] = f; else if (tq[i] < tq[i - 1]) neg[i] = f; }
        for (i = q; i < n; i++) {
          var up = 0, dn = 0; for (j = 0; j < q; j++) { up += pos[i - j]; dn += neg[i - j]; }
          o[i] = dn === 0 ? 100 : 100 - 100 / (1 + up / dn);
        }
        break;
      }
      case 'obv': o = new F(n); for (i = 1; i < n; i++) o[i] = o[i - 1] + (b.c[i] > b.c[i - 1] ? b.v[i] : b.c[i] < b.c[i - 1] ? -b.v[i] : 0); break;
      case 'adx': o = dmi(b, x[1]).adx; break;
      case 'diP': o = dmi(b, x[1]).plus; break;
      case 'diM': o = dmi(b, x[1]).minus; break;
      case 'stDir': o = superDir(b, x[1], x[2]); break;
      case 'macd': { var a1 = ema(b.c, x[1]), a2 = ema(b.c, x[2]); o = nan(n); for (i = 0; i < n; i++) o[i] = a1[i] - a2[i]; break; }
      case 'macdSig': o = ema(series(['macd', x[1], x[2]], b), x[3]); break;
      case 'add': case 'sub': case 'mul': case 'div': {
        var A = S(x[1]), B = S(x[2]); o = nan(n);
        for (i = 0; i < n; i++) o[i] = k === 'add' ? A[i] + B[i] : k === 'sub' ? A[i] - B[i] : k === 'mul' ? A[i] * B[i] : A[i] / B[i];
        break;
      }
      case 'prev': { var P = S(x[1]); o = nan(n); for (i = x[2]; i < n; i++) o[i] = P[i - x[2]]; break; }
      case 'ext': o = (b.x && b.x[x[1]]) || nan(n); break; // our own data, aligned to the bars by the caller
      case 'dow': o = new F(n); for (i = 0; i < n; i++) o[i] = new Date(b.t[i]).getUTCDay(); break;
      default: throw new Error('unknown series ' + k);
    }
    b._c[key] = o; return o;
  }

  function cond(x, b) { // returns a function of the bar index, so a closed bar is all it can ever read
    var k = x[0];
    if (k === 'and' || k === 'or') {
      var cs = x.slice(1).map(function (c) { return cond(c, b); });
      return k === 'and'
        ? function (i) { for (var j = 0; j < cs.length; j++) if (!cs[j](i)) return false; return true; }
        : function (i) { for (var j = 0; j < cs.length; j++) if (cs[j](i)) return true; return false; };
    }
    if (k === 'not') { var c = cond(x[1], b); return function (i) { return !c(i); }; }
    var A = series(x[1], b), B = series(x[2], b);
    if (k === 'gt') return function (i) { return A[i] > B[i]; };
    if (k === 'lt') return function (i) { return A[i] < B[i]; };
    if (k === 'xup') return function (i) { return i > 0 && A[i] > B[i] && A[i - 1] <= B[i - 1]; };
    if (k === 'xdn') return function (i) { return i > 0 && A[i] < B[i] && A[i - 1] >= B[i - 1]; };
    throw new Error('unknown condition ' + k);
  }

  function bars(raw) { return { t: raw.t, o: raw.o, h: raw.h, l: raw.l, c: raw.c, v: raw.v, x: raw.x, _c: {} }; }

  /* cost = {fee, slip} in percent per side. funding = {t:[ms], r:[rate]} or null. */
  function run(rule, b, cost, funding) {
    var n = b.c.length, fee = cost.fee / 100, slip = cost.slip / 100, atrP = 14;
    var eL = rule.entryL ? cond(rule.entryL, b) : null, eS = rule.entryS ? cond(rule.entryS, b) : null;
    var xL = rule.exitL ? cond(rule.exitL, b) : null, xS = rule.exitS ? cond(rule.exitS, b) : null;
    var atr = series(['atr', atrP], b);
    var eq = 1, dir = 0, ent = 0, base = 1, stop = NaN, tp = NaN, entI = -1, peak = 0, curEq = 1;
    var pending = 0, ft = 0, trades = [], equity = new F(n);
    var fT = funding ? funding.t : null, fR = funding ? funding.r : null;
    var open = function (d, px, i) {
      dir = d; ent = px * (1 + d * slip); base = eq * (1 - fee); entI = i; peak = px;
      var a = atr[i - 1];
      stop = NaN; tp = NaN;
      if (rule.stop) stop = rule.stop.atr ? ent - d * rule.stop.atr * a : ent * (1 - d * rule.stop.pct / 100);
      if (rule.tp) {
        var risk = isNaN(stop) ? NaN : Math.abs(ent - stop);
        tp = rule.tp.r ? ent + d * rule.tp.r * risk : rule.tp.atr ? ent + d * rule.tp.atr * a : ent * (1 + d * rule.tp.pct / 100);
      }
    };
    var close = function (px, i, why, noSlip) {
      var fill = noSlip ? px : px * (1 - dir * slip);
      var val = Math.max(0, base * (1 + dir * (fill / ent - 1))) * (1 - fee);
      trades.push({ et: b.t[entI], xt: b.t[i], d: dir, ep: ent, xp: fill, r: val / (trades.eq0 || eq) - 1, n: i - entI, why: why });
      eq = val; dir = 0;
    };
    for (var i = 1; i < n; i++) {
      if (pending) {
        var act = pending; pending = 0;
        if (act === 2 && dir) close(b.o[i], i, 'signal');
        else if (act !== 2) {
          if (dir && dir !== act) close(b.o[i], i, 'reverse');
          if (!dir && !isNaN(atr[i - 1])) { trades.eq0 = eq; open(act, b.o[i], i); }
        }
      }
      if (dir) {
        if (fT) {
          while (ft < fT.length && fT[ft] <= b.t[i - 1]) ft++;
          while (ft < fT.length && fT[ft] <= b.t[i]) { // funding is charged on the position's value at that print
            base -= dir * fR[ft] * Math.max(0, base * (1 + dir * (b.c[i] / ent - 1))); ft++;
          }
        }
        if (rule.trail) { // a trail moves on closes only, so this bar is judged against the stop set by the last one
          var tr = rule.trail.atr * atr[i - 1];
          var w = dir > 0 ? b.c[i - 1] - tr : b.c[i - 1] + tr;
          if (i - 1 >= entI && !isNaN(w) && (isNaN(stop) || (dir > 0 ? w > stop : w < stop))) stop = w;
        }
        var hitS = !isNaN(stop) && (dir > 0 ? b.l[i] <= stop : b.h[i] >= stop);
        var hitT = !isNaN(tp) && (dir > 0 ? b.h[i] >= tp : b.l[i] <= tp);
        if (hitS) close(dir > 0 ? Math.min(b.o[i], stop) : Math.max(b.o[i], stop), i, 'stop');
        else if (hitT) close(dir > 0 ? Math.max(b.o[i], tp) : Math.min(b.o[i], tp), i, 'target', true);
      }
      curEq = dir ? Math.max(0, base * (1 + dir * (b.c[i] / ent - 1))) : eq;
      equity[i] = curEq;
      if (i === n - 1) break;
      if (dir && rule.maxBars && i - entI + 1 >= rule.maxBars) { pending = 2; continue; }
      if (dir > 0 && (xL && xL(i))) pending = 2;
      if (dir < 0 && (xS && xS(i))) pending = 2;
      if (dir >= 0 && eS && eS(i)) { if (!(dir > 0 && !rule.reverse)) pending = -1; }
      if (dir <= 0 && eL && eL(i)) { if (!(dir < 0 && !rule.reverse)) pending = 1; }
    }
    equity[0] = 1;
    return { equity: equity, trades: trades, open: dir };
  }

  /* To one return per UTC day, so a 1h rule and a 1d rule are measured on the same clock. */
  function daily(t, equity) {
    var days = [], rets = [], last = NaN, prev = 1;
    for (var i = 0; i < t.length; i++) {
      var d = Math.floor(t[i] / 86400000);
      if (d !== last && !isNaN(last)) { rets.push(equity[i - 1] / prev - 1); days.push(last); prev = equity[i - 1]; }
      last = d;
    }
    rets.push(equity[t.length - 1] / prev - 1); days.push(last);
    return { days: days, rets: rets };
  }

  function metrics(rets, year) {
    var n = rets.length, eq = 1, peak = 1, mdd = 0, s = 0, s2 = 0, dn = 0;
    for (var i = 0; i < n; i++) {
      var r = rets[i]; eq *= 1 + r; if (eq > peak) peak = eq;
      var dd = eq / peak - 1; if (dd < mdd) mdd = dd;
      s += r; s2 += r * r; if (r < 0) dn += r * r;
    }
    var mean = s / n, vol = Math.sqrt(Math.max(0, s2 / n - mean * mean)), yrs = n / year;
    var cagr = eq > 0 ? Math.pow(eq, 1 / yrs) - 1 : -1, dv = Math.sqrt(dn / n);
    return {
      ret: (eq - 1) * 100, cagr: cagr * 100, mdd: mdd * 100, vol: vol * Math.sqrt(year) * 100,
      sharpe: vol > 0 ? mean / vol * Math.sqrt(year) : 0,
      sortino: dv > 0 ? mean / dv * Math.sqrt(year) : 0,
      calmar: mdd < 0 ? cagr / -mdd : 0, years: yrs,
    };
  }
  function tradeStats(tr) {
    var w = 0, gp = 0, gl = 0, bars = 0;
    for (var i = 0; i < tr.length; i++) { var r = tr[i].r; if (r > 0) { w++; gp += r; } else gl -= r; bars += tr[i].n; }
    return { trades: tr.length, win: tr.length ? 100 * w / tr.length : 0, pf: gl > 0 ? gp / gl : null, hold: tr.length ? bars / tr.length : 0 };
  }
  return { bars: bars, run: run, daily: daily, metrics: metrics, tradeStats: tradeStats, series: series };
});
