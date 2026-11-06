/* THE WORKER'S OWN WORDS ON A TWIN PAGE, ONE FILE PER LANGUAGE (2026-11-06).
   The worker writes sentences into twin pages itself (SSR boxes, the coin table, the map panel, the competition box, the
   ask pages, the tool routes' title/description/h1, month names). Until today each twin language had its own hand-written
   constants and its own branch at every site (lang === 'pt' ? ... : lang === 'de' ? ...). Now:
     build/data/<lang>/worker.json  = one object per language (shape below)
     node build/i18n/worker-twins.js src     -> build/data/i18n/worker-src.json: the English source + pt/de/es references,
                                                 the input a translator works from
     node build/i18n/worker-twins.js export  -> writes build/data/pt/worker.json and de/worker.json out of today's worker
     node build/i18n/worker-twins.js inject  -> writes `const TW = {...}` between the TW markers in src/worker.js
   Shape: { susd:[trillion,billion,million], ssr:{}, tbl:{en:t}, mapPairs:[[en,t]], mapFrag:{openHeatmap,tradeOn,hitMap,quiet},
            compPairs:[[en,t]], compFrag:{dayOf,onTheLine}, cats:{id:t}, ask:{en:t}, spaMeta:{route:{title,desc}},
            h1:{route:t}, months:[12], misc:{measured,highImpact,calUpcoming,calSub,kickLev,kickEx,kickCoin} } */
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', '..'), W = path.join(R, 'src', 'worker.js');
const { TWINS } = require('./langs.js');
const src = () => fs.readFileSync(W, 'utf8');
function constOf(s, name) { // the literal after `const NAME =` up to its terminating `;` at depth 0
  const i = s.indexOf('const ' + name + ' = '); if (i < 0) throw new Error('no ' + name);
  let j = i + ('const ' + name + ' = ').length, d = 0, q = null;
  for (let k = j; k < s.length; k++) { const c = s[k];
    if (q) { if (c === '\\') { k++; continue; } if (c === q) q = null; continue; }
    if (c === '/' && s[k + 1] === '*') { k = s.indexOf('*/', k + 2) + 1; continue; }
    if (c === '/' && s[k + 1] === '/') { k = s.indexOf('\n', k); continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') d--; else if (c === ';' && d === 0) return eval('(' + s.slice(j, k) + ')'); }
  throw new Error('unterminated ' + name);
}
const EN = {
  susd: [' trillion', ' billion', ' million'],
  mapFrag: { openHeatmap: 'Open the live {c} heatmap', tradeOn: 'Trade {c} on Bybit', hitMap: '{t} of {c} positions hit this map in the past 24 hours - ', quiet: 'The {c} map has been quiet - under $50K liquidated in the past 24 hours.' },
  compFrag: { dayOf: 'day {x} of {y}', onTheLine: 'on the line this season, free to enter' },
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  misc: { measured: 'Measured ', highImpact: 'HIGH IMPACT', calUpcoming: 'What is coming up', calSub: 'Next {n} scheduled events &middot; all times UTC &middot; updated ', kickLev: 'LIVE - {p}X RIGHT NOW', kickEx: 'LIVE MARKET DATA', kickCoin: 'LIVE {P} DATA' },
  h1: { '/paper-trade': 'Crypto paper trading at live prices', '/calculators': 'Crypto futures calculators', '/charts': 'Multi-chart crypto workspace', '/screener': 'Crypto futures screener', '/heatmap': 'Live crypto liquidation heatmap', '/swap': 'Swap crypto' },
};
const H1 = {
  pt: { '/paper-trade': 'Paper trading de cripto a preço real', '/calculators': 'Calculadoras de futuros cripto', '/charts': 'Espaço multigráfico de cripto', '/screener': 'Screener de futuros cripto', '/heatmap': 'Mapa de calor de liquidações ao vivo', '/swap': 'Swap de cripto' },
  de: { '/paper-trade': 'Krypto Paper Trading zu Live-Preisen', '/calculators': 'Krypto-Futures-Rechner', '/charts': 'Multi-Chart-Workspace für Krypto', '/screener': 'Krypto-Futures-Screener', '/heatmap': 'Live-Liquidations-Heatmap für Krypto', '/swap': 'Krypto tauschen' },
};
const MISC = {
  pt: { measured: 'Medido ', highImpact: 'ALTO IMPACTO', calUpcoming: 'O que vem por aí', calSub: 'Próximos {n} eventos programados &middot; horários em UTC &middot; atualizado ', kickLev: 'AO VIVO - {p}X AGORA', kickEx: 'DADOS DE MERCADO AO VIVO', kickCoin: 'DADOS DE {P} AO VIVO' },
  de: { measured: 'Gemessen ', highImpact: 'HOHE AUSWIRKUNG', calUpcoming: 'Was als Nächstes kommt', calSub: 'Nächste {n} geplante Termine &middot; alle Zeiten in UTC &middot; aktualisiert ', kickLev: 'LIVE - {p}X JETZT', kickEx: 'LIVE-MARKTDATEN', kickCoin: '{P} LIVE-DATEN' },
};
const MONTHS = { pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'], de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] };
function spaMetaOf(s, name) { // the SPA_META objects sit inside a function body: read title/desc per route
  const i = s.indexOf('const ' + name + ' = {'); const j = s.indexOf('\n      };', i); const body = s.slice(i, j);
  const out = {}; const re = /'(\/[\w-]+)': \{[^\n]*?title: '((?:[^'\\]|\\.)*)', desc: '((?:[^'\\]|\\.)*)'/g; let m;
  while ((m = re.exec(body))) out[m[1]] = { title: m[2].replace(/\\'/g, "'"), desc: m[3].replace(/\\'/g, "'") };
  return out;
}
function exportLang(s, L, U) {
  const pairs = (a) => a.filter((p) => !/[^\x00-\x7f]/.test(p[0]));
  return {
    susd: constOf(s, '_SUSD_W')[L], ssr: constOf(s, 'SSR_' + U), tbl: constOf(s, 'SSR_TBL_' + U),
    mapPairs: pairs(constOf(s, 'SSR_MAP_' + U)), mapFrag: constOf(s, 'MAP_FRAG_' + U),
    compPairs: pairs(constOf(s, 'SSR_COMP_' + U)).map((p) => p[0] === 'Right now it is <b>day ' ? ['Right now it is <b>', p[1].replace(/[^\s>]+ $/, '')] : p),
    compFrag: constOf(s, 'COMP_FRAG_' + U), cats: constOf(s, 'COMM_CATS_' + U), ask: constOf(s, 'ASK_' + U),
    spaMeta: spaMetaOf(s, 'SPA_META_' + U), h1: H1[L], months: MONTHS[L], misc: MISC[L],
  };
}
const cmd = process.argv[2];
if (cmd === 'export') {
  const s = src();
  for (const [L, U] of [['pt', 'PT'], ['de', 'DE']]) { const o = exportLang(s, L, U); fs.writeFileSync(path.join(R, 'build/data', L, 'worker.json'), JSON.stringify(o, null, 1)); console.log(L, Object.keys(o).map((k) => k + ':' + (Array.isArray(o[k]) ? o[k].length : Object.keys(o[k] || {}).length)).join(' ')); }
} else if (cmd === 'src') {
  const s = src(), pt = JSON.parse(fs.readFileSync(path.join(R, 'build/data/pt/worker.json'), 'utf8')), de = JSON.parse(fs.readFileSync(path.join(R, 'build/data/de/worker.json'), 'utf8'));
  const enCats = constOf(s, 'COMM_CATS'), esSsr = constOf(s, 'SSR_ES'), esTbl = constOf(s, 'SSR_TBL_ES');
  const out = {
    _note: 'English source for the worker-written words on a twin page. Each field: en = what to translate (keys that are English ARE the source text), pt/de/es = existing translations for reference. ssr has no English source string - its pt/de/es values say the same sentence; {placeholders} must survive.',
    susd: { en: EN.susd, pt: pt.susd, de: de.susd, note: 'magnitude words for 10^12, 10^9, 10^6 with a leading space - beware false friends (Spanish billon = 10^12)' },
    ssr: Object.fromEntries(Object.keys(pt.ssr).map((k) => [k, { es: esSsr[k], pt: pt.ssr[k], de: de.ssr[k] }])),
    tbl: Object.fromEntries(Object.keys(pt.tbl).map((k) => [k, { pt: pt.tbl[k], de: de.tbl[k], es: esTbl[k] }])),
    mapPairs: pt.mapPairs.map(([en, t]) => ({ en, pt: t, de: (de.mapPairs.find((p) => p[0] === en) || [])[1] })),
    mapFrag: Object.fromEntries(Object.keys(EN.mapFrag).map((k) => [k, { en: EN.mapFrag[k], pt: pt.mapFrag[k], de: de.mapFrag[k] }])),
    compPairs: pt.compPairs.map(([en, t]) => ({ en, pt: t, de: (de.compPairs.find((p) => p[0] === en) || [])[1] })),
    compFrag: Object.fromEntries(Object.keys(EN.compFrag).map((k) => [k, { en: EN.compFrag[k], pt: pt.compFrag[k], de: de.compFrag[k] }])),
    cats: Object.fromEntries(Object.keys(enCats).map((k) => [k, { en: enCats[k], pt: pt.cats[k], de: de.cats[k] }])),
    ask: Object.fromEntries(Object.keys(pt.ask).map((k) => [k, { pt: pt.ask[k], de: de.ask[k] }])),
    spaMeta: Object.fromEntries(Object.keys(spaMetaOf(s, 'SPA_META')).map((r) => [r, { en: spaMetaOf(s, 'SPA_META')[r], pt: pt.spaMeta[r], de: de.spaMeta[r] }])),
    h1: Object.fromEntries(Object.keys(EN.h1).map((r) => [r, { en: EN.h1[r], pt: pt.h1[r], de: de.h1[r] }])),
    months: { en: EN.months, pt: pt.months, de: de.months },
    misc: Object.fromEntries(Object.keys(EN.misc).map((k) => [k, { en: EN.misc[k], pt: pt.misc[k], de: de.misc[k] }])),
  };
  fs.writeFileSync(path.join(R, 'build/data/i18n/worker-src.json'), JSON.stringify(out, null, 1)); console.log('worker-src.json written');
} else if (cmd === 'inject') {
  const TW = {};
  for (const L of TWINS) { if (L === 'es') continue; const f = path.join(R, 'build/data', L, 'worker.json'); if (fs.existsSync(f)) TW[L] = JSON.parse(fs.readFileSync(f, 'utf8')); }
  let s = src(); const A = '/* @TW-START */', B = '/* @TW-END */', i = s.indexOf(A), j = s.indexOf(B);
  if (i < 0 || j < i) throw new Error('TW markers missing');
  s = s.slice(0, i + A.length) + '\nconst TW = ' + JSON.stringify(TW) + ';\n' + s.slice(j);
  const tmp = W + '.tmp'; fs.writeFileSync(tmp, s); fs.renameSync(tmp, W); console.log('TW injected:', Object.keys(TW).join(' '));
} else console.log('src | export | inject');
