/* Writes the public strategy repository (github.com/Marginpad/strategies) into a folder: one directory per strategy with its
   Pine file, Python backtest, paper bot and README, plus an index with the same figures the site prints.
   node build/strategies/publish-repo.js <folder> */
const fs = require('fs'), path = require('path');
const out = process.argv[2]; if (!out) throw new Error('folder?');
const FILES = path.join(__dirname, '..', '..', 'dist', 'strategies', 'files');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'dist', 'strategies', 'data', 'index.json'), 'utf8'));
const { fmtRet, fmtPct } = require('../../dist/assets/mp-strategies.js');
const rows = D.rules.filter((r) => !r.own);
for (const r of rows) {
  const to = path.join(out, 'strategies', r.slug); fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(path.join(FILES, r.slug))) fs.copyFileSync(path.join(FILES, r.slug, f), path.join(to, f));
}
const line = (r) => { const c = r.classes.crypto || Object.values(r.classes)[0]; const k = r.classes.crypto ? 'crypto' : Object.keys(r.classes)[0]; return `| ${r.id} | [${r.name}](strategies/${r.slug}/) | ${r.tf} | ${k} | ${fmtRet(c.m.ret)} | ${fmtRet(c.bench)} | ${fmtPct(c.m.mdd, 1)} |`; };
fs.writeFileSync(path.join(out, 'README.md'), `# MarginPad strategy library

${rows.length} readable trading rules with their full results: https://marginpad.io/strategies/

Each folder holds the same rule three ways:

- \`*.pine\`: Pine Script v6 for TradingView
- \`*.py\`: a one-file Python backtest with no dependencies
- \`*-bot.py\`: a paper bot for the [MarginPad Bot API](https://marginpad.io/trading-api/). No real money.

To run one on 3Commas through TradingView, read the [automate guide](https://marginpad.io/strategies/automate/). There is no one-click import.

## Results

Equal-weight basket, on the timeframe each rule declares, after fees and slippage, with real funding on crypto. Holding is buying the same basket and doing nothing. Most rules do not beat it on total return; their case, where they have one, is a smaller drawdown.

| ID | Strategy | TF | Market | Return | Holding | Max DD |
|---|---|---|---|---|---|---|
${rows.map(line).join('\n')}

Figures to ${new Date(D.meta.generated).toISOString().slice(0, 10)}. The site carries every market, the year-by-year split and the live record.

## How the tests run

A signal is read on a closed bar and fills at the next open with slippage against the trade. A stop that gaps fills at the open. When one bar touches stop and target, the stop counts. Parameters are textbook defaults, and each timeframe was declared before the test.

## Not advice

This is research on past data. A backtest is evidence that an idea once worked, never a promise that it will again.

MIT licence.
`);
fs.writeFileSync(path.join(out, 'LICENSE'), `MIT License

Copyright (c) ${new Date().getUTCFullYear()} MarginPad

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`);
console.log('wrote', rows.length, 'strategies to', out);
