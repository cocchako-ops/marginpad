#!/usr/bin/env node
/* THREE THINGS, 2026-10-22 (owner: "tastatura se i dalje ne pojavljuje kad kliknem da kucam u chatu" +
   "da bi nas sajt sacuvao kao app na ios iz safarija, ja to moram da uradim dok sam na stranici paper trade,
   inace sacuva kao obicnu stranicu" + "logo treba da izgleda ovako za ikonicu").

   1. THE KEYBOARD. Not the autofocus after all - that fix was necessary and not sufficient. MEASURED on
      production through the containment layer's own hook: `window.mpScrollBlocks(#ctInput, 2)` answers TRUE,
      so EVERY touchmove on the chat composer is preventDefault()ed. A real thumb moves a pixel or two while
      tapping, that touchmove is cancelled, and on iOS a cancelled touch loses its default action - which is
      the thing that focuses the field and raises the keyboard. The same hook answers FALSE for the trade
      form's input, which is exactly the owner's report: the chat and DMs, never the other fields.
      WHY it answers true: __mpContain finds the fixed #chatBox above the input, looks for a scrollable
      ancestor BETWEEN them, finds none (the composer is a flex row, not a scroller) and so blocks to keep the
      page behind from moving. Correct for a message list, wrong for a text field - a text field's gestures are
      caret placement and selection, and NONE of them is page scroll. So a touch on or inside a form control is
      never contained.

   2. ADD TO HOME SCREEN ONLY WORKED FROM THE APP SHELL. Measured: app/index.html carries the manifest link and
      the three apple-mobile-web-app tags; dist/index.html and every generated page carry NONE of them. iOS
      reads those from the page you are STANDING ON, so saving from anywhere but /paper-trade gave a bookmark
      rather than an app. The block goes on every page, which is also the only way a reader who found us
      through a blog post can install what they are reading.

   3. THE ICON. The home-screen icon was an M with a lime underscore from June; the owner sent the MP monogram.
      Generated from his 400x400 at every size the manifest and iOS ask for, opaque (iOS composites alpha onto
      white and the mark would gain a halo), plus a MASKABLE variant with the mark at 70% - Android crops a
      maskable icon to a circle and the plain one would lose its corners.

   Idempotent, --dry. Refuses rather than guessing.                                                            */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const R = (...p) => path.join(__dirname, '..', ...p);
const done = [];

function lf(s) { return String(s).split('\r\n').join('\n'); }
function crlf(s) { return lf(s).split('\n').join('\r\n'); }
function find(h, m) {
  for (const x of [lf(m), crlf(m)]) { const n = h.split(x).length - 1; if (n === 1) return x; if (n > 1) throw new Error('marker x' + n); }
  return null;
}
function sameEol(s, t) { return s.indexOf('\r\n') >= 0 ? crlf(t) : lf(t); }

/* ---------------------------------------------------------------- 1. the keyboard ---------------------- */
{
  const F = R('dist', 'assets', 'mp-auth.js');
  let h = fs.readFileSync(F, 'utf8');
  const A = '  function block(el, dy) {\n    var top = overlayOf(el); if (!top) return false;';
  const B = [
    "  /* A TEXT FIELD IS NEVER PAGE SCROLL (2026-10-22). Containing a touch that lands on a form control cancels",
    "     the touchmove a real thumb makes while tapping, and on iOS a cancelled touch loses the default action",
    "     that focuses the field and raises the keyboard - so the chat and the DM composer took taps and showed no",
    "     keyboard, while every input outside a fixed overlay was fine. Measured through this file's own hook:",
    "     mpScrollBlocks(#ctInput, 2) was true and mpScrollBlocks(the trade amount, 2) was false. */",
    "  function formish(el) {",
    "    var n = (el && el.nodeType === 1) ? el : (el && el.parentElement);",
    "    for (var i = 0; n && i < 8; n = n.parentElement, i++) {",
    "      var t = (n.tagName || '').toUpperCase();",
    "      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || t === 'BUTTON' || t === 'LABEL' || t === 'A') return true;",
    "      try { if (n.isContentEditable) return true; } catch (e) {}",
    "    }",
    "    return false;",
    "  }",
    "  function block(el, dy) {",
    "    if (formish(el)) return false;              // the field owns this gesture, not the page",
    "    var top = overlayOf(el); if (!top) return false;",
  ].join('\n');
  if (h.indexOf('function formish(el)') < 0) {
    const mk = find(h, A); if (!mk) throw new Error('mp-auth: the containment block() is not where it was');
    h = h.split(mk).join(sameEol(mk, B));
    done.push('mp-auth: a touch on a form control is never contained (the keyboard)');
    if (!DRY) fs.writeFileSync(F, h);
  }
}

/* ---------------------------------------------------------------- 2. add to home screen ---------------- */
/* MEASURED BEFORE WRITING ANY OF THIS, and it changed the shape of the fix: the tags are SCATTERED, not
   absent. 583 pages carry the manifest link, 260 an apple-touch-icon, and only 210 the
   apple-mobile-web-app-capable meta - which is the one iOS actually reads to decide app or bookmark. So a
   page is not skipped because it has one of them; each tag is added only where it is MISSING, which is also
   what keeps this idempotent and stops a page ever ending up with two manifests. */
const WANT = [
  [/<link[^>]+rel=["']manifest["']/i, '<link rel="manifest" href="/site.webmanifest" />'],
  [/name=["']apple-mobile-web-app-capable["']/i, '<meta name="apple-mobile-web-app-capable" content="yes" />'],
  [/name=["']mobile-web-app-capable["']/i, '<meta name="mobile-web-app-capable" content="yes" />'],
  [/name=["']apple-mobile-web-app-title["']/i, '<meta name="apple-mobile-web-app-title" content="MarginPad" />'],
  [/name=["']apple-mobile-web-app-status-bar-style["']/i, '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />'],
  [/rel=["']apple-touch-icon["']/i, '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />'],
];
const NOTE = '<!-- ADD TO HOME SCREEN FROM ANY PAGE (2026-10-22): iOS reads these from the page the reader is STANDING ON, so while only the app shell carried them, saving from anywhere else produced a bookmark rather than an app. -->';

function addPwa(file) {
  let h;
  try { h = fs.readFileSync(file, 'utf8'); } catch (e) { return false; }
  const i = h.toLowerCase().indexOf('</head>');
  if (i < 0) return false;
  const head = h.slice(0, i);
  const add = WANT.filter(([re]) => !re.test(head)).map(x => x[1]);
  if (!add.length) return false;
  const eol = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const block = (head.indexOf('ADD TO HOME SCREEN FROM ANY PAGE') >= 0 ? add : [NOTE].concat(add)).join('\n');
  h = h.slice(0, i) + sameEol(eol, block) + eol + h.slice(i);
  if (!DRY) fs.writeFileSync(file, h);
  return true;
}

let pages = 0;
{
  // the bento homepage is the SOURCE of dist/index.html - patch it, then gen-home-live rewrites the live file
  if (addPwa(R('dist', 'demo-home', 'index.html'))) { done.push('bento homepage source: add to home screen'); }
  const walk = (dir) => {
    let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'assets' && e.name !== 'demo-home') walk(p); continue; }
      if (!/\.html?$/i.test(e.name)) continue;
      if (addPwa(p)) pages++;
    }
  };
  walk(R('dist'));
  if (pages) done.push('add to home screen on ' + pages + ' pages');
}

/* ---------------------------------------------------------------- 3. the icon ---------------------------- */
async function icons() {
  const src = R('Bug - screenshots & videos', 'XZPBDTU0_400x400.jpg');
  if (!fs.existsSync(src)) { console.log('  (icon source not found - skipped)'); return; }
  let sharp; try { sharp = require('sharp'); } catch (e) { console.log('  (sharp not available - icons skipped)'); return; }
  const BG = { r: 0, g: 0, b: 0, alpha: 1 };   // the source is an opaque black tile; iOS composites alpha onto white
  const out = [
    ['apple-touch-icon.png', 180], ['app-icon-180.png', 180],
    ['icon-192.png', 192], ['app-icon-192.png', 192],
    ['icon-512.png', 512], ['app-icon-512.png', 512],
  ];
  for (const [name, px] of out) {
    const buf = await sharp(src).resize(px, px, { fit: 'cover', kernel: 'lanczos3' }).flatten({ background: BG }).png({ compressionLevel: 9 }).toBuffer();
    if (!DRY) fs.writeFileSync(R('dist', 'assets', name), buf);
  }
  /* MASKABLE: Android crops to a circle, so the mark sits at 70% on its own ground rather than edge to edge */
  const inner = Math.round(512 * 0.7);
  const mark = await sharp(src).resize(inner, inner, { fit: 'cover', kernel: 'lanczos3' }).toBuffer();
  const mask = await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
    .composite([{ input: mark, top: Math.round((512 - inner) / 2), left: Math.round((512 - inner) / 2) }])
    .png({ compressionLevel: 9 }).toBuffer();
  if (!DRY) fs.writeFileSync(R('dist', 'assets', 'icon-maskable-512.png'), mask);
  done.push('icons regenerated from the MP monogram (6 sizes + a maskable)');

  // the manifest points the maskable purpose at the padded one
  const MF = R('dist', 'site.webmanifest');
  let m = JSON.parse(fs.readFileSync(MF, 'utf8'));
  const had = JSON.stringify(m.icons);
  m.icons = [
    { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/assets/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ];
  if (JSON.stringify(m.icons) !== had) {
    if (!DRY) fs.writeFileSync(MF, JSON.stringify(m, null, 2) + '\n');
    done.push('the manifest has its own maskable icon instead of reusing the square one');
  }
}

icons().then(() => {
  if (!done.length) { console.log('fix-keyboard-pwa-icon: nothing to do (already applied)'); process.exit(0); }
  if (!DRY) {
    const a = fs.readFileSync(R('dist', 'assets', 'mp-auth.js'), 'utf8');
    if ((a.match(/function formish\(el\)/g) || []).length !== 1) throw new Error('formish is not defined exactly once');
    if (a.indexOf('if (formish(el)) return false;') < 0) throw new Error('block() does not consult it');
    const home = fs.readFileSync(R('dist', 'demo-home', 'index.html'), 'utf8');
    if ((home.match(/rel="manifest"/g) || []).length !== 1) throw new Error('the homepage has more than one manifest');
    const shell = fs.readFileSync(R('app', 'index.html'), 'utf8');
    if ((shell.match(/rel="manifest"/g) || []).length !== 1) throw new Error('the app shell gained a second manifest');
  }
  console.log('fix-keyboard-pwa-icon: ' + done.length + ' edits ->\n  - ' + done.join('\n  - '));
  if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
  console.log('  NEXT: node build/gen-home-live.js && node build/add-og-image.js && node build/gen-feed.js && node build/bump-home-assets.js && npm run deploy');
}).catch(e => { console.error(e); process.exit(1); });
