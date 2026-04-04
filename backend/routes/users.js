const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { adminMiddleware } = require('../middleware/auth');
const localDb = require('../db/localDb');
const mailer = require('../utils/mailer');

router.get('/', adminMiddleware, (_req, res) =>
  res.json({ users: localDb.db.prepare(
    'SELECT id,email,name,powerbird_id,role,is_active,feature_calendar,feature_vacation,feature_hours,feature_news_read,feature_news_write,feature_todos_read,feature_todos_create,feature_tools,created_at FROM users ORDER BY name'
  ).all() })
);

router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { email, name, powerbird_id, role } = req.body;
    if (!email || !name || !powerbird_id) return res.status(400).json({ error: 'E-Mail, Name und Powerbird-ID erforderlich' });
    if (localDb.db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase().trim()))
      return res.status(400).json({ error: 'E-Mail bereits registriert' });
    const token = uuidv4();
    localDb.db.prepare(
      'INSERT INTO users (email,name,powerbird_id,role,reset_token,reset_token_expires) VALUES (?,?,?,?,?,?)'
    ).run(email.toLowerCase().trim(), name, powerbird_id, role||'user', token, Date.now()+7*86400000);
    const url = localDb.getSetting('app_url') || process.env.APP_URL || 'http://localhost';
    await mailer.sendInvitation(email, name, `${url}/set-password?token=${token}`);
    res.json({ success: true, message: 'Benutzer angelegt und Einladung versendet' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', adminMiddleware, (req, res) => {
  try {
    const { name, powerbird_id, role, is_active, feature_calendar, feature_vacation, feature_hours, feature_news_read, feature_news_write, feature_todos_read, feature_todos_create, feature_tools } = req.body;
    localDb.db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        powerbird_id = COALESCE(?, powerbird_id),
        role = COALESCE(?, role),
        is_active = COALESCE(?, is_active),
        feature_calendar = COALESCE(?, feature_calendar),
        feature_vacation = COALESCE(?, feature_vacation),
        feature_hours = COALESCE(?, feature_hours),
        feature_news_read = COALESCE(?, feature_news_read),
        feature_news_write = COALESCE(?, feature_news_write),
        feature_todos_read = COALESCE(?, feature_todos_read),
        feature_todos_create = COALESCE(?, feature_todos_create),
        feature_tools = COALESCE(?, feature_tools)
      WHERE id = ?
    `).run(
      name ?? null,
      powerbird_id ?? null,
      role ?? null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      feature_calendar !== undefined ? (feature_calendar ? 1 : 0) : null,
      feature_vacation !== undefined ? (feature_vacation ? 1 : 0) : null,
      feature_hours !== undefined ? (feature_hours ? 1 : 0) : null,
      feature_news_read !== undefined ? (feature_news_read ? 1 : 0) : null,
      feature_news_write !== undefined ? (feature_news_write ? 1 : 0) : null,
      feature_todos_read !== undefined ? (feature_todos_read ? 1 : 0) : null,
      feature_todos_create !== undefined ? (feature_todos_create ? 1 : 0) : null,
      feature_tools !== undefined ? (feature_tools ? 1 : 0) : null,
      req.params.id
    );
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', adminMiddleware, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Sie können sich nicht selbst löschen' });
  localDb.db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/resend-invite', adminMiddleware, async (req, res) => {
  try {
    const user = localDb.db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    const token = uuidv4();
    localDb.db.prepare('UPDATE users SET reset_token=?,reset_token_expires=? WHERE id=?').run(token, Date.now()+7*86400000, user.id);
    const url = localDb.getSetting('app_url') || process.env.APP_URL || 'http://localhost';
    await mailer.sendInvitation(user.email, user.name, `${url}/set-password?token=${token}`);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/reset-password', adminMiddleware, async (req, res) => {
  try {
    const user = localDb.db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    const token = uuidv4();
    localDb.db.prepare('UPDATE users SET reset_token=?,reset_token_expires=? WHERE id=?').run(token, Date.now()+2*3600000, user.id);
    const url = localDb.getSetting('app_url') || process.env.APP_URL || 'http://localhost';
    await mailer.sendPasswordReset(user.email, user.name, `${url}/reset-password?token=${token}`);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
