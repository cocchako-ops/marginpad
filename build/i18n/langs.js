/* THE ONE TABLE OF SITE LANGUAGES (2026-11-06, owner: "idemo u 100% prevod svega").
   A twin language is a full copy of the site under /<code>/, built by build/es/gen-pages.js --lang <code> from
   build/data/<code>/catalog.json, with its script strings in build/data/i18n/strings.json and its worker SSR words in
   the worker's TWIN tables. Every pipeline tool reads this list instead of keeping its own.
   hint = words/letters that prove a string is in that language (check.js uses it to tell a translation from English left
   behind); cjk = character-dense script, so a translation is legitimately much SHORTER than the English. */
'use strict';
const LANGS = {
  es: { name: 'Spanish', locale: 'es_ES', hint: /[áéíóúñ¿¡]|\b(el|la|los|las|de|del|un|una|que|con|para|por|sin|tu|tus|se|es|en|al|más|cómo|qué|precio|posición|margen|apalancamiento|liquidación|calculadora|gratis|operación)\b/i },
  pt: { name: 'Portuguese', locale: 'pt_BR', hint: /[ãõçâêôáéíóú]|\b(o|a|os|as|de|do|da|dos|das|um|uma|que|com|para|por|sem|seu|sua|se|em|ao|mais|como|preço|posição|margem|alavancagem|liquidação|calculadora|grátis|você|não|são|está)\b/i },
  de: { name: 'German', locale: 'de_DE', hint: /[äöüß]|\b(der|die|das|und|mit|dein|deine|für|von|bei|nicht|ist|sind|wird|werden|auf|ein|eine|einen|oder|wenn|wie|was|auch|nur|mehr|Preis|Position|Hebel|Liquidation|Rechner|kostenlos|Gebühr|Börse|Konto|jetzt|hier|ohne)\b/i },
  fr: { name: 'French', locale: 'fr_FR', hint: /[éèêàâçùûîôœ]|\b(le|la|les|des|du|un|une|est|sont|pour|avec|dans|sur|pas|ton|ta|tes|vous|votre|vos|qui|que|ce|cette|plus|prix|marge|levier|calculateur|gratuit|compte)\b/i },
  nl: { name: 'Dutch', locale: 'nl_NL', hint: /[ëïé]|\b(de|het|een|van|en|is|niet|je|jouw|voor|met|op|aan|bij|wordt|zijn|ook|meer|prijs|positie|hefboom|liquidatie|gratis|rekening|wanneer|hoe)\b/i },
  ru: { name: 'Russian', locale: 'ru_RU', hint: /[а-яё]/i },
  tr: { name: 'Turkish', locale: 'tr_TR', hint: /[ğüşıöçİ]|\b(ve|bir|bu|için|ile|değil|daha|olarak|fiyat|pozisyon|kaldıraç|tasfiye|ücretsiz|hesap|sen|senin)\b/i },
  id: { name: 'Indonesian', locale: 'id_ID', hint: /\b(yang|dan|untuk|dengan|ini|itu|tidak|kamu|di|ke|dari|akan|bisa|harga|posisi|leverage|likuidasi|gratis|akun|saat|jika)\b/i },
  zh: { name: 'Chinese (Simplified)', locale: 'zh_CN', cjk: true, hint: /[一-鿿]/ },
  ja: { name: 'Japanese', locale: 'ja_JP', cjk: true, hint: /[぀-ヿ一-鿿]/ },
  ko: { name: 'Korean', locale: 'ko_KR', cjk: true, hint: /[가-힯]/ },
  ar: { name: 'Arabic', locale: 'ar_AR', rtl: true, hint: /[؀-ۿ]/ },
};
const TWINS = Object.keys(LANGS);
module.exports = { LANGS, TWINS };
