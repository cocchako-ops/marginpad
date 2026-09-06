/* Scroll containment E2E (2026-09-06). Owner: "focus stays on what is open -- the page behind a chat / modal / sheet must not
   scroll while I scroll the window." One listener pair in mp-auth.js (every page) cancels wheel + touch inside any fixed
   window unless a scrollable panel inside it can still move.
   Proven on production, real DOM, real listeners:
     /season/  desktop: page scrolled to y>0; wheel over the CHAT box (opened via the FAB) -> scrollY unchanged; wheel over the
               page -> scrollY moves; the chat message list itself still scrolls (a long-enough list) and a wheel at its edge is
               cancelled; the auth modal (data-auth-open) blocks the page the same way; synthetic touchmove inside the chat is
               defaultPrevented, outside it is not
     /paper-trade  desktop: the journal drawer (My Trades) and the sign-in modal block; the fixed mobnav / header do NOT block
               (short fixed bars must stay transparent to the wheel)
     phone 390: touchmove inside the chat box is cancelled, on the page it is not
   Run: node build/scroll-contain-e2e.js
*/
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 220) : ''));

async function wheelAt(page, sel, dy) { // real wheel event through the input pipeline, at the element's centre
  const r = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; }, sel);
  if (!r || r.w < 2) return null;
  await page.mouse.move(r.x, r.y); await page.mouse.wheel({ deltaY: dy }); await new Promise(res => setTimeout(res, 250));
  return r;
}
const sy = (page) => page.evaluate(() => Math.round(window.scrollY));
const touchTest = (page, sel) => page.evaluate((s) => { // synthetic single-finger touch: touchstart then touchmove 40px up; dispatchEvent returns false when preventDefault ran
  const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2;
  const mk = (type, yy) => { const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: yy, pageX: x, pageY: yy + window.scrollY }); return new TouchEvent(type, { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true }); };
  el.dispatchEvent(mk('touchstart', y)); const ok = el.dispatchEvent(mk('touchmove', y - 40)); return { prevented: !ok };
}, sel);

(async () => {
  await withBrowser(async (browser) => {
    // ---- /season/ desktop
    const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
    await p.setCacheEnabled(false); await p.setBypassServiceWorker(true); await p.setViewport({ width: 1280, height: 900 });
    await p.goto(ORIGIN + '/season/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await p.waitForFunction('window.__mpContain===1 && document.getElementById("chatFab")', { timeout: 20000 }).catch(() => {});
    chk('containment installed on /season/ (mp-auth.js) and the chat FAB is there', await p.evaluate(() => window.__mpContain === 1 && !!document.getElementById('chatFab')));
    await p.evaluate(() => window.scrollTo(0, 700)); await new Promise(r => setTimeout(r, 200));
    const y0 = await sy(p);
    await wheelAt(p, 'main, .wrap', 300); const y1 = await sy(p);
    chk('baseline: a wheel over the page scrolls it', y1 > y0, { y0, y1 });
    await p.click('#chatFab'); await p.waitForFunction("(function(){var b=document.getElementById('chatBox');return b&&b.getBoundingClientRect().height>200&&getComputedStyle(b).visibility!=='hidden';})()", { timeout: 20000 }).catch(() => {});
    const chatOpen = await p.evaluate(() => { const b = document.getElementById('chatBox'); if (!b) return null; const r = b.getBoundingClientRect(); return { h: Math.round(r.height), pos: getComputedStyle(b).position, msgs: document.querySelectorAll('#chatBox [class*="msg"]').length }; });
    chk('chat box opened: fixed, tall', chatOpen && chatOpen.pos === 'fixed' && chatOpen.h > 200, chatOpen);
    const y2 = await sy(p);
    const rc = await wheelAt(p, '#chatBox', 400); const y3 = await sy(p);
    await wheelAt(p, '#chatBox', -400); const y4 = await sy(p);
    chk('wheel down and up over the OPEN CHAT never moves the page', rc && y3 === y2 && y4 === y2, { y2, y3, y4 });
    const listInfo = await p.evaluate(() => { const b = document.getElementById('chatBox'); const sc = Array.from(b.querySelectorAll('*')).filter(el => { const cs = getComputedStyle(el); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1; })[0]; if (!sc) return { none: true }; sc.scrollTop = 0; const top = window.mpScrollBlocks(sc, -100), mid = window.mpScrollBlocks(sc, 100); sc.scrollTop = sc.scrollHeight; const bot = window.mpScrollBlocks(sc, 100), up = window.mpScrollBlocks(sc, -100); return { top, mid, bot, up, cls: sc.className }; });
    chk('the chat message list still scrolls inside (mid-list wheel allowed) and its edges are cancelled', listInfo.none || (listInfo.top && !listInfo.mid && listInfo.bot && !listInfo.up), listInfo);
    const tIn = await touchTest(p, '#chatBox'), tOut = await touchTest(p, 'h1, .sh h2');
    chk('touchmove inside the chat is defaultPrevented, on the page it is not', tIn && tIn.prevented && tOut && !tOut.prevented, { tIn, tOut });
    await wheelAt(p, '.sh h2', 300); const y5 = await sy(p);
    chk('with the chat open, a wheel over the page itself still scrolls the page', y5 > y2, { y2, y5 });
    // auth modal
    await p.evaluate(() => { const a = document.querySelector('[data-auth-open]'); if (a) a.click(); });
    await p.waitForFunction("(function(){var m=document.querySelector('.mpa-modal');return m&&m.getBoundingClientRect().height>200;})()", { timeout: 10000 }).catch(() => {});
    const y6 = await sy(p); const ra = await wheelAt(p, '.mpa-modal', 500); const y7 = await sy(p);
    chk('sign-in modal open: wheel over it never moves the page', ra && y7 === y6, { y6, y7, ra });
    const shorts = await p.evaluate(() => Array.from(document.querySelectorAll('*')).filter(el => getComputedStyle(el).position === 'fixed' && el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 120 && el.getBoundingClientRect().width > 100).map(el => ({ id: el.id || el.className.toString().slice(0, 30), h: Math.round(el.getBoundingClientRect().height), blocks: !!window.mpScrollBlocks(el, 100) })).slice(0, 8));
    chk('short fixed bars (nav, toast, banner) never block the wheel', shorts.every(s => !s.blocks), shorts);
    await ctx.close();

    // ---- /paper-trade desktop: journal drawer
    const ctx2 = await browser.createBrowserContext(); const p2 = await ctx2.newPage();
    await p2.setCacheEnabled(false); await p2.setBypassServiceWorker(true); await p2.setViewport({ width: 1280, height: 900 });
    await p2.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await p2.waitForFunction('window.__mpContain===1 && typeof window.mpOpenTrades==="function"', { timeout: 30000 }).catch(() => {});
    await p2.evaluate(() => window.scrollTo(0, 400)); await new Promise(r => setTimeout(r, 200));
    const opened = await p2.evaluate(() => { if (window.mpOpenTrades) { window.mpOpenTrades(); return true; } return false; });
    await p2.waitForFunction("(function(){var d=document.querySelector('.jr-drawer');return d&&d.getBoundingClientRect().width>200&&getComputedStyle(d).position==='fixed';})()", { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 600)); // let the open transition and the journal render settle before reading scrollY
    const drawer = await p2.evaluate(() => { const d = document.querySelector('.jr-drawer'); if (!d) return null; const r = d.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { w: Math.round(r.width), h: Math.round(r.height), hitInside: !!(el && d.contains(el)), blocks: !!(el && window.mpScrollBlocks(el, 300)) }; });
    chk('/paper-trade: My Trades drawer opened (fixed, tall, the centre hit is inside it) and the containment claims it', opened && drawer && drawer.w > 200 && drawer.hitInside && drawer.blocks, { opened, drawer });
    const d0 = await sy(p2); const rd = await wheelAt(p2, '.jr-drawer', 500); const d1 = await sy(p2);
    chk('/paper-trade: wheel over the open drawer never moves the page', rd && d1 === d0, { d0, d1, rd });
    await ctx2.close();

    // ---- phone 390: chat touch
    const ctx3 = await browser.createBrowserContext(); const p3 = await ctx3.newPage();
    await p3.setCacheEnabled(false); await p3.setBypassServiceWorker(true); await p3.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await p3.goto(ORIGIN + '/season/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await p3.waitForFunction('window.__mpContain===1 && document.getElementById("chatFab")', { timeout: 20000 }).catch(() => {});
    await p3.evaluate(() => { document.getElementById('chatFab').click(); });
    await p3.waitForFunction("(function(){var b=document.getElementById('chatBox');return b&&b.getBoundingClientRect().height>200;})()", { timeout: 20000 }).catch(() => {});
    const mIn = await touchTest(p3, '#chatBox'), mOut = await touchTest(p3, '.sh h2');
    chk('phone: touchmove inside the open chat is cancelled, on the page it is not', mIn && mIn.prevented && mOut && !mOut.prevented, { mIn, mOut });
    await ctx3.close();
  });
  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})();
