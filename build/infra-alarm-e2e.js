// INFRASTRUCTURE ALARM E2E (2026-10-18). Two guards that need no network, because both describe failures
// we cannot stage on production: the collector being dead for hours, and its status probe meeting a stall.
//
// Both LIFT the block out of the SHIPPED src/worker.js with new Function and drive it with stubs, so what
// is tested is the code that runs rather than a retyped copy of it. Both are falsifiable: `--falsify`
// restores the pre-2026-10-18 shape and the named checks must go red. A suite that cannot fail is worth
// nothing (CLAUDE.md, 2026-10-10).
//
//   node build/infra-alarm-e2e.js            run the guards
//   node build/infra-alarm-e2e.js --falsify  prove they can fail
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
const FALSIFY = process.argv.includes('--falsify');
let pass = 0, fail = 0;
const chk = (name, cond, got) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (got !== undefined ? '  -> ' + got : '')); };

function lift(startAnchor, endAnchor, what) {
  const i = SRC.indexOf(startAnchor);
  if (i < 0) throw new Error('cannot find ' + what + ' in src/worker.js (start anchor moved)');
  const k = SRC.indexOf(endAnchor, i);
  if (k < 0) throw new Error('cannot find the end of ' + what + ' in src/worker.js');
  return SRC.slice(i, k + endAnchor.length);
}

/* ---------- 1. the collector probe inside sampleUptime retries once ----------
   The droplet's ring persist blocks its main thread for seconds (measured 3.7 s typically, 12.2 s at
   midnight). A single attempt recorded that as ten minutes of downtime on the public status page.
   collectorStatusInfo was given three attempts over ~15 s on 2026-10-09 for the same reason; this
   second probe of the same URL was left on one until 2026-10-18. */
function probeTests() {
  console.log('\n--- the /status/ collector probe survives a stall ---');
  let body = lift(
    "    const base = (env.COLLECTOR_URL || '').replace(/\\/$/, '');\n    if (base) {\n      let r = null, j = null;",
    '      if (r && r.ok && ex.length && ex.filter(x => x.connected).length >= Math.ceil(ex.length / 2)) { c.coll = 1; }\n    }',
    'the sampleUptime collector probe');
  if (FALSIFY) body = body.split('for (let att = 0; att < 2; att++)').join('for (let att = 0; att < 1; att++)');
  const probe = new Function('env', 'c', 'fetch', 'AbortSignal', 'return (async () => {\n' + body + '\n})();');

  const live = { exchanges: [{ name: 'a', connected: true }, { name: 'b', connected: true }, { name: 'c', connected: true }] };
  const halfDown = { exchanges: [{ name: 'a', connected: false }, { name: 'b', connected: false }, { name: 'c', connected: true }] };
  const AS = { timeout: () => null };
  const stub = (plan) => { let n = 0; return async () => { const s = plan[Math.min(n++, plan.length - 1)]; if (s === 'throw') throw new Error('timeout'); if (s === 'down') return { ok: false, json: async () => ({}) }; if (s === 'half') return { ok: true, json: async () => halfDown }; return { ok: true, json: async () => live }; }; };

  const CASES = [
    ['healthy on the first attempt', ['ok'], 1, false],
    ['A STALL on the first attempt, an answer on the second', ['throw', 'ok'], 1, true],
    ['a 5xx on the first attempt, an answer on the second', ['down', 'ok'], 1, true],
    ['genuinely down - both attempts throw', ['throw', 'throw'], 0, false],
    ['genuinely down - both attempts 5xx', ['down', 'down'], 0, false],
    ['answers, but more than half the venues are disconnected', ['half', 'half'], 0, false],
  ];
  return (async () => {
    for (const [name, plan, want, isRetryCase] of CASES) {
      const c = { coll: 0, collMs: 0 };
      await probe({ COLLECTOR_URL: 'https://collector.test/' }, c, stub(plan), AS);
      chk(name + (isRetryCase && FALSIFY ? '  [must go red]' : ''), c.coll === want, 'coll=' + c.coll + ' (want ' + want + ')');
    }
  })();
}

/* ---------- 2. a total collector outage keeps shouting ----------
   The alarm key used to be alrt:coll:<today>, so the whole liquidation feed being dead paged ONCE and
   went quiet for up to 24 hours. 2026-10-06: the droplet stopped answering at 10:18 UTC, the line fired
   at about 10:20, and nothing spoke again until the owner power-cycled it at 19:24. The invariant here
   is the SILENCE, not a page count - what must be impossible is a long gap. */
function alarmTests() {
  console.log('\n--- a nine-hour collector outage cannot go quiet ---');
  let body = lift('   const collDown = !!(cs &&', '\n // NOTE: this try is NOT closed here', 'the collector-down alarm');
  if (FALSIFY) {
    body = 'const collDown = !!(cs && (cs.state === "UNREACHABLE" || cs.state === "DOWN" || cs.state === "STALLED" || cs.state === "UNCONFIG"));\n'
      + 'if (collDown) { const dk = "alrt:coll:" + new Date(Date.now()).toISOString().slice(0,10); if (!(await env.STATS.get(dk))) { const s2 = await tgAdmin(env, "Collector je PAO", {}); if (s2) await env.STATS.put(dk, "1"); } }';
  }
  // doDropletInfo and DO_DROPLET_IP are module-level in the worker, so the lifted block needs them injected.
  // droplet is settable per case: the whole point of the DigitalOcean read is that a powered-off machine and
  // a dead process must not produce the same instruction.
  let droplet = { id: 1, name: 'x', status: 'active', ip: '167.172.98.147' };
  const run = new Function('cs', 'env', 'tgAdmin', 'doDropletInfo', 'DO_DROPLET_IP', 'return (async () => {\n' + body + '\n})();');
  const go = (c, e, t) => run(c, e, t, async () => droplet, '167.172.98.147');

  const kv = new Map();
  const env = { STATS: { get: async (k) => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, v); }, delete: async (k) => { kv.delete(k); } } };
  let sent = [];
  const tgAdmin = async (_e, text) => { sent.push({ at: Date.now(), text: String(text).replace(/<[^>]+>/g, '') }); return true; };
  const DOWN = { state: 'UNREACHABLE', reason: 'unreachable', uptimeSec: 0 };
  const UP = { state: 'LIVE', reason: '', uptimeSec: 99999 };

  const realNow = Date.now;
  let T = Date.parse('2026-10-06T10:20:00Z'); // the real outage, to the minute
  Date.now = () => T;
  return (async () => {
    try {
      for (let p = 0; p < 54; p++) { await go(DOWN, env, tgAdmin); T += 10 * 60000; } // nine hours of */10 passes
      let worst = 0;
      for (let n = 1; n < sent.length; n++) worst = Math.max(worst, (sent[n].at - sent[n - 1].at) / 60000);
      chk('no silent stretch longer than three hours' + (FALSIFY ? '  [must go red]' : ''), sent.length > 1 && worst <= 180, 'worst gap ' + Math.round(worst) + ' min over ' + sent.length + ' pages');
      chk('nine hours down pages repeatedly' + (FALSIFY ? '  [must go red]' : ''), sent.length >= 6, sent.length + ' pages');
      chk('the first hour is insistent', sent.filter((s) => s.at < Date.parse('2026-10-06T11:20:00Z')).length >= 3, sent.filter((s) => s.at < Date.parse('2026-10-06T11:20:00Z')).length + ' in the first hour');
      chk('it never spams: fewer pages than cron passes', sent.length < 54, sent.length + ' of 54 passes');
      chk('a later line says how long it has been down' + (FALSIFY ? '  [must go red]' : ''), /vec .*(min|h )/.test(sent[sent.length - 1].text), JSON.stringify(sent[sent.length - 1].text.slice(0, 70)));
      chk('the FIRST line claims no duration', !/vec /.test(sent[0].text), JSON.stringify(sent[0].text.slice(0, 50)));

      sent = [];
      await go(UP, env, tgAdmin);
      chk('recovery is announced with the outage length' + (FALSIFY ? '  [must go red]' : ''), sent.length === 1 && /NAZAD/.test(sent[0].text) && /\d h /.test(sent[0].text), sent.length ? JSON.stringify(sent[0].text.slice(0, 60)) : 'nothing sent');
      chk('the down state is cleared on recovery', !kv.has('alrt:colldown'), [...kv.keys()].join(',') || '(empty)');

      sent = []; kv.clear();
      await go(UP, env, tgAdmin);
      chk('a healthy pass says nothing at all', sent.length === 0, sent.length + ' sent');

      /* THE WHOLE POINT OF THE DIGITALOCEAN READ: a powered-off machine and a dead process must not
         produce the same instruction. 2026-10-06 was the first case and we gave the second answer. */
      sent = []; kv.clear();
      droplet = { id: 1, name: 'x', status: 'off', ip: '167.172.98.147' };
      await go(DOWN, env, tgAdmin);
      const offLine = sent.length ? sent[0].text : '';
      chk('a POWERED-OFF droplet is named as such', /DROPLET JE OFF/.test(offLine), JSON.stringify(offLine.slice(-110)));
      chk('and it does NOT tell him to ssh into a machine that is not running', !/ssh root@/.test(offLine), JSON.stringify(offLine.slice(-110)));

      sent = []; kv.clear();
      droplet = { id: 1, name: 'x', status: 'active', ip: '167.172.98.147' };
      await go(DOWN, env, tgAdmin);
      const onLine = sent.length ? sent[0].text : '';
      chk('a RUNNING droplet with a dead collector gets the ssh command', /ssh root@/.test(onLine) && /pm2 restart/.test(onLine), JSON.stringify(onLine.slice(-110)));

      sent = []; kv.clear();
      droplet = { error: 'HTTP 401' };
      await go(DOWN, env, tgAdmin);
      chk('with DigitalOcean unreachable it still pages, and falls back to ssh', sent.length === 1 && /ssh root@/.test(sent[0].text), sent.length ? JSON.stringify(sent[0].text.slice(-90)) : 'nothing sent');
    } finally { Date.now = realNow; }
  })();
}

(async () => {
  try {
    await probeTests();
    await alarmTests();
  } catch (e) {
    console.error('\nHARNESS ERROR: ' + (e && e.message || e));
    process.exitCode = 1; return;
  }
  console.log('\n' + (pass + fail) + ' checks, ' + fail + ' failed' + (FALSIFY ? '   (--falsify: the checks marked [must go red] SHOULD be failing)' : ''));
  // Under --falsify a green run is the real failure: it would mean the guards cannot detect the regression.
  if (FALSIFY) process.exitCode = fail > 0 ? 0 : 1;
  else process.exitCode = fail ? 1 : 0;
})();
