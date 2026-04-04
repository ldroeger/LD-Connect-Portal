const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || '/data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'app.db'));

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      powerbird_id TEXT NOT NULL,
      password_hash TEXT,
      role TEXT DEFAULT 'user',
      is_active INTEGER DEFAULT 1,
      feature_calendar INTEGER DEFAULT 1,
      feature_vacation INTEGER DEFAULT 1,
      feature_hours INTEGER DEFAULT 1,
      feature_news_read INTEGER DEFAULT 1,
      feature_news_write INTEGER DEFAULT 0,
      feature_todos_read INTEGER DEFAULT 1,
      feature_todos_create INTEGER DEFAULT 0,
      feature_tools INTEGER DEFAULT 1,
      feature_tools_search INTEGER DEFAULT 1,
      feature_show_verleih INTEGER DEFAULT 1,
      reset_token TEXT,
      reset_token_expires INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3B82F6',
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS vacation_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      from_date TEXT NOT NULL,
      to_date TEXT NOT NULL,
      days REAL NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      rejection_reason TEXT,
      rejection_file TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      reviewed_by INTEGER,
      reviewed_at INTEGER
    );
  `);

  // Migrations for existing DBs
  const migrations = [
    `ALTER TABLE users ADD COLUMN feature_calendar INTEGER DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN feature_vacation INTEGER DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN feature_hours INTEGER DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN feature_news_read INTEGER DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN feature_news_write INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN feature_todos_read INTEGER DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN feature_todos_create INTEGER DEFAULT 0,
    feature_werkzeuge INTEGER DEFAULT 0`,
    `UPDATE users SET feature_news_read=1 WHERE feature_news_read IS NULL`,
    `UPDATE users SET feature_todos_read=1 WHERE feature_todos_read IS NULL`,
    `ALTER TABLE users ADD COLUMN feature_tools INTEGER DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN feature_tools_search INTEGER DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN feature_show_verleih INTEGER DEFAULT 1`,
  ];
  migrations.forEach(sql => { try { db.exec(sql); } catch(e) {} });

  if (!db.prepare("SELECT value FROM settings WHERE key='setup_complete'").get())
    db.prepare("INSERT INTO settings (key,value) VALUES ('setup_complete','false')").run();

  console.log('Local DB initialized');
}

const getSetting = (key) => {
  const r = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return r ? r.value : null;
};
const setSetting = (key, value) =>
  db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(key, String(value));
const getSettings = () => {
  const rows = db.prepare('SELECT key,value FROM settings').all();
  const out = {}; rows.forEach(r => out[r.key] = r.value); return out;
};

module.exports = { initialize, getSetting, setSetting, getSettings, db };
