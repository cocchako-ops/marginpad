// Bybit V5 linear-perp liquidations. Endpoint: wss://stream.bybit.com/v5/public/linear
// Topic: allLiquidation.{symbol} (the CURRENT all-liquidation topic; old single-event `liquidation.{symbol}`
//        is deprecated). Bybit has no single market-wide topic, so we subscribe to the TOP-N symbols by
//        24h turnover (fetched at startup) to get broad coverage. Verified from Bybit V5 docs at build time.
//   data[]: { T:ts(ms), s:symbol, S:'Buy'|'Sell', v:size, p:bankruptcyPrice }
// SIDE:  S==='Buy' => LONG liquidated; S==='Sell' => SHORT liquidated.
// Keepalive: {op:'ping'} every ~20s.
import { BaseCollector } from './base.js';
import { config } from '../../config.js';
import { log } from '../logger.js';

export class BybitCollector extends BaseCollector {
  constructor(opts) {
    super('bybit', opts);
    this.silenceMs = 35000;
    this.staleMs = 6 * 60 * 1000; // broad symbol coverage -> a 6-min event gap means a dead subscription
    this.subSymbols = this.symbols.map((s) => s + 'USDT'); // fallback until init() loads the top list
  }
  url() { return 'wss://stream.bybit.com/v5/public/linear'; }

  async init() {
    // Pull the most-active linear USDT perps so the feed reflects the whole market, not just majors.
    try {
      const r = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
      const j = await r.json();
      const list = (j && j.result && j.result.list) || [];
      const top = list
        .filter((t) => /USDT$/.test(t.symbol) && !/-/.test(t.symbol))
        .sort((a, b) => (parseFloat(b.turnover24h) || 0) - (parseFloat(a.turnover24h) || 0))
        .slice(0, config.bybitTopN || 150)
        .map((t) => t.symbol);
      // always include the site's listed coins even if outside the top-N
      for (const s of this.symbols) { const sym = s + 'USDT'; if (!top.includes(sym)) top.push(sym); }
      if (top.length) this.subSymbols = top;
      log.info('[bybit] subscribing to top symbols', { count: this.subSymbols.length });
    } catch (e) {
      log.warn('[bybit] failed to load tickers — using fallback symbol list', { e: String(e) });
    }
  }

  subscribeFrames() {
    // Chunk to stay well under any per-message arg limit.
    const frames = [];
    for (let i = 0; i < this.subSymbols.length; i += 10) {
      frames.push({ op: 'subscribe', args: this.subSymbols.slice(i, i + 10).map((s) => 'allLiquidation.' + s) });
    }
    return frames;
  }
  pingFrame() { return { op: 'ping' }; }
  pingIntervalMs() { return 20000; }

  parse(raw) {
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    let j; try { j = JSON.parse(text); } catch { return []; }
    if (j.op || j.success !== undefined) return []; // pong / subscribe ack
    if (!j.topic || !j.topic.startsWith('allLiquidation.')) return [];
    const data = Array.isArray(j.data) ? j.data : j.data ? [j.data] : [];
    const out = [];
    for (const d of data) {
      const sym = this._norm(d.s); if (!sym) continue;
      const side = d.S === 'Buy' ? 'long_liquidated' : 'short_liquidated';
      const price = parseFloat(d.p), qty = parseFloat(d.v);
      if (!(price > 0) || !(qty > 0)) continue;
      out.push({ ts: Number(d.T) || Number(j.ts) || Date.now(), exchange: 'bybit', symbol: sym, side, price, qty, notional: price * qty });
    }
    return out;
  }
  _norm(instr) {
    if (!instr || !instr.endsWith('USDT') || instr.indexOf('-') !== -1) return null;
    return instr.slice(0, -4);   // we only subscribed to symbols we want, so keep all of them
  }
}
