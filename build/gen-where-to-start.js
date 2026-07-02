/* /where-to-start/ — a beginner "academy": a guided 12-lesson path from zero knowledge to a first safe paper trade.
   Each lesson = plain explanation + real-life analogy + key takeaways + a 1-question quiz; completing earns XP, levels and
   badges (localStorage, no login). It links out to our real tools/guides at the right moments, tying the whole site together.
   Multilingual: English at /where-to-start/ + 12 translated variants at /<lang>/where-to-start/ (hreflang). Lesson/badge/UI
   text comes from build/data/wts-i18n.js (BUNDLES, via subagent translation); structure (mins/links/answer index) lives here. */
const fs = require('fs');
const path = require('path');
const { BUNDLES } = require('./data/wts-i18n');
const { ADV_TRACKS, GLOSSARY } = require('./data/academy-tracks');
const { FIGS } = require('./data/academy-figures');
const DIST = path.join(__dirname, '..', 'dist');
const GTAG = '';
const LANG_CODES = ['de', 'es', 'pt', 'fr', 'nl', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id'];
const RTL = { ar: 1 };

// Structural metadata (text is overlaid per-language from BUNDLES). All quiz answers are index 0.
const LMETA = [
  { id: 'money', mins: 2 },
  { id: 'crypto', mins: 2 },
  { id: 'bitcoin', mins: 2 },
  { id: 'blockchain', mins: 2 },
  { id: 'wallet', mins: 3, warn: 1 },
  { id: 'tx', mins: 2 },
  { id: 'exchange', mins: 2, link: '/best-crypto-exchange-for-beginners/' },
  { id: 'trading', mins: 3, link: '/guides/long-vs-short-crypto/' },
  { id: 'risk', mins: 4, warn: 1, key: 1, link: '/guides/how-to-calculate-position-size/' },
  { id: 'charts', mins: 3, link: '/charts' },
  { id: 'leverage', mins: 4, warn: 1, link: '/guides/what-is-leverage-in-crypto/' },
  { id: 'first', mins: 3, link: '/paper-trade' },
];
const BMETA = [
  { id: 'explorer', need: 'crypto', icon: '🧭' },
  { id: 'blockchain', need: 'blockchain', icon: '🔗' },
  { id: 'wallet', need: 'wallet', icon: '🔐' },
  { id: 'market', need: 'trading', icon: '📈' },
  { id: 'riskmgr', need: 'risk', icon: '🛡️' },
  { id: 'firsttrade', need: 'first', icon: '🚀' },
];

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inj = v => JSON.stringify(v).replace(/</g, '\\u003c');
const pathLang = (p, lang) => (lang && (p.indexOf('/guides/') === 0 || p === '/best-crypto-exchange-for-beginners/')) ? '/' + lang + p : p;
// Deterministic per-lesson shuffle so the correct answer isn't always option #1. Seeded by the lesson id → SAME order
// across all 13 languages (option arrays stay aligned with the answer index). Stable across builds.
function seededPerm(id, n) {
  let seed = 2166136261; for (let i = 0; i < id.length; i++) { seed ^= id.charCodeAt(i); seed = (seed * 16777619) >>> 0; }
  const arr = []; for (let i = 0; i < n; i++) arr.push(i);
  for (let i = n - 1; i > 0; i--) { seed = (seed * 1103515245 + 12345) >>> 0; const j = seed % (i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}
function shuffleQuiz(id, opts, ans) { const p = seededPerm(id, opts.length); return { o: p.map(oi => opts[oi]), a: p.indexOf(ans) }; }

const CSS = `
:root{--bg:#0a0b0d;--panel:#111419;--panel2:#171b22;--line:#232932;--line2:#2c333d;--ink:#e9e7df;--dim:#9aa3ad;--faint:#5c656f;--lime:#c2f64a;--cyan:#3fd8e6;--up:#2ebd85;--red:#ff6258}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:'Familjen Grotesk',system-ui,sans-serif;font-size:15px;line-height:1.55;-webkit-text-size-adjust:100%}
.wrap{max-width:760px;margin:0 auto;padding:0 18px}
header{display:flex;align-items:center;justify-content:space-between;padding:22px 0 16px}
.brand{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:21px;letter-spacing:-.02em;color:var(--ink);text-decoration:none}.brand b{color:var(--lime)}
.crumb{font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--faint);margin:6px 0 14px}.crumb a{color:var(--faint);text-decoration:none}
h1{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:33px;line-height:1.1;letter-spacing:-.02em;margin:0 0 10px}
.lead{color:var(--dim);font-size:16px;margin:0 0 22px}
.wts-stats{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;background:linear-gradient(180deg,var(--panel),#0d0f12);border:1px solid var(--line2);border-radius:16px;padding:15px 17px;margin-bottom:14px}
.wts-lv{text-align:center;flex-shrink:0}.wts-lv b{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:26px;color:var(--lime);display:block;line-height:1}.wts-lv small{font-family:'Space Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--faint)}
.wts-prog{min-width:0}.wts-prog .pr-top{display:flex;justify-content:space-between;font-family:'Space Mono',monospace;font-size:11px;color:var(--dim);margin-bottom:6px}.wts-prog .pr-top b{color:var(--ink)}
.wts-bar{height:9px;border-radius:6px;background:var(--line);overflow:hidden}.wts-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--cyan),var(--lime));transition:width .5s cubic-bezier(.2,.8,.2,1)}
.wts-streak{text-align:center;flex-shrink:0}.wts-streak b{font-size:18px;display:block;line-height:1}.wts-streak small{font-family:'Space Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint)}
.wts-continue{display:block;width:100%;background:var(--lime);color:#0a0b0d;border:none;border-radius:13px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:16px;padding:15px;cursor:pointer;margin-bottom:18px;box-shadow:0 10px 30px -8px rgba(194,246,74,.5)}
.wts-continue:active{transform:scale(.99)}
.wts-badges{display:flex;gap:9px;overflow-x:auto;scrollbar-width:none;margin:0 0 24px;padding-bottom:2px}.wts-badges::-webkit-scrollbar{display:none}
.wts-badge{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:4px;width:84px;background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:11px 6px;text-align:center;opacity:.4;filter:grayscale(1);transition:.2s}
.wts-badge.got{opacity:1;filter:none;border-color:rgba(194,246,74,.4);box-shadow:0 0 18px -8px rgba(194,246,74,.5)}
.wb-ic{font-size:24px;line-height:1}.wb-n{font-family:'Space Mono',monospace;font-size:9px;line-height:1.2;color:var(--dim)}
.sec-h{font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--faint);margin:0 0 12px}
.wts-road{display:flex;flex-direction:column;gap:9px;margin-bottom:30px}
.wts-card{display:flex;align-items:center;gap:13px;width:100%;text-align:left;background:linear-gradient(180deg,var(--panel),#0d0f12);border:1px solid var(--line);border-radius:14px;padding:13px 15px;cursor:pointer;color:var(--ink);transition:transform .12s,border-color .15s,box-shadow .15s;position:relative}
.wts-card:hover{border-color:rgba(63,216,230,.4);transform:translateY(-1px)}
.wts-card.key{border-color:rgba(255,179,71,.35)}
.wts-card.done{border-color:rgba(46,189,133,.4)}
.wts-card.current::after{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:3px;background:var(--lime)}
.wts-n{flex:0 0 auto;width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-weight:700;font-size:14px;background:var(--line);color:var(--dim)}
.wts-card.done .wts-n{background:rgba(46,189,133,.18);color:var(--up)}
.wts-card.current .wts-n{background:var(--lime);color:#0a0b0d}
.wts-cmid{flex:1;min-width:0}.wts-cmid b{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:15.5px;display:block}.wts-cmid small{color:var(--faint);font-size:12.5px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wts-meta{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:5px}
.wts-mins{font-family:'Space Mono',monospace;font-size:10px;color:var(--faint)}
.wts-state{width:20px;height:20px;border-radius:50%;border:2px solid var(--line2)}
.wts-card.done .wts-state{border-color:var(--up);background:var(--up) url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230a0b0d' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><path d='M5 13l4 4L19 7'/></svg>") no-repeat center/13px}
/* modal */
.wts-modal{position:fixed;inset:0;z-index:120;display:none}
.wts-modal.on{display:block}
.wts-bd{position:absolute;inset:0;background:rgba(0,0,0,.66);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.wts-card2{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:100%;max-width:600px;max-height:92vh;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:linear-gradient(180deg,#14181f,#0c0f13);border:1px solid var(--line2);border-radius:20px 20px 0 0;padding:22px 22px calc(22px + env(safe-area-inset-bottom))}
@media(min-width:620px){.wts-card2{top:50%;bottom:auto;transform:translate(-50%,-50%);border-radius:20px;max-height:88vh}}
.wts-mh{display:flex;align-items:center;gap:11px;margin-bottom:4px}
.wts-mh .mn{flex:0 0 auto;width:30px;height:30px;border-radius:9px;background:var(--lime);color:#0a0b0d;display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-weight:700;font-size:13px}
.wts-mh h2{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:22px;margin:0;flex:1}
.wts-x{flex:0 0 auto;width:32px;height:32px;border-radius:9px;border:1px solid var(--line2);background:rgba(255,255,255,.04);color:var(--dim);font-size:15px;cursor:pointer}
.wts-warn{background:rgba(255,98,88,.1);border:1px solid rgba(255,98,88,.4);border-radius:11px;padding:11px 13px;font-size:13.5px;color:#ffb3ac;margin:14px 0;line-height:1.5}
.wts-warn b{color:#ff8a80}
.wts-body p{font-size:15px;line-height:1.6;color:var(--ink);margin:14px 0}
.wts-analogy{background:var(--panel);border-left:3px solid var(--cyan);border-radius:9px;padding:11px 13px;font-size:14px;color:var(--dim);margin:14px 0;line-height:1.55}
.wts-analogy b{color:var(--cyan);font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:4px}
.wts-key{list-style:none;padding:0;margin:16px 0;display:flex;flex-direction:column;gap:9px}
.wts-key li{position:relative;padding-left:26px;font-size:14.5px;color:var(--ink)}
.wts-key li::before{content:'';position:absolute;left:0;top:6px;width:14px;height:14px;border-radius:4px;background:linear-gradient(135deg,var(--cyan),var(--lime))}
.wts-link{display:inline-flex;align-items:center;gap:7px;background:rgba(63,216,230,.1);border:1px solid rgba(63,216,230,.35);color:var(--cyan);text-decoration:none;border-radius:11px;padding:11px 15px;font-weight:700;font-size:14px;margin:6px 0 4px}
.wts-quiz{background:var(--panel);border:1px solid var(--line2);border-radius:14px;padding:16px;margin:20px 0 6px}
.wts-quiz .qh{font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--faint);margin-bottom:9px}
.wts-quiz .qq{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:16px;margin-bottom:13px}
.wts-opt{display:block;width:100%;text-align:left;background:var(--bg);border:1px solid var(--line2);border-radius:11px;padding:13px 15px;margin-bottom:9px;color:var(--ink);font:inherit;font-size:14.5px;cursor:pointer;transition:.12s}
.wts-opt:hover{border-color:var(--dim)}
.wts-opt.right{border-color:var(--up);background:rgba(46,189,133,.12);color:#7fe7bd}
.wts-opt.wrong{border-color:var(--red);background:rgba(255,98,88,.1);color:#ffaaa3}
.wts-opt:disabled{cursor:default}
.wts-done{display:none;margin-top:14px;text-align:center}
.wts-done.on{display:block}
.wts-done .xp{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:18px;color:var(--lime);margin-bottom:11px}
.wts-next{background:var(--lime);color:#0a0b0d;border:none;border-radius:12px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:15px;padding:13px 22px;cursor:pointer;width:100%}
.foot{border-top:1px solid var(--line);margin-top:10px;padding:22px 0 90px;color:var(--faint);font-size:12px;text-align:center}
.foot a{color:var(--dim);text-decoration:none}
/* tracks */
.trk{margin:0 0 26px}
.trk-head{display:flex;align-items:flex-start;gap:12px;margin:0 0 13px}
.trk-ic{flex:0 0 auto;width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;background:var(--panel2);border:1px solid var(--line2)}
.trk-htxt{flex:1;min-width:0}
.trk-name{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:18px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;line-height:1.2}
.trk-blurb{color:var(--dim);font-size:13px;margin-top:3px;line-height:1.4}
.trk-lvl{font-family:'Space Mono',monospace;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-radius:5px;padding:2px 7px}
.lvl-beginner{background:rgba(46,189,133,.14);color:var(--up);border:1px solid rgba(46,189,133,.4)}
.lvl-core{background:rgba(63,216,230,.13);color:var(--cyan);border:1px solid rgba(63,216,230,.4)}
.lvl-advanced{background:rgba(255,179,71,.13);color:#ffb347;border:1px solid rgba(255,179,71,.4)}
.trk-opt{font-family:'Space Mono',monospace;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);border:1px dashed var(--line2);border-radius:5px;padding:2px 7px}
.trk-pr{flex:0 0 auto;font-family:'Space Mono',monospace;font-size:12px;color:var(--dim);background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:6px 10px;align-self:center}
.trk-pr b{color:var(--lime)}
.trk.tdone .trk-ic{border-color:rgba(46,189,133,.5);box-shadow:0 0 16px -7px rgba(46,189,133,.6)}
.wts-card .wts-cmid small{white-space:normal;line-height:1.35}
/* section heading + example box in modal */
.wts-sh{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:15px;color:var(--ink);margin:18px 0 2px}
.wts-ex{background:rgba(63,216,230,.06);border:1px solid rgba(63,216,230,.25);border-radius:11px;padding:12px 14px;font-size:13.5px;color:var(--dim);margin:14px 0;line-height:1.55}
.wts-ex b{color:var(--cyan);font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:5px}
.wts-ex code,.wts-body code{font-family:'Space Mono',monospace;font-size:12.5px;background:rgba(255,255,255,.06);border-radius:4px;padding:1px 5px;color:var(--ink)}
.wts-body ul{margin:10px 0;padding-left:20px}.wts-body li{margin:5px 0;font-size:14.5px;line-height:1.5}
/* glossary */
.gloss{margin:6px 0 26px}
.gl-search{width:100%;background:var(--panel);border:1px solid var(--line2);border-radius:12px;padding:13px 15px;color:var(--ink);font:inherit;font-size:15px;margin-bottom:14px}
.gl-search:focus{outline:none;border-color:var(--cyan)}
.gl-cat{font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--cyan);margin:16px 0 8px}
.gl-term{background:linear-gradient(180deg,var(--panel),#0d0f12);border:1px solid var(--line);border-radius:11px;padding:11px 14px;margin-bottom:8px}
.gl-term b{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:14.5px;color:var(--ink);display:block;margin-bottom:3px}
.gl-term span{font-size:13px;color:var(--dim);line-height:1.45}
.gl-term code{font-family:'Space Mono',monospace;font-size:12px;background:rgba(255,255,255,.06);border-radius:4px;padding:1px 4px}
.gl-empty{color:var(--faint);font-size:13px;padding:10px 0}
/* intake — ask what the user wants BEFORE any lessons/quizzes */
.wts-intake{margin:8px 0 4px;animation:fadeUp .4s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.intake-h{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:23px;line-height:1.15;margin:4px 0 6px}
.intake-sub{color:var(--dim);font-size:14.5px;margin-bottom:18px;line-height:1.45}
.intake-opts{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.intake-opt{display:flex;align-items:center;gap:13px;width:100%;text-align:left;background:linear-gradient(180deg,var(--panel),#0d0f12);border:1px solid var(--line2);border-radius:14px;padding:15px 16px;cursor:pointer;color:var(--ink);transition:transform .14s,border-color .15s,box-shadow .15s}
.intake-opt:hover,.intake-opt:focus-visible{border-color:var(--lime);transform:translateY(-1px);box-shadow:0 12px 32px -16px rgba(194,246,74,.6);outline:none}
.io-ic{flex:0 0 auto;width:46px;height:46px;border-radius:13px;background:var(--panel2);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;font-size:23px}
.io-t{flex:1;min-width:0}.io-t b{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:15.5px;display:block;line-height:1.25}.io-t small{color:var(--faint);font-size:12.5px;display:block;margin-top:3px;line-height:1.35}
.io-go{flex:0 0 auto;color:var(--faint);font-size:18px}
.intake-skip{display:block;background:none;border:none;color:var(--dim);font:inherit;font-size:13px;text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:8px 4px;margin:0 auto}
/* recommendation banner shown after the user picks a goal */
.wts-rec{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:linear-gradient(180deg,rgba(194,246,74,.11),rgba(194,246,74,.03));border:1px solid rgba(194,246,74,.4);border-radius:14px;padding:14px 16px;margin:0 0 18px}
.rec-txt{flex:1;min-width:150px}.rec-txt b{font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--lime);display:block;margin-bottom:3px}.rec-txt span{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:16px}
.rec-go{background:var(--lime);color:#0a0b0d;border:none;border-radius:10px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:14px;padding:11px 18px;cursor:pointer}
.rec-change{background:none;border:1px solid var(--line2);color:var(--dim);border-radius:10px;font:inherit;font-size:13px;padding:10px 14px;cursor:pointer}
.rec-change:hover{border-color:var(--dim);color:var(--ink)}
.trk-rec .trk-ic{border-color:var(--lime);box-shadow:0 0 20px -6px rgba(194,246,74,.75)}
.trk-rec .trk-name::after{content:'★ for you';font-family:'Space Mono',monospace;font-size:9px;font-weight:700;color:var(--lime);background:rgba(194,246,74,.12);border:1px solid rgba(194,246,74,.4);border-radius:5px;padding:2px 6px;letter-spacing:.03em}
/* lesson diagram */
.wts-fig{background:#0d0f12;border:1px solid var(--line2);border-radius:12px;padding:14px 14px 10px;margin:16px 0}
.wts-fig svg{display:block;width:100%;height:auto}
.wts-fig .cap{font-size:11.5px;color:var(--dim);line-height:1.4;margin-top:9px;text-align:center}
.wts-fig .cap code{font-family:'Space Mono',monospace;font-size:11px;background:rgba(255,255,255,.06);border-radius:3px;padding:0 3px}
/* optional quiz row */
.wts-qrow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px}
.wts-qrow .qh{margin:0}
.wts-skip{flex:0 0 auto;background:none;border:1px solid var(--line2);color:var(--dim);border-radius:9px;font:inherit;font-size:12px;padding:7px 12px;cursor:pointer;white-space:nowrap}
.wts-skip:hover{border-color:var(--up);color:var(--up)}
/* track read-time */
.trk-time{font-family:'Space Mono',monospace;font-size:10px;color:var(--faint);margin-left:7px;font-weight:400}
/* certificate */
.wts-certbtn{display:none;width:100%;background:linear-gradient(180deg,rgba(194,246,74,.16),rgba(194,246,74,.04));border:1px solid rgba(194,246,74,.5);color:var(--lime);border-radius:13px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:15px;padding:13px;cursor:pointer;margin-bottom:18px}
.wts-certbtn.on{display:block}
.wts-cert{text-align:center;border:1.5px solid var(--lime);border-radius:16px;padding:26px 20px;background:radial-gradient(120% 100% at 50% 0,rgba(194,246,74,.1),transparent 70%)}
.cert-seal{font-size:42px;line-height:1;margin-bottom:8px}
.cert-h{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:21px;margin:0 0 4px}
.cert-sub{color:var(--dim);font-size:13px;margin-bottom:16px;line-height:1.4}
.cert-stats{display:flex;justify-content:center;gap:24px;margin-bottom:18px}
.cert-stats div{font-family:'Space Mono',monospace}.cert-stats b{display:block;font-size:20px;color:var(--lime)}.cert-stats small{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint)}
.cert-acts{display:flex;gap:9px;justify-content:center;flex-wrap:wrap}
.cert-share{background:var(--lime);color:#0a0b0d;border:none;border-radius:11px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:14px;padding:12px 20px;cursor:pointer}
.cert-cta{background:rgba(63,216,230,.1);border:1px solid rgba(63,216,230,.4);color:var(--cyan);border-radius:11px;font:inherit;font-weight:700;font-size:14px;padding:12px 18px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
/* missions */
.wts-mis-note{color:var(--faint);font-size:12.5px;margin:-6px 0 12px;line-height:1.45}
.wts-missions{display:flex;flex-direction:column;gap:9px;margin:0 0 26px}
.wts-mis{display:flex;align-items:center;gap:12px;background:linear-gradient(180deg,var(--panel),#0d0f12);border:1px solid var(--line);border-radius:14px;padding:13px 15px}
.wts-mis.done{border-color:rgba(46,189,133,.45)}
.mi-ic{flex:0 0 auto;width:38px;height:38px;border-radius:11px;background:var(--panel2);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;font-size:19px}
.mi-t{flex:1;min-width:0}.mi-t b{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:14.5px;display:block;line-height:1.3}.mi-t small{color:var(--faint);font-size:12px;line-height:1.4;display:block;margin-top:2px}
.mi-go{flex:0 0 auto;background:rgba(194,246,74,.1);border:1px solid rgba(194,246,74,.4);color:var(--lime);text-decoration:none;border-radius:10px;padding:9px 13px;font-weight:700;font-size:12.5px;white-space:nowrap}
.mi-done{flex:0 0 auto;color:var(--up);font-family:'Space Mono',monospace;font-size:11.5px;font-weight:700;white-space:nowrap}
/* interactive widget */
.wts-widget{background:rgba(194,246,74,.05);border:1px solid rgba(194,246,74,.3);border-radius:13px;padding:14px 15px;margin:16px 0}
.ww-h{font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--lime);margin-bottom:10px}
.wts-widget input[type=range]{width:100%;accent-color:var(--lime);height:26px;margin:2px 0 10px}
.ww-out{font-size:14px;line-height:1.6;color:var(--ink)}
.ww-bar{height:8px;border-radius:5px;background:var(--line);overflow:hidden;margin-top:10px}.ww-bar i{display:block;height:100%;border-radius:5px;transition:width .15s}
.ww-cap{font-size:11.5px;color:var(--faint);margin-top:7px}
.ww-row{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:10px}
.ww-row label{flex:1;min-width:96px;font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);display:flex;flex-direction:column;gap:5px}
.ww-row input{background:var(--bg);border:1px solid var(--line2);border-radius:9px;padding:10px 11px;color:var(--ink);font:inherit;font-size:16px;width:100%}
.ww-seg{display:flex;gap:8px;margin-bottom:10px}
.ww-seg button{flex:1;background:var(--bg);border:1px solid var(--line2);border-radius:10px;padding:11px 0;color:var(--dim);font:inherit;font-weight:700;font-size:13px;cursor:pointer}
.ww-seg button.on{border-color:var(--lime);color:var(--lime);background:rgba(194,246,74,.08)}
.wts-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(14px);background:#11151b;border:1px solid rgba(194,246,74,.5);color:var(--ink);font-size:13.5px;font-weight:600;padding:12px 18px;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.6);z-index:200;opacity:0;transition:.3s;max-width:92vw}
.wts-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
@media(max-width:560px){h1{font-size:27px}.wts-stats{grid-template-columns:auto 1fr;gap:11px}.wts-streak{display:none}}
`;

// Normalize a Basics lesson (translated, from BUNDLES) into the common modal shape.
function basicsLessons(B, lang, U) {
  return LMETA.map(m => {
    const tr = B.lessons[m.id];
    return {
      id: m.id, track: 'basics', t: tr.t, mins: m.mins, warn: tr.warn || '', sum: tr.intro, fig: FIGS[m.id] || '',
      sections: [{ p: tr.intro, raw: false }, { h: U.analogyLabel, p: tr.analogy, raw: false, k: 'analogy' }],
      key: tr.points, ex: '',
      link: m.link ? { href: pathLang(m.link, lang), label: tr.linkLabel } : null,
      quiz: (sh => ({ q: tr.quiz.q, o: sh.o, a: sh.a }))(shuffleQuiz('q:' + m.id, tr.quiz.o, 0))
    };
  });
}
// Normalize an advanced-track lesson (English) into the common shape.
function advLessons(track, lang) {
  return track.lessons.map(l => ({
    id: track.id + ':' + l.id, track: track.id, t: l.t, mins: l.mins, warn: '', sum: l.sum, fig: FIGS[l.id] || '',
    sections: (l.body || []).map(b => ({ h: b.h || '', p: b.p, raw: true })),
    key: l.key || [], ex: l.ex || '',
    link: l.link ? { href: pathLang(l.link.href, lang), label: l.link.label } : null,
    quiz: (sh => ({ q: l.quiz.q, o: sh.o, a: sh.a }))(shuffleQuiz('q:' + track.id + ':' + l.id, l.quiz.o, l.quiz.a))
  }));
}

function buildPage(lang) {
  const B = BUNDLES[lang || 'en'], U = B.ui, code = lang || 'en';
  const home = lang ? `/${lang}/` : '/';
  const url = `https://marginpad.io/${lang ? lang + '/' : ''}where-to-start/`;

  // English labels for the new (advanced) sections — translation is a documented follow-up.
  const X = {
    basicsName: 'Crypto Basics', basicsBlurb: 'Zero to your first paper trade — money, wallets, exchanges and how trading works.',
    optional: 'Optional', tracksH: 'Learning tracks',
    levelWord: { beginner: 'Beginner', core: 'Core', advanced: 'Advanced' },
    glossaryH: 'Glossary — every term explained', glossarySearch: 'Search terms (e.g. leverage, RSI, funding)…',
    noMatch: 'No terms match your search.', exampleLabel: 'Example',
    intakeH: 'What do you want to learn?', intakeSub: "Tell us where you're at and we'll point you to the right place. No test — just pick one.",
    intakeSkip: 'Just let me browse everything', recFor: 'Recommended for you', recAll: 'Browse all tracks',
    recAllSub: 'Start with the basics or jump straight to any topic below.', startTrack: 'Start track →', changeGoal: 'Change',
    quizOptional: 'Quick check', markRead: 'Mark as read ✓',
    certBtn: '🎓 View your certificate', certH: 'Trading Academy — Complete', certSub: "You finished every lesson. You've built the foundation — now go practice it risk-free.",
    certShare: 'Share', certCta: 'Practice on Paper Trade →', certCopied: 'Link copied ✓',
    certShareText: 'I just completed the MarginPad Trading Academy 🎓 — every lesson on crypto futures: leverage, indicators & risk. Learn it free at https://marginpad.io/where-to-start/'
  };
  // First-run intake options → recommended track (no quiz; just understand intent)
  const intakeOpts = [
    { g: 'basics', ic: '🌱', t: "I'm completely new to crypto", s: 'Start from money, wallets and exchanges' },
    { g: 'fundamentals', ic: '📊', t: 'I know crypto — teach me trading', s: 'Leverage, margin, liquidation, orders, funding' },
    { g: 'indicators', ic: '📈', t: 'I want to read charts & indicators', s: 'Candles, RSI, MACD, Bollinger and more' },
    { g: 'risk', ic: '🛡️', t: 'I want to manage risk & psychology', s: 'Sizing, stops, risk of ruin, the mental game' },
    { g: 'all', ic: '🧭', t: "Not sure — show me everything", s: 'Browse all tracks and the glossary' }
  ];

  // Practice missions — "go do it on the REAL site". The academy auto-detects completion from the site's own
  // localStorage state (journal, watchlist, calculator use) when the user returns, awards XP and checks it off.
  const MISSIONS = [
    { id: 'm_watch', lesson: 'crypto', icon: '⭐', xp: 20, t: 'Star a coin you want to follow', s: 'Open Trending on the homepage and tap the ★ on any coin — it pins to the front, just for you.', href: home + '#trending', cta: 'Open Trending', det: 'watch' },
    { id: 'm_calc', lesson: 'leverage', icon: '🧮', xp: 25, t: 'Price a liquidation BEFORE trading', s: 'Set your entry and leverage in the liquidation calculator and see exactly where you would be wiped out.', href: '/calculators?c=liq', cta: 'Open the calculator', det: 'calc' },
    { id: 'm_trade', lesson: 'leverage', icon: '🎯', xp: 40, t: 'Open your first demo trade', s: 'Paper Trade uses the REAL live price with a fake $100 — feel leverage without risking a cent.', href: '/paper-trade', cta: 'Open Paper Trade', det: 'open' },
    { id: 'm_sl', lesson: 'risk', icon: '🛡️', xp: 35, t: 'Protect a position with a stop-loss', s: 'In My Trades tap SL/TP on an open position and set a stop-loss — the #1 habit of traders who survive.', href: '/paper-trade', cta: 'Set a stop-loss', det: 'sl' },
    { id: 'm_close', lesson: 'first', icon: '💰', xp: 30, t: 'Close a trade & book the result', s: 'Close any open demo position — try closing only 50% and watch the rest keep running.', href: '/paper-trade', cta: 'Close a trade', det: 'close' },
  ];

  // Tracks: Basics (translated, optional) + the 3 advanced tracks (English)
  const basicsTrack = { id: 'basics', name: X.basicsName, icon: '🌱', blurb: X.basicsBlurb, level: 'beginner', optional: true, lessons: basicsLessons(B, lang, U) };
  const advTracks = ADV_TRACKS.map(t => ({ id: t.id, name: t.name, icon: t.icon, blurb: t.blurb, level: t.level, lessons: advLessons(t, lang) }));
  const tracks = [basicsTrack, ...advTracks];

  // Flat lesson array (global index order) for the modal + per-track id map
  const ALL = [];
  tracks.forEach(tr => tr.lessons.forEach((l, j) => { l.tn = j + 1; ALL.push(l); }));
  const trackIds = {};
  tracks.forEach(tr => { trackIds[tr.id] = tr.lessons.map(l => l.id); });

  // Badges: 6 basics badges (translated) + 4 track-completion badges (English)
  const badges = BMETA.map(b => ({ id: b.id, icon: b.icon, name: B.badges[b.id], need: b.need })).concat([
    { id: 'b_fund', icon: '📊', name: 'Fundamentals Pro', needAll: trackIds['fundamentals'] },
    { id: 'b_ta', icon: '📈', name: 'Chart Reader', needAll: trackIds['indicators'] },
    { id: 'b_risk', icon: '🛡️', name: 'Risk Master', needAll: trackIds['risk'] },
    { id: 'b_master', icon: '🎓', name: 'Academy Master', needAll: ALL.map(l => l.id) }
  ]);

  const trMap = {}; tracks.forEach(t => { trMap[t.id] = t.icon + ' ' + t.name; });
  const uiJs = { importantPrefix: U.importantPrefix, quizH: U.quizH, nextPrefix: U.nextPrefix, xpNailed: U.xpNailed, xpComplete: U.xpComplete, alreadyComplete: U.alreadyComplete, finishBtn: U.finishBtn, reviewBtn: U.reviewBtn, startBtn: U.startBtn, continueBtn: U.continueBtn, exampleLabel: X.exampleLabel, recFor: X.recFor, recAll: X.recAll, recAllSub: X.recAllSub, startTrack: X.startTrack, changeGoal: X.changeGoal, quizOptional: X.quizOptional, markRead: X.markRead, certBtn: X.certBtn, certH: X.certH, certSub: X.certSub, certShare: X.certShare, certCta: X.certCta, certCopied: X.certCopied, certShareText: X.certShareText, lessonsWord: U.lessonsWord, xpLabel: U.xpLabel, lvlLabel: U.lvlLabel };

  function trackHtml(tr) {
    const cards = tr.lessons.map(l => {
      const gi = ALL.indexOf(l);
      return `<button class="wts-card${l.warn ? ' key' : ''}" data-i="${gi}" type="button">
  <span class="wts-n">${l.tn}</span>
  <span class="wts-cmid"><b>${esc(l.t)}</b><small>${esc(l.sum.slice(0, 112))}</small></span>
  <span class="wts-meta"><span class="wts-mins">${l.mins} ${esc(U.minWord)}</span><span class="wts-state" aria-hidden="true"></span></span>
</button>`;
    }).join('\n');
    const mins = tr.lessons.reduce((a, l) => a + (l.mins || 0), 0);
    return `<div class="trk" data-trk="${tr.id}">
  <div class="trk-head">
    <span class="trk-ic">${tr.icon}</span>
    <div class="trk-htxt"><div class="trk-name">${esc(tr.name)} <span class="trk-lvl lvl-${tr.level}">${esc(X.levelWord[tr.level] || tr.level)}</span>${tr.optional ? `<span class="trk-opt">${esc(X.optional)}</span>` : ''}<span class="trk-time">~${mins} ${esc(U.minWord)}</span></div><div class="trk-blurb">${esc(tr.blurb)}</div></div>
    <div class="trk-pr"><b data-trkn="${tr.id}">0</b>/${tr.lessons.length}</div>
  </div>
  <div class="wts-road">${cards}</div>
</div>`;
  }
  const tracksHtml = tracks.map(trackHtml).join('\n');

  const cats = ['Basics', 'Orders', 'Leverage', 'Indicators', 'Risk', 'Market'];
  const glossHtml = cats.map(cat => {
    const terms = GLOSSARY.filter(g => g.cat === cat);
    if (!terms.length) return '';
    return `<div class="gl-cat" data-cat="${cat}">${cat}</div>` + terms.map(g =>
      `<div class="gl-term" data-s="${esc((g.t + ' ' + g.d).toLowerCase().replace(/<[^>]+>/g, ''))}"><b>${esc(g.t)}</b><span>${g.d}</span></div>`).join('');
  }).join('');

  const badgeRow = badges.map(b => `<div class="wts-badge" data-b="${b.id}"><span class="wb-ic">${b.icon}</span><span class="wb-n">${esc(b.name)}</span></div>`).join('');

  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: basicsTrack.lessons.map(l => ({ '@type': 'Question', name: l.quiz.q, acceptedAnswer: { '@type': 'Answer', text: l.quiz.o[l.quiz.a] + '. ' + l.sum } })) };
  const bcLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: U.crumbHome, item: 'https://marginpad.io' + home },
    { '@type': 'ListItem', position: 2, name: U.crumbWts, item: url }] };

  let hreflang = `<link rel="alternate" hreflang="en" href="https://marginpad.io/where-to-start/">\n`;
  for (const lc of LANG_CODES) hreflang += `<link rel="alternate" hreflang="${lc}" href="https://marginpad.io/${lc}/where-to-start/">\n`;
  hreflang += `<link rel="alternate" hreflang="x-default" href="https://marginpad.io/where-to-start/">`;

  return `<!doctype html>
<html lang="${code}"${RTL[lang] ? ' dir="rtl"' : ''}>
<head>${GTAG}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(U.metaTitle)} | MarginPad</title>
<meta name="description" content="${esc(U.metaDesc)}">
<meta name="keywords" content="${esc(U.keywords)}">
<link rel="canonical" href="${url}">
${hreflang}
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0a0b0d">
<meta property="og:title" content="${esc(U.metaTitle)}">
<meta property="og:description" content="${esc(U.metaDesc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css">
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
<script type="application/ld+json">${JSON.stringify(bcLd)}</script>
<style>${CSS}</style></head>
<body>
<div class="wrap">
  <header><a class="brand" href="${home}">MARGIN<b>PAD</b></a></header>
  <article>
    <div class="crumb"><a href="${home}">${esc(U.crumbHome)}</a> / ${esc(U.crumbWts)}</div>
    <h1>${esc(U.h1)}</h1>
    <p class="lead">${esc(U.lead)}</p>
    <div class="wts-intake" id="wtsIntake" hidden>
      <div class="intake-h">${esc(X.intakeH)}</div>
      <div class="intake-sub">${esc(X.intakeSub)}</div>
      <div class="intake-opts">${intakeOpts.map(o => `<button class="intake-opt" data-goal="${o.g}" type="button"><span class="io-ic">${o.ic}</span><span class="io-t"><b>${esc(o.t)}</b><small>${esc(o.s)}</small></span><span class="io-go">›</span></button>`).join('')}</div>
      <button class="intake-skip" data-goal="all" type="button">${esc(X.intakeSkip)}</button>
    </div>
    <div id="wtsMain">
    <div class="gloss gloss-top">
      <div class="sec-h">${esc(X.glossaryH)}</div>
      <input class="gl-search" id="glSearch" type="text" placeholder="${esc(X.glossarySearch)}" aria-label="Search glossary">
      <div class="gl-list" id="glList" hidden>${glossHtml}</div>
      <div class="gl-empty" id="glEmpty" hidden>${esc(X.noMatch)}</div>
    </div>
    <div class="wts-rec" id="wtsRec" hidden></div>
    <div class="wts-stats">
      <div class="wts-lv"><b id="lvl">1</b><small>${esc(U.lvlLabel)}</small></div>
      <div class="wts-prog"><div class="pr-top"><span><b id="doneN">0</b> / ${ALL.length} ${esc(U.lessonsWord)}</span><span><b id="xp">0</b> ${esc(U.xpLabel)}</span></div><div class="wts-bar"><i id="bar"></i></div></div>
      <div class="wts-streak"><b id="streak">🔥0</b><small>${esc(U.streakLabel)}</small></div>
    </div>
    <button class="wts-continue" id="continue" type="button">${esc(U.startBtn)}</button>
    <button class="wts-certbtn" id="certBtn" type="button">${esc(X.certBtn)}</button>
    <div class="sec-h">${esc(U.badgesH)}</div>
    <div class="wts-badges">${badgeRow}</div>
    <div class="sec-h">Practice missions — on the real site <span id="misN" style="color:var(--lime)"></span></div>
    <div class="wts-mis-note">Each mission opens the real tool. When you come back here it is checked off automatically — and you earn XP.</div>
    <div class="wts-missions" id="wtsMis"></div>
    <div class="sec-h">${esc(X.tracksH)}</div>
    ${tracksHtml}
    </div>
  </article>
  <div class="foot">${esc(U.footText)} <a href="/paper-trade">${esc(U.footLink)}</a></div>
</div>
<div class="wts-modal" id="modal" hidden><div class="wts-bd" data-close></div><div class="wts-card2" id="mcard"></div></div>
<script>
var L=${inj(ALL)},B=${inj(badges)},U=${inj(uiJs)},TR=${inj(trMap)},MIS=${inj(MISSIONS)},N=L.length;
var KEY='mp_academy';
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){return {};}}
function save(s){try{localStorage.setItem(KEY,JSON.stringify(s));}catch(e){}}
var S=load();S.done=S.done||{};S.xp=S.xp||0;S.streak=S.streak||{d:0,last:''};S.miss=S.miss||{};
function doneCount(){var n=0;for(var i=0;i<N;i++)if(S.done[L[i].id])n++;return n;}
function trackCount(tid){var n=0;for(var i=0;i<N;i++)if(L[i].track===tid&&S.done[L[i].id])n++;return n;}
function trackTotal(tid){var n=0;for(var i=0;i<N;i++)if(L[i].track===tid)n++;return n;}
function firstIncomplete(){for(var i=0;i<N;i++)if(!S.done[L[i].id])return i;return N-1;}
function lvl(){return Math.floor(S.xp/250)+1;}
function bumpStreak(){var t=new Date().toISOString().slice(0,10);if(S.streak.last===t)return;var y=new Date(Date.now()-864e5).toISOString().slice(0,10);S.streak.d=(S.streak.last===y)?(S.streak.d+1):1;S.streak.last=t;}
function qs(s){return document.querySelector(s);}
function badgeGot(b){if(b.needAll){for(var i=0;i<b.needAll.length;i++)if(!S.done[b.needAll[i]])return false;return b.needAll.length>0;}return !!S.done[b.need];}
function renderStats(){var dc=doneCount();qs('#doneN').textContent=dc;qs('#xp').textContent=S.xp;qs('#lvl').textContent=lvl();qs('#bar').style.width=Math.round(dc/N*100)+'%';qs('#streak').textContent='🔥'+(S.streak.d||0);
  B.forEach(function(b){var el=document.querySelector('[data-b="'+b.id+'"]');if(el)el.classList.toggle('got',badgeGot(b));});
  var tn=document.querySelectorAll('[data-trkn]');for(var k=0;k<tn.length;k++){var el=tn[k],tid=el.getAttribute('data-trkn'),c=trackCount(tid),tot=trackTotal(tid);el.textContent=c;var trk=el.closest('.trk');if(trk)trk.classList.toggle('tdone',tot>0&&c===tot);}
  var fi=firstIncomplete(),allDone=dc===N;var cb=qs('#continue');cb.textContent=allDone?U.reviewBtn:(dc===0?U.startBtn:U.continueBtn.replace('{n}',(fi+1)));
  var cbt=qs('#certBtn');if(cbt)cbt.classList.toggle('on',allDone);
  document.querySelectorAll('.wts-card').forEach(function(el){var i=+el.getAttribute('data-i');el.classList.toggle('done',!!S.done[L[i].id]);el.classList.toggle('current',!allDone&&i===fi);});
}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
// ---- practice missions: detected from the live site state, so the academy literally walks you through the product ----
function jn(){try{return JSON.parse(localStorage.getItem('mp_journal')||'[]')||[];}catch(e){return [];}}
var MD={
  watch:function(){try{return (JSON.parse(localStorage.getItem('mp_watchlist')||'[]')||[]).length>0;}catch(e){return false;}},
  calc:function(){try{var v=JSON.parse(localStorage.getItem('mp_calc_vals')||'{}');for(var k in v)return true;return false;}catch(e){return false;}},
  open:function(){return jn().length>0;},
  sl:function(){var d=jn();for(var i=0;i<d.length;i++)if(d[i].stop!=null)return true;return false;},
  close:function(){var d=jn();for(var i=0;i<d.length;i++)if(d[i].status==='win'||d[i].status==='loss')return true;return false;}
};
function misCount(){var n=0;for(var i=0;i<MIS.length;i++)if(S.miss[MIS[i].id])n++;return n;}
function misCard(m){var done=!!S.miss[m.id];
  return '<div class="wts-mis'+(done?' done':'')+'" data-mis="'+m.id+'"><span class="mi-ic">'+m.icon+'</span><span class="mi-t"><b>'+esc(m.t)+'</b><small>'+esc(m.s)+'</small></span>'+(done?'<span class="mi-done">✓ +'+m.xp+' XP</span>':'<a class="mi-go" href="'+m.href+'">'+esc(m.cta)+' →</a>')+'</div>';}
function renderMissions(){var el=document.getElementById('wtsMis');if(el)el.innerHTML=MIS.map(misCard).join('');var n=document.getElementById('misN');if(n)n.textContent=misCount()+'/'+MIS.length;}
function toast(t){var d=document.createElement('div');d.className='wts-toast';d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.classList.add('on');},20);setTimeout(function(){d.classList.remove('on');setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d);},350);},3600);}
function checkMissions(){var got=[];for(var i=0;i<MIS.length;i++){var m=MIS[i];if(!S.miss[m.id]&&MD[m.det]&&MD[m.det]()){S.miss[m.id]=1;S.xp+=m.xp;got.push(m);}}
  if(got.length){bumpStreak();save(S);renderMissions();renderStats();got.forEach(function(m,gi){setTimeout(function(){toast('🎉 Mission complete: '+m.t+' (+'+m.xp+' XP)');},gi*950);});}}
document.addEventListener('visibilitychange',function(){if(!document.hidden)checkMissions();});
window.addEventListener('focus',function(){checkMissions();});
// ---- interactive lesson widgets (learn by touching, not just reading) ----
function widgetHtml(id){
  if(id==='leverage')return '<div class="wts-widget" data-w="lev"><div class="ww-h">Try it — drag the leverage</div><input type="range" min="1" max="125" step="1" value="10" class="ww-sl" aria-label="Leverage"><div class="ww-out"></div><div class="ww-bar"><i></i></div><div class="ww-cap">The bar is your survival room — watch it vanish as leverage grows.</div></div>';
  if(id==='risk')return '<div class="wts-widget" data-w="risk"><div class="ww-h">Try it — size a trade like a pro</div><div class="ww-row"><label>Account $<input type="number" inputmode="decimal" class="ww-bal" value="1000"></label><label>Risk %<input type="number" inputmode="decimal" class="ww-rsk" value="1" step="0.5"></label><label>Stop dist. %<input type="number" inputmode="decimal" class="ww-stp" value="5" step="0.5"></label></div><div class="ww-out"></div></div>';
  if(id==='trading')return '<div class="wts-widget" data-w="side"><div class="ww-h">Try it — long vs short</div><div class="ww-seg"><button type="button" class="on" data-s="long">LONG (bet up)</button><button type="button" data-s="short">SHORT (bet down)</button></div><input type="range" min="-10" max="10" step="1" value="3" class="ww-sl" aria-label="Price move %"><div class="ww-out"></div></div>';
  return '';}
function wireWidget(root){var w=root.querySelector('.wts-widget');if(!w)return;var kind=w.getAttribute('data-w');
  if(kind==='lev'){var sl=w.querySelector('.ww-sl'),out=w.querySelector('.ww-out'),bar=w.querySelector('.ww-bar i');
    var upd=function(){var lv=+sl.value,ctrl=100*lv,dist=(1-0.005)/lv*100;var col=dist<3?'#ff6258':(dist<10?'#ffb347':'#2ebd85');out.innerHTML='$100 at <b>'+lv+'×</b> controls <b>$'+ctrl.toLocaleString('en-US')+'</b> — a <b style="color:'+col+'">'+dist.toFixed(dist<10?2:1)+'%</b> move against you = <b style="color:#ff6258">liquidated</b>.';bar.style.width=Math.max(2,Math.min(100,dist*5))+'%';bar.style.background=col;};
    sl.addEventListener('input',upd);upd();}
  if(kind==='risk'){var b=w.querySelector('.ww-bal'),r=w.querySelector('.ww-rsk'),st=w.querySelector('.ww-stp'),out2=w.querySelector('.ww-out');
    var u2=function(){var bal=+b.value||0,rp=+r.value||0,sp=+st.value||0;if(!(bal>0&&rp>0&&sp>0)){out2.textContent='';return;}var riskD=bal*rp/100,size=riskD/(sp/100);out2.innerHTML='You risk <b>$'+riskD.toFixed(0)+'</b> ('+rp+'% of the account). With the stop '+sp+'% away, the right position size is <b style="color:var(--lime)">$'+size.toLocaleString('en-US',{maximumFractionDigits:0})+'</b> — hit the stop and you lose exactly $'+riskD.toFixed(0)+', never more.';};
    b.addEventListener('input',u2);r.addEventListener('input',u2);st.addEventListener('input',u2);u2();}
  if(kind==='side'){var seg=w.querySelectorAll('.ww-seg button'),sl3=w.querySelector('.ww-sl'),out3=w.querySelector('.ww-out'),side='long';
    var u3=function(){var mv=+sl3.value,p=side==='long'?mv:-mv;var col=p>=0?'#2ebd85':'#ff6258';out3.innerHTML='Price moves <b>'+(mv>=0?'+':'')+mv+'%</b> → your '+side.toUpperCase()+' makes <b style="color:'+col+'">'+(p>=0?'+':'−')+'$'+Math.abs(p).toFixed(0)+'</b> on $100 (no leverage). With 10× leverage that becomes <b style="color:'+col+'">'+(p>=0?'+':'−')+'$'+Math.abs(p*10).toFixed(0)+'</b>.';};
    for(var si=0;si<seg.length;si++)(function(btn){btn.addEventListener('click',function(){side=btn.getAttribute('data-s');for(var j2=0;j2<seg.length;j2++)seg[j2].classList.toggle('on',seg[j2]===btn);u3();});})(seg[si]);
    sl3.addEventListener('input',u3);u3();}}
function openLesson(i){var l=L[i],m=qs('#mcard');
  var h='<div class="wts-mh"><span class="mn">'+l.tn+'</span><h2>'+esc(l.t)+'</h2><button class="wts-x" data-close type="button">✕</button></div>';
  if(l.warn)h+='<div class="wts-warn"><b>⚠ '+esc(U.importantPrefix)+'</b> '+esc(l.warn)+'</div>';
  if(l.fig)h+='<div class="wts-fig">'+l.fig+'</div>';
  h+='<div class="wts-body">';
  for(var s=0;s<l.sections.length;s++){var sec=l.sections[s],txt=sec.raw?sec.p:esc(sec.p);
    if(sec.k==='analogy'){h+='<div class="wts-analogy"><b>'+esc(sec.h)+'</b>'+txt+'</div>';}
    else{if(sec.h)h+='<h3 class="wts-sh">'+esc(sec.h)+'</h3>';h+='<p>'+txt+'</p>';}}
  h+='</div>';
  h+='<ul class="wts-key">'+l.key.map(function(p){return '<li>'+esc(p)+'</li>';}).join('')+'</ul>';
  if(l.ex)h+='<div class="wts-ex"><b>'+esc(U.exampleLabel)+'</b>'+l.ex+'</div>';
  h+=widgetHtml(l.id);
  var lm='';for(var mi2=0;mi2<MIS.length;mi2++)if(MIS[mi2].lesson===l.id)lm+=misCard(MIS[mi2]);
  if(lm)h+='<div class="sec-h" style="margin:18px 0 9px">Your mission</div><div class="wts-missions" style="margin-bottom:6px">'+lm+'</div>';
  if(l.link)h+='<a class="wts-link" href="'+l.link.href+'">'+esc(l.link.label)+' →</a>';
  h+='<div class="wts-quiz"><div class="wts-qrow"><div class="qh">'+esc(U.quizOptional)+'</div><button class="wts-skip" id="lskip" type="button">'+esc(U.markRead)+'</button></div><div class="qq">'+esc(l.quiz.q)+'</div><div id="opts">'+l.quiz.o.map(function(o,oi){return '<button class="wts-opt" data-o="'+oi+'" type="button">'+esc(o)+'</button>';}).join('')+'</div></div>';
  h+='<div class="wts-done" id="ld"><div class="xp" id="ldx"></div><button class="wts-next" id="lnext" type="button"></button></div>';
  m.innerHTML=h;qs('#modal').hidden=false;qs('#modal').classList.add('on');document.documentElement.style.overflow='hidden';m.scrollTop=0;
  try{wireWidget(m);}catch(e){}
  var answered=!!S.done[l.id];
  function award(correct){ // correct: true / false (quiz) or null (mark-read) — all complete the lesson
    var fresh=!S.done[l.id];S.done[l.id]=true;var gain=fresh?(correct===true?60:40):0;if(fresh){S.xp+=gain;bumpStreak();save(S);renderStats();}
    var ld=document.getElementById('ld');ld.classList.add('on');document.getElementById('ldx').textContent=fresh?('+'+gain+(correct===true?U.xpNailed:U.xpComplete)):U.alreadyComplete;
    var ni=i+1,nb=document.getElementById('lnext');
    if(ni<N){nb.textContent=U.nextPrefix+L[ni].t+' →';nb.onclick=function(){openLesson(ni);};}
    else{nb.textContent=U.finishBtn;nb.onclick=function(){if(doneCount()>=N){showCertificate();}else{closeModal();location.href='/paper-trade';}};}
    ld.scrollIntoView({behavior:'smooth',block:'nearest'});
    if(fresh&&doneCount()>=N)setTimeout(showCertificate,450); // auto-celebrate when the whole academy is finished
  }
  document.getElementById('opts').addEventListener('click',function(e){var b=e.target.closest('[data-o]');if(!b||answered)return;answered=true;
    var pick=+b.getAttribute('data-o'),correct=l.quiz.a;
    var wrong=pick!==correct;document.querySelectorAll('.wts-opt').forEach(function(x){x.disabled=true;var xi=+x.getAttribute('data-o');if(xi===pick)x.classList.add(wrong?'wrong':'right');else if(wrong&&xi===correct)x.classList.add('right');});
    var sk=document.getElementById('lskip');if(sk)sk.disabled=true;
    award(pick===correct);
  });
  var skip=document.getElementById('lskip');if(skip)skip.addEventListener('click',function(){if(answered)return;answered=true;document.querySelectorAll('.wts-opt').forEach(function(x){x.disabled=true;});skip.disabled=true;award(null);});
}
function showCertificate(){var m=qs('#mcard');var dc=doneCount();
  var h='<div class="wts-cert"><div class="cert-seal">🎓</div><div class="cert-h">'+esc(U.certH)+'</div><div class="cert-sub">'+esc(U.certSub)+'</div>'
    +'<div class="cert-stats"><div><b>'+dc+'</b><small>'+esc(U.lessonsWord)+'</small></div><div><b>'+S.xp+'</b><small>'+esc(U.xpLabel)+'</small></div><div><b>'+lvl()+'</b><small>'+esc(U.lvlLabel)+'</small></div></div>'
    +'<div class="cert-acts"><button class="cert-share" id="certShare" type="button">'+esc(U.certShare)+'</button><a class="cert-cta" href="/paper-trade">'+esc(U.certCta)+'</a></div></div>'
    +'<div class="wts-done on" style="margin-top:16px"><button class="wts-next" id="lnext" type="button">'+esc(U.reviewBtn)+'</button></div>';
  m.innerHTML=h;qs('#modal').hidden=false;qs('#modal').classList.add('on');document.documentElement.style.overflow='hidden';m.scrollTop=0;
  var sh=document.getElementById('certShare');if(sh)sh.addEventListener('click',function(){var txt=U.certShareText;try{if(navigator.share){navigator.share({title:'MarginPad Trading Academy',text:txt});return;}}catch(e){}try{if(navigator.clipboard){navigator.clipboard.writeText(txt).then(function(){sh.textContent=U.certCopied;});}}catch(e){}});
  var rv=document.getElementById('lnext');if(rv)rv.onclick=closeModal;
}
function closeModal(){qs('#modal').classList.remove('on');qs('#modal').hidden=true;document.documentElement.style.overflow='';}
document.addEventListener('click',function(e){var c=e.target.closest&&e.target.closest('.wts-card');if(c)openLesson(+c.getAttribute('data-i'));});
qs('#continue').addEventListener('click',function(){openLesson(firstIncomplete());});
(function(){var cbt=qs('#certBtn');if(cbt)cbt.addEventListener('click',showCertificate);})();
qs('#modal').addEventListener('click',function(e){if(e.target.closest('[data-close]'))closeModal();});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});
(function(){var inp=qs('#glSearch');if(!inp)return;var terms=document.querySelectorAll('.gl-term'),catsEls=document.querySelectorAll('.gl-cat'),empty=qs('#glEmpty'),list=qs('#glList');
  inp.addEventListener('input',function(){var q=inp.value.trim().toLowerCase(),any=false;
    if(list)list.hidden=!q; /* the term list only opens while searching — the academy (missions/lessons) sits right under the box instead of below hundreds of terms */
    if(!q){if(empty)empty.hidden=true;return;}
    for(var i=0;i<terms.length;i++){var show=!q||terms[i].getAttribute('data-s').indexOf(q)>=0;terms[i].style.display=show?'':'none';if(show)any=true;}
    for(var c=0;c<catsEls.length;c++){var sib=catsEls[c].nextElementSibling,vis=false;while(sib&&!sib.classList.contains('gl-cat')){if(sib.classList.contains('gl-term')&&sib.style.display!=='none'){vis=true;break;}sib=sib.nextElementSibling;}catsEls[c].style.display=vis?'':'none';}
    if(empty)empty.hidden=any;});
})();
// Intake / "what do you want?" flow — runs BEFORE any lesson or quiz is shown.
function firstLessonOfTrack(tid){for(var i=0;i<N;i++)if(L[i].track===tid)return i;return 0;}
function renderRec(goal){
  document.querySelectorAll('.trk').forEach(function(t){t.classList.remove('trk-rec');});
  var rec=qs('#wtsRec');if(!rec)return;
  if(goal==='all'||!TR[goal]){rec.innerHTML='<div class="rec-txt"><b>'+esc(U.recAll)+'</b><span>'+esc(U.recAllSub)+'</span></div><button class="rec-change" type="button">'+esc(U.changeGoal)+'</button>';rec.hidden=false;return;}
  var li=firstLessonOfTrack(goal);
  rec.innerHTML='<div class="rec-txt"><b>'+esc(U.recFor)+'</b><span>'+esc(TR[goal])+'</span></div><button class="rec-go" data-li="'+li+'" type="button">'+esc(U.startTrack)+'</button><button class="rec-change" type="button">'+esc(U.changeGoal)+'</button>';
  rec.hidden=false;
  var trkEl=document.querySelector('.trk[data-trk="'+goal+'"]');if(trkEl)trkEl.classList.add('trk-rec');
}
function showIntake(){var iv=qs('#wtsIntake'),mn=qs('#wtsMain');if(iv)iv.hidden=false;if(mn)mn.hidden=true;try{window.scrollTo(0,0);}catch(e){}}
function showMain(){var iv=qs('#wtsIntake'),mn=qs('#wtsMain');if(iv)iv.hidden=true;if(mn)mn.hidden=false;}
function pickGoal(g){S.goal=g;save(S);showMain();renderRec(g);renderStats();if(g!=='all'){var trkEl=document.querySelector('.trk[data-trk="'+g+'"]');if(trkEl)setTimeout(function(){try{trkEl.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){}},90);}}
(function(){var iv=qs('#wtsIntake');if(iv)iv.addEventListener('click',function(e){var o=e.target.closest('[data-goal]');if(o)pickGoal(o.getAttribute('data-goal'));});
  var rec=qs('#wtsRec');if(rec)rec.addEventListener('click',function(e){var go=e.target.closest('.rec-go');if(go){openLesson(+go.getAttribute('data-li'));return;}if(e.target.closest('.rec-change'))showIntake();});})();
if(!S.goal){showIntake();}else{renderRec(S.goal);}
renderStats();renderMissions();checkMissions();
</script>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>`;
}

let n = 0;
// English at /where-to-start/
fs.mkdirSync(path.join(DIST, 'where-to-start'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'where-to-start', 'index.html'), buildPage(''));
n++;
for (const lc of LANG_CODES) {
  const dir = path.join(DIST, lc, 'where-to-start');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), buildPage(lc));
  n++;
}
console.log('wrote ' + n + ' where-to-start pages (en + 12 langs), ' + LMETA.length + ' lessons each');

// sitemap (English URL)
try {
  const sp = path.join(DIST, 'sitemap.xml');
  let xml = fs.readFileSync(sp, 'utf8');
  if (xml.indexOf('/where-to-start/') === -1) {
    const entry = '  <url><loc>https://marginpad.io/where-to-start/</loc><lastmod>2026-06-23</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n';
    xml = xml.replace('</urlset>', entry + '</urlset>');
    fs.writeFileSync(sp, xml);
    console.log('sitemap: +1 where-to-start URL');
  }
} catch (e) { console.log('sitemap update skipped:', e.message); }
