/* Daily review and the practical exam. The pure rules are LIFTED out of the shipped worker and driven here; without --pure the suite then walks a real throwaway member on production.
   Load-bearing: a lesson finished today is not reviewed today; one question per lesson; a wrong answer comes back tomorrow; the review pays once a day. A clean trade counts, a trade with no stop or
   too much risk sets the run to zero, a client or bot row neither counts nor breaks it, and five clean in a row pays once. Run: node build/academy-practice-e2e.js [--pure] */
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), B = 'https://marginpad.io', src = fs.readFileSync(path.join(R, 'src/worker.js'), 'utf8');
const pure = process.argv.includes('--pure');
let ok = 0, bad = 0; const c = (n, v, x) => { if (v) { ok++; console.log('ok  ', n); } else { bad++; console.log('FAIL', n, x === undefined ? '' : JSON.stringify(x).slice(0, 240)); } };
const lift = (name) => { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
const constOf = (name) => src.match(new RegExp('const ' + name + ' = (\\{[^\\n]*\\});'))[1];
const env = new Function(`const ACAD_PRACT=${constOf('ACAD_PRACT')};const ACAD_REVIEW=${constOf('ACAD_REVIEW')};const lbExcluded=(s)=>s==='MPAD';${lift('tradeOpenTs')};${lift('reviewPick')};${lift('pracCheck')};return {reviewPick,pracCheck,ACAD_PRACT,tradeOpenTs};`)();
const { reviewPick, pracCheck } = env, now = Math.floor(Date.now() / 864e5) * 864e5 + 432e5, day = 864e5;
// review
const done = [{ lesson: 'a', ts: now - 5 * day }, { lesson: 'b', ts: now - 4 * day }, { lesson: 'c', ts: now - 3 * day }, { lesson: 'd', ts: now - 1000 }];
let p = reviewPick(done, [], now, 3);
c('three questions from three old lessons', p.length === 3 && p.map((x) => x.l).join('') === 'abc', p);
c('a lesson finished today is not reviewed', !p.some((x) => x.l === 'd'));
p = reviewPick(done, [{ lesson: 'b', qi: 1, box: 1, due: now - 1 }, { lesson: 'b', qi: 2, box: 1, due: now - 2 }], now, 3);
c('a due card comes first, one per lesson', p[0].l === 'b' && p[0].q === 2 && p.filter((x) => x.l === 'b').length === 1, p);
p = reviewPick(done, [{ lesson: 'a', qi: 0, box: 2, due: now + 2 * day }], now, 3);
c('a card not yet due is skipped, the next question of that lesson is offered', p.find((x) => x.l === 'a').q === 1, p);
c('under three candidates there is no review', reviewPick(done.slice(0, 2), [], now, 3).length === 0);
// practical
const start = now - day, id = (ms) => 'srv' + ms.toString(36).padStart(8, '0') + 'ab';
const T = (o) => Object.assign({ tid: id(now - 3600e3), ts: now, sym: 'BTC', side: 'long', lev: 10, margin: 200, liq: 0, src: 'srv', sl: 1, slpx: 99, entry: 100 }, o);
c('the id round-trips the open time', env.tradeOpenTs(id(now - 3600e3)) === now - 3600e3);
c('a disciplined trade is clean', JSON.stringify(pracCheck(T({}), start)) === '[]', pracCheck(T({}), start));
c('no stop breaks the run', pracCheck(T({ sl: 0, slpx: null }), start).indexOf('stop') >= 0);
c('$2,000 with a stop 11% away risks $220 and breaks the run', pracCheck(T({ slpx: 89 }), start).indexOf('risk') >= 0);
c('a short stop is measured above entry', pracCheck(T({ side: 'short', slpx: 111 }), start).indexOf('risk') >= 0);
c('a stop moved into profit risks nothing', pracCheck(T({ slpx: 100.5 }), start).length === 0);
c('under $1,000 is too small', pracCheck(T({ margin: 50 }), start).indexOf('size') >= 0);
c('over 20x breaks it', pracCheck(T({ lev: 25, margin: 100 }), start).indexOf('lev') >= 0);
c('held under two minutes breaks it', pracCheck(T({ ts: now - 3600e3 + 60000 }), start).indexOf('hold') >= 0);
c('a liquidation breaks it', pracCheck(T({ liq: 1 }), start).indexOf('liq') >= 0);
c('a trade opened before Start does not count', pracCheck(T({ tid: id(start - 1000) }), start) === null);
c('a browser row does not count', pracCheck(T({ src: 'app' }), start) === null);
c('a bot row does not count', pracCheck(T({ src: 'bot' }), start) === null);
c('the RNG class does not count', pracCheck(T({ sym: 'MPAD' }), start) === null);
c('the exam tables are in the per-user wipe', /'acadexam', 'acadrev', 'acadrevday', 'acadprac'/.test(src));
if (pure) { console.log('\n' + ok + ' ok, ' + bad + ' failed'); process.exit(bad ? 1 : 0); }

(async () => {
  const K = fs.readFileSync(path.join(R, 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/)[0], H = { 'content-type': 'application/json', 'x-admin-key': K };
  const adm = (p2, b) => fetch(B + p2, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json());
  const uid = 'e2e_p' + Date.now().toString(36); await adm('/api/admin/e2euser', { uid, op: 'mk' });
  const q = '?uid=' + uid, me = () => fetch(B + '/api/academy' + q, { headers: H }).then((r) => r.json());
  const s0 = await me();
  c('a new member has no practical and no review', s0.prac && s0.prac.started === false && s0.review && !s0.review.items.length, s0.review);
  const st = await fetch(B + '/api/academy/practical' + q, { method: 'POST', headers: H, body: '{}' }).then((r) => r.json());
  c('the practical waits for the course', st.error === 'lessons_left', st);
  const D = JSON.parse(fs.readFileSync(path.join(R, 'dist/academy/index.html'), 'utf8').match(/id="acadData">([\s\S]*?)<\/script>/)[1]);
  for (const l of D.courses.find((x) => x.id === 'firsttrade').lessons) await fetch(B + '/api/academy' + q, { method: 'POST', headers: H, body: JSON.stringify({ lesson: l.id, mistakes: 0 }) });
  const st2 = await fetch(B + '/api/academy/practical' + q, { method: 'POST', headers: H, body: '{}' }).then((r) => r.json());
  c('finishing the course opens it', st2.ok && st2.prac.started && st2.prac.run === 0, st2);
  await adm('/api/admin/e2euser', { uid, op: 'rm' });
  console.log('\n' + ok + ' ok, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(1); });
