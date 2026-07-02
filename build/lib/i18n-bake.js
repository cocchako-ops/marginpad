/* Shared helper: bake server-rendered /<lang>/<slug>/ translations of a standalone page.
   Each page generator builds its English `html`, then calls bakeI18n({...}) to emit the 12
   language variants (translated meta + content + hreflang + lang/dir) and returns the English
   html with the hreflang block injected (so the caller writes that as dist/<slug>/index.html).

   Mechanism (proven on /defi/): for each lang, t = html; replace the English title/desc/kw with
   the translated meta; set <html lang dir>; swap the canonical/og URL → /<lang>/<slug>/; inject
   hreflang after canonical; run an ordered phrase-map of WHOLE-STRING replacements (use full
   unique strings incl. inline tags — never short ambiguous words); write dist/<lang>/<slug>/.
   RTL (ar) works automatically because dir="rtl" is baked and the page CSS respects it. */
const fs = require('fs');
const path = require('path');

const LANGS = ['de', 'es', 'pt', 'fr', 'nl', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id'];
const RTL = ['ar'];

function bakeI18n({ html, slug, title, desc, kw, META, PH, dist }) {
  const DIST = dist || path.join(__dirname, '..', '..', 'dist');
  const enUrl = `https://marginpad.io/${slug}/`;
  const hreflang = ['<link rel="alternate" hreflang="x-default" href="' + enUrl + '" />',
    '<link rel="alternate" hreflang="en" href="' + enUrl + '" />']
    .concat(LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="https://marginpad.io/${l}/${slug}/" />`)).join('\n');

  for (const L of LANGS) {
    let t = html;
    if (META && META[L]) {
      if (META[L].t && title) t = t.split(title).join(META[L].t);
      if (META[L].d && desc) t = t.split(desc).join(META[L].d);
      if (META[L].k && kw) t = t.split(kw).join(META[L].k);
    }
    t = t.replace('<html lang="en">', RTL.includes(L) ? `<html lang="${L}" dir="rtl">` : `<html lang="${L}">`);
    const langUrl = `https://marginpad.io/${L}/${slug}/`;
    t = t.split(enUrl).join(langUrl);
    t = t.replace(`<link rel="canonical" href="${langUrl}" />`, `<link rel="canonical" href="${langUrl}" />\n${hreflang}`);
    for (const [en, m] of (PH || [])) { if (m[L]) t = t.split(en).join(m[L]); }
    const dir = path.join(DIST, L, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), t);
  }

  // return the English html with hreflang injected (idempotent) for the caller to write
  let en = html;
  if (en.indexOf('hreflang="x-default"') === -1) {
    en = en.replace(`<link rel="canonical" href="${enUrl}" />`, `<link rel="canonical" href="${enUrl}" />\n${hreflang}`);
  }
  return { en, langs: LANGS.length };
}

// shared nav/footer/table link-labels reused across the data pages (markets/liquidations/funding/OI/long-short).
// Each value is a WHOLE unique substring so .split().join() is safe. Concat with a page's own PH.
const COMMON = [
  ['>Markets</a>', {de:'>Märkte</a>',es:'>Mercados</a>',pt:'>Mercados</a>',fr:'>Marchés</a>',nl:'>Markten</a>',ru:'>Рынки</a>',tr:'>Piyasalar</a>',zh:'>行情</a>',ja:'>マーケット</a>',ko:'>마켓</a>',ar:'>الأسواق</a>',id:'>Pasar</a>'}],
  ['>Liquidations</a>', {de:'>Liquidationen</a>',es:'>Liquidaciones</a>',pt:'>Liquidações</a>',fr:'>Liquidations</a>',nl:'>Liquidaties</a>',ru:'>Ликвидации</a>',tr:'>Likidasyonlar</a>',zh:'>爆仓</a>',ja:'>清算</a>',ko:'>청산</a>',ar:'>التصفيات</a>',id:'>Likuidasi</a>'}],
  ['>Funding</a>', {de:'>Funding</a>',es:'>Funding</a>',pt:'>Funding</a>',fr:'>Funding</a>',nl:'>Funding</a>',ru:'>Фандинг</a>',tr:'>Funding</a>',zh:'>资金费率</a>',ja:'>資金調達率</a>',ko:'>펀딩</a>',ar:'>التمويل</a>',id:'>Funding</a>'}],
  ['>Open Interest</a>', {de:'>Open Interest</a>',es:'>Interés abierto</a>',pt:'>Interesse em aberto</a>',fr:'>Open interest</a>',nl:'>Open interest</a>',ru:'>Открытый интерес</a>',tr:'>Açık pozisyon</a>',zh:'>持仓量</a>',ja:'>建玉</a>',ko:'>미결제약정</a>',ar:'>المراكز المفتوحة</a>',id:'>Open interest</a>'}],
  ['>Long/Short</a>', {de:'>Long/Short</a>',es:'>Long/Short</a>',pt:'>Long/Short</a>',fr:'>Long/Short</a>',nl:'>Long/Short</a>',ru:'>Лонг/Шорт</a>',tr:'>Long/Short</a>',zh:'>多空</a>',ja:'>ロング/ショート</a>',ko:'>롱/숏</a>',ar:'>لونغ/شورت</a>',id:'>Long/Short</a>'}],
  ['>Tools</a>', {de:'>Tools</a>',es:'>Herramientas</a>',pt:'>Ferramentas</a>',fr:'>Outils</a>',nl:'>Tools</a>',ru:'>Инструменты</a>',tr:'>Araçlar</a>',zh:'>工具</a>',ja:'>ツール</a>',ko:'>도구</a>',ar:'>الأدوات</a>',id:'>Alat</a>'}],
  ['>Blog</a>', {de:'>Blog</a>',es:'>Blog</a>',pt:'>Blog</a>',fr:'>Blog</a>',nl:'>Blog</a>',ru:'>Блог</a>',tr:'>Blog</a>',zh:'>博客</a>',ja:'>ブログ</a>',ko:'>블로그</a>',ar:'>المدونة</a>',id:'>Blog</a>'}],
  ['<th>Coin</th>', {de:'<th>Coin</th>',es:'<th>Moneda</th>',pt:'<th>Moeda</th>',fr:'<th>Crypto</th>',nl:'<th>Coin</th>',ru:'<th>Монета</th>',tr:'<th>Coin</th>',zh:'<th>币种</th>',ja:'<th>銘柄</th>',ko:'<th>코인</th>',ar:'<th>العملة</th>',id:'<th>Koin</th>'}],
  ['<th class="hide">Longs</th>', {de:'<th class="hide">Longs</th>',es:'<th class="hide">Largos</th>',pt:'<th class="hide">Longs</th>',fr:'<th class="hide">Longs</th>',nl:'<th class="hide">Longs</th>',ru:'<th class="hide">Лонги</th>',tr:'<th class="hide">Longlar</th>',zh:'<th class="hide">多头</th>',ja:'<th class="hide">ロング</th>',ko:'<th class="hide">롱</th>',ar:'<th class="hide">لونغ</th>',id:'<th class="hide">Long</th>'}],
  ['<th class="hide">Shorts</th>', {de:'<th class="hide">Shorts</th>',es:'<th class="hide">Cortos</th>',pt:'<th class="hide">Shorts</th>',fr:'<th class="hide">Shorts</th>',nl:'<th class="hide">Shorts</th>',ru:'<th class="hide">Шорты</th>',tr:'<th class="hide">Shortlar</th>',zh:'<th class="hide">空头</th>',ja:'<th class="hide">ショート</th>',ko:'<th class="hide">숏</th>',ar:'<th class="hide">شورت</th>',id:'<th class="hide">Short</th>'}],
  // shared across the data pages (CTA / loading / status / common table headers)
  ['>Open the market screener →</a>', {de:'>Markt-Screener öffnen →</a>',es:'>Abrir el screener de mercado →</a>',pt:'>Abrir o screener de mercado →</a>',fr:'>Ouvrir le screener de marché →</a>',nl:'>Open de markt-screener →</a>',ru:'>Открыть рыночный скринер →</a>',tr:'>Piyasa tarayıcısını aç →</a>',zh:'>打开市场选币器 →</a>',ja:'>マーケットスクリーナーを開く →</a>',ko:'>시장 스크리너 열기 →</a>',ar:'>افتح ماسح السوق →</a>',id:'>Buka screener pasar →</a>'}],
  ['>Practice risk-free</a>', {de:'>Risikofrei üben</a>',es:'>Practica sin riesgo</a>',pt:'>Pratique sem risco</a>',fr:'>Pratiquez sans risque</a>',nl:'>Oefen risicovrij</a>',ru:'>Практика без риска</a>',tr:'>Risksiz pratik yap</a>',zh:'>零风险练习</a>',ja:'>リスクなしで練習</a>',ko:'>무위험 연습</a>',ar:'>تدرّب بدون مخاطر</a>',id:'>Berlatih tanpa risiko</a>'}],
  ['Live data unavailable right now — retry shortly.', {de:'Live-Daten gerade nicht verfügbar — bitte gleich erneut versuchen.',es:'Datos en vivo no disponibles ahora — reintenta en breve.',pt:'Dados ao vivo indisponíveis agora — tente novamente em breve.',fr:'Données en direct indisponibles — réessayez bientôt.',nl:'Live data nu niet beschikbaar — probeer zo opnieuw.',ru:'Живые данные сейчас недоступны — повторите чуть позже.',tr:'Canlı veri şu an yok — birazdan tekrar deneyin.',zh:'实时数据暂不可用 — 请稍后重试。',ja:'ライブデータが現在利用できません — まもなく再試行してください。',ko:'실시간 데이터를 지금 사용할 수 없습니다 — 잠시 후 다시 시도하세요.',ar:'البيانات المباشرة غير متاحة الآن — أعد المحاولة قريباً.',id:'Data langsung tidak tersedia sekarang — coba lagi sebentar.'}],
  ['Updated just now · refreshes automatically', {de:'Gerade aktualisiert · aktualisiert automatisch',es:'Actualizado ahora mismo · se actualiza automáticamente',pt:'Atualizado agora mesmo · atualiza automaticamente',fr:'Mis à jour à l\'instant · se met à jour automatiquement',nl:'Zojuist bijgewerkt · ververst automatisch',ru:'Обновлено только что · обновляется автоматически',tr:'Az önce güncellendi · otomatik yenilenir',zh:'刚刚更新 · 自动刷新',ja:'たった今更新 · 自動更新',ko:'방금 업데이트됨 · 자동 새로고침',ar:'حُدِّث للتو · يُحدَّث تلقائياً',id:'Baru saja diperbarui · menyegarkan otomatis'}],
  ['>Loading…<', {de:'>Wird geladen…<',es:'>Cargando…<',pt:'>Carregando…<',fr:'>Chargement…<',nl:'>Laden…<',ru:'>Загрузка…<',tr:'>Yükleniyor…<',zh:'>加载中…<',ja:'>読み込み中…<',ko:'>불러오는 중…<',ar:'>جارٍ التحميل…<',id:'>Memuat…<'}],
  ['<th>Price</th>', {de:'<th>Preis</th>',es:'<th>Precio</th>',pt:'<th>Preço</th>',fr:'<th>Prix</th>',nl:'<th>Prijs</th>',ru:'<th>Цена</th>',tr:'<th>Fiyat</th>',zh:'<th>价格</th>',ja:'<th>価格</th>',ko:'<th>가격</th>',ar:'<th>السعر</th>',id:'<th>Harga</th>'}],
  ['<th>Funding</th>', {de:'<th>Funding</th>',es:'<th>Funding</th>',pt:'<th>Funding</th>',fr:'<th>Funding</th>',nl:'<th>Funding</th>',ru:'<th>Фандинг</th>',tr:'<th>Funding</th>',zh:'<th>资金费率</th>',ja:'<th>調達率</th>',ko:'<th>펀딩</th>',ar:'<th>التمويل</th>',id:'<th>Funding</th>'}],
  ['<th class="hide">Open Int.</th>', {de:'<th class="hide">Open Int.</th>',es:'<th class="hide">Interés ab.</th>',pt:'<th class="hide">Interesse</th>',fr:'<th class="hide">Open int.</th>',nl:'<th class="hide">Open int.</th>',ru:'<th class="hide">Откр. интерес</th>',tr:'<th class="hide">Açık poz.</th>',zh:'<th class="hide">持仓量</th>',ja:'<th class="hide">建玉</th>',ko:'<th class="hide">미결제</th>',ar:'<th class="hide">مفتوحة</th>',id:'<th class="hide">Open int.</th>'}]
];

module.exports = { bakeI18n, LANGS, RTL, COMMON };
