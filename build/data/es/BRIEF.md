# MarginPad - Spanish translation brief (read fully before translating a chunk)

You are translating the text of **marginpad.io**, a free crypto-futures tools site (calculators, a paper-trading
terminal, charts, a liquidation feed, an academy, a rewards layer, a bot API) into **Spanish**. Readers are
Spanish-speaking futures traders in Latin America and Spain. The translation must read as if a Spanish-speaking
trader wrote it: correct context, natural phrasing, consistent terminology. Word-by-word output is a failure.

## Format you receive and return

Each chunk is a JSON array of items: `{ "id", "ctx", "kind", "en", "es": "" }`.
- `ctx` = the page the string lives on (e.g. `/blog/what-is-slippage/`). Use it to understand the context.
- `kind` = `html` (may contain inline tags), `title` (the browser tab title), `ld` (plain text for search-engine
  structured data), `attr:alt|title|placeholder|aria-label` (plain attribute text).
- Fill **`es`** for every item. Never change `id`, `ctx`, `kind` or `en`. Never leave `es` empty: if a string must
  stay identical (a brand, a ticker, a code word), copy `en` into `es`.
- Write the whole array back to the same file with the Write tool. Valid JSON only.

## Hard rules

1. **Keep every HTML tag, attribute, href, entity exactly as it is** (`<a href="/x/">`, `<b>`, `<code>`, `&amp;`,
   `<br>`). Translate only the text between tags. The set of tags in `es` must equal the set in `en`.
2. **Never translate the inside of `<code>…</code>`**, URLs, paths (`/screener`), API field names, tickers
   (BTC, ETH, SOL, BTC/USDT), exchange names (Bybit, Binance, OKX, Gate, Bitget, MEXC, KuCoin, Kraken,
   Hyperliquid, Coinbase, Moon), numbers, currency amounts, percentages, `{placeholders}`, `%s`.
3. **Numbers stay exactly as written** (60,000 stays 60,000; 0.4% stays 0.4%). Live widgets print numbers in
   that format and the static text must match them.
4. Product names stay in English: **MarginPad, Paper Trade, The Vault, Rekt, The Gold Room, Demo Spot,
   Premium, Founder, Ticks, XP, Bot API, MCP, Daily Wrap, Happy Hour, Moon, Trading Report**.
   Common nouns around them are translated ("abre Paper Trade", "en The Vault").
5. **Tuteo** (tú / tu / haz clic), never usted, never vos. Neutral Spanish: no "ordenador/computadora"
   (say "equipo" or "dispositivo"), no "celular" (say "teléfono" or "móvil"), no "coger", no "plata".
6. Spanish punctuation and accents: ¿…? ¡…! and proper tildes. Keep “ ” for quotes. Use the en dash and
   em dash as the English does.
7. Titles (`kind: title`) should stay short (≤ 65 characters when possible) and keep the " | MarginPad" or
   " - MarginPad" suffix if present. Meta descriptions (`ld`, `attr`) ≤ 160 characters where the English is.
8. Buttons, labels, nav items and table headers must stay **short** (about the same length as the English).
9. Translate meaning, not words: "game over" → "se acabó"; "nail every number" → "clava cada número" or
   "calcula cada número al detalle"; idioms get a Spanish idiom or plain wording. "actual price" is
   "precio real", never "precio actual" unless it means the current price.
10. Never leave a sentence half English. A stray English word in running text is a bug (except the glossary
    terms that stay in English: long, short, stop-loss, take-profit, funding, spread, slippage, maker, taker,
    drawdown, backtest, screener, trailing stop, wallet, exchange, trader, trading, paper trading, PnL, ROE,
    ROI, OI, DCA, APR, APY, swap, airdrop, rug, pump, dump).

## Glossary (use these consistently)

| English | Spanish |
|---|---|
| liquidation price | precio de liquidación |
| liquidation (event) / liquidations | liquidación / liquidaciones |
| get liquidated / liquidated | ser liquidado / liquidado |
| liquidation heatmap / map | mapa de calor de liquidaciones / mapa de liquidaciones |
| liquidations feed | feed de liquidaciones |
| leverage | apalancamiento (75× stays 75×) |
| margin | margen |
| isolated / cross margin | margen aislado / margen cruzado |
| maintenance margin (rate) | margen de mantenimiento (tasa de) |
| initial margin | margen inicial |
| position / open position | posición / posición abierta |
| position size | tamaño de posición |
| notional (value) | valor nocional |
| long / short (noun, adjective) | long / short (en long, un short, posición long) |
| go long / go short | abrir un long / abrir un short |
| entry price / exit price | precio de entrada / precio de salida |
| stop-loss / take-profit | stop-loss / take-profit (masculine: el stop-loss) |
| trailing stop | trailing stop |
| market order / limit order / stop order | orden a mercado / orden límite / orden stop |
| resting order | orden pendiente |
| fill / filled | ejecución / ejecutada |
| order book | libro de órdenes |
| fee / fees / taker fee / maker fee | comisión / comisiones / comisión taker / comisión maker |
| funding rate / funding | tasa de funding / funding |
| open interest (OI) | interés abierto (OI) |
| PnL / unrealized PnL / realized PnL | PnL / PnL no realizado / PnL realizado |
| ROE / ROI | ROE / ROI |
| break-even | punto de equilibrio (break-even) |
| risk/reward | riesgo/beneficio |
| win rate | tasa de acierto |
| drawdown / max drawdown | drawdown / drawdown máximo |
| slippage | slippage |
| spread | spread |
| candle / wick / close (of a candle) | vela / mecha / cierre |
| timeframe | temporalidad |
| chart / charts | gráfico / gráficos |
| indicator / signal | indicador / señal |
| screener | screener |
| perpetual futures / perps | futuros perpetuos / perpetuos |
| exchange | exchange (el exchange, los exchanges) |
| trade (noun) / trades | operación / operaciones (trade is acceptable in casual lines) |
| trade (verb) | operar |
| trader | trader |
| paper trading / paper trade | paper trading / operar en simulado |
| demo / simulator | demo / simulador |
| live price | precio en vivo |
| real-time | en tiempo real |
| no signup / no sign-up required | sin registro |
| free | gratis (gratuito as adjective) |
| sign in / sign up / log in | iniciar sesión / crear cuenta / iniciar sesión |
| account | cuenta |
| balance | saldo |
| deposit / withdraw / withdrawal | depositar / retirar / retiro |
| payout / payouts | pago / pagos |
| claim (rewards) | reclamar |
| rewards / faucet | recompensas / faucet |
| missions / daily missions | misiones / misiones diarias |
| streak | racha |
| level / level up | nivel / subir de nivel |
| season / season pass / pro pass | temporada / pase de temporada / pase Pro |
| leaderboard / board | clasificación / tabla |
| prize pool | bolsa de premios |
| duel / duels | duelo / duelos |
| badge / frame / background / skin | insignia / marco / fondo / skin |
| ticket (the trade card) | ticket |
| trading journal | diario de trading |
| trading report | informe de trading |
| whale / whales | ballena / ballenas |
| wallet | wallet |
| cash out | retirar a efectivo |
| gas (network fee) | gas |
| stablecoin | stablecoin |
| bull / bear market | mercado alcista / mercado bajista |
| volatility | volatilidad |
| backtest / backtester | backtest / backtester |
| API key | clave API |
| rate limit | límite de peticiones |
| endpoint | endpoint |
| webhook | webhook |
| bot | bot |
| agent (AI) | agente |
| push notification | notificación push |
| alert / price alert | alerta / alerta de precio |
| Fear & Greed index | índice Fear & Greed (miedo y codicia) |
| dominance | dominancia |
| market cap | capitalización |
| volume | volumen |
| Learn more / Read more | Más información / Leer más |
| Get started | Empezar |
| Try it / Try now | Pruébalo / Prueba ahora |
| Open (a trade) / Close | Abrir / Cerrar |
| Home | Inicio |
| Blog / Guides / Academy | Blog / Guías / Academia |
| Calculators | Calculadoras |
| Community | Comunidad |
| Settings | Ajustes |
| Search | Buscar |
| Loading… | Cargando… |
| Updated / Last updated | Actualizado / Última actualización |
| Coming soon | Próximamente |

Currency and formats stay: `$60,000`, `0.4%`, `75×`, `24h`, `1m / 5m / 1h / 4h / 1D`.

## Quality bar

Read your own output once after writing it. Fix anything that sounds translated: doubled prepositions,
"el mismo/la misma" as a pronoun, "en orden de", "realizar" for every verb, anglicised word order.
Vary verbs naturally. Prefer short sentences. A Spanish trader should not be able to tell it was translated.
