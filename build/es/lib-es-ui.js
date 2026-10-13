/* ONE INJECTOR FOR THE SPANISH TABLE TAGS, used from two entry points (2026-10-13).
   gen-pages.js calls it on a twin it is about to write; add-es-ui-tags.js calls it on twins already on disk
   (hand-made force-added ones, and any twin whose English source is build output that is not in the repo).
   Two callers, one function, so a page written by either route carries exactly the same tags.

   The tag goes immediately BEFORE the bundle's own, carries the bundle's OWN query string (one ?v= covers the
   pair - bump-home-assets.js hashes bundle+sidecar together), and copies `defer` from the bundle tag so a
   deferred pair still runs in document order.
   IT REFUSES RATHER THAN GUESSING: an `async` bundle tag cannot be ordered against its sidecar, so it is
   reported and the caller fails instead of quietly shipping a half-translated page. */
'use strict';
const fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const ES_UI_DIR = path.join(DIST, 'assets', 'es');

const SIDECARS = new Set(fs.existsSync(ES_UI_DIR) ? fs.readdirSync(ES_UI_DIR).filter(f => f.endsWith('.js')) : []);
const RE_BUNDLE_TAG = /<script\b([^>]*)\bsrc="\/assets\/(es\/)?([A-Za-z0-9._-]+\.js)((?:\?[^"]*)?)"([^>]*)>/g;

// html -> { html, added, problems[] }. Idempotent: a file that already has the tag is returned unchanged.
function esUiTags(html, where) {
  const problems = [];
  if (!SIDECARS.size) return { html, added: 0, problems: [where + ': dist/assets/es is empty - run build/es/split-bundle-dicts.js'] };
  const have = new Set();                                        // sidecars the page already loads
  let m;
  RE_BUNDLE_TAG.lastIndex = 0;
  while ((m = RE_BUNDLE_TAG.exec(html))) if (m[2]) have.add(m[3]);

  let out = '', at = 0, added = 0;
  const done = new Set();
  RE_BUNDLE_TAG.lastIndex = 0;
  while ((m = RE_BUNDLE_TAG.exec(html))) {
    const [, pre, isEs, file, query, post] = m;
    if (isEs || !SIDECARS.has(file) || have.has(file) || done.has(file)) continue;
    const attrs = (pre || '') + ' ' + (post || '');
    if (/\basync\b/.test(attrs)) { problems.push(where + ': <script async src="/assets/' + file + '"> - a sidecar cannot be ordered against an async bundle'); continue; }
    done.add(file);
    out += html.slice(at, m.index) + '<script' + (/\bdefer\b/.test(attrs) ? ' defer' : '') + ' src="/assets/es/' + file + query + '"></script>';
    at = m.index;
    added++;
  }
  return { html: out + html.slice(at), added, problems };
}

const isEsPage = (html) => /<html[^>]*\blang="es"/.test(html);

/* THE GENERATED CODE LIVES HERE AND NOWHERE ELSE: split-bundle-dicts.js wrote the first copy and
   i18n-bundle.js --apply writes every one after it, so two copies of this template would drift the first time
   a translation round ran. The shape itself is argued for in split-bundle-dicts.js's header. */
/* KEEP THIS GENERATED BLOCK SHORT. It is repeated in ten bundles that ship to every reader, so a paragraph here
   is a paragraph ten times over the wire: the first draft's ten-line rationale cost about 400 bytes brotli PER
   BUNDLE and made the split a net loss on mp-calc and mp-profile, whose tables are small. The reasoning lives
   in build/es/split-bundle-dicts.js and in CLAUDE.md, where it costs a reader nothing. */
function headFor(slug, bundle, keys) {
  return '/* Spanish table: assets/es/' + bundle + ' (window.__esUI.' + slug + ', ' + keys + ' keys), loaded by the /es/\n'
    + '   twins only - it used to be inline, which shipped it to English readers too. Read at CALL time: the two\n'
    + '   files are independent and neither may depend on which parsed first. Why, and the guards, in\n'
    + '   build/es/split-bundle-dicts.js. */\n'
    + 'var __esS_' + slug + ' = (document.documentElement.lang || "").slice(0, 2).toLowerCase() === "es";\n'
    + 'function __esT_' + slug + '(k, en) {\n'
    + '  try {\n'
    + '    if ((document.documentElement.lang || "").slice(0, 2).toLowerCase() !== "es") return en;\n'
    + '    var d = window.__esUI && window.__esUI.' + slug + ';\n'
    + '    if (d) return d[k] != null ? d[k] : en;\n'
    + '    __esUIMiss(' + JSON.stringify(bundle) + ', ' + JSON.stringify(slug) + ', __esS_' + slug + ');\n'
    + '  } catch (e) {}\n'
    + '  return en;\n'
    + '}\n'
    /* The reporter. Declared by every bundle that needs it (identical bodies, last declaration wins, state on
       window so the first report is the only one) - it CANNOT live in the sidecar, which is gone exactly when
       it is needed. It repairs first and reports only what really failed: a dynamically loaded bundle can beat
       its own table by a few milliseconds, and a detector that pages on that gap is one nobody reads. */
    + 'function __esUIMiss(bundle, slug, served) {\n'
    + '  /* missing table: fetch it, then speak only if THAT failed. window.__esUIMissed is the read path. */\n'
    + '  try {\n'
    + '    var S = window.__esUIMissed || (window.__esUIMissed = {});\n'
    + '    if (S[bundle]) return; S[bundle] = served ? "served" : "switched";\n'
    + '    var t = document.querySelector(\'script[src*="/assets/\' + bundle + \'?v="]\'), v = "";\n'
    + '    if (t) { var m = /\\?v=([a-f0-9]+)/.exec(t.src || ""); if (m) v = "?v=" + m[1]; }\n'
    + '    var fail = function (why) {\n'
    + '      S[bundle] = why;\n'
    + '      if (!served) return;\n'
    + '      if (window.console && console.warn) console.warn("[es] page served as Spanish, /assets/es/" + bundle + " " + why + " - " + bundle + " fell back to English");\n'
    + '      if (window.mpSentry) window.mpSentry("es-ui", new Error("es sidecar " + why + ": " + bundle));\n'
    + '    };\n'
    + '    var s = document.createElement("script");\n'
    + '    s.src = "/assets/es/" + bundle + v; s.async = false;\n'
    + '    s.onerror = function () { fail("did not load"); };\n'
    + '    s.onload = function () { if (!(window.__esUI && window.__esUI[slug])) fail("loaded without its table"); };\n'
    + '    document.head.appendChild(s);\n'
    + '  } catch (e) {}\n'
    + '}\n';
}

function sidecarFor(slug, bundle, dict) {
  return '/* Spanish strings for assets/' + bundle + ' - ' + Object.keys(dict).length + ' keys. LOADED ONLY BY THE\n'
    + '   /es/ TWINS: build/es/gen-pages.js (and add-es-ui-tags.js) put the tag immediately before the bundle\'s\n'
    + '   own, and the bundle\'s dynamic loaders pull this file alongside it. An English page loads neither,\n'
    + '   which is the whole point.\n'
    + '   Generated - do not hand-edit: build/es/i18n-bundle.js --apply writes it, build/es/check-es-ui.js checks it. */\n'
    + 'window.__esUI = window.__esUI || {};\n'
    + 'window.__esUI.' + slug + ' = ' + JSON.stringify(dict) + ';\n';
}

// the table a sidecar already holds ({} when there is no sidecar yet)
function readTable(bundle, slug) {
  const f = path.join(ES_UI_DIR, bundle);
  if (!fs.existsSync(f)) return {};
  const m = /window\.__esUI\.[a-z0-9]+ = (\{[\s\S]*\});/.exec(fs.readFileSync(f, 'utf8'));
  if (!m) throw new Error('dist/assets/es/' + bundle + ' holds no table - refusing to overwrite it blind');
  return JSON.parse(m[1]);
}

module.exports = { esUiTags, isEsPage, SIDECARS, ES_UI_DIR, headFor, sidecarFor, readTable };
