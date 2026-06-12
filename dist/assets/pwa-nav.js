/* Keep internal navigation inside the iOS home-screen app.
   Without this, iOS opens every link in Safari (showing the address/search bar)
   instead of keeping you in the full-screen installed app. */
(function () {
  var nav = window.navigator;
  // only act inside an iOS standalone (added-to-home-screen) web app
  if (!('standalone' in nav) || !nav.standalone) return;
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a');
    if (!a) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return; // new tab / downloads: leave alone
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;                     // in-page anchors
    if (/^(mailto:|tel:|sms:|javascript:)/i.test(href)) return;
    if (a.host && a.host !== location.host) return;                  // other domains open in Safari (expected)
    e.preventDefault();
    window.location.href = a.href;                                   // same-window nav stays in the app
  }, false);
})();
