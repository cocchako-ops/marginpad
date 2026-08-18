/* Translated versions of the PnL guide for tier-1/EU SEO, with hreflang.
   /blog/how-to-calculate-pnl/<lang>/   Run: node build/gen-blog-i18n-pnl.js  (AFTER gen-blog.js — it owns this cluster's hreflang). */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const SLUG = 'how-to-calculate-pnl';
const BASE = 'https://marginpad.io/blog/' + SLUG + '/';

const T = {
  de: { lang: 'de', name: 'Deutsch', title: 'PnL bei Krypto-Futures berechnen', desc: 'Die PnL-Formel für Krypto-Futures, mit Beispiel — und der Unterschied zwischen PnL und ROE.', lead: 'Dein PnL bei einem Futures-Trade ist einfach, sobald du die Formel kennst — hier ist sie, mit Beispiel und dem Unterschied zu ROE.', h2a: 'Die PnL-Formel', pa: 'PnL = (Ausstieg − Einstieg) × Menge für long, oder (Einstieg − Ausstieg) × Menge für short. Menge = Positionsnominal ÷ Einstieg. Eine 1.000-$-Position bei 60.000 $ Einstieg sind 0,0167 BTC; steigt BTC auf 63.000 $, beträgt dein Long-PnL +50 $.', h2b: 'PnL vs. ROE', pb: 'Diese 50 $ sind dein Dollar-PnL. ROE misst ihn an deiner Margin: bei 10× Hebel braucht die 1.000-$-Position 100 $ Margin, also sind 50 $ = 50 % ROE. Hebel ändert die prozentuale Rendite, nicht den Dollar-PnL.', cta: 'Berechne deinen genauen PnL und ROE mit dem kostenlosen Rechner →' },
  fr: { lang: 'fr', name: 'Français', title: 'Calculer le PnL en futures crypto', desc: 'La formule du PnL pour les futures crypto, avec un exemple — et la différence entre PnL et ROE.', lead: 'Votre PnL sur un trade de futures est simple une fois la formule connue — la voici, avec un exemple et la différence avec le ROE.', h2a: 'La formule du PnL', pa: 'PnL = (sortie − entrée) × quantité pour un long, ou (entrée − sortie) × quantité pour un short. Quantité = nominal de la position ÷ entrée. Une position de 1 000 $ à 60 000 $ d’entrée fait 0,0167 BTC ; si le BTC monte à 63 000 $, votre PnL long est de +50 $.', h2b: 'PnL vs ROE', pb: 'Ces 50 $ sont votre PnL en dollars. Le ROE le mesure par rapport à votre marge : à 10× de levier, la position de 1 000 $ exige 100 $ de marge, donc 50 $ = 50 % de ROE. Le levier change le rendement en %, pas le PnL en dollars.', cta: 'Calculez votre PnL et ROE exacts avec la calculatrice gratuite →' },
  sv: { lang: 'sv', name: 'Svenska', title: 'Beräkna PnL för kryptoterminer', desc: 'PnL-formeln för kryptoterminer, med exempel — och skillnaden mellan PnL och ROE.', lead: 'Din PnL på en terminsaffär är enkel när du kan formeln — här är den, med exempel och skillnaden mot ROE.', h2a: 'PnL-formeln', pa: 'PnL = (utgång − ingång) × antal för lång, eller (ingång − utgång) × antal för kort. Antal = positionens nominella belopp ÷ ingång. En position på 1 000 $ vid 60 000 $ ingång är 0,0167 BTC; om BTC stiger till 63 000 $ blir din långa PnL +50 $.', h2b: 'PnL vs ROE', pb: 'De 50 $ är din PnL i dollar. ROE mäter den mot din margin: vid 10× hävstång kräver positionen på 1 000 $ 100 $ margin, så 50 $ = 50 % ROE. Hävstång ändrar procentavkastningen, inte PnL i dollar.', cta: 'Beräkna din exakta PnL och ROE med den gratis kalkylatorn →' },
  no: { lang: 'no', name: 'Norsk', title: 'Beregn PnL for kryptofutures', desc: 'PnL-formelen for kryptofutures, med eksempel — og forskjellen mellom PnL og ROE.', lead: 'PnL-en din på en futureshandel er enkel når du kan formelen — her er den, med eksempel og forskjellen fra ROE.', h2a: 'PnL-formelen', pa: 'PnL = (utgang − inngang) × antall for long, eller (inngang − utgang) × antall for short. Antall = posisjonens nominelle beløp ÷ inngang. En posisjon på 1 000 $ ved 60 000 $ inngang er 0,0167 BTC; stiger BTC til 63 000 $, blir din long-PnL +50 $.', h2b: 'PnL vs ROE', pb: 'De 50 $ er PnL-en din i dollar. ROE måler den mot marginen din: ved 10× giring krever posisjonen på 1 000 $ 100 $ margin, så 50 $ = 50 % ROE. Giring endrer prosentavkastningen, ikke PnL i dollar.', cta: 'Beregn din nøyaktige PnL og ROE med den gratis kalkulatoren →' },
  da: { lang: 'da', name: 'Dansk', title: 'Beregn PnL for kryptofutures', desc: 'PnL-formlen for kryptofutures, med eksempel — og forskellen mellem PnL og ROE.', lead: 'Din PnL på en futureshandel er simpel, når du kender formlen — her er den, med eksempel og forskellen fra ROE.', h2a: 'PnL-formlen', pa: 'PnL = (udgang − indgang) × antal for long, eller (indgang − udgang) × antal for short. Antal = positionens nominelle beløb ÷ indgang. En position på 1.000 $ ved 60.000 $ indgang er 0,0167 BTC; stiger BTC til 63.000 $, bliver din long-PnL +50 $.', h2b: 'PnL vs ROE', pb: 'De 50 $ er din PnL i dollar. ROE måler den mod din margin: ved 10× gearing kræver positionen på 1.000 $ 100 $ margin, så 50 $ = 50 % ROE. Gearing ændrer procentafkastet, ikke PnL i dollar.', cta: 'Beregn din præcise PnL og ROE med den gratis beregner →' },
  fi: { lang: 'fi', name: 'Suomi', title: 'Laske PnL kryptofutuureissa', desc: 'PnL-kaava kryptofutuureille, esimerkin kanssa — ja ero PnL:n ja ROE:n välillä.', lead: 'PnL:si futuurikaupassa on yksinkertainen, kun tunnet kaavan — tässä se on, esimerkin kanssa ja ero ROE:hen.', h2a: 'PnL-kaava', pa: 'PnL = (ulostulo − sisääntulo) × määrä longille, tai (sisääntulo − ulostulo) × määrä shortille. Määrä = position nimellisarvo ÷ sisääntulo. 1 000 dollarin positio 60 000 dollarin sisääntulolla on 0,0167 BTC; jos BTC nousee 63 000 dollariin, long-PnL:si on +50 $.', h2b: 'PnL vs ROE', pb: 'Nuo 50 $ ovat dollarimääräinen PnL:si. ROE mittaa sitä suhteessa marginaaliisi: 10×:n vivulla 1 000 dollarin positio vaatii 100 $ marginaalia, joten 50 $ = 50 % ROE. Vipu muuttaa prosenttituottoa, ei dollarimääräistä PnL:ää.', cta: 'Laske tarkka PnL ja ROE ilmaisella laskurilla →' },
  nl: { lang: 'nl', name: 'Nederlands', title: 'PnL berekenen bij crypto-futures', desc: 'De PnL-formule voor crypto-futures, met voorbeeld — en het verschil tussen PnL en ROE.', lead: 'Je PnL op een futures-trade is eenvoudig zodra je de formule kent — hier is hij, met voorbeeld en het verschil met ROE.', h2a: 'De PnL-formule', pa: 'PnL = (exit − instap) × aantal voor long, of (instap − exit) × aantal voor short. Aantal = nominale waarde van de positie ÷ instap. Een positie van $1.000 op $60.000 instap is 0,0167 BTC; stijgt BTC naar $63.000, dan is je long-PnL +$50.', h2b: 'PnL vs ROE', pb: 'Die $50 is je PnL in dollars. ROE meet het tegen je margin: bij 10× hefboom vereist de positie van $1.000 $100 margin, dus $50 = 50% ROE. Hefboom verandert het procentuele rendement, niet de PnL in dollars.', cta: 'Bereken je exacte PnL en ROE met de gratis calculator →' },
};

const LANGS = Object.keys(T);

function altLinks() {
  let h = `<link rel="alternate" hreflang="x-default" href="${BASE}" />\n<link rel="alternate" hreflang="en" href="${BASE}" />`;
  for (const l of LANGS) h += `\n<link rel="alternate" hreflang="${l}" href="${BASE}${l}/" />`;
  return h;
}

function switcher(cur) {
  const items = [`<a href="${BASE}">English</a>`].concat(LANGS.map(l => l === cur ? `<b>${T[l].name}</b>` : `<a href="${BASE}${l}/">${T[l].name}</a>`));
  return `<p style="font-size:12px;color:var(--ink-faint);margin:0 0 20px;line-height:2"> ${items.join(' · ')}</p>`;
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
    <div class="callout"><a class="cta" href="/calculators?c=pnl">${t.cta}</a></div>
  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="/">Calculators</a> · <a href="/blog/">Blog</a> · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a></span>
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
