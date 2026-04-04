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
      'smb_user', 'smb_password', 'smb_mount', 'smb_domain',
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


// POST /api/admin/smb-mount - Save settings and test connection
router.post('/smb-mount', adminMiddleware, (req, res) => {
  const { server, user, password, domain } = req.body
  if (server) localDb.setSetting('smb_server', server)
  if (user) localDb.setSetting('smb_user', user)
  if (password) localDb.setSetting('smb_password', password)
  if (domain !== undefined) localDb.setSetting('smb_domain', domain)

  const smbServer = (server || localDb.getSetting('smb_server') || '').trim()
  const smbUser = (user || localDb.getSetting('smb_user') || '').trim()
  const smbPass = (password || localDb.getSetting('smb_password') || '').trim()
  const smbDomain = (domain || localDb.getSetting('smb_domain') || 'WORKGROUP').trim()

  if (!smbServer || !smbUser || !smbPass) {
    return res.status(400).json({ error: 'Server-Pfad, Benutzer und Passwort erforderlich' })
  }

  const normalized = smbServer.replace(/\\/g, '/').replace(/^\/\//, '')
  const parts = normalized.split('/')
  const host = parts[0]
  const share = parts[1] || ''

  if (!host || !share) {
    return res.status(400).json({ error: 'Ungültiger Pfad. Format: //SERVER/FREIGABE' })
  }

  try {
    const SMB2 = require('@marsaud/smb2')
    const sharePath = '\\\\' + host + '\\' + share
    const smb2Client = new SMB2({
      share: sharePath,
      domain: smbDomain,
      username: smbUser,
      password: smbPass,
    })

    smb2Client.readdir('', (err, files) => {
      if (err) {
        return res.status(500).json({ error: 'Verbindung fehlgeschlagen', detail: err.message })
      }
      const count = Array.isArray(files) ? files.length : '?'
      res.json({ success: true, message: `✅ Verbunden mit ${smbServer} — ${count} Einträge gefunden` })
    })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
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
  res.json({ mounted, mount: 'SMB2', server, domain: localDb.getSetting('smb_domain') || 'WORKGROUP' })
})

module.exports = router;
