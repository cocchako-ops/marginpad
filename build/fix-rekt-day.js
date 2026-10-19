#!/usr/bin/env node
/* /rekt/ ANSWERS THE DAY FROM THE SERVER INSTEAD OF STORING IT ON THE DEVICE (2026-10-19, owner: "ja hocu da
   rekt bude i na telefonu sa dnevnim podacima (zadnja 24h) ... mislim da je problem da toliko podataka cuvamo
   korisniku na uredjaju ... napravi to da bude izvodljivo").

   He was right about the cause and it was never a phone limit. Every day-wide figure on the page was computed
   from `dayAll`, the browser's own store, which the backfill seeds with `/api/v1/feed?limit=3000&since=midnight`
   - the NEWEST 3,000 prints, which on a real day is about three hours. So:
     - "By hour" had three filled candles out of twenty-four and said "$38.6M - 2,874 prints since 13:40 UTC";
     - "Top hits today" could not see the morning, which is why the owner's chart showed a BTC liquidation over
       $1M that /rekt/ did not;
     - a narrow filter (BTC over $1K) found two rows on a phone, because `all` is capped at 200 across every coin.
   And holding a real day on the device is not the fix: the market prints ~22,000 liquidations over $1K in 24h,
   about 2 MB of raw JSON, on an audience that is mostly mobile.

   MEASURED, which is what decided the shape (all through the worker, gzipped on the wire):
     - market-wide hour histogram, complete .... /api/v1/liqseries?symbol=ALL ............  7 KB
     - the day's biggest hits, complete ....... /api/v1/feed?min=250000&since=midnight ...  1 KB
     - BTC over $1K today, server-filtered .... /api/v1/liquidations/live?...&since= ..... 17 KB
   25 KB for the whole day against ~2 MB to hold it. The device stores aggregates; the server does the scanning.

   Both endpoints grew what they needed on the collector the same day (symbol=ALL on the series, an optional
   `since` on live). Idempotent; --dry prints what it would do and writes nothing. */
'use strict';
const fs = require('fs');
const path = require('path');

const F = path.join(__dirname, '..', 'dist', 'rekt', 'index.html');
const DRY = process.argv.indexOf('--dry') >= 0;

let h = fs.readFileSync(F, 'utf8');
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const before = h;
const done = [];
const skipped = [];

/* THIS FILE HAS MIXED LINE ENDINGS. It is CRLF, but an earlier patcher (fix-rekt-window.js) inserted its block
   with bare \n, so a multi-line marker built from the file's dominant ending matches nothing in exactly the
   region this patch has to touch. Try both, and emit in the file's dominant ending. */
function find(anchor) {
  for (const eol of [N, N === '\r\n' ? '\n' : '\r\n']) {
    const a = anchor.split('\r\n').join('\n').split('\n').join(eol);
    const n = h.split(a).length - 1;
    if (n === 1) return a;
    if (n > 1) throw new Error('anchor appears ' + n + ' times with ' + JSON.stringify(eol));
  }
  return null;
}
function one(name, anchor, replacement, opts) {
  const o = opts || {};
  if (o.skipIf && find(o.skipIf) ) { skipped.push(name + ' (already applied)'); return; }
  if (o.skipIf && h.indexOf(o.skipIf.split('\r\n').join('\n')) >= 0) { skipped.push(name + ' (already applied)'); return; }
  const a = find(anchor);
  if (!a) throw new Error(name + ': anchor not found (tried both line endings)');
  h = h.split(a).join(replacement);
  done.push(name);
}

/* ---------------------------------------------------------------- 1. state + the day loaders -------------- */
const A_STATE = "var feed=document.getElementById('rkFeed'), seen={}, all=[], fSide='all', fMin=0, fSym='', paused=false, animated={}, firstRender=true;";
one('state + day loaders', A_STATE, A_STATE + N + [
  "  /* ===== THE DAY COMES FROM THE SERVER (2026-10-19) =====",
  "     `all` (200 rows) and `dayAll` (the newest ~3,000 prints the backfill reached) are a LIVE SAMPLE, not the day.",
  "     Every day-wide figure now reads one of three server answers instead, each a few kilobytes: the market-wide",
  "     5-minute series for the hour histogram, the day's big prints for Top hits, and - only when the reader has",
  "     narrowed the tape - that filter applied on the server over today. Nothing holds a day of prints on the device. */",
  "  var dayMid=(function(){var d=new Date();d.setUTCHours(0,0,0,0);return d.getTime();})();",
  "  function dayMins(){return Math.max(5,Math.ceil((Date.now()-dayMid)/60000));} // TODAY, never a rolling 24h: the axis is labelled 00..23 UTC, and a rolling window would fold yesterday evening into tonight's bars",
  "  var dayH=null,dayTot=0,dayN=0,dayAt=0;          // the true per-hour histogram for today, market-wide",
  "  var topDay=null,topAt=0;                        // every print over $250K today - complete, 1 KB",
  "  var filtRows=null,filtKey='',filtAt=0,filtBusy=false,filtAll=true; // the reader's filter, answered over today by the server",
  "  function fNarrow(){return !!fSym||fMin>1000;}",
  "  function fKey(){return (fSym||'')+'|'+Math.max(fMin,1000);}",
  "  /* the ONE reading of 'the deepest set of matching rows we hold': the server's day while a filter is narrow,",
  "     otherwise the local store. Both the phone feed and the desktop tape go through it, so they cannot disagree. */",
  "  function dayRows(){",
  "    if(filtRows&&filtKey===fKey())return filtRows;",
  "    return (typeof dayAll!=='undefined'&&dayAll)?dayAll:[];",
  "  }",
  "  function loadDaySeries(force){if(REKT_MAINT)return;",
  "    if(!force&&Date.now()-dayAt<60000)return;dayAt=Date.now();",
  "    fetch('/api/v1/liqseries?symbol=ALL&minutes='+dayMins()).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){",
  "      if(!j||!Array.isArray(j.buckets)||!j.buckets.length)return; // keep whatever we had; paintHits falls back to the local store",
  "      var H=[],i;for(i=0;i<24;i++)H.push({l:0,s:0,n:0});var tot=0,n=0;",
  "      j.buckets.forEach(function(b){var hh=new Date(+b.t).getUTCHours();if(hh<0||hh>23)return;",
  "        var l=+b.long||0,s=+b.short||0,c=(+b.longN||0)+(+b.shortN||0);",
  "        H[hh].l+=l;H[hh].s+=s;H[hh].n+=c;tot+=l+s;n+=c;});",
  "      dayH=H;dayTot=tot;dayN=n;try{paintHits(true);}catch(_e){}",
  "    });}",
  "  function loadTopDay(force){if(REKT_MAINT)return;",
  "    if(!force&&Date.now()-topAt<120000)return;topAt=Date.now();",
  "    fetch('/api/v1/feed?min=250000&since='+dayMid+'&limit=3000').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){",
  "      if(!j||!Array.isArray(j.events))return;",
  "      topDay=j.events.filter(function(e){return validSym(e.symbol);});try{paintHits(true);}catch(_e){}",
  "    });}",
  "  function loadFiltered(force){if(REKT_MAINT)return;",
  "    if(!fNarrow()){if(filtRows){filtRows=null;filtKey='';}return;}",
  "    var k=fKey();if(filtBusy)return;if(!force&&k===filtKey&&Date.now()-filtAt<45000)return;",
  "    filtBusy=true;filtAt=Date.now();var mn=Math.max(fMin,1000);",
  "    /* one coin -> the collector filters by symbol (indexed); a size floor with no coin -> the market-wide feed,",
  "       which has always honoured `min` server-side. Either way what comes back is ALL matching rows of today,",
  "       newest first, capped so the payload stays a phone-sized download. */",
  "    var u=fSym?('/api/v1/liquidations/live?symbol='+encodeURIComponent(fSym)+'&min='+mn+'&limit=1000&since='+dayMid)",
  "              :('/api/v1/feed?min='+mn+'&since='+dayMid+'&limit=3000');",
  "    fetch(u).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(j){",
  "      filtBusy=false;",
  "      if(k!==fKey())return; // the reader moved on while this was in flight - a late answer must never paint another filter",
  "      if(!j||!Array.isArray(j.events)){filtRows=null;filtKey='';return;}",
  "      filtRows=j.events.filter(function(e){return validSym(e.symbol);}).sort(function(a,b){return b.ts-a.ts;});",
  "      filtKey=k;filtAll=fSym?(j.complete!==false):(j.events.length<3000); // did the answer cover the whole day, or hit its cap",
  "      render();try{deskRenderAll();}catch(_e){}",
  "    });}",
  "  var _fqT=0;",
  "  function filtSoon(){clearTimeout(_fqT);_fqT=setTimeout(function(){loadFiltered();},380);} // the coin box fires per keystroke",
].join(N), { skipIf: 'function loadDaySeries(' });

/* ---------------------------------------------------------------- 2. the phone feed reads dayRows() ------- */
const A_MOB = [
  "    var list=all.filter(matchF);",
  "    if(list.length<60&&typeof dayAll!=='undefined'&&dayAll&&dayAll.length>all.length){",
  "      list=dayAll.filter(matchF).sort(function(a,b){return b.ts-a.ts;});",
  "    }",
].join(N);
one('phone feed reads the day', A_MOB, [
  "    var list=all.filter(matchF);",
  "    if(list.length<60){var _d=dayRows();if(_d.length>all.length)list=_d.filter(matchF).sort(function(a,b){return b.ts-a.ts;});}",
].join(N), { skipIf: 'if(list.length<60){var _d=dayRows();' });

/* ---------------------------------------------------------------- 3. the desktop tape reads dayRows() ----- */
one('desktop tape reads the day',
  "    tapeList=dayAll.filter(matchF).sort(function(a,b){return b.ts-a.ts;});tapeIdx=0;",
  "    tapeList=dayRows().filter(matchF).sort(function(a,b){return b.ts-a.ts;});tapeIdx=0;",
  { skipIf: 'tapeList=dayRows().filter(matchF)' });

/* ---------------------------------------------------------------- 4. the tape's foot line ----------------- */
one('tape foot states its reach',
  "    if(tapeIdx>=tapeList.length){var fin=document.createElement('div');fin.className='rk-empty';fin.style.padding='18px 0';fin.textContent=__esT_rektindex(\"startOfTheDay\",'- start of the day (UTC) -');tapeEl.appendChild(fin);}}",
  [
    "    if(tapeIdx>=tapeList.length){var fin=document.createElement('div');fin.className='rk-empty';fin.style.padding='18px 0';",
    "      // say which end this is: the day's first print, or as far back as one request reaches. Never imply the former.",
    "      fin.textContent=(fNarrow()&&!filtAll)?__esT_rektindex(\"asFarBackAsWeLoaded\",'- as far back as this filter loaded -'):__esT_rektindex(\"startOfTheDay\",'- start of the day (UTC) -');",
    "      tapeEl.appendChild(fin);}}",
  ].join(N),
  { skipIf: 'asFarBackAsWeLoaded' });

/* ---------------------------------------------------------------- 5. hours + top hits from the server ----- */
const A_HITS_TOP = "    var top=dayAll.slice().sort(function(a,b){return b.notional-a.notional;}).slice(0,8);";
one('top hits over the whole day', A_HITS_TOP, [
  "    /* the day's biggest, from the complete over-$250K pull plus whatever the live stream has added since.",
  "       `dayAll` alone could only ever see as far back as the backfill reached - a few hours on a busy day. */",
  "    var _seenT={},_src=(topDay||[]).concat(dayAll),top=[];",
  "    _src.forEach(function(e){var k=e.ts+'|'+e.symbol+'|'+e.price+'|'+e.exchange;if(_seenT[k])return;_seenT[k]=1;top.push(e);});",
  "    top=top.sort(function(a,b){return b.notional-a.notional;}).slice(0,8);",
].join(N), { skipIf: 'var _seenT={},_src=(topDay||[])' });

const A_HOURS = [
  "    var H=[],i;for(i=0;i<24;i++)H.push({l:0,s:0,n:0});",
  "    dayAll.forEach(function(e){var hh=new Date(e.ts).getUTCHours();if(e.side==='long_liquidated')H[hh].l+=+e.notional;else H[hh].s+=+e.notional;H[hh].n++;});",
].join(N);
/* UNDO FIRST (the pattern this repo learned the hard way): the first deploy of this patch shipped a histogram
   that trusted the series unconditionally, and a run where the series answer came back thin would then have
   shown FEWER hours than the browser could already see. Rewind that form to the original so the real edit below
   is the only definition of this block, whatever state the file is in. */
{
  const INTERMEDIATE = [
    "    /* THE HISTOGRAM IS THE SERVER'S OWN 5-MINUTE AGGREGATE, so all twenty-four hours are real and it counts",
    "       EVERY liquidation rather than the ones a $1K-floored feed happened to carry. The local derivation stays",
    "       as the fallback for when the collector cannot be reached, hatching included. */",
    "    var H=[],i,srv=!!dayH;",
    "    if(srv){for(i=0;i<24;i++)H.push({l:dayH[i].l,s:dayH[i].s,n:dayH[i].n});}",
    "    else{for(i=0;i<24;i++)H.push({l:0,s:0,n:0});",
    "      dayAll.forEach(function(e){var hh=new Date(e.ts).getUTCHours();if(e.side==='long_liquidated')H[hh].l+=+e.notional;else H[hh].s+=+e.notional;H[hh].n++;});}",
  ].join(N);
  const a = find(INTERMEDIATE);
  if (a) { h = h.split(a).join(A_HOURS.split('\r\n').join('\n').split('\n').join(N)); done.push('rewound the first-cut histogram block'); }
}
one('hour histogram from the market-wide series', A_HOURS, [
  "    /* THE HISTOGRAM IS THE SERVER'S OWN 5-MINUTE AGGREGATE, so all twenty-four hours are real and it counts",
  "       EVERY liquidation rather than the ones a $1K-floored feed happened to carry. The local derivation is",
  "       still computed, for two reasons: it is the fallback when the collector cannot be reached (hatching and",
  "       all), and it is the FLOOR - a thin or half-built series answer must never replace hours this browser has",
  "       genuinely watched, so the server's version is used only when it covers at least as many of them. */",
  "    var H=[],i,Hloc=[];",
  "    for(i=0;i<24;i++)Hloc.push({l:0,s:0,n:0});",
  "    dayAll.forEach(function(e){var hh=new Date(e.ts).getUTCHours();if(e.side==='long_liquidated')Hloc[hh].l+=+e.notional;else Hloc[hh].s+=+e.notional;Hloc[hh].n++;});",
  "    var _fl=function(A){var c=0;A.forEach(function(x){if(x.l+x.s>0)c++;});return c;};",
  "    var srv=!!dayH&&_fl(dayH)>=_fl(Hloc);",
  "    if(srv){for(i=0;i<24;i++)H.push({l:dayH[i].l,s:dayH[i].s,n:dayH[i].n});}",
  "    else H=Hloc;",
].join(N), { skipIf: 'var srv=!!dayH&&_fl(dayH)>=_fl(Hloc);' });

const A_FROM = "    var oldest=Infinity;dayAll.forEach(function(e){if(e.ts<oldest)oldest=e.ts;});var fromH=isFinite(oldest)?new Date(oldest).getUTCHours():0,fromMin=isFinite(oldest)?new Date(oldest).getUTCMinutes():0;";
one('no hatching once the day is complete', A_FROM, [
  "    var fromH=0,fromMin=0;",
  "    if(!srv){var oldest=Infinity;dayAll.forEach(function(e){if(e.ts<oldest)oldest=e.ts;});",
  "      fromH=isFinite(oldest)?new Date(oldest).getUTCHours():0;fromMin=isFinite(oldest)?new Date(oldest).getUTCMinutes():0;}",
].join(N), { skipIf: 'var fromH=0,fromMin=0;' });

one('hatch only the hours we really did not see',
  "var lh=Math.round(x.l/mx*100),sh=Math.round(x.s/mx*100),nd=k<fromH;",
  "var lh=Math.round(x.l/mx*100),sh=Math.round(x.s/mx*100),nd=!srv&&k<fromH;",
  { skipIf: 'nd=!srv&&k<fromH;' });

/* the summary: with the server's series the totals are the day's own, not this browser's sample. Existing i18n
   keys only ("prints since" + "00:00 UTC"), so nothing falls back to English on the Spanish twin. */
const A_SUM = "    var tot=0,cnt=0,bh=0;H.forEach(function(x,k){tot+=x.l+x.s;cnt+=x.n;if(x.l+x.s>H[bh].l+H[bh].s)bh=k;});";
one('summary counts the real day', A_SUM, [
  "    var tot=0,cnt=0,bh=0;H.forEach(function(x,k){tot+=x.l+x.s;cnt+=x.n;if(x.l+x.s>H[bh].l+H[bh].s)bh=k;});",
  "    if(srv){tot=dayTot;cnt=dayN;}",
].join(N), { skipIf: 'if(srv){tot=dayTot;cnt=dayN;}' });

/* ---------------------------------------------------------------- 5b. yesterday must not land in hour 23 ---
   The collector FLOORS its own `since` to a 5-minute boundary, which moves it EARLIER - so asking for exactly
   the minutes since midnight still returns one bucket from 23:55 yesterday, and bucketing by UTC hour would
   add it to tonight's hour 23. Measured on the live answer: minutes=1106 reached back to 23:55. */
one('drop any bucket from before midnight',
  "      j.buckets.forEach(function(b){var hh=new Date(+b.t).getUTCHours();if(hh<0||hh>23)return;",
  "      j.buckets.forEach(function(b){if(+b.t<dayMid)return;var hh=new Date(+b.t).getUTCHours();if(hh<0||hh>23)return;",
  { skipIf: 'function(b){if(+b.t<dayMid)return;' });

/* ---------------------------------------------------------------- 5c. the phone can scroll back too -------
   The desktop tape has had infinite scroll over the day since it was built; the phone feed rendered the newest
   60 and stopped, so "see 24h back on the phone as well as the PC" was still half true after the filter went
   server-side. Same chunk size, a button rather than a scroll listener (a ticket is tall - 60 of them is already
   a long scroll, and an automatic append would run away from the thumb). */
one('phone feed pages back through the day', [
  "    list=list.slice(0,60);",
  "    feed.innerHTML=list.length?list.map(row).join(''):__esT_rektindex(\"noLiquidationsMatchThis\",'<div class=\"rk-empty\">No liquidations match this filter yet…</div>');",
].join(N), [
  "    /* the cap resets whenever the FILTER changes, here rather than in each handler - a deep link, a coin chip,",
  "       the search box and the size chips all land in render(), and one of them is always the one you forget. */",
  "    var _ck=fKey()+'|'+fSide;if(_ck!==mobKey){mobKey=_ck;mobCap=60;}",
  "    var _full=list.length;list=list.slice(0,mobCap);",
  "    feed.innerHTML=list.length?(list.map(row).join('')+(_full>mobCap?'<button class=\"rk-more\" type=\"button\" data-more>'+__esT_rektindex(\"loadOlder\",'Load older')+' <small>'+(_full-mobCap).toLocaleString('en-US')+'</small></button>':'')):__esT_rektindex(\"noLiquidationsMatchThis\",'<div class=\"rk-empty\">No liquidations match this filter yet…</div>');",
].join(N), { skipIf: 'var _full=list.length;list=list.slice(0,mobCap);' });

one('phone paging state + handler', "  function fNarrow(){return !!fSym||fMin>1000;}", [
  "  var mobCap=60,mobKey=''; // the phone feed shows this many tickets; 'Load older' raises it, any filter change resets it",
  "  function fNarrow(){return !!fSym||fMin>1000;}",
  /* the skipIf has to match what this WRITES, not an earlier draft of it: it said 'var mobCap=60;' while the
     line shipped as 'var mobCap=60,mobKey=...', so the guard never matched and a second run declared it twice. */
].join(N), { skipIf: 'var mobCap=60,mobKey' });

one('wire Load older', "  var rkP=document.getElementById('rkPause');", [
  "  feed.addEventListener('click',function(ev){var b=ev.target.closest&&ev.target.closest('[data-more]');if(!b)return;mobCap+=60;render();});",
  "  var rkP=document.getElementById('rkPause');",
].join(N), { skipIf: "ev.target.closest('[data-more]')" });

one('Load older style',
  "  .rk-empty{color:var(--lqink3);text-align:center;padding:48px 0;font-family:'Space Mono',monospace;letter-spacing:.04em}",
  [
    "  .rk-empty{color:var(--lqink3);text-align:center;padding:48px 0;font-family:'Space Mono',monospace;letter-spacing:.04em}",
    "  .rk-more{display:block;width:100%;margin:10px 0 2px;padding:13px 0;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;color:var(--lqink2);font-family:'Space Mono',monospace;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:background .15s,border-color .15s}",
    "  .rk-more:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.2)}",
    "  .rk-more small{font-size:10.5px;letter-spacing:.04em;text-transform:none;color:var(--lqink3)}",
  ].join(N),
  { skipIf: '.rk-more{display:block' });

/* ---------------------------------------------------------------- 5d. force really forces ------------------
   paintHits() takes no argument and throttles itself at 4 s, so every `paintHits(true)` written above was
   silently throttled - the histogram would have waited for the next deskSide tick after its data landed. */
one('paintHits honours force',
  "  function paintHits(){var now=Date.now();if(now-_hitsT<4000)return;_hitsT=now;",
  "  function paintHits(force){var now=Date.now();if(!force&&now-_hitsT<4000)return;_hitsT=now;",
  { skipIf: 'function paintHits(force){' });

/* ---------------------------------------------------------------- 5e. the day's biggest, not the tab's ------
   "Biggest hit - today" read `sessBig`, which is the biggest print the PAGE has seen: the backfill's few hours
   plus whatever has streamed since. Opened in the afternoon it could not know about ETH at $11.81M at 01:21.
   The complete over-$250K day pull is already in hand, so raise sessBig from it - one assignment fixes the
   desktop card and the phone tile, because both already treat sessBig as "the biggest we know about". */
one('biggest hit covers the whole day',
  "      topDay=j.events.filter(function(e){return validSym(e.symbol);});try{paintHits(true);}catch(_e){}",
  [
    "      topDay=j.events.filter(function(e){return validSym(e.symbol);});",
    "      topDay.forEach(function(e){if(!sessBig||+e.notional>+sessBig.notional)sessBig=e;});",
    "      try{paintHits(true);}catch(_e){}try{deskSide();}catch(_e){}",
  ].join(N),
  { skipIf: 'if(!sessBig||+e.notional>+sessBig.notional)sessBig=e;' });

/* ---------------------------------------------------------------- 6. the headings must stop claiming a floor */
one('phone heading',
  'By hour <small>UTC · ≥ $1K · hatched = not watched</small>',
  'By hour <small>UTC · every venue · since 00:00</small>',
  { skipIf: 'By hour <small>UTC · every venue · since 00:00</small>' });
one('desktop heading',
  'By hour <small>UTC · prints ≥ $1K · hatched = hour not watched</small>',
  'By hour <small>UTC · every venue · since 00:00 · all exchanges</small>',
  { skipIf: 'By hour <small>UTC · every venue · since 00:00 · all exchanges</small>' });

/* ---------------------------------------------------------------- 7. wire the loaders -------------------- */
one('filter chips refetch', [
  "    if(b.hasAttribute('data-m')){fMin=+b.getAttribute('data-m');this.querySelectorAll('[data-m]').forEach(function(x){x.classList.remove('on');});b.classList.add('on');}",
  "    render();try{deskRenderAll();}catch(_e){}",
  "  });",
].join(N), [
  "    if(b.hasAttribute('data-m')){fMin=+b.getAttribute('data-m');this.querySelectorAll('[data-m]').forEach(function(x){x.classList.remove('on');});b.classList.add('on');}",
  "    render();try{deskRenderAll();}catch(_e){}try{loadFiltered();}catch(_e){}",
  "  });",
].join(N), { skipIf: "catch(_e){}try{loadFiltered();}catch(_e){}" + N + "  });" });

one('coin box refetch',
  "  if(rkQ)rkQ.addEventListener('input',function(){fSym=(rkQ.value||'').trim().toUpperCase();render();try{deskRenderAll();}catch(_e){}});",
  "  if(rkQ)rkQ.addEventListener('input',function(){fSym=(rkQ.value||'').trim().toUpperCase();render();try{deskRenderAll();}catch(_e){}try{filtSoon();}catch(_e){}});",
  { skipIf: 'catch(_e){}try{filtSoon();}catch(_e){}});' });

one('coin chip refetch',
  "    rkQ.value=(fSym===c?'':c);fSym=rkQ.value;render();deskRenderAll();if(window.__cgLast)deskCoins(window.__cgLast);});",
  "    rkQ.value=(fSym===c?'':c);fSym=rkQ.value;render();deskRenderAll();try{loadFiltered();}catch(_e){}if(window.__cgLast)deskCoins(window.__cgLast);});",
  { skipIf: 'deskRenderAll();try{loadFiltered();}catch(_e){}if(window.__cgLast)' });

/* kick them off beside the existing backfill, and keep them warm. The series is the page's cheapest poll by far
   (7 KB behind a shared edge cache) and it is what every day-wide number on the page now rests on. */
const A_BOOT = "  document.addEventListener('visibilitychange',function(){if(!document.hidden){if(!REKT_MAINT)poll();loadLiqStats();}});";
one('boot the day loaders', A_BOOT, [
  "  (function(){if(REKT_MAINT)return;loadDaySeries(true);loadTopDay(true);if(fNarrow())loadFiltered(true);",
  "    setInterval(function(){if(document.hidden)return;loadDaySeries();loadTopDay();if(fNarrow())loadFiltered();},60000);})();",
  A_BOOT.replace("loadLiqStats();}});", "loadLiqStats();loadDaySeries();loadTopDay();if(fNarrow())loadFiltered();}});"),
].join(N), { skipIf: 'loadDaySeries(true);loadTopDay(true);' });

/* ---------------------------------------------------------------- report ---------------------------------- */
if (!done.length) {
  console.log('fix-rekt-day: nothing to do' + (skipped.length ? ' (' + skipped.length + ' already applied)' : ''));
  process.exit(0);
}
// tag balance is the cheap structural check the hublinks incident earned
const opens = (h.match(/<div/g) || []).length, closes = (h.match(/<\/div>/g) || []).length;
const o0 = (before.match(/<div/g) || []).length, c0 = (before.match(/<\/div>/g) || []).length;
if (opens - closes !== o0 - c0) throw new Error('div balance changed: ' + (opens - closes) + ' vs ' + (o0 - c0));

console.log('fix-rekt-day: ' + done.length + ' edits -> ' + done.join(', '));
if (skipped.length) console.log('  skipped: ' + skipped.join(', '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
fs.writeFileSync(F, h);
console.log('  written: dist/rekt/index.html (' + (h.length - before.length > 0 ? '+' : '') + (h.length - before.length) + ' bytes)');
