#!/usr/bin/env node
/* THE HEATMAP'S TOP IS ONE COMPACT ROW, THE PAIR IS A PILL, THE WINDOW IS CHIPS (2026-11-12, owner: "padajuci meni i
   sam box za pair je jako glomazan bez razloga ... nepotrebno iskoriscen prostor ... da izgleda da smo se posvetili").
   MEASURED BEFORE (1366x768, Premium): masthead 44px + bar 25px + margins = the stage started at y=268 and got 424px;
   on a 390 phone two NATIVE <select>s of 170x31 each plus a 272px segment made a 68px bar. Now:
     - .hm-top wraps the masthead and the bar; from 1100px the masthead is display:contents, so title+LIVE, the controls
       and the price/stats share ONE row, sticky at the top of the page while the reader scrolls the terminal below.
     - the coin <select> and the window <select> stay in the DOM (hidden: they are still the ONE control path - the
       suite, S.setCoin and every keyboard user drive them) and are DRIVEN by a coin PILL (logo + symbol + name, opening
       a menu that says what each coin liquidated in 24 h and how it split) and six WINDOW CHIPS.
     - a first-visit hint sits over the bottom of the map (one sentence, Got it, remembered per device) and the title
       carries a ? that says what the page is - the long tagline is hidden on the one-row layout.
     - jump links (Order flow / Book over time / Market pulse) in the bar on a desktop and as a chip row under the
       targets on a phone: the page is six screens and nothing said what was below.
   Idempotent, --dry. Refuses rather than guessing when an anchor is not exactly once in the file.
   KEPT FOR THE RECORD: after this ran, the bundle took further edits directly (the bundle is the source): the section is
   the one frame on a desktop (#heatmap.hm-full padding, .hm-wrap borderless), keyboard shortcuts ([ ] A L S C 0), the price
   flash through WAAPI, scrollbar-gutter instead of overflow-y:scroll (sticky), swept bands coloured by measured dollars
   and bands older than the window fading in from the edge - see the commit of 2026-11-12. Re-running this on a fresh
   pre-11-12 bundle gives the first cut only. */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'assets', 'mp-heatmap.js');
let h = fs.readFileSync(F, 'utf8');
const done = [];
function one(name, a, b, skipIf) {
  if (h.indexOf(skipIf) >= 0) return;
  const n = h.split(a).length - 1;
  if (n !== 1) throw new Error(name + ': anchor appears ' + n + ' times');
  h = h.split(a).join(b); done.push(name);
}

// 1. CSS - appended as its own statement so every later rule wins over the base ones on equal specificity.
one('css',
  "  function el(t, c, h) { var e = document.createElement(t);",
  "  CSS += '.hm-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin:0 -14px 9px;padding:9px 14px 8px;border-bottom:1px solid #1c2230;background:#0c0f15}' +\n" +
  "    '@media(min-width:981px){.hm-top{position:sticky;top:0;z-index:8;box-shadow:0 10px 24px -18px rgba(0,0,0,.9)}}' +\n" +
  "    '.hm-top .hm-mast{margin:0;flex:1 1 auto;gap:12px;align-items:center}.hm-top .hm-bar{margin:0;flex:0 1 auto}.hm-top .hm-bar-b{margin-left:0}' +\n" +
  "    '.hm-top .hm-mast-t{display:flex;align-items:center;gap:6px}' +\n" +
  "    '.hm-top .hm-mast-b{margin-top:2px}' +\n" +
  "    '@media(min-width:1100px){.hm-top .hm-mast{display:contents}.hm-top .hm-mast-l{order:0;flex:0 0 auto}.hm-top .hm-bar{order:1;flex:0 1 auto}.hm-top .hm-mast-r{order:2;flex:0 0 auto;margin-left:auto}.hm-top .hm-mast-s{display:none}.hm-top .hm-mast-r .hm-px{font-size:17px}.hm-top .hm-mast-r .hm-stats{font-size:10.5px}}' +\n" +
  "    '.hm-sel.hm-sel-x{position:absolute!important;width:1px!important;height:1px!important;min-width:0!important;padding:0!important;margin:0!important;border:0!important;opacity:0;pointer-events:none;overflow:hidden;flex:none!important}' +\n" +
  "    '.hm-bar-a{position:relative;flex-wrap:nowrap}' +\n" +
  "    '.hm-coin{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 9px 0 6px;border:1px solid #232b3a;border-radius:9px;background:#12161d;color:#fff;font:700 12.5px \"Space Mono\",monospace;cursor:pointer;white-space:nowrap;flex:none;transition:border-color .15s,background .15s}' +\n" +
  "    '.hm-coin:hover,.hm-coin[aria-expanded=\"true\"]{border-color:#3a465c;background:#161c25}.hm-coin:focus-visible{outline:none;border-color:#c2f64a}' +\n" +
  "    '.hm-coin-i{width:18px;height:18px;border-radius:50%;background:#1c2230;flex:none}' +\n" +
  "    '.hm-coin-n{font:11px \"Familjen Grotesk\",system-ui,sans-serif;color:#7c8aa2;font-weight:500}' +\n" +
  "    '.hm-coin svg{width:10px;height:10px;color:#8fa3c4;flex:none}' +\n" +
  "    '.hm-wins{display:flex;align-items:center;gap:2px;height:28px;padding:2px;border:1px solid #232b3a;border-radius:9px;background:#12161d;flex:none}' +\n" +
  "    '.hm-wins button{height:22px;padding:0 8px;border:0;border-radius:6px;background:none;color:#8fa3c4;font:700 11.5px \"Space Mono\",monospace;cursor:pointer;letter-spacing:.02em}' +\n" +
  "    '.hm-wins button:hover{color:#dbe4f5;background:rgba(255,255,255,.05)}.hm-wins button.on{background:#1a2413;color:#c2f64a}' +\n" +
  "    '.hm-seg,.hm-btn{height:28px}.hm-seg{border-radius:9px}.hm-btn{width:28px;border-radius:9px}' +\n" +
  "    '.hm-cm{position:absolute;left:0;top:calc(100% + 6px);z-index:30;width:min(340px,calc(100vw - 24px));max-height:min(62vh,440px);overflow-y:auto;overscroll-behavior:contain;padding:6px;border:1px solid #2a3547;border-radius:12px;background:rgba(12,15,21,.98);box-shadow:0 18px 50px rgba(0,0,0,.65);backdrop-filter:blur(6px)}' +\n" +
  "    '.hm-cm-h{display:grid;grid-template-columns:1fr auto;gap:8px;padding:4px 8px 6px;font:9.5px \"Space Mono\",monospace;letter-spacing:.1em;color:#5c6b84;text-transform:uppercase}' +\n" +
  "    '.hm-cm-r{display:grid;grid-template-columns:22px 1fr auto;grid-template-rows:auto auto;column-gap:9px;align-items:center;width:100%;padding:6px 8px;border:0;border-radius:8px;background:none;color:#dbe4f5;text-align:left;cursor:pointer;font-family:inherit}' +\n" +
  "    '.hm-cm-r:hover,.hm-cm-r.k{background:rgba(255,255,255,.06)}.hm-cm-r.on{background:rgba(194,246,74,.09)}.hm-cm-r.on .hm-cm-s{color:#c2f64a}' +\n" +
  "    '.hm-cm-r img{grid-row:1/3;width:22px;height:22px;border-radius:50%;background:#1c2230}' +\n" +
  "    '.hm-cm-s{font:700 12.5px \"Space Mono\",monospace;color:#fff}.hm-cm-s small{margin-left:6px;font:11px \"Familjen Grotesk\",system-ui,sans-serif;color:#7c8aa2;font-weight:500}' +\n" +
  "    '.hm-cm-v{font:700 11.5px \"Space Mono\",monospace;color:#c9d4e6;text-align:right;white-space:nowrap}.hm-cm-v small{display:block;font:10px \"Space Mono\",monospace;color:#5c6b84;font-weight:400;margin-top:1px}' +\n" +
  "    '.hm-cm-b{grid-column:2/4;height:3px;margin-top:4px;border-radius:2px;background:#2a1512;overflow:hidden}.hm-cm-b i{display:block;height:100%;background:#2ebd85;border-radius:2px}' +\n" +
  "    '.hm-cm-f{padding:6px 8px 3px;font:10px/1.45 \"Familjen Grotesk\",system-ui,sans-serif;color:#5c6b84}' +\n" +
  "    '.hm-jump{display:none;align-items:center;gap:2px;margin-right:4px}@media(min-width:1300px){.hm-jump{display:inline-flex}.hm-jump a.mid{display:none}}@media(min-width:1480px){.hm-jump a.mid{display:inline-block}}' +\n" +
  "    '.hm-jump a{color:#7c8aa2;text-decoration:none;font:600 11px \"Familjen Grotesk\",system-ui,sans-serif;padding:4px 7px;border-radius:7px;white-space:nowrap}.hm-jump a:hover{color:#dbe4f5;background:rgba(255,255,255,.05)}' +\n" +
  "    '.hm-under{display:none}' +\n" +
  "    '.hm-hint{position:absolute;left:10px;right:118px;top:30px;z-index:5;display:flex;align-items:flex-start;gap:9px;max-width:560px;padding:8px 10px 8px 11px;border:1px solid rgba(194,246,74,.35);border-left:3px solid #c2f64a;border-radius:9px;background:rgba(10,13,17,.94);font:12px/1.5 \"Familjen Grotesk\",system-ui,sans-serif;color:#c9d4e6;box-shadow:0 10px 30px rgba(0,0,0,.5)}' +\n" +
  "    '.hm-hint b{color:#c2f64a;font:700 9.5px \"Space Mono\",monospace;letter-spacing:.12em;display:block;margin-bottom:2px}' +\n" +
  "    '.hm-hint em{font-style:normal;color:#eef3fa;font-weight:600}' +\n" +
  "    '.hm-hint button{flex:none;align-self:center;height:26px;padding:0 10px;border:1px solid rgba(194,246,74,.4);border-radius:7px;background:rgba(194,246,74,.1);color:#c2f64a;font:600 11px \"Familjen Grotesk\",system-ui,sans-serif;cursor:pointer}.hm-hint button:hover{background:rgba(194,246,74,.2)}' +\n" +
  "    '@media(max-width:980px){.hm-top{margin:0 0 6px;padding:0 0 7px;gap:6px}.hm-top .hm-mast{flex:1 1 100%;margin:0}.hm-top .hm-bar{flex:1 1 100%}.hm-bar-a,.hm-bar-b{flex:1 1 100%}.hm-wins{flex:1 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none}.hm-wins::-webkit-scrollbar{display:none}.hm-wins button{flex:1 1 0;padding:0 6px}.hm-coin{height:33px}.hm-wins,.hm-seg,.hm-btn{height:33px}.hm-wins{padding:2px}.hm-wins button{height:29px;min-width:34px}.hm-btn{width:33px}.hm-jump{display:none}' +\n" +
  "    '.hm-under{display:flex;order:4;gap:6px;overflow-x:auto;scrollbar-width:none;padding:7px 2px 3px;font:600 11px \"Familjen Grotesk\",system-ui,sans-serif}.hm-under::-webkit-scrollbar{display:none}.hm-under b{flex:none;align-self:center;font:700 9.5px \"Space Mono\",monospace;letter-spacing:.1em;color:#5c6b84}.hm-under a{flex:none;padding:5px 10px;border:1px solid #232b3a;border-radius:999px;background:#12161d;color:#c9d4e6;text-decoration:none;white-space:nowrap}' +\n" +
  "    '.hm-hint{left:8px;right:8px;top:28px;max-width:none;font-size:11.5px;padding:7px 9px}}';\n" +
  "  function el(t, c, h) { var e = document.createElement(t);",
  ".hm-top{display:flex");

// 2. the hidden selects and their visible controls
one('controls',
  "    barA.appendChild(selC); barA.appendChild(selW);\n",
  "    selC.className += ' hm-sel-x'; selC.setAttribute('aria-label', 'Coin'); selC.tabIndex = -1;\n" +
  "    selW.className += ' hm-sel-x'; selW.setAttribute('aria-label', 'Time window'); selW.tabIndex = -1;\n" +
  "    var coinBtn = el('button', 'hm-coin'); coinBtn.type = 'button'; coinBtn.setAttribute('aria-haspopup', 'listbox'); coinBtn.setAttribute('aria-expanded', 'false');\n" +
  "    var winsEl = el('div', 'hm-wins'); winsEl.setAttribute('role', 'group'); winsEl.setAttribute('aria-label', 'Time window');\n" +
  "    barA.appendChild(selC); barA.appendChild(selW); barA.appendChild(coinBtn); barA.appendChild(winsEl);\n" +
  "    var jump = el('span', 'hm-jump'); jump.innerHTML = '<a href=\"#hm-flow\" data-j=\".hm-bk\">' + __esT_mpheatmap('jumpFlow', 'Order flow') + '</a><a href=\"#hm-film\" class=\"mid\" data-j=\".hm-bm\">' + __esT_mpheatmap('jumpFilm', 'Book over time') + '</a><a href=\"#hm-pulse\" data-j=\".hm-mkt\">' + __esT_mpheatmap('jumpPulse', 'Market pulse') + '</a>';\n",
  "hm-sel-x'; selC.setAttribute");

one('bar order', "    barB.appendChild(seg); barB.appendChild(dl); barB.appendChild(sh);\n", "    barB.appendChild(seg); barB.appendChild(jump); barB.appendChild(dl); barB.appendChild(sh);\n", "barB.appendChild(jump)");

// 3. the title's ? and the HELP entry behind it
one('title help',
  "<div class=\"hm-mast-l\"><div class=\"hm-mast-t\">LIQUIDATION HEATMAP</div>",
  "<div class=\"hm-mast-l\"><div class=\"hm-mast-t\">LIQUIDATION HEATMAP' + q('what') + '</div>",
  "LIQUIDATION HEATMAP' + q('what')");
one('help entry',
  "    targets: ['Targets', ",
  "    what: [__esT_mpheatmap('whatPageT', 'What this page is'), __esT_mpheatmap('whatPageB', 'Real liquidations from eight exchanges, drawn the second they happen. The bright horizontal bands are the prices where crowds of leveraged positions would be force-closed - price tends to get pulled toward the brightest ones and a band disappears once price trades through it. Under the map: the live order book and trade tape for the same coin, the book over time, and the whole market\\'s liquidations.')],\n" +
  "    targets: ['Targets', ",
  "what: [__esT_mpheatmap('whatPageT'");

// 4. the top wrapper and the phone jump row
one('top wrapper',
  "    wrap.appendChild(mast); wrap.appendChild(bar); wrap.appendChild(tgEl); wrap.appendChild(stage);",
  "    var top = el('div', 'hm-top'); top.appendChild(mast); top.appendChild(bar);\n" +
  "    var under = el('div', 'hm-under'); under.innerHTML = '<b>' + __esT_mpheatmap('jumpTo', 'JUMP TO') + '</b>' + jump.innerHTML;\n" +
  "    wrap.appendChild(top); wrap.appendChild(tgEl); wrap.appendChild(under); wrap.appendChild(stage);",
  "var top = el('div', 'hm-top')");

// 5. the change handlers tell the visible controls
one('coin change sync', "S.coin = selC.value; S.obs = null;", "S.coin = selC.value; if (S.syncTop) S.syncTop(); S.obs = null;", "S.coin = selC.value; if (S.syncTop)");
one('win change sync', "S.win = selW.value; S.obs = null;", "S.win = selW.value; if (S.syncTop) S.syncTop(); S.obs = null;", "S.win = selW.value; if (S.syncTop)");

// 6. the pill, the menu, the chips, the jump links and the hint
one('top wiring',
  "    selD.addEventListener('change', function () { if (!S) return; var v = +selD.value;",
  "    // ---- THE PILL, THE CHIPS, THE MENU (2026-11-12) - the two <select>s stay the one control path; these drive them.\n" +
  "    var NAMES = { BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', XRP: 'XRP', DOGE: 'Dogecoin', BNB: 'BNB', ADA: 'Cardano', LINK: 'Chainlink', AVAX: 'Avalanche', LTC: 'Litecoin' };\n" +
  "    var CARET = '<svg viewBox=\"0 0 10 6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\"><path d=\"M1 1l4 4 4-4\"/></svg>';\n" +
  "    function coinIco(c) { return '<img class=\"hm-coin-i\" alt=\"\" src=\"/api/coinicon?sym=' + encodeURIComponent(c) + '&v=2\" onerror=\"this.style.visibility=\\'hidden\\'\">'; }\n" +
  "    function winTitle(k) { for (var i = 0; i < selW.options.length; i++) if (selW.options[i].value === k) return selW.options[i].textContent; return k; }\n" +
  "    function syncCoin() { coinBtn.innerHTML = coinIco(S.coin) + '<b>' + S.coin + '</b><span class=\"hm-coin-n\">' + (NAMES[S.coin] || '') + '</span>' + CARET; coinBtn.setAttribute('aria-label', __esT_mpheatmap('coinPick', 'Coin') + ': ' + S.coin); }\n" +
  "    function syncWins() { winsEl.innerHTML = Object.keys(WINS).map(function (k) { return '<button type=\"button\" data-w=\"' + k + '\"' + (k === S.win ? ' class=\"on\" aria-pressed=\"true\"' : ' aria-pressed=\"false\"') + ' title=\"' + winTitle(k) + '\">' + k + '</button>'; }).join(''); }\n" +
  "    S.syncTop = function () { syncCoin(); syncWins(); };\n" +
  "    winsEl.addEventListener('click', function (ev) { var b = ev.target.closest('[data-w]'); if (!b || !S) return; var k = b.getAttribute('data-w'); if (k === S.win) return; selW.value = k; selW.dispatchEvent(new Event('change')); });\n" +
  "    var coinMenu = null, COINSTAT = null, coinStatAt = 0;\n" +
  "    function coinMenuClose() { if (coinMenu) { coinMenu.remove(); coinMenu = null; coinBtn.setAttribute('aria-expanded', 'false'); } }\n" +
  "    function coinRows() {\n" +
  "      var st = COINSTAT || {}, h = '<div class=\"hm-cm-h\"><span>' + __esT_mpheatmap('cmHead', 'Coin') + '</span><span>' + __esT_mpheatmap('cmHead2', 'Liquidated 24h') + '</span></div>';\n" +
  "      COINS.forEach(function (c) {\n" +
  "        var s = st[c], lp = (window.mpLivePrices && window.mpLivePrices[c] && +window.mpLivePrices[c].p > 0) ? +window.mpLivePrices[c].p : 0;\n" +
  "        var lsh = s && s.liq > 0 ? Math.round(s.long / s.liq * 100) : null;\n" +
  "        h += '<button type=\"button\" class=\"hm-cm-r' + (c === S.coin ? ' on' : '') + '\" role=\"option\" data-c=\"' + c + '\" aria-selected=\"' + (c === S.coin) + '\">' + coinIco(c)\n" +
  "          + '<span class=\"hm-cm-s\">' + c + '<small>' + (NAMES[c] || '') + '</small></span>'\n" +
  "          + '<span class=\"hm-cm-v\">' + (s && s.liq > 0 ? money(s.liq) : (COINSTAT ? '-' : '…')) + (lp ? '<small>$' + fpx(lp) + '</small>' : '') + '</span>'\n" +
  "          + (lsh !== null ? '<span class=\"hm-cm-b\" title=\"' + lsh + '% longs\"><i style=\"width:' + lsh + '%\"></i></span>' : '')\n" +
  "          + '</button>';\n" +
  "      });\n" +
  "      return h + '<div class=\"hm-cm-f\">' + __esT_mpheatmap('cmFoot', 'Green share of the bar = longs liquidated, red = shorts, our own collector, all venues. Arrow keys move, Enter picks.') + '</div>';\n" +
  "    }\n" +
  "    function coinMenuOpen() {\n" +
  "      coinMenuClose(); helpClose();\n" +
  "      coinMenu = el('div', 'hm-cm'); coinMenu.setAttribute('role', 'listbox'); coinMenu.innerHTML = coinRows();\n" +
  "      barA.appendChild(coinMenu); coinBtn.setAttribute('aria-expanded', 'true');\n" +
  "      var r = coinBtn.getBoundingClientRect(), mw = coinMenu.getBoundingClientRect().width;\n" +
  "      if (r.left + mw > innerWidth - 12) coinMenu.style.left = Math.max(12 - r.left, innerWidth - 12 - mw - r.left) + 'px';\n" +
  "      var cur = coinMenu.querySelector('.hm-cm-r.on'); if (cur) { cur.classList.add('k'); try { cur.focus({ preventScroll: true }); } catch (e) {} }\n" +
  "      if (!COINSTAT || Date.now() - coinStatAt > 120000) {\n" +
  "        fetch('/api/v1/liquidations').then(function (x) { return x.ok ? x.json() : null; }).then(function (j) {\n" +
  "          var d = (j && (j.data || j)) || {}, m = {}; (d.coins || []).forEach(function (x) { if (x && x.s) m[String(x.s).toUpperCase()] = { liq: +x.liq || 0, long: +x.long || 0, short: +x.short || 0 }; });\n" +
  "          COINSTAT = m; coinStatAt = Date.now(); if (coinMenu) { var k0 = coinMenu.querySelector('.hm-cm-r.k'), kc = k0 && k0.getAttribute('data-c'); coinMenu.innerHTML = coinRows(); var k1 = kc && coinMenu.querySelector('[data-c=\"' + kc + '\"]'); if (k1) k1.classList.add('k'); }\n" +
  "        }).catch(function () { COINSTAT = COINSTAT || {}; });\n" +
  "      }\n" +
  "    }\n" +
  "    coinBtn.addEventListener('click', function (ev) { ev.stopPropagation(); if (coinMenu) coinMenuClose(); else coinMenuOpen(); });\n" +
  "    barA.addEventListener('click', function (ev) { var b = ev.target.closest && ev.target.closest('.hm-cm-r'); if (!b || !S) return; ev.stopPropagation(); var c = b.getAttribute('data-c'); coinMenuClose(); if (c && c !== S.coin) { selC.value = c; selC.dispatchEvent(new Event('change')); } coinBtn.focus(); });\n" +
  "    document.addEventListener('click', function (ev) { if (coinMenu && !(ev.target.closest && ev.target.closest('.hm-cm'))) coinMenuClose(); });\n" +
  "    document.addEventListener('keydown', function (ev) {\n" +
  "      if (!coinMenu) return;\n" +
  "      var rows = [].slice.call(coinMenu.querySelectorAll('.hm-cm-r')), i = rows.findIndex(function (x) { return x.classList.contains('k'); });\n" +
  "      if (ev.key === 'Escape') { ev.preventDefault(); coinMenuClose(); coinBtn.focus(); }\n" +
  "      else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); var n = (i + (ev.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length; rows.forEach(function (x) { x.classList.remove('k'); }); rows[n].classList.add('k'); try { rows[n].focus({ preventScroll: true }); } catch (e) {} }\n" +
  "      else if (ev.key === 'Enter' && i >= 0) { ev.preventDefault(); rows[i].click(); }\n" +
  "    });\n" +
  "    // the jump links scroll to the block they name (the hash is cosmetic - the blocks have no ids by design)\n" +
  "    wrap.addEventListener('click', function (ev) { var a = ev.target.closest && ev.target.closest('.hm-jump a,.hm-under a'); if (!a) return; ev.preventDefault(); var t = wrap.querySelector(a.getAttribute('data-j')); if (!t) return; var y = t.getBoundingClientRect().top + scrollY - (window.innerWidth > 980 ? (top.getBoundingClientRect().height + 8) : 8); try { window.scrollTo({ top: y, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, y); } });\n" +
  "    // FIRST VISIT: one sentence over the bottom of the map, remembered per device. The long explanation is in\n" +
  "    // HOW TO READ IT below; this is the one thing a newcomer needs before the picture makes sense.\n" +
  "    var HINTK = 'mp_hm_hint1', hintSeen = false; try { hintSeen = !!localStorage.getItem(HINTK); } catch (e) {}\n" +
  "    if (!hintSeen) {\n" +
  "      var hint = el('div', 'hm-hint', '<span><b>' + __esT_mpheatmap('hintT', 'HOW TO READ THE MAP') + '</b>' + __esT_mpheatmap('hintB', 'Each bright band is a price where a crowd of leveraged traders gets liquidated - <em>price is drawn toward the brightest ones</em>. Tap a band for the numbers; the chips above the map are the nearest ones.') + '</span><button type=\"button\">' + __esT_mpheatmap('hintOk', 'Got it') + '</button>');\n" +
  "      hint.querySelector('button').addEventListener('click', function (ev) { ev.stopPropagation(); try { localStorage.setItem(HINTK, '1'); } catch (e) {} hint.remove(); });\n" +
  "      stage.appendChild(hint);\n" +
  "    }\n" +
  "    S.syncTop();\n" +
  "    selD.addEventListener('change', function () { if (!S) return; var v = +selD.value;",
  "THE PILL, THE CHIPS, THE MENU (2026-11-12)");

// 7. the stage takes the room the top gave back (desktop; the skeleton in app/index.html carries the same figures)
one('stage height', ".hm-stage{position:relative;display:flex;min-height:380px;height:calc(100vh - 344px);max-height:820px}", ".hm-stage{position:relative;display:flex;min-height:380px;height:calc(100vh - 300px);max-height:860px}", "height:calc(100vh - 300px)");

for (const must of ['hm-coin', 'hm-wins', 'hm-cm-r', 'hm-hint', 'hm-under', 'S.syncTop']) if (h.indexOf(must) < 0) throw new Error('missing ' + must);
if (DRY) { console.log('dry:', done.length ? done.join(', ') : 'nothing to do'); process.exit(0); }
if (done.length) { fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F); }
console.log(done.length ? 'applied: ' + done.join(', ') : 'already applied');
