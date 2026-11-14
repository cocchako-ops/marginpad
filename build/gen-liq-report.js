// Monthly crypto liquidation report (2026-11-02): one citable page per month, built from our own archive
// (R2 marginpad-market v1/liquidations/<day>.csv.gz, aggregated by build/liq-report-agg.js into
// build/data/liq-report/<YYYY-MM>.json), plus the CSV files a journalist or a blogger can download and quote.
// Static HTML on purpose: a crawler runs no script, and every figure here is a sum over a closed month.
// Run: node build/gen-liq-report.js  -> then add-mpnav, add-og-image, fix-charset, add-sitemap-extras, bump-home-assets.
const fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const DATA = path.join(__dirname, 'data', 'liq-report');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';
const EXN = { binance: 'Binance USD-M', 'binance-coin': 'Binance COIN-M', bybit: 'Bybit', okx: 'OKX', hyperliquid: 'Hyperliquid', gate: 'Gate', htx: 'HTX', dydx: 'dYdX', bitfinex: 'Bitfinex' };
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const usd = v => v >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '$' + (v / 1e3).toFixed(0) + 'K' : '$' + v.toFixed(0);
const pct = (a, b) => (b > 0 ? (100 * a / b).toFixed(1) : '0.0') + '%';
const dayName = d => { const t = new Date(d + 'T00:00:00Z'); return MON[t.getUTCMonth()] + ' ' + t.getUTCDate(); };

function csv(rows) { return rows.map(r => r.map(c => /[",\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : c).join(',')).join('\n') + '\n'; }

function bars(days) {
  const ks = Object.keys(days).sort(), max = Math.max(...ks.map(k => days[k].usd)), W = 860, H = 220, bw = W / ks.length;
  let g = '';
  ks.forEach((k, i) => {
    const d = days[k], hl = H * d.l / max, hs = H * d.s / max, x = (i * bw + 2).toFixed(1), w = (bw - 4).toFixed(1);
    g += '<g><title>' + dayName(k) + ': ' + usd(d.usd) + ' (' + usd(d.l) + ' longs, ' + usd(d.s) + ' shorts)</title>'
      + '<rect x="' + x + '" y="' + (H - hl).toFixed(1) + '" width="' + w + '" height="' + hl.toFixed(1) + '" fill="#ff5a4d"/>'
      + '<rect x="' + x + '" y="' + (H - hl - hs).toFixed(1) + '" width="' + w + '" height="' + hs.toFixed(1) + '" fill="#2ebd85"/></g>';
    if ((i + 1) % 5 === 0 || i === 0) g += '<text x="' + (i * bw + bw / 2).toFixed(1) + '" y="' + (H + 16) + '" fill="#8b95a1" font-size="11" text-anchor="middle">' + (i + 1) + '</text>';
  });
  return '<svg class="rbars" viewBox="0 0 ' + W + ' ' + (H + 22) + '" role="img" aria-label="Daily liquidations, longs in red and shorts in green">' + g + '</svg>';
}

function monthPage(ym, D) {
  const [y, m] = ym.split('-').map(Number), mname = MON[m - 1] + ' ' + y, slug = '/liquidations/report/' + ym + '/', url = 'https://marginpad.io' + slug;
  const dk = Object.keys(D.days).sort(), top5 = dk.slice().sort((a, b) => D.days[b].usd - D.days[a].usd).slice(0, 5), calm = dk.slice().sort((a, b) => D.days[a].usd - D.days[b].usd)[0];
  const avg = D.tot / dk.length, longShare = pct(D.L, D.tot);
  const title = 'Crypto Liquidations ' + mname + ': ' + usd(D.tot) + ' Report with Data | MarginPad';
  const desc = 'Crypto futures liquidations in ' + mname + ': ' + usd(D.tot) + ' across twelve exchanges, ' + longShare + ' longs, the biggest days, coins and single liquidations. Free CSV downloads.';
  const dir = path.join(DIST, 'liquidations', 'report', ym);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'daily.csv'), csv([['date_utc', 'total_usd', 'longs_liquidated_usd', 'shorts_liquidated_usd', 'events']].concat(dk.map(k => [k, D.days[k].usd.toFixed(2), D.days[k].l.toFixed(2), D.days[k].s.toFixed(2), D.days[k].n]))));
  fs.writeFileSync(path.join(dir, 'exchanges.csv'), csv([['exchange', 'total_usd', 'share_pct']].concat(D.ex.map(([e, v]) => [EXN[e] || e, v.toFixed(2), (100 * v / D.tot).toFixed(2)]))));
  fs.writeFileSync(path.join(dir, 'coins.csv'), csv([['coin', 'total_usd', 'longs_liquidated_usd', 'shorts_liquidated_usd', 'events']].concat(D.sym.map(([s, v]) => [s, v.u.toFixed(2), v.l.toFixed(2), v.s.toFixed(2), v.n]))));
  fs.writeFileSync(path.join(dir, 'biggest.csv'), csv([['time_utc', 'exchange', 'coin', 'side', 'usd', 'price']].concat(D.big.map(b => [b.ts, EXN[b.e] || b.e, b.s.replace(/^.*:/, '').replace(/USDT$|USD$/, ''), /long/.test(b.sd) ? 'long liquidated' : 'short liquidated', b.u.toFixed(2), b.px]))));
  const exRows = D.ex.map(([e, v]) => '<tr><td>' + esc(EXN[e] || e) + '</td><td>' + usd(v) + '</td><td>' + pct(v, D.tot) + '</td></tr>').join('');
  const coinRows = D.sym.slice(0, 15).map(([s, v], i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(s) + '</td><td>' + usd(v.u) + '</td><td>' + pct(v.l, v.u) + '</td></tr>').join('');
  const bigRows = D.big.slice(0, 10).map(b => '<tr><td>' + b.ts.slice(0, 16).replace('T', ' ') + '</td><td>' + esc(b.s.replace(/^.*:/, '').replace(/USDT$|USD$/, '')) + '</td><td>' + esc(EXN[b.e] || b.e) + '</td><td>' + (/long/.test(b.sd) ? 'Long' : 'Short') + '</td><td>' + usd(b.u) + '</td></tr>').join('');
  const dayList = top5.map(k => '<li><b>' + dayName(k) + '</b>: ' + usd(D.days[k].usd) + ' liquidated, ' + pct(D.days[k].l, D.days[k].usd) + ' of it longs</li>').join('');
  const hourList = D.topHours.slice(0, 5).map(([h, v]) => '<li>' + dayName(h.slice(0, 10)) + ', ' + h.slice(11, 13) + ':00 UTC: ' + usd(v) + '</li>').join('');
  const cite = 'MarginPad, "Crypto Liquidations ' + mname + '", ' + url;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Crypto futures liquidations, ' + mname, description: desc, url, license: 'https://creativecommons.org/licenses/by/4.0/', isAccessibleForFree: true, creator: { '@type': 'Organization', name: 'MarginPad', url: 'https://marginpad.io/' }, temporalCoverage: ym + '-01/' + dk[dk.length - 1], variableMeasured: ['liquidated notional USD', 'long vs short', 'exchange', 'coin'], distribution: ['daily', 'exchanges', 'coins', 'biggest'].map(f => ({ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: url + f + '.csv' })) },
    { '@context': 'https://schema.org', '@type': 'Article', headline: 'Crypto liquidations in ' + mname, datePublished: '2026-11-02', dateModified: '2026-11-02', author: { '@type': 'Organization', name: 'MarginPad' }, publisher: { '@type': 'Organization', name: 'MarginPad' }, mainEntityOfPage: url },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Liquidations', item: 'https://marginpad.io/liquidations/' }, { '@type': 'ListItem', position: 2, name: 'Monthly reports', item: 'https://marginpad.io/liquidations/report/' }, { '@type': 'ListItem', position: 3, name: mname, item: url }] }
  ];
  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">
<meta property="og:title" content="${esc('Crypto Liquidations ' + mname + ': ' + usd(D.tot))}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="article">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/blog.css" />
<style>
.rk{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:22px 0}
.rk div{background:#111419;border:1px solid #232932;border-radius:12px;padding:12px 14px}
.rk b{display:block;font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(20px,3vw,28px);color:#e9e7df}
.rk span{font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8b95a1}
.rbars{width:100%;height:auto;margin:6px 0 4px}
.rleg{font-size:12.5px;color:#9aa3ad}.rleg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 5px 0 10px;vertical-align:-1px}
.rtw{overflow-x:auto}.rt{width:100%;border-collapse:collapse;font-size:14px}.rt th,.rt td{padding:7px 9px;border-bottom:1px solid #1d232b;text-align:left;white-space:nowrap}.rt th{color:#8b95a1;font-weight:500;font-size:12px}
.rdl{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.rdl a{border:1px solid #2f3742;border-radius:8px;padding:6px 10px;font-size:13px;text-decoration:none;color:#c8d0d9}.rdl a:hover{border-color:#c2f64a;color:#c2f64a}
.rcite{background:#111419;border:1px solid #232932;border-radius:10px;padding:10px 12px;font-family:'Space Mono',monospace;font-size:12.5px;color:#c8d0d9;word-break:break-word}
@media(max-width:620px){.rk{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
${ld.map(o => '<script type="application/ld+json">' + JSON.stringify(o) + '</script>').join('\n')}
${GTAG}
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="/liquidations/">Liquidations</a><a href="/heatmap">Heatmap</a><a href="/liquidations/report/">Reports</a></nav>
  </header>
  <article>
    <p style="font-size:13px"><a href="/liquidations/">Liquidations</a> / <a href="/liquidations/report/">Monthly reports</a></p>
    <h1>Crypto liquidations in ${mname}</h1>
    <p class="lead">Leveraged crypto futures traders were forced out of <b>${usd(D.tot)}</b> of positions in ${mname}, counted event by event from twelve exchanges. Long positions took ${longShare} of it. Every figure below is a sum over our own archive, and the data is free to download.</p>
    <div class="rk">
      <div><span>Total liquidated</span><b>${usd(D.tot)}</b></div>
      <div><span>Longs</span><b>${usd(D.L)}</b></div>
      <div><span>Shorts</span><b>${usd(D.S)}</b></div>
      <div><span>Events</span><b>${(D.n / 1e6).toFixed(2)}M</b></div>
    </div>

    <h2>Day by day</h2>
    ${bars(D.days)}
    <p class="rleg"><i style="background:#ff5a4d"></i>longs liquidated <i style="background:#2ebd85"></i>shorts liquidated &middot; day of the month, UTC</p>
    <p>An average day cleared ${usd(avg)}. The heaviest five days account for ${pct(top5.reduce((a, k) => a + D.days[k].usd, 0), D.tot)} of the month:</p>
    <ul>${dayList}</ul>
    <p>The quietest day was ${dayName(calm)} with ${usd(D.days[calm].usd)}. The busiest single hours:</p>
    <ul>${hourList}</ul>

    <h2>By exchange</h2>
    <div class="rtw"><table class="rt"><tr><th>Exchange</th><th>Liquidated</th><th>Share</th></tr>${exRows}</table></div>

    <h2>By coin</h2>
    <p>The fifteen markets with the most liquidated value. Tokenised stocks and metals (for example SNDK, SOXL, XAU) trade as perpetual futures on the same venues and are counted like any other market.</p>
    <div class="rtw"><table class="rt"><tr><th>#</th><th>Coin</th><th>Liquidated</th><th>Longs share</th></tr>${coinRows}</table></div>

    <h2>Biggest single liquidations</h2>
    <div class="rtw"><table class="rt"><tr><th>Time (UTC)</th><th>Coin</th><th>Exchange</th><th>Side</th><th>Size</th></tr>${bigRows}</table></div>

    <h2>Download the data</h2>
    <p>Free to use with attribution (CC BY 4.0).</p>
    <div class="rdl"><a href="daily.csv" download>Daily totals (CSV)</a><a href="exchanges.csv" download>By exchange (CSV)</a><a href="coins.csv" download>Top 25 coins (CSV)</a><a href="biggest.csv" download>Biggest liquidations (CSV)</a></div>
    <p>How to cite:</p>
    <p class="rcite">${esc(cite)}</p>

    <h2>How these numbers are measured</h2>
    <p>MarginPad runs its own collector subscribed to the public liquidation feeds of Binance (USD-M and COIN-M), Bybit, OKX, Hyperliquid, Gate, HTX, dYdX, Bitfinex, Bitget, Aster, Lighter and Kraken. Every event is stored with its time, exchange, market, side, price and size, and each day is archived and checked before it is written. Rows above a $50M sanity ceiling, which have only ever been duplicated exchange reports, are excluded.</p>
    <p>Treat the totals as a floor rather than a complete count. Binance publishes at most one liquidation per market per second, so in the busiest minutes some events are never broadcast, and exchanges we do not collect (for example Bitget) are not included. For the same reason, totals from other data providers can differ.</p>
    <p>Live figures for today are on the <a href="/liquidations/">liquidations tracker</a>, and where leverage is sitting right now is on the <a href="/heatmap">liquidation heatmap</a>.</p>
  </article>
  <footer>
    <span>&copy; 2026 MarginPad</span>
    <span><a href="/">Home</a> &middot; <a href="/blog/">Blog</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="/privacy/">Privacy</a></span>
  </footer>
</div>
</body>
</html>
`;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  return { ym, mname, slug, tot: D.tot, L: D.L, n: D.n };
}

function hub(list) {
  const url = 'https://marginpad.io/liquidations/report/';
  const rows = list.map(r => '<li><a href="' + r.slug + '">' + r.mname + '</a>: ' + usd(r.tot) + ' liquidated, ' + pct(r.L, r.tot) + ' longs</li>').join('');
  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>Monthly Crypto Liquidation Reports with Free Data | MarginPad</title>
<meta name="description" content="Monthly reports of crypto futures liquidations across twelve exchanges: totals, longs vs shorts, biggest days, coins and single liquidations, with free CSV downloads.">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:title" content="Monthly Crypto Liquidation Reports">
<meta property="og:url" content="${url}">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/blog.css" />
${GTAG}
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="/liquidations/">Liquidations</a><a href="/heatmap">Heatmap</a></nav>
  </header>
  <article>
    <h1>Monthly crypto liquidation reports</h1>
    <p class="lead">One report per month, summed from every liquidation our collector recorded on twelve exchanges. Each report has the daily totals, the exchanges, the coins and the biggest single liquidations, with the data as free CSV files.</p>
    <ul>${rows}</ul>
    <p>For today's figures, see the <a href="/liquidations/">live liquidations tracker</a>.</p>
  </article>
  <footer><span>&copy; 2026 MarginPad</span><span><a href="/">Home</a> &middot; <a href="/terms/">Terms</a></span></footer>
</div>
</body>
</html>
`;
  fs.mkdirSync(path.join(DIST, 'liquidations', 'report'), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'liquidations', 'report', 'index.html'), html);
}

const list = fs.readdirSync(DATA).filter(f => /^\d{4}-\d{2}\.json$/.test(f)).sort().reverse().map(f => monthPage(f.slice(0, 7), JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))));
hub(list);
console.log('liquidation reports:', list.map(r => r.ym + ' ' + usd(r.tot)).join(', '));
