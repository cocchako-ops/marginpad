#!/usr/bin/env node
/* BINGX JOINS THE HOMEPAGE EXCHANGE GRID (2026-10-21, owner: "Bingx takodje mozes da ubacis i na pocetnu
   stranicu, gde su i ostali").

   Edits the SOURCE (dist/demo-home/index.html). The live `/` is generated from it, so run
   `node build/gen-home-live.js` -> `gen-i18n-pages` -> `add-og-image` + `gen-feed` afterwards, and revert the
   four files gen-feed touches outside this scope (app.html, app-es.html and the two squads pages).

   THE LOGO IS SELF-HOSTED. Its neighbours hotlink CoinMarketCap with an `onerror` letter fallback; this one
   serves /assets/ex/bingx.png, which we downloaded from the same source and verified (64x64 PNG, blue ground
   with a white mark, fully opaque). Strictly better: a CDN that goes dark cannot blank a partner tile. It also
   needs NO white chip, unlike Bybit and MEXC - those two have marks baked on white and the grid gives them one;
   BingX brings its own solid ground.

   THE MEXC TILE'S COLOUR IS CORRECTED while we are here: it carried #0ac2d6, a teal that predates their
   rebrand and matches nothing they publish. #0057ff is read off their official 64px logo (962 of its ~1,000
   coloured pixels). Its href moves to the owner's own promote link, which resolves to the SAME affiliate
   account (promote.mexc.com/a/ZBQaEXe8 -> .../custom-sign-up?shareCode=mexc-47LrK, checked by following it). */
'use strict';
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', 'dist', 'demo-home', 'index.html');
const DRY = process.argv.indexOf('--dry') >= 0;

let h = fs.readFileSync(F, 'utf8');
const before = h;
const done = [];

function one(name, a, b, skipIf) {
  if (skipIf && h.indexOf(skipIf) >= 0) return false;
  const n = h.split(a).length - 1;
  if (n !== 1) throw new Error(name + ': anchor appears ' + n + ' times, expected 1 (already applied?)');
  h = h.split(a).join(b);
  done.push(name);
  return true;
}

const MEXC_OLD = '<a class="exs" href="https://s.mexc.com/referral/YkL887dVgt" target="_blank" rel="noopener sponsored" data-ex="MEXC" style="--exc:#0ac2d6">';
const MEXC_NEW = '<a class="exs" href="https://promote.mexc.com/a/ZBQaEXe8" target="_blank" rel="noopener sponsored" data-ex="MEXC" style="--exc:#0057ff">';

const BINGX_TILE = '<a class="exs" href="https://bingxdao.com/referral-program/K5WJQO?activityId=g_1567322053827448881"'
  + ' target="_blank" rel="noopener sponsored" data-ex="BingX" style="--exc:#2b54fc">'
  + '<span class="exs-top"><span class="exs-ic">'
  + '<img src="/assets/ex/bingx.png" alt="BingX" width="30" height="30" loading="lazy" onerror="this.parentNode.textContent=\'X\'">'
  + '</span><span class="exs-n">BingX</span><span class="exs-tag">Copy trading</span><span class="exs-go">&#8594;</span></span>'
  + '<span class="exs-perk">Copy-trading desk + bonus for new traders</span></a>';

one('MEXC tile: the owner\'s link and the real brand colour', MEXC_OLD, MEXC_NEW, 'promote.mexc.com/a/ZBQaEXe8');

// the tile goes straight after MEXC: both are blue, both are mid-table in every country order, and they read
// as a pair rather than BingX looking parked at the end
{
  const i = h.indexOf('data-ex="MEXC" style');
  if (i < 0) throw new Error('MEXC tile not found');
  const end = h.indexOf('</a>', i) + 4;
  if (h.indexOf('data-ex="BingX"') < 0) {
    h = h.slice(0, end) + BINGX_TILE + h.slice(end);
    done.push('BingX tile inserted after MEXC');
  }
}

if (!done.length) { console.log('fix-home-bingx: nothing to do (already applied)'); process.exit(0); }

// structural guards
const o = (h.match(/<a /g) || []).length, o0 = (before.match(/<a /g) || []).length;
const c = (h.match(/<\/a>/g) || []).length, c0 = (before.match(/<\/a>/g) || []).length;
if (o - o0 !== c - c0) throw new Error('anchor tags unbalanced: +' + (o - o0) + ' open vs +' + (c - c0) + ' close');
if ((h.match(/data-ex="BingX"/g) || []).length !== 1) throw new Error('BingX tile is not present exactly once');
if (h.indexOf('/assets/ex/bingx.png') < 0) throw new Error('BingX logo reference missing');
if (!fs.existsSync(path.join(__dirname, '..', 'dist', 'assets', 'ex', 'bingx.png'))) throw new Error('dist/assets/ex/bingx.png does not exist - the tile would render an X');

console.log('fix-home-bingx: ' + done.length + ' edits -> ' + done.join(', '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F, h);
console.log('  written: dist/demo-home/index.html (+' + (h.length - before.length) + ' bytes)');
console.log('  NEXT: node build/gen-home-live.js && node build/gen-i18n-pages.js && node build/add-og-image.js && node build/gen-feed.js   (then revert app.html, app-es.html and the two squads pages)');
