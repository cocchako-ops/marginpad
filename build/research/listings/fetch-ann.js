// 2026-11-18: every listing-type announcement the exchanges themselves publish, with the exact publication time.
// Binance (catalog 48 New Cryptocurrency Listing + 161 Delisting), Upbit (trade notices), Bybit (new_crypto + delistings),
// OKX (new listings + delistings). Writes arch/ann.json = [{ex, t(ms), title, cat}].
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'arch', 'ann.json');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const get = async (u, h) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u, { headers: Object.assign({ 'user-agent': 'Mozilla/5.0' }, h || {}) }); if (r.ok) return await r.json(); } catch (e) {} await sleep(1500); } return null; };
(async () => {
  const all = [];
  // Binance
  for (const cat of [48, 161]) {
    for (let p = 1; p < 200; p++) {
      const j = await get('https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=' + cat + '&pageNo=' + p + '&pageSize=50');
      const L = j && j.data && j.data.catalogs && j.data.catalogs[0] && j.data.catalogs[0].articles || [];
      if (!L.length) break; for (const a of L) all.push({ ex: 'binance', t: a.releaseDate, title: a.title, cat });
      process.stdout.write('b' + cat + ':' + p + ' '); await sleep(300);
    }
  }
  // Upbit (KST timestamps in ISO)
  for (let p = 1; p < 400; p++) {
    const j = await get('https://api-manager.upbit.com/api/v1/announcements?os=web&page=' + p + '&per_page=20&category=trade');
    const L = j && j.data && j.data.notices || []; if (!L.length) break;
    for (const a of L) all.push({ ex: 'upbit', t: Date.parse(a.first_listed_at || a.listed_at), title: a.title, cat: 'trade' });
    if (p % 20 === 0) process.stdout.write('u:' + p + ' '); await sleep(250);
  }
  // Bybit
  for (const type of ['new_crypto', 'delistings']) {
    for (let p = 1; p < 300; p++) {
      const j = await get('https://api.bybit.com/v5/announcements/index?locale=en-US&type=' + type + '&limit=50&page=' + p);
      const L = j && j.result && j.result.list || []; if (!L.length) break;
      for (const a of L) all.push({ ex: 'bybit', t: a.publishTime || a.dateTimestamp, title: a.title, cat: type });
      if (p % 10 === 0) process.stdout.write('y' + type[0] + ':' + p + ' '); await sleep(250);
    }
  }
  // OKX
  for (const type of ['announcements-new-listings', 'announcements-delistings']) {
    for (let p = 1; p < 300; p++) {
      const j = await get('https://www.okx.com/api/v5/support/announcements?annType=' + type + '&page=' + p);
      const L = j && j.data && j.data[0] && j.data[0].details || []; if (!L.length) break;
      for (const a of L) all.push({ ex: 'okx', t: +a.pTime, title: a.title, cat: type });
      if (p % 10 === 0) process.stdout.write('o:' + p + ' '); await sleep(300);
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(all));
  const by = {}; for (const a of all) by[a.ex] = (by[a.ex] || 0) + 1;
  console.log('\n', by, 'oldest', Object.fromEntries(Object.keys(by).map(e => [e, new Date(Math.min(...all.filter(a => a.ex === e).map(a => a.t))).toISOString().slice(0, 10)])));
})();
