/* Academy course 0 - "Start Here: MarginPad" (2026-09-20, owner: "nulti level sa osnovama o marginpad-u").

   WHY IT EXISTS, measured 2026-09-20 over 497 mature accounts:
     - 78% never reach Bronze; 266 of the 386 below it sit between 50 and 150 XP, median 94.
     - 57% of a stuck account's whole XP comes from ONE event - setting a username (+50).
     - The Academy is the only route that works (30% of a Bronze-crosser's XP) and the threshold
       is FOUR lessons, not one: 1 lesson = 3% cross Bronze, 4-9 lessons = 61%.
     - The first course they met was "Crypto Basics", which is about crypto, not about MarginPad -
       while the most common first landing page is /rewards/, i.e. they arrived for the money.
   So course 0 is a tour of the SITE, it answers the money question in lessons 2 and 3 rather than
   at the end, and it is sized so that finishing it leaves exactly one trade between them and Bronze.

   THE XP ARITHMETIC (every value verified in worker.js on 2026-09-20):
     username 50 (once) + checkin 20 + streak 2                        =  72
     7 lessons x 25                                                    = 175
     course-complete bonus 50                                          =  50
     Bronze task 'lesson' 50 + 'lesson4' 70                            = 120
                                                                        ----
                                                                          417   (+25 if every run is perfect)
     then: first paper trade (task 40 + trade 3) = 43  ->  460
           set a stop-loss or take-profit (task 40)    ->  500  = BRONZE
     or:   come back tomorrow (task 75 + checkin 20 + streak 4) = 99 -> 516
   Seven lessons is the size that makes both of those land. Six does not (it needs BOTH the trade
   and the stop to the exact XP, with no margin); eight overshoots and Bronze arrives before the
   trade, which is the one thing the owner asked it not to do.

   free:true is LOAD-BEARING, not a convenience. The course sits first, and a non-free course at
   index 0 would set prevDone=false for every existing member, locking the course AFTER the one they
   are currently in (render: lockedC = !prevDone && !c.free && cd===0). free:true keeps it out of the
   lock chain entirely, so nobody's progress moves.
*/
module.exports = {
  id: 'mpstart',
  name: 'Start Here: MarginPad',
  sub: 'The site itself, in seven short lessons',
  color: '#c2f64a',
  icon: 'flag',
  free: true,
  lessons: [
    {
      id: 'mp1',
      t: 'What MarginPad actually is',
      cards: [
        { h: 'Real prices, practice money', v: 'mpreal', p: 'The chart in front of you is the live market. The prices and candles come straight from the exchanges, the same ones a funded trader is looking at right now. The money is not real: you start with $10,000 that we handed you, and there is no way to deposit a cent anywhere on this site.' },
        { h: 'Why anyone would practice first', p: 'Leveraged futures is the fastest way to lose money in crypto, and almost everybody loses their first account. Here the market can take a position off you and teach you the same lesson, and the whole cost is the time you spent. Lose the $10,000 and nothing has happened.' },
        { h: 'Some of it is real, though', p: 'The trading is practice. The rewards are not. MarginPad pays real USDT for using the site - small amounts, from a daily pool - and you cash it out to an exchange account. That is a separate system from the trading, and two lessons from now you will know exactly how it works.' }
      ],
      quiz: [
        { q: 'The prices you trade against on MarginPad are:', o: ['Invented by the site', 'Live prices from real exchanges', 'Yesterday\'s closing prices', 'Only updated when you reload the page'], a: 1 },
        { q: 'How much do you have to deposit before you can trade here?', o: ['Nothing - there is no deposit anywhere on the site', '$10 to unlock the terminal', 'Whatever you want to trade with', 'A refundable $50'], a: 0 },
        { q: 'You open a trade and it goes badly. What did it cost you?', o: ['Real money from your card', 'Part of the practice balance, and nothing else', 'A fee charged to your account', 'Your position on the leaderboards, permanently'], a: 1 }
      ]
    },
    {
      id: 'mp2',
      t: 'XP, your level, and Bronze',
      cards: [
        { h: 'XP is just what you did, counted', v: 'mpxp', p: 'Every lesson you finish is 25 XP, every day you show up is 20, a trade is 3 and a winning one 15. Nothing is bought and nothing is random - XP is a record of having used the site. The number sits next to your name in your account menu and at the top of your season page.' },
        { h: 'Bronze is 500 XP, and it is the only gate', p: 'Below 500 XP you are Unranked, and the whole rewards side of MarginPad is closed: the faucet, the daily missions, referrals and withdrawals. At Bronze all four open at once and stay open. Nothing about it costs money, and it is the single thing standing between a new account and everything this site pays.' },
        { h: 'This course is most of the way there', p: 'You are reading lesson two of seven. Finishing all seven, with the two Road to Bronze bonuses they trigger, puts you a little over 400 XP - so after this, one paper trade with a stop-loss on it, or simply coming back tomorrow, is Bronze.' }
      ],
      quiz: [
        { q: 'What is Bronze?', o: ['A paid membership tier', 'The level you reach at 500 XP', 'The first leaderboard prize', 'A cosmetic frame for your profile card'], a: 1 },
        { q: 'What does reaching Bronze open?', o: ['Lower trading fees', 'The faucet, the daily missions, referrals and withdrawals', 'A bigger practice balance', 'The charts and the heatmap'], a: 1 },
        { q: 'What is the fastest free way to earn XP?', o: ['Opening as many trades as possible', 'Academy lessons - 25 each, plus 50 for a finished course', 'Leaving the site open in a tab', 'Inviting friends'], a: 1 }
      ]
    },
    {
      id: 'mp3',
      t: 'The real money on this site',
      cards: [
        { h: 'Where it comes from', v: 'mpmoney', p: 'MarginPad is free and carries no advertising. It earns when a reader opens an account at an exchange through one of our links, and the exchange shares part of its fee. That is the whole business, and it is why the rewards are small, real and capped rather than large and imaginary.' },
        { h: 'What is on the table', p: 'A $0.50 welcome bonus. $0.02 from the faucet every few minutes, up to $0.20 a day. Daily missions on top. $1.00 each for opening a Moon or a Fomo account through us. $0.50 when a friend you invited really trades. Everything except the welcome and the sign-up bonuses waits for Bronze.' },
        { h: 'Getting it out', p: 'The balance is paid in USDT and you can cash out from $5.00 to a Bybit or a Moon account. Every withdrawal is checked and paid by hand, so it is not instant. This is a thank-you for using the site, not an income - treat it as what it is and it will never disappoint you.' }
      ],
      quiz: [
        { q: 'How does MarginPad make money?', o: ['Selling your data', 'Exchange affiliate links - a share of the fee when someone signs up through us', 'Charging for the Academy', 'Taking a cut of paper-trading profits'], a: 1 },
        { q: 'What is the smallest amount you can withdraw?', o: ['$1.00', '$5.00', '$20.00', 'There is no minimum'], a: 1 },
        { q: 'Which of these does NOT wait for Bronze?', o: ['The faucet', 'Daily missions', 'The $0.50 welcome bonus', 'Referrals'], a: 2 }
      ],
      try: { p: 'Everything named above lives on one page. Open it and see where your balance, the faucet and the sign-up bonuses are - it will make more sense once you have seen the layout.', label: 'Open Rewards', href: '/rewards/' }
    },
    {
      id: 'mp4',
      t: 'Long, short, and what leverage really does',
      cards: [
        { h: 'Two directions, not one', v: 'wdlong', p: 'A long wins when price goes up. A short wins when price goes down. That is the entire difference, and it is why a futures trader is never forced to sit out a falling market. On MarginPad both are one tap: the Long and Short buttons on the trade ticket.' },
        { h: 'Leverage is size, not magic', v: 'mplev', p: 'Put $100 down at 10x and you are moving a $1,000 position. Every 1% the market travels is now 10% of your money, in whichever direction it travels. Leverage does not improve a trade - it multiplies whatever the trade was going to do to you anyway.' },
        { h: 'Why we let you go to 1000x', p: 'The majors here go all the way to 1000x, far past anything a sane person would use. That is deliberate. At 1000x roughly one tenth of one percent against you ends the position - and you should find that out on a practice account, tonight, rather than on an exchange with your own money.' }
      ],
      quiz: [
        { q: 'You commit $100 at 10x leverage. How big is the position?', o: ['$100', '$110', '$1,000', '$10,000'], a: 2 },
        { q: 'A short position makes money when:', o: ['Price rises', 'Price falls', 'Price stays flat', 'Volume rises'], a: 1 },
        { q: 'What does raising the leverage actually change?', o: ['The odds of being right', 'The size of the position, so every move counts for more', 'The fee you pay', 'How long you may hold the trade'], a: 1 }
      ]
    },
    {
      id: 'mp5',
      t: 'Margin, and where a position dies',
      cards: [
        { h: 'Margin is what you put down', p: 'The margin is the slice of your balance you commit to one trade. It is also the most that trade can ever take: a loss is floored at your margin, so a position opened with $100 can cost you that $100 and never a cent more. Your other $9,900 is not reachable by it.' },
        { h: 'Liquidation is the floor being hit', v: 'mpliq', p: 'If price moves far enough against you, the position closes itself and the margin is gone. That price is the liquidation, and MarginPad draws it on your chart from the moment you open - so the level at which the trade ends is visible the whole time you are in it, not a surprise at the end.' },
        { h: 'It is decided on our server, not in your browser', p: 'Your position is held on the server. Close the tab, lose signal, switch to another phone - nothing changes. The stop-loss, the take-profit and the liquidation are all checked from our side against closed candles, which is also why a wick through your level does not end you here unless the candle actually closed there.' }
      ],
      quiz: [
        { q: 'What is the most one position can lose you?', o: ['Your whole balance', 'The margin you committed to it', 'Twice the margin', 'It depends on the leverage'], a: 1 },
        { q: 'You open a trade, then close the browser. What happens to it?', o: ['It is cancelled', 'It stays open and is checked on the server', 'It freezes until you come back', 'It closes at the current price'], a: 1 },
        { q: 'A liquidation is:', o: ['A fee for holding too long', 'The position being closed automatically because price reached the level where the margin is used up', 'A manual close by the site', 'The same thing as a stop-loss'], a: 1 }
      ]
    },
    {
      id: 'mp6',
      t: 'Your two exits: stop-loss and take-profit',
      cards: [
        { h: 'Decide the exit before you need it', v: 'mpexits', p: 'A stop-loss closes the trade at a price you choose if it goes wrong. A take-profit does the same if it goes right. Both are set once and then honoured without you, which is the point: the moment a position is losing is the worst possible moment to be deciding what to do about it.' },
        { h: 'Where you set them here', p: 'On the ticket, before you open - or afterwards, from the Set button on the trade card and from My Trades. You can move them as many times as you like while the trade is open. A trade with neither is a trade whose exit will be chosen by whatever you happen to be feeling at the time.' },
        { h: 'This is the habit worth building', p: 'Nothing else in this course will change your results as much. On the boards that pay real USDT, the accounts that last are not the ones who pick better entries - they are the ones who had already decided where they would be wrong. Setting one is also a Road to Bronze task, worth 40 XP.' }
      ],
      quiz: [
        { q: 'What does a stop-loss do?', o: ['Stops you opening more trades', 'Closes the trade at a price you chose, if it goes against you', 'Pauses the position', 'Guarantees you cannot lose'], a: 1 },
        { q: 'When can you set or move a stop-loss on MarginPad?', o: ['Only when opening the trade', 'Only after it is in profit', 'Before opening, and at any time while the trade is open', 'Once per day'], a: 2 },
        { q: 'Why set the exit in advance?', o: ['It lowers the fee', 'It raises the leverage limit', 'Because the moment a trade is losing is the worst moment to be deciding what to do', 'It is required before you can open a position'], a: 2 }
      ]
    },
    {
      id: 'mp7',
      t: 'Seasons, boards and the pass',
      cards: [
        { h: 'The site runs in fourteen-day seasons', v: 'mpseason', p: 'Everything competitive resets on a fourteen-day clock. Your season XP, your standing on the boards and the pass all start again, so a bad fortnight is never permanent and a newcomer is never a year behind. The day of the season is printed at the top of the season page.' },
        { h: 'Seven boards, and four of them cost nothing', p: 'Seven leaderboards pay their top five at the end of a season. Four - Highest ROE, Green Days, Best Win Rate and Season XP - need only Bronze and paper trades. The Gold Room needs Gold, which is 12,000 XP. Two are for readers who trade real money at Bybit or Moon. The current pools are listed on the competition page.' },
        { h: 'And the pass runs underneath all of it', p: 'Every 100 season XP is a pass tier, forty of them, and the free track pays out in Ticks and cosmetics as you climb. You are already earning it - the XP from this course counted toward it while you were reading.' }
      ],
      quiz: [
        { q: 'How long is a MarginPad season?', o: ['Seven days', 'Fourteen days', 'One month', 'Until someone wins'], a: 1 },
        { q: 'What do the four free boards require?', o: ['A deposit at an exchange', 'Premium', 'Bronze, and paper trades', 'An invitation'], a: 2 },
        { q: 'What advances a pass tier?', o: ['Buying it', 'Every 100 season XP', 'Winning a board', 'Logging in for seven days straight'], a: 1 }
      ],
      try: { p: 'That is the whole tour. The one thing left is the thing the site is for: open the terminal, pick a coin, put a small position on with a stop-loss, and watch what happens. That single trade is the last step to Bronze.', label: 'Open Paper Trade', href: '/paper-trade' }
    }
  ]
};
