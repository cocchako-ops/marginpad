/* squad-shop-e2e (2026-10-01, owner: squad shop + new currency Valor + exclusive animated borders/badges + hidden MP-One).
   Walks it live with throwaway members: treasury starts at 0, buy is leader-only and debits exactly, a member equips an
   owned border onto their card, un-owned is refused, a badge rides its own slot, LEAVING strips the squad look, and the
   hidden MP-One squad opens for no one yet shows on the owner card and owns every item. Cleans up after itself.
   node build/squad-shop-e2e.js */
const fs = require('fs');
const KEY = (fs.readFileSync('D:/part1/money-mission/ADMIN_KEY.local.txt', 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io', H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
const J = (u, o) => fetch(B + u, o).then(r => r.json().then(j => (j.__s = r.status, j)).catch(() => ({ __s: r.status })));
const adm = (p, b) => J(p, { method: 'POST', headers: H, body: JSON.stringify(b) });
const sq = (op, uid, b) => J('/api/squad/' + op + '?uid=' + encodeURIComponent(uid), b === null ? { headers: H } : { method: 'POST', headers: H, body: JSON.stringify(b || {}) });
const R4 = () => { const A = 'ABCDFGHJKLMNPQRSTVWXYZ0123456789'; let v = ''; for (let i = 0; i < 4; i++) v += A[Math.floor(Math.random() * 4.9 + Math.random() * 25)]; return v.slice(0, 4) || 'ZZ9'; };
let pass = 0, fail = 0; const ok = (c, m, d) => { c ? pass++ : fail++; console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 180) : '')); };
(async () => {
  const U = ['e2eshop1', 'e2eshop2'], real = {};
  for (const u of U) { await adm('/api/admin/e2euser', { uid: u, op: 'rm' }).catch(() => {}); await adm('/api/admin/e2euser', { uid: u, op: 'mk' }); real[u] = ((await J('/api/admin/xpdiag?u=e2e_' + u, { headers: H })).user || {}).id; }
  await J('/api/auth/xp/setlevel?key=' + encodeURIComponent(KEY), { method: 'POST', headers: H, body: JSON.stringify({ uid: real['e2eshop1'], level: 'platinum', note: 'shop' }) });
  await adm('/api/admin/ticks', { uid: real['e2eshop1'], amt: 5000, note: 'shop' });
  const tag = 'SH' + R4().slice(0, 2);
  const c = await sq('create', real['e2eshop1'], { name: 'Ember Co ' + tag, tag: tag, crest: { shape: 'shield', sym: 'bolt', bg: '#b07cf6', fg: '#c2f64a', ring: 'solid' }, open: true });
  const sid = c.squad && c.squad.sid; ok(!!sid, 'founded a squad', { sid, err: c.error });
  await sq('join', real['e2eshop2'], { sid });

  // shop read, no valor yet
  let shop = await sq('shop', real['e2eshop1'], null);
  ok(shop.ok && Array.isArray(shop.items) && shop.items.length >= 5, 'shop catalogue present', { n: (shop.items || []).length, valor: shop.valor });
  ok(shop.valor === 0, 'treasury starts at 0', { valor: shop.valor });

  // buy must refuse with no valor
  let buy0 = await sq('shopbuy', real['e2eshop1'], { id: 'sqdarkfire' });
  ok(buy0.error === 'need_valor', 'buy refused with no valor', { err: buy0.error, need: buy0.need });

  // grant valor, buy Dark Fire (leader)
  await adm('/api/admin/squadvalor', { sid, amt: 2000 });
  let buy = await sq('shopbuy', real['e2eshop1'], { id: 'sqdarkfire' });
  ok(buy.ok && (buy.owned || []).indexOf('sqdarkfire') >= 0, 'leader bought Dark Fire', { valor: buy.valor, owned: buy.owned });
  ok(buy.valor === 800, 'valor debited exactly (2000-1200)', { valor: buy.valor });

  // a non-leader cannot buy
  let buyM = await sq('shopbuy', real['e2eshop2'], { id: 'sqshadow' });
  ok(buyM.error === 'not_leader', 'a member cannot buy', { err: buyM.error });

  // member equips the owned border -> their users.frame becomes sqdarkfire
  let eq = await sq('shopequip', real['e2eshop2'], { id: 'sqdarkfire' });
  ok(eq.ok && eq.myFrame === 'sqdarkfire', 'member equipped the border', { myFrame: eq.myFrame });
  let card2 = await J('/api/lb/user?name=e2e_e2eshop2');
  ok(card2.frame === 'sqdarkfire', 'the border shows on the member card (/lb/user)', { frame: card2.frame });

  // equipping an un-owned item is refused
  let eqBad = await sq('shopequip', real['e2eshop2'], { id: 'sqshadow' });
  ok(eqBad.error === 'not_unlocked', 'cannot equip what the squad does not own', { err: eqBad.error });

  // buy + equip a badge
  await sq('shopbuy', real['e2eshop1'], { id: 'sqember' });
  let eqB = await sq('shopequip', real['e2eshop1'], { id: 'sqember' });
  ok(eqB.ok && eqB.myBadge === 'sqember', 'leader equipped a badge', { myBadge: eqB.myBadge });
  let card1 = await J('/api/lb/user?name=e2e_e2eshop1');
  ok(card1.sqbadge === 'sqember', 'the badge shows on the card (/lb/user)', { sqbadge: card1.sqbadge });

  // LEAVE strips the squad cosmetics
  await sq('leave', real['e2eshop2'], {});
  let cardL = await J('/api/lb/user?name=e2e_e2eshop2');
  ok(cardL.frame !== 'sqdarkfire', 'leaving strips the squad border', { frame: cardL.frame });

  // ── hidden MP-One ──
  const mk = await adm('/api/admin/squadhidden', { username: 'e2e_e2eshop1', name: 'MP-One', tag: 'MP1' });
  ok(mk.ok && mk.sid, 'hidden squad created', { sid: mk.sid, err: mk.error });
  const hsid = mk.sid;
  let getH = await J('/api/squad/get?sid=' + hsid);
  ok(getH.error === 'not_found', '/squad/get refuses the hidden squad', { err: getH.error });
  let brw = await J('/api/squad/browse?nc=1');
  ok(!(brw.squads || []).some(x => x.sid === hsid), 'hidden squad is NOT in the directory', { n: (brw.squads || []).length });
  let cardH = await J('/api/lb/user?name=e2e_e2eshop1');
  ok(cardH.squad && cardH.squad.hidden && cardH.squad.name === 'MP-One', 'MP-One shows on the owner card, marked hidden', { sq: cardH.squad && { name: cardH.squad.name, hidden: cardH.squad.hidden } });
  let mine = await sq('mine', real['e2eshop1'], null);
  ok(mine.squad && mine.squad.sid === hsid, 'the owner still sees MP-One via /mine', { sid: mine.squad && mine.squad.sid });
  let shopH = await sq('shop', real['e2eshop1'], null);
  ok(shopH.ok && (shopH.owned || []).length === (shopH.items || []).length, 'MP-One owns EVERY shop item', { owned: (shopH.owned || []).length, items: (shopH.items || []).length, valor: shopH.valor });
  ok((mine.squad.level && mine.squad.level.lv) === 10, 'MP-One is max level', { lv: mine.squad.level && mine.squad.level.lv });
  let st = await J('/api/squad/stats?nc=1');
  // hidden squad must not inflate citable stats: it should not be the top squad
  ok(!(st.top && st.top.name === 'MP-One'), 'hidden squad is excluded from citable stats top', { top: st.top && st.top.name });

  for (const u of U) await adm('/api/admin/e2euser', { uid: u, op: 'rm' });
  console.log('\nshop-probe: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
