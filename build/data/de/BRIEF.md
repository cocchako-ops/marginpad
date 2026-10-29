# MarginPad - German (de-DE) translation brief (read fully before translating a chunk)

You are translating the text of **marginpad.io**, a free crypto-futures tools site (calculators, a paper-trading
terminal, charts, a liquidation feed, an academy, a rewards layer, a bot API) into **German**. Readers are
German-speaking futures traders in Germany, Austria and Switzerland. The translation must read as if a German crypto
trader wrote it: correct context, natural phrasing, consistent terminology. Word-by-word output is a failure.

## Format you receive and return

Each chunk is a JSON array of items: `{ "id", "ctx", "kind", "en", "de": "" }`.
- `ctx` = the page the string lives on (e.g. `/rewards/`). Use it to understand the context.
- `kind` = `html` (may contain inline tags), `title` (the browser tab title), `ld` (plain text for search-engine
  structured data), `attr:alt|title|placeholder|aria-label` (plain attribute text).
- Fill **`de`** for every item. Never change `id`, `ctx`, `kind` or `en`. Never leave `de` empty: if a string must
  stay identical (a brand, a ticker, a code word), copy `en` into `de`.
- Write the whole array back to a sidecar file `NNN.de.json` next to the chunk (same folder, same number). Valid JSON
  only. Never edit the chunk file itself.

## Hard rules

1. **Keep every HTML tag, attribute, href, entity exactly as it is** (`<a href="/x/">`, `<b>`, `<code>`, `&amp;`,
   `<br>`). Translate only the text between tags. The set of tags in `de` must equal the set in `en`.
   (`&#39;`/`&rsquo;` may be dropped only when the German sentence genuinely has no apostrophe.)
2. **Never translate the inside of `<code>...</code>`**, URLs, paths (`/screener`), API field names, tickers
   (BTC, ETH, SOL, BTC/USDT), exchange names (Bybit, Binance, OKX, Gate, Bitget, MEXC, BingX, KuCoin, Kraken,
   Hyperliquid, Coinbase, Moon), numbers, currency amounts, percentages, `{placeholders}`, `%s`.
3. **Numbers stay exactly as written** (60,000 stays 60,000; 0.4% stays 0.4%; $11.99 stays $11.99). Live widgets
   print numbers in that format and the static text must match them. Do not convert to German punctuation.
4. Product names stay in English: **MarginPad, Paper Trade, MP Shop, Rekt, The Gold Room, Demo Spot, Meme Spot,
   Premium, Founder, Ticks, XP, Bot API, MCP, Daily Wrap, Happy Hour, Moon, Trading Report, Season Pass, Road to Bronze,
   Ask AI, My Trades, Bot Arena**. Common nouns around them are translated ("öffne Paper Trade", "im MP Shop").
5. **Du-Form** (du / dein / deine / klick), never "Sie" - this is how Bybit, Bitpanda and every German crypto product
   address a trader. Consistent throughout. Correct capitalisation of nouns, ß where standard German has it (Swiss
   readers accept ß).
6. Keep the quotes and dashes the English uses. Compound nouns are written as one word or with a hyphen, never as two
   loose words ("Liquidationspreis", "Funding-Rate", "Stop-Loss", "Take-Profit").
7. Titles (`kind: title`) should stay short (about 65 characters when possible) and keep the " | MarginPad" or
   " - MarginPad" suffix if present. Meta descriptions (`ld`, `attr`) 160 characters or fewer where the English is.
8. Buttons, labels, nav items and table headers must stay **short** (about the same length as the English). German
   runs long - prefer the shorter synonym ("Gebühren" not "Handelsgebühren" where the context is clear).
9. Translate meaning, not words: idioms get a German idiom or plain wording.
10. Never leave a sentence half English. A stray English word in running text is a bug, except the glossary terms
    that stay in English: Long, Short, Stop-Loss, Take-Profit, Funding, Spread, Slippage, Maker, Taker, Drawdown,
    Backtest, Screener, Trailing Stop, Wallet, Exchange (also "Börse"), Trader, Trading, Paper Trading, PnL, ROE, ROI,
    OI, DCA, APR, APY, Swap, Airdrop, Rug, Pump, Dump, Scalp, Swing, Perp, Mark Price, Squeeze. These are nouns in
    German and are capitalised.
11. No emojis, ever, even if the sentence sounds playful.

## Glossary (use these consistently)

| English | German |
|---|---|
| liquidation price | Liquidationspreis |
| liquidation (event) / liquidations | Liquidation / Liquidationen |
| get liquidated / liquidated | liquidiert werden / liquidiert |
| liquidation heatmap / map | Liquidations-Heatmap / Liquidationskarte |
| liquidations feed | Liquidations-Feed |
| leverage | Hebel (75× stays 75×) |
| margin | Margin |
| isolated / cross margin | Isolated Margin / Cross Margin |
| maintenance margin (rate) | Maintenance Margin (Erhaltungsmargin), Satz |
| initial margin | Initial Margin |
| position / open position | Position / offene Position |
| position size | Positionsgröße |
| notional (value) | Nominalwert |
| long / short | Long / Short (ein Long, ein Short, Long-Position) |
| go long / go short | long gehen / short gehen |
| entry price / exit price | Einstiegspreis / Ausstiegspreis |
| stop-loss / take-profit | Stop-Loss / Take-Profit |
| market order / limit order / stop order | Market-Order / Limit-Order / Stop-Order |
| resting order | offene Order |
| fill / filled | Ausführung / ausgeführt |
| order book | Orderbuch |
| fee / fees / taker fee / maker fee | Gebühr / Gebühren / Taker-Gebühr / Maker-Gebühr |
| funding rate / funding | Funding-Rate / Funding |
| open interest (OI) | Open Interest (OI) |
| PnL / unrealized / realized | PnL / unrealisierter PnL / realisierter PnL |
| break-even | Break-even |
| risk/reward | Chance-Risiko-Verhältnis (CRV) |
| win rate | Trefferquote |
| drawdown / max drawdown | Drawdown / maximaler Drawdown |
| candle / candlestick | Kerze / Candlestick |
| timeframe | Zeitrahmen |
| chart | Chart |
| support / resistance | Unterstützung / Widerstand |
| breakout / pullback | Ausbruch / Pullback |
| whale | Wal |
| leaderboard / board | Rangliste / Board |
| season (14-day competition) | Season |
| prize pool | Preispool |
| claim (the faucet) | abholen |
| withdrawal / withdraw | Auszahlung / auszahlen |
| reward / rewards | Belohnung / Belohnungen |
| sign in / sign up / sign out | anmelden / registrieren / abmelden |
| free, no sign-up | kostenlos, ohne Anmeldung |
| paper trading (concept) | Paper Trading |
| simulator | Simulator |
| academy / lesson / course | Akademie / Lektion / Kurs |
| mission (daily) | Mission |
| streak | Serie |
| level (Bronze, Silver...) | Level (Bronze, Silber, Gold, Platin, Diamant, Master, Legendär) |
| balance | Guthaben |
| wallet | Wallet |
| exchange (noun) | Börse (Exchange is also fine in running text) |
| settings | Einstellungen |
| alert / price alert | Alarm / Preisalarm |
| home (breadcrumb) | Start |
| guides | Guides |

## Tone
Direct, confident, no fluff, no exclamation marks the English does not have. Short sentences. A trader is reading
between two trades.
