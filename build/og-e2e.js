// Share cards (2026-09-14) — owner: "jel mozemo za svaki link da napravimo drugaciju i cool stranicu ...
// da mami klik jer je to poenta."
//
// A link preview is rendered by a scraper that fetches the HTML and then fetches og:image. So every
// check here does exactly that: read the raw page, take the URL it declares, fetch it, and confirm what
// comes back is a real image of the right shape — and that two different pages do not declare the same one.
//
//   node build/og-e2e.js
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 240) : '')); } };

const DIST = path.join(__dirname, '..', 'dist');
const SAMPLE = [
  ['/', 'home'], ['/trading-competition/', 'competition'], ['/hyperliquid-whales/', 'live'],
  ['/btc-liquidation-map/', 'map'], ['/eth-liquidation-map/', 'map'],
  ['/100x-liquidation-calculator/', 'calc'], ['/position-size-calculator/', 'calc'],
  ['/blog/what-is-funding-rate/', 'article'], ['/blog/crypto-leverage-explained/', 'article'],
  ['/binance-vs-kucoin/', 'versus'], ['/coin/btc/', 'coin'], ['/rekt/', 'live'],
  ['/season/', 'product'], ['/academy/', 'product'], ['/paper-trade', 'tool'],
  ['/best-crypto-exchange-for-beginners/', 'article'], ['/es/rekt/', 'live'],
];

(async () => {
  console.log('\nevery page declares its own card');
  const seen = new Map();
  for (const [p] of SAMPLE) {
    const h = await (await fetch('https://marginpad.io' + p + (p.includes('?') ? '&' : '?') + 'cb=' + Date.now())).text();
    const all = h.match(/property="og:image" content="([^"]*)"/g) || [];
    const img = (h.match(/property="og:image" content="([^"]*)"/) || [])[1] || '';
    const tw = (h.match(/name="twitter:image" content="([^"]*)"/) || [])[1] || '';
    const w = (h.match(/property="og:image:width" content="(\d+)"/) || [])[1];
    const hh = (h.match(/property="og:image:height" content="(\d+)"/) || [])[1];
    ok(all.length === 1, p + ' declares exactly one og:image', all.length);
    ok(/\/assets\/og\/[a-z0-9-]+\.jpg$/.test(img), p + ' points at a per-page card', img);
    ok(tw === img, p + ' twitter:image agrees with og:image', { tw, img });
    ok(w === '1200' && hh === '630', p + ' declares the size so no platform crops it', { w, h: hh });
    if (!seen.has(img)) seen.set(img, []);
    seen.get(img).push(p);
  }
  // /es/rekt/ shares /rekt/'s card on purpose; nothing else may collide
  const dupes = [...seen.entries()].filter(([, ps]) => ps.length > 1)
    .filter(([, ps]) => !(ps.length === 2 && ps.some(x => x.startsWith('/es/')) && ps.some(x => !x.startsWith('/es/'))));
  ok(dupes.length === 0, 'no two different pages share a card', dupes);

  console.log('\nwhat the scraper actually fetches');
  for (const [p] of SAMPLE.slice(0, 8)) {
    const h = await (await fetch('https://marginpad.io' + p + '?cb=' + Date.now())).text();
    const img = (h.match(/property="og:image" content="([^"]*)"/) || [])[1];
    const r = await fetch(img);
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || '';
    // JPEG SOF gives the real pixel size — a card that is not 1200x630 gets letterboxed by every platform
    let dim = null;
    for (let i = 2; i < buf.length - 9;) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) { dim = { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }; break; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    ok(r.status === 200 && /image\/jpe?g/.test(ct), p + ' card fetches as a JPEG (' + r.status + ', ' + ct + ')');
    ok(dim && dim.w === 1200 && dim.h === 630, p + ' card is exactly 1200x630', dim);
    ok(buf.length > 12000 && buf.length < 250000, p + ' card weighs ' + Math.round(buf.length / 1024) + ' KB');
  }

  console.log('\nthe cards on disk');
  const dir = path.join(DIST, 'assets', 'og');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg'));
  ok(files.length > 400, 'the whole set is rendered (' + files.length + ' cards)');
  ok(!fs.readdirSync(dir).some(f => f.endsWith('.png')), 'no leftover PNGs beside them');
  { const sizes = files.map(f => fs.statSync(path.join(dir, f)).size);
    const tot = sizes.reduce((a, b) => a + b, 0);
    ok(Math.max(...sizes) < 250000, 'the heaviest card is ' + Math.round(Math.max(...sizes) / 1024) + ' KB');
    ok(tot < 60 * 1048576, 'the whole set is ' + (tot / 1048576).toFixed(1) + ' MB'); }

  console.log('\nthe house rule');
  { // the five cards that existed before this carried emoji, against the rule
    const src = fs.readFileSync(path.join(__dirname, 'og', 'templates.js'), 'utf8')
      + fs.readFileSync(path.join(__dirname, 'gen-og-images.js'), 'utf8');
    const emoji = src.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu) || [];
    ok(emoji.length === 0, 'no emoji anywhere in the card designs', emoji.slice(0, 6)); }

  console.log('\nevery page in dist is covered');
  { let miss = [];
    (function walk(d, rel) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) { if (e.name === 'assets' || e.name === 'i18n') continue; walk(path.join(d, e.name), rel + '/' + e.name); continue; }
        if (!e.name.endsWith('.html') || /^app(-es)?\.html$/.test(e.name)) continue;
        const h = fs.readFileSync(path.join(d, e.name), 'utf8');
        if (/name="robots" content="[^"]*noindex/.test(h)) continue;
        const img = (h.match(/property="og:image" content="([^"]*)"/) || [])[1] || '';
        if (!/\/assets\/og\/[a-z0-9-]+\.jpg$/.test(img)) miss.push((rel || '') + '/' + e.name);
      }
    })(DIST, '');
    ok(miss.length === 0, 'no indexable page left on the shared site card', miss.slice(0, 8)); }

  console.log('\nog-e2e: pass ' + pass + '  fail ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
