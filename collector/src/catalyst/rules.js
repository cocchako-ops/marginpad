// Catalyst Engine - the rules layer (2026-10-29). PURE: title + source in, {kind, expect, syms, market} out.
// Rules before any model: an exchange announcement, a filing, a hack headline and a macro print are recognised
// by their shape, and the direction (`expect`) is the TYPE's, never a sentiment guess. A title no rule matches is
// `news` with expect 0 and stays low-scored until a later layer (the worker's LLM pass, phase 2) labels it.
'use strict';

// Symbols the extractor may return: the collector's own list plus whatever Bybit lists (refreshed hourly by
// index.js through setSymbols). Never an arbitrary uppercase word.
let SYMS = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'LINK', 'AVAX', 'LTC']);
export function setSymbols(list) { if (Array.isArray(list) && list.length > 20) SYMS = new Set(list.map(s => String(s).toUpperCase())); }
export function symbolsKnown() { return SYMS.size; }
// English words that are also tickers: only counted when they wear a ticker shape ($X, XUSDT, (X), X/USDT).
const WORDY = new Set(['THE', 'ONE', 'AND', 'FOR', 'ARE', 'NOT', 'ALL', 'NEW', 'NOW', 'YOU', 'OUT', 'BIG', 'TOP', 'HOT', 'SPOT', 'CT', 'US', 'AI', 'OP', 'ARB', 'APE', 'GAS', 'SAND', 'MOON', 'ROSE', 'BAT', 'CAT', 'DOG', 'FLOW', 'HBAR', 'ME', 'IO', 'ID', 'ON', 'IN', 'AT', 'UP', 'MEW', 'PEOPLE', 'GRASS', 'JUP', 'BAND', 'STORJ', 'LOOKS', 'PIXEL', 'WIN', 'FLOKI', 'DEGEN', 'ACT', 'TRUMP', 'MAGIC', 'ORDER', 'SUPER', 'ALPHA', 'ZERO', 'API', 'DATA', 'CASH', 'CORE', 'MET', 'PERP', 'FUND', 'SAFE', 'PUMP', 'HYPE', 'PRIME', 'TIME', 'SPACE', 'TOKEN', 'COIN', 'MARKET']);
const NAMES = { HYPERLIQUID: 'HYPE', ASTER: 'ASTER', LIGHTER: 'LIGHTER', ZCASH: 'ZEC', MONERO: 'XMR', PEPE: 'PEPE', SHIBA: 'SHIB', WORLDCOIN: 'WLD', STARKNET: 'STRK', CELESTIA: 'TIA', INJECTIVE: 'INJ', SEI: 'SEI', JUPITER: 'JUP', RAYDIUM: 'RAY', PENDLE: 'PENDLE', ETHENA: 'ENA', ONDO: 'ONDO', RENDER: 'RENDER', FILECOIN: 'FIL', STELLAR: 'XLM', HEDERA: 'HBAR', ALGORAND: 'ALGO', COSMOS: 'ATOM', NEAR: 'NEAR', KASPA: 'KAS', MANTLE: 'MNT', BERACHAIN: 'BERA', MOVEMENT: 'MOVE', VIRTUALS: 'VIRTUAL', FARTCOIN: 'FARTCOIN', BONK: 'BONK', FLOKI: 'FLOKI', DOGWIFHAT: 'WIF', POPCAT: 'POPCAT', UNISWAP: 'UNI', AAVE: 'AAVE', MAKER: 'MKR', LIDO: 'LDO', EIGENLAYER: 'EIGEN', ARBITRUM: 'ARB', BITCOIN: 'BTC', ETHEREUM: 'ETH', ETHER: 'ETH', SOLANA: 'SOL', RIPPLE: 'XRP', DOGECOIN: 'DOGE', CARDANO: 'ADA', CHAINLINK: 'LINK', AVALANCHE: 'AVAX', LITECOIN: 'LTC', POLKADOT: 'DOT', TRON: 'TRX', POLYGON: 'POL', TONCOIN: 'TON', SUI: 'SUI', APTOS: 'APT', ARBITRUM: 'ARB', OPTIMISM: 'OP', PEPE: 'PEPE', SHIBA: 'SHIB', UNISWAP: 'UNI', AAVE: 'AAVE', MONERO: 'XMR', ZCASH: 'ZEC', STELLAR: 'XLM', NEAR: 'NEAR', FILECOIN: 'FIL', COSMOS: 'ATOM', TETHER: 'USDT', CIRCLE: 'USDC', WORLDCOIN: 'WLD', BALANCER: 'BAL', CURVE: 'CRV', LIDO: 'LDO', MAKER: 'MKR', COMPOUND: 'COMP', ARBITRUM: 'ARB', CELESTIA: 'TIA', INJECTIVE: 'INJ', RENDER: 'RENDER', ONDO: 'ONDO', ETHENA: 'ENA', JUPITER: 'JUP', PENDLE: 'PENDLE', STARKNET: 'STRK', ZKSYNC: 'ZK', IMMUTABLE: 'IMX', SANDBOX: 'SAND', DECENTRALAND: 'MANA', HEDERA: 'HBAR', ALGORAND: 'ALGO', KASPA: 'KAS', BITTENSOR: 'TAO', MANTLE: 'MNT', SEI: 'SEI', FANTOM: 'FTM', SONIC: 'S', THORCHAIN: 'RUNE', DYDX: 'DYDX', GMX: 'GMX', RAYDIUM: 'RAY', PUMPFUN: 'PUMP' };
// EDGAR issuer -> the coin its filing is about (a filer that is a company, not a fund, maps to nothing)
const ISSUER_SYM = [[/BITCOIN|ISHARES BITCOIN|GRAYSCALE BITCOIN|STRATEGY INC|MICROSTRATEGY|MARATHON|MARA HOLDINGS|RIOT|CLEANSPARK|CORE SCIENTIFIC|HUT 8|METAPLANET|SEMLER|BITCOIN DEPOT/i, 'BTC'], [/ETHEREUM|ETHER |ISHARES ETHEREUM|GRAYSCALE ETHEREUM|BITMINE|SHARPLINK|ETHZILLA/i, 'ETH'], [/SOLANA|SOL STRATEGIES|DEFI DEVELOPMENT|UPEXI|FORWARD INDUSTRIES/i, 'SOL'], [/XRP|RIPPLE/i, 'XRP'], [/LITECOIN/i, 'LTC'], [/DOGECOIN/i, 'DOGE'], [/AVALANCHE/i, 'AVAX'], [/CIRCLE INTERNET/i, 'USDC'], [/TETHER/i, 'USDT']];
export function issuerSymbols(title) { const out = []; for (const [re, s] of ISSUER_SYM) if (re.test(title) && !out.includes(s)) out.push(s); return out; }

export function extractSymbols(text, opts) {
  const t = String(text || '');
  const out = new Set();
  const any = !!(opts && opts.anyTicker); // an exchange announcement names a NEW symbol - it need not be on Bybit's list yet
  // ticker shapes: $BTC, BTCUSDT, BTC/USDT, (BTC), BTC-USDT, BTCUSD X-Perp
  for (const m of t.matchAll(/(?:\$|\b)([A-Z0-9]{2,10})(?:USDT|USDC|USD|\/USDT|-USDT|-USD)\b/g)) if (any || SYMS.has(m[1])) out.add(m[1]);
  for (const m of t.matchAll(/\(([A-Z0-9]{2,10})\)/g)) if (any || SYMS.has(m[1])) out.add(m[1]);
  for (const m of t.matchAll(/\$([A-Z0-9]{2,10})\b/g)) if (any || SYMS.has(m[1])) out.add(m[1]);
  // bare tickers (only the non-wordy ones)
  for (const m of t.matchAll(/\b([A-Z][A-Z0-9]{1,9})\b/g)) if (SYMS.has(m[1]) && !WORDY.has(m[1])) out.add(m[1]);
  // names
  for (const m of t.toUpperCase().matchAll(/\b([A-Z]{3,12})\b/g)) if (NAMES[m[1]]) out.add(NAMES[m[1]]);
  return [...out].slice(0, 8);
}

const R = {
  promo: /\b(recap|round-?up|digest|weekly (listing|summary)|monthly|celebrate|invite (a )?friend|earn up to|prize pool|giveaway|rewards? hub|trading competition|token splash|launchpool|launchpad|bonus|airdrop campaign|refer(ral)?s?\b|cashback|VIP|learn (&|and) earn|quiz|AMA\b)/i,
  pair: /\b(removal of (spot|margin|cross|isolated)( trading)? pairs?|(spot|margin) trading pairs?|adds? (new )?(spot|margin)( trading)? pairs?|trading pair updates?)\b/i,
  delisting: /\b(delist(s|ed|ing)?|removal of|will be removed|terminat(e|es|ed|ion) (of )?(the )?(perpetual|contract|trading)|cease trading)\b/i,
  listing: /\b(list(s|ed|ing)?|launch(es|ed|ing)? (spot|perpetual|perps?|futures|pre-?market)|new (spot|perpetual|perps?|futures)( trading)? (pair|contract|market)|now (live|trading)|pre-?market perpetual)\b/i,
  hack: /\b(hack(s|ed|er|ers)?|exploit(s|ed)?|drain(s|ed)?|stolen|breach(ed)?|rug(ged|-?pull)?|attack(s|ed|er)?|compromised|phishing|depeg(s|ged)?)\b/i,
  etf: /\b(ETF|ETFs|S-1|19b-4|spot (bitcoin|ether|ethereum|solana|xrp|litecoin|dogecoin|avalanche) (fund|trust)|iShares|Grayscale|net inflows?|net outflows?)\b/i,
  regulation: /\b(SEC|CFTC|DOJ|FCA|ESMA|MiCA|regulat(or|ion|ory|e|es|ed)|lawsuit|sue[sd]?|charg(e|es|ed) (with|by)|indict(ed|ment)|fine[ds]?|penalt(y|ies)|settle(s|d|ment)|court|judge|ruling|ban(s|ned)?|licen[cs]e[sd]?|approv(al|ed|es)|reject(s|ed|ion)|sanction(s|ed)?|subpoena|executive order|stablecoin (bill|act)|GENIUS Act|CLARITY Act)\b/i,
  unlock: /\b(token )?unlock(s|ed|ing)?\b/i,
  protocol: /\b(outage|halt(s|ed|ing)?|paus(e|es|ed)|downtime|upgrade|hard ?fork|mainnet|testnet|airdrop|migration|network (is )?down|chain (is )?(halted|stalled)|validator)\b/i,
  whale: /\b(whale|large transfer|moves? \$?[0-9]|transferred|minted|burned|mint(s|ed)?|burn(s|ed)?)\b/i,
  politics: /\b(Trump|White House|tariff(s)?|Powell|Federal Reserve|Fed (rate|cut|hike|chair)|rate (cut|hike)|Congress|Senate|Treasury Secretary|Bessent|election|Truth Social)\b/i,
  adoption: /\b(partner(s|ed|ship)?|integrat(es|ed|ion)|adopt(s|ed|ion)|accept(s|ing)? (bitcoin|crypto|BTC|USDT)|treasury (buys?|purchase|adds)|acqui(res?|sition)|invest(s|ed|ment) in)\b/i,
};
const KIND_EXPECT = { listing: 1, delisting: -1, hack: -1, etf: 0, regulation: 0, unlock: -1, protocol: 0, whale: 0, politics: 0, adoption: 1, macro: 0, filing: 0, pair: 0, promo: 0, news: 0 };

// what the exchange announcement is about (perp / spot / pre-market / tradfi); tradfi listings are kept but scored low
export function marketOf(title) {
  const t = String(title || '');
  if (/TradFi|Pre-?IPO|\bstock(s)?\b|\bCFD\b|Equity|Tokenized Stock|xStock/i.test(t)) return 'tradfi';
  if (/Pre-?Market/i.test(t)) return 'premarket';
  if (/Perpetual|Contract|Futures|X-Perp|Swap/i.test(t)) return 'perp';
  if (/\bSpot\b|Trading Pair|\/USDT|\/USDC/i.test(t)) return 'spot';
  return '';
}

export function classify(title, source) {
  const t = String(title || '');
  const src = String(source || '');
  const exch = /^(bybit-ann|okx-ann|hl-meta|binance-ann|upbit-ann|tg:binance|tg:bybit|tg:okx|x:binance|x:Bybit_Official)/i.test(src);
  let kind = 'news';
  if (src === 'calendar') kind = 'macro';
  else if (src === 'sec') kind = 'filing';
  else if (R.promo.test(t)) kind = 'promo';                       // a campaign, a recap, a contest: never an event
  else if (R.pair.test(t)) kind = 'pair';                         // a trading PAIR added or removed is housekeeping, not a listing
  else if (R.delisting.test(t)) kind = 'delisting';
  else if (exch && R.listing.test(t)) kind = 'listing';
  else if (R.hack.test(t)) kind = 'hack';
  else if (R.etf.test(t)) kind = 'etf';
  else if (R.unlock.test(t)) kind = 'unlock';
  else if (R.regulation.test(t)) kind = 'regulation';
  else if (R.listing.test(t)) kind = 'listing';
  else if (R.protocol.test(t)) kind = 'protocol';
  else if (/^tg:whale_alert/.test(src) || R.whale.test(t)) kind = 'whale';
  else if (R.politics.test(t)) kind = 'politics';
  else if (R.adoption.test(t)) kind = 'adoption';
  let expect = KIND_EXPECT[kind];
  // an ETF or regulation headline carries its own direction in plain words
  if (kind === 'etf' || kind === 'regulation') {
    if (/\b(approv(al|ed|es)|green ?light|inflows?|record inflow|clears?|wins?|dismiss(ed|es)|drops? (the )?(case|charges|lawsuit)|grants?)\b/i.test(t)) expect = 1;
    else if (/\b(reject(s|ed|ion)|delay(s|ed)|outflows?|denies|denied|sue[sd]?|lawsuit|charg(es|ed)|fine[ds]?|ban(s|ned)?|halt|freez(e|es|ing)|indict)\b/i.test(t)) expect = -1;
  }
  const market = exch ? marketOf(t) : '';
  if (market === 'tradfi') expect = 0; // a stock perp is not a coin event
  const syms = src === 'sec' ? issuerSymbols(t) : extractSymbols(t, { anyTicker: exch && market !== 'tradfi' });
  return { kind, expect, syms, market };
}

// confirmation cluster key: the title's content words, lowercased, first six in order
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'was', 'with', 'by', 'at', 'as', 'its', 'from', 'that', 'this', 'will', 'has', 'have', 'be', 'new', 'listing', 'list', 'now', 'live', 'bybit', 'okx', 'binance', 'perpetual', 'contract', 'usdt', 'spot', 'crypto', 'cryptocurrency', 'bitcoin', 'btc', 'says', 'after', 'amid', 'over', 'into', 'up', 'down', 'more', 'than', 'how', 'why', 'what']);
export function clusterKey(title) {
  const words = String(title || '').toLowerCase().replace(/[^a-z0-9$ ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
  return words.slice(0, 6).join(' ');
}

export const TIER_CRED = { primary: 1.0, official: 0.9, mediaA: 0.7, mediaB: 0.5, social: 0.25 };
export const KIND_BASE = { macro: 25, hack: 25, listing: 20, delisting: 20, etf: 20, regulation: 12, unlock: 12, filing: 12, protocol: 10, politics: 10, whale: 8, adoption: 8, pair: 0, promo: 0, news: 0 };
// v0 score: documented, replaced by the F0 event-study priors (build/data/catalyst/report.json) once each cell has n >= 30
export function scoreOf({ tier, kind, conf, market, syms }) {
  if (kind === 'promo') return 0;
  let s = 45 * (TIER_CRED[tier] || 0.4) + Math.min(20, 8 * Math.max(0, (conf || 1) - 1)) + (KIND_BASE[kind] || 0);
  if (market === 'tradfi') s *= 0.4;
  if ((kind === 'news' || kind === 'pair') && !(syms && syms.length)) s *= 0.5;
  return Math.max(0, Math.min(100, Math.round(s)));
}
// confirmation: two titles are the same story when their content-token sets overlap enough (Jaccard), so that
// "zkLink Nova bridge exploit enables unauthorized withdrawals" and "zkLink Nova Bridge Exploit Drains About $779,000"
// count as one story from two desks. Tokens: words of 4+ letters minus stopwords, plus tickers and numbers.
export function tokens(title) {
  const t = String(title || '').toLowerCase().replace(/[^a-z0-9$% ]+/g, ' ');
  return new Set(t.split(/\s+/).filter(w => (w.length >= 4 || /^\$?[a-z0-9]{2,5}$/.test(w) && /\d|\$/.test(w)) && !STOP.has(w)));
}
export function jaccard(a, b) { if (!a.size || !b.size) return 0; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); }
export const SAME_STORY = 0.34;
export function stripEmoji(s) { return String(s || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}️‍]/gu, '').replace(/\s+/g, ' ').trim(); }
