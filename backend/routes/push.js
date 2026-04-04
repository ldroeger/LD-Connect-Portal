const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const localDb = require('../db/localDb');

// Store push tokens
localDb.db.exec(`
  CREATE TABLE IF NOT EXISTS push_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    platform TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Register push token
router.post('/register', authMiddleware, (req, res) => {
  const { token, platform } = req.body;
  if (!token) return res.status(400).json({ error: 'Token erforderlich' });
  try {
    localDb.db.prepare(`
      INSERT INTO push_tokens (user_id, token, platform)
      VALUES (?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id, platform=excluded.platform
    `).run(req.user.id, token, platform || 'unknown');
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Send push notification to user(s)
async function sendPush(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) return;
  const messages = tokens
    .filter(t => t.startsWith('ExponentPushToken'))
    .map(token => ({ to: token, title, body, data, sound: 'default', priority: 'high' }));
  if (messages.length === 0) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch(e) { console.error('Push error:', e.message); }
}

// Get tokens for a user
function getTokensForUser(userId) {
  return localDb.db.prepare('SELECT token FROM push_tokens WHERE user_id = ?')
    .all(userId).map(r => r.token);
}

// Get tokens for all approvers
function getApproverTokens() {
  return localDb.db.prepare(
    `SELECT pt.token FROM push_tokens pt
     JOIN users u ON u.id = pt.user_id
     WHERE u.role IN ('admin','vacation_approver') AND u.is_active = 1`
  ).all().map(r => r.token);
}

// Get tokens for all active users
function getAllUserTokens() {
  return localDb.db.prepare(
    `SELECT pt.token FROM push_tokens pt
     JOIN users u ON u.id = pt.user_id
     WHERE u.is_active = 1`
  ).all().map(r => r.token)
}

// Get tokens for users with a specific feature
function getTokensForFeature(feature) {
  return localDb.db.prepare(
    `SELECT pt.token FROM push_tokens pt
     JOIN users u ON u.id = pt.user_id
     WHERE u.is_active = 1 AND u.${feature} != 0`
  ).all().map(r => r.token)
}

module.exports = { router, sendPush, getTokensForUser, getApproverTokens, getAllUserTokens, getTokensForFeature };

// Debug: list registered tokens (admin only)
const { adminMiddleware } = require('../middleware/auth');
router.get('/tokens', adminMiddleware, (_req, res) => {
  const tokens = localDb.db.prepare(
    `SELECT pt.id, pt.token, pt.platform, u.name, u.email, pt.created_at
     FROM push_tokens pt JOIN users u ON u.id = pt.user_id
     ORDER BY pt.created_at DESC`
  ).all();
  res.json({ tokens });
});
