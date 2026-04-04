const express = require('express');
const router = express.Router();
const { adminMiddleware } = require('../middleware/auth');
const localDb = require('../db/localDb');
const { exec } = require('child_process');
const fs = require('fs');

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


// POST /api/admin/smb-mount - Save settings and auto-mount
router.post('/smb-mount', adminMiddleware, (req, res) => {
  try {
    const { server, user, password, mount } = req.body
    if (server) localDb.setSetting('smb_server', server)
    if (user) localDb.setSetting('smb_user', user)
    if (password) localDb.setSetting('smb_password', password)
    if (mount) localDb.setSetting('smb_mount', mount)

    const smbServer = server || localDb.getSetting('smb_server') || ''
    const smbUser = user || localDb.getSetting('smb_user') || ''
    const smbPass = password || localDb.getSetting('smb_password') || ''
    const mountPath = mount || localDb.getSetting('smb_mount') || '/mnt/smb'

    if (!smbServer || !smbUser || !smbPass) {
      return res.status(400).json({ error: 'Server-Pfad, Benutzer und Passwort erforderlich' })
    }

    // Create mount dir
    exec(`mkdir -p "${mountPath}"`, () => {
      // Unmount if already mounted
      exec(`umount "${mountPath}" 2>/dev/null; true`, () => {
        // Mount
        const cmd = `mount -t cifs "${smbServer}" "${mountPath}" -o username="${smbUser}",password="${smbPass}",uid=1000,gid=1000,vers=3.0,noperm,iocharset=utf8 2>&1`
        exec(cmd, (err, stdout, stderr) => {
          const output = (stdout + stderr).trim()
          if (err || output) {
            return res.status(500).json({ error: 'Mount fehlgeschlagen', detail: output })
          }
          res.json({ success: true, message: `✅ ${smbServer} erfolgreich gemountet nach ${mountPath}` })
        })
      })
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

// POST /api/admin/smb-unmount
router.post('/smb-unmount', adminMiddleware, (req, res) => {
  const mount = localDb.getSetting('smb_mount') || '/mnt/smb'
  exec(`umount "${mount}" 2>&1`, (err, stdout, stderr) => {
    const output = (stdout + stderr).trim()
    if (err) return res.status(500).json({ error: output || 'Fehler beim Unmount' })
    res.json({ success: true, message: `✅ ${mount} ausgehängt` })
  })
})

// GET /api/admin/smb-status
router.get('/smb-status', adminMiddleware, (req, res) => {
  const mount = localDb.getSetting('smb_mount') || '/mnt/smb'
  exec(`mountpoint -q "${mount}" 2>/dev/null && echo mounted || echo not`, (err, stdout) => {
    const mounted = stdout.trim() === 'mounted'
    res.json({ mounted, mount, server: localDb.getSetting('smb_server') || '' })
  })
})

module.exports = router;
