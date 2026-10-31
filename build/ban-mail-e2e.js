// The ban email. `--pure` lifts the shipped functions out of the worker and needs no network; `--falsify` breaks the
// transition guard and the test-account guard in a copy and must go red. The live leg bans a throwaway member and
// proves a test account is never mailed. A real delivery is proven by hand: ban a member whose address reaches us.
const fs = require('fs'), path = require('path');
const PURE = process.argv.includes('--pure'), FALS = process.argv.includes('--falsify');
let src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
if (FALS) {
  src = src.split("if (m.was === 'banned') return 'already';").join('');
  src = src.split("if (banMailSkip(m.email, m.uid)) return 'skip';").join('');
}
let pass = 0, fail = 0;
function ok(c, n, x) { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } }
function block(a, b) { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('cannot lift ' + a); return src.slice(i, j); }
const lifted = block('function banMailBody(', 'async function banEverywhere(');
function make(fetchImpl, env) {
  const sent = { tg: 0, fail: 0 };
  const fn = new Function('fetch', 'mailFail', 'tgAdmin', lifted + ';return {banMailBody,banMailSkip,banNotice};');
  return Object.assign(fn(fetchImpl, () => { sent.fail++; }, async () => { sent.tg++; }), { sent, env });
}
(async () => {
  console.log('the body');
  const m0 = make(async () => ({ ok: true, status: 200 }));
  const b = m0.banMailBody('Papis');
  ok(/banned/i.test(b.subject), 'the subject says banned');
  ok(/breaching our Terms of Service/.test(b.text), 'it names the Terms of Service');
  ok(/final/.test(b.text) && /cannot be appealed/.test(b.text), 'it says the decision is final');
  ok(/suspended and banned/.test(b.text), 'it says the next account goes the same way');
  ok(/@Papis/.test(b.text) && /@Papis/.test(b.html), 'it names the account');
  ok(/https:\/\/marginpad\.io\/terms\//.test(b.html), 'it links the terms');
  ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(b.text + b.html), 'no emoji');
  const nasty = m0.banMailBody('<img src=x onerror=1>');
  ok(!/[<>]/.test(nasty.text) && !/onerror=/.test(nasty.html.replace(/style="[^"]*"/g, '')), 'a hostile name cannot reach the markup', nasty.html);
  ok(!/@/.test(m0.banMailBody('').text), 'no name, no empty handle');

  console.log('who is mailed');
  const env = { RESEND_API_KEY: 'x' };
  let calls = [];
  const m1 = make(async (u, o) => { calls.push({ u, o: JSON.parse(o.body) }); return { ok: true, status: 200 }; });
  const real = { banMail: { uid: 'abc', email: 'someone@gmail.com', username: 'someone', was: 'active' } };
  ok(await m1.banNotice(env, real) === 'sent' && calls.length === 1, 'a first ban sends once', calls.length);
  ok(calls[0] && calls[0].o.to[0] === 'someone@gmail.com' && /support@marginpad\.io/.test(calls[0].o.from), 'it goes to the member, from support@');
  ok(await m1.banNotice(env, { banMail: Object.assign({}, real.banMail, { was: 'banned' }) }) === 'already' && calls.length === 1, 'a second press sends nothing', calls.length);
  ok(await m1.banNotice(env, { banMail: { uid: 'e2e_x', email: 'a@gmail.com', username: 'e', was: 'active' } }) === 'skip' && calls.length === 1, 'an e2e uid is never mailed', calls.length);
  ok(await m1.banNotice(env, { banMail: { uid: 'x', email: 'e2e+1@gmail.com', username: 'e', was: 'active' } }) === 'skip' && calls.length === 1, 'an e2e address is never mailed', calls.length);
  ok(await m1.banNotice(env, { banMail: { uid: 'x', email: 'a@example.com', username: 'e', was: 'active' } }) === 'skip' && calls.length === 1, 'example.com is never mailed', calls.length);
  ok(await m1.banNotice(env, { banMail: { uid: 'x', email: '', username: 'e', was: 'active' } }) === 'skip', 'no address, nothing to send');
  ok(await m1.banNotice(env, {}) === 'skip', 'an answer with no ban carries no mail');

  console.log('a failed send is said out loud');
  const m2 = make(async () => ({ ok: false, status: 429 }));
  ok(await m2.banNotice(env, real) === 'failed' && m2.sent.fail === 1 && m2.sent.tg === 1, 'a refused send is failed, counted and paged', m2.sent);
  const m3 = make(async () => { throw new Error('net'); });
  ok(await m3.banNotice(env, real) === 'failed' && m3.sent.tg === 1, 'a network error is failed and paged', m3.sent);

  console.log('every ban path carries it');
  ok(/if \(d && d\.ok && b\.action === 'ban'\) d\.mail = await banNotice\(env, d\); delete d\.banMail;/.test(src), 'the button mails and strips the private row from the answer');
  ok(/out\.mail = await banNotice\(env, d\)/.test(src), 'banEverywhere mails (promo abuse, the sweep)');
  ok(/banMail: act === 'ban' \?/.test(src), 'only a ban hands the address to the worker');

  if (!PURE && !FALS) {
    console.log('production, a throwaway member');
    const key = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
    const H = { 'content-type': 'application/json', 'x-admin-key': key }, O = 'https://marginpad.io', uid = 'e2ebanmail';
    const j = async (u, b) => (await fetch(O + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();
    await j('/api/admin/e2euser', { uid, op: 'mk' });
    const r = await j('/api/auth/control', { id: uid, action: 'ban' });
    ok(r.ok === true && r.mail === 'skip', 'a test account is banned and not mailed', r);
    ok(r.banMail === undefined, 'the answer does not carry the address', r);
    const r2 = await j('/api/auth/control', { id: uid, action: 'ban' });
    ok(r2.ok === true && r2.mail === 'already', 'a second press reads already banned', r2);
    await j('/api/auth/control', { id: uid, action: 'unban' });
    await j('/api/admin/e2euser', { uid, op: 'rm' });
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
