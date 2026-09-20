// THE "HOW MARGINPAD WORKS" CARD on /season/ (2026-09-20).
//
// Why it exists: 471 of 598 accounts are below Bronze and 216 of those already trade - they use the product and
// are locked out of every reward, and the season page did not contain the word "Bronze" even once. The card
// says what the gate is, that the Academy is the fast way through it, and how the two real-money boards work.
//
// The owner asked for the language picker to live INSIDE the card and to translate only the card, so that is
// exactly what this asserts: the chip changes the card and leaves the rest of the page alone.
//
//   node build/howto-e2e.js
const fs = require('fs');
const { withBrowser, newPage } = require('./e2e-browser.js');
const KEY = (fs.readFileSync(__dirname + '/../ADMIN_KEY.local.txt', 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io';

const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + JSON.stringify(x).slice(0, 200) : ''));
const api = async (op, uid, extra) => (await fetch(B + '/api/admin/e2euser', { method: 'POST', headers: { 'x-admin-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ uid, op }, extra || {})) })).json();

(async () => {
  const UID = 'e2ehow' + Math.random().toString(36).slice(2, 6);
  await api('mk', UID);
  const sess = await api('sess', UID);
  try {
    await withBrowser(async (browser) => {
      // /api/auth/xp is cached 45 s PER ISOLATE, and a poll from node lands on a different isolate than the
      // browser - so "node can see the new XP" proves nothing about what the page will read. Any leg that
      // changes a member's XP has to wait out the cache the BROWSER filled.
      let memberReadAt = 0;
      const waitXpCache = async () => {
        const left = 50000 - (Date.now() - memberReadAt);
        if (memberReadAt && left > 0) await new Promise(r => setTimeout(r, left));
      };
      const open = async (path, opts) => {
        const ctx = await browser.createBrowserContext();
        const page = await ctx.newPage();
        page.on('pageerror', e => out.push('FAIL page error on ' + path + ': ' + String(e.message).slice(0, 90)));
        if (opts && opts.phone) await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
        await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'language', { get: () => 'en-US' }); });
        if (opts && opts.member) await page.setCookie(
          { name: 'mp_sess', value: sess.token, domain: 'marginpad.io', path: '/', secure: true },
          { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/', secure: true });
        await page.goto(B + path + '?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
        await new Promise(r => setTimeout(r, 4500));
        if (opts && opts.member) memberReadAt = Date.now();
        return { ctx, page };
      };

      // ---------- it is there, and it leads
      {
        const { ctx, page } = await open('/season/', {});
        const g = await page.evaluate(() => {
          const s = document.getElementById('howto');
          if (!s) return null;
          const secs = [...document.querySelectorAll('section[id]')].map(x => x.id);
          const r = s.getBoundingClientRect();
          return {
            ids: secs, before: secs.indexOf('howto') < secs.indexOf('today'),
            chips: s.querySelectorAll('.hw-lang button').length,
            steps: s.querySelectorAll('.hw-steps li').length,
            text: s.innerText.replace(/\s+/g, ' '),
            top: Math.round(r.top + window.scrollY),
            nav: !!document.querySelector('.snav a[data-s="howto"]'),
          };
        });
        chk('the card is on /season/, above Today, with four steps and a nav stop', !!g && g.before && g.steps === 4 && g.nav, g && { steps: g.steps, nav: g.nav, top: g.top });
        chk('it names the gate, the number and the fast route', !!g && /Bronze/.test(g.text) && /500/.test(g.text) && /Academy/i.test(g.text), g && { hasBronze: /Bronze/.test(g.text), has500: /500/.test(g.text) });
        chk('it explains the two real-money boards', !!g && /Bybit/.test(g.text) && /Moon/.test(g.text), g && { bybit: /Bybit/.test(g.text), moon: /Moon/.test(g.text) });
        chk('a guest is told to sign in, and sees no progress bar', !!g && /[Ss]ign in/.test(g.text) && !/XP to go/.test(g.text));
        chk('the language chips are there', !!g && g.chips >= 10, g && { chips: g.chips });
        await ctx.close();
      }

      // ---------- the chip translates the CARD and nothing else
      {
        const { ctx, page } = await open('/season/', {});
        const before = await page.evaluate(() => ({
          card: document.getElementById('howto').innerText.replace(/\s+/g, ' ').slice(0, 300),
          page: (document.getElementById('today') || {}).innerText.replace(/\s+/g, ' ').slice(0, 300),
        }));
        await page.evaluate(() => document.querySelector('.hw-lang button[data-l="es"]').click());
        await new Promise(r => setTimeout(r, 900));
        const after = await page.evaluate(() => ({
          card: document.getElementById('howto').innerText.replace(/\s+/g, ' ').slice(0, 300),
          page: (document.getElementById('today') || {}).innerText.replace(/\s+/g, ' ').slice(0, 300),
          on: (document.querySelector('.hw-lang button.on') || {}).textContent,
          dir: document.getElementById('howto').getAttribute('dir'),
        }));
        chk('picking Spanish changes the card', before.card !== after.card && /[áéíóúñ¿]/.test(after.card), { on: after.on });
        chk('and leaves the rest of the page exactly as it was', before.page === after.page);
        // right-to-left really flips
        await page.evaluate(() => document.querySelector('.hw-lang button[data-l="ar"]').click());
        await new Promise(r => setTimeout(r, 700));
        const ar = await page.evaluate(() => ({ dir: document.getElementById('howto').getAttribute('dir'), t: document.getElementById('howto').innerText.slice(0, 120) }));
        chk('Arabic flips the card to right-to-left', ar.dir === 'rtl' && /[؀-ۿ]/.test(ar.t), { dir: ar.dir });
        // and the choice survives a reload
        await page.reload({ waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 3500));
        const back = await page.evaluate(() => (document.querySelector('.hw-lang button.on') || {}).textContent);
        chk('the choice is remembered on the next visit', back === 'AR', { on: back });
        await ctx.close();
      }

      // ---------- a member below Bronze is told exactly how far
      {
        const { ctx, page } = await open('/season/', { member: true });
        const m = await page.evaluate(() => {
          const s = document.getElementById('howto');
          const bar = document.getElementById('hwBar');
          return { t: document.getElementById('hwYouT').innerText.replace(/\s+/g, ' '), barShown: !!(bar && !bar.hidden), w: bar && bar.firstChild ? bar.firstChild.style.width : '', folded: s.classList.contains('in') };
        });
        chk('a member below Bronze sees their XP, what is left and how many lessons that is',
          /\d/.test(m.t) && /XP/.test(m.t) && /lesson/i.test(m.t) && m.barShown && !m.folded, m);
        await ctx.close();
      }

      // ---------- a member who is already Bronze does not get the route to Bronze
      {
        // setlevel wants the INTERNAL user id, which is not the e2e uid - resolve it the way support does
        let internal = '';
        try {
          const w = await (await fetch(B + '/api/admin/xpdiag?u=' + encodeURIComponent('e2e_' + UID), { headers: { 'x-admin-key': KEY } })).json();
          internal = (w && w.user && w.user.id) || '';
        } catch (e) {}
        let lifted = null;
        if (internal) lifted = await (await fetch(B + '/api/auth/xp/setlevel?key=' + encodeURIComponent(KEY), {
          method: 'POST', headers: { 'x-admin-key': KEY, 'content-type': 'application/json' },
          body: JSON.stringify({ uid: internal, level: 'bronze', note: 'howto-e2e' }),
        })).json().catch(() => null);
        // THE TOP-UP IS PART OF THE TEST. Without it the assertion below falls through its own else and passes
        // while proving nothing - which is exactly how it behaved on the run that caught this.
        chk('the e2e member really was lifted to Bronze before the fold is judged',
          !!(lifted && lifted.ok && (+lifted.xp || 0) >= 500), { internal: !!internal, lifted });
        // /api/auth/xp is cached 45 s per isolate and the leg above just filled that cache with a zero, so the
        // browser would read the OLD number and the fold would be judged on stale data. Wait for the endpoint
        // the card actually reads to agree, rather than for a fixed number of seconds.
        let seen = -1;
        for (let i = 0; i < 24 && seen < 500; i++) {
          if (i) await new Promise(r => setTimeout(r, 3000));
          try {
            const j = await (await fetch(B + '/api/auth/xp', { headers: { cookie: 'mp_sess=' + sess.token } })).json();
            seen = +(j && j.xp) || 0;
          } catch (e) {}
        }
        chk('and the endpoint the card reads agrees before the page is opened', seen >= 500, { xp: seen });
        await waitXpCache();
        const { ctx, page } = await open('/season/', { member: true });
        const m = await page.evaluate(() => {
          const s = document.getElementById('howto');
          const vis = [...s.querySelectorAll('.hw-steps li')].filter(li => li.offsetParent !== null).length;
          return { folded: s.classList.contains('in'), visibleSteps: vis, t: document.getElementById('hwYouT').innerText.replace(/\s+/g, ' ') };
        });
        chk('a Bronze member keeps the boards and the Moon/Bybit part, and loses the route to Bronze',
          m.folded && m.visibleSteps === 1, m);
        // AND IS TOLD WHAT IS STILL SHUT. Bronze does not reach The Gold Room (Gold, 12,000 XP) - the line
        // used to say "you count on every board", which is the exact thing the owner caught on the card above.
        chk('and is told The Gold Room still needs Gold, rather than "every board"',
          /Gold Room/.test(m.t) && /12,000/.test(m.t) && !/every board/i.test(m.t), { t: m.t });
        await ctx.close();
      }

      // ---------- a Gold member is greeted as Gold, with nothing held back
      {
        let internal = '';
        try {
          const w = await (await fetch(B + '/api/admin/xpdiag?u=' + encodeURIComponent('e2e_' + UID), { headers: { 'x-admin-key': KEY } })).json();
          internal = (w && w.user && w.user.id) || '';
        } catch (e) {}
        const lifted = internal ? await (await fetch(B + '/api/auth/xp/setlevel?key=' + encodeURIComponent(KEY), {
          method: 'POST', headers: { 'x-admin-key': KEY, 'content-type': 'application/json' },
          body: JSON.stringify({ uid: internal, level: 'gold', note: 'howto-e2e' }),
        })).json().catch(() => null) : null;
        let seen = -1;
        for (let i = 0; i < 24 && seen < 12000; i++) {
          if (i) await new Promise(r => setTimeout(r, 3000));
          try {
            const j = await (await fetch(B + '/api/auth/xp', { headers: { cookie: 'mp_sess=' + sess.token } })).json();
            seen = +(j && j.xp) || 0;
          } catch (e) {}
        }
        chk('the e2e member really reached Gold before the greeting is judged', seen >= 12000, { xp: seen, lifted: !!(lifted && lifted.ok) });
        await waitXpCache();
        const { ctx, page } = await open('/season/', { member: true });
        const g = await page.evaluate(() => document.getElementById('hwYouT').innerText.replace(/\s+/g, ' '));
        chk('a Gold member is greeted as Gold and nothing is named as still shut',
          /Gold/.test(g) && !/opens at Gold/i.test(g) && !/12,000/.test(g), { t: g });
        await ctx.close();
      }

      // ---------- the Spanish twin, and a phone
      {
        const { ctx, page } = await open('/es/season/', {});
        const g = await page.evaluate(() => {
          const s = document.getElementById('howto');
          return s ? { on: (s.querySelector('.hw-lang button.on') || {}).textContent, t: s.innerText.slice(0, 160) } : null;
        });
        chk('/es/season/ opens the card already in Spanish', !!g && g.on === 'ES' && /[áéíóúñ¿]/.test(g.t), g);
        await ctx.close();
      }
      {
        const { ctx, page } = await open('/season/', { phone: true });
        const p = await page.evaluate(() => {
          const s = document.getElementById('howto');
          const r = s.getBoundingClientRect();
          const wide = [...s.querySelectorAll('*')].filter(el => el.getBoundingClientRect().width > window.innerWidth + 1).length;
          const chip = s.querySelector('.hw-lang button').getBoundingClientRect();
          return { hscroll: document.documentElement.scrollWidth > window.innerWidth + 1, wide, chipH: Math.round(chip.height), h: Math.round(r.height) };
        });
        chk('phone 390: nothing wider than the screen, the card fits, chips are tappable', !p.hscroll && p.wide === 0 && p.chipH >= 20, p);
        await ctx.close();
      }
    }, { timeoutMs: 900000 });
  } finally { await api('rm', UID); }

  console.log(out.join('\n'));
  const fail = out.filter(l => l.startsWith('FAIL')).length;
  console.log('\nhowto-e2e: ' + (out.length - fail) + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();
