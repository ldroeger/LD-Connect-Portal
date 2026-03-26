const https = require('https');
const tokens = [
  'ExponentPushToken[brF2F2E2ccHzCtG-tFJrip]',
  'ExponentPushToken[ZlfxpfEA3m_kXXXXXXXXXX]'
];
const data = JSON.stringify(tokens.map(to => ({
  to,
  title: 'Test Push',
  body: 'Benachrichtigungen funktionieren!',
  sound: 'default'
})));
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
