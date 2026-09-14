// Hyperliquid partner card (2026-09-11). One self-contained, dark, mint-accented card - the 4% fee discount, the code
// MARGINPAD and the join link - injected on the pages where a Hyperliquid reader actually is: the three Hyperliquid
// pages, the liquidation pages that show its book, the exchange comparison, the Coinglass alternative. Idempotent
// (guarded on the mp-hl marker), an explicit allowlist (never a sweep over dist), and it runs from build/build.js as
// a post-processor so a regenerated page gets the card back. Referral: users get 4% off fees; nothing else is claimed.
// The card is dimmed and labelled in the US by the same window.mpEx rule every other partner card follows.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');
const HL = 'https://app.hyperliquid.xyz/join/MARGINPAD';

// path -> [eyebrow, one reason line for THIS page]
const PAGES = {
  'hyperliquid-liquidation-calculator': ['THE VENUE THIS CALCULATOR MODELS', 'These maintenance-margin and fee numbers are Hyperliquid&rsquo;s own. Open the account with our code and every trade you size here costs 4% less in fees.'],
  'hyperliquid-liquidations': ['WHERE THESE LIQUIDATIONS HAPPEN', 'Every event on this page is a real position force-closed on Hyperliquid&rsquo;s on-chain book. Trade the same book, 4% cheaper.'],
  'hyperliquid-whales': ['TRADE THE SAME BOOK AS THE WHALES', 'Every position on this page is on Hyperliquid, fully on-chain and readable by anyone - including yours, once you have one.'],
  'liquidations/by-exchange': ['THE ON-CHAIN VENUE IN THIS TABLE', 'Hyperliquid is the one exchange here whose liquidations are settled on a public chain. Same perps, no custodian, 4% off fees with our code.'],
  'liquidations': ['TRADE PERPS ON-CHAIN', 'Hyperliquid runs perps on its own chain: no custodian, sub-accounts with their own API keys, deep books on majors. 4% off fees with our code.'],
  'exchanges': ['THE DEX IN THIS COMPARISON', 'Hyperliquid is the on-chain perps exchange every centralised venue on this page is now measured against. Wallet in, trade, wallet out - and 4% off fees with our code.'],
  'coinglass-alternative': ['TRADE THE DATA ON-CHAIN', 'Our Hyperliquid liquidation feed and whale tracker read its public chain. The exchange itself is one click away, 4% cheaper with our code.'],
  'funding': ['ON-CHAIN FUNDING, HOURLY', 'Hyperliquid pays funding every hour instead of every eight, all of it on-chain. Trade it 4% cheaper with our code.'],
};
const DISC = 'Referral link - MarginPad may earn a commission if you open an account. The 4% fee discount is Hyperliquid&rsquo;s referral discount; you never pay more than you would going direct. Not available to US persons under Hyperliquid&rsquo;s terms.';

const CSS = `<style id="mp-hl-css">.mp-hl{--hl:#5ee6c8;position:relative;margin:30px 0 14px;padding:22px 24px;border-radius:18px;border:1px solid rgba(94,230,200,.32);background:radial-gradient(120% 140% at 100% 0%,rgba(94,230,200,.13),transparent 55%),linear-gradient(180deg,#0e1614,#0a0e0d);color:#e6efec;overflow:hidden;font-family:'Familjen Grotesk',system-ui,sans-serif}
.mp-hl::after{content:'HL';position:absolute;right:-8px;bottom:-34px;font:800 118px/1 'Bricolage Grotesque',sans-serif;letter-spacing:-8px;color:rgba(94,230,200,.07);pointer-events:none}
.mp-hl-e{display:inline-flex;align-items:center;gap:8px;font:700 10px/1 'Space Mono',ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--hl);margin:0 0 12px}.mp-hl-e i{width:7px;height:7px;border-radius:50%;background:var(--hl);box-shadow:0 0 9px var(--hl)}
.mp-hl-row{display:flex;align-items:center;gap:22px;flex-wrap:wrap;position:relative;z-index:1}
.mp-hl-main{flex:1 1 300px;min-width:0}.mp-hl-t{font:800 22px/1.15 'Bricolage Grotesque',sans-serif;letter-spacing:-.01em;color:#f2fbf8;margin:0 0 8px}.mp-hl-t b{color:var(--hl)}
.mp-hl-w{margin:0 0 14px;color:#a6b8b2;font-size:14px;line-height:1.6}
.mp-hl-side{flex:0 0 auto;display:flex;flex-direction:column;align-items:stretch;gap:10px;min-width:210px}
.mp-hl-off{display:flex;align-items:baseline;gap:10px;padding:12px 14px;border-radius:12px;background:rgba(94,230,200,.08);border:1px solid rgba(94,230,200,.28)}.mp-hl-off b{font:800 34px/1 'Bricolage Grotesque',sans-serif;color:var(--hl);letter-spacing:-.02em}.mp-hl-off span{font-size:12.5px;line-height:1.3;color:#cfe3dd}
.mp-hl-code{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-radius:10px;border:1px dashed rgba(94,230,200,.45);font:700 12px/1 'Space Mono',ui-monospace,monospace;color:#cfe3dd}.mp-hl-code b{color:#f2fbf8;letter-spacing:.12em}
.mp-hl-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 18px;border-radius:11px;background:var(--hl);color:#062a24;font:800 13.5px/1 'Bricolage Grotesque',sans-serif;text-decoration:none;letter-spacing:.01em}.mp-hl-cta:hover{filter:brightness(1.06)}
.mp-hl-d{position:relative;z-index:1;margin:14px 0 0;font-size:11px;line-height:1.5;color:#6f8079}
.mp-hl.mp-ex-off{opacity:.55;filter:saturate(.35)}.mp-hl .mp-ex-na{margin-top:8px}
@media(max-width:640px){.mp-hl{padding:18px 16px}.mp-hl-t{font-size:19px}.mp-hl-side{width:100%}.mp-hl-cta{width:100%}}</style>`;

function card(eyebrow, why) {
  return `<div class="mp-hl" data-ex="Hyperliquid" id="mp-hl">
<div class="mp-hl-e"><i></i>${eyebrow}</div>
<div class="mp-hl-row">
<div class="mp-hl-main"><div class="mp-hl-t">Hyperliquid - perps <b>on-chain</b>, with a fee discount from us.</div><p class="mp-hl-w">${why}</p></div>
<div class="mp-hl-side"><div class="mp-hl-off"><b>4%</b><span>off trading fees<br>for referred accounts</span></div><div class="mp-hl-code"><span>use code</span><b>MARGINPAD</b></div><a class="mp-hl-cta" href="${HL}" target="_blank" rel="sponsored noopener noreferrer" data-mpex="Hyperliquid" data-ex="Hyperliquid">Join Hyperliquid &rarr;</a></div>
</div>
<p class="mp-hl-d">${DISC}</p>
</div>
<script>(function(){function dim(c){try{var el=document.getElementById('mp-hl');if(!el||el.querySelector('.mp-ex-na'))return;el.classList.add('mp-ex-off');var s=document.createElement('span');s.className='mp-ex-na';s.textContent='not available in '+(c==='US'?'the US':'your country');el.querySelector('.mp-hl-main').appendChild(s);}catch(e){}}
/* mp-auth.js (window.mpEx) is not on every page this card lands on; when it is absent after 8 s, ask /api/geo directly (cached a day in mp_cc, the same key mpEx uses) - Hyperliquid's terms exclude US persons, so a US reader sees it dimmed either way */
function geo(cb){try{var v=JSON.parse(localStorage.getItem('mp_cc')||'null');if(v&&v.cc&&Date.now()-(+v.ts||0)<864e5){cb(v.cc);return;}}catch(e){}try{fetch('/api/geo',{credentials:'omit'}).then(function(r){return r.json();}).then(function(d){var c=(d&&d.cc)||'';try{localStorage.setItem('mp_cc',JSON.stringify({cc:c,ts:Date.now()}));}catch(e){}cb(c);}).catch(function(){});}catch(e){}}
var usGeo=function(){geo(function(c){if(String(c||'').toUpperCase()==='US')dim('US');});};
if(!document.querySelector('script[src*="mp-auth"]')){usGeo();return;} /* the bundle is not on this page at all: no point waiting for it */
var n=0,iv=setInterval(function(){if(window.mpEx&&window.mpEx.cc){clearInterval(iv);window.mpEx.cc(function(c){if(c&&window.mpEx.blocked('Hyperliquid',c))dim(c);});return;}if(++n>80){clearInterval(iv);usGeo();}},100);})();</script>`;
}

let added = 0, skipped = 0, missing = 0;
for (const rel of Object.keys(PAGES)) {
  const f = path.join(ROOT, rel, 'index.html');
  if (!fs.existsSync(f)) { missing++; continue; }
  let html = fs.readFileSync(f, 'utf8');
  if (process.argv.includes('--replace') && html.includes('id="mp-hl"')) { // re-render an existing card (copy or script changed)
    html = html.replace(/<style id="mp-hl-css">[\s\S]*?<\/style>\n?/, '').replace(/<div class="mp-hl"[\s\S]*?<\/script>\n?/, '');
  }
  if (html.includes('id="mp-hl"')) { skipped++; continue; }
  // sit right above the exchange rail when the page has one (same neighbourhood, same intent); else above the article/footer close
  let anchor = html.includes('<div class="mp-xr">') ? '<div class="mp-xr">'
    : (html.includes('</article>') ? '</article>' : (/<footer[ >]/.test(html) ? html.match(/<footer[ >]/)[0] : (/<div class="foot/.test(html) ? html.match(/<div class="foot/)[0] : null)));
  if (!anchor) { missing++; console.log('no anchor: ' + rel); continue; }
  const head = html.indexOf('</head>'); if (head < 0) { missing++; continue; }
  html = html.slice(0, head) + CSS + '\n' + html.slice(head);
  const j = html.indexOf(anchor);
  html = html.slice(0, j) + card(PAGES[rel][0], PAGES[rel][1]) + '\n' + html.slice(j);
  fs.writeFileSync(f, html); added++;
}
console.log('hyperliquid card: added ' + added + ', already there ' + skipped + ', missing/no anchor ' + missing);
