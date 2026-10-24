/* THE PAPER TRADE TERMINAL, REBUILT (2026-10-24, owner).
 *
 *   node build/fix-pt-terminal.js [--dry]
 *
 * Idempotent, and it REFUSES rather than guessing: every anchor must match exactly once in app/index.html (CRLF),
 * dist/assets/home.css and dist/assets/home.js, or nothing is written at all.
 *
 * Nothing here reimplements the trading engine. The markup keeps every id the engine binds to - #planSym,
 * #planClass, #ptTf's premium-gated buttons, .ptt-es, #planAdvChk, #planRzSlip/#planRzTier/#planRzSt,
 * #planSlOpt/#planTpOpt - and only the chrome around them changes. The select markup and the whole timeframe
 * menu are LIFTED out of the file and put back verbatim, never retyped.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.indexOf('--dry') >= 0;
const P = {
  app: path.join(ROOT, 'app', 'index.html'),
  css: path.join(ROOT, 'dist', 'assets', 'home.css'),
  js: path.join(ROOT, 'dist', 'assets', 'home.js'),
  cssIn: path.join(__dirname, 'pt-terminal.css.txt'),
  jsIn: path.join(__dirname, 'pt-terminal.js.txt'),
};
const read = f => fs.readFileSync(f, 'utf8');
const changed = [];
function die(m) { console.error('REFUSED: ' + m); process.exit(1); }
function rep(s, from, to, what) { const n = s.split(from).length - 1; if (n !== 1) die(what + ' - expected 1 occurrence, found ' + n); return s.split(from).join(to); }
function one(s, re, what) { const m = s.match(re); if (!m) die(what + ' - no match'); const g = s.match(new RegExp(re.source, re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g')); if (g.length !== 1) die(what + ' - expected 1 match, found ' + g.length); return m[0]; }
/* a block we own, replaced whole on a re-run - never appended twice */
function blockSwap(src, begin, end, body) {
  const i = src.indexOf(begin), k = src.indexOf(end);
  if (i >= 0 && k > i) return src.slice(0, i) + begin + body + end + src.slice(k + end.length);
  if (i >= 0 || k >= 0) die('a half-written block is in the file (' + begin.slice(0, 40) + ') - fix it by hand');
  return src.replace(/\s*$/, '\n') + begin + body + end + '\n';
}

/* ═════════════════════════════ 1. app/index.html ═════════════════════════════ */
function doApp() {
  let h = read(P.app);
  const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n'; // CRLF file: a marker built from a bare \n matches nothing
  if (h.indexOf('id="ptSymBtn"') >= 0) { console.log('  app/index.html: already rebuilt, left alone'); return null; }

  // ---- 1a. the chart: a head, the candles, a strip - no window around any of it ------------------------------
  const a = h.indexOf('<div class="ptt-chart">'), b = h.indexOf('<div class="ptt-recent"');
  if (a < 0 || b < 0 || b < a) die('could not find the chart block');
  const block = h.slice(a, b);
  const grab = (re, what) => { const m = block.match(re); if (!m) die('could not lift ' + what); return m[0]; };
  const selClass = grab(/<select id="planClass"[\s\S]*?<\/select>/, 'the asset-class select');
  const selSym = grab(/<select id="planSym"[\s\S]*?<\/select>/, 'the symbol select');
  const tfMenu = grab(/<div class="ptt-tf" id="ptTf"[\s\S]*?<\/div>\r?\n/, 'the timeframe menu').replace(/\r?\n$/, '');
  const esCtl = grab(/<div class="ptt-es"[\s\S]*?<\/button>\r?\n\s*<\/div>/, 'the entry-style control');
  const I = N + '          ';
  const chev = '<svg class="ptc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const gear = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.9 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H4a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 5.3 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1z"/></svg>';
  const chart =
    '<div class="ptt-chart">' + I +
    '<div class="ptc-head">' + I +
    '  <button type="button" class="ptc-sym" id="ptSymBtn" aria-haspopup="dialog" aria-expanded="false">' + I +
    '    <span class="ptc-ic" id="ptSymIc"></span>' + I +
    '    <span class="ptc-sn"><span class="ptc-pair"><b id="ptSymTxt">BTC</b><span class="ptc-quote">USD</span>' + chev + '</span><span class="ptc-cd" id="ptCd"></span></span>' + I +
    '  </button>' + I +
    '</div>' + I +
    '<div id="ptChart"></div>' + I +
    '<div class="ptc-bar">' + I +
    '  <div class="ptc-tfs" id="ptTfs" role="group" aria-label="Timeframe"></div>' + I +
    '  <div class="ptt-tfwrap">' + I +
    '    <button type="button" class="ptc-ib ptc-more" id="ptTfBtn" aria-haspopup="menu" aria-expanded="false" aria-label="More timeframes"><span class="ptc-dots">&#183;&#183;&#183;</span><span id="ptTfCur">5m</span></button>' + I +
    '    ' + tfMenu + I +
    '  </div>' + I +
    '  <span class="ptc-sp"></span>' + I +
    '  <button type="button" class="ptc-ib" id="ptChSet" aria-expanded="false" aria-label="Chart settings">' + gear + '</button>' + I +
    '</div>' + I +
    '<div class="ptc-pop-bd" id="ptChPopBd" hidden></div>' + I +
    '<div class="ptc-pop" id="ptChPop" hidden></div>' + I +
    '<div class="ptc-keep" aria-hidden="true">' + selClass + selSym + esCtl + '</div>' + N + '        ' +
    '</div>' + N + '        ';
  h = h.slice(0, a) + chart + h.slice(b);

  // ---- 1b. the market picker: its own window, fixed, so no card can clip it ----------------------------------
  const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  const SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>';
  const picker = N + '      <div class="ptmk" id="ptMkt" hidden role="dialog" aria-modal="true" aria-label="Choose a market">'
    + N + '        <div class="ptmk-bd" data-mkx></div>'
    + N + '        <div class="ptmk-p">'
    + N + '          <div class="ptmk-h"><div class="ptmk-t" data-i18n="mkTitle">Choose a market</div><button type="button" class="ptmk-x" data-mkx aria-label="Close">' + X + '</button></div>'
    + N + '          <div class="ptmk-s">' + SEARCH + '<input id="ptMkQ" type="text" autocomplete="off" spellcheck="false" placeholder="Search a coin, a company, a pair&#8230;" aria-label="Search markets"></div>'
    + N + '          <div class="ptmk-tabs" id="ptMkTabs"></div>'
    + N + '          <div class="ptmk-list" id="ptMkList"></div>'
    + N + '          <div class="ptmk-f" id="ptMkFoot"></div>'
    + N + '        </div>'
    + N + '      </div>';
  h = rep(h, '<div id="ptBronze" class="pt-bronze" hidden></div>', '<div id="ptBronze" class="pt-bronze" hidden></div>' + picker, 'the end of the trade panel');

  // ---- 1c. the order type joins the price row ---------------------------------------------------------------
  const typeBlk = one(h, /<div class="pt2-otype" id="planType"[\s\S]*?<\/div>/, 'the order-type control');
  h = h.replace(typeBlk, '');
  const pxRow = one(h, /<div class="pt2-top">[\s\S]*?<\/div>\r?\n\s*<\/div>/, 'the live-price row');
  h = h.replace(pxRow, pxRow.replace(/(<\/div>)(\r?\n\s*<\/div>)$/, '$1' + N + '              ' + typeBlk + '$2'));

  // ---- 1d. Advanced becomes a disclosure button -------------------------------------------------------------
  h = rep(h, '<div class="lev-row">', '<div class="lev-row pt-advrow">', 'the leverage row');
  h = rep(h, '<label class="adv-toggle"><input type="checkbox" id="planAdvChk"><span>Advanced</span></label>',
    '<label class="adv-toggle ptc-keep"><input type="checkbox" id="planAdvChk"><span>Advanced</span></label>'
    + '<button type="button" class="pt-adv-b" id="ptAdvBtn" aria-expanded="false" aria-controls="planAdvIn">'
    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>'
    + '<span data-i18n="advBtn">Advanced</span>'
    + '<svg class="pt-adv-c" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>',
    'the Advanced checkbox');

  // ---- 1e. realistic fills: two real switches, each saying what it does --------------------------------------
  const rzBlk = one(h, /<div class="field" id="planRzField">[\s\S]*?<\/p><\/div>/, 'the realistic-fills field');
  const rzHint = (rzBlk.match(/<p class="plan-hint" id="planRzHint"[\s\S]*?<\/p>/) || [''])[0];
  if (!rzHint) die('could not lift the realistic-fills explanation');
  h = h.replace(rzBlk, '<div class="field" id="planRzField"><div class="fl-row"><label data-i18n="lRealFills">Realistic fills</label>'
    + '<button type="button" class="ptt-q" data-hint="planRzHint" aria-expanded="false" aria-label="What do realistic fills change?">?</button></div>'
    + '<div class="rz-card">'
    + '<label class="rz-it"><input type="checkbox" id="planRzSlip"><span class="rz-k"></span><span class="rz-tx"><b data-i18n="rzSlipT">Slippage</b><small data-i18n="rzSlipD">Your fill moves against you the way walking a real order book does - 0.01% on the majors, more on thinner markets.</small></span></label>'
    + '<label class="rz-it"><input type="checkbox" id="planRzTier"><span class="rz-k"></span><span class="rz-tx"><b data-i18n="rzTierT">Margin tiers</b><small data-i18n="rzTierD">A bigger position needs more maintenance margin, exactly as an exchange risk-limit table asks - so it liquidates sooner.</small></span></label>'
    + '<div class="rz-foot"><span class="rz-dot"></span><span class="rz-st" id="planRzSt"></span></div>'
    + '</div>' + rzHint + '</div>');

  // ---- 1f. stop-loss / take-profit: a price AND the percent of margin it costs -------------------------------
  const xBox = (k, lab, chips, hint, hk) => {
    const C = k === 'sl' ? 'Sl' : 'Tp';
    return '<div class="ptx ' + k + '" data-k="' + k + '">'
      + '<div class="ptx-h"><label for="plan' + C + 'Opt" data-i18n="' + (k === 'sl' ? 'lStopOpt' : 'lTpOpt') + '">' + lab + '</label>'
      + '<button type="button" class="ptx-clr" hidden data-i18n="xClear">Clear</button></div>'
      + '<div class="ptx-row">'
      + '<div class="input-line"><input type="number" id="plan' + C + 'Opt" step="any" inputmode="decimal" placeholder="price"><span class="unit">USD</span></div>'
      + '<div class="ptx-pct"><input type="number" id="plan' + C + 'Pct" step="any" min="0" inputmode="decimal" placeholder="' + (k === 'sl' ? '&#8722;' : '+') + '%" aria-label="' + lab + ' as a percent of margin"><span class="u">%</span></div>'
      + '</div>'
      + '<div class="ptx-q">' + chips.map(p => '<button type="button" data-xp="' + p + '">' + (k === 'sl' ? '&#8722;' : '+') + p + '%</button>').join('') + '</div>'
      + '<div class="ptx-hint" data-i18n="' + hk + '">' + hint + '</div>'
      + '<div class="plan-risk" id="planRisk' + C + '" hidden></div></div>';
  };
  h = rep(h, '<div class="field"><label data-i18n="lStopOpt">Stop-loss (optional)</label><div class="input-line"><input type="number" id="planSlOpt" step="any" placeholder="-"><span class="unit">USD</span></div><div class="plan-risk" id="planRiskSl" hidden></div></div>',
    xBox('sl', 'Stop-loss', [10, 25, 50, 75], 'The percent is of your margin, not of the price - at 20x a 1% move against you is 20%.', 'xHintSl'), 'the stop-loss field');
  h = rep(h, '<div class="field"><label data-i18n="lTpOpt">Take-profit (optional)</label><div class="input-line"><input type="number" id="planTpOpt" step="any" placeholder="-"><span class="unit">USD</span></div><div class="plan-risk" id="planRiskTp" hidden></div></div>',
    xBox('tp', 'Take-profit', [25, 50, 100, 200], 'Type a price, or the profit you are aiming for as a percent of your margin.', 'xHintTp'), 'the take-profit field');

  // ---- 1g. trailing stop + break-even read as one pair -------------------------------------------------------
  const trBlk = one(h, /<div class="field"><label data-i18n="lTrail">[\s\S]*?id="planBE"[\s\S]*?<\/div><\/div>/, 'the trailing-stop / break-even pair');
  h = h.replace(trBlk, '<div class="pt-pair2">' + trBlk.replace(/\r?\n\s+/g, '') + '</div>');

  // ---- 1h. Long / Short get the direction drawn, not only named ---------------------------------------------
  const ar = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (d === 'up' ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M19 12l-7 7-7-7') + '"/></svg>';
  h = rep(h, '<button class="on" data-side="long" type="button"><span data-i18n="long">Long</span></button>',
    '<button class="on" data-side="long" type="button">' + ar('up') + '<span data-i18n="long">Long</span></button>', 'the Long button');
  h = rep(h, '<button data-side="short" type="button"><span data-i18n="short">Short</span></button>',
    '<button data-side="short" type="button">' + ar('dn') + '<span data-i18n="short">Short</span></button>', 'the Short button');

  changed.push('app/index.html');
  return h;
}

/* ═════════════════════════════ 2. dist/assets/home.css ═════════════════════════════ */
function doCss() {
  const c = read(P.css);
  const body = read(P.cssIn)
    .split('.rz-foot.on .rz-dot{').join('.rz-foot:has(.rz-st.on) .rz-dot{')
    .split('.rz-foot.on{').join('.rz-foot:has(.rz-st.on){')
    + '\n/* the guest note mp-auth inserts beside the (now hidden) Advanced label keeps a line of its own */\n'
    + '.pt-advrow{flex-wrap:wrap}\n.pt-advrow #advGateNote{flex:1 0 100%;margin-left:0!important;order:9}\n';
  const out = blockSwap(c, '/* >>> MP-PT-TERMINAL >>> */', '/* <<< MP-PT-TERMINAL <<< */', body);
  if (out !== c) changed.push('dist/assets/home.css');
  return out;
}

/* ═════════════════════════════ 3. dist/assets/home.js ═════════════════════════════ */
function doJs() {
  let j = read(P.js);

  // ---- 3a. the countdown goes under the symbol, in its own slot ---------------------------------------------
  if (j.indexOf("var _slot=document.getElementById('ptCd')") < 0) {
    j = rep(j, "function tickCd(){var host=document.getElementById('ptChart');if(!host||!chart||!bars||!bars.length){if(_cdEl)_cdEl.textContent='';return;}",
      "function tickCd(){var host=document.getElementById('ptChart');var _slot=document.getElementById('ptCd');if(_slot)_cdEl=_slot;/* 2026-10-24: the candle's clock is one line under the pair name, no box and no chip - the old floating pill is only built when that slot is absent */if(!host||!chart||!bars||!bars.length){if(_cdEl)_cdEl.textContent='';return;}",
      'the countdown head');
    j = rep(j, "    if(_cdEl.parentNode!==host)host.appendChild(_cdEl); // chart rebuilds can drop the node - re-attach",
      "    if(_cdEl!==_slot&&_cdEl.parentNode!==host)host.appendChild(_cdEl); // chart rebuilds can drop the node - re-attach (but never move the in-flow slot)",
      'the countdown re-attach');
    j = rep(j, "    _cdEl.textContent=__esT_home(\"closeIn\",'close in ')+(h?h+'h '+m+'m':(m?m+'m '+(ss<10?'0':'')+ss+'s':ss+'s'));}",
      "    _cdEl.textContent=__esT_home(\"closeIn\",'close in ')+(h?h+'h '+m+'m':(m?m+'m '+(ss<10?'0':'')+ss+'s':ss+'s'));if(_slot)_slot.classList.toggle('soon',s<=10);}",
      'the countdown text');
  }

  // ---- 3b. what Advanced hides does not apply ---------------------------------------------------------------
  if (j.indexOf("_advOn?num('planSlOpt')") < 0) {
    j = rep(j, "    var sl=num('planSlOpt'), tp=num('planTpOpt'), trail=num('planTrail'), be=num('planBE');",
      "    /* ADVANCED CLOSED = NO STOP (2026-10-24, owner: \"kad otvorim advanced i ako nisam birao nista od sl ili\n"
      + "       tp i kad zatvorim advanced i pokusam da otvorim poziciju po market orderu, ne mogu jer su sl i tp\n"
      + "       parametri lose podeseni a ja uopste nisam imao interakciju sa njima\"). Opening Advanced PREFILLS a\n"
      + "       stop 2% away and a target 3% away; closing it left those two numbers in inputs nobody could see any\n"
      + "       more and this line read them anyway - so a 2% move, or a flip to Short, refused the open with a\n"
      + "       message about a field that was not on screen. Reproduced on the live page: live 79401.10, the hidden\n"
      + "       fields still holding 77844.14 / 81815.78. What the panel hides does not apply; the typed values stay\n"
      + "       for the next time it is opened. */\n"
      + "    var _adv=document.getElementById('planAdvChk'),_advOn=!!(_adv&&_adv.checked&&!_adv.disabled);\n"
      + "    var sl=_advOn?num('planSlOpt'):NaN, tp=_advOn?num('planTpOpt'):NaN, trail=_advOn?num('planTrail'):NaN, be=_advOn?num('planBE'):NaN;",
      'the stop / target read in add()');
  }

  // ---- 3c. an auto-filled level is a suggestion, and is re-derived when the side flips -----------------------
  if (j.indexOf("__mpPtAuto.mark('sl',1)") < 0) {
    j = rep(j,
      "      if(entry>0&&sl&&!(parseFloat(sl.value)>0))sl.value=String(+(entry*(lng?0.98:1.02)).toFixed(dp));\n      if(entry>0&&tp&&!(parseFloat(tp.value)>0))tp.value=String(+(entry*(lng?1.03:0.97)).toFixed(dp));",
      "      if(entry>0&&sl&&!(parseFloat(sl.value)>0)){sl.value=String(+(entry*(lng?0.98:1.02)).toFixed(dp));try{window.__mpPtAuto&&window.__mpPtAuto.mark('sl',1);}catch(_e){}}\n"
      + "      if(entry>0&&tp&&!(parseFloat(tp.value)>0)){tp.value=String(+(entry*(lng?1.03:0.97)).toFixed(dp));try{window.__mpPtAuto&&window.__mpPtAuto.mark('tp',1);}catch(_e){}}\n"
      + "      try{if(window.__mpPtAuto){window.__mpPtAuto.paint('sl');window.__mpPtAuto.paint('tp');}}catch(_e){}",
      'the Advanced prefill');
  }

  // ---- 3d. the venue's own mark, not the first letter of its name --------------------------------------------
  if (j.indexOf('EXLOGO') < 0) {
    const deco = one(j, /    function exDeco\(o\)\{[\s\S]*?<\/span>';\}/, 'exDeco');
    j = j.replace(deco,
      "    /* SELF-HOSTED LOGOS (2026-10-24, owner: \"te ikonice tu takodje treba da se update sa pravim logom\n"
      + "       menjacnice kao i nas logo\"). The marks live in dist/assets/ex/ beside the ones the sign-up venues\n"
      + "       already use - a CDN that goes dark must not blank the picker. A venue with no file keeps the old\n"
      + "       brand-coloured monogram, so adding one is a FILE, never a code change. */\n"
      + "    var EXLOGO={Binance:'binance',Bybit:'bybit',OKX:'okx',Bitget:'bitget',KuCoin:'kucoin',Gate:'gate',Kraken:'kraken',MEXC:'mexc',Hyperliquid:'hyperliquid',Coinbase:'coinbase',BingX:'bingx'};\n"
      + "    function exDeco(o){var t=o.textContent||'',m=t.split('-'),name=(m[0]||t).trim(),rate=(m[1]||'').trim();\n"
      + "      if(!rate&&/custom/i.test(name))return __esT_home(\"customTypeYourOwn\",'<span class=\"csel-ex\"><i class=\"cx-m cx-custom\">%</i><b>Custom</b><small>type your own rate</small></span>');\n"
      + "      var c=EXCOL[name]||['#3a4450','#e9e7df'],k=EXLOGO[name],mark;\n"
      + "      if(name==='MarginPad')mark='<i class=\"cx-m cx-mp\"><img src=\"/assets/app-icon-192.png\" alt=\"\" width=\"22\" height=\"22\" loading=\"lazy\"></i>';\n"
      + "      else if(k)mark='<i class=\"cx-m\"><img src=\"/assets/ex/'+k+'.png\" alt=\"\" width=\"22\" height=\"22\" loading=\"lazy\" data-x=\"'+name.charAt(0)+'\" data-c=\"'+c[0]+'\" data-f=\"'+c[1]+'\" onerror=\"window.__mpExLogoErr&&window.__mpExLogoErr(this)\"></i>';\n"
      + "      else mark='<i class=\"cx-m\" style=\"background:'+c[0]+';color:'+c[1]+'\">'+name.charAt(0)+'</i>';\n"
      + "      return '<span class=\"csel-ex\">'+mark+'<b>'+name+'</b>'+(rate?'<small>'+rate+'</small>':'')+'</span>';}\n"
      + "    window.__mpExLogoErr=function(img){var p=img.parentNode;if(!p)return;p.style.background=img.getAttribute('data-c')||'#3a4450';p.style.color=img.getAttribute('data-f')||'#e9e7df';p.style.padding='0';p.textContent=img.getAttribute('data-x')||'?';};");
  }

  // ---- 3e. a dropdown a thumb can actually close -------------------------------------------------------------
  if (j.indexOf('csel-sheet') < 0) {
    j = rep(j, "    function open(){ build(); panel.hidden=false; trig.classList.add('open'); if(floating){place();window.addEventListener('scroll',place,true);window.addEventListener('resize',place);} document.addEventListener('touchmove',onTouchMove,{passive:false}); if(search){search.value='';filter('');setTimeout(function(){search.focus();},20);} var s=list.querySelector('.csel-opt.sel'); if(s)s.scrollIntoView({block:'nearest'}); }",
      "    /* A COARSE POINTER GETS A SHEET WITH A BACKDROP AND AN X (2026-10-24, owner: \"kad otvaram ove padajuce\n"
      + "       menije da izaberem exchange, zabaguju i ne mogu da se zatvore\"). The only way out was a tap on the\n"
      + "       document, and a document click is exactly what iOS does not reliably report for a tap on a\n"
      + "       non-interactive area - so on a phone the panel could stand there with nothing to press. A backdrop\n"
      + "       and a close button are real elements with real handlers; they cannot go missing. */\n"
      + "    var coarse=function(){try{return !!(window.matchMedia&&window.matchMedia('(pointer:coarse)').matches);}catch(e){return false;}};\n"
      + "    var bd=null,_home=null,_openAt=0;\n"
      + "    function sheetOn(){ if(!coarse())return;\n"
      + "      panel.classList.add('csel-sheet');\n"
      + "      if(!panel.querySelector('.csel-sh-h')){var hd=document.createElement('div');hd.className='csel-sh-h';\n"
      + "        hd.innerHTML='<b></b><button type=\"button\" class=\"csel-sh-x\" aria-label=\"Close\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"><path d=\"M18 6L6 18M6 6l12 12\"/></svg></button>';\n"
      + "        /* the title a reader already saw above the control beats the aria-label, which is written for a\n"
      + "           screen reader (\"Exchange maintenance-margin preset\") rather than for a sheet header */\n"
      + "        var _fl=sel.closest&&sel.closest('.field')&&sel.closest('.field').querySelector('label');\n"
      + "        hd.querySelector('b').textContent=((_fl&&_fl.textContent||'').trim()||sel.getAttribute('aria-label')||'Choose');\n"
      + "        hd.querySelector('.csel-sh-x').addEventListener('click',function(e){e.stopPropagation();close();});\n"
      + "        panel.insertBefore(hd,panel.firstChild);}\n"
      + "      if(!bd){bd=document.createElement('div');bd.className='csel-sheet-bd';bd.hidden=true;bd.addEventListener('click',function(){if(Date.now()-_openAt>320)close();});document.body.appendChild(bd);}\n"
      + "      /* THE BACKDROP MUST NOT SWALLOW THE GESTURE THAT RAISED IT: pointerdown opens the sheet and lays the\n"
      + "         backdrop under the finger, and the CLICK of that same tap then landed on it and shut the sheet again -\n"
      + "         measured on a 390px touch viewport, three taps in a row, never open. Nothing in the sheet takes a\n"
      + "         pointer until the gesture that opened it is over. */\n"
      + "      bd.hidden=false;_openAt=Date.now();bd.style.pointerEvents='none';panel.style.pointerEvents='none';\n"
      + "      setTimeout(function(){bd.style.pointerEvents='';panel.style.pointerEvents='';},320);\n"
      + "      /* THE PANEL IS NOT MOVED TO <body>. position:fixed already escapes the scrolling column it sits in,\n"
      + "         and relocating the node broke every caller that looks the panel up through its own .csel wrapper -\n"
      + "         feevenue-e2e threw on a null, and so did two measurement probes of mine before I read why. */ }\n"
      + "    function sheetOff(){ panel.classList.remove('csel-sheet'); if(bd)bd.hidden=true; }\n"
      + "    function open(){ build(); panel.hidden=false; trig.classList.add('open'); trig.setAttribute('aria-expanded','true'); sheetOn(); if(floating&&!panel.classList.contains('csel-sheet')){place();window.addEventListener('scroll',place,true);window.addEventListener('resize',place);} document.addEventListener('touchmove',onTouchMove,{passive:false}); if(search&&!coarse()){search.value='';filter('');setTimeout(function(){search.focus();},20);} var s=list.querySelector('.csel-opt.sel'); if(s)s.scrollIntoView({block:'nearest'}); }",
      'the dropdown open()');
    j = rep(j, "    function close(){ panel.hidden=true; trig.classList.remove('open'); if(floating){window.removeEventListener('scroll',place,true);window.removeEventListener('resize',place);} document.removeEventListener('touchmove',onTouchMove,{passive:false}); }",
      "    function close(){ panel.hidden=true; trig.classList.remove('open'); trig.setAttribute('aria-expanded','false'); sheetOff(); if(floating){window.removeEventListener('scroll',place,true);window.removeEventListener('resize',place);} document.removeEventListener('touchmove',onTouchMove,{passive:false}); }",
      'the dropdown close()');
    j = rep(j, "    trig.addEventListener('click',function(e){ e.stopPropagation(); if(panel.hidden){open();}else{close();} });",
      "    /* ONE ACTIVATION PER TAP. The toggle ran on `click`, and a tap that produces two of them (the iOS ghost\n"
      + "       click after touchend is the classic one) reads exactly as the owner described it - \"kad kliknem isto\n"
      + "       sto sam kliknuo da je otvorim, kao da je refresuje\": closed and reopened inside one tap. It is driven\n"
      + "       from pointerdown now and the click that follows the same gesture is swallowed. */\n"
      + "    var _tDown=0;\n"
      + "    trig.addEventListener('pointerdown',function(e){ if(e.button&&e.button!==0)return; e.preventDefault(); e.stopPropagation(); _tDown=Date.now(); if(panel.hidden){open();}else{close();} });\n"
      + "    trig.addEventListener('click',function(e){ e.stopPropagation(); e.preventDefault(); if(Date.now()-_tDown<700)return; if(panel.hidden){open();}else{close();} });",
      'the dropdown trigger');
  }

  // ---- 3f. a joined minus / plus, never two stacked glyph triangles -------------------------------------------
  if (j.indexOf('mp-step-minus') < 0) {
    const sv = d => '<svg viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2.6\\" stroke-linecap=\\"round\\" aria-hidden=\\"true\\"><path d=\\"' + d + '\\"/></svg>';
    const old = one(j, /    var st=document\.createElement\('div'\);st\.className='stepper';[\s\S]*?\n    \}\);/, 'the value stepper');
    j = j.replace(old,
      "    /* A GLYPH ARROW RENDERS AS AN EMOJI ON A PHONE (the same reason the replay transport is drawn as SVG),\n"
      + "       and a 14px-tall stacked pair is under every tap-target guideline there is. One joined minus/plus pill,\n"
      + "       31x28 each, with press-and-hold acceleration. (2026-10-24, owner: \"strelice za amount ili leverage kao\n"
      + "       i za bilo sta ostalo mi se ne svidjaju i mislim da dizajnerski mozemo mnogo bolje da odradimo\") */\n"
      + "    var st=document.createElement('div');st.className='stepper';\n"
      + "    st.innerHTML='<button type=\"button\" class=\"mp-step-minus\" data-d=\"-1\" tabindex=\"-1\" aria-label=\"Decrease\">" + sv('M5 12h14') + "</button>'\n"
      + "      +'<button type=\"button\" data-d=\"1\" tabindex=\"-1\" aria-label=\"Increase\">" + sv('M12 5v14M5 12h14') + "</button>';\n"
      + "    line.appendChild(st);line.classList.add('has-stepper');\n"
      + "    (function(){\n"
      + "      function bump(dir){var v=parseFloat(inp.value);if(!isFinite(v))v=0;var nv=v+dir*smartStep(v);if(nv<0)nv=0;nv=Math.round(nv*1e6)/1e6;inp.value=nv;inp.dispatchEvent(new Event('input',{bubbles:true}));}\n"
      + "      var _hold=null,_rep=null;\n"
      + "      function stop(){if(_hold){clearTimeout(_hold);_hold=null;}if(_rep){clearInterval(_rep);_rep=null;}}\n"
      + "      st.addEventListener('pointerdown',function(e){var b=e.target.closest('button');if(!b)return;e.preventDefault();\n"
      + "        var dir=+b.getAttribute('data-d');bump(dir);stop();\n"
      + "        _hold=setTimeout(function(){_rep=setInterval(function(){bump(dir);},70);},420);\n"
      + "        try{b.setPointerCapture&&b.setPointerCapture(e.pointerId);}catch(_){}});\n"
      + "      ['pointerup','pointercancel','pointerleave'].forEach(function(ev){st.addEventListener(ev,stop);});\n"
      + "      window.addEventListener('blur',stop);\n"
      + "      st.addEventListener('click',function(e){e.preventDefault();});\n"
      + "    })();");
  }

  // ---- 3j. the quick-pair rail gets a face for a stock too ---------------------------------------------------
  /* The rail drew a LETTER monogram for every non-crypto symbol, a rule written in August when nothing resolved a
     stock's logo. /api/coinicon has known stocks, metals and oil since 2026-10-05, and the new market picker uses
     it - so AAPL sat as four letters in the rail beside its own logo in the picker. Forex and indices keep their
     drawn glyphs (no logo exists for them anywhere); everything else goes through the resolver. */
  if (j.indexOf('var isImg=!ic&&!NONCRYPTO[s]') >= 0) {
    j = rep(j, 'var isImg=!ic&&!NONCRYPTO[s];', 'var isImg=!ic; /* 2026-10-24: only FX/indices are drawn; stocks and metals resolve like a coin */', 'the recents rail icon rule');
  }

  // ---- 3i. six Bybit stock perps were being treated as coins ------------------------------------------------
  /* Found by LOOKING at the new picker: SNDK (SanDisk) and SOXL were listed under Crypto. They are the Bybit
     stock perps the icon resolver has known about since 2026-10-05 (ICON_STOCK_EXTRA in the worker) and they had
     never reached home.js's own STK table - so mpAssetClass called them crypto, which also charged them the
     0.055% crypto taker fee instead of the 0.02% stock one. The market-closed guard is unaffected: it only ever
     fires on a state a price poller reported, and these are priced by Bybit, which reports none. */
  if (j.indexOf('SNDK:1') < 0) {
    j = rep(j, 'var STK={NOW:1,', 'var STK={SNDK:1,MU:1,KLAC:1,CRCL:1,SOXL:1,SOXS:1,NOW:1,', 'the stock table');
    j = rep(j, "window.mpMarketName=function(s){return ({NOW:'ServiceNow',",
      "window.mpMarketName=function(s){return ({SNDK:'SanDisk',MU:'Micron',KLAC:'KLA',CRCL:'Circle',SOXL:'Semiconductors 3x',SOXS:'Semiconductors -3x',NOW:'ServiceNow',",
      'the market-name table');
  }

  // ---- 3g. the Spanish the new copy needs -------------------------------------------------------------------
  const ES = {
    chooseAMarket: 'Elige un mercado', mkFav: 'Favoritos', mkCrypto: 'Cripto', mkStocks: 'Acciones', mkForex: 'Forex',
    mkMetals: 'Metales', mkIndices: 'Índices', mkNoFav: 'Aún no hay favoritos: toca la estrella junto a un mercado para fijarlo aquí.',
    mkNone: 'Nada coincide con eso.', mkPin: 'Añadir a favoritos', mkUnpin: 'Quitar de favoritos',
    mkShowing: 'Mostrando los primeros ', mkOf: ' de ', mkNarrow: 'escribe para acotar.', mkMarkets: 'mercados', mkByVol: 'los más activos primero',
    chStyle: 'Estilo del gráfico', chEntries: 'Tus entradas', chCandles: 'Velas', chHollow: 'Huecas', chHeikin: 'Heikin',
    chBars: 'Barras', chLine: 'Línea', chArea: 'Área', chAsLines: 'Líneas', chAsDots: 'Puntos',
    xNeedPrice: 'Esperando el precio en vivo: inténtalo de nuevo en un segundo.'
  };
  let add = '';
  Object.keys(ES).forEach(k => { if (j.indexOf('"' + k + '":') < 0) add += ',"' + k + '":' + JSON.stringify(ES[k]); });
  if (add) j = rep(j, '"dayStreak2":"-días de racha</b><small>"};', '"dayStreak2":"-días de racha</b><small>"' + add + '};', 'the Spanish dictionary');

  // ---- 3h. the shell --------------------------------------------------------------------------------------
  j = blockSwap(j, '\n;/* >>> MP-PT-SHELL >>> */', '\n/* <<< MP-PT-SHELL <<< */', read(P.jsIn));
  changed.push('dist/assets/home.js');
  return j;
}

/* ═════════════════════════════ run ═════════════════════════════ */
const outApp = doApp(), outCss = doCss(), outJs = doJs();
if (DRY) { console.log('DRY RUN - would write: ' + (changed.join(', ') || 'nothing')); process.exit(0); }
if (outApp != null) fs.writeFileSync(P.app, outApp);
fs.writeFileSync(P.css, outCss);
fs.writeFileSync(P.js, outJs);
console.log('wrote: ' + (changed.join(', ') || 'nothing'));
