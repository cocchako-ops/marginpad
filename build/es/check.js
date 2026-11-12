/* Validate translated chunks and merge them into the catalog.
   node build/es/check.js            → report per chunk (no write)
   node build/es/check.js --merge    → merge every VALID item into catalog.json (invalid ones stay untranslated)
   node build/es/check.js --redo     → rewrite each chunk with only its invalid/empty items (for a second pass)   */
'use strict';
const fs = require('fs'), path = require('path');
const { tagSig } = require('./lib');
const LI = process.argv.indexOf('--lang'); const LANG = LI > 0 ? process.argv[LI + 1] : 'es'; // --lang pt: validate/merge another twin language (2026-10-29)
const DATA = path.join(__dirname, '..', '..', 'build', 'data', LANG);
const CAT = path.join(DATA, 'catalog.json'), CH = path.join(DATA, 'chunks');

const KEEP_EN = /^(MarginPad|Paper Trade|MP Shop|The Vault|Rekt|The Gold Room|Demo Spot|Meme Spot|Premium|Founder|Ticks|XP|Bot API|MCP|Daily Wrap|Happy Hour|Moon|Trading Report|Blog|Bybit|Binance|OKX|Gate|Bitget|MEXC|KuCoin|Kraken|Hyperliquid|Coinbase|Long|Short|Swap|Screener|Heatmap|Spot|Rekt Feed|API|SDK|Webhooks?|Beta|Pro|Live|OK|Telegram|X|TradingView|Coinglass|Bitcoin|Ethereum|Solana|USDT|USDC|Total|Max|Min|BTC|ETH|SOL|PnL|ROE|ROI|OI|DCA|APR|APY|Funding|Maker|Taker|Spread|Stop-loss|Take-profit|Trailing stop|Drawdown|Backtest|Wallet|Trader|Trading|Multiplier|Global|Premium Chat|Season Pass|Pro Pass|Hyperliquid whales|Cascade Radar|Liquidation Magnet|Market Brain|Market Memory|Big Liquidations \(24h\)|Menu|No|Off|On|Auto)$/i;
// English function words that should not survive in Spanish running text (word boundary, case-insensitive)
const EN_WORDS = /\b(the|and|with|your|you|for|from|this|that|are|is|when|how|what|which|before|after|price|position|margin|leverage|liquidation|calculator|free|trade|trades|open|close|about|more|every|each|without|only|also|because|between|market|order|orders)\b/i;
const PT_HINT = /[ãõçâêôáéíóú]|(o|a|os|as|de|do|da|dos|das|um|uma|que|com|para|por|sem|seu|sua|se|em|ao|mais|como|preço|posição|margem|alavancagem|liquidação|calculadora|grátis|você|não|são|está|cada|quando|onde|aqui|agora|também|entre|sobre|até|todos|todas)/i;
const DE_HINT = /[äöüß]|(der|die|das|und|mit|dein|deine|für|von|bei|nicht|ist|sind|wird|werden|auf|ein|eine|einen|oder|wenn|wie|was|auch|nur|mehr|Preis|Position|Hebel|Liquidation|Rechner|kostenlos|Gebühr|Gebühren|Börse|Margin|Konto|jetzt|hier|ohne)/i;
const _LT = require('../i18n/langs.js').LANGS[LANG] || {};
// Indonesian's code is "id", the same word as the segment's id field: in its chunks the seeder overwrote the id with the empty
// translation slot, and its sidecars carry the segment id as "key". So the translation is read into TF and the id recovered by text.
const TF = LANG === 'id' ? '_tr' : LANG;
const ES_HINT = LANG === 'pt' ? PT_HINT : LANG === 'de' ? DE_HINT : LANG !== 'es' && _LT.hint ? _LT.hint : /[áéíóúñ¿¡]|\b(el|la|los|las|de|del|un|una|que|con|para|por|sin|tu|tus|se|es|en|al|más|cómo|qué|precio|posición|margen|apalancamiento|liquidación|calculadora|gratis|operación|operaciones|abrir|cerrar|sobre|cada|solo|también|porque|entre|mercado|orden|órdenes)\b/i;

function placeholders(s) { return (s.match(/\{[a-zA-Z0-9_]+\}|%[sd]|\$\{[^}]+\}/g) || []).sort().join('|'); }
function codeBits(s) { return (s.match(/<code[^>]*>[\s\S]*?<\/code>/g) || []).sort().join('|'); }
function numbers(s) { return (s.match(/\d(?:[\d,.]*\d)?%?|\d+×/g) || []).sort().join('|'); } // a trailing "." or "," after a number is sentence punctuation, not part of it

function validate(it) {
  const en = it.en, es = (it[TF] || '').trim();
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
  if (w >= 8 && (_LT.cjk ? (ratio < 0.12 || ratio > 1.6) : (ratio < 0.5 || ratio > 2.4))) return 'length'; // a CJK translation is legitimately far shorter in characters
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
    for (const sc of fs.readdirSync(CH).filter(x => x.startsWith(base + '.' + LANG) && x.endsWith('.json')).sort()) {
      let side; try { side = JSON.parse(fs.readFileSync(path.join(CH, sc), 'utf8')); } catch (e) { perChunk.push(sc + ' INVALID JSON'); continue; }
      if (LANG === 'id') { const byEn = new Map(side.map(x => [x.en, x])); for (const it of arr) { const s = byEn.get(it.en); if (s) { if (!it.id && s.key) it.id = s.key; if (s.id) it[TF] = s.id; } } continue; } // a sidecar may carry an empty key (the chunk's own id slot was blanked by the seeder) - the English is the join, the catalog restores the id below
      const m = new Map(side.map(x => [x.id, x[LANG]])); for (const it of arr) if (m.has(it.id) && m.get(it.id)) it[LANG] = m.get(it.id);
    }
    if (LANG === 'id') for (const it of arr) if (!it.id) { const k = Object.keys(cat.items).find(k => cat.items[k].en === it.en); if (k) it.id = k; }
    const bad = [];
    for (const it of arr) {
      const why = validate(it);
      if (why) { bad.push({ id: it.id, why, en: it.en.slice(0, 70), es: (it[TF] || '').slice(0, 70) }); badKinds[why] = (badKinds[why] || 0) + 1; }
      else if (merge && cat.items[it.id]) { cat.items[it.id][LANG] = it[TF].trim(); ok++; }
      else if (!merge) ok++;
    }
    badN += bad.length;
    perChunk.push(f + ': ' + (arr.length - bad.length) + '/' + arr.length + (bad.length ? '  bad: ' + bad.slice(0, 6).map(b => b.why + '(' + b.id + ')').join(' ') : ''));
    if (redo) { for (const sc of fs.readdirSync(CH).filter(x => x.startsWith(base + '.' + LANG) && x.endsWith('.json'))) fs.unlinkSync(path.join(CH, sc)); }
    if (redo && bad.length) { const keep = new Set(bad.map(b => b.id)); const rest = arr.filter(it => keep.has(it.id)).map(it => ({ ...it, [LANG]: '', why: bad.find(b => b.id === it.id).why })); fs.writeFileSync(path.join(CH, f), JSON.stringify(rest, null, 1)); }
    else if (redo) fs.unlinkSync(path.join(CH, f));
  }
  console.log(perChunk.join('\n'));
  console.log('valid', ok, 'invalid', badN, JSON.stringify(badKinds));
  if (merge) {
    const ids = Object.keys(cat.items); const todo = ids.filter(k => !cat.items[k][LANG]);
    cat.meta.untranslated = todo.length; cat.meta.untranslatedWords = todo.reduce((a, k) => a + cat.items[k].w, 0); cat.meta.merged = new Date().toISOString();
    fs.writeFileSync(CAT + '.tmp', JSON.stringify(cat, null, 1)); fs.renameSync(CAT + '.tmp', CAT);
    console.log('catalog: untranslated', cat.meta.untranslated, 'words', cat.meta.untranslatedWords);
  }
}
main();
