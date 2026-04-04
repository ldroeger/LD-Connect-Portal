const express = require('express');
const router = express.Router();
const { adminMiddleware } = require('../middleware/auth');
const localDb = require('../db/localDb');

// Get all settings (admin only)
router.get('/settings', adminMiddleware, (req, res) => {
  const settings = localDb.getSettings();
  // Remove sensitive data
  delete settings.db_password;
  delete settings.smtp_password;
  res.json({ settings });
});

// Update settings
router.put('/settings', adminMiddleware, (req, res) => {
  try {
    const allowed = ['calendar_range_days', 'app_url', 'display_ip', 'company_name', 'primary_color', 'logo_url',
      'smb_user', 'smb_password', 'smb_mount',
      'db_host', 'db_port', 'db_name', 'db_user', 'db_encrypt', 'db_trust_cert',
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_from'];
    
    Object.entries(req.body).forEach(([key, value]) => {
      if (allowed.includes(key)) localDb.setSetting(key, value);
    });
    
    // Handle passwords separately
    if (req.body.db_password) localDb.setSetting('db_password', req.body.db_password);
    if (req.body.smtp_password) localDb.setSetting('smtp_password', req.body.smtp_password);

    // Reset DB pool when connection settings change
    if (['db_host', 'db_port', 'db_name', 'db_user', 'db_password'].some(k => req.body[k] !== undefined)) {
      require('../db/powerbirdDb').closePool().catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST /api/admin/smb-mount - Save settings and test SMB2 connection
router.post('/smb-mount', adminMiddleware, async (req, res) => {
  try {
    const { server, user, password, mount } = req.body
    if (server) localDb.setSetting('smb_server', server)
    if (user) localDb.setSetting('smb_user', user)
    if (password) localDb.setSetting('smb_password', password)

    const smbServer = server || localDb.getSetting('smb_server') || ''
    const smbUser = user || localDb.getSetting('smb_user') || ''
    const smbPass = password || localDb.getSetting('smb_password') || ''

    if (!smbServer || !smbUser || !smbPass) {
      return res.status(400).json({ error: 'Server-Pfad, Benutzer und Passwort erforderlich' })
    }

    // Parse host and share
    const normalized = smbServer.replace(/\\/g, '/').replace(/^\/\//, '')
    const parts = normalized.split('/')
    const host = parts[0]
    const share = parts[1] || ''

    try {
      const SMB2 = require('@marsaud/smb2')
      const smb2Client = new SMB2({
        share: `\\\\${host}\\${share}`,
        domain: '',
        username: smbUser,
        password: smbPass,
        autoCloseTimeout: 3000,
      })

      smb2Client.readdir('.', (err, files) => {
        smb2Client.close()
        if (err) {
          return res.status(500).json({ error: 'Verbindung fehlgeschlagen', detail: err.message })
        }
        res.json({ success: true, message: `✅ Verbunden! ${files.length} Dateien/Ordner gefunden in ${smbServer}` })
      })
    } catch(e) {
      res.status(500).json({ error: 'SMB2 Fehler: ' + e.message })
    }
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// POST /api/admin/smb-unmount - just clear settings
router.post('/smb-unmount', adminMiddleware, (req, res) => {
  localDb.setSetting('smb_server', '')
  localDb.setSetting('smb_user', '')
  localDb.setSetting('smb_password', '')
  res.json({ success: true, message: '✅ SMB-Zugangsdaten gelöscht' })
})

// GET /api/admin/smb-status
router.get('/smb-status', adminMiddleware, (req, res) => {
  const server = localDb.getSetting('smb_server') || ''
  const user = localDb.getSetting('smb_user') || ''
  const mounted = !!(server && user)
  res.json({ mounted, mount: 'SMB2', server })
})

module.exports = router;
