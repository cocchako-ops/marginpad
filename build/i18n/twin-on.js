/* SWITCH A TWIN LANGUAGE ON (2026-11-06). The live list lives in exactly two literals, both written here:
     src/worker.js            const TWIN_ON = [...]      (router, SSR words, sitemaps, IndexNow)
     dist/assets/mp-nav.js    var _TWIN = {...}          (language switch keeps the path, reader with mp_lang goes to the twin)
   and build/build.js gets the generator step. Then run, in order:
     node build/i18n/worker-twins.js inject && node build/i18n/ui.js build
     node build/es/gen-pages.js --lang <L>   (then once more for every other twin, so their hreflang lists the new one)
     node build/bump-home-assets.js && node build/check-home-hash.js && npm run deploy
   node build/i18n/twin-on.js fr [--dry]          node build/i18n/twin-on.js --prep   (one-time: make mp-nav read _TWIN only) */
'use strict';
const fs = require('fs'), path = require('path'), R = path.join(__dirname, '..', '..');
const W = path.join(R, 'src/worker.js'), N = path.join(R, 'dist/assets/mp-nav.js'), B = path.join(R, 'build/build.js');
const dry = process.argv.includes('--dry');
const put = (f, s) => { if (dry) return; const t = f + '.tmp'; fs.writeFileSync(t, s); fs.renameSync(t, f); };
function one(s, a, b, what) { const n = s.split(a).length - 1; if (n !== 1) throw new Error(what + ': anchor x' + n); return s.split(a).join(b); }
if (process.argv.includes('--prep')) {
  let n = fs.readFileSync(N, 'utf8');
  if (n.indexOf('/* @TWINS */') >= 0) { console.log('mp-nav already prepared'); process.exit(0); }
  n = one(n, "  var _LANG_HOME = { fr: 1, ru: 1, tr: 1, zh: 1, ja: 1, ko: 1, ar: 1, id: 1, nl: 1 }; // pt and de left this list 2026-10-29: twins (keep the path) like /es/\n  var _TWIN = { es: 1, pt: 1, de: 1 };\n  function _twinOf(p) { var m = p.match(/^\\/(es|pt|de)(\\/|$)/); return m ? m[1] : ''; }",
    "  /* @TWINS */ var _TWIN = { es: 1, pt: 1, de: 1 }; // the live twin languages - written by build/i18n/twin-on.js, nowhere else\n  var _LANG_HOME = {}; ['es', 'pt', 'de', 'fr', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id', 'nl'].forEach(function (l) { if (!_TWIN[l]) _LANG_HOME[l] = 1; }); // a language with only a homepage\n  function _twinOf(p) { var m = p.match(/^\\/([a-z]{2})(\\/|$)/); return m && _TWIN[m[1]] ? m[1] : ''; }", 'mp-nav twin block');
  n = one(n, "/^\\/(fr|ru|tr|zh|ja|ko|ar|id|nl)\\//.test(p)", "_LANG_HOME[(p.match(/^\\/([a-z]{2})\\//) || [])[1]]", 'mp-nav esRedirect');
  put(N, n); console.log(dry ? 'would prepare mp-nav' : 'mp-nav prepared'); process.exit(0);
}
const L = process.argv[2]; const { LANGS } = require('./langs.js');
if (!LANGS[L]) throw new Error('unknown language ' + L);
let w = fs.readFileSync(W, 'utf8'); const m = w.match(/const TWIN_ON = \[([^\]]*)\];/); if (!m) throw new Error('TWIN_ON');
const on = m[1].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean);
if (on.indexOf(L) < 0) { on.push(L); w = w.replace(m[0], 'const TWIN_ON = [' + on.map((x) => "'" + x + "'").join(', ') + '];'); put(W, w); }
let n = fs.readFileSync(N, 'utf8'); const t = n.match(/\/\* @TWINS \*\/ var _TWIN = \{([^}]*)\};/); if (!t) throw new Error('run --prep first');
const tw = t[1].split(',').map((x) => x.trim().split(':')[0]).filter(Boolean);
if (tw.indexOf(L) < 0) { tw.push(L); n = n.replace(t[0], '/* @TWINS */ var _TWIN = { ' + tw.map((x) => x + ': 1').join(', ') + ' };'); put(N, n); }
let b = fs.readFileSync(B, 'utf8'); const step = "run('" + LANGS[L].name + " site (/" + L + "/ twins)', 'node build/es/gen-pages.js --lang " + L + "');";
if (b.indexOf(step) < 0) { b = one(b, "\nprocess.stdout.write('\\n Build complete.", '\n' + step + "\nprocess.stdout.write('\\n Build complete.", 'build.js tail'); put(B, b); }
console.log((dry ? 'would switch on ' : 'switched on ') + L + ' | worker TWIN_ON: ' + on.join(',') + ' | mp-nav _TWIN: ' + tw.join(','));
