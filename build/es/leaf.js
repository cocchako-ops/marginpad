/* Mark catalog items as deliberate leaves (the translation IS the English: brands, tickers, product names).
     node build/es/leaf.js --lang de id1,id2,...   (check.js refuses es===en as "untranslated", so a leaf is recorded here) */
'use strict';
const fs = require('fs'), path = require('path');
const LANG = process.argv[process.argv.indexOf('--lang') + 1], ids = process.argv[process.argv.length - 1].split(',');
const f = path.join(__dirname, '..', 'data', LANG, 'catalog.json'), cat = JSON.parse(fs.readFileSync(f, 'utf8'));
let n = 0;
for (const id of ids) { const it = cat.items[id]; if (!it) { console.log('no id', id); continue; } it[LANG] = it.en; it.leaf = true; n++; }
const tmp = f + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(cat, null, 1)); fs.renameSync(tmp, f);
console.log(LANG, 'leaves', n);
