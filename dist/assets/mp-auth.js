/* MarginPad — optional passwordless sign-in (email → 6-digit code).
   Self-contained: injects its own modal + styles, wires any [data-auth-open] trigger,
   updates any [data-auth-status] label, and exposes window.mpAuth. Anonymous use is unaffected. */
(function () {
  if (window.mpAuth) return;
  var ME = null, BANNED = false;
  function esc(s) { return String(s).replace(/[<>&]/g, function (m) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]; }); }
  function emailOk(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); }

  var css = '.mpa-modal{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(4,6,9,.7);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}'
    + '.mpa-modal[hidden]{display:none}'
    + '.mpa-panel{position:relative;width:100%;max-width:380px;background:linear-gradient(180deg,#14181f,#0c0f13);border:1px solid #283039;border-radius:18px;padding:26px 24px 24px;box-shadow:0 30px 90px -20px rgba(0,0,0,.9);font-family:system-ui,-apple-system,Segoe UI,sans-serif}'
    + '.mpa-x{position:absolute;top:12px;right:14px;background:none;border:none;color:#5c656f;font-size:19px;cursor:pointer;line-height:1;padding:4px}'
    + '.mpa-x:hover{color:#e9e7df}'
    + '.mpa-h{font-size:19px;font-weight:800;color:#f2f0e9;margin:0 0 6px;letter-spacing:-.01em}'
    + '.mpa-sub{font-size:13.5px;color:#9aa3ad;margin:0 0 16px;line-height:1.5}'
    + '.mpa-sub b{color:#cdd3da}'
    + '.mpa-in{width:100%;box-sizing:border-box;background:#0a0d11;border:1px solid #2f3742;border-radius:11px;padding:13px 14px;color:#f2f0e9;font-size:15px;outline:none;transition:border-color .15s}'
    + '.mpa-in:focus{border-color:#c2f64a}'
    + '.mpa-code{font-family:ui-monospace,Menlo,monospace;letter-spacing:8px;text-align:center;font-size:22px;font-weight:700}'
    + '.mpa-btn{width:100%;margin-top:11px;background:#c2f64a;color:#0a0b0d;font-weight:800;font-size:14.5px;border:none;border-radius:11px;padding:13px;cursor:pointer;transition:filter .15s}'
    + '.mpa-btn:hover{filter:brightness(1.06)}'
    + '.mpa-btn:disabled{opacity:.55;cursor:default}'
    + '.mpa-msg{font-size:12.5px;margin-top:10px;min-height:16px;color:#9aa3ad;text-align:center}'
    + '.mpa-msg.err{color:#ff8a80}.mpa-msg.ok{color:#41e3a3}'
    + '.mpa-link{display:block;margin:14px auto 0;background:none;border:none;color:#7f8893;font-size:12.5px;cursor:pointer}'
    + '.mpa-link:hover{color:#c2f64a}'
    + '.mpa-foot{font-size:11px;color:#5c656f;text-align:center;margin-top:14px;line-height:1.5}'
    + '.mpa-prof{background:#0a0d11;border:1px solid #2f3742;border-radius:12px;padding:6px 14px;margin:2px 0 4px}'
    + '.mpa-prow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #1a2027;font-size:13.5px}'
    + '.mpa-prow:last-child{border-bottom:none}'
    + '.mpa-prow span{color:#9aa3ad}.mpa-prow b{color:#f2f0e9;font-weight:700;max-width:62%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}'
    + '.mpa-uname-set{display:flex;align-items:center;gap:8px;background:#0a0d11;border:1px solid #2f3742;border-radius:11px;padding:13px 14px;color:#f2f0e9;font-size:15px;font-weight:700}'
    + '.mpa-uname-set .mpa-lock{margin-left:auto;font-size:12px;font-weight:600;color:#5c656f}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var modal = document.createElement('div'); modal.className = 'mpa-modal'; modal.hidden = true;
  modal.innerHTML = '<div class="mpa-panel"><button class="mpa-x" type="button" aria-label="Close">✕</button><div class="mpa-body"></div></div>';
  document.body.appendChild(modal);
  var bodyEl = modal.querySelector('.mpa-body');
  modal.querySelector('.mpa-x').addEventListener('click', close);
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });

  function open() { modal.hidden = false; render(); }
  function close() { modal.hidden = true; }
  function setMsg(t, kind) { var m = bodyEl.querySelector('.mpa-msg'); if (m) { m.textContent = t; m.className = 'mpa-msg ' + (kind || ''); } }

  function render() {
    if (BANNED) {
      bodyEl.innerHTML = '<h3 class="mpa-h">Account suspended</h3><p class="mpa-sub">Your MarginPad account has been suspended. If you believe this is a mistake, contact <b>support@marginpad.io</b>.</p>';
      return;
    }
    if (ME) {
      var hasU = !!ME.username; // once set, a username is permanent — no edit option
      var fmtDate = function (ts) { if (!ts) return '—'; try { return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return '—'; } };
      var tradeCount = function () { try { var j = JSON.parse(localStorage.getItem('mp_journal') || '[]'); return Array.isArray(j) ? j.length : 0; } catch (e) { return 0; } };
      bodyEl.innerHTML = '<h3 class="mpa-h">Your profile</h3>'
        + '<div class="mpa-prof">'
          + (hasU ? '<div class="mpa-prow"><span>Username</span><b>' + esc(ME.username) + '</b></div>' : '')
          + '<div class="mpa-prow"><span>Email</span><b>' + esc(ME.email) + '</b></div>'
          + '<div class="mpa-prow"><span>Member since</span><b>' + fmtDate(ME.created) + '</b></div>'
          + '<div class="mpa-prow"><span>Paper trades</span><b>' + tradeCount() + '</b></div>'
          + (ME.status && ME.status !== 'active' ? '<div class="mpa-prow"><span>Status</span><b style="color:#ffb347;text-transform:capitalize">' + esc(ME.status) + '</b></div>' : '')
        + '</div>'
        + (hasU ? '' : '<label style="display:block;font-size:11px;color:#9aa3ad;margin:8px 0 5px">Pick a username <span style="color:#5c656f">(public, permanent)</span></label><input class="mpa-in" id="mpaUname" maxlength="20" autocomplete="off" placeholder="choose a username"><button class="mpa-btn" id="mpaSaveU" type="button">Set username</button><div class="mpa-msg"></div>')
        + (ME.muted ? '<p class="mpa-foot" style="color:#ffb347">You are muted in chat.</p>' : '')
        + '<button class="mpa-btn" id="mpaPush" type="button" style="margin-top:10px;background:#13241f;color:#34d99a;border:1px solid rgba(52,217,154,.4);display:none">Enable push notifications</button>'
        + '<button class="mpa-btn" style="background:#1a1f27;color:#e9e7df;margin-top:10px" id="mpaLogout" type="button">Sign out</button>'
        + '<button class="mpa-link" id="mpaDone" type="button">Close</button>';
      if (!hasU) {
        var sv = bodyEl.querySelector('#mpaSaveU'), ui = bodyEl.querySelector('#mpaUname');
        var saveU = function () {
          var v = (ui.value || '').trim();
          if (!/^[a-zA-Z0-9_]{3,20}$/.test(v)) { setMsg('3–20 letters, numbers or _', 'err'); return; }
          sv.disabled = true; setMsg('Saving…', '');
          fetch('/api/auth/username', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: v }) })
            .then(function (r) { return r.json(); }).then(function (d) {
              sv.disabled = false;
              if (d.ok) { ME.username = d.username; reflect(); setMsg('Saved ✓', 'ok'); setTimeout(render, 700); }
              else if (d.error === 'taken') setMsg('That username is taken.', 'err');
              else if (d.error === 'bad_username') setMsg('3–20 letters, numbers or _', 'err');
              else if (d.error === 'already_set') { if (d.username) ME.username = d.username; render(); }
              else if (d.error === 'not_signed_in') setMsg('Please sign in again.', 'err');
              else setMsg('Could not save.', 'err');
            }).catch(function () { sv.disabled = false; setMsg('Network error.', 'err'); });
        };
        sv.addEventListener('click', saveU);
        ui.addEventListener('keydown', function (e) { if (e.key === 'Enter') saveU(); });
      }
      var dn = bodyEl.querySelector('#mpaDone'); if (dn) dn.addEventListener('click', close);
      bodyEl.querySelector('#mpaLogout').addEventListener('click', function () {
        fetch('/api/auth/logout', { method: 'POST' }).then(function () { ME = null; reflect(); render(); });
      });
      var pb = bodyEl.querySelector('#mpaPush');
      if (pb && window.mpPush) {
        var setPB = function (st) {
          pb.disabled = false; pb.style.opacity = '1';
          if (st === 'unsupported') { pb.style.display = 'none'; return; }
          pb.style.display = 'block'; pb._st = st;
          if (st === 'denied') { pb.textContent = 'Notifications blocked in your browser'; pb.disabled = true; pb.style.opacity = '.6'; return; }
          pb.textContent = st === 'on' ? '🔔 Push on — tap to turn off' : '🔔 Get alerts on this device';
        };
        window.mpPush.state().then(setPB);
        pb.addEventListener('click', function () {
          if (pb.disabled || pb._busy || pb._st === 'denied') return; pb._busy = 1; var on = pb._st === 'on'; pb.textContent = 'Working…';
          (on ? window.mpPush.disable() : window.mpPush.enable()).then(function () { pb._busy = 0; setPB(on ? 'off' : 'on'); })
            .catch(function (err) { pb._busy = 0; setPB(err === 'denied' ? 'denied' : (on ? 'on' : 'off')); });
        });
      }
      return;
    }
    bodyEl.innerHTML = '<h3 class="mpa-h">Sign in or sign up</h3><p class="mpa-sub">Enter your email and we’ll send a 6-digit code. No password.</p>'
      + '<input class="mpa-in" id="mpaEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com">'
      + '<button class="mpa-btn" id="mpaSend" type="button">Send code</button><div class="mpa-msg"></div>'
      + '<p class="mpa-foot">Optional — MarginPad works without an account. We use email only to save your progress.</p>';
    var em = bodyEl.querySelector('#mpaEmail'), sb = bodyEl.querySelector('#mpaSend');
    setTimeout(function () { em.focus(); }, 40);
    function send() {
      var v = (em.value || '').trim().toLowerCase();
      if (!emailOk(v)) { setMsg('Enter a valid email.', 'err'); return; }
      sb.disabled = true; setMsg('Sending…', '');
      fetch('/api/auth/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: v }) })
        .then(function (r) { return r.json(); }).then(function (d) {
          sb.disabled = false;
          if (d.ok) codeStep(v);
          else if (d.error === 'cooldown') setMsg('Wait ' + (d.wait || 30) + 's before requesting another code.', 'err');
          else if (d.error === 'too_many') setMsg('Too many codes today — try again tomorrow.', 'err');
          else if (d.error === 'email_not_configured') setMsg('Sign-in is not available right now.', 'err');
          else if (d.error === 'bad_email') setMsg('Enter a valid email.', 'err');
          else setMsg('Could not send the code. Try again.', 'err');
        }).catch(function () { sb.disabled = false; setMsg('Network error — try again.', 'err'); });
    }
    sb.addEventListener('click', send);
    em.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  }

  function codeStep(email) {
    bodyEl.innerHTML = '<h3 class="mpa-h">Check your inbox</h3><p class="mpa-sub">We sent a 6-digit code to <b>' + esc(email) + '</b>.</p>'
      + '<input class="mpa-in mpa-code" id="mpaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">'
      + '<button class="mpa-btn" id="mpaVerify" type="button">Verify</button><div class="mpa-msg"></div>'
      + '<button class="mpa-link" id="mpaBack" type="button">← use a different email</button>';
    var ci = bodyEl.querySelector('#mpaCode'), vb = bodyEl.querySelector('#mpaVerify');
    setTimeout(function () { ci.focus(); }, 40);
    function verify() {
      var c = (ci.value || '').replace(/\D/g, '');
      if (c.length !== 6) { setMsg('Enter the 6-digit code.', 'err'); return; }
      vb.disabled = true; setMsg('Verifying…', '');
      fetch('/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email, code: c }) })
        .then(function (r) { return r.json(); }).then(function (d) {
          vb.disabled = false;
          if (d.ok) { ME = d.user; reflect(); setMsg(d.isNew ? 'Account created ✓' : 'Signed in ✓', 'ok'); if (d.isNew && typeof gtag === 'function') { try { gtag('event', 'conversion', { send_to: 'AW-18230384038/8GygCJ2ry8IcEKar9vRD', value: 1.0, currency: 'USD' }); } catch (_) {} } setTimeout(render, 750); }
          else if (d.error === 'bad_code') setMsg('Wrong code' + (d.left != null ? ' — ' + d.left + ' tries left' : '') + '.', 'err');
          else if (d.error === 'expired' || d.error === 'no_code') setMsg('Code expired — request a new one.', 'err');
          else if (d.error === 'too_many_attempts') setMsg('Too many tries — request a new code.', 'err');
          else setMsg('Could not verify. Try again.', 'err');
        }).catch(function () { vb.disabled = false; setMsg('Network error — try again.', 'err'); });
    }
    vb.addEventListener('click', verify);
    ci.addEventListener('keydown', function (e) { if (e.key === 'Enter') verify(); });
    bodyEl.querySelector('#mpaBack').addEventListener('click', render);
  }

  function reflect() {
    var on = !!ME;
    Array.prototype.forEach.call(document.querySelectorAll('[data-auth-status]'), function (e) { e.textContent = BANNED ? 'Suspended' : (on ? (ME.username || ME.email.split('@')[0]) : 'Sign in'); });
    document.body.classList.toggle('mpa-authed', on);
    if (on) { if (!window._mpaPulled) { window._mpaPulled = true; try { pullTrades(); } catch (_) {} } } else { window._mpaPulled = false; } // cross-device: pull the account's journal once per sign-in so trades show on every device
    try { window.dispatchEvent(new CustomEvent('mp-auth-change', { detail: { user: ME, banned: BANNED } })); } catch (_) {} // let pages (e.g. /rewards) react to sign-in/out
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-auth-open]');
    if (t) { e.preventDefault(); open(); }
  });

  // signed-in click capture → per-user heatmap (admin only); throttled, normalized to page %, best-effort
  var lastClk = 0;
  document.addEventListener('click', function (e) {
    if (!ME) return;
    var t = Date.now(); if (t - lastClk < 150) return; lastClk = t;
    if (e.target && e.target.closest && e.target.closest('.mpa-modal')) return;
    var x = Math.round((e.clientX / Math.max(1, window.innerWidth)) * 100);
    var docH = Math.max(document.documentElement.scrollHeight || 1, 1);
    var y = Math.round((((window.scrollY || window.pageYOffset || 0) + e.clientY) / docH) * 100);
    try { fetch('/api/auth/click', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: x, y: y, path: location.pathname }), keepalive: true }); } catch (_) {}
  }, true);

  // --- signed-in: sync paper-trade journal + accumulate time-on-page (for the admin user profile) ---
  var lastJ = '';
  function syncTrades() {
    if (!ME) return;
    var j = ''; try { j = localStorage.getItem('mp_journal') || ''; } catch (e) {}
    if (!j || j === lastJ) return;
    var arr; try { arr = JSON.parse(j); } catch (e) { return; }
    if (!Array.isArray(arr)) return;
    lastJ = j;
    // send the most-recent ~200 trades (the server keeps the recent/best 100 anyway) so the payload stays bounded for heavy traders.
    var send = arr;
    if (arr.length > 200) { try { send = arr.slice().sort(function (a, b) { return (+a.closeTs || +a.ts || 0) - (+b.closeTs || +b.ts || 0); }).slice(-200); } catch (e) { send = arr.slice(-200); } }
    // NO keepalive here: keepalive caps the request BODY at 64KB and silently drops a large journal — that is why active traders' recent trades (and big wins) stopped reaching the server. The page is open during the interval sync, so keepalive isn't needed.
    try { fetch('/api/auth/trades', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ journal: send }) }); } catch (_) {}
  }
  // cross-device sync: pull the account's stored journal and MERGE it into this device's local journal (union by id; a closed result beats an open one), so every open trade shows on every device the user signs in on.
  function pullTrades() {
    if (!ME) return;
    fetch('/api/auth/trades', { headers: { accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !Array.isArray(d.journal) || !d.journal.length) return;
      var local = []; try { local = JSON.parse(localStorage.getItem('mp_journal') || '[]') || []; } catch (e) {} if (!Array.isArray(local)) local = [];
      var byId = {}, order = [];
      function put(e) { if (!e || typeof e !== 'object') return; var id = String(e.id || ('_a' + order.length)); var prev = byId[id]; if (prev === undefined) { byId[id] = e; order.push(id); return; } var pc = (prev.status === 'win' || prev.status === 'loss'), cc = (e.status === 'win' || e.status === 'loss'); if (cc || !pc) byId[id] = e; }
      local.forEach(put); d.journal.forEach(put); // server applied last → wins same-state ties; a stale local 'open' never overwrites a stored close
      var merged = order.map(function (id) { return byId[id]; });
      merged.sort(function (a, b) { return (+a.ts || 0) - (+b.ts || 0); });
      if (JSON.stringify(merged) === JSON.stringify(local)) return; // nothing new on this device
      try { localStorage.setItem('mp_journal', JSON.stringify(merged)); } catch (e) {}
      lastJ = ''; // force the next push so the server gets this device's union too
      try { window.mpLivePrices = window.mpLivePrices || {}; merged.forEach(function (e) { if (e && (e.status === 'open' || !e.status) && e.sym && +e.entry > 0 && !(window.mpLivePrices[e.sym] && window.mpLivePrices[e.sym].p > 0)) window.mpLivePrices[e.sym] = { p: +e.entry, t: Date.now() }; }); } catch (e) {} // seed entry price so pulled positions start at 0 P&L, not a phantom -100%
      try { if (window.mpJournalRender) window.mpJournalRender(); } catch (e) {}
    }).catch(function () {});
  }
  var dwPath = location.pathname, dwVis = document.visibilityState === 'visible', dwSince = Date.now(), dwAcc = 0;
  function dwAccrue() { if (dwVis) { dwAcc += Date.now() - dwSince; dwSince = Date.now(); } }
  function dwFlush() {
    if (!ME) return;
    dwAccrue(); var secs = Math.round(dwAcc / 1000);
    if (secs < 2) return; dwAcc = 0;
    var payload = JSON.stringify({ path: dwPath, secs: secs });
    try { if (navigator.sendBeacon) navigator.sendBeacon('/api/auth/dwell', new Blob([payload], { type: 'application/json' })); else fetch('/api/auth/dwell', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true }); } catch (_) {}
  }
  document.addEventListener('visibilitychange', function () { dwAccrue(); dwVis = document.visibilityState === 'visible'; dwSince = Date.now(); if (!dwVis) { dwFlush(); syncTrades(); } });
  window.addEventListener('pagehide', dwFlush);
  setInterval(syncTrades, 12000);

  // ---- Web push (browser notifications for price alerts) ----
  var PUSH_KEY = 'BKdr8PcbZQWGE0c8QuauG1FHf0yEoHs4fm0ise_rm9kNftX_ABmg0oJyqK8GFw-rRW9MmGsQWjNOvVg9lEX9Bcg';
  function urlB64ToU8(s) { var pad = '='.repeat((4 - s.length % 4) % 4); var b = (s + pad).replace(/-/g, '+').replace(/_/g, '/'); var raw = atob(b); var u8 = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i); return u8; }
  window.mpPush = {
    supported: function () { return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window); },
    state: function () {
      if (!this.supported()) return Promise.resolve('unsupported');
      if (Notification.permission === 'denied') return Promise.resolve('denied');
      return navigator.serviceWorker.getRegistration().then(function (reg) { if (!reg) return 'off'; return reg.pushManager.getSubscription().then(function (sub) { return sub ? 'on' : 'off'; }); }).catch(function () { return 'off'; });
    },
    enable: function () {
      if (!this.supported()) return Promise.reject('unsupported');
      return Notification.requestPermission().then(function (p) {
        if (p !== 'granted') throw 'denied';
        return navigator.serviceWorker.register('/sw.js').then(function (reg) { return navigator.serviceWorker.ready.then(function () { return reg; }); });
      }).then(function (reg) {
        return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToU8(PUSH_KEY) }); });
      }).then(function (sub) {
        var j = sub.toJSON();
        return fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sub: { endpoint: sub.endpoint, keys: j.keys } }) }).then(function (r) { return r.json(); }).then(function (d) { if (!d || !d.ok) throw (d && d.error) || 'failed'; return d; });
      });
    },
    disable: function () {
      return navigator.serviceWorker.getRegistration().then(function (reg) { if (!reg) return; return reg.pushManager.getSubscription().then(function (sub) { if (!sub) return; var ep = sub.endpoint; return sub.unsubscribe().then(function () { return fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: ep }) }); }); }); });
    }
  };

  window.mpAuth = { open: open, close: close, me: function () { return ME; }, sync: syncTrades };

  fetch('/api/auth/me').then(function (r) { return r.json(); }).then(function (d) { ME = d.user || null; BANNED = !!d.banned; reflect(); if (ME) { dwSince = Date.now(); syncTrades(); } }).catch(function () {});
})();
