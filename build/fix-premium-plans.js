/* Two consumer plans (2026-09-18, owner): Premium $11.99, Premium Plus $100, Founder retired.
 *
 * A price change is a SITE-WIDE edit - the same lesson as the partner links three hours earlier. What makes this
 * one sharper is that some of the sentences did not just carry a stale number, they became FALSE: every page that
 * said "Ask AI is part of Premium" is wrong now that Ask AI is the one thing Premium does NOT include. A wrong
 * price costs a sale; a wrong promise costs a refund and the trust behind it.
 *
 * Three groups, deliberately separate:
 *   A. Ask-AI claims  -> Premium PLUS, in all 13 languages (a mechanical price swap here would have LIED).
 *   B. Everything else priced at $3.99 -> $11.99 (heatmap, about, JSON-LD, search index, balance threshold).
 *   C. Founder, which is no longer for sale.
 *
 * Idempotent. Run: node build/fix-premium-plans.js [--dry]
 */
const fs = require('fs'), path = require('path');

// A. Ask AI is Premium Plus now. Whole values, not a number swap - the plan NAME changed too.
const AI_LINES = [
  ['"mcAiSignin":"Ask AI is part of Premium ($3.99/mo) - sign in and upgrade to ask about this chart."',
   '"mcAiSignin":"Ask AI is part of Premium Plus ($100/mo) - sign in and upgrade to ask about this chart."'],
  ['"mcAiSignin":"Ask AI forma parte de Premium (3,99 $/mes): inicia sesión y mejora tu plan para preguntar sobre este gráfico."',
   '"mcAiSignin":"Ask AI forma parte de Premium Plus (100 $/mes): inicia sesión y mejora tu plan para preguntar sobre este gráfico."'],
  ['"mcAiSignin":"Ask AI gehört zu Premium (3,99 $/Monat) - melde dich an und upgrade, um zu diesem Chart zu fragen."',
   '"mcAiSignin":"Ask AI gehört zu Premium Plus (100 $/Monat) - melde dich an und upgrade, um zu diesem Chart zu fragen."'],
  ['"mcAiSignin":"Ask AI fait partie de Premium (3,99 $/mois) - connectez-vous et passez à Premium pour interroger ce graphique."',
   '"mcAiSignin":"Ask AI fait partie de Premium Plus (100 $/mois) - connectez-vous et passez à Premium Plus pour interroger ce graphique."'],
  ['"mcAiSignin":"O Ask AI faz parte do Premium (US$ 3,99/mês) - entre e faça upgrade para perguntar sobre este gráfico."',
   '"mcAiSignin":"O Ask AI faz parte do Premium Plus (US$ 100/mês) - entre e faça upgrade para perguntar sobre este gráfico."'],
  ['"mcAiSignin":"Ask AI входит в Premium ($3,99/мес) - войдите и оформите Premium, чтобы спросить об этом графике."',
   '"mcAiSignin":"Ask AI входит в Premium Plus ($100/мес) - войдите и оформите Premium Plus, чтобы спросить об этом графике."'],
  ['"mcAiSignin":"Ask AI, Premium\'a dahildir (ayda 3,99 $) - bu grafik hakkında sormak için giriş yapıp yükseltin."',
   '"mcAiSignin":"Ask AI, Premium Plus\'a dahildir (ayda 100 $) - bu grafik hakkında sormak için giriş yapıp yükseltin."'],
  ['"mcAiSignin":"Ask AI 属于 Premium（每月 3.99 美元）--登录并升级后即可询问此图表。"',
   '"mcAiSignin":"Ask AI 属于 Premium Plus（每月 100 美元）--登录并升级后即可询问此图表。"'],
  ['"mcAiSignin":"Ask AI はPremium（月額3.99ドル）の機能です。ログインしてアップグレードすると、このチャートについて質問できます。"',
   '"mcAiSignin":"Ask AI はPremium Plus（月額100ドル）の機能です。ログインしてアップグレードすると、このチャートについて質問できます。"'],
  ['"mcAiSignin":"Ask AI는 Premium(월 $3.99) 기능입니다. 로그인 후 업그레이드하면 이 차트에 대해 질문할 수 있습니다."',
   '"mcAiSignin":"Ask AI는 Premium Plus(월 $100) 기능입니다. 로그인 후 업그레이드하면 이 차트에 대해 질문할 수 있습니다."'],
  ['"mcAiSignin":"Ask AI جزء من Premium (3.99 دولار شهرياً) - سجّل الدخول وقم بالترقية لتسأل عن هذا الرسم."',
   '"mcAiSignin":"Ask AI جزء من Premium Plus (100 دولار شهرياً) - سجّل الدخول وقم بالترقية لتسأل عن هذا الرسم."'],
  ['"mcAiSignin":"Ask AI adalah bagian dari Premium ($3,99/bulan) - masuk dan upgrade untuk bertanya tentang grafik ini."',
   '"mcAiSignin":"Ask AI adalah bagian dari Premium Plus ($100/bulan) - masuk dan upgrade untuk bertanya tentang grafik ini."'],
  ['"mcAiSignin":"Ask AI hoort bij Premium ($3,99/maand) - log in en upgrade om over deze grafiek te vragen."',
   '"mcAiSignin":"Ask AI hoort bij Premium Plus ($100/maand) - log in en upgrade om over deze grafiek te vragen."'],
  // the two chart gates
  ['It is part of MarginPad Premium ($3.99/mo)', 'It is part of MarginPad Premium Plus ($100/mo)'],
  ['<b>Ask AI is a Premium feature.</b>', '<b>Ask AI is a Premium Plus feature.</b>'],
  ['AI chart assistant (Premium, 50 questions/day)', 'AI chart assistant (Premium Plus, 50 questions/day)'],
];

// B. Everything still priced at the old monthly number. Ask-AI lines are already handled above, so nothing
// here can turn a corrected sentence back into a wrong one.
const PRICE = [
  ['Premium ($3.99/mo)', 'Premium ($11.99/mo)'],
  ['Premium ($3.99/mes)', 'Premium ($11.99/mes)'],
  ['Premium a $3.99/mes', 'Premium a $11.99/mes'],
  ['$3.99/mo', '$11.99/mo'],
  ['$3.99/mes', '$11.99/mes'],
  ['$3.99 al mes', '$11.99 al mes'],
  ['$3.99 a month', '$11.99 a month'],
  ['"price": "3.99"', '"price": "11.99"'],
  ['"price":"3.99"', '"price":"11.99"'],
  ['| $3.99/mo', '| $11.99/mo'],
];

// C. Founder is retired. It is kept by the one member who paid for it and is never offered again.
const FOUNDER = [
  ['($3.99 al mes, o un pago único como Founder)', '($11.99 al mes)'],
  ['(o un pago único como Founder)', ''],
  [', or a one-time Founder payment', ''],
  [' or a one-off Founder payment', ''],
];

const DRY = process.argv.includes('--dry');
const EXT = /\.(html|js|txt|json)$/i;
const SKIPDIR = /^(node_modules|\.git|og-images|ops-shots|vault-shots)$/;
const SKIPFILE = /fix-premium-plans\.js$/;
const SUBS = AI_LINES.concat(PRICE).concat(FOUNDER);

let files = 0, changed = 0;
const hits = Object.create(null);
function patch(p) {
  let s; try { s = fs.readFileSync(p, 'utf8'); } catch (e) { return; }
  files++;
  const before = s;
  for (const [from, to] of SUBS) {
    if (!from || s.indexOf(from) < 0) continue;
    hits[from] = (hits[from] || 0) + s.split(from).length - 1;
    s = s.split(from).join(to);   // split/join only - never a replacement string
  }
  if (s === before) return;
  changed++;
  if (DRY) { console.log('  would patch ' + path.relative(process.cwd(), p).replace(/\\/g, '/')); return; }
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(s, 'utf8'));
  fs.renameSync(tmp, p);
}
function walk(d) {
  let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
  for (const f of ents) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!SKIPDIR.test(f.name)) walk(p); continue; }
    if (EXT.test(f.name) && !SKIPFILE.test(f.name)) patch(p);
  }
}
['dist', 'src', 'app', 'build'].forEach(walk);
console.log((DRY ? '[dry] ' : '') + 'scanned ' + files + ', changed ' + changed);
for (const k of Object.keys(hits)) console.log('  ' + String(hits[k]).padStart(5) + '  ' + k.slice(0, 96));
