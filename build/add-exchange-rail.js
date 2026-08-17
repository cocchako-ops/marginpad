// Inject a contextual exchange rail into generated pages that carry no affiliate link at all.
//
// WHY: an audit on 2026-08-17 found 652 of 2211 generated pages with zero affiliate links — the whole
// blog (167), every translated guide (156), the per-coin liquidation pages and maps, the derivatives-data
// hubs and every trading simulator. Those are exactly the pages that rank, so the traffic arrived and
// left with nothing to click. The exchange pages, coin pages and calculators already carry links; this
// only fills the holes.
//
// DESIGN RULES (owner: "svuda, da ne smetaju i da daju razlog zasto da se klikne"):
//   - one quiet rail at the END of the article, never a popup, never sticky, never mid-sentence;
//   - the reason to click is written for the page's SUBJECT, not a generic "trade now" — a liquidation
//     page explains that those are real positions on real books, a simulator page explains what a
//     simulator cannot teach you;
//   - the exchanges shown match the page: US/Canada pages get the two venues that actually accept North
//     American residents, everything else gets the venues whose data the page is built on;
//   - rel="sponsored" + a visible affiliate disclosure, same as the rest of the site.
//
// Idempotent (guarded on the mp-xr marker) and skips any page that already has an affiliate link, so a
// re-run after a full build is a no-op. Runs as a post-processor from build/build.js.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');

const AFF = /bybit\.com\/invite\?ref=|binance\.com\/register\?ref=|okx\.com\/join\/|kucoin\.com\/r\/rf\/|gate\.com\/VFIWB|invite\.kraken\.com\/|promote\.mexc\.com\/r\/|bitget\.com\/referral\/|base\.app\/invite\/chakko|moon\.com\/\?c=moonkickstart/i;

// Partner links. `d` is a deliberately language-neutral descriptor (numbers + proper nouns) so the card
// needs no translation; only Moon's needs words, and that one is in the string table below.
const EX = {
  bybit:    { name: 'Bybit',    href: 'https://www.bybit.com/invite?ref=LZKBERJ',            accent: '#f7a600', d: 'USDT-perp &middot; 100x' },
  binance:  { name: 'Binance',  href: 'https://www.binance.com/register?ref=MAOZM9DS',       accent: '#f0b90b', d: 'USDT-perp &middot; 125x' },
  kraken:   { name: 'Kraken',   href: 'https://invite.kraken.com/JDNW/guj2tf28',             accent: '#7b6cf6', d: 'US &middot; 50x' },
  coinbase: { name: 'Coinbase', href: 'https://base.app/invite/chakko/FHSFNY5H',             accent: '#3b7bff', d: 'US &middot; spot' },
  moon:     { name: 'Moon',     href: 'https://moon.com/?c=moonkickstart',                   accent: '#8a5cff', d: '' },
};

// Contexts: eyebrow label, the reason line, and which two venues fit the page.
const CTX = {
  liq:   { ex: ['bybit', 'binance'], label: 'WHERE THESE LIQUIDATIONS HAPPEN',
           why: 'Nothing on this page is theoretical &mdash; it is real positions being force-closed on real order books. These are the venues those books belong to.' },
  deriv: { ex: ['bybit', 'binance'], label: 'TRADE THIS DATA',
           why: 'Funding, open interest and basis are only worth something if you are positioned on the venue that pays them.' },
  sim:   { ex: ['bybit', 'moon'],    label: 'WHEN PRACTICE STOPS TEACHING YOU',
           why: 'A simulator cannot teach you slippage, funding, or what real money does to your judgement. When the paper account stops surprising you, size down and go live.' },
  calc:  { ex: ['bybit', 'binance'], label: 'THE VENUES THESE NUMBERS ASSUME',
           why: 'Maintenance margin, fee tiers and funding intervals differ per exchange &mdash; these are the ones this calculator is modelled on.' },
  guide: { ex: ['bybit', 'moon'],    label: 'PUT THIS INTO PRACTICE',
           why: 'Reading about it only gets you so far. Rehearse it free on our terminal, then take it to a real book once it clicks.' },
  geo:   { ex: ['kraken', 'coinbase'], label: 'EXCHANGES THAT ACCEPT YOU',
           why: 'Most futures venues are closed to North American residents. These two are locally regulated and open to you &mdash; that is the whole reason they are on this page.' },
};

const DISCLOSURE = 'Affiliate links. We earn a commission if you sign up; you pay the same either way.';
const MOON_D = 'Any market, up or down';

// Translations. Only the four contexts that actually occur on translated pages are needed (guides,
// simulators, the data hubs and the exchange calculators); an unlisted context falls back to English.
const I18N = {
  de: { liq: ['WO DIESE LIQUIDATIONEN PASSIEREN', 'Nichts auf dieser Seite ist theoretisch &mdash; es sind echte Positionen, die in echten Orderb&uuml;chern zwangsliquidiert werden. Das sind die B&ouml;rsen, zu denen diese B&uuml;cher geh&ouml;ren.'],
        deriv: ['DIESE DATEN HANDELN', 'Funding, Open Interest und Basis sind nur etwas wert, wenn du auf der B&ouml;rse positioniert bist, die sie zahlt.'],
        sim: ['WENN &Uuml;BUNG NICHTS MEHR BEIBRINGT', 'Ein Simulator kann dir weder Slippage noch Funding beibringen &mdash; und schon gar nicht, was echtes Geld mit deinem Urteilsverm&ouml;gen macht. Wenn dich das Demokonto nicht mehr &uuml;berrascht, geh mit kleiner Gr&ouml;&szlig;e live.'],
        calc: ['DIE B&Ouml;RSEN HINTER DIESEN ZAHLEN', 'Maintenance Margin, Geb&uuml;hrenstufen und Funding-Intervalle unterscheiden sich je B&ouml;rse &mdash; diese hier liegen dem Rechner zugrunde.'],
        guide: ['IN DIE PRAXIS UMSETZEN', 'Lesen bringt dich nur bis hierher. &Uuml;be es kostenlos auf unserem Terminal und nimm es dann mit an ein echtes Orderbuch.'],
        geo: ['B&Ouml;RSEN, DIE DICH AKZEPTIEREN', 'Die meisten Futures-B&ouml;rsen sind f&uuml;r Nordamerikaner geschlossen. Diese beiden sind lokal reguliert und dir zug&auml;nglich.'],
        disc: 'Affiliate-Links. Wir erhalten eine Provision, wenn du dich anmeldest &mdash; f&uuml;r dich &auml;ndert sich der Preis nicht.', moon: 'Jeder Markt, hoch oder runter' },
  es: { liq: ['D&Oacute;NDE OCURREN ESTAS LIQUIDACIONES', 'Nada de esta p&aacute;gina es te&oacute;rico: son posiciones reales cerr&aacute;ndose a la fuerza en libros de &oacute;rdenes reales. Estos son los exchanges a los que pertenecen esos libros.'],
        deriv: ['OPERA CON ESTOS DATOS', 'El funding, el inter&eacute;s abierto y la base solo valen algo si est&aacute;s posicionado en el exchange que los paga.'],
        sim: ['CUANDO PRACTICAR YA NO TE ENSE&Ntilde;A NADA', 'Un simulador no puede ense&ntilde;arte el slippage, el funding ni lo que el dinero real le hace a tu criterio. Cuando la cuenta de pr&aacute;ctica deje de sorprenderte, reduce el tama&ntilde;o y pasa a real.'],
        calc: ['LOS EXCHANGES QUE ASUMEN ESTOS N&Uacute;MEROS', 'El margen de mantenimiento, los tramos de comisiones y los intervalos de funding cambian seg&uacute;n el exchange &mdash; estos son los que modela esta calculadora.'],
        guide: ['LL&Eacute;VALO A LA PR&Aacute;CTICA', 'Leer solo te lleva hasta cierto punto. Ens&aacute;yalo gratis en nuestro terminal y ll&eacute;valo a un libro real cuando te encaje.'],
        geo: ['EXCHANGES QUE S&Iacute; TE ACEPTAN', 'La mayor&iacute;a de exchanges de futuros est&aacute;n cerrados a residentes de Norteam&eacute;rica. Estos dos est&aacute;n regulados localmente y abiertos para ti.'],
        disc: 'Enlaces de afiliado. Cobramos una comisi&oacute;n si te registras; para ti el precio es el mismo.', moon: 'Cualquier mercado, arriba o abajo' },
  pt: { liq: ['ONDE ESTAS LIQUIDA&Ccedil;&Otilde;ES ACONTECEM', 'Nada nesta p&aacute;gina &eacute; te&oacute;rico &mdash; s&atilde;o posi&ccedil;&otilde;es reais a ser fechadas &agrave; for&ccedil;a em livros de ordens reais. Estas s&atilde;o as corretoras a que esses livros pertencem.'],
        deriv: ['NEGOCIE ESTES DADOS', 'Funding, open interest e base s&oacute; valem alguma coisa se estiver posicionado na corretora que os paga.'],
        sim: ['QUANDO PRATICAR DEIXA DE ENSINAR', 'Um simulador n&atilde;o lhe ensina slippage, funding, nem o que o dinheiro real faz ao seu ju&iacute;zo. Quando a conta de pr&aacute;tica deixar de o surpreender, reduza o tamanho e v&aacute; a real.'],
        calc: ['AS CORRETORAS POR TR&Aacute;S DESTES N&Uacute;MEROS', 'Margem de manuten&ccedil;&atilde;o, escal&otilde;es de taxas e intervalos de funding variam por corretora &mdash; estas s&atilde;o as que esta calculadora modela.'],
        guide: ['PONHA ISTO EM PR&Aacute;TICA', 'Ler s&oacute; o leva at&eacute; certo ponto. Ensaie de gra&ccedil;a no nosso terminal e leve-o para um livro real quando fizer sentido.'],
        geo: ['CORRETORAS QUE O ACEITAM', 'A maioria das corretoras de futuros est&aacute; fechada a residentes norte-americanos. Estas duas s&atilde;o reguladas localmente e est&atilde;o abertas a si.'],
        disc: 'Links de afiliado. Recebemos uma comiss&atilde;o se se registar; para si o pre&ccedil;o &eacute; o mesmo.', moon: 'Qualquer mercado, para cima ou para baixo' },
  fr: { liq: ['O&Ugrave; CES LIQUIDATIONS SE PRODUISENT', 'Rien sur cette page n&rsquo;est th&eacute;orique : ce sont de vraies positions ferm&eacute;es de force dans de vrais carnets d&rsquo;ordres. Voici les plateformes auxquelles ces carnets appartiennent.'],
        deriv: ['TRADER CES DONN&Eacute;ES', 'Le funding, l&rsquo;open interest et la base ne valent quelque chose que si vous &ecirc;tes positionn&eacute; sur la plateforme qui les paie.'],
        sim: ['QUAND S&rsquo;ENTRA&Icirc;NER N&rsquo;APPREND PLUS RIEN', 'Un simulateur ne vous apprendra ni le slippage, ni le funding, ni ce que l&rsquo;argent r&eacute;el fait &agrave; votre jugement. Quand le compte d&eacute;mo cesse de vous surprendre, r&eacute;duisez la taille et passez en r&eacute;el.'],
        calc: ['LES PLATEFORMES DERRI&Egrave;RE CES CHIFFRES', 'Marge de maintenance, paliers de frais et intervalles de funding varient selon la plateforme &mdash; voici celles sur lesquelles ce calculateur est model&eacute;.'],
        guide: ['METTEZ-LE EN PRATIQUE', 'La lecture ne vous m&egrave;ne pas bien loin. R&eacute;p&eacute;tez gratuitement sur notre terminal, puis passez &agrave; un vrai carnet.'],
        geo: ['LES PLATEFORMES QUI VOUS ACCEPTENT', 'La plupart des plateformes de futures sont ferm&eacute;es aux r&eacute;sidents nord-am&eacute;ricains. Ces deux-l&agrave; sont r&eacute;glement&eacute;es localement et vous sont ouvertes.'],
        disc: 'Liens affili&eacute;s. Nous touchons une commission si vous vous inscrivez ; le prix est le m&ecirc;me pour vous.', moon: 'N&rsquo;importe quel march&eacute;, &agrave; la hausse ou &agrave; la baisse' },
  nl: { liq: ['WAAR DEZE LIQUIDATIES GEBEUREN', 'Niets op deze pagina is theoretisch &mdash; het zijn echte posities die gedwongen worden gesloten in echte orderboeken. Dit zijn de beurzen waar die boeken bij horen.'],
        deriv: ['HANDEL DEZE DATA', 'Funding, open interest en basis zijn alleen iets waard als je positie hebt op de beurs die ze betaalt.'],
        sim: ['ALS OEFENEN NIETS MEER LEERT', 'Een simulator leert je geen slippage, geen funding, en zeker niet wat echt geld met je oordeel doet. Zodra het demo-account je niet meer verrast: kleiner inzetten en live gaan.'],
        calc: ['DE BEURZEN ACHTER DEZE CIJFERS', 'Onderhoudsmarge, feeschijven en funding-intervallen verschillen per beurs &mdash; dit zijn de beurzen waarop deze calculator is gebaseerd.'],
        guide: ['BRENG DIT IN PRAKTIJK', 'Lezen brengt je maar tot hier. Oefen het gratis op onze terminal en neem het daarna mee naar een echt orderboek.'],
        geo: ['BEURZEN DIE JOU WEL ACCEPTEREN', 'De meeste futures-beurzen zijn gesloten voor Noord-Amerikaanse inwoners. Deze twee zijn lokaal gereguleerd en voor jou open.'],
        disc: 'Affiliate links. Wij krijgen commissie als je je aanmeldt; jij betaalt hetzelfde.', moon: 'Elke markt, omhoog of omlaag' },
  ru: { liq: ['&#1043;&#1044;&#1045; &#1055;&#1056;&#1054;&#1048;&#1057;&#1061;&#1054;&#1044;&#1071;&#1058; &#1069;&#1058;&#1048; &#1051;&#1048;&#1050;&#1042;&#1048;&#1044;&#1040;&#1062;&#1048;&#1048;', '&#1053;&#1080;&#1095;&#1077;&#1075;&#1086; &#1085;&#1072; &#1101;&#1090;&#1086;&#1081; &#1089;&#1090;&#1088;&#1072;&#1085;&#1080;&#1094;&#1077; &#1085;&#1077; &#1103;&#1074;&#1083;&#1103;&#1077;&#1090;&#1089;&#1103; &#1090;&#1077;&#1086;&#1088;&#1080;&#1077;&#1081; &mdash; &#1101;&#1090;&#1086; &#1088;&#1077;&#1072;&#1083;&#1100;&#1085;&#1099;&#1077; &#1087;&#1086;&#1079;&#1080;&#1094;&#1080;&#1080;, &#1087;&#1088;&#1080;&#1085;&#1091;&#1076;&#1080;&#1090;&#1077;&#1083;&#1100;&#1085;&#1086; &#1079;&#1072;&#1082;&#1088;&#1099;&#1090;&#1099;&#1077; &#1074; &#1088;&#1077;&#1072;&#1083;&#1100;&#1085;&#1099;&#1093; &#1089;&#1090;&#1072;&#1082;&#1072;&#1085;&#1072;&#1093;. &#1069;&#1090;&#1086; &#1073;&#1080;&#1088;&#1078;&#1080;, &#1082;&#1086;&#1090;&#1086;&#1088;&#1099;&#1084; &#1101;&#1090;&#1080; &#1089;&#1090;&#1072;&#1082;&#1072;&#1085;&#1099; &#1087;&#1088;&#1080;&#1085;&#1072;&#1076;&#1083;&#1077;&#1078;&#1072;&#1090;.'],
        deriv: ['&#1058;&#1054;&#1056;&#1043;&#1054;&#1042;&#1040;&#1058;&#1068; &#1055;&#1054; &#1069;&#1058;&#1048;&#1052; &#1044;&#1040;&#1053;&#1053;&#1067;&#1052;', '&#1060;&#1072;&#1085;&#1076;&#1080;&#1085;&#1075;, &#1086;&#1090;&#1082;&#1088;&#1099;&#1090;&#1099;&#1081; &#1080;&#1085;&#1090;&#1077;&#1088;&#1077;&#1089; &#1080; &#1073;&#1072;&#1079;&#1080;&#1089; &#1080;&#1084;&#1077;&#1102;&#1090; &#1094;&#1077;&#1085;&#1091;, &#1090;&#1086;&#1083;&#1100;&#1082;&#1086; &#1077;&#1089;&#1083;&#1080; &#1091; &#1074;&#1072;&#1089; &#1077;&#1089;&#1090;&#1100; &#1087;&#1086;&#1079;&#1080;&#1094;&#1080;&#1103; &#1085;&#1072; &#1073;&#1080;&#1088;&#1078;&#1077;, &#1082;&#1086;&#1090;&#1086;&#1088;&#1072;&#1103; &#1080;&#1093; &#1087;&#1083;&#1072;&#1090;&#1080;&#1090;.'],
        sim: ['&#1050;&#1054;&#1043;&#1044;&#1040; &#1055;&#1056;&#1040;&#1050;&#1058;&#1048;&#1050;&#1040; &#1041;&#1054;&#1051;&#1068;&#1064;&#1045; &#1053;&#1048;&#1063;&#1045;&#1052;&#1059; &#1053;&#1045; &#1059;&#1063;&#1048;&#1058;', '&#1057;&#1080;&#1084;&#1091;&#1083;&#1103;&#1090;&#1086;&#1088; &#1085;&#1077; &#1085;&#1072;&#1091;&#1095;&#1080;&#1090; &#1074;&#1072;&#1089; &#1085;&#1080; &#1087;&#1088;&#1086;&#1089;&#1082;&#1072;&#1083;&#1100;&#1079;&#1099;&#1074;&#1072;&#1085;&#1080;&#1102;, &#1085;&#1080; &#1092;&#1072;&#1085;&#1076;&#1080;&#1085;&#1075;&#1091;, &#1085;&#1080; &#1090;&#1086;&#1084;&#1091;, &#1095;&#1090;&#1086; &#1088;&#1077;&#1072;&#1083;&#1100;&#1085;&#1099;&#1077; &#1076;&#1077;&#1085;&#1100;&#1075;&#1080; &#1076;&#1077;&#1083;&#1072;&#1102;&#1090; &#1089; &#1074;&#1072;&#1096;&#1080;&#1084; &#1089;&#1091;&#1078;&#1076;&#1077;&#1085;&#1080;&#1077;&#1084;. &#1050;&#1086;&#1075;&#1076;&#1072; &#1076;&#1077;&#1084;&#1086;-&#1089;&#1095;&#1105;&#1090; &#1087;&#1077;&#1088;&#1077;&#1089;&#1090;&#1072;&#1085;&#1077;&#1090; &#1091;&#1076;&#1080;&#1074;&#1083;&#1103;&#1090;&#1100; &mdash; &#1091;&#1084;&#1077;&#1085;&#1100;&#1096;&#1080;&#1090;&#1077; &#1088;&#1072;&#1079;&#1084;&#1077;&#1088; &#1080; &#1087;&#1077;&#1088;&#1077;&#1093;&#1086;&#1076;&#1080;&#1090;&#1077; &#1085;&#1072; &#1088;&#1077;&#1072;&#1083;.'],
        calc: ['&#1041;&#1048;&#1056;&#1046;&#1048;, &#1053;&#1040; &#1050;&#1054;&#1058;&#1054;&#1056;&#1067;&#1061; &#1055;&#1054;&#1057;&#1058;&#1056;&#1054;&#1045;&#1053; &#1056;&#1040;&#1057;&#1063;&#1401;&#1058;', '&#1055;&#1086;&#1076;&#1076;&#1077;&#1088;&#1078;&#1080;&#1074;&#1072;&#1102;&#1097;&#1072;&#1103; &#1084;&#1072;&#1088;&#1078;&#1072;, &#1091;&#1088;&#1086;&#1074;&#1085;&#1080; &#1082;&#1086;&#1084;&#1080;&#1089;&#1089;&#1080;&#1081; &#1080; &#1080;&#1085;&#1090;&#1077;&#1088;&#1074;&#1072;&#1083;&#1099; &#1092;&#1072;&#1085;&#1076;&#1080;&#1085;&#1075;&#1072; &#1088;&#1072;&#1079;&#1083;&#1080;&#1095;&#1072;&#1102;&#1090;&#1089;&#1103; &#1086;&#1090; &#1073;&#1080;&#1088;&#1078;&#1080; &#1082; &#1073;&#1080;&#1088;&#1078;&#1077; &mdash; &#1101;&#1090;&#1086;&#1090; &#1082;&#1072;&#1083;&#1100;&#1082;&#1091;&#1083;&#1103;&#1090;&#1086;&#1088; &#1087;&#1086;&#1089;&#1090;&#1088;&#1086;&#1077;&#1085; &#1085;&#1072; &#1085;&#1080;&#1093;.'],
        guide: ['&#1055;&#1056;&#1048;&#1052;&#1045;&#1053;&#1048;&#1058;&#1068; &#1053;&#1040; &#1055;&#1056;&#1040;&#1050;&#1058;&#1048;&#1050;&#1045;', '&#1063;&#1090;&#1077;&#1085;&#1080;&#1077;&#1084; &#1076;&#1072;&#1083;&#1077;&#1082;&#1086; &#1085;&#1077; &#1091;&#1077;&#1076;&#1077;&#1096;&#1100;. &#1054;&#1090;&#1088;&#1077;&#1087;&#1077;&#1090;&#1080;&#1088;&#1091;&#1081;&#1090;&#1077; &#1073;&#1077;&#1089;&#1087;&#1083;&#1072;&#1090;&#1085;&#1086; &#1085;&#1072; &#1085;&#1072;&#1096;&#1077;&#1084; &#1090;&#1077;&#1088;&#1084;&#1080;&#1085;&#1072;&#1083;&#1077;, &#1072; &#1087;&#1086;&#1090;&#1086;&#1084; &#1085;&#1077;&#1089;&#1080;&#1090;&#1077; &#1101;&#1090;&#1086; &#1074; &#1088;&#1077;&#1072;&#1083;&#1100;&#1085;&#1099;&#1081; &#1089;&#1090;&#1072;&#1082;&#1072;&#1085;.'],
        geo: ['&#1041;&#1048;&#1056;&#1046;&#1048;, &#1050;&#1054;&#1058;&#1054;&#1056;&#1067;&#1045; &#1042;&#1040;&#1057; &#1055;&#1056;&#1048;&#1053;&#1048;&#1052;&#1040;&#1070;&#1058;', '&#1041;&#1086;&#1083;&#1100;&#1096;&#1080;&#1085;&#1089;&#1090;&#1074;&#1086; &#1092;&#1100;&#1102;&#1095;&#1077;&#1088;&#1089;&#1085;&#1099;&#1093; &#1073;&#1080;&#1088;&#1078; &#1079;&#1072;&#1082;&#1088;&#1099;&#1090;&#1099; &#1076;&#1083;&#1103; &#1078;&#1080;&#1090;&#1077;&#1083;&#1077;&#1081; &#1057;&#1077;&#1074;&#1077;&#1088;&#1085;&#1086;&#1081; &#1040;&#1084;&#1077;&#1088;&#1080;&#1082;&#1080;. &#1069;&#1090;&#1080; &#1076;&#1074;&#1077; &mdash; &#1085;&#1077;&#1090;.'],
        disc: '&#1055;&#1072;&#1088;&#1090;&#1085;&#1105;&#1088;&#1089;&#1082;&#1080;&#1077; &#1089;&#1089;&#1099;&#1083;&#1082;&#1080;. &#1052;&#1099; &#1087;&#1086;&#1083;&#1091;&#1095;&#1072;&#1077;&#1084; &#1082;&#1086;&#1084;&#1080;&#1089;&#1089;&#1080;&#1102; &#1079;&#1072; &#1088;&#1077;&#1075;&#1080;&#1089;&#1090;&#1088;&#1072;&#1094;&#1080;&#1102;; &#1076;&#1083;&#1103; &#1074;&#1072;&#1089; &#1094;&#1077;&#1085;&#1072; &#1090;&#1072; &#1078;&#1077;.', moon: '&#1051;&#1102;&#1073;&#1086;&#1081; &#1088;&#1099;&#1085;&#1086;&#1082;, &#1074;&#1074;&#1077;&#1088;&#1093; &#1080;&#1083;&#1080; &#1074;&#1085;&#1080;&#1079;' },
  tr: { liq: ['BU L&#304;KANDASYONLAR NEREDE OLUYOR', 'Bu sayfadaki hi&ccedil;bir &#351;ey teorik de&#287;il &mdash; ger&ccedil;ek emir defterlerinde zorla kapat&#305;lan ger&ccedil;ek pozisyonlar. Bu defterler a&#351;a&#287;&#305;daki borsalara ait.'],
        deriv: ['BU VER&#304;YLE &#304;&#350;LEM YAP', 'Fonlama, a&ccedil;&#305;k pozisyon ve baz ancak onlar&#305; &ouml;deyen borsada pozisyondaysan bir anlam ta&#351;&#305;r.'],
        sim: ['PRAT&#304;K ARTIK &Ouml;&#286;RETMEZ OLDU&#286;UNDA', 'Bir sim&uuml;lat&ouml;r sana kaymay&#305;, fonlamay&#305; ya da ger&ccedil;ek paran&#305;n muhakemene ne yapt&#305;&#287;&#305;n&#305; &ouml;&#287;retemez. Demo hesap seni &#351;a&#351;&#305;rtmay&#305; b&#305;rakt&#305;&#287;&#305;nda k&uuml;&ccedil;&uuml;k ba&#351;la ve ger&ccedil;e&#287;e ge&ccedil;.'],
        calc: ['BU SAYILARIN VARSAYDI&#286;I BORSALAR', 'S&uuml;rd&uuml;rme teminat&#305;, komisyon kademeleri ve fonlama aral&#305;klar&#305; borsadan borsaya de&#287;i&#351;ir &mdash; bu hesaplay&#305;c&#305; a&#351;a&#287;&#305;dakilere g&ouml;re modellenmi&#351;tir.'],
        guide: ['BUNU PRAT&#304;&#286;E D&Ouml;K', 'Okumak seni ancak bir yere kadar g&ouml;t&uuml;r&uuml;r. &Ouml;nce terminalimizde &uuml;cretsiz prova et, oturdu&#287;unda ger&ccedil;ek bir deftere ta&#351;&#305;.'],
        geo: ['SEN&#304; KABUL EDEN BORSALAR', 'Vadeli i&#351;lem borsalar&#305;n&#305;n &ccedil;o&#287;u Kuzey Amerika sakinlerine kapal&#305;. Bu ikisi yerel olarak d&uuml;zenlenmi&#351; ve sana a&ccedil;&#305;k.'],
        disc: 'Affiliate ba&#287;lant&#305;lar&#305;. Kay&#305;t olursan komisyon al&#305;yoruz; senin i&ccedil;in fiyat de&#287;i&#351;miyor.', moon: 'Her piyasa, yukar&#305; ya da a&#351;a&#287;&#305;' },
  zh: { liq: ['&#36825;&#20123;&#28165;&#31639;&#21457;&#29983;&#22312;&#21738;&#37324;', '&#26412;&#39029;&#19978;&#27809;&#26377;&#19968;&#39033;&#26159;&#29702;&#35770;&#25968;&#25454;&mdash;&mdash;&#37117;&#26159;&#22312;&#30495;&#23454;&#35746;&#21333;&#31807;&#20013;&#34987;&#24378;&#21046;&#24179;&#20179;&#30340;&#30495;&#23454;&#20179;&#20301;&#12290;&#36825;&#20123;&#35746;&#21333;&#31807;&#23601;&#23646;&#20110;&#20197;&#19979;&#20132;&#26131;&#25152;&#12290;'],
        deriv: ['&#29992;&#36825;&#20123;&#25968;&#25454;&#20132;&#26131;', '&#36164;&#37329;&#36153;&#12289;&#26410;&#24179;&#20179;&#37327;&#21644;&#22522;&#24046;&#65292;&#21482;&#26377;&#22312;&#25903;&#20184;&#23427;&#20204;&#30340;&#20132;&#26131;&#25152;&#25345;&#20179;&#26102;&#25165;&#26377;&#24847;&#20041;&#12290;'],
        sim: ['&#24403;&#27169;&#25311;&#30424;&#20877;&#20063;&#25945;&#19981;&#20102;&#20320;', '&#27169;&#25311;&#30424;&#25945;&#19981;&#20102;&#20320;&#28369;&#28857;&#12289;&#36164;&#37329;&#36153;&#65292;&#26356;&#25945;&#19981;&#20102;&#20320;&#30495;&#38065;&#22914;&#20309;&#24433;&#21709;&#21028;&#26029;&#12290;&#24403;&#27169;&#25311;&#36134;&#25143;&#19981;&#20877;&#35753;&#20320;&#24847;&#22806;&#26102;&#65292;&#20943;&#23567;&#20179;&#20301;&#65292;&#36716;&#21521;&#23454;&#30424;&#12290;'],
        calc: ['&#36825;&#20123;&#25968;&#23383;&#25152;&#20551;&#23450;&#30340;&#20132;&#26131;&#25152;', '&#32500;&#25345;&#20445;&#35777;&#37329;&#12289;&#36153;&#29575;&#26723;&#20301;&#21644;&#36164;&#37329;&#36153;&#21608;&#26399;&#22240;&#25152;&#32780;&#24322; &mdash; &#26412;&#35745;&#31639;&#22120;&#20197;&#20197;&#19979;&#20132;&#26131;&#25152;&#20026;&#20934;&#12290;'],
        guide: ['&#25226;&#23427;&#29992;&#36215;&#26469;', '&#20809;&#38405;&#35835;&#36208;&#19981;&#20102;&#22810;&#36828;&#12290;&#20808;&#22312;&#25105;&#20204;&#30340;&#32456;&#31471;&#20813;&#36153;&#28436;&#32451;&#65292;&#25551;&#28165;&#20102;&#20877;&#25644;&#21040;&#30495;&#23454;&#30424;&#21475;&#12290;'],
        geo: ['&#25509;&#21463;&#20320;&#30340;&#20132;&#26131;&#25152;', '&#22823;&#22810;&#25968;&#21512;&#32422;&#20132;&#26131;&#25152;&#19981;&#23545;&#21271;&#32654;&#23621;&#27665;&#24320;&#25918;&#12290;&#36825;&#20004;&#23478;&#21463;&#24403;&#22320;&#30417;&#31649;&#65292;&#21521;&#20320;&#24320;&#25918;&#12290;'],
        disc: '&#32852;&#30431;&#38142;&#25509;&#12290;&#20320;&#27880;&#20876;&#25105;&#20204;&#20250;&#33719;&#24471;&#20315;&#37329;&#65292;&#20320;&#25903;&#20184;&#30340;&#20215;&#26684;&#19981;&#21464;&#12290;', moon: '&#20219;&#20309;&#24066;&#22330;&#65292;&#21521;&#19978;&#25110;&#21521;&#19979;' },
  ja: { liq: ['&#12371;&#12428;&#12425;&#12398;&#28165;&#31639;&#12364;&#36215;&#12365;&#12383;&#22580;&#25152;', '&#12371;&#12398;&#12506;&#12540;&#12472;&#12395;&#29702;&#35542;&#19978;&#12398;&#25968;&#23383;&#12399;&#12354;&#12426;&#12414;&#12379;&#12435;&#12290;&#12377;&#12409;&#12390;&#23455;&#38555;&#12398;&#26495;&#12391;&#24375;&#21046;&#27770;&#28168;&#12373;&#12428;&#12383;&#23455;&#22312;&#12398;&#12509;&#12472;&#12471;&#12519;&#12531;&#12391;&#12377;&#12290;&#12381;&#12398;&#26495;&#12399;&#20197;&#19979;&#12398;&#21462;&#24341;&#25152;&#12398;&#12418;&#12398;&#12391;&#12377;&#12290;'],
        deriv: ['&#12371;&#12398;&#12487;&#12540;&#12479;&#12391;&#21462;&#24341;&#12377;&#12427;', '&#36039;&#37329;&#35519;&#36948;&#29575;&#12539;&#26410;&#27770;&#28168;&#24314;&#29577;&#12539;&#12505;&#12540;&#12471;&#12473;&#12399;&#12289;&#12381;&#12428;&#12434;&#25903;&#25173;&#12358;&#21462;&#24341;&#25152;&#12391;&#12509;&#12472;&#12471;&#12519;&#12531;&#12434;&#25345;&#12387;&#12390;&#12356;&#12390;&#12371;&#12381;&#24847;&#21619;&#12364;&#12354;&#12426;&#12414;&#12377;&#12290;'],
        sim: ['&#32244;&#32722;&#12363;&#12425;&#23398;&#12409;&#12394;&#12367;&#12394;&#12387;&#12383;&#12425;', '&#12471;&#12511;&#12517;&#12524;&#12540;&#12479;&#12540;&#12399;&#12473;&#12522;&#12483;&#12500;&#12540;&#12472;&#12418;&#36039;&#37329;&#35519;&#36948;&#29575;&#12418;&#12289;&#12414;&#12375;&#12390;&#23455;&#37329;&#12364;&#21028;&#26029;&#12395;&#19982;&#12360;&#12427;&#24433;&#38911;&#12418;&#25945;&#12360;&#12414;&#12379;&#12435;&#12290;&#12487;&#12514;&#21475;&#24231;&#12395;&#39537;&#12363;&#12428;&#12394;&#12367;&#12394;&#12387;&#12383;&#12425;&#12289;&#23567;&#12373;&#12367;&#22987;&#12417;&#12390;&#23455;&#21462;&#24341;&#12408;&#12290;'],
        calc: ['&#12371;&#12398;&#25968;&#23383;&#12364;&#21069;&#25552;&#12392;&#12377;&#12427;&#21462;&#24341;&#25152;', '&#32173;&#25345;&#35672;&#25315;&#37329;&#12539;&#25163;&#25968;&#26009;&#12486;&#12451;&#12450;&#12539;&#36039;&#37329;&#35519;&#36948;&#38291;&#38548;&#12399;&#21462;&#24341;&#25152;&#12372;&#12392;&#12395;&#30064;&#12394;&#12426;&#12414;&#12377; &mdash; &#26412;&#35336;&#31639;&#12399;&#20197;&#19979;&#12434;&#21069;&#25552;&#12395;&#12375;&#12390;&#12356;&#12414;&#12377;&#12290;'],
        guide: ['&#23455;&#36341;&#12395;&#31227;&#12377;', '&#35501;&#12416;&#12384;&#12369;&#12391;&#12399;&#38480;&#30028;&#12364;&#12354;&#12426;&#12414;&#12377;&#12290;&#12414;&#12378;&#28961;&#26009;&#12479;&#12540;&#12511;&#12490;&#12523;&#12391;&#35430;&#12375;&#12289;&#25163;&#12372;&#12383;&#12360;&#12434;&#12388;&#12363;&#12435;&#12384;&#12425;&#23455;&#38555;&#12398;&#26495;&#12408;&#12290;'],
        geo: ['&#12354;&#12394;&#12383;&#12434;&#21463;&#12369;&#20837;&#12428;&#12427;&#21462;&#24341;&#25152;', '&#22810;&#12367;&#12398;&#20808;&#29289;&#21462;&#24341;&#25152;&#12399;&#21271;&#31859;&#23621;&#20303;&#32773;&#12395;&#38281;&#12374;&#12373;&#12428;&#12390;&#12356;&#12414;&#12377;&#12290;&#12371;&#12398;2&#31038;&#12399;&#29694;&#22320;&#35215;&#21046;&#19979;&#12391;&#21033;&#29992;&#12391;&#12365;&#12414;&#12377;&#12290;'],
        disc: '&#12450;&#12501;&#12451;&#12522;&#12456;&#12452;&#12488;&#12522;&#12531;&#12463;&#12391;&#12377;&#12290;&#30331;&#37682;&#12373;&#12428;&#12427;&#12392;&#24403;&#31038;&#12395;&#22577;&#37228;&#12364;&#20837;&#12426;&#12414;&#12377;&#12364;&#12289;&#12362;&#23458;&#27096;&#12398;&#36027;&#29992;&#12399;&#22793;&#12431;&#12426;&#12414;&#12379;&#12435;&#12290;', moon: '&#12393;&#12435;&#12394;&#24066;&#22580;&#12391;&#12418;&#19978;&#12363;&#19979;&#12363;' },
  ko: { liq: ['&#51060; &#52397;&#49328;&#46308;&#51060; &#51068;&#50612;&#45208;&#45716; &#44273;', '&#51060; &#54168;&#51060;&#51648;&#50640; &#51060;&#47200;&#51201;&#51064; &#49707;&#51088;&#45716; &#50630;&#49845;&#45768;&#45796; &mdash; &#47784;&#46160; &#49892;&#51228; &#54840;&#44032;&#52285;&#50640;&#49436; &#44053;&#51228; &#52397;&#49328;&#46108; &#49892;&#51228; &#54252;&#51648;&#49496;&#51077;&#45768;&#45796;. &#44536; &#54840;&#44032;&#52285;&#51060; &#48148;&#47196; &#50500;&#47000; &#44144;&#47000;&#49548;&#46308;&#51077;&#45768;&#45796;.'],
        deriv: ['&#51060; &#45936;&#51060;&#53552;&#47196; &#44144;&#47000;&#54616;&#44592;', '&#54140;&#46377;, &#48120;&#44208;&#51228;&#50557;&#51228;, &#48288;&#51060;&#49828;&#45716; &#44536;&#44163;&#51012; &#51648;&#44553;&#54616;&#45716; &#44144;&#47000;&#49548;&#50640; &#54252;&#51648;&#49496;&#51060; &#51080;&#50612;&#50556; &#51032;&#48120;&#44032; &#51080;&#49845;&#45768;&#45796;.'],
        sim: ['&#50672;&#49845;&#51060; &#45908; &#51060;&#49345; &#44032;&#47476;&#52832;&#51704; &#46412;', '&#49884;&#48660;&#47112;&#51060;&#53552;&#45716; &#49836;&#47532;&#54588;&#51060;&#51648;&#46020;, &#54140;&#46377;&#46020;, &#49892;&#51228; &#46237;&#51060; &#54032;&#45800;&#51012; &#50612;&#46907;&#44172; &#54732;&#46308;&#45716;&#51648;&#46020; &#44032;&#47476;&#52825; &#47803;&#54633;&#45768;&#45796;. &#47784;&#51032; &#44228;&#51340;&#50640; &#45908; &#51060;&#49345; &#45368;&#46972;&#51648; &#50506;&#45716;&#45796;&#47732; &#53356;&#44592;&#47484; &#51460;&#50668; &#49892;&#51204;&#51004;&#47196; &#44032;&#49464;&#50836;.'],
        calc: ['&#51060; &#49688;&#52824;&#44032; &#51204;&#51228;&#54620; &#44144;&#47000;&#49548;', '&#50976;&#51648;&#51613;&#44144;&#44552;, &#49688;&#49688;&#47308; &#46321;&#44553;, &#54140;&#46377; &#51452;&#44592;&#45716; &#44144;&#47000;&#49548;&#47560;&#45796; &#45796;&#47973;&#45768;&#45796; &mdash; &#51060; &#44228;&#49328;&#44592;&#45716; &#50500;&#47000; &#44144;&#47000;&#49548;&#47484; &#44592;&#51456;&#51004;&#47196; &#54633;&#45768;&#45796;.'],
        guide: ['&#49892;&#51228;&#47196; &#50725;&#44160; &#48372;&#44592;', '&#51069;&#45716; &#44163;&#47564;&#51004;&#47196;&#45716; &#54620;&#44228;&#44032; &#51080;&#49845;&#45768;&#45796;. &#47676;&#51200; &#50864;&#47532; &#53552;&#48124;&#45720;&#50640;&#49436; &#47924;&#47308;&#47196; &#50672;&#49845;&#54616;&#44256;, &#49552;&#51060; &#54952;&#47532;&#47732; &#49892;&#51228; &#54840;&#44032;&#52285;&#51004;&#47196; &#50725;&#44592;&#49464;&#50836;.'],
        geo: ['&#45817;&#49888;&#51012; &#48155;&#50500;&#51452;&#45716; &#44144;&#47000;&#49548;', '&#45824;&#48512;&#48516;&#51032; &#49440;&#47932; &#44144;&#47000;&#49548;&#45716; &#48513;&#48120; &#44144;&#51452;&#51088;&#50640;&#44172; &#45803;&#54600; &#51080;&#49845;&#45768;&#45796;. &#51060; &#46168;&#51008; &#54788;&#51648; &#44508;&#51228;&#47484; &#48155;&#51004;&#47709; &#51060;&#50857;&#51060; &#44032;&#45733;&#54633;&#45768;&#45796;.'],
        disc: '&#51228;&#54924; &#47553;&#53356;&#51077;&#45768;&#45796;. &#44032;&#51077;&#54616;&#49884;&#47732; &#49688;&#49688;&#47308;&#47484; &#48155;&#51648;&#47564;, &#44256;&#44061;&#45784; &#48708;&#50857;&#51008; &#46041;&#51068;&#54633;&#45768;&#45796;.', moon: '&#50612;&#46496; &#49884;&#51109;&#51060;&#46304;, &#50724;&#47476;&#45208; &#45236;&#47140;' },
  ar: { liq: ['&#1571;&#1610;&#1606; &#1578;&#1581;&#1583;&#1579; &#1607;&#1584;&#1607; &#1575;&#1604;&#1578;&#1589;&#1601;&#1610;&#1575;&#1578;', '&#1604;&#1575; &#1588;&#1610;&#1569; &#1606;&#1592;&#1585;&#1610; &#1601;&#1610; &#1607;&#1584;&#1607; &#1575;&#1604;&#1589;&#1601;&#1581;&#1577; &mdash; &#1603;&#1604;&#1607;&#1575; &#1589;&#1601;&#1602;&#1575;&#1578; &#1581;&#1602;&#1610;&#1602;&#1610;&#1577; &#1571;&#1615;&#1594;&#1604;&#1602;&#1578; &#1602;&#1587;&#1585;&#1611;&#1575; &#1601;&#1610; &#1583;&#1601;&#1575;&#1578;&#1585; &#1571;&#1608;&#1575;&#1605;&#1585; &#1581;&#1602;&#1610;&#1602;&#1610;&#1577;. &#1607;&#1584;&#1607; &#1607;&#1610; &#1575;&#1604;&#1605;&#1606;&#1589;&#1575;&#1578; &#1575;&#1604;&#1578;&#1610; &#1578;&#1593;&#1608;&#1583; &#1573;&#1604;&#1610;&#1607;&#1575; &#1578;&#1604;&#1603; &#1575;&#1604;&#1583;&#1601;&#1575;&#1578;&#1585;.'],
        deriv: ['&#1578;&#1583;&#1575;&#1608;&#1604; &#1607;&#1584;&#1607; &#1575;&#1604;&#1576;&#1610;&#1575;&#1606;&#1575;&#1578;', '&#1575;&#1604;&#1578;&#1605;&#1608;&#1610;&#1604; &#1608;&#1575;&#1604;&#1593;&#1602;&#1608;&#1583; &#1575;&#1604;&#1605;&#1601;&#1578;&#1608;&#1581;&#1577; &#1608;&#1575;&#1604;&#1571;&#1587;&#1575;&#1587; &#1604;&#1575; &#1578;&#1587;&#1575;&#1608;&#1610; &#1588;&#1610;&#1574;&#1611;&#1575; &#1573;&#1604;&#1575; &#1573;&#1584;&#1575; &#1603;&#1606;&#1578; &#1605;&#1578;&#1605;&#1585;&#1603;&#1586;&#1611;&#1575; &#1601;&#1610; &#1575;&#1604;&#1605;&#1606;&#1589;&#1577; &#1575;&#1604;&#1578;&#1610; &#1578;&#1583;&#1601;&#1593;&#1607;&#1575;.'],
        sim: ['&#1593;&#1606;&#1583;&#1605;&#1575; &#1610;&#1578;&#1608;&#1602;&#1601; &#1575;&#1604;&#1578;&#1583;&#1585;&#1610;&#1576; &#1593;&#1606; &#1578;&#1593;&#1604;&#1610;&#1605;&#1603;', '&#1575;&#1604;&#1605;&#1581;&#1575;&#1603;&#1610; &#1604;&#1575; &#1610;&#1593;&#1604;&#1605;&#1603; &#1575;&#1604;&#1575;&#1606;&#1586;&#1604;&#1575;&#1602; &#1575;&#1604;&#1587;&#1593;&#1585;&#1610; &#1608;&#1604;&#1575; &#1575;&#1604;&#1578;&#1605;&#1608;&#1610;&#1604;&#1548; &#1608;&#1604;&#1575; &#1605;&#1575; &#1610;&#1601;&#1593;&#1604;&#1607; &#1575;&#1604;&#1605;&#1575;&#1604; &#1575;&#1604;&#1581;&#1602;&#1610;&#1602;&#1610; &#1576;&#1581;&#1603;&#1605;&#1603;. &#1581;&#1610;&#1606; &#1610;&#1578;&#1608;&#1602;&#1601; &#1581;&#1587;&#1575;&#1576; &#1575;&#1604;&#1578;&#1580;&#1585;&#1576;&#1577; &#1593;&#1606; &#1605;&#1601;&#1575;&#1580;&#1571;&#1578;&#1603;&#1548; &#1589;&#1594;&#1617;&#1585; &#1581;&#1580;&#1605;&#1603; &#1608;&#1575;&#1606;&#1578;&#1602;&#1604; &#1573;&#1604;&#1609; &#1575;&#1604;&#1581;&#1602;&#1610;&#1602;&#1610;.'],
        calc: ['&#1575;&#1604;&#1605;&#1606;&#1589;&#1575;&#1578; &#1575;&#1604;&#1578;&#1610; &#1578;&#1601;&#1578;&#1585;&#1590;&#1607;&#1575; &#1607;&#1584;&#1607; &#1575;&#1604;&#1571;&#1585;&#1602;&#1575;&#1605;', '&#1607;&#1575;&#1605;&#1588; &#1575;&#1604;&#1589;&#1610;&#1575;&#1606;&#1577; &#1608;&#1588;&#1585;&#1575;&#1574;&#1581; &#1575;&#1604;&#1585;&#1587;&#1608;&#1605; &#1608;&#1601;&#1578;&#1585;&#1575;&#1578; &#1575;&#1604;&#1578;&#1605;&#1608;&#1610;&#1604; &#1578;&#1582;&#1578;&#1604;&#1601; &#1605;&#1606; &#1605;&#1606;&#1589;&#1577; &#1573;&#1604;&#1609; &#1571;&#1582;&#1585;&#1609; &mdash; &#1608;&#1607;&#1584;&#1607; &#1607;&#1610; &#1575;&#1604;&#1605;&#1606;&#1589;&#1575;&#1578; &#1575;&#1604;&#1578;&#1610; &#1576;&#1615;&#1606;&#1610;&#1578; &#1593;&#1604;&#1610;&#1607;&#1575; &#1607;&#1584;&#1607; &#1575;&#1604;&#1581;&#1575;&#1587;&#1576;&#1577;.'],
        guide: ['&#1591;&#1576;&#1617;&#1602; &#1607;&#1584;&#1575; &#1593;&#1605;&#1604;&#1610;&#1611;&#1575;', '&#1575;&#1604;&#1602;&#1585;&#1575;&#1569;&#1577; &#1608;&#1581;&#1583;&#1607;&#1575; &#1604;&#1575; &#1578;&#1603;&#1601;&#1610;. &#1578;&#1583;&#1585;&#1617;&#1576; &#1605;&#1580;&#1575;&#1606;&#1611;&#1575; &#1593;&#1604;&#1609; &#1605;&#1606;&#1589;&#1578;&#1606;&#1575;&#1548; &#1579;&#1605; &#1575;&#1606;&#1578;&#1602;&#1604; &#1573;&#1604;&#1609; &#1583;&#1601;&#1578;&#1585; &#1571;&#1608;&#1575;&#1605;&#1585; &#1581;&#1602;&#1610;&#1602;&#1610; &#1581;&#1610;&#1606; &#1610;&#1578;&#1590;&#1581; &#1604;&#1603; &#1575;&#1604;&#1571;&#1605;&#1585;.'],
        geo: ['&#1605;&#1606;&#1589;&#1575;&#1578; &#1578;&#1602;&#1576;&#1604;&#1603;', '&#1605;&#1593;&#1592;&#1605; &#1605;&#1606;&#1589;&#1575;&#1578; &#1575;&#1604;&#1593;&#1602;&#1608;&#1583; &#1575;&#1604;&#1570;&#1580;&#1604;&#1577; &#1605;&#1594;&#1604;&#1602;&#1577; &#1571;&#1605;&#1575;&#1605; &#1605;&#1602;&#1610;&#1605;&#1610; &#1571;&#1605;&#1585;&#1610;&#1603;&#1575; &#1575;&#1604;&#1588;&#1605;&#1575;&#1604;&#1610;&#1577;. &#1607;&#1575;&#1578;&#1575;&#1606; &#1575;&#1604;&#1605;&#1606;&#1589;&#1578;&#1575;&#1606; &#1605;&#1606;&#1592;&#1605;&#1578;&#1575;&#1606; &#1605;&#1581;&#1604;&#1610;&#1611;&#1575; &#1608;&#1605;&#1601;&#1578;&#1608;&#1581;&#1578;&#1575;&#1606; &#1604;&#1603;.'],
        disc: '&#1585;&#1608;&#1575;&#1576;&#1591; &#1573;&#1581;&#1575;&#1604;&#1577;. &#1606;&#1581;&#1589;&#1604; &#1593;&#1604;&#1609; &#1593;&#1605;&#1608;&#1604;&#1577; &#1573;&#1584;&#1575; &#1587;&#1580;&#1617;&#1604;&#1578;&#1548; &#1608;&#1575;&#1604;&#1587;&#1593;&#1585; &#1606;&#1601;&#1587;&#1607; &#1576;&#1575;&#1604;&#1606;&#1587;&#1576;&#1577; &#1604;&#1603;.', moon: '&#1571;&#1610; &#1587;&#1608;&#1602;&#1548; &#1589;&#1593;&#1608;&#1583;&#1611;&#1575; &#1571;&#1608; &#1607;&#1576;&#1608;&#1591;&#1611;&#1575;' },
  id: { liq: ['DI MANA LIKUIDASI INI TERJADI', 'Tidak ada yang teoretis di halaman ini &mdash; semuanya posisi nyata yang ditutup paksa di order book sungguhan. Inilah bursa tempat order book itu berada.'],
        deriv: ['TRADING DENGAN DATA INI', 'Funding, open interest, dan basis baru berarti kalau kamu punya posisi di bursa yang membayarnya.'],
        sim: ['SAAT LATIHAN TAK LAGI MENGAJARKAN APA-APA', 'Simulator tidak bisa mengajarkan slippage, funding, atau apa yang uang sungguhan lakukan pada penilaianmu. Begitu akun latihan berhenti mengejutkanmu, kecilkan ukuran dan masuk ke pasar nyata.'],
        calc: ['BURSA YANG DIASUMSIKAN ANGKA INI', 'Maintenance margin, tingkatan biaya, dan interval funding berbeda tiap bursa &mdash; inilah bursa yang menjadi model kalkulator ini.'],
        guide: ['PRAKTIKKAN INI', 'Membaca saja tidak cukup jauh. Latih gratis di terminal kami, lalu bawa ke order book sungguhan begitu terasa pas.'],
        geo: ['BURSA YANG MENERIMAMU', 'Sebagian besar bursa futures tertutup bagi penduduk Amerika Utara. Dua ini diatur secara lokal dan terbuka untukmu.'],
        disc: 'Tautan afiliasi. Kami dapat komisi jika kamu mendaftar; harganya sama saja untukmu.', moon: 'Pasar apa pun, naik atau turun' },
};

// path -> context. First match wins, so put the specific patterns first.
const RULES = [
  [/^(crypto-trading-usa|crypto-trading-canada)$/, 'geo'],
  [/(^|\/)(liquidations|rekt)(\/|$)|-liquidation-map$|^crypto-liquidations-today$|^liquidation-statistics$|^hyperliquid-liquidations$/, 'liq'],
  [/^(funding|open-interest|long-short|markets|etf-flows|defi|bitcoin-cycle|coins|hyperliquid-whales|fear-greed|coinglass-alternative|best-liquidation-heatmap-tools)$/, 'deriv'],
  [/simulator|^paper-trading$|^where-to-start$|^tools$|^best-crypto-paper-trading-platforms$|^binance-testnet-alternative$|^tradingview-paper-trading-alternative$/, 'sim'],
  [/calculator$|^pnl-fee-checker$/, 'calc'],
  [/^blog(\/|$)|^guides(\/|$)|^glossary$/, 'guide'],
];

// Pages that must stay clean: iframe embeds and the developer/legal/account surfaces, where an exchange
// ad is either impossible to render honestly (embeds land on somebody else's site) or actively unhelpful.
const SKIP = /^(privacy|terms|contact|about|api|trading-api|free-crypto-api|widgets|wordpress-crypto-widgets|community|premium|vault|levels|alerts|journal|rewards|spot|demo-home)$|^(widget|embed)\//;

const LANGS = new Set(['ar', 'de', 'es', 'fr', 'id', 'ja', 'ko', 'nl', 'pt', 'ru', 'tr', 'zh']);

const CSS = `<style id="mp-xr-css">
.mp-xr{margin:38px 0 6px}
.mp-xr-t{display:flex;align-items:center;gap:10px;font-family:'Space Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.24em;color:#5c656f;margin-bottom:9px;white-space:nowrap}
.mp-xr-t::before,.mp-xr-t::after{content:"";flex:1;height:1px;background:#28303c}
.mp-xr-w{font-size:14px;line-height:1.6;color:#8b95a1;margin:0 0 13px}
.mp-xr-r{display:flex;border:1px solid #262e3a;border-radius:13px;overflow:hidden;background:#0c0f13}
.mp-xr-c{position:relative;flex:1;display:flex;align-items:center;gap:9px;min-width:0;padding:13px 13px 13px 16px;text-decoration:none;color:#e9e7df;transition:background .16s}
.mp-xr-c::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--xa)}
.mp-xr-c:hover{background:#12161c}
.mp-xr-k{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:13.5px;flex-shrink:0;color:var(--xa)}
.mp-xr-d{font-size:11px;color:#8b95a1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.mp-xr-g{color:#5c656f;flex-shrink:0;font-weight:700;transition:transform .16s,color .16s}
.mp-xr-c:hover .mp-xr-g{transform:translateX(3px);color:#e9e7df}
.mp-xr-cut{width:1px;background:#262e3a;transform:skewX(-14deg);flex-shrink:0}
.mp-xr-n{font-size:11px;color:#5c656f;margin:9px 0 0}
@media(max-width:520px){.mp-xr-r{flex-direction:column}.mp-xr-cut{width:auto;height:1px;transform:none}}
</style>`;

function card(key, moonD) {
  const e = EX[key];
  const d = key === 'moon' ? moonD : e.d;
  return '<a class="mp-xr-c" style="--xa:' + e.accent + '" data-ex="' + e.name + '" href="' + e.href +
    '" target="_blank" rel="sponsored noopener noreferrer"' +
    ' onclick="try{window.__mpTrack&&window.__mpTrack(\'exchange\',\'' + e.name + '\')}catch(e){}">' +
    '<span class="mp-xr-k">' + e.name + '</span><span class="mp-xr-d">' + d + '</span><span class="mp-xr-g">&rarr;</span></a>';
}

function rail(ctxKey, lang) {
  const c = CTX[ctxKey];
  const t = lang && I18N[lang];
  const label = (t && t[ctxKey] && t[ctxKey][0]) || c.label;
  const why = (t && t[ctxKey] && t[ctxKey][1]) || c.why;
  const disc = (t && t.disc) || DISCLOSURE;
  const moonD = (t && t.moon) || MOON_D;
  return '\n<div class="mp-xr"><div class="mp-xr-t">' + label + '</div><p class="mp-xr-w">' + why + '</p>' +
    '<div class="mp-xr-r">' + card(c.ex[0], moonD) + '<i class="mp-xr-cut"></i>' + card(c.ex[1], moonD) + '</div>' +
    '<p class="mp-xr-n">' + disc + '</p></div>\n';
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'assets') continue; walk(p, out); }
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}

let added = 0, hadAff = 0, skipped = 0, noAnchor = 0;
const byCtx = {};
for (const f of walk(ROOT, [])) {
  let rel = path.relative(ROOT, f).replace(/\\/g, '/').replace(/\/index\.html$/, '').replace(/^index\.html$/, '');
  let html = fs.readFileSync(f, 'utf8');
  if (html.includes('mp-xr')) { skipped++; continue; }        // idempotent
  if (AFF.test(html)) { hadAff++; continue; }                 // already monetised, leave it alone

  let lang = null;
  const seg = rel.split('/');
  if (LANGS.has(seg[0])) { lang = seg[0]; rel = seg.slice(1).join('/'); }
  if (!rel || SKIP.test(rel)) { skipped++; continue; }

  let ctxKey = null;
  for (const [re, k] of RULES) if (re.test(rel)) { ctxKey = k; break; }
  if (!ctxKey) { skipped++; continue; }

  // pages without <article> or <footer> (the hand-made landing pages) close on a .foot wrapper instead
  const anchor = html.includes('</article>') ? '</article>'
    : (/<footer[ >]/.test(html) ? html.match(/<footer[ >]/)[0]
      : (/<div class="foot/.test(html) ? html.match(/<div class="foot/)[0] : null));
  if (!anchor) { noAnchor++; continue; }
  const i = html.indexOf(anchor);
  if (i < 0) { noAnchor++; continue; }

  const head = html.indexOf('</head>');
  if (head < 0) { noAnchor++; continue; }
  html = html.slice(0, head) + CSS + '\n' + html.slice(head);
  const j = html.indexOf(anchor);
  html = html.slice(0, j) + rail(ctxKey, lang) + html.slice(j);

  fs.writeFileSync(f, html);
  added++;
  byCtx[ctxKey] = (byCtx[ctxKey] || 0) + 1;
}
console.log('exchange rail: added to ' + added + ' pages (' +
  Object.keys(byCtx).sort().map(k => k + ' ' + byCtx[k]).join(', ') + '); ' +
  hadAff + ' already had affiliate links, ' + skipped + ' skipped, ' + noAnchor + ' had no anchor');
