/* THE COPY MARK LEAVES THE TICKET'S HEADER ROW (2026-11-13, owner: "ti tiketi nose oznaku da su copy trade od tog i tog, ali kad
   se to napise, narusavamo formu drugih elemenata").
   MEASURED before (scratchpad/copy-look.js): the `COPY · @name` pill sat in `.pp-h` between LONG/SHORT and the leverage/price -
   the one element that row keeps at a FIXED x on purpose - and pushed it 107px right on a desktop (1105 -> 1212), under the
   chat/share icons, where the price was cut to "$2,"; on a closed ticket the Win pill went under the icons the same way.
   Now the header is exactly what it is on every other ticket, and the attribution is a row of its own directly under it:
   a 12px copy glyph + "Copied from @name", grey, the name a [data-lbu] handle that opens the leader's profile card (mp-nav's
   one delegated listener). The row keeps clear of the actions column through the same padding rule the header uses.
   Five render sites (home.js x3, mp-trade.js x2) - the drawer is duplicated by design and this is how the pair stays identical.
   Idempotent: a bundle that already carries the new row is left alone. --dry prints what it would do. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DRY = process.argv.includes('--dry');
const OLD = `+(e.copy?'<span class="pp-copy" title="'+MT('jCopyT','Mirrored from a trader you copy - counts on no leaderboard')+'">COPY'+(e.copyName?' · @'+esc(e.copyName):'')+'</span>':'')`;
const SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/></svg>';
const NEW = `+(e.copy?'<div class="pp-copy" title="'+MT('jCopyT','Mirrored from a trader you copy - counts on no leaderboard')+'">${SVG}<span>'+MT('jCopyFrom','Copied from')+(e.copyName?' <b data-lbu="'+esc(e.copyName)+'" role="button" tabindex="0">@'+esc(e.copyName)+'</b>':'')+'</span></div>':'')`;
const CSS_OLD_RE = /\.pp-copy\{[^}]*\}\s*\/\*[^*]*\*\//;
const CSS_NEW = `.pp-copy{display:flex;align-items:center;gap:6px;margin:-3px 0 9px;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.04em;color:#8b97a5;white-space:nowrap;min-width:0;}.pp-copy svg{flex:none;color:#6f7b89;}.pp-copy span{min-width:0;overflow:hidden;text-overflow:ellipsis;}.pp-copy b{font-weight:700;color:#c7cdd4;cursor:pointer;}.pp-copy b:hover{color:#fff;text-decoration:underline;}.pp.pp-gold .pp-copy{color:#8a7a52;}.pp.pp-gold .pp-copy b{color:#c2a860;} /* a mirrored trade (paper copy): its OWN row under the header, never inside it (2026-11-13) - MIRROR in the other drawer stylesheet */`;
function patchJs(file, want) {
  const p = path.join(ROOT, 'dist', 'assets', file); let s = fs.readFileSync(p, 'utf8');
  const have = s.split(OLD).length - 1, done = s.split('MT(\'jCopyFrom\',').length - 1;
  if (!have && done === want) { console.log(file + ': already patched (' + done + ' rows)'); return; }
  if (have !== want) throw new Error(file + ': expected ' + want + ' header pills, found ' + have);
  const lines = s.split('\n'); let n = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(OLD) < 0) continue;
    const L = lines[i].split(OLD).join('');
    const end = L.replace(/\r$/, '');
    if (!/<\/div>'\s*$/.test(end)) throw new Error(file + ':' + (i + 1) + ' header line does not end with the closing div');
    lines[i] = end + NEW + (L.endsWith('\r') ? '\r' : ''); n++;
  }
  s = lines.join('\n');
  if (!DRY) fs.writeFileSync(p + '.tmp', s), fs.renameSync(p + '.tmp', p);
  console.log(file + ': ' + n + ' rows moved under the header' + (DRY ? ' (dry)' : ''));
}
function patchCss(file) {
  const p = path.join(ROOT, 'dist', 'assets', file); let s = fs.readFileSync(p, 'utf8');
  if (s.indexOf('its OWN row under the header') >= 0) { console.log(file + ': already patched'); return; }
  if (!CSS_OLD_RE.test(s)) throw new Error(file + ': the old .pp-copy rule was not found');
  s = s.replace(CSS_OLD_RE, function () { return CSS_NEW; }); // function replacement: never a `$` in a replacement string
  // the row keeps clear of the actions column exactly as the header and the pnl row do
  const A = '.pp .pp-h,.pp .pp-pnl{padding-right:44px;}.pp:has(.pp-close) .pp-h,.pp:has(.pp-close) .pp-pnl{padding-right:124px;}';
  const B = '.pp .pp-h,.pp .pp-pnl,.pp .pp-copy{padding-right:44px;}.pp:has(.pp-close) .pp-h,.pp:has(.pp-close) .pp-pnl,.pp:has(.pp-close) .pp-copy{padding-right:124px;}';
  if (s.split(A).length - 1 !== 1) throw new Error(file + ': the actions-column padding rule was not found exactly once');
  s = s.split(A).join(B);
  if (!DRY) fs.writeFileSync(p + '.tmp', s), fs.renameSync(p + '.tmp', p);
  console.log(file + ': rule rewritten' + (DRY ? ' (dry)' : ''));
}
patchJs('home.js', 3); patchJs('mp-trade.js', 2); patchCss('home.css'); patchCss('mp-trade.css');
