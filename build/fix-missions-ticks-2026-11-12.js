/* MISSIONS PAY TICKS AND XP, NEVER MONEY, AND EVERY MEMBER GETS THEIR OWN TEN (2026-11-12, owner: "misije mozes svima da uskladis da budu
   samo za ticks i za xp. Napravi vise misija, laksih i tezih ... solidne kolicine ticks po misiji, kao i xp-a ... misije ne treba nikog
   da placaju sa pravim novcem" + earlier "da ne dobiju svi korisnici u jednom danu misiju za chat i da ga ispamuju taj dan").
   Worker: a new MISSION_POOL (three tiers, 60 missions), missionsForDay(day, uid, opts) seeded per member with a 3-day cooldown,
   handleMissions without the ledger, the DO claim paying the amounts the worker names, five new verifiers. Pages: /rewards/ renders
   Ticks + XP, every public sentence about the faucet is gone (new accounts should not learn it exists - the legacy UI stays JS-gated).
   One-shot with asserts; re-running on patched files reports the anchors gone.   node build/fix-missions-ticks-2026-11-12.js [--dry] */
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), DRY = process.argv.includes('--dry');
function rw(rel, fn) { const f = path.join(R, rel); let s = fs.readFileSync(f, 'utf8'); const o = s; s = fn(s); if (s !== o && !DRY) { fs.writeFileSync(f + '.tmp', s); fs.renameSync(f + '.tmp', f); } console.log((s !== o ? 'patched ' : 'unchanged ') + rel); }
function one(s, a, b, what) { const n = s.split(a).length - 1; if (n !== 1) { if (n === 0 && s.indexOf(b.slice(0, 60)) >= 0) { console.log('  already:', what); return s; } throw new Error(what + ': anchor x' + n); } return s.split(a).join(b); }
function between(s, a, b, repl, what) { const i = s.indexOf(a), j = s.indexOf(b, i); if (i < 0 || j < 0) { if (s.indexOf(repl.slice(0, 80)) >= 0) { console.log('  already:', what); return s; } throw new Error(what + ': anchors'); } return s.slice(0, i) + repl + s.slice(j); }

const POOL = `const MISSION_POOL = [
  /* THREE TIERS, NO MONEY (2026-11-12). tier e = a look (pageviews, one trade): 5 Ticks / 10 XP; m = an action: 12 / 25; h = a result that takes the day:
     30 / 60. A day holds 4 + 4 + 2, picked PER MEMBER (missionsForDay seeds on the uid) with a three-day cooldown, so no two members farm the same
     thing on the same day and nobody sees a mission twice in a row. Verified server-side as before: vt/va/n are what the DO checks. cat = per-day
     category quota (CAPS in missionsForDay). The Telegram trio is tier e and ONCE per account. */
  { mid: 'trade1', title: 'Open a paper trade', desc: 'One trade, zero risk. In here, the market can’t hurt you', tier: 'e', vt: 'ev', va: 'paper', n: 1, cat: 'trade' },
  { mid: 'checkin', title: 'Check in today', desc: 'Show up. The streak is the whole game', tier: 'e', vt: 'xpsrc', va: 'checkin', n: 1, cat: 'core' },
  { mid: 'tgsignals', title: 'Join our free Telegram channel', desc: 'The daily market wrap at 16:00 UTC - prices, liquidations and the next macro event', tier: 'e', vt: 'ev', va: 'tgsig', n: 1, cat: 'promo2', url: 'https://t.me/marginpad' },
  { mid: 'tgnews', title: 'Follow our Telegram news channel', desc: 'Crypto headlines the minute they drop - ahead of your P&L', tier: 'e', vt: 'ev', va: 'tgnews', n: 1, cat: 'promo2', url: 'https://t.me/marginpadnews' },
  { mid: 'tgbot', title: 'Open the MarginPad Telegram bot', desc: 'Live prices, alerts and signals right in your DMs', tier: 'e', vt: 'ev', va: 'tgbot', n: 1, cat: 'promo2', url: 'https://t.me/MarginPadBot' },
  { mid: 'watch', title: 'Add a coin to your watchlist', desc: 'Star it now, thank yourself on the breakout', tier: 'e', vt: 'ev', va: 'watch', n: 1, cat: 'market' },
  { mid: 'profile', title: "Check out a trader's profile", desc: 'Open a trader card - see how the ranked ones do it', tier: 'e', vt: 'ev', va: 'profile', n: 1, cat: 'social' },
  { mid: 'like', title: 'Like a community post', desc: 'Someone wrote something decent - tell them', tier: 'e', vt: 'ev', va: 'like', n: 1, cat: 'community' },
  { mid: 'community', title: 'Visit the Community', desc: 'See what the floor is posting today', tier: 'e', vt: 'pv', va: '/community', n: 1, cat: 'community' },
  { mid: 'academyvisit', title: 'Open the Academy', desc: 'Your path is where you left it. It waited', tier: 'e', vt: 'pv', va: '/academy', n: 1, cat: 'academy' },
  { mid: 'heatvisit', title: 'Read the liquidation map', desc: 'See where the stop-hunts are loaded before you trade', tier: 'e', vt: 'pv', va: '/heatmap', n: 1, cat: 'market', url: '/heatmap' },
  { mid: 'coins', title: 'Browse the coins market', desc: 'Scan the top of the market - know the terrain', tier: 'e', vt: 'pv', va: '/coins', n: 1, cat: 'market' },
  { mid: 'news', title: 'Read the crypto news', desc: 'Read the headlines before they read your P&L', tier: 'e', vt: 'pv', va: '/news', n: 1, cat: 'market' },
  { mid: 'screener', title: 'Scan the market screener', desc: 'Find out who’s pumping and who’s bleeding right now', tier: 'e', vt: 'pv', va: '/screener', n: 1, cat: 'market' },
  { mid: 'calendar', title: 'Check the economic calendar', desc: 'Know when the market has chaos scheduled this week', tier: 'e', vt: 'pv', va: '/calendar', n: 1, cat: 'market' },
  { mid: 'funding', title: 'Check funding rates', desc: 'See which side of the boat is overloaded', tier: 'e', vt: 'pv', va: '/funding', n: 1, cat: 'market' },
  { mid: 'feargreed', title: 'Check the Fear & Greed index', desc: 'Check the market’s mood ring', tier: 'e', vt: 'pv', va: '/fear-greed', n: 1, cat: 'market' },
  { mid: 'calc', title: 'Use a trading calculator', desc: 'Do the math before the market does it to you', tier: 'e', vt: 'pv', va: '/calculators', n: 1, cat: 'market' },
  { mid: 'charts', title: 'Open the charts workspace', desc: 'Chart something - indicators, drawings, the works', tier: 'e', vt: 'pv', va: '/charts', n: 1, cat: 'market' },
  { mid: 'levels', title: 'Check the XP leaderboard', desc: 'See where you rank. Then go fix it', tier: 'e', vt: 'pv', va: '/levels', n: 1, cat: 'market' },
  { mid: 'leaderboards', title: 'Check the season leaderboards', desc: 'Ten boards, real prizes - see who is ahead this season', tier: 'e', vt: 'pv', va: '/leaderboards', n: 1, cat: 'market' },
  { mid: 'defi', title: 'Explore DeFi TVL', desc: 'See which chains actually hold the money', tier: 'e', vt: 'pv', va: '/defi', n: 1, cat: 'market' },
  { mid: 'longshort', title: 'Check the long/short ratio', desc: 'Longs vs shorts - see which crowd is braver', tier: 'e', vt: 'pv', va: '/long-short', n: 1, cat: 'market' },
  { mid: 'catalysts', title: 'Read what moved the market', desc: 'Every big move of the day, with its measured cause', tier: 'e', vt: 'pv', va: '/catalysts', n: 1, cat: 'market' },
  { mid: 'alertshub', title: 'Open the alerts hub', desc: 'Every alert on one page - see which ones you are missing', tier: 'e', vt: 'pv', va: '/alerts', n: 1, cat: 'market' },
  { mid: 'glossary', title: 'Open the glossary', desc: 'Sixty terms, live numbers next to the ones we measure', tier: 'e', vt: 'pv', va: '/glossary', n: 1, cat: 'academy' },
  { mid: 'squads', title: 'Look at the squads', desc: 'Raids, duels and a private room - see who is recruiting', tier: 'e', vt: 'pv', va: '/squads', n: 1, cat: 'social' },
  { mid: 'vault', title: 'Browse MP Shop', desc: 'Frames, ticket skins, backgrounds - see what your Ticks buy', tier: 'e', vt: 'pv', va: '/vault', n: 1, cat: 'market' },
  { mid: 'rekt', title: 'Watch the liquidations feed', desc: 'See who got rekt in real time - and learn from it', tier: 'e', vt: 'pv', va: '/rekt', n: 1, cat: 'market' },
  { mid: 'spotvisit', title: 'Open Demo Spot', desc: 'The buy-and-hold side of the house - no leverage, no liquidations', tier: 'e', vt: 'pv', va: '/spot', n: 1, cat: 'market' },
  { mid: 'exchanges', title: 'Compare the exchanges', desc: 'Fees, leverage, funding - know where the edge is', tier: 'e', vt: 'pv', va: '/exchanges', n: 1, cat: 'market' },
  { mid: 'cycle', title: 'Check the Bitcoin cycle', desc: 'Where are we in the four-year story? Look before you size up', tier: 'e', vt: 'pv', va: '/bitcoin-cycle', n: 1, cat: 'market' },
  { mid: 'journalvisit', title: 'Open the trading journal', desc: 'Your trades, your stats - review before you repeat', tier: 'e', vt: 'pv', va: '/trading-journal', n: 1, cat: 'market' },
  { mid: 'backtest', title: 'Open the strategy library', desc: 'Test the idea on history before it tests your balance', tier: 'e', vt: 'pv', va: '/strategies', n: 1, cat: 'market' },
  // tier m - an action
  { mid: 'trade3', title: 'Open 3 paper trades', desc: 'Three reps today - repetition is how instinct gets built', tier: 'm', vt: 'ev', va: 'paper', n: 3, cat: 'trade' },
  { mid: 'trade5', title: 'Open 5 paper trades', desc: 'Five reps. Around the fifth one, the panic goes quiet', tier: 'm', vt: 'ev', va: 'paper', n: 5, cat: 'trade' },
  { mid: 'win', title: 'Close a winning trade', desc: 'Get one into the green and actually take it. Banked beats brilliant', tier: 'm', vt: 'win', va: '', n: 1, cat: 'trade' },
  { mid: 'sltp', title: 'Set a stop-loss or take-profit', desc: 'Pick your exit before the market picks one for you', tier: 'm', vt: 'ev', va: 'sltp', n: 1, cat: 'trade' },
  { mid: 'sltp2', title: 'Set SL/TP on 2 trades', desc: 'Two planned trades. Hope is not an exit strategy', tier: 'm', vt: 'ev', va: 'sltp', n: 2, cat: 'trade' },
  { mid: 'follow', title: 'Follow a trader', desc: 'Scout the board - follow someone worth studying', tier: 'm', vt: 'follow', va: '', n: 1, cat: 'social' },
  { mid: 'dm', title: 'Message a trader', desc: 'Slide into a trader’s DMs. Strictly charts', tier: 'm', vt: 'dm', va: '', n: 1, cat: 'social' },
  { mid: 'duel', title: 'Challenge a trader to a duel', desc: 'Seven days, best stats win. Pick your opponent', tier: 'm', vt: 'duel', va: '', n: 1, cat: 'social' },
  { mid: 'share', title: 'Share a trade card', desc: 'Show the floor your win - or your tuition', tier: 'm', vt: 'ev', va: 'share', n: 1, cat: 'social' },
  { mid: 'compost', title: 'Post or comment in the Community', desc: 'Share a setup or roast one - the floor decides', tier: 'm', vt: 'comm', va: '', n: 1, cat: 'community' },
  { mid: 'academy', title: 'Finish an Academy lesson', desc: 'One lesson closer to knowing why you win', tier: 'm', vt: 'academy', va: '', n: 1, cat: 'academy' },
  { mid: 'academy2', title: 'Finish 2 Academy lessons', desc: 'Two lessons. Your future entries will thank you', tier: 'm', vt: 'academy', va: '', n: 2, cat: 'academy' },
  { mid: 'review', title: 'Finish the Academy daily review', desc: 'Five questions from lessons you already passed. Memory is a muscle', tier: 'm', vt: 'review', va: '', n: 1, cat: 'academy' },
  { mid: 'spotbuy', title: 'Buy a coin in Demo Spot', desc: 'Spot is buy-and-hold: no leverage, no liquidations, a real fee on every fill', tier: 'm', vt: 'ev', va: 'spotbuy', n: 1, cat: 'market' },
  { mid: 'spotsell', title: 'Sell a coin in Demo Spot', desc: 'Take a profit or cut a loss - exits are the skill', tier: 'm', vt: 'ev', va: 'spotsell', n: 1, cat: 'market' },
  { mid: 'alert', title: 'Set a price alert', desc: 'Pick your level and let the site watch the chart for you', tier: 'm', vt: 'ev', va: 'alert', n: 1, cat: 'market' },
  { mid: 'ai', title: 'Ask the AI about a chart', desc: 'Get a second opinion before you click', tier: 'm', vt: 'ev', va: 'ai', n: 1, cat: 'market' },
  { mid: 'draw', title: 'Draw on a chart', desc: 'Mark a level - trade lines, not vibes', tier: 'm', vt: 'ev', va: 'draw', n: 1, cat: 'market' },
  // tier h - a result that takes the day
  { mid: 'win2', title: 'Close 2 winning trades', desc: 'Two green closes. Winners are decisions, not luck', tier: 'h', vt: 'win', va: '', n: 2, cat: 'trade' },
  { mid: 'win3', title: 'Close 3 winning trades', desc: 'Three in the green on one day. That is a process, not a mood', tier: 'h', vt: 'win', va: '', n: 3, cat: 'trade' },
  { mid: 'winsl', title: 'Close 2 winners with a stop set', desc: 'Planned exits that paid. The stop is what made them trades', tier: 'h', vt: 'winsl', va: '', n: 2, cat: 'trade' },
  { mid: 'winheld', title: 'Close a winner you held 4 hours or more', desc: 'Sit through the noise and take it at your level, not the first green tick', tier: 'h', vt: 'winheld', va: '', n: 1, cat: 'trade' },
  { mid: 'coins4', title: 'Trade 4 different coins today', desc: 'Open and close on four markets - range beats a lucky favourite', tier: 'h', vt: 'coins', va: '', n: 4, cat: 'trade' },
  { mid: 'trade10', title: 'Open 10 paper trades', desc: 'Ten reps. Volume is where the habits show', tier: 'h', vt: 'ev', va: 'paper', n: 10, cat: 'trade' },
  { mid: 'tradexp', title: 'Earn 50 XP from your trades today', desc: 'Wins pay XP. Fifty of it means several good closes', tier: 'h', vt: 'xpsum', va: 'trade,trade_win', n: 50, cat: 'trade' },
  { mid: 'academy3', title: 'Finish 3 Academy lessons', desc: 'Three lessons in one day - a proper study session', tier: 'h', vt: 'academy', va: '', n: 3, cat: 'academy' },
  { mid: 'academy5', title: 'Finish 5 Academy lessons', desc: 'Half a course in a day. The exam will feel easy', tier: 'h', vt: 'academy', va: '', n: 5, cat: 'academy' },
  { mid: 'exam', title: 'Pass an Academy final exam', desc: 'Ten questions, eight to pass, twelve minutes. Prove the course stuck', tier: 'h', vt: 'exam', va: '', n: 1, cat: 'academy' },
  { mid: 'duelwin', title: 'Win a duel', desc: 'Any format - take the pot and the bragging rights', tier: 'h', vt: 'duelw', va: '', n: 1, cat: 'social' },
  { mid: 'duel2', title: 'Challenge 2 traders to a duel', desc: 'Two opponents, two weeks of pressure', tier: 'h', vt: 'duel', va: '', n: 2, cat: 'social' },
  { mid: 'follower', title: 'Get a new follower', desc: 'Trade, post, talk - be worth following today', tier: 'h', vt: 'follower', va: '', n: 1, cat: 'social' },
  { mid: 'followers2', title: 'Gain 2 new followers', desc: 'Two people decided you are worth watching. Earn a third', tier: 'h', vt: 'follower', va: '', n: 2, cat: 'social' },
  { mid: 'streak7', title: 'Hold a 7-day check-in streak', desc: 'Seven days in a row. Consistency is the rarest edge', tier: 'h', vt: 'streak', va: '', n: 7, cat: 'core' },
];
const MISSION_PAY = { e: { t: 5, xp: 10 }, m: { t: 12, xp: 25 }, h: { t: 30, xp: 60 } }; // Ticks / XP per tier - the ONE table the claim pays from
const MISSION_DAY = { e: 4, m: 4, h: 2 };                                            // ten a day: 128 Ticks and 260 XP at a full clear
const MISSION_SET = { n: 8, xp: 60 };                                                // 8 of 10 -> +60 XP (the set bonus has paid XP since 2026-09-29)
const MISSION_WEEK = { n: 25, t: 100 };                                              // 25 claims since Monday -> +100 Ticks once a week
const MISSION_COOLDOWN_DAYS = 3;
function missionPay(m) { return MISSION_PAY[m.tier] || MISSION_PAY.e; }
// mulberry32 - tiny deterministic PRNG so a member's missions are STABLE within a day (claims re-derive the set) but differ from day to day and member to member
function _missionRng(seed) { let s = (seed ^ 0x9e3779b9) >>> 0; return function () { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function _missionHash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function missionsForDay(day, uid, opts) { // the day's ten for ONE member: 4 e + 4 m + 2 h, category-capped, nothing they were offered in the last three days
  if (uid && typeof uid === 'object') { opts = uid; uid = ''; } // old callers passed (day, opts)
  opts = opts || {}; uid = String(uid || '');
  const CAPS = { trade: 4, social: 3, academy: 2, community: 2, market: 4, core: 1, promo2: 1 };
  const skip = (m) => (opts.academyDone && m.vt === 'academy') || (opts.nonPremium && m.va === 'ai');
  const dayN = Math.floor(Date.parse(day) / 86400000);
  const pick = (d, excl) => { // the base set for (member, day d) - deterministic; excl = ids on cooldown
    const dstr = new Date(d * 86400000).toISOString().slice(0, 10);
    const rnd = _missionRng((parseInt(dstr.replace(/-/g, ''), 10) || 0) ^ _missionHash(uid));
    const pool = MISSION_POOL.filter(m => m.cat !== 'promo2' && !skip(m)); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    const used = {}, out = [];
    const take = (tier, want, allowExcl) => { for (const m of pool) { if (out.length >= 10 || want <= 0) break; if (m.tier !== tier || out.indexOf(m) >= 0) continue; if (!allowExcl && excl.has(m.mid)) continue; const c = m.cat || 'market'; if ((used[c] || 0) >= (CAPS[c] != null ? CAPS[c] : 2)) continue; used[c] = (used[c] || 0) + 1; out.push(m); want--; } return want; };
    for (const tier of ['h', 'm', 'e']) { let left = take(tier, MISSION_DAY[tier], false); if (left > 0) left = take(tier, left, true); if (left > 0) for (const m of pool) { if (left <= 0) break; if (m.tier === tier && out.indexOf(m) < 0) { out.push(m); left--; } } } // caps relaxed, then cooldown relaxed - never under-fill
    return out;
  };
  const excl = new Set(); for (let k = 1; k <= MISSION_COOLDOWN_DAYS; k++) for (const m of pick(dayN - k, new Set())) excl.add(m.mid);
  const set = pick(dayN, excl);
  if (!opts.promoDone) { // the Telegram trio, ONE a day on a 3-day cycle, once per account: it takes an easy slot so the day is still ten
    const PROMO2 = ['tgsignals', 'tgnews', 'tgbot']; const pm = MISSION_POOL.find(m => m.mid === PROMO2[dayN % 3]);
    if (pm) { const i = set.map(m => m.tier).lastIndexOf('e'); if (i >= 0) set[i] = pm; else set.push(pm); }
  }
  return set;
}
`;

rw('src/worker.js', (s) => {
  s = between(s, 'const MISSION_POOL = [', '// ---------- Academy: Duolingo-style', POOL, 'MISSION_POOL + missionsForDay');
  // the mission half of handleMissions, from the bonus constants to the end of the function
  const START = '  const SET_N = 5, SET_CENTS = 0, SET_XP = 60, WEEK_N = 15, WEEK_CENTS = 5, MISSION_TICKS = 4;';
  const i = s.indexOf(START); if (i >= 0) {
    const END = "weekClaimed: !!meta9.weekClaimed } });\n}\n"; const j = s.indexOf(END, i); if (j < 0) throw new Error('handleMissions end');
    s = s.slice(0, i) + `  const SET_N = MISSION_SET.n, SET_XP = MISSION_SET.xp, WEEK_N = MISSION_WEEK.n, WEEK_T = MISSION_WEEK.t; /* 2026-11-12: missions pay Ticks + XP for EVERY member and never a cent; the ledger is not called here any more */
  const wkFrom = new Date(dayStart - ((new Date(dayStart).getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10); // this week's Monday (UTC)
  const wkMid = 'wk' + wkFrom.replace(/-/g, '');
  let uid = '', uxp = 0;
  const tok = getCookie(request, SESS_COOKIE);
  if (tok && env.USERS) { const su = await sessionUser(env, tok); if (su && su.id) { uid = su.id; uxp = +su.xp || 0; } }
  const adminUid = url.searchParams.get('uid'); // owner preview/testing: act as a user (admin cookie only)
  if (adminUid && (await adminCookieOk(request, env))) { uid = adminUid; uxp = REWARDS_MIN_XP; }
  if (!enabled) return jr({ enabled: false, missions: [] });
  if (!uid) return jr({ enabled: true, signedIn: false, missions: [], day }); // missions are NOT available to logged-out users
  const rewardsLocked = (cfg.raw ? cfg.raw.levelsEnabled !== false : true) && !rewardsUnlocked(uxp);
  if (rewardsLocked) {
    if (request.method === 'POST') return jr({ error: 'need_xp', need: REWARDS_MIN_XP, have: uxp, level: 'unranked', earn: '/academy/' }, 403);
    return jr({ enabled: true, signedIn: true, locked: true, minXp: REWARDS_MIN_XP, xp: uxp, missions: [], day, resetInMs: (dayStart + 86400000) - Date.now() });
  }
  let meta9 = { n: 0, weekClaimed: false, setClaimed: false, promoDone: false };
  try { const r = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/missions/meta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid, fromDay: wkFrom, day }) })); meta9 = await r.json(); } catch (e) {}
  let defs = missionsForDay(day, uid, { promoDone: !!meta9.promoDone });
  // a member who FINISHED the Academy gets no lesson missions; a non-Premium member no Ask-AI one - both feed ONE deterministic re-derivation
  const mo = { promoDone: !!meta9.promoDone };
  if (defs.some(m => m.vt === 'academy')) { try { const ar = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/academy/state?uid=' + encodeURIComponent(uid))); const done = ((await ar.json()) || {}).done || []; if (done.filter(x => !String(x).startsWith('course:')).length >= ACAD_TOTAL_LESSONS) mo.academyDone = true; } catch (e) {} }
  if (defs.some(m => m.va === 'ai')) { try { if (!(await premiumFor(env, request)).premium) mo.nonPremium = true; } catch (e) {} }
  if (Object.keys(mo).length > 1) defs = missionsForDay(day, uid, mo);
  const evDefs = defs.filter(m => m.vt !== 'comm').map(m => ({ mid: m.mid, vt: m.vt, va: m.va, n: m.n }));
  let st = { done: {}, claimed: {} };
  try { const r = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/missions/state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid, day, dayStart, defs: evDefs }) })); st = await r.json(); } catch (e) {}
  for (const m of defs) if (m.vt === 'comm') {
    try { const r = await env.COMM.get(env.COMM.idFromName('main')).fetch(new Request('https://do/activity', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid, fromTs: dayStart }) })); const d = await r.json(); st.done[m.mid] = ((d.posts || 0) + (d.comments || 0)) >= (m.n || 1); } catch (e) {}
  }
  const missions = defs.map(m => { const p = missionPay(m); return { mid: m.mid, title: m.title, desc: m.desc, tier: m.tier, ticks: p.t, xp: p.xp, url: m.url || undefined, done: !!(st.done && st.done[m.mid]), claimed: !!(st.claimed && st.claimed[m.mid]) }; });
  const bonus = () => ({ setN: SET_N, setXp: SET_XP, setClaimed: !!meta9.setClaimed, weekN: WEEK_N, weekTicks: WEEK_T, weekCount: +meta9.n || 0, weekClaimed: !!meta9.weekClaimed });
  if (request.method === 'POST') {
    let b = {}; try { b = await request.json(); } catch (e) {}
    const mid = String(b.mid || '');
    const m = defs.find(x => x.mid === mid);
    if (!m) return jr({ error: 'bad_mission' }, 400);
    if (!st.done[mid]) return jr({ error: 'not_done' }, 400);
    if (st.claimed[mid]) return jr({ error: 'already_claimed' }, 400);
    const pay = missionPay(m);
    const claimDO = (body) => env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/missions/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ uid, day }, body)) })).then(r => r.json());
    let fresh = false, gotXp = 0, gotT = 0;
    try { const d = await claimDO({ mid, ticks: pay.t, xp: pay.xp }); fresh = !!d.fresh; gotXp = +d.xp || 0; gotT = +d.ticks || 0; } catch (e) { return jr({ error: 'busy' }, 503); }
    if (!fresh) return jr({ error: 'already_claimed' }, 400);
    try { await evPush(env, request, 'mission', mid + ' +' + gotT + ' T +' + gotXp + ' XP', '/rewards/'); } catch (e) {}
    // SET BONUS: the 8th claim of the day pays XP once - idempotent through the same missions-table dedup (mid 'setbonus')
    let setBonusXp = 0, weekBonusT = 0;
    const claimedNow = defs.filter(x => st.claimed && st.claimed[x.mid]).length + 1;
    if (claimedNow >= SET_N) { try { const d2 = await claimDO({ mid: 'setbonus', ticks: 0, xp: SET_XP }); if (d2 && d2.fresh) { setBonusXp = +d2.xp || SET_XP; meta9.setClaimed = true; try { await evPush(env, request, 'mission', 'set bonus +' + setBonusXp + ' XP', '/rewards/'); } catch (e) {} } } catch (e) {} }
    // WEEKLY BONUS: 25 real claims since Monday pays Ticks once per week (mid 'wkYYYYMMDD', same dedup)
    try {
      const md = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/missions/meta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid, fromDay: wkFrom, day }) })).then(r => r.json());
      meta9.n = +md.n || 0; meta9.weekClaimed = !!md.weekClaimed;
      if (meta9.n >= WEEK_N && !meta9.weekClaimed) { const d3 = await claimDO({ mid: wkMid, ticks: WEEK_T, xp: 0 }); if (d3 && d3.fresh) { weekBonusT = +d3.ticks || WEEK_T; meta9.weekClaimed = true; try { await evPush(env, request, 'mission', 'weekly bonus +' + weekBonusT + ' T', '/rewards/'); } catch (e) {} } }
    } catch (e) {}
    const upd = missions.map(x => x.mid === mid ? { ...x, claimed: true } : x);
    return jr({ ok: true, ticks: gotT, xp: gotXp, missions: upd, day, bonusXp: gotXp || undefined, setBonusXp: setBonusXp || undefined, weekBonusTicks: weekBonusT || undefined, bonus: bonus() });
  }
  return jr({ enabled: true, signedIn: true, missions, day, resetInMs: (dayStart + 86400000) - Date.now(), bonus: bonus() });
}
` + s.slice(j + END.length);
  } else console.log('  already: handleMissions');
  // the DO claim pays what the worker names (ticks/xp in the body); the old 4 T + mystery XP stays for a caller that names nothing
  s = one(s, "      const mxp = mid === 'setbonus' ? 60 : mid.indexOf('wk') === 0 ? 25 : (10 + Math.floor(Math.random() * 51));",
    "      const mxp = (b.xp != null) ? Math.max(0, Math.min(200, Math.round(+b.xp || 0))) : mid === 'setbonus' ? 60 : mid.indexOf('wk') === 0 ? 25 : (10 + Math.floor(Math.random() * 51)); // 2026-11-12: the worker names the tier's XP; the old mystery roll is the fallback\n      const mt = (b.ticks != null) ? Math.max(0, Math.min(200, Math.round(+b.ticks || 0))) : (mid !== 'setbonus' && mid.indexOf('wk') !== 0 ? 4 : 0);", 'DO claim amounts');
  s = one(s, "      sql.exec('INSERT INTO missions(user_id,day,mid,ts) VALUES(?,?,?,?)', uid, day, mid, now); try { this._grantXp(uid, 'mission', mxp, { dayCap: 320, note: 'mission ' + mid }); } catch (me) {}\n      if (mid !== 'setbonus' && mid.indexOf('wk') !== 0) { try { this._grantTicks(uid, 'mission', 4, { dayCap: TICK_CAP.mission, note: 'mission claimed' }); } catch (me2) {} }",
    "      sql.exec('INSERT INTO missions(user_id,day,mid,ts) VALUES(?,?,?,?)', uid, day, mid, now); if (mxp > 0) { try { this._grantXp(uid, 'mission', mxp, { dayCap: 320, note: 'mission ' + mid }); } catch (me) {} }\n      if (mt > 0) { try { this._grantTicks(uid, 'mission', mt, { dayCap: TICK_CAP.mission, note: 'mission ' + mid }); } catch (me2) {} }", 'DO claim grants');
  s = one(s, "      return this.j({ ok: true, fresh: true, xp: mxp });\n    }\n    if (path === '/bronze/state') {", "      return this.j({ ok: true, fresh: true, xp: mxp, ticks: mt });\n    }\n    if (path === '/bronze/state') {", 'DO claim return');
  // new verifiers in the DAY path (the lifetime Bronze path keeps its own list)
  s = one(s, "          else if (d.vt === 'academy') c = (this.rows(\"SELECT COUNT(*) n FROM academy WHERE user_id=? AND ts>=? AND lesson NOT LIKE 'course:%'\", uid, dayStart)[0] || {}).n || 0;\n        } catch (e) {}\n        done[d.mid] = c >= (d.n || 1);",
    `          else if (d.vt === 'academy') c = (this.rows("SELECT COUNT(*) n FROM academy WHERE user_id=? AND ts>=? AND lesson NOT LIKE 'course:%'", uid, dayStart)[0] || {}).n || 0;
          // 2026-11-12 tiers: results that take the day, every one read off a table the action itself writes
          else if (d.vt === 'xpsrc') c = (this.rows('SELECT COUNT(*) n FROM xplog WHERE user_id=? AND ts>=? AND src=?', uid, dayStart, String(d.va))[0] || {}).n || 0;
          else if (d.vt === 'xpsum') { const srcs = String(d.va || '').split(',').filter(Boolean); c = srcs.length ? ((this.rows('SELECT COALESCE(SUM(amt),0) s FROM xplog WHERE user_id=? AND ts>=? AND src IN (' + srcs.map(() => '?').join(',') + ')', uid, dayStart, ...srcs)[0] || {}).s || 0) : 0; }
          else if (d.vt === 'coins') c = (this.rows("SELECT COUNT(DISTINCT sym) n FROM tradeev WHERE user_id=? AND kind='close' AND ts>=?", uid, dayStart)[0] || {}).n || 0;
          else if (d.vt === 'winsl') c = (this.rows("SELECT COUNT(*) n FROM tradeev WHERE user_id=? AND kind='close' AND pnl>0 AND COALESCE(sl,0)=1 AND ts>=?", uid, dayStart)[0] || {}).n || 0;
          else if (d.vt === 'winheld') { c = 0; for (const r of this.rows("SELECT ts, sym FROM tradeev WHERE user_id=? AND kind='close' AND pnl>0 AND ts>=?", uid, dayStart)) { const o = this.rows("SELECT MAX(ts) t FROM tradeev WHERE user_id=? AND kind='open' AND sym=? AND ts<?", uid, r.sym, r.ts)[0]; if (o && o.t && r.ts - o.t >= 4 * 3600000) c++; } }
          else if (d.vt === 'exam') c = (this.rows("SELECT COUNT(*) n FROM acadexam WHERE user_id=? AND status='pass' AND ts>=?", uid, dayStart)[0] || {}).n || 0;
          else if (d.vt === 'review') c = (this.rows('SELECT COUNT(*) n FROM acadrevday WHERE user_id=? AND day=? AND ok=1', uid, Math.floor(dayStart / 864e5))[0] || {}).n || 0;
          else if (d.vt === 'streak') c = +((this.rows('SELECT streak FROM users WHERE id=?', uid)[0] || {}).streak || 0);
        } catch (e) {}
        done[d.mid] = c >= (d.n || 1);`, 'DO day verifiers');
  s = one(s, "  { k: 'mission', label: 'Missions claimed', cap: 28 },", "  { k: 'mission', label: 'Missions claimed', cap: 240 }, // 2026-11-12: ten tiered missions (4x5 + 4x12 + 2x30 = 128 T) + the 100 T weekly bonus on the day it lands", 'TICK_CAP.mission');
  s = one(s, "data.items.push({ type: 'mission', usd: (def ? def.cents : 0) / 100,", "data.items.push({ type: 'mission', usd: ((def && def.cents) || 0) / 100,", 'earnings cents guard');
  // the faucet refusal says nothing a new account should learn
  s = one(s, "  if (path === '/claim' && acct && !suLegacy) return jr({ error: 'faucet_closed', message: 'The faucet is only for accounts opened before 12 Nov 2026. Earn on the season leaderboards, the Season Pass, promo codes and partner sign-up bonuses.', earn: '/leaderboards/' }, 403);",
    "  if (path === '/claim' && acct && !suLegacy) return jr({ error: 'not_available' }, 404); // nothing to explain: a newer account never saw a faucet", 'faucet refusal');
  return s;
});

/* ---------------- pages: Ticks + XP on the mission card, and no public word about the faucet ---------------- */
rw('dist/rewards/index.html', (s) => {
  s = one(s, "      var rw=(m.cents>0)?fmt2(m.cents):((m.ticks||d.ticks||4)+' T');", "      var rw='+'+(m.ticks||0)+' T \\u00b7 +'+(m.xp||0)+' XP';", 'mission reward');
  s = one(s, "      var b9=d.bonus||{};var sN=+b9.setN||5,sU=(+b9.setUsd||0).toFixed(2),sX=+b9.setXp||60,wN9=+b9.weekN||15,wU=(+b9.weekUsd||0.05).toFixed(2),wC=+b9.weekCount||0;",
    "      var b9=d.bonus||{};var sN=+b9.setN||8,sU='0.00',sX=+b9.setXp||60,wN9=+b9.weekN||25,wT=+b9.weekTicks||100,wC=+b9.weekCount||0;", 'bonus vars');
  s = one(s, "      if(wt)wt.innerHTML=(+wU<=0)?(wC+'/'+wN9+' this week'):b9.weekClaimed?'<span style=\"color:#c2f64a\">+$'+wU+' PAID</span>':(wC+'/'+wN9+' \\u2192 +$'+wU);",
    "      if(wt)wt.innerHTML=b9.weekClaimed?'<span style=\"color:#c2f64a\">+'+wT+' T PAID</span>':(wC+'/'+wN9+' \\u2192 +'+wT+' T');", 'weekly text');
  s = one(s, "      var wb=document.getElementById('msnWkBar');if(wb)wb.style.width=Math.min(100,Math.round(wC/(wN9||15)*100))+'%';", "      var wb=document.getElementById('msnWkBar');if(wb)wb.style.width=Math.min(100,Math.round(wC/(wN9||25)*100))+'%';", 'weekly bar');
  // the FAQ item that named the faucet, and the legacy sentences that explained it to a guest reading the source
  s = s.replace(/,\{"@type":"Question","name":"What happened to the faucet\?","acceptedAnswer":\{"@type":"Answer","text":"[^"]*"\}\}/, () => '');
  s = one(s, '<span class="fcl-only"> Your account also keeps the faucet: claim <b id="eaAmt">$0.01</b> every few minutes.</span>', '<span class="fcl-only"> Your account also claims <b id="eaAmt">$0.01</b> every few minutes.</span>', 'earn board legacy sentence');
  s = one(s, '<span class="fcl-only"> Your account also claims the faucet: <span class="tAmt">0.01</span> USDT per claim, up to $<span class="tPer">0.10</span> a day.</span>', '<span class="fcl-only"> Your account also claims <span class="tAmt">0.01</span> USDT at a time, up to $<span class="tPer">0.10</span> a day.</span>', 'steps legacy sentence');
  return s;
});
rw('dist/levels/index.html', (s) => {
  s = one(s, 'Higher levels unlock exclusive badges, frames and a withdrawal bonus; accounts opened before 12 Nov 2026 also keep bigger faucet claims.', 'Higher levels unlock exclusive badges, frames and a withdrawal bonus.', 'meta');
  s = one(s, '"text":"Exclusive profile badges and cosmetics first; accounts opened before 12 Nov 2026 also keep bigger faucet claims (up to +90% at Legendary). Then ', '"text":"Exclusive profile badges and cosmetics, ', 'ld faq');
  s = one(s, ' The faucet claim multiplier below applies only to accounts opened before 12 Nov 2026 - newer accounts earn USDT from the season boards, the Season Pass, promo codes and partner bonuses.', ' Real USDT comes from the season boards, the Season Pass, promo codes and partner bonuses.', 'sub');
  s = s.split('<li>Standard faucet claims (legacy accounts)</li>').join('<li>Standard rewards</li>');
  s = s.replace(/<li><b>\+\d+%<\/b> faucet claims \(legacy accounts\)<\/li>/g, () => '<li><b>Bigger bonuses</b> on the tier’s rewards</li>');
  s = s.replace(/\n[ \t]*<div class="xp"><span class="ic" style="color:#ffd75a">(?:(?!<\/div><\/div>).)*?<div class="t">Claim from the faucet<\/div><div class="d">legacy accounts · up to 10\/day<\/div><\/div><span class="v">\+2<\/span><\/div>/, () => ''); // the XP-source row that named the faucet
  s = one(s, 'daily missions, faucet claims (legacy accounts), promoting the platform on X', 'daily missions, promoting the platform on X', 'faq earn');
  s = one(s, '<p>Exclusive badges and frames, higher daily limits (accounts opened before 12 Nov 2026 also keep bigger faucet claims, up to +90% at Legendary),', '<p>Exclusive badges and frames, higher daily limits,', 'faq unlock');
  return s;
});
rw('dist/academy/index.html', (s) => {
  s = one(s, ',{"h":"Older accounts","p":"Accounts opened before 12 November 2026 also keep the faucet - a cent every few minutes, up to $0.10 a day, with a multiplier that grows with the level - and their daily missions still pay a cent or two. Nothing was taken from anyone; the faucet was simply never offered to accounts that came later."}', '', 'mp3 extra card');
  s = one(s, 'From Silver up, each level unlocks a frame and a badge; accounts opened before 12 November 2026 also keep a faucet multiplier that climbs with the level.', 'From Silver up, each level unlocks a frame and a badge, and the top tiers add a withdrawal bonus.', 'mp2 sentence');
  s = one(s, "row(60,'Faucet (legacy accounts), per day','$0.10',.4)+", "row(60,'Daily missions','Ticks + XP',.4)+", 'viz row');
  return s;
});
rw('dist/llms.txt', (s) => one(s, 'daily missions (Ticks and XP; accounts opened before 2026-11-12 keep the faucet and mission cents),', 'daily missions (Ticks and XP),', 'llms'));
rw('dist/llms-full.txt', (s) => one(s, 'daily missions verified server-side pay Ticks and XP (accounts opened before 2026-11-12 keep the faucet - $0.01 a claim, $0.10 a day - and mission cents); ', 'daily missions verified server-side pay Ticks and XP (ten a day in three tiers, per member); ', 'llms-full'));
rw('dist/llms-changelog.txt', (s) => one(s, '- 2026-11-12: The faucet is closed to new accounts: accounts opened before 12 November 2026 keep the faucet claims (with the level multiplier) and the mission cents; every newer account earns real USDT from the season leaderboards, the Season Pass, promo codes, partner sign-up bonuses and the affiliate program, and its daily missions pay Ticks and XP. The /rewards/ page, /levels/, /season/ and the Academy say so.',
  '- 2026-11-12: Daily missions pay Ticks and XP, never money: ten a day per member in three tiers (a look, an action, a result), picked per account with a three-day cooldown, verified server-side. Real USDT comes from the season leaderboards, the Season Pass, promo codes, partner sign-up bonuses and the affiliate program.', 'changelog'));
console.log(DRY ? 'dry run' : 'done');
