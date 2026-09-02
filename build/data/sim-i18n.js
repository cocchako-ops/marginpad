/* Strings for the trading-simulator SEO pages (stock / forex / index), EN + 12 langs.
   Consumed by build/gen-sim-pages.js. Translations added per lang key; EN is the source of truth.
   Keep it accurate: live market data, real leverage/liquidation, no signup, not financial advice. */

// Shared chrome + section labels (same across the 3 pages).
const SHARED = {
  en: {
    navPaper: 'Paper Trade', navCharts: 'Charts', navStock: 'Stock simulator', navForex: 'Forex simulator', navIndex: 'Index simulator', navTools: 'Tools', openApp: 'Open app',
    startFree: 'Start practicing free', openCharts: 'Open live charts', openSim: 'Open trading simulator', heroNote: 'Live market data · long & short · leverage, stop-loss & take-profit · runs in your browser',
    howH: 'How it works', s1t: 'Pick a market', s1p: 'Choose one of the instruments below. A live candlestick chart loads instantly — the same data a real screen shows.', s2t: 'Go long or short', s2p: 'Set your size and leverage, then buy if you expect it to rise or sell if you expect it to fall. Add a stop-loss and take-profit if you want.', s3t: 'Watch live P&L', s3p: 'Your profit and loss updates in real time as the price moves. Close whenever you like and review the trade in your journal. Repeat, learn, improve.',
    cmpH: 'Simulator vs. real trading', cmpCol1: 'MarginPad simulator', cmpRisk: 'Money at risk', cmpRiskR: 'Your capital', cmpData: 'Prices & charts', cmpDataV: 'Live market data', cmpLev: 'Leverage & liquidation', cmpLevV: 'Real mechanics', cmpSign: 'Sign-up needed', cmpNo: 'No', cmpYes: 'Yes (broker)', cmpCost: 'Cost of a mistake', cmpCostV: 'A lesson', cmpCostR: 'Real loss',
    faqH: 'Frequently asked questions', ctaH: 'Start practicing in seconds', pickNote: 'Click any market to open it in the simulator with a live chart.',
    footPractice: 'Practice', footBlurb: 'Practice trading stocks, forex, indices and crypto with live prices and zero risk. Free, no sign-up.', footBottom: '© MarginPad · Practice platform, not financial advice · marginpad.io',
    disc: 'MarginPad is a free practice platform — not investment advice, and simulated results do not guarantee real returns.', alsoPractice: 'You can also practice'
  }
};

const STOCK = {
  en: {
    slug: 'stock-trading-simulator',
    metaTitle: 'Free Stock Trading Simulator — Practice Stocks with $0 Risk',
    metaDesc: 'Practice trading Apple, Tesla, Nvidia and 20+ real stocks with live prices and $0 real money. Free stock trading simulator — no sign-up, real charts, instant paper trades. Learn before you risk a cent.',
    keywords: 'stock trading simulator, paper trade stocks free, practice stock trading, day trading simulator, virtual stock trading, free stock market simulator, learn stock trading',
    eyebrow: 'Free stock simulator', h1: 'Free Stock Trading Simulator',
    sub: 'Trade real stocks with live prices and zero real money. Apple, Tesla, Nvidia and 20 more — practice exactly the way you would trade for real, with charts, leverage and stop-losses. No sign-up, nothing to download.',
    whatH: 'What is a stock trading simulator?',
    whatP1: 'A stock trading simulator lets you buy and sell real stocks using a virtual balance instead of real money. You see the same live prices and candlestick charts a real trader sees, place the same kinds of orders, and watch your profit and loss move tick by tick — but a losing trade costs you nothing except the lesson.',
    whatP2: "MarginPad's simulator is built for people who want the skills to transfer. It uses live market data, real leverage, and real liquidation mechanics, so the instincts you build here — sizing a position, setting a stop, cutting a loser — are the exact instincts you need when real money is on the line.",
    pickH: 'Stocks you can practice with',
    whyH: 'Why practice before you risk real money',
    whyP1: 'Most new traders lose money in their first months — not because the market is impossible, but because they learn the mechanics with real cash on the line. A simulator flips that: you make the beginner mistakes for free. You find out how fast leverage can wipe a position, how a stop-loss actually protects you, and whether your strategy survives contact with a real chart — before a single dollar is at stake.',
    whyP2: 'Because MarginPad uses real prices and real liquidation, there is no false comfort. A 10× position that would blow up in real life blows up here too. That honesty is the point: you graduate with habits that hold up when it counts.',
    cmpReal: 'Real trading', ctaSub: 'Open Apple on a live chart and place your first paper trade — no account, no risk.', ctaBtn: 'Open the simulator', startCoin: 'AAPL',
    faq: [
      ['Is the stock trading simulator really free?', 'Yes. There is no sign-up, no card and no real money involved. You practice with live market prices using a virtual balance, so you can learn without risking a cent.'],
      ['Which stocks can I practice with?', '20+ US blue-chips including Apple, Tesla, Nvidia, Microsoft, Amazon, Alphabet, Meta and Coinbase, plus the S&P 500 (SPY) and Nasdaq 100 (QQQ) ETFs.'],
      ['Are the prices real?', 'Yes. Prices and candles come from real market data with correct market-hours behaviour, so the chart you practice on matches a real trading screen.'],
      ['Can I short stocks in the simulator?', 'Yes. You can go long or short, add leverage, and set a stop-loss and take-profit, exactly like a real futures or CFD account. Liquidation is simulated too, so you learn risk safely.'],
      ['Does it work when the stock market is closed?', 'You can view charts any time. Opening a new stock trade is paused while that market is closed, because the price is frozen at the last close, and it reopens automatically when the market does.'],
      ['Do I need to download anything?', 'No. The simulator runs in your browser on desktop and mobile — nothing to install.'],
      ['How is this different from a stock market game?', 'It uses real live prices and real leverage and liquidation mechanics instead of a gamified fake feed, so the habits and risk skills you build actually transfer to real trading.']
    ]
  }
};

const FOREX = {
  en: {
    slug: 'forex-trading-simulator',
    metaTitle: 'Free Forex Trading Simulator — Practice EUR/USD & Majors, $0 Risk',
    metaDesc: 'Practice forex trading free with live rates on EUR/USD, GBP/USD, USD/JPY and more. Real charts, leverage and stop-loss — a forex demo with no sign-up and no real money. Learn before you risk a cent.',
    keywords: 'forex trading simulator, forex demo account, practice forex trading free, forex paper trading, forex simulator, learn forex trading, eur usd demo, forex practice account',
    eyebrow: 'Free forex simulator', h1: 'Free Forex Trading Simulator',
    sub: 'Practice forex with live rates and zero real money. EUR/USD, GBP/USD, USD/JPY and more — trade exactly the way you would for real, with charts, leverage and stop-losses. No sign-up, no deposit, nothing to download.',
    whatH: 'What is a forex trading simulator?',
    whatP1: 'A forex trading simulator (or forex demo) lets you trade currency pairs with a virtual balance instead of real money. You see the same live rates and candlestick charts a real trader sees, place the same long and short orders, and watch your profit and loss move in real time — but a losing trade costs you nothing but the lesson.',
    whatP2: "MarginPad's simulator is built so the skills transfer. Live rates, real leverage, and real margin and liquidation mechanics mean the habits you build — sizing a position, setting a stop, respecting leverage — are the exact habits you need on a real forex account.",
    pickH: 'Currency pairs you can practice with',
    whyH: 'Why practice forex before risking real money',
    whyP1: 'Forex punishes beginners fast, mostly because of leverage. A pair barely moves a percent in a day, so traders reach for high leverage — and a small move against a big position can wipe it out. A simulator lets you feel that for free: you learn how quickly margin evaporates, how a stop-loss saves you, and whether your strategy holds up on a real chart, before a single dollar is at stake.',
    whyP2: 'Because MarginPad uses live rates and real liquidation, there is no false comfort. An over-leveraged EUR/USD position that would blow up in real life blows up here too. You graduate with habits that survive real money.',
    cmpReal: 'Real forex', ctaSub: 'Open EUR/USD on a live chart and place your first paper trade — no account, no risk.', ctaBtn: 'Open the simulator', startCoin: 'EURUSD',
    faq: [
      ['Is the forex trading simulator free?', 'Yes. There is no sign-up, no deposit and no real money. You practice with live exchange rates using a virtual balance, so you can learn forex without any risk.'],
      ['Which currency pairs can I trade?', 'Major pairs including EUR/USD, GBP/USD, USD/JPY, AUD/USD and USD/CAD, with live rates and real candlestick charts.'],
      ['Are the forex rates live?', 'Yes. Rates and candles come from real market data, so the chart matches what you would see on a live forex screen.'],
      ['Can I use leverage and go short?', 'Yes. You can go long or short, choose your leverage, and set a stop-loss and take-profit. Liquidation is simulated, so you learn how leverage and margin really behave.'],
      ['Is this a good way to practice before a real forex account?', 'Yes. Because it uses real rates and real margin mechanics, the position-sizing and risk habits you build transfer directly to a real broker account — but mistakes here cost nothing.'],
      ['Does the forex market close?', 'The forex market runs 24 hours a day, five days a week, and closes over the weekend. Charts are always viewable and rates resume when the market reopens.']
    ]
  }
};

const INDEX = {
  en: {
    slug: 'index-trading-simulator',
    metaTitle: 'Free Index Trading Simulator — Practice S&P 500, Nasdaq & Dow, $0 Risk',
    metaDesc: 'Practice trading the S&P 500, Nasdaq 100, Dow Jones and DAX with live prices and $0 real money. Free stock index simulator — real charts, leverage and stop-loss, no sign-up.',
    keywords: 'index trading simulator, S&P 500 trading simulator, nasdaq trading simulator, dow jones simulator, practice index trading, stock index demo, spx trading practice',
    eyebrow: 'Free index simulator', h1: 'Free Index Trading Simulator',
    sub: 'Practice the S&P 500, Nasdaq 100, Dow Jones and DAX with live prices and zero real money. Trade indices exactly the way you would for real — charts, leverage and stop-losses. No sign-up, nothing to download.',
    whatH: 'What is an index trading simulator?',
    whatP1: 'A stock index tracks a basket of companies — the S&P 500 follows the 500 largest US firms, the Nasdaq 100 the biggest tech names, the Dow 30 blue-chips. An index trading simulator lets you trade those indices with a virtual balance instead of real money, using the same live prices and candlestick charts a real trader sees, so a losing trade costs you nothing but the lesson.',
    whatP2: "MarginPad's simulator uses live prices, real leverage and real liquidation mechanics. Indices move less violently than a single stock, which tempts traders into heavy leverage — and that is exactly the habit a simulator lets you test safely, before real money is on the line.",
    pickH: 'Indices you can practice with',
    whyH: 'Why practice indices before risking real money',
    whyP1: 'Index futures and CFDs are where many traders first use serious leverage, because an index feels "safer" than a single volatile stock. That feeling is the trap: a small percentage move against a highly leveraged index position can still wipe it out. A simulator lets you learn that for free — how quickly margin evaporates, how a stop-loss protects you, and whether your strategy survives a real chart.',
    whyP2: 'Because MarginPad uses live prices and real liquidation, there is no false comfort. An over-leveraged S&P 500 position that would blow up in real life blows up here too. You graduate with habits that hold up when it counts.',
    cmpReal: 'Real index trading', ctaSub: 'Open the S&P 500 on a live chart and place your first paper trade — no account, no risk.', ctaBtn: 'Open the simulator', startCoin: 'SPX500',
    faq: [
      ['Is the index trading simulator free?', 'Yes. There is no sign-up, no deposit and no real money. You practice with live index prices using a virtual balance, so you can learn without any risk.'],
      ['Which indices can I trade?', "Major stock indices including the S&P 500, Nasdaq 100, Dow Jones, Germany's DAX 40, the UK FTSE 100 and Japan's Nikkei 225, with live prices and real candlestick charts."],
      ['Are the index prices live?', 'Yes. Prices and candles come from real market data, so the chart matches what you would see on a live index screen, with correct market-hours behaviour.'],
      ['Can I short an index and use leverage?', 'Yes. You can go long or short, choose your leverage, and set a stop-loss and take-profit, just like an index CFD or futures account. Liquidation is simulated so you learn risk safely.'],
      ['Is this good practice before trading index futures for real?', 'Yes. Because it uses live prices and real leverage and liquidation mechanics, the position-sizing and risk habits you build transfer directly to a real index futures or CFD account — but mistakes here cost nothing.'],
      ['When can I trade indices in the simulator?', "You can view charts any time. Opening a new index trade follows that index's market hours; when the market is closed the price is frozen at the last close and trading resumes when it reopens."]
    ]
  }
};

// Instrument grids (ticker + name) — names are proper nouns, mostly stable across langs; kept in the generator.
const GRID = {
  stock: [['AAPL','Apple'],['TSLA','Tesla'],['NVDA','Nvidia'],['MSFT','Microsoft'],['AMZN','Amazon'],['GOOGL','Alphabet'],['META','Meta'],['AMD','AMD'],['NFLX','Netflix'],['COIN','Coinbase'],['MSTR','Strategy'],['PLTR','Palantir'],['HOOD','Robinhood'],['AVGO','Broadcom'],['INTC','Intel'],['JPM','JPMorgan'],['DIS','Disney'],['BABA','Alibaba'],['SPY','S&P 500 ETF'],['QQQ','Nasdaq 100 ETF']],
  forex: [['EURUSD','EUR / USD'],['GBPUSD','GBP / USD'],['USDJPY','USD / JPY'],['AUDUSD','AUD / USD'],['USDCAD','USD / CAD']],
  index: [['SPX500','S&P 500'],['NAS100','Nasdaq 100'],['US30','Dow Jones'],['GER40','DAX 40'],['UK100','FTSE 100'],['JPN225','Nikkei 225']]
};

// Merge per-language translations from build/data/sim-i18n/<lang>.json (written by translation agents).
// Each file: { shared:{...}, stock:{...}, forex:{...}, index:{...} }; untranslated keys fall back to EN.
const fs = require('fs'), path = require('path');
const LANG = ['de', 'es', 'pt', 'fr', 'nl', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id'];
const TDIR = path.join(__dirname, 'sim-i18n');
for (const lc of LANG) {
  const f = path.join(TDIR, lc + '.json');
  if (!fs.existsSync(f)) continue;
  try {
    const t = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (t.shared) SHARED[lc] = Object.assign({}, SHARED.en, t.shared);
    if (t.stock) STOCK[lc] = Object.assign({}, STOCK.en, t.stock);
    if (t.forex) FOREX[lc] = Object.assign({}, FOREX.en, t.forex);
    if (t.index) INDEX[lc] = Object.assign({}, INDEX.en, t.index);
  } catch (e) { console.error('sim-i18n: bad JSON for ' + lc + ': ' + e.message); }
}

module.exports = { SHARED, STOCK, FOREX, INDEX, GRID };
