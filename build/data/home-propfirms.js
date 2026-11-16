<script>/*@PROPFIRMS:js - the two prop firm cards open a sheet built from the card's own static details (so crawlers read the same text) */
(function(){
  var band=document.getElementById('propfirms'); if(!band)return;
  var sh=null,card=null,last=null;
  var X='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  function build(){
    sh=document.createElement('div');sh.className='pfs';sh.hidden=true;sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');sh.setAttribute('aria-label','Prop firm details');
    sh.innerHTML='<div class="pfs-bd" data-pfx></div><div class="pfs-card"><button type="button" class="pfs-x" data-pfx aria-label="Close">'+X+'</button><div class="pfs-in"></div></div>';
    document.body.appendChild(sh);card=sh.querySelector('.pfs-card');
    sh.addEventListener('click',function(e){
      if(e.target.closest('[data-pfx]')){close();return;}
      var c=e.target.closest('[data-copy]');if(c){copy(c);}
    });
  }
  function copy(b){
    var v=b.getAttribute('data-copy'),done=function(){b.classList.add('ok');b.textContent='Copied';setTimeout(function(){b.classList.remove('ok');b.textContent='Copy';},1800);};
    try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(v).then(done,fb);return;}}catch(e){}
    fb();
    function fb(){try{var t=document.createElement('textarea');t.value=v;t.setAttribute('readonly','');t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();done();}catch(e){}}
  }
  function open(k,btn){
    var d=band.querySelector('[data-pfd="'+k+'"]');if(!d)return;
    if(!sh)build();
    last=btn||null;
    card.style.setProperty('--pc',getComputedStyle(btn).getPropertyValue('--pc')||'#3b8bff');
    card.querySelector('.pfs-in').innerHTML=d.innerHTML;
    sh.hidden=false;card.scrollTop=0;
    try{var ph=innerWidth<=640;sh.querySelector('.pfs-bd').animate([{opacity:0},{opacity:1}],{duration:200,easing:'ease-out'});card.animate(ph?[{transform:'translateY(40px)',opacity:.4},{transform:'none',opacity:1}]:[{transform:'translateY(14px) scale(.98)',opacity:0},{transform:'none',opacity:1}],{duration:260,easing:'cubic-bezier(.2,.8,.25,1)'});}catch(e){}
    try{card.querySelector('.pfs-x').focus({preventScroll:true});}catch(e){}
    try{navigator.sendBeacon&&navigator.sendBeacon('/api/track?t=event&e='+encodeURIComponent('propfirm:'+k)+'&p='+encodeURIComponent(location.pathname));}catch(e){}
  }
  function close(){if(!sh||sh.hidden)return;sh.hidden=true;if(last)try{last.focus({preventScroll:true});}catch(e){}}
  band.addEventListener('click',function(e){var b=e.target.closest('[data-pf]');if(b)open(b.getAttribute('data-pf'),b);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&sh&&!sh.hidden)close();});
  window.__mpPropFirm={open:open,close:close};
})();</script>
