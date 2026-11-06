# MarginPad - Simplified Chinese (zh-CN) translation brief (read fully before translating a chunk)

You are translating the text of **marginpad.io**, a free crypto-futures tools site (calculators, a paper-trading
terminal, charts, a liquidation feed, an academy, a rewards layer, a bot API) into **Simplified Chinese (简体中文)**.
Readers are Chinese-speaking crypto-futures traders who use Binance, OKX, Bybit and Bitget in Chinese every day. The
translation must read as if a Chinese crypto trader wrote it: correct context, natural phrasing, the terms those
exchanges' Chinese interfaces use, consistent terminology. Word-by-word output is a failure.

## Format you receive and return

Each chunk is a JSON array of items: `{ "id", "ctx", "kind", "en", "zh": "" }`.
- `ctx` = the page the string lives on (e.g. `/rewards/`). Use it to understand the context.
- `kind` = `html` (may contain inline tags), `title` (the browser tab title), `ld` (plain text for search-engine
  structured data), `attr:alt|title|placeholder|aria-label` (plain attribute text).
- Fill **`zh`** for every item. Never change `id`, `ctx`, `kind` or `en`. Never leave `zh` empty: if a string must
  stay identical (a brand, a ticker, a code word), copy `en` into `zh`.
- Write the whole array back to a sidecar file `NNN.zh.json` next to the chunk (same folder, same number) with the
  Write tool. Valid JSON only (escape `"` inside strings as `\"`; Chinese quotation marks “ ” need no escaping).
  Never edit the chunk file itself.

## Hard rules

1. **Keep every HTML tag, attribute, href, entity exactly as it is** (`<a href="/x/">`, `<b>`, `<code>`, `&amp;`,
   `<br>`). Translate only the text between tags. The set of tags in `zh` must equal the set in `en`. Chinese word
   order often moves the tagged phrase - move the whole tag with its text, never split or drop a tag.
   (`&#39;`/`&rsquo;` may be dropped only when the Chinese sentence genuinely has no apostrophe.)
2. **Never translate the inside of `<code>...</code>`**, URLs, paths (`/screener`), API field names, tickers
   (BTC, ETH, SOL, BTC/USDT), exchange names (Bybit, Binance, OKX, Gate, Bitget, MEXC, BingX, KuCoin, Kraken,
   Hyperliquid, Coinbase, Moon), numbers, currency amounts, percentages, `{placeholders}`, `%s`. Exchange names stay
   in Latin letters - write "Binance", never "币安", so the name matches the logo and the link beside it.
3. **Numbers stay exactly as written, in Western digits and English format** (60,000 stays 60,000; 0.4% stays 0.4%;
   $11.99 stays $11.99; 75× stays 75×; 24h, 1m / 5m / 1h / 4h / 1D stay). Never convert to 6万, 六万, 万/亿 units,
   Chinese numerals or 美元 written after the figure: "$100" stays "$100", not "100美元". Live widgets print numbers in
   that format and the static text must match them. A number spelled as an English word in running text ("ten
   boards", "three places") may be written as a Chinese numeral (十个榜单, 前三名) - only if it is a word in `en`.
4. Product names stay in English: **MarginPad, Paper Trade, MP Shop, Rekt, The Gold Room, Demo Spot, Meme Spot,
   Premium, Founder, Ticks, XP, Bot API, MCP, Daily Wrap, Happy Hour, Moon, Trading Report, Season Pass, Road to Bronze,
   Ask AI, My Trades, Bot Arena**. Common nouns around them are translated ("打开 Paper Trade", "在 MP Shop 中",
   "升级到 Premium"). The CONCEPT "paper trading" is translated (模拟交易); only the product name "Paper Trade" stays.
5. **Address the reader as 你 (你 / 你的), never 您.** The existing Simplified Chinese text on the site is written with
   你 (the homepage, all 18 Academy packs, the app-shell dictionary and the newer Demo Spot strings - 0 occurrences of 您
   outside a few old Spot lines), and it is how Chinese crypto communities and trading tools speak to a trader:
   direct and equal, not customer-service polite. A handful of old `/spot/` strings carry 您 - do not imitate them.
   Imperatives are plain: 点击, 打开, 登录, 选择 - no 请 on every button (请 is fine in an error or a polite request:
   "请重试", "请先登录").
6. Simplified characters only (no 繁體: 帳戶 -> 账户, 槓桿 -> 杠杆, 爆倉 -> 爆仓). Mainland terminology, not Taiwan
   or Hong Kong terms (软件 not 軟體, 信息 not 資訊, 视频 not 影片, 网络 not 網路, 默认 not 預設).
7. Titles (`kind: title`) should stay short (about 30 Chinese characters when possible; Chinese is roughly half the
   length of the English) and keep the " | MarginPad" or " - MarginPad" suffix exactly as written. Meta descriptions
   (`ld`, `attr`) about 80 Chinese characters or fewer where the English is around 160.
8. Buttons, labels, nav items and table headers must stay **short** - 2 to 6 characters is the norm ("打开", "领取 $100",
   "立即平仓", "全部计算器"). Do not pad a button into a sentence.
9. Translate meaning, not words: idioms get a Chinese idiom or plain wording ("game over" -> 结束了 / 出局了; "the market
   doesn't care" -> 市场不在乎你怎么想). "actual price" is 实际价格, never 当前价格 unless it means the current price.
10. Never leave a sentence half English. A stray English word in running text is a bug, except the terms that stay in
    English (see the next section) and the product names above.
11. No emojis, ever, even if the sentence sounds playful. No decorative symbols (✓, ★, →) that the English does not have.

## What stays in English, and what does not

Chinese crypto traders use Chinese for almost every concept - Binance, OKX, Bybit and Bitget's Chinese sites translate
leverage, liquidation, margin, funding rate, stop-loss and take-profit. Do not leave those in English. What genuinely
stays in Latin script in Chinese trading text:

- **Abbreviations and metrics:** PnL (also 盈亏; see glossary), ROE, ROI, OI (beside 持仓量), DCA (beside 定投),
  APR, APY, TVL, FDV, KYC, API, USDT, USDC, ATR, RSI, MACD, EMA, SMA, VWAP, R:R, K线 (the K stays Latin).
- **Words that Chinese traders write in English anyway:** meme 币 (meme coin), DEX, CEX, DeFi, NFT, perp (only
  alongside 永续合约), FOMC, CPI, bid / ask (only where the English shows them as labels; in prose 买单/卖单).
- **Brands and products** listed in rule 4, exchange names, tickers, chain names (Solana, Ethereum, Base, BNB Chain).

Everything else is translated: long/short = 做多/做空 (多单/空单, 多头/空头 as nouns), stop-loss = 止损, take-profit =
止盈, funding = 资金费率, slippage = 滑点, spread = 点差 (价差 for an order-book spread), maker/taker = 挂单/吃单,
drawdown = 回撤, backtest = 回测, screener = 筛选器, trailing stop = 追踪止损, wallet = 钱包, exchange = 交易所,
trader = 交易者 (交易员 only for a professional/copy-trading lead), swap = 兑换, airdrop = 空投, rug = 跑路 (rug pull
跑路/卷款跑路), pump/dump = 拉盘/砸盘, scalp = 剥头皮, swing = 波段, mark price = 标记价格, squeeze = 轧空/逼空
(short squeeze) / 多杀多 (long squeeze).

## Glossary (use these consistently)

| English | Simplified Chinese |
|---|---|
| liquidation price | 强平价格（强平价） |
| liquidation (event) / liquidations | 强平 / 强平（数据）；口语 爆仓 |
| get liquidated / liquidated | 被强平 / 已强平（口语：爆仓） |
| liquidation heatmap / map | 强平热力图 / 强平地图 |
| liquidations feed | 强平数据流 |
| liquidation cascade | 连环强平（级联爆仓） |
| leverage | 杠杆（75× stays 75×; "10x leverage" = 10倍杠杆 only when the en writes "10x" as a word; keep "10×" if written with ×） |
| margin | 保证金 |
| isolated / cross margin | 逐仓保证金 / 全仓保证金（逐仓 / 全仓） |
| maintenance margin (rate) | 维持保证金（维持保证金率） |
| initial margin | 初始保证金 |
| position / open position | 仓位 / 持仓 |
| position size | 仓位大小 |
| notional (value) | 名义价值 |
| long / short (noun) | 多单 / 空单（多头 / 空头 for the side or the traders） |
| go long / go short | 做多 / 做空 |
| entry price / exit price | 开仓价格（入场价）/ 平仓价格（出场价） |
| open / close a position | 开仓 / 平仓 |
| stop-loss / take-profit | 止损 / 止盈 |
| SL / TP | 止损 / 止盈 (keep "SL / TP" only as a compact column label) |
| trailing stop | 追踪止损 |
| break-even (stop) | 保本（保本止损）；break-even price 保本价 |
| market order / limit order / stop order | 市价单 / 限价单 / 止损单 |
| resting order / open order | 挂单（未成交订单） |
| fill / filled | 成交 / 已成交 |
| order book | 订单簿 |
| tape (time & sales) | 成交明细（逐笔成交） |
| bid / ask | 买单 / 卖单 (买价 / 卖价 for prices) |
| fee / fees / taker fee / maker fee | 手续费 / 手续费 / 吃单手续费 / 挂单手续费 |
| funding rate / funding | 资金费率 / 资金费 |
| open interest (OI) | 持仓量（OI） |
| mark price | 标记价格 |
| perpetual futures / perps | 永续合约 |
| futures | 合约（期货 in SEO titles where the English says "futures"） |
| spot | 现货 |
| PnL / unrealized / realized | 盈亏 / 未实现盈亏 / 已实现盈亏 (keep "PnL" or "P&L" when the en uses it as a column label) |
| ROE / ROI | ROE / ROI（收益率 in prose when needed） |
| break-even | 盈亏平衡 / 保本 |
| risk/reward | 风险回报比 |
| win rate | 胜率 |
| drawdown / max drawdown | 回撤 / 最大回撤 |
| slippage | 滑点 |
| spread | 点差 |
| candle / candlestick / wick | K线 / K线 / 影线 |
| timeframe | 时间周期 |
| chart | 图表 |
| indicator / signal | 指标 / 信号 |
| support / resistance | 支撑 / 阻力 |
| breakout / pullback | 突破 / 回调 |
| trend / range | 趋势 / 区间（震荡） |
| volatility / volume | 波动率 / 成交量 |
| market cap / dominance | 市值 / 占比（BTC 占比） |
| bull / bear market | 牛市 / 熊市 |
| whale / whales | 巨鲸 / 巨鲸 |
| heatmap | 热力图 |
| screener | 筛选器 |
| trader | 交易者 |
| trade (noun) / trades | 交易 / 交易（一笔交易） |
| trade (verb) | 交易 |
| paper trading (concept) | 模拟交易 |
| demo account / demo money | 模拟账户 / 模拟资金 |
| simulator | 模拟器 |
| terminal | 终端 |
| calculator / calculators | 计算器 |
| live price / real-time | 实时价格 / 实时 |
| leaderboard / board | 排行榜 / 榜单 |
| season (14-day competition) | 赛季 |
| season pass | 赛季通行证（product name "Season Pass" stays English where it is the name） |
| prize pool | 奖池 |
| competition | 交易大赛 / 比赛 |
| duel / duels | 对决 |
| reward / rewards | 奖励 |
| faucet | 水龙头（免费领取） |
| claim (the faucet, a reward) | 领取 |
| mission (daily) | 每日任务 |
| streak | 连续天数（连胜 for winning streak） |
| level (Bronze, Silver...) | 等级（青铜、白银、黄金、铂金、钻石、大师、传奇） |
| badge / frame / background / skin | 徽章 / 头像框 / 背景 / 皮肤 |
| balance | 余额 |
| deposit / withdraw / withdrawal | 充值 / 提现 / 提现 |
| payout / payouts | 发放（奖金发放） |
| wallet | 钱包 |
| exchange (noun) | 交易所 |
| sign in / sign up / sign out | 登录 / 注册 / 退出登录 |
| account | 账户 |
| username | 用户名 |
| free, no sign-up | 免费，无需注册 |
| academy / lesson / course | 学院 / 课程（一课）/ 课程系列 |
| quiz / exam | 测验 / 考试 |
| settings | 设置 |
| alert / price alert | 提醒 / 价格提醒 |
| notification | 通知 |
| journal / trading journal | 日志 / 交易日志 |
| API key / endpoint / webhook | API 密钥 / 端点 / Webhook |
| rate limit | 速率限制（限流） |
| bot | 机器人 |
| Fear & Greed index | 恐惧与贪婪指数 |
| stablecoin | 稳定币 |
| gas (network fee) | Gas 费 |
| contract address | 合约地址 |
| liquidity / pool | 流动性 / 流动性池 |
| home (breadcrumb) | 首页 |
| guides / blog | 指南 / 博客 |
| community / chat | 社区 / 聊天 |
| search | 搜索 |
| Learn more / Read more | 了解更多 / 阅读全文 |
| Get started | 开始 |
| Loading… | 加载中… |
| Updated / Last updated | 更新于 / 最后更新 |
| Coming soon | 即将推出 |

## Script and typography

- **Full-width punctuation inside Chinese text**: ， 。 ： ； ？ ！ （ ） 、. Never an ASCII comma or full stop after a
  Chinese character. Use 、 for lists of short items (BTC、ETH、SOL is fine; between Latin items a full-width ，is also
  acceptable). Keep ASCII punctuation inside code, URLs, numbers, tickers and ratios (2:1, 0.4%, BTC/USDT).
- **Quotes**: Chinese “ ” (and ‘ ’ nested), or 「 」 only if the English quotes a UI label already shown that way.
  Never straight ASCII quotes " around Chinese words in visible text.
- **Dashes**: an English sentence dash (" - ", " -- ", "—") becomes the Chinese 破折号 "——" (two em dashes, no spaces)
  in prose. In a title keep the " - MarginPad" / " | MarginPad" suffix exactly. Some older Academy strings show "--":
  that is a legacy artefact, do not imitate it.
- **Ellipsis**: …… in prose; keep a single "…" where the English uses one in a short UI state ("加载中…", "领取中…").
- **No spaces between Chinese characters.** Between Chinese and Latin letters or numbers, put one half-width space
  ("打开 Paper Trade", "$100 模拟资金", "10× 杠杆") - this is how the existing site text is written. No space before a
  % or after $, and no space between a number and 倍/个/天/分钟 when you use those units (3天, 14 天赛季 - either is
  fine, be consistent within a string).
- **Colons and brackets**: full-width （ ）and ： around Chinese text; half-width only when the content inside is
  entirely Latin/numeric and the English already uses them in a label.
- Bold/emphasis tags are kept; Chinese has no italics convention - leave `<i>`/`<em>` as tags, just place them on the
  equivalent Chinese words.
- Units: 秒 / 分钟 / 小时 / 天 / 周; UTC stays "UTC"; "24h" in a label stays "24h" or 24小时 - follow how the English
  wrote it (as a label code keep it; as a phrase, 24小时).

## Tone

Direct, confident, no fluff, no exclamation marks the English does not have. Short sentences. A trader is reading
between two trades. Write like a sharp Chinese crypto KOL explaining something to a friend, not like a bank notice and
not like a government announcement. Plain, concrete verbs.

## Common mistakes to avoid (machine-translation tells)

- **您** anywhere, or 请 in front of every imperative. Use 你 and plain imperatives.
- **Literal calques**: 采取一个仓位 (use 开仓), 拿一个多头 (use 做多), 得到清算 (use 被强平), 液化 / 清算价格 for
  liquidation price (use 强平价格), 杠杆作用, 边际 / 保证金率 for margin (margin = 保证金), 资金利率 (use 资金费率),
  开放兴趣 / 未平仓利益 for OI (use 持仓量), 鲸鱼 in data contexts (use 巨鲸), 纸上交易 / 纸交易 (use 模拟交易),
  停止损失 (use 止损), 取利 (use 止盈), 委员会 for fees (use 手续费), 签到 for sign in (签到 is a daily check-in; sign
  in = 登录), 索赔 / 声称 for claim (use 领取).
- **Overusing 的 and 被**: "你的仓位的强平价格的距离" -> "你的仓位离强平价有多远". Chinese avoids passive voice except
  for genuinely adverse events (被强平 is correct).
- **Overusing pronouns**: drop 你 / 它 where the subject is obvious. English "you" in every clause does not need a 你
  in every clause.
- **English word order**: put time and condition first ("在 100× 杠杆下，1% 的反向波动就会抹掉全部保证金"), the main
  clause last. Split long English sentences into two Chinese ones rather than stacking 的-clauses.
- **Translating product names or exchange names** (Paper Trade, MP Shop, Ticks, Binance, Bybit stay English).
- **Reformatting numbers** ($60,000 -> 6万美元 is wrong), or adding 美元 after a figure that already has $.
- **ASCII punctuation in Chinese prose**, spaces between Chinese characters, missing space between Chinese and Latin.
- **Traditional characters or Taiwan/HK vocabulary** (帳戶, 資訊, 軟體, 預設, 交易員 for every trader).
- **Translationese fillers**: 进行 + verb (进行交易 -> 交易), 对于……来说, 一个 before every noun, 作为一个……,
  通过……的方式. Cut them.
- **Inconsistent terms across one page**: once 强平价格, always 强平价格 on that page; do not alternate 强平/清算/爆仓
  for the same thing. 爆仓 is the colloquial word for a trader being wiped out ("别爆仓"), 强平 is the technical term
  for the price, the event and the data.
- **Half-English sentences**: "你的 stop-loss 在 entry 下面" is a bug - 你的止损在开仓价下方.

Read your own output once after writing it. A Chinese trader should not be able to tell it was translated.
