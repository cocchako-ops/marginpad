/* Vault visual proof (2026-09-05). A cosmetic that is priced but renders as a plain card is a paid item that
   shows nothing, and no test catches that from source -- so this opens the live Vault, walks every gallery, and
   screenshots each tab plus a contact sheet of the new drop. Look at the PNGs; that is the point of it.

   Run: node build/vault-shots.js [https://marginpad.io]
   Shots: build/vault-shots/*.png
*/
const fs = require('fs');
const path = require('path');
const { withBrowser, newPage } = require('./e2e-browser');

const BASE = process.argv[2] || 'https://marginpad.io';
const OUT = path.join(__dirname, 'vault-shots');
const TABS = ['frames', 'nations', 'tickets', 'backgrounds', 'supply', 'earned'];
// The CURRENT drop, so the contact sheet shows exactly what is new. Move this with every drop (it is the same list as
// NEW_IDS on the Vault page) — otherwise the sheet keeps proving last month's work and the new items go unlooked-at.
const NEW = {
  frame: ['supernova'],
  bg: ['bg_tape', 'bg_girder', 'bg_smoke', 'bg_vaultdoor', 'bg_packice', 'bg_terrace', 'bg_lava', 'bg_reactor', 'bg_titan', 'bg_stormsea'],
};

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  let fail = 0;
  await withBrowser(async (browser) => {
    const page = await newPage(browser);
    await page.setCacheEnabled(false); // the page is edge-cached HTML; a stale copy silently hides the change under test
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message || e)));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

    await page.goto(BASE + '/vault/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction("document.querySelectorAll('#galShop .fcard').length>0", { timeout: 30000 });

    // Does the catalogue actually carry the new ids, and does each one paint something?
    const report = await page.evaluate(async (NEW) => {
      const out = { missing: [], flat: [], counts: {} };
      // the page keeps its catalogue in an IIFE-local `ST`, so ask the API the same question it asked
      const items = await fetch('/api/auth/shop', { cache: 'no-store' }).then(r => r.json()).then(d => (d && d.items) || []);
      const ids = items.map(i => i.id);
      for (const k in NEW) for (const id of NEW[k]) if (ids.indexOf(id) < 0) out.missing.push(id);
      out.counts.catalogue = items.length;
      // paint probe: put the class on a throwaway node and read what the browser computed
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;left:-9999px;width:120px;height:60px';
      document.body.appendChild(probe);
      const seen = {};
      for (const k in NEW) for (const id of NEW[k]) {
        probe.className = (k === 'frame') ? ('lbm-card frame-' + id) : (k === 'bg') ? ('lbm-card bg-' + id) : ('tprev tsk-' + id);
        const cs = getComputedStyle(probe);
        const after = getComputedStyle(probe, '::after');
        const paints = (cs.backgroundImage && cs.backgroundImage !== 'none') || (cs.boxShadow && cs.boxShadow !== 'none') ||
          (after.backgroundImage && after.backgroundImage !== 'none');
        if (!paints) out.flat.push(id);
        seen[id] = 1;
      }
      probe.remove();
      out.counts.probed = Object.keys(seen).length;
      return out;
    }, NEW);

    // Layering guard (2026-09-05). Frame rings are ::after pseudo-elements carrying z-index 6-7. If the card
    // does not isolate them, or if the hover panel does not outrank them, the ring paints straight across the
    // description and the buy buttons -- which is exactly what shipped and what the owner reported.
    const layer = await page.evaluate(() => {
      const out = { worstRing: 0, hov: 0, isolated: null, fitTop: null, vtabsH: null, offenders: [] };
      const card = document.querySelector('#galShop .fcard');
      out.isolated = card ? (getComputedStyle(card).isolation === 'isolate' || getComputedStyle(card).zIndex !== 'auto') : null;
      out.hov = card ? (parseInt(getComputedStyle(card.querySelector('.fhov')).zIndex, 10) || 0) : 0;
      document.querySelectorAll('#galShop .fcard').forEach(c => {
        const p = c.querySelector('.prev'); if (!p) return;
        const z = Math.max(parseInt(getComputedStyle(p, '::after').zIndex, 10) || 0, parseInt(getComputedStyle(p, '::before').zIndex, 10) || 0);
        if (z > out.worstRing) out.worstRing = z;
        if (z >= out.hov) out.offenders.push(c.getAttribute('data-item') + ':z' + z);
      });
      const vt = document.getElementById('vtabs'), ft = document.getElementById('fit');
      if (vt) out.vtabsH = Math.round(vt.getBoundingClientRect().height);
      if (ft) out.fitTop = parseInt(getComputedStyle(ft).top, 10) || 0;
      return out;
    });
    console.log('layering: hover panel z=' + layer.hov + ', loudest frame ring z=' + layer.worstRing + ', card isolated=' + layer.isolated);
    if (!layer.isolated) { console.log('CARD NOT ISOLATED: .fcard makes no stacking context, frame rings escape into the page'); fail++; }
    if (layer.offenders.length) { console.log('RING OVER HOVER PANEL: ' + layer.offenders.slice(0, 8).join(', ')); fail++; }
    if (layer.fitTop != null && layer.vtabsH != null && layer.fitTop < layer.vtabsH) {
      console.log('FITTING ROOM CLIPPED: sticky top ' + layer.fitTop + 'px but the tabs bar is ' + layer.vtabsH + 'px tall'); fail++;
    }

    if (report.missing.length) { console.log('NOT IN CATALOGUE: ' + report.missing.join(', ')); fail++; }
    if (report.flat.length) { console.log('RENDERS FLAT (no CSS reached the browser): ' + report.flat.join(', ')); fail++; }
    console.log('catalogue ' + report.counts.catalogue + ' items, probed ' + report.counts.probed + ' new ones');

    for (const t of TABS) {
      const ok = await page.evaluate((t) => {
        const b = document.querySelector('[data-vtab="' + t + '"]'); if (!b) return false; b.click(); return true;
      }, t);
      if (!ok) { console.log('tab missing: ' + t); fail++; continue; }
      await new Promise(r => setTimeout(r, 700));
      await page.screenshot({ path: path.join(OUT, 'tab-' + t + '.png'), fullPage: true });
    }

    // contact sheet: every new cosmetic side by side, so one image answers "do they look good"
    await page.evaluate((NEW) => {
      const wrap = document.createElement('div');
      wrap.id = 'mpSheet';
      wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0a0b0d;padding:22px;overflow:auto;display:grid;grid-template-columns:repeat(4,1fr);gap:18px;align-content:start';
      for (const k in NEW) for (const id of NEW[k]) {
        const cell = document.createElement('div');
        const card = document.createElement('div');
        card.className = (k === 'frame') ? ('lbm-card frame-' + id) : (k === 'bg') ? ('lbm-card bg-' + id) : ('tprev tsk-' + id);
        card.style.cssText = 'position:relative;height:86px;border-radius:14px;border:1px solid #232a34;display:flex;align-items:center;justify-content:center;color:#e7ecf2;font:700 13px sans-serif';
        card.textContent = id;
        const cap = document.createElement('div');
        cap.style.cssText = 'margin-top:6px;color:#7c8794;font:600 11px sans-serif';
        cap.textContent = k;
        cell.appendChild(card); cell.appendChild(cap); wrap.appendChild(cell);
      }
      document.body.appendChild(wrap);
    }, NEW);
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT, 'contact-sheet.png'), fullPage: true });

    if (errs.length) { console.log('page errors:\n  ' + errs.slice(0, 8).join('\n  ')); fail++; }
  });
  console.log(fail ? ('\nFAIL (' + fail + ') — shots in build/vault-shots/') : '\nOK — shots in build/vault-shots/');
  process.exit(fail ? 1 : 0);
})();
