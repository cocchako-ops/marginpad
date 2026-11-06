/* One-shot refactor (2026-11-06): the worker's per-twin branches (lang === 'pt' ? ... : lang === 'de' ? ...) become reads
   of TW[lang] + TWIN_ON. Refuses unless every anchor is found exactly once. Idempotent via the @TW-START marker.
   node build/i18n/worker-twins-refactor.js [--dry]  then  node build/i18n/worker-twins.js inject */
'use strict';
const fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..', '..', 'src', 'worker.js');
let s = fs.readFileSync(W, 'utf8');
if (s.indexOf('/* @TW-START */') >= 0) { console.log('already refactored'); process.exit(0); }
const NL = s.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
function one(a, b) { const n = s.split(a).length - 1; if (n !== 1) throw new Error('anchor x' + n + ': ' + a.slice(0, 90)); s = s.split(a).join(b); }
// 1. the constants block: from the PORTUGUESE comment to the end of COMP_FRAG_L
const A = s.indexOf('// PORTUGUESE (2026-10-29): the same sentences for the /pt/ twin.');
const Bm = 'const COMP_FRAG_L = { es: null /* esCompFrag, set below */, pt: ptCompFrag };';
const B = s.indexOf(Bm);
if (A < 0 || B < A || s.indexOf(Bm, B + 1) >= 0) throw new Error('block anchors');
const BLOCK = [
  '/* TWIN LANGUAGES (2026-11-06, owner: "idemo u 100% prevod svega"): every twin but Spanish reads the words the worker',
  '   writes from ONE object per language, TW[lang], generated from build/data/<lang>/worker.json by',
  '   `node build/i18n/worker-twins.js inject` - never edit the literal by hand. TWIN_ON is the list of twins that are LIVE',
  '   (pages in dist, served by the router, in the language switch); a language is switched on there and nowhere else. */',
  '/* @TW-START */',
  'const TW = {};',
  '/* @TW-END */',
  "const TWIN_ON = ['es', 'pt', 'de'];",
  "const TWIN_RE = new RegExp('^\\\\/(' + TWIN_ON.join('|') + ')(\\\\/|$)');",
  "const TWIN_SUB_RE = new RegExp('^\\\\/(' + TWIN_ON.join('|') + ')\\\\/.');",
  'for (const l of Object.keys(TW)) if (TW[l].susd) _SUSD_W[l] = TW[l].susd;',
  'const SSR_L = { es: SSR_ES }; for (const l of Object.keys(TW)) SSR_L[l] = TW[l].ssr;',
  'function ssrLInit() { return SSR_L; }',
  'function twMisc(lang, k, en) { const T = TW[lang]; return (T && T.misc && T.misc[k]) || en; }',
  '// The map panel and the hub box: four sentences that carry a coin or an amount, then literal pairs applied in order.',
  'function twMapFrag(lang) {',
  '  const T = TW[lang]; if (!T) return (x => x);',
  '  return function (s) {',
  "    s = String(s || '');",
  "    s = s.replace(/Open the live ([A-Z0-9]+) heatmap/g, (m, c) => T.mapFrag.openHeatmap.split('{c}').join(c));",
  "    s = s.replace(/Trade ([A-Z0-9]+) on Bybit/g, (m, c) => T.mapFrag.tradeOn.split('{c}').join(c));",
  "    s = s.replace(/^(.+?) of ([A-Z0-9]+) positions hit this map in the past 24 hours - /, (m, t, c) => T.mapFrag.hitMap.split('{t}').join(t).split('{c}').join(c));",
  "    s = s.replace(/^The ([A-Z0-9]+) map has been quiet - under \\$50K liquidated in the past 24 hours\\./, (m, c) => T.mapFrag.quiet.split('{c}').join(c));",
  '    for (const [a, b] of T.mapPairs) s = s.split(a).join(b);',
  '    return s;',
  '  };',
  '}',
  '// The competition box: pairs first ("Right now it is <b>" keeps its <b>), then "day X of Y" inside that <b>.',
  'function twCompFrag(lang) {',
  '  const T = TW[lang]; if (!T) return (x => x);',
  "  return function (s) { s = String(s || ''); for (const [a, b] of T.compPairs) s = s.split(a).join(b); s = s.replace(/(<b>)day (\\d+) of (\\d+)(<\\/b>)/g, (m, o, x, y, c) => o + T.compFrag.dayOf.split('{x}').join(x).split('{y}').join(y) + c); return s.split('on the line this season, free to enter').join(T.compFrag.onTheLine); };",
  '}',
].join(NL);
s = s.slice(0, A) + BLOCK + s.slice(B + Bm.length);
// 2. twinLangOf reads the live list
one("function twinLangOf(request) { try { const m = new URL(request.url).pathname.match(/^\\/(es|pt|de)(\\/|$)/); return m ? m[1] : 'en'; } catch (e) { return 'en'; } }",
    "function twinLangOf(request) { try { const m = new URL(request.url).pathname.match(TWIN_RE); return m ? m[1] : 'en'; } catch (e) { return 'en'; } }");
// 3. the coin table
one("const TBL = lang === 'pt' ? SSR_TBL_PT : lang === 'de' ? SSR_TBL_DE : lang === 'es' ? SSR_TBL_ES : null;",
    "const TBL = lang === 'es' ? SSR_TBL_ES : (TW[lang] && TW[lang].tbl) || null;");
// 4. the ask pages
one("const lang = (es === 'pt' || es === 'de') ? es : es ? 'es' : 'en'; es = lang === 'es';",
    "const lang = (typeof es === 'string' && TW[es]) ? es : es ? 'es' : 'en'; es = lang === 'es';");
one("const _AT = lang === 'de' ? ASK_DE : ASK_PT;", "const _AT = (TW[lang] && TW[lang].ask) || {};");
one("const T = (en, sp) => ((lang === 'pt' || lang === 'de') ?", "const T = (en, sp) => (TW[lang] ?");
one("const stamp = t => (lang === 'pt' ? 'Medido ' : lang === 'de' ? 'Gemessen ' : es ? 'Medido ' : 'Measured ')",
    "const stamp = t => (TW[lang] ? twMisc(lang, 'measured', 'Measured ') : es ? 'Medido ' : 'Measured ')");
one("const _tla = twinLangOf(request); const _esAsk = (_tla === 'pt' || _tla === 'de') ? _tla :",
    "const _tla = twinLangOf(request); const _esAsk = TW[_tla] ? _tla :");
// 5. the competition box
one("  else if (twinLangOf(request) === 'pt') H = ptCompFrag(H);" + NL + "  else if (twinLangOf(request) === 'de') H = deCompFrag(H);",
    "  else if (TW[twinLangOf(request)]) H = twCompFrag(twinLangOf(request))(H);");
// 6. the map pages and the hub box
one("const esBox = (esLang(request) === 'es') ? esMapFrag : twinLangOf(request) === 'pt' ? ptMapFrag : twinLangOf(request) === 'de' ? deMapFrag : (x => x);",
    "const esBox = (esLang(request) === 'es') ? esMapFrag : twMapFrag(twinLangOf(request));");
one("if (mode === 'map' && (esLang(request) === 'es' || twinLangOf(request) === 'pt' || twinLangOf(request) === 'de')) {",
    "if (mode === 'map' && (esLang(request) === 'es' || TW[twinLangOf(request)])) {");
one("const FR = esLang(request) === 'es' ? esMapFrag : twinLangOf(request) === 'de' ? deMapFrag : ptMapFrag;",
    "const FR = esLang(request) === 'es' ? esMapFrag : twMapFrag(twinLangOf(request));");
// 7. the router
one("const _twm = url.pathname.match(/^\\/(es|pt|de)\\/./);", "const _twm = url.pathname.match(TWIN_SUB_RE);");
// 8. the community category names
one("return (l === 'es' ? COMM_CATS_ES[k] : l === 'pt' ? COMM_CATS_PT[k] : l === 'de' ? COMM_CATS_DE[k] : null) || COMM_CATS[k] || k; }",
    "return (l === 'es' ? COMM_CATS_ES[k] : (TW[l] && TW[l].cats) ? TW[l].cats[k] : null) || COMM_CATS[k] || k; }");
// 9. the calendar box: month names, the impact tag, the heading and its sub line
one("const es = esLang(request) === 'es', _cl = twinLangOf(request), pt = _cl === 'pt' || _cl === 'de';",
    "const es = esLang(request) === 'es', _cl = twinLangOf(request), pt = !!TW[_cl];");
{ const i = s.indexOf("  const MES = _cl === 'de' ? ['Jan', 'Feb', 'Mär'"), j = s.indexOf(NL, i); if (i < 0 || s.indexOf("  const MES = _cl === 'de'", i + 1) >= 0) throw new Error('MES');
  s = s.slice(0, i) + "  const MES = TW[_cl] ? TW[_cl].months : ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];" + s.slice(j); }
one("(_cl === 'de' ? 'HOHE AUSWIRKUNG' : es || pt ? 'ALTO IMPACTO' : 'HIGH IMPACT')", "(TW[_cl] ? twMisc(_cl, 'highImpact', 'HIGH IMPACT') : es ? 'ALTO IMPACTO' : 'HIGH IMPACT')");
one("(es ? 'Lo que viene' : 'What is coming up')", "(es ? 'Lo que viene' : twMisc(_cl, 'calUpcoming', 'What is coming up'))");
one(": 'Next ' + evs.length + ' scheduled events &middot; all times UTC &middot; updated ')",
    ": twMisc(_cl, 'calSub', 'Next {n} scheduled events &middot; all times UTC &middot; updated ').split('{n}').join(evs.length))");
// 10. the kicker over the liquidation boxes
{ const i = s.indexOf("    : twinLangOf(request) === 'pt'" + NL + "    ? (mode === 'lev' ? 'AO VIVO - '"), k = "    : (mode === 'lev' ? 'LIVE - ' + param + 'X RIGHT NOW'"; const j = s.indexOf(k, i);
  if (i < 0 || j < i || j - i > 800) throw new Error('kick');
  s = s.slice(0, i) + "    : TW[twinLangOf(request)]" + NL + "    ? (mode === 'lev' ? twMisc(twinLangOf(request), 'kickLev', 'LIVE - {p}X RIGHT NOW').split('{p}').join(param) : mode === 'excalc' ? twMisc(twinLangOf(request), 'kickEx', 'LIVE MARKET DATA') : twMisc(twinLangOf(request), 'kickCoin', 'LIVE {P} DATA').split('{P}').join(String(param).toUpperCase()))" + NL + s.slice(j); }
one("(esLang(request) === 'es' ? esMapFrag(hubBox) : twinLangOf(request) === 'pt' ? ptMapFrag(hubBox) : twinLangOf(request) === 'de' ? deMapFrag(hubBox) : hubBox)",
    "(esLang(request) === 'es' ? esMapFrag(hubBox) : twMapFrag(twinLangOf(request))(hubBox))");
// 11. the tool routes: title/description/canonical and the h1
one("(esSite ? (twinLang === 'pt' ? SPA_META_PT : twinLang === 'de' ? SPA_META_DE : SPA_META_ES) : SPA_META)",
    "(esSite ? (TW[twinLang] ? twSpaMeta(twinLang, SPA_META) : SPA_META_ES) : SPA_META)");
{ const i = s.indexOf("      const H1 = (esSite && twinLang === 'de'"), k = "        : esSite" + NL + "        ? { '/paper-trade': 'Paper trading de cripto a precio en vivo'"; const j = s.indexOf(k, i);
  if (i < 0 || j < i || j - i > 1500) throw new Error('H1');
  s = s.slice(0, i) + "      const H1 = (esSite && TW[twinLang] ? TW[twinLang].h1" + NL + s.slice(j); }
one("function twinLangOf(request) {", "function twSpaMeta(l, base) { const o = {}; for (const r of Object.keys(base)) { const t = TW[l].spaMeta && TW[l].spaMeta[r]; o[r] = t ? Object.assign({}, base[r], { title: t.title, desc: t.desc, canon: 'https://marginpad.io/' + l + r }) : base[r]; } return o; }" + NL + "function twinLangOf(request) {");
// 12. sitemaps, the retired-subpage 301, the old blog stubs, the trailing-slash tool routes
one("    if (url.pathname === '/sitemap-pt.xml') return condAsset(request, env, '/sitemap-pt.xml', 'application/xml; charset=utf-8', 21600);" + NL + "    if (url.pathname === '/sitemap-de.xml') return condAsset(request, env, '/sitemap-de.xml', 'application/xml; charset=utf-8', 21600);",
    "    { const _sm = url.pathname.match(/^\\/sitemap-([a-z]{2})\\.xml$/); if (_sm && _sm[1] !== 'es' && TWIN_ON.includes(_sm[1])) return condAsset(request, env, url.pathname, 'application/xml; charset=utf-8', 21600); }");
one("for (const p of ['/sitemap.xml', '/sitemap-es.xml', '/sitemap-pt.xml', '/sitemap-de.xml', '/sitemap-recaps.xml'])",
    "for (const p of ['/sitemap.xml'].concat(TWIN_ON.map(l => '/sitemap-' + l + '.xml'), ['/sitemap-recaps.xml']))");
one("const _I18N_SUB = url.pathname.match(/^\\/(ar|fr|id|ja|ko|nl|ru|tr|zh)\\/(.+)$/);",
    "const _I18N_SUB = !TWIN_ON.includes(url.pathname.split('/')[1]) && url.pathname.match(/^\\/(ar|fr|id|ja|ko|nl|ru|tr|zh)\\/(.+)$/);");
one("({ de: 1, pt: 1 }[_ol[2]] ? '/' + _ol[2] : '')", "(TWIN_ON.includes(_ol[2]) ? '/' + _ol[2] : '')");
one("const _as = url.pathname.match(/^(\\/(?:es|pt|de))?\\/(screener|paper-trade|charts|heatmap|calculators|swap)\\/$/);",
    "const _as = url.pathname.match(/^(\\/[a-z]{2})?\\/(screener|paper-trade|charts|heatmap|calculators|swap)\\/$/);");
if (process.argv.includes('--dry')) { console.log('dry run: all anchors found'); process.exit(0); }
const tmp = W + '.tmp'; fs.writeFileSync(tmp, s); fs.renameSync(tmp, W); console.log('refactored');
