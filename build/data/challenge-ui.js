/* /prop-firm-challenge/ picker + rule studio markup (2026-11-16 evening, owner: "sve to hocu da izgleda bas bas cool").
   Every rule card draws its account as a RULER: the loss side (max drawdown, with the daily limit as the inner amber zone) left of the
   start, the target right of it, at their true proportions - so a 6% drawdown against a 10% target LOOKS tighter than 10% against 8%.
   The studio draws the same ruler live from the member's own rules. The page script (challenge-page.js.txt) carries the JS twin of
   gauge() - keep the two identical. */
'use strict';
const TYPES = [
  { kind: 'one', name: 'One-step', tag: '1 step', t: [10], daily: 4, dd: 6, ddtype: 'trail', mindays: 5, lev: 100, extra: [] },
  { kind: 'two', name: 'Two-step', tag: '2 steps', t: [8, 5], daily: 5, dd: 10, ddtype: 'static', mindays: 4, lev: 100, extra: [] },
  { kind: 'eod', name: 'One-step EOD', tag: '1 step', t: [10], daily: 5, dd: 6, ddtype: 'eod', mindays: 5, lev: 50, extra: [] },
  { kind: 'ftmo1', firm: 'ftmo', name: 'FTMO 1-Step', tag: '1 step', t: [10], daily: 3, dd: 10, ddtype: 'eod', mindays: 0, lev: 3, extra: ['Best day under 50% of profit'] },
  { kind: 'ftmo2', firm: 'ftmo', name: 'FTMO 2-Step', tag: '2 steps', t: [10, 5], daily: 5, dd: 10, ddtype: 'static', mindays: 4, lev: 3, extra: [] },
  { kind: 'iq', firm: 'iq', name: 'IQ Capital Core', tag: '1 step', t: [8], daily: 0, dd: 6, ddtype: 'eod', mindays: 0, lev: 5, extra: ['1% max loss per trade', '3rd breach ends it'] },
];
const DDN = { static: 'static', trail: 'trailing', eod: 'end-of-day' };
// the ruler: loss side | start | target side, at their true proportions; the daily limit is the amber zone next to the start
function gauge(t, daily, dd, big) {
  const L = dd / (dd + t) * 100, G = 100 - L, D = daily > 0 ? Math.min(100, daily / dd * 100) : 0;
  return `<span class="rg${big ? ' big' : ''}"><span class="rg-bar"><span class="rg-loss" style="width:${L.toFixed(1)}%">${D ? `<span class="rg-daily" style="width:${D.toFixed(1)}%"></span>` : ''}</span><span class="rg-gain" style="width:${G.toFixed(1)}%"></span><span class="rg-0" style="left:${L.toFixed(1)}%"></span></span><span class="rg-lbl"><em class="l">-${dd}%</em>${D ? `<em class="d" style="left:${(L - L * D / 100).toFixed(1)}%">-${daily}% day</em>` : ''}<em class="z" style="left:${L.toFixed(1)}%">start</em><em class="r">+${t}%</em></span></span>`;
}
const LOGO = { ftmo: '<img class="rc-logo" src="/assets/prop/ftmo-logo.svg" alt="FTMO" width="70" height="18">', iq: '<span class="rc-iq">IQ Capital<b>.</b></span>' };
function typeCard(x, on) {
  const head = x.firm ? LOGO[x.firm] + `<span class="rc-name sm">${x.name.replace(/^(FTMO|IQ Capital) /, '')}</span>` : `<span class="rc-name">${x.name}</span>`;
  const chips = [x.mindays ? x.mindays + ' days min' + (x.t.length > 1 ? ' / phase' : '') : 'No minimum days', x.lev + 'x max'].concat(x.extra);
  return `<button type="button" class="rc${on ? ' on' : ''}${x.firm ? ' firm ' + x.firm : ''}" data-kind="${x.kind}">`
    + `<span class="rc-top">${head}<span class="rc-tag">${x.tag}</span><span class="tick" aria-hidden="true"></span></span>`
    + gauge(x.t[0], x.daily, x.dd)
    + `<span class="rc-stats"><span><b>${x.t.map(v => v + '%').join(' + ')}</b><small>Profit target</small></span><span><b>${x.daily ? x.daily + '%' : 'None'}</b><small>Daily loss</small></span><span><b>${x.dd}%</b><small>${DDN[x.ddtype]} DD</small></span></span>`
    + `<span class="rc-chips">${chips.map(c => `<i>${c}</i>`).join('')}</span></button>`;
}
// ---- the rule studio ----
const ST = (k, unit, min, max, step) => `<span class="st"><button type="button" class="st-b" data-st="${k}:-1" aria-label="Less">&minus;</button><label class="st-v"><input type="number" inputmode="decimal" data-fi="${k}" min="${min}" max="${max}" step="${step}"><span>${unit}</span></label><button type="button" class="st-b" data-st="${k}:1" aria-label="More">+</button></span>`;
const CH = (k, list) => `<span class="sch">${list.map(c => { const v = Array.isArray(c) ? c[0] : c, l = Array.isArray(c) ? c[1] : c; return `<button type="button" data-f="${k}" data-v="${v}">${l}</button>`; }).join('')}</span>`;
const SEG = (k, list) => `<span class="seg" role="radiogroup">${list.map(c => `<button type="button" role="radio" data-f="${k}" data-v="${c[0]}"><b>${c[1]}</b>${c[2] ? `<small>${c[2]}</small>` : ''}</button>`).join('')}</span>`;
const TOG = (k, label, sub) => `<button type="button" class="tg" data-tog="${k}" role="switch" aria-checked="false"><span class="tg-k"><i></i></span><span class="tg-t"><b>${label}</b><small>${sub}</small></span></button>`;
const ROW = (k, label, ctl, hint) => `<div class="sr" data-row="${k}"><div class="sr-l">${label}${hint ? `<small>${hint}</small>` : ''}</div><div class="sr-c">${ctl}</div></div>`;
const ICO = {
  tgt: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
};
const studio = `<div class="cb" id="cxBuild" hidden>
      <div class="cb-head"><span class="cb-k">Rule studio</span><b>Build your own evaluation</b><span>Scored by the server exactly like a preset. A custom pass gets a certificate that prints these rules - no XP.</span></div>
      <div class="cb-grid">
        <div class="cb-cols">
          <section class="sc"><h4><i>${ICO.tgt}</i>Target</h4>
            ${ROW('steps', 'Steps', SEG('steps', [['1', '1 step', 'one target'], ['2', '2 steps', 'two phases']]))}
            ${ROW('t1', 'Profit target', ST('t1', '%', 1, 30, 0.5) + CH('t1', [[6, '6%'], [8, '8%'], [10, '10%'], [12, '12%']]))}
            ${ROW('t2', 'Phase 2 target', ST('t2', '%', 1, 30, 0.5) + CH('t2', [[4, '4%'], [5, '5%'], [6, '6%']]))}
          </section>
          <section class="sc"><h4><i>${ICO.shield}</i>Loss limits</h4>
            ${ROW('dd', 'Max drawdown', ST('dd', '%', 2, 30, 0.5) + CH('dd', [[5, '5%'], [6, '6%'], [8, '8%'], [10, '10%']]))}
            ${ROW('ddtype', 'Drawdown type', SEG('ddtype', [['static', 'Static', 'never moves'], ['trail', 'Trailing', 'follows your peak'], ['eod', 'End of day', 'follows daily closes']]))}
            ${ROW('dailyT', '', TOG('daily', 'Daily loss limit', 'resets 00:00 UTC'))}
            ${ROW('daily', 'Daily limit', ST('daily', '%', 1, 20, 0.5) + CH('daily', [[3, '3%'], [4, '4%'], [5, '5%']]))}
          </section>
          <section class="sc"><h4><i>${ICO.clock}</i>Trading</h4>
            ${ROW('mindays', 'Min trading days', ST('mindays', 'days', 0, 30, 1) + CH('mindays', [[0, 'None'], [3, '3'], [5, '5']]))}
            ${ROW('maxlev', 'Max leverage', ST('maxlev', 'x', 1, 125, 1) + CH('maxlev', [[5, '5x'], [30, '30x'], [100, '100x']]))}
            ${ROW('tlimitT', '', TOG('tlimit', 'Time limit', 'paused days do not count'))}
            ${ROW('tlimit', 'Days to pass', ST('tlimit', 'days', 7, 120, 1) + CH('tlimit', [[14, '14'], [30, '30'], [60, '60']]))}
          </section>
          <section class="sc"><h4><i>${ICO.plus}</i>Extra rules</h4>
            ${ROW('maxposT', '', TOG('maxpos', 'Max loss per trade', 'one trade may not lose more'))}
            ${ROW('maxpos', 'Per trade', ST('maxpos', '%', 0.25, 10, 0.25) + CH('maxpos', [[0.5, '0.5%'], [1, '1%'], [2, '2%']]))}
            ${ROW('strikes', 'Breaches', SEG('strikes', [['1', '1st', 'ends it'], ['2', '2nd', 'ends it'], ['3', '3rd', 'ends it']]))}
            ${ROW('bestT', '', TOG('best', 'Consistency rule', 'best day vs total profit'))}
            ${ROW('best', 'Best day under', ST('best', '% of profit', 20, 90, 5) + CH('best', [[30, '30%'], [40, '40%'], [50, '50%']]))}
          </section>
        </div>
        <aside class="cb-prev" id="cbPrev"><span class="cb-pk">Your challenge</span><div id="cbGauge"></div><div class="cb-pstats" id="cbStats"></div><div class="cb-ratio" id="cbRatio"></div><p class="cb-sum" id="cbSum"></p></aside>
      </div>
    </div>`;
const statsHtml = `<div class="cx-stats" id="cxStats">
    <div class="cx-stat ok"><i>${ICO.tgt}</i><span class="cx-sv"><b id="sPass">-</b><span>Challenges passed</span></span></div>
    <div class="cx-stat am"><i>${ICO.clock}</i><span class="cx-sv"><b id="sDaily">-</b><span>Ended on daily loss</span></span></div>
    <div class="cx-stat rd"><i>${ICO.shield}</i><span class="cx-sv"><b id="sDd">-</b><span>Ended on drawdown</span></span></div>
  </div>`;
const pickHtml = `<div id="cxPick">
    <div class="cx-gl"><span>Our rule sets</span><em>the three shapes most crypto prop firms sell</em></div>
    <div class="cx-types">
${TYPES.filter(t => !t.firm).map((t, i) => '      ' + typeCard(t, i === 0)).join('\n')}
    </div>
    <div class="cx-gl"><span>A real firm's rules</span><a href="/#propfirms">FTMO and IQ Capital &rarr;</a></div>
    <div class="cx-types">
${TYPES.filter(t => t.firm).map(t => '      ' + typeCard(t, false)).join('\n')}
    </div>
    <div class="cx-gl"><span>Your own</span></div>
    <button type="button" class="rc-cust" data-kind="custom" id="custom"><span class="rc-cust-i">${ICO.plus}</span><span class="rc-cust-t"><b>Custom rules</b><span>Set every rule yourself - target, steps, daily loss, drawdown type, days, leverage, loss per trade, consistency and time limit.</span></span><span class="tick" aria-hidden="true"></span></button>
    ${studio}
    </div>`;
const CSS = `
  .cx-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:20px 0 6px}
  .cx-stat{--c:#c2f64a;position:relative;display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:16px;overflow:hidden;border:1px solid color-mix(in srgb,var(--c) 26%,var(--line));background:radial-gradient(120% 140% at 0 0,color-mix(in srgb,var(--c) 12%,transparent),transparent 60%),var(--panel)}
  .cx-stat.am{--c:#ffb347}.cx-stat.rd{--c:#ff7a6e}
  .cx-stat>i{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:var(--c);background:color-mix(in srgb,var(--c) 12%,#0d1015);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 30%,transparent),0 0 22px -10px var(--c)}
  .cx-stat>i svg{width:19px;height:19px}
  .cx-sv{display:flex;flex-direction:column;gap:2px;min-width:0}
  .cx-sv b{font-family:'Bricolage Grotesque',sans-serif;font-size:30px;font-weight:800;letter-spacing:-.02em;color:var(--ink);line-height:1}
  .cx-sv span{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3)}
  .cx-gl{display:flex;align-items:baseline;gap:12px;margin:24px 0 11px;font-family:'Space Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink2)}
  .cx-gl:first-child{margin-top:2px}.cx-gl em{font-style:normal;font-weight:400;letter-spacing:.02em;text-transform:none;font-family:'Familjen Grotesk',sans-serif;font-size:12.5px;color:var(--ink3)}
  .cx-gl a{margin-left:auto;color:var(--lime);text-decoration:none;letter-spacing:.06em}
  .cx-types{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  .rc{--ac:#c2f64a;position:relative;display:flex;flex-direction:column;gap:13px;text-align:left;padding:16px 16px 14px;border-radius:17px;border:1px solid var(--line);background:linear-gradient(180deg,#12161d,#0c0f14);color:var(--ink2);cursor:pointer;font:inherit;overflow:hidden;transition:transform .16s,border-color .16s,box-shadow .22s}
  .rc::before{content:'';position:absolute;inset:0;background:radial-gradient(90% 70% at 100% 0,color-mix(in srgb,var(--ac) 14%,transparent),transparent 60%);opacity:0;transition:opacity .2s;pointer-events:none}
  .rc:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--ac) 45%,var(--line))}
  .rc:hover::before,.rc.on::before{opacity:1}
  .rc.on{border-color:var(--ac);box-shadow:0 0 0 1px var(--ac),0 18px 40px -26px var(--ac)}
  .rc.ftmo{--ac:#3b8bff}.rc.iq{--ac:#2fe0a0}
  .rc>*{position:relative}
  .rc-top{display:flex;align-items:center;gap:9px;min-height:22px}
  .rc-name{font-family:'Bricolage Grotesque',sans-serif;font-size:19px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
  .rc-name.sm{font-size:17px}.rc-logo{height:17px;width:auto}
  .rc-iq{font-family:'Bricolage Grotesque',sans-serif;font-size:17px;font-weight:800;letter-spacing:-.03em;color:var(--ink)}.rc-iq b{color:#2fe0a0}
  .rc-tag{margin-left:auto;font-family:'Space Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ac);padding:4px 8px;border-radius:99px;border:1px solid color-mix(in srgb,var(--ac) 35%,transparent)}
  .rc .tick,.rc-cust .tick{flex:none;width:20px;height:20px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;transition:background .15s,border-color .15s}
  .rc.on .tick,.rc-cust.on .tick{background:var(--ac);border-color:var(--ac)}
  .rc.on .tick::after,.rc-cust.on .tick::after{content:'';width:5px;height:9px;border:solid #0a0b0d;border-width:0 2px 2px 0;transform:rotate(45deg) translate(-1px,-1px)}
  .rc-stats{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:6px}
  .rc-stats>span{display:flex;flex-direction:column;gap:3px;padding:9px 10px;border-radius:11px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);min-width:0}
  .rc-stats b{font-family:'Space Mono',monospace;font-size:15px;font-weight:700;color:var(--ink);white-space:nowrap}
  .rc-stats span:first-child b{color:#c2f64a}
  .rc-stats small{font-size:10.5px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rc-chips{display:flex;flex-wrap:wrap;gap:5px}
  .rc-chips i{font-style:normal;font-family:'Space Mono',monospace;font-size:10.5px;color:var(--ink2);padding:4px 8px;border-radius:7px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
  .rg{display:block;position:relative;padding-bottom:16px}
  .rg-bar{position:relative;display:flex;height:9px;border-radius:99px;overflow:hidden;background:#161b22}
  .rg-loss{position:relative;height:100%;background:linear-gradient(90deg,#ff5a4d,rgba(255,90,77,.35))}
  .rg-daily{position:absolute;right:0;top:0;bottom:0;background:linear-gradient(90deg,rgba(255,179,71,.55),#ffb347)}
  .rg-gain{height:100%;background:linear-gradient(90deg,rgba(194,246,74,.3),#c2f64a)}
  .rg-0{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:#fff;border-radius:2px;box-shadow:0 0 8px rgba(255,255,255,.6)}
  .rg-lbl em{position:absolute;bottom:0;font-style:normal;font-family:'Space Mono',monospace;font-size:9.5px;color:var(--ink3);white-space:nowrap}
  .rg-lbl .l{left:0;color:#ff8a7d}.rg-lbl .r{right:0;color:#c2f64a}
  .rg-lbl .z{transform:translateX(-50%);color:#c9d1da}.rg-lbl .d{transform:translateX(-50%);color:#ffb347;display:none}
  .rg.big{padding-bottom:20px}.rg.big .rg-bar{height:14px}.rg.big .rg-lbl em{font-size:11px}.rg.big .rg-lbl .d{display:block;bottom:auto;top:-18px}
  .rc-cust{--ac:#c2f64a;position:relative;display:flex;align-items:center;gap:16px;width:100%;text-align:left;padding:18px 18px;border-radius:17px;border:1px dashed rgba(194,246,74,.4);background:radial-gradient(70% 140% at 0 50%,rgba(194,246,74,.08),transparent 70%),#0c0f14;color:var(--ink2);cursor:pointer;font:inherit;transition:border-color .16s,box-shadow .2s}
  .rc-cust:hover{border-color:var(--lime)}.rc-cust.on{border-style:solid;border-color:var(--lime);box-shadow:0 0 0 1px var(--lime),0 18px 40px -26px var(--lime)}
  .rc-cust-i{flex:none;width:46px;height:46px;border-radius:14px;display:grid;place-items:center;color:#0a0b0d;background:linear-gradient(135deg,#d6ff6e,#9fd82c);box-shadow:0 0 26px -6px rgba(194,246,74,.7)}
  .rc-cust-i svg{width:22px;height:22px}
  .rc-cust-t{flex:1;display:flex;flex-direction:column;gap:4px}.rc-cust-t b{font-family:'Bricolage Grotesque',sans-serif;font-size:19px;color:var(--ink)}.rc-cust-t span{font-size:13px;line-height:1.5;color:var(--ink3)}
  .cb{margin-top:14px;padding:18px;border-radius:20px;border:1px solid rgba(194,246,74,.28);background:radial-gradient(80% 60% at 100% 0,rgba(194,246,74,.06),transparent 60%),#0b0e12}
  .cb[hidden]{display:none}
  .cb-head{display:flex;flex-direction:column;gap:4px;margin-bottom:16px}
  .cb-k{font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--lime)}
  .cb-head b{font-family:'Bricolage Grotesque',sans-serif;font-size:22px;letter-spacing:-.02em;color:var(--ink)}.cb-head>span:last-child{font-size:13px;color:var(--ink3)}
  .cb-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}
  .cb-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .sc{padding:14px;border-radius:15px;background:#10141a;border:1px solid rgba(255,255,255,.06)}
  .sc h4{display:flex;align-items:center;gap:9px;margin:0 0 6px;font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink)}
  .sc h4 i{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;color:var(--lime);background:rgba(194,246,74,.08)}
  .sr{display:flex;flex-direction:column;gap:7px;padding:10px 0;border-top:1px solid rgba(255,255,255,.05)}
  .sr:first-of-type{border-top:0}.sr.hide{display:none}
  .sr-l{font-size:12.5px;color:var(--ink2)}.sr-l:empty{display:none}.sr-l small{display:block;color:var(--ink3);font-size:11px}
  .sr-c{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
  .st{display:inline-flex;align-items:center;height:34px;border-radius:10px;border:1px solid var(--line);background:#0a0d11;overflow:hidden}
  .st-b{width:32px;height:100%;border:0;background:transparent;color:var(--ink2);font-size:16px;cursor:pointer}.st-b:hover{background:rgba(194,246,74,.08);color:var(--lime)}
  .st-v{display:inline-flex;align-items:baseline;gap:3px;padding:0 4px;border-left:1px solid var(--line);border-right:1px solid var(--line);height:100%;align-items:center}
  .st-v input{width:44px;border:0;background:transparent;color:var(--ink);font-family:'Space Mono',monospace;font-size:14px;font-weight:700;text-align:right;outline:none;-moz-appearance:textfield}
  .st-v input::-webkit-outer-spin-button,.st-v input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
  .st-v span{font-family:'Space Mono',monospace;font-size:10px;color:var(--ink3);padding-right:4px}
  .sch{display:inline-flex;gap:4px}
  .sch button{height:28px;padding:0 9px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:transparent;color:var(--ink3);font-family:'Space Mono',monospace;font-size:11px;cursor:pointer}
  .sch button:hover{color:var(--ink)}.sch button.on{color:var(--lime);border-color:rgba(194,246,74,.5);background:rgba(194,246,74,.07)}
  .seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;width:100%;padding:3px;border-radius:11px;background:#0a0d11;border:1px solid var(--line)}
  .seg button{display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 4px;border:0;border-radius:8px;background:transparent;color:var(--ink3);cursor:pointer;transition:background .15s,color .15s}
  .seg b{font-family:'Space Mono',monospace;font-size:11.5px}.seg small{font-size:10px;opacity:.8}
  .seg button.on{background:linear-gradient(180deg,rgba(194,246,74,.18),rgba(194,246,74,.07));color:var(--lime);box-shadow:inset 0 0 0 1px rgba(194,246,74,.45)}
  .tg{display:flex;align-items:center;gap:11px;width:100%;padding:0;border:0;background:transparent;text-align:left;cursor:pointer;font:inherit}
  .tg-k{flex:none;position:relative;width:38px;height:22px;border-radius:99px;background:#232a33;transition:background .18s}
  .tg-k i{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#8b95a1;transition:transform .18s,background .18s}
  .tg[aria-checked="true"] .tg-k{background:rgba(194,246,74,.3)}.tg[aria-checked="true"] .tg-k i{transform:translateX(16px);background:var(--lime)}
  .tg-t{display:flex;flex-direction:column;gap:1px}.tg-t b{font-size:13px;color:#e9e7df}.tg-t small{font-size:11px;color:#8b95a1}
  .cb-prev{position:sticky;top:76px;padding:16px;border-radius:16px;background:linear-gradient(180deg,#141922,#0d1015);border:1px solid rgba(194,246,74,.25);box-shadow:0 20px 50px -30px rgba(194,246,74,.5)}
  .cb-pk{display:block;margin-bottom:26px;font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--lime)}
  .cb-pstats{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:14px}
  .cb-pstats>span{display:flex;flex-direction:column;gap:2px;padding:9px 10px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
  .cb-pstats b{font-family:'Space Mono',monospace;font-size:14px;color:var(--ink)}.cb-pstats small{font-size:10.5px;color:var(--ink3)}
  .cb-ratio{margin-top:12px;padding:10px 12px;border-radius:11px;font-size:12.5px;line-height:1.45;color:var(--ink2);background:rgba(255,255,255,.03)}.cb-ratio b{font-family:'Space Mono',monospace;color:var(--ink)}
  .cb-sum{margin:12px 0 0;font-size:12px;line-height:1.55;color:var(--ink3)}
  .cb-err{color:#ff8a7d}
  @media(max-width:1100px){.cb-grid{grid-template-columns:1fr}.cb-prev{position:static;order:-1}}
  @media(max-width:760px){
    .cx-stats{gap:8px}.cx-stat{flex-direction:column;align-items:flex-start;gap:8px;padding:12px}.cx-stat>i{width:32px;height:32px}.cx-sv b{font-size:22px}.cx-sv span{font-size:9px}
    .cx-types{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;margin:0 -15px;padding:2px 15px 6px;scrollbar-width:none}
    .cx-types::-webkit-scrollbar{display:none}
    .rc{flex:0 0 84%;scroll-snap-align:start}
    .cx-gl em{display:none}
    .cb{padding:13px}.cb-cols{grid-template-columns:1fr}.cb-pstats{display:none}.cb-pk{margin-bottom:24px}
    .rc-cust{align-items:flex-start;gap:12px;padding:14px}.rc-cust-i{width:38px;height:38px;border-radius:11px}.rc-cust-t b{font-size:17px}.rc-cust-t span{font-size:12.5px}
  }
`;
module.exports = { TYPES, typeCard, gauge, statsHtml, pickHtml, CSS };
