# MarginPad - Dutch (nl-NL) translation brief (read fully before translating a chunk)

You are translating the text of **marginpad.io**, a free crypto-futures tools site (calculators, a paper-trading
terminal, charts, a liquidation feed, an academy, a rewards layer, a bot API) into **Dutch**. Readers are
Dutch-speaking futures traders in the Netherlands and Flanders. The translation must read as if a Dutch crypto trader
wrote it: correct context, natural phrasing, consistent terminology. Word-by-word output is a failure.

The site already has Dutch text (the app-shell dictionary, the Demo Spot pack, the Academy, the Dutch homepage). This
brief is aligned with it: same form of address, same terms. Where that older text was inconsistent, this brief decides.

## Format you receive and return

Each chunk is a JSON array of items: `{ "id", "ctx", "kind", "en", "nl": "" }`.
- `ctx` = the page the string lives on (e.g. `/rewards/`). Use it to understand the context.
- `kind` = `html` (may contain inline tags), `title` (the browser tab title), `ld` (plain text for search-engine
  structured data), `attr:alt|title|placeholder|aria-label` (plain attribute text).
- Fill **`nl`** for every item. Never change `id`, `ctx`, `kind` or `en`. Never leave `nl` empty: if a string must
  stay identical (a brand, a ticker, a code word), copy `en` into `nl`.
- Write the whole array back to a sidecar file `NNN.nl.json` next to the chunk (same folder, same number) with the
  Write tool. Valid JSON only. Never edit the chunk file itself.

## Hard rules

1. **Keep every HTML tag, attribute, href, entity exactly as it is** (`<a href="/x/">`, `<b>`, `<code>`, `&amp;`,
   `<br>`). Translate only the text between tags. The set of tags in `nl` must equal the set in `en`.
   (`&#39;`/`&rsquo;` may be dropped only when the Dutch sentence genuinely has no apostrophe.)
2. **Never translate the inside of `<code>...</code>`**, URLs, paths (`/screener`), API field names, tickers
   (BTC, ETH, SOL, BTC/USDT), exchange names (Bybit, Binance, OKX, Gate, Bitget, MEXC, BingX, KuCoin, Kraken,
   Hyperliquid, Coinbase, Moon), numbers, currency amounts, percentages, `{placeholders}`, `%s`.
3. **Numbers stay exactly as written, in the English format with Western digits** (60,000 stays 60,000; 0.4% stays
   0.4%; $11.99 stays $11.99; never "0,4%", never "€", never "60.000"). Live widgets print numbers in that format and
   the static text must match them. Some older Dutch text on the site wrote "0,2%" - do not copy that.
   Unit and timeframe tokens stay as written: `24h`, `1m / 5m / 1h / 4h / 1D`, `75×`, `20x`.
4. Product names stay in English: **MarginPad, Paper Trade, MP Shop, Rekt, The Gold Room, Demo Spot, Meme Spot,
   Premium, Founder, Ticks, XP, Bot API, MCP, Daily Wrap, Happy Hour, Moon, Trading Report, Season Pass, Road to Bronze,
   Ask AI, My Trades, Bot Arena**. Common nouns around them are translated ("open Paper Trade", "in de MP Shop").
5. **Informal address: je / jij / jouw** (je / jouw / klik / open), never "u" or "uw". This is what the existing
   Dutch site text uses throughout (Demo Spot pack, Academy, app shell, homepage), and it is how Bitvavo, Bybit and
   Binance address Dutch traders. Use "je" by default; "jij"/"jouw" only for emphasis. Imperatives in the plain stem
   form: "Klik", "Open", "Kies", "Plak", "Log in".
6. Titles (`kind: title`) should stay short (about 65 characters when possible) and keep the " | MarginPad" or
   " - MarginPad" suffix if present. Meta descriptions (`ld`, `attr`) 160 characters or fewer where the English is.
7. Buttons, labels, nav items and table headers must stay **short** (about the same length as the English). Dutch
   runs longer than English - prefer the shorter synonym ("Fees" not "Transactiekosten" in a column header,
   "Opnemen" not "Geld opnemen" on a button).
8. Translate meaning, not words: idioms get a Dutch idiom or plain wording. "actual price" is "werkelijke prijs",
   never "actuele prijs" unless it means the current price.
9. Never leave a sentence half English. A stray English word in running text is a bug, except the glossary terms
   that stay in English: long, short, stop-loss, take-profit, entry, exit, funding, funding rate, open interest, spread,
   slippage, maker, taker, drawdown, backtest, screener, heatmap, trailing stop, wallet, exchange, trader, trade,
   traden, paper trading, PnL, ROE, ROI, OI, DCA, APR, APY, swap, airdrop, rug, pump, dump, scalp, swing, perp,
   mark price, squeeze, whale, candle, wick, timeframe, breakout is NOT one of them (say "uitbraak"). These are
   lowercase in running text unless they start a sentence or a label.
10. No emojis, ever, even if the sentence sounds playful.

## Which trading terms stay English in Dutch

Dutch futures traders, Bitvavo, Binance NL and Bybit NL keep most derivatives jargon in English and translate the
everyday financial words. The rule of thumb, matching the site's existing Dutch:
- **Stays English**: long, short, stop-loss, take-profit, trailing stop, entry, exit, funding rate, open interest,
  isolated margin, cross margin, mark price, spread, slippage, maker/taker, drawdown, candle, wick, timeframe,
  whale, wallet, exchange, heatmap, screener, tape, feed, faucet, backtest, perp, pump, dump, rug, scalp, swing.
- **Translated**: leverage = hefboom, margin = marge, liquidation = liquidatie, position = positie, order book =
  orderboek, market/limit order = marktorder/limietorder, support/resistance = steun/weerstand, breakout = uitbraak,
  chart = grafiek, leaderboard = ranglijst, season = seizoen, reward = beloning, withdrawal = opname, balance = saldo,
  settings = instellingen, lesson = les, course = cursus, mission = missie, streak = reeks.

English nouns take Dutch articles and Dutch plurals: **de trade / trades, de exchange / exchanges, de wallet /
wallets, de candle / candles, de stop-loss / stop-losses, de fee / fees, de whale / whales, de screener, de heatmap,
de feed, de tape, de PnL, het account / accounts, het orderboek**. English verbs are conjugated as Dutch:
**traden - ik trade, je tradet, hij tradet, getradet; claimen - geclaimd; checken - gecheckt.**

## Glossary (use these consistently)

| English | Dutch |
|---|---|
| liquidation price | liquidatieprijs |
| liquidation (event) / liquidations | liquidatie / liquidaties |
| get liquidated / liquidated | geliquideerd worden / geliquideerd |
| liquidation heatmap | liquidatie-heatmap |
| liquidation map | liquidatiekaart |
| liquidations feed | liquidatiefeed |
| leverage | hefboom ("met 20x hefboom"; 75× stays 75×) |
| high-leverage traders | traders met hoge hefboom |
| margin | marge |
| isolated / cross margin | isolated margin / cross margin |
| maintenance margin (rate) | onderhoudsmarge (onderhoudsmargepercentage) |
| initial margin | initiële marge |
| position / open position | positie / open positie |
| position size | positiegrootte |
| notional (value) | notionele waarde |
| long / short (noun, adjective) | long / short (een long, een short, longpositie, shortpositie) |
| go long / go short | long gaan / short gaan |
| entry / entry price | entry / entryprijs |
| exit / exit price | exit / exitprijs |
| stop-loss / take-profit | stop-loss / take-profit (de stop-loss, stop-lossprijs, take-profitprijs) |
| trailing stop | trailing stop |
| market order / limit order / stop order | marktorder / limietorder / stoporder |
| resting order | openstaande order |
| fill / filled | uitvoering / uitgevoerd |
| order book | orderboek |
| tape (trade prints) | tape |
| fee / fees | fee / fees (kosten for costs in general) |
| taker fee / maker fee | taker fee / maker fee |
| funding rate / funding | funding rate / funding |
| open interest (OI) | open interest (OI) |
| mark price / index price | mark price / indexprijs |
| PnL / unrealized / realized | PnL / niet-gerealiseerde PnL / gerealiseerde PnL |
| ROE / ROI | ROE / ROI |
| break-even | break-even |
| risk/reward (R:R) | risico/rendement (R:R) |
| win rate | winrate |
| drawdown / max drawdown | drawdown / maximale drawdown |
| slippage / spread | slippage / spread |
| candle / candlestick / wick | candle / candlestick / wick |
| timeframe | timeframe |
| chart / charts | grafiek / grafieken (the /charts product label stays "Charts") |
| indicator / signal | indicator / signaal |
| support / resistance | steun / weerstand |
| breakout / pullback | uitbraak / pullback |
| trend / uptrend / downtrend | trend / uptrend / downtrend |
| volatility | volatiliteit |
| volume | volume |
| liquidity / pool | liquiditeit / pool |
| market cap | marktkapitalisatie (mcap in tight labels) |
| dominance | dominantie |
| bull / bear market | bullmarkt / bearmarkt |
| Fear & Greed index | Fear & Greed-index |
| perpetual futures / perps | perpetual futures / perps |
| whale / whales | whale / whales |
| trade (noun) / trades | trade / trades |
| trade (verb) | traden |
| trader | trader |
| paper trading (concept) | paper trading |
| paper trade (noun) | paper trade (product name "Paper Trade" stays) |
| demo account | demo-account |
| demo money | demogeld |
| simulator | simulator |
| calculator / calculators | calculator / calculators |
| heatmap | heatmap |
| screener | screener |
| live price | live prijs |
| real-time | realtime |
| leaderboard / board | ranglijst |
| season (14-day competition) | seizoen |
| season pass / pro pass | Season Pass / Pro-pass |
| prize pool | prijzenpot |
| prize | prijs |
| duel / duels | duel / duels |
| reward / rewards | beloning / beloningen (the page name "Rewards" and "rewards-saldo" stay) |
| faucet | faucet |
| claim (the faucet) | claimen (button "Claim") |
| withdrawal / withdraw | opname / opnemen |
| payout / payouts | uitbetaling / uitbetalingen |
| deposit | storting / storten |
| balance | saldo |
| wallet | wallet |
| exchange (noun) | exchange (de exchange); "beurs" only for a stock exchange |
| sign in / log in | inloggen (button "Inloggen" / "Log in") |
| sign up | registreren / account aanmaken |
| sign out | uitloggen |
| free, no sign-up | gratis, zonder registratie |
| account | account (het account) |
| username | gebruikersnaam |
| email | e-mail / e-mailadres |
| settings | instellingen |
| alert / price alert | alert / prijsalert |
| notification / push notification | melding / pushmelding |
| academy / lesson / course | Academy (section name) / les / cursus |
| quiz | quiz |
| mission (daily) | missie (dagelijkse missie) |
| streak | reeks |
| level / level up | niveau / een niveau omhoog |
| levels (Bronze, Silver...) | Brons, Zilver, Goud, Platina, Diamant, Master, Legendarisch |
| badge / frame / background / skin | badge / frame / achtergrond / skin |
| ticket (the trade card) | ticket |
| trading journal | tradingjournal |
| backtest / backtester | backtest / backtester |
| API key | API-key |
| rate limit | rate limit |
| endpoint / webhook / bot | endpoint / webhook / bot |
| agent (AI) | agent |
| stablecoin / gas | stablecoin / gas |
| contract address | contractadres |
| meme coin | meme coin |
| Home (nav / breadcrumb) | Home |
| Guides / Blog / Community | Gidsen / Blog / Community |
| Learn more / Read more | Meer info / Lees meer |
| Get started | Aan de slag |
| Try it / Try now | Probeer het / Probeer nu |
| Open (a trade) / Close | Openen / Sluiten |
| Search | Zoeken |
| Loading... | Laden... |
| Updated / Last updated | Bijgewerkt / Laatst bijgewerkt |
| Coming soon | Binnenkort |
| Not financial advice | Geen financieel advies |

## Dutch spelling and typography

- **Compounds are one word.** A Dutch compound never splits into two loose words: liquidatieprijs, positiegrootte,
  orderboek, ranglijst, demogeld, contractadres, seizoenswinst. When an English term joins a Dutch word, write it
  together if readable ("entryprijs", "stop-lossprijs", "tradingjournal") and use a hyphen when it is not, when a
  capital or abbreviation is involved, or when two vowels clash: "API-key", "BTC-positie", "Fear & Greed-index",
  "demo-account", "rewards-saldo", "USDT-saldo". Multi-word English terms that stay English keep their spaces
  ("funding rate", "open interest", "trailing stop", "taker fee") - rephrase rather than build a monster compound.
- Diacritics: één (for emphasis/the number one), geïsoleerd, reëel, ideeën, financiële, initiële, bèta. Use the
  trema where Dutch requires it; never drop it.
- Plurals of English words: -s (trades, candles, fees, whales, stop-losses). Words ending in a long vowel take an
  apostrophe: demo's, pagina's, video's.
- Sentence case for headings and buttons - Dutch does not capitalise every word ("Hoe liquidatie werkt", not "Hoe
  Liquidatie Werkt"). Days and months lowercase (maandag, november).
- Keep the quotes and dashes exactly as the English has them (straight quotes stay straight, " - " stays " - ").
  Do not introduce „Dutch low quotes". No non-breaking-space tricks.
- Time: keep "UTC" and the 24h clock as written ("00:00 UTC", "16:00 UTC"). "middernacht UTC" is fine in prose.
- Currency: "$100" stays before the amount, no space. "USDT" after the number with a space ("5 USDT").

## Common mistakes to avoid (they make it read machine-translated)

- "u"/"uw" anywhere - always je/jouw.
- Calques: "dat maakt sense" (-> "dat is logisch"), "in termen van" (-> "qua" / rephrase), "aan het einde van de dag"
  as an idiom (-> "uiteindelijk"), "het is aan jou" overused, "realiseren" for every verb, "gebaseerd op" in every
  sentence (-> "op basis van" / rephrase), "een beslissing nemen" fine but not "een actie nemen" (-> "iets doen").
- English word order: put the verb in second position in main clauses and at the end in subordinate clauses
  ("Als de prijs je stop raakt, sluit de positie" - not "Als de prijs raakt je stop").
- Splitting compounds ("liquidatie prijs", "positie grootte", "order boek") - always joined.
- Wrong articles on loanwords: de trade, de exchange, de wallet, de heatmap, de feed, het account, het orderboek.
- Over-formal or bureaucratic register ("teneinde", "dienen te", "middels", "derhalve") - this is a trader's site.
- Translating product names (Paper Trade, MP Shop, The Gold Room, Road to Bronze stay English).
- Mixing synonyms: one term per concept from the glossary - marge (not "margin" in running text), winrate (not
  "winratio" or "slagingspercentage"), reeks (not "streak"), ranglijst (not "leaderboard"), grafiek (not "chart").
- Converting numbers to Dutch format ("0,4%", "$60.000") - forbidden, see hard rule 3.
- Exclamation marks the English does not have; "Super!" / "Geweldig!" filler.

## Tone
Direct, confident, no fluff, no exclamation marks the English does not have. Short sentences. A trader is reading
between two trades.
