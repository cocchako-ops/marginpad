/* ONE STORE FOR EVERY STRING A SCRIPT WRITES (2026-10-31, owner: "ako otvorim advanced tab nista nije prevedeno").
   The dictionaries lived INLINE in each bundle and each helper asked `lang === "es"`, so Portuguese and German had no script layer at all while gen-pages printed 100% for the static HTML,
   and every English reader downloaded 160 KB of Spanish. Now:
     build/data/i18n/strings.json  {"<English>": {es, pt, de}}, one row per distinct English string, so one sentence is translated once and reads the same everywhere
     build/data/i18n/dicts.json    {"<dict>": {"<key>": "<English>"}}, dict = the slug of __esT_<dict>; "V:<dict>" = a value table keyed by the English itself
     dist/assets/ui-<lang>.js      core: what every page can need (nav, account, profile, chat)
     dist/assets/ui-<lang>-app.js  the terminal, charts, heatmap, screener, calculators
   A bundle holds `var __esD_x = {};` and its helper reads window.__mpUI, written by those files, which es/gen-pages puts in the head of the twins alone. A page's own dict is filled into its twin.
   Run: node build/i18n/ui.js extract   move any inline dictionary into the store and empty it (idempotent; run after es/i18n-bundle.js --apply and after regenerating a page)
        node build/i18n/ui.js build     write dist/assets/ui-*.js
        node build/i18n/ui.js status    what is missing per language
        node build/i18n/ui.js chunks [n] untranslated strings into build/data/i18n/chunks/<lang>-NNN.json ; sidecars <lang>-NNN.tr.json = [{id, t}]
        node build/i18n/ui.js merge     validated sidecars into strings.json */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = path.join(__dirname, '..', '..'), DIST = path.join(R, 'dist'), DATA = path.join(R, 'build/data/i18n'), CH = path.join(DATA, 'chunks');
const LANGS = require('./langs.js').TWINS, CORE = ['mpnav', 'mpauth', 'mpprofile', 'mptrade'];
const SKIP = new Set(['assets', 'i18n', 'sdk', 'og', 'img', 'fonts', 'es', 'pt', 'de', 'fr', 'nl', 'ru', 'tr', 'id', 'zh', 'ja', 'ko', 'ar', 'sr']);
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const idOf = (en) => crypto.createHash('sha1').update(en).digest('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
fs.mkdirSync(CH, { recursive: true });
function files() {
  const out = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!(d === DIST && SKIP.has(e.name))) walk(p); } else if (/\.html$/.test(e.name)) out.push(p); } };
  walk(DIST);
  for (const f of fs.readdirSync(path.join(DIST, 'assets'))) if (/\.js$/.test(f) && !/^ui-/.test(f)) out.push(path.join(DIST, 'assets', f));
  return out.filter((f) => !/[\\/]app-[a-z]{2}\.html$/.test(f));
}
function objEnd(s, i) { let d = 0, q = false; for (let j = i; j < s.length; j++) { const c = s[j]; if (q) { if (c === '\\') j++; else if (c === '"') q = false; } else if (c === '"') q = true; else if (c === '{') d++; else if (c === '}') { d--; if (!d) return j + 1; } } return -1; }
function unq(lit) { try { return new Function('return ' + lit)(); } catch (e) { return null; } }
const CALL = /__esT_(\w+)\(\s*"(\w+)"\s*,\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g;
function extract() {
  const strings = read(path.join(DATA, 'strings.json'), {}), dicts = read(path.join(DATA, 'dicts.json'), {}); let moved = 0, rewritten = 0;
  const addS = (en, l, t) => { if (en == null) return; strings[en] = strings[en] || {}; if (l && t != null && !strings[en][l]) strings[en][l] = t; };
  for (const f of files()) {
    let s = fs.readFileSync(f, 'utf8'); if (s.indexOf('__esD_') < 0 && s.indexOf('__esVD_') < 0 && s.indexOf('__esT_') < 0) continue;
    const orig = s, local = {};
    for (const m of s.matchAll(CALL)) { const en = unq(m[3]); if (en == null) continue; if (local[m[1]] && local[m[1]][m[2]] != null && local[m[1]][m[2]] !== en) console.log('KEY COLLISION', m[1], m[2], JSON.stringify(en).slice(0, 70)); (local[m[1]] = local[m[1]] || {})[m[2]] = en; dicts[m[1]] = dicts[m[1]] || {}; dicts[m[1]][m[2]] = en; addS(en); }
    // a page may alias the helper (var T=__esT_x) and call T("key",'English'): those keys are real dictionary keys too
    for (const al of s.matchAll(/(?:var |,|;)\s*([A-Za-z_$][\w$]*)\s*=\s*__esT_(\w+)\s*[;,]/g)) {
      if (al[1].indexOf('__es') === 0) continue;
      const re = new RegExp('(?:^|[^\\w$.])' + al[1].split('$').join('\\$') + '\\(\\s*"(\\w+)"\\s*,\\s*(\'(?:[^\'\\\\\\n]|\\\\.)*\'|"(?:[^"\\\\\\n]|\\\\.)*")', 'g');
      for (const m of s.matchAll(re)) {
        const en = unq(m[2]); if (en == null) continue;
        if (local[al[2]] && local[al[2]][m[1]] != null && local[al[2]][m[1]] !== en) console.log('KEY COLLISION', al[2], m[1]);
        local[al[2]] = local[al[2]] || {}; local[al[2]][m[1]] = en;
        dicts[al[2]] = dicts[al[2]] || {}; dicts[al[2]][m[1]] = en; addS(en);
      }
    }
    // inline tables: the es value goes to the store, the table is emptied
    for (const kind of ['esD', 'esVD']) {
      const re = new RegExp('var __' + kind + '_(\\w+)\\s*=\\s*\\{', 'g'); let m;
      while ((m = re.exec(s))) {
        const open = m.index + m[0].length - 1, end = objEnd(s, open); if (end < 0) throw new Error('unterminated dict in ' + f);
        const name = m[1]; let tab; try { tab = JSON.parse(s.slice(open, end)); } catch (e) { tab = new Function('return ' + s.slice(open, end))(); }
        for (const k of Object.keys(tab)) {
          if (kind === 'esVD') { dicts['V:' + name] = dicts['V:' + name] || {}; dicts['V:' + name][k] = k; addS(k, 'es', tab[k]); moved++; }
          else { const en = (dicts[name] || {})[k]; if (en != null) { addS(en, 'es', tab[k]); moved++; } }
        }
        s = s.slice(0, open) + '{}' + s.slice(end); re.lastIndex = open + 2;
      }
    }
    s = s.replace(/if \(\(document\.documentElement\.lang \|\| ""\)\.slice\(0, 2\)\.toLowerCase\(\) === "es" && __esD_(\w+)\[k\] != null\) return __esD_\1\[k\];/g, (x, n) => 'var d = (window.__mpUI && window.__mpUI.' + n + ') || __esD_' + n + '; if (d[k] != null) return d[k];');
    s = s.replace(/if\(\(document\.documentElement\.lang\|\|""\)\.slice\(0,2\)\.toLowerCase\(\)==="es"&&__esVD_(\w+)\[s\]!=null\)return __esVD_\1\[s\];/g, (x, n) => 'var d=(window.__mpUI&&window.__mpUI["V:' + n + '"])||__esVD_' + n + ';if(d[s]!=null)return d[s];');
    if (s !== orig) { fs.writeFileSync(f + '.tmp', s); fs.renameSync(f + '.tmp', f); rewritten++; }
  }
  fs.writeFileSync(path.join(DATA, 'strings.json'), JSON.stringify(strings, null, 0));
  fs.writeFileSync(path.join(DATA, 'dicts.json'), JSON.stringify(dicts, null, 0));
  console.log('files rewritten', rewritten, 'es values moved', moved, 'dicts', Object.keys(dicts).length, 'strings', Object.keys(strings).length);
}
const tableOf = (name, dicts, strings, l) => { const t = {}, d = dicts[name] || {}; for (const k of Object.keys(d)) { const v = (strings[d[k]] || {})[l]; if (v) t[k] = v; } return t; };
function pageDict(name, lang) { const dicts = read(path.join(DATA, 'dicts.json'), {}), strings = read(path.join(DATA, 'strings.json'), {}); return tableOf(name, dicts, strings, lang); }
/* every pattern row with its gate: the longest literal run of the English, checked with indexOf before the regex runs */
function gateOf(re) { const lit = String(re).replace(/\\[dDsSwW]/g, '\u0000').replace(/\\(.)/g, '$1').split(/[()\[\]{}*+?|^$.\u0000]/); return lit.reduce((a, x) => (x.length > a.length ? x : a), '').trim(); }
function patRows(l) { let walk = []; try { walk = JSON.parse(fs.readFileSync(path.join(DATA, 'patterns-walk.json'), 'utf8')); } catch (e) {} return require('./patterns.js').concat(walk).filter((p) => p[l]).map((p) => [p.re, p[l], gateOf(p.re)]); }
function build() {
  const dicts = read(path.join(DATA, 'dicts.json'), {}), strings = read(path.join(DATA, 'strings.json'), {});
  const bundles = new Set(); for (const f of fs.readdirSync(path.join(DIST, 'assets'))) { if (!/\.js$/.test(f) || /^ui-/.test(f)) continue; const t = fs.readFileSync(path.join(DIST, 'assets', f), 'utf8'); for (const m of t.matchAll(/var __esD_(\w+)\s*=/g)) bundles.add(m[1]); }
  for (const l of LANGS) {
    const core = {}, app = {};
    for (const b of bundles) (CORE.indexOf(b) >= 0 ? core : app)[b] = tableOf(b, dicts, strings, l);
    const rt = fs.readFileSync(path.join(R, 'build/i18n/dom-runtime.js.txt'), 'utf8'), byEn = (n) => { const t = {}; for (const en of Object.keys(dicts[n] || {})) { const v = (strings[en] || {})[l]; if (v && v !== en) t[en] = v; } return t; };
    fs.writeFileSync(path.join(DIST, 'assets', 'ui-' + l + '.js'), 'window.__mpUI=' + JSON.stringify(core) + ';window.__mpDom=' + JSON.stringify(Object.assign(byEn('dom'), byEn('domapp'))) + ';window.__mpDomRe=' + JSON.stringify(patRows(l)) + ';\n' + rt);
    fs.writeFileSync(path.join(DIST, 'assets', 'ui-' + l + '-app.js'), 'Object.assign(window.__mpUI=window.__mpUI||{},' + JSON.stringify(app) + ');\n');
    console.log(l, 'core', fs.statSync(path.join(DIST, 'assets', 'ui-' + l + '.js')).size, 'app', fs.statSync(path.join(DIST, 'assets', 'ui-' + l + '-app.js')).size);
  }
}
/* dom [--scan]: strings that reach the page as markup inside a JS string, or that the browser scan found on screen. They go in dict "dom" (every twin) or "domapp" (the tool routes), keyed by the English, and are filled from the catalogs where a segment already says the same thing. */
const NOISE = /^(MarginPad|MARGINPAD|Bybit|Binance|OKX|Bitget|BingX|MEXC|Moon|Fomo|Hyperliquid|Coinbase|Kraken|KuCoin|Gate|TradingView|Koinly|3Commas|Cloudflare|Telegram|Instagram|Bitcoin|Ethereum|Solana|BTC|ETH|SOL|XRP|USDT|USD|XP|API|PnL|ROE|ROI|RSI|MACD|EMA|SMA|ATR|VWAP|English|Espa\u00f1ol|Portugu\u00eas|Fran\u00e7ais|Deutsch|T\u00fcrk\u00e7e|Indonesia|Srpski|Nederlands)$/;
function plainTr(items, l) { const m = {}; for (const v of Object.values(items)) { if (!v[l] || v.leaf || /</.test(v.en)) continue; m[v.en.replace(/&amp;/g, '&').trim()] = v[l].replace(/&amp;/g, '&').trim(); } return m; }
function dom(useScan) {
  const strings = read(path.join(DATA, 'strings.json'), {}), dicts = read(path.join(DATA, 'dicts.json'), {}); dicts.dom = dicts.dom || {}; dicts.domapp = dicts.domapp || {};
  const APP = /^(home|mp-charts|mp-mcharts|mp-heatmap|mp-screener|mp-calc)/, seen = {}; let added = 0;
  const put = (en, app) => { en = String(en).replace(/\s+/g, ' ').trim(); if (en.length < 2 || en.length > 300 || !/[A-Za-z]{2}/.test(en) || NOISE.test(en) || /^[\d\s$.,:%+\-x\/()#]+$/.test(en) || /[{}]|\\|=>|function|&&/.test(en)) return; if (seen[en]) { if (!app) seen[en] = 'core'; return; } seen[en] = app ? 'app' : 'core'; };
  for (const f of fs.readdirSync(path.join(DIST, 'assets'))) {
    if (!/\.js$/.test(f) || /^(ui-|lightweight|sentry|i18n|pwa|sw|mp-strat)/.test(f)) continue;
    const t = fs.readFileSync(path.join(DIST, 'assets', f), 'utf8'), app = APP.test(f);
    for (const m of t.matchAll(/>([^<>'"`{}=+]{2,120})</g)) put(m[1].replace(/\\u2019/g, '\u2019').replace(/\\u2014/g, '\u2014').replace(/&amp;/g, '&'), app);
    for (const m of t.matchAll(/\b(?:placeholder|title|aria-label)=\\?"([^"\\<>{}+]{3,120})\\?"/g)) put(m[1], app);
  }
  if (useScan) { const d = path.join(R, 'build/data/i18n-scan'); if (fs.existsSync(d)) for (const n of fs.readdirSync(d)) { const j = read(path.join(d, n), { english: [] }); if (j.key === 'api') continue; for (const e of j.english) put(e, /^(paper|trades|charts|heatmap|screener|calc)$/.test(j.key)); } }
  const cats = {}; for (const l of LANGS) { const c = read(path.join(R, 'build/data', l, 'catalog.json'), { items: {} }).items; cats[l] = plainTr(c, l); }
  for (const en of Object.keys(seen)) {
    if (dicts.dom[en] || dicts.domapp[en]) continue;
    (seen[en] === 'app' ? dicts.domapp : dicts.dom)[en] = en; strings[en] = strings[en] || {}; added++;
    for (const l of LANGS) if (!strings[en][l] && cats[l][en]) strings[en][l] = cats[l][en];
  }
  fs.writeFileSync(path.join(DATA, 'strings.json'), JSON.stringify(strings, null, 0)); fs.writeFileSync(path.join(DATA, 'dicts.json'), JSON.stringify(dicts, null, 0));
  console.log('dom strings added', added, 'core', Object.keys(dicts.dom).length, 'app', Object.keys(dicts.domapp).length);
}
function status() { const s = read(path.join(DATA, 'strings.json'), {}), n = Object.keys(s).length; for (const l of LANGS) { const miss = Object.keys(s).filter((e) => !s[e][l]); console.log(l, n - miss.length, 'of', n, 'missing', miss.length, 'words', miss.reduce((a, e) => a + e.split(/\s+/).length, 0)); } }
function chunks(size) {
  const s = read(path.join(DATA, 'strings.json'), {}), usedBy = {}; const dicts = read(path.join(DATA, 'dicts.json'), {});
  for (const d of Object.keys(dicts)) for (const k of Object.keys(dicts[d])) (usedBy[dicts[d][k]] = usedBy[dicts[d][k]] || []).push(d);
  for (const f of fs.readdirSync(CH)) if (!/\.tr\.json$/.test(f)) fs.unlinkSync(path.join(CH, f));
  const CODE = /^[\/?#.]|[a-z]_[a-z]|\w\|\|?\w|^[a-z]+\.[a-z]+$|^\$ |^curl |^pip |^npm |[{};=]|\(\)/; for (const e of Object.keys(s)) if (CODE.test(e)) for (const l of LANGS) if (!s[e][l]) s[e][l] = e;
  fs.writeFileSync(path.join(DATA, 'strings.json'), JSON.stringify(s, null, 0));
  for (const l of LANGS) { const miss = Object.keys(s).filter((e) => !s[e][l]); let n = 0; for (let i = 0; i < miss.length; i += size) { n++; fs.writeFileSync(path.join(CH, l + '-' + String(n).padStart(3, '0') + '.json'), JSON.stringify(miss.slice(i, i + size).map((e) => ({ id: idOf(e), where: (usedBy[e] || []).slice(0, 3).join(','), en: e })), null, 0)); } console.log(l, miss.length, 'strings', n, 'chunks'); }
}
const nums = (t) => (String(t).replace(/&#?[a-z0-9]+;/gi, '').match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/[.,]/g, '')).sort().join(' ');
const tags = (t) => (String(t).match(/<\/?[a-z][^>]*>/gi) || []).map((x) => x.toLowerCase().replace(/\s+/g, ' ')).sort().join('');
const pads = (t) => [/^\s*/.exec(t)[0].length, /\s*$/.exec(t)[0].length].join();
function merge() {
  const s = read(path.join(DATA, 'strings.json'), {}), byId = {}; for (const e of Object.keys(s)) byId[idOf(e)] = e; let ok = 0, bad = 0;
  for (const f of fs.readdirSync(CH)) {
    const m = /^([a-z]{2})-\d+\.tr\.json$/.exec(f); if (!m) continue; const l = m[1];
    for (const x of read(path.join(CH, f), [])) {
      const en = byId[x.id]; if (!en || typeof x.t !== 'string' || !x.t.trim()) { bad++; continue; }
      const why = nums(en) !== nums(x.t) ? 'numbers' : tags(en) !== tags(x.t) ? 'tags' : (String(x.t).match(/\$\{|\{\w+\}/g) || []).sort().join() !== (en.match(/\$\{|\{\w+\}/g) || []).sort().join() ? 'placeholders' : '';
      if (why) { bad++; console.log(l, why, JSON.stringify(en).slice(0, 80), '=>', JSON.stringify(x.t).slice(0, 80)); continue; }
      s[en][l] = x.t; ok++;
    }
  }
  fs.writeFileSync(path.join(DATA, 'strings.json'), JSON.stringify(s, null, 0)); console.log('merged', ok, 'refused', bad);
}
module.exports = { pageDict, LANGS };
if (require.main === module) { const c = process.argv[2]; if (c === 'extract') extract(); else if (c === 'build') build(); else if (c === 'status') status(); else if (c === 'chunks') chunks(+process.argv[3] || 120); else if (c === 'merge') merge(); else if (c === 'dom') dom(process.argv.includes('--scan')); else console.log('extract | build | status | chunks [n] | merge'); }
