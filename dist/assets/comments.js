/* MarginPad blog comments — loads + posts comments for the current /blog/<slug>/ page */
(function () {
  var m = location.pathname.match(/\/blog\/([a-z0-9-]+)\/?$/i);
  if (!m) return;
  var slug = m[1];
  var list = document.getElementById('cmList');
  var form = document.getElementById('cmForm');
  if (!list || !form) return;
  var API = 'https://marginpad.io/api/comments';
  function esc(s) { return String(s).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); }
  function ago(ts) { var s = (Date.now() - ts) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; }
  function render(arr) {
    if (!Array.isArray(arr) || !arr.length) { list.innerHTML = '<p class="cm-none">No comments yet. Be the first to share your take.</p>'; return; }
    list.innerHTML = arr.slice().reverse().map(function (c) {
      return '<div class="cm-item"><div class="cm-meta"><span class="cm-name">' + esc(c.n) + '</span><span class="cm-time">' + ago(c.ts) + '</span></div><p class="cm-text">' + esc(c.t) + '</p></div>';
    }).join('');
  }
  function loadC() { fetch(API + '?post=' + encodeURIComponent(slug)).then(function (r) { return r.json(); }).then(render).catch(function () { }); }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = (document.getElementById('cmName').value || '').trim();
    var text = (document.getElementById('cmText').value || '').trim();
    var hp = (document.getElementById('cmWebsite') || {}).value || '';
    if (text.length < 2) return;
    var btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Posting…'; }
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post: slug, name: name, text: text, website: hp }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (btn) { btn.disabled = false; btn.textContent = 'Post comment'; }
        if (res && res.ok) { document.getElementById('cmText').value = ''; loadC(); }
        else { alert(res && res.error === 'rate' ? 'Too many comments from your connection — please try again later.' : 'Could not post your comment. Please try again.'); }
      }).catch(function () { if (btn) { btn.disabled = false; btn.textContent = 'Post comment'; } });
  });
  loadC();
})();
