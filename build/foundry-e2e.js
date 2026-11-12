/* THE FOUNDRY (2026-11-12, owner: "Squad foundry mi se svidja i moze da se uradi, ali treba da bude jako jako tesko da se mintuje svoj RNG coin").
   --pure : the RNG engine generalised to a coin config reproduces MPAD's series TO THE DIGIT (golden values recorded from the shipped code
            BEFORE the refactor, scratchpad/mpad-golden.js); a squad config gets MPAD's amplitudes and its own seed/mix; the registry makes
            lbExcluded, assetClassOf and the board SQL know a cast coin; the cost is the long campaign the owner asked for; every accrual
            hook is in place (Alloy on a server close, Signal on a lesson and an exam, Ore per raid, Spark on check-in, Flux on a spot buy
            and a thesis); the DO cast refuses in the right order; the page carries the tab and the forge call.
   --prod : a real squad of four e2e members: the treasury granted full through the admin desk, a forbidden ticker refused (BTC), a mix with
            too little chance refused, the cast; the coin in the catalogue, priced after a tick, charted by /api/klines, its page 200; a
            member opens and closes a trade on it and earns NO XP; then the coin is uncast, its series dropped, the accounts removed.
   Run: node build/foundry-e2e.js [--pure] [--prod] */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), BASE = 'https://marginpad.io';
const PURE = process.argv.includes('--pure'), PROD = process.argv.includes('--prod');
let okN = 0, failN = 0; const chk = (n, ok, x) => { ok ? okN++ : failN++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 260) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = fs.readFileSync(path.join(ROOT, 'src', 'worker.js'), 'utf8');
const strip = (s) => s.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const WS = strip(W);
const cut = (from, to) => { const a = W.indexOf(from), b = W.indexOf(to, a); if (a < 0 || b < 0) throw new Error('anchor ' + from); return W.slice(a, b); };

// ---- the engine, lifted from the shipped worker (MPAD const through the registry and the step) --------------------------------
const ENG = new Function(cut('const MPAD = {', 'function mpadIs(sym)') + '\nlet LB_EXCL_SQL = ""; function lbExclSqlBuild(){ return "x"; }\nreturn { MPAD, RNG_DRIVERS, RNG_PICK, rngCfg, rngApplyReg, rngCoinSync, RNG_REG, _mpH, _mpNoise, mpadRandLevel, mpadFine, mpadStep, mpadPxAt, mpadRound };')();
const GOLD = { h: [0.9450453724712133, 0.547219745349139, 0.49972391850315034], noise: [-0.24373825565509377, 0.23829118465073407], rand: [-0.24808605841357956, -0.2491935988098083, 0.17567961835257678], fine: [-0.00020731040088448836, -0.000300979506178761, -0.0003099532707500202], step: { px: 17.1156, step: -0.000457, parts: { dom: 0.001663, hype: -0.006211, zec: 0.003752, rand: 0.000495 } }, px: [17.1199, 17.1343] };
const M = ENG.MPAD;
const same = (a, b) => Math.abs(a - b) < 1e-15;
chk('pure: the hash is unchanged', same(ENG._mpH(1, 2), GOLD.h[0]) && same(ENG._mpH(73109, 999999), GOLD.h[1]) && same(ENG._mpH(4294967295, 7), GOLD.h[2]));
chk('pure: the noise is unchanged', same(ENG._mpNoise(73109 + 7, 123.456), GOLD.noise[0]) && same(ENG._mpNoise(1, 0.5), GOLD.noise[1]));
chk('pure: GOLDEN - MPAD random level to the digit through the generalisation', same(ENG.mpadRandLevel(M, 29880000), GOLD.rand[0]) && same(ENG.mpadRandLevel(M, 29880001), GOLD.rand[1]) && same(ENG.mpadRandLevel(M, 29912345), GOLD.rand[2]), [ENG.mpadRandLevel(M, 29880000), GOLD.rand[0]]);
chk('pure: GOLDEN - MPAD sub-minute wiggle to the digit', same(ENG.mpadFine(M, 1794500000), GOLD.fine[0]) && same(ENG.mpadFine(M, 1794500001), GOLD.fine[1]) && same(ENG.mpadFine(M, 1794506851), GOLD.fine[2]));
const st = ENG.mpadStep(M, 17.1234, { dom: 60.2, hype: 32.1, zec: 400.5 }, { dom: 60.1, hype: 32.3, zec: 399.0 }, 29900000);
chk('pure: GOLDEN - MPAD one step (price, step, every part) to the digit', st.px === GOLD.step.px && st.step === GOLD.step.step && JSON.stringify(st.parts) === JSON.stringify(GOLD.step.parts), st);
chk('pure: GOLDEN - MPAD price at a second', ENG.mpadPxAt(M, 17.1234, 1794500000) === GOLD.px[0] && ENG.mpadPxAt(M, 17.1234, 1794500037) === GOLD.px[1]);
const SQ = ENG.rngCfg({ sym: 'owls', name: 'Night Owls', start: 12, seed: 424242, mix: [{ k: 'btc', w: 0.4 }, { k: 'fng', w: 0.25 }, { k: 'xau', w: 0.2 }, { k: 'rand', w: 0.15 }], squad: { sid: 'ABC123', name: 'Owls', tag: 'OWL' } });
chk('pure: a squad config takes MPAD amplitudes, its own seed, mix and launch, an uppercased 5-letter ticker', SQ.sym === 'OWLS' && SQ.fineAmp === M.fineAmp && SQ.tick === M.tick && SQ.randAmp === M.randAmp && SQ.seed === 424242 && SQ.start === 12 && SQ.mix.length === 4 && SQ.mix[0].label === 'Bitcoin (BTC)' && SQ.lev === 100 && SQ.dp === 4, SQ);
const sqStep = ENG.mpadStep(SQ, 12, { btc: 70000, fng: 40, xau: 2600 }, { btc: 69300, fng: 38, xau: 2600 }, 29900000), sqStep2 = ENG.mpadStep(M, 12, { btc: 70000, fng: 40, xau: 2600 }, { btc: 69300, fng: 38, xau: 2600 }, 29900000);
chk('pure: the squad coin moves on ITS drivers (btc +1%, fng +5% clamped to the 3% input ceiling) and MPAD does not read them at all', sqStep.parts.btc > 0.009 && Math.abs(sqStep.parts.fng - 0.03) < 1e-9 && sqStep.px > 12 && sqStep2.parts.btc === undefined && Math.abs(sqStep2.step - sqStep2.parts.rand * 0.15) < 1e-6, { sq: sqStep, m: sqStep2 });
chk('pure: a different seed is a different random sleeve, the same seed the same one', ENG.mpadRandLevel(SQ, 29900000) !== ENG.mpadRandLevel(M, 29900000) && ENG.mpadRandLevel(SQ, 29900000) === ENG.mpadRandLevel(ENG.rngCfg({ sym: 'OWLS', seed: 424242 }), 29900000));
chk('pure: one input is clamped to 3% a minute and the whole step to 5%', (() => { const s = ENG.mpadStep(SQ, 10, { btc: 2, fng: 2, xau: 2 }, { btc: 1, fng: 1, xau: 1 }, 1); return Object.values(s.parts).every(v => Math.abs(v) <= 0.03 + 1e-9) && Math.abs(s.step) <= 0.05 + 1e-9; })());
ENG.rngApplyReg([{ sym: 'OWLS', name: 'Night Owls', start: 12, seed: 1, mix: [{ k: 'btc', w: 0.85 }, { k: 'rand', w: 0.15 }] }]);
chk('pure: the registry: rngCoinSync answers the squad coin and MPAD, __rngSyms carries the ticker, an unknown symbol is null', !!ENG.rngCoinSync('owls') && ENG.rngCoinSync('OWLSUSDT').sym === 'OWLS' && ENG.rngCoinSync('MPAD') === M && ENG.rngCoinSync('BTC') === null && globalThis.__rngSyms.has('OWLS'));
// the exclusion layer around the registry
const exclLine = (W.match(/^function lbExcluded\(sym\) \{.*$/m) || [''])[0];
const EX = new Function('const MPAD = { sym: "MPAD" };\n' + cut('const LB_EXCL_SET = new Set(', 'function lbExcluded(sym)') + '\n' + exclLine + '\nreturn { LB_EXCL_SET, lbExclSqlBuild, lbExcluded };')();
chk('pure: lbExcluded refuses the registry coin and MPAD, keeps BTC; the board SQL list is rebuilt with the ticker', EX.lbExcluded('OWLS') && EX.lbExcluded('OWLSUSDT') && EX.lbExcluded('MPAD') && !EX.lbExcluded('BTC') && /'OWLS'/.test(EX.lbExclSqlBuild()));
// the cost is the long campaign
const FD = new Function(cut('const FOUNDRY = {', '\n};') + '\n};\nreturn FOUNDRY;')();
chk('pure: the cost - 2,500 Alloy / 400 Signal / 300 Ore / 250 Flux / 350 Spark, level 5, four members, rand >= 15, three drivers >= 10 each', FD.cost.alloy === 2500 && FD.cost.signal === 400 && FD.cost.ore === 300 && FD.cost.flux === 250 && FD.cost.spark === 350 && FD.minLevel === 5 && FD.minMembers === 4 && FD.randMin === 15 && FD.mixN === 3 && FD.wMin === 10, FD.cost);
chk('pure: measured against a full five-member squad at the caps it is weeks, never a weekend (Spark >= 35 days, Alloy >= 25 days, Ore 8 cleared raids)', Math.ceil(FD.cost.spark / (5 * FD.cap.spark)) >= 35 && Math.ceil(FD.cost.alloy / (5 * FD.cap.alloy)) >= 25 && FD.cost.ore / FD.rate.raidClear >= 7.5, { spark: FD.cost.spark / (5 * FD.cap.spark), alloy: FD.cost.alloy / (5 * FD.cap.alloy), ore: FD.cost.ore / FD.rate.raidClear });
chk('pure: a ticker is 3-5 letters and the house, the majors, the venues and a few words are reserved', FD.symRe.test('OWLS') && !FD.symRe.test('OW') && !FD.symRe.test('OWLS12') && FD.reserved.indexOf('MPAD') >= 0 && FD.reserved.indexOf('BTC') >= 0 && FD.reserved.indexOf('BYBIT') >= 0);
// the hooks, each at its real site
chk('pure: Alloy accrues on a SERVER-settled close that is not a copy and not excluded', /kind === 'close' && srvAuth && !lbExcluded\(e\.sym\) && !e\.copy && \(e\.status === 'win' \|\| e\.status === 'loss'\)\) this\._fdAdd\(uid, 'alloy'/.test(WS));
chk('pure: Signal accrues on a first lesson completion and a first exam pass', /this\._fdAdd\(uid, 'signal', FOUNDRY\.rate\.lesson, 'lesson ' \+ lesson\)/.test(WS) && /this\._fdAdd\(uid, 'signal', FOUNDRY\.rate\.exam, 'exam ' \+ row\.course\)/.test(WS));
chk('pure: Ore is credited to the SQUAD per settled raid, cleared or failed', /this\._fdAddSquad\(r\.sid, 'ore', cleared \? FOUNDRY\.rate\.raidClear : FOUNDRY\.rate\.raidFail/.test(WS));
chk('pure: Spark accrues on the daily check-in, double on a 7-day streak', /this\._fdAdd\(uid, 'spark', FOUNDRY\.rate\.spark \+ \(st >= 7 \? FOUNDRY\.rate\.sparkStreak7 : 0\)/.test(WS));
chk('pure: Flux accrues on a Demo Spot buy and a published thesis (worker -> store)', /'\/foundry\/add', \{ uid, kind: 'flux', amt: \(usdC \/ 100\) \* FOUNDRY\.rate\.fluxPerUsd/.test(WS) && /'\/foundry\/add', \{ uid, kind: 'flux', amt: FOUNDRY\.rate\.thesis/.test(WS));
chk('pure: the per-member day cap is applied before a part lands (sqpartday upsert)', /sqpartday\(uid,day,kind,n\) VALUES\(\?,\?,\?,\?\) ON CONFLICT\(uid,day,kind\) DO UPDATE SET n=n\+excluded\.n/.test(WS));
const castSrc = cut("if (path === '/foundry/cast')", "return this.j({ error: 'not_found' });");
const order = ['leader_only', 'has_coin', "error: 'level'", "error: 'members'", "error: 'parts'", 'bad_sym', 'sym_taken', 'bad_start', 'bad_mix', 'rand_min', 'INSERT INTO sqcoin'].map(k => castSrc.indexOf(k));
chk('pure: the cast refuses in order - leader, one coin, level, members, parts, ticker, taken, price, mix, chance - and only then spends', order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), order);
chk('pure: the store refuses a reserved or taken ticker and the worker refuses a ticker that is a market anywhere', /FOUNDRY\.reserved\.indexOf\(sym\) >= 0 \|\| \(Array\.isArray\(b\.taken\)/.test(WS) && /if \(await rngSymTaken\(env, fsym\)\)/.test(WS) && /MAXLEV\[s\] \|\| STOCKS\[s\] \|\| FX_SYMS\[s\] \|\| IDX_SYMS\[s\] \|\| COMMOD\[s\] \|\| BYBIT_EQ\[s\]/.test(WS));
chk('pure: a cast refreshes the registry, ticks the first minute, posts a house line in the global room and the squad room', /await rngRegistryRefresh\(env\)/.test(WS) && /houseLine\(env, 'global2', line\)/.test(WS) && /houseLine\(env, 'room_' \+ String\(c\.sid\)\.toUpperCase\(\)/.test(WS));
chk('pure: the minute writer ticks MPAD and then every registry coin on the same inputs; the OpsLog routes take sym -> rngpx', /const out = await one\(MPAD\);/.test(WS) && /coins = await rngCoins\(env, true\)/.test(WS) && /INSERT OR IGNORE INTO rngpx\(sym,m,px,step,parts,inputs,ts\)/.test(WS));
chk('pure: the price, klines and the sweep feed answer a registry coin from the engine, never the cascade', /let rc = rngCoinSync\(s\);/.test(WS) && /let rcK = rngCoinSync\(sym\);/.test(WS) && /let rcL = rngCoinSync\(sym\);/.test(WS));
chk('pure: the registry is warmed every 15 s per isolate on an /api/ request, and an unknown 3-5 letter symbol refreshes it on the same clock (a coin cast on another isolate is priced within that)', /request\.url\.indexOf\('\/api\/'\) > 0 && Date\.now\(\) - RNG_REG\.at > 15000/.test(WS) && (WS.match(/Date\.now\(\) - RNG_REG\.at > 15000\) \{ try \{ await rngCoins\(/g) || []).length >= 4);
chk('pure: the UserStore fills the exclusion globals from its own sqcoin table at start and after a cast', /_rngSyncExcl\(\) \{ try \{ const rows = this\.rows\("SELECT sym FROM sqcoin WHERE status='live'"\)/.test(WS) && (WS.match(/this\._rngSyncExcl\(\);/g) || []).length >= 3);
const PG = fs.readFileSync(path.join(ROOT, 'dist', 'squads', 'index.html'), 'utf8');
chk('pure: the squads page carries the Foundry tab, the treasury bars, the cast form and the forge call', /\['foundry', __esT_squadsindex\("foundryH"/.test(PG) && /function foundrySection\(/.test(PG) && /fd-row/.test(PG) && /fetch\('\/api\/squad\/forge'/.test(PG) && /data-fdk=/.test(PG));
chk('pure: /rng/<sym>/ and /api/rng/<SYM> exist', /url\.pathname\.match\(\/\^\\\/rng\\\/\(\[A-Za-z\]\{3,5\}\)\\\/\?\$\/\)/.test(W) && /url\.pathname\.match\(\/\^\\\/api\\\/rng\\\/\(\[A-Za-z\]\{3,5\}\)\\\/\?\$\/\)/.test(W));
if (PURE) { console.log('\nfoundry-e2e: ' + okN + ' passed, ' + failN + ' failed [pure]'); process.exit(failN ? 1 : 0); }

(async () => {
  if (!PROD) { console.log('\nfoundry-e2e: ' + okN + ' passed, ' + failN + ' failed (add --prod for the live legs)'); process.exit(failN ? 1 : 0); }
  const KEY = (fs.readFileSync(path.join(ROOT, 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
  const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
  const J = (u, o) => fetch(BASE + u, o).then(r => r.json().then(j => (j.__status = r.status, j)).catch(() => ({ __status: r.status, error: 'nojson' })));
  const adm = (p, body) => J(p, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const sq = (op, uid, body) => J('/api/squad/' + op + '?uid=' + encodeURIComponent(uid), { method: 'POST', headers: H, body: JSON.stringify(body || {}) });
  const mine = uid => J('/api/squad/mine?uid=' + encodeURIComponent(uid), { headers: H });
  const tag = Date.now().toString(36).slice(-4).toUpperCase(), U = ['e2efdl' + tag.toLowerCase(), 'e2efdm1' + tag.toLowerCase(), 'e2efdm2' + tag.toLowerCase(), 'e2efdm3' + tag.toLowerCase()];
  const real = {};
  for (const u of U) { await adm('/api/admin/e2euser', { uid: u, op: 'mk' }); const who = await J('/api/admin/xpdiag?u=' + encodeURIComponent('e2e_' + u), { headers: H }); real[u] = (who.user || {}).id || u; }
  await J('/api/auth/xp/setlevel?key=' + encodeURIComponent(KEY), { method: 'POST', headers: H, body: JSON.stringify({ uid: real[U[0]], level: 'platinum', note: 'foundry-e2e' }) });
  await adm('/api/admin/ticks', { uid: real[U[0]], amt: 5000, note: 'foundry-e2e' });
  const cr = await sq('create', real[U[0]], { name: 'Foundry ' + tag, tag: 'F' + tag.slice(0, 2), crest: { shape: 'shield', sym: 'star', bg: '#2ebd85', fg: '#0a0b0d', ring: 'solid' }, open: true });
  const sid = (cr && cr.squad && cr.squad.sid) || (cr && cr.sid) || (cr && cr.id); chk('prod: the squad exists', !!sid, cr);
  // seats GROW with the level (3 at founding, 4 at level 3), so the squad level is raised through the desk BEFORE the fourth member joins
  await adm('/api/admin/foundry', { sid, sxp: 9000 });
  for (const u of U.slice(1)) { const jn = await sq('join', real[u], { sid }); if (!(jn && (jn.ok || jn.squad))) console.log('  (join answered ' + JSON.stringify(jn).slice(0, 120) + ')'); }
  const m0 = await mine(real[U[0]]);
  chk('prod: four members, a treasury at zero, forge rules published', m0.squad && m0.squad.n === 4 && m0.foundry && m0.foundry.parts.alloy === 0 && !m0.foundry.ready && m0.forge && m0.forge.drivers.length === 9, m0.foundry && { parts: m0.foundry.parts, ready: m0.foundry.ready, n: m0.squad && m0.squad.n });
  const early = await sq('forge', real[U[0]], { sym: 'ZQ' + tag.slice(0, 3), name: 'x', start: 10, mix: [{ k: 'btc', w: 40 }, { k: 'fng', w: 25 }, { k: 'xau', w: 20 }] });
  chk('prod: with an empty treasury the cast is refused for the parts (level and members already met), before the ticker is even read', early.error === 'parts', early.error);
  const grant = await adm('/api/admin/foundry', { sid, parts: { alloy: 2500, signal: 400, ore: 300, flux: 250, spark: 350 }, sxp: 9000 });
  chk('prod: the desk fills the treasury and the squad level (test hook); state reads ready', grant.ok && grant.state && grant.state.ready, grant.state && grant.state.parts);
  const taken = await sq('forge', real[U[0]], { sym: 'BTC', name: 'x', start: 10, mix: [{ k: 'btc', w: 40 }, { k: 'fng', w: 25 }, { k: 'xau', w: 20 }] });
  chk('prod: BTC is refused as a ticker (a market on the site)', taken.error === 'sym_taken', taken);
  const sym = 'Q' + tag.replace(/[^A-Z]/g, 'X').slice(0, 3) + 'Z';
  const lowRand = await sq('forge', real[U[0]], { sym, name: 'x', start: 10, mix: [{ k: 'btc', w: 50 }, { k: 'fng', w: 25 }, { k: 'xau', w: 20 }] });
  chk('prod: 95% of drivers leaves 5% to chance - refused (at least 15)', lowRand.error === 'rand_min', lowRand);
  const cast = await sq('forge', real[U[0]], { sym, name: 'Foundry Test', start: 12.5, mix: [{ k: 'btc', w: 40 }, { k: 'fng', w: 25 }, { k: 'xau', w: 20 }] });
  chk('prod: the cast - the coin exists with the mix, 15% chance, the squad named, the treasury spent', cast.ok && cast.coin && cast.coin.sym === sym && cast.coin.mix.length === 4 && Math.abs(cast.coin.mix[3].w - 0.15) < 1e-9 && cast.coin.squad && cast.coin.squad.sid === sid && cast.state && cast.state.parts.alloy === 0, cast.coin && { sym: cast.coin.sym, mix: cast.coin.mix, parts: cast.state && cast.state.parts });
  const again = await sq('forge', real[U[0]], { sym: 'ZZQXY', name: 'x', start: 10, mix: [{ k: 'btc', w: 40 }, { k: 'fng', w: 25 }, { k: 'xau', w: 20 }] });
  chk('prod: a second coin is refused - one living coin per squad', again.error === 'has_coin', again.error);
  // another isolate learns a new coin within 15 s (the unknown-symbol registry refresh) - the price and klines reads below may land on one
  await sleep(16000);
  const cat = await J('/api/mpad?cb=' + Date.now());
  chk('prod: the catalogue lists MPAD first and the new coin with its squad', cat.coins && cat.coins[0].symbol === 'MPAD' && cat.coins.some(c => c.symbol === sym && c.squad && c.squad.sid === sid), cat.coins && cat.coins.map(c => c.symbol));
  const tick = await J('/api/admin/foundry?tick=1', { headers: H });
  chk('prod: the minute writer ticked the coin (genesis at the launch price or a step)', tick.ok && tick.tick && tick.tick.coins && tick.tick.coins.some(c => c.sym === sym && c.ok), tick.tick && tick.tick.coins);
  const cj = await J('/api/rng/' + sym + '?cb=' + Date.now());
  chk('prod: /api/rng/<SYM> prices it from the engine, ranks nowhere, launch 12.5', cj.ok && cj.price > 0 && Math.abs(cj.price - 12.5) / 12.5 < 0.06 && cj.ranksOnLeaderboards === false && cj.launchPrice === 12.5 && cj.mix.length === 4, cj && { price: cj.price, launch: cj.launchPrice });
  const px = await J('/api/price?symbol=' + sym + '&cb=' + Date.now());
  chk('prod: /api/price answers the coin as house + rng from the engine', px && px.price > 0 && px.house === true && px.rng === true, px);
  const kl = await J('/api/klines?symbol=' + sym + '&interval=1&limit=5&cb=' + Date.now());
  chk('prod: /api/klines charts it (at least the genesis minute, as a bare array)', Array.isArray(kl) && kl.length >= 1 && kl[0].open > 0, Array.isArray(kl) ? kl.length : kl);
  const pg = await fetch(BASE + '/rng/' + sym.toLowerCase() + '/?cb=' + Date.now()); const pgT = await pg.text();
  chk('prod: the coin page is 200, names the squad and says it ranks nowhere', pg.status === 200 && pgT.indexOf('Foundry ' + tag) >= 0 && /ranks on no leaderboard/.test(pgT) && pgT.indexOf(sym) >= 0, pg.status);
  // a member trades it and earns nothing
  const tok = (await adm('/api/admin/e2euser', { uid: U[1], op: 'sess' })).token;
  const as = (p, o) => fetch(BASE + p, Object.assign({ headers: Object.assign({ cookie: 'mp_sess=' + tok, 'content-type': 'application/json' }, (o && o.headers) || {}) }, o || {})).then(async r => ({ st: r.status, j: await r.json().catch(() => null) }));
  const xp0 = (await J('/api/auth/xp?uid=' + encodeURIComponent(real[U[1]]) + '&fresh=1&cb=' + Date.now(), { headers: H })).xp || 0;
  const tk0 = (await mine(real[U[1]])).ticks || 0;
  const op = await as('/api/trade/open', { method: 'POST', body: JSON.stringify({ sym, side: 'long', lev: 5, margin: 100, cid: 'fd' + tag }) });
  const pid = op.j && ((op.j.position && op.j.position.id) || (op.j.raw && op.j.raw.id));
  chk('prod: a member opens a 5x long on the coin (house class, 100x cap)', op.st === 200 && !!pid, op.j && Object.keys(op.j));
  await sleep(1200);
  const cl = pid ? await as('/api/trade/close', { method: 'POST', body: JSON.stringify({ id: pid }) }) : { st: 0 };
  chk('prod: and closes it', cl.st === 200, cl.j && Object.keys(cl.j || {}));
  await sleep(1500);
  const xp1 = (await J('/api/auth/xp?uid=' + encodeURIComponent(real[U[1]]) + '&fresh=1&cb=' + Date.now(), { headers: H })).xp || 0;
  chk('prod: the close paid NO XP (the coin is excluded like MPAD)', xp1 === xp0, { xp0, xp1 });
  // the card's trade COUNT keeps it (it is the member's own book, as with MPAD); what the coin must never do is pay - XP above, Ticks here
  const tk1 = (await mine(real[U[1]])).ticks || 0;
  chk('prod: the close paid NO Ticks either', tk1 === tk0, { tk0, tk1 });
  // cleanup: the coin is uncast and its series dropped, the accounts removed (the leader's removal takes the squad)
  const un = await adm('/api/admin/foundry', { sid, uncast: true });
  // the catalogue's isolates hold a 60 s registry memo, so the coin leaves the list within a minute, not at once
  let gone = false; for (let i = 0; i < 8 && !gone; i++) { gone = !(await J('/api/mpad?cb=' + Date.now())).coins.some(c => c.symbol === sym); if (!gone) await sleep(10000); }
  chk('prod: uncast - the coin and its series are gone, and within a minute the catalogue no longer lists it', un.ok && !un.state.coin && un.dropped === sym && gone, { ok: un.ok, coin: un.state && un.state.coin, dropped: un.dropped, gone });
  for (const u of U.slice(1).concat(U.slice(0, 1))) await adm('/api/admin/e2euser', { uid: u, op: 'rm' });
  console.log('\nfoundry-e2e: ' + okN + ' passed, ' + failN + ' failed [pure+prod]');
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
