/* Per-coin liquidation calculator landing pages for long-tail SEO.
   Run: node build/gen-coin-pages.js */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');
const fmt = n => n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 5 : 2 });

const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const COINS = [
  { sym: 'BTC', name: 'Bitcoin', slug: 'btc', entry: 62000, lev: 125, blurb: 'Bitcoin has the deepest, most liquid perpetual-futures market in crypto, so spreads are tight and high leverage is widely available.' },
  { sym: 'ETH', name: 'Ethereum', slug: 'eth', entry: 1650, lev: 100, blurb: 'Ethereum perps are the second most traded contract after BTC, with deep liquidity across every major exchange.' },
  { sym: 'SOL', name: 'Solana', slug: 'sol', entry: 63, lev: 75, blurb: 'Solana is one of the most volatile large-cap perps — fast moves mean liquidation can arrive quicker than the number suggests.' },
  { sym: 'XRP', name: 'XRP', slug: 'xrp', entry: 1.1, lev: 75, blurb: 'XRP perps see sharp, news-driven spikes, so a generous liquidation buffer matters more than usual.' },
  { sym: 'BNB', name: 'BNB', slug: 'bnb', entry: 590, lev: 75, blurb: 'BNB futures are most liquid on Binance, where the token also pays a fee discount.' },
  { sym: 'DOGE', name: 'Dogecoin', slug: 'doge', entry: 0.08, lev: 75, blurb: 'Dogecoin is a high-beta meme perp — it can double or halve on sentiment, so high leverage is especially risky.' },
  { sym: 'ADA', name: 'Cardano', slug: 'ada', entry: 0.16, lev: 75, blurb: 'Cardano perps can trend hard for weeks; size for the move, not the candle.' },
  { sym: 'AVAX', name: 'Avalanche', slug: 'avax', entry: 6.5, lev: 75, blurb: 'Avalanche is a volatile large-cap alt where liquidation distance shrinks fast at high leverage.' },
  { sym: 'LINK', name: 'Chainlink', slug: 'link', entry: 11, lev: 75, blurb: 'Chainlink perps are popular among alt traders and move sharply around major partnership news.' },
  { sym: 'LTC', name: 'Litecoin', slug: 'ltc', entry: 70, lev: 75, blurb: 'Litecoin is an older, comparatively steady large-cap, but leverage still puts liquidation close to entry.' },
  { sym: 'TON', name: 'Toncoin', slug: 'ton', entry: 5.2, lev: 50, blurb: 'Toncoin perps have grown fast on the back of Telegram; liquidity is decent but thinner than the majors.' },
  { sym: 'TRX', name: 'TRON', slug: 'trx', entry: 0.13, lev: 75, blurb: 'TRON tends to grind rather than spike, but leverage still pins liquidation near entry.' },
  { sym: 'DOT', name: 'Polkadot', slug: 'dot', entry: 4.2, lev: 75, blurb: 'Polkadot is a liquid large-cap alt that can trend hard during alt-season rotations.' },
  { sym: 'MATIC', name: 'Polygon', slug: 'matic', entry: 0.4, lev: 75, blurb: 'Polygon perps are widely listed and move with broader L2 sentiment.' },
  { sym: 'SHIB', name: 'Shiba Inu', slug: 'shib', entry: 0.000018, lev: 50, blurb: 'Shiba Inu is a high-beta meme perp priced in tiny decimals — double-check your entry and size carefully.' },
  { sym: 'NEAR', name: 'NEAR Protocol', slug: 'near', entry: 4.5, lev: 50, blurb: 'NEAR is a volatile large-cap alt where liquidation distance shrinks quickly at high leverage.' },
  { sym: 'UNI', name: 'Uniswap', slug: 'uni', entry: 7, lev: 75, blurb: 'Uniswap is the bellwether DeFi perp and reacts sharply to governance and fee-switch news.' },
  { sym: 'APT', name: 'Aptos', slug: 'apt', entry: 7, lev: 50, blurb: 'Aptos perps can move fast on unlock schedules and ecosystem news.' },
  { sym: 'ICP', name: 'Internet Computer', slug: 'icp', entry: 9, lev: 50, blurb: 'Internet Computer is a high-volatility large-cap — give liquidation extra room.' },
  { sym: 'PEPE', name: 'Pepe', slug: 'pepe', entry: 0.0000095, lev: 50, blurb: 'Pepe is one of the most volatile meme perps; high leverage here is a fast way to get liquidated.' },
  { sym: 'BONK', name: 'Bonk', slug: 'bonk', entry: 0.00002, lev: 50, blurb: 'Bonk is a Solana meme perp with thin order books and violent intraday ranges — a small adverse move at high leverage is a liquidation, not a drawdown.' },
  { sym: 'FLOKI', name: 'Floki', slug: 'floki', entry: 0.0001, lev: 50, blurb: 'Floki trades like the other meme perps: liquidity comes and goes with attention, so liquidation clusters build fast on both sides.' },
  { sym: 'ORDI', name: 'ORDI', slug: 'ordi', entry: 12, lev: 50, blurb: 'ORDI, the Bitcoin BRC-20 token, follows BTC with a much bigger beta — the liquidation price sits closer than the leverage alone suggests.' },
  { sym: 'FIL', name: 'Filecoin', slug: 'fil', entry: 4.5, lev: 75, blurb: 'Filecoin perps trend with storage-narrative cycles and can swing hard.' },
  { sym: 'ARB', name: 'Arbitrum', slug: 'arb', entry: 0.65, lev: 75, blurb: 'Arbitrum moves with L2 flows and unlocks; liquidity is solid across exchanges.' },
  { sym: 'OP', name: 'Optimism', slug: 'op', entry: 1.5, lev: 75, blurb: 'Optimism perps track the broader L2 sector and react to airdrop/unlock events.' },
  { sym: 'INJ', name: 'Injective', slug: 'inj', entry: 18, lev: 50, blurb: 'Injective is a fast-moving DeFi large-cap; liquidation arrives quickly at high leverage.' },
  { sym: 'SUI', name: 'Sui', slug: 'sui', entry: 1.1, lev: 50, blurb: 'Sui is a volatile newer large-cap with sharp, liquidity-driven moves.' },
  { sym: 'SEI', name: 'Sei', slug: 'sei', entry: 0.4, lev: 50, blurb: 'Sei perps are volatile and thinner than the majors — keep leverage modest.' },
  { sym: 'TIA', name: 'Celestia', slug: 'tia', entry: 5.5, lev: 50, blurb: 'Celestia can move hard on unlocks and modular-narrative flows.' },
  { sym: 'ATOM', name: 'Cosmos', slug: 'atom', entry: 6.5, lev: 75, blurb: 'Cosmos is a liquid large-cap alt that trends with the wider IBC ecosystem.' },
  { sym: 'AAVE', name: 'Aave', slug: 'aave', entry: 95, lev: 50, blurb: 'Aave is the blue-chip DeFi lending perp and reacts to TVL and rate news.' },
  { sym: 'RNDR', name: 'Render', slug: 'rndr', entry: 6, lev: 50, blurb: 'Render rides the AI/compute narrative and can spike sharply on sentiment.' },
  { sym: 'HBAR', name: 'Hedera', slug: 'hbar', entry: 0.07, lev: 75, blurb: 'Hedera moves on enterprise-adoption news; perps are liquid on the majors.' },
  { sym: 'BCH', name: 'Bitcoin Cash', slug: 'bch', entry: 380, lev: 75, blurb: 'Bitcoin Cash is a higher-priced large-cap where small percent moves are big dollar moves.' },
  { sym: 'ETC', name: 'Ethereum Classic', slug: 'etc', entry: 22, lev: 75, blurb: 'Ethereum Classic often tracks ETH and BTC with extra volatility.' },
  { sym: 'WIF', name: 'dogwifhat', slug: 'wif', entry: 2.2, lev: 50, blurb: 'dogwifhat is a high-beta meme perp — expect violent swings and treat leverage with caution.' },
  { sym: 'FET', name: 'Artificial Superintelligence (FET)', slug: 'fet', entry: 1.3, lev: 50, blurb: 'FET rides the AI narrative and can move sharply on sector sentiment.' },
  { sym: 'HYPE', name: 'Hyperliquid', slug: 'hype', entry: 35, lev: 50, blurb: 'HYPE is one of the highest-volume newer perps; fast, news-driven moves make a liquidation buffer essential.' },
  { sym: 'WLD', name: 'Worldcoin', slug: 'wld', entry: 1.5, lev: 75, blurb: 'Worldcoin perps swing hard on token unlocks and headlines, so size for the move, not the candle.' },
  { sym: 'ENA', name: 'Ethena', slug: 'ena', entry: 0.5, lev: 75, blurb: 'Ethena is a high-beta DeFi perp; volatility around yield and unlocks pushes liquidation close at high leverage.' },
  { sym: 'XLM', name: 'Stellar', slug: 'xlm', entry: 0.25, lev: 75, blurb: 'Stellar is a liquid large-cap that can spike on payments-narrative news; give liquidation room.' },
  { sym: 'XMR', name: 'Monero', slug: 'xmr', entry: 160, lev: 50, blurb: 'Monero perps are thinner than the majors and move sharply around exchange-listing news.' },
  { sym: 'TAO', name: 'Bittensor', slug: 'tao', entry: 350, lev: 50, blurb: 'TAO is a volatile AI large-cap; high price and high beta mean liquidation arrives fast at leverage.' },
  { sym: 'ONDO', name: 'Ondo', slug: 'ondo', entry: 0.9, lev: 75, blurb: 'Ondo is the bellwether RWA perp and reacts to tokenisation and partnership headlines.' },
  { sym: 'ZEC', name: 'Zcash', slug: 'zec', entry: 45, lev: 50, blurb: 'Zcash perps are privacy-coin volatile and can gap on regulatory or listing news.' },
  { sym: 'JUP', name: 'Jupiter', slug: 'jup', entry: 0.6, lev: 75, blurb: 'Jupiter tracks Solana-ecosystem flows and moves on unlocks; keep leverage modest.' },
  { sym: 'ENS', name: 'Ethereum Name Service', slug: 'ens', entry: 22, lev: 50, blurb: 'ENS is a mid-cap DeFi perp that trends with Ethereum and governance news.' },
  { sym: 'RUNE', name: 'THORChain', slug: 'rune', entry: 3.5, lev: 50, blurb: 'THORChain is a volatile cross-chain DeFi large-cap; liquidation distance shrinks quickly at high leverage.' },
  { sym: 'GALA', name: 'Gala', slug: 'gala', entry: 0.025, lev: 75, blurb: 'Gala is a high-beta gaming perp priced in small decimals — double-check entry and size carefully.' },
  { sym: 'SAND', name: 'The Sandbox', slug: 'sand', entry: 0.35, lev: 75, blurb: 'The Sandbox moves with the metaverse/gaming narrative and broader alt sentiment.' },
  { sym: 'MANA', name: 'Decentraland', slug: 'mana', entry: 0.35, lev: 75, blurb: 'Decentraland is a liquid metaverse perp that can trend hard during sector rotations.' },
  { sym: 'AXS', name: 'Axie Infinity', slug: 'axs', entry: 5, lev: 50, blurb: 'AXS is a volatile gaming large-cap; unlock schedules and ecosystem news drive sharp moves.' },
  { sym: 'IMX', name: 'Immutable', slug: 'imx', entry: 1.2, lev: 75, blurb: 'Immutable tracks the gaming-L2 narrative and reacts to partnerships and unlocks.' },
  { sym: 'STX', name: 'Stacks', slug: 'stx', entry: 1.6, lev: 50, blurb: 'Stacks moves with the Bitcoin-L2 narrative and can spike around upgrades.' },
  { sym: 'ALGO', name: 'Algorand', slug: 'algo', entry: 0.18, lev: 75, blurb: 'Algorand is a liquid large-cap alt that trends during alt-season rotations.' },
  { sym: 'KAS', name: 'Kaspa', slug: 'kas', entry: 0.1, lev: 50, blurb: 'Kaspa is a high-beta proof-of-work perp priced in small decimals; size carefully.' },
  { sym: 'CRV', name: 'Curve DAO', slug: 'crv', entry: 0.5, lev: 75, blurb: 'Curve is a core DeFi perp that reacts sharply to fee-switch and governance news.' },
  { sym: 'MKR', name: 'Maker', slug: 'mkr', entry: 1500, lev: 50, blurb: 'Maker is a high-priced DeFi blue chip; even small percentage moves are large in dollar terms.' },
  { sym: 'GRT', name: 'The Graph', slug: 'grt', entry: 0.1, lev: 75, blurb: 'The Graph is a liquid infrastructure perp that moves with broader alt sentiment.' },
  { sym: 'APE', name: 'ApeCoin', slug: 'ape', entry: 1.1, lev: 75, blurb: 'ApeCoin is a high-beta NFT-ecosystem perp that swings on sentiment and unlocks.' },
];

const pctf = n => n + '%';
// leverage → liquidation-distance table (isolated-margin estimate)
function levTable(mmr, maxLev) {
  const rows = [5, 10, 25, 50, 100].filter(l => l <= maxLev);
  const cells = rows.map(l => {
    const dist = (1 / l - mmr / 100) * 100;
    return `<tr><td>${l}×</td><td>−${dist.toFixed(2)}%</td><td>${(100 / l).toFixed(2)}%</td></tr>`;
  }).join('');
  return `<table class="lvtab"><thead><tr><th>Leverage</th><th>Move to liquidation</th><th>Initial margin</th></tr></thead><tbody>${cells}</tbody></table>`;
}
const EXTRA_CSS = `<style>
  .lvtab{width:100%;border-collapse:collapse;margin:14px 0 18px;font-size:14px}
  .lvtab th,.lvtab td{padding:10px 13px;border-bottom:1px solid var(--line);text-align:left}
  .lvtab th{font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-dim)}
  .lvtab td{font-family:'Space Mono',monospace;color:var(--ink)}
  .lvtab td:first-child{font-family:'Bricolage Grotesque',sans-serif;font-weight:700}
  @media(max-width:600px){.lvtab{display:block;overflow-x:auto;white-space:nowrap}}
  .mprl{margin:22px 0 8px}
  .mprl-t{display:flex;align-items:center;gap:10px;font-family:'Space Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.24em;color:#5c656f;margin-bottom:9px;white-space:nowrap}
  .mprl-t::before{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,#28303c)}
  .mprl-t::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,#28303c,transparent)}
  .mprl-row{display:flex;border:1px solid #262e3a;border-radius:13px;overflow:hidden;background:#0c0f13}
  .mprl-c{position:relative;flex:1;display:flex;align-items:center;gap:9px;min-width:0;padding:12px 12px 12px 15px;text-decoration:none;color:#e9e7df;transition:background .16s}
  .mprl-c::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px}
  .mprl-by::before{background:#f7a600}
  .mprl-mn::before{background:linear-gradient(180deg,#8a5cff,#c2f64a)}
  .mprl-cut{width:1px;background:#262e3a;transform:skewX(-14deg);flex-shrink:0}
  .mprl-k{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:13.5px;flex-shrink:0}
  .mprl-by .mprl-k{color:#f7a600}
  .mprl-mn .mprl-k{color:#cdb7ff}
  .mprl-d{font-size:11px;color:#8b95a1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
  .mprl-a{color:#5c656f;flex-shrink:0;font-weight:700;transition:transform .16s,color .16s}
  .mprl-c:hover{background:#12161c}
  .mprl-c:hover .mprl-a{transform:translateX(3px);color:#e9e7df}
  .mprl-c img{border-radius:5px;flex-shrink:0;display:block}
  @media(max-width:520px){.mprl-row{flex-direction:column}.mprl-cut{width:auto;height:1px;transform:none}}
</style>`;

function head(o) {
  return `<!DOCTYPE html>
<html lang="en">
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${o.title} | MarginPad</title>
<meta name="description" content="${o.desc}" />
<meta name="keywords" content="${o.keywords}" />
<link rel="canonical" href="${o.url}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#0a0b0d" />
<meta property="og:title" content="${o.title}" />
<meta property="og:description" content="${o.desc}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${o.url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Familjen+Grotesk:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/assets/blog.css" />
${EXTRA_CSS}
${o.ld}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://marginpad.io/"},{"@type":"ListItem","position":2,"name":"${o.bcName}","item":"${o.url}"}]}</script>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="/">Calculators</a><a href="/blog/">Blog</a><a href="/glossary/">Glossary</a></nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / ${o.crumb}</div>
  <article>`;
}
function foot() {
  return `  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="/">Calculators</a> · <a href="/blog/">Blog</a> · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a> · <a href="/glossary/">Glossary</a></span>
  </footer>
</div>
<script src="/assets/liqcalc.js"></script>
</body>
</html>
`;
}

function coinPage(c) {
  const mmr = 0.5, url = `https://marginpad.io/${c.slug}-liquidation-calculator/`;
  const liq = c.entry * (1 - 1 / 10 + mmr / 100), dist = (1 / 10 - mmr / 100) * 100;
  const title = `${c.sym} Liquidation Calculator — ${c.name} Futures (Long & Short)`;
  const desc = `Free ${c.sym} liquidation calculator. Find the exact ${c.name} liquidation price for any leverage and position, long or short. Instant, private, no signup.`;
  const others = COINS.filter(x => x.slug !== c.slug).slice(0, 6);
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"${c.sym} Liquidation Calculator","applicationCategory":"FinanceApplication","operatingSystem":"Any (web browser)","url":"${url}","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":"${desc}"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How do I calculate ${c.sym} liquidation price?","acceptedAnswer":{"@type":"Answer","text":"Enter your ${c.sym} entry price, leverage and direction. Liquidation = Entry x (1 - 1/Leverage + MMR) for a long and Entry x (1 + 1/Leverage - MMR) for a short."}},{"@type":"Question","name":"At what percentage is a ${c.sym} position liquidated?","acceptedAnswer":{"@type":"Answer","text":"Roughly 1/Leverage minus the maintenance margin. A 10x ${c.sym} position is liquidated after about a 9-10% move; 100x after about 1%."}}]}</script>`;
  return head({ title, desc, url, crumb: `${c.sym} liquidation calculator`, bcName: `${c.sym} Liquidation Calculator`, ld,
    keywords: `${c.slug} liquidation calculator, ${c.name.toLowerCase()} liquidation calculator, ${c.slug} liquidation price, ${c.slug} futures calculator, ${c.slug} leverage calculator` })
    + `
    <h1>${c.sym} Liquidation Calculator</h1>
    <p class="lead"><strong>The quick answer:</strong> a ${c.name} (${c.sym}) long is liquidated roughly <strong>1 ÷ leverage</strong> below your entry (minus a ~0.5% maintenance margin) — about <strong>${dist.toFixed(1)}% at 10×</strong>, ~3.5% at 25× and ~0.5% at 100×; shorts mirror the same distance above entry. The calculator below gives your exact price for any entry, leverage and side — free, instant and private (it runs in your browser).</p>
    <p style="font-family:'Space Mono',monospace;font-size:13px;color:var(--ink-dim);margin:-4px 0 16px" id="livePx" data-sym="${c.sym}"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2ebd85;margin-right:7px;vertical-align:middle"></span>Live ${c.sym} price loading…</p>
    <div class="calc">
      <div class="calc-in">
        <div class="seg" id="liqSeg"><button class="on" data-side="long">Long</button><button data-side="short">Short</button></div>
        <label>Entry price (USD)</label><input id="liqEntry" type="number" value="${c.entry}" step="any">
        <label>Leverage</label><input id="liqLev" type="number" value="10" step="any">
        <label>Maintenance margin rate (%)</label><input id="liqMmr" type="number" value="${mmr}" step="any">
      </div>
      <div class="calc-out">
        <div class="col">Estimated ${c.sym} liquidation price</div><div class="big" id="liqOut">—</div>
        <div class="rr"><span>Distance from entry</span><b id="liqDist">—</b></div>
      </div>
    </div>
    <h2>How ${c.sym} liquidation works</h2>
    <p>${c.blurb} Liquidation happens when losses eat through the margin backing your position — the exchange force-closes it to stop the loss going past your collateral. The isolated-margin estimate is <code>Entry × (1 − 1/Leverage + MMR)</code> for a long and <code>Entry × (1 + 1/Leverage − MMR)</code> for a short, where <b>MMR</b> is the maintenance margin rate (about 0.5% on most ${c.sym} perpetuals). ${c.sym} futures list up to <b>${c.lev}× leverage</b> across the major venues, but the headline cap is a trap: the higher you go, the closer liquidation sits to your entry.</p>

    <h2>${c.sym} liquidation distance by leverage</h2>
    <p>How far ${c.name} has to move against an isolated-margin long before it is liquidated, at a 0.5% maintenance margin:</p>
    ${levTable(0.5, c.lev)}
    <p>At 100× a move of just ~1% wipes the position; at 5× you get roughly ${((1 / 5 - 0.005) * 100).toFixed(1)}% of room. Because ${c.name} routinely moves several percent in a session, most traders who last keep ${c.sym} leverage in the low-to-mid range and let the position breathe.</p>

    <h2>Worked example — 10× ${c.sym} long</h2>
    <p>A 10× ${c.sym} long entered at <code>$${fmt(c.entry)}</code> with a 0.5% maintenance margin rate is liquidated at about:</p>
    <div class="example">
      <div class="row"><span>Liquidation price</span><b>$${fmt(liq)}</b></div>
      <div class="row"><span>Move to liquidation</span><b>−${dist.toFixed(2)}%</b></div>
    </div>
    <p>Enter your own numbers above — the calculator prefills the <b>live ${c.sym} price</b>, so you can see exactly where a real position would be wiped right now. Set your stop-loss comfortably inside that level and size by risk.</p>

    <h2>Common ways ${c.sym} traders get liquidated</h2>
    <ul>
      <li><b>Chasing max leverage.</b> ${c.lev}× on ${c.sym} means a ~${(100 / c.lev).toFixed(2)}% wick against you is game over — and ${c.sym} prints wicks like that regularly.</li>
      <li><b>No stop-loss.</b> Without a stop, the exchange's liquidation engine becomes your exit — at the worst possible price, plus a liquidation fee.</li>
      <li><b>Ignoring funding.</b> On a crowded ${c.sym} trade, funding drains your margin every 8 hours, nudging liquidation closer than the raw price math shows.</li>
      <li><b>Sizing by dollars, not risk.</b> Size from your stop distance instead — see the <a href="/calculators?c=size">position-size calculator</a>.</li>
    </ul>

    <h2>See ${c.sym} liquidations happen live</h2>
    <p>Numbers are one thing; watching real leverage get wiped is another. The <a href="/liquidations/">live liquidations feed</a> and the <a href="/rekt/">Rekt ticker</a> show ${c.sym} longs and shorts being force-closed across nine exchanges (Binance, Bybit, OKX, Hyperliquid, Gate, HTX, dYdX, BitMEX, Bitfinex) in real time — a spike in long liquidations often marks local capitulation, a spike in shorts a squeeze. Then rehearse the trade with zero risk on the <a href="/paper-trade?coin=${c.sym}">${c.sym} paper-trading terminal</a> at the live price, and screen the whole market on the <a href="/screener">futures screener</a>.</p>

    <div class="mprl"><div class="mprl-t">TRADE ${c.sym} FOR REAL</div><div class="mprl-row">
      <a class="mprl-c mprl-by" data-ex="Bybit" href="https://www.bybit.com/invite?ref=LZKBERJ" target="_blank" rel="sponsored noopener noreferrer"><span class="mprl-k">Bybit</span><span class="mprl-d">${c.sym} futures · up to ${c.lev}× · deep liquidity</span><span class="mprl-a">&rarr;</span></a>
      <i class="mprl-cut"></i>
      <a class="mprl-c mprl-mn" data-ex="Moon" href="https://moon.com/?c=moonkickstart" target="_blank" rel="sponsored noopener noreferrer"><img src="/assets/moon.png" alt="" width="18" height="18" loading="lazy"><span class="mprl-k">Moon</span><span class="mprl-d">Call ${c.sym} up or down · 24/7</span><span class="mprl-a">&rarr;</span></a>
    </div></div>

    <h2>FAQ</h2>
    <h3>At what percentage is a ${c.sym} position liquidated?</h3>
    <p>Roughly 1 ÷ leverage, minus the maintenance margin. A 10× ${c.sym} position is liquidated after about a 9–10% adverse move; 25× after ~4%; 100× after ~1%.</p>
    <h3>Does the ${c.sym} liquidation price change with position size?</h3>
    <p>For <b>isolated</b> margin, no — the liquidation price depends on entry, leverage and MMR, not on how big the position is. For <b>cross</b> margin your whole wallet balance backs the trade, which pushes liquidation further away; model that with the <a href="/calculators?c=cross">cross-margin calculator</a>.</p>
    <h3>Is this ${c.sym} liquidation calculator accurate?</h3>
    <p>It uses the standard isolated-margin formula and your exchange's maintenance margin. Real liquidation can differ slightly because of fees, funding and tiered maintenance margin on very large positions — treat the figure as a close estimate and leave a buffer.</p>

    <h2>Other coins &amp; tools</h2>
    <div class="related">
      <a href="/calculators?c=liq">All calculators</a>
      <a href="/funding-fee-calculator/">Funding fee</a>
      <a href="/paper-trade?coin=${c.sym}">Paper-trade ${c.sym}</a>
      ${others.map(o => `<a href="/${o.slug}-liquidation-calculator/">${o.sym} liquidation</a>`).join('\n      ')}
    </div>
    <p style="font-size:12.5px;color:var(--ink-faint);margin-top:24px">Educational tool, not financial advice. Estimates exclude fees and funding and may differ from your exchange.</p>
<script>(function(){var el=document.getElementById('livePx');if(!el)return;var sym=el.getAttribute('data-sym');fetch('/api/price?symbol='+sym).then(function(r){return r.ok?r.json():null;}).then(function(d){if(d&&d.price>0){var p=+d.price;el.innerHTML='<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#2ebd85;margin-right:7px;vertical-align:middle"></span>Live '+sym+' price: <b style="color:#c2f64a">$'+p.toLocaleString('en-US',{maximumFractionDigits:p>=1?2:6})+'</b>';var e=document.getElementById('liqEntry');if(e){e.value=p;e.dispatchEvent(new Event('input'));}}else{el.style.display='none';}}).catch(function(){el.style.display='none';});})();</script>
`
    + foot();
}

let n = 0;
for (const c of COINS) {
  const d = path.join(OUT, `${c.slug}-liquidation-calculator`);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'index.html'), coinPage(c));
  n++;
  console.log('wrote', c.slug + '-liquidation-calculator');
}
// keep sitemap.xml in sync — add any missing coin-calculator URLs
try {
  const smp = path.join(OUT, 'sitemap.xml');
  let sm = fs.readFileSync(smp, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  let added = 0;
  for (const c of COINS) {
    const loc = `https://marginpad.io/${c.slug}-liquidation-calculator/`;
    if (sm.indexOf(loc) === -1) {
      sm = sm.replace('</urlset>', `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n</urlset>`);
      added++;
    }
  }
  if (added) { fs.writeFileSync(smp, sm); console.log('sitemap: +' + added + ' coin URLs'); }
} catch (e) { console.log('sitemap update skipped:', e.message); }
console.log('done:', n, 'coin pages');
