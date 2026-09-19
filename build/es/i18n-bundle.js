// ROUTE A SHARED BUNDLE'S USER-FACING STRINGS THROUGH A SPANISH DICTIONARY.
//
// Written 2026-09-19 (owner: "hocu da neko ko prica spanski moze skroz funkcionalno da koristi nas sajt i da se
// ne susrece sa delimicno prevedenim sajtom"). The bundles serve BOTH languages from one file, so they cannot
// have a twin - they need a dictionary, which is the pattern mp-nav (MPI) and mp-auth (AUTH_T) already use.
//
//   node build/es/i18n-bundle.js --scan mp-auth.js > keys.json     candidates + a generated key for each
//   node build/es/i18n-bundle.js --apply mp-auth.js keys.json      inject the dictionary and route the literals
//   node build/es/i18n-bundle.js --apply mp-auth.js keys.json --dry
//
// WHY A DICTIONARY IN THE FILE AND NOT THE LAZY i18n PACK: the packs load over the network after first paint.
// A toast, a refusal or a sign-in label that fires in that window would be English - which is exactly the
// "partially translated" experience this is meant to end. An inline table is there on the first frame.
// Spanish only: it is the site's one full second language, and thirteen languages inline would be 200KB.
//
// THE HELPER IS A TOP-LEVEL FUNCTION DECLARATION, ON PURPOSE. These bundles are several sibling IIFEs, and
// routing mp-nav's cookie bar through a helper defined inside a different closure broke it on every page
// ("TR is not defined"). A function declaration hoists across the whole script, so every block can see it.

const fs = require('fs'), path = require('path');
const DIST = path.resolve(__dirname, '../../dist/assets');

const args = process.argv.slice(2);
const MODE = args.includes('--scan') ? 'scan' : args.includes('--apply') ? 'apply' : null;
const FILE = args[args.indexOf('--' + MODE) + 1];
const KEYS = MODE === 'apply' ? args[args.indexOf('--apply') + 2] : null;
const DRY = args.includes('--dry');
if (!MODE || !FILE) { console.error('usage: --scan <bundle.js> | --apply <bundle.js> <keys.json> [--dry]'); process.exit(2); }

// A bundle name resolves under dist/assets; anything with a slash is a dist-relative path, which is how the
// hand-made pages are reached (their strings live in inline <script> blocks, not in a shared bundle).
const IS_PAGE = FILE.indexOf('/') >= 0;
const SRC = IS_PAGE ? path.resolve(DIST, '..', FILE) : path.join(DIST, FILE);
const slug = FILE.replace(/\.(js|html)$/, '').replace(/[^a-z0-9]/gi, '');
const HELPER = '__esT_' + slug;
const DICT = '__esD_' + slug;

// ---------------------------------------------------------------- scanning

// Only single- and double-quoted literals are candidates. A template literal is left alone: its ${} holes make
// a whole-literal swap unsafe, and there are few of them in these files.
function literals(src) {
  const out = []; const n = src.length; let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const k = src.indexOf('*/', i + 2); if (k < 0) break; i = k + 2; continue; }
    if (c === '"' || c === "'") {
      const q = c; let j = i + 1, esc = false;
      while (j < n) { if (esc) { esc = false; j++; continue; } if (src[j] === '\\') { esc = true; j++; continue; } if (src[j] === q) break; if (src[j] === '\n') { j = -1; break; } j++; }
      if (j > 0) { out.push({ raw: src.slice(i, j + 1), body: src.slice(i + 1, j), q, at: i }); i = j + 1; continue; }
    }
    i++;
  }
  return out;
}

const MACHINE = [
  /^[#.\[][\w\-[\]="',:.\s>()~*^$|]+$/,      // selector
  /^[\w-]+$/, /^https?:\/\//, /^\/[\w\/?&=.-]*$/, /^[\w-]+\/[\w-]+$/,
  /^[\s\d.,:;%$+\-()[\]|/\\*=<>]+$/,
  /^(GET|POST|PUT|DELETE|PATCH|HEAD)\b/, /^(application|text|image|audio|video)\//,
  /^[a-z]+([A-Z][a-z0-9]*)+$/,               // camelCase identifier
  /^[a-z-]+\s*:\s*[^;]+;?$/,                 // one css declaration
  /^data:/, /^[A-Za-z-]+$/,
];
const CSSY = /\b(px|rem|em|vh|vw|rgba?|hsla?|flex|grid|absolute|relative|inherit|solid|nowrap|translate|scale|opacity|z-index|font-|background|border-|margin|padding|display:|position:|transform|transition|cubic-bezier|linear-gradient|currentColor|viewBox|stroke-)\b/;
const CODEY = [
  /\b(function|return|typeof|instanceof|new Date|document\.|window\.|JSON\.|Math\.|localStorage|addEventListener|querySelector|getElementById|classList|innerHTML|textContent|parseInt|parseFloat)\b/,
  /=>|\)\s*;|\)\s*\{|\}\s*\)|\|\||&&|===|!==|\+\+/,
];
// A rule, a keyframe or a selector with braces is CSS whatever English words it holds. The first scan offered
// '.mpa-link:hover{color:#c2f64a}' and '@keyframes mpaSpin{to{--mpAng:360deg}}' up for translation.
const CSS_BLOCK = /^\s*@[a-z-]+[\s{]|^\s*[.#:[]?[\w.#:[\]()\-, >+~*]*\{/;
const CSS_DECL = /\{[^}]*:[^}]*\}/;
const EN_HINT = new Set(('the,a,an,and,or,but,if,of,to,in,on,at,for,with,from,by,your,you,we,it,is,are,was,were,be,'
  + 'this,that,these,those,here,there,now,new,not,no,yes,all,any,some,more,most,only,just,still,again,too,'
  + 'open,close,closed,start,stop,save,saved,send,sent,add,added,remove,removed,cancel,cancelled,delete,deleted,'
  + 'loading,failed,error,try,retry,please,sorry,thanks,welcome,back,next,last,first,again,already,'
  + 'today,yesterday,tomorrow,day,days,week,month,year,hour,hours,minute,minutes,'
  + 'trade,trades,trading,position,positions,order,orders,price,leverage,margin,profit,loss,win,wins,'
  + 'account,member,level,season,rank,board,boards,prize,reward,rewards,claim,earn,balance,withdraw,'
  + 'sign,signed,in,out,up,down,show,hide,view,see,read,write,copy,copied,follow,following,message,messages,'
  + 'need,needs,must,can,cannot,will,would,should,could,have,has,had,get,got,make,made,take,took,'
  + 'nothing,something,anyone,nobody,everyone,each,every,other,another,same,different,limit,limits,'
  + 'left,remaining,available,enabled,disabled,active,online,offline,unlocked,locked,pending,done,ready,'
  + 'challenge,duel,duels,streak,wallet,chat,profile,username,email,code,link,tap,click,choose,pick').split(','));
const NEUTRAL = new Set(('marginpad,bybit,binance,okx,bitget,kucoin,gate,mexc,kraken,coinbase,moon,fomo,hyperliquid,'
  + 'telegram,api,mcp,sdk,url,uid,pnl,roe,roi,xp,btc,eth,sol,usdt,usd,premium,plus,pro,max,vip,ticks,bot,'
  + 'long,short,spot,futures,perp,funding,spread,slippage,maker,taker,screener,heatmap,vault,arena,rekt,'
  + 'paper,demo,live,beta,ok,total,final,real,global,menu,email,crypto,bitcoin,ethereum,token,stop,take').split(','));
const ES_TELL = /[áéíóúüñ¿¡]/;

const wordsOf = s => (s.match(/[A-Za-z][A-Za-z']+/g) || []).map(w => w.toLowerCase());

function userFacing(body) {
  const t = body.trim();
  if (t.length < 4 || t.length > 400) return false;
  if (MACHINE.some(re => re.test(t))) return false;
  if (CSSY.test(t)) return false;
  if (CSS_BLOCK.test(t) || CSS_DECL.test(t)) return false;
  if (CODEY.some(re => re.test(t))) return false;
  if (ES_TELL.test(t)) return false;                       // already Spanish - a dictionary entry
  if (/^\s*[),;\]}]/.test(t) || /^[^A-Za-z<]*\+|\+[^A-Za-z]*$/.test(t)) return false;
  // Count words in what a READER sees: strip whole tags, and strip any dangling attribute soup left by a
  // fragment that opens or closes a tag mid-literal ('<div class="hp-price ', '" alt="" loading="lazy">').
  // Those are markup, not copy, and they were the only three left on mp-calc's second pass.
  const vis = t.replace(/<[^>]*>/g, ' ').replace(/[\w-]+\s*=\s*(\\?"[^"]*\\?"|'[^']*')/g, ' ')
    .replace(/^[^>]*>/, ' ').replace(/<[^<]*$/, ' ');
  const w = wordsOf(vis);
  if (w.length < 2) return false;
  const real = w.filter(x => !NEUTRAL.has(x) && x.length >= 3);
  if (real.length < 1) return false;
  const hits = w.filter(x => EN_HINT.has(x)).length;
  return hits >= 1;
}

function keyFor(body, taken) {
  let base = body.replace(/<[^>]*>/g, ' ').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 4)
    .map((w, i) => i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join('');
  base = (base || 'k').slice(0, 26);
  let k = base, n = 2;
  while (taken.has(k)) k = base + (n++);
  taken.add(k);
  return k;
}

// A DICTIONARY IS NOT A CALL SITE. mp-nav's MPI, mp-auth's AUTH_T and any table this tool has already written
// hold English on purpose - scanning them offers the same string back for translation for ever. Blank those
// spans before scanning (never before APPLYING: the apply step must see the real file).
const DICT_SPANS = [
  /var MPI = \{[\s\S]*?\};\r?\n/,
  /AUTH_T\s*=\s*\{[\s\S]*?\};/,
  /var __esD_[a-z0-9]+ = \{[\s\S]*?\};\r?\n/,
];
function scannable(s) {
  let out = s;
  for (const re of DICT_SPANS) out = out.replace(re, m => ' '.repeat(m.length));
  // A ROUTED STRING KEEPS ITS ENGLISH as the helper's fallback argument, so a second scan would offer every
  // string already done all over again. Blank the whole call. This is what makes the process ITERATIVE: the
  // scanner is a heuristic over a hand-rolled literal reader, it can desynchronise on a regex containing a
  // quote, so the honest way to finish is to scan, route, and scan again until nothing new comes back.
  // The ENGLISH ARGUMENT has to go with it. Blanking only the call prefix leaves the fallback literal in place,
  // so the second scan offered every already-routed string straight back.
  out = out.replace(/__esT_[a-z0-9]+\(\s*"[^"]*"\s*,\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*\)/g, m => ' '.repeat(m.length));
  // On a PAGE, only the inline scripts are code. Blanking everything else keeps HTML attributes and prose out
  // of the scan - gen-pages already translates those, and offering them here would translate them twice.
  if (IS_PAGE) {
    let keep = ' '.repeat(out.length).split('');
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
    while ((m = re.exec(out))) {
      if (/\bsrc\s*=/.test(m[1]) || /application\/ld\+json/i.test(m[1])) continue;
      const s0 = m.index + m[0].indexOf('>', 0) + 1;
      for (let i = s0; i < s0 + m[2].length; i++) keep[i] = out[i];
    }
    out = keep.join('');
  }
  return out;
}

const src = fs.readFileSync(SRC, 'utf8');

if (MODE === 'scan') {
  const counts = new Map();
  const scan = scannable(src);
  for (const L of literals(scan)) counts.set(L.raw, (counts.get(L.raw) || 0) + 1);
  const seen = new Set(), taken = new Set(), out = [];
  for (const L of literals(scan)) {
    if (seen.has(L.raw)) continue;
    seen.add(L.raw);
    if (!userFacing(L.body)) continue;
    out.push({ key: keyFor(L.body, taken), raw: L.raw, en: L.body, n: counts.get(L.raw), es: '' });
  }
  process.stdout.write(JSON.stringify({ file: FILE, helper: HELPER, dict: DICT, items: out }, null, 1));
  process.exit(0);
}

// ---------------------------------------------------------------- applying

const spec = JSON.parse(fs.readFileSync(KEYS, 'utf8'));
if (spec.file !== FILE) { console.error('this key file is for ' + spec.file); process.exit(2); }
const items = spec.items.filter(x => x.es && x.es !== x.en);
if (!items.length) { console.error('nothing translated in ' + KEYS); process.exit(2); }

// THE ENGLISH COMES FROM BETWEEN QUOTES, THE SPANISH GOES INTO JSON - two different escaping worlds, and
// mixing them puts the text "—" on the page. `en` is a source-level literal body, so it holds —, \'
// and \" as backslash sequences; a translator mirrors those, correctly, to keep the shapes matching. But the
// dictionary is written with JSON.stringify, which does its OWN quoting, so a value must hold the REAL
// character. Interpret the translation the way JavaScript would have, once, here. Translations that already
// used real characters contain no backslash and pass through untouched.
function unescapeJs(s) {
  return String(s).replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (m, g) => {
    if (g[0] === 'u') return String.fromCharCode(parseInt(g.slice(1), 16));
    if (g[0] === 'x') return String.fromCharCode(parseInt(g.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', '0': '\0' }[g] != null ? { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', '0': '\0' }[g] : g;
  });
}
const dict = '{' + items.map(x => JSON.stringify(x.key) + ':' + JSON.stringify(unescapeJs(x.es))).join(',') + '}';
const HEAD = '/* Spanish for this file. Inline, not the lazy i18n pack: a string that fires before a pack\n'
  + '   arrives would be English, which is the partial translation this exists to end. A top-level function\n'
  + '   declaration so every IIFE in the file can see it (see the mp-nav cookie-bar incident, 2026-09-19). */\n'
  + 'var ' + DICT + ' = ' + dict + ';\n'
  + 'function ' + HELPER + '(k, en) { try { if ((document.documentElement.lang || "").slice(0, 2).toLowerCase() === "es"'
  + ' && ' + DICT + '[k] != null) return ' + DICT + '[k]; } catch (e) {} return en; }\n';

// THE REPLACEMENT MUST NOT ESCAPE THE CODE. On a page, the same sentence often appears BOTH in the static HTML
// (already translated by gen-pages) and in a script; a blind file-wide swap would rewrite the markup into a
// function call. Work per script region and splice the file back together.
function regions(s) {
  if (!IS_PAGE) return [{ s: 0, e: s.length, code: true }];
  const out = []; let at = 0;
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(s))) {
    if (/\bsrc\s*=/.test(m[1]) || /application\/ld\+json/i.test(m[1])) continue;
    const s0 = m.index + m[0].indexOf('>') + 1, e0 = s0 + m[2].length;
    if (s0 > at) out.push({ s: at, e: s0, code: false });
    out.push({ s: s0, e: e0, code: true });
    at = e0;
  }
  if (at < s.length) out.push({ s: at, e: s.length, code: false });
  return out;
}

let routed = 0; const skipped = [];
const parts = regions(src).map(r => ({ text: src.slice(r.s, r.e), code: r.code }));
const codeOf = () => parts.filter(p => p.code).map(p => p.text).join('\n/*|*/\n');

for (const it of items) {
  const n = codeOf().split(it.raw).length - 1;
  if (n !== it.n) { skipped.push(it.key + ' (expected ' + it.n + ', found ' + n + ' in code)'); continue; }
  const rep = HELPER + '(' + JSON.stringify(it.key) + ',' + it.raw + ')';
  for (const p of parts) if (p.code) p.text = p.text.split(it.raw).join(rep);
  routed += n;
}

const already = src.indexOf('function ' + HELPER) >= 0;
if (!already) {
  const first = parts.findIndex(p => p.code);
  if (first < 0) { console.error('no inline script to put the dictionary in'); process.exit(2); }
  parts[first].text = '\n' + HEAD + parts[first].text;
}
let out = parts.map(p => p.text).join('');

// A SECOND PASS MUST MERGE INTO THE EXISTING TABLE, not skip it. The scanner is iterative by design (it can
// desynchronise on a regex holding a quote), so a file gets routed more than once - and the first cut only
// inserted the dictionary when the helper was absent, which meant every later key resolved to nothing and
// silently fell back to English. Exactly the partial translation this whole exercise is closing.
if (already) {
  const m = new RegExp('var ' + DICT + ' = (\\{[\\s\\S]*?\\});\\r?\\n').exec(out);
  if (!m) { console.error('the helper is there but its dictionary is not - refusing'); process.exit(2); }
  let old; try { old = JSON.parse(m[1]); } catch (e) { console.error('existing dictionary does not parse - refusing'); process.exit(2); }
  let added = 0;
  for (const x of items) if (old[x.key] == null) { old[x.key] = unescapeJs(x.es); added++; }
  out = out.slice(0, m.index) + 'var ' + DICT + ' = ' + JSON.stringify(old) + ';\n' + out.slice(m.index + m[0].length);
  console.log('   merged ' + added + ' new key(s) into the existing dictionary (' + Object.keys(old).length + ' total)');
}

console.log(FILE + ': routed ' + routed + ' occurrence(s) of ' + (items.length - skipped.length) + ' string(s)'
  + (skipped.length ? ', skipped ' + skipped.length : ''));
skipped.slice(0, 12).forEach(s => console.log('   skip ' + s));
if (DRY) { console.log('(dry run - nothing written)'); process.exit(0); }
fs.writeFileSync(SRC + '.tmp', Buffer.from(out, 'utf8'));
fs.renameSync(SRC + '.tmp', SRC);
console.log('written');
