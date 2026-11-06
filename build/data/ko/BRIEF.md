# MarginPad - Korean (ko-KR) translation brief (read fully before translating a chunk)

You are translating the text of **marginpad.io**, a free crypto-futures tools site (calculators, a paper-trading
terminal, charts, a liquidation feed, an academy, a rewards layer, a bot API) into **Korean**. Readers are
Korean-speaking futures traders, mostly in South Korea, who already read the Korean pages of Bybit, Binance, OKX and
Bitget every day. The translation must read as if a Korean crypto trader wrote it: correct context, natural phrasing,
consistent terminology. Word-by-word output (translationese, 번역투) is a failure.

## Format you receive and return

Each chunk is a JSON array of items: `{ "id", "ctx", "kind", "en", "ko": "" }`.
- `ctx` = the page the string lives on (e.g. `/rewards/`). Use it to understand the context.
- `kind` = `html` (may contain inline tags), `title` (the browser tab title), `ld` (plain text for search-engine
  structured data), `attr:alt|title|placeholder|aria-label` (plain attribute text).
- Fill **`ko`** for every item. Never change `id`, `ctx`, `kind` or `en`. Never leave `ko` empty: if a string must
  stay identical (a brand, a ticker, a code word), copy `en` into `ko`.
- Write the whole array back to a sidecar file `NNN.ko.json` next to the chunk (same folder, same number) with the
  Write tool. Valid JSON only (escape `"` inside strings as `\"`). Never edit the chunk file itself.

## Hard rules

1. **Keep every HTML tag, attribute, href, entity exactly as it is** (`<a href="/x/">`, `<b>`, `<code>`, `&amp;`,
   `<br>`). Translate only the text between tags. The set of tags in `ko` must equal the set in `en`. Korean word
   order differs from English, so you MAY move a tagged phrase to where it belongs in the Korean sentence - but the
   tag keeps wrapping the same meaning (`<b>free</b>` -> `<b>무료</b>`), and no tag is added, dropped or split.
   (`&#39;`/`&rsquo;` may be dropped only when the Korean sentence genuinely has no apostrophe.)
2. **Never translate the inside of `<code>...</code>`**, URLs, paths (`/screener`), API field names, tickers
   (BTC, ETH, SOL, BTC/USDT), exchange names (Bybit, Binance, OKX, Gate, Bitget, MEXC, BingX, KuCoin, Kraken,
   Hyperliquid, Coinbase, Moon), numbers, currency amounts, percentages, `{placeholders}`, `%s`. Exchange names stay
   in Latin letters in UI text (write "Bybit", not "바이비트") - they are links and logos on the page.
3. **Numbers stay exactly as written** (60,000 stays 60,000; 0.4% stays 0.4%; $11.99 stays $11.99; 75× stays 75×).
   Western digits, the English comma/point format, `$` before the amount. Live widgets print numbers in that format
   and the static text must match them. Never convert to 만/억 ("$6만" is wrong; "$60,000" is right), never write
   "달러" instead of `$`. Units attach without a space when Korean does: `14일`, `5분`, `3회`, `10개`, `2배`.
   A `{placeholder}` keeps its braces and name exactly; put the particle after it as Korean needs (`{n}개`,
   `{t} 후`). Where the particle depends on a value you cannot see, prefer a form that works either way
   (`{name} 님`, a noun after the placeholder, or a sentence that needs no particle) instead of guessing 이/가.
4. Product names stay in English: **MarginPad, Paper Trade, MP Shop, Rekt, The Gold Room, Demo Spot, Meme Spot,
   Premium, Founder, Ticks, XP, Bot API, MCP, Daily Wrap, Happy Hour, Moon, Trading Report, Season Pass, Road to Bronze,
   Ask AI, My Trades, Bot Arena**. Common nouns around them are translated ("Paper Trade를 여세요", "MP Shop에서",
   "Premium 회원"). A particle attaches directly to the Latin name with no space and follows its English
   pronunciation (Premium**을**, MP Shop**에서**, Ticks**로**, XP**를**).
5. **Form of address: 합쇼체 / 해요체 polite-formal, the register the existing Korean site already uses.**
   - Statements and explanations end in **-ㅂ니다 / -습니다** ("청산 가격이 계산됩니다.", "수수료는 포함되지 않습니다.").
   - Requests and instructions end in **-하세요 / -세요** ("손절을 설정하세요.", "다시 시도하세요.") - never -해라,
     -해, -하십시오 (too stiff), never -하시기 바랍니다 in UI.
   - **Buttons, tabs, labels, table headers and nav items are noun phrases or the dictionary-form verb noun**, not
     sentences: "로그인", "$100 받기", "거래하기", "전체 보기", "포지션 열기" - never "로그인하세요" on a button.
   - **Do not write "당신" (you).** Korean omits the subject; "your balance" is "잔고" or "내 잔고", "your position" is
     "내 포지션" / "보유 포지션". Use "내" sparingly for clarity in labels ("내 거래", "내 순위"). "여러분" only in a
     genuine address to everyone (rare). The older academy text overuses 당신 - that is the mistake, do not copy it.
   - The short-sentence chart captions in the academy use plain style (-다): keep that ONLY when `ctx` is an academy
     visual caption and the neighbouring strings already do; everywhere else use -습니다/-세요.
6. Korean typography: see "Script and typography" below.
7. Titles (`kind: title`) should stay short (about 40 Korean characters when possible; Korean is denser than English)
   and keep the " | MarginPad" or " - MarginPad" suffix if present. Meta descriptions (`ld`, `attr`) about 80 Korean
   characters or fewer, never longer than the English. Put the searched phrase first ("비트코인 청산 계산기 - ...").
8. Buttons, labels, nav items and table headers must stay **short** - the same or fewer characters than the English,
   usually 2-6 Hangul syllables. Drop particles in labels ("진입 가격", not "진입의 가격").
9. Translate meaning, not words: an English idiom gets a Korean expression or plain wording ("skin in the game" ->
   "실제로 돈을 건", "rekt" in running text -> "청산당한"). Rebuild the sentence in Korean order (topic, then detail,
   verb last); one long English sentence may become two Korean ones.
10. Never leave a sentence half English. A stray English word in running text is a bug, except the terms that
    Korean traders and the Korean exchange sites really write in English or as standard abbreviations: **PnL, ROE,
    ROI, OI, DCA, APR, APY, FDV, ATR, RSI, MACD, EMA, SMA, VWAP, USDT, USDC, P2P, KYC, UID, API, AI**. Everything
    else is written in Hangul - either a Korean word or the established Hangul loan-word (롱, 숏, 펀딩비, 슬리피지,
    스크리너, 드로다운, 스캘핑, 스윙, 에어드롭, 러그, 펌프, 덤프). See the glossary.
11. No emojis, ever, even if the sentence sounds playful. No ㅋㅋ, no ~, no exclamation marks the English does not have.

## Which trading terms stay loan-words and which are translated

Korean futures traders use a mix that the big exchanges' Korean sites have standardised. Follow it:
- **Hangul loan-words (keep):** 롱, 숏, 레버리지, 펀딩비, 슬리피지, 스프레드, 테이커, 메이커, 드로다운, 백테스트,
  스크리너, 트레일링 스탑, 스캘핑, 스윙, 캔들, 타임프레임, 히트맵, 페이퍼 트레이딩, 트레이더, 시즌, 레벨, 미션,
  리더보드, 에어드롭, 스왑, 러그(풀), 펌프, 덤프, 풀백, 스퀴즈, 마크 가격, 무기한 선물(perp).
- **Korean words (translate):** 청산 (liquidation), 증거금 (margin), 격리/교차 (isolated/cross), 유지 증거금,
  포지션, 진입/청산(exit은 "종료" or "청산" by context), 익절 (take-profit), 손절 (stop-loss), 시장가/지정가 주문,
  호가창 (order book), 체결 (fill), 수수료, 미결제약정 (open interest), 손익, 손익비, 승률, 지지/저항, 돌파,
  고래, 보상, 출금, 잔고, 지갑, 거래소, 알림, 계정, 설정.
- Note the double meaning of 청산: it is **liquidation** on this site. For a voluntary close use **"종료"** or
  **"포지션 닫기"** ("close position" button = "포지션 종료"), and "exit price" = **"종료 가격"** (or "청산 가격" only
  in the old calculator labels that already use it). Never write "청산" for a trader's own close where a reader could
  read it as a forced liquidation.

## Glossary (use these consistently)

| English | Korean |
|---|---|
| liquidation price | 청산 가격 (short form in tight labels: 청산가) |
| liquidation (event) / liquidations | 청산 / 청산 |
| get liquidated / liquidated | 청산당하다 / 청산됨 |
| liquidation heatmap / map | 청산 히트맵 / 청산 맵 |
| liquidations feed | 청산 피드 |
| leverage | 레버리지 (75× stays 75×) |
| margin | 증거금 |
| isolated / cross margin | 격리 마진 / 교차 마진 (격리 / 교차 in tight labels) |
| maintenance margin (rate) | 유지 증거금 (유지 증거금률) |
| initial margin | 개시 증거금 |
| position / open position | 포지션 / 보유 포지션 (열린 포지션) |
| position size | 포지션 규모 |
| notional (value) | 명목 금액 (명목 가치) |
| long / short | 롱 / 숏 (롱 포지션, 숏 포지션) |
| go long / go short | 롱 진입 / 숏 진입 (롱을 잡다) |
| entry price / exit price | 진입 가격 / 종료 가격 |
| close a position (voluntary) | 포지션 종료 (닫기) |
| stop-loss / take-profit | 손절 / 익절 (SL / TP in tight labels; 스탑로스 only where the English is the order type name) |
| market order / limit order / stop order | 시장가 주문 / 지정가 주문 / 스탑 주문 |
| resting order | 대기 주문 |
| fill / filled | 체결 / 체결됨 |
| partial fill | 부분 체결 |
| order book | 호가창 |
| tape (trade tape) | 체결 내역 (테이프) |
| fee / fees / taker fee / maker fee | 수수료 / 수수료 / 테이커 수수료 / 메이커 수수료 |
| funding rate / funding | 펀딩비 / 펀딩 |
| open interest (OI) | 미결제약정 (OI) |
| mark price | 마크 가격 |
| perpetual futures (perp) | 무기한 선물 |
| spot | 현물 |
| futures | 선물 |
| PnL / unrealized / realized | 손익(PnL) / 미실현 손익 / 실현 손익 |
| ROE | ROE |
| break-even | 손익분기점 |
| risk/reward | 손익비 |
| win rate | 승률 |
| drawdown / max drawdown | 드로다운 / 최대 드로다운 |
| slippage | 슬리피지 |
| spread | 스프레드 |
| trailing stop | 트레일링 스탑 |
| backtest | 백테스트 |
| candle / candlestick | 캔들 / 캔들 |
| timeframe | 타임프레임 |
| chart | 차트 |
| indicator | 지표 |
| support / resistance | 지지 / 저항 |
| breakout / pullback | 돌파 / 되돌림(풀백) |
| trend | 추세 |
| volume | 거래량 |
| volatility | 변동성 |
| whale | 고래 |
| calculator | 계산기 |
| heatmap | 히트맵 |
| screener | 스크리너 |
| terminal (trading terminal) | 터미널 |
| leaderboard / board | 리더보드 / 보드 (ranking context: 순위) |
| rank | 순위 |
| season (14-day competition) | 시즌 |
| prize pool | 상금 풀 |
| prize | 상금 |
| competition | 대회 |
| claim (the faucet / a reward) | 받기 (button) / 받다 |
| faucet | 무료 수령 (파우셋 where the English names the feature) |
| withdrawal / withdraw | 출금 / 출금하다 |
| deposit | 입금 |
| reward / rewards | 보상 / 보상 |
| balance | 잔고 |
| wallet | 지갑 |
| exchange (noun) | 거래소 |
| account | 계정 (trading-balance sense: 계좌) |
| sign in / sign up / sign out | 로그인 / 가입 (회원가입) / 로그아웃 |
| free, no sign-up | 무료, 가입 불필요 |
| username | 사용자 이름 |
| profile | 프로필 |
| settings | 설정 |
| alert / price alert | 알림 / 가격 알림 |
| notification | 알림 |
| paper trading (concept) | 페이퍼 트레이딩 (모의 거래 as a gloss for beginners) |
| demo account | 데모 계정 |
| simulator | 시뮬레이터 |
| academy / lesson / course | 아카데미 / 레슨 / 코스 |
| quiz / exam | 퀴즈 / 시험 |
| mission (daily) | 미션 (일일 미션) |
| streak | 연속 기록 (N일 연속) |
| level (Bronze, Silver...) | 레벨 (브론즈, 실버, 골드, 플래티넘, 다이아몬드, 마스터, 레전더리) |
| member / Premium member | 회원 / Premium 회원 |
| subscription / plan | 구독 / 플랜 |
| referral / referral link | 추천 / 추천 링크 |
| sign-up bonus | 가입 보너스 |
| cosmetics / frame | 꾸미기 아이템 / 프레임 |
| follow / follower | 팔로우 / 팔로워 |
| duel | 대결 |
| squad | 스쿼드 |
| chat / direct message | 채팅 / DM (메시지) |
| trader | 트레이더 |
| trade (noun) / trade (verb) | 거래 / 거래하다 |
| buy / sell | 매수 / 매도 |
| price / live price | 가격 / 실시간 가격 |
| 24h change | 24시간 변동 |
| market cap | 시가총액 |
| liquidity | 유동성 |
| contract address | 컨트랙트 주소 |
| meme coin | 밈 코인 |
| altcoin | 알트코인 |
| stablecoin | 스테이블코인 |
| pump / dump / rug | 펌프 / 덤프 / 러그 |
| scalp / swing | 스캘핑 / 스윙 |
| airdrop / swap | 에어드롭 / 스왑 |
| short squeeze | 숏 스퀴즈 |
| guide / guides | 가이드 |
| home (breadcrumb) | 홈 |
| live (badge) | 실시간 |
| updated | 업데이트 |

## Script and typography

- **Spacing (띄어쓰기)** follows standard Korean: particles and endings attach to the word (가격을, 증거금이,
  거래소에서), dependent nouns are spaced (할 수 있습니다, 볼 수 있는 것), units after Arabic numerals attach
  (10배, 24시간, 3개) and a bare number + 원/달러 is not used (amounts keep `$`).
- **Punctuation:** use the ASCII marks the English uses - period `.`, comma `,`, colon `:`, question mark `?`,
  hyphen-dash ` - ` exactly as the English has it. No full-width punctuation (`。`, `，`, `：`). Use `·` only where the
  English already has it or for a list of short noun labels.
- **Quotes:** keep the English straight quotes `"..."` / `'...'` (and `&quot;` / `&#39;` entities exactly). No 「」, no
  『』, no curly quotes the English does not have.
- A Latin word, ticker or number inside Korean is NOT spaced away from its particle: "BTC가", "ETH를", "75×로",
  "MarginPad의". Particle choice follows how the Latin is read aloud (BTC가 - "비티씨", OKX에서, Bybit의).
- Parentheses are ASCII `( )`; a Korean term may carry the English in parentheses the first time on a page where it
  helps a beginner ("미결제약정(OI)"), never in buttons.
- No Hanja, no ending sentence fragments with "~" or "...", no exclamation marks unless the English has one.

## Common mistakes to avoid

1. **"당신" / "당신의"** everywhere - drop the subject or use 내/보유. "Your trades" = "내 거래", not "당신의 거래들".
2. **Plural "-들" copied from English** ("포지션들", "트레이더들") - Korean leaves plurals implicit; use 들 only when
   it reads natural ("모든 포지션", "트레이더 10명").
3. **Passive translationese** ("~에 의해 계산되어진다", "~되어집니다") - use active or simple passive ("계산합니다",
   "계산됩니다"). Never double passive -되어지다.
4. **"~하는 것이 가능합니다"** for "can" - write "~할 수 있습니다". Not "~를 가지고 있다" for "has" - write "~이 있다".
5. **Literal "make sure"/"keep in mind"** -> "확인하세요", "기억하세요"; not "확실히 하세요".
6. **청산 for a voluntary close** - see above; a trader's own close is 종료 / 포지션 닫기.
7. **Mixing registers**: one string in -습니다 and the next in -해/-한다 on the same page; or a button written as a
   full sentence. Statements -습니다, instructions -세요, controls as nouns.
8. **Converting numbers** to 만/억, adding 원 or 달러, or turning `$15` into "15달러" - keep the English figure.
9. **Transliterating what Korean traders translate** ("리퀴데이션", "마진" for margin in running text, "오더북",
   "오픈 인터레스트", "테이크 프로핏") or translating what they keep ("펀딩 비율" instead of 펀딩비, "장기/단기
   포지션" instead of 롱/숏).
10. **Reordering tags out of existence** - when moving a `<b>` or `<a>` phrase to Korean order, keep the tag around the
    same words and keep every tag; never merge two links into one.
11. **Over-long labels** - "포지션 규모 계산기 열기" where the English button is "Open" (just "열기").
12. **Honorific overkill** (-하시겠습니까, 고객님, -께서) - this is a trading tool, not a bank. Polite, plain, direct.

## Tone
Direct, confident, no fluff, no exclamation marks the English does not have. Short sentences. A trader is reading
between two trades - the voice of a Korean exchange's own product copy, not a translated manual.
