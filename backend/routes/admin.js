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


// POST /api/admin/smb-mount - Mount SMB share automatically
router.post('/smb-mount', adminMiddleware, async (req, res) => {
  try {
    const user = localDb.getSetting('smb_user') || ''
    const pass = localDb.getSetting('smb_password') || ''
    const mount = localDb.getSetting('smb_mount') || '/mnt/smb'
    const smbServer = req.body.server || '' // e.g. //192.168.13.20/Pictures

    if (!user || !pass || !smbServer) {
      return res.status(400).json({ error: 'SMB-Benutzer, Passwort und Server-Pfad erforderlich' })
    }

    // Save server path
    localDb.setSetting('smb_server', smbServer)

    // Create mount directory
    if (!fs.existsSync(mount)) {
      fs.mkdirSync(mount, { recursive: true })
    }

    // Check if already mounted
    const mountCmd = `mountpoint -q "${mount}" 2>/dev/null && echo "mounted" || echo "not"`
    exec(mountCmd, (err, stdout) => {
      if (stdout.trim() === 'mounted') {
        // Unmount first
        exec(`umount "${mount}" 2>/dev/null; true`, () => doMount())
      } else {
        doMount()
      }
    })

    function doMount() {
      const cmd = `mount -t cifs "${smbServer}" "${mount}" -o username="${user}",password="${pass}",uid=1000,gid=1000,file_mode=0644,dir_mode=0755,vers=3.0 2>&1`
      exec(cmd, (err, stdout, stderr) => {
        const output = (stdout + stderr).trim()
        if (err) {
          return res.status(500).json({ error: 'Mount fehlgeschlagen', detail: output })
        }
        res.json({ success: true, message: `✅ ${smbServer} erfolgreich gemountet nach ${mount}`, mount })
      })
    }
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/admin/smb-unmount - Unmount SMB share
router.post('/smb-unmount', adminMiddleware, (req, res) => {
  const mount = localDb.getSetting('smb_mount') || '/mnt/smb'
  exec(`umount "${mount}" 2>&1`, (err, stdout, stderr) => {
    const output = (stdout + stderr).trim()
    if (err) return res.status(500).json({ error: output || 'Fehler beim Unmount' })
    res.json({ success: true, message: `✅ ${mount} ausgehängt` })
  })
})

// GET /api/admin/smb-status - Check if SMB is mounted
router.get('/smb-status', adminMiddleware, (req, res) => {
  const mount = localDb.getSetting('smb_mount') || '/mnt/smb'
  exec(`mountpoint -q "${mount}" 2>/dev/null && echo "mounted" || echo "not"`, (err, stdout) => {
    const mounted = stdout.trim() === 'mounted'
    res.json({ mounted, mount, server: localDb.getSetting('smb_server') || '' })
  })
})

module.exports = router;
