/* Writes the final-exam block into dist/academy/index.html (the page is the source of everything else there). Idempotent: the block and the
   CSS live between markers and are replaced whole; the one-line hooks are applied once. Source: build/academy-exam.js.txt + build/data/academy-exam-ui.json.
   Run: node build/fix-academy-exams.js  (then es/gen-pages for the twins, then bump-home-assets is not needed: this page carries no bundle of its own) */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = path.join(__dirname, '..'), F = path.join(R, 'dist/academy/index.html');
let h = fs.readFileSync(F, 'utf8');
const ui = JSON.parse(fs.readFileSync(path.join(R, 'build/data/academy-exam-ui.json'), 'utf8'));
for (const l of Object.keys(ui)) for (const k of Object.keys(ui.en)) if (!ui[l][k]) throw new Error('ui ' + l + ' missing ' + k);
let block = fs.readFileSync(path.join(R, 'build/academy-exam.js.txt'), 'utf8').replace(/\r\n/g, '\n');
block = block.split('/*EXU*/{}/*/EXU*/').join(JSON.stringify(ui));
const pack = path.join(R, 'dist/academy/i18n/exam-en.json');
const v = fs.existsSync(pack) ? crypto.createHash('sha1').update(fs.readFileSync(pack)).digest('hex').slice(0, 8) : '0';
block = block.split("var EXV='0';").join("var EXV='" + v + "';");
const css = '/* exam:css */.node.exam .dot{background:#221c0c;color:var(--gold);box-shadow:0 5px 0 rgba(0,0,0,.45),inset 0 -4px 0 rgba(0,0,0,.28)}.node.exam.ready .dot{background:var(--gold);color:#1a1200;box-shadow:0 5px 0 #a8831a,inset 0 -4px 0 rgba(0,0,0,.18)}.node.exam.passx .dot{background:rgba(46,189,133,.16);color:#7ce8bd}.node.exam.coolx .dot{background:#1a212b;color:var(--dim)}.node.exam.lockedx{opacity:.55;cursor:default}.node.exam .nt{color:var(--gold)}.node.exam.passx .nt{color:#7ce8bd}.ex-rules{margin:14px 0 8px;padding:0;list-style:none}.ex-rules li{position:relative;padding:9px 0 9px 18px;border-top:1px solid var(--line);font-size:14.5px;line-height:1.45;color:var(--ink)}.ex-rules li:first-child{border-top:0}.ex-rules li::before{content:"";position:absolute;left:2px;top:16px;width:7px;height:7px;border-radius:2px;background:var(--gold)}.ex-msg{margin-top:12px;font-size:14px;line-height:1.5;color:var(--gold)}.ex-sign{margin-top:10px;background:var(--lime);color:#0a0b0d;border:0;border-radius:11px;padding:11px 18px;font:800 14px inherit;font-family:inherit;cursor:pointer}.lp-opt.sel{border-color:var(--lime);background:rgba(194,246,74,.1);color:var(--ink)}.ex-prev{background:none;border:0;color:var(--dim);font-family:inherit;font-size:13.5px;padding:8px 2px;cursor:pointer}.ex-clock{font-family:\'Space Mono\',monospace;font-weight:700;font-size:15px;color:var(--ink)}.ex-clock.low{color:var(--red)}.ex-score{font-family:\'Bricolage Grotesque\',sans-serif;font-weight:800;font-size:68px;line-height:1;color:var(--red)}.ex-score small{font-size:26px;color:var(--dim);font-weight:700}.ex-done.ok .ex-score{color:var(--green)}.ex-rev{margin:18px auto 0;max-width:430px;text-align:left}.ex-revt{font:700 11px \'Space Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin-bottom:8px}.rt-link{display:block;margin:0 0 12px;font-size:13.5px;color:var(--lime);text-decoration:none;font-weight:600}.rv-card{display:flex;align-items:center;gap:13px;width:100%;margin:0 0 16px;padding:12px 14px;background:linear-gradient(135deg,rgba(194,246,74,.11),rgba(194,246,74,.02));border:1px solid rgba(194,246,74,.4);border-radius:15px;color:var(--ink);font-family:inherit;text-align:left;cursor:pointer}.rv-card.done{background:var(--panel);border-color:var(--line2);cursor:default}.rv-ic{width:40px;height:40px;flex:none;border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--lime);color:#0a0b0d;font:800 18px \'Space Mono\',monospace}.rv-ic svg{width:22px;height:22px}.rv-card.done .rv-ic{background:rgba(46,189,133,.16);color:#7ce8bd}.rv-b{min-width:0;flex:1}.rv-t{display:block;font-weight:700;font-size:15px}.rv-s{display:block;font-size:12.5px;color:var(--dim);margin-top:2px}.rv-r{flex:none;text-align:right}.rv-st{display:block;font:700 11px \'Space Mono\',monospace;color:var(--gold)}.rv-r .xpb{font:700 10.5px \'Space Mono\',monospace;color:var(--gold)}.ex-prog{margin:8px 0 2px;font-size:14px;color:var(--dim)}.ex-prog b{font:800 34px \'Bricolage Grotesque\',sans-serif;color:var(--lime)}.ex-tr{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--line);font-size:13px}.ex-tr b{font-family:\'Space Mono\',monospace}.ex-tr span{color:var(--dim);text-align:right}.ex-tr.ok span{color:#7ce8bd}.ex-tr.no span{color:#ff9d96}.ex-rev button{display:block;width:100%;text-align:left;background:var(--panel);border:1px solid var(--line2);border-radius:11px;color:var(--ink);font-family:inherit;font-size:14px;font-weight:600;padding:11px 13px;margin-bottom:8px;cursor:pointer}/* /exam:css */';

function once(a, b) { if (h.includes(b)) return; const n = h.split(a).length - 1; if (n !== 1) throw new Error('anchor x' + n + ': ' + a); h = h.split(a).join(b); }
// css
const cs = h.indexOf('/* exam:css */'), ce = h.indexOf('/* /exam:css */');
if (cs >= 0 && ce > cs) h = h.slice(0, cs) + h.slice(ce + '/* /exam:css */'.length);
const gi = h.indexOf('.lp-grad{margin:18px'); if (gi < 0) throw new Error('css anchor');
h = h.slice(0, gi) + css + h.slice(gi);
// js block
const js = h.indexOf('  /* exam:start'), je = h.indexOf('/* exam:end */');
if (js >= 0 && je > js) { const nl = h.indexOf('\n', je); h = h.slice(0, js) + h.slice(nl + 1); }
const ci = h.indexOf('  function courseName(id){'); if (ci < 0) throw new Error('js anchor');
h = h.slice(0, ci) + block + h.slice(ci);
// hooks
once("      html+='</div></section>';", "      html+=examNode(c,cd);html+=pracNode(c,cd);html+='</div></section>';");
once("    host.innerHTML=html;\n    document.getElementById('allDone')", "    host.innerHTML=html;reviewCard();\n    document.getElementById('allDone')");
once("var b=e.target.closest('.node');if(!b||b.disabled)return;", "var b=e.target.closest('.node');if(!b||b.disabled)return;if(b.getAttribute('data-prac')){openPrac();return;}if(b.getAttribute('data-exam')){openExam(b.getAttribute('data-exam'));return;}");
once("lpGo.addEventListener('click',function(){if(lpGo.disabled)return;", "lpGo.addEventListener('click',function(){if(lpGo.disabled)return;if(RV.on){reviewGo();return;}if(PR.on){pracGo();return;}if(EX.on){examGo();return;}");
once("function closeLp(){lp.classList.remove('on');", "function closeLp(){examStop();lp.classList.remove('on');");
once("if(signedIn){st.best=d.best||{};", "if(signedIn){st.exams=d.exams||{};if(d.examRules)EX.r=d.examRules;RV.st=d.review||null;if(d.reviewRules)RV.r=d.reviewRules;PR.st=d.prac||null;if(d.pracRules)PR.r=d.pracRules;st.best=d.best||{};");
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('academy page written, pack version', v);
