// PROOF for the tape. "Trades arrived" proves nothing - the failure mode that matters is a correctly
// shaped tape with the aggressor side inverted, which produces a perfectly plausible cumulative delta
// that is exactly backwards. So the load-bearing check is a market one: an aggressive BUY lifts the ask
// and must print at or above the mid; an aggressive SELL hits the bid and must print at or below. Run
// over hundreds of real trades per venue, that separates a correct mapping from a flipped one decisively.
//
//   node collector/test-tape.js            all venues, 90s
//   node collector/test-tape.js binance 120
import { TapeCollector, TAPE_VENUES } from './src/collectors/tape.js';

const ONLY = process.argv[2] && TAPE_VENUES.includes(process.argv[2]) ? [process.argv[2]] : TAPE_VENUES;
const SECS = +process.argv[3] || 90;
const SYMS = ['BTC', 'ETH', 'SOL'];

let pass = 0, fail = 0;
const chk = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (d !== undefined && (!ok || process.env.V) ? '   ' + JSON.stringify(d) : '')); };

// THE MID HAS TO BE LIVE, AND THIS IS THE SECOND TIME THAT LESSON HAS BEEN PAID FOR.
// The first version polled each venue's REST book every ten seconds. Buys passed everywhere and SELLS
// failed on four venues out of five - 43%, 43%, 38%, 61% below mid - and the mapping was correct all
// along: the market rose 0.14% during the run, so a mid up to ten seconds old sat BELOW the current bid,
// and perfectly ordinary sells printed above it. Hyperliquid passed precisely because its check already
// used a live book on the same socket. So every venue gets a live top-of-book stream here. A stale
// reference price does not test a tape, it tests the network.
const MIDFEED = {
  bybit: { url: 'wss://stream.bybit.com/v5/public/linear', sub: (S) => [{ op: 'subscribe', args: S.map((s) => `orderbook.1.${s}USDT`) }],
    read: (j) => (j.topic && /^orderbook\.1\./.test(j.topic) && j.data)
      ? { sym: String(j.data.s || '').replace(/USDT$/, ''), bid: +((j.data.b || [])[0] || [])[0], ask: +((j.data.a || [])[0] || [])[0] } : null },
  okx: { url: 'wss://ws.okx.com:8443/ws/v5/public', sub: (S) => [{ op: 'subscribe', args: S.map((s) => ({ channel: 'books5', instId: `${s}-USDT-SWAP` })) }],
    read: (j) => (j.arg && j.arg.channel === 'books5' && j.data && j.data[0])
      ? { sym: String(j.arg.instId || '').replace(/-USDT-SWAP$/, ''), bid: +((j.data[0].bids || [])[0] || [])[0], ask: +((j.data[0].asks || [])[0] || [])[0] } : null },
  bitget: { url: 'wss://ws.bitget.com/v2/ws/public', sub: (S) => [{ op: 'subscribe', args: S.map((s) => ({ instType: 'USDT-FUTURES', channel: 'books1', instId: `${s}USDT` })) }],
    read: (j) => (j.arg && j.arg.channel === 'books1' && j.data && j.data[0])
      ? { sym: String(j.arg.instId || '').replace(/USDT$/, ''), bid: +((j.data[0].bids || [])[0] || [])[0], ask: +((j.data[0].asks || [])[0] || [])[0] } : null },
  binance: { url: (S) => 'wss://fstream.binance.com/stream?streams=' + S.map((s) => s.toLowerCase() + 'usdt@bookTicker').join('/'), sub: () => [],
    read: (j) => { const d = j.data || j; return (d && d.e === 'bookTicker') ? { sym: String(d.s || '').replace(/USDT$/, ''), bid: +d.b, ask: +d.a } : null; } },
  hyperliquid: { url: 'wss://api.hyperliquid.xyz/ws', sub: (S) => S.map((s) => ({ method: 'subscribe', subscription: { type: 'bbo', coin: s } })),
    read: (j) => (j.channel === 'bbo' && j.data && j.data.bbo)
      ? { sym: String(j.data.coin || '').toUpperCase(), bid: +(j.data.bbo[0] || {}).px, ask: +(j.data.bbo[1] || {}).px } : null },
};

// Every quote is kept WITH the venue's own timestamp, because the trade stream carries that same clock.
// Holding only "the latest mid we happen to have" turns this into a race between two sockets, and on the
// fastest venue the book has already moved by the time the trade that moved it arrives.
const midTs = {
  bybit: (j) => +j.cts || +j.ts,
  okx: (j) => +((j.data || [])[0] || {}).ts,
  bitget: (j) => +((j.data || [])[0] || {}).ts,
  binance: (j) => { const d = j.data || j; return +d.T || +d.E; },
  hyperliquid: (j) => +((j.data || {}).time),
};

function startMid(venue, S, mids) {
  const f = MIDFEED[venue];
  const ws = new WebSocket(typeof f.url === 'function' ? f.url(S) : f.url);
  ws.addEventListener('open', () => f.sub(S).forEach((s) => { try { ws.send(JSON.stringify(s)); } catch (e) {} }));
  ws.addEventListener('message', (e) => {
    try {
      const j = JSON.parse(typeof e.data === 'string' ? e.data : String(e.data));
      const r = f.read(j);
      if (!r || !(r.bid > 0) || !(r.ask > 0)) return;
      const ts = midTs[venue](j) || Date.now();
      const k = venue + r.sym;
      const ring = mids[k] || (mids[k] = []);
      ring.push([ts, (r.bid + r.ask) / 2]);
      if (ring.length > 600) ring.splice(0, ring.length - 600);
    } catch (err) {}
  });
  ws.addEventListener('error', () => {});
  return ws;
}

(async () => {
  console.log(`tape proof: ${ONLY.join(', ')} - ${SECS}s on ${SYMS.join('/')}\n`);
  // Every trade is scored against the mid AS IT WAS when the trade arrived, sampled continuously - a mid
  // fetched once at the end would judge ten minutes of prints against a single later price.
  const mids = {};
  const midSockets = ONLY.map((v) => startMid(v, SYMS, mids));
  await new Promise((r) => setTimeout(r, 4000)); // let every top-of-book arrive before scoring starts

  // THE DRIFT-AND-RACE-IMMUNE TEST: ADJACENT OPPOSITE-SIDE PAIRS.
  // Scoring against a live mid still left Binance at 57.7%/50.6%, barely better than a coin toss - and the
  // mapping was right. The cause is a race between two sockets: on the fastest venue the book has already
  // moved by the time the trade that moved it reaches us, so a buy at the old ask reads below the new mid.
  // Comparing each trade with the nearest trade of the OPPOSITE side within a second needs no book at all,
  // and cancels trend as well: the buy must be the dearer of the two, because the buyer crossed the spread.
  const pairs = {};  // venue -> { right, wrong }
  const lastOpp = {}; // venue+sym+side -> last trade of that side
  const score = {};   // venue -> mid-based tally, kept as a secondary report
  const cols = ONLY.map((v) => new TapeCollector(v, {
    symbols: SYMS,
    onTrade: (t) => {
      // Pick the quote that was current ON THE VENUE'S CLOCK when this trade happened, not the newest one
      // we hold. Both streams stamp with the same clock, so this removes the socket race completely.
      const ring = mids[t.venue + t.sym];
      let m = 0;
      if (ring && ring.length) {
        for (let i = ring.length - 1; i >= 0; i--) { if (ring[i][0] <= t.ts) { m = ring[i][1]; break; } }
      }
      if (m) {
        const sc = score[t.venue] || (score[t.venue] = { buy: { above: 0, below: 0 }, sell: { above: 0, below: 0 } });
        const b = sc[t.side];
        if (t.px > m) b.above++; else if (t.px < m) b.below++;
      }
      const other = t.side === 'buy' ? 'sell' : 'buy';
      const prev = lastOpp[t.venue + t.sym + other];
      if (prev && t.ts - prev.ts <= 1000 && t.px !== prev.px) {
        const p = pairs[t.venue] || (pairs[t.venue] = { right: 0, wrong: 0 });
        const buyPx = t.side === 'buy' ? t.px : prev.px;
        const sellPx = t.side === 'buy' ? prev.px : t.px;
        if (buyPx > sellPx) p.right++; else p.wrong++;
      }
      lastOpp[t.venue + t.sym + t.side] = t;
    },
  }));

  await Promise.allSettled(cols.map((c) => c.init()));
  cols.forEach((c) => c.start());
  await new Promise((r) => setTimeout(r, SECS * 1000));
  midSockets.forEach((w) => { try { w.close(); } catch (e) {} });

  for (const c of cols) {
    const st = c.status();
    console.log(`\n--- ${c.name}   trades ${st.trades}  dupes ${st.dupes}  bad ${st.bad}`);
    chk(`${c.venue}: socket is connected`, st.connected, { silentMs: st.silentMs });
    chk(`${c.venue}: trades arrived`, st.trades > 0, { trades: st.trades });
    chk(`${c.venue}: no malformed rows reached the ring`, st.bad === 0, { bad: st.bad });

    const sc = score[c.venue];
    const nBuy = sc ? sc.buy.above + sc.buy.below : 0;
    const nSell = sc ? sc.sell.above + sc.sell.below : 0;
    if (nBuy < 20 || nSell < 20) {
      chk(`${c.venue}: enough trades on both sides to judge the aggressor (>=20 each)`, false, { buys: nBuy, sells: nSell });
    } else {
      // THE CHECK THAT MATTERS, AND THE THIRD INSTRUMENT IT TOOK TO GET RIGHT.
      // Not "how often is a buy above the mid" - a trending market and a two-socket race both spoil that,
      // and they spoiled it differently on every venue. Not "is a buy dearer than the sell beside it"
      // either: on Bitget, ten times thinner than Binance, adjacent trades are up to a second apart and
      // drift wins. What survives all three problems is the DIFFERENCE between the two sides, because
      // anything that moves the market moves both of them the same way and cancels: buys must sit above
      // the mid far more often than sells do. Flip the mapping and this goes sharply negative.
      const buyUp = sc.buy.above / nBuy * 100;
      const sellUp = sc.sell.above / nSell * 100;
      const spread = buyUp - sellUp;
      chk(`${c.venue}: taker BUYs sit above the mid far more often than SELLs do`, spread >= 15,
        { buysAboveMidPct: +buyUp.toFixed(1), sellsAboveMidPct: +sellUp.toFixed(1), gap: +spread.toFixed(1), n: nBuy + nSell });
      const p = pairs[c.venue], nP = p ? p.right + p.wrong : 0;
      if (nP >= 30) console.log(`         (adjacent opposite-side pairs: ${(p.right / nP * 100).toFixed(0)}% have the buy dearer, ${nP} pairs - reported)`);
    }

    for (const sym of SYMS) {
      const last = c.read(sym, 50);
      if (!last) { chk(`${c.venue}/${sym}: tape is readable`, false, { state: st.symbols[sym] }); continue; }
      chk(`${c.venue}/${sym}: tape is readable`, true);
      const sane = last.every((t) => t.px > 0 && t.qty > 0 && t.usd > 0 && (t.side === 'buy' || t.side === 'sell'));
      chk(`${c.venue}/${sym}: every row is well formed`, sane);
      // a $1 trade and a $10M trade are both real; a $10bn one is a unit error
      const max = Math.max(...last.map((t) => t.usd));
      chk(`${c.venue}/${sym}: sizes are in a believable range`, max < 5e8, { biggestUsd: max });
      const d = c.delta(sym);
      chk(`${c.venue}/${sym}: cumulative delta adds up`, !!d && Math.abs((d.buyUsd - d.sellUsd) - d.deltaUsd) <= 1, d);
    }
  }

  const c0 = cols[0], ex = c0 && c0.read('BTC', 3), dx = c0 && c0.delta('BTC');
  if (ex) {
    console.log(`\nworked example - ${c0.venue} BTC, last three prints`);
    for (const t of ex) console.log(`  ${new Date(t.ts).toISOString().slice(11, 23)}  ${t.side.toUpperCase().padEnd(4)}  ${t.qty} @ ${t.px}  = $${t.usd.toLocaleString()}`);
    if (dx) console.log(`  this minute: taker buys $${dx.buyUsd.toLocaleString()} vs sells $${dx.sellUsd.toLocaleString()}  ->  delta $${dx.deltaUsd.toLocaleString()} over ${dx.trades} trades`);
  }

  cols.forEach((c) => c.shutdown());
  console.log(`\ntape proof: ${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
  setTimeout(() => process.exit(fail ? 1 : 0), 300);
})();
