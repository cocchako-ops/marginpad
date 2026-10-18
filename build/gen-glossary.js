/* THE GLOSSARY, REBUILT (2026-10-19, owner: "zelim da dobijemo nesto jako cool i prakticno")
   ------------------------------------------------------------------------------------------------------------
   MEASURED BEFORE TOUCHING IT: 27 pageviews in 30 days, all from the US, and it does not appear in the top-60
   crawl/visit table at all - while 112 pages link to it from their footer. So it is linked and unwanted, which
   is what a page is when it says nothing the next dictionary does not. 60 terms, 6.8 desktop screens and 10.1
   phone screens of a flat <dl>, no search, no grouping, no numbers, nothing to do.

   WHAT MAKES THIS ONE OURS: every other glossary can write the definition. Only we can print what the thing is
   doing RIGHT NOW, measured from our own feeds - funding, open interest, positioning, what was liquidated in the
   last 24 hours, the sentiment index - and only we can put the calculator for the term inside the term. So each
   card is: the answer in one line, the explanation, the live number where we measure it, the arithmetic where
   it is arithmetic, and the terms it leads to.

   The live figures are SERVER-RENDERED (handleSsrGlossary in worker.js) into the `data-gl` slots below, because
   a figure that arrives after a fetch is a figure no crawler and no assistant will ever quote. A slot the server
   could not fill stays `hidden` - silence below the threshold, never a confident blank.

   THE DESIGN LIVES IN THIS FILE'S OWN <style>. blog.css is shared by 722 pages and nothing here may reach them -
   the same rule gen-ask-pages.js follows.

   Data: build/data/glossary.json (the 60 definitions were LIFTED from gen-bigupdate.js, not retyped).
   Run: node build/gen-glossary.js                                                                            */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const TERMS = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'data', 'glossary.json'), 'utf8'));

const GROUPS = [
  { k: 'money', n: 'Margin and money', d: 'What you put up, what you control, and what you get back.' },
  { k: 'order', n: 'Getting in and out', d: 'The orders that open a trade, close it, and decide it for you.' },
  { k: 'risk', n: 'When it goes wrong', d: 'Liquidation and everything that leads to it.' },
  { k: 'market', n: 'What the market is doing', d: 'The numbers that describe the whole book, not your trade.' },
  { k: 'contract', n: 'The contract itself', d: 'What you are actually trading when you trade a perp.' }
];
const esc = (s) => String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();

/* ── the inline calculators ────────────────────────────────────────────────────────────────────────────────────
   Five terms are arithmetic, so the card does the arithmetic. No network, no account, no leaving the page.
   `glLiq` IS THE ONE LIQUIDATION FORMULA - the exchange formula, byte-for-byte the shape of mpcLiq in worker.js
   (im = 1/lev - rate, capped at 0.1/lev; mmr_eff = min(mmr, im/2); long = entry x (1 - im + mmr_eff)). It is
   registered as a MIRROR in build/check-formulas.js, which extracts it from the rendered page and executes it
   against the canonical over 1,152 cases - so this copy cannot drift the way the 76 calculators once did. */
const TOOLJS = `
function glLiq(entry, lev, mmr, long, rate) {
  lev = Math.max(1, +lev || 1); mmr = Math.max(0, +mmr || 0);
  var im = Math.max(1e-6, 1 / lev - Math.min(0.1 / lev, Math.max(0, +rate || 0)));
  var me = Math.min(mmr, im / 2);
  return long ? entry * (1 - im + me) : entry * (1 + im - me);
}
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var num = function (id) { var e = $(id); return e ? parseFloat(String(e.value).replace(/,/g, '')) : NaN; };
  var money = function (v) { if (!isFinite(v)) return '-'; var d = Math.abs(v) >= 1000 ? 2 : Math.abs(v) >= 1 ? 2 : 6; return '$' + v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  var pct = function (v, d) { return isFinite(v) ? (v >= 0 ? '' : '-') + Math.abs(v).toFixed(d == null ? 2 : d) + '%' : '-'; };
  var out = function (id, html, bad) { var e = $(id); if (!e) return; e.innerHTML = html; e.className = 'gl-out' + (bad ? ' bad' : ''); };

  var CALC = {
    liq: function () {
      var e = num('glLiqE'), l = num('glLiqL'), s = $('glLiqS').value === 'short';
      if (!(e > 0) || !(l >= 1)) return out('glLiqO', 'Enter an entry price and leverage.', 1);
      var p = glLiq(e, l, 0.005, !s, 0);
      var away = Math.abs(p - e) / e * 100;
      out('glLiqO', '<b>' + money(p) + '</b><span>' + pct(away) + ' away &middot; at 0.5% maintenance margin</span>');
    },
    roe: function () {
      var m = num('glRoeM'), l = num('glRoeL');
      if (!isFinite(m) || !(l >= 1)) return out('glRoeO', 'Enter a move and a leverage.', 1);
      var r = m * l;
      out('glRoeO', '<b>' + pct(r, 1) + '</b><span>on your margin' + (Math.abs(r) >= 100 ? ' &middot; a move the other way of ' + pct(100 / l, 2) + ' wipes it out' : '') + '</span>');
    },
    size: function () {
      var b = num('glSzB'), r = num('glSzR'), e = num('glSzE'), s = num('glSzS');
      if (!(b > 0) || !(r > 0) || !(e > 0) || !(s > 0)) return out('glSzO', 'Enter balance, risk, entry and stop.', 1);
      var dist = Math.abs(e - s) / e;
      if (!(dist > 0)) return out('glSzO', 'The stop has to be away from the entry.', 1);
      var risk = b * r / 100, notional = risk / dist;
      out('glSzO', '<b>' + money(notional) + '</b><span>of notional risks ' + money(risk) + ' &middot; ' + (notional / b).toFixed(1) + 'x your balance</span>');
    },
    bewr: function () {
      var rr = num('glBeR');
      if (!(rr > 0)) return out('glBeO', 'Enter a reward-to-risk ratio.', 1);
      var w = 100 / (1 + rr);
      out('glBeO', '<b>' + w.toFixed(1) + '%</b><span>of trades must win just to break even, before fees</span>');
    },
    funding: function () {
      var n = num('glFnN'), r = num('glFnR'), d = num('glFnD');
      if (!(n > 0) || !isFinite(r) || !(d > 0)) return out('glFnO', 'Enter notional, rate and days.', 1);
      var pays = n * (r / 100) * (d * 3);
      out('glFnO', '<b>' + money(Math.abs(pays)) + '</b><span>' + (r >= 0 ? 'paid by longs' : 'paid by shorts') + ' over ' + d + ' day' + (d === 1 ? '' : 's') + ' &middot; 3 payments a day</span>');
    }
  };
  Object.keys(CALC).forEach(function (k) {
    var box = document.querySelector('[data-tool="' + k + '"]');
    if (!box) return;
    box.addEventListener('input', CALC[k]);
    box.addEventListener('change', CALC[k]);
    CALC[k]();
  });
})();`;

const TOOLS = {
  liq: { t: 'Work out your own', h: `<label>Entry<input id="glLiqE" type="text" inputmode="decimal" value="80000"></label><label>Leverage<input id="glLiqL" type="text" inputmode="decimal" value="20"></label><label>Side<select id="glLiqS"><option value="long">Long</option><option value="short">Short</option></select></label>`, o: 'glLiqO' },
  roe: { t: 'What a move does to your margin', h: `<label>Price move %<input id="glRoeM" type="text" inputmode="decimal" value="2"></label><label>Leverage<input id="glRoeL" type="text" inputmode="decimal" value="20"></label>`, o: 'glRoeO' },
  size: { t: 'Size it from the stop', h: `<label>Balance $<input id="glSzB" type="text" inputmode="decimal" value="1000"></label><label>Risk %<input id="glSzR" type="text" inputmode="decimal" value="1"></label><label>Entry<input id="glSzE" type="text" inputmode="decimal" value="80000"></label><label>Stop<input id="glSzS" type="text" inputmode="decimal" value="78400"></label>`, o: 'glSzO' },
  bewr: { t: 'How often you must be right', h: `<label>Reward : risk<input id="glBeR" type="text" inputmode="decimal" value="2"></label>`, o: 'glBeO' },
  funding: { t: 'What holding it costs', h: `<label>Notional $<input id="glFnN" type="text" inputmode="decimal" value="10000"></label><label>Rate % / 8h<input id="glFnR" type="text" inputmode="decimal" value="0.01"></label><label>Days<input id="glFnD" type="text" inputmode="decimal" value="7"></label>`, o: 'glFnO' }
};

/* ── the page's own stylesheet ──────────────────────────────────────────────────────────────────────────────── */
const CSS = `
body.gloss .wrap{max-width:1180px}
body.gloss article{max-width:none}
.gl-hero{margin:0 0 18px}
.gl-hero h1{margin:0 0 8px}
.gl-lead{color:#9aa3ad;font-size:15.5px;line-height:1.55;max-width:660px;margin:0 0 16px}
/* THE MARKET RIGHT NOW, IN THE GLOSSARY'S OWN WORDS. Server-rendered; the whole strip is absent when we could
   not measure it, which is the house rule - a figure below its threshold is not printed at all. */
.gl-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:#1c2230;border:1px solid #1c2230;border-radius:14px;overflow:hidden;margin:0 0 18px}
.gl-strip[hidden]{display:none}
.gl-st{background:#0e1116;padding:11px 13px;min-width:0}
.gl-st b{display:block;font:800 18px/1.1 "Bricolage Grotesque",system-ui,sans-serif;color:#e9e7df;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gl-st b.up{color:#2ebd85}.gl-st b.dn{color:#ff6258}
.gl-st span{display:block;font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:#6e7782;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gl-st a{color:inherit;text-decoration:none}
.gl-bar{position:sticky;top:0;z-index:20;background:rgba(10,11,13,.92);backdrop-filter:blur(8px);padding:10px 0 11px;margin:0 0 16px;border-bottom:1px solid #1c2230}
.gl-find{display:flex;align-items:center;gap:9px;background:#0e1116;border:1px solid #2a323d;border-radius:11px;padding:0 12px;height:44px}
.gl-find:focus-within{border-color:#c2f64a}
.gl-find svg{width:16px;height:16px;flex:0 0 16px;color:#6e7782}
.gl-find input{flex:1;min-width:0;background:none;border:0;outline:none;color:#e9e7df;font-weight:500;font-size:16px;line-height:1}
.gl-find input::placeholder{color:#6e7782}
.gl-count{font-size:11.5px;color:#6e7782;white-space:nowrap;flex:0 0 auto}
.gl-chips{display:flex;gap:6px;margin-top:9px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.gl-chips::-webkit-scrollbar{display:none}
.gl-chips button{flex:0 0 auto;background:#12161d;border:1px solid #242c38;border-radius:999px;color:#9aa3ad;font-weight:600;font-size:12.5px;line-height:1;padding:8px 13px;cursor:pointer;white-space:nowrap}
.gl-chips button:hover{border-color:#3a4554;color:#e9e7df}
.gl-chips button.on{background:rgba(194,246,74,.13);border-color:rgba(194,246,74,.55);color:#c2f64a}
.gl-gh{margin:26px 0 12px}
.gl-gh h2{margin:0;font-size:19px}
.gl-gh p{margin:3px 0 0;color:#6e7782;font-size:13px}
/* EVERY CLOSED CARD IS THE SAME SIZE (owner, 2026-10-19: "ove kartice nisu iste dimenzije ... ako treba vise
   prostora da se nesto procita, da mogu na klik da se otvore ... pazi da se ne kvari forma drugim karticama").
   Closed, a card is a fixed box: the term, the answer in at most three lines, and a marker saying whether it
   carries today's number or a calculator. Opening it does NOT stretch its row - the card takes the WHOLE row
   (grid-column:1/-1) and everything else keeps the size it had; one card is open at a time, so the page can
   never end up a patchwork of different heights. */
.gl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;align-items:start}
.gl-card{display:flex;flex-direction:column;height:154px;overflow:hidden;background:#0e1116;border:1px solid #1c2230;border-radius:14px;padding:14px 15px;min-width:0;scroll-margin-top:130px;cursor:pointer;transition:border-color .13s,background .13s}
.gl-card:hover{border-color:#2d3747;background:#101419}
.gl-card:target,.gl-card.lit{border-color:rgba(194,246,74,.55);box-shadow:0 0 0 3px rgba(194,246,74,.09)}
.gl-card h3{margin:0 0 6px;font:800 15.5px/1.25 "Bricolage Grotesque",system-ui,sans-serif;color:#e9e7df;display:flex;align-items:baseline;gap:7px}
.gl-card h3 a{color:inherit;text-decoration:none;pointer-events:none}
.gl-permalink{margin-left:auto;flex:0 0 auto;border:0;background:none;color:#4e5763;font-size:11px;cursor:pointer;padding:2px 3px;opacity:0;transition:opacity .12s}
.gl-card:hover .gl-permalink,.gl-permalink:focus{opacity:1}
.gl-s{margin:0;color:#e9e7df;font-size:14.5px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
/* the marker row sits on the floor of the box, so every card's foot lines up with its neighbours' */
.gl-foot{margin-top:auto;padding-top:9px;display:flex;align-items:center;gap:6px}
.gl-mk{font-weight:700;font-size:9.5px;line-height:1;letter-spacing:.07em;text-transform:uppercase;border-radius:999px;padding:4px 7px;border:1px solid #242c38;color:#6e7782}
.gl-mk.now{border-color:rgba(194,246,74,.4);color:#c2f64a}
.gl-more{margin-left:auto;font-size:11px;color:#4e5763}
.gl-x{display:none}
.gl-card.open{height:auto;overflow:visible;grid-column:1/-1;cursor:default;border-color:#2d3747;background:#101419}
.gl-card.open .gl-s{-webkit-line-clamp:unset;display:block;font-size:16px;max-width:760px}
.gl-card.open .gl-foot{display:none}
.gl-card.open .gl-x{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:16px;margin-top:11px}
.gl-card.open .gl-x.solo{grid-template-columns:minmax(0,760px)}
.gl-xa,.gl-xb{min-width:0}
.gl-close{position:absolute;top:10px;right:12px;border:0;background:none;color:#6e7782;font-size:12px;cursor:pointer;padding:4px 6px;display:none}
.gl-card.open{position:relative}
.gl-card.open .gl-close{display:block}
.gl-card.open .gl-close:hover{color:#e9e7df}
.gl-b{margin:0;color:#8f99a5;font-size:13.5px;line-height:1.6}
.gl-b a{color:#c2f64a}
.gl-live{display:flex;gap:8px;align-items:flex-start;margin:10px 0 0;padding:9px 11px;background:rgba(194,246,74,.06);border:1px solid rgba(194,246,74,.22);border-radius:10px;font-size:13px;line-height:1.5;color:#cfd6de}
.gl-live[hidden]{display:none}
.gl-live i{flex:0 0 auto;font-style:normal;font-weight:800;font-size:9.5px;line-height:1.9;letter-spacing:.08em;color:#c2f64a;text-transform:uppercase}
.gl-live b{color:#e9e7df}
.gl-tool{margin:11px 0 0;padding:11px;background:#0a0c10;border:1px solid #232b36;border-radius:11px}
.gl-tool>span{display:block;font-weight:700;font-size:10.5px;line-height:1;letter-spacing:.08em;text-transform:uppercase;color:#6e7782;margin-bottom:9px}
.gl-tool .gl-f{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:7px}
.gl-tool label{display:block;font-size:10.5px;color:#6e7782;min-width:0}
.gl-tool input,.gl-tool select{display:block;width:100%;box-sizing:border-box;margin-top:3px;background:#12161d;border:1px solid #2a323d;border-radius:8px;color:#e9e7df;font:600 14px/1 "Space Mono",ui-monospace,monospace;padding:8px 9px}
.gl-tool input:focus,.gl-tool select:focus{outline:none;border-color:#c2f64a}
.gl-out{margin-top:9px;font-size:12px;color:#8f99a5}
.gl-out b{display:block;font:800 21px/1.15 "Bricolage Grotesque",system-ui,sans-serif;color:#c2f64a}
.gl-out span{display:block;margin-top:2px}
.gl-out.bad{color:#6e7782}.gl-out.bad b{display:none}
.gl-see{display:flex;flex-wrap:wrap;gap:5px;margin:11px 0 0}
.gl-see a{font-size:11.5px;color:#8f99a5;background:#12161d;border:1px solid #242c38;border-radius:999px;padding:4px 9px;text-decoration:none}
.gl-see a:hover{border-color:#3a4554;color:#e9e7df}
.gl-empty{padding:30px 0;color:#6e7782;text-align:center}
.gl-empty[hidden]{display:none}
/* the reason to cite us rather than harvest us - what was measured, from what, and the free JSON that returns it */
.gl-prov{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:30px 0 0;padding:15px 0 0;border-top:1px solid #1c2230}
.gl-prov div{font-size:12.5px;color:#8f99a5;line-height:1.55;min-width:0}
.gl-prov b{display:block;font-weight:800;font-size:10.5px;line-height:1;letter-spacing:.08em;text-transform:uppercase;color:#6e7782;margin-bottom:5px}
.gl-prov a{color:#c2f64a;word-break:break-word}
/* ON A PHONE A GLOSSARY IS A LIST YOU OPEN, NOT A WALL YOU SCROLL. Measured on the first build: one column of
   sixty full cards was 20.3 phone screens, twice the flat <dl> it replaced - which is the wrong direction even
   with a search box on top. Closed, a card is its name, its one-line answer and (where we have it) today's
   number; the explanation, the calculator and the related terms open on a tap. Measured after: 8.1 screens.
   Nothing is removed from the HTML - a crawler and an assistant read the whole card either way. */
@media (max-width:760px){
  .gl-bar{padding-top:8px}
  .gl-grid{grid-template-columns:1fr;gap:9px}
  .gl-strip{grid-template-columns:1fr 1fr}
  .gl-st b{font-size:16px}
  .gl-lead{font-size:14.5px}
  .gl-card{height:122px;padding:12px 13px}
  .gl-card h3{margin-bottom:5px}
  .gl-permalink{display:none}
  .gl-card .gl-s{-webkit-line-clamp:2;font-size:14px}
  .gl-card.open .gl-s{font-size:15px}
  .gl-card.open .gl-x,.gl-card.open .gl-x.solo{grid-template-columns:1fr;gap:11px}
  .gl-live{font-size:12.5px}
}`;

/* ── the page script: search, groups, deep links, live refresh ─────────────────────────────────────────────── */
const PAGEJS = `
(function () {
  var cards = [].slice.call(document.querySelectorAll('.gl-card'));
  var box = document.getElementById('glQ'), cnt = document.getElementById('glN');
  var empty = document.getElementById('glNone'), chips = document.getElementById('glChips');
  var group = 'all';
  /* The haystack is the term, the one-line answer, the body AND the related terms - the Browse lesson: a reader
     who types what a thing DOES must find the page that does it, not only the one named after it. */
  cards.forEach(function (c) { c.__h = (c.getAttribute('data-k') || '').toLowerCase(); });
  var STOP = { the: 1, a: 1, an: 1, of: 1, to: 1, is: 1, in: 1, on: 1, for: 1, and: 1, or: 1, my: 1, your: 1, what: 1, whats: 1, how: 1, does: 1, do: 1, it: 1, i: 1 };
  function tokens(q) { return q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean); }
  function hits(q) {
    var t = tokens(q); if (!t.length) return null;
    var strict = cards.filter(function (c) { return t.every(function (w) { return c.__h.indexOf(w) >= 0; }); });
    if (strict.length) return strict;
    /* nothing matched every word - drop the function words and ask again, never return nothing while a real
       word in the query still matches something */
    var t2 = t.filter(function (w) { return !STOP[w]; });
    if (!t2.length || t2.length === t.length) return strict;
    return cards.filter(function (c) { return t2.every(function (w) { return c.__h.indexOf(w) >= 0; }); });
  }
  function apply() {
    var q = (box.value || '').trim(), h = hits(q), n = 0;
    cards.forEach(function (c) {
      var okG = group === 'all' || c.getAttribute('data-g') === group;
      var okQ = !h || h.indexOf(c) >= 0;
      var show = okG && okQ;
      c.hidden = !show; if (show) n++;
    });
    [].forEach.call(document.querySelectorAll('.gl-gh'), function (g) {
      var k = g.getAttribute('data-g');
      g.hidden = !document.querySelector('.gl-card[data-g="' + k + '"]:not([hidden])');
    });
    cnt.textContent = n === cards.length ? cards.length + ' terms' : n + ' of ' + cards.length;
    empty.hidden = n > 0;
    if (openCard && openCard.hidden) close();   // a card filtered off the page must not stay the open one
    if (q) { try { window.__mpTrack && window.__mpTrack('glossary', 'find'); } catch (e) {} }
  }
  var t = null;
  box.addEventListener('input', function () { clearTimeout(t); t = setTimeout(apply, 90); });
  box.addEventListener('keydown', function (e) { if (e.key === 'Escape') { box.value = ''; apply(); } });
  chips.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-g]'); if (!b) return;
    group = b.getAttribute('data-g');
    [].forEach.call(chips.querySelectorAll('[data-g]'), function (x) { x.classList.toggle('on', x === b); });
    apply();
    try { window.__mpTrack && window.__mpTrack('glossary', 'group:' + group); } catch (e2) {}
    try { if (window.mpHaptic) window.mpHaptic('tick'); } catch (e3) {}
  });
  /* ONE CARD OPEN AT A TIME, AND IT TAKES THE WHOLE ROW. That is what keeps every other card exactly the size
     it was - the alternative, letting a card grow inside its own column, leaves its two neighbours short and the
     row ragged, which is the thing being fixed. Opening is a click anywhere on the box that is not already
     something (a link, a chip, a calculator field). */
  var openCard = null;
  function setOpen(c) {
    if (openCard && openCard !== c) { openCard.classList.remove('open'); openCard.setAttribute('aria-expanded', 'false'); }
    openCard = c || null;
    if (c) { c.classList.add('open'); c.setAttribute('aria-expanded', 'true'); }
  }
  function close() { if (openCard) { openCard.classList.remove('open'); openCard.setAttribute('aria-expanded', 'false'); openCard = null; } }
  document.addEventListener('click', function (e) {
    if (e.target.closest('.gl-close')) { close(); return; }
    if (e.target.closest('a, input, select, label, .gl-tool, .gl-permalink')) return;
    var c = e.target.closest('.gl-card'); if (!c) return;
    if (c === openCard) { close(); return; }
    setOpen(c);
    try { if (window.mpHaptic) window.mpHaptic('tick'); } catch (e2) {}
    try { window.__mpTrack && window.__mpTrack('glossary', 'open:' + c.id); } catch (e3) {}
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openCard) { close(); return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var c = e.target && e.target.classList && e.target.classList.contains('gl-card') ? e.target : null;
    if (!c) return;
    e.preventDefault(); if (c === openCard) close(); else setOpen(c);
  });
  /* a deep link must survive the filter: clear it, show the card, light it */
  function lite() {
    var id = (location.hash || '').slice(1); if (!id) return;
    var c = document.getElementById(id); if (!c) return;
    box.value = ''; group = 'all';
    [].forEach.call(chips.querySelectorAll('[data-g]'), function (x) { x.classList.toggle('on', x.getAttribute('data-g') === 'all'); });
    apply();
    c.classList.add('lit'); setOpen(c); c.scrollIntoView({ block: 'center' });   // a deep link lands on the term OPEN
    setTimeout(function () { c.classList.remove('lit'); }, 2400);
  }
  window.addEventListener('hashchange', lite);
  document.addEventListener('click', function (e) {
    var p = e.target.closest && e.target.closest('.gl-permalink'); if (!p) return;
    var id = p.getAttribute('data-id'), u = location.origin + location.pathname + '#' + id;
    try { navigator.clipboard.writeText(u); } catch (e2) {}
    var o = p.textContent; p.textContent = 'copied'; setTimeout(function () { p.textContent = o; }, 1300);
    try { window.__mpTrack && window.__mpTrack('glossary', 'copy:' + id); } catch (e3) {}
  });
  apply(); setTimeout(lite, 60);
  /* The live figures are already on the page, server-rendered. This only keeps them fresh for a tab left open:
     ONE request, and it fills the SAME slots the server filled - no second renderer to drift. */
  function live() {
    fetch('/api/glossary/live', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      var m = (j && j.slots) || {};
      Object.keys(m).forEach(function (k) {
        [].forEach.call(document.querySelectorAll('[data-gl="' + k + '"]'), function (el) { el.innerHTML = m[k]; el.hidden = false; });
      });
      var s = document.getElementById('glStrip');
      if (s && j && j.strip) { s.innerHTML = j.strip; s.hidden = false; }
    }).catch(function () {});
  }
  setTimeout(live, 1200);
  setInterval(function () { if (!document.hidden) live(); }, 180000);
})();`;

function card(x) {
  const key = [x.t, x.s, plain(x.b), x.see.join(' '), x.g].join(' ').toLowerCase().replace(/\s+/g, ' ');
  const see = x.see.map(id => {
    const o = TERMS.find(y => y.id === id);
    return o ? `<a href="#${id}">${esc(plain(o.t))}</a>` : '';
  }).join('');
  const tool = x.tool && TOOLS[x.tool]
    ? `\n        <div class="gl-tool" data-tool="${x.tool}"><span>${TOOLS[x.tool].t}</span><div class="gl-f">${TOOLS[x.tool].h}</div><div class="gl-out" id="${TOOLS[x.tool].o}"></div></div>`
    : '';
  // the slot the worker fills; hidden until it has something, so a page served without live data shows no gap
  const live = x.live ? `<p class="gl-live" data-gl="${x.live}" hidden></p>` : '';
  // The closed box says what is WAITING inside, so a reader knows which cards are worth opening without opening
  // one. Same two facts the detail carries, so they cannot disagree.
  const marks = (x.live ? '<span class="gl-mk now">live now</span>' : '') + (x.tool ? '<span class="gl-mk">calculator</span>' : '');
  const aside = live + tool;
  return `      <div class="gl-card" id="${x.id}" data-g="${x.g}" data-k="${esc(key)}" role="button" tabindex="0" aria-expanded="false">
        <h3><a href="#${x.id}">${x.t}</a><button class="gl-permalink" type="button" data-id="${x.id}" aria-label="Copy a link to this term">link</button></h3>
        <p class="gl-s">${esc(x.s)}</p>
        <div class="gl-foot">${marks}<span class="gl-more">more</span></div>
        <button class="gl-close" type="button" aria-label="Close">close</button>
        <div class="gl-x${aside ? '' : ' solo'}">
          <div class="gl-xa"><p class="gl-b">${x.b}</p><div class="gl-see">${see}</div></div>${aside ? `
          <div class="gl-xb">${aside}</div>` : ''}
        </div>
      </div>`;
}

function page() {
  const url = 'https://marginpad.io/glossary/';
  const title = 'Crypto Futures Glossary - Every Term, With Today\'s Number';
  const desc = `${TERMS.length} crypto futures and leverage terms in plain English - and for ten of them the live figure measured from our own feeds right now: funding, open interest, positioning, 24h liquidations and sentiment. With the calculator built into the term.`;
  const ld = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'DefinedTermSet', '@id': url + '#set',
    name: 'Crypto Futures Glossary', url, inLanguage: 'en',
    description: plain(desc),
    hasDefinedTerm: TERMS.map(x => ({ '@type': 'DefinedTerm', '@id': url + '#' + x.id, name: plain(x.t), description: plain(x.s) + ' ' + plain(x.b), url: url + '#' + x.id, inDefinedTermSet: url + '#set' }))
  })}</script>`;

  const body = GROUPS.map(g => {
    const list = TERMS.filter(x => x.g === g.k);
    return `    <div class="gl-gh" data-g="${g.k}"><h2>${g.n}</h2><p>${g.d} &middot; ${list.length} terms</p></div>
    <div class="gl-grid">
${list.map(card).join('\n')}
    </div>`;
  }).join('\n');

  return { url, title, desc, ld, body };
}

/* ── render into the shell gen-bigupdate.js already uses, so the page keeps the site's head, nav and footer ── */
function shellHead(o) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-18230384038');</script>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${o.title} | MarginPad</title>
<meta name="description" content="${esc(o.desc)}" />
<meta name="keywords" content="crypto futures glossary, leverage trading terms, liquidation meaning, funding rate meaning, margin terms crypto, perpetual futures dictionary" />
<link rel="canonical" href="${o.url}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#0a0b0d" />
<meta property="og:title" content="${o.title}" />
<meta property="og:description" content="${esc(o.desc)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${o.url}" />
<meta property="og:image" content="https://marginpad.io/assets/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://marginpad.io/assets/og.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Familjen+Grotesk:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/assets/blog.css" />
<style>${CSS}</style>
${o.ld}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://marginpad.io/"},{"@type":"ListItem","position":2,"name":"Glossary","item":"${o.url}"}]}</script>
</head>
<body class="gloss">
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="/">Calculators</a><a href="/blog/">Blog</a><a href="/glossary/">Glossary</a></nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / Glossary</div>
  <article>`;
}

function render() {
  const o = page();
  const chips = [{ k: 'all', n: 'All' }].concat(GROUPS.map(g => ({ k: g.k, n: g.n })))
    .map((c, i) => `<button type="button" data-g="${c.k}"${i === 0 ? ' class="on"' : ''}>${c.n}</button>`).join('');
  return shellHead(o) + `
    <div class="gl-hero">
      <h1>Crypto Futures Glossary</h1>
      <p class="gl-lead">${TERMS.length} terms in plain English. For the ten we actually measure, the card carries today's number from our own feeds - and where the term is arithmetic, the calculator is in the card.</p>
    </div>
    <!--GLOSS_STRIP--><div class="gl-strip" id="glStrip" hidden></div>
    <div class="gl-bar">
      <div class="gl-find">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="glQ" type="search" placeholder="Search a term, or what it does - try &quot;forced to sell&quot;" autocomplete="off" aria-label="Search the glossary">
        <span class="gl-count" id="glN">${TERMS.length} terms</span>
      </div>
      <div class="gl-chips" id="glChips">${chips}</div>
    </div>
    <p class="gl-empty" id="glNone" hidden>Nothing matches that. Clear the search to see all ${TERMS.length} terms.</p>
${o.body}
    <div class="gl-prov">
      <div><b>Where the numbers come from</b>Funding, open interest and positioning are read from the exchanges' own public endpoints. The 24-hour liquidation figures are our own collector, which records every forced close it sees across eight venues. Sentiment is the Fear &amp; Greed Index.</div>
      <div><b>When</b>The figures on this page are rendered when the page is served and refreshed every few minutes while it is open. A figure we could not measure is not printed at all.</div>
      <div><b>Take the numbers</b>The same figures are free JSON, no key and no account: <a href="https://marginpad.io/api/glossary/live">/api/glossary/live</a> &middot; <a href="https://marginpad.io/api/cg/board?symbol=BTC">/api/cg/board</a> &middot; <a href="https://marginpad.io/api/v1/liquidations/recent?symbol=BTC&amp;minutes=1440">/api/v1/liquidations/recent</a></div>
    </div>
    <h2>Put the terms to work</h2>
    <div class="related">
      <a href="/paper-trade">Practise on a free simulator</a><a href="/calculators?c=liq">Liquidation calculator</a><a href="/calculators?c=size">Position size</a><a href="/heatmap">Liquidation heatmap</a><a href="/funding/">Live funding rates</a><a href="/academy/">The Academy</a>
    </div>
  </article>
  <footer>
    <span>&copy; 2026 MarginPad</span>
    <span><a href="/">Calculators</a> &middot; <a href="/blog/">Blog</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="/privacy/">Privacy</a> &middot; <a href="/glossary/">Glossary</a> &middot; <a href="/about/">About</a></span>
  </footer>
</div>
<script>${TOOLJS}</script>
<script>${PAGEJS}</script>
</body>
</html>
`;
}

const dir = path.join(ROOT, 'dist', 'glossary');
fs.mkdirSync(dir, { recursive: true });
const html = render();
fs.writeFileSync(path.join(dir, 'index.html'), html);
console.log('wrote dist/glossary/index.html - ' + TERMS.length + ' terms, '
  + TERMS.filter(x => x.live).length + ' live figures, ' + TERMS.filter(x => x.tool).length + ' inline calculators, '
  + Math.round(html.length / 1024) + ' KB');
