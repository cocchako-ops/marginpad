/* Academy translation audit (2026-09-05).
   The owner found "black box" rendered into Serbian as "crni sanduk" and suspected the whole job was done
   word-by-word. Reading one lesson is not evidence about 3,930 strings, so this measures the whole corpus per
   language against the EN master and ranks the damage. It reports, it never writes.

   Signals, all mechanical and all conservative:
     untranslated  - the string is byte-identical to the English one (nothing was done to it)
     en_leak       - Latin-script English words surviving inside a non-Latin translation (zh/ja/ko/ru/ar), which
                     is unambiguous: those alphabets do not contain them
     en_words      - high-confidence English function words appearing in a Latin-script translation. The list is
                     pruned per language so a genuine native word is never counted (e.g. "will" is German).
     short         - a translation dramatically shorter than its source, which is where dropped clauses hide

   Run: node build/academy-i18n-audit.js [--lang sr] [--samples 6]
*/
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const I18N = path.join(DIST, 'academy', 'i18n');
const PAGE = path.join(DIST, 'academy', 'index.html');
const LANGS = ['sr', 'es', 'de', 'fr', 'pt', 'nl', 'ru', 'tr', 'id', 'zh', 'ja', 'ko', 'ar'];
const NONLATIN = { ru: 1, zh: 1, ja: 1, ko: 1, ar: 1 };
const CJK = { zh: 1, ja: 1, ko: 1 };

const argLang = (process.argv.indexOf('--lang') > 0) ? process.argv[process.argv.indexOf('--lang') + 1] : null;
const SAMPLES = (process.argv.indexOf('--samples') > 0) ? +process.argv[process.argv.indexOf('--samples') + 1] : 4;

// English function words that no target language shares. Pruned per language where a collision is real.
const EN_WORDS = ['the', 'and', 'you', 'your', 'with', 'from', 'that', 'this', 'what', 'when', 'would', 'could',
  'should', 'because', 'their', 'there', 'have', 'been', 'will', 'just', 'only', 'most', 'other', 'after',
  'before', 'still', 'even', 'which', 'than', 'then', 'about', 'they', 'them', 'were', 'does', 'each', 'every',
  'never', 'always', 'happen', 'story', 'money', 'trade', 'price', 'loss', 'win', 'risk'];
const COLLIDE = { // words that ARE native somewhere and must not be counted there
  de: ['will', 'was', 'wenn', 'the', 'hat', 'most'], nl: ['over', 'even', 'were', 'was', 'van', 'the', 'still', 'water'],
  fr: ['on', 'the'], es: ['the'], pt: ['the'], id: ['the'], tr: ['the'], sr: ['the'],
  ru: [], zh: [], ja: [], ko: [], ar: []
};
const KEEP_LATIN = /^(BTC|ETH|SOL|XRP|BNB|USDT|USD|RSI|MACD|EMA|SMA|ATR|ROE|PnL|P&L|TP|SL|OK|API|CEX|DEX|NFT|ETF|FOMO|FUD|HODL|DCA|OTC|AI|CFD|MarginPad|Bitcoin|Binance|Bybit|OKX|TradingView|Fibonacci|Wyckoff|Elliott|Dow|Nasdaq|SPX|VIX|CPI|FOMC|GDP|k|x|X)$/i;

function readEN() {
  const html = fs.readFileSync(PAGE, 'utf8');
  const m = html.match(/<script type="application\/json" id="acadData">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('#acadData not found');
  return JSON.parse(m[1]);
}
// Walk EN and a translation in lockstep so every compared pair is genuinely the same slot.
function pairs(en, tr, out, trail) {
  if (typeof en === 'string') { if (typeof tr === 'string') out.push({ en, tr, at: trail }); return out; }
  if (Array.isArray(en)) { if (!Array.isArray(tr)) return out; en.forEach((v, i) => pairs(v, tr[i], out, trail + '[' + i + ']')); return out; }
  if (en && typeof en === 'object') { if (!tr || typeof tr !== 'object') return out; for (const k in en) { if (k === 'id' || k === 'img' || k === 'viz') continue; pairs(en[k], tr[k], out, trail + '.' + k); } }
  return out;
}
const words = (s) => String(s).toLowerCase().match(/[a-z']+/g) || [];

const EN = readEN();
const enCourse = {}; EN.courses.forEach(c => { enCourse[c.id] = c; });
const rows = [];
for (const L of (argLang ? [argLang] : LANGS)) {
  const files = fs.readdirSync(I18N).filter(f => f.indexOf('_' + L + '-') === 0);
  let n = 0, untr = 0, leak = 0, enw = 0, shortN = 0, chars = 0;
  const worst = [];
  for (const f of files) {
    const cid = f.replace('_' + L + '-', '').replace('.json', '');
    let tc; try { tc = JSON.parse(fs.readFileSync(path.join(I18N, f), 'utf8')); } catch (e) { continue; }
    const ec = enCourse[cid]; if (!ec) continue;
    const ps = pairs(ec, tc, [], cid);
    for (const p of ps) {
      const en = p.en.trim(), tr = p.tr.trim();
      if (!en || !tr) continue;
      n++; chars += tr.length;
      let flags = [];
      if (en === tr && en.length > 12) { untr++; flags.push('untranslated'); }
      if (NONLATIN[L]) {
        const latin = (tr.match(/[A-Za-z][A-Za-z'-]{3,}/g) || []).filter(w => !KEEP_LATIN.test(w));
        if (latin.length) { leak++; flags.push('en_leak:' + latin.slice(0, 3).join(',')); }
      } else {
        const bad = (COLLIDE[L] || []); const tw = words(tr);
        const hits = EN_WORDS.filter(w => bad.indexOf(w) < 0 && tw.indexOf(w) >= 0);
        if (hits.length >= 2) { enw++; flags.push('en_words:' + hits.slice(0, 4).join(',')); }
      }
      // CJK says the same thing in far fewer characters, so a length ratio is meaningless there and would
      // flag almost every correct Chinese string. Only Latin/Cyrillic/Arabic scripts are length-compared.
      if (!CJK[L] && en.length > 90 && tr.length < en.length * 0.45) { shortN++; flags.push('short'); }
      if (flags.length) worst.push({ at: p.at, en: en.slice(0, 90), tr: tr.slice(0, 90), flags });
    }
  }
  rows.push({ L, n, untr, leak, enw, shortN, chars, worst });
}
rows.sort((a, b) => ((b.untr + b.leak + b.enw + b.shortN) / (b.n || 1)) - ((a.untr + a.leak + a.enw + a.shortN) / (a.n || 1)));
console.log('lang  strings  untranslated  en_leak  en_words  too_short   suspect%');
for (const r of rows) {
  const sus = r.untr + r.leak + r.enw + r.shortN;
  console.log(r.L.padEnd(5), String(r.n).padStart(6), String(r.untr).padStart(13), String(r.leak).padStart(8), String(r.enw).padStart(9), String(r.shortN).padStart(10), String(Math.round(sus / (r.n || 1) * 1000) / 10).padStart(9) + '%');
}
if (argLang) {
  const r = rows[0];
  console.log('\nsamples (' + Math.min(SAMPLES, r.worst.length) + ' of ' + r.worst.length + ' flagged):');
  r.worst.slice(0, SAMPLES).forEach(w => { console.log('\n  at ' + w.at + '  [' + w.flags.join(' ') + ']'); console.log('  EN: ' + w.en); console.log('  ' + argLang.toUpperCase() + ': ' + w.tr); });
}
