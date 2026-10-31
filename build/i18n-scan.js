/* WHAT A READER REALLY MEETS IN THEIR LANGUAGE (2026-10-31, owner: "ako otvorim advanced tab nista nije prevedeno ... neki prevod je probio forme boxeva na telefonu").
   The static audits read files, so they cannot see a tab, a sheet, a toast or anything a script writes after a click, and that is where the English was hiding.
   This opens the real page in a real browser as a real member at 390px, presses the panels open, and reads every text node, placeholder, title and aria-label, hidden ones too.
   A string is reported when it is a known English string of ours, or reads as English by its function words. It also reports text that breaks its box on a phone.
     node build/i18n-scan.js --lang pt --surface paper [--base https://marginpad.io] [--local] [--out build/data/i18n-scan] [--desk]
     node build/i18n-scan.js --all  runs every language and surface, one child process each (e2e-browser tears down at 240 s)
   Output: build/data/i18n-scan/<lang>-<surface>.json {english:[...], overflow:[...]}. */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LANGS = ['es', 'pt', 'de'], OUT = path.join(R, arg('--out', 'build/data/i18n-scan'));
const BASE = arg('--base', 'https://marginpad.io'), LOCAL = process.argv.includes('--local');
const clk = (sel) => `(function(){var e=document.querySelector(${JSON.stringify(sel)});if(e){e.click();return 1}return 0})()`;
/* Every step is a snippet run in the page; the text is collected after each one, because a panel can replace what the last one showed. */
const S = {
  home: { p: '/', steps: [] },
  paper: { p: '/paper-trade', wait: '#planAdvChk', steps: [clk('#ptAdvBtn') , clk('#ptTfBtn'), clk('#ptSymBtn'), clk('[data-mt="stocks"]'), "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", clk('#ptSetBtn') , clk('.pt2-side [data-side="short"]')] },
  trades: { p: '/paper-trade', wait: '#planAdvChk', steps: [clk('[data-mpbn="trades"]'), clk('[data-jr-filter]'), clk('#jrFilterBtn')] },
  charts: { p: '/charts', steps: [clk('[data-act="ind"]'), clk('[data-act="draw"]'), clk('[data-act="calc"]'), clk('[data-act="sym"]')] },
  account: { p: '/season/', steps: [clk('[data-auth-open]')] },
  browse: { p: '/', steps: [clk('[data-mpbn="browse"]')] },
  chat: { p: '/rekt/', steps: [clk('#chatFab'), clk('.ct-gear')] },
  heatmap: { p: '/heatmap', steps: [] }, screener: { p: '/screener', steps: [clk('.scr-tw tbody tr')] }, calc: { p: '/calculators', steps: [] },
  rekt: { p: '/rekt/', steps: [] }, rewards: { p: '/rewards/', steps: [] }, season: { p: '/season/', steps: [] }, boards: { p: '/leaderboards/', steps: [] }, vault: { p: '/vault/', steps: [] }, spot: { p: '/spot/', steps: [] },
  squads: { p: '/squads/', steps: [] }, community: { p: '/community/', steps: [] }, alerts: { p: '/alerts/', steps: [] }, whales: { p: '/hyperliquid-whales/', steps: [] }, strategies: { p: '/strategies/', steps: [] }, api: { p: '/trading-api/', steps: [] },
  premium: { p: '/premium/', steps: [] }, academy: { p: '/academy/', steps: [] }, levels: { p: '/levels/', steps: [] }, report: { p: '/trading-report/', steps: [] }, status: { p: '/status/', steps: [] }, exchanges: { p: '/exchanges/', steps: [] }, liq: { p: '/liquidations/', steps: [] }, catalysts: { p: '/catalysts/', steps: [] }, calendar: { p: '/calendar/', steps: [] }
};

const EN = /\b(the|your|you|with|this|that|from|have|will|are|for|and|not|what|when|how|all|can|has|was|were|been|into|than|then|them|they|their|there|here|only|just|about|after|before|while|which|would|should|could|more|most|some|each|every|open|close|closed|trade|trades|position|price|sign|free|today|back|next|show|hide|add|remove|set|new|start|stop|loading|save|cancel|search|settings|filter|history|balance|profit|loss|week|day|days)\b/gi;
const STRONG = /\b(the|your|you|with|this|that|from|have|will|are|and|what|when|how|which|would|should)\b/i;
const KEEP = /^(MarginPad|MARGINPAD|Paper Trade|Bybit|Binance|OKX|Bitget|BingX|MEXC|Moon|Fomo|Hyperliquid|Coinbase|Telegram|Instagram|Premium|Ticks|Bitcoin|Ethereum|Solana|BTC|ETH|SOL|XP|API|USDT|USD|long|short|Long|Short|Stop|Stop-Loss|Take Profit|Spot|Gold|Bronze|Silver|Platinum|Diamond|Master|Legendary|Bot|Rekt|Screener|Cloudflare|Layouts?|Watchlist|Volume|Funding|PnL|ROI|PnL \/ ROI|Forex|Slippage|Trailing stop|Take-profit|KuCoin|Gate|Kraken|TradingView|Koinly|3Commas|Blog|Widgets|Chat|Demo Spot|Squads?|MP Shop|DeFi|Trades|Menu|English|Espa\u00f1ol|Portugu\u00eas|Fran\u00e7ais|Deutsch|T\u00fcrk\u00e7e|Indonesia|Nederlands|Srpski|Trader|Trading|Drawdown|Heatmap|Catalysts|Coin|Coins|Long|Short|Margin|Leaderboards|Faucet|OK|Ok)$/;
const BRANDISH = /^\S+ vs \S+$|^\S+ - [\d.]+%$/;
function known() {
  const set = new Set(); const add = (s) => { s = String(s).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); if (s.length >= 3) set.add(s); };
  for (const f of fs.readdirSync(path.join(R, 'dist/assets'))) { if (!/\.js$/.test(f)) continue; const t = fs.readFileSync(path.join(R, 'dist/assets', f), 'utf8'); for (const m of t.matchAll(/__esT_\w+\("\w+",\s*'((?:[^'\\]|\\.)*)'\)/g)) add(m[1].replace(/\\'/g, "'")); }
  try { const c = JSON.parse(fs.readFileSync(path.join(R, 'build/data/es/catalog.json'), 'utf8')).items; for (const v of Object.values(c)) if (!v.leaf) add(v.en); } catch (e) {}
  return set;
}
function classify(items, lang, K) {
  const out = [];
  for (const raw of items) {
    const s = raw.replace(/\s+/g, ' ').trim(); if (s.length < 3 || !/[A-Za-z]{2}/.test(s) || KEEP.test(s) || BRANDISH.test(s)) continue;
    if (/^[\d\s$.,:%+\-x/()A-Z#]+$/.test(s)) continue; // figures and tickers
    if (K.has(s)) { out.push(s); continue; }
    const words = s.match(/[A-Za-z']+/g) || [], hits = (s.match(EN) || []).length;
    if (words.length >= 3 && (STRONG.test(s) || (lang === 'x' && hits / words.length >= 0.5))) out.push(s);
  }
  return Array.from(new Set(out));
}
const COLLECT = `(function(){
  var out={};function add(s){s=String(s||'').trim();if(s)out[s]=1;}
  var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:function(n){var p=n.parentNode&&n.parentNode.nodeName;return (p==='SCRIPT'||p==='STYLE'||p==='NOSCRIPT'||p==='TEXTAREA'||p==='CODE'||p==='PRE'||(n.parentNode.closest&&n.parentNode.closest('pre,code,.ct-body,[data-notr]')))?2:1;}});
  while(w.nextNode())add(w.currentNode.nodeValue);
  document.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(function(e){['placeholder','title','aria-label','alt'].forEach(function(k){if(e.getAttribute(k))add(e.getAttribute(k));});});
  return Object.keys(out);
})()`;
const OVER = `(function(){
  var iw=innerWidth,bad=[],seen=0;
  document.querySelectorAll('body *').forEach(function(e){
    if(seen>60||!e.getClientRects().length)return;var c=getComputedStyle(e);if(c.visibility==='hidden'||c.display==='none')return;
    var own=false;for(var i=0;i<e.childNodes.length;i++)if(e.childNodes[i].nodeType===3&&e.childNodes[i].nodeValue.trim())own=true;if(!own)return;
    var r=e.getBoundingClientRect(),t=e.textContent.trim().slice(0,70),clip=false,a=e.parentElement;
    while(a&&a!==document.body){var o=getComputedStyle(a);if(/auto|scroll/.test(o.overflowX)){clip=true;break;}a=a.parentElement;}
    if(r.width<2)return;
    if(!clip&&r.right>iw+2){bad.push({k:'off-screen',t:t,w:Math.round(r.width),c:(e.className&&e.className.baseVal===undefined)?String(e.className).slice(0,40):''});seen++;return;}
    if(e.scrollWidth>e.clientWidth+2&&e.clientWidth>0&&c.display!=='inline'){bad.push({k:c.textOverflow==='ellipsis'?'cut':'spill',t:t,w:e.clientWidth,sw:e.scrollWidth,c:String(e.className||'').slice(0,40)});seen++;}
  });
  return {doc:document.documentElement.scrollWidth,iw:iw,bad:bad};
})()`;
async function one(lang, key) {
  const { withBrowser } = require('./e2e-browser.js'), K = known(), s = S[key], KEYF = fs.readFileSync(path.join(R, 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/)[0];
  const H = { 'content-type': 'application/json', 'x-admin-key': KEYF }, uid = 'e2e_i18n' + lang;
  const adm = (b) => fetch('https://marginpad.io/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json());
  await adm({ uid, op: 'mk', xp: 1500 }); const tok = (await adm({ uid, op: 'sess' })).token;
  const texts = new Set(); let over = { doc: 0, iw: 390, bad: [] };
  await withBrowser(async (b) => {
    const p = await b.newPage(); await p.setViewport({ width: process.argv.includes('--desk') ? 1366 : 390, height: 844, isMobile: !process.argv.includes('--desk'), hasTouch: !process.argv.includes('--desk') });
    await p.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
    await p.evaluateOnNewDocument((l) => { try { localStorage.setItem('mp_lang', l); localStorage.setItem('mp_acad_lang', l); localStorage.setItem('mp_ck_ok', '1'); } catch (e) {} }, lang);
    if (LOCAL) { const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }; await p.setRequestInterception(true); p.on('request', (r) => { const u = new URL(r.url()); if (u.hostname === 'marginpad.io' && r.isNavigationRequest() && r.frame() === p.mainFrame()) { const TOOL = /^\/(es|pt|de)\/(paper-trade|charts|calculators|screener|heatmap|swap)\/?$/.exec(u.pathname); const h = TOOL ? path.join(R, 'dist/app-' + TOOL[1] + '.html') : path.join(R, 'dist', u.pathname, 'index.html'); if (fs.existsSync(h)) return r.respond({ status: 200, contentType: 'text/html', body: fs.readFileSync(h) }); }
      if (u.hostname === 'marginpad.io' && /^\/(assets|academy\/i18n)\//.test(u.pathname)) { const f = path.join(R, 'dist', decodeURIComponent(u.pathname)); if (fs.existsSync(f) && mime[path.extname(f)]) return r.respond({ status: 200, contentType: mime[path.extname(f)], body: fs.readFileSync(f) }); } r.continue(); }); }
    await p.goto(BASE + '/' + lang + s.p, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 7000));
    const take = async () => { for (const t of await p.evaluate(COLLECT)) texts.add(t); const o = await p.evaluate(OVER); if (o.doc > over.doc) over.doc = o.doc; over.bad = over.bad.concat(o.bad); };
    await take(); if (arg('--shot', '')) await p.screenshot({ path: arg('--shot', '') + '-' + lang + '-' + key + '-0.png' });
    for (const st of s.steps) { try { await p.evaluate(st); } catch (e) {} await new Promise((r) => setTimeout(r, 1300)); await take(); if (arg('--shot', '')) await p.screenshot({ path: arg('--shot', '') + '-' + lang + '-' + key + '-' + s.steps.indexOf(st) + 's.png' }); }
  });
  await adm({ uid, op: 'rm' });
  const seen = {}, overflow = over.bad.filter((x) => { const k = x.k + x.t; if (seen[k]) return false; seen[k] = 1; return true; });
  fs.mkdirSync(OUT, { recursive: true });
  const english = classify(Array.from(texts), lang, K);
  fs.writeFileSync(path.join(OUT, lang + '-' + key + '.json'), JSON.stringify({ lang, key, texts: texts.size, doc: over.doc, english, overflow }, null, 1));
  console.log(lang, key, 'texts', texts.size, 'english', english.length, 'overflow', overflow.length, 'doc', over.doc);
}
if (process.argv.includes('--all')) {
  const only = arg('--surfaces', ''), keys = only ? only.split(',') : Object.keys(S), langs = arg('--langs', LANGS.join(',')).split(',');
  for (const l of langs) for (const k of keys) { const a = [__filename, '--lang', l, '--surface', k].concat(LOCAL ? ['--local'] : []).concat(process.argv.includes('--desk') ? ['--desk'] : []); const r = spawnSync('node', a, { encoding: 'utf8', timeout: 150000 }); console.log((r.stdout || '').trim().split('\n').slice(-1)[0] || (l + ' ' + k + ' no output')); }
} else one(arg('--lang', 'pt'), arg('--surface', 'paper')).then(() => process.exit(0)).catch((e) => { console.log('CRASH', e); process.exit(1); });
