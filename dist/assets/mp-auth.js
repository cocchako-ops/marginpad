/* MarginPad — optional passwordless sign-in (email → 6-digit code).
   Self-contained: injects its own modal + styles, wires any [data-auth-open] trigger,
   updates any [data-auth-status] label, and exposes window.mpAuth. Anonymous use is unaffected. */
(function () {
  if (window.mpAuth) return;
  var ME = null, BANNED = false;
  function esc(s) { return String(s).replace(/[<>&]/g, function (m) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]; }); }
  /* shared tier insignia (SVG, no emoji): faceted gem for Diamond, hexagon+star medal otherwise */
  window.mpLvlSvg = window.mpLvlSvg || function (k, col) { col = col || '#c97f4a';
    if (k === 'legendary') return '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" style="display:block"><path d="M4 17h16l-1.2-8-4 3L12 5l-2.8 7-4-3z" fill="' + col + '30"/><path d="M4 17h16l-1.2-8-4 3L12 5l-2.8 7-4-3zM4 17l.6 2.5h14.8L20 17" stroke="' + col + '" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="13.4" r="1.5" fill="' + col + '"/></svg>';
    if (k === 'diamond') return '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" style="display:block"><path d="M8 5H16L20 10L12 19L4 10Z" fill="' + col + '30"/><path d="M8 5H16L20 10L12 19L4 10ZM4 10H20M8 5L10 10M16 5L14 10M10 10L12 19M14 10L12 19" stroke="' + col + '" stroke-width="1.25" stroke-linejoin="round"/></svg>';
    return '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" style="display:block"><path d="M12 2.5 20 7v10L12 21.5 4 17V7z" fill="' + col + '22" stroke="' + col + '" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 7l1.5 3 3.3.5-2.4 2.3.6 3.3L12 14.6 8.9 16.1l.6-3.3L7.1 10.5l3.3-.5z" fill="' + col + '"/></svg>'; };
  window.mpFlameSvg = window.mpFlameSvg || function (col) { return '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" style="vertical-align:-1px"><path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 0-1 .5-2 1 1.5 2.5 3 2.5 5a5 5 0 0 1-10 0c0-4 5-6 5-10z" fill="' + (col || '#ff6a3d') + '" opacity=".85"/></svg>'; };
  /* batch level-badge decorator: fills any <span data-lvln="username"> or <span data-lvlu="uid"> with the tier gem */
  window.mpLvlDecorate = window.mpLvlDecorate || (function () {
    var cache = { byName: {}, byId: {} }, pend = null, MISS = '\u0000';
    function ensureCss() { if (document.getElementById('mplvb-css')) return; var st = document.createElement('style'); st.id = 'mplvb-css'; st.textContent = '.mplvb{display:inline-block;width:13px;height:13px;vertical-align:-2px;margin:0 3px 0 4px;line-height:0}'; (document.head || document.documentElement).appendChild(st); }
    function fill(el) {
      var nm = el.getAttribute('data-lvln'), ui = el.getAttribute('data-lvlu'), L;
      if (ui) L = cache.byId[String(ui).replace(/^u:/, '')]; else if (nm) L = cache.byName[String(nm).toLowerCase()]; else { el.setAttribute('data-lvldone', '1'); return true; }
      if (L === undefined) return false;
      el.setAttribute('data-lvldone', '1');
      if (!L || L === MISS) { el.innerHTML = ''; return true; }
      el.innerHTML = '<span class="mplvb" title="' + esc(L.name || '') + '">' + window.mpLvlSvg(L.k, L.col) + '</span>';
      return true;
    }
    function run() {
      pend = null; ensureCss();
      var els = document.querySelectorAll('[data-lvln]:not([data-lvldone]),[data-lvlu]:not([data-lvldone])');
      if (!els.length) return;
      var needIds = {}, needNames = {}, waiting = [];
      for (var i = 0; i < els.length; i++) { var el = els[i]; if (fill(el)) continue; var ui = el.getAttribute('data-lvlu'), nm = el.getAttribute('data-lvln'); if (ui) needIds[String(ui).replace(/^u:/, '')] = 1; else if (nm) needNames[String(nm).toLowerCase()] = 1; waiting.push(el); }
      var ids = Object.keys(needIds), names = Object.keys(needNames);
      if (!ids.length && !names.length) return;
      fetch('/api/levels', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: ids.slice(0, 80), names: names.slice(0, 80) }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { d = d || {}; var bi = d.byId || {}, bn = d.byName || {}; ids.forEach(function (id) { cache.byId[id] = bi[id] || MISS; }); names.forEach(function (n) { cache.byName[n] = bn[n] || MISS; }); waiting.forEach(fill); })
        .catch(function () {});
    }
    return function () { if (pend) return; pend = setTimeout(run, 220); };
  })();

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
    + '.mpa-lvl{background:linear-gradient(160deg,#12151d,#0a0d11);border:1px solid #2a3140;border-radius:14px;padding:14px 15px;margin:8px 0 4px;position:relative;overflow:hidden}'
    + '.mpa-lvl-top{display:flex;align-items:center;gap:11px}'
    + '.mpa-lvl-badge{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none;box-shadow:0 0 18px -4px var(--lc)}'
    + '.mpa-lvl-nm{font-weight:800;font-size:16px;color:var(--lc)}'
    + '.mpa-lvl-xp{font-size:11.5px;color:#8a93a0;font-family:ui-monospace,Consolas,monospace;margin-top:1px}'
    + '.mpa-lvl-next{margin-left:auto;text-align:right;font-size:10.5px;color:#5c656f;font-family:ui-monospace,Consolas,monospace}'
    + '.mpa-lvl-bar{height:8px;border-radius:5px;background:#1a2027;overflow:hidden;margin-top:11px}'
    + '.mpa-lvl-bar i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,var(--lc),#ffffff88);transition:width .6s ease}'
    + '.mpa-lvl-link{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:9px;font-size:12px;font-weight:700;color:#c2f64a;text-decoration:none;padding:8px;border:1px solid rgba(194,246,74,.25);border-radius:9px}'
    + '.mpa-lvl-link:hover{background:rgba(194,246,74,.08)}'
    + '.mpa-uname-set{display:flex;align-items:center;gap:8px;background:#0a0d11;border:1px solid #2f3742;border-radius:11px;padding:13px 14px;color:#f2f0e9;font-size:15px;font-weight:700}'
    + '.mpa-uname-set .mpa-lock{margin-left:auto;font-size:12px;font-weight:600;color:#5c656f}'
    + '.mpa-dm{display:flex;flex-direction:column;height:min(60vh,440px)}'
    + '.mpa-dm-scroll{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px 2px 8px}'
    + '.mpa-bub{max-width:82%;padding:9px 12px;border-radius:13px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word}'
    + '.mpa-bub.out{align-self:flex-start;background:#12241f;border:1px solid rgba(52,217,154,.35);color:#d6f5ea;border-bottom-left-radius:4px}'
    + '.mpa-bub.in{align-self:flex-end;background:#1a2530;border:1px solid #2f3742;color:#eaf1f7;border-bottom-right-radius:4px}'
    + '.mpa-bub .mpa-who{display:block;font-size:10px;letter-spacing:.04em;font-weight:800;color:#41e3a3;margin-bottom:2px}'
    + '.mpa-dm-empty{color:#5c656f;font-size:13px;text-align:center;margin:auto 0;white-space:pre-line;line-height:1.6}'
    + '.mpa-dm-form{display:flex;gap:8px;margin-top:8px}.mpa-dm-form .mpa-in{flex:1}'
    + '.mpa-dm-send{background:#38bdf8;color:#04121c;font-weight:800;border:none;border-radius:11px;padding:0 16px;cursor:pointer}'
    + '.mpa-dm-send:disabled{opacity:.5;cursor:default}'
    + '.mpa-badge{display:inline-block;min-width:16px;height:16px;line-height:16px;padding:0 4px;margin-left:6px;background:#ff5a4d;color:#fff;border-radius:9px;font-size:10px;font-weight:800;text-align:center;vertical-align:middle}'
    + '.mpa-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff5a4d;margin-left:5px;vertical-align:middle}'
    // glowing notification ping pinned to the account button's corner — an unread message from the MarginPad team
    // must be impossible to miss (a static inline dot wasn't)
    + '.mpa-ping{position:absolute;top:-4px;right:-4px;width:11px;height:11px;border-radius:50%;background:#ff5a4d;border:2px solid #0a0b0d;z-index:6;pointer-events:none;animation:mpaPing 1.5s ease-out infinite}'
    + '@keyframes mpaPing{0%{box-shadow:0 0 0 0 rgba(255,90,77,.75),0 0 8px rgba(255,90,77,.9)}70%{box-shadow:0 0 0 10px rgba(255,90,77,0),0 0 8px rgba(255,90,77,.9)}100%{box-shadow:0 0 0 0 rgba(255,90,77,0),0 0 8px rgba(255,90,77,.9)}}'
    + '@media(prefers-reduced-motion:reduce){.mpa-ping{animation:none;box-shadow:0 0 8px rgba(255,90,77,.9)}}';
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

  // ---- support: the user's own conversation with the team (their tickets + our email replies) ----
  function renderSup() {
    bodyEl.innerHTML = '<h3 class="mpa-h">Support</h3><p class="mpa-sub">Loading your conversation\u2026</p>';
    fetch('/api/reward/support/mine').then(function (r) { return r.json(); }).then(function (d) {
      var items = (d && d.items) || [], reps = (d && d.replies) || [];
      if (!items.length && !reps.length) { renderSupNew(true); return; }
      var msgs = items.map(function (x) { return { ts: x.ts, dir: 'in', body: x.message }; })
        .concat(reps.map(function (x) { return { ts: x.ts, dir: 'out', body: x.body || x.subject }; }))
        .sort(function (p, q) { return p.ts - q.ts; });
      var anyOpen = items.some(function (x) { return !x.closed; });
      bodyEl.innerHTML = '<h3 class="mpa-h">Support</h3><p class="mpa-sub">' + (anyOpen ? 'You have an open conversation \u2014 our replies also arrive by email.' : 'Your past conversations \u2014 replies arrive by email.') + '</p>'
        + '<div class="mpa-dm"><div class="mpa-dm-scroll" id="mpaSupScroll">'
        + msgs.map(function (m) { return '<div class="mpa-bub ' + (m.dir === 'out' ? 'out' : 'in') + '">' + (m.dir === 'out' ? '<span class="mpa-who">MarginPad support</span>' : '') + esc(m.body || '') + '</div>'; }).join('')
        + '</div></div>'
        + '<button class="mpa-btn" id="mpaSupNew" type="button" style="margin-top:10px">New conversation</button>'
        + '<button class="mpa-link" id="mpaSupBack" type="button">\u2190 Back to profile</button>';
      var sc = bodyEl.querySelector('#mpaSupScroll'); if (sc) sc.scrollTop = sc.scrollHeight;
      bodyEl.querySelector('#mpaSupNew').addEventListener('click', function () { renderSupNew(false); });
      bodyEl.querySelector('#mpaSupBack').addEventListener('click', function () { render(); });
    }).catch(function () { renderSupNew(true); });
  }
  function renderSupNew(first) {
    bodyEl.innerHTML = '<h3 class="mpa-h">Contact support</h3><p class="mpa-sub">Tell us what happened \u2014 we reply to <b>' + esc((ME && ME.email) || 'your email') + '</b>, usually within a day.</p>'
      + '<textarea class="mpa-in" id="mpaSupMsg" maxlength="1000" rows="5" placeholder="Describe the problem or question\u2026" style="resize:vertical;min-height:110px;height:auto"></textarea>'
      + '<button class="mpa-btn" id="mpaSupSend" type="button" style="margin-top:10px">Send message</button>'
      + '<div class="mpa-msg"></div>'
      + '<button class="mpa-link" id="mpaSupBack2" type="button">\u2190 Back</button>';
    bodyEl.querySelector('#mpaSupBack2').addEventListener('click', function () { if (first) render(); else renderSup(); });
    var sb = bodyEl.querySelector('#mpaSupSend');
    sb.addEventListener('click', function () {
      var v = (bodyEl.querySelector('#mpaSupMsg').value || '').trim();
      if (!v) { setMsg('Write something first.', 'err'); return; }
      sb.disabled = true; setMsg('Sending\u2026', '');
      fetch('/api/reward/support', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: (ME && ME.email) || '', message: v }) })
        .then(function (r) { return r.json(); }).then(function (d) { sb.disabled = false; if (d && d.ok) { renderSup(); } else { setMsg('Failed \u2014 try again.', 'err'); } })
        .catch(function () { sb.disabled = false; setMsg('Network error.', 'err'); });
    });
  }
  function render() {
    if (BANNED) {
      bodyEl.innerHTML = '<h3 class="mpa-h">Account suspended</h3><p class="mpa-sub">Your MarginPad account has been suspended. If you believe this is a mistake, contact <b>support@marginpad.io</b>.</p>';
      return;
    }
    if (ME) {
      var hasU = !!ME.username; // once set, a username is permanent — no edit option
      var fmtDate = function (ts) { if (!ts) return '—'; try { return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return '—'; } };
      var tradeCount = function () { try { var j = JSON.parse(localStorage.getItem('mp_journal') || '[]'); return Array.isArray(j) ? j.length : 0; } catch (e) { return 0; } };
      var lv = ME.level || { k: 'bronze', name: 'Bronze', col: '#c97f4a', xp: ME.xp || 0, pct: 0, next: 'Silver', toNext: 2000 };
      var lvlHtml = '<div class="mpa-lvl" style="--lc:' + (lv.col || '#c97f4a') + '">'
        + '<div class="mpa-lvl-top"><div class="mpa-lvl-badge" style="background:transparent;padding:4px">' + window.mpLvlSvg(lv.k, lv.col || '#c97f4a') + '</div>'
        + '<div><div class="mpa-lvl-nm">' + esc(lv.name || 'Bronze') + '</div><div class="mpa-lvl-xp">' + (lv.xp || 0).toLocaleString() + ' XP' + (ME.streak ? ' · ' + window.mpFlameSvg() + ' ' + ME.streak + '-day streak' : '') + '</div></div>'
        + (lv.next ? '<div class="mpa-lvl-next">' + (lv.toNext || 0).toLocaleString() + ' XP<br>to ' + esc(lv.next) + '</div>' : '<div class="mpa-lvl-next" style="color:' + (lv.col || '#8b5cff') + '">MAX<br>tier</div>') + '</div>'
        + '<div class="mpa-lvl-bar"><i style="width:' + (lv.pct != null ? lv.pct : 100) + '%"></i></div>'
        + '<a class="mpa-lvl-link" href="/levels/">Level System — how it works &amp; rewards →</a>'
        + '</div>';
      bodyEl.innerHTML = '<h3 class="mpa-h">Your profile</h3>'
        + lvlHtml
        + '<div class="mpa-prof">'
          + (hasU ? '<div class="mpa-prow"><span>Username</span><b>' + esc(ME.username) + '</b></div>' : '')
          + '<div class="mpa-prow"><span>Email</span><b>' + esc(ME.email) + '</b></div>'
          + '<div class="mpa-prow"><span>Member since</span><b>' + fmtDate(ME.created) + '</b></div>'
          + '<div class="mpa-prow"><span>Paper trades</span><b>' + tradeCount() + '</b></div>'
          + (hasU ? '<div class="mpa-prow"><span>Followers</span><b id="mpaFollowers">…</b></div>' : '')
          + (ME.status && ME.status !== 'active' ? '<div class="mpa-prow"><span>Status</span><b style="color:#ffb347;text-transform:capitalize">' + esc(ME.status) + '</b></div>' : '')
        + '</div>'
        + (hasU ? '' : '<label style="display:block;font-size:11px;color:#9aa3ad;margin:8px 0 5px">Pick a username <span style="color:#5c656f">(public, permanent)</span></label><input class="mpa-in" id="mpaUname" maxlength="20" autocomplete="off" placeholder="choose a username"><button class="mpa-btn" id="mpaSaveU" type="button">Set username</button><div class="mpa-msg"></div>')
        + (ME.muted ? '<p class="mpa-foot" style="color:#ffb347">You are muted in chat.</p>' : '')
        + '<button class="mpa-btn" id="mpaSup" type="button" style="margin-top:10px;background:#13241f;color:#34d99a;border:1px solid rgba(52,217,154,.4)">Contact support</button>'
        + '<button class="mpa-btn" style="background:#1a1f27;color:#e9e7df;margin-top:10px" id="mpaLogout" type="button">Sign out</button>'
        + '<button class="mpa-link" id="mpaDone" type="button">Close</button>';
      if (hasU) { try { fetch('/api/lb/user?name=' + encodeURIComponent(ME.username)).then(function (r) { return r.json(); }).then(function (d) { var fe = bodyEl.querySelector('#mpaFollowers'); if (fe) fe.textContent = (d && typeof d.followers === 'number') ? d.followers : '0'; }).catch(function () { var fe = bodyEl.querySelector('#mpaFollowers'); if (fe) fe.textContent = '0'; }); } catch (e) {} }
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
      var sp = bodyEl.querySelector('#mpaSup'); if (sp) sp.addEventListener('click', function () { renderSup(); });
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
      + '<p class="mpa-sub" style="margin-top:-6px;font-size:12px;color:#c8b26a">No email? Check your <b>spam / junk</b> folder — our codes sometimes land there.</p>'
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
    if (arr.length > 200) { try {
      // ALWAYS send every OPEN position — never let the 200-cap slice one out (an old open with a small ts used to be
      // dropped from the payload under sustained sync failure → the server never got it → it vanished on a device switch).
      var _isOpen = function (e) { return e && e.status !== 'win' && e.status !== 'loss'; };
      var _opens = arr.filter(_isOpen);
      var _closed = arr.filter(function (e) { return !_isOpen(e); }).sort(function (a, b) { return (+a.closeTs || +a.ts || 0) - (+b.closeTs || +b.ts || 0); });
      send = _opens.concat(_closed.slice(-Math.max(0, 200 - _opens.length)));
    } catch (e) { send = arr.slice(-200); } }
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
      function put(e) { if (!e || typeof e !== 'object') return; var id = String(e.id || ('_a' + order.length)); var prev = byId[id]; if (prev === undefined) { byId[id] = e; order.push(id); return; } var pc = (prev.status === 'win' || prev.status === 'loss'), cc = (e.status === 'win' || e.status === 'loss');
        if (cc && !pc) { byId[id] = e; return; }                     // a close always beats an open
        if (!cc && pc) return;                                       // never let a stale server 'open' overwrite a locally-closed trade
        if (cc && pc) { byId[id] = e; return; }
        var pq = +prev.qty, cq = +e.qty; if (isFinite(pq) && isFinite(cq) && cq > pq) return; byId[id] = e; } // both open → keep the more-reduced (partial-close safe)
      local.forEach(put); d.journal.forEach(put); // server applied last → wins same-state ties; a stale local 'open' never overwrites a stored close
      var merged = order.map(function (id) { return byId[id]; });
      merged.sort(function (a, b) { return (+a.ts || 0) - (+b.ts || 0); });
      if (JSON.stringify(merged) === JSON.stringify(local)) return; // nothing new on this device
      try { localStorage.setItem('mp_journal', JSON.stringify(merged)); } catch (e) {}
      lastJ = ''; // force the next push so the server gets this device's union too
      // NOTE: we deliberately DO NOT seed window.mpLivePrices[sym] from a trade's entry here. metrics() already falls back
      // to each trade's OWN entry when there is no live price (→ P&L 0, no phantom -100%), so the seed was unnecessary — and
      // HARMFUL: it wrote ONE trade's entry as the shared "live" price for the whole symbol, so with 2+ open trades on the
      // same coin (e.g. an old 1000× US at $0.0237 + a new 100× US at $0.047) the newer trade was measured against the older
      // trade's entry → −49% → instant liquidation. Real prices come from pollPrices/WS within ~3s; until then P&L just shows 0.
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

  /* ===== XP toasts + level-up celebration (2026-07-15) ===== */
  (function () {
    var SRCN = { trade_hh: 'XP Happy Hour! ⚡', trade_win: 'Profitable trade', trade: 'Trade closed', checkin: 'Daily check-in', streak: 'Streak bonus', mission: 'Mission complete', faucet: 'Faucet claim', promo: 'Promo post approved', exsign: 'Exchange sign-up', lbprize: 'Competition prize', username: 'Username set', academy: 'Academy', admin: 'Bonus', backfill: 'Loyalty bonus' };
    var ICON = { bronze: '', silver: '', gold: '', platinum: '', diamond: '' };
    var xpCss = '#mpxpT{position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;flex-direction:column;gap:8px;pointer-events:none}'
      + '.mpxp{display:flex;align-items:center;gap:9px;background:#12151d;border:1px solid #2a3550;border-left:3px solid var(--xc,#c2f64a);border-radius:12px;padding:9px 13px;box-shadow:0 12px 34px rgba(0,0,0,.5);font-family:ui-monospace,Consolas,monospace;color:#e9e7df;transform:translateX(120%);opacity:0;transition:transform .4s cubic-bezier(.2,.9,.3,1.2),opacity .4s;max-width:260px}'
      + '.mpxp.on{transform:none;opacity:1}'
      + '.mpxp b{color:var(--xc,#c2f64a);font-size:15px;font-weight:800}.mpxp span{font-size:11.5px;color:#9aa3ad;line-height:1.2}'
      + '#mpxpLv{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;background:rgba(4,6,10,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .4s;pointer-events:none}'
      + '#mpxpLv.on{opacity:1;pointer-events:auto}'
      + '.mpxp-card{position:relative;background:radial-gradient(120% 90% at 50% 0,var(--lc)18,#0a0d13 60%);border:1px solid var(--lc);border-radius:22px;padding:34px 40px;text-align:center;max-width:360px;transform:scale(.8);transition:transform .5s cubic-bezier(.2,.9,.3,1.4);box-shadow:0 0 80px -20px var(--lc)}'
      + '#mpxpLv.on .mpxp-card{transform:none}'
      + '.mpxp-badge{width:96px;height:96px;margin:0 auto 14px;filter:drop-shadow(0 0 22px var(--lc))}'
      + '.mpxp-up{font-family:ui-monospace,Consolas,monospace;font-size:11px;letter-spacing:.28em;color:var(--lc);text-transform:uppercase}'
      + '.mpxp-nm{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:34px;color:var(--lc);margin:4px 0 6px;letter-spacing:-.02em}'
      + '.mpxp-sub{color:#c7ccd4;font-size:14px;line-height:1.5}.mpxp-sub b{color:#fff}'
      + '.mpxp-x{margin-top:18px;background:var(--lc);color:#0a0b0d;border:none;border-radius:11px;padding:11px 26px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}'
      + '.mpxp-cf{position:absolute;top:0;width:9px;height:14px;border-radius:2px;opacity:.9;animation:mpxpFall linear forwards}'
      + '@keyframes mpxpFall{0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:.2}}'
      + '@media(max-width:560px){.mpxp-card{padding:28px 26px;max-width:88vw}.mpxp-nm{font-size:28px}}';
    var st = document.createElement('style'); st.textContent = xpCss; document.head.appendChild(st);
    var seenKey = null, lastXp = null, lastIdx = null, watching = false;
    function key(uid) { return 'mp_xp_seen_' + uid; }
    function toast(amt, src, col) {
      var host = document.getElementById('mpxpT'); if (!host) { host = document.createElement('div'); host.id = 'mpxpT'; document.body.appendChild(host); }
      var el = document.createElement('div'); el.className = 'mpxp'; el.style.setProperty('--xc', col || '#c2f64a');
      el.innerHTML = '<b>+' + amt + '</b><span>XP<br>' + (SRCN[src] || src) + '</span>';
      host.appendChild(el); requestAnimationFrame(function () { el.classList.add('on'); });
      setTimeout(function () { el.classList.remove('on'); setTimeout(function () { el.remove(); }, 450); }, 3600);
    }
    function followToast(name) {
      var host = document.getElementById('mpxpT'); if (!host) { host = document.createElement('div'); host.id = 'mpxpT'; document.body.appendChild(host); }
      var el = document.createElement('div'); el.className = 'mpxp'; el.style.setProperty('--xc', '#38bdf8');
      el.innerHTML = '<b style="font-size:17px">★</b><span>New follower<br>' + (name ? '@' + esc(String(name).slice(0, 20)) : 'Someone followed you') + '</span>';
      host.appendChild(el); requestAnimationFrame(function () { el.classList.add('on'); });
      setTimeout(function () { el.classList.remove('on'); setTimeout(function () { el.remove(); }, 450); }, 4600);
      try { if (navigator.vibrate) navigator.vibrate([15, 40, 15]); } catch (e) {}
    }
    function celebrate(lv) {
      var ov = document.getElementById('mpxpLv'); if (!ov) { ov = document.createElement('div'); ov.id = 'mpxpLv'; document.body.appendChild(ov); }
      var col = lv.col || '#c2f64a';
      var conf = ''; for (var n = 0; n < 60; n++) { var cx = Math.floor(Math.random() * 100), d = (1.4 + Math.random() * 1.6).toFixed(2), dl = (Math.random() * 0.5).toFixed(2), cc = ['#c2f64a', col, '#ffd75a', '#38bdf8', '#ff6a3d'][n % 5]; conf += '<i class="mpxp-cf" style="left:' + cx + '%;background:' + cc + ';animation-duration:' + d + 's;animation-delay:' + dl + 's"></i>'; }
      ov.style.setProperty('--lc', col);
      ov.innerHTML = conf + '<div class="mpxp-card" style="--lc:' + col + '"><div class="mpxp-badge">' + (window.mpLvlSvg ? window.mpLvlSvg(lv.k, col) : '') + '</div><div class="mpxp-up">Level up</div><div class="mpxp-nm">' + esc(lv.name || '') + '</div><div class="mpxp-sub">You reached <b>' + esc(lv.name || '') + '</b>.' + (lv.next ? ' Next: ' + esc(lv.next) + ' at ' + (lv.nextMin || 0).toLocaleString() + ' XP.' : ' You hit the top tier!') + '</div><button class="mpxp-x" type="button">Nice</button></div>';
      requestAnimationFrame(function () { ov.classList.add('on'); });
      var close9 = function () { ov.classList.remove('on'); };
      ov.querySelector('.mpxp-x').addEventListener('click', close9);
      ov.addEventListener('click', function (e) { if (e.target === ov) close9(); });
      try { if (navigator.vibrate) navigator.vibrate([20, 40, 20]); } catch (e) {}
    }
    function check() {
      if (!ME) return;
      fetch('/api/auth/xp').then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.signedIn || !d.level) return;
        var uid = ME.id; var stored = null;
        try { stored = JSON.parse(localStorage.getItem(key(uid)) || 'null'); } catch (e) {}
        if (!stored) { // first observation for this device: seed silently (no toast flood)
          try { localStorage.setItem(key(uid), JSON.stringify({ xp: d.xp, idx: d.level.idx, ts: (d.log[0] || {}).ts || 0 })); } catch (e) {}
          lastXp = d.xp; lastIdx = d.level.idx; return;
        }
        // toast every log entry newer than the last seen ts (positive only), oldest-first
        var fresh = (d.log || []).filter(function (e) { return e.ts > (stored.ts || 0) && (+e.amt) > 0; }).sort(function (a, b) { return a.ts - b.ts; });
        fresh.slice(-4).forEach(function (e, ix) { setTimeout(function () { toast(+e.amt, e.src, d.level.col); }, ix * 550); });
        if (d.level.idx > (stored.idx != null ? stored.idx : d.level.idx)) setTimeout(function () { celebrate(d.level); }, fresh.length ? 700 : 0);
        try { localStorage.setItem(key(uid), JSON.stringify({ xp: d.xp, idx: d.level.idx, ts: (d.log[0] || {}).ts || stored.ts })); } catch (e) {}
        lastXp = d.xp; lastIdx = d.level.idx;
        // new-follower toast (same channel as XP): compare the follower count to what this device last saw
        if (typeof d.followers === 'number') { try {
          var fk = 'mp_foll_' + uid, fseen = null; try { fseen = JSON.parse(localStorage.getItem(fk)); } catch (e) {}
          if (fseen === null || typeof fseen !== 'number') { localStorage.setItem(fk, JSON.stringify(d.followers)); } // seed silently
          else if (d.followers > fseen) { var nm = d.lastFollower && d.lastFollower.name, dn = d.followers - fseen; setTimeout(function () { followToast(dn === 1 ? nm : (dn + ' new followers')); }, fresh.length ? 900 : 300); localStorage.setItem(fk, JSON.stringify(d.followers)); }
          else if (d.followers !== fseen) { localStorage.setItem(fk, JSON.stringify(d.followers)); } // unfollow → keep in sync, no toast
        } catch (e) {} }
      }).catch(function () {});
    }
    function startWatch() { if (watching || !ME) return; watching = true; setTimeout(check, 1500); setInterval(function () { if (!document.hidden) check(); }, 60000); document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); }); }
    window.mpXpCheck = check; // let other flows (after a trade/claim) nudge an immediate check
    window.addEventListener('mp-auth-change', function () { if (ME) startWatch(); });
    var _iv = setInterval(function () { if (ME) { startWatch(); clearInterval(_iv); } }, 800);
    setTimeout(function () { clearInterval(_iv); }, 20000);
  })();

  fetch('/api/auth/me').then(function (r) { return r.json(); }).then(function (d) { ME = d.user || null; BANNED = !!d.banned; reflect(); if (ME) { dwSince = Date.now(); syncTrades(); } }).catch(function () {});
})();
