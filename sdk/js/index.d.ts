export interface Position { id: string; symbol: string; side: 'long' | 'short'; entry_price: number; margin_usd: number; leverage: number; qty: number; liq_price: number; sl: number | null; tp: number | null; status: 'open' | 'closed' | 'liquidated'; opened_ts: number; mark_price?: number; unrealized_pnl_usd?: number; exit_price?: number | null; pnl_usd?: number | null; closed_ts?: number | null; trail_pct?: number; fee_rate_pct?: number; fee_venue?: string | null; }
export interface OpenParams { symbol: string; side: 'long' | 'short' | 'buy' | 'sell'; margin_usd: number; leverage?: number; sl?: number; tp?: number; trail_pct?: number; type?: 'market' | 'limit' | 'stop'; limit_price?: number; client_order_id?: string; fee_venue?: string | null; dry_run?: boolean;
  /** Override the account's simulation profile for THIS fill only. Writes nothing. */
  slippage?: boolean; slippage_bps?: number; impact_bps_per_100k?: number; margin_tiers?: boolean; mmr_pct?: number; }
/** What actually filled, on v2 opens. position.margin_usd is already the filled size; this says what you asked for. */
export interface FillInfo { requested_margin_usd: number; filled_margin_usd: number; fill_pct: number; partial: boolean; slippage_pct: number; exit_slippage: boolean; latency_ms: number; taker_fee_pct: number; maintenance_margin_pct: number; maintenance_margin_from: string; }
/** The eight ready-made simulations. A preset starts from the defaults, so it is a clean slate plus that configuration. */
export type SimPreset = 'frictionless' | 'realistic' | 'binance' | 'bybit' | 'okx' | 'hyperliquid' | 'thin_book' | 'brutal';
/**
 * The whole paper-trading simulation. Send any subset; out-of-range values are REFUSED, never clamped.
 * The three nullable fields take null to mean "use the measured table / the venue", not zero.
 */
export interface SimProfile {
  preset?: SimPreset; reset?: boolean;
  /** the book */
  start_balance_usd?: number; margin_enforced?: boolean; leverage_max?: number; max_notional_usd?: number;
  /** the fill */
  slippage?: boolean; slippage_bps?: number | null; impact_bps_per_100k?: number; exit_slippage?: boolean;
  latency_ms?: number; partial_fills?: boolean; min_fill_pct?: number; reject_rate_pct?: number;
  /** the cost */
  taker_bps?: number | null; funding?: boolean; funding_mult?: number;
  /** the liquidation */
  margin_venue?: string; margin_tiers?: boolean; mmr_pct?: number | null;
}
export class MarginPadError extends Error { code: string; status: number; body: any; }
export class MarginPad {
  static SIM_PRESETS: SimPreset[];
  constructor(key?: string, opts?: { baseUrl?: string; autoRetry?: boolean; timeoutMs?: number });
  price(symbol: string): Promise<{ symbol: string; price: number; change_24h_pct: number | null; ts: number }>;
  prices(): Promise<any>;
  klines(symbol: string, interval?: string, end?: number): Promise<any[]>;
  // NOTE: the method is serverTime(). This file declared a `time()` that the client has never had - a
  // declaration for a method that does not exist is worse than no declaration, so it is gone.
  serverTime(): Promise<{ server_time_ms: number; server_time_iso: string }>;
  open(p: OpenParams): Promise<{ position?: Position; order?: any; dry_run?: boolean; fill?: FillInfo }>;
  limitOrder(p: OpenParams): Promise<any>;
  stopOrder(p: OpenParams & { stop_price?: number }): Promise<any>;
  close(id: string, opts?: { pct?: number; symbol?: string; client_order_id?: string }): Promise<{ position: Position }>;
  closeAll(): Promise<{ closed: number; positions: Position[] }>;
  sltp(id: string, p: { sl?: number | null; tp?: number | null; trail_pct?: number | null }): Promise<{ position: Position }>;
  positions(opts?: { status?: 'open' | 'closed'; since?: number; useEtag?: boolean }): Promise<{ positions: Position[] } | null>;
  orders(): Promise<{ orders: any[] }>;
  cancelOrder(id: string): Promise<{ order_id: string; status: string }>;
  modifyOrder(id: string, p: any): Promise<any>;
  trades(limit?: number, before?: number): Promise<{ trades: Position[]; next_before: number | null }>;
  account(): Promise<any>;
  balance(): Promise<any>;
  equity(days?: number, stepMin?: number): Promise<any>;
  reset(): Promise<any>;
  accounts(): Promise<any>;
  markets(assetClass?: string): Promise<any>;
  /** The fee schedule. fees() reads, fees('binance') sets the account default, fees('') goes back to ours. */
  fees(venue?: string): Promise<any>;
  /** Three switches of the simulation, kept for compatibility. sim() is all of it. */
  realism(o?: { slippage?: boolean; margin_tiers?: boolean; margin_venue?: string }): Promise<any>;
  /** The whole simulation: read with no argument, set with any subset or a preset. */
  sim(o?: SimProfile): Promise<any>;
  /** The trading report. `costs` (fees, funding, gross vs net, kept_pct) is on every plan. */
  report(days?: number): Promise<any>;
  usage(): Promise<any>;
  webhooks(): Promise<any>;
  stream(onEvent: (ev: { type: string; data: any }) => void, opts?: any): { close(): void };
}
export function verifyWebhook(secret: string, rawBody: string, signatureHeader: string): boolean;
