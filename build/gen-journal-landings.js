// Landing pages for MarginPad Journal (2026-11-18, owner: "jel smo odradili SEO za ovaj novi proizvod?").
// One page per exchange (/trading-journal/<ex>/) answering the search a trader actually types ("bybit trading journal",
// "hyperliquid trade history"), plus /tradezella-alternative/. Every figure is something the product does today:
// the setup steps are the ones the connect panel shows, the fee rates are FEE_VENUES, history depth is what each
// exchange serves. TradeZella prices read from tradezella.com/pricing on 2026-11-18.
// After running: add-mpnav, add-sentry, add-metrica, add-gtag, add-preconnect, add-font-preload, add-hdr-crit,
// add-ckbar-boot, add-og-image, fix-charset, add-sitemap-extras, bump-home-assets.
const fs = require('fs'), path = require('path');
const IP = '167.172.98.147';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const EX = {
  bybit: {
    name: 'Bybit', color: '#f7a600', fees: [0.055, 0.02], depth: 'up to 180 days', reach: 'USDT and USDC perpetuals on a Unified Trading Account',
    steps: ['On Bybit open <b>API Management</b> and press <b>Create New Key</b>, then <b>System-generated API Keys</b>.', 'Choose <b>API Transaction</b>, give the key any name and set permissions to <b>Read-Only</b>.', 'Pick <b>Only IPs with permissions granted</b> and paste ' + IP + '.', 'Under Unified Trading, Contract tick <b>Orders</b> and <b>Positions</b> only. Leave every other box empty and submit.'],
    recon: 'Every closed position is checked against Bybit\'s own Closed P&L, order by order, and the page says how many match to the cent.',
    faq: [['Why does MarginPad refuse my Bybit key?', 'Bybit marks a key Read-Only or Read-Write. We ask Bybit which one it is and refuse anything but Read-Only, before the key is stored. Make a new key with Read-Only selected and only Orders and Positions ticked.'], ['Is funding included?', 'Yes. Bybit records each funding payment in the execution log, and the journal adds it to the position that was open at that moment, so a trade\'s net is the same number Bybit shows in Closed P&L.'], ['Does it import spot or options?', 'Not yet - it reads USDT and USDC perpetual futures, which is where fees, funding and liquidations decide the result.']]
  },
  binance: {
    name: 'Binance', color: '#f0b90b', fees: [0.05, 0.02], depth: 'the last three months', reach: 'USD-M futures',
    steps: ['On Binance open <b>API Management</b>, press <b>Create API</b> and choose <b>System generated</b>.', 'Open <b>Edit restrictions</b> and leave only <b>Enable Reading</b> ticked.', 'Choose <b>Restrict access to trusted IPs only</b> and add ' + IP + '.', 'Save. Trading, transfer and withdrawal stay off.'],
    recon: 'Binance reports a realized P&L on every closing fill; the journal computes its own from the fills and compares the two, trade by trade.',
    faq: [['Which Binance permission does the journal need?', 'Enable Reading only. We read the key\'s restrictions from Binance when you connect and refuse it if trading, transfers, margin or withdrawals are switched on.'], ['How far back does it go?', 'Binance serves three months of futures trade history through its API, so that is how far the import reaches; from then on the journal keeps every new trade.'], ['Is funding included?', 'Yes, from Binance\'s income ledger, added to the position that was open when each payment was made.']]
  },
  okx: {
    name: 'OKX', color: '#ffffff', fees: [0.05, 0.02], depth: 'the last three months', reach: 'perpetual swaps',
    steps: ['On OKX open <b>API</b> and press <b>Create API key</b>, purpose <b>API trading</b>.', 'Set a <b>passphrase</b> and keep it - the journal asks for it.', 'Permissions: tick <b>Read</b> only.', 'IP address: paste ' + IP + ' and confirm.'],
    recon: 'Contract sizes are converted with each instrument\'s own contract value, so a fill of 10 contracts is the right amount of coin.',
    faq: [['Why does OKX need a passphrase?', 'OKX signs every request with key, secret and the passphrase you chose. It is stored encrypted with the key and used only to read.'], ['What if my key can trade?', 'OKX tells us a key\'s permission when we ask. Anything other than read-only is refused before it is stored.'], ['Does it work with OKX EEA or OKX US?', 'Yes - the journal tries each OKX region with your key and keeps the one that answers.']]
  },
  bitget: {
    name: 'Bitget', color: '#00e7d8', fees: [0.06, 0.02], depth: 'the last three months', reach: 'USDT-M futures',
    steps: ['On Bitget open <b>API Management</b>, press <b>Create API</b> and choose <b>System-generated API key</b>.', 'Name it and set a <b>passphrase</b> - the journal asks for it.', 'Permissions: choose <b>Read-only</b>; leave trade, transfer and withdraw off.', 'Bind IP: paste ' + IP + ' and confirm.'],
    recon: 'Funding comes from Bitget\'s account bill, so a held position carries what it really paid or received.',
    faq: [['Which Bitget permission is needed?', 'Read-only. We read the key\'s authorities from Bitget and refuse any that can trade, transfer or use P2P.'], ['Does it read copy-trading positions?', 'It reads the futures fills on the account the key belongs to.'], ['How far back?', 'Bitget serves three months of fill history; the journal keeps everything from then on.']]
  },
  bingx: {
    name: 'BingX', color: '#3b6cff', fees: [0.05, 0.02], depth: 'up to 90 days', reach: 'perpetual futures',
    steps: ['On BingX open <b>API Management</b> and press <b>Create API</b>.', 'Keep only <b>Read</b> - a new BingX key starts read-only; do not add trading, transfer or withdraw.', 'Choose <b>Restrict access to trusted IPs</b> and add ' + IP + '.', 'Confirm with your verification code.'],
    recon: 'Funding comes from BingX\'s income history and is added to the position that was open at each payment.',
    faq: [['Which BingX permission is needed?', 'Read only. BingX lists a key\'s permissions; any trading, transfer or withdrawal permission and the key is refused before it is stored.'], ['How far back?', 'Up to 90 days of fills, then every new trade from the day you connect.'], ['Can I connect more than one BingX account?', 'Yes. Each key is its own account in the journal, and you can view them one at a time or together.']]
  },
  hyperliquid: {
    name: 'Hyperliquid', color: '#97fce4', fees: [0.045, 0.015], depth: 'your last 10,000 fills', reach: 'perpetuals, including builder-deployed markets',
    steps: ['Copy your Hyperliquid wallet address (it starts with 0x).', 'Paste it into MarginPad Journal and press Connect.', 'That is all - there is no key. Hyperliquid publishes every account\'s fills, so the journal reads them like anyone could, and can never place an order.'],
    recon: 'Hyperliquid reports a closed P&L on every fill; the journal rebuilds each position from the fills and checks the two against each other.',
    faq: [['Do I need an API key?', 'No. A wallet address is enough, because Hyperliquid fills are public. Nothing is signed and nothing can be traded.'], ['Can someone see my trades?', 'Anyone with your address can read them on Hyperliquid itself; the journal shows them only to you, in your account.'], ['Does it handle positions opened before the history starts?', 'Yes. A position that was already open is marked "before history" and takes Hyperliquid\'s own P&L instead of guessing an entry.']]
  }
};

const css = `:root{--bg:#0a0b0d;--panel:#0f1216;--line:rgba(232,214,178,.12);--line2:rgba(255,255,255,.07);--brass:#d8bf8e;--ink:#ecebe6;--mute:#8d96a2}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 'Familjen Grotesk',system-ui,sans-serif}a{color:var(--brass)}
.wrap{max-width:960px;margin:0 auto;padding:0 22px}
header{display:flex;justify-content:space-between;align-items:center;padding:18px 0}.brand{font:800 20px 'Bricolage Grotesque',sans-serif;color:var(--ink);text-decoration:none}.brand b{color:#c2f64a}
.crumb{font-size:13px;color:var(--mute);margin-top:18px}.crumb a{color:var(--mute)}
.hero{padding:22px 0 10px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:center}
.hero img{width:64px;height:64px;border-radius:16px;box-shadow:0 0 0 2px var(--ac)}
h1{font:600 clamp(32px,5vw,52px)/1.05 'Bricolage Grotesque',sans-serif;letter-spacing:-.02em;margin:0}
.lede{font-size:18px;color:#c9c6bd;max-width:62ch;margin:14px 0 0}
.cta{display:inline-flex;align-items:center;gap:8px;margin:22px 0 6px;padding:13px 20px;border-radius:14px;background:var(--brass);color:#16130c;font-weight:700;text-decoration:none}
.cta.ghost{background:none;border:1px solid var(--line);color:var(--ink);margin-left:8px}
h2{font:600 26px/1.2 'Bricolage Grotesque',sans-serif;margin:40px 0 12px}
.card{border:1px solid var(--line2);border-radius:18px;background:var(--panel);padding:20px 22px}
ol.steps{margin:0;padding:0;list-style:none;counter-reset:s;display:grid;gap:10px}ol.steps li{counter-increment:s;display:grid;grid-template-columns:30px 1fr;gap:12px}
ol.steps li::before{content:counter(s);width:30px;height:30px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(216,191,142,.45);color:var(--brass);font:700 14px 'Space Mono',monospace}
.ip{display:inline-block;margin-top:14px;padding:8px 12px;border-radius:10px;border:1px dashed rgba(216,191,142,.5);font:700 15px 'Space Mono',monospace}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.grid div{border:1px solid var(--line2);border-radius:14px;padding:14px 16px;background:var(--panel)}.grid b{display:block;margin-bottom:4px}.grid span{color:var(--mute);font-size:14.5px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 12px;border-top:1px solid var(--line2);font-size:15px}td.us{color:#c2f64a}
details{border-top:1px solid var(--line2);padding:12px 0}summary{cursor:pointer;font-weight:600}details p{color:#c9c6bd;margin:8px 0 0}
.more{display:flex;flex-wrap:wrap;gap:8px}.more a{padding:7px 12px;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--ink);font-size:14px}
footer{margin:60px 0 40px;color:var(--mute);font-size:13px}
@media(max-width:720px){.grid{grid-template-columns:1fr}.hero{grid-template-columns:1fr}.cta.ghost{margin-left:0}}`;

function shell({ slug, title, desc, h1, body, ld, accent }) {
  const url = 'https://marginpad.io/' + slug + '/';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/fonts.css">
<style>${css}</style>
${ld.map(o => '<script type="application/ld+json">' + JSON.stringify(o) + '</script>').join('\n')}
</head>
<body style="--ac:${accent || '#d8bf8e'}">
<div class="wrap">
<header><a href="/" class="brand">MARGIN<b>PAD</b></a><nav><a href="/trading-journal/">Trading journal</a></nav></header>
${body}
<footer>MarginPad Journal reads your account with a read-only key; it cannot trade, transfer or withdraw. Not financial advice.</footer>
</div>
<script defer src="/assets/mp-auth.js"></script>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;
}

const others = (cur) => '<div class="more">' + Object.keys(EX).filter(k => k !== cur).map(k => `<a href="/trading-journal/${k}/">${EX[k].name} trading journal</a>`).join('') + '<a href="/tradezella-alternative/">TradeZella alternative</a></div>';
const plain = (s) => s.replace(/<[^>]+>/g, '');

let n = 0;
for (const k of Object.keys(EX)) {
  const e = EX[k], slug = 'trading-journal/' + k;
  const isHl = k === 'hyperliquid';
  const title = isHl ? 'Hyperliquid Trade History & Journal - Free, Just Your Wallet Address | MarginPad' : `${e.name} Trading Journal - Free Auto-Sync With a Read-Only API Key | MarginPad`;
  const desc = isHl
    ? 'Paste your Hyperliquid wallet address and get every trade rebuilt from your fills: P&L checked against Hyperliquid, fees, funding, liquidations, and what your volume would cost elsewhere. Free, no key.'
    : `Connect ${e.name} with a read-only API key bound to one IP and see every ${e.reach} trade with fees, funding and liquidations, P&L checked against ${e.name}, and how much you could save. Free.`;
  const h1 = isHl ? 'Hyperliquid trade history, as a journal' : `${e.name} trading journal`;
  const lede = isHl
    ? `Paste your wallet address. MarginPad Journal reads ${e.depth}, rebuilds every position and shows what it made after fees and funding, where you keep losing, and what the same volume would cost on other exchanges. No key, nothing to sign, free.`
    : `Connect ${e.name} with a key that can only read. MarginPad Journal imports ${e.depth} of your ${e.reach}, rebuilds every position from the fills and shows what each trade really made after fees and funding - and how much you could keep. Free.`;
  const body = `
<div class="crumb"><a href="/">MarginPad</a> / <a href="/trading-journal/">Trading journal</a> / ${esc(e.name)}</div>
<section class="hero"><img src="/assets/ex/${k}.png" alt="${esc(e.name)} logo" width="64" height="64"><div><h1>${esc(h1)}</h1></div></section>
<p class="lede">${esc(lede)}</p>
<a class="cta" href="/trading-journal/?ex=${k}">Connect ${esc(e.name)}</a><a class="cta ghost" href="/trading-journal/">See the journal</a>

<h2>${isHl ? 'Connect in one step' : 'Make the key in two minutes'}</h2>
<div class="card"><ol class="steps">${e.steps.map(s => `<li><span>${s}</span></li>`).join('')}</ol>${isHl ? '' : `<div class="ip">IP to bind: ${IP}</div><p style="color:var(--mute);font-size:14px;margin:10px 0 0">Every request to ${esc(e.name)} comes from that one server, so a key bound to it is useless anywhere else.</p>`}</div>

<h2>What you get from your ${esc(e.name)} account</h2>
<div class="grid">
  <div><b>Every trade, rebuilt</b><span>Partial closes, flips and averaging-in resolved into positions with entry, exit, size and time held.</span></div>
  <div><b>Fees and funding in dollars</b><span>What each trade paid at ${e.fees[0]}% taker / ${e.fees[1]}% maker base rates - or your own tier - and what funding took.</span></div>
  <div><b>Checked against ${esc(e.name)}</b><span>${esc(e.recon)}</span></div>
  <div><b>Where you lose</b><span>By market, side, hour, time held and size, with a tilt detector for trades opened right after a loss.</span></div>
  <div><b>What it would cost elsewhere</b><span>Your volume and taker share priced on each exchange, against what you actually paid.</span></div>
  <div><b>Share a verified trade</b><span>Post a closed trade to the MarginPad chat as a card in ${esc(e.name)}'s colours, marked verified from the exchange.</span></div>
</div>

<h2>Questions</h2>
<div class="card">${e.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}<details><summary>What does it cost?</summary><p>Nothing. No card and no trial that ends.</p></details></div>

<h2>Other exchanges</h2>
${others(k)}
`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'MarginPad Journal for ' + e.name, applicationCategory: 'FinanceApplication', operatingSystem: 'Web', url: 'https://marginpad.io/' + slug + '/', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    { '@context': 'https://schema.org', '@type': 'HowTo', name: isHl ? 'Connect a Hyperliquid wallet to a trading journal' : 'Connect ' + e.name + ' to a trading journal with a read-only API key', step: e.steps.map(s => ({ '@type': 'HowToStep', text: plain(s) })) },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: e.faq.concat([['What does it cost?', 'Nothing. No card and no trial that ends.']]).map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'MarginPad', item: 'https://marginpad.io/' }, { '@type': 'ListItem', position: 2, name: 'Trading journal', item: 'https://marginpad.io/trading-journal/' }, { '@type': 'ListItem', position: 3, name: e.name, item: 'https://marginpad.io/' + slug + '/' }] }
  ];
  const out = path.join(__dirname, '..', 'dist', slug, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, shell({ slug, title, desc, h1, body, ld, accent: e.color })); n++;
}

// /tradezella-alternative/
{
  const slug = 'tradezella-alternative';
  const title = 'Free TradeZella Alternative for Crypto Futures - Bybit, Binance, OKX, Hyperliquid | MarginPad';
  const desc = 'TradeZella costs $35 to $99 a month with no free plan. MarginPad Journal is free, built for crypto perpetuals - funding, liquidations, maker/taker fees - and connects Bybit, Binance, OKX, Bitget, BingX and Hyperliquid read-only.';
  const rows = [['Price', 'Free', '$35, $59 or $99 a month ($26-$74 billed yearly), no free plan'], ['Built for', 'Crypto perpetual futures', 'Stocks, futures and options first; crypto as an instrument type'], ['Exchanges named', 'Bybit, Binance, OKX, Bitget, BingX, Hyperliquid', 'None of these named on its pricing page'], ['Hyperliquid', 'Wallet address, no key', 'Not listed'], ['Funding', 'Per trade, from the exchange', 'Not stated'], ['Liquidations', 'Marked per trade, with what a stop would keep', 'Not stated'], ['P&L check', 'Reconciled against the exchange per trade', 'Not stated'], ['Key safety', 'Read-only verified with the exchange, IP-bound, encrypted', 'Read-only key recommended']];
  const body = `
<div class="crumb"><a href="/">MarginPad</a> / <a href="/trading-journal/">Trading journal</a> / TradeZella alternative</div>
<section class="hero" style="grid-template-columns:1fr"><div><h1>A free TradeZella alternative for crypto futures</h1></div></section>
<p class="lede">TradeZella is a capable journal for stock and futures traders, and it costs $35 to $99 a month. If you trade crypto perpetuals, the numbers that decide your month - funding, liquidations, maker versus taker - are the ones a general journal handles least. MarginPad Journal is built around them, connects your exchange read-only, and is free.</p>
<a class="cta" href="/trading-journal/">Open MarginPad Journal</a>
<h2>Side by side</h2>
<div class="card" style="overflow-x:auto"><table><tr><th></th><th>MarginPad Journal</th><th>TradeZella</th></tr>${rows.map(r => `<tr><th>${esc(r[0])}</th><td class="us">${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</table>
<p style="color:var(--mute);font-size:13.5px;margin:12px 0 0">TradeZella prices from tradezella.com/pricing, read on 18 November 2026. Check their page for current plans.</p></div>
<h2>When TradeZella is the better choice</h2>
<div class="card"><p style="margin:0">If most of your trading is US stocks, options or CME futures through a broker it integrates with, or you want its replay and backtesting tools, TradeZella covers that world and MarginPad Journal does not. If your trading is crypto perpetuals on the exchanges below, a journal that reads funding and liquidations from the exchange will tell you more, and costs nothing.</p></div>
<h2>Pick your exchange</h2>
${others('')}
`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url: 'https://marginpad.io/' + slug + '/', about: 'Trading journal comparison' },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [['Is there a free alternative to TradeZella?', 'Yes. MarginPad Journal is free and connects Bybit, Binance, OKX, Bitget, BingX and Hyperliquid read-only.'], ['How much does TradeZella cost?', 'Its pricing page lists $35, $59 and $99 a month, or $26 to $74 a month billed yearly, with no free plan (read 18 November 2026).'], ['Does MarginPad Journal handle funding and liquidations?', 'Yes. Funding is read from the exchange and attributed to each position, and liquidated trades are marked.']].map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }
  ];
  const out = path.join(__dirname, '..', 'dist', slug, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, shell({ slug, title, desc, h1: '', body, ld })); n++;
}
console.log('journal landings written:', n);
