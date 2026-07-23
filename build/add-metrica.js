/* Injects the Yandex.Metrica counter (110941944) right after <head> in every dist/*.html (idempotent).
   Yandex loves sites it can "see" through Metrica — helps Yandex indexing/ranking + gives session replay (Webvisor).
   Mirrors add-gtag.js. Runs in build.js; also mirrored into gen-home-live.js so quick homepage deploys keep it. */
const fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const METRICA = `
<!-- Yandex.Metrika counter -->
<script type="text/javascript">
    (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=110941944', 'ym');

    ym(110941944, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/110941944" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->`;
let n = 0, skip = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) {
      let h = fs.readFileSync(p, 'utf8');
      if (h.indexOf('mc.yandex.ru/metrika') >= 0 || h.indexOf('id=110941944') >= 0) { skip++; continue; }
      const i = h.indexOf('<head>');
      if (i >= 0) { h = h.slice(0, i + 6) + METRICA + h.slice(i + 6); fs.writeFileSync(p, h); n++; }
    }
  }
}
walk(DIST);
console.log('Yandex.Metrica injected into', n, 'files,', skip, 'already had it');
