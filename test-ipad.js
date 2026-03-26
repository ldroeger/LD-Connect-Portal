const https = require('https');
const data = JSON.stringify([{
  to: 'ExponentPushToken[Tcn5kOJtVAGxl78rxbYugQ]',
  title: 'iPad Test',
  body: 'Kommt diese an?',
  sound: 'default',
  priority: 'high'
}]);
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
