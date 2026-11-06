window.__mpUI={"mpauth":{},"mpnav":{},"mpprofile":{},"mptrade":{}};window.__mpDom={};window.__mpDomRe=[];
/* THE LAST MILE (2026-10-31). A lot of what the bundles draw is HTML inside a JS string ('<div class="h">Indicators</div>'), which no call-site dictionary reaches, and that is where a tab or a menu stayed English.
   This translates a whole text node, placeholder, title or aria-label when it EXACTLY equals a string in window.__mpDom. Exact only: it cannot damage a sentence, a figure or a name.
   THE 2026-10-25 FREEZE IS THE RULE HERE: a DOM write inside a MutationObserver callback re-queues the callback as a microtask. So every write is followed by takeRecords(), which throws our own mutations
   away, a node is only ever written when its text is in the table and the result never is, and member-written text (chat, DMs, posts) is skipped. */
(function(){try{var st=document.createElement('style');st.id='mpUiFit';st.textContent='.cp-bn,.tg .n,.tabs .n,.nm,.sy,.dash-k,.rk-24,.mpa-tdy-l,.mp-xr-d,.mpr2-d,.tk-tag,.acct-lvs,.mpa-q-l,.fname{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:break-word;hyphens:auto}.tg .l,.bcount,.cp-bl b,.cp-bp small,#msnSetTxt,.bch small,.dst em,.dash-stats .dst b,.bch .bl,.tgh em,.mpa-st-k{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;line-height:1.2}.mpnav-rt small,.rw .x{white-space:normal!important;overflow:visible!important;text-overflow:clip!important}.rw .x{letter-spacing:0;line-height:1.15}.mpnav-rt small{line-height:1.25}';document.head.appendChild(st);}catch(e){}})();
(function(){
  var D=window.__mpDom=window.__mpDom||{},A=['placeholder','title','aria-label'],SK='.ct-body,.ct-msg .ct-t,.mpa-dtx,.mpa-dbub,.post-body,[data-notr]',obs=null;
  function own(s){if(!s)return false;return Object.prototype.hasOwnProperty.call(D,s);}
  var RE=(window.__mpDomRe||[]).map(function(x){return [new RegExp(x[0],'g'),x[1],x[2]||''];}),GATE=/leads|liquidated|Open interest|Fell through|Broke above|Printed a new|Reached |Stopped at|[Vv]olume |The S&P|whale trade|of market|No dated|Bitcoin|read it as|desks reported|Funding sat|The book within|Events like|this move is|One move|then price|smaller move|started at|^New |on the chart|claims ·|If the stop|this coin|desks ·|Events of this kind|Needs |A mirror of|^updated |^Yesterday | seasons$|^Shares: /;
  function pat(v){var o=v;if(o.indexOf('Shares: ')===0){var sh=D['Shares:']||'Shares:';o=sh+' '+o.slice(8).split(', ').map(function(c){var m=/^(.*) (\d+%)$/.exec(c);if(!m)return c;var l=own(m[1])?D[m[1]]:pat(m[1]);return l+' '+m[2];}).join(', ');return o;}
    for(var i=0;i<RE.length;i++){(function(r){if(r[2]&&o.indexOf(r[2])<0)return;o=o.replace(r[0],function(){var a=arguments;return r[1].replace(/\{(\d)\}/g,function(x,n){return a[+n]==null?'':a[+n];});});})(RE[i]);}return o;}
  function txt(n){var v=n.nodeValue;if(!v||v.length<2||v.length>900)return;var k=v.trim(),p=n.parentNode;if(!p||p.nodeName==='SCRIPT'||p.nodeName==='STYLE'||p.nodeName==='TEXTAREA')return;if(p.closest&&p.closest(SK))return;if(k.length<=300&&own(k)){n.nodeValue=v.split(k).join(D[k]);return;}var w=pat(v);if(w!==v)n.nodeValue=w;}
  function att(e){for(var i=0;i<A.length;i++){var v=e.getAttribute(A[i]);if(v&&own(v.trim()))e.setAttribute(A[i],D[v.trim()]);}}
  function walk(r){
    if(r.nodeType===3){txt(r);return;}if(r.nodeType!==1||r.nodeName==='SCRIPT'||r.nodeName==='STYLE')return;
    if(r.closest&&r.closest(SK))return;
    att(r);if(!r.firstChild)return;
    var w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT,null),n;while((n=w.nextNode()))txt(n);
    if(r.querySelectorAll){var q=r.querySelectorAll('[placeholder],[title],[aria-label]');for(var i=0;i<q.length;i++)att(q[i]);}
  }
  function start(){
    if(obs||!document.body)return;walk(document.body);
    obs=new MutationObserver(function(rs){for(var i=0;i<rs.length;i++){var r=rs[i];if(r.type==='characterData'){txt(r.target);continue;}for(var j=0;j<r.addedNodes.length;j++)walk(r.addedNodes[j]);}obs.takeRecords();});
    obs.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
    window.__mpDomOn=1;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
