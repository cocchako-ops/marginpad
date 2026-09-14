/* Share-card designs, one per page family (2026-09-14).
 *
 * Owner: "jel mozemo za svaki link da napravimo drugaciju i cool stranicu, ali stvarno da se potrudis
 * za svaku da izgleda dobro i da mami klik jer je to poenta."
 *
 * Measured before starting: 856 pages, and 758 of them shared one image. A preview that shows the same
 * logo for a blog post, a calculator and a live data feed tells the person receiving the link nothing,
 * so it is worth nothing. What makes a preview get clicked is the page's OWN headline at size, plus one
 * concrete thing only that page has.
 *
 * Every card is 1200x630, brand fonts embedded as base64 (the renderer has no network), dark ground,
 * and NO EMOJI ANYWHERE - the five cards that existed before this carried them, against the house rule.
 * Each family gets its own shape and accent so a reader can tell a guide from a live feed at a glance.
 *
 * A template is (data) => html. `data` comes from the page itself: title, description, symbol, numbers.
 */

const ACCENT = {
  lime: '#c2f64a', green: '#2ebd85', red: '#ff5a4d', gold: '#f0b90b',
  blue: '#5aa9ff', violet: '#a78bfa', cyan: '#4fd1c5', orange: '#ff9f43', pink: '#f472b6',
};

const esc = s => String(s == null ? '' : s).replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));

/* Long words break a big headline out of its box. Trim on a word boundary and keep the meaning. */
function clip(s, n) {
  s = String(s || '').trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const sp = cut.lastIndexOf(' ');
  return (sp > n * 0.45 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–—-]+$/, '') + '…';
}

/* Headline size follows the headline: one scale for every title makes short ones look lost and long
   ones overflow. Measured against the 1200px card, not guessed. */
function fit(s, max = 92, min = 44, ideal = 30) {
  const n = String(s || '').length;
  if (n <= ideal) return max;
  const v = max - (n - ideal) * ((max - min) / 46);
  return Math.max(min, Math.round(v));
}

function shell(inner, opts) {
  opts = opts || {};
  const a = opts.accent || ACCENT.lime;
  const glow = opts.glow === false ? '' :
    `<div class="glow" style="background:radial-gradient(circle,${a}1f,transparent 64%)"></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#0a0b0d;color:#e8eaed;
  font-family:'Bricolage Grotesque',system-ui,sans-serif;-webkit-font-smoothing:antialiased;position:relative}
.glow{position:absolute;width:900px;height:900px;border-radius:50%;top:-380px;right:-260px;pointer-events:none}
.card{position:absolute;inset:0;padding:66px 76px;display:flex;flex-direction:column;justify-content:space-between}
.logo{font-family:'Space Mono',monospace;font-size:26px;font-weight:700;letter-spacing:2.4px;color:#e8eaed;z-index:2}
.logo b{color:${a}}
.eyebrow{display:inline-flex;align-items:center;gap:12px;font-family:'Space Mono',monospace;font-size:20px;font-weight:700;
  letter-spacing:3.4px;text-transform:uppercase;color:${a}}
.eyebrow .dot{width:11px;height:11px;border-radius:50%;background:${a};display:block}
.h{font-weight:800;letter-spacing:-2.4px;line-height:1.02;color:#fff}
.sub{font-family:'Space Mono',monospace;font-size:26px;line-height:1.45;color:#98a1ad;margin-top:22px;max-width:900px}
.foot{display:flex;align-items:center;gap:16px;font-family:'Space Mono',monospace;font-size:23px;color:#6b7480;z-index:2}
.foot .bar{height:8px;width:96px;border-radius:5px;background:${a}}
.foot .site{color:#98a1ad}
.tag{font-family:'Space Mono',monospace;font-size:19px;font-weight:700;letter-spacing:1.6px;padding:7px 15px;border-radius:9px;
  background:${a}22;color:${a};border:1px solid ${a}55}
.mono{font-family:'Space Mono',monospace}
${opts.css || ''}
</style></head><body>${glow}<div class="card">${inner}</div></body></html>`;
}

let FONTS = '';
function setFonts(f) { FONTS = f; }

/* ── the families ──────────────────────────────────────────────────────────────────────────────── */
const T = {};

/* The site itself: what it is, in one line, with the toolkit spelled out. */
T.home = d => shell(`
  <div class="logo">MARGIN<b>PAD</b></div>
  <div>
    <div class="eyebrow"><span class="dot"></span>Free crypto futures toolkit</div>
    <div class="h" style="font-size:88px;margin-top:26px;max-width:1010px">${esc(d.title || 'Trade futures without risking a cent')}</div>
    <div class="grid">
      ${(d.items || ['Paper trading', 'Live liquidations', 'Multi-chart', 'Screener', 'Whale tracker', 'Heatmap'])
    .map(x => `<span class="chip">${esc(x)}</span>`).join('')}
    </div>
  </div>
  <div class="foot"><span class="bar"></span><span class="site">marginpad.io</span><span class="tag">NO SIGNUP</span></div>`,
{ accent: ACCENT.lime, css: `
  .grid{display:flex;flex-wrap:wrap;gap:12px;margin-top:34px;max-width:1010px}
  .chip{font-family:'Space Mono',monospace;font-size:22px;color:#c9d1db;border:1px solid #2a2f37;background:#14171c;border-radius:11px;padding:10px 18px}` });

/* A live data feed. The number IS the hook, so it is the biggest thing on the card. */
T.live = d => shell(`
  <div class="logo">MARGIN<b>PAD</b></div>
  <div>
    <div class="eyebrow"><span class="dot"></span>${esc(d.eyebrow || 'Live data')}</div>
    <div class="h" style="font-size:${fit(d.title, 80, 46, 26)}px;margin-top:22px;max-width:1010px">${esc(clip(d.title, 74))}</div>
    ${d.stats && d.stats.length ? `<div class="stats">${d.stats.map(s => `
      <div class="st"><div class="k">${esc(s.k)}</div><div class="v" style="color:${s.c || '#fff'}">${esc(s.v)}</div></div>`).join('')}</div>`
    : `<div class="sub">${esc(clip(d.sub, 110))}</div>`}
  </div>
  <div class="foot"><span class="bar"></span><span class="site">marginpad.io${d.path ? esc(d.path) : ''}</span><span class="tag">UPDATES LIVE</span></div>`,
{ accent: d.accent || ACCENT.green, css: `
  .stats{display:flex;gap:16px;margin-top:36px}
  .st{flex:1;background:#101317;border:1px solid #23272e;border-radius:16px;padding:20px 22px;min-width:0}
  .st .k{font-family:'Space Mono',monospace;font-size:17px;letter-spacing:2px;color:#6b7480;text-transform:uppercase}
  .st .v{font-family:'Space Mono',monospace;font-size:40px;font-weight:700;margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}` });

/* One coin. The ticker is the identity, so it is set as a monogram behind the headline. */
T.coin = d => shell(`
  <div class="logo">MARGIN<b>PAD</b></div>
  <div class="ghost mono">${esc(d.sym || 'BTC')}</div>
  <div>
    <div class="eyebrow"><span class="dot"></span>${esc(d.eyebrow || 'Perpetual futures')}</div>
    <div class="row">
      <div class="badge mono">${esc(d.sym || 'BTC')}</div>
      <div class="h" style="font-size:${fit(d.title, 72, 44, 22)}px;max-width:760px">${esc(clip(d.title, 62))}</div>
    </div>
    <div class="sub" style="max-width:840px">${esc(clip(d.sub, 120))}</div>
  </div>
  <div class="foot"><span class="bar"></span><span class="site">marginpad.io/coin/${esc(String(d.sym || '').toLowerCase())}/</span><span class="tag">UPDATED EVERY MINUTE</span></div>`,
{ accent: d.accent || ACCENT.gold, css: `
  /* the monogram is a watermark, so it has to READ: sized to sit inside the card, not clipped mid-letter */
  .ghost{position:absolute;right:52px;bottom:-40px;font-size:220px;font-weight:700;color:#ffffff08;letter-spacing:-8px;z-index:0;line-height:1}
  .row{display:flex;align-items:center;gap:26px;margin-top:24px}
  .badge{font-size:46px;font-weight:700;letter-spacing:1px;padding:14px 26px;border-radius:18px;
    background:${(d.accent || ACCENT.gold)}1c;border:2px solid ${(d.accent || ACCENT.gold)}66;color:${d.accent || ACCENT.gold};flex:0 0 auto}` });

/* A calculator: show the inputs it takes, because that is what tells you it does your job. */
T.calc = d => shell(`
  <div class="logo">MARGIN<b>PAD</b></div>
  <div>
    <div class="eyebrow"><span class="dot"></span>${esc(d.eyebrow || 'Free calculator')}</div>
    <div class="h" style="font-size:${fit(d.title, 78, 44, 26)}px;margin-top:22px;max-width:1010px">${esc(clip(d.title, 72))}</div>
    <div class="fields">${(d.fields || ['Entry', 'Leverage', 'Size']).map((f, i) => `
      <div class="f"><div class="fk">${esc(f)}</div><div class="fv mono">${esc((d.vals || ['—', '—', '—'])[i] || '—')}</div></div>`).join('')}
      <div class="eq mono">=</div>
      <div class="f out"><div class="fk">${esc(d.outK || 'Result')}</div><div class="fv mono">${esc(d.outV || '—')}</div></div>
    </div>
  </div>
  <div class="foot"><span class="bar"></span><span class="site">marginpad.io</span><span class="tag">INSTANT &middot; NO SIGNUP</span></div>`,
{ accent: d.accent || ACCENT.cyan, css: `
  .fields{display:flex;align-items:flex-end;gap:14px;margin-top:38px;flex-wrap:nowrap}
  .f{background:#101317;border:1px solid #23272e;border-radius:14px;padding:16px 20px;min-width:0}
  .f.out{border-color:${(d.accent || ACCENT.cyan)}66;background:${(d.accent || ACCENT.cyan)}14}
  .fk{font-family:'Space Mono',monospace;font-size:16px;letter-spacing:1.8px;color:#6b7480;text-transform:uppercase}
  .fv{font-size:33px;font-weight:700;color:#e8eaed;margin-top:6px;white-space:nowrap}
  .f.out .fv{color:${d.accent || ACCENT.cyan}}
  .eq{font-size:36px;color:#4a525c;padding-bottom:18px}` });

/* Editorial. The headline carries it; the eyebrow says what kind of read it is. */
T.article = d => shell(`
  <div class="top"><div class="logo">MARGIN<b>PAD</b></div><div class="kind mono">${esc(d.kind || 'GUIDE')}</div></div>
  <div>
    <div class="rule"></div>
    <div class="h" style="font-size:${fit(d.title, 84, 42, 30)}px;max-width:1030px">${esc(clip(d.title, 96))}</div>
    <div class="sub" style="max-width:930px">${esc(clip(d.sub, 104))}</div>
  </div>
  <div class="foot"><span class="bar"></span><span class="site">marginpad.io${esc(d.path || '/blog/')}</span>${d.mins ? `<span class="tag">${esc(d.mins)}</span>` : ''}</div>`,
{ accent: d.accent || ACCENT.lime, css: `
  .top{display:flex;align-items:center;justify-content:space-between;z-index:2}
  .kind{font-size:19px;font-weight:700;letter-spacing:3.4px;color:${d.accent || ACCENT.lime};
    border:1px solid ${(d.accent || ACCENT.lime)}55;background:${(d.accent || ACCENT.lime)}18;padding:8px 17px;border-radius:9px}
  .rule{width:112px;height:7px;border-radius:4px;background:${d.accent || ACCENT.lime};margin-bottom:30px}` });

/* Two things weighed against each other. The split IS the design. */
T.versus = d => shell(`
  <div class="logo">MARGIN<b>PAD</b></div>
  <div>
    <div class="eyebrow"><span class="dot"></span>${esc(d.eyebrow || 'Side by side')}</div>
    <div class="vs">
      <div class="side"><div class="nm">${esc(d.a || 'A')}</div><div class="nt mono">${esc(d.aNote || '')}</div></div>
      <div class="mid mono">VS</div>
      <div class="side r"><div class="nm">${esc(d.b || 'B')}</div><div class="nt mono">${esc(d.bNote || '')}</div></div>
    </div>
    <div class="sub" style="text-align:center;max-width:100%">${esc(clip(d.sub, 112))}</div>
  </div>
  <div class="foot"><span class="bar"></span><span class="site">marginpad.io</span><span class="tag">FEES &middot; LEVERAGE &middot; LIQUIDITY</span></div>`,
{ accent: d.accent || ACCENT.violet, css: `
  .vs{display:flex;align-items:center;gap:30px;margin:30px 0 4px}
  .side{flex:1;background:#101317;border:1px solid #23272e;border-radius:20px;padding:28px 30px;min-width:0}
  .side.r{border-color:${(d.accent || ACCENT.violet)}55;background:${(d.accent || ACCENT.violet)}12}
  .nm{font-size:${fit((d.a || '') + (d.b || ''), 56, 34, 14)}px;font-weight:800;letter-spacing:-1.2px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .nt{font-size:20px;color:#6b7480;margin-top:8px}
  .mid{font-size:34px;font-weight:700;color:${d.accent || ACCENT.violet};letter-spacing:2px;flex:0 0 auto}` });

/* A product surface of ours: the thing you get, said plainly, with what it includes. */
T.product = d => shell(`
  <div class="logo">MARGIN<b>PAD</b></div>
  <div>
    <div class="eyebrow"><span class="dot"></span>${esc(d.eyebrow || 'Free, no signup')}</div>
    <div class="h" style="font-size:${fit(d.title, 84, 46, 26)}px;margin-top:22px;max-width:1010px">${esc(clip(d.title, 70))}</div>
    <div class="sub" style="max-width:920px">${esc(clip(d.sub, 118))}</div>
    ${d.points && d.points.length ? `<div class="pts">${d.points.map(x => `<span class="p mono">${esc(x)}</span>`).join('')}</div>` : ''}
  </div>
  <div class="foot"><span class="bar"></span><span class="site">marginpad.io${esc(d.path || '')}</span>${d.tag ? `<span class="tag">${esc(d.tag)}</span>` : ''}</div>`,
{ accent: d.accent || ACCENT.lime, css: `
  .pts{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px;max-width:1010px}
  .p{font-size:21px;color:#c9d1db;border:1px solid #2a2f37;background:#14171c;border-radius:11px;padding:10px 17px}` });

/* One question, answered. The question is the headline and the answer is the number under it. */
T.ask = d => shell(`
  <div class="logo">MARGIN<b>PAD</b></div>
  <div>
    <div class="q">${esc(clip(d.title, 78))}</div>
    <div class="a mono" style="color:${d.accent || ACCENT.lime}">${esc(clip(d.answer || 'Live answer', 40))}</div>
    <div class="sub" style="max-width:930px">${esc(clip(d.sub, 118))}</div>
  </div>
  <div class="foot"><span class="bar"></span><span class="site">marginpad.io${esc(d.path || '')}</span><span class="tag">MEASURED, NOT ESTIMATED</span></div>`,
{ accent: d.accent || ACCENT.orange, css: `
  .q{font-size:${fit(d.title, 58, 36, 34)}px;font-weight:700;letter-spacing:-1.2px;color:#98a1ad;line-height:1.14;max-width:1000px}
  .a{font-size:82px;font-weight:700;letter-spacing:-2px;margin-top:18px;line-height:1.06;max-width:1030px}` });

/* The competition. The prize and the free entry are the hook, so they are the card. */
T.competition = d => shell(`
  <div class="logo">MARGIN<b>PAD</b></div>
  <div>
    <div class="eyebrow"><span class="dot"></span>Running now &middot; join any day</div>
    <div class="h" style="font-size:74px;margin-top:20px;max-width:1010px">${esc(d.title || 'Crypto trading competition')}</div>
    <div class="stats">
      <div class="st big"><div class="k">Prize pool</div><div class="v" style="color:${ACCENT.lime}">${esc(d.pool || '$350')}</div><div class="n mono">every ${esc(d.days || '14')} days</div></div>
      <div class="st"><div class="k">Entry</div><div class="v">Free</div><div class="n mono">no deposit</div></div>
      <div class="st"><div class="k">Boards</div><div class="v">${esc(d.boards || '6')}</div><div class="n mono">top 5 paid on each</div></div>
    </div>
  </div>
  <div class="foot"><span class="bar"></span><span class="site">marginpad.io/trading-competition/</span><span class="tag">SERVER-VERIFIED FILLS</span></div>`,
{ accent: ACCENT.lime, css: `
  .stats{display:flex;gap:16px;margin-top:34px}
  .st{flex:1;background:#101317;border:1px solid #23272e;border-radius:18px;padding:22px 24px;min-width:0}
  .st.big{border-color:${ACCENT.lime}55;background:${ACCENT.lime}12;flex:1.25}
  .st .k{font-family:'Space Mono',monospace;font-size:17px;letter-spacing:2px;color:#6b7480;text-transform:uppercase}
  .st .v{font-size:52px;font-weight:800;letter-spacing:-1.6px;margin-top:6px;color:#fff;white-space:nowrap}
  .st .n{font-size:18px;color:#6b7480;margin-top:4px}` });

/* A liquidation map: the map itself is the picture, so draw the ladder behind the coin. */
T.map = d => shell(`
  <div class="logo">MARGIN<b>PAD</b></div>
  <div class="ladder">${Array.from({ length: 22 }, (_, i) => {
    const t = i / 21, w = 12 + Math.round(Math.pow(Math.sin(t * Math.PI), 1.5) * 88);
    const up = i > 10;
    return `<div class="rung" style="width:${w}%;background:${up ? ACCENT.green : ACCENT.red};opacity:${(0.10 + 0.5 * Math.pow(Math.sin(t * Math.PI), 2)).toFixed(3)}"></div>`;
  }).join('')}</div>
  <div>
    <div class="eyebrow"><span class="dot"></span>${esc(d.eyebrow || 'Liquidation heatmap')}</div>
    <div class="row">
      <div class="badge mono">${esc(d.sym || 'BTC')}</div>
      <div class="h" style="font-size:${fit(d.title, 66, 40, 22)}px;max-width:720px">${esc(clip(d.title, 58))}</div>
    </div>
    <div class="sub" style="max-width:830px">${esc(clip(d.sub, 118))}</div>
  </div>
  <div class="foot"><span class="bar"></span><span class="site">marginpad.io</span><span class="tag">NINE EXCHANGES &middot; LIVE</span></div>`,
{ accent: d.accent || ACCENT.red, css: `
  .ladder{position:absolute;right:0;top:0;bottom:0;width:360px;display:flex;flex-direction:column;justify-content:center;gap:9px;align-items:flex-end;padding-right:40px;z-index:0;opacity:.85}
  .rung{height:13px;border-radius:7px 0 0 7px}
  .row{display:flex;align-items:center;gap:24px;margin-top:22px;z-index:2;position:relative;max-width:820px}
  .badge{font-size:42px;font-weight:700;padding:12px 24px;border-radius:16px;
    background:${(d.accent || ACCENT.red)}1c;border:2px solid ${(d.accent || ACCENT.red)}66;color:${d.accent || ACCENT.red};flex:0 0 auto}` });

/* A tool route (the app shell): show the thing working, not a description of it. */
T.tool = d => shell(`
  <div class="logo">MARGIN<b>PAD</b></div>
  <div class="chart">
    <svg viewBox="0 0 520 190" preserveAspectRatio="none">
      <path d="${d.spark || 'M0 150 L40 132 L80 140 L120 96 L160 108 L200 70 L240 84 L280 44 L320 58 L360 30 L400 46 L440 18 L480 34 L520 10'}"
        fill="none" stroke="${d.accent || ACCENT.lime}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
  </div>
  <div>
    <div class="eyebrow"><span class="dot"></span>${esc(d.eyebrow || 'Free tool')}</div>
    <div class="h" style="font-size:${fit(d.title, 82, 46, 26)}px;margin-top:22px;max-width:960px">${esc(clip(d.title, 66))}</div>
    <div class="sub" style="max-width:880px">${esc(clip(d.sub, 118))}</div>
  </div>
  <div class="foot"><span class="bar"></span><span class="site">marginpad.io${esc(d.path || '')}</span><span class="tag">${esc(d.tag || 'NO SIGNUP')}</span></div>`,
{ accent: d.accent || ACCENT.lime, css: `
  .chart{position:absolute;right:56px;top:104px;width:520px;height:190px;opacity:.5;z-index:0}
  .chart svg{width:100%;height:100%}` });

module.exports = { T, ACCENT, shell, esc, clip, fit, setFonts };
