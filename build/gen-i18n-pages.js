/* Generates language-specific static homepages (/es/, /zh/, …) with translated
   content + hreflang, for international SEO. Run: node build/gen-i18n-pages.js */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');

// ---- pull the translation dictionary out of the i18n master (dist/assets/i18n.js is now English-only/slim) ----
const i18nSrc = fs.readFileSync(path.join(__dirname, 'i18n-master.js'), 'utf8');
const s = i18nSrc.indexOf('var T = {');
const e = i18nSrc.indexOf('var EXTRA');
let objText = i18nSrc.slice(s + 'var T = '.length, e).trim();
objText = objText.replace(/;\s*$/, '');
const T = eval('(' + objText + ')'); // trusted local file
// also merge every EXTRA dictionary so generated pages translate the newer keys
// (single loop covering all suffixes — keep in sync with build/gen-i18n-assets.js)
for (const suffix of ['', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20']) {
  const startMark = 'var EXTRA' + suffix + ' = {';
  const endMark = 'for (var _L' + suffix + ' in EXTRA' + suffix + ')';
  const s2 = i18nSrc.indexOf(startMark);
  if (s2 < 0) continue;
  const e2 = i18nSrc.indexOf(endMark, s2);
  if (e2 < 0) continue;
  const body = i18nSrc.slice(s2 + ('var EXTRA' + suffix + ' = ').length, e2).trim().replace(/;\s*$/, '');
  const EX = eval('(' + body + ')');
  for (const L in EX) { if (T[L]) Object.assign(T[L], EX[L]); }
}
const LANGS = ['es', 'pt', 'fr', 'de', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id', 'nl'];
const RTL = ['ar'];
const TVLOC = { es: 'es', pt: 'pt_BR', fr: 'fr', de: 'de_DE', ru: 'ru', tr: 'tr', zh: 'zh_CN', ja: 'ja', ko: 'kr', ar: 'ar_AE', id: 'id_ID', nl: 'nl_NL' };

// SEO title + description per language (keyword-focused)
const SEO = {
  es: { t: 'MarginPad — Terminal gratuito de futuros cripto: paper trading, calculadoras y liquidaciones en vivo', d: 'Practicá futuros cripto con precios reales y dinero de mentira, calculá liquidación y tamaño de posición, mirá las liquidaciones en vivo de 9 exchanges, screener, calendario y academia. Gratis, sin registro.' },
  pt: { t: 'MarginPad — Terminal grátis de futuros cripto: paper trading, calculadoras e liquidações ao vivo', d: 'Treine futuros cripto com preços reais e dinheiro de mentira, calcule liquidação e tamanho de posição, veja as liquidações ao vivo de 9 corretoras, screener, calendário e academia. Grátis, sem cadastro.' },
  fr: { t: 'MarginPad — Terminal gratuit de futures crypto : paper trading, calculatrices et liquidations en direct', d: 'Entraîne-toi aux futures crypto à prix réels avec de l\'argent fictif, calcule liquidation et taille de position, suis les liquidations en direct de 9 plateformes, screener, calendrier et académie. Gratuit, sans inscription.' },
  de: { t: 'MarginPad — Kostenloses Krypto-Futures-Terminal: Paper Trading, Rechner und Live-Liquidationen', d: 'Übe Krypto-Futures zu echten Kursen mit Spielgeld, berechne Liquidationspreis und Positionsgröße, verfolge Live-Liquidationen von 9 Börsen, Screener, Kalender und Akademie. Kostenlos, ohne Anmeldung.' },
  ru: { t: 'MarginPad — бесплатный терминал крипто-фьючерсов: paper trading, калькуляторы и ликвидации в реальном времени', d: 'Тренируйтесь на крипто-фьючерсах по реальным ценам с виртуальными деньгами, считайте ликвидацию и размер позиции, смотрите ликвидации с 9 бирж в реальном времени, скринер, календарь и академию. Бесплатно, без регистрации.' },
  tr: { t: 'MarginPad — Ücretsiz kripto vadeli işlem terminali: paper trading, hesaplayıcılar ve canlı likidasyonlar', d: 'Gerçek fiyatlarla sahte parayla kripto vadeli işlem pratiği yap, likidasyon ve pozisyon boyutunu hesapla, 9 borsadan canlı likidasyonları izle, tarayıcı, takvim ve akademi. Ücretsiz, kayıtsız.' },
  zh: { t: 'MarginPad — 免费加密合约终端：模拟交易、计算器与实时爆仓数据', d: '用真实价格和虚拟资金练习加密合约，计算强平价格与仓位，查看 9 家交易所的实时爆仓、筛选器、财经日历和学院。免费，无需注册。' },
  ja: { t: 'MarginPad — 無料の暗号資産先物ターミナル：ペーパートレード、計算ツール、ライブ清算データ', d: '実際の価格と仮想資金で暗号資産先物を練習し、清算価格とポジションサイズを計算、9 取引所のライブ清算、スクリーナー、経済カレンダー、アカデミー。無料・登録不要。' },
  ko: { t: 'MarginPad — 무료 암호화폐 선물 터미널: 페이퍼 트레이딩, 계산기, 실시간 청산 데이터', d: '실제 가격과 가상 자금으로 암호화폐 선물을 연습하고, 청산가와 포지션 크기를 계산하고, 9개 거래소의 실시간 청산, 스크리너, 경제 캘린더, 아카데미까지. 무료, 가입 불필요.' },
  ar: { t: 'MarginPad — منصة مجانية لعقود الكريبتو الآجلة: تداول تجريبي، حاسبات وتصفيات مباشرة', d: 'تدرّب على عقود الكريبتو الآجلة بأسعار حقيقية ومال افتراضي، احسب سعر التصفية وحجم المركز، تابع التصفيات المباشرة من 9 منصات، والماسح، والتقويم، والأكاديمية. مجانًا وبلا تسجيل.' },
  id: { t: 'MarginPad — Terminal futures kripto gratis: paper trading, kalkulator, dan likuidasi live', d: 'Latih futures kripto dengan harga nyata dan uang virtual, hitung likuidasi dan ukuran posisi, pantau likuidasi live dari 9 bursa, screener, kalender, dan akademi. Gratis, tanpa daftar.' },
  nl: { t: 'MarginPad — Gratis crypto-futuresterminal: paper trading, calculators en live liquidaties', d: 'Oefen crypto-futures tegen echte prijzen met nepgeld, bereken liquidatie en positiegrootte, volg live liquidaties van 9 beurzen, screener, kalender en academie. Gratis, zonder registratie.' },
};

const escText = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = v => escText(v).replace(/"/g, '&quot;');

// hreflang block (same on every page)
const HREFLANG = [
  '<link rel="alternate" hreflang="x-default" href="https://marginpad.io/" />',
  '<link rel="alternate" hreflang="en" href="https://marginpad.io/" />',
].concat(LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="https://marginpad.io/${l}/" />`)).join('\n');

// Homepage copy string-map (build/data/home-i18n/<lang>.json = { "<EN text node>": "<translation>" }).
// The bento homepage (dist/index.html) carries NO data-i18n attributes, so the data-i18n loop below can't touch it.
// This map translates its visible text nodes directly (exact >text< boundary, whitespace-tolerant, longest-first)
// WITHOUT modifying dist/demo-home — zero risk to the homepage's structure/JS. Translations are used verbatim
// (agents produce HTML-ready text, keeping entities/brands/tickers as-is), so no double-escaping.
const HOME = {};
for (const l of LANGS) {
  const f = path.join(__dirname, 'data', 'home-i18n', l + '.json');
  if (fs.existsSync(f)) { try { HOME[l] = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error('home-i18n bad JSON ' + l + ': ' + e.message); } }
}
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function translateHome(html, lang) {
  const m = HOME[lang]; if (!m) return html;
  const keys = Object.keys(m).sort((a, b) => b.length - a.length); // longest-first: a short string can't clobber part of a longer text node
  let out = html;
  for (const en of keys) {
    const tr = m[en]; if (!tr || tr === en) continue;
    try { out = out.replace(new RegExp('>(\\s*)' + reEsc(en) + '(\\s*)<', 'g'), (mm, w1, w2) => '>' + w1 + tr + w2 + '<'); } catch (e) {}
  }
  return out;
}
function translate(html, lang) {
  const t = T[lang];
  let out = translateHome(html, lang); // homepage text-node map first (data-i18n loop below is a no-op on the bento)
  for (const key in t) {
    const val = escText(t[key]);
    const reTxt = new RegExp('(<([a-z0-9]+)([^>]*?)\\sdata-i18n="' + key + '"([^>]*?)>)([\\s\\S]*?)(<\\/\\2>)', 'g');
    out = out.replace(reTxt, (m, open, tag, a, b, inner, close) => open + val + close);
    // data-i18n-html: replace innerHTML with the raw (unescaped) translation, preserving tags like <code>
    const reHtml = new RegExp('(<([a-z0-9]+)([^>]*?)\\sdata-i18n-html="' + key + '"([^>]*?)>)([\\s\\S]*?)(<\\/\\2>)', 'g');
    out = out.replace(reHtml, (m, open, tag, a, b, inner, close) => open + t[key] + close);
    const rePh = new RegExp('(<input[^>]*?\\sdata-ph="' + key + '")([^>]*?)>', 'g');
    out = out.replace(rePh, (m, p1, p2) => (/placeholder=/.test(p2) ? m : p1 + p2 + ' placeholder="' + escAttr(t[key]) + '">'));
  }
  return out;
}

let base = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

// 1) add hreflang to the English homepage (idempotent)
if (!base.includes('hreflang="x-default"')) {
  base = base.replace('<link rel="canonical" href="https://marginpad.io/" />',
    '<link rel="canonical" href="https://marginpad.io/" />\n' + HREFLANG);
  fs.writeFileSync(path.join(DIST, 'index.html'), base);
  console.log('added hreflang to English homepage');
}

// 2) generate each language homepage
let count = 0;
for (const lang of LANGS) {
  let html = translate(base, lang);
  html = html.replace('<html lang="en">', RTL.includes(lang) ? `<html lang="${lang}" dir="rtl">` : `<html lang="${lang}">`);
  // title + description
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escText(SEO[lang].t)}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${escAttr(SEO[lang].d)}$2`);
  // localize the social-card title too (og:description/twitter:description are translated by gen-home-i18n)
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escAttr(SEO[lang].t)}$2`);
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escAttr(SEO[lang].t)}$2`);
  // canonical + og:url for this language
  html = html.replace('<link rel="canonical" href="https://marginpad.io/" />', `<link rel="canonical" href="https://marginpad.io/${lang}/" />`);
  html = html.replace('<meta property="og:url" content="https://marginpad.io/" />', `<meta property="og:url" content="https://marginpad.io/${lang}/" />`);
  // localize the TradingView widgets for this language
  html = html.replace(/"locale":"en"/g, `"locale":"${TVLOC[lang] || lang}"`);
  // Footer About/Contact stay on the English pages: translated subpages are RETIRED (the worker 301s /<lang>/about/ and
  // /<lang>/contact/ to the English originals), so rewriting these links only added a redirect hop on every language homepage (2026-09-12).
  const dir = path.join(DIST, lang);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  count++;
  console.log('wrote', lang + '/index.html');
}
console.log('done:', count, 'language homepages');
