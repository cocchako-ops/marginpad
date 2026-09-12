export interface Position { id: string; symbol: string; side: 'long' | 'short'; entry_price: number; margin_usd: number; leverage: number; qty: number; liq_price: number; sl: number | null; tp: number | null; status: 'open' | 'closed' | 'liquidated'; opened_ts: number; mark_price?: number; unrealized_pnl_usd?: number; exit_price?: number | null; pnl_usd?: number | null; closed_ts?: number | null; trail_pct?: number; fee_rate_pct?: number; fee_venue?: string | null; }
export interface OpenParams { symbol: string; side: 'long' | 'short'; margin_usd: number; leverage?: number; sl?: number; tp?: number; trail_pct?: number; type?: 'market' | 'limit' | 'stop'; limit_price?: number; client_order_id?: string; fee_venue?: string | null; dry_run?: boolean; }
export class MarginPadError extends Error { code: string; status: number; body: any; }
export class MarginPad {
  constructor(key?: string, opts?: { baseUrl?: string; autoRetry?: boolean; timeoutMs?: number });
  price(symbol: string): Promise<{ symbol: string; price: number; change_24h_pct: number | null; ts: number }>;
  klines(symbol: string, interval?: string, end?: number): Promise<any[]>;
  time(): Promise<{ server_time_ms: number; server_time_iso: string }>;
  open(p: OpenParams): Promise<{ position?: Position; order?: any; dry_run?: boolean }>;
  close(id: string, opts?: { pct?: number; symbol?: string; client_order_id?: string }): Promise<{ position: Position }>;
  closeAll(): Promise<{ closed: number; positions: Position[] }>;
  sltp(id: string, p: { sl?: number | null; tp?: number | null; trail_pct?: number | null }): Promise<{ position: Position }>;
  positions(): Promise<{ positions: Position[] }>;
  orders(): Promise<{ orders: any[] }>;
  cancelOrder(id: string): Promise<{ order_id: string; status: string }>;
  modifyOrder(id: string, p: any): Promise<any>;
  trades(opts?: { limit?: number; before?: number }): Promise<{ trades: Position[]; next_before: number | null }>;
  account(): Promise<any>;
  balance(): Promise<any>;
  markets(): Promise<any>;
  fees(): Promise<any>;
  report(days?: number): Promise<any>;
  usage(): Promise<any>;
  webhooks(): Promise<any>;
  stream(onEvent: (ev: { type: string; data: any }) => void, opts?: any): { close(): void };
}
export function verifyWebhook(secret: string, rawBody: string, signatureHeader: string): boolean;
