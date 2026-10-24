#!/usr/bin/env node
/* ONE WAITING MARK FOR THE WHOLE SITE (2026-10-24, owner: "Ovu istu animaciju mozes da napravis za AI dok se
   ceka na crtez i mozda jos negde gde se potencijalno nesto ceka").

   The Demo Spot splash earned its logo-and-bar mark the same day; this makes that mark a HELPER every surface can
   use instead of a second copy of the idea per bundle.

   WHAT IT REPLACES, and both were worse than they looked:
     - the desktop Ask AI bubble painted `.aitype`, three dots driven by a CSS @keyframes (`aitb` in home.css) -
       and the owner's Windows has animation effects OFF, so for him the assistant's whole thinking time was
       THREE STATIC DOTS. The house rule has said WAAPI-only since 2026-09-13; this one predates it.
     - the phone Ask AI sheet painted the literal character "…". Not an animation at all.
     - the Demo Spot terminal printed the words "Loading chart…" and "Loading…" while it waited.

   WHY mp-auth.js: it is the one bundle on every page (the same exception mpToast / mpOrders / mpEx / mpTradeCard
   live under). Four surfaces needing a waiting mark is exactly the case that otherwise becomes four copies.

   WHY THE SPLASH KEEPS ITS OWN COPY: `#spotBoot` must paint on the FIRST FRAME, before a deferred bundle has
   parsed. That duplication is deliberate and this comment is the mapping - a change to the look belongs in both.

   The API is markup-first on purpose, so a surface that paints with innerHTML needs no handle:
     window.mpWaitHtml(label, opts)  -> the markup   (opts: {row:true} = the compact in-line form)
     window.mpWaitArm(root)          -> starts the motion on any unarmed mark inside root
     window.mpWait(host, opts)       -> fills host and returns {el, say(label), stop()}
   A MutationObserver arms anything added later, so markup written straight into a page works with no call at all.

   Idempotent, --dry. */
'use strict';
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const R = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(R, p), 'utf8');
const write = (p, s) => { if (DRY) return; fs.writeFileSync(path.join(R, p) + '.tmp', s); fs.renameSync(path.join(R, p) + '.tmp', path.join(R, p)); };
const done = [];

function one(hay, needle, what, n) {
  const c = hay.split(needle).length - 1;
  if (c !== (n || 1)) throw new Error('anchor "' + what + '": expected ' + (n || 1) + ', found ' + c);
}

/* ---------------- 1. the helper, at the tail of mp-auth.js ---------------- */
{
  const P = 'dist/assets/mp-auth.js';
  let s = read(P);
  if (s.indexOf('window.mpWaitHtml') >= 0) { console.log('mp-auth.js: already carries mpWait'); }
  else {
    const BLOCK = [
      '',
      '/* THE WAITING MARK (2026-10-24) - the app icon over a sliding bar, the same mark the Demo Spot splash shows.',
      '   Every motion here is WAAPI: the owner\'s Windows renders no @keyframes, and a waiting indicator that does',
      '   not move is worse than none - it reads as a page that has stopped. See build/add-wait-mark.js. */',
      '(function () {',
      '  if (window.mpWaitHtml) return;',
      '  var ICON = \'/assets/app-icon-192.png\';',
      '  var css = \'.mpwait{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px 8px}\'',
      '    + \'.mpwait.row{flex-direction:row;gap:9px;padding:4px 0}\'',
      '    + \'.mpwait img{display:block;width:44px;height:44px;border-radius:12px;flex:0 0 auto}\'',
      '    + \'.mpwait.row img{width:20px;height:20px;border-radius:6px}\'',
      '    + \'.mpwait-b{position:relative;width:120px;height:3px;border-radius:3px;background:rgba(255,255,255,.10);overflow:hidden;flex:0 0 auto}\'',
      '    + \'.mpwait.row .mpwait-b{width:56px;height:2px}\'',
      '    + \'.mpwait-b i{position:absolute;left:0;top:0;display:block;width:38%;height:100%;border-radius:3px;background:#c2f64a}\'',
      '    + \'.mpwait-t{font:600 10.5px/1.35 "Space Mono",ui-monospace,monospace;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.50);text-align:center}\';',
      '  try { var st = document.createElement(\'style\'); st.id = \'mpwait-css\'; st.textContent = css; document.head.appendChild(st); } catch (e) {}',
      '',
      '  function esc(x) { return String(x == null ? \'\' : x).replace(/[&<>"]/g, function (c) { return { \'&\': \'&amp;\', \'<\': \'&lt;\', \'>\': \'&gt;\', \'"\': \'&quot;\' }[c]; }); }',
      '  window.mpWaitHtml = function (label, opts) {',
      '    opts = opts || {};',
      '    return \'<div class="mpwait\' + (opts.row ? \' row\' : \'\') + \'" role="status" aria-live="polite">\'',
      '      + \'<img src="\' + ICON + \'" width="44" height="44" alt="" aria-hidden="true">\'',
      '      + \'<span class="mpwait-b"><i></i></span>\'',
      '      + (label ? \'<span class="mpwait-t">\' + esc(label) + \'</span>\' : \'\') + \'</div>\';',
      '  };',
      '  /* arming is separate from rendering so a surface can paint the markup with innerHTML and never hold a handle */',
      '  function arm(el) {',
      '    if (!el || el._mpw || !el.animate) return;',
      '    el._mpw = [];',
      '    try {',
      '      var img = el.querySelector(\'img\'), bar = el.querySelector(\'.mpwait-b i\');',
      '      if (img) el._mpw.push(img.animate([{ opacity: .50, transform: \'scale(.93)\' }, { opacity: 1, transform: \'scale(1)\' }, { opacity: .50, transform: \'scale(.93)\' }],',
      '        { duration: 1500, iterations: Infinity, easing: \'ease-in-out\' }));',
      '      if (bar) el._mpw.push(bar.animate([{ transform: \'translateX(-110%)\' }, { transform: \'translateX(270%)\' }],',
      '        { duration: 1150, iterations: Infinity, easing: \'cubic-bezier(.45,0,.25,1)\' }));',
      '    } catch (e) {}',
      '  }',
      '  window.mpWaitArm = function (root) {',
      '    try {',
      '      var r = root || document;',
      '      if (r.classList && r.classList.contains(\'mpwait\')) arm(r);',
      '      var n = r.querySelectorAll ? r.querySelectorAll(\'.mpwait\') : [];',
      '      for (var i = 0; i < n.length; i++) arm(n[i]);',
      '    } catch (e) {}',
      '  };',
      '  window.mpWait = function (host, opts) {',
      '    opts = opts || {};',
      '    var box = document.createElement(\'div\');',
      '    box.innerHTML = window.mpWaitHtml(opts.label, opts);',
      '    var el = box.firstChild;',
      '    if (host && host.appendChild) { if (opts.replace !== false) host.innerHTML = \'\'; host.appendChild(el); }',
      '    arm(el);',
      '    return {',
      '      el: el,',
      '      say: function (t) { var s2 = el.querySelector(\'.mpwait-t\'); if (!s2 && t) { s2 = document.createElement(\'span\'); s2.className = \'mpwait-t\'; el.appendChild(s2); } if (s2) s2.textContent = t || \'\'; },',
      '      stop: function () { var a = el._mpw || []; for (var i = 0; i < a.length; i++) { try { a[i].cancel(); } catch (e) {} } el._mpw = null; if (el.parentNode) el.parentNode.removeChild(el); }',
      '    };',
      '  };',
      '  /* anything painted later - a bubble, a page\'s own markup - arms itself */',
      '  try {',
      '    new MutationObserver(function (ms) {',
      '      for (var i = 0; i < ms.length; i++) { var a = ms[i].addedNodes;',
      '        for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1) window.mpWaitArm(a[j]); }',
      '    }).observe(document.documentElement, { childList: true, subtree: true });',
      '  } catch (e) {}',
      '  window.mpWaitArm(document);',
      '})();',
      ''
    ].join('\n');
    s = s + BLOCK;
    write(P, s);
    done.push('mp-auth.js: window.mpWaitHtml / mpWaitArm / mpWait');
  }
}

/* ---------------- 2. the desktop Ask AI bubble ---------------- */
{
  const P = 'dist/assets/mp-charts.js';
  let s = read(P);
  const OLD = "'<span class=\"aitype\"><i></i><i></i><i></i></span>'";
  const NEW = "(window.mpWaitHtml?window.mpWaitHtml(aiT('aiStReading','stReading','Reading the chart')):'<span class=\"aitype\"><i></i><i></i><i></i></span>')";
  if (s.indexOf('window.mpWaitHtml') >= 0) console.log('mp-charts.js: already on the wait mark');
  else {
    one(s, OLD, 'the desktop typing dots');
    s = s.split(OLD).join(NEW);
    write(P, s);
    done.push('mp-charts.js: the Ask AI bubble waits on the logo mark');
  }
}

/* ---------------- 3. the phone Ask AI sheet (two places: a new run, and a run re-attached on reopen) ---------------- */
{
  const P = 'dist/assets/mp-mcharts.js';
  let s = read(P);
  if (s.indexOf('window.mpWaitHtml') >= 0) console.log('mp-mcharts.js: already on the wait mark');
  else {
    const O1 = "bub.className='mfc-ai-msg ai streaming';bub.textContent='…';";
    const N1 = "bub.className='mfc-ai-msg ai streaming';if(window.mpWaitHtml)bub.innerHTML=window.mpWaitHtml(__esT_mpmcharts(\"stReading\",'Reading the chart'));else bub.textContent='…';";
    one(s, O1, 'the phone bubble on a new run');
    s = s.split(O1).join(N1);
    const O2 = ":'…';msgs.appendChild(rb);";
    const N2 = ":(window.mpWaitHtml?window.mpWaitHtml(__esT_mpmcharts(\"stReading\",'Reading the chart')):'…');msgs.appendChild(rb);";
    one(s, O2, 'the phone bubble on reopen');
    s = s.split(O2).join(N2);
    write(P, s);
    done.push('mp-mcharts.js: both Ask AI waiting bubbles');
  }
}

/* ---------------- 4. the Demo Spot terminal, where two waits were plain words ---------------- */
{
  const P = 'dist/spot/index.html';
  let s = read(P);
  if (s.indexOf('mpwait') >= 0) console.log('dist/spot/index.html: already on the wait mark');
  else {
    /* THE i18n KEY STAYS ON THE ELEMENT. `data-t` is what applyStatic() rewrites when another language's pack
       lands, so the text has to remain a child of that node - the mark goes BESIDE it, inside the same box. */
    const O1 = '<div id="list" class="rows"><div class="empty" data-t="y_loading">Loading…</div></div>';
    const N1 = '<div id="list" class="rows"><div class="empty mpw-empty"><span class="mpw-slot" data-mpwait="row"></span><span data-t="y_loading">Loading…</span></div></div>';
    one(s, O1, 'the market list loading row');
    s = s.split(O1).join(N1);
    const O2 = '<div class="chart" id="chart"><div class="empty" id="chartMsg" data-t="ch_loading">Loading chart…</div></div>';
    const N2 = '<div class="chart" id="chart"><div class="empty mpw-empty col" id="chartMsg"><span class="mpw-slot" data-mpwait="1"></span><span data-t="ch_loading">Loading chart…</span></div></div>';
    one(s, O2, 'the chart loading box');
    s = s.split(O2).join(N2);

    /* the slots are filled once mp-auth has parsed (it is deferred); until then the words alone are shown, which
       is exactly what the page did before - a mark that never arrives must not leave an empty box behind */
    const BOOT = '<script>(function(){function fill(){if(!window.mpWaitHtml)return false;'
      + 'var n=document.querySelectorAll(\'.mpw-slot:empty\');for(var i=0;i<n.length;i++){'
      + 'n[i].innerHTML=window.mpWaitHtml(\'\',{row:n[i].getAttribute(\'data-mpwait\')===\'row\'});}return true;}'
      + 'if(!fill()){var t=0,iv=setInterval(function(){if(fill()||++t>40)clearInterval(iv);},150);'
      + 'window.addEventListener(\'load\',fill);}})();</script>';
    const CSS = '<style>.mpw-empty{display:flex;align-items:center;justify-content:center;gap:9px}'
      + '.mpw-empty.col{flex-direction:column;gap:6px}.mpw-empty .mpwait{padding:0}</style>';
    const AT = '</body>';
    one(s, AT, 'the page close', (s.split(AT).length - 1));
    const i = s.lastIndexOf(AT);
    s = s.slice(0, i) + CSS + BOOT + '\n' + s.slice(i);
    write(P, s);
    done.push('dist/spot/index.html: the market list and the chart wait on the mark');
  }
}

console.log(done.length ? done.map(function (d) { return '  ' + d; }).join('\n') : '  nothing to do');
if (DRY) console.log('add-wait-mark: --dry, nothing written');
else console.log('add-wait-mark: done. NEXT: node build/gen-spot-i18n.js && node build/bump-home-assets.js && npm run deploy');
