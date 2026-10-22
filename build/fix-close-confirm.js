#!/usr/bin/env node
/* A CLOSE PRINTS THE SERVER'S NUMBER, AND A PRICE SAYS HOW OLD IT IS (2026-10-22, FSNKingKash: "profitable when I
   closed, then a loss").

   MEASURED on his account: ADA long srvmviq57bl3bm, opened 23:09:26 at 0.22603. His browser's own close beacon said
   "win +17.61"; the ledger booked -2.55 at 0.22599 two seconds later - and Bybit's 1m candle for that minute is
   0.2257-0.2259, so the server was right. To print +17.61 his browser had to hold ADA at 0.22827, a price the market
   last printed ~80 minutes earlier; ten minutes before, the same browser closed two ADA rows at the correct 0.2257.
   Two holes, both closed here:

   1. NOTHING CHECKED THE AGE OF A REST PRICE. /api/price answered {sym,price,chg} with no timestamp and every
      consumer stamped it t:Date.now() - a stale body became "live" the moment it was read. And the edge was
      rewriting the worker's max-age=5 to max-age=14400 on cached hits (a zone Cache-TTL override; measured). Now the
      body carries ts + age (server clock, so a wrong device clock cannot make a fresh price look stale), the response
      is private/no-store so no cache outside the worker's own 8 s synthetic key can ever hold it, and the worker's
      own two cached readers check ts instead of trusting whatever is in the cache. The client stamps a REST price at
      Date.now()-age, never moves a symbol's price BACKWARDS in time, marks a price older than 30 s STALE on every
      open ticket, and the plan form will not adopt one.

   2. A srv-row CLOSE WAS FIRE-AND-FORGET. The request went out, its answer was thrown away, and the LOCAL figure -
      from whatever price this browser held - was booked and shown; the server booked its own a second later and the
      ticket flipped. Now the sheet waits for the server (8 s, one retry, idempotent on a per-press coid so a lost
      answer can never close a second slice), books exit_price / pnl_usd / closed_ts from the response, and a close
      the server did not confirm stays OPEN with a visible reason - never a local invention. Guests and local rows
      are untouched: there is no server to ask.

   Idempotent, --dry. Refuses rather than guessing if any anchor is not exactly once.                             */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const R = path.join(__dirname, '..');
const F = {
  worker: path.join(R, 'src', 'worker.js'),
  home: path.join(R, 'dist', 'assets', 'home.js'),
  trade: path.join(R, 'dist', 'assets', 'mp-trade.js'),
  homecss: path.join(R, 'dist', 'assets', 'home.css'),
  tradecss: path.join(R, 'dist', 'assets', 'mp-trade.css'),
};
const src = {}; for (const k of Object.keys(F)) src[k] = fs.readFileSync(F[k], 'utf8');
const before = Object.assign({}, src);
const done = [];

function count(s, a) { return s.split(a).length - 1; }
function one(file, name, a, b, skipIf) {
  const h = src[file];
  if (skipIf && [].concat(skipIf).some(m => h.indexOf(m) >= 0)) return false;
  const n = count(h, a);
  if (n !== 1) throw new Error(file + ' / ' + name + ': anchor appears ' + n + ' times, expected 1');
  src[file] = h.split(a).join(b); // split/join, never String.replace - a $ in the replacement is live there
  done.push(file + ': ' + name);
  return true;
}

/* ───────────────────────────── WORKER ───────────────────────────── */

// 1. /api/price: ts + age in the body, private/no-store to the client, the synthetic 8 s cache keyed on ts
{
  const h = src.worker;
  const A = "    if (url.pathname === '/api/price') {";
  const B = "    if (url.pathname === '/api/klines')";
  if (h.indexOf('x-mp-age') < 0) {
    const i = h.indexOf(A), j = h.indexOf(B, i);
    if (i < 0 || j < 0 || count(h, A) !== 1) throw new Error('worker: /api/price route anchors not unique');
    const old = h.slice(i, j);
    if (old.indexOf("x-mp-cached") < 0 || old.indexOf('fetchPrice(sym)') < 0 || old.length > 3000) throw new Error('worker: /api/price route is not the shape this patch expects - refusing');
    const NEW = A + "\n"
      + "      const sym = String(url.searchParams.get('symbol') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');\n"
      + "      /* A PRICE SAYS HOW OLD IT IS (2026-10-22). The body carries `ts` (when the worker measured it) and `age`\n"
      + "         (ms since, on the SERVER clock - a device clock that is minutes off must not make a fresh price look\n"
      + "         stale), and the response is private/no-store: a zone Cache-TTL override was rewriting max-age=5 to\n"
      + "         max-age=14400 on edge hits, i.e. telling a browser to keep a live price for four hours (measured), and\n"
      + "         the 8 s guard below protects only requests that REACH the worker. The worker's own synthetic key is the\n"
      + "         only cache this is allowed to live in, and it is keyed on ts, never on what the edge decided. */\n"
      + "      const ck = new Request('https://marginpad.io/__price_' + sym);\n"
      + "      let pj = null, pts = 0, pst = 200;\n"
      + "      try { const hit = await caches.default.match(ck); if (hit) { const hj = await hit.json(); const ca = +(hj && hj.ts) || +hit.headers.get('x-mp-cached') || 0; const okHit = hj && +hj.price > 0; if (ca && Date.now() - ca < (okHit ? 8000 : 30000)) { pj = hj; pts = ca; pst = okHit ? 200 : 404; } } } catch (e) {}\n"
      + "      if (!pj) {\n"
      + "        const p = await fetchPrice(sym); pts = Date.now(); pst = p ? 200 : 404;\n"
      + "        pj = p ? Object.assign({}, p, { ts: pts }) : { error: 'not found', ts: pts };\n"
      + "        try { await caches.default.put(ck, new Response(JSON.stringify(pj), { status: pst, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': p ? 'max-age=8' : 'max-age=30', 'x-mp-cached': String(pts) } })); } catch (e) {} // the worker's own 8 s coalescer (30 s for a miss, so a delisted symbol does not re-run the five upstream legs on every poll)\n"
      + "      }\n"
      + "      const page = Math.max(0, Date.now() - pts);\n"
      + "      return new Response(JSON.stringify(Object.assign({}, pj, { ts: pts, age: page })), { status: pst, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-mp-cached': String(pts), 'x-mp-age': String(page), ...CORS } });\n"
      + "    }\n";
    src.worker = h.slice(0, i) + NEW + h.slice(j);
    done.push('worker: /api/price carries ts + age and is private/no-store');
  }
}

// 2. fetchPriceCached: the cached object is trusted only while its own ts is under 8 s
one('worker', 'fetchPriceCached checks the age of its cached object',
  "    if (hit) { const j2 = await hit.json(); if (j2 && +j2.price > 0) return j2; }\n  } catch (e) {}\n  const pd = await fetchPrice(s2);\n  if (pd && +pd.price > 0) { try { await caches.default.put(new Request('https://marginpad.io/__price_' + s2), new Response(JSON.stringify(pd), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=5' } })); } catch (e) {} }\n  return pd;",
  "    if (hit) { const j2 = await hit.json(); if (j2 && +j2.price > 0 && +j2.ts > 0 && Date.now() - +j2.ts < 8000) return j2; } // ts is checked, never the cache's own TTL - the edge once held this key for hours (2026-10-22)\n  } catch (e) {}\n  const pd0 = await fetchPrice(s2);\n  const pd = pd0 && +pd0.price > 0 ? Object.assign({}, pd0, { ts: Date.now() }) : pd0;\n  if (pd && +pd.price > 0) { try { await caches.default.put(new Request('https://marginpad.io/__price_' + s2), new Response(JSON.stringify(pd), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=8', 'x-mp-cached': String(pd.ts) } })); } catch (e) {} }\n  return pd;",
  'ts is checked, never the cache');

// 3. fetchPriceFill: same, at its own 1 s horizon (2.5 s tolerance)
one('worker', 'fetchPriceFill checks the age of its cached object',
  "    if (hit) { const j = await hit.json(); if (j && +j.price > 0) return j; }\n    const pd = await fetchPrice(s2);\n    if (pd && +pd.price > 0) { try { await caches.default.put(ck, new Response(JSON.stringify(pd), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=1' } })); } catch (e) {} }\n    return pd;",
  "    if (hit) { const j = await hit.json(); if (j && +j.price > 0 && +j.ts > 0 && Date.now() - +j.ts < 2500) return j; } // a fill price older than its own horizon is refetched, whatever the cache says (2026-10-22)\n    const pd0 = await fetchPrice(s2);\n    const pd = pd0 && +pd0.price > 0 ? Object.assign({}, pd0, { ts: Date.now() }) : pd0;\n    if (pd && +pd.price > 0) { try { await caches.default.put(ck, new Response(JSON.stringify(pd), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=1', 'x-mp-cached': String(pd.ts) } })); } catch (e) {} }\n    return pd;",
  'a fill price older than its own horizon');

// 4. /api/trade/close forwards the client's per-press coid, so a retried request can never close twice
one('worker', '/close forwards coid',
  "{ uid, id: String(b.id), pct: b.pct, pid: b.pid, prices, via: 'site', promos: _prm, e2: !!adminUid && /^e2e/i.test(String(uid)) }",
  "{ uid, id: String(b.id), pct: b.pct, pid: b.pid, coid: (b.coid ? String(b.coid).slice(0, 64) : undefined), prices, via: 'site', promos: _prm, e2: !!adminUid && /^e2e/i.test(String(uid)) }",
  "coid: (b.coid ? String(b.coid).slice(0, 64) : undefined), prices, via: 'site'");

// 5. DO /botclose: the PARTIAL branch records its coid too - a retried partial used to close a second slice
one('worker', '/botclose partial close is idempotent on coid',
  "        part.sc = 1;\n        this._syncJournal(uid, [rem, part], b.promos, true, b.via === 'bot' ? 'bot' : 'site');\n        return this.j({ ok: true, closed:",
  "        part.sc = 1;\n        this._syncJournal(uid, [rem, part], b.promos, true, b.via === 'bot' ? 'bot' : 'site');\n        if (_ccoid) { try { sql.exec('INSERT OR IGNORE INTO botidem(uid,coid,tid,ts) VALUES(?,?,?,?)', uid, 'c:' + _ccoid, String(part.id), Date.now()); } catch (e) {} } // the full branch has recorded its coid since 2.3; without this a retried PARTIAL closed a second slice (2026-10-22)\n        return this.j({ ok: true, closed:",
  "without this a retried PARTIAL closed a second slice");

/* ───────────────────────────── BUNDLES ───────────────────────────── */

const STALE_DEF = (acc) => "var _pe9=" + acc + ",_st9=!!(_pe9&&+_pe9.p>0&&+_pe9.t>0&&(Date.now()-_pe9.t)>30000&&e.status==='open');/* STALE = this symbol's price is older than 30 s: it is still shown, and said to be old (2026-10-22) */";

for (const file of ['home', 'trade']) {
  const T = file === 'home' ? '__esT_home' : '__esT_mptrade';

  // metrics() copies: add `stale`
  if (file === 'home') {
    one(file, 'metrics #1 computes stale',
      "function metrics(e){var live=(prices[e.sym]&&prices[e.sym].p)||",
      "function metrics(e){" + STALE_DEF('prices[e.sym]') + "var live=(prices[e.sym]&&prices[e.sym].p)||",
      "function metrics(e){var _pe9=prices[e.sym]");
    one(file, 'metrics #1 returns stale',
      "return {live:live,long:long,lev:lev,move:move,roe:roe,pnl:pnl,pnlNet:pnlNet,liq:liq,liqDist:liqDist,notional:notional,margin:margin};}",
      "return {live:live,long:long,lev:lev,move:move,roe:roe,pnl:pnl,pnlNet:pnlNet,liq:liq,liqDist:liqDist,notional:notional,margin:margin,stale:_st9};}",
      "notional:notional,margin:margin,stale:_st9};}");
  }
  one(file, 'metrics (drawer) computes stale',
    "function metrics(e){var px=window.mpLivePrices||{};var live=(px[e.sym]&&px[e.sym].p)||",
    "function metrics(e){var px=window.mpLivePrices||{};" + STALE_DEF('px[e.sym]') + "var live=(px[e.sym]&&px[e.sym].p)||",
    "function metrics(e){var px=window.mpLivePrices||{};var _pe9=px[e.sym]");
  one(file, 'metrics (drawer) returns stale',
    "return {live:live,long:long,lev:lev,move:move,roe:roe,pnl:pnl,pnlNet:pnlNet,liq:liq,liqDist:liqDist,margin:margin};}",
    "return {live:live,long:long,lev:lev,move:move,roe:roe,pnl:pnl,pnlNet:pnlNet,liq:liq,liqDist:liqDist,margin:margin,stale:_st9};}",
    "liqDist:liqDist,margin:margin,stale:_st9};}");

  // the close sheet's mx(): add `stale`
  one(file, 'mx computes stale',
    "function mx(e){var px=window.mpLivePrices||{};var live=(px[e.sym]&&px[e.sym].p)||e.entry;",
    "function mx(e){var px=window.mpLivePrices||{};" + STALE_DEF('px[e.sym]') + "var live=(px[e.sym]&&px[e.sym].p)||e.entry;",
    "function mx(e){var px=window.mpLivePrices||{};var _pe9=px[e.sym]");
  one(file, 'mx returns stale',
    "return{live:live,long:long,move:move,pnl:pnl,pnlNet:pnlNet,margin:margin,roe:roe,roeNet:roeNet};}",
    "return{live:live,long:long,move:move,pnl:pnl,pnlNet:pnlNet,margin:margin,roe:roe,roeNet:roeNet,stale:_st9};}",
    "roeNet:roeNet,stale:_st9};}");

  // the drawer card prints the stale state beside the price
  one(file, 'drawer card marks a stale price',
    "<span class=\"pp-live\">'+(e.lev||1)+'× · '+fpx(m.live,fpDp(e.entry))+'</span></div>'",
    "<span class=\"pp-live'+(m.stale?' stale':'')+'\">'+(e.lev||1)+'× · '+fpx(m.live,fpDp(e.entry))+(m.stale?' · '+" + T + "(\"priceStale\",'stale'):'')+'</span></div>'",
    "pp-live'+(m.stale?' stale':'')");
  one(file, 'drawer live update keeps the stale mark true',
    "var lv=card.querySelector('.pp-live');if(lv){var lvv=(e.lev||1)+'× · '+fpx(m.live,fpDp(e.entry));if(lv.textContent!==lvv)lv.textContent=lvv;}",
    "var lv=card.querySelector('.pp-live');if(lv){var lvv=(e.lev||1)+'× · '+fpx(m.live,fpDp(e.entry))+(m.stale?' · '+" + T + "(\"priceStale\",'stale'):'');if(lv.textContent!==lvv)lv.textContent=lvv;if(lv.classList.contains('stale')!==!!m.stale)lv.classList.toggle('stale',!!m.stale);}",
    "if(lv.classList.contains('stale')!==!!m.stale)");

  // the close sheet says so at the moment of decision
  one(file, 'close sheet names a stale feed',
    "(window.mpT&&window.mpT('rCloseFee'))||'closing fee')+'.'):'';",
    "(window.mpT&&window.mpT('rCloseFee'))||'closing fee')+'.'):'';\n    if(m.stale)_cfTxt+=' <b class=\"dn\">'+" + T + "(\"priceStaleNote\",'Your price feed is stale - a server-filled position closes at the live market price, not at this one.')+'</b>';",
    "if(m.stale)_cfTxt+=");
  one(file, 'sync() leaves the sheet alone while a close is in flight',
    "  function sync(){ var e=entry(); if(!e||e.status!=='open'){hide();return;}",
    "  function sync(){ if(_closing)return; var e=entry(); if(!e||e.status!=='open'){hide();return;}",
    "function sync(){ if(_closing)return;");

  // ES dictionary keys (the inline-JS layer, 2026-09-19 shape: a JSON object literal keyed by the English key)
  one(file, 'Spanish strings',
    "{\"thisDeviceRanOut\":",
    "{\"priceStale\":\"desactualizado\",\"priceStaleNote\":\"Tu fuente de precios está desactualizada: una posición ejecutada en el servidor se cierra al precio de mercado en vivo, no a este.\",\"closingWait\":\"Cerrando…\",\"closeRefused\":\"El servidor no cerró esta posición: \",\"closeNotConfirmed\":\"No se pudo contactar con el servidor: la posición sigue abierta. Inténtalo de nuevo.\",\"thisDeviceRanOut\":",
    "{\"priceStale\":\"desactualizado\"");

  // the close sheet: server-confirmed close for srv rows
  {
    const h = src[file];
    if (h.indexOf('function srvClose(body,tries)') < 0) {
      const A = "  function go(){ var d=jload(),e=null;for(var i=0;i<d.length;i++)if(d[i].id===curId){e=d[i];break;}";
      if (count(h, A) !== 1) throw new Error(file + ': go() head not unique');
      const i = h.indexOf(A);
      // go() ends with its confirmation toast ("savedToMyTrades") and then its own closing brace on a line of its own
      const te = h.indexOf('"savedToMyTrades"', i + A.length);
      const j0 = te > 0 ? h.indexOf('\n  }\n', te) : -1;
      if (te < 0 || j0 < 0 || j0 - i > 5000) throw new Error(file + ': go() end not found');
      const j = j0 + '\n  }\n'.length;
      const old = h.slice(i, j);
      if (old.indexOf('P0 dual-write') < 0 || old.indexOf("fetch('/api/trade/close'") < 0 || old.length > 5000) throw new Error(file + ': go() is not the shape this patch expects - refusing');
      // lift the partial-split block and the tail VERBATIM, so nothing here is retyped
      const pA = "    else{\n      var part={};", pB = "    }\n    jstore(d);hide();";
      const pi = old.indexOf(pA), pj = old.indexOf(pB, pi);
      if (pi < 0 || pj < 0) throw new Error(file + ': partial block not found');
      let partial = old.slice(pi + "    else{\n".length, pj);
      if (count(partial, "if(m.pnlNet!=null)pnl=m.pnlNet*f;") !== 1 || count(partial, "part.closeTs=Date.now();") !== 1) throw new Error(file + ': partial block anchors not unique');
      partial = partial.split("if(m.pnlNet!=null)pnl=m.pnlNet*f;").join("if(srv)pnl=srv.pnl;else if(m.pnlNet!=null)pnl=m.pnlNet*f;")
        .split("part.closeTs=Date.now();").join("part.closeTs=(srv?srv.closeTs:Date.now());if(srv)part.sc=1;");
      let tail = old.slice(pj + "    }\n".length); // from `jstore(d);hide();` to the end of go()
      if (file === 'home') { if (count(tail, 'mpcsCaptureTear(curId)') !== 1) throw new Error('home: tear anchor'); tail = tail.split('mpcsCaptureTear(curId)').join('mpcsCaptureTear(id)'); }
      const tl = tail.replace(/\s+$/, '');
      if (!/\}$/.test(tl)) throw new Error(file + ': go() tail does not end the function');
      const tailBody = tl.slice(0, -1); // without the function's closing brace
      const NEW =
        "  /* SERVER-CONFIRMED CLOSE (2026-10-22, FSNKingKash: \"profitable when I closed, then a loss\"). A server-filled row\n"
        + "     (src:'srv') used to close fire-and-forget: the request went out, its answer was thrown away, and the LOCAL\n"
        + "     number - from whatever price this browser held, which that day was 80 minutes stale - was booked and shown; the\n"
        + "     server booked its own a second later and the ticket flipped. The server's answer is the only number a srv close\n"
        + "     prints now: the sheet waits (8 s, one retry, idempotent on a per-press coid so a lost answer can never close a\n"
        + "     second slice), books exit_price / pnl_usd / closed_ts from the response, and a close the server did not confirm\n"
        + "     stays OPEN with a visible reason. Guests and local rows are untouched - there is no server to ask. MIRROR: the\n"
        + "     other close sheet (home.js <-> mp-trade.js). */\n"
        + "  var _closing=false;\n"
        + "  function T9(k,en){try{return " + T + "(k,en);}catch(_){return en;}}\n"
        + "  function note(msg,kind){try{if(window.mpToast)window.mpToast({msg:msg,kind:kind||'warn',ms:7000,key:'mpcs-'+(kind||'warn')});else if(window.mpLimitToast)window.mpLimitToast(msg);}catch(_){}}\n"
        + "  function setBusy(on){_closing=!!on;try{var b=ov&&ov.querySelector('.mpcs-go');if(b){b.disabled=!!on;if(on){b.setAttribute('data-l',b.textContent||'');b.textContent=T9(\"closingWait\",'Closing…');}else if(b.getAttribute('data-l')){b.textContent=b.getAttribute('data-l');b.removeAttribute('data-l');}}}catch(_){}}\n"
        + "  function srvClose(body,tries){\n"
        + "    var ctl=(typeof AbortController!=='undefined')?new AbortController():null,tm=ctl?setTimeout(function(){try{ctl.abort();}catch(_){}},8000):null;\n"
        + "    return fetch('/api/trade/close',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',keepalive:true,signal:ctl?ctl.signal:undefined,body:JSON.stringify(body)})\n"
        + "      .then(function(r){if(tm)clearTimeout(tm);return r.text().then(function(tx){var j=null;try{j=JSON.parse(tx);}catch(_){}if(r.status>=500||!j)throw new Error('srv '+r.status);return {st:r.status,j:j};});})\n"
        + "      .catch(function(err){if(tm)clearTimeout(tm);if(tries>1)return srvClose(body,tries-1);throw err;});\n"
        + "  }\n"
        + "  function go(){ var e=entry();\n"
        + "    if(!e||e.status!=='open'){hide();return;}\n"
        + "    if(_closing)return;\n"
        + "    var f=Math.min(100,Math.max(5,pct))/100;\n"
        + "    if(e.src==='srv'&&window.fetch){\n"
        + "      var _pid9=(f<1)?(String(e.id)+'p'+Date.now().toString(36)+Math.floor(Math.random()*1e3)):null; // shared part id → the local split and the server split converge on ONE row\n"
        + "      var _coid=String(e.id)+':'+Date.now().toString(36); // one press = one close, however many times the request has to be sent\n"
        + "      setBusy(true);\n"
        + "      srvClose({id:e.id,pct:Math.round(f*100),pid:_pid9,coid:_coid},2).then(function(res){ setBusy(false);\n"
        + "        var j=res.j||{},row=j.position||j.closed||null;\n"
        + "        if(j.ok&&row&&row.status&&row.status!=='open'){ apply(e.id,f,_pid9,{exit:+row.exit_price,pnl:+row.pnl_usd,closeTs:(+row.closed_ts>0?+row.closed_ts:Date.now()),part:(+row.partial_pct>0)}); return; }\n"
        + "        if(j.error==='already_closed'&&j.position&&j.position.status!=='open'){ var p2=j.position; apply(e.id,1,null,{exit:+p2.exit_price,pnl:+p2.pnl_usd,closeTs:(+p2.closed_ts>0?+p2.closed_ts:Date.now()),part:false}); return; } // a stop, a target or the sweep got there first - book what the server booked\n"
        + "        if(j.error==='not_found'){ apply(e.id,f,_pid9,null); return; } // the server never held this row (a local row wearing src:'srv') - the local close is all there is, as before\n"
        + "        note(T9(\"closeRefused\",'The server did not close this position: ')+String(j.message||j.error||res.st),'warn');\n"
        + "      }).catch(function(){ setBusy(false); note(T9(\"closeNotConfirmed\",'Could not reach the server - the position is still open. Try again.'),'warn'); });\n"
        + "      return;\n"
        + "    }\n"
        + "    apply(e.id,f,null,null);\n"
        + "  }\n"
        + "  /* srv = the SERVER's booked figures {exit,pnl,closeTs,part}; null = a local/guest row closed from this browser's price, exactly as before.\n"
        + "     The journal is re-read here, not carried over from go(): a pull can land while the server is answering, and writing a stale copy back would undo it. */\n"
        + "  function apply(id,f,_pid9,srv){ var d=jload(),e=null;for(var i=0;i<d.length;i++)if(d[i].id===id){e=d[i];break;}\n"
        + "    if(!e||e.status!=='open'){hide();done();return;} // the journal pull booked it meanwhile - nothing to write twice\n"
        + "    var m=mx(e); if(srv){m={live:(srv.exit>0?srv.exit:m.live),pnlNet:(isFinite(srv.pnl)?srv.pnl:m.pnlNet),move:m.move,margin:m.margin,long:m.long};}\n"
        + "    var pnl=0;\n"
        + "    if(f>=1||(srv&&!srv.part)){ f=1; fullClose(e,m); if(srv){e.closeTs=srv.closeTs;e.sc=1;} }\n"
        + "    else{\n"
        + partial
        + "    }\n"
        + tailBody
        + "  }\n";
      src[file] = h.slice(0, i) + NEW + h.slice(j);
      done.push(file + ': server-confirmed close (go/apply/srvClose)');
    }
  }
}

// home.js only: the price map never moves backwards, REST prices are stamped at their measured time, the plan form refuses a stale one
{
  one('home', 'mpPxT helper (REST price -> measured time, from the server-clock age)',
    "window.__mpPQ=window.__mpPQ||function(ctx,sym){",
    "window.mpPxT=window.mpPxT||function(pd){var a=pd&&+pd.age;return (isFinite(a)&&a>=0&&a<864e5)?Date.now()-a:Date.now();}; /* the time a REST price was MEASURED, from the server-clock `age` /api/price carries since 2026-10-22 - a device clock cannot skew it. No age (an old worker) = now, exactly as before. */\n"
    + "window.__mpPQ=window.__mpPQ||function(ctx,sym){",
    'window.mpPxT=window.mpPxT||');
  one('home', 'pollPrices stamps the measured time and never moves a symbol backwards',
    ".then(function(pd){if(pd&&pd.price>0){prices[sym]={p:+pd.price,t:Date.now(),chg:(pd.chg!=null?+pd.chg:(cur&&cur.chg))};",
    ".then(function(pd){if(pd&&pd.price>0){var _t9=window.mpPxT(pd),_c9=prices[sym];if(_c9&&+_c9.t>0&&_t9<=+_c9.t)return; /* an older measurement never overwrites a newer one - a stale REST body used to be stamped 'now' and win over the live tick */ prices[sym]={p:+pd.price,t:_t9,chg:(pd.chg!=null?+pd.chg:(cur&&cur.chg))};",
    'var _t9=window.mpPxT(pd),_c9=prices[sym]');
  one('home', 'the plan form refuses a stale REST price',
    ".then(function(pd){if(pd&&pd.price>0&&(!_wsT||Date.now()-_wsT>=6000)){live=+pd.price;",
    ".then(function(pd){if(pd&&pd.price>0&&(!_wsT||Date.now()-_wsT>=6000)&&!(isFinite(+pd.age)&&+pd.age>30000)){live=+pd.price;",
    "&&!(isFinite(+pd.age)&&+pd.age>30000)){live=+pd.price;");
  one('home', 'the WS bridge passes the measured time',
    ".then(function(j){if(j&&+j.price>0)emit(s,+j.price,(j.chg!=null?+j.chg:undefined));})",
    ".then(function(j){if(j&&+j.price>0)emit(s,+j.price,(j.chg!=null?+j.chg:undefined),window.mpPxT(j));})",
    "emit(s,+j.price,(j.chg!=null?+j.chg:undefined),window.mpPxT(j))");
  one('home', 'emit() takes a measured time and never moves backwards',
    "  function emit(sym,price,chg){\n    lastTick=Date.now();\n",
    "  function emit(sym,price,chg,ts){\n    var _t9=(ts>0)?+ts:Date.now(),_pv9=window.mpLivePrices[sym];if(ts>0&&_pv9&&+_pv9.t>0&&_t9<=+_pv9.t)return; // a REST answer measured before the price we already hold is not news (2026-10-22)\n    lastTick=Date.now();\n",
    "function emit(sym,price,chg,ts){");
  one('home', 'emit() stamps the measured time',
    "    window.mpLivePrices[sym]={p:price,t:Date.now(),chg:(chg!=null&&isFinite(chg))?chg:prev.chg};\n    pushHist(sym,price);",
    "    window.mpLivePrices[sym]={p:price,t:_t9,chg:(chg!=null&&isFinite(chg))?chg:prev.chg};\n    pushHist(sym,price);",
    "window.mpLivePrices[sym]={p:price,t:_t9,chg:");
  // the small ticket under the trade form
  one('home', 'small ticket marks a stale price',
    "<span class=\"ptl-live\">● <b class=\"ptl-px\">'+fpx(m.live,fpDp(e.entry))+'</b></span></div>'",
    "<span class=\"ptl-live'+(m.stale?' stale':'')+'\">● <b class=\"ptl-px\">'+fpx(m.live,fpDp(e.entry))+'</b>'+(m.stale?'<i class=\"ptl-old\">'+__esT_home(\"priceStale\",'stale')+'</i>':'')+'</span></div>'",
    "ptl-live'+(m.stale?' stale':'')");
  one('home', 'small ticket live update keeps the stale mark true',
    "px.classList.add(_up?'up':'dn');}}\n      var bar=row.querySelector('.ptl-bar');",
    "px.classList.add(_up?'up':'dn');}}\n      var _lv9=row.querySelector('.ptl-live');if(_lv9){var _oi9=_lv9.querySelector('.ptl-old');if(m.stale&&!_oi9){_lv9.classList.add('stale');_lv9.insertAdjacentHTML('beforeend','<i class=\"ptl-old\">'+__esT_home(\"priceStale\",'stale')+'</i>');}else if(!m.stale&&_oi9){_lv9.classList.remove('stale');_oi9.remove();}}\n      var bar=row.querySelector('.ptl-bar');",
    "var _lv9=row.querySelector('.ptl-live')");
}

// mp-trade.js only: its own poll stamps the measured time and never moves a symbol backwards
one('trade', 'drawer poll stamps the measured time and never moves a symbol backwards',
  "        var prev=window.mpLivePrices[sym]||{};\n        window.mpLivePrices[sym]={p:p,t:Date.now(),chg:(j&&j.chg!=null&&isFinite(j.chg))?+j.chg:prev.chg};",
  "        var prev=window.mpLivePrices[sym]||{};\n        var _t9=(function(pd){var a=pd&&+pd.age;return (isFinite(a)&&a>=0&&a<864e5)?Date.now()-a:Date.now();})(j); if(+prev.t>0&&_t9<=+prev.t)return; /* the measured time, from the server-clock age; an older measurement never overwrites a newer one (2026-10-22) */\n        window.mpLivePrices[sym]={p:p,t:_t9,chg:(j&&j.chg!=null&&isFinite(j.chg))?+j.chg:prev.chg};",
  "if(+prev.t>0&&_t9<=+prev.t)return;");

/* ───────────────────────────── CSS ───────────────────────────── */
const CSS_HOME = "\n/* STALE PRICE (2026-10-22): a price older than 30 s is still shown and said to be old - amber, never hidden */\n.ptl-live.stale b,.pp-live.stale{color:#f0b35a !important}\n.ptl-old{font-style:normal;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#f0b35a;margin-left:4px}\n";
if (src.homecss.indexOf('.ptl-live.stale b') < 0) { src.homecss = src.homecss.replace(/\s*$/, '\n') + CSS_HOME; done.push('home.css: stale price'); }
const CSS_TRADE = "\n/* STALE PRICE (2026-10-22), mirror of home.css */\n.pp-live.stale{color:#f0b35a !important}\n";
if (src.tradecss.indexOf('.pp-live.stale') < 0) { src.tradecss = src.tradecss.replace(/\s*$/, '\n') + CSS_TRADE; done.push('mp-trade.css: stale price'); }

/* ───────────────────────────── guards + write ───────────────────────────── */
if (!done.length) { console.log('fix-close-confirm: nothing to do (already applied)'); process.exit(0); }
for (const file of ['home', 'trade']) {
  const h = src[file];
  if (count(h, 'function srvClose(body,tries)') !== 1) throw new Error(file + ': srvClose not exactly once');
  if (count(h, 'function apply(id,f,_pid9,srv)') !== 1) throw new Error(file + ': apply not exactly once');
  if (h.indexOf('also close ON THE SERVER (fire-and-forget)') >= 0) throw new Error(file + ': the old fire-and-forget close survived'); // the OPEN path carries its own "P0 dual-write" comment and stays
  if (count(h, "fetch('/api/trade/close'") !== 1) throw new Error(file + ': /api/trade/close must be called from exactly one place');
  if (count(h, 'stale:_st9') < 2) throw new Error(file + ': stale is not returned by every metrics copy');
}
if (count(src.home, 'stale:_st9') !== 3) throw new Error('home: expected 3 metrics/mx copies returning stale, got ' + count(src.home, 'stale:_st9'));
if (count(src.worker, "'cache-control': 'private, no-store', 'x-mp-cached'") !== 1) throw new Error('worker: /api/price response shape');
for (const k of Object.keys(F)) { // bash-heredoc / replace() traps: no `$` or backslash damage, no size collapse
  if (src[k].length < before[k].length * 0.98) throw new Error(k + ' shrank by more than 2% - refusing');
}
console.log('fix-close-confirm: ' + done.length + ' edits\n  ' + done.join('\n  '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
for (const k of Object.keys(F)) { if (src[k] !== before[k]) { const tmp = F[k] + '.tmp'; fs.writeFileSync(tmp, src[k]); fs.renameSync(tmp, F[k]); console.log('  written: ' + path.relative(R, F[k]) + ' (' + (src[k].length - before[k].length >= 0 ? '+' : '') + (src[k].length - before[k].length) + ' bytes)'); } }
