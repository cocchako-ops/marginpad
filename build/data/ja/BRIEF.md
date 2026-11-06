# MarginPad - Japanese (ja-JP) translation brief (read fully before translating a chunk)

You are translating the text of **marginpad.io**, a free crypto-futures tools site (calculators, a paper-trading
terminal, charts, a liquidation feed, an academy, a rewards layer, a bot API) into **Japanese**. Readers are
Japanese-speaking futures traders who already use Bybit, Binance, OKX, MEXC and Bitget in Japanese. The translation
must read as if a Japanese crypto trader wrote it: correct context, natural phrasing, consistent terminology.
Word-by-word output (翻訳調) is a failure.

## Format you receive and return

Each chunk is a JSON array of items: `{ "id", "ctx", "kind", "en", "ja": "" }`.
- `ctx` = the page the string lives on (e.g. `/rewards/`). Use it to understand the context.
- `kind` = `html` (may contain inline tags), `title` (the browser tab title), `ld` (plain text for search-engine
  structured data), `attr:alt|title|placeholder|aria-label` (plain attribute text).
- Fill **`ja`** for every item. Never change `id`, `ctx`, `kind` or `en`. Never leave `ja` empty: if a string must
  stay identical (a brand, a ticker, a code word), copy `en` into `ja`.
- Write the whole array back to a sidecar file `NNN.ja.json` next to the chunk (same folder, same number) with the
  Write tool. Valid JSON only (escape `"` inside strings as `\"`). Never edit the chunk file itself.

## Hard rules

1. **Keep every HTML tag, attribute, href, entity exactly as it is** (`<a href="/x/">`, `<b>`, `<code>`, `&amp;`,
   `<br>`). Translate only the text between tags. The set of tags in `ja` must equal the set in `en`. Japanese word
   order differs, so a tag may MOVE inside the sentence - that is fine - but it must wrap the Japanese words that mean
   what it wrapped in English (`<b>$10,000</b> to start` -> `開始資金は<b>$10,000</b>`). (`&#39;`/`&rsquo;` may be dropped
   only when the Japanese sentence genuinely has no apostrophe.)
2. **Never translate the inside of `<code>...</code>`**, URLs, paths (`/screener`), API field names, tickers
   (BTC, ETH, SOL, BTC/USDT), exchange names (Bybit, Binance, OKX, Gate, Bitget, MEXC, BingX, KuCoin, Kraken,
   Hyperliquid, Coinbase, Moon, Fomo), numbers, currency amounts, percentages, `{placeholders}`, `%s`.
   Exchange names stay in Latin letters - never katakana (not バイビット, not バイナンス).
3. **Numbers stay exactly as written, in Western (half-width) digits**: 60,000 stays 60,000; 0.4% stays 0.4%;
   $11.99 stays $11.99; 24h stays 24h inside data labels. Never 6万, never full-width ６０,０００, never ＄. Live widgets
   print numbers in that format and the static text must match them. Units may be added around a number where
   Japanese needs them (`{n}日`, `{n}件`, `{n}分前`, `20倍`) - the number itself is untouched. Leverage: `75×` stays
   `75×` where the English writes `75×`; in running prose "20x leverage" is written `20倍レバレッジ`.
4. Product names stay in English: **MarginPad, Paper Trade, MP Shop, Rekt, The Gold Room, Demo Spot, Meme Spot,
   Premium, Founder, Ticks, XP, Bot API, MCP, Daily Wrap, Happy Hour, Moon, Trading Report, Season Pass, Road to Bronze,
   Ask AI, My Trades, Bot Arena, What moved it, King of the Moon, Green Days, MP·TAPE**. The common nouns and particles
   around them are Japanese ("Paper Tradeを開く", "MP Shopで購入", "Premiumメンバー限定"). When a product name is the
   name of a FEATURE and the English uses it as a plain noun ("open the paper trading terminal"), translate the plain
   noun (ペーパートレードのターミナル).
5. **Form of address: polite です/ます (丁寧語), the form the existing Japanese site text already uses** (Demo Spot pack,
   Academy lessons, homepage, app-shell dictionary: 「もう一度お試しください」「ログインしてください」). Rules inside that:
   - Do NOT use honorific keigo (尊敬語/謙譲語 such as ご利用いただけます, させていただきます, 〜でございます) - Bybit and
     Binance Japanese UI is polite but plain, and so are we. ください / ましょう / できます is the register.
   - **Avoid あなた** wherever the sentence works without it - Japanese drops the subject. Use it only where English
     contrasts "you" with someone else (あなたの順位, あなたのエントリー in a chart label) or in a fixed label like
     "Your rank". Never 君, お前, 貴方.
   - Buttons, labels, chips, table headers, chart annotations and short slogans are **noun phrases or dictionary
     form without です/ます** (「保存」「アラートを設定」「ログインして開始」「受け取り済み」). Full sentences in body text,
     notices, errors and FAQ answers end in です/ます. Never mix だ/である and です/ます inside one paragraph. Headings and
     card titles may be terse noun phrases or plain-form statements, exactly like the Academy uses.
6. Japanese typography: see the typography section below. Keep the dashes the English uses as ` - ` only where the
   existing site does (labels like 「受け取り済み · 次は{t}後」); inside Japanese prose an English dash becomes 「。」「、」 or
   a full-width dash `――` / `--` only when the existing text pattern needs it.
7. Titles (`kind: title`) should stay short: about **32 full-width characters** before the suffix (Google truncates
   Japanese titles around there), and keep the " | MarginPad" or " - MarginPad" suffix if present. Meta descriptions
   (`ld`, `attr`) about **100-120 Japanese characters** where the English is a full meta description.
8. Buttons, labels, nav items and table headers must stay **short** - Japanese is denser than English, so a button
   should usually be SHORTER than the English (「Open demo trade」 -> 「デモ取引を開始」, 「Show all」 -> 「すべて表示」).
9. Translate meaning, not words: idioms get a Japanese idiom or plain wording ("game over" -> 「ゲームオーバー」 only if
   it reads naturally, otherwise 「それで終わりです」; "nail every number" -> 「すべての数字を正確に」). "actual price" is
   「実際の価格」, never 「現在価格」 unless it means the current price.
10. Never leave a sentence half English. A stray English word in running text is a bug, except the glossary terms
    that stay in English (listed below) and the product names in rule 4.
11. No emojis, ever, even if the sentence sounds playful. No kaomoji. No 「！」 the English does not have.

## English, katakana, or Japanese? (how Japanese crypto-futures traders actually write)

Japanese futures traders read Bybit, Binance, OKX and MEXC in Japanese. Those UIs mix three layers, and so do we:

**Stay in Latin letters (as written in English):**
PnL, ROE, ROI, OI, DCA, APR, APY, TP, SL, R:R, ATR, RSI, MACD, EMA, SMA, MA, VWAP, FDV, TVL, KYC, API, MCP, SDK,
USDT, USDC, P2P, CSV, JSON, AI, XP, UTC, Fear & Greed, FOMC, CPI, 1m / 5m / 1h / 4h / 1D / 1W (timeframe chips),
24h (inside compact data labels only), all tickers and exchange names.

**Katakana (the standard term on Japanese exchange UIs):**
ロング, ショート, レバレッジ, ポジション, エントリー, ストップロス, テイクプロフィット, トレーリングストップ,
スプレッド, スリッページ, メイカー, テイカー, ドローダウン, バックテスト, スクリーナー, ウォレット, トレーダー,
トレード, ペーパートレード, ファンディング (only in 「ファンディング」 as a short label - the rate is 資金調達率),
スワップ, エアドロップ, ラグプル, パンプ, ダンプ, スキャルピング, スイングトレード, ボラティリティ, ブレイクアウト,
プルバック, サポート, レジスタンス, ヒートマップ, チャート, インジケーター, シグナル, アラート, ランキング,
シーズン, ミッション, リワード, ボーナス, ボット, ターミナル, チケット, スキン, フレーム, バッジ, ステーブルコイン,
ミームコイン, アルトコイン, ドミナンス, クジラ (never ホエール), マーケット (as a nav label; 市場 in prose).

**Japanese (kanji) terms - these are what the exchanges use, katakana here reads as amateur:**
清算 (liquidation), 証拠金 (margin), 維持証拠金, 当初証拠金, 分離マージン / クロスマージン (Bybit JP terms),
建玉 / 未決済建玉 (open interest), 資金調達率 (funding rate), 手数料, 成行注文, 指値注文, 逆指値注文, 約定,
板 / オーダーブック, 損益, 含み損益, 実現損益, 損益分岐, 勝率, 時間足, 出来高, 時価総額, 現物, 先物, 無期限先物,
取引所, 残高, 出金, 入金, 口座, 設定, 計算ツール, 仮想資金.

Rule of thumb: if Bybit's or Binance's Japanese UI writes it in kanji, we do too. Do not invent katakana for a word
that has a settled kanji term (no リクイデーション, no マージン alone for 証拠金, no オープンインタレスト in prose).

## Glossary (use these consistently)

The existing site text is not fully consistent (清算 / 強制決済, 計算ツール / 計算機, 損益 / PnL). This table settles it;
where it differs from an older string, **this table wins**.

| English | Japanese |
|---|---|
| liquidation price | 清算価格 |
| liquidation (event) / liquidations | 清算 / 清算（複数でも「清算」、件数は「清算 {n}件」） |
| get liquidated / liquidated | 清算される / 清算された |
| forced liquidation (the mechanism, explanatory prose) | 強制清算 (use 清算 in labels; 強制決済 only when the English says "force-closed") |
| liquidation heatmap / map | 清算ヒートマップ / 清算マップ |
| liquidations feed | 清算フィード |
| liquidation cluster | 清算クラスター |
| leverage | レバレッジ (75× stays 75×; prose 「20倍」) |
| margin | 証拠金 |
| isolated / cross margin | 分離マージン / クロスマージン |
| maintenance margin (rate) | 維持証拠金（率） |
| initial margin | 当初証拠金 |
| position / open position | ポジション / 保有中のポジション（label: 「オープンポジション」 ok） |
| position size | ポジションサイズ |
| notional (value) | 想定元本 |
| long / short | ロング / ショート（ロングポジション） |
| go long / go short | ロングする / ショートする（ロングを建てる） |
| open (a position) / close (a position) | 建てる・オープン / 決済する・クローズ (buttons: 「オープン」「決済」) |
| entry price / exit price | エントリー価格 / 決済価格 |
| stop-loss / take-profit | ストップロス / テイクプロフィット（labels SL / TP; verbs in prose: 損切りする / 利確する） |
| trailing stop | トレーリングストップ |
| market order / limit order / stop order | 成行注文 / 指値注文 / 逆指値注文 |
| resting order / pending order | 未約定の注文 |
| fill / filled | 約定 / 約定済み |
| order book | オーダーブック（prose may say 板） |
| the tape (trade prints) | 約定履歴（product label "Tape" -> 「テープ」 where it names our panel） |
| fee / fees / taker fee / maker fee | 手数料 / 手数料 / テイカー手数料 / メイカー手数料 |
| funding rate / funding | 資金調達率 / ファンディング |
| open interest (OI) | 未決済建玉（OI） |
| mark price | マーク価格 |
| PnL / unrealized / realized | 損益（label PnL ok） / 含み損益 / 実現損益 |
| break-even | 損益分岐点 |
| risk/reward | リスクリワード（R:R） |
| win rate | 勝率 |
| drawdown / max drawdown | ドローダウン / 最大ドローダウン |
| slippage / spread | スリッページ / スプレッド |
| candle / candlestick / wick | ローソク足 / ローソク足 / ヒゲ |
| timeframe | 時間足 |
| chart | チャート |
| indicator / signal | インジケーター / シグナル |
| support / resistance | サポート / レジスタンス |
| breakout / pullback | ブレイクアウト / プルバック（押し目・戻り in prose is fine） |
| volume | 出来高 |
| market cap | 時価総額 |
| volatility | ボラティリティ |
| dominance | ドミナンス |
| bull / bear market | 強気相場 / 弱気相場 |
| perpetual futures / perps | 無期限先物 |
| spot | 現物 |
| exchange (noun) | 取引所 |
| trade (noun) / trades | トレード / 取引（件数: 「{n}件のトレード」） |
| trade (verb) | 取引する / トレードする |
| trader | トレーダー |
| paper trading / paper trade | ペーパートレード |
| demo / simulator | デモ / シミュレーター |
| virtual / demo money | 仮想資金 / デモ資金 |
| live price / real-time | リアルタイム価格 / リアルタイム |
| calculator / calculators | 計算ツール（never 電卓, never 計算機 in new text） |
| heatmap | ヒートマップ |
| screener | スクリーナー |
| whale / whales | クジラ |
| season (14-day competition) | シーズン |
| leaderboard / board | ランキング / ボード |
| prize pool | 賞金プール |
| prize / payout / payouts | 賞金 / 支払い |
| rewards / reward | リワード |
| faucet | フォーセット |
| claim (the faucet, $100 a day) | 受け取る（button 「受け取る」, done 「受け取り済み」） |
| balance | 残高 |
| deposit / withdraw / withdrawal | 入金 / 出金する / 出金 |
| sign in / log in / sign out | ログイン / ログイン / ログアウト |
| sign up / create account | 新規登録 / アカウント作成 |
| no sign-up required / free | 登録不要 / 無料 |
| account | アカウント（exchange account in partner context: 口座） |
| username | ユーザー名 |
| settings | 設定 |
| alert / price alert | アラート / 価格アラート |
| push notification | プッシュ通知 |
| mission / daily missions | ミッション / デイリーミッション |
| streak | 連続記録（「7日連続」） |
| level / level up | レベル / レベルアップ |
| levels (Bronze, Silver...) | ブロンズ、シルバー、ゴールド、プラチナ、ダイヤモンド、マスター、レジェンド（Unranked = ランク外） |
| season pass / pro pass | Season Pass / Pro パス |
| duel / duels | デュエル |
| badge / frame / background / skin | バッジ / フレーム / 背景 / スキン |
| ticket (the trade card) | チケット |
| trading journal | 取引日誌 |
| academy / lesson / course / quiz | アカデミー / レッスン / コース / クイズ |
| guides | ガイド |
| community / post / thesis | コミュニティ / 投稿 / 論拠 |
| follow / follower | フォロー / フォロワー |
| backtest / backtester | バックテスト / バックテスター |
| strategy | 戦略 |
| API key / endpoint / webhook / rate limit | APIキー / エンドポイント / Webhook / レート制限 |
| bot | ボット |
| wallet / seed phrase | ウォレット / シードフレーズ |
| gas (network fee) | ガス代 |
| contract address | コントラクトアドレス |
| liquidity / pool | 流動性 / プール |
| rug / rugged | ラグプル / ラグ（badge 「ラグ」） |
| stablecoin | ステーブルコイン |
| catalyst | カタリスト |
| economic calendar | 経済指標カレンダー |
| Fear & Greed index | Fear & Greed（恐怖・強欲指数） |
| home (breadcrumb / nav) | ホーム |
| Learn more / Read more | 詳しく見る / 続きを読む |
| Get started | はじめる |
| Try it | 試してみる |
| Search | 検索 |
| Loading... | 読み込み中… |
| Updated / Last updated | 更新 / 最終更新 |
| Coming soon | 近日公開 |
| Show all / Show more | すべて表示 / さらに表示 |
| Copy / Copied | コピー / コピーしました |
| Save / Cancel / Close (dialog) | 保存 / キャンセル / 閉じる |

## Typography and script (Japanese-specific)

- **No spaces between Japanese characters.** Do not add a space before or after a particle. Between Japanese and a
  Latin word / number, follow the existing site: **no space** (「BTCを購入」「$100を受け取る」「20倍レバレッジ」).
  Keep spaces only where the English layout uses ` · ` separators or inside an English product name.
- Punctuation: 「、」 and 「。」 (full-width) in Japanese sentences, never `,` `.` after Japanese text. A label or button
  ends without 「。」. Question sentences end in 「？」 (full-width) or 「か。」; exclamation 「！」 only if the English has
  one, and sparingly.
- Brackets and quotes: Japanese quotes 「 」 (nested 『 』) for quoted UI words and names of buttons
  (「受け取る」を押す). Parentheses: full-width （ ） around Japanese text, half-width ( ) around pure Latin/number
  content inside a technical string is acceptable; the existing site uses full-width （ ）, so default to that.
- Colon: full-width 「：」 after Japanese words (「手数料：」); half-width `:` stays inside numbers, ratios (2:1), times
  (20:00) and code.
- Ellipsis 「…」 (one character), as the English. The middle dot ` · ` used as a separator in labels stays as the
  English writes it.
- Numbers, `$`, `%`, `×` are half-width. Never full-width letters or digits (ＢＴＣ, ２０).
- Katakana long vowels written with 「ー」 (トレーダー, not トレーダ - the JIS-style dropped long vowel looks dated);
  middle dot 「・」 only to separate two katakana words where needed (ポイント・オブ・コントロール), not inside common
  compounds (ストップロス, テイクプロフィット, ペーパートレード are written closed).
- Line length is not a concern; do not insert `<br>` the English does not have.
- Prefer kanji+kana in the standard everyday mix (できる not 出来る, ください not 下さい, とき not 時 for "when",
  こと not 事, ほど not 程, 〜など not 〜等).

## Tone

Direct, confident, no fluff. Short sentences. A trader is reading between two trades. Polite but not ceremonial -
the voice of a good Japanese exchange UI and a clear Japanese trading blog, not of a bank letter. Warnings about risk
are calm and factual, not dramatic.

## Common mistakes to avoid (they make it read machine-translated)

- **Overusing あなた / あなたの** in every sentence. Drop the subject; Japanese implies it.
- **Translating English pronoun chains literally** (「それは〜です。それは〜」). Restructure: one sentence, topic with は once.
- **Katakana-izing words that have a settled kanji term**: リクイデーション, マージン（for 証拠金）, オープンインタレスト,
  ファンディングレート in prose, オーダー（for 注文）, フィー（for 手数料）.
- **Mixing registers**: です/ます sentences next to だ/である sentences in one block; or keigo (〜いただけます,
  〜させていただきます) in a UI that is otherwise plain polite.
- **English word order kept** - "Open the trade before the price moves" is 「価格が動く前にトレードを建てましょう」, the
  verb goes last. Long English relative clauses become a front-loaded modifier or two sentences, never a 〜であるところの chain.
- **Literal "you can"**: every 「〜することができます」 becomes 「〜できます」; every 「〜することが可能です」 is a red flag.
- **Over-literal possessives** (「私たちのツールの計算の結果」) - collapse the の-chain.
- **Converting numbers** (6万ドル, ＄１０), dropping `$`, or moving `%` before the number.
- **Over-polite or apologetic error text**: 「申し訳ございませんが」 is not our voice; say what happened and what to do
  (「現金が不足しています。」「もう一度お試しください。」).
- **Inconsistent terms between strings**: 清算 vs 強制決済 vs ロスカット, 計算ツール vs 計算機 vs 電卓 - use the glossary
  form every time. ロスカット is a Japanese FX term; do not use it for crypto liquidation.
- **Translating product names** (ペーパートレード for the product name "Paper Trade" when it is the name, ザ・ゴールドルーム,
  マイトレード) - keep them English per rule 4.
- **Exclamation marks and hype** (「今すぐ！」「最強！」) the English does not have.
- **Spaces** inserted between Japanese words, or half-width punctuation after Japanese text.

## Quality bar

Read your own output once after writing it. Fix anything that sounds translated. A Japanese trader who uses Bybit in
Japanese every day should not be able to tell this was translated from English.
