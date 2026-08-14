/* gen-calc-suite.js — 6 standalone calculator landing pages (SEO suite, 2026-08-14).
   Each page: working vanilla-JS calculator + formula + worked example + tips + FAQ (JSON-LD) + Bybit/Moon rails.
   Hand-authored quality bar; pages are final HTML (gtag/sentry/mp-nav included — no post-processors needed).
   Re-run any time: node build/gen-calc-suite.js  (writes dist/<slug>/index.html; remember add-sitemap-extras). */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');

const RAILS = `<div class="mprail"><div class="mprail-t">TRADE IT FOR REAL</div>
<a href="https://www.bybit.com/invite?ref=LZKBERJ" target="_blank" rel="sponsored noopener noreferrer" onclick="try{gtag('event','conversion_event_outbound_click',{ex:'Bybit'})}catch(e){}"><b>Bybit</b><span>Futures &middot; up to 100x &middot; deep liquidity</span><i>&rarr;</i></a>
<a href="https://moon.com/?c=moonkickstart" target="_blank" rel="sponsored noopener noreferrer" onclick="try{gtag('event','conversion_event_outbound_click',{ex:'Moon'})}catch(e){}"><b>Moon</b><span>Call it up or down &middot; 24/7 markets</span><i>&rarr;</i></a></div>`;

const STYLE = `<style>
:root{--bg:#08090b;--panel:#0e1116;--line:#20262f;--ink:#e9e7df;--dim:#9aa3ad;--faint:#5c656f;--lime:#c2f64a;--up:#37d398;--red:#ff6258;--rs:12px}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:'Familjen Grotesk',system-ui,sans-serif;line-height:1.6}
.wrap{max-width:880px;margin:0 auto;padding:34px 18px 60px}
h1{font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(26px,4.6vw,38px);letter-spacing:-.02em;line-height:1.12;margin:10px 0 10px}
.sub{color:var(--dim);font-size:15.5px;max-width:640px;margin:0 0 24px}
h2{font-family:'Bricolage Grotesque',sans-serif;font-size:21px;margin:34px 0 10px}
p,li{color:var(--dim);font-size:14.5px}strong,b{color:var(--ink)}
.calc{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:20px}
.cgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.f label{display:block;font:700 10px 'Space Mono',monospace;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:0 0 5px}
.f input,.f select{width:100%;background:#0a0d11;border:1px solid #2b323b;border-radius:9px;padding:11px 12px;color:var(--ink);font-family:'Space Mono',monospace;font-size:16px}
.f input:focus,.f select:focus{outline:none;border-color:var(--lime)}
.res{margin-top:16px;border-top:1px solid var(--line);padding-top:6px}
.rrow{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 0;border-bottom:1px dashed rgba(32,38,47,.6)}
.rrow:last-child{border-bottom:none}.rrow .k{color:var(--dim);font-size:13.5px}
.rrow .v{font-family:'Space Mono',monospace;font-size:16px;font-weight:700}
.rrow.big .v{font-size:21px;color:var(--lime)}.v.up{color:var(--up)}.v.dn{color:var(--red)}
.frm{background:#0a0d11;border:1px solid var(--line);border-radius:var(--rs);padding:13px 16px;font-family:'Space Mono',monospace;font-size:13.5px;color:var(--ink);overflow-x:auto;white-space:nowrap}
.ex{background:linear-gradient(160deg,rgba(194,246,74,.05),transparent 60%),var(--panel);border:1px solid var(--line);border-radius:var(--rs);padding:14px 17px}
.faq details{border:1px solid var(--line);border-radius:var(--rs);background:var(--panel);margin-bottom:9px;padding:0 16px}
.faq summary{cursor:pointer;font-weight:700;color:var(--ink);font-size:14.5px;padding:13px 0}
.rel{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.rel a{color:var(--lime);border:1px solid rgba(194,246,74,.35);border-radius:999px;padding:7px 14px;font-size:12.5px;text-decoration:none}
.rel a:hover{background:rgba(194,246,74,.1)}
.mprail{margin:34px 0 8px;border:1px solid rgba(245,166,35,.35);border-radius:16px;padding:16px;background:linear-gradient(160deg,rgba(245,166,35,.06),transparent 60%),var(--panel)}
.mprail-t{font:700 10px 'Space Mono',monospace;letter-spacing:.14em;color:#f5a623;margin-bottom:10px}
.mprail a{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--line);border-radius:11px;color:var(--ink);text-decoration:none;margin-bottom:8px;transition:.15s}
.mprail a:hover{border-color:#f5a623}.mprail a b{flex:none}.mprail a span{flex:1;color:var(--dim);font-size:12.5px}.mprail a i{color:#f5a623;font-style:normal}
.note{color:var(--faint);font-size:12px;margin-top:26px}
</style>`;

function shell(pg) {
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: pg.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  const appLd = { '@context': 'https://schema.org', '@type': 'WebApplication', name: pg.h1, applicationCategory: 'FinanceApplication', operatingSystem: 'Any', url: 'https://marginpad.io/' + pg.slug + '/', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } };
  const crumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'All tools', item: 'https://marginpad.io/tools/' }, { '@type': 'ListItem', position: 2, name: pg.h1, item: 'https://marginpad.io/' + pg.slug + '/' }] };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-18230384038');</script>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<meta name="theme-color" content="#08090b" />
<title>${pg.title}</title>
<meta name="description" content="${pg.desc}" />
<meta name="keywords" content="${pg.kw}" />
<link rel="canonical" href="https://marginpad.io/${pg.slug}/" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${pg.title}" />
<meta property="og:description" content="${pg.desc}" />
<meta property="og:url" content="https://marginpad.io/${pg.slug}/" />
<meta property="og:image" content="https://marginpad.io/assets/og-home.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
${STYLE}
<script type="application/ld+json">${JSON.stringify(appLd)}</script>
<script type="application/ld+json">${JSON.stringify(crumbLd)}</script>
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
<script defer src="/assets/sentry.js"></script>
</head>
<body>
<div class="wrap">
<h1>${pg.h1}</h1>
<p class="sub">${pg.sub}</p>
<div class="calc"><div class="cgrid">${pg.inputs}</div><div class="res" id="res"></div></div>
<h2>How it is calculated</h2>
<div class="frm">${pg.formula}</div>
${pg.body}
<h2>Worked example</h2>
<div class="ex">${pg.example}</div>
<h2>FAQ</h2>
<div class="faq">${pg.faq.map(f => `<details><summary>${f.q}</summary><p>${f.a}</p></details>`).join('')}</div>
<h2>Related tools</h2>
<div class="rel">${pg.related.map(r => `<a href="${r[1]}">${r[0]}</a>`).join('')}</div>
${RAILS}
<p class="note">Free, no signup, runs entirely in your browser. Educational tool — not financial advice. Practice the setup risk-free on the <a href="/paper-trade" style="color:var(--lime)">MarginPad paper-trading terminal</a> before putting real money behind it.</p>
</div>
<script>${pg.js}
document.querySelectorAll('.calc input,.calc select').forEach(function(el){el.addEventListener('input',calc);el.addEventListener('change',calc);});calc();</script>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>`;
}

const inp = (id, label, val, step) => `<div class="f"><label for="${id}">${label}</label><input id="${id}" type="number" inputmode="decimal" value="${val}"${step ? ' step="' + step + '"' : ''}></div>`;
const sideSel = `<div class="f"><label for="side">Direction</label><select id="side"><option value="1">Long</option><option value="-1">Short</option></select></div>`;
const G = (id) => `+document.getElementById('${id}').value`;
const REL_ALL = [['All calculators (app)', '/calculators'], ['Liquidation calculator', '/btc-liquidation-calculator/'], ['Pivot points', '/pivot-point-calculator/'], ['Risk of ruin', '/risk-of-ruin-calculator/'], ['Paper trading', '/paper-trade']];

const PAGES = [
{
  slug: 'crypto-profit-calculator',
  title: 'Crypto Profit Calculator — Leverage P&L, ROE & Fees | MarginPad',
  desc: 'Free crypto futures profit calculator: enter entry, exit, margin and leverage to get exact P&L in dollars, ROE percentage and trading fees for long or short positions.',
  kw: 'crypto profit calculator, futures pnl calculator, leverage profit calculator, roe calculator crypto, bybit pnl calculator',
  h1: 'Crypto Profit Calculator',
  sub: 'Exact P&L for leveraged longs and shorts — position size, dollar profit, ROE and taker fees, computed the same way the exchange does it.',
  inputs: sideSel + inp('entry', 'Entry price', 60000) + inp('exit', 'Exit price', 63000) + inp('margin', 'Margin (USD)', 100) + inp('lev', 'Leverage', 10) + inp('fee', 'Taker fee %', 0.055, '0.001'),
  js: `function calc(){var s=${G('side')},en=${G('entry')},ex=${G('exit')},m=${G('margin')},l=${G('lev')},f=${G('fee')}/100;var r=document.getElementById('res');if(!(en>0&&ex>0&&m>0&&l>0)){r.innerHTML='';return;}var pos=m*l,qty=pos/en,gross=qty*(ex-en)*s,fees=pos*f+qty*ex*f,net=gross-fees,roe=net/m*100;
r.innerHTML='<div class="rrow"><span class="k">Position size</span><span class="v">$'+pos.toLocaleString(undefined,{maximumFractionDigits:2})+'</span></div><div class="rrow"><span class="k">Gross P&L</span><span class="v '+(gross>=0?'up':'dn')+'">'+(gross>=0?'+':'')+gross.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Fees (entry + exit, taker)</span><span class="v dn">-'+fees.toFixed(2)+' USD</span></div><div class="rrow big"><span class="k">Net P&L</span><span class="v '+(net>=0?'up':'dn')+'">'+(net>=0?'+':'')+net.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">ROE (return on margin)</span><span class="v '+(roe>=0?'up':'dn')+'">'+(roe>=0?'+':'')+roe.toFixed(2)+'%</span></div>';}`,
  formula: 'P&L = (position / entry) &times; (exit &minus; entry) &times; direction &nbsp;&nbsp;|&nbsp;&nbsp; ROE = P&L / margin &times; 100',
  body: `<p>Leverage multiplies your <strong>position size</strong>, not your prediction. A $100 margin at 10x controls a $1,000 position, so a 5% price move becomes a 50% return on your margin — in either direction. Fees are charged on the full position value twice (entry and exit), which is why high leverage makes small scalps surprisingly expensive.</p>`,
  example: `Long BTC from <b>$60,000</b> to <b>$63,000</b> with <b>$100</b> margin at <b>10x</b>: position $1,000, quantity 0.01667 BTC, gross profit <b>+$50.00</b>. Taker fees at 0.055% cost about $1.13 in total, leaving <b>+$48.87 net</b> — a <b>+48.9% ROE</b> on a 5% price move.`,
  faq: [
    { q: 'How is futures profit different from spot profit?', a: 'On spot you own the coins, so profit is simply the price change times your quantity. On futures your margin controls a larger position (margin times leverage), so the same price move produces a proportionally larger profit or loss relative to what you actually put up. The dollar P&L formula is identical — only the position size changes.' },
    { q: 'Why is my real P&L slightly lower than the calculator shows?', a: 'Live positions also pay funding (exchanged between longs and shorts every 8 hours) and may fill at slightly worse prices than requested (slippage). This calculator covers position P&L and taker fees, which are the two dominant components on most trades.' },
    { q: 'What is ROE?', a: 'Return on equity — your net profit divided by the margin you committed, as a percentage. It is the number leaderboards and P&L tickets usually show, because it measures how hard your actual capital worked, not the notional position.' }
  ],
  related: REL_ALL
},
{
  slug: 'position-size-calculator',
  title: 'Position Size Calculator — Risk-Based Crypto Sizing | MarginPad',
  desc: 'Free position size calculator for crypto: enter account size, risk percentage, entry and stop-loss to get the exact position size and margin that keeps your risk fixed.',
  kw: 'position size calculator crypto, risk based position sizing, 1 percent rule calculator, futures position size',
  h1: 'Position Size Calculator',
  sub: 'Size the trade from your risk, not from your feelings — the one habit that keeps losing streaks survivable.',
  inputs: inp('acct', 'Account size (USD)', 5000) + inp('riskp', 'Risk per trade %', 1, '0.1') + inp('entry', 'Entry price', 60000) + inp('stop', 'Stop-loss price', 58800) + inp('lev', 'Leverage', 10),
  js: `function calc(){var a=${G('acct')},rp=${G('riskp')}/100,en=${G('entry')},st=${G('stop')},l=${G('lev')};var r=document.getElementById('res');if(!(a>0&&rp>0&&en>0&&st>0&&en!==st)){r.innerHTML='';return;}var riskUsd=a*rp,dist=Math.abs(en-st)/en,pos=riskUsd/dist,qty=pos/en,marg=l>0?pos/l:pos;
r.innerHTML='<div class="rrow"><span class="k">Dollar risk (if the stop hits)</span><span class="v dn">-'+riskUsd.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Stop distance</span><span class="v">'+(dist*100).toFixed(2)+'%</span></div><div class="rrow big"><span class="k">Position size</span><span class="v">$'+pos.toLocaleString(undefined,{maximumFractionDigits:2})+'</span></div><div class="rrow"><span class="k">Quantity</span><span class="v">'+qty.toFixed(6)+'</span></div><div class="rrow"><span class="k">Margin needed at '+l+'x</span><span class="v">$'+marg.toFixed(2)+'</span></div>';}`,
  formula: 'position = (account &times; risk%) / stop distance% &nbsp;&nbsp;|&nbsp;&nbsp; margin = position / leverage',
  body: `<p>Professional sizing works backwards: decide the <strong>dollars you are willing to lose</strong> first, measure the distance to your stop, and let those two numbers dictate the position. Leverage then only determines how much margin gets locked — it does not change your risk if the stop is respected.</p>`,
  example: `A <b>$5,000</b> account risking <b>1%</b> ($50) on a long from <b>$60,000</b> with a stop at <b>$58,800</b> (2% away): position = $50 / 0.02 = <b>$2,500</b>. At 10x that locks just <b>$250</b> of margin — and whatever happens, the loss if the stop fills is $50, exactly 1%.`,
  faq: [
    { q: 'What risk percentage should I use per trade?', a: 'Most systematic traders risk between 0.5% and 2% of the account per trade. At 1% you can take 20 consecutive losses and still keep ~82% of the account; at 5% the same streak leaves you with ~36%. The right number is the one that lets you follow the plan through a normal losing streak.' },
    { q: 'Does higher leverage mean higher risk here?', a: 'Not if the stop is honored. With risk-based sizing, leverage only decides how much margin is locked as collateral — the dollar loss at the stop stays the same. Leverage becomes dangerous when the stop is skipped or the position is sized from margin instead of from risk.' },
    { q: 'What if my stop is very tight?', a: 'A tighter stop allows a larger position for the same dollar risk — but it also gets hit more often by normal noise. Check the average candle range on your timeframe before placing a stop closer than the market naturally wiggles.' }
  ],
  related: [['Stop-loss calculator', '/stop-loss-calculator/'], ['Profit calculator', '/crypto-profit-calculator/'], ['Risk of ruin', '/risk-of-ruin-calculator/'], ['All calculators (app)', '/calculators'], ['Paper trading', '/paper-trade']]
},
{
  slug: 'leverage-calculator',
  title: 'Leverage Calculator — Margin, Position & Liquidation Distance | MarginPad',
  desc: 'Free crypto leverage calculator: see the leverage implied by your margin and position size, the margin a target position needs, and roughly how far liquidation sits.',
  kw: 'leverage calculator crypto, margin calculator futures, how much leverage, liquidation distance calculator',
  h1: 'Crypto Leverage Calculator',
  sub: 'Margin, position size and leverage are one equation — set any two and the third follows, along with the distance to liquidation.',
  inputs: inp('margin', 'Margin (USD)', 100) + inp('pos', 'Position size (USD)', 1000) + inp('mmr', 'Maintenance margin %', 0.5, '0.1'),
  js: `function calc(){var m=${G('margin')},p=${G('pos')},mmr=${G('mmr')}/100;var r=document.getElementById('res');if(!(m>0&&p>0)){r.innerHTML='';return;}var lev=p/m,liq=(1-mmr)/lev*100;
r.innerHTML='<div class="rrow big"><span class="k">Implied leverage</span><span class="v">'+lev.toFixed(2)+'x</span></div><div class="rrow"><span class="k">Liquidation distance (approx, long)</span><span class="v dn">-'+liq.toFixed(2)+'%</span></div><div class="rrow"><span class="k">A 1% price move changes your margin by</span><span class="v">'+lev.toFixed(1)+'%</span></div><div class="rrow"><span class="k">Move that wipes 50% of margin</span><span class="v">'+(50/lev).toFixed(2)+'%</span></div>';}`,
  formula: 'leverage = position / margin &nbsp;&nbsp;|&nbsp;&nbsp; liq distance &asymp; (1 &minus; MMR) / leverage',
  body: `<p>Leverage is not a setting to max out — it is the ratio between the position you control and the collateral behind it. The higher it goes, the closer liquidation moves: at 10x the price only needs to travel roughly <strong>10%</strong> against you; at 100x, about <strong>1%</strong> — inside the random noise of a single candle on most coins.</p>`,
  example: `<b>$100</b> margin holding a <b>$1,000</b> position = <b>10x</b>. With a 0.5% maintenance margin, liquidation sits roughly <b>9.95% below entry</b> on a long. Every 1% move changes your margin by 10% — a normal 3% daily swing is a 30% equity swing at this size.`,
  faq: [
    { q: 'What leverage do most professionals actually use?', a: 'Serious futures traders rarely run effective leverage above 3-5x on the whole account, even when an exchange offers 100x. High per-trade leverage is mainly a capital-efficiency tool: it lets you lock less margin for the same deliberately-sized position — not a way to multiply the bet.' },
    { q: 'Is liquidation the same as my stop-loss?', a: 'No. Liquidation is the exchange force-closing you when margin runs out — you lose the whole margin plus liquidation fees. A stop-loss is your own exit at a price you chose. If liquidation is doing the job of your stop, the position was oversized.' },
    { q: 'Why is my real liquidation price slightly different?', a: 'Exchanges compute liquidation from the maintenance-margin tier of your exact position size, plus fees, and for isolated vs cross margin differently. The distance formula here is the standard approximation for an isolated position and lands very close for typical sizes.' }
  ],
  related: [['Liquidation calculator', '/btc-liquidation-calculator/'], ['Profit calculator', '/crypto-profit-calculator/'], ['Position size', '/position-size-calculator/'], ['All calculators (app)', '/calculators'], ['Leverage explained (guide)', '/blog/crypto-leverage-explained/']]
},
{
  slug: 'crypto-break-even-calculator',
  title: 'Break-Even Calculator — Fees & Funding Covered Price | MarginPad',
  desc: 'Free crypto break-even calculator: the exact price your leveraged position must reach to cover taker fees and funding — before a single dollar of real profit.',
  kw: 'break even calculator crypto, futures fees calculator, funding cost break even, crypto fee calculator',
  h1: 'Crypto Break-Even Calculator',
  sub: 'Every position starts underwater — this is the price where fees and funding are paid off and real profit begins.',
  inputs: sideSel + inp('entry', 'Entry price', 60000) + inp('lev', 'Leverage', 20) + inp('fee', 'Taker fee %', 0.055, '0.001') + inp('frate', 'Funding rate % / 8h', 0.01, '0.001') + inp('hours', 'Hold time (hours)', 24),
  js: `function calc(){var s=${G('side')},en=${G('entry')},l=${G('lev')},f=${G('fee')}/100,fr=${G('frate')}/100,h=${G('hours')};var r=document.getElementById('res');if(!(en>0&&l>0)){r.innerHTML='';return;}var feeMove=2*f,fundMove=fr*(h/8),total=feeMove+fundMove,be=en*(1+s*total),roeCost=total*l*100;
r.innerHTML='<div class="rrow"><span class="k">Round-trip taker fees</span><span class="v">'+(feeMove*100).toFixed(3)+'% of position</span></div><div class="rrow"><span class="k">Funding over '+h+'h ('+(h/8).toFixed(1)+' intervals)</span><span class="v">'+(fundMove*100).toFixed(3)+'% of position</span></div><div class="rrow big"><span class="k">Break-even price</span><span class="v">'+be.toLocaleString(undefined,{maximumFractionDigits:2})+'</span></div><div class="rrow"><span class="k">Price must move</span><span class="v">'+(total*100).toFixed(3)+'% in your favor</span></div><div class="rrow"><span class="k">Cost as ROE at '+l+'x</span><span class="v dn">-'+roeCost.toFixed(2)+'% of margin</span></div>';}`,
  formula: 'break-even move = 2 &times; taker fee + funding rate &times; (hours / 8) &nbsp;&nbsp;|&nbsp;&nbsp; BE price = entry &times; (1 &plusmn; move)',
  body: `<p>Fees are charged on the <strong>whole position</strong>, so at high leverage they eat a startling share of your margin: a 0.11% round trip is 2.2% of margin at 20x and 11% at 100x — before the price has moved anywhere. Funding compounds the drag on positions held across 8-hour marks, which is why overnight scalps at max leverage quietly bleed.</p>`,
  example: `Long at <b>$60,000</b>, 20x, 0.055% taker each way, +0.01%/8h funding, held <b>24h</b>: fees 0.110% + funding 0.030% = <b>0.140%</b>. Break-even price <b>$60,084</b> — and that 0.14% costs <b>2.8% of your margin</b> at 20x.`,
  faq: [
    { q: 'Do limit orders change the break-even?', a: 'Yes — maker fees are far lower (often 0.02% or even rebates) than taker fees. Entering and exiting with limit orders can cut the fee half of your break-even by two thirds or more, which matters enormously for high-frequency or high-leverage styles.' },
    { q: 'Can funding be in my favor?', a: 'Yes. Funding flows between longs and shorts depending on the rate sign: positive rates mean longs pay shorts, negative rates mean shorts pay longs. Holding against the crowded side actually earns funding — enter a negative rate in the calculator to see it reduce your break-even.' },
    { q: 'Why does my ticket show a loss right after entry?', a: 'The entry fee is deducted immediately and the mark price usually sits a spread away from your fill. That small instant drawdown is exactly the cost this calculator prices in — the position needs the break-even move before it is genuinely green.' }
  ],
  related: [['Funding cost calculator', '/crypto-funding-cost-calculator/'], ['Profit calculator', '/crypto-profit-calculator/'], ['Funding rates (live)', '/funding'], ['What is funding? (guide)', '/blog/what-is-funding-rate/'], ['All calculators (app)', '/calculators']]
},
{
  slug: 'stop-loss-calculator',
  title: 'Stop-Loss & Take-Profit Calculator — R:R Targets | MarginPad',
  desc: 'Free stop-loss calculator for crypto: exact stop price from your dollar risk and position size, plus 1R, 2R and 3R take-profit targets for clean risk-reward planning.',
  kw: 'stop loss calculator crypto, take profit calculator, risk reward calculator, r multiple targets',
  h1: 'Stop-Loss &amp; Take-Profit Calculator',
  sub: 'Put the stop where your risk says it belongs — then read the 1R / 2R / 3R targets the trade must reach to be worth taking.',
  inputs: sideSel + inp('entry', 'Entry price', 60000) + inp('pos', 'Position size (USD)', 1000) + inp('riskusd', 'Max loss (USD)', 50),
  js: `function calc(){var s=${G('side')},en=${G('entry')},p=${G('pos')},ru=${G('riskusd')};var r=document.getElementById('res');if(!(en>0&&p>0&&ru>0)){r.innerHTML='';return;}var dist=ru/p,sl=en*(1-s*dist),t1=en*(1+s*dist),t2=en*(1+s*dist*2),t3=en*(1+s*dist*3);var fx=function(v){return v.toLocaleString(undefined,{maximumFractionDigits:2});};
r.innerHTML='<div class="rrow"><span class="k">Stop distance</span><span class="v">'+(dist*100).toFixed(2)+'%</span></div><div class="rrow big"><span class="k">Stop-loss price</span><span class="v dn">'+fx(sl)+'</span></div><div class="rrow"><span class="k">Take-profit 1R (risk = reward)</span><span class="v up">'+fx(t1)+'</span></div><div class="rrow"><span class="k">Take-profit 2R</span><span class="v up">'+fx(t2)+'</span></div><div class="rrow"><span class="k">Take-profit 3R</span><span class="v up">'+fx(t3)+'</span></div>';}`,
  formula: 'stop distance % = max loss / position &nbsp;&nbsp;|&nbsp;&nbsp; nR target = entry &plusmn; n &times; stop distance',
  body: `<p>"R" is your risk unit — the dollar distance from entry to stop. Thinking in R keeps every trade comparable: a 2R winner pays for two 1R losers regardless of coin, leverage or position size. A strategy that wins only 40% of the time is still profitable if the average winner reaches 2R.</p>`,
  example: `Long at <b>$60,000</b> with a <b>$1,000</b> position risking <b>$50</b>: stop distance 5%, stop at <b>$57,000</b>. Targets: 1R $63,000, 2R $66,000, 3R $69,000. Win 2R even 4 times out of 10 and the ledger is green.`,
  faq: [
    { q: 'Should the stop go below support or at my risk number?', a: 'Both, in order: first find the structural level that invalidates the trade (below support for longs, above resistance for shorts), then size the POSITION so the dollar loss at that level equals your risk number. If the position gets too small to matter, the setup is too wide — skip it rather than tightening the stop into noise.' },
    { q: 'What risk-reward ratio is good?', a: 'It only means something next to your win rate: breakeven R:R = (1 / win rate) - 1. A 50% win rate breaks even at 1:1, a 33% win rate needs 2:1. Most swing systems aim for at least 2R average winners so an ordinary win rate still compounds.' },
    { q: 'Why did my stop fill at a worse price?', a: 'A stop-loss becomes a market order when touched, so in fast moves or thin books it fills with slippage. On MarginPad paper trades stops settle on candle closes with confirmation, and on real exchanges you can use stop-limit orders to bound slippage at the cost of possibly not filling.' }
  ],
  related: [['Position size', '/position-size-calculator/'], ['Profit calculator', '/crypto-profit-calculator/'], ['Risk of ruin', '/risk-of-ruin-calculator/'], ['Position sizing guide', '/blog/crypto-position-sizing-risk-management/'], ['Paper trading', '/paper-trade']]
},
{
  slug: 'crypto-funding-cost-calculator',
  title: 'Funding Cost Calculator — What Holding a Perp Really Costs | MarginPad',
  desc: 'Free funding cost calculator for crypto perpetuals: position size, funding rate and hold time turned into the exact dollars paid or earned per interval, per day and total.',
  kw: 'funding cost calculator, funding rate calculator crypto, perpetual funding fees, how much is funding',
  h1: 'Funding Cost Calculator',
  sub: 'Perpetuals never expire — funding is the rent that keeps them tied to spot. Price what your hold actually costs (or earns).',
  inputs: inp('pos', 'Position size (USD)', 10000) + inp('frate', 'Funding rate % / 8h', 0.01, '0.001') + inp('days', 'Days held', 7, '0.5') + `<div class="f"><label for="dir">You are</label><select id="dir"><option value="1">Paying (with the crowd)</option><option value="-1">Receiving (against it)</option></select></div>`,
  js: `function calc(){var p=${G('pos')},fr=${G('frate')}/100,d=${G('days')},dir=${G('dir')};var r=document.getElementById('res');if(!(p>0&&d>0)){r.innerHTML='';return;}var per=p*fr,day=per*3,tot=day*d,sgn=dir>0?-1:1;var fx=function(v){return (v>=0?'+':'')+v.toFixed(2);};
r.innerHTML='<div class="rrow"><span class="k">Per 8h interval</span><span class="v '+(sgn>0?'up':'dn')+'">'+fx(sgn*per)+' USD</span></div><div class="rrow"><span class="k">Per day (3 intervals)</span><span class="v '+(sgn>0?'up':'dn')+'">'+fx(sgn*day)+' USD</span></div><div class="rrow big"><span class="k">Over '+d+' day'+(d===1?'':'s')+'</span><span class="v '+(sgn>0?'up':'dn')+'">'+fx(sgn*tot)+' USD</span></div><div class="rrow"><span class="k">Annualized rate</span><span class="v">'+(fr*3*365*100).toFixed(1)+'% APR</span></div>';}`,
  formula: 'cost per interval = position &times; rate &nbsp;&nbsp;|&nbsp;&nbsp; daily = &times;3 &nbsp;&nbsp;|&nbsp;&nbsp; APR = rate &times; 3 &times; 365',
  body: `<p>Funding is exchanged directly between traders every 8 hours on the <strong>full position value</strong>, not your margin. A "small" 0.01% rate is 10.95% annualized — real money on any position held for weeks. When rates spike during euphoria (0.1%+ per interval), holding the crowded side can cost more than the move you are hoping for.</p>`,
  example: `A <b>$10,000</b> long at <b>+0.01%/8h</b> for <b>7 days</b>: $1 per interval, $3 per day, <b>$21 total</b> — about 10.95% APR. The same week at a euphoric 0.1% rate would cost <b>$210</b>.`,
  faq: [
    { q: 'Who pays funding to whom?', a: 'When the rate is positive, longs pay shorts (the perp trades above spot and the market pays people to short it back down). When negative, shorts pay longs. You pay or receive automatically every 8 hours while the position is open at the funding timestamp.' },
    { q: 'Is funding the same on every exchange?', a: 'No — each exchange computes its own rate from its own perp-vs-index premium, and they diverge, especially on smaller coins. That divergence is what funding-arbitrage desks trade. Check the live per-exchange rates on the MarginPad funding page before choosing a venue for a long hold.' },
    { q: 'Can I avoid funding entirely?', a: 'Close before the funding timestamp and you pay nothing for that interval — funding only hits positions open at the exact mark. Spot holdings never pay funding, and dated futures (quarterlies) replace it with a fixed basis, which suits long-term directional holds better than perps.' }
  ],
  related: [['Live funding rates', '/funding'], ['Break-even calculator', '/crypto-break-even-calculator/'], ['What is funding? (guide)', '/blog/what-is-funding-rate/'], ['Profit calculator', '/crypto-profit-calculator/'], ['All calculators (app)', '/calculators']]
}
];

let n = 0;
for (const pg of PAGES) {
  const dir = path.join(OUT, pg.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), shell(pg));
  n++;
}
console.log('gen-calc-suite: wrote ' + n + ' pages');
