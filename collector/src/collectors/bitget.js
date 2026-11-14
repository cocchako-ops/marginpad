// BITGET USDT-FUTURES liquidations (2026-11-14, owner: "Kako ne mozemo da vidimo BingX, Bitget, Mexc ... njihove likvidacije?").
// Bitget publishes a PUBLIC liquidation channel in its Unified Account (UTA) WebSocket API - the Classic v2 API has none, which is
// why it was missing until now. MEXC and BingX publish no public liquidation feed at all (checked the same day), so they stay out.
// Endpoint: wss://ws.bitget.com/v3/ws/public, subscribe { op:'subscribe', args:[{ instType:'usdt-futures', topic:'liquidation' }] }.
// Measured from here before writing this: subscribe ack, then one update per liquidation about 1.5 s after it happened.
//   data[]: { symbol:'BTWUSDT', side:'buy'|'sell', price, amount, ts }
// SIDE (Bitget doc: "Position side"): buy = a LONG position was liquidated, sell = a SHORT one.
// AMOUNT IS THE QUOTE (USDT) VALUE, AS THE DOC SAYS (corrected 2026-11-14 the same afternoon). The first cut read it as the
// base quantity from a small mismeasured sample and multiplied by the price again, so a $362 ETH liquidation was stored as
// $654,764 and /rekt/'s top hits were all Bitget at $10-40M (owner noticed). Measured over the day's 253 rows: in 240 of them
// amount / price lands exactly on the contract's lot step (ETH 361.874 / 1809.37 = 0.2000, SOL 36.111 / 72.222 = 0.5000), in 5
// the other way. Notional = amount, qty = amount / price. collector/tools/fix-bitget-quote.js re-priced the stored rows.
// Keepalive: the literal text 'ping' every 25 s; the server answers 'pong'.
// COVERAGE CEILING (2026-11-14 evening, read from Bitget's own doc): the channel covers UTA AND Classic accounts but pushes once a
// second, only the largest long and the largest short per pair - the Binance throttle. That is why we read ~26% of Coinglass's
// Bitget figure. The public trade channel carries no liquidation flag; USDC (~0.3%) and coin-M (none seen) add nothing material.
import { BaseCollector } from './base.js';

export class BitgetCollector extends BaseCollector {
  constructor(opts) {
    super('bitget', opts);
    this.silenceMs = 40000;   // pongs arrive every 25 s, so 40 s of nothing is a dead socket
  }
  url() { return 'wss://ws.bitget.com/v3/ws/public'; }
  subscribeFrames() { return [{ op: 'subscribe', args: [{ instType: 'usdt-futures', topic: 'liquidation' }] }]; }
  pingFrame() { return 'ping'; }
  pingIntervalMs() { return 25000; }

  parse(raw) {
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    if (text === 'pong') return [];
    let j; try { j = JSON.parse(text); } catch { return []; }
    if (j.event || !j.arg || j.arg.topic !== 'liquidation' || !Array.isArray(j.data)) return [];
    const out = [];
    for (const d of j.data) {
      const m = /^([A-Z0-9]+)USDT$/.exec(String(d.symbol || '')); if (!m) continue;
      const price = parseFloat(d.price), qty = parseFloat(d.amount);
      if (!(price > 0) || !(qty > 0)) continue;
      const side = d.side === 'buy' ? 'long_liquidated' : d.side === 'sell' ? 'short_liquidated' : null;
      if (!side) continue;
      out.push({ ts: Number(d.ts) || Date.now(), exchange: 'bitget', symbol: m[1], side, price, qty: qty / price, notional: qty });   // qty here is the published USDT amount
    }
    return out;
  }
}
