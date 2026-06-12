/* Generates language-specific static homepages (/es/, /zh/, …) with translated
   content + hreflang, for international SEO. Run: node build/gen-i18n-pages.js */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');

// ---- pull the translation dictionary out of the shipped i18n.js ----
const i18nSrc = fs.readFileSync(path.join(DIST, 'assets', 'i18n.js'), 'utf8');
const s = i18nSrc.indexOf('var T = {');
const e = i18nSrc.indexOf('var EXTRA');
let objText = i18nSrc.slice(s + 'var T = '.length, e).trim();
objText = objText.replace(/;\s*$/, '');
const T = eval('(' + objText + ')'); // trusted local file
// also merge the EXTRA dictionary so generated pages translate the newer keys
const exS = i18nSrc.indexOf('var EXTRA = {');
const exE = i18nSrc.indexOf('for (var _L in EXTRA)');
if (exS >= 0 && exE > exS) {
  let exText = i18nSrc.slice(exS + 'var EXTRA = '.length, exE).trim().replace(/;\s*$/, '');
  const EXTRA = eval('(' + exText + ')');
  for (const L in EXTRA) { if (T[L]) Object.assign(T[L], EXTRA[L]); }
}
const ex2S = i18nSrc.indexOf('var EXTRA2 = {');
const ex2E = i18nSrc.indexOf('for (var _L2 in EXTRA2)');
if (ex2S >= 0 && ex2E > ex2S) {
  let ex2Text = i18nSrc.slice(ex2S + 'var EXTRA2 = '.length, ex2E).trim().replace(/;\s*$/, '');
  const EXTRA2 = eval('(' + ex2Text + ')');
  for (const L in EXTRA2) { if (T[L]) Object.assign(T[L], EXTRA2[L]); }
}
const ex3S = i18nSrc.indexOf('var EXTRA3 = {');
const ex3E = i18nSrc.indexOf('for (var _L3 in EXTRA3)');
if (ex3S >= 0 && ex3E > ex3S) {
  let ex3Text = i18nSrc.slice(ex3S + 'var EXTRA3 = '.length, ex3E).trim().replace(/;\s*$/, '');
  const EXTRA3 = eval('(' + ex3Text + ')');
  for (const L in EXTRA3) { if (T[L]) Object.assign(T[L], EXTRA3[L]); }
}
const ex4S = i18nSrc.indexOf('var EXTRA4 = {');
const ex4E = i18nSrc.indexOf('for (var _L4 in EXTRA4)');
if (ex4S >= 0 && ex4E > ex4S) {
  let ex4Text = i18nSrc.slice(ex4S + 'var EXTRA4 = '.length, ex4E).trim().replace(/;\s*$/, '');
  const EXTRA4 = eval('(' + ex4Text + ')');
  for (const L in EXTRA4) { if (T[L]) Object.assign(T[L], EXTRA4[L]); }
}
const ex5S = i18nSrc.indexOf('var EXTRA5 = {');
const ex5E = i18nSrc.indexOf('for (var _L5 in EXTRA5)');
if (ex5S >= 0 && ex5E > ex5S) {
  let ex5Text = i18nSrc.slice(ex5S + 'var EXTRA5 = '.length, ex5E).trim().replace(/;\s*$/, '');
  const EXTRA5 = eval('(' + ex5Text + ')');
  for (const L in EXTRA5) { if (T[L]) Object.assign(T[L], EXTRA5[L]); }
}
const ex6S = i18nSrc.indexOf('var EXTRA6 = {');
const ex6E = i18nSrc.indexOf('for (var _L6 in EXTRA6)');
if (ex6S >= 0 && ex6E > ex6S) {
  let ex6Text = i18nSrc.slice(ex6S + 'var EXTRA6 = '.length, ex6E).trim().replace(/;\s*$/, '');
  const EXTRA6 = eval('(' + ex6Text + ')');
  for (const L in EXTRA6) { if (T[L]) Object.assign(T[L], EXTRA6[L]); }
}
const ex7S = i18nSrc.indexOf('var EXTRA7 = {');
const ex7E = i18nSrc.indexOf('for (var _L7 in EXTRA7)');
if (ex7S >= 0 && ex7E > ex7S) {
  let ex7Text = i18nSrc.slice(ex7S + 'var EXTRA7 = '.length, ex7E).trim().replace(/;\s*$/, '');
  const EXTRA7 = eval('(' + ex7Text + ')');
  for (const L in EXTRA7) { if (T[L]) Object.assign(T[L], EXTRA7[L]); }
}

const ex8S = i18nSrc.indexOf("var EXTRA8 = {");
const ex8E = i18nSrc.indexOf("for (var _L8 in EXTRA8)");
if (ex8S >= 0 && ex8E > ex8S) {
  let t = i18nSrc.slice(ex8S + "var EXTRA8 = ".length, ex8E).trim().replace(/;s*$/, "");
  const E8 = eval("(" + t + ")");
  for (const L in E8) { if (T[L]) Object.assign(T[L], E8[L]); }
}
const e9S=i18nSrc.indexOf("var EXTRA9 = {");const e9E=i18nSrc.indexOf("for (var _L9 in EXTRA9)");
if(e9S>=0&&e9E>e9S){let t=i18nSrc.slice(e9S+"var EXTRA9 = ".length,e9E).trim().replace(/;s*$/,"");const E9=eval("("+t+")");for(const L in E9){if(T[L])Object.assign(T[L],E9[L]);}}
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
