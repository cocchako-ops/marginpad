# MarginPad - French (fr-FR) translation brief (read fully before translating a chunk)

You are translating the text of **marginpad.io**, a free crypto-futures tools site (calculators, a paper-trading
terminal, charts, a liquidation feed, an academy, a rewards layer, a bot API) into **French**. Readers are
French-speaking futures traders in France, Belgium, Switzerland, Quebec and francophone Africa. The translation must
read as if a French crypto trader wrote it: correct context, natural phrasing, consistent terminology. Word-by-word
output is a failure.

## Format you receive and return

Each chunk is a JSON array of items: `{ "id", "ctx", "kind", "en", "fr": "" }`.
- `ctx` = the page the string lives on (e.g. `/rewards/`). Use it to understand the context.
- `kind` = `html` (may contain inline tags), `title` (the browser tab title), `ld` (plain text for search-engine
  structured data), `attr:alt|title|placeholder|aria-label` (plain attribute text).
- Fill **`fr`** for every item. Never change `id`, `ctx`, `kind` or `en`. Never leave `fr` empty: if a string must
  stay identical (a brand, a ticker, a code word), copy `en` into `fr`.
- Write the whole array back to a sidecar file `NNN.fr.json` next to the chunk (same folder, same number) with the
  Write tool. Valid JSON only (escape `"` inside strings as `\"`). Never edit the chunk file itself.

## Hard rules

1. **Keep every HTML tag, attribute, href, entity exactly as it is** (`<a href="/x/">`, `<b>`, `<code>`, `&amp;`,
   `<br>`). Translate only the text between tags. The set of tags in `fr` must equal the set in `en`. Do not add
   entities the English does not have (no `&nbsp;`, no `&laquo;` - type the characters themselves, see Typography).
   (`&#39;`/`&rsquo;` may be dropped only when the French sentence genuinely has no apostrophe at that point.)
2. **Never translate the inside of `<code>...</code>`**, URLs, paths (`/screener`), API field names, tickers
   (BTC, ETH, SOL, BTC/USDT), exchange names (Bybit, Binance, OKX, Gate, Bitget, MEXC, BingX, KuCoin, Kraken,
   Hyperliquid, Coinbase, Moon), numbers, currency amounts, percentages, `{placeholders}`, `%s`.
3. **Numbers stay exactly as written**, in the English format with Western digits: 60,000 stays 60,000; 0.4% stays
   0.4%; $11.99 stays $11.99 (the `$` stays in front, no "11,99 $"); 75× stays 75×; 24h stays 24h. Live widgets print
   numbers in that format and the static text must match them. Do not convert to French punctuation (no "60 000",
   no "0,4 %"), even though some older French packs on the site do - this pipeline does not.
4. Product names stay in English: **MarginPad, Paper Trade, MP Shop, Rekt, The Gold Room, Demo Spot, Meme Spot,
   Premium, Founder, Ticks, XP, Bot API, MCP, Daily Wrap, Happy Hour, Moon, Trading Report, Season Pass, Road to Bronze,
   Ask AI, My Trades, Bot Arena**. Common nouns around them are translated ("ouvre le Paper Trade", "dans le MP Shop",
   "ton Season Pass"). Board names that are product names (King of the Moon, The Gold Room) stay English too.
5. **Tutoiement** (tu / ton / ta / tes / clique / connecte-toi / essaie), never "vous". This is the form the existing
   French site already uses in all 19 Academy packs and the Demo Spot pack ("Connecte-toi pour commencer",
   "Ce que tu trades vraiment"), and the form crypto-native French products use with traders. The older homepage
   dictionary (`dist/assets/i18n/fr.js`) still says "vous" - that is legacy and is being replaced; do not copy it.
   Consistent throughout: a page must never mix tu and vous. Imperatives are second person singular ("Ouvre",
   "Calcule", "Choisis", "Réessaie"), not infinitives, except on bare UI labels where French UI uses the infinitive
   or a noun (button "Ouvrir", "Fermer", "Connexion").
6. French spelling with every accent, including on capitals (À, É, Ê, Ç: "État", "À propos", "ÉCHEC"). Correct
   gender and agreement. Sentence case in titles and headings, never English Title Case ("Calculateur de prix de
   liquidation", not "Calculateur De Prix De Liquidation"). Days and months are lowercase ("lundi", "9 novembre").
7. Titles (`kind: title`) should stay short (about 65 characters when possible) and keep the " | MarginPad" or
   " - MarginPad" suffix if present. Meta descriptions (`ld`, `attr`) 160 characters or fewer where the English is.
8. Buttons, labels, nav items and table headers must stay **short** (about the same length as the English). French
   runs 15-25% longer than English - choose the shorter synonym ("Frais" not "Frais de trading" where the context is
   clear, "Gains" not "Profits réalisés", "Réclamer" not "Réclamer maintenant") and drop articles on labels.
9. Translate meaning, not words: idioms get a French idiom or plain wording. "actual price" is "prix réel", never
   "prix actuel" unless it means the current price. "eventually" is "à terme / finalement", never "éventuellement".
10. Never leave a sentence half English. A stray English word in running text is a bug, except the glossary terms
    that stay in English (see below).
11. No emojis, ever, even if the sentence sounds playful.

## Terms that stay in English (this is how French crypto traders and the big exchanges' French sites write)

long, short, stop-loss, take-profit, funding, spread, slippage, maker, taker, drawdown, backtest, screener,
trailing stop, wallet, exchange, trader, trading, trade (un trade), paper trading, perp / perps, futures, spot,
PnL, ROE, ROI, OI, open interest, DCA, APR, APY, swap, airdrop, rug, pump, dump, scalp / scalping, swing, squeeze,
mark price, heatmap, faucet, tape, bot, token, coin, meme coin, stablecoin, altcoin, DeFi, KYC, API, webhook,
endpoint, staking, FOMO, FUD, ATH.

Gender (use it consistently): **le** stop-loss, **le** take-profit, **le** funding, **le** spread, **le** slippage,
**le** drawdown, **le** backtest, **le** screener, **le** trailing stop, **le** wallet, **l'**exchange (masc.:
"un exchange", "les exchanges"), **le** trade, **le** tape, **le** perp, **les** futures, **le** spot, **le** PnL,
**l'**open interest (masc.), **le** faucet, **le** bot, **le** token, **le** coin, **la** heatmap (feminine, and no
elision: "la heatmap", never "l'heatmap"), **la** DeFi, **le** KYC.

Verbs: "trader" is a normal French verb (je trade, tu trades, il trade, tradé). "shorter" (to go short) and
"longer" exist in trader slang but write "ouvrir un long / ouvrir un short" or "passer long / passer short" in
running text. Never "liquider" a position yourself: a position "est liquidée".

## Glossary (use these consistently)

| English | French |
|---|---|
| liquidation price | prix de liquidation |
| liquidation (event) / liquidations | liquidation / liquidations |
| get liquidated / liquidated | se faire liquider / liquidé (une position liquidée) |
| liquidation heatmap / map | heatmap de liquidations / carte des liquidations |
| liquidations feed | flux de liquidations |
| liquidation cascade | cascade de liquidations |
| leverage | levier (levier 10×, "à 10×"; "effet de levier" only for the general concept) |
| margin | marge |
| isolated / cross margin | marge isolée / marge croisée |
| maintenance margin (rate) | marge de maintenance (taux de marge de maintenance) |
| initial margin | marge initiale |
| position / open position | position / position ouverte |
| position size | taille de position |
| notional (value) | valeur notionnelle (le notionnel) |
| long / short | long / short (un long, un short, une position long / short) |
| go long / go short | ouvrir un long / ouvrir un short (passer long / passer short) |
| entry price / exit price | prix d'entrée / prix de sortie |
| entry / exit | entrée / sortie |
| stop-loss / take-profit | stop-loss / take-profit (le stop-loss) |
| trailing stop | trailing stop |
| market order / limit order / stop order | ordre au marché / ordre limite / ordre stop |
| resting order / pending order | ordre en attente |
| fill / filled | exécution / exécuté |
| order book | carnet d'ordres |
| tape (time and sales) | tape (flux des transactions in an explanation) |
| bid / ask | bid / ask (offre d'achat / offre de vente in an explanation) |
| fee / fees | frais (always plural: "les frais", "0.055% de frais") |
| taker fee / maker fee | frais taker / frais maker |
| funding rate / funding | taux de funding / funding |
| open interest (OI) | open interest (OI) |
| PnL / unrealized / realized | PnL / PnL non réalisé / PnL réalisé |
| ROE / ROI | ROE / ROI |
| break-even | seuil de rentabilité (break-even) |
| risk/reward | ratio risque/rendement |
| win rate | taux de réussite |
| drawdown / max drawdown | drawdown / drawdown maximal |
| slippage / spread | slippage / spread |
| candle / candlestick | bougie / chandelier (bougie in running text) |
| wick / close (of a candle) | mèche / clôture |
| timeframe | unité de temps |
| chart / charts | graphique / graphiques |
| indicator / signal | indicateur / signal |
| support / resistance | support / résistance |
| breakout / pullback | cassure / repli (pullback) |
| trend / uptrend / downtrend | tendance / tendance haussière / tendance baissière |
| bull / bear market | marché haussier / marché baissier |
| volatility / volume | volatilité / volume |
| market cap / dominance | capitalisation / dominance |
| Fear & Greed index | indice Peur & Avidité (Fear & Greed) |
| perpetual futures / perps | futures perpétuels / perps |
| whale / whales | baleine / baleines |
| whale tracker | suivi des baleines |
| trade (noun) / trades | trade / trades |
| trade (verb) | trader |
| trader | trader (un trader, une trader) |
| paper trading / paper trade | paper trading / trade fictif (trade démo) |
| demo account | compte démo |
| demo money | argent fictif (argent démo) |
| simulator | simulateur |
| calculator / calculators | calculateur / calculateurs |
| heatmap | heatmap |
| screener | screener |
| terminal | terminal |
| exchange (noun) | exchange (plateforme also fine in running text; "bourse" only for stock exchanges) |
| wallet / portfolio | wallet / portefeuille |
| balance | solde |
| deposit / withdraw / withdrawal | déposer / retirer / retrait |
| payout / payouts | paiement / paiements |
| claim (rewards, the faucet) | réclamer |
| reward / rewards | récompense / récompenses |
| faucet | faucet |
| mission / daily missions | mission / missions quotidiennes |
| streak | série |
| level / level up | niveau / monter de niveau |
| levels (Bronze, Silver...) | Bronze, Argent, Or, Platine, Diamant, Master, Légendaire (Unranked = Non classé) |
| season (14-day competition) | saison |
| season pass / pro pass | Season Pass (product) / pass Pro |
| leaderboard / board | classement / classement (nine boards = neuf classements) |
| prize pool | cagnotte |
| prize | prix (or "gain" when it means money won) |
| rank / ranked | rang / classé |
| duel / duels | duel / duels |
| badge / frame / background / skin | badge / cadre / fond / skin |
| ticket (the trade card) | ticket |
| trading journal | journal de trading |
| backtest / backtester | backtest / backtester |
| strategy | stratégie |
| alert / price alert | alerte / alerte de prix |
| push notification | notification push |
| API key | clé API |
| rate limit | limite de requêtes |
| bot / agent (AI) | bot / agent |
| account | compte |
| sign in / log in | se connecter (button: Connexion) |
| sign up | créer un compte / s'inscrire (button: Créer un compte) |
| sign out | se déconnecter (button: Déconnexion) |
| free, no sign-up | gratuit, sans inscription |
| username | nom d'utilisateur |
| settings | réglages |
| search | rechercher (label: Recherche) |
| home (breadcrumb, nav) | Accueil |
| academy / lesson / course | académie / leçon / cours |
| quiz | quiz |
| guides / blog | guides / blog |
| community | communauté |
| live / real-time | en direct / en temps réel |
| live price | prix en direct |
| Learn more / Read more | En savoir plus / Lire la suite |
| Get started | Commencer |
| Try it / Try now | Essaie / Essaie maintenant |
| Open (a trade) / Close | Ouvrir / Clôturer (Fermer for a window or panel) |
| Loading... | Chargement... |
| Updated / Last updated | Mis à jour / Dernière mise à jour |
| Coming soon | Bientôt |
| Not financial advice | Ceci n'est pas un conseil financier |

Currency and formats stay: `$60,000`, `0.4%`, `75×`, `24h`, `1m / 5m / 1h / 4h / 1D`, `UTC`.

## Typography (French-specific)

- **Before `:` `;` `!` `?` put a non-breaking space**, typed as the character U+00A0 (never the `&nbsp;` entity,
  which would break tag/entity parity): "Pourquoi ça compte ?" - "Attention : ...". This does NOT apply to `%`, which
  stays glued to the number as in English (rule 3), nor to a `:` inside a time, a ratio, a URL or code ("20:00",
  "1:2", "https://"). Never a space after an opening parenthesis or before a comma or full stop.
- **Quotes**: when the English uses quotation marks in running prose, use « guillemets » with a U+00A0 inside each
  side: « levier ». Inside HTML attributes, inside `<code>`, and in JSON-LD (`ld`) keep the straight quotes exactly
  as the English has them. Never turn a quote that belongs to an attribute or code into a guillemet.
- **Apostrophe**: the straight apostrophe `'` throughout (as the existing site text does: "l'exchange", "d'entrée").
  Elide correctly: l'exchange, l'open interest, d'un trade, qu'il, jusqu'à, s'il - but "le Paper Trade",
  "la heatmap", "le Season Pass", "de MarginPad".
- **Dashes**: keep the dashes the English uses (the site writes " - " as a spaced hyphen; keep it).
- **Ellipsis**: keep whatever the English uses ("..." or "…").
- **Capitals**: accents on capitals are mandatory, also in buttons and badges written in capitals ("ÉCHEC",
  "À VENIR", "RÉCLAMÉ").
- **Ordinals**: 1er, 2e, 3e (not 1st/2nd, not 2ème) when a rank is written in words; "#1" stays "#1".
- **Times**: keep the English format of the source ("20:00 UTC" stays "20:00 UTC"; do not write "20h").

## Common mistakes to avoid (they make French read as machine output)

1. "vous" anywhere, or mixing tu and vous on one page. Also infinitives where the English is a direct instruction
   to the reader ("Cliquer ici" -> "Clique ici").
2. False friends: "actuel" for actual (use réel), "éventuellement" for eventually, "librairie" for library
   (bibliothèque), "supporter" for support (prendre en charge), "réaliser" for realize = understand (se rendre
   compte), "opportunité" overused (use "occasion"), "digital" (numérique), "délai" for delay (retard), "consistant"
   for consistent (régulier, cohérent), "définitivement" for definitely (clairement, sans aucun doute).
3. English word order and noun stacks: "BTC liquidation price calculator" is "calculateur du prix de liquidation
   BTC", not "BTC liquidation prix calculateur". Use de/du/des to join nouns.
4. English Title Case in headings, or a capital after a colon.
5. Overusing "votre", "en utilisant", "afin de", "il est important de noter que", "en termes de", "au niveau de",
   "permettre de" on every line. Prefer short active verbs.
6. Translating terms that stay English ("arrêt des pertes", "prise de bénéfices", "financement", "glissement",
   "intérêt ouvert", "carte thermique", "carnet de commandes", "robinet") - use the glossary.
7. "effet de levier" every time: in a trading interface the word is "levier".
8. "Profit et perte" for PnL - write PnL. "Ratio de victoire" for win rate - write taux de réussite.
9. Wrong gender on English loanwords (glossary list above) or "l'heatmap".
10. Converting numbers or currencies ("60 000 $", "0,4 %", "11,99 €"), or translating `{placeholders}` and code.
11. Literal idioms ("à la fin du jour" for at the end of the day -> "au final"; "jeu changeant" for game changer ->
    "ça change tout"). Keep the punch, lose the calque.
12. Adding exclamation marks, softening or hedging the English, or making it longer than it needs to be.

## Tone
Direct, confident, no fluff, no exclamation marks the English does not have. Short sentences. A trader is reading
between two trades. Read your own output once after writing it and fix anything a French trader would notice.
