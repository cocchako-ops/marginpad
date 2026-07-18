/* Shared trader-profile card + Follow — click any [data-lbu="username"] to open a level-styled profile
   (same card as the homepage leaderboard). Self-contained: injects its own CSS, exposes window.mpOpenProfile.
   Load ONLY on pages that DON'T already have the inline leaderboard handler (e.g. /levels/) to avoid double delegation. */
(function () {
  if (window.mpOpenProfile) return;
  function esc(x) { return String(x).replace(/</g, '&lt;'); }
  function moneyC(x) { x = +x || 0; var s = x < 0 ? '-' : '+', a = Math.abs(x), u = '', d = a; if (a >= 1e9) { d = a / 1e9; u = 'B'; } else if (a >= 1e6) { d = a / 1e6; u = 'M'; } else if (a >= 1e3) { d = a / 1e3; u = 'K'; } var str = u ? (d >= 100 ? Math.round(d) : d.toFixed(1)) + u : (a >= 1 ? Math.round(a).toString() : a.toFixed(2)); return s + '$' + str; }
  function pctC(x) { x = +x || 0; var s = x < 0 ? '-' : '+', a = Math.abs(x), u = '', d = a; if (a >= 1e6) { d = a / 1e6; u = 'M'; } else if (a >= 1e3) { d = a / 1e3; u = 'K'; } var str = u ? (d >= 100 ? Math.round(d) : d.toFixed(1)) + u : Math.round(a).toString(); return s + str + '%'; }
  function signedIn() { return !!(window.mpAuth && window.mpAuth.me && window.mpAuth.me()); }
  function followSet() { try { return JSON.parse(localStorage.getItem('mp_lb_following') || '[]'); } catch (e) { return []; } }
  function setFollowSet(a) { try { localStorage.setItem('mp_lb_following', JSON.stringify(a)); } catch (e) {} }
  var CSS = ''
    + '.lbm{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(4,6,9,.72);opacity:0;transition:opacity .18s}'
    + '.lbm.on{opacity:1}'
    + '.lbm-card{--lc:#c97f4a;position:relative;width:100%;max-width:380px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01)),#0c1017;border:1px solid var(--lc);border-radius:18px;padding:20px 20px 18px;box-shadow:0 30px 80px -30px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.03),0 0 46px -22px var(--lc);transform:translateY(10px) scale(.98);transition:transform .2s}'
    + '.lbm.on .lbm-card{transform:translateY(0) scale(1)}'
    + '.lbm-card::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;border-radius:18px 18px 0 0;background:linear-gradient(90deg,transparent,var(--lc),transparent);opacity:.9}'
    + '.lbm-x{position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#8b97a5;font-size:13px;cursor:pointer;line-height:1}'
    + '.lbm-x:hover{color:#fff;background:rgba(255,255,255,.1)}'
    + '.lbm-load{padding:34px 10px;text-align:center;color:#8b97a5;font-size:13px}'
    + '.lbm-head{display:flex;align-items:center;gap:13px;margin-bottom:12px}'
    + '.lbm-badge{width:46px;height:46px;flex:none;padding:2px}'
    + '.lbm-name{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:20px;color:#fff;line-height:1.1}'
    + '.lbm-lvl{font:700 11px "Space Mono",monospace;letter-spacing:.04em;text-transform:uppercase;margin-top:3px}'
    + '.lbm-bar{height:5px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden;margin-bottom:15px}'
    + '.lbm-bar i{display:block;height:100%;border-radius:3px}'
    + '.lbm-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-bottom:15px}'
    + '.lbm-s{min-width:0;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:11px;padding:10px 6px;text-align:center;overflow:hidden}'
    + '.lbm-sv{font-family:"Space Mono",monospace;font-weight:700;font-size:14px;color:#fff;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.lbm-sl{font-size:9px;color:#7a8592;text-transform:uppercase;letter-spacing:.03em;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.lbm-foot{display:flex;align-items:center;justify-content:space-between;gap:10px}'
    + '.lbm-fol{font-size:13.5px;color:#c7cdd4;display:flex;align-items:center;gap:7px}.lbm-fol b{color:#fff;font-weight:800;font-size:16px;font-family:"Space Mono",monospace}.lbm-fol svg{color:#8b97a5}'
    + '.lbm-self{font-size:12px;color:#c2f64a;font-weight:700}'
    + '.lbm-follow{background:var(--lc);color:#0a0b0d;border:0;border-radius:10px;padding:9px 18px;font:800 12px "Space Mono",monospace;letter-spacing:.03em;cursor:pointer;transition:filter .15s}'
    + '.lbm-follow:hover{filter:brightness(1.1)}'
    + '.lbm-follow.on{background:transparent;color:var(--lc);border:1px solid var(--lc)}';
  var st = document.createElement('style'); st.textContent = CSS; (document.head || document.documentElement).appendChild(st);
  var modal = null;
  function closeModal() { if (modal) { modal.classList.remove('on'); setTimeout(function () { if (modal && !modal.classList.contains('on')) modal.style.display = 'none'; }, 200); } }
  window.mpCloseProfile = closeModal;
  window.mpOpenProfile = function (name) {
    if (!name) return;
    try { window.__mpTrack && window.__mpTrack('profile', String(name).slice(0, 24)); } catch (e) {}
    if (!modal) { modal = document.createElement('div'); modal.className = 'lbm'; modal.innerHTML = '<div class="lbm-card"><button type="button" class="lbm-x" aria-label="Close">✕</button><div class="lbm-body"></div></div>'; document.body.appendChild(modal); modal.addEventListener('click', function (e) { if (e.target === modal || e.target.closest('.lbm-x')) closeModal(); }); }
    var body = modal.querySelector('.lbm-body'), card = modal.querySelector('.lbm-card');
    body.innerHTML = '<div class="lbm-load">Loading trader…</div>'; card.style.setProperty('--lc', '#c97f4a'); card.className = 'lbm-card';
    modal.style.display = 'flex'; requestAnimationFrame(function () { modal.classList.add('on'); });
    fetch('/api/lb/user?name=' + encodeURIComponent(name)).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.exists) { body.innerHTML = '<div class="lbm-load">No public profile for this trader yet.</div>'; return; }
      var L = d.level || { k: 'bronze', name: 'Bronze', col: '#c97f4a' }, s2 = d.stats || {}, lc = L.col || '#c97f4a';
      card.style.setProperty('--lc', lc); card.className = 'lbm-card lvl-' + (L.k || 'bronze');
      var svg = (window.mpLvlSvg ? window.mpLvlSvg(L.k, lc) : '');
      var me = (window.mpAuth && window.mpAuth.me && window.mpAuth.me()) || null;
      var isSelf = me && (me.username && me.username.toLowerCase() === String(d.name).toLowerCase());
      var following = followSet().map(function (x) { return String(x).toLowerCase(); }).indexOf(String(d.name).toLowerCase()) >= 0;
      function stat(v, l, c) { return '<div class="lbm-s"><div class="lbm-sv"' + (c ? ' style="color:' + c + '"' : '') + '>' + v + '</div><div class="lbm-sl">' + l + '</div></div>'; }
      var mBtn = isSelf ? '<div class="lbm-self">This is you</div>' : (signedIn() ? '<button type="button" class="lbm-follow' + (following ? ' on' : '') + '" data-lbfollow="' + esc(d.name) + '" data-tuid="' + esc(d.uid) + '">' + (following ? '✓ Following' : '+ Follow') + '</button>' : '<button type="button" class="lbm-follow" data-auth-open>Sign in to follow</button>');
      body.innerHTML =
        '<div class="lbm-head"><div class="lbm-badge">' + svg + '</div><div class="lbm-id"><div class="lbm-name">' + esc(d.name) + '</div><div class="lbm-lvl" style="color:' + lc + '">' + esc(L.name || 'Bronze') + (L.next ? ' · ' + (L.pct || 0) + '% to ' + esc(L.next) : ' · max tier') + '</div></div></div>'
        + '<div class="lbm-bar"><i style="width:' + (L.pct || 0) + '%;background:' + lc + '"></i></div>'
        + '<div class="lbm-grid">'
          + stat((s2.trades || 0), 'Trades')
          + stat((s2.winRate || 0) + '%', 'Win rate', s2.winRate >= 50 ? '#34d99a' : '')
          + stat((s2.bestRoe == null ? '—' : pctC(s2.bestRoe)), 'Best ROE', s2.bestRoe > 0 ? '#34d99a' : '')
          + stat((s2.bestPnl == null ? '—' : moneyC(s2.bestPnl)), 'Best trade', s2.bestPnl > 0 ? '#34d99a' : '')
          + stat(moneyC(s2.realized || 0), 'Realized P&L', (s2.realized >= 0 ? '#34d99a' : '#ff6c5c'))
          + stat(moneyC(s2.weekPnl || 0), (s2.weekTrades || 0) + ' trades · wk', (s2.weekPnl >= 0 ? '#34d99a' : '#ff6c5c'))
        + '</div>'
        + '<div class="lbm-foot"><span class="lbm-fol"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M15 3.13a4 4 0 0 1 0 7.75"/></svg><b>' + (d.followers || 0) + '</b> follower' + ((d.followers === 1) ? '' : 's') + '</span>' + mBtn + '</div>';
    }).catch(function () { body.innerHTML = '<div class="lbm-load">Could not load this trader.</div>'; });
  };
  document.addEventListener('click', function (e) {
    var fb = e.target.closest && e.target.closest('[data-lbfollow]');
    if (fb) {
      var name = fb.getAttribute('data-lbfollow'), tuid = fb.getAttribute('data-tuid'); fb.disabled = true;
      fetch('/api/lb/follow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tuid: tuid, tname: name }) }).then(function (r) { return r.json(); }).then(function (j) {
        fb.disabled = false;
        if (j && j.error === 'login_required') { if (window.mpAuth && window.mpAuth.open) window.mpAuth.open(); return; }
        var on = !!(j && j.following); fb.classList.toggle('on', on); fb.textContent = on ? '✓ Following' : '+ Follow';
        var set = followSet().filter(function (x) { return String(x).toLowerCase() !== String(name).toLowerCase(); }); if (on) set.push(name); setFollowSet(set);
      }).catch(function () { fb.disabled = false; });
      return;
    }
    var row = e.target.closest && e.target.closest('[data-lbu]');
    if (row && !e.target.closest('[data-auth-open]')) window.mpOpenProfile(row.getAttribute('data-lbu'));
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
})();
