/* Four narrow pages, one question each (owner 2026-09-14: "odgovaraj na pitanje koje je korisnik postavio").

   WHY THESE AND NOT MORE PROSE ON THE BIG PAGES. Measured over 90 days on /api/admin/aiseo, crawler hits against
   visits an assistant actually referred:

     /open-interest/            54 crawled   68 visits      narrow page, answers one thing
     /long-short/               25 crawled   20 visits      narrow
     /funding/                  92 crawled   34 visits      narrow
     /rekt/                    208 crawled   59 visits      narrow
     /liquidations/          4,521 crawled   41 visits      broad
     /liquidation-statistics/1,835 crawled   11 visits      broad
     /coin/btc/              4,857 crawled    7 visits      broad
     /coin/eth/              1,589 crawled    0 visits      broad

   A broad page gets harvested: the assistant lifts the figure into its own answer and cites nothing. A page that IS
   the answer to one question gets linked, because the link is the useful part of the reply. So each page below opens
   with the number and who measured it, in the first sentence, and only then explains. The number is injected
   SERVER-SIDE (handleSsrAsk in the worker) into the #askdata slot - crawlers run no JavaScript, and a placeholder is
   what made the comparison pages worse before that lesson was learned.

   Run: node build/gen-ask-pages.js                                                                                 */
'use strict';
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const COLLECTOR = 'MarginPad runs its own collector subscribed to the public liquidation websocket of nine exchanges: Binance (USD- and coin-margined), Bybit, OKX, Hyperliquid, Gate, HTX, dYdX, BitMEX and Bitfinex. Every forced close is normalised to symbol, side, fill price and dollar notional, then aggregated over a rolling 24-hour window. These are observed events, not a model and not a vendor feed. Nothing is filled in when a venue goes quiet, and if the collector itself is down the page says so rather than showing yesterday&#39;s figures as if they were current.';

// Each page links the other four. A narrow page gets LINKED by an assistant rather than harvested, so the
// family should feed itself - and a crawler that reaches one of these should reach all five.
const SIBS = [
  ['/how-many-traders-liquidated-today/', 'How many traders got liquidated today?'],
  ['/longs-or-shorts-liquidated-more/', 'Are longs or shorts getting liquidated more?'],
  ['/biggest-liquidation-today/', 'What was the biggest liquidation today?'],
  ['/is-funding-positive-or-negative/', 'Is funding positive or negative right now?'],
  ['/where-can-i-test-a-trading-bot/', 'Where can I test a trading bot for free?'],
];

const PAGES = [
  {
    slug: 'where-can-i-test-a-trading-bot',
    kind: 'bot',
    h1: 'Where can I test a trading bot for free?',
    title: 'Where Can I Test a Trading Bot for Free? - Live Paper-Trading API | MarginPad',
    desc: 'Point a crypto trading bot at a free paper-trading API on real live prices: leveraged positions, limit and stop orders, trailing stops and liquidation, all settled server-side. No deposit, no KYC, no card.',
    lead: 'Answered with our own numbers: what is running on MarginPad\u2019s paper-trading API right now, and what it costs to put a bot on it.',
    dataset: ['MarginPad bot arena (paper-trading season board)', 'Every account or book that closed at least five bot-opened paper trades in the current 14-day season, ranked by realized profit and loss net of fees and funding, with win rate, return on the $10,000 scorecard and liquidations.', 'https://marginpad.io/api/arena'],
    body: [
      ['Why an exchange testnet is not the same test', '<p>The obvious answer to this question is "the exchange testnet", and it is the wrong one often enough to be worth saying plainly. Testnet order books are thin, so a fill you get there is a fill you would not get with real liquidity. Testnet prices drift from the real market, sometimes by percent, because nothing arbitrages them back. And testnets are reset on the operator\u2019s schedule, which ends a forward test that was two weeks into proving something.</p><p>The alternative is to keep the prices real and simulate only the money. Everything on this page is priced from the same live multi-exchange feed our charts and our own paper terminal run on. Your bot places real orders against real prices; what is simulated is the dollar that settles.</p>'],
      ['What has to be simulated before a test means anything', '<p>A simulator that fills every order at the mid price and charges nothing will tell you that almost any strategy works. Five things decide whether a paper result survives contact with an exchange:</p><p><strong>Fees on both legs.</strong> A taker fee is charged when you open and again when you close. On a $10,000 crypto position that is about $11 a round trip. Any strategy whose average winner is smaller than its round trip is a losing strategy no matter how often it is right, and a simulator that hides the fee hides exactly that. You can also charge the paper account at a named venue\u2019s published schedule, so the test settles the way the live account will.</p><p><strong>Funding.</strong> Perpetuals pay funding periodically. A position held across marks accrues it, and a carry strategy that ignores it is measuring the wrong thing.</p><p><strong>Liquidation, on the wick.</strong> Isolated margin with a maintenance rate, checked against one-minute candle extremes rather than closes, so a spike that retraced still takes the position. A simulator that only checks closes will under-report exactly the events that kill real accounts.</p><p><strong>The fill price, and where the liquidation sits.</strong> A market order does not land on the screen price - it walks the book, and it costs more the thinner that book is. Maintenance margin is not one number either: an exchange raises it with position size, so a large position is closed sooner than its leverage alone suggests. Both are switches here rather than assumptions. Off by default a fill lands on the live price at a flat 0.5%, which is right for learning and optimistic for proving out a strategy; turn them on and the fill moves against you the way a real book does while the liquidation moves with size, <a href="/trading-api/#realism">per account or per call</a>. Every trade records which way it ran and the public bot board prints it, so no result here can be quoted without saying what it was measured under.</p><p><strong>Orders that outlive your process.</strong> Limit entries, stop entries, stop-losses, targets and trailing stops have to be evaluated on the server. If they only exist while your script is running, you are testing your uptime, not your strategy.</p>'],
      ['Backtest, paper, live - and why the middle one gets skipped', '<p>A backtest replays historical candles. It is fast, it filters obvious losers, and it cannot catch a race condition in your order logic, a position-sizing bug that only appears after a losing streak, or leverage that quietly grows past what the margin survives. Those are the failures that empty accounts, and they only show up when the same code runs forward against prices nobody has seen yet.</p><p>Forward testing is the step most people skip, because it costs time rather than money. It is also the only stage that runs the exact code path that will run live. Do all three in order: backtest the idea, forward-test the bot for days or weeks, and fund an exchange account only once the paper result holds.</p>'],
      ['Start in three calls', '<p>The first one needs no key at all. <code>GET /api/bot/v1/price?symbol=BTC</code> is keyless and CORS-enabled, so it works from a terminal or a browser tab right now. Sign in with an email to mint a key, then <code>POST /api/bot/v1/open</code> places a leveraged position at the live price and returns its liquidation level, and <code>GET /api/bot/v1/positions</code> reports what happened while you were away. Stops, targets and liquidations settle on our side whether or not your bot is connected.</p><p>Official clients with no dependencies install with <code>pip install marginpad</code> and <code>npm install marginpad</code>, an MCP server at <code>https://marginpad.io/mcp</code> exposes the same account to Claude, ChatGPT or Cursor, and the full reference with a quickstart lives on <a href="/trading-api/">the Bot API page</a>. The free plan is the whole engine: 120 requests a minute, three keys, fifty open positions, the WebSocket stream, replay of a past day and every keyless market-data endpoint.</p>'],
    ],
    related: [['/trading-api/', 'the full Bot API reference'], ['/arena/', 'the public bot arena'], ['/paper-trade', 'paper trade by hand'], ['/crypto-backtester/', 'backtest an idea first']],
    faq: [
      ['Where can I test a trading bot for free?', 'On MarginPad\u2019s paper-trading API. Your bot opens leveraged positions at real live crypto prices and they settle on our servers in simulated dollars, with fees on both legs, funding, and liquidation checked against one-minute candle extremes. There is no deposit, no card and no KYC - an email gets you an API key, and the free plan carries the whole engine at 120 requests a minute.'],
      ['Is paper trading a bot actually useful, or should I just go live small?', 'Going live small still exposes you to the failures that matter, and it does so at the worst possible time - when you have least information about why something broke. Forward testing runs the same code path against the same live prices with the consequences removed, so a race condition in your order logic or a sizing bug after a losing streak costs a log line instead of an account. Go live small after the paper result holds, not instead of it.'],
      ['Can an AI agent trade on it?', 'Yes. MarginPad runs a remote MCP server at https://marginpad.io/mcp with 28 tools, so an assistant such as Claude, ChatGPT or Cursor can read markets and trade a paper account directly, without glue code. Market-data tools need no key at all; the paper-trading tools take a free API key in an X-API-Key header. Nothing there can touch real money.'],
      ['What does it cost?', 'Nothing to run a bot on it. The free plan is 120 requests a minute per key, three keys and fifty open positions, with the full trading engine, replay, the WebSocket stream, the MCP server and all keyless market data. Paid plans raise those ceilings and add webhooks and AI market reads; they do not unlock the product.'],
      ['Do the paper trades show up anywhere public?', 'Only if you want them to. Any account or book that closes at least five bot-opened trades in the current 14-day season is ranked on the public bot arena at /arena/ by realized profit and loss net of fees and funding. There is nothing to sign up for and no prize - trade through the API and the board picks you up.'],
    ],
  },
  {
    slug: 'how-many-traders-liquidated-today',
    kind: 'count',
    h1: 'How many traders got liquidated today?',
    title: 'How Many Traders Got Liquidated Today? - Live 24h Count | MarginPad',
    desc: 'The number of positions force-closed across nine crypto exchanges in the last 24 hours, counted from their own public liquidation feeds. Updated continuously, free, no signup.',
    lead: 'Counted, not estimated: every forced close our collector sees across nine exchanges in a rolling 24-hour window.',
    dataset: ['Crypto liquidation count (24h)', 'The number of individual forced-liquidation events observed across nine derivatives venues in a rolling 24-hour window, with the dollar total and the number of coins involved.', 'https://marginpad.io/api/v1/liquidations'],
    body: [
      ['Why the count matters more than the dollars', '<p>Almost every tracker publishes the dollar figure, because it is the bigger and more dramatic number. The <em>count</em> answers a different question: how many people it happened to. A quiet day where one whale loses forty million dollars and a violent day where twenty thousand retail positions are wiped out can print the same total, and they are not the same event. Divide the total by the count and you get the average position that died - usually a few thousand dollars, which is a better description of who trades leverage than any headline number.</p><p>A word on what this is not. It counts liquidation <em>events</em> published by the exchanges, and exchanges differ in how they publish: some emit one message per order filled while unwinding a position, so a single trader can appear more than once in a cascade. It is a measure of forced-close activity, not a headcount of distinct people, and nobody outside an exchange can produce the latter.</p>'],
      ['Method, in full', '<p>' + COLLECTOR + '</p><p>Totals here will differ from other trackers, and they should. Venue sets differ, exchanges publish at different granularity, and any aggregator that models the gaps will report more than one that only counts what it saw. We only count what we saw.</p>'],
      ['Take the number', '<p>Free as JSON, no key and no signup: <code>GET https://marginpad.io/api/v1/liquidations</code> returns <code>data.market.count</code> (events), <code>data.market.total</code> (dollars), the long and short split and the top coins, with <code>ts</code> as the UTC millisecond timestamp of the measurement. Per-venue figures are at <code>/api/v1/venues</code>. Documentation on the <a href="/free-crypto-api/">free crypto API</a> page.</p>'],
    ],
    faq: [
      ['How many crypto traders are liquidated in a day?', 'It swings by an order of magnitude with volatility. A calm day typically runs in the low tens of thousands of forced closes across the nine venues we watch; a sharp move can multiply that several times over in a matter of hours. The live figure at the top of this page is the count for the trailing 24 hours, so it answers the question for today rather than for an average day.'],
      ['Is this the number of people or the number of positions?', 'Positions, strictly speaking liquidation events published by the exchanges. Some venues emit one event per order filled as they unwind a position, so a single trader caught in a cascade can contribute more than one. Nobody outside an exchange can publish a headcount of distinct traders, and anyone who claims to is estimating.'],
      ['Why is your number different from other liquidation trackers?', 'Three reasons, all structural. We cover nine venues and other trackers cover a different set. Exchanges publish at different granularity and some batch their events. And several aggregators model the events they cannot see, which inflates the figure against one that only counts observed events. Ours is the smaller, checkable kind.'],
      ['What counts as a liquidation?', 'A forced close: the exchange closes a leveraged position because the margin backing it ran out, at whatever price the book gives. It is not a stop-loss, which the trader chose and which fills at their price. On most venues liquidation also carries a fee, so the trader loses slightly more than the margin they posted.'],
      ['Where can I see them happening?', 'The live feed at /rekt/ prints each forced close as it arrives with venue, coin, side and size. The heatmap shows where open leverage is stacked, and the per-coin breakdown is on the liquidation statistics page.'],
    ],
    related: [['/rekt/', 'the live liquidation feed'], ['/liquidations/', 'market totals'], ['/liquidations/by-exchange/', 'by exchange'], ['/heatmap', 'liquidation heatmap']],
  },
  {
    slug: 'longs-or-shorts-liquidated-more',
    kind: 'side',
    h1: 'Are longs or shorts getting liquidated more right now?',
    title: 'Longs or Shorts Liquidated More? - Live 24h Split | MarginPad',
    desc: 'Which side of the crypto market is being force-closed right now: the long versus short liquidation split over 24 hours, measured across nine exchanges, with the breakdown per venue.',
    lead: 'The side that is losing, measured rather than guessed, from nine exchanges&#39; own liquidation feeds.',
    dataset: ['Crypto long versus short liquidations (24h)', 'The split of forced-liquidation dollars between long and short positions over a rolling 24-hour window, market-wide and per derivatives venue.', 'https://marginpad.io/api/v1/liquidations'],
    body: [
      ['What the split actually tells you', '<p>It tells you which way the crowd was leaning when the move came, and that is usually more useful than the size of the move itself. Heavy long liquidations mean leveraged buyers were crowded and price went down into them. Heavy short liquidations mean the squeeze ran the other way. When the two sides are close to even, the market chopped rather than trended, and both sides paid for it.</p><p>The one thing the split does not tell you is what happens next. A wave of long liquidations often marks the end of a flush, because the leveraged supply has already been taken out - and just as often it is the first leg of a longer one. Read it as a description of what has already happened to positioning, not as a signal.</p>'],
      ['Why it differs so much between exchanges', '<p>The per-venue table above usually disagrees with itself, and that is the interesting part. A venue whose 24-hour flow is ninety percent long liquidations while another sits near fifty is telling you its own users were positioned differently - often a retail-heavy venue against one with more professional flow, or a regional user base that was long into news the rest of the market was not. The market-wide figure hides that; the venue column is where it shows.</p>'],
      ['Method, in full', '<p>' + COLLECTOR + '</p>'],
      ['Take the data', '<p>Free as JSON, no key: <code>GET https://marginpad.io/api/v1/liquidations</code> carries <code>data.market.long</code> and <code>data.market.short</code> plus the same split per coin, and <code>GET https://marginpad.io/api/v1/venues</code> carries it per exchange with a <code>longPct</code> field. Both stamp the measurement time in <code>ts</code>.</p>'],
    ],
    faq: [
      ['Are longs or shorts liquidated more often?', 'Over a long enough window longs, by a wide margin, for a simple structural reason: crypto spends more of its time trending up than down, so more leverage sits on the long side and is therefore available to be liquidated. Over any single day it goes either way, which is why the figure at the top of this page is measured for the trailing 24 hours rather than stated as a rule.'],
      ['What does it mean when long liquidations spike?', 'That leveraged buyers were crowded and price fell into their liquidation levels, forcing market sells that push price further down - the cascade. The useful follow-up question is whether open interest fell with it. Price down with open interest down means leverage was flushed out; price down with open interest flat means new shorts replaced the liquidated longs.'],
      ['Does a short squeeze show up here?', 'Yes, as the mirror image: a run of short liquidations, concentrated in a short window, usually on the venues where shorts were most crowded. The live feed at /rekt/ shows the sequence as it happens, which is the clearest way to tell a squeeze from steady two-way flow.'],
      ['Where does this data come from?', 'MarginPad&#39;s own collector, subscribed directly to the public liquidation websocket of nine exchanges. These are observed forced closes rather than estimates, and the venue set is published so the number can be checked against its own source.'],
      ['Can I get it as an API?', 'Yes, free and keyless: /api/v1/liquidations for the market-wide and per-coin split, /api/v1/venues for the same split per exchange. Both are documented on the free crypto API page.'],
    ],
    related: [['/rekt/', 'the live liquidation feed'], ['/liquidations/by-exchange/', 'by exchange'], ['/long-short/', 'long/short account ratios'], ['/heatmap', 'liquidation heatmap']],
  },
  {
    slug: 'biggest-liquidation-today',
    kind: 'big',
    h1: 'What is the biggest crypto liquidation today?',
    title: 'Biggest Crypto Liquidation Today - Live Single Largest Forced Close | MarginPad',
    desc: 'The single largest crypto liquidation of the last 24 hours: which coin, which exchange, which side and how much, observed live from nine exchange feeds. Free, updated continuously.',
    lead: 'The single largest forced close our collector has seen in the last 24 hours, with the venue and the side it was on.',
    dataset: ['Largest single crypto liquidation (24h)', 'The largest individual forced-liquidation event observed across nine derivatives venues in a rolling 24-hour window, with its venue, symbol, side and dollar notional.', 'https://marginpad.io/api/v1/liquidations'],
    body: [
      ['Why one position is worth a page', '<p>The day&#39;s total tells you how much leverage died. The largest single event tells you what kind of trader died, and those are different stories. A hundred-million-dollar day made of twenty thousand small positions is a retail flush. The same total with one forty-million-dollar position in it is a fund, a market maker with a bad hedge, or somebody who thought they could carry size through an event. The second kind moves the book on the way out, because unwinding it means market orders into whatever depth happens to be there.</p><p>Size is measured as notional in US dollars: fill price times quantity, as the exchange published it. That is the position that was closed, not the money the trader lost - a liquidated position at fifty times leverage costs its owner roughly one fiftieth of the notional plus fees.</p>'],
      ['Method, in full', '<p>' + COLLECTOR + '</p><p>&ldquo;Largest&rdquo; here means the largest single published event. A venue that unwinds a big position in several fills publishes several events, so a position larger than the one shown can be broken into pieces that individually rank lower. We report what the exchange published rather than stitching fills together, because stitching requires assumptions and this number should not need any.</p>'],
      ['Take the data', '<p>Free as JSON, no key: <code>GET https://marginpad.io/api/v1/liquidations</code> and read <code>data.big</code> for the venue, symbol, side and dollar notional, alongside the market totals and the per-coin breakdown. Individual events as they arrive are at <code>/api/v1/liquidations/recent</code>.</p>'],
    ],
    faq: [
      ['What was the biggest crypto liquidation ever?', 'The largest single events on record run into the hundreds of millions of dollars and cluster around the violent days: March 2020, May 2021, the November 2022 collapse, and the August 2024 unwind. We do not publish an all-time figure here because we can only vouch for what our own collector observed, and it has not been running since 2020. The number at the top of this page is strictly the largest of the last 24 hours, from feeds you can check.'],
      ['Does the biggest liquidation move the price?', 'A large one usually does, briefly. A forced close is a market order, so unwinding a big position eats whatever depth is in the book and prints a wick. That is why single large liquidations often mark the extreme of a move rather than its middle - the worst price of the day is frequently the print where somebody was closed out.'],
      ['How much money did that trader actually lose?', 'Roughly the margin backing the position, not the notional shown. At ten times leverage a liquidated one-million-dollar position cost about a hundred thousand; at fifty times, about twenty thousand, plus the liquidation fee most venues charge. The notional is the size of the position, not the size of the loss.'],
      ['Why do different sites report different biggest liquidations?', 'Because they watch different exchanges and treat multi-fill unwinds differently. A tracker that stitches consecutive fills into one position will report a larger single figure than one that reports the published events, as we do. Neither is wrong; they answer slightly different questions.'],
      ['Where can I watch these as they happen?', 'The live feed at /rekt/ prints every forced close above a size you choose, with venue, coin, side and notional, as it arrives.'],
    ],
    related: [['/rekt/', 'the live liquidation feed'], ['/liquidations/', 'market totals'], ['/heatmap', 'liquidation heatmap'], ['/hyperliquid-whales/', 'live whale positions']],
  },
  {
    slug: 'is-funding-positive-or-negative',
    kind: 'funding',
    h1: 'Is funding positive or negative right now?',
    title: 'Is Crypto Funding Positive or Negative Right Now? - Live Rates | MarginPad',
    desc: 'Live perpetual futures funding rates: whether longs are paying shorts or the other way round, for Bitcoin, Ethereum and the whole market, read from exchange public endpoints. Free, no signup.',
    lead: 'Who is paying whom to hold a perpetual position, right now, read from the exchanges&#39; own funding endpoints.',
    dataset: ['Perpetual futures funding rates', 'Current funding rate per perpetual contract across major derivatives venues, with the mark price, 24-hour change and open interest for each.', 'https://marginpad.io/api/v1/funding'],
    body: [
      ['What the sign means, in one line each', '<p><strong>Positive funding</strong> means longs pay shorts. More money wants leveraged exposure to the upside than to the downside, so the perpetual trades above spot and the funding payment drags it back. <strong>Negative funding</strong> means shorts pay longs: the crowd is positioned for a fall, the perpetual trades below spot, and holding a long is being subsidised.</p><p>The rate is charged periodically - every eight hours on most venues, hourly on Hyperliquid - on the full notional of the position, not on the margin. That is the part people miss. A 0.05% rate on a position opened with ten times leverage costs 0.5% of the money actually posted, every funding period. Carry a crowded long for a week at an elevated rate and funding alone can eat a double-digit percentage of the stake before price does anything at all.</p>'],
      ['How traders read it', '<p>Mild positive funding is the resting state of a healthy market and says nothing. What is worth noticing is the extreme: a rate several times its own normal level means leverage is crowded on one side and is paying dearly to stay there, which is the condition a squeeze needs. It is a positioning gauge, not a timing signal - funding can sit extended for days while price keeps going the way the crowd wanted.</p><p>The other use is arithmetic rather than sentiment. If you are holding a leveraged position for more than a day, funding is a real cost that belongs in the trade, next to the fees. Our <a href="/calculators?c=pnl">profit and loss calculator</a> and <a href="/paper-trade">paper trading</a> both charge it the way an exchange does, so a carried position shows the drag instead of hiding it.</p>'],
      ['Method', '<p>Rates come from each venue&#39;s own public funding endpoint, refreshed continuously, alongside the mark price and open interest for the same contract. Where several venues list the same coin the page shows the aggregated view; where only one does, it is that one. Nothing here is a prediction of the next rate - it is the rate currently in force.</p>'],
      ['Take the data', '<p>Free as JSON, no key: <code>GET https://marginpad.io/api/v1/funding</code> returns every listed perpetual with its funding rate, price, 24-hour change and open interest, and <code>ts</code> as the measurement time. Open interest on its own is at <code>/api/v1/open-interest</code> and the share of accounts long versus short at <code>/api/v1/long-short</code>.</p>'],
    ],
    faq: [
      ['What does positive funding mean?', 'Longs pay shorts. It is the market&#39;s way of pulling a perpetual contract back to the spot price: when more leverage wants the upside, the perpetual trades above spot and the holders of that upside pay a periodic fee to the other side until the gap closes. Persistent positive funding means the crowd is long and paying for it.'],
      ['Is negative funding bullish?', 'It is a positioning fact rather than a direction. Negative funding means shorts are crowded and paying longs to stay short, which does make a squeeze cheaper to sit through if you are on the other side. But funding has stayed negative through long declines, so treat it as a description of who is paying, not a forecast.'],
      ['How much does funding actually cost?', 'The rate is applied to the notional of the position, so leverage multiplies its effect on your margin. At 0.01% every eight hours - a very ordinary rate - a position opened at twenty times leverage pays about 0.6% of the posted margin per day. Over a week that is meaningful. Our calculators and paper trading charge it on the same schedule, which is the simplest way to see it on a real position.'],
      ['How often is funding paid?', 'Every eight hours on most centralised venues (typically 00:00, 08:00 and 16:00 UTC), and hourly on Hyperliquid. You pay or receive it only if you hold the position across the timestamp; opening and closing between two funding times costs nothing in funding.'],
      ['Where do these rates come from?', 'Each exchange&#39;s own public funding endpoint, read directly rather than through a data vendor, refreshed continuously and served free through /api/v1/funding.'],
    ],
    related: [['/funding/', 'the full funding scanner'], ['/open-interest/', 'open interest'], ['/long-short/', 'long/short ratios'], ['/paper-trade', 'practise with funding charged']],
  },
];

function page(p) {
  const url = 'https://marginpad.io/' + p.slug + '/';
  const faqLd = p.faq.map(([q, a]) => '{"@type":"Question","name":' + JSON.stringify(q) + ',"acceptedAnswer":{"@type":"Answer","text":' + JSON.stringify(a.replace(/<[^>]+>/g, '')) + '}}').join(',');
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>${p.title}</title>
<meta name="description" content="${p.desc}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">
<meta property="og:title" content="${p.title}">
<meta property="og:description" content="${p.desc}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/blog.css" />
<style>
/* ── the answer is the page ─────────────────────────────────────────────────────────────────────────
   These five pages exist to answer one question, and until 2026-09-16 the answer arrived as a callout
   inside a blog post - so they READ as blog posts. The answer breaks the reading column now and sits as
   its own object: display type, one sentence, then where the figure came from. Everything is static HTML;
   a crawler runs no JavaScript and the figure is server-rendered into #askdata before the page is sent. */
.qeye{font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:.17em;text-transform:uppercase;color:var(--lime);margin:30px 0 12px;display:flex;align-items:center;gap:10px}
.qeye::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(194,246,74,.35),transparent)}
/* The ANSWER is the largest thing on the page, not the question. blog.css sizes h1 at clamp(32,5.5vw,50)
   for an article title, which on a phone made the question half again bigger than the answer under it -
   the wrong hierarchy for a page that exists to answer one thing. The question still has to be recognisable
   at a glance (a reader arriving from an assistant is checking they are in the right place), so it stays
   large - just never larger than what it is asking for. */
article h1{margin:0 0 14px;font-size:clamp(27px,4.3vw,39px)}

.ansbox{position:relative;margin:26px -26px 0;padding:28px 30px 24px;border:1px solid var(--line-bright);border-radius:18px;
  background:radial-gradient(120% 140% at 0% 0%,rgba(194,246,74,.07),transparent 58%),linear-gradient(180deg,#12161c,#0d1014);overflow:hidden}
.ansbox::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,var(--lime),rgba(194,246,74,.12) 42%,transparent)}
.ansbox .big{font-family:'Bricolage Grotesque','Familjen Grotesk',system-ui,sans-serif;font-size:clamp(30px,5.6vw,47px);line-height:1.12;font-weight:800;letter-spacing:-.025em;color:#f4f2ec;margin:0 0 14px;font-variant-numeric:tabular-nums;text-wrap:balance}
.ansbox .big span,.ansbox .big b,.ansbox .big strong{color:var(--lime);font-weight:800}
.ansbox .say{margin:0;font-size:15.5px;line-height:1.72;color:var(--ink-dim);max-width:66ch}
.ansbox .say strong{color:var(--ink)}
.ansbox .say a{color:var(--lime)}
/* provenance: when, from what, and the free JSON that returns the same number. This is the reason to cite
   us instead of lifting the figure, and it used to be one line of grey small print. */
.prov{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:9px 26px;margin:20px -30px -24px;padding:14px 30px;border-top:1px solid var(--line);background:rgba(0,0,0,.28);
  font-family:'Space Mono',monospace;font-size:11.5px;line-height:1.55;letter-spacing:.02em;color:var(--ink-faint)}
/* a GRID, not a sentence with separators. Flex-wrap put the dot at the start of every wrapped line, where it
   read as a typo - and these items are three different kinds of provenance, not three clauses. One per cell,
   one per line on a phone, and no separator can ever be orphaned. */
.prov span{display:block;position:relative;padding-left:13px}
.prov span::before{content:'';position:absolute;left:0;top:.52em;width:4px;height:4px;border-radius:50%;background:var(--line-bright)}
.prov span:first-child::before{background:var(--lime);opacity:.7}
.prov a{color:var(--ink-dim);text-decoration:none;border-bottom:1px solid var(--line-bright)}
.prov a:hover{color:var(--lime)}
@media(max-width:720px){.ansbox{margin-left:-14px;margin-right:-14px;padding:22px 18px 20px;border-radius:14px}.prov{margin:18px -18px -20px;padding:13px 18px;gap:8px}}

/* the supporting figures. Digits line up in a column, so tabular-nums and the mono face; the note column
   is the one thing allowed to wrap. min-width:0 on the scroll box or a wide table widens the document. */
.ask-w{overflow-x:auto;-webkit-overflow-scrolling:touch;min-width:0;margin:22px 0 0;border:1px solid var(--line);border-radius:14px;background:#0e1116}
.ask-t{width:100%;border-collapse:collapse;font-size:14px;margin:0}
.ask-t th,.ask-t td{padding:11px 16px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}
.ask-t tr:last-child td{border-bottom:0}
.ask-t tbody tr:hover td{background:rgba(255,255,255,.018)}
.ask-t th{font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.11em;color:var(--ink-faint);font-weight:400;background:rgba(0,0,0,.25)}
.ask-t th.r{text-align:right}
.ask-t td.n{font-family:'Space Mono',monospace;text-align:right;color:var(--ink);font-variant-numeric:tabular-nums}
.ask-t td:last-child,.ask-t th:last-child{color:var(--ink-dim);font-size:12.5px;white-space:normal;text-align:left;font-family:inherit;min-width:180px}
.ask-t td:first-child{font-weight:600;color:var(--ink)}
.ask-t a{color:var(--ink-dim)}
@media(max-width:720px){.ask-t th,.ask-t td{padding:10px 12px}.ask-t td:last-child{min-width:150px}}

/* where to go next, right under the answer - a link is the useful half of an assistant's reply */
.ask-cta{display:inline-flex;align-items:center;margin:0;padding:10px 16px;border-radius:11px;background:var(--lime);color:#0a0b0d;font-weight:700;font-size:14px;text-decoration:none;transition:transform .12s ease,background .12s ease}
.ask-cta.alt{background:none;border:1px solid var(--line-bright);color:var(--ink)}
.ask-cta:hover{transform:translateY(-1px)}
.ask-cta.alt:hover{border-color:var(--lime);color:var(--lime)}
.ctarow{display:flex;flex-wrap:wrap;gap:9px;margin:24px 0 6px}

/* the questions. A <details> with no styling reads as a browser default in the middle of a designed page. */
article details{border-bottom:1px solid var(--line);padding:0}
article details:first-of-type{border-top:1px solid var(--line)}
article details summary{list-style:none;cursor:pointer;padding:16px 34px 16px 0;position:relative;font-weight:600;color:var(--ink);font-size:15.5px;line-height:1.45}
article details summary::-webkit-details-marker{display:none}
article details summary::after{content:'';position:absolute;right:6px;top:22px;width:7px;height:7px;border-right:1.5px solid var(--ink-faint);border-bottom:1.5px solid var(--ink-faint);transform:rotate(45deg);transition:transform .16s ease}
article details[open] summary::after{transform:rotate(-135deg)}
article details summary:hover{color:var(--lime)}
article details p{margin:0 0 18px;max-width:68ch}

/* the other four questions, so each page feeds the family instead of being a dead end */
.sibs{margin:44px 0 0;padding:22px 0 0;border-top:1px solid var(--line)}
.sibs h2{font-size:15px!important;padding-left:0!important;margin:0 0 14px!important;font-family:'Space Mono',monospace!important;font-weight:400!important;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-faint)!important}
.sibs h2::before{display:none}
.sibs ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:9px}
.sibs li{margin:0}
.sibs a{display:block;padding:14px 16px;border:1px solid var(--line);border-radius:12px;color:var(--ink);text-decoration:none;font-size:14.5px;line-height:1.4;background:#0e1116;transition:border-color .12s ease,color .12s ease}
.sibs a:hover{border-color:var(--lime);color:var(--lime)}
</style>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Dataset","name":${JSON.stringify(p.dataset[0])},"description":${JSON.stringify(p.dataset[1])},"url":"${url}","license":"https://marginpad.io/terms/","isAccessibleForFree":true,"creator":{"@type":"Organization","name":"MarginPad","url":"https://marginpad.io/"},"temporalCoverage":"P1D","dateModified":"2026-09-14","distribution":[{"@type":"DataDownload","encodingFormat":"application/json","contentUrl":"${p.dataset[2]}"}],"measurementTechnique":"Direct subscription to exchange public feeds; events normalised and aggregated over a rolling 24-hour window."}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","dateModified":"2026-09-14","mainEntity":[${faqLd}]}</script>
${GTAG}
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="/liquidations/">Liquidations</a><a href="/heatmap">Heatmap</a><a href="/trading-api/">API</a></nav>
  </header>
  <article>
    <p class="qeye">One question, one answer</p>
    <h1>${p.h1}</h1>
    <p class="lead">${p.lead}</p>

    <div id="askdata">
      <div class="ansbox"><p class="say">Reading the live figure&hellip;</p></div>
    </div>

    <p class="ctarow">${p.related.map(r => '<a class="ask-cta' + (r === p.related[0] ? '' : ' alt') + '" href="' + r[0] + '">' + r[1][0].toUpperCase() + r[1].slice(1) + '</a>').join('')}</p>

${p.body.map(([h, b]) => '    <h2>' + h + '</h2>\n    ' + b).join('\n\n')}

    <h2>Questions</h2>
    ${p.faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('\n    ')}

    <div class="sibs">
      <h2>Other questions we answer with a live number</h2>
      <ul>${SIBS.filter(x => x[0] !== '/' + p.slug + '/').map(x => '<li><a href="' + x[0] + '">' + x[1] + '</a></li>').join('')}</ul>
    </div>
    <p style="margin-top:26px;font-size:13.5px">Related: ${p.related.map(r => '<a href="' + r[0] + '">' + r[1] + '</a>').join(' &middot; ')}</p>
  </article>
  <footer>
    <span>&copy; 2026 MarginPad</span>
    <span><a href="/">Calculators</a> &middot; <a href="/blog/">Blog</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="/privacy/">Privacy</a></span>
  </footer>
</div>
</body>
</html>
`;
}

let n = 0;
for (const p of PAGES) {
  const dir = path.join(DIST, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  const html = page(p);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  n++;
  console.log('  /' + p.slug + '/  ' + Math.round(html.length / 1024) + ' KB  (ssr kind: ' + p.kind + ')');
}
console.log('wrote ' + n + ' question pages → dist/<slug>/index.html');
console.log('NOTE: these are hand-made dist pages - git add -f them, and the worker must route each slug to handleSsrAsk.');
