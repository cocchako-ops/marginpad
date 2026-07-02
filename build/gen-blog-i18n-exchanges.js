/* Translated versions of the "Best Crypto Futures Exchanges" commercial pillar, with hreflang.
   /blog/best-crypto-futures-exchanges/<lang>/   Run: node build/gen-blog-i18n-exchanges.js  (AFTER gen-blog.js — it owns this cluster's hreflang). */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const SLUG = 'best-crypto-futures-exchanges';
const BASE = 'https://marginpad.io/blog/' + SLUG + '/';

const T = {
  de: { lang: 'de', name: 'Deutsch', title: 'Beste Krypto-Futures-Börsen 2026', desc: 'Worauf es bei der Wahl einer Krypto-Futures-Börse wirklich ankommt — Liquidität, Gebühren, Hebel und Region — und wie die großen Plattformen abschneiden.', lead: '„Beste" hängt davon ab, wo du wohnst, was du handelst und wie gebührensensibel du bist. Hier zählen die Faktoren, die wirklich wichtig sind.', h2a: 'Was eine gute Futures-Börse ausmacht', pa: 'Vier Dinge entscheiden: <strong>Liquidität</strong> (enge Spreads, weniger Slippage), <strong>Gebühren</strong> (Maker/Taker summieren sich bei Hebel schnell), <strong>Hebel und Paare</strong> (die großen bieten bis zu 100×–125× auf BTC/ETH) und <strong>Region und Sicherheit</strong> (Verfügbarkeit und KYC unterscheiden sich je Land).', h2b: 'Die großen Plattformen', pb: 'Die tiefste Liquidität für Krypto-Perpetuals liegt bei <strong>Binance</strong>, <strong>Bybit</strong> und <strong>OKX</strong>; <strong>KuCoin</strong> und <strong>Gate</strong> listen viele kleinere Altcoin-Perps, <strong>Kraken</strong> ist eine etablierte, regulierungsnahe Option. Hebel, Gebühren und Verfügbarkeit variieren je Region — wähle nicht allein nach dem Hebel: mehr Hebel verkleinert nur die Bewegung, die dich liquidiert.', cta: 'Vergleiche die Top-Krypto-Futures-Börsen →' },
  fr: { lang: 'fr', name: 'Français', title: 'Meilleures plateformes de futures crypto 2026', desc: 'Ce qui compte vraiment pour choisir une plateforme de futures crypto — liquidité, frais, levier et région — et comment se comparent les grandes plateformes.', lead: '« Meilleure » dépend de votre pays, de ce que vous tradez et de votre sensibilité aux frais. Voici les facteurs qui comptent réellement.', h2a: 'Ce qui fait une bonne plateforme de futures', pa: 'Quatre éléments décident : la <strong>liquidité</strong> (spreads serrés, moins de slippage), les <strong>frais</strong> (maker/taker s’accumulent vite avec le levier), le <strong>levier et les paires</strong> (les grandes offrent jusqu’à 100×–125× sur BTC/ETH) et la <strong>région et la sécurité</strong> (disponibilité et KYC varient selon le pays).', h2b: 'Les grandes plateformes', pb: 'La liquidité la plus profonde pour les perpétuels crypto se trouve chez <strong>Binance</strong>, <strong>Bybit</strong> et <strong>OKX</strong> ; <strong>KuCoin</strong> et <strong>Gate</strong> listent de nombreux perps altcoins plus petits, <strong>Kraken</strong> est une option établie et orientée conformité. Levier, frais et disponibilité varient selon la région — ne choisissez pas sur le seul levier : plus de levier réduit juste le mouvement qui vous liquide.', cta: 'Comparez les meilleures plateformes de futures crypto →' },
  sv: { lang: 'sv', name: 'Svenska', title: 'Bästa kryptoterminsbörserna 2026', desc: 'Vad som verkligen spelar roll när du väljer en kryptoterminsbörs — likviditet, avgifter, hävstång och region — och hur de stora plattformarna står sig.', lead: '”Bäst” beror på var du bor, vad du handlar och hur avgiftskänslig du är. Här är faktorerna som faktiskt spelar roll.', h2a: 'Vad som gör en bra terminsbörs', pa: 'Fyra saker avgör: <strong>likviditet</strong> (snäva spreadar, mindre slippage), <strong>avgifter</strong> (maker/taker växer snabbt med hävstång), <strong>hävstång och par</strong> (de stora erbjuder upp till 100×–125× på BTC/ETH) och <strong>region och säkerhet</strong> (tillgänglighet och KYC skiljer sig per land).', h2b: 'De stora plattformarna', pb: 'Den djupaste likviditeten för krypto-perpetualer finns hos <strong>Binance</strong>, <strong>Bybit</strong> och <strong>OKX</strong>; <strong>KuCoin</strong> och <strong>Gate</strong> listar många mindre altcoin-perpetualer, <strong>Kraken</strong> är ett etablerat, regelfokuserat alternativ. Hävstång, avgifter och tillgänglighet varierar per region — välj inte på hävstång ensam: mer hävstång krymper bara rörelsen som likviderar dig.', cta: 'Jämför de bästa kryptoterminsbörserna →' },
  no: { lang: 'no', name: 'Norsk', title: 'Beste kryptofutures-børser 2026', desc: 'Hva som faktisk betyr noe når du velger en kryptofutures-børs — likviditet, gebyrer, giring og region — og hvordan de store plattformene måler seg.', lead: '«Best» avhenger av hvor du bor, hva du handler og hvor gebyrsensitiv du er. Her er faktorene som faktisk betyr noe.', h2a: 'Hva som gjør en god futures-børs', pa: 'Fire ting avgjør: <strong>likviditet</strong> (smale spreader, mindre slippasje), <strong>gebyrer</strong> (maker/taker vokser raskt med giring), <strong>giring og par</strong> (de store tilbyr opptil 100×–125× på BTC/ETH) og <strong>region og sikkerhet</strong> (tilgjengelighet og KYC varierer per land).', h2b: 'De store plattformene', pb: 'Den dypeste likviditeten for krypto-perpetualer ligger hos <strong>Binance</strong>, <strong>Bybit</strong> og <strong>OKX</strong>; <strong>KuCoin</strong> og <strong>Gate</strong> lister mange mindre altcoin-perpetualer, <strong>Kraken</strong> er et etablert, regelorientert alternativ. Giring, gebyrer og tilgjengelighet varierer per region — ikke velg på giring alene: mer giring krymper bare bevegelsen som likviderer deg.', cta: 'Sammenlign de beste kryptofutures-børsene →' },
  da: { lang: 'da', name: 'Dansk', title: 'Bedste kryptofutures-børser 2026', desc: 'Hvad der reelt betyder noget, når du vælger en kryptofutures-børs — likviditet, gebyrer, gearing og region — og hvordan de store platforme klarer sig.', lead: '”Bedst” afhænger af, hvor du bor, hvad du handler, og hvor gebyrfølsom du er. Her er de faktorer, der faktisk betyder noget.', h2a: 'Hvad der gør en god futures-børs', pa: 'Fire ting afgør: <strong>likviditet</strong> (snævre spreads, mindre slippage), <strong>gebyrer</strong> (maker/taker vokser hurtigt med gearing), <strong>gearing og par</strong> (de store tilbyder op til 100×–125× på BTC/ETH) og <strong>region og sikkerhed</strong> (tilgængelighed og KYC varierer pr. land).', h2b: 'De store platforme', pb: 'Den dybeste likviditet for krypto-perpetuals ligger hos <strong>Binance</strong>, <strong>Bybit</strong> og <strong>OKX</strong>; <strong>KuCoin</strong> og <strong>Gate</strong> lister mange mindre altcoin-perpetuals, <strong>Kraken</strong> er en etableret, compliance-fokuseret mulighed. Gearing, gebyrer og tilgængelighed varierer pr. region — vælg ikke på gearing alene: mere gearing formindsker blot den bevægelse, der likviderer dig.', cta: 'Sammenlign de bedste kryptofutures-børser →' },
  fi: { lang: 'fi', name: 'Suomi', title: 'Parhaat kryptofutuuripörssit 2026', desc: 'Mikä todella merkitsee kryptofutuuripörssiä valittaessa — likviditeetti, palkkiot, vipu ja alue — ja miten suuret alustat vertautuvat.', lead: '”Paras” riippuu siitä, missä asut, mitä käyt kauppaa ja kuinka palkkioherkkä olet. Tässä ovat tekijät, joilla on oikeasti merkitystä.', h2a: 'Mikä tekee hyvän futuuripörssin', pa: 'Neljä asiaa ratkaisee: <strong>likviditeetti</strong> (kapeat spreadit, vähemmän liukumaa), <strong>palkkiot</strong> (maker/taker kasvavat nopeasti vivulla), <strong>vipu ja parit</strong> (suuret tarjoavat jopa 100×–125× BTC/ETH:lle) sekä <strong>alue ja turvallisuus</strong> (saatavuus ja KYC vaihtelevat maittain).', h2b: 'Suuret alustat', pb: 'Syvin likviditeetti krypto-perpetuaaleille on <strong>Binancella</strong>, <strong>Bybitillä</strong> ja <strong>OKX:llä</strong>; <strong>KuCoin</strong> ja <strong>Gate</strong> listaavat paljon pienempiä altcoin-perpetuaaleja, <strong>Kraken</strong> on vakiintunut, sääntelyä painottava vaihtoehto. Vipu, palkkiot ja saatavuus vaihtelevat alueittain — älä valitse pelkän vivun perusteella: enemmän vipua vain pienentää liikettä, joka likvidoi sinut.', cta: 'Vertaa parhaita kryptofutuuripörssejä →' },
  nl: { lang: 'nl', name: 'Nederlands', title: 'Beste crypto-futures-exchanges 2026', desc: 'Wat echt telt bij het kiezen van een crypto-futures-exchange — liquiditeit, kosten, hefboom en regio — en hoe de grote platforms zich verhouden.', lead: '„Beste" hangt af van waar je woont, wat je verhandelt en hoe kostengevoelig je bent. Dit zijn de factoren die er echt toe doen.', h2a: 'Wat een goede futures-exchange maakt', pa: 'Vier dingen bepalen het: <strong>liquiditeit</strong> (krappe spreads, minder slippage), <strong>kosten</strong> (maker/taker lopen snel op met hefboom), <strong>hefboom en paren</strong> (de grote bieden tot 100×–125× op BTC/ETH) en <strong>regio en beveiliging</strong> (beschikbaarheid en KYC verschillen per land).', h2b: 'De grote platforms', pb: 'De diepste liquiditeit voor crypto-perpetuals zit bij <strong>Binance</strong>, <strong>Bybit</strong> en <strong>OKX</strong>; <strong>KuCoin</strong> en <strong>Gate</strong> listen veel kleinere altcoin-perps, <strong>Kraken</strong> is een gevestigde, compliance-gerichte optie. Hefboom, kosten en beschikbaarheid verschillen per regio — kies niet op hefboom alleen: meer hefboom verkleint slechts de beweging die je liquideert.', cta: 'Vergelijk de beste crypto-futures-exchanges →' },
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
    <div class="callout"><a class="cta" href="/#exchanges">${t.cta}</a></div>
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
