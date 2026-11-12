/* THE FAUCET IS CLOSED TO NEW ACCOUNTS (2026-11-12, owner: "za sve nove korisnike iskljucimo opciju faucet i da se ne reklamiramo
   nigde za to ... misije za nove korisnike daju samo ticks ... stari korisnici kao i pre ... bitno je da se iskazi na sajtu usklade").
   The worker decides (legacyRewards: created before REWARDS_LEGACY_BEFORE); this script aligns every sentence the site says about
   money. Rule for the copy: real USDT on MarginPad comes from the season leaderboards, the Season Pass, promo codes, partner
   sign-up bonuses and the affiliate program. Daily missions pay Ticks and XP. The faucet and mission cents are mentioned only as
   what accounts opened before 12 Nov 2026 keep - never as an offer. Idempotent: an edit whose old text is gone is skipped.
   node build/fix-faucet-retire-2026-11-12.js [--dry] */
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), DRY = process.argv.includes('--dry');
const LEGACY = 'accounts opened before 12 Nov 2026';
let changed = 0, skipped = 0;
function patch(rel, edits) {
  const f = path.join(R, rel); if (!fs.existsSync(f)) { console.log('MISSING', rel); return; }
  let s = fs.readFileSync(f, 'utf8'); const o = s;
  for (const e of edits) {
    if (e.re) { const n = (s.match(e.re) || []).length; if (!n) { skipped++; continue; } s = s.replace(e.re, () => e.to); changed += n; continue; } // function replacement: `$` in `to` is never live
    const n = s.split(e.from).length - 1;
    if (!n) { skipped++; if (e.must) console.log('  anchor gone:', rel, JSON.stringify(e.from.slice(0, 70))); continue; }
    if (!e.all && n > 1) throw new Error(rel + ': anchor x' + n + ' ' + e.from.slice(0, 60));
    s = s.split(e.from).join(e.to); changed += n;
  }
  if (s !== o && !DRY) { fs.writeFileSync(f + '.tmp', s); fs.renameSync(f + '.tmp', f); }
  console.log((s !== o ? 'patched ' : 'unchanged ') + rel);
}
const BOARDS_SENT = 'Real USDT on MarginPad comes from the season leaderboards, the Season Pass, promo codes and partner sign-up bonuses. Daily missions pay Ticks and XP.';

/* ---------------- /rewards/ ---------------- */
const FAQ_NEW = '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How do I earn USDT on MarginPad?","acceptedAnswer":{"@type":"Answer","text":"Sign in with just your email (a 6-digit code, no password). Real USDT comes from the 14-day season leaderboards, the Season Pass, promo codes and partner sign-up bonuses - no deposit anywhere. Daily missions pay Ticks and XP."}},{"@type":"Question","name":"Is it really free?","acceptedAnswer":{"@type":"Answer","text":"Yes. Nothing on the rewards page asks for a deposit. MarginPad earns when a member opens an exchange account through one of its partner links, and part of that pays the prizes."}},{"@type":"Question","name":"How do I withdraw?","acceptedAnswer":{"@type":"Answer","text":"From $5 on your balance, request a payout to a Bybit UID, a MEXC UID or a Moon username that was opened through MarginPad. Every withdrawal is checked and paid by hand."}},{"@type":"Question","name":"What happened to the faucet?","acceptedAnswer":{"@type":"Answer","text":"The faucet and mission payouts stay for accounts opened before 12 November 2026. Newer accounts earn USDT from the leaderboards, the Season Pass, codes and partner bonuses instead."}}]}';
patch('dist/rewards/index.html', [
  { from: '<title>Free USDT Faucet - Claim Every 5 Minutes, No Deposit | MarginPad</title>', to: '<title>Earn USDT Rewards - Season Leaderboards, Season Pass, Bonuses | MarginPad</title>', must: 1 },
  { re: /<meta name="description" content="Claim free USDT every 5 minutes with no deposit:[^"]*"/, to: '<meta name="description" content="Earn real USDT with no deposit: sign in with just your email, compete on the 14-day season leaderboards, climb the Season Pass, redeem codes and partner sign-up bonuses. Withdraw from $5 to Bybit, MEXC or Moon."' },
  { from: '<meta name="keywords" content="usdt faucet, free usdt, crypto faucet, bep20 faucet, bnb chain faucet, claim free usdt, marginpad faucet" />', to: '<meta name="keywords" content="earn usdt, crypto rewards, trading competition prizes, season pass, paper trading rewards, marginpad rewards" />' },
  { from: '<meta property="og:title" content="Free USDT Faucet - Claim Every 5 Minutes, No Deposit" />', to: '<meta property="og:title" content="Earn USDT Rewards - Season Leaderboards, Season Pass, Bonuses" />' },
  { re: /<meta property="og:description" content="Claim free USDT every 5 minutes with no deposit:[^"]*"/, to: '<meta property="og:description" content="Real USDT with no deposit: email sign-in, 14-day season leaderboards, the Season Pass, codes and partner bonuses. Withdraw from $5 to Bybit, MEXC or Moon."' },
  { from: '<meta name="twitter:title" content="Free USDT Faucet - Claim Every 5 Minutes, No Deposit | MarginPad" />', to: '<meta name="twitter:title" content="Earn USDT Rewards - Season Leaderboards, Season Pass, Bonuses | MarginPad" />' },
  { from: '<meta name="twitter:description" content="Sign in with your email, get a welcome bonus, claim free USDT every 5 minutes. Withdraw from $5. No deposit." />', to: '<meta name="twitter:description" content="Sign in with your email, compete on the season leaderboards, climb the Season Pass. Withdraw from $5. No deposit." />' },
  { from: '"name":"MarginPad USDT Faucet"', to: '"name":"MarginPad Rewards"' },
  { re: /"description":"Earn free USDT on MarginPad: sign in with your email, get an instant welcome bonus, claim every 5 minutes and complete daily[^"]*"/, to: '"description":"Earn real USDT on MarginPad with no deposit: sign in with your email, compete on the 14-day season leaderboards, climb the Season Pass, redeem promo codes and partner sign-up bonuses. Daily missions pay Ticks and XP."' },
  { re: /\{"@context":"https:\/\/schema\.org","@type":"FAQPage","mainEntity":\[\{"@type":"Question","name":"How do I claim free USDT\?".*?\]\}(?=<\/script>)/, to: FAQ_NEW },
  { from: '"name":"Free USDT Faucet - Welcome Bonus + Claim Every 5 Minutes"', to: '"name":"Earn USDT Rewards - Season Leaderboards, Season Pass and Bonuses"' },
  { from: '<span class="pill">● Free USDT · No deposit</span>', to: '<span class="pill">● Real USDT · No deposit</span>' },
  { from: '<h1>Stack <span>free USDT</span> every 5 minutes.</h1>', to: '<h1>Earn <span>real USDT</span> for trading well.</h1>' },
  { from: 'Every account earns from its first day - no level to reach, no deposit. Claim, run the missions, invite, compete, then cash out from $5 to Bybit, Moon, MEXC or Bitget.', to: 'Every account earns from its first day - no level to reach, no deposit. Compete on the season leaderboards, climb the Season Pass, redeem codes, invite friends, then cash out from $5 to Bybit, Moon or MEXC.' },
  { from: '<div class="et-v"><span class="eamt" id="eaDay">$0.10</span><i>a day</i></div>\n      <div class="et-d">Claim <b id="eaAmt">$0.01</b> from the faucet every few minutes and finish the daily missions. Resets at 00:00 UTC.</div>',
    to: '<div class="et-v"><span class="eamt" id="eaDay">Ticks + XP</span><i id="eaDayU">missions</i></div>\n      <div class="et-d" id="eaDayD">Finish the daily missions: every mission pays Ticks, clearing the set pays XP. Resets at 00:00 UTC.<span class="fcl-only"> Your account also keeps the faucet: claim <b id="eaAmt">$0.01</b> every few minutes.</span></div>' },
  { from: 'Earn free USDT</div>', to: 'Earn real USDT</div>', all: true },
  { from: '__esT_rewardsindex("earnFreeUsdt","Earn free USDT")', to: '__esT_rewardsindex("earnFreeUsdt","Earn real USDT")' },
  { from: 'Sign in free with just your email. The faucet, missions and withdrawals are open from your first day - no level to reach. Claim free USDT every few minutes, and earn XP on the <a href="/academy/" style="color:#c2f64a">Academy</a> and <a href="/paper-trade" style="color:#c2f64a">Paper Trade</a> for bigger claims.',
    to: 'Sign in free with just your email. The season leaderboards, the Season Pass, codes and partner bonuses pay real USDT from your first day - no level to reach, no deposit. Daily missions pay Ticks and XP, and the <a href="/academy/" style="color:#c2f64a">Academy</a> and <a href="/paper-trade" style="color:#c2f64a">Paper Trade</a> level you up.', all: true },
  { from: 'Sign in to unlock daily missions and earn free USDT for using the site.', to: 'Sign in to unlock daily missions - they pay Ticks and XP for using the site.', all: true },
  { from: '<div class="step"><div class="n">02</div><h3>Claim every 5 min</h3><p>Each claim adds <span class="tAmt">0.01</span> USDT, up to $<span class="tPer">0.10</span> a day (more at higher levels). Come back and stack it up.</p></div>',
    to: '<div class="step"><div class="n">02</div><h3>Compete, climb, redeem</h3><p>Place top five on a season leaderboard, climb the Season Pass, redeem promo codes, open a partner account through us. Daily missions pay Ticks and XP.<span class="fcl-only"> Your account also claims the faucet: <span class="tAmt">0.01</span> USDT per claim, up to $<span class="tPer">0.10</span> a day.</span></p></div>' },
  { from: "row('<a class=\"browse-row\" href=\"/rewards/\">','</a>',I.gift,'Free USDT',__esT_rewardsindex(\"claimEvery5Minutes\",'Claim every 5 minutes'),'#ffd75a')", to: "row('<a class=\"browse-row\" href=\"/rewards/\">','</a>',I.gift,'Rewards',__esT_rewardsindex(\"claimEvery5Minutes\",'Boards, pass and bonuses'),'#ffd75a')" },
  // the faucet controls exist only for a legacy account (body.rwd-legacy, set from /api/reward/me `faucet`); everyone else reads where the money comes from
  { from: '<div class="prog"><i id="prog"></i></div>\n    <div class="prog-lbl"><span id="progLbl">$0.00 / $0.10 claimed today</span></div>\n    <div class="claim-row">\n      <button class="btn btn-lime" id="claimBtn" type="button">Claim 0.01 USDT</button>\n    </div>',
    to: '<div class="note fcl-no" style="text-align:left;margin:4px 0 10px;color:#c7ced6">' + BOARDS_SENT + ' Prizes land on this balance; cash out from $5.</div>\n    <div class="prog fcl-only"><i id="prog"></i></div>\n    <div class="prog-lbl fcl-only"><span id="progLbl">$0.00 / $0.10 claimed today</span></div>\n    <div class="claim-row fcl-only">\n      <button class="btn btn-lime" id="claimBtn" type="button">Claim 0.01 USDT</button>\n    </div>', must: 1 },
  { from: '  #lockedCard .lk-cta{display:grid;', to: '  /* 2026-11-12: the faucet is a legacy-account feature - its controls and sentences show only on body.rwd-legacy (from /api/reward/me `faucet`) */\n  body:not(.rwd-legacy) .fcl-only{display:none !important}\n  body.rwd-legacy .fcl-no{display:none !important}\n  #lockedCard .lk-cta{display:grid;' },
  { from: 'function applyCfg(j){try{earnBoard(j);}catch(e){}', to: 'function applyCfg(j){try{document.body.classList.toggle(\'rwd-legacy\',!!j.faucet);}catch(e){}try{earnBoard(j);}catch(e){}' },
  { from: "    if(j.perDay!=null)set('eaDay',usd(j.perDay));\n    if(j.amount!=null)set('eaAmt',usd(j.amount));", to: "    if(j.faucet){ if(j.perDay!=null)set('eaDay',usd(j.perDay)); set('eaDayU','a day'); if(j.amount!=null)set('eaAmt',usd(j.amount)); }" },
  // a mission row prints what IT pays: cents for a legacy account, Ticks for everyone else
  { from: "      var right=m.claimed?'<span class=\"claimed\">CLAIMED \\u2713</span>':(m.done?'<button data-msn=\"'+m.mid+'\">Claim '+fmt2(m.cents)+'</button>':'<span class=\"amt\">'+fmt2(m.cents)+'</span>');",
    to: "      var rw=(m.cents>0)?fmt2(m.cents):((m.ticks||d.ticks||4)+' T');\n      var right=m.claimed?'<span class=\"claimed\">CLAIMED \\u2713</span>':(m.done?'<button data-msn=\"'+m.mid+'\">Claim '+rw+'</button>':'<span class=\"amt\">'+rw+'</span>');", must: 1 },
  { from: "      if(wt)wt.innerHTML=b9.weekClaimed?'<span style=\"color:#c2f64a\">+$'+wU+' PAID</span>':(wC+'/'+wN9+' \\u2192 +$'+wU);",
    to: "      if(wt)wt.innerHTML=(+wU<=0)?(wC+'/'+wN9+' this week'):b9.weekClaimed?'<span style=\"color:#c2f64a\">+$'+wU+' PAID</span>':(wC+'/'+wN9+' \\u2192 +$'+wU);", must: 1 },
]);

/* ---------------- /levels/ ---------------- */
patch('dist/levels/index.html', [
  { from: 'Higher levels unlock bigger faucet rewards, exclusive badges and a Diamond withdrawal bonus.', to: 'Higher levels unlock exclusive badges, frames and a withdrawal bonus; ' + LEGACY + ' also keep bigger faucet claims.' },
  { from: 'Bigger faucet rewards, badges, exclusive events and a Diamond withdrawal bonus reward long-term loyalty.', to: 'Badges, frames, exclusive events and a withdrawal bonus reward long-term loyalty.' },
  { from: 'completing daily missions, claiming from the faucet, promoting the platform on X', to: 'completing daily missions, promoting the platform on X' },
  { from: '"text":"Bigger faucet claim rewards (up to +90% at Legendary), ', to: '"text":"Exclusive profile badges and cosmetics first; ' + LEGACY + ' also keep bigger faucet claims (up to +90% at Legendary). Then ' },
  { from: 'with every reward already open - the faucet, the missions, withdrawals and the boards need no level.', to: 'with every reward already open - the boards, the Season Pass, the missions and withdrawals need no level.' },
  { from: 'Bronze at 500 XP is your first badge, and each tier above it pays bigger faucet claims. Each tier takes progressively longer.', to: 'Bronze at 500 XP is your first badge, and each tier above it unlocks a frame, a badge and a bigger withdrawal bonus. The faucet claim multiplier below applies only to ' + LEGACY + ' - newer accounts earn USDT from the season boards, the Season Pass, promo codes and partner bonuses. Each tier takes progressively longer.' },
  { from: '<li>Faucet, missions, withdrawals and boards - all open</li>', to: '<li>Missions (Ticks + XP), boards, Season Pass and withdrawals - all open</li>' },
  { from: '<li>Standard faucet rewards</li>', to: '<li>Standard faucet claims (legacy accounts)</li>' },
  { from: ' faucet claim rewards</li>', to: ' faucet claims (legacy accounts)</li>', all: true },
  { from: '<div class="t">Claim from the faucet</div><div class="d">up to 10/day</div>', to: '<div class="t">Claim from the faucet</div><div class="d">legacy accounts · up to 10/day</div>' },
  { from: 'daily missions, faucet claims, promoting the platform on X', to: 'daily missions, faucet claims (legacy accounts), promoting the platform on X' },
  { from: '<p>Bigger faucet rewards (up to +75% at Legendary), higher daily limits,', to: '<p>Exclusive badges and frames, higher daily limits (' + LEGACY + ' also keep bigger faucet claims, up to +90% at Legendary),' },
]);

/* ---------------- /season/ (the howto card is translated in 14 languages inside var T - those values are written by the i18n step) ---------------- */
patch('dist/season/index.html', [
  { from: '<p data-hw="s1b">The faucet, the daily missions, withdrawals and referrals are open to every account the moment it signs in. No level, no deposit, nothing to unlock. Levels still matter: a higher level pays bigger faucet claims and wears its own badge.</p>',
    to: '<p data-hw="s1b">The season leaderboards, the Season Pass, promo codes and partner sign-up bonuses are open to every account the moment it signs in. No level, no deposit, nothing to unlock. Daily missions pay Ticks and XP. Levels still matter: a higher level wears its own badge and frame.</p>', must: 1 },
  { from: 'They pay XP only, never money. At 500 XP the faucet, the daily missions, withdrawals and referrals all open, anything you win becomes yours to withdraw, and this card is done with you.',
    to: 'They pay XP only, never money. At 500 XP you wear your first badge - the boards, the Season Pass, the missions and withdrawals were open from day one, anything you win becomes yours to withdraw, and this card is done with you.' },
  { from: 'You are in. The faucet, the missions and withdrawals are open to you, and anything you win on the four boards is yours to take.', to: 'You are in. The boards, the Season Pass, the missions and withdrawals are open to you, and anything you win on the four boards is yours to take.', all: true },
]);

/* ---------------- /academy/ (lesson mp3 gains a card ON PURPOSE so every stale pack falls back to English; mp2's text changes in place) ---------------- */
patch('dist/academy/index.html', [
  { from: '{"h":"What is on the table","p":"A $0.50 welcome bonus. $0.01 from the faucet every few minutes, up to $0.10 a day. Daily missions on top, a cent or two each. $1.00 for opening a Moon, MEXC, BingX or Bybit account through us - three of the four are checked automatically against the affiliate list. $0.50 when a friend you invited really trades. None of it waits for a level."}',
    to: '{"h":"What is on the table","p":"Real USDT comes from the 14-day season leaderboards, the Season Pass, promo codes and partner bonuses: $1.00 for opening a Moon, MEXC, BingX or Bybit account through us (three of the four are checked automatically against the affiliate list), $0.50 when a friend you invited really trades, a $0.50 welcome bonus when a friend invites you. Daily missions pay Ticks and XP. None of it waits for a level."},{"h":"Older accounts","p":"Accounts opened before 12 November 2026 also keep the faucet - a cent every few minutes, up to $0.10 a day, with a multiplier that grows with the level - and their daily missions still pay a cent or two. Nothing was taken from anyone; the faucet was simply never offered to accounts that came later."}', must: 1 },
  { from: '{"q":"Which of these waits for a level?","o":["The faucet","Daily missions","Referrals","None of them - every reward is open from day one"],"a":3}', to: '{"q":"Which of these waits for a level?","o":["The season leaderboards","Daily missions","Referrals","None of them - every reward is open from day one"],"a":3}' },
  { from: 'Open it and see where your balance, the faucet and the sign-up bonuses are - it will make more sense once you have seen the layout.', to: 'Open it and see where your balance, the boards and the sign-up bonuses are - it will make more sense once you have seen the layout.' },
  { from: 'Nothing on this site waits for a level any more: the faucet, the daily missions, referrals, withdrawals and every free board are open from the day you sign up.', to: 'Nothing on this site waits for a level any more: the season boards, the Season Pass, the daily missions, referrals, withdrawals and every free board are open from the day you sign up.' },
  { from: 'From Silver up, every faucet claim pays a little more - the multiplier climbs with the level.', to: 'From Silver up, each level unlocks a frame and a badge; accounts opened before 12 November 2026 also keep a faucet multiplier that climbs with the level.' },
  { from: "row(60,'Faucet, per day','$0.20',.4)+", to: "row(60,'Faucet (legacy accounts), per day','$0.10',.4)+" },
]);

/* ---------------- homepage tile (demo-home is the source; gen-home-live writes dist/index.html) ---------------- */
for (const f of ['dist/demo-home/index.html', 'dist/index.html']) patch(f, [
  { from: '<div class="t-kick" style="color:#a9d33f"><span class="dot"></span> Free USDT</div>', to: '<div class="t-kick" style="color:#a9d33f"><span class="dot"></span> Real USDT</div>' },
  { from: '<div class="t-sub">Claim free USDT every 5 minutes, finish daily missions, win the 14-day league. Withdraw real USDT.</div>', to: '<div class="t-sub">Win the 14-day leaderboards, climb the Season Pass, redeem codes and partner bonuses. Withdraw real USDT from $5.</div>' },
  { from: '<div class="rw-chip"><span class="cd"></span> CLAIM EVERY 5 MIN · DAILY MISSIONS</div>', to: '<div class="rw-chip"><span class="cd"></span> 14-DAY SEASONS · SEASON PASS · BONUSES</div>' },
]);

/* ---------------- bundles ---------------- */
patch('dist/assets/mp-auth.js', [
  { from: '<div class="pb-why">Bronze is your first level badge - higher levels pay bigger faucet claims. <a href="/academy/">Academy</a> is the fastest road.</div>', to: '<div class="pb-why">Bronze is your first level badge - higher levels unlock frames and The Gold Room at Gold. <a href="/academy/">Academy</a> is the fastest road.</div>' },
  { from: '<b>You are already Bronze</b> - your first level badge is on your card; Silver pays bigger faucet claims.', to: '<b>You are already Bronze</b> - your first level badge is on your card; the next levels unlock frames and The Gold Room.' },
  { from: '<li><b>The money is open from day one:</b> the free USDT faucet, daily missions, withdrawals and a seat on the season boards - no level needed. <a href="/rewards/">Rewards</a> · <a href="/season/">Season</a></li>', to: '<li><b>The money is open from day one:</b> the season leaderboards, the Season Pass, promo codes and partner sign-up bonuses - no level needed. Daily missions pay Ticks and XP. <a href="/rewards/">Rewards</a> · <a href="/season/">Season</a></li>' },
]);
patch('dist/assets/home.js', [{ from: "__esT_home(\"claimEvery5Minutes\",'Claim every 5 minutes')", to: "__esT_home(\"claimEvery5Minutes\",'Boards, pass and bonuses')" }]);
patch('dist/rekt/index.html', [
  { from: "__esT_rektindex(\"claimEvery5Minutes\",'Claim every 5 minutes')", to: "__esT_rektindex(\"claimEvery5Minutes\",'Boards, pass and bonuses')" },
  { from: '<a class="foot-rwd" href="/rewards/" aria-label="Earn free USDT">', to: '<a class="foot-rwd" href="/rewards/" aria-label="Earn real USDT">' },
  { from: '<span><b>Earn free USDT</b><small>Claim every 5 minutes</small></span>', to: '<span><b>Earn real USDT</b><small>Boards, pass and bonuses</small></span>' },
]);
for (const f of ['app/index.html', 'dist/app.html']) patch(f, [
  { from: 'title="Free USDT - claim every 5 min"', to: 'title="Rewards - boards, pass and bonuses"' },
  { from: '<a class="foot-rwd" href="/rewards/" aria-label="Earn free USDT">', to: '<a class="foot-rwd" href="/rewards/" aria-label="Earn real USDT">' },
  { from: '<span><b data-i18n="footRwd">Earn free USDT</b><small data-i18n="footRwdSub">Claim every 5 minutes</small></span>', to: '<span><b data-i18n="footRwd">Earn real USDT</b><small data-i18n="footRwdSub">Boards, pass and bonuses</small></span>' },
]);
for (const f of ['build/gen-cycle-page.js', 'build/gen-defi-page.js', 'build/gen-etf-page.js', 'dist/bitcoin-cycle/index.html', 'dist/defi/index.html', 'dist/etf-flows/index.html']) patch(f, [{ from: 'title="Free USDT - claim every 5 min"', to: 'title="Rewards - boards, pass and bonuses"', all: true }]);
patch('build/gen-og-images.js', [{ from: "sub: 'A faucet, daily missions and season prizes - paid in real USDT.'", to: "sub: 'Season leaderboards, the Season Pass and partner bonuses - paid in real USDT.'" }]);
for (const f of ['build/gen-blog.js', 'dist/blog/moon-trading-platform-review/index.html']) patch(f, [
  { from: "MarginPad's rewards faucet supports cashing out straight to a Moon account", to: "MarginPad's rewards balance can be cashed out straight to a Moon account", all: true },
  { from: 'MarginPad\'s <a href=\\"/rewards/\\">rewards faucet</a> pays real money for using the site', to: 'MarginPad\'s <a href=\\"/rewards/\\">rewards</a> pay real money for competing on the site', all: true },
  { from: 'MarginPad\'s <a href="/rewards/">rewards faucet</a> pays real money for using the site', to: 'MarginPad\'s <a href="/rewards/">rewards</a> pay real money for competing on the site', all: true },
]);

/* ---------------- AI layer ---------------- */
patch('dist/llms.txt', [{ from: 'open to every account from its first day: faucet, daily missions (at most $0.02 each), season prizes,', to: 'open to every account from its first day: season prizes, the Season Pass, promo codes, partner sign-up bonuses, daily missions (Ticks and XP; accounts opened before 2026-11-12 keep the faucet and mission cents),' }]);
patch('dist/llms-full.txt', [{ re: /faucet claims \(\$0\.01 every 5 minutes, \$0\.10 a day\), daily missions verified server-side \(max \$0\.02 per mission since 2026-09-28\), /, to: 'real USDT from the season leaderboards, the Season Pass, promo codes and partner sign-up bonuses; daily missions verified server-side pay Ticks and XP (accounts opened before 2026-11-12 keep the faucet - $0.01 a claim, $0.10 a day - and mission cents); ' }]);
console.log('edits', changed, 'skipped', skipped, DRY ? '(dry)' : '');
