/* Academy lesson ex10 for Demo Spot v3 (2026-10-16): the lesson described the retired card / exchange / wallet journey.
   Rewrites the EN lesson inside #acadData in dist/academy/index.html. FOUR cards on purpose (it had five): the 13 language
   packs still carry the old five-card translation, and the page drops a pack lesson whose card count differs from EN and
   renders the English one instead - which is exactly what should happen until the translation round. Idempotent. */
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, '..', 'dist', 'academy', 'index.html');
let h = fs.readFileSync(F, 'utf8');
const re = /(<script[^>]*id="acadData"[^>]*>)([\s\S]*?)(<\/script>)/;
const m = h.match(re); if (!m) { console.error('no #acadData'); process.exit(1); }
const data = JSON.parse(m[2]);
let hit = 0;
const walk = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(walk); return; } if (o.id === 'ex10' && Array.isArray(o.cards)) { hit++; Object.assign(o, LESSON); return; } Object.values(o).forEach(walk); };
const LESSON = {
  id: 'ex10',
  t: 'Demo Spot: $10,000, buy and hold, one board',
  cards: [
    { h: 'Spot is owning the coin', p: 'A spot buy means you own the coin itself, at the price it trades for right now. No leverage, no liquidation price, no funding: it can go to zero and that is the worst case. Demo Spot gives you $10,000 of demo cash to do exactly that with meme coins on four chains and the top 250 majors, at live prices, with no fees. Press Claim once a day and $100 more lands in your cash - it is never automatic.' },
    { h: 'A price comes from a pool', p: 'A meme coin has no exchange order book; its price is whatever the deepest liquidity pool says. Demo Spot reads that pool live, so the number you buy at is the real one - but a pool holding under $1,000 is refused outright, because a price with nothing behind it is fiction, and a pool that empties overnight is a rug: the coin stays in your account marked RUGGED, worth what the pool says, which is nothing.' },
    { h: 'The contract address is the identity', p: 'Ten tokens can share a ticker; only one has the address you meant. Paste a contract address into Demo Spot and it resolves from DexScreener or GeckoTerminal to the token behind it, with its liquidity and FDV, and a warning when it is not on the trending list. Check it on the explorer before you trust a name - copies of famous tokens are the classic scam.' },
    { h: 'The board pays profit, not luck', p: 'One leaderboard, ranked by season profit in dollars: what your portfolio is worth now minus what it was worth when the 14-day season started, with every daily claim taken out. Holding through a move counts; claiming does not. The three biggest profits are paid $15, $10 and $5 in real USDT when the season ends, and only a positive profit pays.' },
  ],
  quiz: [
    { q: 'What is the worst case for a spot position?', o: ['A liquidation when price moves 5%', 'A funding payment every eight hours', 'The coin goes to zero and you lose what you paid', 'The exchange closes it after a day'], a: 2 },
    { q: 'Where does a meme coin price come from in Demo Spot?', o: ['The owner types it in', 'The deepest liquidity pool, read live', 'Yesterday’s close', 'The average of three exchanges'], a: 1 },
    { q: 'Two tokens share the ticker PEPE. How do you tell which is which?', o: ['By the logo', 'By the contract address', 'By which one is cheaper', 'By the name in the chat'], a: 1 },
    { q: 'Does pressing Claim every day help you on the Meme Spot board?', o: ['Yes, $100 a day adds to your profit', 'No, every claim is subtracted before profit is measured', 'Only on weekends', 'Only after ten claims'], a: 1 },
  ],
};
walk(data);
if (hit !== 1) { console.error('ex10 matched ' + hit + ' times - refusing'); process.exit(1); }
const out = h.replace(re, (_, a, __, c) => a + JSON.stringify(data) + c);
fs.writeFileSync(F + '.tmp', out); fs.renameSync(F + '.tmp', F);
console.log('academy ex10 rewritten (' + LESSON.cards.length + ' cards, ' + LESSON.quiz.length + ' questions)');
