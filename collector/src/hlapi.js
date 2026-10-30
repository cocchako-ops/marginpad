// One door to Hyperliquid's REST info API, so what we spend is a measurement and not a sum on paper (2026-10-30).
// The limit is 1200 weight a minute PER IP, shared by every caller on the box, and the liquidation harvest used to
// swallow a refusal with a bare `if (!r.ok) return`, so nothing anywhere could say how much of it we really used.
// `who` names the caller; /api/v1/status publishes the last full minute and the hour behind it.
const INFO = 'https://api.hyperliquid.xyz/info';
const W2 = new Set(['l2Book', 'allMids', 'clearinghouseState', 'orderStatus', 'spotClearinghouseState', 'exchangeStatus']);
const PER20 = new Set(['userFills', 'userFillsByTime', 'recentTrades', 'historicalOrders', 'fundingHistory', 'userFunding', 'twapHistory']);
const weightOf = (type) => (type === 'userRole' ? 60 : W2.has(type) ? 2 : 20);
const rows = new Map(); // minute -> who -> { calls, weight, refused, errors }
function bucket(who) {
  const m = Math.floor(Date.now() / 60000);
  let b = rows.get(m);
  if (!b) { b = new Map(); rows.set(m, b); for (const k of rows.keys()) if (k < m - 61) rows.delete(k); }
  let r = b.get(who);
  if (!r) { r = { calls: 0, weight: 0, refused: 0, errors: 0 }; b.set(who, r); }
  return r;
}
export async function hlPost(body, { who = 'other', timeoutMs = 10000 } = {}) {
  const t = String(body && body.type), r0 = bucket(who);
  r0.calls++; r0.weight += weightOf(t);
  let r;
  try {
    r = await fetch(INFO, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) { r0.errors++; throw e; }
  if (!r.ok) { if (r.status === 429) r0.refused++; else r0.errors++; throw new Error('info ' + r.status); }
  const j = await r.json();
  if (PER20.has(t) && Array.isArray(j)) r0.weight += Math.floor(j.length / 20);
  return j;
}
export function hlMeter() {
  const m = Math.floor(Date.now() / 60000);
  const sum = (from, to) => {
    const byCaller = {}; let weight = 0, refused = 0, minutes = 0;
    for (const [k, b] of rows) {
      if (k < from || k > to) continue;
      minutes++;
      for (const [who, r] of b) {
        const o = byCaller[who] = byCaller[who] || { calls: 0, weight: 0, refused: 0, errors: 0 };
        for (const f of ['calls', 'weight', 'refused', 'errors']) o[f] += r[f];
        weight += r.weight; refused += r.refused;
      }
    }
    return { minutes, weight, refused, byCaller };
  };
  return { limitPerMin: 1200, lastMin: sum(m - 1, m - 1), lastHour: sum(m - 60, m - 1) };
}
