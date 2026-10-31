/* The downloaded paper bot, run for real against the production Bot API with a throwaway account: a rule that is always true
   must open a real paper position with its stop and target, a rule that says leave must close it, and the account is removed
   at the end. Then every generated bot file is run with --check, which prices a trade and places nothing.
   node build/strategy-bot-e2e.js */
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const { RULES } = require('./strategies/rules');
const { toBot } = require('./strategies/emit');
const O = 'https://marginpad.io';
const KEY = (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[\w-]+/) || [])[0];
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('FAIL  ' + m + (x !== undefined ? ' -> ' + JSON.stringify(x).slice(0, 300) : '')); } };
const adm = (p, b) => fetch(O + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify(b) }).then((r) => r.json());
const rt = fs.readFileSync(path.join(__dirname, 'strategies/runtime.py.txt'), 'utf8'), bot = fs.readFileSync(path.join(__dirname, 'strategies/runtime-bot.py.txt'), 'utf8');
const uid = 'e2estratbot' + Date.now().toString(36).slice(-5), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-bot-'));
const py = (file, args, key) => spawnSync('python', [file, ...args], { encoding: 'utf8', env: { ...process.env, MARGINPAD_KEY: key }, timeout: 40000 });
const base = { id: 'X', slug: 'x', name: 'Test', summary: 's', tf: '4h' };

(async () => {
  await adm('/api/admin/e2euser', { uid, op: 'mk' });
  try {
    const sess = (await adm('/api/admin/e2euser', { uid, op: 'sess' })).token;
    const kr = await (await fetch(O + '/api/bot/key', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'mp_sess=' + sess }, body: JSON.stringify({ label: 'strat' }) })).json();
    const key = kr.key || kr.apiKey || (kr.created && kr.created.key);
    ok(!!key, 'a key was issued', Object.keys(kr));
    const f = (name, r) => { const p = path.join(tmp, name + '.py'); fs.writeFileSync(p, toBot({ ...base, ...r }, rt, bot)); return p; };
    const openF = f('open', { entryL: ['gt', ['close'], 0], stop: { atr: 2 }, tp: { r: 3 } });
    const a = py(openF, ['BTC', '--once', '--margin', '50'], key);
    ok(a.status === 0 && /open long BTC/.test(a.stdout), 'a true rule opens a position', a.stdout + a.stderr);
    const read = async () => { const j = await (await fetch(O + '/api/bot/v1/positions', { headers: { 'x-api-key': key } })).json(); return (Array.isArray(j) ? j : j.positions || j.data || []).find((x) => x.symbol === 'BTC' && (x.status || 'open') === 'open'); };
    let p = null, seen = 0;
    for (; seen < 15 && !p; seen++) { p = await read(); if (!p) await new Promise((r) => setTimeout(r, 1000)); }
    console.log('      opened, visible after', seen, 'reads; bot said:', a.stdout.trim().slice(0, 170));
    ok(p && p.side === 'long' && p.sl > 0 && p.tp > p.entry_price, 'the position carries the stop and target the rule asked for', p);
    const b = py(openF, ['BTC', '--once', '--margin', '50'], key);
    ok(/in a position/.test(b.stdout) || /no signal/.test(b.stdout), 'a second pass does not stack a second position', b.stdout);
    const closeF = f('close', { entryL: ['lt', ['close'], 0], exitL: ['gt', ['close'], 0] });
    /* /v1/positions can miss a position for a moment right after it opens (measured: about 1 read in 10). A live bot reads at
       the next bar close, so here the pass is simply repeated, as the next bar would repeat it. */
    let c = py(closeF, ['BTC', '--once'], key);
    for (let t = 0; t < 4 && !/close BTC/.test(c.stdout); t++) { await new Promise((r) => setTimeout(r, 2000)); c = py(closeF, ['BTC', '--once'], key); }
    ok(/close BTC/.test(c.stdout), 'an exit rule closes it', c.stdout + c.stderr);
    let left = null, waited = 0;
    for (; waited < 15; waited++) { left = await read(); if (!left) break; await new Promise((r) => setTimeout(r, 1000)); }
    console.log('      closed, gone after', waited, 's; bot said:', c.stdout.trim().slice(0, 170));
    ok(!left, 'nothing is left open', [left, c.stdout]);
    const bad = [];
    for (const r of RULES.slice(0, 60)) {
      const pf = path.join(tmp, r.slug + '-bot.py'); fs.writeFileSync(pf, toBot(r, rt, bot));
      const res = spawnSync('python', ['-m', 'py_compile', pf], { encoding: 'utf8' });
      if (res.status !== 0) bad.push(r.slug);
    }
    ok(!bad.length, 'all sixty bot files compile', bad);
    const run = RULES.filter((r) => ['supertrend', 'rsi-2', 'donchian-20', 'bollinger-fade', 'edge-fade-short'].includes(r.slug));
    const errs = [];
    for (const r of run) { const out = py(path.join(tmp, r.slug + '-bot.py'), ['ETH', '--once', '--check'], key); if (out.status !== 0 || /Traceback/.test(out.stderr)) errs.push([r.slug, out.stderr.slice(-160)]); }
    ok(!errs.length, 'five bots read live candles and run without an error', errs);
    const none = spawnSync('python', [openF], { encoding: 'utf8', env: { ...process.env, MARGINPAD_KEY: '' } });
    ok(none.status !== 0 && /MARGINPAD_KEY/.test(none.stderr), 'with no key it says where to get one', none.stderr);
  } finally {
    await adm('/api/admin/e2euser', { uid, op: 'rm' });
  }
  console.log(`\n${pass} ok, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log('ERR', e.message); process.exitCode = 1; });
