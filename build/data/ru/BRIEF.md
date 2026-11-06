# MarginPad - Russian (ru-RU) translation brief (read fully before translating a chunk)

You are translating the text of **marginpad.io**, a free crypto-futures tools site (calculators, a paper-trading
terminal, charts, a liquidation feed, an academy, a rewards layer, a bot API) into **Russian**. Readers are
Russian-speaking futures traders in Russia, Ukraine, Kazakhstan, Belarus and the wider CIS. The translation must read
as if a Russian crypto trader wrote it: correct context, natural phrasing, consistent terminology, the vocabulary of
Bybit/Binance/OKX Russian interfaces and of Russian crypto Telegram. Word-by-word output is a failure.

The site already carries Russian text (the Russian homepage `/ru/`, the Academy lessons, Demo Spot, the calculators'
dictionary). Your output must sit beside that text without a seam: same form of address, same terms, same tone. The
glossary below was built from it.

## Format you receive and return

Each chunk is a JSON array of items: `{ "id", "ctx", "kind", "en", "ru": "" }`.
- `ctx` = the page the string lives on (e.g. `/rewards/`). Use it to understand the context.
- `kind` = `html` (may contain inline tags), `title` (the browser tab title), `ld` (plain text for search-engine
  structured data), `attr:alt|title|placeholder|aria-label` (plain attribute text).
- Fill **`ru`** for every item. Never change `id`, `ctx`, `kind` or `en`. Never leave `ru` empty: if a string must
  stay identical (a brand, a ticker, a code word), copy `en` into `ru`.
- Write the whole array back to a sidecar file `NNN.ru.json` next to the chunk (same folder, same number) with the
  Write tool. Valid JSON only (escape `"` inside strings as `\"`; Russian «ёлочки» need no escaping). Never edit the
  chunk file itself.

## Hard rules

1. **Keep every HTML tag, attribute, href, entity exactly as it is** (`<a href="/x/">`, `<b>`, `<code>`, `&amp;`,
   `<br>`). Translate only the text between tags. The set of tags in `ru` must equal the set in `en`. Russian word
   order may move a tagged phrase inside the sentence; the tag travels with its phrase, it is never dropped or split.
   (`&#39;`/`&rsquo;` may be dropped only when the Russian sentence genuinely has no apostrophe - which is almost
   always.)
2. **Never translate the inside of `<code>...</code>`**, URLs, paths (`/screener`), API field names, tickers
   (BTC, ETH, SOL, BTC/USDT), exchange names (Bybit, Binance, OKX, Gate, Bitget, MEXC, BingX, KuCoin, Kraken,
   Hyperliquid, Coinbase, Moon), numbers, currency amounts, percentages, `{placeholders}`, `%s`. Exchange names stay
   in Latin script and are not declined with Cyrillic endings ("на Bybit", "через Binance", never "на Байбите").
3. **Numbers stay exactly as written**: 60,000 stays 60,000 (not 60 000); 0.4% stays 0.4% (not 0,4 %); $11.99 stays
   $11.99 (not 11,99 $); 75× stays 75×; 24h stays as the English writes it unless the glossary below gives the Russian
   unit (`24h` -> `24 ч` only in running text, never inside a figure a widget prints). Live widgets print numbers in
   the English format and the static text must match them. Western digits only.
4. Product names stay in English, in Latin script: **MarginPad, Paper Trade, MP Shop, Rekt, The Gold Room, Demo Spot,
   Meme Spot, Premium, Founder, Ticks, XP, Bot API, MCP, Daily Wrap, Happy Hour, Moon, Trading Report, Season Pass,
   Road to Bronze, Ask AI, My Trades, Bot Arena, King of the Moon, What moved it**. They are not declined (no "в Paper
   Trade-е"); build the sentence around them with a common noun when a case is needed: "открой терминал Paper Trade",
   "в магазине MP Shop", "подписка Premium", "твои Ticks", "+25 XP".
5. **Address the reader as «ты»** (ты / твой / твоя / нажми / открой / попробуй), never «вы». This is the register the
   existing Russian site uses (homepage: "Торгуй как по-настоящему", Academy: "Ты никогда не владеешь биткоином",
   Demo Spot: "попробуй ещё раз") and the register of Russian crypto products and trader Telegram. «ты» is lowercase,
   always. Imperatives are second person singular ("нажми", "выбери", "введи"), never the plural "нажмите". (The old
   calculator dictionary has a few «вы» lines - they are legacy, do not copy them.)
6. Use **ё** where it belongs (ещё, всё, её, счёт, твоё, растёт, падёт) - the existing site writes it. Keep the
   English's dashes: a spaced hyphen ` - ` in the English stays ` - ` (the site uses it as a dash everywhere; do not
   switch to — or –). Quotes: use Russian «ёлочки» for quoted words and button names in running text ("Нажми
   «Забрать»"); keep the English quote characters only inside `<code>` or where the English string is itself a quoted
   UI token that must match code.
7. Titles (`kind: title`) should stay short (about 65 characters when possible) and keep the " | MarginPad" or
   " - MarginPad" suffix if present. Meta descriptions (`ld`, `attr`) 160 characters or fewer where the English is.
   Russian runs 10-25% longer than English - cut filler words, never cut facts or figures.
8. Buttons, labels, nav items, chips and table headers must stay **short** (about the same length as the English).
   Prefer the short form: "Вход" / "Войти" not "Выполнить вход", "Сделки" not "Мои торговые операции", standard
   abbreviations are fine in tight labels ("изолир.", "необяз.", "сред.", "ч", "мин", "сек"). A button is an
   imperative verb ("Открыть", "Забрать $100") or a noun, never a full sentence.
9. Translate meaning, not words: idioms get a Russian idiom or plain wording. "actual price" is "реальная цена",
   never "актуальная цена" unless it means the current price. "Game over" -> "конец игры" or "всё, приехали" by tone.
10. Never leave a sentence half English. A stray English word in running text is a bug, except: product names (rule
    4), tickers, exchange names, and the abbreviations that Russian traders write in Latin: **PnL, ROE, ROI, OI, DCA,
    APR, APY, SL, TP, TradFi, KYC, API, USDT, P2P, UTC, FOMC, CPI**. Everything else in the trader vocabulary is
    written **in Cyrillic** the way Russian traders say it: лонг, шорт, стоп-лосс, тейк-профит, фандинг, спред,
    скринер, трейлинг-стоп, мейкер, тейкер, бэктест, трейдер, трейдинг, своп, аирдроп, памп, дамп, скальпинг, свинг,
    перп, шорт-сквиз, ликвидность, волатильность. Do not write "long"/"short" in Latin inside Russian text (the site
    uses «лонг/шорт», uppercase «ЛОНГ/ШОРТ» on badges).
11. No emojis, ever, even if the sentence sounds playful.
12. Gender and case agreement must be right for the noun you chose (стоп-лосс - masculine; маржа - feminine;
    плечо - neuter; ставка фандинга - feminine; PnL - masculine, "нереализованный PnL"; XP - masculine plural-like,
    write "+25 XP", "получи XP"). Numbers with nouns follow Russian agreement where the noun is Russian ("3 сделки",
    "5 сделок", "1 сделка", "21 день"); when the number is a `{placeholder}` and you cannot know it, choose a
    construction that avoids agreement ("сделок: {n}", "Сделки: {n}", "{n} шт." only where a counter fits).

## Glossary (use these consistently)

| English | Russian |
|---|---|
| liquidation price | цена ликвидации |
| liquidation (event) / liquidations | ликвидация / ликвидации |
| get liquidated / liquidated | получить ликвидацию, быть ликвидированным / ликвидирован |
| liquidation heatmap / map | тепловая карта ликвидаций / карта ликвидаций |
| liquidations feed | лента ликвидаций |
| cascade (of liquidations) | каскад ликвидаций |
| leverage | плечо (кредитное плечо on first mention in prose); 75× stays 75× |
| margin | маржа |
| isolated / cross margin | изолированная маржа / кросс-маржа |
| maintenance margin (rate) | поддерживающая маржа (ставка поддерживающей маржи) |
| initial margin | начальная маржа |
| margin call | маржин-колл |
| position / open position | позиция / открытая позиция |
| position size | размер позиции |
| notional (value) | номинальная стоимость (номинал) |
| long / short (noun, adjective) | лонг / шорт (лонг-позиция, шорт-позиция; badge: ЛОНГ / ШОРТ) |
| go long / go short | открыть лонг / открыть шорт (войти в лонг) |
| entry / entry price | вход / цена входа |
| exit / exit price | выход / цена выхода |
| stop-loss | стоп-лосс (masc.) |
| take-profit | тейк-профит (masc.) |
| trailing stop | трейлинг-стоп |
| market order | рыночный ордер |
| limit order | лимитный ордер |
| stop order / stop entry | стоп-ордер / стоп-вход |
| resting order / pending order | отложенный ордер |
| fill / filled / partial fill | исполнение / исполнен / частичное исполнение |
| slippage | проскальзывание |
| spread | спред |
| order book | стакан (биржевой стакан) |
| tape (trade tape) | лента сделок |
| fee / fees | комиссия / комиссии |
| taker fee / maker fee | комиссия тейкера / комиссия мейкера |
| funding rate / funding | ставка фандинга / фандинг |
| open interest (OI) | открытый интерес (OI) |
| mark price | маркировочная цена (mark price) |
| PnL / unrealized PnL / realized PnL | PnL / нереализованный PnL / реализованный PnL |
| profit / loss | прибыль / убыток |
| ROE / ROI | ROE / ROI |
| break-even | безубыток (точка безубыточности) |
| risk/reward | соотношение риск/прибыль |
| win rate | винрейт (доля прибыльных сделок when it must be explained) |
| drawdown / max drawdown | просадка / максимальная просадка |
| candle / candlestick | свеча / свечной график |
| wick | тень (фитиль in casual lines) |
| close (of a candle) | закрытие |
| timeframe | таймфрейм |
| chart / charts | график / графики |
| indicator / signal | индикатор / сигнал |
| support / resistance | поддержка / сопротивление |
| breakout / pullback | пробой / откат |
| trend / range | тренд / боковик (флэт) |
| volatility / liquidity | волатильность / ликвидность |
| volume | объём |
| perpetual futures / perps | бессрочные фьючерсы / перпы |
| futures / spot | фьючерсы / спот |
| exchange (noun) | биржа |
| trade (noun) / trades | сделка / сделки |
| trade (verb) | торговать |
| trader / trading | трейдер / трейдинг (торговля in plain prose) |
| paper trading (concept) | демо-торговля (бумажная торговля only in the Academy's explanatory prose) |
| paper trade (a simulated trade) | демо-сделка |
| demo account | демо-счёт |
| simulator | симулятор |
| calculator / calculators | калькулятор / калькуляторы |
| heatmap | тепловая карта |
| screener | скринер |
| whale / whales | кит / киты |
| whale tracker | трекер китов |
| live price | живая цена (цена в реальном времени) |
| real-time / live | в реальном времени / live (badge) |
| backtest / backtester | бэктест / бэктестер |
| trading journal | дневник трейдера (торговый журнал) |
| season (14-day competition) | сезон |
| season pass / pro pass | Season Pass / Pro-пропуск |
| leaderboard / board | рейтинг / таблица (таблица лидеров in a heading if needed) |
| prize pool | призовой фонд |
| competition | турнир (соревнование) |
| duel / duels | дуэль / дуэли |
| reward / rewards | награда / награды |
| faucet | кран (крипто-кран) |
| claim (the faucet / a reward) | забрать |
| mission / daily missions | миссия / ежедневные миссии |
| streak | серия (серия дней, серия побед) |
| level / level up | уровень / повысить уровень (новый уровень) |
| levels (Bronze, Silver, Gold, Platinum, Diamond, Master, Legendary) | Бронза, Серебро, Золото, Платина, Алмаз, Мастер, Легенда |
| badge / frame / background / skin | значок / рамка / фон / скин |
| ticket (the trade card) | тикет |
| balance | баланс |
| deposit | депозит / пополнить |
| withdrawal / withdraw | вывод / вывести |
| payout / payouts | выплата / выплаты |
| wallet | кошелёк |
| gas (network fee) | газ (комиссия сети) |
| stablecoin | стейблкоин |
| memecoin | мемкоин |
| altcoin | альткоин |
| bull / bear market | бычий рынок / медвежий рынок |
| pump / dump / rug | памп / дамп / раг (скам-раг) |
| sign in / log in | войти / вход |
| sign up | зарегистрироваться / регистрация (create account: создать аккаунт) |
| sign out | выйти |
| free, no sign-up | бесплатно, без регистрации |
| account (the user's MarginPad login) | аккаунт |
| account (a trading or balance account, a venue account) | счёт |
| username | имя пользователя (ник in casual lines) |
| settings | настройки |
| alert / price alert | алерт / ценовой алерт (оповещение in formal UI labels) |
| push notification | push-уведомление |
| notifications | уведомления |
| API key | API-ключ |
| rate limit | лимит запросов |
| endpoint / webhook | эндпоинт / вебхук |
| bot / agent (AI) | бот / агент |
| academy / lesson / course | академия / урок / курс |
| quiz / exam | тест / экзамен |
| guide / guides | гайд / гайды |
| blog | блог |
| community | сообщество |
| Fear & Greed index | индекс страха и жадности |
| dominance | доминация |
| market cap | капитализация |
| Home (breadcrumb / nav) | Главная |
| Search | Поиск |
| Loading... | Загрузка... |
| Updated / Last updated | Обновлено / Последнее обновление |
| Coming soon | Скоро |
| Learn more / Read more | Подробнее / Читать далее |
| Get started | Начать |
| Try it / Try now | Попробуй / Попробовать |
| Open (a trade) / Close | Открыть / Закрыть |
| Show all | Показать все |

Currency and formats stay: `$60,000`, `0.4%`, `75×`, `1m / 5m / 1h / 4h / 1D` (timeframe tokens stay in Latin).

## Script and typography (Russian-specific)

- **Quotes**: «ёлочки» for quotes in running Russian text; „лапки“ only for a quote inside a quote. Never mix in
  English “ ” in a Russian sentence unless the English item has them around code or a literal value.
- **Dashes**: copy the English's ` - ` as ` - `. Do not introduce new dashes; Russian uses a dash where English uses
  "is" ("Биткоин - крупнейшая монета"), which is fine and natural.
- **Hyphenated compounds** are written with a hyphen: стоп-лосс, тейк-профит, трейлинг-стоп, кросс-маржа, демо-счёт,
  демо-торговля, крипто-календарь, API-ключ, push-уведомление, топ-10, 24-часовой.
- **Capitalisation**: only the first word of a heading or button is capitalised ("Цена ликвидации", not "Цена
  Ликвидации"); English Title Case is NOT copied. Months and weekdays are lowercase ("в понедельник", "1 октября").
  ALL-CAPS badges in the English stay ALL-CAPS in Russian (LIVE may stay LIVE).
- **Comma rules**: Russian requires commas before что/который/чтобы/если/когда-clauses and around participial and
  adverbial phrases. Add them even where the English has none.
- **Abbreviations**: ч (hours), мин, сек, тыс., млн, млрд in prose only; a figure produced by code (`$1.2M`, `24h`)
  stays exactly as the English writes it.
- **No space before %** - keep the English form `0.4%`. The `$` stays before the number.
- `ё` is written, not replaced with `е`.

## Common mistakes to avoid (they mark a text as machine-translated)

- **Calques of English word order and articles**: "Это есть калькулятор" / "Ваш PnL будет показан" - say "Калькулятор
  покажет твой PnL".
- **Passive voice and "является"/"осуществлять"/"производить"** for every verb: "Расчёт осуществляется" -> "Считаем",
  "Ликвидация производится" -> "Позицию ликвидируют". Use active, short verbs.
- **«вы» creeping in** from a formal machine default, or mixing «ты» and «вы» in one string. Always «ты».
- **Literal idioms**: "nail every number" is not "прибей каждую цифру" - "посчитай каждую цифру точно".
- **False friends**: "актуальный" (= current, not "actual"); "аккуратный" (= neat, not "accurate" - use "точный");
  "фабрика"; "декада" (= 10 days, not a decade); "симпатичный"; "компания" vs "кампания" (campaign = кампания);
  "billion" = миллиард (млрд), NEVER "биллион"; "trillion" = триллион.
- **Latin trader words in Cyrillic text**: "открой long", "твой stop-loss" - must be "открой лонг", "твой стоп-лосс".
- **Translating product names or declining them**: "Бумажная Торговля" for Paper Trade, "в Магазине MP", "Гольд Рум".
- **Changing figures**: 60,000 -> 60 000, $11.99 -> 11,99 $, 0.4% -> 0,4 %. The widgets print the English format.
- **Over-long buttons and labels** that break the layout on a 390px phone.
- **Exclamation marks** the English does not have, and marketing filler ("уникальный", "инновационный", "лучший в
  своём роде").
- **"Сделать трейд"/"совершить торговлю"** - say "открыть сделку", "закрыть позицию", "торговать".
- **Wrong gender after a borrowed noun** ("твоя стоп-лосс", "этот маржа").

## Tone

Direct, confident, no fluff, no exclamation marks the English does not have. Short sentences. A trader is reading
between two trades. The voice is a competent friend at the next screen, not a bank and not a meme channel.

## Quality bar

Read your own output once after writing it. Fix anything that sounds translated: anglicised word order, chains of
genitives ("размер позиции трейдера счёта"), "который" stacked twice in one sentence, every sentence starting the
same way. A Russian trader should not be able to tell it was translated.
