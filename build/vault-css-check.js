/* Vault catalogue vs CSS (2026-09-05).
   Every cosmetic in VAULT_ITEMS is styled by hand-written CSS that lives in more than one file, and nothing
   fails when a rule is missing: the shop happily sells the item and the buyer gets a card that looks exactly
   like the free one. This walks the catalogue and asserts a rule exists in EVERY file that kind lives in.

   Where each kind is styled (verified 2026-09-05):
     frames  frame-<id>   -> dist/assets/mp-auth.js   (loaded on every page; styles the card AND the swatch)
     bgs     bg-<id>      -> dist/assets/mp-auth.js   (same reason; the copies that used to sit in home.css /
                            mp-trade.css / the vault page were redundant and were removed 2026-09-05)
     tickets tsk-<id>     -> home.css, mp-trade.css, dist/vault/index.html   (genuinely three: the journal card
                            renders from home.js and from mp-trade.js, and the vault preview is its own page)
   Consumables have no CSS; they must instead carry a `grant` that _applyConsumable understands.

   Run: node build/vault-css-check.js     (exit 1 on any gap)
*/
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(R, p), 'utf8');

const src = read('src/worker.js');
const start = src.indexOf('const VAULT_ITEMS = [');
if (start < 0) { console.error('VAULT_ITEMS not found in src/worker.js'); process.exit(1); }
const end = src.indexOf('\n];', start);
const body = src.slice(start, end);

// Pull id/kind/grant off each catalogue line without evaluating the file.
const items = [];
for (const line of body.split('\n')) {
  const m = line.match(/\{\s*id:\s*'([^']+)'/);
  if (!m) continue;
  const kind = (line.match(/kind:\s*'([a-z]+)'/) || [])[1] || '';
  const grant = (line.match(/grant:\s*\{([^}]*)\}/) || [])[1] || '';
  const priced = /\bticks:\s*\d/.test(line) || /\bcents:\s*\d/.test(line);
  items.push({ id: m[1], kind, grant, priced });
}

const FILES = {};
for (const f of ['dist/assets/mp-auth.js', 'dist/assets/home.css', 'dist/assets/mp-trade.css', 'dist/vault/index.html']) FILES[f] = read(f);

const WHERE = {
  '': { sel: (id) => 'frame-' + id, files: ['dist/assets/mp-auth.js'] },
  't': { sel: (id) => 'tsk-' + id, files: ['dist/assets/home.css', 'dist/assets/mp-trade.css', 'dist/vault/index.html'] },
  'bg': { sel: (id) => 'bg-' + id, files: ['dist/assets/mp-auth.js'] },
};

let bad = 0, checked = 0;
for (const it of items) {
  if (it.kind === 'c') { // supply item: the effect is the data, so the data must be there
    checked++;
    if (!/fz:\s*\d|hrs:\s*\d/.test(it.grant)) { console.log('MISSING GRANT  ' + it.id + '  (consumable with no fz/hrs -> _applyConsumable returns bad)'); bad++; }
    continue;
  }
  const w = WHERE[it.kind];
  if (!w) { console.log('UNKNOWN KIND   ' + it.id + '  kind=' + it.kind); bad++; continue; }
  const sel = w.sel(it.id);
  for (const f of w.files) {
    checked++;
    // "." + selector so frame-void never matches frame-voidsomething
    if (FILES[f].indexOf('.' + sel + '{') < 0 && FILES[f].indexOf('.' + sel + ',') < 0 && FILES[f].indexOf('.' + sel + ':') < 0) {
      console.log((it.priced ? 'MISSING CSS    ' : 'missing css    ') + it.id.padEnd(14) + ' -> ' + f + (it.priced ? '   (this item IS for sale)' : '   (earn-only)'));
      bad++;
    }
  }
}
console.log('\n' + items.length + ' catalogue items, ' + checked + ' checks, ' + bad + ' problem' + (bad === 1 ? '' : 's'));
process.exit(bad ? 1 : 0);
