/* Validate translated chunks and merge them into the catalog.
   node build/es/check.js            → report per chunk (no write)
   node build/es/check.js --merge    → merge every VALID item into catalog.json (invalid ones stay untranslated)
   node build/es/check.js --redo     → rewrite each chunk with only its invalid/empty items (for a second pass)   */
'use strict';
const fs = require('fs'), path = require('path');
const { tagSig } = require('./lib');
const DATA = path.join(__dirname, '..', '..', 'build', 'data', 'es');
const CAT = path.join(DATA, 'catalog.json'), CH = path.join(DATA, 'chunks');

const KEEP_EN = /^(MarginPad|Paper Trade|The Vault|Rekt|The Gold Room|Demo Spot|Premium|Founder|Ticks|XP|Bot API|MCP|Daily Wrap|Happy Hour|Moon|Trading Report|Blog|Bybit|Binance|OKX|Gate|Bitget|MEXC|KuCoin|Kraken|Hyperliquid|Coinbase|Long|Short|Swap|Screener|Heatmap|Spot|Rekt Feed|API|SDK|Webhooks?|Beta|Pro|Live|OK|Telegram|X|TradingView|Coinglass|Bitcoin|Ethereum|Solana|USDT|USDC|Total|Max|Min|BTC|ETH|SOL|PnL|ROE|ROI|OI|DCA|APR|APY|Funding|Maker|Taker|Spread|Stop-loss|Take-profit|Trailing stop|Drawdown|Backtest|Wallet|Trader|Trading|Multiplier|Global|Premium Chat|Season Pass|Pro Pass|Hyperliquid whales|Menu|No|Off|On|Auto)$/i;
// English function words that should not survive in Spanish running text (word boundary, case-insensitive)
const EN_WORDS = /\b(the|and|with|your|you|for|from|this|that|are|is|when|how|what|which|before|after|price|position|margin|leverage|liquidation|calculator|free|trade|trades|open|close|about|more|every|each|without|only|also|because|between|market|order|orders)\b/i;
const ES_HINT = /[áéíóúñ¿¡]|\b(el|la|los|las|de|del|un|una|que|con|para|por|sin|tu|tus|se|es|en|al|más|cómo|qué|precio|posición|margen|apalancamiento|liquidación|calculadora|gratis|operación|operaciones|abrir|cerrar|sobre|cada|solo|también|porque|entre|mercado|orden|órdenes)\b/i;

function placeholders(s) { return (s.match(/\{[a-zA-Z0-9_]+\}|%[sd]|\$\{[^}]+\}/g) || []).sort().join('|'); }
function codeBits(s) { return (s.match(/<code[^>]*>[\s\S]*?<\/code>/g) || []).sort().join('|'); }
function numbers(s) { return (s.match(/\d(?:[\d,.]*\d)?%?|\d+×/g) || []).sort().join('|'); } // a trailing "." or "," after a number is sentence punctuation, not part of it

function validate(it) {
  const en = it.en, es = (it.es || '').trim();
  if (!es) return 'empty';
  if (tagSig(en) !== tagSig(es)) return 'tags';
  if (placeholders(en) !== placeholders(es)) return 'placeholders';
  if (codeBits(en) !== codeBits(es)) return 'code';
  const enTxt = en.replace(/<[^>]+>/g, ' ').replace(/&[#a-z0-9]+;/gi, ' ').trim();
  const esTxt = es.replace(/<[^>]+>/g, ' ').replace(/&[#a-z0-9]+;/gi, ' ').trim();
  const w = enTxt.split(/\s+/).filter(x => x.length > 1).length;
  if (esTxt === enTxt) { if (KEEP_EN.test(enTxt) || w <= 1 || !/[a-z]{3,}/.test(enTxt)) return null; return 'untranslated'; }
  // numbers must survive (allow the translator to drop a duplicate but never invent)
  const nEn = numbers(enTxt), nEs = numbers(esTxt);
  if (nEn !== nEs && w > 2) { const a = nEn.split('|').filter(Boolean), b = new Set(nEs.split('|')); if (a.some(x => !b.has(x))) return 'numbers'; }
  // running text that still reads English
  if (w >= 6) { const enHits = (esTxt.match(new RegExp(EN_WORDS.source, 'gi')) || []).length; const esHits = (esTxt.match(new RegExp(ES_HINT.source, 'gi')) || []).length; if (enHits >= 3 && enHits > esHits) return 'english'; }
  const ratio = esTxt.length / Math.max(1, enTxt.length);
  if (w >= 8 && (ratio < 0.6 || ratio > 2.2)) return 'length';
  return null;
}

function main() {
  const merge = process.argv.includes('--merge'), redo = process.argv.includes('--redo');
  const cat = JSON.parse(fs.readFileSync(CAT, 'utf8'));
  const files = fs.readdirSync(CH).filter(f => /^\d+\.json$/.test(f)).sort();
  let ok = 0, badN = 0; const badKinds = {}; const perChunk = [];
  for (const f of files) {
    let arr; try { arr = JSON.parse(fs.readFileSync(path.join(CH, f), 'utf8')); } catch (e) { perChunk.push(f + ' INVALID JSON'); continue; }
    // sidecars NNN.es.json / NNN.es.1.json … = [{id, es}] written by translators (half the output of rewriting the chunk)
    const base = f.replace(/\.json$/, '');
    for (const sc of fs.readdirSync(CH).filter(x => x.startsWith(base + '.es') && x.endsWith('.json')).sort()) {
      let side; try { side = JSON.parse(fs.readFileSync(path.join(CH, sc), 'utf8')); } catch (e) { perChunk.push(sc + ' INVALID JSON'); continue; }
      const m = new Map(side.map(x => [x.id, x.es])); for (const it of arr) if (m.has(it.id) && m.get(it.id)) it.es = m.get(it.id);
    }
    const bad = [];
    for (const it of arr) {
      const why = validate(it);
      if (why) { bad.push({ id: it.id, why, en: it.en.slice(0, 70), es: (it.es || '').slice(0, 70) }); badKinds[why] = (badKinds[why] || 0) + 1; }
      else if (merge && cat.items[it.id]) { cat.items[it.id].es = it.es.trim(); ok++; }
      else if (!merge) ok++;
    }
    badN += bad.length;
    perChunk.push(f + ': ' + (arr.length - bad.length) + '/' + arr.length + (bad.length ? '  bad: ' + bad.slice(0, 6).map(b => b.why + '(' + b.id + ')').join(' ') : ''));
    if (redo) { for (const sc of fs.readdirSync(CH).filter(x => x.startsWith(base + '.es') && x.endsWith('.json'))) fs.unlinkSync(path.join(CH, sc)); }
    if (redo && bad.length) { const keep = new Set(bad.map(b => b.id)); const rest = arr.filter(it => keep.has(it.id)).map(it => ({ ...it, es: '', why: bad.find(b => b.id === it.id).why })); fs.writeFileSync(path.join(CH, f), JSON.stringify(rest, null, 1)); }
    else if (redo) fs.unlinkSync(path.join(CH, f));
  }
  console.log(perChunk.join('\n'));
  console.log('valid', ok, 'invalid', badN, JSON.stringify(badKinds));
  if (merge) {
    const ids = Object.keys(cat.items); const todo = ids.filter(k => !cat.items[k].es);
    cat.meta.untranslated = todo.length; cat.meta.untranslatedWords = todo.reduce((a, k) => a + cat.items[k].w, 0); cat.meta.merged = new Date().toISOString();
    fs.writeFileSync(CAT + '.tmp', JSON.stringify(cat, null, 1)); fs.renameSync(CAT + '.tmp', CAT);
    console.log('catalog: untranslated', cat.meta.untranslated, 'words', cat.meta.untranslatedWords);
  }
}
main();
