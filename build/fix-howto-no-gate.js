#!/usr/bin/env node
/* THE SEASON CARD STOPS SAYING BRONZE IS A GATE (2026-10-23, owner: "bronza vise nije neophodna za nagrade ... svako
   moze odma da ucestvuje ako zeli u bilo cemu"). "How MarginPad works" on /season/ was built on 2026-09-20 around one
   sentence - "Bronze opens the money" - in fifteen languages (the inline `var T` dictionary; the picker translates only
   this card). Every language gets the new text: the money is open from day one, levels are badges and bigger faucet
   claims. Translations come from scratchpad/howto-i18n.json (a Sonnet translator writes it, this script never invents
   a language); English is in this file. The static `data-hw` copy, the teaser line and the Road-to-Bronze toast follow.

   Idempotent, --dry.                                                                                                 */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'season', 'index.html');
const I18N = process.argv.find(a => a.startsWith('--i18n=')) ? process.argv.find(a => a.startsWith('--i18n=')).slice(7)
  : path.join(process.env.TEMP || '/tmp', 'claude', 'D--part1-money-mission', 'ff02965c-0264-4af5-bac5-a57f4edcd8e8', 'scratchpad', 'howto-i18n.json');
let h = fs.readFileSync(F, 'utf8');
const done = [];

const EN = {
  lead: 'Four things, and none of them is a gate.',
  s1t: 'The money is open from day one',
  s1b: 'The faucet, the daily missions, withdrawals and referrals are open to every account the moment it signs in. No level, no deposit, nothing to unlock. Levels still matter: a higher level pays bigger faucet claims and wears its own badge.',
  s2t: 'The Academy is the fastest way to level up',
  s2b: 'Every lesson pays +25 XP and finishing a course pays +50 more. Twenty lessons is Bronze, your first level badge, which is about one evening. Trading earns XP too, but far more slowly.',
  s4b: 'Four paper boards pay real USDT every fourteen days, with no deposit and no exchange account, and your first closed trade puts you on them. What you win is yours to withdraw at any level. The Gold Room is for Gold members at 12,000 XP, and two more boards are scored on real accounts opened through MarginPad - Bybit volume and King of the Moon.',
  youIn: 'You are in. The faucet, the missions and withdrawals are open to you, and anything you win on the four boards is yours to take. The Gold Room opens at Gold, which is 12,000 XP.',
};
const KEYS = Object.keys(EN);

/* 1. the dictionary */
const i0 = h.indexOf('  var T = {'), i1 = h.indexOf('};', i0);
if (i0 < 0 || i1 < 0) throw new Error('var T not found');
const T = eval('(' + h.slice(i0 + 10, i1 + 1) + ')');
if (T.en.s1t !== EN.s1t) {
  const tr = fs.existsSync(I18N) ? JSON.parse(fs.readFileSync(I18N, 'utf8')) : null;
  if (!tr) throw new Error('no translations at ' + I18N + ' - run the translator first');
  for (const L of Object.keys(T)) {
    const src = L === 'en' ? EN : tr[L];
    if (!src) throw new Error('no translation for ' + L);
    for (const k of KEYS) { if (!src[k] || typeof src[k] !== 'string') throw new Error(L + '.' + k + ' missing'); if (/<|>|\u{1F300}-\u{1FAFF}/u.test(src[k])) throw new Error(L + '.' + k + ' carries markup or an emoji'); T[L][k] = src[k]; }
  }
  // every language must keep the two figures the sentence is about
  for (const L of Object.keys(T)) { if (!/12[,.  ]?000/.test(T[L].s4b) || !/12[,.  ]?000/.test(T[L].youIn) || !/25/.test(T[L].s2b) || !/50/.test(T[L].s2b)) throw new Error(L + ': a figure went missing'); }
  h = h.slice(0, i0) + '  var T = ' + JSON.stringify(T) + h.slice(i1 + 1);
  done.push('the 15-language dictionary (' + KEYS.join(', ') + ')');
}

/* 2. the static copy a crawler reads (English; gen-pages makes the Spanish twin from it) */
function one(name, a, b) { if (h.indexOf(b) >= 0) return; const n = h.split(a).length - 1; if (n !== 1) throw new Error(name + ': anchor x' + n); h = h.split(a).join(b); done.push(name); }
one('fteaser',
  '<div class="fteaser">Bronze (500 XP) opens the money, the Academy is the fastest way there, and your first closed trade already puts you on the boards.</div>',
  '<div class="fteaser">Everything pays from day one with no level to unlock, the Academy is the fastest way to level up, and your first closed trade already puts you on the boards.</div>');
one('lead', '<div class="lead hw-lead" data-hw="lead" style="margin-bottom:12px">Four things, and only the first one is a gate.</div>', '<div class="lead hw-lead" data-hw="lead" style="margin-bottom:12px">' + EN.lead + '</div>');
one('s1', '<h3 data-hw="s1t">Bronze opens the money</h3><p data-hw="s1b">The faucet, the daily missions, withdrawals and referrals all unlock at Bronze, which is 500 XP. It costs nothing. It is the only thing between you and the rewards.</p>',
  '<h3 data-hw="s1t">' + EN.s1t + '</h3><p data-hw="s1b">' + EN.s1b + '</p>');
one('s2', '<h3 data-hw="s2t">The Academy is the fastest way there</h3><p data-hw="s2b">Every lesson pays +25 XP and finishing a course pays +50 more. Twenty lessons is Bronze, which is about one evening. Trading earns XP too, but far more slowly.</p>',
  '<h3 data-hw="s2t">' + EN.s2t + '</h3><p data-hw="s2b">' + EN.s2b + '</p>');
{
  const a0 = h.indexOf('<p data-hw="s4b">'); if (a0 < 0) throw new Error('s4b static not found');
  const a1 = h.indexOf('</p>', a0);
  const cur = h.slice(a0 + 17, a1);
  if (cur !== EN.s4b) { if (cur.indexOf('Bronze is what lets you withdraw') < 0) throw new Error('s4b static unexpected: ' + cur.slice(0, 80)); h = h.slice(0, a0 + 17) + EN.s4b + h.slice(a1); done.push('s4b static'); }
}
/* 3. the Road-to-Bronze toast */
one('bz toast',
  "__esT_seasonindex(\"youAreBronzeThe\",'You are Bronze. The faucet, the missions and withdrawals are open.')",
  "__esT_seasonindex(\"youAreBronzeThe\",'You are Bronze - your first level badge is on your card.')");
one('bz toast es', '"youAreBronzeThe":"Ya eres Bronze. El faucet, las misiones y los retiros están abiertos."', '"youAreBronzeThe":"Ya eres Bronze - tu primera insignia de nivel está en tu tarjeta."');

if (!done.length) { console.log('fix-howto-no-gate: nothing to do'); process.exit(0); }
if (/Bronze opens the money|only the first one is a gate|Bronze is what lets you withdraw/.test(h)) throw new Error('old copy survived');
console.log('fix-howto-no-gate: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('  written: dist/season/index.html');
