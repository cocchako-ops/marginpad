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
for (const suffix of ['', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17']) {
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
  es: { t: 'Calculadora de Liquidación y Tamaño de Posición Cripto — MarginPad', d: 'Calculadoras gratis para traders de futuros cripto: precio de liquidación, tamaño de posición, PnL, DCA y take-profit. Al instante, sin registro.' },
  pt: { t: 'Calculadora de Liquidação e Tamanho de Posição Cripto — MarginPad', d: 'Calculadoras grátis para traders de futuros cripto: preço de liquidação, tamanho de posição, PnL, DCA e take-profit. Na hora, sem cadastro.' },
  fr: { t: 'Calculatrice de Liquidation et Taille de Position Crypto — MarginPad', d: 'Calculatrices gratuites pour traders de futures crypto : prix de liquidation, taille de position, PnL, DCA et take-profit. Instantané, sans inscription.' },
  de: { t: 'Krypto Liquidations- & Positionsgrößen-Rechner — MarginPad', d: 'Kostenlose Rechner für Krypto-Futures-Trader: Liquidationspreis, Positionsgröße, PnL, DCA und Take-Profit. Sofort, ohne Anmeldung.' },
  ru: { t: 'Калькулятор ликвидации и размера позиции в крипто — MarginPad', d: 'Бесплатные калькуляторы для трейдеров крипто-фьючерсов: цена ликвидации, размер позиции, PnL, DCA и тейк-профит. Мгновенно, без регистрации.' },
  tr: { t: 'Kripto Likidasyon ve Pozisyon Boyutu Hesaplayıcı — MarginPad', d: 'Kripto vadeli işlem trader\'ları için ücretsiz hesaplayıcılar: likidasyon fiyatı, pozisyon boyutu, PnL, DCA ve kâr al. Anında, kayıt yok.' },
  zh: { t: '加密合约强平价格与仓位计算器 — MarginPad', d: '面向加密合约交易者的免费计算器：强平价格、仓位规模、盈亏、定投与止盈。即时、无需注册。' },
  ja: { t: '仮想通貨 清算価格・ポジションサイズ計算ツール — MarginPad', d: '暗号資産先物トレーダー向けの無料計算ツール：清算価格、ポジションサイズ、損益、DCA、利確。瞬時、登録不要。' },
  ko: { t: '암호화폐 청산가·포지션 크기 계산기 — MarginPad', d: '암호화폐 선물 트레이더를 위한 무료 계산기: 청산 가격, 포지션 크기, 손익, 분할매수, 익절. 즉시, 가입 불필요.' },
  ar: { t: 'حاسبة سعر التصفية وحجم المركز للعملات المشفرة — MarginPad', d: 'حاسبات مجانية لمتداولي عقود الكريبتو الآجلة: سعر التصفية، حجم المركز، الأرباح/الخسائر، DCA، جني الأرباح. فوري وبدون تسجيل.' },
  id: { t: 'Kalkulator Likuidasi & Ukuran Posisi Kripto — MarginPad', d: 'Kalkulator gratis untuk trader futures kripto: harga likuidasi, ukuran posisi, PnL, DCA, dan take-profit. Instan, tanpa daftar.' },
  nl: { t: 'Liquidatie- & Positiegrootte-calculator voor Crypto — MarginPad', d: 'Gratis calculators voor crypto-futurestraders: liquidatieprijs, positiegrootte, PnL, DCA en take-profit. Direct, zonder registratie.' },
};

const escText = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = v => escText(v).replace(/"/g, '&quot;');

// hreflang block (same on every page)
const HREFLANG = [
  '<link rel="alternate" hreflang="x-default" href="https://marginpad.io/" />',
  '<link rel="alternate" hreflang="en" href="https://marginpad.io/" />',
].concat(LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="https://marginpad.io/${l}/" />`)).join('\n');

function translate(html, lang) {
  const t = T[lang];
  let out = html;
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
  // canonical + og:url for this language
  html = html.replace('<link rel="canonical" href="https://marginpad.io/" />', `<link rel="canonical" href="https://marginpad.io/${lang}/" />`);
  html = html.replace('<meta property="og:url" content="https://marginpad.io/" />', `<meta property="og:url" content="https://marginpad.io/${lang}/" />`);
  // localize the TradingView widgets for this language
  html = html.replace(/"locale":"en"/g, `"locale":"${TVLOC[lang] || lang}"`);
  // point footer About/Contact links to this language's pages
  html = html.replace(/href="\/about\/"/g, `href="/${lang}/about/"`).replace(/href="\/contact\/"/g, `href="/${lang}/contact/"`);
  const dir = path.join(DIST, lang);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  count++;
  console.log('wrote', lang + '/index.html');
}
console.log('done:', count, 'language homepages');
