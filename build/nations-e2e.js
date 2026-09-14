// nations-e2e.js - proof for the NATIONS frames (The Vault, 2026-09-05): catalogue, gallery, previews, picker, try-on.
//   node build/nations-e2e.js   (production; run after `npm run deploy`)
const { withBrowser, newPage } = require('./e2e-browser.js');
const fs = require('fs'), path = require('path');
const BASE = (process.argv.find(a => a.startsWith('--url=')) || '--url=https://marginpad.io').slice(6);
const OUT = path.join(__dirname, 'pt-shots'); fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const fails = [];
function ok(name, cond, detail) { if (cond) { pass++; console.log('  OK   ' + name); } else { fail++; fails.push(name + (detail ? ' - ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } }
const IDS = ['ng', 'pk', 'us', 'in', 'id', 'rs', 'de', 'tr', 'th', 'ir', 'ph', 'za', 'nl', 'ca', 'pl', 'bd', 'gb', 'br', 'vn', 'ua',
  'et', 'ao', 'sg', 'it', 'ma', 'kw', 'al', 'fr', 'lk', 'ke', 'ro', 'jp', 'au', 'qa', 'bw', 'ye', 'np', 'eg', 'mr', 'ee', 'dz', 'ar', 'mx', 'kr', 'gh', 'sa', 'il', 'se', 'cn', 'ge'];
(async () => {
  // 1) catalogue
  const shop = await (await fetch(BASE + '/api/auth/shop?cb=' + Date.now())).json();
  const nat = (shop.items || []).filter(i => i.group === 'nation');
  ok('catalogue: ' + IDS.length + ' nation frames', nat.length === IDS.length, 'n=' + nat.length);
  ok('catalogue: every one $1.99, balance only, tier nation', nat.every(i => i.cents === 199 && !i.ticks && i.tier === 'nation'), JSON.stringify(nat.filter(i => !(i.cents === 199 && !i.ticks)).map(i => i.id)));
  ok('catalogue: ids match the design set', IDS.every(c => nat.some(i => i.id === 'nat_' + c)));
  await withBrowser(async (b) => {
    const p = await newPage(b, {});
    await p.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/vault/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 }); await wait(2500);
    const tab = await p.evaluate(() => { const b = document.querySelector('[data-vtab="nations"]'); if (!b) return false; b.click(); return true; });
    ok('Vault: Nations tab exists and opens', tab); await wait(600);
    const gal = await p.evaluate(() => {
      const sec = document.querySelector('section[data-vsec="nations"]'); const cards = [...document.querySelectorAll('#galNations .fcard')];
      const prev = cards.map(c => c.querySelector('.prev'));
      const ring = prev.map(el => el ? getComputedStyle(el, '::after').backgroundImage : '').filter(v => /gradient/.test(v)).length;
      const emblem = prev.map(el => el ? getComputedStyle(el, '::before').display : 'none').filter(v => v === 'block').length;
      const price = cards.map(c => (c.querySelector('.fnote') || {}).textContent || '').filter(t => /1\.99|OWNED/.test(t)).length;
      const shopHasNat = [...document.querySelectorAll('#galShop .fcard')].some(c => /^nat_/.test(c.getAttribute('data-item') || ''));
      const r = cards[0] && cards[0].getBoundingClientRect();
      return { shown: sec && !sec.hidden, n: cards.length, ring, emblem, price, shopHasNat, firstVisible: !!(r && r.height > 0 && document.elementFromPoint(r.left + r.width / 2, r.top + 30)), ids: cards.slice(0, 3).map(c => c.getAttribute('data-item')) };
    });
    console.log('  gallery', JSON.stringify(gal));
    ok('Vault: ' + IDS.length + ' cards in the Nations gallery, catalogue order', gal.shown && gal.n === IDS.length && gal.ids.join(',') === 'nat_ng,nat_pk,nat_us', JSON.stringify(gal.ids));
    ok('Vault: every preview wears its flag ring (::after gradient)', gal.ring === IDS.length, 'ring=' + gal.ring);
    ok('Vault: an emblem on all but the Union Jack', gal.emblem === IDS.length - 1, 'emblem=' + gal.emblem);
    ok('Vault: $1.99 on every card', gal.price === IDS.length, 'price=' + gal.price);
    ok('Vault: nations stay out of the regular Frames gallery', gal.shopHasNat === false);
    await p.screenshot({ path: path.join(OUT, 'nations-vault.png') });
    // 2) frame classes resolve on a real trader card (mp-auth CSS) on the app shell too
    await p.goto(BASE + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 }); await wait(2000);
    const css = await p.evaluate((ids) => { const d = document.createElement('div'); d.className = 'lbm-card frame-nat_rs'; d.style.cssText = 'position:absolute;left:-9999px;width:300px;height:80px'; document.body.appendChild(d); const cs = getComputedStyle(d, '::after'); const out = { ring: /gradient/.test(cs.backgroundImage), pad: cs.paddingTop, emblem: getComputedStyle(d, '::before').display, glow: /rgba/.test(getComputedStyle(d).boxShadow) }; d.remove(); const miss = ids.filter(c => { const e = document.createElement('div'); e.className = 'lbm-card frame-nat_' + c; document.body.appendChild(e); const bad = !/gradient/.test(getComputedStyle(e, '::after').backgroundImage); e.remove(); return bad; }); out.missing = miss; return out; }, IDS);
    ok('app shell: nation ring + emblem + halo resolve from mp-auth CSS', css.ring && css.pad === '3px' && css.emblem === 'block' && css.glow && css.missing.length === 0, JSON.stringify(css));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await p.close();
  });
  console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + ' ok, ' + fail + ' failed');
  if (fails.length) console.log(fails.map(f => ' - ' + f).join('\n'));
  process.exit(fail ? 1 : 0);
})();
