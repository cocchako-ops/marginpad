/* /guides/<slug>/ — short, tool-focused how-to guides for informational SEO (funnel to the data tools).
   Run: node build/gen-guides-pages.js  (wired into build/build.js). */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');

const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const GUIDES = [
  {
    slug: 'how-to-read-funding-rates',
    title: 'How to Read Crypto Funding Rates',
    desc: 'A plain-English guide to perpetual funding rates: what positive and negative funding mean, how to spot crowded longs and shorts, and how to use funding extremes.',
    tool: { href: '/funding/', label: 'Live funding scanner' },
    body: `<h2>What a funding rate is</h2><p>On a perpetual future there is no expiry, so exchanges use a small recurring payment — the <strong>funding rate</strong> — to keep the perp price tethered to spot. It is usually exchanged every 8 hours between longs and shorts.</p>
<h2>Positive vs negative funding</h2><p><strong>Positive funding</strong> means the perp trades above spot, so <em>longs pay shorts</em> — the market is leaning long. <strong>Negative funding</strong> means the perp trades below spot, so <em>shorts pay longs</em> — the market is leaning short.</p>
<h2>Reading extremes</h2><p>When funding is very positive, longs are crowded and paying a premium to hold; a stall in price can trigger a <strong>long squeeze</strong>. When funding is deeply negative, shorts are crowded and a bounce can force a <strong>short squeeze</strong>. Funding is strongest as a signal alongside <a href="/open-interest/">open interest</a> and <a href="/long-short/">long/short positioning</a>.</p>
<h2>Watch the cost</h2><p>At high leverage the funding cost compounds fast and can quietly drain a position even when price is flat. Always factor it into your hold time.</p>`,
    faq: [['What does a high funding rate mean?', 'High positive funding means the market is heavily long and longs are paying to hold — a sign of crowded longs that can fuel a short squeeze on a pullback.'], ['Is negative funding bullish?', 'Negative funding means shorts are crowded and paying longs. It is often read contrarily as a setup for a squeeze higher, but it is one signal among funding, open interest and price.']],
  },
  {
    slug: 'how-to-read-liquidations',
    title: 'How to Read Crypto Liquidations',
    desc: 'Understand crypto liquidations: what they are, the difference between long and short liquidations, and how liquidation cascades drive volatility.',
    tool: { href: '/liquidations/', label: 'Live liquidations tracker' },
    body: `<h2>What a liquidation is</h2><p>A <strong>liquidation</strong> is when an exchange force-closes a leveraged position because the trader's margin can no longer cover the loss. The position is closed at market and the trader loses their margin. At high leverage the liquidation price sits very close to entry.</p>
<h2>Long vs short liquidations</h2><p><strong>Long liquidations</strong> are over-leveraged buyers wiped out when price falls. <strong>Short liquidations</strong> are sellers wiped out when price rises. A big one-sided spike often marks a local extreme — a flush of long liquidations can mark a bottom, a wave of short liquidations can fuel a rally.</p>
<h2>Liquidation cascades</h2><p>Liquidations act like fuel. When price hits a zone packed with leverage, the forced orders push price further, triggering more liquidations — a <strong>cascade</strong>. Watching where leverage is heaviest helps you avoid the crowded trade.</p>
<h2>Use it with the rest</h2><p>Pair liquidations with <a href="/funding/">funding</a> and <a href="/open-interest/">open interest</a>: a drop in open interest usually follows a cascade as leverage is flushed.</p>`,
    faq: [['What causes a liquidation?', 'A position is liquidated when price moves against it far enough that the margin can no longer cover the loss, so the exchange closes it automatically.'], ['Are long or short liquidations bullish?', 'A spike of long liquidations (on a drop) can mark a local bottom; a spike of short liquidations (on a rally) can fuel a squeeze higher.']],
  },
  {
    slug: 'what-is-open-interest',
    title: 'What Is Open Interest in Crypto?',
    desc: 'Open interest explained: how it differs from volume, what rising and falling OI signal, and how to read OI alongside price.',
    tool: { href: '/open-interest/', label: 'Live open interest tracker' },
    body: `<h2>Open interest vs volume</h2><p><strong>Open interest (OI)</strong> is the total value of all open perpetual-futures positions on a coin. Unlike volume — which counts every trade — OI measures how much leverage is currently <em>open</em> in the market.</p>
<h2>Rising and falling OI</h2><p>Rising OI means new positions and fresh leverage are entering. Falling OI means traders are closing out. A sudden drop in OI usually follows a <a href="/liquidations/">liquidation cascade</a> as over-leveraged positions get flushed.</p>
<h2>Reading OI with price</h2><p><strong>Price up + OI up</strong> = new money backing the move (stronger trend). <strong>Price up + OI down</strong> = short covering rather than fresh demand. Heavy OI build-up plus one-sided <a href="/funding/">funding</a> flags a crowded, fragile setup.</p>`,
    faq: [['Is high open interest bullish or bearish?', 'Neither on its own — it depends on price. Rising OI with rising price suggests new buyers; rising OI with falling price suggests new sellers.'], ['What does falling open interest mean?', 'Falling OI means positions are being closed, often after a liquidation cascade flushes leverage out of the market.']],
  },
  {
    slug: 'long-short-ratio-explained',
    title: 'Crypto Long/Short Ratio Explained',
    desc: 'What the long/short ratio tells you about trader positioning, how to read crowded extremes, and why it is best used contrarily.',
    tool: { href: '/long-short/', label: 'Live long/short ratio' },
    body: `<h2>What it measures</h2><p>The <strong>long/short ratio</strong> shows what percentage of traders' accounts are positioned long versus short on a coin. It is a snapshot of crowd positioning and sentiment.</p>
<h2>Reading the crowd</h2><p>Experienced traders often read extremes <strong>contrarily</strong>. When most accounts are already long, the buying is largely spent and the crowd is exposed to a <strong>long squeeze</strong>. When the crowd is heavily short, a bounce can force a <strong>short squeeze</strong>.</p>
<h2>One signal, not the whole picture</h2><p>A crowded book can stay crowded while a trend runs. Combine the ratio with <a href="/funding/">funding</a> (what the crowd pays to hold) and <a href="/liquidations/">liquidations</a> (where leverage is flushed) before acting.</p>`,
    faq: [['What is a good long/short ratio?', 'There is no single good value — it is most useful at extremes. A very high long share warns of crowded longs; a very high short share warns of crowded shorts.'], ['How do traders use the long/short ratio?', 'Many read it contrarily: fading the over-positioned side, and always confirming with funding, open interest and price action.']],
  },
  {
    slug: 'what-is-liquidation-price',
    title: 'What Is a Liquidation Price in Crypto?',
    desc: 'What a liquidation price is, how leverage moves it closer to your entry, and how to calculate it before you open a position.',
    tool: { href: '/btc-liquidation-calculator/', label: 'Liquidation price calculator' },
    body: `<h2>What it is</h2><p>Your <strong>liquidation price</strong> is the price at which an exchange force-closes your leveraged position because your margin can no longer cover the loss. Cross it and you lose your margin. Knowing it before you enter is the single most important number in leveraged trading.</p>
<h2>How leverage moves it</h2><p>The higher your leverage, the closer the liquidation price sits to your entry. At 5× a long is liquidated on roughly a 20% drop; at 100× it is roughly a 1% move. That is why high leverage is so fragile — an ordinary wick can wipe a position.</p>
<h2>How it is calculated</h2><p>For an isolated long, liquidation ≈ entry × (1 − 1/leverage + maintenance-margin rate); shorts flip the sign. The exact figure depends on the exchange's maintenance margin and fees, so confirm it with a <a href="/btc-liquidation-calculator/">liquidation calculator</a> for your coin and leverage.</p>
<h2>Give it room</h2><p>Set your size and leverage so the liquidation price sits beyond the noise — past obvious support and resistance and recent wicks — not on top of your entry. See also <a href="/guides/how-to-avoid-liquidation/">how to avoid liquidation</a>.</p>`,
    faq: [['How is liquidation price calculated?', 'Roughly, liquidation ≈ entry × (1 − 1/leverage + maintenance margin) for a long, with shorts reversed. The precise value depends on the maintenance-margin rate and fees of the exchange.'], ['Does higher leverage mean a closer liquidation price?', 'Yes. At 100× the liquidation price is only about 1% from entry, while at 5× it is closer to 20% — higher leverage leaves almost no room for price to move against you.']],
  },
  {
    slug: 'isolated-vs-cross-margin',
    title: 'Isolated vs Cross Margin Explained',
    desc: 'The difference between isolated and cross margin, the risk trade-off, and which mode suits which style of trader.',
    tool: { href: '/paper-trade', label: 'Practice on Paper Trade' },
    body: `<h2>Isolated margin</h2><p>In <strong>isolated margin</strong>, only the margin you assign to a position is at risk. If it liquidates, the loss is capped at that margin and the rest of your balance is untouched. It is the safer default for high-leverage trades.</p>
<h2>Cross margin</h2><p>In <strong>cross margin</strong>, your whole account balance backs the position. That pushes the liquidation price further away, but a single bad trade can drain the entire account, not just one position's margin.</p>
<h2>Which to use</h2><p>Most traders use <strong>isolated</strong> for defined-risk, high-leverage setups, and <strong>cross</strong> for lower-leverage positions they actively manage or hedge. The trade-off: isolated caps your loss; cross lowers liquidation risk but raises your maximum loss. Either way, check the <a href="/guides/what-is-liquidation-price/">liquidation price</a> first.</p>`,
    faq: [['Is isolated or cross margin safer?', 'Isolated is safer for capping losses — only the assigned margin is at risk. Cross margin is harder to liquidate but puts your whole balance on the line.'], ['When should I use cross margin?', 'Cross suits lower-leverage positions you actively manage or hedge, where you want the trade to survive volatility without topping up margin.']],
  },
  {
    slug: 'how-to-calculate-position-size',
    title: 'How to Calculate Position Size in Crypto',
    desc: 'Size every trade by risk, not gut feel: how to work out position size from your account, stop distance and risk per trade.',
    tool: { href: '/calculators?c=size', label: 'Position size calculator' },
    body: `<h2>Risk first, size second</h2><p>Professional sizing starts from one number: how much you are willing to lose on the trade. A common rule is to risk <strong>1–2% of your account per trade</strong>. Your position size then follows from your stop distance.</p>
<h2>The formula</h2><p>Position size = (account × risk %) ÷ (stop distance %). If you risk $20 and your stop is 2% away, you take $1,000 of exposure — regardless of leverage. Leverage only sets the margin required, not your risk.</p>
<h2>Leverage is not risk</h2><p>This is the point most beginners miss: your risk is set by size and stop, not by leverage. 10× on a small, well-stopped position can be far safer than 2× on an oversized one. Use a <a href="/calculators?c=size">position size calculator</a> so every trade risks the same amount, and keep an eye on your <a href="/guides/what-is-liquidation-price/">liquidation price</a>.</p>`,
    faq: [['How much should I risk per trade?', 'A widely used guideline is 1–2% of your account per trade, so a run of losses cannot blow up the account.'], ['Does leverage change my position size?', 'No — your risk is set by position size and stop distance. Leverage only determines the margin needed to hold that position.']],
  },
  {
    slug: 'what-is-leverage-in-crypto',
    title: 'What Is Leverage in Crypto Trading?',
    desc: 'Leverage explained simply: how 10× or 100× works, what it does to your liquidation price, and how to use it without blowing up.',
    tool: { href: '/btc-liquidation-calculator/', label: 'Liquidation calculator' },
    body: `<h2>What leverage does</h2><p><strong>Leverage</strong> lets you control a position larger than your margin. At 10× a $100 margin controls $1,000 of exposure, so a 1% move becomes a 10% swing on your margin — gains and losses are both magnified.</p>
<h2>The catch: liquidation</h2><p>The flip side is your <a href="/guides/what-is-liquidation-price/">liquidation price</a>. The higher the leverage, the smaller the move that wipes you out — roughly 1% at 100×, 2% at 50×, 10% at 10×. Magnified upside comes with magnified fragility.</p>
<h2>Using it sensibly</h2><p>Leverage is a tool for capital efficiency, not a number to max out. Size by <a href="/guides/how-to-calculate-position-size/">risk</a>, keep the liquidation price beyond the noise, and remember funding costs scale with position size, not margin.</p>`,
    faq: [['What does 10x leverage mean?', '10× means your position is ten times your margin: $100 controls $1,000, so a 1% price move equals a 10% move on your margin — in both directions.'], ['Is high leverage bad?', 'High leverage is not inherently bad, but it puts your liquidation price very close to entry. Most blow-ups come from oversizing at high leverage, not from leverage itself.']],
  },
  {
    slug: 'maker-vs-taker-fees',
    title: 'Maker vs Taker Fees Explained',
    desc: 'What maker and taker fees are, why takers pay more, and how the difference adds up for active futures traders.',
    tool: { href: '/lowest-fee-crypto-exchange/', label: 'Compare exchange fees' },
    body: `<h2>The difference</h2><p>A <strong>maker</strong> order adds liquidity to the book — a limit order that rests and waits to be filled. A <strong>taker</strong> order removes liquidity — a market order, or a limit that fills instantly, that takes an existing offer. Exchanges charge takers more because makers provide the liquidity everyone trades against.</p>
<h2>Typical rates</h2><p>On major USDT perpetuals, maker fees are around 0.02% and taker fees 0.04–0.06%. It sounds tiny, but a day trader doing dozens of round trips pays it again and again — and takers pay it on both sides.</p>
<h2>How to pay less</h2><p>Use resting <strong>limit orders</strong> to qualify for the maker fee where you can, hold the exchange token for a discount, and climb the VIP tiers as volume grows. If fees are your priority, <a href="/lowest-fee-crypto-exchange/">compare exchanges by taker fee</a> first.</p>`,
    faq: [['Why do takers pay more than makers?', 'Takers remove liquidity by filling existing orders, while makers add liquidity by resting orders on the book. Exchanges reward makers with lower fees because they keep the market liquid.'], ['How do I pay maker fees?', 'Place limit orders that rest on the book instead of market orders that fill instantly. If your order waits to be matched, it qualifies for the lower maker fee.']],
  },
  {
    slug: 'how-to-avoid-liquidation',
    title: 'How to Avoid Liquidation in Crypto Trading',
    desc: 'Practical ways to keep a leveraged position from being liquidated — from sizing and stops to margin mode and funding.',
    tool: { href: '/btc-liquidation-calculator/', label: 'Check your liquidation price' },
    body: `<h2>Know the price before you enter</h2><p>Calculate your <a href="/guides/what-is-liquidation-price/">liquidation price</a> first and make sure it sits beyond recent wicks and obvious support and resistance — not right next to your entry.</p>
<h2>Use less leverage than you can</h2><p>Just because a venue offers 125× does not mean you should use it. Lower leverage pushes the liquidation price further from entry and buys you room to be right over time.</p>
<h2>Always set a stop-loss</h2><p>A stop closes you out at a price <em>you</em> choose, before the exchange's liquidation engine does it for you at a worse one.</p>
<h2>Size by risk</h2><p>Risk a fixed 1–2% per trade using a <a href="/guides/how-to-calculate-position-size/">position size calculator</a>, so no single trade can do real damage.</p>
<h2>Prefer isolated margin</h2><p><a href="/guides/isolated-vs-cross-margin/">Isolated margin</a> caps the loss to one position. Add margin deliberately, not in a panic.</p>
<h2>Mind funding</h2><p>At high leverage, <a href="/funding/">funding</a> quietly drains a position even when price is flat — factor it into long holds.</p>`,
    faq: [['What is the best way to avoid liquidation?', 'Use lower leverage, always set a stop-loss, size by a fixed risk percentage, and keep your liquidation price well beyond recent volatility.'], ['Does a stop-loss prevent liquidation?', 'A stop-loss closes your position at your chosen price before the exchange liquidation would trigger, so in practice it prevents most liquidations — provided it fills in fast markets.']],
  },
  {
    slug: 'perpetual-vs-futures',
    title: 'Perpetual vs Futures: What Is the Difference?',
    desc: 'Perpetual swaps versus dated futures: expiry, funding, and why perps dominate crypto leverage trading.',
    tool: { href: '/funding/', label: 'Live funding scanner' },
    body: `<h2>Dated futures</h2><p>A traditional <strong>futures contract</strong> has an expiry date. On that date it settles to the spot price, so the contract price converges to spot as expiry approaches. You trade it for a fixed term, then it is gone.</p>
<h2>Perpetual swaps</h2><p>A <strong>perpetual</strong> ("perp") never expires. To keep its price tethered to spot without an expiry, exchanges use a recurring <a href="/funding/">funding payment</a> between longs and shorts. That mechanism replaces settlement.</p>
<h2>Why perps dominate crypto</h2><p>Perps let traders hold leverage indefinitely with no rollover, which is why they make up the vast majority of crypto derivatives volume. The trade-off is funding: at high leverage it can quietly drain a position even when price is flat.</p>`,
    faq: [['Do perpetual contracts expire?', 'No. Perpetual swaps never expire — a recurring funding payment keeps their price tied to spot instead of a settlement date.'], ['What is the difference between futures and perpetuals?', 'Dated futures settle on an expiry date, while perpetuals run indefinitely and use funding payments to stay near spot. Crypto trading is dominated by perpetuals.']],
  },
  {
    slug: 'long-vs-short-crypto',
    title: 'Going Long vs Short in Crypto Explained',
    desc: 'What it means to go long or short with leverage, how each side makes or loses money, and how liquidation differs.',
    tool: { href: '/paper-trade', label: 'Practice long & short' },
    body: `<h2>Going long</h2><p>A <strong>long</strong> bets that price will rise. You profit as price goes up and lose as it falls. A long is liquidated when price drops far enough that your margin can no longer cover the loss.</p>
<h2>Going short</h2><p>A <strong>short</strong> bets that price will fall. You profit as price drops and lose as it rises — shorting lets you make money in a downtrend. A short is liquidated when price rises far enough against you.</p>
<h2>The risk is not symmetric</h2><p>A long can only fall to zero, but a short has unlimited theoretical loss if price keeps rising — which is why short squeezes can be violent. Either way, leverage sets how close your <a href="/guides/what-is-liquidation-price/">liquidation price</a> sits to entry. Test both sides risk-free on <a href="/paper-trade">Paper Trade</a>.</p>`,
    faq: [['What does going short mean in crypto?', 'Shorting means betting that price will fall: you profit when it drops and lose when it rises, which lets you make money in a downtrend.'], ['Is shorting riskier than going long?', 'A short has unlimited theoretical loss if price keeps rising, while a long can only fall to zero — so an unhedged short can be riskier, and short squeezes can be sharp.']],
  },
  {
    slug: 'what-is-mark-price',
    title: 'What Is Mark Price in Crypto Futures?',
    desc: 'Why exchanges liquidate on mark price, not last price, and how it protects you from being wicked out by a thin order book.',
    tool: { href: '/btc-liquidation-calculator/', label: 'Liquidation calculator' },
    body: `<h2>Last price vs mark price</h2><p>The <strong>last price</strong> is simply the most recent trade on that exchange. The <strong>mark price</strong> is a fairer reference — usually built from an index of several spot markets plus a funding basis — that smooths out single-exchange spikes.</p>
<h2>Why it matters</h2><p>Exchanges calculate your unrealised PnL and your <a href="/guides/what-is-liquidation-price/">liquidation</a> against the <strong>mark price</strong>, not the last price. This protects you from being liquidated by a brief wick on a thin book that does not reflect the true market.</p>
<h2>What to watch</h2><p>In fast markets the last price can spike well past the mark price. Your position is judged on the mark, so check it — not the flashing last price — when you are near your liquidation level.</p>`,
    faq: [['Why do exchanges use mark price for liquidation?', 'Mark price is an index-based fair value that smooths out single-exchange spikes, so a brief wick on a thin order book cannot wrongly liquidate a healthy position.'], ['Is mark price the same as last price?', 'No. Last price is the most recent trade on that exchange; mark price is a fairer index-based value used to calculate PnL and liquidations.']],
  },
];

const { SHARED, CASES } = require('./data/guides-i18n');
const LANG_CODES = ['de', 'es', 'pt', 'fr', 'nl', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id'];
const RTL = { ar: 1 };
const EN_SHARED = { navMarkets: 'Markets', navScreener: 'Screener', navTools: 'Tools', navBlog: 'Blog', navLiq: 'Liquidations', navFunding: 'Funding', crumbHome: 'Home', crumbGuides: 'Guides', faqH: 'FAQ', footNote: 'For information only — not financial advice. Explore the live data on the <a href="/markets/">markets hub</a>.' };
// internal links that have per-language variants → lang-ify on translated pages
const LANG_PREFIXES = ['funding/', 'open-interest/', 'long-short/', 'liquidations/', 'markets/', 'guides/', 'lowest-fee-crypto-exchange/'];

function page(g, lang) {
  const L = lang ? SHARED[lang] : EN_SHARED;
  const tr = lang ? CASES[lang][g.slug] : null;
  const code = lang || 'en';
  const title = tr ? tr.title : g.title;
  const desc = tr ? tr.desc : g.desc;
  const toolLabel = tr ? tr.toolLabel : g.tool.label;
  let body = tr ? tr.body : g.body;
  const faq = tr ? tr.faq : g.faq;
  const url = `https://marginpad.io/${lang ? lang + '/' : ''}guides/${g.slug}/`;
  const home = lang ? `/${lang}/` : '/';
  const nav = p => `/${lang ? lang + '/' : ''}${p}`;
  const pathLang = p => { if (!lang) return p; for (const pre of LANG_PREFIXES) if (p === '/' + pre || p.startsWith('/' + pre)) return '/' + lang + p; return p; };
  const langLink = h => lang ? h.replace(new RegExp('href="/(' + LANG_PREFIXES.join('|') + ')', 'g'), `href="/${lang}/$1`) : h;
  body = langLink(body);
  const footNote = langLink(L.footNote);
  const toolHref = pathLang(g.tool.href);
  let hreflang = `<link rel="alternate" hreflang="en" href="https://marginpad.io/guides/${g.slug}/" />\n`;
  for (const lc of LANG_CODES) hreflang += `<link rel="alternate" hreflang="${lc}" href="https://marginpad.io/${lc}/guides/${g.slug}/" />\n`;
  hreflang += `<link rel="alternate" hreflang="x-default" href="https://marginpad.io/guides/${g.slug}/" />`;
  const faqLd = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[${faq.map(([q, a]) => `{"@type":"Question","name":${JSON.stringify(q)},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(a)}}}`).join(',')}]}</script>`;
  const bcLd = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":${JSON.stringify(L.crumbHome)},"item":"https://marginpad.io${home}"},{"@type":"ListItem","position":2,"name":${JSON.stringify(L.crumbGuides)},"item":"https://marginpad.io${nav('guides/')}"},{"@type":"ListItem","position":3,"name":${JSON.stringify(title)},"item":"${url}"}]}</script>`;
  const faqHtml = `<h2>${L.faqH}</h2>${faq.map(([q, a]) => `<h3 style="font-size:16px;margin:16px 0 4px">${q}</h3><p>${a}</p>`).join('')}`;
  return `<!DOCTYPE html>
<html lang="${code}"${RTL[lang] ? ' dir="rtl"' : ''}>
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} | MarginPad</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${url}" />
${hreflang}
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#0a0b0d" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://marginpad.io/assets/og/coin.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://marginpad.io/assets/og/coin.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="stylesheet" href="/assets/blog.css" />
${bcLd}
${faqLd}
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="${home}">MARGIN<b style="color:#c2f64a">PAD</b></a>
    <nav class="nav"><a href="${nav('markets/')}">${L.navMarkets}</a><a href="/screener">${L.navScreener}</a><a href="${home}">${L.navTools}</a><a href="/blog/">${L.navBlog}</a></nav>
  </header>
  <div class="crumb"><a href="${home}">${L.crumbHome}</a> / <a href="${nav('guides/')}">${L.crumbGuides}</a> / ${title}</div>
  <article>
    <h1>${title}</h1>
    <p class="lead">${desc}</p>
    <p style="margin:10px 0 20px"><a href="${toolHref}" style="display:inline-block;background:#c2f64a;color:#0a0b0d;text-decoration:none;font-family:'Space Mono',monospace;font-weight:700;font-size:14px;padding:11px 18px;border-radius:11px">${toolLabel} →</a></p>
    ${body}
    ${faqHtml}
    <p style="color:var(--ink-faint);font-size:13px;margin-top:22px">${footNote}</p>
  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="${nav('markets/')}">${L.navMarkets}</a> · <a href="${nav('liquidations/')}">${L.navLiq}</a> · <a href="${nav('funding/')}">${L.navFunding}</a> · <a href="/screener">${L.navScreener}</a></span>
  </footer>
</div>
</body>
</html>
`;
}

let n = 0;
for (const g of GUIDES) {
  // English at /guides/<slug>/
  const d = path.join(DIST, 'guides', g.slug);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'index.html'), page(g, ''));
  n++;
  // 12 translated variants at /<lang>/guides/<slug>/
  for (const lc of LANG_CODES) {
    const dl = path.join(DIST, lc, 'guides', g.slug);
    fs.mkdirSync(dl, { recursive: true });
    fs.writeFileSync(path.join(dl, 'index.html'), page(g, lc));
    n++;
  }
}
console.log('wrote ' + n + ' guides (' + GUIDES.length + ' × 13 langs) → dist/[<lang>/]guides/<slug>/');
try {
  const smp = path.join(DIST, 'sitemap.xml');
  let sm = fs.readFileSync(smp, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  let added = 0;
  for (const g of GUIDES) {
    const loc = `https://marginpad.io/guides/${g.slug}/`;
    if (sm.indexOf(loc) === -1) { sm = sm.replace('</urlset>', `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n</urlset>`); added++; }
  }
  if (added) { fs.writeFileSync(smp, sm); console.log('sitemap: +' + added + ' guide URLs'); }
} catch (e) { console.log('sitemap skipped:', e.message); }
