/* /strategies/, one page per strategy, the download files and /strategies/automate/. Numbers come only from
   dist/strategies/data/ (build/strategies/run.js); nothing here is typed by hand. Header, fonts and bundle tags are lifted
   from /catalysts/ so a stamp can never be stale. Run after run.js:
     node build/strategies/run.js && node build/gen-strategies.js */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const { RULES } = require('./strategies/rules');
const { MARKETS, CLASSES } = require('./strategies/markets');
const { describe, toPine, toPython, toBot } = require('./strategies/emit');
const { cardHtml, fmtRet, fmtPct, fmtNum, CLSLBL } = require('../dist/assets/mp-strategies.js');
const REF = 'https://app.3commas.io/auth/registration?utm_source=referral&utm_medium=cabinet&c=tc2235309';
const OUT = path.join(root, 'dist/strategies');
const D = JSON.parse(fs.readFileSync(path.join(OUT, 'data/index.json'), 'utf8'));
const runtime = fs.readFileSync(path.join(__dirname, 'strategies/runtime.py.txt'), 'utf8');
const botRuntime = fs.readFileSync(path.join(__dirname, 'strategies/runtime-bot.py.txt'), 'utf8');
const cat = fs.readFileSync(path.join(root, 'dist/catalysts/index.html'), 'utf8');
const pick = (re, what) => { const m = cat.match(re); if (!m) throw new Error('missing ' + what); return m[0]; };
const preloads = (cat.match(/<link rel="preload"[^>]*>/g) || []).join('\n');
const nav = pick(/<script defer src="\/assets\/mp-nav\.js[^>]*><\/script>/, 'mp-nav');
const crit = pick(/<style id="mpHdrCrit">[\s\S]*?<\/style>/, 'header css');
const hdr = pick(/<header class="mpnav-hdr">[\s\S]*?<\/header>/, 'header');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const J = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const LATEST = new Date(D.meta.generated).toISOString().slice(0, 10);
const yr = new Date().getUTCFullYear();

function shell({ title, desc, url, ld, body, tail = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="https://marginpad.io${url}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#0a0b0d" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://marginpad.io${url}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="manifest" href="/site.webmanifest" />
${ld.map((x) => `<script type="application/ld+json">${J(x)}</script>`).join('\n')}
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
${preloads}
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="stylesheet" href="/assets/mp-strategies.css" />
${nav}
${crit}
</head>
<body>
${hdr}
${body}
${tail}
<script defer src="/assets/mp-strat.js"></script>
<script defer src="/assets/mp-strategies.js"></script>
</body>
</html>
`;
}
const write = (p, s) => { const f = path.join(OUT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

/* ---------- hub ---------- */
const rows = D.rules.filter((r) => r.classes.crypto);
const beat = rows.filter((r) => r.classes.crypto.m.ret > r.classes.crypto.bench).length;
const calm = rows.filter((r) => !r.classes.crypto.thin && r.classes.crypto.m.sharpe > r.classes.crypto.benchS).length;
const runs = RULES.reduce((a, r) => a + MARKETS.reduce((b, m) => b + ((!r.only || r.only.includes(m.cls)) && !(r.vol && m.cls === 'forex') ? CLASSES[m.cls].tfs.length : 0), 0), 0);
const firstYear = Math.min(...D.rules.flatMap((r) => Object.values(r.classes).map((c) => new Date(c.from * 864e5).getUTCFullYear())));
const faq = [
  ['Where do these strategies come from?', 'Sixty readable rules: the textbook trend, breakout and mean-reversion systems, written in the same form, plus rules from our own measurements. Parameters are the textbook defaults, not values tuned to this history.'],
  ['Are these results after costs?', `Yes. Every fill pays the fee and slippage Paper Trade charges for that market, and crypto positions also pay or earn the real funding prints. Crypto is ${CLASSES.crypto.fee}% a side plus ${CLASSES.crypto.slip}% slippage.`],
  ['Why does so little beat buy and hold?', 'Simple rules sit in cash for much of a rising market, so on total return holding is hard to beat. What a rule can offer is a smaller drawdown, which is why Sharpe and maximum drawdown sit beside the return. Every rule stays on the page whatever it did.'],
  ['Can I run one on 3Commas?', 'Yes, for crypto, through TradingView: download the Pine file, add it to a chart, and point its alert at a 3Commas Signal Bot. The automate guide walks through it. There is no one-click import.'],
  ['Is this investment advice?', 'No. This is research on past data. A backtest is evidence that an idea once worked, never a promise that it will again.'],
];
const hub = `<main>
<div class="w hero">
  <div>
    <h1>The open library of trading strategies</h1>
    <p>Sixty rules tested on crypto, stocks, forex, commodities and indices, after fees and funding. See the full result, read the exact rule, try it on live candles and download it. Nothing is hidden, the losers included.</p>
    <div class="cta"><a class="pri" href="#library">Browse all ${RULES.length} strategies</a><a href="#automate">Run one yourself</a></div>
  </div>
  <div class="hst">
    <div><span>Strategies</span><b data-count="${RULES.length}">${RULES.length}</b></div>
    <div><span>Markets</span><b data-count="${MARKETS.length}">${MARKETS.length}</b></div>
    <div><span>Backtests</span><b data-count="${runs}">${runs.toLocaleString('en-US')}</b></div>
    <div><span>Data since</span><b>${firstYear}</b></div>
  </div>
</div>
<div class="w">
  <div class="mk" role="tablist" aria-label="Market">${Object.keys(CLASSES).map((k) => `<button type="button" data-m="${k}" class="${k === 'crypto' ? 'on' : ''}">${CLSLBL[k]}</button>`).join('')}</div>
  <div class="wh"><div id="wLbl"><b>${rows.length} strategies on Crypto.</b> Growth of $1, log scale, after fees. Against simply holding: ${beat} returned more, ${calm} had a better Sharpe, ${rows.filter((r) => r.classes.crypto.m.mdd > r.classes.crypto.benchD).length} had a smaller drawdown.</div><div class="wlg"><span><i></i>Ended up</span><span class="x"><i></i>Ended down</span></div></div>
  <div class="wall" id="wFrame"><svg id="wSvg" viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true"></svg><div class="wdot" id="wDot" hidden></div><div class="wtip" id="wTip" hidden></div></div>
  <p class="wnote">Every line is a real backtest on an equal-weight basket of that market class. Point at one to see which strategy drew it. Results to ${LATEST}.</p>
</div>
<section class="s" id="library"><div class="w">
  <h2>Every strategy, every result</h2>
  <p class="lead">Pick a market above and the whole library re-reads itself. A headline is always the whole basket on the timeframe the rule declared in advance, never the coin it happened to suit.</p>
  <div class="bar"><div class="srch"><input id="q" type="search" placeholder="Search by name, idea or ID" aria-label="Search strategies" /></div>
    <select id="sort" aria-label="Sort by"><option value="id">Library order</option><option value="ret">Highest return</option><option value="sharpe">Highest Sharpe</option><option value="oos">Best in the last 30%</option><option value="mdd">Shallowest drawdown</option><option value="win">Highest win rate</option><option value="pf">Highest profit factor</option></select>
    <div class="vw"><button type="button" data-v="cards" class="on">Cards</button><button type="button" data-v="table">Table</button></div></div>
  <div class="chips">${Object.entries(D.meta.styles).map(([k, v]) => `<button type="button" data-st="${k}">${esc(v)}</button>`).join('')}<button type="button" id="fBeat">Beat holding</button><button type="button" id="fCalm">Better Sharpe than holding</button></div>
  <div class="cnt">Showing <b id="libN">${rows.length}</b> strategies</div>
  <div class="grid" id="lib">${rows.map((r) => cardHtml(r, 'crypto', D.meta.styles)).join('')}</div>
  <div class="none" id="libNone" hidden>No strategy matches these filters. <button type="button" class="btn" id="fClear">Clear filters</button></div>
</div></section>
<section class="s" id="automate"><div class="w">
  <h2>From a result to a running strategy</h2>
  <p class="lead">Practice before anything real. Each step uses tools that already exist.</p>
  <div class="steps">
    <a href="/paper-trade"><h3>Practice it</h3><p>Trade the rule by hand with paper money, on the live market.</p></a>
    <a href="/trading-api/"><h3>Run it as a bot</h3><p>Every strategy downloads as a paper bot for the Bot API. One command, no real money.</p></a>
    <a href="/strategies/automate/"><h3>Automate it</h3><p>Every strategy downloads as a Pine Script for TradingView. The guide shows how to connect it to a bot.</p></a>
  </div>
</div></section>
<section class="s" id="metrics"><div class="w">
  <h2>Reading the numbers</h2>
  <p class="lead">Every card shows the same figures. Here is what each one tells you, and what it does not.</p>
  <div class="g3">
    <div><h3>Return and Holding</h3><p>Total gain over the test, beside what buying the same basket and doing nothing returned. The second number is the one to beat.</p></div>
    <div><h3>Sharpe</h3><p>Return per unit of volatility. It lets you compare a calm strategy with a wild one. Below zero means holding cash did better.</p></div>
    <div><h3>Max drawdown</h3><p>The largest fall from a peak. This is the loss you would have had to sit through to earn the return.</p></div>
    <div><h3>Win rate</h3><p>The share of closed trades that made money. A high figure often hides small wins and the occasional large loss.</p></div>
    <div><h3>Profit factor</h3><p>Gross profit divided by gross loss. 1.0 is breakeven. 2.0 means winners earned twice what losers lost.</p></div>
    <div><h3>Last 30%</h3><p>The history is split in two. A rule that only worked in the first part did not work.</p></div>
  </div>
</div></section>
<section class="s" id="how"><div class="w">
  <h2>How the tests are run</h2>
  <div class="g3">
    <div><h3>Fills we would accept</h3><p>A signal is read on a closed bar and fills at the next open, with slippage against the trade. A stop that gaps fills at the open. When one bar touches stop and target, the stop counts.</p></div>
    <div><h3>Real costs</h3><p>The fee and slippage Paper Trade charges for that market, on both sides. Crypto also pays or earns the actual funding prints.</p></div>
    <div><h3>Picked winners, stated</h3><p>The crypto basket is the first twenty perpetuals Binance ever listed, including the ones that faded. The stock basket is ten of today's large companies, so it carries that bias: read stock results relative to holding them, not as absolute returns.</p></div>
    <div><h3>No tuning</h3><p>Textbook parameters, and a timeframe declared before the test. Change a number until the curve looks good and you have measured nothing.</p></div>
    <div><h3>Three implementations, one result</h3><p>The engine and the Python download are compared trade by trade on every rule. Pine runs on TradingView's own fills, so its figures will differ a little.</p></div>
    <div><h3>What it leaves out</h3><p>No leverage, no liquidation, no market impact, and no swap outside crypto. Forex and commodities come from daily public data. Treat small edges as noise.</p></div>
  </div>
  <p class="warn"><b>These are research examples, not recommendations.</b> Past results do not predict future ones, and nothing here is investment advice.</p>
</div></section>
<section class="s"><div class="w">
  <h2>Questions</h2>
  <div class="g3">${faq.map(([q, a]) => `<div><h3>${esc(q)}</h3><p>${esc(a)}</p></div>`).join('')}</div>
</div></section>
<div style="height:80px"></div>
</main>
<div class="scrim" id="scrim" hidden></div>
<aside class="dr" id="dr" role="dialog" aria-label="Strategy" hidden>
  <div class="dr-t"><button type="button" id="drP" aria-label="Previous"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><button type="button" id="drN" aria-label="Next"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button><span class="sp"></span><button type="button" id="drX" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
  <div class="dr-s"><div class="dr-h" id="drH"></div><div class="dr-a" id="drA"></div><div id="drB"></div></div>
</aside>
<div class="tray" id="tray" hidden><div class="i" id="trayI"></div><button type="button" class="go" id="trayGo">Compare</button><button type="button" class="x" id="trayX">Clear</button></div>
<div class="cmpm" id="cmpM" role="dialog" aria-label="Compare strategies" hidden><h2>Compare strategies</h2><button type="button" class="xx" id="cmpX" aria-label="Close">X</button><div id="cmpB"></div></div>`;
write('index.html', shell({
  title: 'Trading Strategies Library: 60 Backtests After Fees | MarginPad',
  desc: `${RULES.length} free trading strategies backtested on crypto, stocks, forex, commodities and indices after fees and funding. Full results, exact rules, Pine Script and Python downloads.`,
  url: '/strategies/',
  ld: [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Trading Strategies Library', url: 'https://marginpad.io/strategies/', dateModified: LATEST, description: `${RULES.length} backtested trading strategies`, isAccessibleForFree: true },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ],
  body: hub,
}));

/* ---------- one page per strategy ---------- */
const LAB = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'AAPL', 'NVDA', 'TSLA', 'XAU', 'EURUSD', 'SPX500'];
RULES.forEach((r, i) => {
  const card = D.rules.find((x) => x.slug === r.slug);
  const dPath = path.join(OUT, 'data', r.slug + '.json');
  const det = JSON.parse(fs.readFileSync(dPath, 'utf8'));
  det.rule = Object.fromEntries(['entryL', 'entryS', 'exitL', 'exitS', 'stop', 'tp', 'trail', 'maxBars', 'reverse'].filter((k) => r[k] !== undefined).map((k) => [k, r[k]]));
  det.labMarkets = LAB;
  fs.writeFileSync(dPath, JSON.stringify(det));
  const logic = describe(r);
  write(`files/${r.slug}/${r.slug}.pine`, toPine(r));
  write(`files/${r.slug}/${r.slug}.py`, toPython(r, runtime));
  write(`files/${r.slug}/${r.slug}-bot.py`, toBot(r, runtime, botRuntime));
  write(`files/${r.slug}/README.md`, `# ${r.name}\n\n${r.summary}\n\n## The rule\n\n${logic.map((l) => '- ' + l).join('\n')}\n\nDeclared timeframe: ${r.tf}.\n\n## Results\n\nhttps://marginpad.io/strategies/${r.slug}/\n\n## Files\n\n- \`${r.slug}.pine\`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.\n- \`${r.slug}.py\`: Python 3, no dependencies. \`python ${r.slug}.py candles.csv\`, columns time,open,high,low,close,volume.\n- \`${r.slug}-bot.py\`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then \`python ${r.slug}-bot.py BTC\`. Add \`--check\` to price a trade and place nothing.\n\nResearch, not advice. A backtest is evidence, never a promise. MIT licence.\n`);

  const cls = Object.entries(card.classes);
  const c0 = card.classes.crypto || cls[0][1], cn0 = card.classes.crypto ? 'crypto' : cls[0][0];
  const sameStyle = RULES.filter((x) => x.style === r.style && x.slug !== r.slug);
  const next = [0, 1, 2].map((k) => sameStyle[(i + k) % sameStyle.length]).filter((x, k, a) => x && a.indexOf(x) === k);
  const staticTable = `<div class="tbw"><table class="st"><thead><tr><th>Market class</th><th>Return</th><th>Holding</th><th>Sharpe</th><th>Max DD</th><th>Win rate</th><th>Trades</th></tr></thead><tbody>${cls.map(([k, c]) => `<tr><td class="nm">${CLSLBL[k]}, ${c.tf}</td><td>${fmtRet(c.m.ret)}</td><td>${fmtRet(c.bench)}</td><td>${c.thin ? '-' : fmtNum(c.m.sharpe)}</td><td>${fmtPct(c.m.mdd, 1)}</td><td>${fmtNum(c.m.win, 1)}%</td><td>${c.m.trades.toLocaleString('en-US')}</td></tr>`).join('')}</tbody></table></div>`;
  const faqS = [
    [`What is the ${r.name} strategy?`, `${r.summary} ${logic.join(' ')}`],
    [`Did ${r.name} beat buy and hold?`, `On the ${CLSLBL[cn0]} basket, ${r.tf} bars, after fees: ${fmtRet(c0.m.ret)} against ${fmtRet(c0.bench)} for holding, with a maximum drawdown of ${fmtPct(c0.m.mdd, 1)}.`],
  ];
  const page = `<main class="pg">
<div class="crumb"><a href="/strategies/">Strategies</a> / ${r.id}</div>
<h1>${esc(r.name)}</h1>
<p class="sub">${esc(r.summary)}</p>
<div class="cta"><a class="pri" href="#lab">Watch it trade</a><a href="#download">Download</a><a href="/paper-trade">Practice it</a><a href="/charts?coin=BTC">Open charts</a></div>
<h2>Results</h2>
<div id="sDetail" data-slug="${r.slug}" style="min-height:620px">${staticTable}</div>
<h2>The exact rule</h2>
<ul>${logic.map((l) => `<li>${esc(l)}</li>`).join('')}<li>Declared timeframe: ${esc(r.tf)}.</li></ul>
<p><a class="ln" href="/charts?coin=BTC&amp;ai=1" data-explain="${esc('Explain this trading rule in plain words, and say where it would have entered and left on this chart: ' + logic.join(' '))}">Explain it with Ask AI</a> <span style="color:var(--d)">(Premium, on a desktop)</span></p>
<h2 id="lab">Watch it trade</h2>
<p>This runs the same engine in your browser on the latest candles, with your own costs. Press Replay to watch every entry and exit arrive bar by bar.</p>
<div id="sLab"></div>
<h2 id="download">Download</h2>
<div class="dl">
<a href="/strategies/files/${r.slug}/${r.slug}.pine" download data-dl="pine"><b>Pine Script</b><span>For TradingView</span></a>
<a href="/strategies/files/${r.slug}/${r.slug}-bot.py" download data-dl="bot"><b>Paper bot</b><span>Runs on the Bot API, no real money</span></a>
<a href="/strategies/files/${r.slug}/${r.slug}.py" download data-dl="py"><b>Python backtest</b><span>One file, no dependencies</span></a>
<a href="/strategies/files/${r.slug}/README.md" download data-dl="readme"><b>README</b><span>The rule in plain words</span></a>
</div>
<p class="partner">Want it to run by itself? <a href="/strategies/automate/">Read the automate guide</a>, and use paper money first.</p>
<h2>Related strategies</h2>
<div class="next">${next.map((x) => `<a href="/strategies/${x.slug}/"><b>${esc(x.name)}</b><span>${esc(x.summary)}</span></a>`).join('')}</div>
<p class="warn"><b>Research, not advice.</b> Past results do not predict future ones. Results run to ${LATEST}.</p>
</main>`;
  write(`${r.slug}/index.html`, shell({
    title: `${r.name} Strategy: Backtest, Rules, Pine Script | MarginPad`,
    desc: `${r.summary} Backtested after fees: ${fmtRet(c0.m.ret)} against ${fmtRet(c0.bench)} for holding on the ${CLSLBL[cn0]} basket. Free Pine Script and Python.`,
    url: `/strategies/${r.slug}/`,
    ld: [
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Strategies', item: 'https://marginpad.io/strategies/' }, { '@type': 'ListItem', position: 2, name: r.name, item: `https://marginpad.io/strategies/${r.slug}/` }] },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
    body: page,
  }));
});

/* ---------- automate ---------- */
const auto = `<main class="pg">
<div class="crumb"><a href="/strategies/">Strategies</a> / Automate</div>
<h1>Automate a strategy</h1>
<p class="sub">How a strategy from the library becomes a bot that trades by itself. There is no one-click import, and this page will not pretend otherwise.</p>
<p class="warn"><b>Start on paper.</b> A backtest is evidence, not a promise. Run any strategy with paper money before real money, and never with funds you cannot lose.</p>
<h2>What you need</h2>
<ul><li>A TradingView plan that can send webhook alerts, which needs a paid plan and two-factor authentication.</li><li>A <a class="ln" href="${REF}" target="_blank" rel="sponsored noopener" data-tool="3Commas">3Commas account</a> connected to your exchange. <span style="color:var(--d)">Partner link: we may earn a commission, and it costs you nothing extra.</span></li><li>A strategy from the library. 3Commas works with crypto exchanges, so this route is for crypto markets.</li></ul>
<h2>The steps</h2>
<div class="steps" style="grid-template-columns:minmax(0,1fr)">
<div><h3>Add the Pine file to TradingView</h3><p>Download the Pine file from the strategy's page. In TradingView open the Pine Editor, paste it, save it and add it to the chart. Pick the pair and the timeframe the strategy declares.</p></div>
<div><h3>Create a Signal Bot</h3><p>In 3Commas open the Signal Bot tab and press Create Bot. Choose TradingView Strategy as the start condition, fill in the general fields, set a capital limit and save. Keep the window open: it shows the webhook URL and the JSON you need.</p></div>
<div><h3>Create the alert</h3><p>In TradingView open Alert and select the strategy as the condition. Copy the TradingView Strategy JSON from the Signal Bot window into the alert's Message field. In the Notifications tab, paste the webhook URL and create the alert.</p></div>
<div><h3>Watch it first</h3><p>Use 3Commas demo mode if your account offers it, or a very small amount. Check that entries and exits appear when TradingView says they should before you trust it.</p></div>
</div>
<h2>Prefer to stay on paper?</h2>
<p>Each strategy also downloads as a paper bot. Get a key from the <a class="ln" href="/trading-api/">MarginPad Bot API</a>, set MARGINPAD_KEY and run the file. It trades paper money with real fees and funding, and the same key covers crypto, stocks, forex, metals and indices.</p>
<h2>What can differ from the backtest</h2>
<ul><li>TradingView fills and our engine are not identical, so its figures will differ a little.</li><li>Live fills pay your exchange's real spread and fee.</li><li>A webhook can arrive late or fail. Keep a stop on the exchange.</li></ul>
<p style="margin-top:22px"><a class="ln" href="/strategies/">Back to all strategies</a></p>
</main>`;
write('automate/index.html', shell({
  title: 'How to Automate a Trading Strategy With 3Commas | MarginPad',
  desc: 'Turn a backtested strategy into a bot: Pine Script on TradingView, an alert, and a 3Commas Signal Bot. What you need, the steps, and what can differ from the backtest.',
  url: '/strategies/automate/',
  ld: [{ '@context': 'https://schema.org', '@type': 'HowTo', name: 'Automate a trading strategy with TradingView and 3Commas', step: ['Add the Pine file to TradingView', 'Create a Signal Bot', 'Create the alert', 'Watch it first'].map((n) => ({ '@type': 'HowToStep', name: n })) }],
  body: auto,
}));
console.log('strategies:', RULES.length, 'pages, backtests', runs, 'beat holding on crypto', beat, 'of', rows.length);
