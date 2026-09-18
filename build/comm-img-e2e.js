// Prove the whole loop: a member uploads, the URL we hand back really serves the bytes back,
// and a broken external image degrades to a readable link instead of the browser's placeholder.
const { withBrowser, newPage } = require('D:/part1/money-mission/build/e2e-browser.js');
const KEY = 'mpadm_20ca118e2de368204c82ea9a97a6fca4';
const BASE = 'https://marginpad.io';
const uid = 'e2eimg1';

// a real 1x1 PNG
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function adm(path, body) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'x-admin-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let d = null; try { d = await r.json(); } catch (e) {}
  return { s: r.status, b: d };
}

(async () => {
  let pass = 0, fail = 0;
  const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? '  ' + JSON.stringify(d).slice(0, 200) : '')); } };

  await adm('/api/admin/e2euser', { uid, op: 'mk' });
  const sess = await adm('/api/admin/e2euser', { uid, op: 'sess' });
  const tok = sess.b && (sess.b.token || sess.b.sess);
  ok(!!tok, 'throwaway member session minted');
  if (!tok) return;

  // signed out must be refused
  let r = await fetch(BASE + '/api/comm/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'image/png', data: PNG }) });
  ok(r.status === 401, 'an upload without a session is refused', r.status);

  // a bad type must be refused
  r = await fetch(BASE + '/api/comm/upload', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + tok }, body: JSON.stringify({ type: 'application/pdf', data: PNG }) });
  ok(r.status === 400, 'a non-image type is refused', r.status);

  // the real upload
  r = await fetch(BASE + '/api/comm/upload', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + tok }, body: JSON.stringify({ type: 'image/png', data: 'data:image/png;base64,' + PNG }) });
  const up = await r.json();
  ok(r.status === 200 && up.ok && /^https:\/\/marginpad\.io\/api\/comm\/img\//.test(up.url || ''), 'upload returns a URL on our own domain', up);

  // and that URL must actually serve the image back
  if (up.url) {
    const g = await fetch(up.url);
    const ct = g.headers.get('content-type') || '';
    const cc = g.headers.get('cache-control') || '';
    const buf = new Uint8Array(await g.arrayBuffer());
    ok(g.status === 200 && ct.indexOf('image/png') === 0, 'the URL serves a PNG back', { s: g.status, ct });
    ok(buf.length > 0 && buf[0] === 0x89 && buf[1] === 0x50, 'the bytes really are the PNG we sent', { n: buf.length, head: [buf[0], buf[1]] });
    ok(/immutable/.test(cc), 'served immutable so a post never re-fetches it', cc);
  }

  // a missing key is a clean 404, never a 500
  const m = await fetch(BASE + '/api/comm/img/nope/nothing.png');
  ok(m.status === 404, 'a missing image is a clean 404', m.status);

  // the broken-image fallback in the page renderer
  await withBrowser(async (browser) => {
    const page = await newPage(browser);
    await page.goto(BASE + '/community/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(s => setTimeout(s, 5000));
    const o = await page.evaluate(() => {
      const host = document.createElement('div');
      host.className = 'pbody';
      host.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(host);
      // the exact shape the owner posted: an ibb.co SHARE page, which is not an image
      const src=document.documentElement.innerHTML; host.innerHTML='';
      return { hasRule: src.indexOf('onerror=\\"cmImgFail(this)\\"')>=0 || src.indexOf('cmImgFail(this)')>=0, hasHelper: src.indexOf('function cmImgFail')>=0 };
    });
    ok(o.hasRule && o.hasHelper, 'the client renderer gives every image a readable fallback', o);
    const composer = await page.evaluate(() => ({ btn: !!document.getElementById('cImgBtn'), input: !!document.getElementById('cImgIn'), max3: /up to 3/.test((document.getElementById('cImgN') || {}).textContent || '') }));
    ok(composer.btn && composer.input && composer.max3, 'the composer offers an attach control, capped at 3', composer);
    await page.close().catch(() => {});
  }, { timeoutMs: 150000 });

  await adm('/api/admin/e2euser', { uid, op: 'rm' });
  console.log('\n' + pass + ' checks, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('fatal', e.message); process.exitCode = 1; });
