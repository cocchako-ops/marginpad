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

// Charts (2026-11-16, owner: "mora da se odradi cool i da se naprave neki grafikoni"). Every chart is an SVG written into the
// static HTML, so a crawler and an assistant read the same figures a reader sees. Text uses classes styled in the page's
// own <style>, never inline font attributes, so the charts follow the page's fonts.
const RED = '#ff5a4d', GREEN = '#2ebd85', LIME = '#c2f64a', DIM = '#8b95a1', GRID = '#1c2230';
const niceMax = v => { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * e >= v) return m * e; return 10 * e; };
const px = v => '$' + Math.round(v).toLocaleString('en-US');
const prevDay = d => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };

// daily longs (red) + shorts (green) stacked, BTC's daily close as a lime line on its own right-hand axis
function bars(days, btc) {
  const ks = Object.keys(days).sort(), n = ks.length, W = 860, H = 300, L = 56, R = 64, T = 14, B = 30, pw = W - L - R, ph = H - T - B;
  const max = niceMax(Math.max(...ks.map(k => days[k].usd))), bw = pw / n, gap = Math.min(4, bw * 0.24), y = v => T + ph - v / max * ph;
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = max * i / 4, yy = y(v).toFixed(1); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="' + GRID + '"/><text x="' + (L - 8) + '" y="' + (+yy + 4) + '" text-anchor="end" class="ax">' + usd(v) + '</text>'; }
  ks.forEach((k, i) => {
    const d = days[k], x = L + i * bw + gap / 2, w = Math.max(1, bw - gap), yl = y(d.l), ys = y(d.l + d.s);
    g += '<g><title>' + dayName(k) + ': ' + usd(d.usd) + ' (' + usd(d.l) + ' longs, ' + usd(d.s) + ' shorts)' + (btc[k] ? ' - BTC closed ' + px(btc[k]) : '') + '</title>'
      + '<rect x="' + x.toFixed(1) + '" y="' + yl.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (T + ph - yl).toFixed(1) + '" rx="1.5" fill="' + RED + '"/>'
      + '<rect x="' + x.toFixed(1) + '" y="' + ys.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (yl - ys).toFixed(1) + '" rx="1.5" fill="' + GREEN + '"/></g>';
    if (i === 0 || (i + 1) % 5 === 0) g += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle" class="ax">' + (i + 1) + '</text>';
  });
  const pts = ks.map((k, i) => btc[k] ? [L + i * bw + bw / 2, btc[k]] : null).filter(Boolean);
  if (pts.length >= 2) {
    let lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1])); const pad = (hi - lo) * 0.12 || hi * 0.02; lo -= pad; hi += pad;
    const yb = v => T + ph - (v - lo) / (hi - lo) * ph;
    g += '<polyline fill="none" stroke="' + LIME + '" stroke-width="2.2" stroke-linejoin="round" points="' + pts.map(p => p[0].toFixed(1) + ',' + yb(p[1]).toFixed(1)).join(' ') + '"/>';
    for (const f of [0.15, 0.5, 0.85]) { const v = lo + (hi - lo) * f; g += '<text x="' + (W - R + 8) + '" y="' + (yb(v) + 4).toFixed(1) + '" class="ax" style="fill:' + LIME + '">' + px(Math.round(v / 100) * 100) + '</text>'; }
  }
  return '<svg class="rbars" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Daily liquidations, longs in red and shorts in green, with the Bitcoin daily close">' + g + '</svg>';
}

// the month as a calendar, Monday first: brighter = more liquidated, the figure printed in the cell
function calendar(ym, days) {
  const first = new Date(ym + '-01T00:00:00Z'), dow0 = (first.getUTCDay() + 6) % 7, nd = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const max = Math.max(...Object.values(days).map(d => d.usd)), cw = 116, ch = 60, gx = 6, top = 22, rows = Math.ceil((dow0 + nd) / 7), W = 7 * cw + 6 * gx, H = top + rows * (ch + gx);
  let g = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => '<text x="' + (i * (cw + gx) + 6) + '" y="14" class="ax">' + d + '</text>').join('');
  for (let d = 1; d <= nd; d++) {
    const k = ym + '-' + String(d).padStart(2, '0'), s = days[k], c = dow0 + d - 1, x = (c % 7) * (cw + gx), yy = top + Math.floor(c / 7) * (ch + gx);
    const a = s ? 0.1 + 0.8 * Math.sqrt(s.usd / max) : 0, ink = a > 0.55 ? ' style="fill:#0a0b0d"' : '';
    g += '<g>' + (s ? '<title>' + dayName(k) + ': ' + usd(s.usd) + ', ' + pct(s.l, s.usd) + ' longs</title>' : '')
      + '<rect x="' + x + '" y="' + yy + '" width="' + cw + '" height="' + ch + '" rx="9" fill="' + (s ? 'rgba(194,246,74,' + a.toFixed(3) + ')' : '#101216') + '" stroke="#232a35"/>'
      + '<text x="' + (x + 9) + '" y="' + (yy + 19) + '" class="cd"' + ink + '>' + d + '</text>'
      + (s ? '<text x="' + (x + cw - 9) + '" y="' + (yy + ch - 11) + '" text-anchor="end" class="cv"' + ink + '>' + usd(s.usd) + '</text>' : '') + '</g>';
  }
  return '<svg class="rbars" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Calendar of daily liquidations">' + g + '</svg>';
}

// which side each day hurt: the share of longs in the day's liquidated value, drawn from the 50% line
function sides(days) {
  const ks = Object.keys(days).sort(), n = ks.length, W = 860, H = 150, L = 44, R = 8, T = 8, B = 24, pw = W - L - R, ph = H - T - B, bw = pw / n, mid = T + ph / 2;
  let g = '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + mid + '" y2="' + mid + '" stroke="' + DIM + '" stroke-dasharray="3 4"/>'
    + '<text x="' + (L - 6) + '" y="' + (T + 9) + '" text-anchor="end" class="ax">100%</text><text x="' + (L - 6) + '" y="' + (mid + 4) + '" text-anchor="end" class="ax">50%</text><text x="' + (L - 6) + '" y="' + (T + ph) + '" text-anchor="end" class="ax">0%</text>';
  ks.forEach((k, i) => {
    const d = days[k], lp = d.usd > 0 ? d.l / d.usd : 0.5, x = L + i * bw + 1, w = Math.max(1, bw - 2), yy = T + ph - lp * ph;
    g += '<rect x="' + x.toFixed(1) + '" y="' + Math.min(mid, yy).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(1, Math.abs(mid - yy)).toFixed(1) + '" rx="1" fill="' + (lp >= 0.5 ? RED : GREEN) + '"><title>' + dayName(k) + ': ' + Math.round(lp * 100) + '% of the value was longs</title></rect>';
    if (i === 0 || (i + 1) % 5 === 0) g += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="ax">' + (i + 1) + '</text>';
  });
  return '<svg class="rbars" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Share of longs in each day of liquidations">' + g + '</svg>';
}

// ranked horizontal bars; with l/s split each bar is longs (red) then shorts (green)
function hbars(items) {
  const W = 860, rh = 30, L = 130, R = 150, H = items.length * rh + 4, max = Math.max(...items.map(x => x.v));
  let g = '';
  items.forEach((x, i) => {
    const yy = i * rh + 4, w = Math.max(2, (W - L - R) * x.v / max);
    g += '<g><title>' + esc(x.label) + ': ' + usd(x.v) + (x.l != null ? ' (' + pct(x.l, x.v) + ' longs)' : '') + '</title><text x="' + (L - 10) + '" y="' + (yy + 18) + '" text-anchor="end" class="lb">' + esc(x.label) + '</text>';
    if (x.l != null) { const wl = w * x.l / x.v; g += '<rect x="' + L + '" y="' + (yy + 5) + '" width="' + wl.toFixed(1) + '" height="18" rx="3" fill="' + RED + '"/><rect x="' + (L + wl).toFixed(1) + '" y="' + (yy + 5) + '" width="' + (w - wl).toFixed(1) + '" height="18" rx="3" fill="' + GREEN + '"/>'; }
    else g += '<rect x="' + L + '" y="' + (yy + 5) + '" width="' + w.toFixed(1) + '" height="18" rx="3" fill="' + (i ? '#3d4a5e' : LIME) + '"/>';
    g += '<text x="' + (L + w + 8).toFixed(1) + '" y="' + (yy + 18) + '" class="vl">' + usd(x.v) + '  ·  ' + x.share + '</text></g>';
  });
  return '<svg class="rbars" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Ranked bars">' + g + '</svg>';
}

// the month's BTC closes, fetched once from Bybit (the venue the site prices from) and kept in the month's data file
async function btcCloses(ym, D, file) {
  if (D.btc && Object.keys(D.btc).length >= 25) return D.btc;
  try {
    const end = Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 1) + 86400000;
    const r = await fetch('https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=D&limit=40&end=' + end);
    const j = await r.json(), out = {};
    for (const k of (j.result && j.result.list) || []) out[new Date(+k[0]).toISOString().slice(0, 10)] = +k[4];
    if (Object.keys(out).length) { D.btc = out; fs.writeFileSync(file, JSON.stringify(D)); }
    return out;
  } catch (e) { console.warn('btc closes unavailable:', e.message); return D.btc || {}; }
}

function monthPage(ym, D, btc, prevD) {
  const [y, m] = ym.split('-').map(Number), mname = MON[m - 1] + ' ' + y, slug = '/liquidations/report/' + ym + '/', url = 'https://marginpad.io' + slug;
  const dk = Object.keys(D.days).sort(), top5 = dk.slice().sort((a, b) => D.days[b].usd - D.days[a].usd).slice(0, 5), calm = dk.slice().sort((a, b) => D.days[a].usd - D.days[b].usd)[0];
  const avg = D.tot / dk.length, longShare = pct(D.L, D.tot);
  btc = btc || {};
  // BTC over the month = last close of the month against the close of the day before it began
  const b0 = btc[prevDay(dk[0])], b1 = btc[dk[dk.length - 1]], btcMove = b0 && b1 ? (b1 / b0 - 1) * 100 : null;
  const dayMove = k => btc[k] && btc[prevDay(k)] ? (btc[k] / btc[prevDay(k)] - 1) * 100 : null, sg = v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
  const worst = top5[0], worstMove = dayMove(worst);
  const vsPrev = prevD ? (100 * (D.tot - prevD.tot) / prevD.tot) : null;
  const longDays = dk.filter(k => D.days[k].l >= D.days[k].s).length;
  const sideLine = D.L / D.tot >= 0.55 ? 'Longs carried most of it: buyers forced out on the way down.' : D.L / D.tot <= 0.45 ? 'Shorts carried most of it: squeezes on the way up did the damage.' : 'The damage split almost evenly between longs and shorts.';
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
.rk em{display:block;font-style:normal;font-family:'Space Mono',monospace;font-size:11px;color:#8b95a1;margin-top:3px}.rk em.up{color:#ff5a4d}.rk em.dn{color:#2ebd85}.rk b.cr{color:#ff5a4d}.rk b.cg{color:#2ebd85}
.rcard{background:#0d0f13;border:1px solid #1f2630;border-radius:14px;padding:12px 14px;margin:12px 0}
.rbars{width:100%;height:auto;margin:6px 0 4px;display:block}
.rbars .ax{font:11px 'Space Mono',monospace;fill:#8b95a1}.rbars .lb{font:600 13px 'Familjen Grotesk',sans-serif;fill:#e9e7df}.rbars .vl{font:12px 'Space Mono',monospace;fill:#c8d0d9}.rbars .cd{font:700 12px 'Space Mono',monospace;fill:#c8d0d9}.rbars .cv{font:700 13px 'Space Mono',monospace;fill:#e9e7df}
.rleg{font-size:12.5px;color:#9aa3ad}.rleg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 5px 0 10px;vertical-align:-1px}
.rtw{overflow-x:auto}.rt{width:100%;border-collapse:collapse;font-size:14px}.rt th,.rt td{padding:7px 9px;border-bottom:1px solid #1d232b;text-align:left;white-space:nowrap}.rt th{color:#8b95a1;font-weight:500;font-size:12px}
.rdl{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.rdl a{border:1px solid #2f3742;border-radius:8px;padding:6px 10px;font-size:13px;text-decoration:none;color:#c8d0d9}.rdl a:hover{border-color:#c2f64a;color:#c2f64a}
.rcite{background:#111419;border:1px solid #232932;border-radius:10px;padding:10px 12px;font-family:'Space Mono',monospace;font-size:12.5px;color:#c8d0d9;word-break:break-word}
@media(max-width:620px){.rk{grid-template-columns:repeat(2,minmax(0,1fr))}.rcard{overflow-x:auto}.rcard .rbars{min-width:640px}}
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
    <p class="lead">Leveraged crypto futures traders were forced out of <b>${usd(D.tot)}</b> of positions in ${mname}, counted event by event from twelve exchanges. Long positions took ${longShare} of it. ${sideLine}${btcMove != null ? ' Bitcoin went ' + (btcMove >= 0 ? 'up ' : 'down ') + Math.abs(btcMove).toFixed(1) + '% over the month.' : ''} Every figure below is a sum over our own archive, and the data is free to download.</p>
    <div class="rk">
      <div><span>Total liquidated</span><b>${usd(D.tot)}</b>${vsPrev != null ? '<em class="' + (vsPrev >= 0 ? 'up' : 'dn') + '">' + sg(vsPrev) + ' vs ' + MON[(m + 10) % 12] + '</em>' : ''}</div>
      <div><span>Longs</span><b class="cr">${usd(D.L)}</b><em>${longShare} of the total</em></div>
      <div><span>Shorts</span><b class="cg">${usd(D.S)}</b><em>${pct(D.S, D.tot)} of the total</em></div>
      <div><span>Events</span><b>${(D.n / 1e6).toFixed(2)}M</b><em>${usd(avg)} a day</em></div>
      <div><span>Worst day</span><b>${usd(D.days[worst].usd)}</b><em>${dayName(worst)}${worstMove != null ? ', BTC ' + sg(worstMove) : ''}</em></div>
      <div><span>Biggest single</span><b>${D.big[0] ? usd(D.big[0].u) : '-'}</b><em>${D.big[0] ? esc(D.big[0].s.replace(/^.*:/, '').replace(/USDT$|USD$/, '')) + ' ' + (/long/.test(D.big[0].sd) ? 'long' : 'short') + ', ' + esc(EXN[D.big[0].e] || D.big[0].e) : ''}</em></div>
      <div><span>Days longs hurt more</span><b>${longDays} of ${dk.length}</b><em>${dk.length - longDays} days shorts did</em></div>
      <div><span>BTC over the month</span><b class="${btcMove == null ? '' : btcMove >= 0 ? 'cg' : 'cr'}">${btcMove != null ? sg(btcMove) : '-'}</b><em>${b0 && b1 ? px(b0) + ' to ' + px(b1) : 'Bybit daily close'}</em></div>
    </div>

    <h2>Day by day</h2>
    <div class="rcard">
    ${bars(D.days, btc)}
    <p class="rleg"><i style="background:#ff5a4d"></i>longs liquidated <i style="background:#2ebd85"></i>shorts liquidated <i style="background:#c2f64a;height:3px;vertical-align:3px"></i>Bitcoin daily close (right axis) &middot; day of the month, UTC</p>
    </div>
    <p>An average day cleared ${usd(avg)}. The heaviest five days account for ${pct(top5.reduce((a, k) => a + D.days[k].usd, 0), D.tot)} of the month:</p>
    <ul>${dayList}</ul>
    <p>The quietest day was ${dayName(calm)} with ${usd(D.days[calm].usd)}. The busiest single hours:</p>
    <ul>${hourList}</ul>

    <h2>The month as a calendar</h2>
    <div class="rcard">${calendar(ym, D.days)}<p class="rleg">The brighter the day, the more was liquidated. Each day's full story is in the <a href="/liquidations/recap/">daily recaps</a>.</p></div>

    <h2>Who got caught: longs or shorts</h2>
    <div class="rcard">${sides(D.days)}<p class="rleg"><i style="background:#ff5a4d"></i>the day hurt longs more <i style="background:#2ebd85"></i>the day hurt shorts more &middot; the bar is the share of the day's liquidated value that was longs, measured from the 50% line</p></div>
    <p>Longs took the bigger share on ${longDays} of ${dk.length} days.</p>

    <h2>By exchange</h2>
    <div class="rcard">${hbars(D.ex.slice(0, 10).map(([e, v]) => ({ label: EXN[e] || e, v, share: pct(v, D.tot) })))}</div>
    <div class="rtw"><table class="rt"><tr><th>Exchange</th><th>Liquidated</th><th>Share</th></tr>${exRows}</table></div>

    <h2>By coin</h2>
    <p>The fifteen markets with the most liquidated value, longs in red and shorts in green. Tokenised stocks and metals (for example SNDK, SOXL, XAU) trade as perpetual futures on the same venues and are counted like any other market.</p>
    <div class="rcard">${hbars(D.sym.slice(0, 12).map(([s, v]) => ({ label: s, v: v.u, l: v.l, share: pct(v.u, D.tot) })))}</div>
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
${'<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage', url, name: 'Monthly crypto liquidation reports', description: 'One report per month of crypto futures liquidations across twelve exchanges, with free CSV data.', isPartOf: { '@type': 'WebSite', name: 'MarginPad', url: 'https://marginpad.io/' }, hasPart: list.map(r => ({ '@type': 'Dataset', name: 'Crypto liquidations ' + r.mname, url: 'https://marginpad.io' + r.slug })) }, { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Liquidations', item: 'https://marginpad.io/liquidations/' }, { '@type': 'ListItem', position: 2, name: 'Monthly reports', item: url }] }] }) + '</script>'}
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

(async () => {
  const files = fs.readdirSync(DATA).filter(f => /^\d{4}-\d{2}\.json$/.test(f)).sort(), list = [];
  const prevYm = ym => { const t = new Date(ym + '-01T00:00:00Z'); t.setUTCMonth(t.getUTCMonth() - 1); return t.toISOString().slice(0, 7); };
  for (let i = 0; i < files.length; i++) {
    const file = path.join(DATA, files[i]), D = JSON.parse(fs.readFileSync(file, 'utf8')), ym = files[i].slice(0, 7);
    const prevD = i && files[i - 1].slice(0, 7) === prevYm(ym) ? JSON.parse(fs.readFileSync(path.join(DATA, files[i - 1]), 'utf8')) : null;
    list.push(monthPage(ym, D, await btcCloses(ym, D, file), prevD));
  }
  list.reverse();
  hub(list);
  console.log('liquidation reports:', list.map(r => r.ym + ' ' + usd(r.tot)).join(', '));
})();
