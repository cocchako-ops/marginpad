// Receive MarginPad webhooks (position.opened / closed / liquidated / updated, order.filled / cancelled / expired).
//   npm install marginpad && MP_WH_SECRET=... node webhook_server.js
// Register the URL once: POST /api/bot/v1/webhooks {"url":"https://your.host/mp","events":["position.closed"]}  (Premium)
const http = require('http');
const { verifyWebhook } = require('marginpad');
const SECRET = process.env.MP_WH_SECRET;
http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/mp') { res.writeHead(404); return res.end(); }
  let raw = ''; req.on('data', c => { raw += c; }); req.on('end', () => {
    if (!verifyWebhook(SECRET, raw, req.headers['x-mp-signature'] || '')) { res.writeHead(401); return res.end('bad signature'); }
    const ev = JSON.parse(raw);
    console.log(req.headers['x-mp-event'], ev.data && ev.data.symbol, ev.data && ev.data.pnl_usd);
    res.writeHead(200); res.end('ok');            // answer fast; MarginPad retries 5 times if it does not get a 2xx within 6 s
  });
}).listen(8787, () => console.log('listening on :8787/mp'));
