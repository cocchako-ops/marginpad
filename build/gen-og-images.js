/* Per-page share cards (2026-09-14).
 *
 * Owner: "jel mozemo za svaki link da napravimo drugaciju i cool stranicu ... da mami klik jer je to poenta."
 *
 * Measured before writing anything: 856 pages in dist, and 758 of them pointed at the SAME
 * /assets/og.png. A preview that shows one logo whether the link is a blog post, a calculator or a live
 * feed tells the person receiving it nothing, so it earns no click. What earns the click is the page's
 * own headline at size plus one concrete thing only that page has.
 *
 * Every card is built from the page's REAL <title> and description - no hand-kept copy to drift - and
 * rendered at 1200x630 through the browser we already use for E2E, so the design is plain CSS.
 *
 *   node build/gen-og-images.js            all families
 *   node build/gen-og-images.js blog coin  only those
 *   node build/gen-og-images.js --limit 6  a sample, for looking at
 *
 * Output: dist/assets/og/<slug>.png, then `node build/add-og-image.js` points each page at its own.
 */
const fs = require('fs');
const path = require('path');
const { withBrowser, newPage } = require('./e2e-browser.js');
const tpl = require('./og/templates.js');
const { T, ACCENT } = tpl;

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OGDIR = path.join(DIST, 'assets', 'og');
const FONTDIR = path.join(DIST, 'assets', 'fonts');

/* The fonts come from dist/assets/fonts.css, which is Google's own gstatic @font-face CSS, NOT the
   local woff2 subset next to it: that subset carries no lowercase (measured on the first render - every
   uppercase label was right and every lowercase line fell back to a serif) and CLAUDE.md already warns
   it has a malformed capital A. This runs at build time with a network, so gstatic is simply fetched. */
const FONTCSS = fs.readFileSync(path.join(DIST, 'assets', 'fonts.css'), 'utf8')
  .replace(/font-display\s*:\s*\w+/g, 'font-display:block');
tpl.setFonts(FONTCSS);

/* ── read the page, not a list we would have to maintain ─────────────────────────────────────────── */
const rd = p => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };
const meta = (h, re) => { const m = h.match(re); return m ? m[1].replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/-/g, '-').replace(/&ndash;/g, '–').replace(/&nbsp;/g, ' ').trim() : ''; };
const titleOf = h => meta(h, /<title>([^<]*)<\/title>/).replace(/\s*\|\s*MarginPad\s*$/, '').trim();
const descOf = h => meta(h, /<meta name="description" content="([^"]*)"/);

/* A title like "Bitcoin Liquidation Map - live BTC liquidity levels" carries the subject before the
   dash and the pitch after it. Split so a card can use the right half in the right place. */
function split(t) {
  const m = String(t || '').split(/\s+[—–-]\s+/);
  return { head: (m[0] || '').trim(), tail: m.slice(1).join(' - ').trim() };
}
const slugOf = rel => rel.replace(/^\/+|\/+$/g, '').replace(/\//g, '-') || 'home';

/* ── which design a page gets ────────────────────────────────────────────────────────────────────── */
const COIN_ACCENT = { BTC: '#f7931a', ETH: '#7b8cff', SOL: '#14f195', XRP: '#4fd1c5', BNB: '#f0b90b', DOGE: '#c2a633', ADA: '#3cc8c8', AVAX: '#e84142', LINK: '#2a5ada', LTC: '#bfbbbb', DOT: '#e6007a', MATIC: '#8247e5', ARB: '#2d9cdb', OP: '#ff0420', SUI: '#4da2ff', APT: '#4fd1c5', NEAR: '#00ec97', INJ: '#00a3ff', TIA: '#7b2bf9', SEI: '#9e1f19', PEPE: '#4caf50', WIF: '#d4a574', SHIB: '#ff6b1a', HYPE: '#97fce4', TRX: '#eb0029', ATOM: '#6f7390', FIL: '#0090ff', AAVE: '#b6509e', UNI: '#ff007a', ZEC: '#f4b728' };
/* The card shows a worked example, so the number on it has to be the number the calculator returns:
   a long liquidates where the loss eats the margin, less what maintenance margin keeps back. */
const liqAt = (entry, lev) => Math.round(entry * (1 - 1 / lev + 0.005)).toLocaleString('en-US');
const symFrom = rel => { const m = rel.match(/^\/(?:coin\/)?([a-z0-9]{2,7})-liquidation-(?:map|calculator)\/$/) || rel.match(/^\/coin\/([a-z0-9]{2,7})\/$/); return m ? m[1].toUpperCase() : ''; };

function plan(rel, html) {
  const title = titleOf(html), desc = descOf(html);
  if (!title) return null;
  const s = split(title);
  const sym = symFrom(rel);
  const acc = sym && COIN_ACCENT[sym];

  if (rel === '/') return { t: 'home', d: { title: 'Every futures tool. None of the risk.' } };

  if (rel === '/trading-competition/') return { t: 'competition', d: { title: 'Crypto trading competition', pool: '$350', days: '14', boards: '6' } };

  if (/-liquidation-map\/$/.test(rel)) {
    const name = s.head.replace(/\s*\([^)]*\)/, '').replace(/\s*Liquidation Map.*$/i, '').trim();
    return { t: 'map', d: { sym, title: name + ' liquidation map',
      sub: 'Real liquidations from nine exchanges, plus the price levels where the next ones sit.',
      accent: acc || ACCENT.red, eyebrow: 'Where the stops are stacked' } };
  }

  if (/-liquidation-calculator\/$/.test(rel)) {
    const lev = (rel.match(/^\/(\d+)x-/) || [])[1];
    const name = s.head.replace(/\s*\([^)]*\)/, '').replace(/\s*Liquidation Calculator.*$/i, '').trim();
    return { t: 'calc', d: { title: name + ' liquidation calculator', sub: 'Exact liquidation price for any entry, leverage and side - on the exchange you actually trade.',
      accent: acc || ACCENT.cyan, eyebrow: lev ? lev + 'x leverage' : 'Liquidation price',
      fields: ['Entry', 'Leverage', 'Side'], vals: ['60,000', (lev || '20') + 'x', 'Long'], outK: 'Liquidation', outV: liqAt(60000, +(lev || 20)) } };
  }

  if (/^\/coin\//.test(rel))
    return { t: 'coin', d: { sym, title: s.head.replace(/\s*\(.*$/, ''), sub: s.tail || desc, accent: acc || ACCENT.gold } };

  if (/-vs-/.test(rel)) {
    const m = rel.replace(/^\/|\/$/g, '').split('-vs-');
    // a venue writes its own name: naive capitalisation produced "Kucoin", "Okx", "Bitmex", "Dydx"
    const BRAND = { binance: 'Binance', bybit: 'Bybit', okx: 'OKX', kucoin: 'KuCoin', bitget: 'Bitget', gate: 'Gate.io',
      mexc: 'MEXC', htx: 'HTX', bingx: 'BingX', phemex: 'Phemex', kraken: 'Kraken', coinbase: 'Coinbase',
      hyperliquid: 'Hyperliquid', deribit: 'Deribit', bitmex: 'BitMEX', dydx: 'dYdX', bitfinex: 'Bitfinex',
      'crypto-com': 'Crypto.com', cryptocom: 'Crypto.com', woo: 'WOO X', moon: 'Moon', bitmart: 'BitMart', lbank: 'LBank' };
    const cap = x => BRAND[x] || x.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { t: 'versus', d: { a: cap(m[0] || ''), b: cap(m[1] || ''), sub: desc || s.tail, eyebrow: 'Exchange comparison',
      aNote: 'fees · leverage', bNote: 'fees · leverage' } };
  }

  if (/^\/blog\//.test(rel)) {
    const kinds = [[/liquidat/i, 'LIQUIDATIONS', ACCENT.red], [/funding/i, 'FUNDING', ACCENT.violet], [/leverage|margin/i, 'LEVERAGE', ACCENT.orange],
      [/exchange|vs\b|best /i, 'EXCHANGES', ACCENT.blue], [/tax|fee/i, 'COSTS', ACCENT.cyan], [/fomc|cpi|nfp|pce|calendar|macro/i, 'MACRO', ACCENT.gold],
      [/bitcoin|btc|eth|altcoin/i, 'MARKETS', ACCENT.green], [/psycholog|mistake|risk/i, 'RISK', ACCENT.pink]];
    const hit = kinds.find(k => k[0].test(title)) || [null, 'GUIDE', ACCENT.lime];
    return { t: 'article', d: { title: s.head + (s.tail && s.head.length < 44 ? ' - ' + s.tail : ''), sub: desc, kind: hit[1], accent: hit[2], path: rel } };
  }

  if (/^\/guides\//.test(rel))
    return { t: 'article', d: { title: s.head, sub: s.tail || desc, kind: 'GUIDE', accent: ACCENT.blue, path: rel } };

  const ONE = {
    '/paper-trade/': ['tool', { title: 'Paper trade crypto futures', sub: 'A real terminal, filled from real candles. No signup, no deposit.', tag: 'NO SIGNUP', accent: ACCENT.lime, path: '/paper-trade' }],
    '/liquidations/': ['live', { title: 'Crypto liquidations, live', eyebrow: 'Updating every minute', accent: ACCENT.red, path: '/liquidations/',
      stats: [{ k: '24h total', v: 'live', c: '#fff' }, { k: 'Longs', v: 'live', c: ACCENT.green }, { k: 'Shorts', v: 'live', c: ACCENT.red }] }],
    '/rekt/': ['live', { title: 'Every liquidation, the moment it happens', eyebrow: 'Live feed · nine exchanges', accent: ACCENT.red, path: '/rekt/',
      sub: 'A ticket for every forced close, streamed from our own collector.' }],
    '/funding/': ['live', { title: 'Crypto funding rates', eyebrow: 'Live · every major perp', accent: ACCENT.violet, path: '/funding/',
      sub: 'Who is paying whom, right now, and where the crowd is leaning.' }],
    '/open-interest/': ['live', { title: 'Crypto open interest', eyebrow: 'Live · leverage building and unwinding', accent: ACCENT.blue, path: '/open-interest/' }],
    '/long-short/': ['live', { title: 'Long / short ratio', eyebrow: 'Live trader positioning', accent: ACCENT.green, path: '/long-short/' }],
    '/fear-greed/': ['live', { title: 'Crypto Fear & Greed Index', eyebrow: 'Measured daily, in house', accent: ACCENT.gold, path: '/fear-greed/' }],
    '/hyperliquid-whales/': ['live', { title: 'What the biggest traders are actually betting on', eyebrow: 'Hyperliquid · on-chain', accent: ACCENT.cyan, path: '/hyperliquid-whales/',
      sub: 'Every whale position, every trade as it executes, with real leverage and liquidation prices.' }],
    '/heatmap/': ['tool', { title: 'Liquidation heatmap', sub: 'Where the stops are stacked, across every major pair.', accent: ACCENT.red, path: '/heatmap' }],
    '/swap/': ['tool', { title: 'Swap 900+ coins, no account', sub: 'Non-custodial, instant, nothing to sign up for.', accent: ACCENT.violet, path: '/swap', tag: 'NO ACCOUNT' }],
    '/screener/': ['tool', { title: 'Crypto futures screener', sub: 'Every perp, scored and sorted, across exchanges.', accent: ACCENT.blue, path: '/screener' }],
    '/charts/': ['tool', { title: 'Eight charts, one screen', sub: 'A multi-chart workspace with 19 indicators and a drawing engine.', accent: ACCENT.cyan, path: '/charts' }],
    '/calculators/': ['calc', { title: 'Every futures calculator', sub: 'Liquidation, position size, P&L, funding, fees.', accent: ACCENT.cyan,
      fields: ['Entry', 'Leverage', 'Size'], vals: ['60,000', '20x', '$500'], outK: 'Liquidation', outV: '57,150' }],
    '/season/': ['product', { title: 'Your season', sub: 'Six leaderboards, a 40-tier pass, and prizes every fourteen days.', accent: ACCENT.lime, path: '/season/',
      points: ['Six boards', 'Free entry', '40-tier pass', 'Paid every 14 days'], tag: 'LIVE STANDINGS' }],
    '/vault/': ['product', { title: 'The Vault', sub: 'Frames, backgrounds and ticket skins earned by trading.', accent: ACCENT.violet, path: '/vault/', points: ['Frames', 'Backgrounds', 'Ticket skins'] }],
    '/rewards/': ['product', { title: 'Earn while you learn to trade', sub: 'A faucet, daily missions and season prizes - paid in real USDT.', accent: ACCENT.green, path: '/rewards/', tag: 'REAL PAYOUTS' }],
    '/premium/': ['product', { title: 'MarginPad Premium', sub: 'AI chart reads, position alerts, the full Bot API tier.', accent: ACCENT.gold, path: '/premium/', points: ['Ask the AI', 'Position alerts', '600 req/min API', 'Trading report'] }],
    '/academy/': ['product', { title: 'Learn futures properly', sub: '16 courses, 140 lessons, in 13 languages. Free.', accent: ACCENT.blue, path: '/academy/', points: ['16 courses', '140 lessons', '13 languages'], tag: 'FREE' }],
    '/spot/': ['product', { title: 'Demo Spot', sub: 'A whole crypto life, simulated: card, exchange, self-custody wallet, memecoins.', accent: ACCENT.orange, path: '/spot/' }],
    '/trading-api/': ['product', { title: 'Trade MarginPad from your own bot', sub: 'REST, WebSocket and MCP. Python and JavaScript SDKs, zero dependencies.', accent: ACCENT.cyan, path: '/trading-api/', points: ['REST + WS', 'MCP, 23 tools', 'Webhooks', 'Free tier'] }],
    '/trading-report/': ['product', { title: 'How you actually trade', sub: 'Your real patterns, measured from every close - not a feeling.', accent: ACCENT.violet, path: '/trading-report/' }],
    '/leaderboards/': ['competition', { title: 'Leaderboards', sub: 'Six season boards, every ranked trader, the prize per rank and the rule each board is scored by.', accent: ACCENT.gold, path: '/leaderboards/' }],
    '/ai-indicators/': ['product', { title: 'The 4 AI indicators, explained', sub: 'Cascade Radar, Liquidation Magnet, Market Brain, Market Memory - what each measures and how to read it before a position.', accent: ACCENT.lime, path: '/ai-indicators/' }],
    '/community/': ['product', { title: 'The MarginPad floor', sub: 'Setups, screenshots and arguments, from people trading the same pairs.', accent: ACCENT.pink, path: '/community/' }],
    '/exchanges/': ['product', { title: 'Crypto futures exchanges, compared properly', sub: 'Fees, leverage, liquidity and what each one actually costs you.', accent: ACCENT.blue, path: '/exchanges/' }],
    '/levels/': ['product', { title: 'Levels and XP', sub: 'Bronze to Legendary, and what each one unlocks.', accent: ACCENT.gold, path: '/levels/' }],
    '/alerts/': ['product', { title: 'Price and position alerts', sub: 'Push and Telegram, on your levels - not somebody else’s.', accent: ACCENT.orange, path: '/alerts/' }],
    '/calendar/': ['live', { title: 'Crypto economic calendar', eyebrow: 'FOMC · CPI · NFP · unlocks', accent: ACCENT.gold, path: '/calendar/' }],
    '/bitcoin-cycle/': ['live', { title: 'Where we are in the Bitcoin cycle', eyebrow: 'Measured in house', accent: ACCENT.gold, path: '/bitcoin-cycle/' }],
    '/news/': ['live', { title: 'Crypto news that moves price', eyebrow: 'Filtered, not firehosed', accent: ACCENT.blue, path: '/news/' }],
    '/defi/': ['live', { title: 'DeFi rates and TVL', eyebrow: 'Live across chains', accent: ACCENT.violet, path: '/defi/' }],
    '/etf-flows/': ['live', { title: 'Bitcoin ETF flows', eyebrow: 'Daily net creations', accent: ACCENT.blue, path: '/etf-flows/' }],
    '/markets/': ['live', { title: 'Every perp market, one page', eyebrow: 'Live', accent: ACCENT.green, path: '/markets/' }],
    '/coins/': ['live', { title: 'Every coin we track', eyebrow: 'Live price · funding · OI', accent: ACCENT.gold, path: '/coins/' }],
    '/liquidation-statistics/': ['live', { title: 'Liquidation statistics', eyebrow: 'Our own collector, since day one', accent: ACCENT.red, path: '/liquidation-statistics/' }],
    '/hyperliquid-liquidations/': ['live', { title: 'Hyperliquid liquidations', eyebrow: 'On-chain, live', accent: ACCENT.cyan, path: '/hyperliquid-liquidations/' }],
    '/glossary/': ['article', { title: 'Every futures term, explained plainly', kind: 'REFERENCE', accent: ACCENT.blue, path: '/glossary/' }],
    '/where-to-start/': ['article', { title: 'Never traded futures? Start here.', kind: 'START HERE', accent: ACCENT.lime, path: '/where-to-start/' }],
    '/about/': ['product', { title: 'What MarginPad is, and who builds it', sub: 'A free crypto futures toolkit, paid for by exchange referrals.', accent: ACCENT.lime, path: '/about/' }],
    '/free-crypto-api/': ['product', { title: 'A free crypto futures API', sub: 'Liquidations, funding, open interest and prices. No key needed.', accent: ACCENT.cyan, path: '/free-crypto-api/', tag: 'KEYLESS' }],
    '/status/': ['live', { title: 'Is MarginPad up?', eyebrow: 'Live status', accent: ACCENT.green, path: '/status/' }],
  };
  const key = rel.endsWith('/') ? rel : rel + '/';
  if (ONE[key]) { const [t, d] = ONE[key]; return { t, d: Object.assign({ sub: desc }, d) }; }

  // the four one-question pages
  if (/^\/(how-many-traders-liquidated-today|longs-or-shorts-liquidated-more|biggest-liquidation-today|is-funding-positive-or-negative|crypto-liquidations-today|where-can-i-test-a-trading-bot|mcp-server-for-crypto-trading)\/$/.test(rel)) {
    const A = { 'how-many-traders-liquidated-today': 'Counted every hour', 'longs-or-shorts-liquidated-more': 'Longs vs shorts, live',
      'biggest-liquidation-today': 'The single largest', 'is-funding-positive-or-negative': 'Who pays whom', 'crypto-liquidations-today': 'Today, so far', 'where-can-i-test-a-trading-bot': 'Free, on live prices', 'mcp-server-for-crypto-trading': 'One line of config' };
    return { t: 'ask', d: { title: s.head, answer: A[rel.replace(/\//g, '')] || 'Live', sub: desc, path: rel, accent: ACCENT.orange } };
  }

  if (/calculator\/$/.test(rel) || /^\/(pnl-fee-checker|position-size-calculator|leverage-calculator|stop-loss-calculator|risk-reward-calculator|pivot-point-calculator)\/$/.test(rel)) {
    const EX = {
      'position-size-calculator': [['Account', 'Risk', 'Stop'], ['$5,000', '1%', '2.4%'], 'Position', '$2,083'],
      'leverage-calculator': [['Margin', 'Position', 'Side'], ['$500', '$10,000', 'Long'], 'Leverage', '20x'],
      'stop-loss-calculator': [['Entry', 'Risk', 'Size'], ['60,000', '$50', '0.05 BTC'], 'Stop', '59,000'],
      'risk-reward-calculator': [['Entry', 'Stop', 'Target'], ['60,000', '58,800', '63,600'], 'R:R', '3.0'],
      'crypto-profit-calculator': [['Entry', 'Exit', 'Size'], ['60,000', '63,000', '$1,000'], 'Profit', '+$50'],
      'crypto-fee-calculator': [['Notional', 'Rate', 'Legs'], ['$10,000', '0.055%', '2'], 'Round trip', '$11.00'],
      'crypto-roi-calculator': [['In', 'Out', 'Days'], ['$1,000', '$1,450', '90'], 'ROI', '+45%'],
      'funding-fee-calculator': [['Position', 'Rate', 'Hours'], ['$10,000', '0.01%', '24'], 'Funding', '$24'],
      'crypto-dca-calculator': [['Every', 'Amount', 'Months'], ['week', '$50', '12'], 'Invested', '$2,600'],
      'crypto-compound-calculator': [['Start', 'Per month', 'Months'], ['$1,000', '5%', '12'], 'End', '$1,796'],
      'crypto-break-even-calculator': [['Entry', 'Fees', 'Funding'], ['60,000', '0.11%', '$4'], 'Break even', '60,106'],
      'crypto-drawdown-calculator': [['Peak', 'Trough', ''], ['$10,000', '$6,500', ''], 'To recover', '+53.8%'],
      'crypto-win-rate-calculator': [['Wins', 'Losses', 'R:R'], ['28', '22', '1.8'], 'Expectancy', '+0.41R'],
      'risk-of-ruin-calculator': [['Win rate', 'Risk', 'R:R'], ['45%', '2%', '2.0'], 'Risk of ruin', '3.1%'],
      'crypto-slippage-calculator': [['Size', 'Depth', 'Spread'], ['$50,000', '$2M', '0.02%'], 'Slippage', '0.07%'],
      'crypto-margin-calculator': [['Position', 'Leverage', ''], ['$10,000', '20x', ''], 'Margin', '$500'],
      'apr-apy-calculator': [['APR', 'Compounds', ''], ['12%', 'daily', ''], 'APY', '12.75%'],
    };
    const slug = rel.replace(/^\/|\/$/g, '');
    const e = EX[slug];
    const d2 = { title: s.head.replace(/\s*\|.*$/, ''), sub: s.tail || desc, accent: ACCENT.cyan, eyebrow: 'Free calculator' };
    if (e) { d2.fields = e[0].filter(Boolean); d2.vals = e[1].filter((x, i) => e[0][i]); d2.outK = e[2]; d2.outV = e[3]; }
    else { d2.fields = ['Entry', 'Leverage', 'Size']; d2.vals = ['60,000', '20x', '$500']; d2.outK = 'Liquidation'; d2.outV = liqAt(60000, 20); }
    return { t: 'calc', d: d2 };
  }

  if (/simulator\/$|paper-trading\/$|-alternative\/$|trading-simulator/.test(rel))
    return { t: 'tool', d: { title: s.head, sub: s.tail || desc, accent: ACCENT.lime, tag: 'NO SIGNUP' } };

  if (/^\/(best-|highest-|lowest-|crypto-trading-(usa|canada))/.test(rel))
    return { t: 'article', d: { title: s.head, sub: s.tail || desc, kind: 'RANKED', accent: ACCENT.blue, path: rel } };

  if (/^\/(widget|widgets|embed|wordpress)/.test(rel))
    return { t: 'product', d: { title: s.head, sub: s.tail || desc, accent: ACCENT.blue, tag: 'FREE EMBED' } };

  if (/^\/(privacy|terms|contact)\/$/.test(rel))
    return { t: 'article', d: { title: s.head, sub: desc, kind: 'MARGINPAD', accent: ACCENT.blue, path: rel } };

  // everything else that is indexable still gets its own headline rather than the shared logo
  return { t: 'product', d: { title: s.head, sub: s.tail || desc, accent: ACCENT.lime, path: rel } };
}

/* ── walk dist ───────────────────────────────────────────────────────────────────────────────────── */
function pages() {
  const out = [];
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name === 'assets' || e.name === 'i18n' || e.name === 'demo-home' || e.name === 'es') continue;
        walk(path.join(dir, e.name), rel + '/' + e.name);
        continue;
      }
      if (e.name !== 'index.html') continue;
      out.push({ rel: (rel || '') + '/', file: path.join(dir, e.name) });
    }
  })(DIST, '');
  if (fs.existsSync(path.join(DIST, 'index.html'))) out.push({ rel: '/', file: path.join(DIST, 'index.html') });
  // The six tool routes have no file of their own - they all serve dist/app.html and the worker rewrites
  // their head through SPA_META. They still need a card each, so they are listed rather than walked to.
  for (const r of ['/paper-trade/', '/charts/', '/screener/', '/heatmap/', '/calculators/', '/swap/'])
    out.push({ rel: r, file: path.join(DIST, 'app.html'), spa: true });
  return out;
}

const FAMILY = { home: 'home', competition: 'competition', map: 'map', calc: 'calc', coin: 'coin', versus: 'versus', article: 'article', live: 'live', tool: 'tool', product: 'product', ask: 'ask' };

(async () => {
  const argv = process.argv.slice(2);
  const limIdx = argv.indexOf('--limit');
  const LIMIT = limIdx >= 0 ? +argv[limIdx + 1] : 0;
  const only = argv.filter((a, i) => !a.startsWith('--') && (limIdx < 0 || (i !== limIdx + 1)));
  const force = argv.includes('--force');

  fs.mkdirSync(OGDIR, { recursive: true });
  const all = pages();
  const jobs = [];
  const skipped = [];
  for (const p of all) {
    const html = p.spa ? '<title>x</title>' : rd(p.file);   // a tool route is described by the ONE table, not by app.html
    if (!p.spa && /name="robots" content="[^"]*noindex/.test(html)) { skipped.push(p.rel + ' (noindex)'); continue; }
    const pl = plan(p.rel, html);
    if (!pl) { skipped.push(p.rel + ' (no title)'); continue; }
    // a filter argument is a FAMILY ("article", "map"…) or a single page's SLUG. Family-only meant that editing
    // one page's description forced a re-render of its whole family to refresh one card (2026-09-15).
    if (only.length && only.indexOf(FAMILY[pl.t] || pl.t) < 0 && only.indexOf(slugOf(p.rel)) < 0) continue;
    jobs.push({ rel: p.rel, slug: slugOf(p.rel), t: pl.t, d: pl.d });
  }
  const byFam = {};
  jobs.forEach(j => { byFam[j.t] = (byFam[j.t] || 0) + 1; });
  console.log('pages: ' + all.length + '   cards to render: ' + jobs.length + (LIMIT ? ' (limited to ' + LIMIT + ')' : ''));
  console.log('by design: ' + Object.entries(byFam).sort((a, b) => b[1] - a[1]).map(x => x[0] + ' ' + x[1]).join('  '));
  if (skipped.length) console.log('skipped: ' + skipped.length);

  const todo = LIMIT ? jobs.slice(0, LIMIT) : jobs;
  let n = 0, bytes = 0, reused = 0;
  // --disable-lcd-text: headless Chrome antialiases text against the subpixel grid, which is correct on
  // a screen and wrong in a file every platform rescales - the first renders had red and blue fringes on
  // every letter of the logo. --font-render-hinting=none keeps the letterforms as the designer drew them.
  await withBrowser(async browser => {
    const page = await newPage(browser);
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    for (const j of todo) {
      // JPEG, not PNG: 481 cards came to 57.6 MB as PNG and this directory is committed. These are flat
      // dark cards with large type, so quality 90 is indistinguishable at any size a preview is shown at
      // and costs about a fifth of the bytes. Every platform that renders og:image accepts JPEG.
      const out = path.join(OGDIR, j.slug + '.jpg');
      if (!force && fs.existsSync(out)) { reused++; continue; }
      const html = T[j.t](j.d);
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const buf = await page.screenshot({ type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1200, height: 630 } });
      fs.writeFileSync(out, buf);
      n++; bytes += buf.length;
      if (n % 25 === 0) process.stdout.write('  ' + n + '/' + todo.length + '\r');
    }
    await page.close();
  }, { args: ['--disable-lcd-text', '--font-render-hinting=none', '--force-color-profile=srgb'], timeoutMs: 900000 });
  console.log('\nrendered ' + n + ' card(s)' + (reused ? ', ' + reused + ' already existed (use --force to redo)' : '')
    + (n ? ', avg ' + Math.round(bytes / n / 1024) + ' KB, total ' + (bytes / 1048576).toFixed(1) + ' MB' : ''));
})().catch(e => { console.error(e); process.exit(1); });
