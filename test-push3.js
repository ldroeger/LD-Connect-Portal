const https = require('https');
const data = JSON.stringify([
  { to: 'ExponentPushToken[ZlfxpfEA3m_khBjypNU7_o]', title: 'Test Android', body: 'Push funktioniert!', sound: 'default' },
  { to: 'ExponentPushToken[brF2F2E2ccHzCtG-tFJrip]', title: 'Test iPhone', body: 'Push funktioniert!', sound: 'default' }
]);
const req = https.request({
  hostname: 'exp.host',
  path: '/--/api/v2/push/send',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => { console.log(body); process.exit(0); });
});
req.write(data);
req.end();
