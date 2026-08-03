/* Shared interactive fee calculator for the exchange SEO pages (compare + best-for).
   feeWidget(a, b, lang) → a self-contained HTML+JS widget: enter position size + trades/month,
   see the live round-trip and monthly taker-fee cost on both venues + which is cheaper.
   a/b = { name, taker }. Labels translated into 13 languages (English fallback). No deps. */

const FCL = {
  en: { title: 'Fee calculator', sub: 'What a round trip actually costs on each — enter your position size and how often you trade.', pos: 'Position size (USD)', freq: 'Round trips / month', rt: 'Per round trip', mo: 'Per month', cheaper: 'cheaper', save: 'You save', on: 'on', note: 'Taker fees, charged on the full position both sides. Maker (limit) orders cost less; VIP tiers cut both.', tie: 'Base taker fees are identical on these two.' },
  de: { title: 'Gebührenrechner', sub: 'Was ein Roundtrip auf jeder Börse wirklich kostet — gib deine Positionsgröße und Handelshäufigkeit ein.', pos: 'Positionsgröße (USD)', freq: 'Roundtrips / Monat', rt: 'Pro Roundtrip', mo: 'Pro Monat', cheaper: 'günstiger', save: 'Du sparst', on: 'auf', note: 'Taker-Gebühren, auf die volle Position beidseitig. Maker-Orders (Limit) kosten weniger; VIP-Stufen senken beide.', tie: 'Die Basis-Taker-Gebühren sind bei diesen beiden identisch.' },
  es: { title: 'Calculadora de comisiones', sub: 'Lo que cuesta de verdad un ciclo completo en cada uno — introduce el tamaño de tu posición y con qué frecuencia operas.', pos: 'Tamaño de posición (USD)', freq: 'Ciclos completos / mes', rt: 'Por ciclo', mo: 'Por mes', cheaper: 'más barato', save: 'Ahorras', on: 'en', note: 'Comisiones taker, cobradas sobre la posición completa en ambos lados. Las órdenes maker (límite) cuestan menos; los niveles VIP reducen ambas.', tie: 'Las comisiones taker base son idénticas en estos dos.' },
  pt: { title: 'Calculadora de taxas', sub: 'Quanto um ciclo completo realmente custa em cada uma — insira o tamanho da posição e a frequência com que opera.', pos: 'Tamanho da posição (USD)', freq: 'Ciclos completos / mês', rt: 'Por ciclo', mo: 'Por mês', cheaper: 'mais barato', save: 'Você economiza', on: 'na', note: 'Taxas taker, cobradas sobre a posição inteira nos dois lados. Ordens maker (limite) custam menos; níveis VIP reduzem ambas.', tie: 'As taxas taker base são idênticas nestas duas.' },
  fr: { title: 'Calculateur de frais', sub: 'Ce qu\'un aller-retour coûte vraiment sur chaque plateforme — saisissez la taille de votre position et votre fréquence de trading.', pos: 'Taille de position (USD)', freq: 'Allers-retours / mois', rt: 'Par aller-retour', mo: 'Par mois', cheaper: 'moins cher', save: 'Vous économisez', on: 'sur', note: 'Frais taker, prélevés sur la position entière des deux côtés. Les ordres maker (limite) coûtent moins ; les paliers VIP réduisent les deux.', tie: 'Les frais taker de base sont identiques sur ces deux plateformes.' },
  nl: { title: 'Kostencalculator', sub: 'Wat een volledige trade echt kost op elk — voer je positiegrootte en handelsfrequentie in.', pos: 'Positiegrootte (USD)', freq: 'Rondes / maand', rt: 'Per ronde', mo: 'Per maand', cheaper: 'goedkoper', save: 'Je bespaart', on: 'op', note: 'Taker-kosten, aan beide kanten op de volledige positie. Maker-orders (limiet) kosten minder; VIP-niveaus verlagen beide.', tie: 'De basis-takerkosten zijn identiek op deze twee.' },
  ru: { title: 'Калькулятор комиссий', sub: 'Сколько на самом деле стоит полный цикл сделки на каждой бирже — укажите размер позиции и как часто вы торгуете.', pos: 'Размер позиции (USD)', freq: 'Циклов сделок / месяц', rt: 'За цикл', mo: 'В месяц', cheaper: 'дешевле', save: 'Вы экономите', on: 'на', note: 'Комиссии тейкера, взимаются с полной позиции с обеих сторон. Ордера мейкера (лимитные) дешевле; VIP-уровни снижают обе.', tie: 'Базовые комиссии тейкера у этих двух одинаковы.' },
  tr: { title: 'Ücret hesaplayıcı', sub: 'Her birinde bir gidiş-dönüşün gerçekte ne kadara mal olduğunu görün — pozisyon büyüklüğünüzü ve ne sıklıkta işlem yaptığınızı girin.', pos: 'Pozisyon büyüklüğü (USD)', freq: 'Ay başına gidiş-dönüş', rt: 'Gidiş-dönüş başına', mo: 'Ay başına', cheaper: 'daha ucuz', save: 'Tasarruf edersiniz:', on: '·', note: 'Taker ücretleri, tüm pozisyon üzerinden her iki tarafta alınır. Maker (limit) emirleri daha ucuzdur; VIP kademeleri ikisini de düşürür.', tie: 'Temel taker ücretleri bu ikisinde aynıdır.' },
  zh: { title: '手续费计算器', sub: '在每个平台上完成一次开平仓实际花费多少——输入你的仓位规模和交易频率。', pos: '仓位规模 (USD)', freq: '每月开平仓次数', rt: '每次开平仓', mo: '每月', cheaper: '更便宜', save: '可节省', on: '·', note: 'Taker 手续费，按完整仓位双向收取。Maker（限价）单更便宜；VIP 等级会同时降低两者。', tie: '这两家的基础 taker 手续费相同。' },
  ja: { title: '手数料計算ツール', sub: '各取引所で1往復の取引が実際にいくらかかるか——ポジションサイズと取引頻度を入力してください。', pos: 'ポジションサイズ (USD)', freq: '1か月の往復回数', rt: '1往復あたり', mo: '1か月あたり', cheaper: 'お得', save: '節約額:', on: '·', note: 'テイカー手数料、全ポジションに両側で課金。メイカー（指値）注文は安く、VIP段階で両方下がります。', tie: 'この2つは基本テイカー手数料が同じです。' },
  ko: { title: '수수료 계산기', sub: '각 거래소에서 왕복 거래가 실제로 얼마인지 — 포지션 크기와 거래 빈도를 입력하세요.', pos: '포지션 크기 (USD)', freq: '월 왕복 횟수', rt: '왕복당', mo: '월', cheaper: '더 저렴', save: '절약액:', on: '·', note: '테이커 수수료, 전체 포지션에 양쪽으로 부과됩니다. 메이커(지정가) 주문은 더 저렴하고 VIP 등급은 둘 다 낮춥니다.', tie: '이 둘은 기본 테이커 수수료가 동일합니다.' },
  ar: { title: 'حاسبة الرسوم', sub: 'كم تكلّف صفقة ذهاب وإياب فعليًا على كل منصة — أدخل حجم مركزك وعدد مرات تداولك.', pos: 'حجم المركز (USD)', freq: 'صفقات كاملة / شهريًا', rt: 'لكل صفقة كاملة', mo: 'شهريًا', cheaper: 'أرخص', save: 'توفّر', on: 'على', note: 'رسوم التيكر، تُحتسب على كامل المركز من الجانبين. أوامر الميكر (الحد) أرخص؛ ومستويات VIP تخفّض الاثنين.', tie: 'رسوم التيكر الأساسية متطابقة بين هاتين المنصتين.' },
  id: { title: 'Kalkulator biaya', sub: 'Berapa biaya sebenarnya satu putaran penuh di masing-masing — masukkan ukuran posisi dan seberapa sering Anda trading.', pos: 'Ukuran posisi (USD)', freq: 'Putaran penuh / bulan', rt: 'Per putaran', mo: 'Per bulan', cheaper: 'lebih murah', save: 'Anda hemat', on: 'di', note: 'Biaya taker, dikenakan pada posisi penuh di kedua sisi. Order maker (limit) lebih murah; tingkat VIP memangkas keduanya.', tie: 'Biaya taker dasar kedua bursa ini sama.' },
};

const FEEC_CSS = `
  .feec{background:linear-gradient(180deg,var(--panel),#0d0f12);border:1px solid var(--line-bright);border-radius:16px;padding:18px 20px;margin:22px 0}
  .feec-h{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:18px;margin:0 0 3px}
  .feec-sub{color:var(--ink-dim);font-size:13.5px;margin:0 0 14px;line-height:1.5}
  .feec-in{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
  @media(max-width:520px){.feec-in{grid-template-columns:1fr}}
  .feec-in label{display:flex;flex-direction:column;gap:6px;font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-dim)}
  .feec-in input{background:#0a0d11;border:1px solid var(--line-bright);border-radius:10px;padding:11px 13px;color:var(--ink);font-family:'Space Mono',monospace;font-size:16px;outline:none}
  .feec-in input:focus{border-color:#c2f64a}
  .feec-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .feec-ex{background:#0c0f13;border:1px solid var(--line);border-radius:12px;padding:12px 14px;text-align:center}
  .feec-nm{display:block;font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:15px;margin-bottom:6px}
  .feec-rt{display:block;font-family:'Space Mono',monospace;font-size:22px;color:#c2f64a;line-height:1.1}
  .feec-mo{display:block;font-family:'Space Mono',monospace;font-size:15px;color:var(--ink);margin-top:8px}
  .feec-ex small{display:block;font-family:'Space Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-faint)}
  .feec-verdict{margin:13px 0 0;padding:11px 14px;border-radius:10px;background:rgba(194,246,74,.06);border:1px solid var(--line);font-size:14px;line-height:1.5;color:var(--ink-dim);text-align:center}
  .feec-verdict.on{border-color:rgba(194,246,74,.35);color:var(--ink)}
  .feec-verdict b{color:#c2f64a}
  .feec-note{font-size:11.5px;color:var(--ink-faint);margin:10px 0 0;line-height:1.5}`;

function feeWidget(a, b, lang) {
  const L = FCL[lang || 'en'] || FCL.en;
  const j = s => JSON.stringify(s);
  return `<div class="feec" data-at="${a.taker}" data-bt="${b.taker}" data-an="${a.name}" data-bn="${b.name}">
    <div class="feec-h">${L.title} — ${a.name} vs ${b.name}</div>
    <p class="feec-sub">${L.sub}</p>
    <div class="feec-in">
      <label>${L.pos}<input type="number" class="feec-pos" value="10000" min="0" step="any" inputmode="decimal"></label>
      <label>${L.freq}<input type="number" class="feec-n" value="20" min="0" step="1" inputmode="numeric"></label>
    </div>
    <div class="feec-grid">
      <div class="feec-ex"><span class="feec-nm">${a.name}</span><b class="feec-rt" data-x="a">—</b><small>${L.rt}</small><span class="feec-mo" data-x="a">—</span><small>${L.mo}</small></div>
      <div class="feec-ex"><span class="feec-nm">${b.name}</span><b class="feec-rt" data-x="b">—</b><small>${L.rt}</small><span class="feec-mo" data-x="b">—</span><small>${L.mo}</small></div>
    </div>
    <div class="feec-verdict">—</div>
    <p class="feec-note">${L.note}</p>
  </div>
  <script>(function(){var s=document.currentScript,w=s&&s.previousElementSibling;if(!w||!w.classList||!w.classList.contains('feec')){var all=document.querySelectorAll('.feec');w=all[all.length-1];}if(!w)return;
    var at=+w.getAttribute('data-at'),bt=+w.getAttribute('data-bt'),an=w.getAttribute('data-an'),bn=w.getAttribute('data-bn');
    var pos=w.querySelector('.feec-pos'),n=w.querySelector('.feec-n');
    function money(v){return '$'+(+v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
    function calc(){var p=Math.max(0,+pos.value||0),c=Math.max(0,+n.value||0);
      var ra=p*at/100*2,rb=p*bt/100*2,ma=ra*c,mb=rb*c;
      w.querySelector('.feec-rt[data-x=a]').textContent=money(ra);w.querySelector('.feec-rt[data-x=b]').textContent=money(rb);
      w.querySelector('.feec-mo[data-x=a]').textContent=money(ma);w.querySelector('.feec-mo[data-x=b]').textContent=money(mb);
      var v=w.querySelector('.feec-verdict');
      if(at===bt){v.textContent=${j(L.tie)};v.className='feec-verdict';}
      else{var cheap=at<bt?an:bn,diff=Math.abs(ma-mb);v.innerHTML='<b>'+cheap+'</b> '+${j(L.cheaper)}+' — '+${j(L.save)}+' <b>'+money(diff)+'</b> '+${j(L.on)}+' '+cheap+' '+${j('(' + L.mo.toLowerCase() + ')')}+'.';v.className='feec-verdict on';}
    }
    pos.addEventListener('input',calc);n.addEventListener('input',calc);calc();
  })();</script>`;
}

module.exports = { FCL, FEEC_CSS, feeWidget };
