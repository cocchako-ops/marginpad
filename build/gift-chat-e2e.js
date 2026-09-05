/* Gift announcements in the global chat (2026-09-05).
   A Vault gift posts one line into the global room as MarginPad, and the two @names in it are clickable
   trader chips. Reading the chat is members-only (a guest gets the sign-in gate), so the render side is
   proven by running the SHIPPED mentionify() out of the live bundles rather than by faking a session.

   Covered: the line reaches the room and comes back; it is posted as MarginPad; both @names become chips;
   a member's own text is left alone; the line can be deleted again (this test cleans up after itself);
   and a source guard so a future gift path cannot ship without announcing.

   Run: node build/gift-chat-e2e.js
*/
const fs = require('fs');
const path = require('path');

const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = [];
const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 200) : ''));

const chat = async (sub, body) => {
  const r = await fetch(ORIGIN + '/chat/admin' + sub, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-admin-key': K, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

function sourceGuard() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
  const lines = src.split('\n');
  const calls = lines.filter(l => l.indexOf('announceGift(') >= 0 && l.indexOf('async function') < 0).length;
  chk('every gift path announces (5 call sites)', calls === 5, { found: calls });

  const at = src.indexOf('async function announceGift');
  const fn = src.slice(at, at + 1800);
  chk('announceGift wraps its body, so a chat outage cannot fail a purchase', at > 0 && fn.slice(0, 200).indexOf('try {') > 0 && /\}\s*catch \(e\) \{\s*\}/.test(fn));
  chk('announceGift honours the ops:cfg.giftChat kill switch', fn.indexOf('cfg.giftChat === false') > 0);

  // anything that hands giftedTo back to the client must have announced just above it
  lines.forEach((l, i) => {
    if (l.indexOf('giftedTo:') < 0 || l.indexOf('this.j(') >= 0) return; // the DO's own return is not the announce point
    const above = lines.slice(Math.max(0, i - 6), i + 1).join('\n');
    chk('gift return at worker.js:' + (i + 1) + ' announces first', above.indexOf('announceGift(') >= 0, l.trim().slice(0, 70));
  });
}

// Pull the shipped mentionify() straight out of the live bundle and run it: this tests the code users get.
async function renderGuard() {
  for (const f of ['home.js', 'mp-trade.js']) {
    const js = await fetch(ORIGIN + '/assets/' + f).then(r => r.text());
    const m = js.match(/function mentionify\(h\)\{[\s\S]*?\}\);\}/);
    chk(f + ' ships mentionify()', !!m);
    chk(f + ' applies it to house lines only', js.indexOf('if(m.admin)_body=mentionify(_body)') > 0);
    if (!m) continue;
    const fn = new Function('colorFor', 'return (' + m[0].replace(/^function mentionify/, 'function') + ')')(() => '#fff');
    const html = fn('@chako gifted @whyme the Magnetar frame.');
    const chips = (html.match(/data-lbu="([a-zA-Z0-9_]+)"/g) || []).map(s => s.slice(10, -1));
    chk(f + ': both names become trader chips', chips.length === 2 && chips[0] === 'chako' && chips[1] === 'whyme', chips);
    chk(f + ': the rest of the sentence is untouched', html.indexOf('the Magnetar frame.') > 0);
    chk(f + ': an email in a line is not chipped', fn('write to support@marginpad.io').indexOf('data-lbu') < 0);
  }
}

(async () => {
  sourceGuard();
  await renderGuard();

  const tag = 't' + Date.now().toString(36).slice(-6);
  const text = '@' + tag + 'giver gifted @' + tag + 'taker the Magnetar frame.';
  chk('the gift line is short (one chat row)', text.length <= 60, { chars: text.length });

  const post = await chat('/post', { text });
  chk('the global room accepts a MarginPad line', post.status === 200, post.body);

  const hist = await chat('/history');
  const rows = (hist.body && (hist.body.messages || hist.body)) || [];
  const mine = (Array.isArray(rows) ? rows : []).filter(x => x && x.t === text)[0];
  chk('it comes back in the history', !!mine, mine ? { u: mine.u, admin: !!mine.admin } : { rows: rows.length });
  chk('posted as MarginPad and flagged admin', !!mine && mine.u === 'MarginPad' && !!mine.admin);

  if (mine) {
    await chat('/delete', { ts: mine.ts });
    const after = await chat('/history');
    const rows2 = (after.body && (after.body.messages || after.body)) || [];
    chk('test line removed again', !(Array.isArray(rows2) ? rows2 : []).some(x => x && x.t === text));
  }

  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})();
