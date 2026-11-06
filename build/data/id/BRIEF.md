# MarginPad - Indonesian (id-ID) translation brief (read fully before translating a chunk)

You are translating the text of **marginpad.io**, a free crypto-futures tools site (calculators, a paper-trading
terminal, charts, a liquidation feed, an academy, a rewards layer, a bot API) into **Indonesian (Bahasa Indonesia)**.
Readers are Indonesian futures traders, mostly young, mostly on a phone, who already trade on Indodax, Pintu,
Tokocrypto, Bybit, Binance or Bitget and read crypto Twitter and Telegram in a mix of Indonesian and English trading
words. The translation must read as if an Indonesian crypto trader wrote it: correct context, natural phrasing,
consistent terminology. Word-by-word output is a failure. Stiff textbook Indonesian ("Anda dapat melakukan pembukaan
posisi") is also a failure.

## Format you receive and return

Each chunk is a JSON array of items: `{ "id", "ctx", "kind", "en", "id": "" }`.
(Yes, the target field is literally named `"id"` - it is the language code, the same way the Portuguese chunks use
`"pt"`. The item's identifier is the FIRST `"id"` key; the translation goes into the LAST one, the empty string.
If the chunk you receive names the fields differently - e.g. `"key"` + `"id"` - keep exactly the field names it uses.)
- `ctx` = the page the string lives on (e.g. `/rewards/`). Use it to understand the context.
- `kind` = `html` (may contain inline tags), `title` (the browser tab title), `ld` (plain text for search-engine
  structured data), `attr:alt|title|placeholder|aria-label` (plain attribute text).
- Fill the **`id`** translation field for every item. Never change the identifier, `ctx`, `kind` or `en`. Never leave
  the translation empty: if a string must stay identical (a brand, a ticker, a code word), copy `en` into it.
- Write the whole array back to a sidecar file `NNN.id.json` next to the chunk (same folder, same number) with the
  Write tool. Valid JSON only (escape `"` inside strings as `\"`, keep `\n` as written). Never edit the chunk file
  itself.

## Hard rules

1. **Keep every HTML tag, attribute, href, entity exactly as it is** (`<a href="/x/">`, `<b>`, `<code>`, `&amp;`,
   `<br>`). Translate only the text between tags. The set of tags in the translation must equal the set in `en`.
   Word order may change, so a `<b>` may move inside the sentence, but it must wrap the same meaning.
   (`&#39;`/`&rsquo;` may be dropped only when the Indonesian sentence genuinely has no apostrophe.)
2. **Never translate the inside of `<code>...</code>`**, URLs, paths (`/screener`), API field names, tickers
   (BTC, ETH, SOL, BTC/USDT), exchange names (Bybit, Binance, OKX, Gate, Bitget, MEXC, BingX, KuCoin, Kraken,
   Hyperliquid, Coinbase, Moon), numbers, currency amounts, percentages, `{placeholders}`, `%s`.
3. **Numbers stay exactly as written** (60,000 stays 60,000; 0.4% stays 0.4%; $11.99 stays $11.99; 1,000x stays
   1,000x). Western digits, English thousands comma and decimal point. Live widgets print numbers in that format and
   the static text must match them. **Do NOT convert to Indonesian punctuation** (never 60.000 or 0,4%), never
   convert dollars to rupiah, never write "Rp".
4. Product names stay in English: **MarginPad, Paper Trade, MP Shop, Rekt, The Gold Room, Demo Spot, Meme Spot,
   Premium, Founder, Ticks, XP, Bot API, MCP, Daily Wrap, Happy Hour, Moon, Trading Report, Season Pass, Road to Bronze,
   Ask AI, My Trades, Bot Arena, What moved it, King of the Moon**. Common nouns around them are translated
   ("buka Paper Trade", "di MP Shop", "papan King of the Moon").
5. **Address the reader as "kamu"** (kamu / -mu / punyamu: "posisimu", "saldomu", "klik", "masuk"), **never
   "Anda", never "Saudara", never "lo/gue"**. This is what the existing Indonesian site already uses: all 19 Academy
   courses, the Indonesian homepage ("Bangun meja kerjamu", "Cairkan reward MarginPad-mu") and the newer Demo Spot
   strings are written with kamu, and it is how Pintu, Indodax, Reku and Tokocrypto talk to traders. (Some older
   app-shell strings still say "Anda" - they are the inconsistency, not the model.) Imperatives are plain verbs with
   no "silakan" padding: "Klik", "Buka", "Pilih", "Coba lagi". Never mix kamu and Anda inside one page.
6. Possessive and object endings on an **English loanword take a hyphen**: "wallet-mu", "leverage-nya", "stop-loss-mu",
   "chart-nya", "MarginPad-mu". On an Indonesian word they attach directly: "posisimu", "saldonya", "akunmu".
   The prefix **di-** as a passive verb is attached ("dilikuidasi", "dibuka", "ditradingkan"); **di** as the
   preposition "at/in" is separate ("di exchange", "di chart", "di Bybit").
7. Titles (`kind: title`) should stay short (about 65 characters when possible) and keep the " | MarginPad" or
   " - MarginPad" suffix if present. Meta descriptions (`ld`, `attr`) 160 characters or fewer where the English is.
8. Buttons, labels, nav items and table headers must stay **short** (about the same length as the English).
   Indonesian runs longer than English - prefer the shorter word ("Biaya" not "Biaya trading" where the context is
   clear, "Masuk" not "Masuk ke akun"). Drop "yang", "untuk", "dari" wherever a label reads fine without them.
9. Translate meaning, not words: idioms get an Indonesian idiom or plain wording. "actual price" is "harga
   sebenarnya", never "harga aktual"; "eventually" is "pada akhirnya / lama-lama", never "secara eventual".
10. Never leave a sentence half English. A stray English word in running text is a bug, except the glossary terms
    that stay in English (see the next section). Those are used as Indonesian traders use them, unitalicised, in
    lower case in running text (long, short, stop-loss), capitalised only at the start of a sentence or a label.
11. No emojis, ever, even if the sentence sounds playful.

## Trading words that stay in English

Indonesian crypto traders, Indonesian Twitter/Telegram and the Indonesian pages of Bybit, Binance and Bitget leave
these in English. Translating them makes the text sound like a machine or a 1990s textbook:

long, short, stop-loss, take-profit, leverage, margin, funding, funding rate, spread, slippage, maker, taker, drawdown,
backtest, screener, trailing stop, wallet, exchange, trader, trading, paper trading, PnL, ROE, ROI, OI, open interest,
DCA, APR, APY, swap, airdrop, rug, pump, dump, scalp, scalping, swing, perp, perpetual futures, futures, spot, mark
price, squeeze, entry, order book, candle, chart, breakout, pullback, heatmap, feed, tape, faucet, whale (also "paus"),
market (also "pasar"), pair, timeframe, cross margin, isolated margin, maintenance margin, notional, liquidity pool,
stablecoin, altcoin, meme coin, gas, bot, endpoint, webhook, API key, P&L, FDV, volume, alert, reward(s), pool,
leaderboard (also "papan peringkat"), season pass, skin, badge, chat, username, email, link.

Everything else is translated. In particular these are Indonesian, not English: likuidasi, harga likuidasi, posisi,
biaya, saldo, akun, penarikan, hadiah, misi, musim, level, peringkat, kalkulator, simulator, akademi, pelajaran,
kursus, risiko, untung/rugi, tren, harga, indikator, strategi.

## Glossary (use these consistently)

| English | Indonesian |
|---|---|
| liquidation price | harga likuidasi |
| liquidation (event) / liquidations | likuidasi / likuidasi (no plural form; "banyak likuidasi") |
| get liquidated / liquidated | kena likuidasi / dilikuidasi |
| liquidation heatmap / map | heatmap likuidasi / peta likuidasi |
| liquidations feed | feed likuidasi |
| cascade (liquidation cascade) | rentetan likuidasi (cascade) |
| leverage | leverage (75× stays 75×; "leverage 10×") |
| margin | margin |
| isolated / cross margin | isolated margin / cross margin (margin isolated / margin cross in short labels) |
| maintenance margin (rate) | maintenance margin (rasio margin pemeliharaan in calculators) |
| initial margin | margin awal |
| position / open position | posisi / posisi terbuka |
| position size | ukuran posisi |
| notional (value) | nilai nosional |
| long / short | long / short (posisi long, buka long) |
| go long / go short | buka long / buka short |
| entry price / exit price | harga entry / harga keluar ("harga masuk" in calculators is also used; keep one per page) |
| entry / exit | entry / exit (as nouns), masuk / keluar (as verbs) |
| stop-loss / take-profit | stop-loss / take-profit (SL / TP) |
| market order / limit order / stop order | market order / limit order / stop order |
| resting order / pending order | order tertunda |
| fill / filled | eksekusi / tereksekusi |
| order book | order book |
| tape (trade tape) | tape (riwayat transaksi live) |
| fee / fees / taker fee / maker fee | biaya / biaya / biaya taker / biaya maker |
| trading fee | biaya trading |
| funding rate / funding | funding rate / funding |
| open interest (OI) | open interest (OI) |
| PnL / unrealized / realized | PnL / PnL belum terealisasi / PnL terealisasi |
| profit / loss | untung (profit) / rugi |
| break-even | titik impas (break-even) |
| risk/reward | risk/reward (rasio risk/reward) |
| win rate | win rate |
| drawdown / max drawdown | drawdown / drawdown maksimum |
| candle / candlestick | candle / candlestick |
| wick | sumbu (wick) |
| timeframe | timeframe |
| chart | chart (grafik is fine in a title or for a non-trader reader) |
| indicator | indikator |
| support / resistance | support / resistance |
| trend / uptrend / downtrend | tren / tren naik / tren turun |
| breakout / pullback | breakout / pullback |
| volatility | volatilitas |
| volume | volume |
| market cap | kapitalisasi pasar (market cap) |
| dominance | dominasi |
| bull / bear market | pasar bullish / pasar bearish |
| Fear & Greed index | indeks Fear & Greed |
| whale / whales | whale (paus is acceptable in a headline) |
| wallet | wallet |
| exchange (noun) | exchange (bursa only in formal titles) |
| paper trading (concept) | paper trading |
| demo account / demo trade | akun demo / trading demo |
| practice | latihan / berlatih |
| simulator | simulator |
| calculator | kalkulator |
| screener | screener |
| heatmap | heatmap |
| alert / price alert | alert / alert harga |
| leaderboard / board | papan peringkat / papan |
| rank / ranked / unranked | peringkat / berperingkat / belum berperingkat |
| season (14-day competition) | musim |
| season pass / pro pass | Season Pass / pass Pro |
| prize / prize pool | hadiah / total hadiah (pool) |
| competition | kompetisi |
| duel / duels | duel |
| squad | squad |
| reward / rewards | reward / reward (hadiah when it is a prize) |
| faucet | faucet |
| claim (the faucet / a reward) | klaim / mengklaim |
| mission / daily missions | misi / misi harian |
| streak | streak (beruntun in prose: "5 hari beruntun") |
| level (Bronze, Silver...) | level (Bronze, Silver, Gold, Platinum, Diamond, Master, Legendary - level names stay English) |
| level up | naik level |
| badge / frame / background / skin | badge / bingkai / latar / skin |
| balance | saldo |
| deposit / withdraw / withdrawal | deposit / tarik / penarikan |
| payout | pembayaran |
| cash out | cairkan |
| sign in / log in | masuk |
| sign up / create account | daftar / buat akun |
| sign out | keluar |
| free, no sign-up | gratis, tanpa daftar |
| account | akun |
| username | username |
| settings | pengaturan |
| profile | profil |
| follow / follower | ikuti / pengikut |
| message (DM) | pesan |
| notification / push notification | notifikasi / notifikasi push |
| academy / lesson / course / quiz | akademi / pelajaran / kursus / kuis |
| exam | ujian |
| beginner | pemula |
| guide | panduan |
| backtest / backtester | backtest / backtester |
| strategy | strategi |
| API key | API key |
| rate limit | batas request (rate limit) |
| endpoint / webhook | endpoint / webhook |
| bot / agent (AI) | bot / agen AI |
| live (price, feed) | live |
| real-time | real-time |
| Home | Beranda |
| Learn more / Read more | Pelajari lebih lanjut / Baca selengkapnya |
| Get started | Mulai |
| Try it / Try now | Coba / Coba sekarang |
| Open (a trade) / Close | Buka / Tutup |
| Buy / Sell | Beli / Jual |
| Search | Cari |
| Loading… | Memuat… |
| Updated / Last updated | Diperbarui / Terakhir diperbarui |
| Coming soon | Segera hadir |
| Show all / Show more | Tampilkan semua / Tampilkan lebih banyak |
| Cancel / Save / Done | Batal / Simpan / Selesai |
| Copy / Copied | Salin / Disalin |
| Error / try again | Error / coba lagi |
| Blog / Guides / Academy | Blog / Panduan / Akademi |
| Calculators | Kalkulator |
| Community | Komunitas |
| News | Berita |
| Calendar | Kalender |
| My Trades | My Trades (product name; the old homepage label "Trading Saya" is being retired) |

Time and formats stay: `$60,000`, `0.4%`, `75×`, `1m / 5m / 1h / 4h / 1D` (timeframe codes are never translated).
"24h" in running text is "24 jam"; in a compact stat label where space is tight, "24j" (as Demo Spot already does).
Units in prose: detik, menit, jam, hari, minggu, bulan. Dates: keep the English date as written when it is a live
value; in prose use Indonesian month names (Januari, Februari, Maret, April, Mei, Juni, Juli, Agustus, September,
Oktober, November, Desember) and day names (Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu).

## Script and typography

- Latin script, no diacritics. Standard EYD/PUEBI spelling: "kripto", "praktik" (not "praktek"), "risiko" (not
  "resiko"), "analisis" (not "analisa"), "aktivitas" (not "aktifitas"), "efektif", "kualitas", "sistem", "teknik".
- Punctuation as in English: straight double quotes `"..."` as the English uses them, no space before `: ; ? !`,
  one space after. Keep the dashes the English uses (` - ` stays ` - `, `·` stays `·`, `→` stays `→`, `…` stays `…`).
- Sentence case for headings and buttons as the English does; do not Title Case Every Indonesian Word.
- No plural reduplication where a number or context already says it ("5 posisi", not "5 posisi-posisi";
  "semua trader", not "semua trader-trader"). Use reduplication only where Indonesian genuinely needs it
  ("hati-hati", "pelan-pelan", "angka-angka" for "these numbers" when it reads naturally).
- English loanwords keep English spelling (leverage, trader), but an Indonesian-standard adaptation is used where it
  exists and is what traders say: likuidasi, volatilitas, indikator, strategi, simulasi, nosional, kapitalisasi.
- Verbs built on an English trading word: "trading" as a verb is fine ("trading di Bybit"); "ditradingkan /
  mentradingkan" only where the Academy already uses them. Prefer "membuka posisi" over "mengentri".

## Common mistakes to avoid (they make it sound machine-translated)

- **"Anda"** anywhere, or switching between kamu and Anda.
- **Over-formal verbs**: "melakukan pembelian" → "beli"; "melakukan penarikan" → "tarik"; "dapat" in every sentence
  → "bisa"; "apabila" → "kalau / jika"; "tersebut" after every noun → "itu" or nothing; "adalah" before every
  predicate - drop it where the sentence stands without it.
- **Passive chains** copied from English word order. Indonesian likes the object-focus passive ("Posisinya
  dilikuidasi di $58,000"), but not three "di-" verbs in one sentence.
- **"Yang" stacking**: "posisi yang terbuka yang kamu punya" → "posisi terbukamu".
- **Literal idioms**: "the market bleeds" is not "pasar berdarah" in a calm sentence → "pasar terus turun";
  "skin in the game" → "punya taruhan sendiri"; "rule of thumb" → "patokan praktis".
- **Translating the English trading words above** ("kerugian berhenti" for stop-loss, "daya ungkit" for leverage,
  "minat terbuka" for open interest, "buku pesanan" for order book, "lilin" for candle, "ikan paus" in a feature
  label) - nobody in Indonesian crypto says these.
- **Indonesian number formatting** (60.000, 0,4%) - see Hard rule 3.
- **"Untuk"** at the start of every label and **"dari"** for every "of": "Ukuran posisi", not "Ukuran dari posisi".
- **Wrong di**: "di likuidasi" (must be "dilikuidasi") and "dichart" (must be "di chart").
- **Malaysian forms**: "akaun", "percuma", "kemas kini", "anda boleh" - this is Indonesian, use "akun", "gratis",
  "perbarui", "kamu bisa".
- **"Gratis" vs "bebas"**: free of charge is "gratis"; "bebas" means "free from / allowed to".
- **Exclamation marks** the English does not have, and cheerleading ("Ayo!", "Yuk!") that the English does not have.

## Tone
Direct, confident, no fluff, no exclamation marks the English does not have. Short sentences. Friendly kamu, never
slang, never stiff. A trader is reading between two trades.

## Quality bar
Read your own output once after writing it. Fix anything that sounds translated: "melakukan" for every verb,
"tersebut" everywhere, "dapat" instead of "bisa", English word order, a missing hyphen on "-mu/-nya" after an English
word. An Indonesian trader should not be able to tell it was translated.
