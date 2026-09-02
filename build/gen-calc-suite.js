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
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" sizes="any" /><link rel="icon" type="image/png" sizes="48x48" href="/assets/favicon-48.png" />
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
},
{ slug:'crypto-fee-calculator', title:'Crypto Fee Calculator — Maker vs Taker Costs | MarginPad', desc:'Free crypto fee calculator: position size and maker/taker rates turned into exact round-trip costs and what limit orders save monthly.', kw:'crypto fee calculator, maker taker fees, trading fee calculator', h1:'Crypto Fee Calculator', sub:'Fees are charged on the whole position, twice. Price them before the trade does.',
  inputs: inp('pos','Position size (USD)',10000)+inp('taker','Taker fee %',0.055,'0.001')+inp('maker','Maker fee %',0.02,'0.001')+inp('trades','Trades per month',40),
  js:`function calc(){var p=${G('pos')},t=${G('taker')}/100,m=${G('maker')}/100,n=${G('trades')};var r=document.getElementById('res');if(!(p>0)){r.innerHTML='';return;}var rtT=2*p*t,rtM=2*p*m,moT=rtT*n,moM=rtM*n;r.innerHTML='<div class="rrow"><span class="k">Round trip as taker</span><span class="v dn">-'+rtT.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Round trip as maker</span><span class="v">-'+rtM.toFixed(2)+' USD</span></div><div class="rrow big"><span class="k">Monthly cost ('+n+' trades, taker)</span><span class="v dn">-'+moT.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Limit orders save</span><span class="v up">+'+(moT-moM).toFixed(2)+' USD / month</span></div>';}`,
  formula:'round trip = 2 &times; position &times; fee% &nbsp;|&nbsp; monthly = round trip &times; trades',
  body:`<p>The gap between <strong>maker</strong> (resting limit orders) and <strong>taker</strong> (market orders) fees looks tiny per trade and enormous per year — an active trader on $10k positions can hand the exchange a four-figure sum annually purely for impatience.</p>`,
  example:`$10,000 position, 0.055% taker vs 0.02% maker, 40 trades/month: taker costs <b>$440/month</b>, maker <b>$160</b> — limit orders keep <b>$3,360 a year</b>.`,
  faq:[{q:'Why are maker fees lower?',a:'Resting limit orders provide the liquidity that makes the book usable, so exchanges reward them with lower fees or rebates; market orders consume liquidity and pay for immediacy.'},{q:'Do fees depend on leverage?',a:'Fees apply to position value (margin times leverage), so raising leverage with the same margin raises the fee bill proportionally.'},{q:'What other costs exist?',a:'Perpetuals exchange funding every 8 hours, and market orders pay slippage. The break-even and funding-cost calculators price the full round trip.'}],
  related:[['Break-even calculator','/crypto-break-even-calculator/'],['Funding cost','/crypto-funding-cost-calculator/'],['Compare exchanges','/exchanges'],['Profit calculator','/crypto-profit-calculator/']]
},
{ slug:'crypto-roi-calculator', title:'Crypto ROI Calculator — Return on Investment % | MarginPad', desc:'Free crypto ROI calculator: buy and sell prices turned into exact return percentage, profit and the annualized rate for the holding period.', kw:'crypto roi calculator, return on investment crypto, percent gain calculator', h1:'Crypto ROI Calculator', sub:'From entry and exit to honest percentages — including what the return annualizes to.',
  inputs: inp('inv','Amount invested (USD)',1000)+inp('buy','Buy price',30000)+inp('sell','Sell price',45000)+inp('days','Days held',180),
  js:`function calc(){var i=${G('inv')},b=${G('buy')},s=${G('sell')},d=${G('days')};var r=document.getElementById('res');if(!(i>0&&b>0&&s>0)){r.innerHTML='';return;}var roi=(s-b)/b,val=i*(1+roi),pr=val-i,ann=d>0?(Math.pow(1+roi,365/d)-1)*100:0;r.innerHTML='<div class="rrow big"><span class="k">ROI</span><span class="v '+(roi>=0?'up':'dn')+'">'+(roi>=0?'+':'')+(roi*100).toFixed(2)+'%</span></div><div class="rrow"><span class="k">Profit</span><span class="v '+(pr>=0?'up':'dn')+'">'+(pr>=0?'+':'')+pr.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Final value</span><span class="v">'+val.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Annualized</span><span class="v">'+(ann>=0?'+':'')+ann.toFixed(1)+'% / yr</span></div>';}`,
  formula:'ROI = (sell &minus; buy) / buy &nbsp;|&nbsp; annualized = (1 + ROI)^(365/days) &minus; 1',
  body:`<p>Raw ROI ignores time — +50% over five years is a very different trade from +50% in a quarter. Annualizing puts every position on the same clock so quick flips and long holds compare honestly.</p>`,
  example:`$1,000 into BTC at <b>$30,000</b>, sold at <b>$45,000</b> after <b>180 days</b>: ROI <b>+50%</b>, profit $500, annualized <b>+127.6%</b>.`,
  faq:[{q:'Does this include fees?',a:'No — it measures pure price return. Spot fees are usually ~0.1% per side; for leveraged positions use the profit calculator where fees matter far more.'},{q:'What is a good ROI in crypto?',a:'The honest benchmark is whether a pick beat simply holding BTC over the same window — many portfolios do not.'},{q:'Why annualize?',a:'Capital has opportunity cost. Annualizing shows whether money worked harder here than in an index or just BTC.'}],
  related:[['Profit calculator','/crypto-profit-calculator/'],['Compound calculator','/crypto-compound-calculator/'],['DCA calculator','/crypto-dca-calculator/'],['Bitcoin cycle','/bitcoin-cycle']]
},
{ slug:'crypto-drawdown-calculator', title:'Drawdown Recovery Calculator — The Gain a Loss Demands | MarginPad', desc:'Free drawdown calculator: the exact percentage gain needed to recover any loss — why -50% needs +100% — and how long recovery takes at your edge.', kw:'drawdown calculator, loss recovery calculator, percent to recover loss', h1:'Drawdown Recovery Calculator', sub:'Losses and gains are not symmetric. This is the brutal arithmetic every risk plan is built around.',
  inputs: inp('acct','Account before (USD)',10000)+inp('dd','Drawdown %',30,'0.5')+inp('edge','Avg monthly return %',5,'0.5'),
  js:`function calc(){var a=${G('acct')},d=${G('dd')}/100,e=${G('edge')}/100;var r=document.getElementById('res');if(!(a>0&&d>0&&d<1)){r.innerHTML='';return;}var left=a*(1-d),need=(1/(1-d)-1)*100,months=e>0?Math.log(1/(1-d))/Math.log(1+e):null;r.innerHTML='<div class="rrow"><span class="k">Account after drawdown</span><span class="v dn">'+left.toFixed(2)+' USD</span></div><div class="rrow big"><span class="k">Gain needed to recover</span><span class="v">+'+need.toFixed(1)+'%</span></div>'+(months!=null?'<div class="rrow"><span class="k">Months to highs at '+(e*100).toFixed(1)+'%/mo</span><span class="v">'+months.toFixed(1)+'</span></div>':'');}`,
  formula:'recovery gain = 1 / (1 &minus; drawdown) &minus; 1',
  body:`<p>Percentages compound from a smaller base after a loss: <strong>-10% needs +11%</strong>, -30% needs +43%, -50% needs +100%, -90% needs +900%. This asymmetry is the mathematical case for small per-trade risk — shallow drawdowns are cheap to repair, deep ones consume months of edge.</p>`,
  example:`A $10,000 account down <b>30%</b> holds $7,000 and needs <b>+42.9%</b> — about <b>7.3 months</b> of a solid 5%/month edge spent repairing instead of compounding.`,
  faq:[{q:'What drawdown is survivable?',a:'Mechanically anything under 100%; psychologically far less. Most professional programs treat 20-30% as the red line, beyond which required recovery demands unrealistic returns.'},{q:'How do I keep drawdowns shallow?',a:'Fixed fractional risk per trade (0.5-2%), sizing from stops, cutting size after losing streaks — the position-size calculator implements the first two.'},{q:'Does this apply to leveraged accounts?',a:'Even more: liquidation is a 100% drawdown of that margin. This math is why liquidation must never be the stop-loss.'}],
  related:[['Position size','/position-size-calculator/'],['Risk of ruin','/risk-of-ruin-calculator/'],['Win-rate expectancy','/crypto-win-rate-calculator/'],['Paper trading','/paper-trade']]
},
{ slug:'crypto-compound-calculator', title:'Compound Growth Calculator — Small Edges, Big Curves | MarginPad', desc:'Free compound calculator for traders: starting balance, periodic return and time turned into compounded growth, total return and the non-compounded comparison.', kw:'compound calculator trading, compound interest crypto, compounding returns', h1:'Compound Growth Calculator', sub:'A modest edge repeated is the strongest force in trading. See what yours compounds into.',
  inputs: inp('start','Starting balance (USD)',1000)+inp('ret','Return per period %',3,'0.1')+inp('per','Periods',52)+`<div class="f"><label for="unit">Period</label><select id="unit"><option value="week">Weeks</option><option value="month">Months</option><option value="day">Days</option></select></div>`,
  js:`function calc(){var s=${G('start')},re=${G('ret')}/100,n=${G('per')};var u=document.getElementById('unit').value;var r=document.getElementById('res');if(!(s>0&&n>0)){r.innerHTML='';return;}var f=s*Math.pow(1+re,n),tot=(f/s-1)*100;r.innerHTML='<div class="rrow big"><span class="k">After '+n+' '+u+'s</span><span class="v">'+f.toLocaleString(undefined,{maximumFractionDigits:2})+' USD</span></div><div class="rrow"><span class="k">Total return</span><span class="v '+(tot>=0?'up':'dn')+'">'+(tot>=0?'+':'')+tot.toFixed(1)+'%</span></div><div class="rrow"><span class="k">Same edge NOT compounded</span><span class="v">'+(s+s*re*n).toFixed(2)+' USD</span></div>';}`,
  formula:'final = start &times; (1 + r)^n',
  body:`<p>Compounding rewards consistency over heroics: 3% a week is +365% in a year, while chasing 50% months usually ends with the drawdown math working against you. The gap between the compounded and simple rows is the payment for discipline.</p>`,
  example:`$1,000 at <b>3% per week</b> for <b>52 weeks</b> compounds to <b>$4,650</b> (+365%); the same 3% withdrawn weekly totals just $2,560.`,
  faq:[{q:'Is a steady weekly percentage realistic?',a:'No week is average — treat the rate as your long-run mean including losing weeks, which for consistently profitable retail traders lands in low single digits weekly.'},{q:'Withdraw or compound?',a:'A common pattern: compound to a target account size, then withdraw a fixed share monthly. Full compounding maximizes growth and also maximizes what a late drawdown costs.'},{q:'How do losses fit in?',a:'They ARE the r — one -5% week among +4% weeks drags the geometric mean hard. Keep drawdowns shallow and the curve survives.'}],
  related:[['Drawdown recovery','/crypto-drawdown-calculator/'],['Win-rate expectancy','/crypto-win-rate-calculator/'],['ROI calculator','/crypto-roi-calculator/'],['Paper trading','/paper-trade']]
},
{ slug:'crypto-dca-calculator', title:'DCA Calculator — Average Entry Across Buys | MarginPad', desc:'Free DCA calculator: enter multiple buys (price and amount) and get your true average entry, total coins and the break-even for the whole stack.', kw:'dca calculator crypto, average entry calculator, dollar cost average bitcoin', h1:'Crypto DCA Calculator', sub:'Multiple buys, one honest number — the average entry your whole stack breaks even at.',
  inputs: inp('p1','Buy 1 price',60000)+inp('a1','Buy 1 amount (USD)',500)+inp('p2','Buy 2 price',52000)+inp('a2','Buy 2 amount (USD)',500)+inp('p3','Buy 3 price',0)+inp('a3','Buy 3 amount (USD)',0)+inp('p4','Buy 4 price',0)+inp('a4','Buy 4 amount (USD)',0),
  js:`function calc(){var r=document.getElementById('res');var tot=0,qty=0;for(var i=1;i<=4;i++){var p=+document.getElementById('p'+i).value,a=+document.getElementById('a'+i).value;if(p>0&&a>0){tot+=a;qty+=a/p;}}if(!(qty>0)){r.innerHTML='';return;}var avg=tot/qty;r.innerHTML='<div class="rrow"><span class="k">Total invested</span><span class="v">'+tot.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Total coins</span><span class="v">'+qty.toFixed(6)+'</span></div><div class="rrow big"><span class="k">Average entry (break-even)</span><span class="v">'+avg.toLocaleString(undefined,{maximumFractionDigits:2})+'</span></div>';}`,
  formula:'average entry = total spent / total coins bought',
  body:`<p>The average entry is a <strong>harmonic</strong> mean, not arithmetic — equal dollar buys automatically purchase more coins at lower prices, which is the quiet advantage of DCA over lump-sum timing.</p>`,
  example:`$500 at <b>$60,000</b> plus $500 at <b>$52,000</b> = 0.01795 BTC for $1,000 → average entry <b>$55,714</b>, below the $56,000 midpoint because the cheaper buy bought more coins.`,
  faq:[{q:'Is DCA better than buying at once?',a:'Lump-sum wins slightly more often in rising markets, but DCA removes the timing decision and matches how income arrives — for volatile assets the discipline is usually worth the small expected-value gap.'},{q:'Does DCA work for averaging down a loser?',a:'Only when the original thesis still holds and total size stays inside the risk plan. Averaging down without a limit is how small losses become account-enders.'},{q:'How often should buys happen?',a:'Weekly vs monthly differences are minor; consistency through a bear market matters more than frequency.'}],
  related:[['ROI calculator','/crypto-roi-calculator/'],['Break-even calculator','/crypto-break-even-calculator/'],['Demo Spot (practice)','/spot'],['Bitcoin cycle','/bitcoin-cycle']]
},
{ slug:'crypto-win-rate-calculator', title:'Win Rate & Expectancy Calculator — Is the System Profitable? | MarginPad', desc:'Free expectancy calculator: win rate, average winner and average loser combined into expectancy per trade — the number that says if a system makes money.', kw:'win rate calculator, expectancy calculator trading, average win loss ratio', h1:'Win Rate &amp; Expectancy Calculator', sub:'Win rate alone is a vanity metric. Expectancy is what your account actually feels.',
  inputs: inp('wr','Win rate %',45,'0.5')+inp('aw','Average winner (USD)',120)+inp('al','Average loser (USD)',60)+inp('tpm','Trades per month',30),
  js:`function calc(){var w=${G('wr')}/100,aw=${G('aw')},al=${G('al')},n=${G('tpm')};var r=document.getElementById('res');if(!(w>=0&&w<=1&&aw>=0&&al>=0)){r.innerHTML='';return;}var ex=w*aw-(1-w)*al,mo=ex*n,beWR=al+aw>0?al/(aw+al)*100:0;r.innerHTML='<div class="rrow big"><span class="k">Expectancy per trade</span><span class="v '+(ex>=0?'up':'dn')+'">'+(ex>=0?'+':'')+ex.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Expected monthly ('+n+' trades)</span><span class="v '+(mo>=0?'up':'dn')+'">'+(mo>=0?'+':'')+mo.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Break-even win rate</span><span class="v">'+beWR.toFixed(1)+'%</span></div>';}`,
  formula:'expectancy = winrate &times; avg win &minus; (1 &minus; winrate) &times; avg loss',
  body:`<p>A 45% win rate can be highly profitable and a 70% win rate can bleed money — it hinges on the <strong>size</strong> of winners versus losers. Expectancy multiplies the two into dollars per trade; times your frequency, that is your real monthly edge.</p>`,
  example:`45% win rate, avg winner <b>$120</b>, avg loser <b>$60</b>: expectancy <b>+$21 per trade</b> (+$630 over 30 trades), while the break-even win rate for that payoff is only 33%.`,
  faq:[{q:'How many trades before win rate is trustworthy?',a:'Under ~100 trades the confidence interval is roughly plus or minus 10 points. Judge systems on expectancy over hundreds of journaled trades, not a hot week.'},{q:'Improve win rate or payoff first?',a:'They trade off. Most durable systems fix a payoff floor (say 1.5R minimum) and optimize entries, because letting winners run is easier to systematize.'},{q:'Where do I get my numbers?',a:'From your journal — MarginPad tracks every paper trade automatically and the profile stats give win rate and average W/L to feed this page.'}],
  related:[['Risk of ruin','/risk-of-ruin-calculator/'],['Stop-loss & R targets','/stop-loss-calculator/'],['Trading journal','/trading-journal'],['Paper trading','/paper-trade']]
},
{ slug:'crypto-margin-calculator', title:'Margin Calculator — Collateral a Position Requires | MarginPad', desc:'Free crypto margin calculator: position size and leverage turned into exact initial margin, quantity, maintenance margin and your liquidation buffer.', kw:'margin calculator crypto, initial margin calculator, required margin futures', h1:'Crypto Margin Calculator', sub:'How much collateral the trade locks — before you find out at the order form.',
  inputs: inp('pos','Position size (USD)',5000)+inp('entry','Entry price',60000)+inp('lev','Leverage',10)+inp('mmr','Maintenance margin %',0.5,'0.1'),
  js:`function calc(){var p=${G('pos')},en=${G('entry')},l=${G('lev')},mm=${G('mmr')}/100;var r=document.getElementById('res');if(!(p>0&&en>0&&l>0)){r.innerHTML='';return;}var im=p/l,qty=p/en,mmv=p*mm;r.innerHTML='<div class="rrow big"><span class="k">Initial margin required</span><span class="v">'+im.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Quantity</span><span class="v">'+qty.toFixed(6)+'</span></div><div class="rrow"><span class="k">Maintenance margin</span><span class="v">'+mmv.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Buffer before liquidation</span><span class="v">'+(im-mmv).toFixed(2)+' USD</span></div>';}`,
  formula:'initial margin = position / leverage &nbsp;|&nbsp; maintenance = position &times; MMR',
  body:`<p>Initial margin opens the position; <strong>maintenance margin</strong> is the floor below which the exchange force-closes it. The distance between them is your entire cushion — and at high leverage that cushion is a rounding error.</p>`,
  example:`A <b>$5,000</b> position at 10x locks <b>$500</b> initial margin. With 0.5% maintenance ($25) the cushion is <b>$475</b> — a 9.5% adverse move ends the position.`,
  faq:[{q:'Cross vs isolated — which does this model?',a:'Isolated: only the assigned margin is at stake. Cross uses the whole wallet as cushion, delaying liquidation but risking everything — see the cross-vs-isolated guide on the blog.'},{q:'Why did the exchange ask for more?',a:'Bigger positions hit higher maintenance tiers, open orders reserve margin, and risk engines add fee buffers. This models the standard first tier.'},{q:'Can requirements change mid-trade?',a:'Yes — exchanges raise tiers during extreme volatility, moving liquidation closer without price moving. One more reason the buffer should never be your stop.'}],
  related:[['Leverage calculator','/leverage-calculator/'],['Liquidation calculator','/btc-liquidation-calculator/'],['Cross vs isolated (guide)','/blog/cross-vs-isolated-margin/'],['All calculators (app)','/calculators']]
},
{ slug:'risk-reward-calculator', title:'Risk-Reward Calculator — R:R and the Win Rate It Needs | MarginPad', desc:'Free risk-reward calculator: entry, stop and target turned into the R:R ratio, dollar risk and reward, and the exact break-even win rate the setup demands.', kw:'risk reward calculator, rr ratio calculator, break even win rate', h1:'Risk-Reward Calculator', sub:'Every setup is a bet with odds. This page prints the odds before you place it.',
  inputs: sideSel + inp('entry','Entry price',60000)+inp('stop','Stop-loss',58500)+inp('target','Target',64500)+inp('pos','Position size (USD)',1000),
  js:`function calc(){var s=${G('side')},en=${G('entry')},st=${G('stop')},tg=${G('target')},p=${G('pos')};var r=document.getElementById('res');if(!(en>0&&st>0&&tg>0&&p>0)){r.innerHTML='';return;}var risk=Math.abs(en-st)/en*p,rew=Math.abs(tg-en)/en*p,rr=risk>0?rew/risk:0,be=1/(1+rr)*100;r.innerHTML='<div class="rrow big"><span class="k">Risk : Reward</span><span class="v">1 : '+rr.toFixed(2)+'</span></div><div class="rrow"><span class="k">Dollar risk at stop</span><span class="v dn">-'+risk.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Dollar reward at target</span><span class="v up">+'+rew.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Break-even win rate</span><span class="v">'+be.toFixed(1)+'%</span></div>';}`,
  formula:'R:R = |target &minus; entry| / |entry &minus; stop| &nbsp;|&nbsp; break-even WR = 1 / (1 + R:R)',
  body:`<p>The break-even win rate is the honest filter: a 1:3 setup only needs to work <strong>25%</strong> of the time, a 1:0.5 setup needs <strong>67%</strong>. Compare that against your measured win rate and you know instantly whether a setup deserves capital.</p>`,
  example:`Long at <b>$60,000</b>, stop <b>$58,500</b>, target <b>$64,500</b>: R:R = 1:3 — risking $25 to make $75 per $1,000, profitable with any win rate above <b>25%</b>.`,
  faq:[{q:'Is a higher R:R always better?',a:'No — distant targets hit less often, so win rate falls as R:R rises. The product (expectancy) is what matters.'},{q:'Should I move the stop to break-even?',a:'It locks a free trade but knocks out positions that would have reached target — test in your journal; for many strategies it reduces expectancy despite feeling safer.'},{q:'Where should the target sit?',a:'At a level the market has a reason to reach: prior highs, liquidation clusters (see the heatmap), measured moves — then take only setups above your R:R threshold.'}],
  related:[['Stop-loss & R targets','/stop-loss-calculator/'],['Win-rate expectancy','/crypto-win-rate-calculator/'],['Liquidation heatmap','/heatmap'],['Paper trading','/paper-trade']]
},
{ slug:'apr-apy-calculator', title:'APR to APY Calculator — Compounding Frequency Truth | MarginPad', desc:'Free APR to APY converter: any rate and compounding frequency turned into the true annual yield. See what daily compounding really adds.', kw:'apr apy calculator, apr to apy, apy converter crypto', h1:'APR &harr; APY Calculator', sub:'Same money, two labels. Convert honestly between simple rates and compounded yields.',
  inputs: inp('apr','APR %',12,'0.1')+`<div class="f"><label for="freq">Compounds</label><select id="freq"><option value="365">Daily</option><option value="52">Weekly</option><option value="12">Monthly</option><option value="1">Yearly (none)</option></select></div>`+inp('amt','Amount (USD)',10000),
  js:`function calc(){var a=${G('apr')}/100,f=+document.getElementById('freq').value,amt=${G('amt')};var r=document.getElementById('res');if(!(a>=0)){r.innerHTML='';return;}var apy=Math.pow(1+a/f,f)-1;r.innerHTML='<div class="rrow big"><span class="k">APY (effective annual yield)</span><span class="v up">'+(apy*100).toFixed(2)+'%</span></div><div class="rrow"><span class="k">On '+amt.toLocaleString()+' USD / year</span><span class="v up">+'+(amt*apy).toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Compounding adds</span><span class="v">+'+((apy-a)*100).toFixed(2)+'% vs simple APR</span></div>';}`,
  formula:'APY = (1 + APR/n)^n &minus; 1',
  body:`<p>APR is the simple rate; APY includes compounding. Platforms quote whichever looks better — lending desks advertise APY, borrow costs get quoted as APR. At crypto-native double digits the gap is real money: 50% APR compounded daily is <strong>64.8% APY</strong>.</p>`,
  example:`<b>12% APR</b> compounded daily = <b>12.75% APY</b> — $1,275 instead of $1,200 on $10,000.`,
  faq:[{q:'Which number should I compare products by?',a:'Convert everything to APY and compare like for like — and remember quoted crypto yields float; today APY is a snapshot, not a promise.'},{q:'Does funding-rate APR work the same way?',a:'Funding settles every 8 hours (n = 1,095/year), so small per-interval rates annualize aggressively — the funding-cost calculator does that conversion.'},{q:'Why is realized yield lower than APY?',a:'Reward tokens sell below quote, rates decay as pools fill, and claim fees eat small positions. Treat advertised APY as a ceiling.'}],
  related:[['Funding cost','/crypto-funding-cost-calculator/'],['Compound calculator','/crypto-compound-calculator/'],['DeFi TVL','/defi'],['ROI calculator','/crypto-roi-calculator/']]
},
{ slug:'crypto-slippage-calculator', title:'Slippage Calculator — The Cost of Market Orders | MarginPad', desc:'Free slippage calculator: expected vs filled price turned into slippage percentage and dollars — and what it silently costs over a month of trading.', kw:'slippage calculator, market order cost, execution slippage crypto', h1:'Slippage Calculator', sub:'The order book charges an invisible fee for impatience. Measure it.',
  inputs: inp('exp','Expected price',60000)+inp('fill','Actual fill price',60045)+inp('pos','Position size (USD)',5000)+inp('tpm','Trades per month',40),
  js:`function calc(){var e=${G('exp')},f=${G('fill')},p=${G('pos')},n=${G('tpm')};var r=document.getElementById('res');if(!(e>0&&f>0&&p>0)){r.innerHTML='';return;}var sl=Math.abs(f-e)/e,usd=p*sl,mo=usd*2*n;r.innerHTML='<div class="rrow big"><span class="k">Slippage</span><span class="v">'+(sl*100).toFixed(3)+'%</span></div><div class="rrow"><span class="k">Cost on this fill</span><span class="v dn">-'+usd.toFixed(2)+' USD</span></div><div class="rrow"><span class="k">Monthly (both sides, '+n+' trades)</span><span class="v dn">-'+mo.toFixed(2)+' USD</span></div>';}`,
  formula:'slippage % = |fill &minus; expected| / expected',
  body:`<p>Slippage scales with order size, book depth and volatility — near zero on BTC majors in quiet hours, brutal on thin alts during news. For active traders it routinely costs more than the taker fee itself, and it never shows on a statement.</p>`,
  example:`Expecting <b>$60,000</b>, filled at <b>$60,045</b>: 0.075% — <b>$3.75</b> on a $5,000 position. Both sides of 40 monthly trades: <b>$300/month</b>, silently.`,
  faq:[{q:'How do I reduce slippage?',a:'Limit orders where urgency allows, split large orders, trade liquid pairs and hours, and avoid market orders around news — depth is visible in the book before you click.'},{q:'Is slippage worse with leverage?',a:'The percentage is the same but applies to the full position: at 20x a 0.1% slip instantly costs 2% of margin — on entry AND exit.'},{q:'Do stop-losses slip too?',a:'Yes — a triggered stop becomes a market order exactly when books thin out. Stop-limit orders bound the damage at the risk of not filling.'}],
  related:[['Fee calculator','/crypto-fee-calculator/'],['Break-even calculator','/crypto-break-even-calculator/'],['Compare exchanges','/exchanges'],['Screener (liquidity)','/screener']]
},
/* Tax estimator — deliberately jurisdiction-neutral: the user supplies their own rate, we supply the
   arithmetic and the vocabulary. We never assert what someone owes; futures tax treatment differs by
   country AND by contract type, and a confident wrong number here would be actively harmful. */
{ slug:'crypto-futures-tax-calculator', title:'Crypto Futures Tax Calculator — Net Realized P&L Estimator | MarginPad', desc:'Free crypto futures tax estimator: turn a year of realized gains, losses, fees and funding into a net taxable figure and an estimated bill at your own tax rate. Educational, not tax advice.', kw:'crypto futures tax calculator, crypto tax estimator, futures trading tax, capital gains crypto calculator, do i pay tax on crypto futures', h1:'Crypto Futures Tax Estimator', sub:'Turn a year of trading into the number that actually matters: net realized P&amp;L after costs, and what it might cost you at your own rate.',
  inputs: inp('gains','Realized gains (USD)',12000)+inp('losses','Realized losses (USD)',7500)+inp('fees','Trading fees paid (USD)',420)+inp('funding','Net funding paid (USD)',180)+inp('carry','Loss carried forward (USD)',0)+inp('rate','Your tax rate %',25,'0.5'),
  js:`function calc(){var g=${G('gains')},l=${G('losses')},f=${G('fees')},fu=${G('funding')},cf=${G('carry')},rt=${G('rate')}/100;var r=document.getElementById('res');if(!(g>=0&&l>=0)){r.innerHTML='';return;}var net=g-l,costs=(f||0)+(fu||0),afterCosts=net-costs,taxable=Math.max(0,afterCosts-(cf||0)),unused=Math.max(0,(cf||0)-Math.max(0,afterCosts)),tax=taxable*rt,keep=afterCosts-tax;var m=function(v){return (v<0?'-$':'$')+Math.abs(v).toLocaleString(undefined,{maximumFractionDigits:2});};
r.innerHTML='<div class="rrow"><span class="k">Net realized P&L (gains &minus; losses)</span><span class="v '+(net>=0?'up':'dn')+'">'+m(net)+'</span></div><div class="rrow"><span class="k">Deductible trading costs</span><span class="v dn">-'+m(costs).replace('$','')+' USD</span></div><div class="rrow"><span class="k">Result after costs</span><span class="v '+(afterCosts>=0?'up':'dn')+'">'+m(afterCosts)+'</span></div>'+(cf>0?'<div class="rrow"><span class="k">Loss carried forward applied</span><span class="v">-'+m(Math.min(cf,Math.max(0,afterCosts))).replace('$','')+' USD</span></div>':'')+'<div class="rrow"><span class="k">Estimated taxable amount</span><span class="v">'+m(taxable)+'</span></div><div class="rrow big"><span class="k">Estimated tax at '+(rt*100).toFixed(1)+'%</span><span class="v dn">'+m(tax)+'</span></div><div class="rrow"><span class="k">Keep after estimated tax</span><span class="v '+(keep>=0?'up':'dn')+'">'+m(keep)+'</span></div>'+(afterCosts<0?'<div class="rrow"><span class="k">Loss available to carry forward</span><span class="v">'+m(Math.abs(afterCosts)+(cf||0))+'</span></div>':(unused>0?'<div class="rrow"><span class="k">Unused carry-forward remaining</span><span class="v">'+m(unused)+'</span></div>':''));}`,
  formula:'taxable &asymp; (realized gains &minus; realized losses &minus; fees &minus; net funding) &minus; loss carry-forward &nbsp;&nbsp;|&nbsp;&nbsp; tax = taxable &times; your rate',
  body:`<p><strong>Read this first: this is an estimator, not tax advice.</strong> How a futures trade is taxed depends on where you live and on what you actually traded, and no calculator on the internet knows either. What it does do is the part everyone gets wrong by hand — turning a messy year of trades into one honest net number, with fees and funding treated as the real costs they are.</p>
<h2>Why "realized" is the only word that matters</h2>
<p>Almost every tax system taxes <strong>closed</strong> positions. An open long sitting at +$40,000 is generally not a taxable event no matter how good it looks; the day you close it, it usually is. That single distinction is why a trader can feel rich in December and owe nothing, or feel flat and owe a lot because the gains were realized early and given back later in a new tax year.</p>
<p>Your <a href="/trading-journal/">trading journal</a> is what makes this answerable — it separates closed trades from open ones and sums realized P&amp;L per period, which is exactly the input this estimator wants.</p>
<h2>Fees and funding are costs, not decoration</h2>
<p>Traders routinely enter their gross P&amp;L and forget that they also paid taker fees on every entry and exit and, on perpetuals, <a href="/blog/what-is-funding-rate/">funding</a> every eight hours. In most systems those are deductible costs of the trade. On an active account they are not a rounding error: a year of 0.055% round trips plus funding can be a five-figure deduction on a six-figure notional turnover, which is the difference between an accurate return and an expensive one.</p>
<h2>Losses are an asset — if you record them</h2>
<p>Realized losses normally offset realized gains, and many jurisdictions let an unused loss carry forward into future years. That is why the loss field here is not decoration: a $30,000 loss in a bad year can quietly reduce the bill on a good one. The rule attached to it (how long it carries, what it may offset) varies enormously, so the mechanic is universal but the limits are local.</p>
<h2>Why we do not pick a rate for you</h2>
<p>Because there is no honest single answer. Depending on where you file, futures profit may be treated as capital gains, as ordinary income, under a special futures regime with its own blended rate, or under a flat crypto-specific rate — and within any of those, the percentage typically depends on your total income for the year, not just on trading. Anyone showing you a confident "you owe X" without knowing your country and your income is guessing. Put <em>your</em> marginal rate in, or ask an accountant for it, and the arithmetic above is then genuinely yours.</p>
<h2>Keep records that survive a question</h2>
<ul>
<li><strong>Every closed trade</strong> with date, symbol, side, size, entry, exit and result — exchange exports and a journal both work.</li>
<li><strong>Fees and funding separately</strong>, because they are deductions and lumping them into P&amp;L makes the return unverifiable.</li>
<li><strong>Transfers between venues</strong>, which are usually not taxable events but look exactly like income to anyone reconstructing your year later.</li>
<li><strong>The year-end snapshot</strong> of open positions, so the line between realized and unrealized is documented rather than remembered.</li>
</ul>`,
  example:`A year with <b>$12,000</b> of realized gains, <b>$7,500</b> of realized losses, <b>$420</b> in fees and <b>$180</b> of net funding paid: net P&amp;L <b>+$4,500</b>, minus <b>$600</b> of costs = <b>$3,900</b> after costs. At a self-entered <b>25%</b> rate the estimate is <b>$975</b> of tax, leaving <b>$2,925</b>. Notice that the $600 of costs alone moved the bill by $150 — the part most hand-made spreadsheets forget.`,
  faq:[
    {q:'Do I pay tax on crypto futures profits?',a:'In most countries, yes, once a position is closed and the profit is realized. What differs is the category it falls into and the rate that applies: capital gains in some places, ordinary income in others, a dedicated futures regime or a flat crypto rate elsewhere. Check your own jurisdiction or ask a local accountant — this tool deliberately does not assume one.'},
    {q:'Are unrealized gains on an open position taxed?',a:'Generally not. Most systems tax realized results, so an open position that is deep in profit is usually not a taxable event until you close it. A small number of regimes apply mark-to-market treatment to certain contracts or professional traders, which is one more reason to confirm your local rule rather than assume.'},
    {q:'Can I deduct trading fees and funding payments?',a:'In most systems trading fees and net funding paid are costs of the trade and reduce the taxable result, which is why they are separate inputs here. Keep them itemised in your records — a return that lumps them into a single P&amp;L number is much harder to justify if anyone asks.'},
    {q:'What happens to a losing year?',a:'Realized losses normally offset realized gains in the same period, and an unused balance often carries forward to future years. Enter a carry-forward amount above to see it applied. How many years it carries and what it may offset is jurisdiction-specific.'},
    {q:'Is this calculator tax advice?',a:'No. It is an educational estimator that does arithmetic on numbers you supply, using a tax rate you supply. It does not know your country, your income, your contract types or your filing status, and it should not be used as the basis of a return. Treat the output as a planning figure and confirm the real one with a qualified professional.'}
  ],
  related:[['Trading journal','/trading-journal/'],['Profit calculator','/crypto-profit-calculator/'],['Fee calculator','/crypto-fee-calculator/'],['Funding cost','/crypto-funding-cost-calculator/'],['All calculators (app)','/calculators']]
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
