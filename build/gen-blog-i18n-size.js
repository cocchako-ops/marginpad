/* Translated versions of the Position Size guide for tier-1/EU SEO, with hreflang.
   /blog/how-to-calculate-position-size/<lang>/   Run: node build/gen-blog-i18n-size.js
   Run AFTER gen-blog.js (it owns this cluster's hreflang). */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const SLUG = 'how-to-calculate-position-size';
const BASE = 'https://marginpad.io/blog/' + SLUG + '/';

// Concise, accurate explainer translated for the named tier-1 markets + major EU (English original lives at the base URL).
const T = {
  de: { lang: 'de', name: 'Deutsch', title: 'Positionsgröße bei Krypto-Futures berechnen', desc: 'Die risikobasierte Formel für die Positionsgröße — lege dein Risiko pro Trade und deinen Stop-Abstand fest, und die Mathematik bestimmt die Größe.', lead: 'Deine Positionsgröße sollte sich daraus ergeben, wie viel du zu verlieren bereit bist — nicht aus dem Hebel. Hier sind die Formel und ein Rechenbeispiel.', h2a: 'Die Formel für die Positionsgröße', pa: 'Risiko pro Trade (ein fester Prozentsatz deines Kontos, meist 1–2 %) geteilt durch deinen Stop-Loss-Abstand ergibt deine Positionsgröße. In Einheiten: Menge = (Konto × Risiko%) ÷ |Einstieg − Stop|. Die Position verliert genau dein gewähltes Risiko, wenn der Stop ausgelöst wird — egal welcher Hebel.', h2b: 'Rechenbeispiel', pb: 'Ein 5.000-$-Konto, das 1 % (50 $) riskiert, long BTC bei 60.000 $ mit Stop bei 58.800 $ (2 % Abstand), ergibt eine Position von 2.500 $ (etwa 0,0417 BTC). Wird der Stop erreicht, verlierst du genau 50 $ — 1 %.', cta: 'Berechne deine genaue Positionsgröße mit dem kostenlosen Rechner →' },
  fr: { lang: 'fr', name: 'Français', title: 'Calculer la taille de position en futures crypto', desc: 'La formule de taille de position basée sur le risque — fixez votre risque par trade et la distance du stop, et le calcul décide de la taille.', lead: 'Votre taille de position doit découler de ce que vous êtes prêt à perdre, pas de l’effet de levier. Voici la formule et un exemple chiffré.', h2a: 'La formule de taille de position', pa: 'Le risque par trade (un pourcentage fixe de votre compte, souvent 1–2 %) divisé par la distance de votre stop-loss donne votre taille de position. En unités : quantité = (compte × risque%) ÷ |entrée − stop|. La position perd exactement le risque choisi si le stop est touché — quel que soit le levier.', h2b: 'Exemple chiffré', pb: 'Un compte de 5 000 $ risquant 1 % (50 $), long BTC à 60 000 $ avec un stop à 58 800 $ (2 % de distance), donne une position de 2 500 $ (environ 0,0417 BTC). Si le stop est touché, vous perdez exactement 50 $ — 1 %.', cta: 'Trouvez votre taille de position exacte avec la calculatrice gratuite →' },
  sv: { lang: 'sv', name: 'Svenska', title: 'Beräkna positionsstorlek för kryptoterminer', desc: 'Den riskbaserade formeln för positionsstorlek — bestäm din risk per affär och ditt stopavstånd, så avgör matematiken storleken.', lead: 'Din positionsstorlek ska komma från hur mycket du är beredd att förlora — inte från hävstången. Här är formeln och ett räkneexempel.', h2a: 'Formeln för positionsstorlek', pa: 'Risk per affär (en fast procent av ditt konto, oftast 1–2 %) delat med ditt stop-loss-avstånd ger din positionsstorlek. I enheter: antal = (konto × risk%) ÷ |ingång − stop|. Positionen förlorar exakt din valda risk om stoppen träffas — oavsett hävstång.', h2b: 'Räkneexempel', pb: 'Ett konto på 5 000 $ som riskerar 1 % (50 $), lång BTC vid 60 000 $ med stop vid 58 800 $ (2 % avstånd), ger en position på 2 500 $ (cirka 0,0417 BTC). Om stoppen träffas förlorar du exakt 50 $ — 1 %.', cta: 'Hitta din exakta positionsstorlek med den gratis kalkylatorn →' },
  no: { lang: 'no', name: 'Norsk', title: 'Beregn posisjonsstørrelse for kryptofutures', desc: 'Den risikobaserte formelen for posisjonsstørrelse — bestem risiko per handel og stopavstand, så avgjør matematikken størrelsen.', lead: 'Posisjonsstørrelsen din bør komme fra hvor mye du er villig til å tape — ikke fra giringen. Her er formelen og et regneeksempel.', h2a: 'Formelen for posisjonsstørrelse', pa: 'Risiko per handel (en fast prosent av kontoen din, vanligvis 1–2 %) delt på stop-loss-avstanden gir posisjonsstørrelsen. I enheter: antall = (konto × risiko%) ÷ |inngang − stop|. Posisjonen taper nøyaktig din valgte risiko hvis stoppen treffes — uansett giring.', h2b: 'Regneeksempel', pb: 'En konto på 5 000 $ som risikerer 1 % (50 $), long BTC ved 60 000 $ med stop ved 58 800 $ (2 % avstand), gir en posisjon på 2 500 $ (rundt 0,0417 BTC). Hvis stoppen treffes, taper du nøyaktig 50 $ — 1 %.', cta: 'Finn din nøyaktige posisjonsstørrelse med den gratis kalkulatoren →' },
  da: { lang: 'da', name: 'Dansk', title: 'Beregn positionsstørrelse for kryptofutures', desc: 'Den risikobaserede formel for positionsstørrelse — fastsæt din risiko pr. handel og din stopafstand, så afgør matematikken størrelsen.', lead: 'Din positionsstørrelse bør komme fra, hvor meget du er villig til at tabe — ikke fra gearingen. Her er formlen og et regneeksempel.', h2a: 'Formlen for positionsstørrelse', pa: 'Risiko pr. handel (en fast procent af din konto, typisk 1–2 %) divideret med din stop-loss-afstand giver din positionsstørrelse. I enheder: antal = (konto × risiko%) ÷ |indgang − stop|. Positionen taber præcis din valgte risiko, hvis stoppet rammes — uanset gearing.', h2b: 'Regneeksempel', pb: 'En konto på 5.000 $ der risikerer 1 % (50 $), long BTC ved 60.000 $ med stop ved 58.800 $ (2 % afstand), giver en position på 2.500 $ (cirka 0,0417 BTC). Hvis stoppet rammes, taber du præcis 50 $ — 1 %.', cta: 'Find din præcise positionsstørrelse med den gratis beregner →' },
  fi: { lang: 'fi', name: 'Suomi', title: 'Laske positiokoko kryptofutuureissa', desc: 'Riskiperusteinen positiokoon kaava — määritä riski per kauppa ja stop-etäisyys, niin matematiikka päättää koon.', lead: 'Positiokokosi pitäisi tulla siitä, kuinka paljon olet valmis häviämään — ei vivusta. Tässä on kaava ja laskuesimerkki.', h2a: 'Positiokoon kaava', pa: 'Riski per kauppa (kiinteä prosentti tilistäsi, yleensä 1–2 %) jaettuna stop-loss-etäisyydellä antaa positiokokosi. Yksiköissä: määrä = (tili × riski%) ÷ |sisääntulo − stop|. Positio häviää tasan valitsemasi riskin, jos stop osuu — vivusta riippumatta.', h2b: 'Laskuesimerkki', pb: '5 000 dollarin tili, joka riskeeraa 1 % (50 $), long BTC hintaan 60 000 $ stopilla 58 800 $ (2 %:n etäisyys), antaa 2 500 dollarin position (noin 0,0417 BTC). Jos stop osuu, häviät tasan 50 $ — 1 %.', cta: 'Selvitä tarkka positiokokosi ilmaisella laskurilla →' },
  nl: { lang: 'nl', name: 'Nederlands', title: 'Positiegrootte berekenen bij crypto-futures', desc: 'De risicogebaseerde formule voor positiegrootte — stel je risico per trade en je stopafstand in, en de wiskunde bepaalt de grootte.', lead: 'Je positiegrootte moet voortkomen uit hoeveel je bereid bent te verliezen — niet uit de hefboom. Hier is de formule en een rekenvoorbeeld.', h2a: 'De formule voor positiegrootte', pa: 'Risico per trade (een vast percentage van je account, meestal 1–2 %) gedeeld door je stop-loss-afstand geeft je positiegrootte. In eenheden: aantal = (account × risico%) ÷ |instap − stop|. De positie verliest precies je gekozen risico als de stop wordt geraakt — ongeacht de hefboom.', h2b: 'Rekenvoorbeeld', pb: 'Een account van $5.000 dat 1 % ($50) riskeert, long BTC op $60.000 met een stop op $58.800 (2 % afstand), geeft een positie van $2.500 (ongeveer 0,0417 BTC). Als de stop wordt geraakt, verlies je precies $50 — 1 %.', cta: 'Vind je exacte positiegrootte met de gratis calculator →' },
};

const LANGS = Object.keys(T);

function altLinks() {
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
<html lang="${t.lang}">
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
    <div class="callout"><a class="cta" href="/calculators?c=size">${t.cta}</a></div>
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
// refresh hreflang on the English original (strip any old set, inject the full current cluster — reciprocal)
try {
  const enFile = path.join(OUT, 'blog', SLUG, 'index.html');
  let en = fs.readFileSync(enFile, 'utf8');
  en = en.replace(/\n?<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>/g, '');
  if (en.indexOf('</head>') !== -1) {
    en = en.replace('</head>', altLinks() + '\n</head>');
    fs.writeFileSync(enFile, en);
    console.log('hreflang refreshed on English original (' + (LANGS.length + 2) + ' alternates)');
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
