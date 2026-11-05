// Runs every poller in sources-ex.js twice (the diff sources seed on the first call) and prints what each returns and how the rules
// classify the newest rows. node tools/probe-sources-ex.mjs   (from collector/)
import * as SE from '../src/catalyst/sources-ex.js';
import { classify } from '../src/catalyst/rules.js';
const SRC = [['bitget-ann', SE.bitgetAnn], ['kucoin-ann', SE.kucoinAnn], ['coinbase-products', SE.coinbaseProducts], ['kraken-assets', SE.krakenAssets], ['gate-pairs', SE.gatePairs], ['fed-press', SE.fedPress], ['cmc-news', SE.cmcNews], ['tokenearly', SE.tokenearly]];
for (const [name, fn] of SRC) {
  const t0 = Date.now(); let rows = [], err = null;
  try { rows = await fn(); if (/products|assets|pairs/.test(name)) rows = await fn(); } catch (e) { err = String(e.message || e); }
  console.log('\n' + name + ': ' + (err ? 'ERR ' + err : rows.length + ' rows') + ' in ' + (Date.now() - t0) + ' ms');
  for (const r of rows.slice(0, 4)) { const c = classify(r.title, name); console.log('  ' + new Date(r.ts).toISOString().slice(5, 16) + ' [' + c.kind + ' ' + (c.syms.join(',') || '-') + (c.market ? ' ' + c.market : '') + '] ' + r.title.slice(0, 90)); }
}
