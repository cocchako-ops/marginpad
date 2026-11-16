/* /crypto-prop-firms/ (2026-11-16): the crypto prop firms that sell an evaluation, compared on the rules that decide a pass. Owner rule for
   this page: every number comes from the firm's own site, with the day it was read. Read on 2026-11-16 by a research pass over each
   firm's rules, FAQ and pricing pages; where a firm's own pages disagree or the figure came from somewhere weaker, the cell says so instead
   of picking one. 2026-11-16 evening: FTMO and IQ Capital became partners - a firm with `aff` carries our link + code in a marked
   partner row (rel sponsored); every other link stays plain nofollow, and the figures are read the same way for all of them.
   Run: node build/gen-prop-firms-page.js  then the post-processor chain. Re-check every figure before changing CHECKED. */
'use strict';
const fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const SLUG = 'crypto-prop-firms';
const URL = 'https://marginpad.io/' + SLUG + '/';
const CHECKED = '16 Nov 2026';
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// [program, steps, target, daily, max dd, min days, entry price (smallest account), split]
const FIRMS = [
  { name: 'HyroTrader', site: 'https://www.hyrotrader.com/', trade: 'USDT perpetuals on Bybit or BloFin demo accounts, or HyroTrader\'s own platform. Up to 150x on BTC and ETH during the test.',
    daily: 'Equity at 00:00 UTC minus the limit; open profit and loss and fees count.',
    lev: 'Up to 150x in the test; once funded, total exposure is capped at 2x the starting balance.',
    payout: 'On request once your share is $25 or more, capped at 5% of the starting balance per payout, usually within 24 hours in USDT/USDC.',
    rules: [['Hyro Core', '1', '10%', '3%', '5% static', '4', '$9 ($2.5k)', '80%'], ['One-Step', '1', '10%', '4%', '8% static', '3', '$69 ($5k)', '80%'], ['Two-Step', '2', '10% then 5%', '5%', '10% static', '4 a phase', '$59 ($5k)', '80%']],
    note: 'No single day may carry more than 40% of the profit target. Low-cap altcoins are size-capped, martingale and cross-account hedging are banned. Prices are from HyroTrader\'s own comparison table; checkout may show a discount.',
    src: ['https://www.hyrotrader.com/evaluations/', 'https://hyrotrader.com/faq/rules/how-is-the-5-daily-drawdown-calculated/', 'https://hyrotrader.com/faq/rules/what-are-the-risk-management-conditions-at-hyrotrader/'] },
  { name: 'Breakout (owned by Kraken)', site: 'https://www.breakoutprop.com/', trade: 'The Breakout Terminal (web and mobile), simulated, on 50+ crypto pairs.',
    daily: 'Balance at 00:30 UTC minus 3%, open positions excluded (read from a search result of Breakout\'s page; their site refuses automated reads - confirm it there).',
    lev: '5x on BTC and ETH, 2x on altcoins (Kraken\'s own page).',
    payout: 'On demand, 24/7, in USDC, $50 minimum, around 24 hours (Kraken\'s own page).',
    rules: [['1-Step Classic', '1', '10%', '3%', '6% static', 'none', '$45 ($5k)', '80%'], ['1-Step Pro', '1', '12%', '3%', '5% static', 'none', '$33 ($5k)', '80%'], ['1-Step Turbo', '1', '9%', '3%', '3% static', 'none', '$20 ($5k)', '80%']],
    note: 'No time limit, no consistency rule, no news restriction. 90% split is a paid add-on. KYC before the funded account.',
    src: ['https://tools.breakoutprop.com/breakout', 'https://www.kraken.com/learn/best-crypto-prop-firms'] },
  { name: 'Crypto Fund Trader', site: 'https://cryptofundtrader.com/', trade: 'USDT pairs on a Bybit sub-account, plus MetaTrader 5, Match-Trader and their own platform (CFDs). All demo.',
    daily: 'Equity measured against the balance at 00:05 UTC.',
    lev: 'Up to 1:100, depending on the instrument and platform.',
    payout: 'Every 7 traded days on the one-step plans (every 2 with an add-on); after 15 traded days or every 30 days on the 2-Phase.',
    rules: [['1-Step Classic', '1', '10%', '3%', '6% static', 'none', '$59 ($5k)', '80%'], ['1-Step Pro', '1', '12%', '3%', '5% static', 'none', '$39 ($5k)', '80%'], ['1-Step Turbo', '1', '9%', '3%', '3% static', 'none', '$25 ($5k)', '80%'], ['2-Phase', '2', '8% then 5%', '5%', '10% static', 'none', '$58 ($5k)', '80%']],
    note: 'News and weekends allowed; HFT, tick scalping and arbitrage banned. The price table on their homepage did not read cleanly - confirm the price at checkout.',
    src: ['https://cryptofundtrader.com/', 'https://cryptofundtrader.com/faq/'] },
  { name: 'Bitfunded', site: 'https://www.bitfunded.com/', trade: 'Their own platform (web and mobile) on live exchange data, 100+ crypto pairs, simulated.',
    daily: 'Starting balance minus the limit, floating losses included; resets at 00:00 UTC+8.',
    lev: '1x to 5x on every pair.',
    payout: 'Up to two payouts per 30 days per challenge; monthly after the tenth.',
    rules: [['2-Step', '2', '8% then 5%', '5%', '10% (8% in step 2) static', 'see note', '$79 ($5k)', '80%'], ['1-Step', '1', '10%', '4%', '6% static', 'none', '$99 ($5k)', '80%'], ['1-Step Express', '1', '9%', '3%', '3% static', 'none', '$39 ($5k)', '80%']],
    note: 'At most 5 open positions, a holding limit of 10 days on majors and 7 on minor coins. Their FAQ says there is no minimum of trading days while their Terms of Use say 5 per step - ask them before relying on either.',
    src: ['https://bitfunded.gitbook.io/support/introduction/challenge-type.md', 'https://bitfunded.gitbook.io/support/trading-module/adjusting-leverage.md', 'https://www.bitfunded.com/frequently-asked-questions/'] },
  { name: 'Mubite', site: 'https://mubite.com/', trade: 'Crypto on Bybit or the Cleo platform.',
    daily: 'Equity at 00:00 UTC minus the limit, moving with equity.',
    lev: 'Up to 1:100.',
    payout: 'First on demand once funded, then every 14 days, $50 minimum; early payouts are capped at 2.5-5% of the account.',
    rules: [['One-Step Pro', '1', '10%', '3%', '6% static', 'none', '$89 ($5k)', '80-90%'], ['One-Step Lite', '1', '8%', '3%', '4% static', 'none', '$49 ($5k)', '80-90%'], ['Two-Step Pro', '2', '10% then 5%', '5%', '8-10% static', 'none', '$65 ($5k)', '80-90%']],
    note: 'A "Funded Score" limits your best day (under 20-40% of profit depending on the plan). News, overnight and weekend holding allowed.',
    src: ['https://mubite.com/en/challengeRules', 'https://mubite.com/en/challenge-prices'] },
  { name: 'IQ Capital', site: 'https://iqcapital.io/', aff: { url: 'https://checkout.iqcapital.io/products?aff=marginpad', ex: 'IQ Capital', code: 'MARGINPAD', label: 'Get an IQ Capital challenge' },
    trade: 'About 120 USDT perpetuals on Volumetrica, or crypto, forex, index and commodity CFDs on IQ MT5. Simulated. They also run separate futures programs.',
    daily: 'No daily loss limit on the Core challenge. Instead no single position may lose more than 1% of the starting balance (0.5% once funded): the position is closed and the account stays, and the third time ends it.',
    lev: '5x on BTC, ETH and SOL, 3x on other coins; CFDs up to 50x on forex and 25x on indices and commodities.',
    payout: '90% from the first dollar. First request after 10 active trading days, then each needs 50% new profit since the last; up to half the profit per request, capped by account size ($1,500 on a 50k for the first two).',
    rules: [['Core (Crypto / CFD)', '1', '8%', 'none', '6% EOD trailing (5% on 200k)', 'none', '$9 (first 50k), then $195', '90%']],
    note: 'Funded accounts add a 30% best-day consistency rule. The $9 welcome challenge is once per person and cannot be reset; the $9 price and the $129 activation fee after passing are from their checkout, not the help centre. At least one trade every 8 days. Copy trading and black-box bots are banned.',
    src: ['https://support.iqcapital.io/en/articles/15002141-core-crypto-challenge', 'https://support.iqcapital.io/en/articles/15001850-max-drawdown-end-of-day', 'https://support.iqcapital.io/en/articles/15015211-max-position-loss', 'https://support.iqcapital.io/en/articles/15005697-performance-reward-core-core-dll', 'https://checkout.iqcapital.io/products'] },
  { name: 'FTMO (crypto CFDs only)', site: 'https://ftmo.com/', aff: { url: 'https://join.ftmo.com/tsdRCnEjEATqghNGrzVM', ex: 'FTMO', code: 'tsdRCnEjEATqghNGrzVM', label: 'Open FTMO with our link' }, trade: 'CFDs on MetaTrader, cTrader and TradingView. Crypto is a minor asset class there, not perpetual futures.',
    daily: 'Equity, open profit and loss included, against the balance at midnight Central European time.',
    lev: 'About 1:3.3 on crypto on the Standard account (an FTMO answer, not their live symbol table).',
    payout: 'Not confirmed on the pages read.',
    rules: [['2-Step Challenge', '2', '10% then 5%', '5%', '10% static', '4', 'from EUR 89', 'up to 90%'], ['1-Step Challenge', '1', '10%', '3%', '10% end-of-day trailing', 'none', 'from EUR 79', '90%']],
    note: 'Listed because it is the firm most traders know - but at about 3x on crypto CFDs it is a different exercise from a crypto perpetuals evaluation.',
    src: ['https://ftmo.com/en/trading-objectives/', 'https://ftmo.com/en/2-step-challenge/', 'https://ftmo.com/en/1-step-challenge/'] },
];
const TITLE = 'Crypto Prop Firms Compared (Nov 2026): Rules, Drawdown, Prices';
const DESC = 'HyroTrader, Breakout, Crypto Fund Trader, Bitfunded, Mubite, IQ Capital and FTMO compared on what decides a pass: profit target, daily loss, maximum drawdown, minimum days, leverage and entry price - every figure from the firm\'s own site, checked ' + CHECKED + '.';
const FAQ = [
  ['Which crypto prop firm has the easiest rules?', 'None is easy in the way that matters: the daily loss limit (3-5% on every plan here except IQ Capital\'s Core, which has none and caps each position at 1% instead) fails far more challenges than the target. Looser drawdown usually costs a lower target elsewhere or a two-step evaluation. Compare the daily loss limit and how it is measured first - equity or balance, and at which hour - then the drawdown type.'],
  ['What is the difference between static and trailing drawdown?', 'A static floor sits a fixed distance below the starting balance and never moves. A trailing floor rises with your highest balance (or highest end-of-day balance), so profit you give back counts against you. A 6% trailing drawdown is much tighter than a 6% static one once you are in profit.'],
  ['Can I practise a crypto prop firm challenge for free?', 'Yes - MarginPad runs the same three rule shapes (one-step, two-step and end-of-day trailing) on a free paper account with live prices, and our server enforces the daily loss and drawdown the way a firm does. It funds nobody, but a pass tells you whether you can do it before you pay for an evaluation.'],
  ['Do these prices include a refund?', 'Some firms refund the evaluation fee with the first payout (HyroTrader on its One-Step and Two-Step, Mubite on its Two-Step, Bitfunded on the third payout); others never refund it. Prices change and discount banners at checkout change them again - always read the firm\'s own checkout.'],
];

const head = ['Plan', 'Steps', 'Target', 'Daily loss', 'Max drawdown', 'Min days', 'Entry from', 'Split'];
const firmHtml = f => `
  <section class="pf" id="${esc(f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))}">
    <div class="pf-h"><h2>${esc(f.name)}</h2><a href="${esc(f.site)}" target="_blank" rel="nofollow noopener noreferrer">${esc(f.site.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, ''))} &rarr;</a></div>
    <p class="pf-trade">${esc(f.trade)}</p>
    <div class="tblw"><table class="pf-t"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>
${f.rules.map(r => `      <tr>${r.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('\n')}
    </tbody></table></div>
    <dl class="pf-dl"><dt>Daily loss measured</dt><dd>${esc(f.daily)}</dd><dt>Leverage</dt><dd>${esc(f.lev)}</dd><dt>Payouts</dt><dd>${esc(f.payout)}</dd><dt>Worth knowing</dt><dd>${esc(f.note)}</dd></dl>
${f.aff ? `    <div class="pf-aff"><span class="pf-ptag">Our partner</span><span class="pf-cl">Code</span><code>${esc(f.aff.code)}</code><button type="button" class="pf-copy" data-copy="${esc(f.aff.code)}">Copy</button><a class="pf-go" href="${esc(f.aff.url)}" target="_blank" rel="noopener sponsored" data-ex="${esc(f.aff.ex)}">${esc(f.aff.label)} &rarr;</a></div>\n` : ''}    <p class="pf-src">Sources, read ${CHECKED}: ${f.src.map(u => `<a href="${esc(u)}" target="_blank" rel="nofollow noopener noreferrer">${esc(u.replace(/^https:\/\/(www\.)?/, ''))}</a>`).join(' &middot; ')}</p>
  </section>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />${GTAG}
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<meta name="theme-color" content="#08090b" />
<title>${esc(TITLE)} | MarginPad</title>
<meta name="description" content="${esc(DESC)}" />
<meta name="keywords" content="crypto prop firms, best crypto prop firm, crypto prop firm comparison, hyrotrader rules, breakout prop rules, crypto fund trader rules, bitfunded rules, mubite, prop firm daily drawdown" />
<link rel="canonical" href="${URL}" />
<link rel="alternate" hreflang="en" href="${URL}" />
<link rel="alternate" hreflang="x-default" href="${URL}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${URL}" />
<meta property="og:title" content="${esc(TITLE)} | MarginPad" />
<meta property="og:description" content="${esc(DESC)}" />
<meta property="og:site_name" content="MarginPad" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(TITLE)} | MarginPad" />
<meta name="twitter:description" content="${esc(DESC)}" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="stylesheet" href="/assets/lab.css" />
<style>
  .pf-quick{margin:20px 0 6px}
  .tblw{overflow-x:auto;border:1px solid var(--line);border-radius:13px;background:var(--panel)}
  table.pf-t,table.pf-q{width:100%;border-collapse:collapse;font-size:13px;min-width:640px}
  .pf-t th,.pf-q th{text-align:left;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);font-weight:700;padding:10px 12px;border-bottom:1px solid var(--line);white-space:nowrap}
  .pf-t td,.pf-q td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04);color:var(--ink2)}
  .pf-t tr:last-child td,.pf-q tr:last-child td{border-bottom:0}
  .pf-t td.n,.pf-q td.n{font-family:'Space Mono',monospace;font-size:12px;color:var(--ink)}
  .pf-q td a{color:var(--ink);font-weight:700;text-decoration:none}
  .pf{margin-top:30px;padding-top:6px}
  .pf-h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px}
  .pf-h h2{margin:0}.pf-h a{font-family:'Space Mono',monospace;font-size:12px;color:var(--cyan);text-decoration:none}
  .pf-trade{color:var(--ink2);font-size:14px;line-height:1.6;margin:8px 0 12px}
  .pf-dl{display:grid;grid-template-columns:170px 1fr;gap:8px 16px;margin:14px 0 0;font-size:13.5px;line-height:1.55}
  .pf-dl dt{color:var(--ink3);font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.04em;text-transform:uppercase;padding-top:2px}
  .pf-dl dd{margin:0;color:var(--ink2)}
  .pf-src{margin:12px 0 0;font-size:11.5px;color:var(--ink3);line-height:1.6;word-break:break-word}.pf-src a{color:var(--ink3)}
  .pf-cta{margin:26px 0 8px;padding:20px;border:1px solid rgba(194,246,74,.35);border-radius:16px;background:radial-gradient(90% 70% at 100% 0,rgba(194,246,74,.08),transparent 60%),var(--panel)}
  .pf-cta h2{margin:0 0 8px}.pf-cta p{margin:0 0 14px;color:var(--ink2);font-size:14.5px;line-height:1.65}
  .pf-go{display:inline-flex;align-items:center;height:44px;padding:0 20px;border-radius:12px;background:var(--lime);color:#0a0b0d;font-family:'Space Mono',monospace;font-weight:700;font-size:13.5px;text-decoration:none;margin-right:10px}
  .pf-ghost{display:inline-flex;align-items:center;height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--line);color:var(--ink2);font-family:'Space Mono',monospace;font-size:12.5px;text-decoration:none}
  .pf-aff{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:14px 0 0;padding:12px 14px;border-radius:13px;border:1px dashed rgba(194,246,74,.45);background:rgba(194,246,74,.05)}
  .pf-ptag{font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#0a0b0d;background:var(--lime);padding:4px 8px;border-radius:6px}
  .pf-cl{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}
  .pf-aff code{font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:var(--ink);overflow-wrap:anywhere}
  .pf-copy{font-family:'Space Mono',monospace;font-size:11px;font-weight:700;padding:7px 11px;border-radius:9px;border:1px solid var(--line);background:transparent;color:var(--ink2);cursor:pointer}
  .pf-copy.ok{background:var(--lime);color:#0a0b0d;border-color:var(--lime)}
  .pf-aff .pf-go{margin:0 0 0 auto;height:40px}
  @media(max-width:640px){.pf-aff .pf-go{margin:0;width:100%;justify-content:center}}
  .content p{color:var(--ink2);font-size:14.5px;line-height:1.7;margin:0 0 14px}
  .faq details{border:1px solid var(--line);border-radius:12px;background:linear-gradient(180deg,var(--panel),var(--bg2));margin-bottom:10px;overflow:hidden}
  .faq summary{cursor:pointer;padding:15px 18px;font-weight:700;font-size:15px;color:var(--ink);list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px}
  .faq summary::-webkit-details-marker{display:none}
  .faq summary::after{content:'+';color:var(--cyan);font-family:'Space Mono',monospace;font-size:18px;font-weight:700}
  .faq details[open] summary::after{content:'\\2212'}
  .faq details[open] summary{border-bottom:1px solid var(--line)}
  .faq .a{padding:14px 18px 17px;color:var(--ink2);font-size:14px;line-height:1.7}
  @media(max-width:640px){.pf-dl{grid-template-columns:1fr;gap:2px 0}.pf-dl dd{margin-bottom:8px}}
</style>
<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: TITLE, description: DESC, url: URL, datePublished: '2026-11-16', dateModified: '2026-11-16', author: { '@type': 'Organization', name: 'MarginPad' }, publisher: { '@type': 'Organization', name: 'MarginPad', url: 'https://marginpad.io/' } })}
</script>
<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(q => ({ '@type': 'Question', name: q[0], acceptedAnswer: { '@type': 'Answer', text: q[1] } })) })}
</script>
</head>
<body>
<header class="topbar"><a class="brand" href="/">MARGIN<b>PAD</b></a><nav class="tool-switch"><a href="/tools/">All tools</a><a href="/prop-firm-challenge/">Challenge</a><a href="/prop-firm-drawdown-calculator/">Drawdown</a><a href="/${SLUG}/" class="on">Prop firms</a></nav><a class="home" href="/">&larr; marginpad.io</a></header>
<div class="wrap">
  <section class="hero">
    <span class="eyebrow">Checked ${CHECKED}</span>
    <h1>Crypto Prop Firms Compared</h1>
    <p class="sub">Seven firms that sell a crypto evaluation, compared on the rules that decide whether you pass: the profit target, the daily loss limit and how it is measured, the maximum drawdown and its type, the minimum trading days, leverage and the entry price. Every figure is read off the firm's own pages, and where those pages disagree with each other we say so instead of choosing. IQ Capital and FTMO are our partners - their rows carry our link and code, marked as such; the figures are read the same way for every firm.</p>
  </section>

  <section class="pf-quick">
    <div class="tblw"><table class="pf-q"><thead><tr><th>Firm</th><th>What you trade</th><th>Daily loss</th><th>Max drawdown</th><th>Leverage (BTC)</th><th>Entry from</th></tr></thead><tbody>
      <tr><td><a href="#hyrotrader">HyroTrader</a></td><td>Bybit / BloFin perps</td><td class="n">3-5%</td><td class="n">5-10% static</td><td class="n">up to 150x (test)</td><td class="n">$9</td></tr>
      <tr><td><a href="#breakout-owned-by-kraken">Breakout</a></td><td>Own terminal</td><td class="n">3%</td><td class="n">3-6% static</td><td class="n">5x</td><td class="n">$20</td></tr>
      <tr><td><a href="#crypto-fund-trader">Crypto Fund Trader</a></td><td>Bybit, MT5, Match-Trader</td><td class="n">3-5%</td><td class="n">3-10% static</td><td class="n">up to 1:100</td><td class="n">$25</td></tr>
      <tr><td><a href="#bitfunded">Bitfunded</a></td><td>Own platform</td><td class="n">3-5%</td><td class="n">3-10% static</td><td class="n">5x</td><td class="n">$39</td></tr>
      <tr><td><a href="#mubite">Mubite</a></td><td>Bybit, Cleo</td><td class="n">3-5%</td><td class="n">4-10% static</td><td class="n">up to 1:100</td><td class="n">$49</td></tr>
      <tr><td><a href="#iq-capital">IQ Capital</a></td><td>Volumetrica perps, MT5 CFDs</td><td class="n">none (1% per position)</td><td class="n">6% EOD trailing</td><td class="n">5x</td><td class="n">$9 (first 50k)</td></tr>
      <tr><td><a href="#ftmo-crypto-cfds-only">FTMO</a></td><td>Crypto CFDs</td><td class="n">3-5%</td><td class="n">10% static / EOD trailing</td><td class="n">about 1:3.3</td><td class="n">EUR 79</td></tr>
    </tbody></table></div>
    <p class="pf-src">Entry price = the smallest account on the cheapest plan, as published. A discount at checkout can change it.</p>
  </section>

  <section class="pf-cta">
    <h2>Pass it here before you pay for it</h2>
    <p>The daily loss limit is the rule that ends most evaluations, and it is the same 3-5% at every firm above. Run the same rule shapes on MarginPad for free - one-step, two-step and end-of-day trailing, on live prices - and the server ends the run the moment you break a rule, exactly as a firm would.</p>
    <a class="pf-go" href="/prop-firm-challenge/">Start a free challenge</a><a class="pf-ghost" href="/prop-firm-drawdown-calculator/">Drawdown calculator</a>
  </section>
${FIRMS.map(firmHtml).join('\n')}

  <section class="content" style="margin-top:30px">
    <h2>How to read these rules</h2>
    <p><strong>Daily loss is not one rule.</strong> HyroTrader and Mubite measure from your equity at 00:00 UTC, Crypto Fund Trader from the balance at 00:05 UTC, Bitfunded from the starting balance on a UTC+8 day, FTMO at midnight Central European time, IQ Capital has none on its Core challenge (it caps each position at 1% instead), and Breakout (by its own page as quoted) from the 00:30 UTC balance with open positions excluded. An open position losing money at the reset can therefore count against you at one firm and not at another.</p>
    <p><strong>Static beats trailing of the same size.</strong> Every crypto plan above uses a static maximum drawdown except FTMO's 1-Step and IQ Capital's Core, which trail the highest end-of-day balance or equity. A trailing floor follows your profit up, so it is tighter than its number suggests once you are ahead.</p>
    <p><strong>Leverage is not comparable as one figure.</strong> HyroTrader allows up to 150x in the test and then caps total exposure at twice the balance once funded; Breakout and Bitfunded stop at 5x; the CFD firms sit near 1:1 to 1:3.3. Train at the leverage you will be allowed once funded, not the one the test allows.</p>
  </section>

  <section class="content faq">
    <h2>FAQ</h2>
${FAQ.map(q => `    <details>\n      <summary>${esc(q[0])}</summary>\n      <div class="a">${esc(q[1])}</div>\n    </details>`).join('\n')}
  </section>
</div>
<div class="wrap" style="padding-bottom:0">
<footer class="toolfoot"><div class="cols"><div><a class="brand" href="/" style="font-size:18px">MARGIN<b>PAD</b></a><p class="blurb">Free crypto futures tools - calculators, a live charts workspace, a paper-trading terminal and a real-time liquidation feed. No signup.</p></div><div><h4>Funded practice</h4><a href="/prop-firm-challenge/">Prop Firm Challenge</a><a href="/prop-firm-drawdown-calculator/">Drawdown Calculator</a><a href="/${SLUG}/">Crypto Prop Firms</a><a href="/practice-for-a-funded-account/">Our Pass Rate</a></div><div><h4>MarginPad</h4><a href="/paper-trade">Paper Trade</a><a href="/charts">Charts</a><a href="/calculators">Calculators</a><a href="/screener">Screener</a><a href="/rekt/">Liquidations</a></div></div><div class="bottom">&copy; 2026 MarginPad &middot; Figures read from each firm's own site on ${CHECKED} &middot; Not financial advice</div></footer>
</div>
<script>(function(){document.addEventListener('click',function(e){var c=e.target.closest&&e.target.closest('[data-copy]');if(c){var v=c.getAttribute('data-copy');try{navigator.clipboard.writeText(v).then(function(){c.classList.add('ok');c.textContent='Copied';setTimeout(function(){c.classList.remove('ok');c.textContent='Copy';},1800);});}catch(x){}return;}var a=e.target.closest&&e.target.closest('a[data-ex]');if(a)try{navigator.sendBeacon('/api/track?t=exchange&e='+encodeURIComponent(a.getAttribute('data-ex'))+'&p='+encodeURIComponent(location.pathname));}catch(x){}},true);})();</script>
<script defer src="/assets/mp-auth.js"></script>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;
fs.mkdirSync(path.join(DIST, SLUG), { recursive: true });
fs.writeFileSync(path.join(DIST, SLUG, 'index.html'), html);
console.log('wrote dist/' + SLUG + '/index.html (' + Math.round(html.length / 1024) + ' KB)');
