# MarginPad - Arabic (ar, Modern Standard Arabic, right-to-left) translation brief (read fully before translating a chunk)

You are translating the text of **marginpad.io**, a free crypto-futures tools site (calculators, a paper-trading
terminal, charts, a liquidation feed, an academy, a rewards layer, a bot API) into **Modern Standard Arabic (فصحى
معاصرة)**. Readers are Arabic-speaking futures traders across the Gulf, Egypt, the Levant and North Africa. The
translation must read as if an Arab crypto trader wrote it: correct context, natural modern phrasing, consistent
terminology. Word-by-word output is a failure. Dialect is a failure too: write clean, modern MSA that every Arab reader
understands, the register of Binance Arabic, Bybit Arabic and the Arabic crypto press - not classical, not colloquial.

## Format you receive and return

Each chunk is a JSON array of items: `{ "id", "ctx", "kind", "en", "ar": "" }`.
- `ctx` = the page the string lives on (e.g. `/rewards/`). Use it to understand the context.
- `kind` = `html` (may contain inline tags), `title` (the browser tab title), `ld` (plain text for search-engine
  structured data), `attr:alt|title|placeholder|aria-label` (plain attribute text).
- Fill **`ar`** for every item. Never change `id`, `ctx`, `kind` or `en`. Never leave `ar` empty: if a string must
  stay identical (a brand, a ticker, a code word), copy `en` into `ar`.
- Write the whole array back to a sidecar file `NNN.ar.json` next to the chunk (same folder, same number) with the
  Write tool. Valid JSON only (escape `"` inside strings as `\"`; Arabic needs no other escaping). Never edit the
  chunk file itself.

## Hard rules

1. **Keep every HTML tag, attribute, href, entity exactly as it is** (`<a href="/x/">`, `<b>`, `<code>`, `&amp;`,
   `<br>`). Translate only the text between tags. The set of tags in `ar` must equal the set in `en`, and **the tags
   keep their logical order** - the browser does the right-to-left layout; you never reorder, mirror or reverse tags,
   and you never move a tag to "look right" in your editor. (`&#39;`/`&rsquo;` may be dropped only when the Arabic
   sentence genuinely has no apostrophe.) Arabic word order may move a bolded phrase within the sentence, but the
   phrase stays wrapped in the same tag.
2. **Never translate the inside of `<code>...</code>`**, URLs, paths (`/screener`), API field names, tickers
   (BTC, ETH, SOL, BTC/USDT), exchange names (Bybit, Binance, OKX, Gate, Bitget, MEXC, BingX, KuCoin, Kraken,
   Hyperliquid, Coinbase, Moon), numbers, currency amounts, percentages, `{placeholders}`, `%s`.
3. **Numbers stay exactly as written, in Western digits** (60,000 stays 60,000; 0.4% stays 0.4%; $11.99 stays
   $11.99; 75× stays 75×; 24h stays 24h inside data labels). **Never use Eastern Arabic digits (٠١٢٣ / ٤٥٦) and never
   the Arabic decimal or thousands separators (٫ ٬) or the Arabic percent sign (٪).** Live widgets print numbers in
   the Western format and the static text must match them. The `$` stays before the number (`$100`, not `100 $` and
   not "100 دولار" when the English has `$100`). In running prose where the English spells a word ("ten trades") you
   may spell it in Arabic ("عشر صفقات").
4. Product names stay in English, in Latin letters: **MarginPad, Paper Trade, MP Shop, Rekt, The Gold Room, Demo Spot,
   Meme Spot, Premium, Founder, Ticks, XP, Bot API, MCP, Daily Wrap, Happy Hour, Moon, Trading Report, Season Pass,
   Road to Bronze, Ask AI, My Trades, Bot Arena**. Common nouns around them are translated ("افتح Paper Trade",
   "في MP Shop", "اشترك في Premium"). Write the Arabic letter that attaches to the name as a separate letter before
   it, no space: "بـ Premium" is wrong; write "بـPremium" or rephrase ("باشتراك Premium"). Prefer "في" / "على" / "إلى"
   + a space + the Latin name, which never breaks.
5. **Form of address: the second person masculine singular, direct and informal-polite** (أنت، افتح، اضغط، سجّل
   الدخول، رصيدك، صفقتك) - exactly what the existing Arabic text on the site uses (the academy packs, `/spot/`, the
   homepage, the app dictionary: "سجّل الدخول للبدء"، "افتح صفقة تجريبية"، "اختر عملة"). Never "حضرتك"/"سيادتكم",
   never the plural "أنتم/افتحوا", never feminine forms, never the passive-impersonal "يُرجى من المستخدم" where the
   English talks to the reader. "يُرجى" is acceptable only in formal notices (privacy, terms, errors) where the
   English is formal. Imperatives on buttons: "ابدأ"، "افتح"، "سجّل الدخول"، "استلم".
6. **Script and typography** (see the full section below): Arabic comma "،", Arabic semicolon "؛", Arabic question
   mark "؟". Full stop stays ".". Keep the dashes the English uses ("-" stays "-"). Quotes: use «...» in running
   Arabic text; keep the English straight quotes `"` only inside code, attributes and JSON. Latin tickers and brand
   names stay Latin and are never transliterated (BTC, not بي تي سي; Bybit, not بايبت).
7. Titles (`kind: title`) should stay short (about 60 characters when possible) and keep the " | MarginPad" or
   " - MarginPad" suffix if present (the suffix stays at the logical end of the string). Meta descriptions (`ld`,
   `attr`) 160 characters or fewer where the English is.
8. Buttons, labels, nav items and table headers must stay **short** (about the same length as the English or
   shorter). Arabic can be compact - prefer the verbal noun or the imperative, drop "الخاص بك" where "ـك" does the job
   ("رصيدك" not "الرصيد الخاص بك").
9. Translate meaning, not words: idioms get an Arabic idiom or plain wording. "actual price" is "السعر الفعلي",
   never "السعر الحالي" unless it means the current price.
10. Never leave a sentence half English. A stray English word in running text is a bug, except the terms below that
    stay in Latin letters as Arab traders write them: **PnL, ROE, ROI, OI, DCA, APR, APY, KYC, USDT, P&L, API, FDV,
    TVL, DeFi, CPI, FOMC, UTC**, plus product names and tickers. Some trader jargon is written in Arabic letters
    (see the glossary: لونغ، شورت، سبريد، سكالبينغ، إيردروب، باكتست)  - that is Arabic text, not English.
11. No emojis, ever, even if the sentence sounds playful.
12. **Use one spelling consistently**: tanwin on the letter before the alif (أبدًا، مجانًا، يوميًا, NOT أبداً). Hamza
    correct (إلى، أكثر، مؤشر، تنبؤ). Shadda only where it disambiguates or is customary in UI ("سجّل"، "تُحتسب"،
    "مُفعّل") - do not vocalise whole sentences.

## Which terms stay in English (Latin) and which are translated

Arab futures traders and the big exchanges' Arabic sites (Binance, Bybit, OKX Arabic) translate most terms into
Arabic, keep the abbreviations in Latin, and use transliterated slang for a handful of words. Follow this:

- **Translated into Arabic** (always): liquidation (تصفية), leverage (الرافعة المالية), margin (الهامش), position
  (مركز), entry/exit (دخول/خروج), take-profit (جني الأرباح), stop-loss (وقف الخسارة), funding (التمويل), open interest
  (العقود المفتوحة), order book (دفتر الأوامر), candle (شمعة), timeframe (الإطار الزمني), chart (الرسم البياني),
  support/resistance (دعم/مقاومة), whale (حوت), leaderboard (لوحة الصدارة), rewards (المكافآت), withdrawal (سحب),
  paper trading (التداول التجريبي), exchange (منصة), wallet (المحفظة), drawdown (التراجع), slippage (الانزلاق).
- **Long / short**: on buttons, direction pickers, table cells and tickets use **شراء / بيع** (the terminal already
  does - "BTC شراء", "ETH بيع"). In explanatory prose use **مركز شراء (لونغ) / مركز بيع (شورت)** on first mention
  in a text, then **لونغ / شورت** (as the academy does: "نسبة اللونغ/الشورت"، "صفقة لونغ"). Never "طويل/قصير".
- **Kept in Latin**: PnL, ROE, ROI, OI (after "العقود المفتوحة" on first mention), DCA, APR, APY, KYC, USDT, FDV,
  TVL, DeFi, API, Maker/Taker only in parentheses after the Arabic ("رسوم الصانع (Maker)").
- **Transliterated slang that is fine in prose** (Arabic letters): لونغ، شورت، سبريد، إيردروب، سكالبينغ، بامب،
  دامب، باكتست، ستيبلكوين (or العملة المستقرة). Prefer the Arabic term where the glossary gives one.

## Glossary (use these consistently)

| English | Arabic |
|---|---|
| liquidation price | سعر التصفية |
| liquidation (event) / liquidations | تصفية / تصفيات |
| get liquidated / liquidated | تتعرض للتصفية / تمت تصفيته (مُصفّى) |
| liquidation heatmap / map | الخريطة الحرارية للتصفيات / خريطة التصفيات |
| liquidations feed | بث التصفيات |
| liquidation cascade | شلال تصفيات |
| leverage | الرافعة المالية (الرافعة in short labels; 75× stays 75×) |
| margin | الهامش |
| isolated / cross margin | الهامش المعزول / الهامش المشترك (Cross) |
| maintenance margin (rate) | هامش الصيانة (معدل هامش الصيانة) |
| initial margin | الهامش الأولي |
| position / open position | مركز / مركز مفتوح |
| position size | حجم المركز |
| notional (value) | القيمة الاسمية |
| long / short (button, label) | شراء / بيع |
| long / short (prose noun) | مركز شراء (لونغ) / مركز بيع (شورت); then لونغ / شورت |
| go long / go short | تفتح مركز شراء / تفتح مركز بيع |
| entry price / exit price | سعر الدخول / سعر الخروج |
| take-profit | جني الأرباح |
| stop-loss | وقف الخسارة |
| trailing stop | وقف الخسارة المتحرك |
| market order / limit order / stop order | أمر سوق / أمر محدد / أمر وقف |
| resting order | أمر معلّق |
| fill / filled | تنفيذ / نُفّذ |
| order book | دفتر الأوامر |
| tape (trade tape) | شريط الصفقات |
| bid / ask | سعر الطلب (Bid) / سعر العرض (Ask) |
| spread | السبريد (الفارق بين العرض والطلب) |
| slippage | الانزلاق السعري |
| fee / fees | رسم / رسوم |
| maker fee / taker fee | رسوم الصانع (Maker) / رسوم المستهلك (Taker) |
| funding rate / funding | معدل التمويل / التمويل |
| open interest (OI) | العقود المفتوحة (OI) |
| mark price / index price | سعر العلامة / سعر المؤشر |
| perpetual futures / perps | العقود الدائمة |
| futures | العقود الآجلة |
| spot | السوق الفورية (سبوت) |
| PnL / unrealized / realized | PnL / ربح وخسارة غير محققة / ربح وخسارة محققة |
| ROE / ROI | ROE / ROI |
| break-even | نقطة التعادل |
| risk/reward | المخاطرة / العائد |
| win rate | نسبة الفوز |
| drawdown / max drawdown | التراجع / أقصى تراجع |
| volatility | التقلب |
| volume | حجم التداول |
| market cap | القيمة السوقية |
| dominance | الهيمنة |
| candle / candlestick / wick | شمعة / الشموع اليابانية / ظل الشمعة (الفتيل) |
| timeframe | الإطار الزمني |
| chart / charts | الرسم البياني / الرسوم البيانية |
| indicator / signal | مؤشر / إشارة |
| support / resistance | دعم / مقاومة |
| breakout / pullback | اختراق / ارتداد |
| trend / uptrend / downtrend | الاتجاه / اتجاه صاعد / اتجاه هابط |
| bull / bear market | سوق صاعدة / سوق هابطة |
| screener | الماسح |
| whale / whales | حوت / الحيتان |
| whale tracker | متتبّع الحيتان |
| trade (noun) / trades | صفقة / صفقات |
| trade (verb) | تتداول / تداول |
| trader | متداول |
| paper trading / paper trade | التداول التجريبي / صفقة تجريبية |
| demo account | حساب تجريبي |
| simulator | محاكي |
| calculator / calculators | حاسبة / الحاسبات |
| heatmap | الخريطة الحرارية |
| live price / real-time | سعر مباشر / في الوقت الفعلي |
| free / free, no sign-up | مجاني / مجانًا، بلا تسجيل |
| sign in / sign up / sign out | تسجيل الدخول / إنشاء حساب / تسجيل الخروج |
| account | حساب |
| balance | الرصيد |
| deposit / withdraw / withdrawal | إيداع / اسحب / سحب |
| payout / payouts | دفعة / الدفعات |
| claim (the faucet / a reward) | استلام (button: استلم) |
| reward / rewards | مكافأة / المكافآت |
| faucet | الصنبور |
| mission / daily missions | مهمة / المهام اليومية |
| streak | سلسلة الأيام المتتالية (short: السلسلة) |
| level / level up | المستوى / ترقية المستوى |
| levels (Bronze, Silver, Gold, Platinum, Diamond, Master, Legendary) | برونزي، فضي، ذهبي، بلاتيني، ماسي، ماستر، أسطوري |
| season (14-day competition) | الموسم |
| season pass / pro pass | Season Pass / الممر Pro (keep "Season Pass" as the product name) |
| leaderboard | لوحة الصدارة |
| board (one of the season boards) | لوحة |
| prize pool | مجموع الجوائز |
| prize | جائزة |
| duel / duels | مبارزة / مبارزات |
| badge / frame / background / skin | شارة / إطار / خلفية / مظهر |
| ticket (the trade card) | تذكرة |
| trading journal | سجل التداول |
| wallet | المحفظة |
| exchange (noun) | منصة (منصة تداول) |
| referral link / affiliate link | رابط إحالة |
| stablecoin | عملة مستقرة |
| airdrop | إيردروب |
| backtest / backtester | اختبار رجعي (باكتست) / أداة الاختبار الرجعي |
| bot | بوت |
| API key | مفتاح API |
| rate limit | حد الطلبات |
| endpoint / webhook | نقطة الوصول (endpoint) / webhook |
| alert / price alert | تنبيه / تنبيه سعري |
| push notification | إشعار فوري |
| Fear & Greed index | مؤشر الخوف والطمع |
| economic calendar | التقويم الاقتصادي |
| academy / lesson / course | الأكاديمية / درس / دورة |
| quiz | اختبار قصير |
| community / chat | المجتمع / الدردشة |
| settings | الإعدادات |
| search | بحث |
| home (breadcrumb, nav) | الرئيسية |
| blog / guides | المدونة / الأدلة |
| Learn more / Read more | اعرف المزيد / اقرأ المزيد |
| Get started | ابدأ |
| Open (a trade) / Close | فتح / إغلاق (button: افتح / أغلق) |
| Loading… | جارٍ التحميل… |
| Updated / Last updated | تم التحديث / آخر تحديث |
| Coming soon | قريبًا |
| not financial advice | ليست نصيحة مالية |

Currency and formats stay: `$60,000`, `0.4%`, `75×`, `24h`, `1m / 5m / 1h / 4h / 1D`. In a label that spells the
window out in words ("24 hours") write "24 ساعة"; in a compact data label keep "24h".

## Script and typography (Arabic, right-to-left)

- **Never reorder anything to make it look right-to-left.** Strings are stored in logical order; the page sets
  `dir="rtl"`. Write the sentence as you would read it, from its first word to its last.
- **Latin runs stay Latin and intact**: "BTC/USDT"، "Bybit"، "ROE +80%"، "$11.99"، "75×". Do not split a ticker from
  its number, do not insert Arabic letters into a Latin run, do not put a space inside "$100".
- **Prefixes on Latin words**: the Arabic prepositions/conjunction ب، ل، و، ك attach with no space to an Arabic word
  but before a Latin word they read badly. Write "و BTC" as "وBTC" only in lists the site already uses ("Solana وBase
  وEthereum" is the existing style); otherwise rephrase with a separate word ("على BTC"، "إلى Bybit").
- Punctuation: "،" for commas, "؛" for semicolons, "؟" for questions, "." for full stops, "…" for ellipsis. A
  percentage keeps the Latin "%" right after the number ("0.4%").
- Quotation marks: «...» in prose. Parentheses stay "( )" (the browser mirrors them).
- No kashida (ـ) for stretching words, no tatweel decoration. The only "ـ" allowed is the one before a Latin name the
  site already uses ("بـ$10,000").
- Do not add a space before "؟" or "،".
- Gender and number agreement: numbers 3-10 take the reverse gender and a plural noun ("ثلاث صفقات"، "خمسة أيام");
  11 and above take a singular accusative ("14 يومًا"، "30 صفقة"). Where a number is a digit, still agree the noun
  ("14 يومًا", not "14 أيام").
- Definiteness: labels are usually indefinite or construct state ("سعر التصفية"، "حجم المركز"); do not stack "ال"
  on both parts of an idafa ("السعر التصفية" is wrong).

## Tone

Direct, confident, no fluff, no exclamation marks the English does not have. Short sentences. A trader is reading
between two trades. MSA, but modern and plain - the voice of a good Arabic exchange app, not a newspaper editorial.

## Common mistakes to avoid (machine-like Arabic)

- Calquing English structure: "قم بفتح الصفقة" -> "افتح الصفقة"; "قم بالضغط" -> "اضغط". Drop "قم بـ" entirely.
- "الخاص بك" everywhere: "رصيد الخاص بك" -> "رصيدك".
- "يتم + verbal noun" for every passive: "يتم احتساب الصفقة" -> "تُحتسب الصفقة". Use the real passive or an active verb.
- "طويل / قصير" for long / short; "الهامش المتقاطع" (literal cross) - use the glossary.
- "الفائدة المفتوحة" / "الاهتمام المفتوح" for open interest - it is "العقود المفتوحة".
- "خذ الربح" for take-profit - it is "جني الأرباح".
- "السعر الحالي" for "actual price" - it is "السعر الفعلي".
- Eastern Arabic digits, the Arabic percent sign, or moving "$" after the number.
- Transliterating brands or tickers into Arabic letters (بايننس، بيتكوين inside a ticker context). In prose "بيتكوين"
  for the coin name is fine (the academy uses it); the ticker "BTC" always stays Latin.
- Dialect words (هسة، دلوقتي، باش، شنو، ايش). Write MSA.
- Over-formal or archaic words (حيث إنّ at every clause, لا سيما repeated, إنّ at the start of every sentence).
- Long genitive chains of four or more nouns - split the sentence instead.
- Feminine or plural address, or switching between "أنت" and "يُرجى" in one block.
- Repeating the same connective ("كما أن"، "بالإضافة إلى ذلك") in every sentence; vary or drop it.
- Read your own output once after writing it. An Arab trader should not be able to tell it was translated.
