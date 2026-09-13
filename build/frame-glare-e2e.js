/* A frame must never make the profile card unreadable (owner 2026-09-13: "neki okviri previše svetle i ništa se ne
   vidi šta piše"). Opens the real card, wears every frame, and measures the ground luminance under the text: white text
   needs a dark ground. Root cause it guards against: mp-profile.js styles .lbm-card::before as a 3px level-colour bar,
   and a frame that re-boxes ::before (inset:3px;height:auto) inherited that BACKGROUND and stretched it across the whole
   card — leviathan, emperor, magnetar and petrol measured 110 against a 37 baseline.   node build/frame-glare-e2e.js */
// How readable is white text on the profile card under each frame? Screenshot the strip the name sits on, decode it
// back inside Chrome, and report mean/peak luminance. White text needs a dark ground; a frame that lifts the mean is
// the one that makes the card unreadable.
const fs = require('fs');
const { withBrowser, newPage } = require('./e2e-browser.js');
const FRAMES = ['default','supernova','regalia','owner','midas','inferno','dragonfire','cathedral','prism','quicksilver','singularity','sovereign','emperor','ice','sakura','arctic','tungsten','phosphor','koi','circuitry','void','obsidian','ink','leviathan','magnetar','realtrader','glacier','petrol','storm'];
withBrowser(async b => {
  const p = await newPage(b); await p.setCacheEnabled(false);
  await p.setViewport({ width: 900, height: 800 });
  await p.goto('https://marginpad.io/vault/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise(r => setTimeout(r, 2500));
  await p.evaluate(() => { if (window.mpEnsureProfile) window.mpEnsureProfile(function () { if (window.mpOpenProfile) window.mpOpenProfile('chako'); }); });
  await new Promise(r => setTimeout(r, 4000));
  await p.evaluate(() => { const m = document.querySelector('.lbm'); m.style.background = 'transparent'; m.style.backdropFilter = 'none'; });
  const rows = [];
  for (const f of FRAMES) {
    const box = await p.evaluate((f) => {
      const c = document.querySelector('.lbm .lbm-card');
      c.className = 'lbm-card' + (f === 'default' ? '' : ' frame-' + f);
      if (window.mpNovaSweep) window.mpNovaSweep();
      const r = c.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }, f);
    if (!box.w) continue;
    await new Promise(r => setTimeout(r, 240));
    // the band where the username and the level line sit
    const b64 = await p.screenshot({ clip: { x: box.x + 12, y: box.y + Math.round(box.h * 0.30), width: box.w - 24, height: 40 }, encoding: 'base64' });
    const m = await p.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, cv.width, cv.height).data;
      let sum = 0, n = 0, peak = 0, bright = 0;
      for (let i = 0; i < d.length; i += 4) {
        const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        sum += L; n++; if (L > peak) peak = L; if (L > 150) bright++;
      }
      return { mean: +(sum / n).toFixed(1), peak: Math.round(peak), brightPct: +(bright / n * 100).toFixed(1) };
    }, b64);
    rows.push({ f, ...m });
  }
  rows.sort((a, b2) => b2.mean - a.mean);
  let fail = 0, bright = 0;
  const base = rows.find(r => r.f === 'default');
  console.log('ground luminance behind the card text (white text needs this LOW). default =', base.mean);
  console.log('frame'.padEnd(14), 'mean', ' peak', ' %>150');
  rows.forEach(r => { const bad = r.mean > base.mean + 14; if (bad) { fail++; bright++; } console.log((bad ? '  FAIL ' : '  ok   ') + r.f.padEnd(14), String(r.mean).padStart(5), String(r.peak).padStart(5), String(r.brightPct).padStart(6) + (bad ? '   washes the text out' : '')); });

  // ---- the picker: ornament must be sized to the thumbnail and stay inside its tile ----------------------------
  // The frame classes are shared between the profile card and the Vault picker thumbnail (.prev.lbm-card.frame-x),
  // so a fixed-px band sized for a 380x468 card spills over the neighbouring tiles. Every length scales with --fs.
  const pick = await p.evaluate(() => {
    const out = [];
    for (const id of ['regalia', 'supernova']) {
      const c = document.querySelector('.fcard[data-item="' + id + '"]') || document.querySelector('.fcard .prev.frame-' + id + '')?.closest('.fcard');
      if (!c) { out.push({ id, found: false }); continue; }
      c.scrollIntoView({ block: 'center' });
      const prev = c.querySelector('.prev'); if (!prev) { out.push({ id, found: false }); continue; }
      const pad = parseFloat(getComputedStyle(c).paddingTop) || 0;
      const fsv = parseFloat(getComputedStyle(prev).getPropertyValue('--fs')) || 1;
      const reach = Math.abs(parseFloat(getComputedStyle(prev, '::after').inset || getComputedStyle(prev, '::after').top) || 0);
      const outer = getComputedStyle(prev, '::before').content;
      out.push({ id, found: true, fs: fsv, reach: +reach.toFixed(2), pad, outerOff: outer === 'none' });
    }
    return out;
  });
  console.log(String.fromCharCode(10) + 'picker thumbnails:');
  pick.forEach(x => {
    if (!x.found) { fail++; console.log('  FAIL ' + x.id + ': no picker card'); return; }
    const okScale = x.fs < 0.6, okFit = x.reach <= x.pad + 0.5, okOuter = x.outerOff;
    if (!okScale || !okFit || !okOuter) fail++;
    console.log((okScale && okFit && okOuter ? '  ok   ' : '  FAIL ') + x.id.padEnd(11) + ' scale ' + x.fs + ' · band reaches ' + x.reach + 'px into a ' + x.pad + 'px padding' + (okOuter ? ' · outer ring off here' : ' · OUTER RING STILL ON (reads as a stray line)'));
  });
  console.log(String.fromCharCode(10) + (rows.length - bright) + ' frames readable, ' + bright + ' too bright · ' + (fail - bright) + ' picker problems');
  process.exitCode = fail ? 1 : 0;
});
