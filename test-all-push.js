const https = require('https');
const db = require('./db/localDb');
db.initialize();
const tokens = db.db.prepare('SELECT token FROM push_tokens').all().map(t => t.token);
console.log('Sende an', tokens.length, 'Geraete...');
const data = JSON.stringify(tokens.map(to => ({
  to, title: '🎉 Push funktioniert!', body: 'Alle Geräte empfangen Benachrichtigungen.', sound: 'default'
})));
const req = https.request({
  hostname: 'exp.host',
  path: '/--/api/v2/push/send',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const result = JSON.parse(body);
    result.data.forEach((r, i) => console.log('Gerät', i+1, ':', r.status, r.message||''));
    process.exit(0);
  });
});
req.write(data);
req.end();
