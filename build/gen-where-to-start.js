/* /where-to-start/ - a ROUTER, not a course.
 *
 * WHAT THIS WAS UNTIL 2026-09-15: a second academy living outside the Academy - 12 lessons with quizzes, XP,
 * levels, badges, streaks, practice missions, advanced tracks and a glossary, all rendered from the Academy's own
 * data files. Owner: "da ne vodi na neke svoje lekcije nego da kad covek izabere sta hoce i koje je njegov nivo,
 * da mu predlozi stranice za njega. Nikakve lekcije posebno iz akademije ne smeju da izlaze po sajtu, vec su
 * lekcije izricito u akademiji."
 *
 * SO: no lesson, no quiz, no XP, no badge, no streak lives on this page any more. It asks two questions - what do
 * you want to do, and how much have you done before - and answers with REAL PAGES of this site, in order, each
 * with one line saying why. Learning is one of the six answers, and that answer is /academy/.
 *
 * CRAWLER FIRST: all six goal blocks with every link are in the static HTML. JavaScript only narrows what is
 * already there (picking a goal hides the other five, picking a level drops the steps that are not for you), so a
 * crawler and a reader without JS both see the whole map. Nothing here is fetched.
 *
 * Run: node build/gen-where-to-start.js
 */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const URL_ = 'https://marginpad.io/where-to-start/';

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inj = v => JSON.stringify(v).replace(/</g, '\\u003c');

// Levels. `lv` on a step lists the levels it is shown for; a step with all three is shown to everyone.
const LEVELS = [
  { id: 'new', t: 'I have never traded', s: 'Crypto is new to me, or trading is' },
  { id: 'some', t: 'I know the basics', s: 'I understand leverage and liquidation' },
  { id: 'pro', t: 'I trade already', s: 'I want the tools, not the explanation' },
];
const ALL3 = ['new', 'some', 'pro'];

// ONE ICON PER GOAL, same drawing rules as the Browse drawer (24x24, stroke 1.9, round caps).
const IC = {
  learn: '<path d="M2.5 9.2 12 4.6l9.5 4.6L12 13.8 2.5 9.2z"/><path d="M6.6 11.3v4.4c0 1.6 2.4 2.9 5.4 2.9s5.4-1.3 5.4-2.9v-4.4"/><path d="M21.5 9.4v5.2"/>',
  practice: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  market: '<path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/>',
  real: '<path d="M12 2.8 4.6 5.6v6.2c0 4.5 3.1 7.9 7.4 9.4 4.3-1.5 7.4-4.9 7.4-9.4V5.6L12 2.8z"/><path d="M9.2 12.2l1.9 1.9 3.7-3.9"/>',
  bot: '<rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 4.6V8"/><circle cx="12" cy="3.4" r="1.2"/><path d="M9.2 12.4v1.6M14.8 12.4v1.6"/><path d="M2.4 13v3M21.6 13v3"/>',
  earn: '<path d="M7 3h10v6a5 5 0 0 1-10 0z"/><path d="M7 5H4.5a2.5 2.5 0 0 0 2.6 4.9"/><path d="M17 5h2.5a2.5 2.5 0 0 1-2.6 4.9"/><path d="M12 14v3"/><path d="M8.5 21h7"/><path d="M9.5 21c0-2 1-2.6 2.5-4 1.5 1.4 2.5 2 2.5 4"/>',
};

/* The six answers. Every `u` is a page that exists and answers 200 - the E2E fetches all of them.
   `why` is what that page does for THIS reader, in one line. No page is recommended twice inside a goal. */
const GOALS = [
  {
    id: 'learn', t: 'Understand how any of this works', s: 'Words first, money later',
    steps: [
      { u: '/academy/', t: 'The Academy', why: '16 courses and 140 lessons, free. This is the only place lessons live - start with the basics course.', lv: ALL3 },
      { u: '/guides/', t: 'Guides', why: '13 short explainers, one question each: liquidation, leverage, funding, mark price, margin.', lv: ALL3 },
      { u: '/guides/what-is-leverage-in-crypto/', t: 'What leverage actually is', why: 'The one idea that decides whether the rest of this hurts you.', lv: ['new', 'some'] },
      { u: '/guides/what-is-liquidation-price/', t: 'What a liquidation price is', why: 'The number the exchange is watching while you are watching the chart.', lv: ['new', 'some'] },
      { u: '/paper-trade', t: 'Paper Trade', why: 'When the words make sense, open a position with fake money and watch what the words do.', lv: ALL3 },
    ],
  },
  {
    id: 'practice', t: 'Practice without risking money', s: 'Live prices, fake money',
    steps: [
      { u: '/paper-trade', t: 'Paper Trade', why: 'Live prices, fake money, fills settled on our server. No sign-up to try it.', lv: ALL3 },
      { u: '/crypto-trading-simulator-no-sign-up/', t: 'The simulator, explained', why: 'The same terminal with the first-visit version of the instructions.', lv: ['new'] },
      { u: '/calculators', t: 'Calculators', why: 'Liquidation price and position size, worked out before you open rather than after.', lv: ALL3 },
      { u: '/spot/', t: 'Demo Spot', why: 'A $10,000 practice card, an exchange, a self-custody wallet and memecoins on four chains.', lv: ALL3 },
      { u: '/charts', t: 'Charts', why: 'Full-screen workspace: up to eight windows, indicators, drawings.', lv: ['some', 'pro'] },
      { u: '/trading-journal/', t: 'Trading journal', why: 'Write down why you took it and read it back later. This is the part almost everyone skips.', lv: ['some', 'pro'] },
      { u: '/trading-report/', t: 'Your trading report', why: 'What your own closed trades say about you, with the sample size printed next to every finding.', lv: ['pro'] },
    ],
  },
  {
    id: 'market', t: 'Read what the market is doing', s: 'Our own measurements, live',
    steps: [
      { u: '/liquidations/', t: 'Liquidations', why: 'Who is being closed out right now, from our own collector rather than a reseller.', lv: ALL3 },
      { u: '/heatmap', t: 'Liquidation heatmap', why: 'Where the leverage is stacked, and therefore where price tends to get pulled.', lv: ALL3 },
      { u: '/screener', t: 'Screener', why: 'Every market ranked by movement, funding and open interest in one table.', lv: ALL3 },
      { u: '/funding/', t: 'Funding rates', why: 'What longs and shorts are paying each other right now.', lv: ['some', 'pro'] },
      { u: '/open-interest/', t: 'Open interest', why: 'How much leverage is actually open, not how loud the timeline is.', lv: ['some', 'pro'] },
      { u: '/long-short/', t: 'Long/short ratio', why: 'Which side the crowd is on.', lv: ['some', 'pro'] },
      { u: '/hyperliquid-whales/', t: 'Whale tracker', why: 'The biggest Hyperliquid positions and their real fills, with the exchange timestamp.', lv: ['some', 'pro'] },
      { u: '/alerts/', t: 'Price alerts', why: 'Email or Telegram when a coin reaches your price, so you can stop refreshing.', lv: ALL3 },
    ],
  },
  {
    id: 'real', t: 'Move to real money, carefully', s: 'The parts that cost people accounts',
    steps: [
      { u: '/guides/how-to-calculate-position-size/', t: 'Size the position first', why: 'Decide the size before the trade, not during it.', lv: ALL3 },
      { u: '/calculators?c=liq', t: 'Liquidation calculator', why: 'Know the price that closes you before you click, for your exchange and its margin rate.', lv: ALL3 },
      { u: '/guides/how-to-avoid-liquidation/', t: 'How to avoid liquidation', why: 'The handful of habits that separate a drawdown from a zero.', lv: ['new', 'some'] },
      { u: '/guides/maker-vs-taker-fees/', t: 'What the fees really are', why: 'A round trip at high leverage can eat a fifth of your margin. Here is the arithmetic.', lv: ['some', 'pro'] },
      { u: '/exchanges/', t: 'Compare exchanges', why: 'Fees, leverage and liquidity side by side, with what each one charges you per side.', lv: ALL3 },
      { u: '/best-crypto-exchange-for-beginners/', t: 'Which exchange to open first', why: 'Written for a first account rather than for a professional desk.', lv: ['new'] },
    ],
  },
  {
    id: 'bot', t: 'Build or test a trading bot', s: 'Free tier, no card',
    steps: [
      { u: '/trading-api/', t: 'Bot API', why: 'REST, WebSocket and MCP against a paper account. The free plan needs no payment.', lv: ALL3 },
      { u: '/api-docs/', t: 'API reference', why: 'Every endpoint, rendered live from the spec so it cannot drift.', lv: ['some', 'pro'] },
      { u: '/free-crypto-api/', t: 'Free market data API', why: 'Prices, funding and liquidations as JSON, with no key at all.', lv: ALL3 },
      { u: '/arena/', t: 'Bot Arena', why: 'Other people’s bots ranked on live paper trades, open positions shown next to the win rate.', lv: ALL3 },
      { u: '/status/', t: 'Status', why: 'Uptime for the API and the liquidation feed, so you know whether it is you or us.', lv: ['pro'] },
    ],
  },
  {
    id: 'earn', t: 'Compete, and earn while practising', s: 'Free entry, real prizes',
    steps: [
      { u: '/trading-competition/', t: 'Trading competition', why: 'Free entry, six boards, prizes paid every 14 days. What it is and how the scoring works.', lv: ALL3 },
      { u: '/season/', t: 'Your season', why: 'The boards you are on, the pass, the daily call and your goals.', lv: ALL3 },
      { u: '/rewards/', t: 'Rewards', why: 'Claims, missions and withdrawals. The rewards area unlocks at Bronze, which is 500 XP.', lv: ALL3 },
      { u: '/levels/', t: 'Levels', why: 'Bronze to Diamond: how XP is earned and what each level opens.', lv: ['new', 'some'] },
      { u: '/vault/', t: 'The Vault', why: 'What the Ticks you earn actually buy.', lv: ['some', 'pro'] },
    ],
  },
];

const FAQ = [
  ['Where are the lessons?', 'Every lesson lives in the Academy - 16 courses and 140 lessons, free, with quizzes and XP. This page does not teach; it points you at the right page, and for learning that page is the Academy.'],
  ['Do I need an account?', 'No. Paper Trade, the calculators, the charts, the screener and every market page work without signing in. An account is only needed to keep your history, appear on a board or withdraw rewards.'],
  ['Does any of this cost money?', 'No. The tools, the Academy and the market data are free, and the Bot API has a free plan. We are paid by exchanges when someone opens an account through our links.'],
  ['Is the trading real?', 'No - MarginPad is paper trading. Prices are live and fills are settled on our server, but no money moves. That is the point: you can be wrong here for free.'],
];

const CSS = `:root{--bg:#0a0b0d;--panel:#111419;--panel2:#161a20;--line:#232932;--line2:#2c333d;--ink:#e9e7df;--dim:#9aa3ad;--faint:#5c656f;--lime:#c2f64a;--cyan:#3fd8e6}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:'Familjen Grotesk',system-ui,sans-serif;font-size:15px;line-height:1.55;-webkit-text-size-adjust:100%}
.wrap{max-width:860px;margin:0 auto;padding:0 18px 70px}
header{display:flex;align-items:center;justify-content:space-between;padding:18px 0}
.brand{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:21px;letter-spacing:-.04em;color:var(--ink);text-decoration:none}.brand b{color:var(--lime)}
.crumb{font-family:'Space Mono',monospace;font-size:11px;color:var(--faint);margin:6px 0 14px}.crumb a{color:var(--dim);text-decoration:none}
h1{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(30px,5.4vw,46px);line-height:1.04;letter-spacing:-.03em;margin:0 0 12px}
.lead{font-size:17px;color:var(--dim);margin:0 0 26px;max-width:62ch}
.step-h{font-family:'Space Mono',monospace;font-size:10.5px;text-transform:uppercase;letter-spacing:.14em;color:var(--faint);margin:26px 0 10px;display:flex;align-items:center;gap:9px}
.step-h i{font-style:normal;width:19px;height:19px;border-radius:50%;border:1px solid var(--line2);display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:var(--dim);flex:0 0 auto}
.goals{display:grid;grid-template-columns:repeat(auto-fit,minmax(248px,1fr));gap:9px}
.goal{display:flex;align-items:center;gap:12px;text-align:left;width:100%;background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:13px 14px;color:var(--ink);cursor:pointer;font:inherit;transition:border-color .14s,background .14s}
.goal:hover{background:var(--panel2);border-color:var(--line2)}
.goal.on{border-color:var(--lime);background:#141a10}
.goal .gi{flex:0 0 auto;width:34px;height:34px;border-radius:10px;background:rgba(194,246,74,.13);color:var(--lime);display:flex;align-items:center;justify-content:center}
.goal .gi svg{width:19px;height:19px;display:block}
.goal .gt{min-width:0}.goal .gt b{display:block;font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:14.5px;line-height:1.25}
.goal .gt small{display:block;color:var(--dim);font-size:11.5px;margin-top:1px}
/* grid, not a flex row: three equal chips that hold their own subtitle instead of clipping it. Measured on the
   first render - "I want the tools, not the explanation" was cut off at the right edge of its own chip. */
.levels{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:8px}
.lvl{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:10px 13px;color:var(--ink);cursor:pointer;font:inherit;font-size:13.5px;text-align:left;transition:border-color .14s,background .14s;min-height:44px}
.lvl:hover{background:var(--panel2)}.lvl.on{border-color:var(--lime);background:#141a10}
.lvl b{display:block;font-weight:600}.lvl small{display:block;color:var(--faint);font-size:11px;line-height:1.35}
.block{border:1px solid var(--line);border-radius:15px;background:var(--panel);padding:16px 16px 6px;margin:12px 0 16px}
.block>h2{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:19px;margin:0 0 2px;letter-spacing:-.01em}
.block>.bs{color:var(--dim);font-size:12.5px;margin:0 0 14px}
/* [hidden] LOSES TO display:flex - the same trap the whale page hit. Without this rule the level filter sets
   the property, the test sees it, and the reader still sees every step. */
.step{display:flex;gap:13px;padding:11px 0;border-top:1px solid var(--line);text-decoration:none;color:inherit;min-height:44px;align-items:center}
.step[hidden]{display:none}
.block[hidden]{display:none}
.step:first-of-type{border-top:0}
.step:hover .st{color:var(--lime)}
.step .sn{flex:0 0 auto;width:23px;height:23px;border-radius:50%;background:#0e1116;border:1px solid var(--line2);color:var(--faint);font-family:'Space Mono',monospace;font-size:11px;display:flex;align-items:center;justify-content:center;margin-top:1px}
.step .sb{min-width:0;flex:1}
.step .st{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:15px;display:block;transition:color .14s}
.step .sw{color:var(--dim);font-size:13px;display:block;margin-top:1px}
.step .sa{flex:0 0 auto;color:var(--faint);font-size:16px;align-self:center}
.step.first .sn{background:var(--lime);border-color:var(--lime);color:#0a0b0d;font-weight:700}
.tag{display:inline-block;font-family:'Space Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:var(--faint);border:1px solid var(--line2);border-radius:5px;padding:1px 5px;margin-left:6px;vertical-align:1px}
.tag.go{color:var(--lime);border-color:rgba(194,246,74,.45)}
.reset{background:none;border:0;color:var(--dim);font:inherit;font-size:13px;cursor:pointer;text-decoration:underline;padding:12px 2px;min-height:44px}
.faq{margin-top:34px}
.faq h2{font-family:'Bricolage Grotesque',sans-serif;font-size:21px;margin:0 0 12px}
.faq details{border-top:1px solid var(--line);padding:12px 0}
.faq summary{cursor:pointer;font-weight:600;font-size:15px;list-style:none}
.faq summary::-webkit-details-marker{display:none}
.faq summary::before{content:'+';color:var(--lime);margin-right:9px;font-family:'Space Mono',monospace}
.faq details[open] summary::before{content:'\\2212'}
.faq p{color:var(--dim);margin:9px 0 0;font-size:14px}
.foot{border-top:1px solid var(--line);margin-top:34px;padding-top:16px;color:var(--faint);font-size:13px}
.foot a{color:var(--lime)}
/* THE ONE TOAST EXCEPTION. This page deliberately loads no mp-auth (90 KB onto a light SEO page just to show a
   notice), so it keeps its own - but it must sit in the SAME bottom-right corner as window.mpToast everywhere
   else, and it must clear the mobile tab bar. Restyled that way on 2026-09-10; the 2026-09-15 rewrite briefly
   reverted it to the old centred version and toast-e2e caught it (overBar:true, right:133). */
.wts-toast{position:fixed;right:14px;left:auto;bottom:calc(88px + env(safe-area-inset-bottom));transform:translateX(120%);max-width:min(320px,calc(100vw - 28px));background:#11151b;border:1px solid rgba(194,246,74,.5);color:var(--ink);font-size:13.5px;font-weight:600;padding:12px 18px;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.6);z-index:200;opacity:0;transition:.3s}
.wts-toast.on{opacity:1;transform:none}
@media(min-width:881px){.wts-toast{bottom:16px}}
@media(max-width:560px){.goals{grid-template-columns:1fr}.block{padding:14px 13px 4px}}`;

const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';

function stepHtml(s, i) {
  const lvTag = s.lv.length === 3 ? '' : '<span class="tag">' + (s.lv.indexOf('new') >= 0 && s.lv.length === 1 ? 'if you are new'
    : s.lv.indexOf('pro') >= 0 && s.lv.length === 1 ? 'if you already trade' : s.lv.join('/').replace('new', 'new').replace('some', 'basics').replace('pro', 'trading')) + '</span>';
  return '<a class="step" href="' + s.u + '" data-lv="' + s.lv.join(' ') + '">'
    + '<span class="sn">' + (i + 1) + '</span>'
    + '<span class="sb"><span class="st">' + esc(s.t) + lvTag + '</span><span class="sw">' + esc(s.why) + '</span></span>'
    + '<span class="sa">&rsaquo;</span></a>';
}

function goalBlock(g) {
  return '<section class="block" data-goal="' + g.id + '">'
    + '<h2>' + esc(g.t) + '</h2><p class="bs">' + esc(g.s) + '</p>'
    + g.steps.map(stepHtml).join('')
    + '</section>';
}

const TITLE = 'Where To Start - Crypto Trading for Complete Beginners';
const DESC = 'Tell us what you want to do and how much you have done before, and we point you at the right pages on MarginPad - free tools, live market data and the Academy. No sign-up.';

function buildPage() {
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  const bcLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://marginpad.io/' },
      { '@type': 'ListItem', position: 2, name: 'Where to start', item: URL_ }],
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(TITLE)} | MarginPad</title>
<meta name="description" content="${esc(DESC)}">
<meta name="keywords" content="where to start crypto, crypto trading for beginners, how to start trading crypto, free crypto practice">
<link rel="canonical" href="${URL_}">
<link rel="alternate" hreflang="en" href="${URL_}">
<link rel="alternate" hreflang="x-default" href="${URL_}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0a0b0d">
<meta property="og:title" content="${esc(TITLE)}">
<meta property="og:description" content="${esc(DESC)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${URL_}">
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css">
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
<script type="application/ld+json">${JSON.stringify(bcLd)}</script>
<style>${CSS}</style></head>
<body>
<div class="wrap">
  <header><a class="brand" href="/">MARGIN<b>PAD</b></a></header>
  <article>
    <div class="crumb"><a href="/">Home</a> / Where to start</div>
    <h1>Where to start</h1>
    <p class="lead">Two questions, then a short list of pages that are actually for you. Everything here is free and most of it works without an account. The lessons are in <a href="/academy/" style="color:var(--lime)">the Academy</a> - this page just tells you which door to use.</p>

    <div class="step-h"><i>1</i>What do you want to do?</div>
    <div class="goals" id="goals">
      ${GOALS.map(g => `<button class="goal" type="button" data-pick="${g.id}"><span class="gi">${svg(IC[g.id])}</span><span class="gt"><b>${esc(g.t)}</b><small>${esc(g.s)}</small></span></button>`).join('\n      ')}
    </div>

    <div class="step-h" id="lvH"><i>2</i>How much have you done before?</div>
    <div class="levels" id="levels">
      ${LEVELS.map(l => `<button class="lvl" type="button" data-lv="${l.id}"><b>${esc(l.t)}</b><small>${esc(l.s)}</small></button>`).join('\n      ')}
    </div>

    <div class="step-h" id="outH"><i>3</i><span id="outLabel">Your next steps</span></div>
    <div id="out">
      ${GOALS.map(goalBlock).join('\n      ')}
    </div>
    <button class="reset" id="reset" type="button" hidden>Start over</button>

    <div class="faq">
      <h2>Questions people ask first</h2>
      ${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n      ')}
    </div>
  </article>
  <div class="foot">Nothing on MarginPad risks your money. <a href="/paper-trade">Open the paper terminal</a> whenever you want to try something.</div>
</div>
<script>
var GOALS=${inj(GOALS.map(g => ({ id: g.id, t: g.t })))};
var KEY='mp_wts';
function qs(s){return document.querySelector(s);}
function toast(t){var d=document.createElement('div');d.className='wts-toast';d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.classList.add('on');},20);setTimeout(function(){d.classList.remove('on');setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d);},350);},3600);}
var S={};try{S=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){S={};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function goalName(id){for(var i=0;i<GOALS.length;i++)if(GOALS[i].id===id)return GOALS[i].t;return '';}
/* JS only NARROWS what the HTML already contains - it never builds a recommendation, so a reader without
   JavaScript (and every crawler) still sees all six blocks and every link in them. */
function render(){
  var g=S.goal,lv=S.lv;
  document.querySelectorAll('.goal').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-pick')===g);});
  document.querySelectorAll('.lvl').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-lv')===lv);});
  document.querySelectorAll('.block').forEach(function(bl){
    var mine=!g||bl.getAttribute('data-goal')===g;
    bl.hidden=!mine;
    if(!mine)return;
    var first=null,n=0;
    bl.querySelectorAll('.step').forEach(function(st){
      var show=!lv||st.getAttribute('data-lv').split(' ').indexOf(lv)>=0;
      st.hidden=!show;st.classList.remove('first');
      if(show){n++;st.querySelector('.sn').textContent=n;if(!first)first=st;}
    });
    if(first&&lv){first.classList.add('first');
      var t=first.querySelector('.st');
      if(t&&!t.querySelector('.tag.go')){var e=document.createElement('span');e.className='tag go';e.textContent='start here';t.appendChild(e);}
    }
    bl.querySelectorAll('.tag.go').forEach(function(x){if(!x.closest('.step').classList.contains('first'))x.remove();});
  });
  var lab=qs('#outLabel');
  if(lab)lab.textContent=g?('Your next steps - '+goalName(g).toLowerCase()):'Your next steps';
  var r=qs('#reset');if(r)r.hidden=!(g||lv);
}
/* Only scroll when the next question is NOT already on screen. Scrolling unconditionally yanks the page under
   a finger that is about to tap the very button being moved - and the second tap then lands on whatever slid
   into that spot. Cheap to avoid, and it is the kind of thing only a real tap sequence shows. */
function nudge(sel){var h=qs(sel);if(!h)return;var r=h.getBoundingClientRect();
  if(r.top>=0&&r.bottom<=window.innerHeight)return;
  try{h.scrollIntoView({behavior:'smooth',block:'start'});}catch(x){}}
qs('#goals').addEventListener('click',function(e){var b=e.target.closest('[data-pick]');if(!b)return;
  S.goal=(S.goal===b.getAttribute('data-pick'))?null:b.getAttribute('data-pick');save();render();
  if(S.goal){toast(S.lv?'Narrowed to your level':'Now pick how much you have done before');nudge(S.lv?'#outH':'#lvH');}});
qs('#levels').addEventListener('click',function(e){var b=e.target.closest('[data-lv]');if(!b)return;
  S.lv=(S.lv===b.getAttribute('data-lv'))?null:b.getAttribute('data-lv');save();render();
  if(S.lv&&S.goal)nudge('#outH');});
qs('#reset').addEventListener('click',function(){S.goal=null;S.lv=null;save();render();try{window.scrollTo({top:0,behavior:'smooth'});}catch(x){window.scrollTo(0,0);}});
render();
</script>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>`;
}

fs.mkdirSync(path.join(DIST, 'where-to-start'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'where-to-start', 'index.html'), buildPage(), 'utf8');
const nSteps = GOALS.reduce((a, g) => a + g.steps.length, 0);
console.log('wrote /where-to-start/ - ' + GOALS.length + ' goals, ' + LEVELS.length + ' levels, ' + nSteps + ' recommended pages, 0 lessons');

// sitemap (unchanged URL - only added if missing)
try {
  const sp = path.join(DIST, 'sitemap.xml');
  let xml = fs.readFileSync(sp, 'utf8');
  if (xml.indexOf('/where-to-start/') === -1) {
    xml = xml.replace('</urlset>', '  <url><loc>' + URL_ + '</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>\n</urlset>');
    fs.writeFileSync(sp, xml);
    console.log('sitemap: +1 where-to-start URL');
  }
} catch (e) { console.log('sitemap update skipped:', e.message); }
