const router = require('express').Router()
const { authMiddleware, adminMiddleware } = require('../middleware/auth')
const localDb = require('../db/localDb')

try {
  localDb.db.exec(`CREATE TABLE IF NOT EXISTS push_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    platform TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    last_seen INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`)
} catch(e) {}
try { localDb.db.exec('ALTER TABLE push_tokens ADD COLUMN last_seen INTEGER DEFAULT (unixepoch())') } catch(e) {}

router.post('/register', authMiddleware, (req, res) => {
  const { token, platform } = req.body
  if (!token) return res.status(400).json({ error: 'Token erforderlich' })
  try {
    localDb.db.prepare(`
      INSERT INTO push_tokens (user_id, token, platform, last_seen)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(token) DO UPDATE SET
        user_id=excluded.user_id,
        platform=excluded.platform,
        last_seen=unixepoch()
    `).run(req.user.id, token, platform || 'unknown')
    res.json({ success: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.get('/tokens', adminMiddleware, (_req, res) => {
  try {
    const tokens = localDb.db.prepare(`
      SELECT pt.id, pt.token, pt.platform, pt.created_at, pt.last_seen,
             u.name, u.email, u.id as user_id
      FROM push_tokens pt
      JOIN users u ON u.id = pt.user_id
      ORDER BY u.name, pt.created_at DESC
    `).all()
    res.json({ tokens })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.delete('/tokens/:id', adminMiddleware, (req, res) => {
  try {
    localDb.db.prepare('DELETE FROM push_tokens WHERE id = ?').run(parseInt(req.params.id))
    res.json({ success: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

router.delete('/tokens/user/:userId', adminMiddleware, (req, res) => {
  try {
    const info = localDb.db.prepare('DELETE FROM push_tokens WHERE user_id = ?').run(parseInt(req.params.userId))
    res.json({ success: true, deleted: info.changes })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

async function sendPush(tokens, title, body, data) {
  if (!tokens || !tokens.length) return
  const msgs = tokens
    .filter(t => t.startsWith('ExponentPushToken'))
    .map(token => ({ to: token, title, body, data: data || {}, sound: 'default', priority: 'high' }))
  if (!msgs.length) return
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msgs),
    })
  } catch(e) { console.error('Push error:', e.message) }
}

function getTokensForUser(userId) {
  return localDb.db.prepare('SELECT token FROM push_tokens WHERE user_id = ?')
    .all(userId).map(r => r.token)
}
function getApproverTokens() {
  return localDb.db.prepare(`
    SELECT pt.token FROM push_tokens pt
    JOIN users u ON u.id = pt.user_id
    WHERE u.role IN ('admin','vacation_approver') AND u.is_active = 1
  `).all().map(r => r.token)
}
function getAllUserTokens() {
  return localDb.db.prepare(`
    SELECT pt.token FROM push_tokens pt
    JOIN users u ON u.id = pt.user_id
    WHERE u.is_active = 1
  `).all().map(r => r.token)
}
function getTokensForFeature() { return getAllUserTokens() }

module.exports = { router, sendPush, getTokensForUser, getApproverTokens, getAllUserTokens, getTokensForFeature }
