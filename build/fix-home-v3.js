// ONE-SHOT, APPLIED 2026-10-30 - kept for the record. dist/demo-home/index.html is the source now; the v3c/v3d/v3e CSS lines were appended by hand into <style id="homev3"> after this ran. It refuses to run on a page that already carries homev3.
// HOMEPAGE v3 (2026-10-30, owner: "preuredis homepage, bolji pristup, manje zauzetog prostora, predstavljeni kljucni proizvodi").
// Rewrites band 01 (Trade) of dist/demo-home/index.html: the Paper Trade hero keeps its chart, the competition card stays the
// SECOND tile (home-season-e2e), Charts + Ask AI takes the slot beside the hero (the dense grid pulls it up), then eight compact
// product tiles - Catalysts, Heatmap, Screener, Rekt, Demo Spot, Whales, Markets, Alerts. Every id the inline JS writes to
// survives (ptChart ptPx ptTickPnl cpCard* movers rk24 rkFeed mkts alTarget). A <style id="homev3"> tightens the hero, the
// bands, the exchanges and the learn tiles with overrides only - nothing in the existing stylesheet is edited.
// Idempotent: a page that already carries homev3 is restored from the marker-free original first.
const fs = require('fs');
const P = 'D:/part1/money-mission/dist/demo-home/index.html';
let s = fs.readFileSync(P, 'utf8');
const NL = s.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
if (s.indexOf('id="homev3"') >= 0) { console.log('already applied - restore dist/demo-home/index.html from git first'); process.exit(1); }
const i0 = s.indexOf('<section class="band" id="trade"');
const i1 = s.indexOf('</section>', i0) + '</section>'.length;
if (i0 < 0 || i1 < 10) { console.log('no trade band'); process.exit(1); }
const band = s.slice(i0, i1);
// the competition card, verbatim
const c0 = band.indexOf('    <!-- COMPETITION'), c1 = band.indexOf('    <a class="tile s4" href="/screener"');
if (c0 < 0 || c1 < 0) { console.log('no competition card'); process.exit(1); }
const cpCard = band.slice(c0, c1).replace(/\s+$/, '');
// the paper trade hero, verbatim (s8 -> keeps its chart)
const p0 = band.indexOf('    <a class="tile s8 pt-hero"'), p1 = c0;
const ptHero = band.slice(p0, p1).replace(/\s+$/, '');
// reusable live blocks
const movers = (band.match(/<div id="movers"[\s\S]*?<\/div>\s*<div class="t-go">/) || [''])[0].replace(/\s*<div class="t-go">$/, '');
const mkts = (band.match(/<div id="mkts"[\s\S]*?<\/div>\s*<div class="t-go">/) || [''])[0].replace(/\s*<div class="t-go">$/, '');
const rk = (band.match(/<div class="rk-24" id="rk24"><\/div>\s*<div id="rkFeed">[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];
const alPill = (band.match(/<div class="al-pill">[\s\S]*?<\/div>\s*<div class="al-chan">[\s\S]*?<\/div>/) || [''])[0];
if (!movers || !mkts || !rk || !alPill) { console.log('blocks', !!movers, !!mkts, !!rk, !!alPill); process.exit(1); }
const head = band.slice(0, band.indexOf('  <div class="bento">'));
const T = (cls, href, ac, kick, title, sub, go, extra) => '    <a class="tile ' + cls + '" href="' + href + '" style="--ac:' + ac + '">' + NL +
  '      <div class="t-kick">' + kick + '</div>' + NL +
  '      <div class="t-title">' + title + '</div>' + NL +
  (sub ? '      <div class="t-sub">' + sub + '</div>' + NL : '') +
  (extra ? '      ' + extra + NL : '') +
  '      <div class="t-go">' + go + ' <i>→</i></div>' + NL +
  '    </a>' + NL;
const out = head + '  <div class="bento">' + NL + NL +
  ptHero + NL + NL + cpCard + NL + NL +
  '    <!-- HOMEPAGE v3 (2026-10-30): the key products as compact tiles. Charts + Ask AI takes the slot beside the hero. -->' + NL +
  T('s4 pz feat', '/charts', '#3fd8e6', '<span class="dot"></span> Pro workspace · AI', 'Charts + Ask AI',
    'Up to 8 windows, 19+ indicators, drawing - and an AI that reads the chart, draws the setup and says <b>what moved the price</b>.',
    'Build your desk', '<div class="pz-chips"><span class="new">New</span><span>What moved it</span><span>Ask AI</span><span>Bar replay</span></div>') +
  T('s3 pz', '/catalysts/', '#c2f64a', '<span class="dot"></span> Live · scored', 'Catalysts',
    'Every listing, delisting, macro print, hack and headline as it lands - scored, with the move it caused.', 'What is moving the market') +
  T('s3 pz', '/heatmap', '#ff8c5a', 'Liquidation map', 'Heatmap',
    'Where the leveraged positions sit on ten majors, with the live order book and the tape under it.', 'Open the map') +
  T('s3 pz', '/screener', '#6aa3ff', '<span class="dot"></span> Top movers · 24h', 'Screener', '', 'Screen 130+ pairs', movers) +
  T('s3 pz', '/rekt/', '#ff5a4d', '<span class="dot"></span> Real-time feed', 'Rekt', '', 'Watch the carnage', rk) +
  T('s3 pz', '/spot/', '#a06bff', '<span class="dot"></span> Buy and hold', 'Demo Spot',
    '$10,000 to start, $100 a day to claim. Memes on 4 chains and the top 250 - one board pays $30 a season.', 'Start with $10,000') +
  T('s3 pz', '/hyperliquid-whales/', '#5ee6c8', '<span class="dot"></span> Hyperliquid · live', 'Whale tracker',
    'Every position over $1M, its liquidation price and the trades as they print.', 'Watch the whales') +
  T('s3 pz', '/coins/', '#16c2d6', '<span class="dot"></span> Live markets', 'Markets', '', 'Top 250 coins', mkts) +
  T('s3 pz', '/alerts/', '#ffd75a', 'Email · Telegram', 'Price Alerts', '', 'Set an alert', alPill) +
  NL + '  </div>' + NL + '</section>';
s = s.slice(0, i0) + out + s.slice(i1);
const CSS = '<style id="homev3">' + NL +
  '/* HOMEPAGE v3 (2026-10-30): less air, the products first. Overrides only. */' + NL +
  '.hero{padding:clamp(26px,3.6vw,54px) var(--pad) clamp(20px,2.6vw,36px);}' + NL +
  '.hero .sub{margin-top:14px;}.hero-note{margin-top:14px;}.hterm-chart{height:clamp(150px,13vw,190px);}' + NL +
  '.band{padding:clamp(26px,3.4vw,46px) var(--pad) clamp(16px,2vw,28px);}.band-head{margin-bottom:16px;}' + NL +
  '.tile{min-height:0;}.tile.pz{padding:18px 18px 16px;min-height:0;}.tile.pz .t-title{font-size:18px;}.tile.pz .t-sub{font-size:13px;line-height:1.5;margin-top:5px;}.tile.pz .t-go{padding-top:12px;font-size:10.5px;}' + NL +
  '.tile.pz #movers>*:nth-child(n+5),.tile.pz #mkts>*:nth-child(n+5){display:none;}.tile.pz #rkFeed>*:nth-child(n+4){display:none;}' + NL +
  '.tile.feat{border-color:rgba(63,216,230,.3);}.pz-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;position:relative;z-index:2;}.pz-chips span{font-family:\'Space Mono\',monospace;font-size:10px;font-weight:700;letter-spacing:.04em;padding:5px 9px;border-radius:999px;border:1px solid var(--line);color:var(--dim);}.pz-chips span.new{color:#0a0b0d;background:var(--lime);border-color:var(--lime);}' + NL +
  '.pt-viz{min-height:200px;}.pt-hero .t-sub{margin-top:6px;}' + NL +
  '.trust{padding:clamp(14px,1.8vw,22px) var(--pad);}' + NL +
  '.tools-list .tr:nth-child(n+4){display:none;}.blog-tags{display:none;}.path .st small{display:none;}' + NL +
  '.exbig{min-height:0;padding:18px 22px;gap:16px;align-items:center;}.exbig .exbig-side{display:none;}.exbig .exbig-s{display:none;}.exbig .exbig-t{font-size:clamp(18px,1.6vw,22px);}.exbig .exbig-main{gap:10px;}.exbig-offer{margin:0;}' + NL +
  '.exch-grid{grid-template-columns:repeat(5,1fr);gap:10px;}.exs{padding:11px 13px;gap:6px;}.exs .exs-d,.exs .exs-sub,.exs>span:not(.exs-top){display:none;}' + NL +
  '.b-learn .tile{min-height:0;padding:20px;}.foot{padding:clamp(26px,3vw,40px) var(--pad) 22px;margin-top:clamp(18px,2vw,32px);}' + NL +
  '@media(max-width:1000px){.exch-grid{grid-template-columns:repeat(3,1fr);}.tile.s3.pz{grid-column:span 6;}.tile.s4.pz{grid-column:span 12;}}' + NL +
  '@media(max-width:720px){.tile.pz{padding:14px 14px 12px;}.tile.pz .t-title{font-size:16px;}.tile.pz .t-sub{font-size:12px;}.tile.pz .t-kick{margin-bottom:7px;}.tile.pz #movers>*:nth-child(n+4),.tile.pz #mkts>*:nth-child(n+4){display:none;}.pt-viz{min-height:150px;}.exch-grid{grid-template-columns:repeat(2,1fr);gap:7px;}.exs{padding:9px 10px;}.hterm-chart{height:140px;}}' + NL +
  '</style>' + NL;
const h = s.indexOf('</head>');
s = s.slice(0, h) + CSS + s.slice(h);
fs.writeFileSync(P + '.tmp', s); fs.renameSync(P + '.tmp', P);
console.log('ok homev3: tiles', (s.match(/class="tile /g) || []).length, 'cpCard second', s.indexOf('id="cpCard"') > s.indexOf('pt-hero'));
