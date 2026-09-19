// LAYER 3: the strings the PAGE'S OWN JAVASCRIPT writes, which the static-HTML audit cannot see and gen-pages
// never touches. Written 2026-09-19 after the owner pointed at the one that matters most - the signed-in member
// card on the Spanish homepage still says "Welcome back, @name".
//
// Files only, no model, no network. It reports; it never writes.
//
//   node build/es/audit-js.js                 every /es/ page + every shared bundle
//   node build/es/audit-js.js --page /es/     one page
//   node build/es/audit-js.js --bundles       the shared bundles only
//   node build/es/audit-js.js --json <file>
//
// WHAT IT CANNOT DO, stated plainly: it cannot know whether a literal is ever shown to a human. It judges by
// shape - two or more real words, not a selector, not a URL, not CSS, not an event name - and then by whether
// the words are English. Everything it prints is a CANDIDATE a person should glance at; the counts are honest
// about that. The one thing it is strict about is the opposite direction: a literal it drops is never reported,
// so the numbers are a floor, not a ceiling.

const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../');
const DIST = path.join(ROOT, 'dist');

const args = process.argv.slice(2);
const argOf = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ONLY = argOf('--page');
const JSONOUT = argOf('--json');
const BUNDLES_ONLY = args.includes('--bundles');

// ---------------------------------------------------------------- shape tests

// A literal that is plainly machinery, whatever words it contains.
const MACHINE = [
  /^[#.][\w-]+$/,                       // a selector
  /^[\w-]+$/,                           // a single token
  /^https?:\/\//, /^\/[\w\/-]*$/,       // a URL or a path
  /^[\w-]+\/[\w-]+/,                    // a path fragment
  /[{}<>]\s*$/,                         // markup or a template tail
  /^[\s\d.,:;%$+\-()[\]|/\\*=]+$/,      // punctuation and numbers only
  /^(GET|POST|PUT|DELETE|PATCH)\b/,
  /^(application|text|image)\//,
  /^[a-z]+([A-Z][a-z]+)+$/,             // camelCase identifier
  /^[a-z-]+:[a-z-]+/,                   // css declaration-ish
];
// CSS property names and values appear in style strings constantly.
const CSS_WORDS = /\b(px|rem|em|vh|vw|rgba?|hsla?|flex|grid|absolute|relative|inherit|none|auto|hidden|solid|bold|center|nowrap|pointer|translate|scale|opacity|z-index|font-|background|border|margin|padding|display|position|transform|transition)\b/;
// A string scanner sees the text BETWEEN two quotes, so `'a '+x+' b'` yields the fragment "+x+" and the halves
// around it. Those fragments read like prose to a word counter and they are not. Anything carrying JavaScript
// syntax is dropped: the point of this script is to hand a person a list worth reading.
const CODEY = [
  /\b(function|return|var|let|const|typeof|new Date|document\.|window\.|JSON\.|\.then|\.catch|addEventListener|querySelector|getElementById|classList|innerHTML|textContent|parseInt|parseFloat|Math\.)\b/,
  /=>|\)\s*;|\)\s*\{|\}\s*\)|\|\||&&|\+\+|===|!==/,
  /^[^A-Za-z]*\+|\+[^A-Za-z]*$/,        // starts or ends in a concatenation
  /^\s*[),;\]}]/,                        // opens on a closing bracket
  /[<>]=|\bvar\b|\bif\s*\(/,
];

const EN = new Set(('the,a,an,and,or,but,if,of,to,in,on,at,for,with,from,by,your,you,we,it,is,are,was,were,be,been,'
  + 'this,that,these,those,here,there,now,new,not,no,yes,all,any,some,more,most,less,only,just,still,again,'
  + 'open,close,closed,opens,closes,start,started,stop,stopped,save,saved,send,sent,add,added,remove,removed,'
  + 'loading,failed,error,errors,try,retry,again,please,sorry,thanks,welcome,back,next,last,first,previous,'
  + 'today,yesterday,tomorrow,day,days,week,weeks,month,months,year,years,hour,hours,minute,minutes,second,seconds,'
  + 'trade,trades,trading,position,positions,order,orders,price,leverage,margin,profit,loss,win,wins,loses,'
  + 'account,accounts,member,members,level,levels,season,rank,board,boards,prize,prizes,reward,rewards,'
  + 'claim,claimed,earn,earned,balance,withdraw,withdrawal,deposit,free,paid,buy,sell,'
  + 'sign,signed,log,logged,in,out,up,down,left,right,show,hide,view,see,read,write,copy,copied,'
  + 'need,needs,must,can,cannot,will,would,should,could,have,has,had,get,got,make,made,take,took,'
  + 'your,yours,my,mine,our,ours,their,theirs,what,when,where,which,who,how,why,'
  + 'nothing,something,everything,anyone,nobody,everyone,each,every,other,another,same,different,'
  + 'left,remaining,available,unavailable,enabled,disabled,active,inactive,online,offline,'
  + 'welcome,congratulations,unlocked,locked,pending,complete,completed,finish,finished,done,ready').split(','));

// Words that are the same, or brand, or a term the brief keeps in English. Shared with the static audit's spirit.
const NEUTRAL = new Set(('marginpad,bybit,binance,okx,bitget,kucoin,gate,mexc,kraken,coinbase,moon,fomo,hyperliquid,'
  + 'telegram,api,mcp,sdk,url,uid,pnl,roe,roi,xp,btc,eth,sol,xrp,usdt,usd,premium,plus,pro,max,vip,ticks,bot,'
  + 'long,short,spot,futures,perp,perps,funding,spread,slippage,maker,taker,wallet,exchange,trader,screener,'
  + 'heatmap,vault,arena,rekt,paper,demo,live,beta,ok,total,final,error,real,global,local,menu,chat,email,'
  + 'crypto,bitcoin,ethereum,solana,token,stop,take,cross,isolated,drawdown,backtest,apr,apy,oi,dca,swap').split(','));

function words(s) { return (s.match(/[A-Za-z][A-Za-z']{1,}/g) || []).map(w => w.toLowerCase()); }

function candidate(s) {
  const t = s.trim();
  if (t.length < 6 || t.length > 400) return false;
  if (MACHINE.some(re => re.test(t))) return false;
  if (CODEY.some(re => re.test(t))) return false;
  if (CSS_WORDS.test(t)) return false;
  if (/^\s*</.test(t) && !/[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(t.replace(/<[^>]*>/g, ' '))) return false;
  const w = words(t.replace(/<[^>]*>/g, ' '));
  if (w.length < 2) return false;
  const real = w.filter(x => x.length >= 3);
  if (real.length < 2) return false;
  return true;
}

// Is this candidate ENGLISH rather than Spanish? Accents and Spanish function words are the tell; a string with
// neither, whose words are mostly English vocabulary, is English.
const ES_TELL = /[áéíóúüñ¿¡]|\b(el|la|los|las|un|una|de|del|que|con|para|por|sin|tu|tus|es|son|se|su|al|más|y|o|en|no|si)\b/i;
function isEnglish(s) {
  const t = s.replace(/<[^>]*>/g, ' ');
  if (ES_TELL.test(t)) return false;
  const w = words(t).filter(x => !NEUTRAL.has(x));
  if (w.length < 2) return false;
  const hits = w.filter(x => EN.has(x)).length;
  return hits >= 2 || (hits >= 1 && w.length <= 3);
}

// Pull string literals out of JS. Not a parser - a scanner that understands the three quote forms and escapes.
function literals(src) {
  const out = []; const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); if (i < 0) break; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; let j = i + 1, buf = '';
      while (j < n) {
        if (src[j] === '\\') { buf += src[j + 1] === 'n' ? ' ' : src[j + 1]; j += 2; continue; }
        if (src[j] === q) break;
        if (q === '`' && src[j] === '$' && src[j + 1] === '{') { const k = src.indexOf('}', j); if (k < 0) break; buf += ' '; j = k + 1; continue; }
        buf += src[j]; j++;
      }
      if (j < n) { out.push({ s: buf, at: i }); i = j + 1; continue; }
    }
    i++;
  }
  return out;
}

// A DICTIONARY IS NOT A DEFECT. mp-nav's MPI and mp-auth's AUTH_T hold the English strings ON PURPOSE - they
// are the fallback every other language is measured against - and i18n.js IS the translation loader. Counting
// them made the bundles look several hundred strings worse than they are. Cut the dictionary span out first.
const DICTS = {
  'mp-nav.js': /var MPI = \{.*?\};\r?\n/s,
  'mp-auth.js': /AUTH_T\s*=\s*\{[\s\S]*?\};/,
};
// A ROUTED STRING AND ITS TABLE ARE NOT FINDINGS. The i18n-bundle routing leaves the English in place as the
// helper's fallback argument, and the tables it writes are keyed by English on purpose (the Vault catalogue
// table is keyed by the English sentence itself). Counting them reports work that is already done.
// HT( is the bento homepage's own helper, written before the general tool existed. Not knowing about it made
// the homepage report 62 strings of which a third were already done.
const ROUTED = /(?:__esT?V?_[a-z0-9]+|HT)\(\s*'[^']*'\s*,\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*\)|(?:__esT?V?_[a-z0-9]+|HT)\(\s*"[^"]*"\s*,\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*\)/g;
const TABLES = /var __es[VD]*D?_[a-z0-9]+ = \{[\s\S]*?\};\r?\n/g;
const deRouted = s => s.replace(TABLES, m => ' '.repeat(m.length)).replace(ROUTED, m => ' '.repeat(m.length));
const PACKED = new Set(['i18n.js']);                       // the loader itself: every string in it is a default
// Pages that replace their own text at runtime from a translation pack of their own. They are reported apart,
// because "2,314 English strings" on /es/academy/ is the EN master the page swaps out, not what a reader sees.
const RUNTIME_PACK = [/\/es\/academy\//, /\/es\/spot\//];

function scriptsOf(html) {
  const out = []; const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/.test(m[1])) continue;                 // external, scanned as a bundle instead
    if (/type\s*=\s*["']application\/ld\+json/i.test(m[1])) continue;
    out.push({ body: m[2], at: m.index });
  }
  return out;
}

// ---------------------------------------------------------------- run

function walk(dir, out) {
  let e = []; try { e = fs.readdirSync(dir, { withFileTypes: true }); } catch (x) { return out; }
  for (const f of e) { const p = path.join(dir, f.name); if (f.isDirectory()) walk(p, out); else if (f.name.endsWith('.html')) out.push(p.split(path.sep).join('/')); }
  return out;
}

const F = { pages: [], packedPages: [], bundles: [] };

if (!BUNDLES_ONLY) {
  const esPages = walk(path.join(DIST, 'es'), []).concat([path.join(DIST, 'app-es.html').split(path.sep).join('/')]).filter(p => fs.existsSync(p));
  for (const p of esPages) {
    const url = '/' + p.slice(DIST.length + 1);
    if (ONLY && url.indexOf(ONLY) !== 0) continue;
    let html = ''; try { html = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
    const seen = new Map();
    for (const sc of scriptsOf(html)) {
      for (const L of literals(deRouted(sc.body))) {
        if (!candidate(L.s)) continue;
        if (!isEnglish(L.s)) continue;
        const k = L.s.trim().replace(/\s+/g, ' ');
        seen.set(k, (seen.get(k) || 0) + 1);
      }
    }
    if (seen.size) {
      const packed = RUNTIME_PACK.some(re => re.test(url));
      (packed ? F.packedPages : F.pages).push({ page: url, n: seen.size, strings: [...seen.keys()] });
    }
  }
}

const BUNDLE_DIR = path.join(DIST, 'assets');
let bundles = [];
try { bundles = fs.readdirSync(BUNDLE_DIR).filter(f => f.endsWith('.js') && !/lightweight-charts|\.min\./.test(f)); } catch (e) {}
for (const f of bundles) {
  if (PACKED.has(f)) continue;
  let src = ''; try { src = fs.readFileSync(path.join(BUNDLE_DIR, f), 'utf8'); } catch (e) { continue; }
  if (DICTS[f]) src = src.replace(DICTS[f], ' ');
  src = deRouted(src);
  const seen = new Map();
  for (const L of literals(src)) {
    if (!candidate(L.s)) continue;
    if (!isEnglish(L.s)) continue;
    const k = L.s.trim().replace(/\s+/g, ' ');
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  if (seen.size) F.bundles.push({ file: f, n: seen.size, strings: [...seen.keys()] });
}

// ---------------------------------------------------------------- report

const N = n => n.toLocaleString('en-US');
const say = s => console.log(s);
const uniq = new Set();
F.pages.forEach(p => p.strings.forEach(s => uniq.add(s)));
F.bundles.forEach(b => b.strings.forEach(s => uniq.add(s)));

say('LAYER 3 - ENGLISH STRINGS WRITTEN BY JAVASCRIPT  ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
say('gen-pages translates static HTML only, so none of this is reached by the Spanish round.');
say('');
say('  ' + String(F.pages.length).padStart(4) + '  /es/ pages whose own inline script writes English');
say('  ' + String(F.bundles.length).padStart(4) + '  shared bundles carrying English (they serve BOTH languages)');
say('  ' + String(uniq.size).padStart(4) + '  distinct English strings a reader can actually meet');
say('');
say('  covered by a runtime pack, reported apart (the page swaps these out itself):');
F.packedPages.forEach(p => say('  ' + String(p.n).padStart(4) + '  ' + p.page));
say('  dictionaries and the i18n loader are not counted at all - an English default is the point of them.');
say('');
say('PAGES, worst first');
for (const p of F.pages.sort((a, b) => b.n - a.n).slice(0, 30)) say('  ' + String(p.n).padStart(4) + '  ' + p.page);
say('');
say('SHARED BUNDLES, worst first');
for (const b of F.bundles.sort((a, b2) => b2.n - a.n).slice(0, 30)) say('  ' + String(b.n).padStart(4) + '  ' + b.file);

if (ONLY) {
  for (const p of F.pages) { say(''); say('STRINGS ON ' + p.page + ' (' + p.n + ')'); p.strings.forEach(s => say('  ' + s.slice(0, 160))); }
}

if (JSONOUT) { fs.writeFileSync(JSONOUT, JSON.stringify({ generated: new Date().toISOString(), findings: F, distinct: [...uniq] }, null, 1)); say(''); say('written to ' + JSONOUT); }
