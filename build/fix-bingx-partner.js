#!/usr/bin/env node
/* THE BINGX LINK IS THE PARTNER URL, AND BINGX IS A PAYOUT METHOD (2026-10-24, owner handed over both the new
   link and an affiliate API key in one message).

   THE LINK: every surface carried https://bingxdao.com/referral-program/K5WJQO?activityId=g_1567322053827448881
   - seventeen files, because a partner link is a SITE-WIDE edit (the bento homepage, all twelve language
   homepages, the generated dist copy, mp-auth's window.mpEx, and the worker's /go?ex=bingx redirect). Missing
   one is how a dead campaign id keeps earning nothing, so this is a patcher and not a hand edit.
   The invite CODE stays K5WJQO: it is what the 26 referrals on the book are recorded under and what somebody
   registering by code still types. Verification never gates on it (see bingxAffLookup) precisely because a
   partner link may record its own.

   THE PAYOUT METHOD: the fourth entry in WD_METHODS, with the button, the note and the pre-check endpoint the
   other venues already have. One table, one line - the shape the 2026-10-22 note asks for.

   Idempotent, --dry. */
'use strict';
const fs = require('fs'), path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const ROOT = path.join(__dirname, '..');
const OLD = 'https://bingxdao.com/referral-program/K5WJQO?activityId=g_1567322053827448881';
const OLD_HTML = OLD.replace(/&/g, '&amp;');
const NEW = 'https://bingx.com/partner/Marginpad';

// ---- 1. the link, everywhere it is written ----
/* build/fix-home-bingx.js is IN this list on purpose: it is the generator that writes the homepage tile, so
   leaving the retired campaign link inside it means the next run puts it back on twelve homepages. */
const FILES = ['src/worker.js', 'dist/assets/mp-auth.js', 'dist/demo-home/index.html', 'dist/index.html', 'build/fix-home-bingx.js']
  .concat(['ar', 'de', 'es', 'fr', 'id', 'ja', 'ko', 'nl', 'pt', 'ru', 'tr', 'zh'].map(l => 'dist/' + l + '/index.html'));
let linked = 0, already = 0;
for (const rel of FILES) {
  const F = path.join(ROOT, rel);
  if (!fs.existsSync(F)) { console.log('  MISSING ' + rel); continue; }
  let h = fs.readFileSync(F, 'utf8');
  // the campaign URL carries no &, so the escaped form IS the raw one - count it once, or the report doubles
  const n = h.split(OLD).length - 1 + (OLD_HTML === OLD ? 0 : h.split(OLD_HTML).length - 1);
  if (!n) { if (h.indexOf(NEW) >= 0) already++; else console.log('  no BingX link in ' + rel); continue; }
  h = h.split(OLD_HTML).join(NEW).split(OLD).join(NEW);
  // the comment in mp-auth describes the link it no longer uses
  h = h.split('bingxdao.com/referral-program/K5WJQO -> bingx.com/en/referral-program/K5WJQO').join('bingx.com/partner/Marginpad (the owner moved it here 2026-10-24; code K5WJQO)');
  if (!DRY) { fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F); }
  console.log('  ' + rel + ': ' + n + ' link' + (n === 1 ? '' : 's'));
  linked++;
}

// ---- 2. BingX as a payout method on /rewards/ ----
const R = path.join(ROOT, 'dist', 'rewards', 'index.html');
let r = fs.readFileSync(R, 'utf8');
let wd = 0;
if (r.indexOf('wdmBingx') < 0) {
  const BTN_AFTER = '<button type="button" id="wdmBitget"';
  const btnI = r.indexOf(BTN_AFTER);
  if (btnI < 0) throw new Error('the Bitget withdraw button was not found');
  const BTN = '<button type="button" id="wdmBingx" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:transparent;color:#c7ced6;font-weight:700;font-size:13px;cursor:pointer"><img src="/assets/ex/bingx.png" alt="" width="16" height="16" style="border-radius:4px">BingX</button>\n        ';
  r = r.slice(0, btnI) + BTN + r.slice(btnI);

  const NOTE_AFTER = '<div class="note wd-note" id="wdNoteBitget"';
  const nI = r.indexOf(NOTE_AFTER);
  if (nI < 0) throw new Error('the Bitget withdraw note was not found');
  const NOTE = '<div class="note wd-note" id="wdNoteBingx" hidden style="--wdc:#2b54fc;--wdb:rgba(43,84,252,.45);--wdg:rgba(43,84,252,.09)">USDT is sent to your <b>BingX</b> account by UID - the account must have been opened through our BingX link. Your UID is the number in your BingX account menu.\n'
    + '        <div class="wd-row"><a class="wd-go" data-mpex="BingX" href="' + NEW + '" target="_blank" rel="sponsored noopener noreferrer">Create your BingX account &rarr;</a><a class="wd-alt" href="https://marginpad.io/rewards/#" onclick="return !(window.__mpOpenSupport&amp;&amp;window.__mpOpenSupport());">Already have one? Ask support</a></div></div>\n      ';
  r = r.slice(0, nI) + NOTE + r.slice(nI);

  const ROW = "    { k: 'bitget', btn: 'wdmBitget',";
  const rowI = r.indexOf(ROW);
  if (rowI < 0) throw new Error('the Bitget WD_METHODS row was not found');
  const NEWROW = "    { k: 'bingx', btn: 'wdmBingx', note: 'wdNoteBingx', mode: 'numeric', re: /^[0-9]{5,15}$/, prefix: 'bingx:', check: 'bingxcheck', ph: 'Your BingX UID (numbers only)', bad: 'Enter your BingX UID (numbers only).' },\n";
  r = r.slice(0, rowI) + NEWROW + r.slice(rowI);
  if (!DRY) { fs.writeFileSync(R + '.tmp', r); fs.renameSync(R + '.tmp', R); }
  wd = 1;
  console.log('  dist/rewards/index.html: BingX payout method (button, note, WD_METHODS row)');
} else console.log('  dist/rewards/index.html: BingX payout method already there');

if (!linked && !wd) { console.log('fix-bingx-partner: nothing to do (' + already + ' files already on the new link)'); process.exit(0); }
console.log('fix-bingx-partner: ' + linked + ' file(s) relinked' + (wd ? ' + the payout method' : '') + (DRY ? '  --dry, nothing written' : ''));
if (!DRY) {
  // the page's inline script must still parse, and no file may keep the retired campaign link
  const left = FILES.concat(['dist/rewards/index.html']).filter(f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8').indexOf('bingxdao') >= 0; } catch (e) { return false; } });
  if (left.length) throw new Error('the old link survived in: ' + left.join(', '));
  console.log('  NEXT: node build/es/check-inline-js.js && node build/bump-home-assets.js && npm run deploy');
}
