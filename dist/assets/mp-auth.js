/* MarginPad — optional passwordless sign-in (email → 6-digit code).
   Self-contained: injects its own modal + styles, wires any [data-auth-open] trigger,
   updates any [data-auth-status] label, and exposes window.mpAuth. Anonymous use is unaffected. */
(function () {
  if (window.mpAuth) return;
  var ME = null, BANNED = false;
  try { var _q = new URLSearchParams(location.search), _rf = _q.get('ref'); if (_rf) { _rf = String(_rf).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40); localStorage.setItem('mp_ref', _rf); var _c = (_q.get('c') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24); if (_c) localStorage.setItem('mp_refc', _c); if (!sessionStorage.getItem('mp_reft')) { sessionStorage.setItem('mp_reft', '1'); var _u = '/api/reftrack?ref=' + encodeURIComponent(_rf) + (_c ? '&c=' + encodeURIComponent(_c) : ''); if (document.referrer) _u += '&r=' + encodeURIComponent(document.referrer); try { if (navigator.sendBeacon) navigator.sendBeacon(_u); else fetch(_u, { keepalive: true }); } catch (e2) {} } } } catch (e) {} // invite-a-friend: remember the referrer + campaign, and count the link visit once per session
  function refCode() { try { return localStorage.getItem('mp_ref') || ''; } catch (e) { return ''; } }
  function esc(s) { return String(s).replace(/[<>&]/g, function (m) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]; }); }
  // clean line-icon set (currentColor stroke) — replaces the emoji buttons
  var ICONS = {
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    feed: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m3 19 2-2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    spark: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    chev: '<path d="m9 18 6-6-6-6"/>',
    cam: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20v-.5a6 6 0 0 1 6-6h3a6 6 0 0 1 6 6v.5"/>',
    mail: '<rect x="2.5" y="5" width="19" height="14" rx="2.2"/><path d="m3 7 9 6 9-6"/>',
    cal: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    trades: '<path d="M3 16.5l6-6 4 4 7-7.5"/><path d="M16.5 6.5H21v4.5"/>',
    people: '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20v-.5a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v.5"/><path d="M16.5 4.4a3.4 3.4 0 0 1 0 6.6"/><path d="M21.5 20v-.5a5 5 0 0 0-3.4-4.7"/>',
    gift: '<rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M4 10h16M12 10v10M8 10c-2 0-3-1.2-3-2.6C5 6 6.3 5 7.6 5 9.6 5 12 7.5 12 10c0-2.5 2.4-5 4.4-5C17.7 5 19 6 19 7.4 19 8.8 18 10 16 10"/>'
  };
  function ic(name, cls) { return '<svg class="mpa-svg' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; }
  function tileBtn(id, icon, label, badgeId) { return '<button class="mpa-tile" id="' + id + '" type="button">' + ic(icon) + '<span class="mpa-tile-l">' + label + '</span>' + (badgeId ? '<span class="mpa-tile-dot" id="' + badgeId + '" hidden></span>' : '') + '</button>'; }
  function avatarHtml(av, cls) { av = av || ''; if (/^data:image\//.test(av)) return '<img class="mpa-av-img' + (cls ? ' ' + cls : '') + '" src="' + esc(av) + '" alt="">'; if (av) return '<span class="mpa-av-emoji' + (cls ? ' ' + cls : '') + '">' + esc(av) + '</span>'; return ''; }
  window.mpAvatarHtml = avatarHtml;
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
    return function () { try { if (window.mpProScan) window.mpProScan(); } catch (e) {} if (pend) return; pend = setTimeout(run, 220); }; // PRO gold rides the SAME synchronous post-render pass as level badges → no gold flash (was: gold applied on a 1.6s interval → name flashed normal→gold)
  })();

  function emailOk(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); }

  var css = '.mpa-modal{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(4,6,9,.7);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}'
    + '.mpa-modal[hidden]{display:none}'
    + '.mpa-panel{position:relative;width:100%;max-width:344px;max-height:calc(100vh - 32px);overflow-y:auto;background:linear-gradient(180deg,#14181f,#0c0f13);border:1px solid #283039;border-radius:16px;padding:11px 15px;box-shadow:0 30px 90px -20px rgba(0,0,0,.9);font-family:system-ui,-apple-system,Segoe UI,sans-serif;scrollbar-width:thin;scrollbar-color:#232a33 transparent}'
    + '.mpa-panel::-webkit-scrollbar{width:8px}.mpa-panel::-webkit-scrollbar-thumb{background:#232a33;border-radius:8px}'
    + '.mpa-x{position:absolute;top:12px;right:14px;background:none;border:none;color:#5c656f;font-size:19px;cursor:pointer;line-height:1;padding:4px}'
    + '.mpa-x:hover{color:#e9e7df}'
    + '.mpa-h{font-size:15px;font-weight:800;color:#f2f0e9;margin:0 0 5px;letter-spacing:-.01em}'
    + '.mpa-sub{font-size:13.5px;color:#9aa3ad;margin:0 0 16px;line-height:1.5}'
    + '.mpa-sub b{color:#cdd3da}'
    + '.mpa-in{width:100%;box-sizing:border-box;background:#0a0d11;border:1px solid #2f3742;border-radius:11px;padding:13px 14px;color:#f2f0e9;font-size:15px;outline:none;transition:border-color .15s}'
    + '.mpa-in:focus{border-color:#c2f64a}'
    + '.mpa-code{font-family:ui-monospace,Menlo,monospace;letter-spacing:8px;text-align:center;font-size:22px;font-weight:700}'
    + '.mpa-btn{width:100%;margin-top:11px;background:#c2f64a;color:#0a0b0d;font-weight:800;font-size:14.5px;border:none;border-radius:11px;padding:13px;cursor:pointer;transition:filter .15s}'
    + '.mpa-btn:hover{filter:brightness(1.06)}'
    + '.mpa-svg{width:18px;height:18px;flex:none;display:block}'
    // 2×2 tile grid for the social actions — one calm accent, monochrome icons
    + '.mpa-tiles{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0 0}'
    + '.mpa-tile{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:5px;background:#0f131a;border:1px solid #222a35;border-radius:11px;padding:6px 10px 5px;cursor:pointer;color:#cfd5dc;transition:border-color .15s,background .15s,transform .05s}'
    + '.mpa-tile .mpa-svg{width:20px;height:20px;color:#7f8a97;transition:color .15s}'
    + '.mpa-tile:hover{border-color:#38506a;background:#131923}.mpa-tile:hover .mpa-svg{color:#7fd6ff}.mpa-tile:active{transform:translateY(1px)}'
    + '.mpa-tile-l{font-size:13px;font-weight:700;letter-spacing:.01em}'
    + '.mpa-tile-dot{position:absolute;top:10px;right:11px;min-width:17px;height:17px;line-height:17px;padding:0 4px;box-sizing:border-box;text-align:center;background:#38bdf8;color:#04121c;border-radius:9px;font-size:10.5px;font-weight:800;font-family:ui-monospace,Consolas,monospace}'
    + '.mpa-tile-dot[hidden]{display:none}'
    // single-line secondary rows (edit, xp) — quiet, with a chevron
    + '.mpa-row2{display:flex;align-items:center;gap:10px;width:100%;margin-top:5px;background:#0f131a;border:1px solid #1e2530;border-radius:10px;padding:6px 11px;cursor:pointer;color:#cfd5dc;font-size:13.5px;font-weight:600;text-align:left;transition:border-color .15s,background .15s}'
    + '.mpa-row2:hover{border-color:#33404f;background:#131923}.mpa-row2 .mpa-svg{width:18px;height:18px;color:#7f8a97}.mpa-row2 span{flex:1}.mpa-row2 .mpa-svg:last-child{width:15px;height:15px;color:#556170}'
    // footer: support + sign out as quiet links
    + '.mpa-foot2{display:flex;gap:10px;margin-top:7px}'
    + '.mpa-flink{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;background:transparent;border:1px solid #1e2530;border-radius:10px;padding:10px;color:#8b97a5;font-size:12.5px;font-weight:600;cursor:pointer;transition:color .15s,border-color .15s}'
    + '.mpa-flink:hover{color:#cfd5dc;border-color:#33404f}.mpa-flink .mpa-svg{width:15px;height:15px}'
    // avatar image (upload) + emoji fallback
    + '.mpa-av-img{width:100%;height:100%;object-fit:cover;display:block}'
    + '.mpa-avedit{display:flex;align-items:center;gap:14px;margin-top:4px}'
    + '.mpa-avdrop{position:relative;width:76px;height:76px;flex:none;border-radius:50%;border:1px dashed #38506a;background:#0f131a;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#5f6b78;padding:0;transition:border-color .15s}'
    + '.mpa-avdrop:hover{border-color:#7fd6ff}.mpa-avdrop.has{border-style:solid;border-color:#2a3340}'
    + '.mpa-avdrop .mpa-svg{width:26px;height:26px}'
    + '.mpa-avdrop .mpa-av-emoji{font-size:38px;line-height:1}'
    + '.mpa-avcam{position:absolute;right:-1px;bottom:-1px;width:26px;height:26px;border-radius:50%;background:#38bdf8;color:#04121c;display:flex;align-items:center;justify-content:center;border:2px solid #0d1117}'
    + '.mpa-avdrop:not(.has) .mpa-avcam{display:none}.mpa-avcam .mpa-svg{width:13px;height:13px}'
    + '.mpa-avside{flex:1;min-width:0}.mpa-avttl{font-size:13.5px;font-weight:700;color:#e9edf1}.mpa-avsub{font-size:11.5px;color:#5c656f;margin-top:2px}'
    + '.mpa-avbtns{display:flex;gap:8px;margin-top:9px}'
    + '.mpa-avbtn{background:#182029;color:#cfd5dc;border:1px solid #2a3340;border-radius:9px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;transition:border-color .15s,background .15s}.mpa-avbtn:hover{border-color:#38506a;background:#1b232d}'
    + '.mpa-avbtn.ghost{background:transparent;color:#8b97a5}.mpa-avbtn.ghost:hover{color:#ff8a80;border-color:rgba(255,90,77,.4)}'
    + '.mpa-avbtn[hidden]{display:none}'
    // support: conversation list
    + '.mpa-cvlist{display:flex;flex-direction:column;gap:8px;max-height:min(52vh,420px);overflow-y:auto;scrollbar-width:thin;scrollbar-color:#232a33 #0a0d11}'
    + '.mpa-cvlist::-webkit-scrollbar{width:9px}.mpa-cvlist::-webkit-scrollbar-thumb{background:#232a33;border:2px solid #0a0d11;border-radius:8px}'
    + '.mpa-cv{text-align:left;background:#0f131a;border:1px solid #1f2732;border-radius:12px;padding:11px 13px;cursor:pointer;transition:border-color .15s,background .15s}.mpa-cv:hover{border-color:#33404f;background:#131923}'
    + '.mpa-cv-top{display:flex;align-items:center;gap:8px}.mpa-cv-ttl{flex:1;min-width:0;font-size:13.5px;font-weight:700;color:#e9edf1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.mpa-cv-st{flex:none;font-size:10px;font-weight:800;letter-spacing:.03em;border-radius:20px;padding:2px 8px}.mpa-cv-st.open{color:#34d99a;border:1px solid rgba(52,217,154,.4)}.mpa-cv-st.closed{color:#8b97a5;border:1px solid #2f3742}'
    + '.mpa-cv-last{font-size:12px;color:#8b97a5;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.mpa-cv-ago{font-size:10.5px;color:#5c656f;font-family:ui-monospace,Consolas,monospace;margin-top:4px}'
    + '.mpa-btn:disabled{opacity:.55;cursor:default}'
    + '.mpa-msg{font-size:12.5px;margin-top:10px;min-height:16px;color:#9aa3ad;text-align:center}'
    + '.mpa-msg.err{color:#ff8a80}.mpa-msg.ok{color:#41e3a3}'
    + '.mpa-link{display:block;margin:9px auto 0;background:none;border:none;color:#7f8893;font-size:12.5px;cursor:pointer}'
    + '.mpa-link:hover{color:#c2f64a}'
    + '.mpa-foot{font-size:11px;color:#5c656f;text-align:center;margin-top:14px;line-height:1.5}'
    + '.mpa-prof{background:#0a0d11;border:1px solid #2f3742;border-radius:11px;padding:6px 11px;margin:0 0 4px;display:grid;grid-template-columns:1fr 1fr;gap:0 12px}'
    + '.mpa-prow{display:flex;flex-direction:column;align-items:flex-start;gap:0;padding:4px 0;border-bottom:1px solid #171d24;font-size:12.5px;min-width:0;width:100%}.mpa-prow--wide{grid-column:1/-1}'
    + '.mpa-prof>.mpa-prow:last-child,.mpa-prof>.mpa-prow:nth-last-child(2):nth-child(odd){border-bottom:none}'
    + '.mpa-prow span{color:#8a93a0;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}.mpa-prow b{color:#f2f0e9;font-weight:700;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}'
    + '.mpa-stat3{display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:7px;margin:0 0 6px}'
    + '.mpa-st{background:#0a0d11;border:1px solid #232b34;border-radius:10px;padding:7px 6px;text-align:center;min-width:0}'
    + '.mpa-st b{display:block;color:#f2f0e9;font-weight:700;font-size:13px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.mpa-st span{display:block;color:#8a93a0;font-size:9px;text-transform:uppercase;letter-spacing:.03em;margin-top:2px}'
    + '.mpa-lvl{background:linear-gradient(160deg,#12151d,#0a0d11);border:1px solid #2a3140;border-radius:12px;padding:7px 11px;margin:0 0 5px;position:relative;overflow:hidden}'
    + '.mpa-lvl-top{display:flex;align-items:center;gap:9px}'
    + '.mpa-lvl-badge{width:28px;height:28px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none;box-shadow:0 0 18px -4px var(--lc)}'
    + '.mpa-lvl-nm{font-weight:800;font-size:14px;color:var(--lc)}'
    + '.mpa-lvl-xp{font-size:11.5px;color:#8a93a0;font-family:ui-monospace,Consolas,monospace;margin-top:1px}'
    + '.mpa-lvl-next{margin-left:auto;text-align:right;font-size:10.5px;color:#5c656f;font-family:ui-monospace,Consolas,monospace}'
    + '.mpa-lvl-bar{height:5px;border-radius:5px;background:#1a2027;overflow:hidden;margin-top:6px}'
    + '.mpa-lvl-bar i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,var(--lc),#ffffff88);transition:width .6s ease}'
    + '.mpa-lvl-link{display:inline-flex;align-items:center;gap:4px;margin-top:5px;font-size:11px;font-weight:700;color:#c2f64a;text-decoration:none}.mpa-lvl-link:hover{text-decoration:underline}'
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
    + '.mpa-dm-form{display:flex;gap:8px;margin-top:8px}.mpa-sup-img{max-width:200px;max-height:230px;border-radius:9px;display:block;margin-bottom:4px}.mpa-dm-form .mpa-in{flex:1}'
    + '.mpa-dm-send{background:#38bdf8;color:#04121c;font-weight:800;border:none;border-radius:11px;padding:0 16px;cursor:pointer}'
    + '.mpa-dm-send:disabled{opacity:.5;cursor:default}'
    + '.mpa-xp-tot{font-family:ui-monospace,Consolas,monospace;font-size:13px;color:#9aa3ad;margin:2px 0 10px}.mpa-xp-tot b{color:#c9a5ff;font-size:16px}'
    + '.mpa-xp-sum{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 11px}.mpa-xp-chip{font-family:ui-monospace,Consolas,monospace;font-size:11px;font-weight:700;color:#c9a5ff;background:rgba(180,140,255,.1);border:1px solid rgba(180,140,255,.28);border-radius:20px;padding:4px 10px}.mpa-xp-chip b{color:#e6d8ff}.mpa-xp-chip.neg{color:#ff8a80;background:rgba(255,120,110,.1);border-color:rgba(255,120,110,.28)}.mpa-xp-chip.neg b{color:#ffb3ab}'
    + '.mpa-xp-list{display:flex;flex-direction:column;max-height:min(50vh,400px);overflow-y:auto;background:#0a0d11;border:1px solid #2f3742;border-radius:12px;padding:2px 12px}'
    + '.mpa-xp-r{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid #1a2027}.mpa-xp-r:last-child{border-bottom:none}'
    + '.mpa-xp-amt{flex:0 0 auto;min-width:46px;font-family:ui-monospace,Consolas,monospace;font-weight:800;font-size:13.5px}.mpa-xp-amt.pos{color:#c9a5ff}.mpa-xp-amt.neg{color:#ff8a80}'
    + '.mpa-xp-b{flex:1;min-width:0}.mpa-xp-lbl{display:block;font-size:13px;font-weight:700;color:#f2f0e9}.mpa-xp-note{display:block;font-size:11px;color:#7f8893;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}'
    + '.mpa-xp-ago{flex:0 0 auto;font-size:10.5px;color:#5c656f;font-family:ui-monospace,Consolas,monospace;white-space:nowrap}'
    + '.mpa-xp-empty{color:#5c656f;font-size:13px;text-align:center;padding:22px 8px;line-height:1.6}'
    + '.mpa-xp-list,.mpa-dm-scroll{scrollbar-width:thin;scrollbar-color:#232a33 #0a0d11}'
    + '.mpa-xp-list::-webkit-scrollbar,.mpa-dm-scroll::-webkit-scrollbar{width:9px;height:9px}'
    + '.mpa-xp-list::-webkit-scrollbar-track,.mpa-dm-scroll::-webkit-scrollbar-track{background:#0a0d11;border-radius:8px}'
    + '.mpa-xp-list::-webkit-scrollbar-thumb,.mpa-dm-scroll::-webkit-scrollbar-thumb{background:#232a33;border:2px solid #0a0d11;border-radius:8px}'
    + '.mpa-xp-list::-webkit-scrollbar-thumb:hover,.mpa-dm-scroll::-webkit-scrollbar-thumb:hover{background:#333d4a}'
    + '.mpa-ib{display:flex;flex-direction:column;max-height:min(56vh,440px);overflow-y:auto;margin:2px 0;scrollbar-width:thin;scrollbar-color:#232a33 #0a0d11}'
    + '.mpa-ib::-webkit-scrollbar{width:9px}.mpa-ib::-webkit-scrollbar-track{background:#0a0d11}.mpa-ib::-webkit-scrollbar-thumb{background:#232a33;border:2px solid #0a0d11;border-radius:8px}'
    + '.mpa-ib-r{display:flex;align-items:center;gap:10px;padding:11px 4px;border-bottom:1px solid #1a2027;cursor:pointer;text-align:left;background:none;border-left:none;border-right:none;border-top:none;width:100%}'
    + '.mpa-ib-r:hover{background:rgba(255,255,255,.02)}'
    + '.mpa-ib-av{width:34px;height:34px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-weight:800;color:#0a0b0d;font-size:14px}'
    + '.mpa-ib-b{flex:1;min-width:0}.mpa-ib-nm{font-size:13.5px;font-weight:700;color:#f2f0e9;display:flex;align-items:center;gap:4px}'
    + '.mpa-ib-last{font-size:12px;color:#7f8893;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}'
    + '.mpa-ib-meta{flex:none;text-align:right;font-size:10.5px;color:#5c656f;font-family:ui-monospace,Consolas,monospace;white-space:nowrap}'
    + '.mpa-ib-un{display:inline-block;min-width:18px;height:18px;line-height:18px;padding:0 5px;background:#38bdf8;color:#04121c;border-radius:9px;font-size:10.5px;font-weight:800;text-align:center;margin-top:3px}'
    + '.mpa-dmh{display:flex;align-items:center;gap:8px;margin:0 0 8px}.mpa-dmh .mpa-ib-av{width:30px;height:30px}.mpa-dmh .mpa-ib-nm{font-size:15px}'
    + '.mpa-dbub{max-width:82%;padding:9px 12px;border-radius:13px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word}'
    + '.mpa-dbub.them{align-self:flex-start;background:#1a2530;border:1px solid #2f3742;color:#eaf1f7;border-bottom-left-radius:4px}'
    + '.mpa-dbub.me{align-self:flex-end;background:#123240;border:1px solid rgba(56,189,248,.4);color:#dff2fb;border-bottom-right-radius:4px}'
    + '.mpa-dbub .t{display:block;font-size:9.5px;color:#5c656f;margin-top:3px;text-align:right;font-family:ui-monospace,Consolas,monospace}'
    + '.mpa-dm-warn{font-size:12px;color:#ffb347;text-align:center;padding:9px;line-height:1.5;background:rgba(255,179,71,.08);border:1px solid rgba(255,179,71,.25);border-radius:10px;margin-top:8px}'
    + '.mpa-dm-badge{display:inline-block;min-width:16px;height:16px;line-height:16px;padding:0 5px;margin-left:6px;background:#38bdf8;color:#04121c;border-radius:9px;font-size:10px;font-weight:800;vertical-align:middle}'
    + '.mpa-trig-dot{position:absolute;top:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:#38bdf8;border:2px solid #0a0b0d;z-index:6;pointer-events:none}'
    + '.mpa-fd{display:flex;flex-direction:column;max-height:min(58vh,460px);overflow-y:auto;margin:2px 0;scrollbar-width:thin;scrollbar-color:#232a33 #0a0d11}'
    + '.mpa-fd::-webkit-scrollbar{width:9px}.mpa-fd::-webkit-scrollbar-track{background:#0a0d11}.mpa-fd::-webkit-scrollbar-thumb{background:#232a33;border:2px solid #0a0d11;border-radius:8px}'
    + '.mpa-fd-r{display:flex;align-items:center;gap:10px;padding:10px 2px;border-bottom:1px solid #1a2027}.mpa-fd-r:last-child{border-bottom:none}'
    + '.mpa-fd-b{flex:1;min-width:0}.mpa-fd-nm{font-size:13px;font-weight:700;color:#f2f0e9;display:flex;align-items:center}'
    + '.mpa-fd-act{font-size:12.5px;color:#c7cdd4;margin-top:2px;line-height:1.4}.mpa-fd-act b{font-weight:800}'
    + '.fd-op{color:#7fd6ff}.fd-win{color:#34d99a}.fd-liq{color:#c78bff}.fd-long{color:#34d99a;font-weight:800}.fd-short{color:#ff6c5c;font-weight:800}.fd-pos{color:#34d99a;font-weight:700}.fd-neg{color:#ff8a80;font-weight:700}'
    + '.mpa-fd-meta{flex:none;text-align:right;font-size:10.5px;color:#5c656f;font-family:ui-monospace,Consolas,monospace;white-space:nowrap;display:flex;flex-direction:column;align-items:flex-end;gap:4px}'
    + '.mpa-fd-dm{background:none;border:none;cursor:pointer;font-size:14px;padding:2px;opacity:.7;line-height:1}.mpa-fd-dm:hover{opacity:1}'
    + '.mpa-du{display:flex;flex-direction:column;gap:6px;max-height:min(58vh,460px);overflow-y:auto;margin:2px 0;scrollbar-width:thin;scrollbar-color:#232a33 #0a0d11}'
    + '.mpa-du::-webkit-scrollbar{width:9px}.mpa-du::-webkit-scrollbar-track{background:#0a0d11}.mpa-du::-webkit-scrollbar-thumb{background:#232a33;border:2px solid #0a0d11;border-radius:8px}'
    + '.mpa-du-sec{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7f8893;margin:8px 0 2px}'
    + '.mpa-du-r{display:flex;align-items:center;gap:10px;padding:11px 12px;background:#0a0d11;border:1px solid #1f2732;border-radius:12px}'
    + '.mpa-du-b{flex:1;min-width:0}.mpa-du-nm{font-size:13.5px;font-weight:700;color:#f2f0e9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mpa-du-met{font-size:11.5px;color:#8b97a5;margin-top:2px}'
    + '.mpa-du-acts{display:flex;gap:6px;flex:none}.mpa-du-y{background:#1c3b2c;color:#48e39b;border:1px solid rgba(52,217,154,.4);border-radius:9px;padding:7px 12px;font-weight:800;font-size:12px;cursor:pointer}.mpa-du-n{background:#2a1618;color:#ff8a80;border:1px solid rgba(255,90,77,.35);border-radius:9px;padding:7px 12px;font-weight:800;font-size:12px;cursor:pointer}'
    + '.mpa-du-sc{display:flex;align-items:center;gap:8px;flex:none;font-family:ui-monospace,Consolas,monospace;font-size:13px;font-weight:800;color:#c7cdd4}.mpa-du-sc i{font-style:normal;font-size:10px;color:#5c656f;font-weight:400}.mpa-du-sc .w{color:#c2f64a}'
    + '.mpa-du-wait{flex:none;color:#5c656f;font-size:18px;letter-spacing:2px}'
    + '.mpa-du-won{flex:none;font-weight:800;font-size:11px;color:#0a0b0d;background:#c2f64a;border-radius:20px;padding:4px 11px}.mpa-du-lost{flex:none;font-weight:800;font-size:11px;color:#ff8a80;border:1px solid rgba(255,90,77,.4);border-radius:20px;padding:3px 10px}.mpa-du-tie{flex:none;font-weight:800;font-size:11px;color:#8b97a5;border:1px solid #2f3742;border-radius:20px;padding:3px 10px}'
    + '.mpa-du-pick{display:flex;flex-direction:column;gap:9px}.mpa-du-opt{text-align:left;background:#0a0d11;border:1px solid #2f3742;border-radius:12px;padding:13px 15px;cursor:pointer;transition:border-color .15s,background .15s}.mpa-du-opt:hover{border-color:#ff9640;background:#160f0a}.mpa-du-opt b{display:block;color:#f2f0e9;font-size:14px}.mpa-du-opt span{display:block;color:#8b97a5;font-size:12px;margin-top:2px}.mpa-du-opt:disabled{opacity:.5;cursor:default}'
    + '.mpa-du-msg{font-size:12.5px;text-align:center;margin:12px 0 2px;min-height:16px}'
    + '.mpa-dt-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:2px 0 4px}'
    + '.mpa-dt{position:relative;text-align:left;background:#0a0d11;border:1px solid #232b36;border-radius:13px;padding:12px 11px 11px;cursor:pointer;transition:border-color .16s,background .16s,transform .1s;overflow:hidden;-webkit-appearance:none;appearance:none;font:inherit;color:inherit}'
    + '.mpa-dt:hover{border-color:#3a4552}.mpa-dt:active{transform:scale(.985)}'
    + '.mpa-dt.on{border-color:#f5a623;background:linear-gradient(158deg,rgba(245,166,35,.15),rgba(245,166,35,.02))}'
    + '.mpa-dt.on::before{content:"";position:absolute;top:10px;right:10px;width:13px;height:13px;border-radius:50%;background:#f5a623;box-shadow:0 0 0 3px rgba(245,166,35,.16)}'
    + '.mpa-dt-ic{display:block;width:26px;height:26px;color:#f5a623;margin-bottom:8px}.mpa-dt-ic svg{width:100%;height:100%;display:block}'
    + '.mpa-dt-nm{display:block;font-size:13px;font-weight:800;color:#f2f0e9}.mpa-dt-ds{display:block;font-size:10.5px;line-height:1.36;color:#8b97a5;margin-top:3px}'
    + '.mpa-dt-pro{position:absolute;top:10px;right:10px;font-size:8.5px;font-weight:800;letter-spacing:.06em;color:#0a0b0d;background:linear-gradient(90deg,#f5a623,#ffce5a);border-radius:5px;padding:2px 5px}'
    + '.mpa-dt.lk{opacity:.7}.mpa-dt.lk .mpa-dt-ic{color:#6b7581}.mpa-dt.lk:hover{border-color:#f5a623}'
    + '.mpa-fld{margin:14px 0 0}.mpa-fld-l{font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#7f8893;margin:0 0 7px;display:flex;justify-content:space-between;align-items:center;gap:8px}.mpa-fld-l em{font-style:normal;color:#5c656f;text-transform:none;letter-spacing:0;font-weight:600}'
    + '.mpa-seg{display:flex;gap:5px;background:#0a0d11;border:1px solid #232b36;border-radius:11px;padding:4px}'
    + '.mpa-seg b{flex:1;text-align:center;font-size:12px;font-weight:700;color:#8b97a5;padding:8px 4px;border-radius:8px;cursor:pointer;position:relative;transition:color .14s,background .14s}'
    + '.mpa-seg b.on{background:#f5a623;color:#0a0b0d}.mpa-seg b.lk{opacity:.55}.mpa-seg b.lk::after{content:"PRO";position:absolute;top:-7px;right:1px;font-size:7px;font-weight:800;color:#f5a623;letter-spacing:.04em}'
    + '.mpa-stk{display:flex;gap:6px;flex-wrap:wrap}'
    + '.mpa-stk .c{font-family:ui-monospace,Consolas,monospace;font-size:12px;font-weight:800;color:#c7cdd4;background:#0a0d11;border:1px solid #232b36;border-radius:9px;padding:8px 13px;cursor:pointer;transition:.14s;-webkit-appearance:none;appearance:none}.mpa-stk .c.on{border-color:#f5a623;color:#f5a623;background:rgba(245,166,35,.1)}.mpa-stk .c.lk{opacity:.42}'
    + '.mpa-stk-info{display:flex;justify-content:space-between;font-size:11.5px;margin-top:9px;color:#8b97a5}.mpa-stk-info b{color:#c2f64a;font-family:ui-monospace,Consolas,monospace}'
    + '.mpa-symin{width:100%;box-sizing:border-box;background:#0a0d11;border:1px solid #232b36;border-radius:10px;padding:10px 12px;color:#f2f0e9;font-size:13px;font-family:ui-monospace,Consolas,monospace;text-transform:uppercase;letter-spacing:.04em}.mpa-symin::placeholder{color:#5c656f;letter-spacing:0}.mpa-symin:focus{outline:none;border-color:#f5a623}'
    + '.mpa-send{width:100%;margin-top:16px;background:linear-gradient(90deg,#f5a623,#ff8a3d);color:#0a0b0d;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:800;cursor:pointer;transition:filter .15s,transform .1s;box-shadow:0 6px 22px rgba(245,166,35,.22);-webkit-appearance:none;appearance:none}.mpa-send:hover{filter:brightness(1.06)}.mpa-send:active{transform:translateY(1px)}.mpa-send:disabled{opacity:.5;cursor:default;box-shadow:none;filter:none}'
    + '.mpa-ups{margin-top:13px;background:linear-gradient(158deg,rgba(245,166,35,.11),rgba(245,166,35,.015));border:1px solid rgba(245,166,35,.32);border-radius:12px;padding:12px 13px}.mpa-ups b{color:#f5a623;font-size:12.5px;font-weight:800}.mpa-ups p{margin:5px 0 10px;font-size:11.5px;color:#a9b3bf;line-height:1.45}.mpa-ups button{background:#f5a623;color:#0a0b0d;border:none;border-radius:9px;padding:9px 15px;font-size:12px;font-weight:800;cursor:pointer;-webkit-appearance:none;appearance:none}'
    + '.mpa-dv{background:linear-gradient(165deg,#0d1117,#0a0d11);border:1px solid #1f2732;border-radius:14px;padding:13px 14px;position:relative;overflow:hidden;flex-shrink:0}'
    + '.mpa-dv-top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px}.mpa-dv-ty{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#f5a623}.mpa-dv-ty svg{width:14px;height:14px}.mpa-dv-tl{font-size:11px;font-family:ui-monospace,Consolas,monospace;color:#8b97a5;flex:none}'
    + '.mpa-dv-vs{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px}.mpa-dv-side{text-align:center;min-width:0}.mpa-dv-nm{font-size:11px;color:#8b97a5;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mpa-dv-val{font-family:ui-monospace,Consolas,monospace;font-size:19px;font-weight:800;color:#c7cdd4;line-height:1.2}.mpa-dv-side.w .mpa-dv-val{color:#c2f64a}.mpa-dv-side.w .mpa-dv-nm{color:#c2f64a}.mpa-dv-mid{font-size:10px;font-weight:800;color:#5c656f;letter-spacing:.12em}'
    + '.mpa-dv-bar{height:4px;background:#141a22;border-radius:3px;margin-top:13px;overflow:hidden}.mpa-dv-bar i{display:block;height:100%;background:linear-gradient(90deg,#f5a623,#ff8a3d);border-radius:3px;transition:width .4s}'
    + '.mpa-dv-ft{display:flex;justify-content:space-between;align-items:center;margin-top:9px;font-size:10.5px;color:#7f8893}.mpa-pot{font-family:ui-monospace,Consolas,monospace;color:#c2f64a;font-weight:800}.mpa-dv-ft>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;margin-right:8px}.mpa-dv-ft .mpa-pot{flex:none}'
    + '.mpa-dtag{display:inline-block;font-size:9.5px;font-weight:800;color:#8b97a5;background:#141a22;border:1px solid #232b36;border-radius:5px;padding:2px 6px;margin-left:6px;vertical-align:middle}'
    + '.mpa-dv-val{max-width:100%}'
    + '.mpa-di{background:linear-gradient(158deg,rgba(245,166,35,.1),#0a0d11);border:1px solid rgba(245,166,35,.34);border-radius:14px;padding:13px 14px}'
    + '.mpa-di-top{display:flex;align-items:center;gap:10px;margin-bottom:9px}.mpa-di-ic{flex:none;width:30px;height:30px;color:#f5a623}.mpa-di-ic svg{width:100%;height:100%;display:block}'
    + '.mpa-di-h{min-width:0;flex:1}.mpa-di-h b{display:block;font-size:13.5px;color:#f2f0e9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mpa-di-h span{display:block;font-size:11px;color:#f5a623;font-weight:700;margin-top:1px}'
    + '.mpa-di-rule{font-size:12px;color:#c7cdd4;line-height:1.4;margin-bottom:11px}'
    + '.mpa-di-terms{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px}.mpa-di-tm{flex:1 1 30%;min-width:0;background:#0a0d11;border:1px solid #232b36;border-radius:9px;padding:7px 9px;font-size:12px;font-weight:700;color:#e9e7df;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mpa-di-tm i{display:block;font-style:normal;font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#7f8893;margin-bottom:2px}.mpa-di-stake{color:#c2f64a;border-color:rgba(194,246,74,.32)}'
    + '.mpa-di-acts{display:flex;gap:8px}.mpa-di-acts .mpa-du-y{flex:1;padding:10px}.mpa-di-acts .mpa-du-n{flex:none;padding:10px 14px}'
    + '.mpa-pl{display:block;font-size:11px;color:#9aa3ad;margin:0 0 5px;font-weight:600}'
    + '.mpa-pacc{display:flex;gap:8px;flex-wrap:wrap}.mpa-pc{width:30px;height:30px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0;transition:transform .1s}.mpa-pc:hover{transform:scale(1.1)}.mpa-pc.on{border-color:#fff;box-shadow:0 0 0 2px #0a0d11,0 0 0 4px currentColor}'
    + '.mpa-nf{display:flex;flex-direction:column;max-height:min(58vh,460px);overflow-y:auto;margin:2px 0;scrollbar-width:thin;scrollbar-color:#232a33 #0a0d11}'
    + '.mpa-nf::-webkit-scrollbar{width:9px}.mpa-nf::-webkit-scrollbar-track{background:#0a0d11}.mpa-nf::-webkit-scrollbar-thumb{background:#232a33;border:2px solid #0a0d11;border-radius:8px}'
    + '.mpa-nf-r{display:flex;gap:11px;align-items:flex-start;padding:11px 4px;border-bottom:1px solid #1a2027}.mpa-nf-r:last-child{border-bottom:none}.mpa-nf-r[role=button]{cursor:pointer}.mpa-nf-r[role=button]:hover{background:rgba(255,255,255,.02)}'
    + '.mpa-nf-r.unseen{background:rgba(180,140,255,.06)}.mpa-nf-r.unseen .mpa-nf-b{color:#f2f0e9}'
    + '.mpa-nf-ic{flex:none;font-size:16px;line-height:1.3;width:22px;text-align:center}'
    + '.mpa-nf-b{flex:1;min-width:0;font-size:13px;line-height:1.45;color:#c7cdd4}.mpa-nf-ago{display:block;font-size:10.5px;color:#5c656f;font-family:ui-monospace,Consolas,monospace;margin-top:3px}'
    + '.mpa-badge{display:inline-block;min-width:16px;height:16px;line-height:16px;padding:0 4px;margin-left:6px;background:#ff5a4d;color:#fff;border-radius:9px;font-size:10px;font-weight:800;text-align:center;vertical-align:middle}'
    + '.mpa-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff5a4d;margin-left:5px;vertical-align:middle}'
    // glowing notification ping pinned to the account button's corner — an unread message from the MarginPad team
    // must be impossible to miss (a static inline dot wasn't)
    + '.mpa-ping{position:absolute;top:-4px;right:-4px;width:11px;height:11px;border-radius:50%;background:#ff5a4d;border:2px solid #0a0b0d;z-index:6;pointer-events:none;animation:mpaPing 1.5s ease-out infinite}'
    + '@keyframes mpaPing{0%{box-shadow:0 0 0 0 rgba(255,90,77,.75),0 0 8px rgba(255,90,77,.9)}70%{box-shadow:0 0 0 10px rgba(255,90,77,0),0 0 8px rgba(255,90,77,.9)}100%{box-shadow:0 0 0 0 rgba(255,90,77,0),0 0 8px rgba(255,90,77,.9)}}'
    + '@media(prefers-reduced-motion:reduce){.mpa-ping{animation:none;box-shadow:0 0 8px rgba(255,90,77,.9)}}'
    // profile-card frame cosmetics — applied to the real card (.lbm-card) AND the customize-panel swatch (.mpa-fr-sw)
    + '@property --mpAng{syntax:"<angle>";initial-value:0deg;inherits:false}'
    + '@keyframes mpaSpin{to{--mpAng:360deg}}'
    // --- LEVEL TIERS (earned by XP) — restrained, escalate softly ---
    + '.lbm-card.frame-silver,.mpa-fr-sw.frame-silver{border-color:#c3cdda;box-shadow:0 0 0 1px rgba(195,205,218,.55),0 16px 54px -24px rgba(195,205,218,.42)}'
    + '.lbm-card.frame-gold,.mpa-fr-sw.frame-gold{border-color:#ffcf3f;box-shadow:0 0 0 1px rgba(255,207,63,.55),0 0 24px -14px rgba(255,207,63,.4),0 16px 54px -24px rgba(255,207,63,.4)}'
    + '.lbm-card.frame-platinum,.mpa-fr-sw.frame-platinum{border-color:#8fe6ff;box-shadow:0 0 0 1px rgba(143,230,255,.6),0 0 28px -12px rgba(143,230,255,.42),inset 0 1px 0 rgba(255,255,255,.14),0 16px 54px -24px rgba(143,230,255,.4)}'
    + '.lbm-card.frame-diamond,.mpa-fr-sw.frame-diamond{position:relative;border-color:transparent;box-shadow:0 0 0 1px rgba(190,160,255,.75),0 0 44px -8px rgba(157,120,255,.65),0 0 110px -30px rgba(120,190,255,.6),inset 0 0 46px -24px rgba(200,180,255,.72),0 22px 70px -28px rgba(0,0,0,.8);animation:mpaDiaHalo 4.6s ease-in-out infinite}'
    + '@keyframes mpaDiaHalo{0%,100%{box-shadow:0 0 0 1px rgba(190,160,255,.6),0 0 36px -10px rgba(157,120,255,.5),0 0 90px -32px rgba(120,190,255,.48),inset 0 0 46px -24px rgba(200,180,255,.6),0 22px 70px -28px rgba(0,0,0,.8)}50%{box-shadow:0 0 0 1px rgba(220,200,255,.95),0 0 62px -4px rgba(170,135,255,.8),0 0 150px -24px rgba(140,205,255,.7),inset 0 0 50px -20px rgba(215,200,255,.9),0 22px 70px -28px rgba(0,0,0,.8)}}'
    + '.lbm-card.frame-legendary,.mpa-fr-sw.frame-legendary{position:relative;border-color:transparent;box-shadow:0 0 0 1px rgba(255,150,50,.8),0 0 54px -8px rgba(255,120,30,.65),0 0 130px -30px rgba(255,90,20,.55),inset 0 0 50px -24px rgba(255,180,90,.62),0 24px 74px -28px rgba(0,0,0,.82);animation:mpaFrLeg 3.4s ease-in-out infinite}'
    + '@keyframes mpaFrLeg{0%,100%{box-shadow:0 0 0 1px rgba(255,150,50,.6),0 0 40px -12px rgba(255,120,30,.5),0 0 100px -34px rgba(255,90,20,.42),inset 0 0 50px -24px rgba(255,180,90,.5),0 24px 74px -28px rgba(0,0,0,.82)}50%{box-shadow:0 0 0 1px rgba(255,196,90,.95),0 0 78px -4px rgba(255,140,40,.85),0 0 170px -22px rgba(255,105,25,.7),inset 0 0 54px -18px rgba(255,205,120,.85),0 24px 74px -28px rgba(0,0,0,.82)}}'
    // --- PREMIUM (paid) — animated glow / spinning aurora ring ---
    + '.lbm-card.frame-neon,.mpa-fr-sw.frame-neon{border-color:#c2f64a;box-shadow:0 0 0 1px #c2f64a,0 0 42px -6px rgba(194,246,74,.6);animation:mpaFrNeon 2.6s ease-in-out infinite}'
    + '@keyframes mpaFrNeon{0%,100%{box-shadow:0 0 0 1px #c2f64a,0 0 30px -8px rgba(194,246,74,.5)}50%{box-shadow:0 0 0 1px #d8ff6a,0 0 58px -4px rgba(194,246,74,.9)}}'
    + '.lbm-card.frame-aurora,.mpa-fr-sw.frame-aurora{position:relative;border-color:transparent;box-shadow:0 0 40px -14px rgba(139,92,255,.5),0 18px 60px -26px rgba(0,0,0,.7)}'
    + '.lbm-card.frame-aurora::after,.mpa-fr-sw.frame-aurora::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:conic-gradient(from var(--mpAng),#38bdf8,#8b5cff,#ff5a4d,#ffd75a,#c2f64a,#38bdf8);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 7s linear infinite}'
    /* ===== FRAMES v2 (THE VAULT, 2026-08-14): richer materials for level frames + the 10 shop frames.
       Ring technique = the proven aurora ::after conic/linear + xor mask. Selectors mirror the existing pair. ===== */
    + '.lbm-card.frame-silver::after,.mpa-fr-sw.frame-silver::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:linear-gradient(160deg,#eef3fa,#8fa0b4 38%,#dfe7f1 52%,#6f7f92 78%,#cdd8e4);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-gold::after,.mpa-fr-sw.frame-gold::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:linear-gradient(160deg,#fff3b0,#c98f1b 40%,#ffe98a 55%,#8a5c00 80%,#ffd54a);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-platinum::after,.mpa-fr-sw.frame-platinum::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:linear-gradient(160deg,#ffffff,#9adfff 42%,#e8fbff 58%,#5a90a8 82%,#cfeefc);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-diamond::after,.mpa-fr-sw.frame-diamond::after{content:"";position:absolute;inset:-2.4px;border-radius:inherit;padding:2.4px;pointer-events:none;z-index:6;background:conic-gradient(from var(--mpAng,0deg),#f2ecff,#9d78ff 14%,#5ad0ff 30%,#ffffff 46%,#c9a5ff 60%,#7ab8ff 76%,#ffd9f2 88%,#f2ecff);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 7s linear infinite}'
    + '.lbm-card.frame-legendary::after,.mpa-fr-sw.frame-legendary::after{content:"";position:absolute;inset:-2.6px;border-radius:inherit;padding:2.6px;pointer-events:none;z-index:6;background:conic-gradient(from var(--mpAng,0deg),#2a0e00,#ff8a2a 12%,#ffd75a 26%,#7a2d00 42%,#ffb056 56%,#fff3c0 68%,#ff6a1a 84%,#2a0e00);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 6s linear infinite}'
    /* ---- shop frames ---- */
    + '.lbm-card.frame-carbon,.mpa-fr-sw.frame-carbon{border-color:#3a4149;box-shadow:0 0 0 1px rgba(70,80,92,.6),0 14px 44px -22px rgba(0,0,0,.8)}'
    + '.lbm-card.frame-carbon::after,.mpa-fr-sw.frame-carbon::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:repeating-linear-gradient(45deg,#2a2f36 0 5px,#14171c 5px 10px);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-jade,.mpa-fr-sw.frame-jade{border-color:#4fbf8f;box-shadow:0 0 0 1px rgba(79,191,143,.5),0 0 26px -14px rgba(79,191,143,.45)}'
    + '.lbm-card.frame-jade::after,.mpa-fr-sw.frame-jade::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:linear-gradient(150deg,#a9f0cf,#1d6b4a 45%,#7fe0b0 60%,#0e3f2a 85%,#5ad4a0);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-royal,.mpa-fr-sw.frame-royal{border-color:#8b5cff;box-shadow:0 0 0 1px rgba(139,92,255,.55),0 0 0 3px rgba(255,215,90,.14),0 0 30px -12px rgba(139,92,255,.5)}'
    + '.lbm-card.frame-royal::after,.mpa-fr-sw.frame-royal::after{content:"";position:absolute;inset:-1.8px;border-radius:inherit;padding:1.8px;pointer-events:none;z-index:6;background:linear-gradient(135deg,#ffd75a,#7a3cff 30%,#3b1d7a 55%,#7a3cff 75%,#ffd75a);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-blood,.mpa-fr-sw.frame-blood{border-color:#ff4d4d;box-shadow:0 0 0 1px rgba(255,77,77,.55),0 0 34px -12px rgba(255,60,60,.5),inset 0 0 34px -26px rgba(255,60,60,.6)}'
    + '.lbm-card.frame-blood::after,.mpa-fr-sw.frame-blood::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:linear-gradient(160deg,#ff8a8a,#5a0a0a 45%,#ff4d4d 62%,#2a0404 88%,#c92a2a);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-matrix,.mpa-fr-sw.frame-matrix{border-color:#39ff7a;box-shadow:0 0 0 1px rgba(57,255,122,.6),0 0 40px -8px rgba(57,255,122,.45)}'
    + '.lbm-card.frame-matrix::after,.mpa-fr-sw.frame-matrix::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:repeating-linear-gradient(0deg,#0a2313 0 3px,#1fda66 3px 4px,#0a2313 4px 8px);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-ice,.mpa-fr-sw.frame-ice{border-color:#35c0e8;box-shadow:0 0 0 1px rgba(53,192,232,.75),0 0 40px -10px rgba(20,150,200,.6),inset 0 1px 0 rgba(200,240,255,.25)}'/* uniqueness pass 2026-08-16: SATURATED arctic cyan — was pale blue, statically identical to platinum/streak100 */
    + '.lbm-card.frame-ice::after,.mpa-fr-sw.frame-ice::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:linear-gradient(160deg,#a8f0ff,#1690c0 40%,#5fd8f8 58%,#0a5a80 84%,#35c0e8);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-ember,.mpa-fr-sw.frame-ember{border-color:#2a2320;box-shadow:0 0 0 1px rgba(70,55,45,.9),0 0 30px -10px rgba(255,80,20,.4);animation:mpaFrLeg 3.4s ease-in-out infinite}'/* uniqueness pass 2026-08-16: SMOLDERING charcoal with thin fire cracks — was a plain orange ring lost between streak30/inferno/legendary; "smoldering" is coals, not flames */
    + '.lbm-card.frame-ember::after,.mpa-fr-sw.frame-ember::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:repeating-conic-gradient(from 15deg,#1a1412 0 22deg,#ff3d00 22deg 24deg,#2a201a 24deg 46deg,#ff7a1a 46deg 47.5deg,#16100c 47.5deg 70deg);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-sakura,.mpa-fr-sw.frame-sakura{border-color:#ffb7c9;box-shadow:0 0 0 1px rgba(255,183,201,.6),0 0 30px -12px rgba(255,150,180,.45)}'
    + '.lbm-card.frame-sakura::after,.mpa-fr-sw.frame-sakura::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:linear-gradient(150deg,#fff1f4,#ff9fbb 40%,#ffe3ea 58%,#c96a86 84%,#ffc7d6);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-void,.mpa-fr-sw.frame-void{border-color:#0a0512;box-shadow:0 0 46px 8px rgba(0,0,0,.85),0 0 0 1px rgba(90,60,140,.4),inset 0 0 46px -20px rgba(10,2,20,.95)}'/* uniqueness pass 2026-08-16: the light-EATER — the only frame that darkens around itself instead of glowing (was a violet glow ring, statically identical to singularity) */
    + '.lbm-card.frame-void::after,.mpa-fr-sw.frame-void::after{content:"";position:absolute;inset:-2px;border-radius:inherit;padding:2px;pointer-events:none;z-index:6;background:conic-gradient(from var(--mpAng,0deg),#050208,#1a0d2e 30%,#241238 50%,#0a0512 70%,#050208);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 9s linear infinite}'
    + '.lbm-card.frame-sovereign,.mpa-fr-sw.frame-sovereign{border-color:transparent;box-shadow:0 0 0 1px rgba(255,244,214,.7),0 0 64px -10px rgba(255,228,150,.6),inset 0 0 40px -26px rgba(255,240,200,.5)}'
    + '.lbm-card.frame-sovereign::after,.mpa-fr-sw.frame-sovereign::after{content:"";position:absolute;inset:-2.2px;border-radius:inherit;padding:2.2px;pointer-events:none;z-index:7;background:conic-gradient(from var(--mpAng,0deg),#fff8e1,#d4af37,#ffffff,#b8860b,#fff8e1);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 8s linear infinite}'
    + '.lbm-card.frame-eclipse,.mpa-fr-sw.frame-eclipse{border-color:#0c0804;box-shadow:0 0 0 1px rgba(60,35,10,.8),0 0 64px -6px rgba(255,120,20,.6),inset 0 0 36px -22px rgba(255,140,40,.3)}'/* uniqueness pass 2026-08-16: a BLACK ring with one burning corona crescent — the ring itself stays dark (a black sun), unlike every other orange frame */
    + '.lbm-card.frame-eclipse::after,.mpa-fr-sw.frame-eclipse::after{content:"";position:absolute;inset:-2px;border-radius:inherit;padding:2px;pointer-events:none;z-index:7;background:conic-gradient(from var(--mpAng,0deg),#ffb35a 0deg 26deg,#ff7a10 40deg,#0a0705 70deg,#070503 300deg,#ff9a2a 340deg,#ffb35a 360deg);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 9s linear infinite}'
    + '.lbm-card.frame-inferno,.mpa-fr-sw.frame-inferno{position:relative;border-color:transparent;box-shadow:0 0 0 1px rgba(255,120,30,.7),0 0 40px -8px rgba(255,100,20,.6),inset 0 0 44px -24px rgba(255,140,50,.6);animation:mpaFire 1.7s ease-in-out infinite}'
    + '@keyframes mpaFire{0%,100%{box-shadow:0 0 0 1px rgba(255,120,30,.6),0 0 34px -10px rgba(255,100,20,.5),inset 0 0 44px -24px rgba(255,140,50,.5)}28%{box-shadow:0 0 0 1px rgba(255,165,62,.9),0 0 54px -6px rgba(255,120,30,.78),inset 0 0 48px -20px rgba(255,175,72,.72)}52%{box-shadow:0 0 0 1px rgba(255,130,35,.68),0 0 40px -9px rgba(255,105,22,.58),inset 0 0 46px -22px rgba(255,150,60,.58)}76%{box-shadow:0 0 0 1px rgba(255,185,85,.95),0 0 64px -4px rgba(255,135,38,.85),inset 0 0 52px -16px rgba(255,195,95,.8)}}'
    + '.lbm-card.frame-inferno::after,.mpa-fr-sw.frame-inferno::after{content:"";position:absolute;inset:-2.4px;border-radius:inherit;padding:2.4px;pointer-events:none;z-index:6;background:conic-gradient(from var(--mpAng,0deg),#1a0800,#ff6a1a 12%,#ffd75a 22%,#ff3d00 36%,#7a2000 50%,#ffb056 62%,#fff0b0 70%,#ff5a10 84%,#1a0800);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 4.5s linear infinite}'
    + '.lbm-card.frame-inferno::before,.mpa-fr-sw.frame-inferno::before{content:"";position:absolute;inset:0;height:auto;border-radius:inherit;pointer-events:none;z-index:6;background:radial-gradient(2.2px 2.2px at 18% 85%,rgba(255,175,65,.9),transparent 60%),radial-gradient(1.6px 1.6px at 62% 92%,rgba(255,140,45,.85),transparent 60%),radial-gradient(2px 2px at 82% 78%,rgba(255,200,90,.8),transparent 60%),radial-gradient(1.4px 1.4px at 38% 95%,rgba(255,120,30,.8),transparent 60%),linear-gradient(0deg,rgba(255,100,20,.16),transparent 55%);background-repeat:no-repeat;animation:mpaEmber 2.6s linear infinite}'
    + '@keyframes mpaEmber{0%{background-position:0 30%,0 45%,0 25%,0 50%,0 0;opacity:1}100%{background-position:0 -70%,0 -85%,0 -60%,0 -95%,0 0;opacity:.55}}'
    + '.lbm-card.frame-dwell10,.mpa-fr-sw.frame-dwell10{border-color:#d29a6a;box-shadow:0 0 0 1px rgba(210,154,106,.55),0 0 26px -12px rgba(210,154,106,.45)}'
    + '.lbm-card.frame-dwell10::after,.mpa-fr-sw.frame-dwell10::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:linear-gradient(160deg,#f2d3b0,#8a5a30 40%,#e0b285 55%,#5a3a1e 82%,#d29a6a);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-dwell100,.mpa-fr-sw.frame-dwell100{border-color:transparent;box-shadow:0 0 0 1px rgba(52,217,154,.7),0 0 52px -10px rgba(52,217,154,.55),inset 0 0 40px -24px rgba(150,240,200,.6)}'
    + '.lbm-card.frame-dwell100::after,.mpa-fr-sw.frame-dwell100::after{content:"";position:absolute;inset:-2.2px;border-radius:inherit;padding:2.2px;pointer-events:none;z-index:6;background:conic-gradient(from var(--mpAng,0deg),#0a3a28,#34d99a 20%,#d8ffe0 36%,#ffd75a 50%,#0f8a5f 66%,#9fe9c8 82%,#0a3a28);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 8s linear infinite}'
    + '.lbm-card.frame-closer,.mpa-fr-sw.frame-closer{border-color:#ff5a4d;box-shadow:0 0 0 1px rgba(255,90,77,.6),0 0 30px -10px rgba(255,90,77,.5),inset 0 1px 0 rgba(255,255,255,.1)}'
    + '.lbm-card.frame-closer::after,.mpa-fr-sw.frame-closer::after{content:"";position:absolute;inset:-1.6px;border-radius:inherit;padding:1.6px;pointer-events:none;z-index:6;background:linear-gradient(115deg,#e6ebf2 0 18%,#ff5a4d 18% 24%,#7a8694 24% 46%,#ff5a4d 46% 52%,#cfd8e2 52% 74%,#3a434f 74% 80%,#ff5a4d 80% 86%,#e6ebf2 86%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-operative,.mpa-fr-sw.frame-operative{border-color:#8a9a4a;box-shadow:0 0 0 1px rgba(138,154,74,.6),0 0 26px -12px rgba(169,185,106,.5),inset 0 0 30px -22px rgba(169,185,106,.4)}'
    + '.lbm-card.frame-operative::after,.mpa-fr-sw.frame-operative::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:repeating-linear-gradient(45deg,#5a6630 0 10px,#2c3318 10px 20px,#a9b96a 20px 22px,#2c3318 22px 32px);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    /* ---- F5 long-haul progression frames (2026-08-15) ---- */
    + '.lbm-card.frame-mission500,.mpa-fr-sw.frame-mission500{border-color:#ffd75a;box-shadow:0 0 0 1px rgba(255,215,90,.65),0 0 30px -12px rgba(255,215,90,.5),inset 0 0 30px -22px rgba(255,215,90,.35)}'/* uniqueness pass 2026-08-16: BLACK+GOLD hazard tape at -45deg — was olive stripes at 45deg, statically identical to operative camo */
    + '.lbm-card.frame-mission500::after,.mpa-fr-sw.frame-mission500::after{content:"";position:absolute;inset:-1.6px;border-radius:inherit;padding:1.6px;pointer-events:none;z-index:6;background:repeating-linear-gradient(-45deg,#ffd75a 0 10px,#14120a 10px 20px);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-og180,.mpa-fr-sw.frame-og180{border-color:#b87333;box-shadow:0 0 0 1px rgba(184,115,51,.6),0 0 28px -12px rgba(58,160,138,.5),inset 0 0 34px -24px rgba(58,160,138,.4)}'/* uniqueness pass 2026-08-16: ANTIQUE copper with verdigris patina (OG = aged bronze) — was plain bronze, statically identical to dwell10/streak7 */
    + '.lbm-card.frame-og180::after,.mpa-fr-sw.frame-og180::after{content:"";position:absolute;inset:-1.8px;border-radius:inherit;padding:1.8px;pointer-events:none;z-index:6;background:linear-gradient(150deg,#e0956a,#7a4520 25%,#3aa08a 45%,#b87333 62%,#1e6a58 80%,#c98a52);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-xp100k,.mpa-fr-sw.frame-xp100k{border-color:transparent;box-shadow:0 0 0 1px rgba(201,48,42,.7),0 0 54px -10px rgba(255,90,60,.5),inset 0 0 40px -24px rgba(255,215,90,.4)}'/* uniqueness pass 2026-08-16: CENTURION = Roman legion crimson + gold banded segments — was lime, statically identical to the premium neon frame */
    + '.lbm-card.frame-xp100k::after,.mpa-fr-sw.frame-xp100k::after{content:"";position:absolute;inset:-2.4px;border-radius:inherit;padding:2.4px;pointer-events:none;z-index:6;background:repeating-conic-gradient(from var(--mpAng,0deg),#c9302a 0 24deg,#ffd75a 24deg 45deg);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 7s linear infinite}'
    + '.lbm-card.frame-closer2k,.mpa-fr-sw.frame-closer2k{border-color:transparent;box-shadow:0 0 0 1px rgba(255,59,48,.7),0 0 50px -8px rgba(220,30,20,.55),inset 0 0 40px -24px rgba(255,80,70,.45);animation:mpaFrLeg 3s ease-in-out infinite}'/* uniqueness pass 2026-08-16: OVERCLOCK = redline tachometer, a white needle arc chasing around a deep red ring — was an orange conic lost among the fire frames */
    + '.lbm-card.frame-closer2k::after,.mpa-fr-sw.frame-closer2k::after{content:"";position:absolute;inset:-2.2px;border-radius:inherit;padding:2.2px;pointer-events:none;z-index:6;background:conic-gradient(from var(--mpAng,0deg),#ffffff 0 34deg,#ff3b30 34deg 60deg,#8a1410 100deg,#c9302a 200deg,#4a0a06 300deg,#ff3b30 340deg,#ffffff 360deg);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 4s linear infinite}'
    + '.lbm-card.frame-dwell500,.mpa-fr-sw.frame-dwell500{border-color:#6a4a2e;box-shadow:0 0 0 1px rgba(150,105,60,.65),0 0 40px -12px rgba(190,140,80,.5),inset 0 0 40px -24px rgba(120,80,40,.6)}'
    + '.lbm-card.frame-dwell500::after,.mpa-fr-sw.frame-dwell500::after{content:"";position:absolute;inset:-2.2px;border-radius:inherit;padding:2.2px;pointer-events:none;z-index:6;background:conic-gradient(from var(--mpAng,0deg),#2a1a0c,#8a5c30 18%,#e0c090 30%,#4a2f16 46%,#b8895a 62%,#2a1a0c 78%,#caa06a 90%,#2a1a0c);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 11s linear infinite}'
    /* ---- premium paid tier above Sovereign (2026-08-15) ---- */
    + '.lbm-card.frame-dragonfire,.mpa-fr-sw.frame-dragonfire{border-color:transparent;box-shadow:0 0 0 1px rgba(255,70,30,.75),0 0 64px -8px rgba(230,40,20,.6),inset 0 0 52px -22px rgba(255,90,40,.65);animation:mpaFire 2.6s ease-in-out infinite}'
    + '.lbm-card.frame-dragonfire::after,.mpa-fr-sw.frame-dragonfire::after{content:"";position:absolute;inset:-2.6px;border-radius:inherit;padding:2.6px;pointer-events:none;z-index:7;background:conic-gradient(from var(--mpAng,0deg),#1a0402,#c9302a 10%,#ffd75a 18%,#7a0e08 30%,#ff6a1a 42%,#2a0604 54%,#e6452a 66%,#ffb056 74%,#8a1408 86%,#1a0402);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 5s linear infinite}'
    + '.lbm-card.frame-dragonfire::before,.mpa-fr-sw.frame-dragonfire::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:6;background:radial-gradient(2.4px 2.4px at 22% 88%,rgba(255,120,50,.95),transparent 60%),radial-gradient(1.8px 1.8px at 58% 94%,rgba(255,70,30,.9),transparent 60%),radial-gradient(2px 2px at 78% 82%,rgba(255,180,80,.85),transparent 60%),radial-gradient(1.5px 1.5px at 40% 96%,rgba(230,40,20,.85),transparent 60%),linear-gradient(0deg,rgba(230,40,20,.18),transparent 55%);background-repeat:no-repeat;animation:mpaEmber 2.2s linear infinite}'
    + '.lbm-card.frame-singularity,.mpa-fr-sw.frame-singularity{border-color:transparent;box-shadow:0 0 0 1px rgba(140,110,255,.55),0 0 70px -8px rgba(90,60,220,.6),0 0 120px -30px rgba(0,180,255,.35),inset 0 0 60px -20px rgba(10,5,25,.95)}'
    + '.lbm-card.frame-singularity::after,.mpa-fr-sw.frame-singularity::after{content:"";position:absolute;inset:-2.4px;border-radius:inherit;padding:2.4px;pointer-events:none;z-index:7;background:conic-gradient(from var(--mpAng,0deg),#020108,#5a3cff 8%,#00d0ff 16%,#ffffff 19%,#7a5cff 28%,#020108 44%,#2a1a6a 58%,#00a0ff 70%,#020108 84%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 3.5s linear infinite}'
    + '.lbm-card.frame-singularity::before,.mpa-fr-sw.frame-singularity::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:5;background:radial-gradient(60% 60% at 50% 50%,transparent 55%,rgba(90,60,220,.12) 78%,rgba(0,208,255,.10) 100%)}'
    + '.lbm-card.frame-midas,.mpa-fr-sw.frame-midas{border-color:transparent;box-shadow:0 0 0 1px rgba(255,240,190,.85),0 0 70px -6px rgba(255,205,90,.7),0 0 130px -30px rgba(255,180,40,.45),inset 0 0 46px -20px rgba(255,230,160,.6)}'
    + '.lbm-card.frame-midas::after,.mpa-fr-sw.frame-midas::after{content:"";position:absolute;inset:-2.8px;border-radius:inherit;padding:2.8px;pointer-events:none;z-index:7;background:conic-gradient(from var(--mpAng,0deg),#fff8e1,#ffd75a 12%,#8a5c00 26%,#ffec9a 38%,#d4af37 52%,#fffdf4 62%,#b8860b 76%,#ffe98a 88%,#fff8e1);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 6s linear infinite}'
    + '.lbm-card.frame-midas::before,.mpa-fr-sw.frame-midas::before{content:"";position:absolute;inset:3px;border-radius:inherit;pointer-events:none;z-index:6;box-shadow:inset 0 0 0 1.4px rgba(255,220,130,.8),inset 0 0 24px -10px rgba(255,210,110,.6)}'
    /* ---- REAL TRADER — the apex (2026-08-15): profit-green fire in a gold storm; fastest ring on the site + breathing glow + rising sparks ---- */
    + '.lbm-card.frame-realtrader,.mpa-fr-sw.frame-realtrader{border-color:transparent;box-shadow:0 0 0 1px rgba(255,246,214,.9),0 0 60px -6px rgba(46,230,168,.65),0 0 130px -18px rgba(255,215,90,.6),inset 0 0 50px -18px rgba(46,230,168,.5);animation:mpaFire 2.2s ease-in-out infinite}'
    + '.lbm-card.frame-realtrader::after,.mpa-fr-sw.frame-realtrader::after{content:"";position:absolute;inset:-3px;border-radius:inherit;padding:3px;pointer-events:none;z-index:7;background:conic-gradient(from var(--mpAng,0deg),#04130c,#2ee6a8 10%,#fff9e0 20%,#ffd75a 32%,#04130c 44%,#2ee6a8 56%,#ffffff 66%,#ffd75a 78%,#04130c 90%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 2.5s linear infinite}'
    + '.lbm-card.frame-realtrader::before,.mpa-fr-sw.frame-realtrader::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:6;background:radial-gradient(2.4px 2.4px at 20% 86%,rgba(46,230,168,.95),transparent 60%),radial-gradient(1.8px 1.8px at 55% 93%,rgba(255,215,90,.9),transparent 60%),radial-gradient(2px 2px at 80% 80%,rgba(255,255,255,.85),transparent 60%),radial-gradient(1.5px 1.5px at 38% 96%,rgba(46,230,168,.85),transparent 60%),linear-gradient(0deg,rgba(46,230,168,.14),transparent 55%);background-repeat:no-repeat;animation:mpaEmber 1.9s linear infinite}'
    + '.lbm-card.bg-bg_grid{background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01)),repeating-linear-gradient(0deg,transparent 0 22px,rgba(127,190,255,.07) 22px 23px),repeating-linear-gradient(90deg,transparent 0 22px,rgba(127,190,255,.07) 22px 23px),#0b1017}'
    + '.lbm-card.bg-bg_stars{background:radial-gradient(1.6px 1.6px at 15% 25%,rgba(255,255,255,.55),transparent 60%),radial-gradient(1px 1px at 70% 15%,rgba(200,220,255,.5),transparent 60%),radial-gradient(1.6px 1.6px at 85% 60%,rgba(255,255,255,.4),transparent 60%),radial-gradient(1px 1px at 40% 72%,rgba(180,200,255,.45),transparent 60%),radial-gradient(1.2px 1.2px at 55% 42%,rgba(255,255,255,.35),transparent 60%),radial-gradient(1px 1px at 28% 55%,rgba(210,225,255,.3),transparent 60%),linear-gradient(180deg,#0d1220,#0a0d16)}'
    + '.lbm-card.bg-bg_candles{background:linear-gradient(180deg,rgba(10,12,16,.35),rgba(10,12,16,.75)),repeating-linear-gradient(90deg,transparent 0 24px,rgba(46,189,133,.10) 24px 31px,transparent 31px 44px,rgba(255,90,77,.07) 44px 49px,transparent 49px 66px,rgba(46,189,133,.08) 66px 74px),linear-gradient(200deg,#0e1610 0%,#0b0f12 60%)}'
    + '.lbm-card.bg-bg_vapor{background:radial-gradient(140px 90px at 78% 22%,rgba(255,90,160,.55),rgba(255,150,60,.25) 60%,transparent 75%),linear-gradient(180deg,rgba(30,6,50,.85),rgba(10,8,20,.95) 60%),repeating-linear-gradient(0deg,transparent 0 14px,rgba(0,220,255,.10) 14px 15px),repeating-linear-gradient(90deg,transparent 0 26px,rgba(176,108,255,.10) 26px 27px)}'
    + '.lbm-card.bg-bg_aurora{background:radial-gradient(60% 40% at 30% 8%,rgba(46,230,168,.28),transparent 70%),radial-gradient(50% 36% at 70% 4%,rgba(122,92,255,.26),transparent 70%),radial-gradient(1.4px 1.4px at 20% 30%,rgba(255,255,255,.5),transparent 60%),radial-gradient(1px 1px at 66% 22%,rgba(255,255,255,.4),transparent 60%),radial-gradient(1.2px 1.2px at 44% 14%,rgba(255,255,255,.45),transparent 60%),linear-gradient(180deg,rgba(6,10,18,.6),rgba(8,10,14,.95))}'
    + '.lbm-card.bg-bg_one{background:radial-gradient(140% 90% at 50% 112%,rgba(255,180,60,.18),transparent 60%),radial-gradient(120% 70% at 50% -12%,rgba(255,215,90,.12),transparent 55%),repeating-linear-gradient(115deg,transparent 0 34px,rgba(255,200,80,.05) 34px 35px),linear-gradient(180deg,#151009,#0d0a06)}'
    + '.lbm-card.frame-streak7,.mpa-fr-sw.frame-streak7{border-color:#ffb84a;box-shadow:0 0 0 1px rgba(255,184,74,.55),0 0 30px -12px rgba(255,150,50,.5)}'
    + '.lbm-card.frame-streak7::after,.mpa-fr-sw.frame-streak7::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:linear-gradient(15deg,#ffdf8a,#b85c00 45%,#ffb84a 65%,#5a2a00 90%,#ffcf6a);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-streak30,.mpa-fr-sw.frame-streak30{border-color:#ff6a2a;box-shadow:0 0 0 1px rgba(255,106,42,.6),0 0 44px -8px rgba(255,80,20,.55);animation:mpaFrLeg 3s ease-in-out infinite}'
    + '.lbm-card.frame-streak30::after,.mpa-fr-sw.frame-streak30::after{content:"";position:absolute;inset:-1.8px;border-radius:inherit;padding:1.8px;pointer-events:none;z-index:6;background:linear-gradient(10deg,#ffd75a,#5a5a62 25%,#ff6a2a 45%,#2e2e34 70%,#c92a00 85%,#ffae4a);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'/* uniqueness pass 2026-08-16: WILDFIRE = flame banded with smoke grey — separates it from inferno/legendary orange rings */
    + '.lbm-card.frame-streak100,.mpa-fr-sw.frame-streak100{border-color:#ffffff;box-shadow:0 0 0 1px rgba(255,255,255,.85),0 0 70px -8px rgba(230,245,255,.7),inset 0 0 40px -26px rgba(255,255,255,.55)}'/* uniqueness pass 2026-08-16: ETERNAL FLAME = WHITE-hot plasma, the only pure-white ring — was pale blue, statically identical to ice/platinum */
    + '.lbm-card.frame-streak100::after,.mpa-fr-sw.frame-streak100::after{content:"";position:absolute;inset:-2.2px;border-radius:inherit;padding:2.2px;pointer-events:none;z-index:7;background:conic-gradient(from var(--mpAng,0deg),#ffffff,#f2fbff 30%,#dfeef6 50%,#ffffff 70%,#eef8ff);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 6.5s linear infinite}'
    + '.lbm-card.frame-champion,.mpa-fr-sw.frame-champion{border-color:transparent;box-shadow:0 0 0 1px rgba(255,215,90,.8),0 0 70px -8px rgba(255,200,60,.65),inset 0 0 44px -24px rgba(255,220,120,.55)}'
    + '.lbm-card.frame-champion::after,.mpa-fr-sw.frame-champion::after{content:"";position:absolute;inset:-2.4px;border-radius:inherit;padding:2.4px;pointer-events:none;z-index:7;background:conic-gradient(from var(--mpAng,0deg),#ffd75a,#ffffff 10%,#c98f1b 22%,#fff3c0 45%,#ffd75a 58%,#ffffff 66%,#c98f1b 78%,#ffd75a);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 5.5s linear infinite}'/* uniqueness pass 2026-08-16: white diamond flashes in the gold band — statically separates champion from founder/owner/gold uniform-gold rings */
    // --- DEADEYE — Win-Rate season #1: gunmetal scope ring with a red-dot sweep (uniqueness pass 2026-08-16: was green ticks, statically collided with matrix/jade) ---
    + '.lbm-card.frame-deadeye,.mpa-fr-sw.frame-deadeye{border-color:transparent;box-shadow:0 0 0 1px rgba(154,163,173,.75),0 0 44px -12px rgba(154,163,173,.45),inset 0 0 36px -26px rgba(255,59,48,.35)}'
    + '.lbm-card.frame-deadeye::after,.mpa-fr-sw.frame-deadeye::after{content:"";position:absolute;inset:-2.4px;border-radius:inherit;padding:2.4px;pointer-events:none;z-index:7;background:conic-gradient(from var(--mpAng,0deg),#ff3b30 0 10deg,rgba(255,59,48,.35) 10deg 16deg,transparent 16deg 360deg),repeating-conic-gradient(from var(--mpAng,0deg),#cdd3da 0 2deg,rgba(42,48,56,.85) 2deg 30deg);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 9s linear infinite}'
    // --- OVERDRIVE — XP season #1: electric fuchsia voltage, the fastest spin on the site (uniqueness pass 2026-08-16: was violet-cyan, statically identical to the premium aurora frame; fuchsia is used by NO other frame) ---
    + '.lbm-card.frame-overdrive,.mpa-fr-sw.frame-overdrive{border-color:transparent;box-shadow:0 0 0 1px rgba(255,42,208,.8),0 0 70px -8px rgba(255,42,208,.55),inset 0 0 44px -24px rgba(255,42,208,.45)}'
    + '.lbm-card.frame-overdrive::after,.mpa-fr-sw.frame-overdrive::after{content:"";position:absolute;inset:-2.4px;border-radius:inherit;padding:2.4px;pointer-events:none;z-index:7;background:conic-gradient(from var(--mpAng,0deg),#ff2ad0,#ffffff 12%,#a01470 28%,#ff8af0 45%,#ff2ad0 58%,#ffffff 66%,#7a0e54 82%,#ff2ad0);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 3.2s linear infinite}'
    // --- TYCOON — Spot Bank season #1: deep emerald ring with solid gold corner caps, static and heavy (uniqueness pass 2026-08-16: was a green-gold conic, statically collided with realtrader; corner-cap structure is shared only with royal, in a different palette) ---
    + '.lbm-card.frame-tycoon,.mpa-fr-sw.frame-tycoon{border-color:transparent;box-shadow:0 0 0 1px rgba(10,92,56,.9),0 0 56px -10px rgba(46,189,133,.55),inset 0 0 44px -24px rgba(255,215,90,.35)}'
    + '.lbm-card.frame-tycoon::after,.mpa-fr-sw.frame-tycoon::after{content:"";position:absolute;inset:-2.4px;border-radius:inherit;padding:2.4px;pointer-events:none;z-index:7;background:repeating-conic-gradient(from 25deg,#ffd75a 0 40deg,transparent 40deg 90deg),linear-gradient(160deg,#0a5c38,#2ebd85 45%,#063a24 80%,#0a5c38);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    // --- FOUNDER — rich gold + diagonal shine sweep (above premium) ---
    + '.lbm-card.frame-gold,.mpa-fr-sw.frame-gold{position:relative}'
    + '.lbm-card.frame-gold::before,.mpa-fr-sw.frame-gold::before{content:"";position:absolute;inset:0;height:auto;border-radius:inherit;pointer-events:none;z-index:6;background:linear-gradient(115deg,transparent 40%,rgba(255,220,120,.13) 47%,rgba(255,240,190,.32) 50%,rgba(255,220,120,.13) 53%,transparent 60%);background-size:250% 100%;background-repeat:no-repeat;background-position:170% 0;animation:mpaShine 7s linear infinite}'
    + '.lbm-card.frame-platinum,.mpa-fr-sw.frame-platinum{position:relative}'
    + '.lbm-card.frame-platinum::before,.mpa-fr-sw.frame-platinum::before{content:"";position:absolute;inset:0;height:auto;border-radius:inherit;pointer-events:none;z-index:6;background:linear-gradient(115deg,transparent 40%,rgba(150,225,255,.14) 47%,rgba(220,245,255,.34) 50%,rgba(150,225,255,.14) 53%,transparent 60%);background-size:250% 100%;background-repeat:no-repeat;background-position:170% 0;animation:mpaShine 6.5s linear infinite}'
    + '.lbm-card.frame-diamond::before,.mpa-fr-sw.frame-diamond::before{content:"";position:absolute;inset:0;height:auto;border-radius:inherit;pointer-events:none;z-index:6;background:linear-gradient(115deg,transparent 38%,rgba(190,160,255,.15) 45%,rgba(240,230,255,.42) 50%,rgba(140,205,255,.15) 55%,transparent 62%);background-size:250% 100%;background-repeat:no-repeat;background-position:170% 0;animation:mpaShine 5.5s linear infinite}'
    + '.lbm-card.frame-legendary::before,.mpa-fr-sw.frame-legendary::before{content:"";position:absolute;inset:0;height:auto;border-radius:inherit;pointer-events:none;z-index:6;background:linear-gradient(115deg,transparent 38%,rgba(255,170,70,.16) 45%,rgba(255,236,180,.44) 50%,rgba(255,140,40,.16) 55%,transparent 62%);background-size:250% 100%;background-repeat:no-repeat;background-position:170% 0;animation:mpaShine 5s linear infinite}'
    + '.lbm-premtag.lbm-ownertag{background:linear-gradient(90deg,#7a4d0a,#ffd75a 22%,#fff6d0 50%,#ffd75a 78%,#7a4d0a);background-size:200% 100%;color:#1a1002;letter-spacing:.26em;padding:4px 14px;box-shadow:0 0 22px -4px rgba(255,200,60,.75),0 0 0 1px rgba(255,215,90,.55),inset 0 1px 0 rgba(255,255,255,.35);animation:mpGold 2.4s linear infinite}'
    + '@keyframes mpGold{to{background-position:200% center}}'
    + '.lbm-card.frame-founder,.mpa-fr-sw.frame-founder{position:relative;border-color:#ffd75a;box-shadow:0 0 0 1px rgba(255,215,90,.7),0 0 42px -8px rgba(255,198,74,.58),inset 0 0 44px -30px rgba(255,226,132,.75),0 22px 66px -30px rgba(0,0,0,.8)}'
    + '@keyframes mpaShine{0%{background-position:170% 0}42%{background-position:-80% 0}100%{background-position:-80% 0}}'
    // --- OWNER — spinning gold-jewel ring, layered halo, inner sheen: the crown jewel (chako, gladijator only) ---
    + '.lbm-card.frame-owner,.mpa-fr-sw.frame-owner{position:relative;border-color:transparent;box-shadow:0 0 0 1px rgba(255,222,110,.7),0 0 36px -6px rgba(255,205,80,.72),0 0 96px -18px rgba(255,182,52,.62),0 0 180px -40px rgba(255,160,40,.55),inset 0 0 62px -28px rgba(255,238,164,.92),0 28px 92px -30px rgba(0,0,0,.88);animation:mpaOwnerHalo 3.6s ease-in-out infinite}'
    + '@keyframes mpaOwnerHalo{0%,100%{box-shadow:0 0 0 1px rgba(255,218,100,.55),0 0 30px -8px rgba(255,205,80,.55),0 0 80px -22px rgba(255,182,52,.5),0 0 150px -44px rgba(255,160,40,.45),inset 0 0 62px -28px rgba(255,238,164,.8),0 28px 92px -30px rgba(0,0,0,.88)}50%{box-shadow:0 0 0 1px rgba(255,238,150,.95),0 0 58px -2px rgba(255,214,96,.9),0 0 140px -14px rgba(255,192,64,.75),0 0 230px -36px rgba(255,170,45,.65),inset 0 0 66px -22px rgba(255,246,190,1),0 28px 92px -30px rgba(0,0,0,.88)}}'
    + '.lbm-card.frame-owner::after,.mpa-fr-sw.frame-owner::after{content:"";position:absolute;inset:-3px;border-radius:inherit;padding:3px;pointer-events:none;z-index:7;background:conic-gradient(from var(--mpAng),#5a3a08,#ffd75a 8%,#fffdf2 13%,#ffd75a 18%,#8a5c10 30%,#f4c94a 44%,#fff7d8 50%,#e2a92e 56%,#5a3a08 70%,#ffcf3f 84%,#5a3a08);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 4s linear infinite}'
    + '.lbm-card.frame-owner::before,.mpa-fr-sw.frame-owner::before{content:"";position:absolute;inset:0;height:auto;border-radius:inherit;pointer-events:none;z-index:6;background:linear-gradient(115deg,transparent 38%,rgba(255,246,208,.2) 46%,rgba(255,255,255,.55) 50%,rgba(255,246,208,.2) 54%,transparent 62%),radial-gradient(130% 60% at 50% -5%,rgba(255,224,130,.24),transparent 62%),linear-gradient(180deg,rgba(255,215,90,.06),transparent 45%);background-size:250% 100%,100% 100%,100% 100%;background-repeat:no-repeat;background-position:170% 0,0 0,0 0;animation:mpaOwnerShine 4.5s linear infinite}'
    + '@keyframes mpaOwnerShine{0%{background-position:170% 0,0 0,0 0}42%{background-position:-80% 0,0 0,0 0}100%{background-position:-80% 0,0 0,0 0}}'
    // customize panel grid
    + '.mpa-frgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin:4px 0 4px}'
    + '.mpa-fr{position:relative;display:flex;flex-direction:column;gap:4px;background:#0f131a;border:1px solid #1e2530;border-radius:10px;padding:6px;cursor:pointer;transition:border-color .15s,transform .05s;text-align:center}'
    + '.mpa-frhead{display:flex;align-items:center;gap:8px;margin:-4px 0 8px}'
    + '.mpa-frhead .mpa-sub{margin:0;flex:1;min-width:0}'
    + '.mpa-frseg{display:inline-flex;flex:none;background:#0d1117;border:1px solid #232b36;border-radius:8px;padding:2px;gap:2px}'
    + '.mpa-frseg button{font:700 10.5px monospace;letter-spacing:.04em;color:#8b97a5;background:none;border:none;border-radius:6px;padding:4px 9px;cursor:pointer;transition:.14s}'
    + '.mpa-frseg button.on{background:#c2f64a;color:#0a0b0d}'
    + '.mpa-frnone{grid-column:1/-1;color:#8b97a5;font-size:12px;line-height:1.5;padding:6px 0}'
    + '.mpa-fr:hover{border-color:#33404f}.mpa-fr:active{transform:scale(.98)}'
    + '.mpa-fr.on{border-color:#c2f64a;box-shadow:0 0 0 1px rgba(194,246,74,.4)}'
    + '.mpa-fr.lock{opacity:.55;cursor:not-allowed}'
    + '.mpa-fr-sw{height:30px;border-radius:7px;border:1px solid #2a3340;background:linear-gradient(150deg,#141922,#0d1017)}'
    + '.mpa-fr-nm{font:700 11px monospace;color:#e7ecf2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.mpa-fr-by{font-size:10px;color:#8b97a5;line-height:1.2}.mpa-fr.on .mpa-fr-by{color:#c2f64a}'
    // PRO members: glossy gold name (replaces the old "PRO" chip — fits everywhere, never clipped on mobile)
    + '.mp-progold{background:linear-gradient(100deg,#e0a52a 0%,#ffe07a 18%,#fff6c8 30%,#ffd75a 46%,#e0a52a 68%,#ffe98a 100%) !important;background-size:200% auto !important;-webkit-background-clip:text !important;background-clip:text !important;-webkit-text-fill-color:transparent !important;color:transparent !important;font-weight:800 !important;text-shadow:none !important;animation:mpGold 3.2s linear infinite}'
    + '@keyframes mpGold{to{background-position:200% center}}'
    
    /* VAULT DROP 2026-08-19: flagship frames */
    + '.lbm-card.frame-obsidian,.mpa-fr-sw.frame-obsidian{border-color:transparent;box-shadow:0 0 0 1px rgba(18,22,27,.95),0 0 56px -14px rgba(194,246,74,.34),0 0 120px -34px rgba(126,196,62,.22),inset 0 0 54px -16px rgba(0,0,0,.96),0 22px 68px -28px rgba(0,0,0,.9);animation:mpaObsidian 5.6s ease-in-out infinite}'
    + '@keyframes mpaObsidian{0%,100%{box-shadow:0 0 0 1px rgba(18,22,27,.95),0 0 44px -16px rgba(194,246,74,.24),0 0 110px -36px rgba(126,196,62,.16),inset 0 0 54px -16px rgba(0,0,0,.96),0 22px 68px -28px rgba(0,0,0,.9)}50%{box-shadow:0 0 0 1px rgba(30,36,42,.95),0 0 74px -10px rgba(194,246,74,.5),0 0 152px -28px rgba(140,215,70,.32),inset 0 0 58px -14px rgba(0,0,0,.96),0 22px 68px -28px rgba(0,0,0,.9)}}'
    + '.lbm-card.frame-obsidian::after,.mpa-fr-sw.frame-obsidian::after{content:"";position:absolute;inset:-3px;border-radius:inherit;padding:3px;pointer-events:none;z-index:7;background:linear-gradient(152deg,rgba(255,255,255,.2),transparent 36%,rgba(0,0,0,.34) 72%),conic-gradient(from 200deg,#0b0f13 0 32deg,#3b4650 32deg 46deg,#171d24 46deg 58deg,#4a5a12 58deg 59.6deg,#c2f64a 59.6deg 61.2deg,#f6ffdc 61.2deg 62.2deg,#c2f64a 62.2deg 63.6deg,#4a5a12 63.6deg 65deg,#060a0d 65deg 94deg,#48535f 94deg 109deg,#1b222a 109deg 114deg,#4a5a12 114deg 115.6deg,#c2f64a 115.6deg 117deg,#f6ffdc 117deg 118deg,#c2f64a 118deg 119.4deg,#4a5a12 119.4deg 120.8deg,#05080b 120.8deg 166deg,#343e48 166deg 181deg,#141a20 181deg 192deg,#4a5a12 192deg 193.6deg,#c2f64a 193.6deg 195deg,#f6ffdc 195deg 196deg,#c2f64a 196deg 197.4deg,#4a5a12 197.4deg 198.8deg,#070a0d 198.8deg 236deg,#404a56 236deg 251deg,#171d24 251deg 262deg,#4a5a12 262deg 263.6deg,#c2f64a 263.6deg 265deg,#eaffc4 265deg 266deg,#a8e02e 266deg 267.4deg,#4a5a12 267.4deg 268.8deg,#05080b 268.8deg 310deg,#2e3740 310deg 325deg,#12171d 325deg 336deg,#4a5a12 336deg 337.6deg,#c2f64a 337.6deg 339deg,#f6ffdc 339deg 340deg,#c2f64a 340deg 341.4deg,#4a5a12 341.4deg 342.8deg,#0b0f13 342.8deg 360deg);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-obsidian::before,.mpa-fr-sw.frame-obsidian::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:5;background:radial-gradient(66% 82% at 50% 52%,rgba(9,11,14,.97) 42%,rgba(9,11,14,.76) 68%,transparent 84%),linear-gradient(118deg,transparent 0 30.4%,rgba(232,255,180,.55) 30.4% 31.1%,transparent 31.1%),radial-gradient(70% 92% at 6% 108%,rgba(194,246,74,.15),transparent 58%),radial-gradient(56% 76% at 97% -10%,rgba(255,255,255,.07),transparent 60%)}'
    + '.lbm-card.frame-quicksilver,.mpa-fr-sw.frame-quicksilver{border-color:transparent;box-shadow:0 0 0 1px rgba(216,232,248,.85),0 0 46px -14px rgba(150,186,222,.5),0 0 92px -34px rgba(200,226,250,.3),inset 0 1px 0 rgba(255,255,255,.16),inset 0 0 40px -22px rgba(160,200,235,.4),0 20px 62px -28px rgba(0,0,0,.88)}'
    + '.lbm-card.frame-quicksilver::after,.mpa-fr-sw.frame-quicksilver::after{content:"";position:absolute;inset:-3.2px;border-radius:inherit;padding:3.2px;pointer-events:none;z-index:7;background:conic-gradient(from var(--mpAng,0deg),#f4f9ff,#9db6cf 10%,#22303c 19%,#070b10 24%,#070b10 26%,#6f8aa2 32%,#ffffff 38%,#ffffff 41%,#cfe2f4 48%,#2c3a48 57%,#05080c 61%,#05080c 63.5%,#7c96ad 69%,#fbfdff 76%,#ffffff 79%,#b6cadd 86%,#4a5e72 92%,#f4f9ff);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 12s linear infinite}'
    + '.lbm-card.frame-quicksilver::before,.mpa-fr-sw.frame-quicksilver::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:5;background:linear-gradient(108deg,transparent 56%,rgba(255,255,255,.07) 61%,transparent 67%),linear-gradient(180deg,rgba(196,222,248,.09) 0 40%,rgba(255,255,255,.17) 40% 41.2%,rgba(6,10,16,.34) 41.2% 100%)}'
    + '.lbm-card.frame-prism,.mpa-fr-sw.frame-prism{border-color:transparent;box-shadow:0 0 0 1px rgba(236,242,252,.6),0 0 58px -12px rgba(122,84,255,.42),0 0 100px -26px rgba(0,214,255,.3),0 0 140px -40px rgba(255,60,190,.24),inset 0 0 52px -18px rgba(6,7,12,.95),0 20px 64px -28px rgba(0,0,0,.86)}'
    + '.lbm-card.frame-prism::after,.mpa-fr-sw.frame-prism::after{content:"";position:absolute;inset:-2.8px;border-radius:inherit;padding:2.8px;pointer-events:none;z-index:7;background:conic-gradient(from var(--mpAng,0deg),transparent 0 126deg,rgba(255,45,85,.9) 137deg,rgba(255,154,31,.92) 150deg,rgba(255,233,74,.95) 163deg,rgba(74,222,128,.92) 177deg,rgba(34,211,238,.92) 192deg,rgba(99,102,241,.9) 208deg,rgba(168,85,247,.85) 224deg,transparent 238deg 360deg),linear-gradient(158deg,#f2f5fb,#0b0e14 26%,#1c2231 50%,#05070b 76%,#dfe6f2);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaSpin 8s linear infinite}'
    + '.lbm-card.frame-prism::before,.mpa-fr-sw.frame-prism::before{content:"";position:absolute;inset:2.6px;border-radius:inherit;pointer-events:none;z-index:6;box-shadow:inset 1.3px 1.3px 0 rgba(0,225,255,.55),inset -1.3px -1.3px 0 rgba(255,60,190,.5),inset 0 0 30px -12px rgba(255,255,255,.28);background:linear-gradient(128deg,rgba(0,225,255,.07) 0 14%,transparent 30%,transparent 70%,rgba(255,60,190,.07) 88%)}'
    + '.lbm-card.frame-circuitry,.mpa-fr-sw.frame-circuitry{border-color:transparent;box-shadow:0 0 0 1px rgba(38,72,60,.9),0 0 54px -14px rgba(255,190,90,.42),0 0 96px -30px rgba(90,240,255,.32),inset 0 0 46px -22px rgba(90,240,255,.25),0 18px 58px -26px rgba(0,0,0,.85)}'
    + '.lbm-card.frame-circuitry::after,.mpa-fr-sw.frame-circuitry::after{content:"";position:absolute;inset:-2.6px;border-radius:inherit;padding:2.6px;pointer-events:none;z-index:7;background:repeating-linear-gradient(90deg,transparent 0 12px,rgba(255,190,90,.92) 12px 13.6px,rgba(255,228,160,.95) 13.6px 14.2px,transparent 14.2px 26px),repeating-linear-gradient(0deg,transparent 0 8px,rgba(90,240,255,.8) 8px 9.4px,transparent 9.4px 18px),linear-gradient(150deg,#0b1c15,#04100b 45%,#0e2119 74%,#071410);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mpaCircuit 3.2s linear infinite}'
    + '@keyframes mpaCircuit{from{background-position:0 0,0 0,0 0}to{background-position:26px 0,0 18px,0 0}}'
    + '.lbm-card.frame-circuitry::before,.mpa-fr-sw.frame-circuitry::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:5;background:radial-gradient(3.6px 3.6px at 12% 16%,rgba(224,255,255,.95),rgba(255,190,90,.6) 44%,transparent 70%),radial-gradient(3px 3px at 88% 24%,rgba(224,255,255,.9),rgba(255,190,90,.5) 44%,transparent 70%),radial-gradient(3.4px 3.4px at 20% 86%,rgba(224,255,255,.9),rgba(90,240,255,.55) 44%,transparent 70%),radial-gradient(2.8px 2.8px at 76% 92%,rgba(224,255,255,.85),rgba(255,190,90,.45) 44%,transparent 70%),linear-gradient(0deg,transparent 0 15%,rgba(255,190,90,.3) 15% 15.5%,transparent 15.5%),linear-gradient(90deg,transparent 0 12%,rgba(90,240,255,.26) 12% 12.5%,transparent 12.5%),radial-gradient(76% 52% at 50% 112%,rgba(90,240,255,.12),transparent 66%),repeating-linear-gradient(90deg,transparent 0 17px,rgba(255,190,90,.045) 17px 18px),repeating-linear-gradient(0deg,transparent 0 17px,rgba(90,240,255,.04) 17px 18px)}'
    + '.lbm-card.frame-ink,.mpa-fr-sw.frame-ink{border-color:transparent;box-shadow:0 0 0 1px rgba(112,96,200,.35),0 0 64px -16px rgba(84,52,200,.5),0 0 120px -34px rgba(0,190,220,.28),inset 0 0 64px -14px rgba(7,5,18,.92),0 20px 62px -30px rgba(0,0,0,.9)}'
    + '.lbm-card.frame-ink::after,.mpa-fr-sw.frame-ink::after{content:"";position:absolute;inset:-3.4px;border-radius:inherit;padding:3.4px;pointer-events:none;z-index:7;background:radial-gradient(130% 150% at 6% -6%,rgba(158,124,255,.95),rgba(72,44,178,.55) 38%,transparent 68%),radial-gradient(110% 130% at 94% 10%,rgba(255,72,158,.72),rgba(120,30,120,.34) 40%,transparent 66%),radial-gradient(130% 140% at 46% 110%,rgba(38,196,224,.62),rgba(20,80,140,.3) 42%,transparent 68%),radial-gradient(90% 110% at 78% 96%,rgba(150,110,255,.5),transparent 62%),linear-gradient(180deg,#1a1140,#0a0718 58%,#150c2c);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-ink::before,.mpa-fr-sw.frame-ink::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:5;background:radial-gradient(58% 82% at 86% 4%,rgba(152,112,255,.3),transparent 62%),radial-gradient(46% 72% at 98% 44%,rgba(255,72,158,.17),transparent 66%),radial-gradient(72% 92% at 6% 108%,rgba(38,180,224,.19),transparent 62%),radial-gradient(40% 54% at 58% 96%,rgba(124,92,240,.15),transparent 70%);animation:mpaInk 9s ease-in-out infinite}'
    + '@keyframes mpaInk{0%,100%{background-position:0 0,0 0,0 0,0 0}50%{background-position:-7px 5px,6px -4px,5px -6px,-6px -5px}}'
    + '.lbm-card.frame-cathedral,.mpa-fr-sw.frame-cathedral{border-color:transparent;box-shadow:0 0 0 1px rgba(10,12,18,.95),0 0 68px -12px rgba(122,46,214,.42),0 0 104px -26px rgba(209,20,60,.3),0 0 150px -40px rgba(240,164,19,.24),inset 0 0 58px -14px rgba(3,4,8,.96),0 22px 70px -28px rgba(0,0,0,.9)}'
    + '.lbm-card.frame-cathedral::after,.mpa-fr-sw.frame-cathedral::after{content:"";position:absolute;inset:-3.4px;border-radius:inherit;padding:3.4px;pointer-events:none;z-index:7;background:conic-gradient(from 18deg,#0a0810 0 2.4deg,#e0244c 2.4deg 16deg,#ff8098 16deg 27deg,#ff3358 27deg 42deg,#8a0a24 42deg 65.6deg,#0a0810 65.6deg 68deg,#2a5ce8 68deg 82deg,#8fc4ff 82deg 93deg,#3d74ff 93deg 108deg,#0a1f6a 108deg 131.6deg,#0a0810 131.6deg 134deg,#18bd7c 134deg 147deg,#9dfbcf 147deg 158deg,#2ee6a8 158deg 172deg,#06553a 172deg 197.6deg,#0a0810 197.6deg 200deg,#ffb32a 200deg 213deg,#fff0bc 213deg 224deg,#ffca55 224deg 238deg,#8a5a06 238deg 261.6deg,#0a0810 261.6deg 264deg,#8e3ce8 264deg 278deg,#dcbaff 278deg 289deg,#a35cff 289deg 304deg,#3d0f78 304deg 329.6deg,#0a0810 329.6deg 332deg,#e0244c 332deg 344deg,#ff8098 344deg 356deg,#c01038 356deg 360deg);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-cathedral::before,.mpa-fr-sw.frame-cathedral::before{content:"";position:absolute;inset:1px;border-radius:inherit;pointer-events:none;z-index:5;box-shadow:inset 0 0 0 1.2px rgba(196,152,58,.42),inset 0 0 22px -8px rgba(255,214,140,.3);background:radial-gradient(54% 56% at 86% 2%,rgba(224,36,76,.3),transparent 66%),radial-gradient(50% 62% at 106% 60%,rgba(42,92,232,.28),transparent 66%),radial-gradient(62% 52% at 54% 108%,rgba(24,189,124,.26),transparent 66%),radial-gradient(52% 58% at -8% 76%,rgba(255,179,42,.26),transparent 66%),radial-gradient(50% 54% at 4% 2%,rgba(142,60,232,.28),transparent 66%),radial-gradient(66% 68% at 50% 50%,rgba(3,4,9,.62),transparent 72%);animation:mpaCathedral 6.4s ease-in-out infinite}'
    + '@keyframes mpaCathedral{0%,100%{opacity:.8}50%{opacity:1}}'
    /* VAULT DROP 2026-08-19: mid-tier frames */
    + '.lbm-card.frame-slate,.mpa-fr-sw.frame-slate{border-color:#5c6a7a;box-shadow:0 0 0 1px rgba(92,106,122,.5),inset 0 1px 0 rgba(190,205,220,.12),0 14px 44px -24px rgba(0,0,0,.8)}'
    + '.lbm-card.frame-bone,.mpa-fr-sw.frame-bone{border-color:#ded2b8;box-shadow:0 0 0 1px rgba(222,210,184,.45),inset 0 1px 0 rgba(255,250,235,.16),0 14px 40px -26px rgba(120,102,72,.6)}'
    + '.lbm-card.frame-moss,.mpa-fr-sw.frame-moss{border-color:#6d8055;box-shadow:0 0 0 1px rgba(109,128,85,.55),inset 0 0 28px -22px rgba(150,178,110,.5),0 14px 42px -24px rgba(0,0,0,.78)}'
    + '.lbm-card.frame-denim,.mpa-fr-sw.frame-denim{border-color:#4a6fa5;box-shadow:0 0 0 1px rgba(74,111,165,.6),0 0 0 3px rgba(214,190,120,.13),inset 0 1px 0 rgba(170,200,240,.12),0 14px 44px -24px rgba(0,0,0,.78)}'
    + '.lbm-card.frame-steel,.mpa-fr-sw.frame-steel{border-color:#9aa4ae;box-shadow:0 0 0 1px rgba(154,164,174,.5),inset 0 1px 0 rgba(255,255,255,.12),0 14px 44px -24px rgba(0,0,0,.8)}'
    + '.lbm-card.frame-steel::after,.mpa-fr-sw.frame-steel::after{content:"";position:absolute;inset:-1.5px;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:6;background:repeating-linear-gradient(90deg,#c3ccd6 0 1px,#8d97a2 1px 2.5px,#aeb8c2 2.5px 4px,#78828d 4px 5.5px);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-abyss,.mpa-fr-sw.frame-abyss{border-color:#12384a;box-shadow:0 0 0 1px rgba(30,92,116,.55),0 0 32px -14px rgba(22,120,150,.35),inset 0 0 42px -22px rgba(0,40,60,.9)}'
    + '.lbm-card.frame-abyss::after,.mpa-fr-sw.frame-abyss::after{content:"";position:absolute;inset:-1.6px;border-radius:inherit;padding:1.6px;pointer-events:none;z-index:6;background:linear-gradient(180deg,#3aa0b8,#146378 30%,#0d3346 62%,#061622 86%,#040d14);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-wine,.mpa-fr-sw.frame-wine{border-color:#7a2340;box-shadow:0 0 0 1px rgba(122,35,64,.6),0 0 26px -16px rgba(158,44,88,.35),inset 0 0 32px -24px rgba(90,20,44,.8)}'
    + '.lbm-card.frame-wine::after,.mpa-fr-sw.frame-wine::after{content:"";position:absolute;inset:-1.6px;border-radius:inherit;padding:1.6px;pointer-events:none;z-index:6;background:linear-gradient(150deg,#c98aa2,#5a1029 38%,#93304f 56%,#2a0611 82%,#7a2340);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-blueprint,.mpa-fr-sw.frame-blueprint{border-color:#2a6fa8;box-shadow:0 0 0 1px rgba(58,138,198,.5),0 0 28px -16px rgba(60,150,215,.4),inset 0 0 38px -24px rgba(30,110,180,.45)}'
    + '.lbm-card.frame-blueprint::after,.mpa-fr-sw.frame-blueprint::after{content:"";position:absolute;inset:-1.6px;border-radius:inherit;padding:1.6px;pointer-events:none;z-index:6;background:repeating-linear-gradient(0deg,transparent 0 5px,rgba(150,214,255,.55) 5px 6px),repeating-linear-gradient(90deg,transparent 0 5px,rgba(150,214,255,.55) 5px 6px),linear-gradient(160deg,#12456e,#0a2c48);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-storm,.mpa-fr-sw.frame-storm{border-color:#3b4252;box-shadow:0 0 0 1px rgba(70,82,102,.7),0 0 40px -14px rgba(96,116,166,.38),inset 0 0 40px -22px rgba(18,22,36,.9)}'
    + '.lbm-card.frame-storm::after,.mpa-fr-sw.frame-storm::after{content:"";position:absolute;inset:-1.8px;border-radius:inherit;padding:1.8px;pointer-events:none;z-index:6;background:linear-gradient(115deg,#151a24 0 40%,#7d8fb4 46%,#e2eaf8 50%,#7d8fb4 54%,#242b3a 60%,#10141d);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-phosphor,.mpa-fr-sw.frame-phosphor{border-color:transparent;box-shadow:0 0 0 1px rgba(255,176,0,.6),0 0 44px -10px rgba(255,148,20,.45),0 0 90px -34px rgba(255,120,0,.35),inset 0 0 44px -22px rgba(255,150,0,.4)}'
    + '.lbm-card.frame-phosphor::after,.mpa-fr-sw.frame-phosphor::after{content:"";position:absolute;inset:-2.2px;border-radius:inherit;padding:2.2px;pointer-events:none;z-index:6;background:repeating-linear-gradient(0deg,rgba(8,5,0,.72) 0 1.5px,transparent 1.5px 3.5px),linear-gradient(150deg,#ffe0a0,#8a5200 34%,#ffb000 56%,#3a2200 82%,#ffc94a);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-dusk,.mpa-fr-sw.frame-dusk{border-color:transparent;box-shadow:0 0 0 1px rgba(206,118,112,.55),0 0 46px -12px rgba(190,88,110,.42),0 0 96px -30px rgba(74,86,180,.4),inset 0 0 44px -26px rgba(255,168,120,.35)}'
    + '.lbm-card.frame-dusk::after,.mpa-fr-sw.frame-dusk::after{content:"";position:absolute;inset:-2.2px;border-radius:inherit;padding:2.2px;pointer-events:none;z-index:7;background:linear-gradient(160deg,#ffb691,#e0705f 20%,#a34a6a 42%,#5a3f8a 66%,#26305e 86%,#141a33);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-dusk::before,.mpa-fr-sw.frame-dusk::before{content:"";position:absolute;inset:0;height:auto;border-radius:inherit;pointer-events:none;z-index:5;background:radial-gradient(120% 70% at 50% 108%,rgba(255,140,96,.18),transparent 62%),radial-gradient(110% 60% at 50% -10%,rgba(86,74,168,.2),transparent 60%)}'
    + '.lbm-card.frame-petrol,.mpa-fr-sw.frame-petrol{border-color:transparent;box-shadow:0 0 0 1px rgba(32,116,114,.7),0 0 46px -12px rgba(0,148,148,.42),0 0 92px -32px rgba(168,72,168,.35),inset 0 0 44px -24px rgba(120,60,140,.4)}'
    + '.lbm-card.frame-petrol::after,.mpa-fr-sw.frame-petrol::after{content:"";position:absolute;inset:-2.4px;border-radius:inherit;padding:2.4px;pointer-events:none;z-index:7;background:linear-gradient(120deg,#0d3b3a,#17817a 16%,#7fd6c0 28%,#2a5b8a 44%,#7a4a9a 58%,#c85a9a 70%,#2d6a72 84%,#0d3b3a);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}'
    + '.lbm-card.frame-petrol::before,.mpa-fr-sw.frame-petrol::before{content:"";position:absolute;inset:3px;height:auto;border-radius:inherit;pointer-events:none;z-index:6;box-shadow:inset 0 0 0 1.2px rgba(126,214,192,.45),inset 0 0 22px -12px rgba(200,90,154,.55)}'
    /* VAULT DROP 2026-08-19: card backgrounds */
    + '.lbm-card.bg-bg_topo{background:radial-gradient(70% 80% at 22% 38%,transparent 0 26%,rgba(194,246,74,.1) 26% 27.1%,transparent 27.1% 40%,rgba(194,246,74,.075) 40% 41%,transparent 41% 55%,rgba(194,246,74,.055) 55% 56%,transparent 56% 72%,rgba(194,246,74,.04) 72% 73%,transparent 73%),radial-gradient(60% 70% at 78% 74%,transparent 0 18%,rgba(194,246,74,.07) 18% 19%,transparent 19% 33%,rgba(194,246,74,.05) 33% 34%,transparent 34% 50%,rgba(194,246,74,.035) 50% 51%,transparent 51%),linear-gradient(180deg,#0d1210,#090b0a)}'
    + '.lbm-card.bg-bg_rain{background:radial-gradient(7px 9px at 20% 24%,transparent 0 34%,rgba(216,234,255,.34) 46% 72%,transparent 80%),radial-gradient(4.5px 6px at 63% 15%,transparent 0 32%,rgba(216,234,255,.3) 46% 72%,transparent 80%),radial-gradient(9px 11px at 80% 47%,transparent 0 36%,rgba(216,234,255,.3) 48% 74%,transparent 82%),radial-gradient(6px 8px at 50% 79%,transparent 0 34%,rgba(216,234,255,.28) 46% 72%,transparent 80%),radial-gradient(5px 6.5px at 91% 84%,transparent 0 32%,rgba(216,234,255,.26) 46% 72%,transparent 80%),radial-gradient(3.5px 4.5px at 36% 58%,rgba(216,234,255,.34),transparent 72%),radial-gradient(3px 4px at 9% 66%,rgba(216,234,255,.28),transparent 72%),radial-gradient(2.6px 3.4px at 44% 38%,rgba(216,234,255,.24),transparent 72%),radial-gradient(2.2px 3px at 72% 66%,rgba(216,234,255,.2),transparent 72%),repeating-linear-gradient(90deg,transparent 0 29px,rgba(190,215,240,.07) 29px 30px,transparent 30px 57px,rgba(190,215,240,.045) 57px 58px,transparent 58px),radial-gradient(90% 60% at 50% 112%,rgba(120,160,200,.12),transparent 62%),linear-gradient(180deg,#0c1014,#080a0c)}'
    + '.lbm-card.bg-bg_ridge{background:linear-gradient(-19deg,#06080c 0 20%,transparent 20%),linear-gradient(13deg,#0d141d 0 30%,transparent 30%),linear-gradient(-8deg,#182231 0 40%,transparent 40%),radial-gradient(5px 5px at 76% 15%,rgba(228,240,255,.55),transparent 62%),radial-gradient(24% 20% at 76% 15%,rgba(180,205,245,.13),transparent 70%),radial-gradient(1.4px 1.4px at 24% 20%,rgba(255,255,255,.42),transparent 60%),radial-gradient(1px 1px at 46% 11%,rgba(210,225,255,.34),transparent 60%),radial-gradient(1.2px 1.2px at 90% 28%,rgba(255,255,255,.3),transparent 60%),linear-gradient(180deg,#0a0f17,#111a26)}'
    + '.lbm-card.bg-bg_metro{background:radial-gradient(3.2px 3.2px at 21% 31%,rgba(255,255,255,.5),transparent 62%),radial-gradient(3.2px 3.2px at 66% 31%,rgba(255,255,255,.42),transparent 62%),radial-gradient(2.6px 2.6px at 66% 72%,rgba(255,255,255,.36),transparent 62%),linear-gradient(90deg,transparent 0 21%,rgba(194,246,74,.24) 21% 21.6%,transparent 21.6%),linear-gradient(90deg,transparent 0 66%,rgba(176,108,255,.22) 66% 66.6%,transparent 66.6%),linear-gradient(180deg,transparent 0 31%,rgba(127,190,255,.22) 31% 31.7%,transparent 31.7%),linear-gradient(180deg,transparent 0 72%,rgba(255,180,74,.18) 72% 72.7%,transparent 72.7%),linear-gradient(45deg,transparent 0 55%,rgba(90,214,214,.18) 55% 55.7%,transparent 55.7%),linear-gradient(180deg,#0c0f14,#090b0f)}'
    + '.lbm-card.bg-bg_trench{background:radial-gradient(1.6px 1.6px at 34% 46%,rgba(200,230,245,.3),transparent 60%),radial-gradient(1.2px 1.2px at 72% 34%,rgba(200,230,245,.24),transparent 60%),radial-gradient(1.4px 1.4px at 56% 66%,rgba(200,230,245,.18),transparent 60%),linear-gradient(180deg,transparent 0 24%,rgba(3,8,13,.78) 86%),linear-gradient(100deg,transparent 0 12%,rgba(130,200,230,.08) 12% 17%,transparent 17%),linear-gradient(96deg,transparent 0 31%,rgba(130,200,230,.055) 31% 34%,transparent 34%),linear-gradient(106deg,transparent 0 49%,rgba(130,200,230,.04) 49% 54%,transparent 54%),linear-gradient(180deg,#0a1620,#04080c 68%,#02050a)}'
    + '.lbm-card.bg-bg_radar{background:radial-gradient(2.6px 2.6px at 63% 34%,rgba(194,246,74,.7),transparent 62%),radial-gradient(1.8px 1.8px at 38% 61%,rgba(194,246,74,.42),transparent 62%),conic-gradient(from 198deg at 50% 50%,rgba(194,246,74,.13),rgba(194,246,74,.07) 12deg,rgba(194,246,74,.03) 26deg,transparent 40deg),radial-gradient(50% 50% at 50% 50%,transparent 0 24%,rgba(194,246,74,.1) 24% 25%,transparent 25% 48%,rgba(194,246,74,.08) 48% 49%,transparent 49% 72%,rgba(194,246,74,.06) 72% 73%,transparent 73%),linear-gradient(90deg,transparent 0 49.7%,rgba(194,246,74,.07) 49.7% 50.3%,transparent 50.3%),linear-gradient(180deg,transparent 0 49.7%,rgba(194,246,74,.07) 49.7% 50.3%,transparent 50.3%),radial-gradient(72% 72% at 50% 50%,#0c1408,#070a06 72%),#060806}'
    + '.lbm-card.bg-bg_ember{background:radial-gradient(3.4px 3.4px at 22% 84%,rgba(255,158,70,.95),transparent 64%),radial-gradient(2.8px 2.8px at 58% 90%,rgba(255,120,48,.9),transparent 64%),radial-gradient(2.6px 2.6px at 78% 76%,rgba(255,196,120,.85),transparent 64%),radial-gradient(2.2px 2.2px at 40% 66%,rgba(255,130,58,.75),transparent 64%),radial-gradient(1.9px 1.9px at 68% 52%,rgba(255,168,88,.6),transparent 64%),radial-gradient(1.6px 1.6px at 30% 40%,rgba(255,138,66,.45),transparent 64%),radial-gradient(1.4px 1.4px at 84% 30%,rgba(255,178,98,.34),transparent 64%),radial-gradient(1.2px 1.2px at 12% 54%,rgba(255,150,70,.28),transparent 64%),radial-gradient(120% 70% at 50% 118%,rgba(255,110,40,.24),rgba(180,50,20,.09) 46%,transparent 70%),radial-gradient(58% 40% at 30% 26%,rgba(96,78,68,.11),transparent 72%),linear-gradient(180deg,#120b08,#0a0706)}'
    + '.lbm-card.bg-bg_deepfield{background:radial-gradient(1.5px 1.5px at 12% 18%,rgba(255,255,255,.6),transparent 60%),radial-gradient(1px 1px at 34% 8%,rgba(210,225,255,.45),transparent 60%),radial-gradient(1.3px 1.3px at 58% 24%,rgba(255,255,255,.5),transparent 60%),radial-gradient(1px 1px at 82% 12%,rgba(225,210,255,.4),transparent 60%),radial-gradient(1.6px 1.6px at 90% 52%,rgba(255,255,255,.42),transparent 60%),radial-gradient(1px 1px at 20% 62%,rgba(210,225,255,.35),transparent 60%),radial-gradient(1.2px 1.2px at 44% 82%,rgba(255,255,255,.38),transparent 60%),radial-gradient(1px 1px at 70% 90%,rgba(225,210,255,.3),transparent 60%),radial-gradient(1.4px 1.4px at 6% 44%,rgba(255,255,255,.32),transparent 60%),linear-gradient(-24deg,transparent 0 44%,rgba(5,4,10,.6) 48% 56%,transparent 61%),radial-gradient(46% 34% at 68% 30%,rgba(190,90,255,.2),transparent 70%),radial-gradient(40% 30% at 26% 66%,rgba(60,140,255,.16),transparent 72%),radial-gradient(30% 22% at 46% 46%,rgba(255,120,180,.1),transparent 72%),radial-gradient(120% 90% at 50% 50%,#0b0916,#05040a 72%)}'
    + '@media(prefers-reduced-motion:reduce){.mp-progold{animation:none;background-position:30% center}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var modal = document.createElement('div'); modal.className = 'mpa-modal'; modal.hidden = true;
  modal.innerHTML = '<div class="mpa-panel"><button class="mpa-x" type="button" aria-label="Close">✕</button><div class="mpa-body"></div></div>';
  document.body.appendChild(modal);
  var bodyEl = modal.querySelector('.mpa-body');
  modal.querySelector('.mpa-x').addEventListener('click', close);
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });

  function open() { modal.hidden = false; render(); if (!ME) { try { window.__mpTrack && window.__mpTrack('signin', 'opened'); } catch (e) {} } else { try { window.__mpTrack && window.__mpTrack('myprofile', (ME.level && ME.level.k) || ''); } catch (e) {} } } // ops feed: signed-in user opened their own profile from the header
  function close() { modal.hidden = true; }
  function setMsg(t, kind) { var m = bodyEl.querySelector('.mpa-msg'); if (m) { m.textContent = t; m.className = 'mpa-msg ' + (kind || ''); } }

  // ---- support: the user's conversations with the team (each conv = a separate thread; reply in-thread or start a new one) ----
  var _supCache = null;
  function renderSup() {
    bodyEl.innerHTML = '<h3 class="mpa-h">Support</h3><p class="mpa-sub">Loading your conversations\u2026</p>';
    fetch('/api/reward/support/mine').then(function (r) { return r.json(); }).then(function (d) {
      var convs = (d && d.conversations) || []; _supCache = convs;
      if (!convs.length) { renderSupNew(true); return; }
      bodyEl.innerHTML = '<h3 class="mpa-h">Support</h3><p class="mpa-sub" style="margin:-4px 0 12px">Your conversations with the team \u2014 open one to reply, or start a new one. Replies also arrive by email.</p>'
        + '<button class="mpa-btn" id="mpaSupNew" type="button" style="margin-bottom:13px">+ New conversation</button>'
        + '<div class="mpa-cvlist">' + convs.map(function (c) { var last = c.messages[c.messages.length - 1] || {}; var who = last.dir === 'out' ? 'MarginPad: ' : 'You: ';
          return '<button class="mpa-cv" type="button" data-conv="' + esc(c.conv) + '"><div class="mpa-cv-top"><span class="mpa-cv-ttl">' + esc(c.title || 'Conversation') + '</span>' + (c.closed ? '<span class="mpa-cv-st closed">Closed</span>' : '<span class="mpa-cv-st open">Open</span>') + '</div><div class="mpa-cv-last">' + esc(who) + esc((last.body || '').slice(0, 72)) + '</div><div class="mpa-cv-ago">' + xpAgo(c.lastTs) + '</div></button>'; }).join('') + '</div>'
        + '<button class="mpa-link" id="mpaSupBack" type="button">\u2190 Back to profile</button>';
      bodyEl.querySelector('#mpaSupNew').addEventListener('click', function () { renderSupNew(false); });
      bodyEl.querySelector('#mpaSupBack').addEventListener('click', function () { render(); });
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-conv]'), function (b) { b.addEventListener('click', function () { renderSupThread(b.getAttribute('data-conv')); }); });
    }).catch(function () { renderSupNew(true); });
  }
  var _supImg = '';
  function supResize(file, cb){ try{ var r=new FileReader(); r.onload=function(){ var im=new Image(); im.onload=function(){ var mx=900,w=im.width,h=im.height; if(w>mx||h>mx){ if(w>h){h=Math.round(h*mx/w);w=mx;}else{w=Math.round(w*mx/h);h=mx;} } var cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(im,0,0,w,h); var out=''; try{out=cv.toDataURL('image/webp',0.7);}catch(e){} if(!out||out.indexOf('data:image/webp')!==0){try{out=cv.toDataURL('image/jpeg',0.7);}catch(e){}} if(out.length>90000){try{out=cv.toDataURL('image/jpeg',0.5);}catch(e){}} cb(out.length<=90000?out:''); }; im.onerror=function(){cb('');}; im.src=r.result; }; r.onerror=function(){cb('');}; r.readAsDataURL(file);}catch(e){cb('');} }
  function renderSupThread(conv) {
    var c = (_supCache || []).filter(function (x) { return x.conv === conv; })[0];
    if (!c) { renderSup(); return; }
    bodyEl.innerHTML = '<h3 class="mpa-h">Support</h3>'
      + '<div class="mpa-dm"><div class="mpa-dm-scroll" id="mpaSupScroll">'
      + c.messages.map(function (m) { return '<div class="mpa-bub ' + (m.dir === 'out' ? 'out' : 'in') + '">' + (m.dir === 'out' ? '<span class="mpa-who">MarginPad support</span>' : '') + (m.img ? '<img src="' + esc(m.img) + '" class="mpa-sup-img">' : '') + esc(m.body || '') + '</div>'; }).join('')
      + '</div>' + (c.closed ? '<div class="mpa-dm-warn" style="margin-top:8px">This conversation was closed \u2014 sending a message reopens it.</div>' : '')
      + '<div id="mpaSupPrev" style="margin:6px 0 0"></div><div class="mpa-dm-form"><button class="mpa-dm-send" id="mpaSupPic" type="button" title="Attach screenshot" style="padding:0 11px"></button><input class="mpa-in" id="mpaSupReply" placeholder="Reply\u2026" maxlength="1000" autocomplete="off"><button class="mpa-dm-send" id="mpaSupSend" type="button">Send</button><input type="file" accept="image/*" id="mpaSupFile" style="display:none"></div></div>'
      + '<div class="mpa-du-msg" id="mpaSupSt"></div>'
      + '<button class="mpa-link" id="mpaSupBack" type="button">\u2190 All conversations</button>';
    var sc = bodyEl.querySelector('#mpaSupScroll'); if (sc) sc.scrollTop = sc.scrollHeight;
    bodyEl.querySelector('#mpaSupBack').addEventListener('click', renderSup);
    var inp = bodyEl.querySelector('#mpaSupReply'), send = bodyEl.querySelector('#mpaSupSend'), st = bodyEl.querySelector('#mpaSupSt');
    var _supBusy = false; // the Enter key bypassed the disabled button \u2192 mashing Enter while a send was in flight posted the same message 2-8x (the "These x4" tickets)
    function doSend() { if (_supBusy) return; var v = (inp.value || '').trim(); if (!v && !_supImg) return; _supBusy = true; send.disabled = true; if (st) st.innerHTML = '<span style="color:#8b97a5">Sending\u2026</span>';
      fetch('/api/reward/support', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: (ME && ME.email) || '', message: v, conv: conv, img: _supImg }) })
        .then(function (r) { return r.json(); }).then(function (d) { _supBusy = false; send.disabled = false; if (d && d.ok) { inp.value = ''; _supImg = ''; supReopen(conv); } else { if (st) st.innerHTML = '<span style="color:#ffb347">Failed \u2014 try again.</span>'; } })
        .catch(function () { _supBusy = false; send.disabled = false; if (st) st.innerHTML = '<span style="color:#ffb347">Network error.</span>'; }); }
    if (send) send.addEventListener('click', doSend);
    if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });
    var pic = bodyEl.querySelector('#mpaSupPic'), file = bodyEl.querySelector('#mpaSupFile'), prev = bodyEl.querySelector('#mpaSupPrev');
    if (pic && file) { pic.addEventListener('click', function () { file.click(); }); file.addEventListener('change', function () { var f = file.files && file.files[0]; if (!f) return; if (st) st.innerHTML = '<span style="color:#8b97a5">Processing image…</span>'; supResize(f, function (d) { if (!d) { if (st) st.innerHTML = '<span style="color:#ffb347">Image too big or unsupported.</span>'; return; } _supImg = d; if (prev) prev.innerHTML = '<img src="' + d + '" style="max-height:84px;border-radius:8px;vertical-align:middle"> <button class="mpa-link" id="mpaSupRm" type="button">remove</button>'; var rm = bodyEl.querySelector('#mpaSupRm'); if (rm) rm.addEventListener('click', function () { _supImg = ''; if (prev) prev.innerHTML = ''; file.value = ''; }); if (st) st.innerHTML = ''; }); }); }
  }
  function supReopen(conv) { // re-fetch conversations then reopen the same thread so the new message shows
    fetch('/api/reward/support/mine').then(function (r) { return r.json(); }).then(function (d) { _supCache = (d && d.conversations) || []; renderSupThread(conv); }).catch(function () { renderSupThread(conv); });
  }
  function renderSupNew(first) {
    bodyEl.innerHTML = '<h3 class="mpa-h">New conversation</h3><p class="mpa-sub">Tell us what happened \u2014 we reply to <b>' + esc((ME && ME.email) || 'your email') + '</b>, usually within a day.</p>'
      + '<textarea class="mpa-in" id="mpaSupMsg" maxlength="1000" rows="5" placeholder="Describe the problem or question\u2026" style="resize:vertical;min-height:110px;height:auto"></textarea>'
      + '<button class="mpa-btn" id="mpaSupSend" type="button" style="margin-top:10px">Send message</button>'
      + '<div class="mpa-msg"></div>'
      + '<button class="mpa-link" id="mpaSupBack2" type="button">\u2190 ' + (first ? 'Back' : 'All conversations') + '</button>';
    bodyEl.querySelector('#mpaSupBack2').addEventListener('click', function () { if (first) render(); else renderSup(); });
    var sb = bodyEl.querySelector('#mpaSupSend');
    sb.addEventListener('click', function () {
      var v = (bodyEl.querySelector('#mpaSupMsg').value || '').trim();
      if (!v) { setMsg('Write something first.', 'err'); return; }
      sb.disabled = true; setMsg('Sending\u2026', '');
      fetch('/api/reward/support', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: (ME && ME.email) || '', message: v }) }) // no conv \u2192 brand-new conversation
        .then(function (r) { return r.json(); }).then(function (d) { sb.disabled = false; if (d && d.ok) { if (d.conv) supReopen(d.conv); else renderSup(); } else { setMsg('Failed \u2014 try again.', 'err'); } })
        .catch(function () { sb.disabled = false; setMsg('Network error.', 'err'); });
    });
  }
  // ---- XP history (header profile → what XP you earned, when and why) ----
  var XPN = { trade: 'Trade closed', trade_win: 'Winning trade', trade_hh: 'XP Happy Hour', trade_promo: 'XP promo', checkin: 'Daily check-in', streak: 'Streak bonus', mission: 'Daily mission', faucet: 'Faucet claim', promo: 'Promo post', exsign: 'Exchange sign-up', lbprize: 'Competition prize', username: 'Username set', academy: 'Academy lesson', charts: 'Chart analysis', heatmap: 'Liquidation map', admin: 'Manual adjustment', backfill: 'Loyalty bonus', signup: 'Signed up', duel: 'Duel won', duel_pot: 'Duel pot', duel_stake: 'Duel stake' };
  function xpAgo(ts) { var s = Math.round((Date.now() - ts) / 1000); if (s < 60) return s + 's ago'; var m = Math.floor(s / 60); if (m < 60) return m + 'm ago'; var h = Math.floor(m / 60); if (h < 24) return h + 'h ago'; var d = Math.floor(h / 24); if (d < 30) return d + 'd ago'; try { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (e) { return d + 'd ago'; } }
  function renderXpHistory() {
    bodyEl.innerHTML = '<h3 class="mpa-h">XP history</h3>'
      + '<div class="mpa-xp-tot" id="mpaXpTot">…</div>'
      + '<div class="mpa-xp-sum" id="mpaXpSum"></div>'
      + '<div class="mpa-xp-list" id="mpaXpList"><div class="mpa-xp-empty">Loading…</div></div>'
      + '<button class="mpa-link" id="mpaXpBack" type="button">← Back to profile</button>';
    var bk = bodyEl.querySelector('#mpaXpBack'); if (bk) bk.addEventListener('click', render);
    fetch('/api/auth/xphistory').then(function (r) { return r.json(); }).then(function (d) {
      if (!d || d.signedIn === false) { var l0 = bodyEl.querySelector('#mpaXpList'); if (l0) l0.innerHTML = '<div class="mpa-xp-empty">Please sign in again.</div>'; return; }
      var tot = bodyEl.querySelector('#mpaXpTot'); if (tot) tot.innerHTML = '<b>' + (+d.xp || 0).toLocaleString() + '</b> XP balance'; // NET balance (duel stakes now move Ticks, not XP, so this is simply earned XP) — was labeled "total XP earned", which read as "my earned total went DOWN" after staking a duel
      var sum = bodyEl.querySelector('#mpaXpSum'); if (sum) { var bs = (d.bySrc || []).slice(0, 4), sp = (d.spent || []).slice(0, 3); sum.innerHTML = bs.map(function (x) { return '<span class="mpa-xp-chip">' + esc(XPN[x.src] || x.src) + ' <b>+' + (+x.tot || 0).toLocaleString() + '</b></span>'; }).join('') + sp.map(function (x) { return '<span class="mpa-xp-chip neg">' + esc(XPN[x.src] || x.src) + ' <b>' + (+x.tot || 0).toLocaleString() + '</b></span>'; }).join(''); }
      var list = bodyEl.querySelector('#mpaXpList'); if (!list) return;
      var log = (d.log || []);
      if (!log.length) { list.innerHTML = '<div class="mpa-xp-empty">No XP yet — close a winning paper trade, finish an Academy lesson, keep a daily streak or claim a reward to start earning.</div>'; return; }
      list.innerHTML = log.map(function (e) { var amt = +e.amt || 0, pos = amt >= 0; var lbl = XPN[e.src] || e.src || 'XP'; return '<div class="mpa-xp-r"><span class="mpa-xp-amt ' + (pos ? 'pos' : 'neg') + '">' + (pos ? '+' : '') + amt + '</span><span class="mpa-xp-b"><span class="mpa-xp-lbl">' + esc(lbl) + '</span>' + (e.note ? '<span class="mpa-xp-note">' + esc(e.note) + '</span>' : '') + '</span><span class="mpa-xp-ago">' + xpAgo(e.ts) + '</span></div>'; }).join('');
    }).catch(function () { var l = bodyEl.querySelector('#mpaXpList'); if (l) l.innerHTML = '<div class="mpa-xp-empty">Could not load your XP history — try again.</div>'; });
  }
  // ---- Direct messages (user↔user) ----
  function dmCol(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return 'hsl(' + (h % 360) + ',55%,55%)'; }
  function dmLvl(lv) { return lv && window.mpLvlSvg ? '<span style="display:inline-block;width:12px;height:12px;vertical-align:-2px">' + window.mpLvlSvg(lv.k, lv.col) + '</span>' : ''; }
  function refreshTrigDot() { var on = (window._mpDmUnread || 0) > 0 || (window._mpDuelPending || 0) > 0 || (window._mpNotifUnread || 0) > 0;
    try { Array.prototype.forEach.call(document.querySelectorAll('[data-auth-open]'), function (t) { if (getComputedStyle(t).position === 'static') t.style.position = 'relative'; var dot = t.querySelector('.mpa-trig-dot'); if (on) { if (!dot) { dot = document.createElement('span'); dot.className = 'mpa-trig-dot'; t.appendChild(dot); } } else if (dot) dot.remove(); }); } catch (e) {}
  }
  function setDot(id, n) { try { var mb = bodyEl && bodyEl.querySelector('#' + id); if (mb) { if (n > 0) { mb.textContent = n > 9 ? '9+' : String(n); mb.hidden = false; } else { mb.textContent = ''; mb.hidden = true; } } } catch (e) {} }
  function dmSetBadge(n) { n = +n || 0; window._mpDmUnread = n; setDot('mpaMsgBadge', n); refreshTrigDot(); }
  window.mpDmBadge = dmSetBadge;
  function duelSetBadge(n) { n = +n || 0; window._mpDuelPending = n; setDot('mpaDuelBadge', n); refreshTrigDot(); }
  window.mpDuelBadge = duelSetBadge;
  function renderDmInbox() {
    bodyEl.innerHTML = '<h3 class="mpa-h">Messages</h3><div class="mpa-ib" id="mpaIb"><div class="mpa-xp-empty">Loading…</div></div><button class="mpa-link" id="mpaIbBack" type="button">← Back to profile</button>';
    var bk = bodyEl.querySelector('#mpaIbBack'); if (bk) bk.addEventListener('click', render);
    fetch('/api/dm/inbox').then(function (r) { return r.json(); }).then(function (d) {
      var ib = bodyEl.querySelector('#mpaIb'); if (!ib) return;
      var th = (d && d.threads) || [];
      if (!th.length) { ib.innerHTML = '<div class="mpa-xp-empty">No messages yet. Open a trader’s profile and tap <b>Message</b> to start a chat — you can message people you follow (or who follow you).</div>'; return; }
      ib.innerHTML = th.map(function (t) { return '<button class="mpa-ib-r" type="button" data-dm="' + esc(t.name) + '"><span class="mpa-ib-av" style="background:' + dmCol(t.name) + '">' + esc((t.name || '?').charAt(0).toUpperCase()) + '</span><span class="mpa-ib-b"><span class="mpa-ib-nm">' + dmLvl(t.level) + esc(t.name) + '</span><span class="mpa-ib-last">' + (t.fromMe ? 'You: ' : '') + esc(t.last || '') + '</span></span><span class="mpa-ib-meta">' + xpAgo(t.ts) + (t.unread ? '<br><span class="mpa-ib-un">' + t.unread + '</span>' : '') + '</span></button>'; }).join('');
      Array.prototype.forEach.call(ib.querySelectorAll('[data-dm]'), function (b) { b.addEventListener('click', function () { renderDmThread(b.getAttribute('data-dm')); }); });
    }).catch(function () { var ib = bodyEl.querySelector('#mpaIb'); if (ib) ib.innerHTML = '<div class="mpa-xp-empty">Could not load your messages.</div>'; });
  }
  function renderDmThread(name) {
    name = String(name || '').replace(/[^a-zA-Z0-9_]/g, '');
    if (!name) { renderDmInbox(); return; }
    bodyEl.innerHTML = '<div class="mpa-dmh"><button class="mpa-link" id="mpaDmBack" type="button" style="margin:0;padding:0;font-size:20px">←</button><span class="mpa-ib-av" id="mpaDmAv" style="background:' + dmCol(name) + '">' + esc((name || '?').charAt(0).toUpperCase()) + '</span><span class="mpa-ib-nm" id="mpaDmNm">' + esc(name) + '</span></div>'
      + '<div class="mpa-dm"><div class="mpa-dm-scroll" id="mpaDmScroll"><div class="mpa-dm-empty">Loading…</div></div><div id="mpaDmWarn"></div>'
      + '<div class="mpa-dm-form"><input class="mpa-in" id="mpaDmIn" placeholder="Message @' + esc(name) + '…" maxlength="1000" autocomplete="off"><button class="mpa-dm-send" id="mpaDmSend" type="button">Send</button></div></div>';
    var bk = bodyEl.querySelector('#mpaDmBack'); if (bk) bk.addEventListener('click', renderDmInbox);
    var scroll = bodyEl.querySelector('#mpaDmScroll'), inp = bodyEl.querySelector('#mpaDmIn'), send = bodyEl.querySelector('#mpaDmSend'), warn = bodyEl.querySelector('#mpaDmWarn');
    function draw(msgs) { if (!msgs.length) { scroll.innerHTML = '<div class="mpa-dm-empty">No messages yet — say hi </div>'; return; } scroll.innerHTML = msgs.map(function (m) { return '<div class="mpa-dbub ' + (m.me ? 'me' : 'them') + '">' + esc(m.txt) + '<span class="t">' + xpAgo(m.ts) + '</span></div>'; }).join(''); scroll.scrollTop = scroll.scrollHeight; }
    fetch('/api/dm/thread?with=' + encodeURIComponent(name)).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || d.error) { scroll.innerHTML = '<div class="mpa-dm-empty">' + (d && d.error === 'no_recipient' ? 'User not found.' : 'Could not load this chat.') + '</div>'; return; }
      if (d.other) { var nm = bodyEl.querySelector('#mpaDmNm'); if (nm) nm.innerHTML = dmLvl(d.other.level) + esc(d.other.name); var av = bodyEl.querySelector('#mpaDmAv'); if (av) av.style.background = dmCol(d.other.name); }
      var canDm = d.canDm !== false;
      if (!canDm && !(d.messages && d.messages.length)) { if (warn) warn.innerHTML = '<div class="mpa-dm-warn">You can message this trader once you follow them (or they follow you). Open their profile and tap Follow first.</div>'; if (inp) inp.disabled = true; if (send) send.disabled = true; }
      draw(d.messages || []);
      try { if (window.mpXpCheck) window.mpXpCheck(); } catch (e) {} // seen was marked → refresh the unread badge
    }).catch(function () { scroll.innerHTML = '<div class="mpa-dm-empty">Could not load this chat.</div>'; });
    function doSend() {
      var v = (inp.value || '').trim(); if (!v) return;
      send.disabled = true; var old = inp.value; inp.value = '';
      fetch('/api/dm/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: name, text: v }) }).then(function (r) { return r.json(); }).then(function (d) {
        send.disabled = false;
        if (d && d.ok) { if (scroll.querySelector('.mpa-dm-empty')) scroll.innerHTML = ''; var b = document.createElement('div'); b.className = 'mpa-dbub me'; b.innerHTML = esc(v) + '<span class="t">now</span>'; scroll.appendChild(b); scroll.scrollTop = scroll.scrollHeight; if (warn) warn.innerHTML = ''; if (inp) inp.focus(); }
        else { inp.value = old; var m = d && d.error === 'not_connected' ? 'Follow this trader first to message them.' : d && d.error === 'rate_limit' ? 'Slow down a moment.' : d && d.error === 'daily_limit' ? 'You’ve hit today’s message limit.' : d && d.error === 'restricted' ? 'Your account can’t send messages right now.' : d && d.error === 'need_username' ? 'Set a username first (in your profile).' : d && d.error === 'no_recipient' ? 'User not found.' : 'Could not send — try again.'; if (warn) warn.innerHTML = '<div class="mpa-dm-warn">' + m + '</div>'; }
      }).catch(function () { send.disabled = false; inp.value = old; if (warn) warn.innerHTML = '<div class="mpa-dm-warn">Network error — try again.</div>'; });
    }
    if (send) send.addEventListener('click', doSend);
    if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });
  }
  // ---- Following activity feed (trades from people you follow) ----
  function feedLine(e) {
    var sym = esc(e.sym || ''), side = (e.side === 'short' || e.side === 'sell') ? 'SHORT' : 'LONG', lev = e.lev ? (e.lev + '×') : '';
    if (e.kind === 'open') return '<b class="fd-op">Opened</b> ' + '<span class="fd-' + side.toLowerCase() + '">' + side + '</span> ' + sym + ' ' + lev;
    if (e.kind === 'trim') return '<b>Partially closed</b> ' + sym;
    // close
    var pnl = +e.pnl, roe = +e.roe, money = (isFinite(pnl) ? (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 2 }) : ''), rt = isFinite(roe) ? ' (' + (roe >= 0 ? '+' : '') + Math.round(roe) + '%)' : '';
    if (e.liq) return '<b class="fd-liq">Liquidated</b> on ' + sym + (money ? ' <span class="fd-neg">' + money + '</span>' : '');
    if (isFinite(pnl) && pnl >= 0) return '<b class="fd-win">Won</b> on ' + sym + ' <span class="fd-pos">' + money + rt + '</span>';
    return '<b>Closed</b> ' + sym + (money ? ' <span class="fd-neg">' + money + rt + '</span>' : '');
  }
  function renderFeed() {
    bodyEl.innerHTML = '<h3 class="mpa-h">Following</h3><p class="mpa-sub" style="margin:-4px 0 10px">Latest trades from traders you follow.</p><div class="mpa-fd" id="mpaFd"><div class="mpa-xp-empty">Loading…</div></div><button class="mpa-link" id="mpaFdBack" type="button">← Back to profile</button>';
    var bk = bodyEl.querySelector('#mpaFdBack'); if (bk) bk.addEventListener('click', render);
    fetch('/api/lb/feed').then(function (r) { return r.json(); }).then(function (d) {
      var fd = bodyEl.querySelector('#mpaFd'); if (!fd) return;
      var ev = (d && d.feed) || [];
      if (!ev.length) { fd.innerHTML = '<div class="mpa-xp-empty">' + (d && d.follows ? 'No trades yet from the traders you follow — check back soon.' : 'You’re not following anyone yet. Open a trader’s profile from the leaderboard and tap <b>Follow</b> to see their trades here.') + '</div>'; return; }
      fd.innerHTML = ev.map(function (e) { var lv = e.level, badge = lv && window.mpLvlSvg ? '<span style="display:inline-block;width:12px;height:12px;vertical-align:-2px;margin-right:3px">' + window.mpLvlSvg(lv.k, lv.col) + '</span>' : '';
        return '<div class="mpa-fd-r"><span class="mpa-ib-av" style="width:30px;height:30px;font-size:13px;background:' + dmCol(e.name) + '">' + esc((e.name || '?').charAt(0).toUpperCase()) + '</span>'
          + '<div class="mpa-fd-b"><div class="mpa-fd-nm">' + badge + esc(e.name) + '</div><div class="mpa-fd-act">' + feedLine(e) + '</div></div>'
          + '<div class="mpa-fd-meta">' + xpAgo(e.ts) + '<button class="mpa-fd-dm" type="button" data-fddm="' + esc(e.name) + '" title="Message"></button></div></div>'; }).join('');
      Array.prototype.forEach.call(fd.querySelectorAll('[data-fddm]'), function (btn) { btn.addEventListener('click', function () { renderDmThread(btn.getAttribute('data-fddm')); }); });
    }).catch(function () { var fd = bodyEl.querySelector('#mpaFd'); if (fd) fd.innerHTML = '<div class="mpa-xp-empty">Could not load your feed.</div>'; });
  }
  // ---- Friend duels (weekly stat challenges) ----
  var DMET = { roe: 'ROE', wr: 'Win rate', win: 'Biggest win', pnl: 'Profit', survival: 'Survival', streak: 'Streak', sniper: 'Sniper' };
  var DTYPES = [
    { k: 'roe', nm: 'ROE Duel', ds: 'Highest single-trade ROE% wins', prem: false },
    { k: 'pnl', nm: 'Profit Duel', ds: 'Most realized profit ($) wins', prem: true },
    { k: 'survival', nm: 'Survival', ds: 'Higher ending balance wins — blow up and you are out', prem: true },
    { k: 'streak', nm: 'Streak', ds: 'Longest run of winning trades wins', prem: true },
    { k: 'sniper', nm: 'Sniper', ds: 'Best ROE inside your first few trades', prem: true }
  ];
  var DDUR = [{ v: 3600000, l: '1h' }, { v: 86400000, l: '24h' }, { v: 259200000, l: '3d' }, { v: 604800000, l: '7d' }];
  var DSTK = [0, 50, 100, 250, 500];
  var DICO = {
    roe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>',
    pnl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M16.5 6.2c0-1.7-2-2.7-4.5-2.7s-4.5 1-4.5 3.2c0 4.3 9 1.9 9 6.3 0 2.1-2 3.2-4.5 3.2s-4.5-1-4.5-2.8"/></svg>',
    survival: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.5 8.6-8 11-4.5-2.4-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/></svg>',
    streak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3 3 5 5.4 5 9a5 5 0 0 1-10 0c0-2 1-3.6 2.6-5C10 8 11 6 12 3z"/></svg>',
    sniper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="2.4"/></svg>'
  };
  function dico(k) { return DICO[k] || (k === 'wr' ? DICO.roe : k === 'win' ? DICO.pnl : DICO.roe); }
  function durShort(ms) { return ({ '3600000': '1h', '86400000': '24h', '259200000': '3d', '604800000': '7d' })[String(ms)] || '7d'; }
  var DRULE = { roe: 'Highest single-trade ROE% wins', wr: 'Best win rate wins (min 5 trades)', win: 'Biggest single winning trade wins', pnl: 'Most realized profit wins', survival: 'Higher ending balance wins — a blow-up loses', streak: 'Longest run of winning trades wins', sniper: 'Best ROE in your first few trades wins' };
  function _dm(v) { var a = Math.abs(+v || 0); return a >= 1e9 ? (a / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'K' : a.toFixed(a < 100 ? 2 : 0); } // compact money so a big score can never overflow the card
  function duelScoreTxt(metric, v) { if (v == null) return '—';
    if (metric === 'win' || metric === 'pnl') return (v >= 0 ? '+$' : '-$') + _dm(v);
    if (metric === 'survival') return '$' + _dm(v);
    if (metric === 'streak') return v + (v === 1 ? ' win' : ' wins');
    if (metric === 'wr') return Math.round(v) + '%';
    return (v >= 0 ? '+' : '') + Math.round(v) + '%'; }
  function ensurePrem(cb) { if (typeof window._mpPrem === 'boolean') { cb(window._mpPrem); return; } fetch('/api/premium/status', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (st) { window._mpPrem = !!(st && st.premium); cb(window._mpPrem); }).catch(function () { cb(false); }); }
  function duelTimeLeft(end) { var ms = end - Date.now(); if (ms <= 0) return 'ending…'; var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; if (d >= 1) return d + 'd ' + h + 'h left'; if (h >= 1) return h + 'h ' + m + 'm left'; if (m >= 1) return m + 'm ' + ss + 's left'; return ss + 's left'; }
  function duelTick(du) { Array.prototype.forEach.call(du.querySelectorAll('.mpa-dv[data-end]'), function (c) { var end = +c.getAttribute('data-end'), start = +c.getAttribute('data-start'), dur = +c.getAttribute('data-dur'); var tl = c.querySelector('.mpa-dv-tl'); if (tl) tl.textContent = duelTimeLeft(end); var bar = c.querySelector('.mpa-dv-bar i'); if (bar && dur > 0) bar.style.width = (Math.min(1, Math.max(0, (Date.now() - start) / dur)) * 100).toFixed(1) + '%'; }); }
  function renderDuels() {
    if (window._mpDuelT1) clearInterval(window._mpDuelT1); if (window._mpDuelT2) clearInterval(window._mpDuelT2);
    var hhOn = (new Date()).getUTCHours() === 18; /* MIRROR: worker HH {hourUTC:18, durMin:60} — duel win-bonus doubles while it runs */
    bodyEl.innerHTML = '<h3 class="mpa-h">Duels</h3>'
      + (hhOn ? '<div style="font:700 11px \'Space Mono\',monospace;color:#0a0b0d;background:linear-gradient(90deg,#ffd75a,#c2f64a);border-radius:8px;padding:6px 10px;margin:0 0 10px">HAPPY HOUR — duel win bonus is DOUBLED right now</div>' : '')
      + '<p class="mpa-sub" style="margin:-4px 0 10px">Challenge any trader — or post an open challenge and let anyone take it. Best stat when the clock ends takes the pot.</p>'
      + '<button class="mpa-send" id="mpaDuOpenPost" type="button" style="margin:0 0 12px">Post an open challenge</button>'
      + '<div class="mpa-du" id="mpaDu"><div class="mpa-xp-empty">Loading…</div></div><button class="mpa-link" id="mpaDuBack" type="button">← Back to profile</button>';
    var bk = bodyEl.querySelector('#mpaDuBack'); if (bk) bk.addEventListener('click', render);
    var op0 = bodyEl.querySelector('#mpaDuOpenPost'); if (op0) op0.addEventListener('click', function () { renderDuelChallenge('', true); });
    var sec = function (t) { return '<div class="mpa-du-sec">' + t + '</div>'; };
    var incCard = function (x) { var pot = x.stake > 0 ? x.stake * 2 : 0;
      return '<div class="mpa-di">'
        + '<div class="mpa-di-top"><span class="mpa-di-ic">' + dico(x.metric) + '</span><div class="mpa-di-h"><b>@' + esc(x.opp) + ' challenged you</b><span>' + DMET[x.metric] + ' duel</span></div></div>'
        + '<div class="mpa-di-rule">' + DRULE[x.metric] + '</div>'
        + '<div class="mpa-di-terms"><span class="mpa-di-tm"><i>Runs for</i>' + durShort(x.dur) + '</span><span class="mpa-di-tm"><i>Coin</i>' + (x.sym ? esc(x.sym) + ' only' : 'Any coin') + '</span><span class="mpa-di-tm' + (x.stake > 0 ? ' mpa-di-stake' : '') + '"><i>Stake' + (x.stake > 0 ? ' → win' : '') + '</i>' + (x.stake > 0 ? x.stake + ' → ' + pot + ' T' : 'None') + '</span></div>'
        + '<div class="mpa-di-acts"><button class="mpa-du-y" data-duacc="' + esc(x.id) + '">Accept' + (x.stake > 0 ? ' · stake ' + x.stake + ' T' : '') + '</button><button class="mpa-du-n" data-dudec="' + esc(x.id) + '">Decline</button></div></div>'; };
    var vsCard = function (x) { var mine = x.myScore, opp = x.oppScore, lead = (mine != null && (opp == null || mine >= opp)), oLead = (opp != null && (mine == null || opp > mine)); var el = (x.dur > 0 && x.start > 0) ? Math.min(1, Math.max(0, (Date.now() - x.start) / x.dur)) : 0;
      return '<div class="mpa-dv" data-end="' + (x.end || 0) + '" data-start="' + (x.start || 0) + '" data-dur="' + (x.dur || 0) + '"><div class="mpa-dv-top"><div class="mpa-dv-ty">' + dico(x.metric) + '<span>' + DMET[x.metric] + '</span>' + (x.sym ? '<span class="mpa-dtag">' + esc(x.sym) + '</span>' : '') + '</div><div class="mpa-dv-tl">' + duelTimeLeft(x.end) + '</div></div>'
        + '<div class="mpa-dv-vs"><div class="mpa-dv-side' + (lead ? ' w' : '') + '"><div class="mpa-dv-nm">You</div><div class="mpa-dv-val">' + duelScoreTxt(x.metric, mine) + '</div></div><div class="mpa-dv-mid">VS</div><div class="mpa-dv-side' + (oLead ? ' w' : '') + '"><div class="mpa-dv-nm">@' + esc(x.opp) + '</div><div class="mpa-dv-val">' + duelScoreTxt(x.metric, opp) + '</div></div></div>'
        + '<div class="mpa-dv-bar"><i style="width:' + (el * 100).toFixed(1) + '%"></i></div>'
        + '<div class="mpa-dv-ft"><span>' + DRULE[x.metric] + '</span>' + (x.stake > 0 ? '<span class="mpa-pot">Pot ' + (x.stake * 2) + ' T</span>' : '<span>No stake</span>') + '</div></div>'; };
    var pendCard = function (x) { return '<div class="mpa-du-r"><div class="mpa-du-b"><div class="mpa-du-nm">You challenged @' + esc(x.opp) + '</div><div class="mpa-du-met">' + DMET[x.metric] + ' · ' + durShort(x.dur) + (x.sym ? ' · ' + esc(x.sym) : '') + (x.stake > 0 ? ' · ' + x.stake + ' T staked' : '') + '</div></div><div class="mpa-du-wait">…</div></div>'; };
    var resCard = function (x) { var r = x.won === true ? '<span class="mpa-du-won">WON</span>' : x.won === false ? '<span class="mpa-du-lost">LOST</span>' : '<span class="mpa-du-tie">TIE</span>'; var xp = x.stake > 0 ? ' · <b style="color:' + (x.won === true ? '#c2f64a' : x.won === false ? '#ff8a80' : '#8b97a5') + '">' + (x.won === true ? '+' + x.stake : x.won === false ? '-' + x.stake : '±0') + ' T</b>' : ''; return '<div class="mpa-du-r"><div class="mpa-du-b"><div class="mpa-du-nm">You vs @' + esc(x.opp) + '</div><div class="mpa-du-met">' + DMET[x.metric] + ' · ' + duelScoreTxt(x.metric, x.myScore) + ' vs ' + duelScoreTxt(x.metric, x.oppScore) + xp + '</div></div>' + r + '<button class="mpa-du-y" data-durem="' + esc(x.id) + '" style="flex:0 0 auto;margin-left:8px" title="Same terms, straight back at them">Rematch</button></div>'; };
    var lobbyCard = function (x) { var pot = x.stake > 0 ? x.stake * 2 : 0;
      return '<div class="mpa-di">'
        + '<div class="mpa-di-top"><span class="mpa-di-ic">' + dico(x.metric) + '</span><div class="mpa-di-h"><b>@' + esc(x.name) + (x.prem ? ' <span style="font:700 8px \'Space Mono\',monospace;color:#c2f64a">PRO</span>' : '') + '</b><span>Open ' + DMET[x.metric] + ' duel — first taker</span></div></div>'
        + '<div class="mpa-di-terms"><span class="mpa-di-tm"><i>Runs for</i>' + durShort(x.dur) + '</span><span class="mpa-di-tm"><i>Coin</i>' + (x.sym ? esc(x.sym) + ' only' : 'Any coin') + '</span><span class="mpa-di-tm' + (x.stake > 0 ? ' mpa-di-stake' : '') + '"><i>Stake' + (x.stake > 0 ? ' → win' : '') + '</i>' + (x.stake > 0 ? x.stake + ' → ' + pot + ' T' : 'None') + '</span></div>'
        + '<div class="mpa-di-acts"><button class="mpa-du-y" data-dutake="' + esc(x.id) + '">Take it' + (x.stake > 0 ? ' · stake ' + x.stake + ' T' : '') + '</button></div></div>'; };
    var myOpenCard = function (x) { return '<div class="mpa-du-r"><div class="mpa-du-b"><div class="mpa-du-nm">Your open challenge</div><div class="mpa-du-met">' + DMET[x.metric] + ' · ' + durShort(x.dur) + (x.sym ? ' · ' + esc(x.sym) : '') + (x.stake > 0 ? ' · ' + x.stake + ' T staked' : '') + ' · waiting for a taker</div></div><button class="mpa-du-n" data-ducxl="' + esc(x.id) + '" style="flex:0 0 auto">Cancel</button></div>'; };
    function load() {
      Promise.all([
        fetch('/api/duel/mine').then(function (r) { return r.json(); }),
        fetch('/api/duel/openlist').then(function (r) { return r.json(); }).catch(function () { return { open: [] }; })
      ]).then(function (res) {
        var d = res[0] || {}, lobby = ((res[1] && res[1].open) || []).filter(function (x) { return !x.mine; });
        var du = bodyEl.querySelector('#mpaDu'); if (!du) return;
        var all = (d && d.duels) || [];
        if (!all.length && !lobby.length) {
          du.innerHTML = '<div class="mpa-xp-empty">No duels yet. Open a trader’s profile from the leaderboard and tap <b style="color:#f5a623">Duel</b> to throw down.</div>' + (window._mpPrem === false ? '<div class="mpa-ups" style="margin-top:12px"><b>Premium duels</b><p>Free duels are a 7-day ROE race. Premium unlocks Profit, Survival, Streak and Sniper formats, Tick stakes and faster rounds.</p><button type="button" id="mpaDuUps0">Go Premium</button></div>' : '');
          var u0 = du.querySelector('#mpaDuUps0'); if (u0) u0.addEventListener('click', function () { if (window.mpPremium && window.mpPremium.show) { close(); window.mpPremium.show('Duels'); } }); return;
        }
        var inc = all.filter(function (x) { return x.incoming; }), act = all.filter(function (x) { return x.status === 'active'; }), pend = all.filter(function (x) { return x.status === 'pending' && !x.incoming; }), mineOpen = all.filter(function (x) { return x.status === 'open'; }), done = all.filter(function (x) { return x.status === 'done'; });
        var html = '';
        if (inc.length) html += sec('Incoming challenges') + inc.map(incCard).join('');
        if (lobby.length) html += sec('Open challenges — first taker wins the spot') + lobby.map(lobbyCard).join('');
        if (act.length) html += sec('Active') + act.map(vsCard).join('');
        if (mineOpen.length) html += sec('Your open posts') + mineOpen.map(myOpenCard).join('');
        if (pend.length) html += sec('Waiting for reply') + pend.map(pendCard).join('');
        if (done.length) html += sec('Results') + done.map(resCard).join('');
        du.innerHTML = html;
        Array.prototype.forEach.call(du.querySelectorAll('[data-duacc]'), function (b) { b.addEventListener('click', function () { duelRespond(b.getAttribute('data-duacc'), 'accept', b); }); });
        Array.prototype.forEach.call(du.querySelectorAll('[data-dudec]'), function (b) { b.addEventListener('click', function () { duelRespond(b.getAttribute('data-dudec'), 'decline', b); }); });
        Array.prototype.forEach.call(du.querySelectorAll('[data-dutake]'), function (b) { b.addEventListener('click', function () {
          b.disabled = true;
          fetch('/api/duel/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.getAttribute('data-dutake') }) }).then(function (r) { return r.json(); }).then(function (jd) {
            if (jd && jd.ok) { renderDuels(); if (window.mpXpCheck) window.mpXpCheck(); }
            else { b.disabled = false; b.textContent = jd && jd.error === 'need_ticks' ? ('Need ' + jd.need + ' T') : jd && jd.error === 'gone' ? 'Already taken' : jd && jd.error === 'exists' ? 'Live duel with them' : 'Try again'; }
          }).catch(function () { b.disabled = false; });
        }); });
        Array.prototype.forEach.call(du.querySelectorAll('[data-ducxl]'), function (b) { b.addEventListener('click', function () {
          b.disabled = true;
          fetch('/api/duel/cancelopen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.getAttribute('data-ducxl') }) }).then(function (r) { return r.json(); }).then(function () { renderDuels(); if (window.mpXpCheck) window.mpXpCheck(); }).catch(function () { b.disabled = false; });
        }); });
        Array.prototype.forEach.call(du.querySelectorAll('[data-durem]'), function (b) { b.addEventListener('click', function () {
          b.disabled = true; b.textContent = '…';
          fetch('/api/duel/rematch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: b.getAttribute('data-durem') }) }).then(function (r) { return r.json(); }).then(function (jd) {
            if (jd && jd.ok) { renderDuels(); if (window.mpXpCheck) window.mpXpCheck(); }
            else { b.disabled = false; b.textContent = jd && jd.error === 'exists' ? 'Already live' : jd && jd.error === 'need_ticks' ? ('Need ' + jd.need + ' T') : jd && jd.error === 'too_many' ? 'At duel limit' : 'Rematch'; }
          }).catch(function () { b.disabled = false; b.textContent = 'Rematch'; });
        }); });
      }).catch(function () { var du = bodyEl.querySelector('#mpaDu'); if (du && !du.querySelector('.mpa-dv,.mpa-di,.mpa-du-r')) du.innerHTML = '<div class="mpa-xp-empty">Could not load your duels.</div>'; });
    }
    load();
    window._mpDuelT2 = setInterval(function () { var du = bodyEl.querySelector('#mpaDu'); if (!du) { clearInterval(window._mpDuelT2); if (window._mpDuelT1) clearInterval(window._mpDuelT1); return; } if (!document.hidden) load(); }, 30000); // fresh scores
    window._mpDuelT1 = setInterval(function () { var du = bodyEl.querySelector('#mpaDu'); if (!du) { clearInterval(window._mpDuelT1); return; } duelTick(du); }, 1000); // live countdown + progress
  }
  function duelRespond(id, action, btn) {
    if (btn) { btn.disabled = true; }
    fetch('/api/duel/respond', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id, action: action }) }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.error) { if (btn) { btn.disabled = false; btn.textContent = d.error === 'need_ticks' ? ('Need ' + d.need + ' T') : 'Try again'; } return; }
      renderDuels(); if (window.mpXpCheck) window.mpXpCheck();
    }).catch(function () { if (btn) btn.disabled = false; });
  }
  function duelNudge() { /* post-win momentum nudge -> duels (max 1/day) */
    try {
      var n = document.createElement('div');
      n.style.cssText = 'position:fixed;left:50%;bottom:86px;transform:translateX(-50%) translateY(8px);z-index:9999;display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#151a12,#0d1014);border:1px solid rgba(245,166,35,.5);border-radius:14px;padding:11px 14px;box-shadow:0 18px 50px -18px rgba(0,0,0,.85),0 0 30px -14px rgba(245,166,35,.5);opacity:0;transition:opacity .3s,transform .3s;max-width:92vw';
      n.innerHTML = '<span style="font:700 12.5px Familjen Grotesk,sans-serif;color:#e9e7df">On form. Put that streak on the line — challenge someone to a duel.</span><button type="button" style="flex:0 0 auto;background:#f5a623;color:#0a0b0d;border:none;border-radius:9px;padding:8px 13px;font:800 12px Familjen Grotesk,sans-serif;cursor:pointer">Duels</button><button type="button" aria-label="Dismiss" style="flex:0 0 auto;background:none;border:none;color:#5c656f;font-size:15px;cursor:pointer;padding:2px 4px">&#215;</button>';
      document.body.appendChild(n);
      requestAnimationFrame(function () { n.style.opacity = '1'; n.style.transform = 'translateX(-50%) translateY(0)'; });
      var kill = function () { n.style.opacity = '0'; setTimeout(function () { try { n.remove(); } catch (e) {} }, 320); };
      n.querySelectorAll('button')[0].addEventListener('click', function () { kill(); try { open(); renderDuels(); } catch (e) {} });
      n.querySelectorAll('button')[1].addEventListener('click', kill);
      setTimeout(kill, 9000);
    } catch (e) {}
  }
  function duelErr(d) { var e = d && d.error; return e === 'exists' ? 'You already have a live duel with this trader.' : e === 'daily_limit' ? ('Challenge limit for today (' + (d.cap || 5) + '). Back tomorrow' + (d.cap === 5 ? ' — Premium raises it to 20/day' : '') + '.') : e === 'open_cap' ? ('You already have an open challenge on the board' + (d.cap === 1 ? ' — Premium allows 3 at once' : '') + '. Cancel it or wait for a taker.') : e === 'not_connected' ? 'Follow this trader first to challenge them.' : e === 'need_username' ? 'Set a username first.' : e === 'too_many' ? ('You are at your live-duel limit' + (d.cap ? ' (' + d.cap + ')' : '') + '. Finish one first' + (d.cap === 1 ? ' — Premium raises it to 10' : '') + '.') : e === 'need_ticks' ? ('Not enough Ticks — you need ' + d.need + ' but have ' + d.have + '.') : e === 'premium_required' ? (d && d.teaser ? 'Your free premium-format duel for this week is used. Premium makes them unlimited.' : 'That is a Premium duel type.') : e === 'no_recipient' ? 'User not found.' : e === 'restricted' ? 'Your account cannot start duels right now.' : 'Could not send the challenge.'; }
  function renderDuelChallenge(name, isOpen) {
    name = String(name || '').replace(/[^a-zA-Z0-9_]/g, ''); if (!name && !isOpen) { renderDuels(); return; }
    ensurePrem(function (prem) {
      var xp = (window._mpXpBal != null ? window._mpXpBal : ((ME && ME.xp) || 0));
      var C = { type: 'roe', dur: 604800000, stake: 0, sym: '', maxTrades: 3 };
      function upsell(reason) { if (window.mpPremium && window.mpPremium.show) { close(); window.mpPremium.show(reason || 'Duels'); } }
      function draw() {
        var typeCards = DTYPES.map(function (t) { var locked = t.prem && !prem, on = C.type === t.k;
          return '<button class="mpa-dt' + (on ? ' on' : '') + (locked ? ' lk' : '') + '" data-dt="' + t.k + '"' + '>' + (locked ? '<span class="mpa-dt-pro">PRO · 1 free/wk</span>' : '') + '<span class="mpa-dt-ic">' + dico(t.k) + '</span><span class="mpa-dt-nm">' + t.nm + '</span><span class="mpa-dt-ds">' + t.ds + '</span></button>'; }).join(''); /* premium formats stay pickable for free users — every account gets ONE premium-format duel a week (server enforces) */
        var durSeg = DDUR.map(function (dd) { var locked = dd.v !== 604800000 && !prem; return '<b data-dur="' + dd.v + '" class="' + (C.dur === dd.v ? 'on' : '') + (locked ? ' lk' : '') + '" data-lk="' + (locked ? 1 : '') + '">' + dd.l + '</b>'; }).join('');
        var stkChips = DSTK.map(function (s) { var locked = !prem && s !== 0 && s !== 50; return '<button class="c' + (C.stake === s ? ' on' : '') + (locked ? ' lk' : '') + '" data-stk="' + s + '" data-lk="' + (locked ? 1 : '') + '">' + (s === 0 ? 'No stake' : s + ' T') + '</button>'; }).join('');
        var html = isOpen ? '<h3 class="mpa-h">Open challenge</h3><p class="mpa-sub" style="margin:-4px 0 12px">No target — it goes on the board and the FIRST trader to take it is in. Winner locked when the clock runs out.</p>' : '<h3 class="mpa-h">Challenge @' + esc(name) + '</h3><p class="mpa-sub" style="margin:-4px 0 12px">Set the terms. The winner is locked in the moment the clock runs out.</p>';
        html += '<div class="mpa-fld-l" style="margin-bottom:8px">Format</div><div class="mpa-dt-grid">' + typeCards + '</div>';
        html += '<div class="mpa-fld"><div class="mpa-fld-l">Duration' + (!prem ? ' <em>Premium unlocks faster rounds</em>' : '') + '</div><div class="mpa-seg">' + durSeg + '</div></div>';
        html += '<div class="mpa-fld"><div class="mpa-fld-l">XP wager' + (!prem ? ' <em>Premium sets any amount</em>' : '') + '</div><div class="mpa-stk">' + stkChips + '</div>' + (C.stake > 0 ? '<div class="mpa-stk-info"><span>Your XP: <b>' + xp.toLocaleString() + '</b></span><span>Winner takes <b>' + (C.stake * 2) + ' T</b></span></div>' : '') + '</div>';
        if (C.type === 'sniper') html += '<div class="mpa-fld"><div class="mpa-fld-l">Shots <em>first N trades count</em></div><div class="mpa-seg">' + [1, 2, 3, 4, 5].map(function (n) { return '<b data-mt="' + n + '" class="' + (C.maxTrades === n ? 'on' : '') + '">' + n + '</b>'; }).join('') + '</div></div>';
        if (prem) html += '<div class="mpa-fld"><div class="mpa-fld-l">Lock to one coin <em>optional</em></div><input class="mpa-symin" id="mpaDuSym" maxlength="12" placeholder="e.g. BTC — blank = any coin" value="' + esc(C.sym) + '"></div>';
        html += '<button class="mpa-send" id="mpaDuSend">' + (isOpen ? 'Post to the board' : 'Send challenge') + '</button><div class="mpa-du-msg" id="mpaDuMsg"></div>';
        if (!prem) html += '<div class="mpa-ups"><b>Unlock the full arena</b><p>Premium opens 4 more duel formats, Tick stakes up to 2,000, 1h/24h/3-day rounds, and up to 10 duels at once.</p><button type="button" id="mpaDuUps">Go Premium</button></div>';
        html += '<button class="mpa-link" id="mpaDuCancel" type="button" style="margin-top:10px">Cancel</button>';
        bodyEl.innerHTML = html;
        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-dt]'), function (b) { b.addEventListener('click', function () { C.type = b.getAttribute('data-dt'); draw(); }); });
        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-dur]'), function (b) { b.addEventListener('click', function () { if (b.getAttribute('data-lk')) { upsell('Faster duel rounds'); return; } C.dur = +b.getAttribute('data-dur'); draw(); }); });
        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-stk]'), function (b) { b.addEventListener('click', function () { if (b.getAttribute('data-lk')) { upsell('Custom Tick stakes'); return; } C.stake = +b.getAttribute('data-stk'); draw(); }); });
        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-mt]'), function (b) { b.addEventListener('click', function () { C.maxTrades = +b.getAttribute('data-mt'); draw(); }); });
        var sy = bodyEl.querySelector('#mpaDuSym'); if (sy) sy.addEventListener('input', function () { var p = sy.selectionStart; C.sym = sy.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase(); sy.value = C.sym; try { sy.setSelectionRange(p, p); } catch (e) {} });
        var cc = bodyEl.querySelector('#mpaDuCancel'); if (cc) cc.addEventListener('click', renderDuels);
        var up = bodyEl.querySelector('#mpaDuUps'); if (up) up.addEventListener('click', function () { upsell('Duels'); });
        var snd = bodyEl.querySelector('#mpaDuSend'); if (snd) snd.addEventListener('click', function () {
          snd.disabled = true; var msg = bodyEl.querySelector('#mpaDuMsg'); if (msg) msg.innerHTML = 'Sending…';
          fetch('/api/duel/challenge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: name, open: isOpen ? 1 : 0, metric: C.type, dur: C.dur, stake: C.stake, sym: C.sym, maxTrades: C.maxTrades }) }).then(function (r) { return r.json(); }).then(function (d) {
            if (d && d.ok) { if (msg) msg.innerHTML = '<span style="color:#34d99a">' + (isOpen ? 'Posted. It is on the board — first taker starts the clock.' : 'Challenge sent to @' + esc(name) + '. It is waiting in their Duels.') + '</span>'; if (window.mpXpCheck) window.mpXpCheck(); setTimeout(renderDuels, 1300); }
            else { snd.disabled = false; if (msg) msg.innerHTML = '<span style="color:#ffb347">' + duelErr(d) + '</span>'; }
          }).catch(function () { snd.disabled = false; if (msg) msg.innerHTML = '<span style="color:#ffb347">Network error — try again.</span>'; });
        });
      }
      draw();
    });
  }
  // ---- Profile personalization editor ----
  var ACCENTS = ['#c2f64a', '#38bdf8', '#ff9640', '#c78bff', '#34d99a', '#ff6c5c', '#ffd75a', '#f472b6'];
  // resize an uploaded image to a square avatar (cover), compressed to a small data URI
  function makeAvatar(file, cb) {
    if (!file || !/^image\//.test(file.type)) { cb(null, 'That’s not an image file.'); return; }
    if (file.size > 12 * 1024 * 1024) { cb(null, 'Image is too large (max 12MB).'); return; }
    var fr = new FileReader();
    fr.onload = function () { var img = new Image(); img.onload = function () {
      var S = 160, cv = document.createElement('canvas'); cv.width = S; cv.height = S; var ctx = cv.getContext('2d');
      var s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) / 2;
      try { ctx.imageSmoothingQuality = 'high'; } catch (e) {}
      ctx.drawImage(img, sx, sy, s, s, 0, 0, S, S);
      var out = ''; try { out = cv.toDataURL('image/webp', 0.72); } catch (e) {}
      if (!out || out.indexOf('data:image/webp') !== 0) out = cv.toDataURL('image/jpeg', 0.78);
      if (out.length > 58000) out = cv.toDataURL('image/jpeg', 0.6);
      if (out.length > 58000) { cb(null, 'Could not compress that image — try a simpler one.'); return; }
      cb(out, null);
    }; img.onerror = function () { cb(null, 'Could not read that image.'); }; img.src = fr.result; };
    fr.onerror = function () { cb(null, 'Could not read that file.'); };
    fr.readAsDataURL(file);
  }
  function renderBalance() {
    if (!bodyEl) return;
    bodyEl.innerHTML = '<h3 class="mpa-h">Balance Mode</h3><p class="mpa-sub">Checking your membership…</p>';
    fetch('/api/premium/status', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (st) {
      if (!st || !st.premium) { if (window.mpPremium && window.mpPremium.show) window.mpPremium.show('Unlock Balance Mode'); render(); return; }
      if (!document.getElementById('mpaBalCss')) { var s2 = document.createElement('style'); s2.id = 'mpaBalCss'; s2.textContent = '.bal-seg{display:flex;gap:0;background:#0a0d11;border:1px solid #232b36;border-radius:12px;padding:4px;margin:2px 0 12px}.bal-seg button{flex:1;padding:13px;border:none;background:none;color:#8b97a5;font-size:14px;font-weight:800;letter-spacing:.08em;border-radius:9px;cursor:pointer;transition:.15s;-webkit-appearance:none;appearance:none}.bal-seg button.off{background:#2a2f38;color:#e9e7df}.bal-seg button.on{background:#c2f64a;color:#0a0b0d}.bal-status{font-size:12.5px;color:#8b97a5;line-height:1.55;padding:11px 13px;background:#0a0d11;border:1px solid #232b36;border-radius:11px}.bal-status.on{border-color:rgba(194,246,74,.3);color:#c7cdd4}.bal-status b{color:#c2f64a}.bal-econ{margin-top:14px;background:linear-gradient(158deg,rgba(194,246,74,.06),#0a0d11);border:1px solid #232b36;border-radius:12px;padding:12px 14px}.bal-econ-h{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7f8893;margin-bottom:9px}.bal-econ-r{display:flex;align-items:baseline;gap:10px;padding:5px 0}.bal-econ-r b{flex:none;width:90px;color:#c2f64a;font-family:ui-monospace,Consolas,monospace;font-size:14px;font-weight:800}.bal-econ-r span{font-size:12px;color:#a9b3bf;line-height:1.35}'; document.head.appendChild(s2); }
      function draw(on) {
        var cc = window.mpBal.cfg();
        bodyEl.innerHTML = '<button class="mpa-row2" id="mpaBalBack" type="button" style="margin-bottom:12px">' + ic('chev') + '<span>Back</span></button>'
          + '<h3 class="mpa-h">Balance Mode <span style="font:700 9px \'Space Mono\',monospace;color:#c2f64a;background:rgba(194,246,74,.14);border-radius:5px;padding:2px 6px;vertical-align:2px">PREMIUM</span></h3>'
          + '<p class="mpa-sub" style="margin:-2px 0 14px">Trade a real portfolio instead of unlimited paper money. Every trade draws its margin from your balance — blow it up and you feel it, exactly like a real account.</p>'
          + '<div class="bal-seg"><button type="button" data-balset="0" class="' + (on ? '' : 'off') + '">OFF</button><button type="button" data-balset="1" class="' + (on ? 'on' : '') + '">ON</button></div>'
          + '<div class="bal-status ' + (on ? 'on' : '') + '">' + (on ? 'Balance Mode is <b>ON</b> — you\'re trading a <b>$' + cc.start.toLocaleString() + '</b> portfolio. It shows at the top of <b>My Trades</b>.' : 'Balance Mode is <b>OFF</b> — normal paper trading with no balance limit.') + '</div>'
          + (on ? '<div class="bal-econ"><div class="bal-econ-h">How your balance grows</div><div class="bal-econ-r"><b>$10,000</b><span>to start — just for being VIP</span></div><div class="bal-econ-r"><b>+$10,000</b><span>every new day you show up and trade</span></div><div class="bal-econ-r"><b>+ bonus</b><span>from completing your daily missions</span></div></div>' : '')
          + (on ? '<button class="mpa-flink" id="mpaBalReset" type="button" style="margin-top:14px">' + ic('spark') + 'Reset balance to $10,000</button>' : '');
        var bk = bodyEl.querySelector('#mpaBalBack'); if (bk) bk.addEventListener('click', render);
        Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-balset]'), function (b) { b.addEventListener('click', function () { var want = b.getAttribute('data-balset') === '1'; window.mpBal.setCfg(want); draw(want); }); });
        var rs = bodyEl.querySelector('#mpaBalReset'); if (rs) rs.addEventListener('click', function () { if (!confirm('Reset your balance back to $10,000? Your open Balance-Mode trades stay open.')) return; window.mpBal.setCfg(true, true); draw(true); });
      }
      draw(window.mpBal.cfg().on);
    }).catch(function () { render(); });
  }
  var FRAMES = [
    { k: 'default', name: 'Classic', by: 'Free' },
    { k: 'silver', name: 'Silver', by: 'Reach Silver' },
    { k: 'gold', name: 'Gold', by: 'Reach Gold' },
    { k: 'platinum', name: 'Platinum', by: 'Reach Platinum' },
    { k: 'diamond', name: 'Diamond', by: 'Reach Diamond' },
    { k: 'legendary', name: 'Legendary', by: 'Reach Legendary' },
    { k: 'neon', name: 'Neon', by: 'Premium' },
    { k: 'aurora', name: 'Aurora', by: 'Premium' },
    { k: 'founder', name: 'Founder', by: 'Founder' },
    { k: 'owner', name: 'MP One', by: 'Owner' },
    { k: 'carbon', name: 'Carbon', by: 'Vault' },
    { k: 'jade', name: 'Jade', by: 'Vault' },
    { k: 'royal', name: 'Royal', by: 'Vault' },
    { k: 'blood', name: 'Bloodline', by: 'Vault' },
    { k: 'matrix', name: 'Matrix', by: 'Vault' },
    { k: 'ice', name: 'Glacier', by: 'Vault' },
    { k: 'ember', name: 'Ember', by: 'Vault' },
    { k: 'sakura', name: 'Sakura', by: 'Vault' },
    { k: 'void', name: 'Void', by: 'Vault' },
    { k: 'sovereign', name: 'Sovereign', by: 'Vault' },
    { k: 'eclipse', name: 'Eclipse', by: 'Vault - limited' },
    { k: 'streak7', name: 'Kindling', by: '7-day streak' },
    { k: 'streak30', name: 'Wildfire', by: '30-day streak' },
    { k: 'streak100', name: 'Eternal Flame', by: '100-day streak' },
    { k: 'inferno', name: 'Inferno', by: 'Vault' },
    { k: 'dwell10', name: 'Local', by: '10h on site' },
    { k: 'dwell100', name: 'Resident', by: '100h on site' },
    { k: 'closer', name: 'The Closer', by: '500 closes' },
    { k: 'operative', name: 'Operative', by: '100 missions' },
    { k: 'mission500', name: 'Quartermaster', by: '500 missions' },
    { k: 'og180', name: 'OG', by: '6 months on MarginPad' },
    { k: 'xp100k', name: 'Centurion', by: '100k lifetime XP' },
    { k: 'closer2k', name: 'Overclock', by: '2,000 closes' },
    { k: 'dwell500', name: 'Furniture', by: '500h on site' },
    { k: 'dragonfire', name: 'Dragonfire', by: 'Vault' },
    { k: 'singularity', name: 'Singularity', by: 'Vault' },
    { k: 'midas', name: 'Midas', by: 'Vault' },
    { k: 'realtrader', name: 'Real Trader', by: 'Gifted by the house' },
    { k: 'champion', name: 'Champion', by: 'Season #1 — Highest ROE' },
    { k: 'deadeye', name: 'Deadeye', by: 'Season #1 — Win-Rate' },
    { k: 'overdrive', name: 'Overdrive', by: 'Season #1 — XP' },
    { k: 'tycoon', name: 'Tycoon', by: 'Season #1 — Spot Bank' }
  ];
  function renderCustomize() {
    bodyEl.innerHTML = '<h3 class="mpa-h">Customize card</h3>'
      + '<div class="mpa-frhead"><p class="mpa-sub">Frame for your public trader card.</p>'
      + '<span class="mpa-frseg" id="mpaFrSeg"><button type="button" data-frv="mine">YOURS</button><button type="button" data-frv="all">ALL</button></span></div>'
      + '<div class="mpa-frgrid" id="mpaFrGrid"><div class="mpa-xp-empty" style="grid-column:1/-1">Loading…</div></div>'
      + '<button class="mpa-row2" id="mpaFrPic" type="button" style="margin-top:10px">' + ic('cam') + '<span>Change profile picture</span>' + ic('chev') + '</button>'
      + '<div class="mpa-du-msg" id="mpaFrMsg" style="margin-top:8px"></div>'
      + '<button class="mpa-link" id="mpaFrBack" type="button">← Back</button>';
    var bk = bodyEl.querySelector('#mpaFrBack'); if (bk) bk.addEventListener('click', render);
    var pc = bodyEl.querySelector('#mpaFrPic'); if (pc) pc.addEventListener('click', function () { renderEditProfile(); });
    var msg = bodyEl.querySelector('#mpaFrMsg');
    fetch('/api/auth/frames').then(function (r) { return r.json(); }).then(function (d) {
      var owned = (d && d.owned) || ['default']; var eq = (d && d.equipped) || 'default';
      var grid = bodyEl.querySelector('#mpaFrGrid'); if (!grid) return;
      // yours first — equipped, then the rest you own, then everything still locked. The list you scroll
      // starts with the frames you can actually wear instead of burying them in catalogue order.
      var ordered = FRAMES.slice().sort(function (a, b) {
        var ra = (a.k === eq ? 0 : owned.indexOf(a.k) >= 0 ? 1 : 2);
        var rb = (b.k === eq ? 0 : owned.indexOf(b.k) >= 0 ? 1 : 2);
        return ra - rb || FRAMES.indexOf(a) - FRAMES.indexOf(b);
      });
      var view = 'mine'; try { view = localStorage.getItem('mp_frview') === 'all' ? 'all' : 'mine'; } catch (e) {}
      function paint() {
        var list = view === 'all' ? ordered : ordered.filter(function (f) { return owned.indexOf(f.k) >= 0; });
        grid.innerHTML = list.map(function (f) {
          var own = owned.indexOf(f.k) >= 0; var isEq = f.k === eq;
          return '<button class="mpa-fr' + (isEq ? ' on' : '') + (own ? '' : ' lock') + '" data-frame="' + f.k + '"' + (own ? '' : ' disabled') + '>'
            + '<div class="mpa-fr-sw frame-' + f.k + '"></div>'
            + '<div class="mpa-fr-nm">' + f.name + '</div>'
            + '<div class="mpa-fr-by">' + (own ? (isEq ? 'Equipped' : 'Owned') : f.by) + '</div>'
            + '</button>';
        }).join('') || '<div class="mpa-frnone">Only the Classic frame so far. Rank up, go Premium or open the Vault to unlock more &mdash; switch to ALL to see what is out there.</div>';
        var seg = bodyEl.querySelector('#mpaFrSeg');
        if (seg) Array.prototype.forEach.call(seg.querySelectorAll('[data-frv]'), function (b2) { b2.classList.toggle('on', b2.getAttribute('data-frv') === view); });
        wire();
      }
      var seg0 = bodyEl.querySelector('#mpaFrSeg');
      if (seg0) seg0.addEventListener('click', function (e2) {
        var b3 = e2.target.closest && e2.target.closest('[data-frv]'); if (!b3) return;
        view = b3.getAttribute('data-frv'); try { localStorage.setItem('mp_frview', view); } catch (e3) {}
        paint();
      });
      paint();
      function wire() {
      Array.prototype.forEach.call(grid.querySelectorAll('[data-frame]:not([disabled])'), function (b) {
        b.addEventListener('click', function () {
          var fr = b.getAttribute('data-frame');
          if (msg) msg.innerHTML = '<span style="color:#8b97a5">Saving…</span>';
          fetch('/api/auth/frame', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ frame: fr }) })
            .then(function (r) { return r.json(); }).then(function (rd) {
              if (rd && rd.ok) {
                if (ME) ME.frame = rd.frame;
                Array.prototype.forEach.call(grid.querySelectorAll('.mpa-fr'), function (x) {
                  var k = x.getAttribute('data-frame'); x.classList.toggle('on', k === rd.frame);
                  if (owned.indexOf(k) >= 0) { var by = x.querySelector('.mpa-fr-by'); if (by) by.textContent = (k === rd.frame ? 'Equipped' : 'Owned'); }
                });
                if (msg) msg.innerHTML = '<span style="color:#34d99a">Frame equipped! Your trader card is updated.</span>';
              } else if (msg) msg.innerHTML = '<span style="color:#ffb347">' + (rd && rd.error === 'locked' ? 'You do not own that frame yet.' : 'Could not equip — try again.') + '</span>';
            }).catch(function () { if (msg) msg.innerHTML = '<span style="color:#ffb347">Network error — try again.</span>'; });
        });
      });
      }
    }).catch(function () { var grid = bodyEl.querySelector('#mpaFrGrid'); if (grid) grid.innerHTML = '<div class="mpa-xp-empty" style="grid-column:1/-1">Could not load frames.</div>'; });
  }
  function renderEditProfile() {
    var bio = (ME && ME.bio) || '', av = (ME && ME.avatar) || '', ac = (ME && ME.accent) || '', co = (ME && ME.coins) || '';
    var avState = av; // current avatar (data URI or emoji), updated on upload
    function avInner(a) { return a ? avatarHtml(a) : ic('cam'); }
    bodyEl.innerHTML = '<h3 class="mpa-h">Edit profile</h3><p class="mpa-sub" style="margin:-4px 0 14px">This shows on your public trader card.</p>'
      + '<div class="mpa-avedit"><button type="button" class="mpa-avdrop' + (avState ? ' has' : '') + '" id="mpaAvDrop">' + avInner(avState) + '<span class="mpa-avcam">' + ic('cam') + '</span></button>'
      + '<div class="mpa-avside"><div class="mpa-avttl">Profile picture</div><div class="mpa-avsub">Square works best · JPG/PNG/WebP</div><div class="mpa-avbtns"><button type="button" class="mpa-avbtn" id="mpaAvPick">Upload</button><button type="button" class="mpa-avbtn ghost" id="mpaAvClear"' + (avState ? '' : ' hidden') + '>Remove</button></div></div>'
      + '<input type="file" accept="image/*" id="mpaAvFile" hidden></div>'
      + '<label class="mpa-pl" style="margin-top:16px">Accent colour</label><div class="mpa-pacc" id="mpaPacc">' + ACCENTS.map(function (c) { return '<button type="button" class="mpa-pc' + (c === ac ? ' on' : '') + '" data-acc="' + c + '" style="background:' + c + '"></button>'; }).join('') + '</div>'
      + '<label class="mpa-pl" style="margin-top:14px">Bio <span style="color:#5c656f">(160 chars)</span></label><textarea class="mpa-in" id="mpaPbio" maxlength="160" rows="3" placeholder="Swing trader. BTC maxi. Risk 1% per trade." style="resize:vertical;min-height:64px">' + esc(bio) + '</textarea>'
      + '<label class="mpa-pl" style="margin-top:14px">Favourite coins <span style="color:#5c656f">(up to 6, comma-separated)</span></label><input class="mpa-in" id="mpaPco" placeholder="BTC, ETH, SOL" value="' + esc(co) + '">'
      + '<div class="mpa-du-msg" id="mpaPmsg"></div>'
      + '<button class="mpa-btn" id="mpaPsave" type="button" style="margin-top:8px">Save profile</button><button class="mpa-link" id="mpaPback" type="button">← Back</button>';
    var bk = bodyEl.querySelector('#mpaPback'); if (bk) bk.addEventListener('click', render);
    var drop = bodyEl.querySelector('#mpaAvDrop'), fileIn = bodyEl.querySelector('#mpaAvFile'), pick = bodyEl.querySelector('#mpaAvPick'), clr = bodyEl.querySelector('#mpaAvClear'), pmsg = bodyEl.querySelector('#mpaPmsg');
    function paintAv() { drop.innerHTML = avInner(avState) + '<span class="mpa-avcam">' + ic('cam') + '</span>'; drop.classList.toggle('has', !!avState); if (clr) clr.hidden = !avState; }
    function onFile(f) { if (pmsg) pmsg.innerHTML = '<span style="color:#8b97a5">Processing image…</span>'; makeAvatar(f, function (data, err) { if (err) { if (pmsg) pmsg.innerHTML = '<span style="color:#ffb347">' + err + '</span>'; return; } avState = data; paintAv(); if (pmsg) pmsg.innerHTML = ''; }); }
    if (pick) pick.addEventListener('click', function () { fileIn.click(); });
    if (drop) drop.addEventListener('click', function () { fileIn.click(); });
    if (fileIn) fileIn.addEventListener('change', function () { if (fileIn.files && fileIn.files[0]) onFile(fileIn.files[0]); fileIn.value = ''; });
    if (clr) clr.addEventListener('click', function () { avState = ''; paintAv(); });
    var accSel = ac;
    Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-acc]'), function (b) { b.addEventListener('click', function () { accSel = (accSel === b.getAttribute('data-acc')) ? '' : b.getAttribute('data-acc'); Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-acc]'), function (x) { x.classList.toggle('on', x.getAttribute('data-acc') === accSel); }); }); });
    var sv = bodyEl.querySelector('#mpaPsave');
    if (sv) sv.addEventListener('click', function () {
      sv.disabled = true; var msg = bodyEl.querySelector('#mpaPmsg'); if (msg) msg.innerHTML = 'Saving…';
      var payload = { bio: bodyEl.querySelector('#mpaPbio').value, avatar: avState, accent: accSel, coins: bodyEl.querySelector('#mpaPco').value };
      fetch('/api/auth/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); }).then(function (d) {
        sv.disabled = false;
        if (d && d.ok) { if (ME) { ME.bio = d.bio; ME.avatar = d.avatar; ME.accent = d.accent; ME.coins = d.coins; } if (msg) msg.innerHTML = '<span style="color:#34d99a">Saved! Your trader card is updated.</span>'; setTimeout(render, 1100); }
        else { if (msg) msg.innerHTML = '<span style="color:#ffb347">Could not save — try again.</span>'; }
      }).catch(function () { sv.disabled = false; if (msg) msg.innerHTML = '<span style="color:#ffb347">Network error — try again.</span>'; });
    });
  }
  // ---- Notifications center ----
  function notifSetBadge(n) { n = +n || 0; window._mpNotifUnread = n; setDot('mpaNotifBadge', n); refreshTrigDot(); }
  window.mpNotifBadge = notifSetBadge;
  function notifIcon(k) { var m = { dm: 'chat', duel: 'swords', mention: 'chat', follow: 'user', gift: 'gift' }; return '<span style="color:#8b97a5;display:flex;justify-content:center">' + ic(m[k] || 'bell') + '</span>'; }
  function renderNotifs() {
    bodyEl.innerHTML = '<h3 class="mpa-h">Notifications</h3><div class="mpa-nf" id="mpaNf"><div class="mpa-xp-empty">Loading…</div></div><button class="mpa-link" id="mpaNfBack" type="button">← Back to profile</button>';
    var bk = bodyEl.querySelector('#mpaNfBack'); if (bk) bk.addEventListener('click', render);
    fetch('/api/auth/notifs').then(function (r) { return r.json(); }).then(function (d) {
      var nf = bodyEl.querySelector('#mpaNf'); if (!nf) return;
      var list = (d && d.notifs) || [];
      if (!list.length) { nf.innerHTML = '<div class="mpa-xp-empty">No notifications yet. Follows, messages, @mentions and duel results will show up here.</div>'; }
      else { nf.innerHTML = list.map(function (n) { var link = n.link || ''; return '<div class="mpa-nf-r' + (n.seen ? '' : ' unseen') + '"' + (link ? ' data-nflink="' + esc(link) + '" role="button"' : '') + '><span class="mpa-nf-ic">' + notifIcon(n.kind) + '</span><div class="mpa-nf-b">' + esc(n.body) + '<span class="mpa-nf-ago">' + xpAgo(n.ts) + '</span></div></div>'; }).join('');
        Array.prototype.forEach.call(nf.querySelectorAll('[data-nflink]'), function (r) { r.addEventListener('click', function () { var l = r.getAttribute('data-nflink'); if (l.indexOf('dm:') === 0) renderDmThread(l.slice(3)); else if (l === 'duel') renderDuels(); else if (l.indexOf('profile:') === 0) { var nm = l.slice(8); if (window.mpOpenProfile) { close(); window.mpOpenProfile(nm); } else if (window.lbOpenProfile) { close(); window.lbOpenProfile(nm); } } }); });
      }
      // mark all read (clears the bell) once viewed
      fetch('/api/auth/notifs?seen=1').then(function () { notifSetBadge(0); }).catch(function () {});
    }).catch(function () { var nf = bodyEl.querySelector('#mpaNf'); if (nf) nf.innerHTML = '<div class="mpa-xp-empty">Could not load notifications.</div>'; });
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
          + (hasU ? '<div class="mpa-prow mpa-prow--wide"><span>Username</span><b' + ((window.mpIsPro && window.mpIsPro(ME.username)) ? ' class="mp-progold"' : '') + '>' + esc(ME.username) + '</b></div>' : '')
          + '<div class="mpa-prow mpa-prow--wide"><span>Email</span><b>' + esc(ME.email) + '</b></div>'
          + (ME.status && ME.status !== 'active' ? '<div class="mpa-prow mpa-prow--wide"><span>Status</span><b style="color:#ffb347;text-transform:capitalize">' + esc(ME.status) + '</b></div>' : '')
        + '</div>'
        + '<div class="mpa-stat3">'
          + '<div class="mpa-st"><b>' + fmtDate(ME.created) + '</b><span>Member since</span></div>'
          + '<div class="mpa-st"><b>' + tradeCount() + '</b><span>Paper trades</span></div>'
          + (hasU ? '<div class="mpa-st"><b id="mpaFollowers">…</b><span>Followers</span></div>' : '')
        + '</div>'
        + (hasU ? '' : '<label style="display:block;font-size:11px;color:#9aa3ad;margin:8px 0 5px">Pick a username <span style="color:#5c656f">(public, permanent)</span></label><input class="mpa-in" id="mpaUname" maxlength="20" autocomplete="off" placeholder="choose a username"><button class="mpa-btn" id="mpaSaveU" type="button">Set username</button><div class="mpa-msg"></div>')
        + (ME.muted ? '<p class="mpa-foot" style="color:#ffb347">You are muted in chat.</p>' : '')
        + (hasU ? '<div class="mpa-tiles">'
          + tileBtn('mpaNotif', 'bell', 'Notifications', 'mpaNotifBadge')
          + tileBtn('mpaMsg', 'chat', 'Messages', 'mpaMsgBadge')
          + tileBtn('mpaFeed', 'feed', 'Following', '')
          + tileBtn('mpaDuel', 'swords', 'Duels', 'mpaDuelBadge')
        + '</div>'
          + '<button class="mpa-row2" id="mpaBal" type="button"><svg class="mpa-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="14" r="1.4"/></svg><span>Balance Mode</span><span style="font:700 9px \'Space Mono\',monospace;color:#c2f64a;background:rgba(194,246,74,.14);border-radius:5px;padding:2px 6px">PREMIUM</span>' + ic('chev') + '</button>'
          + '<button class="mpa-row2" id="mpaBrief" type="button"><svg class="mpa-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8M8 9h2"/></svg><span>Daily Brief</span><span style="font:700 9px \'Space Mono\',monospace;color:#c2f64a;background:rgba(194,246,74,.14);border-radius:5px;padding:2px 6px">PREMIUM</span>' + ic('chev') + '</button>'
          + '<button class="mpa-row2" id="mpaEdit" type="button">' + ic('edit') + '<span>Edit profile</span>' + ic('chev') + '</button>'
          + '<button class="mpa-row2" id="mpaFrames" type="button"><svg class="mpa-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg><span>Customize card</span>' + ic('chev') + '</button>'
          + '<button class="mpa-row2" id="mpaXp" type="button">' + ic('spark') + '<span>XP history</span>' + ic('chev') + '</button>' : '')
        + '<div class="mpa-foot2">'
          + '<button class="mpa-flink" id="mpaSup" type="button">' + ic('help') + 'Support</button>'
          + '<button class="mpa-flink" id="mpaLogout" type="button">' + ic('out') + 'Sign out</button>'
        + '</div>'
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
      var xpB = bodyEl.querySelector('#mpaXp'); if (xpB) xpB.addEventListener('click', function () { renderXpHistory(); });
      var nfB = bodyEl.querySelector('#mpaNotif'); if (nfB) nfB.addEventListener('click', function () { renderNotifs(); });
      var msgB = bodyEl.querySelector('#mpaMsg'); if (msgB) msgB.addEventListener('click', function () { renderDmInbox(); });
      var fdB = bodyEl.querySelector('#mpaFeed'); if (fdB) fdB.addEventListener('click', function () { renderFeed(); });
      var duB = bodyEl.querySelector('#mpaDuel'); if (duB) duB.addEventListener('click', function () { renderDuels(); });
      var edB = bodyEl.querySelector('#mpaEdit'); if (edB) edB.addEventListener('click', function () { renderEditProfile(); });
      var frB = bodyEl.querySelector('#mpaFrames'); if (frB) frB.addEventListener('click', function () { renderCustomize(); });
      var blB = bodyEl.querySelector('#mpaBal'); if (blB) blB.addEventListener('click', function () { renderBalance(); });
      var brB = bodyEl.querySelector('#mpaBrief'); if (brB) brB.addEventListener('click', function () { close(); if (window.mpBrief) window.mpBrief.show(); });
      dmSetBadge(window._mpDmUnread || 0); duelSetBadge(window._mpDuelPending || 0); notifSetBadge(window._mpNotifUnread || 0);
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
      fetch('/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email, code: c, ref: refCode() }) })
        .then(function (r) { return r.json(); }).then(function (d) {
          vb.disabled = false;
          if (d.ok) { ME = d.user; try { window.mpTktSkin = (ME && ME.tktskin) || ''; } catch (e) {} reflect(); setMsg(d.isNew ? 'Account created ✓' : 'Signed in ✓', 'ok'); if (d.isNew && typeof gtag === 'function') { try { gtag('event', 'conversion', { send_to: 'AW-18230384038/8GygCJ2ry8IcEKar9vRD', value: 1.0, currency: 'USD' }); } catch (_) {} } setTimeout(render, 750); }
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
    var _ph = ''; try { _ph = sessionStorage.getItem('mp_pull_h') || ''; } catch (e) {}
    fetch('/api/auth/trades' + (_ph ? '?h=' + encodeURIComponent(_ph) : ''), { headers: { accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && d.h) { try { sessionStorage.setItem('mp_pull_h', d.h); } catch (e) {} }
      if (d && d.same) return; // journal unchanged server-side — zero-cost pull (A1)
      if (!d || !Array.isArray(d.journal) || !d.journal.length) return;
      var local = []; try { local = JSON.parse(localStorage.getItem('mp_journal') || '[]') || []; } catch (e) {} if (!Array.isArray(local)) local = [];
      var byId = {}, order = [];
      function put(e) { if (!e || typeof e !== 'object') return; var id = String(e.id || ('_a' + order.length)); var prev = byId[id]; if (prev === undefined) { byId[id] = e; order.push(id); return; } var pc = (prev.status === 'win' || prev.status === 'loss'), cc = (e.status === 'win' || e.status === 'loss');
        if (cc && !pc) { byId[id] = e; return; }                     // a close always beats an open
        // EXCEPTION (2026-08-11, phantom-liq heal): a local LIQUIDATION of an srv trade is only a CLAIM until the server
        // confirms it (sc). If the server still says OPEN 5+ minutes later, its candle-check refuted the claim (a real
        // cross settles within one sweep) — take the server's open row back so the user's ticket un-liquidates. Manual
        // closes (via /botclose) and non-srv trades keep the old local-wins rule.
        if (!cc && pc && prev.liquidated && !prev.sc && String(id).slice(0, 3) === 'srv' && (Date.now() - (+prev.closeTs || 0)) > 300000) { byId[id] = e; return; }
        if (!cc && pc) return;                                       // never let a stale server 'open' overwrite a locally-closed trade
        if (cc && pc) { byId[id] = e; return; }
        var pq = +prev.qty, cq = +e.qty; if (isFinite(pq) && isFinite(cq) && cq > pq) return; byId[id] = e; } // both open → keep the more-reduced (partial-close safe)
      local.forEach(put); d.journal.forEach(put); // server applied last → wins same-state ties; a stale local 'open' never overwrites a stored close
      var merged = order.map(function (id) { return byId[id]; });
      try { var _bt = JSON.parse(localStorage.getItem('mp_bal_tags') || '{}') || {}; for (var _i = 0; _i < merged.length; _i++) { var _e = merged[_i]; if (_e && _e.id && !_e.bal && _bt[_e.id]) _e.bal = _bt[_e.id]; } } catch (e) {} // restore the Balance-Mode session tag the server strips — keeps the gold ticket (pp-gold) + BAL badge stable across syncs (no flicker)
      merged.sort(function (a, b) { return (+a.ts || 0) - (+b.ts || 0); });
      if (JSON.stringify(merged) === JSON.stringify(local)) return; // nothing new on this device
      try { if (window.mpJStore) window.mpJStore(merged); else localStorage.setItem('mp_journal', JSON.stringify(merged)); } catch (e) {} // shared writer: sheds oldest CLOSED rows if the device is full instead of silently dropping the whole merge
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
  setInterval(function () { if (!document.hidden) syncTrades(); }, 12000); // A1: background tabs don't sync — flushed on pagehide + next visible tick
  window.addEventListener('pagehide', function () { try { var j2 = localStorage.getItem('mp_journal') || ''; if (ME && j2 && j2 !== lastJ && j2.length < 60000 && navigator.sendBeacon) { lastJ = j2; navigator.sendBeacon('/api/auth/trades', new Blob([JSON.stringify({ journal: JSON.parse(j2) })], { type: 'application/json' })); } } catch (e) {} });
  // pull the server journal periodically so trades opened elsewhere — cross-device AND via the Bot API — appear LIVE in My Trades
  setInterval(function () { if (ME && document.visibilityState === 'visible') { try { pullTrades(); } catch (_) {} } }, 40000); // server-journal pull: 40s (cross-device/bot sync doesn't need faster) — lowers steady-state load on the single 'main' UserStore DO, which reduces the reset/"internal error" rate
  document.addEventListener('visibilitychange', function () { if (ME && document.visibilityState === 'visible') { try { pullTrades(); } catch (_) {} } });

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

  window.mpAuth = { open: open, close: close, me: function () { return ME; }, sync: syncTrades,
    dm: function (name) { if (!ME) { open(); return; } open(); setTimeout(function () { try { renderDmThread(name); } catch (e) {} }, 30); },
    duel: function (name) { open(); setTimeout(function () { try { if (ME) renderDuelChallenge(name); } catch (e) {} }, 30); },
    duelOpen: function () { open(); setTimeout(function () { try { if (ME) renderDuelChallenge('', true); } catch (e) {} }, 30); },
    duelsView: function () { open(); setTimeout(function () { try { if (ME) renderDuels(); } catch (e) {} }, 30); } };

  /* ===== Premium upgrade modal (shared: charts indicators, AI, heatmap all call window.mpPremium) ===== */
  (function () {
    var FEATS = [
      ['8 exclusive indicators', 'Market Brain, Cascade Radar, Liquidation Magnet, Market Memory & more — signals built on our data that no other chart has.'],
      ['Live liquidation heatmap', 'The full interactive map of where leveraged positions get wiped — desktop & mobile, unlimited.'],
      ['Ask AI on your charts', 'A built-in analyst that reads any chart and answers your questions in plain words — 50 questions a day.'],
      ['Balance Mode', 'Give yourself a portfolio balance and trade it like a real account. Your balance, equity and stats live right in My Trades.'],
      ['Premium leaderboards & competitions', 'Compete only against other Premium traders on account growth — with real prizes.']
    ];
    function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
    var ov = null;
    function close() { if (ov) { ov.remove(); ov = null; } }
    function checkoutPlan(plan, btn, note) {
      if (!(window.mpAuth && window.mpAuth.me && window.mpAuth.me())) { close(); open(); return; }
      var label = btn && btn.textContent;
      if (btn) { btn.disabled = true; btn.textContent = 'Starting checkout...'; }
      fetch('/api/premium/checkout' + (plan === 'founder' ? '?plan=founder' : ''), { method: 'POST' }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.invoice_url) { location.href = j.invoice_url; return; }
        if (btn) { btn.disabled = false; btn.textContent = label; }
        if (note) note.textContent = (j && j.error === 'already_premium') ? 'You are already Premium. Thank you.' : (j && j.error === 'unconfigured') ? 'Crypto checkout is being switched on — please check back very soon.' : 'Could not start checkout. Please try again.';
      }).catch(function () { if (btn) { btn.disabled = false; btn.textContent = label; } if (note) note.textContent = 'Network error. Please try again.'; });
    }
    function show(reason) {
      close();
      if (!document.getElementById('mpPremCss')) { var st = document.createElement('style'); st.id = 'mpPremCss'; st.textContent =
        '.mpprem-ov{position:fixed;inset:0;z-index:100000;background:rgba(5,7,10,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px}' +
        '.mpprem{width:min(440px,94vw);max-height:92vh;overflow:auto;background:#0b0e13;border:1px solid #c2f64a55;border-radius:18px;padding:24px 22px;color:#dbe4f5;font-family:"Familjen Grotesk",system-ui,sans-serif;box-shadow:0 24px 70px rgba(0,0,0,.6);position:relative}' +
        '.mpprem-x{position:absolute;top:12px;right:14px;background:none;border:0;color:#5c6b84;font-size:20px;cursor:pointer}.mpprem-x:hover{color:#fff}' +
        '.mpprem-tag{display:inline-block;font:700 10px "Space Mono",monospace;letter-spacing:.16em;color:#0a0b0d;background:#c2f64a;border-radius:20px;padding:3px 11px;margin-bottom:12px}' +
        '.mpprem h3{margin:0 0 4px;font-size:22px;color:#fff;font-weight:800}.mpprem-sub{color:#8fa3c4;font-size:13px;margin-bottom:16px}' +
        '.mpprem-f{display:flex;gap:11px;padding:10px 0;border-top:1px solid #161c26}.mpprem-f:first-of-type{border-top:0}' +
        '.mpprem-f .ck{flex:none;width:20px;height:20px;border-radius:50%;background:rgba(194,246,74,.14);color:#c2f64a;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;margin-top:1px}' +
        '.mpprem-f b{color:#fff;font-size:13.5px;display:block}.mpprem-f span{color:#8fa3c4;font-size:12px;line-height:1.5}' +
        '.mpprem-price{margin:16px 0 4px;font-size:15px;color:#fff}.mpprem-price b{font-size:26px;color:#c2f64a}' +
        '.mpprem-buy{display:block;width:100%;margin-top:12px;background:#c2f64a;color:#0a0b0d;border:0;border-radius:12px;padding:14px;font-size:15px;font-weight:800;cursor:pointer}.mpprem-buy:hover{filter:brightness(1.06)}.mpprem-buy:disabled{opacity:.6;cursor:default}' +
        '.mpprem-note{text-align:center;font-size:11.5px;color:#5c6b84;margin-top:10px;min-height:14px}';
        document.head.appendChild(st); }
      ov = el('div', 'mpprem-ov');
      var card = el('div', 'mpprem');
      var h = '<button class="mpprem-x" type="button" aria-label="Close">×</button>' +
        '<span class="mpprem-tag">MARGINPAD PREMIUM</span>' +
        '<h3>' + (reason || 'Unlock the full toolkit') + '</h3>' +
        '<div class="mpprem-sub">Everything the pros use to read the market — one membership.</div>';
      FEATS.forEach(function (f) { h += '<div class="mpprem-f"><span class="ck">✓</span><div><b>' + f[0] + '</b><span>' + f[1] + '</span></div></div>'; });
      h += '<div class="mpprem-price"><b>$3.99</b> / month</div>' +
        '<button class="mpprem-buy" type="button">Pay with crypto — $3.99 / month</button>' +
        '<button class="mpprem-founder" type="button" style="display:block;width:100%;margin-top:8px;background:none;border:1px solid #2a3550;color:#c2f64a;border-radius:12px;padding:11px;font-size:13px;font-weight:700;cursor:pointer">Or go Founder — lifetime access, $35 once</button>' +
        '<div style="text-align:center;font:700 11px \'Space Mono\',monospace;color:#ffd75a;margin-top:9px">The first 5 members lock in lifetime Premium.</div>' +
        '<div class="mpprem-note">Pay in BTC, USDT or any major coin via NOWPayments. Cancel anytime — it simply won’t renew.</div>';
      card.innerHTML = h;
      ov.appendChild(card); document.body.appendChild(ov);
      card.querySelector('.mpprem-x').addEventListener('click', close);
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
      var note = card.querySelector('.mpprem-note');
      card.querySelector('.mpprem-buy').addEventListener('click', function () { checkoutPlan('monthly', this, note); });
      card.querySelector('.mpprem-founder').addEventListener('click', function () { checkoutPlan('founder', this, note); });
    }
    window.mpPremium = { show: function (reason) { try { location.href = '/premium'; } catch (e) {} }, showModal: show, close: close, checkout: function (plan) { checkoutPlan(plan, null, null); } };
  })();

  /* ===== PRO cosmetic badge — gold "PRO" next to every premium username ([data-lbu]) across chat, leaderboards, profiles ===== */
  (function () {
    var PRO = null;
    try { var _pc = JSON.parse(localStorage.getItem('mp_proset') || 'null'); if (_pc && _pc.n && _pc.n.length) { PRO = {}; _pc.n.forEach(function (n) { PRO[String(n).toLowerCase()] = 1; }); } } catch (e) {} // warm-cache the PRO set so mpIsPro() is ready SYNCHRONOUSLY on first paint → renderers gold names same-frame (no flash); load() refreshes it below
    function goldName(nm) { if (nm && nm.nodeType === 1 && !nm.hasAttribute('data-lvln') && !nm.classList.contains('mplvb') && !nm.classList.contains('mp-progold')) nm.classList.add('mp-progold'); }
    function goldSlot(sl) { // the name sits right before a [data-lpro] slot — as an element (tm-nm) OR a bare text node (bento leaderboard rows)
      var prev = sl.previousSibling;
      while (prev && prev.nodeType === 3 && !(prev.nodeValue || '').trim()) prev = prev.previousSibling; // skip whitespace
      if (!prev) return;
      if (prev.nodeType === 3) { var span = document.createElement('span'); span.className = 'mp-progold'; prev.parentNode.insertBefore(span, prev); span.appendChild(prev); return; } // wrap the bare text-node name
      goldName(prev);
    }
    function scan() { if (!PRO || document.hidden) return;
      // PRO members get a glossy GOLD name (no chip — the old badge got lost / didn't fit on mobile). A [data-lpro="name"] slot marks the name right before it (LEVEL / NAME).
      var slots = document.querySelectorAll('[data-lpro]:not([data-prodone])');
      for (var i = 0; i < slots.length; i++) { var sl = slots[i], su = (sl.getAttribute('data-lpro') || '').toLowerCase(); sl.setAttribute('data-prodone', '1'); if (su && PRO[su]) goldSlot(sl); }
      // fallback: a [data-lbu] name element without a slot (chat) — gold the name itself, unless its row carries a slot
      var els = document.querySelectorAll('[data-lbu]:not([data-pro])');
      for (var j = 0; j < els.length; j++) { var el = els[j], u = (el.getAttribute('data-lbu') || '').toLowerCase(); el.setAttribute('data-pro', '1'); if (u && PRO[u]) { var pn = el.parentNode; if (pn && (pn.querySelector('[data-lpro]') || el.querySelector('[data-lpro]'))) continue; goldName(el); } } }
    function load() { if (document.hidden && PRO) return; fetch('/api/premium/badges', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.names) { PRO = {}; j.names.forEach(function (n) { PRO[String(n).toLowerCase()] = 1; }); try { localStorage.setItem('mp_proset', JSON.stringify({ t: Date.now(), n: j.names })); } catch (e) {} scan(); } }).catch(function () {}); }
    window.mpIsPro = function (n) { return !!(PRO && PRO[String(n || '').toLowerCase()]); };
    window.mpProScan = scan;
    try { load(); setInterval(scan, 1600); setInterval(load, 300000); document.addEventListener('visibilitychange', function () { if (!document.hidden) scan(); }); } catch (e) {} // hidden tabs skip the scan/fetch; re-decorate any nodes added while hidden on return
  })();

  /* ===== Balance Mode (Premium): trade a portfolio balance; the strip renders in My Trades (home.js + mp-trade.js) ===== */
  /* Season stats reset — guard mirror of home.js/mp-trade.js (load order must not matter). 0 before Mon 2026-08-17 00:00 UTC. */
  window.mpSsnStart = window.mpSsnStart || function () { var A = Date.UTC(2026, 6, 20), n = Date.now(); if (n < Date.UTC(2026, 7, 17)) return 0; return A + Math.floor((n - A) / 1209600000) * 1209600000; };
  window.mpBal = {
    _sid: function () { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }, // unique Balance Mode session id
    cfg: function () { try { var c = JSON.parse(localStorage.getItem('mp_balmode') || 'null'); if (c && c.on) { if (!c.sid) { c.sid = this._sid(); try { localStorage.setItem('mp_balmode', JSON.stringify(c)); } catch (e) {} } return { on: true, start: (+c.start > 0 ? +c.start : 10000), since: +c.since || 0, sid: c.sid }; } } catch (e) {} return { on: false, start: 10000, since: 0, sid: '' }; },
    _emit: function () { try { window.dispatchEvent(new Event('mp-balmode')); } catch (e) {} try { if (window.mpJournalRender) window.mpJournalRender(); } catch (e) {} },
    setCfg: function (on, reset) { var prev; try { prev = JSON.parse(localStorage.getItem('mp_balmode') || 'null') || {}; } catch (e) { prev = {}; } var fresh = reset || !prev.sid; var since = fresh ? Date.now() : (+prev.since || Date.now()); var sid = fresh ? this._sid() : prev.sid; var start = fresh ? 10000 : (+prev.start > 0 ? +prev.start : 10000); var today = new Date().toISOString().slice(0, 10); var topup = fresh ? today : (prev.topup || today); var ssn9 = fresh ? (window.mpSsnStart ? window.mpSsnStart() : 0) : (+prev.ssn || 0); try { localStorage.setItem('mp_balmode', JSON.stringify({ on: !!on, start: start, since: since, sid: sid, topup: topup, ssn: ssn9 })); } catch (e) {} if (on) { try { this._dailyTopup(); } catch (e) {} } this._emit(); }, // no user-set amount anymore — VIP gets a fixed 10k base; _dailyTopup + grant() top it up
    _dailyTopup: function () { var c; try { c = JSON.parse(localStorage.getItem('mp_balmode') || 'null'); } catch (e) { return; } if (!c || !c.on) return; var today = new Date().toISOString().slice(0, 10); var ssn = window.mpSsnStart ? window.mpSsnStart() : 0; if (ssn && (+c.ssn || 0) !== ssn) { c.start = 10000; c.sid = this._sid(); c.since = Date.now(); c.topup = today; c.ssn = ssn; try { localStorage.setItem('mp_balmode', JSON.stringify(c)); } catch (e) {} this._emit(); return c.start; } // season rollover (owner 2026-08-16: "sve se resetuje"): fresh $10,000 portfolio; open positions stay open — the old session's tags simply stop counting toward the new balance
      if (c.topup === today) return; c.start = Math.min(250000, (+c.start || 10000) + 10000); c.topup = today; try { localStorage.setItem('mp_balmode', JSON.stringify(c)); } catch (e) {} this._emit(); return c.start; }, // +$10,000 once per NEW active day (not per calendar gap — away 30 days ≠ +300k), capped at 250k
    grant: function (n) { n = Math.max(0, Math.round(+n || 0)); if (!n) return; var c; try { c = JSON.parse(localStorage.getItem('mp_balmode') || 'null'); } catch (e) { return; } if (!c) return; c.start = Math.min(250000, (+c.start || 10000) + n); try { localStorage.setItem('mp_balmode', JSON.stringify(c)); } catch (e) {} this._emit(); }, // top up from daily missions / other systems
    tag: function (e) { try { var c = this.cfg(); if (c.on && c.sid && e && e.id) { if (!e.bal) e.bal = c.sid; var m = {}; try { m = JSON.parse(localStorage.getItem('mp_bal_tags') || '{}') || {}; } catch (x) {} if (m[e.id] !== c.sid) { m[e.id] = c.sid; var ks = Object.keys(m); if (ks.length > 500) ks.slice(0, ks.length - 500).forEach(function (k) { delete m[k]; }); try { localStorage.setItem('mp_bal_tags', JSON.stringify(m)); } catch (x) {} } } } catch (_) {} return e; } // tag the trade for the current Balance Mode session — writes BOTH e.bal AND an id->sid map (mp_bal_tags) so the tag survives the server journal sync for signed-in/premium users
  };
  try { window.mpBal._dailyTopup(); } catch (e) {} // on load: give a returning VIP their +$10,000 for the new day

  // shared modal-overlay CSS (the premium modal used to inject it, but mpPremium.show now redirects to /premium, so the Daily Brief needs it independently)
  function ensurePremCss() {
    if (document.getElementById('mpPremCss')) return;
    var st = document.createElement('style'); st.id = 'mpPremCss'; st.textContent =
      '.mpprem-ov{position:fixed;inset:0;z-index:100000;background:rgba(5,7,10,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px}' +
      '.mpprem{width:min(440px,94vw);max-height:92vh;overflow:auto;background:#0b0e13;border:1px solid #c2f64a55;border-radius:18px;padding:24px 22px;color:#dbe4f5;font-family:"Familjen Grotesk",system-ui,sans-serif;box-shadow:0 24px 70px rgba(0,0,0,.6);position:relative}' +
      '.mpprem-x{position:absolute;top:12px;right:14px;background:none;border:0;color:#5c6b84;font-size:20px;cursor:pointer}.mpprem-x:hover{color:#fff}' +
      '.mpprem-tag{display:inline-block;font:700 10px "Space Mono",monospace;letter-spacing:.16em;color:#0a0b0d;background:#c2f64a;border-radius:20px;padding:3px 11px;margin-bottom:12px}' +
      '.mpprem h3{margin:0 0 4px;font-size:22px;color:#fff;font-weight:800}.mpprem-sub{color:#8fa3c4;font-size:13px;margin-bottom:16px}';
    document.head.appendChild(st);
  }
  /* ===== Daily Brief (Premium): majors trend + RSI + next macro events, in a modal ===== */
  window.mpBrief = { show: function () {
    ensurePremCss();
    var ov = document.createElement('div'); ov.className = 'mpprem-ov';
    ov.innerHTML = '<div class="mpprem" style="max-width:460px"><button class="mpprem-x" type="button" aria-label="Close">×</button><span class="mpprem-tag">DAILY BRIEF</span><h3>Where the opportunities are</h3><div class="mpbrief-body" style="margin-top:14px;color:#8fa3c4;font-size:13px;max-height:64vh;overflow-y:auto">Loading…</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.mpprem-x').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    var body = ov.querySelector('.mpbrief-body');
    fetch('/api/premium/brief', { cache: 'no-store' }).then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); }).then(function (o) {
      if (o.s === 401) { ov.remove(); open(); return; }
      if (o.s === 402) { ov.remove(); if (window.mpPremium) window.mpPremium.show('Unlock the Daily Brief'); return; }
      var j = o.j || {};
      var biasCol = j.bias === 'bullish' ? '#2ebd85' : j.bias === 'bearish' ? '#ff6258' : '#ffd75a';
      var biasTxt = j.bias === 'bullish' ? 'Market leans BULLISH' : j.bias === 'bearish' ? 'Market leans BEARISH' : 'Market is MIXED today';
      var h = '<div style="display:flex;align-items:center;gap:8px"><span style="width:9px;height:9px;border-radius:50%;background:' + biasCol + ';box-shadow:0 0 9px ' + biasCol + '"></span><b style="color:' + biasCol + ';font-size:14.5px">' + biasTxt + '</b></div>';
      h += '<div style="font-size:11.5px;color:#8fa3c4;margin:3px 0 15px">' + esc(j.biasNote || '') + '</div>';
      h += '<div style="font:700 10px \'Space Mono\',monospace;letter-spacing:.13em;color:#c2f64a;margin-bottom:2px">WHERE THE SETUPS ARE</div>';
      var opps = j.opps || [];
      if (!opps.length) {
        h += '<div style="font-size:13px;color:#9aa3ad;padding:9px 0 2px;line-height:1.5">No clean setups right now — the majors are choppy. Best trade is patience.</div>';
      } else {
        opps.forEach(function (op) {
          var lng = op.dir === 'long', dcol = lng ? '#2ebd85' : '#ff6258';
          var pr = op.price >= 1 ? (+op.price).toLocaleString('en-US', { maximumFractionDigits: 2 }) : op.price;
          var rcol = op.rsi >= 70 ? '#ff6258' : op.rsi <= 30 ? '#2ebd85' : '#8fa3c4';
          h += '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid #161c26">'
            + '<div style="min-width:60px"><b style="color:#fff;font-size:14px">' + op.sym + '</b><div style="font:10px \'Space Mono\',monospace;color:#8fa3c4">$' + pr + '</div></div>'
            + '<div style="flex:1;min-width:0"><span style="display:inline-block;font:700 9.5px \'Space Mono\',monospace;letter-spacing:.04em;color:' + dcol + ';background:' + (lng ? 'rgba(46,189,133,.12)' : 'rgba(255,98,88,.12)') + ';border:1px solid ' + dcol + '55;border-radius:6px;padding:2px 8px">' + op.kind + ' ' + (lng ? 'LONG' : 'SHORT') + '</span>'
            + '<div style="font-size:11.5px;color:#9aa3ad;margin-top:4px;line-height:1.35">' + esc(op.note) + '</div></div>'
            + (op.rsi == null ? '' : '<div style="text-align:right;min-width:38px;font:700 10px \'Space Mono\',monospace;color:' + rcol + ';line-height:1.3">RSI<br>' + op.rsi + '</div>')
            + '</div>';
        });
      }
      if (j.events && j.events.length) { h += '<div style="margin-top:16px;font:700 10px \'Space Mono\',monospace;letter-spacing:.13em;color:#c2f64a">NEXT HIGH-IMPACT EVENT</div>'; j.events.forEach(function (e) { var d = new Date(e.ts); h += '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid #161c26;font-size:12px"><span style="color:#dbe4f5">' + esc(e.title) + '</span><span style="color:#8fa3c4;white-space:nowrap">' + d.toISOString().slice(5, 16).replace('T', ' ') + ' UTC</span></div>'; }); }
      h += '<div style="margin-top:14px;font-size:10.5px;color:#5c6b84;line-height:1.5">Setups from Supertrend(10,3) trend alignment + RSI(14) extremes on 1H/4H. Educational only — not financial advice.</div>';
      body.innerHTML = h;
    }).catch(function () { body.textContent = 'Could not load the brief — please try again.'; });
  } };

  /* ===== XP toasts + level-up celebration (2026-07-15) ===== */
  (function () {
    var SRCN = { heatmap: 'Liquidation map read', trade_hh: 'XP Happy Hour!', trade_promo: 'XP Promo!', trade_win: 'Winner, banked', trade: 'Trade closed', checkin: 'Showed up today', streak: 'Streak pays', mission: 'Mission cleared', faucet: 'Faucet claim', promo: 'Promo post approved', exsign: 'Exchange sign-up', lbprize: 'Podium money', username: 'Name on the board', academy: 'Brain gains', charts: 'Chart time', admin: 'Bonus', backfill: 'Loyalty bonus', duel: 'Duel won', duel_pot: 'Duel pot won', duel_stake: 'Duel stake locked' };
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
      + '.mpxp-x{margin-top:18px;background:var(--lc);color:#0a0b0d;border:none;border-radius:11px;padding:11px 26px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}.mpxp-see,.mpxp-x2{display:block;width:100%;box-sizing:border-box;text-align:center;text-decoration:none}.mpxp-see{margin-top:16px}.mpxp-x2{background:none;border:1px solid rgba(255,255,255,.22);color:#c7cdd4;margin-top:9px;font-weight:700}'
      + '.mpxp-cf{position:absolute;top:0;width:9px;height:14px;border-radius:2px;opacity:.9;animation:mpxpFall linear forwards}'
      + '.mpxp-perks{list-style:none;margin:14px 0 2px;padding:0;text-align:left;display:grid;gap:7px}'
      + '.mpxp-perks li{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:#dfe4ec;line-height:1.35}.mpxp-perks li svg{flex:none;margin-top:1px}'
      + '@keyframes mpxpFall{0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:.2}}'
      + '@media(max-width:560px){.mpxp-card{padding:28px 26px;max-width:88vw}.mpxp-nm{font-size:28px}}';
    var st = document.createElement('style'); st.textContent = xpCss; document.head.appendChild(st);
    var seenKey = null, lastXp = null, lastIdx = null, watching = false;
    function key(uid) { return 'mp_xp_seen_' + uid; }
    function toast(amt, src, col) {
      var host = document.getElementById('mpxpT'); if (!host) { host = document.createElement('div'); host.id = 'mpxpT'; document.body.appendChild(host); }
      var el = document.createElement('div'); el.className = 'mpxp'; el.style.setProperty('--xc', col || '#c2f64a');
      el.innerHTML = '<b>' + (amt < 0 ? '−' : '+') + Math.abs(amt) + '</b><span>XP<br>' + (SRCN[src] || src) + '</span>'; // sign-aware: a negative entry toasts as a red minus so a drop is EXPLAINED, not mysterious
      host.appendChild(el); requestAnimationFrame(function () { el.classList.add('on'); });
      setTimeout(function () { el.classList.remove('on'); setTimeout(function () { el.remove(); }, 450); }, 3600);
    }
    function followToast(name) {
      var host = document.getElementById('mpxpT'); if (!host) { host = document.createElement('div'); host.id = 'mpxpT'; document.body.appendChild(host); }
      var el = document.createElement('div'); el.className = 'mpxp'; el.style.setProperty('--xc', '#38bdf8');
      el.innerHTML = '<b style="font-size:17px">★</b><span>New follower<br>' + (name ? '@' + esc(String(name).slice(0, 20)) : 'Someone’s watching your trades') + '</span>';
      host.appendChild(el); requestAnimationFrame(function () { el.classList.add('on'); });
      setTimeout(function () { el.classList.remove('on'); setTimeout(function () { el.remove(); }, 450); }, 4600);
      try { if (navigator.vibrate) navigator.vibrate([15, 40, 15]); } catch (e) {}
    }
    function celebrate(lv) {
      var ov = document.getElementById('mpxpLv'); if (!ov) { ov = document.createElement('div'); ov.id = 'mpxpLv'; document.body.appendChild(ov); }
      var col = lv.col || '#c2f64a';
      var conf = ''; for (var n = 0; n < 60; n++) { var cx = Math.floor(Math.random() * 100), d = (1.4 + Math.random() * 1.6).toFixed(2), dl = (Math.random() * 0.5).toFixed(2), cc = ['#c2f64a', col, '#ffd75a', '#38bdf8', '#ff6a3d'][n % 5]; conf += '<i class="mpxp-cf" style="left:' + cx + '%;background:' + cc + ';animation-duration:' + d + 's;animation-delay:' + dl + 's"></i>'; }
      ov.style.setProperty('--lc', col);
      ov.innerHTML = conf + '<div class="mpxp-card" style="--lc:' + col + '"><div class="mpxp-badge">' + (window.mpLvlSvg ? window.mpLvlSvg(lv.k, col) : '') + '</div><div class="mpxp-up">Level up</div><div class="mpxp-nm">' + esc(lv.name || '') + '</div><div class="mpxp-sub">You climbed to <b>' + esc(lv.name || '') + '</b> — earned, not given.' + (lv.next ? ' Next stop: ' + esc(lv.next) + ' at ' + (lv.nextMin || 0).toLocaleString() + ' XP.' : ' Top of the mountain. The view is P&L-green.') + '</div>'
        + (function(){var UN={bronze:'Rewards + The Vault unlocked',silver:'Silver frame + bigger claims unlocked',gold:'Gold frame + bigger claims unlocked',platinum:'Platinum frame unlocked',diamond:'Diamond frame + withdrawal bonus unlocked',legendary:'Legendary frame + max perks unlocked'}[lv.k];return UN?('<a class="mpxp-unlock" href="/vault/" style="display:block;margin:10px auto 0;max-width:280px;padding:9px 14px;border:1px solid rgba(194,246,74,.4);border-radius:11px;background:rgba(194,246,74,.08);color:#c2f64a;font-size:12.5px;font-weight:700;text-decoration:none">'+UN+' — open The Vault →</a>'):'';})()
        + '<button class="mpxp-x" type="button">Back to work</button></div>';
      requestAnimationFrame(function () { ov.classList.add('on'); });
      var close9 = function () { ov.classList.remove('on'); };
      ov.querySelector('.mpxp-x').addEventListener('click', close9);
      ov.addEventListener('click', function (e) { if (e.target === ov) close9(); });
      try { if (navigator.vibrate) navigator.vibrate([20, 40, 20]); } catch (e) {}
    }
    function premiumCelebrate() { // center-screen gold celebration when a member upgrades to Premium (reuses the level-up stage)
      window.__mpPremCelebrated = true;
      var ov = document.getElementById('mpxpLv'); if (!ov) { ov = document.createElement('div'); ov.id = 'mpxpLv'; document.body.appendChild(ov); }
      var col = '#ffd75a';
      var conf = ''; for (var n = 0; n < 84; n++) { var cx = Math.floor(Math.random() * 100), d = (1.4 + Math.random() * 1.7).toFixed(2), dl = (Math.random() * 0.5).toFixed(2), cc = ['#ffd75a', '#fff6c8', '#e0a52a', '#c2f64a', '#ffe98a'][n % 5]; conf += '<i class="mpxp-cf" style="left:' + cx + '%;background:' + cc + ';animation-duration:' + d + 's;animation-delay:' + dl + 's"></i>'; }
      var crown = '<svg viewBox="0 0 24 24" width="96" height="96" fill="none"><defs><linearGradient id="mpPgc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset="0.5" stop-color="#ffd75a"/><stop offset="1" stop-color="#e0a52a"/></linearGradient></defs><path d="M2.6 8.2l4.4 3.3L12 4l5 7.5 4.4-3.3-1.9 11.3H4.5L2.6 8.2z" fill="url(#mpPgc)" stroke="#8a5a10" stroke-width="0.5" stroke-linejoin="round"/><rect x="4.5" y="18.4" width="15" height="2.3" rx="0.7" fill="url(#mpPgc)" stroke="#8a5a10" stroke-width="0.4"/><circle cx="2.6" cy="8.2" r="1.5" fill="#ffe98a"/><circle cx="21.4" cy="8.2" r="1.5" fill="#ffe98a"/><circle cx="12" cy="4" r="1.6" fill="#ffe98a"/></svg>';
      ov.style.setProperty('--lc', col);
      var ck = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#ffd75a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
      var perks = ['8 exclusive AI indicators', 'Live liquidation heatmap', 'Ask AI on your charts — 50/day', 'Balance Mode — real portfolio trading', 'Premium duels — all 5 formats', 'Premium chat lounge (VIPs only)', 'Daily market brief', 'Gold name, card frames & share cards', '+5% XP on everything'];
      var perksHtml = '<ul class="mpxp-perks">' + perks.map(function (p) { return '<li>' + ck + '<span>' + p + '</span></li>'; }).join('') + '</ul>';
      ov.innerHTML = conf + '<div class="mpxp-card" style="--lc:' + col + '"><div class="mpxp-badge">' + crown + '</div><div class="mpxp-up">Premium unlocked</div><div class="mpxp-nm mp-progold">MarginPad Premium</div><div class="mpxp-sub">You are now a <b>Premium member</b>. Here is everything you just unlocked:</div>' + perksHtml + '<a class="mpxp-x mpxp-see" href="/premium" target="_blank" rel="noopener">See everything you got →</a><button class="mpxp-x mpxp-x2" type="button">Start trading</button></div>';
      requestAnimationFrame(function () { ov.classList.add('on'); });
      var close9 = function () { ov.classList.remove('on'); };
      var xb = ov.querySelector('button.mpxp-x'); if (xb) xb.addEventListener('click', close9);
      var see = ov.querySelector('.mpxp-see'); if (see) see.addEventListener('click', function () { try { if (window.__mpTrack) window.__mpTrack('premview', 'celebration'); } catch (e) {} setTimeout(close9, 400); });
      ov.addEventListener('click', function (e) { if (e.target === ov) close9(); });
      setTimeout(close9, 18000);
      try { if (navigator.vibrate) navigator.vibrate([20, 40, 20, 40, 70]); } catch (e) {}
    }
    window.mpPremiumCelebrate = premiumCelebrate;
    function giftCelebrate(fromUn, body9) { // center-stage moment when someone gifts you a Vault item — a plain bell row undersold the most personal event on the site
      var ov = document.getElementById('mpxpLv'); if (!ov) { ov = document.createElement('div'); ov.id = 'mpxpLv'; document.body.appendChild(ov); }
      var col = '#c792ff';
      var conf = ''; for (var n = 0; n < 70; n++) { var cx = Math.floor(Math.random() * 100), d = (1.4 + Math.random() * 1.6).toFixed(2), dl = (Math.random() * 0.5).toFixed(2), cc = ['#c792ff', '#c2f64a', '#ffd75a', '#38bdf8', '#e6d1ff'][n % 5]; conf += '<i class="mpxp-cf" style="left:' + cx + '%;background:' + cc + ';animation-duration:' + d + 's;animation-delay:' + dl + 's"></i>'; }
      var box = '<svg viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="#c792ff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M4 10h16M12 10v10M8 10c-2 0-3-1.2-3-2.6C5 6 6.3 5 7.6 5 9.6 5 12 7.5 12 10c0-2.5 2.4-5 4.4-5C17.7 5 19 6 19 7.4 19 8.8 18 10 16 10"/></svg>';
      ov.style.setProperty('--lc', col);
      ov.innerHTML = conf + '<div class="mpxp-card" style="--lc:' + col + '"><div class="mpxp-badge">' + box + '</div><div class="mpxp-up">Gift received</div><div class="mpxp-nm" style="font-size:27px">' + (fromUn ? '@' + esc(String(fromUn).slice(0, 20)) + ' sent you a gift' : 'You got a gift') + '</div><div class="mpxp-sub">' + esc(body9 || '') + '</div><a class="mpxp-x mpxp-see" href="/vault/">Open The Vault — equip it →</a><button class="mpxp-x mpxp-x2" type="button">Later</button></div>';
      requestAnimationFrame(function () { ov.classList.add('on'); });
      var close9 = function () { ov.classList.remove('on'); };
      var xb = ov.querySelector('.mpxp-x2'); if (xb) xb.addEventListener('click', close9);
      ov.addEventListener('click', function (e) { if (e.target === ov) close9(); });
      setTimeout(close9, 15000);
      try { if (navigator.vibrate) navigator.vibrate([15, 40, 15, 40, 60]); } catch (e) {}
    }
    function check() {
      if (!ME) return;
      fetch('/api/auth/xp').then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !d.signedIn || !d.level) return;
        // DM unread + duel pending badges — run on EVERY poll incl. the first (before the seed early-return below)
        if (typeof d.dmUnread === 'number' && window.mpDmBadge) { try { window.mpDmBadge(d.dmUnread); } catch (e) {} }
        if (typeof d.duelPending === 'number' && window.mpDuelBadge) { try { window.mpDuelBadge(d.duelPending); } catch (e) {} }
        if (typeof d.premium === 'boolean') window._mpPrem = d.premium; if (typeof d.xp === 'number') window._mpXpBal = d.xp; // cached for the duel composer (premium gating + stake affordability)
        if (typeof d.notifUnread === 'number' && window.mpNotifBadge) { try { window.mpNotifBadge(d.notifUnread); } catch (e) {} }
        // GIFT CELEBRATION: an unseen 'gift' notification gets the center stage once (ts-dedup per device in localStorage).
        // The notif list is fetched only when the unread count first appears or GROWS — never on every poll; the plain
        // GET does not mark anything seen, so the bell badge behavior is untouched.
        var nu9 = +d.notifUnread || 0;
        if (nu9 > 0 && (window.__mpGiftPrev == null || nu9 > window.__mpGiftPrev) && !window.__mpGiftBusy) { try {
          window.__mpGiftBusy = true;
          fetch('/api/auth/notifs').then(function (r) { return r.json(); }).then(function (nd) {
            window.__mpGiftBusy = false;
            var gl = ((nd && nd.notifs) || []).filter(function (n) { return n.kind === 'gift' && !n.seen && (Date.now() - n.ts) < 604800000; });
            if (!gl.length) return;
            var gk = 'mp_gift_cel_' + ((ME && ME.id) || ''); var seen9 = [];
            try { seen9 = JSON.parse(localStorage.getItem(gk) || '[]'); } catch (e) {}
            var fresh9 = gl.filter(function (n) { return seen9.indexOf(n.ts) < 0; });
            if (!fresh9.length) return;
            var g9 = fresh9[0];
            try { localStorage.setItem(gk, JSON.stringify(seen9.concat(fresh9.map(function (n) { return n.ts; })).slice(-20))); } catch (e) {}
            var m9 = /^@(\S+) /.exec(String(g9.body || ''));
            setTimeout(function () { try { giftCelebrate(m9 ? m9[1] : '', g9.body); } catch (e) {} }, 600);
          }).catch(function () { window.__mpGiftBusy = false; });
        } catch (e) { window.__mpGiftBusy = false; } }
        window.__mpGiftPrev = nu9;
        // Premium upgrade celebration — SERVER-driven (d.premiumNew = premium && !prem_seen). Fires once regardless of
        // WHEN the user became premium (owner grant / IPN that landed while offline → first login already premium, which
        // the old localStorage "non-premium -> premium transition" check silently missed). The server flag (prem_seen)
        // is set only by the ack BELOW, AFTER the animation is shown — so a tab closed mid-animation just replays it next
        // time (never a silent loss of the celebration).
        if (d.premiumNew && !window.__mpPremCelebrated) { try {
          window.__mpPremCelebrated = true;
          setTimeout(function () { try { premiumCelebrate(); } catch (e) {} try { reflect(); } catch (e) {} }, 500);
          setTimeout(function () { try { fetch('/api/auth/xp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ack: 1 }) }); } catch (e) {} }, 3500); // ack AFTER the ~3s animation is shown
        } catch (e) {} }
        var uid = ME.id; var stored = null;
        try { stored = JSON.parse(localStorage.getItem(key(uid)) || 'null'); } catch (e) {}
        if (!stored) { // first observation for this device: seed silently (no toast flood)
          try { localStorage.setItem(key(uid), JSON.stringify({ xp: d.xp, idx: d.level.idx, ts: (d.log[0] || {}).ts || 0 })); } catch (e) {}
          lastXp = d.xp; lastIdx = d.level.idx; return;
        }
        // toast every log entry newer than the last seen ts (positives AND negatives — a silent -500 duel stake looked like "my XP is shrinking"), oldest-first
        var fresh = (d.log || []).filter(function (e) { return e.ts > (stored.ts || 0) && (+e.amt) !== 0; }).sort(function (a, b) { return a.ts - b.ts; });
        fresh.slice(-4).forEach(function (e, ix) { setTimeout(function () { toast(+e.amt, e.src, (+e.amt) < 0 ? '#ff8a80' : d.level.col); }, ix * 550); });
        if (fresh.some(function (e) { return e.src === 'trade_win'; })) { try { var dn9 = 'mp_dnudge_' + new Date().toISOString().slice(0, 10); if (!localStorage.getItem(dn9)) { localStorage.setItem(dn9, '1'); setTimeout(duelNudge, 2800); } } catch (e) {} }
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

  var _liChk; try { _liChk = localStorage.getItem('mp_li_chk') === '1'; } catch (e) { _liChk = false; }
  if (/(?:^|;\s*)mp_li=1(?:;|$)/.test(document.cookie) || !_liChk) { // COOKIE GATE: probe /api/auth/me only if the non-HttpOnly session-marker cookie mp_li is present, OR this browser hasn't done the one-time migration check yet (catches sessions that predate the marker → no existing login gets dropped). A returning logged-out visitor (no marker, already checked once) skips the DO round-trip entirely — that was ~most of the auth invocations. mp_sess is HttpOnly so JS can't read it directly; mp_li mirrors it (set by /verify + /me, cleared by /logout).
    fetch('/api/auth/me').then(function (r) { return r.json(); }).then(function (d) { try { localStorage.setItem('mp_li_chk', '1'); } catch (e) {} ME = d.user || null; try { window.mpTktSkin = (ME && ME.tktskin) || ''; } catch (e) {} BANNED = !!d.banned; reflect(); if (ME) { dwSince = Date.now(); syncTrades();
      if (/[?&]premium=ok(&|$)/.test(location.search)) { // just returned from a successful checkout — celebrate now (the 60s poll would otherwise lag)
        setTimeout(function () { if (window.mpPremiumCelebrate) window.mpPremiumCelebrate(); }, 1000);
        try { var u = new URL(location.href); u.searchParams.delete('premium'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) {}
      }
    } }).catch(function () {});
  } else { ME = null; reflect(); }
})();
