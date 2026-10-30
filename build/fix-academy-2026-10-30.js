/* Academy refresh (2026-10-30, owner: "proveri da li je akademija up to date sa promenama ... obogati lekcije, dodaj vise koraka").
   Rewrites the EN lessons inside #acadData in dist/academy/index.html that still described a retired product:
     mp2  the Bronze gate on rewards (retired 2026-10-23)        mp3  $0.02/$0.20 faucet, "Moon or Fomo", Bybit-or-Moon payouts
     mp4  1000x "a tenth of one percent"                          mp6  stop/target wording (adds the ticket steps)
     mp7  "seven boards, four cost nothing, need Bronze"          ex10 Demo Spot without the terminal and the theses
     mm1  "$100" paper account                                    mm2  "over 200 pairs"
     mm3  "ten windows", AI for any signed-in user                mm6  alerts = "email or Telegram" on /alerts
     mm7  four boards, "7-day duel"                               + NEW mm8 "What moved the price" (Catalysts)
     try hrefs /#size and /#liq -> /calculators?c=size|liq (the bento homepage has no such anchors).
   EVERY touched lesson gains a card ON PURPOSE: the page drops a translated lesson whose card count differs from EN and
   renders the English one, so a changed fact can never survive in any of the 13 packs. es/pt/de are re-translated
   beside this; the other ten fall back to English for these lessons until a round.
   Idempotent: a page that already carries mm8 is refused (restore from git first). --dry prints and writes nothing. */
const fs = require('fs');
const path = require('path');
const PAGE = path.join(__dirname, '..', 'dist', 'academy', 'index.html');
const DRY = process.argv.includes('--dry');
let html = fs.readFileSync(PAGE, 'utf8');
const DM = html.match(/<script type="application\/json" id="acadData">([\s\S]*?)<\/script>/);
if (!DM) { console.error('no #acadData'); process.exit(1); }
const data = JSON.parse(DM[1]);
if (data.courses.some(c => c.lessons.some(l => l.id === 'mm8'))) { console.error('already applied (mm8 exists) - restore dist/academy/index.html from git first'); process.exit(1); }
const before = data.courses.reduce((n, c) => n + c.lessons.length, 0);
const byId = {}; data.courses.forEach(c => c.lessons.forEach(l => { byId[l.id] = l; }));

const L = {
  mp2: {
    t: 'XP, your level, and Bronze',
    cards: [
      { h: 'XP is just what you did, counted', v: 'mpxp', p: 'Every lesson you finish is 25 XP, every day you show up is 20, a trade is 3 and a winning one 15. Nothing is bought and nothing is random - XP is a record of having used the site. The number sits next to your name in your account menu and at the top of your season page.' },
      { h: 'Bronze is the first level, not a gate', p: 'Below 500 XP you are Unranked; at 500 you are Bronze, then Silver, Gold, Platinum, Diamond, Master and Legendary as the number climbs. Nothing on this site waits for a level any more: the faucet, the daily missions, referrals, withdrawals and every free board are open from the day you sign up. A level is a badge and a bonus, never a lock.' },
      { h: 'What a level actually changes', p: 'From Silver up, every faucet claim pays a little more - the multiplier climbs with the level. Each level unlocks a frame for your profile card, and the Gold Room board - one of the nine - only ranks accounts at Gold, which is 12,000 XP. That is the whole list. The practice terminal, the charts and the alerts are the same at every level.' },
      { h: 'This course is most of the way there', p: 'You are reading lesson two of seven. Finishing all seven, with the two Road to Bronze bonuses they trigger, puts you a little over 400 XP - so after this, one paper trade with a stop-loss on it, or simply coming back tomorrow, is Bronze. The Road to Bronze card on your season page lists the nine starter tasks and what each one pays.' }
    ],
    quiz: [
      { q: 'What is Bronze?', o: ['A paid membership tier', 'The level you reach at 500 XP', 'The first leaderboard prize', 'A cosmetic frame for your profile card'], a: 1 },
      { q: 'What does reaching Bronze unlock?', o: ['The faucet and the missions', 'Withdrawals', 'Nothing - the rewards were open from the day you signed up; a level is a badge and a bonus', 'The charts and the heatmap'], a: 2 },
      { q: 'What is the fastest free way to earn XP?', o: ['Opening as many trades as possible', 'Academy lessons - 25 each, plus 50 for a finished course', 'Leaving the site open in a tab', 'Inviting friends'], a: 1 }
    ]
  },
  mp3: {
    t: 'The real money on this site',
    try: { p: 'Everything named above lives on one page. Open it and see where your balance, the faucet and the sign-up bonuses are - it will make more sense once you have seen the layout.', label: 'Open Rewards', href: '/rewards/' },
    cards: [
      { h: 'Where it comes from', v: 'mpmoney', p: 'MarginPad is free and carries no advertising. It earns when a reader opens an account at an exchange through one of our links, and the exchange shares part of its fee. That is the whole business, and it is why the rewards are small, real and capped rather than large and imaginary.' },
      { h: 'What is on the table', p: 'A $0.50 welcome bonus. $0.01 from the faucet every few minutes, up to $0.10 a day. Daily missions on top, a cent or two each. $1.00 for opening a Moon, MEXC, BingX or Bybit account through us - three of the four are checked automatically against the affiliate list. $0.50 when a friend you invited really trades. None of it waits for a level.' },
      { h: 'Getting it out', p: 'The balance is paid in USDT and you can cash out from $5.00 to a Bybit, Moon or MEXC account that was opened through MarginPad. Every withdrawal is checked and paid by hand, so it is not instant. This is a thank-you for using the site, not an income - treat it as what it is and it will never disappoint you.' },
      { h: 'How a withdrawal actually goes', p: 'You type the amount, from $5 up to your balance, and the account to pay it to. One request at a time: a second one waits until the first is paid. The desk sees whether that exchange account was really opened through us, whether another member already withdrew to the same one, and how the balance was earned - so a real account is paid and a farm is not. You get a notification when it lands.' }
    ],
    quiz: [
      { q: 'How does MarginPad make money?', o: ['Selling your data', 'Exchange affiliate links - a share of the fee when someone signs up through us', 'Charging for the Academy', 'Taking a cut of paper-trading profits'], a: 1 },
      { q: 'What is the smallest amount you can withdraw?', o: ['$1.00', '$5.00', '$20.00', 'There is no minimum'], a: 1 },
      { q: 'Which of these waits for a level?', o: ['The faucet', 'Daily missions', 'Referrals', 'None of them - every reward is open from day one'], a: 3 }
    ]
  },
  mp4: {
    t: 'Long, short, and what leverage really does',
    cards: [
      { h: 'Two directions, not one', v: 'wdlong', p: 'A long wins when price goes up. A short wins when price goes down. That is the entire difference, and it is why a futures trader is never forced to sit out a falling market. On MarginPad both are one tap: the Long and Short buttons on the trade ticket.' },
      { h: 'Leverage is size, not magic', v: 'mplev', p: 'Put $100 down at 10x and you are moving a $1,000 position. Every 1% the market travels is now 10% of your money, in whichever direction it travels. Leverage does not improve a trade - it multiplies whatever the trade was going to do to you anyway.' },
      { h: 'The ladder on the ticket', p: 'The leverage control snaps to a ladder: whole steps up to 10x, then tens - 20, 30, 50, 100 and on. Type 107 and it commits as 110. The ladder exists so the number you chose is one you can say out loud, and so the liquidation line the chart draws from it is one you can read before you open.' },
      { h: 'Why we let you go to 1000x', p: 'The majors here go all the way to 1000x, far past anything a sane person would use. That is deliberate. At 1000x less than a tenth of one percent against you ends the position - and you should find that out on a practice account, tonight, rather than on an exchange with your own money.' }
    ],
    quiz: [
      { q: 'You commit $100 at 10x leverage. How big is the position?', o: ['$100', '$110', '$1,000', '$10,000'], a: 2 },
      { q: 'A short position makes money when:', o: ['Price rises', 'Price falls', 'Price stays flat', 'Volume rises'], a: 1 },
      { q: 'What does raising the leverage actually change?', o: ['The odds of being right', 'The size of the position, so every move counts for more', 'The fee you pay', 'How long you may hold the trade'], a: 1 }
    ]
  },
  mp6: {
    t: 'Your two exits: stop-loss and take-profit',
    cards: [
      { h: 'Decide the exit before you need it', v: 'mpexits', p: 'A stop-loss closes the trade at a price you choose if it goes wrong. A take-profit does the same if it goes right. Both are set once and then honoured without you, which is the point: the moment a position is losing is the worst possible moment to be deciding what to do about it.' },
      { h: 'Where you set them here', p: 'On the ticket, before you open - or afterwards, from the Set button on the trade card and from My Trades. You can move them as many times as you like while the trade is open. A trade with neither is a trade whose exit will be chosen by whatever you happen to be feeling at the time.' },
      { h: 'On the ticket, step by step', p: 'Open Advanced under the trade form. The stop and the target each take a price, or a percent of your margin - type one and the other is rewritten, so they can never disagree. The panel pre-fills a stop 2% away and a target 3% away as a starting point; flip the side and the auto-filled levels flip with it. What the panel hides does not apply: close Advanced and the trade opens without them.' },
      { h: 'This is the habit worth building', p: 'Nothing else in this course will change your results as much. On the boards that pay real USDT, the accounts that last are not the ones who pick better entries - they are the ones who had already decided where they would be wrong. Setting one is also a Road to Bronze task, worth 40 XP.' }
    ],
    quiz: [
      { q: 'What does a stop-loss do?', o: ['Stops you opening more trades', 'Closes the trade at a price you chose, if it goes against you', 'Pauses the position', 'Guarantees you cannot lose'], a: 1 },
      { q: 'When can you set or move a stop-loss on MarginPad?', o: ['Only when opening the trade', 'Only after it is in profit', 'Before opening, and at any time while the trade is open', 'Once per day'], a: 2 },
      { q: 'You type a stop as a percent of margin. What happens to the price field?', o: ['Nothing - they are separate', 'It is rewritten to match, so the two never disagree', 'It is cleared', 'It is locked'], a: 1 }
    ]
  },
  mp7: {
    t: 'Seasons, boards and the pass',
    try: { p: 'That is the whole tour. The one thing left is the thing the site is for: open the terminal, pick a coin, put a small position on with a stop-loss, and watch what happens. That single trade is the last step to Bronze.', label: 'Open Paper Trade', href: '/paper-trade' },
    cards: [
      { h: 'The site runs in fourteen-day seasons', v: 'mpseason', p: 'Everything competitive resets on a fourteen-day clock. Your season XP, your standing on the boards and the pass all start again, so a bad fortnight is never permanent and a newcomer is never a year behind. The day of the season is printed at the top of the season page.' },
      { h: 'Nine boards, seven of them free', p: 'Nine leaderboards pay real USDT when a season ends, and they all live on one page, /leaderboards/. Seven cost nothing: Highest ROE, Green Days, Best Win Rate, Season XP, the Daily BTC Call, Meme Spot and the Gold Room - the only one with a condition, Gold level. Two are for readers who trade real money at Bybit or Moon through MarginPad. The pools and the prize splits are printed on the page.' },
      { h: 'And the pass runs underneath all of it', p: 'Every 100 season XP is a pass tier, forty of them, and the free track pays out in Ticks and cosmetics as you climb. You are already earning it - the XP from this course counted toward it while you were reading. The paid track adds pieces nobody can buy in the shop.' },
      { h: 'Beyond the boards', p: 'A duel puts you against one trader for an hour, a day, three days or a week, on a metric you both agree to, with Ticks on the line. A squad is up to five of you with a private room, raids on the majors and a logo. Demo Spot is buy-and-hold with $10,000 and a board of its own. None of it is required - the terminal is the product; the rest is what keeps practice from feeling like homework.' }
    ],
    quiz: [
      { q: 'How long is a MarginPad season?', o: ['Seven days', 'Fourteen days', 'One month', 'Until someone wins'], a: 1 },
      { q: 'How many of the nine boards cost nothing to enter?', o: ['Two', 'Four', 'Seven', 'All nine'], a: 2 },
      { q: 'Where do the standings of every board live?', o: ['/season/', '/leaderboards/', 'The Telegram channel', 'Inside the terminal'], a: 1 }
    ]
  },
  ex10: {
    t: 'Demo Spot: $10,000, buy and hold, one board',
    cards: [
      { h: 'Spot is owning the coin', p: 'A spot buy means you own the coin itself, at the price it trades for right now. No leverage, no liquidation price, no funding: it can go to zero and that is the worst case. Demo Spot gives you $10,000 of demo cash to do exactly that with meme coins on four chains and the top 250 majors, at live prices, with no fees. Press Claim once a day and $100 more lands in your cash - it is never automatic.' },
      { h: 'A price comes from a pool', p: 'A meme coin has no exchange order book; its price is whatever the deepest liquidity pool says. Demo Spot reads that pool live, so the number you buy at is the real one - but a pool holding under $1,000 is refused outright, because a price with nothing behind it is fiction, and a pool that empties overnight is a rug: the coin stays in your account marked RUGGED and is worth exactly what a sale would fetch, which is nothing.' },
      { h: 'The contract address is the identity', p: 'Ten tokens can share a ticker; only one has the address you meant. Paste a contract address into Demo Spot and it resolves from DexScreener or GeckoTerminal to the token behind it, with its liquidity and FDV, and a warning when it is not on the trending list. Check it on the explorer before you trust a name - copies of famous tokens are the classic scam.' },
      { h: 'It is a terminal, not a form', p: 'The page is laid out like the futures terminal: the market list on one side, the chart and the Buy button in the middle, your assets, coins, the floor and the theses on the other. On a phone the dock at the bottom switches between them. The floor shows what every member is buying and selling right now; a name on it opens their profile card.' },
      { h: 'The board pays profit, and a thesis pays XP', p: 'One leaderboard, ranked by season profit in dollars: what your portfolio is worth now minus what it was worth when the 14-day season started, with every daily claim taken out. The three biggest profits are paid $15, $10 and $5 in real USDT. Write a thesis about a coin you hold and it is published to the Community for 50 XP - and each member who buys that coin after reading it pays you 25 more, up to 1,000 a day. At the end of a season every bag is cleared and everyone starts level again.' }
    ],
    quiz: [
      { q: 'What is the worst case for a spot position?', o: ['A liquidation when price moves 5%', 'A funding payment every eight hours', 'The coin goes to zero and you lose what you paid', 'The exchange closes it after a day'], a: 2 },
      { q: 'Where does a meme coin price come from in Demo Spot?', o: ['The owner types it in', 'The deepest liquidity pool, read live', 'Yesterday’s close', 'The average of three exchanges'], a: 1 },
      { q: 'Two tokens share the ticker PEPE. How do you tell which is which?', o: ['By the logo', 'By the contract address', 'By which one is cheaper', 'By the name in the chat'], a: 1 },
      { q: 'Who can publish a thesis about SOL?', o: ['Anyone signed in', 'Only a member who holds SOL in Demo Spot', 'Only Premium members', 'Only the top three on the board'], a: 1 }
    ]
  },
  mm1: {
    t: 'Paper Trade Like It’s Real',
    cards: [
      { h: 'Fake money, real habits', p: 'The paper account gives you $10,000 that cannot actually vanish. That is the point, and the trap. Treat it like a video game and you will learn nothing except how to mash buttons. Treat it like your actual rent money and you will learn sizing, patience, and what a liquidation feels like - the only three things worth knowing before you ever touch a live exchange.' },
      { h: 'Same math as a live exchange', v: 'margins', p: 'This is not a toy simulator with made-up rules. Paper Trade runs on live prices and the exact liquidation formula real exchanges use - margin, leverage, maintenance rate, all of it. A 50× long that gets liquidated here would have been liquidated on a real exchange too. If a strategy cannot survive practice math, it will not survive real math either.' },
      { h: 'Your position lives on the server', p: 'Open a trade and it is held on our side, not in your browser tab. Close the laptop, switch phones, lose signal - the stop, the target and the liquidation are still checked every minute against closed candles. That is also why a wick through your stop does not end you here unless the candle closed there, and why the P&L on the ticket is the server’s number, never one your screen made up.' },
      { h: 'Size the account like it’s rent', p: 'Before you open anything, decide what a bad day looks like. Risking 1–2% of your $10,000 per trade means eight losing trades in a row before you are out - a real trader’s cushion. Risking 20% per trade means three bad trades end the account. The demo does not care which way you pick. Your future self will.' },
      { h: 'Set the exit before the entry', p: 'Every position gets a stop-loss and a take-profit set at the moment you open it - not after, once the candle is already moving against you and your judgment is compromised. If you cannot decide where you are wrong before entering, you are not ready to enter. The plan comes first; the trade is just executing it.' },
      { h: 'Graduate on habits, not luck', p: 'You are ready to size up - even in the demo - when your wins come from following a plan, not from a lucky 500× guess that happened to land once. Close out a week of trades in My Trades and look honestly: did you size correctly, use stops, and walk away from bad setups? That habit is the actual product here.' }
    ],
    quiz: [
      { q: 'What makes MarginPad’s Paper Trade different from a made-up simulator?', o: ['It gives more starting money than real exchanges', 'It uses live prices and real liquidation math', 'It cannot liquidate you', 'It is only for beginners under $1000'], a: 1 },
      { q: 'Why should you risk only 1–2% of the demo balance per trade?', o: ['The platform requires it', 'It matches real risk discipline that carries into live trading', 'Larger position sizes are against the rules', 'It guarantees a profit'], a: 1 },
      { q: 'When should you set your stop-loss and take-profit?', o: ['After the trade starts moving against you', 'Only on trades over 100× leverage', 'At the moment you open the position', 'Never - closing manually is safer'], a: 2 }
    ]
  },
  mm2: {
    t: 'Let the Screener Do the Hunting',
    cards: [
      { h: 'Stop doomscrolling charts', p: 'Flipping through forty coins hoping one looks “about to move” is not analysis, it is procrastination with extra steps. You will always find a chart that looks bullish if you stare long enough - that is confirmation bias, not a setup. The screener exists so you stop hunting by vibe and start hunting by numbers.' },
      { h: '130+ pairs, scored for you', v: 'market', p: 'The screener at /screener scans 130+ USDT pairs and scores each one 0–100 from RSI, MACD, trend strength and volume - the same inputs a disciplined technical trader checks by hand, just done instantly across the whole market instead of the five coins you happened to open. It is one dense table: sort any column, star the pairs you track, and the sheet on each row opens the chart, the terminal, an alert or Rekt for that coin.' },
      { h: 'A score is a lead, not an order', p: 'A pair scoring 85 with a suggested setup is not a signal to fire blindly - it is a candidate worth five more minutes of your attention. Open the chart, check the calendar for news risk, check funding for crowding. The screener narrows a market of thousands down to a handful worth actually looking at.' },
      { h: 'High and low scores both matter', p: 'A pair sitting near 0 is not broken - it is telling you the setup favors the short side, or that it simply is not worth trading right now. Sorting the list both ways turns the screener into two tools: one for finding longs, one for finding shorts, and a third for finding what to leave alone entirely.' },
      { h: 'The setup says what the stop costs', p: 'Every suggested setup prints the stop in percent of margin, not only in price - “lose 44% of margin” is a number you can refuse. A setup with a thin reward-to-risk is greyed, the funding is printed to four decimals so a crowded side is visible, and the Telegram line under the table is for the readers who want the top of the list in their chat once a day.' },
      { h: 'The shortcut, not a shortcut around thinking', p: 'Traders who skip the screener spend their edge searching. Traders who skip the check after the screener spend their edge trusting blindly. The workflow is: screener finds candidates, you verify with a chart and a calendar check, then - and only then - you size a position. Skip either half and you have skipped the point.' }
    ],
    quiz: [
      { q: 'What does the MarginPad screener actually do?', o: ['Places trades automatically for you', 'Scores 130+ pairs from RSI, MACD, trend, and volume to build a shortlist', 'Only tracks the top 10 coins by market cap', 'Predicts exact future prices'], a: 1 },
      { q: 'What should you do with a pair that scores 85?', o: ['Enter the trade immediately at max leverage', 'Ignore it - high scores are traps', 'Investigate it further before deciding anything', 'Short it, since high scores mean overbought'], a: 2 },
      { q: 'What does a very low score on a pair usually suggest?', o: ['The exchange is broken for that coin', 'The setup may favor the short side, or it is not worth trading', 'You should buy it because it is cheap', 'The screener made an error'], a: 1 }
    ]
  },
  mm3: {
    t: 'A Chart Workspace That Works',
    cards: [
      { h: 'Thirty tabs is not analysis', p: 'Fifteen browser tabs, six timeframes, four indicators fighting each other for your attention - that is not a workspace, that is noise wearing a workspace costume. Every extra chart open is one more thing that can talk you into a bad entry. The fix is not more charts. It is fewer, better ones, arranged so you can actually read them.' },
      { h: 'Eight windows, one board', v: 'machart', p: '/charts gives you up to eight chart windows on one board - enough to watch your setups across symbols and timeframes without alt-tabbing through a browser graveyard. Drag, resize, save the layout. Most traders only need two or three windows running at once; the other slots exist for when a real reason shows up, not by default. On a phone the same engine runs edge to edge with a dock at the bottom.' },
      { h: 'Indicators are a second opinion', p: 'Nineteen standard indicators are available, plus six MarginPad measures nobody else has - Liquidation Cascade, Market Brain, Market Memory, Magnet, Big Liquidations and What Moved It. Loading all of them does not make you more right - it makes the chart unreadable and gives you more excuses to talk yourself into a trade you already wanted to take. Pick two or three that answer a real question and let the rest sit unused until you need them.' },
      { h: 'Save the layout, keep it boring', p: 'A saved layout means you open /charts and see the same clean board every time - not a fresh decision about which fifteen indicators to add today. Boring is the goal. The workspace should look the same on your best trading day and your worst one, because the setups you are hunting for do not change just because you are impatient.' },
      { h: 'Let a second reader check your read', p: 'Ask AI, a Premium feature, reads the same candles, levels, funding and liquidation pools you are looking at, draws the setup on the chart and answers in a plan with an entry, a stop and targets - or says there is no trade now. It is not there to hand you a trade; it is there to sanity-check your reasoning against what is on the screen. If it just agrees with you, that is not confirmation, that is you talking to yourself in a nicer font.' },
      { h: 'Its calls are scored, and so are yours', p: 'Every directional plan the assistant gives is recorded with its levels and settled against the real candles afterwards: did the first target print before the stop. The record is public once there are enough settled calls, and under the card you see your own: how many of the plans you asked for won, lost or never filled. A read that keeps no score is a horoscope.' }
    ],
    quiz: [
      { q: 'What is the actual problem with loading nineteen indicators onto one chart?', o: ['The chart will crash', 'It multiplies accuracy', 'It creates noise and excuses to justify a trade you already wanted', 'It is not technically possible'], a: 2 },
      { q: 'Why save a chart layout instead of rebuilding it each time?', o: ['It is required to use /charts', 'It keeps your workspace consistent instead of a fresh cluttered decision every session', 'It automatically finds better trades', 'It disables indicators you do not need'], a: 1 },
      { q: 'What is Ask AI for?', o: ['To place trades automatically', 'To replace your own analysis entirely', 'To sanity-check your read against what is on the chart, with a scored record', 'To predict exact liquidation prices'], a: 2 }
    ]
  },
  mm6: {
    t: 'Alerts Instead of Chart-Babysitting',
    cards: [
      { h: 'Staring at the chart is not a strategy', p: 'You set a level, then you sit there watching the candle approach it for forty-five minutes, and somewhere in minute thirty your patience runs out and you enter three dollars early “just in case.” That is not discipline, that is boredom pretending to be conviction. The chart did not need you watching it. Your plan needed you to wait.' },
      { h: 'One page for every alert', v: 'trend', p: '/alerts/ is where every alert on the site lives and where you choose how it reaches you: a push notification on your phone, a message from the Telegram bot, or an email. A price alert is free - a coin above or below a level. A trend-line alert is free too: draw the line on a chart, tap the bell, and it rings when price crosses a line that moves. Set them at the level from your plan, then close the tab.' },
      { h: 'The alerts only we can send', p: 'Position alerts are Premium, and no chart site can copy them, because we hold your positions: your liquidation closing in, your stop about to trigger, your target nearly there, a resting order about to fill. The same switch brings you a catalyst on a coin you hold - a listing, a hack, a macro print - the minute it lands. Zone alerts ring when a heavy liquidation band is about to be hit; whale alerts follow a wallet you chose.' },
      { h: 'Watching more does not mean reacting better', p: 'Traders who watch a chart for hours convince themselves they are gathering information. Mostly they are gathering anxiety, which produces early entries, early exits, and moved stops. An alert fires exactly once, at exactly the level you chose when you were calm. That is a better decision-maker than you are, forty-five minutes into a staring contest.' },
      { h: 'The watchlist is a shortlist, not a shrine', p: 'Starring pairs in the screener builds a watchlist - but a watchlist that never gets pruned turns into forty coins you “have a feeling about,” which is just the screener problem again with extra steps. Star what you are genuinely tracking with a plan attached, unstar what you were just curious about last month, and pair each star with an alert.' },
      { h: 'Walk away on purpose', p: 'The whole point of alerts plus a watchlist is permission to stop looking. Set the level, set the alert, close the app. If the level hits, you get told. If it doesn’t, you didn’t waste an afternoon finding out. The traders who last are not the ones glued to the screen - they are the ones who built a system that does not need them glued to it.' }
    ],
    quiz: [
      { q: 'What is the actual problem with staring at a chart waiting for your level?', o: ['It uses too much data', 'It tends to produce early entries and moved plans out of impatience', 'The chart updates too slowly to watch live', 'It is technically impossible on mobile'], a: 1 },
      { q: 'What should you set a price alert at?', o: ['Wherever the price currently is', 'The exact entry level from your plan', 'A random round number', 'Whatever level feels exciting'], a: 1 },
      { q: 'Which alert can only MarginPad send you?', o: ['A coin crossing a price', 'Your own liquidation closing in', 'A news headline', 'A funding rate change'], a: 1 },
      { q: 'What keeps a watchlist useful instead of cluttered?', o: ['Starring every coin you have ever heard of', 'Never removing anything, ever', 'Pruning it regularly and pairing entries with an actual plan or alert', 'Only using it for coins already in profit'], a: 2 }
    ]
  },
  mm7: {
    t: 'The XP Loop: Practice That Pays',
    cards: [
      { h: 'Reps, not luck', p: 'One lucky 200× trade teaches you nothing except that luck exists. XP, missions, and leaderboards on MarginPad are built around the opposite: rewarding the boring reps - planning trades properly, finishing lessons, showing up daily - because reps are what actually build a trader. The gamification is not a distraction from the discipline. It is the discipline, with a scoreboard attached.' },
      { h: 'Missions reward the right behaviors', v: 'checklist', p: 'Daily missions pay small amounts of real USDT for things like closing a planned trade with a stop-loss attached, finishing an Academy lesson, or using the tools that make you better - not for volume, not for size, not for luck. Seven a day; clear five and the set bonus pays XP. Check them each day, knock out the ones that match what you were already going to do, and let the rest go.' },
      { h: 'Streaks are just habit with a number on it', p: 'A streak counter is a cheap trick and it works anyway - humans hate breaking a number that is going up. Use that. Show up daily, check the missions, glance at the calendar, review one open trade. The streak is not the goal; it is scaffolding for the actual goal, which is doing the checklist often enough that it stops being a checklist.' },
      { h: 'Leaderboards you can actually respect', p: 'The nine season boards run for 14 days and each tracks one thing - ROE, Green Days, win rate, XP, the daily BTC call, Meme Spot profit, the Gold Room, Bybit volume, Moon wagers - so a reckless 1000× gambler topping the ROE board this season is not automatically “better” than a trader with a boring 65% win rate. Watch the Green Days, win-rate and XP boards if you want a signal that reflects skill instead of one lucky swing. Real USDT prizes go out every season.' },
      { h: 'Duels: discipline with a scoreboard', p: 'A duel pits you against one other trader on a chosen metric - ROE, win rate, whatever you pick - for an hour, a day, three days or a week, with Ticks staked on it. Only trades opened after the duel starts count. It is the same practice you would be doing anyway, just with a rival attached, which turns out to be a surprisingly effective way to actually stick to a plan. Challenge someone whose stats you respect, not just the person on top of the board.' },
      { h: 'Squads: five people, one room', p: 'A squad is up to five members with a private chat room, a logo, levels of its own and raids - 48 hours to fill a pool with the squad’s realized profit on one major, with losses draining it. A quarter of every member’s XP feeds the squad’s level. It is the social half of the loop: the person most likely to keep you from a revenge trade is the one in the room watching.' }
    ],
    quiz: [
      { q: 'What kind of behavior do daily missions typically reward?', o: ['Only opening the highest-leverage trade possible', 'Planning trades properly, finishing lessons, and consistent engagement', 'Trading volume regardless of outcome', 'Winning every single trade'], a: 1 },
      { q: 'Why watch the win-rate or XP leaderboard instead of just the ROE board?', o: ['ROE boards are fake', 'A top ROE season can come from one reckless lucky trade, not necessarily skill', 'Win-rate boards pay bigger prizes', 'XP is the only board that is real-money'], a: 1 },
      { q: 'What is a duel?', o: ['A private trade where the loser’s paper balance is transferred to the winner', 'A head-to-head against another trader on a chosen metric, for an hour to a week, with Ticks staked', 'A tournament that resets your paper balance if you lose', 'A feature only available to top-100 leaderboard traders'], a: 1 }
    ]
  }
};

const MM8 = {
  id: 'mm8',
  t: 'What Moved the Price',
  try: { p: 'Open the Catalysts page: the newest listings, hacks, macro prints and headlines, scored, with the move each one caused. Then switch the What Moved It indicator on in /charts and read a day of flags on a coin you trade.', label: 'Open Catalysts →', href: '/catalysts/' },
  cards: [
    { h: 'A candle has a reason, or it does not', v: 'eventspike', p: 'Most candles are noise: the market breathing, a correction after a push, somebody closing a position. Some are not - a listing, a hack, a CPI print, a delisting, a whale forced out - and the difference is the whole trade. MarginPad reads 37 sources as they publish, scores every item, and measures the move that followed on every coin it names. That is the Catalysts page.' },
    { h: 'The flag on the chart', p: 'Switch on What Moved It and a flag appears on the candle where a move started, with the cause and the size: “Binance hack, −7.0%”. A move can have more than one cause and the card says the shares - the news, the liquidation cascade it set off, Bitcoin dragging everything with it. A flag is drawn only when the engine is sure; a candle it cannot explain stays bare rather than wearing a guess.' },
    { h: 'A story is one move, measured whole', p: 'A hack is not five separate dips. While the story is live the flag reads LIVE and the zone keeps extending to the extreme; when the market has given the move back, it closes and prints the final figure. Seven desks reporting the same hack are one story, not seven causes. And the direction has to agree: a bounce after a hack is the market recovering, never the hack.' },
    { h: 'What counts, and what does not', p: 'A $3M hack of a side project moves nothing and is never a cause; the ones that move price are the hundred-million kind. A headline pointing the other way from the move is refused. A listing on a small venue is noise; a Binance or Upbit spot listing has moved price ten times the usual bar, measured over every one we have seen. The page prints how often a source speaks and how far price went the last times it did.' },
    { h: 'How to trade with it', p: 'Before an entry, check the flags on the coin: if the last three moves were cascades and not news, the coin is being pushed by leverage, not by information - size down. If a story is LIVE, the move is not over; a stop inside it is a donation. Premium members holding the coin get the catalyst as an alert the minute it lands, so the news finds you rather than the other way round. The rule is the same as the calendar’s: never be surprised by something that was announced.' }
  ],
  quiz: [
    { q: 'When does What Moved It draw a flag on a candle?', o: ['On every candle', 'Only when the engine is sure of the cause', 'Only on red candles', 'Only for Bitcoin'], a: 1 },
    { q: 'A coin bounces +1% an hour after a hack headline. What is the cause?', o: ['The hack', 'Not the hack - a cause has to point the same way as the move', 'The exchange', 'Funding'], a: 1 },
    { q: 'What does a LIVE flag mean?', o: ['The news is fake', 'The story is still running and the move is not over yet', 'The coin is delisted', 'The alert has been sent'], a: 1 }
  ]
};

// ---- apply
let changed = 0;
for (const id in L) {
  const cur = byId[id]; if (!cur) { console.error('no lesson ' + id); process.exit(1); }
  const n = L[id];
  cur.t = n.t; cur.cards = n.cards; cur.quiz = n.quiz; if (n.try) cur.try = n.try;
  changed++;
}
const mastery = data.courses.find(c => c.id === 'mastery');
mastery.lessons.push(MM8);
// try hrefs that pointed at anchors the bento homepage does not have
let fixedHref = 0;
data.courses.forEach(c => c.lessons.forEach(l => { if (l.try && l.try.href === '/#size') { l.try.href = '/calculators?c=size'; fixedHref++; } if (l.try && l.try.href === '/#liq') { l.try.href = '/calculators?c=liq'; fixedHref++; } }));
// sanity: every viz named exists, every quiz answer inside its options
data.courses.forEach(c => c.lessons.forEach(l => {
  l.cards.forEach(cd => { if (cd.v && html.indexOf('VIZ.' + cd.v + '=function') < 0) { console.error(l.id + ': unknown viz ' + cd.v); process.exit(1); } });
  (l.quiz || []).forEach((q, i) => { if (!(q.a >= 0 && q.a < q.o.length)) { console.error(l.id + ' q' + i + ' bad answer'); process.exit(1); } });
}));
const lessons = data.courses.reduce((n, c) => n + c.lessons.length, 0), nC = data.courses.length;
html = html.slice(0, DM.index) + '<script type="application/json" id="acadData">' + JSON.stringify(data) + '</script>' + html.slice(DM.index + DM[0].length);
const swaps = [
  [/<span>\d+ lessons<\/span><i><\/i><span>\d+ courses<\/span>/, '<span>' + lessons + ' lessons</span><i></i><span>' + nC + ' courses</span>'],
  [/\d+ bite-size lessons across \d+ courses/g, lessons + ' bite-size lessons across ' + nC + ' courses'],
  [/\d+ bite-size interactive lessons/g, lessons + ' bite-size interactive lessons'],
  [/all \d+ lessons, quizzes/g, 'all ' + lessons + ' lessons, quizzes'],
  [/: \d+ lessons across crypto basics/g, ': ' + lessons + ' lessons across crypto basics'],
  [/(id="pgN">)0\/\d+(<)/, '$1' + '0/' + lessons + '$2']
];
swaps.forEach(([re, to]) => { html = html.replace(re, (m, a, b) => to.replace('$1', a || '').replace('$2', b || '')); });
['<meta name="description"', '<meta property="og:description"', '"@type":"Course"', 'id="pgN"', 'class="hero-stats"'].forEach(sel => {
  const i = html.indexOf(sel); if (i < 0) return;
  const seg = html.slice(i, i + 600);
  const m = seg.match(/\b(\d{2,4}) (?:bite-size |)lessons|\b0\/(\d{2,4})\b/);
  if (m) { const got = +(m[1] || m[2]); if (got !== lessons) { console.error('count not updated at ' + sel + ' - reads ' + got + ', should be ' + lessons); process.exit(1); } }
});
if (DRY) { console.log('--dry: ' + changed + ' lessons rewritten, mm8 added, ' + fixedHref + ' hrefs fixed; ' + before + ' -> ' + lessons + ' lessons'); process.exit(0); }
fs.writeFileSync(PAGE + '.tmp', html); fs.renameSync(PAGE + '.tmp', PAGE);
console.log('fix-academy-2026-10-30: ok - ' + changed + ' lessons rewritten, mm8 added, ' + fixedHref + ' try hrefs fixed; ' + before + ' -> ' + lessons + ' lessons / ' + nC + ' courses');
console.log('  next: ACAD_COURSES mastery += mm8 in src/worker.js, node build/gen-academy-syllabus.js, the es/pt/de packs, node build/gen-academy-i18n.js');
