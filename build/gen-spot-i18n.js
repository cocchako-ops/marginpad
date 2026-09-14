/* Demo Spot i18n assembler + validator (2026-09-03).
     dist/spot/i18n/en.json          - source of truth for every UI string on /spot/ (flat {key: text})
     dist/spot/i18n/<lang>.json      - translations (hand/AI authored), same keys
     dist/spot/index.html            - carries the EN dictionary inline in <script type="application/json" id="spotI18n">
                                       (this script injects it) and fetches /spot/i18n/<lang>.json?v=<hash> for other languages
   What it does:
     1. injects en.json into the page's #spotI18n block;
     2. stamps the pack version (?v=<8-char hash of all packs>) into the page so the edge/browser cache turns over
        exactly when a pack changes;
     3. validates every pack: valid JSON, same key set as EN (missing keys fall back to English at runtime - reported),
        identical {placeholder} set per key, identical HTML tag sequence per key, no emoji, no "</script";
     4. coverage: every L('key') / data-t / data-th / data-tp key used by the page exists in EN; unused EN keys are reported.
   Run: node build/gen-spot-i18n.js   (--check = validate only, no writes; exit 1 on problems) */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST = path.join(__dirname, '..', 'dist');
const DIR = path.join(DIST, 'spot', 'i18n');
const PAGE = path.join(DIST, 'spot', 'index.html');
const LANGS = ['sr', 'es', 'de', 'fr', 'pt', 'nl', 'ru', 'tr', 'id', 'zh', 'ja', 'ko', 'ar'];
const CHECK_ONLY = process.argv.includes('--check');

const EN = JSON.parse(fs.readFileSync(path.join(DIR, 'en.json'), 'utf8'));
const enKeys = Object.keys(EN);
let problems = 0;
const bad = (m) => { problems++; console.error('  ' + m); };

const phSet = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(' ');
const tagSeq = (s) => (String(s).match(/<\/?[a-z][a-z0-9]*/gi) || []).map(t => t.toLowerCase()).join(' ');
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F900}-\u{1F9FF}]/u;

// ---- packs ----
const packHashes = [];
for (const lang of LANGS) {
  const f = path.join(DIR, lang + '.json');
  if (!fs.existsSync(f)) { console.log(lang.padEnd(3) + ' no file (page falls back to English)'); continue; }
  let raw = fs.readFileSync(f, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) bad(lang + ': BOM at start');
  let P;
  try { P = JSON.parse(raw); } catch (e) { bad(lang + ': INVALID JSON - ' + e.message); continue; }
  const keys = Object.keys(P);
  const missing = enKeys.filter(k => P[k] == null || String(P[k]).trim() === '');
  const extra = keys.filter(k => EN[k] == null);
  let ph = 0, tg = 0, em = 0, same = 0;
  for (const k of enKeys) {
    if (P[k] == null) continue;
    if (phSet(P[k]) !== phSet(EN[k])) { ph++; bad(lang + '/' + k + ': placeholders differ (' + phSet(EN[k]) + ' vs ' + phSet(P[k]) + ')'); }
    if (tagSeq(P[k]) !== tagSeq(EN[k])) { tg++; bad(lang + '/' + k + ': HTML tags differ'); }
    if (EMOJI.test(P[k]) && !EMOJI.test(EN[k])) { em++; bad(lang + '/' + k + ': emoji'); }
    if (/<\/script/i.test(P[k])) bad(lang + '/' + k + ': contains </script');
    if (P[k] === EN[k] && /[a-z]{4,}/i.test(EN[k]) && !/^(MarginPad|USDT|SOL|ETH|BNB)/.test(EN[k])) same++;
  }
  if (extra.length) bad(lang + ': ' + extra.length + ' keys not in EN - ' + extra.slice(0, 5).join(', '));
  if (missing.length) console.log('  ' + lang + ': ' + missing.length + ' missing (English fallback): ' + missing.slice(0, 8).join(', ') + (missing.length > 8 ? '…' : ''));
  packHashes.push(lang + ':' + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 8));
  console.log(lang.padEnd(3) + ' ' + keys.length + '/' + enKeys.length + ' keys' + (missing.length ? ' · ' + missing.length + ' missing' : '') + (same ? ' · ' + same + ' identical to EN' : '') + (ph + tg + em ? ' · PROBLEMS ' + (ph + tg + em) : ' · ok'));
}

// ---- page: coverage + inject ----
let html = fs.readFileSync(PAGE, 'utf8');
const used = new Set();
for (const m of html.matchAll(/\bL\('([A-Za-z0-9_]+)'/g)) used.add(m[1]);
for (const m of html.matchAll(/data-t[hp]?="([A-Za-z0-9_]+)"/g)) used.add(m[1]);
// keys built dynamically from server codes
for (const m of html.matchAll(/'(tok_e_|o_st_|tm_e_)'\+/g)) enKeys.filter(k => k.startsWith(m[1])).forEach(k => used.add(k));
for (const m of html.matchAll(/L\((?:[a-z]+\?|\w+===?'\w+'\?)'([A-Za-z0-9_]+)':'([A-Za-z0-9_]+)'/g)) { used.add(m[1]); used.add(m[2]); }
for (const m of html.matchAll(/'([A-Za-z0-9_]+)'/g)) if (EN[m[1]] != null) used.add(m[1]); // any quoted literal that is an EN key (tip arrays, ternaries)
const unknown = [...used].filter(k => EN[k] == null);
const unused = enKeys.filter(k => !used.has(k));
if (unknown.length) bad('page uses keys missing from en.json: ' + unknown.join(', '));
if (unused.length) console.log('  unused EN keys (' + unused.length + '): ' + unused.join(', '));

const enJson = JSON.stringify(EN);
if (/<\/script/i.test(enJson)) bad('en.json contains </script');
const blockRe = /(<script type="application\/json" id="spotI18n">)([\s\S]*?)(<\/script>)/;
if (!blockRe.test(html)) bad('page has no #spotI18n block');
const ver = crypto.createHash('sha1').update(packHashes.join('|') + enJson).digest('hex').slice(0, 8);
let out = html.replace(blockRe, (_, a, __, c) => a + enJson + c);
out = out.replace(/window\.SPOT_I18N_V='\?v=[a-z0-9]+'/, "window.SPOT_I18N_V='?v=" + ver + "'");
if (!/window\.SPOT_I18N_V='\?v=/.test(out)) bad('page has no SPOT_I18N_V stamp');
if (!CHECK_ONLY && out !== html) { fs.writeFileSync(PAGE + '.tmp', out); fs.renameSync(PAGE + '.tmp', PAGE); console.log('page updated · packs v=' + ver); }
else console.log((CHECK_ONLY ? 'check only' : 'page unchanged') + ' · packs v=' + ver);
console.log(problems ? '\n' + problems + ' problem(s) - fix before deploying.' : '\nAll spot i18n packs match the EN dictionary.');
process.exit(problems ? 1 : 0);
