/* Lean Sentry error reporter for MarginPad — no SDK (~1.5KB), sends JS errors + unhandled
   rejections straight to the Sentry envelope endpoint. Same noise filter as the /api/track
   beacon; rate-limited per page load so a loop can't flood. Full SDK avoided on purpose (perf). */
(function () {
  // safety net for ancient WebKit (health tab showed "querySelectorAll(...).forEach is not a function" crashes):
  // NodeList.forEach shipped ~2016 but some in-app browsers still lack it. This file loads first on every page.
  try { if (window.NodeList && !NodeList.prototype.forEach) NodeList.prototype.forEach = Array.prototype.forEach; } catch (e) {}
  var KEY = 'c13516c9f6d90ffb20d7221e089a2d35';
  var HOST = 'o4511677157015552.ingest.de.sentry.io';
  var PROJ = '4511677162717264';
  var DSN = 'https://' + KEY + '@' + HOST + '/' + PROJ;
  var URL = 'https://' + HOST + '/api/' + PROJ + '/envelope/?sentry_key=' + KEY + '&sentry_version=7';
  // ignore noise that isn't our code breaking (browser extensions, autofill, transient network) — mirrors the site's error beacon
  var IGN = /_AutofillCallbackHandler|ResizeObserver loop|Non-Error promise rejection|Failed to fetch|Load failed|NetworkError|AbortError|The operation was aborted|^Script error\.?$|view transition|Transition was skipped|Transition was aborted|skipTransition|zaloJSV2|_DumpException|VerifyBeacon|Java exception|globalThis|variable: fetch|window.webkit|^Rejected$|MetaMask|^.{1,3}$/i;
  var sent = 0, seen = {};
  function hex() { try { return crypto.randomUUID().replace(/-/g, ''); } catch (e) {} var s = ''; for (var i = 0; i < 32; i++) s += (Math.floor(Math.random() * 16)).toString(16); return s; }
  function send(type, value, stack) {
    if (!value || IGN.test(value)) return;
    if (sent >= 12) return;                        // cap per page load
    var k = (type + '|' + value).slice(0, 160); if (seen[k]) return; seen[k] = 1; sent++;
    try {
      var id = hex(), now = new Date().toISOString();
      var ev = {
        event_id: id, timestamp: Date.now() / 1000, platform: 'javascript', level: 'error',
        environment: 'production', logger: 'browser',
        request: { url: location.href, headers: { 'User-Agent': navigator.userAgent } },
        exception: { values: [{ type: String(type || 'Error').slice(0, 80), value: String(value).slice(0, 500) }] },
        tags: { path: location.pathname.slice(0, 80) },
        extra: { stack: String(stack || '').slice(0, 4000), referrer: document.referrer || '' }
      };
      var body = JSON.stringify({ event_id: id, sent_at: now, dsn: DSN }) + '\n{"type":"event"}\n' + JSON.stringify(ev);
      if (navigator.sendBeacon) { navigator.sendBeacon(URL, body); }
      else { fetch(URL, { method: 'POST', body: body, keepalive: true, mode: 'no-cors' }).catch(function () {}); }
    } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    if (e && e.error) send(e.error.name || 'Error', e.error.message || String(e.message || ''), e.error.stack || '');
    else if (e && e.message) send('Error', String(e.message), (e.filename || '') + ':' + (e.lineno || '') + ':' + (e.colno || ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    if (r && r.message) send(r.name || 'UnhandledRejection', r.message, r.stack || '');
    else if (r != null) send('UnhandledRejection', String(r), '');
  });
  // let other code report handled errors: window.mpSentry('context', err)
  window.mpSentry = function (ctx, err) { if (err && err.message) send(err.name || 'Error', (ctx ? ctx + ': ' : '') + err.message, err.stack || ''); else send('Error', String(ctx || err || 'error'), ''); };
})();
