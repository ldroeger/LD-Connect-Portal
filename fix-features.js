const localDb = require('./db/localDb');
localDb.initialize();
// Set news_read and todos_read to 1 for all users where it's 0 or null
localDb.db.prepare("UPDATE users SET feature_news_read=1 WHERE feature_news_read IS NULL OR feature_news_read=0").run();
localDb.db.prepare("UPDATE users SET feature_todos_read=1 WHERE feature_todos_read IS NULL OR feature_todos_read=0").run();
console.log('Fixed feature flags for existing users');
process.exit(0);
