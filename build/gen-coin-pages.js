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
    <span><a href="/">Calculators</a> · <a href="/blog/">Blog</a> · <a href="/glossary/">Glossary</a></span>
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
    <p class="lead">Find your exact <strong>${c.name} (${c.sym})</strong> liquidation price — for any leverage, long or short. Free, instant and private (it runs in your browser).</p>
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
    <p>${c.blurb} Liquidation happens when losses eat through the margin backing your position. The isolated-margin estimate is <code>Entry × (1 − 1/Leverage + MMR)</code> for a long and <code>Entry × (1 + 1/Leverage − MMR)</code> for a short, where <b>MMR</b> is the maintenance margin rate.</p>
    <h2>Worked example — 10× ${c.sym} long</h2>
    <p>A 10× ${c.sym} long entered at <code>$${fmt(c.entry)}</code> with a 0.5% maintenance margin rate is liquidated at about:</p>
    <div class="example">
      <div class="row"><span>Liquidation price</span><b>$${fmt(liq)}</b></div>
      <div class="row"><span>Move to liquidation</span><b>−${dist.toFixed(2)}%</b></div>
    </div>
    <p>Because ${c.sym} can move fast, keep your stop-loss well inside that level and size by risk. See <a href="/blog/crypto-position-sizing-risk-management/">how to size a position</a> and <a href="/blog/what-is-liquidation-in-crypto/">how to avoid liquidation</a>.</p>
    <h2>Other coins &amp; tools</h2>
    <div class="related">
      <a href="/#liq">All calculators</a>
      <a href="/funding-fee-calculator/">Funding fee</a>
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
