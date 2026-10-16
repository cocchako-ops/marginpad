/* mp-ops Trading > Demo Spot view for the v3 product (2026-10-16): cash, worth, season P&L + rank, claims, holdings.
   Replaces the whole VIEWS['trading/spot'] block in src/ops/client/ops.js.txt. Idempotent; refuses on a missing anchor. */
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, '..', 'src', 'ops', 'client', 'ops.js.txt');
let h = fs.readFileSync(F, 'utf8');
const N = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const A = "  VIEWS['trading/spot'] = { render: function (el) {";
const i0 = h.indexOf(A); if (i0 < 0) { console.error('no spot view anchor'); process.exit(1); }
const END = N + '  } };';
let i1 = h.indexOf(END, i0 + A.length); if (i1 < 0) { console.error('no view end'); process.exit(1); } i1 += END.length; // the view's own closing, not the next view - a comment block sits between them
if (h.slice(i0, i1).indexOf('seasonPnl') >= 0) { console.log('already'); process.exit(0); }
const VIEW = `  VIEWS['trading/spot'] = { render: function (el) { // Demo Spot v3 (2026-10-16): one cash balance, buy & hold, $100 a day to claim, one board
    var st = { f: 'all', q: '', sort: 'season' };
    function paint() {
      el.innerHTML = '<div class="empty">loading accounts and live prices…</div>';
      J('/api/admin/spot').then(function (d) {
        var t = d.totals || {}, acc = d.accounts || [], bd = d.board || {};
        var F = { all: function () { return true; }, active: function (a) { return a.txN > 0; }, holders: function (a) { return a.holdN > 0; }, profit: function (a) { return a.sinceStart > 0; }, board: function (a) { return a.rank > 0; }, untouched: function (a) { return !(a.txN > 0); } };
        var rows = acc.filter(F[st.f] || F.all).filter(function (a) { return !st.q || ((a.name || '') + ' ' + (a.email || '') + ' ' + a.uid).toLowerCase().indexOf(st.q) >= 0; });
        rows.sort(function (a, b) { return st.sort === 'since' ? (b.sinceStart || 0) - (a.sinceStart || 0) : st.sort === 'tx' ? (b.txN || 0) - (a.txN || 0) : st.sort === 'last' ? (b.last || 0) - (a.last || 0) : st.sort === 'equity' ? (b.equity || 0) - (a.equity || 0) : ((b.seasonPnl == null ? -1e12 : b.seasonPnl) - (a.seasonPnl == null ? -1e12 : a.seasonPnl)); });
        var who = function (a) { return a.name ? userLink(a.name) : (a.email ? userLink('', a.email) : '<span class="mono meta">' + esc(String(a.uid).slice(0, 10)) + '</span>'); };
        var pm = function (v) { return v == null ? '<span class="meta">-</span>' : '<span class="' + (v >= 0 ? 'up' : 'dn') + '">' + (v >= 0 ? '+' : '-') + USD(Math.abs(v)) + '</span>'; };
        el.innerHTML = '<div class="grid g4">' + tile(N(t.accounts), 'accounts', 'dim', N(t.active) + ' traded') + tile(USD(t.equity, 0), 'total worth', 'dim', USD(t.deposited, 0) + ' put in by the house') + tile(N(t.inProfit), 'above what they put in', 'dim', 'of ' + N(t.active) + ' who traded') + tile(N(t.onBoard), 'on the season board', 'dim', bd.ts ? 'built ' + agoT(bd.ts) + ' ago' : 'not built yet') + '</div>'
          + card('Accounts', '<div class="bar"><input class="in" id="spq" placeholder="search name / email / uid" value="' + esc(st.q) + '"><select class="in" id="spsort" style="flex:0 0 auto">' + [['season', 'Season P&L'], ['equity', 'Worth'], ['since', 'Since start'], ['tx', 'Trades'], ['last', 'Last active']].map(function (o) { return '<option value="' + o[0] + '"' + (st.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div><div class="chips">' + [['all', 'All'], ['active', 'Traded'], ['holders', 'Holding'], ['board', 'On the board'], ['profit', 'In profit'], ['untouched', 'Untouched']].map(function (f) { return '<span class="chip ' + (st.f === f[0] ? 'on' : '') + '" data-f="' + f[0] + '">' + f[1] + '</span>'; }).join('') + '</div>'
          + tbl([{ h: 'account', f: function (a) { return who(a) + (a.rank ? ' <span class="badge">#' + a.rank + '</span>' : ''); } }, { h: 'season P&L', r: true, mono: true, f: function (a) { return pm(a.seasonPnl); } }, { h: 'worth', r: true, mono: true, f: function (a) { return USD(a.equity); } }, { h: 'cash', r: true, mono: true, f: function (a) { return USD(a.cashUsd, 0); } }, { h: 'since start', r: true, mono: true, f: function (a) { return pm(a.sinceStart); } }, { h: 'claims', r: true, mono: true, f: function (a) { return N(a.claims || 0); } }, { h: 'coins', r: true, mono: true, f: function (a) { return N(a.holdN || 0) + (a.memeN ? ' <small class="meta">' + a.memeN + ' meme</small>' : ''); } }, { h: 'trades', r: true, mono: true, f: function (a) { return N(a.txN || 0); } }, { h: 'last', r: true, f: function (a) { return a.last ? agoT(a.last) : '-'; } }], rows, 'no accounts match') + '<div class="line meta" style="margin-top:8px">' + N(rows.length) + ' of ' + N(acc.length) + ' · worth = cash + coins at live prices · season P&L = net worth now minus net worth at the season start, the daily $100 does not count</div>');
        el.querySelectorAll('[data-f]').forEach(function (c) { c.onclick = function () { st.f = c.getAttribute('data-f'); paint(); }; });
        var q = $('spq'); if (q) { var tm; q.oninput = function () { clearTimeout(tm); tm = setTimeout(function () { st.q = q.value.trim().toLowerCase(); paint(); }, 300); }; }
        var so = $('spsort'); if (so) so.onchange = function () { st.sort = so.value; paint(); };
        stamp();
      }).catch(function () { el.innerHTML = failHtml('could not load'); });
    }
    paint();
  } };`;
h = h.slice(0, i0) + VIEW.split('\n').join(N) + h.slice(i1);
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F);
console.log('ops spot view replaced');
