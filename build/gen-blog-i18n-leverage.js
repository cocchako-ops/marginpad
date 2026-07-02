/* Translated versions of the Leverage guide for tier-1/EU SEO, with hreflang.
   /blog/best-leverage-for-beginners/<lang>/   Run: node build/gen-blog-i18n-leverage.js  (AFTER gen-blog.js — it owns this cluster's hreflang). */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const SLUG = 'best-leverage-for-beginners';
const BASE = 'https://marginpad.io/blog/' + SLUG + '/';

const T = {
  de: { lang: 'de', name: 'Deutsch', title: 'Wie viel Hebel sollten Anfänger nutzen?', desc: 'Hebel vervielfacht Position und Liquidationsrisiko. So wählst du als Anfänger einen vernünftigen Hebel.', lead: 'Hebel vervielfacht deine Position — und dein Liquidationsrisiko. So wählst du als Anfänger einen vernünftigen Wert.', h2a: 'Was Hebel wirklich macht', pa: 'Hebel vergrößert nicht deinen Vorteil — er verkleinert die Bewegung, die dich auslöscht. Bei 100× ist eine Bewegung von ~1 % gegen dich die Liquidation; bei 10× braucht es ~9–10 %; bei 5× ~18 %. Mehr Hebel = weniger Spielraum, richtig zu liegen.', h2b: 'Ein anfängersicherer Bereich', pb: 'Die meisten Profis riskieren einen festen Prozentsatz pro Trade und halten den Hebel niedrig — typischerweise 3–5× — damit normale Schwankungen sie nicht liquidieren. Fang dort an, setze einen Stop, und erhöhe den Hebel erst, wenn du auf Papier dauerhaft profitabel bist.', cta: 'Übe risikofrei mit jedem Hebel auf Paper Trade →' },
  fr: { lang: 'fr', name: 'Français', title: 'Quel effet de levier pour un débutant ?', desc: 'L’effet de levier multiplie la position et le risque de liquidation. Comment choisir un niveau raisonnable quand on débute.', lead: 'L’effet de levier multiplie votre position — et votre risque de liquidation. Voici comment choisir un niveau raisonnable en tant que débutant.', h2a: 'Ce que fait vraiment le levier', pa: 'Le levier n’augmente pas votre avantage — il réduit le mouvement qui vous élimine. À 100×, un mouvement d’environ 1 % contre vous, c’est la liquidation ; à 10× il faut ~9–10 % ; à 5×, ~18 %. Plus de levier = moins de marge pour avoir raison.', h2b: 'Une plage sûre pour débuter', pb: 'La plupart des pros risquent un pourcentage fixe par trade et gardent un levier faible — généralement 3–5× — pour que la volatilité normale ne les liquide pas. Commencez là, placez un stop, et n’augmentez le levier qu’une fois régulièrement rentable sur papier.', cta: 'Entraînez-vous sans risque à tout effet de levier sur Paper Trade →' },
  sv: { lang: 'sv', name: 'Svenska', title: 'Hur mycket hävstång bör nybörjare använda?', desc: 'Hävstång multiplicerar position och likvidationsrisk. Så väljer du en rimlig nivå som nybörjare.', lead: 'Hävstång multiplicerar din position — och din likvidationsrisk. Så väljer du en rimlig nivå som nybörjare.', h2a: 'Vad hävstång egentligen gör', pa: 'Hävstång ökar inte din edge — den krymper rörelsen som slår ut dig. Vid 100× är en rörelse på ~1 % emot dig likvidation; vid 10× krävs ~9–10 %; vid 5×, ~18 %. Mer hävstång = mindre marginal att ha rätt.', h2b: 'Ett nybörjarsäkert intervall', pb: 'De flesta proffs riskerar en fast procent per affär och håller hävstången låg — vanligtvis 3–5× — så att normal volatilitet inte likviderar dem. Börja där, sätt en stop, och höj hävstången först när du är stabilt lönsam på papper.', cta: 'Öva riskfritt med valfri hävstång på Paper Trade →' },
  no: { lang: 'no', name: 'Norsk', title: 'Hvor mye giring bør nybegynnere bruke?', desc: 'Giring multipliserer posisjon og likvidasjonsrisiko. Slik velger du et fornuftig nivå som nybegynner.', lead: 'Giring multipliserer posisjonen din — og likvidasjonsrisikoen. Slik velger du et fornuftig nivå som nybegynner.', h2a: 'Hva giring faktisk gjør', pa: 'Giring øker ikke fordelen din — den krymper bevegelsen som slår deg ut. Ved 100× er en bevegelse på ~1 % mot deg likvidasjon; ved 10× kreves ~9–10 %; ved 5×, ~18 %. Mer giring = mindre margin for å ha rett.', h2b: 'Et nybegynnersikkert område', pb: 'De fleste proffer risikerer en fast prosent per handel og holder giringen lav — vanligvis 3–5× — slik at normal volatilitet ikke likviderer dem. Start der, sett en stop, og øk giringen først når du er stabilt lønnsom på papir.', cta: 'Øv risikofritt med hvilken som helst giring på Paper Trade →' },
  da: { lang: 'da', name: 'Dansk', title: 'Hvor meget gearing bør begyndere bruge?', desc: 'Gearing multiplicerer position og likvidationsrisiko. Sådan vælger du et fornuftigt niveau som begynder.', lead: 'Gearing multiplicerer din position — og din likvidationsrisiko. Sådan vælger du et fornuftigt niveau som begynder.', h2a: 'Hvad gearing reelt gør', pa: 'Gearing øger ikke din fordel — den formindsker den bevægelse, der slår dig ud. Ved 100× er en bevægelse på ~1 % imod dig likvidation; ved 10× kræves ~9–10 %; ved 5×, ~18 %. Mere gearing = mindre margin for at have ret.', h2b: 'Et begyndersikkert interval', pb: 'De fleste professionelle risikerer en fast procent pr. handel og holder gearingen lav — typisk 3–5× — så normal volatilitet ikke likviderer dem. Start der, sæt en stop, og hæv først gearingen, når du er stabilt profitabel på papir.', cta: 'Øv risikofrit med enhver gearing på Paper Trade →' },
  fi: { lang: 'fi', name: 'Suomi', title: 'Kuinka paljon vipua aloittelijan kannattaa käyttää?', desc: 'Vipu kertoo position ja likvidaatioriskin. Näin valitset järkevän tason aloittelijana.', lead: 'Vipu kertoo positiosi — ja likvidaatioriskisi. Näin valitset järkevän tason aloittelijana.', h2a: 'Mitä vipu todella tekee', pa: 'Vipu ei kasvata etuasi — se pienentää liikettä, joka pyyhkii sinut pois. 100×:llä noin 1 %:n liike sinua vastaan on likvidaatio; 10×:llä tarvitaan ~9–10 %; 5×:llä ~18 %. Enemmän vipua = vähemmän varaa olla oikeassa.', h2b: 'Aloittelijalle turvallinen vaihteluväli', pb: 'Useimmat ammattilaiset riskeeraavat kiinteän prosentin per kauppa ja pitävät vivun matalana — tyypillisesti 3–5× — jotta normaali volatiliteetti ei likvidoi heitä. Aloita siitä, aseta stop, ja nosta vipua vasta kun olet vakaasti voitollinen paperilla.', cta: 'Harjoittele riskittä millä tahansa vivulla Paper Tradessa →' },
  nl: { lang: 'nl', name: 'Nederlands', title: 'Hoeveel hefboom moeten beginners gebruiken?', desc: 'Hefboom vermenigvuldigt je positie en je liquidatierisico. Zo kies je als beginner een verstandig niveau.', lead: 'Hefboom vermenigvuldigt je positie — en je liquidatierisico. Zo kies je als beginner een verstandig niveau.', h2a: 'Wat hefboom echt doet', pa: 'Hefboom vergroot je voordeel niet — het verkleint de beweging die je wegvaagt. Bij 100× is een beweging van ~1 % tegen je liquidatie; bij 10× is ~9–10 % nodig; bij 5×, ~18 %. Meer hefboom = minder ruimte om gelijk te hebben.', h2b: 'Een veilig bereik voor beginners', pb: 'De meeste professionals riskeren een vast percentage per trade en houden de hefboom laag — meestal 3–5× — zodat normale volatiliteit hen niet liquideert. Begin daar, zet een stop, en verhoog de hefboom pas als je consistent winstgevend bent op papier.', cta: 'Oefen risicovrij met elke hefboom op Paper Trade →' },
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
    <div class="callout"><a class="cta" href="/paper-trade">${t.cta}</a></div>
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
