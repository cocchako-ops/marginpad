/* THE HOMEPAGE'S TRADE-OF-THE-DAY STRIP IS A DOOR, NOT ONLY A HEADLINE (2026-11-13, owner: "Vote za trade of the day mi uopste nije jasan gde
   je"): `#ptTotd` printed yesterday's winner and nothing when there was none, and linked nowhere. It always prints now - the winner with a
   "vote today" link, or the stake with "nominate and vote" - and the link opens the panel (`/paper-trade?totd=1`, mp-auth's mpTotdPanel).
   The stake comes from the server's answer (`usd`, `xp`), never typed here. Source of truth is dist/demo-home/index.html; run
   gen-home-live -> add-og-image -> gen-feed (restore its four side files) -> bump-home-assets after. Idempotent; --dry prints only. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DRY = process.argv.includes('--dry');
const p = path.join(ROOT, 'dist', 'demo-home', 'index.html'); let s = fs.readFileSync(p, 'utf8');
const OLD = "then(function(d){var el=document.getElementById('ptTotd');if(!el||!d||!d.win)return;var w=d.win,cl=function(s){return String(s||'').replace(/[<>&]/g,'');},roe=(w.roe!=null&&isFinite(+w.roe))?((+w.roe>=0?'+':'')+(+w.roe).toFixed(1)+'%'):'';el.innerHTML='<b>Trade of the day</b> @'+cl(w.by)+' · '+cl(w.sym)+' '+(w.side==='short'?'short':'long')+(roe?' <span class=\"r'+(+w.roe<0?' l':'')+'\">'+roe+'</span>':'')+' · '+(+w.n||0)+((+w.n)===1?' vote':' votes');}).catch(function(){});";
const NEW = "then(function(d){var el=document.getElementById('ptTotd');if(!el||!d)return;var cl=function(s){return String(s||'').replace(/[<>&]/g,'');},st='$'+(d.usd!=null?+d.usd:1)+' + '+(d.xp!=null?+d.xp:100)+' XP',w=d.win;if(w){var roe=(w.roe!=null&&isFinite(+w.roe))?((+w.roe>=0?'+':'')+(+w.roe).toFixed(1)+'%'):'';el.innerHTML='<b>Trade of the day</b> @'+cl(w.by)+' · '+cl(w.sym)+' '+(w.side==='short'?'short':'long')+(roe?' <span class=\"r'+(+w.roe<0?' l':'')+'\">'+roe+'</span>':'')+' · '+(+w.n||0)+((+w.n)===1?' vote':' votes')+' · <a href=\"/paper-trade?totd=1\">vote today \\u2192</a>';}else{el.innerHTML='<b>Trade of the day</b> '+st+' to the author · <a href=\"/paper-trade?totd=1\">nominate and vote \\u2192</a>';}}).catch(function(){});";
const CSS_OLD = ".pt-totd .r.l{color:#ff5a4d;}";
const CSS_NEW = ".pt-totd .r.l{color:#ff5a4d;}.pt-totd a{color:var(--lime);text-decoration:none;font-weight:600;}.pt-totd a:hover{text-decoration:underline;}";
if (s.indexOf(NEW) >= 0) { console.log('demo-home: strip already a door'); }
else {
  if (s.split(OLD).length - 1 !== 1) throw new Error('demo-home: the strip script was not found exactly once');
  s = s.split(OLD).join(NEW);
  if (s.split(CSS_OLD).length - 1 !== 1) throw new Error('demo-home: the strip css was not found exactly once');
  if (s.indexOf('.pt-totd a{') < 0) s = s.split(CSS_OLD).join(CSS_NEW);
  if (!DRY) { fs.writeFileSync(p + '.tmp', s); fs.renameSync(p + '.tmp', p); }
  console.log('demo-home: strip links the panel and always prints' + (DRY ? ' (dry)' : ''));
}
