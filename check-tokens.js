const db = require('./db/localDb');
db.initialize();
const tokens = db.db.prepare('SELECT id, user_id, token, platform, created_at FROM push_tokens').all();
tokens.forEach(t => console.log(t.id, t.platform, t.token.substring(0,30)));
process.exit(0);
