/* New articles (June 2026). Bodies were authored HTML-escaped; we unescape at load. */
const E = [
{
  slug:'how-to-read-a-liquidation-heatmap', tag:'Liquidation', read:6, crumb:'Reading a liquidation heatmap',
  title:'How to Read a Liquidation Heatmap (Crypto Guide)',
  desc:'Learn how to read a crypto liquidation heatmap: what liquidation zones mean, why high-leverage levels cluster near price, and how to trade them.',
  keywords:'liquidation heatmap, crypto liquidation heatmap, how to read liquidation heatmap, liquidation levels, liquidation zones, liquidity magnets, crypto futures, leverage liquidation',
  body:`&lt;p&gt;A liquidation heatmap is one of the most useful visual tools in crypto futures trading, but it is also one of the most misunderstood. This guide explains what it actually shows, why liquidation levels cluster where they do, and how to use that information without falling for the common myths.&lt;/p&gt;

&lt;h2&gt;What is a liquidation heatmap?&lt;/h2&gt;
&lt;p&gt;A liquidation heatmap is a chart that overlays estimated &lt;strong&gt;liquidation price levels&lt;/strong&gt; on top of normal price candles. Instead of just showing where price has been, it highlights the price zones where leveraged positions would be forcibly closed by the exchange. Bright or dense areas mark where a lot of leverage is likely sitting; empty areas mark where little is at risk.&lt;/p&gt;
&lt;p&gt;The core idea is simple. Every leveraged trade has a liquidation price set the moment it opens. If you take a long with &lt;code&gt;10x&lt;/code&gt; leverage, your position gets liquidated roughly when price falls about 10% from entry. A short at the same leverage gets liquidated when price rises about 10%. A heatmap aggregates millions of these levels into a single picture so you can see where forced selling or forced buying would concentrate.&lt;/p&gt;

&lt;h2&gt;What liquidation levels and zones represent&lt;/h2&gt;
&lt;p&gt;A single liquidation level is the price at which one position runs out of margin and is closed automatically. You can compute one yourself with the &lt;a href="/#liq"&gt;liquidation calculator&lt;/a&gt;, or read the full method in our guide on &lt;a href="/blog/how-to-calculate-liquidation-price/"&gt;how to calculate liquidation price&lt;/a&gt;. The rough formula for a long is &lt;code&gt;entry x (1 - 1/leverage)&lt;/code&gt;, and for a short it is &lt;code&gt;entry x (1 + 1/leverage)&lt;/code&gt;.&lt;/p&gt;
&lt;p&gt;A liquidation &lt;strong&gt;zone&lt;/strong&gt; is what you get when many of those levels stack up at similar prices. Zones matter because liquidations are not quiet. When a cluster of longs gets liquidated, the exchange sells those positions into the market, pushing price down further and potentially triggering the next cluster below. The same happens in reverse for shorts. This chain reaction is why a dense zone behaves very differently from an empty stretch of chart.&lt;/p&gt;

&lt;h2&gt;Why high-leverage liquidations cluster close to price&lt;/h2&gt;
&lt;p&gt;The single most important thing to understand is the relationship between leverage and distance. The higher the leverage, the closer the liquidation price sits to the entry price. At &lt;code&gt;100x&lt;/code&gt;, a position is wiped out by roughly a 1% move against it. At &lt;code&gt;50x&lt;/code&gt; it takes about 2%, at &lt;code&gt;25x&lt;/code&gt; about 4%, and at &lt;code&gt;10x&lt;/code&gt; about 10%.&lt;/p&gt;
&lt;p&gt;Because high-leverage traders are liquidated by tiny moves, their liquidation levels sit right next to the current price. That is why the band immediately above and below the candle is usually the most crowded and most reactive part of any heatmap. If you want the full picture of how this distance scales, see &lt;a href="/blog/crypto-leverage-explained/"&gt;leverage explained&lt;/a&gt;. The practical takeaway: the levels nearest to price are the high-leverage ones, and they are the first to get hit on any sharp move.&lt;/p&gt;

&lt;div class="callout"&gt;&lt;div class="k"&gt;SEE IT LIVE&lt;/div&gt;&lt;p style="margin-bottom:14px"&gt;MarginPad's interactive heatmap plots real candles with every leverage's liquidation level — pan, zoom and hover for exact prices.&lt;/p&gt;&lt;a class="cta" href="/?p=heat"&gt;Open the liquidation heatmap →&lt;/a&gt;&lt;/div&gt;

&lt;h2&gt;How clusters act as magnets and as support or resistance&lt;/h2&gt;
&lt;p&gt;Traders often describe liquidation clusters as &lt;strong&gt;magnets&lt;/strong&gt;. The logic is that resting liquidations are a pool of guaranteed orders. A cluster of long liquidations below price is a pool of pending market sells; a cluster of short liquidations above price is a pool of pending market buys. Market makers and large players have an incentive to push price toward that resting liquidity, because it lets them fill size and trigger a cascade.&lt;/p&gt;
&lt;p&gt;So a heatmap can be read two ways at once:&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;&lt;strong&gt;As a target.&lt;/strong&gt; A thick cluster slightly above or below current price often acts like a magnet that price drifts toward, especially during low-volatility periods.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;As support or resistance.&lt;/strong&gt; Once a cluster is consumed, that price area can flip. The cascade exhausts the leverage there, and the zone may then act as a floor or ceiling because the forced flow that would have pushed through it is gone.&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;This is also closely tied to the mechanics of forced closure itself. If you are fuzzy on the underlying event, our explainer on &lt;a href="/blog/what-is-liquidation-in-crypto/"&gt;what is liquidation&lt;/a&gt; covers why these orders are non-negotiable market orders rather than limit orders.&lt;/p&gt;

&lt;h2&gt;Long zones versus short zones&lt;/h2&gt;
&lt;p&gt;Direction matters. &lt;strong&gt;Long liquidations sit below the current price&lt;/strong&gt;, because longs lose money when price falls. &lt;strong&gt;Short liquidations sit above the current price&lt;/strong&gt;, because shorts lose money when price rises. A heatmap with a heavy band below price tells you a lot of long leverage is exposed to a drop; a heavy band above price tells you a lot of short leverage is exposed to a squeeze.&lt;/p&gt;
&lt;p&gt;Reading both sides together is where the edge is. A market with thin liquidity above and a dense cluster below is structurally fragile to the downside, since a small dip can ignite a long-liquidation cascade. The reverse setup, a dense band above price, is the classic short-squeeze fuel that powers sudden vertical rallies.&lt;/p&gt;

&lt;h2&gt;An honest caveat: it is a model, not order-book data&lt;/h2&gt;
&lt;p&gt;This matters and most guides skip it. An estimated liquidation heatmap is a &lt;strong&gt;model&lt;/strong&gt;, not a direct readout of the exchange order book. It infers where leverage probably sits by assuming positions were opened at recent prices across a range of common leverage settings. It does not know the actual size, entry, or margin mode of any specific trader, and it cannot see cross-margin or hedged positions.&lt;/p&gt;
&lt;p&gt;Treat the heatmap as a map of &lt;em&gt;probable&lt;/em&gt; liquidity, not certainty. Real markets contain stop-losses, partial closes, added margin, and isolated-versus-cross differences that no model captures perfectly. Use it to understand structure and risk, not as a guaranteed price prediction. Combine it with your own analysis rather than trading it blindly.&lt;/p&gt;

&lt;h2&gt;How to use MarginPad's heatmap&lt;/h2&gt;
&lt;p&gt;The &lt;a href="/?p=heat"&gt;liquidation heatmap&lt;/a&gt; on MarginPad is built to make all of this readable at a glance. Here is the colour and layout convention:&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;&lt;strong&gt;White line = current price.&lt;/strong&gt; Everything is oriented around it.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Green = long liquidations below price.&lt;/strong&gt; These are the levels exposed if the market drops.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Blue = short liquidations above price.&lt;/strong&gt; These are the levels exposed if the market rises.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;100x sits nearest the price&lt;/strong&gt; on each side, with lower leverages plotted progressively further away, so distance from the white line maps directly to how risky a position is.&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;To use it, plot real candles, then pan and zoom to the area around current price and hover any level to read its exact liquidation price. Look for the densest green band below and the densest blue band above. Those are your most likely magnets and your most important support and resistance zones. If you want to verify a specific number, drop the price and leverage into the &lt;a href="/#liq"&gt;liquidation calculator&lt;/a&gt; and confirm it lines up with what the heatmap shows.&lt;/p&gt;

&lt;h2&gt;Putting it together&lt;/h2&gt;
&lt;p&gt;A liquidation heatmap will not tell you the future, but it tells you where the market is structurally fragile and where forced flow is likely to appear. Read the nearest, highest-leverage clusters first, watch how price interacts with the dense green and blue bands, and always remember you are looking at an estimate of where leverage sits, not a certified order book. Used that way, it becomes one of the sharpest context tools in a futures trader's kit.&lt;/p&gt;`,
  faq:[
    {q:'What does a liquidation heatmap actually show?',a:'It overlays estimated liquidation price levels on the price chart, highlighting the zones where leveraged longs or shorts would be forcibly closed. Dense areas mark where a lot of leverage is likely concentrated and where forced buying or selling could cluster.'},
    {q:'Why do liquidation levels cluster close to the current price?',a:'Because high-leverage positions liquidate on tiny moves. A 100x position is wiped out by about a 1% move, so its liquidation level sits right next to entry. The crowded band immediately above and below price is mostly high-leverage traders.'},
    {q:'Are liquidation heatmaps accurate?',a:'They are a model, not a direct order-book readout. They estimate where leverage probably sits by assuming common entries and leverage settings. They cannot see actual position size, margin mode, or stops, so treat them as probable liquidity, not certainty.'},
    {q:'Do long liquidations sit above or below price?',a:'Long liquidations sit below the current price because longs lose money as price falls. Short liquidations sit above the current price because shorts lose money as price rises. A heavy band below price signals downside fragility; a heavy band above signals squeeze potential.'}
  ]
},
{
  slug:'how-to-swap-crypto-without-an-account', tag:'Guides', read:6, crumb:'Swap crypto without an account',
  title:'How to Swap Crypto Without an Account (Non-Custodial Guide)',
  desc:'Learn how to swap crypto without an account or KYC. A plain-English, non-custodial guide to instant exchangers, fees, slippage, safety steps, and swapping on MarginPad.',
  keywords:'swap crypto without account, non-custodial swap, no KYC crypto exchange, instant crypto exchange, crypto swap guide, how to swap crypto, ChangeNOW swap, exchange crypto safely',
  body:`&lt;p&gt;Swapping one coin for another usually means signing up for an exchange, passing identity checks, and trusting that platform to hold your money. A non-custodial swap skips most of that: you exchange coins directly between your own wallets, no account required. This guide explains how it works, what to watch out for, and how to do it safely.&lt;/p&gt;

&lt;h2&gt;What a no-account, non-custodial swap actually is&lt;/h2&gt;
&lt;p&gt;A &lt;strong&gt;non-custodial swap&lt;/strong&gt; lets you trade crypto without handing your funds to a company or creating a login. There is no balance sitting in an account, no password to reset, and usually no sign-up at all. You start the swap, send coins from your own wallet, and receive the new coins straight to a wallet you control. The service simply coordinates the exchange and moves on.&lt;/p&gt;
&lt;p&gt;This is different from a traditional exchange, where you deposit funds, they appear as a number in your account, and you trust the company to let you withdraw later. With a non-custodial &lt;a href="/?p=swap"&gt;crypto swap&lt;/a&gt;, your coins are only ever in transit between two wallets you own.&lt;/p&gt;

&lt;h2&gt;How instant exchangers work&lt;/h2&gt;
&lt;p&gt;Instant exchangers follow a simple pattern. You pick the coin you are sending (coin A) and the coin you want to receive (coin B), enter an amount, and paste the wallet address where coin B should land. The service then shows you a one-time &lt;strong&gt;deposit address&lt;/strong&gt;.&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;You send coin A to that deposit address from your own wallet.&lt;/li&gt;
&lt;li&gt;The exchanger detects your incoming transaction on the blockchain.&lt;/li&gt;
&lt;li&gt;It converts coin A to coin B at the agreed rate, often using liquidity from partner exchanges.&lt;/li&gt;
&lt;li&gt;It sends coin B to the receiving address you provided.&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;The whole process is typically driven by the blockchain, not by a balance in an account. Once both transactions confirm, the swap is done and there is nothing left to log into.&lt;/p&gt;

&lt;h2&gt;Custodial vs non-custodial: not your keys, not your coins&lt;/h2&gt;
&lt;p&gt;The phrase &lt;strong&gt;not your keys, not your coins&lt;/strong&gt; captures the core difference. With a custodial service, the company holds the private keys, so they technically control your funds while they sit on the platform. If the service freezes accounts, gets hacked, or goes offline, your coins can be stuck.&lt;/p&gt;
&lt;p&gt;With a non-custodial swap, you hold the keys to both the sending and receiving wallets. The exchanger only touches the coins during the brief conversion window, and never asks you to deposit a long-term balance. That smaller surface of trust is the main appeal. It also means there is no one to recover funds for you if you make a mistake, so care matters more.&lt;/p&gt;

&lt;h2&gt;Why many swaps skip accounts and KYC&lt;/h2&gt;
&lt;p&gt;Because a non-custodial swap does not hold your balance over time, many providers do not require an account or identity verification for ordinary amounts. You are not opening a financial account; you are using a one-off conversion service. This makes swaps fast and private for everyday use.&lt;/p&gt;
&lt;p&gt;Be realistic, though: providers may still apply automated compliance checks, and unusually large or flagged transactions can trigger extra verification. No-KYC is common, not guaranteed. Always assume on-chain activity is public and traceable.&lt;/p&gt;

&lt;div class="callout"&gt;&lt;div class="k"&gt;SWAP ON MARGINPAD&lt;/div&gt;&lt;p style="margin-bottom:14px"&gt;Swap 900+ coins with no account — non-custodial, your funds and addresses never touch MarginPad.&lt;/p&gt;&lt;a class="cta" href="/?p=swap"&gt;Open the crypto swap →&lt;/a&gt;&lt;/div&gt;

&lt;h2&gt;Fixed vs floating rates, fees, and slippage&lt;/h2&gt;
&lt;p&gt;Most instant exchangers offer two rate types:&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;&lt;strong&gt;Fixed rate&lt;/strong&gt; locks the amount you receive when you start the swap. You know the exact output, but you usually pay a slightly worse rate for that certainty.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Floating rate&lt;/strong&gt; settles at the market rate when your deposit arrives. You may get more or less than the original estimate depending on how prices move.&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;On top of the rate, watch for costs that are easy to overlook:&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;&lt;strong&gt;Network (gas) fees&lt;/strong&gt; are charged by the blockchain itself, not the swap service. Sending on a congested network like Ethereum can cost noticeably more than a cheaper chain.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Slippage&lt;/strong&gt; is the gap between the price you expected and the price you actually got, common with volatile pairs. If you trade often, our guide on &lt;a href="/blog/what-is-slippage/"&gt;what is slippage&lt;/a&gt; explains how to keep it small.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Spread&lt;/strong&gt; is baked into the quoted rate, similar to how trading venues separate &lt;a href="/blog/maker-vs-taker-fees/"&gt;maker vs taker fees&lt;/a&gt;.&lt;/li&gt;
&lt;/ul&gt;

&lt;h2&gt;Safety steps before you hit send&lt;/h2&gt;
&lt;p&gt;A swap is a normal blockchain transaction, which means it is irreversible. If coins go to the wrong place or the wrong network, they are usually gone for good. A few habits prevent almost every disaster:&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;&lt;strong&gt;Double-check the receiving address.&lt;/strong&gt; Copy and paste it, then verify the first and last several characters. Watch for clipboard-hijacking malware that swaps the address.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Verify the network.&lt;/strong&gt; A USDT &lt;code&gt;ERC20&lt;/code&gt; address is not the same as a USDT &lt;code&gt;TRC20&lt;/code&gt; address. Sending on the wrong network is a common way to lose funds.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Send a small test first.&lt;/strong&gt; For a large swap, send a small amount, confirm it arrives, then send the rest. The extra gas fee is cheap insurance.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Confirm the deposit address each time.&lt;/strong&gt; Deposit addresses are usually single-use, so never reuse an old one from a previous swap.&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;These same habits apply whether you are moving coins, building a long-term stack, or rotating between assets. If you are weighing simple buy-and-hold against leveraged trading, see &lt;a href="/blog/spot-vs-futures-trading/"&gt;spot vs futures&lt;/a&gt;.&lt;/p&gt;

&lt;h2&gt;How to swap on MarginPad, step by step&lt;/h2&gt;
&lt;p&gt;The &lt;a href="/?p=swap"&gt;crypto swap&lt;/a&gt; on MarginPad is built for exactly this no-account flow. Here is the full process:&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;&lt;strong&gt;Pick from and to.&lt;/strong&gt; Choose the coin you are sending and the coin you want to receive from 900+ supported assets.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Enter the amount.&lt;/strong&gt; Type how much you want to swap and review the estimated output, fees, and rate type.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Paste your receiving wallet address.&lt;/strong&gt; Use an address you control on the correct network, then double-check it.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Send your coins.&lt;/strong&gt; Send coin A to the one-time deposit address shown, ideally after a small test transaction.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Wait for confirmations.&lt;/strong&gt; The swap detects your deposit, converts it, and sends coin B to your wallet. No login, no balance to manage afterward.&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;To be clear about how this works: swaps are processed by a third-party provider, &lt;strong&gt;ChangeNOW&lt;/strong&gt;. MarginPad never holds your funds, never takes custody of your keys, and your wallet addresses do not stay on MarginPad. The site simply gives you a clean front end to a non-custodial exchange.&lt;/p&gt;

&lt;h2&gt;The bottom line&lt;/h2&gt;
&lt;p&gt;A non-custodial, no-account swap is one of the fastest ways to move between coins while keeping control of your own keys. The trade-off is responsibility: there is no support desk to undo a mistake, so the receiving address and network are entirely on you. Verify carefully, test with a small amount first, and a no-account swap becomes a genuinely simple, private way to exchange crypto.&lt;/p&gt;`,
  faq:[
    {q:'Do I really need no account to swap crypto?',a:'For most non-custodial instant swaps, no. You do not create a login or deposit a balance — you send from your own wallet and receive to your own wallet. Some providers may still run automated compliance checks on unusual or large transactions.'},
    {q:'Is a non-custodial swap safe?',a:'The model is safer in one key way: you hold your keys and the service only touches your coins briefly during conversion. But transactions are irreversible, so safety depends on you. Always verify the receiving address and network, and send a small test for large swaps.'},
    {q:'What is the difference between a fixed and floating rate?',a:'A fixed rate locks your output amount when you start the swap, giving certainty at a slightly worse rate. A floating rate settles at the market price when your deposit arrives, so you may receive a bit more or less than the estimate.'},
    {q:'Does MarginPad hold my funds or keys?',a:'No. Swaps are processed by a third-party provider, ChangeNOW. MarginPad never takes custody of your coins or private keys, and your wallet addresses are not stored on the site — it only provides the front end to a non-custodial swap.'}
  ]
},
{
  slug:'how-to-avoid-liquidation', tag:'Risk management', read:7, crumb:'How to avoid liquidation',
  title:'How to Avoid Liquidation in Crypto: 8 Rules That Work',
  desc:'Learn how to avoid liquidation in crypto futures with 8 practical rules: lower leverage, the 1% sizing rule, stop-losses, margin buffers, and more.',
  keywords:'how to avoid liquidation, crypto liquidation, futures risk management, leverage, stop-loss, position sizing, isolated margin, liquidation price',
  body:`&lt;p&gt;Liquidation is the fastest way to lose a futures account, but it is almost always avoidable. It is not bad luck — it is the predictable result of too much leverage, no stop-loss, or a position that was too big for the account. Here are 8 rules that genuinely keep you in the game.&lt;/p&gt;

&lt;p&gt;If you are new to the mechanics, start with &lt;a href="/blog/what-is-liquidation-in-crypto/"&gt;what is liquidation&lt;/a&gt; so the rules below make sense. Otherwise, let's get practical.&lt;/p&gt;

&lt;h2&gt;1. Use less leverage than you think you need&lt;/h2&gt;
&lt;p&gt;Leverage is the single biggest driver of liquidation, because it shrinks the distance between your entry and your liquidation price. The higher the leverage, the smaller the move that wipes you out.&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;&lt;strong&gt;2x&lt;/strong&gt; survives roughly a &lt;code&gt;45-50% move&lt;/code&gt; against you.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;5x&lt;/strong&gt; is roughly an &lt;code&gt;18-20% move&lt;/code&gt;.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;10x is roughly a 9-10% move&lt;/strong&gt;.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;25x&lt;/strong&gt; is roughly a &lt;code&gt;3-4% move&lt;/code&gt; — a single candle.&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;Crypto routinely moves 5-10% in a day. At 25x, normal noise liquidates you. Picking a leverage you can actually survive is the foundation everything else sits on. When in doubt, halve it.&lt;/p&gt;

&lt;h2&gt;2. Size by risk, not by gut&lt;/h2&gt;
&lt;p&gt;Most blow-ups come from position size, not direction. The fix is the &lt;strong&gt;1% rule&lt;/strong&gt;: never risk more than 1% of your account on a single trade. Risk is the distance from your entry to your stop-loss, not the notional size of the position.&lt;/p&gt;
&lt;p&gt;If your account is 10,000 USDT and your stop is 2% away, your maximum position is &lt;code&gt;(10000 x 0.01) / 0.02 = 5,000 USDT&lt;/code&gt; notional. Let the math set your size. Our &lt;a href="/#size"&gt;position size calculator&lt;/a&gt; does this in one step, and &lt;a href="/blog/crypto-position-sizing-risk-management/"&gt;position sizing&lt;/a&gt; covers the full method.&lt;/p&gt;

&lt;h2&gt;3. Always set a stop-loss inside your liquidation price&lt;/h2&gt;
&lt;p&gt;A stop-loss is a manual exit you choose; liquidation is a forced exit the exchange takes — usually with a fee and worse fill. Your stop must always trigger &lt;strong&gt;before&lt;/strong&gt; price reaches your liquidation level, with room to spare.&lt;/p&gt;
&lt;p&gt;If your liquidation is 9% away, do not place your stop at 8.9%. Wicks and slippage will hit liquidation first. Keep a clear gap. See &lt;a href="/blog/how-to-set-a-stop-loss/"&gt;how to set a stop-loss&lt;/a&gt; for placement that respects market structure rather than round numbers.&lt;/p&gt;

&lt;div class="callout"&gt;&lt;div class="k"&gt;KNOW YOUR EXIT&lt;/div&gt;&lt;p style="margin-bottom:14px"&gt;Check your exact liquidation price before you enter — then see where every leverage liquidates on the heatmap.&lt;/p&gt;&lt;a class="cta" href="/#liq"&gt;Open the liquidation calculator →&lt;/a&gt;&lt;/div&gt;

&lt;h2&gt;4. Keep a margin buffer — and add margin when it matters&lt;/h2&gt;
&lt;p&gt;Trading with every available coin as margin leaves no cushion. A small buffer of unused balance moves your liquidation price further away and buys you time during a sharp move.&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;Keep part of your balance uncommitted instead of maxing out margin.&lt;/li&gt;
&lt;li&gt;If a trade goes against you but your thesis is intact, &lt;strong&gt;adding margin&lt;/strong&gt; pushes liquidation further away.&lt;/li&gt;
&lt;li&gt;Never add margin just to avoid admitting a trade is wrong — that is rule 7 territory.&lt;/li&gt;
&lt;/ul&gt;

&lt;h2&gt;5. Prefer isolated margin to ring-fence risk&lt;/h2&gt;
&lt;p&gt;With &lt;strong&gt;cross margin&lt;/strong&gt;, your whole balance backs every position, so one bad trade can liquidate everything. With &lt;strong&gt;isolated margin&lt;/strong&gt;, only the margin assigned to that position is at risk — the rest of your account is protected.&lt;/p&gt;
&lt;p&gt;For most traders, isolated margin is the safer default because it caps the damage of any single mistake. &lt;a href="/blog/cross-vs-isolated-margin/"&gt;cross vs isolated margin&lt;/a&gt; breaks down when each one makes sense.&lt;/p&gt;

&lt;h2&gt;6. Watch funding and high-volatility events&lt;/h2&gt;
&lt;p&gt;Two things quietly push traders toward liquidation. First, &lt;strong&gt;funding rates&lt;/strong&gt;: holding a leveraged position through many funding periods slowly bleeds margin, moving your liquidation price closer. Second, scheduled &lt;strong&gt;volatility events&lt;/strong&gt; — CPI prints, FOMC, major token unlocks — produce violent wicks that hunt liquidations.&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;Check the funding rate before holding a position overnight.&lt;/li&gt;
&lt;li&gt;Reduce size or leverage ahead of known high-impact news.&lt;/li&gt;
&lt;li&gt;Remember that thin weekend liquidity exaggerates moves.&lt;/li&gt;
&lt;/ul&gt;

&lt;h2&gt;7. Do not revenge-trade or over-leverage after a loss&lt;/h2&gt;
&lt;p&gt;The trade after a painful loss is the most dangerous one you will make. The urge to win it all back instantly leads to oversized, over-leveraged positions placed without a plan — the exact recipe for liquidation.&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;Step away after a loss instead of immediately re-entering.&lt;/li&gt;
&lt;li&gt;Keep your size and leverage rules fixed; never increase them to "make it back".&lt;/li&gt;
&lt;li&gt;One liquidation is a setback. Chasing it can empty the account.&lt;/li&gt;
&lt;/ul&gt;

&lt;h2&gt;8. Check your numbers before every trade&lt;/h2&gt;
&lt;p&gt;None of the rules above work if you are guessing at the numbers. Before you enter, know your exact liquidation price, your position size, and where every leverage level would liquidate.&lt;/p&gt;
&lt;p&gt;Run the entry through the &lt;a href="/#liq"&gt;liquidation calculator&lt;/a&gt; to confirm liquidation is comfortably beyond your stop, size it with the &lt;a href="/#size"&gt;position size calculator&lt;/a&gt;, and use the &lt;a href="/?p=heat"&gt;liquidation heatmap&lt;/a&gt; to see how dramatically higher leverage pulls liquidation toward your entry. Thirty seconds of checking prevents most forced exits.&lt;/p&gt;

&lt;h2&gt;Worked example: size so a normal move cannot liquidate you&lt;/h2&gt;
&lt;p&gt;Say you have a &lt;strong&gt;$2,000&lt;/strong&gt; account and you want to risk 1% (&lt;strong&gt;$20&lt;/strong&gt;) on a BTC long at $60,000, with your stop 3% away at $58,200. Your position size is risk ÷ stop distance = &lt;code&gt;$20 ÷ 0.03&lt;/code&gt; ≈ &lt;strong&gt;$667&lt;/strong&gt; of exposure — regardless of leverage. At 10× that needs only about $67 of margin, and your liquidation sits roughly 9% away, three times further than your $58,200 stop. The stop does the work; the exchange&apos;s liquidation engine never gets a turn. The table below shows why the same trade becomes a coin-flip at higher leverage:&lt;/p&gt;
&lt;table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px"&gt;
&lt;thead&gt;&lt;tr&gt;&lt;th style="text-align:left;padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);font-family:'Space Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.05em"&gt;Leverage&lt;/th&gt;&lt;th style="text-align:left;padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);font-family:'Space Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.05em"&gt;Liquidation distance&lt;/th&gt;&lt;th style="text-align:left;padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);font-family:'Space Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.05em"&gt;Is a 3% stop safely inside?&lt;/th&gt;&lt;/tr&gt;&lt;/thead&gt;
&lt;tbody&gt;
&lt;tr&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;&lt;strong&gt;5×&lt;/strong&gt;&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;~18%&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);color:#34d99a"&gt;Yes — a huge buffer&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;&lt;strong&gt;10×&lt;/strong&gt;&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;~9%&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);color:#34d99a"&gt;Yes — 3× the stop&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;&lt;strong&gt;25×&lt;/strong&gt;&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;~3.5%&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);color:#ffd75a"&gt;Barely — a wick could beat it&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;&lt;strong&gt;50×&lt;/strong&gt;&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;~1.5%&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);color:#ff7b72"&gt;No — liquidation is inside your stop&lt;/td&gt;&lt;/tr&gt;
&lt;/tbody&gt;&lt;/table&gt;
&lt;p&gt;The lesson: at 50× your liquidation is closer than your stop, so the exchange decides your exit, not you. Keep leverage low enough that your stop always triggers first.&lt;/p&gt;

&lt;h2&gt;See where liquidations are happening right now&lt;/h2&gt;
&lt;p&gt;These rules are easier to internalise when you watch the consequences in real time. MarginPad&apos;s &lt;a href="/liquidations/"&gt;live liquidations feed&lt;/a&gt; shows how much leverage is being wiped out across Binance, Bybit and OKX every few minutes, and the &lt;a href="/rekt/"&gt;Rekt ticker&lt;/a&gt; streams the biggest individual hits as they land. Watching a wave of long liquidations cascade through a support level makes the case for a wider buffer far better than any rule can.&lt;/p&gt;
&lt;p&gt;Every major coin also has its own live page — &lt;a href="/liquidations/btc/"&gt;BTC&lt;/a&gt;, &lt;a href="/liquidations/eth/"&gt;ETH&lt;/a&gt;, &lt;a href="/liquidations/sol/"&gt;SOL&lt;/a&gt; and more — with the 24-hour total, the long-versus-short split, and where that coin ranks among the most-liquidated markets. Check the coin you trade before you size up: a market that has just flushed a huge cluster of longs behaves very differently from a quiet one. Then rehearse the whole plan risk-free on the &lt;a href="/paper-trade"&gt;paper-trading terminal&lt;/a&gt; at the live price, and keep the &lt;a href="/calendar/"&gt;economic calendar&lt;/a&gt; open — the most violent cascades cluster around CPI and FOMC.&lt;/p&gt;

&lt;p&gt;Avoiding liquidation is not about predicting the market perfectly — it is about building in enough margin for error that a single move cannot end your account. Lower your leverage, size by risk, always trade with a stop inside your liquidation price, and verify the numbers before every entry. Do that consistently and liquidation stops being a threat and becomes something you simply trade around.&lt;/p&gt;`,
  faq:[
    {q:'What is the main cause of liquidation in crypto?',a:'Excessive leverage combined with oversized positions. High leverage shrinks the distance between your entry and liquidation price, so a normal market move can force you out. Lowering leverage and sizing by risk fixes most of it.'},
    {q:'Does a stop-loss prevent liquidation?',a:'Yes, if it is placed inside your liquidation price with room to spare. A stop is your chosen exit that triggers before the exchange forces a liquidation, so you exit on your terms with a better fill and lower fees.'},
    {q:'Is isolated or cross margin safer for avoiding liquidation?',a:'Isolated margin is safer for most traders because only the margin assigned to a position is at risk. With cross margin your entire balance can be liquidated by one bad trade.'},
    {q:'How much leverage is safe for crypto futures?',a:'There is no single safe number, but lower is safer. At 10x a roughly 9-10% move liquidates you, and crypto moves that much regularly. Many traders stay at 2x-5x and let position sizing, not leverage, drive returns.'}
  ]
},
{
  slug:'bybit-vs-binance-futures', tag:'Exchanges', read:7, crumb:'Bybit vs Binance',
  title:'Bybit vs Binance for Futures Trading (2026 Comparison)',
  desc:'Bybit vs Binance for crypto futures in 2026: compare fees, liquidity, leverage, margin modes, UX and regional access to pick the right perpetuals venue.',
  keywords:'bybit vs binance, crypto futures, perpetual futures, futures fees, maker taker fees, leverage trading, exchange comparison, derivatives exchange',
  body:`&lt;p&gt;Bybit and Binance are two of the largest venues for crypto perpetual futures, and traders constantly ask which one is better. The honest answer is that they overlap heavily and the right pick depends on what you trade, where you live, and how you weigh liquidity against user experience.&lt;/p&gt;

&lt;p&gt;This is a balanced, exchange-neutral comparison. We will not crown a single absolute winner. Instead we will walk through the factors that actually matter so you can choose for yourself. All numbers below are approximate and described as typical structures as of 2026 — always verify current terms directly on each exchange before trading.&lt;/p&gt;

&lt;h2&gt;Quick verdict&lt;/h2&gt;
&lt;p&gt;Both are mature, high-volume derivatives platforms with deep order books and competitive fees. As a rough heuristic:&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;&lt;strong&gt;Binance&lt;/strong&gt; tends to lead on raw liquidity, the widest market list, and the broadest product range across spot, futures, options and more.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Bybit&lt;/strong&gt; is known for a clean, derivatives-first interface and strong altcoin perpetual markets, which many active futures traders find pleasant to use.&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;If you trade large size in major pairs, the deepest book often wins. If you prioritize a streamlined futures-focused UX and altcoin perps, the gap narrows considerably.&lt;/p&gt;

&lt;h2&gt;Products and markets&lt;/h2&gt;
&lt;p&gt;Binance offers an enormous range: USDT-margined and coin-margined perpetuals, dated futures, options, and a very long list of trading pairs. Bybit also covers USDT and inverse perpetuals plus dated contracts and options, with a market list that is broad though typically not as exhaustive as Binance's.&lt;/p&gt;
&lt;p&gt;For most traders the popular pairs — BTC, ETH and the top altcoins — are available on both. If you hunt newly listed or long-tail altcoin perpetuals, check both, since listing timing and availability differ. If you are still getting comfortable with how these contracts work, our &lt;a href="/blog/perpetual-futures-explained/"&gt;perpetual futures explained&lt;/a&gt; guide covers funding rates and mark price.&lt;/p&gt;

&lt;h2&gt;Fees (maker/taker)&lt;/h2&gt;
&lt;p&gt;Both exchanges use a standard maker/taker model with VIP tiers based on volume and, in some cases, native-token holdings. As a general shape, not a quote:&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;Base taker fees on perpetuals are commonly around &lt;code&gt;0.04%&lt;/code&gt; to &lt;code&gt;0.06%&lt;/code&gt;.&lt;/li&gt;
&lt;li&gt;Base maker fees are typically lower, and at higher VIP tiers makers can approach zero or even receive small rebates.&lt;/li&gt;
&lt;li&gt;Holding or using the exchange's native token (BNB on Binance) can reduce effective fees on some products.&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;Headline differences are usually small for retail-size traders; funding payments and slippage often matter more than the few basis points of fee difference. To understand which side of the spread you are paying, see &lt;a href="/blog/maker-vs-taker-fees/"&gt;maker vs taker fees&lt;/a&gt;. Always confirm the current fee schedule and any promotions on each exchange, since these change frequently.&lt;/p&gt;

&lt;h2&gt;Liquidity and depth&lt;/h2&gt;
&lt;p&gt;Liquidity is where Binance most often pulls ahead. It generally carries the deepest order books and highest volumes across the widest set of pairs, which means tighter spreads and less slippage on large orders, especially in less popular markets.&lt;/p&gt;
&lt;p&gt;Bybit is also highly liquid in major pairs and many altcoin perps — for typical retail order sizes you may not notice a meaningful difference. The gap tends to show up when you trade size, trade thin markets, or place orders during volatile moves. If slippage is a core concern for your strategy, test both with realistic order sizes.&lt;/p&gt;

&lt;div class="callout"&gt;&lt;div class="k"&gt;PLAN BEFORE YOU PICK&lt;/div&gt;&lt;p style="margin-bottom:14px"&gt;Whatever exchange you choose, check your liquidation price and size by risk first — free, works with any venue.&lt;/p&gt;&lt;a class="cta" href="/#liq"&gt;Open the calculators →&lt;/a&gt;&lt;/div&gt;

&lt;h2&gt;Leverage and margin modes&lt;/h2&gt;
&lt;p&gt;Both platforms offer high maximum leverage on major perpetuals, along with cross and isolated margin modes. Maximum leverage is tiered: larger positions are capped at lower leverage to manage risk, and top-end limits change over time and by region.&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;&lt;strong&gt;Cross margin&lt;/strong&gt; shares your whole balance as collateral, which can avoid premature liquidation but risks more of your account.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Isolated margin&lt;/strong&gt; confines risk to the margin assigned to a single position.&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;High leverage cuts both ways — it magnifies gains and losses and brings your liquidation price closer to entry. Before sizing up, read &lt;a href="/blog/crypto-leverage-explained/"&gt;leverage explained&lt;/a&gt; and run the numbers with our &lt;a href="/#liq"&gt;liquidation calculator&lt;/a&gt;. Treat advertised maximum leverage as a ceiling, not a target.&lt;/p&gt;

&lt;h2&gt;Platform and UX&lt;/h2&gt;
&lt;p&gt;Bybit is frequently praised for a clean, derivatives-first layout that many active futures traders find efficient. Binance is feature-rich and powerful, but its breadth can feel busier to newcomers because it bundles many products into one ecosystem.&lt;/p&gt;
&lt;p&gt;Both offer capable web and mobile apps, advanced order types, TradingView-style charting, and APIs for automated trading. The better UX is largely a matter of taste — if you can, try each in a small live or demo session and see which workflow fits your habits.&lt;/p&gt;

&lt;h2&gt;Regions and availability&lt;/h2&gt;
&lt;p&gt;Availability is a critical, often decisive factor. Both exchanges restrict access in various jurisdictions, and the specifics evolve with regulation. Notably, US users are generally excluded from the main international platforms of both Bybit and Binance, and some other regions face restrictions or require separate local entities.&lt;/p&gt;
&lt;p&gt;Because rules change, verify that a given exchange legally serves your country and that the products you want are available to you before opening an account. Do not rely on older guides for this — confirm directly and check current terms of service.&lt;/p&gt;

&lt;h2&gt;Security and track record&lt;/h2&gt;
&lt;p&gt;Both are large, established venues with multi-year operating histories, insurance or protection funds, and standard security features such as two-factor authentication and withdrawal controls. As with any centralized exchange, you take on custodial and counterparty risk whenever funds sit on the platform.&lt;/p&gt;
&lt;p&gt;Sensible practice applies to both: enable strong two-factor authentication, use withdrawal address controls, avoid keeping more on an exchange than you need for active trading, and stay aware that regulatory status can shift in your region.&lt;/p&gt;

&lt;h2&gt;Which should you choose&lt;/h2&gt;
&lt;p&gt;There is no universal winner. Choose based on your priorities:&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;&lt;strong&gt;Maximum liquidity and the widest markets:&lt;/strong&gt; Binance is often the stronger default, particularly for large orders or thin pairs.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Streamlined futures UX and altcoin perps:&lt;/strong&gt; Bybit is a strong contender that many active traders prefer.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Fees:&lt;/strong&gt; compare your expected VIP tier on both; differences are usually modest for retail size.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Availability:&lt;/strong&gt; this can override everything — use whichever legally and practically serves your region with the products you want.&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;Many traders ultimately keep accounts on both and route orders to whichever offers better depth or terms for a given trade.&lt;/p&gt;

&lt;p&gt;MarginPad is exchange-neutral — we do not favor Bybit, Binance, or any other venue, and our tools work the same regardless of where you trade. Whatever you choose, plan your risk first: check your liquidation price, size by risk, and verify the current fees and availability on the exchange itself before you commit.&lt;/p&gt;`,
  faq:[
    {q:'Is Bybit or Binance better for beginners?',a:'Many beginners find Bybit\'s derivatives-first interface cleaner and less cluttered, since Binance bundles many products into one ecosystem. That said, both have capable apps and learning resources. Whichever you pick, start with low leverage and small size while you learn how perpetual futures and liquidation work.'},
    {q:'Are Bybit and Binance available in the US?',a:'Generally no. US users are typically excluded from the main international platforms of both Bybit and Binance. Regulations change, so always verify whether an exchange legally serves your jurisdiction and which products you can access before opening an account.'},
    {q:'Which exchange has lower futures fees?',a:'Both use similar maker/taker structures with VIP tiers, and base taker fees commonly sit around 0.04% to 0.06% as of 2026. Differences are usually small for retail-size traders. Compare your expected VIP tier on each and always confirm the current schedule, since fees change.'},
    {q:'Which has better liquidity for large orders?',a:'Binance generally carries the deepest order books and highest volumes across the widest set of pairs, which often means less slippage on large or thin-market orders. Bybit is also highly liquid in major pairs. For typical retail sizes the difference is frequently negligible.'}
  ]
}
,
{
  slug:'liquidation-clusters-explained', tag:'Liquidation', read:6, crumb:'Liquidation clusters',
  title:'Liquidation Clusters Explained: How to Spot Liquidity Magnets',
  desc:'Learn what liquidation clusters are, how stacked leverage forms them, and why these liquidity magnets pull crypto futures price toward them. A practical guide.',
  keywords:'liquidation clusters, liquidity magnets, liquidation map, open interest, crypto leverage, liquidation levels, support and resistance, futures trading',
  body:`&amp;lt;p&amp;gt;If you trade crypto futures, you have probably watched price drift toward a level, accelerate into it, and then snap back. Often that level is a &amp;lt;strong&amp;gt;liquidation cluster&amp;lt;/strong&amp;gt; — a price where a lot of leveraged positions are set to get forced out. This guide explains what clusters are, how they form, and how to read them on a &amp;lt;a href="/?p=heat"&amp;gt;liquidation map&amp;lt;/a&amp;gt; without fooling yourself about what the data actually shows.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;What a liquidation cluster actually is&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;A single liquidation level is the price at which one leveraged position can no longer cover its margin and gets force-closed by the exchange. On its own, one level means nothing. A &amp;lt;strong&amp;gt;cluster&amp;lt;/strong&amp;gt; is what you get when many liquidation levels stack up at or near the same price.&amp;lt;/p&amp;gt;
&amp;lt;p&amp;gt;Think of it as a pile of pending forced orders waiting at a price. If &amp;lt;code&amp;gt;42,000&amp;lt;/code&amp;gt; is where hundreds of long positions would be liquidated, then a move down to &amp;lt;code&amp;gt;42,000&amp;lt;/code&amp;gt; triggers a wave of forced selling all at once. That concentration is what makes clusters worth watching — not the individual levels, but the density of them at one spot.&amp;lt;/p&amp;gt;
&amp;lt;p&amp;gt;On MarginPad's &amp;lt;a href="/btc-liquidation-map/"&amp;gt;BTC liquidation map&amp;lt;/a&amp;gt;, clusters show up as bright, tall bands. The taller and brighter the band, the more leverage is estimated to be sitting at that price.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;How clusters form from open interest&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;Clusters are a side effect of leverage piling up. When &amp;lt;a href="/blog/what-is-open-interest/"&amp;gt;open interest&amp;lt;/a&amp;gt; rises, it means new leveraged positions are being opened — fresh contracts that did not exist before. Every one of those positions carries an &amp;lt;strong&amp;gt;implied liquidation price&amp;lt;/strong&amp;gt; that depends on entry price and leverage.&amp;lt;/p&amp;gt;
&amp;lt;p&amp;gt;Here is the key idea: traders do not all use the same leverage. A model spreads new positions across a &amp;lt;strong&amp;gt;leverage distribution&amp;lt;/strong&amp;gt; — some at 5x, some at 10x, 25x, 50x and higher. Each tier implies a different liquidation distance from the entry price:&amp;lt;/p&amp;gt;
&amp;lt;ul&amp;gt;
&amp;lt;li&amp;gt;A &amp;lt;code&amp;gt;10x&amp;lt;/code&amp;gt; long liquidates roughly &amp;lt;code&amp;gt;10%&amp;lt;/code&amp;gt; below entry.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;A &amp;lt;code&amp;gt;25x&amp;lt;/code&amp;gt; long liquidates roughly &amp;lt;code&amp;gt;4%&amp;lt;/code&amp;gt; below entry.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;A &amp;lt;code&amp;gt;50x&amp;lt;/code&amp;gt; long liquidates roughly &amp;lt;code&amp;gt;2%&amp;lt;/code&amp;gt; below entry.&amp;lt;/li&amp;gt;
&amp;lt;/ul&amp;gt;
&amp;lt;p&amp;gt;When lots of positions open around the same entry zone, their liquidation prices bunch together at predictable distances. The high-leverage liquidations sit close to current price; the lower-leverage ones sit further away. Stack enough of them and you get a cluster. If you are fuzzy on the mechanics, our &amp;lt;a href="/blog/crypto-leverage-explained/"&amp;gt;leverage explained&amp;lt;/a&amp;gt; post walks through the math.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;Why clusters act as liquidity magnets&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;A liquidation is a forced market order. A long liquidation is forced &amp;lt;strong&amp;gt;selling&amp;lt;/strong&amp;gt;; a short liquidation is forced &amp;lt;strong&amp;gt;buying&amp;lt;/strong&amp;gt;. A dense cluster is therefore a pool of guaranteed flow sitting at a known price — and markets tend to gravitate toward known pools of liquidity.&amp;lt;/p&amp;gt;
&amp;lt;p&amp;gt;There are two honest reasons clusters pull price:&amp;lt;/p&amp;gt;
&amp;lt;ul&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Liquidity needs liquidity.&amp;lt;/strong&amp;gt; Large players who want to fill big orders need counterparties. A cluster is exactly that — a stack of forced orders waiting to be matched.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Cascades are self-reinforcing.&amp;lt;/strong&amp;gt; When price reaches a cluster, the forced orders push price further in the same direction, which triggers the next set of liquidations, and so on.&amp;lt;/li&amp;gt;
&amp;lt;/ul&amp;gt;
&amp;lt;p&amp;gt;This is why traders describe clusters as &amp;lt;strong&amp;gt;magnets&amp;lt;/strong&amp;gt;. It is not magic and it is not guaranteed — it is the simple gravity of concentrated forced flow.&amp;lt;/p&amp;gt;

&amp;lt;div class="callout"&amp;gt;&amp;lt;div class="k"&amp;gt;SEE THE CLUSTERS&amp;lt;/div&amp;gt;&amp;lt;p style="margin-bottom:14px"&amp;gt;MarginPad's live map plots real liquidations plus estimated clusters from open-interest — toggle the layers and see where leverage is stacked.&amp;lt;/p&amp;gt;&amp;lt;a class="cta" href="/?p=heat"&amp;gt;Open the liquidation map →&amp;lt;/a&amp;gt;&amp;lt;/div&amp;gt;

&amp;lt;h2&amp;gt;Long clusters below, short clusters above&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;Direction matters, and it follows directly from how leverage works:&amp;lt;/p&amp;gt;
&amp;lt;ul&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Long clusters sit below current price.&amp;lt;/strong&amp;gt; Longs get liquidated when price falls, so their stacked liquidation levels form a band underneath the market. A drop into that band can trigger a cascade of forced selling.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Short clusters sit above current price.&amp;lt;/strong&amp;gt; Shorts get liquidated when price rises, so their levels form a band overhead. A rally into that band can trigger a short squeeze — forced buying that fuels more upside.&amp;lt;/li&amp;gt;
&amp;lt;/ul&amp;gt;
&amp;lt;p&amp;gt;Because of this, clusters often behave like soft &amp;lt;strong&amp;gt;support and resistance&amp;lt;/strong&amp;gt;. A thick long cluster below can act as a downside magnet that, once hit and consumed, becomes a springboard. A thick short cluster above can cap a move until price punches through it.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;How clusters get consumed&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;A cluster is not permanent. When price trades through it, the positions there get liquidated and the cluster is &amp;lt;strong&amp;gt;consumed&amp;lt;/strong&amp;gt; — the leverage that was stacked at that price is gone. On the map you will see a bright band fade or disappear after price sweeps it.&amp;lt;/p&amp;gt;
&amp;lt;p&amp;gt;This is the single most useful read. A level that was a magnet on the way in is often empty on the way back, because the fuel has been spent. Watching clusters appear, get hit, and vanish tells you where the leverage has already been flushed and where it is still loaded. Our guide on &amp;lt;a href="/blog/how-to-read-a-liquidation-heatmap/"&amp;gt;how to read a liquidation heatmap&amp;lt;/a&amp;gt; covers this consumption pattern in more depth.&amp;lt;/p&amp;gt;
&amp;lt;p&amp;gt;A practical sequence looks like this: open interest climbs, a cluster builds at &amp;lt;code&amp;gt;42,000&amp;lt;/code&amp;gt;, price grinds toward it, the band lights up as liquidations fire, and then it goes dark as the cluster clears. After that, support at &amp;lt;code&amp;gt;42,000&amp;lt;/code&amp;gt; is far weaker because the forced-buy flow that defended it is gone.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;The honest caveat: estimated clusters are a model&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;This matters, so be clear-eyed about it. MarginPad shows two different things, and they are not the same kind of data:&amp;lt;/p&amp;gt;
&amp;lt;ul&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Real liquidations&amp;lt;/strong&amp;gt; are actual events reported by Bybit, OKX and Binance. They happened. There is no guesswork.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Estimated clusters&amp;lt;/strong&amp;gt; are a &amp;lt;strong&amp;gt;model&amp;lt;/strong&amp;gt;. They are derived from open-interest changes plus an assumed leverage distribution. They are &amp;lt;em&amp;gt;not&amp;lt;/em&amp;gt; exchange order-book data, and no exchange publishes the exact liquidation price of every position.&amp;lt;/li&amp;gt;
&amp;lt;/ul&amp;gt;
&amp;lt;p&amp;gt;In other words, the cluster layer is an educated estimate of where leverage is probably stacked, not a guaranteed list of where stops sit. Treat it as a probability map, not a price oracle. It is genuinely useful for spotting zones of concentrated risk — but anyone who tells you a cluster &amp;lt;em&amp;gt;will&amp;lt;/em&amp;gt; be hit is overselling a model.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;Reading MarginPad's Clusters layer&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;On the live map, toggle the &amp;lt;strong&amp;gt;Clusters&amp;lt;/strong&amp;gt; layer on top of the real-liquidation feed. A few practical habits:&amp;lt;/p&amp;gt;
&amp;lt;ul&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Read brightness as density.&amp;lt;/strong&amp;gt; Brighter, taller bands mean more estimated leverage at that price. Faint bands are thin.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Check both sides.&amp;lt;/strong&amp;gt; Note the nearest long cluster below and short cluster above — those are your two most likely magnets.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Watch open interest alongside it.&amp;lt;/strong&amp;gt; Rising OI means clusters are building; falling OI after a sweep means they are being flushed.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Confirm with real liquidations.&amp;lt;/strong&amp;gt; When the real-liquidation feed lights up exactly where the model predicted a cluster, your read is on solid ground.&amp;lt;/li&amp;gt;
&amp;lt;/ul&amp;gt;
&amp;lt;p&amp;gt;Used this way, clusters become a context tool: they tell you where the market's leverage is loaded, which directions carry cascade risk, and which levels have already been cleared.&amp;lt;/p&amp;gt;

&amp;lt;p&amp;gt;Liquidation clusters are not a crystal ball — they are a map of where leverage is stacked and where forced flow is likely to fire. Read them as liquidity magnets that can pull price, act as soft support and resistance, and then vanish once consumed. Pair the estimated &amp;lt;a href="/?p=heat"&amp;gt;liquidation map&amp;lt;/a&amp;gt; with the real-liquidation feed, keep the model's limits in mind, and you will have a far better sense of where the next move is most likely to accelerate.&amp;lt;/p&amp;gt;`,
  faq:[
    {q:'What is a liquidation cluster?',a:'It is a price level where many leveraged positions would be liquidated at once. Individual liquidation levels stack up at the same price, creating a dense pool of forced orders that can move the market when price reaches it.'},
    {q:'Why do liquidation clusters act like magnets?',a:'A liquidation is a forced market order, so a cluster is a stack of guaranteed flow at a known price. Large players seek that liquidity, and once price reaches a cluster the forced orders can trigger a self-reinforcing cascade that pulls price further in.'},
    {q:'Are MarginPad clusters real exchange data?',a:'No. Real liquidations on the map are actual events from Bybit, OKX and Binance. The estimated clusters layer is a model built from open-interest changes and an assumed leverage distribution — a probability map of where leverage likely sits, not order-book data.'},
    {q:'What is the difference between long and short clusters?',a:'Long clusters sit below current price because longs liquidate when price falls. Short clusters sit above current price because shorts liquidate when price rises. A rally into a short cluster can spark a squeeze; a drop into a long cluster can spark a sell cascade.'}
  ]
},
{
  slug:'long-vs-short-liquidations', tag:'Liquidation', read:5, crumb:'Long vs short liquidations',
  title:'Long vs Short Liquidations: What the Balance Tells You',
  desc:'Learn how long vs short liquidations work, where each sits on a liquidation map, and how to read the imbalance to spot squeeze fuel and cascade risk.',
  keywords:'long vs short liquidations, liquidation map, long liquidation, short liquidation, liquidation cascade, short squeeze, long squeeze, leverage',
  body:`&amp;lt;p&amp;gt;Every liquidation has a direction. A trader is either long or short when their position gets force-closed, and the side that is getting wiped out tells you a lot about where the market is fragile. This guide explains what long-liquidation and short-liquidation actually mean, where each lands on a &amp;lt;a href="/?p=heat"&amp;gt;liquidation map&amp;lt;/a&amp;gt;, and how to read the balance between the two.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;What a long vs a short liquidation means&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;A liquidation happens when a leveraged position can no longer cover its losses and the exchange force-closes it. The direction of that trade decides what the exchange has to do:&amp;lt;/p&amp;gt;
&amp;lt;ul&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Long liquidation&amp;lt;/strong&amp;gt; — a trader bet that price would rise. When price &amp;lt;em&amp;gt;falls&amp;lt;/em&amp;gt; past their liquidation level, the exchange force-&amp;lt;strong&amp;gt;SELLS&amp;lt;/strong&amp;gt; their position to close it. More selling pushes price down further.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Short liquidation&amp;lt;/strong&amp;gt; — a trader bet that price would fall. When price &amp;lt;em&amp;gt;rises&amp;lt;/em&amp;gt; past their liquidation level, the exchange force-&amp;lt;strong&amp;gt;BUYS&amp;lt;/strong&amp;gt; their position back to close it. More buying pushes price up further.&amp;lt;/li&amp;gt;
&amp;lt;/ul&amp;gt;
&amp;lt;p&amp;gt;The key insight is that a liquidation is a forced market order in the opposite direction of the original bet. Longs liquidate &amp;lt;code&amp;gt;into selling&amp;lt;/code&amp;gt;; shorts liquidate &amp;lt;code&amp;gt;into buying&amp;lt;/code&amp;gt;. That is why liquidations feed the very move that triggered them. If you are new to the mechanics, our explainer on &amp;lt;a href="/blog/what-is-liquidation-in-crypto/"&amp;gt;what is liquidation&amp;lt;/a&amp;gt; covers the basics first.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;Where each side sits on the map&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;Because longs get liquidated when price drops and shorts get liquidated when price climbs, the two sides always sit on opposite halves of the chart relative to the current price:&amp;lt;/p&amp;gt;
&amp;lt;ul&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Long liquidations sit BELOW current price.&amp;lt;/strong&amp;gt; The further price falls, the more long positions get hit. These show as &amp;lt;strong&amp;gt;red&amp;lt;/strong&amp;gt; on the map.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Short liquidations sit ABOVE current price.&amp;lt;/strong&amp;gt; The further price rises, the more short positions get hit. These show as &amp;lt;strong&amp;gt;green&amp;lt;/strong&amp;gt; on the map.&amp;lt;/li&amp;gt;
&amp;lt;/ul&amp;gt;
&amp;lt;p&amp;gt;So when you look at a &amp;lt;a href="/btc-liquidation-map/"&amp;gt;BTC liquidation map&amp;lt;/a&amp;gt;, the red zone below the candle and the green zone above it are not random — they are the two reservoirs of leverage waiting to be triggered if price moves their way. Understanding the long/short framing first, covered in &amp;lt;a href="/blog/long-vs-short-crypto/"&amp;gt;long vs short&amp;lt;/a&amp;gt;, makes this layout click immediately.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;Reading the long/short imbalance&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;The balance between the two sides is where the signal lives. When one side is much heavier than the other, price tends to get pulled toward the dense cluster, because that is where the most forced orders are sitting:&amp;lt;/p&amp;gt;
&amp;lt;ul&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Heavy longs below&amp;lt;/strong&amp;gt; — a thick red band under price signals &amp;lt;strong&amp;gt;downside fragility&amp;lt;/strong&amp;gt;. A relatively small drop can start force-selling those longs, and that selling drags price lower into the next cluster. This is long-squeeze fuel.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Heavy shorts above&amp;lt;/strong&amp;gt; — a thick green band over price is &amp;lt;strong&amp;gt;short-squeeze fuel&amp;lt;/strong&amp;gt;. A modest rally can start force-buying those shorts, and that buying lifts price into the next short cluster.&amp;lt;/li&amp;gt;
&amp;lt;/ul&amp;gt;
&amp;lt;p&amp;gt;In plain terms: the over-leveraged side is the vulnerable side. If far more longs are stacked below than shorts above, the market is leaning long and is exposed to a flush down. If shorts dominate above, the crowd is leaning short and a pop higher can hurt them. Traders often describe price as being &amp;lt;em&amp;gt;magnetised&amp;lt;/em&amp;gt; toward the largest pools of liquidity.&amp;lt;/p&amp;gt;

&amp;lt;div class="callout"&amp;gt;&amp;lt;div class="k"&amp;gt;SEE BOTH SIDES&amp;lt;/div&amp;gt;&amp;lt;p style="margin-bottom:14px"&amp;gt;On MarginPad's live map, red bubbles are longs liquidated, green are shorts — see which side is stacked and where.&amp;lt;/p&amp;gt;&amp;lt;a class="cta" href="/?p=heat"&amp;gt;Open the liquidation map →&amp;lt;/a&amp;gt;&amp;lt;/div&amp;gt;

&amp;lt;h2&amp;gt;How cascades start on the heavier side&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;A &amp;lt;strong&amp;gt;cascade&amp;lt;/strong&amp;gt; is a chain reaction of liquidations, and it almost always begins on the heavier side. The sequence looks like this:&amp;lt;/p&amp;gt;
&amp;lt;ul&amp;gt;
&amp;lt;li&amp;gt;Price reaches the first dense cluster of liquidation levels.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;Those positions are force-closed — longs force-&amp;lt;strong&amp;gt;sold&amp;lt;/strong&amp;gt;, shorts force-&amp;lt;strong&amp;gt;bought&amp;lt;/strong&amp;gt;.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;That forced order pushes price further in the same direction, into the &amp;lt;em&amp;gt;next&amp;lt;/em&amp;gt; cluster.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;The next batch liquidates, and the loop repeats until the leverage in that zone is exhausted.&amp;lt;/li&amp;gt;
&amp;lt;/ul&amp;gt;
&amp;lt;p&amp;gt;This is why a stack of long liquidations below price can produce a sharp, fast drop: each level that breaks adds more selling, which trips the next level. The same logic in reverse drives short-squeeze rallies. The heavier the cluster, the more energy the cascade has. Mapping these zones in advance is the whole point of a &amp;lt;a href="/blog/how-to-read-a-liquidation-heatmap/"&amp;gt;how to read a liquidation heatmap&amp;lt;/a&amp;gt; workflow.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;Using the colour code and the histogram&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;The map gives you two quick ways to judge which side is over-leveraged. First, the &amp;lt;strong&amp;gt;colour code&amp;lt;/strong&amp;gt;: &amp;lt;strong&amp;gt;red marks longs&amp;lt;/strong&amp;gt; liquidated and &amp;lt;strong&amp;gt;green marks shorts&amp;lt;/strong&amp;gt; liquidated. A wall of red below current price versus a thin scatter of green above it tells you at a glance that the long side is more crowded.&amp;lt;/p&amp;gt;
&amp;lt;p&amp;gt;Second, the &amp;lt;strong&amp;gt;price-level histogram&amp;lt;/strong&amp;gt; aggregates liquidations by price, so you can see exactly which levels hold the most leverage. Tall bars mark the prices where the most positions are concentrated — those are the levels most likely to act as targets or to ignite a cascade. Reading the colour and the histogram together gives you a fast read on imbalance:&amp;lt;/p&amp;gt;
&amp;lt;ul&amp;gt;
&amp;lt;li&amp;gt;Tall red bars clustered just below price → the long side is over-leveraged and exposed to a flush.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;Tall green bars clustered just above price → the short side is over-leveraged and exposed to a squeeze.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;Roughly balanced bars on both sides → no strong directional pull from leverage alone.&amp;lt;/li&amp;gt;
&amp;lt;/ul&amp;gt;

&amp;lt;h2&amp;gt;Why liquidations come in bursts&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;One practical note: liquidations are not evenly spread over time. They &amp;lt;strong&amp;gt;spike on volatility&amp;lt;/strong&amp;gt; and go quiet when price is flat. A fast move sweeps through stacked liquidation levels and triggers a burst of red or green; a calm, ranging market leaves most levels untouched, so the live feed looks sparse. If the map suddenly fills with one colour, that is a signal volatility just hit and one side is being flushed. When price drifts sideways, expect the map to thin out — that quiet is normal, not a glitch.&amp;lt;/p&amp;gt;

&amp;lt;p&amp;gt;Long versus short liquidations is really one question: which side is carrying the most leverage, and on which half of the chart. Longs liquidate into selling below price and show red; shorts liquidate into buying above price and show green. The heavier side is the fragile side, the dense clusters are where cascades start, and the colour code plus the histogram let you read that balance in seconds. Watch the imbalance, respect the clusters, and remember the bursts arrive with volatility — not in the calm.&amp;lt;/p&amp;gt;`,
  faq:[
    {q:'Are long liquidations bullish or bearish?',a:'Long liquidations are bearish in the moment. A long is force-sold when price falls, and that selling pushes price down further. A heavy band of long liquidations below current price signals downside fragility and can fuel a sharp drop.'},
    {q:'Why are long liquidations below the price and shorts above?',a:'Longs profit when price rises, so they get liquidated when price falls — putting their liquidation levels below current price. Shorts profit when price falls, so they get liquidated when price rises, putting their levels above current price.'},
    {q:'What does it mean when one side has far more liquidations?',a:'It means that side is over-leveraged and vulnerable. Heavy longs below point to a possible flush down; heavy shorts above point to short-squeeze fuel. Price tends to get pulled toward the larger cluster of forced orders.'},
    {q:'Why does the liquidation map sometimes look empty?',a:'Liquidations spike on volatility and are sparse when price is flat. In a calm, ranging market most leverage levels are not triggered, so the live feed thins out. A sudden burst of one colour means volatility hit and that side is being flushed.'}
  ]
},
{
  slug:'liquidation-cascade-explained', tag:'Liquidation', read:6, crumb:'Liquidation cascades',
  title:'Liquidation Cascades Explained (and How to Avoid Getting Caught)',
  desc:'A liquidation cascade is a chain reaction of forced liquidations that snowballs price. Learn the mechanics, how to spot one, and how to avoid getting caught.',
  keywords:'liquidation cascade, crypto liquidations, liquidation map, long squeeze, short squeeze, leverage trading, stop-loss placement, forced liquidation',
  body:`&amp;lt;p&amp;gt;A single forced liquidation rarely matters. The danger is when one liquidation pushes price into the next pile of liquidations, which pushes price further, which triggers the next — a chain reaction known as a &amp;lt;strong&amp;gt;liquidation cascade&amp;lt;/strong&amp;gt;. This is the mechanism behind those violent vertical wicks you see on a chart, and understanding it is the difference between getting run over and stepping aside.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;What a liquidation cascade actually is&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;When a leveraged position can no longer cover its losses, the exchange force-closes it. That is a single &amp;lt;a href="/blog/what-is-liquidation-in-crypto/"&amp;gt;liquidation&amp;lt;/a&amp;gt;. A cascade is what happens when these stop happening one at a time and start happening in sequence. One liquidation moves price just far enough to trip the next cluster of positions, those get force-closed too, price moves again, and the next cluster lights up. Each link in the chain pulls the trigger on the one after it.&amp;lt;/p&amp;gt;
&amp;lt;p&amp;gt;The key insight is that cascades are not driven by news or fresh selling pressure. They are driven by &amp;lt;strong&amp;gt;the liquidations themselves&amp;lt;/strong&amp;gt;. Once the first domino falls, the move becomes self-sustaining until it runs out of nearby positions to consume.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;The mechanics: why liquidations feed on themselves&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;Here is the part most traders miss. When an exchange liquidates a position, it does not politely ask the market for a fair price. It dumps a &amp;lt;strong&amp;gt;market order&amp;lt;/strong&amp;gt; to close the position immediately. A long getting liquidated becomes a market &amp;lt;code&amp;gt;sell&amp;lt;/code&amp;gt;; a short getting liquidated becomes a market &amp;lt;code&amp;gt;buy&amp;lt;/code&amp;gt;.&amp;lt;/p&amp;gt;
&amp;lt;p&amp;gt;Market orders move price. So a forced liquidation does not just react to the price move — it &amp;lt;em&amp;gt;adds&amp;lt;/em&amp;gt; to it. If a wave of longs is liquidated, the resulting market sells push price lower, which drags more longs to their liquidation level, which produces more market sells. That is a feedback loop:&amp;lt;/p&amp;gt;
&amp;lt;ul&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Price drops&amp;lt;/strong&amp;gt; to a long position's liquidation level.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;The exchange &amp;lt;strong&amp;gt;market-sells&amp;lt;/strong&amp;gt; to close it.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;That selling &amp;lt;strong&amp;gt;pushes price lower&amp;lt;/strong&amp;gt; into the next cluster.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;Repeat until the fuel runs out.&amp;lt;/li&amp;gt;
&amp;lt;/ul&amp;gt;
&amp;lt;p&amp;gt;Thin order books make it worse. If there is little resting liquidity to absorb the forced market orders, each liquidation moves price further, so the cascade jumps from one cluster to the next more easily.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;Why high-leverage clusters near price are the fuse&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;A position's liquidation price depends on its leverage. A 3x long can fall a long way before it is liquidated; a 50x long is liquidated by a tiny move against it. That means &amp;lt;strong&amp;gt;high-leverage positions sit very close to the current price&amp;lt;/strong&amp;gt;, and they tend to pile up at the same round numbers and obvious levels.&amp;lt;/p&amp;gt;
&amp;lt;p&amp;gt;Those tight clusters are the fuse. Because they are so close to price, it takes only a small nudge to ignite them, and once lit they release a burst of forced market orders that carries price into the next group. You can estimate where your own position sits relative to these zones with a &amp;lt;a href="/#liq"&amp;gt;liquidation calculator&amp;lt;/a&amp;gt;, and see where the broader clusters stack up on a &amp;lt;a href="/?p=heat"&amp;gt;liquidation map&amp;lt;/a&amp;gt;.&amp;lt;/p&amp;gt;

&amp;lt;div class="callout"&amp;gt;&amp;lt;div class="k"&amp;gt;SEE THE FUEL&amp;lt;/div&amp;gt;&amp;lt;p style="margin-bottom:14px"&amp;gt;MarginPad's live map shows where liquidation fuel is stacked — so you can avoid putting your stop right inside a cluster.&amp;lt;/p&amp;gt;&amp;lt;a class="cta" href="/?p=heat"&amp;gt;Open the liquidation map →&amp;lt;/a&amp;gt;&amp;lt;/div&amp;gt;

&amp;lt;h2&amp;gt;How cascades show up on a chart&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;A cascade looks like a &amp;lt;strong&amp;gt;sudden vertical wick&amp;lt;/strong&amp;gt; — price travels a large distance in seconds, far faster than ordinary buying or selling would explain, then often snaps partway back. That snap-back happens because the cascade overshoots: once the nearby liquidations are exhausted, there are no more forced orders, and the price was pushed below (or above) where genuine supply and demand would settle.&amp;lt;/p&amp;gt;
&amp;lt;p&amp;gt;If you have ever had a stop filled at a price that "never should have printed," only to watch the market recover minutes later, you were likely caught in a cascade. The wick swept through a cluster, your stop was inside it, and then price returned without you.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;Long cascades vs short squeezes&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;Cascades run in both directions, and the direction depends on which side is over-leveraged.&amp;lt;/p&amp;gt;
&amp;lt;ul&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Long cascade (downside).&amp;lt;/strong&amp;gt; When too many leveraged longs stack below price, a drop liquidates them, those liquidations are market sells, and the selling drives price down through cluster after cluster. This is the classic flush lower.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Short squeeze (upside).&amp;lt;/strong&amp;gt; The mirror image. When leveraged shorts pile up above price, a rally liquidates them, those liquidations are market buys, and the buying forces price up into the next short cluster — a self-feeding spike higher.&amp;lt;/li&amp;gt;
&amp;lt;/ul&amp;gt;
&amp;lt;p&amp;gt;The mechanics are identical; only the sign flips. The &amp;lt;a href="/btc-liquidation-map/"&amp;gt;BTC liquidation map&amp;lt;/a&amp;gt; often shows fuel stacked on both sides at once, which is why fast markets can spike one way, reverse, and spike the other.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;Using a liquidation map to stay out of the blast radius&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;A &amp;lt;a href="/?p=heat"&amp;gt;liquidation map&amp;lt;/a&amp;gt; plots where positions are likely to be force-closed — in other words, where the fuel is stacked. It will not tell you the exact second a cascade ignites, but it does tell you which price zones are dangerous to sit inside. Use it like this:&amp;lt;/p&amp;gt;
&amp;lt;ul&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Find the dense clusters&amp;lt;/strong&amp;gt; above and below the current price.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Do not place your stop inside one.&amp;lt;/strong&amp;gt; A stop tucked into a cluster is likely to be swept by the very cascade the cluster fuels. Put it on the far side of the dense zone, where a wick is less likely to reach and reverse.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Treat clusters as magnets, not guarantees.&amp;lt;/strong&amp;gt; Price is often drawn toward stacked liquidations, but timing is unknowable.&amp;lt;/li&amp;gt;
&amp;lt;/ul&amp;gt;
&amp;lt;p&amp;gt;Be honest with yourself about what the tool does: a map shows &amp;lt;strong&amp;gt;where&amp;lt;/strong&amp;gt; the fuel is, not &amp;lt;strong&amp;gt;when&amp;lt;/strong&amp;gt; it ignites. Estimated clusters are inferred from open positions and leverage assumptions, so treat them as a heat zone, not a countdown timer.&amp;lt;/p&amp;gt;

&amp;lt;h2&amp;gt;Practical defenses&amp;lt;/h2&amp;gt;
&amp;lt;p&amp;gt;You cannot stop a cascade, but you can avoid being its fuel. A few habits do most of the work:&amp;lt;/p&amp;gt;
&amp;lt;ul&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Lower your leverage.&amp;lt;/strong&amp;gt; This is the single biggest lever. Lower leverage pushes your liquidation price far from the action, so cascades that consume the tight high-leverage clusters never reach you. See &amp;lt;a href="/blog/how-to-avoid-liquidation/"&amp;gt;how to avoid liquidation&amp;lt;/a&amp;gt;.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Place stops outside dense clusters.&amp;lt;/strong&amp;gt; A stop should protect you, not feed the fire. Set it beyond the obvious liquidation zone — our guide on &amp;lt;a href="/blog/how-to-set-a-stop-loss/"&amp;gt;how to set a stop-loss&amp;lt;/a&amp;gt; covers placement in detail.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Cut size before high-volatility events.&amp;lt;/strong&amp;gt; Funding flips, macro data, and major announcements are common cascade triggers. Smaller size means a wick cannot do as much damage.&amp;lt;/li&amp;gt;
&amp;lt;li&amp;gt;&amp;lt;strong&amp;gt;Keep a margin buffer.&amp;lt;/strong&amp;gt; Extra collateral moves your liquidation price away from the danger zone and buys you room to survive a temporary overshoot.&amp;lt;/li&amp;gt;
&amp;lt;/ul&amp;gt;

&amp;lt;p&amp;gt;Liquidation cascades are not random violence — they are a predictable consequence of leveraged positions stacking up and force-closing into a thin book. Once you see them as a feedback loop of market orders, the defenses are obvious: keep your leverage modest, your stops outside the fuel, and your size sensible before volatility. Use a &amp;lt;a href="/?p=heat"&amp;gt;liquidation map&amp;lt;/a&amp;gt; to see where the clusters are stacked, and let the over-leveraged crowd be the fuel instead of you.&amp;lt;/p&amp;gt;`,
  faq:[{q:'What is a liquidation cascade?',a:'It is a chain reaction of forced liquidations. One liquidation pushes price into the next cluster of leveraged positions, force-closing them too, which moves price further and triggers the next group — a self-sustaining loop until nearby positions are exhausted.'},{q:'Why do liquidations move the price?',a:'When an exchange liquidates a position it closes it with a market order, not a limit order. A liquidated long becomes a market sell and a liquidated short becomes a market buy, so the forced order itself pushes price in the same direction, triggering more liquidations.'},{q:'Can a liquidation map predict exactly when a cascade will happen?',a:'No. A map shows where liquidation fuel is stacked — which price zones are dangerous — but not the precise moment one ignites. Estimated clusters are inferred from open positions and leverage, so treat them as heat zones, not a countdown.'},{q:'How do I avoid getting caught in a cascade?',a:'Use lower leverage so your liquidation price sits far from the action, place stops outside dense clusters rather than inside them, reduce position size before high-volatility events, and keep a margin buffer for temporary overshoots.'}]
},
{
  slug:'how-to-calculate-liquidation-price', tag:'Liquidation', read:8, crumb:'Calculating liquidation price',
  title:'How to Calculate Liquidation Price (Formula + Examples)',
  desc:'The exact formula exchanges use to set your liquidation price on isolated margin, why leverage moves it toward your entry, and worked examples for longs and shorts at 10x, 20x and 100x.',
  keywords:'how to calculate liquidation price, liquidation price formula, crypto liquidation calculator, isolated margin liquidation, leverage liquidation distance, liquidation price long short, liquidation formula crypto',
  body:`&lt;p&gt;Your &lt;strong&gt;liquidation price&lt;/strong&gt; is the single most important number in leveraged trading. It is the price at which the exchange force-closes your position and you lose the margin backing it — no warning, no negotiation. Knowing it &lt;em&gt;before&lt;/em&gt; you enter is the difference between a controlled trade and a surprise blow-up. The good news: it comes from a simple formula, and once you understand it you can size any trade so a normal market move can never reach it. If you just want the number, the &lt;a href="/#liq"&gt;liquidation calculator&lt;/a&gt; does it instantly — but the math is worth understanding.&lt;/p&gt;

&lt;h2&gt;The liquidation price formula (isolated margin)&lt;/h2&gt;
&lt;p&gt;On &lt;strong&gt;isolated margin&lt;/strong&gt; — where only the margin assigned to one position is at risk — the estimate is:&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;&lt;strong&gt;Long:&lt;/strong&gt; &lt;code&gt;Liquidation = Entry × (1 − 1/Leverage + MMR)&lt;/code&gt;&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Short:&lt;/strong&gt; &lt;code&gt;Liquidation = Entry × (1 + 1/Leverage − MMR)&lt;/code&gt;&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;&lt;strong&gt;MMR&lt;/strong&gt; is the maintenance margin rate — the minimum margin the exchange requires to keep the position open, typically around &lt;code&gt;0.5%&lt;/code&gt; on major perpetuals. The real driver is the &lt;code&gt;1/Leverage&lt;/code&gt; term: that is your initial margin as a fraction of the position, and it sets how far price can move before your margin is gone. A long is liquidated when price falls by roughly &lt;code&gt;1/Leverage&lt;/code&gt;; a short when price rises by roughly the same. The maintenance margin nudges the level slightly closer than that.&lt;/p&gt;

&lt;h2&gt;Leverage decides everything: the distance table&lt;/h2&gt;
&lt;p&gt;Because the distance to liquidation is approximately &lt;code&gt;1/Leverage&lt;/code&gt;, higher leverage pulls the liquidation price right up against your entry. This single relationship explains why most leveraged accounts are wiped out:&lt;/p&gt;
&lt;table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px"&gt;
&lt;thead&gt;&lt;tr&gt;&lt;th style="text-align:left;padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);font-family:'Space Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.05em"&gt;Leverage&lt;/th&gt;&lt;th style="text-align:left;padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);font-family:'Space Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.05em"&gt;Move to liquidation&lt;/th&gt;&lt;th style="text-align:left;padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);font-family:'Space Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.05em"&gt;What that means&lt;/th&gt;&lt;/tr&gt;&lt;/thead&gt;
&lt;tbody&gt;
&lt;tr&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;&lt;strong&gt;5×&lt;/strong&gt;&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;~19.5%&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);color:#34d99a"&gt;Room to breathe through normal swings&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;&lt;strong&gt;10×&lt;/strong&gt;&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;~9.5%&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);color:#34d99a"&gt;Survivable with a sensible stop&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;&lt;strong&gt;25×&lt;/strong&gt;&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;~3.5%&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);color:#ffd75a"&gt;One volatile candle&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;&lt;strong&gt;50×&lt;/strong&gt;&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;~1.5%&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);color:#ff7b72"&gt;A routine wick can end it&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;&lt;strong&gt;100×&lt;/strong&gt;&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39)"&gt;~0.5%&lt;/td&gt;&lt;td style="padding:9px 10px;border-bottom:1px solid var(--line,#2a2f39);color:#ff7b72"&gt;Noise liquidates you&lt;/td&gt;&lt;/tr&gt;
&lt;/tbody&gt;&lt;/table&gt;
&lt;p&gt;At 100× a move most people would not even notice on the chart ends the trade. That is why high leverage feels random: you are not being wrong about direction, you are being stopped out by ordinary noise before your idea has a chance to play out.&lt;/p&gt;

&lt;h2&gt;Worked example 1 — 10× long on Bitcoin&lt;/h2&gt;
&lt;p&gt;You go long BTC at an entry of &lt;code&gt;$60,000&lt;/code&gt; with &lt;strong&gt;10×&lt;/strong&gt; leverage and a 0.5% maintenance margin. Plugging into the long formula: &lt;code&gt;60,000 × (1 − 1/10 + 0.005) = 60,000 × 0.905 = $54,300&lt;/code&gt;. Your liquidation sits about &lt;strong&gt;9.5%&lt;/strong&gt; below entry. To hold this trade safely you would place a stop-loss comfortably above $54,300 — say at $57,600 (−4%) — so &lt;em&gt;you&lt;/em&gt; decide the exit, not the exchange.&lt;/p&gt;

&lt;h2&gt;Worked example 2 — 20× short on Ethereum&lt;/h2&gt;
&lt;p&gt;You short ETH at &lt;code&gt;$3,000&lt;/code&gt; with &lt;strong&gt;20×&lt;/strong&gt; leverage. Using the short formula: &lt;code&gt;3,000 × (1 + 1/20 − 0.005) = 3,000 × 1.045 = $3,135&lt;/code&gt;. Your liquidation is only about &lt;strong&gt;4.5%&lt;/strong&gt; above entry — a single strong green candle. Shorts carry an extra wrinkle: a violent squeeze has no theoretical ceiling, so the upside move that liquidates a short can be far larger and faster than the downside move that liquidates a long. Give shorts more room, not less.&lt;/p&gt;

&lt;h2&gt;Worked example 3 — why 100× is so dangerous&lt;/h2&gt;
&lt;p&gt;Same BTC long at &lt;code&gt;$60,000&lt;/code&gt;, but now at &lt;strong&gt;100×&lt;/strong&gt;: &lt;code&gt;60,000 × (1 − 1/100 + 0.005) = 60,000 × 0.995 = $59,700&lt;/code&gt;. Liquidation is &lt;strong&gt;$300 away&lt;/strong&gt; — about half a percent. Bitcoin routinely travels that far in a minute for no reason at all. The 100× position that occasionally 10×s someone&apos;s money gets screenshotted; the thousands of silent liquidations behind it do not. Over any real sample, that half-percent buffer is a losing game.&lt;/p&gt;

&lt;h2&gt;Cross margin changes the number&lt;/h2&gt;
&lt;p&gt;Everything above assumes &lt;strong&gt;isolated&lt;/strong&gt; margin. In &lt;strong&gt;cross&lt;/strong&gt; margin your entire wallet balance backs the position, so your liquidation price sits much further away — the whole balance has to be exhausted, not just the slice assigned to the trade. The trade-off is that one bad cross-margin position can drain the entire account, not just its own margin. Model both modes with the &lt;a href="/calculators?c=cross"&gt;cross-margin calculator&lt;/a&gt;, and read the full comparison in &lt;a href="/blog/cross-vs-isolated-margin/"&gt;cross vs isolated margin&lt;/a&gt;.&lt;/p&gt;

&lt;h2&gt;How to move your liquidation price further away&lt;/h2&gt;
&lt;p&gt;Once you can calculate the number, you can control it. There are only four levers, and every one buys you more room before the exchange steps in:&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;&lt;strong&gt;Use less leverage.&lt;/strong&gt; By far the biggest lever — halving your leverage roughly doubles the distance to liquidation.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Add margin.&lt;/strong&gt; Topping up the margin on an isolated position lowers its effective leverage and pushes liquidation back, which helps when a trade goes against you but your thesis is still intact.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Switch to cross margin, carefully.&lt;/strong&gt; It moves liquidation much further away by backing the trade with your whole balance — at the cost of risking that whole balance.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Size from risk, not leverage.&lt;/strong&gt; A smaller position at the same entry lets you hold the same dollar risk at lower leverage, and lower leverage is what actually pushes liquidation away.&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;The professional order of operations is to work backwards: decide the most you will lose on the trade, place your stop where the chart justifies it, and let the size and leverage fall out of that — never pick the leverage first.&lt;/p&gt;

&lt;h2&gt;What the simple formula leaves out&lt;/h2&gt;
&lt;p&gt;The estimate above is close, but three things make real liquidation arrive slightly sooner than the clean math suggests:&lt;/p&gt;
&lt;ul&gt;
&lt;li&gt;&lt;strong&gt;Fees and funding.&lt;/strong&gt; Trading fees and the &lt;a href="/blog/what-is-funding-rate/"&gt;funding&lt;/a&gt; you pay while the position is open both drain your margin every cycle, pulling liquidation closer than the price math alone shows.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Tiered maintenance margin.&lt;/strong&gt; On very large positions the MMR rises in tiers, so the biggest positions are liquidated a little earlier than a flat 0.5% implies.&lt;/li&gt;
&lt;li&gt;&lt;strong&gt;Mark price, not last price.&lt;/strong&gt; Exchanges liquidate against the &lt;a href="/blog/mark-price-vs-last-price/"&gt;mark price&lt;/a&gt; — an index-based fair value — not the last trade on that one venue, which protects you from a single manipulated wick but is the number you should actually watch near your level.&lt;/li&gt;
&lt;/ul&gt;
&lt;p&gt;Treat the formula as a close, slightly-optimistic estimate and always leave a buffer.&lt;/p&gt;

&lt;h2&gt;See it with live data&lt;/h2&gt;
&lt;p&gt;Numbers land harder when you watch them play out. The &lt;a href="/liquidations/"&gt;live liquidations feed&lt;/a&gt; shows exactly how much leverage is being wiped out across Binance, Bybit and OKX right now, and every major coin has its own page — &lt;a href="/liquidations/btc/"&gt;BTC&lt;/a&gt;, &lt;a href="/liquidations/eth/"&gt;ETH&lt;/a&gt;, &lt;a href="/liquidations/sol/"&gt;SOL&lt;/a&gt; — with the 24-hour total and the long-versus-short split. Before you commit, drop your entry and leverage into the &lt;a href="/#liq"&gt;liquidation calculator&lt;/a&gt;, size the trade from your stop with the &lt;a href="/#size"&gt;position-size calculator&lt;/a&gt;, and rehearse the whole thing risk-free at the live price on the &lt;a href="/paper-trade"&gt;paper-trading terminal&lt;/a&gt;. Learning liquidation with fake money is far cheaper than learning it with your own.&lt;/p&gt;`,
  faq:[
    {q:'What is the formula for liquidation price?',a:'On isolated margin, a long is liquidated at roughly Entry × (1 − 1/Leverage + maintenance margin), and a short at Entry × (1 + 1/Leverage − maintenance margin). The 1/Leverage term is the main driver: it sets how far price can move before your margin is gone.'},
    {q:'At what percentage does a position get liquidated?',a:'Approximately 1 divided by your leverage, minus the maintenance margin. A 10x position is liquidated after about a 9-10% move against it, 25x after about 3.5%, and 100x after about 1%. Higher leverage puts liquidation much closer to your entry.'},
    {q:'Does position size change the liquidation price?',a:'For isolated margin, no — the liquidation price depends on entry, leverage and maintenance margin, not on how large the position is. Position size changes how much money you lose at liquidation, not the price it happens at. Cross margin is different: your whole balance backs the trade, pushing liquidation further away.'},
    {q:'Is the calculated liquidation price exact?',a:'It is a close estimate. Fees, funding and tiered maintenance margin on large positions all make real liquidation arrive slightly sooner, and exchanges liquidate against the mark price rather than the last trade. Treat the formula as a slightly optimistic guide and leave a buffer.'}
  ]
}
];
E.forEach(a => { a.body = a.body.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); });
module.exports = E;
