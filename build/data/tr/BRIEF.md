# MarginPad - Turkish (tr-TR) translation brief (read fully before translating a chunk)

You are translating the text of **marginpad.io**, a free crypto-futures tools site (calculators, a paper-trading
terminal, charts, a liquidation feed, an academy, a rewards layer, a bot API) into **Turkish**. Readers are
Turkish-speaking futures traders, mostly in Turkey. The translation must read as if a Turkish crypto trader wrote it:
correct context, natural phrasing, consistent terminology, the vocabulary Binance TR / Bybit / OKX Turkish screens use.
Word-by-word output is a failure.

## Format you receive and return

Each chunk is a JSON array of items: `{ "id", "ctx", "kind", "en", "tr": "" }`.
- `ctx` = the page the string lives on (e.g. `/rewards/`). Use it to understand the context.
- `kind` = `html` (may contain inline tags), `title` (the browser tab title), `ld` (plain text for search-engine
  structured data), `attr:alt|title|placeholder|aria-label` (plain attribute text).
- Fill **`tr`** for every item. Never change `id`, `ctx`, `kind` or `en`. Never leave `tr` empty: if a string must
  stay identical (a brand, a ticker, a code word), copy `en` into `tr`.
- Write the whole array back to a sidecar file `NNN.tr.json` next to the chunk (same folder, same number) with the
  Write tool. Valid JSON only (escape `"` inside strings as `\"`). Never edit the chunk file itself.

## Hard rules

1. **Keep every HTML tag, attribute, href, entity exactly as it is** (`<a href="/x/">`, `<b>`, `<code>`, `&amp;`,
   `<br>`). Translate only the text between tags. The set of tags in `tr` must equal the set in `en`. Turkish word
   order is SOV, so a tagged phrase may move inside the sentence - that is fine, as long as each tag still wraps the
   matching Turkish words and no tag is added, dropped or split. (`&#39;`/`&rsquo;` may be dropped only when the
   Turkish sentence genuinely has no apostrophe.)
2. **Never translate the inside of `<code>...</code>`**, URLs, paths (`/screener`), API field names, tickers
   (BTC, ETH, SOL, BTC/USDT), exchange names (Bybit, Binance, OKX, Gate, Bitget, MEXC, BingX, KuCoin, Kraken,
   Hyperliquid, Coinbase, Moon), numbers, currency amounts, percentages, `{placeholders}`, `%s`.
3. **Numbers stay exactly as written - English format, Western digits.** 60,000 stays 60,000 (never 60.000);
   0.4% stays **0.4%** (never %0,4 or %0.4); $11.99 stays $11.99; 75× stays 75×; 24h stays 24h. Live widgets print
   numbers in that format and the validator compares every number including its trailing `%` - a moved percent sign
   is a rejected item. Turkish suffixes attach AFTER the number with an apostrophe: `$100'ü`, `0.4%'lük`, `10×'te`,
   `2026'da`, `14 günlük`.
4. Product names stay in English: **MarginPad, Paper Trade, MP Shop, Rekt, The Gold Room, Demo Spot, Meme Spot,
   Premium, Founder, Ticks, XP, Bot API, MCP, Daily Wrap, Happy Hour, Moon, Trading Report, Season Pass, Road to Bronze,
   Ask AI, My Trades, Bot Arena**. Common nouns around them are translated and suffixes take an apostrophe
   ("Paper Trade'i aç", "MP Shop'ta", "Ticks ile öde", "Premium'a geç").
5. **Address the reader as "sen"** (sen / senin / -in / tıkla, gir, aç, dene), never "siz" and never the polite
   "-iniz/-ınız" endings. This is what the existing Turkish site already uses on its newest and largest surfaces
   (Demo Spot pack: "Başlamak için giriş yap", "Bugün zaten talep ettin"; the Academy: "Aslında neyle işlem
   yapıyorsun", "stopu izle"). Some older calculator strings in the app shell still say "ayarlanır... seçtiğiniz",
   "Tampon bırakın" - those are the inconsistency, not the model. Imperatives are the bare stem: "Giriş yap",
   "Kayıt ol", "Hesapla", "Kopyala", "Tekrar dene".
6. Turkish letters always correct: ç ğ ı İ ö ş ü, and the capital dotted **İ** for i (İşlem, İzole, İptal - never
   "Islem", never "ISLEM"). Uppercase labels: "İŞLEM", "GİRİŞ", "ÇIKIŞ" (i -> İ, ı -> I). Keep the quotes and dashes
   the English uses.
7. Titles (`kind: title`) should stay short (about 65 characters when possible) and keep the " | MarginPad" or
   " - MarginPad" suffix if present. Meta descriptions (`ld`, `attr`) 160 characters or fewer where the English is.
8. Buttons, labels, nav items and table headers must stay **short** (about the same length as the English). Turkish
   agglutinates and runs long - prefer the shorter word ("Ücretler", not "İşlem ücretleri" where the context is clear;
   "Kapat", not "Pozisyonu kapat" on a row button).
9. Translate meaning, not words: idioms get a Turkish idiom or plain wording. "actual price" is "gerçek fiyat", never
   "güncel fiyat" unless it means the current price. "game over" -> "oyun bitti"; "nail every number" -> "her rakamı
   tam hesapla".
10. Never leave a sentence half English. A stray English word in running text is a bug, except the glossary terms
    that stay in English: long, short, stop-loss, take-profit, funding, spread, slippage, maker, taker, drawdown,
    backtest, screener, trailing stop, trader, trading, paper trading, PnL, ROE, ROI, OI, open interest, DCA, APR,
    APY, swap, airdrop, rug, pump, dump, scalp, swing, perp, mark price, squeeze, faucet, token, coin, stablecoin,
    staking, wallet (only inside a product phrase; plain "wallet" is "cüzdan"), bot, webhook, endpoint, API.
    These are written lowercase in running text (Turkish does not capitalise nouns) and take suffixes with an
    apostrophe: "long'u kapat", "stop-loss'un", "funding'i öde", "trader'ların", "coin'ler" (plural also "coinler" -
    pick ONE per chunk; the site uses "coin'ler" in Demo Spot and "coinler" in the Academy, both are acceptable).
11. No emojis, ever, even if the sentence sounds playful.

## Which trading words stay English, and which are Turkish

Turkish futures traders mix the two exactly like this, and the big exchanges' Turkish screens agree:
- **Stay English**: long, short, stop-loss / SL, take-profit / TP, PnL, ROE, ROI, funding (as the payment itself),
  open interest / OI, spread, slippage, maker / taker, drawdown, backtest, screener, scalp, swing, trailing stop,
  perp, pump, dump, rug, airdrop, mark price (also "işaret fiyatı"), trader, trading.
- **Always Turkish**: kaldıraç (leverage), marjin (margin), likidasyon (liquidation), pozisyon, emir (order), giriş /
  çıkış fiyatı, komisyon (fee), bakiye, cüzdan, borsa, grafik, mum, zaman dilimi, destek / direnç, kırılım, balina,
  sıralama, sezon, ödül, para çekme, ısı haritası, emir defteri, hesaplayıcı, gösterge, sinyal, oynaklık, hacim.
- "Futures" is **vadeli işlem(ler)**; "perpetual futures" is **perpetual vadeli** / **perp** (the Academy says
  "perpetual future" - acceptable; never "sürekli vadeli").

## Glossary (use these consistently)

| English | Turkish |
|---|---|
| liquidation price | likidasyon fiyatı |
| liquidation (event) / liquidations | likidasyon / likidasyonlar |
| get liquidated / liquidated | likide olmak / likide oldu (likide edilmek) |
| liquidation heatmap / map | likidasyon ısı haritası / likidasyon haritası |
| liquidations feed | likidasyon akışı |
| leverage | kaldıraç (75× stays 75×; "10×'te") |
| margin | marjin (in Academy prose "teminat" is acceptable when it means the money locked) |
| isolated / cross margin | izole marjin / çapraz marjin |
| maintenance margin (rate) | bakım marjini (oranı) |
| initial margin | başlangıç marjini |
| collateral | teminat |
| position / open position | pozisyon / açık pozisyon |
| position size | pozisyon büyüklüğü |
| notional (value) | nominal değer |
| long / short | long / short (long pozisyon, short pozisyon) |
| go long / go short | long açmak / short açmak |
| entry price / exit price | giriş fiyatı / çıkış fiyatı |
| stop-loss / take-profit | stop-loss / take-profit (labels may say "Zarar Durdur" / "Kâr Al" where the English label is short) |
| trailing stop | trailing stop (iz süren stop) |
| market order / limit order / stop order | piyasa emri / limit emri / stop emri |
| resting order | bekleyen emir |
| fill / filled | gerçekleşme / gerçekleşti |
| order book | emir defteri |
| tape (trade tape) | işlem akışı (tape) |
| fee / fees / taker fee / maker fee | komisyon / komisyonlar / taker komisyonu / maker komisyonu |
| funding rate / funding | fonlama oranı / funding |
| open interest (OI) | open interest (OI) - never "açık pozisyon" (that is an open position) |
| PnL / unrealized / realized | PnL / gerçekleşmemiş PnL / gerçekleşmiş PnL |
| profit / loss | kâr / zarar |
| break-even | başabaş |
| risk/reward | risk/ödül |
| win rate | kazanma oranı |
| drawdown / max drawdown | drawdown / maksimum drawdown |
| slippage | slippage (kayma) |
| spread | spread |
| candle / candlestick / wick | mum / mum grafiği / fitil |
| timeframe | zaman dilimi |
| chart / charts | grafik / grafikler |
| indicator / signal | gösterge / sinyal |
| support / resistance | destek / direnç |
| breakout / pullback | kırılım / geri çekilme |
| trend | trend |
| volume | hacim |
| volatility | oynaklık (volatilite also fine) |
| market cap | piyasa değeri |
| dominance | dominans |
| bull / bear market | boğa piyasası / ayı piyasası |
| whale / whales | balina / balinalar |
| screener | screener (tarayıcı in the Demo Spot tab) |
| exchange (noun) | borsa |
| trade (noun) / trades | işlem / işlemler |
| trade (verb) | işlem yapmak |
| trader | trader |
| paper trading (concept) | paper trading (sanal işlem in explanatory prose) |
| demo account | demo hesap |
| simulator | simülatör |
| calculator / calculators | hesaplayıcı / hesaplayıcılar |
| heatmap | ısı haritası |
| live price | canlı fiyat |
| real-time | gerçek zamanlı |
| free, no sign-up | ücretsiz, kayıt gerekmez |
| sign in / sign up / sign out | giriş yap / kayıt ol / çıkış yap |
| account | hesap |
| username | kullanıcı adı |
| balance | bakiye |
| deposit / withdraw / withdrawal | para yatırmak / para çekmek / para çekme (çekim) |
| payout / payouts | ödeme / ödemeler |
| reward / rewards | ödül / ödüller |
| faucet | faucet |
| claim (the faucet, the daily $100) | talep et (as on Demo Spot: "$100 Talep Et") |
| mission / daily missions | görev / günlük görevler |
| streak | seri |
| level / level up | seviye / seviye atla |
| levels (Bronze, Silver...) | Bronz, Gümüş, Altın, Platin, Elmas, Master, Efsanevi |
| season (14-day competition) | sezon |
| season pass / pro pass | Season Pass (sezon kartı in prose) / Pro pass |
| leaderboard / board | sıralama / tablo |
| prize pool | ödül havuzu |
| duel / duels | düello / düellolar |
| badge / frame / background / skin | rozet / çerçeve / arka plan / skin |
| ticket (the trade card) | bilet |
| trading journal | işlem günlüğü |
| academy / lesson / course | akademi / ders / kurs |
| quiz | test |
| alert / price alert | alarm / fiyat alarmı |
| push notification | anlık bildirim |
| wallet | cüzdan |
| seed phrase | kurtarma ifadesi |
| gas (network fee) | gas (ağ ücreti) |
| stablecoin | stablecoin |
| API key | API anahtarı |
| rate limit | istek limiti |
| bot / agent (AI) | bot / ajan |
| Fear & Greed index | Korku ve Açgözlülük Endeksi (Fear & Greed) |
| settings | ayarlar |
| search | ara |
| Home (breadcrumb, nav) | Ana sayfa |
| Blog / Guides / Academy | Blog / Rehberler / Akademi |
| Community | Topluluk |
| Learn more / Read more | Daha fazla bilgi / Devamını oku |
| Get started | Başla |
| Try it / Try now | Dene / Hemen dene |
| Open (a trade) / Close | Aç / Kapat |
| Loading… | Yükleniyor… |
| Updated / Last updated | Güncellendi / Son güncelleme |
| Coming soon | Yakında |

## Typography and grammar notes

- **Apostrophe before a suffix on a proper noun, abbreviation, number or foreign word**: Bybit'te, Binance'te,
  BTC'yi, ETH'nin, USDT'ye, $100'ü, MarginPad'de, Telegram'dan. Follow vowel harmony and the consonant of the
  spoken form (BTC = "be-te-ce" -> BTC'yi; API -> API'yi; PnL -> PnL'in).
- **Never** apostrophe on ordinary Turkish words ("borsada", not "borsa'da").
- Use "â/î/û" only where standard (kâr = profit, to tell it from kar = snow; "kârlı", "kâr al").
- The question particle **mı/mi/mu/mü** is written separately: "Ücretsiz mi?". "de/da" meaning "also" is separate,
  the locative suffix is attached: "sen de dene" vs "borsada".
- Quotes: keep the quote characters the English uses ("..." or “...”). Do not introduce « ».
- Dashes and the hyphen-with-spaces " - " separator the site uses stay as in the English.
- Ellipsis "…" stays as one character when the English has it.
- Capitalisation: sentence case for running text; Turkish does not title-case headings, so "Likidasyon Fiyatı
  Hesaplayıcı" in an English Title Case heading becomes sentence case unless the English heading is a product name.
  Buttons may stay Title Case like the existing site ("$100 Talep Et", "CSV Dışa Aktar").
- Time units: s (saat) for hours is ambiguous with seconds; use the existing convention from the Demo Spot pack:
  `{n}sn` seconds, `{n}dk` minutes, `{n}s` hours, `{n}g` days - but "24h" in a fixed label stays "24h" (number rule).
  In prose write "24 saat".

## Common mistakes to avoid (machine-like Turkish)

- **"siz" creeping in** ("Hesabınızı oluşturun", "tıklayınız"). Always "hesabını oluştur", "tıkla".
- **English word order kept**: Turkish puts the verb last. "Open a long on BTC at 10×" -> "BTC'de 10× long aç", not
  "Aç bir long BTC'de".
- **Literal possessive chains** ("pozisyonunuzun boyutunun hesaplanması"). Use a verb: "pozisyon büyüklüğünü hesapla".
- **"Bir" in front of every noun**: English "a/an" usually has no Turkish equivalent. "A free tool" -> "Ücretsiz araç".
- **"Tarafından" passives** ("MarginPad tarafından ölçülür"): prefer active voice ("MarginPad ölçer", "biz ölçüyoruz").
- **"Yapmak" for every verb** ("analiz yapmak", "kontrol yapmak"): use the real verb ("incele", "kontrol et").
- **Over-formal bureaucratic words** (gerçekleştirmek, mevcut bulunmak, temin etmek, hususunda). A trader writes "yap",
  "var", "al", "hakkında".
- **"Açık pozisyon" for open interest** - it means an open position; open interest stays "open interest (OI)".
- **"Marj" vs "marjin" vs "teminat" mixed in one page** - margin is "marjin" in UI and labels.
- **"Güncel fiyat" for "actual price"**, "kâr" written "kar", "likidite" confused with "likidasyon".
- **Dotless/dotted i errors in caps** ("ISLEM", "IZOLE") and missing ğ/ş/ç from ASCII habits.
- **Converted numbers** (60.000, %0,4, 11,99$). Numbers stay exactly as the English writes them.
- **Calqued idioms** ("oyun değiştirici" for game changer is acceptable; "gününü yap" for "make your day" is not).

## Tone
Direct, confident, no fluff, no exclamation marks the English does not have. Short sentences. A trader is reading
between two trades. Read your own output once before writing the sidecar and fix anything that sounds translated.
