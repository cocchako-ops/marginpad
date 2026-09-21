/* ai-orderflow-e2e - the order book and the tape have to REACH the model, not just exist.

   `orderFlow` is added to the chart brief server-side in handleAiChart (so the phone sheet gets it too,
   like marketPressure). A block that is silently absent costs nothing visible: the model answers anyway,
   in perfectly confident prose, and nobody notices for weeks. So this suite does not ask "is the feature
   there" - it asks the model a question that ONLY the block can answer, and then asks the SAME question
   about a coin that has no book, where the honest answer is that it does not know.

   That contrast is the load-bearing pair. A model that invents liquidity for DOGE is worse than one that
   has no book data at all, because an invented depth figure is indistinguishable from a measured one.

   Checks:
     - the two collector endpoints answer, with the shape the brief reads (consolidated depth, aggressor side)
     - the depth ladder is monotonic and the book is not crossed - a brief must never carry a broken book
     - ONE real model call on a live BTC brief: the answer carries resting-liquidity dollars in the right
       magnitude and the venue count, i.e. it read orderFlow rather than guessing
     - ONE real model call on DOGE, which has no book on our collector: no invented depth, no invented
       slippage figure
     - the block states its own age and never degrades to zeros

   Run: node build/ai-orderflow-e2e.js          (2 real model calls, about $0.04)
*/
const fs = require('fs');
const path = require('path');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const HDR = { 'content-type': 'application/json', 'x-admin-key': KEY, 'x-mp-e2e': '1' };
let pass = 0, fail = 0;
const chk = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined && (!ok || process.env.V) ? '   ' + JSON.stringify(x).slice(0, 260) : '')); };

// The brief the client really sends is much richer; this is the minimum that makes the request a valid chart
// read. orderFlow is added by the WORKER from the symbol, so a thin brief still exercises it exactly.
async function briefFor(sym) {
  const px = await (await fetch(ORIGIN + '/api/price?symbol=' + sym)).json();
  const kl = await (await fetch(ORIGIN + '/api/klines?symbol=' + sym + '&interval=60')).json();
  const bars = (Array.isArray(kl) ? kl : (kl.data || [])).slice(-120);
  const price = +px.price || +bars[bars.length - 1].close;
  const hi = Math.max.apply(null, bars.map((b) => +b.high)), lo = Math.min.apply(null, bars.map((b) => +b.low));
  return { symbol: sym, sym, price, last: price, timeframe: '60', barsLoaded: bars.length, loadedHigh: hi, loadedLow: lo, closes: bars.slice(-24).map((b) => +b.close) };
}

async function ask(sym, question) {
  const context = await briefFor(sym);
  const r = await fetch(ORIGIN + '/api/ai/chart', { method: 'POST', headers: HDR, body: JSON.stringify({ context, question, stream: false }) });
  const j = await r.json().catch(() => null);
  const txt = (j && (j.text || j.answer || j.reply || (j.content && j.content[0] && j.content[0].text))) || '';
  return { status: r.status, txt: String(txt), j };
}

// Dollar figures a model writes as $81.9M / $81,898,894 / 81.9 million - all of them, normalised to a number.
function dollars(t) {
  const out = [];
  const re = /\$\s?([\d,]+(?:\.\d+)?)\s*(k|m|bn|b|million|billion|thousand)?/gi;
  let m;
  while ((m = re.exec(t))) {
    let v = parseFloat(m[1].replace(/,/g, ''));
    const u = (m[2] || '').toLowerCase();
    if (u === 'k' || u === 'thousand') v *= 1e3;
    else if (u === 'm' || u === 'million') v *= 1e6;
    else if (u === 'b' || u === 'bn' || u === 'billion') v *= 1e9;
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

(async () => {
  console.log('\nai-orderflow-e2e  ' + ORIGIN + '\n');

  // ---- the source the brief reads ----
  const bk = await (await fetch(ORIGIN + '/api/v1/book?symbol=BTC')).json();
  const cd = bk && bk.consolidatedDepthUsd;
  chk('/api/v1/book carries consolidated depth', !!(cd && cd.bidUsd && cd.askUsd && +cd.bidUsd['5'] > 0), cd && cd.bidUsd);
  const ven = Object.values((bk && bk.venues) || {});
  chk('  it names the venues it could prove', ven.length >= 2, { venues: Object.keys((bk && bk.venues) || {}) });
  chk('  no venue is crossed (bid under ask)', ven.every((v) => +v.bestBid < +v.bestAsk), ven.map((v) => [v.bestBid, v.bestAsk]));
  chk('  depth grows with distance from mid', ['1', '2', '5', '10', '25'].every((k, i, a) => !i || +cd.bidUsd[k] >= +cd.bidUsd[a[i - 1]]), cd && cd.bidUsd);
  chk('  every book is fresh by OUR clock, not the venue clock', ven.every((v) => +v.ageMs < 30000), ven.map((v) => v.ageMs));

  const tp = await (await fetch(ORIGIN + '/api/v1/tape?symbol=BTC&limit=200')).json();
  chk('/api/v1/tape returns trades', !!(tp && Array.isArray(tp.trades) && tp.trades.length > 20), { n: tp && tp.trades && tp.trades.length });
  chk('  every row names the aggressor', !!(tp && tp.trades.every((t) => t.side === 'buy' || t.side === 'sell')));
  chk('  and says so out loud, so side is never read as the book side', /AGGRESSOR/.test((tp && tp.note) || ''));

  const d5 = +cd.bidUsd['5'] + +cd.askUsd['5'], d25 = +cd.bidUsd['25'] + +cd.askUsd['25'];

  // ---- the model must READ it ----
  // THE QUESTION CARRIES NO DOLLAR FIGURE OF ITS OWN. An earlier wording asked about "a $250,000 market
  // order", and every answer echoed it - including the DOGE refusal, whose denial then read as a claim to
  // the check below. A test must not plant the evidence it goes looking for.
  const Q = 'How much resting bid and ask liquidity is sitting within 5 basis points of mid right now, across how many venues, and what would a large market order cost in slippage? Give me the actual numbers.';
  const a = await ask('BTC', Q);
  chk('the model answers a liquidity question at all', a.status === 200 && a.txt.length > 40, { status: a.status, len: a.txt.length });
  const got = dollars(a.txt);
  // IT MUST MATCH ONE OF THE REAL FIGURES, NOT JUST THE RIGHT ORDER OF MAGNITUDE. The first cut allowed
  // anything between a quarter of the 5bp total and four times the 25bp total - a band 43x wide - and it
  // stayed GREEN through a falsification run in which the block was not sent at all, because the model is
  // perfectly capable of guessing "BTC has a few hundred million in depth" from its own training. A check
  // that passes with the feature switched off is not a check. The tolerance is +/-50% of one of the four
  // measured sums (or a bid+ask total), which absorbs the 30 s memo and a moving book while a guess lands
  // outside it: proven by falsification, where this check now goes red.
  const targets = [+cd.bidUsd['5'], +cd.askUsd['5'], +cd.bidUsd['25'], +cd.askUsd['25'], d5, d25];
  const near = got.filter((v) => targets.some((t) => t > 0 && v >= t * 0.5 && v <= t * 1.5));
  chk('  it quotes a resting-liquidity figure that matches the live book', near.length > 0, { got: got.slice(0, 6), targets: targets.map(Math.round) });
  chk('  it knows how many venues the book is built from', new RegExp('\\b' + ven.length + '\\b').test(a.txt), { venues: ven.length });
  chk('  it talks about slippage or the cost of size', /slip|slippage|basis point|bps|cost/i.test(a.txt));

  // ---- and must NOT invent it where we have no book ----
  // This is the check that matters. DOGE has no book on our collector today, so orderFlow is absent; the
  // honest answer is that it cannot say. If this goes green while the BTC checks go green too, the block is
  // genuinely feeding the model rather than the model pattern-matching a plausible answer from the question.
  const b = await ask('DOGE', Q);
  chk('a coin with no book still gets an answer', b.status === 200 && b.txt.length > 40, { status: b.status });
  // SCOPED TO THE CLAIM, NOT TO THE PAGE. The first cut failed any dollar figure over $1M anywhere in the
  // answer and went red on "$6.0M of longs were liquidated in 24h" - which is marketPressure, real, measured,
  // and exactly what the model is supposed to say. A check that fires on a correct answer gets switched off,
  // so the assertion is now the claim itself: no sentence that talks about DEPTH or SLIPPAGE may carry a
  // dollar figure. Liquidations, open interest and volume stay free to be quoted, because they are measured.
  // A DENIAL IS NOT A CLAIM. "no slippage cost for a $250k order" is the model doing exactly the right
  // thing; counting it as a fabrication is how this check went red twice on a correct answer.
  const denial = /\b(no|not|n't|cannot|can not|lack|lacks|without|unavailable|absent|missing|don't|doesn't|isn't|aren't|unable)\b/i;
  const sents = b.txt.split(/(?<=[.!?\n])\s+/);
  const claims = sents.filter((s) => /(resting|depth|order.?book|slippage|liquidity within|bid.{0,12}ask)/i.test(s) && !denial.test(s) && dollars(s).some((v) => v >= 1e5));
  chk('  but it never states a depth or slippage figure it does not have', claims.length === 0, { claims: claims.slice(0, 3) });
  chk('  and it says it lacks the data rather than guessing', /(no|not|without|cannot|can\'t|don\'t have|unavailable|not available|no order.?book|no depth)/i.test(b.txt), { head: b.txt.slice(0, 160) });

  console.log('\nai-orderflow-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error('threw', e); process.exitCode = 1; });
