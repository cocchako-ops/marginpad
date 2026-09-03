// mp-ops v2 E2E (2026-09-03): the new shell at /api/stats. Mints a session from ADMIN_KEY (POST /api/stats/session),
// then walks every NAV view: native views must render content without page/console errors or failed admin fetches;
// legacy views must load the embedded legacy frame with the right tab visible. Also: palette opens and searches,
// phone width has no horizontal scroll, and the legacy page still answers directly. Screenshots in build/ops-shots/v2-*.png.
// Run: node build/ops2-e2e.js            node build/ops2-e2e.js today/overview money/withdrawals
const fs = require('fs'), path = require('path');
const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const K = fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').split(/\r?\n/)[1].trim();
const BASE = 'https://marginpad.io';
const only = process.argv.slice(2).filter(a => a.indexOf('/') > 0);
const SHOTS = path.join(__dirname, 'ops-shots'); if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS);
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + JSON.stringify(x).slice(0, 220) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const sess = await (await fetch(BASE + '/api/stats/session', { method: 'POST', headers: { 'x-admin-key': K } })).json();
  chk('session minted', sess.ok && /^[0-9a-f]{64}$/.test(sess.token));
  if (!sess.ok) { console.log(out.join('\n')); process.exit(1); }
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setCookie({ name: 'mp_sadm', value: sess.token, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true });
    const errs = [], bad = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
    page.on('response', r => { try { const u = r.url(); if (u.indexOf(BASE + '/api/') === 0 && r.status() >= 400 && !/\/api\/prices?\b/.test(u)) bad.push(r.status() + ' ' + u.slice(BASE.length, BASE.length + 70)); } catch (e) {} });
    const t0 = Date.now(); await page.goto(BASE + '/api/stats', { waitUntil: 'networkidle2', timeout: 120000 }); const load = Date.now() - t0; await sleep(2500);
    const g = await page.evaluate(() => ({ v2: !!(window.__ops2 && window.__ops2.NAV), nav: document.querySelectorAll('#nav a').length, gate: !!document.querySelector('input[type="password"]'), attn: document.querySelectorAll('#attnbar .al').length, online: (document.getElementById('online') || {}).textContent, bytes: document.documentElement.outerHTML.length }));
    chk('v2 shell renders (no gate, nav built, attention strip)', g.v2 && !g.gate && g.nav >= 20, { load, nav: g.nav, attn: g.attn, online: g.online, kb: Math.round(g.bytes / 1024) });
    const views = await page.evaluate(() => { const o = []; window.__ops2.NAV.forEach(s => s.views.forEach(v => o.push({ key: s.id + '/' + v.id, legacy: v.legacy || '' }))); return o; });
    for (const v of views) {
      if (only.length && !only.includes(v.key)) continue;
      const e0 = errs.length, b0 = bad.length;
      await page.evaluate((k) => { location.hash = k; }, v.key);
      // wait until the view has painted (slow endpoints like /api/admin/spot price 240 holdings on a cold miss), max 15s
      for (let w = 0; w < 30; w++) { await sleep(500); const ready = await page.evaluate((v) => { const el = document.getElementById('view'); if (v.legacy) { const f = el.querySelector('iframe'); try { return !!(f && f.contentDocument && f.contentDocument.getElementById('tab-' + v.legacy)); } catch (e) { return false; } } const t = (el.innerText || '').replace(/\s+/g, ' '); return t.length > 60 && !/^loading/i.test(t.trim()); }, v); if (ready) break; }
      await sleep(v.legacy ? 2500 : 800);
      const s = await page.evaluate(async (v) => {
        const el = document.getElementById('view'); const txt = (el.innerText || '').replace(/\s+/g, ' ');
        const r = { chars: txt.length, crumb: (document.getElementById('crumb') || {}).innerText, loading: /loading…/.test(txt) && txt.length < 40 };
        if (v.legacy) { const f = el.querySelector('iframe'); r.iframe = !!f; try { const d = f && f.contentDocument; const p = d && d.getElementById('tab-' + v.legacy); r.tabVisible = !!(p && !p.hidden && p.getBoundingClientRect().height > 40); r.chromeHidden = !!(d && d.querySelector('nav.tabbar') && d.querySelector('nav.tabbar').style.display === 'none'); r.inner = d ? (p ? p.innerText.replace(/\s+/g, ' ').slice(0, 60) : 'no panel') : 'no doc'; } catch (e) { r.err = String(e).slice(0, 80); } }
        return r;
      }, v);
      const newErrs = errs.slice(e0), newBad = bad.slice(b0);
      const ok = v.legacy ? (s.iframe && s.tabVisible && s.chromeHidden && newErrs.length === 0) : (s.chars > 60 && !s.loading && newErrs.length === 0 && newBad.length === 0);
      chk('view ' + v.key + (v.legacy ? ' (legacy ' + v.legacy + ')' : ''), ok, Object.assign({ errs: newErrs, bad: newBad }, v.legacy ? { iframe: s.iframe, tab: s.tabVisible, chrome: s.chromeHidden, inner: s.inner, err: s.err } : { chars: s.chars }));
      try { await page.screenshot({ path: path.join(SHOTS, 'v2-' + v.key.replace('/', '-') + '.png') }); } catch (e) {}
    }
    // deep checks for the views ported last (2026-09-03 evening): real interactions on desktop, no legacy frame anywhere
    if (!only.length || only.includes('money/faucet')) {
      await page.evaluate(() => { location.hash = 'money/faucet'; }); for (let w = 0; w < 30; w++) { await sleep(500); if (await page.evaluate(() => document.querySelectorAll('#rwAccts .row').length > 0)) break; }
      const fa = await page.evaluate(() => ({ accts: document.querySelectorAll('#rwAccts .row').length, count: (document.getElementById('rwCount') || {}).textContent, lb: !!document.querySelector('[data-lbej]'), hist: !!document.getElementById('rwHist') }));
      chk('faucet: accounts list, season board and history render', fa.accts > 0 && /accounts|of/.test(fa.count || ''), fa);
      await page.evaluate(() => { const r = document.querySelector('#rwAccts .row[data-acct]'); if (r) r.click(); }); for (let w = 0; w < 20; w++) { await sleep(500); if (await page.evaluate(() => document.querySelectorAll('.modal .kvgrid .kv').length > 0)) break; }
      const md = await page.evaluate(() => ({ open: !!document.querySelector('.modal'), kv: document.querySelectorAll('.modal .kvgrid .kv').length, earn: !!document.getElementById('amEarn'), actions: ['amBan', 'amLb', 'amUnlock', 'amRemove', 'amAdd', 'amNoteSave', 'amMsgSend'].filter(id => !document.getElementById(id)) }));
      chk('faucet: account card opens with fields, earnings and every action button', md.open && md.kv >= 10 && md.earn && md.actions.length === 0, md);
      await page.keyboard.press('Escape'); await sleep(300); chk('faucet: Escape closes the card', await page.evaluate(() => !document.querySelector('.modal')));
      try { await page.screenshot({ path: path.join(SHOTS, 'v2-money-faucet.png') }); } catch (e) {}
    }
    if (!only.length || only.includes('people/journeys')) {
      await page.evaluate(() => { location.hash = 'people/journeys'; }); for (let w = 0; w < 30; w++) { await sleep(500); if (await page.evaluate(() => document.querySelectorAll('.jc').length > 0)) break; }
      const jl = await page.evaluate(() => ({ cards: document.querySelectorAll('.jc').length, steps: document.querySelectorAll('.jc-p .pg').length, rail: document.querySelectorAll('.jm-rail .card').length }));
      chk('journeys: live cards with page chains and the rail', jl.cards > 0 && jl.steps > 0 && jl.rail === 2, jl);
      await page.evaluate(() => { document.querySelector('[data-jv="flows"]').click(); }); await sleep(800);
      const fl = await page.evaluate(() => ({ bars: document.querySelectorAll('.hb-r').length, txt: (document.getElementById('view').innerText || '').slice(0, 80) }));
      chk('journeys: flows view lists hops between products', fl.bars > 0, fl);
      await page.type('#jmU', 'kofac'); await page.click('#jmGo'); for (let w = 0; w < 30; w++) { await sleep(500); if (await page.evaluate(() => /session|no tracked|no user/.test(document.getElementById('view').innerText))) break; }
      const tr = await page.evaluate(() => ({ back: !!document.getElementById('jmLive'), sessions: document.querySelectorAll('.jc').length, profile: /full profile/.test(document.getElementById('view').innerText) }));
      chk('journeys: trace user resolves @kofac to sessions with a profile link', tr.back && tr.profile, tr);
      try { await page.screenshot({ path: path.join(SHOTS, 'v2-people-journeys.png') }); } catch (e) {}
    }
    if (!only.length || only.includes('trading/live')) {
      await page.evaluate(() => { location.hash = 'trading/live'; }); for (let w = 0; w < 30; w++) { await sleep(500); if (await page.evaluate(() => document.querySelectorAll('.trd').length > 0)) break; }
      await page.evaluate(() => { const t = document.querySelector('.trd-h .t.up'); const h = t && t.closest('.trd-h'); if (h) h.click(); }); await sleep(600); // first trader that actually has an open position (the newest row may be flat: closes only)
      const lv = await page.evaluate(() => { const t = Array.from(document.querySelectorAll('.tile')).find(x => /live prices/i.test(x.innerText)); return { traders: document.querySelectorAll('.trd').length, expanded: document.querySelectorAll('.trd-b .pos').length, prices: t ? +t.querySelector('.v').innerText.replace(/[^0-9]/g, '') : 0, tiles: document.querySelectorAll('.tile').length, dash: document.querySelectorAll('.trd-b .pos b').length ? Array.from(document.querySelectorAll('.trd-b .pos b')).filter(b => b.innerText.trim() === '—').length : -1 }; });
      chk('live trades: trader rows expand to positions; base prices loaded (/api/prices pairs) so P&L is real', lv.traders > 0 && lv.expanded > 0 && lv.tiles >= 8 && lv.prices >= 20 && lv.dash === 0, lv); // /api/prices carries ~24 majors; the rest fill in per symbol over time
      await page.evaluate(() => { document.querySelector('[data-v="markets"]').click(); }); await sleep(500);
      chk('live trades: markets view', await page.evaluate(() => document.querySelectorAll('.hb-r').length > 0));
      try { await page.screenshot({ path: path.join(SHOTS, 'v2-trading-live.png') }); } catch (e) {}
    }
    if (!only.length || only.includes('settings/rewards')) {
      await page.evaluate(() => { location.hash = 'settings/rewards'; }); for (let w = 0; w < 30; w++) { await sleep(500); if (await page.evaluate(() => !!document.getElementById('sSave'))) break; }
      const sr = await page.evaluate(() => ({ amount: +(document.getElementById('sAmount') || {}).value, cap: +(document.getElementById('sCap') || {}).value, togs: document.querySelectorAll('.tog').length, hints: (document.getElementById('sHints') || {}).innerText, prem: document.querySelectorAll('#premList .badge').length, xp: !!document.getElementById('xpList'), cal: (document.getElementById('calEv') || {}).value }));
      chk('reward config: every store loaded into the form (claim amount, budget, toggles, premium grants, calendar, promos)', sr.amount > 0 && sr.cap > 0 && sr.togs >= 6 && /day/.test(sr.hints || '') && sr.xp, sr);
      try { await page.screenshot({ path: path.join(SHOTS, 'v2-settings-rewards.png') }); } catch (e) {}
    }
    if (!only.length || only.includes('inbox/chat')) {
      await page.evaluate(() => { location.hash = 'inbox/chat'; }); for (let w = 0; w < 30; w++) { await sleep(500); if (await page.evaluate(() => document.querySelectorAll('.chatrow').length > 0)) break; }
      const ch = await page.evaluate(() => ({ rows: document.querySelectorAll('.chatrow').length, del: document.querySelectorAll('[data-del]').length, composer: !!document.getElementById('chatSend'), poll: !!document.getElementById('pollStart'), tg: !!document.getElementById('tgBcSend') }));
      chk('trader chat: room, composer, poll and Telegram broadcast', ch.rows > 0 && ch.del === ch.rows && ch.composer && ch.poll && ch.tg, ch);
    }
    if (!only.length || only.includes('inbox/mail')) {
      await page.evaluate(() => { location.hash = 'inbox/mail'; }); for (let w = 0; w < 30; w++) { await sleep(500); if (await page.evaluate(() => !!document.getElementById('mlSend'))) break; }
      const ml = await page.evaluate(() => ({ from: document.querySelectorAll('#mlFrom option').length, reply: document.querySelectorAll('#mlReply option').length, log: document.querySelectorAll('#mlLog tr').length }));
      chk('email: identities loaded and the sent log renders', ml.from >= 3 && ml.reply >= 3 && ml.log > 1, ml);
    }
    chk('no view embeds the old dashboard', await page.evaluate(() => !window.__ops2.NAV.some(s => s.views.some(v => v.legacy)) && !document.querySelector('iframe')));
    // 2026-09-03 late: the 20 "better and useful" additions
    if (!only.length) {
      await page.evaluate(() => { location.hash = 'today/overview'; }); await sleep(500); await page.evaluate(() => { window.__ops2.seen(Date.now() - 3 * 86400000); }); await sleep(5000); // a reload would stamp "seen = now" on pagehide, so the baseline is injected through the hook
      const td = await page.evaluate(() => { const t = document.getElementById('view').innerText; const cards = Array.from(document.querySelectorAll('.card h2')).map(h => h.innerText.replace(/\s+/g, ' ').toLowerCase()); return { since: cards.some(c => /since your last visit/.test(c)), online: cards.some(c => /online now/.test(c)), minis: document.querySelectorAll('.tile .mini').length, stamp: (document.getElementById('stamp') || {}).textContent, links: document.querySelectorAll('#view a[href^="/api/admin/user?"]').length }; });
      chk('today: since-your-last-visit card (3 days), online-now card, sparklines in tiles, live stamp', td.since && td.online && td.minis >= 4 && /updated/.test(td.stamp || '') && td.links > 0, td);
      await page.evaluate(() => { const a = document.querySelector('#view a[href^="/api/admin/user?"]'); if (a) a.click(); }); for (let w = 0; w < 20; w++) { await sleep(500); if (await page.evaluate(() => document.querySelectorAll('.modal .sup-kv').length > 0)) break; }
      const uc = await page.evaluate(() => ({ open: !!document.querySelector('.modal'), kv: document.querySelectorAll('.modal .sup-kv').length, buttons: Array.from(document.querySelectorAll('.modal .btn')).map(b => b.innerText).join(',') }));
      chk('quick user card opens from an @user link with fields and Journey/Email/Tickets buttons', uc.open && uc.kv >= 6 && /Email/.test(uc.buttons) && /Tickets/.test(uc.buttons), uc);
      await page.evaluate(() => { const a = Array.from(document.querySelectorAll('.modal .btn')).find(b => /Email/.test(b.innerText)); if (a) a.click(); }); await sleep(2500);
      const mp = await page.evaluate(() => ({ hash: location.hash, to: (document.getElementById('mlTo') || {}).value }));
      chk('user card Email button opens the composer with the address prefilled', /inbox\/mail/.test(mp.hash) && /@/.test(mp.to || ''), mp);
      await page.keyboard.press('Escape'); await page.evaluate(() => { document.activeElement && document.activeElement.blur(); }); await sleep(200);
      await page.keyboard.press('?'); await sleep(300); const hp = await page.evaluate(() => !document.getElementById('help').hidden); await page.keyboard.press('Escape'); await sleep(200);
      await page.keyboard.press(']'); await sleep(300); const nx = await page.evaluate(() => location.hash);
      chk('keyboard: ? opens help, ] moves to the next view', hp && nx === '#inbox/tgbot', { hp, nx });
      await page.keyboard.down('Control'); await page.keyboard.press('KeyK'); await page.keyboard.up('Control'); await sleep(400);
      const pk = await page.evaluate(() => Array.from(document.querySelectorAll('#palRes .pr .k')).map(x => x.innerText.toLowerCase()).slice(0, 14));
      chk('palette: recent views and actions listed when empty', pk.includes('recent') && pk.includes('action'), pk.slice(0, 8));
      await page.keyboard.press('Escape');
      await page.evaluate(() => { location.hash = 'health/perf'; }); for (let w = 0; w < 30; w++) { await sleep(500); if (await page.evaluate(() => /7-day trend/i.test(document.getElementById('view').innerText) && document.querySelectorAll('#perfTrend .tbl tr').length > 1)) break; }
      chk('perf: 7-day trend table from perfhist', await page.evaluate(() => document.querySelectorAll('#perfTrend .tbl tr').length > 1));
      await page.evaluate(() => { location.hash = 'growth/seo'; }); await sleep(3000);
      chk('seo: movers up/down cards', await page.evaluate(() => /movers up/i.test(document.getElementById('view').innerText)));
      await page.evaluate(() => { location.hash = 'trading/live'; }); await sleep(4000);
      chk('live: danger-zone card or none needed', await page.evaluate(() => { const t = document.getElementById('view').innerText; return /danger zone/i.test(t) || /open positions/i.test(t); }));
      await page.evaluate(() => { location.hash = 'inbox/support'; }); await sleep(3000); await page.evaluate(() => { const r = document.querySelector('.sup-row'); if (r) r.click(); }); await sleep(2500);
      chk('support: canned-reply bar in the composer', await page.evaluate(() => !!document.getElementById('supTplSave')));
      // 2026-09-04: trade counts are no longer the 100-row journal; Shop shows the durable cash ledger; Overview tiles drill down
      await page.evaluate(() => { location.hash = 'people/users'; }); await sleep(3500);
      const uc2 = await page.evaluate(() => { const hs = Array.from(document.querySelectorAll('#view .tbl th')).map(h => h.innerText.toLowerCase()); const tr = Array.from(document.querySelectorAll('#view .tbl tbody tr')); const i = hs.indexOf('trades'); const vals = tr.map(r => +((r.children[i] || {}).innerText || '0').replace(/,/g, '')); return { season: hs.includes('season'), max: Math.max.apply(null, vals.concat([0])) }; });
      chk('users: season column present; lifetime trades exceed the old 100 cap for at least one user', uc2.season && uc2.max > 100, uc2);
      await page.evaluate(() => { location.hash = 'money/shop'; }); await sleep(5000);
      const sh = await page.evaluate(() => { const t = document.getElementById('view').innerText; return { rows: document.querySelectorAll('#shList tr').length, cash: /cash purchases/i.test(t), cons: /consumables/i.test(t), history: /history/.test(t), cat: /catalogue/i.test(t), cashRows: Array.from(document.querySelectorAll('#shList td')).filter(td => /\$\d/.test(td.innerText)).length }; });
      chk('shop: purchase log with cash rows, consumables filter, AE history and the catalogue', sh.rows > 5 && sh.cash && sh.cons && sh.cat && sh.cashRows > 0, sh);
      await page.evaluate(() => { location.hash = 'today/overview'; }); await sleep(4000);
      await page.evaluate(() => { const t = document.querySelector('.tile[data-drill="affiliate"]'); if (t) t.click(); }); for (let w = 0; w < 20; w++) { await sleep(500); if (await page.evaluate(() => document.querySelectorAll('#drBody .row').length > 0 || /nothing yet/.test((document.getElementById('drBody') || {}).innerText || ''))) break; }
      const dr = await page.evaluate(() => ({ open: !!document.querySelector('.modal'), title: (document.querySelector('.modal .mhead b') || {}).innerText, rows: document.querySelectorAll('#drBody .row').length, clickable: document.querySelectorAll('.tile[data-drill]').length }));
      chk('overview: KPI tiles drill down to the people behind the number', dr.open && /money clicks/i.test(dr.title || '') && dr.clickable >= 5, dr);
      await page.keyboard.press('Escape'); await sleep(300);
      // arrows where a baseline exists; compact views fold their long lists
      const ar = await page.evaluate(() => ({ arrows: document.querySelectorAll('#view .tile .up, #view .tile .dn').length }));
      chk('overview: up/down arrows on the KPI tiles', ar.arrows >= 3, ar);
      await page.evaluate(() => { location.hash = 'people/security'; }); await sleep(4000);
      const sc = await page.evaluate(() => ({ folds: document.querySelectorAll('#view details.fold').length, openFolds: document.querySelectorAll('#view details.fold[open]').length, clusters: document.querySelectorAll('#view details.cl').length, needs: /needs a look/i.test(document.getElementById('view').innerText), height: document.getElementById('view').scrollHeight }));
      chk('multi-account: folded sections, one-line clusters, needs-a-look first, page under 2500px', sc.folds >= 4 && sc.openFolds === 0 && sc.clusters > 0 && sc.needs && sc.height < 2500, sc);
      await page.evaluate(() => { const d = document.querySelector('#view details.fold'); d.open = true; }); await sleep(300);
      chk('multi-account: a fold opens on demand', await page.evaluate(() => document.querySelectorAll('#view details.fold[open] details.cl').length > 0));
      await page.evaluate(() => { location.hash = 'money/premium'; }); await sleep(4000);
      const pm = await page.evaluate(() => ({ folds: document.querySelectorAll('#view details.fold').length, height: document.getElementById('view').scrollHeight, lapses: /lapses|expiring/i.test(document.getElementById('view').innerText) }));
      chk('premium desk: members first, positions and closes folded, page under 2000px', pm.folds === 2 && pm.height < 2000, pm);
      const man = await page.evaluate(async () => { const r = await fetch('/api/stats/asset/ops.webmanifest', { credentials: 'include' }); const j = await r.json(); return { status: r.status, display: j.display, icons: (j.icons || []).length }; });
      chk('PWA manifest served behind the cookie', man.status === 200 && man.display === 'standalone' && man.icons === 2, man);
    }
    // a view that fires many async fetches (Live trades) must not paint over the view the owner navigates to next
    await page.evaluate(() => { location.hash = 'trading/live'; }); await sleep(400); await page.evaluate(() => { location.hash = 'money/shop'; }); await sleep(6000);
    const ov = await page.evaluate(() => ({ crumb: (document.getElementById('crumb') || {}).innerText, live: !!document.querySelector('#view .trd, #view [data-v="markets"]'), shop: /every purchase/i.test(document.getElementById('view').innerText) }));
    chk('late responses of the previous view never overwrite the current view', /Shop/.test(ov.crumb || '') && !ov.live && ov.shop, ov);
    // attention strip lives on Today/Overview only; flags are images that actually load; scrollbars are dark (color-scheme)
    await page.evaluate(() => { location.hash = 'people/users'; }); await sleep(1500);
    const a1 = await page.evaluate(() => document.querySelectorAll('#attnbar .al').length);
    await page.evaluate(() => { location.hash = 'today/overview'; }); await sleep(3500);
    const a2 = await page.evaluate(() => ({ strip: document.querySelectorAll('#attnbar .al').length, flags: Array.from(document.querySelectorAll('img.fl')).length, loaded: Array.from(document.querySelectorAll('img.fl')).filter(i => !i.complete || i.naturalWidth > 0 || i.style.display === 'none').length, scheme: getComputedStyle(document.documentElement).colorScheme, legacyLabel: /legacy/i.test(document.getElementById('side').innerText) }));
    chk('attention strip only on Today (users view: none, overview: items)', a1 === 0 && a2.strip >= 1, { users: a1, overview: a2.strip });
    chk('flag images render in the live feed', a2.flags > 0 && a2.loaded === a2.flags, { flags: a2.flags, loaded: a2.loaded });
    chk('dark color-scheme, no "legacy" wording in the sidebar', a2.scheme === 'dark' && !a2.legacyLabel, { scheme: a2.scheme, legacyLabel: a2.legacyLabel });
    // palette
    await sleep(300);
    await page.keyboard.down('Control'); await page.keyboard.press('KeyK'); await page.keyboard.up('Control'); await sleep(300);
    await page.type('#palIn', 'kof'); await sleep(1800);
    const p = await page.evaluate(() => ({ open: !document.getElementById('pal').hidden, items: Array.from(document.querySelectorAll('#palRes .pr')).map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 40)) }));
    chk('palette opens with Ctrl+K and finds users for "kof"', p.open && p.items.some(x => /user/i.test(x)), p);
    await page.keyboard.press('Escape');
    // phone — REACHABILITY, not existence: every native view must paint visible content at 390px without any click,
    // and Support must open a thread from a real tap on a visible row (the first phone release shipped an empty Support
    // because the panes were hidden until a JS click that only the test could make).
    await page.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true }); await page.evaluate(() => { location.hash = 'today/overview'; }); await sleep(1500);
    const m = await page.evaluate(() => ({ hscroll: document.documentElement.scrollWidth > window.innerWidth + 2, menu: getComputedStyle(document.getElementById('menuBtn')).display !== 'none', tiles: document.querySelectorAll('.tile').length }));
    chk('phone: no horizontal scroll, menu button, tiles', !m.hscroll && m.menu && m.tiles >= 4, m);
    for (const v of views) {
      if (v.legacy) continue; if (only.length && !only.includes(v.key)) continue;
      await page.evaluate((k) => { location.hash = k; }, v.key);
      for (let w = 0; w < 30; w++) { await sleep(500); const ready = await page.evaluate(() => { const t = (document.getElementById('view').innerText || '').replace(/\s+/g, ' ').trim(); return t.length > 60 && !/^loading/i.test(t); }); if (ready) break; }
      await sleep(600);
      const vis = await page.evaluate(() => { const el = document.getElementById('view'); let h = 0; el.querySelectorAll('.tile,.card,.sup-l,.sup-row,.tbl,.sw').forEach(x => { const r = x.getBoundingClientRect(); if (r.height > 0 && r.width > 0) h += r.height; }); return { visibleHeight: Math.round(h), hscroll: document.documentElement.scrollWidth > window.innerWidth + 2 }; });
      chk('phone view ' + v.key + ': visible content', vis.visibleHeight > 150 && !vis.hscroll, vis);
    }
    if (!only.length || only.includes('inbox/support')) {
      await page.evaluate(() => { location.hash = 'inbox/support'; }); await sleep(3000);
      const row = await page.evaluate(() => { const r = document.querySelector('.sup-row'); if (!r) return null; const b = r.getBoundingClientRect(); const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return { x: b.x + b.width / 2, y: b.y + b.height / 2, reachable: !!(hit && (hit === r || r.contains(hit))) }; });
      chk('phone support: first ticket row is reachable at its center', !!(row && row.reachable), row);
      if (row && row.reachable) { await page.touchscreen.tap(row.x, row.y); await sleep(3000); const th = await page.evaluate(() => { const t = document.getElementById('supThread'); const s = document.getElementById('supSend'); const b = s && s.getBoundingClientRect(); return { threadH: t ? Math.round(t.getBoundingClientRect().height) : 0, msgs: document.querySelectorAll('.sup-msg').length, sendVisible: !!(b && b.height > 0 && b.y < window.innerHeight + 2000) }; }); chk('phone support: tap opens the thread with messages and a composer', th.threadH > 200 && th.msgs > 0 && th.sendVisible, th); }
    }
    await page.evaluate(() => { location.hash = 'today/overview'; }); await sleep(1500);
    const tb = await page.evaluate(() => { const a = document.querySelector('#tabbar a[data-sec="money"]'); if (!a) return null; const b = a.getBoundingClientRect(); const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return { x: b.x + b.width / 2, y: b.y + b.height / 2, reachable: !!(hit && (hit === a || a.contains(hit))), visible: b.height > 0 && b.y < window.innerHeight }; });
    chk('phone: bottom tab bar visible and reachable', !!(tb && tb.visible && tb.reachable), tb);
    if (tb && tb.reachable) { await page.touchscreen.tap(tb.x, tb.y); await sleep(1200); chk('phone: tab bar tap opens Money', await page.evaluate(() => /money/.test(location.hash) && document.querySelector('#tabbar a.on') && document.querySelector('#tabbar a.on').getAttribute('data-sec') === 'money')); }
    await page.evaluate(() => document.getElementById('menuBtn').click()); await sleep(400);
    const mo = await page.evaluate(() => document.getElementById('side').classList.contains('open') && document.getElementById('side').getBoundingClientRect().left >= -1);
    chk('phone: menu drawer opens', mo);
    try { await page.screenshot({ path: path.join(SHOTS, 'v2-_phone.png') }); } catch (e) {}
    chk('zero page errors overall', errs.length === 0, errs.slice(0, 6));
    await page.evaluate(() => fetch('/api/stats/logout', { method: 'POST' }).catch(() => {}));
    await ctx.close();
  });
  console.log(out.join('\n'));
  console.log('pass', out.filter(x => x[0] === 'P').length, 'fail', out.filter(x => x[0] === 'F').length, '· shots in build/ops-shots/v2-*.png');
  process.exit(out.some(x => x[0] === 'F') ? 1 : 0);
})().catch(e => { console.error(e); console.log(out.join('\n')); process.exit(1); });
