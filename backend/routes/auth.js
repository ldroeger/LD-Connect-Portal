const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const localDb = require('../db/localDb');
const { generateToken, authMiddleware } = require('../middleware/auth');
const mailer = require('../utils/mailer');

function userPublic(u) {
  return {
    id: u.id, email: u.email, name: u.name, role: u.role,
    powerbird_id: u.powerbird_id,
    features: {
      calendar:     u.feature_calendar    !== 0,
      vacation:     u.feature_vacation    !== 0,
      hours:        u.feature_hours       !== 0,
      news_read:    u.feature_news_read   !== 0,
      news_write:   !!u.feature_news_write,
      todos_read:   u.feature_todos_read  !== 0,
      todos_create: !!u.feature_todos_create,
      tools:        u.feature_tools !== 0,
      tools_search:   u.feature_tools_search !== 0,
      show_verleih:   u.feature_show_verleih !== 0,
      werkzeuge:    u.feature_werkzeuge !== 0,
    }
  };
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
    const user = localDb.db.prepare('SELECT * FROM users WHERE email=? AND is_active=1').get(email.toLowerCase().trim());
    if (!user) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    if (!user.password_hash) return res.status(401).json({ error: 'Bitte setzen Sie zuerst Ihr Passwort über den Einladungslink' });
    if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    res.json({ token: generateToken(user.id), user: userPublic(user) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/me', authMiddleware, (req, res) => res.json(userPublic(req.user)));

router.post('/forgot-password', async (req, res) => {
  try {
    const user = localDb.db.prepare('SELECT * FROM users WHERE email=? AND is_active=1').get(req.body.email?.toLowerCase()?.trim());
    if (user) {
      const token = uuidv4();
      localDb.db.prepare('UPDATE users SET reset_token=?,reset_token_expires=? WHERE id=?').run(token, Date.now()+2*3600000, user.id);
      const url = localDb.getSetting('app_url') || process.env.APP_URL || 'http://localhost';
      await mailer.sendPasswordReset(user.email, user.name, `${url}/reset-password?token=${token}`);
    }
    res.json({ success: true, message: 'Falls die E-Mail registriert ist, wurde ein Link gesendet.' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/set-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token und Passwort erforderlich' });
    if (password.length < 8) return res.status(400).json({ error: 'Passwort mind. 8 Zeichen' });
    const user = localDb.db.prepare('SELECT * FROM users WHERE reset_token=?').get(token);
    if (!user) return res.status(400).json({ error: 'Ungültiger oder abgelaufener Token' });
    if (user.reset_token_expires && user.reset_token_expires < Date.now()) return res.status(400).json({ error: 'Token abgelaufen' });
    localDb.db.prepare('UPDATE users SET password_hash=?,reset_token=NULL,reset_token_expires=NULL WHERE id=?').run(await bcrypt.hash(password, 12), user.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Alle Felder erforderlich' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Passwort mind. 8 Zeichen' });
    const user = localDb.db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
    if (!await bcrypt.compare(current_password, user.password_hash)) return res.status(401).json({ error: 'Aktuelles Passwort falsch' });
    localDb.db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await bcrypt.hash(new_password, 12), user.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
