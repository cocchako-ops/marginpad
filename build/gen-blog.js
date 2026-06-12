/* Generates blog articles + rebuilds blog index. Run: node build/gen-blog.js
   Article bodies are hand-written (unique) — the generator only handles boilerplate. */
const fs = require('fs');
const path = require('path');
const BLOG = path.join(__dirname, '..', 'dist', 'blog');
const EXTRA = require('./_extra.js');
const TOOLSHOW = `    <div class="toolshow">
      <div class="ts-head">Everything free on MarginPad — no signup</div>
      <div class="ts-grid">
        <a class="ts-card" href="/#liq"><b>Liquidation Calculator</b><small>Know your exit price</small></a>
        <a class="ts-card" href="/?p=heat"><b>Liquidation Heatmap</b><small>See the danger zones</small></a>
        <a class="ts-card" href="/?p=plan"><b>Trade Planner</b><small>Plan the whole trade</small></a>
        <a class="ts-card" href="/?p=swap"><b>Crypto Swap</b><small>900+ coins, no account</small></a>
        <a class="ts-card" href="https://t.me/MarginPadBot" target="_blank" rel="noopener"><b>Telegram Bot</b><small>Live prices &amp; alerts</small></a>
        <a class="ts-card" href="https://t.me/MarginPadBot" target="_blank" rel="noopener"><b>Trade League</b><small>Log trades, win USDT</small></a>
      </div>
    </div>`;

function shell(a) {
  const url = `https://marginpad.io/blog/${a.slug}/`;
  const faqLd = a.faq && a.faq.length ? `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[${a.faq.map(f=>`{"@type":"Question","name":${JSON.stringify(f.q)},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(f.a)}}}`).join(',')}]}</script>` : '';
  const crumbLd = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://marginpad.io/"},{"@type":"ListItem","position":2,"name":"Blog","item":"https://marginpad.io/blog/"},{"@type":"ListItem","position":3,"name":${JSON.stringify(a.crumb)},"item":"${url}"}]}</script>`;
  const relatedHtml = a.related && a.related.length ? `  <section class="related">
    <h2 class="rel-title">Related guides</h2>
    <div class="rel-grid">${a.related.map(r=>`<a class="rel-card" href="/blog/${r.slug}/"><span class="tag">${r.tag}</span><span class="rel-t">${r.title}</span></a>`).join('')}</div>
  </section>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-18230384038');</script>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="MarginPad" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
<script src="/assets/pwa-nav.js" defer></script>
<title>${a.title} — MarginPad</title>
<meta name="description" content="${a.desc}" />
<meta name="keywords" content="${a.keywords}" />
<link rel="canonical" href="${url}" />
<meta property="og:title" content="${a.title}" />
<meta property="og:description" content="${a.desc}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Familjen+Grotesk:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/assets/blog.css" />
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":${JSON.stringify(a.title)},"description":${JSON.stringify(a.desc)},"author":{"@type":"Organization","name":"MarginPad"},"publisher":{"@type":"Organization","name":"MarginPad"},"datePublished":"2026-06-10","dateModified":"2026-06-10","mainEntityOfPage":"${url}"}</script>
${faqLd}
${crumbLd}
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="/">Calculators</a><a href="/blog/">Blog</a></nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / <a href="/blog/">Blog</a> / ${a.crumb}</div>
  <article>
    <h1>${a.title}</h1>
    <div class="meta">${a.tag} · ${a.read} min read · Updated June 2026</div>
${a.body}
${TOOLSHOW}
  </article>
${relatedHtml}
  <section class="comments">
    <h2 class="cm-title">Comments</h2>
    <form id="cmForm" class="cm-form" autocomplete="off">
      <input id="cmName" class="cm-in" maxlength="40" placeholder="Your name (optional)" />
      <input id="cmWebsite" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0" />
      <textarea id="cmText" class="cm-in cm-ta" maxlength="1000" rows="3" placeholder="Share your thoughts or a question…" required></textarea>
      <button type="submit" class="cm-submit">Post comment</button>
    </form>
    <div id="cmList" class="cm-list"></div>
  </section>
  <script src="/assets/comments.js" defer></script>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="/">Calculators</a> · <a href="/blog/">Blog</a></span>
  </footer>
</div>
</body>
</html>
`;
}

// ---- NEW articles (hand-written bodies) ----
const NEW = [
  {
    slug:'perpetual-futures-explained', tag:'Basics', read:5, crumb:'Perpetual futures',
    title:'What Is a Perpetual Futures Contract? (Simple Guide)',
    desc:'Perpetual futures explained in plain English: how they differ from spot and traditional futures, why they never expire, and the role of funding.',
    keywords:'what is a perpetual futures contract, perpetual futures explained, perpetual swap, crypto perpetuals, perp trading',
    faq:[{q:'What is a perpetual futures contract?',a:'A perpetual future is a derivative that tracks an asset price but never expires, so you can hold a leveraged long or short position indefinitely. A funding rate keeps its price aligned with spot.'},{q:'How are perpetuals different from spot?',a:'Spot means you own the actual coin. A perpetual is a leveraged bet on the price — you never hold the underlying asset, and you can go short as easily as long.'}],
    body:`    <p>Most crypto leverage trading happens on <strong>perpetual futures</strong> — often called "perps." They're the most popular derivative in crypto, yet many traders use them without really knowing how they work. Here's the plain-English version.</p>
    <h2>The one-sentence definition</h2>
    <p>A perpetual future is a contract that lets you bet on a coin's price — long or short, with leverage — that <strong>never expires</strong>. You can hold the position for an hour or a year.</p>
    <h2>How it differs from spot</h2>
    <p>When you buy <strong>spot</strong>, you own the actual coin. With a perpetual you own a <em>contract</em> that tracks the price — you never hold the underlying asset. That's what lets you use leverage and go short (profit when price falls) just as easily as long.</p>
    <h2>Why "perpetual"?</h2>
    <p>Traditional futures have an expiry date. Perpetuals removed it, which created a problem: with no expiry, nothing forces the contract price to match the real spot price. The fix is the <strong>funding rate</strong> — a small payment exchanged between longs and shorts every few hours that nudges the perp price back toward spot. We cover it in <a href="/blog/what-is-funding-rate/">the funding rate guide</a>.</p>
    <h2>The risk: liquidation</h2>
    <p>Because perps use leverage, a move against you can wipe out your margin and trigger <a href="/blog/what-is-liquidation-in-crypto/">liquidation</a>. Always know your liquidation price and size by risk before entering.</p>
    <div class="callout"><div class="k">Before you open a perp</div><p style="margin-bottom:14px">Check your liquidation price and position size in seconds.</p><a class="cta" href="/#liq">Open the calculators →</a></div>`
  },
  {
    slug:'long-vs-short-crypto', tag:'Basics', read:4, crumb:'Long vs short',
    title:"Long vs Short in Crypto: What's the Difference?",
    desc:'Going long vs going short in crypto futures explained simply, with how profit, loss and liquidation work in each direction.',
    keywords:'long vs short crypto, what is going short, what is going long, short selling crypto, long short futures',
    faq:[{q:'What does going long mean?',a:'Going long means you profit when the price rises. You buy expecting the asset to go up.'},{q:'What does going short mean?',a:'Going short means you profit when the price falls. On futures you can short without owning the asset.'}],
    body:`    <p>Every futures trade is either <strong>long</strong> or <strong>short</strong>. Understanding both is the foundation of leverage trading — and the reason crypto traders can make money whether the market goes up or down.</p>
    <h2>Going long</h2>
    <p>A <strong>long</strong> position profits when the price <em>rises</em>. You buy at one price and aim to close higher. If you long BTC at $60,000 and it goes to $66,000, you're up. Liquidation on a long sits <em>below</em> your entry.</p>
    <h2>Going short</h2>
    <p>A <strong>short</strong> position profits when the price <em>falls</em>. On futures you can sell first and buy back later, without ever owning the coin. Short BTC at $60,000, buy back at $54,000, and you keep the difference. Liquidation on a short sits <em>above</em> your entry.</p>
    <h2>How profit and loss flip</h2>
    <p>For a long, PnL is <code>(exit − entry) × size</code>. For a short it's the reverse: <code>(entry − exit) × size</code>. Same maths, opposite sign. Our <a href="/#pnl">PnL calculator</a> handles both with one toggle.</p>
    <h2>Which should you use?</h2>
    <p>Neither is "safer" — both carry the same liquidation risk. Trade the direction your analysis supports, keep leverage modest, and always set a stop-loss. The ability to short is simply a tool to profit in down markets, not a free lunch.</p>
    <div class="callout"><div class="k">Long or short?</div><p style="margin-bottom:14px">Toggle direction and see your liquidation and PnL instantly.</p><a class="cta" href="/#liq">Open the calculators →</a></div>`
  },
  {
    slug:'how-to-set-a-stop-loss', tag:'Risk management', read:5, crumb:'Stop-loss',
    title:'How to Set a Stop-Loss in Crypto (the Right Way)',
    desc:'A practical guide to setting a stop-loss in crypto trading: where to place it, common mistakes, and how it ties into position size and liquidation.',
    keywords:'how to set a stop loss, stop loss crypto, where to place stop loss, stop loss strategy, stop loss futures',
    faq:[{q:'Where should I place my stop-loss?',a:'Place it at a price level that invalidates your trade idea — beyond a recent swing high/low or key support/resistance — and always inside your liquidation price.'},{q:'Does a stop-loss prevent liquidation?',a:'Yes, if it triggers before price reaches your liquidation level you exit on your own terms with a smaller, controlled loss.'}],
    body:`    <p>A <strong>stop-loss</strong> is an order that closes your trade automatically if price hits a level you choose. It's the difference between a small planned loss and a blown account. Here's how to set one properly.</p>
    <h2>Place it where your idea is wrong</h2>
    <p>Don't put your stop at a random round number. Put it at the price that <em>invalidates your trade</em> — beyond a recent swing low (for a long), past a clear support/resistance level, or wherever a move proves you wrong. If price gets there, you want to be out.</p>
    <h2>Always keep it inside your liquidation price</h2>
    <p>Your stop must trigger <em>before</em> liquidation. If your <a href="/blog/how-to-calculate-liquidation-price/">liquidation price</a> is closer to entry than your stop, your leverage is too high — lower it until the stop sits safely inside.</p>
    <h2>Size the trade around the stop</h2>
    <p>This is the part most people get backwards. First decide your stop level, then let it determine your position size so the loss equals a fixed small % of your account (1% is common). Our <a href="/#size">position size calculator</a> does this for you.</p>
    <h2>Common mistakes</h2>
    <ul>
      <li><strong>Stops too tight</strong> — getting wicked out by normal noise. Give the trade room.</li>
      <li><strong>Moving the stop further away</strong> when price approaches it — that's how small losses become big ones.</li>
      <li><strong>No stop at all</strong> — relying on "I'll close it manually" almost always ends badly.</li>
    </ul>
    <div class="callout"><div class="k">Stop set?</div><p style="margin-bottom:14px">Turn it into the right position size in one step.</p><a class="cta" href="/#size">Open the position size calculator →</a></div>`
  },
  {
    slug:'roe-vs-roi', tag:'Basics', read:4, crumb:'ROE vs ROI',
    title:"ROE vs ROI in Trading: What's the Difference?",
    desc:'ROE vs ROI explained for leveraged crypto trading: why a 6% move can be a 60% return, and which number actually reflects your performance.',
    keywords:'roe vs roi, what is roe in trading, return on equity trading, roi crypto, roe crypto futures',
    faq:[{q:'What is ROE in trading?',a:'ROE (return on equity) is your return on the margin you posted, amplified by leverage. At 10x, a 6% price move is roughly a 60% ROE.'},{q:'Is ROE or ROI more important?',a:'ROI shows the raw price move; ROE shows what actually happened to your money. For leveraged trading, ROE reflects your real performance.'}],
    body:`    <p>Two percentages show up on every leveraged trade — <strong>ROI</strong> and <strong>ROE</strong> — and confusing them leads to nasty surprises. Here's the difference in 60 seconds.</p>
    <h2>ROI — the raw price move</h2>
    <p><strong>Price ROI</strong> is simply how far the asset moved. BTC from $60,000 to $63,600 is a +6% ROI. It says nothing about leverage.</p>
    <h2>ROE — return on your money</h2>
    <p><strong>ROE</strong> (return on equity) is your return on the <em>margin you actually posted</em>, which leverage multiplies. That same 6% move at <strong>10× leverage</strong> is roughly a <strong>60% ROE</strong> — you made 60% on the cash you put up.</p>
    <div class="example">
      <div class="row"><span>Price move (ROI)</span><b>+6%</b></div>
      <div class="row"><span>Leverage</span><b>10×</b></div>
      <div class="row"><span>Return on equity (ROE)</span><b>≈ +60%</b></div>
    </div>
    <h2>Why it matters</h2>
    <p>ROE is what actually happens to your account — and it cuts both ways. The same 6% <em>against</em> you at 10× is a 60% loss of margin. High ROE numbers look thrilling, but they're a direct measure of how much risk your leverage is adding. Watch ROE, not just the price chart.</p>
    <div class="callout"><div class="k">See both numbers</div><p style="margin-bottom:14px">The PnL calculator shows price ROI and leveraged ROE side by side.</p><a class="cta" href="/#pnl">Open the PnL calculator →</a></div>`
  },
  {
    slug:'spot-vs-futures-trading', tag:'Basics', read:5, crumb:'Spot vs futures',
    title:'Spot vs Futures Trading in Crypto Explained',
    desc:'Spot vs futures trading compared: ownership, leverage, shorting, liquidation risk, and which one beginners should start with.',
    keywords:'spot vs futures trading, spot vs futures crypto, difference spot futures, futures trading explained, spot trading',
    faq:[{q:'Should beginners trade spot or futures?',a:'Beginners should start with spot. You own the asset, there is no leverage and no liquidation, so mistakes are far less costly.'},{q:'Can you short on spot?',a:'No. Shorting (profiting when price falls) requires futures or margin. Spot only profits when the price rises.'}],
    body:`    <p><strong>Spot</strong> and <strong>futures</strong> are the two ways to trade crypto, and the difference is bigger than most beginners realise. Pick the wrong one for your experience level and a bad day can become a catastrophic one.</p>
    <h2>Spot: you own the coin</h2>
    <p>Spot trading means buying the actual asset. Buy 0.1 BTC and you hold 0.1 BTC. No leverage, no liquidation — the worst case is the coin goes to zero, and even that is slow. You only profit when price rises.</p>
    <h2>Futures: you trade a contract</h2>
    <p>Futures (usually <a href="/blog/perpetual-futures-explained/">perpetuals</a>) let you trade with <strong>leverage</strong> and go <a href="/blog/long-vs-short-crypto/">long or short</a>. You don't own the coin — you hold a contract. The upside is amplified gains and the ability to profit in down markets; the downside is <a href="/blog/what-is-liquidation-in-crypto/">liquidation</a>, where a move against you wipes out your margin.</p>
    <h2>Quick comparison</h2>
    <div class="example">
      <div class="row"><span>Own the asset?</span><b>Spot: yes · Futures: no</b></div>
      <div class="row"><span>Leverage</span><b>Spot: no · Futures: yes</b></div>
      <div class="row"><span>Can short?</span><b>Spot: no · Futures: yes</b></div>
      <div class="row"><span>Liquidation risk</span><b>Spot: none · Futures: yes</b></div>
    </div>
    <h2>Which should you start with?</h2>
    <p>Start with <strong>spot</strong>. Learn how the market moves without leverage adding pressure. Move to futures only once you understand position sizing, stop-losses and liquidation — and even then, keep leverage low.</p>`
  },
  {
    slug:'maker-vs-taker-fees', tag:'Basics', read:4, crumb:'Maker vs taker',
    title:'Maker vs Taker Fees Explained',
    desc:'Maker vs taker fees in crypto trading: what they mean, why takers usually pay more, and how to pay the lower maker fee.',
    keywords:'maker vs taker fees, what is maker taker, trading fees explained, maker fee, taker fee crypto',
    faq:[{q:'What is the difference between maker and taker fees?',a:'A maker adds liquidity with a limit order that rests on the book and pays a lower fee. A taker removes liquidity with a market order and pays a higher fee.'},{q:'How do I pay the lower maker fee?',a:'Use limit orders that do not immediately match — they sit on the order book until filled, qualifying as maker orders.'}],
    body:`    <p>Every trade pays a fee, and the size of that fee depends on whether you're a <strong>maker</strong> or a <strong>taker</strong>. It sounds like jargon, but it directly affects how much of your profit you keep.</p>
    <h2>Makers add liquidity</h2>
    <p>A <strong>maker</strong> places a limit order that doesn't fill immediately — it rests on the order book, "making" liquidity available for others. Because exchanges want that liquidity, makers pay a <strong>lower</strong> fee (sometimes zero or even a rebate).</p>
    <h2>Takers remove liquidity</h2>
    <p>A <strong>taker</strong> places a market order (or a limit order that fills instantly), "taking" liquidity off the book. Takers pay a <strong>higher</strong> fee for the convenience of instant execution.</p>
    <h2>Why it matters</h2>
    <p>Fees are charged on your full position size, and with leverage that adds up fast. A frequent trader paying taker fees on every entry and exit can lose a meaningful slice of returns. Using <strong>limit orders</strong> where possible qualifies you for the cheaper maker rate.</p>
    <p>Fee levels also vary a lot between exchanges — one reason it's worth <a href="/#liq">comparing venues</a>. Our calculators show price-based PnL and don't include fees, so treat results as the pre-fee picture.</p>
    <div class="callout"><div class="k">Lower fees = more profit kept</div><p style="margin-bottom:14px">Plan the trade first, then choose a low-fee exchange.</p><a class="cta" href="/#pnl">Open the PnL calculator →</a></div>`
  },
  {
    slug:'what-is-a-margin-call', tag:'Basics', read:4, crumb:'Margin call',
    title:'What Is a Margin Call in Crypto?',
    desc:'Margin call explained for crypto traders: what triggers it, how it relates to liquidation, and how to avoid ever getting one.',
    keywords:'what is a margin call, margin call crypto, margin call vs liquidation, maintenance margin, margin call explained',
    faq:[{q:'What is a margin call?',a:'A margin call is a warning that your margin has fallen close to the level required to keep a leveraged position open. If you do not add margin or reduce the position, liquidation follows.'},{q:'Is a margin call the same as liquidation?',a:'No. A margin call is the warning; liquidation is the forced closure that happens if you ignore it.'}],
    body:`    <p>A <strong>margin call</strong> is the market's way of tapping you on the shoulder before things go wrong. Understanding it helps you act before the exchange acts for you.</p>
    <h2>What triggers it</h2>
    <p>When you open a leveraged position you post <strong>margin</strong>. As price moves against you, your losses eat into that margin. When it falls close to the <a href="/blog/what-is-maintenance-margin/" rel="nofollow">maintenance level</a> the exchange requires, you get a margin call — a warning that you're near forced closure.</p>
    <h2>Margin call vs liquidation</h2>
    <p>They're not the same. A <strong>margin call</strong> is the warning; <a href="/blog/what-is-liquidation-in-crypto/"><strong>liquidation</strong></a> is what happens next if you do nothing. In fast crypto markets the gap between the two can be seconds, so don't rely on having time to react.</p>
    <h2>Your options when called</h2>
    <ul>
      <li><strong>Add margin</strong> — top up collateral to push liquidation further away.</li>
      <li><strong>Reduce the position</strong> — close part of it to lower risk.</li>
      <li><strong>Close it</strong> — take the controlled loss and reset.</li>
    </ul>
    <h2>How to avoid them entirely</h2>
    <p>Use lower leverage, keep a margin buffer, size by risk, and set a stop-loss inside your liquidation price. Do that and you'll rarely, if ever, see a margin call.</p>
    <div class="callout"><div class="k">Stay well clear of the edge</div><p style="margin-bottom:14px">Check how much room you have before liquidation.</p><a class="cta" href="/#liq">Open the liquidation calculator →</a></div>`
  },
  {
    slug:'risk-reward-ratio-explained', tag:'Risk management', read:5, crumb:'Risk/reward',
    title:'Risk/Reward Ratio Explained (With Examples)',
    desc:'The risk/reward ratio explained simply: how to calculate it, what a good ratio looks like, and the win rate you need to break even.',
    keywords:'risk reward ratio, risk to reward ratio explained, good risk reward ratio, break even win rate, risk reward crypto',
    faq:[{q:'What is a good risk/reward ratio?',a:'Many traders aim for at least 2:1 — making twice what they risk. At 2:1 you only need to win about a third of your trades to break even.'},{q:'How do I calculate risk/reward?',a:'Divide your potential reward (target minus entry) by your potential risk (entry minus stop). A reward of $600 against a risk of $200 is a 3:1 ratio.'}],
    body:`    <p>The <strong>risk/reward ratio</strong> is one of the simplest, most powerful ideas in trading. It compares what you stand to gain against what you're risking — and it explains why some traders profit while winning fewer than half their trades.</p>
    <h2>How to calculate it</h2>
    <p>Risk is the distance from your entry to your stop-loss. Reward is the distance from your entry to your target. Divide reward by risk:</p>
    <div class="formula">Risk = |Entry − Stop|<br>Reward = |Target − Entry|<br>Ratio = Reward ÷ Risk</div>
    <p>Entry $60,000, stop $58,000, target $66,000 → risk $2,000, reward $6,000, ratio <strong>3:1</strong>.</p>
    <h2>What's a good ratio?</h2>
    <p>Many traders won't take a trade below <strong>2:1</strong>. The higher the reward relative to risk, the fewer trades you need to win to come out ahead.</p>
    <h2>The break-even win rate</h2>
    <p>This is the magic part. At a given ratio, there's a minimum win rate just to break even:</p>
    <div class="example">
      <div class="row"><span>1:1 ratio</span><b>50% win rate to break even</b></div>
      <div class="row"><span>2:1</span><b>≈ 33%</b></div>
      <div class="row"><span>3:1</span><b>25%</b></div>
    </div>
    <p>At 3:1 you can be wrong three times out of four and still not lose money. That's why pros obsess over risk/reward, not just being "right."</p>
    <div class="callout"><div class="k">Check your setup</div><p style="margin-bottom:14px">Enter your entry, stop and target to get the ratio and break-even win rate.</p><a class="cta" href="/#rr">Open the risk/reward calculator →</a></div>`
  },
  {
    slug:'crypto-tax-india', tag:'India', read:5, crumb:'Crypto tax in India',
    title:'Crypto Tax in India: The 30% Tax & 1% TDS Explained (2026)',
    desc:'How crypto is taxed in India — the flat 30% tax on gains, the 1% TDS on transactions, no loss offset, and what it means for traders.',
    keywords:'crypto tax india, 30 percent crypto tax india, 1 percent tds crypto, crypto tax 2026 india, vda tax india',
    faq:[{q:'How much tax do I pay on crypto in India?',a:'A flat 30% tax (plus applicable surcharge and cess) applies to gains from virtual digital assets, regardless of your income slab. You cannot set off losses or deduct expenses other than the cost of acquisition.'},{q:'What is the 1% TDS on crypto in India?',a:'A 1% Tax Deducted at Source applies on crypto transfers above the threshold (₹10,000, or ₹50,000 for specified persons). It is deducted at the transaction and adjusted when you file your return.'}],
    body:`    <p>India has some of the strictest crypto tax rules in the world. If you trade from India, understanding them isn't optional — the rules apply whether you profit or not. Here's the plain-English version. <em>(This is general information, not tax advice — confirm specifics with a qualified CA, and note rules can change.)</em></p>
    <h2>The flat 30% tax on gains</h2>
    <p>Income from transferring <strong>virtual digital assets</strong> (crypto, NFTs) is taxed at a <strong>flat 30%</strong>, plus applicable surcharge and cess — no matter your income slab. You can deduct only the <em>cost of acquisition</em>; no other expenses, and no benefit of lower slabs.</p>
    <h2>No loss set-off</h2>
    <p>This is the part that catches traders out. <strong>Losses from one crypto cannot be set off against gains from another</strong>, and they can't be carried forward. Win on BTC, lose on ETH? You still pay 30% on the BTC gain, with no relief for the ETH loss.</p>
    <h2>The 1% TDS</h2>
    <p>On top of the 30%, a <strong>1% TDS</strong> (Tax Deducted at Source) applies to crypto transfers above the threshold. It's deducted at the time of the transaction — which means active traders see 1% skimmed off each sale, tying up capital until they file and reconcile it.</p>
    <div class="callout"><div class="k">Plan before you trade</div><p style="margin-bottom:14px">High taxes make every trade count. Size by risk and know your liquidation before entering.</p><a class="cta" href="/#size">Open the position size calculator →</a></div>
    <h2>What it means for traders</h2>
    <p>The 30% flat rate plus no loss offset plus 1% TDS rewards <strong>fewer, higher-conviction trades</strong> over high-frequency churning — every round-trip carries tax friction. Keep meticulous records of acquisition cost and TDS, and report under the VDA schedule when filing.</p>`
  },
  {
    slug:'crypto-exchanges-india', tag:'India', read:5, crumb:'Exchanges for India',
    title:'Trading Crypto from India in 2026: A Practical Guide',
    desc:'How Indian traders access crypto in 2026 — INR on-ramps, P2P, KYC, the 1% TDS, and what to weigh when choosing where to trade.',
    keywords:'best crypto exchange india, crypto exchange for indian traders, inr crypto, p2p crypto india, crypto trading india',
    faq:[{q:'Can Indians legally trade crypto?',a:'Crypto is legal to hold and trade in India, but it is heavily taxed (30% on gains plus 1% TDS) and not recognised as legal tender. Always comply with KYC and tax rules.'},{q:'How do Indians deposit INR for crypto?',a:'Most use INR bank transfer or UPI on local exchanges, or P2P (peer-to-peer) markets on global exchanges where buyers and sellers match directly.'}],
    body:`    <p>Trading crypto from India is legal but tightly taxed and regulated. The practical questions most Indian traders ask are: how do I get INR in and out, and where do I actually trade? <em>(General information, not financial or legal advice — verify current rules.)</em></p>
    <h2>Getting INR in: UPI, bank transfer and P2P</h2>
    <p>Local exchanges support <strong>INR deposits</strong> via bank transfer and UPI, with full KYC. Global exchanges that don't take INR directly are usually accessed through <strong>P2P markets</strong>, where you buy USDT from another person paying in INR. P2P is popular but demands care — use escrow, trade with reputable counterparties, and keep records.</p>
    <h2>Tax follows you everywhere</h2>
    <p>Whichever venue you use, India's <a href="/blog/crypto-tax-india/">30% tax and 1% TDS</a> apply. Local exchanges may deduct TDS automatically; on global/P2P venues the responsibility is yours. Factor this into every trade.</p>
    <h2>What to weigh when choosing</h2>
    <ul>
      <li><strong>Liquidity & fees</strong> — deeper books and lower fees keep more of your gains.</li>
      <li><strong>INR on/off-ramp</strong> — direct INR vs P2P.</li>
      <li><strong>Futures availability</strong> — if you trade leverage, check what's offered.</li>
    </ul>
    <div class="callout"><div class="k">Trade with the numbers ready</div><p style="margin-bottom:14px">Liquidation, position size and PnL — free, no signup, works on any exchange.</p><a class="cta" href="/#liq">Open MarginPad calculators →</a></div>
    <p>MarginPad's calculators work alongside whichever exchange you choose, and the interface is available in Hindi-friendly English and 11 other languages.</p>`
  },
  {
    slug:'trading-crypto-in-china', tag:'China', read:5, crumb:'Crypto in China',
    title:'Trading Crypto from Mainland China: The 2026 Reality',
    desc:'The real state of crypto in mainland China — the 2021 restrictions, how individuals still access markets, and the risks to understand.',
    keywords:'trading crypto in china, can you trade crypto in china, crypto china 2026, china crypto ban, buy bitcoin china',
    faq:[{q:'Is crypto trading legal in China?',a:'Since 2021 China has banned crypto exchanges and mining and restricted financial institutions from crypto services. Individuals are in a legal grey area and should understand local rules and risks before acting.'},{q:'How do people in China access crypto?',a:'Many use peer-to-peer (P2P) and over-the-counter markets, along with overseas exchanges. This carries legal, banking and counterparty risk and is not officially sanctioned.'}],
    body:`    <p>China's relationship with crypto is complicated. If you're trying to understand the real picture in 2026, here it is — factually, with the risks made clear. <em>(This is general information, not legal or financial advice. Laws differ by jurisdiction and change; always comply with the rules that apply to you.)</em></p>
    <h2>What the rules say</h2>
    <p>Since 2021, mainland China has <strong>banned crypto exchanges and mining</strong> and barred financial institutions from offering crypto services. Crypto isn't legal tender, and domestic exchange operations were shut down. This pushed activity offshore and into peer-to-peer channels.</p>
    <h2>How individuals still participate</h2>
    <p>In practice, individuals access crypto mainly through <strong>P2P and OTC</strong> markets and <strong>overseas exchanges</strong>. This is a legal grey area and comes with real risks: frozen bank cards, scams, counterparty default, and no regulatory protection if something goes wrong.</p>
    <h2>The risks to weigh</h2>
    <ul>
      <li><strong>Legal risk</strong> — the regulatory stance is restrictive; understand it before acting.</li>
      <li><strong>Banking risk</strong> — accounts tied to crypto P2P can be frozen.</li>
      <li><strong>Counterparty risk</strong> — without regulation, recourse is limited.</li>
    </ul>
    <div class="callout"><div class="k">If you do trade, trade carefully</div><p style="margin-bottom:14px">Know your liquidation and size by risk — our tools are free and run in your browser, in Chinese.</p><a class="cta" href="/?lang=zh#liq">打开计算器 →</a></div>
    <p>MarginPad's interface is fully available in Chinese (中文), with calculations that work alongside any platform.</p>`
  },
  {
    slug:'crypto-exchanges-for-chinese-traders', tag:'China', read:4, crumb:'Exchanges for Chinese traders',
    title:'Crypto Exchanges with Chinese (中文) Support in 2026',
    desc:'Which major crypto exchanges offer full Chinese-language support and futures trading for Chinese-speaking users.',
    keywords:'crypto exchange chinese, 中文 crypto exchange, exchange for chinese traders, crypto futures chinese, okx binance chinese',
    faq:[{q:'Which crypto exchanges have Chinese language support?',a:'Most major global exchanges — including OKX, Binance, Bybit, Gate and KuCoin — offer full Simplified Chinese interfaces and Chinese-language support.'},{q:'Can Chinese speakers trade futures?',a:'Yes, the major exchanges offer perpetual futures with Chinese-language interfaces, though users must comply with the rules of their own jurisdiction.'}],
    body:`    <p>For Chinese-speaking traders, language support matters — futures trading is high-stakes, and you want every number and warning in a language you read fluently. Here's what the major platforms offer. <em>(General information only; comply with the rules in your jurisdiction.)</em></p>
    <h2>Chinese-language interfaces are standard</h2>
    <p>The largest global exchanges — <strong>OKX, Binance, Bybit, Gate and KuCoin</strong> — all ship full <strong>Simplified Chinese (中文)</strong> interfaces, Chinese support and educational content. Many were founded by Chinese-speaking teams and treat the language as a first-class citizen.</p>
    <h2>What to check beyond language</h2>
    <ul>
      <li><strong>Futures depth and leverage</strong> — deep liquidity matters for perps.</li>
      <li><strong>Fees</strong> — lower maker/taker fees compound over time.</li>
      <li><strong>P2P / on-ramp options</strong> in your region.</li>
    </ul>
    <h2>Calculate in Chinese too</h2>
    <p>MarginPad is fully localised in Chinese: liquidation price (强平价格), position size (仓位规模), PnL (盈亏) and more — and it follows the convention where <strong>red is up and green is down</strong> for Chinese users. It works alongside any exchange.</p>
    <div class="callout"><div class="k">中文计算器</div><p style="margin-bottom:14px">强平、仓位、盈亏 — 免费，无需注册。</p><a class="cta" href="/?lang=zh#liq">打开 MarginPad →</a></div>`
  },
  {
    slug:'zcash-orchard-counterfeiting-bug', tag:'News', read:5, crumb:'Zcash Orchard bug',
    title:'The Zcash Bug That Could Have Minted Unlimited ZEC — Explained',
    desc:'A four-year-old flaw in the Zcash Orchard shielded pool could have let an attacker counterfeit unlimited ZEC. What happened, and what it means for traders.',
    keywords:'zcash bug, zcash orchard vulnerability, zec crash, zcash counterfeit bug, zec price drop 2026',
    faq:[{q:'What was the Zcash Orchard bug?',a:'A soundness flaw in the Orchard shielded-pool circuit, live since 2022, that could have let an attacker create unlimited, undetectable counterfeit ZEC. It was patched in an emergency fix and publicly disclosed on 5 June 2026.'},{q:'Were fake ZEC actually created?',a:'Zcash developers say there is no evidence the bug was exploited and believe no counterfeit coins were minted. But because the pool is shielded, there is no cryptographic way to prove the supply was never inflated during the four-year window.'}],
    body:`    <p>On 5 June 2026 the privacy coin Zcash (ZEC) fell sharply after developers disclosed a critical flaw that, in theory, could have let someone counterfeit an unlimited amount of ZEC without anyone noticing. Here is what happened in plain English — and why it matters even if you never touch privacy coins.</p>
    <h2>What the bug was</h2>
    <p>The flaw lived in the <strong>Orchard shielded pool</strong> — the part of Zcash that hides transaction amounts behind zero-knowledge proofs. A soundness error in the Orchard circuit meant that, under the right conditions, bogus inputs could slip past the checks that are supposed to guarantee every coin is real. A security engineer, Taylor Hornby, wrote a working proof-of-concept that minted <strong>unlimited, undetectable counterfeit ZEC</strong> in a local test.</p>
    <p>The unsettling part: the bug had been live since the Orchard upgrade in <strong>May 2022</strong> — roughly four years — and because the pool is shielded, there is no way to look back and prove whether anyone exploited it.</p>
    <h2>How it was found</h2>
    <p>Hornby discovered the issue on 29 May 2026 during a targeted review of the Orchard circuit, reportedly with help from an AI model. He disclosed it privately; Zcash developers shipped an emergency patch by 1 June, and Shielded Labs went public on 5 June. The team says there is no evidence of exploitation and believes no fake coins were created.</p>
    <h2>Why the price crashed</h2>
    <p>ZEC dropped roughly 30–50% in the days around disclosure — from about $624 toward $309 at the lows. Selling accelerated when Arthur Hayes, one of the most visible backers of the recent privacy-coin narrative, exited his position. For a coin whose entire pitch is verifiable, trustless supply, "we cannot prove the supply was never inflated" is close to the worst sentence you can read.</p>
    <h2>The lesson for traders</h2>
    <p>You do not need to hold ZEC for this to matter. Single-headline events routinely move crypto 30–50% in hours, and leveraged positions get liquidated long before the dust settles. That is exactly why position sizing and stops exist:</p>
    <ul>
      <li>Size every trade by <a href="/blog/crypto-position-sizing-risk-management/">risk, not conviction</a>, so one bad headline cannot end your account.</li>
      <li>Know your <a href="/#liq">liquidation price</a> before you enter, and keep your stop inside it.</li>
      <li>On high leverage a 30% gap can blow straight through your stop — see <a href="/blog/crypto-leverage-explained/">how much leverage is too much</a>.</li>
    </ul>
    <div class="callout"><div class="k">Plan the downside first</div><p style="margin-bottom:14px">Check your liquidation and size by risk before the next surprise.</p><a class="cta" href="/#liq">Open the calculators →</a></div>
    <p style="font-size:13px;color:#8a93a0">News commentary for education, not financial or security advice. Figures are based on reporting around the 5 June 2026 disclosure and may be revised.</p>`
  },
  {
    slug:'bitcoin-depot-bankruptcy', tag:'News', read:4, crumb:'Bitcoin Depot bankruptcy',
    title:'Bitcoin Depot, the Biggest US Crypto ATM Operator, Files for Bankruptcy',
    desc:'Bitcoin Depot filed Chapter 11 and is winding down about 9,000 machines amid a regulatory crackdown and record crypto-ATM scam losses. What it signals.',
    keywords:'bitcoin depot bankruptcy, crypto atm bankruptcy, bitcoin atm shutdown 2026, crypto atm scams, btm stock',
    faq:[{q:'Why did Bitcoin Depot go bankrupt?',a:'It blamed increasingly strict state regulations — transaction limits and, in some states, outright bans on crypto ATMs — plus collapsing revenue. First-quarter 2026 revenue fell about 49% year over year.'},{q:'What does it mean for crypto users?',a:'Crypto ATMs are a high-fee, high-fraud on-ramp. Their decline pushes users toward regulated exchanges, which are cheaper and safer for actually trading.'}],
    body:`    <p>On 18 May 2026, <strong>Bitcoin Depot</strong> — once the largest bitcoin-ATM operator in North America — filed for Chapter 11 bankruptcy and began winding down. The Atlanta-based company is pulling the plug on roughly <strong>9,000 machines across 47 states</strong>, effectively closing the biggest physical on-ramp to Bitcoin in the country.</p>
    <h2>What went wrong</h2>
    <p>Bitcoin Depot blamed an increasingly hostile regulatory environment: states have piled on compliance rules, capped transaction sizes, and in some places <strong>banned crypto ATMs outright</strong>. The numbers got ugly fast — first-quarter 2026 revenue fell about <strong>49% year over year</strong> (a roughly $80.7M drop) and gross profit collapsed more than 85% to $4.5M. The company also faces a lawsuit from the attorneys general of Massachusetts and Iowa over alleged facilitation of scams.</p>
    <h2>The fraud problem</h2>
    <p>Crypto ATMs have become a favourite tool of scammers, who direct victims to feed cash into a machine that converts it to crypto and sends it straight to the fraudster. Reported crypto-ATM fraud losses hit a record <strong>$389 million last year</strong>, up 58% from the year before — drawing exactly the scrutiny that made Bitcoin Depot's model unsustainable.</p>
    <h2>Why it matters</h2>
    <p>Crypto ATMs always carried eye-watering fees — often 10–20% per transaction — on top of the fraud risk. Their retreat is a reminder that <strong>where</strong> you buy and trade matters as much as <strong>what</strong> you trade. A regulated exchange charges a fraction of a percent, shows live prices, and gives you the tools to manage risk.</p>
    <div class="callout"><div class="k">Trade where the numbers are clear</div><p style="margin-bottom:14px">Low fees, live prices, and tools to size every position by risk.</p><a class="cta" href="/#liq">Open MarginPad →</a></div>
    <p style="font-size:13px;color:#8a93a0">News commentary for education, not financial advice. Based on reporting around the 18 May 2026 filing.</p>`
  },
  {
    slug:'cardano-ada-breaks-020-support', tag:'News', read:5, crumb:'ADA breaks $0.20',
    title:'Cardano (ADA) Breaks Multi-Year $0.20 Support — Is $0.10 Next?',
    desc:'ADA has fallen below $0.20 for the first time in five years amid governance turmoil and ecosystem failures. We break down what happened and what the charts say.',
    keywords:'cardano ada price, ada breaks 0.20 support, ada price prediction 0.10, cardano crash 2026, ada support level',
    faq:[{q:'Why is Cardano (ADA) crashing?',a:'ADA fell on a cluster of bad news: a failed treasury vote that cancelled Cardano Summit 2026, the shutdown of the analytics platform TapTools, and founder Charles Hoskinson stepping back after warning of a coming "wave of failures." It broke below $0.20 — a five-year low — in early June 2026.'},{q:'Could ADA fall to $0.10?',a:'With $0.20 gone, the next major historical support is the $0.10–0.12 zone last seen in 2020, and some analysts flag about $0.113. It is a scenario, not a certainty — nobody can predict price. Trade with a stop and proper position size.'}],
    body:`    <p>Cardano (ADA) has broken below <strong>$0.20 for the first time in over five years</strong>, sliding toward $0.16 as a wave of bad news hit the project. If you trade ADA — or any coin near a long-term support level — here is what happened and why the next zone traders are watching is all the way down at $0.10.</p>
    <h2>What broke</h2>
    <p>ADA lost the key $0.247 support in late May and then cracked the psychologically huge <strong>$0.20</strong> level in early June 2026, falling 6–10% in a day and extending a decline of roughly <strong>77% from its 2026 high</strong> near $1.00. Once a multi-year support breaks, the chart often has little underneath it until the next historical shelf.</p>
    <h2>Why it happened</h2>
    <ul>
      <li><strong>Governance turmoil:</strong> the Cardano Foundation cancelled Cardano Summit 2026 after a treasury funding proposal failed to reach the two-thirds majority required under its Voltaire governance.</li>
      <li><strong>Ecosystem cracks:</strong> TapTools, a popular Cardano analytics platform, announced it was shutting down after four years, citing unsustainable costs.</li>
      <li><strong>Founder steps back:</strong> Charles Hoskinson said he is "taking a break" after warning of a coming "wave of failures" in the ecosystem.</li>
    </ul>
    <h2>"No floor until $0.10"?</h2>
    <p>With $0.20 gone, the next major support traders point to is the <strong>$0.10–0.12 zone</strong> — levels last seen in 2020. Analyst Ali Martinez flagged roughly $0.113 as a downside target if the long-term structure keeps breaking. That is one scenario, not a prediction; support can hold or bounce hard. Nobody knows.</p>
    <h2>What it means if you trade it</h2>
    <p>Broken multi-year supports are exactly where leveraged longs get liquidated and shorts get aggressive — and where violent bounces squeeze the shorts. If you are trading ADA either direction:</p>
    <ul>
      <li>Know your <a href="/#liq">liquidation price</a> first — a leveraged long into a falling knife is liquidated fast.</li>
      <li>Size every position by <a href="/blog/crypto-position-sizing-risk-management/">risk, not conviction</a>, so one more leg down can't end your account.</li>
      <li>Shorting a five-year low? Keep your stop above the broken level — counter-trend squeezes are brutal.</li>
    </ul>
    <div class="callout"><div class="k">Trade the level, not the hype</div><p style="margin-bottom:14px">Check your liquidation and size by risk before you touch a falling knife.</p><a class="cta" href="/#liq">Open the calculators →</a></div>
    <p style="font-size:13px;color:#8a93a0">News commentary for education, not financial or investment advice. Figures are based on reporting around the early-June 2026 breakdown and move quickly. Never trade money you can't afford to lose.</p>`
  },
  {
    slug:'htx-sanctioned-what-us-traders-should-know', tag:'News', read:5, crumb:'HTX sanctioned',
    title:'HTX Sanctioned: What US Traders Need to Know (2026)',
    desc:'HTX (formerly Huobi) was sanctioned by the UK in May 2026 over alleged Russian sanctions evasion — and it already bars US users. We break down the risk and what to do.',
    keywords:'htx sanctioned, is htx legal in the us, htx us users, htx huobi sanctions, htx safe to use 2026',
    faq:[{q:'Is HTX available to US users?',a:'No. The HTX user agreement lists the United States among prohibited jurisdictions, so US residents are not permitted to open an account, deposit or trade. On top of that, the UK sanctioned HTX in May 2026.'},{q:'Was HTX sanctioned by OFAC?',a:'As of mid-2026 the headline action was a UK sanction (asset freeze and payment restrictions), not a US OFAC designation. But US persons can still face sanctions-exposure risk when dealing with sanctioned entities, and HTX already bars US users — so the practical answer for Americans is to stay away.'}],
    body:`    <p>On 26 May 2026 the UK sanctioned the crypto exchange <strong>HTX</strong> (formerly Huobi), alleging it was part of the infrastructure Russia used to evade sanctions and helped move around <strong>$1.5 billion</strong> back to the Kremlin. If you trade from the United States, this is a name to stay away from — and you were technically barred from it already. Here is the plain-English version.</p>
    <h2>What actually happened</h2>
    <p>The UK government added HTX to its sanctions list, citing the exchange's role in Russian sanctions-evasion networks. Because Huobi holds more than 50% of HTX, the UK treats HTX as subject to a <strong>UK asset freeze</strong> plus correspondent-banking and payment-processing restrictions. This was a <strong>UK action, not a US OFAC designation</strong> — an important distinction — but the direction of travel is clear.</p>
    <h2>Why US traders should steer clear</h2>
    <ul>
      <li><strong>You are already prohibited.</strong> The HTX user agreement lists the United States among the jurisdictions banned from using its services. US residents are not permitted to open an account, deposit or trade — full stop.</li>
      <li><strong>Sanctions-exposure risk.</strong> US persons can face exposure under US sanctions rules when they deal with sanctioned entities or the infrastructure around them. Parking funds on an exchange a major government has just sanctioned is exactly the counterparty you do not want.</li>
    </ul>
    <h2>The practical danger: frozen funds</h2>
    <p>Sanctions are not just a legal label. A sanctioned exchange can lose banking and payment rails overnight, freeze withdrawals, and leave users unable to get their money out. Even outside the US or UK, funds on HTX now sit with a counterparty under active sanction — that is real, immediate risk, not a hypothetical.</p>
    <h2>What to do instead</h2>
    <p>Use an exchange that is actually <em>available and compliant where you live</em>, with working fiat rails and a clear regulatory standing. Compare the majors on fees, leverage and liquidity before you commit — see our <a href="/bybit-vs-binance/">exchange comparisons</a> — and whichever you choose, plan the trade first: know your <a href="/#liq">liquidation price</a> and size by <a href="/blog/crypto-position-sizing-risk-management/">risk</a>.</p>
    <div class="callout"><div class="k">Trade somewhere that will still be standing tomorrow</div><p style="margin-bottom:14px">Pick a compliant exchange, then plan every trade with free calculators.</p><a class="cta" href="/">Open MarginPad →</a></div>
    <p style="font-size:13px;color:#8a93a0">News and education, not legal or financial advice. Sanctions situations change fast and vary by jurisdiction — verify the current rules and your own legal position before acting. Based on reporting around the 26 May 2026 UK sanctions.</p>`
  },
  {
    slug:'what-is-open-interest', tag:'Basics', read:4, crumb:'Open interest',
    title:'What Is Open Interest in Crypto Futures?',
    desc:'Open interest is the total value of futures contracts still open. Learn what it reveals about momentum, liquidity and potential liquidations.',
    keywords:'open interest crypto, what is open interest, open interest futures, oi crypto trading, open interest vs volume',
    faq:[{q:'What is open interest?',a:'Open interest is the total number or value of futures contracts that are currently open and not yet closed or settled. Rising open interest means new money is entering the market; falling open interest means positions are being closed.'},{q:'What is the difference between open interest and volume?',a:'Volume counts every contract traded in a period, even if it opens and closes minutes later. Open interest counts only positions that remain open. Rising volume with rising open interest signals strong conviction behind a move.'}],
    body:`    <p><strong>Open interest (OI)</strong> is one of the most useful — and most misread — numbers in futures trading. It is simply the total value of all futures contracts that are currently open. Here is what it tells you and how to use it.</p>
    <h2>Open interest vs volume</h2>
    <p>These get confused constantly. <strong>Volume</strong> is how many contracts changed hands in a period; a contract opened and closed in the same hour still adds to volume. <strong>Open interest</strong> is how many contracts are still open right now. If you open a position and someone else takes the other side, OI rises by one. When either of you closes, OI falls.</p>
    <h2>Reading OI with price</h2>
    <ul>
      <li><strong>Price up + OI up</strong> — new longs are driving the move; bullish conviction.</li>
      <li><strong>Price up + OI down</strong> — shorts are covering, not new buying; the rally may be weaker than it looks.</li>
      <li><strong>Price down + OI up</strong> — new shorts piling in; bearish conviction.</li>
      <li><strong>Price down + OI down</strong> — longs capitulating; a flush that can mark a bottom.</li>
    </ul>
    <h2>Why it matters for liquidation risk</h2>
    <p>High open interest means a lot of leveraged positions are stacked up — and when price moves sharply, those positions get liquidated in cascades, accelerating the move. Spikes in OI often precede volatile liquidation events. It also feeds the <a href="/blog/what-is-funding-rate/">funding rate</a>: lopsided OI pushes funding to extremes.</p>
    <div class="callout"><div class="k">Trade the cascade, do not become it</div><p style="margin-bottom:14px">Know your liquidation price before high-OI volatility hits.</p><a class="cta" href="/#liq">Open the liquidation calculator →</a></div>`
  },
  {
    slug:'mark-price-vs-last-price', tag:'Basics', read:4, crumb:'Mark vs last price',
    title:'Mark Price vs Last Price: Why Liquidations Use Mark Price',
    desc:'Your exchange liquidates positions on the mark price, not the last traded price. Here is the difference and why it protects you from manipulation.',
    keywords:'mark price vs last price, what is mark price, mark price liquidation, index price crypto, last price futures',
    faq:[{q:'What is the mark price?',a:'The mark price is a smoothed, manipulation-resistant reference price built from the spot index price plus a funding basis. Exchanges use it to calculate unrealised PnL and to trigger liquidations.'},{q:'Why is my liquidation based on mark price not last price?',a:'Using the mark price stops a single large or manipulated trade from wicking the last price into your liquidation level. It makes liquidations fairer and harder to game.'}],
    body:`    <p>If you have ever watched the price wick down, expected to be liquidated, and somehow survived — the <strong>mark price</strong> is why. Exchanges do not liquidate you on the last traded price. Here is the difference.</p>
    <h2>Last price</h2>
    <p>The <strong>last price</strong> is exactly that: the price of the most recent trade on that contract. It is what you see flashing on the ticker, and it is easy to move with a single large order, especially on thin books.</p>
    <h2>Mark price</h2>
    <p>The <strong>mark price</strong> is a calculated reference designed to resist manipulation. It is built from the <strong>index price</strong> (an average of spot prices across several major exchanges) plus a small funding basis. Because it is averaged across venues, no single trade on one exchange can yank it around.</p>
    <h2>Why it matters</h2>
    <p>Exchanges use the mark price — not last price — to calculate your unrealised PnL and to decide when you are liquidated. That protects you: a brief manipulated wick on the last price will not liquidate a position whose mark price never reached the trigger. It is also why your liquidation may not fire exactly where the ticker briefly printed.</p>
    <p>Our <a href="/#liq">liquidation calculator</a> estimates the level; on a real exchange the trigger is measured against the mark price. Learn the formula in <a href="/blog/how-to-calculate-liquidation-price/">how to calculate liquidation price</a>.</p>
    <div class="callout"><div class="k">Know your level</div><p style="margin-bottom:14px">Estimate your liquidation price for any leverage in seconds.</p><a class="cta" href="/#liq">Open the calculator →</a></div>`
  },
  {
    slug:'best-leverage-for-beginners', tag:'Risk management', read:5, crumb:'Best leverage for beginners',
    title:'Best Leverage for Beginners (Why Less Is More)',
    desc:'High leverage feels powerful but liquidates you fast. Here is the simple math on why beginners should start at 2–5x, with examples.',
    keywords:'best leverage for beginners, what leverage should i use, safe leverage crypto, low leverage trading, beginner leverage',
    faq:[{q:'What leverage should a beginner use?',a:'Most experienced traders suggest 2–5x for beginners. At 5x, it takes roughly a 20% move against you to be liquidated, which gives a stop-loss room to work. At 50–100x, a 1–2% move ends the trade.'},{q:'Is high leverage worth it?',a:'Higher leverage does not increase your edge — it just shrinks the distance to liquidation and magnifies emotion. You can take the same position size with lower leverage and more margin, keeping the same profit potential with far less liquidation risk.'}],
    body:`    <p>New traders almost always use too much leverage. The 100x button looks like a shortcut to big gains — it is actually a shortcut to liquidation. Here is the math, in plain English.</p>
    <h2>Leverage is just your distance to liquidation</h2>
    <p>The buffer before you are liquidated is roughly <code>1 / leverage</code>. So:</p>
    <div class="example">
      <div class="row"><span>5× leverage</span><b>~20% move to liquidation</b></div>
      <div class="row"><span>10× leverage</span><b>~10% move</b></div>
      <div class="row"><span>25× leverage</span><b>~4% move</b></div>
      <div class="row"><span>100× leverage</span><b>~1% move</b></div>
    </div>
    <p>At 100x, ordinary noise — a normal one-percent candle — wipes you out. At 5x, price has to fall 20% before you are liquidated, which is enough room to place a sensible stop-loss.</p>
    <h2>The myth of "more leverage = more profit"</h2>
    <p>Leverage does not change your edge or your position size — you choose those separately. You can hold the exact same $1,000 position at 5x or 50x; the only difference is how much margin you post and how close liquidation sits. Lower leverage with more margin gives the <em>same</em> profit on a move, with far more breathing room. See <a href="/blog/crypto-leverage-explained/">crypto leverage explained</a>.</p>
    <h2>What to do as a beginner</h2>
    <p>Start at <strong>2–5x</strong>. Size by <a href="/blog/crypto-position-sizing-risk-management/">risk, not leverage</a> — decide how much you will lose if your stop hits, and let the calculator find the size. Check your liquidation before every trade.</p>
    <div class="callout"><div class="k">See the difference leverage makes</div><p style="margin-bottom:14px">Compare liquidation distance at 5×, 10× and 100×.</p><a class="cta" href="/#liq">Open the liquidation calculator →</a></div>`
  },
  {
    slug:'what-is-slippage', tag:'Basics', read:4, crumb:'Slippage',
    title:'What Is Slippage in Crypto Trading?',
    desc:'Slippage is the gap between the price you expect and the price you actually get. Learn why it happens and five ways to reduce it.',
    keywords:'what is slippage, slippage crypto, reduce slippage trading, slippage tolerance, market order slippage',
    faq:[{q:'What causes slippage?',a:'Slippage happens when there is not enough liquidity at your expected price, so your order fills at the next available prices. It is worst on thin order books, in fast-moving markets, and with large market orders.'},{q:'How do I reduce slippage?',a:'Use limit orders instead of market orders, trade liquid pairs, split large orders into smaller pieces, and avoid trading into news spikes when books thin out.'}],
    body:`    <p><strong>Slippage</strong> is the difference between the price you expected and the price you actually got. Place a market order at $60,000 and fill at $60,090, and you just paid $90 of slippage. Here is why it happens and how to keep it small.</p>
    <h2>Why slippage happens</h2>
    <p>An order book only has so much size at each price. A market order eats the best prices first, then the next, then the next — so a big order walks up (or down) the book and fills at an average worse than the top. The thinner the book and the bigger or faster your order, the more it slips.</p>
    <h2>When it is worst</h2>
    <ul>
      <li><strong>Thin liquidity</strong> — small-cap alts and off-peak hours.</li>
      <li><strong>Fast markets</strong> — news, liquidations and volatility spikes, when makers pull their orders.</li>
      <li><strong>Large orders</strong> — size relative to the book depth.</li>
    </ul>
    <h2>Five ways to reduce it</h2>
    <ol>
      <li>Use <strong>limit orders</strong> — you set the price; you become the <a href="/blog/maker-vs-taker-fees/">maker</a> and often pay a lower fee too.</li>
      <li>Trade <strong>liquid pairs</strong> (BTC, ETH) where books are deep.</li>
      <li><strong>Split large orders</strong> into smaller pieces.</li>
      <li>Set a <strong>slippage tolerance</strong> where the platform allows it.</li>
      <li><strong>Avoid news spikes</strong> — spreads widen exactly when you are most tempted to chase.</li>
    </ol>
    <p>Slippage is a real cost on top of fees and funding — plan entries and exits instead of chasing. Size every trade with the <a href="/#size">position size calculator</a>.</p>
    <div class="callout"><div class="k">Plan the entry, skip the chase</div><p style="margin-bottom:14px">Know your size, liquidation and risk before you click buy.</p><a class="cta" href="/">Open MarginPad →</a></div>`
  },
  {
    slug:'crypto-futures-legal-in-the-us', tag:'US', read:6, crumb:'US crypto futures',
    title:'Are Crypto Futures Legal in the US? (2026 Update)',
    desc:'For years US traders were shut out of crypto perps. In 2026 the CFTC opened the door. Here is what changed and where Americans can legally trade.',
    keywords:'crypto futures legal us, are crypto perps legal in us, us crypto futures exchanges, cftc crypto perpetual futures, trade crypto futures usa',
    faq:[{q:'Are crypto futures legal in the US?',a:'Yes. CFTC-regulated crypto futures have existed via CME for years, and in 2026 the CFTC cleared the first regulated crypto perpetual futures in the US, with approvals tied to Kalshi, Coinbase and Bitnomial.'},{q:'Can US traders use Binance or Bybit for futures?',a:'No. Offshore exchanges such as Binance, Bybit and OKX restrict or prohibit US users for derivatives. Americans should use CFTC-regulated venues instead — and using a VPN to evade the rules risks frozen funds and account loss.'}],
    body:`    <p>For most of crypto history, US traders got the short end of the futures stick: shut out of the perpetual contracts the rest of the world traded freely, and pushed toward offshore exchanges that technically barred them anyway. In <strong>2026 that changed</strong>. Here is the new landscape — and where Americans can actually trade.</p>
    <h2>The old reality</h2>
    <p>US retail traders had essentially two compliant options: <strong>CME</strong>'s cash-settled Bitcoin and Ether futures, and… not much else. Perpetual futures — the 24/7, no-expiry contracts that dominate global crypto volume — were off the table for US persons. Offshore venues like Binance, Bybit and OKX list the US among prohibited jurisdictions, so trading there meant breaking the terms and risking your funds.</p>
    <h2>What changed in 2026</h2>
    <p>The CFTC opened the door to <strong>regulated crypto perpetual futures in the US</strong>. Key moves:</p>
    <ul>
      <li><strong>Kalshi</strong> received approval for bitcoin perpetual futures on a CFTC-regulated exchange — a first for domestic US perps.</li>
      <li><strong>Coinbase</strong>, through its CFM derivatives arm, was cleared to offer perps routed as "foreign futures," letting US customers post crypto as margin.</li>
      <li><strong>Bitnomial</strong> listed perpetual futures via self-certification.</li>
      <li>The SEC and CFTC issued joint guidance clarifying how crypto assets are classified, reducing the legal grey zone.</li>
    </ul>
    <h2>Where US traders can legally trade</h2>
    <p>For a compliant, onshore experience, US persons should look at CFTC-regulated venues — <strong>CME</strong> (regulated BTC/ETH futures), <strong>Kalshi</strong>, <strong>Coinbase</strong> (CFM perps) and <strong>Bitnomial</strong>. These are regulated, you have legal recourse, and your funds are not sitting on an exchange that bars you.</p>
    <h2>What is still off-limits</h2>
    <p>Offshore derivatives exchanges that prohibit US users remain off-limits. Using a VPN to access them violates their terms and — as the recent <a href="/blog/htx-sanctioned-what-us-traders-should-know/">HTX sanctions</a> showed — leaves your money on a counterparty you cannot rely on. Not worth it.</p>
    <h2>However you trade, the math is the same</h2>
    <p>Regulated or not, leverage still means liquidation risk. A 10x position is liquidated on a roughly 10% move; 100x on about 1%. Before any trade, know your <a href="/#liq">liquidation price</a>, size by <a href="/blog/crypto-position-sizing-risk-management/">risk</a>, and check your <a href="/#rr">risk/reward</a>.</p>
    <div class="callout"><div class="k">Plan every trade — on any platform</div><p style="margin-bottom:14px">Free liquidation, position size and risk/reward calculators. No signup.</p><a class="cta" href="/#liq">Open MarginPad →</a></div>
    <p style="font-size:13px;color:#8a93a0">Educational, not legal or financial advice. US crypto regulation is moving fast in 2026 — confirm the current status and your own eligibility before trading. Based on reporting around the 2026 CFTC actions.</p>`
  }
];

// full list for the index (existing + new), newest first-ish
const INDEX = [
  {slug:'liquidation-clusters-explained', tag:'Liquidation', title:'Liquidation Clusters Explained: How to Spot Liquidity Magnets', card:'What liquidation clusters are, how stacked leverage forms them, and why they pull price like magnets.'},
  {slug:'long-vs-short-liquidations', tag:'Liquidation', title:'Long vs Short Liquidations: What the Balance Tells You', card:'Where long and short liquidations sit, and how the imbalance signals squeeze fuel and cascade risk.'},
  {slug:'liquidation-cascade-explained', tag:'Liquidation', title:'Liquidation Cascades Explained (and How to Avoid Getting Caught)', card:'How one liquidation triggers the next, why cascades happen, and how to stay out of the blast radius.'},
  {slug:'how-to-read-a-liquidation-heatmap', tag:'Liquidation', title:'How to Read a Liquidation Heatmap (Crypto Guide)', card:'What a liquidation heatmap shows, why high-leverage levels cluster near price, and how to trade the zones.'},
  {slug:'how-to-avoid-liquidation', tag:'Risk management', title:'How to Avoid Liquidation in Crypto: 8 Rules That Work', card:'Eight practical rules — lower leverage, the 1% rule, stops inside your liquidation, margin buffers and more.'},
  {slug:'bybit-vs-binance-futures', tag:'Exchanges', title:'Bybit vs Binance for Futures Trading (2026 Comparison)', card:'Fees, liquidity, leverage, UX and regional access compared — a neutral guide to picking your perpetuals venue.'},
  {slug:'how-to-swap-crypto-without-an-account', tag:'Guides', title:'How to Swap Crypto Without an Account (Non-Custodial)', card:'How no-account, non-custodial swaps work — fees, slippage, safety steps, and how to swap on MarginPad.'},
  {slug:'crypto-futures-legal-in-the-us', tag:'US', title:'Are Crypto Futures Legal in the US? (2026 Update)', card:'For years US traders were shut out of crypto perps. In 2026 the CFTC opened the door — what changed and where Americans can legally trade.'},
  {slug:'best-leverage-for-beginners', tag:'Risk management', title:'Best Leverage for Beginners (Why Less Is More)', card:'High leverage feels powerful but liquidates you fast. The simple math on why beginners should start at 2–5x.'},
  {slug:'what-is-open-interest', tag:'Basics', title:'What Is Open Interest in Crypto Futures?', card:'What open interest reveals about momentum, liquidity and the liquidation cascades that move markets.'},
  {slug:'mark-price-vs-last-price', tag:'Basics', title:'Mark Price vs Last Price: Why Liquidations Use Mark Price', card:'Your exchange liquidates on the mark price, not the last trade — and that protects you from manipulation.'},
  {slug:'what-is-slippage', tag:'Basics', title:'What Is Slippage in Crypto Trading?', card:'Why the price you get differs from the price you expected, and five ways to keep slippage small.'},
  {slug:'htx-sanctioned-what-us-traders-should-know', tag:'News', title:'HTX Sanctioned: What US Traders Need to Know (2026)', card:'HTX was sanctioned by the UK over alleged Russian sanctions evasion — and it already bars US users. The risk, and what to do instead.'},
  {slug:'cardano-ada-breaks-020-support', tag:'News', title:'Cardano (ADA) Breaks Multi-Year $0.20 Support — Is $0.10 Next?', card:'ADA hit a five-year low below $0.20 amid governance turmoil and ecosystem failures. What happened, and the level traders watch next.'},
  {slug:'zcash-orchard-counterfeiting-bug', tag:'News', title:'The Zcash Bug That Could Have Minted Unlimited ZEC — Explained', card:'A four-year-old flaw in the Orchard shielded pool could have counterfeited unlimited ZEC. What happened, and the lesson for traders.'},
  {slug:'bitcoin-depot-bankruptcy', tag:'News', title:'Bitcoin Depot, the Biggest US Crypto ATM Operator, Files for Bankruptcy', card:'Chapter 11, ~9,000 machines going dark, and record ATM scam losses — what the crypto-ATM collapse signals.'},
  {slug:'how-to-calculate-liquidation-price', tag:'Liquidation', title:'How to Calculate Liquidation Price (Formula + Examples)', card:'The exact formula exchanges use for isolated margin, why leverage moves your liquidation closer, and three worked examples.'},
  {slug:'crypto-position-sizing-risk-management', tag:'Risk management', title:'Crypto Position Sizing: The 1% Risk Rule Explained', card:'How professional traders decide how big to trade. The risk-based sizing formula that keeps every loss small.'},
  {slug:'what-is-liquidation-in-crypto', tag:'Basics', title:'What Is Liquidation in Crypto Trading (and How to Avoid It)', card:'Liquidation explained simply — what it is, why it happens, and seven ways to avoid it.'},
  {slug:'cross-vs-isolated-margin', tag:'Basics', title:'Cross vs Isolated Margin: Which Should You Use?', card:'The plain-English difference between the two margin modes and how each handles liquidation.'},
  {slug:'crypto-leverage-explained', tag:'Basics', title:'Crypto Leverage Explained: How Much Is Too Much?', card:'What leverage does to your liquidation distance, and how to choose a sane level.'},
  {slug:'what-is-funding-rate', tag:'Basics', title:'What Is Funding Rate in Crypto Futures?', card:'The small payment between traders every few hours — who pays whom, and how it affects PnL.'},
  {slug:'perpetual-futures-explained', tag:'Basics', title:'What Is a Perpetual Futures Contract? (Simple Guide)', card:'How perps differ from spot and traditional futures, why they never expire, and the role of funding.'},
  {slug:'long-vs-short-crypto', tag:'Basics', title:"Long vs Short in Crypto: What's the Difference?", card:'How profit, loss and liquidation work when you go long versus short.'},
  {slug:'how-to-set-a-stop-loss', tag:'Risk management', title:'How to Set a Stop-Loss in Crypto (the Right Way)', card:'Where to place your stop, common mistakes, and how it ties into position size.'},
  {slug:'roe-vs-roi', tag:'Basics', title:"ROE vs ROI in Trading: What's the Difference?", card:'Why a 6% move can be a 60% return, and which number reflects your real performance.'},
  {slug:'spot-vs-futures-trading', tag:'Basics', title:'Spot vs Futures Trading in Crypto Explained', card:'Ownership, leverage, shorting and liquidation — and which one beginners should start with.'},
  {slug:'maker-vs-taker-fees', tag:'Basics', title:'Maker vs Taker Fees Explained', card:'What they mean, why takers pay more, and how to pay the lower maker fee.'},
  {slug:'what-is-a-margin-call', tag:'Basics', title:'What Is a Margin Call in Crypto?', card:'What triggers it, how it differs from liquidation, and how to avoid one.'},
  {slug:'risk-reward-ratio-explained', tag:'Risk management', title:'Risk/Reward Ratio Explained (With Examples)', card:'How to calculate it, what a good ratio looks like, and the win rate you need to break even.'},
  {slug:'crypto-tax-india', tag:'India', title:'Crypto Tax in India: The 30% Tax & 1% TDS Explained (2026)', card:'The flat 30% tax, the 1% TDS, no loss offset — and what it all means for traders.'},
  {slug:'crypto-exchanges-india', tag:'India', title:'Trading Crypto from India in 2026: A Practical Guide', card:'INR on-ramps, P2P, KYC and the 1% TDS — how Indian traders actually access crypto.'},
  {slug:'trading-crypto-in-china', tag:'China', title:'Trading Crypto from Mainland China: The 2026 Reality', card:'The 2021 restrictions, how individuals still access markets, and the risks to understand.'},
  {slug:'crypto-exchanges-for-chinese-traders', tag:'China', title:'Crypto Exchanges with Chinese (中文) Support in 2026', card:'Which major exchanges offer full Chinese-language interfaces and futures.'}
];

// write new article files (compute related guides from the full index)
NEW.push(...EXTRA);
NEW.forEach(a => {
  let rel = INDEX.filter(p => p.tag === a.tag && p.slug !== a.slug);
  if (rel.length < 3) rel = rel.concat(INDEX.filter(p => p.tag !== a.tag && p.slug !== a.slug && !rel.some(x => x.slug === p.slug)));
  a.related = rel.slice(0, 3);
  const dir = path.join(BLOG, a.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), shell(a));
  console.log('wrote blog/' + a.slug);
});

// rebuild blog index
const cats = [];
INDEX.forEach(p => { if (!cats.includes(p.tag)) cats.push(p.tag); });
const chips = `<button class="chip active" data-cat="all">All</button>` + cats.map(c => `<button class="chip" data-cat="${c}">${c}</button>`).join('');
const cards = INDEX.map(p => `    <a class="post-card" data-cat="${p.tag}" href="/blog/${p.slug}/">
      <span class="tag">${p.tag}</span>
      <h2>${p.title}</h2>
      <p>${p.card}</p>
    </a>`).join('\n');
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-18230384038');</script>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>MarginPad Blog — Crypto Futures Trading Guides & Calculators</title>
<meta name="description" content="Practical, plain-English guides for crypto futures traders: liquidation, position sizing, leverage, funding, risk management and more." />
<link rel="canonical" href="https://marginpad.io/blog/" />
<meta property="og:title" content="MarginPad Blog — Crypto Futures Trading Guides" />
<meta property="og:description" content="Practical guides for crypto futures traders, with formulas and examples." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://marginpad.io/blog/" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Familjen+Grotesk:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/assets/blog.css" />
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="/">Calculators</a><a href="/blog/">Blog</a></nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / Blog</div>
  <div class="blog-hero">
    <h1 class="blog-title">The MarginPad Blog</h1>
    <p class="blog-intro">Plain-English crypto-futures guides — liquidation, leverage, risk, exchanges and the tools to trade them. Every guide is backed by the formula and a worked example.</p>
  </div>
  <div class="cat-chips">${chips}</div>
  <div class="posts">
${cards}
  </div>
  <p class="no-res" hidden>No guides in this category yet.</p>
  <script>
  (function(){
    var chips=document.querySelectorAll('.chip'),cards=document.querySelectorAll('.post-card'),nores=document.querySelector('.no-res');
    for(var i=0;i<chips.length;i++){chips[i].addEventListener('click',function(){
      for(var j=0;j<chips.length;j++)chips[j].classList.remove('active');this.classList.add('active');
      var c=this.getAttribute('data-cat'),shown=0;
      for(var k=0;k<cards.length;k++){var ok=(c==='all'||cards[k].getAttribute('data-cat')===c);cards[k].style.display=ok?'':'none';if(ok)shown++;}
      if(nores)nores.hidden=shown>0;
    });}
  })();
  </script>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="/">Calculators</a> · <a href="/blog/">Blog</a></span>
  </footer>
</div>
</body>
</html>
`;
fs.writeFileSync(path.join(BLOG, 'index.html'), indexHtml);
console.log('rebuilt blog/index.html with', INDEX.length, 'articles');

// upgrade any older static posts still using the old single-CTA block (any h3 variant)
fs.readdirSync(BLOG, { withFileTypes: true }).filter(d => d.isDirectory()).forEach(d => {
  const fp = path.join(BLOG, d.name, 'index.html');
  if (!fs.existsSync(fp)) return;
  let html = fs.readFileSync(fp, 'utf8');
  if (/<div class="endcta">[\s\S]*?<\/div>/.test(html)) { html = html.replace(/<div class="endcta">[\s\S]*?<\/div>/, TOOLSHOW); fs.writeFileSync(fp, html); console.log('upgraded CTA in blog/' + d.name); }
});

// auto-add the new articles to the sitemap
const SITEMAP = path.join(__dirname, '..', 'dist', 'sitemap.xml');
if (fs.existsSync(SITEMAP)) {
  let sm = fs.readFileSync(SITEMAP, 'utf8');
  EXTRA.forEach(a => {
    const loc = `https://marginpad.io/blog/${a.slug}/`;
    if (sm.indexOf(loc) === -1) sm = sm.replace('</urlset>', `  <url><loc>${loc}</loc><lastmod>2026-06-11</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n</urlset>`);
  });
  fs.writeFileSync(SITEMAP, sm);
  console.log('sitemap updated');
}
