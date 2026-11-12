/* THE CALENDAR GUARDRAIL (2026-11-12, owner-approved feature #10): a countdown chip in the chart head from 60 minutes before a
   scheduled macro print (impact 2+), and an opt-in switch that makes the Open button REFUSE a market entry inside the 30 minutes
   before it - naming the print and the minutes - while a limit order stays allowed. The calendar is served by the test itself
   (one event 20 minutes ahead, then one 50 minutes ahead), so the result does not depend on the real week.
   Run: node build/calgate-e2e.js [--local] */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = 'https://marginpad.io', LOCAL = process.argv.includes('--local'), ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let okN = 0, failN = 0; const chk = (n, ok, x) => { ok ? okN++ : failN++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 260) : '')); };
const CT = { js: 'text/javascript', css: 'text/css', html: 'text/html; charset=utf-8' };
function localFile(u) { const p = new URL(u).pathname; if (p.indexOf('/assets/') === 0) return path.join(ROOT, 'dist', p); if (/^\/(paper-trade|charts|heatmap|screener|calculators|swap)$/.test(p)) return path.join(ROOT, 'app', 'index.html'); return null; }
async function mk(browser, minsAhead, pre) {
  const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport({ width: 1366, height: 900 });
  await p.setRequestInterception(true);
  p.on('request', r => {
    const u = r.url();
    if (u.indexOf('/api/calendar') >= 0) return r.respond({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ events: [{ ts: Date.now() + minsAhead * 60000, type: 'fomc', title: 'FOMC rate decision', impact: 3, desc: 'test' }, { ts: Date.now() + 5 * 60000, type: 'crypto', title: 'An all-day thing', impact: 3, allday: true }] }) });
    if (LOCAL) { const f = localFile(u); if (f && fs.existsSync(f)) { const ext = f.split('.').pop(); return r.respond({ status: 200, headers: { 'content-type': CT[ext] || 'application/octet-stream', 'cache-control': 'no-store' }, body: fs.readFileSync(f) }); } }
    r.continue();
  });
  if (pre) await p.evaluateOnNewDocument(pre);
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  await p.goto(ORIGIN + '/paper-trade', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForFunction(() => !!window.mpOpenGate && !!document.getElementById('planSave') && !!document.querySelector('.ptc-head'), { timeout: 40000 });
  return { ctx, p, errs };
}
const journalN = () => { try { return (JSON.parse(localStorage.getItem('mp_journal') || '[]')).length; } catch (e) { return -1; } };
const lastToast = () => { const t = document.querySelector('#mpxpT .mpxp-msg, #mpxpT'); return t ? t.textContent.trim() : ''; };
(async () => {
  await withBrowser(async (browser) => {
    { // 20 minutes before a print, guardrail ON (set on the device as the switch would)
      const { ctx, p, errs } = await mk(browser, 20, () => { try { localStorage.setItem('mp_calgate', '1'); } catch (e) {} });
      await p.waitForFunction(() => !!document.getElementById('ptCalChip'), { timeout: 15000 }).catch(() => {});
      const chip = await p.evaluate(() => { const c = document.getElementById('ptCalChip'); if (!c) return null; const r = c.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { txt: c.textContent.trim(), soon: c.classList.contains('soon'), href: c.getAttribute('href'), inHead: !!c.closest('.ptc-head'), reach: !!(e && (e === c || c.contains(e))), w: Math.round(r.width) }; });
      chk('the chip sits in the chart head and names the print with the minutes', !!chip && chip.inHead && /FOMC/.test(chip.txt) && /in (19|20) min/.test(chip.txt), chip);
      chk('inside 30 minutes it is amber and says the guardrail is on', !!chip && chip.soon && /guardrail on/i.test(chip.txt), chip);
      chk('it links the calendar and is reachable where it is drawn', !!chip && chip.href === '/calendar/' && chip.reach, chip);
      const gate = await p.evaluate(() => window.mpOpenGate('BTC'));
      chk('the gate names the print and the minutes and says a limit order is allowed', /FOMC rate decision in (19|20) min/.test(gate) && /limit order/i.test(gate), gate);
      // press Open: a MARKET entry is refused, nothing is added to the journal
      const n0 = await p.evaluate(journalN);
      await p.evaluate(() => { try { window.mpPlanType = 'market'; } catch (e) {} });
      await p.waitForFunction(() => !!(window.mpPlanLive && +window.mpPlanLive.price > 0 && window.mpPlanLive.t && Date.now() - window.mpPlanLive.t < 3000), { timeout: 30000 }).catch(() => {}); // add() asks for a fresh live price BEFORE the guardrail - wait for one, so the refusal we read is the guardrail's
      await p.click('#planSave'); await sleep(900);
      const n1 = await p.evaluate(journalN), toast = await p.evaluate(lastToast);
      chk('Open refuses the market entry (journal unchanged) and the toast says why', n1 === n0 && /FOMC/.test(toast) && /guardrail/i.test(toast), { n0, n1, toast: toast.slice(0, 120) });
      // a limit order is a level, not a bet: the gate does not speak
      const lim = await p.evaluate(() => { window.mpPlanType = 'limit'; return window.mpOpenGate('BTC'); });
      chk('(the gate itself still answers for a limit; add() does not ask it then)', typeof lim === 'string', lim.slice(0, 40));
      chk('the all-day calendar entry never counts', (await p.evaluate(() => (window.__mpCalGateDbg.pick(Date.now(), 3600000) || {}).title)) === 'FOMC rate decision');
      chk('no page errors', errs.length === 0, errs);
      await ctx.close();
    }
    { // 50 minutes before: the chip is up (lime, no guardrail word), the gate is silent
      const { ctx, p } = await mk(browser, 50, () => { try { localStorage.setItem('mp_calgate', '1'); } catch (e) {} });
      await p.waitForFunction(() => !!document.getElementById('ptCalChip'), { timeout: 15000 }).catch(() => {});
      const chip = await p.evaluate(() => { const c = document.getElementById('ptCalChip'); return c ? { txt: c.textContent.trim(), soon: c.classList.contains('soon') } : null; });
      chk('50 minutes out the chip counts down in lime, without the guardrail word', !!chip && /in (49|50) min/.test(chip.txt) && !chip.soon && !/guardrail/i.test(chip.txt), chip);
      chk('and the gate lets a market entry through', (await p.evaluate(() => window.mpOpenGate('BTC'))) === '');
      await ctx.close();
    }
    { // guardrail OFF (the default): 20 minutes before, the chip shows, the gate is silent
      const { ctx, p } = await mk(browser, 20);
      await p.waitForFunction(() => !!document.getElementById('ptCalChip'), { timeout: 15000 }).catch(() => {});
      const st = await p.evaluate(() => ({ chip: !!document.getElementById('ptCalChip'), gate: window.mpOpenGate('BTC'), on: window.__mpCalGateDbg.on() }));
      chk('with the switch off (the default) the chip still warns and nothing is refused', st.chip && st.gate === '' && !st.on, st);
      await ctx.close();
    }
  }, { timeoutMs: 300000 });
  console.log('\ncalgate-e2e: ' + okN + ' passed, ' + failN + ' failed' + (LOCAL ? ' [local]' : ''));
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
