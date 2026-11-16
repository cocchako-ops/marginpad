/* Academy course "Passing a Prop Firm Challenge" (2026-11-16, owner: funded-account practice round). Six lessons, five cards and three
   quiz questions each, the same shape as every other course. Every worked number is the arithmetic of MarginPad's own challenge rules
   (CHAL_TYPES in the worker), so a reader who opens /prop-firm-challenge/ sees the same figures the lesson used.
   Inserted into dist/academy/index.html by build/add-academy-propfirm.js. */
module.exports = {
  id: 'propfirm', name: 'Passing a Prop Firm Challenge', sub: 'The rules that end most evaluations, and how to trade inside them', color: '#ffb020', icon: 'shield', free: true,
  lessons: [
    { id: 'pf1', t: 'What a Prop Firm Challenge Really Is',
      try: { p: 'Start a free challenge on MarginPad: pick a rule set and an account size, then trade it in the paper terminal. The server ends the run the moment you break a rule, as a firm would.', label: 'Start a free challenge →', href: '/prop-firm-challenge/' },
      cards: [
        { h: 'You are buying a test, not an account', p: 'A prop firm sells you an evaluation: a simulated account of, say, $10,000 and a short list of rules. Hit the profit target without breaking a rule and the firm offers you a funded account and a share of the profit, usually 80%. Break a rule once and the fee is gone. Almost nobody is trading the firm\'s money during the test - it is a demo account with a referee.' },
        { h: 'The target is the easy half', p: 'A 10% target sounds like the hard part. It is not: a trader who is right half the time with a 2:1 reward-to-risk gets there in a few weeks. What fails most challenges is the other half of the page - the daily loss limit and the maximum drawdown. Those rules do not care how good your idea was. They only care how far your balance fell.' },
        { h: 'Three rules decide almost everything', p: 'Every crypto evaluation is built from the same three: a daily loss limit (usually 3-5% of the account), a maximum drawdown (5-10%, static or trailing), and a minimum number of trading days. Most firms add a leverage cap and sometimes a consistency rule. Read those numbers before the price - two challenges at the same price can be very different tests.' },
        { h: 'A pass is a statement about risk', p: 'The firm is not checking whether you can make 10%. It is checking whether you can make 10% without ever being down 5% in a day. That is a test of position size and patience, which is exactly what most traders lack - and exactly why the fee is mostly profit for the firm.' },
        { h: 'Practise the test for free first', p: 'You can run the same rules on MarginPad without paying anybody: one-step, two-step and end-of-day trailing rule sets on a $5,000-$100,000 paper account, scored by the server on live prices. If you cannot pass it here twice in a row, a paid attempt is a donation.' } ],
      quiz: [
        { q: 'What do you actually get when you pay for a prop firm challenge?', o: ['A real trading account funded by the firm from day one', 'A simulated account with rules; passing earns the offer of a funded account', 'A loan you must repay if you lose', 'Copies of a professional trader\'s positions'], a: 1 },
        { q: 'Which rules fail most challenges?', o: ['The profit target', 'The daily loss limit and the maximum drawdown', 'The list of allowed coins', 'The trading hours'], a: 1 },
        { q: 'What is the firm really testing?', o: ['Whether you can pick the right coin', 'Whether you can make the target without breaking the loss limits', 'How many trades you can open', 'Whether you trade every day'], a: 1 } ] },

    { id: 'pf2', t: 'The Daily Loss Limit',
      try: { p: 'Open the drawdown calculator, enter your account size and the firm\'s daily limit, and read your floor for today and how much room you have before it.', label: 'Open the drawdown calculator →', href: '/prop-firm-drawdown-calculator/' },
      cards: [
        { h: 'A floor that is set every morning', p: 'The daily loss limit is a floor drawn at the start of every trading day, usually from your balance at 00:00 UTC. With a $10,000 account and a 4% limit, the floor sits $400 below that balance. If your account ever touches it during the day, the challenge is over - even if you would have finished the day in profit.' },
        { h: 'Open losses count', p: 'Most firms measure the daily floor against EQUITY: your closed balance plus the profit or loss of positions that are still open. Say the day opens at $10,300, so the floor is $9,900. You close one trade at -$200, leaving $10,100. A second trade is open and down $250. Equity is $9,850 - below the floor. The run ends, and you never closed that second trade.' },
        { h: 'It does not care how far ahead you are', p: 'Being up $800 on the account does not buy you more room today. The floor resets from today\'s opening balance, so a trader who is far ahead still has exactly $400 to lose before midnight. That is why a strong run so often ends on one bad afternoon: the profit made the trader bigger and careless, and the daily limit did not grow with it.' },
        { h: 'Plan the worst day, not the average one', p: 'Before the session, count how many full stops you can take today. With $400 of room and $100 risked per trade, that is four. If you size so that two full stops in a row would cost $350, one more mistake ends the challenge. Most traders who fail on the daily limit fail on trade three or four of a bad day, not on the first one.' },
        { h: 'Where the clock sits matters', p: 'Firms reset the daily limit at different times - 00:00 UTC, 00:05 UTC, midnight in Central Europe, UTC+8. A position open across the reset can count against yesterday at one firm and today at another. Read the firm\'s exact rule, and know what time it is in that time zone when you hold a trade overnight.' } ],
      quiz: [
        { q: 'A $10,000 account has a 4% daily loss limit. The day opens with a balance of $10,300. Where is today\'s floor?', o: ['$9,600', '$9,900', '$10,000', '$10,300'], a: 1 },
        { q: 'Today\'s floor is $9,900. Your closed balance is $10,100 and an open position is down $250. What happens?', o: ['Nothing - only closed trades count', 'Equity is $9,850, below the floor, so the challenge fails', 'You get a warning and one more trade', 'The floor moves down to $9,850'], a: 1 },
        { q: 'You are up $800 since the challenge began. How much room does a 4% daily limit on a $10,000 account give you today?', o: ['$1,200', '$800', '$400', 'Unlimited, because you are in profit'], a: 2 } ] },

    { id: 'pf3', t: 'Static, Trailing and End-of-Day Drawdown',
      cards: [
        { h: 'The second floor', p: 'The maximum drawdown is a floor for the whole challenge, not for one day. It comes in three shapes, and the same percentage means very different things in each. Find out which one the firm uses before you compare challenges by their numbers.' },
        { h: 'Static: it never moves', p: 'A static 10% drawdown on a $10,000 account puts the floor at $9,000 and leaves it there. Make $700 and you have $1,700 of room. This is the most forgiving shape: profit you make is a cushion you keep.' },
        { h: 'Trailing: it follows you up', p: 'A trailing drawdown rises with your highest closed balance. With a 6% trailing limit on $10,000, the floor starts at $9,400. Close trades up to $10,800 and the floor rises to $10,200. You are $800 ahead, but you now have only $600 of room - the profit you made raised the floor, and it never comes back down.' },
        { h: 'End-of-day trailing: it follows your closes', p: 'An end-of-day trailing floor rises only with your balance at the close of each day. A profit you take and give back inside the same day does not lift it; a profit you are still holding at the day\'s end does. It sits between static and trailing in difficulty, and it rewards closing the day flat or on a good number.' },
        { h: 'What it means for the plan', p: 'On a trailing floor, the riskiest moment is right after a winning streak: room is smallest exactly when confidence is highest. Cut size after a new high, not after a loss. On a static floor you can let early profit carry a little more risk later. Same 6%, opposite advice.' } ],
      quiz: [
        { q: 'A $10,000 account has a static 10% maximum drawdown. Where is the floor after you make $700?', o: ['$9,700', '$9,000', '$10,000', '$9,630'], a: 1 },
        { q: 'A 6% trailing drawdown on $10,000. Your highest closed balance is $10,800. Where is the floor?', o: ['$9,400', '$10,152', '$10,200', '$10,800'], a: 2 },
        { q: 'On a trailing drawdown, when is your room usually smallest?', o: ['On the first day', 'Right after a new high in your balance', 'Right after a loss', 'It is always the same'], a: 1 } ] },

    { id: 'pf4', t: 'Size for the Rules, Not for the Target',
      try: { p: 'In the paper terminal, open the Advanced panel, set a stop, and read the dollar risk beside it before you open. Size until that number fits your daily room four times.', label: 'Open Paper Trade →', href: '/paper-trade' },
      cards: [
        { h: 'Start from the room, not the dream', p: 'The question is not "how do I make $1,000?" but "how much may this trade cost me?". Take your daily room - $400 on a $10,000 account at 4% - and divide it into the number of full stops you want to survive. Four stops means $100 a trade. That single number decides everything else.' },
        { h: 'Position size is risk divided by the stop', p: 'If you risk $100 and your stop is 2% below entry, the position is $100 / 2% = $5,000 of exposure. At 10x leverage that is $500 of margin. Move the stop to 4% and the same $100 of risk buys a $2,500 position. Leverage changes how much margin you lock up, not how much you lose at the stop.' },
        { h: 'Leverage is a trap with a number on it', p: 'A challenge that allows 100x is not asking you to use it. At 100x a 1% move against you is your whole margin, and a single wick can cost more than a day\'s room. Most firms cap funded accounts far lower than the test allows. Train at the leverage you will be given once funded.' },
        { h: 'Fees count against the floor', p: 'Every open and close costs a fee on the full position, and funding is charged every eight hours on open perpetuals. On a $5,000 position at 0.055% a side, a round trip is about $5.50. Ten scalps a day is $55 - a seventh of a $400 daily room gone before price has moved.' },
        { h: 'The slow way is the fast way', p: 'At $100 risk and a 2:1 reward, a win is $200. A 10% target on $10,000 is five net wins. A trader who wins half of their trades makes $50 a trade on average and gets there in about twenty trades without ever being near a floor. A trader who tries to do it in two trades is gambling on the one variable the rules punish.' } ],
      quiz: [
        { q: 'You risk $100 a trade with a stop 2% below entry. What position size is that?', o: ['$200', '$2,000', '$5,000', '$10,000'], a: 2 },
        { q: 'Changing leverage from 10x to 20x, with the same position size and stop, changes what?', o: ['The dollars you lose at the stop', 'Only the margin you lock up', 'The fee rate', 'The daily loss limit'], a: 1 },
        { q: 'With $400 of daily room, risking $100 a trade lets you survive how many full stops today?', o: ['One', 'Two', 'Four', 'Ten'], a: 2 } ] },

    { id: 'pf5', t: 'Minimum Days and Consistency Rules',
      cards: [
        { h: 'Hitting the target is not passing', p: 'Many challenges require a minimum number of trading days - commonly 3 to 5 - where a trading day is a day you opened or closed a trade. Reach 10% on day two and you still have to keep trading for three more days without breaking a rule. That is where many lucky passes die.' },
        { h: 'After the target, protect it', p: 'Once you are at the target with days still to go, your only job is to stay above both floors. Trade small, one position at a time, just enough to log the day. A trader who keeps pressing after the target is risking a pass to make money that does not count yet.' },
        { h: 'The best-day rule', p: 'Some firms add a consistency rule: no single day may be more than a set share of your total profit - HyroTrader uses 40% of the target, Mubite 20-40% depending on the plan. Make $800 of a $1,000 target in one day and you have to keep trading until that day is under the cap. One big day is exactly what the rule exists to filter out.' },
        { h: 'Why firms add these rules', p: 'Minimum days and consistency rules weed out one lucky trade at high leverage. A firm wants a trader whose results repeat. If your plan only works when one trade carries the whole target, the rules are telling you something true about the plan.' },
        { h: 'Two-step challenges', p: 'A two-step evaluation splits the target: for example 8% in phase one, then 5% in phase two from a fresh balance, each with its own minimum days. The drawdown is usually looser to compensate. It takes longer, but the per-phase targets are easier to reach without oversizing.' } ],
      quiz: [
        { q: 'You reach the 10% target on day two of a challenge with a 5-day minimum. What should you do?', o: ['Stop trading completely and wait', 'Keep trading small, one trade a day, to log the days without breaking a rule', 'Increase size to bank more profit', 'Open a second challenge'], a: 1 },
        { q: 'What does a best-day consistency rule limit?', o: ['How many trades you open in a day', 'How much of your total profit can come from a single day', 'The leverage on one trade', 'The coins you may trade'], a: 1 },
        { q: 'What usually counts as a trading day?', o: ['Any calendar day of the challenge', 'A day on which you opened or closed a trade', 'A day you logged in', 'Only weekdays'], a: 1 } ] },

    { id: 'pf6', t: 'Choosing a Firm and Practising First',
      try: { p: 'Compare the crypto prop firms side by side - target, daily loss, drawdown type, minimum days, leverage and entry price, read from each firm\'s own site.', label: 'Compare crypto prop firms →', href: '/crypto-prop-firms/' },
      cards: [
        { h: 'Compare the rules, then the price', p: 'Line up the challenges you are considering on four numbers: daily loss limit, maximum drawdown and its type, minimum days, and the leverage you will have once funded. A $25 challenge with a 3% static drawdown is a much harder test than a $59 one with 10% static. The cheapest test is often the one you pay for twice.' },
        { h: 'Read how the daily limit is measured', p: 'Equity or balance? At which hour, in which time zone? Do open positions count? Two firms quoting the same 5% can end your run at very different moments. If a firm\'s own pages contradict each other, ask them in writing before you pay.' },
        { h: 'Check where you would trade', p: 'Some crypto firms put you on a Bybit or BloFin demo account, others on their own platform, and FX-first firms offer crypto only as CFDs at low leverage. Practise on the kind of market you will trade: perpetual futures with funding and liquidation behave differently from a CFD.' },
        { h: 'Practise until a pass is boring', p: 'Run the free MarginPad challenge with the same rule shape as the firm you are aiming at. Pass it, then pass it again with a different market week. Keep a record of which rule came closest to ending each run - that rule is your real weakness, not the target.' },
        { h: 'Only then pay', p: 'Treat the first paid evaluation as a performance, not an experiment. Same size, same coins, same rules you already passed for free. If you notice yourself trading differently because the money is real, that is the lesson to fix before the next attempt - not the market.' } ],
      quiz: [
        { q: 'Two challenges cost the same. Which detail matters most when comparing them?', o: ['The colour of the dashboard', 'The daily loss limit, the drawdown type and size, and the minimum days', 'How many coins are listed', 'The name of the firm'], a: 1 },
        { q: 'Why does it matter whether the daily limit is measured on equity or balance?', o: ['It does not matter', 'Equity counts open losses, so a position can end the run before it is closed', 'Balance is always lower', 'Equity only counts on weekends'], a: 1 },
        { q: 'When is it sensible to pay for a real evaluation?', o: ['After reading one guide', 'After passing the same rules repeatedly in practice', 'When the price is discounted', 'After one lucky day'], a: 1 } ] },
  ],
};
