/* THE NINTH BOARD ON /leaderboards/: Meme Spot (2026-10-16, owner: Demo Spot rebuilt as buy & hold with one board,
   "$30 i samo prva 3 dobijaju"). Adds the tab, the board definition (season P&L in USD, worth, trades), the PK/EK keys,
   the "what puts you on it" / empty lines and the Spanish strings - into BOTH files (EN + ES twin, byte-identical script).
   Idempotent; refuses unless every anchor is unique in both files. */
const fs = require('fs');
const path = require('path');
const FILES = ['dist/leaderboards/index.html', 'dist/es/leaderboards/index.html'];
const DRY = process.argv.indexOf('--dry') >= 0;
const ES = {
  memeSpot: 'Meme Spot', memeSub: 'la mayor ganancia de temporada en Demo Spot - compra y mantén memes y majors con $10,000 de dinero demo',
  seasonPnlH: 'P&L de temporada', worthH: 'Valor', memeRule1: 'Puntuado por la <b>ganancia de temporada en dólares</b>: lo que vale tu cartera de Demo Spot ahora menos lo que valía al empezar la temporada de 14 días.',
  memeRule2: 'Todos empiezan con <b>$10,000</b> de dinero demo y reclaman <b>$100</b> más una vez al día. Cada reclamo se descuenta, así que solo las operaciones mueven la tabla.',
  memeRule3: 'Compra y mantén: memes en Solana, Base, Ethereum y BNB Chain, los 250 majors o cualquier token por dirección de contrato - precios en vivo, sin comisiones, sin apalancamiento.',
  memeRule4: 'Los tres primeros cobran <b>$15, $10 y $5</b> en USDT real al terminar la temporada; solo una ganancia positiva cobra. La tabla se recalcula cada diez minutos.',
  buyACoinIn: '<a href="/spot/">Compra una moneda en Demo Spot</a> - una moneda en cartera o una operación esta temporada te pone aquí; la ganancia decide el orden.',
  nobodyYetMeme: 'Todavía nadie tiene ganancia de temporada en Demo Spot - la primera posición en verde llena esta tabla.',
};
let changed = 0;
for (const rel of FILES) {
  const p = path.join(__dirname, '..', rel);
  let h = fs.readFileSync(p, 'utf8');
  if (h.indexOf('data-b="meme"') >= 0) { console.log(rel + ': already'); continue; }
  const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const once = (s, nm) => { const n = h.split(s).length - 1; if (n !== 1) { console.error(rel + ': anchor ' + nm + ' matched ' + n + ' - refusing'); process.exit(1); } };
  // 1. the tab button, after the Daily BTC call tab
  const A_TAB = `<button type="button" class="tab" role="tab" aria-selected="false" data-b="call">`;
  once(A_TAB, 'call tab');
  const tabLineEnd = h.indexOf('</button>', h.indexOf(A_TAB)) + '</button>'.length;
  const TAB = N + `        <button type="button" class="tab" role="tab" aria-selected="false" data-b="meme"><span class="n">Meme Spot</span><span class="p">$30<small>POOL</small></span><span class="l" id="tl-meme">-</span></button>`;
  h = h.slice(0, tabLineEnd) + TAB + h.slice(tabLineEnd);
  // 2. the board definition, right after the call board's
  const A_B = `    gold:{key:'topGold',grp:'gold',name:'The Gold Room',`;
  once(A_B, 'gold board def');
  const BDEF = `    meme:{key:'topMeme',grp:'free',name:T("memeSpot",'Meme Spot'),sub:T("memeSub",'the most season profit in Demo Spot - buy and hold memes and majors with $10,000 of demo cash'),
      head:['#','Trader',T("seasonPnlH",'Season P&L'),T("worthH",'Worth')+'|o',T("tradesH",'Trades')+'|o',T("prizeH",'Prize')],
      row:function(r){var v=+r.pnlUsd||0;return ['<td class="v '+(v>=0?'up':'dn')+'">'+(v>=0?'+':'-')+'$'+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>','<td class="v">$'+int(r.equityUsd)+'</td>','<td class="v">'+int(r.trades||0)+'</td>'];},
      need:'meme',
      rules:[T("memeRule1",'Scored on <b>season profit in dollars</b>: what your Demo Spot portfolio is worth now minus what it was worth when the 14-day season started.'),T("memeRule2",'Everyone starts with <b>$10,000</b> of demo cash and claims <b>$100</b> more once a day. Every claim is subtracted, so only trading moves the board.'),T("memeRule3",'Buy and hold: memes on Solana, Base, Ethereum and BNB Chain, the top 250 majors, or any token by contract address - live prices, no fees, no leverage.'),T("memeRule4",'The top three are paid <b>$15, $10 and $5</b> in real USDT when the season ends; only a positive profit pays. The board is rebuilt every ten minutes.')]},
`;
  h = h.split(A_B).join(BDEF.split('\n').join(N) + A_B);
  // 3. the key maps
  const A_PK = `var PK={roe:'roe',green:'green',winrate:'wr',xp:'xp',gold:'gold',bybit:'bybit',moon:'moon',call:'call'};`;
  const A_EK = `var EK={roe:'top',green:'green',winrate:'wr',xp:'xp',gold:'gold',bybit:'bybit',moon:'moon',call:'call'};`;
  once(A_PK, 'PK'); once(A_EK, 'EK');
  h = h.split(A_PK).join(`var PK={roe:'roe',green:'green',winrate:'wr',xp:'xp',gold:'gold',bybit:'bybit',moon:'moon',call:'call',meme:'meme'};`);
  h = h.split(A_EK).join(`var EK={roe:'top',green:'green',winrate:'wr',xp:'xp',gold:'gold',bybit:'bybit',moon:'moon',call:'call',meme:'meme'};`);
  // 4. what puts you on it, and the empty line
  const A_NEED = `    if(b.need==='call')return T("makeTodaysCall",`;
  once(A_NEED, 'needHtml call');
  h = h.split(A_NEED).join(`    if(b.need==='meme')return T("buyACoinIn",'<a href="/spot/">Buy a coin in Demo Spot</a> - a coin you hold or a trade this season puts you here; profit decides the order.');` + N + A_NEED);
  const A_EMPTY = `    if(CUR==='call')return T("noSettledCallYet",`;
  once(A_EMPTY, 'emptyHtml call');
  h = h.split(A_EMPTY).join(`    if(CUR==='meme')return T("nobodyYetMeme",'Nobody has a season profit in Demo Spot yet - the first green position fills this table.');` + N + A_EMPTY);
  // 5. Spanish strings into the shared dictionary (guard on a VALUE)
  const k = 'var __esD_leaderboardsindex = {';
  once(k, 'ES dict');
  if (h.indexOf(ES.nobodyYetMeme) < 0) h = h.split(k).join(k + Object.keys(ES).map((x) => JSON.stringify(x) + ':' + JSON.stringify(ES[x])).join(',') + ',');
  if (!DRY) fs.writeFileSync(p, h);
  console.log(rel + ': ' + (DRY ? 'would add' : 'added') + ' the Meme Spot tab');
  changed++;
}
console.log(changed + ' file(s)');
