/* /exchanges/ — deep, trader-focused comparison of every major crypto exchange. How each choice actually hits you
   mid-trade (fees→PnL, leverage→liquidation, liquidity→slippage, funding→hold cost, trust→your money's safety).
   Affiliate links throughout (rel=sponsored, click-tracked). Includes an honest KuCoin trust/reputation section. */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist', 'exchanges');

const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';
const url = 'https://marginpad.io/exchanges/';
const title = 'Crypto Exchange Comparison 2026 — Fees, Leverage, Liquidity & Trust';
const desc = 'A trader-first comparison of every major crypto exchange — Bybit, Binance, OKX, Bitget, MEXC, Gate, KuCoin, Kraken and more. Real futures fees, max leverage, liquidity, KYC, US access and a hard look at trust and safety (including the KuCoin controversy). No fluff.';
const kw = 'crypto exchange comparison, best crypto futures exchange, bybit vs binance, lowest fee crypto exchange, best leverage exchange, kucoin safe, crypto exchange fees, best exchange for trading, moon trading platform, trade stocks and crypto in one account';
const lg = id => 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/' + id + '.png';

// Editorial ratings are our take (0-100), meant for at-a-glance comparison — not financial advice. Fees are the
// standard/base VIP-0 tier (VIP levels + the referral fee discount lower them). Pair counts & leverage are approximate.
const EX = [
  { key: 'bybit', name: 'Bybit', logo: 521, color: '#f7a600', href: 'https://www.bybit.com/invite?ref=LZKBERJ',
    lev: '100×', tk: '0.055%', mk: '0.02%', pairs: '500+', kyc: 'Optional*', us: 'No', bonus: 'Up to 30,000 USDT + 20% off fees',
    r: { fees: 85, liq: 92, mkts: 88, lev: 80, trust: 84, easy: 88 }, badge: 'Best all-round for futures',
    feel: 'The default home base for derivatives traders. Deep books on majors so your market orders fill near the mid-price, a fast matching engine that rarely lags in volatility, and a clean pro UI. Liquidations use a fair-price mark, so you’re less likely to get wicked out by a single bad print.',
    pro: ['Very deep liquidity → low slippage on majors', 'Clean, fast pro interface + great mobile app', 'Fair mark-price liquidations', 'Basic use without full KYC (withdrawal limits apply)'],
    con: ['Not available to US residents', 'Base taker fee slightly above Binance/OKX'] },
  { key: 'binance', name: 'Binance', logo: 270, color: '#f0b90b', href: 'https://www.binance.com/register?ref=MAOZM9DS',
    lev: '125×', tk: '0.05%', mk: '0.02%', pairs: '400+', kyc: 'Required', us: 'Binance.US', bonus: '20% off fees for life + welcome voucher',
    r: { fees: 88, liq: 100, mkts: 85, lev: 88, trust: 86, easy: 55 }, badge: 'Deepest liquidity on earth',
    feel: 'The biggest book in crypto. On BTC/ETH your slippage is basically zero and funding is the reference the whole market watches. The trade-off is mandatory KYC and a heavier, feature-dense interface. If raw execution quality on majors is your priority, nothing beats it.',
    pro: ['#1 liquidity → the tightest spreads anywhere', 'Reference funding + the most-watched order book', 'Huge product suite (earn, convert, options)'],
    con: ['Full KYC required before trading', 'US users pushed to the thinner Binance.US', 'UI can overwhelm beginners'] },
  { key: 'okx', name: 'OKX', logo: 294, color: '#cfd3da', href: 'https://okx.com/join/96160298',
    lev: '125×', tk: '0.05%', mk: '0.02%', pairs: '300+', kyc: 'Required', us: 'Limited', bonus: 'Up to 100 USDT + mystery boxes',
    r: { fees: 86, liq: 90, mkts: 82, lev: 88, trust: 85, easy: 62 }, badge: 'Pro tooling + strong liquidity',
    feel: 'A serious trader’s exchange — excellent charting, unified account margin (spot, perps and options share collateral), and deep books just behind Binance/Bybit. Great if you run complex multi-leg positions or want one balance backing everything.',
    pro: ['Unified account — one balance margins spot + perps + options', 'Deep liquidity, strong execution', 'Best-in-class built-in charts & tools'],
    con: ['KYC required', 'Unified-margin model has a learning curve'] },
  { key: 'bitget', name: 'Bitget', logo: 513, color: '#00e7d8', href: 'https://www.bitget.com/referral/register?clacCode=DSSSQKGK&from=%2Fevents%2Freferral-all-program&source=events&utmSource=PremierInviter',
    lev: '125×', tk: '0.06%', mk: '0.02%', pairs: '500+', kyc: 'Optional*', us: 'No', bonus: 'Up to 6,200 USDT + 20% off fees',
    r: { fees: 82, liq: 80, mkts: 88, lev: 88, trust: 74, easy: 84 }, badge: 'Copy-trading leader',
    feel: 'Best-known for copy trading — you can mirror top futures traders automatically, which is handy while you learn. Liquidity on majors is solid (a notch below the top three) and the app is beginner-friendly. A large public insurance fund backs the derivatives engine.',
    pro: ['Deep copy-trading marketplace', 'Beginner-friendly app', 'Large published insurance fund'],
    con: ['Liquidity thinner than Bybit/Binance on altcoins', 'Some listed perps are illiquid — mind slippage'] },
  { key: 'mexc', name: 'MEXC', logo: 544, color: '#1972ff', href: 'https://promote.mexc.com/r/GND4jI97o0',
    lev: '500×', tk: '0.02%', mk: '0.00%', pairs: '700+', kyc: 'Optional (light)', us: 'No', bonus: 'Up to 10,000 USDT + $20 gift',
    r: { fees: 94, liq: 62, mkts: 98, lev: 100, trust: 62, easy: 82 }, badge: 'Lowest fees + most pairs',
    feel: 'The degen playground: the lowest taker fees around (often 0% maker), up to 500× leverage and the widest list of new/low-cap perps — you’ll find pairs here that exist nowhere else. The catch: those exotic books are thin, so slippage and wick-outs are real. Great for cheap majors trading and early listings, risky for size on small caps.',
    pro: ['Lowest trading fees (0% maker on many pairs)', 'The most listings — catch new coins first', 'Extreme leverage available (up to 500×)'],
    con: ['Thin liquidity on exotic pairs → slippage & wick-outs', '500× is a liquidation trap for most', 'Lighter oversight than the top tier'] },
  { key: 'gate', name: 'Gate.io', logo: 302, color: '#17e6a1', href: 'https://www.gate.com/VFIWB10KUG?ref=VFIWB10KUG&ref_type=103&ut-m_cmp=rXJBDjtJ&activity_id=1778642196063',
    lev: '100×', tk: '0.05%', mk: '0.02%', pairs: '500+', kyc: 'Optional*', us: 'No', bonus: 'Up to 6,666 USDT + 20% off fees',
    r: { fees: 84, liq: 66, mkts: 95, lev: 80, trust: 70, easy: 70 }, badge: 'Huge altcoin selection',
    feel: 'A veteran exchange with an enormous catalog — if a coin is tradeable anywhere, it’s probably on Gate. Publishes proof-of-reserves. Majors are fine; the long tail is where liquidity thins out, so treat small-cap perps with respect.',
    pro: ['One of the widest coin selections in crypto', 'Publishes Merkle-tree proof of reserves', 'Long track record'],
    con: ['Altcoin liquidity varies a lot', 'Interface feels dated in places'] },
  { key: 'kraken', name: 'Kraken', logo: 24, color: '#7b6cf6', href: 'https://invite.kraken.com/JDNW/guj2tf28',
    lev: '50×', tk: '0.05%', mk: '0.02%', pairs: '50+', kyc: 'Required', us: 'Yes', bonus: 'Up to $200 — sign up & trade',
    r: { fees: 78, liq: 78, mkts: 42, lev: 50, trust: 95, easy: 66 }, badge: 'Most trusted / US-friendly',
    feel: 'The safety-first pick. Long, clean security record, strong regulatory standing, and one of the few solid options for US traders who want real derivatives. Fewer perps and lower max leverage — by design. If you value sleeping at night over 125×, this is your exchange.',
    pro: ['Best-in-class security & compliance track record', 'Available to US traders (Kraken Pro / futures)', 'Transparent, well-regulated operation'],
    con: ['Far fewer perp markets', 'Max 50× leverage', 'Full KYC required'] },
  { key: 'coinbase', name: 'Coinbase', logo: 89, color: '#1652f0', href: 'https://base.app/invite/chakko/FHSFNY5H',
    lev: '~10×', tk: '0.05%*', mk: '0.00%*', pairs: '30+', kyc: 'Required', us: 'Yes', bonus: 'Invite via Base App',
    r: { fees: 60, liq: 82, mkts: 30, lev: 20, trust: 98, easy: 74 }, badge: 'Most regulated (US)',
    feel: 'The blue-chip, publicly-listed US exchange — the highest bar on regulation and custody. Derivatives are limited and leverage is low, and spot fees on the simple app are high (use Advanced Trade for lower fees). This is the “my funds are safe” choice, not the “max leverage” one.',
    pro: ['Publicly listed, most-regulated major (US)', 'Gold-standard custody & insurance', 'Simple on-ramp for beginners'],
    con: ['Very limited derivatives + low leverage', 'High fees on the basic app', 'Not a pro futures venue'] },
  { key: 'kucoin', name: 'KuCoin', logo: 311, color: '#23af91', href: 'https://www.kucoin.com/r/rf/VHP8AYKY',
    lev: '100×', tk: '0.06%', mk: '0.02%', pairs: '300+', kyc: 'Optional*', us: 'Banned', bonus: 'Up to 11,000 USDT rewards',
    r: { fees: 78, liq: 60, mkts: 78, lev: 80, trust: 28, easy: 76 }, badge: '⚠ Trust concerns — read below', warn: true,
    feel: 'Once a popular altcoin-and-futures venue, KuCoin now carries serious reputation baggage (details in the trust section below). The product itself is usable — decent selection, familiar UI — but the questions around victim handling, KYC integrity and regulation are the real story here. Treat any funds you keep there as at-risk and do your own research.',
    pro: ['Wide altcoin & futures selection', 'Familiar, capable trading UI'],
    con: ['Serious trust & compliance controversies (see below)', 'Pleaded guilty in the US (2025); US-banned', 'On-chain investigators allege poor victim & law-enforcement cooperation'] },
];

const RB = (label, v, col) => '<div class="rb"><span class="rb-k">' + label + '</span><span class="rb-t"><span class="rb-f" style="width:' + v + '%;background:' + (col || 'var(--lime)') + '"></span></span><span class="rb-v">' + Math.round(v / 20 * 10) / 10 + '</span></div>';

const card = e => {
  const warn = e.warn;
  return '<div class="exc' + (warn ? ' exc-warn' : '') + '" id="ex-' + e.key + '">'
    + '<div class="exc-h"><span class="exc-lg" style="--c:' + e.color + '"><img src="' + lg(e.logo) + '" alt="' + e.name + ' logo" width="30" height="30" loading="lazy" onerror="this.parentNode.textContent=\'' + e.name[0] + '\'"></span>'
    + '<div class="exc-t"><b>' + e.name + '</b><span class="exc-badge' + (warn ? ' warn' : '') + '">' + e.badge + '</span></div>'
    + '<span class="exc-lev">' + e.lev + '<small>max lev</small></span></div>'
    + '<div class="exc-feel">' + e.feel + '</div>'
    + '<div class="exc-rr">' + RB('Fees', e.r.fees) + RB('Liquidity', e.r.liq) + RB('Markets', e.r.mkts) + RB('Leverage', e.r.lev, '#ffb020') + RB('Trust &amp; safety', e.r.trust, warn ? '#ff5a4d' : '#2ebd85') + RB('KYC-free / ease', e.r.easy) + '</div>'
    + '<div class="exc-pc"><div class="exc-pros"><div class="exc-pch">What helps your trade</div>' + e.pro.map(p => '<div class="exc-li pro">' + p + '</div>').join('') + '</div>'
    + '<div class="exc-cons"><div class="exc-pch">What can bite you</div>' + e.con.map(p => '<div class="exc-li con">' + p + '</div>').join('') + '</div></div>'
    + '<a class="exc-cta' + (warn ? ' warn' : '') + '" data-ex="' + e.name + '" href="' + e.href + '" target="_blank" rel="sponsored noopener noreferrer">' + (warn ? 'Visit KuCoin (proceed with caution)' : 'Get the ' + e.name + ' bonus') + ' →</a>'
    + '<div class="exc-bonus">' + (warn ? '⚠ ' : '🎁 ') + e.bonus + '</div></div>';
};

const trow = e => '<tr' + (e.warn ? ' class="tw"' : '') + '><td class="tx"><span class="tlg" style="--c:' + e.color + '"><img src="' + lg(e.logo) + '" width="20" height="20" loading="lazy" alt="" onerror="this.parentNode.textContent=\'' + e.name[0] + '\'"></span>' + e.name + '</td>'
  + '<td><b>' + e.lev + '</b></td><td>' + e.tk + '</td><td>' + e.mk + '</td><td>' + e.pairs + '</td><td>' + e.kyc + '</td>'
  + '<td class="' + (e.us === 'Yes' ? 'ok' : (e.us === 'No' || e.us === 'Banned' ? 'no' : '')) + '">' + e.us + '</td>'
  + '<td><span class="tscore" style="--v:' + e.r.trust + ';--tc:' + (e.r.trust >= 80 ? '#2ebd85' : e.r.trust >= 55 ? '#ffb020' : '#ff5a4d') + '">' + Math.round(e.r.trust / 20 * 10) / 10 + '</span></td>'
  + '<td class="tgo"><a data-ex="' + e.name + '" href="' + e.href + '" target="_blank" rel="sponsored noopener noreferrer">' + (e.warn ? 'Caution' : 'Claim') + ' →</a></td></tr>';

const HEADER_CSS = `
  header{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px clamp(18px,3vw,52px);position:sticky;top:0;z-index:50;background:rgba(11,13,18,.82);-webkit-backdrop-filter:blur(10px) saturate(1.2);backdrop-filter:blur(10px) saturate(1.2);border-bottom:1px solid rgba(255,255,255,.06)}
  .brand{display:flex;align-items:baseline;gap:10px;border:none;padding:0;background:none}
  header .mark{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:22px;letter-spacing:-.04em;cursor:pointer;color:#f0eee6;text-decoration:none}
  header .mark b{color:#c2f64a}
  .hmenu{display:inline-flex;flex-direction:column;justify-content:center;gap:4px;width:30px;height:30px;padding:0 6px;background:none;border:none;cursor:pointer;align-self:center}
  .hmenu span{display:block;height:2.5px;width:18px;border-radius:2px;background:#c2f64a;box-shadow:0 0 6px rgba(194,246,74,.5);transition:.2s}
  .hmenu span:nth-child(2){width:13px}
  header .hnav{display:flex;align-items:center;gap:3px}
  .hlink{display:inline-flex;align-items:center;gap:6px;font-family:'Space Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#a6afba;text-decoration:none;background:transparent;border:none;cursor:pointer;padding:7px 9px;border-radius:9px;transition:.15s}
  .hlink:hover{color:#fff;background:rgba(255,255,255,.07)}
  .hlink svg{flex-shrink:0}
  .hbot{color:#7cc4ff}.hbot:hover{color:#a8d8ff;background:rgba(124,196,255,.12)}
  .hrwd{color:#c2f64a}.hrwd:hover{color:#d4f87a;background:rgba(194,246,74,.12)}
  @media(max-width:720px){header .hnav .hbot,header .hnav .hjr{display:none}header .hnav .hauth span{display:none}header .hnav .hauth{padding:7px}}
`;
const CSS = HEADER_CSS + `
  :root{--lime:#c2f64a;--grn:#2ebd85;--red:#ff5a4d;--amber:#ffb020;--cyan:#3fd8e6}
  .ex-glow{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(52% 50% at 8% 0%,rgba(194,246,74,.08),transparent 60%),radial-gradient(48% 55% at 94% 20%,rgba(46,189,133,.06),transparent 60%)}
  .wrap{position:relative;z-index:1}
  .ex-eyebrow{display:inline-flex;align-items:center;gap:9px;font-family:'Space Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#8a95a1;margin-top:14px}
  .ex-eyebrow i{width:8px;height:8px;border-radius:50%;background:var(--lime);box-shadow:0 0 10px var(--lime)}
  .lead{font-size:15.5px;line-height:1.6;color:var(--ink-dim);max-width:820px}
  .disc-top{margin:14px 0 2px;font-family:'Space Mono',monospace;font-size:11px;color:var(--ink-faint);background:rgba(255,255,255,.03);border:1px solid var(--line-bright);border-radius:11px;padding:10px 13px;line-height:1.5}
  /* factor strip */
  .fx{display:grid;grid-template-columns:repeat(2,1fr);gap:11px;margin:22px 0 8px}
  @media(min-width:760px){.fx{grid-template-columns:repeat(3,1fr)}}
  .fx-c{background:var(--panel);border:1px solid var(--line-bright);border-radius:14px;padding:14px 15px}
  .fx-c b{font-family:'Familjen Grotesk',sans-serif;font-size:14.5px;color:var(--ink);display:flex;align-items:center;gap:8px}
  .fx-c b i{width:9px;height:9px;border-radius:3px;display:inline-block}
  .fx-c p{font-size:12.5px;color:var(--ink-dim);line-height:1.5;margin:7px 0 0}
  .h2{font-family:'Bricolage Grotesque','Familjen Grotesk',sans-serif;font-weight:800;font-size:clamp(22px,3vw,28px);letter-spacing:-.02em;color:var(--ink);margin:34px 0 4px}
  .h2s{font-size:13.5px;color:var(--ink-faint);margin:0 0 16px}
  /* table */
  .tw-wrap{overflow-x:auto;border:1px solid var(--line-bright);border-radius:16px;background:var(--panel)}
  table.cmp{width:100%;border-collapse:collapse;font-size:13px;min-width:760px}
  table.cmp th{font-family:'Space Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-faint);font-weight:700;text-align:left;padding:12px 12px;border-bottom:1px solid var(--line-bright);white-space:nowrap;background:rgba(255,255,255,.02)}
  table.cmp td{padding:12px 12px;border-bottom:1px solid rgba(255,255,255,.05);color:var(--ink-dim);white-space:nowrap;font-family:'Space Mono',monospace}
  table.cmp tr:last-child td{border-bottom:none}
  table.cmp tr.tw td{background:rgba(255,90,77,.05)}
  table.cmp .tx{color:var(--ink);font-weight:700;font-family:'Familjen Grotesk',sans-serif;display:flex;align-items:center;gap:8px}
  .tlg,.exc-lg{display:inline-flex;align-items:center;justify-content:center;border-radius:6px;background:#fff;overflow:hidden;flex:0 0 auto;font-weight:800;color:#0a0b0d}
  .tlg{width:22px;height:22px}.tlg img{width:20px;height:20px;object-fit:contain}
  table.cmp td.ok{color:var(--grn)}table.cmp td.no{color:var(--red)}
  .tscore{font-weight:700;color:var(--tc)}
  .tgo a{color:var(--lime);text-decoration:none;font-weight:700}
  table.cmp tr.tw .tgo a{color:var(--amber)}
  /* exchange cards */
  .exc{background:linear-gradient(168deg,rgba(255,255,255,.03),rgba(255,255,255,.006)),var(--panel);border:1px solid var(--line-bright);border-radius:18px;padding:20px;margin:14px 0}
  .exc-warn{border-color:rgba(255,90,77,.4);background:radial-gradient(80% 100% at 100% 0,rgba(255,90,77,.06),transparent 60%),var(--panel)}
  .exc-h{display:flex;align-items:center;gap:13px}
  .exc-lg{width:44px;height:44px;font-size:18px}.exc-lg img{width:30px;height:30px;object-fit:contain}
  .exc-t{flex:1;min-width:0}
  .exc-t b{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:21px;color:var(--ink);display:block;letter-spacing:-.01em}
  .exc-badge{font-family:'Space Mono',monospace;font-size:10.5px;font-weight:700;color:var(--lime);letter-spacing:.02em}
  .exc-badge.warn{color:var(--red)}
  .exc-lev{font-family:'Space Mono',monospace;font-weight:800;font-size:19px;color:var(--ink);text-align:right;line-height:1}
  .exc-lev small{display:block;font-size:8.5px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.05em;margin-top:3px;font-weight:700}
  .exc-feel{font-size:14px;line-height:1.6;color:var(--ink-dim);margin:14px 0 4px}
  .exc-rr{display:grid;grid-template-columns:1fr;gap:7px;margin:14px 0}
  @media(min-width:620px){.exc-rr{grid-template-columns:1fr 1fr;gap:8px 22px}}
  .rb{display:flex;align-items:center;gap:9px}
  .rb-k{font-family:'Space Mono',monospace;font-size:10.5px;color:var(--ink-faint);width:104px;flex:0 0 auto;text-transform:uppercase;letter-spacing:.02em}
  .rb-t{flex:1;height:7px;background:rgba(255,255,255,.07);border-radius:6px;overflow:hidden}
  .rb-f{display:block;height:100%;border-radius:6px}
  .rb-v{font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:var(--ink-dim);width:22px;text-align:right}
  .exc-pc{display:grid;grid-template-columns:1fr;gap:12px;margin:6px 0 16px}
  @media(min-width:620px){.exc-pc{grid-template-columns:1fr 1fr}}
  .exc-pch{font-family:'Space Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-faint);font-weight:700;margin-bottom:7px}
  .exc-li{font-size:12.5px;line-height:1.45;color:var(--ink-dim);padding:4px 0 4px 20px;position:relative}
  .exc-li::before{position:absolute;left:0;top:3px;font-family:'Space Mono',monospace;font-weight:700}
  .exc-li.pro::before{content:'\\2713';color:var(--grn)}.exc-li.con::before{content:'\\2715';color:var(--red)}
  .exc-cta{display:block;text-align:center;text-decoration:none;font-family:'Space Mono',monospace;font-weight:700;font-size:14px;padding:13px;border-radius:12px;background:var(--lime);color:#0a0b0d;box-shadow:0 8px 30px -10px rgba(194,246,74,.5)}
  .exc-cta.warn{background:transparent;color:var(--red);border:1px solid rgba(255,90,77,.5);box-shadow:none}
  .exc-bonus{text-align:center;font-family:'Space Mono',monospace;font-size:11.5px;color:var(--ink-faint);margin-top:9px}
  /* trust / kucoin section */
  .moonbox{background:radial-gradient(70% 100% at 0 0,rgba(194,246,74,.09),transparent 55%),var(--panel);border:1px solid rgba(194,246,74,.35);border-radius:18px;padding:22px;margin:26px 0 6px;display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}
  .moonbox img{width:46px;height:46px;border-radius:12px;flex-shrink:0}
  .moonbox .mb-t{flex:1;min-width:240px}
  .moonbox .mb-tag{display:inline-block;font-family:'Space Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--lime);border:1px solid rgba(194,246,74,.4);border-radius:99px;padding:3px 10px;margin-bottom:8px}
  .moonbox h3{margin:0 0 8px;font-size:19px}
  .moonbox p{margin:0 0 12px;font-size:14px;line-height:1.6;color:var(--ink-dim)}
  .moonbox .mb-cta{display:inline-block;text-decoration:none;font-family:'Space Mono',monospace;font-weight:700;font-size:13.5px;padding:12px 18px;border-radius:11px;background:var(--lime);color:#0a0b0d}
  .kbox{background:radial-gradient(70% 100% at 0 0,rgba(255,90,77,.08),transparent 55%),var(--panel);border:1px solid rgba(255,90,77,.35);border-radius:18px;padding:22px;margin:16px 0}
  .kbox h3{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:19px;color:var(--ink);margin:0 0 4px;display:flex;align-items:center;gap:9px}
  .kbox .kwho{font-family:'Space Mono',monospace;font-size:11px;color:var(--red);margin-bottom:14px}
  .krow{display:flex;gap:12px;padding:11px 0;border-top:1px solid rgba(255,255,255,.06)}
  .krow .kd{font-family:'Space Mono',monospace;font-size:10.5px;font-weight:700;color:var(--amber);flex:0 0 74px}
  .krow .kt{font-size:13px;line-height:1.55;color:var(--ink-dim)}
  .krow .kt b{color:var(--ink)}
  .kfoot{font-size:12.5px;color:var(--ink-faint);line-height:1.55;margin-top:14px;padding-top:13px;border-top:1px solid rgba(255,255,255,.06)}
  article h2:not(.h2){font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:22px;color:var(--ink);margin:30px 0 8px}
  article p{font-size:14.5px;line-height:1.7;color:var(--ink-dim)}
  article a{color:var(--lime)}
  .cta-row{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 6px}
  .cta-row a{flex:1;min-width:150px;text-align:center;text-decoration:none;font-family:'Space Mono',monospace;font-weight:700;font-size:13.5px;padding:13px 14px;border-radius:11px;border:1px solid var(--line-bright);background:linear-gradient(180deg,var(--panel),#0d0f12);color:var(--ink)}
  .cta-row a.go{background:var(--lime);color:#0a0b0d;border-color:var(--lime)}
  @media(min-width:861px){.wrap{max-width:1180px;padding:0 clamp(24px,3vw,52px)}article h1{font-size:42px;letter-spacing:-.03em;margin:10px 0 10px}}
`;

const faq = [
  ['What is the best crypto exchange for futures trading?', 'For most futures traders, Bybit and Binance lead: Binance has the deepest liquidity (tightest spreads on majors) while Bybit offers a cleaner pro interface, fair mark-price liquidations and basic use without full KYC. OKX and Bitget are strong alternatives, and Bitget is the best for copy trading. The "best" depends on what matters to you — liquidity, fees, leverage, KYC or trust.'],
  ['Which exchange has the lowest trading fees?', 'MEXC generally has the lowest base fees (often 0% maker and ~0.02% taker on futures). Most top exchanges sit around 0.02% maker / 0.05–0.06% taker at the base tier, and a referral link plus VIP volume tiers lower them further. But the lowest headline fee means little if the book is thin — slippage on an illiquid pair costs far more than a few basis points of fee.'],
  ['Is KuCoin safe to use in 2026?', 'KuCoin carries real trust concerns. It pleaded guilty in the US in 2025 to operating an unlicensed money-transmitting business (nearly $300M in penalties) and is banned for US users. In 2026, on-chain investigator ZachXBT publicly accused it of poor cooperation with hack victims and law enforcement, and Austria’s regulator restricted new EU sign-ups. We list it for completeness but recommend caution and keeping minimal funds there — see the trust section on this page.'],
  ['Do I need KYC to trade crypto futures?', 'Some exchanges (Bybit, Bitget, Gate, MEXC, KuCoin) allow limited use without full KYC, usually with reduced withdrawal limits, while Binance, OKX, Kraken and Coinbase require full identity verification. KYC-free access is convenient but comes with trade-offs in limits and, sometimes, in how disputes are handled.'],
  ['How does leverage affect me while trading?', 'Leverage multiplies both your gains and your liquidation risk. At 100×, a ~1% move against you wipes the position; at 500×, ~0.2% does. High max leverage is a marketing number — experienced traders rarely use more than 5–20×. Practice with our free paper-trading terminal first to feel how fast liquidation arrives before risking real money.'],
];
const ld = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } })) })}</script>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://marginpad.io/' }, { '@type': 'ListItem', position: 2, name: 'Exchange comparison', item: url }] })}</script>`;

let html = `<!DOCTYPE html>
<html lang="en">
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>${title} | MarginPad</title>
<meta name="description" content="${desc}" />
<meta name="keywords" content="${kw}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#0a0b0d" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preconnect" href="https://s2.coinmarketcap.com" crossorigin />
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="stylesheet" href="/assets/blog.css" />
<style>${CSS}</style>
${ld}
</head>
<body>
<div class="ex-glow" aria-hidden="true"></div>
<div class="wrap">
  <header id="exHead">
    <div class="brand">
      <button type="button" class="hmenu" id="mBurger" aria-label="Menu"><span></span><span></span><span></span></button>
      <a href="/" class="mark" aria-label="MarginPad — home">MARGIN<b>PAD</b></a>
    </div>
    <nav class="hnav">
      <a href="https://t.me/MarginPadBot" target="_blank" rel="noopener" class="hlink hbot"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>Bot</a>
      <a href="/rewards/" class="hlink hrwd"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>Rewards</a>
      <a href="/paper-trade?trades=1" class="hlink hjr"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>My Trades</a>
      <button type="button" class="hlink hauth" data-auth-open aria-label="Sign in"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span data-auth-status>Sign in</span></button>
    </nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / Exchange comparison</div>
  <article>
    <div class="ex-eyebrow"><i></i>Updated 2026 · Trader-first</div>
    <h1>Crypto exchange comparison, from a trader’s seat</h1>
    <p class="lead">Not another affiliate top-10. This compares every major exchange by the things you actually <em>feel</em> mid-trade: how fees eat your PnL, how leverage sets your liquidation, how thin liquidity slips your fills, how funding bleeds a held position — and, just as important, whether the venue can be <strong>trusted with your money</strong>. Includes an honest look at the KuCoin controversy.</p>
    <div class="disc-top">Affiliate disclosure: some links below are referral links — they cost you nothing (often they add a fee discount or bonus) and help keep MarginPad’s tools free. Our ratings are our own editorial take, not paid placement. Not financial advice — always do your own research.</div>

    <h2 class="h2">How each factor hits your trade</h2>
    <div class="h2s">Before the table — what these numbers mean when real money is on the line.</div>
    <div class="fx">
      <div class="fx-c"><b><i style="background:#c2f64a"></i>Fees</b><p>Charged on entry <em>and</em> exit, on the full leveraged size. Round-trip a $10k position at 0.05% and you’ve paid $10 before the trade even moves. Scalpers feel this most — a referral fee discount pays for itself fast.</p></div>
      <div class="fx-c"><b><i style="background:#ffb020"></i>Leverage</b><p>Sets how far price can move before you’re liquidated. 100× ≈ 1% away; 500× ≈ 0.2%. A big “max lev” is marketing — what matters is the leverage <em>you</em> use and where your liq price lands.</p></div>
      <div class="fx-c"><b><i style="background:#3fd8e6"></i>Liquidity</b><p>Thin books = slippage: your market order walks up the ladder and fills worse than you saw. On majors the top venues are near-perfect; on exotic alt-perps even a modest order can move price against you.</p></div>
      <div class="fx-c"><b><i style="background:#2ebd85"></i>Funding rate</b><p>Perps charge funding every few hours to peg them to spot. Hold a crowded long and you pay the shorts — a slow bleed that can outweigh a small win. Same funding market-wide, but venues differ slightly.</p></div>
      <div class="fx-c"><b><i style="background:#8a92ff"></i>Liq engine &amp; insurance</b><p>How the exchange closes underwater positions. A fair mark price and a fat insurance fund mean fewer unfair wick-outs and less auto-deleveraging (ADL) clawing back your winning trade.</p></div>
      <div class="fx-c"><b><i style="background:#ff5a4d"></i>Trust &amp; safety</b><p>The one that dwarfs the rest. Great fees mean nothing if you can’t withdraw. Regulation, proof-of-reserves, security record and how the venue treats victims decide whether your balance is really yours.</p></div>
    </div>

    <h2 class="h2">The full comparison</h2>
    <div class="h2s">Base-tier futures fees (VIP levels + a referral link lower them). Scroll sideways on mobile. Trust is our 0–5 score.</div>
    <div class="tw-wrap"><table class="cmp"><thead><tr><th>Exchange</th><th>Max lev</th><th>Taker</th><th>Maker</th><th>Perps</th><th>KYC</th><th>US</th><th>Trust</th><th></th></tr></thead><tbody>
    ${EX.map(trow).join('\n    ')}
    </tbody></table></div>
    <p style="font-size:11.5px;color:var(--ink-faint);font-family:'Space Mono',monospace;margin-top:8px">* “Optional” KYC = basic trading works with reduced withdrawal limits; full verification unlocks the rest.</p>

    <div class="cta-row">
      <a class="go" href="/paper-trade">Practice on any pair — free, no signup →</a>
      <a href="/calculators">Liquidation calculator</a>
      <a href="/screener">Live screener</a>
    </div>

    <div class="moonbox">
      <img src="/assets/moon.png" alt="Moon" width="46" height="46" loading="lazy">
      <div class="mb-t">
        <span class="mb-tag">New partner — not a futures exchange</span>
        <h3>Moon — call crypto, stocks, forex &amp; commodities up or down. 24/7.</h3>
        <p>Moon isn't in the table above because it plays a different game: instead of an order book, you call any market up or down with leverage — including stocks, forex and commodities crypto exchanges don't carry — from one account, around the clock, with a public leaderboard and traders you can follow. MarginPad members can even cash <a href="/rewards">rewards</a> out straight to a Moon account. Full breakdown in our <a href="/blog/moon-trading-platform-review/">Moon review</a>.</p>
        <a class="mb-cta" data-ex="Moon" href="https://moon.com/?c=moonkickstart" target="_blank" rel="sponsored noopener noreferrer">Create a Moon account →</a>
      </div>
    </div>

    <h2 class="h2">Every exchange, in depth</h2>
    <div class="h2s">Ranked roughly best-to-worst for an active futures trader. Bars are our 0–5 editorial scores.</div>
    ${EX.map(card).join('\n    ')}

    <h2 class="h2">The KuCoin problem — an honest word</h2>
    <div class="kbox">
      <h3>⚠ Why we flag KuCoin</h3>
      <div class="kwho">Reported by on-chain investigator ZachXBT, US prosecutors and EU regulators. Presented as public reporting — do your own research.</div>
      <div class="krow"><span class="kd">Jan 2025</span><span class="kt"><b>Pleaded guilty in the US</b> to operating an unlicensed money-transmitting business, agreeing to roughly <b>$300M</b> in penalties and forfeitures; prosecutors said prior AML/KYC failures let suspicious funds move through the platform. KuCoin is <b>banned for US users</b>.</span></div>
      <div class="krow"><span class="kd">Aug 2025</span><span class="kt">A user reported a <b>$250,000 theft</b> whose funds landed in five KuCoin deposit addresses allegedly opened with <b>purchased “mule” KYC</b>. When a community member spoke out, KuCoin reportedly <b>threatened legal action</b> over “false or unlawful statements.”</span></div>
      <div class="krow"><span class="kd">Feb 2026</span><span class="kt">Austria’s financial regulator (FMA) <b>barred KuCoin’s EU arm from onboarding new customers</b> after it reportedly lost its key anti-money-laundering and sanctions compliance officers.</span></div>
      <div class="krow"><span class="kd">Apr–May 2026</span><span class="kt">ZachXBT asked KuCoin to explain how <b>$9.5M from a fake Ledger app</b> was laundered through <b>150+ KuCoin deposit addresses in a single week</b>, and later wrote that the exchange <b>“does not assist victims or law enforcement,”</b> calling the team “complicit” — alleging illicit funds flow freely as long as they generate fees.</span></div>
      <div class="kfoot">None of this means the exchange will vanish tomorrow, and KuCoin disputes the characterizations — but the pattern (a US guilty plea, an EU onboarding ban, unpaid court awards and repeated victim-handling accusations) is exactly the kind of thing that precedes withdrawal problems. Our take: if you use it, keep <strong>minimal balances</strong>, withdraw profits promptly, and prefer a venue with a cleaner record. Sources: reporting via Cryptopolitan, BanklessTimes, Cryptoadventure and others (2025–2026).</div>
    </div>

    <h2>So which exchange should you actually use?</h2>
    <p><strong>If liquidity and execution are everything</strong> — Binance, then Bybit and OKX. <strong>If you want to trade without full KYC</strong> — Bybit or Bitget for majors, MEXC for cheap fees and new listings (mind the thin books). <strong>If you’re learning</strong> — Bitget for copy trading, or just <a href="/paper-trade">paper-trade here first</a>. <strong>If you’re in the US or safety comes first</strong> — Kraken or Coinbase, accepting fewer markets and lower leverage. <strong>If you want markets beyond crypto</strong> — <a data-ex="Moon" href="https://moon.com/?c=moonkickstart" target="_blank" rel="sponsored noopener noreferrer">Moon</a> covers stocks, forex and commodities alongside crypto with simple up-or-down calls, 24/7 (see the spotlight above). And whatever you pick, the rule that matters more than any fee: <strong>don’t store what you can’t afford to lose on any exchange</strong> — they are for trading, not custody.</p>
    <p>The smartest first move costs nothing: open our free <a href="/paper-trade">Paper Trade</a> terminal, run the exact setup you’re eyeing with live prices and real liquidation math, and see how it behaves before a cent of your money touches an exchange. Size your leverage with the <a href="/calculators">liquidation calculator</a>, watch the tape on the <a href="/screener">screener</a>, and only then go live — through whichever venue above fits how you actually trade.</p>

    <p class="disc" style="font-family:'Space Mono',monospace;font-size:11px;color:var(--ink-faint);margin:20px 0 6px">Fees, leverage and features change often — verify on the exchange before depositing. Ratings are MarginPad’s editorial opinion. Links marked as referral are affiliate links. This page is information, not financial advice.</p>
  </article>

  <footer class="site-foot"><div class="foot-bar"><span>© MarginPad · <a href="/">marginpad.io</a> · Not financial advice</span></div></footer>
</div>
<script>
(function(){
  try{var u='/api/track?t=pageview&p='+encodeURIComponent(location.pathname);if(document.referrer)u+='&r='+encodeURIComponent(document.referrer);
  var es='';try{var ss=sessionStorage.getItem('mp_src');if(ss)es=ss;else{var q=new URLSearchParams(location.search||'');if(q.get('gclid')||q.get('gbraid')||q.get('wbraid'))es='google-ads';else if(q.get('msclkid'))es='bing-ads';else if(q.get('utm_source'))es=q.get('utm_source')+(q.get('utm_medium')?' / '+q.get('utm_medium'):'');else if(q.get('fbclid'))es='facebook';else if(q.get('twclid'))es='twitter';else if(q.get('ttclid'))es='tiktok';else if(q.get('ref'))es=q.get('ref');if(!es&&document.referrer){try{var h=new URL(document.referrer).hostname.replace(/^www\\./,'');if(h&&h!=='marginpad.io')es=h;}catch(e2){}}es=(es||'').slice(0,40);try{sessionStorage.setItem('mp_src',es);}catch(e3){}}}catch(e4){}
  var s0='';try{var r0=localStorage.getItem('mp_src0');if(r0){var o0=JSON.parse(r0);if(o0&&o0.s&&(Date.now()-(+o0.ts||0))<=7776e6)s0=String(o0.s).slice(0,40);}}catch(e5){}
  if(es&&!s0){try{localStorage.setItem('mp_src0',JSON.stringify({s:es,ts:Date.now()}));}catch(e6){}}
  if(es)u+='&src='+encodeURIComponent(es);else if(s0)u+='&s0='+encodeURIComponent(s0);
  if(navigator.sendBeacon)navigator.sendBeacon(u);else fetch(u);}catch(e){}
  document.addEventListener('click',function(e){var a=e.target.closest('a[data-ex]');if(!a)return;try{var ex=a.getAttribute('data-ex');if(navigator.sendBeacon)navigator.sendBeacon('/api/track?t=exchange&label='+encodeURIComponent(ex)+'&p='+encodeURIComponent(location.pathname));}catch(_){}}, true);
  var mb=document.getElementById('mBurger');if(mb)mb.addEventListener('click',function(){function go(){if(window.mpNavOpen){window.mpNavOpen();return;}var b=document.querySelector('.mpnav-burger');if(b){b.click();return;}setTimeout(go,150);}go();});
})();
</script>
<script defer src="/assets/mp-auth.js"></script>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('wrote dist/exchanges/index.html (' + Math.round(html.length / 1024) + ' KB)');

try {
  const smp = path.join(__dirname, '..', 'dist', 'sitemap.xml');
  let sm = fs.readFileSync(smp, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  if (sm.indexOf(url) === -1) { sm = sm.replace('</urlset>', `  <url><loc>${url}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>\n</urlset>`); fs.writeFileSync(smp, sm); console.log('sitemap: +/exchanges/'); }
} catch (e) { console.log('sitemap update skipped:', e.message); }
