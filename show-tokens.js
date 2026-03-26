const db = require('./db/localDb');
db.initialize();
const tokens = db.db.prepare('SELECT token FROM push_tokens').all();
tokens.forEach(t => console.log(t.token));
process.exit(0);
