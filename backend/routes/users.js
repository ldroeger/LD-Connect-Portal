const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { adminMiddleware } = require('../middleware/auth');
const localDb = require('../db/localDb');
const mailer  = require('../utils/mailer');

// GET /api/users
router.get('/', adminMiddleware, (_req, res) =>
  res.json({ users: localDb.db.prepare(
    `SELECT id,email,name,powerbird_id,role,is_active,
      feature_calendar,feature_vacation,feature_hours,
      feature_news_read,feature_news_write,feature_todos_read,feature_todos_create,
      feature_tools,feature_tools_search,feature_show_verleih,
      feature_sick,feature_documents,feature_docs_upload,feature_docs_upload_all,feature_docs_manage,
      created_at FROM users ORDER BY name`
  ).all() })
);

// POST /api/users
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

// PUT /api/users/:id
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const existing = localDb.db.prepare('SELECT * FROM users WHERE id=?').get(userId);
    if (!existing) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

    const {
      name, email, powerbird_id, role, is_active,
      feature_calendar, feature_vacation, feature_hours,
      feature_news_read, feature_news_write,
      feature_todos_read, feature_todos_create,
      feature_tools, feature_tools_search, feature_show_verleih,
      feature_sick, feature_documents, feature_docs_upload, feature_docs_upload_all,
    } = req.body;

    const emailChanged = email && email.toLowerCase().trim() !== existing.email;

    localDb.db.prepare(`
      UPDATE users SET
        name               = COALESCE(?, name),
        email              = COALESCE(?, email),
        powerbird_id       = COALESCE(?, powerbird_id),
        role               = COALESCE(?, role),
        is_active          = COALESCE(?, is_active),
        feature_calendar     = COALESCE(?, feature_calendar),
        feature_vacation     = COALESCE(?, feature_vacation),
        feature_hours        = COALESCE(?, feature_hours),
        feature_news_read    = COALESCE(?, feature_news_read),
        feature_news_write   = COALESCE(?, feature_news_write),
        feature_todos_read   = COALESCE(?, feature_todos_read),
        feature_todos_create = COALESCE(?, feature_todos_create),
        feature_tools        = COALESCE(?, feature_tools),
        feature_tools_search = COALESCE(?, feature_tools_search),
        feature_show_verleih = COALESCE(?, feature_show_verleih),
        feature_sick             = COALESCE(?, feature_sick),
        feature_documents        = COALESCE(?, feature_documents),
        feature_docs_upload      = COALESCE(?, feature_docs_upload),
        feature_docs_upload_all  = COALESCE(?, feature_docs_upload_all),
        feature_docs_manage      = COALESCE(?, feature_docs_manage)
      WHERE id = ?
    `).run(
      name        ?? null,
      email       ? email.toLowerCase().trim() : null,
      powerbird_id ?? null,
      role        ?? null,
      is_active   !== undefined ? (is_active ? 1 : 0) : null,
      feature_calendar     !== undefined ? (feature_calendar     ? 1 : 0) : null,
      feature_vacation     !== undefined ? (feature_vacation     ? 1 : 0) : null,
      feature_hours        !== undefined ? (feature_hours        ? 1 : 0) : null,
      feature_news_read    !== undefined ? (feature_news_read    ? 1 : 0) : null,
      feature_news_write   !== undefined ? (feature_news_write   ? 1 : 0) : null,
      feature_todos_read   !== undefined ? (feature_todos_read   ? 1 : 0) : null,
      feature_todos_create !== undefined ? (feature_todos_create ? 1 : 0) : null,
      feature_tools        !== undefined ? (feature_tools        ? 1 : 0) : null,
      feature_tools_search !== undefined ? (feature_tools_search ? 1 : 0) : null,
      feature_show_verleih !== undefined ? (feature_show_verleih ? 1 : 0) : null,
      feature_sick             !== undefined ? (feature_sick             ? 1 : 0) : null,
      feature_documents        !== undefined ? (feature_documents        ? 1 : 0) : null,
      feature_docs_upload      !== undefined ? (feature_docs_upload      ? 1 : 0) : null,
      feature_docs_upload_all  !== undefined ? (feature_docs_upload_all  ? 1 : 0) : null,
      feature_docs_manage      !== undefined ? (feature_docs_manage      ? 1 : 0) : null,
      userId
    );

    // E-Mail-Änderung: Info an alte und neue Adresse
    if (emailChanged) {
      const displayName = name || existing.name;
      const cfg = mailer.getBaseConfig ? mailer.getBaseConfig() : {}
      const company = cfg.company || 'LD Connect'

      const buildInfo = (toEmail, headline) => mailer.buildEmail({
        ...cfg,
        title: 'E-Mail-Adresse geändert',
        greeting: `Hallo ${displayName}`,
        lines: [
          headline,
          `Alte E-Mail-Adresse: <strong>${existing.email}</strong>`,
          `Neue E-Mail-Adresse: <strong>${email.toLowerCase().trim()}</strong>`,
          'Falls Sie diese Änderung nicht veranlasst haben, wenden Sie sich bitte sofort an Ihren Administrator.',
        ],
        footerNote: company,
      });

      try {
        await mailer.sendMail(existing.email, 'Ihre E-Mail-Adresse wurde geändert', buildInfo(existing.email,
          'Ihre E-Mail-Adresse im ' + company + ' Portal wurde geändert.'));
        await mailer.sendMail(email.toLowerCase().trim(), 'E-Mail-Adresse bestätigt', buildInfo(email,
          'Ihre E-Mail-Adresse im ' + company + ' Portal wurde auf diese Adresse geändert.'));
      } catch(mailErr) {
        console.log('E-Mail Benachrichtigung Fehler:', mailErr.message);
        // Fehler beim Mailversand soll das Speichern nicht blockieren
      }
    }

    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/:id
router.delete('/:id', adminMiddleware, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Sie können sich nicht selbst löschen' });
  localDb.db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/users/:id/resend-invite
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

// POST /api/users/:id/reset-password
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
