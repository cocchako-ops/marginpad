// PREMIUM GETS FIVE ASK-AI READS A DAY; PREMIUM PLUS BECOMES "PREMIUM AI+" AT $119 (2026-10-15, owner: "za obican
// premium plan da damo 5-10 AI promts/day ... skuplji AI plan spustimo za $40 (da navedemo kao popust) i da ga
// nazovemo nesto kao AI+ plan").
//
// The numbers live in ONE place in the worker (AI_DAILY, PREM_PLANS - `was` carries the struck price) and are
// published on GET /api/premium/status. Everything below is the COPY that quotes them: the page, its meta and
// JSON-LD, the four chart bundles, the 13 language packs' sign-in gate, the ops desk, and the generator that
// rebuilds the membership card. A reprice that misses a surface is a quiet lie (the API page carried $29 for 19
// days after moving to $39), so every pair here is applied with split/join and the script REFUSES on a missing
// anchor unless the new text is already in place.
//
// Idempotent. `node build/fix-premium-aiplus.js [--dry]`
const fs = require('fs');
const DRY = process.argv.indexOf('--dry') >= 0;
let touched = 0;

function patch(file, pairs, opt) {
  if (!fs.existsSync(file)) { if (!opt || !opt.optional) { console.error('REFUSING: missing ' + file); process.exit(1); } return; }
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  for (const [a, b] of pairs) {
    if (s.indexOf(a) < 0) {
      if (s.indexOf(b) >= 0) continue;                       // already applied
      if (opt && opt.soft) { console.log('  skip (not found in ' + file + '): ' + a.slice(0, 70)); continue; }
      console.error('REFUSING: anchor not found in ' + file + '\n  ' + a.slice(0, 120)); process.exit(1);
    }
    s = s.split(a).join(b);                                   // split/join only - never a replacement string
  }
  if (opt && opt.after) s = opt.after(s);
  if (s === before) return;
  touched++;
  console.log('  ' + file);
  if (DRY) return;
  fs.writeFileSync(file + '.tmp', Buffer.from(s, 'utf8'));
  fs.renameSync(file + '.tmp', file);
}

// ── /premium/ ────────────────────────────────────────────────────────────────────────────────────────────
const P = 'dist/premium/index.html';
const CSS = '<style id="aipluscss">.price .was{font-size:.42em;font-weight:600;color:var(--faint,#7c8794);text-decoration:line-through;margin-right:8px;vertical-align:middle;letter-spacing:0}'
  + '.btn .was{font-weight:500;opacity:.55;text-decoration:line-through;margin-left:6px;font-size:.92em}'
  + '.pt .off{display:inline-block;margin-left:8px;padding:2px 7px;border-radius:999px;background:rgba(194,246,74,.14);color:var(--lime,#c2f64a);font-size:10px;letter-spacing:.1em;vertical-align:middle}</style>';
patch(P, [
  ['$11.99/month, and it now includes one Ask AI read on your charts every day. Premium Plus raises that to 50 a day for $159/month - pay with crypto.',
   '$11.99/month, with 5 Ask AI reads on your charts every day. Premium AI+ raises that to 50 a day for $119/month (was $159) - pay with crypto.'],
  ['$11.99/mo, with one Ask AI read a day. Premium Plus raises it to 50 a day for $159/mo - pay with crypto.',
   '$11.99/mo, with 5 Ask AI reads a day. Premium AI+ raises it to 50 a day for $119/mo (was $159) - pay with crypto.'],
  ['"name": "Premium Plus - monthly", "price": "159.00"', '"name": "Premium AI+ - monthly", "price": "119.00"'],
  ['"description": "Everything in Premium, with Ask AI on the charts raised from one read a day to 50."',
   '"description": "Everything in Premium, with Ask AI on the charts raised from 5 reads a day to 50. $119 a month, down from $159."'],
  ['"priceSpecification": {"@type": "UnitPriceSpecification", "price": "159.00"', '"priceSpecification": {"@type": "UnitPriceSpecification", "price": "119.00"'],
  ['<button class="btn btn-ghost" data-buy="plus">Premium Plus - $159/mo</button>',
   '<button class="btn btn-ghost" data-buy="plus">Premium AI+ - $119/mo <s class="was">$159</s></button>'],
  ['Premium now includes <b>one Ask AI read on your charts every day</b>. It is the one feature that costs us money every time it runs, so Premium Plus is what raises it to 50 a day.',
   'Premium includes <b>5 Ask AI reads on your charts every day</b>. It is the one feature that costs us money every time it runs, so Premium AI+ is what raises it to 50 a day - now $119 a month, $40 off.'],
  ['One read a day on Premium, 50 a day on Premium Plus.', 'Five reads a day on Premium, 50 a day on Premium AI+.'],
  ['<b>One Ask AI read a day</b> on any chart', '<b>5 Ask AI reads a day</b> on any chart'],
  ['<div class="pt" style="color:var(--gold)">PREMIUM PLUS</div>', '<div class="pt" style="color:var(--gold)">PREMIUM AI+ <span class="off">$40 OFF</span></div>'],
  ['<div class="price">$159<small> /month</small></div>', '<div class="price"><s class="was">$159</s>$119<small> /month</small></div>'],
  ['Ask AI on your charts - <b>50 reads a day</b>, against one on Premium</li>', 'Ask AI on your charts - <b>50 reads a day</b>, against five on Premium</li>'],
  ['Get Premium Plus - $159/mo</button>', 'Get Premium AI+ - $119/mo</button>'],
  ['<span class="tag"><i></i>PREMIUM PLUS</span>', '<span class="tag"><i></i>PREMIUM AI+</span>'],
  ['At the Premium Plus ceiling of <b>50 reads a day</b>', 'At the Premium AI+ ceiling of <b>50 reads a day</b>'],
  ['and why Premium carries one read a day rather than fifty.', 'and why Premium carries five reads a day rather than fifty.'],
  ['Ask-AI on charts (one read a day; 50 a day on Premium Plus)', 'Ask-AI on charts (five reads a day; 50 a day on Premium AI+)'],
  ["var name=s.plus?'Premium Plus':'Premium';", "var name=s.plus?'Premium AI+':'Premium';"],
  ['__esT_premiumindex("premiumPlusIsActive",\'Premium Plus is active\')', '__esT_premiumindex("premiumPlusIsActive",\'Premium AI+ is active\')'],
  ['"premiumPlusIsActive":"Premium Plus está activo"', '"premiumPlusIsActive":"Premium AI+ está activo"'],
], { after: (s) => (s.indexOf('<style id="aipluscss">') >= 0 ? s : s.replace('</head>', () => CSS + '</head>')) });

// ── the chart bundles (EN + the inline Spanish dictionaries) ─────────────────────────────────────────────
patch('dist/assets/mp-charts.js', [
  ["' read a day with Premium ($11.99/mo)</b>, '", "' reads a day with Premium ($11.99/mo)</b>, '"],
  ["' a day with Premium Plus ($159/mo).<br><button", "' a day with Premium AI+ ($119/mo).<br><button"],
  ['" lectura al día con Premium ($11.99/mes)</b>, "', '" lecturas al día con Premium ($11.99/mes)</b>, "'],
  ['" al día con Premium Plus ($159/mes).<br><button', '" al día con Premium AI+ ($119/mes).<br><button'],
  ["__esT_mpcharts(\"thatWasYour\",'That was your ')", "__esT_mpcharts(\"thatWasYour\",'Those were your ')"],
  ["' read for today - it resets at midnight UTC. Premium Plus is '", "' reads for today - it resets at midnight UTC. Premium AI+ is '"],
  ['"thatWasYour":"Esa fue tu "', '"thatWasYour":"Esas fueron tus "'],
  ['"readForTodayIt":" lectura de hoy - se reinicia a medianoche UTC. Premium Plus ofrece "', '"readForTodayIt":" lecturas de hoy - se reinician a medianoche UTC. Premium AI+ ofrece "'],
]);
patch('dist/assets/mp-mcharts.js', [
  ["'That is your Ask AI read for today - it resets at midnight UTC. Premium Plus raises it to 50 a day.'", "'Those were your Ask AI reads for today - they reset at midnight UTC. Premium AI+ raises it to 50 a day.'"],
  ['"thatIsYourAsk":"Esa era tu lectura de Ask AI de hoy - se reinicia a medianoche UTC. Premium Plus la sube a 50 al día."', '"thatIsYourAsk":"Esas eran tus lecturas de Ask AI de hoy - se reinician a medianoche UTC. Premium AI+ las sube a 50 al día."'],
]);
patch('dist/assets/mp-auth.js', [
  ['one read a day on Premium, 50 on Premium Plus.', 'five reads a day on Premium, 50 on Premium AI+.'],
  ['una lectura al día en Premium, 50 en Premium Plus.', 'cinco lecturas al día en Premium, 50 en Premium AI+.'],
  ["'Ask AI on your charts - 1 read a day'", "'Ask AI on your charts - 5 reads a day'"],
  ['"askAiOnYour2":"Ask AI en tus gráficos - 1 lectura al día"', '"askAiOnYour2":"Ask AI en tus gráficos - 5 lecturas al día"'],
]);
patch('dist/assets/mp-screener.js', [
  ['"plusSp":"Premium Plus"', '"plusSp":"Premium AI+"'],
  ['T("plusSp","Premium Plus")', 'T("plusSp","Premium AI+")'],
]);

// ── the sign-in gate on the mobile chart, in 13 languages. These said "Premium Plus ($100/mo)" - a price that
//    lasted one afternoon on 2026-09-18 - and claimed Ask AI was Plus-only, which has been false since 09-19.
const GATE = [
  ['Ask AI is part of Premium Plus ($100/mo) - sign in and upgrade to ask about this chart.',
   'Ask AI comes with Premium ($11.99/mo, 5 reads a day) - sign in and upgrade to ask about this chart.'],
  ['Ask AI gehört zu Premium Plus (100 $/Monat) - melde dich an und upgrade, um zu diesem Chart zu fragen.',
   'Ask AI gehört zu Premium (11,99 $/Monat, 5 Analysen pro Tag) - melde dich an und upgrade, um zu diesem Chart zu fragen.'],
  ['Ask AI forma parte de Premium Plus (100 $/mes): inicia sesión y mejora tu plan para preguntar sobre este gráfico.',
   'Ask AI forma parte de Premium (11,99 $/mes, 5 lecturas al día): inicia sesión y mejora tu plan para preguntar sobre este gráfico.'],
  ['O Ask AI faz parte do Premium Plus (US$ 100/mês) - entre e faça upgrade para perguntar sobre este gráfico.',
   'O Ask AI faz parte do Premium (US$ 11,99/mês, 5 leituras por dia) - entre e faça upgrade para perguntar sobre este gráfico.'],
  ['Ask AI fait partie de Premium Plus (100 $/mois) - connectez-vous et passez à Premium Plus pour interroger ce graphique.',
   'Ask AI fait partie de Premium (11,99 $/mois, 5 lectures par jour) - connectez-vous et passez à Premium pour interroger ce graphique.'],
  ['Ask AI hoort bij Premium Plus ($100/maand) - log in en upgrade om over deze grafiek te vragen.',
   'Ask AI hoort bij Premium ($11,99/maand, 5 analyses per dag) - log in en upgrade om over deze grafiek te vragen.'],
  ['Ask AI входит в Premium Plus ($100/мес) - войдите и оформите Premium Plus, чтобы спросить об этом графике.',
   'Ask AI входит в Premium ($11,99/мес, 5 разборов в день) - войдите и оформите Premium, чтобы спросить об этом графике.'],
  ["Ask AI, Premium Plus'a dahildir (ayda 100 $) - bu grafik hakkında sormak için giriş yapıp yükseltin.",
   "Ask AI, Premium'a dahildir (ayda 11,99 $, günde 5 analiz) - bu grafik hakkında sormak için giriş yapıp yükseltin."],
  ['Ask AI 属于 Premium Plus（每月 100 美元）--登录并升级后即可询问此图表。',
   'Ask AI 属于 Premium（每月 11.99 美元，每天 5 次解读）--登录并升级后即可询问此图表。'],
  ['Ask AI はPremium Plus（月額100ドル）の機能です。ログインしてアップグレードすると、このチャートについて質問できます。',
   'Ask AI はPremium（月額11.99ドル、1日5回）の機能です。ログインしてアップグレードすると、このチャートについて質問できます。'],
  ['Ask AI는 Premium Plus(월 $100) 기능입니다. 로그인 후 업그레이드하면 이 차트에 대해 질문할 수 있습니다.',
   'Ask AI는 Premium(월 $11.99, 하루 5회) 기능입니다. 로그인 후 업그레이드하면 이 차트에 대해 질문할 수 있습니다.'],
  ['Ask AI جزء من Premium Plus (100 دولار شهرياً) - سجّل الدخول وقم بالترقية لتسأل عن هذا الرسم.',
   'Ask AI جزء من Premium (11.99 دولار شهرياً، 5 قراءات يومياً) - سجّل الدخول وقم بالترقية لتسأل عن هذا الرسم.'],
  ['Ask AI adalah bagian dari Premium Plus ($100/bulan) - masuk dan upgrade untuk bertanya tentang grafik ini.',
   'Ask AI adalah bagian dari Premium ($11,99/bulan, 5 pembacaan per hari) - masuk dan upgrade untuk bertanya tentang grafik ini.'],
];
patch('build/i18n-master.js', GATE);
patch('dist/assets/i18n.js', [GATE[0]]);                      // the slim loader carries the English master only
['de', 'es', 'pt', 'fr', 'nl', 'ru', 'tr', 'zh', 'ja', 'ko', 'ar', 'id'].forEach((l, i) => patch('dist/assets/i18n/' + l + '.js', [GATE[i + 1]]));

// ── the ops desk + the generator that rebuilds the membership card ───────────────────────────────────────
patch('src/ops/client/ops.js.txt', [['A Premium Plus member is capped at <b>50</b>', 'A Premium AI+ member is capped at <b>50</b>']]);
patch('build/fix-premium-status.js', [["var name=s.plus?'Premium Plus':'Premium';", "var name=s.plus?'Premium AI+':'Premium';"]]);

// ── the AI layer: an assistant quotes these files verbatim ───────────────────────────────────────────────
const LINE = '- 2026-10-15: PREMIUM NOW CARRIES FIVE ASK AI READS A DAY (was one), and the AI plan is renamed and repriced: "Premium Plus" is now **Premium AI+** at **$119/month, down from $159** ($40 off) - same plan id, same 50 Ask AI reads a day, everything in Premium included. Premium stays $11.99/month. Live figures: GET https://marginpad.io/api/premium/status (`aiDaily`, `plusPrice`, `plusWas`).';
// the dated line goes in ONCE: a header anchor is still there on the second run, so the guard is the line itself
const dated = (hdr) => (s) => (s.indexOf(LINE) >= 0 ? s : s.split(hdr + '\n').join(hdr + '\n' + LINE + '\n'));
patch('dist/llms.txt', [['Last updated: 2026-10-13', 'Last updated: 2026-10-15']], { after: dated('## Latest changes (newest first - cite these as current)') });
patch('dist/llms-full.txt', [['Last updated: 2026-10-13', 'Last updated: 2026-10-15']], { after: dated('## What changed recently') });

if (DRY) { console.log('(dry run) files that would change: ' + touched); process.exit(0); }
console.log('files changed: ' + touched);
