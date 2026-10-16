/* BOARD CARDS WITH LESS EMPTY SPACE (2026-10-16, owner: "poenta je da bude manje praznog prostora na karticama").
   /leaderboards/ (EN + ES twin): the free group's grid was five columns, so the sixth tab (Meme Spot) wrapped to a second row
   and the Gold / Bybit / Moon tabs stretched to 184px beside the hole. Six columns on a desktop, one flex row on a phone, and
   tighter paddings. /season/: the cards carried min-height 156 and generous gaps; the branded pair (Bybit, Moon) ran 207px and
   stretched their row. Idempotent; refuses on a missing anchor. */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
function patch(rel, pairs) {
  const p = path.join(R, rel); let h = fs.readFileSync(p, 'utf8'); let n = 0;
  for (const [a, b] of pairs) { if (h.indexOf(b) >= 0 && h.indexOf(a) < 0) continue; const c = h.split(a).length - 1; if (c !== 1) { console.error(rel + ': anchor x' + c + ': ' + a.slice(0, 60)); process.exit(1); } h = h.split(a).join(b); n++; }
  fs.writeFileSync(p + '.tmp', h); fs.renameSync(p + '.tmp', p); console.log(rel + ': ' + n + ' change(s)');
}
const LB = [
  ['.tg.free{flex:5 1 0;}.tg.gold{flex:1.2 1 0;}.tg.real{flex:2.5 1 0;}', '.tg.free{flex:6 1 0;}.tg.gold{flex:1.1 1 0;}.tg.real{flex:2.3 1 0;} /* six free tabs since 2026-10-16 (Meme Spot) */'],
  ['.tg.free .tgt{grid-template-columns:repeat(5,minmax(0,1fr));}', '.tg.free .tgt{grid-template-columns:repeat(6,minmax(0,1fr));}'],
  ['border-radius:12px;padding:9px 10px 8px;cursor:pointer;min-width:0;', 'border-radius:12px;padding:8px 9px 7px;cursor:pointer;min-width:0;'],
  ['.tab .p{font-family:\'Bricolage Grotesque\',sans-serif;font-weight:800;font-size:16px;letter-spacing:-.02em;color:#fff;margin-top:4px;', '.tab .p{font-family:\'Bricolage Grotesque\',sans-serif;font-weight:800;font-size:16px;letter-spacing:-.02em;color:#fff;margin-top:3px;'],
  ['.tab .l{font:600 10.5px \'Space Mono\',monospace;color:var(--dim);margin-top:5px;', '.tab .l{font:600 10.5px \'Space Mono\',monospace;color:var(--dim);margin-top:4px;'],
  ['    .tab{width:128px;padding:8px 9px 7px;}', '    .tab{width:124px;padding:7px 9px 6px;}\n    .tgt{display:flex;gap:6px;} /* one row of six, never a second line on a phone */'],
];
patch('dist/leaderboards/index.html', LB);
patch('dist/es/leaderboards/index.html', LB);
patch('dist/season/index.html', [
  ['border-radius:18px;padding:14px 14px 13px;cursor:pointer;color:inherit;min-width:0;min-height:156px;display:flex;', 'border-radius:18px;padding:12px 13px 11px;cursor:pointer;color:inherit;min-width:0;min-height:0;display:flex;'],
  ['.bs .big{margin-top:auto;padding-top:10px;', '.bs .big{margin-top:auto;padding-top:7px;'],
  ['.bs .ld{margin-top:9px;', '.bs .ld{margin-top:7px;'],
  ['.bs .logo{height:24px;display:block;color:#fff;margin:6px 0 0}', '.bs .logo{height:22px;display:block;color:#fff;margin:3px 0 0}'],
  ['.bs .tagv{display:inline-block;align-self:flex-start;margin-top:8px;', '.bs .tagv{display:inline-block;align-self:flex-start;margin-top:5px;'],
  ['.bs.bybit .pmeter{position:relative;margin-top:8px;', '.bs.bybit .pmeter{position:relative;margin-top:6px;'],
]);
