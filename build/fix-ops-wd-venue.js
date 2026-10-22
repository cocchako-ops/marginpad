#!/usr/bin/env node
/* THE WITHDRAWAL QUEUE SAYS WHICH EXCHANGE IT IS PAYING (2026-10-22, owner: "Na mp-ops kad mi stigne wd zahtev
   na UID, moras nekako po bojama menjacnice ili negde da ubacis mali logo da znam na koju menjacnicu isplacujem").

   He pays these by hand, one at a time, from a table where every row is a number - and a Bybit UID, a MEXC UID
   and a Bitget UID are all "a number". The venue was readable only by squinting at a prefix that three of the
   four do not even carry (a BARE number is Bybit).

   AND READING IT PROPERLY FOUND A BUG I HAD JUST SHIPPED: the venue was derived by a hand-written prefix ladder
   that knew moon: and mexc: and nothing else, so a `bitget:` payout - a method live since this morning - would
   have been read as BYBIT, and then judged against the BYBIT UID ALLOWLIST. That is a red NOT ON LIST beside a
   perfectly good Bitget payout, which is precisely how an owner stops trusting a column. The ladder is a table
   now, and it is the same table that draws the mark.

   WHAT READS AT 16px IS COLOUR, NOT A LOGO. Bitget, MEXC and Moon have square glyph marks, so those are drawn.
   Bybit's own asset is a WORDMARK - "BYBIT" at 16px is mud - so it gets its amber tile with the B letter mark,
   exactly as the profile medal does. Every venue therefore reads the same way: a brand-coloured tile, plus the
   name in words, because a colour nobody has learnt yet still has to say what it is.

   Idempotent, --dry. Refuses rather than guessing.                                                             */
'use strict';
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', 'src', 'ops', 'client', 'ops.js.txt');
const DRY = process.argv.indexOf('--dry') >= 0;

let h = fs.readFileSync(F, 'utf8');
const before = h;
const done = [];

function one(name, a, b, skipIf) {
  if (skipIf && [].concat(skipIf).some(m => h.indexOf(m) >= 0)) return false;
  const n = h.split(a).length - 1;
  if (n !== 1) throw new Error(name + ': anchor appears ' + n + ' times, expected 1');
  h = h.split(a).join(b);   // split/join, never String.replace - a `$` in the replacement is a capture reference
  done.push(name);
  return true;
}

/* ---- 1. one table for every payout venue ---------------------------------------------------------------- */
const TABLE = [
  "  /* THE PAYOUT VENUE IS A TABLE, NOT A PREFIX LADDER (2026-10-22). The ladder knew moon: and mexc:, so the",
  "     bitget: method that shipped this morning read as BYBIT and was then judged against the Bybit UID",
  "     allowlist - a red NOT ON LIST beside a good payout. A new method is a line here and nothing else.",
  "     `logo` is drawn only where the venue's own mark is a SQUARE GLYPH; Bybit's asset is a wordmark, which at",
  "     16px is mud, so it gets the amber tile and the B letter mark the profile medal already uses. */",
  "  var WDV = [",
  "    { k: 'moon', pre: 'moon:', label: 'Moon', col: '#8a5cff', logo: '/assets/moon.png' },",
  "    { k: 'mexc', pre: 'mexc:', label: 'MEXC', col: '#0057ff', logo: '/assets/ex/mexc.png' },",
  "    { k: 'bitget', pre: 'bitget:', label: 'Bitget', col: '#00e7d8', logo: '/assets/ex/bitget.png' },",
  "    { k: 'bybit', pre: '', label: 'Bybit', col: '#f7a600', letter: 'B' }            // a BARE number is a Bybit UID",
  "  ];",
  "  function wdVenue(wallet) { var w = String(wallet || ''); for (var i = 0; i < WDV.length; i++) { var v = WDV[i]; if (v.pre && w.indexOf(v.pre) === 0) return v; } return WDV[WDV.length - 1]; }",
  "  function wdMark(v, px) {",
  "    var s = px || 16;",
  "    var inner = v.logo",
  "      ? '<img src=\"' + v.logo + '\" alt=\"\" width=\"' + s + '\" height=\"' + s + '\" style=\"width:100%;height:100%;border-radius:4px;display:block\">'",
  "      : '<span style=\"font:800 ' + Math.round(s * 0.66) + 'px/1 var(--font,inherit);color:#1a1205\">' + v.letter + '</span>';",
  "    return '<span title=\"' + v.label + '\" style=\"width:' + s + 'px;height:' + s + 'px;border-radius:4px;background:' + v.col + ';display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;vertical-align:middle\">' + inner + '</span>';",
  "  }",
].join('\n');
one('one table for every payout venue', '  VIEWS[\'money/withdrawals\'] = { render: function (el) {', TABLE + '\n  VIEWS[\'money/withdrawals\'] = { render: function (el) {', 'var WDV = [');

/* ---- 2. the row reads the table ------------------------------------------------------------------------- */
one('the row derives its venue from the table',
  "              var _w9 = String(w.wallet || ''), _ven = _w9.indexOf('moon:') === 0 ? 'Moon' : _w9.indexOf('mexc:') === 0 ? 'MEXC' : 'Bybit';\n"
  + "              var uid = _ven !== 'Bybit' ? '<span class=\"badge\">' + _ven + '</span>' : w.uidCheck === 'ok' ? '<span class=\"badge ok\">UID OK</span>' : w.uidCheck === 'missing' ? '<span class=\"badge red\">NOT ON LIST</span>' : '<span class=\"badge\">' + esc(w.uidCheck || '-') + '</span>';",
  "              var _vv = wdVenue(w.wallet), _ven = _vv.label;\n"
  + "              /* the UID badge is a BYBIT allowlist verdict and means nothing for the others - a red NOT ON LIST\n"
  + "                 beside a perfectly good Moon or Bitget payout is how an owner stops trusting a column */\n"
  + "              var uid = _vv.k !== 'bybit' ? '<span class=\"badge\">' + esc(_ven) + '</span>' : w.uidCheck === 'ok' ? '<span class=\"badge ok\">UID OK</span>' : w.uidCheck === 'missing' ? '<span class=\"badge red\">NOT ON LIST</span>' : '<span class=\"badge\">' + esc(w.uidCheck || '-') + '</span>';",
  'var _vv = wdVenue(w.wallet)');

/* ---- 3. the pay-to cell carries the mark, the name and the brand colour --------------------------------- */
/* the cell lives INSIDE one long string concatenation, so the anchor must not carry the quotes that would
   wrap it as a standalone literal - my first cut did and matched nothing */
one('the pay-to cell shows the exchange',
  "</td><td class=\"mono\">' + esc(w.wallet) + ' <button class=\"btn sm\" data-copy=\"' + esc(w.wallet) + '\">copy</button></td>",
  "</td><td class=\"mono\" style=\"border-left:3px solid ' + _vv.col + '\"><div style=\"display:flex;align-items:center;gap:7px\">' + wdMark(_vv, 16) + '<span><b style=\"font-family:var(--font,inherit);font-size:11px;letter-spacing:.04em;color:' + _vv.col + '\">' + esc(_ven.toUpperCase()) + '</b><br>' + esc(w.wallet) + '</span><button class=\"btn sm\" data-copy=\"' + esc(w.wallet) + '\" style=\"margin-left:auto\">copy</button></div></td>",
  'border-left:3px solid');

/* ---- 4. the payment list he pastes names the venue too -------------------------------------------------- */
one('the copied payment list names the venue',
  "var txt = pend.map(function (w) { return w.wallet + '\\t' + (+w.usd || 0).toFixed(2) + '\\t@' + (w.who || '') + '\\t' + (w.uidCheck || ''); }).join('\\n');",
  "var txt = pend.map(function (w) { return wdVenue(w.wallet).label + '\\t' + w.wallet + '\\t' + (+w.usd || 0).toFixed(2) + '\\t@' + (w.who || '') + '\\t' + (w.uidCheck || ''); }).join('\\n');",
  'wdVenue(w.wallet).label');
one('and the button says so',
  "title=\"one line per pending payout: wallet, amount, user - paste it into your payment sheet\"",
  "title=\"one line per pending payout: exchange, wallet, amount, user - paste it into your payment sheet\"",
  'exchange, wallet, amount, user');

/* ---- report --------------------------------------------------------------------------------------------- */
if (!done.length) { console.log('fix-ops-wd-venue: nothing to do (already applied)'); process.exit(0); }

for (const v of ['moon', 'mexc', 'bitget', 'bybit']) {
  if (h.indexOf("k: '" + v + "'") < 0) throw new Error('venue ' + v + ' missing from WDV');
}
if ((h.match(/function wdVenue\b/g) || []).length !== 1) throw new Error('wdVenue is not defined exactly once');
if ((h.match(/function wdMark\b/g) || []).length !== 1) throw new Error('wdMark is not defined exactly once');
if (h.indexOf("indexOf('mexc:') === 0 ? 'MEXC'") >= 0) throw new Error('the old prefix ladder survived');
if (h.indexOf('NOT ON LIST') < 0) throw new Error('the Bybit allowlist verdict was swallowed');
if (h.indexOf('data-copy="') < 0) throw new Error('the copy button was swallowed');

console.log('fix-ops-wd-venue: ' + done.length + ' edits -> ' + done.join(', '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
const tmp = F + '.tmp';
fs.writeFileSync(tmp, h);
fs.renameSync(tmp, F);
console.log('  written: src/ops/client/ops.js.txt (' + (h.length - before.length >= 0 ? '+' : '') + (h.length - before.length) + ' bytes)');
