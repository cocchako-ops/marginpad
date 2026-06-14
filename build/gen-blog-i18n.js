/* Translated versions of the flagship guide for international SEO, with hreflang.
   /blog/how-to-calculate-liquidation-price/<lang>/  Run: node build/gen-blog-i18n.js */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const SLUG = 'how-to-calculate-liquidation-price';
const BASE = 'https://marginpad.io/blog/' + SLUG + '/';

// 12 translations of a concise, accurate explainer (English original lives at the base URL).
const T = {
  es: { lang: 'es', name: 'Español', title: 'Cómo calcular el precio de liquidación en cripto', desc: 'La fórmula del precio de liquidación para futuros cripto, con un ejemplo, para cualquier apalancamiento — largo o corto.', lead: 'Tu precio de liquidación es el nivel en el que el exchange cierra a la fuerza tu posición apalancada. Aquí tienes la fórmula y cómo calcular el tuyo.', h2a: 'La fórmula de liquidación', pa: 'Para una posición de margen aislado, el precio de liquidación estimado es <code>Entrada × (1 − 1/Apalancamiento + MMR)</code> en largo y <code>Entrada × (1 + 1/Apalancamiento − MMR)</code> en corto, donde MMR es la tasa de margen de mantenimiento (suele rondar el 0,5 %). Más apalancamiento acerca la liquidación a tu entrada.', h2b: 'Ejemplo práctico', pb: 'Un largo de 10× en BTC abierto a 60 000 $ con un MMR del 0,5 % se liquida cerca de 54 300 $ — una caída de aproximadamente el 9,5 %. La misma posición a 100× se liquida tras un movimiento de cerca del 1 %.', cta: 'Calcula tu precio de liquidación exacto con la calculadora gratuita →' },
  pt: { lang: 'pt', name: 'Português', title: 'Como calcular o preço de liquidação em cripto', desc: 'A fórmula do preço de liquidação para futuros cripto, com exemplo, para qualquer alavancagem — comprado ou vendido.', lead: 'Seu preço de liquidação é o nível em que a corretora encerra à força sua posição alavancada. Veja a fórmula e como calcular o seu.', h2a: 'A fórmula de liquidação', pa: 'Para uma posição de margem isolada, o preço de liquidação estimado é <code>Entrada × (1 − 1/Alavancagem + MMR)</code> comprado e <code>Entrada × (1 + 1/Alavancagem − MMR)</code> vendido, onde MMR é a taxa de margem de manutenção (em geral cerca de 0,5%). Mais alavancagem aproxima a liquidação da sua entrada.', h2b: 'Exemplo prático', pb: 'Um comprado de 10× em BTC aberto a US$ 60.000 com MMR de 0,5% é liquidado perto de US$ 54.300 — uma queda de cerca de 9,5%. A mesma posição em 100× é liquidada após um movimento de cerca de 1%.', cta: 'Encontre seu preço de liquidação exato com a calculadora gratuita →' },
  fr: { lang: 'fr', name: 'Français', title: 'Comment calculer le prix de liquidation en crypto', desc: 'La formule du prix de liquidation pour les futures crypto, avec un exemple, pour tout effet de levier — long ou short.', lead: 'Votre prix de liquidation est le niveau auquel la plateforme clôture de force votre position à effet de levier. Voici la formule et comment calculer le vôtre.', h2a: 'La formule de liquidation', pa: 'Pour une position en marge isolée, le prix de liquidation estimé est <code>Entrée × (1 − 1/Levier + MMR)</code> en long et <code>Entrée × (1 + 1/Levier − MMR)</code> en short, où MMR est le taux de marge de maintenance (souvent autour de 0,5 %). Plus le levier est élevé, plus la liquidation se rapproche de votre entrée.', h2b: 'Exemple chiffré', pb: 'Un long 10× sur BTC ouvert à 60 000 $ avec un MMR de 0,5 % est liquidé vers 54 300 $ — une baisse d’environ 9,5 %. La même position en 100× est liquidée après un mouvement d’environ 1 %.', cta: 'Trouvez votre prix de liquidation exact avec la calculatrice gratuite →' },
  de: { lang: 'de', name: 'Deutsch', title: 'Liquidationspreis bei Krypto berechnen', desc: 'Die Formel für den Liquidationspreis bei Krypto-Futures, mit Beispiel, für jeden Hebel — Long oder Short.', lead: 'Dein Liquidationspreis ist das Niveau, bei dem die Börse deine gehebelte Position zwangsweise schließt. Hier ist die Formel und wie du deinen berechnest.', h2a: 'Die Liquidationsformel', pa: 'Bei einer Isolated-Margin-Position liegt der geschätzte Liquidationspreis bei <code>Einstieg × (1 − 1/Hebel + MMR)</code> für Long und <code>Einstieg × (1 + 1/Hebel − MMR)</code> für Short, wobei MMR die Maintenance-Margin-Rate ist (oft etwa 0,5 %). Mehr Hebel rückt die Liquidation näher an deinen Einstieg.', h2b: 'Rechenbeispiel', pb: 'Ein 10×-Long auf BTC bei 60.000 $ mit 0,5 % MMR wird nahe 54.300 $ liquidiert — ein Rückgang von etwa 9,5 %. Dieselbe Position bei 100× wird nach rund 1 % Bewegung liquidiert.', cta: 'Finde deinen genauen Liquidationspreis mit dem kostenlosen Rechner →' },
  ru: { lang: 'ru', name: 'Русский', title: 'Как рассчитать цену ликвидации в крипте', desc: 'Формула цены ликвидации для криптофьючерсов с примером, для любого плеча — лонг или шорт.', lead: 'Цена ликвидации — это уровень, на котором биржа принудительно закрывает вашу позицию с плечом. Вот формула и как рассчитать свою.', h2a: 'Формула ликвидации', pa: 'Для позиции с изолированной маржой расчётная цена ликвидации равна <code>Вход × (1 − 1/Плечо + MMR)</code> для лонга и <code>Вход × (1 + 1/Плечо − MMR)</code> для шорта, где MMR — ставка поддерживающей маржи (часто около 0,5 %). Чем больше плечо, тем ближе ликвидация к вашему входу.', h2b: 'Пример расчёта', pb: 'Лонг 10× по BTC, открытый по 60 000 $ при MMR 0,5 %, ликвидируется около 54 300 $ — падение примерно на 9,5 %. Та же позиция на 100× ликвидируется после движения около 1 %.', cta: 'Узнайте точную цену ликвидации в бесплатном калькуляторе →' },
  tr: { lang: 'tr', name: 'Türkçe', title: 'Kriptoda likidasyon fiyatı nasıl hesaplanır', desc: 'Kripto vadeli işlemler için likidasyon fiyatı formülü, örnekle, her kaldıraç için — long ya da short.', lead: 'Likidasyon fiyatı, borsanın kaldıraçlı pozisyonunu zorla kapattığı seviyedir. İşte formül ve kendininkini nasıl bulacağın.', h2a: 'Likidasyon formülü', pa: 'İzole marjlı bir pozisyon için tahmini likidasyon fiyatı long’da <code>Giriş × (1 − 1/Kaldıraç + MMR)</code>, short’ta <code>Giriş × (1 + 1/Kaldıraç − MMR)</code>’dir; burada MMR sürdürme marjı oranıdır (genelde %0,5 civarı). Kaldıraç arttıkça likidasyon girişine yaklaşır.', h2b: 'Örnek hesap', pb: '60.000 $’dan açılan %0,5 MMR’li 10× BTC long’u yaklaşık 54.300 $’da likide olur — yaklaşık %9,5’lik düşüş. Aynı pozisyon 100×’te yaklaşık %1’lik hareketle likide olur.', cta: 'Tam likidasyon fiyatını ücretsiz hesaplayıcıyla bul →' },
  zh: { lang: 'zh', name: '中文', title: '如何计算加密货币的强平价格', desc: '加密合约强平价格的公式与示例，适用于任何杠杆——做多或做空。', lead: '强平价格是交易所强制平掉你杠杆仓位的价格。下面是公式以及如何计算你的强平价。', h2a: '强平公式', pa: '对于逐仓保证金仓位，估算强平价为做多 <code>入场价 × (1 − 1/杠杆 + MMR)</code>，做空 <code>入场价 × (1 + 1/杠杆 − MMR)</code>，其中 MMR 为维持保证金率（通常约 0.5%）。杠杆越高，强平价越接近入场价。', h2b: '计算示例', pb: '以 60,000 美元开仓、MMR 为 0.5% 的 10× BTC 多单，约在 54,300 美元被强平——下跌约 9.5%。同样的仓位在 100× 时，价格波动约 1% 即被强平。', cta: '用免费计算器算出你的精确强平价 →' },
  ja: { lang: 'ja', name: '日本語', title: '仮想通貨の清算価格の計算方法', desc: '仮想通貨先物の清算価格の計算式と例。あらゆるレバレッジに対応——ロングもショートも。', lead: '清算価格とは、取引所がレバレッジ建玉を強制的に決済する価格です。計算式と求め方を紹介します。', h2a: '清算の計算式', pa: '分離マージンの建玉では、推定清算価格はロングが <code>建値 × (1 − 1/レバレッジ + MMR)</code>、ショートが <code>建値 × (1 + 1/レバレッジ − MMR)</code> です。MMR は維持証拠金率（通常0.5%前後）。レバレッジが高いほど清算は建値に近づきます。', h2b: '計算例', pb: '6万ドルでエントリーしMMR0.5%の10×BTCロングは、約5万4,300ドルで清算されます——約9.5%の下落です。同じ建玉を100×にすると、約1%の変動で清算されます。', cta: '無料計算ツールで正確な清算価格を確認 →' },
  ko: { lang: 'ko', name: '한국어', title: '암호화폐 청산 가격 계산법', desc: '암호화폐 선물의 청산 가격 공식과 예시. 모든 레버리지에 적용 — 롱이든 숏이든.', lead: '청산 가격은 거래소가 레버리지 포지션을 강제 청산하는 가격입니다. 공식과 계산법을 알아봅니다.', h2a: '청산 공식', pa: '격리 마진 포지션의 추정 청산 가격은 롱이 <code>진입가 × (1 − 1/레버리지 + MMR)</code>, 숏이 <code>진입가 × (1 + 1/레버리지 − MMR)</code> 입니다. MMR은 유지 증거금률(보통 약 0.5%)입니다. 레버리지가 높을수록 청산가가 진입가에 가까워집니다.', h2b: '계산 예시', pb: '6만 달러에 진입하고 MMR 0.5%인 10× BTC 롱은 약 5만 4,300달러에서 청산됩니다 — 약 9.5% 하락. 같은 포지션을 100×로 하면 약 1% 움직임에 청산됩니다.', cta: '무료 계산기로 정확한 청산 가격 확인하기 →' },
  ar: { lang: 'ar', name: 'العربية', dir: 'rtl', title: 'كيفية حساب سعر التصفية في الكريبتو', desc: 'صيغة سعر التصفية لعقود الكريبتو الآجلة مع مثال، لأي رافعة — شراء أو بيع.', lead: 'سعر التصفية هو المستوى الذي تغلق عنده المنصة مركزك بالرافعة قسرًا. إليك الصيغة وكيفية حساب سعرك.', h2a: 'صيغة التصفية', pa: 'لمركز بهامش معزول، سعر التصفية التقديري هو <code>الدخول × (1 − 1/الرافعة + MMR)</code> للشراء و<code>الدخول × (1 + 1/الرافعة − MMR)</code> للبيع، حيث MMR هو نسبة هامش الصيانة (غالبًا نحو 0.5%). كلما زادت الرافعة اقترب سعر التصفية من سعر دخولك.', h2b: 'مثال عملي', pb: 'مركز شراء 10× على BTC عند 60,000 دولار بهامش صيانة 0.5% تتم تصفيته قرب 54,300 دولار — انخفاض نحو 9.5%. نفس المركز عند 100× تتم تصفيته بعد حركة نحو 1%.', cta: 'احسب سعر تصفيتك الدقيق بالحاسبة المجانية →' },
  id: { lang: 'id', name: 'Bahasa Indonesia', title: 'Cara menghitung harga likuidasi kripto', desc: 'Rumus harga likuidasi untuk futures kripto, dengan contoh, untuk leverage berapa pun — long atau short.', lead: 'Harga likuidasi adalah level di mana bursa menutup paksa posisi leverage-mu. Berikut rumus dan cara menghitungnya.', h2a: 'Rumus likuidasi', pa: 'Untuk posisi margin terisolasi, perkiraan harga likuidasi adalah <code>Entry × (1 − 1/Leverage + MMR)</code> untuk long dan <code>Entry × (1 + 1/Leverage − MMR)</code> untuk short, di mana MMR adalah maintenance margin rate (biasanya sekitar 0,5%). Makin tinggi leverage, makin dekat likuidasi ke entry-mu.', h2b: 'Contoh perhitungan', pb: 'Long 10× BTC dibuka di $60.000 dengan MMR 0,5% dilikuidasi sekitar $54.300 — turun sekitar 9,5%. Posisi sama di 100× dilikuidasi setelah pergerakan sekitar 1%.', cta: 'Temukan harga likuidasi pastimu dengan kalkulator gratis →' },
  nl: { lang: 'nl', name: 'Nederlands', title: 'Liquidatieprijs berekenen bij crypto', desc: 'De formule voor de liquidatieprijs bij crypto-futures, met voorbeeld, voor elke hefboom — long of short.', lead: 'Je liquidatieprijs is het niveau waarop de beurs je hefboompositie gedwongen sluit. Hier is de formule en hoe je die van jou berekent.', h2a: 'De liquidatieformule', pa: 'Bij een geïsoleerde-margepositie is de geschatte liquidatieprijs <code>Instap × (1 − 1/Hefboom + MMR)</code> voor long en <code>Instap × (1 + 1/Hefboom − MMR)</code> voor short, waarbij MMR de onderhoudsmargeratio is (vaak rond 0,5%). Meer hefboom brengt de liquidatie dichter bij je instap.', h2b: 'Rekenvoorbeeld', pb: 'Een 10×-long op BTC geopend op $60.000 met 0,5% MMR wordt rond $54.300 geliquideerd — een daling van circa 9,5%. Dezelfde positie op 100× wordt geliquideerd na een beweging van ongeveer 1%.', cta: 'Vind je exacte liquidatieprijs met de gratis calculator →' },
};

const LANGS = Object.keys(T);

function altLinks() {
  // hreflang alternates for every language + English (x-default)
  let h = `<link rel="alternate" hreflang="x-default" href="${BASE}" />\n<link rel="alternate" hreflang="en" href="${BASE}" />`;
  for (const l of LANGS) h += `\n<link rel="alternate" hreflang="${l}" href="${BASE}${l}/" />`;
  return h;
}

function switcher(cur) {
  const items = [`<a href="${BASE}">English</a>`].concat(LANGS.map(l => l === cur ? `<b>${T[l].name}</b>` : `<a href="${BASE}${l}/">${T[l].name}</a>`));
  return `<p style="font-size:12px;color:var(--ink-faint);margin:0 0 20px;line-height:2">🌐 ${items.join(' · ')}</p>`;
}

function page(t) {
  const url = BASE + t.lang + '/';
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"${t.title.replace(/"/g, '')}","inLanguage":"${t.lang}","author":{"@type":"Organization","name":"MarginPad"},"publisher":{"@type":"Organization","name":"MarginPad"},"mainEntityOfPage":"${url}"}</script>`;
  return `<!DOCTYPE html>
<html lang="${t.lang}"${t.dir ? ' dir="rtl"' : ''}>
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${t.title} — MarginPad</title>
<meta name="description" content="${t.desc}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#0a0b0d" />
<meta property="og:title" content="${t.title}" />
<meta property="og:description" content="${t.desc}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
${altLinks()}
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Familjen+Grotesk:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/assets/blog.css" />
${ld}
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b style="color:#c2f64a">PAD</b></a>
    <nav class="nav"><a href="/">Calculators</a><a href="/blog/">Blog</a></nav>
  </header>
  <article>
    <h1>${t.title}</h1>
    ${switcher(t.lang)}
    <p class="lead">${t.lead}</p>
    <h2>${t.h2a}</h2>
    <p>${t.pa}</p>
    <h2>${t.h2b}</h2>
    <p>${t.pb}</p>
    <div class="callout"><a class="cta" href="/#liq">${t.cta}</a></div>
  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="/">Calculators</a> · <a href="/blog/">Blog</a></span>
  </footer>
</div>
</body>
</html>
`;
}

let n = 0;
for (const l of LANGS) {
  const d = path.join(OUT, 'blog', SLUG, l);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'index.html'), page(T[l]));
  n++;
  console.log('wrote', SLUG + '/' + l);
}
// inject hreflang into the English original (so the cluster links both ways)
try {
  const enFile = path.join(OUT, 'blog', SLUG, 'index.html');
  let en = fs.readFileSync(enFile, 'utf8');
  if (en.indexOf('hreflang="es"') === -1 && en.indexOf('</head>') !== -1) {
    en = en.replace('</head>', altLinks() + '\n</head>');
    fs.writeFileSync(enFile, en);
    console.log('hreflang injected into English original');
  }
} catch (e) { console.log('english hreflang skipped:', e.message); }
// sitemap
try {
  const smp = path.join(OUT, 'sitemap.xml');
  let sm = fs.readFileSync(smp, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  let added = 0;
  for (const l of LANGS) {
    const loc = BASE + l + '/';
    if (sm.indexOf(loc) === -1) { sm = sm.replace('</urlset>', `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n</urlset>`); added++; }
  }
  if (added) { fs.writeFileSync(smp, sm); console.log('sitemap: +' + added + ' translated URLs'); }
} catch (e) { console.log('sitemap skipped:', e.message); }
console.log('done:', n, 'translated pages');
