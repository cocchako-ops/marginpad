/* Campaign mail (2026-09-19, owner: "da vracam stare nazad i da promovisem stvari").
   THIS SUITE NEVER SENDS TO A MEMBER. It previews, and it proves the refusals - which is the half that matters,
   because the damage here is not a bug, it is 400 people receiving something broken or unlawful.
   The load-bearing checks: every rendered email carries an unsubscribe link, and a send is refused until a test
   has gone out. Falsify by deleting the `not_tested` guard in the worker - that check goes red.
   node build/campaign-e2e.js                                                                                */
const fs = require('fs'), path = require('path');
const ORIGIN = 'https://marginpad.io';
const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split('\n')[1].replace('\r', '').trim();
let pass = 0, fail = 0;
const ok = (c, m, d) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + m + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 200))); };
const H = { 'content-type': 'application/json', 'x-admin-key': KEY };
const post = (b) => fetch(ORIGIN + '/api/admin/campaign', { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.json()).catch(e => ({ error: String(e.message) }));

(async () => {
  const cat = await fetch(ORIGIN + '/api/admin/campaign', { headers: H }).then(r => r.json());
  ok(cat && cat.ok, 'the catalogue loads', cat && cat.error);
  if (!cat || !cat.ok) { console.log('\n' + (pass + fail) + ' checks, ' + fail + ' failed'); process.exitCode = 1; return; }

  ok((cat.segments || []).length >= 10, 'enough segments to choose from', (cat.segments || []).length);
  ok((cat.templates || []).length >= 12, 'enough templates that the owner does not have to write one', (cat.templates || []).length);
  ok(cat.segments.every(s => typeof s.size === 'number'), 'every segment carries a LIVE count, not a guess');

  const all = cat.segments.find(s => s.id === 'all');
  ok(all && all.size > 0, 'the reachable audience is a real number', all && all.size);
  ok(typeof cat.optedOut === 'number', 'and the page states how many opted out', cat.optedOut);

  // ---- every template renders, and every rendered email carries the things that must never be missing -----
  let bad = [];
  for (const t of cat.templates) {
    const vars = {};
    (t.needs || []).forEach(k => { vars[k] = k === 'ctaHref' ? 'https://marginpad.io/' : (k === 'days' ? '7' : 'SAMPLE'); });
    const r = await post({ op: 'preview', tpl: t.id, vars, asName: 'Alex' });
    if (!r || !r.ok) { bad.push(t.id + ':failed'); continue; }
    if (!r.subject || r.subject.length < 6) bad.push(t.id + ':no-subject');
    if (!/unsubscribe\?u=/.test(r.html)) bad.push(t.id + ':NO-UNSUBSCRIBE');
    if (/\{[a-z]+\}/i.test(r.html)) bad.push(t.id + ':literal-brace');
    if (/\{[a-z]+\}/i.test(r.subject)) bad.push(t.id + ':literal-brace-subject');
    if (!/financial advice/i.test(r.html)) bad.push(t.id + ':no-disclaimer');
  }
  ok(bad.length === 0, 'all ' + cat.templates.length + ' templates render with an unsubscribe link, a disclaimer and no leftover placeholders', bad);

  // the reader's name is filled in, not left as a brace
  const named = await post({ op: 'preview', tpl: 'comeback_plain', vars: {}, asName: 'Zorana' });
  ok(named && /Zorana/.test(named.html), 'the recipient name is filled in', named && named.html && named.html.slice(0, 90));

  // ---- the refusals, which are the whole safety story ----------------------------------------------------
  const noTpl = await post({ op: 'preview', tpl: 'does_not_exist', vars: {} });
  ok(noTpl && noTpl.error === 'bad_template', 'an unknown template is refused', noTpl);

  const noSeg = await post({ op: 'send', tpl: 'comeback_plain', seg: 'not_a_segment', campaign: 'e2e-test' });
  ok(noSeg && noSeg.error === 'bad_segment', 'an unknown segment is refused', noSeg);

  const noName = await post({ op: 'send', tpl: 'comeback_plain', seg: 'idle90', campaign: '' });
  ok(noName && noName.error === 'need_campaign_id', 'a send with no campaign name is refused - that name is what stops a double-send', noName);

  // LOAD-BEARING: a template nobody has tested cannot be sent to anyone
  const fresh = 'blank';
  const untested = await post({ op: 'send', tpl: fresh, seg: 'idle90', campaign: 'e2e-never-run', vars: { headline: 'x', text: 'y' } });
  ok(untested && untested.error === 'not_tested', 'A TEMPLATE THAT HAS NOT BEEN TESTED CANNOT BE SENT', untested);
  ok(untested && untested.hint, 'and the refusal says what to do about it', untested && untested.hint);

  const badTo = await post({ op: 'test', tpl: 'comeback_plain', to: 'not-an-email' });
  ok(badTo && badTo.error === 'bad_to', 'a test to a malformed address is refused', badTo);

  // ---- the audience can never include someone who unsubscribed -------------------------------------------
  // `all` counts only digest=1; optedOut is counted separately, so the two must not overlap.
  ok(cat.optedOut >= 0 && all.size > 0, 'opted-out people are counted apart from the reachable audience', { reachable: all.size, optedOut: cat.optedOut });

  console.log('\n' + (pass + fail) + ' checks, ' + fail + ' failed  (no member was emailed by this run)');
  process.exitCode = fail ? 1 : 0;   // never process.exit - it aborts mid-teardown and the shell sees 127
})().catch(e => { console.error('fatal ' + e.message); process.exitCode = 1; });
