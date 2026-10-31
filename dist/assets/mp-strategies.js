/* /strategies/: the wall of curves, the library, the drawer, compare and the lab.
   Everything that moves goes through element.animate or rAF: @keyframes do not render on a machine with animation effects
   off, and there is deliberately no reduced-motion branch. The card markup is also used by the generator (module.exports),
   so the static HTML a crawler reads and the live grid are one function. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.mpStrategies = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  /* The library draws its cards, drawer and compare from JSON, so the page twins' static translation cannot reach them.
     Labels go through H() by exact text; sentences with figures through T(). English is the key and the fallback. */
  var LANGS = {
    es: { 'Return': 'Retorno', 'Holding': 'Mantener', 'Max DD': 'DD máx.', 'Win rate': 'Acierto', 'Trades': 'Trades', 'Compare': 'Comparar', 'beat holding': 'batió a mantener', 'smoother than holding': 'más estable que mantener', 'few trades': 'pocos trades', 'Total return': 'Retorno total', 'Buy and hold': 'Comprar y mantener', 'Max drawdown': 'Drawdown máx.', 'Holding drawdown': 'Drawdown al mantener', 'Holding Sharpe': 'Sharpe al mantener', 'Volatility': 'Volatilidad', 'Profit factor': 'Factor de beneficio', 'Months up': 'Meses al alza', 'Strategy': 'Estrategia', 'Drawdown': 'Drawdown', 'Linear': 'Lineal', 'Did it hold up?': '¿Aguantó?', 'Year by year': 'Año por año', 'Every market': 'Cada mercado', 'Market': 'Mercado', 'ID': 'ID', 'TF': 'TF', 'Out of sample': 'Fuera de muestra', 'Sharpe, first 70%': 'Sharpe, primer 70%', 'Sharpe, last 30%': 'Sharpe, último 30%', 'Timeframe': 'Temporalidad', 'Fee per side %': 'Comisión por lado %', 'Slippage %': 'Deslizamiento %', 'Run it': 'Ejecutar', 'Replay': 'Repetir', 'Pause': 'Pausa', 'Click for details': 'Haz clic para ver detalles', 'Open details': 'Abrir detalles', 'Full page and downloads': 'Página completa y descargas', 'Practice it': 'Practícala', 'Add to compare': 'Añadir a comparar', 'In compare': 'En comparar', 'Pick one more': 'Elige una más', 'Loading results': 'Cargando resultados', 'Loading': 'Cargando', 'Running...': 'Ejecutando...', 'Run them together': 'Combínalas', 'How they move together': 'Cómo se mueven juntas', 'Sharpe, monthly': 'Sharpe, mensual', 'Max drawdown, monthly': 'Drawdown máx., mensual', 'Crypto': 'Cripto', 'Stocks': 'Acciones', 'Commodities': 'Materias primas', 'Indices': 'Índices', 'Forex': 'Forex' ,
      s1: '{n} estrategias en {c}.', s2: 'Crecimiento de $1, escala logarítmica, tras comisiones. Frente a simplemente mantener: {b} rindieron más, {s} tuvieron mejor Sharpe, {d} tuvieron menor drawdown.', s3: 'La primera parte del historial, el 70%, es una prueba y el 30% final, desde {d}, es otra. Una regla que solo funcionó en la primera parte no funcionó.', s4: '{n} mercados, igual peso, {a} a {b}', s5: 'Crecimiento de $1 en escala logarítmica, cesta de {c}. Cada una en la temporalidad que declara.', s6: 'Escribe un peso para cada una. La mezcla se reequilibra cada mes durante los {n} meses que comparten.', s7: '1,00 se mueven juntas, 0 sin relación. Los números bajos hacen que una mezcla sea más estable que sus partes.', s8: 'Registro en vivo desde {d}.', s9: 'El seguimiento empezó el {d}. Los resultados aparecen aquí tras el primer día completo.', s10: 'Sin retrospectiva: estas velas no existían cuando se publicó la regla. Cripto, antes de funding.', s11: 'Velas recientes, para que la respuesta hable de ahora y no de todo el historial.', s12: '{n} velas de {s}. Sin funding en esta prueba rápida; las cifras de la biblioteca lo incluyen.', s13: 'Menos de 30 trades dicen muy poco.', s14: 'No hay velas para este mercado en esta temporalidad. Prueba otra.', s15: 'No se pudieron cargar las velas. Inténtalo de nuevo.', s16: 'Ninguna de estas funciona en {c}.' },
    pt: { 'Return': 'Retorno', 'Holding': 'Manter', 'Max DD': 'DD máx.', 'Win rate': 'Acerto', 'Trades': 'Trades', 'Compare': 'Comparar', 'beat holding': 'bateu manter', 'smoother than holding': 'mais estável que manter', 'few trades': 'poucos trades', 'Total return': 'Retorno total', 'Buy and hold': 'Comprar e manter', 'Max drawdown': 'Drawdown máx.', 'Holding drawdown': 'Drawdown ao manter', 'Holding Sharpe': 'Sharpe ao manter', 'Volatility': 'Volatilidade', 'Profit factor': 'Fator de lucro', 'Months up': 'Meses em alta', 'Strategy': 'Estratégia', 'Drawdown': 'Drawdown', 'Linear': 'Linear', 'Did it hold up?': 'Se sustentou?', 'Year by year': 'Ano a ano', 'Every market': 'Cada mercado', 'Market': 'Mercado', 'ID': 'ID', 'TF': 'TF', 'Out of sample': 'Fora da amostra', 'Sharpe, first 70%': 'Sharpe, primeiros 70%', 'Sharpe, last 30%': 'Sharpe, últimos 30%', 'Timeframe': 'Timeframe', 'Fee per side %': 'Taxa por lado %', 'Slippage %': 'Slippage %', 'Run it': 'Executar', 'Replay': 'Replay', 'Pause': 'Pausar', 'Click for details': 'Clique para ver detalhes', 'Open details': 'Abrir detalhes', 'Full page and downloads': 'Página completa e downloads', 'Practice it': 'Pratique', 'Add to compare': 'Adicionar à comparação', 'In compare': 'Na comparação', 'Pick one more': 'Escolha mais uma', 'Loading results': 'Carregando resultados', 'Loading': 'Carregando', 'Running...': 'Executando...', 'Run them together': 'Combine-as', 'How they move together': 'Como se movem juntas', 'Sharpe, monthly': 'Sharpe, mensal', 'Max drawdown, monthly': 'Drawdown máx., mensal', 'Crypto': 'Cripto', 'Stocks': 'Ações', 'Commodities': 'Commodities', 'Indices': 'Índices', 'Forex': 'Forex',
      s1: '{n} estratégias em {c}.', s2: 'Crescimento de $1, escala logarítmica, após taxas. Contra simplesmente manter: {b} renderam mais, {s} tiveram Sharpe melhor, {d} tiveram drawdown menor.', s3: 'Os primeiros 70% do histórico são um teste e os últimos 30%, desde {d}, são outro. Uma regra que só funcionou na primeira parte não funcionou.', s4: '{n} mercados, peso igual, {a} a {b}', s5: 'Crescimento de $1 em escala logarítmica, cesta de {c}. Cada uma no timeframe que declara.', s6: 'Digite um peso para cada uma. A mistura rebalanceia todo mês ao longo dos {n} meses em comum.', s7: '1,00 se movem juntas, 0 sem relação. Números baixos deixam uma mistura mais estável que suas partes.', s8: 'Registro ao vivo desde {d}.', s9: 'O acompanhamento começou em {d}. Os resultados aparecem aqui após o primeiro dia completo.', s10: 'Sem retrospectiva: estes candles não existiam quando a regra foi publicada. Cripto, antes do funding.', s11: 'Candles recentes, para a resposta falar de agora e não de todo o histórico.', s12: '{n} candles de {s}. Sem funding neste teste rápido; os números da biblioteca o incluem.', s13: 'Menos de 30 trades dizem muito pouco.', s14: 'Sem candles para este mercado neste timeframe. Tente outro.', s15: 'Não foi possível carregar os candles. Tente de novo.', s16: 'Nenhuma destas roda em {c}.' },
    de: { 'Return': 'Rendite', 'Holding': 'Halten', 'Max DD': 'Max. DD', 'Win rate': 'Trefferquote', 'Trades': 'Trades', 'Compare': 'Vergleichen', 'beat holding': 'schlug Halten', 'smoother than holding': 'ruhiger als Halten', 'few trades': 'wenige Trades', 'Total return': 'Gesamtrendite', 'Buy and hold': 'Kaufen und halten', 'Max drawdown': 'Max. Drawdown', 'Holding drawdown': 'Drawdown beim Halten', 'Holding Sharpe': 'Sharpe beim Halten', 'Volatility': 'Volatilität', 'Profit factor': 'Profitfaktor', 'Months up': 'Monate im Plus', 'Strategy': 'Strategie', 'Drawdown': 'Drawdown', 'Linear': 'Linear', 'Did it hold up?': 'Hat es gehalten?', 'Year by year': 'Jahr für Jahr', 'Every market': 'Jeder Markt', 'Market': 'Markt', 'ID': 'ID', 'TF': 'TF', 'Out of sample': 'Out of Sample', 'Sharpe, first 70%': 'Sharpe, erste 70%', 'Sharpe, last 30%': 'Sharpe, letzte 30%', 'Timeframe': 'Timeframe', 'Fee per side %': 'Gebühr je Seite %', 'Slippage %': 'Slippage %', 'Run it': 'Starten', 'Replay': 'Replay', 'Pause': 'Pause', 'Click for details': 'Für Details klicken', 'Open details': 'Details öffnen', 'Full page and downloads': 'Ganze Seite und Downloads', 'Practice it': 'Üben', 'Add to compare': 'Zum Vergleich', 'In compare': 'Im Vergleich', 'Pick one more': 'Noch eine wählen', 'Loading results': 'Ergebnisse laden', 'Loading': 'Laden', 'Running...': 'Läuft...', 'Run them together': 'Zusammen laufen lassen', 'How they move together': 'Wie sie sich gemeinsam bewegen', 'Sharpe, monthly': 'Sharpe, monatlich', 'Max drawdown, monthly': 'Max. Drawdown, monatlich', 'Crypto': 'Krypto', 'Stocks': 'Aktien', 'Commodities': 'Rohstoffe', 'Indices': 'Indizes', 'Forex': 'Forex',
      s1: '{n} Strategien auf {c}.', s2: 'Wachstum von $1, Log-Skala, nach Gebühren. Gegenüber einfachem Halten: {b} brachten mehr, {s} hatten ein besseres Sharpe, {d} einen kleineren Drawdown.', s3: 'Die ersten 70% der Historie sind ein Test, die letzten 30% ab {d} ein zweiter. Eine Regel, die nur im ersten Teil funktionierte, hat nicht funktioniert.', s4: '{n} Märkte, gleich gewichtet, {a} bis {b}', s5: 'Wachstum von $1 auf Log-Skala, {c}-Korb. Jede auf dem Timeframe, den sie festlegt.', s6: 'Gib für jede ein Gewicht ein. Die Mischung wird monatlich neu gewichtet, über die {n} gemeinsamen Monate.', s7: '1,00 bewegt sich gemeinsam, 0 unabhängig. Niedrige Werte machen eine Mischung ruhiger als ihre Teile.', s8: 'Live-Bilanz seit {d}.', s9: 'Die Erfassung begann am {d}. Ergebnisse erscheinen hier nach dem ersten vollen Tag.', s10: 'Kein Rückblick: Diese Kerzen gab es nicht, als die Regel veröffentlicht wurde. Krypto vor Funding.', s11: 'Aktuelle Kerzen, damit die Antwort vom Jetzt handelt und nicht von der ganzen Historie.', s12: '{n} Kerzen von {s}. Kein Funding in diesem Schnelltest; die Zahlen der Bibliothek enthalten es.', s13: 'Unter 30 Trades sagen sehr wenig.', s14: 'Keine Kerzen für diesen Markt auf diesem Timeframe. Versuche einen anderen.', s15: 'Die Kerzen konnten nicht geladen werden. Versuche es erneut.', s16: 'Keine davon läuft auf {c}.' }
  };
  var LG = typeof document !== 'undefined' ? (document.documentElement.lang || 'en').slice(0, 2) : 'en', LD = LANGS[LG] || null;
  var P = LD ? '/' + LG : ''; // the twin's own path prefix
  var EN = { s1: '{n} strategies on {c}.', s2: 'Growth of $1, log scale, after fees. Against simply holding: {b} returned more, {s} had a better Sharpe, {d} had a smaller drawdown.', s3: 'The first 70% of the history is one test and the last 30%, from {d}, is another. A rule that only worked in the first part did not work.', s4: '{n} markets, equal weight, {a} to {b}', s5: 'Growth of $1 on a log scale, {c} basket. Each on the timeframe it declares.', s6: 'Type a weight for each. The mix rebalances monthly over the {n} months they share.', s7: '1.00 moves together, 0 unrelated. Low numbers are what make a mix smoother than its parts.', s8: 'Live record since {d}.', s9: 'Tracking started on {d}. Results appear here after the first full day.', s10: 'No hindsight here: these bars did not exist when the rule was published. Crypto is before funding.', s11: 'Recent candles, so the answer is about now and not the whole history.', s12: '{n} candles of {s}. No funding in this quick run; the library figures include it.', s13: 'Under 30 trades says very little.', s14: 'No candles for this market on this timeframe. Try another.', s15: 'Could not load the candles. Try again.', s16: 'None of these run on {c}.' };
  function T(k, v) { var t = (LD && LD[k]) || EN[k] || k; for (var x in v) t = t.split('{' + x + '}').join(v[x]); return t; }
  function H(html) { return LD ? html.replace(/>([^<>]+)</g, function (m, t) { var c = t.trim(), r = LD[c]; return r ? m.replace(c, r) : m; }) : html; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtRet(x) {
    if (x == null) return '-';
    var a = Math.abs(x), s = x > 0 ? '+' : x < 0 ? '-' : '';
    return s + (a >= 10000 ? Math.round(a / 1000).toLocaleString('en-US') + 'K' : a >= 100 ? Math.round(a).toLocaleString('en-US') : a.toFixed(1)) + '%';
  }
  function fmtPct(x, d) { return x == null ? '-' : (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(d == null ? 2 : d) + '%'; }
  function fmtNum(x, d) { return x == null ? '-' : (x < 0 ? '-' : '') + Math.abs(x).toFixed(d == null ? 2 : d); }
  function cl(x) { return x > 0 ? 'up' : x < 0 ? 'dn' : ''; }
  function sparkPath(v, w, h) {
    if (!v || v.length < 2) return '';
    var l = v.map(function (x) { return Math.log(Math.max(x, 1e-4)); }), min = Math.min.apply(null, l), max = Math.max.apply(null, l), r = max - min || 1;
    return l.map(function (x, i) { return (i ? 'L' : 'M') + (i / (l.length - 1) * w).toFixed(1) + ' ' + (h - 3 - (x - min) / r * (h - 8)).toFixed(1); }).join('');
  }
  var CLSLBL = { crypto: 'Crypto', stocks: 'Stocks', forex: 'Forex', commodities: 'Commodities', indices: 'Indices' };
  function cardHtml(r, cn, styles) {
    var c = r.classes[cn]; if (!c) return '';
    var m = c.m, dir = m.ret >= 0 ? 'up' : 'dn', sp = sparkPath(c.spark, 320, 110), beat = m.ret > c.bench;
    return H('<a class="sc" href="' + P + '/strategies/' + r.slug + '/" data-open="' + r.slug + '" data-id="' + r.id + '">'
      + '<div class="sc-top ' + dir + '"><div class="sc-tags"><b>' + r.id + '</b><span>' + esc(c.tf) + '</span>' + (beat ? '<span class="beat">beat holding</span>' : !c.thin && m.sharpe > c.benchS ? '<span class="beat">smoother than holding</span>' : '') + '</div>'
      + '<button type="button" class="sc-cmp" data-cmp="' + r.slug + '" aria-label="Compare ' + esc(r.name) + '">Compare</button>'
      + '<svg viewBox="0 0 320 110" preserveAspectRatio="none" aria-hidden="true"><path class="fill" d="' + sp + 'L320 110L0 110Z"/><path class="ln" d="' + sp + '"/></svg>'
      + '<p class="sc-rule">' + esc(r.summary) + '</p></div>'
      + '<div class="sc-b"><h3>' + esc(r.name) + '</h3><div class="sc-st">' + esc(styles[r.style] || r.style) + (c.thin ? ' · few trades' : '') + '</div>'
      + '<dl>'
      + '<div><dt>Return</dt><dd class="' + cl(m.ret) + '">' + fmtRet(m.ret) + '</dd></div>'
      + '<div><dt>Holding</dt><dd>' + fmtRet(c.bench) + '</dd></div>'
      + '<div><dt>Sharpe</dt><dd>' + (c.thin ? '-' : fmtNum(m.sharpe)) + '</dd></div>'
      + '<div><dt>Max DD</dt><dd>' + fmtPct(m.mdd, 1) + '</dd></div>'
      + '<div><dt>Win rate</dt><dd>' + fmtNum(m.win, 1) + '%</dd></div>'
      + '<div><dt>Trades</dt><dd>' + m.trades.toLocaleString('en-US') + '</dd></div>'
      + '</dl></div></a>');
  }
  var API = { cardHtml: cardHtml, fmtRet: fmtRet, fmtPct: fmtPct, fmtNum: fmtNum, CLSLBL: CLSLBL };
  if (typeof document === 'undefined') return API;

  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var st = { cn: 'crypto', q: '', style: '', sort: 'id', view: 'cards', beat: false, calm: false, cmp: [] }, D = null, detail = {};
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function beacon(e) { try { navigator.sendBeacon('/api/track?t=strategies&e=' + encodeURIComponent(e) + '&p=' + encodeURIComponent(location.pathname)); } catch (x) {} }
  function dateOf(d) { return new Date(d * 864e5).toISOString().slice(0, 10); }

  /* ---------- wall ---------- */
  function wall() {
    var fr = $('#wFrame'); if (!fr || !D) return;
    var rows = D.rules.filter(function (r) { return r.classes[st.cn]; }), W = 1000, H = 400;
    var all = []; rows.forEach(function (r) { r.classes[st.cn].spark.forEach(function (x) { all.push(Math.log(Math.max(x, .05))); }); });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), Y = function (v) { return H - 14 - (Math.log(Math.max(v, .05)) - lo) / (hi - lo || 1) * (H - 30); };
    var up = 0, html = rows.map(function (r) {
      var v = r.classes[st.cn].spark, last = v[v.length - 1]; if (last >= 1) up++;
      var d = v.map(function (x, i) { return (i ? 'L' : 'M') + (i / (v.length - 1) * W).toFixed(1) + ' ' + Y(x).toFixed(1); }).join('');
      return '<path class="wp ' + (last >= 1 ? 'u' : 'd') + '" data-s="' + r.slug + '" d="' + d + '"/>';
    }).join('');
    var one = Y(1);
    $('#wSvg').innerHTML = '<line class="wone" x1="0" x2="1000" y1="' + one + '" y2="' + one + '"/>' + html;
    var g = $('#wLbl'); if (g) {
      var beat = rows.filter(function (r) { var c = r.classes[st.cn]; return c.m.ret > c.bench; }).length, calm = rows.filter(function (r) { var c = r.classes[st.cn]; return !c.thin && c.m.sharpe > c.benchS; }).length, dd = rows.filter(function (r) { var c = r.classes[st.cn]; return c.m.mdd > c.benchD; }).length;
      var lb = (LD && LD[CLSLBL[st.cn]]) || CLSLBL[st.cn]; g.innerHTML = '<b>' + T('s1', { n: rows.length, c: lb }) + '</b> ' + T('s2', { b: beat, s: calm, d: dd });
    }
    fr._m = { rows: rows, Y: Y, W: W, H: H };
    $('#wSvg').animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1900, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }
  function wallWire() {
    var fr = $('#wFrame'), tip = $('#wTip'), dot = $('#wDot'); if (!fr) return;
    var cur = null;
    function clear() { if (cur) { var p = $('.wp[data-s="' + cur + '"]'); if (p) p.classList.remove('on'); } cur = null; fr.classList.remove('hv'); tip.hidden = true; dot.hidden = true; }
    function move(e) {
      var m = fr._m; if (!m) return;
      var b = fr.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, sx = b.width / m.W, sy = b.height / m.H, best = null;
      m.rows.forEach(function (r) {
        var c = r.classes[st.cn], v = c.spark, f = x / b.width * (v.length - 1), i = Math.max(0, Math.min(v.length - 2, Math.floor(f)));
        var val = v[i] + (v[i + 1] - v[i]) * (f - i), py = m.Y(val) * sy, d = Math.abs(py - y);
        if (!best || d < best.d) best = { d: d, r: r, py: py, c: c };
      });
      if (!best || best.d > (e.pointerType === 'mouse' ? 26 : 40)) { clear(); return; }
      if (cur !== best.r.slug) {
        if (cur) { var old = $('.wp[data-s="' + cur + '"]'); if (old) old.classList.remove('on'); }
        cur = best.r.slug; var p = $('.wp[data-s="' + cur + '"]'); p.classList.add('on'); p.parentNode.appendChild(p);
      }
      fr.classList.add('hv');
      var mm = best.c.m;
      tip.innerHTML = H('<div class="tg"><b>' + best.r.id + '</b><span>' + esc(best.c.tf) + '</span></div><h4>' + esc(best.r.name) + '</h4><div class="tr"><span>Return<b class="' + cl(mm.ret) + '">' + fmtRet(mm.ret) + '</b></span><span>Max DD<b>' + fmtPct(mm.mdd, 1) + '</b></span><span>Holding<b>' + fmtRet(best.c.bench) + '</b></span></div><div class="ht">' + (e.pointerType === 'mouse' ? 'Click for details' : '<button type="button" data-open="' + best.r.slug + '">Open details</button>') + '</div>');
      tip.hidden = false; dot.hidden = false;
      var w = tip.offsetWidth, h = tip.offsetHeight, L = x + 18; if (L + w > b.width) L = x - w - 18; L = Math.max(0, Math.min(L, b.width - w));
      var T = best.py - h - 14; if (T < 0) T = best.py + 18;
      tip.style.left = L + 'px'; tip.style.top = T + 'px'; dot.style.left = x + 'px'; dot.style.top = best.py + 'px';
    }
    fr.addEventListener('pointermove', move); fr.addEventListener('pointerdown', move);
    fr.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') clear(); });
    fr.addEventListener('click', function (e) { if (cur && !e.target.closest('[data-open]')) openDrawer(cur); });
  }

  /* ---------- library ---------- */
  function visible() {
    var q = st.q.toLowerCase().split(/\s+/).filter(Boolean);
    var rows = D.rules.filter(function (r) {
      var c = r.classes[st.cn]; if (!c) return false;
      if (st.style && r.style !== st.style) return false;
      if (st.beat && !(c.m.ret > c.bench)) return false;
      if (st.calm && !(!c.thin && c.m.sharpe > c.benchS)) return false;
      var hay = (' ' + r.id + ' ' + r.name + ' ' + r.summary + ' ' + D.meta.styles[r.style]).toLowerCase();
      return q.every(function (w) { return hay.indexOf(' ' + w) >= 0; }); // from the start of a word, or "rsi" finds every "reversion"
    });
    var key = { ret: function (c) { return c.m.ret; }, sharpe: function (c) { return c.thin ? -99 : c.m.sharpe; }, mdd: function (c) { return c.m.mdd; }, win: function (c) { return c.m.win; }, pf: function (c) { return c.m.pf || 0; }, oos: function (c) { return c.oos == null ? -99 : c.oos; } }[st.sort];
    if (key) rows.sort(function (a, b) { return key(b.classes[st.cn]) - key(a.classes[st.cn]); });
    return rows;
  }
  function list() {
    var rows = visible(), box = $('#lib'); if (!box) return;
    $('#libN').textContent = rows.length;
    $('#libNone').hidden = rows.length > 0;
    box.className = st.view === 'table' ? 'tbw' : 'grid';
    if (st.view === 'table') {
      box.innerHTML = H('<table class="st"><thead><tr><th>ID</th><th>Strategy</th><th>TF</th><th>Return</th><th>Holding</th><th>Sharpe</th><th>Out of sample</th><th>Max DD</th><th>Win rate</th><th>Trades</th></tr></thead><tbody>'
        + rows.map(function (r) {
          var c = r.classes[st.cn], m = c.m;
          return '<tr data-open="' + r.slug + '"><td>' + r.id + '</td><td class="nm">' + esc(r.name) + '</td><td>' + c.tf + '</td><td class="' + cl(m.ret) + '">' + fmtRet(m.ret) + '</td><td>' + fmtRet(c.bench) + '</td><td>' + (c.thin ? '-' : fmtNum(m.sharpe)) + '</td><td>' + (c.thin ? '-' : fmtNum(c.oos)) + '</td><td>' + fmtPct(m.mdd, 1) + '</td><td>' + fmtNum(m.win, 1) + '%</td><td>' + m.trades.toLocaleString('en-US') + '</td></tr>';
        }).join('') + '</tbody></table>');
    } else box.innerHTML = rows.map(function (r) { return cardHtml(r, st.cn, D.meta.styles); }).join('');
    paintCmp();
  }

  /* ---------- charts ---------- */
  function chartSvg(series, opt) {
    var W = 640, H = opt.h || 260, P = 8, pts = series[0].v.length, log = opt.log;
    var f = function (x) { return log ? Math.log(Math.max(x, .001)) : x; }, all = [];
    series.forEach(function (s) { s.v.forEach(function (x) { all.push(f(x)); }); });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), Y = function (v) { return H - P - (f(v) - lo) / (hi - lo || 1) * (H - 2 * P); };
    var paths = series.map(function (s, i) {
      var d = s.v.map(function (x, k) { return (k ? 'L' : 'M') + (k / (pts - 1) * W).toFixed(1) + ' ' + Y(x).toFixed(1); }).join('');
      return '<path class="cl ' + (s.cls || '') + '" style="' + (s.col ? 'stroke:' + s.col : '') + '" pathLength="1" d="' + d + '"/>';
    }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' + paths + '</svg>';
  }
  function dd(c) {
    var W = 640, H = 70, m = Math.min.apply(null, c.map(function (x) { return x[3]; })) || -1;
    var pts = c.map(function (x, i) { return (i / (c.length - 1) * W).toFixed(1) + ' ' + (x[3] / m * (H - 4) + 1).toFixed(1); });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path class="ddf" d="M0 0L' + pts.join('L') + 'L' + W + ' 0Z"/></svg>';
  }
  function drawIn(root) { $$('.cl', root).forEach(function (p, i) { p.animate([{ strokeDasharray: '1', strokeDashoffset: 1 }, { strokeDasharray: '1', strokeDashoffset: 0 }], { duration: 1100 + i * 200, easing: 'cubic-bezier(.3,.7,.2,1)' }); }); }
  function hoverChart(box, c) {
    var tip = $('.ct', box), ln = $('.cx', box); if (!tip) return;
    box.onpointermove = function (e) {
      var b = box.getBoundingClientRect(), f = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), x = c[Math.round(f * (c.length - 1))];
      tip.hidden = false; ln.hidden = false; ln.style.left = f * 100 + '%';
      tip.innerHTML = '<b>' + dateOf(x[0]) + '</b><span>$' + x[1].toFixed(2) + ' strategy</span><span>$' + x[2].toFixed(2) + ' holding</span>';
      var L = f * b.width + 12; if (L + tip.offsetWidth > b.width) L = f * b.width - tip.offsetWidth - 12; tip.style.left = L + 'px';
    };
    box.onpointerleave = function () { tip.hidden = true; ln.hidden = true; };
  }

  /* ---------- detail (drawer and strategy page share this) ---------- */
  function detailHtml(d, cn, tf) {
    var cs = d.classes[cn], t = cs[tf], m = t.m, b = t.bench;
    var tile = function (l, v, k) { return '<div><dt>' + l + '</dt><dd class="' + (k || '') + '">' + v + '</dd></div>'; };
    return '<div class="d-sw">' + Object.keys(d.classes).map(function (k) { return '<button type="button" data-dc="' + k + '" class="' + (k === cn ? 'on' : '') + '">' + CLSLBL[k] + '</button>'; }).join('') + '</div>'
      + (Object.keys(cs).length > 1 ? '<div class="d-sw sm">' + Object.keys(cs).map(function (k) { return '<button type="button" data-dt="' + k + '" class="' + (k === tf ? 'on' : '') + '">' + k + '</button>'; }).join('') + '</div>' : '')
      + '<div class="d-ch"><div class="d-chh"><div><b class="' + cl(m.ret) + '">' + fmtRet(m.ret) + '</b><span>' + T('s4', { n: t.markets, a: dateOf(t.from), b: dateOf(t.to) }) + '</span></div><div class="d-sw sm"><button type="button" data-ds="1" class="on">Log</button><button type="button" data-ds="0">Linear</button></div></div>'
      + '<div class="d-plot" id="dPlot"><div class="ct" hidden></div><div class="cx" hidden></div><div class="d-pl"></div></div><div class="d-dd">' + dd(t.curve) + '</div>'
      + '<div class="d-lg"><span class="a">Strategy</span><span class="b">Buy and hold</span><span class="c">Drawdown</span></div></div>'
      + '<dl class="d-m">' + tile('Total return', fmtRet(m.ret), cl(m.ret)) + tile('Buy and hold', fmtRet(b.ret)) + tile('CAGR', fmtPct(m.cagr), cl(m.cagr)) + tile('Sharpe', t.thin ? 'few trades' : fmtNum(m.sharpe)) + tile('Max drawdown', fmtPct(m.mdd, 1)) + tile('Holding drawdown', fmtPct(b.mdd, 1)) + tile('Holding Sharpe', fmtNum(b.sharpe)) + tile('Sortino', fmtNum(m.sortino)) + tile('Volatility', fmtPct(m.vol, 1)) + tile('Win rate', fmtNum(m.win, 1) + '%') + tile('Profit factor', m.pf == null ? '-' : fmtNum(m.pf)) + tile('Trades', m.trades.toLocaleString('en-US')) + tile('Months up', t.months.up + ' of ' + t.months.of) + '</dl>'
      + '<h3>Did it hold up?</h3><p class="d-n">' + T('s3', { d: dateOf(t.oosFrom) }) + '</p><dl class="d-m two">' + tile('Sharpe, first 70%', fmtNum(t.is)) + tile('Sharpe, last 30%', fmtNum(t.oos), cl(t.oos)) + '</dl>'
      + '<h3>Year by year</h3><div class="d-y">' + t.years.map(function (y) { return '<span class="' + cl(y[1]) + '"><i>' + y[0] + '</i>' + fmtRet(y[1]) + '</span>'; }).join('') + '</div>'
      + '<h3>Every market</h3><div class="tbw"><table class="st"><thead><tr><th>Market</th><th>Return</th><th>Holding</th><th>Sharpe</th><th>Max DD</th><th>Win rate</th><th>Trades</th></tr></thead><tbody>'
      + t.rows.slice().sort(function (a, c) { return c.ret - a.ret; }).map(function (r) { return '<tr><td class="nm">' + esc(r.sym) + (r.basket ? '' : ' <i>not in basket</i>') + '</td><td class="' + cl(r.ret) + '">' + fmtRet(r.ret) + '</td><td>' + fmtRet(r.bh) + '</td><td>' + fmtNum(r.sharpe) + '</td><td>' + fmtPct(r.mdd, 1) + '</td><td>' + fmtNum(r.win, 1) + '%</td><td>' + r.trades + '</td></tr>'; }).join('')
      + '</tbody></table></div>';
  }
  function paintDetail(root, d, cn, tf) {
    if (!d.classes[cn]) cn = Object.keys(d.classes)[0];
    if (!d.classes[cn][tf]) tf = d.classes[cn][d.tf] ? d.tf : Object.keys(d.classes[cn])[0];
    root._s = { cn: cn, tf: tf, log: true };
    root.innerHTML = H(detailHtml(d, cn, tf));
    var plot = function () {
      var c = d.classes[root._s.cn][root._s.tf].curve;
      $('.d-pl', root).innerHTML = chartSvg([{ v: c.map(function (x) { return x[2]; }), cls: 'b' }, { v: c.map(function (x) { return x[1]; }), cls: 'a' }], { log: root._s.log });
      drawIn(root); hoverChart($('#dPlot', root), c);
    };
    plot();
    root.onclick = function (e) {
      var b = e.target.closest('[data-dc],[data-dt],[data-ds]'); if (!b) return;
      if (b.dataset.dc) { paintDetail(root, d, b.dataset.dc, root._s.tf); return; }
      if (b.dataset.dt) { paintDetail(root, d, root._s.cn, b.dataset.dt); return; }
      root._s.log = b.dataset.ds === '1'; $$('[data-ds]', root).forEach(function (x) { x.classList.toggle('on', x === b); }); plot();
    };
  }
  function load(slug) {
    if (detail[slug]) return Promise.resolve(detail[slug]);
    return fetch('/strategies/data/' + slug + '.json').then(function (r) { return r.json(); }).then(function (j) { detail[slug] = j; return j; });
  }

  /* ---------- lab: the same engine, on the candles the reader picks ---------- */
  function lab(root, d) {
    if (!root) return;
    var opts = '', M = d.labMarkets || [];
    M.forEach(function (m) { opts += '<option value="' + m + '">' + m + '</option>'; });
    root.innerHTML = H('<div class="lab-f"><label>Market<select id="lSym">' + opts + '</select></label><label>Timeframe<select id="lTf"><option value="1440">1d</option><option value="240">4h</option><option value="60">1h</option></select></label><label>Fee per side %<input id="lFee" type="number" step="0.005" min="0" value="0.055"></label><label>Slippage %<input id="lSlip" type="number" step="0.005" min="0" value="0.02"></label><button type="button" id="lRun">Run it</button></div><div id="lOut" class="lab-o">' + T('s11') + '</div>');
    $('#lRun', root).onclick = function () {
      var out = $('#lOut', root), sym = $('#lSym', root).value, tf = $('#lTf', root).value, btn = this;
      btn.disabled = true; out.textContent = (LD && LD['Running...']) || 'Running...'; beacon('lab:' + d.slug);
      fetch('/api/klines?symbol=' + encodeURIComponent(sym) + '&interval=' + tf, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (k) {
        btn.disabled = false;
        if (!Array.isArray(k) || k.length < 60) { out.textContent = T('s14'); return; }
        var raw = { t: [], o: [], h: [], l: [], c: [], v: [] };
        k.forEach(function (x) { raw.t.push(x.time * 1000); raw.o.push(+x.open); raw.h.push(+x.high); raw.l.push(+x.low); raw.c.push(+x.close); raw.v.push(+x.vol || 0); });
        var E = window.mpStrat, b = E.bars(raw), r = E.run(d.rule, b, { fee: +$('#lFee', root).value || 0, slip: +$('#lSlip', root).value || 0 }, null);
        var s = E.tradeStats(r.trades), last = r.equity[r.equity.length - 1], bh = raw.c[raw.c.length - 1] / raw.c[0] - 1;
        var tr = r.trades;
        out.innerHTML = H('<div class="lab-c" id="lChart"></div><div class="lab-p"><button type="button" id="lPlay">Replay</button><span id="lProg"></span></div><dl class="d-m"><div><dt>Return</dt><dd class="' + cl(last - 1) + '">' + fmtPct((last - 1) * 100, 1) + '</dd></div><div><dt>Holding</dt><dd>' + fmtPct(bh * 100, 1) + '</dd></div><div><dt>Trades</dt><dd>' + s.trades + '</dd></div><div><dt>Win rate</dt><dd>' + fmtNum(s.win, 1) + '%</dd></div></dl><p class="d-n">' + T('s12', { n: raw.c.length, s: esc(sym) }) + (s.trades < 30 ? ' ' + T('s13') : '') + '</p>');
        labChart(out, raw, tr);
      }).catch(function () { btn.disabled = false; out.textContent = T('s15'); });
    };
  }

  function lwc() {
    if (window.LightweightCharts) return Promise.resolve();
    return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = '/assets/lightweight-charts-4.2.0.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  }
  /* The entries and exits of the run above, drawn where they happened. Replay feeds the bars one at a time from a timer. */
  function labChart(out, raw, tr) {
    lwc().then(function () {
      var box = $('#lChart', out); if (!box) return;
      var ch = LightweightCharts.createChart(box, { height: 300, layout: { background: { color: 'transparent' }, textColor: '#8b94a0' }, grid: { vertLines: { color: 'rgba(255,255,255,.04)' }, horzLines: { color: 'rgba(255,255,255,.04)' } }, rightPriceScale: { borderColor: 'rgba(255,255,255,.1)' }, timeScale: { borderColor: 'rgba(255,255,255,.1)', timeVisible: true } });
      var se = ch.addCandlestickSeries({ upColor: '#2ebd85', downColor: '#ff5a4d', borderVisible: false, wickUpColor: '#2ebd85', wickDownColor: '#ff5a4d' });
      var bars = raw.t.map(function (t, i) { return { time: t / 1000, open: raw.o[i], high: raw.h[i], low: raw.l[i], close: raw.c[i] }; });
      var marks = [];
      tr.forEach(function (x) {
        marks.push({ time: x.et / 1000, position: x.d > 0 ? 'belowBar' : 'aboveBar', color: x.d > 0 ? '#2ebd85' : '#ff5a4d', shape: x.d > 0 ? 'arrowUp' : 'arrowDown', text: x.d > 0 ? 'L' : 'S' });
        marks.push({ time: x.xt / 1000, position: 'aboveBar', color: x.r >= 0 ? '#c2f64a' : '#ff5a4d', shape: 'circle', text: (x.r >= 0 ? '+' : '') + (x.r * 100).toFixed(1) + '%' });
      });
      marks.sort(function (a, b) { return a.time - b.time; });
      se.setData(bars); se.setMarkers(marks); ch.timeScale().fitContent();
      var play = $('#lPlay', out), prog = $('#lProg', out), timer = null, n = 0;
      var RP = (LD && LD.Replay) || 'Replay', PS = (LD && LD.Pause) || 'Pause', stop = function () { clearInterval(timer); timer = null; play.textContent = RP; };
      play.onclick = function () {
        if (timer) { stop(); return; }
        if (n === 0 || n >= bars.length) { n = Math.min(40, bars.length); se.setData(bars.slice(0, n)); se.setMarkers([]); }
        play.textContent = PS; beacon('replay');
        var total = bars.length, per = Math.max(1, Math.round(total / 500));
        timer = setInterval(function () {
          for (var k = 0; k < per && n < total; k++) se.update(bars[n++]);
          var t = bars[n - 1].time, m = marks.filter(function (x) { return x.time <= t; });
          se.setMarkers(m);
          prog.textContent = new Date(t * 1000).toISOString().slice(0, 10) + ', ' + Math.floor(m.length / 2) + ' of ' + tr.length + ' trades';
          ch.timeScale().fitContent();
          if (n >= total) stop();
        }, 24);
      };
    }).catch(function () {});
  }

  /* ---------- drawer ---------- */
  var openSlug = null;
  function openDrawer(slug, keep) {
    var dr = $('#dr'); if (!dr) { location.href = '/strategies/' + slug + '/'; return; }
    var r = D.rules.filter(function (x) { return x.slug === slug; })[0]; if (!r) return;
    openSlug = slug; beacon('open:' + slug);
    $('#drH').innerHTML = '<div class="tg"><b>' + r.id + '</b><span>' + esc(D.meta.styles[r.style]) + '</span></div><h2>' + esc(r.name) + '</h2><p>' + esc(r.summary) + '</p>';
    $('#drA').innerHTML = H('<a class="pri" href="' + P + '/strategies/' + slug + '/">Full page and downloads</a><a href="' + P + '/paper-trade">Practice it</a><button type="button" data-cmp="' + slug + '">Add to compare</button>');
    $('#drB').innerHTML = H('<div class="d-wait">Loading results</div>');
    dr.hidden = false; $('#scrim').hidden = false; document.body.classList.add('s-lock');
    dr.animate([{ transform: innerWidth < 760 ? 'translateY(30px)' : 'translateX(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.7,.2,1)' });
    if (!keep) history.replaceState(history.state, '', '#' + slug);
    paintCmp();
    load(slug).then(function (d) { if (openSlug === slug) paintDetail($('#drB'), d, st.cn, r.classes[st.cn] ? r.classes[st.cn].tf : d.tf); });
  }
  function closeDrawer() {
    var dr = $('#dr'); if (!dr || dr.hidden) return;
    dr.hidden = true; $('#scrim').hidden = true; document.body.classList.remove('s-lock'); openSlug = null;
    history.replaceState(history.state, '', location.pathname + location.search);
  }
  function step(n) {
    var rows = visible(), i = rows.findIndex(function (r) { return r.slug === openSlug; });
    if (i < 0) return; openDrawer(rows[(i + n + rows.length) % rows.length].slug);
  }

  /* ---------- compare ---------- */
  var COL = ['#c2f64a', '#46e0e6', '#f0b64a', '#ff7ac6'];
  function paintCmp() {
    var t = $('#tray'); if (!t) return;
    $$('[data-cmp]').forEach(function (b) { var on = st.cmp.indexOf(b.dataset.cmp) >= 0; b.classList.toggle('on', on); if (b.tagName === 'BUTTON' && !b.classList.contains('sc-cmp')) { var tt = on ? 'In compare' : 'Add to compare'; b.textContent = (LD && LD[tt]) || tt; } });
    t.hidden = !st.cmp.length;
    $('#trayI').innerHTML = st.cmp.map(function (s, i) { var r = D.rules.filter(function (x) { return x.slug === s; })[0]; return '<button type="button" data-rm="' + s + '"><i style="background:' + COL[i] + '"></i>' + r.id + '</button>'; }).join('');
    var g = $('#trayGo'); g.disabled = st.cmp.length < 2; var pk = 'Pick one more', cm = 'Compare'; g.textContent = st.cmp.length < 2 ? ((LD && LD[pk]) || pk) : ((LD && LD[cm]) || cm) + ' ' + st.cmp.length;
  }
  function cmpToggle(s) {
    var i = st.cmp.indexOf(s);
    if (i >= 0) st.cmp.splice(i, 1); else { if (st.cmp.length >= 4) st.cmp.shift(); st.cmp.push(s); }
    store('mp_strat_cmp', st.cmp.join(',')); paintCmp();
  }
  function compare() {
    var m = $('#cmpM'); m.hidden = false; $('#scrim').hidden = false; document.body.classList.add('s-lock');
    $('#cmpB').innerHTML = H('<div class="d-wait">Loading</div>'); beacon('compare');
    Promise.all(st.cmp.map(load)).then(function (ds) {
      var rows = ds.map(function (d) { var cs = d.classes[st.cn]; return cs ? { d: d, t: cs[cs[d.tf] ? d.tf : Object.keys(cs)[0]] } : null; }).filter(Boolean);
      if (!rows.length) { $('#cmpB').textContent = T('s16', { c: (LD && LD[CLSLBL[st.cn]]) || CLSLBL[st.cn] }); return; }
      var n = Math.min.apply(null, rows.map(function (r) { return r.t.curve.length; }));
      var ser = rows.map(function (r, i) { var c = r.t.curve, v = []; for (var k = 0; k < n; k++) v.push(c[Math.round(k / (n - 1) * (c.length - 1))][1]); return { v: v, col: COL[i] }; });
      var line = function (l, f) { return '<tr><td>' + l + '</td>' + rows.map(function (r) { return '<td>' + f(r) + '</td>'; }).join('') + '</tr>'; };
      $('#cmpB').innerHTML = H('<div class="d-plot big"><div class="d-pl">' + chartSvg(ser, { log: true, h: 300 }) + '</div></div><p class="d-n">' + T('s5', { c: (LD && LD[CLSLBL[st.cn]]) || CLSLBL[st.cn] }) + '</p><div class="tbw"><table class="st"><thead><tr><th></th>' + rows.map(function (r, i) { return '<th><i class="sw" style="background:' + COL[i] + '"></i>' + esc(r.d.name) + '</th>'; }).join('') + '</tr></thead><tbody>'
        + line('Total return', function (r) { return fmtRet(r.t.m.ret); }) + line('CAGR', function (r) { return fmtPct(r.t.m.cagr); }) + line('Sharpe', function (r) { return r.t.thin ? '-' : fmtNum(r.t.m.sharpe); }) + line('Sharpe, last 30%', function (r) { return fmtNum(r.t.oos); }) + line('Max drawdown', function (r) { return fmtPct(r.t.m.mdd, 1); }) + line('Win rate', function (r) { return fmtNum(r.t.m.win, 1) + '%'; }) + line('Trades', function (r) { return r.t.m.trades.toLocaleString('en-US'); }) + '</tbody></table></div>');
      drawIn($('#cmpB'));
      portfolio(rows);
    });
  }

  /* ---------- portfolio: the picks together, month by month, in the weights the reader types ---------- */
  function corr(a, b) {
    var n = a.length, ma = 0, mb = 0, sa = 0, sb = 0, c = 0, i;
    for (i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
    for (i = 0; i < n; i++) { sa += (a[i] - ma) * (a[i] - ma); sb += (b[i] - mb) * (b[i] - mb); c += (a[i] - ma) * (b[i] - mb); }
    return sa && sb ? c / Math.sqrt(sa * sb) : 0;
  }
  function portfolio(rows) {
    var host = $('#cmpB');
    var maps = rows.map(function (r) { var m = {}; r.t.monthly.forEach(function (x) { m[x[0]] = x[1]; }); return m; });
    var months = Object.keys(maps[0]).filter(function (k) { return maps.every(function (m) { return m[k] != null; }); }).map(Number).sort(function (a, b) { return a - b; });
    if (months.length < 12) return;
    var ser = maps.map(function (m) { return months.map(function (k) { return m[k]; }); });
    var el = document.createElement('div'); el.className = 'pf';
    el.innerHTML = H('<h3>Run them together</h3><p class="d-n">' + T('s6', { n: months.length }) + '</p><div class="pf-w">'
      + rows.map(function (r, i) { return '<label><i class="sw" style="background:' + COL[i] + '"></i>' + esc(r.d.name) + '<input type="number" min="0" step="5" data-w="' + i + '" value="' + Math.round(100 / rows.length) + '"></label>'; }).join('') + '</div><dl class="d-m" id="pfM"></dl>'
      + '<h3>How they move together</h3><div class="tbw"><table class="st"><thead><tr><th></th>' + rows.map(function (r) { return '<th>' + r.d.id + '</th>'; }).join('') + '</tr></thead><tbody>'
      + rows.map(function (r, i) { return '<tr><td class="nm">' + esc(r.d.name) + '</td>' + rows.map(function (q, j) { return '<td>' + corr(ser[i], ser[j]).toFixed(2) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div><p class="d-n">' + T('s7') + '</p>');
    host.appendChild(el);
    var paint = function () {
      var w = $$('[data-w]', el).map(function (x) { return Math.max(0, +x.value || 0); }), t = w.reduce(function (a, b) { return a + b; }, 0) || 1;
      var eq = 1, peak = 1, mdd = 0, s = 0, s2 = 0;
      months.forEach(function (_, k) {
        var r = 0; for (var i = 0; i < w.length; i++) r += ser[i][k] * w[i] / t;
        eq *= 1 + r; if (eq > peak) peak = eq; mdd = Math.min(mdd, eq / peak - 1); s += r; s2 += r * r;
      });
      var n = months.length, mean = s / n, vol = Math.sqrt(Math.max(0, s2 / n - mean * mean)), cagr = Math.pow(eq, 12 / n) - 1;
      $('#pfM', el).innerHTML = H('<div><dt>Total return</dt><dd class="' + cl(eq - 1) + '">' + fmtRet((eq - 1) * 100) + '</dd></div><div><dt>CAGR</dt><dd>' + fmtPct(cagr * 100) + '</dd></div><div><dt>Max drawdown, monthly</dt><dd>' + fmtPct(mdd * 100, 1) + '</dd></div><div><dt>Sharpe, monthly</dt><dd>' + fmtNum(vol ? mean / vol * Math.sqrt(12) : 0) + '</dd></div>');
    };
    el.addEventListener('input', paint); paint();
  }

  /* ---------- live: what happened after the rule was published ---------- */
  function liveLine(box, slug) {
    fetch('/api/strategies/live').then(function (r) { return r.json(); }).then(function (j) {
      var host = $('#sLive'); if (!host || !j || !j.from) return;
      var rows = j.rules && j.rules[slug], keys = rows ? Object.keys(rows) : [];
      host.hidden = false;
      if (!keys.length) { host.innerHTML = '<b>' + T('s8', { d: dateOf(j.from) }) + '</b> ' + T('s9', { d: dateOf(j.from) }); return; }
      host.innerHTML = '<b>' + T('s8', { d: dateOf(j.from) }) + '</b> ' + keys.map(function (k) { var x = rows[k]; return CLSLBL[k] + ': <span class="' + cl(x.e - 1) + '">' + fmtPct((x.e - 1) * 100) + '</span> against ' + fmtPct((x.b - 1) * 100) + ' holding, ' + x.n + ' day' + (x.n === 1 ? '' : 's') + ', ' + x.t + ' trades'; }).join('. ') + '. ' + T('s10');
    }).catch(function () {});
  }

  /* ---------- hero count ---------- */
  function counters() {
    $$('[data-count]').forEach(function (e, n) {
      var to = +e.dataset.count, t0 = 0, dur = 1300 + n * 120;
      var tick = function (t) { t0 = t0 || t; var p = Math.min(1, (t - t0) / dur), v = 1 - Math.pow(1 - p, 4); e.textContent = Math.round(to * v).toLocaleString('en-US'); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  }

  function hub() {
    var q = new URLSearchParams(location.search);
    if (CLSLBL[q.get('market')]) st.cn = q.get('market');
    st.q = q.get('q') || ''; st.style = q.get('style') || ''; st.sort = q.get('sort') || 'id'; st.view = q.get('view') === 'table' ? 'table' : 'cards'; st.beat = q.get('beat') === '1';
    st.cmp = (store('mp_strat_cmp') || '').split(',').filter(function (s) { return D.rules.some(function (r) { return r.slug === s; }); }).slice(0, 4);
    $('#q').value = st.q; $('#sort').value = st.sort;
    var sync = function () {
      var u = new URLSearchParams();
      if (st.cn !== 'crypto') u.set('market', st.cn); if (st.q) u.set('q', st.q); if (st.style) u.set('style', st.style); if (st.sort !== 'id') u.set('sort', st.sort); if (st.view === 'table') u.set('view', 'table'); if (st.beat) u.set('beat', '1');
      var s = u.toString(); history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash);
      $$('[data-m]').forEach(function (b) { b.classList.toggle('on', b.dataset.m === st.cn); });
      $$('[data-st]').forEach(function (b) { b.classList.toggle('on', b.dataset.st === st.style); });
      $$('[data-v]').forEach(function (b) { b.classList.toggle('on', b.dataset.v === st.view); });
      $('#fBeat').classList.toggle('on', st.beat); $('#fCalm').classList.toggle('on', st.calm);
      list();
    };
    document.addEventListener('click', function (e) {
      var t = e.target, x;
      if ((x = t.closest('[data-cmp]'))) { e.preventDefault(); e.stopPropagation(); cmpToggle(x.dataset.cmp); return; }
      if ((x = t.closest('[data-rm]'))) { cmpToggle(x.dataset.rm); return; }
      if ((x = t.closest('[data-open]'))) { if (e.ctrlKey || e.metaKey) return; e.preventDefault(); openDrawer(x.dataset.open); return; }
      if ((x = t.closest('[data-m]'))) { st.cn = x.dataset.m; sync(); wall(); beacon('market:' + st.cn); return; }
      if ((x = t.closest('[data-st]'))) { st.style = st.style === x.dataset.st ? '' : x.dataset.st; sync(); return; }
      if ((x = t.closest('[data-v]'))) { st.view = x.dataset.v; sync(); return; }
      if (t.closest('#fBeat')) { st.beat = !st.beat; sync(); return; }
      if (t.closest('#fCalm')) { st.calm = !st.calm; sync(); return; }
      if (t.closest('#fClear')) { st.q = ''; st.style = ''; st.beat = false; st.calm = false; $('#q').value = ''; sync(); return; }
      if (t.closest('#drX') || t.closest('#scrim') || t.closest('#cmpX')) { closeDrawer(); $('#cmpM').hidden = true; $('#scrim').hidden = true; document.body.classList.remove('s-lock'); return; }
      if (t.closest('#drP')) { step(-1); return; } if (t.closest('#drN')) { step(1); return; }
      if (t.closest('#trayGo')) { compare(); return; }
      if (t.closest('#trayX')) { st.cmp = []; store('mp_strat_cmp', ''); paintCmp(); }
    });
    $('#q').addEventListener('input', function () { st.q = this.value; sync(); });
    $('#sort').addEventListener('change', function () { st.sort = this.value; sync(); });
    document.addEventListener('keydown', function (e) {
      var inp = e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
      if (e.key === '/' && !inp) { e.preventDefault(); $('#q').focus(); }
      if (e.key === 'Escape') { closeDrawer(); $('#cmpM').hidden = true; if ($('#dr').hidden) { $('#scrim').hidden = true; document.body.classList.remove('s-lock'); } }
      if (openSlug && !inp) { if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); }
    });
    wallWire(); sync(); wall(); counters();
    var h = location.hash.slice(1); if (h && D.rules.some(function (r) { return r.slug === h; })) openDrawer(h, true);
  }
  function page() {
    var box = $('#sDetail'), slug = box.dataset.slug;
    load(slug).then(function (d) { paintDetail(box, d, 'crypto', d.tf); if ($('#sLab')) lab($('#sLab'), d); liveLine(box, slug); });
    var ex = $('[data-explain]'); if (ex) ex.addEventListener('click', function () { try { sessionStorage.setItem('mp_ai_q', ex.dataset.explain); } catch (e) {} beacon('explain:' + slug); });
    $$('[data-dl]').forEach(function (a) { a.addEventListener('click', function () { beacon('download:' + a.dataset.dl + ':' + slug); }); });
  }
  document.addEventListener('DOMContentLoaded', function () {
    $$('[data-tool]').forEach(function (a) { a.addEventListener('click', function () { try { navigator.sendBeacon('/api/track?t=tool&e=' + encodeURIComponent(a.dataset.tool) + '&p=' + encodeURIComponent(location.pathname)); } catch (e) {} }); });
    if ($('#sDetail')) { page(); return; }
    if (!$('#lib')) return;
    var names = LD ? fetch('/strategies/data/i18n-' + LG + '.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }) : Promise.resolve({});
    Promise.all([fetch('/strategies/data/index.json').then(function (r) { return r.json(); }), names]).then(function (a) {
      D = a[0]; var n = a[1] || {};
      if (n.styles) D.meta.styles = n.styles;
      D.rules.forEach(function (r) { if (n[r.slug]) r.summary = n[r.slug]; });
      hub();
    });
  });
  API.state = function () { return { st: st, n: D ? D.rules.length : 0 }; };
  return API;
});
