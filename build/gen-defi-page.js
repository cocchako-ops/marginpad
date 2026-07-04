/* /defi/ — live DeFi overview (TVL, top chains, top protocols, stablecoin supply) via /api/defi/overview (DefiLlama, free). */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist', 'defi');

const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';

const url = 'https://marginpad.io/defi/';
const title = 'DeFi Dashboard — Total Value Locked, Top Chains, Protocols & Stablecoins';
const desc = 'Live DeFi overview: total value locked (TVL) across every chain, the biggest protocols, top blockchains by TVL and total stablecoin supply. Free, no signup, updated continuously.';
const kw = 'defi tvl, total value locked, defi dashboard, top defi protocols, tvl by chain, stablecoin supply, lido tvl, aave tvl, defi rankings';

const CSS = `
  .dfhero{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0 6px}
  @media(min-width:620px){.dfhero{grid-template-columns:1fr 1fr}}
  .dfbig{background:linear-gradient(180deg,var(--panel),#0d0f12);border:1px solid var(--line-bright);border-radius:14px;padding:16px 18px}
  .dfbig .k{font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-faint);font-weight:700}
  .dfbig .v{font-family:'Space Mono',monospace;font-weight:800;font-size:30px;letter-spacing:-1px;margin-top:5px}
  .dfbig .s{font-family:'Space Mono',monospace;font-size:11px;color:var(--ink-faint);margin-top:3px}
  .dfh2{font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-faint);font-weight:700;margin:24px 0 10px}
  .dfchain{display:flex;flex-direction:column;gap:8px}
  .dfrow{display:flex;align-items:center;gap:11px;background:var(--panel);border:1px solid var(--line-bright);border-radius:11px;padding:11px 13px}
  .dfrow .n{font-family:'Familjen Grotesk',sans-serif;font-weight:700;font-size:14.5px;flex:0 0 auto;min-width:108px;display:flex;align-items:center;gap:8px}
  .dfrow .n .i{width:20px;height:20px;border-radius:5px;flex:0 0 auto}
  .dftrk{flex:1;height:7px;border-radius:4px;background:var(--line);overflow:hidden}
  .dftrk i{display:block;height:100%;background:linear-gradient(90deg,#2ebd85,#c2f64a)}
  .dfrow .t{font-family:'Space Mono',monospace;font-weight:800;font-size:14px;flex:0 0 auto;min-width:74px;text-align:right}
  .dfpgrid{display:grid;grid-template-columns:1fr;gap:9px}
  @media(min-width:620px){.dfpgrid{grid-template-columns:1fr 1fr}}
  .dfp{display:flex;align-items:center;gap:11px;background:var(--panel);border:1px solid var(--line-bright);border-radius:12px;padding:11px 13px}
  .dfp .lg{width:30px;height:30px;border-radius:8px;flex:0 0 auto;background:var(--line)}
  .dfp .mid{flex:1;min-width:0}
  .dfp .nm{font-family:'Familjen Grotesk',sans-serif;font-weight:700;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dfp .ct{font-family:'Space Mono',monospace;font-size:10px;color:var(--ink-faint);margin-top:1px}
  .dfp .rt{text-align:right;flex:0 0 auto}
  .dfp .rt .tv{font-family:'Space Mono',monospace;font-weight:800;font-size:14px}
  .dfp .rt .ch{font-family:'Space Mono',monospace;font-size:10.5px;font-weight:700;margin-top:1px}
  .up{color:#34d99a}.dn{color:#ff7b72}
  .dfst{display:flex;flex-direction:column;gap:7px}
  .dfsrow{display:flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--line-bright);border-radius:10px;padding:9px 12px}
  .dfsrow .nm{font-family:'Familjen Grotesk',sans-serif;font-weight:700;font-size:14px;flex:0 0 auto;min-width:120px}
  .dfsrow .nm b{font-family:'Space Mono',monospace;font-size:10px;color:var(--ink-faint);font-weight:700;margin-left:6px}
  .dfsrow .mech{flex:1;font-family:'Space Mono',monospace;font-size:10.5px;color:var(--ink-faint)}
  .dfsrow .c{font-family:'Space Mono',monospace;font-weight:800;font-size:13.5px}
  .dfcta{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 8px}
  .dfcta a{flex:1;min-width:150px;text-align:center;text-decoration:none;font-family:'Space Mono',monospace;font-weight:700;font-size:13.5px;padding:13px 14px;border-radius:11px;border:1px solid var(--line-bright);background:linear-gradient(180deg,var(--panel),#0d0f12);color:var(--ink)}
  .dfcta a.go{background:#c2f64a;color:#0a0b0d;border-color:#c2f64a}
  .dfload{font-family:'Space Mono',monospace;font-size:12.5px;color:var(--ink-faint)}
  .dfp .rt .v24{font-family:'Space Mono',monospace;font-weight:800;font-size:14px}
  /* ===== desktop overhaul — full-width terminal treatment (bento design language) ===== */
  .df-glow{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(56% 50% at 8% 4%,rgba(194,246,74,.08),transparent 62%),radial-gradient(48% 55% at 94% 30%,rgba(63,216,230,.07),transparent 62%)}
  .wrap{position:relative;z-index:1}
  .df-eyebrow{display:none}
  @media(min-width:861px){
    .wrap{max-width:1460px;padding:0 clamp(24px,3vw,52px)}
    .df-eyebrow{display:inline-flex;align-items:center;gap:9px;font-family:'Space Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#8a95a1;margin-top:14px}
    .df-eyebrow i{width:8px;height:8px;border-radius:50%;background:#c2f64a;box-shadow:0 0 10px #c2f64a;animation:dfblink 1.5s ease-in-out infinite}
    article h1{font-size:44px;letter-spacing:-.03em;margin:10px 0 8px}
    .lead{font-size:15.5px;max-width:820px}
    .dfhero{grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0 8px}
    .dfbig{border-radius:15px;padding:18px 20px;transition:transform .16s ease,border-color .16s ease}
    .dfbig:hover{transform:translateY(-2px);border-color:#3a424c}
    .dfbig .k{font-size:9.5px;letter-spacing:.12em;color:#7f8994}
    .dfbig .v{font-family:'Bricolage Grotesque',sans-serif;font-size:32px;letter-spacing:-1.5px;font-variant-numeric:tabular-nums}
    .dfbig .s{color:#8a95a1}
    .dfh2{font-size:11px;color:#8a95a1;margin:30px 0 12px}
    .dfpgrid{grid-template-columns:repeat(3,1fr);gap:11px}
    .dfp{transition:transform .15s ease,border-color .15s ease}
    .dfp:hover{transform:translateY(-2px);border-color:#3a424c}
    .dfrow .n{min-width:150px;font-size:15px}
    .dfrow .t{min-width:90px}
    .dfsrow .mech{color:#8a95a1}
  }
  @keyframes dfblink{0%,100%{opacity:1}50%{opacity:.35}}
  /* mobile (matches the 720px nav breakpoint): stack the hero (a wide "$314.5B" in a half-width card overflowed → page looked zoomed-out) + tighten to the other pages' density */
  @media(max-width:720px){
    .wrap{padding:0 16px}
    article h1{font-size:25px;line-height:1.12;margin:14px 0 8px}
    .lead{font-size:13.5px;line-height:1.5}
    .dfhero{grid-template-columns:1fr 1fr;gap:8px;margin:12px 0 4px}
    .dfbig{padding:12px 12px;border-radius:12px}
    .dfbig .k{font-size:9px;letter-spacing:.03em}
    .dfbig .v{font-size:18px;letter-spacing:-.5px}
    .dfbig .s{font-size:9.5px}
    .dfh2{margin:18px 0 8px}
    .dfchain,.dfst{gap:7px}
    .dfrow{padding:10px 12px;gap:9px}
    .dfrow .n{min-width:84px;font-size:13px}
    .dfrow .t{min-width:60px;font-size:12.5px}
    .dfpgrid{grid-template-columns:1fr;gap:7px}
    .dfp{padding:10px 11px;gap:9px}
    .dfp .nm{font-size:13.5px}
    .dfp .rt .tv{font-size:13px}
    .dfsrow{padding:9px 11px;gap:8px}
    .dfsrow .nm{min-width:96px;font-size:12.5px}
    .dfsrow .mech{font-size:10px}
    .dfsrow .c{font-size:12.5px}
    .dfcta{gap:8px;margin:18px 0 6px}
    .dfcta a{min-width:46%;font-size:12.5px;padding:11px 10px}
    h2{font-size:19px;margin-top:18px}
    p{font-size:13.5px}
  }
`;

const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"MarginPad DeFi Dashboard","url":"${url}","applicationCategory":"FinanceApplication","operatingSystem":"Web","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://marginpad.io/"},{"@type":"ListItem","position":2,"name":"DeFi","item":"${url}"}]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is Total Value Locked (TVL)?","acceptedAnswer":{"@type":"Answer","text":"TVL is the total dollar value of crypto assets deposited in a DeFi protocol or blockchain — in lending pools, DEX liquidity, staking and vaults. It is the standard gauge of how much capital a protocol or chain has attracted."}},{"@type":"Question","name":"Which blockchain has the most DeFi TVL?","acceptedAnswer":{"@type":"Answer","text":"Ethereum has consistently held the largest share of DeFi TVL, followed by other large smart-contract chains. The live ranking on this page updates continuously from DefiLlama."}},{"@type":"Question","name":"How big is the stablecoin market?","acceptedAnswer":{"@type":"Answer","text":"Total stablecoin supply is the combined circulating value of all stablecoins such as USDT and USDC. This page shows the live total and the largest stablecoins by circulating supply."}}]}</script>`;

let html = `<!DOCTYPE html>
<html lang="en">
<head>${GTAG}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} | MarginPad</title>
<meta name="description" content="${desc}" />
<meta name="keywords" content="${kw}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#0a0b0d" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Familjen+Grotesk:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/assets/blog.css" />
<style>${CSS}</style>
${ld}
</head>
<body>
<div class="df-glow" aria-hidden="true"></div>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b style="color:#c2f64a">PAD</b></a>
    <nav class="nav"><a href="/markets/">Markets</a><a href="/liquidations/">Liquidations</a><a href="/funding/">Funding</a><a href="/defi/">DeFi</a><a href="/screener">Screener</a></nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / DeFi</div>
  <article>
    <div class="df-eyebrow"><i></i>Live · aggregated from DefiLlama</div>
    <h1>DeFi Dashboard</h1>
    <p class="lead">Live decentralized-finance overview — total value locked across every chain, the biggest protocols, top blockchains by TVL and the size of the stablecoin market. Aggregated from DefiLlama, updated continuously. Free, no signup.</p>

    <div class="dfhero">
      <div class="dfbig"><div class="k">Total value locked</div><div class="v" id="dfTvl">…</div><div class="s" id="dfTvlS">across all chains</div></div>
      <div class="dfbig"><div class="k">Stablecoin supply</div><div class="v" id="dfStb">…</div><div class="s">total circulating</div></div>
      <div class="dfbig"><div class="k">DEX volume · 24h</div><div class="v" id="dfDexT">…</div><div class="s">all decentralized exchanges</div></div>
      <div class="dfbig"><div class="k">Protocol fees · 24h</div><div class="v" id="dfFeeT">…</div><div class="s">paid by users, all protocols</div></div>
    </div>

    <div class="dfh2">Top chains by TVL</div>
    <div class="dfchain" id="dfChains"><div class="dfload">Loading chains…</div></div>

    <div class="dfh2">Biggest DeFi protocols</div>
    <div class="dfpgrid" id="dfProtos"><div class="dfload">Loading protocols…</div></div>

    <div class="dfh2">Largest stablecoins</div>
    <div class="dfst" id="dfStables"><div class="dfload">Loading stablecoins…</div></div>

    <div class="dfh2">DEX volume leaders · 24h</div>
    <div class="dfpgrid" id="dfDexs"><div class="dfload">Loading DEX volumes…</div></div>

    <div class="dfh2">Top earners — fees paid by users · 24h</div>
    <div class="dfpgrid" id="dfFees"><div class="dfload">Loading fees…</div></div>

    <div class="dfh2">Top revenue — what protocols keep · 24h</div>
    <div class="dfpgrid" id="dfRev"><div class="dfload">Loading revenue…</div></div>

    <div class="dfcta">
      <a class="go" href="/screener">Open the screener →</a>
      <a href="/funding/">Funding rates</a>
      <a href="/liquidations/">Liquidations</a>
    </div>

    <h2>What this DeFi dashboard shows</h2>
    <p><strong>Total value locked (TVL)</strong> is the combined dollar value of crypto deposited in DeFi — lending markets, decentralized-exchange liquidity, liquid staking and yield vaults. It is the headline gauge of how much capital a protocol or blockchain has attracted, so a rising TVL signals confidence and inflows, while a sharp drop often follows a hack, a depeg or capital rotating out.</p>

    <h2>How to read TVL by chain and protocol</h2>
    <p>The <strong>chain ranking</strong> shows where DeFi capital lives — Ethereum has long held the largest share, with other smart-contract chains competing for the rest. The <strong>protocol ranking</strong> lists the individual apps holding the most value (liquid-staking, lending and DEX protocols usually dominate); the 1-day and 7-day change columns show momentum. Watch big moves together: TVL leaving a chain while its <a href="/funding/">perp funding</a> flips negative and <a href="/liquidations/">long liquidations</a> spike is a classic risk-off signal.</p>

    <h2>Stablecoins — the plumbing of DeFi</h2>
    <p>Stablecoins are the settlement layer of crypto. Total stablecoin supply tracks how much "dry powder" is sitting on-chain ready to deploy — a growing supply is broadly bullish for liquidity, a shrinking one signals capital leaving the system. The list above ranks the largest stablecoins by circulating supply and shows each one's peg mechanism (fiat-backed, crypto-backed or algorithmic).</p>

    <h2>Volume, fees and revenue — who actually earns in DeFi</h2>
    <p><strong>DEX volume</strong> shows where trading happens on-chain — the busiest decentralized exchanges over the last 24 hours. <strong>Fees</strong> are what users paid to use a protocol (swap fees, borrow interest, gas on an L2); <strong>revenue</strong> is the slice the protocol itself keeps after paying liquidity providers or validators. A protocol with high fees but near-zero revenue passes almost everything to its LPs; one with strong revenue has a real business model behind its token. Comparing all three tells you which apps have genuine, paying users — not just deposited capital.</p>

    <p style="color:var(--ink-faint);font-size:13px;margin-top:22px">DeFi data aggregated from DefiLlama. For information only — not financial advice.</p>
  </article>
  <footer>
    <span>© 2026 MarginPad</span>
    <span><a href="/screener">Screener</a> · <a href="/funding/">Funding</a> · <a href="/liquidations/">Liquidations</a> · <a href="/defi/">DeFi</a></span>
  </footer>
</div>
<script>(function(){
  function bn(x){x=+x||0;var a=Math.abs(x);if(a>=1e12)return '$'+(x/1e12).toFixed(2)+'T';if(a>=1e9)return '$'+(x/1e9).toFixed(1)+'B';if(a>=1e6)return '$'+(x/1e6).toFixed(0)+'M';if(a>=1e3)return '$'+(x/1e3).toFixed(0)+'K';return '$'+x.toFixed(0);}
  function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function chgHtml(v){if(v==null||!isFinite(v))return '';var up=v>=0;return '<div class="ch '+(up?'up':'dn')+'">'+(up?'+':'')+v.toFixed(1)+'%</div>';}
  function render(d){
    if(!d||d.error){document.getElementById('dfTvl').textContent='—';return;}
    document.getElementById('dfTvl').textContent=bn(d.totalTvl);
    document.getElementById('dfTvlS').textContent='across '+d.chainCount+' chains';
    document.getElementById('dfStb').textContent=bn(d.stableTotal);
    var mx=(d.topChains[0]&&d.topChains[0].tvl)||1;
    document.getElementById('dfChains').innerHTML=d.topChains.map(function(c){
      var w=Math.max(3,(c.tvl/mx*100)).toFixed(1);
      return '<div class="dfrow"><div class="n">'+esc(c.name)+'</div><div class="dftrk"><i style="width:'+w+'%"></i></div><div class="t">'+bn(c.tvl)+'</div></div>';
    }).join('');
    document.getElementById('dfProtos').innerHTML=d.topProtos.map(function(p){
      var lg=p.logo?('<img class="lg" src="'+esc(p.logo)+'" alt="" loading="lazy" onerror="this.style.visibility=\\'hidden\\'">'):'<div class="lg"></div>';
      return '<div class="dfp">'+lg+'<div class="mid"><div class="nm">'+esc(p.name)+'</div><div class="ct">'+esc(p.cat)+(p.chain?' · '+esc(p.chain):'')+'</div></div><div class="rt"><div class="tv">'+bn(p.tvl)+'</div>'+chgHtml(p.chg7d)+'</div></div>';
    }).join('');
    document.getElementById('dfStables').innerHTML=d.topStables.map(function(s){
      var mech=esc(s.mech||'').replace(/-/g,' ');
      return '<div class="dfsrow"><div class="nm">'+esc(s.name)+'<b>'+esc(s.sym)+'</b></div><div class="mech">'+mech+'</div><div class="c">'+bn(s.circ)+'</div></div>';
    }).join('');
  }
  fetch('/api/defi/overview',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(render).catch(function(){document.getElementById('dfTvl').textContent='—';});
  // extra datasets: DEX volumes + fees + revenue (who actually earns)
  function xcard(p,label){
    var lg=p.logo?('<img class="lg" src="'+esc(p.logo)+'" alt="" loading="lazy" onerror="this.style.visibility=\\'hidden\\'">'):'<div class="lg"></div>';
    var ch=(p.chains&&p.chains.length)?p.chains.slice(0,2).join(' · '):'';
    return '<div class="dfp">'+lg+'<div class="mid"><div class="nm">'+esc(p.name)+'</div><div class="ct">'+esc(p.cat)+(ch?' · '+esc(ch):'')+'</div></div><div class="rt"><div class="v24">'+bn(p.v24)+'</div>'+chgHtml(p.chg)+'</div></div>';
  }
  function renderExtra(d){
    if(!d||d.error)return;
    var dt=document.getElementById('dfDexT');if(dt&&d.dexTotal24h!=null)dt.textContent=bn(d.dexTotal24h);
    var ft=document.getElementById('dfFeeT');if(ft&&d.feesTotal24h!=null)ft.textContent=bn(d.feesTotal24h);
    var dx=document.getElementById('dfDexs');if(dx)dx.innerHTML=(d.dexs||[]).map(xcard).join('')||'<div class="dfload">—</div>';
    var fe=document.getElementById('dfFees');if(fe)fe.innerHTML=(d.fees||[]).map(xcard).join('')||'<div class="dfload">—</div>';
    var rv=document.getElementById('dfRev');if(rv)rv.innerHTML=(d.revenue||[]).map(xcard).join('')||'<div class="dfload">—</div>';
  }
  fetch('/api/defi/extra',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(renderExtra).catch(function(){});
})();</script>
</body>
</html>
`;

fs.mkdirSync(OUT, { recursive: true });

// ---- translated /<lang>/defi/ variants (server-baked for SEO) ----
const LANGS = ['de','es','pt','fr','nl','ru','tr','zh','ja','ko','ar','id'];
const RTL = ['ar'];
const HREFLANG = ['<link rel="alternate" hreflang="x-default" href="https://marginpad.io/defi/" />','<link rel="alternate" hreflang="en" href="https://marginpad.io/defi/" />']
  .concat(LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="https://marginpad.io/${l}/defi/" />`)).join('\n');

// meta (title / description / keywords) per language
const META = {
  de:{t:'DeFi-Dashboard — Total Value Locked, Top-Chains, Protokolle & Stablecoins',d:'Live-DeFi-Überblick: Total Value Locked (TVL) über alle Chains, die größten Protokolle, Top-Blockchains nach TVL und die gesamte Stablecoin-Versorgung. Kostenlos, ohne Anmeldung, laufend aktualisiert.',k:'defi tvl, total value locked, defi dashboard, top defi protokolle, tvl nach chain, stablecoin versorgung'},
  es:{t:'Panel DeFi — Valor Total Bloqueado, Top Chains, Protocolos y Stablecoins',d:'Resumen DeFi en vivo: valor total bloqueado (TVL) en todas las cadenas, los mayores protocolos, top blockchains por TVL y la oferta total de stablecoins. Gratis, sin registro, actualizado continuamente.',k:'defi tvl, valor total bloqueado, panel defi, mejores protocolos defi, tvl por cadena, oferta stablecoin'},
  pt:{t:'Painel DeFi — Valor Total Bloqueado, Top Chains, Protocolos e Stablecoins',d:'Visão geral DeFi ao vivo: valor total bloqueado (TVL) em todas as chains, os maiores protocolos, top blockchains por TVL e a oferta total de stablecoins. Grátis, sem cadastro, atualizado continuamente.',k:'defi tvl, valor total bloqueado, painel defi, melhores protocolos defi, tvl por chain, oferta stablecoin'},
  fr:{t:'Tableau de bord DeFi — Valeur totale verrouillée, Top chaînes, Protocoles & Stablecoins',d:'Aperçu DeFi en direct : valeur totale verrouillée (TVL) sur toutes les chaînes, les plus grands protocoles, top blockchains par TVL et l\'offre totale de stablecoins. Gratuit, sans inscription, mis à jour en continu.',k:'defi tvl, valeur totale verrouillée, tableau de bord defi, meilleurs protocoles defi, tvl par chaîne, offre stablecoin'},
  nl:{t:'DeFi-dashboard — Total Value Locked, Top chains, Protocollen & Stablecoins',d:'Live DeFi-overzicht: total value locked (TVL) over alle chains, de grootste protocollen, top blockchains op TVL en de totale stablecoin-voorraad. Gratis, zonder registratie, doorlopend bijgewerkt.',k:'defi tvl, total value locked, defi dashboard, beste defi protocollen, tvl per chain, stablecoin voorraad'},
  ru:{t:'DeFi-дашборд — заблокированная стоимость (TVL), топ-сети, протоколы и стейблкоины',d:'Живой обзор DeFi: общая заблокированная стоимость (TVL) по всем сетям, крупнейшие протоколы, топ-блокчейны по TVL и общий объём стейблкоинов. Бесплатно, без регистрации, обновляется постоянно.',k:'defi tvl, заблокированная стоимость, defi дашборд, топ defi протоколы, tvl по сетям, объём стейблкоинов'},
  tr:{t:'DeFi Panosu — Kilitli Toplam Değer, En İyi Zincirler, Protokoller ve Stablecoin\'ler',d:'Canlı DeFi genel bakışı: tüm zincirlerde kilitli toplam değer (TVL), en büyük protokoller, TVL\'ye göre en iyi blok zincirleri ve toplam stablecoin arzı. Ücretsiz, kayıt yok, sürekli güncellenir.',k:'defi tvl, kilitli toplam değer, defi panosu, en iyi defi protokolleri, zincire göre tvl, stablecoin arzı'},
  zh:{t:'DeFi 仪表盘 — 总锁仓量、热门公链、协议与稳定币',d:'实时 DeFi 概览：所有公链的总锁仓量（TVL）、最大的协议、按 TVL 排名的热门区块链以及稳定币总供应量。免费、无需注册、持续更新。',k:'defi tvl, 总锁仓量, defi 仪表盘, 热门 defi 协议, 按公链 tvl, 稳定币供应'},
  ja:{t:'DeFiダッシュボード — 預かり資産(TVL)、トップチェーン、プロトコル、ステーブルコイン',d:'ライブDeFi概観：全チェーンの預かり資産(TVL)、最大級のプロトコル、TVL別トップブロックチェーン、ステーブルコイン総供給量。無料・登録不要・常時更新。',k:'defi tvl, 預かり資産, defiダッシュボード, トップdefiプロトコル, チェーン別tvl, ステーブルコイン供給'},
  ko:{t:'DeFi 대시보드 — 총 예치금(TVL), 상위 체인, 프로토콜, 스테이블코인',d:'실시간 DeFi 개요: 모든 체인의 총 예치금(TVL), 최대 프로토콜, TVL 기준 상위 블록체인, 총 스테이블코인 공급량. 무료, 가입 불필요, 지속 업데이트.',k:'defi tvl, 총 예치금, defi 대시보드, 상위 defi 프로토콜, 체인별 tvl, 스테이블코인 공급'},
  ar:{t:'لوحة DeFi — القيمة الإجمالية المقفلة وأهم الشبكات والبروتوكولات والعملات المستقرة',d:'نظرة DeFi مباشرة: القيمة الإجمالية المقفلة (TVL) عبر كل الشبكات، أكبر البروتوكولات، أهم البلوكشينات حسب TVL، وإجمالي معروض العملات المستقرة. مجاني، بدون تسجيل، تحديث مستمر.',k:'defi tvl, القيمة المقفلة, لوحة defi, أفضل بروتوكولات defi, tvl حسب الشبكة, معروض العملات المستقرة'},
  id:{t:'Dasbor DeFi — Total Value Locked, Chain Teratas, Protokol & Stablecoin',d:'Ikhtisar DeFi langsung: total value locked (TVL) di semua chain, protokol terbesar, blockchain teratas berdasarkan TVL, dan total pasokan stablecoin. Gratis, tanpa daftar, diperbarui terus-menerus.',k:'defi tvl, total value locked, dasbor defi, protokol defi terbaik, tvl per chain, pasokan stablecoin'}
};

// content phrases: [englishExact, {lang: translation}]
const PH = [
  ['<h1>DeFi Dashboard</h1>', {de:'<h1>DeFi-Dashboard</h1>',es:'<h1>Panel DeFi</h1>',pt:'<h1>Painel DeFi</h1>',fr:'<h1>Tableau de bord DeFi</h1>',nl:'<h1>DeFi-dashboard</h1>',ru:'<h1>DeFi-дашборд</h1>',tr:'<h1>DeFi Panosu</h1>',zh:'<h1>DeFi 仪表盘</h1>',ja:'<h1>DeFiダッシュボード</h1>',ko:'<h1>DeFi 대시보드</h1>',ar:'<h1>لوحة DeFi</h1>',id:'<h1>Dasbor DeFi</h1>'}],
  ['Live decentralized-finance overview — total value locked across every chain, the biggest protocols, top blockchains by TVL and the size of the stablecoin market. Aggregated from DefiLlama, updated continuously. Free, no signup.', {de:'Live-Überblick über die dezentrale Finanzwelt — Total Value Locked über alle Chains, die größten Protokolle, Top-Blockchains nach TVL und die Größe des Stablecoin-Markts. Aggregiert von DefiLlama, laufend aktualisiert. Kostenlos, ohne Anmeldung.',es:'Resumen de finanzas descentralizadas en vivo — valor total bloqueado en todas las cadenas, los mayores protocolos, top blockchains por TVL y el tamaño del mercado de stablecoins. Agregado desde DefiLlama, actualizado continuamente. Gratis, sin registro.',pt:'Visão geral de finanças descentralizadas ao vivo — valor total bloqueado em todas as chains, os maiores protocolos, top blockchains por TVL e o tamanho do mercado de stablecoins. Agregado da DefiLlama, atualizado continuamente. Grátis, sem cadastro.',fr:'Aperçu en direct de la finance décentralisée — valeur totale verrouillée sur toutes les chaînes, les plus grands protocoles, top blockchains par TVL et la taille du marché des stablecoins. Agrégé depuis DefiLlama, mis à jour en continu. Gratuit, sans inscription.',nl:'Live overzicht van decentralized finance — total value locked over alle chains, de grootste protocollen, top blockchains op TVL en de omvang van de stablecoin-markt. Geaggregeerd van DefiLlama, doorlopend bijgewerkt. Gratis, zonder registratie.',ru:'Живой обзор децентрализованных финансов — заблокированная стоимость по всем сетям, крупнейшие протоколы, топ-блокчейны по TVL и размер рынка стейблкоинов. Агрегировано с DefiLlama, обновляется постоянно. Бесплатно, без регистрации.',tr:'Merkeziyetsiz finansın canlı genel görünümü — tüm zincirlerde kilitli toplam değer, en büyük protokoller, TVL\'ye göre en iyi blok zincirleri ve stablecoin piyasasının büyüklüğü. DefiLlama\'dan derlenir, sürekli güncellenir. Ücretsiz, kayıt yok.',zh:'去中心化金融实时概览 — 所有公链的总锁仓量、最大的协议、按 TVL 排名的热门区块链以及稳定币市场规模。数据来自 DefiLlama，持续更新。免费、无需注册。',ja:'分散型金融のライブ概観 — 全チェーンの預かり資産、最大級のプロトコル、TVL別トップブロックチェーン、ステーブルコイン市場の規模。DefiLlamaから集計、常時更新。無料・登録不要。',ko:'탈중앙화 금융 실시간 개요 — 모든 체인의 총 예치금, 최대 프로토콜, TVL 기준 상위 블록체인, 스테이블코인 시장 규모. DefiLlama에서 집계, 지속 업데이트. 무료, 가입 불필요.',ar:'نظرة مباشرة على التمويل اللامركزي — القيمة الإجمالية المقفلة عبر كل الشبكات، أكبر البروتوكولات، أهم البلوكشينات حسب TVL وحجم سوق العملات المستقرة. مُجمَّع من DefiLlama، تحديث مستمر. مجاني، بدون تسجيل.',id:'Ikhtisar keuangan terdesentralisasi langsung — total value locked di semua chain, protokol terbesar, blockchain teratas berdasarkan TVL, dan ukuran pasar stablecoin. Diagregasi dari DefiLlama, diperbarui terus-menerus. Gratis, tanpa daftar.'}],
  ['<div class="k">Total value locked</div>', {de:'<div class="k">Total Value Locked</div>',es:'<div class="k">Valor total bloqueado</div>',pt:'<div class="k">Valor total bloqueado</div>',fr:'<div class="k">Valeur totale verrouillée</div>',nl:'<div class="k">Total value locked</div>',ru:'<div class="k">Заблокированная стоимость</div>',tr:'<div class="k">Kilitli toplam değer</div>',zh:'<div class="k">总锁仓量</div>',ja:'<div class="k">預かり資産</div>',ko:'<div class="k">총 예치금</div>',ar:'<div class="k">القيمة الإجمالية المقفلة</div>',id:'<div class="k">Total value locked</div>'}],
  ['<div class="s" id="dfTvlS">across all chains</div>', {de:'<div class="s" id="dfTvlS">über alle Chains</div>',es:'<div class="s" id="dfTvlS">en todas las cadenas</div>',pt:'<div class="s" id="dfTvlS">em todas as chains</div>',fr:'<div class="s" id="dfTvlS">sur toutes les chaînes</div>',nl:'<div class="s" id="dfTvlS">over alle chains</div>',ru:'<div class="s" id="dfTvlS">по всем сетям</div>',tr:'<div class="s" id="dfTvlS">tüm zincirlerde</div>',zh:'<div class="s" id="dfTvlS">所有公链</div>',ja:'<div class="s" id="dfTvlS">全チェーン</div>',ko:'<div class="s" id="dfTvlS">모든 체인</div>',ar:'<div class="s" id="dfTvlS">عبر كل الشبكات</div>',id:'<div class="s" id="dfTvlS">di semua chain</div>'}],
  ['<div class="k">Stablecoin supply</div>', {de:'<div class="k">Stablecoin-Versorgung</div>',es:'<div class="k">Oferta de stablecoins</div>',pt:'<div class="k">Oferta de stablecoins</div>',fr:'<div class="k">Offre de stablecoins</div>',nl:'<div class="k">Stablecoin-voorraad</div>',ru:'<div class="k">Объём стейблкоинов</div>',tr:'<div class="k">Stablecoin arzı</div>',zh:'<div class="k">稳定币供应</div>',ja:'<div class="k">ステーブルコイン供給</div>',ko:'<div class="k">스테이블코인 공급</div>',ar:'<div class="k">معروض العملات المستقرة</div>',id:'<div class="k">Pasokan stablecoin</div>'}],
  ['<div class="s">total circulating</div>', {de:'<div class="s">gesamt im Umlauf</div>',es:'<div class="s">total en circulación</div>',pt:'<div class="s">total em circulação</div>',fr:'<div class="s">total en circulation</div>',nl:'<div class="s">totaal in omloop</div>',ru:'<div class="s">всего в обращении</div>',tr:'<div class="s">dolaşımdaki toplam</div>',zh:'<div class="s">流通总量</div>',ja:'<div class="s">流通総量</div>',ko:'<div class="s">총 유통량</div>',ar:'<div class="s">إجمالي المتداول</div>',id:'<div class="s">total beredar</div>'}],
  ['<div class="dfh2">Top chains by TVL</div>', {de:'<div class="dfh2">Top-Chains nach TVL</div>',es:'<div class="dfh2">Top cadenas por TVL</div>',pt:'<div class="dfh2">Top chains por TVL</div>',fr:'<div class="dfh2">Top chaînes par TVL</div>',nl:'<div class="dfh2">Top chains op TVL</div>',ru:'<div class="dfh2">Топ-сети по TVL</div>',tr:'<div class="dfh2">TVL\'ye göre en iyi zincirler</div>',zh:'<div class="dfh2">按 TVL 排名的公链</div>',ja:'<div class="dfh2">TVL別トップチェーン</div>',ko:'<div class="dfh2">TVL 기준 상위 체인</div>',ar:'<div class="dfh2">أهم الشبكات حسب TVL</div>',id:'<div class="dfh2">Chain teratas berdasarkan TVL</div>'}],
  ['Loading chains…', {de:'Chains werden geladen…',es:'Cargando cadenas…',pt:'Carregando chains…',fr:'Chargement des chaînes…',nl:'Chains laden…',ru:'Загрузка сетей…',tr:'Zincirler yükleniyor…',zh:'正在加载公链…',ja:'チェーンを読み込み中…',ko:'체인 불러오는 중…',ar:'جارٍ تحميل الشبكات…',id:'Memuat chain…'}],
  ['<div class="dfh2">Biggest DeFi protocols</div>', {de:'<div class="dfh2">Größte DeFi-Protokolle</div>',es:'<div class="dfh2">Mayores protocolos DeFi</div>',pt:'<div class="dfh2">Maiores protocolos DeFi</div>',fr:'<div class="dfh2">Plus grands protocoles DeFi</div>',nl:'<div class="dfh2">Grootste DeFi-protocollen</div>',ru:'<div class="dfh2">Крупнейшие DeFi-протоколы</div>',tr:'<div class="dfh2">En büyük DeFi protokolleri</div>',zh:'<div class="dfh2">最大的 DeFi 协议</div>',ja:'<div class="dfh2">最大級のDeFiプロトコル</div>',ko:'<div class="dfh2">최대 DeFi 프로토콜</div>',ar:'<div class="dfh2">أكبر بروتوكولات DeFi</div>',id:'<div class="dfh2">Protokol DeFi terbesar</div>'}],
  ['Loading protocols…', {de:'Protokolle werden geladen…',es:'Cargando protocolos…',pt:'Carregando protocolos…',fr:'Chargement des protocoles…',nl:'Protocollen laden…',ru:'Загрузка протоколов…',tr:'Protokoller yükleniyor…',zh:'正在加载协议…',ja:'プロトコルを読み込み中…',ko:'프로토콜 불러오는 중…',ar:'جارٍ تحميل البروتوكولات…',id:'Memuat protokol…'}],
  ['<div class="dfh2">Largest stablecoins</div>', {de:'<div class="dfh2">Größte Stablecoins</div>',es:'<div class="dfh2">Mayores stablecoins</div>',pt:'<div class="dfh2">Maiores stablecoins</div>',fr:'<div class="dfh2">Plus grands stablecoins</div>',nl:'<div class="dfh2">Grootste stablecoins</div>',ru:'<div class="dfh2">Крупнейшие стейблкоины</div>',tr:'<div class="dfh2">En büyük stablecoin\'ler</div>',zh:'<div class="dfh2">最大的稳定币</div>',ja:'<div class="dfh2">最大級のステーブルコイン</div>',ko:'<div class="dfh2">최대 스테이블코인</div>',ar:'<div class="dfh2">أكبر العملات المستقرة</div>',id:'<div class="dfh2">Stablecoin terbesar</div>'}],
  ['Loading stablecoins…', {de:'Stablecoins werden geladen…',es:'Cargando stablecoins…',pt:'Carregando stablecoins…',fr:'Chargement des stablecoins…',nl:'Stablecoins laden…',ru:'Загрузка стейблкоинов…',tr:'Stablecoin\'ler yükleniyor…',zh:'正在加载稳定币…',ja:'ステーブルコインを読み込み中…',ko:'스테이블코인 불러오는 중…',ar:'جارٍ تحميل العملات المستقرة…',id:'Memuat stablecoin…'}],
  ['>Open the screener →</a>', {de:'>Screener öffnen →</a>',es:'>Abrir el screener →</a>',pt:'>Abrir o screener →</a>',fr:'>Ouvrir le screener →</a>',nl:'>Open de screener →</a>',ru:'>Открыть скринер →</a>',tr:'>Tarayıcıyı aç →</a>',zh:'>打开选币器 →</a>',ja:'>スクリーナーを開く →</a>',ko:'>스크리너 열기 →</a>',ar:'>افتح الماسح →</a>',id:'>Buka screener →</a>'}],
  ['>Funding rates</a>', {de:'>Funding-Raten</a>',es:'>Tasas de funding</a>',pt:'>Taxas de funding</a>',fr:'>Taux de funding</a>',nl:'>Funding-tarieven</a>',ru:'>Ставки финансирования</a>',tr:'>Funding oranları</a>',zh:'>资金费率</a>',ja:'>資金調達率</a>',ko:'>펀딩 비율</a>',ar:'>معدلات التمويل</a>',id:'>Tarif funding</a>'}],
  ['<h2>What this DeFi dashboard shows</h2>', {de:'<h2>Was dieses DeFi-Dashboard zeigt</h2>',es:'<h2>Qué muestra este panel DeFi</h2>',pt:'<h2>O que este painel DeFi mostra</h2>',fr:'<h2>Ce que montre ce tableau de bord DeFi</h2>',nl:'<h2>Wat dit DeFi-dashboard toont</h2>',ru:'<h2>Что показывает этот DeFi-дашборд</h2>',tr:'<h2>Bu DeFi panosu ne gösterir</h2>',zh:'<h2>这个 DeFi 仪表盘显示什么</h2>',ja:'<h2>このDeFiダッシュボードが示すもの</h2>',ko:'<h2>이 DeFi 대시보드가 보여주는 것</h2>',ar:'<h2>ماذا تعرض لوحة DeFi هذه</h2>',id:'<h2>Apa yang ditampilkan dasbor DeFi ini</h2>'}],
  ['<p><strong>Total value locked (TVL)</strong> is the combined dollar value of crypto deposited in DeFi — lending markets, decentralized-exchange liquidity, liquid staking and yield vaults. It is the headline gauge of how much capital a protocol or blockchain has attracted, so a rising TVL signals confidence and inflows, while a sharp drop often follows a hack, a depeg or capital rotating out.</p>', {de:'<p><strong>Total Value Locked (TVL)</strong> ist der gesamte Dollarwert der in DeFi hinterlegten Kryptowerte — Kreditmärkte, Liquidität dezentraler Börsen, Liquid Staking und Yield-Vaults. Es ist der zentrale Maßstab dafür, wie viel Kapital ein Protokoll oder eine Blockchain angezogen hat: Ein steigender TVL signalisiert Vertrauen und Zuflüsse, während ein starker Rückgang oft auf einen Hack, einen Depeg oder abfließendes Kapital folgt.</p>',es:'<p><strong>El valor total bloqueado (TVL)</strong> es el valor combinado en dólares de las criptomonedas depositadas en DeFi — mercados de préstamos, liquidez de exchanges descentralizados, staking líquido y bóvedas de rendimiento. Es el indicador principal de cuánto capital ha atraído un protocolo o blockchain: un TVL en aumento señala confianza y entradas, mientras que una caída brusca suele seguir a un hackeo, una pérdida de paridad o capital que sale.</p>',pt:'<p><strong>O valor total bloqueado (TVL)</strong> é o valor combinado em dólares das criptos depositadas em DeFi — mercados de empréstimo, liquidez de exchanges descentralizadas, staking líquido e cofres de rendimento. É o principal indicador de quanto capital um protocolo ou blockchain atraiu: um TVL crescente sinaliza confiança e entradas, enquanto uma queda acentuada costuma seguir um hack, uma perda de paridade ou capital saindo.</p>',fr:'<p><strong>La valeur totale verrouillée (TVL)</strong> est la valeur combinée en dollars des cryptos déposées dans la DeFi — marchés de prêt, liquidité des exchanges décentralisés, staking liquide et coffres de rendement. C\'est l\'indicateur phare du capital qu\'un protocole ou une blockchain a attiré : une TVL en hausse signale confiance et entrées, tandis qu\'une forte baisse suit souvent un hack, un depeg ou une sortie de capitaux.</p>',nl:'<p><strong>Total value locked (TVL)</strong> is de gecombineerde dollarwaarde van crypto die in DeFi is gestort — leenmarkten, liquiditeit van gedecentraliseerde exchanges, liquid staking en yield-vaults. Het is de belangrijkste maatstaf voor hoeveel kapitaal een protocol of blockchain heeft aangetrokken: een stijgende TVL duidt op vertrouwen en instroom, terwijl een scherpe daling vaak volgt op een hack, een depeg of uitstromend kapitaal.</p>',ru:'<p><strong>Заблокированная стоимость (TVL)</strong> — это совокупная долларовая стоимость криптоактивов, размещённых в DeFi: рынки кредитования, ликвидность децентрализованных бирж, ликвидный стейкинг и доходные хранилища. Это главный показатель того, сколько капитала привлёк протокол или блокчейн: рост TVL сигнализирует о доверии и притоке, тогда как резкое падение часто следует за взломом, потерей привязки или оттоком капитала.</p>',tr:'<p><strong>Kilitli toplam değer (TVL)</strong>, DeFi\'ye yatırılan kriptonun toplam dolar değeridir — borç verme piyasaları, merkeziyetsiz borsa likiditesi, likit staking ve getiri kasaları. Bir protokol veya blok zincirinin ne kadar sermaye çektiğinin ana göstergesidir: artan TVL güven ve girişe işaret ederken, sert düşüş genellikle bir hack, depeg veya çıkan sermayeyi izler.</p>',zh:'<p><strong>总锁仓量（TVL）</strong>是存入 DeFi 的加密资产的美元总价值 — 借贷市场、去中心化交易所流动性、流动性质押和收益金库。它是衡量一个协议或区块链吸引了多少资金的核心指标：TVL 上升意味着信心与资金流入，而急剧下跌往往伴随黑客攻击、脱锚或资金撤出。</p>',ja:'<p><strong>預かり資産（TVL）</strong>は、DeFiに預けられた暗号資産の合計ドル価値です — レンディング市場、分散型取引所の流動性、リキッドステーキング、利回りボールト。プロトコルやブロックチェーンがどれだけの資本を集めたかを示す主要指標で、TVLの上昇は信認と資金流入を、急落はハッキングやデペッグ、資本流出を示すことが多いです。</p>',ko:'<p><strong>총 예치금(TVL)</strong>은 DeFi에 예치된 암호화폐의 달러 합산 가치입니다 — 대출 시장, 탈중앙 거래소 유동성, 리퀴드 스테이킹, 수익 볼트. 프로토콜이나 블록체인이 얼마나 많은 자본을 유치했는지 보여주는 핵심 지표로, TVL 상승은 신뢰와 유입을, 급락은 해킹·디페그·자본 이탈을 뒤따르는 경우가 많습니다.</p>',ar:'<p><strong>القيمة الإجمالية المقفلة (TVL)</strong> هي القيمة الدولارية المجمّعة للعملات المودعة في DeFi — أسواق الإقراض وسيولة المنصات اللامركزية والـ liquid staking وخزائن العائد. وهي المقياس الرئيسي لمقدار رأس المال الذي جذبه بروتوكول أو بلوكشين: ارتفاع TVL يشير إلى الثقة والتدفقات الداخلة، بينما يتبع الانخفاض الحاد غالباً اختراقاً أو فقدان ربط أو خروج رأس المال.</p>',id:'<p><strong>Total value locked (TVL)</strong> adalah nilai dolar gabungan kripto yang disetor di DeFi — pasar pinjaman, likuiditas bursa terdesentralisasi, liquid staking, dan vault hasil. Ini indikator utama seberapa banyak modal yang ditarik sebuah protokol atau blockchain: TVL naik menandakan kepercayaan dan arus masuk, sedangkan penurunan tajam sering mengikuti peretasan, depeg, atau modal keluar.</p>'}],
  ['<h2>How to read TVL by chain and protocol</h2>', {de:'<h2>TVL nach Chain und Protokoll lesen</h2>',es:'<h2>Cómo leer el TVL por cadena y protocolo</h2>',pt:'<h2>Como ler o TVL por chain e protocolo</h2>',fr:'<h2>Comment lire la TVL par chaîne et protocole</h2>',nl:'<h2>TVL lezen per chain en protocol</h2>',ru:'<h2>Как читать TVL по сети и протоколу</h2>',tr:'<h2>TVL zincir ve protokole göre nasıl okunur</h2>',zh:'<h2>如何按公链与协议解读 TVL</h2>',ja:'<h2>チェーン・プロトコル別TVLの読み方</h2>',ko:'<h2>체인·프로토콜별 TVL 읽는 법</h2>',ar:'<h2>كيف تقرأ TVL حسب الشبكة والبروتوكول</h2>',id:'<h2>Cara membaca TVL per chain dan protokol</h2>'}],
  ['<p>The <strong>chain ranking</strong> shows where DeFi capital lives — Ethereum has long held the largest share, with other smart-contract chains competing for the rest. The <strong>protocol ranking</strong> lists the individual apps holding the most value (liquid-staking, lending and DEX protocols usually dominate); the 1-day and 7-day change columns show momentum. Watch big moves together: TVL leaving a chain while its <a href="/funding/">perp funding</a> flips negative and <a href="/liquidations/">long liquidations</a> spike is a classic risk-off signal.</p>', {de:'<p>Das <strong>Chain-Ranking</strong> zeigt, wo DeFi-Kapital liegt — Ethereum hält seit langem den größten Anteil, andere Smart-Contract-Chains konkurrieren um den Rest. Das <strong>Protokoll-Ranking</strong> listet die einzelnen Apps mit dem meisten Wert (Liquid-Staking-, Lending- und DEX-Protokolle dominieren meist); die Spalten 1-Tag und 7-Tage zeigen das Momentum. Achte auf große Bewegungen gemeinsam: TVL verlässt eine Chain, während ihr <a href="/funding/">Perp-Funding</a> negativ wird und <a href="/liquidations/">Long-Liquidationen</a> hochschnellen — ein klassisches Risk-off-Signal.</p>',es:'<p>El <strong>ranking de cadenas</strong> muestra dónde está el capital DeFi — Ethereum ha tenido durante mucho tiempo la mayor parte, con otras cadenas de contratos inteligentes compitiendo por el resto. El <strong>ranking de protocolos</strong> lista las apps con más valor (suelen dominar liquid-staking, préstamos y DEX); las columnas de 1 y 7 días muestran el momentum. Observa los grandes movimientos juntos: el TVL saliendo de una cadena mientras su <a href="/funding/">funding de perps</a> se vuelve negativo y las <a href="/liquidations/">liquidaciones largas</a> se disparan es una clásica señal de aversión al riesgo.</p>',pt:'<p>O <strong>ranking de chains</strong> mostra onde o capital DeFi vive — a Ethereum há muito detém a maior parte, com outras chains de contratos inteligentes disputando o resto. O <strong>ranking de protocolos</strong> lista os apps com mais valor (liquid-staking, empréstimos e DEX costumam dominar); as colunas de 1 e 7 dias mostram o momentum. Observe os grandes movimentos juntos: TVL saindo de uma chain enquanto seu <a href="/funding/">funding de perp</a> vira negativo e as <a href="/liquidations/">liquidações longas</a> disparam é um clássico sinal de aversão a risco.</p>',fr:'<p>Le <strong>classement des chaînes</strong> montre où vit le capital DeFi — Ethereum détient depuis longtemps la plus grande part, les autres chaînes à contrats intelligents se disputant le reste. Le <strong>classement des protocoles</strong> liste les applications détenant le plus de valeur (staking liquide, prêt et DEX dominent généralement) ; les colonnes 1 jour et 7 jours montrent le momentum. Surveillez les grands mouvements ensemble : une TVL quittant une chaîne alors que son <a href="/funding/">funding perp</a> passe négatif et que les <a href="/liquidations/">liquidations longues</a> explosent est un signal classique d\'aversion au risque.</p>',nl:'<p>De <strong>chain-ranglijst</strong> toont waar DeFi-kapitaal zit — Ethereum heeft lang het grootste aandeel gehad, met andere smart-contractchains die om de rest strijden. De <strong>protocol-ranglijst</strong> toont de apps met de meeste waarde (liquid-staking, lenen en DEX domineren meestal); de kolommen van 1 en 7 dagen tonen het momentum. Let op grote bewegingen samen: TVL die een chain verlaat terwijl de <a href="/funding/">perp-funding</a> negatief wordt en <a href="/liquidations/">long-liquidaties</a> pieken is een klassiek risk-off-signaal.</p>',ru:'<p><strong>Рейтинг сетей</strong> показывает, где находится капитал DeFi — Ethereum давно удерживает наибольшую долю, а другие смарт-контрактные сети борются за остальное. <strong>Рейтинг протоколов</strong> перечисляет приложения с наибольшей стоимостью (обычно доминируют ликвидный стейкинг, кредитование и DEX); колонки за 1 и 7 дней показывают импульс. Следите за крупными движениями вместе: отток TVL из сети при отрицательном <a href="/funding/">фандинге перпов</a> и всплеске <a href="/liquidations/">ликвидаций лонгов</a> — классический сигнал ухода от риска.</p>',tr:'<p><strong>Zincir sıralaması</strong> DeFi sermayesinin nerede olduğunu gösterir — Ethereum uzun süredir en büyük paya sahip, diğer akıllı sözleşme zincirleri geri kalan için yarışıyor. <strong>Protokol sıralaması</strong> en çok değeri tutan uygulamaları listeler (genelde likit staking, borç verme ve DEX baskındır); 1 günlük ve 7 günlük değişim sütunları momentumu gösterir. Büyük hareketleri birlikte izleyin: bir zincirden TVL çıkarken <a href="/funding/">perp funding</a>\'inin negatife dönmesi ve <a href="/liquidations/">long likidasyonlarının</a> fırlaması klasik bir riskten kaçış sinyalidir.</p>',zh:'<p><strong>公链排名</strong>显示 DeFi 资金所在 — 以太坊长期占据最大份额，其他智能合约公链争夺其余部分。<strong>协议排名</strong>列出持有价值最多的应用（通常流动性质押、借贷和 DEX 协议占主导）；1 天和 7 天变化列显示动能。一起观察大动作：资金离开某公链、其<a href="/funding/">永续资金费率</a>转负、<a href="/liquidations/">多头爆仓</a>飙升，是典型的避险信号。</p>',ja:'<p><strong>チェーンランキング</strong>はDeFi資本の所在を示します — イーサリアムが長く最大シェアを保持し、他のスマートコントラクトチェーンが残りを争います。<strong>プロトコルランキング</strong>は最も価値を保有するアプリを一覧します（通常はリキッドステーキング・レンディング・DEXが優勢）。1日・7日の変化列はモメンタムを示します。大きな動きはまとめて見ましょう：あるチェーンからTVLが流出し、<a href="/funding/">パーペ資金調達率</a>がマイナスに転じ、<a href="/liquidations/">ロング清算</a>が急増するのは典型的なリスクオフのサインです。</p>',ko:'<p><strong>체인 순위</strong>는 DeFi 자본이 어디에 있는지 보여줍니다 — 이더리움이 오랫동안 가장 큰 비중을 차지했고, 다른 스마트컨트랙트 체인들이 나머지를 두고 경쟁합니다. <strong>프로토콜 순위</strong>는 가장 많은 가치를 보유한 앱을 나열합니다(보통 리퀴드 스테이킹·대출·DEX가 우세). 1일·7일 변화 열은 모멘텀을 보여줍니다. 큰 움직임을 함께 보세요: 한 체인에서 TVL이 빠지면서 <a href="/funding/">퍼프 펀딩</a>이 마이너스로 돌아서고 <a href="/liquidations/">롱 청산</a>이 급증하는 것은 전형적인 위험 회피 신호입니다.</p>',ar:'<p><strong>ترتيب الشبكات</strong> يُظهر أين يوجد رأس مال DeFi — احتفظت إيثريوم طويلاً بالحصة الأكبر، بينما تتنافس شبكات العقود الذكية الأخرى على الباقي. <strong>ترتيب البروتوكولات</strong> يسرد التطبيقات التي تحتجز أكبر قيمة (تهيمن عادةً بروتوكولات liquid-staking والإقراض و DEX)؛ يُظهر عمودا التغيّر ليوم و7 أيام الزخم. راقب التحركات الكبيرة معاً: خروج TVL من شبكة مع تحوّل <a href="/funding/">تمويل العقود الدائمة</a> إلى السالب وارتفاع <a href="/liquidations/">تصفيات اللونغ</a> هو إشارة كلاسيكية للنفور من المخاطرة.</p>',id:'<p><strong>Peringkat chain</strong> menunjukkan di mana modal DeFi berada — Ethereum lama memegang porsi terbesar, sementara chain smart-contract lain bersaing memperebutkan sisanya. <strong>Peringkat protokol</strong> mendaftar aplikasi dengan nilai terbesar (biasanya liquid-staking, pinjaman, dan DEX mendominasi); kolom perubahan 1 dan 7 hari menunjukkan momentum. Amati pergerakan besar bersamaan: TVL meninggalkan sebuah chain sementara <a href="/funding/">funding perp</a>-nya berbalik negatif dan <a href="/liquidations/">likuidasi long</a> melonjak adalah sinyal risk-off klasik.</p>'}],
  ['<h2>Stablecoins — the plumbing of DeFi</h2>', {de:'<h2>Stablecoins — das Rückgrat von DeFi</h2>',es:'<h2>Stablecoins — la fontanería de DeFi</h2>',pt:'<h2>Stablecoins — o encanamento do DeFi</h2>',fr:'<h2>Stablecoins — la plomberie de la DeFi</h2>',nl:'<h2>Stablecoins — het leidingwerk van DeFi</h2>',ru:'<h2>Стейблкоины — основа DeFi</h2>',tr:'<h2>Stablecoin\'ler — DeFi\'nin altyapısı</h2>',zh:'<h2>稳定币 — DeFi 的管道</h2>',ja:'<h2>ステーブルコイン — DeFiの配管</h2>',ko:'<h2>스테이블코인 — DeFi의 배관</h2>',ar:'<h2>العملات المستقرة — البنية التحتية لـ DeFi</h2>',id:'<h2>Stablecoin — saluran pipa DeFi</h2>'}],
  ['<p>Stablecoins are the settlement layer of crypto. Total stablecoin supply tracks how much "dry powder" is sitting on-chain ready to deploy — a growing supply is broadly bullish for liquidity, a shrinking one signals capital leaving the system. The list above ranks the largest stablecoins by circulating supply and shows each one\'s peg mechanism (fiat-backed, crypto-backed or algorithmic).</p>', {de:'<p>Stablecoins sind die Abwicklungsschicht von Krypto. Die gesamte Stablecoin-Versorgung zeigt, wie viel "trockenes Pulver" einsatzbereit on-chain liegt — eine wachsende Versorgung ist grundsätzlich bullisch für die Liquidität, eine schrumpfende signalisiert abfließendes Kapital. Die obige Liste sortiert die größten Stablecoins nach Umlaufversorgung und zeigt jeweils den Peg-Mechanismus (fiat-besichert, krypto-besichert oder algorithmisch).</p>',es:'<p>Las stablecoins son la capa de liquidación de las criptomonedas. La oferta total de stablecoins refleja cuánta "pólvora seca" hay on-chain lista para desplegar — una oferta creciente es ampliamente alcista para la liquidez, una decreciente señala capital saliendo del sistema. La lista de arriba ordena las mayores stablecoins por oferta en circulación y muestra el mecanismo de paridad de cada una (respaldada por fiat, por cripto o algorítmica).</p>',pt:'<p>As stablecoins são a camada de liquidação das criptos. A oferta total de stablecoins reflete quanta "pólvora seca" está on-chain pronta para uso — uma oferta crescente é amplamente otimista para a liquidez, uma decrescente sinaliza capital saindo do sistema. A lista acima ordena as maiores stablecoins por oferta em circulação e mostra o mecanismo de paridade de cada uma (lastreada em fiat, em cripto ou algorítmica).</p>',fr:'<p>Les stablecoins sont la couche de règlement de la crypto. L\'offre totale de stablecoins indique combien de "poudre sèche" est prête à être déployée on-chain — une offre croissante est globalement haussière pour la liquidité, une offre en baisse signale des capitaux qui quittent le système. La liste ci-dessus classe les plus grands stablecoins par offre en circulation et montre le mécanisme d\'ancrage de chacun (adossé au fiat, à la crypto ou algorithmique).</p>',nl:'<p>Stablecoins zijn de afwikkelingslaag van crypto. De totale stablecoin-voorraad toont hoeveel "droog kruit" on-chain klaarstaat — een groeiende voorraad is breed bullish voor liquiditeit, een krimpende duidt op kapitaal dat het systeem verlaat. De lijst hierboven rangschikt de grootste stablecoins op circulerende voorraad en toont van elk het peg-mechanisme (fiat-gedekt, crypto-gedekt of algoritmisch).</p>',ru:'<p>Стейблкоины — это расчётный слой криптовалют. Общий объём стейблкоинов показывает, сколько «сухого пороха» лежит on-chain в готовности к вводу — растущий объём в целом позитивен для ликвидности, сокращающийся сигнализирует об уходе капитала из системы. Список выше ранжирует крупнейшие стейблкоины по объёму в обращении и показывает механизм привязки каждого (обеспечение фиатом, криптой или алгоритмическое).</p>',tr:'<p>Stablecoin\'ler kriptonun mutabakat katmanıdır. Toplam stablecoin arzı, zincir üzerinde kullanıma hazır ne kadar "kuru barut" durduğunu izler — büyüyen arz likidite için genel olarak yükseliş yönlüdür, küçülen ise sermayenin sistemden çıktığına işaret eder. Yukarıdaki liste en büyük stablecoin\'leri dolaşımdaki arza göre sıralar ve her birinin sabitleme mekanizmasını gösterir (fiat destekli, kripto destekli veya algoritmik).</p>',zh:'<p>稳定币是加密世界的结算层。稳定币总供应量反映链上有多少随时可部署的"干火药"——供应增长总体对流动性利好，收缩则意味着资金离开系统。上方列表按流通供应量为最大的稳定币排名，并显示每一种的锚定机制（法币抵押、加密抵押或算法）。</p>',ja:'<p>ステーブルコインは暗号資産の決済レイヤーです。ステーブルコイン総供給量は、展開可能な"待機資金"がオンチェーンにどれだけあるかを示します — 供給の増加は概して流動性にとって強気、減少は資本がシステムから出ていく兆候です。上のリストは最大級のステーブルコインを流通供給量で並べ、それぞれのペッグ方式（法定通貨担保・暗号資産担保・アルゴリズム）を示します。</p>',ko:'<p>스테이블코인은 암호화폐의 결제 레이어입니다. 총 스테이블코인 공급량은 온체인에 배치 대기 중인 "마른 화약"이 얼마나 있는지 보여줍니다 — 공급 증가는 대체로 유동성에 강세, 감소는 자본이 시스템을 떠난다는 신호입니다. 위 목록은 최대 스테이블코인을 유통 공급량 기준으로 정렬하고 각각의 페그 방식(법정화폐 담보·암호화폐 담보·알고리즘)을 보여줍니다.</p>',ar:'<p>العملات المستقرة هي طبقة التسوية في الكريبتو. يتتبّع إجمالي معروض العملات المستقرة حجم "البارود الجاف" الجاهز للنشر على السلسلة — المعروض المتنامي صعودي عموماً للسيولة، والمتقلص يشير إلى خروج رأس المال من النظام. تُرتّب القائمة أعلاه أكبر العملات المستقرة حسب المعروض المتداول وتُظهر آلية الربط لكلٍّ منها (مدعومة بالعملات الورقية أو بالكريبتو أو خوارزمية).</p>',id:'<p>Stablecoin adalah lapisan penyelesaian kripto. Total pasokan stablecoin melacak berapa banyak "amunisi kering" yang siap dipakai on-chain — pasokan yang tumbuh umumnya bullish untuk likuiditas, yang menyusut menandakan modal keluar dari sistem. Daftar di atas mengurutkan stablecoin terbesar berdasarkan pasokan beredar dan menunjukkan mekanisme peg masing-masing (didukung fiat, kripto, atau algoritmik).</p>'}],
  ['DeFi data aggregated from DefiLlama. For information only — not financial advice.', {de:'DeFi-Daten aggregiert von DefiLlama. Nur zur Information — keine Finanzberatung.',es:'Datos DeFi agregados de DefiLlama. Solo informativo — no es asesoramiento financiero.',pt:'Dados DeFi agregados da DefiLlama. Apenas informativo — não é aconselhamento financeiro.',fr:'Données DeFi agrégées depuis DefiLlama. À titre informatif uniquement — pas un conseil financier.',nl:'DeFi-data geaggregeerd van DefiLlama. Alleen ter informatie — geen financieel advies.',ru:'Данные DeFi агрегированы с DefiLlama. Только для информации — не финансовый совет.',tr:'DeFi verileri DefiLlama\'dan derlenmiştir. Yalnızca bilgi amaçlıdır — finansal tavsiye değildir.',zh:'DeFi 数据汇总自 DefiLlama。仅供参考 — 非投资建议。',ja:'DeFiデータはDefiLlamaから集計。情報提供のみ — 投資助言ではありません。',ko:'DeFi 데이터는 DefiLlama에서 집계. 정보 제공용 — 투자 자문 아님.',ar:'بيانات DeFi مُجمَّعة من DefiLlama. لأغراض المعلومات فقط — ليست نصيحة مالية.',id:'Data DeFi diagregasi dari DefiLlama. Hanya untuk informasi — bukan nasihat keuangan.'}],
  ['<div class="crumb"><a href="/">Home</a> / DeFi</div>', {de:'<div class="crumb"><a href="/de/">Start</a> / DeFi</div>',es:'<div class="crumb"><a href="/es/">Inicio</a> / DeFi</div>',pt:'<div class="crumb"><a href="/pt/">Início</a> / DeFi</div>',fr:'<div class="crumb"><a href="/fr/">Accueil</a> / DeFi</div>',nl:'<div class="crumb"><a href="/nl/">Home</a> / DeFi</div>',ru:'<div class="crumb"><a href="/ru/">Главная</a> / DeFi</div>',tr:'<div class="crumb"><a href="/tr/">Ana Sayfa</a> / DeFi</div>',zh:'<div class="crumb"><a href="/zh/">首页</a> / DeFi</div>',ja:'<div class="crumb"><a href="/ja/">ホーム</a> / DeFi</div>',ko:'<div class="crumb"><a href="/ko/">홈</a> / DeFi</div>',ar:'<div class="crumb"><a href="/ar/">الرئيسية</a> / DeFi</div>',id:'<div class="crumb"><a href="/id/">Beranda</a> / DeFi</div>'}],
  // nav + footer link labels (text only; hrefs stay → English pages still exist)
  ['>Markets</a>', {de:'>Märkte</a>',es:'>Mercados</a>',pt:'>Mercados</a>',fr:'>Marchés</a>',nl:'>Markten</a>',ru:'>Рынки</a>',tr:'>Piyasalar</a>',zh:'>行情</a>',ja:'>マーケット</a>',ko:'>마켓</a>',ar:'>الأسواق</a>',id:'>Pasar</a>'}],
  ['>Liquidations</a>', {de:'>Liquidationen</a>',es:'>Liquidaciones</a>',pt:'>Liquidações</a>',fr:'>Liquidations</a>',nl:'>Liquidaties</a>',ru:'>Ликвидации</a>',tr:'>Likidasyonlar</a>',zh:'>爆仓</a>',ja:'>清算</a>',ko:'>청산</a>',ar:'>التصفيات</a>',id:'>Likuidasi</a>'}],
  ['>Funding</a>', {de:'>Funding</a>',es:'>Funding</a>',pt:'>Funding</a>',fr:'>Funding</a>',nl:'>Funding</a>',ru:'>Фандинг</a>',tr:'>Funding</a>',zh:'>资金费率</a>',ja:'>資金調達率</a>',ko:'>펀딩</a>',ar:'>التمويل</a>',id:'>Funding</a>'}],
  ["'across '+d.chainCount+' chains'", {de:"'über '+d.chainCount+' Chains'",es:"'en '+d.chainCount+' cadenas'",pt:"'em '+d.chainCount+' chains'",fr:"'sur '+d.chainCount+' chaînes'",nl:"'over '+d.chainCount+' chains'",ru:"'по '+d.chainCount+' сетям'",tr:"d.chainCount+' zincirde'",zh:"d.chainCount+' 条公链'",ja:"d.chainCount+' チェーン'",ko:"d.chainCount+'개 체인'",ar:"d.chainCount+' شبكة'",id:"d.chainCount+' chain'"}]
];

for (const L of LANGS) {
  let t = html;
  // meta
  t = t.split(title).join(META[L].t);
  t = t.split(desc).join(META[L].d);
  t = t.split(kw).join(META[L].k);
  // html lang + dir
  t = t.replace('<html lang="en">', RTL.includes(L) ? `<html lang="${L}" dir="rtl">` : `<html lang="${L}">`);
  // canonical + og:url → /<lang>/defi/
  t = t.split('https://marginpad.io/defi/').join(`https://marginpad.io/${L}/defi/`);
  // hreflang after canonical
  t = t.replace(`<link rel="canonical" href="https://marginpad.io/${L}/defi/" />`, `<link rel="canonical" href="https://marginpad.io/${L}/defi/" />\n${HREFLANG}`);
  // content phrases
  for (const [en, m] of PH) { if (m[L]) t = t.split(en).join(m[L]); }
  const dir = path.join(__dirname, '..', 'dist', L, 'defi');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), t);
}
console.log('wrote', LANGS.length, 'translated /<lang>/defi/ pages');

// add hreflang to the English page too (idempotent)
if (html.indexOf('hreflang="x-default"') === -1) {
  html = html.replace('<link rel="canonical" href="https://marginpad.io/defi/" />', '<link rel="canonical" href="https://marginpad.io/defi/" />\n' + HREFLANG);
}

fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('wrote dist/defi/index.html');

// sitemap
try {
  const smp = path.join(__dirname, '..', 'dist', 'sitemap.xml');
  let sm = fs.readFileSync(smp, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  if (sm.indexOf(url) === -1) {
    sm = sm.replace('</urlset>', `  <url><loc>${url}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>\n</urlset>`);
    fs.writeFileSync(smp, sm);
    console.log('sitemap: +/defi/');
  }
} catch (e) { console.log('sitemap update skipped:', e.message); }
