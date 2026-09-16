/* /liquidations/ - live crypto liquidations, OUR OWN measurement (collector rollup via /api/cg/liquidations).
   Rebuilt 2026-09-17 (owner: "hocu da bude bas cool kao screener ... teksta da nema maltene ili da bude na kraju dole"):
   a data page first - stat strip, a live tape of the latest forced closes, coin rows you can sort and tap, the venue
   split - and the explanatory prose at the bottom, trimmed to what earns the page its search traffic. The first <h2>
   sits in that prose on purpose: the worker's SSR box (handleSsrHub) is injected before the first <h2>, so the
   crawler-facing sentences land with the prose and never between the reader and the data.
   Run: node build/gen-liquidations-page.js  (also wired into build/build.js). Post-processors (mp-nav, hub links,
   exchange rail, share card, sentry) are re-applied by build.js; the served page carries them, this template does not. */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist', 'liquidations');

const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const URL = 'https://marginpad.io/liquidations/';
const TITLE = 'Crypto Liquidations Today - Live Liquidation Tracker';
const DESC = 'Live crypto futures liquidations: total 24h liquidations, longs vs shorts, the most-liquidated coins and exchanges right now. Measured from nine exchange feeds, free, no signup.';
const KW = 'crypto liquidations, liquidation tracker, liquidations today, btc liquidations, eth liquidations, long short liquidations, futures liquidations, liquidation data';

// per-coin pages a row can deep-link to (read from dist at build time, so a link is never guessed)
const MAPS = fs.readdirSync(path.join(__dirname, '..', 'dist')).filter(d => /-liquidation-map$/.test(d)).map(d => d.replace(/-liquidation-map$/, '').toUpperCase());
const COINS = fs.existsSync(path.join(__dirname, '..', 'dist', 'coin')) ? fs.readdirSync(path.join(__dirname, '..', 'dist', 'coin')).map(d => d.toUpperCase()) : [];

const CSS = `
  :root{--lime:#c2f64a;--grn:#2ebd85;--red:#ff5a4d;--amber:#ffb020;--cyan:#3fd8e6}
  .lq-glow{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(52% 50% at 8% 0%,rgba(255,90,77,.07),transparent 60%),radial-gradient(48% 55% at 94% 20%,rgba(46,189,133,.06),transparent 60%)}
  .wrap{position:relative;z-index:1}
  .crumb{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px}
  .crumb-upd{margin-left:auto;font:700 10px 'Space Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:#8a95a1;border:1px solid var(--line-bright);border-radius:99px;padding:4px 10px;white-space:nowrap;display:inline-flex;align-items:center;gap:7px}
  .crumb-upd i{width:7px;height:7px;border-radius:50%;background:var(--grn);box-shadow:0 0 8px var(--grn)}
  article .lead{margin-bottom:14px}
  /* stat strip */
  .lq-top{display:grid;grid-template-columns:1.35fr 1fr 1fr 1fr;gap:10px;margin:16px 0 12px}
  .lq-stat{background:linear-gradient(180deg,var(--panel),#0d0f12);border:1px solid var(--line-bright);border-radius:16px;padding:15px 16px;min-width:0}
  .lq-stat .k{font-family:'Space Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint);display:flex;align-items:center;gap:7px}
  .lq-stat .v{font-family:'Bricolage Grotesque','Familjen Grotesk',sans-serif;font-weight:800;font-size:clamp(22px,2.6vw,30px);letter-spacing:-.03em;line-height:1.05;margin-top:8px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lq-stat.big .v{font-size:clamp(34px,4.2vw,50px);color:#fff}
  .lq-stat .v.up{color:var(--grn)}.lq-stat .v.dn{color:var(--red)}
  .lq-stat .s{font-family:'Space Mono',monospace;font-size:10.5px;color:var(--ink-faint);margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lqdot{width:8px;height:8px;border-radius:50%;background:var(--grn);box-shadow:0 0 7px var(--grn)}
  .lqls{display:flex;height:10px;border-radius:6px;overflow:hidden;background:var(--line);margin:12px 0 7px}
  .lqls i{display:block;height:100%}.lqls .l{background:var(--red)}.lqls .s{background:var(--grn)}
  .lqls-l{display:flex;justify-content:space-between;font-family:'Space Mono',monospace;font-size:11.5px;font-weight:700;gap:8px}
  .lqls-l .lng{color:#ff7b72}.lqls-l .sht{color:#34d99a}
  .lqls-l small{display:block;font-size:9.5px;font-weight:400;color:var(--ink-faint)}
  @media(max-width:900px){.lq-top{grid-template-columns:1fr 1fr}}
  @media(max-width:480px){.lq-top{grid-template-columns:1fr 1fr;gap:8px}.lq-stat{padding:12px 13px}.lq-stat.big{grid-column:1/-1}.lq-stat .k{font-size:8.5px;letter-spacing:.06em}.lq-stat .s{white-space:normal;line-height:1.4}} /* measured at 390px: the two-word labels wrapped and the biggest-hit note was cut mid-word */
  /* live tape */
  .lq-tape{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:2px 0 6px;margin:0 0 14px}
  .lq-tape::-webkit-scrollbar{display:none}
  .lq-ev{flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;font-family:'Space Mono',monospace;font-size:11px;padding:7px 11px;border-radius:9px;border:1px solid var(--line-bright);background:var(--panel);color:var(--ink);white-space:nowrap}
  .lq-ev b{font-weight:800}.lq-ev.l b{color:#ff7b72}.lq-ev.s b{color:#34d99a}
  .lq-ev .x{color:var(--ink-faint);font-size:9.5px}
  .lq-ev.head{background:transparent;border-style:dashed;color:var(--ink-faint);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase}
  /* chips + list */
  .lq-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 10px}
  .lq-chips{display:flex;gap:6px;flex-wrap:wrap;min-width:0}
  .lq-chips button{font-family:'Space Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.03em;padding:7px 11px;border-radius:8px;border:1px solid var(--line-bright);background:var(--panel);color:var(--ink-faint);cursor:pointer;min-height:34px}
  .lq-chips button:hover{color:var(--ink);border-color:var(--lime)}
  .lq-chips button.on{background:var(--lime);border-color:var(--lime);color:#0a0b0d}
  .lq-search{margin-left:auto;flex:1 1 150px;max-width:220px;min-width:120px;font-family:'Space Mono',monospace;font-size:12px;padding:8px 11px;border-radius:9px;border:1px solid var(--line-bright);background:#0b0d10;color:var(--ink);outline:none}
  .lq-search:focus{border-color:var(--lime)}
  .lq-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-faint);font-weight:700;margin:14px 0 9px}
  .lq-h span:last-child{font-weight:400;text-transform:none;letter-spacing:0;font-size:10px}
  .lq-list{display:flex;flex-direction:column;gap:6px}
  .lq-row{display:grid;grid-template-columns:56px minmax(0,1fr);gap:12px;align-items:center;width:100%;text-align:left;font:inherit;color:inherit;background:var(--panel);border:1px solid var(--line-bright);border-radius:12px;padding:10px 12px;cursor:pointer;transition:border-color .12s,background .12s;position:relative}
  .lq-row:hover{border-color:var(--lime);background:rgba(194,246,74,.03)}
  .lq-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;height:48px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
  .lq-tile b{font-family:'Space Mono',monospace;font-size:14px;font-weight:800;line-height:1;color:var(--ink)}
  .lq-tile small{font-family:'Space Mono',monospace;font-size:7.5px;letter-spacing:.1em;color:var(--ink-faint);margin-top:3px}
  .lq-tile.t1 b{color:var(--red)}.lq-tile.t1{border-color:rgba(255,90,77,.35);background:rgba(255,90,77,.08)}
  .lq-tile.t2 b{color:var(--amber)}.lq-tile.t2{border-color:rgba(255,176,32,.3);background:rgba(255,176,32,.06)}
  .lq-main{min-width:0;display:flex;flex-direction:column;gap:6px}
  .lq-main .l1{display:flex;align-items:center;gap:8px;min-width:0}
  .lq-main .sym{font-family:'Bricolage Grotesque','Familjen Grotesk',sans-serif;font-weight:800;font-size:16px;letter-spacing:-.01em;color:#fff;white-space:nowrap}
  .lq-main .pill{font-family:'Space Mono',monospace;font-size:9px;font-weight:800;padding:2px 6px;border-radius:5px;letter-spacing:.04em;white-space:nowrap}
  .lq-main .pill.l{background:rgba(255,90,77,.16);color:#ff7b72}.lq-main .pill.s{background:rgba(46,189,133,.16);color:#34d99a}.lq-main .pill.e{background:rgba(255,255,255,.07);color:var(--ink-dim)}
  .lq-main .tot{margin-left:auto;font-family:'Space Mono',monospace;font-size:13.5px;font-weight:800;color:var(--ink);white-space:nowrap}
  .lq-main .bar{display:flex;height:6px;border-radius:4px;overflow:hidden;background:rgba(255,255,255,.05)}
  .lq-main .bar i{display:block;height:100%}.lq-main .bar .l{background:var(--red)}.lq-main .bar .s{background:var(--grn)}
  .lq-main .l2{display:flex;justify-content:space-between;gap:8px;font-family:'Space Mono',monospace;font-size:10px;color:var(--ink-faint)}
  .lq-main .l2 .lg{color:#ff7b72}.lq-main .l2 .sh{color:#34d99a}
  .lq-more{display:block;width:100%;margin:10px 0 0;font-family:'Space Mono',monospace;font-size:11.5px;font-weight:700;padding:11px;border-radius:10px;border:1px dashed var(--line-bright);background:transparent;color:var(--ink-dim);cursor:pointer}
  .lq-more:hover{color:var(--lime);border-color:var(--lime)}
  .lq-empty{font-family:'Space Mono',monospace;font-size:12px;color:var(--ink-faint);text-align:center;padding:22px 12px;border:1px dashed var(--line-bright);border-radius:12px}
  .lq-sk{height:70px;border-radius:12px;margin-bottom:6px;background:linear-gradient(90deg,rgba(255,255,255,.03),rgba(255,255,255,.07),rgba(255,255,255,.03))}
  /* venues + go deeper */
  .lq-two{display:grid;grid-template-columns:1.2fr .8fr;gap:12px;margin:18px 0 6px}
  @media(max-width:760px){.lq-two{grid-template-columns:1fr}}
  .lq-card{background:var(--panel);border:1px solid var(--line-bright);border-radius:14px;padding:13px 14px;min-width:0}
  .lq-card .lq-h{margin:0 0 8px}
  .lq-ven{display:grid;grid-template-columns:90px minmax(0,1fr) auto;gap:8px 10px;align-items:center;padding:7px 0;border-top:1px solid rgba(255,255,255,.05);font-family:'Space Mono',monospace;font-size:11.5px}
  .lq-ven:first-child{border-top:0}
  .lq-ven b{color:var(--ink);text-transform:capitalize;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lq-ven .vb{display:flex;height:8px;border-radius:5px;overflow:hidden;background:rgba(255,255,255,.05)}.lq-ven .vb i{display:block;height:100%}.lq-ven .vb .l{background:var(--red)}.lq-ven .vb .s{background:var(--grn)}
  .lq-ven .vv{text-align:right;color:var(--ink);white-space:nowrap}.lq-ven .vv small{display:block;font-size:9px;color:var(--ink-faint)}
  .lq-card .more{display:inline-block;margin-top:10px;font-family:'Space Mono',monospace;font-size:11px;color:var(--lime);text-decoration:none;font-weight:700}
  .lq-go{display:flex;flex-direction:column;gap:6px}
  .lq-go a{display:flex;align-items:center;justify-content:space-between;gap:10px;text-decoration:none;color:var(--ink);font-size:13px;padding:9px 11px;border-radius:10px;border:1px solid var(--line-bright);background:#0b0d10}
  .lq-go a:hover{border-color:var(--lime)}
  .lq-go a small{font-family:'Space Mono',monospace;font-size:9.5px;color:var(--ink-faint);white-space:nowrap}
  .lqcta{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 8px}
  .lqcta a{flex:1;min-width:150px;text-align:center;text-decoration:none;font-family:'Space Mono',monospace;font-weight:700;font-size:13.5px;padding:13px 14px;border-radius:11px;border:1px solid var(--line-bright);background:linear-gradient(180deg,var(--panel),#0d0f12);color:var(--ink)}
  .lqcta a.go{background:var(--lime);color:#0a0b0d;border-color:var(--lime)}
  .lq-prose{margin-top:26px;padding-top:6px;border-top:1px solid var(--line)}
  .lq-prose h2{font-size:19px;margin:22px 0 8px}
  .lq-prose p{font-size:14px;color:var(--ink-dim)}
  .lq-prose .fine{font-family:'Space Mono',monospace;font-size:11px;color:var(--ink-faint);margin-top:18px}
  /* coin sheet */
  [hidden]{display:none!important}
  .lq-dim{position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:2147483000}
  .lq-sheet{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,calc(100vw - 24px));max-height:88vh;overflow-y:auto;background:#0d0f12;border:1px solid var(--line-bright);border-radius:18px;z-index:2147483001;padding:18px 18px 20px;box-shadow:0 30px 80px rgba(0,0,0,.6)}
  @media(max-width:620px){.lq-sheet{left:0;top:auto;bottom:0;transform:none;width:100vw;max-height:92vh;border-radius:16px 16px 0 0;border-left:0;border-right:0;border-bottom:0;padding-bottom:calc(20px + env(safe-area-inset-bottom))}}
  .lq-sh{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .lq-sh .t{font-family:'Bricolage Grotesque','Familjen Grotesk',sans-serif;font-weight:800;font-size:26px;letter-spacing:-.03em;color:#fff;line-height:1}
  .lq-sh .t small{display:block;font-family:'Space Mono',monospace;font-size:10.5px;font-weight:400;color:var(--ink-faint);letter-spacing:0;margin-top:5px}
  .lq-x{flex:0 0 auto;width:32px;height:32px;border-radius:8px;border:1px solid var(--line-bright);background:transparent;color:var(--ink-faint);font-size:13px;cursor:pointer}
  .lq-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:14px}
  .lq-tiles .c{background:var(--panel);border:1px solid var(--line-bright);border-radius:10px;padding:9px 10px;min-width:0}
  .lq-tiles .k{font-family:'Space Mono',monospace;font-size:8.5px;color:var(--ink-faint);letter-spacing:.06em;text-transform:uppercase}
  .lq-tiles .v{font-family:'Space Mono',monospace;font-size:13.5px;font-weight:800;color:var(--ink);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lq-tiles .v.up{color:#34d99a}.lq-tiles .v.dn{color:#ff7b72}
  .lq-read{margin-top:12px;font-size:13px;color:var(--ink-dim);line-height:1.55;background:rgba(194,246,74,.05);border:1px solid rgba(194,246,74,.2);border-radius:10px;padding:10px 12px}
  .lq-read b{color:#fff}
  .lq-lnk{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  .lq-lnk a{flex:1;min-width:130px;text-align:center;font-family:'Space Mono',monospace;font-size:11.5px;font-weight:700;padding:10px 12px;border-radius:10px;border:1px solid var(--line-bright);background:transparent;color:var(--ink);text-decoration:none}
  .lq-lnk a.go{background:var(--lime);border-color:var(--lime);color:#0a0b0d}
  .lq-lnk a:hover{border-color:var(--lime)}
  .lq-exh{font-family:'Space Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint);margin:14px 0 4px}
  .lq-ex{display:flex;flex-direction:column;gap:6px}
  .lq-ex a{display:flex;align-items:center;gap:9px;text-decoration:none;color:var(--ink);font-size:13px;padding:8px 10px;border-radius:9px;border:1px solid var(--line-bright);background:#0b0d10}
  .lq-ex a i{width:8px;height:8px;border-radius:50%;background:var(--c,#f7a600);box-shadow:0 0 8px -1px var(--c,#f7a600);flex:0 0 auto}
  .lq-ex a small{margin-left:auto;font-family:'Space Mono',monospace;font-size:9.5px;color:var(--ink-faint)}
  .lq-ex a.off{opacity:.5}
  @media(min-width:861px){.wrap{max-width:1180px;padding:0 clamp(24px,3vw,52px)}article h1{font-size:40px;letter-spacing:-.03em;margin:10px 0 8px}.lead{font-size:15.5px;max-width:860px}}
`;

const LD = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"Crypto Liquidations Tracker","url":"${URL}","applicationCategory":"FinanceApplication","operatingSystem":"Web","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Dataset","name":"Crypto futures liquidations, last 24 hours","description":"Forced closes of leveraged perpetual-futures positions across nine exchanges, measured continuously by MarginPad's own collector: market totals, long vs short, per coin and per exchange.","url":"${URL}","creator":{"@type":"Organization","name":"MarginPad","url":"https://marginpad.io/"},"license":"https://marginpad.io/terms/","isAccessibleForFree":true,"distribution":[{"@type":"DataDownload","encodingFormat":"application/json","contentUrl":"https://marginpad.io/api/v1/liquidations"},{"@type":"DataDownload","encodingFormat":"application/json","contentUrl":"https://marginpad.io/api/v1/venues"},{"@type":"DataDownload","encodingFormat":"application/json","contentUrl":"https://marginpad.io/api/v1/liquidations/live"}]}</script>`;

const FAQ = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is a liquidation in crypto?","acceptedAnswer":{"@type":"Answer","text":"A liquidation happens when a leveraged futures position is force-closed by the exchange because the trader's margin can no longer cover the loss. Long liquidations happen when price falls; short liquidations when price rises."}},{"@type":"Question","name":"How much crypto is liquidated in 24 hours?","acceptedAnswer":{"@type":"Answer","text":"It swings with volatility. Quiet days clear tens of millions of dollars across all perpetual futures markets; a sharp move can clear more than a billion in a single day. The live figure on this page is measured continuously from exchange liquidation websockets and carries its own timestamp."}},{"@type":"Question","name":"Why do liquidation trackers show different numbers?","acceptedAnswer":{"@type":"Answer","text":"Exchanges publish forced closes at different granularity, some batch cascades into single events, and feeds throttle under exactly the load that produces the most liquidations. Trackers that model the missing data report higher totals than trackers that only count observed events. MarginPad counts observed events only, which puts our figures at the conservative end."}},{"@type":"Question","name":"Are stop-losses counted as liquidations?","acceptedAnswer":{"@type":"Answer","text":"No. A stop-loss is a voluntary exit you placed yourself; a liquidation is a forced close executed by the exchange when margin can no longer cover the loss. Only the second appears on a liquidation feed. The totals here also exclude options, dated futures and on-chain lending liquidations."}},{"@type":"Question","name":"Which exchange has the most liquidations?","acceptedAnswer":{"@type":"Answer","text":"It changes daily. Binance is usually largest by absolute size because it carries the most open leverage, but share moves sharply during cascades. The per-venue breakdown with the long and short split is on this page and at marginpad.io/liquidations/by-exchange/."}},{"@type":"Question","name":"Can I get liquidation data as a free API?","acceptedAnswer":{"@type":"Answer","text":"Yes, keyless and CORS-enabled: /api/v1/liquidations for market totals, /api/v1/venues for the per-exchange breakdown, /api/v1/liquidations/live for individual recent events and /api/v1/clusters for the heatmap bands."}}]}</script>`;

let html = `<!DOCTYPE html>
<html lang="en">
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>${TITLE} | MarginPad</title>
<meta name="description" content="${DESC}" />
<meta name="keywords" content="${KW}" />
<link rel="canonical" href="${URL}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#0a0b0d" />
<meta property="og:title" content="${TITLE}" />
<meta property="og:description" content="${DESC}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${URL}" />
<meta property="og:image" content="https://marginpad.io/assets/og/liquidations.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${TITLE}" />
<meta name="twitter:description" content="${DESC}" />
<meta name="twitter:image" content="https://marginpad.io/assets/og/liquidations.jpg" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="stylesheet" href="/assets/blog.css" />
<style>${CSS}</style>
${LD}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://marginpad.io/"},{"@type":"ListItem","position":2,"name":"Liquidations","item":"${URL}"}]}</script>
${FAQ}
</head>
<body>
<div class="lq-glow" aria-hidden="true"></div>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b style="color:#c2f64a">PAD</b></a>
    <nav class="nav"><a href="/markets/">Markets</a><a href="/liquidations/">Liquidations</a><a href="/funding/">Funding</a><a href="/open-interest/">Open Interest</a><a href="/long-short/">Long/Short</a><a href="/screener">Screener</a></nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / Liquidations <span class="crumb-upd"><i></i>Live · nine exchange feeds</span></div>
  <article>
    <h1>Crypto Liquidations Today</h1>
    <p class="lead">Every forced close on nine perpetual-futures exchanges, counted by MarginPad's own collector as it happens: how much was wiped out in 24 hours, which side paid, which coins and which venues.</p>

    <section class="lq-top" id="lqTop" aria-label="24-hour totals">
      <div class="lq-stat big"><div class="k"><i class="lqdot"></i>Liquidated · 24h</div><div class="v" id="lqTot">…</div><div class="s" id="lqTotS">measuring</div></div>
      <div class="lq-stat"><div class="k">Longs vs shorts</div><div class="lqls" id="lqLs"><i class="l" style="width:50%"></i><i class="s" style="width:50%"></i></div><div class="lqls-l"><span class="lng" id="lqLong">…</span><span class="sht" id="lqShort">…</span></div></div>
      <div class="lq-stat"><div class="k">Biggest single hit</div><div class="v" id="lqBig">…</div><div class="s" id="lqBigS">largest one forced close today</div></div>
      <div class="lq-stat"><div class="k">Positions force-closed</div><div class="v" id="lqCnt">…</div><div class="s" id="lqCntS">in the last 24 hours</div></div>
    </section>

    <div class="lq-tape" id="lqTape" aria-label="Latest liquidations"><span class="lq-ev head">latest</span><span class="lq-ev">loading the feed…</span></div>

    <div class="lq-bar">
      <div class="lq-chips" id="lqChips" role="group" aria-label="Sort">
        <button type="button" data-sort="liq" class="on">Top total</button><button type="button" data-sort="long">Longs wiped</button><button type="button" data-sort="short">Shorts wiped</button><button type="button" data-sort="lpct">Long-heavy</button><button type="button" data-sort="spct">Short-heavy</button>
      </div>
      <input class="lq-search" id="lqQ" type="search" placeholder="Find a coin" autocomplete="off" aria-label="Find a coin" />
    </div>
    <div class="lq-h"><span>Most liquidated coins · 24h</span><span id="lqUpd"></span></div>
    <div class="lq-list" id="lqList"><div class="lq-sk"></div><div class="lq-sk"></div><div class="lq-sk"></div><div class="lq-sk"></div></div>
    <button type="button" class="lq-more" id="lqMore" hidden>Show every market</button>

    <div class="lq-two">
      <div class="lq-card"><div class="lq-h"><span>By exchange · 24h</span><span>share of all liquidations</span></div><div id="lqVen"><div class="lq-sk" style="height:40px"></div><div class="lq-sk" style="height:40px"></div></div><a class="more" href="/liquidations/by-exchange/">Full breakdown by venue &rarr;</a></div>
      <div class="lq-card"><div class="lq-h"><span>Go deeper</span></div><div class="lq-go">
        <a href="/rekt/">Live feed, every event as it lands <small>/rekt</small></a>
        <a href="/heatmap">Where the next stops are stacked <small>heatmap</small></a>
        <a href="/how-many-traders-liquidated-today/">How many traders were liquidated today <small>one answer</small></a>
        <a href="/liquidation-statistics/">Largest single hits, BTC and ETH <small>statistics</small></a>
        <a href="/free-crypto-api/">This data as free JSON <small>API</small></a>
      </div></div>
    </div>

    <div class="lqcta">
      <a class="go" href="/paper-trade">Practice with leverage, risk nothing →</a>
      <a href="/screener">Market screener</a>
      <a href="/calculators?c=liq">Liquidation price calculator</a>
    </div>

    <section class="lq-prose">
      <h2>What is a liquidation?</h2>
      <p>A <strong>liquidation</strong> is an exchange force-closing a leveraged futures position because the trader's margin can no longer cover the loss. The position is sold (or bought back) at market and the margin is gone. At high leverage the liquidation price sits close to the entry, so a small move against the position is enough. <strong>Long liquidations</strong> are buyers wiped out by a drop; <strong>short liquidations</strong> are sellers wiped out by a rally. A one-sided spike often marks a local extreme: a flush of longs can be a capitulation low, a wave of shorts can fuel a squeeze.</p>
      <h2>Why liquidation totals differ between sites</h2>
      <p>Exchanges publish forced closes at different granularity - some stream every fill, some batch a cascade into one event, and feeds throttle under exactly the load that produces the most liquidations. A tracker that models the gaps reports more than one that counts what it observed. MarginPad counts observed events and nothing else, so these totals sit at the conservative end; a figure several times larger on a violent day is usually estimation, not coverage.</p>
      <h2>What this number does not include</h2>
      <p>Perpetual-futures liquidations on the venues we subscribe to, and nothing else: no stop-losses or manual closes (never forced, never on a feed), no options or dated futures, no on-chain lending liquidations on Aave or Maker, and no venue without a public liquidation stream. Read it as leveraged perp positioning being wiped out, not every forced sale in crypto.</p>
      <p class="fine">Measured by MarginPad's collector from nine exchange websockets. For information only - not financial advice. Trade responsibly.</p>
    </section>
  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="/screener">Screener</a> · <a href="/rekt/">Rekt</a> · <a href="/">Tools</a> · <a href="/blog/">Blog</a> · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a></span>
  </footer>

  <div class="lq-dim" id="lqDim" hidden></div>
  <div class="lq-sheet" id="lqSheet" hidden role="dialog" aria-modal="true" aria-labelledby="lqShT"><div class="lq-sh"><div class="t" id="lqShT">-</div><button type="button" class="lq-x" id="lqShX" aria-label="Close">&#10005;</button></div><div id="lqShB"></div></div>
</div>
<script>(function(){
  var MAPS=${JSON.stringify(MAPS)},COINS=${JSON.stringify(COINS)};
  var $=function(id){return document.getElementById(id);};
  var esc=function(s){return String(s==null?'':s).replace(/[<>&"]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m];});};
  function bn(x){x=+x||0;var a=Math.abs(x);if(a>=1e9)return '$'+(x/1e9).toFixed(2)+'B';if(a>=1e6)return '$'+(x/1e6).toFixed(1)+'M';if(a>=1e3)return '$'+(x/1e3).toFixed(0)+'K';return '$'+x.toFixed(0);}
  function ago(ts){var s=Math.max(0,(Date.now()-ts)/1000);if(s<60)return Math.floor(s)+'s';if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';return Math.floor(s/86400)+'d';}
  var D=null,V=null,SORT='liq',Q='',ALL=false,CAP=30;
  /* ── stat strip ─────────────────────────────────────────────────────────────────────────── */
  function paintTop(d){
    var m=d.market||{},lp=m.total?m.long/m.total*100:50,sp=100-lp;
    $('lqTot').textContent=bn(m.total); $('lqTotS').textContent='across '+(m.coinsN||d.coins.length)+' markets on '+(d.exchanges||9)+' exchanges';
    $('lqLs').innerHTML='<i class="l" style="width:'+lp.toFixed(1)+'%"></i><i class="s" style="width:'+sp.toFixed(1)+'%"></i>';
    $('lqLong').innerHTML=lp.toFixed(0)+'% longs<small>'+bn(m.long)+'</small>'; $('lqShort').innerHTML=sp.toFixed(0)+'% shorts<small>'+bn(m.short)+'</small>';
    var b=d.big; if(b&&b.usd){ var el=$('lqBig'); el.textContent=bn(b.usd); el.className='v '+(b.side==='long_liquidated'?'dn':'up'); $('lqBigS').textContent=(b.s||'')+' '+(b.side==='long_liquidated'?'long':'short')+' on '+(b.ex||'')+' - one forced close'; }
    $('lqCnt').textContent=(m.count||0).toLocaleString('en-US'); $('lqCntS').textContent='positions in the last 24 hours';
    $('lqUpd').textContent='updated '+new Date(d.ts||Date.now()).toUTCString().slice(17,22)+' UTC · refreshes every minute';
  }
  /* ── coin rows ───────────────────────────────────────────────────────────────────────────── */
  function rows(){
    var cs=(D&&D.coins||[]).slice(), tot=(D&&D.market&&D.market.total)||1;
    cs=cs.map(function(c){var lp=c.liq?c.long/c.liq*100:50;return {s:c.s,liq:c.liq,long:c.long,short:c.short,lp:lp,sp:100-lp,share:c.liq/tot*100};});
    if(Q){var q=Q.toUpperCase();cs=cs.filter(function(c){return String(c.s).toUpperCase().indexOf(q)>=0;});}
    if(SORT==='long')cs.sort(function(a,b){return b.long-a.long;});
    else if(SORT==='short')cs.sort(function(a,b){return b.short-a.short;});
    else if(SORT==='lpct')cs=cs.filter(function(c){return c.liq>=1e6;}).sort(function(a,b){return b.lp-a.lp;}); /* a $40k market at 100% long is noise, not a signal */
    else if(SORT==='spct')cs=cs.filter(function(c){return c.liq>=1e6;}).sort(function(a,b){return b.sp-a.sp;});
    else cs.sort(function(a,b){return b.liq-a.liq;});
    return cs;
  }
  function paintList(){
    var box=$('lqList'),cs=rows(),more=$('lqMore');
    if(!cs.length){box.innerHTML='<div class="lq-empty">No market matches'+(Q?' "'+esc(Q)+'"':'')+'.</div>';more.hidden=true;return;}
    var show=ALL||Q?cs:cs.slice(0,CAP);
    box.innerHTML=show.map(function(c,i){
      var dom=c.lp>=60?'l':(c.sp>=60?'s':'e'), pillT=dom==='l'?'LONGS '+c.lp.toFixed(0)+'%':dom==='s'?'SHORTS '+c.sp.toFixed(0)+'%':'EVEN';
      var tcls=c.share>=15?'t1':(c.share>=5?'t2':'');
      return '<button type="button" class="lq-row" data-sym="'+esc(c.s)+'">'+
        '<span class="lq-tile '+tcls+'"><b>'+(c.share>=10?c.share.toFixed(0):c.share.toFixed(1))+'%</b><small>SHARE</small></span>'+
        '<span class="lq-main"><span class="l1"><b class="sym">'+esc(c.s)+'</b><span class="pill '+dom+'">'+pillT+'</span><span class="tot">'+bn(c.liq)+'</span></span>'+
        '<span class="bar"><i class="l" style="width:'+c.lp.toFixed(1)+'%"></i><i class="s" style="width:'+c.sp.toFixed(1)+'%"></i></span>'+
        '<span class="l2"><span class="lg">'+bn(c.long)+' longs</span><span class="sh">'+bn(c.short)+' shorts</span></span></span></button>';
    }).join('');
    more.hidden=!(cs.length>show.length); if(!more.hidden)more.textContent='Show all '+cs.length+' markets';
  }
  /* ── venues ──────────────────────────────────────────────────────────────────────────────── */
  function paintVen(v){
    var box=$('lqVen'); if(!box)return; var vs=(v&&v.venues)||[];
    if(!vs.length){box.innerHTML='<div class="lq-empty">Venue split appears with the next rollup.</div>';return;}
    var mx=Math.max.apply(null,vs.map(function(x){return x.total||0;}))||1;
    box.innerHTML=vs.slice(0,9).map(function(x){var lp=+x.longPct||50,w=(x.total||0)/mx*100;
      return '<div class="lq-ven"><b>'+esc(x.venue)+'</b><span class="vb" style="width:'+Math.max(6,w).toFixed(0)+'%"><i class="l" style="width:'+lp.toFixed(0)+'%"></i><i class="s" style="width:'+(100-lp).toFixed(0)+'%"></i></span><span class="vv">'+bn(x.total)+'<small>'+(+x.share||0).toFixed(1)+'% · '+lp.toFixed(0)+'% longs</small></span></div>';}).join('');
  }
  /* ── live tape ───────────────────────────────────────────────────────────────────────────── */
  function paintTape(ev){
    var t=$('lqTape'); if(!t)return; ev=(ev||[]).slice(0,14);
    if(!ev.length){t.innerHTML='<span class="lq-ev head">latest</span><span class="lq-ev">quiet right now</span>';return;}
    t.innerHTML='<span class="lq-ev head">latest</span>'+ev.map(function(e){var l=e.side==='long_liquidated';return '<span class="lq-ev '+(l?'l':'s')+'"><b>'+esc(e.symbol)+' '+(l?'LONG':'SHORT')+'</b>'+bn(e.notional)+'<span class="x">'+esc(e.exchange)+' · '+ago(e.ts)+' ago</span></span>';}).join('');
  }
  /* ── the coin sheet ──────────────────────────────────────────────────────────────────────── */
  function shOpen(sym){
    var c=(D&&D.coins||[]).filter(function(x){return x.s===sym;})[0]; if(!c)return;
    var tot=(D.market&&D.market.total)||1, lp=c.liq?c.long/c.liq*100:50, sp=100-lp, share=c.liq/tot*100;
    $('lqShT').innerHTML=esc(sym)+'<small>'+bn(c.liq)+' liquidated in 24h · '+share.toFixed(1)+'% of all liquidations</small>';
    var read=lp>=65?'<b>Longs took the pain</b> - '+lp.toFixed(0)+'% of what was wiped on '+esc(sym)+' was buyers liquidated by a drop. A flush like this often marks a local low, but only once it stops.':
             sp>=65?'<b>Shorts got squeezed</b> - '+sp.toFixed(0)+'% of what was wiped on '+esc(sym)+' was sellers liquidated by a rally. Squeezes feed on themselves until the short side is empty.':
             '<b>Two-sided</b> - both longs and shorts were liquidated on '+esc(sym)+', which is what a range with leverage on both sides looks like.';
    var links='<div class="lq-lnk">'+
      '<a class="go" href="/paper-trade?coin='+encodeURIComponent(sym)+'">Trade '+esc(sym)+' on paper &rarr;</a>'+
      (MAPS.indexOf(sym)>=0?'<a href="/'+esc(sym.toLowerCase())+'-liquidation-map/">'+esc(sym)+' liquidation map</a>':'')+
      (COINS.indexOf(sym)>=0?'<a href="/coin/'+esc(sym.toLowerCase())+'/">'+esc(sym)+' coin page</a>':'<a href="/rekt/">Live feed</a>')+'</div>';
    var ex='';
    try{ if(window.mpEx){ var cc=window.mpEx.ccNow(), order=window.mpEx.rank(cc);
      ex='<div class="lq-exh">Trade it for real</div><div class="lq-ex">'+order.slice(0,5).map(function(n){var p=window.mpEx.P[n]||{},blk=window.mpEx.blocked(n,cc),u=window.mpEx.url(n,sym);if(!u)return '';return '<a class="'+(blk?'off':'')+'" style="--c:'+(p.c||'#f7a600')+'" data-mpex="'+esc(n)+'" href="'+esc(u)+'" target="_blank" rel="sponsored noopener noreferrer"><i></i>'+esc(n)+'<small>'+(blk?'not available in '+esc(cc):(p.deep?esc(sym)+' perp':'open'))+'</small></a>';}).join('')+'</div>'; } }catch(e){}
    $('lqShB').innerHTML='<div class="lq-tiles">'+
      '<div class="c"><div class="k">Longs wiped</div><div class="v dn">'+bn(c.long)+'</div></div>'+
      '<div class="c"><div class="k">Shorts wiped</div><div class="v up">'+bn(c.short)+'</div></div>'+
      '<div class="c"><div class="k">Split</div><div class="v">'+lp.toFixed(0)+' / '+sp.toFixed(0)+'</div></div></div>'+
      '<div class="lq-read">'+read+'</div>'+links+ex;
    $('lqSheet').hidden=false; $('lqDim').hidden=false; document.documentElement.style.overflow='hidden';
    try{ navigator.sendBeacon('/api/track?t=event&type=liqsheet&l='+encodeURIComponent(sym)+'&p=/liquidations/'); }catch(e){}
  }
  function shClose(){ $('lqSheet').hidden=true; $('lqDim').hidden=true; document.documentElement.style.overflow=''; }
  document.addEventListener('click',function(e){
    var r=e.target.closest&&e.target.closest('.lq-row[data-sym]'); if(r){shOpen(r.getAttribute('data-sym'));return;}
    if(e.target.closest&&(e.target.closest('#lqShX')||e.target.closest('#lqDim'))){shClose();return;}
    var c=e.target.closest&&e.target.closest('#lqChips button[data-sort]'); if(c){SORT=c.getAttribute('data-sort');[].forEach.call(c.parentNode.children,function(x){x.classList.toggle('on',x===c);});ALL=false;paintList();return;}
    if(e.target.closest&&e.target.closest('#lqMore')){ALL=true;paintList();return;}
  });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape')shClose(); });
  var qEl=$('lqQ'); if(qEl){ var qt; qEl.addEventListener('input',function(){ clearTimeout(qt); qt=setTimeout(function(){ Q=qEl.value.trim(); paintList(); },120); }); }
  /* ── data ────────────────────────────────────────────────────────────────────────────────── */
  function J(u){return fetch(u,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});}
  function load(){
    J('/api/cg/liquidations').then(function(d){ if(!d||d.error||!d.market||!d.coins){ if(!D){$('lqTot').textContent='-';$('lqTotS').textContent='live data unavailable right now - retry shortly';$('lqList').innerHTML='<div class="lq-empty">Live data unavailable right now - retry shortly.</div>';} return; } D=d; paintTop(d); paintList(); });
    J('/api/v1/venues').then(function(v){ if(v&&v.data)paintVen(v.data); });
    J('/api/v1/feed?limit=200').then(function(j){ if(j&&j.events){ var ev=j.events.filter(function(e){return +e.notional>=10000;}); if(ev.length<6)ev=j.events.filter(function(e){return +e.notional>=1000;}); paintTape(ev); } }); /* the all-symbol feed; the tape shows what a reader would call a liquidation, not $28 dust */
  }
  load(); setInterval(load,60000);
  window.__lq={rows:rows,get:function(){return D;}};
})();</script>
<script defer src="/assets/mp-auth.js?v=6abb8590"></script>
<script defer src="/assets/mp-nav.js?v=f77a401b"></script>
</body>
</html>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
// Translated /<lang>/liquidations/ variants are RETIRED (2026-09-02): the worker 301s every translated subpage to its
// English original, so only the English page is written and any stale language dir is removed.
for (const L of ['ar','de','es','fr','id','ja','ko','nl','pt','ru','tr','zh']) { const d = path.join(__dirname, '..', 'dist', L, 'liquidations'); if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true }); }
console.log('wrote dist/liquidations/index.html (English only, ' + html.length + ' bytes; ' + MAPS.length + ' map links, ' + COINS.length + ' coin links)');
try {
  const smp = path.join(__dirname, '..', 'dist', 'sitemap.xml');
  let sm = fs.readFileSync(smp, 'utf8');
  if (sm.indexOf(URL) === -1) {
    const today = new Date().toISOString().slice(0, 10);
    sm = sm.replace('</urlset>', `  <url><loc>${URL}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>\n</urlset>`);
    fs.writeFileSync(smp, sm);
    console.log('sitemap: +1 (/liquidations/)');
  } else { console.log('sitemap: already listed'); }
} catch (e) { console.log('sitemap skipped:', e.message); }
