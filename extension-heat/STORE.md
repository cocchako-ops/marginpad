# MarginPad — Crypto Liquidation Heatmap — Chrome Web Store (NEW item v1.0.0)

A **brand-new, separate extension**. Live liquidation heatmap in the toolbar, powered by MarginPad's public API.

## Files
- **Upload this:** `dist-marginpad-heatmap-v1.0.0.zip` (manifest + popup.html + popup.js + icons/)
- Store promo tile (1280×800): `store-promo-1280x800.png`
- Popup screenshot: `store-screenshot-popup.png`

## How to publish (new item)
1. Go to the **Chrome Web Store Developer Dashboard** → https://chrome.google.com/webstore/devconsole
   (uses the same developer account as the calculator extension — no new $5 fee).
2. **+ New item** → upload `dist-marginpad-heatmap-v1.0.0.zip`.
3. Fill in the store listing (text below), add `store-promo-1280x800.png` as a screenshot (1280×800).
4. **Privacy tab (important — it uses one permission):**
   - Single purpose: "Show a live crypto liquidation heatmap and 24h liquidation stats."
   - `host_permissions` = `https://marginpad.io/*` — justification: *"The extension fetches public liquidation-heatmap and 24h-liquidation data from marginpad.io to display it. No user data is read or sent; nothing is stored."*
   - Data collection: **none**. No account, no tracking, no analytics.
5. **Submit for review.**

## Store listing text
- **Name:** MarginPad — Crypto Liquidation Heatmap
- **Summary:** Live crypto liquidation heatmap in your toolbar: see where BTC, ETH & SOL liquidations cluster, 24h liquidations long vs short, and the most-rekt coins.
- **Description:**
  > See where leverage is stacked before it blows up. MarginPad's Liquidation Heatmap puts a live map of liquidation clusters right in your toolbar — the exact price levels where longs and shorts get liquidated, colour-coded from light to dense.
  >
  > • Live liquidation heatmap for BTC, ETH, SOL, BNB, XRP & DOGE — price levels where leverage clusters
  > • 24h liquidations across all exchanges, long vs short
  > • The most-rekt coins in the last 24h
  > • Auto-refreshes; tap any coin to switch
  >
  > Free, no signup, no tracking. Open the full interactive heatmap on marginpad.io anytime.
- **Category:** Tools (or Finance)

## Data source
- `GET https://marginpad.io/api/heatmap/pools?symbol=<COIN>` — liquidation pools (price + weight)
- `GET https://marginpad.io/api/cg/pulse` — 24h liquidations + top liquidated coins
- Both are public, edge-cached, CORS-enabled. Popup refreshes every 45s.
