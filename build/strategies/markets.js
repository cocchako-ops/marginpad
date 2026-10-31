/* The ONE table of what a strategy is tested on, and at what cost.
   fee + slip are per side, in percent, and are the numbers Paper Trade charges (feeRateFor / slipFor in worker.js), so a
   backtest here costs what a paper trade there costs. Crypto also pays real funding; nothing else carries a swap.

   The crypto BASKET is chosen by a rule that cannot look ahead: the earliest perps Binance Futures ever listed. Choosing
   "the biggest coins today" would keep the winners and drop what died, which is the survivorship bias that makes old
   backtests look good. `basket:false` markets stay testable one at a time and never move a headline figure. */
const CRYPTO = 'BTC ETH BCH XRP EOS LTC TRX ETC LINK XLM ADA XMR DASH ZEC XTZ BNB ATOM ONT IOTA BAT'.split(' ')
  .map((s) => ({ sym: s, cls: 'crypto', src: 'binance', pair: s + 'USDT', basket: true }));
const CRYPTO_EXTRA = 'SOL DOGE AVAX NEAR DOT UNI AAVE SUI HYPE'.split(' ')
  .map((s) => ({ sym: s, cls: 'crypto', src: 'binance', pair: s + 'USDT', basket: false }));

const Y = (sym, cls, y, name) => ({ sym, cls, src: 'yahoo', y, name, basket: true });
const OTHERS = [
  Y('AAPL', 'stocks', 'AAPL', 'Apple'), Y('MSFT', 'stocks', 'MSFT', 'Microsoft'), Y('NVDA', 'stocks', 'NVDA', 'Nvidia'),
  Y('AMZN', 'stocks', 'AMZN', 'Amazon'), Y('GOOGL', 'stocks', 'GOOGL', 'Alphabet'), Y('TSLA', 'stocks', 'TSLA', 'Tesla'),
  Y('META', 'stocks', 'META', 'Meta'), Y('JPM', 'stocks', 'JPM', 'JPMorgan'), Y('XOM', 'stocks', 'XOM', 'Exxon Mobil'),
  Y('WMT', 'stocks', 'WMT', 'Walmart'),
  Y('EURUSD', 'forex', 'EURUSD=X', 'Euro / Dollar'), Y('GBPUSD', 'forex', 'GBPUSD=X', 'Pound / Dollar'),
  Y('USDJPY', 'forex', 'USDJPY=X', 'Dollar / Yen'), Y('AUDUSD', 'forex', 'AUDUSD=X', 'Aussie / Dollar'),
  Y('USDCHF', 'forex', 'USDCHF=X', 'Dollar / Franc'), Y('USDCAD', 'forex', 'USDCAD=X', 'Dollar / Loonie'),
  Y('XAU', 'commodities', 'GC=F', 'Gold'), Y('XAG', 'commodities', 'SI=F', 'Silver'),
  Y('OIL', 'commodities', 'CL=F', 'WTI crude'), Y('NATGAS', 'commodities', 'NG=F', 'Natural gas'),
  Y('COPPER', 'commodities', 'HG=F', 'Copper'),
  Y('SPX500', 'indices', '^GSPC', 'S&P 500'), Y('NAS100', 'indices', '^NDX', 'Nasdaq 100'),
  Y('US30', 'indices', '^DJI', 'Dow Jones'), Y('GER40', 'indices', '^GDAXI', 'DAX 40'),
  Y('JPN225', 'indices', '^N225', 'Nikkei 225'),
];

const CLASSES = {
  crypto: { label: 'Crypto', fee: 0.055, slip: 0.02, year: 365, tfs: ['1d', '4h', '1h'], bench: 'BTC' },
  stocks: { label: 'Stocks', fee: 0.02, slip: 0.02, year: 252, tfs: ['1d'], bench: 'SPX500' },
  forex: { label: 'Forex', fee: 0.008, slip: 0.005, year: 260, tfs: ['1d'], bench: null },
  commodities: { label: 'Commodities', fee: 0.015, slip: 0.02, year: 252, tfs: ['1d'], bench: 'XAU' },
  indices: { label: 'Indices', fee: 0.015, slip: 0.02, year: 252, tfs: ['1d'], bench: 'SPX500' },
};

const MARKETS = [...CRYPTO, ...CRYPTO_EXTRA, ...OTHERS];
module.exports = { MARKETS, CLASSES };
