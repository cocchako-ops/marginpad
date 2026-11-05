// King of the Moon registration box on /leaderboards/ (both files): the member types the Moon username of the account opened
// through our link (POST /api/reward/moonlink), the way Bybit and BingX take a UID. Before 2026-11-05 the only way in was the
// $1 sign-up claim, because Moon masked every name and a claim was the one place a full username was ever told to us.
// Idempotent (marker MOONLINK_1105), --dry prints what it would change.
const fs = require('fs'), path = require('path');
const DRY = process.argv.includes('--dry');
const FILES = ['dist/leaderboards/index.html', 'dist/es/leaderboards/index.html'];
const MARK = '/* MOONLINK_1105 */';
const NEW_BOX = MARK + ` /* King of the Moon (2026-11-05): Moon now prints full usernames, so the member registers theirs HERE - checked against our
     Moon referral list, one Moon username per MarginPad account. An approved $1 sign-up claim still counts as a registration. */
  function paintMoonbox(){var box=$('moonbox');if(!box)return;if(CUR!=='moon'||SEL){box.hidden=true;return;}box.hidden=false;var m=me(),D=LB||{};
    var full='<a class="byfull" data-mpex="Moon" href="https://moon.com/?offer=marginpad" target="_blank" rel="noopener sponsored"><span><em class="lg">'+T("noMoonAccountThrough",__esT_leaderboardsindex("noMoonAccountThrough",'No Moon account through MarginPad yet? Open one with our link — that is the account that counts.'))+'</em><em class="sm">'+T("notOnMoonYet",__esT_leaderboardsindex("notOnMoonYet",'Not on Moon yet? Open one here'))+'</em></span><b>'+T("openMoon",__esT_leaderboardsindex("openMoon",'Open Moon →'))+'</b></a>';
    var head=function(st,stTxt){return '<div class="bh"><span class="pill">'+T("moonRegPill",'King of the Moon · registration')+'</span><span class="st '+st+'">'+stTxt+'</span></div>';};
    if(!m){box.innerHTML='<div class="bybox2 moon">'+head('wait',T("notRegistered",__esT_leaderboardsindex("notRegistered",'not registered')))+'<div class="bt">'+T("moonRegT",'Register the Moon account you opened through MarginPad')+'</div><div class="bd">'+T("moonRegBdGuest",'Sign in, then enter your Moon username. It is checked against our Moon referral list - one Moon username, one MarginPad account. From then on what you wager on Moon counts on this board.')+'</div><div class="bf"><button type="button" class="btn" data-auth-open>'+T("signInToRegister",'Sign in to register')+'</button></div>'+full+'</div>';return;}
    if(!MOL){box.innerHTML='<div class="bybox2 moon">'+head('wait',T("checkingL",'checking…'))+'<div class="bt">'+T("checkingYourMoonRegistrati",__esT_leaderboardsindex("checkingYourMoonRegistrati",'Checking your Moon registration…'))+'</div></div>';J('/api/reward/moonlink').then(function(d){MOL=d||{};paintMoonbox();if(CUR==='moon'&&!SEL)paintBoard({keep:true});});return;}
    var el=MOL.eligible,nm=MOL.name||'',warn=el&&MOL.inList===false;
    box.innerHTML='<div class="bybox2 moon">'+head(el?(warn?'wait':'ok'):'wait',el?(warn?T("moonNotOnList",'not on our list yet'):T("registeredTick",'✓ registered')):T("notRegistered",__esT_leaderboardsindex("notRegistered",'not registered')))
      +'<div class="bt">'+(el?T("youAreInMoonReg",'You are in - your Moon account is registered'):T("moonRegT",'Register the Moon account you opened through MarginPad'))+'</div>'
      +'<div class="bd">'+(el?T("moonUserL",'Moon username ')+'<b>'+esc(nm)+'</b>'+T("isTiedToThisMoon",' is tied to this account')+(MOL.source==='signup'?T("fromYourSignup",' (from your sign-up bonus claim)'):'')+'. '+(warn?T("moonWarnList",'It is not on the latest Moon referral list we hold, so nothing is counted for it until it appears there. If you opened it through our link, it will show up after the next list update.'):T("everythingYouWagerOn",__esT_leaderboardsindex("everythingYouWagerOn",'Everything you wager on Moon'))+(D.moonContest?T("sinceL",' since ')+dayS(D.moonContest.start):'')+T("moonCountsBoard",' counts on this board - it refreshes with each Moon report.')):T("moonRegBd",'Enter your Moon username exactly as Moon shows it. It is checked against our Moon referral list - one Moon username, one MarginPad account.'))+'</div>'
      +'<div class="bf">'+(el?'<span class="uidv">Moon '+esc(nm)+'</span><span class="bd" style="margin:0">'+T("lockedToThisAccountMoon",'Locked to this account for the contest - <a href="mailto:support@marginpad.io?subject=Moon%20username">contact support</a> if it is wrong')+'</span>':'<input id="mnName" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="'+T("moonUsernamePh",'Moon username')+'" maxlength="40"><button type="button" class="btn" id="mnLink">'+T("registerL",'Register')+'</button>')+'</div><div class="msg" id="mnMsg"></div>'+full+'</div>';
    var lb=$('mnLink');
    if(lb)lb.addEventListener('click',function(){var v=String(($('mnName')||{}).value||'').trim().replace(/^@/,'');if(!/^[A-Za-z0-9_.\\-]{2,40}$/.test(v)){$('mnMsg').className='msg err';$('mnMsg').textContent=T("moonBadName",'Type your Moon username exactly as Moon shows it: letters, numbers, _ . - only.');return;}lb.disabled=true;
      fetch('/api/reward/moonlink',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:v})}).then(function(r){return r.json();}).then(function(d){lb.disabled=false;
        if(d&&d.ok){MOL=null;toast(T("moonRegistered",'<b>Registered.</b> Your Moon wagering counts from the next Moon report'));paintMoonbox();load();track('moonreg');return;}
        var E={not_ours:T("moonNotOurs",'This Moon username is not on our referral list. Only an account opened through our Moon link can enter. If you opened it in the last day, try again tomorrow.'),name_taken:T("moonTaken",'This Moon username is already registered by another MarginPad account. If it is yours, contact support.'),already_registered:T("moonAlready",'Your account is already registered with another Moon username from your sign-up bonus. Contact support if that is wrong.'),bad_name:T("moonBadName",'Type your Moon username exactly as Moon shows it: letters, numbers, _ . - only.'),login_required:T("signInFirst",__esT_leaderboardsindex("signInFirst",'Sign in first.'))};
        $('mnMsg').className='msg err';$('mnMsg').textContent=E[d&&d.error]||T("couldNotRegisterRight",__esT_leaderboardsindex("couldNotRegisterRight",'Could not register right now. Try again in a minute.'));}).catch(function(){lb.disabled=false;$('mnMsg').className='msg err';$('mnMsg').textContent=T("networkError2",__esT_leaderboardsindex("networkError",'Network error.'));});});}
`;
const NEW_YOU = `if(CUR==='moon'){ /* eligibility = the member's own Moon registration (/api/reward/moonlink), never the standings */
        if(!MOL){y.innerHTML=T("checkingYourMoonRegistrati",__esT_leaderboardsindex("checkingYourMoonRegistrati",'Checking your Moon registration…'));J('/api/reward/moonlink').then(function(d){MOL=d||{};paintBoard({keep:true});paintMoonbox();});return;}
        y.innerHTML=MOL.eligible?(T("youAreInAs",__esT_leaderboardsindex("youAreInAs",'<b>You are in</b> as Moon user <b>'))+esc(MOL.name)+'</b> - eligible. '+(myRow?T("youAre",__esT_leaderboardsindex("youAre",'You are <b>#'))+myRow.rank+'</b>'+(pz[myRow.rank-1]>0?' - <b>$'+int(pz[myRow.rank-1])+T("ifItHolds",__esT_leaderboardsindex("ifItHolds",'</b> if it holds')):'')+'.':T("everythingYouWagerOn",__esT_leaderboardsindex("everythingYouWagerOn",'Everything you wager on Moon'))+(MC?' since '+dayS(MC.start):'')+T("countsTheBoardFills",__esT_leaderboardsindex("countsTheBoardFills",' counts; the board fills from the next Moon report.'))))
          :T("moonYouNotIn",'You are not in yet. Register your Moon username in the box below the table - the Moon account you opened through MarginPad.');
      } else `;
let total = 0;
for (const f of FILES) {
  const p = path.join(__dirname, '..', f); let h = fs.readFileSync(p, 'utf8');
  if (h.indexOf(MARK) >= 0) { console.log(f, 'already applied'); continue; }
  const a = h.indexOf('  /* King of the Moon: only a Moon account opened through MarginPad competes');
  const b = h.indexOf('  /* Bybit board: only a Bybit account opened through MarginPad competes');
  if (a < 0 || b < 0 || b < a) throw new Error(f + ': box anchors not found');
  h = h.slice(0, a) + '  ' + NEW_BOX + h.slice(b);
  const ya = h.indexOf("if(CUR==='moon'){ /* eligibility comes from the member's own Moon sign-up");
  const yb = h.indexOf("} else if(!myRow&&((CUR==='bybit'", ya);
  if (ya < 0 || yb < 0) throw new Error(f + ': you-line anchors not found');
  h = h.slice(0, ya) + NEW_YOU + h.slice(yb + "} else ".length);
  if ((h.match(/\('\/api\/reward\/moonsign\/mine/g) || []).length) throw new Error(f + ': moonsign/mine still read');
  total++;
  if (!DRY) fs.writeFileSync(p, h); console.log(f, DRY ? 'would patch' : 'patched');
}
console.log('done', total);
