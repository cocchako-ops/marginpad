// Promo cards for the Premium Plus section (2026-09-18).
//
// The owner watched Ask AI call HYPE on the 15-minute and photographed both ends of it on his phone. The photos are
// real but they are phone captures: low resolution, the browser chrome in frame, and the label overlap we only fixed
// hours later. This redraws the SAME event - his exact levels, over the REAL candles pulled from our own klines API
// for that window - as a compact card that fits a column instead of a full-width screenshot.
//
// Nothing here is invented: entry/stop/targets are the numbers from his screenshots, the candles are the market's.
const { withBrowser, newPage } = require('D:/part1/money-mission/build/e2e-browser.js');
const fs = require('fs');
const OUT = 'D:/part1/money-mission/dist/assets/plus/';

// from the owner's two screenshots, verbatim
const CALL = { sym: 'HYPE', tf: '15m', entry: 81.688, stop: 79.640, tp1: 83.720, tp2: 87.184, atCall: 83.1, atEnd: 86.36 };
const CUT_UTC = Date.UTC(2026, 8, 17, 20, 45) / 1000;   // 22:46 for the owner (UTC+2)
const END_UTC = Date.UTC(2026, 8, 18, 1, 15) / 1000;    // 03:01 the same night

(async () => {
  const r = await fetch('https://marginpad.io/api/v1/klines?symbol=HYPE&interval=15&limit=1000');
  const j = await r.json();
  const all = (j.data && j.data.klines) || j.klines || j.data || j;
  const from = CUT_UTC - 26 * 900;
  const seg = all.filter(b => +b.time >= from && +b.time <= END_UTC + 2 * 900);
  const cut = seg.findIndex(b => +b.time >= CUT_UTC);
  if (seg.length < 20 || cut < 5) { console.log('segment not found: n=' + seg.length + ' cut=' + cut); return; }
  console.log('real candles ' + seg.length + ', cut at index ' + cut + ' (' + new Date(seg[cut].time * 1000).toISOString() + ')');
  console.log('  close at cut ' + seg[cut].close + ' -> last ' + seg[seg.length - 1].close + ', high after ' + Math.max(...seg.slice(cut).map(b => +b.high)));

  const page = await (async () => null)();

  await withBrowser(async (browser) => {
    for (const phase of ['call', 'after']) {
      const p = await newPage(browser);
      await p.setViewport({ width: 760, height: 470, deviceScaleFactor: 3 });
      const bars = phase === 'call' ? seg.slice(0, cut + 1) : seg;
      const html = card(phase, bars, seg);
      await p.setContent(html, { waitUntil: 'load' });
      await new Promise(s => setTimeout(s, 700));
      const el = await p.$('#card');
      await p.screenshot({ path: OUT + 'hype-' + phase + '.jpg', clip: await el.boundingBox(), type: 'jpeg', quality: 92 });
      console.log('  hype-' + phase + '.jpg  ' + Math.round(fs.statSync(OUT + 'hype-' + phase + '.jpg').size / 1024) + ' KB');
      await p.close().catch(() => {});
    }
  }, { timeoutMs: 180000 });

  function card(phase, bars, full) {
    const W = 712, H = 300, PADL = 10, PADR = 78;
    const lo = Math.min(...full.map(b => +b.low), CALL.stop) * 0.998;
    const hi = Math.max(...full.map(b => +b.high), CALL.tp2) * 1.006;   // TP2 must fit INSIDE the frame - its tag was clipped by the top edge
    const y = (v) => H - ((v - lo) / (hi - lo)) * H;
    const step = (W - PADL - PADR) / full.length;
    const bw = Math.max(2.4, step * 0.62);
    const candles = bars.map((b, i) => {
      const x = PADL + i * step + step / 2;
      const up = +b.close >= +b.open;
      const c = up ? '#2ebd85' : '#ff5a4d';
      const yo = y(+b.open), yc = y(+b.close);
      return '<line x1="' + x.toFixed(1) + '" y1="' + y(+b.high).toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + y(+b.low).toFixed(1) + '" stroke="' + c + '" stroke-width="1"/>'
        + '<rect x="' + (x - bw / 2).toFixed(1) + '" y="' + Math.min(yo, yc).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1.4, Math.abs(yc - yo)).toFixed(1) + '" fill="' + c + '"/>';
    }).join('');
    const cutX = PADL + (bars.length - (phase === 'call' ? 0.5 : full.length - bars.length + 0.5)) * step;
    const markX = PADL + (cut + 0.5) * step;
    const lvl = (v, col, txt, dash, done) =>
      '<line x1="' + PADL + '" y1="' + y(v).toFixed(1) + '" x2="' + (W - PADR) + '" y2="' + y(v).toFixed(1) + '" stroke="' + col + '" stroke-width="1" ' + (dash ? 'stroke-dasharray="4 4" ' : '') + 'opacity=".9"/>'
      + '<rect x="' + (W - PADR + 3) + '" y="' + (y(v) - 8.5).toFixed(1) + '" width="70" height="17" rx="4" fill="' + col + '" opacity="' + (done ? '1' : '.16') + '"/>'
      + '<text x="' + (W - PADR + 8) + '" y="' + (y(v) + 4).toFixed(1) + '" font-family="Space Mono,monospace" font-size="10.5" fill="' + (done ? '#06140d' : col) + '" font-weight="700">' + txt + '</text>';
    const zone = '<rect x="' + PADL + '" y="' + y(CALL.tp2).toFixed(1) + '" width="' + (W - PADL - PADR) + '" height="' + (y(CALL.entry) - y(CALL.tp2)).toFixed(1) + '" fill="#2ebd85" opacity=".05"/>'
      + '<rect x="' + PADL + '" y="' + y(CALL.entry).toFixed(1) + '" width="' + (W - PADL - PADR) + '" height="' + (y(CALL.stop) - y(CALL.entry)).toFixed(1) + '" fill="#ff5a4d" opacity=".06"/>';
    const hitTp1 = phase === 'after';
    const levels = zone
      + lvl(CALL.tp2, '#2ebd85', 'TP2 ' + CALL.tp2.toFixed(2), true, false)
      + lvl(CALL.tp1, '#2ebd85', 'TP1 ' + CALL.tp1.toFixed(2), false, hitTp1)
      + lvl(CALL.entry, '#3fd8e6', 'ENTRY ' + CALL.entry.toFixed(2), false, false)
      + lvl(CALL.stop, '#ff5a4d', 'STOP ' + CALL.stop.toFixed(2), false, false);
    const cutLine = '<line x1="' + markX.toFixed(1) + '" y1="0" x2="' + markX.toFixed(1) + '" y2="' + H + '" stroke="#5b6c84" stroke-width="1" stroke-dasharray="3 4"/>'
      + '<text x="' + (markX + 5).toFixed(1) + '" y="14" font-family="Space Mono,monospace" font-size="9.5" fill="#8fa3c4">the call</text>';
    const nowTag = (function(){
      if (phase !== 'after') return '';
      const pv = CALL.atEnd; let ty = y(pv);
      if (Math.abs(ty - y(CALL.tp2)) < 19) ty = y(CALL.tp2) + 19;   // never collide with the TP2 badge
      return '<rect x="' + (W - PADR + 3) + '" y="' + (ty - 8.5).toFixed(1) + '" width="70" height="17" rx="4" fill="#c2f64a"/>'
        + '<text x="' + (W - PADR + 8) + '" y="' + (ty + 4).toFixed(1) + '" font-family="Space Mono,monospace" font-size="10.5" font-weight="700" fill="#0a0b0d">' + pv.toFixed(2) + '</text>';
    })();
    const head = phase === 'call'
      ? { t: 'The call', s: '17 Sep, 22:46', k: 'HYPE / USDT &middot; 15m', badge: 'AI SETUP', bc: '#3fd8e6' }
      : { t: 'Four hours later', s: '18 Sep, 03:01', k: 'HYPE / USDT &middot; 15m', badge: 'TP1 REACHED', bc: '#2ebd85' };
    const foot = phase === 'call'
      ? '<span><i>Entry</i>81.688</span><span><i>Stop</i>79.640</span><span><i>Target 1</i>83.720</span><span><i>Target 2</i>87.184</span>'
      : '<span><i>Price</i>86.36</span><span class="g"><i>Target 1</i>cleared</span><span><i>Stop</i>never touched</span><span><i>Move</i>+3.9%</span>';
    return '<!doctype html><meta charset="utf-8"><style>'
      + '@import url("https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Familjen+Grotesk:wght@400;600;700&display=swap");'
      + 'html,body{margin:0;background:#07080a}'
      + '#card{width:760px;box-sizing:border-box;padding:18px 20px 16px;background:linear-gradient(180deg,#0e1218,#0a0c10);border:1px solid #1c2230;border-radius:16px;font-family:"Familjen Grotesk",system-ui,sans-serif;color:#e9e7df}'
      + '.hd{display:flex;align-items:baseline;gap:10px;margin:0 0 3px}'
      + '.hd h4{margin:0;font-size:19px;font-weight:700;letter-spacing:-.2px}'
      + '.hd time{font-family:"Space Mono",monospace;font-size:11.5px;color:#8fa3c4}'
      + '.hd .bg{margin-left:auto;font-family:"Space Mono",monospace;font-size:9.5px;font-weight:700;letter-spacing:.09em;padding:3px 9px;border-radius:999px;border:1px solid ' + head.bc + ';color:' + head.bc + '}'
      + '.kk{font-family:"Space Mono",monospace;font-size:11px;color:#8fa3c4;margin:0 0 10px}'
      + '.ft{display:flex;gap:18px;margin-top:11px;flex-wrap:wrap}'
      + '.ft span{font-family:"Space Mono",monospace;font-size:12.5px;font-weight:700;color:#e9e7df}'
      + '.ft span.g{color:#2ebd85}.ft i{display:block;font-style:normal;font-family:"Familjen Grotesk",sans-serif;font-size:10px;font-weight:400;letter-spacing:.05em;text-transform:uppercase;color:#6b7c93;margin-bottom:2px}'
      + '.mp{margin-top:12px;font-family:"Space Mono",monospace;font-size:9.5px;color:#4d5a6d;letter-spacing:.06em}'
      + '</style><div id="card">'
      + '<div class="hd"><h4>' + head.t + '</h4><time>' + head.s + '</time><span class="bg">' + head.badge + '</span></div>'
      + '<div class="kk">' + head.k + '</div>'
      + '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + levels + candles + cutLine + nowTag + '</svg>'
      + '<div class="ft">' + foot + '</div>'
      + '<div class="mp">MARGINPAD &middot; ASK AI ON THE CHARTS</div>'
      + '</div>';
  }
})().catch(e => { console.error('fatal', e.message); process.exitCode = 1; });
