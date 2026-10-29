#!/usr/bin/env node
// TRUTH SOCIAL POLLER (2026-10-29). Truth Social runs a Mastodon-style API that answers KEYLESS from a residential IP
// (measured: 200 with full statuses from a home connection) and 403s every datacentre egress we have (the droplet and the
// Cloudflare Worker both get the "Just a moment" challenge). So this runs wherever a home IP is - the owner's PC, a
// Raspberry Pi, a residential proxy - and hands what it reads to the collector's ingest route over the export key.
//   COLLECTOR=https://collector.marginpad.io EXPORT_KEY=... node collector/tools/truth-poller.js [--once] [--every 60]
// Accounts: realDonaldTrump (the one that moves markets), plus any handle in TRUTH_ACCOUNTS (comma-separated).
// Nothing is stored here; the collector dedupes by status URL and classifies the text like any other source.
'use strict';
const COLLECTOR = (process.env.COLLECTOR || 'https://collector.marginpad.io').replace(/\/$/, '');
const KEY = process.env.EXPORT_KEY || '';
const ONCE = process.argv.includes('--once');
const EVERY = Math.max(20, +(process.argv[process.argv.indexOf('--every') + 1] || 60)) * 1000;
const ACCOUNTS = (process.env.TRUTH_ACCOUNTS || 'realDonaldTrump').split(',').map(s => s.trim()).filter(Boolean);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const ids = {};
const seen = new Set();
async function getJ(u) { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error('http ' + r.status); return r.json(); }
function text(html) { return String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim(); }
async function tick() {
  const out = [];
  for (const acct of ACCOUNTS) {
    try {
      if (!ids[acct]) { const a = await getJ('https://truthsocial.com/api/v1/accounts/lookup?acct=' + encodeURIComponent(acct)); ids[acct] = a.id; }
      const st = await getJ('https://truthsocial.com/api/v1/accounts/' + ids[acct] + '/statuses?limit=10&exclude_replies=true');
      for (const s of st) {
        if (!s || !s.id || seen.has(s.id)) continue;
        const body = text(s.content) || (s.media_attachments && s.media_attachments.length ? '[media post]' : '');
        if (!body) { seen.add(s.id); continue; }
        const reblog = s.reblog ? ' (reposting @' + ((s.reblog.account && s.reblog.account.username) || '?') + ': ' + text(s.reblog.content).slice(0, 160) + ')' : '';
        out.push({ title: ('@' + acct + ': ' + body + reblog).slice(0, 300), url: s.url || s.uri, ts: Date.parse(s.created_at), nid: 'ts:' + s.id, meta: { acct, replies: s.replies_count, reblogs: s.reblogs_count, favs: s.favourites_count } });
        seen.add(s.id);
      }
    } catch (e) { console.log(new Date().toISOString(), acct, 'read failed:', String(e.message || e).slice(0, 80)); }
  }
  if (!out.length) { console.log(new Date().toISOString(), 'nothing new'); return; }
  try {
    const r = await fetch(COLLECTOR + '/api/v1/catalysts/ingest', { method: 'POST', headers: { 'content-type': 'application/json', 'x-export-key': KEY }, body: JSON.stringify({ source: 'truth:' + ACCOUNTS[0], tier: 'official', items: out }), signal: AbortSignal.timeout(15000) });
    console.log(new Date().toISOString(), 'sent', out.length, '->', r.status, (await r.text()).slice(0, 120));
  } catch (e) { console.log(new Date().toISOString(), 'ingest failed:', String(e.message || e).slice(0, 80)); }
}
(async () => {
  if (!KEY) { console.error('EXPORT_KEY is required'); process.exit(1); }
  await tick();
  if (ONCE) return;
  setInterval(() => { tick().catch(() => {}); }, EVERY);
})();
