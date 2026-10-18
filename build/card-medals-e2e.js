/* THE PROFILE CARD: FOUR EQUAL ACTIONS AND ONE MEDAL PER BOARD (2026-10-17, owner: "Portfolio button (samo ovi
   novcici bez teksta ...) i follow button ... pored chat i duel ikonice (znaci sve 4 zajedno) i da budu istih
   dimenzija. Season winner medalja ... dosta manja ... da ne pise season winner ... razlicite po boji u zavisnosti
   od leaderboard-a ... kad se klikne medalja, text prozor da kaze koje je takmicenje i kog datuma").

   The load-bearing checks, and what makes each fail:
     - the four tiles are the same size and on one row -> any of them keeping its old shape goes red
     - Portfolio shows NO text but is still named for a screen reader
     - one medal per BOARD, each a different colour, every one under 28px, no SEASON WINNER anywhere
     - the gradient ids are unique per medal: with one shared id every disc renders in the FIRST board's colour,
       which looks almost right and is completely wrong
     - a tap names the competition AND the date, a second tap closes it, another medal switches to it
     - and the server really sends the per-win list (a real winner, live)

   node build/card-medals-e2e.js            against production
   node build/card-medals-e2e.js --local    mp-profile.js served from the working tree (pre-deploy)          */
const fs = require('fs'), path = require('path');
const { withBrowser, newPage, UA_DESKTOP, UA_MOBILE } = require('./e2e-browser');
const BASE = 'https://marginpad.io', A = path.join(__dirname, '..', 'dist', 'assets');
const LOCAL = process.argv.includes('--local');
let pass = 0, fail = 0;
const ok = (name, cond, note) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (note === undefined ? '' : '  -> ' + String(typeof note === 'string' ? note : JSON.stringify(note)).slice(0, 300))); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LV = { idx: 2, k: 'silver', name: 'Silver', col: '#b7c2d0', min: 3000, xp: 4100, next: 'Gold', nextMin: 12000, toNext: 7900, pct: 12, stars: 0 };

// four boards, known counts and known dates - so the colours, the order and the panel text are all deterministic
const D = (iso) => new Date(iso + 'T00:00:00Z').getTime();
const WINS = {
  n: 5, boards: ['xp', 'roe', 'meme', 'moon'], last: D('2026-09-14'),
  list: [
    { b: 'xp', w: D('2026-09-14'), t: D('2026-09-15') },
    { b: 'xp', w: D('2026-08-31'), t: D('2026-09-01') },
    { b: 'xp', w: D('2026-08-17'), t: D('2026-08-18') },
    { b: 'roe', w: D('2026-07-20'), t: D('2026-07-21') },
    { b: 'meme', w: D('2026-10-12'), t: D('2026-10-13') }
  ]
};

(async () => {
  // the live shape first: a real winner must come back with a per-win list, or the card has nothing to date
  const real = await fetch(BASE + '/api/lb/user?name=Papis&cb=' + Date.now()).then(r => r.json()).catch(() => null);
  ok('a real season winner comes back with wins', !!(real && real.wins && +real.wins.n > 0), real && real.wins && { n: real.wins.n });
  const rl = real && real.wins && real.wins.list;
  ok('and the server sends the per-win list the medal needs (board + the season it was won)', Array.isArray(rl) && rl.length > 0 && rl.every(r => r && r.b && +r.w > 0), Array.isArray(rl) ? rl.slice(0, 2) : rl);
  ok('every board id in it is one the card can colour', Array.isArray(rl) && rl.every(r => /^[a-z]{2,8}$/.test(String(r.b))), Array.isArray(rl) ? [...new Set(rl.map(r => r.b))] : null);

  const payload = JSON.parse(JSON.stringify(real || {}));
  payload.wins = WINS;
  /* `real` was fetched without a session, so it describes a GUEST. Since 2026-10-17 the card takes who the reader
     is from the payload rather than from the deferred mp-auth bundle, so the fixture has to say it: a guest is
     correctly offered no Message and no Duel. */
  payload.viewerSignedIn = true; payload.isSelf = false; payload.iFollow = false; payload.followsMe = false; payload.mutual = false;
  /* `view` is what /api/lb/user answers with, so a leg can re-open the card as somebody else - the long-name
     round below needs the head row to be the FIRST row (no medals above it), which is where the close button
     overlapped. */
  let view = payload;

  async function prep(browser, mobile) {
    const page = await newPage(browser, { mobile, ua: mobile ? UA_MOBILE : UA_DESKTOP });
    await page.setViewport({ width: mobile ? 390 : 1366, height: mobile ? 844 : 900, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.setCacheEnabled(false);
    await page.setRequestInterception(true);
    try { const cdp = await page.target().createCDPSession(); await cdp.send('Network.enable'); await cdp.send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) {}
    await page.setCookie({ name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
    page.on('request', (req) => {
      const u = req.url();
      if (u.indexOf('/api/track') >= 0) return req.respond({ status: 204, body: '' });
      // a signed-in VIEWER who is not this member, so follow + chat + duel all render
      if (u.includes('/api/auth/me')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2eviewer', username: 'e2eviewer', xp: 4100, level: LV } }) });
      if (u.includes('/api/auth/xp') && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 4100, level: LV, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
      if (u.includes('/api/lb/user')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(view) });
      if (LOCAL && /\/assets\/mp-profile\.js/.test(u)) return req.respond({ status: 200, contentType: 'application/javascript; charset=utf-8', body: fs.readFileSync(path.join(A, 'mp-profile.js'), 'utf8') });
      req.continue();
    });
    await page.goto(BASE + '/leaderboards/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await sleep(1200);
    // mp-profile.js is lazy: a real username click is what pulls it
    await page.evaluate(() => { const a = document.querySelector('[data-lbu]'); if (a) a.click(); });
    await page.waitForFunction('!!window.mpOpenProfile', { timeout: 30000 });
    await page.waitForSelector('.lbm.on .lbm-acts', { timeout: 25000 });
    await sleep(900);
    page._errors = errors; return page;
  }

  /* TWO GUARDS FOR A BUG THAT PASSED LINT, PARSE AND DEPLOY (2026-10-17): a comment written as
     `+ [slash-star] ... [star-slash] + '.lbm-bar{...}'` makes the second + a UNARY PLUS on the string, so the whole
     rule became the literal "NaN" inside the stylesheet and the level meter silently had no rule at all. The
     behavioural check below is the bar's own height; this one catches the shape in any rule, including one that
     nothing measures. */
  {
    const src = fs.readFileSync(path.join(A, 'mp-profile.js'), 'utf8');
    const strays = (src.match(/^[ 	]*\+[ 	]*\/\*/gm) || []).length;
    ok('no `+ /*comment*/` in the stylesheet chain (it turns the next rule into NaN)', strays === 0, strays);
    // the rule the unary-plus bug ate must be present as a real string literal in the shipped bundle
    ok('the level meter rule survives into the stylesheet string (NaN would mean a + ate it)', src.indexOf("'.lbm-bar{position:relative") > 0);
  }

  /* THE HOMEPAGE MUST NOT CARRY ITS OWN CARD AGAIN (2026-10-17): the bento had a 136-line lbOpenProfile and its
     own .lbm-* stylesheet, and because mpEnsureProfile returns early when window.mpOpenProfile already exists,
     mp-profile.js was never pulled there - so the homepage card was two generations behind and the owner saw
     nothing change on either of his devices. A second copy is what makes that happen, so a second copy is what
     this bans. */
  {
    const DIST = path.join(__dirname, '..', 'dist');
    for (const f of ['index.html', 'demo-home/index.html', 'de/index.html', 'es/index.html']) {
      const h = fs.readFileSync(path.join(DIST, f), 'utf8');
      ok(f + ' has no second copy of the profile card', h.indexOf('lbOpenProfile') < 0 && h.indexOf('lbm-medal') < 0 && h.indexOf('window.mpOpenProfile') < 0);
    }
  }

  await withBrowser(async (browser) => {
    for (const mobile of [false, true]) {
      const tag = mobile ? 'phone' : 'desktop';
      console.log('\n' + tag + (LOCAL ? ' (--local)' : ''));
      const page = await prep(browser, mobile);

      // ---- the four actions ------------------------------------------------------------------------
      const acts = await page.evaluate(() => [...document.querySelectorAll('.lbm.on .lbm-acts > button')].map(b => {
        const r = b.getBoundingClientRect();
        return { cls: b.className, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), txt: b.textContent.replace(/\s+/g, ''), label: b.getAttribute('aria-label') || b.getAttribute('title') || '' };
      }));
      ok(tag + ': all four actions are in the one row - Portfolio, Follow, message, duel', acts.length === 4 && /lbm-port/.test(acts[0].cls) && /lbm-folb/.test(acts[1].cls) && /lbm-dm/.test(acts[2].cls) && /lbm-duel/.test(acts[3].cls), acts.map(a => a.cls));
      ok(tag + ': they are the same size', acts.length === 4 && acts.every(a => a.w === acts[0].w && a.h === acts[0].h) && acts[0].w >= 30 && acts[0].w <= 40, acts.map(a => a.w + 'x' + a.h));
      ok(tag + ': and on the same line', acts.length === 4 && acts.every(a => Math.abs(a.top - acts[0].top) <= 1), acts.map(a => a.top));
      ok(tag + ': Portfolio carries no text, only the coins - but it is still named', acts.length && acts[0].txt === '' && /portfolio/i.test(acts[0].label), acts[0]);
      ok(tag + ': Follow is no longer parked beside the close button', await page.evaluate(() => { const f = document.querySelector('.lbm.on .lbm-folb'), x = document.querySelector('.lbm.on .lbm-x'); if (!f || !x) return false; const fr = f.getBoundingClientRect(), xr = x.getBoundingClientRect(); return fr.top - xr.top > 40; }));
      ok(tag + ': every tile is reachable at its own centre', await page.evaluate(() => [...document.querySelectorAll('.lbm.on .lbm-acts > button')].every(b => { const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!el && b.contains(el); })));

      // ---- the medals -------------------------------------------------------------------------------
      const meds = await page.evaluate(() => [...document.querySelectorAll('.lbm.on [data-lbmed]')].map(b => {
        const r = b.getBoundingClientRect(), disc = b.querySelector('circle');
        const defs = [...b.querySelectorAll('linearGradient')].map(g => g.id);
        return { id: b.getAttribute('data-lbmed'), w: Math.round(r.width), h: Math.round(r.height), defs, fill: disc ? disc.getAttribute('fill') : '', stroke: disc ? disc.getAttribute('stroke') : '', num: (b.querySelector('text') || {}).textContent || '', name: b.getAttribute('data-mn') };
      }));
      ok(tag + ': one medal per board won, most-won first', meds.length === 4 && meds[0].id === 'xp', meds.map(m => m.id));
      // `moon` is in `boards` with no row in `list` - the 40-row cap case. Its medal must still be there.
      ok(tag + ': a board with no dated row still gets its medal (the list is capped, the board list is not)', meds.some(m => m.id === 'moon'), meds.map(m => m.id));
      ok(tag + ': each is small (the old one was 34x43 plus a caption)', meds.every(m => m.w <= 28 && m.h <= 34), meds.map(m => m.w + 'x' + m.h));
      ok(tag + ': the board that was won three times says 3, the single wins say nothing', meds[0].num === '3' && meds.slice(1).every(m => m.num === ''), meds.map(m => m.id + ':' + m.num));
      ok(tag + ': each board has its own colour', new Set(meds.map(m => m.stroke)).size === meds.length, meds.map(m => m.id + '=' + m.stroke));
      ok(tag + ': the gradient ids are unique per medal (one shared id would paint every disc the first board\'s colour)', new Set([].concat(...meds.map(m => m.defs))).size === meds.length * 2, [].concat(...meds.map(m => m.defs)));
      ok(tag + ': the SEASON WINNER caption is gone from the card', !(await page.evaluate(() => /SEASON\s*WINNER/i.test((document.querySelector('.lbm.on') || document.body).textContent))));
      ok(tag + ': the medals do not slide under the close button', await page.evaluate(() => { const x = document.querySelector('.lbm.on .lbm-x').getBoundingClientRect(); return [...document.querySelectorAll('.lbm.on [data-lbmed]')].every(b => { const r = b.getBoundingClientRect(); return r.right <= x.left + 1 || r.top >= x.bottom - 1; }); }));

      // ---- the tap answers the question --------------------------------------------------------------
      // THE CARD MUST NOT MOVE (owner 2026-10-17): the answer is a popover OVER the card, not a panel inside it
      const before = await page.evaluate(() => { const c = document.querySelector('.lbm.on .lbm-card').getBoundingClientRect(); const n = document.querySelector('.lbm.on .lbm-name').getBoundingClientRect(); return { h: Math.round(c.height), nameTop: Math.round(n.top) }; });
      await page.evaluate(() => document.querySelector('.lbm.on [data-lbmed="xp"]').click());
      await sleep(400);
      const after = await page.evaluate(() => { const c = document.querySelector('.lbm.on .lbm-card').getBoundingClientRect(); const n = document.querySelector('.lbm.on .lbm-name').getBoundingClientRect(); const p = document.getElementById('lbmMedP').getBoundingClientRect(); const cr = document.querySelector('.lbm.on .lbm-card').getBoundingClientRect(); return { h: Math.round(c.height), nameTop: Math.round(n.top), pw: Math.round(p.width), ph: Math.round(p.height), inside: p.left >= cr.left - 1 && p.right <= cr.right + 1, over: p.top > cr.top && p.top < cr.bottom }; });
      ok(tag + ': opening it does not grow the card or move anything on it', before.h === after.h && before.nameTop === after.nameTop, { before, after });
      ok(tag + ': it is a SMALL window over the card, inside its edges', after.pw <= 240 && after.ph <= 150 && after.inside && after.over, after);
      const p1 = await page.evaluate(() => { const el = document.getElementById('lbmMedP'); return el && !el.hidden ? el.textContent.replace(/\s+/g, ' ').trim() : ''; });
      ok(tag + ': tapping a medal names the competition', /Season XP/.test(p1), p1);
      ok(tag + ': and every date it was won', /14 Sep/.test(p1) && /31 Aug/.test(p1) && /17 Aug/.test(p1), p1);
      await page.evaluate(() => document.querySelector('.lbm.on [data-lbmed="meme"]').click());
      await sleep(400);
      const p2 = await page.evaluate(() => { const el = document.getElementById('lbmMedP'); return el && !el.hidden ? el.textContent.replace(/\s+/g, ' ').trim() : ''; });
      ok(tag + ': tapping another switches to it', /Meme Spot/.test(p2) && /12 Oct/.test(p2) && !/Season XP/.test(p2), p2);
      await page.evaluate(() => document.querySelector('.lbm.on [data-lbmed="moon"]').click());
      await sleep(350);
      const p3 = await page.evaluate(() => { const el = document.getElementById('lbmMedP'); return el && !el.hidden ? el.textContent.replace(/\s+/g, ' ').trim() : ''; });
      ok(tag + ': an undated medal still names its competition rather than printing an empty window', /King of the Moon/.test(p3) && p3.length > 20, p3);
      ok(tag + ': only one medal is marked open at a time', await page.evaluate(() => document.querySelectorAll('.lbm.on [data-lbmed].on').length === 1));
      await page.evaluate(() => document.querySelector('.lbm.on [data-lbmed="moon"]').click()); // the OPEN one - moon, not meme
      await sleep(350);
      ok(tag + ': tapping the open one closes it', await page.evaluate(() => { const el = document.getElementById('lbmMedP'); return !!el && el.hidden && !document.querySelector('.lbm.on [data-lbmed].on'); }));
      await page.evaluate(() => document.querySelector('.lbm.on [data-lbmed="roe"]').click());
      await sleep(300);
      await page.evaluate(() => { const n = document.querySelector('.lbm.on .lbm-name'); n.click(); });
      await sleep(300);
      ok(tag + ': and a click anywhere else on the card closes it too', await page.evaluate(() => { const el = document.getElementById('lbmMedP'); return !!el && el.hidden; }));

      // the level meter under the squad row: it must actually be drawn, and not flush against the card above it
      const bar = await page.evaluate(() => {
        const b = document.querySelector('.lbm.on .lbm-bar'); if (!b) return null;
        const r = b.getBoundingClientRect(), cs = getComputedStyle(b), f = b.querySelector('i');
        const sq = document.querySelector('.lbm.on .lbm-sq');
        return { h: Math.round(r.height), track: cs.backgroundImage !== 'none', inset: /inset/.test(cs.boxShadow), fillH: f ? Math.round(f.getBoundingClientRect().height) : 0, gap: sq ? Math.round(r.top - sq.getBoundingClientRect().bottom) : null };
      });
      ok(tag + ': the level meter is drawn - a real track, carved, with a fill in it', !!bar && bar.h >= 5 && bar.h <= 8 && bar.track && bar.inset && bar.fillH === bar.h, bar);
      ok(tag + ': and it is not glued to the squad card above it', !bar || bar.gap === null || (bar.gap >= 6 && bar.gap <= 14), bar && bar.gap);

      /* A LONG NAME MUST NOT MOVE ANYTHING (2026-10-18, owner: "Squidward10timeX ima malo duzi name pa neke
         stvari na profil kartici su pomerene"). Measured before the fix: a 16-character name stopped 13px short
         of the close button on a 390 phone and sat UNDER it at 360; with the relationship pill beside it the
         name wrapped, the 46px level badge slid down level with the PILL instead of the name, and at 320 the
         identity column and the whole action row hung past the card's own padding.
         The head row is the FIRST row here (wins:null) - that is the case the close button overlapped. */
      const geo = async (nm, extra) => {
        // no medals, no premium tag, no owner tag: the head row has to be the FIRST row, which is the only
        // case the absolute close button overlaps (with a tag above it the X is beside THAT row)
        view = Object.assign({}, payload, { name: nm, wins: null, premium: false, plus: false, owner: false, otag: '' }, extra || {});
        await page.evaluate(() => { const b = document.querySelector('.lbm .lbm-x'); if (b) b.click(); });
        await sleep(260);
        await page.evaluate((n) => window.mpOpenProfile(n), nm);
        await page.waitForSelector('.lbm.on .lbm-nm', { timeout: 20000 });
        await sleep(700);
        return page.evaluate(() => {
          const card = document.querySelector('.lbm.on .lbm-card'), cr = card.getBoundingClientRect();
          const cs = getComputedStyle(card), inner = { l: cr.left + parseFloat(cs.paddingLeft), r: cr.right - parseFloat(cs.paddingRight) };
          const nm = card.querySelector('.lbm-nm'), nr = nm.getBoundingClientRect(), x = card.querySelector('.lbm-x').getBoundingClientRect();
          const over = [];
          card.querySelectorAll('*').forEach(e => {
            if (e.classList.contains('lbm-x')) return;             // absolute, it lives in the padding by design
            const r = e.getBoundingClientRect(); if (!r.width) return;
            let p = e.parentElement, clipped = false;
            while (p && p !== document.documentElement) { const o = getComputedStyle(p).overflowX; if (o === 'hidden' || o === 'auto' || o === 'scroll') { clipped = true; break; } p = p.parentElement; }
            if (!clipped && (r.right > inner.r + 1.5 || r.left < inner.l - 1.5)) over.push((String(e.className || e.tagName).split(' ')[0]) + '+' + Math.round(r.right - inner.r));
          });
          const badge = card.querySelector('.lbm-badge').getBoundingClientRect();
          // the identity column is the last child of the head row and fills its CONTENT box, so its right edge
          // is where the reserved corner begins - the head's own border box still spans the full inner width
          const idr = card.querySelector('.lbm-id').getBoundingClientRect();
          return { h: Math.round(cr.height), overX: nr.right > x.left - 2 && nr.top < x.bottom, over,
            headClear: Math.round(inner.r - idr.right),   // the corner the absolute close button needs
            badgeOffName: Math.round(Math.abs(badge.top - nr.top)), fs: Math.round(parseFloat(getComputedStyle(nm).fontSize)) };
        });
      };
      const gShort = await geo('Elli');
      const gLong = await geo('Squidward10timeX');
      const gMax = await geo('Wwwwwwwwwwwwwwwwwwww');           // the longest the DO will ever issue, widest glyph
      const gPill = await geo('Squidward10timeX', { mutual: true, iFollow: true, followsMe: true });
      /* THE RESERVATION IS THE INVARIANT, NOT THE CLEARANCE AT ONE WIDTH. The first wording of this check asked
         "does the name overlap the X" and could not fail at 390 or 1366 - at 390 the broken card still stopped
         13px short of it, and the real overlap happened at 360. So: the head row must leave the close button's
         corner free, and the overlap itself is re-measured at 360, where it actually went wrong. */
      ok(tag + ': the head row reserves the close button corner when it is the first row', gLong.headClear >= 28 && gShort.headClear >= 28, { long: gLong.headClear, short: gShort.headClear });
      ok(tag + ': a long name never reaches under the close button', !gLong.overX && !gMax.overX && !gPill.overX, { gLong: gLong.overX, gMax: gMax.overX, gPill: gPill.overX });
      ok(tag + ': and nothing on the card hangs past its own padding', !gShort.over.length && !gLong.over.length && !gMax.over.length && !gPill.over.length, [].concat(gShort.over, gLong.over, gMax.over, gPill.over));
      ok(tag + ': the card is the same height whatever the name is - the head row does not grow', gShort.h === gLong.h && gShort.h === gMax.h, { short: gShort.h, long: gLong.h, max: gMax.h });
      ok(tag + ': the name is shrunk to fit rather than cut (20px for a short one, smaller for a long one)', gShort.fs === 20 && gMax.fs < 20 && gMax.fs >= 15, { short: gShort.fs, max: gMax.fs });
      ok(tag + ': the level badge stays level with the NAME even when the pill wraps under it', gPill.badgeOffName <= 6, gPill.badgeOffName);
      if (mobile) {
        // 360px is the width the overlap really happened at - and 320 is where the action row used to hang out
        for (const w of [360, 320]) {
          await page.setViewport({ width: w, height: 800, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
          const g = await geo('Squidward10timeX');
          ok(w + 'px: the name clears the close button', !g.overX, g.overX);
          ok(w + 'px: nothing on the card hangs past its own padding', !g.over.length, g.over);
          /* 4x34 + gaps + "28 followers" does not fit 244px at 320, so the foot row wraps and the tiles take
             their own line. Without the wrap the followers block shrinks and "followers" folds under "28" -
             no overflow, so the padding check above cannot see it; this is what the wrap actually buys. */
          ok(w + 'px: the followers line stays on one line', await page.evaluate(() => {
            const f = document.querySelector('.lbm.on .lbm-fol'); if (!f) return true;
            return Math.round(f.getBoundingClientRect().height) <= 26;
          }), await page.evaluate(() => Math.round(document.querySelector('.lbm.on .lbm-fol').getBoundingClientRect().height)));
        }
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      }
      view = payload;

      ok(tag + ': no page errors', !page._errors.length, page._errors.slice(0, 3));
      await page.close();
    }
  });

  
// THE REAL-MONEY MEDALS WEAR THEIR PARTNER'S OWN COLOURS, AND NOT BY EYE (2026-10-18, owner: "tacne i
// precizne"). window.mpEx in mp-auth.js is the ONE place a partner's brand colour lives; the medal table
// must agree with it, or the two drift the first time either is touched.
{
  const auth = fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'mp-auth.js'), 'utf8');
  const prof = fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'mp-profile.js'), 'utf8');
  // mpEx keys the partners by their display name - Bybit: { c: '#f7a600' ... }
  const exColour = (name) => { const m = auth.match(new RegExp("\\b" + name + ":\\s*\\{\\s*c:\\s*'(#[0-9a-fA-F]{6})'")); return m ? m[1].toLowerCase() : null; };
  const medField = (id, f) => { const m = prof.match(new RegExp(id + ":\\s*\\{[^}]*\\b" + f + ":\\s*'(#[0-9a-fA-F]{6})'")); return m ? m[1].toLowerCase() : null; };
  const byEx = exColour('Bybit'), byMed = medField('bybit', 'a');
  ok('the Bybit medal is Bybit\'s own amber, the one mpEx holds', !!byEx && byEx === byMed, { mpEx: byEx, medal: byMed });
  const moEx = exColour('Moon'), moMed = medField('moon', 'a');
  ok('the Moon medal carries the accent mpEx holds for Moon', !!moEx && moEx === moMed, { mpEx: moEx, medal: moMed });
  ok('and both of them draw a partner mark instead of the house gem', /mark: 'bybit'/.test(prof) && /mark: 'moon'/.test(prof));
  // partner colours come from mpEx - this block is the guard the medal table's comment points at
}
console.log('\n' + pass + ' ok, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('ERR', e && e.stack || e); process.exitCode = 1; });
