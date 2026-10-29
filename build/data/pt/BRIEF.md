# MarginPad - Portuguese (pt-BR) translation brief (read fully before translating a chunk)

You are translating the text of **marginpad.io**, a free crypto-futures tools site (calculators, a paper-trading
terminal, charts, a liquidation feed, an academy, a rewards layer, a bot API) into **Brazilian Portuguese**. Readers
are Portuguese-speaking futures traders, mostly in Brazil, some in Portugal. The translation must read as if a
Brazilian trader wrote it: correct context, natural phrasing, consistent terminology. Word-by-word output is a failure.

## Format you receive and return

Each chunk is a JSON array of items: `{ "id", "ctx", "kind", "en", "pt": "" }`.
- `ctx` = the page the string lives on (e.g. `/rewards/`). Use it to understand the context.
- `kind` = `html` (may contain inline tags), `title` (the browser tab title), `ld` (plain text for search-engine
  structured data), `attr:alt|title|placeholder|aria-label` (plain attribute text).
- Fill **`pt`** for every item. Never change `id`, `ctx`, `kind` or `en`. Never leave `pt` empty: if a string must
  stay identical (a brand, a ticker, a code word), copy `en` into `pt`.
- Write the whole array back to a sidecar file `NNN.pt.json` next to the chunk (same folder, same number) with the
  Write tool. Valid JSON only. Never edit the chunk file itself.

## Hard rules

1. **Keep every HTML tag, attribute, href, entity exactly as it is** (`<a href="/x/">`, `<b>`, `<code>`, `&amp;`,
   `<br>`). Translate only the text between tags. The set of tags in `pt` must equal the set in `en`.
2. **Never translate the inside of `<code>...</code>`**, URLs, paths (`/screener`), API field names, tickers
   (BTC, ETH, SOL, BTC/USDT), exchange names (Bybit, Binance, OKX, Gate, Bitget, MEXC, BingX, KuCoin, Kraken,
   Hyperliquid, Coinbase, Moon), numbers, currency amounts, percentages, `{placeholders}`, `%s`.
3. **Numbers stay exactly as written** (60,000 stays 60,000; 0.4% stays 0.4%; $11.99 stays $11.99). Live widgets
   print numbers in that format and the static text must match them. Do not convert to Brazilian punctuation.
4. Product names stay in English: **MarginPad, Paper Trade, MP Shop, Rekt, The Gold Room, Demo Spot, Meme Spot,
   Premium, Founder, Ticks, XP, Bot API, MCP, Daily Wrap, Happy Hour, Moon, Trading Report, Season Pass, Road to Bronze,
   Ask AI**. Common nouns around them are translated ("abra o Paper Trade", "na MP Shop").
5. **Você** (você / seu / sua / clique), never "tu", never "o senhor". Neutral Brazilian Portuguese: "celular" is fine,
   "computador" is fine; avoid European-only forms ("ecrã", "rato", "ficheiro"); say "tela", "mouse", "arquivo".
6. Portuguese accents and cedilla (ç, ã, õ, é, ê). Keep the quotes and dashes the English uses.
7. Titles (`kind: title`) should stay short (65 characters or fewer when possible) and keep the " | MarginPad" or
   " - MarginPad" suffix if present. Meta descriptions (`ld`, `attr`) 160 characters or fewer where the English is.
8. Buttons, labels, nav items and table headers must stay **short** (about the same length as the English).
9. Translate meaning, not words: idioms get a Portuguese idiom or plain wording. "actual price" is "preço real",
   never "preço atual" unless it means the current price.
10. Never leave a sentence half English. A stray English word in running text is a bug, except the glossary terms
    that stay in English: long, short, stop-loss, take-profit, funding, spread, slippage, maker, taker, drawdown,
    backtest, screener, trailing stop, wallet, exchange, trader, trading, paper trading, PnL, ROE, ROI, OI, DCA, APR,
    APY, swap, airdrop, rug, pump, dump, scalp, swing.
11. No emojis, ever, even if the English has none and the sentence sounds playful.

## Glossary (use these consistently)

| English | Portuguese |
|---|---|
| liquidation price | preço de liquidação |
| liquidation (event) / liquidations | liquidação / liquidações |
| get liquidated / liquidated | ser liquidado / liquidado |
| liquidation heatmap / map | mapa de calor de liquidações / mapa de liquidações |
| liquidations feed | feed de liquidações |
| leverage | alavancagem (75× stays 75×) |
| margin | margem |
| isolated / cross margin | margem isolada / margem cruzada |
| maintenance margin (rate) | margem de manutenção (taxa de) |
| initial margin | margem inicial |
| position / open position | posição / posição aberta |
| position size | tamanho da posição |
| notional (value) | valor nocional |
| long / short | long / short (um long, um short, posição long) |
| go long / go short | abrir um long / abrir um short |
| entry price / exit price | preço de entrada / preço de saída |
| stop-loss / take-profit | stop-loss / take-profit (o stop-loss) |
| market order / limit order / stop order | ordem a mercado / ordem limite / ordem stop |
| resting order | ordem pendente |
| fill / filled | execução / executada |
| order book | livro de ordens |
| fee / fees / taker fee / maker fee | taxa / taxas / taxa taker / taxa maker |
| funding rate / funding | taxa de funding / funding |
| open interest (OI) | interesse aberto (OI) |
| PnL / unrealized / realized | PnL / PnL não realizado / PnL realizado |
| break-even | ponto de equilíbrio (break-even) |
| risk/reward | risco/retorno |
| win rate | taxa de acerto |
| drawdown / max drawdown | drawdown / drawdown máximo |
| candle / candlestick | candle / candle |
| timeframe | tempo gráfico |
| chart | gráfico |
| support / resistance | suporte / resistência |
| breakout / pullback | rompimento / pullback |
| whale | baleia |
| leaderboard / board | ranking / tabela |
| season (14-day competition) | temporada |
| prize pool | prêmio total |
| claim (the faucet) | resgatar |
| withdrawal / withdraw | saque / sacar |
| reward / rewards | recompensa / recompensas |
| sign in / sign up / sign out | entrar / criar conta / sair |
| free, no sign-up | grátis, sem cadastro |
| paper trading (concept) | paper trading |
| simulator | simulador |
| academy / lesson / course | academia / lição / curso |
| mission (daily) | missão |
| streak | sequência |
| level (Bronze, Silver...) | nível (Bronze, Prata, Ouro, Platina, Diamante, Master, Lendário) |
| balance | saldo |
| wallet | carteira |
| exchange (noun) | corretora (exchange is also fine in running text) |
| settings | configurações |
| alert / price alert | alerta / alerta de preço |

## Tone
Direct, confident, no fluff, no exclamation marks the English does not have. Short sentences. A trader is reading
between two trades.
