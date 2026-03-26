const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const localDb = require('../db/localDb');
const powerbirdDb = require('../db/powerbirdDb');

// Get setup status
router.get('/status', (req, res) => {
  const complete = localDb.getSetting('setup_complete') === 'true';
  const step = parseInt(localDb.getSetting('setup_step') || '0');
  res.json({ complete, step });
});

// Step 1: Create admin account
router.post('/admin', async (req, res) => {
  try {
    const complete = localDb.getSetting('setup_complete') === 'true';
    if (complete) return res.status(400).json({ error: 'Setup bereits abgeschlossen' });

    const { name, email, password, powerbird_id } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, E-Mail und Passwort sind erforderlich' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' });
    }

    const existing = localDb.db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
    if (existing) return res.status(400).json({ error: 'Admin existiert bereits' });

    const hash = await bcrypt.hash(password, 12);
    localDb.db.prepare(`
      INSERT INTO users (email, name, powerbird_id, password_hash, role)
      VALUES (?, ?, ?, ?, 'admin')
    `).run(email, name, powerbird_id || 'ADMIN', hash);

    localDb.setSetting('setup_step', '1');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 2: Test and save DB connection
router.post('/database', async (req, res) => {
  try {
    const { host, port, database, user, password, encrypt, trust_cert } = req.body;
    if (!host || !database || !user) {
      return res.status(400).json({ error: 'Server, Datenbank und Benutzer sind erforderlich' });
    }

    // Test connection
    await powerbirdDb.testConnection({
      server: host,
      port: parseInt(port || '1433'),
      database,
      user,
      password,
      encrypt: encrypt || false,
      trustServerCertificate: trust_cert !== false,
    });

    // Save settings
    localDb.setSetting('db_host', host);
    localDb.setSetting('db_port', port || '1433');
    localDb.setSetting('db_name', database);
    localDb.setSetting('db_user', user);
    localDb.setSetting('db_password', password);
    localDb.setSetting('db_encrypt', String(encrypt || false));
    localDb.setSetting('db_trust_cert', String(trust_cert !== false));
    localDb.setSetting('setup_step', '2');

    res.json({ success: true, message: 'Verbindung erfolgreich getestet und gespeichert' });
  } catch (err) {
    res.status(400).json({ error: `Verbindungsfehler: ${err.message}` });
  }
});

// Step 2: Just test DB connection without saving
router.post('/test-database', async (req, res) => {
  try {
    const { host, port, database, user, password, encrypt, trust_cert } = req.body;
    await powerbirdDb.testConnection({
      server: host,
      port: parseInt(port || '1433'),
      database,
      user,
      password,
      encrypt: encrypt || false,
      trustServerCertificate: trust_cert !== false,
    });
    res.json({ success: true, message: 'Verbindung erfolgreich!' });
  } catch (err) {
    res.status(400).json({ error: `Verbindungsfehler: ${err.message}` });
  }
});

// Step 3: Save branding
router.post('/branding', (req, res) => {
  try {
    const { company_name, primary_color, logo_url, calendar_range_days, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from } = req.body;

    if (company_name) localDb.setSetting('company_name', company_name);
    if (primary_color) localDb.setSetting('primary_color', primary_color);
    if (logo_url !== undefined) localDb.setSetting('logo_url', logo_url);
    if (calendar_range_days) localDb.setSetting('calendar_range_days', calendar_range_days);
    if (smtp_host) localDb.setSetting('smtp_host', smtp_host);
    if (smtp_port) localDb.setSetting('smtp_port', smtp_port);
    if (smtp_user) localDb.setSetting('smtp_user', smtp_user);
    if (smtp_password) localDb.setSetting('smtp_password', smtp_password);
    if (smtp_from) localDb.setSetting('smtp_from', smtp_from);

    localDb.setSetting('setup_complete', 'true');
    localDb.setSetting('setup_step', '3');

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
