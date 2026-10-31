/* The ONE list of strategies. A rule is data: the engine reads it, and emit.js compiles it to Pine and Python, so the three
   cannot drift. `tf` is declared here BEFORE any test and is what the headline shows, so nothing can be promoted to its best
   timeframe afterwards. Parameters are the textbook defaults on purpose: tuning them to this history is how a backtest lies. */
const C = ['close'], H = ['high'], L = ['low'], V = ['vol'];
const E = (p) => ['ema', C, p], S = (p) => ['sma', C, p], R = (p) => ['rsi', C, p], A = (p) => ['atr', p];
const HH = (p) => ['hh', H, p], LL = (p) => ['ll', L, p];
const mul = (a, k) => ['mul', a, k], add = (a, b) => ['add', a, b], sub = (a, b) => ['sub', a, b];
const BU = (p, k) => add(S(p), mul(['std', C, p], k)), BL = (p, k) => sub(S(p), mul(['std', C, p], k));
const KU = (p, k) => add(E(p), mul(A(p), k)), KL = (p, k) => sub(E(p), mul(A(p), k));
const gt = (a, b) => ['gt', a, b], lt = (a, b) => ['lt', a, b], xu = (a, b) => ['xup', a, b], xd = (a, b) => ['xdn', a, b];
const and = (...c) => ['and', ...c], or = (...c) => ['or', ...c];
const Z = (p) => ['div', sub(C, S(p)), ['std', C, p]];
const MACD = ['macd', 12, 26], SIG = ['macdSig', 12, 26, 9];
const ST = (p, m) => ['stDir', p, m];
const IBS = ['div', sub(C, L), sub(H, L)];
const VX = (k) => gt(V, mul(['sma', V, 20], k));

const r = (slug, name, style, tf, summary, def) => ({ slug, name, style, tf, summary, ...def });
const both = (el, es) => ({ entryL: el, entryS: es, reverse: true });

const RULES = [
  // Trend following
  r('ema-9-21-cross', 'EMA 9/21 Cross', 'trend', '4h', 'Long while the 9 EMA is above the 21 EMA.', { entryL: xu(E(9), E(21)), exitL: xd(E(9), E(21)) }),
  r('ema-9-21-long-short', 'EMA 9/21 Long & Short', 'trend', '4h', 'Always in the market, on the side of the 9/21 EMA cross.', both(xu(E(9), E(21)), xd(E(9), E(21)))),
  r('ema-20-50-cross', 'EMA 20/50 Cross', 'trend', '1d', 'A slower cross that sits out more of the chop.', { entryL: xu(E(20), E(50)), exitL: xd(E(20), E(50)) }),
  r('golden-cross', 'Golden Cross', 'trend', '1d', 'Long while the 50 SMA is above the 200 SMA.', { entryL: xu(S(50), S(200)), exitL: xd(S(50), S(200)) }),
  r('sma-20-50-cross', 'SMA 20/50 Cross', 'trend', '1d', 'The classic moving-average cross on simple averages.', { entryL: xu(S(20), S(50)), exitL: xd(S(20), S(50)) }),
  r('price-above-sma-50', 'Price Above SMA 50', 'trend', '1d', 'Long while price closes above the 50-day average.', { entryL: xu(C, S(50)), exitL: xd(C, S(50)) }),
  r('price-above-sma-200', 'Price Above SMA 200', 'trend', '1d', 'The simplest trend filter there is: above the 200-day average or in cash.', { entryL: xu(C, S(200)), exitL: xd(C, S(200)) }),
  r('ema-ribbon', 'EMA Ribbon 8/21/50', 'trend', '4h', 'Long only while three averages are stacked in order.', { entryL: and(gt(E(8), E(21)), gt(E(21), E(50))), exitL: lt(E(8), E(21)) }),
  r('hull-trend', 'Hull Trend', 'trend', '4h', 'Long while the Hull moving average is rising.', { entryL: xu(['hma', C, 21], ['prev', ['hma', C, 21], 1]), exitL: xd(['hma', C, 21], ['prev', ['hma', C, 21], 1]) }),
  r('macd-cross', 'MACD Cross', 'trend', '1d', 'Long from the MACD crossing its signal line until it crosses back.', { entryL: xu(MACD, SIG), exitL: xd(MACD, SIG) }),
  r('macd-zero-line', 'MACD Zero Line', 'trend', '1d', 'Long while MACD is above zero, a slower read of the same idea.', { entryL: xu(MACD, 0), exitL: xd(MACD, 0) }),
  r('supertrend', 'Supertrend 10/3', 'trend', '4h', 'Long while Supertrend is green.', { entryL: gt(ST(10, 3), 0), exitL: lt(ST(10, 3), 0) }),
  r('supertrend-long-short', 'Supertrend Long & Short', 'trend', '4h', 'Always in the market, on the side Supertrend shows.', both(xu(ST(10, 3), 0), xd(ST(10, 3), 0))),
  r('supertrend-slow', 'Supertrend 20/5', 'trend', '1d', 'A wide Supertrend that aims to hold the big moves.', { entryL: gt(ST(20, 5), 0), exitL: lt(ST(20, 5), 0) }),
  r('adx-trend', 'ADX Trend Filter', 'trend', '1d', 'An EMA trend, taken only when ADX says a trend exists.', { entryL: and(gt(E(20), E(50)), gt(['adx', 14], 25)), exitL: lt(E(20), E(50)) }),
  r('di-cross', 'DI Cross', 'trend', '1d', 'Long while +DI leads -DI.', { entryL: xu(['diP', 14], ['diM', 14]), exitL: xd(['diP', 14], ['diM', 14]) }),
  r('momentum-10', 'Momentum 10', 'momentum', '1d', 'Long while price is above where it was ten bars ago.', { entryL: xu(['roc', C, 10], 0), exitL: xd(['roc', C, 10], 0) }),
  r('momentum-90', 'Momentum 90', 'momentum', '1d', 'Absolute momentum: long while the last three months are positive.', { entryL: xu(['roc', C, 90], 0), exitL: xd(['roc', C, 90], 0) }),
  r('trend-and-macd', 'Trend + MACD', 'trend', '1d', 'MACD entries, allowed only above the 200 SMA.', { entryL: and(xu(MACD, SIG), gt(C, S(200))), exitL: or(xd(MACD, SIG), lt(C, S(200))) }),
  r('obv-trend', 'OBV Trend', 'momentum', '1d', 'Long while On-Balance Volume is above its own average.', { vol: true, entryL: xu(['obv'], ['ema', ['obv'], 20]), exitL: xd(['obv'], ['ema', ['obv'], 20]) }),

  // Breakout
  r('donchian-20', 'Donchian Breakout 20', 'breakout', '1d', 'Buy a new 20-bar high, sell a new 10-bar low.', { entryL: gt(C, HH(20)), exitL: lt(C, LL(10)) }),
  r('donchian-55-turtle', 'Donchian 55 (Turtle)', 'breakout', '1d', 'The Turtle system: a 55-day high in, a 20-day low out.', { entryL: gt(C, HH(55)), exitL: lt(C, LL(20)) }),
  r('donchian-long-short', 'Donchian Long & Short', 'breakout', '4h', 'Goes with whichever side breaks a 20-bar range.', both(gt(C, HH(20)), lt(C, LL(20)))),
  r('bollinger-breakout', 'Bollinger Breakout', 'breakout', '1d', 'Buy a close above the upper band, exit at the mid-line.', { entryL: gt(C, BU(20, 2)), exitL: lt(C, S(20)) }),
  r('keltner-breakout', 'Keltner Breakout', 'breakout', '1d', 'Buy a close above the Keltner channel, exit at its mid-line.', { entryL: gt(C, KU(20, 2)), exitL: lt(C, E(20)) }),
  r('volume-breakout', 'Volume Breakout', 'breakout', '4h', 'A 20-bar high on twice the normal volume.', { vol: true, entryL: and(gt(C, HH(20)), VX(2)), exitL: lt(C, E(20)) }),
  r('breakout-3r', 'Breakout With 3R Target', 'breakout', '4h', 'A 20-bar high with a 2 ATR stop and a target three times the risk.', { entryL: gt(C, HH(20)), stop: { atr: 2 }, tp: { r: 3 } }),
  r('breakout-atr-trail', 'Breakout With ATR Trail', 'breakout', '4h', 'A 20-bar high, then a 3 ATR trailing stop rides the move.', { entryL: gt(C, HH(20)), stop: { atr: 3 }, trail: { atr: 3 } }),
  r('squeeze-breakout', 'Squeeze Breakout', 'breakout', '1d', 'Bollinger bands inside Keltner, then the first close above the band.', { entryL: and(gt(C, BU(20, 2)), lt(['prev', BU(20, 2), 1], ['prev', KU(20, 1.5), 1])), exitL: lt(C, E(20)) }),
  r('oco-dip-or-breakout', 'Dip or Breakout', 'breakout', '1d', 'Takes whichever comes first: an RSI dip or a 20-day high.', { entryL: or(xd(R(14), 35), gt(C, HH(20))), stop: { pct: 8 }, tp: { pct: 12 } }),

  // Mean reversion
  r('rsi-30-70', 'RSI Reversion 30/70', 'reversion', '1d', 'Buy RSI under 30, sell over 70.', { entryL: lt(R(14), 30), exitL: gt(R(14), 70) }),
  r('rsi-2', 'RSI-2 Scalp', 'reversion', '1d', 'Buy a two-period RSI under 10, sell over 60.', { entryL: lt(R(2), 10), exitL: gt(R(2), 60) }),
  r('rsi-2-trend-filter', 'RSI-2 With Trend Filter', 'reversion', '1d', 'The same dip, bought only above the 200 SMA.', { entryL: and(lt(R(2), 10), gt(C, S(200))), exitL: gt(R(2), 60) }),
  r('rsi-fade-short', 'RSI Fade Short', 'reversion', '1d', 'Short RSI over 75, cover under 50.', { entryS: gt(R(14), 75), exitS: lt(R(14), 50) }),
  r('stochastic-20-80', 'Stochastic 20/80', 'reversion', '1d', 'Buy the stochastic under 20, sell over 80.', { entryL: lt(['stoch', 14], 20), exitL: gt(['stoch', 14], 80) }),
  r('bollinger-dip', 'Bollinger Dip', 'reversion', '1d', 'Buy a close under the lower band, exit at the mid-line.', { entryL: lt(C, BL(20, 2)), exitL: gt(C, S(20)) }),
  r('bollinger-fade', 'Bollinger Fade Long & Short', 'reversion', '4h', 'Fades both bands back to the mid-line.', { entryL: lt(C, BL(20, 2)), exitL: gt(C, S(20)), entryS: gt(C, BU(20, 2)), exitS: lt(C, S(20)) }),
  r('stretch-below-sma', 'Stretch Below SMA 20', 'reversion', '1d', 'Buy 2% below the 20 SMA, sell back at it.', { entryL: lt(C, mul(S(20), 0.98)), exitL: gt(C, S(20)) }),
  r('cci-reversion', 'CCI Reversion', 'reversion', '1d', 'Buy CCI crossing back above -100, sell over +100.', { entryL: xu(['cci', 20], -100), exitL: gt(['cci', 20], 100) }),
  r('mfi-reversion', 'Money Flow Reversion', 'reversion', '1d', 'Buy the Money Flow Index under 20, sell over 80.', { vol: true, entryL: lt(['mfi', 14], 20), exitL: gt(['mfi', 14], 80) }),
  r('zscore-reversion', 'Z-Score Reversion', 'reversion', '1d', 'Buy two standard deviations under the mean, sell back at it.', { entryL: lt(Z(20), -2), exitL: gt(Z(20), 0) }),
  r('three-down-days', 'Three Down Closes', 'reversion', '1d', 'Buy after three lower closes in a row, hold five bars.', { entryL: and(lt(C, ['prev', C, 1]), lt(['prev', C, 1], ['prev', C, 2]), lt(['prev', C, 2], ['prev', C, 3])), maxBars: 5 }),
  r('ibs-reversion', 'Close Near The Low', 'reversion', '1d', 'Buy a close in the bottom fifth of the bar, in an uptrend.', { entryL: and(lt(IBS, 0.2), gt(C, S(200))), exitL: gt(IBS, 0.8) }),
  r('volume-climax', 'Volume Climax Reversal', 'reversion', '1d', 'Buy a heavy down bar on three times the volume, hold five bars.', { vol: true, entryL: and(lt(C, ['open']), VX(3), lt(R(14), 35)), maxBars: 5 }),
  r('range-rsi-fade', 'Range High Fade', 'reversion', '1h', 'Short a 60-bar high with RSI stretched: 3 ATR stop, 2R target, 48 bars at most.', { entryS: and(gt(['high'], HH(60)), gt(R(14), 70)), stop: { atr: 3 }, tp: { r: 2 }, maxBars: 48 }),

  // Pullback in a trend
  r('pullback-ema-21', 'EMA 21 Pullback', 'pullback', '4h', 'In an uptrend, buy the dip to the 21 EMA: 1.5 ATR stop, 3R target.', { entryL: and(gt(E(21), E(50)), lt(['low'], E(21)), gt(C, E(21))), stop: { atr: 1.5 }, tp: { r: 3 }, maxBars: 48 }),
  r('pullback-rsi', 'RSI Pullback', 'pullback', '1d', 'In an uptrend, buy RSI under 40 and sell over 60.', { entryL: and(gt(C, S(200)), lt(R(14), 40)), exitL: gt(R(14), 60) }),
  r('pullback-sma-200', 'Dip Above SMA 200', 'pullback', '1d', 'A five-period RSI under 30, above the 200 SMA.', { entryL: and(gt(C, S(200)), lt(R(5), 30)), exitL: gt(C, S(5)) }),
  r('pullback-1-percent', 'Trend Pullback 1%', 'pullback', '1d', 'In an uptrend, buy a 1% dip under the 20 EMA.', { entryL: and(gt(E(20), E(50)), lt(C, mul(E(20), 0.99))), exitL: lt(E(20), E(50)), stop: { atr: 3 } }),
  r('short-the-rally', 'Short The Rally', 'pullback', '4h', 'In a downtrend, short the bounce to the 21 EMA: 1.5 ATR stop, 3R target.', { entryS: and(lt(E(21), E(50)), gt(['high'], E(21)), lt(C, E(21))), stop: { atr: 1.5 }, tp: { r: 3 }, maxBars: 48 }),

  // Risk managed
  r('bracket-trend', 'Bracket Trend', 'risk', '1d', 'A trend entry with a fixed +6% target and -3% stop.', { entryL: gt(E(20), E(50)), stop: { pct: 3 }, tp: { pct: 6 } }),
  r('bracket-rsi', 'Bracket RSI', 'risk', '1d', 'An RSI dip with a fixed +4% target and -2% stop.', { entryL: lt(R(14), 30), stop: { pct: 2 }, tp: { pct: 4 } }),
  r('trailing-stop-trend', 'Trailing Stop Trend', 'risk', '1d', 'A 20/50 trend entry; a 3 ATR trail decides the exit.', { entryL: xu(E(20), E(50)), stop: { atr: 3 }, trail: { atr: 3 } }),
  r('protective-stop', 'Protective Stop', 'risk', '1d', 'A 20/50 cross with a 5% hard stop behind it.', { entryL: xu(E(20), E(50)), exitL: xd(E(20), E(50)), stop: { pct: 5 } }),
  r('chandelier-exit', 'Chandelier Exit', 'risk', '1d', 'Above the 200 SMA, held until a 4 ATR trail is hit.', { entryL: xu(C, S(200)), stop: { atr: 4 }, trail: { atr: 4 } }),
  r('time-exit-momentum', 'Time Exit Momentum', 'risk', '1d', 'Buy a 20-bar high and simply leave after ten bars.', { entryL: gt(C, HH(20)), maxBars: 10 }),
  r('atr-stop-reversal', 'ATR Stop Long & Short', 'risk', '4h', 'Trend flips with a 2 ATR stop on every position.', { ...both(xu(E(20), E(50)), xd(E(20), E(50))), stop: { atr: 2 } }),

  // Calendar
  r('monday-effect', 'Sunday Close To Monday', 'calendar', '1d', 'Hold one day from the Sunday close. A test of a well-known crypto folk rule.', { only: ['crypto'], entryL: ['and', ['gt', ['dow'], -1], ['lt', ['dow'], 1]], maxBars: 1 }),
  r('weekend-hold', 'Friday To Monday', 'calendar', '1d', 'Hold over the weekend only. Nothing but the calendar decides.', { only: ['crypto'], entryL: ['and', ['gt', ['dow'], 4], ['lt', ['dow'], 6]], maxBars: 3 }),

  // Found by our own simulations, 2026-10-29
  r('edge-fade-short', 'Hourly Edge Fade', 'reversion', '1h', 'Short a 60-bar high at market: 3 ATR stop, 2R target. The most stable row of our October study.', { only: ['crypto'], entryS: gt(['high'], HH(60)), stop: { atr: 3 }, tp: { r: 2 }, maxBars: 48 }),
].map((x, i) => ({ id: 'S' + String(i + 1).padStart(2, '0'), ...x }));

const STYLES = { trend: 'Trend following', momentum: 'Momentum', breakout: 'Breakout', reversion: 'Mean reversion', pullback: 'Pullback', risk: 'Risk managed', calendar: 'Calendar' };
module.exports = { RULES, STYLES };
