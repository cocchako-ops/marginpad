// The live desktop background on the homepage (2026-09-14) - owner: "jel mozemo na desktop-u da
// vratimo onu live pozadinu?"
//
// It had not been removed. The markup, the CSS and the canvas driver were all still there and the
// canvas was still painting - into a bitmap nobody could see, because `body` carries an opaque
// background and `.bgfx` sits at z-index:-1, which in the root stacking context paints BELOW block
// backgrounds. So this suite deliberately does not check that the layer exists or that `display` is
// block: every one of those was true the whole time it was invisible. It checks that nothing paints
// over it, and that it MOVES on a machine with animation effects switched off.
//
//   node build/home-bgfx-e2e.js
const { withBrowser, newPage } = require('./e2e-browser.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 220) : '')); } };
const clear = s => /^(transparent|rgba\(0, 0, 0, 0\))$/.test(String(s || '').trim());

(async () => {
  await withBrowser(async b => {
    // The owner's own machine: animation effects off. Any @keyframes is dead there, so the drift has
    // to come from script - this is the case that matters, so it runs first.
    for (const [w, h, rm, tag] of [[1440, 900, true, 'desktop, animations OFF'], [1440, 900, false, 'desktop'], [390, 840, false, 'phone']]) {
      console.log('\n' + tag);
      const p = await newPage(b);
      await p.setViewport({ width: w, height: h });
      if (rm) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      const errs = [];
      p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
      await p.goto('https://marginpad.io/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 70000 });
      await sleep(2200);

      const a = await p.evaluate(() => {
        const fx = document.querySelector('.bgfx'), cv = document.getElementById('bgline');
        const au = document.querySelector('.au1');
        let lit = 0;
        if (cv && cv.width) { const g = cv.getContext('2d'); const d = g.getImageData(0, 0, cv.width, cv.height).data;
          for (let i = 3; i < d.length; i += 4000) if (d[i] > 0) lit++; }
        return {
          shown: fx ? getComputedStyle(fx).display : 'missing',
          body: getComputedStyle(document.body).backgroundColor,
          html: getComputedStyle(document.documentElement).backgroundColor,
          t: au ? getComputedStyle(au).transform : '',
          anim: au ? getComputedStyle(au).animationName : '',
          lit, cw: cv && cv.width,
        };
      });
      await sleep(2600);
      const later = await p.evaluate(() => {
        const au = document.querySelector('.au1');
        return { t: au ? getComputedStyle(au).transform : '' };
      });

      if (w < 941) {
        ok(a.shown === 'none', 'the background is off on a phone (it is a desktop effect)', a.shown);
        ok(!clear(a.body), 'and the phone keeps its own opaque ground', a.body);
      } else {
        ok(a.shown === 'block', 'the layer is on');
        // THE CHECK THIS SUITE EXISTS FOR
        ok(clear(a.body), 'body does NOT paint over it - the ground lives on html', { body: a.body, html: a.html });
        ok(!clear(a.html), 'and html carries that ground, so the page is not see-through', a.html);
        ok(a.cw > 0 && a.lit > 0, 'the canvas has wireframes on it (' + a.lit + ' lit samples)', a);
        ok(a.t !== later.t, 'the aurora MOVES' + (rm ? ' even with animation effects off' : ''), { before: a.t, after: later.t });
        ok(a.anim === 'none', 'and it moves by script, not @keyframes - which that machine never runs', a.anim);
      }
      ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
      await p.close();
    }
  });
  console.log('\nhome-bgfx-e2e: pass ' + pass + '  fail ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
