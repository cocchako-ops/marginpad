// AUDIT OF THE SPANISH SITE - every segment of every /es/ page, against its English original, plus every entry
// in the translation catalog.
//
// Written 2026-09-19 (owner: "napravi detaljan popis svakog slova apsolutno i vidi sta nije prevedeno na spanski
// i ako ima nesto da nije dobro prevedeno"). It reads FILES ONLY - no model, no network - so a full pass over
// ~375 page pairs and 13,476 catalog entries costs nothing and can be re-run after every English change. What a
// script genuinely cannot judge (does this Spanish READ like Spanish) it does not pretend to: it ranks what a
// human should sample and prints the exact strings, so the reading is targeted.
//
// It NEVER writes. `--json <file>` dumps the whole finding set.
//
// TWO PASSES, because they answer different questions and one of them cannot be done by walking pages in order:
//
//   PAGE PASS - is the English content ON the Spanish twin at all?
//     Aligning segment #i to segment #i is WRONG the moment the twin is stale: /premium/ segments 124 in English
//     and 98 in Spanish, so every comparison after the first divergence is garbage. Each English segment is
//     therefore looked for in the twin BY TEXT - as itself (untranslated) or as its catalog translation (fine).
//     A segment that is neither is the finding that matters: the English page says something its twin does not.
//
//   CATALOG PASS - is the translation any good?
//     EN against its own stored ES, so no page alignment is involved and a string is judged once however many
//     pages carry it. Leaks, magnitude false friends, tag parity, placeholders, numbers.

const fs = require('fs'), path = require('path');
const lib = require('./lib.js');

const ROOT = path.resolve(__dirname, '../../');
const DIST = path.join(ROOT, 'dist');
const CAT = path.join(ROOT, 'build/data/es/catalog.json');

const args = process.argv.slice(2);
const JSONOUT = (() => { const i = args.indexOf('--json'); return i >= 0 ? args[i + 1] : null; })();
const LIMIT = (() => { const i = args.indexOf('--pages'); return i >= 0 ? +args[i + 1] : 0; })();
const ONLY = args.filter(a => a.indexOf('/') === 0);

// ---------------------------------------------------------------- helpers

function walk(dir, out) {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const f of ents) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (f.name.endsWith('.html')) out.push(p.split(path.sep).join('/'));
  }
  return out;
}
const rel = p => p.slice(DIST.length + 1).split(path.sep).join('/');
const decode = s => String(s || '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&[#a-z0-9]+;/gi, ' ');
const textOf = h => decode(String(h || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
// The brief FORBIDS translating what is inside <code>, so an English word in there can never be a leak. Reading
// through it is what made the check report "una <code>sell</code> a mercado" - a faithful translation - as broken.
const proseOf = h => textOf(String(h || '').replace(/<code[^>]*>[\s\S]*?<\/code>/gi, ' '));
const key = t => t.toLowerCase().replace(/[^a-z0-9àâäçéèêëîïôöùûüÿñæœ]+/gi, '');
const wordsIn = t => (t.match(/[A-Za-zÀ-ÿñÑ]{2,}/g) || []);

// English function words with no business inside a Spanish sentence. Deliberately SHORT and unambiguous: a word
// that is also Spanish (con, son, van, red, sin, mas, a, e, o, no, si) is left out on purpose. A check that
// cries wolf gets ignored, which is worse than no check.
const EN_WORDS = new Set(('the,and,with,your,yours,you,this,that,these,those,from,for,what,when,where,which,while,how,'
  + 'about,into,than,then,they,their,there,have,has,had,been,being,was,were,will,would,should,could,'
  + 'before,after,every,each,any,some,more,most,least,only,just,even,still,already,'
  + 'never,always,often,again,between,through,during,without,within,against,another,such,'
  + 'much,many,both,either,neither,whether,does,doesn,didn,isn,aren,wasn,weren,cannot,'
  + 'trades,price,prices,opens,closes,closed,account,accounts,member,members,'
  + 'paid,days,weeks,months,years,today,yesterday,tomorrow,'
  + 'reads,write,writes,makes,made,takes,taken,gives,given,know,knows,sees,seen,'
  + 'buy,sell,loss,wallet,exchange,exchanges,chart,charts,however,therefore,instead,rather,enough,'
  + 'almost,nearly,quite,very,really,anything,nothing,something,everything,someone,nobody,everyone').split(','));

// Same in both languages, or a brand, or a trading term Spanish crypto copy keeps in English on purpose (they are
// in the translator brief). The first run flagged 67 "half-translated" segments and every one of them was long/short.
const OK_SAME = new Set(('marginpad,bybit,binance,okx,bitget,kucoin,gate,mexc,kraken,coinbase,moon,fomo,hyperliquid,'
  + 'telegram,api,apis,mcp,sdk,json,html,css,rest,websocket,http,https,url,uid,pnl,roe,btc,eth,sol,xrp,usdt,usd,'
  + 'bitcoin,ethereum,solana,crypto,futures,perp,perps,spot,token,tokens,blockchain,defi,nft,'
  + 'premium,plus,pro,max,business,vip,xp,ticks,tick,bot,bots,web,app,apps,online,internet,email,'
  + 'stop,loss,take,profit,funding,rate,mark,index,total,final,normal,natural,real,ideal,social,'
  + 'general,personal,individual,original,digital,virtual,global,local,visual,central,federal,legal,'
  + 'error,errores,control,base,parte,area,areas,idea,ideas,role,radar,monitor,sector,factor,motor,'
  + 'gas,plan,plans,test,ok,live,beta,alpha,demo,pass,cash,rally,fan,club,panel,pixel,'
  + 'cookie,cookies,software,hardware,laptop,marketing,ranking,streaming,trading,broker,brokers,'
  + 'long,longs,short,shorts,swap,swaps,airdrop,staking,paper,trade,margin,cross,isolated,maker,taker,'
  + 'spread,slippage,rollover,dashboard,feed,screener,heatmap,wrap,brief,leaderboard,season,vault,arena,rekt,'
  + 'open,close,free,day,week,month,year,new,best,first,last,next,read,make,give,see,big,small,good,bad,all,'
  + 'here,now,also,because,leverage,fee,fees,fair,solo,solar,menu,nota,notas,foto,video,audio,extra,euro,'
  // THE BRIEF'S OWN GLOSSARY of terms that stay English inside Spanish prose. Not copying it here is how the
  // check ended up reporting "los exchanges" and "el mark price" as half-translated - both of which the brief
  // instructs the translator to write exactly that way.
  + 'exchange,exchanges,wallet,wallets,trader,traders,drawdown,backtest,rug,pump,dump,dca,oi,apr,apy,'
  + 'price,prices,mark,last,entry,perpetual,perpetuals,delta,neutral,carry,bucket,buckets').split(','));

const MAGNI = [
  { en: /\bbillions?\b/i, good: /mil\s+millones/i, bad: /\bbillones?\b/i, say: '"billion" must be "mil millones" - Spanish "billon" is 10^12' },
  { en: /\btrillions?\b/i, good: /\bbillones?\b/i, bad: /\btrillones?\b/i, say: '"trillion" must be "billones" - Spanish "trillon" is 10^18' },
];
const PH = /\{[a-z0-9_]{1,24}\}|%[sd]\b/gi;
const NUMS = /\d[\d.,]*\d|\d/g;
// A MONEY AMOUNT IS THE ONE THING THAT MUST SURVIVE WORD FOR WORD, and the one most easily destroyed: a
// String.replace whose REPLACEMENT contains "$200" loses it, because $2 is a capture-group reference. That is
// exactly what happened to /es/season/, which told Spanish readers the Bybit board pays "00: 00, 0, 5, 5, 0".
// Swapping the symbol for the word (English "$ per bucket" -> "USD por bucket") is legitimate and has no digits
// after the $, so this only looks at amounts.
// The first cut of this regex allowed a space before an optional k/M/B suffix, so "$100 margin" matched as
// "$100m" and "$10,000." kept the sentence's full stop: 66 findings, every one of them noise. The suffix must be
// ATTACHED, and the amount must end on a digit. Thousands separators are then dropped on both sides, because
// Spanish legitimately writes $10.000 for $10,000 and that is a convention, not a lost figure.
const MONEY = /\$\d[\d.,]*\d[kKmMbB]?|\$\d[kKmMbB]?/g;
const moneyKey = s => (String(s).match(MONEY) || []).map(x => x.replace(/[.,]/g, '').toLowerCase()).sort();

// ---------------------------------------------------------------- catalog

let cat = { items: {} };
try { cat = JSON.parse(fs.readFileSync(CAT, 'utf8')); } catch (e) {}
const CITEMS = cat.items || {};
const itemFor = en => CITEMS[lib.idOf(en)] || null;
const isLeaf = it => !!(it && it.es != null && String(it.es) === String(it.en));

const F = {
  miss: [], stale: [], untx: [], leaves: [], meta: [],
  leak: [], magni: [], tags: [], ph: [], num: [], money: [], empty: [], shortES: [],
};

// ---------------------------------------------------------------- PAGE PASS

const all = walk(DIST, []);
const esPages = all.filter(p => rel(p).indexOf('es/') === 0);
const enPages = all.filter(p => rel(p).indexOf('es/') !== 0);
const esSet = new Set(esPages.map(p => rel(p).slice(3)));

// A twin is not owed for: the app shells (a pair by design), the frozen language homepages and the RETIRED
// translated subpages (/blog/<slug>/<lang>/, which the worker 301s), the two LATAM pages (written in es-AR and
// pt-BR, twins of nothing) and demo-home (noindex, the homepage source).
const SKIP_MISS = new Set(['app.html', 'app-es.html', 'index.html', 'bitcoin-hoje/index.html', 'dolar-cripto/index.html',
  'simulador-trading-cripto-argentina/index.html', 'simulador-trading-cripto-brasil/index.html']);
const LANG_DIR = /(^|\/)(ar|da|de|es|fi|fr|hi|id|it|ja|ko|nl|no|pl|pt|ru|sv|th|tr|uk|vi|zh)\//;
// /widget/* is in the generator's own SKIP_DIRS: they are embeddable iframes with no prose, so no twin is owed.
enPages.map(rel).filter(r => !esSet.has(r) && !SKIP_MISS.has(r) && !LANG_DIR.test(r) && !/^(demo-home|widget)\//.test(r))
  .forEach(r => F.miss.push({ page: '/' + r.replace(/index\.html$/, '') }));

const perPage = [];
let pairs = 0;

for (const esAbs of esPages) {
  const r = rel(esAbs), enRel = r.slice(3);
  if (ONLY.length && !ONLY.some(o => ('/' + enRel).indexOf(o) === 0)) continue;
  const enAbs = path.join(DIST, enRel);
  if (!fs.existsSync(enAbs)) continue;
  if (LIMIT && pairs >= LIMIT) break;
  pairs++;

  let esSrc, enSrc;
  try { esSrc = fs.readFileSync(esAbs, 'utf8'); enSrc = fs.readFileSync(enAbs, 'utf8'); } catch (e) { continue; }
  let ex, ey;
  try { ex = lib.extract(enSrc); ey = lib.extract(esSrc); } catch (e) { continue; }

  const url = '/' + enRel.replace(/index\.html$/, '');
  const stat = { page: url, segs: 0, words: 0, untxWords: 0, leafWords: 0, staleWords: 0, untx: 0, stale: 0 };

  // Everything the twin actually says, as normalised text - segments, attributes and JSON-LD together, because a
  // string can legitimately move between them (a title into an alt, a heading into a JSON-LD name).
  const have = new Set();
  const add = t => { const k = key(textOf(t)); if (k) have.add(k); };
  ey.segs.forEach(s => add(s.html)); ey.attrs.forEach(a => add(a.val));
  ey.ld.forEach(b => b.items.forEach(i => add(i.val)));
  // The twin does not always cut the page into the same pieces - a link that is its own segment in one can be
  // part of the run around it in the other. Exact-segment matching reported "v1 and v2" as missing from
  // /es/trading-api/ while the page carries "v1 y v2" twice. Keeping the whole page as one key lets a present
  // string be recognised whatever segment it ended up inside.
  const whole = key(ey.segs.map(s => textOf(s.html)).join(' ') + ' ' + ey.attrs.map(a => textOf(a.val)).join(' '));
  const present = k => k && (have.has(k) || whole.indexOf(k) >= 0);

  const look = (kind, en, where) => {
    const enT = textOf(en); if (!enT) return;
    const w = wordsIn(enT).length; if (!w) return;
    stat.segs++; stat.words += w;
    const kEn = key(enT);
    const it = itemFor(en);
    const esExpected = it && it.es != null ? textOf(it.es) : null;

    if (esExpected && esExpected !== enT && present(key(esExpected))) return;    // translated and present
    if (present(kEn)) {                                                          // present, still English
      const toks = wordsIn(enT);
      if (toks.every(t => OK_SAME.has(t.toLowerCase()))) return;                  // a brand or ticker rail
      stat.untx++;
      const rec = { page: url, kind, where, en: enT.slice(0, 180), words: w, leaf: isLeaf(it), known: !!it };
      if (isLeaf(it)) { stat.leafWords += w; F.leaves.push(rec); return; }
      stat.untxWords += w;
      if (kind === 'meta' || kind === 'title') F.meta.push(rec); else F.untx.push(rec);
      return;
    }
    // NEITHER the English nor its translation is on the twin: the twin was generated from an older version of
    // this page. This is the finding that a same-index walk can never produce.
    stat.stale++; stat.staleWords += w;
    F.stale.push({ page: url, kind, where, en: enT.slice(0, 180), words: w, hasTx: !!(esExpected && esExpected !== enT) });
  };

  ex.segs.forEach((s, i) => look(s.kind === 'title' ? 'title' : 'html', s.html, 'seg#' + i));
  ex.attrs.forEach(a => look(a.tag === 'meta' ? 'meta' : 'attr', a.val, a.tag === 'meta' ? 'meta[' + a.attr + ']' : a.tag + '[' + a.attr + ']'));
  ex.ld.forEach(b => b.items.forEach(i => look('ld', i.val, 'jsonld' + i.path)));

  stat.pct = stat.words ? Math.round((1 - (stat.untxWords + stat.staleWords) / stat.words) * 1000) / 10 : 100;
  perPage.push(stat);
}

// ---------------------------------------------------------------- CATALOG PASS

let cTotal = 0, cLeaf = 0, cDone = 0;
for (const id of Object.keys(CITEMS)) {
  const it = CITEMS[id]; cTotal++;
  const en = String(it.en == null ? '' : it.en), es = String(it.es == null ? '' : it.es);
  const where = (it.ctx && it.ctx[0]) || '?';
  if (!es) { F.empty.push({ id, where, en: textOf(en).slice(0, 140) }); continue; }
  if (es === en) { cLeaf++; continue; }
  cDone++;

  const enT = textOf(en), esT = textOf(es);
  if (!enT) continue;

  const enP = proseOf(en), esP = proseOf(es);
  const enToks = new Set(wordsIn(enP).map(t => t.toLowerCase()));
  const leaked = [...new Set(wordsIn(esP).map(t => t.toLowerCase()).filter(t => EN_WORDS.has(t) && !OK_SAME.has(t) && enToks.has(t)))];
  if (leaked.length >= 2) F.leak.push({ id, where, words: leaked.slice(0, 8), en: enT.slice(0, 140), es: esT.slice(0, 140), n: it.n || 1 });

  for (const m of MAGNI) if (m.en.test(enT) && m.bad.test(esT) && !m.good.test(esT)) F.magni.push({ id, where, say: m.say, en: enT.slice(0, 140), es: esT.slice(0, 140), n: it.n || 1 });

  const ta = lib.tagSig(en), tb = lib.tagSig(es);
  if (ta !== tb) F.tags.push({ id, where, en: String(ta).slice(0, 100), es: String(tb).slice(0, 100), text: enT.slice(0, 90), n: it.n || 1 });

  const pa = (en.match(PH) || []).sort().join(' '), pb = (es.match(PH) || []).sort().join(' ');
  if (pa !== pb) F.ph.push({ id, where, en: pa || '(none)', es: pb || '(none)', text: enT.slice(0, 90), n: it.n || 1 });

  const mEn = moneyKey(enT), mEs = new Set(moneyKey(esT));
  const lostMoney = [...new Set(mEn.filter(x => !mEs.has(x)))];
  if (lostMoney.length) F.money.push({ id, where, lost: lostMoney.slice(0, 8), en: enT.slice(0, 160), es: esT.slice(0, 160), n: it.n || 1 });

  const na = enT.match(NUMS) || [], nbSet = new Set(esT.match(NUMS) || []);
  const lost = [...new Set(na.filter(x => !nbSet.has(x)))];
  if (lost.length) F.num.push({ id, where, lost: lost.slice(0, 8), en: enT.slice(0, 120), es: esT.slice(0, 120), n: it.n || 1 });

  // A translation far shorter than its original usually means a clause was dropped. Spanish runs ~15-20% LONGER
  // than English, so under 55% of the character count is a real signal, not a language difference.
  const wEn = wordsIn(enT).length;
  if (wEn >= 12 && esT.length < enT.length * 0.55) F.shortES.push({ id, where, en: enT.slice(0, 140), es: esT.slice(0, 140), ratio: +(esT.length / enT.length).toFixed(2), n: it.n || 1 });
}

// ---------------------------------------------------------------- report

const N = n => n.toLocaleString('en-US');
const tot = k => perPage.reduce((a, p) => a + p[k], 0);
const say = s => console.log(s);

say('SPANISH AUDIT - ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
say('');
say('PAGE PASS - ' + N(pairs) + ' page pairs, ' + N(tot('words')) + ' translatable words on the English side');
say('  ' + String(F.miss.length).padStart(6) + '  English pages with no /es/ twin at all');
say('  ' + String(F.stale.length).padStart(6) + '  segments on the English page that are NOWHERE on its twin (' + N(tot('staleWords')) + ' words) - the twin is stale');
say('  ' + String(F.meta.length).padStart(6) + '  titles / meta descriptions present but still English');
say('  ' + String(F.untx.length).padStart(6) + '  body segments present but still English (' + N(tot('untxWords')) + ' words)');
say('  ' + String(F.leaves.length).padStart(6) + '  segments the catalog deliberately keeps in English (' + N(tot('leafWords')) + ' words: wordmark, ticker rails, code)');
say('');
say('CATALOG PASS - ' + N(cTotal) + ' unique strings: ' + N(cDone) + ' translated, ' + N(cLeaf) + ' kept English on purpose, ' + N(F.empty.length) + ' empty');
say('  ' + String(F.leak.length).padStart(6) + '  half-translated (English words left inside the Spanish)');
say('  ' + String(F.money.length).padStart(6) + '  A MONEY AMOUNT IN THE ENGLISH IS MISSING FROM THE SPANISH');
say('  ' + String(F.magni.length).padStart(6) + '  magnitude false friends (billon / trillon)');
say('  ' + String(F.tags.length).padStart(6) + '  inline tags or link targets changed by the translation');
say('  ' + String(F.ph.length).padStart(6) + '  placeholder lost or invented');
say('  ' + String(F.num.length).padStart(6) + '  a number in the English is missing from the Spanish');
say('  ' + String(F.shortES.length).padStart(6) + '  translation under 55% the length of the original (a clause was probably dropped)');

const bad = perPage.filter(p => p.untxWords + p.staleWords > 0).sort((a, b) => (b.untxWords + b.staleWords) - (a.untxWords + a.staleWords));
say('');
say('WORST PAGES (' + bad.length + ' of ' + perPage.length + ')');
for (const p of bad.slice(0, 30)) say('  ' + String(p.pct).padStart(6) + '%  ' + String(p.staleWords).padStart(5) + ' stale  ' + String(p.untxWords).padStart(4) + ' english  ' + p.page);

const show = (name, arr, fmt, n) => {
  if (!arr.length) return;
  say(''); say(name.toUpperCase() + ' (' + arr.length + (arr.length > (n || 25) ? ', first ' + (n || 25) : '') + ')');
  arr.slice(0, n || 25).forEach(x => say('  ' + fmt(x)));
};
show('english pages with no spanish twin', F.miss, x => x.page, 40);
show('titles and meta still in english', F.meta, x => x.page + ' ' + x.where + (x.known ? '' : ' [NOT in catalog]') + '\n      ' + x.en, 40);
show('body segments still in english', F.untx, x => x.page + ' ' + x.where + (x.known ? '' : ' [NOT in catalog]') + '\n      ' + x.en, 50);
show('money amounts lost', F.money, x => x.where + ' (x' + x.n + ') lost ' + x.lost.join(' ') + '\n      EN ' + x.en + '\n      ES ' + x.es, 30);
show('magnitude false friends', F.magni, x => x.where + ' — ' + x.say + '\n      EN ' + x.en + '\n      ES ' + x.es, 40);
show('half-translated', F.leak, x => x.where + ' (x' + x.n + ') english left: ' + x.words.join(' ') + '\n      EN ' + x.en + '\n      ES ' + x.es, 40);
show('numbers lost', F.num, x => x.where + ' (x' + x.n + ') lost ' + x.lost.join(' ') + '\n      EN ' + x.en + '\n      ES ' + x.es, 30);
show('placeholders', F.ph, x => x.where + ' — EN ' + x.en + ' / ES ' + x.es + '\n      ' + x.text, 30);
show('inline tags changed', F.tags, x => x.where + '\n      "' + x.text + '"\n      EN ' + x.en + '\n      ES ' + x.es, 25);
show('suspiciously short', F.shortES, x => x.where + ' (' + x.ratio + 'x)\n      EN ' + x.en + '\n      ES ' + x.es, 25);
show('empty translations', F.empty, x => x.where + ' — ' + x.en, 20);

const byPage = {};
F.stale.forEach(s => { byPage[s.page] = byPage[s.page] || { n: 0, w: 0, hasTx: 0, ex: [] }; const b = byPage[s.page]; b.n++; b.w += s.words; if (s.hasTx) b.hasTx++; if (b.ex.length < 3) b.ex.push(s.en.slice(0, 100)); });
const stalePages = Object.entries(byPage).sort((a, b) => b[1].w - a[1].w);
if (stalePages.length) {
  say(''); say('STALE TWINS (' + stalePages.length + ' pages carry English content that is nowhere on the Spanish page)');
  for (const [p, b] of stalePages) {
    say('  ' + p + ' — ' + b.n + ' segments, ' + N(b.w) + ' words' + (b.hasTx ? ' (' + b.hasTx + ' already have a translation in the catalog - the page just was not regenerated)' : ' (none translated yet)'));
    b.ex.forEach(e => say('        ' + e));
  }
}

// HARD DEFECTS FAIL THE RUN, so this can be a gate and not just a reading. A lost money amount, a lost
// placeholder and a magnitude false friend are all wrong on their face - no judgement needed. Stale twins and
// untranslated strings are WORK, not defects, and never fail it.
const hard = F.money.length + F.ph.length + F.magni.length;
if (hard) { say(''); say('FAIL: ' + hard + ' hard defect' + (hard > 1 ? 's' : '') + ' (money / placeholder / magnitude). These are wrong, not merely untranslated.'); process.exitCode = 1; }

if (JSONOUT) {
  fs.writeFileSync(JSONOUT, JSON.stringify({ generated: new Date().toISOString(), pairs, perPage, catalog: { total: cTotal, translated: cDone, leaves: cLeaf }, findings: F }, null, 1));
  say(''); say('full finding set written to ' + JSONOUT);
}
