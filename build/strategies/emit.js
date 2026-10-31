/* Compiles a rule (rules.js) to Pine v6 and to Python, and writes it out in plain English. Same tree, three readers.
   Pine fills on the next bar's open by default, which is the engine's rule; process_orders_on_close stays off. */
const { CLASSES } = require('./markets');

/* ---------- English ---------- */
function say(x) {
  if (typeof x === 'number') return String(x);
  const [k, a, b, c] = x;
  switch (k) {
    case 'close': case 'open': case 'high': case 'low': return k;
    case 'vol': return 'volume';
    case 'ema': return `EMA(${b})`; case 'sma': return `SMA(${b})`; case 'hma': return `HMA(${b})`; case 'wma': return `WMA(${b})`;
    case 'rsi': return `RSI(${b})`; case 'atr': return `ATR(${a})`; case 'adx': return `ADX(${a})`; case 'diP': return `+DI(${a})`; case 'diM': return `-DI(${a})`;
    case 'roc': return `${b}-bar rate of change`; case 'std': return `standard deviation(${b})`;
    case 'hh': return `the ${b}-bar high`; case 'll': return `the ${b}-bar low`;
    case 'stoch': return `Stochastic(${a})`; case 'cci': return `CCI(${a})`; case 'mfi': return `MFI(${a})`; case 'obv': return 'OBV';
    case 'stDir': return `Supertrend(${a},${b}) direction`; case 'macd': return 'MACD'; case 'macdSig': return 'the MACD signal line';
    case 'prev': return `${say(a)} ${b} bar${b > 1 ? 's' : ''} ago`; case 'dow': return 'the UTC weekday';
    case 'add': return `${say(a)} + ${say(b)}`; case 'sub': return `${say(a)} - ${say(b)}`; case 'mul': return `${b} x ${say(a)}`; case 'div': return `${say(a)} / ${say(b)}`;
  }
  return k;
}
function sayCond(x) {
  const [k, a, b] = x;
  if (k === 'and') return x.slice(1).map(sayCond).join(' and ');
  if (k === 'or') return x.slice(1).map(sayCond).join(' or ');
  if (k === 'not') return 'not ' + sayCond(a);
  return `${say(a)} ${{ gt: 'is above', lt: 'is below', xup: 'crosses above', xdn: 'crosses below' }[k]} ${say(b)}`;
}
function describe(r) {
  const o = [];
  if (r.entryL) o.push('Go long when ' + sayCond(r.entryL) + '.');
  if (r.exitL) o.push('Exit the long when ' + sayCond(r.exitL) + '.');
  if (r.entryS) o.push('Go short when ' + sayCond(r.entryS) + '.');
  if (r.exitS) o.push('Exit the short when ' + sayCond(r.exitS) + '.');
  if (r.reverse) o.push('An opposite signal reverses the position.');
  if (r.stop) o.push('Stop: ' + (r.stop.atr ? `${r.stop.atr} ATR(14) from entry` : `${r.stop.pct}% from entry`) + '.');
  if (r.trail) o.push(`The stop trails ${r.trail.atr} ATR(14) behind the last close.`);
  if (r.tp) o.push('Target: ' + (r.tp.r ? `${r.tp.r} times the risk` : r.tp.atr ? `${r.tp.atr} ATR(14)` : `${r.tp.pct}% from entry`) + '.');
  if (r.maxBars) o.push(`Leave after ${r.maxBars} bar${r.maxBars > 1 ? 's' : ''} at most.`);
  return o;
}

/* ---------- Pine v6 ---------- */
function pine(x) {
  if (typeof x === 'number') return String(x);
  const [k, a, b, c] = x;
  switch (k) {
    case 'close': case 'open': case 'high': case 'low': return k;
    case 'vol': return 'volume';
    case 'ema': return `ta.ema(${pine(a)}, ${b})`; case 'sma': return `ta.sma(${pine(a)}, ${b})`;
    case 'wma': return `ta.wma(${pine(a)}, ${b})`; case 'hma': return `ta.hma(${pine(a)}, ${b})`;
    case 'rsi': return `ta.rsi(${pine(a)}, ${b})`; case 'std': return `ta.stdev(${pine(a)}, ${b})`;
    case 'atr': return `ta.atr(${a})`; case 'roc': return `ta.roc(${pine(a)}, ${b})`;
    case 'hh': return `ta.highest(${pine(a)}, ${b})[1]`; case 'll': return `ta.lowest(${pine(a)}, ${b})[1]`;
    case 'stoch': return `ta.stoch(close, high, low, ${a})`; case 'cci': return `ta.cci(hlc3, ${a})`; case 'mfi': return `ta.mfi(hlc3, ${a})`;
    case 'obv': return 'ta.obv'; case 'adx': return `dmiAdx(${a})`; case 'diP': return `dmiPlus(${a})`; case 'diM': return `dmiMinus(${a})`;
    case 'stDir': return `stDir(${a}, ${b})`; case 'macd': return 'macdLine'; case 'macdSig': return 'macdSignal';
    case 'prev': return `(${pine(a)})[${b}]`; case 'dow': return 'dow';
    case 'add': return `(${pine(a)} + ${pine(b)})`; case 'sub': return `(${pine(a)} - ${pine(b)})`;
    case 'mul': return `(${pine(a)} * ${pine(b)})`; case 'div': return `(${pine(a)} / ${pine(b)})`;
  }
  throw new Error('pine: ' + k);
}
/* Pine v6 evaluates `and` and `or` lazily, so a ta.* call on the right of one runs only on some bars and its state is wrong.
   Every leaf therefore gets its own global line through `hoist`, and the join reads plain booleans. */
function pineCond(x, hoist) {
  const [k, a, b] = x;
  if (k === 'and' || k === 'or') return '(' + x.slice(1).map((c) => hoist(pineCond(c, hoist))).join(` ${k} `) + ')';
  if (k === 'not') return 'not ' + pineCond(a, hoist);
  if (k === 'gt') return `${pine(a)} > ${pine(b)}`;
  if (k === 'lt') return `${pine(a)} < ${pine(b)}`;
  return `ta.${k === 'xup' ? 'crossover' : 'crossunder'}(${pine(a)}, ${pine(b)})`;
}
function toPine(r) {
  const text = JSON.stringify(r), l = [];
  const cost = CLASSES.crypto;
  l.push('//@version=6', `// ${r.name} - ${r.summary}`, '// From the MarginPad strategy library: https://marginpad.io/strategies/' + r.slug + '/',
    '// Research, not advice. A backtest is evidence, never a promise. Licence: MIT.', '');
  l.push(`strategy("${r.name} [MarginPad]", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=${cost.fee}, slippage=2, pyramiding=0)`, '');
  if (text.includes('"macd')) l.push('[macdLine, macdSignal, _h] = ta.macd(close, 12, 26, 9)');
  if (/"adx"|"diP"|"diM"/.test(text)) {
    l.push('dmiPlus(int p) =>', '    [a, b, c] = ta.dmi(p, p)', '    a', 'dmiMinus(int p) =>', '    [a, b, c] = ta.dmi(p, p)', '    b', 'dmiAdx(int p) =>', '    [a, b, c] = ta.dmi(p, p)', '    c');
  }
  if (text.includes('"stDir"')) l.push('stDir(int p, float m) =>', '    [_v, d] = ta.supertrend(m, p)', '    -d'); // Pine's direction is -1 for up; the rule reads +1 for up
  if (text.includes('"dow"')) l.push('dow = dayofweek(time, "UTC") - 1');
  const atr14 = r.stop || r.tp || r.trail;
  if (atr14) l.push('atr14 = ta.atr(14)');
  l.push('');
  let leaf = 0;
  const hoist = (e) => { if (/^\w+$/.test(e)) return e; leaf++; l.push(`c${leaf} = ${e}`); return `c${leaf}`; };
  const put = (name, c) => { const e = pineCond(c, hoist); l.push(`${name} = ${e}`); };
  if (r.entryL) put('longIn', r.entryL);
  if (r.entryS) put('shortIn', r.entryS);
  if (r.exitL) put('longOut', r.exitL);
  if (r.exitS) put('shortOut', r.exitS);
  l.push('');
  if (r.entryL) l.push(`if longIn${r.reverse ? '' : ' and strategy.position_size == 0'}`, '    strategy.entry("Long", strategy.long)');
  if (r.entryS) l.push(`if shortIn${r.reverse ? '' : ' and strategy.position_size == 0'}`, '    strategy.entry("Short", strategy.short)');
  if (r.exitL) l.push('if longOut', '    strategy.close("Long")');
  if (r.exitS) l.push('if shortOut', '    strategy.close("Short")');
  if (r.maxBars) l.push(`if strategy.position_size != 0 and bar_index - strategy.opentrades.entry_bar_index(0) + 1 >= ${r.maxBars}`, '    strategy.close_all()');
  if (r.stop || r.tp || r.trail) {
    const levels = (dir, id) => {
      const s = dir > 0 ? '-' : '+', t = dir > 0 ? '+' : '-', o = [];
      o.push('    entry = strategy.opentrades.entry_price(0)', '    var float risk = na', '    if strategy.opentrades.entry_bar_index(0) == bar_index or na(risk)',
        `        risk := ${r.stop ? (r.stop.atr ? `${r.stop.atr} * atr14[1]` : `entry * ${r.stop.pct / 100}`) : 'na'}`);
      o.push(`    stopPx = ${r.stop ? `entry ${s} risk` : 'float(na)'}`);
      if (r.trail) o.push(`    trailPx = close ${s} ${r.trail.atr} * atr14`, `    var float best = na`, `    best := na(best) or strategy.opentrades.entry_bar_index(0) == bar_index ? trailPx : ${dir > 0 ? 'math.max' : 'math.min'}(best, trailPx)`, `    stopPx := ${dir > 0 ? 'math.max' : 'math.min'}(stopPx, best)`);
      if (r.tp) o.push(`    tpPx = entry ${t} ${r.tp.r ? `risk * ${r.tp.r}` : r.tp.atr ? `${r.tp.atr} * atr14[1]` : `entry * ${r.tp.pct / 100}`}`);
      o.push(`    strategy.exit("${id} exit", "${id}", stop=stopPx${r.tp ? ', limit=tpPx' : ''})`);
      return o;
    };
    if (r.entryL) l.push('if strategy.position_size > 0', ...levels(1, 'Long'));
    if (r.entryS) l.push('if strategy.position_size < 0', ...levels(-1, 'Short'));
  }
  return l.join('\n') + '\n';
}

/* ---------- Python: one file, no dependencies ---------- */
function py(x) {
  if (typeof x === 'number') return `num(${x})`;
  const [k, a, b, c] = x;
  switch (k) {
    case 'close': case 'open': case 'high': case 'low': return `b["${k[0]}"]`;
    case 'vol': return 'b["v"]';
    case 'ema': case 'sma': case 'wma': case 'hma': case 'rsi': case 'std': return `${k}(${py(a)}, ${b})`;
    case 'roc': return `roc(${py(a)}, ${b})`; case 'hh': return `highest(${py(a)}, ${b})`; case 'll': return `lowest(${py(a)}, ${b})`;
    case 'atr': return `atr(b, ${a})`; case 'stoch': return `stoch(b, ${a})`; case 'cci': return `cci(b, ${a})`; case 'mfi': return `mfi(b, ${a})`;
    case 'obv': return 'obv(b)'; case 'adx': return `dmi(b, ${a})[2]`; case 'diP': return `dmi(b, ${a})[0]`; case 'diM': return `dmi(b, ${a})[1]`;
    case 'stDir': return `supertrend_dir(b, ${a}, ${b})`; case 'macd': return `macd(b, ${a}, ${b})`; case 'macdSig': return `ema(macd(b, ${a}, ${b}), ${c})`;
    case 'prev': return `prev(${py(a)}, ${b})`; case 'dow': return 'weekday(b)';
    case 'add': case 'sub': case 'mul': case 'div': return `op("${k}", ${py(a)}, ${py(b)})`;
  }
  throw new Error('py: ' + k);
}
function pyCond(x) {
  const [k, a, b] = x;
  if (k === 'and' || k === 'or') return `(${x.slice(1).map(pyCond).map((s) => `${s}`).join(` ${k} `)})`;
  if (k === 'not') return `(not ${pyCond(a)})`;
  if (k === 'gt') return `gt(${py(a)}, ${py(b)}, i)`;
  if (k === 'lt') return `lt(${py(a)}, ${py(b)}, i)`;
  return `${k}(${py(a)}, ${py(b)}, i)`;
}
function toPython(r, runtime) {
  const f = (c) => (c ? `lambda b, i: ${pyCond(c)}` : 'None');
  return `#!/usr/bin/env python3
"""${r.name} - ${r.summary}

From the MarginPad strategy library: https://marginpad.io/strategies/${r.slug}/
Research, not advice. A backtest is evidence, never a promise. Licence: MIT.

    python ${r.slug}.py candles.csv        columns: time,open,high,low,close,volume
"""
${runtime}

RULE = dict(
    name=${JSON.stringify(r.name)},
    entry_long=${f(r.entryL)},
    exit_long=${f(r.exitL)},
    entry_short=${f(r.entryS)},
    exit_short=${f(r.exitS)},
    reverse=${r.reverse ? 'True' : 'False'},
    stop=${r.stop ? (r.stop.atr ? `("atr", ${r.stop.atr})` : `("pct", ${r.stop.pct})`) : 'None'},
    target=${r.tp ? (r.tp.r ? `("r", ${r.tp.r})` : r.tp.atr ? `("atr", ${r.tp.atr})` : `("pct", ${r.tp.pct})`) : 'None'},
    trail=${r.trail ? r.trail.atr : 'None'},
    max_bars=${r.maxBars || 'None'},
)

if __name__ == "__main__":
    main(RULE)
`;
}
function toBot(r, runtime, bot) {
  const m = { '1h': 60, '4h': 240, '1d': 1440 }[r.tf];
  return toPython(r, runtime + bot)
    .replace(`    python ${r.slug}.py candles.csv        columns: time,open,high,low,close,volume`, `Paper money only. MARGINPAD_KEY=your_key python ${r.slug}-bot.py BTC`)
    .replace('    main(RULE)', `    main_bot(RULE, ${m})`);
}
module.exports = { describe, toPine, toPython, toBot };
