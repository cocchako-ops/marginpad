/* THE SITE CAN BE SAVED AS AN APP FROM ANY PAGE (2026-10-22, owner: "da bi nas sajt sacuvao kao app na ios iz
   safarija, ja to moram da uradim dok sam na stranici paper trade, inace sacuva kao obicnu stranicu").

   iOS reads the install tags from the page the reader is STANDING ON. Measured before the fix: 583 of 909 pages
   carried the manifest link, 260 an apple-touch-icon and only 210 the apple-mobile-web-app-capable meta - the
   one that decides app or bookmark. So "add to home screen" worked from /paper-trade and produced a plain
   bookmark from everywhere else, including the homepage.

   This walks a page of every SHAPE the site has - the app shell, the bento homepage, a generated SEO page, a
   hand-made page, a blog post and a Spanish twin - because the tags are injected by different generators and
   one shape going missing is exactly how this got scattered in the first place.

   node build/pwa-install-e2e.js                                                                              */
'use strict';
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? '  -> ' + JSON.stringify(d).slice(0, 200) : '')); } };

const PAGES = [
  ['the app shell', '/paper-trade'],
  ['the bento homepage', '/'],
  ['a generated SEO page', '/btc-liquidation-map/'],
  ['a hand-made page', '/rewards/'],
  ['a blog post', '/blog/'],
  ['a Spanish twin', '/es/'],
  ['a calculator', '/100x-liquidation-calculator/'],   // there is no bare /liquidation-calculator/ - they are all leverage-prefixed
];

(async () => {
  for (const [what, url] of PAGES) {
    const h = await fetch(O + url + '?nc=1&cb=' + Date.now()).then(r => r.text());
    const head = h.slice(0, Math.max(0, h.toLowerCase().indexOf('</head>')));
    const has = {
      manifest: /<link[^>]+rel=["']manifest["']/i.test(head),
      capable: /name=["']apple-mobile-web-app-capable["'][^>]*content=["']yes["']/i.test(head),
      title: /name=["']apple-mobile-web-app-title["']/i.test(head),
      icon: /rel=["']apple-touch-icon["']/i.test(head),
    };
    ok(has.manifest && has.capable && has.title && has.icon, what + ' (' + url + ') can be saved as an app', has);
    // never two manifests - the patcher adds only what a page is missing, and that is what keeps it idempotent
    ok((head.match(/rel=["']manifest["']/gi) || []).length === 1, what + ': exactly one manifest link');
    ok(head.indexOf('<meta charset') >= 0 && head.indexOf('<meta charset') < 1024, what + ': charset still inside the 1024-byte prescan');
  }

  /* the manifest itself, and the icons it promises */
  const mf = await fetch(O + '/site.webmanifest?cb=' + Date.now()).then(r => r.json());
  ok(mf.name && mf.short_name === 'MarginPad', 'the manifest names the app', { name: mf.name });
  ok(mf.display === 'standalone', 'and asks for a standalone window');
  const any = (mf.icons || []).filter(i => (i.purpose || 'any').indexOf('any') >= 0);
  const mask = (mf.icons || []).filter(i => (i.purpose || '').indexOf('maskable') >= 0);
  ok(any.length >= 2, 'it offers at least two plain icons', any.map(i => i.sizes));
  /* a maskable icon is CROPPED TO A CIRCLE by Android, so it must not be the same edge-to-edge square - that
     would lose the corners of the mark */
  ok(mask.length === 1 && !any.some(i => i.src === mask[0].src), 'and a maskable icon that is not just the square one again', { mask: mask.map(i => i.src) });

  const PNG = async (p, size) => {
    const r = await fetch(O + p + '?cb=' + Date.now());
    const b = Buffer.from(await r.arrayBuffer());
    const sig = b.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
    const w = b.readUInt32BE(16), hh = b.readUInt32BE(20);
    return { status: r.status, png: sig, w, h: hh, bytes: b.length, size };
  };
  for (const [p, size] of [['/assets/apple-touch-icon.png', 180], ['/assets/icon-192.png', 192], ['/assets/icon-512.png', 512], ['/assets/icon-maskable-512.png', 512]]) {
    const i = await PNG(p, size);
    ok(i.status === 200 && i.png && i.w === size && i.h === size, p + ' is a real ' + size + 'px PNG', i);
  }

  await (async () => {
    // the icon a reader ends up looking at on their home screen - it must be the MP monogram, not the old M
    const r = await fetch(O + '/assets/apple-touch-icon.png?cb=' + Date.now());
    const b = Buffer.from(await r.arrayBuffer());
    ok(b.length > 1000, 'the home-screen icon has real content in it (' + b.length + ' bytes)');
  })();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
